/**
 * A data-driven engineering general-arrangement (GA) drawing. Renders three
 * orthographic views — plan (top), profile (side) and front — scaled directly
 * from the aircraft's `dimensions`, with full dimension callouts (extension
 * lines + arrowheads), structural detail (doors, windows, control surfaces,
 * sharklets, landing gear, pylons) and a titled spec data block in the corner.
 *
 * Outlines are derived parametrically from the four core dimensions using
 * realistic A320-family proportions, so every variant renders an exact-looking
 * sheet straight from its numbers. Pure SVG — fast, printable, no 3D.
 */

// Realistic narrowbody proportions, expressed as fractions of a core dimension.
const RATIO = {
  noseFrac: 0.11, // nose taper length / fuselage length
  tailFrac: 0.16, // tail upsweep length / fuselage length
  wingRootFrac: 0.16, // wing root chord / length
  wingTipFrac: 0.06, // wing tip chord / length
  wingLEFrac: 0.30, // wing leading-edge root x (from nose) / length
  wingSweep: 0.13, // tip is swept back by sweep*length
  htRootFrac: 0.10, // h-stab root chord / length
  htTipFrac: 0.045,
  htSpanFrac: 0.38, // h-stab span / wingspan
  vtChordFrac: 0.14, // fin root chord / length
  finLEFrac: 0.80, // fin LE x (from nose) / length
  gearTrackFrac: 0.21, // main gear track / wingspan
  enginePosFrac: 0.40, // engine spanwise pos / half-span
}

export default function Blueprint({ dimensions, engineCount = 2, aircraft }) {
  const { lengthM, wingspanM, heightM, fuselageDiaM } = dimensions

  // ----- layout / scale -----------------------------------------------------
  // A tall sheet: plan on top, side in the middle, front bottom-right, data
  // block bottom-left. Drawn in a 200×260 user-unit viewBox.
  const VB_W = 200
  const VB_H = 268
  const margin = 12
  // Scale so the longest dimension fits the drawing column width.
  const drawW = VB_W - margin * 2
  const scale = drawW / Math.max(lengthM, wingspanM)

  const L = lengthM * scale
  const W = wingspanM * scale
  const H = heightM * scale
  const FD = fuselageDiaM * scale

  // Colours (engineering-drawing palette on a dark sheet).
  const C = {
    sheet: '#0d1117',
    grid: '#16202c',
    gridMaj: '#1e2c3b',
    ink: '#58a6ff', // primary outline
    inkSoft: '#3d6ea5', // secondary / hidden-ish detail
    dim: '#8b98a6', // dimension lines & text
    accent: '#f0a020', // sharklets / fin / highlights
    glass: '#274463', // window fill
    fill: 'rgba(40,80,130,0.10)',
  }

  // View origins (x = nose at left of each band; centreline y).
  const nose = margin
  const planCY = 44
  const sideCY = 128
  const frontCX = 150
  const frontCY = 210

  // ----- shared geometry helpers -------------------------------------------
  const noseLen = L * RATIO.noseFrac
  const tailLen = L * RATIO.tailFrac
  const bodyR = FD / 2

  // Fuselage plan/elevation outline as a smooth capsule with pointed nose and
  // upswept tail (returned as an SVG path, centred on cy).
  function fuselagePath(cy, upsweep = 0) {
    const x0 = nose
    const x1 = nose + L
    const noseX = x0 + noseLen
    const tailX = x1 - tailLen
    const r = bodyR
    // top edge L→R then bottom edge R→L
    return [
      `M ${x0} ${cy}`,
      `C ${x0} ${cy - r * 0.7} ${noseX - r} ${cy - r} ${noseX} ${cy - r}`,
      `L ${tailX} ${cy - r}`,
      // tail upsweep: top stays, bottom rises
      `Q ${x1 - tailLen * 0.3} ${cy - r} ${x1} ${cy - r * 0.35 - upsweep}`,
      `L ${x1} ${cy + r * 0.35 - upsweep}`,
      `Q ${x1 - tailLen * 0.3} ${cy + r} ${tailX} ${cy + r}`,
      `L ${noseX} ${cy + r}`,
      `C ${noseX - r} ${cy + r} ${x0} ${cy + r * 0.7} ${x0} ${cy}`,
      'Z',
    ].join(' ')
  }

  // Wing half-planform (top view), one side. dir = +1 (down) / -1 (up) in SVG.
  function wingPath(cy, dir) {
    const leRoot = nose + L * RATIO.wingLEFrac
    const rootChord = L * RATIO.wingRootFrac
    const tipChord = L * RATIO.wingTipFrac
    const sweep = L * RATIO.wingSweep
    const tipY = cy + dir * (W / 2)
    const rootInner = cy + dir * bodyR * 0.8
    const leTip = leRoot + sweep
    return [
      `M ${leRoot} ${rootInner}`,
      `L ${leTip} ${tipY}`,
      `L ${leTip + tipChord} ${tipY}`,
      `L ${leRoot + rootChord} ${rootInner}`,
      'Z',
    ].join(' ')
  }

  // Horizontal stabiliser half (top view).
  function htPath(cy, dir) {
    const leRoot = nose + L * RATIO.finLEFrac
    const rootChord = L * RATIO.htRootFrac
    const tipChord = L * RATIO.htTipFrac
    const sweep = L * 0.06
    const span = (W * RATIO.htSpanFrac) / 2
    const tipY = cy + dir * span
    const rootInner = cy + dir * bodyR * 0.6
    return [
      `M ${leRoot} ${rootInner}`,
      `L ${leRoot + sweep} ${tipY}`,
      `L ${leRoot + sweep + tipChord} ${tipY}`,
      `L ${leRoot + rootChord} ${rootInner}`,
      'Z',
    ].join(' ')
  }

  // ----- dimension-callout primitives --------------------------------------
  function HDim({ x1, x2, y, label, off = 0 }) {
    const yl = y + off
    return (
      <g stroke={C.dim} strokeWidth="0.35" fill={C.dim}>
        <line x1={x1} y1={y} x2={x1} y2={yl} />
        <line x1={x2} y1={y} x2={x2} y2={yl} />
        <line x1={x1} y1={yl} x2={x2} y2={yl} />
        <Arrow x={x1} y={yl} dir="left" />
        <Arrow x={x2} y={yl} dir="right" />
        <text x={(x1 + x2) / 2} y={yl - 1.4} fontSize="3.2" textAnchor="middle" stroke="none">
          {label}
        </text>
      </g>
    )
  }
  function VDim({ y1, y2, x, label, off = 0 }) {
    const xl = x + off
    return (
      <g stroke={C.dim} strokeWidth="0.35" fill={C.dim}>
        <line x1={x} y1={y1} x2={xl} y2={y1} />
        <line x1={x} y1={y2} x2={xl} y2={y2} />
        <line x1={xl} y1={y1} x2={xl} y2={y2} />
        <Arrow x={xl} y={y1} dir="up" />
        <Arrow x={xl} y={y2} dir="down" />
        <text
          x={xl - 1.6}
          y={(y1 + y2) / 2}
          fontSize="3.2"
          textAnchor="middle"
          stroke="none"
          transform={`rotate(-90 ${xl - 1.6} ${(y1 + y2) / 2})`}
        >
          {label}
        </text>
      </g>
    )
  }
  function Arrow({ x, y, dir }) {
    const s = 1.3
    const pts = {
      left: `${x},${y} ${x + s},${y - s} ${x + s},${y + s}`,
      right: `${x},${y} ${x - s},${y - s} ${x - s},${y + s}`,
      up: `${x},${y} ${x - s},${y + s} ${x + s},${y + s}`,
      down: `${x},${y} ${x - s},${y - s} ${x + s},${y - s}`,
    }[dir]
    return <polygon points={pts} stroke="none" />
  }

  // ----- engine spanwise placement (shared by plan + front) -----------------
  const perSide = Math.max(1, Math.round(engineCount / 2))
  const engineYs = []
  for (const side of [-1, 1]) {
    for (let i = 0; i < perSide; i++) {
      const frac = perSide === 1 ? RATIO.enginePosFrac : 0.3 + (i / Math.max(1, perSide - 1)) * 0.2
      engineYs.push(side * (W / 2) * frac)
    }
  }
  const engineLen = FD * 1.6
  const engineR = FD * 0.42
  const engineX = nose + L * (RATIO.wingLEFrac - 0.06)

  // Window band (side view): evenly spaced portholes along the cabin.
  const winCount = Math.max(6, Math.round(lengthM * 0.9))
  const winStart = nose + noseLen + 2
  const winEnd = nose + L - tailLen - 2
  const windows = Array.from({ length: winCount }, (_, i) => winStart + ((winEnd - winStart) * i) / (winCount - 1))

  // Cabin doors (side view): 4 main doors at realistic stations.
  const doors = [0.16, 0.34, 0.62, 0.86].map((f) => nose + noseLen + (winEnd - winStart) * f)

  // ----- spec data-block rows ----------------------------------------------
  const d = dimensions
  const specRows = [
    ['LENGTH', `${lengthM.toFixed(2)} m`],
    ['WINGSPAN', `${wingspanM.toFixed(2)} m`],
    ['HEIGHT', `${heightM.toFixed(2)} m`],
    ['FUSELAGE Ø', `${fuselageDiaM.toFixed(2)} m`],
    ['MTOW', `${d.mtowKg.toLocaleString()} kg`],
    ['RANGE', `${d.rangeKm.toLocaleString()} km`],
    ['CRUISE', `Mach ${d.cruiseMach}`],
    ['CEILING', `${d.ceilingM.toLocaleString()} m`],
    ['SEATS', `${d.paxTypical}–${d.paxMax}`],
  ]

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`${aircraft?.name ?? 'Aircraft'} general-arrangement blueprint`}
      style={{ width: '100%', background: C.sheet, borderRadius: 12 }}
    >
      {/* ---- grid ---- */}
      <g>
        {Array.from({ length: Math.ceil(VB_W / 10) + 1 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2={VB_H} stroke={i % 5 ? C.grid : C.gridMaj} strokeWidth="0.25" />
        ))}
        {Array.from({ length: Math.ceil(VB_H / 10) + 1 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 10} x2={VB_W} y2={i * 10} stroke={i % 5 ? C.grid : C.gridMaj} strokeWidth="0.25" />
        ))}
      </g>

      {/* sheet border */}
      <rect x="2" y="2" width={VB_W - 4} height={VB_H - 4} fill="none" stroke={C.inkSoft} strokeWidth="0.5" />

      {/* ============================ PLAN (TOP) ============================ */}
      <g>
        <text x={nose} y={planCY - W / 2 - 4} fontSize="3.4" fill={C.dim}>PLAN VIEW</text>
        {/* wings */}
        <path d={wingPath(planCY, 1)} fill={C.fill} stroke={C.ink} strokeWidth="0.5" />
        <path d={wingPath(planCY, -1)} fill={C.fill} stroke={C.ink} strokeWidth="0.5" />
        {/* aileron hint (trailing-edge break near tips) */}
        {[1, -1].map((dir) => {
          const leRoot = nose + L * RATIO.wingLEFrac
          const sweep = L * RATIO.wingSweep
          const tipY = planCY + dir * (W / 2)
          const x = leRoot + sweep + L * RATIO.wingTipFrac * 0.2
          return <line key={`ail${dir}`} x1={x} y1={tipY} x2={x - L * 0.02} y2={planCY + dir * (W * 0.34)} stroke={C.inkSoft} strokeWidth="0.3" />
        })}
        {/* horizontal stabiliser */}
        <path d={htPath(planCY, 1)} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
        <path d={htPath(planCY, -1)} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
        {/* fuselage */}
        <path d={fuselagePath(planCY)} fill={C.fill} stroke={C.ink} strokeWidth="0.6" />
        {/* centreline */}
        <line x1={nose - 4} y1={planCY} x2={nose + L + 4} y2={planCY} stroke={C.inkSoft} strokeWidth="0.3" strokeDasharray="3 1.5 0.6 1.5" />
        {/* engines (nacelles) */}
        {engineYs.map((ey, i) => (
          <g key={`pe${i}`}>
            <rect
              x={engineX}
              y={planCY + ey - engineR}
              width={engineLen}
              height={engineR * 2}
              rx={engineR}
              fill={C.fill}
              stroke={C.ink}
              strokeWidth="0.45"
            />
            {/* pylon to fuselage/wing */}
            <line x1={engineX + engineLen * 0.6} y1={planCY + ey} x2={engineX + engineLen * 0.6} y2={planCY + ey * 0.2} stroke={C.inkSoft} strokeWidth="0.4" />
          </g>
        ))}

        {/* ---- callouts: wingspan + length ---- */}
        <VDim y1={planCY - W / 2} y2={planCY + W / 2} x={nose - 4} off={-3} label={`${wingspanM.toFixed(1)} m`} />
        <HDim x1={nose} x2={nose + L} y={planCY + W / 2 + 2} off={5} label={`${lengthM.toFixed(1)} m`} />
      </g>

      {/* ============================ PROFILE (SIDE) ======================== */}
      <g>
        <text x={nose} y={sideCY - bodyR - 5} fontSize="3.4" fill={C.dim}>PROFILE VIEW</text>
        {/* fuselage with upswept tail */}
        <path d={fuselagePath(sideCY, FD * 0.35)} fill={C.fill} stroke={C.ink} strokeWidth="0.6" />
        {/* flight-deck windows */}
        <path
          d={`M ${nose + noseLen * 0.2} ${sideCY - bodyR * 0.45} q ${noseLen * 0.4} ${-bodyR * 0.25} ${noseLen * 0.7} 0`}
          fill="none"
          stroke={C.glass}
          strokeWidth="1.1"
        />
        {/* cabin windows */}
        {windows.map((wx, i) => (
          <circle key={`w${i}`} cx={wx} cy={sideCY - bodyR * 0.15} r="0.7" fill={C.glass} />
        ))}
        {/* doors */}
        {doors.map((dx, i) => (
          <rect key={`d${i}`} x={dx - 0.9} y={sideCY - bodyR * 0.55} width="1.8" height={bodyR * 1.0} rx="0.4" fill="none" stroke={C.inkSoft} strokeWidth="0.4" />
        ))}
        {/* wing root (seen edge-on, lower fuselage) */}
        <path
          d={`M ${nose + L * RATIO.wingLEFrac} ${sideCY + bodyR * 0.5} l ${L * 0.1} ${bodyR * 0.5} l ${L * 0.06} 0 l ${-L * 0.05} ${-bodyR * 0.5} Z`}
          fill={C.fill}
          stroke={C.ink}
          strokeWidth="0.45"
        />
        {/* vertical tail fin + rudder split */}
        <path
          d={`M ${nose + L * RATIO.finLEFrac} ${sideCY - bodyR}
             L ${nose + L * 0.94} ${sideCY - H + bodyR}
             L ${nose + L * 0.985} ${sideCY - H + bodyR}
             L ${nose + L * 0.9} ${sideCY - bodyR} Z`}
          fill={C.fill}
          stroke={C.ink}
          strokeWidth="0.5"
        />
        <line
          x1={nose + L * 0.935}
          y1={sideCY - H + bodyR + 1}
          x2={nose + L * 0.965}
          y2={sideCY - bodyR}
          stroke={C.accent}
          strokeWidth="0.4"
          strokeDasharray="1.5 1"
        />
        {/* horizontal stabiliser (edge-on) */}
        <path
          d={`M ${nose + L * RATIO.finLEFrac} ${sideCY - bodyR * 0.2} l ${L * RATIO.htRootFrac} ${-bodyR * 0.1} l 0 ${bodyR * 0.3} l ${-L * RATIO.htRootFrac} ${bodyR * 0.1} Z`}
          fill={C.fill}
          stroke={C.ink}
          strokeWidth="0.4"
        />
        {/* engine nacelle (side) under wing */}
        <ellipse cx={engineX + engineLen / 2} cy={sideCY + bodyR * 1.0} rx={engineLen / 2} ry={engineR} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
        <line x1={engineX + engineLen * 0.55} y1={sideCY + bodyR * 1.0 - engineR} x2={engineX + engineLen * 0.55} y2={sideCY + bodyR * 0.55} stroke={C.inkSoft} strokeWidth="0.4" />
        {/* nose & main landing gear (deployed) */}
        <Gear x={nose + noseLen + 1} groundY={sideCY + bodyR + H * 0.16} topY={sideCY + bodyR} color={C.ink} soft={C.inkSoft} />
        <Gear x={nose + L * (RATIO.wingLEFrac + RATIO.wingRootFrac * 0.5)} groundY={sideCY + bodyR + H * 0.16} topY={sideCY + bodyR} color={C.ink} soft={C.inkSoft} />
        {/* ground line */}
        <line x1={nose - 4} y1={sideCY + bodyR + H * 0.16} x2={nose + L + 4} y2={sideCY + bodyR + H * 0.16} stroke={C.inkSoft} strokeWidth="0.4" strokeDasharray="2 1.5" />

        {/* ---- callouts: height ---- */}
        <VDim y1={sideCY - H + bodyR} y2={sideCY + bodyR + H * 0.16} x={nose + L + 4} off={4} label={`${heightM.toFixed(1)} m`} />
      </g>

      {/* ============================ FRONT VIEW =========================== */}
      <g>
        <text x={frontCX - W / 2} y={frontCY - H * 0.7} fontSize="3.4" fill={C.dim}>FRONT VIEW</text>
        {/* full-span wing (head-on, slight dihedral) */}
        <path
          d={`M ${frontCX} ${frontCY - bodyR * 0.2}
             L ${frontCX - W / 2} ${frontCY - bodyR * 0.2 - W * 0.03}
             L ${frontCX - W / 2} ${frontCY - bodyR * 0.05 - W * 0.03}
             L ${frontCX} ${frontCY + bodyR * 0.1}
             L ${frontCX + W / 2} ${frontCY - bodyR * 0.05 - W * 0.03}
             L ${frontCX + W / 2} ${frontCY - bodyR * 0.2 - W * 0.03} Z`}
          fill={C.fill}
          stroke={C.ink}
          strokeWidth="0.45"
        />
        {/* sharklets (upturned wingtips) */}
        {[-1, 1].map((s) => (
          <line
            key={`sk${s}`}
            x1={frontCX + s * (W / 2)}
            y1={frontCY - bodyR * 0.2 - W * 0.03}
            x2={frontCX + s * (W / 2 - 1)}
            y2={frontCY - bodyR * 0.2 - W * 0.03 - H * 0.16}
            stroke={C.accent}
            strokeWidth="0.8"
          />
        ))}
        {/* fuselage circle */}
        <circle cx={frontCX} cy={frontCY} r={bodyR} fill={C.fill} stroke={C.ink} strokeWidth="0.6" />
        {/* vertical fin */}
        <rect x={frontCX - 0.7} y={frontCY - H + bodyR} width="1.4" height={H - bodyR * 2} fill={C.fill} stroke={C.ink} strokeWidth="0.4" />
        {/* engines head-on (fan disks) */}
        {engineYs.map((ey, i) => (
          <g key={`fe${i}`}>
            <circle cx={frontCX + ey} cy={frontCY + bodyR * 0.9} r={engineR} fill={C.fill} stroke={C.ink} strokeWidth="0.5" />
            <circle cx={frontCX + ey} cy={frontCY + bodyR * 0.9} r={engineR * 0.32} fill="none" stroke={C.inkSoft} strokeWidth="0.4" />
          </g>
        ))}
        {/* gear track */}
        <line x1={frontCX - (W * RATIO.gearTrackFrac) / 2} y1={frontCY + bodyR + H * 0.16} x2={frontCX + (W * RATIO.gearTrackFrac) / 2} y2={frontCY + bodyR + H * 0.16} stroke={C.inkSoft} strokeWidth="0.4" />
        {[-1, 1].map((s) => (
          <line key={`gl${s}`} x1={frontCX + s * (W * RATIO.gearTrackFrac) / 2} y1={frontCY + bodyR} x2={frontCX + s * (W * RATIO.gearTrackFrac) / 2} y2={frontCY + bodyR + H * 0.16} stroke={C.ink} strokeWidth="0.5" />
        ))}
        {/* callout: gear track */}
        <HDim x1={frontCX - (W * RATIO.gearTrackFrac) / 2} x2={frontCX + (W * RATIO.gearTrackFrac) / 2} y={frontCY + bodyR + H * 0.16} off={6} label="track" />
      </g>

      {/* ============================ DATA BLOCK =========================== */}
      <g>
        <rect x={margin} y={VB_H - 58} width="92" height="52" fill="rgba(10,18,28,0.85)" stroke={C.ink} strokeWidth="0.5" />
        <rect x={margin} y={VB_H - 58} width="92" height="9" fill="rgba(40,80,130,0.25)" stroke={C.ink} strokeWidth="0.5" />
        <text x={margin + 3} y={VB_H - 51.5} fontSize="4" fill={C.ink} fontWeight="700">
          {(aircraft?.name ?? 'AIRCRAFT').toUpperCase()}
        </text>
        <text x={margin + 89} y={VB_H - 51.5} fontSize="2.6" fill={C.dim} textAnchor="end">
          GA DRAWING
        </text>
        {specRows.map(([k, v], i) => {
          const col = i < 5 ? 0 : 1
          const row = i % 5
          const x = margin + 3 + col * 46
          const y = VB_H - 45 + row * 7.4
          return (
            <g key={k}>
              <text x={x} y={y} fontSize="2.7" fill={C.dim}>{k}</text>
              <text x={x + 43} y={y} fontSize="2.7" fill="#cdd9e5" textAnchor="end">{v}</text>
            </g>
          )
        })}
      </g>

      {/* scale + note */}
      <text x={VB_W - margin} y={VB_H - 9} fontSize="2.6" fill={C.dim} textAnchor="end">
        DIMENSIONS NOMINAL · DERIVED FROM TYPE DATA
      </text>
    </svg>
  )
}

/** Deployed landing-gear strut + wheels (side view). */
function Gear({ x, groundY, topY, color, soft }) {
  const len = groundY - topY
  return (
    <g stroke={color} strokeWidth="0.5" fill="none">
      <line x1={x} y1={topY} x2={x} y2={groundY - 1.2} />
      <circle cx={x} cy={groundY - 0.9} r="1.1" fill={soft} stroke={color} strokeWidth="0.4" />
      <circle cx={x + 1.6} cy={groundY - 0.9} r="1.1" fill={soft} stroke={color} strokeWidth="0.4" />
      <line x1={x} y1={topY + len * 0.3} x2={x + 1.6} y2={groundY - 0.9} stroke={soft} strokeWidth="0.35" />
    </g>
  )
}
