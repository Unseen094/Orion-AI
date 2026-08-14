import * as React from 'react'
import { useEffect, useRef } from 'react'
import { BookOpenText, Sparkles } from 'lucide-react'
import { streamSSE } from '@/lib/utils'
import { useAppStore } from '@/state/appStore'
import type { SearchResult } from '@/lib/api'

type Props = {
  query: string
  results: SearchResult[]
}

export function SummaryPanel({ query, results }: Props) {
  const [summary, setSummary] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const seqRef = useRef(0)

  const settings = useAppStore((s) => s.settings)

  useEffect(() => {
    if (!query || results.length === 0) return
    const seq = ++seqRef.current
    setSummary('')
    setLoading(true)
    const ctrl = new AbortController()
    streamSSE(
      '/api/research/summarize',
      { query, results, model: settings.model, offline: settings.offlineMode },
      {
        onEvent: (ev) => {
          if (seq !== seqRef.current) return
          if (ev.type === 'token') setSummary((s) => s + (ev.text as string))
          else if (ev.type === 'done') setLoading(false)
        },
        onDone: () => {
          if (seq === seqRef.current) setLoading(false)
        },
        onError: () => {
          if (seq === seqRef.current) setLoading(false)
        },
      },
      ctrl.signal,
    )
    return () => {
      ctrl.abort()
    }
  }, [query, results, settings.model, settings.offlineMode])

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <BookOpenText size={14} className="text-crimson-400" />
        <span className="font-mono text-[10px] tracking-[0.25em] text-ink-faint">AI SUMMARY</span>
        {loading && <Sparkles size={13} className="ml-auto animate-pulse text-crimson-400" />}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!query && (
          <p className="text-center font-mono text-[10px] tracking-[0.3em] text-ink-faint">
            AWAITING SEARCH
          </p>
        )}
        {loading && !summary && (
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-crimson-400 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-crimson-400 animate-pulse [animation-delay:0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-crimson-400 animate-pulse [animation-delay:0.3s]" />
          </div>
        )}
        {summary && (
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-dim">{summary}</div>
        )}
      </div>
    </section>
  )
}
