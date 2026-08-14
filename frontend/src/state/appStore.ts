import { create } from 'zustand'

export type View = 'home' | 'yards' | 'plugins' | 'models' | 'settings'
export type OrbState = 'idle' | 'thinking' | 'listening' | 'executing'

export type Settings = {
  apiKeySet: boolean
  model: string
  offlineMode: boolean
  simMode: boolean
  soundEnabled: boolean
  ttsEnabled: boolean
  ttsVoice: string
  ttsEngine: 'web' | 'gemini'
  ttsGeminiVoice: string
  sttLang: string
}

type AppState = {
  booted: boolean
  view: View
  orb: OrbState
  settings: Settings
  boot: () => void
  setView: (v: View) => void
  setOrb: (s: OrbState) => void
  setSettings: (s: Partial<Settings>) => void
  resetAll: () => void
}

export const useAppStore = create<AppState>((set) => ({
  booted: false,
  view: 'home',
  orb: 'idle',
  settings: { apiKeySet: false, model: 'gemini-2.5-flash', offlineMode: false, simMode: true, soundEnabled: true, ttsEnabled: false, ttsVoice: '', ttsEngine: 'web', ttsGeminiVoice: 'Kore', sttLang: 'en-US' },
  boot: () => set({ booted: true }),
  setView: (view) => set({ view }),
  setOrb: (orb) => set({ orb }),
  setSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),
  resetAll: () =>
    set({ settings: { apiKeySet: false, model: 'gemini-2.5-flash', offlineMode: false, simMode: true, soundEnabled: true, ttsEnabled: false, ttsVoice: '', ttsEngine: 'web', ttsGeminiVoice: 'Kore', sttLang: 'en-US' } }),
}))
