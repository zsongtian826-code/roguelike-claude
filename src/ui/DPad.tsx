import type { Dir } from '../game/types.ts'

const BUTTONS: { dir: Dir; label: string; glyph: string; area: string }[] = [
  { dir: 'up', label: '上へ移動', glyph: '▲', area: 'up' },
  { dir: 'left', label: '左へ移動', glyph: '◀', area: 'left' },
  { dir: 'right', label: '右へ移動', glyph: '▶', area: 'right' },
  { dir: 'down', label: '下へ移動', glyph: '▼', area: 'down' },
]

/**
 * スマートフォン用の方向ボタン(PCでも使える)。
 * タッチで即座に反応するよう pointerdown で受け、長押しでは連続入力しない。
 * キーボード(Enter/Space)で押した場合だけ click で受ける。
 */
export function DPad({ onMove }: { onMove: (dir: Dir) => void }) {
  return (
    <div className="dpad" role="group" aria-label="方向ボタン">
      {BUTTONS.map((b) => (
        <button
          key={b.dir}
          type="button"
          className="dpad-btn"
          style={{ gridArea: b.area }}
          aria-label={b.label}
          onPointerDown={(e) => {
            e.preventDefault()
            onMove(b.dir)
          }}
          onClick={(e) => {
            if (e.detail === 0) onMove(b.dir)
          }}
        >
          <span aria-hidden="true">{b.glyph}</span>
        </button>
      ))}
      <div className="dpad-center" aria-hidden="true" />
    </div>
  )
}
