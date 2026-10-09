// The washing machine: enamel body, console, porthole door, spinning drum with the boombox tumbling
// inside it. During the overload it rattles and spins up, then foams over; when exploded it's debris.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Boombox from './Boombox'
import { ConsoleBox, Door, Drum, FrontPlate, Gasket } from './parts'
import { Explosion, Foam } from './effects'
import { BODY, BOOMBOX_REST, CHROME, CONSOLE, DOOR_Z, DRUM, ENAMEL, FRONT_Z, PORT, RUBBER } from './dims'
import type { ModelProps } from '../types'

const DRUM_SPEED = 2.2 // rad/s while washing
const SPIN_SPEED = 16 // rad/s during the overload
const LIFT = 1.9 // how far round (rad) the paddles carry the boombox before it drops
const FALL_SECONDS = 0.45
const REST_RADIUS = PORT.y - BOOMBOX_REST.y // boombox center's distance from the drum axis

// The water in the bottom of the drum: a circle segment, extruded along the drum. Its origin is the
// bottom of the drum, so scaling y fills it from the bottom up.
const WATER_R = DRUM.r - 0.02
function useWaterGeometry() {
  return useMemo(() => {
    const top = -0.75 // water surface, relative to the drum axis
    const a = Math.asin(top / WATER_R)
    const shape = new THREE.Shape()
    shape.absarc(0, 0, WATER_R, a, Math.PI - a, true)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: DRUM.depth - 0.2, bevelEnabled: false, curveSegments: 32 })
    geo.translate(0, WATER_R, -(DRUM.depth - 0.2) / 2)
    return geo
  }, [])
}

type Tumble = { mode: 'rest' | 'carry' | 'fall' | 'pinned'; angle: number; t: number; from: THREE.Vector3; fromRot: number }

export default function Model({ on, wreck, transition, panel, overlay }: ModelProps) {
  const root = useRef<THREE.Group>(null!)
  const drum = useRef<THREE.Group>(null)
  const boombox = useRef<THREE.Group>(null)
  const water = useRef<THREE.Mesh>(null)
  const waterGeo = useWaterGeometry()
  const speed = useRef(0)
  const waterLevel = useRef(0)
  const tumble = useRef<Tumble>({ mode: 'rest', angle: -Math.PI / 2, t: 0, from: new THREE.Vector3(), fromRot: 0 })
  // Box faces are ordered +x, -x, +y, -y, +z, -z. The front (+z) is hidden; the plate and console cover it.
  const shellMaterials = useMemo(() => {
    const m = new THREE.MeshStandardMaterial(ENAMEL)
    return [m, m, m, m, new THREE.MeshBasicMaterial({ visible: false }), m]
  }, [])

  // Explosion shake, and a brand-new washer dropping in after it.
  const shakeUntil = useRef(0)
  const dropStart = useRef(-1)
  const prevWreck = useRef(wreck)
  useLayoutEffect(() => {
    const now = performance.now() / 1000
    if (wreck === 'exploded') shakeUntil.current = now + 0.8
    if (wreck === 'none' && prevWreck.current === 'exploded') {
      dropStart.current = now
      tumble.current.mode = 'rest'
    }
    prevWreck.current = wreck
  }, [wreck])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = performance.now() / 1000
    const overloading = wreck === 'overloading' || wreck === 'critical'

    // Drum: eases up to washing speed, or way past it during the overload.
    const target = overloading ? SPIN_SPEED : on ? DRUM_SPEED : 0
    speed.current += (target - speed.current) * Math.min(1, dt * (overloading ? 0.8 : 2))
    if (drum.current) drum.current.rotation.z += speed.current * dt

    // Water fills while it's running.
    waterLevel.current += ((on ? 1 : 0) - waterLevel.current) * Math.min(1, dt * 1.5)
    if (water.current) {
      water.current.visible = waterLevel.current > 0.02
      water.current.scale.y = waterLevel.current
      water.current.rotation.z = Math.sin(now * 2.6) * 0.06 * waterLevel.current // sloshing
    }

    // The boombox: carried up the side by the paddles, then drops back down with a flip.
    // During the overload the spin pins it to the drum wall.
    const s = tumble.current
    if (overloading && s.mode !== 'pinned') {
      s.mode = 'pinned'
      if (boombox.current) s.angle = Math.atan2(boombox.current.position.y - PORT.y, boombox.current.position.x - PORT.x)
    }
    if (s.mode === 'pinned' && !overloading) s.mode = 'carry'
    if (s.mode === 'rest' && on) s.mode = 'carry'
    if (s.mode === 'carry' || s.mode === 'pinned') {
      s.angle += speed.current * dt
      if (s.mode === 'carry' && (s.angle >= -Math.PI / 2 + LIFT || !on)) {
        s.mode = 'fall'
        s.t = 0
        s.from.set(PORT.x + Math.cos(s.angle) * REST_RADIUS, PORT.y + Math.sin(s.angle) * REST_RADIUS, BOOMBOX_REST.z)
        s.fromRot = (s.angle + Math.PI / 2) % (Math.PI * 2)
      }
    }
    if (boombox.current) {
      const b = boombox.current
      if (s.mode === 'fall') {
        s.t += dt
        const k = Math.min(1, s.t / FALL_SECONDS)
        b.position.set(s.from.x * (1 - k) + PORT.x * k, s.from.y + (BOOMBOX_REST.y - s.from.y) * k * k, BOOMBOX_REST.z)
        // Flips over and lands upright (or just settles back, if it was barely lifted).
        const landRot = s.fromRot > Math.PI / 2 ? Math.PI * 2 : 0
        b.rotation.z = s.fromRot + (landRot - s.fromRot) * k
        if (k === 1) {
          s.mode = 'rest'
          s.angle = -Math.PI / 2
          b.rotation.z = 0
        }
      } else if (s.mode === 'rest') {
        b.position.set(PORT.x, BOOMBOX_REST.y, BOOMBOX_REST.z)
        b.rotation.z = 0
      } else {
        b.position.set(PORT.x + Math.cos(s.angle) * REST_RADIUS, PORT.y + Math.sin(s.angle) * REST_RADIUS, BOOMBOX_REST.z)
        b.rotation.z = s.angle + Math.PI / 2
      }
    }

    // Shaking: a violent rattle during the overload, a jolt when it blows. Not while just washing:
    // the control panel rides on the machine, and a jittering panel is hard to click.
    const rattle = wreck === 'critical' ? 0.14 : wreck === 'overloading' ? 0.06 : 0
    const blast = (Math.max(0, shakeUntil.current - now) / 0.8) * 0.5
    const amount = rattle + blast
    root.current.position.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount * 0.6, 0)
    root.current.rotation.z = wreck === 'critical' ? (Math.random() - 0.5) * 0.03 : 0

    if (dropStart.current >= 0) {
      const t = Math.min(1, (now - dropStart.current) / 0.7)
      root.current.position.y = 7 * (1 - t) * (1 - t) // falls in, landing as the chime plays
      if (t === 1) dropStart.current = -1
    }
  })

  if (wreck === 'exploded') {
    return (
      <group ref={root}>
        <Explosion glow={transition === 'out'} />
      </group>
    )
  }

  return (
    <group ref={root}>
      {(wreck === 'overloading' || wreck === 'critical') && <Foam critical={wreck === 'critical'} />}

      {/* Outer shell: one open-fronted box (separate wall boxes would z-fight at the edges). */}
      <mesh material={shellMaterials}>
        <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
      </mesh>

      <group position-z={FRONT_Z}>
        <FrontPlate />
      </group>
      <group position={[PORT.x, PORT.y, FRONT_Z - 0.02]}>
        <Gasket />
      </group>

      {/* Drum, water, and the boombox tumbling in it */}
      <group ref={drum} position={[PORT.x, PORT.y, DRUM.z]}>
        <Drum glow={on ? 0.12 : 0} />
      </group>
      <mesh ref={water} geometry={waterGeo} position={[PORT.x, PORT.y - WATER_R, DRUM.z]} renderOrder={1} visible={false}>
        <meshStandardMaterial color="#5fb4e6" transparent opacity={0.45} roughness={0.1} depthWrite={false} />
      </mesh>
      <group ref={boombox} position={[PORT.x, BOOMBOX_REST.y, BOOMBOX_REST.z]}>
        <Boombox />
      </group>
      <pointLight position={[PORT.x, PORT.y + 0.6, 1.2]} color="#dff1ff" intensity={on ? 6 : 1.5} decay={2} />

      <group position={[PORT.x, PORT.y, DOOR_Z]}>
        <Door />
      </group>

      {/* Console. Phones (no panel on the face) get a decorative dial and display instead. */}
      <group position={[0, CONSOLE.y, CONSOLE.z]}>
        <ConsoleBox />
        {/* Detergent drawer, far left */}
        <mesh position={[-1.55, 0, CONSOLE.d / 2 + 0.02]}>
          <boxGeometry args={[0.9, 0.55, 0.04]} />
          <meshStandardMaterial {...ENAMEL} color="#dfe2e6" />
        </mesh>
        {!panel && (
          <>
            <mesh position={[0.2, 0, CONSOLE.d / 2 + 0.01]}>
              <boxGeometry args={[1.2, 0.4, 0.02]} />
              <meshStandardMaterial color="#0b1410" emissive="#4dff88" emissiveIntensity={on ? 0.15 : 0.04} />
            </mesh>
            <mesh position={[1.45, 0, CONSOLE.d / 2 + 0.08]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.32, 0.32, 0.16, 40]} />
              <meshStandardMaterial {...CHROME} />
            </mesh>
          </>
        )}
      </group>
      {/* occlude="blending": the HTML sits behind the canvas and shows through a cut-out. */}
      {panel && (
        <Html
          transform
          occlude="blending"
          distanceFactor={2}
          portal={overlay}
          position={[0.45, CONSOLE.y, CONSOLE.z + CONSOLE.d / 2 + 0.005]}
        >
          <div className="@container w-[560px]">{panel}</div>
        </Html>
      )}

      {/* Kick plate and feet */}
      <mesh position={[0, -BODY.h / 2 + 0.15, FRONT_Z + 0.01]}>
        <boxGeometry args={[BODY.w - 0.3, 0.12, 0.02]} />
        <meshStandardMaterial {...ENAMEL} color="#d4d7dc" />
      </mesh>
      {[[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, -BODY.h / 2 - 0.06, z]}>
          <cylinderGeometry args={[0.16, 0.16, 0.12, 16]} />
          <meshStandardMaterial {...RUBBER} />
        </mesh>
      ))}
    </group>
  )
}
