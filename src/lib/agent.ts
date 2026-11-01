/** Agent 循环：模型发起 tool_calls → 本地执行 → 结果回灌，直到模型给出最终回答 */
import { AGENT_TOOLS, runTool } from './agent-tools'
import { completeWithTools, type AgentMessage, type ReasoningEffort } from './llm'

export interface AgentTrace {
  name: string
  args: string
  result: string
}

export interface AgentResult {
  content: string
  reasoning: string
  trace: AgentTrace[]
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  steps: number
}

export const AGENT_SYSTEM_PROMPT = [
  '你运行在用户的 Android 手机上，可以通过工具真实操作这台设备：读屏（read_screen）、点击（tap）、滑动（swipe）、输入（type_text）、启动应用（open_app）、执行 root shell（shell）、读取设备信息（device_info）。',
  '规则：',
  '1. 需要看屏幕时先调用 read_screen，再根据返回的坐标点击；点击后可以再读一次屏确认结果。',
  '2. 一次只做必要的一步，做完根据结果决定下一步；不要说"我无法访问手机"，你有工具。',
  '3. 涉及删除数据、发送消息、支付等不可逆操作前，先用一句话说明将要做什么并等待用户确认（除非用户已明确要求）。',
  '4. 工具失败时把错误原样说清楚，不要假装成功。',
  '5. 最终回答简洁，说明你做了什么、结果如何；不要贴工具原始输出。',
].join('\n')

export async function runAgent(opts: {
  baseUrl: string
  apiKey: string
  model: string
  messages: AgentMessage[]
  reasoningEffort?: ReasoningEffort
  maxSteps?: number
  signal?: AbortSignal
  onTrace?: (trace: AgentTrace[]) => void
  onPhase?: (text: string) => void
}): Promise<AgentResult> {
  const working: AgentMessage[] = [...opts.messages]
  const trace: AgentTrace[] = []
  const maxSteps = opts.maxSteps ?? 6
  let content = ''
  let reasoning = ''
  let usage: AgentResult['usage']

  for (let step = 0; step < maxSteps; step++) {
    opts.onPhase?.(step === 0 ? '思考中…' : `执行第 ${step + 1} 步…`)
    const res = await completeWithTools({
      baseUrl: opts.baseUrl,
      apiKey: opts.apiKey,
      model: opts.model,
      messages: working,
      tools: AGENT_TOOLS,
      reasoningEffort: opts.reasoningEffort,
      signal: opts.signal,
    })
    reasoning += res.reasoning
    usage = res.usage ?? usage

    if (!res.toolCalls.length) {
      content = res.content
      return { content, reasoning, trace, usage, steps: step + 1 }
    }

    working.push({
      role: 'assistant',
      content: res.content ?? '',
      tool_calls: res.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.arguments } })),
    })

    for (const call of res.toolCalls) {
      opts.onPhase?.(`调用 ${call.name}…`)
      const result = await runTool(call.name, call.arguments)
      trace.push({ name: call.name, args: call.arguments, result })
      opts.onTrace?.([...trace])
      working.push({ role: 'tool', tool_call_id: call.id, content: result.slice(0, 4000) })
    }
  }

  return {
    content: content || '（已达到工具调用上限，先停在这里。要继续的话说一声。）',
    reasoning,
    trace,
    usage,
    steps: maxSteps,
  }
}
