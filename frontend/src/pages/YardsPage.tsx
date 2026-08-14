import { motion } from 'framer-motion'
import { Code2, Search, Terminal, FileText } from 'lucide-react'
import { useYardStore } from '@/state/yardStore'

const YARDS: { id: string; name: string; desc: string; icon: typeof Code2; status: string }[] = [
  {
    id: 'coding' as const,
    name: 'Coding Yard',
    desc: 'Monaco editor, file explorer, AI code generation and project creation.',
    icon: Code2,
    status: 'AVAILABLE',
  },
  {
    id: 'research' as const,
    name: 'Research Yard',
    desc: 'Web search, AI summaries and a persistent notes panel.',
    icon: Search,
    status: 'AVAILABLE',
  },
  {
    id: 'terminal' as const,
    name: 'Terminal Yard',
    desc: 'System shell access. Slated for the roadmap.',
    icon: Terminal,
    status: 'ROADMAP',
  },
  {
    id: 'data' as const,
    name: 'Data Yard',
    desc: 'Datasets and visualization. Slated for the roadmap.',
    icon: FileText,
    status: 'ROADMAP',
  },
]

export function YardsPage() {
  const openYard = useYardStore((s) => s.openYard)

  return (
    <div className="flex h-full flex-col p-8">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-1 font-display text-2xl font-semibold tracking-wide text-ink"
      >
        YARDS
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8 text-sm text-ink-dim"
      >
        Task-shaped workspaces. Orion opens them automatically — or you can launch one manually.
      </motion.p>

      <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {YARDS.map(({ id, name, desc, icon: Icon, status }, i) => (
          <motion.button
            key={id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i + 0.1 }}
            disabled={status !== 'AVAILABLE'}
            onClick={() => openYard(id as 'coding' | 'research')}
            className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all ${
              status === 'AVAILABLE'
                ? 'border-line bg-panel hover:border-crimson-500/40 hover:glow-crimson'
                : 'cursor-not-allowed border-line bg-panel/40 opacity-50'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-crimson-500/30 bg-crimson-500/10 text-crimson-400">
                <Icon size={18} />
              </span>
              <span className="font-mono text-[9px] tracking-widest text-ink-faint">{status}</span>
            </div>
            <div>
              <div className="font-display text-base font-medium text-ink">{name}</div>
              <div className="mt-1 text-xs leading-relaxed text-ink-dim">{desc}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
