import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKTX2 } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Shared textured Earth for the globes (RouteGlobe live-preview + FlightGlobe
 * live traffic). Real NASA Blue Marble day map + city-lights night map
 * (KTX2/ETC1S, GPU-native, ~430 KB total), lit by the ACTUAL sun position for
 * the current time — so the day/night terminator sits where it really is and
 * sweeps across every hemisphere through the day, not a fixed painted band.
 *
 * The transcoder is vendored in public/basis/ (self-hosted, offline-safe on the
 * projector) — same policy as the Draco decoder in public/draco/.
 */

const DEG = Math.PI / 180

// Self-hosted KTX2 transcoder + textures, base-aware for GitHub Pages.
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const BASIS_PATH = `${base}/basis/`
const DAY_URL = `${base}/textures/earth/day.ktx2`
const NIGHT_URL = `${base}/textures/earth/night.ktx2`

export function preloadEarth() {
  useKTX2.preload(DAY_URL, BASIS_PATH)
  useKTX2.preload(NIGHT_URL, BASIS_PATH)
}

/**
 * Direction (unit vector, in our globe's frame) from Earth centre to the sun for
 * a given Date. Uses the standard low-precision solar position: declination from
 * day-of-year, hour-angle from UTC. Our toVec3 maps lon→theta as (lon+180); this
 * matches that so the subsolar point lands at the right lat/lon on the texture.
 */
function sunDirection(date, out = new THREE.Vector3()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = (date - start) / 86400000
  // solar declination (deg) — tilt of the sub-solar latitude through the year
  const decl = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * DEG)
  // sub-solar longitude: sun is overhead at local solar noon; at UTC hour h the
  // subsolar meridian is 180° − 15°·h (0 UTC → 180°E i.e. dateline is noon)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const subLon = 180 - 15 * utcHours
  // same lat/lon → xyz mapping as toVec3 (phi from colatitude, theta = lon+180)
  const phi = (90 - decl) * DEG
  const theta = (subLon + 180) * DEG
  out.set(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  )
  return out.normalize()
}

const earthVert = `
  varying vec2 vUv; varying vec3 vP; varying vec3 vWorld;
  void main(){ vUv = uv; vP = normalize(position);
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const earthFrag = `
  uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; uniform vec3 uCam;
  varying vec2 vUv; varying vec3 vP; varying vec3 vWorld;
  void main(){
    vec3 N = normalize(vP);
    vec3 S = normalize(uSun);
    float d = dot(N, S);                              // -1 night .. 1 subsolar
    float day = smoothstep(-0.12, 0.25, d);           // soft terminator
    vec3 dayTex = texture2D(uDay, vUv).rgb;
    vec3 nightCol = texture2D(uNight, vUv).rgb * 1.6;  // boost the city lights

    // Ocean is dark blue and fairly uniform in the Blue Marble map; detect it as
    // "dark + bluish" so we can give water a subtle sun glint (specular) and land
    // stays matte — the single biggest cue that reads as a real planet.
    float lum = dot(dayTex, vec3(0.299, 0.587, 0.114));
    float isWater = smoothstep(0.28, 0.10, lum) * step(dayTex.r, dayTex.b + 0.02);

    // day-side diffuse shading so the subsolar point is brighter than the limb
    vec3 dayCol = dayTex * (0.55 + 0.75 * max(d, 0.0));

    // specular sun-glint off water (Blinn-ish), only on the lit hemisphere
    vec3 V = normalize(uCam - vWorld);
    vec3 H = normalize(S + V);
    float spec = pow(max(dot(N, H), 0.0), 60.0) * isWater * smoothstep(0.0, 0.2, d);
    dayCol += vec3(1.0, 0.92, 0.72) * spec * 0.9;

    vec3 col = mix(nightCol, dayCol, day);
    // warm gold band riding the terminator
    float term = smoothstep(0.9, 1.0, 1.0 - abs(d));
    col += vec3(0.40, 0.20, 0.06) * term;
    gl_FragColor = vec4(col, 1.0);
  }
`

export default function Earth({ radius = 2, showGraticule = true, coastlines }) {
  const { day, night } = useKTX2({ day: DAY_URL, night: NIGHT_URL }, BASIS_PATH)

  const mat = useMemo(() => {
    // equirectangular maps: clamp vertical, wrap horizontal, correct color space
    for (const t of [day, night]) {
      if (!t) continue
      t.wrapS = THREE.RepeatWrapping
      t.wrapT = THREE.ClampToEdgeWrapping
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      t.needsUpdate = true
    }
    return new THREE.ShaderMaterial({
      uniforms: {
        uDay: { value: day },
        uNight: { value: night },
        uSun: { value: sunDirection(new Date()) },
        uCam: { value: new THREE.Vector3() },
      },
      vertexShader: earthVert,
      fragmentShader: earthFrag,
    })
  }, [day, night])

  // Shared uniforms for the two atmosphere shells: the live sun direction and the
  // live camera world-position (so the fresnel rim tracks the true limb as the
  // globe spins). Both surface materials reference these same objects.
  const rimUniforms = useMemo(() => ({
    uSun: mat.uniforms.uSun,
    uCam: { value: new THREE.Vector3() },
  }), [mat])

  // update the sun once a minute of wall-clock is plenty; recompute each frame is
  // cheap enough and keeps a long-open globe correct as real time passes
  const sunTmp = useRef(new THREE.Vector3())
  useFrame((state) => {
    mat.uniforms.uSun.value.copy(sunDirection(new Date(), sunTmp.current))
    mat.uniforms.uCam.value.copy(state.camera.position)
    rimUniforms.uCam.value.copy(state.camera.position)
  })

  const surface = (lat, lon, out) => {
    const phi = (90 - lat) * DEG
    const theta = (lon + 180) * DEG
    const r = radius * 1.002
    return out.set(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    )
  }

  const graticule = useMemo(() => {
    if (!showGraticule) return null
    const g = new THREE.BufferGeometry(); const pts = []; const v = new THREE.Vector3()
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = -180; lon < 180; lon += 4) { surface(lat, lon, v); pts.push(v.x, v.y, v.z); surface(lat, lon + 4, v); pts.push(v.x, v.y, v.z) }
    for (let lon = -180; lon < 180; lon += 30)
      for (let lat = -84; lat < 84; lat += 4) { surface(lat, lon, v); pts.push(v.x, v.y, v.z); surface(lat + 4, lon, v); pts.push(v.x, v.y, v.z) }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [showGraticule, radius])

  const coasts = useMemo(() => {
    if (!coastlines) return null
    const g = new THREE.BufferGeometry(); const pts = []; const a = new THREE.Vector3(); const b = new THREE.Vector3()
    for (const line of coastlines) {
      for (let i = 0; i < line.length - 1; i++) {
        surface(line[i][1], line[i][0], a); surface(line[i + 1][1], line[i + 1][0], b)
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [coastlines, radius])

  return (
    <group>
      <mesh material={mat}><sphereGeometry args={[radius, 96, 96]} /></mesh>
      {/* inner fresnel atmosphere rim — tight, bright, sun-lit, tracks the limb */}
      <mesh scale={1.045}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          uniforms={rimUniforms}
          vertexShader={rimVert}
          fragmentShader={rimFrag(3.0, 'vec3(0.45,0.72,1.0)', 'vec3(0.10,0.28,0.55)', 1.0)}
        />
      </mesh>
      {/* outer haze shell — soft wide glow that fakes atmospheric bloom */}
      <mesh scale={1.16}>
        <sphereGeometry args={[radius, 48, 48]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          uniforms={rimUniforms}
          vertexShader={rimVert}
          fragmentShader={rimFrag(4.5, 'vec3(0.30,0.55,1.0)', 'vec3(0.08,0.16,0.38)', 0.45)}
        />
      </mesh>
      {coasts && <lineSegments geometry={coasts}><lineBasicMaterial color="#9fd0ec" transparent opacity={0.4} /></lineSegments>}
      {graticule && <lineSegments geometry={graticule}><lineBasicMaterial color="#2b485c" transparent opacity={0.22} /></lineSegments>}
    </group>
  )
}

/**
 * Fresnel atmosphere shells for the globe. Two additive back-side shells give a
 * tight bright inner rim and a soft wide haze. The fresnel is computed against
 * the REAL view direction (camera → fragment), so the glow rides the true limb
 * of the globe as it spins — the earlier version used a fixed screen-space axis
 * and the halo stuck to one edge instead of tracking the horizon. The lit side
 * is brighter (day-side scattering) via the shared sun uniform.
 */
const rimVert = `
  varying vec3 vWorld; varying vec3 vNormalW; varying vec3 vP;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vP = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
function rimFrag(power, tintDay, tintNight, alpha) {
  return `
    uniform vec3 uSun; uniform vec3 uCam;
    varying vec3 vWorld; varying vec3 vNormalW; varying vec3 vP;
    void main(){
      vec3 view = normalize(uCam - vWorld);
      float rim = pow(1.0 - abs(dot(normalize(vNormalW), view)), ${power.toFixed(1)});
      float lit = smoothstep(-0.3, 0.75, dot(normalize(vP), normalize(uSun)));
      vec3 c = mix(${tintNight}, ${tintDay}, lit);
      gl_FragColor = vec4(c, rim * ${alpha} * (0.35 + lit * 0.65));
    }
  `
}

/**
 * A sun disc + soft glow far behind the Earth, placed along the live sun
 * direction — the cinematic light source that makes the terminator read and
 * gives the scene depth. Export so the globes can drop it in.
 */
export function Sun({ distance = 60 }) {
  const ref = useRef()
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!ref.current) return
    sunDirection(new Date(), tmp)
    ref.current.position.copy(tmp).multiplyScalar(distance)
  })
  return (
    <group ref={ref}>
      <mesh><sphereGeometry args={[2.4, 24, 24]} /><meshBasicMaterial color="#fff6e0" toneMapped={false} /></mesh>
      {/* layered additive halos for a soft bloom */}
      <mesh><sphereGeometry args={[5, 24, 24]} /><meshBasicMaterial color="#ffe9b0" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      <mesh><sphereGeometry args={[10, 24, 24]} /><meshBasicMaterial color="#ffdca0" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  )
}

const WX_API = import.meta.env.VITE_FLIGHT_API || ''

/**
 * Live cloud layer — the "weather engine". Fetches a coarse global cloud-cover
 * grid from the worker's /weather route (Open-Meteo, cached 10 min) and paints
 * it into a texture: cloud % → white alpha, bilinearly upscaled so the 10° grid
 * reads as soft cloud masses. Mapped onto a slightly larger transparent sphere
 * that drifts a touch faster than the globe, so weather visibly moves. Silently
 * renders nothing if the weather endpoint is unavailable.
 */
export function Clouds({ radius = 2, refreshMs = 600000 }) {
  const ref = useRef()
  const [grid, setGrid] = useState(null)

  useEffect(() => {
    if (!WX_API) return
    let alive = true
    const load = () => fetch(`${WX_API}/weather`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (alive && d && d.cloud) setGrid(d) })
      .catch(() => {})
    load()
    const iv = setInterval(load, refreshMs)
    return () => { alive = false; clearInterval(iv) }
  }, [refreshMs])

  const texture = useMemo(() => {
    if (!grid) return null
    const { rows, cols, cloud } = grid
    // upscale the coarse grid with bilinear sampling into a smooth alpha map
    const SX = cols * 12, SY = rows * 12
    const c = document.createElement('canvas'); c.width = SX; c.height = SY
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(SX, SY)
    const at = (r, cc) => cloud[Math.min(rows - 1, Math.max(0, r)) * cols + ((cc % cols) + cols) % cols]
    for (let y = 0; y < SY; y++) {
      // grid row 0 is lat -80 (south); texture v=0 is the top (north), so flip
      const gy = (1 - y / (SY - 1)) * (rows - 1)
      const r0 = Math.floor(gy), fy = gy - r0
      for (let x = 0; x < SX; x++) {
        const gx = (x / SX) * cols
        const c0 = Math.floor(gx), fx = gx - c0
        const v = at(r0, c0) * (1 - fx) * (1 - fy) + at(r0, c0 + 1) * fx * (1 - fy) +
                  at(r0 + 1, c0) * (1 - fx) * fy + at(r0 + 1, c0 + 1) * fx * fy
        const i = (y * SX + x) * 4
        // only show meaningful cloud; fade in from ~25% cover
        const a = Math.max(0, (v - 25) / 75)
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
        img.data[i + 3] = Math.round(a * 210)
      }
    }
    ctx.putImageData(img, 0, 0)
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [grid])

  // slow independent drift so the weather reads as alive
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.006 })

  if (!texture) return null
  return (
    <mesh ref={ref} scale={1.012}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={0.9} />
    </mesh>
  )
}
