import { FLOOR_ENEMIES, MAP_SIZE } from './constants.ts'
import { bfsDistances, inBounds, manhattan, samePos } from './pathfinding.ts'
import { createRng, deriveSeed } from './rng.ts'
import type { Rng } from './rng.ts'
import type { EnemyKind, Grid, Pos } from './types.ts'

export interface FloorLayout {
  grid: Grid
  playerStart: Pos
  stairs: Pos
  potion: Pos
  enemies: { kind: EnemyKind; pos: Pos }[]
}

export interface GeneratedFloor {
  layout: FloorLayout
  /** 何回目の試行で成功したか(フォールバックなら試行回数の上限+1) */
  attempts: number
  usedFallback: boolean
}

export interface GenerateOptions {
  /** 再生成の上限。0 ならフォールバックを直接使う(テスト用)。 */
  maxAttempts?: number
}

export const DEFAULT_MAX_ATTEMPTS = 60

/** プレイヤーから敵までの最短距離(歩数)の下限。開始直後に殴られないようにする。 */
const MIN_ENEMY_DISTANCE = 4
/** プレイヤーから階段までの最短距離の下限。 */
const MIN_STAIRS_DISTANCE = 6

function emptyGrid(): Grid {
  return Array.from({ length: MAP_SIZE }, (_, y) =>
    Array.from({ length: MAP_SIZE }, (_, x) =>
      x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1 ? ('wall' as const) : ('floor' as const),
    ),
  )
}

function interiorCells(): Pos[] {
  const cells: Pos[] = []
  for (let y = 1; y < MAP_SIZE - 1; y++) for (let x = 1; x < MAP_SIZE - 1; x++) cells.push({ x, y })
  return cells
}

/** 生成結果が遊べるものか検証する。マップ生成の最後の関門であり、テストからも使う。 */
export function validateLayout(layout: FloorLayout): boolean {
  const { grid, playerStart, stairs, potion, enemies } = layout
  if (grid.length !== MAP_SIZE || grid.some((row) => row.length !== MAP_SIZE)) return false
  // 外周はすべて壁
  for (let i = 0; i < MAP_SIZE; i++) {
    if (grid[0]![i] !== 'wall' || grid[MAP_SIZE - 1]![i] !== 'wall') return false
    if (grid[i]![0] !== 'wall' || grid[i]![MAP_SIZE - 1] !== 'wall') return false
  }
  const placed: Pos[] = [playerStart, stairs, potion, ...enemies.map((e) => e.pos)]
  // 床の上にあり、重なっていない
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i]!
    if (!inBounds(p) || grid[p.y]![p.x] !== 'floor') return false
    for (let j = i + 1; j < placed.length; j++) if (samePos(p, placed[j]!)) return false
  }
  // 階段・敵・ポーションのすべてに、プレイヤーから歩いて行ける
  const dist = bfsDistances(grid, playerStart)
  return placed.every((p) => dist[p.y]![p.x]! >= 0)
}

function enemyKindsFor(floor: number): readonly EnemyKind[] {
  return FLOOR_ENEMIES[floor - 1] ?? FLOOR_ENEMIES[FLOOR_ENEMIES.length - 1]!
}

/**
 * 床のマス(shuffled)から、プレイヤー・階段・敵・ポーションを重ならないように選ぶ。
 * 距離条件を満たせなければ null。
 */
function placeThings(
  grid: Grid,
  floorCells: Pos[],
  floor: number,
  strict: boolean,
): Omit<FloorLayout, 'grid'> | null {
  const kinds = enemyKindsFor(floor)
  if (floorCells.length < 3 + kinds.length) return null

  const playerStart = floorCells[0]!
  const dist = bfsDistances(grid, playerStart)
  const taken: Pos[] = [playerStart]
  const isFree = (p: Pos) => !taken.some((t) => samePos(t, p))
  const reachable = (p: Pos) => dist[p.y]![p.x]! >= 0

  // 階段: プレイヤーから遠いところ
  const stairsMin = strict ? MIN_STAIRS_DISTANCE : 0
  const stairs = floorCells.find((p) => isFree(p) && reachable(p) && dist[p.y]![p.x]! >= stairsMin)
  if (!stairs) return null
  taken.push(stairs)

  // 敵: プレイヤーから離れたところ
  const enemies: { kind: EnemyKind; pos: Pos }[] = []
  for (const kind of kinds) {
    const pos = floorCells.find((p) => {
      if (!isFree(p) || !reachable(p)) return false
      return strict ? dist[p.y]![p.x]! >= MIN_ENEMY_DISTANCE : manhattan(p, playerStart) >= 2
    })
    if (!pos) return null
    taken.push(pos)
    enemies.push({ kind, pos })
  }

  const potion = floorCells.find((p) => isFree(p) && reachable(p))
  if (!potion) return null

  return { playerStart, stairs, potion, enemies }
}

/** ランダムな壁を置いて、全ての床がつながっているマップを試す。 */
function tryRandomLayout(rng: Rng, floor: number): FloorLayout | null {
  const grid = emptyGrid()
  const cells = rng.shuffle(interiorCells())
  const wallCount = 10 + rng.int(9)
  for (const p of cells.slice(0, wallCount)) grid[p.y]![p.x] = 'wall'

  const floorCells = cells.slice(wallCount)
  // 孤立した床を作らない(どの床にも歩いて行けるようにする)
  const dist = bfsDistances(grid, floorCells[0]!)
  if (floorCells.some((p) => dist[p.y]![p.x]! < 0)) return null

  const placed = placeThings(grid, floorCells, floor, true)
  return placed ? { grid, ...placed } : null
}

/**
 * 最終手段のマップ。柱(偶数座標)が並ぶだけなので、構造上かならず全マスがつながる。
 * 配置の乱数は同じシードから引くので、フォールバックでも再現性は保たれる。
 */
export function fallbackLayout(rng: Rng, floor: number): FloorLayout {
  const grid = emptyGrid()
  for (let y = 2; y < MAP_SIZE - 1; y += 2) for (let x = 2; x < MAP_SIZE - 1; x += 2) grid[y]![x] = 'wall'
  const floorCells = rng.shuffle(interiorCells().filter((p) => grid[p.y]![p.x] === 'floor'))
  const placed = placeThings(grid, floorCells, floor, true) ?? placeThings(grid, floorCells, floor, false)
  // 柱だけの開けたマップなので、ここで null になることはない
  if (!placed) throw new Error('fallback layout failed')
  return { grid, ...placed }
}

/** 階層 floor(1始まり)のマップを、ゲームのシードから決定的に生成する。 */
export function generateFloor(seed: number, floor: number, options: GenerateOptions = {}): GeneratedFloor {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const rng = createRng(deriveSeed(seed, floor))
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const layout = tryRandomLayout(rng, floor)
    if (layout && validateLayout(layout)) return { layout, attempts: attempt, usedFallback: false }
  }
  const layout = fallbackLayout(rng, floor)
  return { layout, attempts: maxAttempts + 1, usedFallback: true }
}
