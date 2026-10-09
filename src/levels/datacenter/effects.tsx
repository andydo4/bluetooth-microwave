// The data center's overload visuals: overheating (amber LEDs, heat haze, smoke off the rack tops)
// → failing (arcs jumping the aisle, red emergency lights, thick smoke) → the explosion, where the
// racks short out one after another and topple like dominoes. The speaker wall survives.
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import SpeakerWall from './SpeakerWall'
import { AisleLight, CableTray, CartBody, EndCap, LIGHTS, Monitor, RACKS, Rack, TRAYS } from './parts'
import {
  AISLE_HALF, CART, FLOOR_Y, MONITOR, RACK, RACK_X, RACK_Z, ROW_BACK_Z, TRAY_Y, WALL, WALL_FRONT_Z, WALL_H,
} from './dims'
import { Debris, Flash, Particles, rand, softTexture, type Particle, type Piece } from '../shared/effects'

const ROW_FRONT = RACK_Z[0] + RACK.w / 2
const randomRackTop = (p: THREE.Vector3) =>
  p.set((Math.random() < 0.5 ? -1 : 1) * RACK_X + rand(-0.5, 0.5), FLOOR_Y + RACK.h + 0.1, rand(ROW_BACK_Z + 0.1, ROW_FRONT - 0.1))

// ---------------------------------------------------------------------------------------------
// Overheating: heat haze and smoke rolling off the rack tops.

function spawnHaze(p: Particle) {
  randomRackTop(p.pos)
  p.vel.set(rand(-0.1, 0.1), rand(0.8, 1.4), rand(-0.1, 0.1))
  p.life = rand(0.8, 1.3)
  p.size = rand(0.5, 0.8)
  p.grow = 1.2
}

function spawnSmoke(p: Particle) {
  randomRackTop(p.pos)
  p.vel.set(rand(-0.2, 0.2), rand(0.5, 1.0), rand(-0.2, 0.2))
  p.life = rand(2, 3)
  p.size = rand(0.35, 0.55)
  p.grow = 3
}

// ---------------------------------------------------------------------------------------------
// Failing: jagged arcs jumping between the two rows of racks, re-drawn ~15 times a second.

function bolt(): THREE.Vector3[] {
  const y = () => rand(FLOOR_Y + 0.6, FLOOR_Y + RACK.h - 0.3)
  const z = () => rand(ROW_BACK_Z + 0.2, ROW_FRONT - 0.2)
  const start = new THREE.Vector3(-AISLE_HALF - 0.04, y(), z())
  const end = new THREE.Vector3(AISLE_HALF + 0.04, y(), z())
  if (Math.random() < 0.5) [start.x, end.x] = [end.x, start.x]
  const points = [start]
  for (let i = 1; i < SEGMENTS; i++) {
    const p = start.clone().lerp(end, i / SEGMENTS)
    p.add(new THREE.Vector3(rand(-0.12, 0.12), rand(-0.35, 0.35), rand(-0.35, 0.35)))
    points.push(p)
  }
  points.push(end)
  return points
}

const MAX_BOLTS = 3
const SEGMENTS = 8
const UP = new THREE.Vector3(0, 1, 0)

function Arcs() {
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
    let mid: THREE.Vector3 | null = null
    for (let b = 0; b < MAX_BOLTS; b++) {
      const points = b < count ? bolt() : null
      if (points && !mid) mid = points[SEGMENTS / 2]
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
        for (const [mesh, radius] of [[core, 0.025], [glow, 0.1]] as const) {
          mesh.visible = true
          mesh.position.copy(a).addScaledVector(dir, 0.5)
          mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize())
          mesh.scale.set(radius, length, radius)
        }
      }
    }
    light.current.intensity = mid ? rand(20, 50) : 0
    if (mid) light.current.position.copy(mid)
  })

  return (
    <group>
      <pointLight ref={light} color="#a9dcff" decay={2} />
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

/** Sparks spraying where an arc hits a rack. */
function spawnArcSpark(p: Particle) {
  p.pos.set((Math.random() < 0.5 ? -1 : 1) * (AISLE_HALF + 0.05), rand(FLOOR_Y + 0.6, FLOOR_Y + RACK.h - 0.3), rand(ROW_BACK_Z, ROW_FRONT))
  p.vel.set(-Math.sign(p.pos.x) * rand(0.5, 2), rand(0, 2.5), rand(-1, 1))
  p.life = rand(0.25, 0.6)
  p.size = rand(0.06, 0.12)
  p.grow = -0.5
}

/** Red emergency lights: the two beacons on the trays and a pulsing red wash over the aisle. */
export const BEACONS: [number, number, number][] = [
  [-RACK_X, TRAY_Y + 0.05, ROW_FRONT - 0.4],
  [RACK_X, TRAY_Y + 0.05, ROW_BACK_Z + 0.6],
]

/** `sprites`: draw the beacons' glow (off once the trays holding them have come down). */
function EmergencyLights({ strength = 1, sprites = true }: { strength?: number; sprites?: boolean }) {
  const lights = useRef<THREE.PointLight[]>([])
  const glows = useRef<THREE.Sprite[]>([])
  useFrame(({ clock }) => {
    const k = (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 7)) ** 2 * strength
    lights.current.forEach((l) => (l.intensity = 30 * k))
    glows.current.forEach((g) => {
      ;(g.material as THREE.SpriteMaterial).opacity = k
      g.scale.setScalar(0.6 + 0.6 * k)
    })
  })
  return (
    <group>
      {BEACONS.map((p, i) => (
        <group key={i} position={[p[0], p[1] + 0.15, p[2]]}>
          <pointLight ref={(l) => void (l && (lights.current[i] = l))} color="#ff2a14" decay={1.6} />
          <sprite ref={(s) => void (s && (glows.current[i] = s))} visible={sprites}>
            <spriteMaterial map={softTexture()} color="#ff3a1f" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  )
}

export function Overheat({ critical }: { critical: boolean }) {
  return (
    <group>
      <Particles count={24} active spawn={spawnHaze} color="#ffd9b0" opacity={0.1} />
      <Particles count={critical ? 60 : 22} active spawn={spawnSmoke} color={critical ? '#2f2f31' : '#5a5b5e'} opacity={critical ? 0.75 : 0.5} />
      {critical && (
        <>
          <Arcs />
          <Particles count={40} active spawn={spawnArcSpark} color="#ffc56b" opacity={1} additive gravity={6} />
          <EmergencyLights />
        </>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The explosion: racks short out one after another, from the speaker wall towards you, and topple
// back like dominoes, each coming to rest on the one behind it (the last one on the speaker wall).
// Rotation is about each rack's bottom back edge, in the row's (z, y) plane.

const N = RACK_Z.length
const PIVOT_Z = RACK_Z.map((z) => z - RACK.w / 2)
const H = RACK.h
const W = RACK.w

/** Rack-local (u along its depth toward the front, v up) → (z, y) above the floor, tilted back by θ. */
function corner(pivotZ: number, theta: number, u: number, v: number): [number, number] {
  return [pivotZ + u * Math.cos(theta) - v * Math.sin(theta), u * Math.sin(theta) + v * Math.cos(theta)]
}

function inside(pivotZ: number, theta: number, [z, y]: [number, number]) {
  const dz = z - pivotZ
  const u = dz * Math.cos(theta) + y * Math.sin(theta)
  const v = -dz * Math.sin(theta) + y * Math.cos(theta)
  return u > 0.001 && u < W - 0.001 && v > 0.001 && v < H - 0.001
}

// Outline samples of a rack: its back face and top (which hit the rack behind) and its front face.
const SAMPLES: [number, number][] = [
  ...Array.from({ length: 24 }, (_, i): [number, number] => [0, (H * (i + 1)) / 24]),
  ...Array.from({ length: 6 }, (_, i): [number, number] => [(W * i) / 6, H]),
  ...Array.from({ length: 24 }, (_, i): [number, number] => [W, (H * (i + 1)) / 24]),
]

/** How far a rack can tip back before hitting the one behind it (tilted by φ). Same for every pair. */
const LEAN_TABLE = (() => {
  const gap = PIVOT_Z[0] - PIVOT_Z[1]
  return Array.from({ length: 91 }, (_, i) => {
    const phi = (i / 90) * (Math.PI / 2)
    for (let theta = 0; theta < Math.PI / 2; theta += 0.004) {
      const hit =
        SAMPLES.some(([u, v]) => inside(-gap + 0, phi, corner(0, theta, u, v))) ||
        SAMPLES.some(([u, v]) => inside(0, theta, corner(-gap, phi, u, v)))
      if (hit) return Math.max(0, theta - 0.004)
    }
    return Math.PI / 2
  })
})()
const leanLimit = (phi: number) => {
  const f = (Math.min(phi, Math.PI / 2) / (Math.PI / 2)) * 90
  const i = Math.floor(f)
  return i >= 90 ? LEAN_TABLE[90] : LEAN_TABLE[i] + (LEAN_TABLE[i + 1] - LEAN_TABLE[i]) * (f - i)
}
// The last rack in each row falls flat, beside the speaker wall.
const WALL_LEAN = Math.PI / 2
// As they tip back they also roll outward a little (about the outer bottom edge), so the rows fan
// apart and the fall reads from the camera, which looks along the aisle (straight back is hard to see).
const ROLL = 0.45
const ROW_DELAY = 0.25 // between racks, matching the crash sounds in sound.ts
export const TOPPLE_START = 0.15

type Fall = { theta: number; omega: number; start: number; landed: boolean }

function ToppleRows({ onShort }: { onShort: (x: number, z: number) => void }) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const age = useRef(0)
  // Both rows: the back rack (by the wall) goes first, then the chain runs toward the camera.
  const falls = useMemo<Fall[]>(
    () => RACKS.map((r) => ({ theta: 0, omega: 0, start: TOPPLE_START + (N - 1 - r.k) * ROW_DELAY + (r.side > 0 ? 0.12 : 0), landed: false })),
    [],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.033)
    age.current += dt
    for (let i = RACKS.length - 1; i >= 0; i--) {
      const r = RACKS[i]
      const f = falls[i]
      if (age.current < f.start) continue
      if (f.omega === 0 && f.theta === 0) {
        f.omega = 0.9 // the short-out kick
        onShort(r.x, r.z)
      }
      const behind = r.k === N - 1 ? null : falls[i + 1]
      const limit = behind ? leanLimit(behind.theta) : WALL_LEAN
      f.omega += (6 * Math.sin(f.theta) + 1.2) * dt
      f.theta += f.omega * dt
      if (f.theta >= limit) {
        f.theta = limit
        f.omega = f.landed ? 0 : -Math.min(f.omega, 3) * 0.12 // a small bounce on first impact
        f.landed = true
      }
      const g = groups.current[i]
      if (g) {
        g.rotation.x = -f.theta
        g.rotation.z = -r.side * f.theta * ROLL
      }
    }
  })

  return (
    <group>
      {RACKS.map((r, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} position={[r.x + (r.side * RACK.d) / 2, FLOOR_Y, PIVOT_Z[r.k]]}>
          <group position={[(-r.side * RACK.d) / 2, H / 2, W / 2]} rotation-y={r.side < 0 ? 0 : Math.PI}>
            <Rack mode="dead" seed={r.seed} />
          </group>
          {r.k === 0 && (
            <group position={[(-r.side * RACK.d) / 2, H / 2, W + 0.006]}>
              <EndCap label={r.side < 0 ? 'ROW 01' : 'ROW 02'} />
            </group>
          )}
        </group>
      ))}
    </group>
  )
}

/** Something hanging overhead that drops after `delay` and lands at `to` with a tilt (trays, lights). */
function Drop({ from, to, tilt, delay, children }: {
  from: [number, number, number]
  to: [number, number, number]
  tilt: [number, number, number]
  delay: number
  children: ReactNode
}) {
  const g = useRef<THREE.Group>(null!)
  const age = useRef(0)
  const fallTime = Math.sqrt((2 * (from[1] - to[1])) / 16)
  useFrame((_, delta) => {
    age.current += Math.min(delta, 0.033)
    const k = Math.min(1, Math.max(0, (age.current - delay) / fallTime))
    const kk = k * k // gravity: slow start, fast landing
    g.current.position.set(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * kk, from[2] + (to[2] - from[2]) * k)
    g.current.rotation.set(tilt[0] * kk, tilt[1] * kk, tilt[2] * kk)
  })
  return (
    <group ref={g} position={from}>
      {children}
    </group>
  )
}

/** Keeps the surviving speaker wall facing the camera, whatever spin the debris gives it. */
function Upright({ children }: { children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  useFrame(() => {
    if (g.current.parent) g.current.rotation.y = -g.current.parent.rotation.y
  })
  return <group ref={g}>{children}</group>
}

function spawnBurst(p: Particle) {
  p.pos.set(rand(-1, 1), rand(FLOOR_Y + 1, FLOOR_Y + 3), rand(ROW_BACK_Z, ROW_FRONT))
  p.vel.set(rand(-4, 4), rand(1, 6), rand(-3, 3))
  p.life = rand(0.3, 0.8)
  p.size = rand(0.08, 0.16)
  p.grow = -0.5
}

function spawnWreckSmoke(p: Particle) {
  p.pos.set((Math.random() < 0.5 ? -1 : 1) * RACK_X + rand(-0.6, 0.6), FLOOR_Y + rand(0.5, 2), rand(WALL_FRONT_Z + 0.5, ROW_FRONT))
  p.vel.set(rand(-0.15, 0.15), rand(0.4, 0.9), rand(-0.15, 0.15))
  p.life = rand(2.5, 4)
  p.size = rand(0.5, 0.8)
  p.grow = 2.5
}

export function Explosion({ glow, pump }: { glow: boolean; pump: { current: boolean } }) {
  const [bursting, setBursting] = useState(true)
  const age = useRef(0)
  // Rack short-outs: the most recent few spray sparks from the rack's top.
  const shorts = useRef<{ x: number; z: number; at: number }[]>([])
  useFrame((_, delta) => {
    age.current += delta
    if (bursting && age.current > 0.35) setBursting(false)
  })

  const spawnShortSpark = useMemo(
    () => (p: Particle) => {
      const recent = shorts.current.filter((s) => age.current - s.at < 0.5)
      const s = recent.length ? recent[Math.floor(Math.random() * recent.length)] : null
      if (!s && Math.random() < 0.85) {
        p.life = 0.05 // nothing shorting right now: skip, with the odd crackle in the wreck below
        p.size = 0
        return
      }
      if (s) p.pos.set(s.x, FLOOR_Y + RACK.h * rand(0.6, 0.95), s.z)
      else p.pos.set((Math.random() < 0.5 ? -1 : 1) * RACK_X, FLOOR_Y + rand(0.4, 1.6), rand(WALL_FRONT_Z + 1, ROW_FRONT))
      p.vel.set(rand(-2.5, 2.5), rand(1, 4), rand(-1.5, 1.5))
      p.life = rand(0.3, 0.7)
      p.size = rand(0.07, 0.14)
      p.grow = -0.5
    },
    [],
  )

  const pieces = useMemo<Piece[]>(
    () => [
      {
        node: (
          <Upright>
            <SpeakerWall pump={pump} />
          </Upright>
        ),
        pos: [0, FLOOR_Y + WALL_H / 2, WALL.z],
        vel: [0, 2.2, 0.4],
        rest: WALL_H / 2,
        survivor: true,
      },
      { node: <Monitor />, pos: [0, MONITOR.y, MONITOR.z], vel: [-1, 5, -1.2], rest: 0.07 },
      {
        node: (
          <group position-y={-(CART.deckY - FLOOR_Y) / 2}>
            <CartBody />
          </group>
        ),
        pos: [0, FLOOR_Y + (CART.deckY - FLOOR_Y) / 2, CART.z],
        vel: [1, 3.5, -0.8],
        rest: 0.45,
      },
    ],
    [pump],
  )

  return (
    <group>
      <Flash position={[0, FLOOR_Y + 2, 0.5]} color="#cfe9ff" />
      <Particles count={60} active={bursting} spawn={spawnBurst} color="#ffd38a" opacity={1} additive gravity={9} />
      <Particles count={40} active spawn={spawnShortSpark} color="#ffc56b" opacity={1} additive gravity={8} />
      <ToppleRows onShort={(x, z) => shorts.current.push({ x, z, at: age.current })} />
      {TRAYS.map((t, i) => (
        <Drop key={i} from={[t.x, t.y, t.z]} to={[Math.sign(t.x) * 1.25, FLOOR_Y + 0.22, t.z - 0.3]} tilt={[0.05, Math.sign(t.x) * 0.08, Math.sign(t.x) * 0.3]} delay={0.5 + i * 0.2}>
          <CableTray />
        </Drop>
      ))}
      {LIGHTS.map((l, i) => (
        <Drop key={i} from={[l.x, l.y, l.z]} to={[l.x + (i % 2 ? 0.3 : -0.3), FLOOR_Y + 0.08, l.z - 0.2]} tilt={[0, i % 2 ? 0.5 : -0.4, 0]} delay={0.25 + i * 0.3}>
          <AisleLight bright={0} wires={false} />
        </Drop>
      ))}
      <Debris pieces={pieces} groundY={FLOOR_Y} glow={glow} />
      <Particles count={45} active spawn={spawnWreckSmoke} color="#2c2c2e" opacity={0.6} />
      <EmergencyLights strength={0.6} sprites={false} />
    </group>
  )
}
