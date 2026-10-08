import { useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Speaker from './Speaker'
import { Explosion, Fire, Sparks } from './Mayhem'
import { BLACK, CAVITY, DOOR, METAL, TURNTABLE_Y } from './dims'
import type { Wreck } from '../App'

const metal = <meshStandardMaterial {...METAL} />
const black = <meshStandardMaterial {...BLACK} />

// The dotted metal screen on the door: white = solid, black = hole.
function useDoorScreenTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    const g = canvas.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 32, 32)
    g.fillStyle = '#000'
    g.beginPath()
    g.arc(16, 16, 10, 0, Math.PI * 2)
    g.fill()
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(80, 60)
    return tex
  }, [])
}

/** panel: the control panel to mount on the microwave's face, or null when it's shown elsewhere (phones). */
type Props = { on: boolean; wreck: Wreck; panel: ReactNode; overlay: RefObject<HTMLDivElement> }

export default function Microwave({ on, wreck, panel, overlay }: Props) {
  const root = useRef<THREE.Group>(null!)
  const turntable = useRef<THREE.Group>(null)
  const screen = useDoorScreenTexture()
  // Box faces are ordered +x, -x, +y, -y, +z, -z. The front (+z) is hidden; the door and panel cover it.
  const shellMaterials = useMemo(() => {
    const m = new THREE.MeshStandardMaterial(METAL)
    return [m, m, m, m, new THREE.MeshBasicMaterial({ visible: false }), m]
  }, [])

  // Explosion shake, and a brand-new microwave dropping in after it.
  const shakeUntil = useRef(0)
  const dropStart = useRef(-1)
  const prevWreck = useRef(wreck)
  // Layout effect, so the new microwave never renders a frame on the ground before dropping.
  useLayoutEffect(() => {
    const now = performance.now() / 1000
    if (wreck === 'exploded') shakeUntil.current = now + 0.8
    if (wreck === 'none' && prevWreck.current === 'exploded') dropStart.current = now
    prevWreck.current = wreck
  }, [wreck])

  useFrame((_, delta) => {
    if (on && turntable.current) turntable.current.rotation.y += delta * 0.8
    const now = performance.now() / 1000

    const shake = Math.max(0, shakeUntil.current - now) / 0.8
    root.current.position.set((Math.random() - 0.5) * 0.5 * shake, (Math.random() - 0.5) * 0.5 * shake, 0)

    if (dropStart.current >= 0) {
      const t = Math.min(1, (now - dropStart.current) / 0.7)
      root.current.position.y = 7 * (1 - t) * (1 - t) // falls in, landing as the ding plays
      if (t === 1) dropStart.current = -1
    }
  })

  if (wreck === 'exploded') {
    return (
      <group ref={root}>
        <Explosion />
      </group>
    )
  }

  return (
    <group ref={root}>
      {wreck === 'arcing' && <Sparks />}
      {wreck === 'fire' && (
        <>
          <Sparks />
          <Fire />
        </>
      )}

      {/* Outer shell: one open-fronted box. Separate overlapping wall boxes put faces exactly
          on top of each other, and those fight for the same pixels (striped, flickering edges). */}
      <mesh material={shellMaterials}>
        <boxGeometry args={[5, 3, 3.4]} />
      </mesh>

      {/* Cavity lining: BackSide so we see its inner faces through the door. Runs to the front
          so there's no see-through gap behind the door. */}
      <mesh position={[CAVITY.x, 0, 0.05]}>
        <boxGeometry args={[CAVITY.w, CAVITY.h, CAVITY.d + 0.1]} />
        <meshStandardMaterial
          side={THREE.BackSide}
          color="#55534c"
          roughness={0.6}
          emissive="#ffb347"
          emissiveIntensity={on ? 0.8 : 0}
        />
      </mesh>
      <pointLight position={[CAVITY.x, 1.1, 0.3]} color="#ffd59a" intensity={on ? 14 : 0} decay={2} />

      {/* Turntable with the speaker on it */}
      <group ref={turntable} position={[CAVITY.x, TURNTABLE_Y, 0]}>
        <mesh>
          <cylinderGeometry args={[1.35, 1.35, 0.04, 64]} />
          <meshStandardMaterial color="#a9c4c0" transparent opacity={0.55} roughness={0.1} depthWrite={false} />
        </mesh>
        <group position-y={0.02 + 0.41}>
          <Speaker />
        </group>
      </group>

      {/* Door: frame, dotted screen, handle */}
      <group position={[DOOR.x, 0, DOOR.z]}>
        <mesh position-y={1.3}>
          <boxGeometry args={[DOOR.w, 0.4, 0.08]} />
          {black}
        </mesh>
        <mesh position-y={-1.3}>
          <boxGeometry args={[DOOR.w, 0.4, 0.08]} />
          {black}
        </mesh>
        <mesh position-x={-DOOR.w / 2 + 0.175}>
          <boxGeometry args={[0.35, 2.2, 0.08]} />
          {black}
        </mesh>
        <mesh position-x={DOOR.w / 2 - 0.25}>
          <boxGeometry args={[0.5, 2.2, 0.08]} />
          {black}
        </mesh>
        {/* Drawn after everything inside, so camera moves can't flip the order and make it flicker */}
        <mesh position-x={-0.075} renderOrder={1}>
          <planeGeometry args={[2.9, 2.2]} />
          <meshStandardMaterial color="#0a0a0a" alphaMap={screen} transparent opacity={0.92} depthWrite={false} />
        </mesh>
        <mesh position={[DOOR.w / 2 - 0.25, 0, 0.12]}>
          <boxGeometry args={[0.1, 2, 0.12]} />
          {metal}
        </mesh>
      </group>

      {/* Control panel: sits in front of the shell's open face, beside the door. */}
      <mesh position={[1.875, 0, 1.72]}>
        <boxGeometry args={[1.25, 3, 0.04]} />
        {black}
      </mesh>
      {/* occlude="blending": the HTML sits behind the canvas and shows through a cut-out,
          so 3D parts in front of it (the door handle) correctly cover it. */}
      {panel && (
        <Html transform occlude="blending" distanceFactor={2} portal={overlay} position={[1.875, 0.02, 1.76]}>
          <div className="@container w-[220px]">{panel}</div>
        </Html>
      )}

      {/* Feet */}
      {[[-2.2, -1.4], [2.2, -1.4], [-2.2, 1.4], [2.2, 1.4]].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, -1.54, z]}>
          <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
          {black}
        </mesh>
      ))}
    </group>
  )
}
