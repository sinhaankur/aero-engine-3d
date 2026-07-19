import { useEffect, useRef, useState } from 'react'

/**
 * Live engine + fuel panel for /fly — a working turbofan you can watch respond.
 *
 * A parametric cross-section (nacelle/bypass scaled from the real engine's fan
 * diameter + bypass ratio) with a fan disc that SPINS at the live N1, cold
 * bypass air and hot core gas that flow faster as N1 rises, the gas-path stages
 * labelled (FAN · LPC · HPC · BURN · HPT · LPT), and a live column of N1 / EGT /
 * fuel-flow per engine plus a fuel-remaining bar with endurance. Everything is
 * driven from the sim's per-engine readout, so it's a real instrument, not art.
 */

const W = 320
const H = 190
const cx = W / 2
const cy = 96

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
  const spin = useRef(0)
  const raf = useRef(0)
  const last = useRef(performance.now())

  // animate the fan + flow continuously off rAF, driven by live N1
  useEffect(() => {
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last.current) / 1000); last.current = t
      const n1 = out ? Math.max(0.04, out.n1 / 100) : 0.04
      spin.current = (spin.current + n1 * 720 * dt) % 360
      tick((n) => (n + 1) & 1023)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [out])

  const bpr = engine?.bypassRatio || 5
  const fanDia = engine?.fanDiameterM || 1.7
  const nacR = Math.min(70, 30 + fanDia * 13)
  const bypassFrac = Math.min(0.62, 0.28 + (bpr / 20) * 0.5)
  const coreR = nacR * (1 - bypassFrac)
  const noseX = 46
  const tailX = W - 40
  const len = tailX - noseX
  const st = (f) => noseX + len * f

  const e1 = out?.eng1 || {}
  const n1 = e1.n1 ?? 0
  const n2 = e1.n2 ?? 0
  const egt = e1.egt ?? 0
  const ffPerEng = e1.ff ?? 0                         // kg/h per engine
  const ffTotal = ffPerEng * (ac?.engineCount || 2)   // kg/h total
  const fuel = state?.fuelKg ?? 0
  const fuel0 = (ac?.mass || 60000) * 0.12
  const enduranceH = ffTotal > 1 ? fuel / ffTotal : 0
  const flowSpeed = 0.4 + (n1 / 100) * 2.4            // dash animation rate
  // gas-path stations: temperature (°C) + pressure ratio grow through the core,
  // peak at the burner, then drop through the turbines. Scaled by N1.
  const load = n1 / 100
  const oatC = out?.atm?.oatC ?? 15
  const stages = [
    ['FAN', Math.round(oatC + load * 25), (1 + load * 0.6).toFixed(1)],
    ['LPC', Math.round(oatC + load * 120), (1 + load * 3).toFixed(1)],
    ['HPC', Math.round(oatC + load * 430), (1 + load * 28).toFixed(0)],
    ['BURN', Math.round(700 + load * 1150), (1 + load * 26).toFixed(0)],
    ['HPT', egt + Math.round(load * 120), (1 + load * 9).toFixed(0)],
    ['LPT', egt, (1 + load * 2).toFixed(1)],
  ]

  // blades of the spinning fan (drawn as radial spokes on the disc face)
  const blades = []
  const nB = 16
  for (let i = 0; i < nB; i++) {
    const a = ((i / nB) * 360 + spin.current) * Math.PI / 180
    blades.push([Math.cos(a), Math.sin(a)])
  }

  return (
    <div className="el">
      <div className="el-head">ENGINE · {engine?.name || 'Turbofan'} · N1 {Math.round(n1)}%</div>
      <div className="el-body">
        <svg viewBox={`0 0 ${W} ${H}`} className="el-svg">
          {/* nacelle cowl */}
          <path d={`M ${noseX} ${cy - nacR} L ${tailX - 24} ${cy - nacR + 6} L ${tailX} ${cy - nacR * 0.4}
                    L ${tailX} ${cy + nacR * 0.4} L ${tailX - 24} ${cy + nacR - 6} L ${noseX} ${cy + nacR} Z`}
            fill="rgba(216,255,62,0.03)" stroke="#3a4048" strokeWidth="1.2" />
          {/* intake lip */}
          <ellipse cx={noseX} cy={cy} rx="4" ry={nacR} fill="none" stroke="#d8ff3e" strokeWidth="1" opacity="0.6" />

          {/* cold bypass flow */}
          {[-1, 1].map((s) => {
            const y = cy + s * (coreR + nacR) / 2
            return <line key={s} x1={noseX + 8} y1={y} x2={tailX - 6} y2={y}
              stroke="#6fb2ff" strokeWidth="2" strokeDasharray="7 5"
              strokeDashoffset={-(spin.current * flowSpeed)} opacity="0.7" />
          })}
          {/* hot core flow */}
          <line x1={st(0.1)} y1={cy} x2={tailX - 4} y2={cy}
            stroke="#ff7a3c" strokeWidth="2.5" strokeDasharray="6 4"
            strokeDashoffset={-(spin.current * flowSpeed * 1.4)} opacity="0.85" />

          {/* core casing */}
          <path d={`M ${st(0.1)} ${cy - coreR} L ${st(0.86)} ${cy - coreR * 0.55}
                    L ${st(0.86)} ${cy + coreR * 0.55} L ${st(0.1)} ${cy + coreR} Z`}
            fill="#0d1117" stroke="#2c313b" strokeWidth="1" />

          {/* spinning fan disc */}
          <circle cx={noseX + 10} cy={cy} r={nacR - 4} fill="none" stroke="#20242c" strokeWidth="1" />
          <g>
            {blades.map(([dx, dy], i) => (
              <line key={i} x1={noseX + 10} y1={cy} x2={noseX + 10 + dx * (nacR - 5)} y2={cy + dy * (nacR - 5)}
                stroke="#c9d1d9" strokeWidth="1.4" opacity="0.85" />
            ))}
            <circle cx={noseX + 10} cy={cy} r="4" fill="#d8ff3e" />
          </g>

          {/* stage labels */}
          {[['FAN', 0.06], ['LPC', 0.26], ['HPC', 0.44], ['BURN', 0.58], ['HPT', 0.7], ['LPT', 0.84]].map(([l, f]) => (
            <text key={l} x={st(f)} y={cy + nacR + 12} fill="#7d828c" fontSize="7" textAnchor="middle" fontFamily="monospace">{l}</text>
          ))}
          {/* combustor glow, brightening with EGT */}
          <ellipse cx={st(0.58)} cy={cy} rx="10" ry={coreR * 0.7}
            fill="#ff7a3c" opacity={Math.max(0.05, Math.min(0.6, (egt - 380) / 700))} />
        </svg>

        <div className="el-gauges">
          <Gauge label="N1" value={Math.round(n1)} unit="%" frac={n1 / 100} warn={n1 > 101} />
          <Gauge label="N2" value={Math.round(n2)} unit="%" frac={n2 / 105} warn={n2 > 100} />
          <Gauge label="EGT" value={Math.round(egt)} unit="°" frac={(egt - 300) / 700} warn={egt > 900} />
          <Gauge label="FF" value={ffPerEng.toLocaleString()} unit="kg/h" frac={ffPerEng / 3000} />
          <Gauge label="THR" value={e1.thrustPct ?? 0} unit="%" frac={(e1.thrustPct ?? 0) / 100} />
        </div>
      </div>

      {/* secondary engine params */}
      <div className="el-sec">
        <span>OIL <b>{e1.oilP ?? 0}</b> psi</span>
        <span>OIL <b>{e1.oilT ?? 0}</b>°</span>
        <span className={e1.vib > 2 ? 'warn' : ''}>VIB <b>{e1.vib ?? 0}</b></span>
      </div>

      {/* per-stage gas path: temperature + pressure ratio through the core */}
      <div className="el-stages">
        {stages.map(([n, t, p]) => (
          <div key={n} className="el-stage">
            <span className="el-stage-n">{n}</span>
            <span className="el-stage-t">{t}°</span>
            <span className="el-stage-p">×{p}</span>
          </div>
        ))}
      </div>

      {/* fuel consumption strip */}
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
