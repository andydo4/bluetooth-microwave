import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import Microwave from './Microwave'
import type { Wreck } from '../App'

type Props = { on: boolean; wreck: Wreck; panel: ReactNode }

const START_DISTANCE = 9.6 // camera distance on desktop
const HALF_WIDTH = 4.4 // half the width (world units) the view must fit: the angled microwave plus margin

// Keeps the whole microwave in view whatever the screen shape. With no panel on its face (phones),
// it frames the microwave tightly; otherwise it only backs off when the window is too narrow.
function FitCamera({ tight }: { tight: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const halfFovX = Math.atan(Math.tan(halfFov) * (size.width / size.height))
    const fit = HALF_WIDTH / Math.tan(halfFovX)
    camera.position.setLength(tight ? fit : Math.max(START_DISTANCE, fit))
  }, [camera, size, tight])
  return null
}

// The floor shadow is normally rendered once (the microwave doesn't move). While things are
// flying (explosion, the new one dropping in) it re-renders every frame.
function useLiveShadows(wreck: Wreck) {
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (wreck === 'exploded') return setLive(true)
    const id = setTimeout(() => setLive(false), 1200) // after the drop-in lands
    return () => clearTimeout(id)
  }, [wreck])
  return live || wreck === 'exploded'
}

export default function Scene({ on, wreck, panel }: Props) {
  const liveShadows = useLiveShadows(wreck)
  // Stable mount point for the HTML control panel. Without it drei's <Html> re-mounts
  // when R3F connects events, and React wipes the panel before it ever shows.
  const overlay = useRef<HTMLDivElement>(null!)

  return (
    <div ref={overlay} className="relative h-full w-full">
      <Canvas camera={{ position: [3.2, 3, 8.5], fov: 40, near: 0.5, far: 50 }} dpr={[1, 2]}>
        <hemisphereLight args={['#ffffff', '#202024', 0.8]} />
        <directionalLight position={[3, 6, 6]} intensity={1.6} />

        {/* Studio reflections for the metal, generated locally (no HDR download). */}
        <Environment resolution={256}>
          <Lightformer intensity={4} position={[0, 5, 5]} scale={[10, 3, 1]} />
          <Lightformer intensity={2} position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} />
          <Lightformer intensity={2} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
        </Environment>

        <Microwave on={on} wreck={wreck} panel={wreck === 'exploded' ? null : panel} overlay={overlay} />
        <ContactShadows key={String(liveShadows)} frames={liveShadows ? Infinity : 1} position={[0, -1.62, 0]} opacity={0.6} scale={12} blur={2.5} far={3} />

        <FitCamera tight={!panel} />
        <OrbitControls
          enablePan={false}
          minDistance={5}
          maxDistance={16}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 3.5}
          maxAzimuthAngle={Math.PI / 3.5}
        />
      </Canvas>
    </div>
  )
}
