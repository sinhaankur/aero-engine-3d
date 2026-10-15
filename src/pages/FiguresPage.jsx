import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal, Stagger, StaggerItem } from '../lib/motion.jsx'
import { TURBOFAN_CYCLE } from '../data/engineParts.js'

/**
 * "Everything that goes up" — a clean, Anatomy-style gallery of the machines
 * that fly or reach orbit, each shown so its KEY COMPONENTS are visible and you
 * can read how it works, not just look at it. Built on the `anatomy-figures`
 * library (same look as the Anatomy project) for the figures that exist today
 * (the jet system), with the bespoke subjects — satellite, Starlink, rocket,
 * UAV — authored with the Anatomy skill and dropped into their sections as they
 * land. Until then each shows a labelled "key components" panel so the section
 * already teaches the thing.
 *
 * Simple to navigate: a sticky section nav jumps between subjects; one theme
 * switcher drives every figure. Default `blueprint` matches the site's
 * drawing-sheet look.
 *
 * WEIGHT: library figures are ~1.5–2.7 MB of inline SVG/WebGL each, so every one
 * is lazy-loaded from its own subpath entry (explicit literal-specifier import()
 * map — Rollup needs static strings) and only mounts once it scrolls near the
 * viewport. The route itself stays a few KB.
 */

const THEMES = ['blueprint', 'dark', 'light', 'paper', 'sepia']

// Rollup needs each import() to be a static literal specifier, so the figure
// loaders live in one explicit map. (Subpath modules default-export the figure.)
const LOADERS = {
  turbofan: () => import('anatomy-figures/turbofan'),
  afterburner: () => import('anatomy-figures/afterburner'),
}
const F = (slug) => lazy(LOADERS[slug])

/** Mount `children` only once near the viewport, so a heavy figure's chunk isn't
 *  fetched until it's about to be seen. Keeps a placeholder to avoid layout jump. */
function LazyFig({ children, minHeight = 220 }) {
  const ref = useRef(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (show) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect() } },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show])
  return (
    <div ref={ref} style={{ minHeight: show ? undefined : minHeight }}>
      {show ? (
        <Suspense fallback={<div className="fig-loading" style={{ minHeight }} />}>
          {children}
        </Suspense>
      ) : null}
    </div>
  )
}

const Turbofan = F('turbofan')

// The four bespoke figures authored with the Anatomy skill (black-and-white,
// animated, same card UI/UX). Each is a ~130 KB self-contained component, so
// lazy-load them — only the section you scroll to pays for its figure.
const SatelliteFigure = lazy(() => import('../figures/SatelliteFigure.jsx'))
const StarlinkFigure = lazy(() => import('../figures/StarlinkFigure.jsx'))
const RocketFigure = lazy(() => import('../figures/RocketFigure.jsx'))
const UavFigure = lazy(() => import('../figures/UavFigure.jsx'))
const CUSTOM = { satellite: SatelliteFigure, starlink: StarlinkFigure, rocket: RocketFigure, uav: UavFigure }

// Section table of contents — drives the sticky jump-nav and the <section id>s.
const SECTIONS = [
  { id: 'jet', label: 'Jet system' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'starlink', label: 'Starlink' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'uav', label: 'UAV / drone' },
]

/**
 * Key-component lists for the subjects whose bespoke figure isn't drawn yet.
 * These make the section teach "what the parts are and how it works" from day
 * one; each becomes the figure's legend when the Anatomy figure lands.
 */
const COMPONENTS = {
  satellite: {
    tagline: 'A communications satellite — how it stays pointed, powered and talking.',
    parts: [
      ['Solar arrays', 'Fold out after launch; track the Sun to make all onboard power.'],
      ['Bus', 'The body: holds avionics, propulsion and the batteries for eclipse.'],
      ['Payload / transponders', 'Receive, amplify and re-transmit the signal on a new frequency.'],
      ['High-gain antenna', 'Dish or phased array aimed at the ground to focus the beam.'],
      ['Reaction wheels', 'Spin up/down to rotate the satellite without using fuel.'],
      ['Thrusters', 'Station-keeping: nudge it back to its exact orbital slot.'],
      ['Star tracker', 'Reads the star field to know precisely which way it points.'],
    ],
  },
  starlink: {
    tagline: 'A low-Earth-orbit constellation — many small satellites, handed off like cell towers.',
    parts: [
      ['LEO shell', 'Hundreds of sats at ~550 km — low enough for low latency.'],
      ['Orbital planes', 'Satellites spread evenly around inclined rings for full coverage.'],
      ['Phased-array antennas', 'Steer beams electronically — no moving dish — to many users.'],
      ['Inter-satellite laser links', 'Pass data sat-to-sat so traffic skips distant ground stations.'],
      ['User terminal', 'The "dish" on the ground auto-aims and locks the nearest satellite.'],
      ['Ground gateways', 'Bridge the constellation to the internet backbone.'],
      ['Hall thrusters', 'Electric propulsion raises orbit and de-orbits at end of life.'],
    ],
  },
  rocket: {
    tagline: 'A launch vehicle — staged to shed dead weight on the way up.',
    parts: [
      ['Payload / fairing', 'The cargo (satellite, capsule) under an aerodynamic nose shell.'],
      ['Guidance', 'Avionics that steer by gimballing the engines.'],
      ['Upper stage', 'Lights after separation to finish the climb to orbital speed.'],
      ['Interstage', 'Connects the stages and houses separation mechanisms.'],
      ['Propellant tanks', 'Fuel + oxidiser — most of the rocket is tankage.'],
      ['First-stage engines', 'Burn at liftoff for the thrust to leave the pad.'],
      ['Grid fins / legs', 'On reusable boosters: steer and land the first stage back.'],
    ],
  },
  uav: {
    tagline: 'A fixed-wing UAV — sensors forward, payload below, data linked home.',
    parts: [
      ['EO/IR sensor turret', 'Gimballed camera ball under the nose for day/night imaging.'],
      ['Autopilot / avionics', 'Flies waypoints and holds the orbit over a target.'],
      ['SATCOM antenna', 'The nose bulge — beyond-line-of-sight control via satellite.'],
      ['Wing / fuel', 'Long high-aspect wing for endurance; fuel lives in the wing.'],
      ['Payload hardpoints', 'Carry sensors or munitions under the wings.'],
      ['Pusher propeller', 'Rear prop keeps the nose sensors clear of the airflow.'],
      ['Datalink', 'Streams video and telemetry to the ground control station.'],
    ],
  },
}

// Drones worth knowing, grouped by where they're made — the region catalogue.
const UAV_REGIONS = [
  {
    region: 'United States', drones: [
      ['MQ-9 Reaper', 'Hunter-killer, ~27 h endurance, Hellfire + bombs.'],
      ['RQ-4 Global Hawk', 'High-altitude strategic ISR, ~32 h, 60 k ft.'],
      ['RQ-11 Raven', 'Hand-launched tactical mini-UAV.'],
    ],
  },
  {
    region: 'Turkey', drones: [
      ['Bayraktar TB2', 'MALE strike drone, laser-guided MAM munitions.'],
      ['Akıncı', 'Heavy UCAV, twin turboprop, cruise-missile capable.'],
    ],
  },
  {
    region: 'Israel', drones: [
      ['Heron TP', 'MALE ISR/strike, ~36 h, satellite-controlled.'],
      ['Harop', 'Loitering munition — orbits, then dives on the target.'],
    ],
  },
  {
    region: 'China', drones: [
      ['Wing Loong II', 'Reaper-class MALE export UCAV.'],
      ['CH-4', 'Widely exported strike/ISR drone.'],
    ],
  },
  {
    region: 'Iran', drones: [
      ['Shahed-136', 'Delta-wing loitering munition, swarmed cheaply.'],
      ['Mohajer-6', 'Tactical ISR/strike UAV.'],
    ],
  },
  {
    region: 'Europe', drones: [
      ['Eurodrone (MALE RPAS)', 'Twin-turboprop European MALE, in development.'],
      ['Watchkeeper WK450 (UK)', 'All-weather tactical ISR.'],
    ],
  },
]

/** A reusable "key components + how it works" panel for not-yet-drawn subjects. */
function ComponentPanel({ data }) {
  return (
    <div className="goesup-panel">
      <p className="goesup-tagline">{data.tagline}</p>
      <ol className="goesup-parts">
        {data.parts.map(([name, what]) => (
          <li key={name}>
            <span className="goesup-part-name">{name}</span>
            <span className="goesup-part-what">{what}</span>
          </li>
        ))}
      </ol>
      <p className="goesup-soon">Hover the figure — it's live; the parts above are its legend.</p>
    </div>
  )
}

export default function FiguresPage() {
  const [theme, setTheme] = useState('blueprint')

  return (
    <div>
      <Link to="/" className="back">← Home</Link>

      <div className="ac-head">
        <h1>Everything that goes up</h1>
      </div>
      <p className="lede">
        The machines that fly or reach orbit — a jet engine, a satellite, the
        Starlink constellation, a launch vehicle, a UAV — each shown so its{' '}
        <strong>key components are visible</strong> and you can read how it
        actually works. Drawn in the style of the{' '}
        <a href="https://github.com/wheresryan22/anatomy" target="_blank" rel="noreferrer noopener">Anatomy</a>{' '}
        skill. Pick a theme and jump to a section.
      </p>

      {/* sticky jump-nav + theme switcher: simple, easy to navigate */}
      <div className="goesup-nav">
        <nav className="goesup-jump" aria-label="Sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>{s.label}</a>
          ))}
        </nav>
        <div className="sys-tabs" role="group" aria-label="Figure theme">
          {THEMES.map((t) => (
            <button key={t} className={t === theme ? 'on' : ''} onClick={() => setTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── JET SYSTEM — the one subject the library already draws ── */}
      <section id="jet" className="goesup-section">
        <Reveal as="h2" className="section-title">Jet system</Reveal>
        <div className="goesup-figrow">
          <div className="goesup-stage">
            <LazyFig minHeight={300}>
              <Turbofan theme={theme} style={{ width: '100%', height: 'auto' }} />
            </LazyFig>
          </div>
          <div className="goesup-panel">
            <p className="goesup-tagline">
              A high-bypass turbofan: a big fan moves a huge mass of air, most of
              it bypassing the core. Here is the cycle, stage by stage.
            </p>
            <ol className="goesup-parts">
              {TURBOFAN_CYCLE.map((s) => (
                <li key={s.key}>
                  <span className="goesup-part-name">{s.title} · <em>{s.motto}</em></span>
                  <span className="goesup-part-what">{s.what}</span>
                </li>
              ))}
            </ol>
            <p className="goesup-soon">
              See the full exploded engine on the{' '}
              <Link to="/engine/leap-1a">engine pages</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* ── BESPOKE SUBJECTS — the Anatomy figure + its labelled legend ── */}
      {[
        ['satellite', 'Satellite'],
        ['starlink', 'Starlink'],
        ['rocket', 'Rocket'],
      ].map(([id, label]) => {
        const Fig = CUSTOM[id]
        return (
          <section key={id} id={id} className="goesup-section">
            <Reveal as="h2" className="section-title">{label}</Reveal>
            <div className="goesup-figrow">
              <div className="goesup-stage goesup-stage-figure">
                <LazyFig minHeight={300}><Fig /></LazyFig>
              </div>
              <ComponentPanel data={COMPONENTS[id]} />
            </div>
          </section>
        )
      })}

      {/* ── UAV — the figure, its legend, and the region catalogue ── */}
      <section id="uav" className="goesup-section">
        <Reveal as="h2" className="section-title">UAV / drone</Reveal>
        <div className="goesup-figrow">
          <div className="goesup-stage goesup-stage-figure">
            <LazyFig minHeight={300}><UavFigure /></LazyFig>
          </div>
          <ComponentPanel data={COMPONENTS.uav} />
        </div>

        <Reveal as="h3" className="goesup-subhead">By country / region</Reveal>
        <Stagger className="goesup-regions">
          {UAV_REGIONS.map((r) => (
            <StaggerItem key={r.region} className="goesup-region">
              <h4>{r.region}</h4>
              <ul>
                {r.drones.map(([name, what]) => (
                  <li key={name}>
                    <span className="goesup-drone-name">{name}</span>
                    <span className="goesup-drone-what">{what}</span>
                  </li>
                ))}
              </ul>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  )
}
