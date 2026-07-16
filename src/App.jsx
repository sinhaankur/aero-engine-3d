import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { getFamily, getAircraft, getEngine } from './data/index.js'

const BASE_TITLE = 'Aircraft Design Archive'
const BASE_DESC =
  'An interactive encyclopedia of aircraft families: rotate every Airbus ' +
  'variant in 3D, read engineering blueprints, explode the engines, simulate ' +
  'the physics and explore attributed safety records.'

// per-route <title> + meta description, resolved from the data layer so
// aircraft/engine pages get real names in search results and link previews
function routeMeta(pathname) {
  const seg = pathname.split('/').filter(Boolean)
  switch (seg[0]) {
    case 'live':
      return ['Live Air Traffic on a 3D Globe', 'Every airborne aircraft right now — real-time ADS-B positions, altitudes and flight paths, plotted on an interactive globe.']
    case 'simulate':
      return ['Flight Physics Simulator — Every Airbus, Any Wind', 'Pick any Airbus variant and fly its wing through calm air, gusts, turbulence and wind shear. Real lift physics computed from real specs.']
    case 'compare':
      return ['Compare Aircraft at True Scale', 'Overlay any two Airbus variants at true relative scale — plan and profile silhouettes plus a full spec delta table.']
    case 'systems':
      return ['How Aircraft Systems Work', "Interactive schematics of the A320's electrical, hydraulic, fly-by-wire, fuel, pneumatic and landing-gear systems — including what happens when they fail."]
    case 'projector':
      return ['Aviation Projector Apps', 'Kiosk APKs that turn an Android projector into a live aviation wall.']
    case 'engine': {
      const e = seg[1] && getEngine(seg[1])
      if (e) return [`${e.name} Turbofan — Exploded View & Specs`, `${e.name} by ${e.manufacturer}: ${e.thrustKn} kN thrust, bypass ratio ${e.bypassRatio}, ${e.fanDiameterM} m fan. ${e.notes || ''}`.trim()]
      break
    }
    case 'family': {
      if (seg[2]) {
        const a = getAircraft(seg[1], seg[2])
        if (a) return [`${a.name} — 3D Model, Blueprint & Specs`, a.summary]
      }
      const f = seg[1] && getFamily(seg[1])
      if (f) return [`${f.name} — Every Variant in 3D`, f.tagline]
      break
    }
  }
  return [null, BASE_DESC]
}

/** Sets title/description per route and resets scroll on navigation. */
function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    const [title, desc] = routeMeta(pathname)
    document.title = title ? `${title} · ${BASE_TITLE}` : `${BASE_TITLE} — See how airliners are designed, inside and out`
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="app">
      <RouteEffects />
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">✈</span> ADA / Aircraft Design Archive
        </Link>
        <nav className="topnav">
          <Link to="/">Index</Link>
          <Link to="/live">Live</Link>
          <Link to="/simulate">Simulate</Link>
          <Link to="/compare">Compare</Link>
          <Link to="/systems">Systems</Link>
          <Link to="/projector">Projector</Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-cols">
          <div className="footer-brand">
            <span className="brand"><span className="brand-mark">✈</span> Aircraft Design Archive</span>
            <p>
              An interactive encyclopedia of aircraft families — 3D models,
              blueprints, engines, systems and attributed safety records.
            </p>
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            <Link to="/">Families</Link>
            <Link to="/">All aircraft</Link>
            <Link to="/systems">Systems</Link>
          </div>
          <div className="footer-col">
            <h4>Families</h4>
            <Link to="/family/a320">A320</Link>
            <Link to="/family/a350">A350</Link>
            <Link to="/family/a380">A380</Link>
          </div>
        </div>
        <div className="footer-fine">
          Specs are nominal public figures; safety figures are attributed per
          aircraft and sourced from public aviation-safety records. Not affiliated
          with Airbus.
        </div>
      </footer>
    </div>
  )
}
