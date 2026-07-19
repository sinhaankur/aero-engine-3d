import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import CanvasFallback from './CanvasFallback.jsx'
import { stepFlight, autoflight } from '../sim/flight/model.js'

/**
 * The /fly world: a 3200 m runway on an endless field grid, weather-driven
 * sky/fog/lighting, and the actual variant GLB flown by the flight model.
 * Camera views: cockpit (eye point in the flight deck), chase, tower.
 *
 * See memory/glb-axis-convention: models load nose −X, span ±Y, up −Z; the
 * double wrapper below stands them upright with the nose toward −Z so heading
 * 0 flies down the runway.
 */

function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

const SKIES = {
  day: { bg: '#6fa3d8', sun: 1.5, hemi: 0.65, ground: '#22301f' },
  haze: { bg: '#b09a6e', sun: 1.1, hemi: 0.5, ground: '#4a4228' },
  storm: { bg: '#2e3540', sun: 0.5, hemi: 0.55, ground: '#1b221e' },
  cold: { bg: '#a9c2d9', sun: 1.2, hemi: 0.7, ground: '#c8d3da' },
}

function useGroundTexture(skyId) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    const base = SKIES[skyId]?.ground || '#22301f'
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 256, 256)
    // pseudo-random field patches for motion cues (deterministic)
    let seed = 42
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 26; i++) {
      const x = rnd() * 256, y = rnd() * 256, w = 20 + rnd() * 60, h = 16 + rnd() * 50
      ctx.fillStyle = `rgba(${skyId === 'cold' ? '255,255,255' : '120,140,60'},${0.05 + rnd() * 0.1})`
      ctx.fillRect(x, y, w, h)
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 2
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(240, 240)
    tex.anisotropy = 4
    return tex
  }, [skyId])
}

// Shared markings material so the many white boxes batch under one material.
const paintMat = new THREE.MeshStandardMaterial({ color: '#d7dde3', roughness: 0.8 })
const asphaltMat = new THREE.MeshStandardMaterial({ color: '#21252b', roughness: 0.96 })

function Marking({ x = 0, z, w, l, y = 0.06, mat = paintMat }) {
  return (
    <mesh position={[x, y, z]} material={mat}>
      <boxGeometry args={[w, 0.02, l]} />
    </mesh>
  )
}

/**
 * ICAO-style runway: asphalt strip, threshold "piano keys", runway numbers,
 * touchdown-zone bars, aiming-point blocks, dashed centreline, edge + centreline
 * lights, a PAPI on the approach, an approach-light bar out past the threshold,
 * and a taxiway. Geometry mirrors sim RUNWAY (±1600 m, 45 m wide).
 */
function Runway({ night }) {
  const HL = 1600
  const centreline = useMemo(() => {
    const arr = []
    for (let z = -1440; z <= 1440; z += 60) arr.push(z)
    return arr
  }, [])
  const edgeZ = useMemo(() => {
    const arr = []
    for (let z = -1560; z <= 1560; z += 60) arr.push(z)
    return arr
  }, [])
  const lightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fff2c8', emissive: '#ffd97a', emissiveIntensity: night ? 3.2 : 1.4,
  }), [night])
  const redMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff5a4d', emissive: '#ff2a1a', emissiveIntensity: 2.6 }), [])
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef4ff', emissive: '#cfe0ff', emissiveIntensity: 2.6 }), [])

  // piano-key threshold bars at each end
  const keys = [-18, -13.5, -9, -4.5, 4.5, 9, 13.5, 18]

  return (
    <group>
      {/* asphalt + shoulders */}
      <mesh position={[0, 0.02, 0]} material={asphaltMat}>
        <boxGeometry args={[45, 0.04, 3200]} />
      </mesh>
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[62, 0.03, 3240]} />
        <meshStandardMaterial color="#2b3a24" roughness={1} />
      </mesh>

      {/* side stripes (runway edge line) */}
      <Marking x={-21} z={0} w={0.6} l={3120} />
      <Marking x={21} z={0} w={0.6} l={3120} />

      {/* dashed centreline */}
      {centreline.map((z) => <Marking key={z} z={z} w={0.9} l={30} />)}

      {/* threshold piano keys + runway number blocks, aiming points, TDZ bars */}
      {[1, -1].map((end) => (
        <group key={end}>
          {keys.map((x) => <Marking key={x} x={x} z={end * 1555} w={1.8} l={40} />)}
          {/* aiming point (two fat blocks ~400 m in) */}
          <Marking x={-6} z={end * 1150} w={4.5} l={45} />
          <Marking x={6} z={end * 1150} w={4.5} l={45} />
          {/* touchdown-zone bars */}
          {[1300, 1000].map((zz) => (
            <group key={zz}>
              <Marking x={-9} z={end * zz} w={3} l={22} />
              <Marking x={9} z={end * zz} w={3} l={22} />
            </group>
          ))}
        </group>
      ))}

      {/* edge lights */}
      {edgeZ.map((z) => (
        <group key={z}>
          <mesh position={[-23, 0.35, z]} material={lightMat}><sphereGeometry args={[0.32, 6, 5]} /></mesh>
          <mesh position={[23, 0.35, z]} material={lightMat}><sphereGeometry args={[0.32, 6, 5]} /></mesh>
        </group>
      ))}

      {/* threshold lights: green at the near threshold, red at the far */}
      {keys.concat([-22, 22]).map((x) => (
        <mesh key={`g${x}`} position={[x, 0.3, 1560]} material={whiteMat}><boxGeometry args={[0.7, 0.4, 0.4]} /></mesh>
      ))}

      {/* PAPI — four boxes off the left of the touchdown zone */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-32, 0.6, 1180 + i * 3]} material={i < 2 ? whiteMat : redMat}>
          <boxGeometry args={[1.4, 1, 1.4]} />
        </mesh>
      ))}

      {/* approach lighting: a bar array running out past the near threshold */}
      {[1650, 1710, 1770, 1830, 1890, 1950].map((z, i) => (
        <group key={z}>
          <mesh position={[0, 0.3, z]} material={whiteMat}><boxGeometry args={[0.8 + i * 0.3, 0.3, 0.4]} /></mesh>
        </group>
      ))}

      {/* parallel taxiway */}
      <mesh position={[75, 0.018, 0]} material={asphaltMat}>
        <boxGeometry args={[22, 0.036, 2600]} />
      </mesh>
      {/* taxiway centreline (yellow) */}
      {useMemo(() => { const a = []; for (let z = -1200; z <= 1200; z += 40) a.push(z); return a }, []).map((z) => (
        <mesh key={z} position={[75, 0.055, z]}>
          <boxGeometry args={[0.5, 0.02, 20]} />
          <meshStandardMaterial color="#d7b53a" roughness={0.8} />
        </mesh>
      ))}
      {/* twy link to runway */}
      <mesh position={[47, 0.018, 1400]} material={asphaltMat}>
        <boxGeometry args={[60, 0.036, 22]} />
      </mesh>
    </group>
  )
}

function Buildings() {
  const items = useMemo(() => {
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const arr = []
    for (let i = 0; i < 60; i++) {
      const ang = rnd() * Math.PI * 2
      const dist = 500 + rnd() * 4500
      const x = Math.cos(ang) * dist
      const z = Math.sin(ang) * dist
      if (Math.abs(x) < 150 && Math.abs(z) < 2200) continue // clear the runway corridor
      arr.push({ x, z, w: 14 + rnd() * 40, h: 8 + rnd() * 55, d: 14 + rnd() * 40 })
    }
    return arr
  }, [])
  return (
    <group>
      {items.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color="#2d333b" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function AircraftModel({ url, simRef, groupRef }) {
  const { scene } = useGLTF(withBase(url))
  const cloned = useMemo(() => scene.clone(true), [scene])

  // Ground clearance: the render wraps the raw GLB (nose −X, span ±Y, up −Z per
  // glb-axis-convention) with y=−π/2 then x=+π/2 so it stands upright. To sit
  // the gear exactly on the runway we need the *upright* model's lowest point,
  // so we replicate the wrapper on a temp group and measure its world box.
  const H0 = useMemo(() => {
    const probe = new THREE.Group()
    const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2
    const inner2 = new THREE.Group(); inner2.rotation.x = Math.PI / 2
    const m = cloned.clone(true)
    inner2.add(m); inner.add(inner2); probe.add(inner)
    probe.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(probe)
    // gear reference sits on the ground, so lift the group by the belly depth
    return -box.min.y
  }, [cloned])

  // expose the model's true ground clearance to the sim (camera/spawn scaling)
  useEffect(() => { if (simRef.current) simRef.current.groundClear = H0 }, [H0, simRef])

  useFrame(() => {
    const g = groupRef.current
    const s = simRef.current?.state
    if (!g || !s) return
    g.position.set(s.x, s.h + H0, s.z)
    g.rotation.order = 'YXZ'
    g.rotation.set(s.theta, -s.psi, -s.phi)
    // stall buffet: a visible airframe shudder
    if (s.buffet > 0.02) {
      g.position.y += Math.sin(s.t * 43) * 0.12 * s.buffet
      g.rotation.z += Math.sin(s.t * 37) * 0.01 * s.buffet
    }
  })

  return (
    <group ref={groupRef}>
      <group rotation={[0, -Math.PI / 2, 0]}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <primitive object={cloned} />
        </group>
      </group>
    </group>
  )
}

function Runner({ simRef }) {
  useFrame((_, dt) => {
    const sim = simRef.current
    if (!sim || sim.paused || sim.state.crashed) return
    // autopilot / autothrust overwrite the relevant control channels first
    autoflight(sim.state, sim.ac, sim.controls, sim.out, Math.min(dt, 0.05))
    sim.out = stepFlight(sim.state, sim.ac, sim.controls, sim.weather, dt)
  })
  return null
}

function CameraRig({ simRef, groupRef, view, dims }) {
  const { camera } = useThree()
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }), [])
  useFrame(() => {
    const s = simRef.current?.state
    const g = groupRef.current
    if (!s || !g) return
    const L = dims.lengthM
    // pilot eye height above the gear reference, scaled by the model's own
    // ground clearance so a widebody sits higher than a regional jet
    const eyeH = (simRef.current?.groundClear || 2) + Math.max(1.4, L * 0.03)
    if (view === 'cockpit') {
      // eye point just aft of the nose in the flight deck, looking far ahead
      // and slightly down the runway; camera banks with the airframe
      tmp.a.set(0, eyeH, -(L / 2) * 0.82)
      g.localToWorld(tmp.a)
      tmp.b.set(0, eyeH - L * 0.02, -(L / 2) - 1200)
      g.localToWorld(tmp.b)
      tmp.c.set(0, 1, 0).applyQuaternion(g.quaternion)
      camera.up.copy(tmp.c)
      camera.position.copy(tmp.a)
      camera.lookAt(tmp.b)
      if (camera.fov !== 65) { camera.fov = 65; camera.updateProjectionMatrix() }
    } else if (view === 'chase') {
      const fx = Math.sin(s.psi)
      const fz = -Math.cos(s.psi)
      const dist = L * 2.1
      tmp.a.set(s.x - fx * dist, s.h + dist * 0.34, s.z - fz * dist)
      camera.position.lerp(tmp.a, 0.09)
      camera.up.set(0, 1, 0)
      tmp.b.copy(g.position)
      camera.lookAt(tmp.b)
      if (camera.fov !== 45) { camera.fov = 45; camera.updateProjectionMatrix() }
    } else {
      // tower: fixed cab beside the runway, tracking the aircraft like ATC
      tmp.a.set(150, 40, 1650)
      camera.position.lerp(tmp.a, 1)
      camera.up.set(0, 1, 0)
      tmp.b.copy(g.position)
      camera.lookAt(tmp.b)
      // gently zoom the fov so a distant aircraft stays readable
      const range = camera.position.distanceTo(g.position)
      const fov = Math.max(12, Math.min(50, 4000 / range * 12))
      if (Math.abs(camera.fov - fov) > 0.3) { camera.fov = fov; camera.updateProjectionMatrix() }
    }
  })
  return null
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#8b949e', font: '13px system-ui' }}>Loading aircraft…</div>
    </Html>
  )
}

export default function FlightScene({ simRef, modelUrl, dims, weather, view }) {
  const sky = SKIES[weather.sky] || SKIES.day
  const groundTex = useGroundTexture(weather.sky)
  const groupRef = useRef()
  const visM = weather.visKm * 1000

  const night = weather.sky === 'storm'
  return (
    <CanvasFallback label="3D flight view unavailable on this device">
      <Canvas
        // dpr cap keeps 4K/retina from tanking the framerate; high-perf GPU hint
        dpr={[1, 1.75]}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        camera={{ position: [150, 40, 1700], fov: 45, near: 0.5, far: 90000 }}
      >
        <color attach="background" args={[sky.bg]} />
        <fog attach="fog" args={[sky.bg, visM * 0.12, visM]} />
        <hemisphereLight intensity={sky.hemi} color="#dfe9f2" groundColor="#3a4450" />
        <directionalLight position={[2500, 3800, 1200]} intensity={sky.sun} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[64000, 64000]} />
          <meshStandardMaterial map={groundTex} roughness={1} />
        </mesh>
        <Runway night={night} />
        <Buildings />

        <Suspense fallback={<Loader />}>
          <AircraftModel url={modelUrl} simRef={simRef} groupRef={groupRef} />
        </Suspense>
        <Runner simRef={simRef} />
        <CameraRig simRef={simRef} groupRef={groupRef} view={view} dims={dims} />
      </Canvas>
    </CanvasFallback>
  )
}
