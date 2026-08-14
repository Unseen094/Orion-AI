let _voices: SpeechSynthesisVoice[] = []
let _audio: HTMLAudioElement | null = null

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return []
  const v = speechSynthesis.getVoices()
  if (v.length) _voices = v
  return _voices
}

export function initVoices() {
  if (typeof speechSynthesis === 'undefined') return
  getVoices()
  speechSynthesis.onvoiceschanged = () => {
    _voices = speechSynthesis.getVoices()
  }
}

export function isSpeaking() {
  if (_audio && !_audio.paused) return true
  return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking
}

export function speak(text: string, voiceName?: string, onEnd?: () => void) {
  if (!text || typeof speechSynthesis === 'undefined') {
    onEnd?.()
    return
  }
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (voiceName) {
    const voice = getVoices().find((v) => v.name === voiceName)
    if (voice) u.voice = voice
  }
  u.rate = 1.05
  u.pitch = 1
  u.onend = onEnd ?? null
  u.onerror = onEnd ?? null
  speechSynthesis.speak(u)
}

export function stopSpeak() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  if (_audio) {
    _audio.pause()
    _audio.currentTime = 0
    _audio = null
  }
}

export async function speakGemini(
  text: string,
  voice: string,
  onEnd?: () => void,
): Promise<boolean> {
  try {
    const res = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voice || undefined }),
    })
    if (!res.ok) return false
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    stopSpeak()
    _audio = new Audio(url)
    _audio.onended = () => {
      URL.revokeObjectURL(url)
      _audio = null
      onEnd?.()
    }
    _audio.onerror = () => {
      URL.revokeObjectURL(url)
      _audio = null
      onEnd?.()
    }
    await _audio.play()
    return true
  } catch {
    return false
  }
}

export type TtsEngine = 'web' | 'gemini'

export interface SpeakOptions {
  engine?: TtsEngine
  voice?: string
  geminiVoice?: string
  onEnd?: () => void
}

export async function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!text) {
    opts.onEnd?.()
    return
  }
  const engine = opts.engine ?? 'web'
  if (engine === 'gemini') {
    const ok = await speakGemini(text, opts.geminiVoice ?? 'Kore', opts.onEnd)
    if (!ok) speak(text, opts.voice, opts.onEnd)
    return
  }
  speak(text, opts.voice, opts.onEnd)
}
