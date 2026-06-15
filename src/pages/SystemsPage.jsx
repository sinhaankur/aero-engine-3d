import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SYSTEMS } from '../data/systems.js'
import SystemSchematic from '../components/SystemSchematic.jsx'

/**
 * The "how each system works internally" learning section. A left rail picks a
 * system; the panel shows its interactive schematic, an ordered how-it-works
 * walkthrough, the component list (hovering a component highlights it in the
 * diagram), and the redundancy/failure story. Built on A320 systems data.
 */
export default function SystemsPage() {
  const [activeSystem, setActiveSystem] = useState(SYSTEMS[0].id)
  const [hoverNode, setHoverNode] = useState(null)
  const sys = SYSTEMS.find((s) => s.id === activeSystem) || SYSTEMS[0]

  return (
    <div>
      <Link to="/" className="back">← Home</Link>
      <div className="ac-head">
        <h1>Aircraft systems</h1>
      </div>
      <p className="lede">
        How each major system actually works inside an Airbus A320 — what it does,
        how the parts connect, where the redundancy lives, and what happens when
        something fails. Pick a system, step through how it works, and hover a
        component to trace it in the schematic.
      </p>

      {/* system selector */}
      <div className="sys-tabs">
        {SYSTEMS.map((s) => (
          <button
            key={s.id}
            className={s.id === activeSystem ? 'on' : ''}
            onClick={() => {
              setActiveSystem(s.id)
              setHoverNode(null)
            }}
          >
            <span className="sys-icon" aria-hidden>{s.icon}</span>
            {s.name}
          </button>
        ))}
      </div>

      <div className="sys-body">
        <div className="sys-diagram">
          <SystemSchematic schematic={sys.schematic} activeId={hoverNode} onHover={setHoverNode} />
          <p className="sys-summary">{sys.summary}</p>
        </div>

        <div className="sys-detail">
          <h2 className="section-title" style={{ marginTop: 0 }}>How it works</h2>
          <ol className="sys-steps">
            {sys.how.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      <h2 className="section-title">Key components</h2>
      <div className="sys-components">
        {sys.components.map((c) => (
          <div
            key={c.id}
            className={`sys-comp ${hoverNode === c.id ? 'on' : ''}`}
            onMouseEnter={() => setHoverNode(c.id)}
            onMouseLeave={() => setHoverNode(null)}
          >
            <h4>{c.name}</h4>
            <p>{c.role}</p>
          </div>
        ))}
      </div>

      <div className="sys-cards">
        <div className="sys-card">
          <h3>Redundancy</h3>
          <p>{sys.redundancy}</p>
        </div>
        <div className="sys-card">
          <h3>If it fails</h3>
          <p>{sys.failure}</p>
        </div>
      </div>
    </div>
  )
}
