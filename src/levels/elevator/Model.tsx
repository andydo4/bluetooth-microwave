// The elevator: a cut-away slice of a lift shaft. The steel car hangs on its cables between two guide
// rails, its glass-windowed doors open while idle and slide shut while a song plays (the floor
// indicator above them climbs). The speaker tower stands inside. The brass control plate is on the
// lobby wall beside the doors. During the overload the car shakes and strains, then slips in jolts
// with sparks pouring down the shaft; when exploded it's debris.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Tower, { TOWER, TowerOn } from './Tower'
import {
  Beacon, BackWall, BrassPlate, PlateButtons, Buffers, Crosshead, DoorLeaf, FrontPlate, Handrail, LobbyWall, Machine, Rail, RoofRail,
  useLiningMaterials, useShellMaterials,
} from './parts'
import { Explosion, Sparks } from './effects'
import {
  BACK_WALL, BRASS, CABLE_X, CAR, CAR_FRONT_Z, CAR_TOP, DARK_STEEL, DOOR, FLOOR_LOCAL, GROUND_Y, INDICATOR_Y, JOLT_DROP, JOLTS, LAMP_Y,
  LINING_INSET, OPENING, PLATE, PLATE_FRONT_Z, RAIL_X, SHEAVE, WALL, WALL_FRONT_Z,
} from './dims'
import { lift } from './signals'
import type { ModelProps } from '../types'

const DOOR_SECONDS = 1.1 // to slide fully open or shut
const FLOOR_SECONDS = 2.5 // per floor, climbing while a song plays
const FALL_FLOOR_SECONDS = 0.12 // per floor, plummeting (critical)
const HITCH_Y = 0.46 // top of the crosshead's hitch plate, above the car roof
const RAIL_BACK = CAR.z - 0.1 // back of the guide rails' flange
const WALL_FACE = BACK_WALL.z + BACK_WALL.d / 2

type Arrow = '' | 'up' | 'down'

const smooth = (k: number) => k * k * (3 - 2 * k)

function floorLabel(n: number) {
  return n === 0 ? 'L' : n < 0 ? `B${-n}` : n > 99 ? 'PH' : String(n)
}

// The amber floor indicator above the doors: a canvas texture redrawn only when its text changes.
function useIndicator() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 96
    const g = canvas.getContext('2d')!
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    let last = { text: '', arrow: '' as Arrow }
    const draw = (text: string, arrow: Arrow, force = false) => {
      if (text === last.text && arrow === last.arrow && !force) return
      last = { text, arrow }
      g.fillStyle = '#0a0503'
      g.fillRect(0, 0, 256, 96)
      g.fillStyle = '#ffb347'
      g.shadowColor = '#ff8a1f'
      g.shadowBlur = 10
      if (arrow) {
        const up = arrow === 'up'
        g.beginPath()
        g.moveTo(26, up ? 66 : 30)
        g.lineTo(62, up ? 66 : 30)
        g.lineTo(44, up ? 28 : 68)
        g.closePath()
        g.fill()
      }
      g.font = 'italic 64px "DSEG14", ui-monospace, monospace'
      g.textAlign = 'right'
      g.textBaseline = 'middle'
      g.fillText(text, 236, 50)
      texture.needsUpdate = true
    }
    // The LED font may still be loading on the first draw.
    void document.fonts?.ready.then(() => draw(last.text, last.arrow, true))
    return { texture, draw }
  }, [])
}

export default function Model({ on, wreck, transition, panel, overlay }: ModelProps) {
  const root = useRef<THREE.Group>(null!)
  const car = useRef<THREE.Group>(null!)
  const doorL = useRef<THREE.Group>(null!)
  const doorR = useRef<THREE.Group>(null!)
  const cables = useRef<(THREE.Group | null)[]>([])
  const sheave = useRef<THREE.Group | null>(null)
  const cabinLight = useRef<THREE.PointLight>(null)
  const alarmLight = useRef<THREE.PointLight>(null)
  const beaconMat = useRef<THREE.MeshStandardMaterial | null>(null)
  const lampMat = useRef<THREE.MeshStandardMaterial>(null)
  const shell = useShellMaterials()
  const lining = useLiningMaterials()
  const indicator = useIndicator()
  const indicatorMat = useRef<THREE.MeshBasicMaterial>(null)

  const doors = useRef(1) // 1 = open
  const floor = useRef({ n: 0, t: 0 })
  const criticalAt = useRef(-1)

  // Explosion shake, and a brand-new elevator dropping in after it.
  const shakeUntil = useRef(0)
  const dropStart = useRef(-1)
  const prevWreck = useRef(wreck)
  useLayoutEffect(() => {
    const now = performance.now() / 1000
    if (wreck === 'critical') criticalAt.current = now
    if (wreck === 'exploded') shakeUntil.current = now + 0.8
    if (wreck === 'none' && prevWreck.current === 'exploded') {
      dropStart.current = now
      floor.current = { n: 0, t: 0 }
      doors.current = 1
    }
    prevWreck.current = wreck
  }, [wreck])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = performance.now() / 1000
    const overloading = wreck === 'overloading' || wreck === 'critical'
    const critical = wreck === 'critical'
    const sinceCritical = now - criticalAt.current

    if (wreck !== 'exploded') {
      // Doors: open while idle (or held open with OPEN), shut while playing and while it's going wrong.
      const target = wreck === 'none' && (!on || lift.doorsHeld) ? 1 : 0
      const step = dt / DOOR_SECONDS
      doors.current = target > doors.current ? Math.min(target, doors.current + step) : Math.max(target, doors.current - step)
      const slide = DOOR.travel * smooth(doors.current)
      doorL.current.position.x = -DOOR.w / 2 - slide
      doorR.current.position.x = DOOR.w / 2 + slide

      // Floor indicator: climbs while playing, plummets (into the basements) while falling.
      const f = floor.current
      let arrow: Arrow = ''
      if (critical) {
        f.t += dt
        while (f.t > FALL_FLOOR_SECONDS) {
          f.t -= FALL_FLOOR_SECONDS
          f.n -= 1
        }
        arrow = 'down'
      } else if (wreck === 'overloading') {
        arrow = Math.floor(now * 6) % 2 ? 'up' : 'down' // confused
      } else if (on) {
        f.t += dt
        while (f.t > FLOOR_SECONDS) {
          f.t -= FLOOR_SECONDS
          f.n += 1
        }
        arrow = 'up'
      }
      indicator.draw(floorLabel(f.n), arrow)
      if (indicatorMat.current) indicatorMat.current.color.setScalar(overloading && Math.random() < 0.25 ? 0.3 : 1)

      // The car: strains and shakes during the overload, then slips down in jolts onto the buffers.
      let drop = 0
      if (critical) for (const j of JOLTS) drop += JOLT_DROP * smooth(Math.min(1, Math.max(0, (sinceCritical - j) / 0.08)))
      const jolt = critical && JOLTS.some((j) => sinceCritical > j && sinceCritical < j + 0.25) ? 0.06 : 0
      const shake = (critical ? 0.035 : overloading ? 0.02 : 0) + jolt
      const sx = (Math.random() - 0.5) * shake
      const sy = (Math.random() - 0.5) * shake * 0.5
      car.current.position.set(CAR.x + sx, CAR.y - drop + sy, CAR.z + (Math.random() - 0.5) * shake * 0.5)

      // Cables run from the sheave down to the hitch, following the car. Two snap when it starts falling.
      const hitch = CAR_TOP - drop + sy + HITCH_Y
      cables.current.forEach((c, i) => {
        if (!c) return
        const snapped = critical && ((i === 0 && sinceCritical > 0.1) || (i === 3 && sinceCritical > 0.95))
        const len = snapped ? 0.8 : SHEAVE.y - hitch
        c.position.set(CABLE_X[i] + sx, hitch, CAR.z)
        c.rotation.z = snapped ? Math.sin(now * 7 + i) * 0.6 : 0
        const mesh = c.children[0]
        mesh.scale.y = len
        mesh.position.y = len / 2
      })
      if (sheave.current) sheave.current.rotation.x += (critical ? 5 : on && !overloading ? -0.5 : 0) * dt

      // Cabin light: steady and warm; flickers when the car strains, mostly dark as it falls.
      const lit = critical ? (Math.random() < 0.3 ? 1 : 0.08) : overloading ? (Math.random() < 0.2 ? 0.2 : 1) : 1
      lining.ceiling.emissiveIntensity = 0.9 * lit
      if (cabinLight.current) cabinLight.current.intensity = 7 * lit

      // Alarm lamps: flash red while falling, or for a moment after ALARM is pressed.
      const alarm = critical || now - lift.alarmAt < 1.5
      const flash = alarm && (now * 4) % 1 < 0.5
      if (beaconMat.current) beaconMat.current.emissiveIntensity = flash ? 5 : 0.15
      if (lampMat.current) lampMat.current.emissiveIntensity = flash ? 5 : 0.15
      if (alarmLight.current) alarmLight.current.intensity = flash ? 35 : 0
    }

    // The whole scene only shakes as the car falls and when it blows: not while just playing, since
    // the control panel rides on the wall, and a jittering panel is hard to click.
    const blast = (Math.max(0, shakeUntil.current - now) / 0.8) * 0.5
    const amount = (critical ? 0.03 : 0) + blast
    root.current.position.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount * 0.6, 0)

    if (dropStart.current >= 0) {
      const t = Math.min(1, (now - dropStart.current) / 0.7)
      root.current.position.y = 7 * (1 - t) * (1 - t) // falls in, landing as the chime plays
      if (t === 1) dropStart.current = -1
    }
  })

  if (wreck === 'exploded') {
    return (
      <group ref={root}>
        <TowerOn.Provider value={on}>
          <Explosion glow={transition === 'out'} />
        </TowerOn.Provider>
      </group>
    )
  }

  const overloading = wreck === 'overloading' || wreck === 'critical'

  return (
    <group ref={root}>
      {overloading && <Sparks critical={wreck === 'critical'} />}

      {/* The shaft: concrete back wall, guide rails, the hoist machine on its beams, pit buffers. */}
      <BackWall />
      {RAIL_X.map((x, i) => (
        <group key={x} position={[x, GROUND_Y, CAR.z]}>
          <Rail flip={i === 1} />
          {/* Brackets tying the rail back to the wall */}
          {[-2.2, 0, 2.2].map((y) => (
            <mesh key={y} position={[0, y - GROUND_Y, (RAIL_BACK + WALL_FACE) / 2 - CAR.z]}>
              <boxGeometry args={[0.08, 0.08, RAIL_BACK - WALL_FACE]} />
              <meshStandardMaterial {...DARK_STEEL} />
            </mesh>
          ))}
        </group>
      ))}
      <Machine sheave={(g) => void (sheave.current = g)} />
      <Buffers />

      {/* Hoist cables (unit-length cylinders, stretched every frame from the hitch up to the sheave) */}
      {CABLE_X.map((x, i) => (
        <group key={x} ref={(g) => void (cables.current[i] = g)} position={[x, CAR_TOP + HITCH_Y, CAR.z]}>
          <mesh scale-y={SHEAVE.y - CAR_TOP - HITCH_Y} position-y={(SHEAVE.y - CAR_TOP - HITCH_Y) / 2}>
            <cylinderGeometry args={[0.018, 0.018, 1, 6]} />
            <meshStandardMaterial {...DARK_STEEL} color="#3c3f43" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* The car */}
      <group ref={car} position={[CAR.x, CAR.y, CAR.z]}>
        {/* Outer shell: one open-fronted box (separate wall boxes would z-fight at the edges), and inside it
            a BackSide lining: bronze walls, a glowing ceiling, a dark stone floor. */}
        <mesh material={shell}>
          <boxGeometry args={[CAR.w, CAR.h, CAR.d]} />
        </mesh>
        <mesh material={lining.all}>
          <boxGeometry args={[CAR.w - LINING_INSET * 2, CAR.h - LINING_INSET * 2, CAR.d - LINING_INSET * 2]} />
        </mesh>
        <pointLight ref={cabinLight} position={[0, CAR.h / 2 - 0.5, 0.3]} color="#ffd9a3" intensity={7} decay={2} />
        <Handrail />

        <group position={[0, FLOOR_LOCAL + TOWER.h / 2, -0.3]}>
          <TowerOn.Provider value={on}>
            <Tower />
          </TowerOn.Provider>
        </group>

        <group position-z={CAR.d / 2}>
          <FrontPlate />
          {/* Floor indicator above the doors */}
          <mesh position={[0, INDICATOR_Y, 0.012]}>
            <boxGeometry args={[1.0, 0.42, 0.02]} />
            <meshStandardMaterial color="#111" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, INDICATOR_Y, 0.023]}>
            <planeGeometry args={[0.9, 0.34]} />
            <meshBasicMaterial ref={indicatorMat} map={indicator.texture} toneMapped={false} />
          </mesh>
          <group ref={doorL} position={[-DOOR.w / 2 - DOOR.travel, OPENING.bottom + OPENING.h / 2, DOOR.z]}>
            <DoorLeaf />
          </group>
          <group ref={doorR} position={[DOOR.w / 2 + DOOR.travel, OPENING.bottom + OPENING.h / 2, DOOR.z]}>
            <DoorLeaf />
          </group>
          {/* Sill */}
          <mesh position={[0, OPENING.bottom - 0.03, 0.03]}>
            <boxGeometry args={[OPENING.w + 0.3, 0.06, 0.08]} />
            <meshStandardMaterial {...BRASS} color="#8f7a4d" />
          </mesh>
        </group>

        {/* On the roof: crosshead, safety railing, the alarm beacon, a vent fan box */}
        <group position-y={CAR.h / 2}>
          <Crosshead />
          <RoofRail />
          <group position={[-CAR.w / 2 + 0.45, 0, CAR.d / 2 - 0.45]}>
            <Beacon mat={(m) => void (beaconMat.current = m)} />
          </group>
          <mesh position={[0.95, 0.12, -0.9]}>
            <boxGeometry args={[0.6, 0.24, 0.6]} />
            <meshStandardMaterial {...DARK_STEEL} color="#6d7278" />
          </mesh>
        </group>

        {/* Guide shoes riding the rails, top and bottom */}
        {[-1, 1].map((s) =>
          [CAR.h / 2 - 0.25, -CAR.h / 2 + 0.25].map((y) => (
            <mesh key={`${s},${y}`} position={[s * (CAR.w / 2 + 0.04), y, 0]}>
              <boxGeometry args={[0.08, 0.3, 0.28]} />
              <meshStandardMaterial {...DARK_STEEL} color="#33363a" />
            </mesh>
          )),
        )}
      </group>
      <pointLight ref={alarmLight} position={[CAR.x + 1, CAR_TOP + 1, CAR_FRONT_Z + 1]} color="#ff2a1a" intensity={0} decay={2} />

      {/* The lobby wall beside the doors, its red alarm lamp and the brass plate */}
      <group position={[WALL.x, GROUND_Y + WALL.h / 2, WALL.z]}>
        <LobbyWall />
      </group>
      <group position={[WALL.x, LAMP_Y, WALL_FRONT_Z]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.2, 0.2, 0.04, 24]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position-z={0.03}>
          <sphereGeometry args={[0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial ref={lampMat} color="#c0221a" emissive="#ff2a1a" emissiveIntensity={0.15} roughness={0.2} toneMapped={false} />
        </mesh>
      </group>
      <group position={[PLATE.x, PLATE.y, WALL_FRONT_Z]}>
        <BrassPlate />
        {!panel && <PlateButtons on={on} />}
      </group>
      {/* occlude="blending": the HTML sits behind the canvas and shows through a cut-out. */}
      {panel && (
        <Html transform occlude="blending" distanceFactor={2} portal={overlay} position={[PLATE.x, PLATE.y, PLATE_FRONT_Z + 0.005]}>
          <div className="@container h-[720px] w-[500px]">{panel}</div>
        </Html>
      )}
    </group>
  )
}
