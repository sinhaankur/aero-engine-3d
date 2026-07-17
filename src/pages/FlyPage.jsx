import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily, getAircraft } from '../data/index.js'
import { WEATHER, deriveAircraft, createState } from '../sim/flight/model.js'
import PFD from '../sim/flight/PFD.jsx'

const FlightScene = lazy(() => import('../three/FlightScene.jsx'))

const shortName = (name) => name.replace(/^(Airbus|Boeing|Embraer) /, '')

const VIEWS = [
  { id: 'cockpit', name: 'Cockpit' },
  { id: 'chase', name: 'Chase' },
  { id: 'tower', name: 'Tower' },
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
  const [view, setView] = useState('cockpit')
  const [hud, setHud] = useState(null)
  const [, forceTick] = useState(0)

  const [familyId, aircraftId] = acKey.split('/')
  const aircraft = getAircraft(familyId, aircraftId) || getAircraft('a320', 'a320')
  const flyable = aircraft.model

  const ac = useMemo(() => deriveAircraft(aircraft), [aircraft])
  const weather = WEATHER[wxKey]

  // Mutable sim container shared with the Canvas loop — no re-renders per frame.
  const simRef = useRef(null)
  if (simRef.current == null) {
    simRef.current = {
      state: createState(ac),
      ac,
      weather,
      controls: { pitch: 0, roll: 0, yaw: 0, throttle: 0, flap: 1, gear: true, brakes: false },
      out: null,
      paused: false,
    }
  }
  simRef.current.ac = ac
  simRef.current.weather = weather

  const reset = () => {
    simRef.current.state = createState(ac)
    simRef.current.controls = { pitch: 0, roll: 0, yaw: 0, throttle: 0, flap: 1, gear: true, brakes: false }
    simRef.current.out = null
    forceTick((n) => n + 1)
  }

  // variant change → fresh state
  useEffect(() => { reset() }, [acKey]) // eslint-disable-line react-hooks/exhaustive-deps

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
          s.apAlt = s.apOn ? s.h : null
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

  const s = simRef.current.state
  const c = simRef.current.controls

  return (
    <div className="fly-page">
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
        <div className="viewer-toggle" style={{ margin: 0 }}>
          {VIEWS.map((v) => (
            <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>{v.name}</button>
          ))}
        </div>
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
            />
          )}
        </Suspense>

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

        {/* takeoff coach */}
        {s.onGround && s.v < 3 && !s.crashed && (
          <div className="fly-coach">
            <b>{shortName(aircraft.name)}</b> ready — {weather.name}.
            Hold <kbd>W</kbd> for full thrust, rotate with <kbd>↑</kbd> at ~{Math.round(ac.vr / 0.514444)} kt,
            gear up <kbd>G</kbd>, flaps up <kbd>V</kbd> as you accelerate.
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

      <div className="fly-help">
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
