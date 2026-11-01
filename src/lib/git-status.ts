/**
 * .git/index 解析 + 工作区比对：只读文件内容与目录列表，不执行 git。
 * 支持 index v2/v3；v4 的路径压缩未实现（会返回 null，只显示已跟踪文件数）。
 */
import { listTreePath, readTreePathBytes } from './native-files'

export interface GitIndexEntry {
  path: string
  /** 字节大小（index 记录） */
  size: number
  /** 修改时间（秒） */
  mtime: number
}

export interface GitIndex {
  version: number
  entries: GitIndexEntry[]
}

export function parseGitIndex(bytes: Uint8Array): GitIndex | null {
  if (bytes.length < 12) return null
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  if (magic !== 'DIRC') return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const version = dv.getUint32(4)
  if (version !== 2 && version !== 3) return null
  const count = dv.getUint32(8)
  const entries: GitIndexEntry[] = []
  let off = 12
  for (let i = 0; i < count && off + 62 <= bytes.length; i++) {
    const start = off
    const mtime = dv.getUint32(start + 8)
    const size = dv.getUint32(start + 36)
    const flags = dv.getUint16(start + 60)
    let nameStart = start + 62
    if (flags & 0x4000) nameStart += 2
    const nameLen = flags & 0x0fff
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen))
    const entryLen = nameStart - start + nameLen + 1
    off = start + Math.ceil(entryLen / 8) * 8
    if (!name) break
    entries.push({ path: name, size, mtime })
  }
  return { version, entries }
}

export interface GitStatus {
  modified: number
  deleted: number
  /** 未跟踪文件（只在扫描到的目录里统计） */
  untracked: number
  scannedDirs: number
  totalDirs: number
}

/** 这些目录不参与未跟踪统计（第三方依赖/构建产物） */
export const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.gradle', '.idea', '__pycache__', '.venv', 'vendor'])

export const isIgnoredDir = (name: string) => IGNORED_DIRS.has(name)

/** 只比对 index 里出现过的目录；最多扫 maxDirs 个，避免逐层遍历整棵树 */
export async function scanWorktree(treeUri: string, entries: GitIndexEntry[], maxDirs = 10): Promise<GitStatus> {
  const byDir = new Map<string, GitIndexEntry[]>()
  for (const e of entries) {
    const cut = e.path.lastIndexOf('/')
    const dir = cut < 0 ? '' : e.path.slice(0, cut)
    const list = byDir.get(dir)
    if (list) list.push(e)
    else byDir.set(dir, [e])
  }
  const dirs = [...byDir.keys()].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)).slice(0, maxDirs)

  let modified = 0
  let deleted = 0
  let untracked = 0
  let scannedDirs = 0
  for (const dir of dirs) {
    const tree = await listTreePath(treeUri, dir)
    if (!tree) continue
    scannedDirs += 1
    const files = new Map(tree.files.map((f) => [f.name, f]))
    const tracked = new Set((byDir.get(dir) ?? []).map((e) => e.path.slice(dir ? dir.length + 1 : 0)))
    for (const entry of byDir.get(dir) ?? []) {
      const name = entry.path.slice(dir ? dir.length + 1 : 0)
      const f = files.get(name)
      if (!f) {
        deleted += 1
        continue
      }
      const sizeChanged = f.size >= 0 && entry.size >= 0 && f.size !== entry.size
      const timeChanged = f.lastModified > 0 && Math.abs(Math.floor(f.lastModified / 1000) - entry.mtime) > 2
      if (sizeChanged || timeChanged) modified += 1
    }
    for (const f of tree.files) {
      if (f.dir || isIgnoredDir(f.name)) continue
      if (!tracked.has(f.name)) untracked += 1
    }
  }
  return { modified, deleted, untracked, scannedDirs, totalDirs: byDir.size }
}

export async function readGitStatus(treeUri: string): Promise<{ tracked: number; status: GitStatus } | null> {
  const bytes = await readTreePathBytes(treeUri, '.git/index')
  if (!bytes) return null
  const index = parseGitIndex(bytes)
  if (!index) return null
  const status = await scanWorktree(treeUri, index.entries)
  return { tracked: index.entries.length, status }
}