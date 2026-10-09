// Effect building blocks shared by every level: sprite particles, the explosion flash, and flying debris
// (with the surviving speaker that "levels up" between levels).
import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export const rand = (min: number, max: number) => min + Math.random() * (max - min)

// Soft round blob used for flames, smoke, foam and the flash.
let soft: THREE.Texture | null = null
export function softTexture() {
  if (soft) return soft
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  soft = new THREE.CanvasTexture(canvas)
  return soft
}

// ---------------------------------------------------------------------------------------------
// A small sprite particle system. Each particle is respawned by `spawn` when its life runs out,
// as long as `active` is true.

export type Particle = { pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; grow: number; alive: boolean }

export function Particles({
  count,
  active,
  spawn,
  color,
  opacity,
  additive = false,
  gravity = 0,
}: {
  count: number
  active: boolean
  spawn: (p: Particle) => void
  color: string
  opacity: number
  additive?: boolean
  /** Pulls particles down (foam, water); 0 for smoke and flames. */
  gravity?: number
}) {
  const group = useRef<THREE.Group>(null!)
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, () => ({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        life: Math.random() * 0.8, // staggers the first spawns
        size: 1,
        grow: 0,
        alive: false,
      })),
    [count],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    particles.forEach((p, i) => {
      const sprite = group.current.children[i] as THREE.Sprite
      p.age += dt
      if (p.age >= p.life) {
        if (!active) {
          p.alive = false
          sprite.visible = false
          return
        }
        spawn(p)
        p.age = 0
        p.alive = true
      }
      if (!p.alive) {
        sprite.visible = false
        return
      }
      p.vel.y -= gravity * dt
      p.pos.addScaledVector(p.vel, dt)
      const t = p.age / p.life
      sprite.visible = true
      sprite.position.copy(p.pos)
      sprite.scale.setScalar(p.size * (1 + p.grow * t))
      ;(sprite.material as THREE.SpriteMaterial).opacity = opacity * Math.sin(Math.PI * t)
    })
  })

  const texture = softTexture()
  return (
    <group ref={group}>
      {particles.map((_, i) => (
        <sprite key={i} visible={false}>
          <spriteMaterial
            map={texture}
            color={color}
            transparent
            depthWrite={false}
            toneMapped={false}
            blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
          />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// The blast flash: a bright light and a growing glow that fade over half a second.

export function Flash({ position, color = '#fff1c4' }: { position: [number, number, number]; color?: string }) {
  const light = useRef<THREE.PointLight>(null!)
  const sprite = useRef<THREE.Sprite>(null!)
  const age = useRef(0)
  useFrame((_, delta) => {
    age.current += delta
    const k = Math.max(0, 1 - age.current / 0.5)
    light.current.intensity = 400 * k * k
    sprite.current.scale.setScalar(4 + 10 * (1 - k))
    ;(sprite.current.material as THREE.SpriteMaterial).opacity = k
  })
  return (
    <group position={position}>
      <pointLight ref={light} color="#ffd9a0" decay={1.5} />
      <sprite ref={sprite}>
        <spriteMaterial map={softTexture()} color={color} transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------------------------------------
// Debris: pieces fly apart with simple gravity/bounce physics and settle on the ground.
// The piece marked `survivor` is the speaker: it only spins upright (so it lands the right way up,
// "unharmed"), and glows when `glow` is set (it's levelling up into the next level's speaker).

export type Piece = {
  node: ReactNode
  pos: [number, number, number]
  vel: [number, number, number]
  /** How far the piece's center sits above the ground when it lands. */
  rest: number
  survivor?: boolean
}

const GRAVITY = 16

export function Debris({ pieces, groundY, glow }: { pieces: Piece[]; groundY: number; glow: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const glowSprite = useRef<THREE.Sprite>(null!)
  const glowLight = useRef<THREE.PointLight>(null!)
  const glowAge = useRef(0)

  // Fresh random velocities and spins every time it explodes.
  const state = useMemo(
    () =>
      pieces.map((p) => ({
        pos: new THREE.Vector3(...p.pos),
        vel: new THREE.Vector3(...p.vel).add(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 0.5))),
        spin: p.survivor ? new THREE.Vector3(0, rand(-4, 4), 0) : new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
        settled: false,
      })),
    [pieces],
  )
  const survivor = pieces.findIndex((p) => p.survivor)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.033)
    state.forEach((s, i) => {
      const obj = refs.current[i]
      if (!obj || s.settled) return
      s.vel.y -= GRAVITY * dt
      s.pos.addScaledVector(s.vel, dt)
      obj.rotation.x += s.spin.x * dt
      obj.rotation.y += s.spin.y * dt
      obj.rotation.z += s.spin.z * dt

      const floor = groundY + pieces[i].rest
      if (s.pos.y < floor) {
        s.pos.y = floor
        s.vel.y = -s.vel.y * 0.3
        s.vel.x *= 0.6
        s.vel.z *= 0.6
        s.spin.multiplyScalar(0.5)
        if (s.vel.length() < 0.6) s.settled = true
      }
      obj.position.copy(s.pos)
    })

    // Level-up glow around the surviving speaker.
    glowAge.current = glow ? glowAge.current + delta : 0
    const k = Math.min(1, glowAge.current / 0.6)
    if (survivor >= 0) {
      glowSprite.current.position.copy(state[survivor].pos)
      glowLight.current.position.copy(state[survivor].pos)
    }
    glowSprite.current.visible = k > 0
    glowSprite.current.scale.setScalar(1 + 3 * k)
    ;(glowSprite.current.material as THREE.SpriteMaterial).opacity = k
    glowLight.current.intensity = 60 * k
  })

  return (
    <group>
      {pieces.map((p, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} position={p.pos}>
          {p.node}
        </group>
      ))}
      <sprite ref={glowSprite} visible={false}>
        <spriteMaterial map={softTexture()} color="#bfe3ff" transparent depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <pointLight ref={glowLight} color="#bfe3ff" intensity={0} decay={2} />
    </group>
  )
}
