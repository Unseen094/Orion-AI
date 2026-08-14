import { motion } from 'framer-motion'
import {
  Home,
  LayoutGrid,
  Puzzle,
  BrainCircuit,
  Settings,
  Sparkles,
} from 'lucide-react'
import { useAppStore } from '@/state/appStore'
import type { View } from '@/state/appStore'
import { cn } from '@/lib/utils'

const NAV: { view: View; label: string; icon: typeof Home }[] = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'yards', label: 'Yards', icon: LayoutGrid },
  { view: 'plugins', label: 'Plugins', icon: Puzzle },
  { view: 'models', label: 'Models', icon: BrainCircuit },
  { view: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)

  return (
    <aside className="flex w-16 flex-col items-center gap-2 border-r border-line bg-panel/60 py-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-crimson-500/30 bg-crimson-500/10 glow-crimson"
      >
        <Sparkles size={18} className="text-crimson-400" />
      </motion.div>

      <nav className="flex flex-col items-center gap-1.5">
        {NAV.map(({ view: v, label, icon: Icon }) => {
          const active = view === v
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              title={label}
              className={cn(
                'group relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-crimson-500/15 text-crimson-400'
                  : 'text-ink-dim hover:bg-panel-2 hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-crimson-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={19} />
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-crimson-500 animate-pulse-slow" />
        <span className="font-mono text-[9px] tracking-widest text-ink-faint">v0.1</span>
      </div>
    </aside>
  )
}
