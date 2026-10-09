// Car parts used both by the intact car (Model.tsx) and its debris (effects.tsx).
// All in the car's own frame (see dims.ts): x along the length, nose at -x, y up from the ground.
import { useMemo } from 'react'
import * as THREE from 'three'
import {
  ARCH_R, BODY, CHAR, CHROME, HALF_W, HATCH_LEN, INNER_W, LIP_Y, PAINT, PLATE, ROOF_Y, RUBBER, SILL_Y, TRIM, WHEEL,
} from './dims'

// The side windows, as outlines inside the side profile.
const FRONT_WINDOW: [number, number][] = [[-1.28, 1.52], [-0.52, 2.15], [0.6, 2.15], [0.6, 1.52]]
const REAR_WINDOW: [number, number][] = [[0.78, 1.52], [0.78, 2.15], [2.5, 2.15], [2.66, 1.52]]

function polygon(points: [number, number][], target: THREE.Path) {
  target.moveTo(...points[0])
  points.slice(1).forEach((p) => target.lineTo(...p))
  target.closePath()
  return target
}

/** The car's side silhouette: chunky hatchback with two wheel arches. Optionally with window holes. */
function sideProfile(windows: boolean) {
  const s = new THREE.Shape()
  const a = Math.asin((WHEEL.r - SILL_Y) / ARCH_R) // where each arch meets the sill line
  s.moveTo(-2.95, SILL_Y)
  s.lineTo(-WHEEL.x - ARCH_R * Math.cos(a), SILL_Y)
  s.absarc(-WHEEL.x, WHEEL.r, ARCH_R, Math.PI + a, -a, true)
  s.lineTo(WHEEL.x - ARCH_R * Math.cos(a), SILL_Y)
  s.absarc(WHEEL.x, WHEEL.r, ARCH_R, Math.PI + a, -a, true)
  s.lineTo(2.9, SILL_Y)
  s.lineTo(2.9, LIP_Y) // the side panel's rear edge frames the open hatch from here up
  s.lineTo(2.74, 2.15)
  s.lineTo(2.58, ROOF_Y)
  s.lineTo(-0.45, ROOF_Y)
  s.lineTo(-1.5, 1.42) // windshield
  s.lineTo(-2.7, 1.25) // hood
  s.lineTo(-2.95, 0.95) // nose
  s.closePath()
  if (windows) s.holes.push(polygon(FRONT_WINDOW, new THREE.Path()), polygon(REAR_WINDOW, new THREE.Path()))
  return s
}

/** A side panel (with window holes), extruded BODY.panel thick; its outer face is at z = 0, inner at -panel. */
export function useSidePanel() {
  return useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(sideProfile(true), { depth: BODY.panel, bevelEnabled: false, curveSegments: 24 })
    geo.translate(0, 0, -BODY.panel)
    return geo
  }, [])
}

/** The burnt-out body after the blast: the whole silhouette, full width, windows gone. Centered on z = 0. */
export function useShell() {
  return useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(sideProfile(true), { depth: BODY.w - 0.1, bevelEnabled: false, curveSegments: 24 })
    geo.translate(0, 0, -(BODY.w - 0.1) / 2)
    return geo
  }, [])
}

// Nose + hood as one solid wedge between the side panels (it clears the front wheels' tops).
function useNose() {
  return useMemo(() => {
    const s = polygon([[-2.94, 0.4], [-2.5, 0.4], [-2.5, 1.14], [-1.52, 1.2], [-1.52, 1.415], [-2.7, 1.245], [-2.94, 0.95]], new THREE.Shape()) as THREE.Shape
    const geo = new THREE.ExtrudeGeometry(s, { depth: INNER_W, bevelEnabled: false })
    geo.translate(0, 0, -INNER_W / 2)
    return geo
  }, [])
}

/** A pane of tinted glass filling a window outline. Transparent: drawn late, doesn't write depth. */
function Pane({ points, z }: { points: [number, number][]; z: number }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(polygon(points, new THREE.Shape()) as THREE.Shape), [points])
  return (
    <mesh geometry={geo} position-z={z} renderOrder={2}>
      <meshStandardMaterial color="#1d2f3a" transparent opacity={0.5} roughness={0.05} metalness={0.3} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** All the car's glass (so the model can rattle it as one). */
export function Glass() {
  const mid = HALF_W - BODY.panel / 2 // in the middle of the panel's thickness: no face to fight with
  const shield = Math.hypot(1.05, 0.85)
  return (
    <group>
      <Pane points={FRONT_WINDOW} z={mid} />
      <Pane points={REAR_WINDOW} z={mid} />
      <Pane points={FRONT_WINDOW} z={-mid} />
      <Pane points={REAR_WINDOW} z={-mid} />
      {/* Windshield, lying along the A-pillar line */}
      <group position={[-0.975, 1.845, 0]} rotation-z={Math.atan2(0.85, 1.05)}>
        <mesh rotation-x={-Math.PI / 2} renderOrder={2}>
          <planeGeometry args={[shield, INNER_W]} />
          <meshStandardMaterial color="#1d2f3a" transparent opacity={0.45} roughness={0.05} metalness={0.3} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

/** The painted body shell: side panels, nose/hood, roof, tail, bumpers, trim. Lights are separate. */
export function Body() {
  const side = useSidePanel()
  const nose = useNose()
  return (
    <group>
      <mesh geometry={side} position-z={HALF_W}>
        <meshStandardMaterial {...PAINT} />
      </mesh>
      <mesh geometry={side} position-z={-HALF_W + BODY.panel}>
        <meshStandardMaterial {...PAINT} />
      </mesh>
      <mesh geometry={nose}>
        <meshStandardMaterial {...PAINT} />
      </mesh>
      {/* Roof: a touch wider than the body so it caps the side panels' top edges */}
      <mesh position={[(-0.42 + 2.55) / 2, ROOF_Y - 0.02, 0]}>
        <boxGeometry args={[2.97, 0.1, BODY.w + 0.04]} />
        <meshStandardMaterial {...PAINT} />
      </mesh>
      {/* Tail panel under the hatch opening */}
      <mesh position={[2.85, (0.4 + LIP_Y) / 2, 0]}>
        <boxGeometry args={[0.1, LIP_Y - 0.4, INNER_W]} />
        <meshStandardMaterial {...PAINT} />
      </mesh>
      {/* Bumpers */}
      <mesh position={[2.94, 0.58, 0]}>
        <boxGeometry args={[0.16, 0.32, BODY.w + 0.06]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      <mesh position={[-2.96, 0.58, 0]}>
        <boxGeometry args={[0.16, 0.32, BODY.w + 0.06]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      {/* Grille */}
      <mesh position={[-2.945, 0.84, 0]}>
        <boxGeometry args={[0.02, 0.14, 1.0]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      {/* Side skirts, door seams, handles, mirrors */}
      {[1, -1].map((side) => (
        <group key={side} scale-z={side}>
          <mesh position={[0, SILL_Y + 0.06, HALF_W + 0.025]}>
            <boxGeometry args={[2.3, 0.12, 0.04]} />
            <meshStandardMaterial {...TRIM} />
          </mesh>
          {[-1.36, 0.69].map((x) => (
            <mesh key={x} position={[x, 1.0, HALF_W + 0.004]}>
              <boxGeometry args={[0.02, 1.0, 0.01]} />
              <meshStandardMaterial color="#5c1a14" roughness={0.6} />
            </mesh>
          ))}
          {[-0.2, 1.55].map((x) => (
            <mesh key={x} position={[x, 1.35, HALF_W + 0.025]}>
              <boxGeometry args={[0.28, 0.06, 0.04]} />
              <meshStandardMaterial {...CHROME} />
            </mesh>
          ))}
          <mesh position={[-1.32, 1.6, HALF_W + 0.12]}>
            <boxGeometry args={[0.16, 0.18, 0.24]} />
            <meshStandardMaterial {...PAINT} />
          </mesh>
        </group>
      ))}
      {/* Exhaust pipe */}
      <mesh position={[3.0, 0.42, -0.75]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 16]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  )
}

/** Inside: floor, seats, dashboard, the rear seat back, and the carpeted cargo floor. */
export function Interior({ carpet }: { carpet: THREE.Texture }) {
  const lin = INNER_W / 2 - 0.02
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[2.4, 0.1, INNER_W]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      {/* Dashboard + steering wheel */}
      <mesh position={[-1.3, 1.3, 0]}>
        <boxGeometry args={[0.4, 0.3, INNER_W - 0.02]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      <mesh position={[-0.95, 1.5, 0.55]} rotation-y={Math.PI / 2} rotation-x={0.4}>
        <torusGeometry args={[0.18, 0.03, 8, 24]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      {/* Front seats */}
      {[0.55, -0.55].map((z) => (
        <group key={z} position={[-0.25, 0, z]}>
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.6, 0.18, 0.7]} />
            <meshStandardMaterial color="#2a2b30" roughness={0.9} />
          </mesh>
          <mesh position={[0.32, 1.25, 0]} rotation-z={0.15}>
            <boxGeometry args={[0.16, 0.85, 0.66]} />
            <meshStandardMaterial color="#2a2b30" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Rear bench back: the wall between the cabin and the cargo area */}
      <mesh position={[1.07, 1.55, 0]}>
        <boxGeometry args={[0.16, 0.9, INNER_W - 0.02]} />
        <meshStandardMaterial color="#2a2b30" roughness={0.9} />
      </mesh>
      {/* Cargo floor + side trims, carpeted */}
      <mesh position={[(1.15 + 2.8) / 2, 1.06, 0]}>
        <boxGeometry args={[1.65, 0.08, INNER_W - 0.02]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      {[lin, -lin].map((z) => (
        <mesh key={z} position={[(1.15 + 2.8) / 2, 1.33, z]}>
          <boxGeometry args={[1.65, 0.46, 0.02]} />
          <meshStandardMaterial map={carpet} roughness={1} />
        </mesh>
      ))}
      {/* Wheel wells: dark liners so the arches don't show the empty body */}
      {[-WHEEL.x, WHEEL.x].flatMap((x) =>
        [0.78, -0.78].map((z) => (
          <mesh key={`${x},${z}`} position={[x, 0.7, z]}>
            <boxGeometry args={[1.3, 0.6, 0.06]} />
            <meshStandardMaterial color="#0b0b0c" roughness={1} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** One wheel: tire, chrome five-spoke rim, both sides alike. Axis along z, centered. */
export function Wheel() {
  const face = WHEEL.w / 2 + 0.012
  return (
    <group>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[WHEEL.r, WHEEL.r, WHEEL.w, 32]} />
        <meshStandardMaterial {...RUBBER} />
      </mesh>
      {[face, -face].map((z) => (
        <group key={z} position-z={z} scale-z={Math.sign(z)}>
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.31, 0.31, 0.02, 28]} />
            <meshStandardMaterial color="#45484d" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position-z={0.012}>
            <torusGeometry args={[0.3, 0.025, 8, 28]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <group key={i} rotation-z={(i * Math.PI * 2) / 5}>
              <mesh position={[0, 0.15, 0.02]}>
                <boxGeometry args={[0.08, 0.3, 0.03]} />
                <meshStandardMaterial {...CHROME} />
              </mesh>
            </group>
          ))}
          <mesh position-z={0.03} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// A license plate with a joke on it (no state, no brand).
let plate: THREE.Texture | null = null
function plateTexture() {
  if (plate) return plate
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 48
  const g = canvas.getContext('2d')!
  g.fillStyle = '#f2f0e6'
  g.fillRect(0, 0, 128, 48)
  g.strokeStyle = '#26262b'
  g.lineWidth = 3
  g.strokeRect(3, 3, 122, 42)
  g.fillStyle = '#26262b'
  g.font = 'bold 30px monospace'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('B4SS', 64, 26)
  plate = new THREE.CanvasTexture(canvas)
  plate.colorSpace = THREE.SRGBColorSpace
  return plate
}

/**
 * The hatch lid, hinged at its origin, lying along +x with its outside face up (+y).
 * `tail` is the material for its brake-light strip (the model makes it glow).
 */
export function Hatch({ tail }: { tail?: THREE.Material }) {
  const tex = useMemo(() => plateTexture(), [])
  return (
    <group>
      <mesh position-x={HATCH_LEN / 2}>
        <boxGeometry args={[HATCH_LEN, 0.07, BODY.w - 0.02]} />
        <meshStandardMaterial {...PAINT} />
      </mesh>
      {/* Rear window (dark glass on the lid), spoiler, plate, inner trim */}
      <mesh position={[0.45, 0.04, 0]}>
        <boxGeometry args={[0.66, 0.012, BODY.w - 0.4]} />
        <meshStandardMaterial color="#121a20" roughness={0.05} metalness={0.5} />
      </mesh>
      <mesh position={[0.06, 0.09, 0]}>
        <boxGeometry args={[0.2, 0.08, BODY.w + 0.04]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      <mesh position={[0.98, 0.037, 0]} rotation-x={-Math.PI / 2} rotation-z={-Math.PI / 2}>
        <planeGeometry args={[0.6, 0.22]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
      <mesh position={[HATCH_LEN / 2, -0.045, 0]}>
        <boxGeometry args={[HATCH_LEN - 0.12, 0.02, BODY.w - 0.3]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      {tail ? (
        <mesh position={[HATCH_LEN - 0.04, 0.03, 0]} material={tail}>
          <boxGeometry args={[0.06, 0.06, BODY.w - 0.5]} />
        </mesh>
      ) : (
        <mesh position={[HATCH_LEN - 0.04, 0.03, 0]}>
          <boxGeometry args={[0.06, 0.06, BODY.w - 0.5]} />
          <meshStandardMaterial color="#5a0c0c" />
        </mesh>
      )}
    </group>
  )
}

/** A door as a loose panel (debris): painted skin, window frame and a handle. Outside faces +z. */
export function DoorPanel() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.95, 1.05, 0.08]} />
        <meshStandardMaterial {...PAINT} />
      </mesh>
      <mesh position={[0.1, 0.85, 0]}>
        <boxGeometry args={[1.6, 0.66, 0.06]} />
        <meshStandardMaterial color="#1d2f3a" transparent opacity={0.6} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0.1, 1.2, 0]}>
        <boxGeometry args={[1.7, 0.05, 0.07]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      <mesh position={[0.5, 0.2, 0.05]}>
        <boxGeometry args={[0.28, 0.06, 0.04]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  )
}

/** The hood as a loose panel (debris). */
export function HoodPanel() {
  return (
    <mesh>
      <boxGeometry args={[1.25, 0.08, INNER_W]} />
      <meshStandardMaterial {...PAINT} />
    </mesh>
  )
}

/** The charred body left after the fireball. Centered on z = 0, sitting on y = 0. */
export function CharredShell() {
  const geo = useShell()
  return (
    <group>
      <mesh geometry={geo} position-y={-SILL_Y + 0.03}>
        <meshStandardMaterial {...CHAR} />
      </mesh>
      {/* Glowing embers along the sills */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, 0.08, s * (BODY.w / 2 - 0.04)]}>
          <boxGeometry args={[2.0, 0.04, 0.01]} />
          <meshStandardMaterial color="#ff5a1a" emissive="#ff4a0a" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The head-unit show stand (desktop): a disc base, a chrome post and a tilted dashboard plate. The
// HTML controls go on the plate's face, at z = PLATE.d / 2.

export function StandBase() {
  return (
    <group>
      <mesh position-y={0.04}>
        <cylinderGeometry args={[0.75, 0.8, 0.08, 40]} />
        <meshStandardMaterial {...TRIM} />
      </mesh>
      <mesh position-y={(0.08 + PLATE.y - PLATE.h / 2 + 0.1) / 2}>
        <cylinderGeometry args={[0.08, 0.08, PLATE.y - PLATE.h / 2 + 0.02, 16]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  )
}

export function DashPlate() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[PLATE.w, PLATE.h, PLATE.d]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* Chrome rim peeking out round the edge */}
      <mesh position-z={-0.03}>
        <boxGeometry args={[PLATE.w + 0.08, PLATE.h + 0.08, PLATE.d - 0.04]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      {/* Air vents along the top, like a dashboard */}
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, PLATE.h / 2 - 0.12, PLATE.d / 2 + 0.006]}>
          <boxGeometry args={[0.55, 0.1, 0.012]} />
          <meshStandardMaterial color="#08090a" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}
