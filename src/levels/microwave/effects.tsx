// The microwave's overload visuals: sparks → fire + smoke → explosion.
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Speaker from './Speaker'
import { BLACK, CAVITY, DOOR, GROUND_Y, SPEAKER_CENTER, TURNTABLE_Y } from './dims'
import { Debris, Flash, Particles, rand, type Particle, type Piece } from '../shared/effects'

// ---------------------------------------------------------------------------------------------
// Arcing: jagged electric bolts from the speaker to the cavity walls, re-drawn ~15 times a second.

function randomWallPoint(): THREE.Vector3 {
  const x0 = CAVITY.x - CAVITY.w / 2
  const x1 = CAVITY.x + CAVITY.w / 2
  const y0 = -CAVITY.h / 2
  const y1 = CAVITY.h / 2
  const z0 = -CAVITY.d / 2
  const p = new THREE.Vector3(rand(x0, x1), rand(y0, y1), rand(z0, z0 + CAVITY.d * 0.8))
  switch (Math.floor(Math.random() * 4)) {
    case 0: p.x = x0; break
    case 1: p.x = x1; break
    case 2: p.y = y1; break
    default: p.z = z0
  }
  return p
}

function bolt(): THREE.Vector3[] {
  const start = new THREE.Vector3(...SPEAKER_CENTER).add(new THREE.Vector3(rand(-0.8, 0.8), rand(-0.1, 0.35), rand(-0.3, 0.3)))
  const end = randomWallPoint()
  const points = [start]
  const steps = 7
  for (let i = 1; i < steps; i++) {
    const p = start.clone().lerp(end, i / steps)
    p.add(new THREE.Vector3(rand(-0.18, 0.18), rand(-0.18, 0.18), rand(-0.18, 0.18)))
    points.push(p)
  }
  points.push(end)
  return points
}

const MAX_BOLTS = 3
const SEGMENTS = 7 // per bolt (bolt() returns SEGMENTS + 1 points)
const UP = new THREE.Vector3(0, 1, 0)

// Each bolt segment is a thin bright core plus a wider soft glow, positioned imperatively each
// flicker (no React re-renders).
export function Sparks() {
  const cores = useRef<THREE.Mesh[]>([])
  const glows = useRef<THREE.Mesh[]>([])
  const light = useRef<THREE.PointLight>(null!)
  const next = useRef(0)
  const segment = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 5), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (t < next.current) return
    next.current = t + rand(0.04, 0.09)

    const count = Math.random() < 0.2 ? 0 : 1 + Math.floor(Math.random() * MAX_BOLTS)
    for (let b = 0; b < MAX_BOLTS; b++) {
      const points = b < count ? bolt() : null
      for (let s = 0; s < SEGMENTS; s++) {
        const i = b * SEGMENTS + s
        const core = cores.current[i]
        const glow = glows.current[i]
        if (!points) {
          core.visible = glow.visible = false
          continue
        }
        const a = points[s]
        const dir = points[s + 1].clone().sub(a)
        const length = dir.length()
        for (const [mesh, radius] of [[core, 0.024], [glow, 0.09]] as const) {
          mesh.visible = true
          mesh.position.copy(a).addScaledVector(dir, 0.5)
          mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize())
          mesh.scale.set(radius, length, radius)
        }
      }
    }
    light.current.intensity = count ? rand(15, 45) : 0
  })

  return (
    <group>
      <pointLight ref={light} position={SPEAKER_CENTER} color="#9fd8ff" decay={2} />
      {Array.from({ length: MAX_BOLTS * SEGMENTS }, (_, i) => (
        <group key={i}>
          <mesh ref={(m) => void (m && (cores.current[i] = m))} geometry={segment} visible={false}>
            <meshBasicMaterial color="#f2fbff" toneMapped={false} />
          </mesh>
          <mesh ref={(m) => void (m && (glows.current[i] = m))} geometry={segment} visible={false}>
            <meshBasicMaterial color="#6fc3ff" transparent opacity={0.5} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Fire inside the cavity, and smoke leaking out of the seams.

function spawnFlame(spread: number, size: number) {
  return (p: Particle) => {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * spread
    p.pos.set(CAVITY.x + Math.cos(a) * r * 1.3, TURNTABLE_Y + 0.05, Math.sin(a) * r)
    p.vel.set(rand(-0.15, 0.15), rand(1.2, 2.2), rand(-0.15, 0.15))
    p.life = rand(0.45, 0.85)
    p.size = size * rand(0.7, 1.2)
    p.grow = -0.5 // flames shrink as they rise
  }
}

function spawnSeamSmoke(p: Particle) {
  p.pos.set(rand(-2.3, 1.0), 1.5, rand(1.5, 1.8))
  p.vel.set(rand(-0.15, 0.15), rand(0.6, 1.1), rand(0.1, 0.4))
  p.life = rand(2, 3)
  p.size = 0.4
  p.grow = 3
}

export function Fire() {
  const light = useRef<THREE.PointLight>(null!)
  useFrame(() => {
    light.current.intensity = rand(25, 45)
  })
  return (
    <group>
      <pointLight ref={light} position={[CAVITY.x, 0, 0.5]} color="#ff7a1a" decay={2} />
      <Particles count={45} active spawn={spawnFlame(1.1, 1.4)} color="#ff6a10" opacity={0.9} additive />
      <Particles count={30} active spawn={spawnFlame(0.8, 0.8)} color="#ffd36b" opacity={0.95} additive />
      <Particles count={30} active spawn={spawnSeamSmoke} color="#3a3a3a" opacity={0.6} />
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The explosion: a flash, then the microwave's parts fly apart, bounce and settle, smoking.
// The speaker survives (see Debris).

const charred = <meshStandardMaterial color="#5c5e63" roughness={0.75} metalness={0.3} />
const black = <meshStandardMaterial {...BLACK} />

const PIECES: Piece[] = [
  { node: <mesh><boxGeometry args={[5, 0.1, 3.4]} />{charred}</mesh>, pos: [0, 1.45, 0], vel: [rand(-1, 1), 10, rand(-1.5, 0.5)], rest: 0.1 },
  { node: <mesh><boxGeometry args={[5, 0.1, 3.4]} />{charred}</mesh>, pos: [0, -1.45, 0], vel: [0, 2, 0], rest: 0.1 },
  { node: <mesh><boxGeometry args={[0.1, 3, 3.4]} />{charred}</mesh>, pos: [-2.45, 0, 0], vel: [-5, 5, rand(-1, 1)], rest: 0.15 },
  { node: <mesh><boxGeometry args={[0.1, 3, 3.4]} />{charred}</mesh>, pos: [2.45, 0, 0], vel: [5, 5, rand(-1, 1)], rest: 0.15 },
  { node: <mesh><boxGeometry args={[5, 3, 0.1]} />{charred}</mesh>, pos: [0, 0, -1.65], vel: [0, 4, -5], rest: 0.15 },
  {
    node: (
      <group>
        <mesh>
          <boxGeometry args={[DOOR.w, 3, 0.08]} />
          {black}
        </mesh>
        <mesh position={[DOOR.w / 2 - 0.25, 0, 0.1]}>
          <boxGeometry args={[0.1, 2, 0.12]} />
          {charred}
        </mesh>
      </group>
    ),
    pos: [DOOR.x, 0, DOOR.z],
    vel: [-2.5, 6, 2],
    rest: 0.1,
  },
  { node: <mesh><boxGeometry args={[1.25, 3, 0.04]} />{black}</mesh>, pos: [1.875, 0, 1.72], vel: [3, 6, 1.5], rest: 0.1 },
  {
    node: (
      <mesh>
        <cylinderGeometry args={[1.35, 1.35, 0.04, 48]} />
        <meshStandardMaterial color="#a9c4c0" transparent opacity={0.55} roughness={0.1} depthWrite={false} />
      </mesh>
    ),
    pos: [CAVITY.x, TURNTABLE_Y, 0],
    vel: [rand(-2, 2), 7, rand(-1, 0.5)],
    rest: 0.05,
  },
  { node: <Speaker />, pos: SPEAKER_CENTER, vel: [rand(-1, 1), 9, rand(0, 1)], rest: 0.4, survivor: true },
]

function spawnDebrisSmoke(p: Particle) {
  p.pos.set(rand(-2.5, 2.5), GROUND_Y + 0.3, rand(-1.5, 1.5))
  p.vel.set(rand(-0.3, 0.3), rand(0.8, 1.6), rand(-0.3, 0.3))
  p.life = rand(2.5, 4)
  p.size = 1
  p.grow = 2.5
}

export function Explosion({ glow }: { glow: boolean }) {
  const [smoking, setSmoking] = useState(true)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    if (smoking && age.current > 5) setSmoking(false)
  })
  return (
    <group>
      <Flash position={[CAVITY.x, 0, 0.5]} />
      <Debris pieces={PIECES} groundY={GROUND_Y} glow={glow} />
      <Particles count={45} active={smoking} spawn={spawnDebrisSmoke} color="#2e2e2e" opacity={0.55} />
    </group>
  )
}
