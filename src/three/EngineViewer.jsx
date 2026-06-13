import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'

function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

/**
 * Renders the multi-part turbofan glTF. Each part is a named node in the model;
 * we look them up by name to drive three effects:
 *  - exploded: slide each part along the engine X axis by its data `offset`.
 *  - highlightNodes: when non-empty, dim every part NOT in the set and give the
 *    highlighted parts a subtle emissive glow (used by both "Parts" isolation and
 *    the "How it works" cycle stages, which can highlight several parts at once).
 */
function EngineModel({ url, parts, exploded, highlightNodes }) {
  const { scene } = useGLTF(withBase(url))
  const root = useMemo(() => scene.clone(true), [scene])
  const highlight = useMemo(() => new Set(highlightNodes || []), [highlightNodes])

  // Map each top-level part node by name.
  const nodeMap = useRef(new Map())
  useEffect(() => {
    const map = new Map()
    root.traverse((o) => {
      if (o.name) map.set(o.name, o)
    })
    nodeMap.current = map
  }, [root])

  useEffect(() => {
    const map = nodeMap.current
    const hasHighlight = highlight.size > 0
    parts.forEach((p) => {
      const node = map.get(p.node)
      if (!node) return
      node.position.x = exploded ? p.offset : 0

      const isOn = highlight.has(p.node)
      node.traverse((m) => {
        if (!m.isMesh) return
        if (!m.userData._origMat) m.userData._origMat = m.material
        const orig = m.userData._origMat
        if (hasHighlight && !isOn) {
          // dim the parts that aren't part of this stage / selection
          const dim = orig.clone()
          dim.transparent = true
          dim.opacity = 0.08
          m.material = dim
        } else if (hasHighlight && isOn) {
          // glow the active parts
          const glow = orig.clone()
          glow.emissive = new THREE.Color(0x2b6cff)
          glow.emissiveIntensity = 0.35
          m.material = glow
        } else {
          m.material = orig
        }
      })
    })
  }, [parts, exploded, highlight, root])

  return <primitive object={root} />
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#8b949e', font: '13px system-ui' }}>Loading engine…</div>
    </Html>
  )
}

export default function EngineViewer({ url, parts, exploded, highlightNodes, height = 400 }) {
  return (
    <div style={{ height, width: '100%', background: '#0d1117', borderRadius: 12 }}>
      <Canvas shadows camera={{ position: [4, 2.4, 5.5], fov: 40 }}>
        <Suspense fallback={<Loader />}>
          <Stage intensity={0.5} environment="warehouse" adjustCamera={exploded ? 1.6 : 1.1}>
            <EngineModel url={url} parts={parts} exploded={exploded} highlightNodes={highlightNodes} />
          </Stage>
        </Suspense>
        <OrbitControls enablePan makeDefault />
      </Canvas>
    </div>
  )
}
