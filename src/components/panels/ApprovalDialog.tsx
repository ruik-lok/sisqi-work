import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Dialog } from '../ui/overlays'
import { Button, KV } from '../ui/primitives'
import { useNexus } from '../../state/store'
import { devices } from '../../data/nexus'

const RISK: Record<string, string> = { low: '低', medium: '中', high: '高' }

export function ApprovalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { approval, task, decideApproval } = useNexus()
  const [left, setLeft] = useState(approval?.expiresInSec ?? 0)

  useEffect(() => {
    setLeft(approval?.expiresInSec ?? 0)
  }, [approval?.id, approval?.expiresInSec])

  useEffect(() => {
    if (!open || !approval) return
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [open, approval])

  if (!approval) return null
  const device = devices.find((d) => d.id === approval.deviceId)
  const mmss = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`

  return (
    <Dialog
      open={open}
      onClose={onClose}
      tone="warn"
      title="批准一次设备读取"
      description="Agent 请求在 Pad 本地读取设备属性。批准只放行本次调用，不授予 Root。"
      footer={
        <>
          <span className="mr-auto text-[11px] text-faint">有效期 {mmss}</span>
          <Button size="sm" variant="ghost" onClick={onClose}>
            稍后
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              decideApproval(approval.id, 'DENIED')
              onClose()
            }}
          >
            拒绝
          </Button>
          <Button
            size="sm"
            variant="primary"
            data-autofocus
            icon={<ShieldCheck size={13} />}
            onClick={() => {
              decideApproval(approval.id, 'APPROVED')
              onClose()
            }}
          >
            批准
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md bg-surface-2 p-3">
          <p className="font-mono text-xs text-fg">{approval.capability}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{approval.operation}</p>
          <p className="mt-1.5 text-[11px] text-faint">风险：{RISK[approval.risk]} · 5 分钟内有效 · 仅本次</p>
        </div>

        <div>
          <KV k="任务" v={`${task.id} · ${task.title}`} mono={false} />
          <KV k="发起方" v={approval.requestedBy} />
          <KV k="目标设备" v={device ? `${device.name}（${device.id}）` : approval.deviceId} />
          <KV k="接口与系统" v={`API ${device?.androidApi ?? '待检测'} · ColorOS ${device?.coloros ?? '未知'}`} />
        </div>

        <ul className="space-y-1 text-[11px] leading-relaxed text-faint">
          <li>不会获得 Root shell；更高权限需再次批准。</li>
          <li>只读取 build 属性与内存信息，不触碰其他应用数据。</li>
          <li>决定会写入审计记录，可以随时撤销。</li>
        </ul>
      </div>
    </Dialog>
  )
}
