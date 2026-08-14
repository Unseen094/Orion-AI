let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(v: boolean) {
  enabled = v
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, start: number, dur: number, gain = 0.04, type: OscillatorType = 'sine') {
  const c = ensureCtx()
  if (!c || !enabled) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(0.0001, c.currentTime + start)
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.05)
}

export const sfx = {
  boot: () => {
    tone(180, 0, 0.8, 0.05, 'sawtooth')
    tone(360, 0.1, 0.9, 0.04, 'sine')
    tone(720, 0.25, 1.2, 0.03, 'sine')
  },
  think: () => {
    tone(880, 0, 0.12, 0.02)
    tone(1320, 0.1, 0.12, 0.015)
  },
  open: () => {
    tone(440, 0, 0.25, 0.04)
    tone(880, 0.12, 0.3, 0.03)
  },
  done: () => {
    tone(660, 0, 0.15, 0.03)
    tone(990, 0.1, 0.2, 0.02)
  },
  error: () => {
    tone(220, 0, 0.2, 0.04, 'square')
    tone(180, 0.15, 0.3, 0.04, 'square')
  },
}
