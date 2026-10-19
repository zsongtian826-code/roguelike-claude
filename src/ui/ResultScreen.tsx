import { useEffect, useRef } from 'react'
import { playSfx } from '../audio/sound.ts'
import { TOTAL_FLOORS } from '../game/constants.ts'
import type { Records } from '../game/records.ts'
import { calcScore } from '../game/score.ts'
import type { GameState } from '../game/types.ts'

interface Props {
  state: GameState
  /** このプレイを始める前の記録(新記録の判定に使う) */
  recordsBefore: Records
  seedWasSpecified: boolean
  onRetry: () => void
  onTitle: () => void
}

export function ResultScreen({ state, recordsBefore, seedWasSpecified, onRetry, onTitle }: Props) {
  const cleared = state.status === 'clear'
  const { stats, player } = state
  const score = cleared ? calcScore(stats, player.hp) : 0
  const retryRef = useRef<HTMLButtonElement>(null)

  const newBestTurns = cleared && (recordsBefore.bestTurns === null || stats.turns < recordsBefore.bestTurns)
  const newBestScore = cleared && (recordsBefore.bestScore === null || score > recordsBefore.bestScore)

  useEffect(() => {
    retryRef.current?.focus()
  }, [])

  const rows: [string, string | number][] = [
    ['合計ターン数', stats.turns],
    ['移動回数', stats.moves],
    ['攻撃回数', stats.attacks],
    ['倒した敵の数', stats.kills],
    ['受けたダメージ', stats.damageTaken],
    ['回復したHP', stats.healed],
    ['到達階層', `第${state.floor}階層 / ${TOTAL_FLOORS}`],
    ['残りHP', `${Math.max(0, player.hp)} / ${player.maxHp}`],
  ]

  return (
    <div className={`result ${cleared ? 'result-clear' : 'result-over'}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
      {cleared && (
        <div className="embers" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              style={
                {
                  '--l': `${(i * 37) % 100}%`,
                  '--dl': `${(i % 7) * 0.45}s`,
                  '--du': `${3.2 + (i % 5) * 0.6}s`,
                  '--sz': `${4 + (i % 4) * 2}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="result-card">
        <p className="result-kicker">{cleared ? 'DUNGEON CLEARED' : 'GAME OVER'}</p>
        <h2 id="result-title" className="result-title">
          {cleared ? 'ダンジョン踏破!' : '力尽きた…'}
        </h2>
        <p className="result-sub">
          {cleared
            ? '灯は最深部まで届いた。迷宮は静かに道を開いた。'
            : `第${state.floor}階層で灯が消えた。もう一度、火を灯そう。`}
        </p>

        {cleared && (
          <div className="score">
            <span className="score-label">最終スコア</span>
            <span className="score-value">{score.toLocaleString('ja-JP')}</span>
            <span className="score-badges">
              {newBestScore && <b className="badge">ハイスコア更新!</b>}
              {newBestTurns && <b className="badge">最少ターン更新!</b>}
            </span>
          </div>
        )}

        <dl className="result-stats">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <p className="result-seed">シード: <b>{state.seed}</b></p>

        <div className="result-actions">
          <button
            ref={retryRef}
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (cleared) playSfx('ui')
              onRetry()
            }}
          >
            再挑戦
          </button>
          <button type="button" className="btn" onClick={onTitle}>
            タイトルへ戻る
          </button>
        </div>
        <p className="result-hint">
          {seedWasSpecified ? '再挑戦は同じシード(同じマップ)で始まります。' : '再挑戦は新しいシードで始まります。'}
        </p>
      </div>
    </div>
  )
}
