import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/state/appStore'
import { ORB_STATES } from './orbStates'
import { OrbCanvas } from './OrbCanvas'

export function Orb({ size = 300 }: { size?: number }) {
  const orb = useAppStore((s) => s.orb)
  const label = ORB_STATES[orb]?.label ?? 'STANDING BY'

  return (
    <div className="relative flex flex-col items-center justify-center">
      <motion.div
        className="relative rounded-full"
        animate={{
          scale: orb === 'thinking' ? 1.08 : orb === 'executing' ? 1.05 : 1,
          filter: orb === 'thinking' ? 'drop-shadow(0 0 34px rgba(255,45,45,0.5))' : 'drop-shadow(0 0 22px rgba(255,45,45,0.3))',
        }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      >
        <OrbCanvas state={orb} size={size} />
        <div className="pointer-events-none absolute inset-0 rounded-full border border-crimson-500/15" />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="mt-4 flex items-center gap-2 font-mono text-[11px] tracking-[0.35em] text-crimson-400"
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full bg-crimson-500 ${
              orb === 'idle' ? 'animate-pulse-slow' : 'animate-pulse'
            }`}
          />
          {label}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
