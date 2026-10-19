import { describe, expect, it } from 'vitest'
import { ACTION_LOCK_MS, DESCEND_LOCK_MS, GameSession } from './session.ts'
import { DIR_ORDER } from './pathfinding.ts'
import { addResult, emptyRecords, loadRecords, parseRecords, RECENT_LIMIT, RECORDS_KEY, saveResult } from './records.ts'
import type { KeyValueStore, RunResult } from './records.ts'
import { calcScore } from './score.ts'
import { createGame } from './engine.ts'
import { stateFromPicture } from './testUtils.ts'

/** 動かせる時計つきのセッション */
function makeSession(seed = 5) {
  let t = 1000
  const saved: RunResult[] = []
  const session = new GameSession(seed, { now: () => t, saveResult: (r) => saved.push(r) })
  return { session, saved, advance: (ms: number) => (t += ms) }
}

describe('テスト17: 入力ロックと連続入力', () => {
  it('ロック中の入力は無視され、ターンは1つしか進まない', () => {
    const { session } = makeSession()
    // 受け付けられる方向を探す(壁の向きは無効で、ロックもかからない)
    let accepted = 0
    for (let i = 0; i < 20; i++) {
      for (const d of DIR_ORDER) if (session.input(d)) accepted++
    }
    expect(accepted).toBe(1)
    expect(session.getSnapshot().state.stats.turns).toBe(1)
    expect(session.getSnapshot().seq).toBe(1)
  })

  it('ロック時間が過ぎれば次の入力を受け付ける', () => {
    const { session, advance } = makeSession()
    const first = DIR_ORDER.find((d) => session.input(d))!
    expect(first).toBeDefined()
    expect(session.isLocked()).toBe(true)
    advance(ACTION_LOCK_MS - 1)
    expect(session.isLocked()).toBe(true)
    advance(1)
    expect(session.isLocked()).toBe(false)
    expect(DIR_ORDER.some((d) => session.input(d))).toBe(true)
    expect(session.getSnapshot().state.stats.turns).toBe(2)
  })

  it('壁への入力はロックをかけず、ターンも進めない(blockedSeq だけ増える)', () => {
    const session = new GameSession(0, { initialState: stateFromPicture(['@.']), saveResult: () => {} })
    const before = session.getSnapshot()
    expect(session.input('up')).toBe(false)
    expect(session.isLocked()).toBe(false)
    const after = session.getSnapshot()
    expect(after.state).toBe(before.state)
    expect(after.blockedSeq).toBe(1)
    expect(after.lastBlocked).toMatchObject({ type: 'blocked', reason: 'wall' })
    expect(after.seq).toBe(0)
    // すぐ次の有効な入力が通る
    expect(session.input('right')).toBe(true)
  })

  it('購読者に更新が通知される', () => {
    const { session } = makeSession()
    let calls = 0
    const off = session.subscribe(() => calls++)
    DIR_ORDER.find((d) => session.input(d))
    expect(calls).toBeGreaterThan(0)
    off()
    const before = calls
    session.input('up')
    expect(calls).toBe(before)
  })

  it('1000回の連打でも状態が壊れない(時計が進まなければ最初の1手だけ)', () => {
    const { session } = makeSession(77)
    for (let i = 0; i < 1000; i++) session.input(DIR_ORDER[i % 4]!)
    expect(session.getSnapshot().state.stats.turns).toBeLessThanOrEqual(1)
  })

  it('時計を進めながら大量に入力しても、終了後は何も変わらない', () => {
    const { session, advance } = makeSession(3)
    let last = session.getSnapshot().state
    for (let i = 0; i < 2000; i++) {
      advance(ACTION_LOCK_MS)
      session.input(DIR_ORDER[(i * 7 + (i >> 3)) % 4]!)
      const s = session.getSnapshot().state
      expect(s.player.hp).toBeLessThanOrEqual(s.player.maxHp)
      if (last.status !== 'playing') expect(s).toBe(last)
      last = s
    }
  })
})

describe('テスト16: 再挑戦', () => {
  it('新しいセッションは完全に初期状態で、シード指定の有無を覚えている', () => {
    const { session } = makeSession(9)
    DIR_ORDER.find((d) => session.input(d))
    expect(session.getSnapshot().state.stats.turns).toBe(1)

    const retry = new GameSession(session.seed)
    expect(retry.getSnapshot().state).toEqual(createGame(9))
    expect(retry.getSnapshot().seq).toBe(0)
    expect(retry.isLocked()).toBe(false)
    expect(new GameSession(null).seedWasSpecified).toBe(false)
    expect(retry.seedWasSpecified).toBe(true)
  })

  it('シード未指定ならランダムなシードが付き、画面に出せる数値になる', () => {
    const s = new GameSession(null)
    expect(Number.isInteger(s.seed)).toBe(true)
    expect(s.seed).toBeGreaterThanOrEqual(0)
    expect(s.getSnapshot().state.seed).toBe(s.seed)
  })
})

describe('結果の保存', () => {
  it('ゲームオーバーで1回だけ保存される', () => {
    let t = 0
    const saved: RunResult[] = []
    const session = new GameSession(21, {
      now: () => t,
      saveResult: (r) => saved.push(r),
      initialState: stateFromPicture(['A@.'], { hp: 1 }),
    })
    expect(session.input('left')).toBe(true)
    expect(session.getSnapshot().state.status).toBe('gameover')
    expect(saved).toEqual([expect.objectContaining({ outcome: 'gameover', turns: 1, hp: 0, score: 0, kills: 0 })])
    for (let i = 0; i < 20; i++) {
      t += DESCEND_LOCK_MS
      expect(session.input('right')).toBe(false)
    }
    expect(saved).toHaveLength(1)
  })

  it('クリアでスコアつきで1回だけ保存される', () => {
    const saved: RunResult[] = []
    const session = new GameSession(4, {
      now: () => 0,
      saveResult: (r) => saved.push(r),
      initialState: stateFromPicture(['@>'], { floor: 3 }),
    })
    session.input('right')
    const state = session.getSnapshot().state
    expect(state.status).toBe('clear')
    expect(saved).toEqual([
      expect.objectContaining({ outcome: 'clear', floor: 3, turns: 1, score: calcScore(state.stats, state.player.hp) }),
    ])
  })

  it('階層移動は DESCEND_LOCK_MS のあいだ入力を受け付けない', () => {
    let t = 0
    const session = new GameSession(4, { now: () => t, initialState: stateFromPicture(['@>']), saveResult: () => {} })
    expect(session.input('right')).toBe(true)
    expect(session.getSnapshot().state.floor).toBe(2)
    expect(session.getSnapshot().descendSeq).toBe(1)
    t += DESCEND_LOCK_MS - 1
    expect(DIR_ORDER.some((d) => session.input(d))).toBe(false)
    t += 1
    expect(session.isLocked()).toBe(false)
  })
})

describe('records', () => {
  const result = (turns: number, outcome: RunResult['outcome'] = 'clear', score = 1000): RunResult => ({
    outcome, seed: 1, floor: 3, turns, kills: 6, hp: 10, score, finishedAt: turns,
  })

  it('クリアの最小ターン数と最高スコアを更新する', () => {
    let r = addResult(emptyRecords(), result(100, 'clear', 4000))
    r = addResult(r, result(80, 'clear', 3000))
    r = addResult(r, result(120, 'clear', 5000))
    expect(r.bestTurns).toBe(80)
    expect(r.bestScore).toBe(5000)
  })

  it('ゲームオーバーは最小ターン数に影響しない', () => {
    let r = addResult(emptyRecords(), result(100))
    r = addResult(r, result(10, 'gameover', 0))
    expect(r.bestTurns).toBe(100)
    expect(r.recent).toHaveLength(2)
  })

  it('直近の結果は新しい順で最大5件', () => {
    let r = emptyRecords()
    for (let i = 1; i <= 8; i++) r = addResult(r, result(i))
    expect(r.recent).toHaveLength(RECENT_LIMIT)
    expect(r.recent.map((x) => x.turns)).toEqual([8, 7, 6, 5, 4])
  })

  it('元の記録を書き換えない', () => {
    const base = emptyRecords()
    addResult(base, result(5))
    expect(base).toEqual(emptyRecords())
  })

  it('localStorage 相当のストアへ保存・復元できる', () => {
    const data = new Map<string, string>()
    const store: KeyValueStore = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
    saveResult(result(50), store)
    saveResult(result(40), store)
    const loaded = loadRecords(store)
    expect(loaded.bestTurns).toBe(40)
    expect(loaded.recent.map((x) => x.turns)).toEqual([40, 50])
    expect(data.has(RECORDS_KEY)).toBe(true)
  })

  it('壊れたデータや使えないストレージでも落ちない', () => {
    expect(parseRecords('not json')).toEqual(emptyRecords())
    expect(parseRecords('{"bestTurns":"x","recent":[1,{"outcome":"clear"}]}')).toEqual(emptyRecords())
    expect(parseRecords(null)).toEqual(emptyRecords())
    const broken: KeyValueStore = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
    }
    expect(loadRecords(broken)).toEqual(emptyRecords())
    expect(() => saveResult(result(1), broken)).not.toThrow()
    expect(loadRecords(null)).toEqual(emptyRecords())
  })
})

describe('score', () => {
  const stats = { turns: 100, moves: 70, attacks: 30, kills: 6, damageTaken: 20, healed: 8 }
  it('式どおりに計算する', () => {
    // 3000 + 18*50 + (1500-1000) + 600 - 200
    expect(calcScore(stats, 18)).toBe(3000 + 900 + 500 + 600 - 200)
  })
  it('少ないターン・多い残りHPほど高く、下限は0', () => {
    expect(calcScore({ ...stats, turns: 50 }, 18)).toBeGreaterThan(calcScore(stats, 18))
    expect(calcScore(stats, 25)).toBeGreaterThan(calcScore(stats, 18))
    expect(calcScore({ ...stats, damageTaken: 100000 }, 1)).toBe(0)
  })
})

