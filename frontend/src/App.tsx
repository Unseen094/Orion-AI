import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/state/appStore'
import { useYardStore } from '@/state/yardStore'
import { BootScreen } from '@/components/shell/BootScreen'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopBar } from '@/components/shell/TopBar'
import { StatusBar } from '@/components/shell/StatusBar'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { YardShell } from '@/components/yards/YardShell'
import { ControlMonitor } from '@/components/control/ControlMonitor'
import { HomePage } from '@/pages/HomePage'
import { YardsPage } from '@/pages/YardsPage'
import { PluginsPage } from '@/pages/PluginsPage'
import { ModelsPage } from '@/pages/ModelsPage'
import { SettingsPage } from '@/pages/SettingsPage'

function ViewHost() {
  const view = useAppStore((s) => s.view)
  const activeYard = useYardStore((s) => s.active)
  if (activeYard) return null
  switch (view) {
    case 'yards':
      return <YardsPage />
    case 'plugins':
      return <PluginsPage />
    case 'models':
      return <ModelsPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <HomePage />
  }
}

export default function App() {
  const booted = useAppStore((s) => s.booted)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const yard = useYardStore.getState()
        if (yard.active) yard.closeYard()
        fetch('/api/system/kill', { method: 'POST' }).catch(() => {})
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('orion:focus-chat'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-void">
      <AnimatePresence>
        {!booted && <BootScreen />}
      </AnimatePresence>
      {booted && (
        <div className="flex h-full w-full">
          <Sidebar />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="relative flex-1 overflow-hidden">
              <ViewHost />
              <YardShell />
              <ControlMonitor />
            </main>
            <StatusBar />
          </div>
          <ChatPanel />
        </div>
      )}
    </div>
  )
}
