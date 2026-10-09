// The washer's themed controls: LED display, cycle dial (the 4 presets), water level (power),
// link slot, START/STOP, DO NOT PRESS. A wide row on the console (desktop), a column in the phone sheet.
import { useRef, useState, type FormEvent } from 'react'
import type { ControlsProps, PresetKey } from '../types'
import { keyBeep } from '../../audio/engine'
import { DoNotPress, displayText, isPulsing, useTick } from '../shared/led'
import { WRECK_LABELS } from './labels'

// Dial positions, clockwise from top-left. Angles are where the knob's pointer aims (0 = straight up).
const CYCLES: { key: PresetKey; label: string; angle: number }[] = [
  { key: 'popcorn', label: 'DELICATE', angle: -50 },
  { key: 'defrost', label: 'HEAVY', angle: 50 },
  { key: 'reheat', label: 'RINSE', angle: 130 },
  { key: 'beverage', label: 'SPIN', angle: -130 },
]

// Water level sets the power level (how muffled the music is).
const WATER = [
  { label: 'LOW', power: 4, flash: 'LO' },
  { label: 'MED', power: 7, flash: 'MED' },
  { label: 'HIGH', power: 10, flash: 'HI' },
]
const waterIndex = (power: number) => (power <= 5 ? 0 : power <= 8 ? 1 : 2)

const softKey =
  'touch-manipulation rounded-full border border-zinc-300 bg-white text-zinc-600 shadow-[0_1px_0_#a1a1aa] ' +
  'active:translate-y-px active:shadow-none disabled:opacity-40'

function CycleDial({ cycle, disabled, onPick }: { cycle: PresetKey; disabled: boolean; onPick: (key: PresetKey) => void }) {
  const angle = CYCLES.find((c) => c.key === cycle)!.angle
  return (
    <div className="relative mx-auto h-[150px] w-[150px] shrink-0">
      {/* Knob */}
      <div
        className="absolute left-1/2 top-1/2 h-[74px] w-[74px] rounded-full border border-zinc-300 bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c8ccd2_70%,#a7adb5)] shadow-[0_3px_6px_#0004] transition-transform duration-300"
        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
      >
        <span className="absolute left-1/2 top-1.5 h-5 w-1.5 -translate-x-1/2 rounded-full bg-sky-600" />
      </div>
      {CYCLES.map((c) => {
        const rad = (c.angle * Math.PI) / 180
        const x = 75 + Math.sin(rad) * 60
        const y = 75 - Math.cos(rad) * 60
        return (
          <button
            key={c.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c.key)}
            style={{ left: x, top: y }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 touch-manipulation rounded px-1 py-1 text-[9px] font-extrabold tracking-[0.1em] disabled:opacity-40 ${
              c.key === cycle ? 'text-sky-700' : 'text-zinc-500'
            }`}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

// Rendered on the washer's console on desktop (see Model.tsx), or in a slide-up sheet on phones
// (see App.tsx). Row layout when the panel is 520px+ wide, via container queries.
export default function Controls({ status, endsAt, error, power, wreck, onStart, onStop, onPower, onOverload }: ControlsProps) {
  const [url, setUrl] = useState('')
  const [cycle, setCycle] = useState<PresetKey>('popcorn')
  const [flash, setFlash] = useState('')
  const flashTimer = useRef(0)
  const idle = status === 'idle'
  useTick(status)

  function show(message: string) {
    setFlash(message)
    clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(''), 1500)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (url.trim()) onStart({ url: url.trim() })
    else {
      keyBeep()
      show('LINK?')
    }
  }

  const state = { status, endsAt, error, wreck, wreckLabels: WRECK_LABELS }
  const water = waterIndex(power)

  return (
    <form
      onSubmit={submit}
      className="flex w-full select-none flex-col gap-3 rounded-xl border border-zinc-300 bg-[#f3f4f6] p-3 font-sans @min-[520px]:flex-row @min-[520px]:items-center @min-[520px]:gap-4 @min-[520px]:p-2.5"
    >
      {/* Display + water level */}
      <div className="flex flex-col gap-2 @min-[520px]:w-[150px] @min-[520px]:shrink-0">
        <div className="flex h-[58px] @min-[520px]:h-[52px] items-center justify-end overflow-hidden rounded-md border border-black bg-[#071108] px-3 shadow-[inset_0_2px_6px_#000]">
          <span
            className={`font-dseg text-[28px] @min-[520px]:text-[22px] text-[#4dff88] [text-shadow:0_0_8px_#4dff88aa] ${
              isPulsing(state, flash) ? 'animate-pulse' : ''
            }`}
          >
            {displayText(state, flash)}
          </span>
        </div>
        <fieldset disabled={wreck !== 'none'} className="flex min-w-0 flex-col gap-1">
          <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-500">WATER LEVEL</span>
          <div className="grid grid-cols-3 gap-1">
            {WATER.map((w, i) => (
              <button
                key={w.label}
                type="button"
                onClick={() => {
                  keyBeep()
                  onPower(w.power)
                  show(w.flash)
                }}
                className={`${softKey} h-9 @min-[520px]:h-7 text-[9px] font-bold tracking-wider ${i === water ? '!border-sky-500 !bg-sky-100 !text-sky-800' : ''}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset disabled={wreck !== 'none'} className="flex min-w-0 flex-1 flex-col gap-3 @min-[520px]:flex-row @min-[520px]:items-center @min-[520px]:gap-4">
        <CycleDial
          cycle={cycle}
          disabled={!idle}
          onPick={(key) => {
            setCycle(key)
            onStart({ preset: key })
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-700" htmlFor="yt-url">
            Paste YouTube link
          </label>
          <input
            id="yt-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!idle}
            placeholder="https://youtu.be/…"
            className="h-11 @min-[520px]:h-8 rounded-md border border-zinc-300 bg-white px-2 text-base @min-[520px]:text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-sky-500 disabled:opacity-50"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="submit"
              disabled={!idle}
              className="h-12 @min-[520px]:h-8 touch-manipulation rounded-md bg-sky-600 text-xs font-extrabold tracking-wider text-white shadow-[0_3px_0_#075985] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
            >
              START
            </button>
            <button
              type="button"
              onClick={onStop}
              disabled={idle}
              className="h-12 @min-[520px]:h-8 touch-manipulation rounded-md border border-zinc-300 bg-zinc-200 text-xs font-extrabold tracking-wider text-zinc-700 shadow-[0_3px_0_#a1a1aa] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
            >
              STOP
            </button>
          </div>
          <DoNotPress onPress={onOverload} className="h-10 @min-[520px]:h-8" />
          {error && <p className="text-[11px] leading-snug text-red-600">{error}</p>}
        </div>
      </fieldset>
    </form>
  )
}
