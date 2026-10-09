// The elevator's themed controls: a brushed-brass button plate. Floor readout (LED), four round lit
// floor buttons (the presets), door OPEN/CLOSE (power: open doors = less muffled), a red ALARM bell,
// the link slot, START/STOP and DO NOT PRESS. One column everywhere; on desktop it fills the plate on
// the lobby wall (500 × 720 px, scaled down in 3D, hence the bigger sizes from 480px up).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ControlsProps, PresetKey } from '../types'
import { keyBeep } from '../../audio/engine'
import { DoNotPress, displayText, isPulsing, useTick } from '../shared/led'
import { WRECK_LABELS } from './labels'
import { ringAlarm } from './sound'
import { lift } from './signals'

// Floors, as the presets. On the plate they're a 2×2 grid with the top floors on top, like a real lift.
const FLOORS: { key: PresetKey; label: string; code: string; order: string }[] = [
  { key: 'popcorn', label: 'LOBBY', code: 'L', order: '@min-[480px]:order-3' },
  { key: 'defrost', label: 'MEZZ', code: 'M', order: '@min-[480px]:order-4' },
  { key: 'reheat', label: 'SKY', code: 'S', order: '@min-[480px]:order-1' },
  { key: 'beverage', label: 'PENTHOUSE', code: 'PH', order: '@min-[480px]:order-2' },
]

// Door buttons set the power level: doors held open let the music out (less muffled).
const OPEN = { power: 4, flash: 'OPEN' }
const CLOSE = { power: 10, flash: 'CLOSE' }

// Text engraved into brass: dark fill with a light lower edge.
const engraved = 'font-extrabold tracking-[0.18em] text-[#3d2c0b] [text-shadow:0_1px_0_#f6e3a6]'

// A round brushed-steel button face; `lit` gives it the amber halo of a called floor.
const roundKey = (lit: boolean) =>
  'flex items-center justify-center rounded-full border-[3px] bg-[radial-gradient(circle_at_35%_30%,#ffffff,#cfd3d8_55%,#8f959c)] ' +
  'transition-shadow group-active:translate-y-px group-active:shadow-none ' +
  (lit
    ? 'border-[#ffb347] text-[#c2410c] shadow-[0_0_0_3px_#ffb34766,0_0_18px_#ffb347,0_3px_0_#5c4613]'
    : 'border-[#8a6a28] text-zinc-600 shadow-[0_3px_0_#5c4613,0_5px_8px_#0005]')

function Arrows({ dir }: { dir: 'open' | 'close' }) {
  // ◀▶ / ▶◀ drawn as SVG (the Unicode triangles turn into emoji on some phones).
  const left = 'M7 2 L1 8 L7 14 Z'
  const right = 'M1 2 L7 8 L1 14 Z'
  return (
    <svg viewBox="0 0 18 16" className="h-[40%] w-[46%] fill-current" aria-hidden>
      <path d={dir === 'open' ? left : right} />
      <path d={dir === 'open' ? right : left} transform="translate(10 0)" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[42%] w-[42%] fill-current" aria-hidden>
      <path d="M8 1.5a1 1 0 0 1 1 1v.6a4.5 4.5 0 0 1 3.5 4.4v3l1.3 1.6v.9H2.2v-.9L3.5 10.5v-3A4.5 4.5 0 0 1 7 3.1v-.6a1 1 0 0 1 1-1zM6.3 14h3.4a1.7 1.7 0 0 1-3.4 0z" />
    </svg>
  )
}

function KeyWithLabel({ label, onClick, disabled, className, face }: { label: string; onClick: () => void; disabled?: boolean; className?: string; face: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`group flex touch-manipulation flex-col items-center gap-1 disabled:opacity-40 @min-[480px]:gap-1.5 ${className ?? ''}`}>
      {face}
      <span className={`${engraved} text-[10px] @min-[480px]:text-[19px]`}>{label}</span>
    </button>
  )
}

export default function Controls({ status, endsAt, error, power, wreck, onStart, onStop, onPower, onOverload }: ControlsProps) {
  const [url, setUrl] = useState('')
  const [floor, setFloor] = useState<PresetKey | null>(null)
  const [flash, setFlash] = useState('')
  const flashTimer = useRef(0)
  const idle = status === 'idle'
  const held = power <= 5
  useTick(status)

  // Tell the 3D model whether the doors are being held open.
  useEffect(() => {
    lift.doorsHeld = held
  }, [held])

  function show(message: string) {
    setFlash(message)
    clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(''), 1500)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (url.trim()) {
      setFloor(null)
      onStart({ url: url.trim() })
    } else {
      keyBeep()
      show('LINK?')
    }
  }

  const state = { status, endsAt, error, wreck, wreckLabels: WRECK_LABELS }
  const doorKey = 'h-12 w-12 @min-[480px]:h-[68px] @min-[480px]:w-[68px]'

  return (
    <form
      onSubmit={submit}
      className="relative flex w-full select-none flex-col gap-3 rounded-xl border-2 border-[#7a5a1c] bg-[linear-gradient(165deg,#ecd590,#c9a04a_40%,#b38c3c_68%,#dcc27c)] p-3 font-sans shadow-[inset_0_1px_0_#fff8,inset_0_-2px_6px_#0003] @min-[480px]:h-full @min-[480px]:gap-5 @min-[480px]:rounded-md @min-[480px]:px-8 @min-[480px]:py-7"
    >
      {/* Corner screws (desktop plate only) */}
      {['left-2.5 top-2.5', 'right-2.5 top-2.5', 'left-2.5 bottom-2.5', 'right-2.5 bottom-2.5'].map((at) => (
        <span key={at} className={`absolute hidden h-3.5 w-3.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff3c4,#8a6a28)] shadow-[inset_0_0_0_1px_#5c4613] @min-[480px]:block ${at}`}>
          <span className="absolute left-1/2 top-1/2 h-[1.5px] w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#5c4613]" />
        </span>
      ))}

      {/* Floor readout */}
      <div className="flex h-[58px] items-center justify-end overflow-hidden rounded-md border-2 border-[#5c4613] bg-[#120904] px-3 shadow-[inset_0_2px_8px_#000] @min-[480px]:h-[86px] @min-[480px]:px-5">
        <span
          className={`font-dseg text-[28px] text-[#ffb347] [text-shadow:0_0_8px_#ff8a1faa] @min-[480px]:text-[44px] ${isPulsing(state, flash) ? 'animate-pulse' : ''}`}
        >
          {displayText(state, flash)}
        </span>
      </div>

      <fieldset disabled={wreck !== 'none'} className="flex min-w-0 flex-col gap-3 @min-[480px]:flex-1 @min-[480px]:justify-between @min-[480px]:gap-4">
        {/* Floor buttons = presets */}
        <div className="grid grid-cols-4 gap-1 @min-[480px]:grid-cols-2 @min-[480px]:gap-x-6 @min-[480px]:gap-y-3 @min-[480px]:px-12">
          {FLOORS.map((f) => (
            <KeyWithLabel
              key={f.key}
              label={f.label}
              disabled={!idle}
              className={f.order}
              onClick={() => {
                setFloor(f.key)
                onStart({ preset: f.key })
              }}
              face={
                <span className={`${roundKey(!idle && floor === f.key)} h-14 w-14 text-lg font-extrabold @min-[480px]:h-[88px] @min-[480px]:w-[88px] @min-[480px]:text-[30px]`}>
                  {f.code}
                </span>
              }
            />
          ))}
        </div>

        {/* Doors (power) + alarm */}
        <div className="grid grid-cols-3 gap-2 border-y border-[#8a6a28]/50 py-2.5 @min-[480px]:py-3">
          <KeyWithLabel
            label="OPEN"
            onClick={() => {
              keyBeep()
              onPower(OPEN.power)
              show(OPEN.flash)
            }}
            face={<span className={`${roundKey(held)} ${doorKey}`}><Arrows dir="open" /></span>}
          />
          <KeyWithLabel
            label="CLOSE"
            onClick={() => {
              keyBeep()
              onPower(CLOSE.power)
              show(CLOSE.flash)
            }}
            face={<span className={`${roundKey(!held)} ${doorKey}`}><Arrows dir="close" /></span>}
          />
          <KeyWithLabel
            label="ALARM"
            onClick={() => {
              ringAlarm()
              lift.alarmAt = performance.now() / 1000
              show('RING')
            }}
            face={
              <span
                className={`${doorKey} flex items-center justify-center rounded-full border-[3px] border-[#7f1d1d] bg-[radial-gradient(circle_at_35%_30%,#ff8a80,#dc2626_55%,#7f1d1d)] text-[#fff1e6] shadow-[0_3px_0_#5c4613,0_5px_8px_#0005] group-active:translate-y-px group-active:shadow-none`}
              >
                <BellIcon />
              </span>
            }
          />
        </div>

        {/* Link slot, START/STOP, DO NOT PRESS */}
        <div className="flex min-w-0 flex-col gap-1.5 @min-[480px]:gap-2.5">
          <label className={`${engraved} text-[10px] uppercase @min-[480px]:text-[19px]`} htmlFor="yt-url">
            Paste YouTube link
          </label>
          <input
            id="yt-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!idle}
            placeholder="https://youtu.be/…"
            className="h-11 rounded-md border-2 border-[#8a6a28] bg-[#fffaf0] px-2 text-base text-zinc-800 shadow-[inset_0_2px_3px_#0002] outline-none placeholder:text-zinc-400 focus:border-[#c2410c] disabled:opacity-50 @min-[480px]:h-[50px] @min-[480px]:px-3 @min-[480px]:text-[19px]"
          />
          <div className="grid grid-cols-2 gap-1.5 @min-[480px]:gap-2.5">
            <button
              type="submit"
              disabled={!idle}
              className="h-12 touch-manipulation rounded-md border-2 border-[#5c4613] bg-[#1d160c] text-xs font-extrabold tracking-[0.2em] text-[#ffb347] shadow-[0_3px_0_#5c4613] [text-shadow:0_0_6px_#ff8a1f88] active:translate-y-[2px] active:shadow-none disabled:opacity-40 @min-[480px]:h-[54px] @min-[480px]:text-[20px]"
            >
              START
            </button>
            <button
              type="button"
              onClick={onStop}
              disabled={idle}
              className="h-12 touch-manipulation rounded-md border-2 border-zinc-400 bg-[linear-gradient(#f4f4f5,#d4d4d8)] text-xs font-extrabold tracking-[0.2em] text-zinc-700 shadow-[0_3px_0_#71717a] active:translate-y-[2px] active:shadow-none disabled:opacity-40 @min-[480px]:h-[54px] @min-[480px]:text-[20px]"
            >
              STOP
            </button>
          </div>
          <DoNotPress onPress={onOverload} className="h-10 @min-[480px]:h-[52px] @min-[480px]:p-[5px] @min-[480px]:[&>span]:text-[18px]" />
          {error && <p className="text-[12px] font-semibold leading-snug text-red-800 @min-[480px]:text-[17px]">{error}</p>}
        </div>
      </fieldset>
    </form>
  )
}
