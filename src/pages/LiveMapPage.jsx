import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFlightData } from '../live/useFlightData.js'

// The globe pulls in three.js; lazy-load it so it stays off the initial bundle.
const FlightGlobe = lazy(() => import('../live/FlightGlobe.jsx'))

const STATUS_LABEL = {
  loading: 'CONNECTING',
  live: 'LIVE',
  partial: 'LIVE · PARTIAL',
  error: 'RETRYING',
}

function fmtAlt(m) {
  if (m == null) return '—'
  return `${Math.round(m).toLocaleString()} m · FL${String(Math.round(m * 3.28084 / 100)).padStart(3, '0')}`
}
function fmtSpeed(ms) {
  if (ms == null) return '—'
  return `${Math.round(ms)} m/s · ${Math.round(ms * 1.94384)} kt`
}

function DetailPanel({ flight, onClose }) {
  if (!flight) {
    return (
      <div className="live-detail is-empty">
        <p>Click any aircraft on the globe to inspect its live telemetry, or drag to orbit the Earth.</p>
      </div>
    )
  }
  const rows = [
    ['Callsign', flight.callsign || '—'],
    ['Registration', flight.reg || '—'],
    ['Type', flight.type || '—'],
    ['ICAO24', flight.id],
    ['Position', `${flight.lat.toFixed(3)}, ${flight.lon.toFixed(3)}`],
    ['Baro alt', fmtAlt(flight.baroAlt)],
    ['Geo alt', fmtAlt(flight.geoAlt)],
    ['Ground speed', fmtSpeed(flight.velocity)],
    ['Mach', flight.mach != null ? flight.mach.toFixed(3) : '—'],
    ['Heading', `${Math.round(flight.heading)}°`],
    ['Vertical rate', flight.vertRate != null ? `${flight.vertRate.toFixed(1)} m/s` : '—'],
    ['State', flight.onGround ? 'On ground' : 'Airborne'],
  ]
  return (
    <div className="live-detail">
      <div className="live-detail-head">
        <h3>{flight.callsign || flight.id}</h3>
        <button className="live-close" onClick={onClose} aria-label="Deselect">✕</button>
      </div>
      <dl className="live-rows">
        {rows.map(([k, v]) => (
          <div key={k} className="live-row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  )
}

export default function LiveMapPage() {
  const { flights, time, status, count } = useFlightData({ intervalMs: 20000 })
  const [selected, setSelected] = useState(null)

  return (
    <div>
      <Link to="/" className="back">← Home</Link>
      <div className="ac-head">
        <h1>Live traffic</h1>
        <span className={`status live-status live-status-${status}`}>
          <span className="dot" />{STATUS_LABEL[status] || status}
        </span>
      </div>
      <p className="lede">
        Every dot is a real aircraft, right now, from the adsb.lol community
        ADS-B feed — plotted on the globe at its true position and altitude.
        Colour runs from amber on the ground through green and cyan to white at
        cruise. Drag to orbit, scroll to zoom, click a target to read its telemetry.
      </p>

      {/* live counters */}
      <div className="count-strip live-counts">
        <div className="count-cell"><span className="n">{count.toLocaleString()}</span><span className="l">Aircraft tracked</span></div>
        <div className="count-cell"><span className="n">{flights.filter((f) => !f.onGround).length.toLocaleString()}</span><span className="l">Airborne</span></div>
        <div className="count-cell"><span className="n">{flights.filter((f) => f.onGround).length.toLocaleString()}</span><span className="l">On ground</span></div>
        <div className="count-cell"><span className="n">{time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span><span className="l">Snapshot (local)</span></div>
      </div>

      <div className="live-body">
        <div className="live-globe">
          <Suspense fallback={<div className="viewport-loading" style={{ height: 560 }}>Loading globe…</div>}>
            <FlightGlobe flights={flights} selected={selected} onSelect={setSelected} height={560} />
          </Suspense>
          <span className="live-attrib">Data · adsb.lol · ADS-B · refreshed every 20s</span>
        </div>
        <DetailPanel flight={selected} onClose={() => setSelected(null)} />
      </div>

      <p className="model-note">
        Coverage is pooled from regional ADS-B sweeps, so density is highest over
        Europe, North America and East Asia and thinner over open ocean. If a
        region's request fails the globe holds the last snapshot and retries.
      </p>
    </div>
  )
}
