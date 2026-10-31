import { useState } from 'react'
import { ChevronDown, GitBranch, Play, Terminal as TerminalIcon, Upload } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, IconButton, StatusPill } from '../../components/ui/primitives'
import { Dialog } from '../../components/ui/overlays'
import { Explorer } from '../../components/panels/Explorer'
import { CodeEditor } from '../../components/panels/CodeEditor'
import { Terminal } from '../../components/panels/Terminal'
import { DiffView } from '../../components/panels/DiffView'
import { useNexus } from '../../state/store'
import { RealWorkspace } from '../../components/workspace/RealWorkspace'
import { workspaceBridge, savedWorkspaceRoot, rememberWorkspaceRoot } from '../../lib/workspace'
import { diffFiles } from '../../data/nexus'

type DockTab = 'terminal' | 'changes'

export function ProjectsScreen() {
  const { task, toast } = useNexus()
  const [live, setLive] = useState(() => Boolean(workspaceBridge() && savedWorkspaceRoot()))
  const [opening, setOpening] = useState(false)
  const [openPaths, setOpenPaths] = useState(['core/agent/harness/AgentLoop.kt', 'core/terminal/PtySession.kt'])
  const [activePath, setActivePath] = useState('core/agent/harness/AgentLoop.kt')
  const [dock, setDock] = useState<DockTab>('terminal')
  const [dockOpen, setDockOpen] = useState(true)
  const [diffOpen, setDiffOpen] = useState(false)
  const [message, setMessage] = useState('feat(harness): 检查点幂等恢复')

  const open = (p: string) => {
    setOpenPaths((prev) => (prev.includes(p) ? prev : [...prev, p]))
    setActivePath(p)
  }
  const close = (p: string) => {
    setOpenPaths((prev) => {
      const next = prev.filter((x) => x !== p)
      if (!next.length) return prev
      if (p === activePath) setActivePath(next[next.length - 1])
      return next
    })
  }

  const openFolder = async () => {
    const bridge = workspaceBridge()
    if (!bridge) return
    setOpening(true)
    try {
      const res = await bridge.open()
      if (res?.root) {
        rememberWorkspaceRoot(res.root)
        setLive(true)
      }
    } finally {
      setOpening(false)
    }
  }

  if (live) return <RealWorkspace />

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      <aside className="hidden w-[240px] shrink-0 border-r border-[var(--line)] bg-[var(--surface)] md:block">
        <Explorer activePath={activePath} onOpen={open} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4">
          <GitBranch size={14} className="text-[var(--muted)]" />
          <button className="inline-flex items-center gap-1 text-[13px] text-[var(--fg)]">
            agent/harness-checkpoint <ChevronDown size={12} className="text-[var(--faint)]" />
          </button>
          <Badge tone="neutral">相对 main · 4 个文件</Badge>
          {workspaceBridge() && (
            <Button size="sm" variant="secondary" className="ml-2" onClick={openFolder} disabled={opening}>
              {opening ? '选择中…' : '打开本机文件夹'}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" icon={<Play size={13} />} onClick={() => toast({ title: '运行配置已启动', detail: '输出见终端', tone: 'accent' })}>
              运行
            </Button>
            <Button
              size="sm"
              variant={dockOpen ? 'quiet' : 'secondary'}
              icon={<TerminalIcon size={13} />}
              onClick={() => {
                setDock('terminal')
                setDockOpen((v) => !v)
              }}
            >
              终端
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <CodeEditor openPaths={openPaths} activePath={activePath} onSelect={setActivePath} onClose={close} onReviewDiff={() => setDiffOpen(true)} />
        </div>

        <div className={cn('flex shrink-0 flex-col border-t border-[var(--line)] bg-[var(--surface)] transition-[height] duration-200', dockOpen ? 'h-[190px]' : 'h-10')}>
          <div className="flex h-10 shrink-0 items-center gap-4 px-4">
            {(
              [
                ['terminal', '终端'],
                ['changes', `变更 ${diffFiles.length}`],
              ] as Array<[DockTab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setDock(id)
                  setDockOpen(true)
                }}
                className={cn('text-[13px] transition-colors', dock === id ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]')}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto font-mono text-[11px] text-[var(--faint)]">pty_04 · sh</span>
            <IconButton label={dockOpen ? '收起面板' : '展开面板'} size="sm" onClick={() => setDockOpen((v) => !v)}>
              <ChevronDown size={14} className={cn('transition-transform', dockOpen && 'rotate-180')} />
            </IconButton>
          </div>
          {dockOpen && (
            <div className="min-h-0 flex-1 border-t border-[var(--line)]">
              {dock === 'terminal' && <Terminal embedded />}
              {dock === 'changes' && (
                <div className="h-full overflow-y-auto p-3">
                  {diffFiles.map((f) => (
                    <div key={f.path} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]">
                      <span className="font-mono text-[12px] text-[var(--fg)]">{f.path}</span>
                      <span className="ml-auto font-mono text-[11px] text-[var(--ok)]">+{f.additions}</span>
                      <span className="font-mono text-[11px] text-[var(--danger)]">−{f.deletions}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface)] lg:flex">
        <div className="flex h-12 items-center px-4">
          <span className="text-[15px] font-semibold text-[var(--fg)]">提交</span>
          <span className="caption ml-auto">工作区</span>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <section>
            <p className="label">变更文件</p>
            <div className="mt-1.5 space-y-1">
              {diffFiles.map((f) => (
                <button key={f.path} onClick={() => setDiffOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface-2)]">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[var(--fg)]">{f.path.split('/').at(-1)}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-[var(--faint)]">+{f.additions} −{f.deletions}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="label">提交信息</p>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-label="提交信息"
              className="mt-1.5 h-9 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[12.5px] focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="primary" block icon={<Upload size={13} />} onClick={() => toast({ title: '已提交到分支', detail: 'agent/harness-checkpoint · 未推送', tone: 'ok' })}>
                提交
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDiffOpen(true)}>
                审查
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--faint)]">提交前会检查工作区并保留可恢复基线；不会覆盖未提交改动。</p>
          </section>

          <section>
            <p className="label">工作区</p>
            <div className="mt-1.5 space-y-1 text-[11.5px] text-[var(--muted)]">
              <p className="font-mono">~/projects/nexus-core</p>
              <p>运行时：云端 Sandbox · sbx-eu-03</p>
              <p>目标：{task.target} · 检查点 {task.checkpoint}</p>
            </div>
          </section>

          <section>
            <p className="label">工作区状态</p>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusPill label="同步正常" tone="ok" />
              <span className="text-[11px] text-[var(--faint)]">最后同步 2 分钟前</span>
            </div>
          </section>
        </div>
      </aside>

      <Dialog open={diffOpen} onClose={() => setDiffOpen(false)} title={`变更审查 · ${task.id}`} description="逐文件接受或驳回；合并结果写入审计。" width="max-w-[860px]">
        <DiffView onDone={() => setDiffOpen(false)} />
      </Dialog>
    </div>
  )
}
