import { useYardStore } from '@/state/yardStore'

export function TopBar() {
  const active = useYardStore((s) => s.active)
  const status = useYardStore((s) => s.status)
  const currentProject = useYardStore((s) => s.currentProject)

  const title = active
    ? active === 'coding'
      ? `Coding Yard${currentProject ? ` — ${currentProject.name}` : ''}`
      : 'Research Yard'
    : 'ORION'

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-panel/40 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="font-display text-sm font-semibold tracking-[0.3em] text-ink">
          {title.toUpperCase()}
        </span>
        {active && (
          <span className="rounded-full border border-crimson-500/30 bg-crimson-500/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-crimson-400">
            {status === 'open' ? 'ACTIVE' : 'SYNCING'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-ink-faint">
        <span className="hidden sm:inline">LOCAL://</span>
        <span className="text-crimson-400">127.0.0.1</span>
      </div>
    </header>
  )
}
