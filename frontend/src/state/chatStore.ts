import { create } from 'zustand'
import { useAppStore } from './appStore'
import { useYardStore } from './yardStore'
import { streamSSE } from '@/lib/utils'
import { sfx } from '@/lib/sfx'
import { speakText } from '@/lib/tts'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: boolean
  errorText?: string
}

type ChatState = {
  messages: ChatMessage[]
  streaming: boolean
  send: (text: string) => Promise<void>
  stop: () => void
  clear: () => void
}

let seq = 0
const uid = () => `m${Date.now()}_${seq++}`

const abortCtrl: { current: AbortController | null } = { current: null }

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,

  send: async (text: string) => {
    if (!text.trim() || get().streaming) return
    const app = useAppStore.getState()
    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text }
    const assistantMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      streaming: true,
    }))
    app.setOrb('thinking')
    sfx.think()

    const ctrl = new AbortController()
    abortCtrl.current = ctrl

    try {
      await streamSSE(
        '/api/chat/stream',
        {
          message: text,
          history: get()
            .messages.slice(0, -1)
            .map((m) => ({ role: m.role, content: m.content })),
          model: app.settings.model,
          offline: app.settings.offlineMode,
        },
        {
          onEvent: (ev) => {
            const type = ev.type as string
            if (type === 'token') {
              const piece = (ev.text as string) ?? ''
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + piece } : m,
                ),
              }))
            } else if (type === 'yard.open') {
              useYardStore.getState().openYard(ev.yard as 'coding' | 'research')
            } else if (type === 'yard.close') {
              useYardStore.getState().closeYard()
            } else if (type === 'orb') {
              app.setOrb(ev.state as 'thinking' | 'executing' | 'idle')
            } else if (type === 'tool') {
              app.setOrb('executing')
            } else if (type === 'error') {
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, error: true, errorText: (ev.message as string) || 'Orion hit an error.' }
                    : m,
                ),
              }))
            }
          },
          onError: (_err) => {
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      streaming: false,
                      error: true,
                      content:
                        m.content ||
                        'Connection to Orion failed. Check that the backend is running (python -m uvicorn app.main:app --port 8000).',
                    }
                  : m,
              ),
            }))
          },
          onDone: () => {
            set((s) => {
              const final = s.messages.map((m) =>
                m.id === assistantMsg.id ? { ...m, streaming: false } : m,
              )
              const text = final.find((m) => m.id === assistantMsg.id)?.content ?? ''
              const tts = useAppStore.getState().settings.ttsEnabled
              if (tts && text) {
                const st = useAppStore.getState().settings
                speakText(text, {
                  engine: st.ttsEngine,
                  voice: st.ttsVoice,
                  geminiVoice: st.ttsGeminiVoice,
                })
              }
              return { messages: final, streaming: false }
            })
            app.setOrb('idle')
            sfx.done()
          },
        },
        ctrl.signal,
      )
    } catch (_err) {
      const aborted = _err instanceof DOMException && _err.name === 'AbortError'
      if (!aborted) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, streaming: false, error: true, content: m.content || 'Orion hit an error.' }
              : m,
          ),
          streaming: false,
        }))
        app.setOrb('idle')
      }
    }
  },

  stop: () => {
    abortCtrl.current?.abort()
    set((s) => ({
      messages: s.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
      streaming: false,
    }))
    useAppStore.getState().setOrb('idle')
  },

  clear: () => set({ messages: [] }),
}))
