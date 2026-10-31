import { useMemo } from 'react'
import { GitCompare, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { codeFiles } from '../../data/nexus'
import { TOKEN_CLASS, tokenizeLine } from '../../lib/highlight'
import { IconButton } from '../ui/primitives'

const LANG_LABEL: Record<string, string> = { kotlin: 'Kotlin', toml: 'TOML', markdown: 'Markdown', typescript: 'TypeScript' }
const CURRENT_LINE = 20

export function CodeEditor({
  openPaths,
  activePath,
  onSelect,
  onClose,
  onReviewDiff,
}: {
  openPaths: string[]
  activePath: string
  onSelect: (p: string) => void
  onClose: (p: string) => void
  onReviewDiff: () => void
}) {
  const file = codeFiles.find((f) => f.path === activePath) ?? codeFiles[0]
  const lines = useMemo(() => file.code.split('\n'), [file])
  const changed = useMemo(() => {
    const set = new Set<number>()
    lines.forEach((_l, i) => {
      if (i > 18 && i < 34) set.add(i + 1)
    })
    return set
  }, [lines])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* tabs */}
      <div className="flex h-9 shrink-0 items-center border-b border-line px-2">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
          {openPaths.map((p) => {
            const f = codeFiles.find((c) => c.path === p)
            const active = p === activePath
            return (
              <div
                key={p}
                className={cn('group flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors', active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}
              >
                <button onClick={() => onSelect(p)} className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('size-1 rounded-full', f?.dirty ? 'bg-warn' : 'bg-transparent')} />
                  <span className="truncate">{p.split('/').at(-1)}</span>
                </button>
                {openPaths.length > 1 && (
                  <button
                    onClick={() => onClose(p)}
                    aria-label={`关闭 ${p.split('/').at(-1)}`}
                    className="grid size-4 place-items-center rounded text-faint opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <IconButton label="查看变更" size="sm" onClick={onReviewDiff}>
          <GitCompare size={13} />
        </IconButton>
      </div>

      {/* breadcrumb */}
      <div className="flex h-8 shrink-0 items-center gap-1 px-3.5 text-[11px] text-faint">
        <span className="truncate">{file.path}</span>
        <span className="ml-auto shrink-0">{LANG_LABEL[file.lang] ?? file.lang} · UTF-8 · LF</span>
      </div>

      {/* code */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="w-max min-w-full py-1.5" role="code" aria-label={`${file.path} 源码`}>
          {lines.map((line, i) => {
            const n = i + 1
            const isCurrent = n === CURRENT_LINE
            return (
              <div
                key={n}
                className={cn(
                  'flex h-[21px] min-w-full items-center whitespace-pre pr-8 font-mono text-[12px] leading-[21px]',
                  isCurrent ? 'bg-surface-2' : changed.has(n) ? 'bg-[color-mix(in_oklab,var(--warn)_5%,transparent)]' : '',
                )}
              >
                <span
                  className={cn(
                    'sticky left-0 z-10 flex h-[21px] w-[50px] shrink-0 items-center justify-end gap-1.5 pr-2.5 text-[11px] tabular-nums',
                    isCurrent ? 'text-accent' : 'text-faint/80',
                    'bg-[var(--bg)]',
                  )}
                >
                  <span className={cn('h-2.5 w-[2px] rounded-sm', isCurrent ? 'bg-accent' : changed.has(n) ? 'bg-warn/60' : 'bg-transparent')} />
                  {n}
                </span>
                <code className="pl-3.5 text-fg/90">
                  {line.length === 0
                    ? '\u00a0'
                    : tokenizeLine(line).map((t, k) => (
                        <span key={k} className={TOKEN_CLASS[t.kind]}>
                          {t.text}
                        </span>
                      ))}
                </code>
              </div>
            )
          })}
        </div>
      </div>

      {/* status */}
      <div className="flex h-7 shrink-0 items-center gap-4 overflow-hidden whitespace-nowrap border-t border-line px-3.5 text-[11px] text-faint">
        <span className="truncate text-muted">
          {file.path.split('/').at(-1)}
          <span className="ml-2">行 {CURRENT_LINE}</span>
        </span>
        <span className="ml-auto shrink-0">只读 · Agent 无写权限</span>
      </div>
    </div>
  )
}
