// Elevator parts used both by the working lift (Model.tsx) and its debris (effects.tsx), plus the
// canvas textures (brushed steel, concrete, marble, bronze panels). Every texture is made once.
import { useMemo } from 'react'
import * as THREE from 'three'
import {
  BACK_WALL, BRASS, CAR, DARK_STEEL, DOOR, GROUND_Y, OPENING, PLATE, PLATE_FRONT_Z, SAFETY_YELLOW, SHAFT_TOP, SHEAVE, STEEL, WALL, WALL_FRONT_Z,
} from './dims'

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(...repeat)
  return tex
}

const cache: Record<string, THREE.Texture> = {}
const once = (key: string, make: () => THREE.Texture) => (cache[key] ??= make())

/** Horizontal hairline streaks: brushed stainless. */
export const brushedSteel = () =>
  once('steel', () =>
    canvasTexture(256, 256, (g) => {
      g.fillStyle = '#c4c8cc'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 900; i++) {
        const y = Math.random() * 256
        g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${Math.random() * 0.25})` : `rgba(60,64,70,${Math.random() * 0.18})`
        g.fillRect(Math.random() * 256 - 60, y, 40 + Math.random() * 200, 1)
      }
    }),
  )

/** Board-formed concrete: speckle plus faint horizontal shuttering lines. */
const concrete = () =>
  once('concrete', () =>
    canvasTexture(256, 256, (g) => {
      g.fillStyle = '#8c8e91'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,40,44' : '200,200,204'},${Math.random() * 0.18})`
        g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
      }
      g.fillStyle = 'rgba(40,40,44,0.25)'
      for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 2)
    }, [2, 3]),
  )

/** Cream marble with soft grey veins, for the lobby wall. */
const marble = () =>
  once('marble', () =>
    canvasTexture(256, 256, (g) => {
      g.fillStyle = '#e4ddcf'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(120,112,100,${0.08 + Math.random() * 0.18})`
        g.lineWidth = 0.6 + Math.random() * 1.6
        g.beginPath()
        let x = Math.random() * 256
        let y = 0
        g.moveTo(x, y)
        while (y < 256) {
          x += (Math.random() - 0.5) * 30
          y += 10 + Math.random() * 20
          g.lineTo(x, y)
        }
        g.stroke()
      }
    }),
  )

/** The car's interior walls: warm champagne-bronze panels with dark seams. */
export const bronzePanels = () =>
  once('bronze', () =>
    canvasTexture(256, 256, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, '#d8bf93')
      grad.addColorStop(1, '#b8996a')
      g.fillStyle = grad
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 400; i++) {
        g.fillStyle = `rgba(255,240,210,${Math.random() * 0.12})`
        g.fillRect(Math.random() * 256, Math.random() * 256, 1, 20 + Math.random() * 60)
      }
      g.fillStyle = 'rgba(50,34,16,0.75)'
      g.fillRect(0, 0, 3, 256)
      g.fillRect(127, 0, 3, 256)
      g.fillRect(0, 170, 256, 3) // a seam at handrail-ish height
    }, [1.5, 1]),
  )

// ---------------------------------------------------------------------------------------------
// The car

/** Materials for the car's outer shell. Box faces: +x, -x, +y, -y, +z, -z. The front is hidden (the front plate covers it). */
export function useShellMaterials() {
  return useMemo(() => {
    const steel = new THREE.MeshStandardMaterial({ ...STEEL, map: brushedSteel() })
    return [steel, steel, steel, steel, new THREE.MeshBasicMaterial({ visible: false }), steel]
  }, [])
}

/** Materials for the BackSide interior lining: panelled walls, a glowing ceiling, a dark stone floor. */
export function useLiningMaterials() {
  return useMemo(() => {
    const wall = new THREE.MeshStandardMaterial({ map: bronzePanels(), roughness: 0.4, metalness: 0.35, side: THREE.BackSide })
    const ceiling = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd89c', emissiveIntensity: 0.9, side: THREE.BackSide })
    const floor = new THREE.MeshStandardMaterial({ color: '#2b2a2e', roughness: 0.25, metalness: 0.2, side: THREE.BackSide })
    return { all: [wall, wall, ceiling, floor, new THREE.MeshBasicMaterial({ visible: false }), wall], ceiling }
  }, [])
}

/** The car's front wall with the doorway cut out. Its front face is at z = 0; centered on the car in x/y. */
export function FrontPlate() {
  const geo = useMemo(() => {
    const w = CAR.w / 2 - 0.01 // a hair inside the shell's sides and top, so no faces overlap
    const h = CAR.h / 2 - 0.01
    const shape = new THREE.Shape()
    shape.moveTo(-w, -h)
    shape.lineTo(w, -h)
    shape.lineTo(w, h)
    shape.lineTo(-w, h)
    shape.closePath()
    const hole = new THREE.Path()
    const top = OPENING.bottom + OPENING.h
    hole.moveTo(-OPENING.w / 2, OPENING.bottom)
    hole.lineTo(-OPENING.w / 2, top)
    hole.lineTo(OPENING.w / 2, top)
    hole.lineTo(OPENING.w / 2, OPENING.bottom)
    hole.closePath()
    shape.holes.push(hole)
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false })
    g.translate(0, 0, -0.1)
    return g
  }, [])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial {...STEEL} map={brushedSteel()} />
    </mesh>
  )
}

/** One sliding door leaf: a brushed-steel frame round a tall glass window (so the speaker stays visible). */
export function DoorLeaf() {
  const stile = 0.1
  const top = 0.2
  const bottom = 0.3
  const glassH = DOOR.h - top - bottom
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position-x={s * (DOOR.w / 2 - stile / 2)}>
          <boxGeometry args={[stile, DOOR.h, 0.04]} />
          <meshStandardMaterial {...STEEL} map={brushedSteel()} />
        </mesh>
      ))}
      <mesh position-y={DOOR.h / 2 - top / 2}>
        <boxGeometry args={[DOOR.w - stile * 2, top, 0.04]} />
        <meshStandardMaterial {...STEEL} map={brushedSteel()} />
      </mesh>
      <mesh position-y={-DOOR.h / 2 + bottom / 2}>
        <boxGeometry args={[DOOR.w - stile * 2, bottom, 0.04]} />
        <meshStandardMaterial {...STEEL} map={brushedSteel()} />
      </mesh>
      {/* Drawn after the car's interior, so moving the camera can't flip their order. */}
      <mesh position-y={(bottom - top) / 2} renderOrder={2}>
        <planeGeometry args={[DOOR.w - stile * 2 + 0.01, glassH + 0.01]} />
        <meshStandardMaterial color="#bfe0ea" transparent opacity={0.22} roughness={0.05} metalness={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** The I-beam crosshead on the car roof that the cables hitch to. Centered on the roof, car-local. */
export function Crosshead() {
  return (
    <group>
      <mesh position-y={0.04}>
        <boxGeometry args={[CAR.w * 0.92, 0.04, 0.3]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position-y={0.16}>
        <boxGeometry args={[CAR.w * 0.92, 0.2, 0.05]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position-y={0.28}>
        <boxGeometry args={[CAR.w * 0.92, 0.04, 0.3]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      {/* Hitch plate */}
      <mesh position-y={0.38}>
        <boxGeometry args={[0.55, 0.16, 0.22]} />
        <meshStandardMaterial {...DARK_STEEL} color="#45494e" />
      </mesh>
    </group>
  )
}

/** Yellow safety railing round the back and left of the car roof, car-local, sitting on the roof. */
export function RoofRail() {
  const h = 0.55
  const back = -CAR.d / 2 + 0.1
  const left = -CAR.w / 2 + 0.1
  return (
    <group>
      <mesh position={[0, h, back]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.025, 0.025, CAR.w - 0.2, 8]} />
        <meshStandardMaterial {...SAFETY_YELLOW} />
      </mesh>
      <mesh position={[left, h, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.025, 0.025, CAR.d - 0.2, 8]} />
        <meshStandardMaterial {...SAFETY_YELLOW} />
      </mesh>
      {[[left, back], [CAR.w / 2 - 0.1, back], [left, CAR.d / 2 - 0.1], [left, 0]].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, h / 2, z]}>
          <cylinderGeometry args={[0.025, 0.025, h, 8]} />
          <meshStandardMaterial {...SAFETY_YELLOW} />
        </mesh>
      ))}
    </group>
  )
}

/** Brass handrail along the back wall inside the car, car-local. */
export function Handrail() {
  const y = -CAR.h / 2 + 1.05
  const z = -CAR.d / 2 + 0.22
  const len = CAR.w - 0.7
  return (
    <group position={[0, y, z]}>
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.04, 0.04, len, 16]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {[-len / 2 + 0.15, len / 2 - 0.15].map((x) => (
        <mesh key={x} position={[x, 0, -0.08]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The shaft

/** A T-section guide rail (or `h` of one), its bottom at the origin. `flip` turns the blade to face the other way. */
export function Rail({ flip = false, h = SHAFT_TOP - GROUND_Y }: { flip?: boolean; h?: number }) {
  const s = flip ? -1 : 1
  return (
    <group position-y={h / 2}>
      <mesh position-x={s * 0.06}>
        <boxGeometry args={[0.12, h, 0.05]} />
        <meshStandardMaterial {...DARK_STEEL} color="#7c8187" />
      </mesh>
      <mesh position-x={-s * 0.02}>
        <boxGeometry args={[0.04, h, 0.2]} />
        <meshStandardMaterial {...DARK_STEEL} color="#7c8187" />
      </mesh>
    </group>
  )
}

/** The shaft's back wall: bare concrete. */
export function BackWall() {
  const h = SHAFT_TOP + 0.2 - GROUND_Y
  return (
    <mesh position={[BACK_WALL.x, GROUND_Y + h / 2, BACK_WALL.z]}>
      <boxGeometry args={[BACK_WALL.w, h, BACK_WALL.d]} />
      <meshStandardMaterial map={concrete()} roughness={0.95} />
    </mesh>
  )
}

/** An I-beam spanning the top of the shaft along x, centered on its own origin. */
function IBeam({ length }: { length: number }) {
  return (
    <group>
      {[-0.11, 0.11].map((y) => (
        <mesh key={y} position-y={y}>
          <boxGeometry args={[length, 0.03, 0.22]} />
          <meshStandardMaterial {...DARK_STEEL} color="#4b5056" />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[length, 0.2, 0.04]} />
        <meshStandardMaterial {...DARK_STEEL} color="#4b5056" />
      </mesh>
    </group>
  )
}

/** The top of the shaft: two beams and the hoist machine (green motor + grooved sheave) sitting on them. */
export function Machine({ sheave }: { sheave?: (g: THREE.Group | null) => void }) {
  const beamLen = BACK_WALL.w
  return (
    <group>
      {[0.25, -1.95].map((z) => (
        <group key={z} position={[BACK_WALL.x, SHEAVE.y - 0.45, z]}>
          <IBeam length={beamLen} />
        </group>
      ))}
      {/* Bedplate on the beams, then the motor and brake beside the sheave */}
      <mesh position={[CAR.x + 0.95, SHEAVE.y - 0.27, SHEAVE.z - 0.3]}>
        <boxGeometry args={[1.3, 0.1, 2.3]} />
        <meshStandardMaterial {...DARK_STEEL} color="#3a3e43" />
      </mesh>
      <mesh position={[CAR.x + 1.05, SHEAVE.y, SHEAVE.z]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.32, 0.32, 0.9, 32]} />
        <meshStandardMaterial color="#3f6b5c" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[CAR.x + 0.45, SHEAVE.y, SHEAVE.z]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.36, 0.36, 0.14, 32]} />
        <meshStandardMaterial {...DARK_STEEL} />
      </mesh>
      <mesh position={[CAR.x + 0.2, SHEAVE.y, SHEAVE.z]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.06, 0.06, 0.6, 12]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {/* The sheave: the cables run over its front edge. It turns while the car moves. */}
      <group ref={sheave} position={[CAR.x, SHEAVE.y, SHEAVE.z]}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[SHEAVE.r, SHEAVE.r, 0.42, 40]} />
          <meshStandardMaterial {...DARK_STEEL} color="#2f3236" />
        </mesh>
        {/* Spokes, so you can see it turn */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position-x={0.215} rotation-x={(i * Math.PI) / 3}>
            <boxGeometry args={[0.02, SHEAVE.r * 1.7, 0.08]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Spring buffers in the pit, under the car. Centered on the car's x/z. */
export function Buffers() {
  return (
    <group position={[CAR.x, GROUND_Y, CAR.z]}>
      {[-0.9, 0.9].map((x) => (
        <group key={x} position-x={x}>
          <mesh position-y={0.03}>
            <boxGeometry args={[0.5, 0.06, 0.5]} />
            <meshStandardMaterial {...DARK_STEEL} />
          </mesh>
          <mesh position-y={0.16}>
            <cylinderGeometry args={[0.17, 0.17, 0.2, 20]} />
            <meshStandardMaterial {...SAFETY_YELLOW} />
          </mesh>
          <mesh position-y={0.28}>
            <cylinderGeometry args={[0.2, 0.2, 0.04, 20]} />
            <meshStandardMaterial color="#1b1b1d" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The lobby wall and its brass plate

/** The lobby wall section beside the doors: marble, with a dark base and cornice. Centered on WALL. */
export function LobbyWall({ scorched = false }: { scorched?: boolean }) {
  const tint = scorched ? '#6f6a63' : '#ffffff'
  return (
    <group>
      <mesh>
        <boxGeometry args={[WALL.w, WALL.h, WALL.d]} />
        <meshStandardMaterial map={marble()} color={tint} roughness={0.35} />
      </mesh>
      <mesh position={[0, -WALL.h / 2 + 0.12, 0]}>
        <boxGeometry args={[WALL.w + 0.04, 0.24, WALL.d + 0.04]} />
        <meshStandardMaterial color="#2a2522" roughness={0.4} />
      </mesh>
      <mesh position={[0, WALL.h / 2 - 0.08, 0]}>
        <boxGeometry args={[WALL.w + 0.08, 0.16, WALL.d + 0.08]} />
        <meshStandardMaterial color="#2a2522" roughness={0.4} />
      </mesh>
    </group>
  )
}

/** The brass control plate (the HTML panel or the phone's stand-ins sit on its face). Its back is at z = 0. */
export function BrassPlate() {
  return (
    <mesh position-z={PLATE.d / 2}>
      <boxGeometry args={[PLATE.w, PLATE.h, PLATE.d]} />
      <meshStandardMaterial {...BRASS} />
    </mesh>
  )
}

/** The car roof's red alarm beacon. `mat` gets the dome's material so the model can flash it. */
export function Beacon({ mat }: { mat?: (m: THREE.MeshStandardMaterial | null) => void }) {
  return (
    <group>
      <mesh position-y={0.04}>
        <cylinderGeometry args={[0.14, 0.16, 0.08, 20]} />
        <meshStandardMaterial color="#222" roughness={0.6} />
      </mesh>
      <mesh position-y={0.1}>
        <sphereGeometry args={[0.12, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={mat} color="#c0221a" emissive="#ff2a1a" emissiveIntensity={0.15} roughness={0.2} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Decorative readout and buttons on the brass plate (phones, where the real controls are in a sheet; and the wreck). */
export function PlateButtons({ on }: { on: boolean }) {
  const z = PLATE_FRONT_Z - WALL_FRONT_Z
  const steel = <meshStandardMaterial color="#d6dadf" metalness={0.8} roughness={0.25} />
  return (
    <group position-z={z}>
      <mesh position={[0, 1.4, 0.01]}>
        <boxGeometry args={[2.0, 0.42, 0.02]} />
        <meshStandardMaterial color="#120904" emissive="#ffb347" emissiveIntensity={on ? 0.25 : 0.08} />
      </mesh>
      {[[-0.5, 0.65], [0.5, 0.65], [-0.5, -0.1], [0.5, -0.1]].map(([x, y]) => (
        <group key={`${x},${y}`} position={[x, y, 0]} rotation-x={Math.PI / 2}>
          <mesh position-y={0.015}>
            <cylinderGeometry args={[0.27, 0.27, 0.03, 32]} />
            <meshStandardMaterial color="#ffb347" emissive="#ffb347" emissiveIntensity={on ? 0.6 : 0.1} toneMapped={false} />
          </mesh>
          <mesh position-y={0.04}>
            <cylinderGeometry args={[0.22, 0.22, 0.04, 32]} />
            {steel}
          </mesh>
        </group>
      ))}
      {[-0.65, 0, 0.65].map((x, i) => (
        <mesh key={x} position={[x, -0.75, 0.025]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.17, 0.17, 0.05, 28]} />
          {i === 2 ? <meshStandardMaterial color="#dc2626" roughness={0.3} /> : steel}
        </mesh>
      ))}
      <mesh position={[0, -1.2, 0.01]}>
        <boxGeometry args={[2.0, 0.22, 0.02]} />
        <meshStandardMaterial color="#fffaf0" roughness={0.6} />
      </mesh>
      <mesh position={[0, -1.55, 0.01]}>
        <boxGeometry args={[2.0, 0.24, 0.02]} />
        <meshStandardMaterial color="#e8b400" roughness={0.6} />
      </mesh>
    </group>
  )
}
