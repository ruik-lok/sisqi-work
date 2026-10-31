/**
 * 凭据存储：桌面版走 Electron safeStorage（加密落盘），Web 预览退化为 localStorage。
 * 界面只展示掩码；完整密钥只在调用时短暂进入内存。
 */
export interface SecretBridge {
  get: (id: string) => Promise<string | null>
  set: (id: string, value: string) => Promise<boolean>
  delete: (id: string) => Promise<void>
}

declare global {
  interface Window {
    sisqi?: {
      desktop?: boolean
      platform?: string
      versions?: { electron?: string; chrome?: string }
      secrets?: SecretBridge
    }
  }
}

const LS_PREFIX = 'sisqi.secret.'

const webStore: SecretBridge = {
  async get(id) {
    return localStorage.getItem(LS_PREFIX + id)
  },
  async set(id, value) {
    localStorage.setItem(LS_PREFIX + id, value)
    return false // 未加密
  },
  async delete(id) {
    localStorage.removeItem(LS_PREFIX + id)
  },
}

export function secretStore(): SecretBridge {
  return window.sisqi?.secrets ?? webStore
}

export const isDesktop = () => Boolean(window.sisqi?.desktop)
export const isEncryptedStore = () => Boolean(window.sisqi?.secrets)

export function maskKey(key: string | null | undefined): string {
  if (!key) return '未配置'
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
}
