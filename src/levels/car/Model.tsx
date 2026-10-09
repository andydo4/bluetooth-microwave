// The car: a chunky red hatchback seen from the rear three-quarter, hatch up, a subwoofer box in the
// trunk. While playing the woofers pump, the body bounces on its springs to the beat (wheels stay put),
// the glass rattles and the lights come on. The head unit sits on a show stand to its left (desktop);
// phones show the car alone, bigger.
// During the overload it revs, shakes and smokes, then catches fire; when exploded it's debris.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import SubBox, { useCarpet } from './SubBox'
import { Body, DashPlate, Glass, Hatch, Interior, StandBase, Wheel } from './parts'
import { Explosion, OverloadFx, StandWreck } from './effects'
import { softTexture } from '../shared/effects'
import { BODY, CAR, COMPACT, GROUND_Y, HATCH_OPEN, HINGE, PLATE, STAND, SUB_POS, WHEEL, kick } from './dims'
import type { ModelProps } from '../types'

const WHEELS: [number, number][] = [[-WHEEL.x, WHEEL.z], [WHEEL.x, WHEEL.z], [-WHEEL.x, -WHEEL.z], [WHEEL.x, -WHEEL.z]]

export default function Model({ on, wreck, transition, panel, overlay }: ModelProps) {
  const root = useRef<THREE.Group>(null!)
  const body = useRef<THREE.Group>(null)
  const glass = useRef<THREE.Group>(null)
  const hatch = useRef<THREE.Group>(null)
  const underglow = useRef<THREE.MeshBasicMaterial>(null)
  const wheels = useRef<(THREE.Group | null)[]>([])
  const carpet = useCarpet()
  // The sub box (and its debris copy, made once) reads this to know whether to pump.
  const pump = useRef(on)
  pump.current = on
  const playing = useRef(0) // eases 0 → 1 while on, so the bounce fades in and out
  const wheelSpeed = useRef(0)

  // Layout: wide (car + head-unit stand side by side) when the controls are on the stand, compact
  // (car alone, bigger) on phones. Exploding drops the panel, so the layout is held from before.
  const size = useThree((s) => s.size)
  const compactRef = useRef<boolean | null>(null)
  if (wreck !== 'exploded') compactRef.current = !panel
  const compact = compactRef.current ?? size.width < size.height
  const scale = compact ? COMPACT.scale : 1
  const carAt = compact ? COMPACT.car : CAR

  // Light materials, flashed and dimmed every frame.
  const lights = useMemo(
    () => ({
      head: new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#fff1c9', emissiveIntensity: 0.2, toneMapped: false }),
      tail: new THREE.MeshStandardMaterial({ color: '#6d0b0b', emissive: '#ff1a1a', emissiveIntensity: 0.15, toneMapped: false }),
    }),
    [],
  )

  // Explosion shake, and a brand-new car dropping in after it.
  const shakeUntil = useRef(0)
  const dropStart = useRef(-1)
  const prevWreck = useRef(wreck)
  useLayoutEffect(() => {
    const now = performance.now() / 1000
    if (wreck === 'exploded') shakeUntil.current = now + 0.8
    if (wreck === 'none' && prevWreck.current === 'exploded') dropStart.current = now
    prevWreck.current = wreck
  }, [wreck])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = performance.now() / 1000
    const overloading = wreck === 'overloading' || wreck === 'critical'
    const critical = wreck === 'critical'

    playing.current += ((on ? 1 : 0) - playing.current) * Math.min(1, dt * 3)
    const k = kick(now) * playing.current

    // The bass bounces the body on its springs (rear squats on each kick); the wheels stay planted.
    // During the overload it bucks about at random instead.
    if (body.current) {
      const buck = critical ? 0.09 : overloading ? 0.05 : 0
      body.current.position.y = k * 0.1 + (Math.random() - 0.5) * buck
      body.current.rotation.z = -k * 0.03 + (Math.random() - 0.5) * buck * 0.4
      body.current.rotation.x = (Math.random() - 0.5) * buck * 0.3
    }
    // Windows rattle in their frames, and the hatch lid bobs.
    if (glass.current) glass.current.position.set((Math.random() - 0.5) * 0.014 * k, (Math.random() - 0.5) * 0.014 * k, 0)
    if (hatch.current) hatch.current.rotation.z = HATCH_OPEN - k * 0.05

    // Revving: a burnout. The wheels spin up in place.
    wheelSpeed.current += ((overloading ? 28 : 0) - wheelSpeed.current) * Math.min(1, dt * 1.2)
    wheels.current.forEach((w) => w && (w.rotation.z += wheelSpeed.current * dt))

    // Lights: on while playing (the brake lights flare with the beat); strobing during the overload.
    const strobe = Math.floor(now * 9) % 2 === 0
    lights.head.emissiveIntensity = overloading ? (strobe ? 4 : 0) : 0.2 + playing.current * 2.2
    lights.tail.emissiveIntensity = overloading ? (strobe ? 0 : 4) : 0.15 + playing.current * (1.2 + k * 2)
    if (underglow.current) underglow.current.opacity = playing.current * (0.45 + k * 0.4)

    // Shaking: hard during the overload, a jolt when it blows. Not while just playing: the control
    // panel sits on the stand, and a jittering panel is hard to click.
    const rattle = critical ? 0.13 : overloading ? 0.06 : 0
    const blast = (Math.max(0, shakeUntil.current - now) / 0.8) * 0.5
    const amount = rattle + blast
    root.current.position.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount * 0.6, 0)
    root.current.rotation.z = critical ? (Math.random() - 0.5) * 0.02 : 0

    if (dropStart.current >= 0) {
      const t = Math.min(1, (now - dropStart.current) / 0.7)
      root.current.position.y = 7 * (1 - t) * (1 - t) // falls in, landing as the chime plays
      if (t === 1) dropStart.current = -1
    }
  })

  if (wreck === 'exploded') {
    return (
      <group ref={root}>
        <group position-y={GROUND_Y} scale={scale}>
          <group position={[carAt.x, 0, carAt.z]} rotation-y={CAR.yaw}>
            <Explosion glow={transition === 'out'} pump={pump} />
          </group>
          {!compact && (
            <group position={[STAND.x, 0, STAND.z]} rotation-y={STAND.yaw}>
              <StandWreck />
            </group>
          )}
        </group>
      </group>
    )
  }

  return (
    <group ref={root}>
      <group position-y={GROUND_Y} scale={scale}>
        {/* The car, in its own frame (see dims.ts) */}
        <group position={[carAt.x, 0, carAt.z]} rotation-y={CAR.yaw}>
          {WHEELS.map(([x, z], i) => (
            <group key={i} position={[x, WHEEL.r, z]}>
              {/* Wheels are symmetrical, so no flip for the far side (spin stays the same way) */}
              <group ref={(el) => void (wheels.current[i] = el)}>
                <Wheel />
              </group>
            </group>
          ))}

          <group ref={body}>
            <Body />
            <Interior carpet={carpet} />
            <group ref={glass}>
              <Glass />
            </group>
            <group ref={hatch} position={[HINGE.x, HINGE.y, 0]} rotation-z={HATCH_OPEN}>
              <Hatch tail={lights.tail} />
            </group>

            {/* The subwoofer box in the trunk, firing out of the open hatch */}
            <group position={[SUB_POS.x, SUB_POS.y, 0]} rotation-y={Math.PI / 2}>
              <SubBox pump={pump} />
            </group>
            <pointLight position={[3.4, 2.0, 0]} color="#fff3e0" intensity={on ? 5 : 2.5} decay={2} />

            {/* Headlights and taillights */}
            {[0.85, -0.85].map((z) => (
              <mesh key={z} position={[-2.955, 0.88, z]} material={lights.head}>
                <boxGeometry args={[0.04, 0.16, 0.55]} />
              </mesh>
            ))}
            {[1, -1].map((s) => (
              <mesh key={s} position={[2.905, 0.93, s * (BODY.w / 2 - 0.27)]} material={lights.tail}>
                <boxGeometry args={[0.055, 0.28, 0.56]} />
              </mesh>
            ))}
          </group>

          {/* Underglow on the floor while playing */}
          <mesh position-y={0.02} rotation-x={-Math.PI / 2} renderOrder={1}>
            <planeGeometry args={[7, 3.8]} />
            <meshBasicMaterial
              ref={underglow}
              map={softTexture()}
              color="#3fd0ff"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>

          {(wreck === 'overloading' || wreck === 'critical') && <OverloadFx critical={wreck === 'critical'} />}
        </group>

        {/* The head-unit stand, with the controls on its dash plate. Phones have them in the sheet instead. */}
        {panel && (
          <group position={[STAND.x, 0, STAND.z]} rotation-y={STAND.yaw}>
            <StandBase />
            <group position-y={PLATE.y} rotation-x={PLATE.tilt}>
              <DashPlate />
              {/* occlude="blending": the HTML sits behind the canvas and shows through a cut-out. */}
              <Html transform occlude="blending" distanceFactor={2} portal={overlay} position={[0, -0.04, PLATE.d / 2 + 0.005]}>
                <div className="@container w-[600px]">{panel}</div>
              </Html>
            </group>
          </group>
        )}
      </group>
    </group>
  )
}
