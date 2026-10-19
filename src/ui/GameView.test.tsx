// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACTION_LOCK_MS, GameSession } from '../game/session.ts'
import { emptyRecords } from '../game/records.ts'
import { stateFromPicture } from '../game/testUtils.ts'
import { GameView } from './GameView.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root
let clock = 0

function setup(picture: string[], opts: { hp?: number } = {}) {
  const session = new GameSession(1, {
    now: () => clock,
    saveResult: () => {},
    initialState: stateFromPicture(picture, opts),
  })
  const onRetry = vi.fn()
  const onTitle = vi.fn()
  act(() => {
    root.render(<GameView session={session} recordsBefore={emptyRecords()} onRetry={onRetry} onTitle={onTitle} />)
  })
  return { session, onRetry, onTitle }
}

const key = (type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init }))
  })

const playerX = (s: GameSession) => s.getSnapshot().state.player.pos.x

beforeEach(() => {
  clock = 1000
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('キーボード操作', () => {
  it('WASD と矢印キーで移動できる', () => {
    const { session } = setup(['@....', '.....'])
    key('keydown', 'KeyD')
    key('keyup', 'KeyD')
    expect(playerX(session)).toBe(2)
    clock += ACTION_LOCK_MS
    key('keydown', 'ArrowRight')
    key('keyup', 'ArrowRight')
    expect(playerX(session)).toBe(3)
    clock += ACTION_LOCK_MS
    key('keydown', 'KeyS')
    key('keyup', 'KeyS')
    expect(session.getSnapshot().state.player.pos).toEqual({ x: 3, y: 2 })
    clock += ACTION_LOCK_MS
    key('keydown', 'KeyA')
    key('keyup', 'KeyA')
    clock += ACTION_LOCK_MS
    key('keydown', 'ArrowUp')
    key('keyup', 'ArrowUp')
    expect(session.getSnapshot().state.player.pos).toEqual({ x: 2, y: 1 })
  })

  it('長押し(リピート)や、離さずに続く keydown では進まない', () => {
    const { session } = setup(['@....'])
    key('keydown', 'KeyD')
    expect(playerX(session)).toBe(2)
    clock += ACTION_LOCK_MS * 5
    for (let i = 0; i < 10; i++) key('keydown', 'KeyD', { repeat: true })
    expect(playerX(session)).toBe(2)
    key('keydown', 'KeyD') // keyup が来ないまま(リピートの印が落ちた場合)も無視
    expect(playerX(session)).toBe(2)
    expect(session.getSnapshot().state.stats.turns).toBe(1)
  })

  it('修飾キーつきや関係ないキーは無視する', () => {
    const { session } = setup(['@....'])
    key('keydown', 'KeyD', { metaKey: true })
    key('keydown', 'KeyD', { ctrlKey: true })
    key('keydown', 'KeyQ')
    expect(session.getSnapshot().state.stats.turns).toBe(0)
  })

  it('壁へ入力してもターンは進まない', () => {
    const { session } = setup(['@.'])
    key('keydown', 'KeyW')
    expect(session.getSnapshot().state.stats.turns).toBe(0)
    expect(session.getSnapshot().blockedSeq).toBe(1)
  })
})

describe('テスト18: スマートフォン向け方向ボタン', () => {
  const press = (label: string) => {
    const btn = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
    expect(btn).not.toBeNull()
    act(() => {
      btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    })
  }

  it('4方向のボタンがあり、タップで移動できる', () => {
    const { session } = setup(['@..', '...'])
    press('右へ移動')
    expect(session.getSnapshot().state.player.pos).toEqual({ x: 2, y: 1 })
    clock += ACTION_LOCK_MS
    press('下へ移動')
    expect(session.getSnapshot().state.player.pos).toEqual({ x: 2, y: 2 })
    clock += ACTION_LOCK_MS
    press('左へ移動')
    clock += ACTION_LOCK_MS
    press('上へ移動')
    expect(session.getSnapshot().state.player.pos).toEqual({ x: 1, y: 1 })
  })

  it('連打しても、ロック中の入力は無視される', () => {
    const { session } = setup(['@....'])
    for (let i = 0; i < 8; i++) press('右へ移動')
    expect(session.getSnapshot().state.stats.turns).toBe(1)
  })

  it('キーボードで押す(click, detail=0)ことでも操作できる', () => {
    const { session } = setup(['@..'])
    const btn = container.querySelector<HTMLButtonElement>('button[aria-label="右へ移動"]')!
    act(() => btn.click())
    expect(playerX(session)).toBe(2)
  })

  it('マウスのクリック(detail>0)では pointerdown と二重に動かない', () => {
    const { session } = setup(['@...'])
    const btn = container.querySelector<HTMLButtonElement>('button[aria-label="右へ移動"]')!
    act(() => {
      btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(session.getSnapshot().state.stats.turns).toBe(1)
  })
})

describe('表示', () => {
  it('HP・階層・ターン数・倒した敵の数・シードが常に見える', () => {
    setup(['@A'], { hp: 21 })
    const text = container.textContent ?? ''
    expect(text).toContain('第1階層')
    expect(text).toContain('21')
    expect(text).toContain('/30')
    expect(text).toContain('ターン')
    expect(text).toContain('倒した敵')
    expect(text).toContain('シード')
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('21')
  })

  it('敵の攻撃でHP表示が減り、ログに出る', () => {
    const { session } = setup(['@A'])
    key('keydown', 'KeyD') // 敵を攻撃 → 反撃
    expect(session.getSnapshot().state.player.hp).toBe(28)
    expect(container.querySelector('.hp-num')?.textContent).toContain('28')
    expect(container.querySelector('.log')?.textContent).toContain('ダメージ')
  })
})

describe('結果画面', () => {
  it('ゲームオーバー後、少しして結果画面が出て、再挑戦・タイトルが押せる', () => {
    vi.useFakeTimers()
    const { onRetry, onTitle } = setup(['A@.'], { hp: 1 })
    key('keydown', 'KeyA')
    expect(container.querySelector('.result')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    const result = container.querySelector('.result')!
    expect(result).not.toBeNull()
    expect(result.textContent).toContain('力尽きた')
    expect(result.textContent).toContain('到達階層')
    const buttons = [...result.querySelectorAll('button')]
    act(() => buttons.find((b) => b.textContent === '再挑戦')!.click())
    expect(onRetry).toHaveBeenCalledTimes(1)
    act(() => buttons.find((b) => b.textContent === 'タイトルへ戻る')!.click())
    expect(onTitle).toHaveBeenCalledTimes(1)
  })

  it('クリア画面に最終スコアと統計が出る', () => {
    vi.useFakeTimers()
    // 最終階層の状態から始める(第1階層の階段は第2階層へ進むだけなので)
    const session = new GameSession(1, {
      now: () => clock,
      saveResult: () => {},
      initialState: stateFromPicture(['@>'], { floor: 3 }),
    })
    act(() => {
      root.render(<GameView session={session} recordsBefore={emptyRecords()} onRetry={() => {}} onTitle={() => {}} />)
    })
    key('keydown', 'KeyD')
    act(() => {
      vi.advanceTimersByTime(1200)
    })
    const text = container.querySelector('.result')?.textContent ?? ''
    expect(text).toContain('ダンジョン踏破')
    expect(text).toContain('最終スコア')
    expect(text).toContain('合計ターン数')
    expect(text).toContain('受けたダメージ')
    expect(text).toContain('再挑戦')
  })
})
