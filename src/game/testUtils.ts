import { ENEMY_SPECS, MAP_SIZE, PLAYER_ATK, PLAYER_MAX_HP } from './constants.ts'
import type { Enemy, EnemyKind, GameState, Grid, Pos } from './types.ts'

export interface StateOptions {
  floor?: number
  hp?: number
  /** 敵のHPの上書き(IDまたは出現順の位置 → HP) */
  enemyHp?: Record<number, number>
}

/**
 * テスト用に、文字の絵から GameState を作る。絵は盤面の内側(左上 = (1,1))に置かれ、
 * 絵の外は壁になる。
 *   # 壁   . 床   @ プレイヤー   > 階段   p ポーション   A 通常の敵   B 強敵
 * 敵のIDは、上の行から左→右の出現順に 1, 2, 3... となる。
 */
export function stateFromPicture(picture: string[], options: StateOptions = {}): GameState {
  const grid: Grid = Array.from({ length: MAP_SIZE }, () => new Array(MAP_SIZE).fill('wall'))
  let player: Pos | null = null
  let stairs: Pos | null = null
  let potion: Pos | null = null
  const enemies: Enemy[] = []

  picture.forEach((line, row) => {
    ;[...line].forEach((ch, col) => {
      const pos = { x: col + 1, y: row + 1 }
      if (ch === '#') return
      grid[pos.y]![pos.x] = 'floor'
      if (ch === '@') player = pos
      else if (ch === '>') stairs = pos
      else if (ch === 'p') potion = pos
      else if (ch === 'A' || ch === 'B') {
        const kind: EnemyKind = ch
        const id = enemies.length + 1
        const spec = ENEMY_SPECS[kind]
        enemies.push({ id, kind, hp: options.enemyHp?.[id] ?? spec.hp, maxHp: spec.hp, atk: spec.atk, pos })
      }
    })
  })
  if (!player) throw new Error('picture needs @')

  return {
    seed: 0,
    floor: options.floor ?? 1,
    grid,
    // 絵に階段がなければ、盤面の隅(壁の中)に置く = 実質使えない階段
    stairs: stairs ?? { x: MAP_SIZE - 2, y: MAP_SIZE - 2 },
    potion,
    player: { hp: options.hp ?? PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, atk: PLAYER_ATK, pos: player },
    enemies,
    stats: { turns: 0, moves: 0, attacks: 0, kills: 0, damageTaken: 0, healed: 0 },
    status: 'playing',
  }
}
