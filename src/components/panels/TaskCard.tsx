import { cn } from '../../lib/cn'
import { StatusPill, taskTone } from '../ui/primitives'
import { taskStatusLabel } from '../../lib/labels'
import type { Task } from '../../data/nexus'
import { ProgressRing } from './ProgressRing'

export function TaskCard({
  task,
  active,
  onClick,
  dense = false,
}: {
  task: Task
  active?: boolean
  onClick?: () => void
  dense?: boolean
}) {
  const tone = taskTone(task.status)
  const budgetPct = Math.round((task.budget.tokensUsed / task.budget.tokensMax) * 100)
  return (
    <button
      onClick={onClick}
      aria-current={active}
      className={cn('w-full rounded-lg px-3 py-2.5 text-left transition-colors duration-200', active ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusPill label={taskStatusLabel(task.status)} tone={tone} pulse={task.status === 'RUNNING' || task.status === 'TESTING'} />
            <span className="eyebrow">{task.id}</span>
          </div>
          <p className={cn('mt-1 leading-snug text-fg', dense ? 'line-clamp-1 text-xs' : 'line-clamp-2 text-xs')}>{task.title}</p>
        </div>
        <ProgressRing value={task.progress} size={dense ? 26 : 30} stroke={2} tone={tone} />
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
        <span className="truncate font-mono text-[11px]">{task.target}</span>
        <span className="ml-auto shrink-0">{task.updatedAt}</span>
      </div>

      {!dense && (
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn('h-full rounded-full', tone === 'ok' ? 'bg-ok' : tone === 'danger' ? 'bg-danger' : tone === 'warn' ? 'bg-warn' : 'bg-accent')}
            style={{ width: `${Math.min(100, budgetPct)}%` }}
          />
        </div>
      )}
    </button>
  )
}
