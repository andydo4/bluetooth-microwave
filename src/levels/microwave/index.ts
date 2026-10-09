import type { LevelDef } from '../types'
import Controls from './Controls'
import Model from './Model'
import { WRECK_LABELS } from './labels'
import { microwaveSound } from './sound'

export const microwave: LevelDef = {
  id: 'microwave',
  name: 'Microwave',
  bill: 89,
  Model,
  Controls,
  sound: microwaveSound,
  wreckLabels: WRECK_LABELS,
  frame: { halfWidth: 4.4, halfHeight: 2.6, groundY: -1.62 },
}
