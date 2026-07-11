/**
 * A procedural turbofan cross-section — drawn as terminal line-art on the
 * engineering grid, parametrised from the engine's real figures so every engine
 * (even ones without an authored 3D model) has an accurate graphic to look at.
 *
 * The nacelle height scales with fan diameter; the bypass duct thickness scales
 * with bypass ratio (a high-BPR geared fan gets a fat cold-air annulus around a
 * small core, a low-BPR engine gets a slim one). The core stages (fan → LPC →
 * HPC → combustor → HPT → LPT) are drawn front-to-back with the gas path.
 */
export default function EngineDiagram({ engine }) {
  const C = {
    ink: '#e8eaed',
    accent: '#d8ff3e',
    dim: '#7d828c',
    faint: '#4a4f59',
    grid: 'rgba(255,255,255,0.05)',
    hot: '#ff7a3c',
    cold: '#6fb2ff',
    fill: 'rgba(216,255,62,0.04)',
  }

  const W = 460
  const H = 220
  const cx = W / 2
  const cy = H / 2

  const bpr = engine.bypassRatio || 5
  const fanDia = engine.fanDiameterM || 1.7
  // nacelle half-height scales with fan diameter (clamped to the canvas)
  const nacR = Math.min(78, 34 + fanDia * 14)
  // bypass duct thickness grows with bypass ratio; core shrinks accordingly
  const bypassFrac = Math.min(0.62, 0.28 + (bpr / 20) * 0.5)
  const coreR = nacR * (1 - bypassFrac)

  const noseX = 70
  const tailX = W - 60
  const len = tailX - noseX

  // core stations along X (fan face → exhaust)
  const st = (f) => noseX + len * f
  const fanX = st(0.06)
  const lpcX = st(0.24)
  const hpcX = st(0.42)
  const combX = st(0.58)
  const hptX = st(0.7)
  const lptX = st(0.84)

  // half-height of the core casing at each station (a rough gas-path profile)
  const core = (f, base) => base * (1 - 0.35 * f)

  const nacelleTop = cy - nacR
  const nacelleBot = cy + nacR

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${engine.name} turbofan cross-section`}
      style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)' }}
      fontFamily="var(--mono)"
    >
      {/* grid */}
      {Array.from({ length: Math.ceil(W / 20) + 1 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 20} y1="0" x2={i * 20} y2={H} stroke={C.grid} strokeWidth="0.5" />
      ))}
      {Array.from({ length: Math.ceil(H / 20) + 1 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 20} x2={W} y2={i * 20} stroke={C.grid} strokeWidth="0.5" />
      ))}

      {/* nacelle (cowl) — rounded top + bottom */}
      <path
        d={`M ${noseX} ${cy} C ${noseX - 6} ${nacelleTop + 6} ${fanX - 4} ${nacelleTop} ${fanX + 6} ${nacelleTop}
            L ${tailX - 30} ${nacelleTop + 8} L ${tailX} ${cy - nacR * 0.35}`}
        fill="none" stroke={C.ink} strokeWidth="1.2"
      />
      <path
        d={`M ${noseX} ${cy} C ${noseX - 6} ${nacelleBot - 6} ${fanX - 4} ${nacelleBot} ${fanX + 6} ${nacelleBot}
            L ${tailX - 30} ${nacelleBot - 8} L ${tailX} ${cy + nacR * 0.35}`}
        fill="none" stroke={C.ink} strokeWidth="1.2"
      />

      {/* intake lip highlight */}
      <ellipse cx={noseX + 2} cy={cy} rx="4" ry={nacR} fill="none" stroke={C.accent} strokeWidth="1" opacity="0.7" />

      {/* bypass airflow (cold) — two long arrows through the duct */}
      {[-1, 1].map((s) => (
        <g key={`by${s}`} stroke={C.cold} strokeWidth="1" opacity="0.75">
          <line x1={fanX + 10} y1={cy + s * (coreR + nacR) / 2} x2={tailX - 10} y2={cy + s * (coreR + nacR) / 2} strokeDasharray="6 4" />
          <polygon points={`${tailX - 10},${cy + s * (coreR + nacR) / 2} ${tailX - 16},${cy + s * (coreR + nacR) / 2 - 2.5} ${tailX - 16},${cy + s * (coreR + nacR) / 2 + 2.5}`} fill={C.cold} stroke="none" />
        </g>
      ))}

      {/* fan disc */}
      <line x1={fanX} y1={cy - nacR + 3} x2={fanX} y2={cy + nacR - 3} stroke={C.accent} strokeWidth="2" />
      {Array.from({ length: 14 }).map((_, i) => {
        const y = cy - nacR + 4 + ((nacR * 2 - 8) * i) / 13
        return <line key={`bl${i}`} x1={fanX - 3} y1={y} x2={fanX + 3} y2={y} stroke={C.accent} strokeWidth="0.8" />
      })}

      {/* core casing (gas generator) */}
      <path
        d={`M ${fanX} ${cy - core(0, coreR)}
            L ${lpcX} ${cy - core(0.24, coreR)} L ${hpcX} ${cy - core(0.42, coreR)}
            L ${combX} ${cy - core(0.58, coreR) * 1.15} L ${lptX} ${cy - core(0.84, coreR)}
            L ${tailX - 24} ${cy - coreR * 0.28}
            L ${tailX - 24} ${cy + coreR * 0.28}
            L ${lptX} ${cy + core(0.84, coreR)} L ${combX} ${cy + core(0.58, coreR) * 1.15}
            L ${hpcX} ${cy + core(0.42, coreR)} L ${lpcX} ${cy + core(0.24, coreR)}
            L ${fanX} ${cy + core(0, coreR)} Z`}
        fill={C.fill} stroke={C.ink} strokeWidth="1"
      />

      {/* combustor (hot section) */}
      <rect x={combX} y={cy - core(0.58, coreR)} width={hptX - combX} height={core(0.58, coreR) * 2} fill="rgba(255,122,60,0.12)" stroke={C.hot} strokeWidth="0.8" />
      {/* core hot exhaust arrow */}
      <line x1={lptX} y1={cy} x2={tailX - 4} y2={cy} stroke={C.hot} strokeWidth="1.4" />
      <polygon points={`${tailX - 4},${cy} ${tailX - 11},${cy - 3} ${tailX - 11},${cy + 3}`} fill={C.hot} stroke="none" />

      {/* shaft */}
      <line x1={fanX} y1={cy} x2={lptX} y2={cy} stroke={C.faint} strokeWidth="0.8" strokeDasharray="2 2" />

      {/* stage labels */}
      {[
        [fanX, 'FAN'],
        [lpcX, 'LPC'],
        [hpcX, 'HPC'],
        [combX + (hptX - combX) / 2, 'BURN'],
        [lptX, 'TURB'],
      ].map(([x, label]) => (
        <g key={label}>
          <line x1={x} y1={nacelleBot + 4} x2={x} y2={nacelleBot + 9} stroke={C.faint} strokeWidth="0.6" />
          <text x={x} y={nacelleBot + 17} fontSize="7" fill={C.dim} textAnchor="middle" letterSpacing="0.5">{label}</text>
        </g>
      ))}

      {/* airflow legend */}
      <g fontSize="7" letterSpacing="0.4">
        <line x1={noseX} y1="14" x2={noseX + 12} y2="14" stroke={C.cold} strokeWidth="1" strokeDasharray="4 3" />
        <text x={noseX + 16} y="16.5" fill={C.dim}>BYPASS (COLD)</text>
        <line x1={noseX + 92} y1="14" x2={noseX + 104} y2="14" stroke={C.hot} strokeWidth="1.4" />
        <text x={noseX + 108} y="16.5" fill={C.dim}>CORE (HOT)</text>
      </g>

      {/* bypass-ratio readout */}
      <text x={tailX} y={H - 8} fontSize="8" fill={C.accent} textAnchor="end" letterSpacing="0.5">
        BPR {bpr}:1 · FAN Ø{fanDia} m
      </text>
    </svg>
  )
}
