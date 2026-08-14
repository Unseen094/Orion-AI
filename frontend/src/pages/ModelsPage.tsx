import { motion } from 'framer-motion'
import { BrainCircuit, Gauge, Zap, Route } from 'lucide-react'
import { useAppStore } from '@/state/appStore'

const MODELS = [
  {
    name: 'Gemini 2.5 Flash',
    id: 'gemini-2.5-flash',
    spec: 'LATENCY 0.7s · STREAMING · TOOLS',
    icon: Zap,
    tag: 'SYSTEM',
  },
  {
    name: 'Gemini 2.5 Pro',
    id: 'gemini-2.5-pro',
    spec: 'DEEP REASONING · LONG CONTEXT',
    icon: BrainCircuit,
    tag: 'AVAILABLE',
  },
  {
    name: 'Gemini 2.0 Flash',
    id: 'gemini-2.0-flash',
    spec: 'LEGACY · LOW COST',
    icon: Gauge,
    tag: 'AVAILABLE',
  },
  {
    name: 'Per-Yard Routing',
    id: 'routing',
    spec: 'CODING → REASONING · RESEARCH → GROUNDED',
    icon: Route,
    tag: 'ROADMAP',
  },
]

export function ModelsPage() {
  const settings = useAppStore((s) => s.settings)
  return (
    <div className="flex h-full flex-col overflow-y-auto p-8">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-1 font-display text-2xl font-semibold tracking-wide text-ink">
        MODELS
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-8 text-sm text-ink-dim">
        Active model: <span className="text-crimson-400">{settings.model}</span>. Bring your own key to switch.
      </motion.p>

      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {MODELS.map(({ name, id, spec, icon: Icon, tag }, i) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            className={`rounded-xl border p-5 ${settings.model === id ? 'border-crimson-500/50 bg-crimson-500/5' : 'border-line bg-panel'}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <Icon size={18} className="text-crimson-400" />
              <span className="font-mono text-[9px] tracking-widest text-ink-faint">{tag}</span>
            </div>
            <div className="text-sm font-medium text-ink">{name}</div>
            <div className="mt-1 font-mono text-[10px] tracking-widest text-ink-faint">{spec}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
