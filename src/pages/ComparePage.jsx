import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily, getAircraft } from '../data/index.js'
import CompareOverlay from '../components/CompareOverlay.jsx'

const COLOR_A = '#d8ff3e'
const COLOR_B = '#86b7ff'

const short = (name) => name.replace(/^(Airbus|Boeing) /, '')

function VariantSelect({ value, onChange, label, color }) {
  return (
    <label className="cmp-slot">
      <span className="cmp-slot-tag" style={{ color, borderColor: color }}>{label}</span>
      <select className="cmp-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {FAMILIES.map((f) => (
          <optgroup key={f.id} label={f.name}>
            {getAircraftForFamily(f.id).map((a) => (
              <option key={a.id} value={`${f.id}/${a.id}`}>{short(a.name)}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

// spec rows: label, getter, unit, decimals
const ROWS = [
  ['Length', (d) => d.lengthM, 'm', 2],
  ['Wingspan', (d) => d.wingspanM, 'm', 2],
  ['Wing area', (d) => d.wingAreaM2, 'm²', 1],
  ['Wing loading', (d) => d.mtowKg / d.wingAreaM2, 'kg/m²', 0],
  ['Height', (d) => d.heightM, 'm', 2],
  ['MTOW', (d) => d.mtowKg / 1000, 't', 1],
  ['Range', (d) => d.rangeKm, 'km', 0],
  ['Cruise', (d) => d.cruiseMach, 'Mach', 2],
  ['Ceiling', (d) => d.ceilingM, 'm', 0],
  ['Seats (typical)', (d) => d.paxTypical, '', 0],
]

function DeltaTable({ a, b }) {
  return (
    <table className="cmp-table">
      <thead>
        <tr>
          <th />
          <th style={{ color: COLOR_A }}>{short(a.name)}</th>
          <th style={{ color: COLOR_B }}>{short(b.name)}</th>
          <th>Δ B vs A</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(([label, get, unit, dp]) => {
          const va = get(a.dimensions)
          const vb = get(b.dimensions)
          const pct = va ? ((vb - va) / va) * 100 : 0
          const fmt = (v) => `${v.toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp })}${unit ? ` ${unit}` : ''}`
          return (
            <tr key={label}>
              <td className="k">{label}</td>
              <td>{fmt(va)}</td>
              <td>{fmt(vb)}</td>
              <td className={`d ${pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : ''}`}>
                {Math.abs(pct) < 0.5 ? '≈' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * Phase-3 comparison view: overlay any two variants at true relative scale
 * (plan + profile silhouettes from the same parametric shape math the
 * blueprints use) with a full spec delta table.
 */
export default function ComparePage() {
  const [selA, setSelA] = useState('a320/a320')
  const [selB, setSelB] = useState('a350/a350-900')

  const [famA, acA] = selA.split('/')
  const [famB, acB] = selB.split('/')
  const a = getAircraft(famA, acA)
  const b = getAircraft(famB, acB)
  if (!a || !b) return null

  return (
    <div>
      <Link to="/" className="back">← Home</Link>
      <div className="ac-head">
        <h1>Compare</h1>
      </div>
      <p className="lede">
        Overlay any two variants at true relative scale — noses aligned in plan,
        wheels on the same ground line in profile — and read the numbers side by
        side. The silhouettes are generated from each aircraft's real dimensions,
        the same way the blueprints are.
      </p>

      <div className="cmp-picker">
        <VariantSelect label="A" color={COLOR_A} value={selA} onChange={setSelA} />
        <button
          className="sim-chip"
          title="Swap A and B"
          onClick={() => { setSelA(selB); setSelB(selA) }}
        >
          ⇄ Swap
        </button>
        <VariantSelect label="B" color={COLOR_B} value={selB} onChange={setSelB} />
      </div>

      <div className="cmp-body">
        <div className="cmp-overlay">
          <CompareOverlay a={a} b={b} colorA={COLOR_A} colorB={COLOR_B} />
          <div className="cmp-legend">
            <Link to={`/family/${famA}/${a.id}`} style={{ color: COLOR_A }}>■ {short(a.name)} →</Link>
            <Link to={`/family/${famB}/${b.id}`} style={{ color: COLOR_B }}>■ {short(b.name)} →</Link>
          </div>
        </div>
        <DeltaTable a={a} b={b} />
      </div>

      <p className="model-note">
        Silhouettes use the archive's shared parametric proportions, so fine
        shape details are representative rather than exact — the dimensions,
        and therefore the relative sizes, are the real figures.
      </p>
    </div>
  )
}
