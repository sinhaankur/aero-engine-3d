import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import CanvasFallback from './CanvasFallback.jsx'
import { stepFlight } from '../sim/flight/model.js'

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

function Runway() {
  const dashes = useMemo(() => {
    const arr = []
    for (let z = -1520; z <= 1520; z += 80) arr.push(z)
    return arr
  }, [])
  return (
    <group>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[45, 0.04, 3200]} />
        <meshStandardMaterial color="#23272e" roughness={0.95} />
      </mesh>
      {dashes.map((z) => (
        <mesh key={z} position={[0, 0.06, z]}>
          <boxGeometry args={[0.9, 0.02, 30]} />
          <meshStandardMaterial color="#c9d1d9" roughness={0.8} />
        </mesh>
      ))}
      {/* thresholds */}
      {[1560, -1560].map((z) => (
        <group key={z}>
          {[-16, -12, -8, -4, 4, 8, 12, 16].map((x) => (
            <mesh key={x} position={[x, 0.06, z]}>
              <boxGeometry args={[1.8, 0.02, 24]} />
              <meshStandardMaterial color="#c9d1d9" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* edge lights */}
      {dashes.filter((_, i) => i % 2 === 0).map((z) => (
        <group key={z}>
          <mesh position={[-23.5, 0.4, z]}>
            <sphereGeometry args={[0.35, 8, 6]} />
            <meshStandardMaterial color="#e3b341" emissive="#e3b341" emissiveIntensity={2} />
          </mesh>
          <mesh position={[23.5, 0.4, z]}>
            <sphereGeometry args={[0.35, 8, 6]} />
            <meshStandardMaterial color="#e3b341" emissive="#e3b341" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
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
  const H0 = useMemo(() => new THREE.Box3().setFromObject(cloned).max.z, [cloned])

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
    // simple altitude-hold autopilot: drives the pitch channel only
    if (sim.state.apOn && sim.state.apAlt != null) {
      const err = sim.state.apAlt - sim.state.h
      const vs = sim.out ? sim.out.vsFpm : 0
      sim.controls.pitch = Math.max(-0.5, Math.min(0.5, err * 0.004 - vs * 0.0004))
    }
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
    if (view === 'cockpit') {
      // eye point in the flight deck, looking far ahead; camera banks with you
      tmp.a.set(0, 0.6, -(L / 2) * 0.88)
      g.localToWorld(tmp.a)
      tmp.b.set(0, 0.6, -(L / 2) - 900)
      g.localToWorld(tmp.b)
      tmp.c.set(0, 1, 0).applyQuaternion(g.quaternion)
      camera.up.copy(tmp.c)
      camera.position.copy(tmp.a)
      camera.lookAt(tmp.b)
      if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix() }
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
      camera.position.set(220, 26, 480)
      camera.up.set(0, 1, 0)
      camera.lookAt(g.position)
      if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix() }
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

  return (
    <CanvasFallback label="3D flight view unavailable on this device">
      <Canvas camera={{ position: [120, 40, 1700], fov: 45, near: 0.5, far: 90000 }}>
        <color attach="background" args={[sky.bg]} />
        <fog attach="fog" args={[sky.bg, visM * 0.12, visM]} />
        <hemisphereLight intensity={sky.hemi} color="#dfe9f2" groundColor="#3a4450" />
        <directionalLight position={[2500, 3800, 1200]} intensity={sky.sun} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[64000, 64000]} />
          <meshStandardMaterial map={groundTex} roughness={1} />
        </mesh>
        <Runway />
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
