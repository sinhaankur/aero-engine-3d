import { useEffect, useRef, useState } from 'react'

// adsb.lol — community ADS-B aggregator. Unlike OpenSky it sends CORS headers,
// so it can be called straight from the browser on a static site (no proxy, no
// key). Coverage is query-by-radius (up to ~1000 nm), so we sweep a set of
// regional centres over the busiest airspace and merge the results by hex id.
const BASE = 'https://api.adsb.lol/v2'

// Sweep centres (lat, lon) roughly covering the world's dense traffic regions.
// 1000 nm radius each, so these overlap enough to avoid big gaps over land.
const SWEEP = [
  [50, 8],     // Europe
  [40, -95],   // North America (central)
  [37, -120],  // US West
  [45, -70],   // US Northeast / Canada
  [30, 50],    // Middle East / Gulf
  [22, 78],    // India
  [34, 110],   // East China
  [37, 138],   // Japan / Korea
  [1, 104],    // SE Asia
  [-28, 140],  // Australia
  [-15, -50],  // South America
  [5, 10],     // West Africa
]

// adsb.lol altitudes are in feet; convert to metres to match a single internal
// unit (the globe + panel work in metres and derive FL/kt from there).
const FT_TO_M = 0.3048
const KT_TO_MS = 0.514444

function mapAircraft(a) {
  const lat = a.lat
  const lon = a.lon
  if (lat == null || lon == null) return null
  const altBaro = typeof a.alt_baro === 'number' ? a.alt_baro * FT_TO_M : null
  const altGeom = typeof a.alt_geom === 'number' ? a.alt_geom * FT_TO_M : null
  const onGround = a.alt_baro === 'ground'
  return {
    id: a.hex,
    callsign: (a.flight || '').trim(),
    reg: a.r || '',                 // registration
    type: a.t || '',                // ICAO type code, e.g. A320
    lat,
    lon,
    baroAlt: onGround ? 0 : altBaro,
    geoAlt: altGeom,
    onGround,
    velocity: typeof a.gs === 'number' ? a.gs * KT_TO_MS : null, // gs is knots
    heading: a.track ?? a.true_heading ?? 0,
    vertRate: typeof a.baro_rate === 'number' ? (a.baro_rate * FT_TO_M) / 60 : null,
    mach: typeof a.mach === 'number' ? a.mach : null,
  }
}

/**
 * Poll adsb.lol across the sweep centres, merge by hex, and expose live state.
 * Returns { flights, time, status, error, count }.
 *   status: 'loading' | 'live' | 'partial' | 'error'
 */
// One region request with a hard timeout so a slow/throttled endpoint can't
// hang the whole sweep. adsb.lol throttles bursts, so we keep concurrency low.
async function fetchPoint([lat, lon], signal) {
  const res = await fetch(`${BASE}/lat/${lat}/lon/${lon}/dist/1000`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.ac || []
}

// Run tasks with a small concurrency limit rather than all at once — friendlier
// to the free endpoint and far less likely to get the client rate-limited.
async function pooled(items, worker, limit = 3) {
  const out = new Array(items.length)
  let i = 0
  async function run() {
    while (i < items.length) {
      const idx = i++
      try { out[idx] = { ok: true, value: await worker(items[idx]) } }
      catch (e) { out[idx] = { ok: false, error: e } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return out
}

export function useFlightData({ intervalMs = 20000 } = {}) {
  const [flights, setFlights] = useState([])
  const [time, setTime] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      const results = await pooled(
        SWEEP,
        (pt) => {
          const ctrl = new AbortController()
          const to = setTimeout(() => ctrl.abort(), 12000) // per-request timeout
          return fetchPoint(pt, ctrl.signal).finally(() => clearTimeout(to))
        },
        3,
      )
      if (cancelled) return

      const byId = new Map()
      let ok = 0
      for (const r of results) {
        if (!r || !r.ok) continue
        ok += 1
        for (const raw of r.value) {
          const f = mapAircraft(raw)
          if (f && !byId.has(f.id)) byId.set(f.id, f)
        }
      }

      // Only replace the snapshot if we actually got aircraft; otherwise keep the
      // last good one so a throttled poll doesn't blank the globe.
      if (ok === 0) {
        setStatus('error')
        setError('all regions failed')
      } else {
        setFlights([...byId.values()])
        setTime(new Date())
        setStatus(ok === SWEEP.length ? 'live' : 'partial')
        setError(null)
      }
      schedule()
    }

    function schedule() {
      clearTimeout(timer.current)
      timer.current = setTimeout(tick, intervalMs)
    }

    tick()
    return () => {
      cancelled = true
      clearTimeout(timer.current)
    }
  }, [intervalMs])

  return { flights, time, status, error, count: flights.length }
}
