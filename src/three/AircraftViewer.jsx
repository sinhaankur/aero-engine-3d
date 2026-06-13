import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage, useGLTF, Html } from '@react-three/drei'
import ProceduralAircraft from './ProceduralAircraft.jsx'

/**
 * Loads an authored glTF from /public/models. Suspends while loading; if the
 * path is missing entirely the parent renders the procedural model instead.
 */
function GltfModel({ url }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#8b949e', font: '13px system-ui' }}>Loading model…</div>
    </Html>
  )
}

/**
 * The reusable 3D stage. Pass an authored `modelUrl` to load glTF, otherwise it
 * builds the parametric airframe from `dimensions`. Used for both whole aircraft
 * and (later) standalone engine models.
 */
export default function AircraftViewer({ modelUrl, dimensions, engineCount = 2, height = 420 }) {
  return (
    <div style={{ height, width: '100%', background: '#0d1117', borderRadius: 12 }}>
      <Canvas shadows camera={{ position: [40, 22, 40], fov: 35 }}>
        <Suspense fallback={<Loader />}>
          <Stage intensity={0.5} environment="city" adjustCamera={1.1}>
            {modelUrl ? (
              <GltfModel url={modelUrl} />
            ) : (
              <ProceduralAircraft dimensions={dimensions} engineCount={engineCount} />
            )}
          </Stage>
        </Suspense>
        <OrbitControls enablePan makeDefault />
      </Canvas>
    </div>
  )
}
