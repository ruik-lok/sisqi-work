import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  approvals as seedApprovals,
  auditLog as seedAudit,
  initialTasks,
  type Approval,
  type Task,
} from '../data/nexus'
import {
  initialMessages,
  models as seedModels,
  providers as seedProviders,
  sessions as seedSessions,
  type ChatMessage,
  type ModelInfo,
  type Provider,
  type Session,
  type ThemeMode,
} from '../data/work'
import { LlmError, streamChat, testProvider as probeProvider, type LlmContentPart, type LlmMessage, type ReasoningEffort, type AgentMessage } from '../lib/llm'
import { AGENT_SYSTEM_PROMPT, runAgent } from '../lib/agent'
import { maskKey, secretStore } from '../lib/secrets'

export type { ThemeMode }

export const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; hint: string }> = [
  { id: 'light', label: 'Arctic Blue', hint: '亮色' },
  { id: 'dark', label: 'Midnight Blue', hint: '暗色' },
  { id: 'system', label: '跟随系统', hint: '自动' },
]

export type Density = 'lite' | 'pro'
export type { ReasoningEffort } from '../lib/llm'

/** 待发送的附件：图片走多模态 image_url，文本文件拼进上下文 */
export type NewAttachment =
  | { kind: 'image'; name: string; dataUrl: string }
  | { kind: 'text'; name: string; text: string }

export interface ToastItem {
  id: number
  title: string
  detail?: string
  tone: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'
}

export interface AuditItem {
  at: string
  actor: string
  action: string
  decision: string
  reason: string
}

export interface UsageState {
  requests: number
  promptTokens: number
  completionTokens: number
  costUsd: number
  lastLatencyMs: number | null
  lastErrorAt: string | null
}

export interface ChatError {
  title: string
  detail?: string
  hint?: string
  status?: number
}

interface PersistShape {
  version: 2
  theme: ThemeMode
  density: Density
  effort?: ReasoningEffort
  /** Agent 模式（工具调用）开关 */
  agentMode?: boolean
  modelId: string
  sessions: Session[]
  messages: Record<string, ChatMessage[]>
  providers: Array<Omit<Provider, 'keyMasked'>>
  models: ModelInfo[]
  usage: UsageState
}

interface Store {
  /* appearance */
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: ThemeMode) => void
  /** 深度思考强度 */
  effort: ReasoningEffort
  setEffort: (e: ReasoningEffort) => void
  /** Agent 模式：允许模型调用设备工具（读屏/点击/命令） */
  agentMode: boolean
  setAgentMode: (on: boolean) => void
  density: Density
  setDensity: (d: Density) => void

  /* sessions */
  sessions: Session[]
  activeSession: Session
  selectSession: (id: string) => void
  newSession: () => void
  renameSession: (id: string, title: string) => void
  deleteSession: (id: string) => void
  togglePin: (id: string) => void

  /* chat */
  messages: ChatMessage[]
  streaming: boolean
  /** 输入框草稿：空状态的建议卡片点击后填入，Composer 与 ChatThread 共用 */
  draft: string
  setDraft: (text: string) => void
  chatError: ChatError | null
  sendMessage: (text: string, attachments?: NewAttachment[]) => void
  stopStreaming: () => void
  regenerate: () => void
  clearError: () => void
  hasApiKey: boolean
  demoMode: boolean

  /* models */
  modelId: string
  setModelId: (id: string) => void
  models: ModelInfo[]
  providers: Provider[]
  activeProvider: Provider | undefined
  addProvider: (input: Omit<Provider, 'id' | 'keyMasked' | 'status' | 'lastTest' | 'latencyMs'>) => string
  updateProvider: (id: string, patch: Partial<Provider>) => void
  removeProvider: (id: string) => void
  setProviderKey: (id: string, key: string) => Promise<void>
  clearProviderKey: (id: string) => Promise<void>
  testProvider: (id: string, override?: { baseUrl?: string; key?: string }) => Promise<void>
  toggleProvider: (id: string) => void
  addModel: (input: Omit<ModelInfo, 'id'>) => void
  updateModel: (id: string, patch: Partial<ModelInfo>) => void
  removeModel: (id: string) => void
  setDefaultModel: (id: string) => void

  /* usage & data */
  usage: UsageState
  resetUsage: () => void
  exportData: () => string
  importData: (json: string) => { ok: boolean; message: string }

  /* tasks & approvals (演示数据) */
  tasks: Task[]
  task: Task
  selectTask: (id: string) => void
  approvals: Approval[]
  approval: Approval | undefined
  decideApproval: (id: string, decision: 'APPROVED' | 'DENIED') => void
  pauseTask: (id: string) => void
  resumeTask: (id: string) => void
  cancelTask: (id: string) => void

  /* global */
  audit: AuditItem[]
  toasts: ToastItem[]
  toast: (t: Omit<ToastItem, 'id'>) => void
  dismissToast: (id: number) => void
  paletteOpen: boolean
  setPaletteOpen: (v: boolean) => void
}

const Ctx = createContext<Store | null>(null)
const STATE_KEY = 'sisqi.state.v2'

const clock = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

const DEMO_REPLY = [
  '当前是演示模式：还没有为这个 Provider 配置 API Key，所以这段回复由本地脚本生成。',
  '',
  '配置好之后，同样的输入会真的发到模型，并在这里流式返回：',
  '1. 打开「设置 → 模型与 API」；',
  '2. 填 Base URL（通常以 /v1 结尾）与 API Key；',
  '3. 点击「连接测试」，成功后回到会话即可。',
  '',
  '密钥保存在本机（桌面版用系统加密存储），界面只显示掩码。',
]

function loadState(): Partial<PersistShape> {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistShape>
    if (!parsed || parsed.version !== 2) return {}
    return parsed
  } catch {
    return {}
  }
}

const initial = loadState()

/** 把界面消息转成模型消息：文本附件拼进正文，图片转多模态 parts */
function toLlmMessage(m: ChatMessage): LlmMessage {
  const fileText = m.files?.length
    ? '\n\n' + m.files.map((f) => `[附件 ${f.name}]\n\`\`\`\n${f.text ?? ''}\n\`\`\``).join('\n\n')
    : ''
  const text = (m.content + fileText).trim() || '请看这张图片'
  if (m.role === 'user' && m.images?.length) {
    const parts: LlmContentPart[] = [
      { type: 'text', text },
      ...m.images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
    ]
    return { role: 'user', content: parts }
  }
  return { role: m.role === 'assistant' ? 'assistant' : 'user', content: text }
}

export function NexusProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('theme') as ThemeMode | null
    const candidate = fromUrl ?? initial.theme ?? 'dark'
    return candidate === 'light' || candidate === 'dark' || candidate === 'system' ? candidate : 'dark'
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [effort, setEffort] = useState<ReasoningEffort>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('effort') as ReasoningEffort | null
    const candidate = fromUrl ?? initial.effort ?? 'high'
    return candidate === 'low' || candidate === 'high' || candidate === 'max' ? candidate : 'high'
  })
  const [agentMode, setAgentModeState] = useState<boolean>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('agent')
    return fromUrl ? fromUrl !== '0' : Boolean(initial.agentMode)
  })
  const setAgentMode = useCallback((on: boolean) => setAgentModeState(on), [])
  const [density, setDensityState] = useState<Density>(() => (new URLSearchParams(window.location.search).get('ui') as Density | null) ?? initial.density ?? 'pro')

  const [sessionList, setSessionList] = useState<Session[]>(() => {
    const list = initial.sessions?.length ? initial.sessions : seedSessions
    // 兼容旧数据：确保每条会话都有 preview
    return list.map((s) => ({ ...s, preview: s.preview ?? '' }))
  })
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(() => {
    if (initial.messages) return initial.messages
    const map: Record<string, ChatMessage[]> = {}
    for (const s of seedSessions) map[s.id] = s.id === seedSessions[0].id ? initialMessages : []
    return map
  })
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('session')
    const list = initial.sessions?.length ? initial.sessions : seedSessions
    return fromUrl && list.some((s) => s.id === fromUrl) ? fromUrl : list[0]?.id ?? seedSessions[0].id
  })

  const [modelId, setModelIdState] = useState<string>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('model')
    if (fromUrl && seedModels.some((m) => m.id === fromUrl)) return fromUrl
    return initial.modelId ?? seedModels.find((m) => m.isDefault)?.id ?? seedModels[0].id
  })
  const [modelList, setModelList] = useState<ModelInfo[]>(() => {
    // 本地已保存的模型 + 新版本内置模型（按 id 去重）；顺带清掉早期内置的 deepseek-chat / reasoner 演示条目
    const legacy = new Set(['m_ds', 'm_ds_chat'])
    const merged = (initial.models ?? []).filter((m) => !legacy.has(m.id))
    for (const m of seedModels) {
      const existing = merged.find((x) => x.id === m.id)
      if (!existing) {
        merged.push(m)
        continue
      }
      // 老数据里价格为 0 的内置模型：用种子里的官方定价补上（不动用户自己加/改过的模型）
      if (!existing.priceIn && !existing.priceOut && (m.priceIn || m.priceOut)) {
        existing.priceIn = m.priceIn
        existing.priceOut = m.priceOut
      }
    }
    return merged.length ? merged : seedModels
  })
  const [providers, setProviders] = useState<Provider[]>(() => {
    const base = initial.providers?.length ? initial.providers : seedProviders.map(({ keyMasked: _k, ...rest }) => rest)
    return base.map((p) => ({ ...p, keyMasked: '未配置', status: 'unverified', latencyMs: null, lastTest: null }))
  })

  const [streaming, setStreaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [chatError, setChatError] = useState<ChatError | null>(null)
  const [usage, setUsage] = useState<UsageState>(() => initial.usage ?? { requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, lastLatencyMs: null, lastErrorAt: null })

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [selectedTaskId, setSelectedTaskId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('task')
    return fromUrl && initialTasks.some((t) => t.id === fromUrl) ? fromUrl : 'T-2481'
  })
  const [approvalList, setApprovalList] = useState<Approval[]>(seedApprovals)
  const [audit] = useState<AuditItem[]>(seedAudit)

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const toastSeq = useRef(1)
  const abortRef = useRef<AbortController | null>(null)
  const keysRef = useRef<Record<string, string>>({})
  const [keyTick, setKeyTick] = useState(0)

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  const activeSession = sessionList.find((s) => s.id === activeSessionId) ?? sessionList[0]
  const messages = messagesMap[activeSession?.id ?? ''] ?? []
  const activeModel = modelList.find((m) => m.id === modelId) ?? modelList[0]
  const activeProvider = providers.find((p) => p.id === activeModel?.providerId)
  const hasApiKey = Boolean(activeProvider && keysRef.current[activeProvider.id])
  const demoMode = !hasApiKey

  /* ---------------------------------------------------------- system */

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
    localStorage.setItem('sisqi.theme', theme)
  }, [theme, resolvedTheme])

  // 启动时把密钥读进内存（不落 localStorage）
  useEffect(() => {
    let cancelled = false
    const store = secretStore()
    void (async () => {
      const next: Record<string, string> = {}
      for (const p of providers) {
        const key = await store.get(p.id)
        if (key) next[p.id] = key
      }
      if (cancelled) return
      keysRef.current = next
      // 当前默认模型没配密钥、而别的 Provider 有时，自动切到可用的那个（例如只配了 DeepSeek Key）
      setModelIdState((cur) => {
        const curModel = modelList.find((m) => m.id === cur)
        if (curModel && next[curModel.providerId]) return cur
        const usable = modelList.find((m) => m.enabled && next[m.providerId])
        return usable ? usable.id : cur
      })
      setKeyTick((v) => v + 1)
      setProviders((prev) => prev.map((p) => ({ ...p, keyMasked: next[p.id] ? maskKey(next[p.id]) : '未配置' })))
    })()
    return () => {
      cancelled = true
    }
    // 只在挂载时读取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 持久化（不含密钥）
  useEffect(() => {
    const payload: PersistShape = {
      version: 2,
      theme,
      density,
      effort,
      agentMode,
      modelId,
      sessions: sessionList,
      messages: messagesMap,
      providers: providers.map(({ keyMasked: _k, ...rest }) => rest),
      models: modelList,
      usage,
    }
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(payload))
      } catch {
        /* 配额不足时忽略 */
      }
    }, 250)
    return () => window.clearTimeout(t)
  }, [theme, density, effort, agentMode, modelId, sessionList, messagesMap, providers, modelList, usage])

  const toast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = toastSeq.current++
    setToasts((prev) => [...prev.slice(-3), { ...t, id }])
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200)
  }, [])

  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)), [])

  /* ---------------------------------------------------------- sessions */

  const touchSession = useCallback((id: string, patch: Partial<Session>) => {
    setSessionList((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: '刚刚' } : s)))
  }, [])

  const appendMessages = useCallback((sessionId: string, items: ChatMessage[]) => {
    setMessagesMap((prev) => ({ ...prev, [sessionId]: [...(prev[sessionId] ?? []), ...items] }))
  }, [])

  const patchMessage = useCallback((sessionId: string, messageId: string, patch: Partial<ChatMessage>) => {
    setMessagesMap((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] ?? []).map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    }))
  }, [])

  const selectSession = useCallback((id: string) => {
    abortRef.current?.abort()
    setStreaming(false)
    setChatError(null)
    setActiveSessionId(id)
  }, [])

  const newSession = useCallback(() => {
    const id = `s_${Date.now()}`
    const s: Session = { id, title: '新会话', project: null, updatedAt: '刚刚', status: 'idle', preview: '还没有消息' }
    setSessionList((prev) => [s, ...prev])
    setMessagesMap((prev) => ({ ...prev, [id]: [] }))
    setActiveSessionId(id)
    setChatError(null)
  }, [])

  const renameSession = useCallback((id: string, title: string) => {
    const clean = title.trim().slice(0, 60)
    if (!clean) return
    setSessionList((prev) => prev.map((s) => (s.id === id ? { ...s, title: clean } : s)))
  }, [])

  const deleteSession = useCallback(
    (id: string) => {
      setSessionList((prev) => {
        const next = prev.filter((s) => s.id !== id)
        const list = next.length ? next : seedSessions.slice(0, 1)
        if (id === activeSessionId) setActiveSessionId(list[0].id)
        return list
      })
      setMessagesMap((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      toast({ title: '会话已删除', tone: 'neutral' })
    },
    [activeSessionId, toast],
  )

  const togglePin = useCallback((id: string) => {
    setSessionList((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
      return [...next].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
    })
  }, [])

  /* -------------------------------------------------------------- chat */

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    setMessagesMap((prev) => {
      const list = prev[activeSessionId] ?? []
      return { ...prev, [activeSessionId]: list.map((m) => (m.streaming ? { ...m, streaming: false } : m)) }
    })
  }, [activeSessionId])

  const runTurn = useCallback(
    async (history: ChatMessage[]) => {
      const provider = providers.find((p) => p.id === activeModel.providerId)
      if (!provider) {
        setChatError({ title: '找不到模型所属的 Provider', hint: '在「模型与 API」里检查模型配置。' })
        return
      }
      const apiKey = keysRef.current[provider.id] ?? ''
      const assistantId = `a_${Date.now()}`
      const startedAt = performance.now()

      if (!apiKey) {
        // 演示模式：本地生成
        appendMessages(activeSessionId, [{ id: assistantId, role: 'assistant', content: '', time: clock(), streaming: true, mode: 'demo' }])
        setStreaming(true)
        touchSession(activeSessionId, { status: 'running' })
        let i = 0
        const timer = window.setInterval(() => {
          i += 1
          patchMessage(activeSessionId, assistantId, {
            content: DEMO_REPLY.slice(0, i).join(''),
            streaming: i < DEMO_REPLY.length,
          })
          if (i >= DEMO_REPLY.length) {
            window.clearInterval(timer)
            setStreaming(false)
            touchSession(activeSessionId, { status: 'idle', preview: DEMO_REPLY[0].slice(0, 36) })
          }
        }, 260)
        return
      }

      const llmMessages: LlmMessage[] = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        // 演示模式的助手消息是本地脚本写的，会带偏真模型（它会模仿成"演示模式"），不送进上下文
        .filter((m) => m.mode !== 'demo')
        .filter((m) => m.content.trim().length > 0 || Boolean(m.images?.length))
        .slice(-20)
        .map((m) => toLlmMessage(m))

      const controller = new AbortController()
      abortRef.current = controller
      setStreaming(true)
      setChatError(null)
      touchSession(activeSessionId, { status: 'running' })
      appendMessages(activeSessionId, [{ id: assistantId, role: 'assistant', content: '', time: clock(), streaming: true, mode: 'live' }])

      if (agentMode) {
        try {
          const agentMessages: AgentMessage[] = [
            { role: 'system', content: AGENT_SYSTEM_PROMPT },
            ...llmMessages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content:
                typeof m.content === 'string'
                  ? m.content
                  : m.content.map((part) => (part.type === 'text' ? part.text : '[图片]')).join('\n'),
            })),
          ]
          const result = await runAgent({
            baseUrl: provider.baseUrl,
            apiKey,
            model: activeModel.name,
            messages: agentMessages,
            reasoningEffort: activeModel.capabilities.includes('推理') ? effort : undefined,
            onTrace: (trace) => patchMessage(activeSessionId, assistantId, { agentTrace: trace }),
            onPhase: (phase) => patchMessage(activeSessionId, assistantId, { content: phase }),
          })
          const latency = Math.round(performance.now() - startedAt)
          patchMessage(activeSessionId, assistantId, {
            streaming: false,
            content: result.content || '（已完成）',
            reasoning: result.reasoning,
            agentTrace: result.trace,
            time: clock(),
          })
          setProviders((prev) =>
            prev.map((p) => (p.id === provider.id ? { ...p, status: 'connected', latencyMs: latency, lastTest: `今天 ${clock()}` } : p)),
          )
          setUsage((prev) => ({
            requests: prev.requests + 1,
            promptTokens: prev.promptTokens + (result.usage?.promptTokens ?? 0),
            completionTokens: prev.completionTokens + (result.usage?.completionTokens ?? 0),
            costUsd:
              prev.costUsd +
              ((result.usage?.promptTokens ?? 0) / 1_000_000) * activeModel.priceIn +
              ((result.usage?.completionTokens ?? 0) / 1_000_000) * activeModel.priceOut,
            lastLatencyMs: latency,
            lastErrorAt: prev.lastErrorAt,
          }))
          touchSession(activeSessionId, { status: 'idle', preview: result.content.slice(0, 40) || '已执行' })
        } catch (err) {
          const info = err instanceof LlmError ? err.info : { message: (err as Error).message }
          patchMessage(activeSessionId, assistantId, { streaming: false, content: `执行失败：${info.message}` })
          setChatError({
            title: info.status ? `工具调用失败（HTTP ${info.status}）` : '工具调用失败',
            detail: info.message,
            hint: info.hint,
            status: info.status,
          })
          touchSession(activeSessionId, { status: 'idle' })
        } finally {
          abortRef.current = null
          setStreaming(false)
        }
        return
      }

      let text = ''
      let reasoning = ''
      let usageInfo: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined

      try {
        await streamChat({
          baseUrl: provider.baseUrl,
          apiKey,
          model: activeModel.name,
          messages: llmMessages,
          signal: controller.signal,
          // 只有带推理能力的模型才发 reasoning_effort，避免别的网关 400
          reasoningEffort: activeModel.capabilities.includes('推理') ? effort : undefined,
          onReasoning: (delta) => {
            reasoning += delta
            patchMessage(activeSessionId, assistantId, { reasoning })
          },
          onDelta: (delta) => {
            text += delta
            patchMessage(activeSessionId, assistantId, { content: text })
          },
          onUsage: (u) => {
            usageInfo = u
          },
        })

        const latency = Math.round(performance.now() - startedAt)
        patchMessage(activeSessionId, assistantId, { streaming: false, content: text, time: clock() })
        setProviders((prev) => prev.map((p) => (p.id === provider.id ? { ...p, status: 'connected', latencyMs: latency, lastTest: `今天 ${clock()}` } : p)))
        setUsage((prev) => ({
          requests: prev.requests + 1,
          promptTokens: prev.promptTokens + (usageInfo?.promptTokens ?? 0),
          completionTokens: prev.completionTokens + (usageInfo?.completionTokens ?? 0),
          costUsd:
            prev.costUsd +
            ((usageInfo?.promptTokens ?? 0) / 1_000_000) * activeModel.priceIn +
            ((usageInfo?.completionTokens ?? 0) / 1_000_000) * activeModel.priceOut,
          lastLatencyMs: latency,
          lastErrorAt: prev.lastErrorAt,
        }))
        touchSession(activeSessionId, { status: 'idle', preview: text.slice(0, 40) || '已回复' })
      } catch (err) {
        const aborted = (err as Error).name === 'AbortError'
        patchMessage(activeSessionId, assistantId, { streaming: false })
        if (aborted) {
          touchSession(activeSessionId, { status: 'idle' })
        } else {
          const info = err instanceof LlmError ? err.info : { message: (err as Error).message }
          setChatError({
            title: info.status ? `请求失败（HTTP ${info.status}）` : '请求失败',
            detail: info.message,
            hint: info.hint,
            status: info.status,
          })
          setUsage((prev) => ({ ...prev, lastErrorAt: clock() }))
          touchSession(activeSessionId, { status: 'idle' })
          toast({ title: '模型调用失败', detail: info.hint ?? info.message, tone: 'danger' })
        }
      } finally {
        abortRef.current = null
        setStreaming(false)
      }
    },
    [activeModel, activeSessionId, agentMode, appendMessages, effort, patchMessage, providers, toast, touchSession],
  )

  const sendMessage = useCallback(
    (text: string, attachments?: NewAttachment[]) => {
      const trimmed = text.trim()
      const images = (attachments ?? []).filter((a): a is Extract<NewAttachment, { kind: 'image' }> => a.kind === 'image').map((a) => a.dataUrl)
      const files = (attachments ?? [])
        .filter((a): a is Extract<NewAttachment, { kind: 'text' }> => a.kind === 'text')
        .map((a) => ({ name: a.name, text: a.text }))
      if ((!trimmed && !images.length) || streaming) return
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: trimmed,
        time: clock(),
        images: images.length ? images : undefined,
        files: files.length ? files : undefined,
      }
      appendMessages(activeSessionId, [userMsg])
      touchSession(activeSessionId, {
        status: 'running',
        preview: trimmed.slice(0, 36) || (images.length ? '发送了图片' : files[0]?.name ?? ''),
        title: activeSession.title === '新会话' ? trimmed.slice(0, 24) || (images.length ? '图片会话' : activeSession.title) : activeSession.title,
      })
      const history = [...messages, userMsg]
      void runTurn(history)
    },
    [activeSession.title, activeSessionId, appendMessages, messages, runTurn, streaming, touchSession],
  )

  const regenerate = useCallback(() => {
    if (streaming) return
    const history = [...messages]
    let lastUser = -1
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].role === 'user') {
        lastUser = i
        break
      }
    }
    if (lastUser < 0) return
    const trimmed = history.slice(0, lastUser + 1)
    setMessagesMap((prev) => ({ ...prev, [activeSessionId]: trimmed }))
    void runTurn(trimmed)
  }, [activeSessionId, messages, runTurn, streaming])

  const clearError = useCallback(() => setChatError(null), [])

  /* ------------------------------------------------------------ models */

  const setModelId = useCallback((id: string) => setModelIdState(id), [])

  const addProvider = useCallback((input: Omit<Provider, 'id' | 'keyMasked' | 'status' | 'lastTest' | 'latencyMs'>) => {
    const id = `p_${Date.now()}`
    setProviders((prev) => [...prev, { ...input, id, keyMasked: '未配置', status: 'unverified', lastTest: null, latencyMs: null }])
    return id
  }, [])

  const updateProvider = useCallback((id: string, patch: Partial<Provider>) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const removeProvider = useCallback(
    (id: string) => {
      setProviders((prev) => prev.filter((p) => p.id !== id))
      void secretStore().delete(id)
      delete keysRef.current[id]
      setKeyTick((v) => v + 1)
      setModelList((prev) => prev.filter((m) => m.providerId !== id))
      toast({ title: 'Provider 已移除', tone: 'neutral' })
    },
    [toast],
  )

  const setProviderKey = useCallback(
    async (id: string, key: string) => {
      const clean = key.trim()
      const store = secretStore()
      if (!clean) {
        await store.delete(id)
        delete keysRef.current[id]
      } else {
        await store.set(id, clean)
        keysRef.current[id] = clean
      }
      setKeyTick((v) => v + 1)
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, keyMasked: clean ? maskKey(clean) : '未配置', status: 'unverified' } : p)))
    },
    [],
  )

  const clearProviderKey = useCallback(async (id: string) => {
    await secretStore().delete(id)
    delete keysRef.current[id]
    setKeyTick((v) => v + 1)
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, keyMasked: '未配置', status: 'unverified' } : p)))
  }, [])

  const testProvider = useCallback(
    async (id: string, override?: { baseUrl?: string; key?: string }) => {
      const provider = providers.find((p) => p.id === id)
      if (!provider) return
      // 允许传入刚在弹窗里改过的 Base URL / Key，避免测试跑到上一次保存的配置
      const key = override?.key?.trim() || keysRef.current[id]
      const baseUrl = override?.baseUrl?.trim() || provider.baseUrl
      if (!key) {
        toast({ title: '还没有配置密钥', detail: '先填写 API Key，再做连接测试。', tone: 'warn' })
        return
      }
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'unverified', latencyMs: null } : p)))
      try {
        const res = await probeProvider(baseUrl, key)
        setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'connected', latencyMs: res.latencyMs, lastTest: `今天 ${clock()}` } : p)))
        toast({ title: '连接成功', detail: `${res.models.length} 个模型 · ${res.latencyMs}ms`, tone: 'ok' })
        if (res.models.length) {
          setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, models: res.models.slice(0, 30) } : p)))
        }
        return res
      } catch (err) {
        const info = err instanceof LlmError ? err.info : { message: (err as Error).message }
        setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'error', latencyMs: null, lastTest: `今天 ${clock()}` } : p)))
        toast({ title: '连接失败', detail: info.hint ?? info.message, tone: 'danger' })
      }
    },
    [providers, toast],
  )

  const toggleProvider = useCallback((id: string) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)))
  }, [])

  const addModel = useCallback(
    (input: Omit<ModelInfo, 'id'>) => {
      const id = `m_${Date.now()}`
      setModelList((prev) => [...prev, { ...input, id }])
    },
    [],
  )

  const updateModel = useCallback((id: string, patch: Partial<ModelInfo>) => {
    setModelList((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }, [])

  const removeModel = useCallback((id: string) => {
    setModelList((prev) => prev.filter((m) => m.id !== id))
    setModelIdState((cur) => (cur === id ? '' : cur))
  }, [])

  const setDefaultModel = useCallback((id: string) => {
    setModelList((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })))
    setModelIdState(id)
  }, [])

  /* ------------------------------------------------------------- data */

  const resetUsage = useCallback(() => {
    setUsage({ requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, lastLatencyMs: null, lastErrorAt: null })
    toast({ title: '用量计数已清零', tone: 'neutral' })
  }, [toast])

  const exportData = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 2,
      theme,
      density,
      modelId,
      sessions: sessionList,
      messages: messagesMap,
      providers: providers.map(({ keyMasked: _k, ...rest }) => rest),
      models: modelList,
      usage,
    }
    return JSON.stringify(payload, null, 2)
  }, [density, messagesMap, modelId, modelList, providers, sessionList, theme, usage])

  const importData = useCallback(
    (json: string) => {
      try {
        const data = JSON.parse(json) as Partial<PersistShape>
        if (!data.sessions || !data.messages) return { ok: false, message: '文件缺少 sessions / messages 字段' }
        setSessionList(data.sessions)
        setMessagesMap(data.messages)
        if (data.providers?.length) setProviders((prev) => data.providers!.map((p) => ({ ...p, keyMasked: prev.find((x) => x.id === p.id)?.keyMasked ?? '未配置' })))
        if (data.models?.length) setModelList(data.models)
        if (data.modelId) setModelIdState(data.modelId)
        if (data.theme) setThemeState(data.theme)
        if (data.density) setDensityState(data.density)
        setActiveSessionId(data.sessions[0].id)
        toast({ title: '备份已导入', detail: `${data.sessions.length} 个会话`, tone: 'ok' })
        return { ok: true, message: `导入 ${data.sessions.length} 个会话` }
      } catch (err) {
        return { ok: false, message: (err as Error).message }
      }
    },
    [toast],
  )

  /* ------------------------------------------------- tasks / approvals */

  const selectTask = setSelectedTaskId

  const pushTaskEvent = useCallback((taskId: string, label: string, detail?: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const seq = (t.events.at(-1)?.sequence ?? 0) + 1
        return { ...t, updatedAt: '刚刚', events: [...t.events, { sequence: seq, type: 'MANUAL', label, detail, timestamp: clock() }] }
      }),
    )
  }, [])

  const pauseTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.map((t) => (t.id === id && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status) ? { ...t, status: 'PAUSED', stage: 'PAUSED' } : t)))
      pushTaskEvent(id, '任务已暂停（用户操作）')
      toast({ title: '任务已暂停', detail: `${id} 状态已写入检查点`, tone: 'warn' })
    },
    [pushTaskEvent, toast],
  )

  const resumeTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.map((t) => (t.id === id && t.status === 'PAUSED' ? { ...t, status: 'RUNNING', stage: 'RUNNING' } : t)))
      pushTaskEvent(id, '从检查点恢复', '事件按序列补拉，无重复副作用')
      toast({ title: '已恢复执行', tone: 'ok' })
    },
    [pushTaskEvent, toast],
  )

  const cancelTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.map((t) => (t.id === id && !['COMPLETED', 'CANCELLED'].includes(t.status) ? { ...t, status: 'CANCELLED', stage: 'CANCELLED' } : t)))
      pushTaskEvent(id, '任务已取消', '变更保留为 patch')
      toast({ title: '任务已取消', tone: 'danger' })
    },
    [pushTaskEvent, toast],
  )

  const decideApproval = useCallback(
    (id: string, decision: 'APPROVED' | 'DENIED') => {
      const appr = approvalList.find((a) => a.id === id)
      if (!appr) return
      setApprovalList((prev) => prev.map((a) => (a.id === id ? { ...a, status: decision } : a)))
      setTasks((prev) =>
        prev.map((t) =>
          t.id === appr.taskId
            ? { ...t, status: decision === 'APPROVED' ? 'RUNNING' : 'PAUSED', stage: decision === 'APPROVED' ? 'RUNNING' : 'PAUSED', awaitingApprovalId: undefined }
            : t,
        ),
      )
      pushTaskEvent(appr.taskId, decision === 'APPROVED' ? '审批通过 · 单次授权' : '审批拒绝 · 任务暂停')
      toast({
        title: decision === 'APPROVED' ? '已授权本次调用' : '已拒绝',
        detail: decision === 'APPROVED' ? '5 分钟内单次有效，不授予 Root' : '未执行设备侧操作，已记录审计',
        tone: decision === 'APPROVED' ? 'ok' : 'danger',
      })
    },
    [approvalList, pushTaskEvent, toast],
  )

  const value = useMemo<Store>(() => {
    const task = tasks.find((t) => t.id === selectedTaskId) ?? tasks[0]
    return {
      theme,
      resolvedTheme,
      setTheme: setThemeState,
      effort,
      setEffort,
      agentMode,
      setAgentMode,
      density,
      setDensity: setDensityState,
      sessions: sessionList,
      activeSession,
      selectSession,
      newSession,
      renameSession,
      deleteSession,
      togglePin,
      messages,
      streaming,
      draft,
      setDraft,
      chatError,
      sendMessage,
      stopStreaming,
      regenerate,
      clearError,
      hasApiKey,
      demoMode,
      modelId,
      setModelId,
      models: modelList,
      providers,
      activeProvider,
      addProvider,
      updateProvider,
      removeProvider,
      setProviderKey,
      clearProviderKey,
      testProvider,
      toggleProvider,
      addModel,
      updateModel,
      removeModel,
      setDefaultModel,
      usage,
      resetUsage,
      exportData,
      importData,
      tasks,
      task,
      selectTask,
      approvals: approvalList,
      approval: approvalList.find((a) => a.taskId === task.id && a.status === 'PENDING'),
      decideApproval,
      pauseTask,
      resumeTask,
      cancelTask,
      audit,
      toasts,
      toast,
      dismissToast,
      paletteOpen,
      setPaletteOpen,
    } as Store
  }, [
    activeProvider,
    activeSession,
    addModel,
    addProvider,
    approvalList,
    audit,
    cancelTask,
    chatError,
    clearError,
    clearProviderKey,
    decideApproval,
    deleteSession,
    density,
    dismissToast,
    effort,
    exportData,
    hasApiKey,
    importData,
    keyTick,
    messages,
    modelId,
    modelList,
    newSession,
    paletteOpen,
    pauseTask,
    providers,
    regenerate,
    removeModel,
    removeProvider,
    renameSession,
    resetUsage,
    resolvedTheme,
    resumeTask,
    selectedTaskId,
    selectSession,
    selectTask,
    sendMessage,
    sessionList,
    setDefaultModel,
    setModelId,
    setProviderKey,
    stopStreaming,
    streaming,
    draft,
    tasks,
    testProvider,
    toggleProvider,
    theme,
    toast,
    toasts,
    togglePin,
    updateModel,
    updateProvider,
    usage,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNexus(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNexus must be used inside NexusProvider')
  return v
}

export type { Session, ChatMessage, Provider, ModelInfo }