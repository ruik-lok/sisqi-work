import { useState } from 'react'
import { Check, CloudDownload, Database, Fingerprint, KeyRound, Laptop, Moon, Palette, ShieldCheck, Sun, Tablet, Wand2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, Meter, Panel, StatusPill, Toggle } from '../../components/ui/primitives'
import { Dialog } from '../../components/ui/overlays'
import { THEME_OPTIONS, useNexus } from '../../state/store'
import { models, providers, usage } from '../../data/work'
import { devices } from '../../data/nexus'
import { deviceStatusLabel } from '../../lib/labels'

type Section = 'appearance' | 'models' | 'devices' | 'security' | 'backup' | 'about'

const SECTIONS: Array<{ id: Section; label: string; icon: typeof Palette }> = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'models', label: '模型与 API', icon: Wand2 },
  { id: 'devices', label: '设备', icon: Tablet },
  { id: 'security', label: '安全', icon: ShieldCheck },
  { id: 'backup', label: '备份与恢复', icon: CloudDownload },
  { id: 'about', label: '关于', icon: Fingerprint },
]

export function SettingsScreen({ onOpenApproval }: { onOpenApproval: () => void }) {
  const [section, setSection] = useState<Section>(() => ((new URLSearchParams(window.location.search).get('section') as Section | null) ?? 'models'))
  const { theme, setTheme, density, setDensity, providers: liveProviders, testProvider, toggleProvider, toast } = useNexus()
  const [restoreOpen, setRestoreOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      <aside className="hidden w-[220px] shrink-0 border-r border-[var(--line)] bg-[var(--surface)] py-4 md:block">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const active = section === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={active ? 'page' : undefined}
              className={cn('flex h-9 w-full items-center gap-2.5 px-4 text-[13.5px] transition-colors', active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]')}
            >
              <Icon size={15} />
              {s.label}
            </button>
          )
        })}
        <p className="mt-4 px-4 text-[11px] leading-relaxed text-[var(--faint)]">API Key 与模型配置是独立入口，不藏在普通设置子菜单里。</p>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto px-7 py-6">
        <div className="mx-auto max-w-[880px]">
          {section === 'appearance' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">外观</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">两套完整主题 Token，不做简单反色。中文用楷体，英文与数字用 Inter，代码用等宽。</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {THEME_OPTIONS.map((t) => {
                  const active = theme === t.id
                  const dark = t.id === 'dark'
                  const light = t.id === 'light'
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      aria-pressed={active}
                      className={cn('min-w-0 rounded-[var(--radius-lg)] border p-3 text-left transition-colors', active ? 'border-[var(--accent)]' : 'border-[var(--line)] hover:border-[var(--line-strong)]')}
                    >
                      <div className="flex h-[72px] items-stretch gap-1 rounded-[10px] border border-[var(--line)] p-1.5" style={{ background: light ? '#F4F7FC' : dark ? '#0C1422' : 'var(--surface-2)' }}>
                        <span className="flex flex-1 items-center justify-center rounded-[6px]" style={{ background: light ? '#FFFFFF' : dark ? '#121E30' : '#F4F7FC', color: light ? '#1769D2' : dark ? '#72B3FF' : '#8290A3' }}>
                          <Sun size={15} />
                        </span>
                        <span className="flex flex-1 items-center justify-center rounded-[6px]" style={{ background: light ? '#EAF0F8' : dark ? '#192940' : '#0C1422', color: light ? '#61738C' : dark ? '#9AABC4' : '#71839D' }}>
                          <Moon size={15} />
                        </span>
                        <span className="flex w-4 items-center justify-center rounded-[6px]" style={{ background: light ? '#1769D2' : dark ? '#72B3FF' : '#C3D2E4' }}>
                          <Laptop size={10} style={{ color: light ? '#fff' : '#06152A' }} />
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-[13px] text-[var(--fg)]">{t.label}</span>
                        <span className="text-[11px] text-[var(--faint)]">{active ? '当前' : t.hint}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <Panel className="mt-4 divide-y divide-[var(--line)]">
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-[var(--fg)]">界面密度</p>
                    <p className="text-[11.5px] text-[var(--faint)]">Lite 简洁入口，Pro 多面板；共用同一业务逻辑与数据</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant={density === 'lite' ? 'primary' : 'secondary'} onClick={() => setDensity('lite')}>
                      Lite
                    </Button>
                    <Button size="sm" variant={density === 'pro' ? 'primary' : 'secondary'} onClick={() => setDensity('pro')}>
                      Pro
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-[var(--fg)]">减少动效</p>
                    <p className="text-[11.5px] text-[var(--faint)]">跟随系统设置；不使用持续闪烁或弹跳</p>
                  </div>
                  <StatusPill label="跟随系统" tone="ok" />
                </div>
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-[var(--fg)]">实体表面</p>
                    <p className="text-[11.5px] text-[var(--faint)]">不透明面板、1px 边框、克制阴影；无毛玻璃与发光</p>
                  </div>
                  <Badge tone="ok">已启用</Badge>
                </div>
              </Panel>
            </>
          )}

          {section === 'models' && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold text-[var(--fg)]">模型与 API</h2>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">Provider 可扩展；密钥只以脱敏形式展示，Agent 默认只拿到受限引用。</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => toast({ title: '添加 Provider', detail: '可配置 Base URL、协议、认证头与模型列表', tone: 'neutral' })}>
                  添加 Provider
                </Button>
              </div>

              <div className="mt-4 space-y-2.5">
                {liveProviders.map((p) => {
                  const live = providers.find((x) => x.id === p.id) ?? p
                  return (
                    <section key={p.id} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium text-[var(--fg)]">{p.name}</span>
                        <Badge tone="neutral">{p.kind}</Badge>
                        <StatusPill
                          label={live.status === 'connected' ? '已连接' : live.status === 'unverified' ? '未验证' : '连接失败'}
                          tone={live.status === 'connected' ? 'ok' : live.status === 'unverified' ? 'warn' : 'danger'}
                        />
                        <span className="ml-auto flex items-center gap-2">
                          {live.latencyMs && <span className="num text-[11.5px] text-[var(--faint)]">{live.latencyMs}ms</span>}
                          <Toggle checked={p.enabled} onChange={() => toggleProvider(p.id)} label={`启用 ${p.name}`} />
                        </span>
                      </div>
                      <div className="mt-2 grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                        <p className="wrap-any font-mono text-[11.5px] text-[var(--muted)]">{p.baseUrl}</p>
                        <p className="font-mono text-[11.5px] text-[var(--faint)]">key {p.keyMasked}</p>
                        <p className="text-[11.5px] text-[var(--faint)]">模型 {p.models.join(' · ')}</p>
                        <p className="text-[11.5px] text-[var(--faint)]">
                          {p.route === 'proxy' ? '云端代理调用' : '本地直连'} · 最近测试 {live.lastTest ?? '从未'}
                        </p>
                      </div>
                      <div className="mt-2.5 flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => testProvider(p.id)}>
                          连接测试
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toast({ title: `${p.name} 密钥管理`, detail: '更新、轮换或撤销都会写入审计', tone: 'neutral' })}>
                          密钥
                        </Button>
                      </div>
                    </section>
                  )
                })}
              </div>

              <div className="mt-6">
                <div className="flex items-end justify-between">
                  <h3 className="text-[15px] font-semibold text-[var(--fg)]">模型</h3>
                  <span className="caption">能力来源：供应商元数据或实测，不按名称推断</span>
                </div>
                <div className="mt-2 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--line)] bg-[var(--surface-2)]">
                        {['模型', 'Provider', '上下文', '价格 /M', '能力', '状态'].map((h) => (
                          <th key={h} className="px-3 py-2 text-[11.5px] font-medium text-[var(--muted)]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {models.map((m) => (
                        <tr key={m.id} className="border-b border-[var(--line)] last:border-0">
                          <td className="px-3 py-2">
                            <span className="font-mono text-[12px] text-[var(--fg)]">{m.name}</span>
                            {m.isDefault && <Badge tone="accent" className="ml-2">默认</Badge>}
                          </td>
                          <td className="px-3 py-2 text-[11.5px] text-[var(--muted)]">{providers.find((p) => p.id === m.providerId)?.name}</td>
                          <td className="num px-3 py-2 text-[11.5px] text-[var(--muted)]">{m.contextK}k</td>
                          <td className="num px-3 py-2 text-[11.5px] text-[var(--muted)]">
                            ${m.priceIn} / ${m.priceOut}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-[var(--faint)]">{m.capabilities.join(' · ')}</td>
                          <td className="px-3 py-2">
                            <Badge tone={m.enabled ? 'ok' : 'neutral'}>{m.enabled ? '启用' : '停用'}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Panel className="p-4">
                  <p className="text-[15px] font-semibold text-[var(--fg)]">用量 · {usage.period}</p>
                  <div className="mt-2 grid grid-cols-2 gap-y-2 text-[12px]">
                    <Metric label="请求" value={usage.requests.toLocaleString()} />
                    <Metric label="平均延迟" value={`${usage.avgLatencyMs}ms`} />
                    <Metric label="输入 Token" value={`${(usage.inputTokens / 1_000_000).toFixed(2)}M`} />
                    <Metric label="输出 Token" value={`${(usage.outputTokens / 1_000).toFixed(0)}k`} />
                    <Metric label="成功率" value={`${usage.successRate}%`} />
                    <Metric label="费用" value={`$${usage.costUsd.toFixed(2)}`} />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">费用来源：{usage.costSource}。不与供应商账单混用。</p>
                </Panel>
                <Panel className="p-4">
                  <p className="text-[15px] font-semibold text-[var(--fg)]">模型使用</p>
                  <div className="mt-2 space-y-2">
                    {usage.byModel.map((u) => (
                      <div key={u.model}>
                        <div className="flex items-baseline justify-between">
                          <span className="font-mono text-[11.5px] text-[var(--muted)]">{u.model}</span>
                          <span className="num text-[11px] text-[var(--faint)]">{u.requests} 次 · ${u.cost.toFixed(2)}</span>
                        </div>
                        <Meter value={u.share} max={100} className="mt-1" />
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel className="mt-3 p-4">
                <p className="text-[13.5px] font-medium text-[var(--fg)]">密钥安全</p>
                <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-[var(--muted)]">
                  <li>· Android 端用 Keystore 加密存储；云端凭据独立密钥管理。</li>
                  <li>· 明文不写入数据库、项目文件、日志、崩溃报告或上下文摘要。</li>
                  <li>· 导出配置默认排除密钥；跨设备同步只同步引用或走重新授权。</li>
                  <li>· 支持禁用、撤销、更新、轮换与访问审计。</li>
                </ul>
                <Button size="sm" variant="secondary" className="mt-2.5" onClick={onOpenApproval}>
                  查看待审批的凭据请求
                </Button>
              </Panel>
            </>
          )}

          {section === 'devices' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">设备</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">两台设备独立 Root Provider 与授权；云端 Agent 默认没有设备 Root 权限。</p>
              <div className="mt-4 space-y-2.5">
                {devices.map((d) => (
                  <section key={d.id} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--fg)]">{d.name}</span>
                      <StatusPill label={deviceStatusLabel(d.status)} tone={d.status === 'ONLINE' ? 'ok' : d.status === 'BUSY' ? 'accent' : 'neutral'} />
                      <Badge tone="neutral" className="ml-auto">
                        {d.kind === 'phone' ? '默认 Lite' : d.kind === 'tablet' ? '默认 Pro' : '云端'}
                      </Badge>
                    </div>
                    <div className="mt-1.5 grid gap-x-6 gap-y-0.5 text-[11.5px] text-[var(--muted)] sm:grid-cols-2">
                      <p className="font-mono">
                        {d.model ?? '待检测'} · API {d.androidApi ?? '待检测'} · {d.coloros ?? '—'}
                      </p>
                      <p className="font-mono">
                        Root {d.rootAvailable === null ? '待检测' : d.rootAvailable ? '已授权' : '未授权'} · Provider {d.rootProvider ?? '待检测'}
                      </p>
                      <p>角色：{d.role}</p>
                      <p>最近心跳：{d.lastSeen}</p>
                    </div>
                  </section>
                ))}
              </div>
              <Panel className="mt-3 p-4">
                <p className="text-[13.5px] font-medium text-[var(--fg)]">同步边界</p>
                <div className="mt-1.5 grid gap-x-6 text-[12px] leading-relaxed text-[var(--muted)] sm:grid-cols-2">
                  <div>
                    <p className="text-[var(--fg)]">会同步</p>
                    <p>账户、项目索引、Agent 配置、任务事件、非敏感偏好</p>
                  </div>
                  <div>
                    <p className="text-[var(--fg)]">独立管理</p>
                    <p>本地文件、Runtime、Root 权限、设备身份、SSH 私钥与本地凭据</p>
                  </div>
                </div>
              </Panel>
            </>
          )}

          {section === 'security' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">安全</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">本地设备、云端控制面与 Sandbox 是三套独立安全域。</p>
              <div className="mt-4 space-y-2">
                {[
                  { icon: KeyRound, title: 'API Key 与凭据', value: 'Keystore 加密 · 脱敏展示 · 轮换与撤销', badge: '已保护' },
                  { icon: Database, title: 'SSH 私钥', value: '仅存本机，不参与同步与导出', badge: '未导出' },
                  { icon: ShieldCheck, title: '权限策略', value: '默认拒绝；Device:Request 单次批准；Privileged 需二次审批', badge: '默认拒绝' },
                  { icon: Fingerprint, title: '审计', value: '高风险操作与凭据访问写入审计，保留 90 天', badge: '已开启' },
                ].map((r) => {
                  const Icon = r.icon
                  return (
                    <section key={r.title} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                      <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)]">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-[var(--fg)]">{r.title}</p>
                        <p className="text-[11.5px] text-[var(--faint)]">{r.value}</p>
                      </div>
                      <Badge tone="ok">{r.badge}</Badge>
                    </section>
                  )
                })}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
                网页、README、代码注释、依赖提示与终端输出均视为不可信输入，不能覆盖系统指令。
              </p>
            </>
          )}

          {section === 'backup' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">备份与恢复</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">备份项目、配置、记忆、任务快照与非敏感连接器元数据；凭据单独加密管理。</p>
              <div className="mt-4 space-y-2">
                {[
                  { title: '导出备份', detail: '默认排除 API Key、SSH 私钥与 OAuth Token', action: '导出', tone: 'secondary' as const },
                  { title: '导入备份', detail: '先校验完整性，再显示覆盖范围', action: '导入', tone: 'secondary' as const },
                  { title: '恢复到检查点', detail: '恢复前显示目标范围、覆盖影响与回滚点', action: '恢复', tone: 'danger' as const },
                ].map((r) => (
                  <section key={r.title} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-[var(--fg)]">{r.title}</p>
                      <p className="text-[11.5px] text-[var(--faint)]">{r.detail}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={r.tone}
                      onClick={() => (r.title === '恢复到检查点' ? setRestoreOpen(true) : toast({ title: `${r.title}已开始`, detail: '完成后会校验完整性', tone: 'ok' }))}
                    >
                      {r.action}
                    </Button>
                  </section>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">凭据不会混入普通备份包；恢复需要二次确认。</p>
            </>
          )}

          {section === 'about' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">关于</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">思祁.Work · 让想法，真正成为作品。</p>
              <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                {[
                  ['应用版本', '2.0.0 (prototype)'],
                  ['规范基线', 'v2.0 · 2026-11'],
                  ['界面模式', density === 'pro' ? 'Pro' : 'Lite'],
                  ['主题', theme === 'system' ? '跟随系统' : theme === 'light' ? 'Arctic Blue' : 'Midnight Blue'],
                  ['构建目标', 'Kotlin · Jetpack Compose'],
                  ['测试口径', 'PASS / FAIL / NOT RUN / BLOCKED'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between border-b border-[var(--line)] py-1.5 text-[12.5px] last:border-0">
                    <span className="text-[var(--muted)]">{k}</span>
                    <span className="font-mono text-[var(--fg)]">{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">本界面为设计原型；能力状态以审计与真机证据为准，未验证项不标注为已支持。</p>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title="恢复到检查点"
        description="恢复会覆盖当前工作区文件，但保留可回滚点。"
        tone="danger"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setRestoreOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="danger"
              data-autofocus
              onClick={() => {
                setRestoreOpen(false)
                toast({ title: '恢复已排队', detail: '将先创建回滚点，再覆盖工作区', tone: 'warn' })
              }}
            >
              确认恢复
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
          <p>目标：nexus-core · 检查点 ckpt_0004（14:11）。</p>
          <p>影响：5 个文件将被覆盖，当前未提交改动会先保存为 patch。</p>
          <p className="flex items-center gap-1.5 text-[var(--ok)]">
            <Check size={13} /> 回滚点将以 ckpt_rollback_01 保存
          </p>
        </div>
      </Dialog>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--faint)]">{label}</p>
      <p className="num text-[13px] text-[var(--fg)]">{value}</p>
    </div>
  )
}
