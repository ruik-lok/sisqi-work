export interface WorkspaceEntry {
  path: string
  name: string
  dir: boolean
  depth: number
  size?: number
}

export interface WorkspaceBridge {
  open: () => Promise<{ root: string } | null>
  list: (root: string) => Promise<{ root: string; entries: WorkspaceEntry[]; truncated: boolean }>
  read: (root: string, rel: string) => Promise<{ content: string; size: number; binary: boolean; tooLarge: boolean }>
  write: (root: string, rel: string, content: string) => Promise<{ ok: boolean; size: number }>
  exec: (root: string, command: string) => Promise<{ code: number; stdout: string; stderr: string; durationMs: number }>
}
