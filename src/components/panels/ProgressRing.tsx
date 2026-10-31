import type { Tone } from '../ui/primitives'

const STROKE: Record<Tone, string> = {
  neutral: 'var(--faint)',
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  info: 'var(--info)',
}

export function ProgressRing({
  value,
  size = 34,
  stroke = 2.5,
  tone = 'accent',
  showLabel = true,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  showLabel?: boolean
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`进度 ${Math.round(pct)}%`} role="img">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 grid place-items-center font-mono text-[11px] text-muted">{Math.round(pct)}</span>
      )}
    </div>
  )
}
