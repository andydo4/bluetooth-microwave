// Microwave dimensions, shared by the intact model (Microwave.tsx) and its debris (Mayhem.tsx).
// Units: 5 wide, 3 tall, 3.4 deep (front face at z = 1.7), centered on the origin.
// Cooking cavity on the left (x -2.4..1.2), control panel on the right (x 1.25..2.5).

export const CAVITY = { x: -0.6, w: 3.6, h: 2.8, d: 3.2 }
export const DOOR = { x: -0.625, w: 3.75, z: 1.74 }
export const FLOOR_Y = -CAVITY.h / 2 // cavity floor
export const GROUND_Y = -1.6 // where the microwave's feet (and debris) rest
export const TURNTABLE_Y = FLOOR_Y + 0.08
export const SPEAKER_CENTER: [number, number, number] = [CAVITY.x, TURNTABLE_Y + 0.43, 0]

export const METAL = { color: '#c4c8ce', metalness: 0.5, roughness: 0.3 }
export const BLACK = { color: '#1a1a1e', roughness: 0.35 }
