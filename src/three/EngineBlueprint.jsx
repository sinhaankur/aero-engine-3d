import { Suspense, useMemo, useRef, useEffect, useReducer, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'

/**
 * A live "technical-blueprint" view of the turbofan: the same glTF rendered as
 * cream line-art (mesh edges) over a dark graph-paper background, with callout
 * labels pointing at the major stages — mirroring a hand-drawn engine cutaway.
 *
 * It reuses the engine glb's named part nodes both to draw edges per part and to
 * anchor the stage callouts in 3D space, so labels track the geometry as you
 * orbit.
 */

function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

const LINE = '#e8e2c0' // cream blueprint ink

/**
 * Render every mesh in the model as wireframe-ish line-art: a faint ghost
 * surface plus bright edges. Returns the cloned root and a node lookup so the
 * caller can anchor labels.
 */
function BlueprintModel({ url, onNodes }) {
  const { scene } = useGLTF(withBase(url))
  const root = useMemo(() => scene.clone(true), [scene])

  // Build a ghost material + collect edge geometries once.
  const built = useMemo(() => {
    const meshes = []
    const ghost = new THREE.MeshBasicMaterial({
      color: 0x0e1a20,
      transparent: true,
      opacity: 0.35,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    root.traverse((o) => {
      if (o.isMesh) {
        o.material = ghost
        meshes.push(o)
      }
    })
    return { meshes }
  }, [root])

  useEffect(() => {
    const map = new Map()
    root.traverse((o) => {
      if (o.name) map.set(o.name, o)
    })
    onNodes?.(map)
  }, [root, onNodes])

  return (
    <primitive object={root}>
      {/* Edges are added as children of each mesh via the drei helper below. */}
      {built.meshes.map((m, i) => (
        <BlueprintEdges key={i} mesh={m} />
      ))}
    </primitive>
  )
}

/** Bright edge overlay for one mesh, threshold-filtered so it reads as line-art. */
function BlueprintEdges({ mesh }) {
  const geom = useMemo(() => new THREE.EdgesGeometry(mesh.geometry, 22), [mesh])
  const ref = useRef()
  // Match the parent mesh's world transform by attaching to it.
  useEffect(() => {
    if (ref.current && mesh) {
      mesh.add(ref.current)
      return () => mesh.remove(ref.current)
    }
  }, [mesh])
  return (
    <lineSegments ref={ref} geometry={geom}>
      <lineBasicMaterial color={LINE} transparent opacity={0.9} />
    </lineSegments>
  )
}

/** A graph-paper backdrop drawn as a large grid behind the engine. */
function GraphPaper() {
  const grid = useMemo(() => {
    const g = new THREE.GridHelper(40, 80, 0x2a3a44, 0x1c2730)
    g.rotation.x = Math.PI / 2 // face the camera (XY plane)
    g.position.z = -6
    return g
  }, [])
  return <primitive object={grid} />
}

/** Stage callout label anchored at a world position. */
function Callout({ position, label }) {
  return (
    <Html position={position} center distanceFactor={10} zIndexRange={[10, 0]} pointerEvents="none">
      <div
        style={{
          font: '600 11px ui-monospace, Menlo, monospace',
          color: LINE,
          background: 'rgba(10,20,26,0.78)',
          border: `1px solid ${LINE}`,
          borderRadius: 3,
          padding: '2px 6px',
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
          textTransform: 'lowercase',
        }}
      >
        {label}
      </div>
    </Html>
  )
}

/** Resolve a world-space anchor for a node name from the node map. */
function nodeCenter(map, name) {
  const o = map?.get(name)
  if (!o) return null
  const box = new THREE.Box3().setFromObject(o)
  if (box.isEmpty()) return null
  const c = new THREE.Vector3()
  box.getCenter(c)
  return c
}

function Scene({ url, callouts, onNodes, nodeMap }) {
  return (
    <>
      <color attach="background" args={['#16242c']} />
      <GraphPaper />
      <ambientLight intensity={1} />
      <Suspense fallback={null}>
        <BlueprintModel url={url} onNodes={onNodes} />
      </Suspense>
      {nodeMap &&
        callouts.map((c) => {
          const pos = nodeCenter(nodeMap, c.node)
          if (!pos) return null
          // nudge the label outward (up/front) so it sits off the geometry
          return <Callout key={c.node} position={[pos.x + c.dx, pos.y + c.dy, pos.z + c.dz]} label={c.label} />
        })}
    </>
  )
}

export default function EngineBlueprint({ url, callouts = [], height = 440 }) {
  // node map is set by the model once loaded; keep it in a ref-backed state.
  const mapRef = useRef(null)
  const [, force] = useReducerForce()
  // Stable callback so BlueprintModel's effect doesn't re-fire every render
  // (which would loop: setNodes -> force -> new callback -> effect -> setNodes).
  const onNodes = useCallback((m) => {
    mapRef.current = m
    force()
  }, [force])

  return (
    <div
      style={{
        height,
        width: '100%',
        background: '#16242c',
        borderRadius: 12,
        position: 'relative',
        backgroundImage:
          'linear-gradient(rgba(120,150,160,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(120,150,160,0.06) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 14,
          zIndex: 2,
          font: '700 13px ui-monospace, Menlo, monospace',
          color: LINE,
          letterSpacing: '0.08em',
          pointerEvents: 'none',
        }}
      >
        TURBOFAN ENGINE — BLUEPRINT
      </div>
      <Canvas camera={{ position: [4, 2.2, 6], fov: 42 }}>
        <Scene url={url} callouts={callouts} onNodes={onNodes} nodeMap={mapRef.current} />
        <OrbitControls enablePan makeDefault />
      </Canvas>
    </div>
  )
}

// Tiny forceUpdate hook so the canvas re-renders callouts once the node map lands.
function useReducerForce() {
  return useReducer((x) => x + 1, 0)
}
