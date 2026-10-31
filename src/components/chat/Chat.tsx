import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  ChevronDown,
  CornerDownLeft,
  Link2,
  Paperclip,
  Plus,
  Search,
  Square,
  Wrench,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, IconButton, Meter, StatusPill, taskTone } from '../ui/primitives'
import { Menu, MenuItem } from '../ui/overlays'
import { WorkMark } from '../brand/Mark'
import { useNexus } from '../../state/store'
import { models, providers, contextUsage } from '../../data/work'

/* ------------------------------------------------------------------ sessions */

export function SessionList({ compact = false }: { compact?: boolean }) {
  const { sessions, activeSession, selectSession, newSession } = useNexus()
  const [query, setQuery] = useState('')
  const list = sessions.filter((s) => (query ? `${s.title} ${s.project ?? ''}`.toLowerCase().includes(query.toLowerCase()) : true))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="text-[15px] font-semibold text-[var(--fg)]">会话</span>
        <Badge tone="neutral">{sessions.length}</Badge>
        <Button size="sm" variant="ghost" className="ml-auto" icon={<Plus size={14} />} onClick={newSession}>
          新建
        </Button>
      </div>
      <div className="shrink-0 px-3 pb-2">
        <label className="flex h-9 items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2.5 focus-within:border-[var(--accent)]">
          <Search size={14} className="text-[var(--faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索会话"
            aria-label="搜索会话"
            className="w-full bg-transparent text-[13px] placeholder:text-[var(--faint)] focus:outline-none"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {list.map((s) => {
          const active = s.id === activeSession.id
          return (
            <button
              key={s.id}
              onClick={() => selectSession(s.id)}
              aria-current={active}
              className={cn(
                'mb-1 w-full rounded-[10px] border px-2.5 py-2.5 text-left transition-colors duration-150',
                active ? 'border-[var(--line)] bg-[var(--surface)]' : 'border-transparent hover:bg-[var(--surface-2)]',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13.5px] font-medium text-[var(--fg)]">{s.title}</span>
                {s.status === 'running' && <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)] anim-pulse" />}
                {s.status === 'awaiting' && <span className="size-1.5 shrink-0 rounded-full bg-[var(--warn)]" />}
                <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--faint)]">{s.updatedAt}</span>
              </div>
              {!compact && <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--muted)]">{s.preview}</p>}
              <div className="mt-1 flex items-center gap-1.5">
                {s.project && (
                  <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--muted)]">
                    <Link2 size={9} />
                    {s.project}
                  </span>
                )}
                {s.pinned && <span className="text-[10.5px] text-[var(--faint)]">置顶</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- thread */

export function ChatThread({ dense = false }: { dense?: boolean }) {
  const { messages, streaming, stopStreaming } = useNexus()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div ref={ref} className={cn('min-h-0 flex-1 overflow-y-auto', dense ? 'px-4' : 'px-8')}>
      <div className={cn('mx-auto w-full space-y-6 py-6', dense ? 'max-w-none' : 'max-w-[760px]')}>
        {messages.length === 0 && (
          <div className="grid place-items-center gap-3 py-20 text-center">
            <div className="grid size-12 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
              <WorkMark size={24} />
            </div>
            <h2 className="text-[22px] font-semibold text-[var(--fg)]">让想法，真正成为作品。</h2>
            <p className="max-w-[36ch] text-[14px] leading-relaxed text-[var(--muted)]">描述你要做的事，我会规划、执行并把证据交给你。</p>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className={cn('wrap-any max-w-[78%] min-w-0 rounded-[16px] rounded-br-[6px] bg-[var(--accent-soft)] px-4 py-3 text-[15px] leading-relaxed text-[var(--fg)]', dense && 'text-[14px]')}>
                  {m.content}
                </div>
              </div>
            )
          }

          if (m.role === 'tool') {
            return (
              <div key={m.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="flex items-center gap-2">
                  <Wrench size={13} className="text-[var(--faint)]" />
                  <span className="text-[12px] font-medium text-[var(--muted)]">工具输出</span>
                  <span className="ml-auto font-mono text-[11px] text-[var(--faint)]">{m.time}</span>
                </div>
                <pre className="wrap-any mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[12.5px] leading-[1.7] text-[var(--muted)]">{m.content}</pre>
              </div>
            )
          }

          return (
            <div key={m.id} className="flex gap-3">
              <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
                <WorkMark size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[var(--fg)]">思祁</span>
                  <span className="font-mono text-[11px] text-[var(--faint)]">{m.time}</span>
                  {m.streaming && <span className="text-[11px] text-[var(--accent)]">生成中…</span>}
                </div>
                <div className={cn('wrap-any mt-1 whitespace-pre-wrap text-[15px] leading-[1.75] text-[var(--fg)]', dense && 'text-[14px]')}>
                  {m.content}
                  {m.streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-[var(--accent)] anim-pulse" />}
                </div>
                {m.tools && (
                  <div className="mt-2.5 space-y-1.5">
                    {m.tools.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5">
                        <Wrench size={12} className="shrink-0 text-[var(--faint)]" />
                        <span className="shrink-0 font-mono text-[12px] text-[var(--fg)]">{t.name}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[var(--faint)]">{t.detail}</span>
                        <span className={cn('shrink-0 text-[11px]', t.state === 'done' ? 'text-[var(--ok)]' : t.state === 'running' ? 'text-[var(--accent)]' : 'text-[var(--warn)]')}>
                          {t.state === 'done' ? '完成' : t.state === 'running' ? '执行中' : '待批准'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {streaming && (
          <div className="flex justify-center">
            <Button size="sm" variant="secondary" icon={<Square size={11} />} onClick={stopStreaming}>
              停止生成
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- composer */

export function Composer({ dense = false }: { dense?: boolean }) {
  const { sendMessage, streaming, modelId, setModelId, toast } = useNexus()
  const [text, setText] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const provider = providers.find((p) => p.id === model.providerId)

  const send = () => {
    if (!text.trim() || streaming) return
    sendMessage(text)
    setText('')
  }

  return (
    <div className={cn('shrink-0 border-t border-[var(--line)] bg-[var(--bg)]', dense ? 'px-3 py-2.5' : 'px-8 py-3')}>
      <div className={cn('mx-auto', dense ? 'max-w-none' : 'max-w-[760px]')}>
        <div className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] focus-within:border-[var(--accent)]">
          <textarea
            ref={ta}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            rows={dense ? 2 : 2}
            placeholder="描述任务，或继续上一次工作…"
            aria-label="消息输入"
            className="max-h-40 w-full resize-none bg-transparent px-3.5 pt-3 text-[15px] leading-relaxed text-[var(--fg)] placeholder:text-[var(--faint)] focus:outline-none"
          />
          <div className="flex items-center gap-1 px-2 pb-2 pt-1">
            <Menu
              label="选择模型"
              align="left"
              side="top"
              trigger={({ toggle, open }) => (
                <button
                  onClick={toggle}
                  aria-expanded={open}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[12.5px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                >
                  <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                  <span className="max-w-[140px] truncate font-mono">{model.name}</span>
                  <ChevronDown size={12} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <p className="label px-2 py-1">模型</p>
                  {models
                    .filter((m) => m.enabled)
                    .map((m) => (
                      <MenuItem
                        key={m.id}
                        selected={m.id === modelId}
                        onSelect={() => {
                          setModelId(m.id)
                          close()
                        }}
                        hint={`${m.contextK}k`}
                      >
                        <span className="font-mono text-[12.5px]">{m.name}</span>
                      </MenuItem>
                    ))}
                  <div className="mt-1 border-t border-[var(--line)] px-2 py-1.5 text-[11px] text-[var(--faint)]">
                    {provider?.name} · {provider?.route === 'proxy' ? '云端代理' : '本地直连'}
                  </div>
                </>
              )}
            </Menu>
            <IconButton label="添加附件" size="sm" onClick={() => toast({ title: '附件入口', detail: '支持文本、图片与项目文件引用', tone: 'neutral' })}>
              <Paperclip size={15} />
            </IconButton>
            <IconButton label="工具与执行模式" size="sm" onClick={() => toast({ title: '执行模式', detail: '只读 / 自动执行 / 每步批准', tone: 'neutral' })}>
              <Wrench size={15} />
            </IconButton>
            <span className="ml-auto pr-1 text-[11px] text-[var(--faint)]" title="Enter 发送，Shift+Enter 换行" aria-hidden="true">
              <CornerDownLeft size={12} />
            </span>
            <Button
              size="sm"
              variant={text.trim() && !streaming ? 'primary' : 'quiet'}
              onClick={send}
              disabled={!text.trim() || streaming}
              aria-label="发送消息"
              className="!h-8 !w-9 !px-0"
            >
              <ArrowUp size={16} />
            </Button>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-[var(--faint)]">
          {model.name} · 上下文 {model.contextK}k · 输出单价 ${model.priceOut}/M · 能力来源 {model.capabilitySource}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ context */

export function ContextPanel({ onOpenApproval }: { onOpenApproval: () => void }) {
  const { task, approval, modelId, activeSession } = useNexus()
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const provider = providers.find((p) => p.id === model.providerId)

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="text-[15px] font-semibold text-[var(--fg)]">上下文</span>
        <span className="caption">{activeSession.project ?? '未关联项目'}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <section className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="label">当前模型</p>
          <p className="mt-1 font-mono text-[13.5px] text-[var(--fg)]">{model.name}</p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {provider?.name} · {provider?.route === 'proxy' ? '云端代理' : '本地直连'} · {model.contextK}k 上下文
          </p>
          <p className="mt-1 text-[11px] text-[var(--faint)]">
            输入 ${model.priceIn}/M · 输出 ${model.priceOut}/M · 能力：{model.capabilities.join('、')}
          </p>
        </section>

        <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-baseline justify-between">
            <p className="label">上下文用量</p>
            <span className="num text-[12px] text-[var(--muted)]">
              {contextUsage.usedK}k / {contextUsage.maxK}k
            </span>
          </div>
          <Meter className="mt-2" value={contextUsage.usedK} max={contextUsage.maxK} tone="accent" />
          <p className="mt-2 text-[11px] text-[var(--faint)]">
            {contextUsage.messages} 条消息 · {contextUsage.toolResults} 条工具结果 · 压缩阈值按模型窗口动态计算
          </p>
        </section>

        <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-baseline justify-between">
            <p className="label">关联项目</p>
            <Badge tone="neutral">nexus-core</Badge>
          </div>
          <p className="mt-1.5 font-mono text-[12px] text-[var(--muted)]">agent/harness-checkpoint</p>
          <p className="text-[11px] text-[var(--faint)]">~/projects/nexus-core · 4 个未提交变更</p>
        </section>

        <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-baseline justify-between">
            <p className="label">Agent</p>
            <StatusPill label={task.stage} tone={taskTone(task.status)} pulse={task.status === 'RUNNING' || task.status === 'TESTING'} />
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--fg)]">{task.title}</p>
          <Meter className="mt-2" value={task.progress} max={100} tone="accent" />
          <p className="mt-1.5 text-[11px] text-[var(--faint)]">
            {task.id} · {task.checkpoint} · {task.testSummary ? `${task.testSummary.passed} 测试通过` : '测试未运行'}
          </p>
        </section>

        {approval && (
          <section className="mt-3 rounded-[14px] border border-[var(--warn)] bg-[var(--warn-soft)] p-3">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--warn)]" />
              <p className="text-[12.5px] font-medium text-[var(--fg)]">等待审批</p>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">{approval.operation}</p>
            <Button size="sm" variant="secondary" block className="mt-2" onClick={onOpenApproval}>
              查看并批准
            </Button>
          </section>
        )}

        <section className="mt-3">
          <p className="label">最近活动</p>
          <div className="mt-1.5 space-y-1.5">
            {task.events.slice(-4).reverse().map((e) => (
              <div key={e.sequence} className="flex gap-2">
                <span className="num w-9 shrink-0 text-[10.5px] text-[var(--faint)]">{e.timestamp}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--muted)]">{e.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

