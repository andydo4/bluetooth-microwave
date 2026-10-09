// The data center's themed controls: a server terminal (green on black) with the readout, the
// four racks (the presets), cooling (power), a command-line link prompt, START/STOP, DO NOT PRESS.
// On the crash cart's monitor (desktop, 620px wide), or a column in the phone sheet.
import { useRef, useState, type FormEvent } from 'react'
import type { ControlsProps, PresetKey } from '../types'
import { keyBeep } from '../../audio/engine'
import { DoNotPress, displayText, isPulsing, useTick } from '../shared/led'
import { WRECK_LABELS } from './labels'

const RACKS: { key: PresetKey; label: string }[] = [
  { key: 'popcorn', label: 'RACK A' },
  { key: 'defrost', label: 'RACK B' },
  { key: 'reheat', label: 'RACK C' },
  { key: 'beverage', label: 'RACK D' },
]

// Cooling sets the power level: the harder the fans roar, the less of the music gets through.
const COOLING = [
  { label: 'LOW', power: 4, flash: 'FAN LO' },
  { label: 'MED', power: 7, flash: 'FAN MED' },
  { label: 'MAX', power: 10, flash: 'FAN MAX' },
]
const coolingIndex = (power: number) => (power <= 5 ? 0 : power <= 8 ? 1 : 2)

const termKey =
  'touch-manipulation rounded-[3px] border border-[#1f7a3a] bg-[#04140a] font-bold tracking-wider text-[#4dff88] ' +
  'hover:bg-[#0a2614] active:translate-y-px disabled:opacity-40'

export default function Controls({ status, endsAt, error, power, wreck, onStart, onStop, onPower, onOverload }: ControlsProps) {
  const [url, setUrl] = useState('')
  const [rack, setRack] = useState<PresetKey | null>(null)
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
      setRack(null)
      onStart({ url: url.trim() })
    } else {
      keyBeep()
      show('LINK?')
    }
  }

  const state = { status, endsAt, error, wreck, wreckLabels: WRECK_LABELS }
  const cooling = coolingIndex(power)
  const alarm = wreck !== 'none'

  return (
    <form
      onSubmit={submit}
      className="flex w-full select-none flex-col gap-2.5 rounded-md border border-[#0f2a18] bg-[#020704] bg-[repeating-linear-gradient(0deg,#ffffff06_0_1px,transparent_1px_3px)] p-3 font-mono text-[#4dff88] @min-[520px]:gap-2 @min-[520px]:p-3"
    >
      {/* Prompt header */}
      <div className="flex items-center justify-between text-[11px] @min-[520px]:text-[14px]">
        <span className="truncate">
          <span className="text-[#7dffa8]">root@dc01</span>
          <span className="text-zinc-400">:</span>
          <span className="text-sky-400">~</span>
          <span className="text-zinc-400">$</span> ./speaker-wall --play
        </span>
        <span className="flex shrink-0 gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${alarm ? 'animate-pulse bg-red-500' : i === 2 && !idle ? 'animate-pulse bg-[#4dff88]' : 'bg-[#1f7a3a]'}`} />
          ))}
        </span>
      </div>

      {/* Readout + cooling */}
      <div className="flex flex-col gap-2.5 @min-[520px]:flex-row @min-[520px]:items-center @min-[520px]:gap-3">
        <div className="flex h-[60px] min-w-0 flex-1 items-center overflow-hidden rounded-[3px] border border-[#0f3a1d] bg-black px-3 shadow-[inset_0_0_12px_#0b3a1a] @min-[520px]:h-[56px]">
          <span
            className={`whitespace-nowrap text-[30px] font-bold leading-none @min-[520px]:text-[34px] [text-shadow:0_0_10px_#4dff88aa] ${
              alarm ? 'text-[#ff5a3a] [text-shadow:0_0_10px_#ff5a3aaa]' : ''
            } ${isPulsing(state, flash) ? 'animate-pulse' : ''}`}
          >
            <span className="opacity-60">&gt; </span>
            {displayText(state, flash)}
            <span className="ml-1 inline-block h-[0.8em] w-[0.5em] translate-y-[0.08em] animate-pulse bg-current" />
          </span>
        </div>
        <fieldset disabled={wreck !== 'none'} className="flex min-w-0 flex-col gap-1 @min-[520px]:w-[210px] @min-[520px]:shrink-0">
          <span className="text-[10px] tracking-[0.15em] text-[#2fbf62] @min-[520px]:text-[12px]"># cooling --fans</span>
          <div className="grid grid-cols-3 gap-1">
            {COOLING.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => {
                  keyBeep()
                  onPower(c.power)
                  show(c.flash)
                }}
                className={`${termKey} h-10 text-[11px] @min-[520px]:h-8 @min-[520px]:text-[14px] ${i === cooling ? '!bg-[#4dff88] !text-black' : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset disabled={wreck !== 'none'} className="flex min-w-0 flex-col gap-2.5 @min-[520px]:gap-2">
        {/* The four racks = the four preset songs */}
        <div className="grid grid-cols-2 gap-1.5 @min-[300px]:grid-cols-4">
          {RACKS.map((r) => (
            <button
              key={r.key}
              type="button"
              disabled={!idle}
              onClick={() => {
                setRack(r.key)
                onStart({ preset: r.key })
              }}
              className={`${termKey} flex h-12 items-center justify-center gap-2 text-[13px] @min-[520px]:h-10 @min-[520px]:text-[16px] ${
                rack === r.key && !idle ? '!border-[#4dff88] !opacity-100 shadow-[0_0_8px_#4dff8866]' : ''
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${rack === r.key && !idle ? 'animate-pulse bg-[#4dff88] shadow-[0_0_6px_#4dff88]' : 'bg-[#1f7a3a]'}`} />
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="yt-url" className="text-[10px] tracking-[0.15em] text-[#2fbf62] @min-[520px]:text-[12px]">
            Paste YouTube link
          </label>
          <div className="flex h-11 items-center gap-2 rounded-[3px] border border-[#1f7a3a] bg-black px-2 focus-within:border-[#4dff88] @min-[520px]:h-9">
            <span className="shrink-0 text-[13px] text-[#2fbf62] @min-[520px]:text-[15px]">$ fetch</span>
            <input
              id="yt-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={!idle}
              placeholder="https://youtu.be/…"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-base text-[#b8ffd0] caret-[#4dff88] outline-none placeholder:text-[#1f7a3a] disabled:opacity-50 @min-[520px]:text-[15px]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 @min-[520px]:flex-row">
          <div className="grid grid-cols-2 gap-1.5 @min-[520px]:w-[300px]">
            <button
              type="submit"
              disabled={!idle}
              className="h-12 touch-manipulation rounded-[3px] bg-[#4dff88] text-[13px] font-extrabold tracking-[0.2em] text-black shadow-[0_0_10px_#4dff8855] active:translate-y-px disabled:opacity-40 @min-[520px]:h-10 @min-[520px]:text-[15px]"
            >
              START
            </button>
            <button
              type="button"
              onClick={onStop}
              disabled={idle}
              className="h-12 touch-manipulation rounded-[3px] border border-zinc-500 bg-zinc-800 text-[13px] font-extrabold tracking-[0.2em] text-zinc-200 active:translate-y-px disabled:opacity-40 @min-[520px]:h-10 @min-[520px]:text-[15px]"
            >
              STOP
            </button>
          </div>
          <DoNotPress onPress={onOverload} className="h-10 @min-[520px]:h-10 @min-[520px]:flex-1" />
        </div>
        {error && <p className="text-[12px] leading-snug text-[#ff6b4a]">! {error}</p>}
      </fieldset>
    </form>
  )
}
