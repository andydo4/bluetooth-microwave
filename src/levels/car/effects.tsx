// The car's overload visuals (exhaust smoke → flames under the hood, black smoke, tire smoke) and the
// action-movie explosion. Everything here is in the car's own frame (see dims.ts), except the stand.
import { useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SubBox from './SubBox'
import { CharredShell, DashPlate, DoorPanel, Hatch, HoodPanel, StandBase, Wheel } from './parts'
import { CAR, HALF_W, HATCH_OPEN, HINGE, PLATE, SUB, SUB_POS, WHEEL } from './dims'
import { Debris, Flash, Particles, rand, type Particle, type Piece } from '../shared/effects'

const EXHAUST = { x: 3.15, y: 0.42, z: -0.75 }

// ---------------------------------------------------------------------------------------------
// Overload: REV (exhaust puffs) → FIRE (flames under the hood and car, black smoke, burning rubber).

function spawnExhaust(p: Particle) {
  p.pos.set(EXHAUST.x, EXHAUST.y, EXHAUST.z)
  p.vel.set(rand(1.2, 2.4), rand(0.4, 1), rand(-0.3, 0.3))
  p.life = rand(0.9, 1.5)
  p.size = rand(0.25, 0.4)
  p.grow = 3
}

function spawnHoodFlame(p: Particle) {
  p.pos.set(rand(-2.6, -1.6), 1.3, rand(-1, 1))
  p.vel.set(rand(-0.2, 0.2), rand(1.5, 2.6), rand(-0.2, 0.2))
  p.life = rand(0.4, 0.8)
  p.size = rand(0.7, 1.1)
  p.grow = -0.6
}

function spawnUnderFlame(p: Particle) {
  const side = Math.random() < 0.5 ? -1 : 1
  p.pos.set(rand(-2.3, 2.3), 0.2, side * rand(0.6, HALF_W + 0.1))
  p.vel.set(rand(-0.2, 0.2), rand(1, 2), side * rand(0.1, 0.5))
  p.life = rand(0.35, 0.7)
  p.size = rand(0.5, 0.85)
  p.grow = -0.5
}

function spawnBlackSmoke(p: Particle) {
  p.pos.set(rand(-2.4, -1.4), 1.6, rand(-0.8, 0.8))
  p.vel.set(rand(0, 0.5), rand(1.4, 2.4), rand(-0.3, 0.3))
  p.life = rand(1.6, 2.6)
  p.size = rand(0.5, 0.8)
  p.grow = 2.5
}

function spawnTireSmoke(p: Particle) {
  const side = Math.random() < 0.5 ? -1 : 1
  p.pos.set(WHEEL.x + rand(-0.2, 0.3), 0.15, side * (WHEEL.z + 0.1))
  p.vel.set(rand(1, 2.2), rand(0.3, 0.9), side * rand(0, 0.6))
  p.life = rand(1, 1.6)
  p.size = rand(0.4, 0.6)
  p.grow = 2.5
}

export function OverloadFx({ critical }: { critical: boolean }) {
  return (
    <group>
      <Particles count={critical ? 30 : 18} active spawn={spawnExhaust} color={critical ? '#3a3a3a' : '#9a9a9a'} opacity={0.55} />
      {critical && (
        <>
          <Particles count={50} active spawn={spawnHoodFlame} color="#ff6a10" opacity={0.95} additive />
          <Particles count={25} active spawn={spawnHoodFlame} color="#ffd36b" opacity={0.9} additive />
          <Particles count={40} active spawn={spawnUnderFlame} color="#ff6a12" opacity={0.9} additive />
          <Particles count={35} active spawn={spawnBlackSmoke} color="#363331" opacity={0.75} />
          <Particles count={25} active spawn={spawnTireSmoke} color="#d6d6d6" opacity={0.5} />
          <pointLight position={[-1.5, 1.2, 0]} color="#ff7a2a" intensity={25} decay={2} />
        </>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The explosion: a flash and a rolling fireball; tires, doors, hatch and hood fly off and bounce;
// the body is left as a charred, smoking shell. The subwoofer box survives (see Debris).

// The surviving sub box spins as it flies but lands facing the camera (it's the star of the show):
// it counter-rotates its debris parent and unwinds two extra turns over its flight.
const FACE_CAMERA = 0.35 - CAR.yaw // car-frame yaw that points the woofers at the default camera

function SurvivorSub({ pump }: { pump: { current: boolean } }) {
  const g = useRef<THREE.Group>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += Math.min(delta, 0.05)
    const k = Math.max(0, 1 - age.current / 1.4)
    g.current.rotation.y = -(g.current.parent?.rotation.y ?? 0) + FACE_CAMERA + k * k * Math.PI * 4
  })
  return (
    <group ref={g}>
      <SubBox pump={pump} />
    </group>
  )
}

function carPieces(pump: { current: boolean }): Piece[] {
  const tires: Piece[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => ({
      node: <Wheel />,
      pos: [sx * WHEEL.x, WHEEL.r, sz * WHEEL.z] as [number, number, number],
      vel: [sx * rand(0.3, 0.9), rand(6, 8), sz * rand(1.5, 2.5)] as [number, number, number],
      rest: 0.3,
    })),
  )
  return [
    ...tires,
    { node: <DoorPanel />, pos: [-0.35, 1.0, HALF_W + 0.05], vel: [-0.8, 7, 2.2], rest: 0.1 },
    { node: <group rotation-y={Math.PI}><DoorPanel /></group>, pos: [-0.35, 1.0, -HALF_W - 0.05], vel: [-0.8, 7, -2.2], rest: 0.1 },
    { node: <group rotation-z={HATCH_OPEN}><Hatch /></group>, pos: [HINGE.x, HINGE.y, 0], vel: [-0.3, 7, 0], rest: 0.1 },
    { node: <HoodPanel />, pos: [-2.1, 1.35, 0], vel: [-2.2, 10, 0], rest: 0.06 },
    { node: <SurvivorSub pump={pump} />, pos: [SUB_POS.x, SUB_POS.y, 0], vel: [1.6, 6.5, 0.9], rest: SUB.h / 2, survivor: true },
  ]
}

const standPieces = (): Piece[] => [
  { node: <group rotation-x={PLATE.tilt}><DashPlate /></group>, pos: [0, PLATE.y, 0], vel: [-0.6, 4, -1.6], rest: 0.1 },
]

function spawnFireball(p: Particle) {
  const dir = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize()
  p.pos.set(rand(-1.5, 1.5), rand(0.6, 1.6), rand(-0.6, 0.6))
  p.vel.copy(dir).multiplyScalar(rand(2, 5))
  p.life = rand(0.6, 1.3)
  p.size = rand(1.2, 2.2)
  p.grow = 1
}

function spawnCore(p: Particle) {
  p.pos.set(rand(-1, 1), rand(0.8, 1.6), rand(-0.5, 0.5))
  p.vel.set(rand(-1.5, 1.5), rand(1, 3), rand(-1.5, 1.5))
  p.life = rand(0.4, 0.8)
  p.size = rand(1, 1.6)
  p.grow = 0.8
}

function spawnShellFire(p: Particle) {
  p.pos.set(rand(-2.4, 2.2), rand(0.4, 1.4), rand(-1, 1))
  p.vel.set(rand(-0.1, 0.1), rand(0.8, 1.6), rand(-0.1, 0.1))
  p.life = rand(0.4, 0.8)
  p.size = rand(0.6, 1.0)
  p.grow = -0.5
}

function spawnColumn(p: Particle) {
  p.pos.set(rand(-1.8, 1.4), rand(1.2, 2), rand(-0.7, 0.7))
  p.vel.set(rand(0, 0.4), rand(1.4, 2.4), rand(-0.3, 0.3))
  p.life = rand(2, 3.5)
  p.size = rand(0.8, 1.2)
  p.grow = 2.2
}

/** The burnt shell slumps to the ground (no wheels under it any more). */
function Slump({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    const k = Math.min(1, age.current / 0.35)
    g.current.position.y = 0.5 * (1 - k * k)
  })
  return <group ref={g}>{children}</group>
}

/** In the car's frame. The stand pieces go in `stand` (rendered by Model in the stand's frame). */
export function Explosion({ glow, pump }: { glow: boolean; pump: { current: boolean } }) {
  const [pieces] = useState(() => carPieces(pump))
  const [bursting, setBursting] = useState(true)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    if (bursting && age.current > 0.5) setBursting(false)
  })
  return (
    <group>
      <Flash position={[0, 1.3, 0]} color="#ffcf7a" />
      <Particles count={70} active={bursting} spawn={spawnFireball} color="#ff7a22" opacity={0.95} additive />
      <Particles count={30} active={bursting} spawn={spawnCore} color="#ffe08a" opacity={1} additive />
      <Slump>
        <CharredShell />
      </Slump>
      <Particles count={45} active spawn={spawnShellFire} color="#ff6a10" opacity={0.9} additive />
      <Particles count={40} active spawn={spawnColumn} color="#363331" opacity={0.6} />
      <pointLight position={[0, 1.2, 0]} color="#ff7a2a" intensity={18} decay={2} />
      <Debris pieces={pieces} groundY={0} glow={glow} />
    </group>
  )
}

/** The head-unit stand after the blast: the plate is blown off its post. In the stand's frame. */
export function StandWreck() {
  const [pieces] = useState(standPieces)
  return (
    <group>
      <StandBase />
      <Debris pieces={pieces} groundY={0} glow={false} />
    </group>
  )
}
