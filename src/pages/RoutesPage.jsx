import { useMemo, useState } from 'react'
import coastlines from '../live/coastlines.json'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'
import { isa } from '../sim/flight/model.js'

/**
 * /routes — a single-screen "can it fly this route?" experience.
 * Pick two airports (click the map or use the selects), set the average wind
 * component, and every variant in the archive is tested against the route.
 * Nothing navigates away; the only other view is THE MATH tab, which shows
 * the exact operational formulas with this route's numbers substituted:
 *
 *   1. Great-circle distance — haversine on the IUGG mean Earth radius.
 *   2. Cruise TAS — variant's cruise Mach × ISA speed of sound at FL350.
 *   3. Wind — equivalent still-air distance, ESAD = D · TAS/(TAS − Vw),
 *      the same correction flight planning uses today.
 *   4. Fit — ESAD vs published still-air range, margins under 10% flagged.
 */

const R_EARTH_KM = 6371.0088 // IUGG mean Earth radius
const KM_PER_NMI = 1.852
const CRUISE_ALT_M = 10668 // FL350 — common-basis cruise level for TAS

const AIRPORTS = [
  ['JFK', 'New York', 40.64, -73.78], ['LAX', 'Los Angeles', 33.94, -118.41],
  ['SFO', 'San Francisco', 37.62, -122.38], ['SEA', 'Seattle', 47.45, -122.31],
  ['ORD', 'Chicago', 41.97, -87.91], ['DFW', 'Dallas', 32.9, -97.04],
  ['ATL', 'Atlanta', 33.64, -84.43], ['MIA', 'Miami', 25.79, -80.29],
  ['YYZ', 'Toronto', 43.68, -79.63], ['MEX', 'Mexico City', 19.44, -99.07],
  ['BOG', 'Bogotá', 4.7, -74.15], ['GRU', 'São Paulo', -23.44, -46.47],
  ['EZE', 'Buenos Aires', -34.82, -58.54], ['SCL', 'Santiago', -33.39, -70.79],
  ['KEF', 'Reykjavík', 63.99, -22.61], ['LHR', 'London', 51.47, -0.45],
  ['CDG', 'Paris', 49.01, 2.55], ['FRA', 'Frankfurt', 50.03, 8.57],
  ['AMS', 'Amsterdam', 52.31, 4.76], ['MAD', 'Madrid', 40.47, -3.57],
  ['FCO', 'Rome', 41.8, 12.25], ['IST', 'Istanbul', 41.26, 28.74],
  ['CAI', 'Cairo', 30.12, 31.41], ['LOS', 'Lagos', 6.58, 3.32],
  ['JNB', 'Johannesburg', -26.14, 28.25], ['DXB', 'Dubai', 25.25, 55.36],
  ['DOH', 'Doha', 25.27, 51.61], ['DEL', 'Delhi', 28.57, 77.1],
  ['BOM', 'Mumbai', 19.09, 72.87], ['SIN', 'Singapore', 1.36, 103.99],
  ['BKK', 'Bangkok', 13.69, 100.75], ['HKG', 'Hong Kong', 22.31, 113.91],
  ['PVG', 'Shanghai', 31.14, 121.81], ['PEK', 'Beijing', 40.08, 116.58],
  ['HND', 'Tokyo', 35.55, 139.78], ['ICN', 'Seoul', 37.46, 126.44],
  ['SYD', 'Sydney', -33.95, 151.18], ['MEL', 'Melbourne', -37.67, 144.84],
  ['PER', 'Perth', -31.94, 115.97], ['AKL', 'Auckland', -37.01, 174.79],
  ['ANC', 'Anchorage', 61.17, -149.99], ['HNL', 'Honolulu', 21.32, -157.92],
]

const rad = (d) => (d * Math.PI) / 180

/** Haversine great-circle distance in km — the standard navigation formula. */
function greatCircleKm(a, b) {
  const dphi = rad(b[2] - a[2])
  const dlmb = rad(b[3] - a[3])
  const h =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(rad(a[2])) * Math.cos(rad(b[2])) * Math.sin(dlmb / 2) ** 2
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h))
}

/** Points along the great circle (spherical linear interpolation). */
function arcPoints(a, b, n = 72) {
  const toVec = (lat, lon) => [
    Math.cos(rad(lat)) * Math.cos(rad(lon)),
    Math.cos(rad(lat)) * Math.sin(rad(lon)),
    Math.sin(rad(lat)),
  ]
  const va = toVec(a[2], a[3])
  const vb = toVec(b[2], b[3])
  const omega = Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])))
  if (omega < 1e-6) return [[a[2], a[3]]]
  const pts = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega)
    const s2 = Math.sin(t * omega) / Math.sin(omega)
    const x = s1 * va[0] + s2 * vb[0]
    const y = s1 * va[1] + s2 * vb[1]
    const z = s1 * va[2] + s2 * vb[2]
    pts.push([(Math.asin(z) * 180) / Math.PI, (Math.atan2(y, x) * 180) / Math.PI])
  }
  return pts
}

const px = (lon) => (lon + 180) * 2
const py = (lat) => (90 - lat) * 2

/** SVG path for the arc, split where it crosses the antimeridian. */
function arcPath(a, b) {
  const pts = arcPoints(a, b)
  let d = ''
  let prev = null
  for (const [lat, lon] of pts) {
    const jump = prev && Math.abs(lon - prev[1]) > 180
    d += `${!prev || jump ? 'M' : 'L'}${px(lon).toFixed(1)},${py(lat).toFixed(1)}`
    prev = [lat, lon]
  }
  return d
}

const ALL_AIRCRAFT = FAMILIES.flatMap((f) =>
  getAircraftForFamily(f.id).map((a) => ({ ...a, familyName: f.name }))
)

export default function RoutesPage() {
  const [fromIata, setFrom] = useState('LHR')
  const [toIata, setTo] = useState('JFK')
  const [windKt, setWind] = useState(0) // + headwind, − tailwind
  const [tab, setTab] = useState('fit')

  const from = AIRPORTS.find((x) => x[0] === fromIata)
  const to = AIRPORTS.find((x) => x[0] === toIata)

  const distKm = useMemo(() => greatCircleKm(from, to), [from, to])
  const distNmi = distKm / KM_PER_NMI
  const soundMs = useMemo(() => isa(CRUISE_ALT_M).a, []) // ISA a at FL350

  const results = useMemo(() => {
    return ALL_AIRCRAFT.map((a) => {
      const tasKt = (a.dimensions.cruiseMach * soundMs) / 0.514444
      const esadKm = tasKt <= windKt ? Infinity : distKm * (tasKt / (tasKt - windKt))
      const margin = (a.dimensions.rangeKm - esadKm) / a.dimensions.rangeKm
      return { a, tasKt, esadKm, margin }
    }).sort((x, y) => y.margin - x.margin)
  }, [distKm, windKt, soundMs])

  const nCan = results.filter((r) => r.margin >= 0).length

  const onMapClick = (e) => {
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const { x, y } = pt.matrixTransform(svg.getScreenCTM().inverse())
    let best = null
    let bd = 1e9
    for (const ap of AIRPORTS) {
      const d = (px(ap[3]) - x) ** 2 + (py(ap[2]) - y) ** 2
      if (d < bd) { bd = d; best = ap }
    }
    if (!best || bd > 900) return
    if (best[0] === fromIata || best[0] === toIata) return
    // first click moves the destination; alt/shift-click moves the origin
    if (e.shiftKey || e.altKey) setFrom(best[0])
    else setTo(best[0])
  }

  const fmtKm = (v) => (Number.isFinite(v) ? `${Math.round(v).toLocaleString()} km` : '—')

  return (
    <div className="routes-page">
      <div className="routes-stage">
        <svg
          className="routes-map"
          viewBox="0 0 720 360"
          onClick={onMapClick}
          role="img"
          aria-label="World map: pick a route"
        >
          <rect x="0" y="0" width="720" height="360" fill="#0b0f14" />
          {coastlines.map((poly, i) => (
            <polyline
              key={i}
              points={poly.map(([lon, lat]) => `${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join(' ')}
              fill="none" stroke="#233041" strokeWidth="0.7"
            />
          ))}
          {AIRPORTS.map((ap) => {
            const active = ap[0] === fromIata || ap[0] === toIata
            return (
              <g key={ap[0]} className="routes-ap">
                <circle cx={px(ap[3])} cy={py(ap[2])} r={active ? 4 : 2.4}
                  fill={active ? '#3fb950' : '#3d5878'} stroke={active ? '#eaf2ff' : 'none'} strokeWidth="0.8" />
                <text x={px(ap[3]) + 5} y={py(ap[2]) + 3} fontSize="7.5"
                  fill={active ? '#eaf2ff' : '#59718f'} fontFamily="monospace">{ap[0]}</text>
              </g>
            )
          })}
          <path d={arcPath(from, to)} fill="none" stroke="#3fb950" strokeWidth="1.6" strokeDasharray="5 3" />
        </svg>

        <div className="routes-rail">
          <div className="routes-pick">
            <select value={fromIata} onChange={(e) => setFrom(e.target.value)} aria-label="Origin">
              {AIRPORTS.map((ap) => <option key={ap[0]} value={ap[0]}>{ap[0]} — {ap[1]}</option>)}
            </select>
            <button className="routes-swap" onClick={() => { setFrom(toIata); setTo(fromIata) }} title="Swap">⇄</button>
            <select value={toIata} onChange={(e) => setTo(e.target.value)} aria-label="Destination">
              {AIRPORTS.map((ap) => <option key={ap[0]} value={ap[0]}>{ap[0]} — {ap[1]}</option>)}
            </select>
          </div>

          <div className="routes-nums">
            <div><span>Great circle</span><b>{fmtKm(distKm)} · {Math.round(distNmi).toLocaleString()} nmi</b></div>
            <div><span>Avg wind</span><b>{windKt > 0 ? `${windKt} kt head` : windKt < 0 ? `${-windKt} kt tail` : 'calm'}</b></div>
            <div><span>Fleet fit</span><b>{nCan} of {results.length} variants</b></div>
          </div>
          <label className="routes-wind">
            <span>tail −150</span>
            <input type="range" min="-150" max="150" step="5" value={windKt} onChange={(e) => setWind(+e.target.value)} />
            <span>head +150</span>
          </label>

          <div className="viewer-toggle" style={{ margin: '10px 0' }}>
            <button className={tab === 'fit' ? 'on' : ''} onClick={() => setTab('fit')}>Fleet fit</button>
            <button className={tab === 'math' ? 'on' : ''} onClick={() => setTab('math')}>The math</button>
          </div>

          {tab === 'fit' ? (
            <div className="routes-list">
              {results.map(({ a, esadKm, margin }) => {
                const cls = margin >= 0.1 ? 'ok' : margin >= 0 ? 'tight' : 'no'
                const pct = Math.min(100, (esadKm / a.dimensions.rangeKm) * 100)
                return (
                  <div key={a.id} className={`routes-row ${cls}`}>
                    <span className="rr-name">{a.name.replace(/^(Airbus|Boeing|Embraer) /, '')}</span>
                    <span className="rr-bar"><i style={{ width: `${Number.isFinite(pct) ? pct : 100}%` }} /></span>
                    <span className="rr-val">
                      {margin >= 0 ? `+${Math.round(margin * 100)}%` : 'short'}
                    </span>
                  </div>
                )
              })}
              <p className="routes-note">
                Bar = route (wind-corrected) vs published still-air range. Green clears
                by ≥10%, amber is inside the margin airlines plan reserves around, red
                can't make it. Ranges are brochure figures at typical payload.
              </p>
            </div>
          ) : (
            <div className="routes-math">
              <h4>1 · Great-circle distance (haversine)</h4>
              <code>D = 2R·asin√(sin²(Δφ/2) + cosφ₁·cosφ₂·sin²(Δλ/2))</code>
              <p>R = 6371.0088 km (IUGG mean radius) → <b>D = {fmtKm(distKm)}</b> = {Math.round(distNmi).toLocaleString()} nmi. Exact for a sphere; within ±0.5% of WGS-84 geodesics.</p>
              <h4>2 · Cruise TAS from Mach</h4>
              <code>TAS = M · a,&nbsp;&nbsp;a = √(γRT) at FL350 (ISA)</code>
              <p>ISA at 10,668 m: T = {(isa(CRUISE_ALT_M).T).toFixed(1)} K → a = {soundMs.toFixed(1)} m/s = {(soundMs / 0.514444).toFixed(0)} kt. e.g. M0.82 → {(0.82 * soundMs / 0.514444).toFixed(0)} kt TAS.</p>
              <h4>3 · Wind: equivalent still-air distance</h4>
              <code>ESAD = D · TAS / (TAS − V<sub>w</sub>)</code>
              <p>The flight-planning correction: V<sub>w</sub> = {windKt} kt {windKt >= 0 ? 'headwind' : 'tailwind'} component. An M0.82 type sees this route as <b>{fmtKm(distKm * ((0.82 * soundMs / 0.514444) / ((0.82 * soundMs / 0.514444) - windKt)))}</b> of still air.</p>
              <h4>4 · Fit test</h4>
              <code>margin = (Range − ESAD) / Range</code>
              <p>Published ranges already assume typical passenger payload and reserves; we flag anything under a 10% margin, roughly the contingency + alternate fuel a dispatcher must protect.</p>
            </div>
          )}
        </div>
      </div>
      <p className="routes-hint">
        Click an airport to set the destination · shift-click to set the origin ·
        drag the wind slider to feel why westbound Atlantic crossings are the long way round.
      </p>
    </div>
  )
}
