/**
 * 凭据存储：桌面版走 Electron safeStorage，Android APK 走 Keystore（SisqiHost），
 * Web 预览退化为 localStorage。界面只展示掩码；完整密钥只在调用时短暂进入内存。
 */
export interface SecretBridge {
  get: (id: string) => Promise<string | null>
  set: (id: string, value: string) => Promise<boolean>
  delete: (id: string) => Promise<void>
}

interface NativeHost {
  setChrome?: (theme: string) => void
  secretBackend?: () => string
  setSecret?: (id: string, value: string) => boolean
  getSecret?: (id: string) => string
  deleteSecret?: (id: string) => void
  deviceInfo?: () => string
  pickFile?: (id: string, mime: string) => void
}

declare global {
  interface Window {
    /** Android 外壳注入的桥（浏览器里不存在） */
    SisqiHost?: NativeHost
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

/** Android Keystore 桥：同步接口包成 Promise；首次读取时顺带迁移旧版 localStorage 明文密钥 */
const nativeStore: SecretBridge | null = (() => {
  const host = window.SisqiHost
  if (!host || typeof host.getSecret !== 'function') return null
  return {
    async get(id) {
      const value = host.getSecret!(id)
      if (value) return value
      const legacy = localStorage.getItem(LS_PREFIX + id)
      if (legacy) {
        host.setSecret?.(id, legacy)
        localStorage.removeItem(LS_PREFIX + id)
        return legacy
      }
      return null
    },
    async set(id, value) {
      return Boolean(host.setSecret?.(id, value))
    },
    async delete(id) {
      host.deleteSecret?.(id)
    },
  }
})()

export function secretStore(): SecretBridge {
  return window.sisqi?.secrets ?? nativeStore ?? webStore
}

export const isDesktop = () => Boolean(window.sisqi?.desktop)
export const isNativeShell = () => Boolean(nativeStore)
export const isEncryptedStore = () => Boolean(window.sisqi?.secrets || nativeStore)

/** 给人看的存储方式说明（设置页、密钥弹窗、关于页共用） */
export function secretStorageLabel(): string {
  if (window.sisqi?.secrets) return '系统加密存储（Electron safeStorage）'
  if (nativeStore) return '系统加密存储（Android Keystore · AES-256-GCM）'
  return '本机 localStorage（浏览器预览）'
}

/** 当前运行环境（关于页） */
export function runtimeLabel(): string {
  if (window.sisqi?.desktop) return 'Windows 桌面版（Electron）'
  if (nativeStore) return 'Android APK（WebView 外壳）'
  return '浏览器预览'
}

export function maskKey(key: string | null | undefined): string {
  if (!key) return '未配置'
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`
}