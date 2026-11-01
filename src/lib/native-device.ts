/** 真实设备信息（Android 外壳注入的设备信息；浏览器里为 null） */
export interface NativeDeviceInfo {
  model: string
  brand: string
  manufacturer: string
  android: string
  sdk: number
  abis: string
  cores: number
  totalRamMb: number
  availRamMb: number
  suBinary: boolean
}

export function deviceInfo(): NativeDeviceInfo | null {
  const raw = window.SisqiHost?.deviceInfo?.()
  if (!raw) return null
  try {
    return JSON.parse(raw) as NativeDeviceInfo
  } catch {
    return null
  }
}

export const ramGb = (mb: number) => `${(mb / 1024).toFixed(mb >= 1024 ? 1 : 2)} GB`
