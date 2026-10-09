// Data center parts used both by the working aisle (Model.tsx) and its wreckage (effects.tsx):
// racks with blinking LEDs, the raised floor, cable trays, aisle lights, the crash cart.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  AISLE_HALF, CART, FLOOR, FLOOR_Y, LIGHT_Y, MONITOR, RACK, RACK_BLACK, RACK_X, RACK_Z, STEEL, TRAY_STEEL, TRAY_Y,
} from './dims'

/** How the rack LEDs behave: idle twinkle, busy (music playing), alarm (overload), dead (wrecked). */
export type LedMode = 'idle' | 'busy' | 'alarm' | 'dead'

// ---------------------------------------------------------------------------------------------
// Canvas textures (made once, shared by every rack)

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const UNITS = 14 // servers per rack
const FACE = { w: RACK.w - 0.14, h: 3.6, y: 0.1 } // the server fronts, inside the rack frame (rack-local)

let serverTex: THREE.Texture | null = null
/** Rows of server fronts: drive bays on one side, vent slots on the other. */
function serverTexture() {
  return (serverTex ??= canvasTexture(128, 512, (g) => {
    g.fillStyle = '#08090a'
    g.fillRect(0, 0, 128, 512)
    const unit = 512 / UNITS
    for (let i = 0; i < UNITS; i++) {
      const y = i * unit
      g.fillStyle = ['#23262b', '#2b2f35', '#1c1f23'][i % 3]
      g.fillRect(3, y + 2, 122, unit - 4)
      // Drive bays
      const bays = i % 4 === 1 ? 4 : 6
      for (let b = 0; b < bays; b++) {
        g.fillStyle = '#3b4047'
        g.fillRect(8 + b * 11, y + 6, 9, unit - 12)
        g.fillStyle = '#16181b'
        g.fillRect(9 + b * 11, y + unit / 2 - 1, 7, 2)
      }
      // Vent slots
      g.fillStyle = '#121417'
      for (let s = y + 7; s < y + unit - 6; s += 4) g.fillRect(80, s, 38, 2)
      // Pull handles
      g.fillStyle = '#5b616a'
      g.fillRect(4, y + 5, 2, unit - 10)
      g.fillRect(122, y + 5, 2, unit - 10)
    }
  }))
}

let dotsTex: THREE.Texture | null = null
/** Perforated steel (rack back doors): an alpha map, white = solid. */
function perforatedTexture() {
  if (dotsTex) return dotsTex
  dotsTex = canvasTexture(16, 16, (g) => {
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 16, 16)
    g.fillStyle = '#000'
    g.beginPath()
    g.arc(8, 8, 5, 0, Math.PI * 2)
    g.fill()
  })
  dotsTex.colorSpace = THREE.NoColorSpace
  dotsTex.wrapS = dotsTex.wrapT = THREE.RepeatWrapping
  dotsTex.repeat.set(14, 56)
  return dotsTex
}

let floorTex: THREE.Texture | null = null
/** Raised floor: grey tiles with dark seams; every other row in the aisle is a perforated vent tile. */
export function floorTexture() {
  if (floorTex) return floorTex
  floorTex = canvasTexture(128, 128, (g) => {
    for (let t = 0; t < 4; t++) {
      const x = (t % 2) * 64
      const y = Math.floor(t / 2) * 64
      g.fillStyle = '#b9bec4'
      g.fillRect(x, y, 64, 64)
      g.fillStyle = '#6d737a'
      g.fillRect(x, y, 64, 2)
      g.fillRect(x, y, 2, 64)
      if (t === 1 || t === 2) {
        // Perforated vent tile (cold air comes up through these)
        g.fillStyle = '#7d848c'
        for (let i = 8; i < 60; i += 6) for (let j = 8; j < 60; j += 6) g.fillRect(x + i, y + j, 3, 3)
      }
    }
  })
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(FLOOR.w / 1.2, (FLOOR.front - FLOOR.back) / 1.2) // 0.6-unit tiles
  return floorTex
}

// ---------------------------------------------------------------------------------------------
// LEDs: one instanced mesh of tiny bright dots per rack face, recoloured every frame.

const LEDS_PER_UNIT = 5
const LED_COUNT = UNITS * LEDS_PER_UNIT
const ledGeo = new THREE.BoxGeometry(0.028, 0.022, 0.012)
const COLORS = {
  green: new THREE.Color('#3dff7a').multiplyScalar(1.6),
  blue: new THREE.Color('#4fb8ff').multiplyScalar(1.6),
  amber: new THREE.Color('#ffae1f').multiplyScalar(2),
  red: new THREE.Color('#ff2a1a').multiplyScalar(2),
  off: new THREE.Color('#0b0c0d'),
}

function Leds({ mode, seed }: { mode: LedMode; seed: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null!)
  // Each LED gets a fixed role (activity, link, power...), phase and speed so they don't blink in sync.
  const leds = useMemo(() => {
    let s = seed * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    return Array.from({ length: LED_COUNT }, (_, i) => {
      const unit = Math.floor(i / LEDS_PER_UNIT)
      const k = i % LEDS_PER_UNIT
      const unitH = FACE.h / UNITS
      return {
        x: k < 4 ? -FACE.w / 2 + 0.07 + k * 0.085 : FACE.w / 2 - 0.08,
        y: FACE.y + FACE.h / 2 - (unit + 0.78) * unitH,
        kind: k === 4 ? 'power' : k === 3 ? 'link' : 'activity',
        phase: rnd(),
        speed: 0.6 + rnd() * 2.4,
        duty: 0.3 + rnd() * 0.5,
        dead: rnd() < 0.08, // even in a healthy rack, the odd one is off
      }
    })
  }, [seed])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    leds.forEach((l, i) => {
      mesh.current.setMatrixAt(i, m.makeTranslation(l.x, l.y, 0))
      mesh.current.setColorAt(i, COLORS.off)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [leds])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const flash = Math.floor(t * 6) % 2 === 0 // the alarm's shared flash
    leds.forEach((l, i) => {
      let c = COLORS.off
      const blink = (rate: number) => (t * l.speed * rate + l.phase) % 1 < l.duty
      if (mode === 'dead') {
        c = l.kind === 'power' && l.phase < 0.2 && flash ? COLORS.red : COLORS.off
      } else if (mode === 'alarm') {
        c = (l.phase < 0.5) === flash ? (l.phase < 0.3 ? COLORS.red : COLORS.amber) : COLORS.off
      } else if (l.dead) {
        c = COLORS.off
      } else if (l.kind === 'power') {
        c = COLORS.green
      } else if (l.kind === 'link') {
        c = mode === 'busy' && !blink(5) ? COLORS.off : COLORS.blue
      } else {
        // Disk/network activity: lazy twinkle when idle, frantic while the music plays.
        c = blink(mode === 'busy' ? 9 : 0.8) ? COLORS.green : COLORS.off
      }
      mesh.current.setColorAt(i, c)
    })
    mesh.current.instanceColor!.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[ledGeo, undefined, LED_COUNT]}>
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

// ---------------------------------------------------------------------------------------------
// A rack, centered on its own origin, doors facing +x (its back faces -x).

function DoorFrame({ x }: { x: number }) {
  const w = RACK.w - 0.02
  const h = RACK.h - 0.1
  return (
    <group position-x={x}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * (w / 2 - 0.03)]}>
          <boxGeometry args={[0.03, h, 0.06]} />
          <meshStandardMaterial {...RACK_BLACK} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (h / 2 - 0.04), 0]}>
          <boxGeometry args={[0.03, 0.08, w - 0.12]} />
          <meshStandardMaterial {...RACK_BLACK} />
        </mesh>
      ))}
    </group>
  )
}

export function Rack({ mode, seed }: { mode: LedMode; seed: number }) {
  const front = RACK.d / 2
  return (
    <group>
      <mesh>
        <boxGeometry args={[RACK.d, RACK.h, RACK.w]} />
        <meshStandardMaterial {...RACK_BLACK} />
      </mesh>

      {/* Front: server faces + LEDs behind a tinted glass door */}
      <group position-x={front + 0.008} rotation-y={Math.PI / 2}>
        <mesh position-y={FACE.y}>
          <planeGeometry args={[FACE.w, FACE.h]} />
          <meshStandardMaterial map={serverTexture()} roughness={0.6} metalness={0.3} />
        </mesh>
        <group position-z={0.008}>
          <Leds mode={mode} seed={seed} />
        </group>
      </group>
      <DoorFrame x={front + 0.035} />
      <mesh position-x={front + 0.04} rotation-y={Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[RACK.w - 0.1, RACK.h - 0.2]} />
        <meshStandardMaterial color="#8fb3c9" transparent opacity={0.16} roughness={0.05} metalness={0.4} depthWrite={false} />
      </mesh>
      <mesh position={[front + 0.08, 0.1, RACK.w / 2 - 0.1]}>
        <boxGeometry args={[0.03, 0.5, 0.04]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>

      {/* Back: server rears + LEDs behind a perforated steel door */}
      <group position-x={-front - 0.008} rotation-y={-Math.PI / 2}>
        <mesh position-y={FACE.y}>
          <planeGeometry args={[FACE.w, FACE.h]} />
          <meshStandardMaterial map={serverTexture()} roughness={0.6} metalness={0.3} />
        </mesh>
        <group position-z={0.008}>
          <Leds mode={mode} seed={seed + 50} />
        </group>
      </group>
      <DoorFrame x={-front - 0.035} />
      <mesh position-x={-front - 0.04} rotation-y={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[RACK.w - 0.1, RACK.h - 0.2]} />
        <meshStandardMaterial color="#1b1d21" alphaMap={perforatedTexture()} transparent depthWrite={false} roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Roof fans */}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, RACK.h / 2 + 0.01, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 20]} />
          <meshStandardMaterial color="#2c3036" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/** Where each rack sits (center), its row (-1 left, +1 right) and a stable seed for its LEDs. */
export const RACKS = [-1, 1].flatMap((side) =>
  RACK_Z.map((z, k) => ({ side, k, x: side * RACK_X, z, seed: (side + 2) * 10 + k })),
)

const endCapTex: Record<string, THREE.Texture> = {}
/** The end panel of a row, facing you: vents and a row label (no logos). */
export function EndCap({ label }: { label: string }) {
  const tex = (endCapTex[label] ??= canvasTexture(128, 384, (g) => {
    g.fillStyle = '#1b1d21'
    g.fillRect(0, 0, 128, 384)
    g.fillStyle = '#121316'
    for (let y = 70; y < 360; y += 8) g.fillRect(14, y, 100, 4)
    g.fillStyle = '#2c3036'
    g.fillRect(14, 16, 100, 38)
    g.fillStyle = '#b8c0c8'
    g.font = 'bold 22px monospace'
    g.textAlign = 'center'
    g.fillText(label, 64, 43)
  }))
  return (
    <mesh>
      <planeGeometry args={[RACK.d - 0.08, RACK.h - 0.12]} />
      <meshStandardMaterial map={tex} roughness={0.6} metalness={0.3} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------------------------
// The room

export function RaisedFloor() {
  const len = FLOOR.front - FLOOR.back
  return (
    // A hair below the floor height, so the contact shadow plane never fights with it.
    <mesh position={[0, FLOOR_Y - FLOOR.thick / 2 - 0.01, (FLOOR.front + FLOOR.back) / 2]}>
      <boxGeometry args={[FLOOR.w, FLOOR.thick, len]} />
      <meshStandardMaterial attach="material-0" color="#33373c" />
      <meshStandardMaterial attach="material-1" color="#33373c" />
      <meshStandardMaterial attach="material-2" map={floorTexture()} roughness={0.7} metalness={0.1} />
      <meshStandardMaterial attach="material-3" color="#1a1c1f" />
      <meshStandardMaterial attach="material-4" color="#3b3f45" />
      <meshStandardMaterial attach="material-5" color="#33373c" />
    </mesh>
  )
}

const TRAY_LEN = RACK_Z[0] - RACK_Z[RACK_Z.length - 1] + RACK.w + 0.6
const TRAY_W = 0.9

/** A ladder cable tray full of cables, centered on its origin, running along z. */
export function CableTray() {
  const rungs = Math.floor(TRAY_LEN / 0.4)
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position-x={s * TRAY_W / 2}>
          <boxGeometry args={[0.04, 0.16, TRAY_LEN]} />
          <meshStandardMaterial {...TRAY_STEEL} />
        </mesh>
      ))}
      {Array.from({ length: rungs }, (_, i) => (
        <mesh key={i} position={[0, -0.06, -TRAY_LEN / 2 + 0.2 + i * 0.4]}>
          <boxGeometry args={[TRAY_W, 0.03, 0.05]} />
          <meshStandardMaterial {...TRAY_STEEL} />
        </mesh>
      ))}
      {/* Bundles of network cable lying in the tray */}
      {[['#2b5f9e', -0.26], ['#b89a2a', -0.12], ['#7d838a', 0.04], ['#2b5f9e', 0.18], ['#a8482a', 0.3]].map(([color, x], i) => (
        <mesh key={i} position={[x as number, -0.02, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.05, 0.05, TRAY_LEN - 0.1, 8]} />
          <meshStandardMaterial color={color as string} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

export const TRAYS = [-1, 1].map((side) => ({
  x: side * RACK_X,
  y: TRAY_Y,
  z: (RACK_Z[0] + RACK_Z[RACK_Z.length - 1]) / 2,
}))

/** Threaded rods holding a tray up (into the unseen ceiling). */
export function TrayHangers({ x, z }: { x: number; z: number }) {
  return (
    <>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[x + sx * (TRAY_W / 2 + 0.03), TRAY_Y + 0.45, z + sz * (TRAY_LEN / 2 - 0.3)]}>
            <cylinderGeometry args={[0.015, 0.015, 0.9, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        )),
      )}
    </>
  )
}

const LIGHT_LEN = AISLE_HALF * 2 - 0.5

const COLD = new THREE.Color('#9fdcff')
const EMERGENCY = new THREE.Color('#ff2414')

/**
 * A tube light hung across the aisle, glowing cold blue all round (you mostly see it from above).
 * `alarm`: switches to pulsing red emergency lighting. `bright` 0 = off (wreckage).
 */
export function AisleLight({ bright = 1, alarm = false, wires = true }: { bright?: number; alarm?: boolean; wires?: boolean }) {
  const tube = useRef<THREE.MeshBasicMaterial>(null!)
  useFrame(({ clock }) => {
    if (alarm) tube.current.color.copy(EMERGENCY).multiplyScalar(0.2 + 1.8 * (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 7)) ** 2)
    else tube.current.color.copy(COLD).multiplyScalar(0.25 + bright * 1.2)
  })
  return (
    <group>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.07, 0.07, LIGHT_LEN, 12]} />
        <meshBasicMaterial ref={tube} toneMapped={false} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position-x={s * (LIGHT_LEN / 2 - 0.15)}>
          <mesh position-y={0.06}>
            <boxGeometry args={[0.12, 0.06, 0.18]} />
            <meshStandardMaterial color="#2a2d32" roughness={0.5} metalness={0.6} />
          </mesh>
          {wires && (
            <mesh position-y={0.4}>
              <cylinderGeometry args={[0.008, 0.008, 0.65, 4]} />
              <meshStandardMaterial {...STEEL} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

export const LIGHTS = [2.0, 0.0, -2.0].map((z) => ({ x: 0, y: LIGHT_Y, z }))

/** A red emergency beacon (dark until the overload turns it on), sitting on a tray. */
export function Beacon({ glow }: { glow: number }) {
  return (
    <group>
      <mesh position-y={0.04}>
        <cylinderGeometry args={[0.1, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position-y={0.15}>
        <sphereGeometry args={[0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#6b0d08" emissive="#ff2a14" emissiveIntensity={glow} toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The crash cart: a two-shelf trolley, keyboard, a little UPS, and the big terminal monitor.

const CART_W = 1.7
const CART_D = 0.9

export function CartBody() {
  const h = CART.deckY - FLOOR_Y
  return (
    // Origin at floor level, under the cart's center.
    <group>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <group key={`${sx}${sz}`} position={[sx * (CART_W / 2 - 0.05), 0, sz * (CART_D / 2 - 0.05)]}>
          <mesh position-y={h / 2 + 0.06}>
            <cylinderGeometry args={[0.03, 0.03, h - 0.12, 8]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
          <mesh position-y={0.06} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.06, 0.06, 0.05, 12]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}
      {[0.35, h].map((y) => (
        <mesh key={y} position-y={y}>
          <boxGeometry args={[CART_W, 0.05, CART_D]} />
          <meshStandardMaterial color="#3a3f46" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* UPS on the bottom shelf */}
      <mesh position={[-0.35, 0.58, 0]}>
        <boxGeometry args={[0.7, 0.42, 0.6]} />
        <meshStandardMaterial color="#1d2024" roughness={0.5} />
      </mesh>
      <mesh position={[-0.12, 0.66, 0.305]}>
        <boxGeometry args={[0.12, 0.05, 0.01]} />
        <meshBasicMaterial color={COLORS.green} toneMapped={false} />
      </mesh>
      {/* Keyboard on the deck */}
      <mesh position={[0, h + 0.045, 0.18]}>
        <boxGeometry args={[1.1, 0.04, 0.34]} />
        <meshStandardMaterial color="#202226" roughness={0.6} />
      </mesh>
      {/* Monitor pole */}
      <mesh position={[0, h + (MONITOR.y - CART.deckY) / 2, MONITOR.z - CART.z - 0.12]}>
        <boxGeometry args={[0.1, MONITOR.y - CART.deckY, 0.08]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  )
}

let termTex: THREE.Texture | null = null
/** The terminal screen as decoration (phones, debris): green command lines on black. */
function terminalTexture() {
  return (termTex ??= canvasTexture(512, 272, (g) => {
    g.fillStyle = '#020604'
    g.fillRect(0, 0, 512, 272)
    g.font = 'bold 22px monospace'
    g.fillStyle = '#3dff7a'
    const lines = ['root@dc01:~$ ./play --rack A', '[ OK ] fans: 7200 rpm', '[ OK ] speaker wall: online', '> READY', '', 'root@dc01:~$ _']
    lines.forEach((line, i) => g.fillText(line, 18, 36 + i * 40))
  }))
}

/** The monitor: bezel centered on its origin, screen facing +z. `screen`: draw the decorative terminal. */
export function Monitor({ screen = true }: { screen?: boolean }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[MONITOR.w, MONITOR.h, 0.12]} />
        <meshStandardMaterial color="#141518" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position-z={0.066}>
        <planeGeometry args={[MONITOR.w - 0.14, MONITOR.h - 0.14]} />
        {screen ? <meshBasicMaterial map={terminalTexture()} toneMapped={false} /> : <meshBasicMaterial color="#000000" />}
      </mesh>
    </group>
  )
}

