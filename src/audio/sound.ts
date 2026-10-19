/** 効果音。音声ファイルは使わず、WebAudio で合成する(外部リソースなし)。 */

export type Sfx = 'step' | 'bump' | 'hit' | 'kill' | 'hurt' | 'potion' | 'locked' | 'descend' | 'lose' | 'win' | 'ui'

const MUTE_KEY = 'roguelike-claude:muted:v1'

let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export const isMuted = (): boolean => muted

export function setMuted(value: boolean): void {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // 保存できなくても動作には影響しない
  }
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

interface Tone {
  freq: number
  to?: number
  dur: number
  type?: OscillatorType
  vol?: number
  delay?: number
}

function tone(ac: AudioContext, t: Tone): void {
  const start = ac.currentTime + (t.delay ?? 0)
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = t.type ?? 'square'
  osc.frequency.setValueAtTime(t.freq, start)
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur)
  const vol = (t.vol ?? 0.06) * 0.8
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(start)
  osc.stop(start + t.dur + 0.02)
}

const SOUNDS: Record<Sfx, Tone[]> = {
  step: [{ freq: 150, to: 90, dur: 0.07, type: 'triangle', vol: 0.05 }],
  bump: [{ freq: 90, to: 60, dur: 0.09, type: 'sawtooth', vol: 0.04 }],
  hit: [
    { freq: 260, to: 90, dur: 0.12, type: 'sawtooth', vol: 0.07 },
    { freq: 520, to: 200, dur: 0.06, type: 'square', vol: 0.04 },
  ],
  kill: [
    { freq: 300, to: 80, dur: 0.18, type: 'sawtooth', vol: 0.07 },
    { freq: 660, to: 990, dur: 0.12, type: 'triangle', vol: 0.05, delay: 0.09 },
  ],
  hurt: [
    { freq: 180, to: 55, dur: 0.22, type: 'sawtooth', vol: 0.09 },
    { freq: 90, to: 45, dur: 0.25, type: 'square', vol: 0.05 },
  ],
  potion: [
    { freq: 520, dur: 0.09, type: 'triangle', vol: 0.06 },
    { freq: 660, dur: 0.09, type: 'triangle', vol: 0.06, delay: 0.08 },
    { freq: 880, dur: 0.16, type: 'triangle', vol: 0.06, delay: 0.16 },
  ],
  locked: [
    { freq: 220, dur: 0.08, type: 'square', vol: 0.04 },
    { freq: 165, dur: 0.12, type: 'square', vol: 0.04, delay: 0.09 },
  ],
  descend: [
    { freq: 440, to: 220, dur: 0.3, type: 'triangle', vol: 0.06 },
    { freq: 330, to: 165, dur: 0.4, type: 'triangle', vol: 0.05, delay: 0.15 },
    { freq: 220, to: 110, dur: 0.5, type: 'sine', vol: 0.06, delay: 0.3 },
  ],
  lose: [
    { freq: 330, to: 250, dur: 0.35, type: 'triangle', vol: 0.07 },
    { freq: 250, to: 180, dur: 0.4, type: 'triangle', vol: 0.07, delay: 0.3 },
    { freq: 180, to: 90, dur: 0.8, type: 'triangle', vol: 0.07, delay: 0.65 },
  ],
  win: [
    { freq: 523, dur: 0.14, type: 'triangle', vol: 0.07 },
    { freq: 659, dur: 0.14, type: 'triangle', vol: 0.07, delay: 0.14 },
    { freq: 784, dur: 0.14, type: 'triangle', vol: 0.07, delay: 0.28 },
    { freq: 1047, dur: 0.5, type: 'triangle', vol: 0.08, delay: 0.42 },
  ],
  ui: [{ freq: 600, to: 800, dur: 0.06, type: 'triangle', vol: 0.04 }],
}

export function playSfx(name: Sfx): void {
  if (muted) return
  const ac = getCtx()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume().catch(() => {})
  for (const t of SOUNDS[name]) tone(ac, t)
}
