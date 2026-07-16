import { RATIO, fuselagePath, wingPath, htPath } from './Blueprint.jsx'

/**
 * True-scale silhouette overlay of two aircraft, sharing one scale factor so
 * relative size is honest (unlike the per-sheet Blueprint views, which each
 * normalise to fit their box). Noses are aligned so length differences read
 * at the tail; profiles sit on a common ground line so height differences
 * read at the fin. Uses the same parametric shape builders as the blueprints.
 */

// one aircraft's plan-view (top) outline
function PlanSilhouette({ d, s, x0, cy, color, fillOpacity }) {
  const L = d.lengthM * s
  const W = d.wingspanM * s
  const r = (d.fuselageDiaM * s) / 2
  return (
    <g stroke={color} fill={color} fillOpacity={fillOpacity} strokeWidth="0.6">
      {[1, -1].map((dir) => (
        <path key={`w${dir}`} d={wingPath(x0, L, cy, r, W, dir)} />
      ))}
      {[1, -1].map((dir) => (
        <path key={`h${dir}`} d={htPath(x0, L, cy, r, W, dir)} />
      ))}
      <path d={fuselagePath(x0, L, cy, r)} />
    </g>
  )
}

// one aircraft's profile-view (side) outline, sitting on groundY
function ProfileSilhouette({ d, s, x0, groundY, color, fillOpacity }) {
  const L = d.lengthM * s
  const H = d.heightM * s
  const r = (d.fuselageDiaM * s) / 2
  const cy = groundY - H * 0.16 - r // same ground relation the blueprint uses
  const finTopY = cy - H + r * 0.6
  const upsweep = r * 0.45
  return (
    <g stroke={color} fill={color} fillOpacity={fillOpacity} strokeWidth="0.6">
      <path d={fuselagePath(x0, L, cy, r, upsweep)} />
      {/* fin */}
      <path d={`M ${x0 + L * RATIO.finLEFrac} ${cy - r} L ${x0 + L * 0.95} ${finTopY} L ${x0 + L * 0.995} ${finTopY} L ${x0 + L * 0.93} ${cy - r} Z`} />
      {/* h-stab */}
      <path d={`M ${x0 + L * RATIO.finLEFrac} ${cy - r * 0.65} l ${L * RATIO.htRootFrac * 1.1} ${-r * 0.15} l 0 ${r * 0.3} l ${-L * RATIO.htRootFrac * 1.1} ${r * 0.05} Z`} />
      {/* wing edge-on */}
      <path d={`M ${x0 + L * RATIO.wingLEFrac} ${cy + r * 0.45} l ${L * 0.12} ${r * 0.55} l ${L * 0.07} 0 l ${-L * 0.06} ${-r * 0.55} Z`} />
    </g>
  )
}

export default function CompareOverlay({ a, b, colorA = '#d8ff3e', colorB = '#86b7ff' }) {
  const da = a.dimensions
  const db = b.dimensions
  const VB_W = 250
  const margin = 12

  // one scale for both aircraft: fit the larger one in each dimension
  const maxL = Math.max(da.lengthM, db.lengthM)
  const maxW = Math.max(da.wingspanM, db.wingspanM)
  const maxH = Math.max(da.heightM, db.heightM)
  const s = Math.min((VB_W - margin * 2) / maxL, 92 / maxW)

  const planCy = 10 + (maxW * s) / 2
  const groundY = planCy + (maxW * s) / 2 + 14 + maxH * s
  const VB_H = groundY + 10
  const x0 = margin

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`${a.name} overlaid on ${b.name} at true relative scale`}
      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)' }}
      fontFamily="var(--mono)"
    >
      <text x={margin} y={7} fontSize="3.2" fill="#7d828c" letterSpacing="0.6">PLAN · NOSES ALIGNED · TRUE RELATIVE SCALE</text>
      <PlanSilhouette d={db} s={s} x0={x0} cy={planCy} color={colorB} fillOpacity={0.10} />
      <PlanSilhouette d={da} s={s} x0={x0} cy={planCy} color={colorA} fillOpacity={0.10} />

      <text x={margin} y={planCy + (maxW * s) / 2 + 10} fontSize="3.2" fill="#7d828c" letterSpacing="0.6">PROFILE · COMMON GROUND LINE</text>
      <line x1={margin - 4} y1={groundY} x2={VB_W - margin + 4} y2={groundY} stroke="#4a4f59" strokeWidth="0.4" strokeDasharray="2 1.4" />
      <ProfileSilhouette d={db} s={s} x0={x0} groundY={groundY} color={colorB} fillOpacity={0.10} />
      <ProfileSilhouette d={da} s={s} x0={x0} groundY={groundY} color={colorA} fillOpacity={0.10} />
    </svg>
  )
}
