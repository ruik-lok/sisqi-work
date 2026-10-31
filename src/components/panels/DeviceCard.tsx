import { Cloud, Monitor, Smartphone, Tablet } from 'lucide-react'
import { cn } from '../../lib/cn'
import { StatusPill, deviceTone } from '../ui/primitives'
import type { Device } from '../../data/nexus'
import { deviceStatusLabel } from '../../lib/labels'

const ICON: Record<Device['kind'], typeof Smartphone> = {
  phone: Smartphone,
  tablet: Tablet,
  cloud: Cloud,
  server: Monitor,
}

const show = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? '待检测' : String(v))

export function DeviceCard({ device, onSelect, dense = false }: { device: Device; active?: boolean; onSelect?: () => void; dense?: boolean }) {
  const Icon = ICON[device.kind]
  const tone = deviceTone(device.status)
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-xs text-fg">{device.name}</span>
          <StatusPill label={deviceStatusLabel(device.status)} tone={tone} pulse={device.status === 'BUSY' || device.status === 'ONLINE'} />
          {onSelect && (
            <button onClick={onSelect} className="ml-auto shrink-0 text-[11px] text-muted hover:text-fg">
              详情
            </button>
          )}
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
          {show(device.model)} · API {show(device.androidApi)} · {device.coloros ? `ColorOS ${device.coloros}` : '—'} · {device.abi ?? 'unknown'}
        </p>
        {!dense && (
          <p className="mt-0.5 truncate font-mono text-[11px] text-faint">
            {device.rootAvailable === null ? 'Root 待检测' : device.rootAvailable ? '已 Root' : '未 Root'} · {device.rootProvider ?? 'Provider 待检测'} · {device.lastSeen}
          </p>
        )}
      </div>
    </div>
  )
}

export function DeviceProfileDialogBody({ device }: { device: Device }) {
  return (
    <div className="space-y-2.5">
      <div className="rounded-md bg-surface-2 p-3 font-mono text-[11px]">
        {[
          ['id', device.id],
          ['model', show(device.model)],
          ['device_code', show(device.deviceCode)],
          ['android_api', show(device.androidApi)],
          ['coloros', show(device.coloros)],
          ['abi', show(device.abi)],
          ['ram_total_mb', show(device.totalRamMb)],
          ['ram_available_mb', show(device.availableRamMb)],
          ['root_provider', show(device.rootProvider)],
          ['selinux_enforcing', device.selinuxEnforcing === null ? 'unknown' : String(device.selinuxEnforcing)],
          ['fingerprint', show(device.fingerprint)],
          ['profile_version', String(device.profileVersion)],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-[2px]">
            <span className="text-faint">{k}</span>
            <span className={cn('truncate', v === '待检测' ? 'text-warn' : 'text-fg')}>{v}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-faint">
        未知字段保持 null，不以型号命名推断。能力状态必须经 P0 实测后才能标为 Verified。
      </p>
      <div className="space-y-1">
        {device.capabilities.map((c) => (
          <div key={c.label} className="flex items-baseline justify-between gap-3 text-[11px]">
            <span className="text-muted">{c.label}</span>
            <span className="text-faint">{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
