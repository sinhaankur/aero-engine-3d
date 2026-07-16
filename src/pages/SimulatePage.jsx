import { lazy, Suspense, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily, getAircraft } from '../data/index.js'
import AirfoilFlow, { WIND_CONDITIONS } from '../sim/AirfoilFlow.jsx'
import FuelSystem from '../sim/FuelSystem.jsx'
import WindTunnel from '../sim/WindTunnel.jsx'

// the showcase model viewer pulls in three.js — keep it lazy like the home hero
const HeroPlane = lazy(() => import('../three/HeroPlane.jsx'))

const TABS = [
  { id: 'aero', name: 'Aerodynamics', icon: '🌬' },
  { id: 'fuel', name: 'Fuel system', icon: '⛽' },
  { id: 'cfd', name: 'Wind tunnel', icon: '🌀' },
]
const TAB_BLURB = {
  fuel: 'Live fuel flow from tanks through pumps to the engines.',
  cfd: 'A real GPU CFD run over our A320 model — vortices and all.',
}

const shortName = (name) => name.replace(/^(Airbus|Boeing) /, '')

/** Compact per-variant performance cells for the showcase rail. */
function SpecMini({ aircraft }) {
  const d = aircraft.dimensions
  const maxThrust = Math.max(...aircraft.engines.map((e) => e.thrustKn))
  const cells = [
    ['MTOW', `${(d.mtowKg / 1000).toFixed(1)} t`],
    ['Wing loading', `${Math.round(d.mtowKg / d.wingAreaM2)} kg/m²`],
    ['Wing area', `${d.wingAreaM2} m²`],
    ['Wingspan', `${d.wingspanM} m`],
    ['Cruise', `M ${d.cruiseMach}`],
    ['Range', `${d.rangeKm.toLocaleString()} km`],
    ['Ceiling', `${d.ceilingM.toLocaleString()} m`],
    ['Thrust', `≤ ${maxThrust} kN`],
  ]
  return (
    <div className="sim-specs sim-specs-mini">
      {cells.map(([k, v]) => (
        <div key={k} className="sim-spec">
          <span className="v">{v}</span>
          <span className="k">{k}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Full-screen "flight test" stage: the whole experience fills the viewport.
 * Left rail showcases the selected aircraft — its actual 3D model, identity
 * and performance numbers; the flow field fills the rest. Every variant is
 * selectable and the wind-condition chips drive the physics.
 */
export default function SimulatePage() {
  // deep-linkable: /simulate?ac=<familyId>/<aircraftId> preselects a variant
  // (aircraft pages link here as "fly this wing")
  const [searchParams] = useSearchParams()
  const [initFam, initAc] = (searchParams.get('ac') || '').split('/')
  const preselected = getAircraft(initFam, initAc)

  const [tab, setTab] = useState('aero')
  const [familyId, setFamilyId] = useState(preselected ? initFam : 'a320')
  const [aircraftId, setAircraftId] = useState(preselected ? initAc : 'a320')
  const [wind, setWind] = useState('calm')
  const stageRef = useRef(null)

  const variants = getAircraftForFamily(familyId)
  const aircraft = variants.find((a) => a.id === aircraftId) || variants[0]
  const windDef = WIND_CONDITIONS.find((w) => w.id === wind)

  const pickFamily = (id) => {
    setFamilyId(id)
    setAircraftId(getAircraftForFamily(id)[0]?.id)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else stageRef.current?.requestFullscreen?.().catch(() => {})
  }

  return (
    <div className="sim-stage" ref={stageRef}>
      <div className="sim-stage-head">
        <h1>Simulate</h1>
        <div className="sys-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span className="sys-icon" aria-hidden>{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="sim-chip" onClick={toggleFullscreen} title="Toggle fullscreen">
          ⛶ Fullscreen
        </button>
      </div>

      {tab === 'aero' ? (
        <>
          <div className="sim-picker">
            <div className="sim-picker-row">
              <span className="sim-picker-label">Aircraft</span>
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  className={`sim-chip ${f.id === familyId ? 'on' : ''}`}
                  onClick={() => pickFamily(f.id)}
                >
                  {f.name.replace(' Family', '')}
                </button>
              ))}
            </div>
            <div className="sim-picker-row">
              <span className="sim-picker-label">Variant</span>
              {variants.map((a) => (
                <button
                  key={a.id}
                  className={`sim-chip ${a.id === aircraft.id ? 'on' : ''}`}
                  onClick={() => setAircraftId(a.id)}
                >
                  {shortName(a.name)}
                </button>
              ))}
            </div>
            <div className="sim-picker-row">
              <span className="sim-picker-label">Wind</span>
              {WIND_CONDITIONS.map((w) => (
                <button
                  key={w.id}
                  className={`sim-chip ${w.id === wind ? 'on' : ''}`}
                  onClick={() => setWind(w.id)}
                  title={w.blurb}
                >
                  {w.name}
                </button>
              ))}
              <span className="sim-wind-note">{windDef?.blurb}</span>
            </div>
          </div>

          <div className="sim-duo">
            <aside className="sim-showcase">
              <div className="sim-showcase-model">
                <span className="tag-corner">MODEL // <b>{shortName(aircraft.name)}</b></span>
                <Suspense fallback={<div className="viewport-loading" style={{ height: '100%' }}>Loading model…</div>}>
                  <HeroPlane url={aircraft.model} height="100%" />
                </Suspense>
              </div>
              <div className="sim-showcase-id">
                <h2>{shortName(aircraft.name)}</h2>
                <p>{aircraft.summary}</p>
              </div>
              <SpecMini aircraft={aircraft} />
              <Link className="sim-showcase-link" to={`/family/${familyId}/${aircraft.id}`}>
                Full profile: blueprint · engines · safety →
              </Link>
            </aside>
            <div className="sim-flow">
              <AirfoilFlow fill aircraft={aircraft} wind={wind} />
            </div>
          </div>
        </>
      ) : (
        <div className="sim-stage-scroll">
          <p className="sim-blurb">{TAB_BLURB[tab]}</p>
          {tab === 'fuel' ? <FuelSystem /> : <WindTunnel />}
        </div>
      )}
    </div>
  )
}
