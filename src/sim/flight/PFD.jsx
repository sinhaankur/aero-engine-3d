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

const SPD_PPK = 2.4 // px per knot on the speed tape

function SpeedTape({ ias, stallKt, vr, v2, vsel, trendKt }) {
  const ticks = []
  const lo = Math.max(0, Math.floor((ias - 55) / 10) * 10)
  for (let v = lo; v <= ias + 55; v += 10) {
    const y = CY + (ias - v) * SPD_PPK
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
  const yOf = (v) => CY + (ias - v) * SPD_PPK
  const clampY = (y) => Math.max(28, Math.min(322, y))
  // red band below stall speed
  const stallY = yOf(stallKt)
  // speed bugs: VR / V2 (takeoff refs) drawn on the tape when in range
  const bug = (v, color, label) => {
    const y = yOf(v)
    if (y < 30 || y > 320) return null
    return (
      <g key={label}>
        <path d={`M 71 ${y} l 8 -5 v 10 z`} fill={color} />
        <text x={83} y={y + 4} fill={color} fontSize="10" fontFamily="monospace">{label}</text>
      </g>
    )
  }
  // speed trend vector: a magenta arrow toward where IAS will be in ~10 s
  const trendEndY = clampY(CY - trendKt * SPD_PPK)
  const showTrend = Math.abs(trendKt) > 1.5
  return (
    <g>
      <rect x={14} y={26} width={58} height={298} fill="#161b22" stroke="#30363d" />
      {ticks}
      {stallY > 26 && (
        <rect x={64} y={Math.max(stallY, 26)} width={7} height={Math.max(0, 324 - Math.max(stallY, 26))} fill="#f85149" />
      )}
      {/* selected-speed bug (cyan) from the FCU */}
      {vsel != null && yOf(vsel) > 28 && yOf(vsel) < 322 && (
        <path d={`M 60 ${yOf(vsel)} l 12 -6 v 12 z`} fill="none" stroke="#22d3ee" strokeWidth="2" />
      )}
      {bug(vr, '#e6edf3', 'VR')}
      {bug(v2, '#22d3ee', 'V2')}
      {/* trend vector */}
      {showTrend && (
        <g stroke="#e879f9" strokeWidth="2.4" fill="none">
          <line x1={73} y1={CY} x2={73} y2={trendEndY} />
          <path d={`M 73 ${trendEndY} l -4 ${trendKt > 0 ? 7 : -7} M 73 ${trendEndY} l 4 ${trendKt > 0 ? 7 : -7}`} />
        </g>
      )}
      <rect x={12} y={CY - 14} width={62} height={28} fill="#0d1117" stroke="#e3b341" strokeWidth="1.5" />
      <text x={43} y={CY + 6} fill="#e3b341" fontSize="17" textAnchor="middle" fontFamily="monospace" fontWeight="700">
        {Math.round(ias)}
      </text>
      <text x={43} y={340} fill="#8b949e" fontSize="10" textAnchor="middle" fontFamily="monospace">IAS KT</text>
    </g>
  )
}

const ALT_PPF = 0.42 // px per foot on the altitude tape

function AltTape({ alt, vs, altSel }) {
  const ticks = []
  const lo = Math.floor((alt - 320) / 100) * 100
  for (let v = lo; v <= alt + 320; v += 100) {
    if (v < 0) continue
    const y = CY + (alt - v) * ALT_PPF
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
  const selY = altSel != null ? CY + (alt - altSel) * ALT_PPF : null
  return (
    <g>
      <rect x={386} y={26} width={58} height={298} fill="#161b22" stroke="#30363d" />
      {ticks}
      {/* selected-altitude bug (cyan) — clamped to the top/bottom when off-tape */}
      {selY != null && (
        <path
          d={`M 386 ${Math.max(30, Math.min(320, selY))} h 58`}
          stroke="#22d3ee" strokeWidth="2.5" fill="none"
          strokeDasharray={selY < 30 || selY > 320 ? '4 3' : undefined}
        />
      )}
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

const KT = 0.514444

/**
 * The Airbus FMA (Flight Mode Annunciator): three green columns across the top —
 * thrust/speed mode | vertical mode | lateral mode — with the AP/FD/ATHR
 * engagement row beneath. Modes are derived from the sim's AP/phase state so the
 * boxes light up as the flight progresses, the way a real one does.
 */
function FMA({ state, out }) {
  const athr = state.athrOn
  const ap = state.apOn
  // thrust column
  const col1 = state.onGround
    ? (state.throttle > 0.8 ? 'MAN TOGA' : 'MAN THR')
    : athr ? 'SPEED' : (state.throttle > 0.9 ? 'THR CLB' : 'MAN THR')
  // vertical column
  const col2 = state.onGround ? '—'
    : ap ? (state.apVsMode ? 'V/S' : 'ALT') : (out.vsFpm > 200 ? 'CLB' : out.vsFpm < -200 ? 'DES' : 'ALT*')
  // lateral column
  const col3 = state.onGround ? 'RWY'
    : ap ? (state.apHdgMode ? 'HDG' : 'NAV') : 'HDG'
  const cell = (x, txt, active) => (
    <g>
      {active && <rect x={x - 44} y={5} width={88} height={17} rx={2} fill="none" stroke="#3fb950" strokeWidth="1" />}
      <text x={x} y={17} fill="#3fb950" fontSize="11" textAnchor="middle" fontFamily="monospace" fontWeight="700">{txt}</text>
    </g>
  )
  return (
    <g>
      <line x1={W / 3} x2={W / 3} y1={3} y2={24} stroke="#30363d" strokeWidth="0.8" />
      <line x1={(2 * W) / 3} x2={(2 * W) / 3} y1={3} y2={24} stroke="#30363d" strokeWidth="0.8" />
      {cell(W / 6, col1, athr || state.onGround)}
      {cell(W / 2, col2, ap)}
      {cell((5 * W) / 6, col3, ap)}
      {/* engagement row */}
      <text x={CX} y={34} fill="#22d3ee" fontSize="9" textAnchor="middle" fontFamily="monospace">
        {ap ? 'AP1  ' : ''}1FD2  {athr ? 'A/THR' : ''}
      </text>
    </g>
  )
}

export default function PFD({ out, state, ac, weatherName }) {
  if (!out) return null
  // stall speed in IAS terms: Vs = sqrt(2W / (rho0 · S · CLmax))
  const vsKt = Math.sqrt((2 * ac.mass * 9.81) / (1.225 * ac.S * (ac.clMaxClean + ac.flaps[state.flap].dCl))) / 0.514444

  // speed trend: net longitudinal accel × 10 s, converted TAS→IAS. Uses the same
  // forces the model exposes, so the magenta arrow predicts where IAS is heading.
  const sinG = Math.sin(state.gamma || 0)
  const axMs2 = (out.T * Math.cos(state.alpha) - out.D) / ac.mass - 9.80665 * sinG
  const trendKt = (axMs2 * 10 / KT) * Math.sqrt(out.atm.sigma) // 10-s trend, in IAS kt

  // FCU selected targets for the bugs (only meaningful once flying / AP armed)
  const altSel = state.fcuAlt != null ? state.fcuAlt : null
  const vSel = state.athrOn ? state.fcuSpd : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pfd" role="img" aria-label="Primary flight display">
      <rect x={0} y={0} width={W} height={H} rx={10} fill="#0d1117" stroke="#30363d" />
      {/* FMA — three-column Airbus annunciator */}
      <FMA state={state} out={out} />

      <Attitude pitch={(state.theta * 180) / Math.PI} roll={(state.phi * 180) / Math.PI} stalled={state.stalled} />
      {/* config + weather strip, centred below the attitude sphere (clear of the tapes) */}
      <text x={CX} y={CY + 108} fill="#58a6ff" fontSize="11" textAnchor="middle" fontFamily="monospace">
        FLAPS {ac.flaps[state.flap].name} · GEAR {state.gear ? 'DN' : 'UP'} · {weatherName}
      </text>
      <SpeedTape
        ias={out.iasKt}
        stallKt={vsKt}
        vr={ac.vr / KT}
        v2={ac.v2 / KT}
        vsel={vSel}
        trendKt={trendKt}
      />
      <AltTape alt={out.altFt} vs={out.vsFpm} altSel={altSel} />
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
