import { useEffect, useState } from 'react'
import { Folder, FolderOpen, FileCode2 } from 'lucide-react'
import { useYardStore } from '@/state/yardStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type TreeNodeType = { path: string; name: string; type: 'dir' | 'file'; children: TreeNodeType[] }

function buildTree(paths: string[]): TreeNodeType[] {
  const root: TreeNodeType[] = []
  const map = new Map<string, TreeNodeType>()
  for (const path of paths) {
    const parts = path.split('/')
    let current = root
    let acc = ''
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part
      let node = map.get(acc)
      if (!node) {
        node = { path: acc, name: part, type: i === parts.length - 1 ? 'file' : 'dir', children: [] }
        map.set(acc, node)
        current.push(node)
      }
      current = node.children
    })
  }
  return root
}

export function FileExplorer() {
  const { currentProject, files, activeFile, setActiveFile, updateFile } = useYardStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const projectId = currentProject?.id

  useEffect(() => {
    if (!projectId) return
    setExpanded(new Set(files.map((f) => f.path.split('/').slice(0, -1).join('/'))))
  }, [projectId, files.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectId) return null

  const tree = buildTree(files.map((f) => f.path))

  const openFile = async (path: string) => {
    setActiveFile(path)
    const existing = files.find((f) => f.path === path)
    if (existing) return
    try {
      const f = await api.projects.readFile(projectId, path)
      useYardStore.setState({ files: [...files, { ...f, dirty: false }] })
    } catch {
      updateFile(path, '')
    }
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const render = (nodes: TreeNodeType[], depth: number): React.ReactNode[] =>
    nodes.map((node) => {
      const isDir = node.type === 'dir'
      const toggled = expanded.has(node.path)
      const Icon = isDir ? (toggled ? FolderOpen : Folder) : FileCode2
      return (
        <div key={node.path}>
          <button
            onClick={() => (isDir ? toggle(node.path) : openFile(node.path))}
            style={{ paddingLeft: depth * 12 + 6 }}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs transition-colors',
              !isDir && activeFile === node.path
                ? 'bg-crimson-500/15 text-crimson-300'
                : 'text-ink-dim hover:bg-panel-2 hover:text-ink',
            )}
          >
            <Icon size={12} className={isDir ? 'text-crimson-400' : 'text-ink-faint'} />
            <span className="truncate">{node.name}</span>
          </button>
          {isDir && toggled && render(node.children, depth + 1)}
        </div>
      )
    })

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-3">
      {tree.length === 0 && (
        <p className="px-1 py-3 text-center text-[11px] text-ink-faint">Empty project.</p>
      )}
      {render(tree, 0)}
    </div>
  )
}
