import { useState } from 'react'
import EngineViewer from '../three/EngineViewer.jsx'
import { ENGINE_MODELS, ENGINE_PARTS_BY_MODEL } from '../data/engineParts.js'

/**
 * Interactive in-depth engine breakdown: a 3D turbofan you can explode into its
 * parts, plus a clickable list where each part explains what it does. Selecting
 * a part isolates it in the 3D view; toggling "Exploded" spreads the parts apart.
 *
 * `engineId` must have an entry in ENGINE_MODELS / ENGINE_PARTS_BY_MODEL.
 * Engines without a built model simply render nothing here.
 */
export default function EngineExplorer({ engineId }) {
  const model = ENGINE_MODELS[engineId]
  const parts = ENGINE_PARTS_BY_MODEL[engineId]
  const [exploded, setExploded] = useState(true)
  const [selected, setSelected] = useState(null)

  if (!model || !parts) return null

  const selectedPart = parts.find((p) => p.node === selected) || null

  return (
    <div className="engine-explorer">
      <div className="ee-head">
        <div>
          <h3>{model.name} — part breakdown</h3>
          <p className="ee-overview">{model.overview}</p>
        </div>
        <label className="ee-toggle">
          <input type="checkbox" checked={exploded} onChange={(e) => setExploded(e.target.checked)} />
          Exploded view
        </label>
      </div>

      <div className="ee-body">
        <EngineViewer
          url={model.model}
          parts={parts}
          exploded={exploded}
          selectedNode={selected}
        />

        <div className="ee-parts">
          <ol>
            {parts.map((p, i) => (
              <li
                key={p.node}
                className={selected === p.node ? 'on' : ''}
                onMouseEnter={() => setSelected(p.node)}
                onMouseLeave={() => setSelected(null)}
                onClick={() => setSelected(selected === p.node ? null : p.node)}
              >
                <span className="ee-num">{i + 1}</span>
                <span className="ee-name">{p.name}</span>
                <span className="ee-stage">{p.stage}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {selectedPart ? (
        <div className="ee-detail">
          <h4>{selectedPart.name} <span className="ee-stage">{selectedPart.stage}</span></h4>
          <p>{selectedPart.function}</p>
          <ul className="ee-specs">
            {selectedPart.specs.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="ee-hint">Hover or tap a part to isolate it and read what it does.</p>
      )}
    </div>
  )
}
