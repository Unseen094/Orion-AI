import { motion } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChatMessage as Message } from '@/state/chatStore'
import { speakText, stopSpeak } from '@/lib/tts'
import { useAppStore } from '@/state/appStore'
import { cn } from '@/lib/utils'

export function StreamingText({ text }: { text: string }) {
  return <span>{text}</span>
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [speaking, setSpeaking] = useState(false)
  const usable = !message.streaming && !!message.content && !message.error

  useEffect(() => () => stopSpeak(), [])

  const toggleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (speaking) {
      stopSpeak()
      setSpeaking(false)
    } else {
      const st = useAppStore.getState().settings
      speakText(message.content, {
        engine: st.ttsEngine,
        voice: st.ttsVoice,
        geminiVoice: st.ttsGeminiVoice,
        onEnd: () => setSpeaking(false),
      })
      setSpeaking(true)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'border border-crimson-500/40 bg-crimson-600/15 text-ink'
            : 'border border-line bg-panel text-ink-dim',
          message.error && 'border-red-800 bg-red-900/20 text-red-300',
        )}
      >
        {message.streaming && !message.content && (
          <span className="inline-flex gap-1">
            <motion.span className="h-1.5 w-1.5 rounded-full bg-crimson-400" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity }} />
            <motion.span className="h-1.5 w-1.5 rounded-full bg-crimson-400" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity, delay: 0.15 }} />
            <motion.span className="h-1.5 w-1.5 rounded-full bg-crimson-400" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity, delay: 0.3 }} />
          </span>
        )}
        {message.content && <StreamingText text={message.content} />}
        {!isUser && usable && (
          <button
            onClick={toggleSpeak}
            title={speaking ? 'Stop speaking' : 'Speak this reply (local voice)'}
            className={cn(
              'mt-1.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors',
              speaking
                ? 'border-crimson-500/50 bg-crimson-600/15 text-crimson-400'
                : 'border-line text-ink-faint hover:text-crimson-400',
            )}
          >
            {speaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
            {speaking ? 'STOP' : 'SPEAK'}
          </button>
        )}
        {message.errorText && (
          <div className="mt-2 rounded-lg border border-red-800/60 bg-red-950/40 px-2.5 py-1.5 text-[11px] leading-snug text-red-300">
            {message.errorText}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-crimson-400">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-crimson-500 animate-pulse" />
      ORION IS PROCESSING
    </div>
  )
}
