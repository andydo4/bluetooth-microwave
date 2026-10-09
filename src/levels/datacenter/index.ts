import type { LevelDef } from '../types'
import Controls from './Controls'
import Model from './Model'
import { WRECK_LABELS } from './labels'
import { datacenterSound } from './sound'
import { FLOOR_Y } from './dims'

export const datacenter: LevelDef = {
  id: 'datacenter',
  name: 'Data center',
  bill: 250000000,
  Model,
  Controls,
  sound: datacenterSound,
  wreckLabels: WRECK_LABELS,
  frame: { halfWidth: 5.0, halfHeight: 4.6, groundY: FLOOR_Y },
}
