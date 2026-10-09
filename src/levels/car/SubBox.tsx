// Level 4's speaker: a carpeted trunk subwoofer box with two big woofers and a little amp on top.
// Centered on the origin, facing +z, SUB.w wide × SUB.h tall × SUB.d deep. While `pump.current` is
// true the cones punch out on every beat and the amp's light throbs (it's a ref so the debris copy,
// which is created once, still follows playback).
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SUB, kick } from './dims'

// Charcoal automotive carpet: speckled felt.
let carpet: THREE.Texture | null = null
function carpetTexture() {
  if (carpet) return carpet
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')!
  g.fillStyle = '#2c2d31'
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 900; i++) {
    const v = 30 + Math.floor(Math.random() * 40)
    g.fillStyle = `rgb(${v},${v},${v + 4})`
    g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1)
  }
  carpet = new THREE.CanvasTexture(canvas)
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping
  carpet.repeat.set(3, 2)
  carpet.colorSpace = THREE.SRGBColorSpace
  return carpet
}

export function useCarpet() {
  return useMemo(() => carpetTexture(), [])
}

const CONE_R = 0.33

function Woofer({ x, cone }: { x: number; cone: (el: THREE.Group | null) => void }) {
  return (
    <group position={[x, 0, SUB.d / 2]}>
      {/* Mounting ring with bolts */}
      <mesh>
        <torusGeometry args={[CONE_R + 0.02, 0.03, 10, 40]} />
        <meshStandardMaterial color="#a9aeb5" metalness={0.8} roughness={0.3} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 3) * (CONE_R + 0.02), Math.sin((i * Math.PI) / 3) * (CONE_R + 0.02), 0.03]}>
          <sphereGeometry args={[0.018, 8, 6]} />
          <meshStandardMaterial color="#e0e3e7" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
      {/* The moving part: surround, cone and dust cap */}
      <group ref={cone}>
        <mesh>
          <torusGeometry args={[CONE_R - 0.04, 0.035, 10, 40]} />
          <meshStandardMaterial color="#1a1b1e" roughness={0.7} />
        </mesh>
        <mesh position-z={-0.05} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[CONE_R - 0.06, 0.1, 0.12, 40, 1, true]} />
          <meshStandardMaterial color="#26282c" roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
        <mesh position-z={-0.07} rotation-x={Math.PI / 2} scale-y={0.5}>
          <sphereGeometry args={[0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#3d4046" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

export default function SubBox({ pump }: { pump: { current: boolean } }) {
  const tex = useCarpet()
  const cones = useRef<(THREE.Group | null)[]>([])
  const led = useRef<THREE.MeshStandardMaterial>(null!)
  const amount = useRef(0)

  useFrame((_, delta) => {
    amount.current += ((pump.current ? 1 : 0) - amount.current) * Math.min(1, delta * 4)
    const k = kick(performance.now() / 1000) * amount.current
    cones.current.forEach((c) => c && (c.position.z = k * 0.07))
    led.current.emissiveIntensity = 0.4 + k * 2.5
  })

  return (
    <group>
      {/* Carpeted box. Its front baffle is a separate, slightly proud plate so the woofers' rings sit on it. */}
      <mesh>
        <boxGeometry args={[SUB.w, SUB.h, SUB.d]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
      <mesh position-z={SUB.d / 2 - 0.01}>
        <boxGeometry args={[SUB.w - 0.08, SUB.h - 0.08, 0.04]} />
        <meshStandardMaterial color="#202125" roughness={0.9} />
      </mesh>
      <Woofer x={-0.52} cone={(el) => void (cones.current[0] = el)} />
      <Woofer x={0.52} cone={(el) => void (cones.current[1] = el)} />

      {/* Bass port between the woofers */}
      <mesh position={[0, -0.18, SUB.d / 2 + 0.012]}>
        <boxGeometry args={[0.16, 0.3, 0.01]} />
        <meshStandardMaterial color="#060607" roughness={1} />
      </mesh>

      {/* Amp bolted to the top, with a light that throbs on the beat */}
      <mesh position={[0, SUB.h / 2 + 0.06, -0.05]}>
        <boxGeometry args={[0.9, 0.12, 0.45]} />
        <meshStandardMaterial color="#9aa1aa" metalness={0.75} roughness={0.3} />
      </mesh>
      {[-0.3, -0.15, 0, 0.15, 0.3].map((x) => (
        <mesh key={x} position={[x, SUB.h / 2 + 0.125, -0.05]}>
          <boxGeometry args={[0.05, 0.015, 0.4]} />
          <meshStandardMaterial color="#6f767e" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, SUB.h / 2 + 0.06, 0.176]}>
        <boxGeometry args={[0.5, 0.03, 0.01]} />
        <meshStandardMaterial ref={led} color="#4fd6ff" emissive="#4fd6ff" emissiveIntensity={0.4} toneMapped={false} />
      </mesh>
    </group>
  )
}
