import { useAppStore } from '@/state/appStore'
import { useYardStore } from '@/state/yardStore'

export function StatusBar() {
  const orb = useAppStore((s) => s.orb)
  const settings = useAppStore((s) => s.settings)
  const active = useYardStore((s) => s.active)

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-panel/40 px-4 font-mono text-[10px] tracking-widest text-ink-faint backdrop-blur-md">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-crimson-500 animate-pulse" />
          CORE ONLINE
        </span>
        <span className="hidden md:inline">
          YARD: <span className="text-ink-dim">{active ? active.toUpperCase() : 'NONE'}</span>
        </span>
        <span className="hidden md:inline">
          ORB: <span className="text-ink-dim">{orb.toUpperCase()}</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>{settings.model}</span>
        <span className="hidden sm:inline">{settings.offlineMode ? 'OFFLINE MODE' : 'LIVE'}</span>
      </div>
    </footer>
  )
}
