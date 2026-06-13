import { Link, useParams } from 'react-router-dom'
import { getFamily, getAircraftForFamily } from '../data/index.js'
import { RISK_LEVELS } from '../data/schema.js'

export default function FamilyPage() {
  const { familyId } = useParams()
  const family = getFamily(familyId)
  const aircraft = getAircraftForFamily(familyId)

  if (!family) return <p>Family not found. <Link to="/">Back</Link></p>

  if (family.stub || aircraft.length === 0) {
    return (
      <div>
        <Link to="/" className="back">← All families</Link>
        <h1>{family.name}</h1>
        <p className="lede">{family.tagline}</p>
        <div className="empty">
          This family is on the roadmap. The {family.name} hasn't been built out
          yet — the A320 family is the reference implementation to copy.
        </div>
      </div>
    )
  }

  // Sort by first flight to tell the chronological "family journey".
  const ordered = [...aircraft].sort((a, b) => a.firstFlightYear - b.firstFlightYear)

  return (
    <div>
      <Link to="/" className="back">← All families</Link>
      <h1>{family.name}</h1>
      <p className="lede">{family.tagline}</p>
      <p className="intro">{family.intro}</p>

      <h2 className="section-title">Family journey</h2>
      <div className="journey">
        {ordered.map((a) => {
          const risk = RISK_LEVELS[a.safety.risk]
          return (
            <Link key={a.id} to={`/family/${familyId}/${a.id}`} className="journey-row">
              <div className="journey-year">{a.firstFlightYear}</div>
              <div className="journey-dot" />
              <div className="journey-body">
                <div className="journey-head">
                  <h3>{a.name}</h3>
                  <span className={`status status-${a.status}`}>{a.status.replace('-', ' ')}</span>
                </div>
                <p>{a.summary}</p>
                <div className="journey-meta">
                  <span>{a.dimensions.lengthM.toFixed(1)} m · {a.dimensions.paxTypical} seats</span>
                  <span>{a.built ? `~${a.built.toLocaleString()} built` : 'low volume'}</span>
                  <span className="risk-pill" style={{ '--risk': risk.color }}>
                    Safety: {risk.label}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
