import { Link } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'
import { ENGINES } from '../data/engines.js'
import { ENGINE_MODELS } from '../data/engineParts.js'
import { SYSTEMS } from '../data/systems.js'
import HeroPlane from '../three/HeroPlane.jsx'

const pad = (n) => String(n).padStart(2, '0')

// Flatten every aircraft across families, so the catalog can list them all.
function allAircraft() {
  return FAMILIES.flatMap((f) =>
    getAircraftForFamily(f.id).map((a) => ({ ...a, familyName: f.name })),
  )
}

// One row in a numbered index. `to` may be null → a "dead"/unlinked entry that
// still shows in the catalog (the tol.is "awaiting_prompt" energy), elevated
// here into an honest "not yet wired" marker.
function Row({ n, name, desc, meta, tag, to }) {
  const inner = (
    <>
      <span className="idx-num">{pad(n)}</span>
      <span className="idx-main">
        <span className="idx-name">{name}</span>
        {desc && <span className="idx-desc">{desc}</span>}
      </span>
      <span className="idx-meta">
        {meta && <span>{meta}</span>}
        {tag && <span className={`idx-tag ${tag.kind || ''}`}>{tag.label}</span>}
        {to && <span className="idx-arrow">→</span>}
      </span>
    </>
  )
  if (!to) return <div className="idx-row is-dead" title="Not wired yet">{inner}</div>
  return <Link to={to} className="idx-row">{inner}</Link>
}

function Section({ hash, title, count, children }) {
  return (
    <>
      <div className="idx-head">
        <span className="hash">{hash}</span>
        <span className="title">{title}</span>
        {count != null && <span className="count">{count} {count === 1 ? 'entry' : 'entries'}</span>}
      </div>
      <div className="idx-list">{children}</div>
    </>
  )
}

export default function Home() {
  const aircraft = allAircraft()
  const engines = Object.values(ENGINES)
  const stats = {
    families: FAMILIES.length,
    aircraft: aircraft.length,
    engines: engines.length,
    systems: SYSTEMS.length,
  }

  let i = 0 // running index across the whole catalog

  return (
    <div>
      {/* ---- STATUS BANNER ---- */}
      <div className="status-banner">
        <span className="dot" />
        <span className="k">Status</span>
        <span className="v">ONLINE</span>
        <span className="sep">/</span>
        <span className="k">Archive</span>
        <span className="v">{stats.families} families · {stats.aircraft} aircraft</span>
        <span className="spacer" />
        <Link to="/systems">SYSTEMS →</Link>
      </div>

      {/* ---- MASTHEAD ---- */}
      <div className="masthead">
        <h1>
          Aircraft Design <span className="accent">Archive</span>
          <span className="cursor">_</span>
        </h1>
        <p>
          An interactive, engineering-grade catalog of aircraft families — every
          variant in 3D, dimensioned blueprints, exploded engines, and the systems
          that keep them flying. Pick an index entry below.
        </p>
      </div>

      {/* ---- ANIMATED MODEL VIEWPORT ---- */}
      <div className="hero-viewport">
        <span className="tag-corner">MODEL // <b>A320</b> · LIVE RENDER</span>
        <HeroPlane url="/models/a320.glb" height={340} />
      </div>

      {/* ---- LIVE COUNTS ---- */}
      <div className="count-strip">
        <div className="count-cell"><span className="n">{pad(stats.families)}</span><span className="l">Families</span></div>
        <div className="count-cell"><span className="n">{pad(stats.aircraft)}</span><span className="l">Aircraft</span></div>
        <div className="count-cell"><span className="n">{pad(stats.engines)}</span><span className="l">Engines</span></div>
        <div className="count-cell"><span className="n">{pad(stats.systems)}</span><span className="l">Systems</span></div>
      </div>

      {/* ---- FAMILIES ---- */}
      <Section hash="//" title="Families" count={FAMILIES.length}>
        {FAMILIES.map((f) => {
          const count = getAircraftForFamily(f.id).length
          i += 1
          return (
            <Row
              key={f.id}
              n={i}
              name={f.name}
              desc={f.tagline}
              meta={`${count} variants`}
              tag={{ label: 'Live', kind: 'live' }}
              to={`/family/${f.id}`}
            />
          )
        })}
      </Section>

      {/* ---- ALL AIRCRAFT ---- */}
      <Section hash="//" title="Aircraft" count={aircraft.length}>
        {aircraft.map((a) => {
          i += 1
          return (
            <Row
              key={a.id}
              n={i}
              name={a.name.replace(/^Airbus /, '')}
              desc={`${a.dimensions.lengthM.toFixed(1)} m · ${a.dimensions.paxTypical} seats`}
              meta={a.status.replace('-', ' ')}
              tag={{ label: '3D', kind: 'live' }}
              to={`/family/${a.familyId}/${a.id}`}
            />
          )
        })}
      </Section>

      {/* ---- ENGINES ---- */}
      <Section hash="//" title="Engines" count={engines.length}>
        {engines.map((e) => {
          i += 1
          const hasModel = !!ENGINE_MODELS[e.id]
          return (
            <Row
              key={e.id}
              n={i}
              name={e.name}
              desc={`${e.thrustKn} kN · BPR ${e.bypassRatio} · Ø${e.fanDiameterM} m`}
              meta={e.manufacturer}
              tag={hasModel ? { label: 'Exploded 3D', kind: 'live' } : { label: 'Schematic', kind: 'soon' }}
              to={`/engine/${e.id}`}
            />
          )
        })}
      </Section>

      {/* ---- SYSTEMS ---- */}
      <Section hash="//" title="Systems" count={SYSTEMS.length}>
        {SYSTEMS.map((s) => {
          i += 1
          return (
            <Row
              key={s.id}
              n={i}
              name={s.name}
              desc={s.summary?.slice(0, 68) + (s.summary && s.summary.length > 68 ? '…' : '')}
              meta={`${s.components?.length ?? 0} components`}
              tag={{ label: 'Schematic', kind: 'live' }}
              to="/systems"
            />
          )
        })}
      </Section>

      {/* ---- REFERENCE / ROADMAP (surfacing the currently-unlinked doc) ---- */}
      <Section hash="//" title="Reference" count={2}>
        <Row
          n={(i += 1)}
          name="Roadmap"
          desc="Where this is going: open aviation knowledge base + LLM"
          meta="docs/ROADMAP.md"
          tag={{ label: 'Doc', kind: 'soon' }}
          to={null}
        />
        <Row
          n={(i += 1)}
          name="Data sources"
          desc="Nominal public specs; safety figures attributed per aircraft"
          meta="public records"
          tag={{ label: 'Note', kind: 'soon' }}
          to={null}
        />
      </Section>
    </div>
  )
}
