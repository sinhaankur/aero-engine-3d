import { lazy, Suspense, useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { m, useReducedMotion, animate } from 'framer-motion'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'
import { ENGINES } from '../data/engines.js'
import { ENGINE_MODELS } from '../data/engineParts.js'
import { SYSTEMS } from '../data/systems.js'
import { Stagger, StaggerItem, container, item, itemReduced } from '../lib/motion.jsx'
import { NAV } from '../components/NavMenu.jsx'

/**
 * Count a stat up from 0 on mount — a small premium flourish that fits the
 * tabular-nums engineering readout. Honours reduced-motion (jumps to the value).
 */
function CountUp({ to, pad = 2, duration = 1.1 }) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? to : 0)
  useEffect(() => {
    if (reduce) { setN(to); return }
    const controls = animate(0, to, {
      duration, ease: [0.2, 0.7, 0.3, 1],
      onUpdate: (v) => setN(Math.round(v)),
    })
    return () => controls.stop()
  }, [to, reduce, duration])
  return <>{String(n).padStart(pad, '0')}</>
}

// Three.js is heavy — load the live viewport only when Home actually renders,
// keeping it out of the initial bundle shared with every other route.
const HeroPlane = lazy(() => import('../three/HeroPlane.jsx'))

const short = (name) => name.replace(/^(Airbus|Boeing) /, '')

/**
 * Single-screen sitemap. The whole IA — every family, variant, engine, system
 * and experience — is one click away without scrolling on a laptop display:
 * masthead + live render up top, then three columns of the full catalog.
 */


export default function Home() {
  const reduce = useReducedMotion()
  const engines = Object.values(ENGINES)
  const aircraftCount = FAMILIES.reduce((n, f) => n + getAircraftForFamily(f.id).length, 0)

  // pointer-parallax on the hero tile: the render tilts a few degrees toward
  // the cursor, like handling a desk model. No-op under reduced motion.
  const heroRef = useRef(null)
  const tiltRaf = useRef(0)
  const onHeroMove = (e) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    cancelAnimationFrame(tiltRaf.current)
    tiltRaf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`
    })
  }
  const onHeroLeave = () => {
    cancelAnimationFrame(tiltRaf.current)
    if (heroRef.current) heroRef.current.style.transform = ''
  }

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
        <m.div
          className="map-mast"
          variants={container(0.08, 0.05)}
          initial="hidden"
          animate="show"
        >
          <m.h1 variants={reduce ? itemReduced : item}>
            Aircraft Design <span className="accent">Archive</span>
            <span className="cursor">_</span>
          </m.h1>
          <m.p variants={reduce ? itemReduced : item}>
            An interactive, engineering-grade catalog of aircraft families — every
            variant in 3D, dimensioned blueprints, exploded engines, live traffic
            and the systems that keep them flying. Everything is one click away.
          </m.p>
          <m.div className="map-stats" variants={reduce ? itemReduced : item}>
            <div className="map-stat"><span className="n"><CountUp to={FAMILIES.length} /></span><span className="l">Families</span></div>
            <div className="map-stat"><span className="n"><CountUp to={aircraftCount} /></span><span className="l">Aircraft</span></div>
            <div className="map-stat"><span className="n"><CountUp to={engines.length} /></span><span className="l">Engines</span></div>
            <div className="map-stat"><span className="n"><CountUp to={SYSTEMS.length} /></span><span className="l">Systems</span></div>
          </m.div>
        </m.div>
        <m.div
          className="map-hero"
          ref={heroRef}
          onMouseMove={onHeroMove}
          onMouseLeave={onHeroLeave}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.3, 1], delay: 0.15 }}
        >
          <span className="tag-corner">MODEL // <b>A320</b> · LIVE RENDER</span>
          <Suspense fallback={<div className="viewport-loading" style={{ height: 230 }}>Loading model…</div>}>
            <HeroPlane url="/models/a320.glb" height={230} />
          </Suspense>
        </m.div>
      </div>

      {/* ---- THE SITEMAP GRID ---- */}
      <Stagger className="map-grid" stagger={0.1} delay={0.25}>
        {/* fleet: every family, every variant */}
        <StaggerItem className="map-col">
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
        </StaggerItem>

        {/* engines + systems */}
        <StaggerItem className="map-col">
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
        </StaggerItem>

        {/* experience + learn — mirrors the nav's L1/L2 groups so the IA reads
            the same in the bar and on the page (one source of truth: NAV) */}
        <StaggerItem className="map-col">
          {NAV.filter((g) => g.id === 'experience' || g.id === 'learn').map((g, gi) => (
            <div key={g.id}>
              <div className={`map-col-head ${gi > 0 ? 'map-col-head-2' : ''}`}>
                <span className="hash">//</span>
                <span>{g.label}</span>
                <span className="count">{g.blurb}</span>
              </div>
              {g.items.map((it) => (
                <Link key={it.to} to={it.to} className="map-big">
                  <span className="name">
                    {it.label}
                    {it.live && <span className="idx-tag live">Live</span>}
                  </span>
                  <span className="desc">{it.desc}</span>
                </Link>
              ))}
            </div>
          ))}
          <div className="map-col-head map-col-head-2">
            <span className="hash">//</span>
            <span>Reference</span>
          </div>
          <div className="map-fine">
            Nominal public specs; safety figures attributed per aircraft.
            Roadmap: open aviation knowledge base + LLM — <code>docs/ROADMAP.md</code>.
          </div>
        </StaggerItem>
      </Stagger>
    </div>
  )
}
