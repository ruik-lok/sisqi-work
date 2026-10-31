import type { WorkspaceBridge, WorkspaceEntry } from './workspace-types'

export type { WorkspaceBridge, WorkspaceEntry }

declare global {
  interface Window {
    sisqi?: {
      desktop?: boolean
      platform?: string
      versions?: { electron?: string; chrome?: string }
      secrets?: {
        get: (id: string) => Promise<string | null>
        set: (id: string, value: string) => Promise<boolean>
        delete: (id: string) => Promise<void>
      }
      workspace?: WorkspaceBridge
    }
  }
}

const ROOT_KEY = 'sisqi.workspace.root'

export function workspaceBridge(): WorkspaceBridge | null {
  return window.sisqi?.workspace ?? null
}

export function savedWorkspaceRoot(): string | null {
  try {
    return localStorage.getItem(ROOT_KEY)
  } catch {
    return null
  }
}

export function rememberWorkspaceRoot(root: string | null) {
  try {
    if (root) localStorage.setItem(ROOT_KEY, root)
    else localStorage.removeItem(ROOT_KEY)
  } catch {
    /* 忽略 */
  }
}

export const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).at(-1) ?? p

export function isProbablyText(path: string) {
  return !/\.(png|jpe?g|gif|webp|ico|pdf|zip|7z|gz|tar|exe|dll|woff2?|ttf|otf|mp4|mov|mp3)$/i.test(path)
}
