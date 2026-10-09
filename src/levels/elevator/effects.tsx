// The elevator's overload visuals: sparks off the straining cables → a shower of sparks down the shaft
// as the car slips → the explosion (the car slams into the pit, the doors blow off, a cloud of dust).
import { useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Tower, { TOWER } from './Tower'
import { BackWall, Beacon, BrassPlate, Crosshead, DoorLeaf, FrontPlate, Handrail, LobbyWall, Machine, PlateButtons, Rail, bronzePanels, brushedSteel } from './parts'
import {
  CAR, CAR_FRONT_Z, CAR_TOP, DARK_STEEL, DOOR, FLOOR_LOCAL, GROUND_Y, JOLT_DROP, JOLTS, OPENING, PLATE, RAIL_X, SHAFT_TOP, SHEAVE, STEEL, WALL,
  WALL_FRONT_Z,
} from './dims'
import { Debris, Flash, Particles, rand, type Particle, type Piece } from '../shared/effects'

const SPARK = '#ffb347'

// ---------------------------------------------------------------------------------------------
// Overload sparks

// Off the sheave and the cable hitch: short, fast, falling.
function spawnCableSpark(p: Particle) {
  const atSheave = Math.random() < 0.5
  p.pos.set(CAR.x + rand(-0.25, 0.25), atSheave ? SHEAVE.y - 0.1 : CAR_TOP + 0.45, atSheave ? SHEAVE.z + SHEAVE.r : CAR.z)
  p.vel.set(rand(-2, 2), rand(0.5, 3), rand(-0.5, 2))
  p.life = rand(0.25, 0.6)
  p.size = rand(0.12, 0.24)
  p.grow = -0.6
}

// Down the shaft: from the guide shoes scraping the rails, and raining from the top.
function spawnShowerSpark(p: Particle) {
  if (Math.random() < 0.5) {
    const right = Math.random() < 0.5
    p.pos.set(RAIL_X[right ? 1 : 0], rand(CAR_TOP - 0.4, CAR_TOP), CAR.z + rand(-0.1, 0.1))
    p.vel.set(right ? rand(0, 1.5) : rand(-1.5, 0), rand(-1, 1.5), rand(0, 1.5))
  } else {
    p.pos.set(CAR.x + rand(-2, 2), SHEAVE.y + rand(-0.3, 0.2), rand(-1.6, 1.0))
    p.vel.set(rand(-0.6, 0.6), rand(-3, -0.5), rand(0, 1.2))
  }
  p.life = rand(0.5, 1.1)
  p.size = rand(0.12, 0.26)
  p.grow = -0.5
}

export function Sparks({ critical }: { critical: boolean }) {
  return (
    <group>
      <Particles count={critical ? 50 : 30} active spawn={spawnCableSpark} color={SPARK} opacity={1} additive gravity={9} />
      {critical && <Particles count={70} active spawn={spawnShowerSpark} color={SPARK} opacity={1} additive gravity={9} />}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The explosion: a flash, and the car slams into the pit and bursts open like a box: its walls fall
// flat outward, the roof flips off and lands leaning against the back, the doors blow off forward and
// the brass plate pops off the wall. The lower rails topple, small parts scatter (shared Debris), dust
// billows. The speaker tower pops up out of the wreck and lands upright on the car floor.
//
// The big panels use scripted falls (Hinge, Flyer) instead of Debris: Debris leaves pieces at random
// angles, and a 4-unit wall stuck diagonally through the floor (or hiding the speaker) looks broken.

const STEP = 0.033 // same time step cap as Debris, so everything stays in step on slow devices
const FLOOR_TOP = GROUND_Y + 0.05 // the car's floor, slammed flat on the pit floor
// Where the critical stage left the car's bottom, above the pit floor: it falls this far first.
const SLAM = CAR.y - CAR.h / 2 - JOLTS.length * JOLT_DROP - GROUND_Y
const SLAM_SECONDS = Math.sqrt(SLAM / 8)
const WALL_H = CAR.h - 0.1
const RAIL_SPLIT = 0.9 // the rails break here; the lower length topples
const RAIL_LOW = RAIL_SPLIT - GROUND_Y
const START_Y = CAR.y - JOLTS.length * JOLT_DROP // the car's center when it blows

const steel = <meshStandardMaterial {...STEEL} map={brushedSteel()} color="#b9bec3" roughness={0.45} />
const box = (w: number, h: number, d: number) => (
  <mesh>
    <boxGeometry args={[w, h, d]} />
    {steel}
  </mesh>
)

/** A car wall: steel outside, bronze lining inside (+z), its bottom edge on the origin. */
function CarPanel({ w, h }: { w: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, -0.025]}>
        <boxGeometry args={[w, h, 0.05]} />
        {steel}
      </mesh>
      <mesh position={[0, h / 2, 0.015]}>
        <boxGeometry args={[w - 0.06, h - 0.06, 0.03]} />
        <meshStandardMaterial map={bronzePanels()} roughness={0.45} metalness={0.35} />
      </mesh>
    </group>
  )
}

/** Swings its children about a bottom edge (axis x or z) to `angle`, falling faster and faster, with a small bounce. */
function Hinge({ at, axis, angle, delay, children }: { at: [number, number, number]; axis: 'x' | 'z'; angle: number; delay: number; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += Math.min(delta, STEP)
    const t = Math.max(0, age.current - delay) / 0.6
    const k = t < 1 ? t * t : t < 1.4 ? 1 - 0.06 * Math.sin((Math.PI * (t - 1)) / 0.4) : 1
    g.current.rotation[axis] = angle * k
  })
  return (
    <group ref={g} position={at}>
      {children}
    </group>
  )
}

const target = new THREE.Vector3()

type Pose = { pos: [number, number, number]; rot: [number, number, number] }

/**
 * Flies its children from `from` to `to` (rotations as [pitch x, yaw y, roll z], applied yaw-last) along
 * an arc `arc` high, then a little bounce. `fall`: no arc, accelerating (something toppling over).
 */
function Flyer({ from, to, arc = 0, delay = 0, seconds = 1, fall = false, children }: {
  from: Pose
  to: Pose
  arc?: number
  delay?: number
  seconds?: number
  fall?: boolean
  children: ReactNode
}) {
  const g = useRef<THREE.Group>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += Math.min(delta, STEP)
    const t = Math.max(0, age.current - delay) / seconds
    const k = Math.min(1, fall ? t * t : t)
    const o = g.current
    o.position.set(...from.pos).lerp(target.set(...to.pos), k)
    o.position.y += arc * 4 * k * (1 - k)
    const s = (t - 1) * seconds // seconds since landing
    if (s > 0 && s < 0.25) o.position.y += 0.1 * Math.sin((Math.PI * s) / 0.25)
    o.rotation.set(
      from.rot[0] + (to.rot[0] - from.rot[0]) * k,
      from.rot[1] + (to.rot[1] - from.rot[1]) * k,
      from.rot[2] + (to.rot[2] - from.rot[2]) * k,
      'YXZ',
    )
  })
  return (
    <group ref={g} position={from.pos} rotation={new THREE.Euler(...from.rot, 'YXZ')}>
      {children}
    </group>
  )
}

/** The car body slamming down onto the pit floor (its walls are hinged on its floor, so they come with it). */
function Slam({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += Math.min(delta, STEP)
    g.current.position.y = Math.max(0, SLAM - 8 * age.current * age.current)
  })
  return (
    <group ref={g} position-y={SLAM}>
      {children}
    </group>
  )
}

const doorFrom = (side: number): Pose => ({
  pos: [CAR.x + (side * DOOR.w) / 2, START_Y + OPENING.bottom + OPENING.h / 2, CAR_FRONT_Z + DOOR.z],
  rot: [0, 0, 0],
})

/**
 * Debris spins the survivor about y and it can land facing away. This lets it spin in the air, then
 * turns it (inside the spinning piece) to face the camera once it has landed: "ta-da".
 */
function FaceYou({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += Math.min(delta, STEP)
    const k = smooth(Math.min(1, Math.max(0, (age.current - 1.1) / 0.5)))
    const spun = g.current.parent?.rotation.y ?? 0
    g.current.rotation.y = (0.35 - spun) * k // 0.35: the camera's usual angle
  })
  return <group ref={g}>{children}</group>
}
const smooth = (k: number) => k * k * (3 - 2 * k)

// Small parts scatter with the shared physics; the speaker is the survivor.
const at = (x: number, y: number, z: number): [number, number, number] => [CAR.x + x, START_Y + y, CAR.z + z]
const PIECES: Piece[] = [
  { node: <Crosshead />, pos: at(0, CAR.h / 2, 0), vel: [-1.5, 8, 0.5], rest: 0.15 },
  { node: <Handrail />, pos: at(0, 0, 0), vel: [1.5, 6, 1], rest: 0.05 },
  { node: <Beacon />, pos: at(-CAR.w / 2 + 0.45, CAR.h / 2, CAR.d / 2 - 0.45), vel: [-2, 7, 1.5], rest: 0.1 },
  { node: box(0.6, 0.24, 0.6), pos: at(0.95, CAR.h / 2 + 0.12, -0.9), vel: [2.5, 7, -0.5], rest: 0.12 },
  { node: box(OPENING.w + 0.3, 0.06, 0.08), pos: at(0, OPENING.bottom, CAR.d / 2), vel: [0.5, 4, 3], rest: 0.03 },
  { node: box(0.5, 0.3, 0.06), pos: at(-1, 1, 0), vel: [-3, 6, 2], rest: 0.03 },
  { node: box(0.4, 0.6, 0.06), pos: at(1.2, 0.5, 0), vel: [3, 7, 2], rest: 0.03 },
  { node: box(0.3, 0.3, 0.3), pos: at(0, CAR.h / 2, -1), vel: [1, 9, -1], rest: 0.15 },
  {
    node: (
      <FaceYou>
        <Tower />
      </FaceYou>
    ),
    pos: at(0, FLOOR_LOCAL + TOWER.h / 2, -0.3),
    vel: [rand(-0.3, 0.3), 7.5, 1.2],
    rest: TOWER.h / 2 + FLOOR_TOP - GROUND_Y, // stands on the car's floor
    survivor: true,
  },
]

function spawnBurst(p: Particle) {
  const dir = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-0.3, 1)).normalize()
  p.pos.set(CAR.x + rand(-1, 1), CAR.y + rand(-1, 1), CAR.z + 0.5)
  p.vel.copy(dir).multiplyScalar(rand(4, 9))
  p.life = rand(0.4, 0.9)
  p.size = rand(0.12, 0.24)
  p.grow = -0.5
}

function spawnDust(p: Particle) {
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * 3
  p.pos.set(CAR.x + 0.5 + Math.cos(a) * r, GROUND_Y + rand(0.2, 1.2), CAR.z + 1 + Math.sin(a) * r * 0.7)
  p.vel.set(Math.cos(a) * rand(0.3, 1.2), rand(0.2, 0.9), Math.sin(a) * rand(0.2, 0.8))
  p.life = rand(1.8, 3.2)
  p.size = rand(0.9, 1.6)
  p.grow = 1
}

// Snapped cables hanging from the sheave, swaying.
function DanglingCables() {
  const group = useRef<THREE.Group>(null!)
  useFrame(() => {
    const t = performance.now() / 1000
    group.current.children.forEach((c, i) => (c.rotation.z = Math.sin(t * 1.6 + i) * 0.12))
  })
  return (
    <group ref={group}>
      {[-0.12, 0, 0.12].map((dx, i) => (
        <group key={dx} position={[CAR.x + dx, SHEAVE.y, SHEAVE.z + SHEAVE.r]}>
          <mesh position-y={-(0.9 + i * 0.5) / 2}>
            <cylinderGeometry args={[0.018, 0.018, 0.9 + i * 0.5, 6]} />
            <meshStandardMaterial {...DARK_STEEL} color="#3c3f43" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Explosion({ glow }: { glow: boolean }) {
  const [phase, setPhase] = useState<'burst' | 'dust' | 'settled'>('burst')
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    if (phase === 'burst' && age.current > 0.35) setPhase('dust')
    if (phase === 'dust' && age.current > 3.5) setPhase('settled')
  })
  const after = SLAM_SECONDS // the walls burst open once the car has hit the bottom
  return (
    <group>
      <Flash position={[CAR.x, CAR.y, CAR_FRONT_Z]} color="#fff0d0" />
      <Particles count={50} active={phase === 'burst'} spawn={spawnBurst} color={SPARK} opacity={1} additive gravity={9} />
      <Particles count={40} active={phase !== 'settled'} spawn={spawnDust} color="#a49d92" opacity={0.55} />

      {/* The car body: floor, standing back wall, and three walls that fall open */}
      <Slam>
        <mesh position={[CAR.x, FLOOR_TOP - 0.025, CAR.z]}>
          <boxGeometry args={[CAR.w, 0.05, CAR.d]} />
          <meshStandardMaterial color="#2b2a2e" roughness={0.3} metalness={0.2} />
        </mesh>
        <group position={[CAR.x, FLOOR_TOP, CAR.z - CAR.d / 2 + 0.05]}>
          <CarPanel w={CAR.w} h={WALL_H} />
        </group>
        <Hinge at={[CAR.x - CAR.w / 2, FLOOR_TOP, CAR.z]} axis="z" angle={Math.PI / 2} delay={after}>
          <group rotation-y={Math.PI / 2}>
            <CarPanel w={CAR.d} h={WALL_H} />
          </group>
        </Hinge>
        <Hinge at={[CAR.x + CAR.w / 2, FLOOR_TOP, CAR.z]} axis="z" angle={-Math.PI / 2} delay={after + 0.05}>
          <group rotation-y={-Math.PI / 2}>
            <CarPanel w={CAR.d} h={WALL_H} />
          </group>
        </Hinge>
        <Hinge at={[CAR.x, FLOOR_TOP, CAR_FRONT_Z]} axis="x" angle={Math.PI / 2} delay={after + 0.1}>
          <group position-y={CAR.h / 2}>
            <FrontPlate />
          </group>
        </Hinge>
      </Slam>

      {/* The roof flips off and lands leaning against the back wall, its ceiling light facing you. */}
      <Flyer
        from={{ pos: [CAR.x, START_Y + CAR.h / 2 - 0.04, CAR.z], rot: [0, 0, 0] }}
        to={{ pos: [CAR.x, FLOOR_TOP + 1.56, CAR.z - CAR.d / 2 + 0.43], rot: [-1.79, 0, Math.PI * 2] }}
        arc={3}
        delay={0.05}
        seconds={1.1}
      >
        {box(CAR.w, 0.08, CAR.d)}
        <mesh position-y={-0.045}>
          <boxGeometry args={[CAR.w - 0.3, 0.01, CAR.d - 0.3]} />
          <meshStandardMaterial color="#fff3dc" roughness={0.6} />
        </mesh>
      </Flyer>

      {/* The doors blow off forward, flip, and land face-up on the fallen front wall. */}
      <Flyer from={doorFrom(-1)} to={{ pos: [CAR.x - 0.75, FLOOR_TOP + 0.13, CAR_FRONT_Z + 2.0], rot: [-Math.PI / 2 - Math.PI * 2, 0.35, 0] }} arc={2.2} seconds={0.95}>
        <DoorLeaf />
      </Flyer>
      <Flyer from={doorFrom(1)} to={{ pos: [CAR.x + 0.75, FLOOR_TOP + 0.17, CAR_FRONT_Z + 2.5], rot: [-Math.PI / 2 - Math.PI * 2, -0.3, 0] }} arc={2.6} seconds={1.05}>
        <DoorLeaf />
      </Flyer>

      {/* The brass plate pops off the wall and lands face-up in front of it. */}
      <Flyer
        from={{ pos: [PLATE.x, PLATE.y, WALL_FRONT_Z + PLATE.d / 2], rot: [0, 0, 0] }}
        to={{ pos: [PLATE.x + 0.15, GROUND_Y + PLATE.d / 2, WALL_FRONT_Z + 0.35 + PLATE.h / 2], rot: [-Math.PI / 2, 0.15, 0] }}
        arc={0.8}
        delay={0.05}
        seconds={0.75}
      >
        <group position-z={-PLATE.d / 2}>
          <BrassPlate />
          <PlateButtons on={false} />
        </group>
      </Flyer>

      {/* The rails snap; their lower lengths topple forward. */}
      {RAIL_X.map((x, i) => (
        <group key={x}>
          <group position={[x, RAIL_SPLIT, CAR.z]}>
            <Rail flip={i === 1} h={SHAFT_TOP - RAIL_SPLIT} />
          </group>
          <Flyer
            from={{ pos: [x, GROUND_Y + RAIL_LOW / 2, CAR.z], rot: [0, 0, 0] }}
            to={{ pos: [x + (i ? 0 : -0.3) * (RAIL_LOW / 2), GROUND_Y + 0.14, CAR.z + 0.95 * (RAIL_LOW / 2)], rot: [Math.PI / 2, i ? 0 : -0.31, 0] }}
            delay={0.25 + i * 0.15}
            seconds={0.7}
            fall
          >
            <group position-y={-RAIL_LOW / 2}>
              <Rail flip={i === 1} h={RAIL_LOW} />
            </group>
          </Flyer>
        </group>
      ))}

      <Debris pieces={PIECES} groundY={GROUND_Y} glow={glow} />

      {/* What's left standing: the shaft wall, the beams and machine with snapped cables, the scorched lobby wall. */}
      <BackWall />
      <Machine />
      <DanglingCables />
      <group position={[WALL.x, WALL.h / 2 + GROUND_Y, WALL.z]}>
        <LobbyWall scorched />
      </group>
      <mesh position={[PLATE.x, PLATE.y, WALL_FRONT_Z + 0.005]}>
        <planeGeometry args={[PLATE.w, PLATE.h]} />
        <meshStandardMaterial color="#1c1a18" roughness={1} transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  )
}
