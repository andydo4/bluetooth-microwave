import { useRef, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import Microwave from './Microwave'

type Props = { on: boolean; panel: ReactNode }

export default function Scene({ on, panel }: Props) {
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

        <Microwave on={on} panel={panel} overlay={overlay} />
        <ContactShadows frames={1} position={[0, -1.62, 0]} opacity={0.6} scale={12} blur={2.5} far={3} />

        <OrbitControls
          enablePan={false}
          minDistance={6}
          maxDistance={13}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 3.5}
          maxAzimuthAngle={Math.PI / 3.5}
        />
      </Canvas>
    </div>
  )
}
