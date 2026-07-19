import { lazy, Suspense, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily, getAircraft } from '../data/index.js'
import AirfoilFlow, { WIND_CONDITIONS } from '../sim/AirfoilFlow.jsx'
import FlightEnvelope from '../sim/FlightEnvelope.jsx'
import FuelSystem from '../sim/FuelSystem.jsx'
import WindTunnel from '../sim/WindTunnel.jsx'
import EngineLive from '../sim/flight/EngineLive.jsx'
import { isa, deriveAircraft, engineParams, KT } from '../sim/flight/model.js'

// the showcase model viewer pulls in three.js — keep it lazy like the home hero
const HeroPlane = lazy(() => import('../three/HeroPlane.jsx'))

const TABS = [
  { id: 'aero', name: 'Aerodynamics', icon: '🌬' },
  { id: 'engine', name: 'Engine', icon: '⚙' },
  { id: 'fuel', name: 'Fuel system', icon: '⛽' },
  { id: 'cfd', name: 'Wind tunnel', icon: '🌀' },
]
const TAB_BLURB = {
  engine: 'What the engine is doing to hold this condition — N1/N2, EGT, gas-path temps and fuel flow at the speed and altitude you set.',
  fuel: 'Live fuel flow from tanks through pumps to the engines.',
  cfd: 'Real GPU CFD over our own models — pick an aircraft and watch its vortices. A320 vs 737-800 is a head-to-head.',
}

const shortName = (name) => name.replace(/^(Airbus|Boeing) /, '')

/**
 * Guided stories: each scenario drives the actual sliders (you watch them
 * move) while a caption narrates cause → effect. Steps tween the shared sim
 * state to `to` over `dur` seconds; touching any control cancels the story.
 */
const SCENARIOS = [
  {
    id: 'takeoff', name: '🛫 Takeoff',
    steps: [
      { dur: 0.1, to: { aoa: 2, kt: 130, alt: 0, isaDev: 0 }, wind: 'calm', say: 'Lined up. At 130 kt the wing makes far less lift than the aircraft weighs — watch L vs W.' },
      { dur: 3, to: { kt: 170 }, say: 'Accelerating… lift grows with the SQUARE of speed.' },
      { dur: 2, to: { aoa: 10 }, say: 'Rotate — pitch to 10° and L crosses 100% of W. That moment is flight.' },
      { dur: 3.5, to: { alt: 2000, kt: 210, aoa: 7 }, say: 'Positive climb — watch the dot rise inside the envelope.' },
    ],
  },
  {
    id: 'cruise', name: 'Climb to cruise',
    steps: [
      { dur: 0.1, to: { aoa: 4, kt: 250, alt: 2000, isaDev: 0 }, wind: 'calm', say: 'Climbing out at 250 kt.' },
      { dur: 5, to: { alt: 11000, kt: 340 }, say: 'The air thins as we climb — ρ falls — so we hold lift by flying ever faster.' },
      { dur: 2, to: { aoa: 3 }, say: 'Level at 11 km, near the Mach roof. This is exactly why jets cruise fast and high.' },
    ],
  },
  {
    id: 'hot', name: 'Hot & high',
    steps: [
      { dur: 0.1, to: { alt: 1600, kt: 150, aoa: 8, isaDev: 0 }, wind: 'calm', say: 'A mountain runway, 1.6 km up, 150 kt.' },
      { dur: 3, to: { isaDev: 30 }, say: 'A +30 °C heatwave rolls in: same speed, same angle — and lift just fell. Density altitude.' },
      { dur: 2.5, to: { kt: 175 }, say: 'The only fix is more speed — which needs more runway. The hot-and-high problem.' },
    ],
  },
  {
    id: 'stall', name: 'Stall & recover',
    steps: [
      { dur: 0.1, to: { aoa: 6, kt: 180, alt: 1000, isaDev: 0 }, wind: 'calm', say: 'Slow flight at 180 kt.' },
      { dur: 3.5, to: { aoa: 17 }, say: 'Pulling up… past 15° the flow separates — MORE angle now means LESS lift.' },
      { dur: 2.5, to: { aoa: 7, kt: 215 }, say: 'Recovery: nose DOWN and speed up. Counter-intuitive — and it saves lives.' },
    ],
  },
]

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
  // sim controls live here so the flight-envelope chart shares them
  const [aoa, setAoa] = useState(6)
  const [kt, setKt] = useState(250)
  const [alt, setAlt] = useState(0)
  const [isaDev, setIsaDev] = useState(0)
  const stageRef = useRef(null)

  // ---- guided-story runner: tweens the sliders, narrates each step ----
  const [story, setStory] = useState(null) // { id, say }
  const simRef = useRef({})
  simRef.current = { aoa, kt, alt, isaDev }
  const storyCtl = useRef(null)

  const stopStory = () => {
    if (storyCtl.current) cancelAnimationFrame(storyCtl.current.raf)
    storyCtl.current = null
    setStory(null)
  }

  const runStory = (sc) => {
    stopStory()
    const ctl = { raf: 0 }
    storyCtl.current = ctl
    const setters = { aoa: setAoa, kt: setKt, alt: setAlt, isaDev: setIsaDev }
    let stepIdx = 0

    const startStep = () => {
      const step = sc.steps[stepIdx]
      if (!step) { stopStory(); return }
      if (step.wind) setWind(step.wind)
      setStory({ id: sc.id, say: step.say })
      const from = { ...simRef.current }
      const t0 = performance.now()
      const tick = () => {
        if (storyCtl.current !== ctl) return
        const f = Math.min(1, (performance.now() - t0) / (step.dur * 1000))
        const e = f * f * (3 - 2 * f) // smoothstep ease
        for (const k of Object.keys(step.to)) {
          setters[k](Math.round(from[k] + (step.to[k] - from[k]) * e))
        }
        if (f < 1) ctl.raf = requestAnimationFrame(tick)
        else { stepIdx += 1; startStep() }
      }
      ctl.raf = requestAnimationFrame(tick)
    }
    startStep()
  }

  // any manual control input cancels the running story
  const manual = (setter) => (v) => { stopStory(); setter(v) }

  const variants = getAircraftForFamily(familyId)
  const aircraft = variants.find((a) => a.id === aircraftId) || variants[0]
  const windDef = WIND_CONDITIONS.find((w) => w.id === wind)

  // Static engine readout for the Engine tab: find the N1 that produces the
  // thrust needed to hold the set speed at the set altitude (level, drag = T),
  // then run the shared engineParams model at that N1.
  const engineOut = (() => {
    const acm = deriveAircraft(aircraft)
    const atm = isa(alt * 0.3048, isaDev)
    const tas = kt * KT
    const q = 0.5 * atm.rho * tas * tas
    const W = acm.mass * 9.80665
    const cl = q > 1 ? Math.min(acm.clMaxClean, W / (q * acm.S)) : acm.clMaxClean
    const cd = acm.cd0 + (cl * cl) / (Math.PI * acm.AR * acm.e)
    const drag = q * acm.S * cd                                   // thrust required
    const thrustAvail = acm.thrustMax * Math.pow(atm.sigma, 0.72) // installed, lapsed
    // N1 fraction: idle 0.2 → thrust maps ~linearly to N1 above idle
    const n1frac = Math.max(0.2, Math.min(1.05, 0.2 + (drag / Math.max(1, thrustAvail)) * 0.8))
    const p = engineParams(n1frac, atm)
    return { n1: p.n1, eng1: p, eng2: p, atm, tasKt: kt, dragKn: drag / 1000, thrustAvailKn: thrustAvail / 1000 }
  })()
  const engineFuelState = { fuelKg: deriveAircraft(aircraft).mass * 0.12 }

  const pickFamily = (id) => {
    setFamilyId(id)
    setAircraftId(getAircraftForFamily(id)[0]?.id)
  }

  // aircraft + variant rows are shared by the aero and wind-tunnel tabs
  const aircraftPicker = (
    <>
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
    </>
  )

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
            {aircraftPicker}
            <div className="sim-picker-row">
              <span className="sim-picker-label">Wind</span>
              {WIND_CONDITIONS.map((w) => (
                <button
                  key={w.id}
                  className={`sim-chip ${w.id === wind ? 'on' : ''}`}
                  onClick={() => { stopStory(); setWind(w.id) }}
                  title={w.blurb}
                >
                  {w.name}
                </button>
              ))}
              <span className="sim-wind-note">{windDef?.blurb}</span>
            </div>
            <div className="sim-picker-row">
              <span className="sim-picker-label">Story</span>
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  className={`sim-chip ${story?.id === sc.id ? 'on' : ''}`}
                  onClick={() => runStory(sc)}
                >
                  {sc.name}
                </button>
              ))}
              {story && (
                <button className="sim-chip" onClick={stopStory}>■ Stop</button>
              )}
              <span className={`sim-wind-note ${story ? 'sim-story-live' : ''}`}>
                {story ? story.say : 'Fly a guided moment — the sliders move themselves, you watch the physics.'}
              </span>
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
              <div className="sim-env-head">// Flight envelope — where it works</div>
              <FlightEnvelope aircraft={aircraft} kt={kt} alt={alt} isaDev={isaDev} />
              <Link className="sim-showcase-link" to={`/family/${familyId}/${aircraft.id}`}>
                Full profile: blueprint · engines · safety →
              </Link>
            </aside>
            <div className="sim-flow">
              <AirfoilFlow
                fill
                aircraft={aircraft}
                wind={wind}
                aoa={aoa} onAoa={manual(setAoa)}
                kt={kt} onKt={manual(setKt)}
                alt={alt} onAlt={manual(setAlt)}
                isaDev={isaDev} onIsaDev={manual(setIsaDev)}
              />
            </div>
          </div>
        </>
      ) : tab === 'engine' ? (
        <>
          <div className="sim-picker">{aircraftPicker}</div>
          <div className="sim-stage-scroll">
            <p className="sim-blurb">{TAB_BLURB[tab]}</p>
            <div className="sim-engine-conds">
              <label>Speed <input type="range" min="130" max="560" value={kt} onChange={(e) => manual(setKt)(+e.target.value)} /><b>{kt} kt</b></label>
              <label>Altitude <input type="range" min="0" max="41000" step="500" value={alt} onChange={(e) => manual(setAlt)(+e.target.value)} /><b>{alt.toLocaleString()} ft</b></label>
              <label>ISA dev <input type="range" min="-30" max="35" value={isaDev} onChange={(e) => manual(setIsaDev)(+e.target.value)} /><b>{isaDev > 0 ? '+' : ''}{isaDev} °C</b></label>
            </div>
            <div className="sim-engine-panel">
              <EngineLive out={engineOut} state={engineFuelState} ac={deriveAircraft(aircraft)} engine={aircraft.engines?.[0]} />
              <p className="sim-engine-note">
                To hold <b>{kt} kt</b> at <b>{alt.toLocaleString()} ft</b>, the {shortName(aircraft.name)} needs about{' '}
                <b>{engineOut.dragKn.toFixed(0)} kN</b> of thrust — that sets the N1 above.
                {' '}Installed thrust available here (density-lapsed): <b>{engineOut.thrustAvailKn.toFixed(0)} kN</b>.
              </p>
            </div>
          </div>
        </>
      ) : tab === 'cfd' ? (
        <>
          <div className="sim-picker">{aircraftPicker}</div>
          <div className="sim-stage-scroll">
            <p className="sim-blurb">{TAB_BLURB[tab]}</p>
            <WindTunnel aircraft={aircraft} />
          </div>
        </>
      ) : (
        <div className="sim-stage-scroll">
          <p className="sim-blurb">{TAB_BLURB[tab]}</p>
          <FuelSystem />
        </div>
      )}
    </div>
  )
}
