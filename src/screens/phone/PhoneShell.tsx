import { useEffect, useState } from 'react'
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  GitBranch,
  X,
  FolderKanban,
  History,
  MessagesSquare,
  Plus,
  Plug,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, IconButton, StatusPill, Toggle, taskTone } from '../../components/ui/primitives'
import { BottomSheet, Menu, MenuItem } from '../../components/ui/overlays'
import { Wordmark } from '../../components/brand/Mark'
import { ChatErrorBanner, ChatThread, Composer, SessionList } from '../../components/chat/Chat'
import { TaskCard } from '../../components/panels/TaskCard'
import { THEME_OPTIONS, useNexus } from '../../state/store'
import { PhoneModels } from './PhoneModels'
import { GithubConnector } from './GithubConnector'
import { connectors, skills } from '../../data/work'
import { modelLabel } from '../../lib/labels'
import { deviceInfo, ramGb } from '../../lib/native-device'
import { formatBytes, isTextMime, listFolder, nativeFolderAvailable, pickFolder, readDoc, type ProjectTree } from '../../lib/native-files'
import { readGitInfo, shortRemote, type GitInfo } from '../../lib/git-info'
import { readGitStatus, type GitStatus } from '../../lib/git-status'
import { searchText, type SearchResult } from '../../lib/fs-search'
import { devices } from '../../data/nexus'
import { deviceStatusLabel, taskStatusLabel } from '../../lib/labels'

const MCP_SERVERS = [
  { id: 'mcp_fs', name: 'mcp/filesystem', detail: '受限目录 ~/projects · 只读', status: 'connected' as const },
  { id: 'mcp_gh', name: 'mcp/github', detail: 'repo:read · 2 个仓库已授权', status: 'connected' as const },
  { id: 'mcp_pg', name: 'mcp/postgres', detail: 'dev-cluster · 只读账号过期', status: 'needs_auth' as const },
]

export type PhoneRoute = 'chat' | 'projects' | 'agent' | 'connectors' | 'settings'

const NAV: Array<{ id: PhoneRoute; label: string; icon: typeof MessagesSquare }> = [
  { id: 'chat', label: '会话', icon: MessagesSquare },
  { id: 'projects', label: '项目', icon: FolderKanban },
  { id: 'agent', label: 'Agent', icon: Sparkles },
  { id: 'connectors', label: '连接', icon: Plug },
  { id: 'settings', label: '设置', icon: Settings2 },
]

export function PhoneShell({
  route,
  setRoute,
  onOpenApproval,
}: {
  route: PhoneRoute
  setRoute: (r: PhoneRoute) => void
  onOpenApproval: () => void
}) {
  const { activeSession, newSession, theme, setTheme, approvals, tasks, task, selectTask, approval, models, modelId, pauseTask, resumeTask, cancelTask, toast, usage } = useNexus()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [taskSheet, setTaskSheet] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [skillState, setSkillState] = useState<Record<string, boolean>>(() => Object.fromEntries(skills.map((s) => [s.id, s.enabled])))
  const pendingList = approvals.filter((a) => a.status === 'PENDING')
  const pending = pendingList.length
  const phone = devices[0]
  const info = deviceInfo()
  // 审批按钮：先切到有待审批的任务，再打开对话框；否则 ApprovalDialog 会因当前任务没有待审批项而空白
  const openApprovals = () => {
    const next = pendingList[0]
    if (next && next.taskId !== task.id) selectTask(next.taskId)
    onOpenApproval()
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[var(--bg)]">
      {/* 状态栏安全区域：背景延伸，内容避让；不使用假图标 */}
      <div className="h-[var(--safe-top,26px)] shrink-0 bg-[var(--bg)]" aria-hidden="true" />

      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-4">
        <Wordmark compact />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--fg)]">
          {route === 'chat'
            ? activeSession.title
            : route === 'projects'
              ? '项目'
              : route === 'agent'
                ? 'Agent'
                : route === 'connectors'
                  ? '连接'
                  : '设置'}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {route === 'chat' && (
            <>
              <IconButton label="会话历史" size="sm" onClick={() => setHistoryOpen(true)}>
                <History size={17} />
              </IconButton>
              <IconButton label="新建会话" size="sm" onClick={newSession}>
                <Plus size={18} />
              </IconButton>
            </>
          )}
          <IconButton label={`待批准 ${pending} 项`} size="sm" onClick={openApprovals} className="relative">
            <Bell size={17} />
            {pending > 0 && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--warn)]" />}
          </IconButton>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        {route === 'chat' && (
          <div className="flex h-full min-h-0 flex-col">
            <ChatThread dense />
            <ChatErrorBanner onOpenSettings={() => setRoute('settings')} />
            <Composer dense onOpenSettings={() => setRoute('settings')} />
          </div>
        )}

        {route === 'projects' && <PhoneProjects />}

        {route === 'agent' && (
          <div className="h-full overflow-y-auto px-3 py-3">
            <div className="space-y-1.5">
              {tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  active={t.id === task.id}
                  onClick={() => {
                    selectTask(t.id)
                    setTaskSheet(true)
                  }}
                />
              ))}
            </div>
            <p className="caption mt-2 px-1">更多任务在平板上可用 Pro 模式时间线查看。</p>
          </div>
        )}

        {route === 'connectors' && (
          <div className="h-full overflow-y-auto px-4 py-3">
            <button
              onClick={() => setSkillsOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-left"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--faint)]">
                <Wrench size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-[var(--fg)]">技能与 MCP</span>
                <span className="block text-[11px] text-[var(--faint)]">
                  {Object.values(skillState).filter(Boolean).length}/{skills.length} 个技能启用 · 3 个 MCP Server
                </span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-[var(--faint)]" />
            </button>

            <div className="mt-2 space-y-2">
              <GithubConnector />
              {connectors.filter((c) => c.id !== 'c_github').slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)]">
                    <Plug size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-[var(--fg)]">{c.name}</p>
                    <p className="truncate text-[11px] text-[var(--faint)]">{c.detail}</p>
                  </div>
                  <StatusPill
                    label={c.status === 'connected' ? '已连接' : c.status === 'needs_auth' ? '需授权' : c.status === 'offline' ? '不可用' : '停用'}
                    tone={c.status === 'connected' ? 'ok' : c.status === 'needs_auth' ? 'warn' : c.status === 'offline' ? 'danger' : 'neutral'}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {route === 'settings' && (
          <div className="h-full overflow-y-auto px-4 py-3">
            <section className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] text-[var(--fg)]">外观</span>
                <span className="ml-auto">
                  <Menu
                    label="主题"
                    side="top"
                    trigger={({ toggle }) => (
                      <Button size="sm" variant="ghost" onClick={toggle}>
                        {theme === 'system' ? '跟随系统' : theme === 'light' ? 'Arctic Blue' : 'Midnight Blue'}
                        <ChevronDown size={13} />
                      </Button>
                    )}
                  >
                    {(close) => (
                      <>
                        {THEME_OPTIONS.map((t) => (
                          <MenuItem
                            key={t.id}
                            selected={theme === t.id}
                            onSelect={() => {
                              setTheme(t.id)
                              close()
                            }}
                            hint={t.hint}
                          >
                            {t.label}
                          </MenuItem>
                        ))}
                      </>
                    )}
                  </Menu>
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">默认模型</span>
                <span className="ml-auto font-mono text-[12px] text-[var(--fg)]">{modelLabel(models.find((m) => m.id === modelId))}</span>
              </div>
            </section>

            <PhoneModels />

            <section className="mt-2 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] text-[var(--fg)]">设备</span>
                <StatusPill label={deviceStatusLabel(phone.status)} tone="ok" className="ml-auto" />
              </div>
              {info ? (
                <>
                  <p className="mt-1 text-[11.5px] text-[var(--faint)]">
                    {info.manufacturer} {info.model} · Android {info.android}（API {info.sdk}）
                  </p>
                  <p className="text-[11.5px] text-[var(--faint)]">
                    {info.cores} 核 · {ramGb(info.totalRamMb)} 内存 · 可用 {ramGb(info.availRamMb)}
                  </p>
                  <p className="text-[11.5px] text-[var(--faint)]">
                    ABI {info.abis.split(',')[0]} · su 二进制{info.suBinary ? '存在（应用内未申请 Root）' : '不可见'}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[11.5px] text-[var(--faint)]">
                    {phone.model ?? '待检测'} · API {phone.androidApi ?? '待检测'} · 默认 Lite
                  </p>
                  <p className="text-[11.5px] text-[var(--faint)]">Root Provider 待检测 · 与平板独立授权</p>
                </>
              )}
            </section>

            <section className="mt-2 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] text-[var(--fg)]">用量 · 本机</span>
                <Badge tone="neutral">{usage.requests} 次</Badge>
              </div>
              <p className="mt-1 num text-[11.5px] text-[var(--faint)]">
                ${usage.costUsd.toFixed(3)} · 输入 {formatTokens(usage.promptTokens)} · 输出 {formatTokens(usage.completionTokens)}
              </p>
              <p className="text-[11.5px] text-[var(--faint)]">
                最近延迟 {usage.lastLatencyMs ? `${usage.lastLatencyMs}ms` : '—'} · 最近错误 {usage.lastErrorAt ?? '无'}
              </p>
              <p className="mt-1 text-[11px] text-[var(--faint)]">只统计本机成功请求；费用按模型单价估算，不等于供应商账单。</p>
            </section>

            <p className="mt-3 px-1 text-[11px] leading-relaxed text-[var(--faint)]">思祁.Work 2.0 · 让想法，真正成为作品。</p>
          </div>
        )}
      </main>

      <nav aria-label="主导航" className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="flex h-[58px] items-stretch">
          {NAV.map((n) => {
            const active = route === n.id
            const Icon = n.icon
            return (
              <button
                key={n.id}
                onClick={() => setRoute(n.id)}
                aria-current={active ? 'page' : undefined}
                className={cn('relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors', active ? 'text-[var(--accent)]' : 'text-[var(--faint)]')}
              >
                <Icon size={20} />
                <span className="text-[11px]">{n.label}</span>
                {n.id === 'agent' && pending > 0 && <span className="absolute right-[26%] top-2 size-1.5 rounded-full bg-[var(--warn)]" />}
              </button>
            )
          })}
        </div>
      </nav>
      {/* 手势安全区域：背景延伸，不绘制假手势条 */}
      <div className="h-[var(--safe-bottom,16px)] shrink-0 bg-[var(--surface)]" aria-hidden="true" />

      <BottomSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="会话历史">
        <SessionList onOpenSettings={() => setHistoryOpen(false)} />
      </BottomSheet>

      <BottomSheet open={taskSheet} onClose={() => setTaskSheet(false)} title={task.title}>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusPill label={taskStatusLabel(task.status)} tone={taskTone(task.status)} pulse />
            <span className="font-mono text-[11px] text-[var(--faint)]">{task.id}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${task.progress}%` }} />
          </div>
          {approval && (
            <div className="mt-3 rounded-[12px] border border-[var(--warn)] bg-[var(--warn-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--fg)]">
                <ShieldAlert size={13} className="text-[var(--warn)]" />
                等待审批
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">{approval.operation}</p>
              <Button size="sm" variant="secondary" block className="mt-2" onClick={onOpenApproval}>
                查看并批准
              </Button>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {task.events.slice(-5).reverse().map((e) => (
              <div key={e.sequence} className="flex gap-2">
                <span className="num w-[50px] shrink-0 text-[10.5px] leading-[1.6] text-[var(--faint)]">{e.timestamp}</span>
                <span className="min-w-0 flex-1 text-[11.5px] text-[var(--muted)]">{e.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {task.status === 'PAUSED' ? (
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => resumeTask(task.id)}>
                恢复执行
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                disabled={['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)}
                onClick={() => pauseTask(task.id)}
              >
                暂停
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              disabled={['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)}
              onClick={() => cancelTask(task.id)}
            >
              取消任务
            </Button>
          </div>
          <p className="mt-3 text-[11px] text-[var(--faint)]">完整时间线与 Diff 在平板 Pro 模式查看。</p>
        </div>
      </BottomSheet>

      <BottomSheet open={skillsOpen} onClose={() => setSkillsOpen(false)} title="技能与 MCP" height="max-h-[84%]">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="label">已安装技能</p>
            <Badge tone="neutral" className="ml-auto">
              {Object.values(skillState).filter(Boolean).length}/{skills.length} 启用
            </Badge>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {skills.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-[14px] bg-[var(--surface-2)] px-3 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface)] text-[var(--accent)]">
                  <Wrench size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[var(--fg)]">{s.name}</span>
                  <span className="block truncate text-[11px] text-[var(--faint)]">
                    v{s.version} · {s.scope} · {s.permissions}
                  </span>
                </span>
                <Toggle
                  checked={skillState[s.id]}
                  label={`启用 ${s.name}`}
                  onChange={(v) => {
                    setSkillState((prev) => ({ ...prev, [s.id]: v }))
                    toast({ title: v ? '已启用技能' : '已停用技能', detail: s.name, tone: v ? 'ok' : 'neutral' })
                  }}
                />
              </div>
            ))}
          </div>

          <p className="label mt-4">MCP Server</p>
          <div className="mt-1.5 space-y-1.5">
            {MCP_SERVERS.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-[14px] bg-[var(--surface-2)] px-3 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface)] text-[var(--faint)]">
                  <Plug size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12.5px] text-[var(--fg)]">{m.name}</span>
                  <span className="block truncate text-[11px] text-[var(--faint)]">{m.detail}</span>
                </span>
                <StatusPill label={m.status === 'connected' ? '已连接' : '需授权'} tone={m.status === 'connected' ? 'ok' : 'warn'} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">技能与 MCP 为演示数据；开关只影响本机展示，不会真的执行工具。</p>
        </div>
      </BottomSheet>
    </div>
  )
}

const PROJECT_KEY = 'sisqi.project.uri'

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function PhoneProjects() {
  const { toast } = useNexus()
  const [tree, setTree] = useState<ProjectTree | null>(null)
  const [stack, setStack] = useState<ProjectTree[]>([])
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ name: string; text: string; truncated?: boolean } | null>(null)
  const [git, setGit] = useState<GitInfo | null>(null)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [gitStatus, setGitStatus] = useState<{ tracked: number; status: GitStatus } | null>(null)
  const [hint, setHint] = useState('')

  const load = async (uri: string, docId = '') => {
    setBusy(true)
    try {
      const next = await listFolder(uri, docId)
      if (!next) {
        setHint('目录读取失败，可能是授权已失效，请重新选择文件夹')
        return
      }
      setHint('')
      setTree(next)
      if (!docId) {
        setGit(await readGitInfo(uri))
        setGitStatus(null)
        void readGitStatus(uri).then((s) => setGitStatus(s))
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(PROJECT_KEY)
    if (saved) void load(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!tree || q.length < 2) {
      setResult(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      void searchText(tree.uri, q).then((res) => {
        if (cancelled) return
        setResult(res)
        setSearching(false)
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, tree])

  const openHit = async (hit: { name: string; docId: string }) => {
    if (!tree) return
    const doc = await readDoc(tree.uri, hit.docId)
    if (!doc) {
      toast({ title: '读取失败', detail: hit.name, tone: 'danger' })
      return
    }
    setPreview({ name: hit.name, text: doc.text, truncated: doc.truncated })
  }

  const choose = async () => {
    const next = await pickFolder()
    if (!next) return
    localStorage.setItem(PROJECT_KEY, next.uri)
    setStack([])
    setHint('')
    setTree(next)
    toast({ title: '已接入文件夹', detail: `${next.name} · ${next.files.length} 项`, tone: 'ok' })
  }

  const refresh = async () => {
    if (!tree) return
    await load(tree.uri, stack.length ? tree.docId : '')
  }

  const enter = (docId: string, name: string) => {
    if (!tree) return
    setStack((prev) => [...prev, tree])
    void load(tree.uri, docId).then(() => toast({ title: '进入文件夹', detail: name, tone: 'neutral' }))
  }

  const back = () => {
    const prev = stack[stack.length - 1]
    if (!prev) return
    setStack((s) => s.slice(0, -1))
    setTree(prev)
  }

  const openFile = async (file: { name: string; docId: string; mime: string }) => {
    if (!tree) return
    if (!isTextMime(file.mime, file.name)) {
      toast({ title: '暂不支持预览', detail: file.name, tone: 'warn' })
      return
    }
    const doc = await readDoc(tree.uri, file.docId)
    if (!doc) {
      toast({ title: '读取失败', detail: file.name, tone: 'danger' })
      return
    }
    setPreview({ name: file.name, text: doc.text, truncated: doc.truncated })
  }

  const files = tree
    ? [...tree.files].filter((f) => f.name !== '.git').sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
    : []
  const folderCount = files.filter((f) => f.dir).length

  return (
    <>
      <div className="h-full overflow-y-auto px-4 py-3">
        {tree ? (
          <section className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--accent)]">
                <FolderOpen size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-[var(--fg)]">{tree.name || '项目文件夹'}</span>
                <span className="block text-[11px] text-[var(--faint)]">
                  {folderCount} 个文件夹 · {files.length - folderCount} 个文件{busy ? ' · 读取中…' : ''}
                </span>
              </span>
              <IconButton label="刷新目录" size="sm" onClick={() => void refresh()}>
                <RefreshCw size={14} />
              </IconButton>
              <Button size="sm" variant="ghost" onClick={() => void choose()}>
                更换
              </Button>
            </div>
            {stack.length > 0 && (
              <button onClick={back} className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11.5px] text-[var(--muted)]">
                <ChevronLeft size={12} /> 返回上一级
              </button>
            )}
          </section>
        ) : (
          <section className="rounded-[18px] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-4 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-[14px] bg-[var(--surface-2)] text-[var(--accent)]">
              <FolderOpen size={20} />
            </span>
            <p className="mt-2 text-[13.5px] text-[var(--fg)]">把项目接到真实文件夹</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--faint)]">
              选择手机上的任意目录，列真实文件、看大小与修改时间、预览文本；只读，不会改动文件。
            </p>
            <Button size="sm" variant="primary" className="mt-2.5" icon={<FolderOpen size={14} />} onClick={() => void choose()} disabled={!nativeFolderAvailable()}>
              选择文件夹
            </Button>
            {!nativeFolderAvailable() && <p className="mt-1.5 text-[11px] text-[var(--faint)]">目录选择仅在 APK 里可用</p>}
          </section>
        )}

        {git && stack.length === 0 && (
          <section className="mt-2 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="shrink-0 text-[var(--accent)]" />
              <span className="truncate font-mono text-[12px] text-[var(--fg)]">{git.branch ?? 'detached HEAD'}</span>
              {git.sha && <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">{git.sha}</span>}
              {git.remote && <span className="ml-auto truncate text-[10.5px] text-[var(--faint)]">{shortRemote(git.remote)}</span>}
            </div>
            {gitStatus && (
              <p className="mt-1 text-[11px] text-[var(--faint)]">
                已跟踪 {gitStatus.tracked} 个文件
                {gitStatus.status.modified > 0 && <span className="text-[var(--warn)]"> · {gitStatus.status.modified} 个修改</span>}
                {gitStatus.status.deleted > 0 && <span className="text-[var(--danger)]"> · {gitStatus.status.deleted} 个删除</span>}
                {gitStatus.status.untracked > 0 && <span className="text-[var(--info)]"> · {gitStatus.status.untracked} 个未跟踪</span>}
                {gitStatus.status.scannedDirs < gitStatus.status.totalDirs && `（扫描 ${gitStatus.status.scannedDirs}/${gitStatus.status.totalDirs} 个目录）`}
                {gitStatus.status.modified === 0 && gitStatus.status.deleted === 0 && gitStatus.status.untracked === 0 && ' · 工作区干净'}
              </p>
            )}
            {git.commits.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {git.commits.slice(0, 3).map((c) => (
                  <div key={c.sha} className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[11px] text-[var(--accent)]">{c.sha}</span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--fg)]">{c.message}</span>
                    <span className="shrink-0 text-[10.5px] text-[var(--faint)]">
                      {c.time ? new Date(c.time).toLocaleDateString('zh-CN') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {hint && <p className="mt-2 px-1 text-[11.5px] text-[var(--danger)]">{hint}</p>}

        {tree && (
          <label className="mt-2 flex h-10 items-center gap-2 rounded-[14px] bg-[var(--surface-2)] px-3">
            <Search size={14} className="shrink-0 text-[var(--faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索目录内文本（输入 2 个字以上）"
              className="w-full bg-transparent text-[13px] text-[var(--fg)] placeholder:text-[var(--faint)] focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="清空搜索" className="shrink-0 text-[var(--faint)]">
                <X size={14} />
              </button>
            )}
          </label>
        )}

        {tree && query.trim().length >= 2 && (
          <div className="mt-2 space-y-1.5">
            {searching && <p className="px-1 py-3 text-center text-[11.5px] text-[var(--faint)]">搜索中…</p>}
            {!searching && result && result.hits.length === 0 && (
              <p className="px-1 py-4 text-center text-[12px] text-[var(--faint)]">没有匹配（已扫描 {result.scanned} 个文件）</p>
            )}
            {result?.hits.map((h) => (
              <button
                key={`${h.path}:${h.line}`}
                onClick={() => void openHit({ name: h.path, docId: h.docId })}
                className="block w-full rounded-[12px] bg-[var(--surface-2)] px-3 py-2 text-left"
              >
                <p className="truncate font-mono text-[11px] text-[var(--accent)]">
                  {h.path}:{h.line}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11.5px] text-[var(--muted)]">{h.text}</p>
              </button>
            ))}
            {result?.truncated && !searching && (
              <p className="px-1 text-[11px] text-[var(--faint)]">已扫描 {result.scanned} 个文件，结果到达上限；缩小关键字更准</p>
            )}
          </div>
        )}

        {tree && query.trim().length < 2 && (
          <div className="mt-2 space-y-1.5">
            {files.length === 0 && <p className="px-1 py-6 text-center text-[12px] text-[var(--faint)]">这个目录是空的</p>}
            {files.map((f) => (
              <button
                key={f.docId}
                onClick={() => (f.dir ? enter(f.docId, f.name) : void openFile(f))}
                className="flex w-full items-center gap-2.5 rounded-[14px] bg-[var(--surface-2)] px-3 py-2.5 text-left"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface)] text-[var(--muted)]">
                  {f.dir ? <FolderOpen size={15} /> : <FileText size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12.5px] text-[var(--fg)]">{f.name}</span>
                  <span className="block text-[10.5px] text-[var(--faint)]">
                    {f.dir ? '文件夹' : formatBytes(f.size)}
                    {f.lastModified ? ` · ${new Date(f.lastModified).toLocaleDateString('zh-CN')}` : ''}
                  </span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-[var(--faint)]" />
              </button>
            ))}
          </div>
        )}

        {tree && <p className="caption mt-3 px-1">只读访问；写入、重命名与终端仍只在平板/桌面版的真实工作区里开放。</p>}
      </div>

      <BottomSheet open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name} height="max-h-[84%]">
        {preview && (
          <div className="px-4 py-3">
            <pre className="wrap-any whitespace-pre-wrap rounded-[14px] bg-[var(--surface-2)] p-3 font-mono text-[11.5px] leading-relaxed text-[var(--fg)]">
              {preview.text}
            </pre>
            {preview.truncated && <p className="mt-2 text-[11px] text-[var(--warn)]">文件较大，只显示前 256 KB</p>}
          </div>
        )}
      </BottomSheet>
    </>
  )
}