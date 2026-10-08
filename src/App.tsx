import { useEffect, useRef, useState } from 'react'
import Scene from './components/Scene'
import ControlPanel from './components/ControlPanel'
import * as sound from './audio/engine'

export type Status = 'idle' | 'loading' | 'playing'
/** What to play: a pasted YouTube link, or one of the panel's preset buttons. */
export type Source = { url: string } | { preset: string }

// Phones get the microwave on top and a full-size control panel underneath; on its face it'd be too small to tap.
const PHONE_QUERY = '(max-width: 700px)'
function useIsPhone() {
  const [phone, setPhone] = useState(() => matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const query = matchMedia(PHONE_QUERY)
    const update = () => setPhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}

export default function App() {
  const phone = useIsPhone()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [endsAt, setEndsAt] = useState(0)
  const [power, setPower] = useState(10)
  // Ends the current run (song finished, STOP pressed, or an error). Set by start().
  const finishRef = useRef<((message?: string) => void) | null>(null)

  async function start(source: Source) {
    if (status !== 'idle') return
    setError('')
    sound.powerOn()
    setStatus('loading')

    const abort = new AbortController()
    let song: sound.Song | null = null
    let finished = false
    const finish = (message = '') => {
      if (finished) return
      finished = true
      finishRef.current = null
      abort.abort()
      song?.stop()
      sound.powerOff()
      setStatus('idle')
      setError(message)
    }
    finishRef.current = finish

    try {
      // Resolves once audio starts flowing from YouTube, not when the whole song has downloaded.
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
        signal: abort.signal,
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'Something went wrong.')

      song = sound.play(`/api/audio/${body.id}`, () => finish())
      await song.playing
      if (finished) return
      setEndsAt(Date.now() + body.duration * 1000)
      setStatus('playing')
    } catch (e) {
      // Ignored if STOP already finished this run.
      finish(e instanceof Error ? e.message : String(e))
    }
  }

  function stop() {
    finishRef.current?.()
  }

  function changePower(level: number) {
    setPower(level)
    sound.setPowerLevel(level)
  }

  const panel = (
    <ControlPanel
      status={status}
      endsAt={endsAt}
      error={error}
      power={power}
      onStart={start}
      onStop={stop}
      onPower={changePower}
    />
  )

  if (phone) {
    return (
      <main className="flex min-h-svh flex-col">
        <div className="h-[38svh] min-h-[220px] shrink-0">
          <Scene on={status !== 'idle'} panel={null} />
        </div>
        <div className="@container mx-auto w-full max-w-[440px] px-4 pb-6">{panel}</div>
      </main>
    )
  }

  return (
    <main className="h-svh w-screen">
      <Scene on={status !== 'idle'} panel={panel} />
    </main>
  )
}
