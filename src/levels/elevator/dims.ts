// Elevator dimensions (world units), shared by the model and its debris.
// A cut-away slice of a lift shaft: the car hangs in it (left), a lobby wall stands beside its doors
// (right) carrying the brass control plate. The ground is the bottom of the pit.

export const GROUND_Y = -3.3

// The car: centered at (x, y, z). Its bottom hangs 0.55 above the pit floor, over two spring buffers.
export const CAR = { w: 3.6, h: 4.3, d: 3.2, x: -1.4, y: -0.6, z: -0.4 }
export const CAR_FRONT_Z = CAR.z + CAR.d / 2 // 1.2
export const CAR_TOP = CAR.y + CAR.h / 2 // 1.55
export const LINING_INSET = 0.06 // the warm interior lining sits this far inside the steel shell
/** The car's interior floor, in car-local coordinates. */
export const FLOOR_LOCAL = -CAR.h / 2 + LINING_INSET

// The doorway in the car's front plate (car-local, centered in x), and the two sliding doors.
export const OPENING = { w: 1.8, h: 3.3, bottom: FLOOR_LOCAL }
export const DOOR = { w: 0.92, h: OPENING.h + 0.04, travel: 0.88, z: 0.035 } // z: in front of the plate
export const INDICATOR_Y = OPENING.bottom + OPENING.h + 0.42 // floor indicator above the doors

// Guide rails either side of the car, running the full height of the shaft.
export const RAIL_X = [CAR.x - CAR.w / 2 - 0.2, CAR.x + CAR.w / 2 + 0.2] as const
export const SHAFT_TOP = 3.75
export const BACK_WALL = { x: -1.5, w: 4.5, z: -2.25, d: 0.14 }

// Hoist machine on the beams at the top: the cables run up from the car to the sheave's front edge.
export const SHEAVE = { r: 0.45, y: 3.49, z: CAR.z - 0.45 }
export const CABLE_X = [-0.18, -0.06, 0.06, 0.18].map((dx) => CAR.x + dx)

// The lobby wall beside the doors, and the brass control plate on it. The desktop panel is
// 500 × 720 CSS px = 2.5 × 3.6 units (200 px per unit at distanceFactor 2).
export const WALL = { x: 2.3, w: 3.0, h: 5.7, z: 1.1, d: 0.6 }
export const WALL_FRONT_Z = WALL.z + WALL.d / 2 // 1.4
export const PLATE = { x: WALL.x, y: -0.55, w: 2.62, h: 3.72, d: 0.04 }
export const PLATE_FRONT_Z = WALL_FRONT_Z + PLATE.d
export const LAMP_Y = PLATE.y + PLATE.h / 2 + 0.33 // red alarm lamp above the plate

// The overload's critical stage drops the car in jolts onto the buffers (seconds after critical starts).
// sound.ts plays a thud at each one.
export const JOLTS = [0, 0.8, 1.9]
export const JOLT_DROP = 0.08

export const STEEL = { color: '#eef0f3', roughness: 0.3, metalness: 0.55 }
export const DARK_STEEL = { color: '#5d6268', roughness: 0.45, metalness: 0.8 }
export const BRASS = { color: '#dcb860', roughness: 0.32, metalness: 0.55 }
export const SAFETY_YELLOW = { color: '#e8b400', roughness: 0.6, metalness: 0.1 }
