import { useState } from 'react'
import { SearchPanel } from './SearchPanel'
import { SummaryPanel } from './SummaryPanel'
import { NotesPanel } from './NotesPanel'
import type { SearchResult } from '@/lib/api'

export function ResearchYard() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  return (
    <div className="flex w-full overflow-hidden">
      <SearchPanel onResults={(q, r) => {
        setQuery(q)
        setResults(r)
      }} />
      <SummaryPanel query={query} results={results} />
      <NotesPanel />
    </div>
  )
}
