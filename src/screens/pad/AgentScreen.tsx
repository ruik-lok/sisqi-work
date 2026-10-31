import { useState } from 'react'
import { Ban, CheckCircle2, CircleDot, Pause, Play, ShieldAlert } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, Segmented, StatusPill, taskTone, KV } from '../../components/ui/primitives'
import { TaskCard } from '../../components/panels/TaskCard'
import { taskStatusLabel } from '../../lib/labels'
import { useNexus } from '../../state/store'

type Filter = 'all' | 'active' | 'approval' | 'done'

export function AgentScreen({ onOpenApproval }: { onOpenApproval: () => void }) {
  const { tasks, task, selectTask, pauseTask, resumeTask, cancelTask, approval, audit } = useNexus()
  const [filter, setFilter] = useState<Filter>('all')
  const [tab, setTab] = useState<'timeline' | 'audit'>('timeline')

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return ['RUNNING', 'TESTING', 'REVIEWING', 'PAUSED'].includes(t.status)
    if (filter === 'approval') return t.status === 'WAITING_APPROVAL'
    if (filter === 'done') return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status)
    return true
  })

  const running = task.status === 'RUNNING' || task.status === 'TESTING'

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
        <div className="flex h-14 items-center gap-2 px-4">
          <span className="text-[15px] font-semibold text-[var(--fg)]">任务</span>
          <Badge tone="neutral">{tasks.length}</Badge>
          <div className="ml-auto">
            <Segmented<Filter>
              label="任务筛选"
              size="xs"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: '全部' },
                { value: 'active', label: '进行' },
                { value: 'approval', label: '待批' },
                { value: 'done', label: '结束' },
              ]}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} active={t.id === task.id} onClick={() => selectTask(t.id)} />
          ))}
          {filtered.length === 0 && <p className="py-8 text-center text-[13px] text-[var(--muted)]">没有符合条件的任务</p>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-5">
          <StatusPill label={taskStatusLabel(task.status)} tone={taskTone(task.status)} pulse={running} />
          <span className="font-mono text-[12px] text-[var(--faint)]">{task.id}</span>
          <div className="ml-auto flex gap-1.5">
            {task.status === 'PAUSED' ? (
              <Button size="sm" variant="secondary" icon={<Play size={13} />} onClick={() => resumeTask(task.id)}>
                恢复
              </Button>
            ) : (
              <Button size="sm" variant="secondary" icon={<Pause size={13} />} onClick={() => pauseTask(task.id)} disabled={['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)}>
                暂停
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<Ban size={13} />} onClick={() => cancelTask(task.id)} disabled={['COMPLETED', 'CANCELLED'].includes(task.status)}>
              取消
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-[20px] font-semibold leading-snug text-[var(--fg)]">{task.title}</h2>
            <p className="mt-1 text-[12.5px] text-[var(--faint)]">
              {task.branch} · {task.target} · {task.checkpoint} · 更新于 {task.updatedAt}
            </p>

            <div className="mt-4 flex gap-5 border-b border-[var(--line)]">
              {(
                [
                  ['timeline', '时间线'],
                  ['audit', '审计'],
                ] as Array<['timeline' | 'audit', string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn('-mb-px border-b pb-2 text-[13px] transition-colors', tab === id ? 'border-[var(--accent)] text-[var(--fg)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]')}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'timeline' && (
              <div className="mt-5">
                {[...task.events].reverse().map((e) => (
                  <div key={e.sequence} className="flex gap-3 pb-4">
                    <div className="flex w-11 shrink-0 flex-col items-end">
                      <span className="num text-[11px] text-[var(--faint)]">{e.timestamp}</span>
                    </div>
                    <div className="relative flex w-4 shrink-0 justify-center">
                      <span className="absolute inset-y-0 w-px bg-[var(--line)]" />
                      <span
                        className={cn(
                          'relative mt-1 size-2 shrink-0 rounded-full ring-2 ring-[var(--bg)]',
                          e.tone === 'ok' ? 'bg-[var(--ok)]' : e.tone === 'warn' ? 'bg-[var(--warn)]' : e.tone === 'danger' ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]',
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="wrap-any text-[13.5px] leading-relaxed text-[var(--fg)]">{e.label}</p>
                      {e.detail && <p className="wrap-any mt-0.5 font-mono text-[11.5px] leading-relaxed text-[var(--faint)]">{e.detail}</p>}
                      <span className="mt-1 inline-block rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--faint)]">#{e.sequence} {e.type}</span>
                    </div>
                  </div>
                ))}
                <p className="caption">进度来自真实事件，不使用虚构百分比。</p>
              </div>
            )}

            {tab === 'audit' && (
              <div className="mt-5 space-y-2">
                {audit.map((a, i) => (
                  <div key={i} className="flex items-baseline gap-3 border-b border-[var(--line)] pb-2.5">
                    <span className="num w-11 shrink-0 text-[11px] text-[var(--faint)]">{a.at}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--fg)]">{a.action}</span>
                    <Badge tone={a.decision.includes('DENY') ? 'danger' : a.decision.includes('REQUIRE') ? 'warn' : 'ok'}>{a.decision}</Badge>
                    <span className="w-24 shrink-0 truncate text-right text-[11px] text-[var(--faint)]">{a.actor}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--surface)] xl:flex">
        <div className="flex h-14 items-center px-4">
          <span className="text-[15px] font-semibold text-[var(--fg)]">执行详情</span>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {approval && (
            <section className="rounded-[14px] border border-[var(--warn)] bg-[var(--warn-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg)]">
                <ShieldAlert size={14} className="text-[var(--warn)]" />
                等待你的批准
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">{approval.operation}</p>
              <p className="mt-1 font-mono text-[10.5px] text-[var(--faint)]">
                {approval.capability} · 风险 {approval.risk} · 单次有效
              </p>
              <Button size="sm" variant="primary" block className="mt-2" onClick={onOpenApproval}>
                查看并批准
              </Button>
            </section>
          )}

          <section className="rounded-[14px] border border-[var(--line)] p-3">
            <p className="label">证据</p>
            <div className="mt-1 space-y-1 text-[12px] text-[var(--muted)]">
              <p>{task.testSummary ? `测试 ${task.testSummary.passed} 通过 · ${task.testSummary.failed} 失败 · ${task.testSummary.skipped} 跳过` : '测试尚未运行'}</p>
              <p>{task.diffSummary ? `变更 ${task.diffSummary.files} 个文件 · +${task.diffSummary.additions} −${task.diffSummary.deletions}` : '暂无变更'}</p>
              <p className="text-[var(--faint)]">关键测试失败不会被其他维度抵消。</p>
            </div>
          </section>

          <section className="rounded-[14px] border border-[var(--line)] p-3">
            <p className="label">预算</p>
            <div className="mt-1">
              <KV k="tokens" v={`${(task.budget.tokensUsed / 1000).toFixed(1)}k / ${(task.budget.tokensMax / 1000).toFixed(0)}k`} />
              <KV k="成本" v={`$${task.budget.costUsd.toFixed(2)} / $${task.budget.costMaxUsd.toFixed(2)}`} />
              <KV k="时长" v={`${task.budget.minutes} / ${task.budget.minutesMax} 分钟`} />
              <KV k="工具调用" v={`${task.budget.tools} / ${task.budget.toolsMax}`} />
            </div>
          </section>

          <section className="rounded-[14px] border border-[var(--line)] p-3">
            <p className="label">权限</p>
            <div className="mt-1 space-y-1 text-[11.5px] text-[var(--muted)]">
              {[
                ['Read', 'ALLOW'],
                ['Write', 'ALLOW'],
                ['Execute', 'ALLOW'],
                ['Device:Request', 'APPROVAL'],
                ['Privileged:Request', 'DENY'],
              ].map(([cap, decision]) => (
                <div key={cap} className="flex items-center justify-between">
                  <span className="font-mono text-[11px]">{cap}</span>
                  <span className={cn('text-[10.5px]', decision === 'DENY' ? 'text-[var(--danger)]' : decision === 'ALLOW' ? 'text-[var(--ok)]' : 'text-[var(--warn)]')}>{decision}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[14px] border border-[var(--line)] p-3">
            <p className="label">停止条件</p>
            <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
              {['验收测试通过', '用户批准范围完成', '达到时间/成本/调用预算', '高风险操作等待审批', '依赖缺失或环境阻塞', '连续修复失败达到上限'].map((s) => (
                <li key={s} className="flex items-start gap-1.5">
                  <CircleDot size={10} className="mt-1 shrink-0 text-[var(--faint)]" />
                  {s}
                </li>
              ))}
            </ul>
          </section>

          {task.status === 'COMPLETED' && (
            <div className="flex items-center gap-2 rounded-[14px] border border-[var(--ok)] bg-[var(--ok-soft)] p-3 text-[12px] text-[var(--ok)]">
              <CheckCircle2 size={14} /> 已归档，证据包可复核
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
