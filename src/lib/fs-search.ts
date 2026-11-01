/**
 * 在项目目录里按关键字搜索文本文件：只读、纯本地，不建索引。
 * 限制：最多 40 个文件 / 20 条命中 / 深度 2，超出会标 truncated。
 */
import { isTextMime, listTreePath, readDoc } from './native-files'
import { isIgnoredDir } from './git-status'

export interface SearchHit {
  path: string
  docId: string
  line: number
  text: string
}

export interface SearchResult {
  hits: SearchHit[]
  scanned: number
  truncated: boolean
}

const MAX_FILES = 40
const MAX_HITS = 20
const MAX_DEPTH = 2

export async function searchText(treeUri: string, query: string): Promise<SearchResult> {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return { hits: [], scanned: 0, truncated: false }

  const hits: SearchHit[] = []
  let scanned = 0
  let truncated = false
  const queue: Array<{ dir: string; depth: number }> = [{ dir: '', depth: 0 }]

  while (queue.length && scanned < MAX_FILES && hits.length < MAX_HITS) {
    const { dir, depth } = queue.shift()!
    const tree = await listTreePath(treeUri, dir)
    if (!tree) continue
    for (const f of tree.files) {
      if (hits.length >= MAX_HITS || scanned >= MAX_FILES) {
        truncated = true
        break
      }
      if (f.dir) {
        if (depth < MAX_DEPTH && !isIgnoredDir(f.name)) {
          queue.push({ dir: dir ? `${dir}/${f.name}` : f.name, depth: depth + 1 })
        }
        continue
      }
      if (isIgnoredDir(f.name) || !isTextMime(f.mime, f.name) || f.size > 256 * 1024) continue

      const doc = await readDoc(treeUri, f.docId)
      if (!doc) continue
      scanned += 1
      const path = dir ? `${dir}/${f.name}` : f.name
      const lines = doc.text.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].toLowerCase().includes(q)) continue
        hits.push({ path, docId: f.docId, line: i + 1, text: lines[i].trim().slice(0, 160) })
        if (hits.length >= MAX_HITS) {
          truncated = true
          break
        }
      }
    }
  }

  return { hits, scanned, truncated: truncated || queue.length > 0 }
}
