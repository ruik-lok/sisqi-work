import { useRef, useState } from 'react'
import {
  Check,
  CloudDownload,
  Cpu,
  Database,
  Fingerprint,
  KeyRound,
  Laptop,
  Moon,
  Palette,
  Pencil,
  Plus,
  ShieldCheck,
  Sun,
  Tablet,
  Trash2,
  Wand2,
  Zap,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, IconButton, Panel, StatusPill, Toggle } from '../../components/ui/primitives'
import { Dialog } from '../../components/ui/overlays'
import { THEME_OPTIONS, useNexus } from '../../state/store'
import { devices } from '../../data/nexus'
import { deviceStatusLabel } from '../../lib/labels'
import { isDesktop, isEncryptedStore, isNativeShell, runtimeLabel, secretStorageLabel } from '../../lib/secrets'

type Section = 'appearance' | 'models' | 'devices' | 'security' | 'backup' | 'about'

const SECTIONS: Array<{ id: Section; label: string; icon: typeof Palette }> = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'models', label: '模型与 API', icon: Wand2 },
  { id: 'devices', label: '设备', icon: Tablet },
  { id: 'security', label: '安全', icon: ShieldCheck },
  { id: 'backup', label: '备份与恢复', icon: CloudDownload },
  { id: 'about', label: '关于', icon: Fingerprint },
]

const KINDS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'openai', label: 'OpenAI', hint: 'api.openai.com/v1' },
  { value: 'deepseek', label: 'DeepSeek', hint: 'api.deepseek.com/v1' },
  { value: 'compatible', label: 'OpenAI 兼容', hint: '自建网关 / 其他兼容服务' },
]

const inputCls =
  'h-10 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 text-[13px] text-[var(--fg)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:outline-none'

export function SettingsScreen({ onOpenApproval }: { onOpenApproval: () => void }) {
  const [section, setSection] = useState<Section>(() => (new URLSearchParams(window.location.search).get('section') as Section | null) ?? 'models')
  const store = useNexus()
  const {
    theme,
    setTheme,
    density,
    setDensity,
    toast,
    providers,
    models,
    modelId,
    usage,
    resetUsage,
    addProvider,
    updateProvider,
    removeProvider,
    setProviderKey,
    clearProviderKey,
    testProvider,
    toggleProvider,
    addModel,
    updateModel,
    removeModel,
    setDefaultModel,
    exportData,
    importData,
  } = store

  const [providerEditor, setProviderEditor] = useState<{ mode: 'add' | 'edit'; id?: string; name: string; kind: string; baseUrl: string; route: 'direct' | 'proxy' } | null>(null)
  const [keyEditor, setKeyEditor] = useState<{ id: string; key: string } | null>(null)
  const [modelEditor, setModelEditor] = useState<{ mode: 'add' | 'edit'; id?: string; name: string; providerId: string; contextK: number; priceIn: number; priceOut: number } | null>(null)
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'provider' | 'model'; id: string; label: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const openAddProvider = () =>
    setProviderEditor({ mode: 'add', name: '', kind: 'compatible', baseUrl: 'https://api.example.com/v1', route: 'direct' })

  const openEditProvider = (id: string) => {
    const p = providers.find((x) => x.id === id)
    if (!p) return
    setProviderEditor({ mode: 'edit', id, name: p.name, kind: p.kind, baseUrl: p.baseUrl, route: p.route })
  }

  const saveProvider = () => {
    if (!providerEditor) return
    if (!providerEditor.name.trim() || !providerEditor.baseUrl.trim()) {
      toast({ title: '名称与 Base URL 必填', tone: 'warn' })
      return
    }
    const payload = {
      name: providerEditor.name.trim(),
      kind: providerEditor.kind as 'openai' | 'compatible' | 'deepseek',
      baseUrl: providerEditor.baseUrl.trim().replace(/\/+$/, ''),
      route: providerEditor.route,
      enabled: true,
      models: [],
    }
    if (providerEditor.mode === 'add') {
      const id = addProvider(payload)
      setProviderEditor(null)
      setKeyEditor({ id, key: '' })
    } else if (providerEditor.id) {
      updateProvider(providerEditor.id, { name: payload.name, kind: payload.kind, baseUrl: payload.baseUrl, route: payload.route })
      setProviderEditor(null)
      toast({ title: 'Provider 已更新', tone: 'ok' })
    }
  }

  const saveKey = async () => {
    if (!keyEditor) return
    await setProviderKey(keyEditor.id, keyEditor.key)
    toast({ title: keyEditor.key ? '密钥已保存' : '密钥已清除', detail: isEncryptedStore() ? '使用系统加密存储' : '浏览器预览下仅保存在本机 localStorage', tone: 'ok' })
    setKeyEditor(null)
  }

  const runTest = async (id: string) => {
    setTesting((prev) => ({ ...prev, [id]: true }))
    await testProvider(id)
    setTesting((prev) => ({ ...prev, [id]: false }))
  }

  const saveModel = () => {
    if (!modelEditor) return
    if (!modelEditor.name.trim()) {
      toast({ title: '模型名称必填', tone: 'warn' })
      return
    }
    const payload = {
      name: modelEditor.name.trim(),
      providerId: modelEditor.providerId,
      contextK: Number(modelEditor.contextK) || 128,
      priceIn: Number(modelEditor.priceIn) || 0,
      priceOut: Number(modelEditor.priceOut) || 0,
      capabilities: ['文本'] as ModelInfoCaps,
      enabled: true,
      capabilitySource: '实测' as const,
    }
    if (modelEditor.mode === 'add') {
      addModel(payload)
      toast({ title: '模型已添加', tone: 'ok' })
    } else if (modelEditor.id) {
      updateModel(modelEditor.id, payload)
      toast({ title: '模型已更新', tone: 'ok' })
    }
    setModelEditor(null)
  }

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sisqi-work-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: '备份已导出', detail: '不含 API Key 与任何凭据', tone: 'ok' })
  }

  const doImport = async (file: File) => {
    const text = await file.text()
    const res = importData(text)
    toast({ title: res.ok ? '备份已导入' : '导入失败', detail: res.message, tone: res.ok ? 'ok' : 'danger' })
  }

  const activeProvider = providers.find((p) => p.id === models.find((m) => m.id === modelId)?.providerId)

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
        <p className="mt-4 px-4 text-[11px] leading-relaxed text-[var(--faint)]">
          {isDesktop() ? '桌面版：密钥用系统加密存储' : isNativeShell() ? 'APK：密钥用 Android Keystore 加密' : '浏览器预览：密钥只存在本机'}
        </p>
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
                  const light = t.id === 'light'
                  const dark = t.id === 'dark'
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
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    目前支持 OpenAI 兼容协议。当前默认：<span className="font-mono text-[var(--fg)]">{models.find((m) => m.id === modelId)?.name ?? '未选择'}</span>
                    {activeProvider ? ` · ${activeProvider.keyMasked}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={openAddProvider}>
                  添加 Provider
                </Button>
              </div>

              <div className="mt-4 space-y-2.5">
                {providers.map((p) => (
                  <section key={p.id} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--fg)]">{p.name}</span>
                      <Badge tone="neutral">{KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}</Badge>
                      <StatusPill
                        label={testing[p.id] ? '测试中…' : p.status === 'connected' ? '已连接' : p.status === 'error' ? '连接失败' : '未验证'}
                        tone={testing[p.id] ? 'accent' : p.status === 'connected' ? 'ok' : p.status === 'error' ? 'danger' : 'warn'}
                        pulse={testing[p.id]}
                      />
                      {!p.enabled && <Badge tone="neutral">已停用</Badge>}
                      <span className="ml-auto flex items-center gap-2">
                        {p.latencyMs !== null && <span className="num text-[11.5px] text-[var(--faint)]">{p.latencyMs}ms</span>}
                        <Toggle checked={p.enabled} onChange={() => toggleProvider(p.id)} label={`启用 ${p.name}`} />
                      </span>
                    </div>

                    <div className="mt-2 grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                      <p className="wrap-any font-mono text-[11.5px] text-[var(--muted)]">{p.baseUrl}</p>
                      <p className="wrap-any font-mono text-[11.5px] text-[var(--faint)]">key {p.keyMasked}</p>
                      <p className="text-[11.5px] text-[var(--faint)]">{p.route === 'proxy' ? '云端代理调用' : '本地直连'} · 最近测试 {p.lastTest ?? '从未'}</p>
                      <p className="text-[11.5px] text-[var(--faint)]">模型：{p.models.length ? p.models.slice(0, 3).join(' · ') : '尚未拉取'}</p>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => runTest(p.id)} disabled={Boolean(testing[p.id])} icon={<Zap size={13} />}>
                        {testing[p.id] ? '测试中…' : '连接测试'}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<KeyRound size={13} />} onClick={() => setKeyEditor({ id: p.id, key: '' })}>
                        {p.keyMasked === '未配置' ? '设置密钥' : '更新密钥'}
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => openEditProvider(p.id)}>
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 size={13} />}
                        onClick={() => setConfirmDelete({ type: 'provider', id: p.id, label: p.name })}
                        className="text-[var(--faint)] hover:text-[var(--danger)]"
                      >
                        删除
                      </Button>
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--fg)]">模型</h3>
                    <p className="mt-0.5 text-[11.5px] text-[var(--faint)]">用于会话的模型列表；只有启用的模型会出现在输入框选择器里。</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus size={14} />}
                    onClick={() =>
                      setModelEditor({
                        mode: 'add',
                        name: '',
                        providerId: providers[0]?.id ?? '',
                        contextK: 128,
                        priceIn: 0,
                        priceOut: 0,
                      })
                    }
                  >
                    添加模型
                  </Button>
                </div>

                <div className="mt-2 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--line)] bg-[var(--surface-2)]">
                        {['模型', 'Provider', '上下文', '价格 /M', '能力', '默认', '启用', ''].map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2 text-[11.5px] font-medium text-[var(--muted)]">
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
                            {m.id === modelId && <Badge tone="accent" className="ml-2">当前</Badge>}
                          </td>
                          <td className="px-3 py-2 text-[11.5px] text-[var(--muted)]">{providers.find((p) => p.id === m.providerId)?.name ?? '—'}</td>
                          <td className="num px-3 py-2 text-[11.5px] text-[var(--muted)]">{m.contextK}k</td>
                          <td className="num px-3 py-2 text-[11.5px] text-[var(--muted)]">
                            ${m.priceIn} / ${m.priceOut}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-[var(--faint)]">{m.capabilities.join(' · ')}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => setDefaultModel(m.id)}
                              aria-label={`设为默认模型 ${m.name}`}
                              className={cn('grid size-5 place-items-center rounded-full border', m.id === modelId ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line-strong)] text-transparent hover:text-[var(--faint)]')}
                            >
                              <Check size={11} />
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <Toggle checked={m.enabled} onChange={(v) => updateModel(m.id, { enabled: v })} label={`启用 ${m.name}`} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-0.5">
                              <IconButton
                                label={`编辑模型 ${m.name}`}
                                size="sm"
                                onClick={() =>
                                  setModelEditor({ mode: 'edit', id: m.id, name: m.name, providerId: m.providerId, contextK: m.contextK, priceIn: m.priceIn, priceOut: m.priceOut })
                                }
                              >
                                <Pencil size={13} />
                              </IconButton>
                              <IconButton label={`删除模型 ${m.name}`} size="sm" onClick={() => setConfirmDelete({ type: 'model', id: m.id, label: m.name })}>
                                <Trash2 size={13} />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <Panel className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-semibold text-[var(--fg)]">用量（本机统计）</p>
                    <Button size="sm" variant="ghost" onClick={resetUsage}>
                      清零
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-y-2 text-[12px]">
                    <Metric label="请求" value={usage.requests.toLocaleString()} />
                    <Metric label="最近延迟" value={usage.lastLatencyMs ? `${usage.lastLatencyMs}ms` : '—'} />
                    <Metric label="输入 Token" value={formatTokens(usage.promptTokens)} />
                    <Metric label="输出 Token" value={formatTokens(usage.completionTokens)} />
                    <Metric label="费用" value={`$${usage.costUsd.toFixed(3)}`} />
                    <Metric label="最近错误" value={usage.lastErrorAt ?? '—'} />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">费用按模型单价估算，仅统计本机发出的成功请求；不等同于供应商账单。</p>
                </Panel>
                <Panel className="p-4">
                  <p className="text-[15px] font-semibold text-[var(--fg)]">连接与安全</p>
                  <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-[var(--muted)]">
                    <li>· 密钥保存位置：{secretStorageLabel()}。</li>
                    <li>· 界面只显示前 4 位与后 4 位，日志与错误信息不含密钥。</li>
                    <li>· 请求由本机直接发往你填写的 Base URL，不经过中转服务。</li>
                    <li>· 仅支持 OpenAI 兼容的 <span className="font-mono">/chat/completions</span> 流式协议。</li>
                  </ul>
                  <Button size="sm" variant="secondary" className="mt-2.5" onClick={onOpenApproval}>
                    查看待审批的凭据请求
                  </Button>
                </Panel>
              </div>
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
            </>
          )}

          {section === 'security' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">安全</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">本地设备、云端控制面与 Sandbox 是三套独立安全域。</p>
              <div className="mt-4 space-y-2">
                {[
                  { icon: KeyRound, title: 'API Key 与凭据', value: isEncryptedStore() ? '系统加密存储 · 脱敏展示 · 可清除' : '本机 localStorage · 脱敏展示 · 可清除', badge: isEncryptedStore() ? '已加密' : '仅本机' },
                  { icon: Database, title: '数据存储', value: '会话、消息与设置在浏览器/应用本地保存，不上传', badge: '本地' },
                  { icon: ShieldCheck, title: '请求路径', value: '浏览器/应用直接请求你填写的 Base URL，无中转服务', badge: '直连' },
                  { icon: Fingerprint, title: '日志', value: '错误信息只保留状态码与响应摘要，不含密钥', badge: '已脱敏' },
                ].map((r) => {
                  const Icon = r.icon
                  return (
                    <section key={r.title} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                      <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)]">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] text-[var(--fg)]">{r.title}</p>
                        <p className="wrap-any text-[11.5px] text-[var(--faint)]">{r.value}</p>
                      </div>
                      <Badge tone="ok">{r.badge}</Badge>
                    </section>
                  )
                })}
              </div>
            </>
          )}

          {section === 'backup' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">备份与恢复</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">导出会话、模型配置与用量；不包含 API Key 与任何凭据。</p>
              <div className="mt-4 space-y-2">
                <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-[var(--fg)]">导出备份</p>
                    <p className="text-[11.5px] text-[var(--faint)]">生成 JSON 文件：会话、消息、Provider、模型、外观与用量</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={doExport}>
                    导出
                  </Button>
                </section>
                <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-[var(--fg)]">导入备份</p>
                    <p className="text-[11.5px] text-[var(--faint)]">覆盖当前会话与配置；密钥保持本机原值</p>
                  </div>
                  <input
                    ref={importRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) await doImport(file)
                      if (importRef.current) importRef.current.value = ''
                    }}
                  />
                  <Button size="sm" variant="secondary" onClick={() => importRef.current?.click()}>
                    选择文件
                  </Button>
                </section>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">重新安装或换设备时，请先导出备份；API Key 需在新设备重新填写。</p>
            </>
          )}

          {section === 'about' && (
            <>
              <h2 className="text-[20px] font-semibold text-[var(--fg)]">关于</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">思祁.Work · 让想法，真正成为作品。</p>
              <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                {[
                  ['应用版本', '2.1.0 (prototype)'],
                  ['规范基线', 'v2.0 · 2026-11'],
                  ['运行环境', runtimeLabel()],
                  ['界面模式', density === 'pro' ? 'Pro' : 'Lite'],
                  ['主题', theme === 'system' ? '跟随系统' : theme === 'light' ? 'Arctic Blue' : 'Midnight Blue'],
                  ['对话协议', 'OpenAI 兼容 /chat/completions（SSE）'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between border-b border-[var(--line)] py-1.5 text-[12.5px] last:border-0">
                    <span className="text-[var(--muted)]">{k}</span>
                    <span className="font-mono text-[var(--fg)]">{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">原型中的 Agent 任务、设备与审批为演示数据；会话与模型调用为本机真实功能。</p>
            </>
          )}
        </div>
      </div>

      {/* Provider 编辑 */}
      <Dialog
        open={Boolean(providerEditor)}
        onClose={() => setProviderEditor(null)}
        title={providerEditor?.mode === 'add' ? '添加 Provider' : '编辑 Provider'}
        description="只支持 OpenAI 兼容协议；Base URL 通常以 /v1 结尾。"
        width="max-w-[560px]"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setProviderEditor(null)}>
              取消
            </Button>
            <Button size="sm" variant="primary" data-autofocus onClick={saveProvider}>
              保存
            </Button>
          </>
        }
      >
        {providerEditor && (
          <div className="space-y-3">
            <Field label="名称">
              <input
                value={providerEditor.name}
                onChange={(e) => setProviderEditor({ ...providerEditor, name: e.target.value })}
                placeholder="例如：OpenAI / 自建网关"
                className={inputCls}
              />
            </Field>
            <Field label="类型">
              <div className="grid grid-cols-3 gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setProviderEditor({ ...providerEditor, kind: k.value })}
                    className={cn(
                      'rounded-[10px] border px-2 py-2 text-left text-[12px] transition-colors',
                      providerEditor.kind === k.value ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--fg)]',
                    )}
                  >
                    <span className="block font-medium">{k.label}</span>
                    <span className="mt-0.5 block text-[10.5px] text-[var(--faint)]">{k.hint}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Base URL">
              <input
                value={providerEditor.baseUrl}
                onChange={(e) => setProviderEditor({ ...providerEditor, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className={cn(inputCls, 'font-mono text-[12.5px]')}
              />
            </Field>
            <p className="text-[11px] leading-relaxed text-[var(--faint)]">Anthropic / Gemini 原生协议尚未接入；可先用其 OpenAI 兼容端点，或等待后续版本。</p>
          </div>
        )}
      </Dialog>

      {/* 密钥 */}
      <Dialog
        open={Boolean(keyEditor)}
        onClose={() => setKeyEditor(null)}
        title="设置 API Key"
        description={isEncryptedStore() ? `${secretStorageLabel()}；界面只显示掩码。` : '浏览器预览下保存在本机 localStorage；桌面版与 APK 会用系统加密存储。'}
        width="max-w-[520px]"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setKeyEditor(null)}>
              取消
            </Button>
            {keyEditor && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await clearProviderKey(keyEditor.id)
                  toast({ title: '密钥已清除', tone: 'neutral' })
                  setKeyEditor(null)
                }}
              >
                清除
              </Button>
            )}
            <Button size="sm" variant="primary" data-autofocus onClick={saveKey}>
              保存
            </Button>
          </>
        }
      >
        {keyEditor && (
          <div className="space-y-3">
            <Field label="API Key">
              <input
                type="password"
                value={keyEditor.key}
                onChange={(e) => setKeyEditor({ ...keyEditor, key: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                className={cn(inputCls, 'font-mono text-[12.5px]')}
              />
            </Field>
            <p className="text-[11px] leading-relaxed text-[var(--faint)]">留空保存等同于清除。密钥不会写入项目文件、导出备份或错误日志。</p>
          </div>
        )}
      </Dialog>

      {/* 模型编辑 */}
      <Dialog
        open={Boolean(modelEditor)}
        onClose={() => setModelEditor(null)}
        title={modelEditor?.mode === 'add' ? '添加模型' : '编辑模型'}
        description="名称需要与 Provider 实际的模型 ID 一致，例如 gpt-5.2、deepseek-reasoner。"
        width="max-w-[560px]"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setModelEditor(null)}>
              取消
            </Button>
            <Button size="sm" variant="primary" data-autofocus onClick={saveModel}>
              保存
            </Button>
          </>
        }
      >
        {modelEditor && (
          <div className="space-y-3">
            <Field label="模型 ID">
              <input value={modelEditor.name} onChange={(e) => setModelEditor({ ...modelEditor, name: e.target.value })} placeholder="gpt-5.2" className={cn(inputCls, 'font-mono text-[12.5px]')} />
            </Field>
            <Field label="Provider">
              <select
                value={modelEditor.providerId}
                onChange={(e) => setModelEditor({ ...modelEditor, providerId: e.target.value })}
                className={inputCls}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="上下文 (k)">
                <input type="number" value={modelEditor.contextK} onChange={(e) => setModelEditor({ ...modelEditor, contextK: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="输入 $/M">
                <input type="number" step="0.01" value={modelEditor.priceIn} onChange={(e) => setModelEditor({ ...modelEditor, priceIn: Number(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="输出 $/M">
                <input type="number" step="0.01" value={modelEditor.priceOut} onChange={(e) => setModelEditor({ ...modelEditor, priceOut: Number(e.target.value) })} className={inputCls} />
              </Field>
            </div>
          </div>
        )}
      </Dialog>

      {/* 删除确认 */}
      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.type === 'provider' ? '删除 Provider' : '删除模型'}
        description={confirmDelete?.type === 'provider' ? '会同时删除该 Provider 下的模型与本机保存的密钥。' : '只从本机模型列表中移除。'}
        tone="danger"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="danger"
              data-autofocus
              onClick={() => {
                if (!confirmDelete) return
                if (confirmDelete.type === 'provider') removeProvider(confirmDelete.id)
                else removeModel(confirmDelete.id)
                setConfirmDelete(null)
              }}
            >
              删除
            </Button>
          </>
        }
      >
        <p className="wrap-any text-[13px] leading-relaxed text-[var(--muted)]">确定删除「{confirmDelete?.label}」吗？</p>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      {children}
    </label>
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

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

type ModelInfoCaps = Array<'文本' | '视觉' | '工具' | '结构化' | '推理'>

export { Cpu }
