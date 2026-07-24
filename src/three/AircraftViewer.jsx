import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stage, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import ProceduralAircraft from './ProceduralAircraft.jsx'
import CanvasFallback from './CanvasFallback.jsx'
import { collectParts, updateParts, demoSchedule } from './modelAnim.js'

/**
 * Resolve a model path against Vite's deploy base so it works both locally
 * (base "/") and on GitHub Pages (base "/AirbusEngine3D/"). Data files store
 * paths as "/models/x.glb"; we strip the leading slash and prepend BASE_URL.
 */
function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

/**
 * Loads an authored glTF from /public/models. Suspends while loading; if the
 * path is missing entirely the parent renders the procedural model instead.
 *
 * `exploded` (0..1) spreads every named component (Fuselage, Wing_L, Fin,
 * Nacelle_… — the generator names all parts) radially away from the model
 * centre, like a parts diagram. The scene is cloned because useGLTF caches
 * per URL and other viewers (home hero, simulate showcase) share that cache.
 */
function GltfModel({ url, exploded = 0, animate = true }) {
  const { scene } = useGLTF(withBase(url))
  const cloned = useMemo(() => scene.clone(true), [scene])

  const parts = useMemo(() => {
    cloned.updateMatrixWorld(true)
    const center = new THREE.Box3().setFromObject(cloned).getCenter(new THREE.Vector3())
    const list = []
    cloned.traverse((o) => {
      if (!o.isMesh) return
      const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())
      list.push({ o, base: o.position.clone(), dir: c.sub(center) })
    })
    return list
  }, [cloned])

  // moving parts (fan/flaps/gear) for the assembled demo animation
  const moving = useMemo(() => collectParts(cloned), [cloned])
  const t = useRef(0)
  const target = useRef(exploded)
  target.current = exploded
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    // when exploded, ease every part outward (gear demo would fight it, so skip)
    if (target.current > 0.02) {
      for (const p of parts) {
        tmp.copy(p.dir).multiplyScalar(target.current * 0.55).add(p.base)
        p.o.position.lerp(tmp, 0.12)
      }
      return
    }
    // assembled: pull explode offsets back to base, then run the demo animation
    // (rotation-only — fan spin + flap sweep — so it can't fight the position lerp)
    for (const p of parts) p.o.position.lerp(p.base, 0.15)
    if (animate) {
      t.current += Math.min(dt, 0.05)
      updateParts(moving, Math.min(dt, 0.05), { ...demoSchedule(t.current), skipGear: true })
    }
  })

  return <primitive object={cloned} />
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
export default function AircraftViewer({ modelUrl, dimensions, engineCount = 2, height = 420, exploded = 0 }) {
  return (
    <div style={{ height, width: '100%', background: '#0d1117', borderRadius: 12 }}>
      <CanvasFallback label="3D preview unavailable on this device">
        <Canvas shadows camera={{ position: [40, 22, 40], fov: 35 }}>
          <Suspense fallback={<Loader />}>
            <Stage intensity={0.5} environment="city" adjustCamera={1.1}>
              {modelUrl ? (
                <GltfModel url={modelUrl} exploded={exploded} />
              ) : (
                <ProceduralAircraft dimensions={dimensions} engineCount={engineCount} />
              )}
            </Stage>
          </Suspense>
          <OrbitControls enablePan makeDefault />
        </Canvas>
      </CanvasFallback>
    </div>
  )
}
