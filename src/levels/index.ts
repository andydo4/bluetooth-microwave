// The levels, in order. Each explosion unlocks the next one. See docs/LEVELS.md for the full plan.
import type { LevelDef } from './types'
import { microwave } from './microwave'
import { washer } from './washer'

export const LEVELS: LevelDef[] = [microwave, washer]

/** The next level after `index`, or null at the end of the built levels. */
export function nextLevel(index: number): number | null {
  return index + 1 < LEVELS.length ? index + 1 : null
}
