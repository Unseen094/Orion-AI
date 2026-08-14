import { useEffect, useRef } from 'react'
import { ORB_STATES } from './orbStates'
import type { OrbVisualConfig } from './orbStates'

type Props = {
  state: string
  size?: number
}

type Particle = {
  angle: number
  radius: number
  speed: number
  phase: number
  size: number
  liss: { a: number; b: number }
  hue: number
}

const CRIMSON = [255, 45, 45]

function makeParticles(i: number): Particle {  const g = (i * 137.5) % 360
  return {
    angle: g * (Math.PI / 180),
    radius: 30 + ((i * 7) % 55),
    speed: 0.15 + ((i * 13) % 100) / 1000,
    phase: ((i * 29) % 100) / 100,
    size: 1 + ((i * 17) % 20) / 14,
    liss: {
      a: 1 + ((i * 5) % 3),
      b: 1 + ((i * 3) % 4),
    },
    hue: (i * 7) % 10,
  }
}

export function OrbCanvas({ state, size = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const configs = ORB_STATES

    let particles = Array.from({ length: 140 }, (_, i) => makeParticles(i))
    const current: OrbVisualConfig = { ...configs.idle }
    const lerpKeys = ['energy', 'radialOsc', 'ringPulse', 'sweep', 'brightness'] as const
    let raf = 0
    let t = 0
    let ringPhase = 0

    const lerp = (a: number, b: number, k: number) => a + (b - a) * k
    const damp = (k: number) => 1 - Math.pow(0.001, k / 60)

    const tick = () => {
      t += 1
      const target = configs[stateRef.current] ?? configs.idle
      const k = damp(0.12)
      for (const key of lerpKeys) {
        current[key] = lerp(current[key], target[key], k)
      }

      if (particles.length !== target.dotCount) {
        particles = Array.from({ length: target.dotCount }, (_, i) => makeParticles(i))
      }

      ringPhase += 0.04 * current.ringPulse
      const cx = size / 2
      const cy = size / 2

      ctx.clearRect(0, 0, size, size)

      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, size / 2)
      glow.addColorStop(0, `rgba(255,45,45,${0.28 * current.brightness})`)
      glow.addColorStop(1, 'rgba(255,45,45,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, size, size)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const tSec = t * 0.01 * current.energy
        const wob = Math.sin(t * 0.02 + p.phase * 12) * current.radialOsc * 14
        const ang = p.angle + tSec * p.speed * 6 + p.phase
        const rr = Math.max(6, p.radius + wob)
        const lissX = Math.cos(ang * p.liss.a)
        const lissY = Math.sin(ang * p.liss.b)
        const x = cx + lissX * rr
        const y = cy + lissY * rr

        let alpha = 0.5 + 0.5 * Math.sin(t * 0.03 + p.phase * 20)
        alpha *= 0.45 + 0.55 * current.brightness

        if (current.ringPulse > 0) {
          const ringK = ((t * 0.02 + p.phase) % 1)
          alpha *= 1 + 0.8 * Math.max(0, 1 - ringK) * current.ringPulse
        }

        let sizeMul = 1
        if (current.sweep > 0) {
          const sweepAng = (t * 0.01 * 3.6) % (Math.PI * 2)
          const diff = Math.abs(ang - sweepAng)
          const near = diff < 0.7
          if (near) sizeMul = 1 + 1.4 * current.sweep * (1 - diff / 0.7)
          alpha *= 1 + 1.2 * current.sweep * Math.max(0, 1 - diff / 1.2)
        }

        const r = CRIMSON[0]
        const g = CRIMSON[1] + Math.floor(p.hue * 2)
        const b = CRIMSON[2] + Math.floor(p.hue * 2)
        ctx.beginPath()
        ctx.arc(x, y, p.size * sizeMul, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha)})`
        ctx.fill()
      }

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34)
      core.addColorStop(0, `rgba(255,60,60,${0.5 * current.brightness})`)
      core.addColorStop(0.5, `rgba(255,45,45,${0.12 * current.brightness})`)
      core.addColorStop(1, 'rgba(255,45,45,0)')
      ctx.fillStyle = core
      ctx.fillRect(cx - 34, cy - 34, 68, 68)

      if (current.ringPulse > 0) {
        for (let ring = 0; ring < 3; ring++) {
          const progress = ((ringPhase + ring * 0.33) % 1)
          const radius = 20 + progress * (size / 2.2)
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,45,45,${0.35 * current.ringPulse * (1 - progress)})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />
}
