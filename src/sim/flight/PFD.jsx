/**
 * Primary Flight Display — an Airbus-style PFD drawn in SVG.
 *
 * Layout mirrors the real instrument: attitude sphere centre (pitch ladder,
 * bank arc, FBW-style pitch protections tape), speed tape left, altitude tape
 * + VS right, heading strip below, FMA-ish annunciators on top. All values
 * come straight from the flight model's readouts each frame.
 */

const W = 460
const H = 380
const CX = 230
const CY = 172
const PPD = 4.6 // pixels per degree of pitch

function SpeedTape({ ias, stallKt, vr }) {
  const ticks = []
  const lo = Math.max(0, Math.floor((ias - 55) / 10) * 10)
  for (let v = lo; v <= ias + 55; v += 10) {
    const y = CY + (ias - v) * 2.4
    if (y < 30 || y > 320) continue
    ticks.push(
      <g key={v}>
        <line x1={62} x2={70} y1={y} y2={y} stroke="#e6edf3" strokeWidth="1.4" />
        {v % 20 === 0 && (
          <text x={56} y={y + 4} fill="#e6edf3" fontSize="13" textAnchor="end" fontFamily="monospace">{v}</text>
        )}
      </g>
    )
  }
  // red band below stall speed, amber near it
  const stallY = CY + (ias - stallKt) * 2.4
  return (
    <g>
      <rect x={14} y={26} width={58} height={298} fill="#161b22" stroke="#30363d" />
      {ticks}
      {stallY > 26 && (
        <rect x={64} y={Math.max(stallY, 26)} width={7} height={Math.max(0, 324 - Math.max(stallY, 26))} fill="#f85149" />
      )}
      <rect x={12} y={CY - 14} width={62} height={28} fill="#0d1117" stroke="#e3b341" strokeWidth="1.5" />
      <text x={43} y={CY + 6} fill="#e3b341" fontSize="17" textAnchor="middle" fontFamily="monospace" fontWeight="700">
        {Math.round(ias)}
      </text>
      <text x={43} y={340} fill="#8b949e" fontSize="10" textAnchor="middle" fontFamily="monospace">IAS KT · VR {Math.round(vr)}</text>
    </g>
  )
}

function AltTape({ alt, vs }) {
  const ticks = []
  const lo = Math.floor((alt - 320) / 100) * 100
  for (let v = lo; v <= alt + 320; v += 100) {
    if (v < 0) continue
    const y = CY + (alt - v) * 0.42
    if (y < 30 || y > 320) continue
    ticks.push(
      <g key={v}>
        <line x1={388} x2={396} y1={y} y2={y} stroke="#e6edf3" strokeWidth="1.4" />
        {v % 500 === 0 && (
          <text x={402} y={y + 4} fill="#e6edf3" fontSize="12" fontFamily="monospace">{v}</text>
        )}
      </g>
    )
  }
  const vsY = Math.max(-60, Math.min(60, -vs / 35))
  return (
    <g>
      <rect x={386} y={26} width={58} height={298} fill="#161b22" stroke="#30363d" />
      {ticks}
      <rect x={384} y={CY - 14} width={62} height={28} fill="#0d1117" stroke="#3fb950" strokeWidth="1.5" />
      <text x={415} y={CY + 6} fill="#3fb950" fontSize="16" textAnchor="middle" fontFamily="monospace" fontWeight="700">
        {Math.round(alt)}
      </text>
      {/* VS needle */}
      <rect x={448} y={CY - 62} width={8} height={124} fill="#161b22" stroke="#30363d" />
      <rect x={449} y={vs >= 0 ? CY + vsY : CY} width={6} height={Math.abs(vsY)} fill={Math.abs(vs) > 2000 ? '#e3b341' : '#3fb950'} />
      <text x={452} y={340} fill="#8b949e" fontSize="10" textAnchor="end" fontFamily="monospace">ALT FT · VS {Math.round(vs / 100) * 100}</text>
    </g>
  )
}

function Attitude({ pitch, roll, stalled }) {
  const r = 118
  return (
    <g>
      <defs>
        <clipPath id="pfd-att">
          <circle cx={CX} cy={CY} r={r} />
        </clipPath>
      </defs>
      <g clipPath="url(#pfd-att)">
        <g transform={`rotate(${-roll} ${CX} ${CY}) translate(0 ${pitch * PPD})`}>
          <rect x={CX - 260} y={CY - 400} width={520} height={400} fill="#2c5f9e" />
          <rect x={CX - 260} y={CY} width={520} height={400} fill="#6b4a26" />
          <line x1={CX - 260} x2={CX + 260} y1={CY} y2={CY} stroke="#e6edf3" strokeWidth="2" />
          {/* pitch ladder */}
          {[-30, -20, -10, 10, 20, 30].map((p) => (
            <g key={p}>
              <line x1={CX - (p % 20 === 0 ? 44 : 28)} x2={CX + (p % 20 === 0 ? 44 : 28)} y1={CY - p * PPD} y2={CY - p * PPD} stroke="#e6edf3" strokeWidth="1.6" />
              <text x={CX + (p % 20 === 0 ? 52 : 36)} y={CY - p * PPD + 4} fill="#e6edf3" fontSize="11" fontFamily="monospace">{Math.abs(p)}</text>
            </g>
          ))}
          {[-25, -15, -5, 5, 15, 25].map((p) => (
            <line key={p} x1={CX - 14} x2={CX + 14} y1={CY - p * PPD} y2={CY - p * PPD} stroke="#e6edf3" strokeWidth="1" />
          ))}
        </g>
      </g>
      <circle cx={CX} cy={CY} r={r} fill="none" stroke="#30363d" strokeWidth="2" />
      {/* bank arc */}
      <g>
        {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((b) => {
          const a = ((b - 90) * Math.PI) / 180
          const x1 = CX + Math.cos(a) * (r - 2)
          const y1 = CY + Math.sin(a) * (r - 2)
          const x2 = CX + Math.cos(a) * (r - (b % 30 === 0 ? 14 : 8))
          const y2 = CY + Math.sin(a) * (r - (b % 30 === 0 ? 14 : 8))
          return <line key={b} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e6edf3" strokeWidth="1.6" />
        })}
        {/* roll pointer */}
        <g transform={`rotate(${-roll} ${CX} ${CY})`}>
          <path d={`M ${CX} ${CY - r + 4} l -7 12 h 14 z`} fill="#e3b341" />
        </g>
      </g>
      {/* fixed aircraft symbol */}
      <path d={`M ${CX - 62} ${CY} h 34 l 8 9 h -10 z`} fill="#0d1117" stroke="#e3b341" strokeWidth="2" />
      <path d={`M ${CX + 62} ${CY} h -34 l -8 9 h 10 z`} fill="#0d1117" stroke="#e3b341" strokeWidth="2" />
      <rect x={CX - 3} y={CY - 3} width={6} height={6} fill="#e3b341" />
      {stalled && (
        <text x={CX} y={CY - 66} fill="#f85149" fontSize="19" fontWeight="800" textAnchor="middle" fontFamily="monospace">STALL</text>
      )}
    </g>
  )
}

function HeadingTape({ hdg }) {
  const ticks = []
  const lo = Math.floor((hdg - 45) / 10) * 10
  for (let v = lo; v <= hdg + 45; v += 10) {
    const x = CX + (v - hdg) * 3.4
    if (x < 90 || x > 370) continue
    const label = ((v % 360) + 360) % 360
    ticks.push(
      <g key={v}>
        <line x1={x} x2={x} y1={332} y2={340} stroke="#e6edf3" strokeWidth="1.4" />
        {label % 30 === 0 && (
          <text x={x} y={356} fill="#e6edf3" fontSize="12" textAnchor="middle" fontFamily="monospace">
            {String(Math.round(label / 10)).padStart(2, '0')}
          </text>
        )}
      </g>
    )
  }
  return (
    <g>
      <rect x={88} y={330} width={284} height={32} fill="#161b22" stroke="#30363d" />
      {ticks}
      <path d={`M ${CX} 342 l -6 -10 h 12 z`} fill="#e3b341" />
      <text x={CX} y={376} fill="#e3b341" fontSize="12" textAnchor="middle" fontFamily="monospace">HDG {String(Math.round(hdg)).padStart(3, '0')}°</text>
    </g>
  )
}

export default function PFD({ out, state, ac, weatherName }) {
  if (!out) return null
  // stall speed in IAS terms: Vs = sqrt(2W / (rho0 · S · CLmax))
  const vsKt = Math.sqrt((2 * ac.mass * 9.81) / (1.225 * ac.S * (ac.clMaxClean + ac.flaps[state.flap].dCl))) / 0.514444

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pfd" role="img" aria-label="Primary flight display">
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0d1117" stroke="#30363d" />
      {/* FMA row */}
      <text x={16} y={18} fill="#3fb950" fontSize="11" fontFamily="monospace">
        {state.onGround ? 'GND' : state.apOn ? 'AP1 · ALT HLD' : 'MANUAL FLT'}
      </text>
      <text x={CX} y={18} fill="#58a6ff" fontSize="11" textAnchor="middle" fontFamily="monospace">
        FLAPS {ac.flaps[state.flap].name} · GEAR {state.gear ? 'DN' : 'UP'}
      </text>
      <text x={W - 16} y={18} fill="#8b949e" fontSize="11" textAnchor="end" fontFamily="monospace">{weatherName}</text>

      <Attitude pitch={(state.theta * 180) / Math.PI} roll={(state.phi * 180) / Math.PI} stalled={state.stalled} />
      <SpeedTape ias={out.iasKt} stallKt={vsKt} vr={ac.vr / 0.514444} />
      <AltTape alt={out.altFt} vs={out.vsFpm} />
      <HeadingTape hdg={out.hdg} />

      {out.overspeed && (
        <text x={CX} y={CY + 84} fill="#f85149" fontSize="15" fontWeight="800" textAnchor="middle" fontFamily="monospace">OVERSPEED</text>
      )}
      {/* Mach + N1 corner readouts */}
      <text x={16} y={340} fill="#e6edf3" fontSize="12" fontFamily="monospace">M {out.mach.toFixed(3)}</text>
      <text x={16} y={356} fill="#e6edf3" fontSize="12" fontFamily="monospace">N1 {Math.round(out.n1)}%</text>
      <text x={16} y={372} fill="#8b949e" fontSize="11" fontFamily="monospace">AoA {out.aoaDeg.toFixed(1)}°</text>
    </svg>
  )
}
