import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFamily, getAircraft } from '../data/index.js'
import { RISK_LEVELS } from '../data/schema.js'
import Blueprint from '../components/Blueprint.jsx'
import { ENGINE_MODELS } from '../data/engineParts.js'
import { TYPES_FOR_AIRCRAFT } from '../data/icaoTypes.js'

/**
 * Sky ↔ plane bridge: one-shot count of this exact type airborne right now,
 * from the same ADS-B proxy the live globe uses. Renders nothing when the
 * proxy is unset, the fetch fails, or none are flying — the page never blocks
 * on the network.
 */
function LiveNow({ aircraftId }) {
  const codes = TYPES_FOR_AIRCRAFT[aircraftId]
  const [n, setN] = useState(null)
  useEffect(() => {
    const proxy = import.meta.env.VITE_FLIGHT_API
    if (!proxy || !codes?.length) return undefined
    let dead = false
    const ctrl = new AbortController()
    fetch(proxy, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (dead) return
        const set = new Set(codes)
        setN((d.states || []).filter((s) => set.has(s[18]) && !s[8]).length)
      })
      .catch(() => {})
    return () => { dead = true; ctrl.abort() }
  }, [aircraftId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!n) return null
  return (
    <Link className="live-now" to={`/live?type=${codes.join(',')}`} title="See them on the live globe">
      <span className="live-now-dot" /> {n.toLocaleString()} airborne right now →
    </Link>
  )
}

// Defer the WebGL-backed viewers so Three.js loads on demand, not up front.
const AircraftViewer = lazy(() => import('../three/AircraftViewer.jsx'))
const ExploreViewer = lazy(() => import('../three/ExploreViewer.jsx'))
const EngineExplorer = lazy(() => import('../components/EngineExplorer.jsx'))

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
  const [explode, setExplode] = useState(0)

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
        <LiveNow aircraftId={a.id} />
      </div>
      <p className="lede">{a.summary}</p>

      {/* ---- 3D / blueprint toggle ---- */}
      <div className="viewer-bar">
        <div className="viewer-toggle">
          <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D model</button>
          {a.model && (
            <button className={view === 'explore' ? 'on' : ''} onClick={() => setView('explore')}>Explore inside</button>
          )}
          <button className={view === 'blueprint' ? 'on' : ''} onClick={() => setView('blueprint')}>Blueprint</button>
        </div>
        {view === '3d' && a.model && (
          <label className="explode-ctrl" title="Spread the airframe into its components">
            <span>Assembled</span>
            <input
              type="range" min="0" max="100" step="1" value={explode}
              onChange={(e) => setExplode(+e.target.value)}
            />
            <span>Exploded</span>
          </label>
        )}
      </div>
      {view === '3d' ? (
        <Suspense fallback={<div className="viewport-loading">Loading 3D model…</div>}>
          <AircraftViewer modelUrl={modelUrl} dimensions={d} engineCount={engineCount} exploded={explode / 100} />
        </Suspense>
      ) : view === 'explore' ? (
        <Suspense fallback={<div className="viewport-loading">Loading explore mode…</div>}>
          <ExploreViewer modelUrl={modelUrl} dimensions={d} />
        </Suspense>
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
      {/* function-focused cross-links: this page is the hub for visualising
          the aircraft and how it works */}
      <div className="ac-actions">
        {a.model && (
          <Link className="ac-action" to={`/fly?ac=${familyId}/${a.id}`}>
            🛫 Fly it — cockpit view, real weather
          </Link>
        )}
        <Link className="ac-action" to={`/simulate?ac=${familyId}/${a.id}`}>
          🌬 Fly this wing — lift, stall &amp; wind conditions
        </Link>
        <Link className="ac-action" to="/compare">⇄ Compare against another variant</Link>
        <Link className="ac-action" to="/systems">⚙ How its systems work</Link>
        <Link className="ac-action" to="/components">🔩 How its parts are built</Link>
      </div>

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
        <Spec label="Wing area" value={d.wingAreaM2} unit="m²" />
        <Spec label="Wing loading" value={Math.round(d.mtowKg / d.wingAreaM2)} unit="kg/m²" />
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
          <Link key={e.id} to={`/engine/${e.id}`} className="engine-card">
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
            <span className="family-card-cta">
              {ENGINE_MODELS[e.id] ? 'Exploded 3D →' : 'View engine →'}
            </span>
          </Link>
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
          <Suspense fallback={<div className="viewport-loading">Loading engine…</div>}>
            <EngineExplorer key={resolvedEngine} engineId={resolvedEngine} />
          </Suspense>
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
