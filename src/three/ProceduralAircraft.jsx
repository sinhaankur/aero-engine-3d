import { useMemo } from 'react'

/**
 * A parametric, low-poly airliner built entirely from an aircraft's `dimensions`
 * data. This is the fallback whenever a variant has no authored glTF yet, and it
 * doubles as a "data-driven blueprint" — change the numbers in the data file and
 * the shape updates. Coordinates: +X = nose-to-tail length, +Z = wingspan,
 * +Y = up. Everything is centred on the origin.
 */
export default function ProceduralAircraft({ dimensions, engineCount = 2 }) {
  const { lengthM, wingspanM, heightM, fuselageDiaM } = dimensions

  // Engine pods sit under the wings. Two engines = one per side; in future a
  // 4-engine type (A380) would place two per side.
  const enginePods = useMemo(() => {
    const perSide = Math.max(1, Math.round(engineCount / 2))
    const pods = []
    const spanHalf = wingspanM / 2
    for (let side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        // Spread pods across the inner 25–60% of each half-span.
        const frac = perSide === 1 ? 0.42 : 0.3 + (i / Math.max(1, perSide - 1)) * 0.28
        pods.push({ z: side * spanHalf * frac })
      }
    }
    return pods
  }, [wingspanM, engineCount])

  const fuselageR = fuselageDiaM / 2
  const engineR = Math.max(0.9, fuselageR * 0.55)
  const engineLen = engineR * 3.2

  return (
    <group>
      {/* Fuselage — a long capsule along X */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[fuselageR, lengthM - fuselageDiaM * 2, 8, 24]} />
        <meshStandardMaterial color="#e9eef3" metalness={0.2} roughness={0.5} />
      </mesh>

      {/* Main wings — a flat swept plank across Z */}
      <mesh position={[lengthM * -0.02, -fuselageR * 0.3, 0]} castShadow>
        <boxGeometry args={[lengthM * 0.18, 0.25, wingspanM]} />
        <meshStandardMaterial color="#cdd6e0" metalness={0.2} roughness={0.6} />
      </mesh>

      {/* Horizontal stabiliser near the tail */}
      <mesh position={[lengthM * 0.42, 0, 0]} castShadow>
        <boxGeometry args={[lengthM * 0.09, 0.2, wingspanM * 0.36]} />
        <meshStandardMaterial color="#cdd6e0" metalness={0.2} roughness={0.6} />
      </mesh>

      {/* Vertical tail fin */}
      <mesh position={[lengthM * 0.43, heightM * 0.32, 0]} castShadow>
        <boxGeometry args={[lengthM * 0.08, heightM * 0.5, 0.22]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.2} roughness={0.6} />
      </mesh>

      {/* Engine nacelles under the wings */}
      {enginePods.map((pod, i) => (
        <mesh
          key={i}
          position={[lengthM * -0.06, -fuselageR * 0.7, pod.z]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[engineR, engineR * 0.85, engineLen, 20]} />
          <meshStandardMaterial color="#9aa6b2" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}
