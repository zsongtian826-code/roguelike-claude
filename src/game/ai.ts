import { bfsDistances, DIR_ORDER, isWall, manhattan, samePos, step } from './pathfinding.ts'
import type { Enemy, Grid, Pos } from './types.ts'

export type EnemyDecision = { type: 'attack' } | { type: 'move'; to: Pos } | { type: 'wait' }

/**
 * 敵1体の行動を決める(状態は変えない)。
 * 1. 上下左右に隣接していれば攻撃
 * 2. そうでなければ、壁と他の敵を避けた最短経路で1マス近づく(同じ長さなら 上→右→下→左)
 * 3. 道がなければ待機
 */
export function decideEnemyAction(grid: Grid, enemy: Enemy, playerPos: Pos, allEnemies: readonly Enemy[]): EnemyDecision {
  if (manhattan(enemy.pos, playerPos) === 1) return { type: 'attack' }

  const others = allEnemies.filter((e) => e.id !== enemy.id)
  const occupied = (p: Pos) => others.some((e) => samePos(e.pos, p))

  // プレイヤーを起点に距離を測る。他の敵のマスは通れない。
  const dist = bfsDistances(grid, playerPos, occupied)
  const here = dist[enemy.pos.y]![enemy.pos.x]!
  if (here < 0) return { type: 'wait' }

  for (const dir of DIR_ORDER) {
    const to = step(enemy.pos, dir)
    if (isWall(grid, to) || occupied(to) || samePos(to, playerPos)) continue
    if (dist[to.y]![to.x] === here - 1) return { type: 'move', to }
  }
  return { type: 'wait' }
}
