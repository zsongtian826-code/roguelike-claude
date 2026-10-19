import { decideEnemyAction } from './ai.ts'
import {
  ENEMY_SPECS,
  PLAYER_ATK,
  PLAYER_MAX_HP,
  POTION_HEAL,
  TOTAL_FLOORS,
} from './constants.ts'
import { generateFloor } from './mapGen.ts'
import type { FloorLayout } from './mapGen.ts'
import { isWall, samePos, step } from './pathfinding.ts'
import type { ActionResult, Dir, Enemy, GameEvent, GameState, Player, Stats } from './types.ts'

const emptyStats = (): Stats => ({ turns: 0, moves: 0, attacks: 0, kills: 0, damageTaken: 0, healed: 0 })

function spawnEnemies(layout: FloorLayout, floor: number): Enemy[] {
  return layout.enemies.map(({ kind, pos }, i) => ({
    id: floor * 100 + i + 1, // 全階層で一意。生成順 = ID昇順
    kind,
    hp: ENEMY_SPECS[kind].hp,
    maxHp: ENEMY_SPECS[kind].hp,
    atk: ENEMY_SPECS[kind].atk,
    pos: { ...pos },
  }))
}

function floorState(seed: number, floor: number, player: Player, stats: Stats): GameState {
  const { layout } = generateFloor(seed, floor)
  return {
    seed,
    floor,
    grid: layout.grid,
    stairs: layout.stairs,
    potion: layout.potion,
    player: { ...player, pos: { ...layout.playerStart } },
    enemies: spawnEnemies(layout, floor),
    stats,
    status: 'playing',
  }
}

/** 新しいゲーム(第1階層)。同じシードなら同じ状態になる。 */
export function createGame(seed: number): GameState {
  const player: Player = { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, atk: PLAYER_ATK, pos: { x: 0, y: 0 } }
  return floorState(seed, 1, player, emptyStats())
}

const enemyAt = (enemies: readonly Enemy[], p: { x: number; y: number }) =>
  enemies.find((e) => samePos(e.pos, p))

/**
 * プレイヤーの1回の操作を処理する純粋関数。入力された state は書き換えない。
 *
 * 流れ: 操作の有効判定 → 移動/攻撃 → (階層移動なら終了) → 敵がID順に1回ずつ行動 → 次のターン
 * 無効な操作(壁・階段ロック・終了後)は accepted=false で、ターンも敵の行動も起きない。
 */
export function applyAction(prev: GameState, dir: Dir): ActionResult {
  const reject = (events: GameEvent[] = []): ActionResult => ({ state: prev, events, accepted: false })
  if (prev.status !== 'playing') return reject()

  const target = step(prev.player.pos, dir)
  if (isWall(prev.grid, target)) return reject([{ type: 'blocked', reason: 'wall', at: target }])

  const targetEnemy = enemyAt(prev.enemies, target)
  const onStairs = samePos(target, prev.stairs)
  if (!targetEnemy && onStairs && prev.enemies.length > 0) {
    return reject([{ type: 'blocked', reason: 'stairs-locked', at: target }])
  }

  // ここから先は有効な操作。作業用のコピーを作って更新する。
  const events: GameEvent[] = []
  const player: Player = { ...prev.player, pos: { ...prev.player.pos } }
  const enemies: Enemy[] = prev.enemies.map((e) => ({ ...e, pos: { ...e.pos } }))
  const stats: Stats = { ...prev.stats, turns: prev.stats.turns + 1 }
  let potion = prev.potion

  if (targetEnemy) {
    // --- 攻撃(移動はしない) ---
    const enemy = enemies.find((e) => e.id === targetEnemy.id)!
    enemy.hp -= player.atk
    stats.attacks += 1
    const killed = enemy.hp <= 0
    events.push({ type: 'player-attack', enemyId: enemy.id, at: { ...enemy.pos }, damage: player.atk, killed })
    if (killed) {
      enemies.splice(enemies.indexOf(enemy), 1)
      stats.kills += 1
    }
  } else {
    // --- 移動 ---
    events.push({ type: 'move', from: { ...player.pos }, to: { ...target } })
    player.pos = { ...target }
    stats.moves += 1

    if (onStairs) {
      // 敵が残っていない場合だけここに来る(上で弾いている)。旧階層の敵は行動しない。
      if (prev.floor >= TOTAL_FLOORS) {
        events.push({ type: 'clear' })
        return { state: { ...prev, player, enemies, stats, status: 'clear' }, events, accepted: true }
      }
      events.push({ type: 'descend', toFloor: prev.floor + 1 })
      return { state: floorState(prev.seed, prev.floor + 1, player, stats), events, accepted: true }
    }

    if (potion && samePos(potion, target)) {
      // 取得は移動と同時。追加ターンは消費しない。
      const healed = Math.min(POTION_HEAL, player.maxHp - player.hp)
      player.hp += healed
      stats.healed += healed
      events.push({ type: 'potion', at: { ...potion }, healed })
      potion = null
    }
  }

  // --- 敵のターン: ID昇順に、1体1回だけ ---
  let status: GameState['status'] = 'playing'
  const order = enemies.map((e) => e.id).sort((a, b) => a - b)
  for (const id of order) {
    const enemy = enemies.find((e) => e.id === id)
    if (!enemy || enemy.hp <= 0) continue
    const decision = decideEnemyAction(prev.grid, enemy, player.pos, enemies)
    if (decision.type === 'attack') {
      const actual = Math.min(enemy.atk, player.hp)
      player.hp -= actual
      stats.damageTaken += actual
      events.push({ type: 'enemy-attack', enemyId: enemy.id, from: { ...enemy.pos }, at: { ...player.pos }, damage: enemy.atk })
      if (player.hp <= 0) {
        // 死亡した時点で以降の敵は行動しない
        status = 'gameover'
        events.push({ type: 'player-dead' })
        break
      }
    } else if (decision.type === 'move') {
      events.push({ type: 'enemy-move', enemyId: enemy.id, from: { ...enemy.pos }, to: { ...decision.to } })
      enemy.pos = { ...decision.to }
    }
  }

  return {
    state: { ...prev, player, enemies, stats, potion, status },
    events,
    accepted: true,
  }
}
