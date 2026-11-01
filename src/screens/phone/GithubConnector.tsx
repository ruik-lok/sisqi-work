import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Github, Lock, RefreshCw, Star, Unplug } from 'lucide-react'
import { Button, IconButton, StatusPill } from '../../components/ui/primitives'
import { MarkdownText } from '../../components/chat/Markdown'
import { BottomSheet } from '../../components/ui/overlays'
import { useNexus } from '../../state/store'
import { secretStore } from '../../lib/secrets'
import {
  GithubError,
  fetchGithubRepos,
  fetchGithubUser,
  fetchIssues,
  fetchPulls,
  fetchRepoDetail,
  relativeDate,
  type GithubIssue,
  type GithubPull,
  type GithubRepo,
  type GithubRepoDetail,
  type GithubUser,
} from '../../lib/github'
import { cn } from '../../lib/cn'

const TOKEN_ID = 'github'

/** 真实 GitHub 连接器：PAT 存 Keystore，拉取账号与最近仓库 */
export function GithubConnector() {
  const { toast } = useNexus()
  const [token, setToken] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [user, setUser] = useState<GithubUser | null>(null)
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<GithubRepoDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [tab, setTab] = useState<'commits' | 'issues' | 'pulls'>('commits')
  const [issues, setIssues] = useState<GithubIssue[] | null>(null)
  const [pulls, setPulls] = useState<GithubPull[] | null>(null)
  const [tabBusy, setTabBusy] = useState(false)
  const [repoQuery, setRepoQuery] = useState('')

  const load = async (tk: string) => {
    setBusy(true)
    setError('')
    try {
      const u = await fetchGithubUser(tk)
      setUser(u)
      setRepos(await fetchGithubRepos(tk))
    } catch (e) {
      const msg = e instanceof GithubError ? e.message : '连接失败'
      setError(msg)
      if (e instanceof GithubError && e.status === 401) {
        setUser(null)
        setRepos([])
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await secretStore().get(TOKEN_ID)
      if (cancelled || !saved) return
      setToken(saved)
      void load(saved)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = async () => {
    const t = draft.trim()
    if (!t) return
    setBusy(true)
    setError('')
    try {
      const u = await fetchGithubUser(t)
      await secretStore().set(TOKEN_ID, t)
      setToken(t)
      setUser(u)
      setDraft('')
      const list = await fetchGithubRepos(t)
      setRepos(list)
      toast({ title: 'GitHub 已连接', detail: `${u.login} · ${list.length} 个仓库`, tone: 'ok' })
    } catch (e) {
      setError(e instanceof GithubError ? e.message : '连接失败')
    } finally {
      setBusy(false)
    }
  }

  const openRepo = async (repo: GithubRepo) => {
    if (!token) return
    setDetailBusy(true)
    setDetail(null)
    setTab('commits')
    setIssues(null)
    setPulls(null)
    try {
      setDetail(await fetchRepoDetail(token, repo.fullName))
    } catch (e) {
      toast({ title: '读取仓库失败', detail: e instanceof GithubError ? e.message : '未知错误', tone: 'danger' })
    } finally {
      setDetailBusy(false)
    }
  }

  const switchTab = async (next: 'commits' | 'issues' | 'pulls') => {
    setTab(next)
    if (!token || !detail) return
    if (next === 'issues' && !issues) {
      setTabBusy(true)
      try {
        setIssues(await fetchIssues(token, detail.fullName))
      } catch (e) {
        toast({ title: '读取 Issue 失败', detail: e instanceof GithubError ? e.message : '未知错误', tone: 'danger' })
        setIssues([])
      } finally {
        setTabBusy(false)
      }
    }
    if (next === 'pulls' && !pulls) {
      setTabBusy(true)
      try {
        setPulls(await fetchPulls(token, detail.fullName))
      } catch (e) {
        toast({ title: '读取 PR 失败', detail: e instanceof GithubError ? e.message : '未知错误', tone: 'danger' })
        setPulls([])
      } finally {
        setTabBusy(false)
      }
    }
  }

  const openByName = async () => {
    const name = repoQuery.trim()
    if (!token || !/^[\w.-]+\/[\w.-]+$/.test(name)) {
      toast({ title: '格式应为 owner/repo', tone: 'warn' })
      return
    }
    setDetailBusy(true)
    setDetail(null)
    setTab('commits')
    setIssues(null)
    setPulls(null)
    try {
      setDetail(await fetchRepoDetail(token, name))
      setRepoQuery('')
    } catch (e) {
      toast({ title: '打开仓库失败', detail: e instanceof GithubError ? e.message : '未知错误', tone: 'danger' })
    } finally {
      setDetailBusy(false)
    }
  }

  const disconnect = async () => {
    await secretStore().delete(TOKEN_ID)
    setToken(null)
    setUser(null)
    setRepos([])
    setDraft('')
    setError('')
    toast({ title: '已断开 GitHub', tone: 'neutral' })
  }

  const connected = Boolean(user)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-[18px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-left"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)]">
          <Github size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-[var(--fg)]">GitHub</p>
          <p className="truncate text-[11px] text-[var(--faint)]">
            {connected ? `${user?.login} · ${repos.length} 个仓库` : token ? '已保存令牌，等待校验' : '未连接 · 填入 Personal Access Token'}
          </p>
        </div>
        <StatusPill label={connected ? '已连接' : token ? '待校验' : '未连接'} tone={connected ? 'ok' : token ? 'warn' : 'neutral'} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="GitHub" height="max-h-[86%]">
        <div className="px-4 py-3">
          {!connected ? (
            <>
              <p className="text-[12px] leading-relaxed text-[var(--muted)]">
                粘贴一个 GitHub Personal Access Token（fine-grained 或 classic 均可）。只读取账号与仓库列表，令牌存在本机加密存储里。
              </p>
              <label className="mt-3 block">
                <span className="label mb-1 block">Personal Access Token</span>
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="ghp_… / github_pat_…"
                  autoComplete="off"
                  className="h-10 w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 font-mono text-[12px] text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
              {error && <p className="mt-2 text-[11.5px] text-[var(--danger)]">{error}</p>}
              <Button size="sm" variant="primary" block className="mt-2.5" disabled={busy || !draft.trim()} onClick={() => void connect()}>
                {busy ? '连接中…' : '保存并连接'}
              </Button>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">建议最小权限：只勾选仓库读取（需要私有仓库时再勾选对应仓库）。</p>
            </>
          ) : detail || detailBusy ? (
            <>
              <div className="flex items-center gap-2">
                <IconButton label="返回仓库列表" size="sm" onClick={() => { setDetail(null); setDetailBusy(false) }}>
                  <ArrowLeft size={14} />
                </IconButton>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12.5px] text-[var(--fg)]">{detail?.fullName ?? '读取中…'}</p>
                  {detail && (
                    <p className="text-[10.5px] text-[var(--faint)]">
                      {detail.language ?? '—'} · <Star size={9} className="inline align-[-1px]" /> {detail.stars} · {detail.branch}
                    </p>
                  )}
                </div>
              </div>
              {detailBusy && <p className="mt-3 text-[12px] text-[var(--faint)]">正在读取仓库…</p>}
              {detail && (
                <>
                  {detail.description && <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">{detail.description}</p>}

                  <div className="mt-3 flex gap-1 rounded-full bg-[var(--surface-2)] p-1">
                    {[
                      { id: 'commits' as const, label: `提交 ${detail.commits.length}` },
                      { id: 'issues' as const, label: `Issues${issues ? ` ${issues.length}` : ''}` },
                      { id: 'pulls' as const, label: `PR${pulls ? ` ${pulls.length}` : ''}` },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => void switchTab(item.id)}
                        className={cn(
                          'flex-1 rounded-full py-1.5 text-[12px] transition-colors',
                          tab === item.id ? 'bg-[var(--surface)] text-[var(--fg)] shadow-[var(--shadow-1)]' : 'text-[var(--muted)]',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2">
                    {tab === 'commits' && (
                      <div className="space-y-1">
                        {detail.commits.map((c) => (
                          <div key={c.sha} className="flex items-baseline gap-2">
                            <span className="shrink-0 font-mono text-[11px] text-[var(--accent)]">{c.sha}</span>
                            <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--fg)]">{c.message}</span>
                            <span className="shrink-0 text-[10.5px] text-[var(--faint)]">{relativeDate(c.date)}</span>
                          </div>
                        ))}
                        {!detail.commits.length && <p className="text-[12px] text-[var(--faint)]">没有读到提交（空仓库或权限不足）</p>}
                      </div>
                    )}

                    {tab === 'issues' && (
                      <div className="space-y-1.5">
                        {tabBusy && <p className="text-[12px] text-[var(--faint)]">读取中…</p>}
                        {issues?.map((i) => (
                          <div key={i.number} className="rounded-[12px] bg-[var(--surface-2)] px-2.5 py-2">
                            <p className="flex items-baseline gap-2">
                              <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">#{i.number}</span>
                              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--fg)]">{i.title}</span>
                              <span className="shrink-0 text-[10.5px] text-[var(--faint)]">{relativeDate(i.updatedAt)}</span>
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--faint)]">
                              {i.user && <span>{i.user}</span>}
                              {i.comments > 0 && <span>· {i.comments} 条评论</span>}
                              {i.labels.map((l) => (
                                <span key={l} className="rounded-full bg-[var(--surface)] px-1.5 py-0.5">
                                  {l}
                                </span>
                              ))}
                            </p>
                          </div>
                        ))}
                        {issues && !issues.length && <p className="px-1 py-3 text-[12px] text-[var(--faint)]">没有打开的 Issue</p>}
                      </div>
                    )}

                    {tab === 'pulls' && (
                      <div className="space-y-1.5">
                        {tabBusy && <p className="text-[12px] text-[var(--faint)]">读取中…</p>}
                        {pulls?.map((pr) => (
                          <div key={pr.number} className="rounded-[12px] bg-[var(--surface-2)] px-2.5 py-2">
                            <p className="flex items-baseline gap-2">
                              <span className="shrink-0 font-mono text-[11px] text-[var(--faint)]">#{pr.number}</span>
                              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--fg)]">{pr.title}</span>
                              <span className="shrink-0 text-[10.5px] text-[var(--faint)]">{relativeDate(pr.updatedAt)}</span>
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--faint)]">
                              {pr.user && <span>{pr.user}</span>}
                              {pr.head && <span className="font-mono">· {pr.head}</span>}
                              {pr.draft && <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5">草稿</span>}
                            </p>
                          </div>
                        ))}
                        {pulls && !pulls.length && <p className="px-1 py-3 text-[12px] text-[var(--faint)]">没有打开的 PR</p>}
                      </div>
                    )}
                  </div>

                  {tab === 'commits' && (
                    <>
                      <p className="label mt-4">README</p>
                      <div className="mt-1.5 max-h-[300px] overflow-y-auto rounded-[14px] bg-[var(--surface-2)] p-3 text-[12.5px] leading-relaxed">
                        {detail.readme ? <MarkdownText text={detail.readme} /> : <p className="text-[12px] text-[var(--faint)]">没有 README</p>}
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[13px] text-[var(--accent)]">
                  {user!.login.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-[var(--fg)]">{user!.login}</p>
                  <p className="text-[11px] text-[var(--faint)]">公有仓库 {user!.publicRepos} 个</p>
                </div>
                <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={() => void load(token!)} disabled={busy}>
                  {busy ? '刷新中' : '刷新'}
                </Button>
              </div>
              {error && <p className="mt-2 text-[11.5px] text-[var(--danger)]">{error}</p>}
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  value={repoQuery}
                  onChange={(e) => setRepoQuery(e.target.value)}
                  placeholder="打开仓库 owner/repo"
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-2.5 font-mono text-[11.5px] text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none"
                />
                <Button size="sm" variant="secondary" disabled={!repoQuery.trim()} onClick={() => void openByName()}>
                  打开
                </Button>
              </div>
              <p className="label mt-4">最近更新</p>
              <div className="mt-1.5 space-y-1.5">
                {repos.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => void openRepo(r)}
                    className="flex w-full items-center gap-2 rounded-[12px] bg-[var(--surface-2)] px-2.5 py-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate font-mono text-[12px] text-[var(--fg)]">
                        {r.private && <Lock size={10} className="shrink-0 text-[var(--faint)]" />}
                        {r.fullName}
                      </span>
                      <span className="block truncate text-[10.5px] text-[var(--faint)]">
                        {r.language ?? '—'} · {r.branch} · {relativeDate(r.updatedAt)}
                      </span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-[var(--faint)]" />
                  </button>
                ))}
                {!repos.length && !busy && <p className="text-[12px] text-[var(--faint)]">没有可读仓库（令牌可能没有仓库权限）。</p>}
              </div>
              <Button size="sm" variant="ghost" block className="mt-3" icon={<Unplug size={13} />} onClick={() => void disconnect()}>
                断开连接
              </Button>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  )
}