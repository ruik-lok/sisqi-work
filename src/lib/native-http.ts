/**
 * Android 外壳的原生 HTTP 通道（window.SisqiHttp）。
 * WebView 里直接 fetch 第三方 LLM 端点会被 CORS 拦（供应商不回 ACAO），
 * 所以对话与 /models 都交给 Java 发请求：流式内容按 SSE 行回吐到 __sisqiHttp。
 * 浏览器 / Electron 里没有 SisqiHttp，自动回退到 fetch。
 */
export interface NativeRequestResult {
  status: number
  body: string
}

export interface NativeRequestError {
  error: string
}

interface NativeHttp {
  httpStream?: (id: string, url: string, auth: string, body: string) => void
  httpCancel?: (id: string) => void
  httpRequest?: (method: string, url: string, auth: string, body: string) => string
}

declare global {
  interface Window {
    SisqiHttp?: NativeHttp
    __sisqiHttp?: (id: string, kind: string, status: string | null, payload: string) => void
  }
}

interface Handler {
  onData: (payload: string) => void
  onEnd: () => void
  onError: (status: string, message: string) => void
}

const handlers = new Map<string, Handler>()
let seq = 0

export function nativeHttpAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.SisqiHttp?.httpStream === 'function'
}

if (typeof window !== 'undefined' && window.SisqiHttp) {
  window.__sisqiHttp = (id, kind, status, payload) => {
    const h = handlers.get(id)
    if (!h) return
    if (kind === 'data') h.onData(payload)
    else if (kind === 'end') {
      handlers.delete(id)
      h.onEnd()
    } else if (kind === 'error') {
      handlers.delete(id)
      h.onError(status ?? '0', payload)
    }
  }
}

/** 同步请求（/models、连接测试）。失败返回 { error }，不抛异常。 */
export function nativeRequest(method: string, url: string, auth: string, body: string): NativeRequestResult | NativeRequestError {
  const host = window.SisqiHttp
  if (!host?.httpRequest) return { error: 'native http unavailable' }
  try {
    return JSON.parse(host.httpRequest(method, url, auth, body)) as NativeRequestResult | NativeRequestError
  } catch {
    return { error: 'native http returned invalid JSON' }
  }
}

export interface NativeStreamArgs {
  url: string
  auth: string
  body: string
  signal?: AbortSignal
  onData: (payload: string) => void
}

/** 流式请求：resolve 表示流正常结束；reject 带 status（0 = 网络层失败）。 */
export function streamNative(args: NativeStreamArgs): Promise<void> {
  const host = window.SisqiHttp
  if (!host?.httpStream) return Promise.reject(new Error('native http unavailable'))
  const id = `s${++seq}-${Date.now()}`
  return new Promise<void>((resolve, reject) => {
    const detach = () => args.signal?.removeEventListener('abort', onAbort)
    const fail = (err: Error) => {
      detach()
      reject(err)
    }
    const onAbort = () => {
      handlers.delete(id)
      host.httpCancel?.(id)
      fail(new DOMException('Aborted', 'AbortError'))
    }
    handlers.set(id, {
      onData: args.onData,
      onEnd: () => {
        detach()
        resolve()
      },
      onError: (status, message) => {
        detach()
        reject(Object.assign(new Error(message || 'native http error'), { status: Number(status) || 0 }))
      },
    })
    if (args.signal) {
      if (args.signal.aborted) {
        handlers.delete(id)
        fail(new DOMException('Aborted', 'AbortError'))
        return
      }
      args.signal.addEventListener('abort', onAbort, { once: true })
    }
    try {
      host.httpStream!(id, args.url, args.auth, args.body)
    } catch (err) {
      handlers.delete(id)
      fail(err as Error)
    }
  })
}
