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
  providers as seedProviders,
  sessions as seedSessions,
  type ChatMessage,
  type Provider,
  type Session,
  type ThemeMode,
} from '../data/work'

export type { ThemeMode }

export const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; hint: string }> = [
  { id: 'light', label: 'Arctic Blue', hint: '亮色' },
  { id: 'dark', label: 'Midnight Blue', hint: '暗色' },
  { id: 'system', label: '跟随系统', hint: '自动' },
]

export type Density = 'lite' | 'pro'

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

interface Store {
  /* appearance */
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: ThemeMode) => void
  density: Density
  setDensity: (d: Density) => void

  /* sessions & chat */
  sessions: Session[]
  activeSession: Session
  selectSession: (id: string) => void
  messages: ChatMessage[]
  streaming: boolean
  sendMessage: (text: string) => void
  stopStreaming: () => void
  newSession: () => void

  /* models */
  modelId: string
  setModelId: (id: string) => void
  providers: Provider[]
  testProvider: (id: string) => void
  toggleProvider: (id: string) => void

  /* tasks & approvals */
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

const clock = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

const REPLY_CHUNKS = [
  '我先确认一下当前工作区状态：项目 nexus-core、分支 agent/harness-checkpoint、目标设备云端 Sandbox。',
  '\n\n接下来我会：',
  '\n1. 读取 CheckpointStore 与事件表结构；',
  '\n2. 为写入加互斥与序列号 CAS；',
  '\n3. 重跑失败用例并补一条并发回归。',
  '\n\n每一步都会写入任务时间线，失败会停下来把证据发给你。',
]

export function NexusProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('theme') as ThemeMode | null
    const saved = localStorage.getItem('sisqi.theme') as ThemeMode | null
    const candidate = fromUrl ?? saved
    return candidate === 'light' || candidate === 'dark' || candidate === 'system' ? candidate : 'dark'
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [density, setDensityState] = useState<Density>(() => (new URLSearchParams(window.location.search).get('ui') as Density | null) ?? 'pro')

  const [sessionList, setSessionList] = useState<Session[]>(seedSessions)
  const [activeSessionId, setActiveSessionId] = useState(seedSessions[0].id)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [streaming, setStreaming] = useState(false)
  const streamTimer = useRef<number | null>(null)

  const [modelId, setModelIdState] = useState('m_gpt52')
  const [providers, setProviders] = useState<Provider[]>(seedProviders)

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [selectedTaskId, setSelectedTaskId] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('task')
    return fromUrl && initialTasks.some((t) => t.id === fromUrl) ? fromUrl : 'T-2481'
  })
  const [approvalList, setApprovalList] = useState<Approval[]>(seedApprovals)
  const [audit, setAudit] = useState<AuditItem[]>(seedAudit)

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const toastSeq = useRef(1)

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

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

  useEffect(() => {
    localStorage.setItem('sisqi.density', density)
  }, [density])

  const toast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = toastSeq.current++
    setToasts((prev) => [...prev.slice(-3), { ...t, id }])
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200)
  }, [])

  const dismissToast = useCallback((id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)), [])

  /* ------------------------------------------------------------ chat */

  const stopStreaming = useCallback(() => {
    if (streamTimer.current) {
      window.clearInterval(streamTimer.current)
      streamTimer.current = null
    }
    setStreaming(false)
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)))
  }, [])

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || streaming) return
      const now = clock()
      const uid = `u_${Date.now()}`
      setMessages((prev) => [...prev, { id: uid, role: 'user', content: trimmed, time: now }])

      const aid = `a_${Date.now()}`
      setMessages((prev) => [...prev, { id: aid, role: 'assistant', content: '', time: now, streaming: true }])
      setStreaming(true)
      setSessionList((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, status: 'running', updatedAt: '刚刚' } : s)))

      let i = 0
      streamTimer.current = window.setInterval(() => {
        i += 1
        const chunk = REPLY_CHUNKS.slice(0, i).join('')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aid
              ? {
                  ...m,
                  content: chunk,
                  streaming: i < REPLY_CHUNKS.length,
                  tools:
                    i >= 2
                      ? [
                          { name: 'read_file', detail: 'core/agent/harness/CheckpointStore.kt', state: 'done' as const },
                          { name: 'run_tests', detail: '等待你的确认后执行', state: 'blocked' as const },
                        ]
                      : undefined,
                }
              : m,
          ),
        )
        if (i >= REPLY_CHUNKS.length) {
          if (streamTimer.current) window.clearInterval(streamTimer.current)
          streamTimer.current = null
          setStreaming(false)
          setSessionList((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, status: 'idle' } : s)))
        }
      }, 700)
    },
    [activeSessionId, streaming],
  )

  useEffect(
    () => () => {
      if (streamTimer.current) window.clearInterval(streamTimer.current)
    },
    [],
  )

  const newSession = useCallback(() => {
    const id = `s_${Date.now()}`
    const s: Session = { id, title: '新会话', project: null, updatedAt: '刚刚', status: 'idle', preview: '还没有消息' }
    setSessionList((prev) => [s, ...prev])
    setActiveSessionId(id)
    setMessages([])
  }, [])

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id)
  }, [])

  const setModelId = useCallback((id: string) => {
    setModelIdState(id)
  }, [])

  const testProvider = useCallback(
    (id: string) => {
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'unverified', latencyMs: null } : p)))
      const latency = 180 + Math.floor(Math.random() * 420)
      window.setTimeout(() => {
        setProviders((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'connected', latencyMs: latency, lastTest: `今天 ${clock()}` } : p)),
        )
        toast({ title: '连接测试通过', detail: `HTTP 200 · ${latency}ms · 未记录任何密钥`, tone: 'ok' })
      }, 900)
    },
    [toast],
  )

  const toggleProvider = useCallback((id: string) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)))
  }, [])

  /* ---------------------------------------------------------- tasks */

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
      setAudit((prev) => [
        { at: clock(), actor: 'user:pad', action: `APPROVAL ${id} ${appr.capability}`, decision, reason: appr.operation.slice(0, 40) },
        ...prev,
      ])
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
    const activeSession = sessionList.find((s) => s.id === activeSessionId) ?? sessionList[0]
    return {
      theme,
      resolvedTheme,
      setTheme: setThemeState,
      density,
      setDensity: setDensityState,
      sessions: sessionList,
      activeSession,
      selectSession,
      messages,
      streaming,
      sendMessage,
      stopStreaming,
      newSession,
      modelId,
      setModelId,
      providers,
      testProvider,
      toggleProvider,
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
    }
  }, [
    approvalList,
    audit,
    cancelTask,
    decideApproval,
    density,
    dismissToast,
    messages,
    modelId,
    paletteOpen,
    pauseTask,
    providers,
    resolvedTheme,
    resumeTask,
    selectSession,
    selectTask,
    sendMessage,
    sessionList,
    activeSessionId,
    stopStreaming,
    streaming,
    tasks,
    theme,
    toast,
    toasts,
    newSession,
    testProvider,
    toggleProvider,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNexus(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNexus must be used inside NexusProvider')
  return v
}

export type { Session, ChatMessage, Provider }
