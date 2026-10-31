import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileCode2, Folder, FolderOpen, GitBranch, MoreHorizontal, Search } from 'lucide-react'
import { cn } from '../../lib/cn'
import { fileTree, projects, type FileNode } from '../../data/nexus'
import { IconButton } from '../ui/primitives'

export function Explorer({ activePath, onOpen }: { activePath: string; onOpen: (path: string) => void }) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(['app', 'feature']))
  const project = projects[0]

  const rows = useMemo(() => {
    const filtered = query ? fileTree.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())) : fileTree
    return filtered.filter((f) => {
      if (!query) {
        for (const dir of collapsed) {
          if ((f.path.startsWith(dir + '/') || f.path === dir) && f.path !== dir) return false
        }
      }
      return true
    })
  }, [collapsed, query])

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1.5 px-3.5">
        <span className="truncate text-sm text-fg">{project.name}</span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-faint">
          <GitBranch size={11} />
          main
        </span>
        <IconButton label="更多项目操作" size="sm">
          <MoreHorizontal size={14} />
        </IconButton>
      </div>

      <div className="shrink-0 px-3 pb-2">
        <label className="flex h-7 items-center gap-1.5 rounded-md bg-surface-2 px-2 focus-within:border-[var(--accent)]">
          <Search size={12} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="筛选文件"
            aria-label="筛选项目文件"
            className="w-full bg-transparent text-xs text-fg placeholder:text-faint focus:outline-none"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2" role="tree" aria-label="项目文件树">
        {rows.map((f: FileNode) => {
          const isDir = f.kind === 'dir'
          const isOpen = isDir && !collapsed.has(f.path)
          const active = f.path === activePath
          return (
            <button
              key={f.path}
              role="treeitem"
              aria-expanded={isDir ? isOpen : undefined}
              aria-selected={active}
              onClick={() => (isDir ? toggle(f.path) : onOpen(f.path))}
              style={{ paddingLeft: 10 + f.depth * 12 }}
              className={cn(
                'flex h-[28px] w-full items-center gap-1.5 pr-3 text-left text-xs transition-colors duration-150',
                active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2/60 hover:text-fg',
              )}
            >
              {isDir ? (
                <>
                  {isOpen ? <ChevronDown size={12} className="shrink-0 text-faint" /> : <ChevronRight size={12} className="shrink-0 text-faint" />}
                  {isOpen ? <FolderOpen size={13} className="shrink-0 text-accent/80" /> : <Folder size={13} className="shrink-0 text-faint" />}
                </>
              ) : (
                <>
                  <span className="w-3 shrink-0" />
                  <FileCode2 size={13} className={cn('shrink-0', f.status ? 'text-warn' : 'text-faint')} />
                </>
              )}
              <span className="truncate">{f.name}</span>
              {f.status && (
                <span
                  className={cn(
                    'ml-auto text-[11px]',
                    f.status === 'modified' ? 'text-warn' : f.status === 'added' ? 'text-ok' : 'text-faint',
                  )}
                >
                  {f.status === 'modified' ? '改' : f.status === 'added' ? '新' : '未'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-line px-3.5 py-2.5 text-[11px] leading-relaxed text-faint">
        <p>{project.latestSnapshot}</p>
        <p className="mt-0.5">4 个未提交变更 · 冲突检测通过</p>
      </div>
    </div>
  )
}
