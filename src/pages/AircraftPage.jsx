import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFamily, getAircraft } from '../data/index.js'
import { RISK_LEVELS } from '../data/schema.js'
import AircraftViewer from '../three/AircraftViewer.jsx'
import Blueprint from '../components/Blueprint.jsx'
import EngineExplorer from '../components/EngineExplorer.jsx'
import { ENGINE_MODELS } from '../data/engineParts.js'

function Spec({ label, value, unit }) {
  return (
    <div className="spec">
      <dt>{label}</dt>
      <dd>{value}{unit ? <span className="unit"> {unit}</span> : null}</dd>
    </div>
  )
}

export default function AircraftPage() {
  const { familyId, aircraftId } = useParams()
  const family = getFamily(familyId)
  const a = getAircraft(familyId, aircraftId)
  const [view, setView] = useState('3d')

  if (!a) return <p>Aircraft not found. <Link to={`/family/${familyId}`}>Back</Link></p>

  const d = a.dimensions
  const risk = RISK_LEVELS[a.safety.risk]
  const modelUrl = a.model || undefined
  // The A380 is the only four-engine Airbus; everything else in the archive is a
  // twinjet. Drive both the 3D viewer and the blueprint from this.
  const engineCount = a.familyId === 'a380' ? 4 : 2
  // Double-deck (A380) and twin-aisle widebodies read differently on the sheet.
  const isDoubleDeck = a.familyId === 'a380'
  const isWidebody = d.fuselageDiaM >= 5.0

  // Engines that have a built 3D model, surfaced via a tab selector below.
  const modelledEngines = a.engines.filter((e) => ENGINE_MODELS[e.id])
  const [activeEngine, setActiveEngine] = useState(modelledEngines[0]?.id)
  // Fall back to the first available engine if the selected one isn't offered
  // on this variant (e.g. after navigating between aircraft).
  const resolvedEngine = modelledEngines.some((e) => e.id === activeEngine)
    ? activeEngine
    : modelledEngines[0]?.id

  return (
    <div>
      <Link to={`/family/${familyId}`} className="back">← {family?.name}</Link>
      <div className="ac-head">
        <h1>{a.name}</h1>
        <span className={`status status-${a.status}`}>{a.status.replace('-', ' ')}</span>
      </div>
      <p className="lede">{a.summary}</p>

      {/* ---- 3D / blueprint toggle ---- */}
      <div className="viewer-toggle">
        <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D model</button>
        <button className={view === 'blueprint' ? 'on' : ''} onClick={() => setView('blueprint')}>Blueprint</button>
      </div>
      {view === '3d' ? (
        <AircraftViewer modelUrl={modelUrl} dimensions={d} engineCount={engineCount} />
      ) : (
        <Blueprint
          dimensions={d}
          engineCount={engineCount}
          aircraft={a}
          subtitle={family?.tagline}
          doubleDeck={isDoubleDeck}
          wideBody={isWidebody}
        />
      )}
      {!a.model && (
        <p className="model-note">
          Showing a parametric model generated from this aircraft's dimensions.
          Drop an authored glTF at <code>/public/models/{a.id}.glb</code> and set
          <code> model</code> in the data file to replace it.
        </p>
      )}

      {/* ---- Dimensions ---- */}
      <h2 className="section-title">Dimensions & performance</h2>
      <dl className="spec-grid">
        <Spec label="Length" value={d.lengthM} unit="m" />
        <Spec label="Wingspan" value={d.wingspanM} unit="m" />
        <Spec label="Height" value={d.heightM} unit="m" />
        <Spec label="Fuselage dia." value={d.fuselageDiaM} unit="m" />
        <Spec label="MTOW" value={d.mtowKg.toLocaleString()} unit="kg" />
        <Spec label="Range" value={d.rangeKm.toLocaleString()} unit="km" />
        <Spec label="Cruise" value={`Mach ${d.cruiseMach}`} />
        <Spec label="Ceiling" value={d.ceilingM.toLocaleString()} unit="m" />
        <Spec label="Seats (typical)" value={d.paxTypical} />
        <Spec label="Seats (max)" value={d.paxMax} />
      </dl>

      {/* ---- Engines ---- */}
      <h2 className="section-title">Engine options</h2>
      <div className="engine-grid">
        {a.engines.map((e) => (
          <div key={e.id} className="engine-card">
            <div className="engine-head">
              <h3>{e.name}</h3>
              <span className="maker">{e.manufacturer}</span>
            </div>
            <dl className="spec-grid compact">
              <Spec label="Thrust" value={e.thrustKn} unit="kN" />
              <Spec label="Bypass ratio" value={e.bypassRatio} />
              <Spec label="Fan dia." value={e.fanDiameterM} unit="m" />
              <Spec label="Type" value={e.type} />
            </dl>
            <p className="engine-notes">{e.notes}</p>
            {ENGINE_MODELS[e.id] && <span className="badge badge-live">3D parts breakdown ↓</span>}
          </div>
        ))}
      </div>

      {/* ---- In-depth engine parts breakdown ---- */}
      {modelledEngines.length > 0 && (
        <div style={{ marginTop: 18 }}>
          {modelledEngines.length > 1 && (
            <div className="viewer-toggle" style={{ marginBottom: 12 }}>
              {modelledEngines.map((e) => (
                <button
                  key={e.id}
                  className={resolvedEngine === e.id ? 'on' : ''}
                  onClick={() => setActiveEngine(e.id)}
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}
          <EngineExplorer key={resolvedEngine} engineId={resolvedEngine} />
        </div>
      )}

      {/* ---- Timeline ---- */}
      <h2 className="section-title">Timeline</h2>
      <ul className="timeline">
        {a.timeline.map((t, i) => (
          <li key={i}>
            <span className="t-date">{t.date}</span>
            <span className="t-label">{t.label}</span>
          </li>
        ))}
      </ul>

      {/* ---- Safety ---- */}
      <h2 className="section-title">Safety record</h2>
      <div className="safety-panel" style={{ '--risk': risk.color }}>
        <div className="safety-rate">
          <span className="big">
            {a.safety.hullLossRate != null ? a.safety.hullLossRate.toFixed(2) : '—'}
          </span>
          <span className="small">hull losses / million departures</span>
          <span className="risk-pill" style={{ '--risk': risk.color }}>{risk.label} risk</span>
        </div>
        <dl className="spec-grid compact">
          <Spec label="Fatal accidents" value={a.safety.fatalEvents ?? '—'} />
          <Spec label="Hull-loss events" value={a.safety.totalLosses ?? '—'} />
        </dl>
        <p className="safety-notes">{a.safety.notes}</p>
        <p className="safety-sources">Sources: {a.safety.sources.join('; ')}</p>
      </div>
    </div>
  )
}
