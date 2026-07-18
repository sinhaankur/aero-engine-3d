import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { getFamily, getAircraft, getEngine } from './data/index.js'

const BASE_TITLE = 'Aircraft Design Archive'
const BASE_DESC =
  'An interactive encyclopedia of aircraft families: rotate every Airbus and ' +
  'Boeing variant in 3D, read engineering blueprints, explode the engines, ' +
  'simulate the physics and explore attributed safety records.'

// per-route <title> + meta description, resolved from the data layer so
// aircraft/engine pages get real names in search results and link previews
function routeMeta(pathname) {
  const seg = pathname.split('/').filter(Boolean)
  switch (seg[0]) {
    case 'live':
      return ['Live Air Traffic on a 3D Globe', 'Every airborne aircraft right now — real-time ADS-B positions, altitudes and flight paths, plotted on an interactive globe.']
    case 'fly':
      return ['Fly Any Airliner — Cockpit-Level Simulator', 'Take off, cruise and land any variant with a working PFD, real ISA atmosphere and five weather presets.']
    case 'routes':
      return ['Route Checker — Can It Fly This Route?', 'Pick two airports and test every variant against the great-circle distance with real wind corrections — the payload-range story made visible.']
    case 'components':
      return ['Aircraft Components — How Every Part Is Built', 'Material, manufacturing process, required technology, indicative cost and suppliers for each major airliner component.']
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

/**
 * Global parallax driver: eases pointer position and mirrors scroll into CSS
 * custom properties (--pmx/--pmy unitless −0.5..0.5, --psy px). Layers pick
 * their own depth by multiplying these in `translate:` calc()s, so the cloud
 * strata, contour glyphs and specks all drift at different rates. Never runs
 * under prefers-reduced-motion — the variables default to 0 in CSS.
 */
function ParallaxDriver() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement.style
    let raf = 0
    let tmx = 0, tmy = 0, mx = 0, my = 0, sy = window.scrollY
    const loop = () => {
      mx += (tmx - mx) * 0.055 // floaty easing toward the pointer
      my += (tmy - my) * 0.055
      root.setProperty('--pmx', mx.toFixed(4))
      root.setProperty('--pmy', my.toFixed(4))
      root.setProperty('--psy', sy.toFixed(1))
      raf = requestAnimationFrame(loop)
    }
    const onMove = (e) => {
      tmx = e.clientX / window.innerWidth - 0.5
      tmy = e.clientY / window.innerHeight - 0.5
    }
    const onScroll = () => { sy = window.scrollY }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  return null
}

/** Route-keyed wrapper so every page glides in instead of popping. */
function AnimatedOutlet() {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-enter">
      <Outlet />
    </div>
  )
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

  // scroll-reveal: catalog blocks drift in as they enter the viewport, with a
  // light stagger — skipped entirely under prefers-reduced-motion
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = document.querySelectorAll(
      '.section-title, .map-col, .engine-card, .sys-card, .spec-grid, .cmp-body, .proj-card, .safety-panel, .count-strip, .comp-card, .timeline, .ac-actions',
    )
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('revealed')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.08 },
    )
    els.forEach((el, i) => {
      el.classList.add('will-reveal')
      el.style.transitionDelay = `${Math.min(i * 45, 270)}ms`
      io.observe(el)
    })
    return () => io.disconnect()
  }, [pathname])

  return null
}

export default function App() {
  return (
    <div className="app">
      <RouteEffects />
      <ParallaxDriver />
      {/* drawing-sheet frame: the faint bordered/ticked edge of an engineering
          drawing, fixed around the whole viewport */}
      <div className="sheet-frame" aria-hidden />
      {/* night-flight atmosphere: cloud layers drifting at different speeds
          behind the content, and a tiny aircraft that draws a contrail across
          the sky every minute or two */}
      <div className="atmosphere" aria-hidden>
        {/* far → near parallax strata: contour glyphs, clouds, specks */}
        <div className="bp-glyphs">
          <span className="bp-glyph g1">✈</span>
          <span className="bp-glyph g2">✈</span>
          <span className="bp-glyph g3">✈</span>
        </div>
        <div className="clouds clouds-a" />
        <div className="clouds clouds-b" />
        <div className="specks" />
        <div className="contrail"><span className="contrail-plane">✈</span></div>
      </div>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">✈</span> ADA / Aircraft Design Archive
        </Link>
        <nav className="topnav">
          <Link to="/">Index</Link>
          <Link to="/live">Live</Link>
          <Link to="/fly">Fly</Link>
          <Link to="/routes">Routes</Link>
          <Link to="/simulate">Simulate</Link>
          <Link to="/compare">Compare</Link>
          <Link to="/systems">Systems</Link>
          <Link to="/components">Components</Link>
          <Link to="/projector">Projector</Link>
        </nav>
      </header>
      <main className="content">
        <AnimatedOutlet />
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
