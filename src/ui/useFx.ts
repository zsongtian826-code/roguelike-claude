import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../audio/sound.ts'
import { ENEMY_SPECS, FLOOR_NAMES } from '../game/constants.ts'
import type { Snapshot } from '../game/session.ts'
import { DIR_VECTORS } from '../game/pathfinding.ts'
import type { Dir, EnemyKind, GameEvent, Pos } from '../game/types.ts'

/**
 * 演出(ダメージ表示・パーティクル・ログ・効果音)の状態。
 * ゲームの状態(Snapshot)を読むだけで、ゲームの状態には一切書き込まない。
 * 演出が遅れても消えても、ゲームの進行には影響しない。
 */

export interface Popup {
  id: number
  pos: Pos
  text: string
  kind: 'enemy-dmg' | 'player-dmg' | 'heal' | 'kill' | 'info'
}
export interface Burst {
  id: number
  pos: Pos
  kind: 'kill' | 'heal' | 'hit'
}
export interface Ghost {
  id: number
  kind: EnemyKind
  pos: Pos
}
export interface LogLine {
  id: number
  text: string
  tone: 'player' | 'enemy' | 'good' | 'info' | 'bad'
}
export interface Lunge {
  dx: number
  dy: number
  /** 同じ向きでも毎回アニメーションをやり直すための連番 */
  n: number
}

export interface FxState {
  popups: Popup[]
  bursts: Burst[]
  ghosts: Ghost[]
  /** キーは 'player' か敵ID */
  lunges: Record<string, Lunge>
  /** プレイヤーが被弾するたびに増える(画面揺れ・赤フラッシュ) */
  hurtSeq: number
  /** 壁にぶつかるたびに増える */
  bumpSeq: number
  bumpDir: Dir | null
  /** 階段が閉ざされていると知らされるたびに増える */
  lockedSeq: number
  logs: LogLine[]
}

const LOG_LIMIT = 40
const POPUP_MS = 1000
const BURST_MS = 700
const GHOST_MS = 450

const initialFx = (): FxState => ({
  popups: [],
  bursts: [],
  ghosts: [],
  lunges: {},
  hurtSeq: 0,
  bumpSeq: 0,
  bumpDir: null,
  lockedSeq: 0,
  logs: [],
})

const dirOf = (from: Pos, to: Pos): Dir => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

const sign = (n: number) => Math.sign(n)

export function useFx(snapshot: Snapshot): FxState {
  const [fx, setFx] = useState<FxState>(() => ({
    ...initialFx(),
    logs: [{ id: 0, text: `第1階層「${FLOOR_NAMES[0]}」に足を踏み入れた。`, tone: 'info' }],
  }))
  const idRef = useRef(1)
  const timers = useRef(new Set<number>())
  const enemyKinds = useRef(new Map<number, EnemyKind>())
  const handled = useRef({ seq: 0, blocked: 0 })

  // 敵の種類を覚えておく(倒された敵の名前をログに出すため)
  useEffect(() => {
    for (const e of snapshot.state.enemies) enemyKinds.current.set(e.id, e.kind)
  }, [snapshot.state.enemies])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending) window.clearTimeout(t)
      pending.clear()
    }
  }, [])

  // 有効な操作で起きたことを演出にする
  useEffect(() => {
    if (snapshot.seq === handled.current.seq) return
    handled.current.seq = snapshot.seq
    const newId = () => idRef.current++
    const expire = (ms: number, fn: () => void) => {
      const t = window.setTimeout(() => {
        timers.current.delete(t)
        fn()
      }, ms)
      timers.current.add(t)
    }
    const nameOf = (id: number) => {
      const kind = enemyKinds.current.get(id) ?? 'A'
      return ENEMY_SPECS[kind].name
    }
    const playerPos = (events: GameEvent[]): Pos => {
      // 攻撃したときは動かない。移動したときは移動先。
      const mv = events.find((e) => e.type === 'move')
      return mv && mv.type === 'move' ? mv.to : snapshot.state.player.pos
    }
    const at = playerPos(snapshot.events)

    const add: Pick<FxState, 'popups' | 'bursts' | 'ghosts' | 'logs'> = { popups: [], bursts: [], ghosts: [], logs: [] }
    const lunges: Record<string, Lunge> = {}
    let hurt = false
    const sfx: Parameters<typeof playSfx>[0][] = []
    const log = (text: string, tone: LogLine['tone']) => add.logs.push({ id: newId(), text, tone })
    const lungeN = newId()

    for (const e of snapshot.events) {
      switch (e.type) {
        case 'move':
          sfx.push('step')
          break
        case 'player-attack': {
          const dir = dirOf(at, e.at)
          lunges.player = { dx: DIR_VECTORS[dir].x, dy: DIR_VECTORS[dir].y, n: lungeN }
          add.popups.push({ id: newId(), pos: e.at, text: `-${e.damage}`, kind: 'enemy-dmg' })
          add.bursts.push({ id: newId(), pos: e.at, kind: e.killed ? 'kill' : 'hit' })
          if (e.killed) {
            const kind = enemyKinds.current.get(e.enemyId) ?? 'A'
            add.ghosts.push({ id: newId(), kind, pos: e.at })
            add.popups.push({ id: newId(), pos: { x: e.at.x, y: e.at.y - 0.6 }, text: '撃破!', kind: 'kill' })
            log(`${nameOf(e.enemyId)}を倒した!`, 'good')
            sfx.push('kill')
          } else {
            log(`${nameOf(e.enemyId)}に${e.damage}のダメージ。`, 'player')
            sfx.push('hit')
          }
          break
        }
        case 'enemy-attack':
          lunges[String(e.enemyId)] = { dx: sign(e.at.x - e.from.x), dy: sign(e.at.y - e.from.y), n: lungeN }
          add.popups.push({ id: newId(), pos: e.at, text: `-${e.damage}`, kind: 'player-dmg' })
          add.bursts.push({ id: newId(), pos: e.at, kind: 'hit' })
          log(`${nameOf(e.enemyId)}の攻撃! ${e.damage}のダメージを受けた。`, 'enemy')
          hurt = true
          sfx.push('hurt')
          break
        case 'potion':
          add.popups.push({
            id: newId(),
            pos: { x: e.at.x, y: e.at.y - 0.3 },
            text: e.healed > 0 ? `+${e.healed}` : 'HPは満タン',
            kind: 'heal',
          })
          add.bursts.push({ id: newId(), pos: e.at, kind: 'heal' })
          log(e.healed > 0 ? `ポーションでHPが${e.healed}回復した。` : 'ポーションを拾った。HPはすでに満タンだ。', 'good')
          sfx.push('potion')
          break
        case 'descend':
          log(`階段を降りた。第${e.toFloor}階層「${FLOOR_NAMES[e.toFloor - 1]}」。`, 'info')
          sfx.push('descend')
          break
        case 'player-dead':
          log('力尽きた…', 'bad')
          break
        case 'clear':
          log('ダンジョンを踏破した!', 'good')
          break
        default:
          break
      }
    }
    // 倒した敵が最後の1体だったとき
    if (snapshot.state.status === 'playing' && snapshot.state.enemies.length === 0 && snapshot.events.some((e) => e.type === 'player-attack' && e.killed)) {
      log('敵は全滅した。階段の封印が解けた。', 'info')
    }
    if (snapshot.state.status === 'gameover') sfx.push('lose')
    if (snapshot.state.status === 'clear') sfx.push('win')

    // 効果音は1操作につき主要なものだけ鳴らす(重なりすぎ防止)。階層移動・終了の音は単独で鳴らす。
    const terminal = (['win', 'lose', 'descend'] as const).find((n) => sfx.includes(n))
    if (terminal) {
      playSfx(terminal)
    } else {
      const own = (['kill', 'potion', 'hit', 'step'] as const).find((n) => sfx.includes(n))
      if (own) playSfx(own)
      if (sfx.includes('hurt')) playSfx('hurt')
    }

    setFx((prev) => ({
      ...prev,
      popups: [...prev.popups, ...add.popups],
      bursts: [...prev.bursts, ...add.bursts],
      ghosts: [...prev.ghosts, ...add.ghosts],
      lunges: { ...prev.lunges, ...lunges },
      hurtSeq: prev.hurtSeq + (hurt ? 1 : 0),
      logs: [...prev.logs, ...add.logs].slice(-LOG_LIMIT),
    }))

    const drop = <K extends 'popups' | 'bursts' | 'ghosts'>(key: K, items: { id: number }[], ms: number) => {
      if (items.length === 0) return
      const ids = new Set(items.map((i) => i.id))
      expire(ms, () => setFx((prev) => ({ ...prev, [key]: prev[key].filter((i) => !ids.has(i.id)) })))
    }
    drop('popups', add.popups, POPUP_MS)
    drop('bursts', add.bursts, BURST_MS)
    drop('ghosts', add.ghosts, GHOST_MS)
  }, [snapshot])

  // 無効な操作(壁・封印された階段)へのフィードバック
  useEffect(() => {
    if (snapshot.blockedSeq === handled.current.blocked) return
    handled.current.blocked = snapshot.blockedSeq
    const b = snapshot.lastBlocked
    if (!b || b.type !== 'blocked') return
    if (b.reason === 'wall') {
      playSfx('bump')
      setFx((prev) => ({
        ...prev,
        bumpSeq: prev.bumpSeq + 1,
        bumpDir: dirOf(snapshot.state.player.pos, b.at),
      }))
    } else {
      playSfx('locked')
      setFx((prev) => ({
        ...prev,
        lockedSeq: prev.lockedSeq + 1,
        bumpSeq: prev.bumpSeq + 1,
        bumpDir: dirOf(snapshot.state.player.pos, b.at),
        logs: [...prev.logs, { id: idRef.current++, text: '敵が残っている。階段はまだ封じられている。', tone: 'info' as const }].slice(-LOG_LIMIT),
      }))
    }
  }, [snapshot.blockedSeq, snapshot.lastBlocked, snapshot.state.player.pos])

  return fx
}
