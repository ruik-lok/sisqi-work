/**
 * 思祁.Work 标识
 * 概念：一个开放的方形（工作站）+ 内部的连续笔势（想法 → 作品）。
 * 不使用机器人、大脑、芯片、星星等通用 AI 符号。
 */
export function WorkMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5" stroke="currentColor" strokeWidth="1.3" opacity="0.32" />
      <path
        d="M8.2 15.1c0 1.2.9 1.9 2 1.9h2.2c1.6 0 2.5-.9 2.5-2.1 0-1.4-1-2.1-2.7-2.2l-1.1-.1c-1.5-.1-2.3-.8-2.3-2 0-1.3 1-2.2 2.6-2.2h2.1c1.1 0 1.9.6 2 1.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.4" cy="16.6" r="1.15" fill="currentColor" />
    </svg>
  )
}

/** 旧名兼容 */
export const NexusMark = WorkMark

export function Wordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={className ?? 'flex items-center gap-2 text-fg'}>
      <WorkMark size={compact ? 18 : 20} />
      {!compact && (
        <span className="flex items-baseline gap-0.5">
          <span className="text-[15px] font-semibold tracking-tight">思祁</span>
          <span className="font-mono text-[11px] font-medium text-muted">.Work</span>
        </span>
      )}
    </span>
  )
}
