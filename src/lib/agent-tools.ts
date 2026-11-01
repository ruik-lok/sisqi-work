/**
 * Agent 工具：把手机当成可操作的对象（读屏、点击、滑动、输入、shell）。
 * 全部通过 root 命令通道执行；模型通过 tool_calls 调用，失败时返回可读错误。
 */
import { runShell } from './native-shell'

export interface ToolSpec {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export const AGENT_TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'device_info',
      description: '读取设备基本信息：型号、Android 版本、屏幕分辨率、当前前台应用。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'shell',
      description: '在设备上以 root 身份执行一条 shell 命令，返回 stdout/stderr 与退出码。适合查文件、看进程、读系统状态。',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: '要执行的命令' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_screen',
      description: '读取当前屏幕上的可见控件（文字、描述、坐标、是否可点击）。用它判断现在是什么界面、按钮在哪。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tap',
      description: '点击屏幕坐标（像素）。坐标可用 read_screen 返回的控件中心。',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'number', description: '横坐标 px' },
          y: { type: 'number', description: '纵坐标 px' },
        },
        required: ['x', 'y'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'swipe',
      description: '从一点滑动到另一点（像素），用于滚动列表或翻页。',
      parameters: {
        type: 'object',
        properties: {
          x1: { type: 'number' },
          y1: { type: 'number' },
          x2: { type: 'number' },
          y2: { type: 'number' },
          durationMs: { type: 'number', description: '默认 300' },
        },
        required: ['x1', 'y1', 'x2', 'y2'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: '往当前聚焦的输入框输入文本。中文会自动走剪贴板粘贴。',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_app',
      description: '按包名启动一个应用，例如 com.android.settings。',
      parameters: {
        type: 'object',
        properties: { package: { type: 'string' } },
        required: ['package'],
      },
    },
  },
]

function xmlText(xml: string): string {
  const nodes: string[] = []
  const re = /<node\b([^>]*)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1]
    const get = (k: string) => {
      const r = new RegExp(k + '="([^"]*)"').exec(attrs)
      return r ? r[1] : ''
    }
    const text = get('text') || get('content-desc')
    const bounds = get('bounds')
    const clickable = get('clickable') === 'true'
    if (!text && !clickable) continue
    const nums = bounds.match(/\d+/g)?.map(Number) ?? []
    const center = nums.length === 4 ? `center=(${Math.round((nums[0] + nums[2]) / 2)},${Math.round((nums[1] + nums[3]) / 2)})` : ''
    const cls = get('class').split('.').pop() ?? ''
    nodes.push(`[${cls}]${text ? ` "${text}"` : ''} ${clickable ? 'clickable ' : ''}${center}`)
    if (nodes.length >= 60) break
  }
  return nodes.join('\n')
}

export async function runTool(name: string, rawArgs: string): Promise<string> {
  let args: Record<string, unknown> = {}
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {}
  } catch {
    return '参数不是合法 JSON'
  }
  const str = (k: string) => String(args[k] ?? '')

  switch (name) {
    case 'device_info': {
      const r = await runShell(
        "getprop ro.product.model; getprop ro.build.version.release; wm size | tail -1; dumpsys activity activities | grep -m1 topResumedActivity",
        12000,
      )
      return r.code === 0 ? r.out.trim() : `失败：${r.err}`
    }
    case 'shell': {
      const cmd = str('command')
      if (!cmd.trim()) return '命令为空'
      const r = await runShell(cmd, 25000)
      return [`exit=${r.code}${r.timeout ? ' (超时)' : ''}`, r.out.trim().slice(0, 6000), r.err.trim() ? `[stderr] ${r.err.trim().slice(0, 1000)}` : '']
        .filter(Boolean)
        .join('\n')
    }
    case 'read_screen': {
      const r = await runShell('uiautomator dump /data/local/tmp/sisqi-ui.xml >/dev/null 2>&1; cat /data/local/tmp/sisqi-ui.xml', 20000)
      if (r.code !== 0 || !r.out.includes('<hierarchy')) return `读屏失败：${r.err || r.out.slice(0, 200)}`
      const text = xmlText(r.out)
      return text || '屏幕上看不到可读控件'
    }
    case 'tap': {
      const x = Math.round(Number(args.x))
      const y = Math.round(Number(args.y))
      if (!Number.isFinite(x) || !Number.isFinite(y)) return '坐标无效'
      const r = await runShell(`input tap ${x} ${y}`, 12000)
      return r.code === 0 ? `已点击 (${x}, ${y})` : `点击失败：${r.err}`
    }
    case 'swipe': {
      const x1 = Math.round(Number(args.x1)), y1 = Math.round(Number(args.y1))
      const x2 = Math.round(Number(args.x2)), y2 = Math.round(Number(args.y2))
      const d = Math.round(Number(args.durationMs)) || 300
      const r = await runShell(`input swipe ${x1} ${y1} ${x2} ${y2} ${d}`, 12000)
      return r.code === 0 ? '已滑动' : `滑动失败：${r.err}`
    }
    case 'type_text': {
      const text = str('text')
      if (!text) return '文本为空'
      if (/^[\x20-\x7E]*$/.test(text)) {
        const escaped = text.replace(/ /g, '%s').replace(/(['"\\$&|;<>()])/g, '\\$1')
        const r = await runShell(`input text "${escaped.replace(/"/g, '\\"')}"`, 12000)
        return r.code === 0 ? '已输入' : `输入失败：${r.err}`
      }
      const b64 = btoa(unescape(encodeURIComponent(text)))
      const r = await runShell(`am broadcast -a clipper.set -e text "$(echo ${b64} | base64 -d)" >/dev/null 2>&1; input keyevent 279`, 15000)
      return r.code === 0 ? '已通过剪贴板粘贴' : `输入失败：${r.err}`
    }
    case 'open_app': {
      const pkg = str('package').trim()
      if (!/^[\w.]+$/.test(pkg)) return '包名格式不对'
      const r = await runShell(`monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, 15000)
      return r.code === 0 ? `已启动 ${pkg}` : `启动失败：${r.err}`
    }
    default:
      return `未知工具 ${name}`
  }
}
