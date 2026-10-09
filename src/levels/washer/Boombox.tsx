// Level 2's speaker: a generic retro boombox (no brand), centered on the origin, facing +z.
// About 1.5 wide × 0.82 tall × 0.42 deep, plus handle and antenna.
const W = 1.5
const H = 0.82
const D = 0.42

function Woofer({ x }: { x: number }) {
  return (
    <group position={[x, -0.04, D / 2]} rotation-x={Math.PI / 2}>
      <mesh>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 40]} />
        <meshStandardMaterial color="#0f1012" roughness={0.6} />
      </mesh>
      <mesh position-y={0.025}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 40]} />
        <meshStandardMaterial color="#3b3d42" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position-y={0.045}>
        <sphereGeometry args={[0.07, 20, 12]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.4} />
      </mesh>
    </group>
  )
}

export default function Boombox() {
  return (
    <group>
      {/* Body */}
      <mesh>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#2a2c31" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* Silver trim band across the front */}
      <mesh position={[0, H / 2 - 0.08, D / 2 + 0.005]}>
        <boxGeometry args={[W - 0.06, 0.1, 0.01]} />
        <meshStandardMaterial color="#c9ced4" metalness={0.8} roughness={0.25} />
      </mesh>

      <Woofer x={-0.45} />
      <Woofer x={0.45} />

      {/* Cassette deck + a little green level meter */}
      <mesh position={[0, 0.0, D / 2 + 0.006]}>
        <boxGeometry args={[0.36, 0.26, 0.012]} />
        <meshStandardMaterial color="#141518" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, D / 2 + 0.014]}>
        <boxGeometry args={[0.22, 0.1, 0.004]} />
        <meshStandardMaterial color="#5c6b75" metalness={0.3} roughness={0.1} />
      </mesh>
      <mesh position={[0, -0.18, D / 2 + 0.008]}>
        <boxGeometry args={[0.3, 0.035, 0.006]} />
        <meshStandardMaterial color="#4dff88" emissive="#4dff88" emissiveIntensity={0.6} />
      </mesh>

      {/* Buttons on top */}
      {[-0.27, -0.13, 0.01, 0.15].map((x) => (
        <mesh key={x} position={[x, H / 2 + 0.02, 0.08]}>
          <boxGeometry args={[0.1, 0.04, 0.12]} />
          <meshStandardMaterial color="#8d939b" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}

      {/* Carry handle */}
      <mesh position={[0, H / 2 + 0.22, -0.05]}>
        <boxGeometry args={[1.1, 0.06, 0.08]} />
        <meshStandardMaterial color="#c9ced4" metalness={0.8} roughness={0.25} />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, H / 2 + 0.11, -0.05]}>
          <boxGeometry args={[0.06, 0.22, 0.08]} />
          <meshStandardMaterial color="#c9ced4" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}

      {/* Antenna */}
      <mesh position={[0.62, H / 2 + 0.4, -0.12]} rotation-z={-0.35}>
        <cylinderGeometry args={[0.012, 0.012, 0.85, 8]} />
        <meshStandardMaterial color="#c9ced4" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  )
}
