import type { CSSProperties } from 'react'
import { ENEMY_SPECS } from '../game/constants.ts'
import type { Snapshot } from '../game/session.ts'
import type { Pos } from '../game/types.ts'
import { EnemySprite, PlayerSprite, PotionSprite, StairsSprite } from './sprites.tsx'
import type { FxState } from './useFx.ts'

const vars = (v: Record<string, string | number>): CSSProperties => v as CSSProperties

const at = (p: Pos): CSSProperties => vars({ '--x': p.x, '--y': p.y })

const BURST_COUNT: Record<string, number> = { kill: 12, hit: 6, heal: 8 }

interface Props {
  snapshot: Snapshot
  fx: FxState
}

/** 11×11 のマップ。位置は CSS 変数 --x/--y で指定し、動きは CSS の transition に任せる。 */
export function Board({ snapshot, fx }: Props) {
  const { state } = snapshot
  const { grid, player, enemies, stairs, potion } = state
  const dead = state.status === 'gameover'
  const stairsOpen = enemies.length === 0
  const wallAt = (x: number, y: number) => grid[y]?.[x] === 'wall'

  const playerLunge = fx.lunges.player
  const boardAnim = fx.hurtSeq > 0 ? `shake-${fx.hurtSeq % 2}` : ''

  return (
    <div
      className={`board ${boardAnim} ${state.status === 'playing' && player.hp <= 8 ? 'board-lowhp' : ''}`}
      style={vars({ '--px': player.pos.x, '--py': player.pos.y })}
      role="img"
      aria-label={`第${state.floor}階層のマップ。プレイヤーの位置は${player.pos.x}列${player.pos.y}行。敵は残り${enemies.length}体。`}
    >
      <div className="tiles">
        {grid.map((row, y) =>
          row.map((tile, x) =>
            tile === 'wall' ? (
              <div key={`${x},${y}`} className="tile wall" />
            ) : (
              <div
                key={`${x},${y}`}
                className={`tile floor ${(x + y) % 2 === 0 ? 'floor-a' : 'floor-b'} ${wallAt(x, y - 1) ? 'under-wall' : ''}`}
              />
            ),
          ),
        )}
      </div>

      <div className={`ent ent-static ${fx.lockedSeq > 0 ? `locked-shake-${fx.lockedSeq % 2}` : ''}`} style={at(stairs)}>
        <StairsSprite open={stairsOpen} />
      </div>

      {potion && (
        <div className="ent ent-static" style={at(potion)}>
          <PotionSprite />
        </div>
      )}

      {fx.ghosts.map((g) => (
        <div key={`ghost-${g.id}`} className="ent ent-static ghost" style={at(g.pos)}>
          <EnemySprite kind={g.kind} />
        </div>
      ))}

      {enemies.map((e, i) => {
        const lunge = fx.lunges[String(e.id)]
        return (
          <div
            key={e.id}
            className={`ent enemy enemy-${e.kind}`}
            style={{ ...at(e.pos), ...vars({ '--i': i + 1 }) }}
            role="img"
            aria-label={`${ENEMY_SPECS[e.kind].name} HP${e.hp}/${e.maxHp}`}
          >
            <div
              className={`lunge ${lunge ? `lunge-${lunge.n % 2}` : ''}`}
              style={lunge ? vars({ '--dx': lunge.dx, '--dy': lunge.dy }) : undefined}
            >
              <div className="bob">
                <EnemySprite kind={e.kind} />
              </div>
            </div>
            <div className="enemy-hp" aria-hidden="true">
              <div className="enemy-hp-fill" style={{ width: `${(e.hp / e.maxHp) * 100}%` }} />
            </div>
          </div>
        )
      })}

      <div className={`ent player ${dead ? 'player-dead' : ''}`} style={at(player.pos)} aria-label="プレイヤー">
        <div className={`bumper ${fx.bumpSeq > 0 && fx.bumpDir ? `bump-${fx.bumpDir} bump-${fx.bumpSeq % 2}` : ''}`}>
          <div className={`hurter ${fx.hurtSeq > 0 ? `hurt-${fx.hurtSeq % 2}` : ''}`}>
            <div
              className={`lunge ${playerLunge ? `lunge-${playerLunge.n % 2}` : ''}`}
              style={playerLunge ? vars({ '--dx': playerLunge.dx, '--dy': playerLunge.dy }) : undefined}
            >
              <div className="bob">
                <PlayerSprite />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ランタンの明かり: プレイヤーの周りだけ明るく、遠くは少し暗くする */}
      <div className="light" aria-hidden="true" />

      {fx.bursts.map((b) => {
        const count = BURST_COUNT[b.kind] ?? 6
        return (
          <div key={`burst-${b.id}`} className={`burst burst-${b.kind}`} style={at(b.pos)} aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <span
                key={i}
                style={vars({
                  '--a': `${(360 / count) * i + (i % 2) * 11}deg`,
                  '--d': 0.55 + (i % 3) * 0.22,
                  '--s': 0.16 + (i % 2) * 0.08,
                })}
              />
            ))}
          </div>
        )
      })}

      {fx.popups.map((p) => (
        <div key={`popup-${p.id}`} className={`popup popup-${p.kind}`} style={at(p.pos)} aria-hidden="true">
          <span>{p.text}</span>
        </div>
      ))}

      {fx.hurtSeq > 0 && <div key={`flash-${fx.hurtSeq}`} className="hurt-flash" aria-hidden="true" />}
      <div className="board-frame" aria-hidden="true" />
      {state.status === 'playing' && player.hp <= 8 && <div className="lowhp-vignette" aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">
        {fx.logs.at(-1)?.text}
      </span>
    </div>
  )
}
