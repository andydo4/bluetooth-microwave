// Progression UI: the level badge + picker, and the damage-bill receipt shown after an explosion.
import type { LevelDef } from '../levels/types'

export function formatBill(level: LevelDef) {
  return level.billText ?? formatMoney(level.bill)
}

export function formatMoney(amount: number) {
  return Number.isFinite(amount) ? `$${amount.toLocaleString('en-US')}` : '$∞'
}

/** Top-left: which level you're on. Opens the picker. */
export function LevelBadge({ index, level, disabled, onOpen }: { index: number; level: LevelDef; disabled: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      disabled={disabled}
      className="absolute left-4 top-4 z-10 flex touch-manipulation items-center gap-2 rounded-full border border-white/10 bg-[#141418]/90 px-4 py-2 text-xs font-bold tracking-[0.12em] text-zinc-200 shadow-[0_4px_16px_#0008] disabled:opacity-40"
    >
      <span className="text-zinc-500">LV {index + 1}</span>
      <span>{level.name.toUpperCase()}</span>
      <span className="text-zinc-500">▾</span>
    </button>
  )
}

/** Pick any unlocked level. Locked ones show as ??? so the next thing stays a surprise. */
export function LevelPicker({
  levels,
  current,
  unlocked,
  onPick,
  onClose,
}: {
  levels: LevelDef[]
  current: number
  unlocked: number
  onPick: (index: number) => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141418] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-[0.2em] text-zinc-200">LEVELS</h2>
          <button onClick={onClose} className="touch-manipulation px-2 text-lg text-zinc-400" aria-label="Close">
            ×
          </button>
        </div>
        <ol className="flex flex-col gap-1.5">
          {levels.map((level, i) => {
            const open = i < unlocked
            return (
              <li key={level.id}>
                <button
                  disabled={!open}
                  onClick={() => onPick(i)}
                  className={`flex w-full touch-manipulation items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed ${
                    i === current ? 'border-[#4dff88]/50 bg-[#4dff88]/10 text-zinc-100' : 'border-white/5 bg-white/5 text-zinc-300'
                  } ${open ? '' : 'opacity-50'}`}
                >
                  <span>
                    <span className="mr-2 text-zinc-500">{i + 1}</span>
                    {open ? level.name : '???'}
                  </span>
                  <span className="text-xs text-zinc-500">{i === current ? 'HERE' : open ? formatBill(level) : '🔒'}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-center text-xs text-zinc-500">Blow one up to unlock the next. More levels coming soon.</p>
      </div>
    </div>
  )
}

/** After an explosion: the itemized damage bill, then Buy new / Upgrade. */
export function Receipt({
  level,
  total,
  next,
  onBuyNew,
  onUpgrade,
}: {
  level: LevelDef
  total: number
  next: LevelDef | null
  onBuyNew: () => void
  onUpgrade: () => void
}) {
  return (
    <div className="absolute bottom-24 left-1/2 z-10 w-[min(320px,calc(100%-2rem))] -translate-x-1/2">
      <div className="rounded-t-sm bg-[#f4f1ea] px-5 pb-4 pt-4 font-mono text-[13px] text-zinc-800 shadow-[0_8px_30px_#000a]">
        <p className="text-center text-xs font-bold tracking-[0.3em]">DAMAGE BILL</p>
        <p className="mb-3 text-center text-[10px] text-zinc-500">*** THANK YOU FOR YOUR BUSINESS ***</p>
        <Line left={level.name} right={formatBill(level)} />
        <div className="my-2 border-t border-dashed border-zinc-400" />
        <Line left="TOTAL DAMAGES" right={formatMoney(total)} bold />
      </div>
      {/* Torn paper edge */}
      <div className="h-2 bg-[linear-gradient(-45deg,transparent_6px,#f4f1ea_0),linear-gradient(45deg,transparent_6px,#f4f1ea_0)] bg-[length:12px_8px] bg-repeat-x" />

      <div className="mt-3 flex flex-col gap-2">
        {next ? (
          <button
            onClick={onUpgrade}
            className="touch-manipulation rounded-full bg-[#4dff88] px-5 py-3 text-sm font-extrabold tracking-wide text-zinc-900 shadow-[0_4px_0_#1c7a3e] active:translate-y-px"
          >
            Upgrade → {next.name}
          </button>
        ) : (
          <p className="rounded-full bg-white/5 px-5 py-3 text-center text-xs font-bold tracking-wide text-zinc-400">
            More levels coming soon
          </p>
        )}
        <button
          onClick={onBuyNew}
          className="touch-manipulation rounded-full bg-zinc-100 px-5 py-3 text-sm font-extrabold tracking-wide text-zinc-900 shadow-[0_4px_0_#71717a] active:translate-y-px"
        >
          Buy new {level.name.toLowerCase()} · {formatBill(level)}
        </button>
      </div>
    </div>
  )
}

function Line({ left, right, bold = false }: { left: string; right: string; bold?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${bold ? 'font-bold' : ''}`}>
      <span>{left}</span>
      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-zinc-400" />
      <span>{right}</span>
    </div>
  )
}
