/** localStorage に保存する記録。壊れたデータが入っていても落ちないように、読み込み時に検証する。 */

export interface RunResult {
  outcome: 'clear' | 'gameover'
  seed: number
  floor: number
  turns: number
  kills: number
  hp: number
  /** ゲームオーバーのときは 0 */
  score: number
  finishedAt: number
}

export interface Records {
  /** クリアした中で最小のターン数 */
  bestTurns: number | null
  /** クリアした中で最高のスコア */
  bestScore: number | null
  /** 直近の結果(新しい順、最大5件) */
  recent: RunResult[]
}

export const RECORDS_KEY = 'roguelike-claude:records:v1'
export const RECENT_LIMIT = 5

export const emptyRecords = (): Records => ({ bestTurns: null, bestScore: null, recent: [] })

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseResult(v: unknown): RunResult | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  if (r.outcome !== 'clear' && r.outcome !== 'gameover') return null
  if (![r.seed, r.floor, r.turns, r.kills, r.hp, r.score, r.finishedAt].every(isNum)) return null
  return {
    outcome: r.outcome,
    seed: r.seed as number,
    floor: r.floor as number,
    turns: r.turns as number,
    kills: r.kills as number,
    hp: r.hp as number,
    score: r.score as number,
    finishedAt: r.finishedAt as number,
  }
}

export function parseRecords(raw: string | null): Records {
  if (!raw) return emptyRecords()
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const recent = Array.isArray(data.recent)
      ? data.recent.map(parseResult).filter((r): r is RunResult => r !== null).slice(0, RECENT_LIMIT)
      : []
    return {
      bestTurns: isNum(data.bestTurns) ? data.bestTurns : null,
      bestScore: isNum(data.bestScore) ? data.bestScore : null,
      recent,
    }
  } catch {
    return emptyRecords()
  }
}

/** 結果を1件追加した新しい記録を返す(元の記録は変更しない)。 */
export function addResult(records: Records, result: RunResult): Records {
  const isClear = result.outcome === 'clear'
  return {
    bestTurns: isClear ? Math.min(records.bestTurns ?? Infinity, result.turns) : records.bestTurns,
    bestScore: isClear ? Math.max(records.bestScore ?? 0, result.score) : records.bestScore,
    recent: [result, ...records.recent].slice(0, RECENT_LIMIT),
  }
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** localStorage が使えない環境(プライベートモード等)でも例外を出さない。 */
export function loadRecords(store: KeyValueStore | null = safeLocalStorage()): Records {
  try {
    return parseRecords(store?.getItem(RECORDS_KEY) ?? null)
  } catch {
    return emptyRecords()
  }
}

export function saveResult(result: RunResult, store: KeyValueStore | null = safeLocalStorage()): Records {
  const next = addResult(loadRecords(store), result)
  try {
    store?.setItem(RECORDS_KEY, JSON.stringify(next))
  } catch {
    // 保存できなくてもゲームは続ける
  }
  return next
}

function safeLocalStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
