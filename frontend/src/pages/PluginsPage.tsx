import { motion } from 'framer-motion'
import { Cpu, Plug, ShieldCheck } from 'lucide-react'
import { useAppStore } from '@/state/appStore'

const PLUGINS = [
  { icon: Plug, name: 'System Control', desc: 'Mouse, keyboard and app control via pyautogui.', status: 'ACTIVE' },
  { icon: Plug, name: 'Project Tools', desc: 'Create and edit files inside Coding Yards.', status: 'ACTIVE' },
  { icon: Plug, name: 'Search Tools', desc: 'Web search with offline dataset fallback.', status: 'ACTIVE' },
  { icon: Plug, name: 'Notes Tools', desc: 'Persistent notes for Research Yards.', status: 'ACTIVE' },
]

const PROVIDERS = [
  { icon: ShieldCheck, name: 'MCP Adapter', desc: 'JSON-RPC bridge — every tool is a pluggable provider.', status: 'READY' },
]

export function PluginsPage() {
  const setView = useAppStore((s) => s.setView)
  return (
    <div className="flex h-full flex-col overflow-y-auto p-8">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-1 font-display text-2xl font-semibold tracking-wide text-ink">
        PLUGINS
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-8 text-sm text-ink-dim">
        Capabilities are exposed as tools through a single MCP-ready registry.
      </motion.p>

      <div className="flex max-w-2xl flex-col gap-3">
        {[...PLUGINS, ...PROVIDERS].map(({ icon: Icon, name, desc, status }, i) => (
          <motion.button
            key={name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            onClick={() => setView('settings')}
            className="flex items-center gap-4 rounded-xl border border-line bg-panel p-4 text-left transition-all hover:border-crimson-500/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-crimson-500/30 bg-crimson-500/10 text-crimson-400">
              <Icon size={16} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="text-[11px] text-ink-faint">{desc}</div>
            </div>
            <span className="font-mono text-[9px] tracking-widest text-crimson-400">{status}</span>
          </motion.button>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-2 rounded-xl border border-dashed border-line-2 bg-void/50 p-4 text-center"
        >
          <Cpu size={18} className="mx-auto mb-2 text-ink-faint" />
          <p className="text-xs text-ink-faint">
            The plugin marketplace ships post-hackathon. Yards are already registry-driven, so new ones
            plug straight in.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
