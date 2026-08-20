import { Link, useParams } from 'react-router-dom'
import { m, useReducedMotion } from 'framer-motion'
import { getFamily, getAircraftForFamily } from '../data/index.js'
import { RISK_LEVELS } from '../data/schema.js'
import { container, item, itemReduced } from '../lib/motion.jsx'

const MLink = m(Link)

export default function FamilyPage() {
  const { familyId } = useParams()
  const reduce = useReducedMotion()
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
      <m.div
        className="journey"
        variants={container(0.07)}
        initial="hidden"
        animate="show"
      >
        {ordered.map((a) => {
          const risk = RISK_LEVELS[a.safety.risk]
          return (
            <MLink
              key={a.id}
              to={`/family/${familyId}/${a.id}`}
              className="journey-row"
              variants={reduce ? itemReduced : item}
              whileHover={reduce ? undefined : { x: 6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            >
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
            </MLink>
          )
        })}
      </m.div>
    </div>
  )
}
