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

function Runway({ night, halfLen = 1600 }) {
  const HL = halfLen
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
  const cloned = useMemo(() => scene.clone(true), [scene])

  // The GLB already carries landing gear (built by generate_airframe_hd.py).
  // The bounding-box minimum, though, is the wingtip/nacelle — lower than the
  // wheels in the upright frame — so seating on it makes the jet rest on a
  // wingtip with the wheels hovering. Instead we find the lowest geometry near
  // the centreline (|x| within a fraction of span): that's the gear/wheels, the
  // true contact point. We measure it in the same upright wrapper the scene uses.
  const H0 = useMemo(() => {
    const probe = new THREE.Group()
    const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2
    const inner2 = new THREE.Group(); inner2.rotation.x = Math.PI / 2
    inner2.add(cloned.clone(true)); inner.add(inner2); probe.add(inner)
    probe.updateWorldMatrix(true, true)
    const full = new THREE.Box3().setFromObject(probe)
    const span = full.max.x - full.min.x
    const bandX = span * 0.14 // centreline band that captures nose+main gear
    let wheelMinY = Infinity
    const v = new THREE.Vector3()
    probe.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return
      const pos = o.geometry.attributes.position
      o.updateWorldMatrix(true, false)
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld)
        if (Math.abs(v.x) <= bandX && v.y < wheelMinY) wheelMinY = v.y
      }
    })
    // fall back to the full box if we found nothing near the centreline
    const contact = isFinite(wheelMinY) ? wheelMinY : full.min.y
    return -contact
  }, [cloned])

  useEffect(() => { if (simRef.current) simRef.current.groundClear = H0 }, [H0, simRef])

  // Collect the animatable sub-nodes once: fan blades (spin with N1) and the
  // landing gear (retract up into the belly when gear is up). The GLB is in the
  // raw frame here (nose −X, up −Z), so the fan axis is local X and "up into the
  // belly" is local +Z. Gear meshes are the unnamed cylinders/wheels sitting
  // below the fuselage centreline.
  const anim = useMemo(() => {
    const fans = []
    const gear = []
    const flaps = []      // hinged Flap_* surfaces (deflect down with flap setting)
    const ailerons = []   // hinged Aileron_* surfaces (antisymmetric with roll)
    const box = new THREE.Box3().setFromObject(cloned)
    const height = box.max.z - box.min.z   // vertical extent (raw up = ±z)
    const c = new THREE.Vector3()
    cloned.traverse((o) => {
      if (!o.isMesh) return
      if (/FanBlades|Spinner/i.test(o.name)) { fans.push(o); return }
      if (/^Flap_/i.test(o.name)) { flaps.push({ o, side: /R$/i.test(o.name) ? 1 : -1, y0: o.rotation.y }); return }
      if (/^Aileron_/i.test(o.name)) { ailerons.push({ o, side: /R$/i.test(o.name) ? 1 : -1, y0: o.rotation.y }); return }
      // gear struts/wheels/hubs are the generic Cylinder*/Torus* nodes that sit
      // below the belly (raw down = +z), away from the engine cylinders up top
      if (/Cylinder|Torus/i.test(o.name)) {
        new THREE.Box3().setFromObject(o).getCenter(c)
        if (c.z > box.max.z - height * 0.5) gear.push({ o, z0: o.position.z })
      }
    })
    return { fans, gear, flaps, ailerons, retractDist: height * 0.42 }
  }, [cloned])

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
    // spin the fans: N1 fraction → rev speed (raw fan axis is local X)
    const n1 = out ? Math.max(0.04, out.n1 / 100) : 0.04
    for (const f of anim.fans) f.rotation.x += n1 * 42 * dt
    // gear retract/extend: lerp gear meshes up into the belly (local +z is down,
    // so retracting means moving toward −z / into the hull)
    if (anim.gear.length) {
      const target = s.gear ? 0 : -anim.retractDist
      for (const gm of anim.gear) {
        gm.o.position.z += ((gm.z0 + target) - gm.o.position.z) * Math.min(1, dt * 2.5)
      }
    }
    // flaps deflect DOWN with the flap setting. The hinge runs SPANWISE (raw
    // local Y), and the flap chord extends aft in +x, so trailing-edge-down is a
    // rotation about Y. The per-side sign drops both trailing edges together.
    if (anim.flaps.length) {
      const flapDefl = (s.flap / 3) * 0.7 // rad, ~40° at FULL
      for (const fp of anim.flaps) {
        const target = fp.y0 + flapDefl * fp.side
        fp.o.rotation.y += (target - fp.o.rotation.y) * Math.min(1, dt * 2)
      }
    }
    // ailerons deflect antisymmetrically with roll command (right roll → right
    // aileron up, left down) — also a hinge about the spanwise Y axis.
    if (anim.ailerons.length) {
      const roll = simRef.current?.controls?.roll || 0
      for (const al of anim.ailerons) {
        const target = al.y0 + roll * 0.4 * al.side
        al.o.rotation.y += (target - al.o.rotation.y) * Math.min(1, dt * 6)
      }
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

/**
 * Altitude atmosphere: drives the scene background + fog by height so climbing
 * actually leaves the surface. Low down you get the weather sky and thick haze;
 * as you climb the sky darkens through deep blue to near-black space and the fog
 * pushes far out, so the ground recedes instead of clinging to the aircraft.
 * The band edges follow the real atmosphere — most scattering is gone by ~15 km.
 */
function Atmosphere({ simRef, baseColor, visM }) {
  const { scene } = useThree()
  const base = useMemo(() => new THREE.Color(baseColor), [baseColor])
  const space = useMemo(() => new THREE.Color('#05070f'), [])   // high-altitude sky
  const horizon = useMemo(() => new THREE.Color('#1a2c50'), []) // thin bright band
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

export default function FlightScene({ simRef, modelUrl, dims, weather, view, runwayHalfLen = 1600 }) {
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
        <Atmosphere simRef={simRef} baseColor={sky.bg} visM={visM} />
        <hemisphereLight intensity={sky.hemi} color="#dfe9f2" groundColor="#3a4450" />
        <directionalLight position={[2500, 3800, 1200]} intensity={sky.sun} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[64000, 64000]} />
          <meshStandardMaterial map={groundTex} roughness={1} />
        </mesh>
        <Runway night={night} halfLen={runwayHalfLen} />
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
