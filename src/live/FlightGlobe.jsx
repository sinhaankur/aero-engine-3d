import { useMemo, useRef, useLayoutEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import CanvasFallback from '../three/CanvasFallback.jsx'
import COASTLINES from './coastlines.json'

const GLOBE_R = 2                        // globe radius in scene units
const ALT_SCALE = 0.06                   // how far altitude lifts a plane off the surface
const MAX_PLANES = 8192                  // buffer capacity; feed peaks ~3.5k

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

// Day/night Earth shader (shared look with the cinematic RouteGlobe): the
// sun-facing hemisphere is lit ocean-blue, a warm band rides the terminator,
// and the night side falls to deep blue-black with a faint city-light warmth.
const SUN_DIR = new THREE.Vector3(0.6, 0.35, 0.7).normalize()
const earthDayNightMat = () => new THREE.ShaderMaterial({
  uniforms: { uSun: { value: SUN_DIR.clone() } },
  vertexShader: `
    varying vec3 vP;
    void main(){ vP = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform vec3 uSun; varying vec3 vP;
    void main(){
      float d = dot(normalize(vP), normalize(uSun));
      float day = smoothstep(-0.05, 0.5, d);
      vec3 ocean = mix(vec3(0.03,0.09,0.16), vec3(0.10,0.32,0.52), day);
      vec3 col = mix(vec3(0.015,0.03,0.06), ocean, day);
      float term = smoothstep(0.86, 1.0, 1.0 - abs(d));
      col += vec3(0.45,0.22,0.05) * term;
      col += vec3(0.10,0.07,0.02) * smoothstep(0.15, -0.3, d);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
})

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

/** The Earth: a dark sphere with real coastlines, a faint graticule and glow rim. */
function Earth() {
  // slightly above the sphere surface so lines never z-fight the globe
  const surface = (lat, lon, out) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)
    const r = GLOBE_R * 1.002
    return out.set(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    )
  }

  const graticule = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pts = []
    const v = new THREE.Vector3()
    // parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 3) {
        surface(lat, lon, v); pts.push(v.x, v.y, v.z)
        surface(lat, lon + 3, v); pts.push(v.x, v.y, v.z)
      }
    }
    // meridians
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -87; lat < 87; lat += 3) {
        surface(lat, lon, v); pts.push(v.x, v.y, v.z)
        surface(lat + 3, lon, v); pts.push(v.x, v.y, v.z)
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  // Natural Earth 110m coastlines (public domain) — what makes it read as Earth
  const coasts = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pts = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (const line of COASTLINES) {
      for (let i = 0; i < line.length - 1; i++) {
        surface(line[i][1], line[i][0], a)
        surface(line[i + 1][1], line[i + 1][0], b)
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])

  const earthMat = useMemo(earthDayNightMat, [])

  return (
    <group>
      <mesh material={earthMat}>
        <sphereGeometry args={[GLOBE_R, 96, 96]} />
      </mesh>
      {/* atmosphere rim — brighter on the sun side */}
      <mesh scale={1.05}>
        <sphereGeometry args={[GLOBE_R, 48, 48]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          uniforms={{ uSun: { value: SUN_DIR.clone() } }}
          vertexShader={`varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `}
          fragmentShader={`uniform vec3 uSun; varying vec3 vN; varying vec3 vP; void main(){ float rim=pow(1.0-abs(dot(normalize(vN),vec3(0.0,0.0,1.0))),2.5); float lit=smoothstep(-0.2,0.6,dot(normalize(vP),normalize(uSun))); vec3 c=mix(vec3(0.10,0.30,0.55),vec3(0.35,0.6,0.9),lit); gl_FragColor=vec4(c, rim*0.5);} `}
        />
      </mesh>
      <lineSegments geometry={graticule}>
        <lineBasicMaterial color="#2a3d4e" transparent opacity={0.5} />
      </lineSegments>
      <lineSegments geometry={coasts}>
        <lineBasicMaterial color="#5f87a8" transparent opacity={0.9} />
      </lineSegments>
    </group>
  )
}

// soft round sprite so the glow dots read as lights, not squares
function makeDotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/**
 * Aircraft rendered twice from one buffer fill:
 *  - an InstancedMesh of heading-oriented darts (shape + click target up close)
 *  - a Points layer of fixed-pixel-size glow dots, so traffic stays visible at
 *    ANY zoom level — the darts alone are sub-pixel when zoomed out.
 * Buffers are allocated once at MAX_PLANES; only `count` is drawn, so a poll
 * update never reallocates or recreates GPU objects.
 */
function Planes({ flights, onSelect }) {
  const meshRef = useRef()
  const pointsRef = useRef()
  const dotTex = useMemo(makeDotTexture, [])
  const positions = useMemo(() => new Float32Array(MAX_PLANES * 3), [])
  const colors = useMemo(() => new Float32Array(MAX_PLANES * 3), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])
  const count = Math.min(flights.length, MAX_PLANES)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    const pts = pointsRef.current
    if (!mesh || !pts) return
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
      dummy.scale.setScalar(0.032)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      altColor(f.baroAlt, f.onGround, color)
      mesh.setColorAt(i, color)
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    const pg = pts.geometry
    pg.attributes.position.needsUpdate = true
    pg.attributes.color.needsUpdate = true
    pg.setDrawRange(0, count)
  }, [flights, count, dummy, color, pos, up, positions, colors])

  const handleClick = (e) => {
    e.stopPropagation()
    if (e.instanceId != null && flights[e.instanceId]) onSelect(flights[e.instanceId])
  }

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_PLANES]}
        onClick={handleClick}
        frustumCulled={false}
      >
        {/* a stubby cone reads as a little dart/aircraft at scale */}
        <coneGeometry args={[0.5, 1.4, 5]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={dotTex}
          size={7}
          sizeAttenuation={false}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}

const MAX_TRAIL_VERTS = 240000 // 8k aircraft × 15 segments × 2 verts

// paths are deliberately a single muted tone (not the altitude palette) so
// they read as history, clearly distinct from the bright plane markers
const TRAIL_COLOR = new THREE.Color('#39627e')

/**
 * Flight paths: every aircraft's position history this session, drawn as one
 * LineSegments buffer, faded toward the older end. The selected aircraft's
 * track is re-drawn on top in accent colour.
 */
function Trails({ flights, tracks, selected, visible = true }) {
  const ref = useRef()
  const selRef = useRef()
  const positions = useMemo(() => new Float32Array(MAX_TRAIL_VERTS * 3), [])
  const colors = useMemo(() => new Float32Array(MAX_TRAIL_VERTS * 3), [])
  const selPositions = useMemo(() => new Float32Array(64 * 3), [])
  const a = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    const line = ref.current
    if (!line || !tracks) return
    let v = 0
    for (const f of flights) {
      const pts = tracks.get(f.id)
      if (!pts || pts.length < 2) continue
      for (let i = 1; i < pts.length && v + 2 <= MAX_TRAIL_VERTS; i++) {
        for (const j of [i - 1, i]) {
          toVec3(pts[j][0], pts[j][1], pts[j][2], a)
          positions[v * 3] = a.x
          positions[v * 3 + 1] = a.y
          positions[v * 3 + 2] = a.z
          // fade toward the older end of the trail
          const fade = 0.15 + 0.85 * (j / (pts.length - 1))
          colors[v * 3] = TRAIL_COLOR.r * fade
          colors[v * 3 + 1] = TRAIL_COLOR.g * fade
          colors[v * 3 + 2] = TRAIL_COLOR.b * fade
          v++
        }
      }
    }
    const g = line.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.color.needsUpdate = true
    g.setDrawRange(0, v)
  }, [flights, tracks, positions, colors, a])

  useLayoutEffect(() => {
    const line = selRef.current
    if (!line) return
    const pts = (selected && tracks?.get(selected.id)) || []
    const n = Math.min(pts.length, 64)
    for (let i = 0; i < n; i++) {
      toVec3(pts[i][0], pts[i][1], pts[i][2], a)
      selPositions[i * 3] = a.x
      selPositions[i * 3 + 1] = a.y
      selPositions[i * 3 + 2] = a.z
    }
    line.geometry.attributes.position.needsUpdate = true
    line.geometry.setDrawRange(0, n)
  }, [selected, flights, tracks, selPositions, a])

  return (
    <group visible={visible}>
      <lineSegments ref={ref} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
      <line ref={selRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[selPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#d8ff3e" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </line>
    </group>
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

export default function FlightGlobe({ flights, tracks, selected, onSelect, height = 560, autoSpin = true, showTrails = true }) {
  return (
    <div style={{ height, width: '100%', background: 'radial-gradient(120% 120% at 50% 30%, #0a1017, #06080b)' }}>
      <CanvasFallback label="Live globe needs WebGL — unavailable on this device">
        <Canvas camera={{ position: [0, 1.6, 6], fov: 42 }} onPointerMissed={() => onSelect(null)}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[5, 3, 5]} intensity={1.2} />
          <Stars radius={60} depth={30} count={1200} factor={2} fade speed={0.4} />
          <group rotation={[0, 0, 0]}>
            <Earth />
            <Trails flights={flights} tracks={tracks} selected={selected} visible={showTrails} />
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
