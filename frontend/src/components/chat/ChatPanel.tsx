import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ArrowUp, Square, Sparkles, Mic, Trash2 } from 'lucide-react'
import { useChatStore } from '@/state/chatStore'
import { useAppStore } from '@/state/appStore'
import { ChatMessage, ThinkingIndicator } from './ChatMessage'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

type SpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const clear = useChatStore((s) => s.clear)
  const setOrb = useAppStore((s) => s.setOrb)
  const sttLang = useAppStore((s) => s.settings.sttLang)
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    window.addEventListener('orion:focus-chat', focus)
    return () => window.removeEventListener('orion:focus-chat', focus)
  }, [])

  const submit = () => {
    if (!input.trim()) return
    send(input)
    setInput('')
  }

  const toggleMic = async () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      alert('Speech recognition is not available in this browser. Please use Chrome or Edge.')
      return
    }
    if (listening) {
      recRef.current?.stop()
      return
    }
    try {
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = sttLang || 'en-US'
      rec.onresult = (e) => {
        let text = ''
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0]?.transcript ?? ''
        }
        setInput(text)
      }
      rec.onend = () => {
        setListening(false)
        setOrb('idle')
        recRef.current = null
      }
      rec.onerror = () => {
        console.error('Speech recognition error')
        setListening(false)
        setOrb('idle')
        recRef.current = null
      }
      recRef.current = rec
      setListening(true)
      setOrb('listening')
      await rec.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      setListening(false)
      setOrb('idle')
    }
  }

  return (
    <section className="flex w-80 shrink-0 flex-col border-l border-line bg-panel/50 backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-crimson-400" />
          <span className="font-display text-xs font-semibold tracking-[0.25em] text-ink">ORION AI</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all messages and context?')) {
                  clear()
                }
              }}
              title="Clear chat"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-ink-faint transition-colors hover:border-red-800 hover:text-red-400"
            >
              <Trash2 size={11} />
            </button>
          )}
          <span className="h-1.5 w-1.5 rounded-full bg-crimson-500 animate-pulse-slow" />
        </div>
      </header>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !streaming && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="font-mono text-[10px] tracking-[0.3em] text-ink-faint">AWAITING INPUT</p>
            <p className="max-w-[220px] text-xs leading-relaxed text-ink-dim">
              Ask Orion to build something, research something, or control this machine.
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
        </AnimatePresence>
        {streaming && messages[messages.length - 1]?.content === '' && <ThinkingIndicator />}
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-void p-2 transition-colors focus-within:border-crimson-500/40">
          <button
            onClick={toggleMic}
            title={listening ? 'Stop listening' : 'Voice input'}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
              listening
                ? 'border-crimson-500 bg-crimson-600/20 text-crimson-400 animate-pulse'
                : 'border-line text-ink-faint hover:text-crimson-400',
            )}
          >
            <Mic size={14} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={2}
            placeholder={listening ? 'Listening...' : 'Command Orion...'}
            className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
          {streaming ? (
            <button
              onClick={stop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-crimson-500/40 text-crimson-400 transition-colors hover:bg-crimson-600/20"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-crimson-600 text-white transition-all hover:bg-crimson-500 disabled:opacity-30"
            >
              <ArrowUp size={15} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center font-mono text-[9px] tracking-widest text-ink-faint">
          ESC TO ABORT SYSTEM ACTIONS · CTRL+K TO FOCUS
        </p>
      </div>
    </section>
  )
}
