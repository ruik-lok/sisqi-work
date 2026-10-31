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
import { Badge, Button, IconButton, StatusPill, taskTone } from '../../components/ui/primitives'
import { BottomSheet, Menu, MenuItem } from '../../components/ui/overlays'
import { Wordmark } from '../../components/brand/Mark'
import { ChatErrorBanner, ChatThread, Composer, SessionList } from '../../components/chat/Chat'
import { TaskCard } from '../../components/panels/TaskCard'
import { THEME_OPTIONS, useNexus } from '../../state/store'
import { connectors, models, usage } from '../../data/work'
import { devices } from '../../data/nexus'
import { deviceStatusLabel, taskStatusLabel } from '../../lib/labels'

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
  const { activeSession, newSession, theme, setTheme, approvals, tasks, task, selectTask, approval } = useNexus()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [taskSheet, setTaskSheet] = useState(false)
  const pending = approvals.filter((a) => a.status === 'PENDING').length
  const phone = devices[0]

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[var(--bg)]">
      {/* 状态栏安全区域：背景延伸，内容避让；不使用假图标 */}
      <div className="h-[26px] shrink-0 bg-[var(--bg)]" aria-hidden="true" />

      <header className="flex h-12 shrink-0 items-center gap-2 bg-[var(--bg)] px-4">
        <Wordmark compact />
        <span className="truncate text-[15px] font-semibold text-[var(--fg)]">
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
          <IconButton label={`待批准 ${pending} 项`} size="sm" onClick={onOpenApproval} className="relative">
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
            <div className="space-y-2">
              {connectors.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
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
            <Button size="sm" variant="secondary" block className="mt-3" icon={<Wrench size={14} />}>
              管理技能与 MCP
            </Button>
          </div>
        )}

        {route === 'settings' && (
          <div className="h-full overflow-y-auto px-4 py-3">
            <section className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
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
                <span className="ml-auto font-mono text-[12px] text-[var(--fg)]">{models[0].name}</span>
              </div>
            </section>

            <section className="mt-2 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] text-[var(--fg)]">设备</span>
                <StatusPill label={deviceStatusLabel(phone.status)} tone="ok" className="ml-auto" />
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--faint)]">
                {phone.model ?? '待检测'} · API {phone.androidApi ?? '待检测'} · 默认 Lite
              </p>
              <p className="text-[11.5px] text-[var(--faint)]">Root Provider 待检测 · 与平板独立授权</p>
            </section>

            <section className="mt-2 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
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
      <div className="h-[16px] shrink-0 bg-[var(--surface)]" aria-hidden="true" />

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
                <span className="num w-9 shrink-0 text-[10.5px] text-[var(--faint)]">{e.timestamp}</span>
                <span className="min-w-0 flex-1 text-[11.5px] text-[var(--muted)]">{e.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--faint)]">完整时间线与 Diff 在平板 Pro 模式查看。</p>
        </div>
      </BottomSheet>
    </div>
  )
}

function PhoneProjects() {
  const { toast } = useNexus()
  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="space-y-2">
        {[
          { name: 'nexus-core', meta: 'Kotlin · main · 4 个未提交变更', active: true },
          { name: 'orbit-api', meta: 'TypeScript · main · 干净' },
          { name: 'field-notes', meta: 'Markdown · main · 干净' },
        ].map((p) => (
          <button
            key={p.name}
            onClick={() => toast({ title: `打开 ${p.name}`, detail: '手机端以查看与审批为主，编辑建议在平板', tone: 'neutral' })}
            className="flex w-full items-center gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] font-mono text-[11px] text-[var(--accent)]">
              {p.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] text-[var(--fg)]">{p.name}</span>
              <span className="block truncate text-[11px] text-[var(--faint)]">{p.meta}</span>
            </span>
            <ChevronRight size={15} className="text-[var(--faint)]" />
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
        <p className="text-[12px] text-[var(--fg)]">最近编辑</p>
        <p className="mt-1 font-mono text-[11.5px] text-[var(--faint)]">core/agent/harness/AgentLoop.kt</p>
        <p className="text-[11px] text-[var(--faint)]">分支 agent/harness-checkpoint · 检查点 ckpt_0007</p>
      </div>
      <p className="caption mt-3 px-1">手机不堆叠项目树、终端与多面板；复杂操作在平板 Pro 模式完成。</p>
    </div>
  )
}
