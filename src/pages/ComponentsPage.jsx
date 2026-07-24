import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { COMPONENTS, COMPONENT_GROUPS } from '../data/components.js'
import Formula from '../components/Formula.jsx'
import Calculator from '../components/Calculator.jsx'

/**
 * /components — how each part of an airliner is built: material, process,
 * required technology, indicative cost and today's suppliers. Explore-mode
 * labels deep-link here with ?focus=<id>.
 */

function ComponentCard({ c, focused }) {
  const ref = useRef(null)
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focused])
  return (
    <article ref={ref} id={c.id} className={`comp-card ${focused ? 'focused' : ''}`}>
      <header>
        <h3>{c.name}</h3>
        <span className="comp-group">{c.group}</span>
      </header>
      <dl>
        <div><dt>Material</dt><dd>{c.material}</dd></div>
        <div><dt>How it's built</dt><dd>{c.process}</dd></div>
        <div><dt>Technology required</dt><dd>{c.technology}</dd></div>
        <div><dt>Indicative cost</dt><dd className="comp-cost">{c.cost}</dd></div>
        <div><dt>Who builds it</dt><dd>{c.suppliers.join(' · ')}</dd></div>
        <div><dt>Used on</dt><dd>{c.usedOn}</dd></div>
      </dl>
      <p className="comp-note">{c.note}</p>
      {c.design && (
        <div className="comp-design">
          <div className="comp-design-head">How it's designed · the math</div>
          <div className="comp-design-row"><span>Design driver</span><p>{c.design.driver}</p></div>
          <div className="comp-design-row"><span>Governing math</span><p className="comp-eq"><Formula>{c.design.equation}</Formula></p></div>
          <div className="comp-design-row"><span>Worked example</span><p>{c.design.example}</p></div>
          {c.design.calc && <Calculator calc={c.design.calc} />}
        </div>
      )}
    </article>
  )
}

export default function ComponentsPage() {
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const [group, setGroup] = useState('All')

  // if a focused component is filtered out, widen the filter automatically
  useEffect(() => {
    if (!focus) return
    const c = COMPONENTS.find((x) => x.id === focus)
    if (c && group !== 'All' && c.group !== group) setGroup('All')
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(
    () => (group === 'All' ? COMPONENTS : COMPONENTS.filter((c) => c.group === group)),
    [group]
  )

  return (
    <div>
      <h1>Components — how every part is built</h1>
      <p className="lede">
        Material, manufacturing process, the industrial technology it takes, indicative
        cost and today's suppliers — for each major component of an airliner. Costs are
        public estimates for scale, not procurement figures. Cross-linked from the{' '}
        <Link to="/family/a320/a320">Explore-inside view</Link> and the engine pages.
      </p>

      <div className="viewer-toggle" role="tablist" aria-label="Component group">
        {['All', ...COMPONENT_GROUPS].map((g) => (
          <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>

      <div className="comp-grid">
        {list.map((c) => (
          <ComponentCard key={c.id} c={c} focused={focus === c.id} />
        ))}
      </div>

      <p className="model-note" style={{ marginTop: 18 }}>
        Sources: public teardown analyses, supplier annual reports, certification documents
        (CS-25 / Part 25), manufacturer technical press. Figures are order-of-magnitude.
      </p>
    </div>
  )
}
