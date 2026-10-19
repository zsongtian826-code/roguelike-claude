import { useState } from 'react'
import { loadRecords } from './game/records.ts'
import type { Records } from './game/records.ts'
import { GameSession } from './game/session.ts'
import { GameView } from './ui/GameView.tsx'
import { TitleScreen } from './ui/TitleScreen.tsx'

interface Run {
  /** 再挑戦のたびに変わる。GameView の状態を丸ごと作り直すために key にする。 */
  id: number
  session: GameSession
  recordsBefore: Records
}

export default function App() {
  const [run, setRun] = useState<Run | null>(null)
  const [records, setRecords] = useState<Records>(() => loadRecords())
  const [seedText, setSeedText] = useState('')

  const start = (seed: number | null) => {
    const recordsBefore = loadRecords()
    setRun((prev) => ({ id: (prev?.id ?? 0) + 1, session: new GameSession(seed), recordsBefore }))
  }

  const toTitle = () => {
    setRecords(loadRecords())
    setRun(null)
  }

  if (!run) {
    return (
      <TitleScreen
        records={records}
        initialSeedText={seedText}
        onStart={(seed, text) => {
          setSeedText(text)
          start(seed)
        }}
      />
    )
  }

  return (
    <GameView
      key={run.id}
      session={run.session}
      recordsBefore={run.recordsBefore}
      // シードを指定していたら同じマップで、していなければ新しいシードで再挑戦
      onRetry={() => start(run.session.seedWasSpecified ? run.session.seed : null)}
      onTitle={toTitle}
    />
  )
}
