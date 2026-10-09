// The car's themed controls: a car-stereo head unit. Amber segmented display with a bass meter, chrome
// BASS knob with a +/− rocker (power: BASS 10 = nothing but thump coming through the trunk, i.e. the
// most muffled), source buttons for the 4 presets, link input, START/STOP, DO NOT PRESS.
// A wide head unit on the stand's dash plate (desktop), a column in the phone sheet.
import { useRef, useState, type FormEvent } from 'react'
import type { ControlsProps, PresetKey } from '../types'
import { keyBeep } from '../../audio/engine'
import { DoNotPress, displayText, isPulsing, useTick } from '../shared/led'
import { WRECK_LABELS } from './labels'

const SOURCES: { key: PresetKey; label: string; sub: string }[] = [
  { key: 'popcorn', label: 'AM', sub: '530' },
  { key: 'defrost', label: 'FM', sub: '101.1' },
  { key: 'reheat', label: 'AUX', sub: 'IN' },
  { key: 'beverage', label: 'BASS BOOST', sub: 'MAX' },
]

const AMBER = '#ffb547'

const rubberKey =
  'touch-manipulation rounded-md border border-black bg-[linear-gradient(180deg,#34373d,#1d1f23)] text-zinc-300 ' +
  'shadow-[inset_0_1px_0_#ffffff22,0_2px_0_#000] active:translate-y-px active:shadow-none disabled:opacity-40'

/** Chrome knob showing the bass level, with a +/− rocker beside it. */
function BassKnob({ power, onSet }: { power: number; onSet: (n: number) => void }) {
  const angle = -135 + ((power - 1) / 9) * 270
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-[66px] w-[66px] shrink-0 rounded-full bg-[conic-gradient(from_200deg,#f4f6f8,#8a9098,#e3e6ea,#7d838b,#f4f6f8)] p-[3px] shadow-[0_3px_6px_#000c]">
        <div
          className="relative h-full w-full rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c4c9cf_55%,#8d939b)] transition-transform duration-200"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span className="absolute left-1/2 top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-[#ffb547] shadow-[0_0_4px_#ffb547]" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <button type="button" aria-label="More bass" onClick={() => onSet(Math.min(10, power + 1))} className={`${rubberKey} h-8 w-11 rounded-b-sm text-sm font-black`}>
          +
        </button>
        <span className="text-[8px] font-extrabold tracking-[0.2em] text-zinc-400">BASS</span>
        <button type="button" aria-label="Less bass" onClick={() => onSet(Math.max(1, power - 1))} className={`${rubberKey} h-8 w-11 rounded-t-sm text-sm font-black`}>
          −
        </button>
      </div>
    </div>
  )
}

// Rendered on the stand's dash plate on desktop (see Model.tsx), or in a slide-up sheet on phones
// (see App.tsx). Wide head-unit layout when the panel is 520px+ wide, via container queries.
export default function Controls({ status, endsAt, error, power, wreck, onStart, onStop, onPower, onOverload }: ControlsProps) {
  const [url, setUrl] = useState('')
  const [source, setSource] = useState<PresetKey | null>(null)
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
    if (url.trim()) {
      setSource(null)
      onStart({ url: url.trim() })
    } else {
      keyBeep()
      show('LINK?')
    }
  }

  function setBass(n: number) {
    keyBeep()
    onPower(n)
    show(`BASS ${n}`)
  }

  const state = { status, endsAt, error, wreck, wreckLabels: WRECK_LABELS }

  return (
    // Chrome bezel round a glossy black face
    <form onSubmit={submit} className="w-full select-none rounded-[14px] bg-[linear-gradient(180deg,#eef0f3,#8b9097_45%,#d7dbe0)] p-[3px] font-sans shadow-[0_6px_18px_#000a]">
      <div className="flex flex-col gap-3 rounded-[11px] bg-[linear-gradient(180deg,#2a2d33,#0d0e11_45%,#060607)] p-3 @min-[520px]:gap-2 @min-[520px]:p-2.5">
        <div className="flex flex-col gap-3 @min-[520px]:flex-row @min-[520px]:items-center">
          {/* Display: the readout, the source in use, and a 10-step bass meter */}
          <div className="order-first flex h-[78px] flex-1 flex-col justify-between overflow-hidden rounded-md border border-black bg-[#120a03] px-3 py-1.5 shadow-[inset_0_2px_8px_#000] @min-[520px]:order-last @min-[520px]:h-[74px]">
            <div className="flex items-start justify-between">
              <span className="text-[9px] font-bold tracking-[0.2em] text-[#ffb547]/70 @min-[520px]:text-[11px]">
                {source ? SOURCES.find((s) => s.key === source)!.label : 'LINK'}
              </span>
              <span
                className={`font-dseg text-[26px] leading-none text-[#ffb547] [text-shadow:0_0_8px_#ffb547aa] @min-[520px]:text-[28px] ${
                  isPulsing(state, flash) ? 'animate-pulse' : ''
                }`}
              >
                {displayText(state, flash)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-bold tracking-[0.2em] text-[#ffb547]/60">BASS</span>
              <div className="flex flex-1 gap-[3px]">
                {Array.from({ length: 10 }, (_, i) => (
                  <span
                    key={i}
                    className="h-2 flex-1 skew-x-[-12deg] rounded-[1px]"
                    style={{ background: i < power ? AMBER : '#3a2408', boxShadow: i < power ? `0 0 4px ${AMBER}` : 'none' }}
                  />
                ))}
              </div>
            </div>
          </div>
          <fieldset disabled={wreck !== 'none'} className="flex min-w-0 justify-center">
            <BassKnob power={power} onSet={setBass} />
          </fieldset>
        </div>

        <fieldset disabled={wreck !== 'none'} className="flex min-w-0 flex-col gap-3 @min-[520px]:gap-2">
          {/* Source buttons = the 4 presets */}
          <div className="grid grid-cols-4 gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={!idle}
                onClick={() => {
                  setSource(s.key)
                  onStart({ preset: s.key })
                }}
                className={`${rubberKey} flex h-12 flex-col items-center justify-center gap-0.5 px-1 @min-[520px]:h-11`}
              >
                <span className="text-[10px] font-extrabold leading-[1.05] tracking-wider @min-[520px]:text-[13px]">{s.label}</span>
                <span className="flex items-center gap-1 text-[8px] font-bold text-zinc-500 @min-[520px]:text-[10px]">
                  <span className={`h-1 w-1 rounded-full ${source === s.key && !idle ? 'bg-[#ffb547] shadow-[0_0_4px_#ffb547]' : 'bg-zinc-700'}`} />
                  {s.sub}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 @min-[520px]:flex-row @min-[520px]:items-end @min-[520px]:gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#ffb547] @min-[520px]:text-[11px]" htmlFor="yt-url">
                Paste YouTube link
              </label>
              <input
                id="yt-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={!idle}
                placeholder="https://youtu.be/…"
                className="h-11 rounded-md border border-black bg-[#17181c] px-2 text-base text-zinc-100 shadow-[inset_0_1px_4px_#000] outline-none placeholder:text-zinc-600 focus:border-[#ffb547] disabled:opacity-50 @min-[520px]:h-9 @min-[520px]:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5 @min-[520px]:w-[170px]">
              <button
                type="submit"
                disabled={!idle}
                className="h-12 touch-manipulation rounded-md bg-[linear-gradient(180deg,#ffc76b,#f29a12)] text-xs font-extrabold tracking-wider text-[#2a1600] shadow-[0_3px_0_#8a5400] active:translate-y-[2px] active:shadow-none disabled:opacity-40 @min-[520px]:h-9 @min-[520px]:text-sm"
              >
                START
              </button>
              <button
                type="button"
                onClick={onStop}
                disabled={idle}
                className="h-12 touch-manipulation rounded-md border border-zinc-500 bg-[linear-gradient(180deg,#d4d7dc,#9ea3aa)] text-xs font-extrabold tracking-wider text-zinc-800 shadow-[0_3px_0_#55595f] active:translate-y-[2px] active:shadow-none disabled:opacity-40 @min-[520px]:h-9 @min-[520px]:text-sm"
              >
                STOP
              </button>
            </div>
          </div>
          <DoNotPress onPress={onOverload} className="h-10 @min-[520px]:h-9" />
          {error && <p className="text-[11px] leading-snug text-red-400">{error}</p>}
        </fieldset>
      </div>
    </form>
  )
}
