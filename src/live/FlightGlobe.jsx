import { useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import CanvasFallback from '../three/CanvasFallback.jsx'

const GLOBE_R = 2                        // globe radius in scene units
const ALT_SCALE = 0.06                   // how far altitude lifts a plane off the surface

// lat/lon (deg) + altitude (m) -> point on/above the sphere
function toVec3(lat, lon, altM = 0, out = new THREE.Vector3()) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const r = GLOBE_R + Math.max(0, altM / 12000) * ALT_SCALE
  out.set(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
  return out
}

// altitude -> colour ramp (ground amber -> low green -> cruise cyan -> high white)
function altColor(altM, onGround, out = new THREE.Color()) {
  if (onGround) return out.setHex(0xffb020)
  const t = Math.min(1, Math.max(0, (altM || 0) / 12000))
  // lerp through a small palette
  const c = new THREE.Color()
  if (t < 0.5) c.setHex(0x54ff8a).lerp(new THREE.Color(0x3ec8ff), t * 2)
  else c.setHex(0x3ec8ff).lerp(new THREE.Color(0xeaf6ff), (t - 0.5) * 2)
  return out.copy(c)
}

/** The Earth: a dark sphere with a faint lat/lon graticule and glow rim. */
function Earth() {
  const graticule = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pts = []
    const v = new THREE.Vector3()
    // parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 3) {
        toVec3(lat, lon, 0, v); pts.push(v.x, v.y, v.z)
        toVec3(lat, lon + 3, 0, v); pts.push(v.x, v.y, v.z)
      }
    }
    // meridians
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -87; lat < 87; lat += 3) {
        toVec3(lat, lon, 0, v); pts.push(v.x, v.y, v.z)
        toVec3(lat + 3, lon, 0, v); pts.push(v.x, v.y, v.z)
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  return (
    <group>
      <mesh>
        <sphereGeometry args={[GLOBE_R, 64, 64]} />
        <meshStandardMaterial color="#0e141c" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* atmosphere rim */}
      <mesh scale={1.035}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <meshBasicMaterial color="#1e5f8c" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
      <lineSegments geometry={graticule}>
        <lineBasicMaterial color="#20303f" transparent opacity={0.55} />
      </lineSegments>
    </group>
  )
}

/**
 * Aircraft as a single InstancedMesh — one small cone per flight, oriented to
 * sit tangent to the globe and coloured by altitude. Instancing keeps thousands
 * of planes at 60fps.
 */
function Planes({ flights, onSelect }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])
  const count = flights.length

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      const f = flights[i]
      toVec3(f.lat, f.lon, f.baroAlt || 0, pos)
      dummy.position.copy(pos)
      // orient the marker so it lies flat against the sphere, nose along heading
      up.copy(pos).normalize()
      dummy.up.copy(up)
      // a point slightly along-track to look at, projected on the sphere
      const hr = (f.heading || 0) * (Math.PI / 180)
      const east = new THREE.Vector3(-up.z, 0, up.x).normalize()
      const north = new THREE.Vector3().crossVectors(up, east).normalize()
      const dir = new THREE.Vector3()
        .addScaledVector(north, Math.cos(hr))
        .addScaledVector(east, Math.sin(hr))
      dummy.lookAt(pos.clone().add(dir))
      dummy.scale.setScalar(0.02)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, altColor(f.baroAlt, f.onGround, color))
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [flights, count, dummy, color, pos, up])

  const handleClick = (e) => {
    e.stopPropagation()
    if (e.instanceId != null && flights[e.instanceId]) onSelect(flights[e.instanceId])
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, Math.max(1, count)]}
      onClick={handleClick}
      frustumCulled={false}
    >
      {/* a stubby cone reads as a little dart/aircraft at scale */}
      <coneGeometry args={[0.5, 1.4, 5]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  )
}

/** Highlight ring around the selected flight. */
function SelectionMarker({ flight }) {
  const ref = useRef()
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ clock }) => {
    if (!ref.current || !flight) return
    toVec3(flight.lat, flight.lon, flight.baroAlt || 0, p)
    ref.current.position.copy(p)
    ref.current.lookAt(0, 0, 0)
    const s = 0.05 + Math.sin(clock.elapsedTime * 4) * 0.012
    ref.current.scale.setScalar(s)
  })
  if (!flight) return null
  return (
    <mesh ref={ref}>
      <ringGeometry args={[0.6, 0.9, 24]} />
      <meshBasicMaterial color="#d8ff3e" side={THREE.DoubleSide} transparent opacity={0.9} />
    </mesh>
  )
}

export default function FlightGlobe({ flights, selected, onSelect, height = 560, autoSpin = true }) {
  return (
    <div style={{ height, width: '100%', background: 'radial-gradient(120% 120% at 50% 30%, #0a1017, #06080b)' }}>
      <CanvasFallback label="Live globe needs WebGL — unavailable on this device">
        <Canvas camera={{ position: [0, 1.6, 6], fov: 42 }} onPointerMissed={() => onSelect(null)}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 3, 5]} intensity={1.1} />
          <Stars radius={60} depth={30} count={1200} factor={2} fade speed={0.4} />
          <group rotation={[0, 0, 0]}>
            <Earth />
            <Planes flights={flights} onSelect={onSelect} />
            <SelectionMarker flight={selected} />
          </group>
          <OrbitControls
            enablePan={false}
            minDistance={2.6}
            maxDistance={14}
            autoRotate={autoSpin && !selected}
            autoRotateSpeed={0.35}
            makeDefault
          />
        </Canvas>
      </CanvasFallback>
    </div>
  )
}
