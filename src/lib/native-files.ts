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
}

declare global {
  interface Window {
    __sisqiFile?: (id: string, file: PickedFile | null) => void
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