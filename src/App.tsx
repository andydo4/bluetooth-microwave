import { useEffect, useRef, useState } from 'react'
import Scene, { ZOOM_IN_SECONDS, ZOOM_OUT_SECONDS } from './components/Scene'
import * as sound from './audio/engine'
import { LEVELS, nextLevel } from './levels'
import type { Source, Status, Transition, Wreck } from './levels/types'
import { MiniDisplay } from './levels/shared/led'
import { LevelBadge, LevelPicker, Receipt } from './ui/Progress'

// Phones get the machine full-screen and the controls in a slide-up sheet; on its face they'd be too small to tap.
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

// Progress is saved in this browser. Storage can be missing or blocked (private mode), so never rely on it.
function load(key: string, fallback: number) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : Number(value)
  } catch {
    return fallback
  }
}
function save(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // progress just won't persist
  }
}
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))

export default function App() {
  const phone = useIsPhone()
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [endsAt, setEndsAt] = useState(0)
  const [power, setPower] = useState(10)
  const [wreck, setWreck] = useState<Wreck>('none')
  const [showReceipt, setShowReceipt] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false) // phones: is the control panel slid up?
  const [pickerOpen, setPickerOpen] = useState(false)
  const [transition, setTransition] = useState<Transition>('idle')

  // Progression: current level, how many levels are unlocked, running total of damages.
  const [levelIndex, setLevelIndex] = useState(() => clamp(load('bm.level', 0), 0, LEVELS.length - 1))
  const [unlocked, setUnlocked] = useState(() => clamp(load('bm.unlocked', 1), 1, LEVELS.length))
  const [damages, setDamages] = useState(() => load('bm.damages', 0) || 0)
  const level = LEVELS[levelIndex]
  const next = nextLevel(levelIndex)
  useEffect(() => save('bm.level', levelIndex), [levelIndex])
  useEffect(() => save('bm.unlocked', unlocked), [unlocked])
  useEffect(() => save('bm.damages', damages), [damages])
  useEffect(() => sound.setLevelSound(level.sound), [level])

  // Ends the current run (song finished, STOP pressed, an error, or leaving the level). Set by start().
  // quiet: no power-down sound (the machine is wrecked, or we're switching level).
  const finishRef = useRef<((message?: string, quiet?: boolean) => void) | null>(null)
  const wreckRef = useRef(wreck)
  wreckRef.current = wreck

  async function start(source: Source) {
    if (status !== 'idle' || wreck !== 'none' || transition !== 'idle') return
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
      // After an explosion the song plays on from the surviving speaker; no machine left to power off.
      if (!quiet && wreckRef.current !== 'exploded') sound.powerOff()
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
    if (wreck !== 'none' || transition !== 'idle') return
    const bill = level.bill
    sound.startOverload()
    setWreck('overloading')
    setTimeout(() => setWreck('critical'), sound.OVERLOAD_CRITICAL_AT * 1000)
    setTimeout(() => {
      // The speaker survives: a playing song carries on, un-muffled (see sound.explode).
      sound.explode()
      setWreck('exploded')
      setUnlocked((u) => Math.max(u, Math.min(levelIndex + 2, LEVELS.length)))
      setDamages((d) => d + bill)
      setTimeout(() => setShowReceipt(true), 2500)
    }, sound.OVERLOAD_BOOM_AT * 1000)
  }

  /** Same level again: a new one drops in. */
  function buyNew() {
    finishRef.current?.('', true)
    setShowReceipt(false)
    sound.resetAfterExplosion()
    setWreck('none')
  }

  /** Another level (Upgrade, or the picker): pull the camera out, swap levels, zoom in on the new one. */
  function goToLevel(index: number) {
    setPickerOpen(false)
    if (index === levelIndex) {
      if (wreck === 'exploded') buyNew()
      return
    }
    finishRef.current?.('', true)
    setShowReceipt(false)
    setSheetOpen(false)
    setTransition('out')
    setTimeout(() => {
      setLevelIndex(index)
      sound.setLevelSound(LEVELS[index].sound)
      sound.resetAfterExplosion()
      setWreck('none')
      setError('')
      setTransition('in')
      setTimeout(() => setTransition('idle'), ZOOM_IN_SECONDS * 1000)
    }, ZOOM_OUT_SECONDS * 1000)
  }

  function changePower(n: number) {
    setPower(n)
    sound.setPowerLevel(n)
  }

  const { Controls } = level
  const panel = (
    <Controls
      status={status}
      endsAt={endsAt}
      error={error}
      power={power}
      wreck={wreck}
      // On phones, starting something closes the sheet so you watch the machine.
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
  const on = status !== 'idle' || wreck === 'overloading' || wreck === 'critical'
  const busy = wreck === 'overloading' || wreck === 'critical' || transition !== 'idle'

  const overlays = (
    <>
      <LevelBadge index={levelIndex} level={level} disabled={busy} onOpen={() => setPickerOpen(true)} />
      {showReceipt && (
        <Receipt
          level={level}
          total={damages}
          next={next === null ? null : LEVELS[next]}
          onBuyNew={buyNew}
          onUpgrade={() => next !== null && goToLevel(next)}
        />
      )}
      {pickerOpen && (
        <LevelPicker levels={LEVELS} current={levelIndex} unlocked={unlocked} onPick={goToLevel} onClose={() => setPickerOpen(false)} />
      )}
      {/* Level change: fade to dark at the end of the pull-out, back in as the new level arrives. */}
      <div
        className={`pointer-events-none absolute inset-0 z-50 bg-[#0d0d10] transition-opacity ${
          transition === 'out' ? 'opacity-100 delay-700 duration-500' : 'opacity-0 duration-700'
        }`}
      />
    </>
  )

  if (phone) {
    return (
      <main className="relative h-svh w-screen overflow-hidden">
        <Scene level={level} on={on} wreck={wreck} transition={transition} panel={null} />
        {overlays}

        {/* Collapsed: a small bar with the LED readout. Tap to slide the controls up. */}
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 touch-manipulation items-center gap-3 rounded-full border border-black/60 bg-[#141418]/95 py-2 pl-4 pr-3 shadow-[0_4px_16px_#000a]"
        >
          <span className="flex h-8 min-w-[92px] items-center justify-end rounded-sm bg-[#071108] px-2">
            <MiniDisplay status={status} endsAt={endsAt} error={error} wreck={wreck} wreckLabels={level.wreckLabels} />
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
      <Scene level={level} on={on} wreck={wreck} transition={transition} panel={panel} />
      {overlays}
    </main>
  )
}
