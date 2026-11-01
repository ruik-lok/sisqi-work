/**
 * 轻量 LLM 客户端：只支持 OpenAI 兼容的 /chat/completions 流式协议。
 * 三条通道：
 *  - Android APK：window.SisqiHttp 原生 HTTP（绕过 WebView 的 CORS），SSE 由 Java 逐行回吐；
 *  - Electron 桌面版：关闭了 webSecurity，普通 fetch 直连；
 *  - 浏览器预览：fetch，第三方端点通常会被 CORS 拦住，失败时给出明确提示。
 */

import { nativeHttpAvailable, nativeRequest, streamNative } from './native-http'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamOptions {
  baseUrl: string
  apiKey: string
  model: string
  messages: LlmMessage[]
  signal?: AbortSignal
  onDelta: (text: string) => void
  onUsage?: (usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) => void
}

export interface LlmErrorInfo {
  status?: number
  message: string
  hint?: string
  cors?: boolean
}

export class LlmError extends Error {
  info: LlmErrorInfo
  constructor(info: LlmErrorInfo) {
    super(info.message)
    this.name = 'LlmError'
    this.info = info
  }
}

const joinUrl = (base: string) => base.replace(/\/+$/, '')

const STATUS_HINTS: Record<number, string> = {
  400: '模型名称或参数不被接受，检查模型 ID 与协议是否为 OpenAI 兼容。',
  401: 'API Key 无效，请在「模型与 API」中更新。',
  403: '该密钥没有调用权限。',
  404: 'Base URL 路径不对，通常应以 /v1 结尾，或模型不存在。',
  429: '触发限流，稍后重试或更换模型。',
  500: '供应商服务异常，稍后重试。',
  502: '网关错误，稍后重试。',
  503: '供应商暂时不可用，稍后重试。',
}

const hintFor = (status: number) => STATUS_HINTS[status] ?? (status >= 500 ? '供应商服务异常，稍后重试。' : '检查 Base URL、模型 ID 与密钥权限。')

export async function listModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${joinUrl(baseUrl)}/models`
  const auth = `Bearer ${apiKey}`

  if (nativeHttpAvailable()) {
    const res = nativeRequest('GET', url, auth, '')
    if ('error' in res) {
      throw new LlmError({ message: '无法连接该地址', hint: '检查网络与 Base URL 是否正确。' })
    }
    if (res.status === 401 || res.status === 403) {
      throw new LlmError({ status: res.status, message: '密钥无效或没有权限', hint: '更新 API Key 后重试。' })
    }
    if (res.status < 200 || res.status >= 300) {
      throw new LlmError({ status: res.status, message: `Provider 返回 ${res.status}`, hint: hintFor(res.status) })
    }
    try {
      const data = JSON.parse(res.body) as { data?: Array<{ id?: string }> }
      return (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
    } catch {
      throw new LlmError({ message: '响应不是合法 JSON', hint: '确认 Base URL 指向 OpenAI 兼容网关。' })
    }
  }

  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: auth } })
  } catch {
    throw new LlmError({
      message: '无法连接该地址',
      hint: '检查 Base URL 是否可访问；Web 预览下可能是浏览器 CORS 限制，请使用桌面版或 APK。',
      cors: true,
    })
  }
  if (res.status === 401 || res.status === 403) {
    throw new LlmError({ status: res.status, message: '密钥无效或没有权限', hint: '更新 API Key 后重试。' })
  }
  if (!res.ok) {
    throw new LlmError({ status: res.status, message: `Provider 返回 ${res.status}`, hint: hintFor(res.status) })
  }
  const data = (await res.json()) as { data?: Array<{ id?: string }> }
  return (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
}

export async function testProvider(baseUrl: string, apiKey: string): Promise<{ ok: boolean; latencyMs: number; models: string[] }> {
  const started = performance.now()
  const models = await listModels(baseUrl, apiKey)
  return { ok: true, latencyMs: Math.round(performance.now() - started), models }
}

/** 读取 SSE 流（fetch 通道），逐段回调。 */
export async function streamChat(opts: StreamOptions): Promise<{ text: string; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }> {
  if (nativeHttpAvailable()) return streamChatNative(opts)

  let res: Response
  try {
    res = await fetch(`${joinUrl(opts.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: opts.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new LlmError({
      message: '请求没有发出去',
      hint: '检查网络、Base URL；浏览器预览可能被 CORS 拦截，APK 与桌面版不受此限制。',
      cors: true,
    })
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.text()
      detail = body.slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new LlmError({ status: res.status, message: `HTTP ${res.status}${detail ? ' · ' + detail : ''}`, hint: hintFor(res.status) })
  }

  if (!res.body) throw new LlmError({ message: '响应没有内容流', hint: '该端点可能不支持流式输出。' })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let idx = buffer.indexOf('\n\n')
    while (idx >= 0) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      idx = buffer.indexOf('\n\n')
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        const parsed = parseChunk(payload)
        if (parsed.delta) {
          text += parsed.delta
          opts.onDelta(parsed.delta)
        }
        if (parsed.usage) {
          usage = parsed.usage
          opts.onUsage?.(usage)
        }
      }
    }
  }

  return { text, usage }
}

type Usage = { promptTokens?: number; completionTokens?: number; totalTokens?: number }

function parseChunk(payload: string): { delta?: string; usage?: Usage } {
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const delta = json.choices?.[0]?.delta?.content
    const usage = json.usage
      ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens, totalTokens: json.usage.total_tokens }
      : undefined
    return { delta, usage }
  } catch {
    return {}
  }
}

/** Android 原生通道：SSE 由 Java 逐行回吐，这里解析 data 载荷。 */
async function streamChatNative(opts: StreamOptions): Promise<{ text: string; usage?: Usage }> {
  const body = JSON.stringify({
    model: opts.model,
    messages: opts.messages,
    stream: true,
    stream_options: { include_usage: true },
  })

  let text = ''
  let usage: Usage | undefined

  try {
    await streamNative({
      url: `${joinUrl(opts.baseUrl)}/chat/completions`,
      auth: `Bearer ${opts.apiKey}`,
      body,
      signal: opts.signal,
      onData: (payload) => {
        if (!payload || payload === '[DONE]') return
        const parsed = parseChunk(payload)
        if (parsed.delta) {
          text += parsed.delta
          opts.onDelta(parsed.delta)
        }
        if (parsed.usage) {
          usage = parsed.usage
          opts.onUsage?.(usage)
        }
      },
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    const status = (err as { status?: number }).status ?? 0
    const detail = String((err as Error).message ?? '').slice(0, 240)
    if (status === 0) {
      throw new LlmError({ message: '请求没有发出去', hint: `检查网络与 Base URL；如果用了内网网关，确认手机能访问。${detail ? ' · ' + detail : ''}` })
    }
    throw new LlmError({ status, message: `HTTP ${status}${detail ? ' · ' + detail : ''}`, hint: hintFor(status) })
  }

  return { text, usage }
}
