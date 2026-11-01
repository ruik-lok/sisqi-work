/**
 * 从 SAF 目录里的 .git 读仓库信息：分支、HEAD、远端、最近提交（reflog）。
 * 只读文本文件，不解析 index，也不执行 git。
 */
import { readTreePath } from './native-files'

export interface GitCommit {
  sha: string
  message: string
  author?: string
  time?: number
}

export interface GitInfo {
  branch?: string
  sha?: string
  remote?: string
  commits: GitCommit[]
}

/** 解析一行 .git/logs/HEAD：<old> <new> Name <email> <unix> <tz>\t<message> */
export function parseLogLine(line: string): GitCommit | null {
  const m = line.match(/^([0-9a-f]{7,40}) ([0-9a-f]{7,40}) (.+?) <(.+?)> (\d+) ([+-]\d{4})\t(.*)$/)
  if (!m) return null
  const raw = m[7].replace(/^commit( \([^)]*\))?: /, '').trim()
  return { sha: m[2].slice(0, 7), message: raw, author: m[3], time: Number(m[5]) * 1000 }
}

export async function readGitInfo(treeUri: string): Promise<GitInfo | null> {
  const head = await readTreePath(treeUri, '.git/HEAD')
  if (!head) return null
  const config = await readTreePath(treeUri, '.git/config')
  const logs = await readTreePath(treeUri, '.git/logs/HEAD')

  let branch: string | undefined
  let sha: string | undefined
  const h = head.trim()
  if (h.startsWith('ref:')) {
    const ref = h.slice(4).trim()
    branch = ref.replace('refs/heads/', '')
    sha = (await readTreePath(treeUri, `.git/${ref}`))?.trim() || undefined
    if (!sha) {
      const packed = await readTreePath(treeUri, '.git/packed-refs')
      if (packed) {
        for (const line of packed.split('\n')) {
          const m = line.match(/^([0-9a-f]{40})\s+(.+)$/)
          if (m && m[2].trim() === ref) sha = m[1]
        }
      }
    }
  } else {
    sha = h.slice(0, 40)
  }

  const commits = (logs ?? '')
    .split('\n')
    .map(parseLogLine)
    .filter((c): c is GitCommit => Boolean(c))
    .slice(-8)
    .reverse()

  const remote = config?.match(/url\s*=\s*(\S+)/)?.[1]

  return { branch, sha: sha ? sha.slice(0, 7) : undefined, remote, commits }
}

export function shortRemote(remote?: string) {
  if (!remote) return ''
  return remote
    .replace(/^git@github\.com:/, 'github:')
    .replace(/^https?:\/\/github\.com\//, 'github:')
    .replace(/\.git$/, '')
}
