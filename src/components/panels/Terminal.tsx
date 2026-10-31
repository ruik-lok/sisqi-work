import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Maximize2, Minimize2, Plus, RotateCw, SquareTerminal, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui/primitives'
import { codeFiles, initialTerminal } from '../../data/nexus'

type Line = { kind: 'cmd' | 'out' | 'ok' | 'warn' | 'err' | 'sys'; text: string }

const PROMPT = 'pad@nexus ~/nexus-core'

const HELP: Line[] = [
  { kind: 'sys', text: 'NEXUS PTY shell (mock) — 支持: help ls cd pwd cat git status git diff clear nexus status whoami ./gradlew pnpm' },
]

const runCommand = (raw: string): Line[] => {
  const [cmd, ...args] = raw.trim().split(/\s+/)
  switch (cmd) {
    case 'help':
      return HELP
    case 'ls':
      return [
        { kind: 'out', text: 'app/        core/      feature/   gradle/' },
        { kind: 'out', text: 'README.md   settings.gradle.kts' },
      ]
    case 'pwd':
      return [{ kind: 'out', text: '/data/data/dev.nexus/files/home/nexus-core' }]
    case 'whoami':
      return [{ kind: 'out', text: 'u0_a412 (app uid 10412) · selinux=permissive(unknown)' }]
    case 'cd':
      return [{ kind: 'out', text: `cwd → ${args[0] ?? '~'}` }]
    case 'cat': {
      const f = codeFiles.find((c) => c.path.endsWith(args[0] ?? ''))
      if (!f) return [{ kind: 'err', text: `cat: ${args[0] ?? ''}: No such file or directory` }]
      return f.code.split('\n').slice(0, 14).map((text) => ({ kind: 'out' as const, text }))
    }
    case 'git':
      if (args[0] === 'status')
        return [
          { kind: 'out', text: 'On branch agent/harness-checkpoint' },
          { kind: 'out', text: 'Changes not staged for commit:' },
          { kind: 'warn', text: '  modified: core/agent/harness/AgentLoop.kt' },
          { kind: 'warn', text: '  modified: core/terminal/PtySession.kt' },
          { kind: 'out', text: 'Changes to be committed:' },
          { kind: 'ok', text: '  new file: core/terminal/PtySessionTest.kt' },
        ]
      if (args[0] === 'diff')
        return [
          { kind: 'out', text: ' core/terminal/PtySession.kt | 24 ++++++++++++++-------' },
          { kind: 'out', text: ' 1 file changed, 18 insertions(+), 6 deletions(-)' },
        ]
      return [{ kind: 'out', text: 'usage: git status | git diff' }]
    case './gradlew':
      return [
        { kind: 'out', text: '> Task :core:agent:compileDebugKotlin UP-TO-DATE' },
        { kind: 'ok', text: 'BUILD SUCCESSFUL in 41s · 34 tests passed' },
      ]
    case 'pnpm':
      return [
        { kind: 'out', text: 'orbit-api: typecheck ✓ lint ✓ 112 tests passed' },
        { kind: 'ok', text: '1m12s · 0 vulnerabilities' },
      ]
    case 'nexus':
      return [
        { kind: 'out', text: 'runtime   native(bionic) · pty pty_04 · sessions 2' },
        { kind: 'out', text: 'device    pad · api unknown · coloros 14 · ram 8192/2740MB' },
        { kind: 'out', text: 'task      T-2481 TESTING · ckpt_0007 · budget 61%' },
        { kind: 'warn', text: 'note      API level 未采集，命令输出不推断设备能力' },
      ]
    case 'clear':
      return []
    default:
      return [{ kind: 'err', text: `${cmd}: command not found (mock shell)` }]
  }
}

export function Terminal({
  expanded,
  onToggleExpand,
  embedded = false,
}: {
  expanded?: boolean
  onToggleExpand?: () => void
  embedded?: boolean
}) {
  const [lines, setLines] = useState<Line[]>(() => [
    { kind: 'sys', text: '# NEXUS terminal · session pty_04 · cwd ~/nexus-core' },
    { kind: 'sys', text: '# runtime=native(bionic) · shell=/system/bin/sh · 输入 help 查看可用命令' },
    ...initialTerminal,
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useRef<string[]>([])
  const histIdx = useRef(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines, busy])

  const prompt = useMemo(() => PROMPT, [])

  const exec = () => {
    const raw = input.trim()
    if (!raw || busy) return
    history.current.push(raw)
    histIdx.current = -1
    setInput('')
    if (raw === 'clear') {
      setLines([{ kind: 'sys', text: '# 会话已清空 · 历史仍持久化' }])
      return
    }
    setLines((prev) => [...prev, { kind: 'cmd', text: raw }])
    setBusy(true)
    window.setTimeout(() => {
      setLines((prev) => [...prev, ...runCommand(raw)])
      setBusy(false)
    }, 380)
  }

  const keyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      exec()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(histIdx.current + 1, history.current.length - 1)
      if (next >= 0 && history.current.length > 0) {
        histIdx.current = next
        setInput(history.current[history.current.length - 1 - next] ?? '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = histIdx.current - 1
      histIdx.current = next
      setInput(next >= 0 ? (history.current[history.current.length - 1 - next] ?? '') : '')
    } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      setLines([{ kind: 'sys', text: '# 会话已清空' }])
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col bg-[color-mix(in_oklab,var(--bg)_86%,var(--surface))]', embedded ? 'h-full' : 'h-full')}>
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-2">
        <div className="flex items-center gap-1 rounded border border-line bg-surface-2 px-2 py-1">
          <SquareTerminal size={12} className="text-accent" />
          <span className="font-mono text-2xs text-fg">pty_04</span>
          <span className="font-mono text-2xs text-faint">sh</span>
          <X size={11} className="ml-1 text-faint" aria-hidden="true" />
        </div>
        <button className="grid size-6 place-items-center rounded text-faint transition-colors hover:bg-surface-3 hover:text-fg" aria-label="新建终端会话">
          <Plus size={12} />
        </button>
        <span className="ml-2 hidden items-center gap-1 font-mono text-2xs text-faint sm:flex">
          <ChevronRight size={11} />
          ~/nexus-core
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="重新运行上一条命令" size="sm" onClick={() => setInput(history.current.at(-1) ?? './gradlew :core:agent:test')}>
            <RotateCw size={12} />
          </IconButton>
          <IconButton label="清空会话" size="sm" onClick={() => setLines([{ kind: 'sys', text: '# 会话已清空' }])}>
            <X size={12} />
          </IconButton>
          {onToggleExpand && (
            <IconButton label={expanded ? '收起终端' : '展开终端'} size="sm" onClick={onToggleExpand}>
              {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </IconButton>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="终端输出"
        onClick={() => inputRef.current?.focus()}
        className="min-h-0 flex-1 cursor-text overflow-y-auto px-3 py-2 font-mono text-[12.5px] leading-[1.55]"
      >
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2 whitespace-pre-wrap break-all">
            {l.kind === 'cmd' ? (
              <>
                <span className="shrink-0 select-none text-accent">{prompt}</span>
                <span className="text-fg">{l.text}</span>
              </>
            ) : (
              <span
                className={cn(
                  l.kind === 'ok' && 'text-ok',
                  l.kind === 'warn' && 'text-warn',
                  l.kind === 'err' && 'text-danger',
                  l.kind === 'sys' && 'text-faint',
                  l.kind === 'out' && 'text-muted',
                )}
              >
                {l.text || '\u00a0'}
              </span>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-faint">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-accent" />
            <span className="font-mono text-[12px]">执行中…</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="shrink-0 select-none text-accent">{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={keyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="终端输入"
            placeholder="输入命令…"
            className="min-w-0 flex-1 border-none bg-transparent p-0 font-mono text-[12.5px] text-fg caret-[color:var(--accent)] placeholder:text-faint/60 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
