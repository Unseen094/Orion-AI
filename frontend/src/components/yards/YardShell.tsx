import { AnimatePresence, motion } from 'framer-motion'
import { X, Code2, Search } from 'lucide-react'
import type { ComponentType } from 'react'
import { useYardStore } from '@/state/yardStore'
import type { YardId } from '@/state/yardStore'
import { CodingYard } from './coding/CodingYard'
import { ResearchYard } from './research/ResearchYard'

const YARDS: Record<YardId, { name: string; icon: typeof Code2; comp: ComponentType }> = {
  coding: { name: 'Coding Yard', icon: Code2, comp: CodingYard },
  research: { name: 'Research Yard', icon: Search, comp: ResearchYard },
}

export function YardShell() {
  const active = useYardStore((s) => s.active)
  const closeYard = useYardStore((s) => s.closeYard)

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-t-2xl border border-line bg-panel/70 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-panel-2/80 px-4">
            <div className="flex items-center gap-3">
              {(() => {
                const meta = YARDS[active]
                const Icon = meta.icon
                return (
                  <>
                    <Icon size={14} className="text-crimson-400" />
                    <span className="font-display text-xs font-semibold tracking-[0.25em] text-ink">
                      {meta.name.toUpperCase()}
                    </span>
                  </>
                )
              })()}
            </div>
            <button
              onClick={closeYard}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-crimson-600/20 hover:text-crimson-400"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            {(() => {
              const Comp = YARDS[active].comp
              return <Comp />
            })()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
