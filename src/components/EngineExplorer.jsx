import { useMemo, useState } from 'react'
import EngineViewer from '../three/EngineViewer.jsx'
import {
  ENGINE_MODELS,
  ENGINE_PARTS_BY_MODEL,
  TURBOFAN_CYCLE,
} from '../data/engineParts.js'

/**
 * Interactive engine teaching tool. Two modes:
 *  - "How it works": step through the turbofan cycle (Intake → Fan → Compress →
 *    Combust → Turbine → Exhaust). Each stage highlights the parts involved in 3D
 *    and explains what physically happens — i.e. how a real engine works.
 *  - "Explore parts": click any part to isolate it and read what it does.
 *
 * Both modes share one 3D canvas. `engineId` must exist in ENGINE_MODELS.
 */
export default function EngineExplorer({ engineId }) {
  const model = ENGINE_MODELS[engineId]
  const parts = ENGINE_PARTS_BY_MODEL[engineId]
  const [mode, setMode] = useState('how') // 'how' | 'parts'
  const [exploded, setExploded] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [selectedPart, setSelectedPart] = useState(null)

  if (!model || !parts) return null

  // Only show cycle stages whose parts actually exist in this model.
  const partNodes = useMemo(() => new Set(parts.map((p) => p.node)), [parts])
  const cycle = useMemo(
    () =>
      TURBOFAN_CYCLE.map((s) => ({
        ...s,
        nodes: s.nodes.filter((n) => partNodes.has(n)),
      })).filter((s) => s.nodes.length > 0),
    [partNodes]
  )

  const stage = cycle[Math.min(stageIdx, cycle.length - 1)]
  const selected = parts.find((p) => p.node === selectedPart) || null

  // What the 3D view highlights depends on mode.
  const highlightNodes =
    mode === 'how' ? stage?.nodes || [] : selectedPart ? [selectedPart] : []

  return (
    <div className="engine-explorer">
      <div className="ee-head">
        <div>
          <h3>{model.name}</h3>
          <p className="ee-overview">{model.overview}</p>
        </div>
        <div className="ee-controls">
          <div className="viewer-toggle">
            <button className={mode === 'how' ? 'on' : ''} onClick={() => setMode('how')}>
              How it works
            </button>
            <button className={mode === 'parts' ? 'on' : ''} onClick={() => setMode('parts')}>
              Explore parts
            </button>
          </div>
          <label className="ee-toggle">
            <input type="checkbox" checked={exploded} onChange={(e) => setExploded(e.target.checked)} />
            Exploded
          </label>
        </div>
      </div>

      <div className="ee-body">
        <EngineViewer
          url={model.model}
          parts={parts}
          exploded={exploded}
          highlightNodes={highlightNodes}
        />

        {mode === 'how' ? (
          <div className="ee-cycle">
            <div className="ee-cycle-steps">
              {cycle.map((s, i) => (
                <button
                  key={s.key}
                  className={i === stageIdx ? 'on' : ''}
                  onClick={() => setStageIdx(i)}
                >
                  <span className="ee-motto">{s.motto}</span>
                  {s.title}
                </button>
              ))}
            </div>
            <div className="ee-detail">
              <h4>{stage.title} <span className="ee-stage">{stage.motto}</span></h4>
              <p>{stage.what}</p>
              <div className="ee-nav">
                <button disabled={stageIdx === 0} onClick={() => setStageIdx((i) => Math.max(0, i - 1))}>
                  ← Prev
                </button>
                <span className="ee-progress">{stageIdx + 1} / {cycle.length}</span>
                <button
                  disabled={stageIdx === cycle.length - 1}
                  onClick={() => setStageIdx((i) => Math.min(cycle.length - 1, i + 1))}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="ee-parts">
            <ol>
              {parts.map((p, i) => (
                <li
                  key={p.node}
                  className={selectedPart === p.node ? 'on' : ''}
                  onMouseEnter={() => setSelectedPart(p.node)}
                  onMouseLeave={() => setSelectedPart(null)}
                  onClick={() => setSelectedPart(selectedPart === p.node ? null : p.node)}
                >
                  <span className="ee-num">{i + 1}</span>
                  <span className="ee-name">{p.name}</span>
                  <span className="ee-stage">{p.stage}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {mode === 'parts' && (
        selected ? (
          <div className="ee-detail">
            <h4>{selected.name} <span className="ee-stage">{selected.stage}</span></h4>
            <p>{selected.function}</p>
            <ul className="ee-specs">
              {selected.specs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="ee-hint">Hover or tap a part to isolate it in 3D and read what it does.</p>
        )
      )}
    </div>
  )
}
