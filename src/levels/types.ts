// What every level provides. See docs/LEVELS.md for the plan and src/levels/microwave for a full example.
import type { ComponentType, ReactNode, RefObject } from 'react'
import type { LevelSound } from '../audio/engine'

export type Status = 'idle' | 'loading' | 'playing'
/** What to play: a pasted YouTube link, or one of the level's 4 preset buttons. */
export type Source = { url: string } | { preset: PresetKey }
/** The 4 songs (server/index.ts PRESETS). Each level labels them its own way. */
export type PresetKey = 'popcorn' | 'defrost' | 'reheat' | 'beverage'
/** DO NOT PRESS: overloading (0–3 s) → critical (3–6.5 s) → exploded (until you buy a new one or upgrade). */
export type Wreck = 'none' | 'overloading' | 'critical' | 'exploded'
/** Level change animation: camera pulls out from the old level, then in on the new one. */
export type Transition = 'idle' | 'out' | 'in'

/** Props for a level's 3D model (intact machine, overload effects, explosion). */
export type ModelProps = {
  on: boolean
  wreck: Wreck
  /** Pulling out to change level: the surviving speaker glows ("levels up"). */
  transition: Transition
  /** Desktop: the themed controls to mount on the machine's face. Phones: null (shown in a sheet). */
  panel: ReactNode
  /** Stable DOM node for drei <Html portal>; see the gotcha in docs/ARCHITECTURE.md. */
  overlay: RefObject<HTMLDivElement>
}

/** Props for a level's themed controls. Same contract for every level. */
export type ControlsProps = {
  status: Status
  endsAt: number
  error: string
  /** 1–10; how muffled the speaker sounds (10 = fully sealed in). */
  power: number
  wreck: Wreck
  onStart: (source: Source) => void
  onStop: () => void
  onPower: (level: number) => void
  onOverload: () => void
}

export type LevelDef = {
  id: string
  /** Display name, e.g. "Microwave". */
  name: string
  /** Damage bill in dollars when it blows up (Infinity allowed). */
  bill: number
  /** Optional bill text instead of dollars, e.g. "1 planet". */
  billText?: string
  Model: ComponentType<ModelProps>
  Controls: ComponentType<ControlsProps>
  sound: LevelSound
  /** What the LED readout shows during the overload stages, e.g. HOT / FIRE. */
  wreckLabels: { overloading: string; critical: string }
  /** Camera framing: half the width/height (world units) that must fit on screen, and where the floor is. */
  frame: { halfWidth: number; halfHeight: number; groundY: number }
}
