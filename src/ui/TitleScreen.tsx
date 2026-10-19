import { useState } from 'react'
import { playSfx } from '../audio/sound.ts'
import { parseSeedInput } from '../game/rng.ts'
import type { Records } from '../game/records.ts'
import { ENEMY_SPECS, POTION_HEAL, TOTAL_FLOORS } from '../game/constants.ts'
import { LanternIcon } from './sprites.tsx'

interface Props {
  records: Records
  initialSeedText: string
  onStart: (seed: number | null, seedText: string) => void
}

export function TitleScreen({ records, initialSeedText, onStart }: Props) {
  const [seedText, setSeedText] = useState(initialSeedText)
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const seed = parseSeedInput(seedText)
    if (seed === 'invalid') {
      setError('シードは 0〜4294967295 の整数で入力してください。')
      return
    }
    setError('')
    playSfx('ui')
    onStart(seed, seedText)
  }

  return (
    <main className="title">
      <div className="embers" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            style={
              {
                '--l': `${(i * 53 + 7) % 100}%`,
                '--dl': `${(i % 9) * 0.6}s`,
                '--du': `${5 + (i % 5) * 0.9}s`,
                '--sz': `${3 + (i % 3) * 2}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="title-inner">
        <header className="title-hero">
          <LanternIcon size={84} />
          <p className="title-en">LANTERN DEPTHS</p>
          <h1 className="title-name">ともしび迷宮</h1>
          <p className="title-tag">灯ひとつ携えて、全{TOTAL_FLOORS}階層の闇へ。</p>
        </header>

        <form className="panel start-panel" onSubmit={submit}>
          <button type="submit" className="btn btn-primary btn-big">
            冒険を始める
          </button>
          <div className="field">
            <label htmlFor="seed">シード(空欄でランダム)</label>
            <input
              id="seed"
              name="seed"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="例: 12345"
              value={seedText}
              onChange={(e) => {
                setSeedText(e.target.value)
                setError('')
              }}
              aria-invalid={error !== ''}
              aria-describedby="seed-help"
            />
            <p id="seed-help" className={error ? 'field-error' : 'field-help'} role={error ? 'alert' : undefined}>
              {error || '同じシードなら、同じダンジョンで遊べます。'}
            </p>
          </div>
        </form>

        <section className="panel">
          <h2 className="panel-title">遊び方</h2>
          <ul className="howto">
            <li>
              <b>移動</b>
              <span>
                <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> または矢印キー。スマホは画面の方向ボタン(盤面のスワイプも可)。1回で1マス、1ターン。
              </span>
            </li>
            <li>
              <b>戦闘</b>
              <span>敵のいるマスへ動くと攻撃(威力5)。敵はあなたの行動のあとに近づき、隣に来ると攻撃してきます。</span>
            </li>
            <li>
              <b>敵</b>
              <span>
                {ENEMY_SPECS.A.name}(HP{ENEMY_SPECS.A.hp}・攻撃{ENEMY_SPECS.A.atk})と{ENEMY_SPECS.B.name}(HP{ENEMY_SPECS.B.hp}・攻撃{ENEMY_SPECS.B.atk})。
              </span>
            </li>
            <li>
              <b>ポーション</b>
              <span>踏むと自動でHPが{POTION_HEAL}回復(最大HPまで)。各階層に1個。</span>
            </li>
            <li>
              <b>階段</b>
              <span>敵を全滅させると開きます。第{TOTAL_FLOORS}階層の階段でクリア。HPは次の階層へ持ち越し。</span>
            </li>
            <li>
              <b>ターン</b>
              <span>壁にぶつかる操作や、封じられた階段への移動はターンを消費しません。</span>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel-title">記録</h2>
          <div className="records-best">
            <div>
              <span className="records-label">最少クリアターン</span>
              <span className="records-value">{records.bestTurns ?? '—'}</span>
            </div>
            <div>
              <span className="records-label">最高スコア</span>
              <span className="records-value">{records.bestScore?.toLocaleString('ja-JP') ?? '—'}</span>
            </div>
          </div>
          <h3 className="records-sub">直近の結果</h3>
          {records.recent.length === 0 ? (
            <p className="field-help">まだ記録がありません。</p>
          ) : (
            <ol className="records-list">
              {records.recent.map((r) => (
                <li key={r.finishedAt} className={r.outcome === 'clear' ? 'is-clear' : 'is-over'}>
                  <b>{r.outcome === 'clear' ? 'クリア' : '敗北'}</b>
                  <span>第{r.floor}階層</span>
                  <span>{r.turns}ターン</span>
                  <span>{r.outcome === 'clear' ? `${r.score.toLocaleString('ja-JP')}点` : `撃破${r.kills}`}</span>
                  <button type="button" className="seed-link" onClick={() => setSeedText(String(r.seed))} title="このシードを入力欄に入れる">
                    シード {r.seed}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  )
}
