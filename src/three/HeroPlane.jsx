import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stage, useGLTF, Html, Float } from '@react-three/drei'
import CanvasFallback from './CanvasFallback.jsx'
import { collectParts, updateParts, demoSchedule } from './modelAnim.js'

/**
 * The animated 3D plane that opens the home page. A slowly self-rotating,
 * gently floating airframe — purely decorative (no controls) so it reads as a
 * living hero rather than an interactive viewer. Uses the same authored A320
 * glTF the archive ships, and degrades to a "loading" note while it streams.
 */
function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

function SpinningModel({ url }) {
  const { scene } = useGLTF(withBase(url))
  // clone so we can animate parts without corrupting the shared useGLTF cache
  const cloned = useMemo(() => scene.clone(true), [scene])
  const parts = useMemo(() => collectParts(cloned), [cloned])
  const ref = useRef()
  const t = useRef(0)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.35 // continuous slow yaw
    t.current += Math.min(dt, 0.05)
    // gentle demo: spinning fan + slow flap sweep (no gear cycle on the hero)
    updateParts(parts, Math.min(dt, 0.05), { ...demoSchedule(t.current), skipGear: true })
  })
  return <primitive ref={ref} object={cloned} />
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#8b949e', font: '13px system-ui' }}>Loading…</div>
    </Html>
  )
}

export default function HeroPlane({ url = '/models/a320.glb', height = 340, transparent = true }) {
  return (
    <div
      className="hero-plane"
      style={{ height, width: '100%', background: transparent ? 'transparent' : undefined }}
      aria-hidden="true"
    >
      <CanvasFallback className="hero-plane-fallback">
        <Canvas
          shadows
          camera={{ position: [42, 16, 46], fov: 32 }}
          gl={{ alpha: true }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={<Loader />}>
            {/* Float adds a subtle bob + pitch; SpinningModel adds the yaw. */}
            <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.6}>
              <Stage intensity={0.5} environment="city" adjustCamera={1.15}>
                <SpinningModel url={url} />
              </Stage>
            </Float>
          </Suspense>
        </Canvas>
      </CanvasFallback>
    </div>
  )
}
