/**
 * 文件选择：Android 用系统 SAF 选择器（不需要存储权限，拿到 dataUrl / 文本）；
 * 浏览器/桌面预览退化为 <input type=file>。
 */
export interface PickedFile {
  name: string
  mime: string
  size: number
  dataUrl?: string
  text?: string
  /** 图片超过上限（1.5 MB），没有附带数据 */
  tooLarge?: boolean
}

interface SisqiHostFiles {
  pickFile?: (id: string, mime: string) => void
  pickFolder?: (id: string) => void
  listFolder?: (id: string, treeUri: string, docId: string) => void
  readDoc?: (id: string, treeUri: string, docId: string) => void
}

export interface ProjectFile {
  name: string
  docId: string
  mime: string
  size: number
  lastModified: number
  dir: boolean
}

export interface ProjectTree {
  name: string
  uri: string
  docId: string
  files: ProjectFile[]
}

declare global {
  interface Window {
    __sisqiFile?: (id: string, file: PickedFile | null) => void
    __sisqiFolder?: (id: string, tree: ProjectTree | null) => void
    __sisqiDoc?: (id: string, doc: { text: string; truncated?: boolean } | null) => void
  }
}

type FolderWaiter = (tree: ProjectTree | null) => void
type DocWaiter = (doc: { text: string; truncated?: boolean } | null) => void
const folderWaiters = new Map<string, FolderWaiter>()
const docWaiters = new Map<string, DocWaiter>()

if (typeof window !== 'undefined') {
  window.__sisqiFolder = (id, tree) => {
    const cb = folderWaiters.get(id)
    if (!cb) return
    folderWaiters.delete(id)
    cb(tree)
  }
  window.__sisqiDoc = (id, doc) => {
    const cb = docWaiters.get(id)
    if (!cb) return
    docWaiters.delete(id)
    cb(doc)
  }
}

let seq = 0

export function nativePickerAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.SisqiHost?.pickFile === 'function'
}

export function pickFile(mime = '*/*'): Promise<PickedFile | null> {
  const host = window.SisqiHost as SisqiHostFiles | undefined
  if (host?.pickFile) {
    return new Promise((resolve) => {
      const id = `f${++seq}-${Date.now()}`
      const prev = window.__sisqiFile
      window.__sisqiFile = (rid, file) => {
        if (rid !== id) {
          prev?.(rid, file)
          return
        }
        window.__sisqiFile = prev
        resolve(file ?? null)
      }
      host.pickFile!(id, mime)
    })
  }
  return pickWithInput(mime)
}

function pickWithInput(mime: string): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = mime
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        const isImage = file.type.startsWith('image/')
        resolve({
          name: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl: isImage && typeof result === 'string' ? result : undefined,
          text: !isImage && typeof result === 'string' ? result : undefined,
        })
      }
      if (file.type.startsWith('image/')) reader.readAsDataURL(file)
      else reader.readAsText(file)
    }
    input.click()
  })
}
export function nativeFolderAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.SisqiHost?.pickFolder === 'function'
}

/** 选择项目文件夹（系统目录选择器，得到持久化读权限） */
export function pickFolder(): Promise<ProjectTree | null> {
  const host = window.SisqiHost
  if (!host?.pickFolder) return Promise.resolve(null)
  const id = `d${++seq}-${Date.now()}`
  return new Promise((resolve) => {
    folderWaiters.set(id, resolve)
    host.pickFolder!(id)
  })
}

/** 列目录（docId 为空表示根） */
export function listFolder(treeUri: string, docId = ''): Promise<ProjectTree | null> {
  const host = window.SisqiHost
  if (!host?.listFolder) return Promise.resolve(null)
  const id = `l${++seq}-${Date.now()}`
  return new Promise((resolve) => {
    folderWaiters.set(id, resolve)
    host.listFolder!(id, treeUri, docId)
  })
}

/** 读取文本文件（上限 256KB） */
export function readDoc(treeUri: string, docId: string): Promise<{ text: string; truncated?: boolean } | null> {
  const host = window.SisqiHost
  if (!host?.readDoc) return Promise.resolve(null)
  const id = `r${++seq}-${Date.now()}`
  return new Promise((resolve) => {
    docWaiters.set(id, resolve)
    host.readDoc!(id, treeUri, docId)
  })
}

export const isTextMime = (mime: string, name: string) =>
  mime.startsWith('text/') ||
  /json|xml|javascript|yaml|x-sh|markdown/.test(mime) ||
  /\.(md|txt|json|ya?ml|ts|tsx|js|jsx|css|html|kt|java|py|go|rs|sh|toml|ini|log|csv)$/i.test(name)

export function formatBytes(n: number): string {
  if (n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
