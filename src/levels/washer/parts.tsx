// Washer parts used both by the working machine (Model.tsx) and its debris (effects.tsx).
import { useMemo } from 'react'
import * as THREE from 'three'
import { BODY, CHROME, CONSOLE, DRUM, ENAMEL, PORT, RUBBER } from './dims'

const PLATE_DEPTH = 0.05
const PLATE_TOP = CONSOLE.y - CONSOLE.h / 2

/** The front panel below the console, with the round hole for the drum. Its front face is at z = 0. */
export function useFrontPlate() {
  return useMemo(() => {
    const w = BODY.w / 2 - 0.01 // a hair inside the shell's sides, so their faces never overlap
    const shape = new THREE.Shape()
    shape.moveTo(-w, -BODY.h / 2)
    shape.lineTo(w, -BODY.h / 2)
    shape.lineTo(w, PLATE_TOP)
    shape.lineTo(-w, PLATE_TOP)
    shape.closePath()
    const hole = new THREE.Path()
    hole.absarc(PORT.x, PORT.y, PORT.r, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: PLATE_DEPTH, bevelEnabled: false, curveSegments: 48 })
    geo.translate(0, 0, -PLATE_DEPTH)
    return geo
  }, [])
}

export function FrontPlate() {
  const geo = useFrontPlate()
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial {...ENAMEL} />
    </mesh>
  )
}

// The drum's perforated steel: light dots on brushed metal.
function useDrumTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    const g = canvas.getContext('2d')!
    g.fillStyle = '#9aa1a8'
    g.fillRect(0, 0, 32, 32)
    g.fillStyle = '#3d4247'
    g.beginPath()
    g.arc(16, 16, 4, 0, Math.PI * 2)
    g.fill()
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(36, 10)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

/** The stainless drum, centered on its own origin, axis along z, open at the front. */
export function Drum({ glow = 0 }: { glow?: number }) {
  const tex = useDrumTexture()
  return (
    <group>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[DRUM.r, DRUM.r, DRUM.depth, 48, 1, true]} />
        <meshStandardMaterial map={tex} side={THREE.BackSide} roughness={0.35} metalness={0.6} emissive="#9fd4ff" emissiveIntensity={glow} />
      </mesh>
      <mesh position-z={-DRUM.depth / 2}>
        <circleGeometry args={[DRUM.r, 48]} />
        <meshStandardMaterial map={tex} roughness={0.35} metalness={0.6} emissive="#9fd4ff" emissiveIntensity={glow} />
      </mesh>
      {/* Paddles that lift the load */}
      {[0, 1, 2].map((i) => {
        const a = (i * Math.PI * 2) / 3
        return (
          <mesh key={i} position={[Math.cos(a) * (DRUM.r - 0.1), Math.sin(a) * (DRUM.r - 0.1), -0.1]} rotation-z={a}>
            <boxGeometry args={[0.22, 0.16, DRUM.depth - 0.4]} />
            <meshStandardMaterial {...CHROME} />
          </mesh>
        )
      })}
    </group>
  )
}

/** The porthole door: chrome ring, tinted glass, handle. Centered on the port; the glass faces +z. */
export function Door() {
  return (
    <group>
      <mesh>
        <torusGeometry args={[PORT.r + 0.07, 0.13, 20, 64]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
      {/* Drawn after the drum and water, so moving the camera can't flip their order. */}
      <mesh renderOrder={2}>
        <circleGeometry args={[PORT.r + 0.02, 64]} />
        <meshStandardMaterial color="#9fc7d8" transparent opacity={0.28} roughness={0.05} metalness={0.2} depthWrite={false} />
      </mesh>
      <mesh position={[PORT.r + 0.18, 0, 0.06]}>
        <boxGeometry args={[0.16, 0.6, 0.12]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  )
}

/** Rubber seal around the port opening; hides the seam between the front plate and the drum. */
export function Gasket() {
  return (
    <mesh>
      <torusGeometry args={[PORT.r, 0.08, 12, 64]} />
      <meshStandardMaterial {...RUBBER} />
    </mesh>
  )
}

/** The console box across the top front (plain; the control panel or decoration goes on its face). */
export function ConsoleBox() {
  return (
    <mesh>
      <boxGeometry args={[BODY.w, CONSOLE.h, CONSOLE.d]} />
      <meshStandardMaterial {...ENAMEL} />
    </mesh>
  )
}
