import { createContext, useContext } from 'react'

/**
 * 覆盖层挂载点：预览舞台里每个设备外框各自提供一个宿主，
 * 让对话框 / 命令面板 / BottomSheet / Toast 落在设备屏幕内，
 * 而不是铺满整个浏览器窗口。桌面模式没有外框，回退到 body。
 */
export const OverlayRoot = createContext<HTMLElement | null>(null)

export function useOverlayRoot(): HTMLElement {
  const el = useContext(OverlayRoot)
  return el ?? document.body
}
