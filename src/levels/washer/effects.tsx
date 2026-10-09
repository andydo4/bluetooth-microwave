// The washer's overload visuals: suds leaking → foaming over → explosion into a sea of foam.
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Boombox from './Boombox'
import { ConsoleBox, Door, Drum, FrontPlate } from './parts'
import { BODY, BOOMBOX_REST, CONSOLE, DOOR_Z, DRUM, ENAMEL, FRONT_Z, GROUND_Y, PORT } from './dims'
import { Debris, Flash, Particles, rand, softTexture, type Particle, type Piece } from '../shared/effects'

const FOAM = '#f4f8ff'

// ---------------------------------------------------------------------------------------------
// Foam: squeezing out round the door seal (and the detergent drawer once it's critical),
// sliding down the front, and piling up on the floor.

function spawnSealFoam(p: Particle) {
  const a = Math.random() * Math.PI * 2
  p.pos.set(PORT.x + Math.cos(a) * (PORT.r + 0.15), PORT.y + Math.sin(a) * (PORT.r + 0.15), DOOR_Z + 0.1)
  p.vel.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4 + 0.3, rand(0.3, 0.8))
  p.life = rand(1, 1.8)
  p.size = rand(0.25, 0.45)
  p.grow = 1.2
}

function spawnDrawerFoam(p: Particle) {
  p.pos.set(rand(-1.9, -1.2), CONSOLE.y - 0.1, CONSOLE.z + 0.15)
  p.vel.set(rand(-0.4, 0.4), rand(0.5, 1.5), rand(0.5, 1.2))
  p.life = rand(1.2, 2)
  p.size = rand(0.3, 0.5)
  p.grow = 1.5
}

function spawnFloorFoam(p: Particle) {
  p.pos.set(rand(-2.6, 2.6), GROUND_Y + 0.15, rand(1.2, 3.2))
  p.vel.set(rand(-0.2, 0.2), rand(0.05, 0.2), rand(0, 0.3))
  p.life = rand(1.5, 2.5)
  p.size = rand(0.5, 0.9)
  p.grow = 0.6
}

/** A flat foam puddle on the floor that spreads from `from` to `to` (radius scale) over `seconds`. */
function Puddle({ position, from, to, seconds }: { position: [number, number, number]; from: number; to: number; seconds: number }) {
  const mesh = useRef<THREE.Mesh>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    const k = Math.min(1, age.current / seconds)
    mesh.current.scale.setScalar(from + (to - from) * (1 - (1 - k) ** 2))
  })
  return (
    <mesh ref={mesh} position={position} rotation-x={-Math.PI / 2} scale={from}>
      <circleGeometry args={[1.4, 40]} />
      {/* Soft-edged, so it reads as a pile of foam rather than a white plate. */}
      <meshStandardMaterial color={FOAM} map={softTexture()} transparent depthWrite={false} roughness={1} />
    </mesh>
  )
}

export function Foam({ critical }: { critical: boolean }) {
  return (
    <group>
      <Particles count={critical ? 70 : 25} active spawn={spawnSealFoam} color={FOAM} opacity={0.95} gravity={2.5} />
      {critical && (
        <>
          <Particles count={35} active spawn={spawnDrawerFoam} color={FOAM} opacity={0.95} gravity={3} />
          <Particles count={30} active spawn={spawnFloorFoam} color={FOAM} opacity={0.9} />
          <Puddle position={[0, GROUND_Y + 0.02, FRONT_Z + 0.9]} from={0.3} to={2.6} seconds={3.5} />
        </>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The explosion: a flash, a burst of foam, the washer's panels fly apart; then a foam blanket.
// The boombox survives (see Debris).

const dented = <meshStandardMaterial {...ENAMEL} color="#c9ccd1" roughness={0.6} />

const PIECES: Piece[] = [
  { node: <mesh><boxGeometry args={[BODY.w, 0.1, BODY.d]} />{dented}</mesh>, pos: [0, BODY.h / 2 - 0.05, 0], vel: [rand(-1, 1), 12, rand(-1.5, 0.5)], rest: 0.1 },
  { node: <mesh><boxGeometry args={[0.1, BODY.h, BODY.d]} />{dented}</mesh>, pos: [-BODY.w / 2 + 0.05, 0, 0], vel: [-4, 6, rand(-1, 0.5)], rest: 0.15 },
  { node: <mesh><boxGeometry args={[0.1, BODY.h, BODY.d]} />{dented}</mesh>, pos: [BODY.w / 2 - 0.05, 0, 0], vel: [4, 6, rand(-1, 0.5)], rest: 0.15 },
  { node: <mesh><boxGeometry args={[BODY.w, BODY.h, 0.1]} />{dented}</mesh>, pos: [0, 0, -BODY.d / 2 + 0.05], vel: [0, 5, -6], rest: 0.15 },
  { node: <FrontPlate />, pos: [0, 0, FRONT_Z], vel: [rand(-1, 1), 6, 2.5], rest: 0.1 },
  { node: <ConsoleBox />, pos: [0, CONSOLE.y, CONSOLE.z], vel: [rand(-2, 2), 9, 1], rest: 0.1 },
  { node: <Door />, pos: [PORT.x, PORT.y, DOOR_Z], vel: [-3, 7, 2], rest: 0.2 },
  { node: <Drum />, pos: [PORT.x, PORT.y, DRUM.z], vel: [rand(-2, 2), 6, rand(-1, 1)], rest: 1.0 },
  { node: <Boombox />, pos: [PORT.x, BOOMBOX_REST.y, BOOMBOX_REST.z], vel: [rand(-1, 1), 10, rand(0, 1)], rest: 0.41, survivor: true },
]

function spawnBurst(p: Particle) {
  const dir = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.2), rand(-0.5, 1)).normalize()
  p.pos.set(PORT.x, PORT.y, 0.5)
  p.vel.copy(dir).multiplyScalar(rand(5, 10))
  p.life = rand(0.8, 1.4)
  p.size = rand(0.5, 0.9)
  p.grow = 1
}

function spawnBlanket(p: Particle) {
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * 3
  p.pos.set(Math.cos(a) * r, GROUND_Y + 0.2, Math.sin(a) * r * 0.8 + 0.5)
  p.vel.set(0, rand(0.05, 0.25), 0)
  p.life = rand(2, 3.5)
  p.size = rand(0.7, 1.2)
  p.grow = 0.5
}

export function Explosion({ glow }: { glow: boolean }) {
  const [bursting, setBursting] = useState(true)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    if (bursting && age.current > 0.4) setBursting(false)
  })
  return (
    <group>
      <Flash position={[PORT.x, PORT.y, 0.5]} color="#e8f6ff" />
      <Particles count={60} active={bursting} spawn={spawnBurst} color={FOAM} opacity={0.95} gravity={9} />
      <Debris pieces={PIECES} groundY={GROUND_Y} glow={glow} />
      <Puddle position={[0, GROUND_Y + 0.02, 0.5]} from={1} to={3.4} seconds={2} />
      <Particles count={50} active spawn={spawnBlanket} color={FOAM} opacity={0.85} />
    </group>
  )
}
