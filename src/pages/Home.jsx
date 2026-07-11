import { Link } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'
import { ENGINES } from '../data/engines.js'
import HeroPlane from '../three/HeroPlane.jsx'

// Live counts so the marketing numbers can never drift from the actual archive.
function useArchiveStats() {
  const families = FAMILIES.length
  const aircraft = FAMILIES.reduce((n, f) => n + getAircraftForFamily(f.id).length, 0)
  const engines = Object.keys(ENGINES).length
  return { families, aircraft, engines }
}

function Feature({ icon, title, children }) {
  return (
    <div className="feature">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

export default function Home() {
  const stats = useArchiveStats()

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* HERO — animated airframe backdrop with headline + CTAs overlaid   */}
      {/* ---------------------------------------------------------------- */}
      <section className="hero-stage">
        <div className="hero-stage-bg">
          <HeroPlane url="/models/a320.glb" height={520} />
        </div>
        <div className="hero-stage-copy">
          <span className="eyebrow">Interactive aircraft encyclopedia</span>
          <h1>
            See how airliners are<br />designed — inside and out.
          </h1>
          <p>
            Explore every Airbus family from the engine up to the full airframe:
            interactive 3D models, technical blueprints, production timelines and
            attributed safety records — all in one place.
          </p>
          <div className="hero-cta">
            <a href="#families" className="btn btn-primary">Explore aircraft →</a>
            <Link to="/systems" className="btn btn-ghost">How systems work</Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* STATS BAR                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="stats-bar">
        <div className="stat">
          <span className="stat-num">{stats.families}</span>
          <span className="stat-label">Aircraft families</span>
        </div>
        <div className="stat">
          <span className="stat-num">{stats.aircraft}</span>
          <span className="stat-label">Variants in 3D</span>
        </div>
        <div className="stat">
          <span className="stat-num">{stats.engines}</span>
          <span className="stat-label">Engine types</span>
        </div>
        <div className="stat">
          <span className="stat-num">6</span>
          <span className="stat-label">Systems explained</span>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FEATURES — what you get                                           */}
      {/* ---------------------------------------------------------------- */}
      <section className="features">
        <Feature icon="🛩" title="Interactive 3D models">
          Rotate every variant in real time — authored airframes at a consistent,
          true-to-scale standard, from the A220 to the double-deck A380.
        </Feature>
        <Feature icon="📐" title="Engineering blueprints">
          A live general-arrangement drawing for each type, generated from its real
          dimensions with dimensioned views and a numbered component key.
        </Feature>
        <Feature icon="⚙️" title="Engines, exploded">
          Break a turbofan into its parts and watch the working cycle stage by
          stage — intake, compression, combustion, exhaust.
        </Feature>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* SYSTEMS BANNER                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Link to="/systems" className="systems-banner">
        <div>
          <span className="badge badge-live">New</span>
          <h3>How aircraft systems work</h3>
          <p>
            Electrical, hydraulics, fly-by-wire, fuel, bleed air and landing gear —
            interactive schematics that show how each system works internally and
            how it stays safe through redundancy.
          </p>
        </div>
        <span className="systems-banner-cta">Explore systems →</span>
      </Link>

      {/* ---------------------------------------------------------------- */}
      {/* FAMILIES                                                          */}
      {/* ---------------------------------------------------------------- */}
      <h2 className="section-title" id="families">Browse the families</h2>
      <div className="family-grid">
        {FAMILIES.map((f) => {
          const count = getAircraftForFamily(f.id).length
          return (
            <Link
              key={f.id}
              to={`/family/${f.id}`}
              className={`family-card ${f.stub ? 'is-stub' : ''}`}
            >
              <div className="family-card-head">
                <span className="maker">{f.manufacturer}</span>
                {f.stub ? (
                  <span className="badge badge-soon">Coming soon</span>
                ) : (
                  <span className="badge badge-live">{count} variants</span>
                )}
              </div>
              <h3>{f.name}</h3>
              <p>{f.tagline}</p>
              <span className="family-card-cta">View family →</span>
            </Link>
          )
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* HOW IT WORKS — three simple steps                                 */}
      {/* ---------------------------------------------------------------- */}
      <h2 className="section-title">How it works</h2>
      <div className="steps">
        <Step n="1" title="Pick a family">
          Start with any Airbus family and walk its variants in chronological
          order — the "family journey" that shows how each type grew from the last.
        </Step>
        <Step n="2" title="Open a variant">
          Rotate the 3D model, flip to the blueprint, and read its real dimensions,
          engine options, timeline and attributed safety record.
        </Step>
        <Step n="3" title="Go deeper">
          Explode the engine to see how a turbofan works, or jump to Systems to
          learn how hydraulics, fly-by-wire and fuel keep the aircraft flying.
        </Step>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* WHY IT MATTERS — value points                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="why">
        <div className="why-copy">
          <h2>Real numbers. Honest sources.</h2>
          <p>
            Every figure — dimensions, thrust, range, safety — is a nominal public
            specification, and each aircraft's safety record is attributed to the
            public database it came from. No marketing gloss on the data itself.
          </p>
        </div>
        <ul className="why-list">
          <li><strong>True-to-scale models</strong> generated from each type's real dimensions.</li>
          <li><strong>Dimensioned blueprints</strong> that redraw themselves from the same numbers.</li>
          <li><strong>Attributed safety figures</strong> sourced from public aviation-safety records.</li>
          <li><strong>Consistent across the family</strong> — the A220 to the double-deck A380.</li>
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CLOSING CTA                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="cta-band">
        <h2>Start exploring</h2>
        <p>Six families, {stats.aircraft} variants, in 3D — pick one and dive in.</p>
        <div className="hero-cta">
          <a href="#families" className="btn btn-primary">Browse aircraft →</a>
          <Link to="/systems" className="btn btn-ghost">How systems work</Link>
        </div>
      </section>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="step">
      <span className="step-num">{n}</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}
