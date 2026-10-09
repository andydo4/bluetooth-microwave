// Washing machine dimensions (world units), shared by the model and its debris.
// Body 4.2 wide × 4.6 tall × 4.0 deep, centered on the origin; front face at z = 2.0.
// Control console across the top front; the porthole door below it.

export const BODY = { w: 4.2, h: 4.6, d: 4.0 }
export const FRONT_Z = BODY.d / 2
export const CONSOLE = { h: 1.0, y: BODY.h / 2 - 0.5, d: 0.125, z: FRONT_Z + 0.0625 } // box in front of the shell
export const PORT = { x: 0, y: -0.4, r: 1.35 } // the round opening into the drum
export const DRUM = { r: PORT.r - 0.05, depth: 3.2, z: FRONT_Z - 1.6 - 0.03 } // z = drum center
export const DOOR_Z = FRONT_Z + 0.12
export const GROUND_Y = -BODY.h / 2 - 0.12 // bottom of the feet

// The boombox resting in the bottom of the drum: its corners touch the drum wall.
export const BOOMBOX_REST = { y: PORT.y - 0.65, z: 1.0 }

export const ENAMEL = { color: '#e9ebee', roughness: 0.35, metalness: 0.05 }
export const CHROME = { color: '#d9dde2', roughness: 0.15, metalness: 0.9 }
export const RUBBER = { color: '#2b2d31', roughness: 0.8, metalness: 0 }
