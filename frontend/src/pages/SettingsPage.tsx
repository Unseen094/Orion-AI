import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Cpu,
  Plus,
  Star,
  Trash2,
  Pencil,
  WifiOff,
  MousePointerClick,
  Volume2,
  VolumeX,
  ScrollText,
  KeyRound,
  X,
  FlaskConical,
  AudioLines,
  RefreshCw,
} from 'lucide-react'
import { useAppStore } from '@/state/appStore'
import { cn } from '@/lib/utils'
import { sfx, setSoundEnabled } from '@/lib/sfx'
import { getVoices, initVoices } from '@/lib/tts'

export type Provider = {
  id: string
  name: string
  type: 'gemini' | 'openai'
  base_url: string
  api_key: string
  api_key_set: boolean
  model: string
  enabled: boolean
  is_default: boolean
}

const PRESETS: Array<{ name: string; type: 'openai'; base_url: string; model: string }> = [
  { name: 'Ollama', type: 'openai', base_url: 'http://localhost:11434/v1', model: 'llama3.2' },
  { name: 'LM Studio', type: 'openai', base_url: 'http://localhost:1234/v1', model: 'local-model' },
  { name: 'OpenAI', type: 'openai', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'Groq', type: 'openai', base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  { name: 'OpenRouter', type: 'openai', base_url: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct' },
]

const STT_LANGS: Array<[string, string]> = [
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['en-IN', 'English (India)'],
  ['hi-IN', 'Hindi'],
  ['es-ES', 'Spanish'],
  ['fr-FR', 'French'],
  ['de-DE', 'German'],
  ['ja-JP', 'Japanese'],
  ['zh-CN', 'Chinese (Simplified)'],
  ['ar-SA', 'Arabic'],
  ['pt-BR', 'Portuguese (BR)'],
  ['ru-RU', 'Russian'],
]

const GEMINI_VOICES = [
  'Kore', 'Puck', 'Ardent', 'Zephyr', 'Aoede', 'Charon', 'Fenrir', 'Leda', 'Orus',
]

const EMPTY_FORM = {
  name: '',
  type: 'openai' as Provider['type'],
  base_url: '',
  api_key: '',
  model: '',
  enabled: true,
  is_default: false,
}

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const resetAll = useAppStore((s) => s.resetAll)
  const [providers, setProviders] = useState<Provider[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string; latency?: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    initVoices()
    setVoices(getVoices())
    setTimeout(() => setVoices(getVoices()), 500)
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          apiKeySet: data.api_key_set,
          model: data.model || settings.model,
          offlineMode: !!data.offline_mode,
          simMode: data.sim_mode !== false,
          ttsEnabled: !!data.tts_enabled,
          ttsVoice: data.tts_voice || '',
          ttsEngine: data.tts_engine || 'web',
          ttsGeminiVoice: data.tts_gemini_voice || 'Kore',
          sttLang: data.stt_lang || 'en-US',
        })
      })
      .catch(() => {})
    loadProviders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProviders = async () => {
    try {
      const data = await fetch('/api/settings/providers').then((r) => r.json())
      setProviders(data.providers ?? [])
    } catch {
      /* backend down */
    }
  }

  const saveProviders = async (next: Provider[]) => {
    setSaving(true)
    try {
      const data = await fetch('/api/settings/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: next }),
      }).then((r) => r.json())
      setProviders(data.providers ?? next)
      const def = (data.providers ?? next).find((p: Provider) => p.is_default)
      setSettings({ model: def?.model || settings.model })
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  const testProvider = async (p: Provider) => {
    setTestingId(p.id)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p }),
      }).then((r) => r.json())
      setTestResult({ id: p.id, ok: !!res.ok, message: res.message || '', latency: res.latency_ms })
    } catch {
      setTestResult({ id: p.id, ok: false, message: 'Test request failed' })
    } finally {
      setTestingId(null)
    }
  }

  const submitForm = async () => {
    if (!form.name.trim()) return
    const id = editingId ?? `p-${Date.now()}`
    const next = [...providers]
    const existing = next.find((p) => p.id === id)
    const entry: Provider = {
      id,
      name: form.name.trim(),
      type: form.type,
      base_url: form.base_url.trim(),
      api_key: form.api_key.trim(),
      api_key_set: existing?.api_key_set ?? false,
      model: form.model.trim(),
      enabled: form.enabled,
      is_default: form.is_default,
    }
    if (existing) {
      existing.api_key_set = existing.api_key_set || !!entry.api_key
      Object.assign(existing, entry)
    } else {
      next.push(entry)
    }
    if (entry.is_default) next.forEach((p) => (p.is_default = p.id === id))
    await saveProviders(next)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const setDefault = async (id: string) => {
    await saveProviders(providers.map((p) => ({ ...p, is_default: p.id === id })))
  }

  const toggleEnabled = async (id: string) => {
    await saveProviders(providers.map((p) => ({ ...p, enabled: p.id === id ? !p.enabled : p.enabled })))
  }

  const removeProvider = async (id: string) => {
    if (providers.length <= 1) return
    await saveProviders(providers.filter((p) => p.id !== id))
  }

  const startEdit = (p: Provider) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      type: p.type,
      base_url: p.base_url,
      api_key: '',
      model: p.model,
      enabled: p.enabled,
      is_default: p.is_default,
    })
    setShowForm(true)
  }

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setForm({ ...EMPTY_FORM, name: preset.name, type: preset.type, base_url: preset.base_url, model: preset.model })
    setEditingId(null)
    setShowForm(true)
  }

  const toggleOffline = async () => {
    const next = !settings.offlineMode
    setSettings({ offlineMode: next })
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offline_mode: next }),
    }).catch(() => {})
  }

  const toggleSim = async () => {
    const next = !settings.simMode
    setSettings({ simMode: next })
    await fetch('/api/settings/sim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sim_mode: next }),
    }).catch(() => {})
  }

  const toggleSound = () => {
    const next = !settings.soundEnabled
    setSettings({ soundEnabled: next })
    setSoundEnabled(next)
    if (next) sfx.done()
  }

  const toggleTts = async () => {
    const next = !settings.ttsEnabled
    setSettings({ ttsEnabled: next })
    if (next) sfx.done()
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_enabled: next }),
    }).catch(() => {})
  }

  const setVoice = async (v: string) => {
    setSettings({ ttsVoice: v })
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_voice: v }),
    }).catch(() => {})
  }

  const setTtsEngine = async (engine: 'web' | 'gemini') => {
    setSettings({ ttsEngine: engine })
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_engine: engine }),
    }).catch(() => {})
  }

  const setGeminiVoice = async (v: string) => {
    setSettings({ ttsGeminiVoice: v })
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tts_gemini_voice: v }),
    }).catch(() => {})
  }

  const setSttLang = async (lang: string) => {
    setSettings({ sttLang: lang })
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stt_lang: lang }),
    }).catch(() => {})
  }

  const reset = async () => {
    await fetch('/api/settings/reset', { method: 'POST' }).catch(() => {})
    resetAll()
    loadProviders()
  }

  const [logLines, setLogLines] = useState<string[]>([])
  const loadLogs = async () => {
    try {
      const data = await fetch('/api/system/logs?lines=80').then((r) => r.json())
      setLogLines(data.lines ?? [])
    } catch {
      setLogLines(['(could not load logs — is the backend running?)'])
    }
  }

  useEffect(() => {
    loadLogs()
    const t = setInterval(loadLogs, 5000)
    return () => clearInterval(t)
  }, [])

  const inputCls =
    'flex-1 rounded-lg border border-line bg-void px-3 py-2 font-mono text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-crimson-500/50'
  const rowCls = 'rounded-lg border border-line bg-void px-3 py-2 text-[11px] font-mono text-ink-dim outline-none transition-colors focus:border-crimson-500/50'

  return (
    <div className="flex h-full flex-col overflow-y-auto p-8">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-1 font-display text-2xl font-semibold tracking-wide text-ink"
      >
        SETTINGS
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-8 text-sm text-ink-dim">
        Configure your Orion instance. All data stays on this machine.
      </motion.p>

      <div className="flex max-w-2xl flex-col gap-6">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-line bg-panel p-6"
        >
          <div className="mb-4 flex items-center gap-3">
            <Cpu size={17} className="text-crimson-400" />
            <h2 className="font-display text-sm font-medium tracking-wide text-ink">AI Providers</h2>
            <span className="rounded-full bg-crimson-500/15 px-2 py-0.5 font-mono text-[9px] tracking-widest text-crimson-400">
              {providers.filter((p) => p.enabled).length} ACTIVE
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {providers.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-line bg-void p-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDefault(p.id)}
                    title="Set as default"
                    className={cn(
                      'transition-colors',
                      p.is_default ? 'text-crimson-400' : 'text-ink-faint hover:text-crimson-400',
                    )}
                  >
                    <Star size={14} fill={p.is_default ? 'currentColor' : 'none'} />
                  </button>
                  <span className="text-xs font-semibold text-ink">{p.name}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-mono text-[9px] tracking-widest',
                      p.type === 'gemini' ? 'bg-crimson-500/15 text-crimson-400' : 'bg-line-2/60 text-ink-faint',
                    )}
                  >
                    {p.type === 'gemini' ? 'GEMINI' : 'OPENAI-COMPAT'}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-mono text-[9px] tracking-widest',
                      p.enabled ? 'bg-crimson-500/10 text-crimson-400/80' : 'bg-ink-dim/10 text-ink-faint',
                    )}
                  >
                    {p.enabled ? 'ON' : 'OFF'}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => testProvider(p)}
                      disabled={testingId === p.id}
                      className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[10px] font-medium text-ink-dim transition-colors hover:border-crimson-500/40 hover:text-crimson-400 disabled:opacity-40"
                    >
                      {testingId === p.id ? <RefreshCw size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                      TEST
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-faint transition-colors hover:border-crimson-500/40 hover:text-crimson-400"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => removeProvider(p.id)}
                      disabled={providers.length <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-faint transition-colors hover:border-red-800 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-[10px] font-mono text-ink-faint">
                  <span>model: {p.model || '—'}</span>
                  {p.type === 'openai' && <span>url: {p.base_url || '—'}</span>}
                  <span className={cn(p.api_key_set ? 'text-crimson-400/80' : '')}>
                    {p.api_key_set ? 'key: configured' : 'key: none'}
                  </span>
                  <button
                    onClick={() => toggleEnabled(p.id)}
                    className={cn(
                      'ml-auto relative h-5 w-9 rounded-full transition-colors',
                      p.enabled ? 'bg-crimson-600' : 'bg-line-2',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
                        p.enabled ? 'left-[18px]' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
                {testResult?.id === p.id && (
                  <div
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-[11px]',
                      testResult.ok ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300' : 'border-red-800/60 bg-red-950/30 text-red-300',
                    )}
                  >
                    {testResult.ok ? '✓' : '✗'} {testResult.message}
                    {testResult.latency != null && <span className="ml-2 font-mono text-[10px] opacity-70">{testResult.latency}ms</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((pr) => (
              <button
                key={pr.name}
                onClick={() => applyPreset(pr)}
                className="rounded-lg border border-line px-3 py-1.5 text-[10px] font-medium text-ink-dim transition-colors hover:border-crimson-500/40 hover:text-crimson-400"
              >
                + {pr.name}
              </button>
            ))}
          </div>

          {showForm && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-crimson-500/30 bg-void p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xs font-semibold tracking-wide text-ink">
                  {editingId ? 'EDIT PROVIDER' : 'ADD PROVIDER'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                  }}
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-md border border-line text-ink-faint hover:text-crimson-400"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-1 flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-widest text-ink-faint">NAME</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ollama" className={inputCls} />
                </label>
                <label className="col-span-1 flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-widest text-ink-faint">TYPE</span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as Provider['type'] })}
                    className={rowCls}
                  >
                    <option value="openai">OpenAI-compatible</option>
                    <option value="gemini">Google Gemini (native)</option>
                  </select>
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-widest text-ink-faint">
                    BASE URL {form.type === 'gemini' ? '(optional endpoint override)' : ''}
                  </span>
                  <input
                    value={form.base_url}
                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                    placeholder={form.type === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'http://localhost:11434/v1'}
                    className={inputCls}
                  />
                </label>
                <label className="col-span-1 flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-widest text-ink-faint">MODEL</span>
                  <input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder={form.type === 'gemini' ? 'gemini-2.5-flash' : 'llama3.2'}
                    className={inputCls}
                  />
                </label>
                <label className="col-span-1 flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-widest text-ink-faint">API KEY (optional — leave blank to keep)</span>
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                    placeholder="sk-..."
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-ink-dim">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                    className="accent-crimson-500"
                  />
                  enabled
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                    className="accent-crimson-500"
                  />
                  default provider
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => testProvider({ id: 'form', name: form.name, type: form.type, base_url: form.base_url, api_key: form.api_key, api_key_set: false, model: form.model, enabled: true, is_default: false } as Provider)}
                  disabled={testingId === 'form'}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[10px] font-medium text-ink-dim transition-colors hover:border-crimson-500/40 hover:text-crimson-400 disabled:opacity-40"
                >
                  {testingId === 'form' ? <RefreshCw size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                  TEST
                </button>
                <button
                  onClick={submitForm}
                  disabled={saving || !form.name.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-crimson-600 px-4 py-1.5 text-[10px] font-semibold text-white transition-all hover:bg-crimson-500 disabled:opacity-40"
                >
                  {editingId ? 'SAVE CHANGES' : 'ADD PROVIDER'}
                </button>
              </div>
              {testResult?.id === 'form' && (
                <div
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-[11px]',
                    testResult.ok ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300' : 'border-red-800/60 bg-red-950/30 text-red-300',
                  )}
                >
                  {testResult.ok ? '✓' : '✗'} {testResult.message}
                  {testResult.latency != null && <span className="ml-2 font-mono text-[10px] opacity-70">{testResult.latency}ms</span>}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              setEditingId(null)
              setForm(EMPTY_FORM)
              setShowForm(true)
            }}
            className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-[11px] font-medium text-ink-dim transition-colors hover:border-crimson-500/50 hover:text-crimson-400"
          >
            <Plus size={12} /> ADD PROVIDER
          </button>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
            <KeyRound size={12} className="mt-0.5 shrink-0 text-crimson-400/70" />
            Use Google Gemini with your own key, or any OpenAI-compatible endpoint — Ollama and LM Studio run fully offline on this machine. Keys are stored server-side and never shown again.
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-6"
        >
          <div className="flex items-center gap-3">
            {settings.ttsEnabled ? <Volume2 size={17} className="text-crimson-400" /> : <VolumeX size={17} className="text-crimson-400" />}
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide text-ink">Speak Replies</h2>
              <p className="text-[11px] text-ink-faint">
                {settings.ttsEngine === 'gemini' ? 'AI-powered voices via Gemini (requires API key).' : 'Local browser voices — no network.'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleTts}
            className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', settings.ttsEnabled ? 'bg-crimson-600' : 'bg-line-2')}
          >
            <span
              className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', settings.ttsEnabled ? 'left-[22px]' : 'left-0.5')}
            />
          </button>
        </motion.section>

        {settings.ttsEnabled && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-line bg-panel p-6"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-widest text-ink-faint">ENGINE</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTtsEngine('web')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors',
                      settings.ttsEngine === 'web'
                        ? 'bg-crimson-600 text-white'
                        : 'border border-line text-ink-dim hover:border-crimson-500/40',
                    )}
                  >
                    LOCAL (FREE)
                  </button>
                  <button
                    onClick={() => setTtsEngine('gemini')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors',
                      settings.ttsEngine === 'gemini'
                        ? 'bg-crimson-600 text-white'
                        : 'border border-line text-ink-dim hover:border-crimson-500/40',
                    )}
                  >
                    GEMINI (AI)
                  </button>
                </div>
              </div>

              {settings.ttsEngine === 'web' ? (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-widest text-ink-faint">VOICE</span>
                  <select value={settings.ttsVoice} onChange={(e) => setVoice(e.target.value)} className={cn(rowCls, 'w-64')}>
                    <option value="">System default</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-widest text-ink-faint">VOICE</span>
                  <select value={settings.ttsGeminiVoice} onChange={(e) => setGeminiVoice(e.target.value)} className={cn(rowCls, 'w-64')}>
                    {GEMINI_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-6"
        >
          <label className="flex items-center gap-3">
            <AudioLines size={17} className="text-crimson-400" />
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide text-ink">Voice Input Language</h2>
              <p className="text-[11px] text-ink-faint">Used by the microphone button — local browser recognition.</p>
            </div>
            <select value={settings.sttLang} onChange={(e) => setSttLang(e.target.value)} className={cn(rowCls, 'w-48')}>
              {STT_LANGS.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-between rounded-2xl border border-line bg-panel p-6"
        >
          <div className="flex items-center gap-3">
            <WifiOff size={17} className="text-crimson-400" />
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide text-ink">Offline / Demo Mode</h2>
              <p className="text-[11px] text-ink-faint">Use seeded data and canned responses — no network.</p>
            </div>
          </div>
          <button
            onClick={toggleOffline}
            className={cn('relative h-6 w-11 rounded-full transition-colors', settings.offlineMode ? 'bg-crimson-600' : 'bg-line-2')}
          >
            <span
              className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', settings.offlineMode ? 'left-[22px]' : 'left-0.5')}
            />
          </button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
          className="flex items-center justify-between rounded-2xl border border-line bg-panel p-6"
        >
          <div className="flex items-center gap-3">
            <MousePointerClick size={17} className="text-crimson-400" />
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide text-ink">Simulated System Control</h2>
              <p className="text-[11px] text-ink-faint">Preview OS actions in the monitor without touching the machine.</p>
            </div>
          </div>
          <button
            onClick={toggleSim}
            className={cn('relative h-6 w-11 rounded-full transition-colors', settings.simMode ? 'bg-crimson-600' : 'bg-line-2')}
          >
            <span
              className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', settings.simMode ? 'left-[22px]' : 'left-0.5')}
            />
          </button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between rounded-2xl border border-line bg-panel p-6"
        >
          <div className="flex items-center gap-3">
            {settings.soundEnabled ? <Volume2 size={17} className="text-crimson-400" /> : <VolumeX size={17} className="text-crimson-400" />}
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide text-ink">Interface Sounds</h2>
              <p className="text-[11px] text-ink-faint">Procedural WebAudio chimes for boot, yards and actions.</p>
            </div>
          </div>
          <button
            onClick={toggleSound}
            className={cn('relative h-6 w-11 rounded-full transition-colors', settings.soundEnabled ? 'bg-crimson-600' : 'bg-line-2')}
          >
            <span
              className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', settings.soundEnabled ? 'left-[22px]' : 'left-0.5')}
            />
          </button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between rounded-2xl border border-line bg-panel p-6"
        >
          <div className="flex items-center gap-3">
            <Trash2 size={17} className="text-crimson-400" />
            <div>
              <h2 className="font-display text-sm font-medium tracking-wide text-ink">Reset Instance</h2>
              <p className="text-[11px] text-ink-faint">Wipe settings, projects and notes.</p>
            </div>
          </div>
          <button
            onClick={reset}
            className="rounded-lg border border-crimson-700 bg-crimson-600/10 px-4 py-2 text-xs font-medium text-crimson-400 transition-colors hover:bg-crimson-600/20"
          >
            RESET
          </button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-line bg-panel p-6"
        >
          <div className="mb-3 flex items-center gap-3">
            <ScrollText size={17} className="text-crimson-400" />
            <h2 className="font-display text-sm font-medium tracking-wide text-ink">Diagnostics / Logs</h2>
            <button
              onClick={loadLogs}
              className="ml-auto rounded-lg border border-line bg-void px-3 py-1 text-[10px] font-mono tracking-widest text-ink-dim transition-colors hover:border-crimson-500/40 hover:text-crimson-400"
            >
              REFRESH
            </button>
          </div>
          <pre className="max-h-56 overflow-y-auto rounded-xl border border-line bg-void p-3 font-mono text-[10px] leading-relaxed text-ink-dim">
            {logLines.length ? logLines.join('\n') : '(no log entries yet)'}
          </pre>
          <p className="mt-3 text-[11px] text-ink-faint">
            Full log: <span className="font-mono text-ink-dim">%APPDATA%\Orion\orion.log</span>
          </p>
        </motion.section>
      </div>
    </div>
  )
}
