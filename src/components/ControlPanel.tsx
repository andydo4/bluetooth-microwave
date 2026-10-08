import { useEffect, useState, type FormEvent } from 'react'
import type { Status } from '../App'

type Props = {
  status: Status
  endsAt: number
  error: string
  onStart: (url: string) => void
  onStop: () => void
}

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Rendered as HTML on the microwave's control panel (see Microwave.tsx).
export default function ControlPanel({ status, endsAt, error, onStart, onStop }: Props) {
  const [url, setUrl] = useState('')
  const [, rerender] = useState(0)

  // Re-render a few times a second so the countdown ticks.
  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(() => rerender((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [status])

  const display =
    status === 'playing' ? formatTime(endsAt - Date.now())
    : status === 'loading' ? 'COOK'
    : error ? 'Err'
    : 'READY'

  function submit(e: FormEvent) {
    e.preventDefault()
    if (url.trim()) onStart(url.trim())
  }

  return (
    <form onSubmit={submit} className="flex w-[200px] select-none flex-col gap-4 rounded bg-[#111114] p-2 font-mono">
      <div
        className={`rounded border border-black bg-[#0b1a10] px-3 py-3 text-right text-4xl tracking-widest text-[#4dff88] [text-shadow:0_0_8px_#4dff88] ${
          status === 'loading' ? 'animate-pulse' : ''
        }`}
      >
        {display}
      </div>

      <label className="text-[11px] uppercase tracking-[0.2em] text-zinc-400" htmlFor="yt-url">
        YouTube link
      </label>
      <input
        id="yt-url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={status !== 'idle'}
        placeholder="https://youtu.be/…"
        className="rounded border border-zinc-600 bg-zinc-900 px-2 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#4dff88] disabled:opacity-50"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          disabled={status !== 'idle'}
          className="rounded bg-zinc-200 py-3 text-sm font-bold text-zinc-900 shadow-[0_3px_0_#71717a] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
        >
          START
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={status === 'idle'}
          className="rounded bg-red-500 py-3 text-sm font-bold text-white shadow-[0_3px_0_#7f1d1d] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
        >
          STOP
        </button>
      </div>

      {error && <p className="text-xs leading-snug text-red-400">{error}</p>}
    </form>
  )
}
