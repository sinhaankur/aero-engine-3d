import { isaAtmosphere } from './atmosphere.js'

/**
 * The flight envelope, live: for the selected aircraft, which combinations of
 * (true airspeed, altitude) can sustain level flight at MTOW — and where the
 * current sim settings sit inside (or outside) that region.
 *
 *  - left edge  = stall floor: V where ½·ρ·V²·S·Cl_max = MTOW·g
 *  - right edge = the lower of the Vmo structural limit (constant IAS, so it
 *    leans right with altitude as TAS) and the MMO Mach roof (leans left as
 *    the speed of sound falls with temperature)
 *  - top        = certified service ceiling from the data
 *
 * Everything recomputes from the ISA deviation, so a hot day visibly shrinks
 * the envelope — the "which temperature does it work at" answer.
 */

const KT = 0.514444
const G = 9.81
const CL_MAX = 1.85       // the sim's Cl curve at the 15° stall (0.11·15 + 0.2)
const VMO_IAS_KT = 350    // structural speed limit, indicated
const RHO0 = 1.225

const X_MIN = 80, X_MAX = 560   // kt TAS
const W = 320, H = 190
const ML = 34, MR = 10, MT = 12, MB = 24

export default function FlightEnvelope({ aircraft, kt, alt, isaDev }) {
  const d = aircraft.dimensions
  const S = d.wingAreaM2
  const weightN = d.mtowKg * G
  // MMO sits a few hundredths above cruise Mach across the fleet (A320 0.82,
  // 737NG 0.82, A380 0.89) — a good nominal rule from the data we carry
  const mmo = d.cruiseMach + 0.04
  const ceilM = d.ceilingM

  const yMax = Math.max(13000, ceilM + 500)
  const px = (v) => ML + ((v - X_MIN) / (X_MAX - X_MIN)) * (W - ML - MR)
  const py = (h) => MT + (1 - h / yMax) * (H - MT - MB)

  const vStall = (h) => {
    const { rho } = isaAtmosphere(h, isaDev)
    return Math.sqrt((2 * weightN) / (rho * S * CL_MAX)) / KT   // kt TAS
  }
  const vMax = (h) => {
    const { rho, soundMs } = isaAtmosphere(h, isaDev)
    const vmoTas = VMO_IAS_KT / Math.sqrt(rho / RHO0)
    const machTas = (mmo * soundMs) / KT
    return Math.min(vmoTas, machTas)
  }

  // walk the boundary: stall floor up the left, limits down the right
  const left = []
  const right = []
  for (let h = 0; h <= ceilM; h += 250) {
    const lo = vStall(h)
    const hi = vMax(h)
    if (lo >= hi) break // aerodynamic ceiling reached before certified one
    left.push([px(Math.max(lo, X_MIN)), py(h)])
    right.push([px(Math.min(hi, X_MAX)), py(h)])
  }
  if (!left.length) return null
  const outline = [...left, ...right.reverse()]
  const path = outline.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z'

  // where the current settings sit
  const lo = vStall(alt)
  const hi = vMax(alt)
  const inside = alt <= ceilM && kt >= lo && kt <= hi
  let verdict
  if (inside) verdict = { label: `WORKS · floor ${Math.round(lo)} kt · roof ${Math.round(hi)} kt here`, color: 'var(--accent)' }
  else if (alt > ceilM) verdict = { label: `ABOVE CEILING · certified to ${(ceilM / 1000).toFixed(1)} km`, color: '#ff9d4d' }
  else if (kt < lo) verdict = { label: `TOO SLOW · needs ≥ ${Math.round(lo)} kt at ${(alt / 1000).toFixed(1)} km`, color: '#ff9d4d' }
  else verdict = { label: `PAST THE MACH ROOF · M ${mmo.toFixed(2)} limit`, color: '#ff9d4d' }

  return (
    <div className="sim-env">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Flight envelope: altitude vs speed">
        {/* grid + axes */}
        {[0, 4000, 8000, 12000].map((h) => (
          <g key={h}>
            <line x1={ML} x2={W - MR} y1={py(h)} y2={py(h)} stroke="#20242c" strokeWidth="0.6" />
            <text x={ML - 4} y={py(h) + 3} fontSize="7" fill="#7d828c" textAnchor="end">{h / 1000}</text>
          </g>
        ))}
        {[100, 200, 300, 400, 500].map((v) => (
          <g key={v}>
            <line x1={px(v)} x2={px(v)} y1={MT} y2={H - MB} stroke="#20242c" strokeWidth="0.6" />
            <text x={px(v)} y={H - MB + 10} fontSize="7" fill="#7d828c" textAnchor="middle">{v}</text>
          </g>
        ))}
        <text x={W - MR} y={H - 4} fontSize="7" fill="#4a4f59" textAnchor="end">kt TAS</text>
        <text x={6} y={MT + 6} fontSize="7" fill="#4a4f59">km</text>

        {/* the region where flight works */}
        <path d={path} fill="rgba(216,255,62,0.09)" stroke="none" />
        <polyline points={left.map((p) => p.join(',')).join(' ')} fill="none" stroke="#ff9d4d" strokeWidth="1.2" strokeDasharray="3 2" />
        <polyline points={right.map((p) => p.join(',')).join(' ')} fill="none" stroke="#86b7ff" strokeWidth="1.2" />
        <line x1={left[left.length - 1][0]} y1={left[left.length - 1][1]} x2={right[0][0]} y2={right[0][1]} stroke="#7d828c" strokeWidth="1" strokeDasharray="2 2" />

        {/* current sim state */}
        <circle cx={px(Math.min(Math.max(kt, X_MIN), X_MAX))} cy={py(Math.min(alt, yMax))} r="4"
          fill={inside ? '#d8ff3e' : '#ff9d4d'} stroke="#08090b" strokeWidth="1.5" />
      </svg>
      <div className="sim-env-cap" style={{ color: verdict.color }}>{verdict.label}</div>
      <div className="sim-env-legend">
        <span style={{ color: '#ff9d4d' }}>┅ stall floor</span>
        <span style={{ color: '#86b7ff' }}>— Vmo / Mach roof</span>
        <span style={{ color: '#7d828c' }}>┅ ceiling</span>
      </div>
    </div>
  )
}
