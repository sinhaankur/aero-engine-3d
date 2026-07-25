import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import CanvasFallback from '../three/CanvasFallback.jsx'
import COASTLINES from './coastlines.json'

/**
 * Cinematic route globe. Draws the departure→destination great-circle arc on a
 * real 3D Earth (coastlines, atmosphere glow, stars) with airport beacons, and
 * flies an aircraft marker along the arc at `progress` (0..1). The camera swings
 * with the aircraft for a filmic "watch your leg cross the planet" feel — no
 * orbit controls, it's a ride, not a map.
 */

const R = 2
const rad = (d) => (d * Math.PI) / 180

function toVec3(lat, lon, lift = 0, out = new THREE.Vector3()) {
  const phi = rad(90 - lat)
  const theta = rad(lon + 180)
  const r = R * (1 + lift)
  out.set(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
  return out
}

// spherical-linear interpolation between two lat/lon on the great circle
function slerpLL(aLL, bLL, f, out) {
  const a = toVec3(aLL[0], aLL[1], 0, new THREE.Vector3()).normalize()
  const b = toVec3(bLL[0], bLL[1], 0, new THREE.Vector3()).normalize()
  const omega = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1))
  if (omega < 1e-5) return out.copy(a)
  const s = Math.sin(omega)
  const w1 = Math.sin((1 - f) * omega) / s
  const w2 = Math.sin(f * omega) / s
  return out.copy(a).multiplyScalar(w1).addScaledVector(b, w2).normalize()
}

// A day/night Earth shader: the hemisphere facing the sun is lit ocean-blue
// brightening to a bright sub-solar point, a warm gold band rides the terminator,
// and the night side falls to deep blue-black with a faint city-light warmth.
const SUN_DIR = new THREE.Vector3(0.6, 0.35, 0.7).normalize()
const earthDayNightMat = () => new THREE.ShaderMaterial({
  uniforms: { uSun: { value: SUN_DIR.clone() } },
  vertexShader: `
    varying vec3 vN; varying vec3 vP;
    void main(){ vN = normalize(normalMatrix * normal); vP = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: `
    uniform vec3 uSun; varying vec3 vN; varying vec3 vP;
    void main(){
      float d = dot(normalize(vP), normalize(uSun));      // -1 night .. 1 subsolar
      float day = smoothstep(-0.05, 0.5, d);
      vec3 ocean = mix(vec3(0.03,0.09,0.16), vec3(0.10,0.32,0.52), day);
      vec3 night = vec3(0.015,0.03,0.06);
      vec3 col = mix(night, ocean, day);
      // warm terminator band where day meets night
      float term = 1.0 - abs(d) ; term = smoothstep(0.86, 1.0, term);
      col += vec3(0.45,0.22,0.05) * term;
      // faint city warmth on the deep night side
      float nightSide = smoothstep(0.15, -0.3, d);
      col += vec3(0.10,0.07,0.02) * nightSide;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
})

function Earth() {
  const surface = (lat, lon, out) => toVec3(lat, lon, 0.002, out)
  const earthMat = useMemo(earthDayNightMat, [])
  const coasts = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pts = []; const a = new THREE.Vector3(); const b = new THREE.Vector3()
    for (const line of COASTLINES) {
      for (let i = 0; i < line.length - 1; i++) {
        surface(line[i][1], line[i][0], a); surface(line[i + 1][1], line[i + 1][0], b)
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  const graticule = useMemo(() => {
    const g = new THREE.BufferGeometry(); const pts = []; const v = new THREE.Vector3()
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = -180; lon < 180; lon += 4) { surface(lat, lon, v); pts.push(v.x, v.y, v.z); surface(lat, lon + 4, v); pts.push(v.x, v.y, v.z) }
    for (let lon = -180; lon < 180; lon += 30)
      for (let lat = -84; lat < 84; lat += 4) { surface(lat, lon, v); pts.push(v.x, v.y, v.z); surface(lat + 4, lon, v); pts.push(v.x, v.y, v.z) }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <group>
      <mesh geometry={undefined} material={earthMat}><sphereGeometry args={[R, 128, 128]} /></mesh>
      {/* fresnel atmosphere rim glow (brighter on the sun side) */}
      <mesh scale={1.06}>
        <sphereGeometry args={[R, 64, 64]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          uniforms={{ uSun: { value: SUN_DIR.clone() } }}
          vertexShader={`varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `}
          fragmentShader={`uniform vec3 uSun; varying vec3 vN; varying vec3 vP; void main(){ float rim=pow(1.0-abs(dot(normalize(vN),vec3(0.0,0.0,1.0))),2.5); float lit=smoothstep(-0.2,0.6,dot(normalize(vP),normalize(uSun))); vec3 c=mix(vec3(0.10,0.30,0.55),vec3(0.35,0.6,0.9),lit); gl_FragColor=vec4(c, rim*0.55);} `}
        />
      </mesh>
      <lineSegments geometry={graticule}><lineBasicMaterial color="#2b485c" transparent opacity={0.35} /></lineSegments>
      <lineSegments geometry={coasts}><lineBasicMaterial color="#8fc0e0" transparent opacity={0.85} /></lineSegments>
    </group>
  )
}

// airport beacon: a small glowing pillar + pulsing ring
function Beacon({ lat, lon, color, label }) {
  const ringRef = useRef()
  const base = useMemo(() => toVec3(lat, lon, 0, new THREE.Vector3()), [lat, lon])
  const top = useMemo(() => toVec3(lat, lon, 0.06, new THREE.Vector3()), [lat, lon])
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.25
      ringRef.current.scale.setScalar(s)
      ringRef.current.material.opacity = 0.6 - (s - 1) * 1.2
    }
  })
  const mid = base.clone().lerp(top, 0.5)
  const len = base.distanceTo(top)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), base.clone().normalize())
  return (
    <group>
      <mesh position={mid} quaternion={q}>
        <cylinderGeometry args={[0.006, 0.006, len, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={base} quaternion={q}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={ringRef} position={base} quaternion={q} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.045, 24]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.6} toneMapped={false} />
      </mesh>
      {label && (
        <Html position={top} center distanceFactor={8} occlude zIndexRange={[10, 0]}>
          <div className="globe-label" style={{ borderColor: color, color }}>{label}</div>
        </Html>
      )}
    </group>
  )
}

// the great-circle route arc, lifted above the surface, with a bright leading
// segment up to `progress` and a dim remainder
const ARC_N = 128
function RouteArc({ from, to, progressRef }) {
  const flownRef = useRef()
  const geo = useMemo(() => {
    const pts = []
    const v = new THREE.Vector3()
    for (let i = 0; i <= ARC_N; i++) {
      const f = i / ARC_N
      slerpLL([from.lat, from.lon], [to.lat, to.lon], f, v)
      // lift the arc into a shallow parabola so it stands off the globe
      const lift = 0.02 + Math.sin(f * Math.PI) * 0.16
      v.multiplyScalar(R * (1 + lift))
      pts.push(v.clone())
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [from, to])
  // the flown line uses the same geometry but only draws up to progress
  useFrame(() => {
    const progress = progressRef.current || 0
    if (flownRef.current) flownRef.current.geometry.setDrawRange(0, Math.max(2, Math.round(progress * ARC_N) + 1))
  })
  return (
    <group>
      <line geometry={geo}>
        <lineBasicMaterial color="#3a5a70" transparent opacity={0.5} toneMapped={false} />
      </line>
      <line ref={flownRef} geometry={geo}>
        <lineBasicMaterial color="#eaffb0" transparent opacity={0.95} toneMapped={false} />
      </line>
    </group>
  )
}

// the aircraft dart flying the arc + the cinematic camera
function Flyer({ from, to, progressRef, cinematic }) {
  const ref = useRef()
  const { camera } = useThree()
  const pos = useMemo(() => new THREE.Vector3(), [])
  const posAhead = useMemo(() => new THREE.Vector3(), [])
  const mid = useMemo(() => new THREE.Vector3(), [])
  const camPos = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])
  const camUp = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame(() => {
    const f = THREE.MathUtils.clamp(progressRef.current || 0, 0, 1)
    const liftAt = (t) => 0.02 + Math.sin(t * Math.PI) * 0.16
    slerpLL([from.lat, from.lon], [to.lat, to.lon], f, pos).multiplyScalar(R * (1 + liftAt(f)))
    slerpLL([from.lat, from.lon], [to.lat, to.lon], Math.min(1, f + 0.012), posAhead).multiplyScalar(R * (1 + liftAt(f + 0.012)))
    up.copy(pos).normalize()
    if (ref.current) {
      ref.current.position.copy(pos)
      ref.current.up.copy(up)
      ref.current.lookAt(posAhead)
    }
    if (!cinematic) return

    // Cinematic camera: an establishing shot of the whole route at the start,
    // easing into a chase behind the aircraft once it's underway, then an
    // arrival pull-out near the destination.
    if (f < 0.06) {
      // establishing: look at the route midpoint from off to the side + above
      slerpLL([from.lat, from.lon], [to.lat, to.lon], 0.5, mid).multiplyScalar(R * 1.18)
      const side = new THREE.Vector3().crossVectors(mid, up).normalize()
      camPos.copy(mid).addScaledVector(mid.clone().normalize(), 2.6).addScaledVector(side, 1.4)
      lookAt.copy(mid)
    } else {
      // chase: trail behind + above the aircraft, looking along the track
      const back = pos.clone().sub(posAhead).normalize()
      const dist = f > 0.9 ? 1.4 : 0.9      // pull out approaching the destination
      camPos.copy(pos).addScaledVector(back, dist).addScaledVector(up, 0.55)
      lookAt.copy(posAhead)
    }
    camera.position.lerp(camPos, 0.05)
    camUp.lerp(up, 0.04); camera.up.copy(camUp)
    camera.lookAt(lookAt)
  })

  return (
    <group ref={ref}>
      <mesh scale={0.05}>
        <coneGeometry args={[0.5, 1.6, 6]} />
        <meshBasicMaterial color="#eaffb0" toneMapped={false} />
      </mesh>
      {/* a soft glow halo so the aircraft reads from a distance */}
      <mesh scale={0.11}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial color="#d8ff3e" transparent opacity={0.25} toneMapped={false} />
      </mesh>
    </group>
  )
}

// a glowing, fading contrail ribbon trailing just behind the aircraft along the
// arc — the recent ~12% of the flown path, brightest at the plane, fading back
function Contrail({ from, to, progressRef }) {
  const ref = useRef()
  const N = 40
  const positions = useMemo(() => new Float32Array(N * 3), [])
  const colors = useMemo(() => new Float32Array(N * 3), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const liftAt = (t) => 0.02 + Math.sin(t * Math.PI) * 0.16
  const base = useMemo(() => new THREE.Color('#eaffb0'), [])
  useFrame(() => {
    const p = progressRef.current || 0
    const span = 0.12
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1)
      const f = Math.max(0, p - span * (1 - k)) // oldest at i=0, newest (=p) at end
      slerpLL([from.lat, from.lon], [to.lat, to.lon], f, v).multiplyScalar(R * (1 + liftAt(f)))
      positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z
      const fade = k * k // brighter toward the plane
      colors[i * 3] = base.r * fade; colors[i * 3 + 1] = base.g * fade; colors[i * 3 + 2] = base.b * fade
    }
    if (ref.current) {
      ref.current.geometry.attributes.position.needsUpdate = true
      ref.current.geometry.attributes.color.needsUpdate = true
    }
  })
  return (
    <line ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </line>
  )
}

// drives an internal preview progress 0→1 over `secs` when previewing, else
// tracks the live sim progress; writes into a shared ref read by arc + flyer
function ProgressDriver({ live, previewing, secs, out }) {
  const t = useRef(0)
  useFrame((_, dt) => {
    if (previewing) {
      t.current = Math.min(1, t.current + dt / secs)
      out.current = t.current
      if (t.current >= 1) t.current = 0 // loop the flyover
    } else {
      t.current = 0
      out.current = live
    }
  })
  return null
}

export default function RouteGlobe({ from, to, progress = 0, height = 560, cinematic = true }) {
  const [previewing, setPreviewing] = useState(false)
  const progressRef = useRef(progress)
  if (!from || !to) return null
  // "flying" = a preview or a live leg is underway → cinematic camera owns it;
  // otherwise the user can drag to orbit and inspect the globe.
  const flying = previewing || progress > 0.001
  return (
    <div style={{ position: 'relative', height, width: '100%', background: 'radial-gradient(120% 120% at 50% 25%, #0a1420, #05070b 70%)' }}>
      <CanvasFallback label="Globe needs WebGL — unavailable on this device">
        <Canvas camera={{ position: [0, 1.5, 6], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 3, 5]} intensity={1.4} />
          <Stars radius={80} depth={40} count={2000} factor={2.4} fade speed={0.3} />
          <group>
            <Earth />
            <Beacon lat={from.lat} lon={from.lon} color="#54ff8a" label={from.code} />
            <Beacon lat={to.lat} lon={to.lon} color="#3ec8ff" label={to.code} />
            <RouteArc from={from} to={to} progressRef={progressRef} />
            <Contrail from={from} to={to} progressRef={progressRef} />
            <Flyer from={from} to={to} progressRef={progressRef} cinematic={cinematic && flying} />
          </group>
          <ProgressDriver live={progress} previewing={previewing} secs={22} out={progressRef} />
          {!flying && (
            <OrbitControls
              enablePan={false} minDistance={2.6} maxDistance={9}
              enableDamping autoRotate autoRotateSpeed={0.4} makeDefault
            />
          )}
        </Canvas>
      </CanvasFallback>
      <button className="globe-preview" onClick={() => setPreviewing((v) => !v)}>
        {previewing ? '■ Stop flyover' : '▶ Preview flight'}
      </button>
    </div>
  )
}
