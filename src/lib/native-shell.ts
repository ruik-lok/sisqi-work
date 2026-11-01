/** root 命令通道（APK 内才有）：SisqiShell.shellRun → window.__sisqiShell 回调 */

export interface ShellResult {
  code: number
  out: string
  err: string
  timeout?: boolean
}

interface ShellHost {
  shellRun?: (id: string, cmd: string, timeoutMs: number) => void
}

declare global {
  interface Window {
    SisqiShell?: ShellHost
    __sisqiShell?: (id: string, json: string) => void
  }
}

const waiters = new Map<string, (r: ShellResult) => void>()
let seq = 0

export function nativeShellAvailable(): boolean {
  return Boolean(window.SisqiShell?.shellRun)
}

export function runShell(cmd: string, timeoutMs = 20000): Promise<ShellResult> {
  const host = window.SisqiShell
  if (!host?.shellRun) {
    return Promise.resolve({ code: -1, out: '', err: '当前环境没有 root 命令通道（只有 Android APK 里有）' })
  }
  window.__sisqiShell = (id: string, json: string) => {
    const cb = waiters.get(id)
    if (!cb) return
    waiters.delete(id)
    try {
      cb(JSON.parse(json) as ShellResult)
    } catch {
      cb({ code: -1, out: '', err: '返回解析失败' })
    }
  }
  const id = `s${++seq}-${Date.now()}`
  return new Promise((resolve) => {
    waiters.set(id, resolve)
    host.shellRun!(id, cmd, timeoutMs)
  })
}

/** 打开另一个应用（跳转授权） */
export function openApp(pkg: string): boolean {
  const host = window.SisqiHost as unknown as { openApp?: (p: string) => void } | undefined
  if (!host?.openApp) return false
  host.openApp(pkg)
  return true
}

/** 清掉 root 检测缓存后重新检测 */
export function resetRootCache() {
  rootChecked = null
}

/** 只跑一次 su，确认 root 是否可用（结果缓存） */
let rootChecked: boolean | null = null

export async function rootAvailable(): Promise<boolean> {
  if (rootChecked !== null) return rootChecked
  if (!nativeShellAvailable()) {
    rootChecked = false
    return false
  }
  const r = await runShell('id -u', 8000)
  rootChecked = r.code === 0 && r.out.trim() === '0'
  return rootChecked
}