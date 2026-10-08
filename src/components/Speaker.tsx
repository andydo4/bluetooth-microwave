// A generic cylindrical Bluetooth speaker lying on its side, centered on the origin.
const LENGTH = 1.7
const RADIUS = 0.38

export default function Speaker() {
  return (
    <group rotation-z={Math.PI / 2}>
      {/* Fabric body */}
      <mesh>
        <cylinderGeometry args={[RADIUS, RADIUS, LENGTH, 48]} />
        <meshStandardMaterial color="#e5532b" roughness={0.95} />
      </mesh>

      {/* Rubber end caps + passive radiators */}
      {[1, -1].map((side) => (
        <group key={side} position-y={side * (LENGTH / 2)}>
          <mesh>
            <cylinderGeometry args={[RADIUS + 0.03, RADIUS + 0.03, 0.12, 48]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.7} />
          </mesh>
          <mesh position-y={side * 0.065}>
            <cylinderGeometry args={[RADIUS - 0.1, RADIUS - 0.1, 0.02, 48]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* Rubber strip with buttons along the top */}
      <mesh position-x={RADIUS - 0.005}>
        <boxGeometry args={[0.04, LENGTH * 0.55, 0.16]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.7} />
      </mesh>
      {[-0.25, 0, 0.25].map((y) => (
        <mesh key={y} position={[RADIUS + 0.02, y, 0]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.045, 0.045, 0.02, 16]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      ))}
    </group>
  )
}
