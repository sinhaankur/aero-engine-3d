import { Link, useParams } from 'react-router-dom'
import { getEngine, getAircraftUsingEngine } from '../data/index.js'
import { ENGINES } from '../data/engines.js'
import { ENGINE_MODELS } from '../data/engineParts.js'
import EngineExplorer from '../components/EngineExplorer.jsx'
import EngineDiagram from '../components/EngineDiagram.jsx'

function Spec({ label, value, unit }) {
  return (
    <div className="spec">
      <dt>{label}</dt>
      <dd>{value}{unit ? <span className="unit"> {unit}</span> : null}</dd>
    </div>
  )
}

// A little labelled bar so a spec reads visually, not just numerically. `max` is
// the family-wide maximum so every engine is measured on the same scale.
function Bar({ label, value, max, unit }) {
  const pct = Math.max(3, Math.min(100, (value / max) * 100))
  return (
    <div className="ebar">
      <div className="ebar-head">
        <span>{label}</span>
        <span className="ebar-val">{value}{unit ? ` ${unit}` : ''}</span>
      </div>
      <div className="ebar-track"><div className="ebar-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export default function EnginePage() {
  const { engineId } = useParams()
  const e = getEngine(engineId)

  if (!e) return <p>Engine not found. <Link to="/">← Index</Link></p>

  const modelled = !!ENGINE_MODELS[engineId]
  const usedOn = getAircraftUsingEngine(engineId)

  // Family-wide maxima so the bars share one scale across all engines.
  const all = Object.values(ENGINES)
  const maxThrust = Math.max(...all.map((x) => x.thrustKn))
  const maxBpr = Math.max(...all.map((x) => x.bypassRatio))
  const maxFan = Math.max(...all.map((x) => x.fanDiameterM))

  return (
    <div>
      <Link to="/" className="back">← Index / Engines</Link>
      <div className="ac-head">
        <h1>{e.name}</h1>
        <span className="status status-in-service">{e.type}</span>
      </div>
      <p className="lede">{e.notes}</p>

      {/* ---- GRAPHIC: exploded 3D if modelled, else procedural diagram ---- */}
      {modelled ? (
        <EngineExplorer engineId={engineId} />
      ) : (
        <>
          <EngineDiagram engine={e} />
          <p className="model-note">
            Schematic cross-section generated from this engine's figures. A full
            exploded 3D model is available for the modelled A320-family engines.
          </p>
        </>
      )}

      {/* ---- SPECS ---- */}
      <h2 className="section-title">Specification</h2>
      <dl className="spec-grid">
        <Spec label="Manufacturer" value={e.manufacturer} />
        <Spec label="Type" value={e.type} />
        <Spec label="Max thrust" value={e.thrustKn} unit="kN" />
        <Spec label="Bypass ratio" value={`${e.bypassRatio}:1`} />
        <Spec label="Fan diameter" value={e.fanDiameterM} unit="m" />
        <Spec label="Thrust (lbf)" value={Math.round(e.thrustKn * 224.809).toLocaleString()} unit="lbf" />
      </dl>

      {/* ---- COMPARATIVE BARS ---- */}
      <h2 className="section-title">Where it sits</h2>
      <div className="ebars">
        <Bar label="Thrust" value={e.thrustKn} max={maxThrust} unit="kN" />
        <Bar label="Bypass ratio" value={e.bypassRatio} max={maxBpr} />
        <Bar label="Fan diameter" value={e.fanDiameterM} max={maxFan} unit="m" />
      </div>

      {/* ---- USED ON ---- */}
      <h2 className="section-title">Used on</h2>
      {usedOn.length ? (
        <div className="idx-list">
          {usedOn.map((a) => (
            <Link key={`${a.familyId}-${a.id}`} to={`/family/${a.familyId}/${a.id}`} className="idx-row">
              <span className="idx-num">{a.familyName.replace(' Family', '')}</span>
              <span className="idx-main">
                <span className="idx-name">{a.name.replace(/^Airbus /, '')}</span>
                <span className="idx-desc">{a.dimensions.paxTypical} seats · {a.dimensions.rangeKm.toLocaleString()} km</span>
              </span>
              <span className="idx-meta"><span className="idx-arrow">→</span></span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="model-note">No aircraft in this archive currently list this engine.</p>
      )}
    </div>
  )
}
