import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import CanvasFallback from './CanvasFallback.jsx'

/**
 * Explore mode: the aircraft at true scale (1 unit = 1 m), inside and out.
 *
 * Outside: the airframe sits on its gear on an apron with a 10 m grid, a human
 * figure and a car for size, orbit or eye-level (1.7 m) cameras.
 * Inside: a longitudinal section-cut slider slices the hull open (world-space
 * clipping plane) and an X-ray toggle makes the skin translucent; a procedural
 * interior — cabin, cockpit, cargo holds, fuel tanks, gear bays, avionics bay,
 * APU — is generated from the variant's real dimensions and stays unclipped so
 * the cutaway reads like an engineering cutaway drawing.
 *
 * GLB axis gotcha: the authored models are NOT Y-up (nose −X, span ±Y, up −Z);
 * a rotation.x = +PI/2 wrapper stands them upright (see three/AircraftViewer
 * for the shared loader conventions).
 */

function withBase(path) {
  if (!path) return path
  if (/^https?:\/\//.test(path)) return path
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

/** Seat layout per fuselage diameter: seats per row-group, aisles between. */
function abreastFor(diaM) {
  if (diaM <= 3.2) return [2, 2]
  if (diaM <= 4.3) return [3, 3]
  if (diaM <= 5.8) return [2, 4, 2]
  return [3, 4, 3]
}

const LABEL_LINKS = {
  cockpit: 'cockpit-avionics',
  avionics: 'cockpit-avionics',
  cabin: 'cabin-interior',
  cargoFwd: 'fuselage-barrel',
  cargoAft: 'fuselage-barrel',
  centerTank: 'fuel-system',
  wingTank: 'fuel-system',
  wingBox: 'wing-box',
  gearBay: 'landing-gear',
  apu: 'apu',
}

function SectionLabel({ position, children, id }) {
  // constant screen-size chips: distance-scaled Html balloons to unreadable
  // sizes the moment the eye-level camera walks near one
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <a className="explore-label" href={`#/components?focus=${LABEL_LINKS[id] || ''}`}>
        {children}
      </a>
    </Html>
  )
}

/** 1.75 m human figure — the "look and feel" scale anchor. */
function Human({ position }) {
  return (
    <group position={position}>
      {/* legs+torso */}
      <mesh position={[0, 0.72, 0]}>
        <capsuleGeometry args={[0.16, 1.12, 4, 12]} />
        <meshStandardMaterial color="#e3b341" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color="#d8c9a3" roughness={0.7} />
      </mesh>
    </group>
  )
}

/** A 4.5 m car parked by the wing — a second everyday size reference. */
function Car({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[4.5, 0.7, 1.8]} />
        <meshStandardMaterial color="#30363d" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0.2, 1.15, 0]}>
        <boxGeometry args={[2.2, 0.55, 1.65]} />
        <meshStandardMaterial color="#21262d" roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  )
}

/**
 * Procedural interior generated from the variant's dimensions, in world space
 * (x = length, y = up, z = span), aligned to the upright GLB.
 */
function Interior({ dims, H0, labels }) {
  const L = dims.lengthM
  const R = dims.fuselageDiaM / 2
  const nose = L * 0.115
  const tail = L * 0.235
  const xNoseEnd = -L / 2 + nose
  const xTailStart = L / 2 - tail
  const floorY = H0 - R * 0.35
  const xWing = -L * 0.02

  // ---- seats (instanced) ----
  const seatMesh = useRef()
  const seats = useMemo(() => {
    const groups = abreastFor(dims.fuselageDiaM)
    const seatW = 0.46
    const aisleW = 0.5
    const totalW = groups.reduce((n, g) => n + g * seatW, 0) + (groups.length - 1) * aisleW
    const pitch = 0.81
    const cabinFrom = xNoseEnd + 2.4 // fwd galley/door
    const cabinTo = xTailStart - 2.2 // aft galley
    const rows = Math.max(4, Math.floor((cabinTo - cabinFrom) / pitch))
    const mats = []
    for (let r = 0; r < rows; r++) {
      const x = cabinFrom + r * pitch
      let z = -totalW / 2
      for (const g of groups) {
        for (let s = 0; s < g; s++) {
          mats.push([x, floorY + 0.55, z + seatW / 2])
          z += seatW
        }
        z += aisleW
      }
    }
    return mats
  }, [dims.fuselageDiaM, xNoseEnd, xTailStart, floorY])

  useEffect(() => {
    if (!seatMesh.current) return
    const m = new THREE.Matrix4()
    seats.forEach((p, i) => {
      m.setPosition(p[0], p[1], p[2])
      seatMesh.current.setMatrixAt(i, m)
    })
    seatMesh.current.instanceMatrix.needsUpdate = true
  }, [seats])

  const glass = { transparent: true, opacity: 0.32, depthWrite: false }

  return (
    <group>
      {/* cabin floor */}
      <mesh position={[(xNoseEnd + xTailStart) / 2, floorY, 0]}>
        <boxGeometry args={[xTailStart - xNoseEnd, 0.12, R * 1.72]} />
        <meshStandardMaterial color="#3d444d" roughness={0.9} />
      </mesh>
      {/* seats */}
      <instancedMesh ref={seatMesh} args={[undefined, undefined, seats.length]}>
        <boxGeometry args={[0.62, 1.05, 0.44]} />
        <meshStandardMaterial color="#2f6cff" roughness={0.85} />
      </instancedMesh>
      {/* cockpit: bulkhead, panel, 2 seats */}
      <mesh position={[-L / 2 + nose * 0.92, floorY + R * 0.55, 0]}>
        <boxGeometry args={[0.1, R * 1.05, R * 1.5]} />
        <meshStandardMaterial color="#30363d" />
      </mesh>
      <mesh position={[-L / 2 + nose * 0.42, floorY + 0.85, 0]}>
        <boxGeometry args={[0.5, 0.7, R * 1.15]} />
        <meshStandardMaterial color="#161b22" roughness={0.4} />
      </mesh>
      {[-0.55, 0.55].map((z) => (
        <mesh key={z} position={[-L / 2 + nose * 0.66, floorY + 0.55, z * R]}>
          <boxGeometry args={[0.55, 1.0, 0.5]} />
          <meshStandardMaterial color="#6e40c9" roughness={0.8} />
        </mesh>
      ))}
      {/* galleys / lavs at cabin ends */}
      <mesh position={[xNoseEnd + 1.1, floorY + 0.95, 0]}>
        <boxGeometry args={[1.4, 1.9, R * 1.5]} />
        <meshStandardMaterial color="#444c56" transparent opacity={0.85} />
      </mesh>
      <mesh position={[xTailStart - 1.0, floorY + 0.95, 0]}>
        <boxGeometry args={[1.4, 1.9, R * 1.4]} />
        <meshStandardMaterial color="#444c56" transparent opacity={0.85} />
      </mesh>
      {/* cargo holds below floor */}
      <mesh position={[(xNoseEnd + 1 + xWing - L * 0.09) / 2, H0 - R * 0.62, 0]}>
        <boxGeometry args={[xWing - L * 0.09 - xNoseEnd - 1, R * 0.5, R * 1.35]} />
        <meshStandardMaterial color="#d29922" {...glass} />
      </mesh>
      <mesh position={[(xWing + L * 0.1 + xTailStart - 0.8) / 2, H0 - R * 0.62, 0]}>
        <boxGeometry args={[xTailStart - 0.8 - (xWing + L * 0.1), R * 0.5, R * 1.35]} />
        <meshStandardMaterial color="#d29922" {...glass} />
      </mesh>
      {/* wing box + centre fuel tank */}
      <mesh position={[xWing, H0 - R * 0.45, 0]}>
        <boxGeometry args={[L * 0.13, R * 0.55, R * 2.1]} />
        <meshStandardMaterial color="#3fb950" {...glass} />
      </mesh>
      {/* wing tanks, swept with the wing */}
      {[1, -1].map((s) => (
        <mesh
          key={s}
          position={[xWing + L * 0.045, H0 - R * 0.3, s * (R + dims.wingspanM * 0.115)]}
          rotation={[0, -s * THREE.MathUtils.degToRad(24), 0]}
        >
          <boxGeometry args={[L * 0.075, 0.28, dims.wingspanM * 0.21]} />
          <meshStandardMaterial color="#3fb950" {...glass} />
        </mesh>
      ))}
      {/* gear bays */}
      <mesh position={[-L / 2 + nose * 1.15, H0 - R * 0.75, 0]}>
        <boxGeometry args={[1.6, R * 0.55, 1.1]} />
        <meshStandardMaterial color="#f85149" {...glass} />
      </mesh>
      <mesh position={[xWing + L * 0.07, H0 - R * 0.8, 0]}>
        <boxGeometry args={[2.4, R * 0.5, R * 2.4]} />
        <meshStandardMaterial color="#f85149" {...glass} />
      </mesh>
      {/* avionics (E/E) bay under the cockpit */}
      <mesh position={[-L / 2 + nose * 0.66, H0 - R * 0.55, 0]}>
        <boxGeometry args={[1.8, R * 0.5, R * 0.9]} />
        <meshStandardMaterial color="#58a6ff" {...glass} />
      </mesh>
      {/* APU in the tailcone */}
      <mesh position={[L / 2 - tail * 0.22, H0 + R * 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.32, 0.38, 1.5, 16]} />
        <meshStandardMaterial color="#db6d28" roughness={0.5} metalness={0.6} />
      </mesh>

      {labels && (
        <>
          {/* above the crown */}
          <SectionLabel id="cockpit" position={[-L / 2 + nose * 0.5, H0 + R + 1.5, 0]}>Cockpit</SectionLabel>
          <SectionLabel id="cabin" position={[0, H0 + R + 1.6, 0]}>Cabin</SectionLabel>
          <SectionLabel id="apu" position={[L / 2 - tail * 0.22, H0 + R + 1.4, 0]}>APU</SectionLabel>
          <SectionLabel id="wingTank" position={[xWing + L * 0.05, H0 + 1.2, dims.wingspanM * 0.24]}>Wing fuel tank</SectionLabel>
          {/* below the belly — fixed heights so they never sink under the apron */}
          <SectionLabel id="avionics" position={[-L / 2 + nose * 0.66, 0.9, 0]}>Avionics (E/E) bay</SectionLabel>
          <SectionLabel id="cargoFwd" position={[xNoseEnd + L * 0.12, 0.9, 0]}>Fwd cargo hold</SectionLabel>
          <SectionLabel id="cargoAft" position={[xTailStart - L * 0.1, 0.9, 0]}>Aft cargo hold</SectionLabel>
          <SectionLabel id="centerTank" position={[xWing - L * 0.04, 1.8, 0]}>Centre tank + wing box</SectionLabel>
          <SectionLabel id="gearBay" position={[xWing + L * 0.09, 0.55, 0]}>Main gear bay</SectionLabel>
        </>
      )}
    </group>
  )
}

function CameraRig({ mode, L, H0, controlsRef }) {
  const { camera } = useThree()
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    if (mode === 'eye') {
      camera.position.set(-L * 0.62, 1.7, L * 0.34)
      c.target.set(0, H0, 0)
    } else {
      camera.position.set(-L * 0.85, L * 0.42, L * 0.95)
      c.target.set(0, H0 * 0.8, 0)
    }
    c.update()
  }, [mode, L, H0, camera, controlsRef])
  return null
}

function ExploreScene({ modelUrl, dims, cut, xray, labels, view, controlsRef }) {
  const { scene } = useGLTF(withBase(modelUrl))
  const cloned = useMemo(() => scene.clone(true), [scene])

  // world-space clipping plane: keeps z <= constant, cutting the near half open
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 1000), [])

  // clone every material once: double-sided (so the cut shell shows its inside)
  // and clipped by the section plane. Interior/scale refs stay unclipped.
  const mats = useMemo(() => {
    const list = []
    cloned.traverse((o) => {
      if (!o.isMesh) return
      const m = o.material.clone()
      m.side = THREE.DoubleSide
      m.clippingPlanes = [clipPlane]
      o.material = m
      list.push({ m, opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite })
    })
    return list
  }, [cloned, clipPlane])

  // hull lift so the gear sits on the apron: model "down" is +Z pre-rotation
  const H0 = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned)
    return box.max.z
  }, [cloned])

  useEffect(() => {
    for (const e of mats) {
      e.m.transparent = xray ? true : e.transparent
      e.m.opacity = xray ? 0.16 : e.opacity
      e.m.depthWrite = xray ? false : e.depthWrite
      e.m.needsUpdate = true
    }
  }, [xray, mats])

  const span = dims.wingspanM
  useFrame(() => {
    // slider 0 → plane parked beyond the wingtip (no cut); 1 → cut to centreline
    clipPlane.constant = (1 - cut) * (span / 2 + 2)
  })

  const L = dims.lengthM

  return (
    <>
      <hemisphereLight intensity={0.55} color="#cdd9e5" groundColor="#30363d" />
      <directionalLight position={[-60, 80, 40]} intensity={1.4} />
      <directionalLight position={[50, 30, -60]} intensity={0.35} color="#58a6ff" />
      <fog attach="fog" args={['#0d1117', L * 3, L * 9]} />

      {/* upright airframe on its gear */}
      <group position={[0, H0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={cloned} />
      </group>

      <Interior dims={dims} H0={H0} labels={labels} />

      {/* true-scale anchors */}
      <Human position={[-L / 2 - 3, 0, 5]} />
      <Car position={[6, 0, span / 2 + 5]} />
      {labels && (
        <>
          <Html position={[-L / 2 - 3, 2.6, 5]} center zIndexRange={[20, 0]}>
            <span className="explore-label plain">Human — 1.75 m</span>
          </Html>
          <Html position={[6, 2.4, span / 2 + 5]} center zIndexRange={[20, 0]}>
            <span className="explore-label plain">Car — 4.5 m</span>
          </Html>
        </>
      )}

      {/* apron: 10 m grid squares */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#10151b" roughness={1} />
      </mesh>
      <gridHelper args={[600, 60, '#263040', '#1a212b']} position={[0, 0.01, 0]} />

      <CameraRig mode={view} L={L} H0={H0} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        minDistance={2.5}
        maxDistance={L * 6}
        maxPolarAngle={Math.PI / 2 - 0.03}
      />
    </>
  )
}

function Loader() {
  return (
    <Html center>
      <div style={{ color: '#8b949e', font: '13px system-ui' }}>Loading model…</div>
    </Html>
  )
}

export default function ExploreViewer({ modelUrl, dimensions, height = 560 }) {
  const [view, setView] = useState('orbit')
  const [cut, setCut] = useState(0)
  const [xray, setXray] = useState(false)
  const [labels, setLabels] = useState(true)
  const controlsRef = useRef()

  return (
    <div>
      <div className="explore-bar">
        <div className="viewer-toggle">
          <button className={view === 'orbit' ? 'on' : ''} onClick={() => setView('orbit')}>Orbit</button>
          <button className={view === 'eye' ? 'on' : ''} onClick={() => setView('eye')}>Eye level · 1.7 m</button>
        </div>
        <label className="explode-ctrl" title="Slice the hull open along the centreline">
          <span>Closed</span>
          <input type="range" min="0" max="100" value={cut * 100} onChange={(e) => setCut(+e.target.value / 100)} />
          <span>Section cut</span>
        </label>
        <label className="explore-check">
          <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} /> X-ray hull
        </label>
        <label className="explore-check">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Labels
        </label>
      </div>
      <div style={{ height, width: '100%', background: '#0d1117', borderRadius: 12, overflow: 'hidden' }}>
        <CanvasFallback label="3D preview unavailable on this device">
          <Canvas
            camera={{ position: [-40, 18, 42], fov: 40, near: 0.3, far: 4000 }}
            onCreated={({ gl }) => { gl.localClippingEnabled = true }}
          >
            <color attach="background" args={['#0d1117']} />
            <Suspense fallback={<Loader />}>
              <ExploreScene
                modelUrl={modelUrl}
                dims={dimensions}
                cut={cut}
                xray={xray}
                labels={labels}
                view={view}
                controlsRef={controlsRef}
              />
            </Suspense>
          </Canvas>
        </CanvasFallback>
      </div>
      <p className="explore-note">
        True scale — 1 grid square = 10 m. The interior layout (cabin, tanks, holds, bays)
        is generated from this variant's real dimensions; click a label to see how that
        component is built.
      </p>
    </div>
  )
}
