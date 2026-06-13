/**
 * A data-driven technical blueprint. Renders a top-view (plan) and side-view
 * (elevation) of the aircraft scaled directly from its `dimensions`, with
 * dimension callouts. Pure SVG — no 3D, fast, and printable. This is the "2D
 * blueprint" half of the brief, generated from the same numbers as the 3D model.
 */
export default function Blueprint({ dimensions, engineCount = 2 }) {
  const { lengthM, wingspanM, heightM, fuselageDiaM } = dimensions

  // World metres -> SVG units. Lay both views in a 100-wide viewBox.
  const pad = 8
  const scale = (100 - pad * 2) / Math.max(lengthM, wingspanM)
  const L = lengthM * scale
  const W = wingspanM * scale
  const H = heightM * scale
  const FD = fuselageDiaM * scale
  const cx = 50
  const grid = '#1b2430'
  const ink = '#58a6ff'
  const dim = '#6e7681'

  // Top view occupies the upper band, side view the lower band.
  const topY = 30
  const sideY = 78

  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Aircraft blueprint" style={{ width: '100%', background: '#0d1117', borderRadius: 12 }}>
      {/* grid */}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke={grid} strokeWidth="0.2" />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke={grid} strokeWidth="0.2" />
      ))}

      {/* ---- TOP VIEW (plan) ---- */}
      {/* wing */}
      <rect x={cx - L * 0.45} y={topY - W / 2} width={L * 0.16} height={W} fill="none" stroke={ink} strokeWidth="0.4" />
      {/* tailplane */}
      <rect x={cx + L * 0.34} y={topY - (W * 0.36) / 2} width={L * 0.08} height={W * 0.36} fill="none" stroke={ink} strokeWidth="0.4" />
      {/* fuselage */}
      <rect x={cx - L / 2} y={topY - FD / 2} width={L} height={FD} rx={FD / 2} fill="none" stroke={ink} strokeWidth="0.5" />
      {/* engines */}
      {Array.from({ length: engineCount }).map((_, i) => {
        const side = i % 2 === 0 ? -1 : 1
        const z = side * (W / 2) * 0.42
        return <circle key={i} cx={cx - L * 0.42} cy={topY + z} r={FD * 0.4} fill="none" stroke={ink} strokeWidth="0.35" />
      })}

      {/* wingspan dimension line */}
      <line x1={cx - L * 0.52} y1={topY - W / 2} x2={cx - L * 0.52} y2={topY + W / 2} stroke={dim} strokeWidth="0.3" />
      <text x={cx - L * 0.52 - 1.5} y={topY} fill={dim} fontSize="2.4" textAnchor="end" transform={`rotate(-90 ${cx - L * 0.52 - 1.5} ${topY})`}>
        {wingspanM.toFixed(1)} m span
      </text>

      {/* ---- SIDE VIEW (elevation) ---- */}
      <rect x={cx - L / 2} y={sideY - FD / 2} width={L} height={FD} rx={FD / 2} fill="none" stroke={ink} strokeWidth="0.5" />
      {/* tail fin */}
      <path
        d={`M ${cx + L * 0.34} ${sideY - FD / 2} L ${cx + L * 0.46} ${sideY - H} L ${cx + L * 0.46} ${sideY - FD / 2} Z`}
        fill="none"
        stroke={ink}
        strokeWidth="0.4"
      />
      {/* length dimension line */}
      <line x1={cx - L / 2} y1={sideY + FD / 2 + 3} x2={cx + L / 2} y2={sideY + FD / 2 + 3} stroke={dim} strokeWidth="0.3" />
      <text x={cx} y={sideY + FD / 2 + 6} fill={dim} fontSize="2.4" textAnchor="middle">
        {lengthM.toFixed(1)} m length
      </text>
    </svg>
  )
}
