import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react'
import type { Source, Status } from '../App'
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
  onStart: (source: Source) => void
  onStop: () => void
  onPower: (level: number) => void
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const key =
  'rounded-sm border border-black/70 bg-zinc-800 text-zinc-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_2px_0_#000] ' +
  'active:translate-y-px active:shadow-none disabled:opacity-40'

function Key({ children, className = '', ...props }: { children: ReactNode; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${key} ${className}`} {...props}>
      {children}
    </button>
  )
}

// Rendered as HTML on the microwave's control panel (see Microwave.tsx).
export default function ControlPanel({ status, endsAt, error, power, onStart, onStop, onPower }: Props) {
  const [url, setUrl] = useState('')
  const [flash, setFlash] = useState('') // short-lived display message, like "PL 7"
  const flashTimer = useRef(0)
  const [, rerender] = useState(0)
  const idle = status === 'idle'

  // Re-render a few times a second so the countdown ticks.
  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(() => rerender((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [status])

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

  const display =
    flash ? flash
    : status === 'playing' ? formatTime(endsAt - Date.now())
    : status === 'loading' ? 'COOK'
    : error ? 'Err'
    : 'READY'

  return (
    <form
      onSubmit={submit}
      className="flex w-[220px] select-none flex-col gap-3 rounded-md border border-black/60 bg-[#141418] p-3 font-sans"
    >
      <div className="flex h-[58px] items-center justify-end overflow-hidden rounded-sm border border-black bg-[#071108] px-3 shadow-[inset_0_2px_6px_#000]">
        <span
          className={`font-dseg text-[28px] text-[#4dff88] [text-shadow:0_0_8px_#4dff88aa] ${
            status === 'loading' && !flash ? 'animate-pulse' : ''
          }`}
        >
          {display}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => (
          <Key
            key={p.key}
            disabled={!idle}
            onClick={() => onStart({ preset: p.key })}
            className="h-9 text-[10px] font-bold tracking-[0.12em] text-amber-200"
          >
            {p.label}
          </Key>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Key key={d} onClick={() => pressDigit(d)} className="h-8 text-sm font-semibold">
            {d}
          </Key>
        ))}
        <Key
          onClick={() => {
            keyBeep()
            show(`PL ${power}`)
          }}
          className="h-8 text-[9px] font-bold tracking-wider"
        >
          POWER
        </Key>
        <Key onClick={() => pressDigit(0)} className="h-8 text-sm font-semibold">
          0
        </Key>
        <Key
          disabled={!idle}
          onClick={() => {
            keyBeep()
            setUrl('')
          }}
          className="h-8 text-[9px] font-bold tracking-wider"
        >
          CLEAR
        </Key>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-300/80" htmlFor="yt-url">
          Bluetooth · YouTube link
        </label>
        <input
          id="yt-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!idle}
          placeholder="https://youtu.be/…"
          className="h-8 rounded-sm border border-black bg-black/60 px-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-400/70 disabled:opacity-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="submit"
          disabled={!idle}
          className="h-10 rounded-sm bg-zinc-200 text-xs font-extrabold tracking-wider text-zinc-900 shadow-[0_3px_0_#71717a] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
        >
          START
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={idle}
          className="h-10 rounded-sm bg-red-600 text-[11px] font-extrabold tracking-wider text-white shadow-[0_3px_0_#7f1d1d] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
        >
          STOP
        </button>
      </div>

      {error && <p className="text-[11px] leading-snug text-red-400">{error}</p>}
    </form>
  )
}
