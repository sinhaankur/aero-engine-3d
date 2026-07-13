import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFlightData } from '../live/useFlightData.js'

// The globe pulls in three.js; lazy-load it so it stays off the initial bundle.
const FlightGlobe = lazy(() => import('../live/FlightGlobe.jsx'))

const STATUS_LABEL = {
  unconfigured: 'PROXY NOT SET',
  loading: 'CONNECTING',
  live: 'LIVE',
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
  const { flights, time, status, count, configured } = useFlightData({ intervalMs: 15000 })
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
        Every dot is a real aircraft, right now, from the OpenSky Network's live
        ADS-B feed — plotted on the globe at its true position and altitude.
        Colour runs from amber on the ground through green and cyan to white at
        cruise. Drag to orbit, scroll to zoom, click a target to read its telemetry.
      </p>

      {!configured && (
        <div className="live-setup">
          <b>Live feed not configured.</b> OpenSky can't be called directly from a
          browser (no CORS), so this page reads through a small proxy. Deploy the
          one-file Cloudflare Worker in <code>/worker</code> and set{' '}
          <code>VITE_FLIGHT_API</code> to its URL — see <code>worker/README.md</code>.
          The globe is shown below; it fills with traffic once the proxy is set.
        </div>
      )}

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
          <span className="live-attrib">Data · OpenSky Network · ADS-B · via CORS proxy · refreshed every 15s</span>
        </div>
        <DetailPanel flight={selected} onClose={() => setSelected(null)} />
      </div>

      <p className="model-note">
        OpenSky coverage is best over Europe and North America and thinner over
        open ocean. The proxy caches for ~10s and the page holds the last good
        snapshot if a refresh fails, so the globe stays populated.
      </p>
    </div>
  )
}
