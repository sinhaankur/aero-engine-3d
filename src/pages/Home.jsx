import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'
import { ENGINES } from '../data/engines.js'
import { ENGINE_MODELS } from '../data/engineParts.js'
import { SYSTEMS } from '../data/systems.js'

// Three.js is heavy — load the live viewport only when Home actually renders,
// keeping it out of the initial bundle shared with every other route.
const HeroPlane = lazy(() => import('../three/HeroPlane.jsx'))

const short = (name) => name.replace(/^Airbus /, '')

/**
 * Single-screen sitemap. The whole IA — every family, variant, engine, system
 * and experience — is one click away without scrolling on a laptop display:
 * masthead + live render up top, then three columns of the full catalog.
 */

const EXPLORE = [
  { to: '/live', name: 'Live traffic', tag: { label: 'Live', kind: 'live' }, desc: 'Every real aircraft in the sky right now, plotted on a 3D globe from ADS-B.' },
  { to: '/simulate', name: 'Simulate', tag: { label: 'Interactive', kind: 'live' }, desc: 'Pick any variant and drive lift, stalls, wind conditions, fuel flow and a real CFD wind tunnel.' },
  { to: '/systems', name: 'Systems', tag: { label: 'Learn', kind: 'live' }, desc: 'How the electrics, hydraulics and fly-by-wire actually work, with live schematics.' },
  { to: '/projector', name: 'Projector', tag: { label: 'APK', kind: 'soon' }, desc: 'Kiosk apps that turn a projector into a live aviation wall.' },
]

export default function Home() {
  const engines = Object.values(ENGINES)
  const aircraftCount = FAMILIES.reduce((n, f) => n + getAircraftForFamily(f.id).length, 0)

  return (
    <div>
      {/* ---- STATUS BANNER ---- */}
      <div className="status-banner">
        <span className="dot" />
        <span className="k">Status</span>
        <span className="v">ONLINE</span>
        <span className="sep">/</span>
        <span className="k">Archive</span>
        <span className="v">{FAMILIES.length} families · {aircraftCount} aircraft</span>
        <span className="spacer" />
        <Link to="/live">LIVE TRAFFIC →</Link>
      </div>

      {/* ---- MASTHEAD + LIVE RENDER ---- */}
      <div className="map-top">
        <div className="map-mast">
          <h1>
            Aircraft Design <span className="accent">Archive</span>
            <span className="cursor">_</span>
          </h1>
          <p>
            An interactive, engineering-grade catalog of aircraft families — every
            variant in 3D, dimensioned blueprints, exploded engines, live traffic
            and the systems that keep them flying. Everything is one click away.
          </p>
          <div className="map-stats">
            <div className="map-stat"><span className="n">{String(FAMILIES.length).padStart(2, '0')}</span><span className="l">Families</span></div>
            <div className="map-stat"><span className="n">{String(aircraftCount).padStart(2, '0')}</span><span className="l">Aircraft</span></div>
            <div className="map-stat"><span className="n">{String(engines.length).padStart(2, '0')}</span><span className="l">Engines</span></div>
            <div className="map-stat"><span className="n">{String(SYSTEMS.length).padStart(2, '0')}</span><span className="l">Systems</span></div>
          </div>
        </div>
        <div className="map-hero">
          <span className="tag-corner">MODEL // <b>A320</b> · LIVE RENDER</span>
          <Suspense fallback={<div className="viewport-loading" style={{ height: 230 }}>Loading model…</div>}>
            <HeroPlane url="/models/a320.glb" height={230} />
          </Suspense>
        </div>
      </div>

      {/* ---- THE SITEMAP GRID ---- */}
      <div className="map-grid">
        {/* fleet: every family, every variant */}
        <div className="map-col">
          <div className="map-col-head">
            <span className="hash">//</span>
            <span>Fleet</span>
            <span className="count">{FAMILIES.length} families · {aircraftCount} aircraft</span>
          </div>
          {FAMILIES.map((f) => {
            const variants = getAircraftForFamily(f.id)
            return (
              <div key={f.id} className="map-fam">
                <Link to={`/family/${f.id}`} className="map-fam-name">
                  {f.name}<span className="map-fam-meta">{variants.length} variants →</span>
                </Link>
                <div className="map-chips">
                  {variants.map((a) => (
                    <Link key={a.id} to={`/family/${f.id}/${a.id}`} className="map-chip">
                      {short(a.name)}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* engines + systems */}
        <div className="map-col">
          <div className="map-col-head">
            <span className="hash">//</span>
            <span>Engines</span>
            <span className="count">{engines.length}</span>
          </div>
          <div className="map-chips">
            {engines.map((e) => (
              <Link
                key={e.id}
                to={`/engine/${e.id}`}
                className={`map-chip ${ENGINE_MODELS[e.id] ? 'is-3d' : ''}`}
                title={`${e.manufacturer} · ${e.thrustKn} kN${ENGINE_MODELS[e.id] ? ' · exploded 3D' : ''}`}
              >
                {e.name}
              </Link>
            ))}
          </div>
          <div className="map-col-head map-col-head-2">
            <span className="hash">//</span>
            <span>Systems</span>
            <span className="count">{SYSTEMS.length}</span>
          </div>
          <div className="map-chips">
            {SYSTEMS.map((s) => (
              <Link key={s.id} to={`/systems/${s.id}`} className="map-chip">
                {s.name}
              </Link>
            ))}
          </div>
        </div>

        {/* experiences + reference */}
        <div className="map-col">
          <div className="map-col-head">
            <span className="hash">//</span>
            <span>Explore</span>
          </div>
          {EXPLORE.map((x) => (
            <Link key={x.to} to={x.to} className="map-big">
              <span className="name">
                {x.name}
                <span className={`idx-tag ${x.tag.kind}`}>{x.tag.label}</span>
              </span>
              <span className="desc">{x.desc}</span>
            </Link>
          ))}
          <div className="map-col-head map-col-head-2">
            <span className="hash">//</span>
            <span>Reference</span>
          </div>
          <div className="map-fine">
            Nominal public specs; safety figures attributed per aircraft.
            Roadmap: open aviation knowledge base + LLM — <code>docs/ROADMAP.md</code>.
          </div>
        </div>
      </div>
    </div>
  )
}
