import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/state/appStore'
import { sfx } from '@/lib/sfx'

const LINES = [
  'ORION KERNEL v0.1.0',
  'INITIALIZING CORE MODULES...',
  'LOADING YARD REGISTRY [CODING | RESEARCH]...',
  'CALIBRATING ORB INTERFACE...',
  'MOUNTING TOOL PROVIDERS...',
  'SYSTEM READY.',
]

export function BootScreen() {
  const boot = useAppStore((s) => s.boot)
  const [line, setLine] = useState(0)
  const [dots, setDots] = useState(0)

  useEffect(() => {
    sfx.boot()
    const lineInt = setInterval(() => {
      setLine((l) => {
        if (l >= LINES.length - 1) {
          clearInterval(lineInt)
          return l
        }
        return l + 1
      })
    }, 420)
    const dotInt = setInterval(() => setDots((d) => (d + 1) % 4), 260)
    const bootTimer = setTimeout(boot, 3600)
    return () => {
      clearInterval(lineInt)
      clearInterval(dotInt)
      clearTimeout(bootTimer)
    }
  }, [boot])

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="dot-grid flex h-full w-full flex-col items-center justify-center bg-void"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-crimson-500/40 bg-crimson-500/10 glow-crimson"
      >
        <div className="flex flex-wrap justify-center gap-1" style={{ width: 40 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-crimson-500"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, delay: i * 0.08, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, letterSpacing: '0.1em' }}
        animate={{ opacity: 1, letterSpacing: '0.45em' }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className="font-display text-3xl font-bold text-ink text-glow"
      >
        ORION
      </motion.h1>

      <div className="mt-8 h-36 w-72">
        {LINES.slice(0, line + 1).map((l, i) => (
          <motion.div
            key={l}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-mono text-[11px] tracking-widest text-crimson-400/90"
          >
            <span className="text-ink-faint">{'>'}</span> {l}
            {i === line && i < LINES.length - 1 ? '.'.repeat(dots) : ''}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
