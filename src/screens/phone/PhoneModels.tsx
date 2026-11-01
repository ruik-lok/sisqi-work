import { useState } from 'react'
import { Check, ChevronRight, KeyRound, Zap } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge, Button, StatusPill } from '../../components/ui/primitives'
import { Dialog } from '../../components/ui/overlays'
import { useNexus } from '../../state/store'
import { isEncryptedStore, secretStorageLabel } from '../../lib/secrets'
import type { Provider } from '../../data/work'

/**
 * 手机端「模型与 API」：改 Base URL、写/清 API Key、连接测试、选默认模型。
 * 密钥经 secretStore() 落到 Keystore（APK）/ safeStorage（桌面）/ localStorage（浏览器），界面只显示掩码。
 */
export function PhoneModels() {
  const { providers, models, modelId, setDefaultModel, updateProvider, setProviderKey, clearProviderKey, testProvider, toast } = useNexus()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  const editing = providers.find((p) => p.id === editingId) ?? null
  const activeModel = models.find((m) => m.id === modelId)

  const open = (p: Provider) => {
    setEditingId(p.id)
    setBaseUrl(p.baseUrl)
    setKey('')
  }

  const persist = async (p: Provider) => {
    const nextUrl = baseUrl.trim()
    if (nextUrl && nextUrl !== p.baseUrl) updateProvider(p.id, { baseUrl: nextUrl })
    if (key.trim()) await setProviderKey(p.id, key.trim())
    setKey('')
  }

  const save = async () => {
    if (!editing) return
    const hadKey = Boolean(key.trim())
    setBusy(true)
    try {
      await persist(editing)
      toast({ title: '已保存', detail: hadKey ? `密钥已写入${isEncryptedStore() ? '加密存储' : '本机存储'}` : 'Base URL 已更新', tone: 'ok' })
      setEditingId(null)
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    if (!editing) return
    setBusy(true)
    try {
      await persist(editing)
      await testProvider(editing.id, { baseUrl: baseUrl.trim() || editing.baseUrl, key: key.trim() || undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="mt-2 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] text-[var(--fg)]">模型与 API</span>
          <Badge tone="neutral" className="ml-auto font-mono">{activeModel?.name ?? '未选择'}</Badge>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--faint)]">
          密钥保存在{secretStorageLabel()}，界面只显示掩码。
        </p>

        <div className="mt-2 space-y-1.5">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p)}
              className="flex w-full items-center gap-2.5 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-left"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[var(--surface-2)] text-[var(--faint)]">
                <KeyRound size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-[var(--fg)]">{p.name}</span>
                <span className="block truncate font-mono text-[10.5px] text-[var(--faint)]">{p.baseUrl}</span>
              </span>
              <StatusPill
                label={p.status === 'connected' ? '已连接' : p.status === 'error' ? '失败' : p.keyMasked === '未配置' ? '无密钥' : '未验证'}
                tone={p.status === 'connected' ? 'ok' : p.status === 'error' ? 'danger' : 'warn'}
              />
              <ChevronRight size={14} className="shrink-0 text-[var(--faint)]" />
            </button>
          ))}
        </div>

        <div className="mt-3">
          <p className="label">默认模型</p>
          <div className="mt-1 space-y-1">
            {models.map((m) => {
              const active = m.id === modelId
              const provider = providers.find((p) => p.id === m.providerId)
              return (
                <button
                  key={m.id}
                  onClick={() => setDefaultModel(m.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
                    active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)]',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{m.name}</span>
                  <span className="shrink-0 text-[10.5px] text-[var(--faint)]">{provider?.name ?? '—'}</span>
                  {active && <Check size={13} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <Dialog
        open={Boolean(editing)}
        onClose={() => (busy ? undefined : setEditingId(null))}
        title={`${editing?.name ?? ''} · 连接设置`}
        description="只支持 OpenAI 兼容的 /chat/completions；Base URL 通常以 /v1 结尾。"
        footer={
          <>
            {editing && editing.keyMasked !== '未配置' && (
              <Button
                size="sm"
                variant="ghost"
                className="mr-auto"
                onClick={async () => {
                  await clearProviderKey(editing.id)
                  toast({ title: '密钥已清除', tone: 'neutral' })
                  setEditingId(null)
                }}
              >
                清除密钥
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
              取消
            </Button>
            <Button size="sm" variant="secondary" icon={<Zap size={13} />} onClick={test} disabled={busy}>
              {busy ? '测试中…' : '连接测试'}
            </Button>
            <Button size="sm" variant="primary" data-autofocus onClick={save} disabled={busy}>
              保存
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <label className="block">
              <span className="label mb-1 block">Base URL</span>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                className="h-10 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 font-mono text-[12.5px] text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="label mb-1 block">API Key</span>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={editing.keyMasked === '未配置' ? 'sk-...' : `已保存 ${editing.keyMasked}（留空则不修改）`}
                autoComplete="off"
                className="h-10 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 font-mono text-[12.5px] text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <StatusPill
                label={editing.status === 'connected' ? '已连接' : editing.status === 'error' ? '连接失败' : '未验证'}
                tone={editing.status === 'connected' ? 'ok' : editing.status === 'error' ? 'danger' : 'warn'}
              />
              <span className="text-[11px] text-[var(--faint)]">
                {editing.lastTest ? `最近测试 ${editing.lastTest}` : '尚未测试'}
                {editing.latencyMs ? ` · ${editing.latencyMs}ms` : ''}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--faint)]">
              密钥不会写入会话、导出备份或错误日志；保存后立即生效。
            </p>
          </div>
        )}
      </Dialog>
    </>
  )
}
