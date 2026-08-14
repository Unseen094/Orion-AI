import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Folder, FolderOpen, Loader2, ArrowLeft } from 'lucide-react'
import { useYardStore } from '@/state/yardStore'
import { api } from '@/lib/api'
import { FileExplorer } from './FileExplorer'

const TEMPLATES = ['react-dashboard', 'node-api', 'vanilla']

export function ProjectList() {
  const { projects, setProjects, openProject, closeProject, currentProject } = useYardStore()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('react-dashboard')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => {})
  }, [setProjects])

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const p = await api.projects.create(name.trim(), template)
      setProjects([p, ...projects])
      setCreating(false)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  const loadProject = async (id: number) => {
    const p = projects.find((x) => x.id === id)
    if (!p) return
    openProject(p)
    try {
      const files = await api.projects.files(id)
      useYardStore.setState({ files: files.map((f) => ({ ...f, dirty: false })) })
      if (files.length) useYardStore.getState().setActiveFile(files[0].path)
    } catch {
      useYardStore.setState({ files: [] })
    }
  }

  if (currentProject) {
    return (
      <div className="flex flex-col border-b border-line bg-panel-2/40">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={closeProject}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-dim hover:bg-panel-2 hover:text-ink"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2 overflow-hidden">
            <FolderOpen size={13} className="shrink-0 text-crimson-400" />
            <span className="truncate text-xs font-medium text-ink">{currentProject.name}</span>
          </div>
        </div>
        <FileExplorer />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-3">
      <div className="mb-2 px-1 font-mono text-[10px] tracking-[0.3em] text-ink-faint">PROJECTS</div>
      <div className="flex flex-col gap-1.5">
        {projects.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => loadProject(p.id)}
            className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-2 text-left transition-all hover:border-crimson-500/40 hover:glow-crimson"
          >
            <Folder size={13} className="shrink-0 text-crimson-400" />
            <span className="truncate text-xs text-ink-dim">{p.name}</span>
          </motion.button>
        ))}
        {projects.length === 0 && !creating && (
          <p className="px-1 py-4 text-center text-[11px] text-ink-faint">
            No projects yet. Create one, or ask Orion to build one.
          </p>
        )}
      </div>

      {creating ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-crimson-500/40 bg-crimson-500/5 p-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Project name"
            className="rounded-md border border-line bg-void px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-crimson-500/50"
          />
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="rounded-md border border-line bg-void px-2 py-1.5 font-mono text-[10px] text-ink-dim outline-none"
          >
            {TEMPLATES.map((t) => (
              <option key={t} value={t}>
                template: {t}
              </option>
            ))}
          </select>
          <button
            onClick={create}
            disabled={busy || !name.trim()}
            className="flex items-center justify-center gap-2 rounded-md bg-crimson-600 py-1.5 text-xs font-medium text-white hover:bg-crimson-500 disabled:opacity-40"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            CREATE PROJECT
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-line-2 py-2 text-[11px] text-ink-faint transition-colors hover:border-crimson-500/40 hover:text-crimson-400"
        >
          <Plus size={13} /> NEW PROJECT
        </button>
      )}
    </div>
  )
}
