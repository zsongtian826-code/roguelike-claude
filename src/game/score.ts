import type { Stats } from './types.ts'

/**
 * クリア時のスコア。
 *   クリアボーナス 3000 + 残りHP×50 + 速さボーナス(1500 − ターン×10、下限0) + 倒した敵×100 − 受けたダメージ×10
 * 少ないターンで、HPを残して、被弾を抑えるほど高くなる。下限は0。
 */
export function calcScore(stats: Stats, hp: number): number {
  const speedBonus = Math.max(0, 1500 - stats.turns * 10)
  const score = 3000 + hp * 50 + speedBonus + stats.kills * 100 - stats.damageTaken * 10
  return Math.max(0, score)
}
