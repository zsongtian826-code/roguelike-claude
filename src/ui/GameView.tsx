import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { playSfx } from '../audio/sound.ts'
import { ENEMY_SPECS, FLOOR_NAMES, POTION_HEAL } from '../game/constants.ts'
import type { GameSession } from '../game/session.ts'
import type { Records } from '../game/records.ts'
import type { Dir } from '../game/types.ts'
import { Board } from './Board.tsx'
import { DPad } from './DPad.tsx'
import { Hud } from './Hud.tsx'
import { ResultScreen } from './ResultScreen.tsx'
import { EnemySprite, PlayerSprite, PotionSprite, StairsSprite } from './sprites.tsx'
import { useFx } from './useFx.ts'

const KEY_TO_DIR: Record<string, Dir> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyD: 'right',
  ArrowRight: 'right',
}

const SWIPE_MIN_PX = 28

interface Props {
  session: GameSession
  recordsBefore: Records
  onRetry: () => void
  onTitle: () => void
}

export function GameView({ session, recordsBefore, onRetry, onTitle }: Props) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const fx = useFx(snapshot)
  const { state } = snapshot
  const [showResult, setShowResult] = useState(false)

  const move = useCallback(
    (dir: Dir) => {
      session.input(dir)
    },
    [session],
  )

  // キーボード: WASD と矢印キー。長押し(リピート)では進まない。
  useEffect(() => {
    const held = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.code]
      if (!dir || e.ctrlKey || e.metaKey || e.altKey) return
      e.preventDefault()
      if (e.repeat || held.has(e.code)) return
      held.add(e.code)
      move(dir)
    }
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.code)
    const onBlur = () => held.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [move])

  // 終了後、少し演出を見せてから結果画面へ
  useEffect(() => {
    if (state.status === 'playing') return
    const t = window.setTimeout(() => setShowResult(true), state.status === 'clear' ? 1000 : 1400)
    return () => window.clearTimeout(t)
  }, [state.status])

  // スワイプ操作(盤面を指でなぞる)
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null)
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    setSwipeStart({ x: e.clientX, y: e.clientY })
  }
  const onStagePointerUp = (e: React.PointerEvent) => {
    if (!swipeStart) return
    const dx = e.clientX - swipeStart.x
    const dy = e.clientY - swipeStart.y
    setSwipeStart(null)
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const floorName = FLOOR_NAMES[state.floor - 1]

  return (
    <main className="game">
      <Hud state={state} onQuit={onTitle} />

      <section
        className="stage"
        onPointerDown={onStagePointerDown}
        onPointerUp={onStagePointerUp}
        onPointerCancel={() => setSwipeStart(null)}
      >
        <Board snapshot={snapshot} fx={fx} />
        <div key={snapshot.descendSeq} className="floor-banner" aria-hidden="true">
          <div className="floor-banner-inner">
            <span className="floor-banner-num">第{state.floor}階層</span>
            <span className="floor-banner-name">{floorName}</span>
          </div>
        </div>
      </section>

      <aside className="side">
        <ol className="log" aria-label="戦闘ログ">
          {[...fx.logs].reverse().slice(0, 8).map((l) => (
            <li key={l.id} className={`log-${l.tone}`}>
              {l.text}
            </li>
          ))}
        </ol>
        <DPad onMove={move} />
        <div className="guide">
          <p className="guide-keys">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> / <kbd>↑</kbd>
            <kbd>←</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd> で移動。敵に向かって動くと攻撃。
          </p>
          <ul className="legend">
            <li>
              <span className="legend-icon"><PlayerSprite /></span>
              <span>あなた(灯守)<small>攻撃5</small></span>
            </li>
            <li>
              <span className="legend-icon"><EnemySprite kind="A" /></span>
              <span>{ENEMY_SPECS.A.name}<small>HP{ENEMY_SPECS.A.hp} 攻撃{ENEMY_SPECS.A.atk}</small></span>
            </li>
            <li>
              <span className="legend-icon"><EnemySprite kind="B" /></span>
              <span>{ENEMY_SPECS.B.name}<small>HP{ENEMY_SPECS.B.hp} 攻撃{ENEMY_SPECS.B.atk}</small></span>
            </li>
            <li>
              <span className="legend-icon"><PotionSprite /></span>
              <span>ポーション<small>HP+{POTION_HEAL}</small></span>
            </li>
            <li>
              <span className="legend-icon"><StairsSprite open /></span>
              <span>階段<small>敵を全滅で開く</small></span>
            </li>
          </ul>
        </div>
      </aside>

      {showResult && state.status !== 'playing' && (
        <ResultScreen
          state={state}
          recordsBefore={recordsBefore}
          seedWasSpecified={session.seedWasSpecified}
          onRetry={() => {
            playSfx('ui')
            onRetry()
          }}
          onTitle={onTitle}
        />
      )}
    </main>
  )
}
