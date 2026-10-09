import type { LevelDef } from '../types'
import Controls from './Controls'
import Model from './Model'
import { WRECK_LABELS } from './labels'
import { washerSound } from './sound'

export const washer: LevelDef = {
  id: 'washer',
  name: 'Washing machine',
  bill: 649,
  Model,
  Controls,
  sound: washerSound,
  wreckLabels: WRECK_LABELS,
  frame: { halfWidth: 4.2, halfHeight: 3.8, groundY: -2.42 },
}
