import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  FileCode2,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
  SquareTerminal,
  FolderOpen as OpenFolder,
  X,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button, IconButton, StatusPill } from '../ui/primitives'
import { basename, isProbablyText, rememberWorkspaceRoot, savedWorkspaceRoot, workspaceBridge, type WorkspaceEntry } from '../../lib/workspace'

type TermLine = { kind: 'cmd' | 'out' | 'err' | 'meta'; text: string }

const QUICK = ['git status', 'git log --oneline -5', 'ls', 'pnpm test']

export function RealWorkspace() {
  const bridge = workspaceBridge()
  const [root, setRoot] = useState<string | null>(() => savedWorkspaceRoot())
  const [entries, setEntries] = useState<WorkspaceEntry[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [activePath, setActivePath] = useState<string | null>(null)
  const [saved, setSaved] = useState('')
  const [content, setContent] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lineCount, setLineCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [lines, setLines] = useState<TermLine[]>([
    { kind: 'meta', text: '本机工作区终端 · 命令在你打开的文件夹内执行' },
  ])
  const [command, setCommand] = useState('')
  const [running, setRunning] = useState(false)
  const termRef = useRef<HTMLDivElement>(null)

  const dirty = activePath !== null && content !== saved

  const list = useCallback(
    async (target: string) => {
      if (!bridge) return
      setLoading(true)
      try {
        const res = await bridge.list(target)
        setEntries(res.entries)
        setCollapsed(new Set(res.entries.filter((e) => e.dir).map((e) => e.path)))
        setTruncated(res.truncated)
        setRoot(res.root)
        rememberWorkspaceRoot(res.root)
      } catch (err) {
        setNotice(`读取目录失败：${(err as Error).message}`)
      } finally {
        setLoading(false)
      }
    },
    [bridge],
  )

  useEffect(() => {
    if (root) void list(root)
    // 只在首次挂载时恢复上次工作区
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = termRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const pickFolder = async () => {
    if (!bridge) return
    const res = await bridge.open()
    if (res?.root) {
      setActivePath(null)
      setContent('')
      setSaved('')
      setNotice(null)
      await list(res.root)
    }
  }

  const openFile = async (entry: WorkspaceEntry) => {
    if (!bridge || !root) return
    if (entry.dir) {
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(entry.path)) next.delete(entry.path)
        else next.add(entry.path)
        return next
      })
      return
    }
    if (!isProbablyText(entry.path)) {
      setActivePath(entry.path)
      setContent('')
      setSaved('')
      setNotice('这是二进制文件，编辑器不会尝试解码。')
      return
    }
    setLoading(true)
    try {
      const file = await bridge.read(root, entry.path)
      setActivePath(entry.path)
      setNotice(file.tooLarge ? '文件超过 2MB，暂不在编辑器中打开。' : file.binary ? '检测到二进制内容，已跳过显示。' : null)
      setContent(file.tooLarge || file.binary ? '' : file.content)
      setSaved(file.tooLarge || file.binary ? '' : file.content)
      setLineCount(file.tooLarge || file.binary ? 0 : file.content.split('\n').length)
    } catch (err) {
      setNotice(`打开失败：${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!bridge || !root || !activePath || !dirty) return
    setSaving(true)
    try {
      await bridge.write(root, activePath, content)
      setSaved(content)
      setNotice(null)
      setLines((prev) => [...prev, { kind: 'meta', text: `已保存 ${activePath} · ${new Date().toLocaleTimeString('zh-CN')}` }])
    } catch (err) {
      setNotice(`保存失败：${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const run = async (cmd: string) => {
    if (!bridge || !root || !cmd.trim() || running) return
    setRunning(true)
    setLines((prev) => [...prev, { kind: 'cmd', text: cmd }])
    setCommand('')
    const res = await bridge.exec(root, cmd)
    const out: TermLine[] = []
    if (res.stdout.trim()) out.push({ kind: 'out', text: res.stdout.trimEnd() })
    if (res.stderr.trim()) out.push({ kind: 'err', text: res.stderr.trimEnd() })
    out.push({ kind: 'meta', text: `退出码 ${res.code} · ${res.durationMs}ms` })
    setLines((prev) => [...prev, ...out])
    setRunning(false)
  }

  const visible = useMemo(() => {
    const result: WorkspaceEntry[] = []
    let skipDeeperThan = Infinity
    for (const e of entries) {
      if (e.depth > skipDeeperThan) continue
      skipDeeperThan = Infinity
      result.push(e)
      if (e.dir && collapsed.has(e.path)) skipDeeperThan = e.depth
    }
    return result
  }, [entries, collapsed])

  if (!bridge) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div className="max-w-[420px]">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--faint)]">
            <Folder size={20} />
          </div>
          <p className="mt-3 text-[14px] text-[var(--fg)]">真实文件工作区仅在桌面版可用</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">浏览器无法读写本机文件夹。请用桌面版打开项目目录，即可浏览文件、编辑并保存、运行命令。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      {/* 文件树 */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] md:flex">
        <div className="flex h-12 shrink-0 items-center gap-1.5 px-3">
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--fg)]" title={root ?? ''}>
            {root ? basename(root) : '未打开文件夹'}
          </span>
          <IconButton label="重新读取目录" size="sm" onClick={() => root && list(root)} disabled={!root || loading}>
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {!root && (
            <div className="px-3 py-4">
              <Button size="sm" variant="secondary" block icon={<OpenFolder size={14} />} onClick={pickFolder}>
                打开文件夹
              </Button>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">只读取你选择的目录；`node_modules`、`.git` 等目录会自动跳过。</p>
            </div>
          )}
          {visible.map((e) => {
            const isOpen = e.dir && !collapsed.has(e.path)
            const active = e.path === activePath
            return (
              <button
                key={e.path}
                title={e.path}
                data-path={e.path}
                onClick={() => openFile(e)}
                style={{ paddingLeft: 10 + e.depth * 12 }}
                className={cn(
                  'flex h-[28px] w-full items-center gap-1.5 pr-3 text-left text-[12px] transition-colors',
                  active ? 'bg-[var(--surface-2)] text-[var(--fg)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
                )}
              >
                {e.dir ? (
                  <>
                    {isOpen ? <ChevronDown size={12} className="shrink-0 text-[var(--faint)]" /> : <ChevronRight size={12} className="shrink-0 text-[var(--faint)]" />}
                    {isOpen ? <FolderOpen size={13} className="shrink-0 text-[var(--accent)]/80" /> : <Folder size={13} className="shrink-0 text-[var(--faint)]" />}
                  </>
                ) : (
                  <>
                    <span className="w-3 shrink-0" />
                    <FileCode2 size={13} className="shrink-0 text-[var(--faint)]" />
                  </>
                )}
                <span className="truncate">{e.name}</span>
              </button>
            )
          })}
          {truncated && <p className="px-3 py-2 text-[10.5px] text-[var(--faint)]">目录较大，仅显示前 600 项。</p>}
        </div>
        <div className="shrink-0 border-t border-[var(--line)] px-3 py-2">
          <Button size="sm" variant="ghost" block icon={<OpenFolder size={14} />} onClick={pickFolder}>
            {root ? '切换文件夹' : '打开文件夹'}
          </Button>
        </div>
      </aside>

      {/* 编辑器 + 终端 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4">
          <span className="min-w-0 truncate text-[13px] text-[var(--fg)]">{activePath ? basename(activePath) : '选择左侧文件开始编辑'}</span>
          {activePath && <span className="hidden truncate font-mono text-[11px] text-[var(--faint)] sm:inline">{activePath}</span>}
          {dirty && <StatusPill label="未保存" tone="warn" />}
          {activePath && lineCount > 0 && <span className="num hidden text-[11px] text-[var(--faint)] sm:inline">{lineCount} 行</span>}
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant={dirty ? 'primary' : 'ghost'} icon={<Save size={13} />} onClick={save} disabled={!dirty || saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>

        {notice && (
          <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--warn-soft)] px-4 py-1.5 text-[11.5px] text-[var(--warn)]">
            <span className="min-w-0 flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="关闭提示" className="text-[var(--warn)]">
              <X size={13} />
            </button>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-[color-mix(in_oklab,var(--bg)_82%,var(--surface))]">
          {activePath ? (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setLineCount(e.target.value.split('\n').length)
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                  e.preventDefault()
                  void save()
                }
              }}
              spellCheck={false}
              aria-label="文件编辑器"
              className="block h-full min-h-full w-full resize-none bg-transparent p-4 font-mono text-[12.5px] leading-[1.7] text-[var(--fg)] outline-none"
              style={{ tabSize: 2 }}
            />
          ) : (
            <div className="grid h-full place-items-center px-6">
              <div className="text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-xl bg-[var(--surface)] text-[var(--faint)]">
                  <FileCode2 size={20} />
                </div>
                <p className="mt-3 text-[13px] text-[var(--muted)]">{root ? '从左侧选择文件' : '打开一个文件夹开始'}</p>
                {!root && (
                  <Button size="sm" variant="secondary" className="mt-3" icon={<OpenFolder size={14} />} onClick={pickFolder}>
                    选择项目文件夹
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex h-[190px] shrink-0 flex-col border-t border-[var(--line)] bg-[var(--surface)]">
          <div className="flex h-9 shrink-0 items-center gap-2 px-3">
            <SquareTerminal size={13} className="text-[var(--muted)]" />
            <span className="text-[12px] text-[var(--fg)]">终端</span>
            <span className="font-mono text-[10.5px] text-[var(--faint)]">{root ?? '未选择目录'}</span>
            <div className="ml-auto flex gap-1">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => void run(q)}
                  disabled={!root || running}
                  className="rounded border border-[var(--line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--faint)] transition-colors hover:text-[var(--fg)] disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div ref={termRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-1 font-mono text-[11.5px] leading-[1.7]">
            {lines.map((l, i) => (
              <div key={i} className={cn('whitespace-pre-wrap break-words', l.kind === 'cmd' && 'text-[var(--accent)]', l.kind === 'out' && 'text-[var(--muted)]', l.kind === 'err' && 'text-[var(--danger)]', l.kind === 'meta' && 'text-[var(--faint)]')}>
                {l.kind === 'cmd' ? `$ ${l.text}` : l.text}
              </div>
            ))}
            {running && <div className="text-[var(--faint)]">执行中…</div>}
          </div>
          <div className="flex h-9 shrink-0 items-center gap-2 border-t border-[var(--line)] px-3">
            <span className="font-mono text-[11px] text-[var(--faint)]">$</span>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void run(command)
                }
              }}
              disabled={!root || running}
              placeholder={root ? '输入命令，Enter 执行' : '先打开文件夹'}
              aria-label="终端命令"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-[var(--fg)] placeholder:text-[var(--faint)] focus:outline-none"
            />
            <CornerDownLeft size={12} className="text-[var(--faint)]" />
            {running && <Loader2 size={12} className="animate-spin text-[var(--faint)]" />}
          </div>
        </div>
      </div>
    </div>
  )
}
