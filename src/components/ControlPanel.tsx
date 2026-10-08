import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react'
import type { Source, Status, Wreck } from '../App'
import { keyBeep } from '../audio/engine'

// Keys must match PRESETS in server/index.ts.
const PRESETS = [
  { key: 'popcorn', label: 'POPCORN' },
  { key: 'defrost', label: 'DEFROST' },
  { key: 'reheat', label: 'REHEAT' },
  { key: 'beverage', label: 'BEVERAGE' },
]

type Props = {
  status: Status
  endsAt: number
  error: string
  power: number
  wreck: Wreck
  onStart: (source: Source) => void
  onStop: () => void
  onPower: (level: number) => void
  onOverload: () => void
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const key =
  'touch-manipulation rounded-sm border border-black/70 bg-zinc-800 text-zinc-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_0_#000] ' +
  'active:translate-y-px active:shadow-none disabled:opacity-40'

function Key({ children, className = '', ...props }: { children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${key} ${className}`} {...props}>
      {children}
    </button>
  )
}

type DisplayState = { status: Status; endsAt: number; error: string; wreck: Wreck }

/** What the LED display reads. `flash` is a short-lived message like "PL 7". */
function displayText({ status, endsAt, error, wreck }: DisplayState, flash = '') {
  return wreck === 'exploded' ? '' // fried
    : wreck === 'fire' ? 'FIRE'
    : wreck === 'arcing' ? 'HOT'
    : flash ? flash
    : status === 'playing' ? formatTime(endsAt - Date.now())
    : status === 'loading' ? 'COOK'
    : error ? 'Err'
    : 'READY'
}

function isPulsing({ status, wreck }: DisplayState, flash = '') {
  return (status === 'loading' && !flash) || wreck === 'arcing' || wreck === 'fire'
}

/** Re-renders a few times a second while playing, so a countdown ticks. */
function useTick(status: Status) {
  const [, rerender] = useState(0)
  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(() => rerender((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [status])
}

/** The LED readout on its own, for the phone's collapsed control bar. */
export function MiniDisplay(props: DisplayState) {
  useTick(props.status)
  return (
    <span
      className={`font-dseg text-lg text-[#4dff88] [text-shadow:0_0_6px_#4dff88aa] ${isPulsing(props) ? 'animate-pulse' : ''}`}
    >
      {displayText(props)}
    </span>
  )
}

// Rendered on the microwave's face on desktop (see Microwave.tsx), or in a slide-up sheet on phones
// (see App.tsx). Sizes step up when the panel is 300px+ wide, via container queries.
export default function ControlPanel({ status, endsAt, error, power, wreck, onStart, onStop, onPower, onOverload }: Props) {
  const [url, setUrl] = useState('')
  const [flash, setFlash] = useState('') // short-lived display message, like "PL 7"
  const flashTimer = useRef(0)
  const idle = status === 'idle'
  useTick(status)

  function show(message: string) {
    setFlash(message)
    clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(''), 1500)
  }

  function pressDigit(digit: number) {
    keyBeep()
    const level = digit === 0 ? 10 : digit
    onPower(level)
    show(`PL ${level}`)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (url.trim()) onStart({ url: url.trim() })
    else {
      keyBeep()
      show('LINK?')
    }
  }

  const state = { status, endsAt, error, wreck }

  return (
    <form
      onSubmit={submit}
      className="flex w-full select-none flex-col gap-3 rounded-md border border-black/60 bg-[#141418] p-3 font-sans"
    >
      <div className="flex h-[58px] @min-[300px]:h-[72px] items-center justify-end overflow-hidden rounded-sm border border-black bg-[#071108] px-3 shadow-[inset_0_2px_6px_#000]">
        <span
          className={`font-dseg text-[28px] @min-[300px]:text-[36px] text-[#4dff88] [text-shadow:0_0_8px_#4dff88aa] ${
            isPulsing(state, flash) ? 'animate-pulse' : ''
          }`}
        >
          {displayText(state, flash)}
        </span>
      </div>

      {/* Every control goes dead while it's overloading or wrecked. */}
      <fieldset disabled={wreck !== 'none'} className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-2 @min-[300px]:grid-cols-4 gap-1.5">
          {PRESETS.map((p) => (
            <Key
              key={p.key}
              disabled={!idle}
              onClick={() => onStart({ preset: p.key })}
              className="h-9 @min-[300px]:h-11 text-[10px] font-bold tracking-[0.12em] text-amber-200"
            >
              {p.label}
            </Key>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <Key key={d} onClick={() => pressDigit(d)} className="h-8 @min-[300px]:h-10 text-sm @min-[300px]:text-base font-semibold">
              {d}
            </Key>
          ))}
          <Key
            onClick={() => {
              keyBeep()
              show(`PL ${power}`)
            }}
            className="h-8 @min-[300px]:h-10 text-[9px] font-bold tracking-wider"
          >
            POWER
          </Key>
          <Key onClick={() => pressDigit(0)} className="h-8 @min-[300px]:h-10 text-sm @min-[300px]:text-base font-semibold">
            0
          </Key>
          <Key
            disabled={!idle}
            onClick={() => {
              keyBeep()
              setUrl('')
            }}
            className="h-8 @min-[300px]:h-10 text-[9px] font-bold tracking-wider"
          >
            CLEAR
          </Key>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-300/80" htmlFor="yt-url">
            Paste YouTube link
          </label>
          <input
            id="yt-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!idle}
            placeholder="https://youtu.be/…"
            className="h-8 @min-[300px]:h-11 rounded-sm border border-black bg-black/60 px-2 text-xs @min-[300px]:text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-400/70 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="submit"
            disabled={!idle}
            className="h-10 @min-[300px]:h-12 touch-manipulation rounded-sm bg-zinc-200 text-xs font-extrabold tracking-wider text-zinc-900 shadow-[0_3px_0_#71717a] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
          >
            START
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={idle}
            className="h-10 @min-[300px]:h-12 touch-manipulation rounded-sm border border-black/70 bg-zinc-700 text-xs font-extrabold tracking-wider text-zinc-100 shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
          >
            STOP
          </button>
        </div>

        <button
          type="button"
          onClick={onOverload}
          className="h-9 @min-[300px]:h-11 touch-manipulation rounded-sm bg-[repeating-linear-gradient(-45deg,#e8b400_0_10px,#151515_10px_20px)] p-[3px] shadow-[0_2px_0_#000] active:translate-y-px disabled:opacity-40"
        >
          <span className="flex h-full items-center justify-center rounded-[2px] bg-[#151515] text-[10px] font-extrabold tracking-[0.25em] text-[#e8b400]">
            DO NOT PRESS
          </span>
        </button>
      </fieldset>

      {error && <p className="text-[11px] leading-snug text-red-400">{error}</p>}
    </form>
  )
}
