/**
 * A detailed engineering general-arrangement (GA) drawing of the aircraft —
 * bright cyanotype-blue sheet, white line art, in the style of a real printed
 * technical sheet rather than a decorative poster.
 *
 * Sheet zones:
 *   • Title + SPECIFICATIONS list ............... top-left
 *   • PLAN (top) view + numbered callouts ....... top-right
 *   • PROFILE (side) view + callouts ............ middle band, full width
 *   • FRONT view + callouts ..................... bottom-left
 *   • COMPONENT SCHEDULE (numbered key) ......... right column
 *   • POWERPLANT / DIMENSION DATA tables ........ right column
 *   • Formal TITLE BLOCK (drawing no., scale,
 *     projection symbol, revision, units) ....... bottom strip
 *
 * Every outline AND every callout/leader is derived parametrically from the
 * aircraft's dimensions + engine data, so each variant renders an exact-looking,
 * fully annotated sheet straight from its numbers. Pure SVG — fast, printable.
 */

// Realistic narrowbody proportions, expressed as fractions of a core dimension.
export const RATIO = {
  noseFrac: 0.10, // nose taper length / fuselage length
  tailFrac: 0.20, // tail upsweep length / fuselage length
  wingRootFrac: 0.17, // wing root chord / length
  wingTipFrac: 0.05, // wing tip chord / length
  wingLEFrac: 0.40, // wing leading-edge root x (from nose) / length
  wingSweep: 0.16, // tip is swept back by sweep*length
  htRootFrac: 0.11, // h-stab root chord / length
  htTipFrac: 0.04,
  htSpanFrac: 0.36, // h-stab span / wingspan
  vtChordFrac: 0.16, // fin root chord / length
  finLEFrac: 0.80, // fin LE x (from nose) / length
  gearTrackFrac: 0.21, // main gear track / wingspan
  wheelbaseFrac: 0.38, // nose-to-main-gear / length
  enginePosFrac: 0.34, // engine spanwise pos / half-span
}

export default function Blueprint({ dimensions, engineCount = 2, aircraft, subtitle, doubleDeck = false, wideBody = false }) {
  const d = dimensions

  // Cyanotype palette — bright blue sheet, white ink.
  const C = {
    sheet: '#0a4dab',
    sheet2: '#0846a0',
    grid: 'rgba(255,255,255,0.055)',
    gridMaj: 'rgba(255,255,255,0.1)',
    ink: '#eaf2ff', // primary white outline
    inkSoft: 'rgba(234,242,255,0.55)', // secondary detail
    inkFaint: 'rgba(234,242,255,0.28)',
    dim: 'rgba(234,242,255,0.88)', // dimension lines & text
    fill: 'rgba(255,255,255,0.04)',
    glass: 'rgba(255,255,255,0.22)',
  }

  // ----- sheet layout -------------------------------------------------------
  const VB_W = 240
  const VB_H = 304
  const margin = 10
  const colX = 168 // left edge of the right-hand annotation/schedule column

  // Component schedule is built up by each view via this shared registry so the
  // numbered tags on the drawing and the key on the right stay in lock-step.
  const schedule = buildSchedule(aircraft, engineCount)

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`${aircraft?.name ?? 'Aircraft'} general-arrangement engineering drawing`}
      style={{ width: '100%', background: C.sheet, borderRadius: 12 }}
      fontFamily="'Courier New', ui-monospace, monospace"
    >
      <defs>
        <radialGradient id="bpVignette" cx="46%" cy="36%" r="82%">
          <stop offset="0%" stopColor={C.sheet} />
          <stop offset="100%" stopColor={C.sheet2} />
        </radialGradient>
      </defs>

      {/* ---- sheet + grid ---- */}
      <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#bpVignette)" />
      <g>
        {Array.from({ length: Math.ceil(VB_W / 6) + 1 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 6} y1="0" x2={i * 6} y2={VB_H} stroke={i % 5 ? C.grid : C.gridMaj} strokeWidth="0.25" />
        ))}
        {Array.from({ length: Math.ceil(VB_H / 6) + 1 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 6} x2={VB_W} y2={i * 6} stroke={i % 5 ? C.grid : C.gridMaj} strokeWidth="0.25" />
        ))}
      </g>
      {/* sheet border (double rule) + drawing-frame zone letters/numbers */}
      <rect x="3" y="3" width={VB_W - 6} height={VB_H - 6} fill="none" stroke={C.inkSoft} strokeWidth="0.5" />
      <rect x="5" y="5" width={VB_W - 10} height={VB_H - 10} fill="none" stroke={C.inkFaint} strokeWidth="0.3" />
      <FrameZones C={C} VB_W={VB_W} VB_H={VB_H} />

      {/* column separator */}
      <line x1={colX - 4} y1={36} x2={colX - 4} y2={VB_H - 58} stroke={C.inkFaint} strokeWidth="0.3" strokeDasharray="1.5 1.5" />

      {/* ============================ TITLE + SPECS ======================= */}
      <TitleBlock C={C} aircraft={aircraft} d={d} margin={margin} subtitle={subtitle} />

      {/* ============================ DRAWING VIEWS ======================= */}
      <PlanView C={C} dims={d} engineCount={engineCount} colX={colX} />
      <ProfileView C={C} dims={d} engineCount={engineCount} colX={colX} doubleDeck={doubleDeck} />
      <FrontView C={C} dims={d} engineCount={engineCount} doubleDeck={doubleDeck} />

      {/* ============================ RIGHT COLUMN ======================== */}
      <ComponentSchedule C={C} x={colX} y={40} schedule={schedule} />
      <DataTables C={C} x={colX} y={40 + 7 + schedule.length * 4.65 + 5} d={d} aircraft={aircraft} engineCount={engineCount} />

      {/* ================== NOTES / REVISIONS / SCALE BAR ================ */}
      <NotesBlock C={C} x={margin + 2} y={VB_H - 52} />
      <RevTable C={C} x={118} y={VB_H - 52} w={72} />
      <ScaleBar C={C} x={196} y={VB_H - 46} scale={(colX - 12 - 8 - 14) / d.lengthM} />

      {/* ============================ TITLE BLOCK ======================== */}
      <DrawingTitleBlock C={C} aircraft={aircraft} d={d} VB_W={VB_W} VB_H={VB_H} margin={margin} />
    </svg>
  )
}

/* =====================================================================
 * GENERAL NOTES — the numbered notes column every real sheet carries
 * ===================================================================== */
function NotesBlock({ C, x, y }) {
  const notes = [
    'ALL DIMENSIONS IN METRES UNLESS NOTED.',
    'DO NOT SCALE DRAWING — USE STATED DIMENSIONS.',
    'OUTLINES GENERATED PARAMETRICALLY FROM PUBLISHED TYPE DATA.',
    'FUSELAGE STATIONS (FS) MEASURED IN METRES AFT OF NOSE DATUM.',
    'SAFETY & PERFORMANCE FIGURES PER ATTRIBUTED PUBLIC SOURCES.',
  ]
  return (
    <g>
      <text x={x} y={y} fontSize="3.2" fill={C.ink} fontWeight="700" letterSpacing="0.8">GENERAL NOTES</text>
      <line x1={x} y1={y + 1.8} x2={x + 98} y2={y + 1.8} stroke={C.inkSoft} strokeWidth="0.35" />
      {notes.map((n, i) => (
        <text key={i} x={x} y={y + 6 + i * 3.6} fontSize="2.15" fill={C.dim} letterSpacing="0.1">
          {i + 1}.  {n}
        </text>
      ))}
    </g>
  )
}

/* =====================================================================
 * REVISION TABLE — REV / DESCRIPTION / DATE
 * ===================================================================== */
function RevTable({ C, x, y, w }) {
  const rows = [
    ['REV', 'DESCRIPTION', 'DATE'],
    ['A', 'INITIAL ISSUE — PARAMETRIC GA', new Date().toISOString().slice(0, 10)],
  ]
  const colW = [8, w - 30, 22]
  const rh = 5.4
  return (
    <g>
      <text x={x} y={y} fontSize="3.2" fill={C.ink} fontWeight="700" letterSpacing="0.8">REVISIONS</text>
      {rows.map((r, ri) => {
        let cx = x
        const ry = y + 2.4 + ri * rh
        return (
          <g key={ri}>
            {r.map((cell, ci) => {
              const el = (
                <g key={ci}>
                  <rect x={cx} y={ry} width={colW[ci]} height={rh} fill="none" stroke={C.inkSoft} strokeWidth="0.25" />
                  <text x={cx + 1.4} y={ry + 3.6} fontSize="2.1" fill={ri === 0 ? C.inkSoft : C.dim}>{cell}</text>
                </g>
              )
              cx += colW[ci]
              return el
            })}
          </g>
        )
      })}
    </g>
  )
}

/* =====================================================================
 * GRAPHIC SCALE BAR — measured against the profile view's scale
 * ===================================================================== */
function ScaleBar({ C, x, y, scale }) {
  // pick the largest round span that still fits inside the sheet border
  const fits = (m) => m * scale <= 32
  const maxM = fits(20) ? 20 : fits(10) ? 10 : 5
  const seg = maxM / 4
  return (
    <g>
      <text x={x} y={y - 2} fontSize="2.4" fill={C.dim} letterSpacing="0.4">GRAPHIC SCALE · PROFILE</text>
      {Array.from({ length: 4 }).map((_, i) => (
        <rect
          key={i}
          x={x + i * seg * scale}
          y={y}
          width={seg * scale}
          height={2.2}
          fill={i % 2 ? C.ink : 'none'}
          stroke={C.ink}
          strokeWidth="0.3"
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <text key={i} x={x + i * seg * scale} y={y + 5.6} fontSize="2" fill={C.dim} textAnchor="middle">
          {Math.round(i * seg)}
        </text>
      ))}
      <text x={x + maxM * scale + 4} y={y + 5.6} fontSize="2" fill={C.dim}>m</text>
    </g>
  )
}

/* =====================================================================
 * Component schedule (numbered key). Built once and shared between the
 * leader tags on the drawing and the legend on the right so numbers match.
 * ===================================================================== */
function buildSchedule(aircraft, engineCount) {
  const eng = aircraft?.engines?.[0]
  const engName = eng ? eng.name : 'TURBOFAN'
  return [
    { n: 1, label: 'RADOME / WX RADAR' },
    { n: 2, label: 'FLIGHT DECK' },
    { n: 3, label: 'FWD PRESSURE BULKHEAD' },
    { n: 4, label: 'PASSENGER / SERVICE DOOR' },
    { n: 5, label: 'CABIN WINDOW BELT' },
    { n: 6, label: 'CENTRE WING BOX' },
    { n: 7, label: 'LE SLATS' },
    { n: 8, label: 'TE FLAPS' },
    { n: 9, label: 'AILERON' },
    { n: 10, label: 'WINGTIP DEVICE / WINGLET' },
    { n: 11, label: `${engineCount}× ${engName}` },
    { n: 12, label: 'ENGINE PYLON' },
    { n: 13, label: 'MAIN LANDING GEAR' },
    { n: 14, label: 'NOSE LANDING GEAR' },
    { n: 15, label: 'HORIZONTAL STABILISER' },
    { n: 16, label: 'ELEVATOR' },
    { n: 17, label: 'VERTICAL STABILISER' },
    { n: 18, label: 'RUDDER' },
    { n: 19, label: 'APU EXHAUST' },
    { n: 20, label: 'AFT PRESSURE BULKHEAD' },
  ]
}

/* =====================================================================
 * Parametric airframe geometry (shared by the views)
 * ===================================================================== */
export function fuselagePath(x0, L, cy, r, upsweep = 0) {
  const noseLen = L * RATIO.noseFrac
  const tailLen = L * RATIO.tailFrac
  const noseX = x0 + noseLen
  const tailX = x0 + L - tailLen
  const tipX = x0 + L
  return [
    `M ${x0} ${cy}`,
    `C ${x0 + noseLen * 0.05} ${cy - r * 0.78} ${noseX - r * 0.9} ${cy - r} ${noseX} ${cy - r}`,
    `L ${tailX} ${cy - r}`,
    `Q ${tailX + tailLen * 0.55} ${cy - r * 0.95} ${tipX} ${cy - r * 0.18 - upsweep}`,
    `L ${tipX} ${cy + r * 0.06 - upsweep}`,
    `Q ${tailX + tailLen * 0.4} ${cy + r} ${tailX} ${cy + r}`,
    `L ${noseX} ${cy + r}`,
    `C ${noseX - r * 0.9} ${cy + r} ${x0 + noseLen * 0.05} ${cy + r * 0.78} ${x0} ${cy}`,
    'Z',
  ].join(' ')
}

export function wingPath(x0, L, cy, r, span, dir) {
  const leRoot = x0 + L * RATIO.wingLEFrac
  const rootChord = L * RATIO.wingRootFrac
  const tipChord = L * RATIO.wingTipFrac
  const sweep = L * RATIO.wingSweep
  const tipY = cy + dir * (span / 2)
  const rootInner = cy + dir * r * 0.85
  const leTip = leRoot + sweep
  const teRoot = leRoot + rootChord
  return [
    `M ${leRoot} ${rootInner}`,
    `L ${leTip} ${tipY}`,
    `L ${leTip + tipChord} ${tipY}`,
    `Q ${teRoot + sweep * 0.3} ${cy + dir * span * 0.32} ${teRoot} ${rootInner}`,
    'Z',
  ].join(' ')
}

export function htPath(x0, L, cy, r, span, dir) {
  const leRoot = x0 + L * RATIO.finLEFrac
  const rootChord = L * RATIO.htRootFrac
  const tipChord = L * RATIO.htTipFrac
  const sweep = L * 0.05
  const tipY = cy + dir * (span * RATIO.htSpanFrac) / 2
  const rootInner = cy + dir * r * 0.55
  return [
    `M ${leRoot} ${rootInner}`,
    `L ${leRoot + sweep} ${tipY}`,
    `L ${leRoot + sweep + tipChord} ${tipY}`,
    `L ${leRoot + rootChord} ${rootInner}`,
    'Z',
  ].join(' ')
}

function engineOffsets(engineCount, span) {
  const perSide = Math.max(1, Math.round(engineCount / 2))
  const ys = []
  for (const side of [-1, 1]) {
    for (let i = 0; i < perSide; i++) {
      const frac = perSide === 1 ? RATIO.enginePosFrac : 0.28 + (i / Math.max(1, perSide - 1)) * 0.22
      ys.push(side * (span / 2) * frac)
    }
  }
  return ys
}

/* =====================================================================
 * Annotation primitives: dimensions + numbered leader callouts
 * ===================================================================== */
function Arrow({ x, y, dir, C, s = 1.4 }) {
  const pts = {
    left: `${x},${y} ${x + s},${y - s} ${x + s},${y + s}`,
    right: `${x},${y} ${x - s},${y - s} ${x - s},${y + s}`,
    up: `${x},${y} ${x - s},${y + s} ${x + s},${y + s}`,
    down: `${x},${y} ${x - s},${y - s} ${x + s},${y - s}`,
  }[dir]
  return <polygon points={pts} fill={C.dim} stroke="none" />
}

function HDim({ x1, x2, y, label, ext = 0, C, size = 3.2 }) {
  return (
    <g stroke={C.dim} strokeWidth="0.3">
      {ext !== 0 && <line x1={x1} y1={y - ext} x2={x1} y2={y} />}
      {ext !== 0 && <line x1={x2} y1={y - ext} x2={x2} y2={y} />}
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <Arrow x={x1} y={y} dir="left" C={C} />
      <Arrow x={x2} y={y} dir="right" C={C} />
      <text x={(x1 + x2) / 2} y={y - 1.5} fontSize={size} textAnchor="middle" stroke="none" fill={C.dim} letterSpacing="0.3">{label}</text>
    </g>
  )
}

function VDim({ y1, y2, x, label, ext = 0, C, size = 3.2 }) {
  return (
    <g stroke={C.dim} strokeWidth="0.3">
      {ext !== 0 && <line x1={x + ext} y1={y1} x2={x} y2={y1} />}
      {ext !== 0 && <line x1={x + ext} y1={y2} x2={x} y2={y2} />}
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <Arrow x={x} y={y1} dir="up" C={C} />
      <Arrow x={x} y={y2} dir="down" C={C} />
      <text x={x - 1.8} y={(y1 + y2) / 2} fontSize={size} textAnchor="middle" stroke="none" fill={C.dim} letterSpacing="0.3"
        transform={`rotate(-90 ${x - 1.8} ${(y1 + y2) / 2})`}>{label}</text>
    </g>
  )
}

// Numbered leader: a dot on the component, an elbow leader to a tag bubble.
// `tx,ty` is the tag centre; `px,py` the point being indicated.
function Leader({ n, px, py, tx, ty, C, elbow }) {
  // elbow point: go vertical first from the tag, then to the target (cleaner).
  const ex = elbow ?? tx
  const ey = py
  return (
    <g>
      <polyline points={`${tx},${ty} ${ex},${ey} ${px},${py}`} fill="none" stroke={C.inkSoft} strokeWidth="0.3" />
      <circle cx={px} cy={py} r="0.8" fill={C.ink} stroke="none" />
      <circle cx={tx} cy={ty} r="2.4" fill={C.sheet2} stroke={C.ink} strokeWidth="0.4" />
      <text x={tx} y={ty + 1.1} fontSize="2.9" textAnchor="middle" fill={C.ink} stroke="none" fontWeight="700">{n}</text>
    </g>
  )
}

/* =====================================================================
 * Title + SPECIFICATIONS block (top-left)
 * ===================================================================== */
function TitleBlock({ C, aircraft, d, margin, subtitle }) {
  const name = (aircraft?.name ?? 'AIRCRAFT').toUpperCase()
  const tagline = (subtitle ?? aircraft?.tagline ?? 'NARROW BODY AIRLINER').toUpperCase()
  const rows = [
    ['LENGTH', `${d.lengthM.toFixed(2)} m`],
    ['WINGSPAN', `${d.wingspanM.toFixed(2)} m`],
    ['HEIGHT', `${d.heightM.toFixed(2)} m`],
    ['FUSELAGE Ø', `${d.fuselageDiaM.toFixed(2)} m`],
    ...(d.wingAreaM2 ? [
      ['WING AREA', `${d.wingAreaM2} m²`],
      ['WING LOADING', `${Math.round(d.mtowKg / d.wingAreaM2)} kg/m²`],
    ] : []),
    ['PASSENGERS', `${d.paxTypical} – ${d.paxMax}`],
    ['RANGE', `${d.rangeKm.toLocaleString()} km`],
    ['MAX TAKEOFF', `${d.mtowKg.toLocaleString()} kg`],
    ['CRUISE', `MACH ${d.cruiseMach}`],
    ['CEILING', `${d.ceilingM.toLocaleString()} m`],
  ]
  const x = margin + 2
  const size = name.length > 14 ? 9 : 11
  return (
    <g>
      <text x={x} y={20} fontSize={size} fill={C.ink} fontWeight="700" letterSpacing="0.5">{name}</text>
      <text x={x} y={26} fontSize="3.3" fill={C.dim} letterSpacing="1">{tagline}</text>
      <line x1={x} y1={30} x2={x + 84} y2={30} stroke={C.inkSoft} strokeWidth="0.4" />

      <text x={x} y={40} fontSize="4.4" fill={C.ink} fontWeight="700" letterSpacing="1.3">SPECIFICATIONS</text>
      {rows.map(([k, v], i) => {
        const ry = 47 + i * 5.6
        return (
          <g key={k}>
            <text x={x} y={ry} fontSize="3" fill={C.dim} letterSpacing="0.3">{k}</text>
            <text x={x + 38} y={ry} fontSize="3" fill={C.ink} textAnchor="start">{v}</text>
            <line x1={x} y1={ry + 1.6} x2={x + 84} y2={ry + 1.6} stroke={C.inkFaint} strokeWidth="0.15" />
          </g>
        )
      })}
    </g>
  )
}

/* =====================================================================
 * PLAN (top) view — top-right, with numbered leaders
 * ===================================================================== */
function PlanView({ C, dims, colX }) {
  const { lengthM, wingspanM, fuselageDiaM } = dims
  const boxX = 78, boxW = colX - boxX - 10, cx = boxX + boxW / 2
  const cy = 64
  // fit within both the column width and the available top-band height
  const maxSpanH = 50
  const scale = Math.min((boxW - 6) / wingspanM, maxSpanH / wingspanM)
  const L = lengthM * scale, W = wingspanM * scale, r = (fuselageDiaM * scale) / 2
  const x0 = cx - L / 2
  const engineX = x0 + L * (RATIO.wingLEFrac - 0.04)
  const engineLen = r * 3.4, engineR = r * 0.85
  const ey1 = (W / 2) * RATIO.enginePosFrac
  const leRoot = x0 + L * RATIO.wingLEFrac

  return (
    <g>
      <text x={boxX} y={cy - W / 2 - 5} fontSize="3.4" fill={C.dim} letterSpacing="0.6">PLAN VIEW</text>
      {[1, -1].map((dir) => (
        <path key={`w${dir}`} d={wingPath(x0, L, cy, r, W, dir)} fill={C.fill} stroke={C.ink} strokeWidth="0.5" />
      ))}
      {/* slats (LE) + flaps/aileron (TE) breaks */}
      {[1, -1].map((dir) => (
        <g key={`ctl${dir}`} stroke={C.inkFaint} strokeWidth="0.3">
          <line x1={leRoot + L * 0.01} y1={cy + dir * r * 0.9} x2={leRoot + L * RATIO.wingSweep * 0.9} y2={cy + dir * (W * 0.47)} />
          <line x1={leRoot + L * RATIO.wingRootFrac * 0.6} y1={cy + dir * r} x2={leRoot + L * (RATIO.wingSweep + RATIO.wingTipFrac * 0.4)} y2={cy + dir * (W * 0.45)} strokeDasharray="1.2 1" />
        </g>
      ))}
      {[1, -1].map((dir) => (
        <path key={`h${dir}`} d={htPath(x0, L, cy, r, W, dir)} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
      ))}
      <path d={fuselagePath(x0, L, cy, r)} fill={C.fill} stroke={C.ink} strokeWidth="0.6" />
      <line x1={x0 - 4} y1={cy} x2={x0 + L + 4} y2={cy} stroke={C.inkFaint} strokeWidth="0.3" strokeDasharray="3 1.4 0.6 1.4" />
      {/* engines */}
      {[ey1, -ey1].map((ey, i) => (
        <g key={`pe${i}`}>
          <rect x={engineX} y={cy + ey - engineR} width={engineLen} height={engineR * 2} rx={engineR} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
          <line x1={engineX} y1={cy + ey} x2={engineX + engineLen} y2={cy + ey} stroke={C.inkFaint} strokeWidth="0.3" />
          <line x1={engineX + engineLen * 0.55} y1={cy + ey} x2={engineX + engineLen * 0.55} y2={cy + ey * 0.25} stroke={C.inkSoft} strokeWidth="0.4" />
        </g>
      ))}

      {/* wingspan + centre-wing-box dimensions */}
      <HDim x1={cx - W / 2} x2={cx + W / 2} y={cy - W / 2 - 5} ext={-(W / 2 - r) + 2} label={`${wingspanM.toFixed(2)} m`} C={C} />

      {/* quarter-chord sweep callout, measured off the drawn leading edge */}
      {(() => {
        const sweepDeg = Math.round((Math.atan2(L * RATIO.wingSweep, W / 2 - r) * 180) / Math.PI)
        return (
          <text x={leRoot + L * RATIO.wingSweep + 4} y={cy + W / 2 + 3.6} fontSize="2.3" fill={C.dim} letterSpacing="0.2">
            LE SWEEP Λ ≈ {sweepDeg}°
          </text>
        )
      })()}

      {/* numbered leaders — point up into clear space above the wing */}
      <Leader n={6} px={leRoot + L * RATIO.wingRootFrac * 0.5} py={cy} tx={cx - 2} ty={cy - W / 2 + 4} C={C} />
      <Leader n={7} px={leRoot + L * 0.03} py={cy - (W / 2) * 0.6} tx={cx - 20} ty={cy - W / 2 + 4} C={C} />
      <Leader n={8} px={leRoot + L * RATIO.wingRootFrac * 0.75} py={cy - (W / 2) * 0.55} tx={cx + 12} ty={cy - W / 2 + 4} C={C} />
      <Leader n={9} px={leRoot + L * (RATIO.wingSweep + RATIO.wingTipFrac * 0.4)} py={cy - (W / 2) * 0.78} tx={cx + 28} ty={cy - W / 2 + 4} C={C} />
      <Leader n={11} px={engineX + engineLen / 2} py={cy + ey1} tx={cx + 4} ty={cy + W / 2 - 3} C={C} />
      <Leader n={15} px={x0 + L * (RATIO.finLEFrac + 0.04)} py={cy + (W * RATIO.htSpanFrac) / 2 * 0.7} tx={x0 + L + 1} ty={cy + 8} C={C} />
    </g>
  )
}

/* =====================================================================
 * PROFILE (side) view — middle band, full width, heavily annotated
 * ===================================================================== */
function ProfileView({ C, dims, colX, doubleDeck = false }) {
  const { lengthM, heightM, fuselageDiaM } = dims
  const boxX = 12, boxW = colX - boxX - 8
  const cx = boxX + boxW / 2
  const scale = (boxW - 14) / lengthM
  const L = lengthM * scale, H = heightM * scale, r = (fuselageDiaM * scale) / 2
  const x0 = cx - L / 2
  const cy = 138
  const groundY = cy + r + H * 0.16
  const upsweep = r * 0.45
  const finTopY = cy - H + r * 0.6

  const winCount = Math.max(8, Math.round(lengthM * 0.95))
  const winStart = x0 + L * RATIO.noseFrac + 3
  const winEnd = x0 + L * (1 - RATIO.tailFrac) - 1
  const windows = Array.from({ length: winCount }, (_, i) => winStart + ((winEnd - winStart) * i) / (winCount - 1))
  const doors = [0.05, 0.3, 0.66, 0.94].map((f) => winStart + (winEnd - winStart) * f)

  const engineX = x0 + L * (RATIO.wingLEFrac - 0.02)
  const engineLen = r * 3.4, engineR = r * 0.82
  const noseGearX = x0 + L * RATIO.noseFrac + 2
  const mainGearX = x0 + L * RATIO.wheelbaseFrac

  return (
    <g>
      <text x={x0 + L - 2} y={finTopY - 3} fontSize="3.4" fill={C.dim} letterSpacing="0.6" textAnchor="end">PROFILE VIEW · STBD ELEVATION</text>
      <path d={fuselagePath(x0, L, cy, r, upsweep)} fill={C.fill} stroke={C.ink} strokeWidth="0.6" />
      {/* flight-deck windows */}
      <path d={`M ${x0 + L * RATIO.noseFrac * 0.2} ${cy - r * 0.4} q ${L * RATIO.noseFrac * 0.5} ${-r * 0.4} ${L * RATIO.noseFrac * 0.95} -0.2`} fill="none" stroke={C.glass} strokeWidth="1.2" />
      {/* fwd/aft pressure bulkhead station lines */}
      <line x1={x0 + L * RATIO.noseFrac} y1={cy - r} x2={x0 + L * RATIO.noseFrac} y2={cy + r} stroke={C.inkFaint} strokeWidth="0.3" strokeDasharray="1.5 1.2" />
      <line x1={winEnd + 1} y1={cy - r} x2={winEnd + 1} y2={cy + r} stroke={C.inkFaint} strokeWidth="0.3" strokeDasharray="1.5 1.2" />
      {/* cabin window belt — lower/main deck (or single deck) */}
      <line x1={winStart} y1={cy + (doubleDeck ? r * 0.32 : -r * 0.12)} x2={winEnd} y2={cy + (doubleDeck ? r * 0.32 : -r * 0.12)} stroke={C.inkFaint} strokeWidth="0.25" />
      {windows.map((wx, i) => (
        <rect key={`w${i}`} x={wx - 0.55} y={cy + (doubleDeck ? r * 0.32 : -r * 0.12) - 0.55} width="1.1" height="1.1" rx="0.4" fill={C.glass} />
      ))}
      {/* upper-deck window belt (double-deck types like the A380) */}
      {doubleDeck && windows.map((wx, i) => (
        <rect key={`wu${i}`} x={wx - 0.55} y={cy - r * 0.42 - 0.55} width="1.1" height="1.1" rx="0.4" fill={C.glass} />
      ))}
      {doubleDeck && (
        <line x1={winStart} y1={cy - r * 0.42} x2={winEnd} y2={cy - r * 0.42} stroke={C.inkFaint} strokeWidth="0.25" />
      )}
      {doors.map((dx, i) => (
        <rect key={`d${i}`} x={dx - 0.9} y={cy - r * 0.5} width="1.8" height={r * 0.95} rx="0.4" fill="none" stroke={C.inkSoft} strokeWidth="0.4" />
      ))}
      {/* fin + rudder */}
      <path d={`M ${x0 + L * RATIO.finLEFrac} ${cy - r} L ${x0 + L * 0.95} ${finTopY} L ${x0 + L * 0.995} ${finTopY} L ${x0 + L * 0.93} ${cy - r} Z`} fill={C.fill} stroke={C.ink} strokeWidth="0.5" />
      <line x1={x0 + L * 0.955} y1={finTopY + 1.5} x2={x0 + L * 0.97} y2={cy - r} stroke={C.inkSoft} strokeWidth="0.35" strokeDasharray="1.4 1" />
      {/* h-stab + elevator */}
      <path d={`M ${x0 + L * RATIO.finLEFrac} ${cy - r * 0.65} l ${L * RATIO.htRootFrac * 1.1} ${-r * 0.15} l 0 ${r * 0.3} l ${-L * RATIO.htRootFrac * 1.1} ${r * 0.05} Z`} fill={C.fill} stroke={C.ink} strokeWidth="0.4" />
      {/* wing edge-on */}
      <path d={`M ${x0 + L * RATIO.wingLEFrac} ${cy + r * 0.45} l ${L * 0.12} ${r * 0.55} l ${L * 0.07} 0 l ${-L * 0.06} ${-r * 0.55} Z`} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
      {/* nacelle + pylon */}
      <g>
        <ellipse cx={engineX + engineLen / 2} cy={cy + r * 1.05} rx={engineLen / 2} ry={engineR} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
        <ellipse cx={engineX + engineLen * 0.12} cy={cy + r * 1.05} rx={engineLen * 0.1} ry={engineR * 0.85} fill="none" stroke={C.inkSoft} strokeWidth="0.35" />
        <line x1={engineX + engineLen * 0.55} y1={cy + r * 1.05 - engineR} x2={engineX + engineLen * 0.5} y2={cy + r * 0.6} stroke={C.inkSoft} strokeWidth="0.4" />
      </g>
      {/* APU exhaust at tail cone */}
      <circle cx={x0 + L - 0.5} cy={cy - r * 0.06 - upsweep} r="0.9" fill="none" stroke={C.inkSoft} strokeWidth="0.4" />
      {/* gear */}
      <Gear x={noseGearX} groundY={groundY} topY={cy + r} C={C} />
      <Gear x={mainGearX} groundY={groundY} topY={cy + r} C={C} dual />
      <line x1={x0 - 6} y1={groundY} x2={x0 + L + 6} y2={groundY} stroke={C.inkSoft} strokeWidth="0.4" strokeDasharray="2 1.4" />

      {/* ---- fuselage-station (FS) datum ruler above the profile ---- */}
      <g>
        <line x1={x0} y1={cy - r - 10} x2={x0 + L} y2={cy - r - 10} stroke={C.inkSoft} strokeWidth="0.3" />
        {Array.from({ length: 9 }).map((_, i) => {
          const fx = x0 + (L * i) / 8
          const major = i % 2 === 0
          return (
            <g key={i}>
              <line x1={fx} y1={cy - r - 10} x2={fx} y2={cy - r - 10 + (major ? 2 : 1.2)} stroke={C.inkSoft} strokeWidth="0.3" />
              {major && (
                <text x={fx} y={cy - r - 11.4} fontSize="1.9" fill={C.dim} textAnchor="middle">
                  FS {((lengthM * i) / 8).toFixed(1)}
                </text>
              )}
            </g>
          )
        })}
      </g>
      {/* waterline datum tag on the ground line */}
      <text x={x0 - 6} y={groundY - 1.2} fontSize="2" fill={C.inkSoft} textAnchor="end">WL 0.0</text>
      {/* centre of gravity (reference) — the classic quartered circle at ~25% MAC */}
      <g>
        <circle cx={x0 + L * 0.46} cy={cy + r * 0.1} r="1.7" fill="none" stroke={C.dim} strokeWidth="0.35" />
        <path d={`M ${x0 + L * 0.46} ${cy + r * 0.1} L ${x0 + L * 0.46 + 1.7} ${cy + r * 0.1} A 1.7 1.7 0 0 1 ${x0 + L * 0.46} ${cy + r * 0.1 + 1.7} Z`} fill={C.dim} stroke="none" />
        <path d={`M ${x0 + L * 0.46} ${cy + r * 0.1} L ${x0 + L * 0.46 - 1.7} ${cy + r * 0.1} A 1.7 1.7 0 0 1 ${x0 + L * 0.46} ${cy + r * 0.1 - 1.7} Z`} fill={C.dim} stroke="none" />
        <text x={x0 + L * 0.46 + 3} y={cy + r * 0.1 + 0.8} fontSize="2.1" fill={C.dim}>CG 25% MAC (REF)</text>
      </g>

      {/* ---- engineering dimensions ---- */}
      {/* cabin length, above the crown (clear of nacelle + gear below) */}
      <HDim x1={winStart} x2={winEnd} y={cy - r - 5} ext={-4} label={`CABIN ${((winEnd - winStart) / scale).toFixed(1)} m`} C={C} size={2.8} />
      {/* wheelbase, below ground line */}
      <HDim x1={noseGearX} x2={mainGearX} y={groundY + 7} ext={-5} label={`WHEELBASE ${((mainGearX - noseGearX) / scale).toFixed(2)} m`} C={C} size={2.8} />
      {/* overall length, bottom-most */}
      <HDim x1={x0} x2={x0 + L} y={groundY + 15} ext={-(groundY + 15 - groundY)} label={`OVERALL LENGTH ${lengthM.toFixed(2)} m`} C={C} size={3} />
      {/* overall height, right */}
      <VDim y1={finTopY} y2={groundY} x={x0 + L + 9} ext={-5} label={`${heightM.toFixed(2)} m`} C={C} />
      {/* fuselage diameter, left of nose */}
      <VDim y1={cy - r} y2={cy + r} x={x0 - 6} ext={6} label={`Ø ${fuselageDiaM.toFixed(2)}`} C={C} size={2.6} />

      {/* ---- numbered leaders ---- */}
      <Leader n={1} px={x0 + 1} py={cy} tx={x0 - 4} ty={cy - r - 8} C={C} />
      <Leader n={2} px={x0 + L * RATIO.noseFrac * 0.6} py={cy - r * 0.45} tx={x0 + L * 0.06} ty={finTopY + 6} C={C} />
      <Leader n={3} px={x0 + L * RATIO.noseFrac} py={cy + r * 0.4} tx={x0 + L * RATIO.noseFrac} ty={groundY - 4} C={C} />
      <Leader n={4} px={doors[1]} py={cy - r * 0.2} tx={doors[1]} ty={finTopY + 6} C={C} />
      <Leader n={5} px={windows[Math.floor(winCount / 2)]} py={cy - r * 0.12} tx={cx} ty={finTopY + 6} C={C} />
      <Leader n={12} px={engineX + engineLen * 0.55} py={cy + r * 0.75} tx={engineX + engineLen * 0.55} ty={groundY - 3} C={C} />
      <Leader n={13} px={mainGearX} py={groundY - 2} tx={mainGearX + 8} ty={groundY - 2} C={C} elbow={mainGearX + 8} />
      <Leader n={14} px={noseGearX} py={groundY - 2} tx={noseGearX - 8} ty={groundY - 2} C={C} elbow={noseGearX - 8} />
      <Leader n={16} px={x0 + L * RATIO.finLEFrac + L * RATIO.htRootFrac} py={cy - r * 0.6} tx={x0 + L + 1} ty={finTopY + 14} C={C} />
      <Leader n={17} px={x0 + L * 0.93} py={finTopY + (cy - r - finTopY) * 0.4} tx={x0 + L * 0.86} ty={finTopY - 1} C={C} />
      <Leader n={18} px={x0 + L * 0.965} py={finTopY + (cy - r - finTopY) * 0.55} tx={x0 + L + 1} ty={finTopY + 1} C={C} />
      <Leader n={19} px={x0 + L - 0.5} py={cy - r * 0.06 - upsweep} tx={x0 + L + 1} ty={finTopY + 8} C={C} />
      <Leader n={20} px={winEnd + 1} py={cy + r * 0.4} tx={winEnd + 1} ty={groundY - 4} C={C} />
    </g>
  )
}

/* =====================================================================
 * FRONT view — bottom-left, with track + dihedral callouts
 * ===================================================================== */
function FrontView({ C, dims, engineCount = 2, doubleDeck = false }) {
  const { wingspanM, heightM, fuselageDiaM } = dims
  const boxX = 12, boxW = 86
  const cx = boxX + boxW / 2 + 2
  const scale = (boxW - 4) / wingspanM
  const W = wingspanM * scale, H = heightM * scale, r = (fuselageDiaM * scale) / 2
  // double-deck fuselage cross-section is a tall vertical oval, not a circle
  const ry = doubleDeck ? r * 1.32 : r
  const cy = 200
  const groundY = cy + ry + H * 0.18
  const dih = W * 0.035
  const offs = engineOffsets(engineCount, W)
  const engineR = r * 0.82
  const track = (W * RATIO.gearTrackFrac)

  return (
    <g>
      <text x={boxX} y={cy - H * 0.62 - 4} fontSize="3.4" fill={C.dim} letterSpacing="0.6">FRONT VIEW · LOOKING AFT</text>
      <path d={`M ${cx} ${cy - r * 0.15} L ${cx - W / 2} ${cy - r * 0.15 - dih} L ${cx - W / 2} ${cy - dih} L ${cx} ${cy + r * 0.1} L ${cx + W / 2} ${cy - dih} L ${cx + W / 2} ${cy - r * 0.15 - dih} Z`} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
      {[-1, 1].map((s) => (
        <line key={`sk${s}`} x1={cx + s * (W / 2)} y1={cy - r * 0.15 - dih} x2={cx + s * (W / 2 - 1.2)} y2={cy - r * 0.15 - dih - H * 0.14} stroke={C.ink} strokeWidth="0.7" />
      ))}
      <ellipse cx={cx} cy={cy} rx={r} ry={ry} fill={C.fill} stroke={C.ink} strokeWidth="0.6" />
      {/* upper-deck floor line for double-deck types */}
      {doubleDeck && <line x1={cx - r * 0.92} y1={cy - ry * 0.02} x2={cx + r * 0.92} y2={cy - ry * 0.02} stroke={C.inkFaint} strokeWidth="0.25" />}
      <line x1={cx} y1={cy - ry} x2={cx} y2={cy + ry} stroke={C.inkFaint} strokeWidth="0.25" strokeDasharray="2 1.4" />
      <path d={`M ${cx - 0.9} ${cy - ry * 0.6} L ${cx - 0.5} ${cy - H + r * 0.6} L ${cx + 0.5} ${cy - H + r * 0.6} L ${cx + 0.9} ${cy - ry * 0.6} Z`} fill={C.fill} stroke={C.ink} strokeWidth="0.45" />
      {offs.map((ey, i) => (
        <g key={`fe${i}`}>
          <circle cx={cx + ey} cy={cy + ry * 0.82} r={engineR} fill={C.fill} stroke={C.ink} strokeWidth="0.5" />
          <circle cx={cx + ey} cy={cy + ry * 0.82} r={engineR * 0.34} fill="none" stroke={C.inkSoft} strokeWidth="0.4" />
        </g>
      ))}
      {[-1, 1].map((s) => (
        <line key={`gl${s}`} x1={cx + s * track / 2} y1={cy + r * 0.8} x2={cx + s * track / 2} y2={groundY} stroke={C.ink} strokeWidth="0.6" />
      ))}
      <line x1={cx} y1={cy + ry} x2={cx} y2={groundY} stroke={C.ink} strokeWidth="0.6" />
      <line x1={cx - W / 2 - 2} y1={groundY} x2={cx + W / 2 + 2} y2={groundY} stroke={C.inkSoft} strokeWidth="0.4" strokeDasharray="2 1.4" />

      {/* wingspan + wheel track dimensions */}
      <HDim x1={cx - W / 2} x2={cx + W / 2} y={groundY + 7} ext={-6} label={`${wingspanM.toFixed(2)} m`} C={C} />
      <HDim x1={cx - track / 2} x2={cx + track / 2} y={groundY + 14} ext={-(groundY + 14 - groundY)} label={`TRACK ${(track / scale).toFixed(2)} m`} C={C} size={2.7} />

      {/* dihedral callout off the drawn wing */}
      <text x={cx - W / 2 + 1} y={cy - r * 0.15 - dih - 3.2} fontSize="2.3" fill={C.dim} letterSpacing="0.2">
        DIHEDRAL Γ ≈ {Math.max(1, Math.round((Math.atan2(dih, W / 2) * 180) / Math.PI + 4))}°
      </text>

      {/* leaders: sharklet + nose gear track */}
      <Leader n={10} px={cx + (W / 2 - 0.6)} py={cy - r * 0.15 - dih - H * 0.07} tx={cx + W / 2 - 2} ty={cy - H * 0.62} C={C} />
      <Leader n={17} px={cx} py={cy - H * 0.45} tx={cx + 10} ty={cy - H * 0.62} C={C} elbow={cx + 10} />
    </g>
  )
}

/* =====================================================================
 * COMPONENT SCHEDULE (numbered key) — right column
 * ===================================================================== */
const SCHED_PITCH = 4.65 // vertical pitch shared by schedule + data-table rows

function ComponentSchedule({ C, x, y, schedule }) {
  const colW = 64
  return (
    <g>
      <text x={x} y={y} fontSize="3.8" fill={C.ink} fontWeight="700" letterSpacing="0.9">COMPONENT SCHEDULE</text>
      <line x1={x} y1={y + 2.3} x2={x + colW} y2={y + 2.3} stroke={C.inkSoft} strokeWidth="0.4" />
      {schedule.map((it, i) => {
        const ry = y + 7 + i * SCHED_PITCH
        return (
          <g key={it.n}>
            <circle cx={x + 2.2} cy={ry - 0.9} r="1.9" fill={C.sheet2} stroke={C.ink} strokeWidth="0.35" />
            <text x={x + 2.2} y={ry - 0.1} fontSize="2.4" textAnchor="middle" fill={C.ink} stroke="none" fontWeight="700">{it.n}</text>
            <text x={x + 6.4} y={ry} fontSize="2.7" fill={C.dim} letterSpacing="0.1">{it.label}</text>
          </g>
        )
      })}
    </g>
  )
}

/* =====================================================================
 * POWERPLANT + DIMENSION DATA tables — right column, under the schedule
 * ===================================================================== */
function DataTables({ C, x, y, d, aircraft, engineCount }) {
  const colW = 64
  const eng = aircraft?.engines?.[0]
  const power = eng
    ? [
        ['DESIGNATION', eng.name],
        ['TYPE', (eng.type || 'turbofan').toUpperCase()],
        ['THRUST', `${eng.thrustKn} kN`],
        ['BYPASS', `${eng.bypassRatio}:1`],
        ['FAN Ø', `${eng.fanDiameterM?.toFixed(2)} m`],
        ['COUNT', `${engineCount}`],
      ]
    : []
  // Total installed thrust + thrust-to-weight give the table a derived figure
  // beyond the raw specs, so it reads like real performance data.
  const totalThrustKn = eng ? eng.thrustKn * engineCount : null
  const twRatio = eng ? ((totalThrustKn * 1000) / (d.mtowKg * 9.80665)) : null
  const perf = [
    ['MAX TAKEOFF', `${d.mtowKg.toLocaleString()} kg`],
    ['RANGE', `${d.rangeKm.toLocaleString()} km`],
    ['CRUISE', `MACH ${d.cruiseMach}`],
    ['CEILING', `${d.ceilingM.toLocaleString()} m`],
    ['SEATING', `${d.paxTypical} / ${d.paxMax}`],
    ...(totalThrustKn ? [['TOTAL THRUST', `${totalThrustKn} kN`]] : []),
    ...(twRatio ? [['THRUST/WT', `${twRatio.toFixed(2)}`]] : []),
  ]
  const Section = ({ title, rows, oy }) => (
    <g>
      <text x={x} y={oy} fontSize="3.5" fill={C.ink} fontWeight="700" letterSpacing="0.6">{title}</text>
      <line x1={x} y1={oy + 2.2} x2={x + colW} y2={oy + 2.2} stroke={C.inkSoft} strokeWidth="0.4" />
      {rows.map(([k, v], i) => {
        const ry = oy + 6.6 + i * SCHED_PITCH
        return (
          <g key={k}>
            <text x={x} y={ry} fontSize="2.6" fill={C.dim}>{k}</text>
            <text x={x + colW} y={ry} fontSize="2.6" fill={C.ink} textAnchor="end">{v}</text>
            <line x1={x} y1={ry + 1.3} x2={x + colW} y2={ry + 1.3} stroke={C.inkFaint} strokeWidth="0.15" />
          </g>
        )
      })}
    </g>
  )
  const perfOy = y + (power.length > 0 ? 6.6 + power.length * SCHED_PITCH + 6 : 0)
  return (
    <g>
      {power.length > 0 && <Section title="POWERPLANT" rows={power} oy={y} />}
      <Section title="PERFORMANCE & WEIGHTS" rows={perf} oy={perfOy} />
    </g>
  )
}

/* =====================================================================
 * Formal title block (bottom strip): drawing no., scale, projection,
 * revision, units, date, sheet.
 * ===================================================================== */
function DrawingTitleBlock({ C, aircraft, d, VB_W, VB_H, margin }) {
  const x = margin
  const y = VB_H - 32
  const w = VB_W - margin * 2
  const h = 25
  // Derived drawing number from the id + a deterministic suffix.
  const id = (aircraft?.id ?? 'ac').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const dwgNo = `GA-${id}-001`
  const date = new Date().toISOString().slice(0, 10)
  // approximate human-friendly scale ratio from on-sheet length vs real length
  const onSheetM = (VB_W - 28) // ~ profile drawing width in user units
  const scaleStr = `1 : ${Math.round(d.lengthM * 1000 / onSheetM) * 10}`

  const cells = [
    { label: 'DRAWING TITLE', value: `${(aircraft?.name ?? 'AIRCRAFT').toUpperCase()} — GENERAL ARRANGEMENT`, wfrac: 0.4 },
    { label: 'DRAWING No.', value: dwgNo, wfrac: 0.18 },
    { label: 'SCALE', value: scaleStr, wfrac: 0.12 },
    { label: 'UNITS', value: 'SI / metres', wfrac: 0.14 },
    { label: 'SHEET', value: '1 OF 1', wfrac: 0.16 },
  ]
  // second row
  const cells2 = [
    { label: 'PROJECTION', value: 'FIRST ANGLE', wfrac: 0.22 },
    { label: 'REV', value: 'A', wfrac: 0.08 },
    { label: 'DATE', value: date, wfrac: 0.2 },
    { label: 'STATUS', value: (aircraft?.status ?? 'reference').toUpperCase().replace('-', ' '), wfrac: 0.24 },
    { label: 'SOURCE', value: 'DERIVED FROM TYPE DATA', wfrac: 0.26 },
  ]
  // third row: signature + tolerance cells, like a released production sheet
  const cells3 = [
    { label: 'DRAWN', value: 'ADA / PARAMETRIC', wfrac: 0.22 },
    { label: 'CHECKED', value: 'DATA REGISTRY', wfrac: 0.2 },
    { label: 'APPROVED', value: 'FOR REFERENCE ONLY', wfrac: 0.24 },
    { label: 'TOLERANCE', value: 'NOM ± 0.1 m', wfrac: 0.16 },
    { label: 'NOTE', value: 'DO NOT SCALE', wfrac: 0.18 },
  ]

  function Row({ cells, ry, rh }) {
    let cxp = x
    return cells.map((c, i) => {
      const cw = w * c.wfrac
      const el = (
        <g key={i}>
          <rect x={cxp} y={ry} width={cw} height={rh} fill="none" stroke={C.inkSoft} strokeWidth="0.3" />
          <text x={cxp + 2} y={ry + 3.4} fontSize="2.2" fill={C.inkSoft} letterSpacing="0.3">{c.label}</text>
          <text x={cxp + 2} y={ry + rh - 1.8} fontSize="2.9" fill={C.ink} fontWeight="700">{c.value}</text>
        </g>
      )
      cxp += cw
      return el
    })
  }

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="rgba(8,40,96,0.6)" stroke={C.ink} strokeWidth="0.5" />
      <Row cells={cells} ry={y} rh={h / 3} />
      <Row cells={cells2} ry={y + h / 3} rh={h / 3} />
      <Row cells={cells3} ry={y + (2 * h) / 3} rh={h / 3} />
      {/* first-angle projection symbol, drawn over the title cell's right side */}
      <ProjectionSymbol C={C} cx={x + w * 0.36} cy={y + h / 3} />
    </g>
  )
}

// First-angle projection symbol: a truncated cone + its two views.
function ProjectionSymbol({ C, cx, cy }) {
  return (
    <g stroke={C.ink} strokeWidth="0.35" fill="none">
      {/* side view of cone */}
      <path d={`M ${cx - 7} ${cy - 2.4} L ${cx - 1} ${cy - 1.4} L ${cx - 1} ${cy + 1.4} L ${cx - 7} ${cy + 2.4} Z`} />
      {/* two concentric circles (end view) */}
      <circle cx={cx + 4} cy={cy} r="2.6" />
      <circle cx={cx + 4} cy={cy} r="1.2" />
      {/* centre cross */}
      <line x1={cx + 4} y1={cy - 3.4} x2={cx + 4} y2={cy + 3.4} strokeWidth="0.25" />
      <line x1={cx} y1={cy} x2={cx + 8} y2={cy} strokeWidth="0.25" />
    </g>
  )
}

// Drawing-frame zone markers (A–D rows, 1–4 cols) around the border.
function FrameZones({ C, VB_W, VB_H }) {
  const cols = ['1', '2', '3', '4', '5', '6']
  const rows = ['A', 'B', 'C', 'D']
  return (
    <g fill={C.inkFaint} stroke="none" fontSize="2.4" textAnchor="middle">
      {cols.map((c, i) => {
        const cx = (VB_W / cols.length) * (i + 0.5)
        return (
          <g key={`c${c}`}>
            <text x={cx} y={4.4}>{c}</text>
            <text x={cx} y={VB_H - 1.6}>{c}</text>
          </g>
        )
      })}
      {rows.map((rw, i) => {
        const cy = (VB_H / rows.length) * (i + 0.5)
        return (
          <g key={`r${rw}`}>
            <text x={4} y={cy + 0.8}>{rw}</text>
            <text x={VB_W - 4} y={cy + 0.8}>{rw}</text>
          </g>
        )
      })}
    </g>
  )
}

/** Deployed landing-gear strut + wheels (side view). */
function Gear({ x, groundY, topY, C, dual = false }) {
  return (
    <g stroke={C.ink} strokeWidth="0.5" fill="none">
      <line x1={x} y1={topY} x2={x} y2={groundY - 1.2} />
      <circle cx={x} cy={groundY - 0.9} r="1.1" fill={C.inkSoft} stroke={C.ink} strokeWidth="0.4" />
      {dual && <circle cx={x + 2} cy={groundY - 0.9} r="1.1" fill={C.inkSoft} stroke={C.ink} strokeWidth="0.4" />}
      {dual && <line x1={x} y1={groundY - 0.9} x2={x + 2} y2={groundY - 0.9} stroke={C.ink} strokeWidth="0.4" />}
    </g>
  )
}
