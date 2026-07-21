import { useEffect, useRef, useState } from 'react'

/**
 * Live, ZOOMABLE turbofan cutaway for /fly — a working engine you can inspect.
 *
 * The cross-section is drawn to scale from the real engine's fan diameter +
 * bypass ratio, with every major component present: intake, fan, booster (LPC),
 * high-pressure compressor stage rows, combustor with fuel nozzles, HP and LP
 * turbine blade rows, the two concentric spools (N1 shaft inside N2), bearings,
 * bypass duct and exhaust. Zoom in (slider / scroll / +−) and progressively more
 * detail + labels appear: at low zoom you see the schematic, zoomed in you see
 * individual blade rows, nozzles, shafts and per-component temps/pressures.
 *
 * The fan and spools spin at the live N1/N2, gas flow speeds up with N1, and the
 * combustor glows with EGT — all from the sim's per-engine readout.
 */

const VW = 520          // native SVG coordinate width
const VH = 260
const cx0 = VW / 2
const cy0 = VH / 2

function Gauge({ label, value, unit, frac, warn }) {
  return (
    <div className={`el-gauge ${warn ? 'warn' : ''}`}>
      <span className="el-gauge-l">{label}</span>
      <span className="el-gauge-v">{value}<i>{unit}</i></span>
      <span className="el-gauge-bar"><span style={{ width: `${Math.max(0, Math.min(100, frac * 100))}%` }} /></span>
    </div>
  )
}

export default function EngineLive({ out, state, ac, engine }) {
  const [, tick] = useState(0)
  const [zoom, setZoom] = useState(1)      // 1 = whole engine, up to 6 = blade detail
  const [focus, setFocus] = useState(0.5)  // 0..1 axial focus point to zoom toward
  const spin = useRef(0)
  const spin2 = useRef(0)
  const raf = useRef(0)
  const last = useRef(performance.now())

  useEffect(() => {
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last.current) / 1000); last.current = t
      const n1 = out ? Math.max(0.04, out.n1 / 100) : 0.04
      const n2 = out?.eng1?.n2 ? out.eng1.n2 / 100 : 0.3
      spin.current = (spin.current + n1 * 720 * dt) % 360
      spin2.current = (spin2.current + n2 * 900 * dt) % 360
      tick((n) => (n + 1) & 2047)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [out])

  const bpr = engine?.bypassRatio || 5
  const fanDia = engine?.fanDiameterM || 1.7
  const nacR = Math.min(96, 40 + fanDia * 20)
  const bypassFrac = Math.min(0.62, 0.28 + (bpr / 20) * 0.5)
  const coreR = nacR * (1 - bypassFrac)
  const noseX = 60
  const tailX = VW - 46
  const len = tailX - noseX
  const ax = (f) => noseX + len * f          // axial position at fraction f
  const cy = cy0

  const e1 = out?.eng1 || {}
  const n1 = e1.n1 ?? 0
  const n2 = e1.n2 ?? 0
  const egt = e1.egt ?? 0
  const ffPerEng = e1.ff ?? 0
  const ffTotal = ffPerEng * (ac?.engineCount || 2)
  const fuel = state?.fuelKg ?? 0
  const fuel0 = (ac?.mass || 60000) * 0.12
  const enduranceH = ffTotal > 1 ? fuel / ffTotal : 0
  const load = n1 / 100
  const flowSpeed = 0.4 + load * 2.4
  const oatC = out?.atm?.oatC ?? 15
  const glow = Math.max(0.04, Math.min(0.7, (egt - 380) / 700))

  // component axial layout (fractions along the core) — labelled + live values
  const stages = [
    ['FAN', 0.05, Math.round(oatC + load * 25), (1 + load * 0.6).toFixed(1)],
    ['LPC', 0.22, Math.round(oatC + load * 120), (1 + load * 3).toFixed(1)],
    ['HPC', 0.40, Math.round(oatC + load * 430), (1 + load * 28).toFixed(0)],
    ['BURN', 0.56, Math.round(700 + load * 1150), (1 + load * 26).toFixed(0)],
    ['HPT', 0.70, egt + Math.round(load * 120), (1 + load * 9).toFixed(0)],
    ['LPT', 0.85, egt, (1 + load * 2).toFixed(1)],
  ]

  // zoom → SVG viewBox that scales toward the focus point (keep cy centred)
  const z = zoom
  const vbW = VW / z, vbH = VH / z
  const fx = ax(focus)
  const vbX = Math.max(0, Math.min(VW - vbW, fx - vbW / 2))
  const vbY = Math.max(0, Math.min(VH - vbH, cy - vbH / 2))
  const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`

  const onWheel = (e) => {
    e.preventDefault()
    setZoom((zz) => Math.max(1, Math.min(6, zz - e.deltaY * 0.004)))
  }

  // spinning fan face blades
  const fanBlades = []
  for (let i = 0; i < 20; i++) {
    const a = ((i / 20) * 360 + spin.current) * Math.PI / 180
    fanBlades.push([Math.cos(a), Math.sin(a)])
  }

  // a compressor/turbine blade row: alternating rotor (spinning tint) + stator
  const bladeRow = (xc, r, count, rotor, key) => {
    const items = []
    const phase = rotor ? (xc < ax(0.5) ? spin.current : spin2.current) : 0
    for (let i = 0; i < count; i++) {
      const yoff = ((i / count) * 2 - 1) * r
      const tilt = rotor ? Math.sin((phase + i * 30) * Math.PI / 180) * 1.6 : 0
      items.push(
        <line key={i} x1={xc - 1.6 + tilt} y1={cy + yoff} x2={xc + 1.6 - tilt} y2={cy + yoff * 0.86}
          stroke={rotor ? '#9fb0c0' : '#4a5568'} strokeWidth="1" opacity={rotor ? 0.9 : 0.6} />
      )
    }
    return <g key={key}>{items}</g>
  }

  // detail level rises with zoom
  const showBlades = z >= 2
  const showShafts = z >= 2.5
  const showNozzles = z >= 2.5
  const showLabels = z >= 1

  return (
    <div className="el">
      <div className="el-head">
        ENGINE · {engine?.name || 'Turbofan'} · N1 {Math.round(n1)}% · N2 {Math.round(n2)}%
        <span className="el-zoom-tag">{z.toFixed(1)}×</span>
      </div>

      <div className="el-cut" onWheel={onWheel}>
        <svg viewBox={viewBox} className="el-svg" preserveAspectRatio="xMidYMid meet">
          {/* ---- nacelle cowl + bypass duct ---- */}
          <path d={`M ${noseX} ${cy - nacR} L ${tailX - 30} ${cy - nacR + 8} L ${tailX} ${cy - nacR * 0.42}
                    L ${tailX} ${cy + nacR * 0.42} L ${tailX - 30} ${cy + nacR - 8} L ${noseX} ${cy + nacR} Z`}
            fill="rgba(216,255,62,0.03)" stroke="#3a4048" strokeWidth="1.2" />
          <ellipse cx={noseX} cy={cy} rx="5" ry={nacR} fill="none" stroke="#d8ff3e" strokeWidth="1" opacity="0.55" />

          {/* cold bypass flow (top + bottom of the duct) */}
          {[-1, 1].map((s) => {
            const y = cy + s * (coreR + nacR) / 2
            return <line key={s} x1={ax(0.08)} y1={y} x2={tailX - 8} y2={y}
              stroke="#6fb2ff" strokeWidth={z >= 2 ? 3 : 2} strokeDasharray="8 6"
              strokeDashoffset={-(spin.current * flowSpeed)} opacity="0.6" />
          })}

          {/* ---- core casing (converging duct) ---- */}
          <path d={`M ${ax(0.1)} ${cy - coreR} L ${ax(0.5)} ${cy - coreR * 0.62} L ${ax(0.9)} ${cy - coreR * 0.5}
                    L ${ax(0.9)} ${cy + coreR * 0.5} L ${ax(0.5)} ${cy + coreR * 0.62} L ${ax(0.1)} ${cy + coreR} Z`}
            fill="#0b0e13" stroke="#2c313b" strokeWidth="1" />

          {/* hot core gas flow */}
          <line x1={ax(0.12)} y1={cy} x2={tailX - 6} y2={cy}
            stroke="#ff7a3c" strokeWidth={z >= 2 ? 3 : 2.5} strokeDasharray="6 4"
            strokeDashoffset={-(spin.current * flowSpeed * 1.4)} opacity="0.85" />

          {/* ---- two concentric spools (visible when zoomed) ---- */}
          {showShafts && (
            <g opacity="0.9">
              <rect x={ax(0.05)} y={cy - 3.4} width={ax(0.88) - ax(0.05)} height={6.8} rx="2" fill="#2a3038" stroke="#3a4450" strokeWidth="0.5" />
              <rect x={ax(0.2)} y={cy - 1.6} width={ax(0.72) - ax(0.2)} height={3.2} rx="1" fill="#565f6b" />
              <text x={ax(0.14)} y={cy - 6} fill="#7d828c" fontSize="4.5" textAnchor="middle" fontFamily="monospace">N1 SHAFT</text>
              <text x={ax(0.5)} y={cy + 9} fill="#7d828c" fontSize="4.5" textAnchor="middle" fontFamily="monospace">N2 SPOOL</text>
            </g>
          )}

          {/* ---- fan ---- */}
          <g>
            <circle cx={ax(0.05)} cy={cy} r={nacR - 6} fill="none" stroke="#20242c" strokeWidth="1" />
            {fanBlades.map(([dx, dy], i) => (
              <line key={i} x1={ax(0.05)} y1={cy} x2={ax(0.05) + dx * (nacR - 7)} y2={cy + dy * (nacR - 7)}
                stroke="#c9d1d9" strokeWidth={z >= 2 ? 1.6 : 1.2} opacity="0.85" />
            ))}
            <circle cx={ax(0.05)} cy={cy} r="5" fill="#d8ff3e" />
          </g>

          {/* ---- compressor + turbine blade rows (zoomed detail) ---- */}
          {showBlades && (
            <g>
              {/* booster / LPC: 3 rotor+stator pairs */}
              {[0.16, 0.20, 0.24, 0.28].map((f, i) => bladeRow(ax(f), coreR * 0.8, 12, i % 2 === 0, `lpc${f}`))}
              {/* HPC: tighter, higher-count rows on the N2 spool */}
              {[0.34, 0.37, 0.40, 0.43, 0.46].map((f, i) => bladeRow(ax(f), coreR * 0.55, 14, i % 2 === 0, `hpc${f}`))}
              {/* HPT + LPT blade rows */}
              {[0.68, 0.72].map((f, i) => bladeRow(ax(f), coreR * 0.6, 12, true, `hpt${f}`))}
              {[0.82, 0.86].map((f, i) => bladeRow(ax(f), coreR * 0.75, 12, true, `lpt${f}`))}
            </g>
          )}

          {/* ---- combustor: annular chamber + fuel nozzles + glow ---- */}
          <g>
            <path d={`M ${ax(0.52)} ${cy - coreR * 0.6} Q ${ax(0.58)} ${cy - coreR * 0.9} ${ax(0.64)} ${cy - coreR * 0.5}`}
              fill="none" stroke="#4a5568" strokeWidth="1" />
            <path d={`M ${ax(0.52)} ${cy + coreR * 0.6} Q ${ax(0.58)} ${cy + coreR * 0.9} ${ax(0.64)} ${cy + coreR * 0.5}`}
              fill="none" stroke="#4a5568" strokeWidth="1" />
            <ellipse cx={ax(0.58)} cy={cy} rx={len * 0.06} ry={coreR * 0.72} fill="#ff7a3c" opacity={glow} />
            {showNozzles && [-1, -0.5, 0, 0.5, 1].map((s, i) => (
              <g key={i}>
                <line x1={ax(0.52)} y1={cy + s * coreR * 0.55} x2={ax(0.55)} y2={cy + s * coreR * 0.5}
                  stroke="#d8ff3e" strokeWidth="1" opacity="0.8" />
                <circle cx={ax(0.55)} cy={cy + s * coreR * 0.5} r="1.2" fill="#ffd97a" opacity={0.4 + glow} />
              </g>
            ))}
          </g>

          {/* ---- exhaust cone ---- */}
          <path d={`M ${ax(0.9)} ${cy - coreR * 0.5} L ${tailX} ${cy} L ${ax(0.9)} ${cy + coreR * 0.5} Z`}
            fill="#14181e" stroke="#2c313b" strokeWidth="0.8" />

          {/* ---- component labels (leader lines appear when zoomed) ---- */}
          {showLabels && stages.map(([l, f, tC, pr]) => (
            <g key={l}>
              <line x1={ax(f)} y1={cy - nacR - 2} x2={ax(f)} y2={cy - nacR + 4} stroke="#4a4f59" strokeWidth="0.6" />
              <text x={ax(f)} y={cy - nacR - 5} fill="#7d828c" fontSize={z >= 2 ? 5 : 6} textAnchor="middle" fontFamily="monospace">{l}</text>
              {z >= 2.2 && (
                <text x={ax(f)} y={cy + nacR + 8} fill="#ff9a5c" fontSize="4.6" textAnchor="middle" fontFamily="monospace">
                  {tC}° ×{pr}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* zoom control */}
        <div className="el-zoom">
          <button onClick={() => setZoom((z) => Math.max(1, z - 0.6))} aria-label="Zoom out">−</button>
          <input type="range" min="1" max="6" step="0.1" value={zoom} onChange={(e) => setZoom(+e.target.value)} aria-label="Engine zoom" />
          <button onClick={() => setZoom((z) => Math.min(6, z + 0.6))} aria-label="Zoom in">+</button>
        </div>
        {z >= 1.6 && (
          <div className="el-focus">
            {[['Fan', 0.08], ['Compressor', 0.32], ['Burner', 0.58], ['Turbine', 0.78], ['Exhaust', 0.92]].map(([n, f]) => (
              <button key={n} className={Math.abs(focus - f) < 0.06 ? 'on' : ''} onClick={() => setFocus(f)}>{n}</button>
            ))}
          </div>
        )}
      </div>

      <div className="el-gauges el-gauges-row">
        <Gauge label="N1" value={Math.round(n1)} unit="%" frac={n1 / 100} warn={n1 > 101} />
        <Gauge label="N2" value={Math.round(n2)} unit="%" frac={n2 / 105} warn={n2 > 100} />
        <Gauge label="EGT" value={Math.round(egt)} unit="°" frac={(egt - 300) / 700} warn={egt > 900} />
        <Gauge label="FF" value={ffPerEng.toLocaleString()} unit="kg/h" frac={ffPerEng / 3000} />
        <Gauge label="THR" value={e1.thrustPct ?? 0} unit="%" frac={(e1.thrustPct ?? 0) / 100} />
      </div>

      <div className="el-sec">
        <span>OIL <b>{e1.oilP ?? 0}</b> psi</span>
        <span>OIL <b>{e1.oilT ?? 0}</b>°</span>
        <span className={e1.vib > 2 ? 'warn' : ''}>VIB <b>{e1.vib ?? 0}</b></span>
      </div>

      <div className="el-fuel">
        <div className="el-fuel-bar">
          <span style={{ width: `${Math.max(0, Math.min(100, (fuel / fuel0) * 100))}%` }} />
        </div>
        <div className="el-fuel-nums">
          <span><b>{Math.round(fuel).toLocaleString()}</b> kg on board</span>
          <span><b>{Math.round(ffTotal).toLocaleString()}</b> kg/h burn</span>
          <span><b>{enduranceH.toFixed(1)}</b> h endurance</span>
        </div>
      </div>
    </div>
  )
}
