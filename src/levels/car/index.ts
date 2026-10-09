import type { LevelDef } from '../types'
import Controls from './Controls'
import Model from './Model'
import { WRECK_LABELS } from './labels'
import { carSound } from './sound'
import { GROUND_Y } from './dims'

export const car: LevelDef = {
  id: 'car',
  name: 'Car',
  bill: 35000,
  Model,
  Controls,
  sound: carSound,
  wreckLabels: WRECK_LABELS,
  frame: { halfWidth: 6.4, halfHeight: 3.4, groundY: GROUND_Y },
}
