import { applyAction, createGame } from './engine.ts'
import { randomSeed } from './rng.ts'
import { calcScore } from './score.ts'
import { saveResult } from './records.ts'
import type { RunResult } from './records.ts'
import type { Dir, GameEvent, GameState } from './types.ts'

/** 1回の操作のあと、次の操作を受け付けるまでの時間。移動アニメーション中の二重入力を防ぐ。 */
export const ACTION_LOCK_MS = 120
/** 階層移動の演出中は操作を受け付けない。 */
export const DESCEND_LOCK_MS = 1100

export interface Snapshot {
  state: GameState
  /** 直近の有効な操作で起きたこと */
  events: GameEvent[]
  /** 有効な操作のたびに +1。UIが「新しい出来事」を見分けるのに使う。 */
  seq: number
  /** 階層移動のたびに +1。演出の開始に使う。 */
  descendSeq: number
  /** 無効な操作(壁など)のたびに +1。軽いフィードバック用。 */
  blockedSeq: number
  lastBlocked: GameEvent | null
}

export interface SessionOptions {
  now?: () => number
  /** 終了時に結果を保存する先。省略すると localStorage。 */
  saveResult?: (r: RunResult) => void
  /** テスト用: 第1階層の代わりにこの状態から始める */
  initialState?: GameState
}

/**
 * 1回のプレイを管理する、React に依存しない入れ物。
 * 「状態の更新」(engine)は同期・瞬時に終わり、アニメーションは見た目だけの話。
 * ここでは入力の受付制御(ロック)と、終了時の記録保存だけを受け持つ。
 */
export class GameSession {
  readonly seed: number
  /** シードを自分で指定したか。再挑戦で同じマップにするかの判断に使う。 */
  readonly seedWasSpecified: boolean
  private snapshot: Snapshot
  private lockedUntil = 0
  private resultSaved = false
  private listeners = new Set<() => void>()
  private readonly now: () => number
  private readonly save: (r: RunResult) => void

  constructor(seed: number | null, options: SessionOptions = {}) {
    this.seedWasSpecified = seed !== null
    this.seed = seed ?? randomSeed()
    this.now = options.now ?? (() => performance.now())
    this.save = options.saveResult ?? ((r) => void saveResult(r))
    this.snapshot = {
      state: options.initialState ?? createGame(this.seed),
      events: [],
      seq: 0,
      descendSeq: 0,
      blockedSeq: 0,
      lastBlocked: null,
    }
  }

  getSnapshot = (): Snapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  isLocked(): boolean {
    return this.now() < this.lockedUntil
  }

  /** 方向入力。受け付けられたら true。 */
  input(dir: Dir): boolean {
    const prev = this.snapshot
    if (prev.state.status !== 'playing' || this.isLocked()) return false

    const result = applyAction(prev.state, dir)
    if (!result.accepted) {
      this.snapshot = {
        ...prev,
        blockedSeq: prev.blockedSeq + 1,
        lastBlocked: result.events[0] ?? null,
      }
      this.emit()
      return false
    }

    const descended = result.events.some((e) => e.type === 'descend')
    this.lockedUntil = this.now() + (descended ? DESCEND_LOCK_MS : ACTION_LOCK_MS)
    this.snapshot = {
      ...prev,
      state: result.state,
      events: result.events,
      seq: prev.seq + 1,
      descendSeq: prev.descendSeq + (descended ? 1 : 0),
    }
    if (result.state.status !== 'playing') this.finish(result.state)
    this.emit()
    return true
  }

  private finish(state: GameState): void {
    if (this.resultSaved) return
    this.resultSaved = true
    const cleared = state.status === 'clear'
    this.save({
      outcome: cleared ? 'clear' : 'gameover',
      seed: state.seed,
      floor: state.floor,
      turns: state.stats.turns,
      kills: state.stats.kills,
      hp: Math.max(0, state.player.hp),
      score: cleared ? calcScore(state.stats, state.player.hp) : 0,
      finishedAt: Date.now(),
    })
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }
}
