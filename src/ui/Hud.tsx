import { useState } from 'react'
import { isMuted, playSfx, setMuted } from '../audio/sound.ts'
import { FLOOR_NAMES, FLOOR_ENEMIES, TOTAL_FLOORS } from '../game/constants.ts'
import type { GameState } from '../game/types.ts'

const TOTAL_ENEMIES = FLOOR_ENEMIES.reduce((sum, f) => sum + f.length, 0)

export function Hud({ state, onQuit }: { state: GameState; onQuit: () => void }) {
  const { player, floor, stats } = state
  const ratio = Math.max(0, player.hp) / player.maxHp
  const tone = ratio <= 0.3 ? 'low' : ratio <= 0.6 ? 'mid' : 'high'
  const [muted, setMutedState] = useState(isMuted())
  const [confirming, setConfirming] = useState(false)

  return (
    <header className="hud">
      <div className="hud-top">
        <div className="hud-floor">
          <span className="hud-floor-num">
            第{floor}階層<small> / 全{TOTAL_FLOORS}</small>
          </span>
          <span className="hud-floor-name">{FLOOR_NAMES[floor - 1]}</span>
        </div>
        <div className="hud-buttons">
          <button
            type="button"
            className="chip"
            aria-pressed={!muted}
            onClick={() => {
              const next = !muted
              setMuted(next)
              setMutedState(next)
              if (!next) playSfx('ui')
            }}
          >
            音 {muted ? 'OFF' : 'ON'}
          </button>
          {confirming ? (
            <button
              type="button"
              className="chip chip-danger"
              onClick={onQuit}
              onBlur={() => setConfirming(false)}
              autoFocus
            >
              本当にやめる?
            </button>
          ) : (
            <button type="button" className="chip" onClick={() => setConfirming(true)}>
              やめる
            </button>
          )}
        </div>
      </div>

      <div className="hp" data-tone={tone}>
        <span className="hp-label">HP</span>
        <div
          className="hp-bar"
          role="progressbar"
          aria-label="HP"
          aria-valuemin={0}
          aria-valuemax={player.maxHp}
          aria-valuenow={Math.max(0, player.hp)}
        >
          <div className="hp-trail" style={{ width: `${ratio * 100}%` }} />
          <div className="hp-fill" style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="hp-num">
          {Math.max(0, player.hp)}
          <small>/{player.maxHp}</small>
        </span>
      </div>

      <dl className="hud-stats">
        <div>
          <dt>ターン</dt>
          <dd>{stats.turns}</dd>
        </div>
        <div>
          <dt>倒した敵</dt>
          <dd>
            {stats.kills}
            <small>/{TOTAL_ENEMIES}</small>
          </dd>
        </div>
        <div>
          <dt>シード</dt>
          <dd className="hud-seed">{state.seed}</dd>
        </div>
      </dl>
    </header>
  )
}
