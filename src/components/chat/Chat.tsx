import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  CornerDownLeft,
  Link2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Square,
  Trash2,
  Wrench,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, IconButton, Meter, StatusPill, taskTone } from '../ui/primitives'
import { Dialog, Menu, MenuItem } from '../ui/overlays'
import { WorkMark } from '../brand/Mark'
import { useNexus } from '../../state/store'


/* ------------------------------------------------------------------ sessions */

export function SessionList({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { sessions, activeSession, selectSession, newSession, renameSession, deleteSession, togglePin } = useNexus()
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const list = sessions
    .filter((s) => (query ? `${s.title} ${s.project ?? ''}`.toLowerCase().includes(query.toLowerCase()) : true))
    .slice()
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="text-[15px] font-semibold text-[var(--fg)]">会话</span>
        <Badge tone="neutral">{sessions.length}</Badge>
        <Button size="sm" variant="ghost" className="ml-auto" icon={<Plus size={14} />} onClick={newSession} aria-label="新建会话">
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
        {list.length === 0 && <p className="px-3 py-8 text-center text-[12.5px] text-[var(--faint)]">没有匹配的会话</p>}
        {list.map((s) => {
          const active = s.id === activeSession.id
          return (
            <div
              key={s.id}
              className={cn(
                'group relative mb-1 rounded-[10px] border px-2.5 py-2.5 transition-colors duration-150',
                active ? 'border-[var(--line)] bg-[var(--surface)]' : 'border-transparent hover:bg-[var(--surface-2)]',
              )}
            >
              <button onClick={() => selectSession(s.id)} aria-current={active} className="w-full text-left">
                <div className="flex items-center gap-1.5 pr-6">
                  <span className="truncate text-[13.5px] font-medium text-[var(--fg)]">{s.title}</span>
                  {s.status === 'running' && <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)] anim-pulse" />}
                  {s.status === 'awaiting' && <span className="size-1.5 shrink-0 rounded-full bg-[var(--warn)]" />}
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--faint)]">{s.updatedAt}</span>
                </div>
                <p className="mt-0.5 line-clamp-1 text-[12px] text-[var(--muted)]">{s.preview || '还没有消息'}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {s.pinned && <Pin size={10} className="text-[var(--faint)]" />}
                  {s.project && (
                    <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--muted)]">
                      <Link2 size={9} />
                      {s.project}
                    </span>
                  )}
                </div>
              </button>

              <div className="absolute right-1.5 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Menu
                  label="会话操作"
                  width="w-44"
                  trigger={({ toggle }) => (
                    <IconButton label="会话操作" size="sm" onClick={toggle} className="bg-[var(--surface)]">
                      <MoreHorizontal size={14} />
                    </IconButton>
                  )}
                >
                  {(close) => (
                    <>
                      <MenuItem
                        onSelect={() => {
                          setRenaming({ id: s.id, title: s.title })
                          close()
                        }}
                      >
                        <Pencil size={13} /> 重命名
                      </MenuItem>
                      <MenuItem
                        onSelect={() => {
                          togglePin(s.id)
                          close()
                        }}
                        hint={s.pinned ? '取消' : undefined}
                      >
                        <Pin size={13} /> {s.pinned ? '取消置顶' : '置顶'}
                      </MenuItem>
                      <MenuItem
                        onSelect={() => {
                          setDeleting(s.id)
                          close()
                        }}
                      >
                        <Trash2 size={13} /> 删除
                      </MenuItem>
                    </>
                  )}
                </Menu>
              </div>
            </div>
          )
        })}
      </div>

      {onOpenSettings && (
        <div className="border-t border-[var(--line)] px-3 py-2">
          <Button size="sm" variant="ghost" block icon={<Settings2 size={14} />} onClick={onOpenSettings}>
            模型与 API
          </Button>
        </div>
      )}

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        title="重命名会话"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-autofocus
              onClick={() => {
                if (renaming) renameSession(renaming.id, renaming.title)
                setRenaming(null)
              }}
            >
              保存
            </Button>
          </>
        }
      >
        <input
          value={renaming?.title ?? ''}
          onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
          aria-label="会话标题"
          className="h-10 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 text-[14px] focus:border-[var(--accent)] focus:outline-none"
        />
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="删除会话"
        description="会话与消息会从本机移除，此操作不可撤销。"
        tone="danger"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="danger"
              data-autofocus
              onClick={() => {
                if (deleting) deleteSession(deleting)
                setDeleting(null)
              }}
            >
              删除
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">确定要删除这个会话吗？</p>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------- thread */

export function ChatThread({ dense = false }: { dense?: boolean }) {
  const { messages, streaming, regenerate, toast } = useNexus()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: '已复制', tone: 'ok' })
    } catch {
      toast({ title: '复制失败', detail: '浏览器未授权剪贴板', tone: 'warn' })
    }
  }

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
            <div key={m.id} className="group flex gap-3">
              <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
                <WorkMark size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[var(--fg)]">思祁</span>
                  <span className="font-mono text-[11px] text-[var(--faint)]">{m.time}</span>
                  {m.streaming && <span className="text-[11px] text-[var(--accent)]">生成中…</span>}
                  {m.mode === 'demo' && !m.streaming && <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10.5px] text-[var(--faint)]">演示</span>}
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

                {!m.streaming && m.content && (
                  <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton label="复制回复" size="sm" onClick={() => copy(m.content)}>
                      <Copy size={13} />
                    </IconButton>
                    {!streaming && (
                      <IconButton label="重新生成" size="sm" onClick={regenerate}>
                        <RotateCcw size={13} />
                      </IconButton>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- error */

export function ChatErrorBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { chatError, clearError } = useNexus()
  if (!chatError) return null
  return (
    <div className="shrink-0 px-8">
      <div className="mx-auto flex max-w-[760px] items-start gap-2.5 rounded-[12px] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2.5">
        <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--danger)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[var(--fg)]">{chatError.title}</p>
          {chatError.hint && <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--muted)]">{chatError.hint}</p>}
          {chatError.detail && <p className="wrap-any mt-0.5 font-mono text-[11px] text-[var(--faint)]">{chatError.detail}</p>}
        </div>
        <Button size="sm" variant="secondary" onClick={onOpenSettings}>
          模型设置
        </Button>
        <IconButton label="关闭错误提示" size="sm" onClick={clearError}>
          ✕
        </IconButton>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- composer */

export function Composer({ dense = false, onOpenSettings }: { dense?: boolean; onOpenSettings: () => void }) {
  const { sendMessage, streaming, stopStreaming, modelId, setModelId, models, providers, demoMode, toast } = useNexus()
  const [text, setText] = useState('')
  const ta = useRef<HTMLTextAreaElement>(null)
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const provider = providers.find((p) => p.id === model?.providerId)

  const send = () => {
    if (!text.trim() || streaming) return
    sendMessage(text)
    setText('')
  }

  return (
    <div className={cn('shrink-0 border-t border-[var(--line)] bg-[var(--bg)]', dense ? 'px-3 py-2.5' : 'px-8 py-3')}>
      <div className={cn('mx-auto', dense ? 'max-w-none' : 'max-w-[760px]')}>
        {demoMode && (
          <div className="mb-2 flex items-center gap-2 rounded-[10px] bg-[var(--surface-2)] px-3 py-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--warn)]" />
            <span className="min-w-0 flex-1 text-[12px] text-[var(--muted)]">演示模式：这个 Provider 还没有 API Key，回复由本地脚本生成。</span>
            <Button size="sm" variant="secondary" onClick={onOpenSettings}>
              配置模型
            </Button>
          </div>
        )}
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
            rows={2}
            placeholder="描述任务，或继续上一次工作…"
            aria-label="消息输入"
            className="max-h-40 w-full resize-none bg-transparent px-3.5 pt-3 text-[15px] leading-relaxed text-[var(--fg)] placeholder:text-[var(--faint)] focus:outline-none"
          />
          <div className="flex items-center gap-1 px-2 pb-2 pt-1">
            <Menu
              label="选择模型"
              align="left"
              side="top"
              width="w-64"
              trigger={({ toggle, open }) => (
                <button
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label="选择模型"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[12.5px] text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                >
                  <span className={cn('size-1.5 rounded-full', demoMode ? 'bg-[var(--warn)]' : 'bg-[var(--ok)]')} />
                  <span className="max-w-[140px] truncate font-mono">{model?.name ?? '未选择模型'}</span>
                  <ChevronDown size={12} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <p className="label px-2 py-1">模型</p>
                  {models.filter((m) => m.enabled).map((m) => {
                    const p = providers.find((x) => x.id === m.providerId)
                    return (
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
                        <span className="ml-1 text-[10.5px] text-[var(--faint)]">{p?.name}</span>
                      </MenuItem>
                    )
                  })}
                  <div className="mt-1 border-t border-[var(--line)] px-2 py-1.5 text-[11px] text-[var(--faint)]">
                    {provider ? `${provider.name} · ${provider.status === 'connected' ? '已连接' : '未验证'}` : '未绑定 Provider'}
                  </div>
                  <MenuItem
                    onSelect={() => {
                      close()
                      onOpenSettings()
                    }}
                  >
                    <Settings2 size={13} /> 管理模型与 API
                  </MenuItem>
                </>
              )}
            </Menu>
            <IconButton label="添加附件" size="sm" onClick={() => toast({ title: '附件入口', detail: '当前支持文本与文件引用，图片稍后接入', tone: 'neutral' })}>
              <Paperclip size={15} />
            </IconButton>
            <IconButton label="工具与执行模式" size="sm" onClick={() => toast({ title: '执行模式', detail: '只读 / 自动执行 / 每步批准', tone: 'neutral' })}>
              <Wrench size={15} />
            </IconButton>
            <span className="ml-auto pr-1 text-[11px] text-[var(--faint)]" title="Enter 发送，Shift+Enter 换行" aria-hidden="true">
              <CornerDownLeft size={12} />
            </span>
            {streaming ? (
              <Button size="sm" variant="secondary" onClick={stopStreaming} aria-label="停止生成" className="!h-8 !px-2">
                <Square size={13} />
                停止
              </Button>
            ) : (
              <Button
                size="sm"
                variant={text.trim() ? 'primary' : 'quiet'}
                onClick={send}
                disabled={!text.trim()}
                aria-label="发送消息"
                className="!h-8 !w-9 !px-0"
              >
                <ArrowUp size={16} />
              </Button>
            )}
          </div>
        </div>
        {!dense && (
          <p className="mt-1.5 px-1 text-[11px] text-[var(--faint)]">
            {model?.name} · 上下文 {model?.contextK}k · 输出单价 ${model?.priceOut}/M · 能力来源 {model?.capabilitySource}
          </p>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ context */

export function ContextPanel({ onOpenApproval, onOpenSettings }: { onOpenApproval: () => void; onOpenSettings: () => void }) {
  const { task, approval, modelId, models, providers, activeSession, demoMode, messages } = useNexus()
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const provider = providers.find((p) => p.id === model?.providerId)
  const approxK = Math.max(1, Math.round(messages.reduce((n, m) => n + m.content.length, 0) / 2 / 1000))
  const maxK = model?.contextK ?? 128

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="text-[15px] font-semibold text-[var(--fg)]">上下文</span>
        <span className="caption truncate">{activeSession.project ?? '未关联项目'}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <section className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-center justify-between">
            <p className="label">当前模型</p>
            <Button size="sm" variant="ghost" onClick={onOpenSettings}>
              切换
            </Button>
          </div>
          <p className="mt-1 font-mono text-[13.5px] text-[var(--fg)]">{model?.name ?? '未配置'}</p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {provider?.name ?? '—'} · {provider?.route === 'proxy' ? '云端代理' : '本地直连'} · {model?.contextK ?? 0}k 上下文
          </p>
          <p className="mt-1 text-[11px] text-[var(--faint)]">
            输入 ${model?.priceIn ?? 0}/M · 输出 ${model?.priceOut ?? 0}/M
            {demoMode && <span className="ml-1 text-[var(--warn)]">· 演示模式</span>}
          </p>
        </section>

        <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-baseline justify-between">
            <p className="label">上下文用量</p>
            <span className="num text-[12px] text-[var(--muted)]">
              {approxK}k / {maxK}k
            </span>
          </div>
          <Meter className="mt-2" value={approxK} max={maxK} tone="accent" />
          <p className="mt-2 text-[11px] text-[var(--faint)]">按消息字符数估算（中文约 2 字符/token）；接入真实用量后以 Provider 返回为准。</p>
        </section>

        <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-baseline justify-between">
            <p className="label">关联项目</p>
            <Badge tone={activeSession.project ? 'neutral' : 'neutral'}>{activeSession.project ?? '未关联'}</Badge>
          </div>
          {activeSession.project ? (
            <>
              <p className="mt-1.5 font-mono text-[12px] text-[var(--muted)]">agent/harness-checkpoint</p>
              <p className="text-[11px] text-[var(--faint)]">~/projects/{activeSession.project}</p>
            </>
          ) : (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--faint)]">这个会话还没有关联项目；在项目页打开工作区后可挂载。</p>
          )}
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

export { Check }
