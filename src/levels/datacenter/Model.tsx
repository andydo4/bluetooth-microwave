// The data center aisle: raised floor, two rows of racks facing a cold aisle, cable trays and cold
// blue lights overhead, the PA speaker wall at the far end, the crash cart (with the terminal) in
// front. During the overload the racks overheat, then arc and fail; when exploded they topple.
import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import SpeakerWall, { beat } from './SpeakerWall'
import { AisleLight, Beacon, CableTray, CartBody, EndCap, LIGHTS, Monitor, RACKS, Rack, TRAYS, TrayHangers, RaisedFloor, type LedMode } from './parts'
import { BEACONS, Explosion, Overheat } from './effects'
import { AIM, CART, FLOOR_Y, MONITOR, RACK, RACK_X, RACK_Z, SCREEN_Z, WALL, WALL_FRONT_Z, WALL_H } from './dims'
import type { ModelProps } from '../types'

const ROW_FRONT = RACK_Z[0] + RACK.w / 2

export default function Model({ on, wreck, transition, panel, overlay }: ModelProps) {
  const root = useRef<THREE.Group>(null!)
  const stage = useRef<THREE.PointLight>(null!)
  const aisle = useRef<THREE.PointLight>(null)
  // The speaker wall reads this every frame, so the debris copy keeps pumping without re-mounting.
  const pump = useRef(on)
  pump.current = on

  // Explosion shake, and a brand-new data center dropping in after it.
  const shakeUntil = useRef(0)
  const dropStart = useRef(-1)
  const prevWreck = useRef(wreck)
  useLayoutEffect(() => {
    const now = performance.now() / 1000
    if (wreck === 'exploded') shakeUntil.current = now + 0.8
    if (wreck === 'none' && prevWreck.current === 'exploded') dropStart.current = now
    prevWreck.current = wreck
  }, [wreck])

  useFrame(({ clock }) => {
    const now = performance.now() / 1000

    // A light washing over the speaker wall, flashing on the kick while it plays.
    if (stage.current) stage.current.intensity = 14 + (on && wreck === 'none' ? beat(clock.getElapsedTime()) * 30 : 0)

    // Critical: the aisle light turns into a pulsing red emergency light.
    if (aisle.current) {
      const red = wreck === 'critical'
      aisle.current.color.set(red ? '#ff2414' : '#9fd8ff')
      aisle.current.intensity = red ? 40 * (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 7)) ** 2 : 24
    }

    // Shaking: a rumble during the overload, a jolt when it blows. Not while just playing: the
    // control panel rides on the cart, and a jittering panel is hard to click.
    const rattle = wreck === 'critical' ? 0.1 : wreck === 'overloading' ? 0.04 : 0
    const blast = (Math.max(0, shakeUntil.current - now) / 0.8) * 0.4
    const amount = rattle + blast
    root.current.position.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount * 0.6, 0)

    if (dropStart.current >= 0) {
      const t = Math.min(1, (now - dropStart.current) / 0.7)
      root.current.position.y = 7 * (1 - t) * (1 - t) // falls in, landing as the chime plays
      if (t === 1) dropStart.current = -1
    }
  })

  // The room around the racks: floor, the speaker wall, and the lights stay put through everything.
  const room = (
    <>
      <RaisedFloor />
      <pointLight ref={stage} position={[0, FLOOR_Y + 3.4, WALL_FRONT_Z + 1.8]} color="#cfe4ff" intensity={14} decay={2} />
    </>
  )

  if (wreck === 'exploded') {
    return (
      <group ref={root} rotation-y={AIM}>
        {room}
        <Explosion glow={transition === 'out'} pump={pump} />
      </group>
    )
  }

  const overloading = wreck === 'overloading' || wreck === 'critical'
  const mode: LedMode = overloading ? 'alarm' : on ? 'busy' : 'idle'

  return (
    <group ref={root} rotation-y={AIM}>
      {room}
      {overloading && <Overheat critical={wreck === 'critical'} />}

      {/* Two rows of racks, doors facing the aisle */}
      {RACKS.map((r) => (
        <group key={`${r.side}${r.k}`} position={[r.x, FLOOR_Y + RACK.h / 2, r.z]} rotation-y={r.side < 0 ? 0 : Math.PI}>
          <Rack mode={mode} seed={r.seed} />
        </group>
      ))}
      {/* Row end caps facing you: vents, a row label, and a cold blue light strip */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * RACK_X, FLOOR_Y + RACK.h / 2, ROW_FRONT + 0.006]}>
          <EndCap label={side < 0 ? 'ROW 01' : 'ROW 02'} />
          <mesh position={[-side * 0.5, -0.15, 0.006]}>
            <planeGeometry args={[0.05, RACK.h - 0.9]} />
            <meshBasicMaterial color={new THREE.Color('#7fd0ff').multiplyScalar(overloading ? 0.3 : 1.4)} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Overhead: cable trays on hangers, emergency beacons, cold aisle lights */}
      {TRAYS.map((t, i) => (
        <group key={i}>
          <group position={[t.x, t.y, t.z]}>
            <CableTray />
          </group>
          <TrayHangers x={t.x} z={t.z} />
        </group>
      ))}
      {BEACONS.map((p, i) => (
        <group key={i} position={p}>
          <Beacon glow={wreck === 'critical' ? 0.5 : 0.05} />
        </group>
      ))}
      {LIGHTS.map((l, i) => (
        <group key={i} position={[l.x, l.y, l.z]}>
          <AisleLight alarm={wreck === 'critical'} />
        </group>
      ))}

      {/* One cold light for the whole aisle (each extra light costs every pixel on phones). */}
      <pointLight ref={aisle} position={[0, LIGHTS[1].y - 0.5, LIGHTS[1].z]} color="#9fd8ff" intensity={24} decay={1.6} />

      {/* The speaker wall at the end of the aisle */}
      <group position={[0, FLOOR_Y + WALL_H / 2, WALL.z]}>
        <SpeakerWall pump={pump} />
      </group>

      {/* The crash cart. Phones (no panel on the screen) get a decorative terminal instead. */}
      <group position={[CART.x, FLOOR_Y, CART.z]}>
        <CartBody />
      </group>
      <group position={[0, MONITOR.y, MONITOR.z]}>
        <Monitor screen={!panel} />
      </group>
      {/* occlude="blending": the HTML sits behind the canvas and shows through a cut-out. */}
      {panel && (
        <Html transform occlude="blending" distanceFactor={2} portal={overlay} position={[0, MONITOR.y, SCREEN_Z + 0.005]}>
          <div className="@container w-[620px]">{panel}</div>
        </Html>
      )}
    </group>
  )
}
