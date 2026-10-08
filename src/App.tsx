import { useRef, useState } from 'react'
import Scene from './components/Scene'
import ControlPanel from './components/ControlPanel'
import * as sound from './audio/engine'

export type Status = 'idle' | 'loading' | 'playing'

export default function App() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [endsAt, setEndsAt] = useState(0)
  // Ends the current run (song finished, STOP pressed, or an error). Set by start().
  const finishRef = useRef<((message?: string) => void) | null>(null)

  async function start(url: string) {
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
        body: JSON.stringify({ url }),
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

  return (
    <main className="h-screen w-screen">
      <Scene
        on={status !== 'idle'}
        panel={<ControlPanel status={status} endsAt={endsAt} error={error} onStart={start} onStop={stop} />}
      />
    </main>
  )
}
