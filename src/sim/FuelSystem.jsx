import { useEffect, useRef, useState } from 'react'

/**
 * Live A320 fuel-system schematic. Three tanks (left wing, centre, right wing)
 * feed two engines through boost pumps. Fuel burns at a rate set by the thrust
 * lever; tank quantities drain in real time. You can open/close crossfeed and
 * the centre-tank transfer to see the flow paths change.
 *
 * The A320 really does burn centre-tank fuel first (transfer to the wing tanks),
 * then the wing tanks; crossfeed lets one side feed both engines. This models
 * that behaviour simply so the animation teaches the logic.
 */

// tank capacities (kg), roughly A320 figures
const CAP = { left: 5300, center: 8250, right: 5300 }

export default function FuelSystem({ height = 460 }) {
  const [thrust, setThrust] = useState(60)        // % — sets total burn rate
  const [crossfeed, setCrossfeed] = useState(false)
  const [transfer, setTransfer] = useState(true)  // centre -> wings transfer
  const [running, setRunning] = useState(true)
  const [fuel, setFuel] = useState({ left: 5300, center: 8250, right: 5300 })
  const [pumpFail, setPumpFail] = useState(null)   // null | 'left' | 'right'

  const ctrl = useRef({ thrust, crossfeed, transfer, running, pumpFail })
  ctrl.current = { thrust, crossfeed, transfer, running, pumpFail }

  useEffect(() => {
    let raf, last = performance.now()
    function loop(now) {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { thrust: T, crossfeed: X, transfer: TR, running: R, pumpFail: PF } = ctrl.current
      if (R) {
        setFuel((f) => {
          // total burn kg/s scales with thrust (2 engines). ~ realistic-ish.
          const burn = (0.35 + (T / 100) * 1.15) * dt * 60  // scaled for visible drain
          let { left, center, right } = f

          // each engine draws ~half the burn from its side, unless a boost pump
          // failed (then crossfeed must feed it from the other side).
          let drawL = burn / 2
          let drawR = burn / 2
          if (PF === 'left') { drawR += drawL; drawL = 0 }
          if (PF === 'right') { drawL += drawR; drawR = 0 }

          // centre tank transfers to the wings first (burned before wing fuel)
          if (TR && center > 0) {
            const xfer = Math.min(center, burn * 0.9)
            center -= xfer
            // split transfer into the wings
            left = Math.min(CAP.left, left + xfer / 2)
            right = Math.min(CAP.right, right + xfer / 2)
          }

          // engines draw from wing tanks; crossfeed lets either side feed both
          if (X) {
            const total = left + right
            const both = drawL + drawR
            const ratio = total > 0 ? Math.min(1, both / total) : 0
            left -= left * ratio
            right -= right * ratio
          } else {
            left = Math.max(0, left - drawL)
            right = Math.max(0, right - drawR)
          }
          center = Math.max(0, center)
          return { left, center, right }
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const total = Math.round(fuel.left + fuel.center + fuel.right)
  const burnKgH = Math.round((0.35 + (thrust / 100) * 1.15) * 3600)
  const endurance = burnKgH > 0 ? total / burnKgH : 0

  const reset = () => setFuel({ ...CAP })

  // flow-active predicates for animating each pipe
  const engineRunning = running
  const leftFeeds = engineRunning && fuel.left > 0 && pumpFail !== 'left'
  const rightFeeds = engineRunning && fuel.right > 0 && pumpFail !== 'right'
  const ctrTransfer = running && transfer && fuel.center > 0
  const xfeedActive = crossfeed && engineRunning

  return (
    <div className="sim-fuel">
      <svg viewBox="0 0 100 62" className="fuel-svg" role="img" aria-label="Fuel system schematic">
        <defs>
          <marker id="fArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#3fb950" />
          </marker>
        </defs>

        {/* grid */}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={i} x1={i * 10} y1="0" x2={i * 10} y2="62" stroke="#141920" strokeWidth="0.15" />
        ))}

        <Tank x={6} y={26} label="L WING" cap={CAP.left} qty={fuel.left} />
        <Tank x={40} y={26} label="CENTRE" cap={CAP.center} qty={fuel.center} wide />
        <Tank x={78} y={26} label="R WING" cap={CAP.right} qty={fuel.right} />

        {/* centre -> wing transfer pipes */}
        <Pipe d="M40 34 L26 40" active={ctrTransfer} label="xfer" />
        <Pipe d="M60 34 L74 40" active={ctrTransfer} label="xfer" />

        {/* boost pumps */}
        <Pump x={16} y={44} on={leftFeeds} fail={pumpFail === 'left'} />
        <Pump x={84} y={44} on={rightFeeds} fail={pumpFail === 'right'} />

        {/* crossfeed manifold across the belly */}
        <line x1="16" y1="50" x2="84" y2="50" stroke={xfeedActive ? '#3fb950' : '#30363d'}
          strokeWidth="0.8" strokeDasharray={xfeedActive ? '2 1.4' : '1.4 1.4'}>
          {xfeedActive && <animate attributeName="stroke-dashoffset" from="6.8" to="0" dur="0.7s" repeatCount="indefinite" />}
        </line>
        <text x="50" y="53.6" fill={xfeedActive ? '#3fb950' : '#6e7681'} fontSize="2.1" textAnchor="middle">
          crossfeed {crossfeed ? 'OPEN' : 'CLOSED'}
        </text>

        {/* pump -> engine feed */}
        <Pipe d="M16 46 L16 56 L30 56" active={leftFeeds} />
        <Pipe d="M84 46 L84 56 L70 56" active={rightFeeds} />

        {/* engines */}
        <Engine x={30} y={56} label="ENG 1" on={leftFeeds || (xfeedActive && rightFeeds)} />
        <Engine x={70} y={56} label="ENG 2" on={rightFeeds || (xfeedActive && leftFeeds)} />
      </svg>

      <div className="fuel-readout">
        <div className="fuel-stat"><span className="n">{total.toLocaleString()}</span><span className="l">kg total</span></div>
        <div className="fuel-stat"><span className="n">{burnKgH.toLocaleString()}</span><span className="l">kg/h burn</span></div>
        <div className="fuel-stat"><span className="n">{endurance.toFixed(1)}</span><span className="l">h endurance</span></div>
      </div>

      <div className="sim-controls">
        <label className="sim-ctrl">
          <span>Thrust <b>{thrust}%</b></span>
          <input type="range" min="20" max="100" value={thrust} onChange={(e) => setThrust(+e.target.value)} />
        </label>
        <div className="fuel-buttons">
          <button className={crossfeed ? 'on' : ''} onClick={() => setCrossfeed((v) => !v)}>Crossfeed</button>
          <button className={transfer ? 'on' : ''} onClick={() => setTransfer((v) => !v)}>Ctr transfer</button>
          <button className={running ? 'on' : ''} onClick={() => setRunning((v) => !v)}>{running ? 'Running' : 'Paused'}</button>
          <button className={pumpFail === 'left' ? 'on warn' : ''} onClick={() => setPumpFail((v) => v === 'left' ? null : 'left')}>Fail L pump</button>
          <button className={pumpFail === 'right' ? 'on warn' : ''} onClick={() => setPumpFail((v) => v === 'right' ? null : 'right')}>Fail R pump</button>
          <button onClick={reset}>Refuel</button>
        </div>
      </div>

      <p className="sim-note">
        The centre tank empties first — it transfers into the wing tanks, which
        feed the engines through boost pumps. Open <b>crossfeed</b> and either
        side can feed both engines; fail a boost pump and watch the good side pick
        up the load through the crossfeed manifold. Burn rate tracks the thrust
        lever.
      </p>
    </div>
  )
}

/* ---- schematic primitives ---- */
function Tank({ x, y, label, cap, qty, wide }) {
  const w = wide ? 20 : 14
  const h = 8
  const frac = Math.max(0, Math.min(1, qty / cap))
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1" fill="#0d1117" stroke="#39c5cf" strokeWidth="0.4" />
      <rect x={x + 0.5} y={y + h - (h - 1) * frac - 0.5} width={w - 1} height={(h - 1) * frac}
        fill="#1c6f76" opacity="0.85" />
      <text x={x + w / 2} y={y - 1} fill="#39c5cf" fontSize="2.2" textAnchor="middle">{label}</text>
      <text x={x + w / 2} y={y + h / 2 + 0.8} fill="#cfe" fontSize="2" textAnchor="middle">
        {Math.round(qty).toLocaleString()}
      </text>
    </g>
  )
}

function Pump({ x, y, on, fail }) {
  const col = fail ? '#f85149' : on ? '#f78166' : '#30363d'
  return (
    <g>
      <circle cx={x} cy={y} r="2.4" fill="#0d1117" stroke={col} strokeWidth="0.5" />
      <text x={x} y={y + 0.9} fill={col} fontSize="2.4" textAnchor="middle" fontWeight="700">
        {fail ? '×' : '⌁'}
      </text>
    </g>
  )
}

function Engine({ x, y, label, on }) {
  const col = on ? '#3fb950' : '#6e7681'
  return (
    <g>
      <rect x={x - 5} y={y - 3} width="10" height="6" rx="3" fill="#0d1117" stroke={col} strokeWidth="0.5" />
      <text x={x} y={y + 1} fill={col} fontSize="2.2" textAnchor="middle" fontWeight="600">{label}</text>
    </g>
  )
}

function Pipe({ d, active, label }) {
  return (
    <g>
      <path d={d} fill="none" stroke={active ? '#3fb950' : '#30363d'} strokeWidth="0.8"
        strokeDasharray={active ? '2 1.4' : undefined} markerEnd={active ? 'url(#fArrow)' : undefined}>
        {active && <animate attributeName="stroke-dashoffset" from="6.8" to="0" dur="0.6s" repeatCount="indefinite" />}
      </path>
    </g>
  )
}
