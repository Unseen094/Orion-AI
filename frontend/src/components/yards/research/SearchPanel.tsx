import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Loader2, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import type { SearchResult } from '@/lib/api'

type Props = {
  onResults: (q: string, results: SearchResult[]) => void
}

export function SearchPanel({ onResults }: Props) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])

  const search = async () => {
    if (!q.trim() || loading) return
    setLoading(true)
    setResults([])
    try {
      const res = await api.research.search(q.trim())
      setResults(res)
      onResults(q.trim(), res)
    } catch {
      setResults([{ title: 'Search failed', url: '', snippet: 'Orion backend unavailable.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="flex w-72 shrink-0 flex-col border-r border-line bg-panel/40">
      <div className="border-b border-line p-3">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-void px-2.5 py-2 transition-colors focus-within:border-crimson-500/40">
          <Search size={13} className="shrink-0 text-crimson-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search the web..."
            className="flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink-faint"
          />
          {loading && <Loader2 size={13} className="animate-spin text-crimson-400" />}
        </div>
        <button
          onClick={search}
          disabled={loading || !q.trim()}
          className="mt-2 w-full rounded-lg bg-crimson-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-crimson-500 disabled:opacity-40"
        >
          {loading ? 'SEARCHING...' : 'SEARCH'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {results.length === 0 && !loading && (
          <p className="px-1 text-center text-[11px] leading-relaxed text-ink-faint">
            Results will appear here.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {results.map((r, i) => (
            <motion.a
              key={i}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group rounded-lg border border-line bg-panel p-2.5 transition-colors hover:border-crimson-500/40"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-xs font-medium text-ink group-hover:text-crimson-300">
                    {r.title}
                  </div>
                  <div className="mt-0.5 line-clamp-3 text-[10px] leading-relaxed text-ink-faint">
                    {r.snippet}
                  </div>
                </div>
                {r.url && <ExternalLink size={11} className="mt-0.5 shrink-0 text-ink-faint" />}
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}
