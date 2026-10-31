import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, Search, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button, Kbd, TONE_DOT, type Tone } from './primitives'
import { useNexus } from '../../state/store'
import { useOverlayRoot } from './overlay-root'

/* ------------------------------------------------------------------ dialog */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-[560px]',
  tone = 'accent',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: string
  tone?: Tone
}) {
  const root = useOverlayRoot()
  const panelRef = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restore.current = document.activeElement as HTMLElement
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current?.querySelector<HTMLElement>('button, input, [href]')
      el?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter((n) => !n.hasAttribute('disabled'))
        if (!nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey, true)
      restore.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button aria-label="关闭对话框" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-[var(--scrim)] anim-fade" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : '对话框'}
        className={cn('relative flex max-h-[92%] w-full flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--elevated)] shadow-[var(--shadow-2)] anim-pop', width)}
      >
        <div className="flex shrink-0 items-start gap-2.5 border-b border-[var(--line)] px-5 py-4">
          <span className={cn('mt-2 size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[var(--fg)]">{title}</h2>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="关闭" className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]">
            <X size={15} />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-3">{footer}</div>}
      </div>
    </div>,
    root,
  )
}

/* ------------------------------------------------------------------ sheet */

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = 'max-h-[78%]',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  height?: string
}) {
  const root = useOverlayRoot()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end">
      <button aria-label="关闭" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-[var(--scrim)] anim-fade" />
      <div
        className={cn('relative flex w-full flex-col overflow-hidden rounded-t-[var(--radius-xl)] border-x border-t border-[var(--line)] bg-[var(--elevated)] anim-rise', height)}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--fg)]">{title}</span>
          <button onClick={onClose} aria-label="关闭" className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-[var(--faint)] hover:bg-[var(--surface-2)]">
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    root,
  )
}

/* ------------------------------------------------------------------ toasts */

export function ToastHost() {
  const { toasts, dismissToast } = useNexus()
  const root = useOverlayRoot()
  return createPortal(
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-[420px] items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--elevated)] px-3.5 py-3 shadow-[var(--shadow-2)] anim-pop"
        >
          <span className={cn('mt-2 size-1.5 shrink-0 rounded-full', TONE_DOT[t.tone])} />
          <div className="min-w-0 flex-1">
            <p className="wrap-any text-[13px] font-medium text-[var(--fg)]">{t.title}</p>
            {t.detail && <p className="wrap-any mt-0.5 text-[12px] leading-relaxed text-[var(--muted)]">{t.detail}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label="关闭提示" className="text-[var(--faint)] hover:text-[var(--fg)]">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    root,
  )
}

/* ------------------------------------------------------------- command palette */

export interface Command {
  id: string
  label: string
  group: string
  hint?: string
  icon?: ReactNode
  keywords?: string
  run: () => void
}

export function CommandPalette({ commands }: { commands: Command[] }) {
  const { paletteOpen, setPaletteOpen } = useNexus()
  const root = useOverlayRoot()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const filtered = commands.filter((c) => {
    if (!query.trim()) return true
    const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase()
    return query
      .toLowerCase()
      .split(/\s+/)
      .every((part) => hay.includes(part))
  })

  useEffect(() => {
    if (!paletteOpen) return
    setQuery('')
    setCursor(0)
    const t = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [paletteOpen])

  useEffect(() => setCursor(0), [query])

  if (!paletteOpen) return null
  const close = () => setPaletteOpen(false)
  const groups = Array.from(new Set(filtered.map((c) => c.group)))

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-start justify-center p-3 pt-[7vh]">
      <button aria-label="关闭命令面板" tabIndex={-1} onClick={close} className="absolute inset-0 cursor-default bg-[var(--scrim)] anim-fade" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        className="relative flex max-h-[88%] w-full max-w-[600px] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--line)] bg-[var(--elevated)] shadow-[var(--shadow-2)] anim-pop"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-4">
          <Search size={16} className="shrink-0 text-[var(--faint)]" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                filtered[cursor]?.run()
                close()
              } else if (e.key === 'Escape') close()
            }}
            placeholder="搜索页面、会话、项目或命令"
            aria-label="搜索命令"
            aria-controls={listId}
            className="h-12 w-full bg-transparent text-[15px] text-[var(--fg)] placeholder:text-[var(--faint)] focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div id={listId} role="listbox" aria-label="命令结果" className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-[var(--muted)]">没有匹配的命令</p>}
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <p className="label px-2 py-1.5">{g}</p>
              {filtered
                .filter((c) => c.group === g)
                .map((c) => {
                  const idx = filtered.indexOf(c)
                  const active = idx === cursor
                  return (
                    <button
                      key={c.id}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => {
                        c.run()
                        close()
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                        active ? 'bg-[var(--surface-2)] text-[var(--fg)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg border', active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)] text-[var(--faint)]')}>
                        {c.icon ?? <ArrowRight size={13} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">{c.hint}</span>}
                      {active && <Check size={13} className="shrink-0 text-[var(--accent)]" />}
                    </button>
                  )
                })}
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3 border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-2">
          <span className="flex items-center gap-1 text-[11px] text-[var(--faint)]">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> 移动
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[var(--faint)]">
            <Kbd>↵</Kbd> 执行
          </span>
          <span className="ml-auto font-mono text-[11px] text-[var(--faint)]">思祁.Work COMMAND</span>
        </div>
      </div>
    </div>,
    root,
  )
}

/* ------------------------------------------------------------------ menu */

/**
 * 弹出菜单：贴边时自动向上翻开，并按可用高度收缩，避免被屏幕/设备外框裁切。
 * side="top" 强制向上（底部工具条、输入框里的选择器）。
 */
export function Menu({
  trigger,
  children,
  align = 'right',
  side = 'auto',
  label,
  width = 'w-60',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  side?: 'auto' | 'top' | 'bottom'
  label: string
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<{ up: boolean; maxHeight: number; dx: number }>({ up: false, maxHeight: 420, dx: 0 })
  const wrap = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const host = wrap.current
    if (!host) return
    // 设备外框（带 data-screen-frame）为边界；桌面模式退化为视口
    const frame = host.closest('[data-screen-frame]') as HTMLElement | null
    const frameRect = frame?.getBoundingClientRect()
    const scale = frame && frame.offsetWidth ? frameRect!.width / frame.offsetWidth : 1
    const top = frameRect ? frameRect.top : 0
    const bottom = frameRect ? frameRect.bottom : window.innerHeight
    const leftEdge = frameRect ? frameRect.left : 0
    const rightEdge = frameRect ? frameRect.right : window.innerWidth
    const hostRect = host.getBoundingClientRect()
    const contentHeight = panel.current?.scrollHeight ?? 280
    const spaceBelow = (bottom - hostRect.bottom) / scale - 8
    const spaceAbove = (hostRect.top - top) / scale - 8
    const up = side === 'top' || (side === 'auto' && contentHeight + 8 > spaceBelow && spaceAbove > spaceBelow)
    const maxHeight = Math.max(140, Math.min(420, Math.floor(up ? spaceAbove : spaceBelow)))

    // 水平方向贴边时用 margin 向内收（不用 transform，避免与入场动画冲突）
    const node = panel.current
    if (node) node.style.marginLeft = '0px'
    const panelRect = node?.getBoundingClientRect()
    const margin = 8 * scale
    let dx = 0
    if (panelRect) {
      if (panelRect.left < leftEdge + margin) dx = (leftEdge + margin - panelRect.left) / scale
      else if (panelRect.right > rightEdge - margin) dx = (rightEdge - margin - panelRect.right) / scale
    }
    setPlacement({ up, maxHeight, dx })
  }, [open, side, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onReposition = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
    }
  }, [open])

  const close = () => setOpen(false)
  return (
    <div ref={wrap} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          ref={panel}
          role="menu"
          aria-label={label}
          style={{ maxHeight: placement.maxHeight, marginLeft: placement.dx }}
          className={cn(
            'absolute z-40 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--elevated)] p-1.5 shadow-[var(--shadow-2)] anim-pop',
            width,
            placement.up ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
          )}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ children, selected, onSelect, hint }: { children: ReactNode; selected?: boolean; onSelect: () => void; hint?: string }) {
  return (
    <button
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
        selected ? 'text-[var(--fg)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
      )}
    >
      {children}
      {hint && <span className="ml-auto font-mono text-[11px] text-[var(--faint)]">{hint}</span>}
      {selected && <Check size={13} className="ml-auto text-[var(--accent)]" />}
    </button>
  )
}

export { Button }
