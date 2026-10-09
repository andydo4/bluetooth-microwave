// Car dimensions (world units), shared by the model and its debris.
// The car is modelled in its own frame: x along its length (nose at -x, open hatch at +x), y up from
// the ground (y = 0), z across its width. Model.tsx then places it on the floor and turns it so the
// open hatch faces the camera at an angle (rear three-quarter view). The head unit sits on a show
// stand to its left.

export const GROUND_Y = -1.55

// Where the car sits in the world, and its heading: yaw turns the rear (+x) toward the camera.
export const CAR = { x: 0.85, z: -1.4, yaw: -0.82 }
// The head-unit show stand (desktop: the HTML controls sit on its face).
export const STAND = { x: -3.35, z: 2.0, yaw: 0.36 }
// Phones (controls in the bottom sheet, portrait screen): no stand; the car alone is centred and scaled
// up about the floor under the origin so it fills the width.
export const COMPACT = { scale: 1.6, car: { x: -0.34, z: -0.37 } }
// The stand's dash plate: centre height above the floor, size, and its backward tilt.
export const PLATE = { y: 1.75, w: 3.3, h: 1.75, d: 0.16, tilt: -0.14 }

export const BODY = { len: 5.8, w: 2.6, panel: 0.08 }
export const HALF_W = BODY.w / 2
export const INNER_W = BODY.w - 2 * BODY.panel - 0.02 // pieces between the side panels (never touching them)

export const WHEEL = { r: 0.5, w: 0.36, x: 1.85, z: 1.1 }
export const ARCH_R = 0.62
export const SILL_Y = 0.38 // bottom edge of the body

// Cargo area behind the rear seats, open at the back.
export const CARGO = { x0: 1.15, x1: 2.82, floor: 1.1 }
export const LIP_Y = 1.12 // top of the rear bumper/tail panel: the bottom of the hatch opening
export const ROOF_Y = 2.27
export const HINGE = { x: 2.56, y: ROOF_Y + 0.01 }
export const HATCH_LEN = 1.2
export const HATCH_OPEN = 0.78 // rad above horizontal, pointing back

// The subwoofer box: faces +z in its own frame; in the car it's turned to face out the hatch (+x).
export const SUB = { w: 2.1, h: 0.8, d: 0.7 }
export const SUB_POS = { x: 2.38, y: CARGO.floor + SUB.h / 2 + 0.005 }

export const PAINT = { color: '#d8392b', roughness: 0.28, metalness: 0.35 }
export const TRIM = { color: '#17181b', roughness: 0.6, metalness: 0.1 }
export const CHROME = { color: '#d9dde2', roughness: 0.15, metalness: 0.9 }
export const RUBBER = { color: '#1d1e21', roughness: 0.85, metalness: 0 }
export const CHAR = { color: '#1b1714', roughness: 1, metalness: 0 }

/** The thump of the bass: a sharp kick on every beat (120 BPM) that decays quickly, 0–1. */
export function kick(seconds: number, bpm = 120) {
  const phase = (seconds * bpm) / 60 % 1
  return Math.exp(-phase * 7)
}
