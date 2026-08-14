export type OrbVisualConfig = {
  energy: number
  radialOsc: number
  ringPulse: number
  sweep: number
  brightness: number
  label: string
  dotCount: number
}

export const ORB_STATES: Record<string, OrbVisualConfig> = {
  idle: {
    energy: 0.25,
    radialOsc: 0.1,
    ringPulse: 0,
    sweep: 0,
    brightness: 0.65,
    label: 'STANDING BY',
    dotCount: 140,
  },
  thinking: {
    energy: 1.1,
    radialOsc: 0.9,
    ringPulse: 0.5,
    sweep: 0,
    brightness: 1,
    label: 'PROCESSING',
    dotCount: 190,
  },
  listening: {
    energy: 0.5,
    radialOsc: 0.35,
    ringPulse: 1,
    sweep: 0,
    brightness: 0.85,
    label: 'LISTENING',
    dotCount: 150,
  },
  executing: {
    energy: 0.8,
    radialOsc: 0.4,
    ringPulse: 0.2,
    sweep: 1,
    brightness: 1,
    label: 'EXECUTING',
    dotCount: 200,
  },
}
