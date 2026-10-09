// Level 3's speaker: a hi-fi floor-standing tower (no brand). Dark wood-grain cabinet, a tweeter and two
// woofers. Centered on its origin (TOWER.h tall overall, standing on its plinth), facing +z.
// While music plays it pulses to an imagined beat: the woofer cones pump and the cabinet bounces a hair.
import { createContext, useContext, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export const TOWER = { w: 0.86, h: 2.4, d: 0.8 }
const PLINTH = 0.08
const CAB_H = TOWER.h - PLINTH
const FRONT = TOWER.d / 2

/** Whether the song is playing. A context so the copy in the explosion's debris pulses too. */
export const TowerOn = createContext(false)

// Dark walnut: vertical grain streaks on a canvas.
let wood: THREE.Texture | null = null
function woodTexture() {
  if (wood) return wood
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 512
  const g = canvas.getContext('2d')!
  g.fillStyle = '#3d2618'
  g.fillRect(0, 0, 128, 512)
  for (let i = 0; i < 70; i++) {
    const x0 = Math.random() * 128
    const wobble = 2 + Math.random() * 5
    const phase = Math.random() * 6
    g.strokeStyle = Math.random() < 0.5 ? `rgba(20,10,4,${0.2 + Math.random() * 0.4})` : `rgba(120,78,46,${0.1 + Math.random() * 0.25})`
    g.lineWidth = 0.5 + Math.random() * 2
    g.beginPath()
    for (let y = 0; y <= 512; y += 16) g.lineTo(x0 + Math.sin(y / 60 + phase) * wobble, y)
    g.stroke()
  }
  wood = new THREE.CanvasTexture(canvas)
  wood.colorSpace = THREE.SRGBColorSpace
  return wood
}

function Driver({ y, r, cone }: { y: number; r: number; cone?: (m: THREE.Mesh | null) => void }) {
  return (
    <group position={[0, y, FRONT]} rotation-x={Math.PI / 2}>
      {/* Brushed-aluminium surround */}
      <mesh position-y={0.005}>
        <cylinderGeometry args={[r + 0.035, r + 0.035, 0.02, 40]} />
        <meshStandardMaterial color="#b9bcc0" metalness={0.85} roughness={0.3} />
      </mesh>
      {/* Rubber roll + cone (the cone is what pumps) */}
      <mesh position-y={0.02}>
        <cylinderGeometry args={[r, r, 0.015, 40]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.8} />
      </mesh>
      <mesh ref={cone} position-y={0.022}>
        <cylinderGeometry args={[r * 0.82, r * 0.82, 0.02, 40]} />
        <meshStandardMaterial color="#2c2d31" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position-y={0.04}>
        <sphereGeometry args={[r * 0.28, 20, 12]} />
        <meshStandardMaterial color="#9a9ea4" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  )
}

export default function Tower() {
  const on = useContext(TowerOn)
  const body = useRef<THREE.Group>(null!)
  const cones = useRef<THREE.Mesh[]>([])
  const level = useRef(0)
  const map = woodTexture()
  const cabinet = useMemo(
    () => <meshStandardMaterial map={map} color="#d8c2b0" roughness={0.45} metalness={0.05} />,
    [map],
  )

  useFrame((_, delta) => {
    // A ~120 BPM kick: a sharp hit that decays, faded in/out with `on`.
    level.current += ((on ? 1 : 0) - level.current) * Math.min(1, delta * 4)
    const t = performance.now() / 1000
    const kick = Math.exp(-((t * 2) % 1) * 7) * level.current
    body.current.scale.y = 1 + kick * 0.018
    body.current.position.y = kick * 0.012
    cones.current.forEach((c, i) => (c.position.y = 0.022 + kick * (i === 0 ? 0.02 : 0.03)))
  })

  return (
    <group>
      {/* Plinth with four little spikes' worth of shadow gap */}
      <mesh position-y={-TOWER.h / 2 + PLINTH / 2}>
        <boxGeometry args={[TOWER.w + 0.12, PLINTH, TOWER.d + 0.12]} />
        <meshStandardMaterial color="#141416" roughness={0.3} metalness={0.4} />
      </mesh>
      {/* The cabinet scales from its bottom, so the bounce never sinks it into the plinth. */}
      <group position-y={-TOWER.h / 2 + PLINTH}>
        <group ref={body}>
          <group position-y={CAB_H / 2}>
            <mesh>
              <boxGeometry args={[TOWER.w, CAB_H, TOWER.d]} />
              {cabinet}
            </mesh>
            {/* Gloss-black baffle and top cap */}
            <mesh position-z={FRONT - 0.004}>
              <boxGeometry args={[TOWER.w - 0.08, CAB_H - 0.08, 0.02]} />
              <meshStandardMaterial color="#0e0e10" roughness={0.15} metalness={0.3} />
            </mesh>
            <mesh position-y={CAB_H / 2 + 0.01}>
              <boxGeometry args={[TOWER.w - 0.02, 0.02, TOWER.d - 0.02]} />
              <meshStandardMaterial color="#0e0e10" roughness={0.15} metalness={0.3} />
            </mesh>

            <Driver y={CAB_H / 2 - 0.28} r={0.11} cone={(m) => void (m && (cones.current[0] = m))} />
            <Driver y={0.18} r={0.28} cone={(m) => void (m && (cones.current[1] = m))} />
            <Driver y={-0.5} r={0.28} cone={(m) => void (m && (cones.current[2] = m))} />

            {/* Bass port + a tiny amber power LED */}
            <mesh position={[0, -CAB_H / 2 + 0.25, FRONT + 0.008]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.08, 0.08, 0.01, 32]} />
              <meshStandardMaterial color="#000000" roughness={1} />
            </mesh>
            <mesh position={[0, CAB_H / 2 - 0.08, FRONT + 0.01]}>
              <sphereGeometry args={[0.018, 12, 8]} />
              <meshStandardMaterial color="#ffb347" emissive="#ffb347" emissiveIntensity={on ? 2 : 0.3} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
