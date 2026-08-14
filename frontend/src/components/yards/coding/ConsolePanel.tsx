import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Trash2, ChevronDown, ChevronUp, TerminalSquare } from 'lucide-react'
import { useYardStore } from '@/state/yardStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function ConsolePanel() {
  const { currentProject, consoleLines, pushConsole, clearConsole } = useYardStore()
  const [open, setOpen] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    clearConsole()
  }, [currentProject?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    if (!currentProject || running) return
    setRunning(true)
    clearConsole()
    try {
      const { lines } = await api.projects.run(currentProject.id)
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
      for (const line of lines) {
        pushConsole(line)
        await delay(180)
      }
    } catch {
      pushConsole('$ error: failed to run project')
    } finally {
      setRunning(false)
    }
  }

  if (!currentProject) return null

  return (
    <div className="shrink-0 border-t border-line bg-void/70">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.25em] text-ink-faint hover:text-ink"
          >
            {open ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            <TerminalSquare size={12} className="text-crimson-400" />
            CONSOLE
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={run}
            disabled={running}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-widest transition-colors',
              running
                ? 'border-line-2 text-ink-faint'
                : 'border-crimson-500/40 text-crimson-400 hover:bg-crimson-600/20',
            )}
          >
            <Play size={11} />
            {running ? 'RUNNING...' : 'RUN'}
          </button>
          <button
            onClick={clearConsole}
            className="rounded-md border border-line px-2 py-0.5 text-ink-faint hover:text-ink"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {open && (
        <div className="max-h-40 overflow-y-auto px-3 pb-2 font-mono text-[11px] leading-relaxed">
          {consoleLines.length === 0 && (
            <span className="text-ink-faint">$ ready. press RUN or ask Orion to run it.</span>
          )}
          {consoleLines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={line.startsWith('$') ? 'text-crimson-300' : 'text-ink-dim'}
            >
              {line}
            </motion.div>
          ))}
          {running && <span className="text-crimson-400 animate-pulse">▊</span>}
        </div>
      )}
    </div>
  )
}
