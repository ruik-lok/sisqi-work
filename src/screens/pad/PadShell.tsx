import type { ReactNode } from 'react'
import { Bell, Command, FolderKanban, MessagesSquare, Plug, Search, Settings2, Sparkles } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button, IconButton, Segmented, StatusPill } from '../../components/ui/primitives'
import { Menu, MenuItem } from '../../components/ui/overlays'
import { Wordmark } from '../../components/brand/Mark'
import { THEME_OPTIONS, useNexus, type Density } from '../../state/store'
import { devices } from '../../data/nexus'
import { deviceStatusLabel } from '../../lib/labels'
import { ChatScreen } from './ChatScreen'
import { ProjectsScreen } from './ProjectsScreen'
import { AgentScreen } from './AgentScreen'
import { ConnectorsScreen } from './ConnectorsScreen'
import { SettingsScreen } from './SettingsScreen'

export type PadRoute = 'chat' | 'projects' | 'agent' | 'connectors' | 'settings'

const NAV: Array<{ id: PadRoute; label: string; icon: ReactNode }> = [
  { id: 'chat', label: '会话', icon: <MessagesSquare size={18} /> },
  { id: 'projects', label: '项目', icon: <FolderKanban size={18} /> },
  { id: 'agent', label: 'Agent', icon: <Sparkles size={18} /> },
  { id: 'connectors', label: '连接', icon: <Plug size={18} /> },
  { id: 'settings', label: '设置', icon: <Settings2 size={18} /> },
]

const TITLES: Record<PadRoute, { title: string; sub: string }> = {
  chat: { title: '会话', sub: 'AI 会话工作台' },
  projects: { title: '项目', sub: 'nexus-core · agent/harness-checkpoint' },
  agent: { title: 'Agent', sub: '任务、时间线与审批' },
  connectors: { title: '连接', sub: 'Connector、Skill 与 MCP' },
  settings: { title: '设置', sub: '模型与 API、设备、安全' },
}

export function PadShell({
  route,
  setRoute,
  onOpenApproval,
}: {
  route: PadRoute
  setRoute: (r: PadRoute) => void
  onOpenApproval: () => void
}) {
  const { approvals, theme, setTheme, density, setDensity, newSession, setPaletteOpen } = useNexus()
  const pad = devices[1]
  const pending = approvals.filter((a) => a.status === 'PENDING').length

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)] text-[var(--fg)]">
      {/* sidebar */}
      <aside className="flex w-[228px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
        <div className="flex h-14 items-center px-4">
          <Wordmark />
        </div>

        <div className="px-3">
          <Button
            variant="primary"
            size="md"
            block
            icon={<MessagesSquare size={16} />}
            onClick={() => {
              newSession()
              setRoute('chat')
            }}
          >
            新建会话
          </Button>
        </div>

        <nav aria-label="主导航" className="mt-4 flex flex-col gap-0.5 px-2">
          {NAV.map((n) => {
            const active = route === n.id
            return (
              <button
                key={n.id}
                onClick={() => setRoute(n.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] transition-colors duration-150',
                  active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
                )}
              >
                {n.icon}
                <span className={cn(active && 'font-medium')}>{n.label}</span>
                {n.id === 'agent' && pending > 0 && <span className="ml-auto size-1.5 rounded-full bg-[var(--warn)]" />}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto space-y-3 px-3 pb-4">
          <div>
            <p className="label mb-1.5 px-1">界面模式</p>
            <Segmented<Density>
              label="Lite 或 Pro 界面"
              value={density}
              onChange={setDensity}
              className="w-full justify-between"
              options={[
                { value: 'lite', label: 'Lite' },
                { value: 'pro', label: 'Pro' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-[var(--line)] pt-3">
            <span className="grid size-8 place-items-center rounded-full bg-[var(--surface-2)] text-[11px] text-[var(--muted)]">AX</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] text-[var(--fg)]">AX</p>
              <p className="truncate text-[11px] text-[var(--faint)]">个人工作区</p>
            </div>
            <Menu
              label="主题"
              side="top"
              trigger={({ toggle, open }) => (
                <IconButton label="切换主题" onClick={toggle} active={open} size="sm">
                  <Settings2 size={15} />
                </IconButton>
              )}
            >
              {(close) => (
                <>
                  <p className="label px-2 py-1">外观</p>
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
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-[var(--fg)]">{TITLES[route].title}</h1>
            <p className="caption truncate">{TITLES[route].sub}</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 w-[260px] items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 text-left text-[13px] text-[var(--faint)] transition-colors hover:border-[var(--line-strong)] md:flex"
            >
              <Search size={14} />
              搜索会话、项目或命令
              <span className="ml-auto font-mono text-[11px]">⌘K</span>
            </button>
            <IconButton label={`待审批 ${pending} 项`} onClick={onOpenApproval} className="relative">
              <Bell size={17} />
              {pending > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--warn)]" />}
            </IconButton>
            <div className="ml-1 hidden items-center gap-1.5 rounded-[10px] border border-[var(--line)] px-2.5 py-1.5 sm:flex">
              <StatusPill label={deviceStatusLabel(pad.status)} tone="accent" />
              <span className="text-[12.5px] text-[var(--muted)]">Pad Pro</span>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          {route === 'chat' && <ChatScreen onOpenApproval={onOpenApproval} onOpenSettings={() => setRoute('settings')} />}
          {route === 'projects' && <ProjectsScreen />}
          {route === 'agent' && <AgentScreen onOpenApproval={onOpenApproval} />}
          {route === 'connectors' && <ConnectorsScreen />}
          {route === 'settings' && <SettingsScreen onOpenApproval={onOpenApproval} />}
        </main>

        <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-[var(--line)] bg-[var(--surface)] px-5 text-[11px] text-[var(--faint)]">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--ok)]" />
            Pad 在线
          </span>
          <span className="hidden sm:inline">Edge-to-Edge · 安全区域已应用</span>
          <span className="hidden md:inline">ColorOS 14 · Android 14</span>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <Command size={10} /> Pro 模式 · 多面板
          </span>
        </footer>
      </div>
    </div>
  )
}
