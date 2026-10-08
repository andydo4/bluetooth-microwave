import { useEffect, useRef, useState } from 'react'
import Scene from './components/Scene'
import ControlPanel, { MiniDisplay } from './components/ControlPanel'
import * as sound from './audio/engine'

export type Status = 'idle' | 'loading' | 'playing'
/** What to play: a pasted YouTube link, or one of the panel's preset buttons. */
export type Source = { url: string } | { preset: string }
/** DO NOT PRESS: arcing sparks → fire → exploded (until you buy a new one). */
export type Wreck = 'none' | 'arcing' | 'fire' | 'exploded'

// Phones get the microwave full-screen and the control panel in a slide-up sheet; on its face it'd be too small to tap.
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
  const [wreck, setWreck] = useState<Wreck>('none')
  const [canBuyNew, setCanBuyNew] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false) // phones: is the control panel slid up?
  // Ends the current run (song finished, STOP pressed, or an error). Set by start().
  // quiet: no power-down sound (the explosion makes its own).
  const finishRef = useRef<((message?: string, quiet?: boolean) => void) | null>(null)

  async function start(source: Source) {
    if (status !== 'idle' || wreck !== 'none') return
    setError('')
    sound.powerOn()
    setStatus('loading')

    const abort = new AbortController()
    let song: sound.Song | null = null
    let finished = false
    const finish = (message = '', quiet = false) => {
      if (finished) return
      finished = true
      finishRef.current = null
      abort.abort()
      song?.stop()
      if (!quiet) sound.powerOff()
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

  function overload() {
    if (wreck !== 'none') return
    sound.startOverload()
    setWreck('arcing')
    setTimeout(() => setWreck('fire'), sound.OVERLOAD_FIRE_AT * 1000)
    setTimeout(() => {
      finishRef.current?.('', true)
      sound.explode()
      setWreck('exploded')
      setTimeout(() => setCanBuyNew(true), 2500)
    }, sound.OVERLOAD_BOOM_AT * 1000)
  }

  function buyNew() {
    setCanBuyNew(false)
    sound.resetAfterExplosion()
    setWreck('none')
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
      wreck={wreck}
      // On phones, starting something closes the sheet so you watch the microwave.
      onStart={(source) => {
        setSheetOpen(false)
        start(source)
      }}
      onStop={stop}
      onPower={changePower}
      onOverload={() => {
        setSheetOpen(false)
        overload()
      }}
    />
  )
  const on = status !== 'idle' || wreck === 'arcing' || wreck === 'fire'
  const buyButton = canBuyNew && (
    <button
      onClick={buyNew}
      className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 animate-bounce rounded-full bg-zinc-100 px-6 py-3 text-sm font-extrabold tracking-wide text-zinc-900 shadow-[0_4px_0_#71717a]"
    >
      Buy new microwave
    </button>
  )

  if (phone) {
    return (
      <main className="relative h-svh w-screen overflow-hidden">
        <Scene on={on} wreck={wreck} panel={null} />
        {buyButton}

        {/* Collapsed: a small bar with the LED readout. Tap to slide the controls up. */}
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 touch-manipulation items-center gap-3 rounded-full border border-black/60 bg-[#141418]/95 py-2 pl-4 pr-3 shadow-[0_4px_16px_#000a]"
        >
          <span className="flex h-8 min-w-[92px] items-center justify-end rounded-sm bg-[#071108] px-2">
            <MiniDisplay status={status} endsAt={endsAt} error={error} wreck={wreck} />
          </span>
          <span className="whitespace-nowrap text-[11px] font-bold tracking-[0.15em] text-zinc-300">CONTROLS ▲</span>
        </button>

        {/* Tapping the scene behind the open sheet closes it. */}
        {sheetOpen && <div className="absolute inset-0 z-20 bg-black/40" onClick={() => setSheetOpen(false)} />}
        <div
          className={`absolute inset-x-0 bottom-0 z-30 max-h-[85svh] overflow-y-auto rounded-t-2xl bg-[#0d0d10] px-4 pb-6 pt-2 shadow-[0_-8px_24px_#000c] transition-transform duration-300 ${
            sheetOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full'
          }`}
        >
          <button
            onClick={() => setSheetOpen(false)}
            aria-label="Hide controls"
            className="mx-auto mb-2 flex h-6 w-full touch-manipulation items-center justify-center"
          >
            <span className="h-1.5 w-12 rounded-full bg-zinc-600" />
          </button>
          <div className="@container mx-auto max-w-[440px]">{panel}</div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative h-svh w-screen">
      <Scene on={on} wreck={wreck} panel={panel} />
      {buyButton}
    </main>
  )
}
