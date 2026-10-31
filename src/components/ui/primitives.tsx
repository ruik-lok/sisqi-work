import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { CapabilityStatus, DeviceStatus, TaskStatus } from '../../data/nexus'
import { taskStatusLabel } from '../../lib/labels'

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'info'

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-muted',
  accent: 'text-accent',
  ok: 'text-[var(--ok)]',
  warn: 'text-[var(--warn)]',
  danger: 'text-[var(--danger)]',
  info: 'text-[var(--info)]',
}

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-[var(--faint)]',
  accent: 'bg-[var(--accent)]',
  ok: 'bg-[var(--ok)]',
  warn: 'bg-[var(--warn)]',
  danger: 'bg-[var(--danger)]',
  info: 'bg-[var(--info)]',
}

const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-2)] text-[var(--muted)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  ok: 'bg-[var(--ok-soft)] text-[var(--ok)]',
  warn: 'bg-[var(--warn-soft)] text-[var(--warn)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
}

export const taskTone = (s: TaskStatus): Tone =>
  s === 'COMPLETED'
    ? 'ok'
    : s === 'FAILED'
      ? 'danger'
      : s === 'CANCELLED'
        ? 'neutral'
        : s === 'WAITING_APPROVAL' || s === 'PAUSED'
          ? 'warn'
          : s === 'TESTING' || s === 'REVIEWING'
            ? 'info'
            : 'accent'

export const deviceTone = (s: DeviceStatus): Tone =>
  s === 'ONLINE' ? 'ok' : s === 'BUSY' ? 'accent' : s === 'NEEDS_APPROVAL' ? 'warn' : s === 'ERROR' ? 'danger' : s === 'REVOKED' || s === 'OFFLINE' ? 'neutral' : 'info'

export const capabilityTone = (s: CapabilityStatus): Tone =>
  s === 'Verified' ? 'ok' : s === 'Implemented' ? 'info' : s === 'Implementing' ? 'accent' : s === 'Blocked' ? 'warn' : 'neutral'

/* ----------------------------------------------------------------- button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--accent)] text-[var(--on-accent)] hover:brightness-105 border border-transparent',
  secondary: 'bg-[var(--surface)] text-[var(--fg)] border border-[var(--line-strong)] hover:bg-[var(--surface-2)]',
  ghost: 'bg-transparent text-[var(--muted)] border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] border border-transparent hover:brightness-[0.98]',
  quiet: 'bg-[var(--surface-2)] text-[var(--muted)] border border-transparent hover:text-[var(--fg)]',
}

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-[12px] gap-1 rounded-[8px]',
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-3.5 text-[14px] gap-2 rounded-[11px]',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-[12px]',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-[background-color,color,filter,border-color] duration-150 [transition-duration:160ms]',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({ label, active, size = 'md', className, children, ...rest }: IconButtonProps) {
  const s = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-11' : 'size-9'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-grid place-items-center rounded-[10px] text-[var(--muted)] transition-colors duration-150',
        'hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
        active && 'bg-[var(--accent-soft)] text-[var(--accent)]',
        s,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- badges */

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] leading-[18px]', TONE_SOFT[tone], className)}>{children}</span>
}

export function StatusPill({ label, tone, pulse, className }: { label: string; tone: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]', TONE_TEXT[tone], className)}>
      <span className="relative grid size-2 place-items-center">
        {pulse && <span className={cn('absolute size-2 rounded-full opacity-40 anim-pulse', TONE_DOT[tone])} />}
        <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />
      </span>
      {label}
    </span>
  )
}

export function TaskStatusPill({ status, pulse }: { status: TaskStatus; pulse?: boolean }) {
  return <StatusPill label={taskStatusLabel(status)} tone={taskTone(status)} pulse={pulse} />
}

export function CapabilityChip({ status }: { status: CapabilityStatus }) {
  const tone = capabilityTone(status)
  const hollow = status === 'Planned' || status === 'Not Supported'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px]', hollow ? 'text-[var(--faint)]' : TONE_TEXT[tone])}>
      <span className={cn('size-1.5 rounded-full', hollow ? 'border border-current' : TONE_DOT[tone])} />
      {status}
    </span>
  )
}

/* ------------------------------------------------------------------ panels */

export function Panel({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'aside' }) {
  return <As className={cn('rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]', className)}>{children}</As>
}

export function PanelHead({ title, meta, actions, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4', className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="truncate text-[15px] font-semibold text-[var(--fg)]">{title}</h2>
        {meta && <span className="caption truncate">{meta}</span>}
      </div>
      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </div>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('label', className)}>{children}</div>
}

export function Meter({ value, max, tone = 'accent', className, label }: { value: number; max: number; tone?: Tone; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="caption">{label}</span>
          <span className="num text-[12px] text-[var(--muted)]">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        className="h-1 overflow-hidden rounded-full bg-[var(--surface-2)]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? '进度'}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', TONE_DOT[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--line)] bg-[var(--surface-2)] px-1 font-mono text-[11px] text-[var(--faint)]">{children}</kbd>
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  label,
  className,
}: {
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode }>
  value: T
  onChange: (v: T) => void
  size?: 'xs' | 'sm'
  label: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex items-center gap-0.5 rounded-[10px] bg-[var(--surface-2)] p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[8px] transition-colors duration-150',
              size === 'xs' ? 'h-6 px-2 text-[12px]' : 'h-7 px-2.5 text-[13px]',
              active ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-1)]' : 'text-[var(--muted)] hover:text-[var(--fg)]',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150', checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-2)] border border-[var(--line-strong)]')}
    >
      <span className={cn('absolute top-0.5 size-5 rounded-full bg-white transition-[left] duration-150', checked ? 'left-[22px]' : 'left-0.5 bg-[var(--faint)]')} />
    </button>
  )
}

export function KV({ k, v, mono = true }: { k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[13px] text-[var(--muted)]">{k}</span>
      <span className={cn('wrap-any min-w-0 text-right text-[13px] text-[var(--fg)]', mono && 'num')}>{v}</span>
    </div>
  )
}

export function EmptyState({ icon, title, detail, action }: { icon: ReactNode; title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2.5 px-6 py-12 text-center">
      <div className="grid size-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--faint)]">{icon}</div>
      <p className="text-[14px] font-medium text-[var(--fg)]">{title}</p>
      {detail && <p className="max-w-[38ch] text-[13px] leading-relaxed text-[var(--muted)]">{detail}</p>}
      {action}
    </div>
  )
}

export { TONE_TEXT, TONE_DOT, TONE_SOFT }
