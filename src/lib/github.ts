/**
 * GitHub 连接器（真实 API）：令牌存 Keystore，请求走原生 HTTP（APK）或 fetch（桌面/浏览器，GitHub 允许 CORS）。
 */
import { nativeHttpAvailable, nativeRequest } from './native-http'

export interface GithubUser {
  login: string
  name?: string
  avatar?: string
  publicRepos: number
}

export interface GithubRepo {
  id: number
  fullName: string
  private: boolean
  updatedAt: string
  language?: string
  branch: string
}

export class GithubError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GithubError'
    this.status = status
  }
}

async function ghGet(path: string, token: string): Promise<unknown> {
  const url = `https://api.github.com${path}`
  const auth = `Bearer ${token}`

  if (nativeHttpAvailable()) {
    const res = nativeRequest('GET', url, auth, '')
    if ('error' in res) throw new GithubError('无法连接 GitHub，检查网络')
    if (res.status === 401) throw new GithubError('令牌无效或已过期', 401)
    if (res.status === 403) throw new GithubError('触发限流或权限不足', 403)
    if (res.status < 200 || res.status >= 300) throw new GithubError(`GitHub 返回 ${res.status}`, res.status)
    try {
      return JSON.parse(res.body)
    } catch {
      throw new GithubError('GitHub 返回了无法解析的内容')
    }
  }

  let r: Response
  try {
    r = await fetch(url, { headers: { Authorization: auth, Accept: 'application/vnd.github+json' } })
  } catch {
    throw new GithubError('无法连接 GitHub（浏览器可能被 CORS 拦截）')
  }
  if (r.status === 401) throw new GithubError('令牌无效或已过期', 401)
  if (r.status === 403) throw new GithubError('触发限流或权限不足', 403)
  if (!r.ok) throw new GithubError(`GitHub 返回 ${r.status}`, r.status)
  return r.json()
}

export async function fetchGithubUser(token: string): Promise<GithubUser> {
  const u = (await ghGet('/user', token)) as { login?: string; name?: string; avatar_url?: string; public_repos?: number }
  if (!u.login) throw new GithubError('不是有效的 GitHub 令牌')
  return { login: u.login, name: u.name, avatar: u.avatar_url, publicRepos: u.public_repos ?? 0 }
}

export async function fetchGithubRepos(token: string, limit = 20): Promise<GithubRepo[]> {
  const list = (await ghGet(`/user/repos?per_page=${limit}&sort=updated`, token)) as Array<{
    id: number
    full_name: string
    private: boolean
    updated_at: string
    language?: string | null
    default_branch?: string
  }>
  return list.slice(0, limit).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    private: Boolean(r.private),
    updatedAt: r.updated_at,
    language: r.language ?? undefined,
    branch: r.default_branch ?? 'main',
  }))
}

export const relativeDate = (iso: string) => {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const min = Math.round(diff / 60000)
  if (min < 60) return `${Math.max(1, min)} 分钟前`
  const hour = Math.round(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.round(hour / 24)
  if (day < 30) return `${day} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}
export interface GithubCommit {
  sha: string
  message: string
  author?: string
  date: string
}

export interface GithubRepoDetail {
  fullName: string
  description?: string
  private: boolean
  stars: number
  language?: string
  branch: string
  updatedAt: string
  readme?: string
  commits: GithubCommit[]
}

/** 单个仓库详情：基本信息 + README + 最近提交 */
export async function fetchRepoDetail(token: string, fullName: string): Promise<GithubRepoDetail> {
  const repo = (await ghGet(`/repos/${fullName}`, token)) as {
    full_name?: string
    description?: string | null
    private?: boolean
    stargazers_count?: number
    language?: string | null
    default_branch?: string
    updated_at?: string
  }
  if (!repo.full_name) throw new GithubError('仓库不存在或没有权限')

  let readme: string | undefined
  try {
    const doc = (await ghGet(`/repos/${fullName}/readme`, token)) as { content?: string; encoding?: string }
    if (doc.content) {
      const bin = atob(doc.content.replace(/\s/g, ''))
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      readme = new TextDecoder().decode(bytes).slice(0, 12000)
    }
  } catch {
    /* 没有 README 不算错误 */
  }

  let commits: GithubCommit[] = []
  try {
    const list = (await ghGet(`/repos/${fullName}/commits?per_page=5`, token)) as Array<{
      sha: string
      commit?: { message?: string; author?: { name?: string; date?: string } }
    }>
    commits = list.slice(0, 5).map((c) => ({
      sha: c.sha.slice(0, 7),
      message: (c.commit?.message ?? '').split('\n')[0],
      author: c.commit?.author?.name,
      date: c.commit?.author?.date ?? '',
    }))
  } catch {
    /* 空仓库或权限不足 */
  }

  return {
    fullName: repo.full_name,
    description: repo.description ?? undefined,
    private: Boolean(repo.private),
    stars: repo.stargazers_count ?? 0,
    language: repo.language ?? undefined,
    branch: repo.default_branch ?? 'main',
    updatedAt: repo.updated_at ?? '',
    readme,
    commits,
  }
}
export interface GithubIssue {
  number: number
  title: string
  user?: string
  comments: number
  updatedAt: string
  labels: string[]
}

export interface GithubPull {
  number: number
  title: string
  user?: string
  updatedAt: string
  draft: boolean
  head?: string
}

/** 打开的 issue（/issues 里会混入 PR，按 pull_request 字段剔除） */
export async function fetchIssues(token: string, fullName: string, perPage = 10): Promise<GithubIssue[]> {
  const list = (await ghGet(`/repos/${fullName}/issues?state=open&per_page=${perPage}`, token)) as Array<{
    number: number
    title: string
    user?: { login?: string }
    comments?: number
    updated_at?: string
    labels?: Array<{ name?: string }>
    pull_request?: unknown
  }>
  return list
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      user: i.user?.login,
      comments: i.comments ?? 0,
      updatedAt: i.updated_at ?? '',
      labels: (i.labels ?? []).map((l) => l.name ?? '').filter(Boolean).slice(0, 3),
    }))
}

/** 打开的 PR */
export async function fetchPulls(token: string, fullName: string, perPage = 10): Promise<GithubPull[]> {
  const list = (await ghGet(`/repos/${fullName}/pulls?state=open&per_page=${perPage}`, token)) as Array<{
    number: number
    title: string
    user?: { login?: string }
    updated_at?: string
    draft?: boolean
    head?: { ref?: string }
  }>
  return list.map((p) => ({
    number: p.number,
    title: p.title,
    user: p.user?.login,
    updatedAt: p.updated_at ?? '',
    draft: Boolean(p.draft),
    head: p.head?.ref,
  }))
}
