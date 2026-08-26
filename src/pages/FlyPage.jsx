import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily, getAircraft } from '../data/index.js'
import { WEATHER, deriveAircraft, createState, runwayFor } from '../sim/flight/model.js'
import { AIRPORTS, AIRPORT_BY_CODE, distanceNm, bearingDeg, etaHours, legProgress } from '../data/airports.js'
import PFD from '../sim/flight/PFD.jsx'
import Cockpit from '../sim/flight/Cockpit.jsx'
import { updateAtc, callsignFor } from '../sim/flight/atc.js'
import { FlightAudio } from '../sim/flight/audio.js'
import EngineLive from '../sim/flight/EngineLive.jsx'
import AirportBoard from '../sim/flight/AirportBoard.jsx'
import { checklistProgress } from '../sim/flight/procedures.js'
import { useFlightData } from '../live/useFlightData.js'
import { hardReload } from '../lib/hardReload.js'

const FlightScene = lazy(() => import('../three/FlightScene.jsx'))
const RouteGlobe = lazy(() => import('../live/RouteGlobe.jsx'))

const shortName = (name) => name.replace(/^(Airbus|Boeing|Embraer) /, '')

const VIEWS = [
  { id: 'cockpit', name: 'Cockpit' },
  { id: 'chase', name: 'Chase' },
  { id: 'wing', name: 'Window' },
  { id: 'tower', name: 'Tower' },
  { id: 'globe', name: 'Globe' },
]

// how the pilot flies: keyboard, or by clicking the real flight-deck controls
const MODES = [
  { id: 'keyboard', name: 'Keyboard' },
  { id: 'deck', name: 'Cockpit' },
]

/**
 * /fly — fly any variant in the archive with real conditions, down to a
 * cockpit-level view with a working PFD. The physics (ISA atmosphere,
 * dimensions-derived aero, wind/turbulence layers) lives in sim/flight/model.
 */
export default function FlyPage() {
  const [params] = useSearchParams()
  const initial = params.get('ac') || 'a320/a320'
  const [acKey, setAcKey] = useState(initial)
  const [wxKey, setWxKey] = useState('clear')
  const [fromCode, setFromCode] = useState(params.get('from') || 'LHR')
  const [toCode, setToCode] = useState(params.get('to') || 'JFK')
  const [view, setView] = useState('cockpit')
  const [mode, setMode] = useState('keyboard') // keyboard | deck
  const [hud, setHud] = useState(null)
  const [atcLog, setAtcLog] = useState([])
  const atcMem = useRef(null)
  const [sound, setSound] = useState(false)
  const [showEngine, setShowEngine] = useState(false)
  const [coldDark, setColdDark] = useState(false)
  const [photo, setPhoto] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  const [cleared, setCleared] = useState(false)   // departure-slot clearance
  const [optionsOpen, setOptionsOpen] = useState(false) // ⋯ options drawer
  const optionsRef = useRef(null)
  const audioRef = useRef(null)
  if (audioRef.current == null) audioRef.current = new FlightAudio()
  const [, forceTick] = useState(0)

  // live ADS-B feed — used only to show the real aircraft on the ground at the
  // selected departure field (the "departures board"); poll slowly here
  const { flights, status: liveStatus } = useFlightData({ intervalMs: 30000 })

  const [familyId, aircraftId] = acKey.split('/')
  const aircraft = getAircraft(familyId, aircraftId) || getAircraft('a320', 'a320')
  const flyable = aircraft.model

  const ac = useMemo(() => deriveAircraft(aircraft), [aircraft])
  const weather = WEATHER[wxKey]

  // real departure / destination airports → runway + great-circle route
  const from = AIRPORT_BY_CODE[fromCode] || AIRPORTS[0]
  const to = AIRPORT_BY_CODE[toCode] || AIRPORTS[1]
  const rwy = useMemo(() => runwayFor(from.rwy.lenM), [from])
  const route = useMemo(() => ({
    nm: Math.round(distanceNm(from, to)),
    brg: Math.round(bearingDeg(from, to)),
    eta: etaHours(from, to),
  }), [from, to])

  // Mutable sim container shared with the Canvas loop — no re-renders per frame.
  const simRef = useRef(null)
  if (simRef.current == null) {
    const st = createState(ac, rwy, coldDark)
    simRef.current = {
      state: st,
      ac,
      weather,
      controls: { pitch: 0, roll: 0, yaw: 0, throttle: 0, flap: st.flap, gear: true, brakes: st.brakes, speedbrake: 0 },
      out: null,
      paused: false,
    }
  }
  simRef.current.ac = ac
  simRef.current.weather = weather

  const reset = () => {
    const st = createState(ac, rwy, coldDark)
    simRef.current.state = st
    simRef.current.controls = { pitch: 0, roll: 0, yaw: 0, throttle: 0, flap: st.flap, gear: true, brakes: st.brakes, speedbrake: 0 }
    simRef.current.out = null
    setCleared(false)   // a fresh flight needs a fresh departure clearance
    forceTick((n) => n + 1)
  }

  // variant / departure / start-state change → fresh state
  useEffect(() => { reset() }, [acKey, fromCode, coldDark]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keyboard ----
  useEffect(() => {
    const keys = new Set()
    const flapStep = (dir) => {
      const c = simRef.current.controls
      c.flap = Math.max(0, Math.min(3, c.flap + dir))
    }
    const down = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      keys.add(e.code)
      const c = simRef.current.controls
      const s = simRef.current.state
      switch (e.code) {
        case 'KeyF': flapStep(1); break
        case 'KeyV': flapStep(-1); break
        case 'KeyG': c.gear = !c.gear; break
        case 'KeyB': c.brakes = !c.brakes; break
        case 'KeyC': setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + 1) % VIEWS.length].id); break
        case 'KeyH': setPhoto((v) => !v); break
        case 'KeyA':
          s.apOn = !s.apOn
          if (s.apOn) {
            // engage ALT-hold at the current altitude, wings level
            s.apAlt = s.h
            s.fcuAlt = Math.round((s.h / 0.3048) / 100) * 100
            s.apVsMode = false
            s.apHdgMode = false
          }
          break
        case 'Space': simRef.current.paused = !simRef.current.paused; e.preventDefault(); break
        case 'Enter': if (s.crashed) reset(); break
        default: break
      }
      if (e.code.startsWith('Arrow')) e.preventDefault()
    }
    const up = (e) => keys.delete(e.code)
    // 60 Hz key → control mapping. Keyboard is binary (0/±1); ramping each axis
    // toward its target instead of snapping gives a natural spring-loaded-stick
    // feel — no more twitchy on/off pitch and roll. Release eases back to
    // neutral. (The physics model still applies its own alpha/bank smoothing.)
    const RAMP = 0.14, RETURN = 0.22
    const ease = (cur, tgt) => {
      const k = tgt === 0 ? RETURN : RAMP
      return cur + (tgt - cur) * k
    }
    const iv = setInterval(() => {
      const c = simRef.current.controls
      const pTgt = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)
      const rTgt = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)
      const yTgt = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0)
      c.pitch = ease(c.pitch || 0, pTgt)
      c.roll = ease(c.roll || 0, rTgt)
      c.yaw = ease(c.yaw || 0, yTgt)
      // snap tiny residuals to zero so controls fully centre
      if (Math.abs(c.pitch) < 0.008) c.pitch = 0
      if (Math.abs(c.roll) < 0.008) c.roll = 0
      if (Math.abs(c.yaw) < 0.008) c.yaw = 0
      if (keys.has('KeyW')) c.throttle = Math.min(1, c.throttle + 0.012)
      if (keys.has('KeyS')) c.throttle = Math.max(0, c.throttle - 0.015)
      if (simRef.current.state.apOn && (keys.has('ArrowUp') || keys.has('ArrowDown'))) {
        simRef.current.state.apOn = false // manual input disconnects AP
      }
    }, 16)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      clearInterval(iv)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // ---- HUD refresh at 25 Hz ----
  useEffect(() => {
    const iv = setInterval(() => {
      if (simRef.current.out) setHud({ ...simRef.current.out })
    }, 40)
    return () => clearInterval(iv)
  }, [])

  // ---- Engine/wind audio: pump live sim values at 30 Hz while sound is on ----
  useEffect(() => {
    if (!sound) return
    const audio = audioRef.current
    const iv = setInterval(() => {
      audio.update(simRef.current.state, simRef.current.out)
    }, 33)
    return () => clearInterval(iv)
  }, [sound])
  // stop audio on unmount
  useEffect(() => () => { audioRef.current?.stop() }, [])

  const toggleSound = () => {
    const audio = audioRef.current
    if (sound) { audio.stop(); setSound(false) }
    else { audio.start(); setSound(true) } // start() resumes the context (user gesture)
  }

  // ---- Tower ATC: run the controller ~2 Hz while the tower view is active ----
  useEffect(() => {
    if (view !== 'tower') return
    const csign = callsignFor(aircraft.name)
    const field = { rwy: from.rwy.id, from: from.code, to: to.code, city: from.city, dest: to.city }
    const iv = setInterval(() => {
      const sim = simRef.current
      atcMem.current = updateAtc(atcMem.current, sim.state, sim.out, csign, weather, field)
      setAtcLog(atcMem.current.log)
    }, 500)
    return () => clearInterval(iv)
  }, [view, aircraft.name, weather, from, to])

  // reset ATC transcript when the aircraft or departure changes
  useEffect(() => { atcMem.current = null; setAtcLog([]) }, [acKey, fromCode])

  // ---- options drawer: close on click-outside or Escape ----
  useEffect(() => {
    if (!optionsOpen) return
    const onDown = (e) => { if (!optionsRef.current?.contains(e.target)) setOptionsOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOptionsOpen(false) }
    // pointerdown (not click) so it closes before a control inside a re-opened
    // menu can be re-triggered; capture so it fires even over the Canvas
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [optionsOpen])

  const s = simRef.current.state
  const c = simRef.current.controls
  // live startup checklist (only meaningful when spawned cold & dark)
  const checklist = checklistProgress(s)
  // live leg progress: distance flown → distance-to-go / ETA / % along the route
  const leg = legProgress(from, to, s.flownNm, s.gsKt)

  return (
    <div className={`fly-page ${mode === 'deck' ? 'has-deck' : ''}`}>
      <div className="fly-topbar">
        {/* ROW 1 — essentials: home, what you fly, where, the weather */}
        <div className="fly-bar-row fly-bar-main">
          <a href="#/" className="fly-home" title="Back to the site" aria-label="Home">✈ Home</a>
          <label className="fly-field" title="Aircraft">
            <span className="fly-field-k">AC</span>
            <select value={acKey} onChange={(e) => setAcKey(e.target.value)} aria-label="Aircraft">
              {FAMILIES.map((f) => (
                <optgroup key={f.id} label={f.name}>
                  {getAircraftForFamily(f.id).filter((a) => a.model).map((a) => (
                    <option key={a.id} value={`${f.id}/${a.id}`}>{shortName(a.name)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="fly-field" title="Depart from">
            <span className="fly-field-k">FROM</span>
            <select value={fromCode} onChange={(e) => setFromCode(e.target.value)} aria-label="Departure airport">
              {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.city}</option>)}
            </select>
          </label>
          <span className="fly-arrow">→</span>
          <label className="fly-field" title="Fly to">
            <span className="fly-field-k">TO</span>
            <select value={toCode} onChange={(e) => setToCode(e.target.value)} aria-label="Destination airport">
              {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.city}</option>)}
            </select>
          </label>
          <label className="fly-field" title="Weather">
            <span className="fly-field-k">WX</span>
            <select value={wxKey} onChange={(e) => setWxKey(e.target.value)} aria-label="Weather">
              {Object.entries(WEATHER).map(([k, w]) => (
                <option key={k} value={k}>{w.name}</option>
              ))}
            </select>
          </label>
          <span className="fly-spacer" />
          {/* ⋯ options drawer: the secondary toggles, out of the way until wanted */}
          <div className="fly-options" ref={optionsRef}>
            <button
              className={`fly-reset fly-options-btn ${optionsOpen ? 'on' : ''}`}
              onClick={() => setOptionsOpen((v) => !v)}
              aria-haspopup="true" aria-expanded={optionsOpen}
              title="More options"
            >⋯ Options</button>
            {optionsOpen && (
              <div className="fly-drawer" role="menu">
                <div className="fly-drawer-sec">Controls</div>
                <div className="viewer-toggle fly-mode" style={{ margin: 0 }} title="Fly with the keyboard, or click the real flight-deck controls">
                  {MODES.map((m) => (
                    <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.name}</button>
                  ))}
                </div>
                <div className="fly-drawer-sec">Panels & audio</div>
                <button className={`fly-drawer-item ${sound ? 'on' : ''}`} onClick={toggleSound} title="Procedural engine + wind audio">
                  <span>♪ Engine &amp; wind sound</span><span className="fly-drawer-state">{sound ? 'ON' : 'OFF'}</span>
                </button>
                <button className={`fly-drawer-item ${showEngine ? 'on' : ''}`} onClick={() => setShowEngine((v) => !v)} title="Live engine + fuel panel">
                  <span>⚙ Engine &amp; fuel panel</span><span className="fly-drawer-state">{showEngine ? 'ON' : 'OFF'}</span>
                </button>
                <button className={`fly-drawer-item ${showBoard ? 'on' : ''}`} onClick={() => setShowBoard((v) => !v)} title="Real aircraft on the ground at your field + departure slot">
                  <span>🛫 Departures board</span><span className="fly-drawer-state">{showBoard ? 'ON' : 'OFF'}</span>
                </button>
                <div className="fly-drawer-sec">Start &amp; capture</div>
                <button className={`fly-drawer-item ${coldDark ? 'on' : ''}`} onClick={() => setColdDark((v) => !v)} title="Start cold & dark and run the real startup checklist">
                  <span>❄ Cold &amp; dark start</span><span className="fly-drawer-state">{coldDark ? 'ON' : 'READY'}</span>
                </button>
                <button className={`fly-drawer-item ${photo ? 'on' : ''}`} onClick={() => setPhoto((v) => !v)} title="Hide all UI for a clean cinematic view (H)">
                  <span>⛶ Photo mode</span><span className="fly-drawer-state">{photo ? 'ON' : 'OFF'}</span>
                </button>
                <div className="fly-drawer-div" />
                <button className="fly-drawer-item" onClick={hardReload} title="Clear cached assets and reload the latest version">
                  <span>↻ Clear cache &amp; reload</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2 — the camera views + reset, always one tap away */}
        <div className="fly-bar-row fly-bar-views">
          <div className="viewer-toggle" style={{ margin: 0 }}>
            {VIEWS.map((v) => (
              <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>{v.name}</button>
            ))}
          </div>
          {/* quick-access badges so the two most immersive toggles stay one tap
              away without opening the drawer */}
          <button className={`fly-quick ${photo ? 'on' : ''}`} onClick={() => setPhoto((v) => !v)} title="Hide all UI for a clean cinematic view (H)">⛶ Photo</button>
          <button className={`fly-quick ${sound ? 'on' : ''}`} onClick={toggleSound} title="Procedural engine + wind audio">{sound ? '♪ On' : '♪ Off'}</button>
          <span className="fly-spacer" />
          <span className="fly-blurb">{weather.blurb}</span>
          <button className="fly-reset" onClick={reset}>↺ Reset</button>
        </div>
      </div>

      <div className={`fly-stage ${photo ? 'photo' : ''}`}>
        <Suspense fallback={<div className="viewport-loading" style={{ height: '100%' }}>Loading world…</div>}>
          {view === 'globe' ? (
            <RouteGlobe from={from} to={to} progress={leg.frac} height="100%" cinematic />
          ) : flyable && (
            <FlightScene
              simRef={simRef}
              modelUrl={aircraft.model}
              dims={aircraft.dimensions}
              weather={weather}
              view={view}
              runwayHalfLen={rwy.halfLen}
              airport={from}
            />
          )}
        </Suspense>

        {/* route strip: live leg progress (globe view uses the richer HUD instead) */}
        {view !== 'globe' && (
        <div className="fly-route">
          <span className="fly-route-ap">{from.code}</span>
          <span className="fly-route-prog">
            <span className="fly-route-fill" style={{ width: `${(leg.frac * 100).toFixed(1)}%` }} />
            <span className="fly-route-plane" style={{ left: `${(leg.frac * 100).toFixed(1)}%` }}>✈</span>
          </span>
          <span className="fly-route-ap">{to.code}</span>
          <span className="fly-route-line">
            {leg.arrived
              ? <b className="arr">ARRIVED · {to.city}</b>
              : <>{Math.round(leg.toGo).toLocaleString()} nm to go · GS {Math.round(s.gsKt)} kt · ETE {isFinite(leg.etaH) ? `${Math.floor(leg.etaH)}h ${Math.round((leg.etaH % 1) * 60)}m` : '—'}</>}
          </span>
        </div>
        )}

        {/* cinematic moving-map HUD on the globe view */}
        {view === 'globe' && (
          <div className="globe-hud">
            <div className="globe-hud-ends">
              <div className="globe-hud-ap">
                <span className="globe-hud-code">{from.code}</span>
                <span className="globe-hud-city">{from.city}</span>
              </div>
              <span className="globe-hud-sep">✈ {Math.round(leg.frac * 100)}%</span>
              <div className="globe-hud-ap end">
                <span className="globe-hud-code">{to.code}</span>
                <span className="globe-hud-city">{to.city}</span>
              </div>
            </div>
            <div className="globe-hud-nums">
              <div><b>{Math.round(leg.flown).toLocaleString()}</b><span>nm flown</span></div>
              <div><b>{Math.round(leg.toGo).toLocaleString()}</b><span>nm to go</span></div>
              <div><b>{Math.round(s.gsKt)}</b><span>kt GS</span></div>
              <div><b>{Math.round((hud?.altFt || 0) / 100) * 100}</b><span>ft</span></div>
              <div><b>{leg.arrived ? 'ARR' : (isFinite(leg.etaH) ? `${Math.floor(leg.etaH)}h${String(Math.round((leg.etaH % 1) * 60)).padStart(2, '0')}` : '—')}</b><span>ETE</span></div>
            </div>
          </div>
        )}

        {/* startup checklist — shown when cold & dark until the flow is done */}
        {coldDark && !checklist.complete && (
          <div className="fly-checklist">
            <div className="fly-ckl-head">
              STARTUP · {checklist.done}/{checklist.total}
              <span className="fly-ckl-bar"><span style={{ width: `${(checklist.done / checklist.total) * 100}%` }} /></span>
            </div>
            <div className="fly-ckl-next">
              <b>NEXT · {checklist.nextPhase}</b>
              <span>{checklist.nextItem?.label} — {checklist.nextItem?.hint}</span>
            </div>
          </div>
        )}
        {coldDark && checklist.complete && s.onGround && s.v < 3 && (
          <div className="fly-checklist done">
            <b>✓ Checklist complete</b> — both engines running, cleared to roll.
          </div>
        )}

        {/* cockpit window framing */}
        {view === 'cockpit' && (
          <div className="deck-frame" aria-hidden>
            {/* windscreen posts: centre + two raked side posts frame the view */}
            <svg className="deck-svg" viewBox="0 0 100 60" preserveAspectRatio="none">
              {/* dark cockpit surround (everything outside the two windows) */}
              <path d="M0,0 H100 V60 H0 Z
                       M4,6 L44,4 L47,30 L8,34 Z
                       M56,4 L96,6 L92,34 L53,30 Z"
                    fill="#0a0c10" fillRule="evenodd" />
              {/* window frame highlights */}
              <path d="M4,6 L44,4 L47,30 L8,34 Z" fill="none" stroke="#2a2f38" strokeWidth="0.6" />
              <path d="M56,4 L96,6 L92,34 L53,30 Z" fill="none" stroke="#2a2f38" strokeWidth="0.6" />
            </svg>
            <div className="deck-post-c" />
            <div className="deck-glareshield" />
            <div className="deck-eyebrow" />
          </div>
        )}

        {/* passenger window frame — a rounded cabin-window vignette */}
        {view === 'wing' && (
          <div className="cabin-window" aria-hidden>
            <div className="cabin-window-hole" />
            <div className="cabin-window-shade" />
          </div>
        )}

        {/* control-tower cab framing: slanted glazing bars + console silhouette */}
        {view === 'tower' && (
          <div className="tower-cab" aria-hidden>
            <svg className="tower-cab-svg" viewBox="0 0 100 60" preserveAspectRatio="none">
              {/* raked tower glazing mullions */}
              <path d="M0,0 L20,60 M50,0 L50,60 M100,0 L80,60" stroke="#0c0f13" strokeWidth="1.1" fill="none" opacity="0.8" />
              {/* top sill shadow */}
              <rect x="0" y="0" width="100" height="4" fill="#0a0c10" />
            </svg>
            <div className="tower-console" />
          </div>
        )}

        {/* instruments — mounted in the glareshield in cockpit view */}
        <div className={`fly-hud ${view === 'cockpit' ? 'deck' : 'mini'}`}>
          <PFD out={hud} state={s} ac={ac} weatherName={weather.name} />
        </div>

        {/* Tower ATC radio panel */}
        {view === 'tower' && (
          <div className="fly-atc">
            <div className="fly-atc-head">
              <span className="fly-atc-dot" /> TOWER · {aircraft.name.replace(/^(Airbus|Boeing|Embraer) /, '')} · {s.phase.toUpperCase()}
            </div>
            <div className="fly-atc-log">
              {atcLog.length === 0 && <p className="fly-atc-empty">Radio quiet — throttle up for takeoff clearance.</p>}
              {atcLog.map((m) => (
                <p key={m.t} className={`fly-atc-msg ${m.from === 'PILOT' ? 'me' : ''}`}>
                  <b>{m.from}</b> {m.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* live engine + fuel panel */}
        {showEngine && (
          <div className="fly-engine">
            <EngineLive out={hud} state={s} ac={ac} engine={aircraft.engines?.[0]} />
          </div>
        )}

        {/* departures board: real ground traffic at the field + slot clearance */}
        {showBoard && (
          <AirportBoard
            airport={from}
            flights={flights}
            status={liveStatus}
            myCallsign={callsignFor(aircraft.name)}
            cleared={cleared}
            onCleared={() => setCleared(true)}
          />
        )}

        {/* conditions readout */}
        {hud && (
          <div className="fly-readout">
            <div><span>OAT</span><b>{hud.atm.oatC.toFixed(0)} °C</b></div>
            <div><span>ρ/ρ₀</span><b>{hud.atm.sigma.toFixed(2)}</b></div>
            <div><span>Wind</span><b>{Math.round(hud.wind.dirDeg)}° / {Math.round(hud.wind.spdKt)} kt</b></div>
            {hud.wind.shear > 0.35 && (
              <div><span>Shear</span><b className="on">LOW-LVL {Math.round(hud.wind.shear * 100)}%</b></div>
            )}
            <div><span>TAS</span><b>{Math.round(hud.tasKt)} kt</b></div>
            <div><span>Fuel</span><b>{Math.round(s.fuelKg)} kg</b></div>
            <div><span>Thrust</span><b>{Math.round(hud.T / 1000)} kN</b></div>
            <div><span>L / W</span><b>{(hud.L / hud.W).toFixed(2)}</b></div>
            <div><span>AP</span><b className={s.apOn ? 'on' : ''}>{s.apOn ? `ALT ${Math.round((s.apAlt || 0) / 0.3048)} ft` : 'OFF'}</b></div>
          </div>
        )}

        {/* takeoff coach — respects cold & dark (engines must be running first) */}
        {s.onGround && s.v < 3 && !s.crashed && !(coldDark && !checklist.complete) && (
          <div className="fly-coach">
            <b>{shortName(aircraft.name)}</b> lined up on {from.code} runway {from.rwy.id} — {weather.name}.
            {showBoard && !cleared && <> Hold position — request your <b>departure slot</b> on the board before rolling.</>}
            {(!s.eng1Started || !s.eng2Started) ? <> Start both engines before you can make takeoff thrust.</> :
              c.brakes ? <> Release the park brake <kbd>B</kbd>, then hold <kbd>W</kbd> for takeoff thrust. V<sub>1</sub> {Math.round(ac.v1 / 0.514444)} · V<sub>R</sub> {Math.round(ac.vr / 0.514444)} · V<sub>2</sub> {Math.round(ac.v2 / 0.514444)} kt.</> :
              <> Hold <kbd>W</kbd> for full thrust. V<sub>1</sub> {Math.round(ac.v1 / 0.514444)} · rotate <kbd>↑</kbd> at V<sub>R</sub> {Math.round(ac.vr / 0.514444)} · climb V<sub>2</sub> {Math.round(ac.v2 / 0.514444)} kt,
              gear up <kbd>G</kbd>, flaps up <kbd>V</kbd> as you accelerate.</>}
          </div>
        )}

        {s.crashed && (
          <div className="fly-crash">
            <h3>IMPACT</h3>
            <p>Touchdown at {s.touchdownVs} fpm{Math.abs(s.phi) > 0.25 ? ' with a wing low' : ''}. A firm landing is −200 to −400 fpm.</p>
            <button onClick={reset}>↺ Fly again (Enter)</button>
          </div>
        )}
        {!s.crashed && s.onGround && s.landedHard && (
          <div className="fly-coach warn">Hard landing: {s.touchdownVs} fpm — inspection required in the real world.</div>
        )}
      </div>

      {mode === 'deck' && <Cockpit simRef={simRef} ac={ac} />}

      <div className="fly-help">
        {mode === 'deck' && <span className="fly-mode-hint">Click the flight-deck controls below — keyboard still works too:</span>}
        <span><kbd>W</kbd>/<kbd>S</kbd> thrust</span>
        <span><kbd>↑</kbd><kbd>↓</kbd> pitch</span>
        <span><kbd>←</kbd><kbd>→</kbd> roll</span>
        <span><kbd>Q</kbd>/<kbd>E</kbd> rudder</span>
        <span><kbd>F</kbd>/<kbd>V</kbd> flaps</span>
        <span><kbd>G</kbd> gear</span>
        <span><kbd>B</kbd> brakes</span>
        <span><kbd>A</kbd> alt-hold AP</span>
        <span><kbd>C</kbd> camera</span>
        <span><kbd>H</kbd> photo</span>
        <span><kbd>Space</kbd> pause</span>
        <span className="dim">Throttle {Math.round(c.throttle * 100)}%</span>
      </div>
    </div>
  )
}
