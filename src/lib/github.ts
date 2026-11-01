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
