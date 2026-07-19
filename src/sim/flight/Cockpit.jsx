import { useEffect, useReducer } from 'react'

/**
 * Interactive Airbus flight-deck replica for /fly.
 *
 * Three real panels — the glareshield FCU (autopilot/autothrust), the centre
 * pedestal (thrust levers, flap & speedbrake levers, gear, engine masters) and
 * the overhead (engine start, APU, fuel pumps, exterior lights) — plus a small
 * ECAM engine display. Every control writes straight into the shared mutable
 * sim (`simRef.current` — state + controls), so clicking a switch changes the
 * physics exactly like a keypress does, and the keyboard stays live alongside.
 *
 * The sim mutates outside React, so this panel force-refreshes at 12 Hz to keep
 * knob windows / annunciators showing live values without driving re-renders
 * from the 60 Hz flight loop.
 */

/* ------------------------------------------------------------------ */
/* primitive controls                                                  */
/* ------------------------------------------------------------------ */

// A two/three-position toggle switch (guarded look, click to advance).
function Toggle({ on, onClick, label, warn }) {
  return (
    <button className={`ck-toggle ${on ? 'on' : ''} ${warn ? 'warn' : ''}`} onClick={onClick} title={label}>
      <span className="ck-toggle-body"><span className="ck-toggle-nub" /></span>
      <span className="ck-toggle-lbl">{label}</span>
    </button>
  )
}

// A guarded push-button that lights when active (FCU / overhead style).
function PushLight({ on, onClick, top, bottom, cls = '' }) {
  return (
    <button className={`ck-push ${on ? 'lit' : ''} ${cls}`} onClick={onClick}>
      <span className="ck-push-top">{top}</span>
      {bottom && <span className="ck-push-bot">{bottom}</span>}
    </button>
  )
}

// A digital FCU value window with − / + steppers and a label.
function Window({ label, value, unit, onDec, onInc, managed }) {
  return (
    <div className="ck-win">
      <span className="ck-win-lbl">{label}</span>
      <div className="ck-win-row">
        <button className="ck-step" onClick={onDec} aria-label={`${label} down`}>–</button>
        <span className={`ck-win-val ${managed ? 'managed' : ''}`}>{managed ? '---' : value}</span>
        <button className="ck-step" onClick={onInc} aria-label={`${label} up`}>+</button>
      </div>
      <span className="ck-win-unit">{unit}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* ECAM upper: engine primary parameters                               */
/* ------------------------------------------------------------------ */
function EngGauge({ id, n1, egt, ff, master }) {
  const arc = (v, max) => {
    // 240° sweep, −120°..+120°
    const a = (-120 + Math.min(v / max, 1.08) * 240) * Math.PI / 180
    const r = 26
    return { x2: 34 + Math.cos(a) * r, y2: 40 + Math.sin(a) * r }
  }
  const p = arc(n1, 100)
  const over = egt > 900
  return (
    <div className={`ck-eng ${master ? '' : 'off'}`}>
      <svg viewBox="0 0 68 74" className="ck-eng-gauge">
        <circle cx="34" cy="40" r="26" fill="none" stroke="#20242c" strokeWidth="5" />
        <path
          d="M 12.5 58.5 A 26 26 0 1 1 55.5 58.5"
          fill="none" stroke="#2c313b" strokeWidth="5" strokeLinecap="round"
        />
        <line x1="34" y1="40" x2={p.x2} y2={p.y2} stroke={master ? '#d8ff3e' : '#4a4f59'} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="34" cy="40" r="3" fill="#2c313b" />
        <text x="34" y="20" fill="#7d828c" fontSize="8" textAnchor="middle" fontFamily="monospace">ENG{id}</text>
        <text x="34" y="46" fill={master ? '#e8eaed' : '#4a4f59'} fontSize="15" textAnchor="middle" fontFamily="monospace" fontWeight="700">{master ? Math.round(n1) : 'XX'}</text>
        <text x="34" y="56" fill="#7d828c" fontSize="7" textAnchor="middle" fontFamily="monospace">N1 %</text>
      </svg>
      <div className="ck-eng-rows">
        <div><span>EGT</span><b className={over ? 'hot' : ''}>{master ? `${egt}°` : '—'}</b></div>
        <div><span>FF</span><b>{master ? `${ff}` : '—'}</b></div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* the deck                                                            */
/* ------------------------------------------------------------------ */
export default function Cockpit({ simRef, ac }) {
  const [, tick] = useReducer((n) => n + 1, 0)
  useEffect(() => {
    const iv = setInterval(tick, 84) // ~12 Hz refresh of knob windows
    return () => clearInterval(iv)
  }, [])

  const sim = simRef.current
  if (!sim) return null
  const s = sim.state
  const c = sim.controls
  const out = sim.out

  // helper: mutate sim then request a paint
  const set = (fn) => { fn(); tick() }

  const flapNames = ac.flaps.map((f) => f.name)

  return (
    <div className="ck">
      {/* ================= GLARESHIELD FCU ================= */}
      <div className="ck-fcu">
        <div className="ck-fcu-side">
          <PushLight on={s.apOn} cls="ap"
            top="AP1" bottom={s.apOn ? 'ENGD' : 'OFF'}
            onClick={() => set(() => {
              s.apOn = !s.apOn
              if (s.apOn) { s.apAlt = s.h; if (!s.apHdgMode && !s.apVsMode) { /* keep modes */ } }
            })} />
          <PushLight on={s.athrOn} cls="ap"
            top="A/THR" bottom={s.athrOn ? 'ON' : 'OFF'}
            onClick={() => set(() => { s.athrOn = !s.athrOn })} />
        </div>

        <Window label="SPD" unit="KT" value={Math.round(s.fcuSpd)} managed={s.athrOn && false}
          onDec={() => set(() => { s.fcuSpd = Math.max(100, s.fcuSpd - 5) })}
          onInc={() => set(() => { s.fcuSpd = Math.min(400, s.fcuSpd + 5) })} />

        <div className="ck-fcu-hdg">
          <Window label="HDG" unit="°" value={String(Math.round(s.fcuHdg)).padStart(3, '0')}
            onDec={() => set(() => { s.fcuHdg = (s.fcuHdg + 355) % 360 })}
            onInc={() => set(() => { s.fcuHdg = (s.fcuHdg + 5) % 360 })} />
          <PushLight on={s.apHdgMode} cls="mode" top="HDG"
            onClick={() => set(() => { s.apHdgMode = !s.apHdgMode })} />
        </div>

        <Window label="ALT" unit="FT" value={s.fcuAlt.toLocaleString()}
          onDec={() => set(() => { s.fcuAlt = Math.max(0, s.fcuAlt - 1000) })}
          onInc={() => set(() => { s.fcuAlt = Math.min(41000, s.fcuAlt + 1000) })} />

        <div className="ck-fcu-hdg">
          <Window label="V/S" unit="FPM" value={(s.fcuVs > 0 ? '+' : '') + s.fcuVs}
            onDec={() => set(() => { s.fcuVs = Math.max(-6000, s.fcuVs - 500) })}
            onInc={() => set(() => { s.fcuVs = Math.min(6000, s.fcuVs + 500) })} />
          <PushLight on={s.apVsMode} cls="mode" top="V/S"
            onClick={() => set(() => { s.apVsMode = !s.apVsMode })} />
        </div>
      </div>

      <div className="ck-lower">
        {/* ================= OVERHEAD (exterior + systems) ================= */}
        <div className="ck-panel ck-ovhd">
          <div className="ck-panel-title">OVERHEAD</div>
          <div className="ck-grp">
            <span className="ck-grp-lbl">ENG START</span>
            <div className="ck-row">
              <Toggle on={s.eng1Master} label="ENG 1" onClick={() => set(() => { s.eng1Master = !s.eng1Master })} />
              <Toggle on={s.eng2Master} label="ENG 2" onClick={() => set(() => { s.eng2Master = !s.eng2Master })} />
              <Toggle on={s.engStartValve} label="IGN/ST" warn onClick={() => set(() => { s.engStartValve = !s.engStartValve })} />
            </div>
          </div>
          <div className="ck-grp">
            <span className="ck-grp-lbl">APU</span>
            <div className="ck-row">
              <Toggle on={s.apuMaster} label="MASTER" onClick={() => set(() => { s.apuMaster = !s.apuMaster; if (!s.apuMaster) s.apuRunning = false })} />
              <Toggle on={s.apuRunning} label="START" onClick={() => set(() => { if (s.apuMaster) s.apuRunning = !s.apuRunning })} />
            </div>
          </div>
          <div className="ck-grp">
            <span className="ck-grp-lbl">FUEL PUMPS</span>
            <div className="ck-row">
              <Toggle on={s.fuelPump1} label="TK 1" onClick={() => set(() => { s.fuelPump1 = !s.fuelPump1 })} />
              <Toggle on={s.fuelPump2} label="TK 2" onClick={() => set(() => { s.fuelPump2 = !s.fuelPump2 })} />
            </div>
          </div>
          <div className="ck-grp">
            <span className="ck-grp-lbl">EXT LT</span>
            <div className="ck-row">
              <Toggle on={s.beacon} label="BCN" onClick={() => set(() => { s.beacon = !s.beacon })} />
              <Toggle on={s.navLights} label="NAV" onClick={() => set(() => { s.navLights = !s.navLights })} />
              <Toggle on={s.strobe} label="STRB" onClick={() => set(() => { s.strobe = !s.strobe })} />
              <Toggle on={s.landingLights} label="LAND" onClick={() => set(() => { s.landingLights = !s.landingLights })} />
            </div>
          </div>
          <div className="ck-grp">
            <span className="ck-grp-lbl">SIGNS</span>
            <div className="ck-row">
              <Toggle on={s.seatbeltSign} label="SEAT BLT" onClick={() => set(() => { s.seatbeltSign = !s.seatbeltSign })} />
            </div>
          </div>
        </div>

        {/* ================= ECAM engine ================= */}
        <div className="ck-panel ck-ecam">
          <div className="ck-panel-title">E/WD · ENGINE</div>
          <div className="ck-ecam-engines">
            <EngGauge id={1} master={s.eng1Master} n1={out?.eng1.n1 ?? 0} egt={out?.eng1.egt ?? 0} ff={out?.eng1.ff ?? 0} />
            <EngGauge id={2} master={s.eng2Master} n1={out?.eng2.n1 ?? 0} egt={out?.eng2.egt ?? 0} ff={out?.eng2.ff ?? 0} />
          </div>
          <div className="ck-ecam-foot">
            <div><span>FOB</span><b>{Math.round(s.fuelKg).toLocaleString()} KG</b></div>
            <div><span>FLAP</span><b>{flapNames[s.flap]}</b></div>
            <div><span>GEAR</span><b className={s.gear ? '' : 'up'}>{s.gear ? 'DN' : 'UP'}</b></div>
          </div>
          <div className="ck-ecam-memo">
            {s.speedbrake > 0.02 && <span className="warn">SPD BRK</span>}
            {!s.eng1Master && <span className="warn">ENG 1 OUT</span>}
            {!s.eng2Master && <span className="warn">ENG 2 OUT</span>}
            {s.apOn && <span className="ok">AP {s.apHdgMode ? 'HDG' : 'WNG LVL'} {s.apVsMode ? 'V/S' : 'ALT'}</span>}
            {s.athrOn && <span className="ok">A/THR</span>}
            {s.apuRunning && <span className="ok">APU AVAIL</span>}
          </div>
        </div>

        {/* ================= PEDESTAL ================= */}
        <div className="ck-panel ck-pedestal">
          <div className="ck-panel-title">PEDESTAL</div>

          {/* thrust levers */}
          <div className="ck-lever-bank">
            <div className="ck-thr">
              <span className="ck-lever-lbl">THRUST</span>
              <input className="ck-thr-slider" type="range" min="0" max="100" step="1"
                value={Math.round(c.throttle * 100)}
                onChange={(e) => set(() => { c.throttle = e.target.value / 100 })}
                orient="vertical" />
              <span className="ck-thr-val">{Math.round(c.throttle * 100)}%</span>
              <div className="ck-thr-detents">
                <button onClick={() => set(() => { c.throttle = 1 })}>TOGA</button>
                <button onClick={() => set(() => { c.throttle = 0.85 })}>CLB</button>
                <button onClick={() => set(() => { c.throttle = 0 })}>IDLE</button>
              </div>
            </div>

            {/* flap lever: click to step 0..3 */}
            <div className="ck-flap">
              <span className="ck-lever-lbl">FLAP</span>
              <div className="ck-flap-gate">
                {flapNames.map((n, i) => (
                  <button key={n} className={c.flap === i ? 'on' : ''}
                    onClick={() => set(() => { c.flap = i })}>{n}</button>
                ))}
              </div>
            </div>

            {/* speedbrake lever */}
            <div className="ck-spd">
              <span className="ck-lever-lbl">SPD BRK</span>
              <input className="ck-spd-slider" type="range" min="0" max="100" step="1"
                value={Math.round(s.speedbrake * 100)}
                onChange={(e) => set(() => { c.speedbrake = e.target.value / 100; s.speedbrake = c.speedbrake })}
                orient="vertical" />
              <span className="ck-thr-val">{Math.round(s.speedbrake * 100)}%</span>
              <div className="ck-thr-detents">
                <button onClick={() => set(() => { c.speedbrake = 0; s.speedbrake = 0 })}>RET</button>
                <button onClick={() => set(() => { c.speedbrake = 1; s.speedbrake = 1 })}>FULL</button>
              </div>
            </div>
          </div>

          {/* gear + brakes */}
          <div className="ck-ped-row">
            <button className={`ck-gear ${c.gear ? 'down' : 'up'}`} onClick={() => set(() => { c.gear = !c.gear })}>
              <span className="ck-gear-wheel" /> GEAR {c.gear ? 'DN' : 'UP'}
            </button>
            <Toggle on={c.brakes} label="PARK BRK" warn onClick={() => set(() => { c.brakes = !c.brakes })} />
          </div>
        </div>
      </div>
    </div>
  )
}
