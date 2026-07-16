import { isaAtmosphere } from './atmosphere.js'

/**
 * The knowledge panels under the flow field:
 *  - VariablesLive: every variable in the model, its live value, and its role
 *  - GoodVsBad: what separates a good flight from a bad one, the failure
 *    modes, and the real-world odds — including this aircraft's own
 *    attributed safety record from the archive.
 */

const KT = 0.514444
const G = 9.81
const CL_MAX = 1.85

export function VariablesLive({ out, S, mtowKg, alt, isaDev, kt }) {
  const { rho } = isaAtmosphere(alt, isaDev)
  const vStall = Math.sqrt((2 * mtowKg * G) / (rho * S * CL_MAX)) / KT
  const rows = [
    ['α', 'Angle of attack (effective)', `${out.aoaEff.toFixed(1)}°`, 'How hard the wing turns the air. Lift rises with α — until the stall.'],
    ['V', 'True airspeed', `${Math.round(out.ktEff)} kt · ${out.vMs.toFixed(0)} m/s`, 'Lift grows with V² — double the speed, four times the lift.'],
    ['M', 'Mach number V/a', out.mach.toFixed(2), 'Compressibility limit; the roof of the envelope at altitude.'],
    ['h', 'Pressure altitude', `${(alt / 1000).toFixed(1)} km`, 'Sets pressure and temperature, and through them, density.'],
    ['T', 'Air temperature', `${out.tempC.toFixed(0)} °C (ISA ${isaDev >= 0 ? '+' : ''}${isaDev})`, 'Falls 6.5 °C/km. Hot air is thin air — the density-altitude trap.'],
    ['ρ', 'Air density p/(R·T)', `${out.rho.toFixed(3)} kg/m³`, 'The invisible lift multiplier: 1.225 at sea level, ~0.31 at 12 km.'],
    ['q', 'Dynamic pressure ½ρV²', `${out.qKpa.toFixed(1)} kPa`, 'The energy of the oncoming air — every aerodynamic force scales with it.'],
    ['S', 'Wing reference area', `${S} m²`, "This variant's real wing. The A310 differs from the A300; the A321 from the A320."],
    ['Cₗ', 'Lift coefficient', out.cl.toFixed(2), `How well the wing works at this α${out.iced ? ' — iced: ×0.75, stalls at 11°' : ''}. Collapses past the stall.`],
    ['L', 'Lift = q·S·Cₗ', `${out.tonnes.toFixed(1)} t`, 'The force holding the aircraft up, computed live.'],
    ['W', 'Weight (MTOW·g)', `${(mtowKg / 1000).toFixed(1)} t`, 'What lift must beat. L/W is the verdict:'],
    ['L/W', 'Lift over weight', `${out.pct.toFixed(0)}%`, 'Below 100%: descending or on the runway. Above: flying.'],
    ['Vs', 'Stall floor (here, at MTOW)', `${Math.round(vStall)} kt`, 'Slowest possible flight at this density — the left edge of the envelope.'],
    ['a', 'Speed of sound √(γRT)', `${out.soundMs.toFixed(0)} m/s`, 'Falls as it gets colder — which pulls the Mach roof down at altitude.'],
    ['Vmo/MMO', 'Speed limits', `350 kt IAS / M ~cruise+0.04`, 'Structural and compressibility roofs — the right edge of the envelope.'],
  ]
  return (
    <details className="sim-math">
      <summary>Every variable, live — the complete cast</summary>
      <div className="sim-math-rows">
        {rows.map(([sym, name, val, role]) => (
          <div className="sim-math-row" key={sym + name}>
            <span className="f">{sym} — {name}</span>
            <span className="v"><b>{val}</b> <span className="why">— {role}</span></span>
          </div>
        ))}
      </div>
    </details>
  )
}

// factor · what a good flight looks like · what can go wrong · the reality
const FACTORS = [
  ['Speed margin', 'Cruise sits comfortably between the stall floor and the Mach roof.', 'Too slow → stall. Loss of control in flight is the largest fatal-accident category in modern aviation.', 'The stall story — fly it above.'],
  ['Wind & gusts', 'A steady headwind is free lift on approach.', 'Gusts pulse the airspeed and lift; hard gusty landings force go-arounds.', 'Routine — crews train for it constantly.'],
  ['Wind shear / microburst', 'Detected by radar and avoided; escape maneuver memorised.', 'Sudden headwind loss near the ground steals lift with no altitude to recover.', 'A leading killer before ~1985 (Delta 191); onboard detection + training made it rare.'],
  ['Storm cells', 'Deviated around by 20+ nautical miles.', 'Severe turbulence, hail, lightning, extreme up/downdrafts.', 'Weather is a contributing factor in roughly a quarter of accidents (public NTSB/FAA figures).'],
  ['Icing', 'Anti-ice keeps the leading edges clean.', 'Ice distorts the wing: ~25% less lift, stall at 11° instead of 15°.', 'Well understood; deadly mainly when protection fails or is off.'],
  ['Hot & high', 'Performance computed before every takeoff; speeds and runway adjusted.', 'Thin air = less lift and less thrust at the same speeds — runway overrun risk.', 'Managed daily at airports like Denver, Mexico City, Johannesburg.'],
  ['Loading', 'Weight and balance inside the envelope, always.', 'Overweight or misloaded CG changes stall speed and control authority.', 'Not modelled here — but checked before every single flight.'],
]

export function GoodVsBad({ aircraft }) {
  const s = aircraft?.safety
  return (
    <details className="sim-math">
      <summary>Good flight vs bad flight — the problems, and the real odds</summary>
      <div className="sim-math-rows">
        {FACTORS.map(([f, good, bad, real]) => (
          <div className="sim-math-row sim-factor" key={f}>
            <span className="f">{f}</span>
            <span className="v">
              <b>Good:</b> {good} <b>Problem:</b> {bad} <span className="why">{real}</span>
            </span>
          </div>
        ))}
        <div className="sim-math-row">
          <span className="f">The actual odds</span>
          <span className="v">
            Commercial aviation runs at roughly <b>one fatal accident per 10+ million
            flights</b> (public IATA/ASN industry figures) — per kilometre, the safest way
            humans travel. Everything this simulator lets you break is something the real
            system defends in layers: training, envelope protection, weather radar,
            anti-ice, performance calculations.
          </span>
        </div>
        {s && (
          <div className="sim-math-row">
            <span className="f">This aircraft's record</span>
            <span className="v">
              {s.hullLossRate != null
                ? <><b>{s.hullLossRate} hull losses per million departures</b>, </>
                : null}
              {s.totalLosses != null ? <>{s.totalLosses} hull-loss events, </> : null}
              {s.fatalEvents != null ? <>{s.fatalEvents} fatal, </> : null}
              lifetime — risk assessed <b>{s.risk}</b>.{' '}
              <span className="why">{s.notes} Sources: {s.sources?.join('; ')}.</span>
            </span>
          </div>
        )}
      </div>
    </details>
  )
}
