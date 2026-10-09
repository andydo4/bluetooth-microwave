// The LED readout logic shared by every level's controls and the phone's collapsed control bar.
import { useEffect, useState } from 'react'
import type { LevelDef, Status, Wreck } from '../types'

export type DisplayState = {
  status: Status
  endsAt: number
  error: string
  wreck: Wreck
  wreckLabels: LevelDef['wreckLabels']
}

export function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** What the LED display reads. `flash` is a short-lived message like "PL 7". `idleText` defaults to READY. */
export function displayText({ status, endsAt, error, wreck, wreckLabels }: DisplayState, flash = '', idleText = 'READY') {
  return wreck === 'exploded' ? '' // fried
    : wreck === 'critical' ? wreckLabels.critical
    : wreck === 'overloading' ? wreckLabels.overloading
    : flash ? flash
    : status === 'playing' ? formatTime(endsAt - Date.now())
    : status === 'loading' ? 'COOK'
    : error ? 'Err'
    : idleText
}

export function isPulsing({ status, wreck }: DisplayState, flash = '') {
  return (status === 'loading' && !flash) || wreck === 'overloading' || wreck === 'critical'
}

/** Re-renders a few times a second while playing, so a countdown ticks. */
export function useTick(status: Status) {
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
    <span className={`font-dseg text-lg text-[#4dff88] [text-shadow:0_0_6px_#4dff88aa] ${isPulsing(props) ? 'animate-pulse' : ''}`}>
      {displayText(props)}
    </span>
  )
}

/** The hazard-striped DO NOT PRESS button every level has. */
export function DoNotPress({ onPress, className = '' }: { onPress: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`touch-manipulation rounded-sm bg-[repeating-linear-gradient(-45deg,#e8b400_0_10px,#151515_10px_20px)] p-[3px] shadow-[0_2px_0_#000] active:translate-y-px disabled:opacity-40 ${className}`}
    >
      <span className="flex h-full items-center justify-center rounded-[2px] bg-[#151515] px-2 text-[10px] font-extrabold tracking-[0.25em] text-[#e8b400]">
        DO NOT PRESS
      </span>
    </button>
  )
}
