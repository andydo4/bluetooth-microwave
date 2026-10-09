// The 3D canvas: lights, the current level's model, floor shadow, camera framing + level-change zoom.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { LevelDef, Transition, Wreck } from '../levels/types'

type Props = { level: LevelDef; on: boolean; wreck: Wreck; transition: Transition; panel: ReactNode }

const START_DISTANCE = 9.6 // camera distance on desktop for the microwave
export const ZOOM_OUT_SECONDS = 1.2
export const ZOOM_IN_SECONDS = 1.0
const ZOOM_FACTOR = 6 // how far the camera pulls back when changing level

const easeInCubic = (t: number) => t * t * t
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

// Keeps the whole machine in view whatever the screen shape, and runs the level-change zoom.
// With no panel on its face (phones) it frames tightly; otherwise it only backs off when the window
// is too small. Zoom limits follow the fitted distance, since a tall phone screen needs the camera
// much further back. Don't pass fixed min/maxDistance props to OrbitControls (they'd snap the camera).
function CameraRig({ frame, tight, transition }: { frame: LevelDef['frame']; tight: boolean; transition: Transition }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const base = useRef(START_DISTANCE)
  const phase = useRef({ name: transition, start: 0, from: 0 })

  useEffect(() => {
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const halfFovX = Math.atan(Math.tan(halfFov) * (size.width / size.height))
    const fit = Math.max(frame.halfWidth / Math.tan(halfFovX), frame.halfHeight / Math.tan(halfFov))
    base.current = tight ? fit : Math.max(START_DISTANCE, fit)
    if (controls && phase.current.name === 'idle') {
      controls.minDistance = base.current * 0.55
      controls.maxDistance = base.current * 1.4
    }
    if (phase.current.name === 'idle') camera.position.setLength(base.current)
    controls?.update()
  }, [camera, size, frame, tight, controls])

  useEffect(() => {
    phase.current = { name: transition, start: performance.now() / 1000, from: camera.position.length() }
    if (!controls) return
    controls.enabled = transition === 'idle'
    if (transition === 'idle') {
      controls.minDistance = base.current * 0.55
      controls.maxDistance = base.current * 1.4
    } else {
      controls.minDistance = 0
      controls.maxDistance = Infinity
    }
  }, [transition, camera, controls])

  useFrame(() => {
    const p = phase.current
    if (p.name === 'idle') return
    const t = performance.now() / 1000 - p.start
    if (p.name === 'out') {
      const k = easeInCubic(Math.min(1, t / ZOOM_OUT_SECONDS))
      camera.position.setLength(p.from * (1 + (ZOOM_FACTOR - 1) * k))
    } else {
      const k = easeOutCubic(Math.min(1, t / ZOOM_IN_SECONDS))
      camera.position.setLength(base.current * (ZOOM_FACTOR - (ZOOM_FACTOR - 1) * k))
    }
  })
  return null
}

// The floor shadow is normally rendered once (the machine doesn't move). While things are
// flying (explosion, a new one dropping in, a level change) it re-renders every frame.
function useLiveShadows(wreck: Wreck, transition: Transition) {
  const [live, setLive] = useState(false)
  const moving = wreck === 'exploded' || transition !== 'idle'
  useEffect(() => {
    if (moving) return setLive(true)
    const id = setTimeout(() => setLive(false), 1200) // after the drop-in lands
    return () => clearTimeout(id)
  }, [moving])
  return live || moving
}

export default function Scene({ level, on, wreck, transition, panel }: Props) {
  const liveShadows = useLiveShadows(wreck, transition)
  // Stable mount point for the HTML control panel. Without it drei's <Html> re-mounts
  // when R3F connects events, and React wipes the panel before it ever shows.
  const overlay = useRef<HTMLDivElement>(null!)
  const { Model, frame } = level

  return (
    // isolate: drei's occlude="blending" gives the canvas a huge z-index; keep it contained here so
    // the page's overlays (level badge, receipt, picker) stay above the 3D scene.
    <div ref={overlay} className="relative isolate h-full w-full">
      <Canvas camera={{ position: [3.2, 3, 8.5], fov: 40, near: 0.5, far: 400 }} dpr={[1, 2]}>
        <hemisphereLight args={['#ffffff', '#202024', 0.8]} />
        <directionalLight position={[3, 6, 6]} intensity={1.6} />

        {/* Studio reflections for the metal, generated locally (no HDR download). */}
        <Environment resolution={256}>
          <Lightformer intensity={4} position={[0, 5, 5]} scale={[10, 3, 1]} />
          <Lightformer intensity={2} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer intensity={2} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        </Environment>

        {/* key: a different level is a fresh model, not a re-render of the old one. */}
        <Model key={level.id} on={on} wreck={wreck} transition={transition} panel={wreck === 'exploded' ? null : panel} overlay={overlay} />
        <ContactShadows
          key={`${level.id}-${liveShadows}`}
          frames={liveShadows ? Infinity : 1}
          position={[0, frame.groundY, 0]}
          opacity={0.6}
          scale={14}
          blur={2.5}
          far={3}
        />

        <CameraRig frame={frame} tight={!panel} transition={transition} />
        <OrbitControls
          makeDefault
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 3.5}
          maxAzimuthAngle={Math.PI / 3.5}
        />
      </Canvas>
    </div>
  )
}
