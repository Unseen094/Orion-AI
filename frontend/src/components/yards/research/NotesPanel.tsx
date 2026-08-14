import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { StickyNote, Plus, Trash2, Loader2 } from 'lucide-react'
import { useYardStore } from '@/state/yardStore'
import { api } from '@/lib/api'

export function NotesPanel() {
  const { notes, setNotes, addNote } = useYardStore()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.research.notes.list().then(setNotes).catch(() => {})
  }, [setNotes])

  const save = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      const note = await api.research.notes.create(text.trim(), [])
      addNote(note)
      setText('')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    await api.research.notes.remove(id).catch(() => {})
    setNotes(notes.filter((n) => n.id !== id))
  }

  return (
    <section className="flex w-72 shrink-0 flex-col border-l border-line bg-panel/40">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <StickyNote size={14} className="text-crimson-400" />
        <span className="font-mono text-[10px] tracking-[0.25em] text-ink-faint">NOTES</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {notes.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group rounded-lg border border-line bg-panel p-2.5"
            >
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-dim">{n.text}</p>
              <button
                onClick={() => remove(n.id)}
                className="mt-1.5 flex items-center gap-1 font-mono text-[9px] tracking-widest text-ink-faint opacity-0 transition-opacity hover:text-crimson-400 group-hover:opacity-100"
              >
                <Trash2 size={9} /> DELETE
              </button>
            </motion.div>
          ))}
          {notes.length === 0 && (
            <p className="px-1 text-center text-[11px] text-ink-faint">No notes yet.</p>
          )}
        </div>
      </div>

      <div className="border-t border-line p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
          }}
          rows={3}
          placeholder="Capture a thought (Ctrl+Enter to save)..."
          className="w-full resize-none rounded-lg border border-line bg-void px-2.5 py-2 text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-crimson-500/40"
        />
        <button
          onClick={save}
          disabled={saving || !text.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-crimson-500/40 py-1.5 text-[11px] font-medium text-crimson-400 transition-colors hover:bg-crimson-600/20 disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          ADD NOTE
        </button>
      </div>
    </section>
  )
}
