import { useState } from 'react'
import { Check, FileCode2, GitMerge, RotateCcw, ShieldCheck, Undo2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { diffFiles } from '../../data/nexus'
import { Badge, Button } from '../ui/primitives'
import { useNexus } from '../../state/store'

export function DiffView({ onDone }: { onDone?: () => void }) {
  const { task, toast } = useNexus()
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set())
  const [rejected, setRejected] = useState<Set<string>>(() => new Set())

  const toggle = (path: string, action: 'accept' | 'reject') => {
    setAccepted((prev) => {
      const next = new Set(prev)
      action === 'accept' ? next.add(path) : next.delete(path)
      return next
    })
    setRejected((prev) => {
      const next = new Set(prev)
      action === 'reject' ? next.add(path) : next.delete(path)
      return next
    })
  }

  const totals = diffFiles.reduce(
    (acc, f) => ({ add: acc.add + f.additions, del: acc.del + f.deletions }),
    { add: 0, del: 0 },
  )

  return (
    <div className="flex max-h-[68vh] flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <Badge tone="neutral">
          <FileCode2 size={9} /> {diffFiles.length} files
        </Badge>
        <span className="font-mono text-2xs text-ok">+{totals.add}</span>
        <span className="font-mono text-2xs text-danger">−{totals.del}</span>
        <Badge tone="neutral">{task.branch}</Badge>
        <span className="ml-auto flex items-center gap-1 font-mono text-[11.5px] text-faint">
          <ShieldCheck size={10} className="text-ok" /> 未包含秘密项 · 仅工作区文件
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {diffFiles.map((f) => {
          const isAccepted = accepted.has(f.path)
          const isRejected = rejected.has(f.path)
          return (
            <div
              key={f.path}
              className={cn(
                'overflow-hidden rounded-md border bg-surface-2/40 transition-colors',
                isAccepted ? 'border-[var(--ok)]/40' : isRejected ? 'border-[var(--danger)]/40' : 'border-line',
              )}
            >
              <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
                <FileCode2 size={11} className="text-faint" />
                <span className="truncate font-mono text-[12px] text-fg">{f.path}</span>
                <span className="ml-1 font-mono text-[11.5px] text-ok">+{f.additions}</span>
                <span className="font-mono text-[11.5px] text-danger">−{f.deletions}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="xs"
                    variant={isAccepted ? 'primary' : 'quiet'}
                    icon={<Check size={10} />}
                    onClick={() => toggle(f.path, 'accept')}
                  >
                    {isAccepted ? '已接受' : '接受'}
                  </Button>
                  <Button
                    size="xs"
                    variant={isRejected ? 'danger' : 'quiet'}
                    icon={<Undo2 size={10} />}
                    onClick={() => toggle(f.path, 'reject')}
                  >
                    驳回
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto py-1 font-mono text-[12px] leading-[1.55]">
                {f.hunks.map((h, hi) => (
                  <div key={hi}>
                    <div className="bg-surface-3/60 px-2.5 py-0.5 text-[11.5px] text-info">{h.header}</div>
                    {h.lines.map((l, li) => (
                      <div
                        key={li}
                        className={cn(
                          'whitespace-pre px-2.5',
                          l.kind === 'add' && 'bg-[color-mix(in_oklab,var(--ok)_11%,transparent)] text-ok',
                          l.kind === 'del' && 'bg-[color-mix(in_oklab,var(--danger)_11%,transparent)] text-danger',
                          l.kind === 'ctx' && 'text-muted',
                        )}
                      >
                        <span className="mr-2 inline-block w-2 select-none opacity-60">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>
                        {l.text || '\u00a0'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-2.5">
        <span className="font-mono text-[11.5px] text-faint">
          接受 {accepted.size} · 驳回 {rejected.size} · 未决 {diffFiles.length - accepted.size - rejected.size}
        </span>
        <div className="ml-auto flex gap-1.5">
          <Button
            size="sm"
            variant="quiet"
            icon={<RotateCcw size={11} />}
            onClick={() => {
              setAccepted(new Set())
              setRejected(new Set())
              toast({ title: '已重置审查选择', tone: 'neutral' })
            }}
          >
            重置
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<GitMerge size={11} />}
            onClick={() => {
              onDone?.()
              toast({
                title: accepted.size > 0 ? `已合并 ${accepted.size} 个文件到 ${task.branch}` : '未选择任何文件，变更保留在分支',
                detail: '合并动作写入审计；Reviewer 结论与测试证据一并归档',
                tone: accepted.size > 0 ? 'ok' : 'warn',
              })
            }}
          >
            合并已接受变更
          </Button>
        </div>
      </div>
    </div>
  )
}
