import { Link } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'

export default function Home() {
  return (
    <div>
      <section className="hero">
        <h1>The Aircraft Design Archive</h1>
        <p>
          A detailed, data-driven journey through aircraft families — every
          variant built over time, from the engine up to the full airframe, with
          interactive 3D models, technical blueprints, production timelines and
          attributed safety records.
        </p>
      </section>

      <h2 className="section-title">Families</h2>
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
            </Link>
          )
        })}
      </div>
    </div>
  )
}
