import type { EnemyKind } from './types.ts'

export const MAP_SIZE = 11
export const TOTAL_FLOORS = 3

export const PLAYER_MAX_HP = 30
export const PLAYER_ATK = 5

export const POTION_HEAL = 8

export const ENEMY_SPECS: Record<EnemyKind, { hp: number; atk: number; name: string }> = {
  A: { hp: 8, atk: 2, name: 'ぬめり' },
  B: { hp: 12, atk: 3, name: '牙の番人' },
}

/** 階層ごとの敵の構成(index 0 = 第1階層) */
export const FLOOR_ENEMIES: readonly (readonly EnemyKind[])[] = [
  ['A', 'A'],
  ['A', 'B'],
  ['B', 'B'],
]

export const FLOOR_NAMES = ['苔むす入口', '忘れられた回廊', '灯の絶える底'] as const

export const MAX_SEED = 4294967295
