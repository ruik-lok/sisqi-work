import { useState } from 'react'
import { Cloud, Database, FileText, Github, Plug, Server, ShieldCheck, Terminal, Wrench } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, Segmented, StatusPill, Toggle } from '../../components/ui/primitives'
import { connectors, skills } from '../../data/work'
import { useNexus } from '../../state/store'

type Tab = 'connectors' | 'skills' | 'mcp'

const ICON: Record<string, typeof Plug> = {
  开发平台: Github,
  文件与知识: FileText,
  数据库: Database,
  服务器: Server,
  本地环境: Terminal,
  通信: Cloud,
}

const STATUS_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  connected: { label: '已连接', tone: 'ok' },
  needs_auth: { label: '需要授权', tone: 'warn' },
  offline: { label: '不可用', tone: 'danger' },
  disabled: { label: '已停用', tone: 'neutral' },
}

export function ConnectorsScreen() {
  const [tab, setTab] = useState<Tab>('connectors')
  const { toast } = useNexus()
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(skills.map((s) => [s.id, s.enabled])))

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto max-w-[1040px]">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--fg)]">连接</h2>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">外部能力通过统一权限层接入；每个连接器独立授权与审计。</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Segmented<Tab>
              label="连接类型"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'connectors', label: `连接器 ${connectors.length}` },
                { value: 'skills', label: `技能 ${skills.length}` },
                { value: 'mcp', label: 'MCP' },
              ]}
            />
            <Button size="sm" variant="secondary" icon={<Plug size={14} />} onClick={() => toast({ title: '添加连接器', detail: '支持 REST、MCP、本地适配器与 SSH', tone: 'neutral' })}>
              添加
            </Button>
          </div>
        </div>

        {tab === 'connectors' && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connectors.map((c) => {
              const Icon = ICON[c.category] ?? Plug
              const st = STATUS_LABEL[c.status]
              return (
                <section key={c.id} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                  <div className="flex items-start gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)]">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-[var(--fg)]">{c.name}</span>
                        <StatusPill label={st.label} tone={st.tone} />
                      </div>
                      <p className="caption mt-0.5">{c.category}</p>
                    </div>
                  </div>
                  <p className="wrap-any mt-2.5 text-[12px] leading-relaxed text-[var(--muted)]">{c.detail}</p>
                  <p className="wrap-any mt-1 font-mono text-[10.5px] text-[var(--faint)]">scope: {c.scopes}</p>
                  <div className="mt-3 flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => toast({ title: `${c.name} 连接测试`, detail: 'HTTP 200 · 权限范围已读取', tone: 'ok' })}>
                      测试
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toast({ title: `${c.name} 授权管理`, detail: '可查看、收紧或撤销权限', tone: 'neutral' })}>
                      权限
                    </Button>
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {tab === 'skills' && (
          <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]">
            {skills.map((s, i) => (
              <div key={s.id} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-[var(--line)]')}>
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)]">
                  <Wrench size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-[var(--fg)]">{s.name}</p>
                  <p className="text-[11px] text-[var(--faint)]">
                    v{s.version} · {s.scope} · {s.permissions}
                  </p>
                </div>
                <Badge tone="neutral">按需加载</Badge>
                <Toggle
                  checked={Boolean(enabled[s.id])}
                  onChange={(v) => {
                    setEnabled((prev) => ({ ...prev, [s.id]: v }))
                    toast({ title: `${s.name} ${v ? '已启用' : '已停用'}`, tone: 'neutral' })
                  }}
                  label={`启用 ${s.name}`}
                />
              </div>
            ))}
            <div className="border-t border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 text-[11px] leading-relaxed text-[var(--faint)]">
              技能脚本运行在受限环境；不会自动获得 Root、网络或文件权限。
            </div>
          </div>
        )}

        {tab === 'mcp' && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              { name: 'filesystem', transport: 'stdio', scope: '~/projects（只读）', status: '已连接', tone: 'ok' as const },
              { name: 'git-server', transport: 'HTTP + OAuth', scope: 'repo:read', status: '已连接', tone: 'ok' as const },
              { name: 'postgres', transport: 'stdio', scope: 'read-only', status: '需授权', tone: 'warn' as const },
              { name: 'browser', transport: 'HTTP', scope: 'disabled', status: '已停用', tone: 'neutral' as const },
            ].map((m) => (
              <section key={m.name} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-[var(--muted)]" />
                  <span className="text-[14px] font-medium text-[var(--fg)]">{m.name}</span>
                  <StatusPill label={m.status} tone={m.tone} className="ml-auto" />
                </div>
                <p className="mt-2 font-mono text-[11.5px] text-[var(--muted)]">{m.transport}</p>
                <p className="text-[11.5px] text-[var(--faint)]">scope: {m.scope}</p>
              </section>
            ))}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
          外部返回内容一律视为不可信数据，不能覆盖系统指令或绕过权限；危险写操作需要审批。
        </p>
      </div>
    </div>
  )
}
