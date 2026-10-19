import type { EnemyKind } from '../game/types.ts'

/** キャラクターはすべてインラインSVG(画像ファイルなし)。32×32 の座標で描く。 */

export function PlayerSprite() {
  return (
    <svg viewBox="0 0 32 32" className="sprite" aria-hidden="true">
      <defs>
        <radialGradient id="lantern-glow">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="16" cy="28.5" rx="9" ry="2.4" fill="#000" opacity="0.4" />
      {/* 短剣 */}
      <path d="M6.2 23.5 L3.6 15.6" stroke="#dfe6f3" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4.6 23.2 L8 22.2" stroke="#8a6a3a" strokeWidth="1.6" strokeLinecap="round" />
      {/* マント */}
      <path d="M7.5 27.5 Q7 15 16 8.5 Q25 15 24.5 27.5 Q16 29.5 7.5 27.5Z" fill="#3f78b5" />
      <path d="M16 12 Q12 19 12.5 28 Q16 29 19.5 28 Q20 19 16 12Z" fill="#2f5f95" />
      {/* フード */}
      <path d="M9.5 15 Q9.5 5.5 16 5.5 Q22.5 5.5 22.5 15 Q22.5 19.5 16 19.5 Q9.5 19.5 9.5 15Z" fill="#2d5688" />
      <ellipse cx="16" cy="14.2" rx="5" ry="4.4" fill="#10131c" />
      <circle cx="14.2" cy="14" r="1.25" fill="#fff4c2" />
      <circle cx="17.8" cy="14" r="1.25" fill="#fff4c2" />
      {/* ランタン */}
      <circle className="lantern-light" cx="25.8" cy="21.5" r="8" fill="url(#lantern-glow)" />
      <path d="M25.8 16.2 v1.8" stroke="#6b4a1f" strokeWidth="1" />
      <rect x="23.4" y="18" width="4.8" height="6.6" rx="1.2" fill="#ffc15a" stroke="#6b4a1f" strokeWidth="1" />
      <rect x="24.6" y="19.4" width="2.4" height="3.6" rx="0.8" fill="#fff0b8" />
    </svg>
  )
}

export function EnemySprite({ kind }: { kind: EnemyKind }) {
  return kind === 'A' ? <SlimeSprite /> : <WardenSprite />
}

function SlimeSprite() {
  return (
    <svg viewBox="0 0 32 32" className="sprite" aria-hidden="true">
      <ellipse cx="16" cy="27.5" rx="10.5" ry="2.4" fill="#000" opacity="0.4" />
      <path d="M4.5 26 Q3.5 14 16 11.5 Q28.5 14 27.5 26 Q16 29 4.5 26Z" fill="#6fd25f" />
      <path d="M4.5 26 Q16 29 27.5 26 Q27.8 24.5 27.4 22.5 Q16 25.5 4.6 22.5 Q4.2 24.5 4.5 26Z" fill="#4eaa44" />
      <ellipse cx="11.5" cy="16.5" rx="3" ry="1.8" fill="#b8f5a8" opacity="0.7" transform="rotate(-25 11.5 16.5)" />
      <circle cx="12" cy="20" r="3" fill="#fff" />
      <circle cx="20.5" cy="20" r="3" fill="#fff" />
      <circle cx="12.6" cy="20.6" r="1.5" fill="#1b2a18" />
      <circle cx="21.1" cy="20.6" r="1.5" fill="#1b2a18" />
      <path d="M13.5 24.6 Q16.5 26.4 19.5 24.6" stroke="#25421f" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="8.5" cy="23" r="1" fill="#4eaa44" />
      <circle cx="24.5" cy="16.5" r="1.2" fill="#4eaa44" />
    </svg>
  )
}

function WardenSprite() {
  return (
    <svg viewBox="0 0 32 32" className="sprite" aria-hidden="true">
      <ellipse cx="16" cy="28.5" rx="11" ry="2.4" fill="#000" opacity="0.4" />
      {/* 角 */}
      <path d="M7.5 11 Q4 6.5 6 2.5 Q10 5 12 10Z" fill="#efe3c6" />
      <path d="M24.5 11 Q28 6.5 26 2.5 Q22 5 20 10Z" fill="#efe3c6" />
      {/* 体 */}
      <path d="M5 28 Q4 17 8 13 Q16 8.5 24 13 Q28 17 27 28 Q16 30 5 28Z" fill="#a8403f" />
      <path d="M5 28 Q16 30 27 28 Q27.2 25.5 26.8 23 Q16 26 5.2 23 Q4.8 25.5 5 28Z" fill="#7d2d33" />
      <path d="M8 15 Q16 10.5 24 15 Q16 13.5 8 15Z" fill="#c9605a" opacity="0.7" />
      {/* 目 */}
      <path d="M8.8 16.2 L14.2 18.2 L13.4 20.6 L8.6 19.2Z" fill="#ffd24a" />
      <path d="M23.2 16.2 L17.8 18.2 L18.6 20.6 L23.4 19.2Z" fill="#ffd24a" />
      <circle cx="11.6" cy="18.8" r="0.9" fill="#3a0f12" />
      <circle cx="20.4" cy="18.8" r="0.9" fill="#3a0f12" />
      {/* 牙 */}
      <path d="M10.5 22.8 Q16 24.8 21.5 22.8 L21 24 Q16 26 11 24Z" fill="#2c0d10" />
      <path d="M11.8 23.3 L12.8 26.2 L13.9 23.7Z" fill="#fff" />
      <path d="M18.1 23.7 L19.2 26.2 L20.2 23.3Z" fill="#fff" />
    </svg>
  )
}

export function PotionSprite() {
  return (
    <svg viewBox="0 0 32 32" className="sprite sprite-item" aria-hidden="true">
      <ellipse cx="16" cy="27" rx="7.5" ry="2" fill="#000" opacity="0.4" />
      <rect x="13" y="5" width="6" height="4" rx="1" fill="#b98a55" />
      <path d="M13.5 9 h5 v4 Q24 15.5 23.5 21.5 Q23 26.5 16 26.5 Q9 26.5 8.5 21.5 Q8 15.5 13.5 13Z" fill="#cfe9ef" opacity="0.55" />
      <path d="M9.2 19 Q16 16.5 22.8 19 Q23 22 22 23.8 Q16 26.5 10 23.8 Q9 22 9.2 19Z" fill="#4ade80" />
      <path d="M9.2 19 Q16 16.5 22.8 19" stroke="#b6f7cf" strokeWidth="1" fill="none" />
      <circle cx="13.2" cy="21.8" r="1" fill="#d9fbe6" />
      <circle cx="17.5" cy="22.6" r="0.7" fill="#d9fbe6" />
      <path d="M12 15 Q11 18 11.4 20" stroke="#fff" strokeWidth="1" opacity="0.7" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function StairsSprite({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={`sprite sprite-stairs ${open ? 'is-open' : 'is-locked'}`} aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="3" fill={open ? '#1a1206' : '#15121b'} />
      <rect x="3" y="3" width="26" height="26" rx="3" fill="none" stroke={open ? '#ffc15a' : '#4a4258'} strokeWidth="1.6" />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M${5 + i * 3} ${8 + i * 5} H${27} V${12.6 + i * 5} H${5 + i * 3}Z`}
          fill={open ? ['#ffe29a', '#ffc15a', '#d99a35', '#a8731f'][i] : ['#5d566c', '#4f4960', '#433e53', '#383446'][i]}
        />
      ))}
      {!open && (
        <g>
          <rect x="12" y="13" width="8" height="7" rx="1.2" fill="#8a8399" />
          <path d="M13.8 13 v-2.2 a2.2 2.2 0 0 1 4.4 0 V13" stroke="#8a8399" strokeWidth="1.5" fill="none" />
          <circle cx="16" cy="16.4" r="1" fill="#2a2535" />
        </g>
      )}
    </svg>
  )
}

export function LanternIcon({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="lantern-icon">
      <defs>
        <radialGradient id="lantern-big-glow">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffb547" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="38" r="30" fill="url(#lantern-big-glow)" />
      <path d="M32 4 v8" stroke="#8a6a3a" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 16 Q32 8 42 16" stroke="#6b4a1f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="20" y="16" width="24" height="5" rx="2" fill="#6b4a1f" />
      <rect x="22" y="21" width="20" height="26" rx="4" fill="#ffc15a" stroke="#6b4a1f" strokeWidth="2.5" />
      <rect x="27" y="26" width="10" height="16" rx="4" fill="#fff0b8" />
      <path d="M32 24 V44 M22 34 H42" stroke="#6b4a1f" strokeWidth="1.6" opacity="0.7" />
      <rect x="20" y="47" width="24" height="5" rx="2" fill="#6b4a1f" />
    </svg>
  )
}
