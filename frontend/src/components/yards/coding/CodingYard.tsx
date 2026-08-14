import { ProjectList } from './ProjectList'
import { MonacoPane } from './MonacoPane'
import { ConsolePanel } from './ConsolePanel'

export function CodingYard() {
  return (
    <div className="flex w-full overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel/50">
        <ProjectList />
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">
        <MonacoPane />
        <ConsolePanel />
      </main>
    </div>
  )
}
