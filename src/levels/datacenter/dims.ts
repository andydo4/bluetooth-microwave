// Data center dimensions (world units), shared by the model and its debris.
// A raised floor with two rows of racks facing a cold aisle that runs along z (away from the camera),
// a crash cart with the terminal at the open (+z) end, and the PA speaker wall at the far (-z) end.

export const FLOOR_Y = -2.2 // top of the raised floor tiles
export const FLOOR = { w: 9.6, front: 4.7, back: -5.8, thick: 0.3 } // x span, z extent, slab thickness

export const AISLE_HALF = 1.8 // racks' doors sit at x = ±1.8
export const RACK = { w: 1.0, h: 4.0, d: 1.3 } // w along the row (z), d across it (x)
export const RACK_PITCH = 1.15 // a small gap between neighbours, so their side faces never touch
export const RACK_Z = [2.35, 1.2, 0.05, -1.1] // centers along the row, front to back
export const RACK_X = AISLE_HALF + RACK.d / 2 // rack center distance from the aisle's middle
export const ROW_BACK_Z = RACK_Z[RACK_Z.length - 1] - RACK.w / 2

// Overhead ladder trays above each row, and the cold aisle lights hanging over the aisle.
export const TRAY_Y = FLOOR_Y + RACK.h + 0.45
export const LIGHT_Y = FLOOR_Y + RACK.h + 1.2

// The speaker wall: 3×3 PA cabinets stacked at the end of the aisle, facing the camera. It's a bit
// narrower than the aisle, so you see all of it between the rows (and the last racks fall beside it).
export const CAB = { w: 1.15, h: 1.45, d: 0.9 }
export const WALL = { cols: 3, rows: 3, z: -4.45 } // z = cabinets' center
export const WALL_H = CAB.h * WALL.rows + 0.12 // plus the base riser
export const WALL_FRONT_Z = WALL.z + CAB.d / 2

// The whole aisle is turned to line up with the default camera (which sits off to the right), so
// you look straight down it, slightly from above, at the speaker wall.
export const AIM = Math.atan2(3.2, 8.5) * 0.8

// The crash cart in the aisle mouth, with the terminal monitor facing the camera.
export const CART = { x: 0, z: 3.85, deckY: FLOOR_Y + 1.15 }
export const MONITOR = { w: 3.25, h: 1.72, y: FLOOR_Y + 2.3, z: CART.z + 0.12 } // the bezel; screen is inset
export const SCREEN_Z = MONITOR.z + 0.07 // front face of the bezel; the panel sits just in front

export const RACK_BLACK = { color: '#16181c', roughness: 0.55, metalness: 0.35 }
export const STEEL = { color: '#8b929b', roughness: 0.35, metalness: 0.8 }
export const TRAY_STEEL = { color: '#5f666e', roughness: 0.5, metalness: 0.7 }
