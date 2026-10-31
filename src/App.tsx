import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  FolderKanban,
  MessagesSquare,
  Monitor,
  Moon,
  Plug,
  Settings2,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Square,
  Sun,
  Tablet,
} from 'lucide-react'
import { cn } from './lib/cn'
import { Wordmark } from './components/brand/Mark'
import { Badge, IconButton, Segmented, StatusPill } from './components/ui/primitives'
import { CommandPalette, Menu, MenuItem, ToastHost, type Command as Cmd } from './components/ui/overlays'
import { OverlayRoot } from './components/ui/overlay-root'
import { ApprovalDialog } from './components/panels/ApprovalDialog'
import { NexusProvider, THEME_OPTIONS, useNexus, type Density } from './state/store'
import { PadShell, type PadRoute } from './screens/pad/PadShell'
import { PhoneShell, type PhoneRoute } from './screens/phone/PhoneShell'
import { devices } from './data/nexus'

type Mode = 'pad' | 'phone' | 'pair' | 'desktop'

const PAD_W = 1280
const PAD_H = 800
const PHONE_W = 390
const PHONE_H = 844

function useFit(maxW: number, maxH: number, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let timer = 0
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 40 || rect.height < 40) return
      const s = Math.min(1, (rect.width - 8) / maxW, (rect.height - 8) / maxH)
      setScale(Math.max(0.28, s))
    }
    // 首帧可能尚未完成布局：rAF + 延时各补测一次，避免落到最小缩放
    raf = requestAnimationFrame(measure)
    timer = window.setTimeout(measure, 120)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { ref, scale }
}

function Screen({ children, w, h, scale, kind }: { children: ReactNode; w: number; h: number; scale: number; kind: 'pad' | 'phone' }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  return (
    <div className="shrink-0" style={{ width: w * scale, height: h * scale }}>
      <div
        data-screen-frame
        className={cn('relative origin-top-left overflow-hidden border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow-2)]', kind === 'pad' ? 'rounded-[14px]' : 'rounded-[30px]')}
        style={{ width: w, height: h, transform: `scale(${scale})` }}
      >
        <OverlayRoot.Provider value={host}>
          <div ref={setHost} className="h-full w-full">
            {children}
          </div>
        </OverlayRoot.Provider>
      </div>
    </div>
  )
}

function Stage() {
  const { theme, setTheme, density, setDensity, setPaletteOpen, task, approvals, decideApproval, streaming, stopStreaming, toast } = useNexus()
  const params = new URLSearchParams(window.location.search)
  const initialMode = (params.get('mode') as Mode | null) ?? (localStorage.getItem('sisqi.mode') as Mode | null) ?? (window.innerWidth < 760 ? 'phone' : 'pad')
  const [mode, setMode] = useState<Mode>(initialMode)
  const [padRoute, setPadRoute] = useState<PadRoute>((params.get('pad') as PadRoute | null) ?? 'chat')
  const [phoneRoute, setPhoneRoute] = useState<PhoneRoute>((params.get('phone') as PhoneRoute | null) ?? 'chat')
  const [needsApproval, setNeedsApproval] = useState(params.get('dialog') === 'approval')

  useEffect(() => localStorage.setItem('sisqi.mode', mode), [mode])
  useEffect(() => {
    if (params.get('palette') === '1') window.setTimeout(() => setPaletteOpen(true), 350)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const padFit = useFit(PAD_W, PAD_H, [mode])
  const phoneFit = useFit(PHONE_W, PHONE_H, [mode])
  const openApproval = useCallback(() => setNeedsApproval(true), [])
  const pending = approvals.filter((a) => a.status === 'PENDING').length
  const pad = devices[1]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPaletteOpen])

  const commands: Cmd[] = [
    { id: 'chat', label: '会话工作台', group: '跳转', icon: <MessagesSquare size={13} />, run: () => { setMode('pad'); setPadRoute('chat') } },
    { id: 'projects', label: '项目与编辑器', group: '跳转', icon: <FolderKanban size={13} />, run: () => { setMode('pad'); setPadRoute('projects') } },
    { id: 'agent', label: 'Agent 任务与时间线', group: '跳转', icon: <Sparkles size={13} />, run: () => { setMode('pad'); setPadRoute('agent') } },
    { id: 'connectors', label: '连接器与技能', group: '跳转', icon: <Plug size={13} />, run: () => { setMode('pad'); setPadRoute('connectors') } },
    { id: 'models', label: '模型与 API', group: '跳转', icon: <Settings2 size={13} />, run: () => { setMode('pad'); setPadRoute('settings') } },
    { id: 'phone-chat', label: '手机 · 会话', group: '手机', icon: <Smartphone size={13} />, run: () => { setMode('phone'); setPhoneRoute('chat') } },
    { id: 'phone-agent', label: '手机 · Agent', group: '手机', icon: <Smartphone size={13} />, run: () => { setMode('phone'); setPhoneRoute('agent') } },
    { id: 'approval', label: '查看待审批请求', group: '操作', hint: `${pending}`, icon: <ShieldAlert size={13} />, run: openApproval },
    { id: 'stop', label: streaming ? '停止生成' : '当前没有进行中的生成', group: '操作', icon: <Square size={13} />, run: streaming ? stopStreaming : () => toast({ title: '没有正在生成的回复', tone: 'neutral' }) },
    { id: 'density', label: density === 'pro' ? '切换到 Lite 界面' : '切换到 Pro 界面', group: '操作', icon: <Monitor size={13} />, run: () => setDensity(density === 'pro' ? 'lite' : 'pro') },
    { id: 'mode-pad', label: '预览：平板', group: '预览', icon: <Tablet size={13} />, run: () => setMode('pad') },
    { id: 'mode-phone', label: '预览：手机', group: '预览', icon: <Smartphone size={13} />, run: () => setMode('phone') },
    { id: 'mode-pair', label: '预览：双设备', group: '预览', icon: <Monitor size={13} />, run: () => setMode('pair') },
    ...THEME_OPTIONS.map<Cmd>((t) => ({
      id: `theme-${t.id}`,
      label: `外观：${t.label}`,
      group: '外观',
      hint: t.hint,
      icon: theme === t.id ? <Sun size={13} /> : <Moon size={13} />,
      run: () => setTheme(t.id),
    })),
    { id: 'approve-now', label: `批准当前请求`, group: '操作', icon: <Check size={13} />, run: () => (approvals[0] ? decideApproval(approvals[0].id, 'APPROVED') : toast({ title: '没有待审批请求', tone: 'neutral' })) },
  ]

  if (mode === 'desktop') {
    return (
      <div className="flex h-full min-h-0 bg-[var(--bg)]">
        <div className="min-w-0 flex-1">
          <PadShell route={padRoute} setRoute={setPadRoute} onOpenApproval={openApproval} />
        </div>
        <ApprovalDialog open={needsApproval} onClose={() => setNeedsApproval(false)} />
        <CommandPalette commands={commands} />
        <ToastHost />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4">
        <Wordmark />
        <span className="hidden items-center gap-2 sm:flex">
          <Badge tone="neutral">v2.0</Badge>
          <span className="hidden text-[12px] text-[var(--faint)] lg:inline">让想法，真正成为作品。</span>
        </span>

        <div className="mx-auto hidden md:block">
          <Segmented<Mode>
            label="预览设备"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'pad', label: <><Tablet size={12} /> Pad Pro</> },
              { value: 'phone', label: <><Smartphone size={12} /> Reno12</> },
              { value: 'pair', label: <><Monitor size={12} /> 双设备</> },
            ]}
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="hidden md:block">
            <Segmented<Density>
              label="界面模式"
              value={density}
              onChange={setDensity}
              options={[
                { value: 'lite', label: 'Lite' },
                { value: 'pro', label: 'Pro' },
              ]}
            />
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-1 hidden h-9 items-center gap-1.5 rounded-[10px] border border-[var(--line)] px-2.5 text-[12px] text-[var(--faint)] transition-colors hover:text-[var(--muted)] sm:flex"
          >
            ⌘K
          </button>
          <Menu
            label="外观"
            trigger={({ toggle, open }) => (
              <button onClick={toggle} aria-expanded={open} className="flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--line)] px-2.5 text-[12px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]">
                {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                <span className="hidden sm:inline">{THEME_OPTIONS.find((t) => t.id === theme)?.label}</span>
                <ChevronDown size={12} />
              </button>
            )}
          >
            {(close) => (
              <>
                <p className="label px-2 py-1">外观</p>
                {THEME_OPTIONS.map((t) => (
                  <MenuItem
                    key={t.id}
                    selected={theme === t.id}
                    onSelect={() => {
                      setTheme(t.id)
                      close()
                    }}
                    hint={t.hint}
                  >
                    {t.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
          <IconButton label="待审批" onClick={openApproval} className="relative">
            <ShieldAlert size={17} />
            {pending > 0 && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--warn)]" />}
          </IconButton>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="relative flex h-full items-stretch gap-4 px-4 py-3">
          {(mode === 'pad' || mode === 'pair') && (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div ref={padFit.ref} className="flex min-h-0 w-full flex-1 items-center justify-center">
                <Screen w={PAD_W} h={PAD_H} scale={padFit.scale} kind="pad">
                  <PadShell route={padRoute} setRoute={setPadRoute} onOpenApproval={openApproval} />
                </Screen>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--faint)]">
                <Tablet size={11} />
                <span>Pad Pro · 1280×800 · Pro 模式三栏</span>
                <StatusPill label={pad.status} tone="accent" />
                <span>· {pad.role.split(' · ')[0]}</span>
              </div>
            </div>
          )}

          {(mode === 'phone' || mode === 'pair') && (
            <div className={cn('flex shrink-0 flex-col items-center gap-2', mode === 'pair' ? 'w-[300px]' : 'flex-1')}>
              <div ref={phoneFit.ref} className="flex min-h-0 w-full flex-1 items-center justify-center">
                <Screen w={PHONE_W} h={PHONE_H} scale={phoneFit.scale} kind="phone">
                  <PhoneShell route={phoneRoute} setRoute={setPhoneRoute} onOpenApproval={openApproval} />
                </Screen>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-[var(--faint)]">
                <Smartphone size={11} />
                <span>Reno12 · 390×844 · 默认 Lite</span>
              </div>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 sm:block">
          <p className="max-w-[92vw] truncate rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[10.5px] text-[var(--faint)]">
            规范基线 v2.0 · 实体表面、无毛玻璃 · 未实测字段显示「待检测」· 演示数据不代替真机证据
          </p>
        </div>
      </div>

      <ApprovalDialog open={needsApproval} onClose={() => setNeedsApproval(false)} />
      <CommandPalette commands={commands} />
      <ToastHost />
      <div className="sr-only" aria-live="polite">
        {task.id} · {task.status}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <NexusProvider>
      <Stage />
    </NexusProvider>
  )
}
