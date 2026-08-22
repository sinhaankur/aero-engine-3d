import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Environment, Lightformer, Text, Sky, Stars, Clouds, Cloud } from '@react-three/drei'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { useGLTF } from './gltf.js'
import * as THREE from 'three'
import CanvasFallback from './CanvasFallback.jsx'
import { stepFlight, autoflight } from '../sim/flight/model.js'
import { collectParts, updateParts } from './modelAnim.js'

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

// Each weather sky drives both the fallback background colour AND a physical
// drei <Sky> (Preetham scattering). `elev`/`azim` place the sun in the dome;
// `turbidity`/`rayleigh` set the haze thickness and blue depth; `mie*` the
// sun-disc bloom. High sun + low turbidity = crisp clear day; low sun + high
// turbidity = a heavy, golden storm/haze horizon.
const SKIES = {
  day:  { bg: '#6fa3d8', sun: 1.5, hemi: 0.65, ground: '#22301f', elev: 34, azim: 155, turbidity: 3.0,  rayleigh: 1.6, mieCoefficient: 0.006, mieDirectionalG: 0.85, sunTint: '#fff4e0' },
  haze: { bg: '#b09a6e', sun: 1.1, hemi: 0.5,  ground: '#4a4228', elev: 18, azim: 200, turbidity: 9.0,  rayleigh: 2.4, mieCoefficient: 0.012, mieDirectionalG: 0.90, sunTint: '#ffdca0' },
  storm:{ bg: '#2e3540', sun: 0.5, hemi: 0.55, ground: '#1b221e', elev: 8,  azim: 210, turbidity: 12.0, rayleigh: 3.0, mieCoefficient: 0.020, mieDirectionalG: 0.80, sunTint: '#c9d2dc' },
  cold: { bg: '#a9c2d9', sun: 1.2, hemi: 0.7,  ground: '#c8d3da', elev: 22, azim: 130, turbidity: 4.0,  rayleigh: 2.0, mieCoefficient: 0.005, mieDirectionalG: 0.86, sunTint: '#eaf2ff' },
}

// Unit sun direction from elevation/azimuth (degrees). Elevation 0 = horizon,
// 90 = overhead; azimuth measured clockwise from −z. Shared by the sky dome, the
// key light and the reflection environment so every highlight agrees.
function sunVector(elevDeg, azimDeg, out = new THREE.Vector3()) {
  const el = elevDeg * Math.PI / 180
  const az = azimDeg * Math.PI / 180
  return out.set(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    -Math.cos(el) * Math.cos(az),
  ).normalize()
}

// Land-cover palettes per weather/season. Earthlike patchwork of fields,
// forest, bare soil, water — not a single flat green lawn.
const LANDCOVER = {
  day:  { base: '#33452a', fields: ['#3d5228', '#4a5c2e', '#5b6b34', '#6d7a3c', '#7c8347'], soil: '#6b5636', forest: '#22331c', water: '#2a4a63' },
  haze: { base: '#5a4e2e', fields: ['#6b5a30', '#7a6838', '#8a7742', '#9a854c', '#a8925a'], soil: '#8a6a3c', forest: '#4a4326', water: '#4a5a5a' },
  storm:{ base: '#26302a', fields: ['#2c3a26', '#33422b', '#3c4a30', '#455236', '#4d5a3c'], soil: '#4a4232', forest: '#1c261e', water: '#22303a' },
  cold: { base: '#cdd6dc', fields: ['#d6dee3', '#c4d0d8', '#dce4e8', '#b8c6d0', '#e2e8ec'], soil: '#a8b0b4', forest: '#8a9aa0', water: '#7a94a6' },
}

function useGroundTexture(skyId) {
  return useMemo(() => {
    const SZ = 1024
    const c = document.createElement('canvas')
    c.width = c.height = SZ
    const ctx = c.getContext('2d')
    const pal = LANDCOVER[skyId] || LANDCOVER.day
    let seed = 1337
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

    ctx.fillStyle = pal.base
    ctx.fillRect(0, 0, SZ, SZ)

    // large soft regions of forest / open land (value-noise blobs)
    for (let i = 0; i < 40; i++) {
      const x = rnd() * SZ, y = rnd() * SZ, r = 60 + rnd() * 220
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const col = rnd() < 0.4 ? pal.forest : pal.fields[(rnd() * pal.fields.length) | 0]
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.globalAlpha = 0.5 + rnd() * 0.3
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1

    // agricultural field mosaic — rotated rectangular parcels in varied greens
    for (let i = 0; i < 260; i++) {
      const x = rnd() * SZ, y = rnd() * SZ
      const w = 24 + rnd() * 90, h = 18 + rnd() * 70
      ctx.save(); ctx.translate(x, y); ctx.rotate((rnd() - 0.5) * 0.9)
      ctx.fillStyle = pal.fields[(rnd() * pal.fields.length) | 0]
      ctx.globalAlpha = 0.55 + rnd() * 0.4
      ctx.fillRect(-w / 2, -h / 2, w, h)
      // occasional bare-soil parcel
      if (rnd() < 0.18) { ctx.fillStyle = pal.soil; ctx.fillRect(-w / 2, -h / 2, w, h) }
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // a meandering river + a couple of lakes
    ctx.strokeStyle = pal.water; ctx.lineWidth = 6 + rnd() * 6; ctx.lineCap = 'round'
    ctx.beginPath()
    let rx = rnd() * SZ, ry = 0
    ctx.moveTo(rx, ry)
    while (ry < SZ) { rx += (rnd() - 0.5) * 120; ry += 30 + rnd() * 40; ctx.lineTo(rx, ry) }
    ctx.stroke()
    ctx.fillStyle = pal.water
    for (let i = 0; i < 5; i++) {
      const x = rnd() * SZ, y = rnd() * SZ, r = 12 + rnd() * 34
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * 6, 0, Math.PI * 2); ctx.fill()
    }

    // fine speckle for texture at low altitude
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.05})`
      ctx.fillRect(rnd() * SZ, rnd() * SZ, 1.5, 1.5)
    }

    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    // repeat only a handful of times across the 64 km sheet so the varied land
    // reads as different places, not a stamped tile
    tex.repeat.set(12, 12)
    tex.anisotropy = 8
    return tex
  }, [skyId])
}

// A soft radial-gradient sprite, reused for smoke puffs (round, feathered edge).
let _softSprite = null
function softSprite() {
  if (_softSprite) return _softSprite
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  _softSprite = new THREE.CanvasTexture(c)
  return _softSprite
}

// Shared markings material so the many white boxes batch under one material.
const paintMat = new THREE.MeshStandardMaterial({ color: '#d7dde3', roughness: 0.8 })
const asphaltMat = new THREE.MeshStandardMaterial({ color: '#21252b', roughness: 0.96 })
const unitBox = new THREE.BoxGeometry(1, 1, 1)
const unitSphere = new THREE.SphereGeometry(0.5, 6, 5)

/**
 * Render many identical-material boxes as ONE InstancedMesh (one draw call).
 * `items` is [{x,y,z,w,h,l}]; the whole runway's paint + lights collapse from
 * hundreds of meshes to a handful of instanced batches.
 */
function InstancedBoxes({ items, material, geometry = unitBox }) {
  const ref = useRef()
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const mat = new THREE.Matrix4()
    items.forEach((b, i) => {
      mat.makeScale(b.w ?? 1, b.h ?? 0.02, b.l ?? 1)
      mat.setPosition(b.x ?? 0, b.y ?? 0.06, b.z ?? 0)
      m.setMatrixAt(i, mat)
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />
}

/**
 * ICAO-style runway: asphalt strip, threshold "piano keys", runway numbers,
 * touchdown-zone bars, aiming-point blocks, dashed centreline, edge + centreline
 * lights, a PAPI on the approach, an approach-light bar out past the threshold,
 * and a taxiway. Geometry mirrors sim RUNWAY (±1600 m, 45 m wide).
 */
const twyLineMat = new THREE.MeshStandardMaterial({ color: '#d7b53a', roughness: 0.8 })

// the reciprocal runway designator for the far threshold: opposite heading
// (±18) and swapped L/R (a "27R" one way is "09L" the other).
function reciprocalRwy(id = '') {
  const m = id.match(/^(\d{1,2})([LRC]?)$/i)
  if (!m) return ''
  let num = (parseInt(m[1], 10) + 18) % 36
  if (num === 0) num = 36
  const side = m[2] ? ({ L: 'R', R: 'L', C: 'C' }[m[2].toUpperCase()]) : ''
  return String(num).padStart(2, '0') + side
}

function Runway({ night, halfLen = 1600, airport }) {
  const HL = halfLen
  const rwyId = airport?.rwy?.id || ''
  const rwyRecip = reciprocalRwy(rwyId)
  const lightMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#fff2c8', emissive: '#ffd97a', emissiveIntensity: night ? 3.2 : 1.4,
  }), [night])
  const redMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff5a4d', emissive: '#ff2a1a', emissiveIntensity: 2.6 }), [])
  const whiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#eef4ff', emissive: '#cfe0ff', emissiveIntensity: 2.6 }), [])

  const keys = [-18, -13.5, -9, -4.5, 4.5, 9, 13.5, 18]
  const thr = HL - 40, aim = HL - 450, tdz1 = HL - 300, tdz2 = HL - 600

  // Build every marking / light group as flat instance lists once, then draw
  // each material with a single InstancedMesh (paint, twy dashes, edge lights,
  // threshold/approach lights, PAPI). ~200 meshes → ~6 draw calls.
  const paint = useMemo(() => {
    const a = []
    a.push({ x: -21, w: 0.6, l: HL * 2 - 80 }, { x: 21, w: 0.6, l: HL * 2 - 80 })      // side stripes
    for (let z = -(HL - 160); z <= HL - 160; z += 60) a.push({ z, w: 0.9, l: 30 })       // centreline
    for (const end of [1, -1]) {
      for (const x of keys) a.push({ x, z: end * (thr - 5), w: 1.8, l: 40 })              // piano keys
      a.push({ x: -6, z: end * aim, w: 4.5, l: 45 }, { x: 6, z: end * aim, w: 4.5, l: 45 }) // aiming
      for (const zz of [tdz1, tdz2]) { a.push({ x: -9, z: end * zz, w: 3, l: 22 }, { x: 9, z: end * zz, w: 3, l: 22 }) }
    }
    return a
  }, [HL])
  const twyDashes = useMemo(() => {
    const a = []
    for (let z = -(HL - 400); z <= HL - 400; z += 40) a.push({ x: 75, y: 0.055, z, w: 0.5, l: 20 })
    return a
  }, [HL])
  const edgeLights = useMemo(() => {
    const a = []
    for (let z = -(HL - 40); z <= HL - 40; z += 60) { a.push({ x: -23, y: 0.35, z, w: 0.64, h: 0.64, l: 0.64 }, { x: 23, y: 0.35, z, w: 0.64, h: 0.64, l: 0.64 }) }
    return a
  }, [HL])
  const whiteLights = useMemo(() => {
    const a = []
    for (const x of keys.concat([-22, 22])) a.push({ x, y: 0.3, z: thr, w: 0.7, h: 0.4, l: 0.4 })   // threshold
    for (let i = 0; i < 6; i++) a.push({ x: 0, y: 0.3, z: thr + 50 + i * 60, w: 0.8 + i * 0.3, h: 0.3, l: 0.4 }) // approach
    a.push({ x: -32, y: 0.6, z: aim, w: 1.4, h: 1, l: 1.4 }, { x: -32, y: 0.6, z: aim + 3, w: 1.4, h: 1, l: 1.4 }) // PAPI whites
    return a
  }, [HL])
  const redLights = useMemo(() => ([
    { x: -32, y: 0.6, z: aim + 6, w: 1.4, h: 1, l: 1.4 }, { x: -32, y: 0.6, z: aim + 9, w: 1.4, h: 1, l: 1.4 },
  ]), [HL])

  return (
    <group>
      {/* asphalt + shoulders (2 static meshes) */}
      <mesh position={[0, 0.02, 0]} material={asphaltMat}><boxGeometry args={[45, 0.04, HL * 2]} /></mesh>
      <mesh position={[0, 0.015, 0]}><boxGeometry args={[62, 0.03, HL * 2 + 40]} /><meshStandardMaterial color="#2b3a24" roughness={1} /></mesh>

      {/* all paint markings in one instanced batch */}
      <InstancedBoxes items={paint} material={paintMat} />
      {/* runway lights, batched by colour */}
      <InstancedBoxes items={edgeLights} material={lightMat} geometry={unitSphere} />
      <InstancedBoxes items={whiteLights} material={whiteMat} />
      <InstancedBoxes items={redLights} material={redMat} />

      {/* taxiway (2 static asphalt meshes + one instanced dash batch) */}
      <mesh position={[75, 0.018, 0]} material={asphaltMat}><boxGeometry args={[22, 0.036, HL * 1.6]} /></mesh>
      <mesh position={[47, 0.018, thr - 160]} material={asphaltMat}><boxGeometry args={[60, 0.036, 22]} /></mesh>
      <InstancedBoxes items={twyDashes} material={twyLineMat} />

      {/* painted runway designators — the real ID on the departure threshold and
          its reciprocal on the far end, so each airport reads as itself */}
      {rwyId && (
        <Text position={[0, 0.09, HL - 120]} rotation={[-Math.PI / 2, 0, 0]}
          fontSize={26} color="#eef4ff" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          {rwyId}
        </Text>
      )}
      {rwyRecip && (
        <Text position={[0, 0.09, -(HL - 120)]} rotation={[-Math.PI / 2, 0, Math.PI]}
          fontSize={26} color="#eef4ff" anchorX="center" anchorY="middle" letterSpacing={0.08}>
          {rwyRecip}
        </Text>
      )}

      {/* ATC control tower beside the field, with the airport code on the cab */}
      {airport && (
        <group position={[130, 0, thr - 260]}>
          <mesh position={[0, 16, 0]} castShadow>
            <cylinderGeometry args={[3, 4.5, 32, 12]} />
            <meshStandardMaterial color="#c8ccd2" roughness={0.7} />
          </mesh>
          {/* glazed cab */}
          <mesh position={[0, 34, 0]}>
            <cylinderGeometry args={[6.5, 5.5, 6, 12]} />
            <meshStandardMaterial color="#0d1b2a" emissive="#132a44" emissiveIntensity={night ? 1.2 : 0.3} roughness={0.2} metalness={0.4} />
          </mesh>
          {/* roof */}
          <mesh position={[0, 38, 0]}><cylinderGeometry args={[7, 7, 1, 12]} /><meshStandardMaterial color="#8a929c" /></mesh>
          {/* rotating beacon */}
          <mesh position={[0, 39.5, 0]}><sphereGeometry args={[0.8, 8, 8]} /><meshStandardMaterial color="#54ff8a" emissive="#54ff8a" emissiveIntensity={2.5} /></mesh>
          <Text position={[0, 22, 6.6]} fontSize={5} color="#0b2038" anchorX="center" anchorY="middle" outlineWidth={0.15} outlineColor="#e8eef5">
            {airport.code}
          </Text>
        </group>
      )}

      {/* field identity sign at the departure end — code + city */}
      {airport && (
        <group position={[-70, 0, thr - 40]}>
          <mesh position={[0, 3, 0]}><boxGeometry args={[34, 6, 1]} /><meshStandardMaterial color="#0b1f12" /></mesh>
          <Text position={[0, 3.6, 0.6]} fontSize={4} color="#ffd23a" anchorX="center" anchorY="middle">
            {airport.code} · RWY {rwyId}
          </Text>
          <Text position={[0, 1.4, 0.6]} fontSize={2.4} color="#cfe0ff" anchorX="center" anchorY="middle">
            {airport.city}
          </Text>
        </group>
      )}
    </group>
  )
}

// Buildings as a single InstancedMesh — one draw call for the whole skyline
// instead of 60. A unit box is scaled per instance via the instance matrix.
const buildingGeo = new THREE.BoxGeometry(1, 1, 1)
const buildingMat = new THREE.MeshStandardMaterial({ color: '#2d333b', roughness: 0.9 })

function Buildings() {
  const ref = useRef()
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

  useEffect(() => {
    const m = ref.current
    if (!m) return
    const mat = new THREE.Matrix4()
    items.forEach((b, i) => {
      mat.makeScale(b.w, b.h, b.d)
      mat.setPosition(b.x, b.h / 2, b.z)
      m.setMatrixAt(i, mat)
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [items])

  return <instancedMesh ref={ref} args={[buildingGeo, buildingMat, items.length]} frustumCulled={false} />
}

function AircraftModel({ url, simRef, groupRef }) {
  const { scene } = useGLTF(withBase(url))
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    // the airframe casts a shadow on the runway/terrain — the single biggest cue
    // that the jet is really sitting on (and lifting off) the ground
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    return c
  }, [scene])

  // The GLB already carries landing gear (built by generate_airframe_hd.py).
  // The bounding-box minimum, though, is the wingtip/nacelle — lower than the
  // wheels in the upright frame — so seating on it makes the jet rest on a
  // wingtip with the wheels hovering. Instead we find the lowest geometry near
  // the centreline (|x| within a fraction of span): that's the gear/wheels, the
  // true contact point. We measure it in the same upright wrapper the scene uses.
  //
  // The gear is a handful of Cylinder/Torus meshes below the belly, so we scan
  // only those meshes' vertices — not the whole 60–90k-tri airframe. That keeps
  // a variant switch from stalling the main thread (was ~100k applyMatrix4 calls
  // per model load; a visible freeze on the projector's WebView).
  const H0 = useMemo(() => {
    const probe = new THREE.Group()
    const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2
    const inner2 = new THREE.Group(); inner2.rotation.x = Math.PI / 2
    inner2.add(cloned.clone(true)); inner.add(inner2); probe.add(inner)
    probe.updateWorldMatrix(true, true)
    const full = new THREE.Box3().setFromObject(probe)
    const span = full.max.x - full.min.x
    const bandX = span * 0.14 // centreline band that captures nose+main gear
    const midY = (full.max.y + full.min.y) / 2
    let wheelMinY = Infinity
    const v = new THREE.Vector3()
    const box = new THREE.Box3()
    probe.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return
      // gear candidates only: named Cylinder/Torus, sitting in the lower half.
      // Skip the big skin/wing meshes entirely — that's where the cost was.
      if (!/Cylinder|Torus/i.test(o.name)) return
      box.setFromObject(o)
      if (box.min.y > midY) return                 // not below the belly
      const pos = o.geometry.attributes.position
      o.updateWorldMatrix(true, false)
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
        if (Math.abs(v.x) <= bandX && v.y < wheelMinY) wheelMinY = v.y
      }
    })
    // fall back to the full box if we found no gear geometry near the centreline
    const contact = isFinite(wheelMinY) ? wheelMinY : full.min.y
    return -contact
  }, [cloned])

  useEffect(() => { if (simRef.current) simRef.current.groundClear = H0 }, [H0, simRef])

  // Collect the animatable sub-nodes once: fan blades (spin with N1) and the
  // landing gear (retract up into the belly when gear is up). The GLB is in the
  // raw frame here (nose −X, up −Z), so the fan axis is local X and "up into the
  // belly" is local +Z. Gear meshes are the unnamed cylinders/wheels sitting
  // below the fuselage centreline.
  const anim = useMemo(() => collectParts(cloned), [cloned])

  useFrame((_, dt) => {
    const g = groupRef.current
    const s = simRef.current?.state
    const out = simRef.current?.out
    if (!g || !s) return
    g.position.set(s.x, s.h + H0, s.z)
    g.rotation.order = 'YXZ'
    g.rotation.set(s.theta, -s.psi, -s.phi)
    if (s.buffet > 0.02) {
      g.position.y += Math.sin(s.t * 43) * 0.12 * s.buffet
      g.rotation.z += Math.sin(s.t * 37) * 0.01 * s.buffet
    }
    updateParts(anim, Math.min(dt, 0.05), {
      n1: out ? out.n1 / 100 : 0.05,
      flap: s.flap / 3,
      gearDown: s.gear,
      roll: simRef.current?.controls?.roll || 0,
    })
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
    // Fixed-step integration. A raw dt from a frame hitch (tab refocus, GC) used
    // to be integrated in one giant leap, teleporting the aircraft — the visible
    // "stutter". Instead accumulate real time and advance the physics in capped
    // sub-steps, so a long frame catches up smoothly instead of lurching.
    const STEP = 1 / 60
    let acc = (sim._acc || 0) + Math.min(dt, 0.1)   // cap catch-up at 100 ms
    let n = 0
    while (acc >= STEP && n < 6) {                   // at most 6 sub-steps/frame
      autoflight(sim.state, sim.ac, sim.controls, sim.out, STEP)
      sim.out = stepFlight(sim.state, sim.ac, sim.controls, sim.weather, STEP)
      acc -= STEP
      n++
    }
    sim._acc = acc
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
    } else if (view === 'wing') {
      // passenger window: eye at a left-side cabin window over the wing, looking
      // outboard + slightly down/aft so the wing and the world below fill the view
      const eye = eyeH * 0.62
      tmp.a.set(-L * 0.04, eye, L * 0.02)        // just inboard of the window line
      g.localToWorld(tmp.a)
      tmp.b.set(-L * 0.9, eye - L * 0.10, L * 0.14) // look out over the left wing
      g.localToWorld(tmp.b)
      tmp.c.set(0, 1, 0).applyQuaternion(g.quaternion)
      camera.up.copy(tmp.c)
      camera.position.copy(tmp.a)
      camera.lookAt(tmp.b)
      if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix() }
    } else if (view === 'chase') {
      const fx = Math.sin(s.psi)
      const fz = -Math.cos(s.psi)
      const altFt = s.h / 0.3048
      // Cinematic moments: a dramatic low, close, tighter-lens angle during the
      // rotation/liftoff window and on short final; the standard high chase
      // otherwise. Everything eases so the transitions feel filmic.
      const nearGround = altFt < 260 && s.v > 30
      const rotating = !s.onGround && s.airborneOnce && altFt < 260
      const onFinal = !s.onGround && s.phase === 'approach' && altFt < 300
      const dramatic = nearGround && (rotating || onFinal)
      const dist = L * (dramatic ? 1.5 : 2.1)
      const lift = dramatic ? dist * 0.10 : dist * 0.34   // hug the ground for drama
      const side = dramatic ? L * 0.5 : 0                  // slight off-axis angle
      tmp.a.set(
        s.x - fx * dist + Math.cos(s.psi) * side,
        Math.max(s.h + lift, 3),
        s.z - fz * dist + Math.sin(s.psi) * side,
      )
      camera.position.lerp(tmp.a, dramatic ? 0.06 : 0.09)
      camera.up.set(0, 1, 0)
      tmp.b.copy(g.position)
      camera.lookAt(tmp.b)
      const fov = dramatic ? 38 : 45
      if (Math.abs(camera.fov - fov) > 0.3) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix() }
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

/**
 * Physical sky dome + altitude starfield. drei's <Sky> is a Preetham scattering
 * model: a real graded blue dome with a sun disc and horizon glow, placed from
 * the weather's sun elevation/azimuth. As you climb past the troposphere it
 * dissolves into the deep-space background (see Atmosphere) and the stars,
 * already there, take over — so leaving the surface reads the way it does from a
 * real flight deck. The dome sits on a huge sphere so it's always beyond the fog.
 */
function FlightSky({ sky, simRef }) {
  const skyRef = useRef()
  const starsRef = useRef()
  const sunPos = useMemo(() => {
    const v = sunVector(sky.elev, sky.azim).multiplyScalar(1000)
    return [v.x, v.y, v.z]
  }, [sky])

  useFrame(() => {
    const h = simRef.current?.state?.h || 0
    // The scattering dome owns the surface layer; above ~14 km there's almost no
    // atmosphere to scatter, so hand off to the deep-space background + stars.
    // drei's <Sky> shader has no opacity, so we fade the whole dome by shrinking
    // it below the far plane once it's no longer wanted (a clean on/off with a
    // little hysteresis via the height threshold).
    if (skyRef.current) skyRef.current.visible = h < 15000
    // Stars are always in the scene; they only read against the dark high-altitude
    // sky, so a simple visibility gate from ~6 km up is enough and costs nothing.
    if (starsRef.current) starsRef.current.visible = h > 6000
  })

  return (
    <group>
      <Sky
        ref={skyRef}
        distance={45000}
        sunPosition={sunPos}
        turbidity={sky.turbidity}
        rayleigh={sky.rayleigh}
        mieCoefficient={sky.mieCoefficient}
        mieDirectionalG={sky.mieDirectionalG}
      />
      <Stars ref={starsRef} radius={40000} depth={8000} count={2600} factor={90} saturation={0} fade speed={0.4} />
    </group>
  )
}

/**
 * A broken cloud deck you climb through. drei's <Clouds> batches every puff into
 * one instanced draw, so a whole scattered layer is cheap. The deck sits at a
 * realistic altitude band (denser + lower in poor weather) and re-centres on the
 * aircraft each frame so there's always cloud around you to punch through —
 * the single most visceral "I'm flying" cue on climb-out and descent. Skipped
 * entirely on a crystal-clear day so the clean-sky case stays clean.
 */
// Each deck now spans TWO bands so clouds are visible from the runway (a low
// scattered layer nearby) all the way up (a higher broken deck you climb into).
// count is per band; spread is the horizontal radius of the scatter.
const CLOUD_DECKS = {
  day:  { lowM: 750,  highM: 2400, count: 10, opacity: 0.7,  spread: 3400 },
  haze: { lowM: 500,  highM: 1800, count: 14, opacity: 0.82, spread: 2800 },
  storm:{ lowM: 320,  highM: 1300, count: 18, opacity: 0.95, spread: 2400 },
  cold: { lowM: 650,  highM: 2100, count: 12, opacity: 0.75, spread: 3200 },
}

function CloudDeck({ skyId, simRef }) {
  const cfg = CLOUD_DECKS[skyId]
  const groupRef = useRef()
  // deterministic scatter across both bands so the deck is stable frame to frame
  const puffs = useMemo(() => {
    if (!cfg) return []
    let seed = 91
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const make = (baseM, spreadMul, scaleBase) => Array.from({ length: cfg.count }, () => ({
      x: (rnd() - 0.5) * cfg.spread * 2 * spreadMul,
      y: baseM + (rnd() - 0.5) * 400,
      z: (rnd() - 0.5) * cfg.spread * 2 * spreadMul,
      scale: scaleBase + rnd() * 380,
      seed: rnd() * 100,
    }))
    // low band clusters tighter + smaller (nearby cumulus); high band spreads wide
    return [...make(cfg.lowM, 0.7, 300), ...make(cfg.highM, 1.1, 340)]
  }, [cfg])

  // slide the whole deck to stay centred on the jet (in x/z only — the band keeps
  // its real altitude) so you never run out of cloud, without spawning thousands
  useFrame(() => {
    const g = simRef.current?.state
    if (!groupRef.current || !g) return
    groupRef.current.position.x = g.x
    groupRef.current.position.z = g.z
  })

  if (!cfg) return null
  return (
    <group ref={groupRef}>
      {/* drei's <Cloud>: `bounds` is the cloud's extent in metres (segments are
          scattered across it), and `volume` is the SIZE of each puff-sprite — it
          must scale with the cloud or the sprites are microscopic inside a huge
          box (that was the bug: default volume 6 in a 300 m cloud = invisible).
          ~0.16×scale makes ~50–115 m sprites that overlap into a solid cloud. */}
      <Clouds material={THREE.MeshLambertMaterial} limit={puffs.length * 40}>
        {puffs.map((p, i) => (
          <Cloud
            key={i}
            seed={p.seed}
            position={[p.x, p.y, p.z]}
            bounds={[p.scale, p.scale * 0.4, p.scale]}
            segments={26}
            volume={p.scale * 0.16}
            growth={p.scale * 0.05}
            concentrate="inside"
            opacity={cfg.opacity}
            speed={0.05}
            color="#f2f5fa"
          />
        ))}
      </Clouds>
    </group>
  )
}

/**
 * Sun key light with a shadow frustum that follows the aircraft. A directional
 * light's shadow is an orthographic box; if it's fixed at the origin the plane
 * flies out of it and loses its shadow. Here the light + its target ride along
 * over the aircraft (offset up-sun) so a tight, high-res shadow box stays
 * centred on the jet the whole way down the runway and into the flare. Shadows
 * are dropped in the storm sky (no real sun) to save the shadow pass.
 */
function SunLight({ simRef, sunDir, intensity, color, shadows }) {
  const lightRef = useRef()
  const targetRef = useRef()
  const off = useMemo(() => sunDir.clone().multiplyScalar(600), [sunDir])
  useFrame(() => {
    const g = simRef.current?.state
    const l = lightRef.current
    const t = targetRef.current
    if (!l || !t || !g) return
    const gy = (g.h || 0)
    t.position.set(g.x, gy, g.z)
    l.position.set(g.x + off.x, gy + off.y, g.z + off.z)
    l.target = t
    t.updateMatrixWorld()
  })
  return (
    <>
      <object3D ref={targetRef} />
      <directionalLight
        ref={lightRef}
        intensity={intensity}
        color={color}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={1400}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
      />
    </>
  )
}

/**
 * Altitude atmosphere: drives the scene background + fog by height so climbing
 * actually leaves the surface. Low down the physical sky dome (FlightSky) owns
 * the look and the background just matches the horizon; as you climb the
 * background darkens through deep blue to near-black space and the fog pushes far
 * out, so the ground recedes and the dome dissolves into the stars. The band
 * edges follow the real atmosphere — most scattering is gone by ~15 km.
 */
function Atmosphere({ simRef, baseColor, visM }) {
  const { scene } = useThree()
  const base = useMemo(() => new THREE.Color(baseColor), [baseColor])
  const space = useMemo(() => new THREE.Color('#03050c'), [])   // high-altitude sky
  const horizon = useMemo(() => new THREE.Color('#16294c'), []) // thin bright band
  const tmp = useMemo(() => new THREE.Color(), [])
  const fog = useMemo(() => new THREE.Fog(baseColor, visM * 0.12, visM), [baseColor, visM])

  useEffect(() => {
    scene.fog = fog
    if (!scene.background) scene.background = base.clone()
    return () => { scene.fog = null }
  }, [scene, fog, base])

  useFrame(() => {
    const h = simRef.current?.state?.h || 0
    // 0 at sea level, 1 by ~13 km. The sky noticeably deepens from ~2 km up
    // (cruise for a regional leg) so climbing reads as leaving the surface.
    const f = Math.min(1, h / 13000)
    const darken = Math.pow(f, 0.7)   // meaningful shift even at a few km
    // surface sky → deep space, warm horizon band blended through the middle
    tmp.copy(base).lerp(horizon, Math.min(1, darken * 1.2)).lerp(space, Math.pow(f, 1.3))
    if (scene.background?.isColor) scene.background.copy(tmp)
    else scene.background = tmp.clone()
    // A ground-haze layer that thickens with altitude: as you climb, the fog
    // near-plane closes in on the FAR ground so the surface washes out into the
    // sky, instead of a crisp lawn clinging under the aircraft.
    fog.color.copy(tmp)
    // near stays close so distant terrain fogs; far shrinks with altitude so the
    // 64 km ground sheet is swallowed by haze the higher you get
    fog.near = 200 + h * 1.5
    fog.far = Math.max(4000, visM * 1.1 - h * 3.2)
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

// Cinematic rain: a box of streak particles that follows the camera and falls,
// wrapping around so a few thousand points give the impression of heavy rain.
function Rain({ count = 2500 }) {
  const ref = useRef()
  const { camera } = useThree()
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 120
      a[i * 3 + 1] = Math.random() * 120
      a[i * 3 + 2] = (Math.random() - 0.5) * 120
    }
    return a
  }, [count])
  const vel = useMemo(() => new Float32Array(count).map(() => 60 + Math.random() * 40), [count])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const p = g.geometry.attributes.position
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < count; i++) {
      let y = p.array[i * 3 + 1] - vel[i] * d
      if (y < 0) { y += 120; p.array[i * 3] = (Math.random() - 0.5) * 120; p.array[i * 3 + 2] = (Math.random() - 0.5) * 120 }
      p.array[i * 3 + 1] = y
    }
    p.needsUpdate = true
    // keep the rain box centred on the camera
    g.position.set(camera.position.x, camera.position.y - 60, camera.position.z)
  })
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color="#9fb4c4" size={0.5} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
    </points>
  )
}

/**
 * Wingtip contrails. Real contrails form when the air is cold and moist enough
 * (roughly above ~8 km / below ~−40 °C). We emit a fading line of points from
 * each wingtip in WORLD space: each frame the newest point is placed at the
 * current wingtip and the buffer scrolls, so the trail hangs in the sky behind
 * the jet and slowly fades + widens. Purely cosmetic; costs one points draw.
 */
const CONTRAIL_LEN = 220 // points per wingtip

function Contrails({ simRef, dims }) {
  const ref = useRef()
  const geom = useRef()
  const positions = useMemo(() => new Float32Array(CONTRAIL_LEN * 2 * 3), [])
  const alphas = useMemo(() => new Float32Array(CONTRAIL_LEN * 2), [])
  const head = useRef(0)
  const tmpL = useMemo(() => new THREE.Vector3(), [])
  const tmpR = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    const s = simRef.current?.state
    if (!s || !geom.current) return
    const altFt = s.h / 0.3048
    // Contrails form in cold, moist air aloft. The real threshold is ~FL260, but
    // this sim's short hops rarely get that high, so trigger from ~15,000 ft so
    // you actually see them on a normal climb — a reasonable dramatic licence.
    const forming = altFt > 15000 && s.v > 80 && !s.onGround
    // half-span offset, in world space, perpendicular to heading
    const halfSpan = (dims?.wingspanM || 34) / 2
    const cosP = Math.cos(s.psi), sinP = Math.sin(s.psi)
    // right vector (perpendicular to the −z heading) = (cosψ, 0, sinψ)
    const wx = cosP * halfSpan, wz = sinP * halfSpan
    const yWing = s.h + (simRef.current?.groundClear || 2) * 0.4

    if (forming) {
      const i = head.current
      tmpL.set(s.x - wx, yWing, s.z - wz)
      tmpR.set(s.x + wx, yWing, s.z + wz)
      positions[i * 6 + 0] = tmpL.x; positions[i * 6 + 1] = tmpL.y; positions[i * 6 + 2] = tmpL.z
      positions[i * 6 + 3] = tmpR.x; positions[i * 6 + 4] = tmpR.y; positions[i * 6 + 5] = tmpR.z
      alphas[i * 2] = 1; alphas[i * 2 + 1] = 1
      head.current = (i + 1) % CONTRAIL_LEN
    }
    // fade every point a little each frame (older = fainter), scaled by dt
    const fade = Math.pow(0.5, dt / 6) // ~6 s half-life
    for (let k = 0; k < alphas.length; k++) alphas[k] *= fade
    geom.current.attributes.position.needsUpdate = true
    geom.current.attributes.alpha.needsUpdate = true
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry ref={geom}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-alpha" args={[alphas, 1]} />
      </bufferGeometry>
      {/* size-attenuated soft white points; the custom alpha attribute fades the
          tail. onBeforeCompile injects the per-point alpha into the fragment. */}
      <pointsMaterial
        color="#eef4ff" size={7} sizeAttenuation transparent depthWrite={false}
        opacity={0.5} blending={THREE.AdditiveBlending}
        onBeforeCompile={(sh) => {
          sh.vertexShader = 'attribute float alpha;\nvarying float vA;\n' +
            sh.vertexShader.replace('void main() {', 'void main() {\n  vA = alpha;')
          sh.fragmentShader = 'varying float vA;\n' +
            sh.fragmentShader.replace('vec4( diffuse, opacity )', 'vec4( diffuse, opacity * vA )')
        }}
      />
    </points>
  )
}

/**
 * Touchdown puffs: a short burst of grey smoke from the main gear the instant
 * the wheels kiss the runway (and a lighter puff on a hard landing). Watches the
 * sim for the ground-contact transition and spawns an expanding, fading sprite.
 */
function TouchdownSmoke({ simRef }) {
  const ref = useRef()
  const wasAir = useRef(false)
  const puff = useRef({ t: 999, x: 0, z: 0, hard: false })
  const mat = useMemo(() => new THREE.SpriteMaterial({
    map: softSprite(), color: '#c9cdd3', transparent: true, opacity: 0, depthWrite: false,
  }), [])

  useFrame((_, dt) => {
    const s = simRef.current?.state
    if (!s || !ref.current) return
    // detect the airborne→ground transition
    if (wasAir.current && s.onGround) {
      puff.current = { t: 0, x: s.x, z: s.z, hard: !!s.landedHard || Math.abs(s.touchdownVs || 0) > 400 }
    }
    wasAir.current = !s.onGround
    const p = puff.current
    p.t += dt
    const life = 1.4
    if (p.t < life) {
      const k = p.t / life
      ref.current.visible = true
      ref.current.position.set(p.x, 0.5 + k * 6, p.z)
      const grow = (p.hard ? 10 : 6) * (0.4 + k)
      ref.current.scale.setScalar(grow)
      mat.opacity = (p.hard ? 0.6 : 0.4) * (1 - k)
    } else {
      ref.current.visible = false
    }
  })
  return <sprite ref={ref} material={mat} visible={false} />
}

const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const EARTH_DAY_URL = `${base}/textures/earth/day.ktx2`
const EARTH_BASIS = `${base}/basis/`
// metres per degree of latitude (mean); longitude scaled by cos(lat) per airport
const M_PER_DEG_LAT = 111320

/**
 * Real-Earth ground: the NASA Blue Marble day map (the same texture the /live
 * globe uses) sampled at the DEPARTURE airport's lat/lon and laid on the ground
 * plane, so you take off and fly over real coastlines and land instead of a
 * procedural lawn. The equirectangular map is lon→U (0..1 over 360°), lat→V
 * (0..1 over 180°, north at the top); we set the texture's repeat to the plane's
 * geographic span and its offset to the airport, then slide the offset with the
 * aircraft so flying moves you across the real map. A soft green ground tint fills
 * beyond the map so the horizon still reads as land, not a hard texture edge.
 */
function RealGround({ simRef, detailTex, lat = 51.47, lon = -0.45, sizeM = 1500000 }) {
  const { gl } = useThree()
  const matRef = useRef()
  const detailMatRef = useRef()
  // Load the NASA KTX2 IMPERATIVELY (non-suspending): the scene must never block
  // on it — a slow or failed transcode (e.g. software WebGL) would otherwise
  // freeze the whole world on "Loading…". We render the procedural detail ground
  // immediately and swap the real Earth in when/if the texture arrives.
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let alive = true
    let loader
    try {
      loader = new KTX2Loader().setTranscoderPath(EARTH_BASIS).detectSupport(gl)
    } catch {
      return undefined
    }
    loader.load(EARTH_DAY_URL, (t) => {
      if (!alive) { t.dispose?.(); return }
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      t.needsUpdate = true
      setTex(t)
    }, undefined, () => { /* transcode failed — stay on the procedural ground */ })
    return () => { alive = false; loader.dispose?.() }
  }, [gl])

  // The NASA map is low-res at runway scale, so multiply in the high-frequency
  // procedural field texture (fields/soil/speckle) tiled tightly — real land
  // colour + coastlines from NASA, crisp surface detail underfoot from the field.
  const DETAIL_SIZE = 80000 // matches the detail plane below
  const detail = useMemo(() => {
    if (!detailTex) return null
    const d = detailTex.clone()
    d.wrapS = d.wrapT = THREE.RepeatWrapping
    d.repeat.set(DETAIL_SIZE / 1400, DETAIL_SIZE / 1400) // ~1.4 km detail tile
    d.needsUpdate = true
    return d
  }, [detailTex])

  // base ground texture: the procedural land tiled a handful of times across the
  // 64 km sheet (varied land, not a stamped tile) — the instant, always-there
  // surface under everything.
  const groundBase = useMemo(() => {
    if (!detailTex) return null
    const d = detailTex.clone()
    d.wrapS = d.wrapT = THREE.RepeatWrapping
    d.repeat.set(12, 12)
    d.needsUpdate = true
    return d
  }, [detailTex])

  // geographic span the plane covers, as a fraction of the full map (deg → UV)
  const spanU = (sizeM / (M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180))) / 360
  const spanV = (sizeM / M_PER_DEG_LAT) / 180
  // UV of the airport (map origin at lon −180 / lat +90)
  const u0 = (lon + 180) / 360
  const v0 = (90 - lat) / 180

  useEffect(() => {
    if (!tex) return
    tex.repeat.set(spanU, spanV)
    tex.offset.set(u0 - spanU / 2, 1 - (v0 + spanV / 2))
  }, [tex, spanU, spanV, u0, v0])

  // slide the map under the aircraft: world +x is east (+U), world −z is north
  // (+V, since north is up in the map). Convert metres → UV and offset from the
  // airport centre so the real terrain scrolls past as you fly. Also fade the
  // near-ground detail overlay out with altitude — it only matters low down; at
  // cruise the clean NASA land should show through.
  useFrame(() => {
    if (!tex) return
    const s = simRef.current?.state
    if (!s) return
    const du = (s.x / (M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180)) / 360)
    const dv = (-s.z / M_PER_DEG_LAT / 180)
    tex.offset.set(u0 - spanU / 2 + du, 1 - (v0 + spanV / 2) - dv)
    if (detailMatRef.current) {
      // full detail on the deck, gone by ~3 km
      detailMatRef.current.opacity = 0.5 * Math.max(0, 1 - s.h / 3000)
    }
  })

  return (
    <group>
      {/* ALWAYS-present base ground: the procedural land texture as a lit, opaque
          surface. This renders instantly (no async), so there's a proper lit
          ground from frame one whether or not the NASA texture ever loads. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[64000, 64000]} />
        <meshStandardMaterial map={groundBase} roughness={1} />
      </mesh>
      {/* real NASA land colour + coastlines, laid over the base once loaded */}
      {tex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[sizeM, sizeM]} />
          <meshStandardMaterial ref={matRef} map={tex} roughness={1} />
        </mesh>
      )}
      {/* high-frequency detail multiplied over the top so the surface has crisp
          texture underfoot (the NASA map alone is soft at runway scale). Only
          when the NASA layer is present — otherwise the base already IS detail. */}
      {tex && detail && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
          <planeGeometry args={[80000, 80000]} />
          <meshBasicMaterial ref={detailMatRef} map={detail} transparent opacity={0.5} blending={THREE.MultiplyBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Sun disc + glare. A soft additive billboard placed far along the sun direction
 * so it sits in the sky where the physical <Sky> puts its sun, blooming when you
 * look toward it — the airline-window "sun in your eyes" cue. Two stacked halos
 * (tight core + wide bloom) fake the flare; a subtle screen-wide wash brightens
 * as the camera aims at the sun. Cosmetic only; fixed sprites, no per-pixel cost.
 */
function SunGlare({ sunDir, tint, strength = 1 }) {
  const grpRef = useRef()
  const coreRef = useRef()
  const bloomRef = useRef()
  const { camera } = useThree()
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => sunDir.clone().multiplyScalar(70000), [sunDir])
  useFrame(() => {
    // keep the sun locked in the sky relative to the camera (it's effectively at
    // infinity), so it stays put as you fly and only leaves frame as you turn
    if (grpRef.current) grpRef.current.position.set(
      camera.position.x + pos.x, camera.position.y + pos.y, camera.position.z + pos.z,
    )
    // bloom harder the more directly the camera faces the sun
    camera.getWorldDirection(fwd)
    const facing = Math.max(0, fwd.dot(sunDir))
    const glow = Math.pow(facing, 3)
    if (coreRef.current) coreRef.current.material.opacity = (0.6 + 0.4 * glow) * strength
    if (bloomRef.current) {
      bloomRef.current.material.opacity = (0.15 + 0.45 * glow) * strength
      const s = 22000 * (1 + glow * 0.8)
      bloomRef.current.scale.set(s, s, 1)
    }
  })
  return (
    <group ref={grpRef}>
      <sprite ref={coreRef} scale={[8000, 8000, 1]}>
        <spriteMaterial map={softSprite()} color={tint} transparent opacity={0.9 * strength} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={bloomRef} scale={[22000, 22000, 1]}>
        <spriteMaterial map={softSprite()} color={tint} transparent opacity={0.35 * strength} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

export default function FlightScene({ simRef, modelUrl, dims, weather, view, runwayHalfLen = 1600, airport }) {
  const sky = SKIES[weather.sky] || SKIES.day
  const groundTex = useGroundTexture(weather.sky)
  const groupRef = useRef()
  const visM = weather.visKm * 1000

  // The sun's world position/direction, shared by the key light, the sky dome and
  // the reflection environment so every highlight, shadow and specular agrees.
  const sunDir = useMemo(() => sunVector(sky.elev, sky.azim), [sky])
  const envSunPos = useMemo(() => sunDir.clone().multiplyScalar(12), [sunDir])

  const night = weather.sky === 'storm'
  return (
    <CanvasFallback label="3D flight view unavailable on this device">
      <Canvas
        // NB: no `shadows`. Enabling the shadow-map pass rendered the ENTIRE /fly
        // scene pure black (verified by headless render: /simulate + /live render
        // fine, /fly went black, and removing `shadows` restored it) — the
        // aircraft-following shadow frustum over the huge receiveShadow ground was
        // producing a broken/black shadow map. The scene is fully lit by the
        // directional + hemisphere + environment lights without it. Do not
        // re-enable shadows without a small dedicated shadow-catcher + testing.
        dpr={[1, 1.75]}
        gl={{ powerPreference: 'high-performance', antialias: true }}
        camera={{ position: [150, 40, 1700], fov: 45, near: 0.5, far: 90000 }}
      >
        {/* One Suspense INSIDE the Canvas: several drei helpers here (Sky, Clouds,
            Cloud, Environment) suspend while they lazy-load. Without a boundary in
            the Canvas, that suspension bubbles to FlyPage's outer fallback and the
            whole world hangs on "Loading world…". Catch it here so the scene keeps
            rendering as pieces resolve. */}
        <Suspense fallback={null}>
        <FlightSky sky={sky} simRef={simRef} />
        {!night && <SunGlare sunDir={sunDir} tint={sky.sunTint} strength={sky.sun / 1.5} />}
        <CloudDeck skyId={weather.sky} simRef={simRef} />
        <Atmosphere simRef={simRef} baseColor={sky.bg} visM={visM} />
        <hemisphereLight intensity={sky.hemi} color="#dfe9f2" groundColor="#3a4450" />
        {/* sun key light, aimed from the real sky-sun direction so the lit side of
            the jet matches the bright side of the dome and the sun disc. The
            SunLight rig slides the shadow frustum along with the aircraft so its
            shadow stays crisp anywhere down the runway (see SunLight). */}
        <SunLight simRef={simRef} sunDir={sunDir} intensity={sky.sun} color={sky.sunTint} shadows={!night} />
        {/* Procedural reflection environment — the metallic fuselage/nacelles
            need something to reflect or they read as flat chalk. Built from
            Lightformers (no CDN HDRI fetch, so it works offline / on the
            projector) tinted to the current sky: bright sun panel placed at the
            real sun direction, warm-to-cool sky gradient overhead, dark ground
            below. This is what gives the jet its painted-aluminium sheen. */}
        <Environment resolution={128} frames={1}>
          <color attach="background" args={['#000000']} />
          {/* overhead sky dome */}
          <Lightformer intensity={sky.hemi * 1.6} color={sky.bg} form="ring" scale={[20, 20, 1]} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} />
          {/* bright sun disc for a strong specular highlight, at the sun's bearing */}
          <Lightformer intensity={sky.sun * 3.2} color={sky.sunTint} form="circle" scale={4} position={[envSunPos.x, envSunPos.y, envSunPos.z]} target={[0, 0, 0]} />
          {/* soft fill from the opposite side */}
          <Lightformer intensity={sky.hemi} color="#9fb8d8" form="rect" scale={[16, 8, 1]} position={[-14, 4, -8]} target={[0, 0, 0]} />
          {/* dark ground so the belly picks up a grounded reflection, not glare */}
          <Lightformer intensity={0.3} color={sky.ground} form="rect" scale={[24, 24, 1]} position={[0, -10, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        </Environment>

        {/* real NASA Blue Marble terrain around the departure field. RealGround is
            now synchronous — it renders the procedural base instantly and swaps in
            the NASA map imperatively when it loads, so the world never blocks. */}
        <RealGround simRef={simRef} detailTex={groundTex} lat={airport?.lat ?? 51.47} lon={airport?.lon ?? -0.45} />
        <Runway night={night} halfLen={runwayHalfLen} airport={airport} />
        <Buildings />

        <Suspense fallback={<Loader />}>
          <AircraftModel url={modelUrl} simRef={simRef} groupRef={groupRef} />
        </Suspense>
        {weather.sky === 'storm' && <Rain />}
        <Contrails simRef={simRef} dims={dims} />
        <TouchdownSmoke simRef={simRef} />
        <Runner simRef={simRef} />
        <CameraRig simRef={simRef} groupRef={groupRef} view={view} dims={dims} />
        </Suspense>
      </Canvas>
    </CanvasFallback>
  )
}
