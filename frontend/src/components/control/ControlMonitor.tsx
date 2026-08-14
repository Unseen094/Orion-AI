import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Keyboard as KeyboardIcon, MousePointerClick } from 'lucide-react'
import { streamSSE } from '@/lib/utils'

type SystemAction = {
  id: number
  kind: 'type' | 'click' | 'move' | 'key'
  target?: string
  done: boolean
}

let actionSeq = 0

export function ControlMonitor() {
  const [actions, setActions] = useState<SystemAction[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let mounted = true
    streamSSE('/api/system/events', { subscribe: true }, {
      onEvent: (ev) => {
        if (!mounted) return
        if (ev.type === 'system.action') {
          setActions((prev) => [
            ...prev.slice(-4),
            { id: ++actionSeq, kind: ev.kind as SystemAction['kind'], target: ev.target as string | undefined, done: false },
          ])
          setVisible(true)
        } else if (ev.type === 'system.done') {
          setActions((prev) => prev.map((a) => (a.id === (ev.id as number) ? { ...a, done: true } : a)))
        }
      },
      onDone: () => {},
      onError: () => {},
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [visible, actions.length])

  return (
    <AnimatePresence>
      {visible && actions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="absolute right-4 top-4 z-30 w-72 overflow-hidden rounded-xl border border-crimson-500/40 bg-panel/90 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <MousePointerClick size={12} className="text-crimson-400 animate-pulse" />
            <span className="font-mono text-[9px] tracking-[0.3em] text-ink-faint">
              SYSTEM CONTROL ACTIVE
            </span>
          </div>
          <div className="flex flex-col gap-1.5 p-3">
            {actions.slice(-3).map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                {a.kind === 'type' ? (
                  <KeyboardIcon size={11} className="shrink-0 text-crimson-400" />
                ) : (
                  <MousePointerClick size={11} className="shrink-0 text-crimson-400" />
                )}
                <span className="truncate font-mono text-[10px] text-ink-dim">
                  {a.kind === 'type'
                    ? `TYPING: "${a.target ?? ''}"`
                    : a.kind === 'key'
                      ? `KEY: ${a.target}`
                      : a.kind === 'move'
                        ? `MOVE: ${a.target}`
                        : `CLICK: ${a.target ?? 'left'}`}
                </span>
                {a.done && <span className="ml-auto text-crimson-400">✓</span>}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
