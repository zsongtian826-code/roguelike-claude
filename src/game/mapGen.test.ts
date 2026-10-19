import { describe, expect, it } from 'vitest'
import { FLOOR_ENEMIES, MAP_SIZE, TOTAL_FLOORS } from './constants.ts'
import { createGame } from './engine.ts'
import { fallbackLayout, generateFloor, validateLayout } from './mapGen.ts'
import { bfsDistances } from './pathfinding.ts'
import { createRng, deriveSeed, parseSeedInput } from './rng.ts'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)

describe('rng', () => {
  it('同じシードなら同じ乱数列、違うシードなら違う乱数列', () => {
    const a = createRng(42)
    const b = createRng(42)
    const c = createRng(43)
    const seqA = Array.from({ length: 20 }, () => a.next())
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(seqA)
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(seqA)
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('shuffle は元の配列を変えず、同じシードで同じ結果になる', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8]
    const s1 = createRng(7).shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(createRng(7).shuffle(src)).toEqual(s1)
    expect([...s1].sort()).toEqual(src)
  })

  it('階層ごとに別の乱数列になる', () => {
    expect(deriveSeed(100, 1)).not.toBe(deriveSeed(100, 2))
    expect(deriveSeed(100, 1)).toBe(deriveSeed(100, 1))
  })

  it('シード入力の解釈', () => {
    expect(parseSeedInput('')).toBeNull()
    expect(parseSeedInput('  ')).toBeNull()
    expect(parseSeedInput('12345')).toBe(12345)
    expect(parseSeedInput('0')).toBe(0)
    expect(parseSeedInput('abc')).toBe('invalid')
    expect(parseSeedInput('-5')).toBe('invalid')
    expect(parseSeedInput('1.5')).toBe('invalid')
    expect(parseSeedInput('99999999999')).toBe('invalid')
    expect(parseSeedInput('4294967296')).toBe('invalid')
  })
})

describe('テスト1: 同じシードで同じマップ', () => {
  it('全階層で完全に一致する', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
        expect(generateFloor(seed, floor)).toEqual(generateFloor(seed, floor))
      }
      expect(createGame(seed)).toEqual(createGame(seed))
    }
  })

  it('シードが違えばマップも(ほとんど)違う', () => {
    const layouts = new Set(SEEDS.slice(0, 50).map((s) => JSON.stringify(generateFloor(s, 1).layout)))
    expect(layouts.size).toBeGreaterThan(45)
  })
})

describe('マップの構造', () => {
  it('11×11で、外周がすべて壁', () => {
    for (const seed of SEEDS) {
      const { grid } = generateFloor(seed, 1).layout
      expect(grid).toHaveLength(MAP_SIZE)
      for (let i = 0; i < MAP_SIZE; i++) {
        expect(grid[0]![i]).toBe('wall')
        expect(grid[MAP_SIZE - 1]![i]).toBe('wall')
        expect(grid[i]![0]).toBe('wall')
        expect(grid[i]![MAP_SIZE - 1]).toBe('wall')
      }
    }
  })

  it('内部にも壁があり、床も十分ある', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const { grid } = generateFloor(seed, 2).layout
      const inner = grid.slice(1, -1).flatMap((row) => row.slice(1, -1))
      expect(inner.filter((t) => t === 'wall').length).toBeGreaterThanOrEqual(10)
      expect(inner.filter((t) => t === 'floor').length).toBeGreaterThanOrEqual(60)
    }
  })

  it('階層ごとの敵の構成が仕様どおり', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
        const kinds = generateFloor(seed, floor).layout.enemies.map((e) => e.kind)
        expect(kinds).toEqual([...FLOOR_ENEMIES[floor - 1]!])
      }
    }
  })

  it('要素が同じマスに重ならず、壁の上にもない', () => {
    for (const seed of SEEDS) {
      for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
        const { layout } = generateFloor(seed, floor)
        const all = [layout.playerStart, layout.stairs, layout.potion, ...layout.enemies.map((e) => e.pos)]
        expect(new Set(all.map((p) => `${p.x},${p.y}`)).size).toBe(all.length)
        for (const p of all) expect(layout.grid[p.y]![p.x]).toBe('floor')
      }
    }
  })
})

describe('テスト2・3: 到達可能性', () => {
  it('300シード×3階層で、階段・全ての敵・ポーションへ歩いて行ける', () => {
    for (const seed of SEEDS) {
      for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
        const { layout } = generateFloor(seed, floor)
        const dist = bfsDistances(layout.grid, layout.playerStart)
        expect(dist[layout.stairs.y]![layout.stairs.x]).toBeGreaterThan(0)
        expect(dist[layout.potion.y]![layout.potion.x]).toBeGreaterThan(0)
        for (const e of layout.enemies) expect(dist[e.pos.y]![e.pos.x]).toBeGreaterThan(0)
        expect(validateLayout(layout)).toBe(true)
      }
    }
  })

  it('開始直後に敵に囲まれない(敵は4歩以上離れている)', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const { layout, usedFallback } = generateFloor(seed, 1)
      if (usedFallback) continue
      const dist = bfsDistances(layout.grid, layout.playerStart)
      for (const e of layout.enemies) expect(dist[e.pos.y]![e.pos.x]).toBeGreaterThanOrEqual(4)
    }
  })

  it('再生成には上限があり、通常のシードではほぼフォールバックにならない', () => {
    const results = SEEDS.map((s) => generateFloor(s, 1))
    expect(results.every((r) => r.attempts <= 61)).toBe(true)
    expect(results.filter((r) => r.usedFallback).length).toBe(0)
  })
})

describe('フォールバック', () => {
  it('maxAttempts=0 でも遊べるマップを返す', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
        const gen = generateFloor(seed, floor, { maxAttempts: 0 })
        expect(gen.usedFallback).toBe(true)
        expect(validateLayout(gen.layout)).toBe(true)
        expect(gen.layout.enemies.map((e) => e.kind)).toEqual([...FLOOR_ENEMIES[floor - 1]!])
      }
    }
  })

  it('フォールバックも同じシードなら同じ結果', () => {
    expect(generateFloor(5, 2, { maxAttempts: 0 })).toEqual(generateFloor(5, 2, { maxAttempts: 0 }))
    expect(fallbackLayout(createRng(1), 1)).toEqual(fallbackLayout(createRng(1), 1))
  })
})

describe('validateLayout', () => {
  it('壁で閉じ込められた階段を検出する', () => {
    const { layout } = generateFloor(1, 1)
    const broken = structuredClone(layout)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = broken.stairs.x + dx
      const y = broken.stairs.y + dy
      if (broken.grid[y]![x] === 'floor') broken.grid[y]![x] = 'wall'
    }
    // 階段の隣に置かれていた要素があると別の理由で失敗するが、どのみち false になる
    expect(validateLayout(broken)).toBe(false)
  })

  it('外周に穴があると不正', () => {
    const { layout } = generateFloor(1, 1)
    const broken = structuredClone(layout)
    broken.grid[0]![5] = 'floor'
    expect(validateLayout(broken)).toBe(false)
  })
})
