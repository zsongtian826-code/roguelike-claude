import { MAX_SEED } from './constants.ts'

/** シード付きの擬似乱数生成器。ゲームロジックでは Math.random を使わず、必ずこれを通す。 */
export interface Rng {
  /** 0以上1未満 */
  next(): number
  /** 0以上 maxExclusive 未満の整数 */
  int(maxExclusive: number): number
  /** Fisher-Yates。新しい配列を返す。 */
  shuffle<T>(items: readonly T[]): T[]
}

/** mulberry32 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive)
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = items.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1)
      ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
    return out
  }
  return { next, int, shuffle }
}

/** ゲームのシードと階層から、その階層専用のシードを作る(階層ごとに独立した乱数列になる)。 */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return h >>> 0
}

/** 「未指定時はランダム」用。ロジックの外(画面側)でだけ使う。覚えやすい6桁にする。 */
export function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! % 1_000_000
}

/** 入力欄の文字列をシードに変換する。空欄は null(=ランダム)、不正値は 'invalid'。 */
export function parseSeedInput(text: string): number | null | 'invalid' {
  const t = text.trim()
  if (t === '') return null
  if (!/^\d{1,10}$/.test(t)) return 'invalid'
  const n = Number(t)
  return n <= MAX_SEED ? n : 'invalid'
}
