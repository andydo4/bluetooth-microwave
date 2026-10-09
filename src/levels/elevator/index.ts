import type { LevelDef } from '../types'
import Controls from './Controls'
import Model from './Model'
import { GROUND_Y } from './dims'
import { WRECK_LABELS } from './labels'
import { elevatorSound } from './sound'

export const elevator: LevelDef = {
  id: 'elevator',
  name: 'Elevator',
  bill: 48000,
  Model,
  Controls,
  sound: elevatorSound,
  wreckLabels: WRECK_LABELS,
  // The shaft spans x -3.75..3.8 (car on the left, lobby wall on the right), y from the pit floor to the sheave.
  frame: { halfWidth: 4.5, halfHeight: 4.8, groundY: GROUND_Y },
}
