// Level 5's speaker: a wall of PA cabinets (3×3, each a big woofer + a horn), no brand.
// Centered on its own origin (so it can be the upright survivor in the debris), facing +z.
// While `pump.current` is true the woofers punch out on a 120 BPM beat and the meter bounces.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CAB, WALL, WALL_H } from './dims'

const BASE_H = WALL_H - CAB.h * WALL.rows // the riser it stands on
const WOOFER_R = 0.42
const WOOFER_Y = -0.2
const BAFFLE_D = 0.04
const BLACK = { color: '#1c1d20', roughness: 0.8, metalness: 0.1 }

/** The kick: a sharp hit every half second that decays (no audio analysis; it just looks right). */
export function beat(t: number) {
  return Math.exp(-((t * 2) % 1) * 7)
}

// The cabinet box is open at the front (index 4 = +z hidden); the baffle covers it, with holes
// for the woofer and the horn so you can see into them. Shared by all 9 cabinets.
const BODY_D = CAB.d - BAFFLE_D
const bodyMaterials = (() => {
  const m = new THREE.MeshStandardMaterial(BLACK)
  return [m, m, m, m, new THREE.MeshBasicMaterial({ visible: false }), m]
})()
const HORN = { y: 0.46, hw: 0.226 * 1.4, hh: 0.226 * 0.55 } // mouth half-sizes (see the horn below)
const baffleGeometry = (() => {
  const w = CAB.w / 2 - 0.015 // a hair inside the box's sides, so their faces never overlap
  const h = CAB.h / 2 - 0.01
  const shape = new THREE.Shape()
  shape.moveTo(-w, -h)
  shape.lineTo(w, -h)
  shape.lineTo(w, h)
  shape.lineTo(-w, h)
  shape.closePath()
  const hole = new THREE.Path()
  hole.absarc(0, WOOFER_Y, WOOFER_R, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const horn = new THREE.Path()
  horn.moveTo(-HORN.hw, HORN.y - HORN.hh)
  horn.lineTo(-HORN.hw, HORN.y + HORN.hh)
  horn.lineTo(HORN.hw, HORN.y + HORN.hh)
  horn.lineTo(HORN.hw, HORN.y - HORN.hh)
  horn.closePath()
  shape.holes.push(horn)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: BAFFLE_D, bevelEnabled: false, curveSegments: 40 })
  geo.translate(0, 0, CAB.d / 2 - BAFFLE_D)
  return geo
})()

function Cabinet({ cone }: { cone: (m: THREE.Group | null) => void }) {
  return (
    <group>
      <mesh material={bodyMaterials} position-z={-BAFFLE_D / 2}>
        <boxGeometry args={[CAB.w - 0.02, CAB.h - 0.02, BODY_D]} />
      </mesh>
      <mesh geometry={baffleGeometry}>
        <meshStandardMaterial color="#2a2c30" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Corner protectors */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
        <mesh key={`${sx}${sy}`} position={[sx * (CAB.w / 2 - 0.05), sy * (CAB.h / 2 - 0.05), CAB.d / 2 + 0.01]}>
          <boxGeometry args={[0.1, 0.1, 0.02]} />
          <meshStandardMaterial color="#8a9098" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* Woofer, axis along z: rubber surround on the hole's rim, then the cone (pumps) and dust cap */}
      <mesh position={[0, WOOFER_Y, CAB.d / 2 - 0.01]}>
        <torusGeometry args={[WOOFER_R - 0.02, 0.035, 10, 48]} />
        <meshStandardMaterial color="#121214" roughness={0.7} />
      </mesh>
      <group position={[0, WOOFER_Y, CAB.d / 2 - 0.02]} rotation-x={Math.PI / 2}>
        <group ref={cone}>
          <mesh position-y={-0.1}>
            <cylinderGeometry args={[WOOFER_R - 0.04, 0.12, 0.2, 48, 1, true]} />
            <meshStandardMaterial color="#45484e" roughness={0.85} side={THREE.DoubleSide} />
          </mesh>
          <mesh position-y={-0.2}>
            <sphereGeometry args={[0.13, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#9aa1aa" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      </group>
      {/* Horn: a rectangular flare (4-sided open cylinder), mouth flush with the baffle */}
      <group position={[0, HORN.y, CAB.d / 2 - 0.15]} rotation-x={Math.PI / 2}>
        {/* Scale on the parent: the 45° turn makes the 4-sided cylinder square, then it's stretched wide. */}
        <group scale={[1.4, 1, 0.55]}>
          <mesh rotation-y={Math.PI / 4}>
            <cylinderGeometry args={[0.32, 0.08, 0.3, 4, 1, true]} />
            <meshStandardMaterial color="#4a4d53" roughness={0.5} metalness={0.4} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <mesh position-y={-0.15}>
          <cylinderGeometry args={[0.06, 0.06, 0.02, 12]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      </group>
    </group>
  )
}

export default function SpeakerWall({ pump }: { pump: { current: boolean } }) {
  const cones = useRef<(THREE.Group | null)[]>([])
  const meter = useRef<THREE.Mesh>(null!)
  const wall = useRef<THREE.Group>(null!)
  const level = useRef(0)

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    level.current += ((pump.current ? 1 : 0) - level.current) * Math.min(1, delta * 4)
    const hit = beat(t) * level.current
    cones.current.forEach((c, i) => {
      if (c) c.position.y = (hit * 0.05 + Math.sin(t * 31 + i) * 0.006 * level.current)
    })
    // The whole stack thumps a little (squash on the kick).
    wall.current.scale.set(1 + hit * 0.008, 1 - hit * 0.01, 1)
    meter.current.scale.x = Math.max(0.05, level.current * (0.35 + hit * 0.6 + Math.abs(Math.sin(t * 7.3)) * 0.05))
  })

  return (
    <group ref={wall}>
      {/* Riser + a level meter strip that bounces with the kick */}
      <mesh position-y={-WALL_H / 2 + BASE_H / 2}>
        <boxGeometry args={[CAB.w * WALL.cols + 0.1, BASE_H, CAB.d + 0.1]} />
        <meshStandardMaterial color="#26282c" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh ref={meter} position={[0, -WALL_H / 2 + BASE_H / 2, CAB.d / 2 + 0.06]}>
        <boxGeometry args={[CAB.w * WALL.cols - 0.3, 0.035, 0.01]} />
        <meshBasicMaterial color={new THREE.Color('#5ad8ff').multiplyScalar(1.5)} toneMapped={false} />
      </mesh>
      {Array.from({ length: WALL.rows * WALL.cols }, (_, i) => {
        const col = i % WALL.cols
        const row = Math.floor(i / WALL.cols)
        return (
          <group key={i} position={[(col - (WALL.cols - 1) / 2) * CAB.w, -WALL_H / 2 + BASE_H + (row + 0.5) * CAB.h, 0]}>
            <Cabinet cone={(m) => void (cones.current[i] = m)} />
          </group>
        )
      })}
    </group>
  )
}
