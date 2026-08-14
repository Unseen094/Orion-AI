import { motion } from 'framer-motion'
import { Code2, Search, MousePointer2 } from 'lucide-react'
import { Orb } from '@/components/orb/Orb'
import { useChatStore } from '@/state/chatStore'

const QUICK = [
  { icon: Code2, text: 'Open coding yard and build a to-do app' },
  { icon: Search, text: 'Research quantum computing' },
  { icon: MousePointer2, text: 'Open Notepad and type ORION' },
]

export function HomePage() {
  const send = useChatStore((s) => s.send)

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden dot-grid-crimson">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <div className="mb-2 font-mono text-[10px] tracking-[0.5em] text-ink-faint">
          THE OPEN-SOURCE AI OPERATING SYSTEM
        </div>
        <Orb size={320} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: 'easeOut' }}
        className="mt-10 flex flex-wrap items-center justify-center gap-2 px-6"
      >
        <span className="font-mono text-[10px] tracking-widest text-ink-faint">TRY:</span>
        {QUICK.map(({ icon: Icon, text }) => (
          <button
            key={text}
            onClick={() => send(text)}
            className="flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3.5 py-1.5 text-xs text-ink-dim transition-all hover:border-crimson-500/40 hover:text-ink hover:glow-crimson"
          >
            <Icon size={13} className="text-crimson-400" />
            {text}
          </button>
        ))}
      </motion.div>
    </div>
  )
}
