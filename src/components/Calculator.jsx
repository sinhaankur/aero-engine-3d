import { useMemo, useState } from 'react'

/**
 * Interactive worked example. Given a `calc` spec ({ title, inputs[], compute })
 * from a design block, it renders a slider per input and recomputes the sizing
 * outputs live as you drag — so a newcomer can FEEL how the design math responds
 * (spin the fan faster → the root pull rockets; thin the skin → hoop stress climbs).
 */
export default function Calculator({ calc }) {
  const [vals, setVals] = useState(() =>
    Object.fromEntries(calc.inputs.map((i) => [i.key, i.value]))
  )
  const outputs = useMemo(() => calc.compute(vals), [calc, vals])
  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }))
  const reset = () => setVals(Object.fromEntries(calc.inputs.map((i) => [i.key, i.value])))

  const fmt = (n) => {
    const num = Number(n)
    return Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n
  }

  return (
    <div className="calc">
      <div className="calc-head">
        <span>Try it — {calc.title}</span>
        <button className="calc-reset" onClick={reset} title="Reset to the worked example">↺</button>
      </div>
      <div className="calc-inputs">
        {calc.inputs.map((inp) => (
          <label key={inp.key} className="calc-input">
            <span className="calc-input-l">{inp.label}</span>
            <input
              type="range" min={inp.min} max={inp.max} step={inp.step}
              value={vals[inp.key]}
              onChange={(e) => set(inp.key, +e.target.value)}
            />
            <span className="calc-input-v">{fmt(vals[inp.key])}<i>{inp.unit}</i></span>
          </label>
        ))}
      </div>
      <div className="calc-outputs">
        {outputs.map((o, i) => (
          <div key={i} className={`calc-out ${o.big ? 'big' : ''} ${o.warn ? 'warn' : ''}`}>
            <span className="calc-out-l">{o.label}</span>
            <span className="calc-out-v">{fmt(o.value)} <i>{o.unit}</i></span>
            {o.note && <span className="calc-out-note">{o.note}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
