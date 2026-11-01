import { useState } from 'react'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  History,
  MessagesSquare,
  Plus,
  Plug,
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
import { connectors, skills, usage } from '../../data/work'
import { modelLabel } from '../../lib/labels'
import { deviceInfo, ramGb } from '../../lib/native-device'
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
  const { activeSession, newSession, theme, setTheme, approvals, tasks, task, selectTask, approval, models, modelId, pauseTask, resumeTask, cancelTask, toast } = useNexus()
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
              {connectors.slice(0, 6).map((c) => (
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
                <span className="text-[13.5px] text-[var(--fg)]">用量 · {usage.period}</span>
                <Badge tone="neutral">{usage.requests} 次</Badge>
              </div>
              <p className="mt-1 num text-[11.5px] text-[var(--faint)]">
                ${usage.costUsd.toFixed(2)} · 成功率 {usage.successRate}% · 平均 {usage.avgLatencyMs}ms
              </p>
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

const PROJECTS = [
  {
    name: 'nexus-core',
    lang: 'Kotlin',
    branch: 'agent/harness-checkpoint',
    dirty: 4,
    changes: [
      { file: 'core/agent/harness/CheckpointStore.kt', add: 62, del: 9 },
      { file: 'core/agent/harness/AgentLoop.kt', add: 18, del: 4 },
      { file: 'core/agent/harness/CheckpointStoreTest.kt', add: 41, del: 0 },
      { file: 'gradle/libs.versions.toml', add: 2, del: 1 },
    ],
    commits: [
      { sha: 'a1b2c3d', msg: 'feat(agent): 检查点幂等写入', time: '今天 14:02' },
      { sha: '9f8e7d6', msg: 'fix(agent): 事件去重表', time: '昨天 18:40' },
      { sha: '5c4b3a2', msg: 'chore: 升级 kotlin 2.1', time: '昨天 09:12' },
    ],
  },
  {
    name: 'orbit-api',
    lang: 'TypeScript',
    branch: 'main',
    dirty: 0,
    changes: [],
    commits: [
      { sha: 'b7c8d9e', msg: 'feat: 卫星坐标框架', time: '今天 11:20' },
      { sha: 'e1f2a3b', msg: 'test: 开普勒边界用例', time: '昨天 16:55' },
    ],
  },
  {
    name: 'field-notes',
    lang: 'Markdown',
    branch: 'main',
    dirty: 0,
    changes: [],
    commits: [{ sha: 'c3d4e5f', msg: 'docs: 周会记录与决策', time: '昨天 21:05' }],
  },
]

function PhoneProjects() {
  const { toast } = useNexus()
  const [openName, setOpenName] = useState<string | null>(null)
  const project = PROJECTS.find((p) => p.name === openName) ?? null

  return (
    <>
      <div className="h-full overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          {PROJECTS.map((p) => (
            <button
              key={p.name}
              onClick={() => setOpenName(p.name)}
              className="flex w-full items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-left"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] font-mono text-[11px] text-[var(--accent)]">
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-[var(--fg)]">{p.name}</span>
                <span className="block truncate text-[11px] text-[var(--faint)]">
                  {p.lang} · {p.branch} · {p.dirty ? `${p.dirty} 个未提交变更` : '干净'}
                </span>
              </span>
              <ChevronRight size={15} className="text-[var(--faint)]" />
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[12px] text-[var(--fg)]">最近编辑</p>
          <p className="mt-1 font-mono text-[11.5px] text-[var(--faint)]">core/agent/harness/AgentLoop.kt</p>
          <p className="text-[11px] text-[var(--faint)]">分支 agent/harness-checkpoint · 检查点 ckpt_0007</p>
        </div>
        <p className="caption mt-3 px-1">手机不堆叠项目树、终端与多面板；复杂操作在平板 Pro 模式完成。</p>
      </div>

      <BottomSheet open={Boolean(project)} onClose={() => setOpenName(null)} title={project?.name} height="max-h-[82%]">
        {project && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{project.lang}</Badge>
              <span className="truncate font-mono text-[11.5px] text-[var(--muted)]">{project.branch}</span>
              <StatusPill
                label={project.dirty ? `${project.dirty} 个变更` : '工作区干净'}
                tone={project.dirty ? 'warn' : 'ok'}
                className="ml-auto"
              />
            </div>

            <p className="label mt-4">未提交变更</p>
            {project.changes.length ? (
              <div className="mt-1.5 space-y-1">
                {project.changes.map((c) => (
                  <div key={c.file} className="flex items-center gap-2 rounded-[10px] bg-[var(--surface-2)] px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[var(--fg)]">{c.file}</span>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--ok)]">+{c.add}</span>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--danger)]">−{c.del}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[12px] text-[var(--faint)]">工作区干净，没有待提交的改动。</p>
            )}

            <p className="label mt-4">最近提交</p>
            <div className="mt-1.5 space-y-1.5">
              {project.commits.map((c) => (
                <div key={c.sha} className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[11px] text-[var(--accent)]">{c.sha}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--fg)]">{c.msg}</span>
                  <span className="shrink-0 text-[10.5px] text-[var(--faint)]">{c.time}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => toast({ title: '已在平板打开', detail: `${project.name} · Pro 模式`, tone: 'ok' })}
              >
                在平板打开
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => toast({ title: '路径已复制', detail: `~/projects/${project.name}`, tone: 'neutral' })}
              >
                复制路径
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">项目、变更与提交为演示数据；真实编辑与终端在平板/桌面版完成。</p>
          </div>
        )}
      </BottomSheet>
    </>
  )
}