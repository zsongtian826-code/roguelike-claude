import { describe, expect, it } from 'vitest'
import { decideEnemyAction } from './ai.ts'
import { PLAYER_MAX_HP, TOTAL_FLOORS } from './constants.ts'
import { applyAction, createGame } from './engine.ts'
import { generateFloor } from './mapGen.ts'
import { bfsDistances, DIR_ORDER, DIR_VECTORS, manhattan, samePos } from './pathfinding.ts'
import { createRng } from './rng.ts'
import { stateFromPicture } from './testUtils.ts'
import type { Dir, GameState } from './types.ts'

describe('テスト4: 壁を通過できない', () => {
  it('壁へ移動しようとしても位置が変わらず、操作は無効', () => {
    const s = stateFromPicture(['@.'])
    for (const dir of ['up', 'down', 'left'] as const) {
      const r = applyAction(s, dir)
      expect(r.accepted).toBe(false)
      expect(r.state).toBe(s)
      expect(r.state.player.pos).toEqual({ x: 1, y: 1 })
    }
  })

  it('外周の壁も通れない', () => {
    const s = stateFromPicture(['@'])
    expect(applyAction(s, 'up').accepted).toBe(false)
    expect(applyAction(s, 'left').accepted).toBe(false)
  })

  it('床には1マス移動でき、ターンと移動回数が増える', () => {
    const s = stateFromPicture(['@.'])
    const r = applyAction(s, 'right')
    expect(r.accepted).toBe(true)
    expect(r.state.player.pos).toEqual({ x: 2, y: 1 })
    expect(r.state.stats).toMatchObject({ turns: 1, moves: 1, attacks: 0 })
  })
})

describe('テスト5: 壁への移動では敵が行動しない', () => {
  it('敵の位置もHPもプレイヤーのHPも変わらない', () => {
    const s = stateFromPicture(['@...A'])
    const r = applyAction(s, 'up')
    expect(r.accepted).toBe(false)
    expect(r.events.every((e) => e.type === 'blocked')).toBe(true)
    expect(r.state.enemies).toEqual(s.enemies)
    expect(r.state.stats.turns).toBe(0)
  })

  it('隣接した敵がいても、壁に当たったときは殴られない', () => {
    const s = stateFromPicture(['@A'])
    const r = applyAction(s, 'up')
    expect(r.state.player.hp).toBe(PLAYER_MAX_HP)
  })
})

describe('テスト6・7: 戦闘', () => {
  it('敵への移動は攻撃になり、HPを5減らし、プレイヤーは動かない', () => {
    const s = stateFromPicture(['@A'])
    const r = applyAction(s, 'right')
    expect(r.state.enemies[0]!.hp).toBe(8 - 5)
    expect(r.state.player.pos).toEqual({ x: 1, y: 1 })
    expect(r.state.stats).toMatchObject({ turns: 1, moves: 0, attacks: 1, kills: 0 })
  })

  it('生き残った敵は反撃する(HPを攻撃力分だけ減らす)', () => {
    const r = applyAction(stateFromPicture(['@A']), 'right')
    expect(r.state.player.hp).toBe(PLAYER_MAX_HP - 2)
    expect(r.state.stats.damageTaken).toBe(2)
    const strong = applyAction(stateFromPicture(['@B']), 'right')
    expect(strong.state.enemies[0]!.hp).toBe(12 - 5)
    expect(strong.state.player.hp).toBe(PLAYER_MAX_HP - 3)
  })

  it('敵Aは2回、敵Bは3回の攻撃で倒れる', () => {
    let s = stateFromPicture(['@A'])
    s = applyAction(s, 'right').state
    expect(s.enemies).toHaveLength(1)
    s = applyAction(s, 'right').state
    expect(s.enemies).toHaveLength(0)

    let b = stateFromPicture(['@B'])
    for (let i = 0; i < 2; i++) b = applyAction(b, 'right').state
    expect(b.enemies).toHaveLength(1)
    expect(b.enemies[0]!.hp).toBe(2)
    b = applyAction(b, 'right').state
    expect(b.enemies).toHaveLength(0)
    expect(b.stats.kills).toBe(1)
    expect(b.stats.attacks).toBe(3)
  })

  it('テスト7: HPが0以下になった敵は消え、そのターンは反撃しない', () => {
    const s = stateFromPicture(['@A'], { enemyHp: { 1: 5 } })
    const r = applyAction(s, 'right')
    expect(r.state.enemies).toEqual([])
    expect(r.state.player.hp).toBe(PLAYER_MAX_HP)
    expect(r.state.stats.kills).toBe(1)
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'player-attack', killed: true }))
    expect(r.events.some((e) => e.type === 'enemy-attack')).toBe(false)
  })

  it('HPを超えるダメージは、超過分を受けたダメージに含めない', () => {
    const s = stateFromPicture(['@B'], { hp: 2 })
    const r = applyAction(s, 'right')
    expect(r.state.status).toBe('gameover')
    expect(r.state.player.hp).toBe(0)
    expect(r.state.stats.damageTaken).toBe(2) // 実際に減ったのは2だけ(3ではない)
  })
})

describe('テスト8: 敵が障害物を避けて追跡する', () => {
  it('壁を迂回する向きに動く', () => {
    // 敵はプレイヤーの右上。間の壁(#)を避けて回り込む。
    const s = stateFromPicture([
      '@.#..',
      '.##..',
      '.#..A',
      '...#.',
    ])
    const enemy = s.enemies[0]!
    const d = decideEnemyAction(s.grid, enemy, s.player.pos, s.enemies)
    // 上や右へ行くと行き止まり。壁を迂回できる左だけが最短経路上
    expect(d).toEqual({ type: 'move', to: { x: 4, y: 3 } })
    const dist = bfsDistances(s.grid, s.player.pos)
    expect(dist[3]![4]).toBe(dist[3]![5]! - 1)
  })

  it('何ターンか追わせると、壁を迂回して隣接する', () => {
    let s = stateFromPicture(['@#..', '.#.#', '...A'])
    // プレイヤーは動かさず、敵の判断だけを繰り返し適用する
    for (let i = 0; i < 20; i++) {
      const enemy = s.enemies[0]!
      const d = decideEnemyAction(s.grid, enemy, s.player.pos, s.enemies)
      if (d.type === 'attack') break
      if (d.type === 'move') s = { ...s, enemies: [{ ...enemy, pos: d.to }] }
    }
    expect(manhattan(s.enemies[0]!.pos, s.player.pos)).toBe(1)
  })

  it('最短経路が複数あるときは 上→右→下→左 の順で選ぶ', () => {
    // 敵(右下)から見て、上へ行っても左へ行っても同じ距離
    const s = stateFromPicture(['@..', '...', '..A'])
    const d = decideEnemyAction(s.grid, s.enemies[0]!, s.player.pos, s.enemies)
    expect(d).toEqual({ type: 'move', to: { x: 3, y: 2 } }) // 上
    const s2 = stateFromPicture(['A..', '...', '..@'])
    // 敵は左上。右へ行っても下へ行っても同じ → 右が先
    const d2 = decideEnemyAction(s2.grid, s2.enemies[0]!, s2.player.pos, s2.enemies)
    expect(d2).toEqual({ type: 'move', to: { x: 2, y: 1 } })
    expect(DIR_ORDER).toEqual(['up', 'right', 'down', 'left'])
  })

  it('隣接していれば移動せず攻撃を選ぶ', () => {
    const s = stateFromPicture(['@A'])
    expect(decideEnemyAction(s.grid, s.enemies[0]!, s.player.pos, s.enemies)).toEqual({ type: 'attack' })
  })

  it('斜めは隣接ではない(攻撃せず近づく)', () => {
    const s = stateFromPicture(['@.', '.A'])
    const d = decideEnemyAction(s.grid, s.enemies[0]!, s.player.pos, s.enemies)
    expect(d.type).toBe('move')
  })

  it('道がなければ待機する', () => {
    const s = stateFromPicture(['@#A'])
    expect(decideEnemyAction(s.grid, s.enemies[0]!, s.player.pos, s.enemies)).toEqual({ type: 'wait' })
  })

  it('ターン処理の中でも敵がプレイヤーへ近づく', () => {
    const s = stateFromPicture(['@.....A', '.......'])
    // プレイヤーが右へ1歩 → 敵が1マス左へ
    const r = applyAction(s, 'right')
    expect(r.state.enemies[0]!.pos).toEqual({ x: 6, y: 1 })
  })
})

describe('テスト9: 敵同士が同じマスに移動しない', () => {
  it('細い通路でも重ならない', () => {
    // 通路で押し合う: 先頭の敵が動いたあと、後ろの敵が詰める
    const t = stateFromPicture(['.@...AA', '.......'])
    const after = applyAction(t, 'left').state
    const cells = after.enemies.map((e) => `${e.pos.x},${e.pos.y}`)
    expect(new Set(cells).size).toBe(cells.length)
  })

  it('1本道で前の敵に塞がれた敵は、割り込まず待つ', () => {
    // IDが小さい(先に動く)敵が後ろにいる: 前の敵がまだ動いていないので道が塞がれている
    const s = stateFromPicture(['.@..AB'])
    const [front, back] = s.enemies as [typeof s.enemies[0], typeof s.enemies[0]]
    const swapped: GameState = { ...s, enemies: [{ ...back, id: 1 }, { ...front, id: 2 }] }
    const r = applyAction(swapped, 'left')
    const byId = (id: number) => r.state.enemies.find((e) => e.id === id)!
    expect(byId(1).pos).toEqual({ x: 6, y: 1 }) // 後ろの敵は待機
    expect(byId(2).pos).toEqual({ x: 4, y: 1 }) // 前の敵は近づく
    expect(r.events.filter((e) => e.type === 'enemy-move')).toHaveLength(1)
  })

  it('ランダムな状況で何ターン進めても、敵が重ならない', () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = createGame(seed)
      const rng = createRng(seed)
      for (let i = 0; i < 80 && s.status === 'playing' && s.floor === 1; i++) {
        s = applyAction(s, DIR_ORDER[rng.int(4)]!).state
        const cells = s.enemies.map((e) => `${e.pos.x},${e.pos.y}`)
        expect(new Set(cells).size).toBe(cells.length)
        expect(s.enemies.some((e) => samePos(e.pos, s.player.pos))).toBe(false)
      }
    }
  })
})

describe('テスト10: 敵は1ターンに2回以上行動しない', () => {
  it('1回の操作で、各敵のイベントは多くても1つ', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let s = createGame(seed)
      const rng = createRng(seed * 3)
      for (let i = 0; i < 60 && s.status === 'playing' && s.floor === 1; i++) {
        const r = applyAction(s, DIR_ORDER[rng.int(4)]!)
        const counts = new Map<number, number>()
        for (const e of r.events) {
          if (e.type === 'enemy-move' || e.type === 'enemy-attack') {
            counts.set(e.enemyId, (counts.get(e.enemyId) ?? 0) + 1)
          }
        }
        for (const n of counts.values()) expect(n).toBeLessThanOrEqual(1)
        s = r.state
      }
    }
  })

  it('敵はID昇順に行動する', () => {
    const s = stateFromPicture(['.....', '..@..', '.....', 'A...B'])
    const r = applyAction(s, 'up')
    const ids = r.events.filter((e) => e.type === 'enemy-move').map((e) => e.enemyId)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    expect(ids.length).toBe(2)
  })

  it('攻撃した敵はそのターン移動しない', () => {
    const s = stateFromPicture(['@A'])
    const atk = applyAction(s, 'right')
    expect(atk.state.enemies[0]!.pos).toEqual({ x: 2, y: 1 })
    expect(atk.events.filter((e) => e.type === 'enemy-move')).toHaveLength(0)
  })
})

describe('テスト11: プレイヤー死亡後に追加行動が発生しない', () => {
  it('死亡した時点で後ろの敵は行動せず、ゲームオーバーになる', () => {
    // プレイヤー(HP2)の左右に敵。左の敵を殴ると、生き残った左の敵(ID1)の反撃で死亡 → ID2は行動しない
    const s = stateFromPicture(['A@A'], { hp: 2 })
    const r = applyAction(s, 'left')
    expect(r.state.status).toBe('gameover')
    expect(r.state.player.hp).toBe(0)
    expect(r.events.filter((e) => e.type === 'enemy-attack')).toHaveLength(1)
    expect(r.events.at(-1)).toEqual({ type: 'player-dead' })
    // 2体目は何もしていない
    expect(r.events.some((e) => e.type === 'enemy-attack' && e.enemyId === 2)).toBe(false)
    expect(r.state.enemies[1]!.pos).toEqual({ x: 3, y: 1 })
  })

  it('ゲームオーバー後の操作は受け付けない', () => {
    const s = stateFromPicture(['A@.'], { hp: 1 })
    const dead = applyAction(s, 'left').state
    expect(dead.status).toBe('gameover')
    const again = applyAction(dead, 'right')
    expect(again.accepted).toBe(false)
    expect(again.state).toBe(dead)
    expect(again.events).toEqual([])
  })
})

describe('テスト12: ポーション', () => {
  it('HPを8回復し、使用後は消える。追加ターンは消費しない', () => {
    const s = stateFromPicture(['@p.'], { hp: 10 })
    const r = applyAction(s, 'right')
    expect(r.state.player.hp).toBe(18)
    expect(r.state.potion).toBeNull()
    expect(r.state.stats).toMatchObject({ turns: 1, moves: 1, healed: 8 })
    expect(r.events).toContainEqual({ type: 'potion', at: { x: 2, y: 1 }, healed: 8 })
  })

  it('最大HPを超えて回復しない。回復量は実際に増えた分だけ', () => {
    const s = stateFromPicture(['@p.'], { hp: 27 })
    const r = applyAction(s, 'right')
    expect(r.state.player.hp).toBe(PLAYER_MAX_HP)
    expect(r.state.stats.healed).toBe(3)
  })

  it('HPが満タンでも取得でき、回復量は0', () => {
    const r = applyAction(stateFromPicture(['@p.']), 'right')
    expect(r.state.player.hp).toBe(PLAYER_MAX_HP)
    expect(r.state.potion).toBeNull()
    expect(r.state.stats.healed).toBe(0)
  })

  it('取得と同じターンに敵が行動する(回復後に殴られる)', () => {
    const s = stateFromPicture(['@pA'], { hp: 20 })
    // 右へ進むとポーションの上に立ち、敵と隣接 → 敵が攻撃
    const r = applyAction(s, 'right')
    expect(r.state.player.hp).toBe(20 + 8 - 2)
  })
})

describe('テスト13: 敵が残っている間は階段を使えない', () => {
  it('階段へ移動できず、ターンも敵の行動も起きない', () => {
    const s = stateFromPicture(['@>...A'])
    const r = applyAction(s, 'right')
    expect(r.accepted).toBe(false)
    expect(r.state).toBe(s)
    expect(r.events).toEqual([{ type: 'blocked', reason: 'stairs-locked', at: { x: 2, y: 1 } }])
  })

  it('敵を全て倒すと階段へ入れる(階層が進む)', () => {
    const real = createGame(11)
    let s: GameState = { ...real, enemies: [], potion: null }
    // 階段の隣へ瞬間移動させて、1歩で入る
    const dir: Dir = DIR_ORDER.find((d) => {
      const from = { x: s.stairs.x - DIR_VECTORS[d].x, y: s.stairs.y - DIR_VECTORS[d].y }
      return s.grid[from.y]![from.x] === 'floor'
    })!
    const from = { x: s.stairs.x - DIR_VECTORS[dir].x, y: s.stairs.y - DIR_VECTORS[dir].y }
    s = { ...s, player: { ...s.player, pos: from } }
    const r = applyAction(s, dir)
    expect(r.accepted).toBe(true)
    expect(r.state.floor).toBe(2)
  })
})

describe('テスト14: 階層移動でHP・統計が引き継がれる', () => {
  function descendFromFloor1() {
    const s = stateFromPicture(['@>'], { hp: 17 })
    const withStats: GameState = {
      ...s,
      seed: 99,
      stats: { turns: 40, moves: 25, attacks: 12, kills: 2, damageTaken: 13, healed: 0 },
    }
    return applyAction(withStats, 'right')
  }

  it('HPが引き継がれ、新しいマップ・敵・ポーションが用意される', () => {
    const r = descendFromFloor1()
    expect(r.state.floor).toBe(2)
    expect(r.state.status).toBe('playing')
    expect(r.state.player.hp).toBe(17)
    expect(r.state.enemies.map((e) => e.kind)).toEqual(['A', 'B'])
    expect(r.state.potion).not.toBeNull()
    expect(r.state.grid).toEqual(generateFloor(99, 2).layout.grid)
    expect(r.state.player.pos).toEqual(generateFloor(99, 2).layout.playerStart)
    expect(r.events).toContainEqual({ type: 'descend', toFloor: 2 })
  })

  it('ターン数と統計が引き継がれ、階段の移動は1ターンとして数える', () => {
    const r = descendFromFloor1()
    expect(r.state.stats).toEqual({ turns: 41, moves: 26, attacks: 12, kills: 2, damageTaken: 13, healed: 0 })
  })

  it('旧階層の敵は行動しない(新階層の敵もそのターンは動かない)', () => {
    const r = descendFromFloor1()
    expect(r.events.some((e) => e.type === 'enemy-move' || e.type === 'enemy-attack')).toBe(false)
    const fresh = generateFloor(99, 2).layout
    expect(r.state.enemies.map((e) => e.pos)).toEqual(fresh.enemies.map((e) => e.pos))
  })

  it('敵のステータスは新しい敵として初期値', () => {
    const r = descendFromFloor1()
    expect(r.state.enemies.map((e) => [e.hp, e.atk])).toEqual([[8, 2], [12, 3]])
  })
})

describe('テスト15: 第3階層の階段でクリア', () => {
  it('クリア状態になり、以降の操作は無効', () => {
    const s = stateFromPicture(['@>'], { floor: TOTAL_FLOORS })
    const r = applyAction(s, 'right')
    expect(r.state.status).toBe('clear')
    expect(r.state.floor).toBe(3)
    expect(r.events.at(-1)).toEqual({ type: 'clear' })
    expect(applyAction(r.state, 'left').accepted).toBe(false)
  })

  it('敵が残っていればクリアできない', () => {
    const s = stateFromPicture(['@>..B'], { floor: TOTAL_FLOORS })
    expect(applyAction(s, 'right').accepted).toBe(false)
  })
})

describe('テスト16: 再挑戦で初期化される', () => {
  it('createGame は毎回まっさらな第1階層を返す', () => {
    const played = applyAction(createGame(5), 'right').state
    const fresh = createGame(5)
    expect(fresh.stats).toEqual({ turns: 0, moves: 0, attacks: 0, kills: 0, damageTaken: 0, healed: 0 })
    expect(fresh.player.hp).toBe(PLAYER_MAX_HP)
    expect(fresh.floor).toBe(1)
    expect(fresh.status).toBe('playing')
    expect(fresh.enemies).toHaveLength(2)
    expect(fresh.potion).not.toBeNull()
    expect(fresh).toEqual(createGame(5))
    expect(played).not.toEqual(fresh)
  })

  it('applyAction は渡された state を書き換えない', () => {
    const s = createGame(8)
    const snapshot = structuredClone(s)
    for (const d of DIR_ORDER) applyAction(s, d)
    expect(s).toEqual(snapshot)
  })
})

/** 不変条件: どんな操作列でも、状態が破綻していない */
function expectInvariants(s: GameState, checkHp = true) {
  expect(s.player.hp).toBeLessThanOrEqual(s.player.maxHp)
  if (s.status === 'playing') expect(s.player.hp).toBeGreaterThan(0)
  expect(s.grid[s.player.pos.y]![s.player.pos.x]).toBe('floor')
  const cells = [s.player.pos, ...s.enemies.map((e) => e.pos)].map((p) => `${p.x},${p.y}`)
  expect(new Set(cells).size).toBe(cells.length)
  for (const e of s.enemies) {
    expect(e.hp).toBeGreaterThan(0)
    expect(s.grid[e.pos.y]![e.pos.x]).toBe('floor')
  }
  expect(s.stats.turns).toBe(s.stats.moves + s.stats.attacks)
  expect(s.stats.damageTaken).toBeGreaterThanOrEqual(0)
  expect(s.stats.healed).toBeGreaterThanOrEqual(0)
  if (checkHp) expect(s.player.hp).toBe(PLAYER_MAX_HP - s.stats.damageTaken + s.stats.healed)
}

describe('テスト17: 連続入力で状態が破綻しない', () => {
  it('ランダムな操作を大量に与えても不変条件を保つ', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = createGame(seed)
      const rng = createRng(seed + 1000)
      let lastTurns = 0
      for (let i = 0; i < 300; i++) {
        const r = applyAction(s, DIR_ORDER[rng.int(4)]!)
        s = r.state
        expectInvariants(s)
        expect(s.stats.turns).toBeGreaterThanOrEqual(lastTurns)
        lastTurns = s.stats.turns
        if (s.status !== 'playing') break
      }
    }
  })

  it('負けないプレイヤー(HP無限)で最後まで進めてもクリアまで到達できる', () => {
    // 敵に近づいて殴り、全滅させて階段へ。経路は BFS で選ぶ簡易ボット。
    let cleared = 0
    for (let seed = 1; seed <= 40; seed++) {
      let s = createGame(seed)
      s = { ...s, player: { ...s.player, hp: 100000, maxHp: 100000 } }
      for (let i = 0; i < 2000 && s.status === 'playing'; i++) {
        const targetPos = s.enemies.length > 0 ? s.enemies[0]!.pos : s.stairs
        const dist = bfsDistances(s.grid, targetPos)
        // 目的地に近い順に方向を試し、受け付けられた最初の手を使う(階段ロック中の階段などは拒否される)
        const candidates = DIR_ORDER.map((d) => ({
          d,
          p: { x: s.player.pos.x + DIR_VECTORS[d].x, y: s.player.pos.y + DIR_VECTORS[d].y },
        }))
          .filter(({ p }) => dist[p.y]![p.x]! >= 0)
          .sort((a, b) => dist[a.p.y]![a.p.x]! - dist[b.p.y]![b.p.x]!)
        const before = s.floor
        for (const { d } of candidates) {
          const r = applyAction(s, d)
          if (r.accepted) {
            s = r.state
            break
          }
        }
        if (s.floor !== before) s = { ...s, player: { ...s.player, hp: 100000, maxHp: 100000 } }
        expectInvariants(s, false)
      }
      if (s.status === 'clear') {
        cleared++
        expect(s.stats.kills).toBe(6)
      }
    }
    expect(cleared).toBe(40)
  })

  it('死亡後・クリア後に操作を送り続けても何も変わらない', () => {
    const s = stateFromPicture(['A@.'], { hp: 1 })
    const dead = applyAction(s, 'left').state
    expect(dead.status).toBe('gameover')
    let cur = dead
    for (let i = 0; i < 50; i++) cur = applyAction(cur, DIR_ORDER[i % 4]!).state
    expect(cur).toBe(dead)
  })
})
