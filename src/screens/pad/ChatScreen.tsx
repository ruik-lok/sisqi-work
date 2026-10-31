import { useState } from 'react'
import { ChevronDown, MessageSquarePlus, PanelLeft, Sparkles } from 'lucide-react'
import { Badge, Button, IconButton, Segmented, StatusPill } from '../../components/ui/primitives'
import { BottomSheet } from '../../components/ui/overlays'
import { ChatErrorBanner, ChatThread, Composer, ContextPanel, SessionList } from '../../components/chat/Chat'
import { useNexus, type Density } from '../../state/store'

export function ChatScreen({ onOpenApproval, onOpenSettings }: { onOpenApproval: () => void; onOpenSettings: () => void }) {
  const { activeSession, messages, density: d, setDensity, newSession, demoMode, toast, sendMessage, streaming } = useNexus()
  const [historyOpen, setHistoryOpen] = useState(false)

  if (d === 'lite') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4">
          <Button size="sm" variant="ghost" icon={<PanelLeft size={15} />} onClick={() => setHistoryOpen(true)}>
            会话历史
          </Button>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--fg)]">{activeSession.title}</span>
          <Segmented<Density>
            label="界面模式"
            size="xs"
            value={d}
            onChange={setDensity}
            options={[
              { value: 'lite', label: 'Lite' },
              { value: 'pro', label: 'Pro' },
            ]}
          />
        </div>
        <ChatThread />
        <ChatErrorBanner onOpenSettings={onOpenSettings} />
        <Composer onOpenSettings={onOpenSettings} />
        <BottomSheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="会话历史">
          <SessionList onOpenSettings={onOpenSettings} />
        </BottomSheet>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--bg)]">
      <aside className="hidden w-[268px] shrink-0 border-r border-[var(--line)] bg-[var(--surface)] md:block">
        <SessionList onOpenSettings={onOpenSettings} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--bg)]">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-5">
          <span className="truncate text-[14px] font-medium text-[var(--fg)]">{activeSession.title}</span>
          {activeSession.project && <Badge tone="neutral">{activeSession.project}</Badge>}
          <StatusPill
            label={activeSession.status === 'running' ? '生成中' : activeSession.status === 'awaiting' ? '待确认' : '空闲'}
            tone={activeSession.status === 'running' ? 'accent' : activeSession.status === 'awaiting' ? 'warn' : 'neutral'}
            pulse={activeSession.status === 'running'}
          />
          {demoMode && <Badge tone="warn">演示模式</Badge>}
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="会话操作" onClick={() => toast({ title: '会话操作', detail: '在左侧会话卡片右侧的 ⋯ 菜单里重命名、置顶或删除', tone: 'neutral' })}>
              <ChevronDown size={16} />
            </IconButton>
            <IconButton label="新建会话" onClick={newSession}>
              <MessageSquarePlus size={16} />
            </IconButton>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center px-8">
            <div className="max-w-[560px] text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)]">
                <Sparkles size={22} />
              </div>
              <h2 className="mt-4 text-[26px] font-semibold leading-tight text-[var(--fg)]">让想法，真正成为作品。</h2>
              <p className="mx-auto mt-2 max-w-[40ch] text-[14px] leading-relaxed text-[var(--muted)]">
                描述你想做的事。思祁会先给出计划，再执行，并把测试、变更与证据交给你。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {['给 Harness 加检查点恢复', '排查 Reno12 状态栏 Insets', '把 v2.0 规范拆成任务'].map((t) => (
                  <Button key={t} size="sm" variant="secondary" disabled={streaming} onClick={() => sendMessage(t)}>
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ChatThread />
        )}
        <ChatErrorBanner onOpenSettings={onOpenSettings} />
        <Composer onOpenSettings={onOpenSettings} />
      </div>

      <aside className="hidden w-[320px] shrink-0 border-l border-[var(--line)] bg-[var(--surface)] lg:block">
        <ContextPanel onOpenApproval={onOpenApproval} onOpenSettings={onOpenSettings} />
      </aside>
    </div>
  )
}
