import { useMemo, useState } from 'react'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'

/**
 * Trade-space scatter: every variant in the archive plotted on selectable
 * engineering axes. Engineers understand a design by where it sits in the
 * population — outliers become questions. All derived quantities use the
 * real formulas (AR = b²/S, W/S = MTOW/S, T/W = ΣT/(MTOW·g)).
 */

const G = 9.80665
const engCount = (a) => (a.familyId === 'a380' ? 4 : 2)

export const AXES = {
  wingLoading: { label: 'Wing loading', unit: 'kg/m²', fn: (a) => a.dimensions.mtowKg / a.dimensions.wingAreaM2 },
  aspectRatio: { label: 'Aspect ratio b²/S', unit: '', fn: (a) => a.dimensions.wingspanM ** 2 / a.dimensions.wingAreaM2 },
  thrustWeight: { label: 'Thrust / weight', unit: '', fn: (a) => (Math.max(...a.engines.map((e) => e.thrustKn)) * 1000 * engCount(a)) / (a.dimensions.mtowKg * G) },
  rangeKm: { label: 'Range', unit: 'km', fn: (a) => a.dimensions.rangeKm },
  mtowT: { label: 'MTOW', unit: 't', fn: (a) => a.dimensions.mtowKg / 1000 },
  span: { label: 'Wingspan', unit: 'm', fn: (a) => a.dimensions.wingspanM },
  pax: { label: 'Seats (typical)', unit: '', fn: (a) => a.dimensions.paxTypical },
  mach: { label: 'Cruise Mach', unit: '', fn: (a) => a.dimensions.cruiseMach },
}

const FAM_COLORS = {
  a320: '#58a6ff', b737: '#f0883e', e2: '#d2a8ff', a220: '#79c0ff',
  a330: '#3fb950', a350: '#e3b341', a380: '#f85149', a300: '#8b949e',
}

const ALL = FAMILIES.flatMap((f) => getAircraftForFamily(f.id).map((a) => ({ ...a, famName: f.name })))
const short = (n) => n.replace(/^(Airbus|Boeing|Embraer) /, '')

const W = 660, H = 400, ML = 58, MR = 16, MT = 16, MB = 42

function scaleOf(vals) {
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = (hi - lo) * 0.07 || 1
  return [lo - pad, hi + pad]
}
const ticks = ([lo, hi]) => Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2))

export default function TradeSpace({ selA, selB, onPick }) {
  const [xKey, setX] = useState('wingLoading')
  const [yKey, setY] = useState('rangeKm')
  const [hover, setHover] = useState(null)

  const pts = useMemo(() => ALL.map((a) => ({ a, x: AXES[xKey].fn(a), y: AXES[yKey].fn(a) })), [xKey, yKey])
  const sx = scaleOf(pts.map((p) => p.x))
  const sy = scaleOf(pts.map((p) => p.y))
  const X = (v) => ML + ((v - sx[0]) / (sx[1] - sx[0])) * (W - ML - MR)
  const Y = (v) => H - MB - ((v - sy[0]) / (sy[1] - sy[0])) * (H - MT - MB)

  const key = (a) => `${a.familyId}/${a.id}`

  return (
    <div className="tspace">
      <div className="tspace-head">
        <h2 className="section-title" style={{ margin: 0 }}>Trade space — all {ALL.length} variants</h2>
        <label>X <select value={xKey} onChange={(e) => setX(e.target.value)}>
          {Object.entries(AXES).map(([k, ax]) => <option key={k} value={k}>{ax.label}</option>)}
        </select></label>
        <label>Y <select value={yKey} onChange={(e) => setY(e.target.value)}>
          {Object.entries(AXES).map(([k, ax]) => <option key={k} value={k}>{ax.label}</option>)}
        </select></label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="tspace-plot" role="img" aria-label="Variant trade-space scatter plot">
        <rect x="0" y="0" width={W} height={H} fill="#0b0f14" rx="10" />
        {ticks(sx).map((t, i) => (
          <g key={`x${i}`}>
            <line x1={X(t)} x2={X(t)} y1={MT} y2={H - MB} stroke="#1c2634" strokeWidth="0.7" />
            <text x={X(t)} y={H - MB + 16} fill="#59718f" fontSize="10" textAnchor="middle" fontFamily="monospace">{fmt(t)}</text>
          </g>
        ))}
        {ticks(sy).map((t, i) => (
          <g key={`y${i}`}>
            <line x1={ML} x2={W - MR} y1={Y(t)} y2={Y(t)} stroke="#1c2634" strokeWidth="0.7" />
            <text x={ML - 6} y={Y(t) + 3} fill="#59718f" fontSize="10" textAnchor="end" fontFamily="monospace">{fmt(t)}</text>
          </g>
        ))}
        <text x={(ML + W - MR) / 2} y={H - 6} fill="#8b949e" fontSize="11" textAnchor="middle" fontFamily="monospace">
          {AXES[xKey].label}{AXES[xKey].unit && ` (${AXES[xKey].unit})`}
        </text>
        <text x={14} y={(MT + H - MB) / 2} fill="#8b949e" fontSize="11" textAnchor="middle" fontFamily="monospace"
          transform={`rotate(-90 14 ${(MT + H - MB) / 2})`}>
          {AXES[yKey].label}{AXES[yKey].unit && ` (${AXES[yKey].unit})`}
        </text>
        {pts.map(({ a, x, y }) => {
          const isA = key(a) === selA
          const isB = key(a) === selB
          const hot = hover === key(a) || isA || isB
          return (
            <g key={a.id} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(key(a))} onMouseLeave={() => setHover(null)}
              onClick={(e) => onPick?.(key(a), e.shiftKey ? 'A' : 'B')}>
              <circle cx={X(x)} cy={Y(y)} r={hot ? 7 : 4.5}
                fill={FAM_COLORS[a.familyId] || '#8b949e'}
                fillOpacity={hot ? 1 : 0.75}
                stroke={isA ? '#e3b341' : isB ? '#3fb950' : hot ? '#eaf2ff' : 'none'} strokeWidth="1.6" />
              {hot && (
                <text x={X(x)} y={Y(y) - 11} fill="#eaf2ff" fontSize="10.5" textAnchor="middle" fontFamily="monospace">
                  {short(a.name)} · {fmt(x)} / {fmt(y)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="routes-note">
        Each dot is a variant, coloured by family — <b style={{ color: '#e3b341' }}>A</b> and{' '}
        <b style={{ color: '#3fb950' }}>B</b> ringed. Click a dot to load it as B, shift-click for A.
        Derived axes use the real formulas: AR = b²/S, wing loading = MTOW/S, T/W = ΣT/(MTOW·g).
      </p>
    </div>
  )
}
