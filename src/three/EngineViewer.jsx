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
 * we look them up by name to drive two effects:
 *  - exploded: slide each part along the engine X axis by its data `offset`.
 *  - selected: dim every part except the highlighted one.
 */
function EngineModel({ url, parts, exploded, selectedNode }) {
  const { scene } = useGLTF(withBase(url))
  // Clone so multiple viewers / re-renders don't fight over one object graph.
  const root = useMemo(() => scene.clone(true), [scene])

  // Cache each part node + its original position/material the first time.
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
    parts.forEach((p) => {
      const node = map.get(p.node)
      if (!node) return
      // Exploded view: offset along local X (engine axis). Lerp for a smooth feel.
      const targetX = exploded ? p.offset : 0
      node.position.x = targetX

      // Highlight: fade non-selected parts when something is selected.
      node.traverse((m) => {
        if (!m.isMesh) return
        if (!m.userData._origMat) m.userData._origMat = m.material
        const dim = selectedNode && selectedNode !== p.node
        if (dim) {
          m.material = m.userData._origMat.clone()
          m.material.transparent = true
          m.material.opacity = 0.12
        } else {
          m.material = m.userData._origMat
        }
      })
    })
  }, [parts, exploded, selectedNode, root])

  return <primitive object={root} />
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#8b949e', font: '13px system-ui' }}>Loading engine…</div>
    </Html>
  )
}

export default function EngineViewer({ url, parts, exploded, selectedNode, height = 380 }) {
  return (
    <div style={{ height, width: '100%', background: '#0d1117', borderRadius: 12 }}>
      <Canvas shadows camera={{ position: [4, 2.4, 5.5], fov: 40 }}>
        <Suspense fallback={<Loader />}>
          <Stage intensity={0.5} environment="warehouse" adjustCamera={exploded ? 1.6 : 1.1}>
            <EngineModel url={url} parts={parts} exploded={exploded} selectedNode={selectedNode} />
          </Stage>
        </Suspense>
        <OrbitControls enablePan makeDefault />
      </Canvas>
    </div>
  )
}
