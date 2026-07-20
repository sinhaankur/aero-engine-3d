import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily, getAircraft } from '../data/index.js'
import { WEATHER, deriveAircraft, createState, runwayFor } from '../sim/flight/model.js'
import { AIRPORTS, AIRPORT_BY_CODE, distanceNm, bearingDeg, etaHours } from '../data/airports.js'
import PFD from '../sim/flight/PFD.jsx'
import Cockpit from '../sim/flight/Cockpit.jsx'
import { updateAtc, callsignFor } from '../sim/flight/atc.js'
import { FlightAudio } from '../sim/flight/audio.js'
import EngineLive from '../sim/flight/EngineLive.jsx'
import { checklistProgress } from '../sim/flight/procedures.js'

const FlightScene = lazy(() => import('../three/FlightScene.jsx'))

const shortName = (name) => name.replace(/^(Airbus|Boeing|Embraer) /, '')

const VIEWS = [
  { id: 'cockpit', name: 'Cockpit' },
  { id: 'chase', name: 'Chase' },
  { id: 'tower', name: 'Tower' },
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
  const audioRef = useRef(null)
  if (audioRef.current == null) audioRef.current = new FlightAudio()
  const [, forceTick] = useState(0)

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
    // 60 Hz key → control mapping (model applies its own smoothing)
    const iv = setInterval(() => {
      const c = simRef.current.controls
      c.pitch = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)
      c.roll = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0)
      c.yaw = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0)
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

  const s = simRef.current.state
  const c = simRef.current.controls
  // live startup checklist (only meaningful when spawned cold & dark)
  const checklist = checklistProgress(s)

  return (
    <div className={`fly-page ${mode === 'deck' ? 'has-deck' : ''}`}>
      <div className="fly-topbar">
        <select value={acKey} onChange={(e) => setAcKey(e.target.value)} aria-label="Aircraft">
          {FAMILIES.map((f) => (
            <optgroup key={f.id} label={f.name}>
              {getAircraftForFamily(f.id).filter((a) => a.model).map((a) => (
                <option key={a.id} value={`${f.id}/${a.id}`}>{shortName(a.name)}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={wxKey} onChange={(e) => setWxKey(e.target.value)} aria-label="Weather">
          {Object.entries(WEATHER).map(([k, w]) => (
            <option key={k} value={k}>{w.name}</option>
          ))}
        </select>
        <select value={fromCode} onChange={(e) => setFromCode(e.target.value)} aria-label="Departure airport" title="Depart from">
          {AIRPORTS.map((a) => <option key={a.code} value={a.code}>◐ {a.code} · {a.city}</option>)}
        </select>
        <span className="fly-arrow">→</span>
        <select value={toCode} onChange={(e) => setToCode(e.target.value)} aria-label="Destination airport" title="Fly to">
          {AIRPORTS.map((a) => <option key={a.code} value={a.code}>◑ {a.code} · {a.city}</option>)}
        </select>
        <div className="viewer-toggle" style={{ margin: 0 }}>
          {VIEWS.map((v) => (
            <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>{v.name}</button>
          ))}
        </div>
        <div className="viewer-toggle fly-mode" style={{ margin: 0 }} title="Fly with the keyboard, or click the real flight-deck controls">
          {MODES.map((m) => (
            <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.name}</button>
          ))}
        </div>
        <button className={`fly-reset ${sound ? 'on' : ''}`} onClick={toggleSound} title="Procedural engine + wind audio">
          {sound ? '♪ Sound on' : '♪ Sound off'}
        </button>
        <button className={`fly-reset ${showEngine ? 'on' : ''}`} onClick={() => setShowEngine((v) => !v)} title="Live engine + fuel panel">
          ⚙ Engine
        </button>
        <button className={`fly-reset ${coldDark ? 'on' : ''}`} onClick={() => setColdDark((v) => !v)} title="Start cold & dark and run the real startup checklist">
          {coldDark ? '❄ Cold & dark' : '✈ Ready'}
        </button>
        <button className="fly-reset" onClick={reset}>↺ Reset</button>
        <span className="fly-blurb">{weather.blurb}</span>
      </div>

      <div className="fly-stage">
        <Suspense fallback={<div className="viewport-loading" style={{ height: '100%' }}>Loading world…</div>}>
          {flyable && (
            <FlightScene
              simRef={simRef}
              modelUrl={aircraft.model}
              dims={aircraft.dimensions}
              weather={weather}
              view={view}
              runwayHalfLen={rwy.halfLen}
            />
          )}
        </Suspense>

        {/* route strip: real departure → destination */}
        <div className="fly-route">
          <span className="fly-route-ap">{from.code}</span>
          <span className="fly-route-city">{from.city} · RWY {from.rwy.id} · {from.rwy.lenM.toLocaleString()} m</span>
          <span className="fly-route-line">— {route.nm.toLocaleString()} nm · {route.brg}° · ~{route.eta.toFixed(1)} h →</span>
          <span className="fly-route-ap">{to.code}</span>
          <span className="fly-route-city">{to.city}</span>
        </div>

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
          <>
            <div className="cockpit-pillar left" />
            <div className="cockpit-pillar right" />
            <div className="cockpit-glareshield" />
          </>
        )}

        {/* instruments */}
        <div className={`fly-hud ${view === 'cockpit' ? 'big' : 'mini'}`}>
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

        {/* conditions readout */}
        {hud && (
          <div className="fly-readout">
            <div><span>OAT</span><b>{hud.atm.oatC.toFixed(0)} °C</b></div>
            <div><span>ρ/ρ₀</span><b>{hud.atm.sigma.toFixed(2)}</b></div>
            <div><span>Wind</span><b>{Math.round(hud.wind.dirDeg)}° / {Math.round(hud.wind.spdKt)} kt</b></div>
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
        <span><kbd>Space</kbd> pause</span>
        <span className="dim">Throttle {Math.round(c.throttle * 100)}%</span>
      </div>
    </div>
  )
}
