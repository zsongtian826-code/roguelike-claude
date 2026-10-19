import { MAP_SIZE } from './constants.ts'
import type { Dir, Grid, Pos } from './types.ts'

export const DIR_VECTORS: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

/** 同じ長さの最短経路があるときの優先順(上・右・下・左) */
export const DIR_ORDER: readonly Dir[] = ['up', 'right', 'down', 'left']

export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y

export const manhattan = (a: Pos, b: Pos): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export const step = (p: Pos, d: Dir): Pos => ({ x: p.x + DIR_VECTORS[d].x, y: p.y + DIR_VECTORS[d].y })

export function inBounds(p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < MAP_SIZE && p.y < MAP_SIZE
}

/** 範囲外も壁として扱う */
export function isWall(grid: Grid, p: Pos): boolean {
  return !inBounds(p) || grid[p.y]![p.x] === 'wall'
}

/**
 * from からの幅優先探索。到達できないマスは -1。
 * blocked が true のマスは通れない(from 自身は常に起点として扱う)。
 */
export function bfsDistances(grid: Grid, from: Pos, blocked: (p: Pos) => boolean = () => false): number[][] {
  const dist: number[][] = Array.from({ length: MAP_SIZE }, () => new Array<number>(MAP_SIZE).fill(-1))
  dist[from.y]![from.x] = 0
  const queue: Pos[] = [from]
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!
    const d = dist[cur.y]![cur.x]!
    for (const dir of DIR_ORDER) {
      const n = step(cur, dir)
      if (isWall(grid, n) || dist[n.y]![n.x] !== -1 || blocked(n)) continue
      dist[n.y]![n.x] = d + 1
      queue.push(n)
    }
  }
  return dist
}
