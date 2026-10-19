export interface Pos {
  x: number
  y: number
}

export type Dir = 'up' | 'right' | 'down' | 'left'

export type Tile = 'floor' | 'wall'

/** grid[y][x] */
export type Grid = Tile[][]

export type EnemyKind = 'A' | 'B'

export interface Enemy {
  /** 階層内で一意。この昇順に行動する。 */
  id: number
  kind: EnemyKind
  hp: number
  maxHp: number
  atk: number
  pos: Pos
}

export interface Player {
  hp: number
  maxHp: number
  atk: number
  pos: Pos
}

export interface Stats {
  turns: number
  moves: number
  attacks: number
  kills: number
  /** 実際に減ったHPの合計(超過分は含めない) */
  damageTaken: number
  /** 実際に回復したHPの合計 */
  healed: number
}

export type Status = 'playing' | 'gameover' | 'clear'

export interface GameState {
  seed: number
  /** 現在の階層(1始まり)。ゲームオーバー時は到達階層、クリア時は最終階層。 */
  floor: number
  grid: Grid
  stairs: Pos
  /** 取得済みなら null */
  potion: Pos | null
  player: Player
  enemies: Enemy[]
  stats: Stats
  status: Status
}

/** ゲーム状態の更新で起きたこと。UIの演出・ログ・効果音はこれを見て行う。 */
export type GameEvent =
  | { type: 'blocked'; reason: 'wall' | 'stairs-locked'; at: Pos }
  | { type: 'move'; from: Pos; to: Pos }
  | { type: 'player-attack'; enemyId: number; at: Pos; damage: number; killed: boolean }
  | { type: 'enemy-move'; enemyId: number; from: Pos; to: Pos }
  | { type: 'enemy-attack'; enemyId: number; from: Pos; at: Pos; damage: number }
  | { type: 'potion'; at: Pos; healed: number }
  | { type: 'descend'; toFloor: number }
  | { type: 'player-dead' }
  | { type: 'clear' }

export interface ActionResult {
  state: GameState
  events: GameEvent[]
  /** false のとき、ターンは進んでおらず state も変わっていない */
  accepted: boolean
}
