import { useEffect, useRef, useState } from 'react'

// The live feed is OpenSky, reached through a small CORS-adding proxy (a
// Cloudflare Worker — see /worker). OpenSky itself sends no CORS header, so a
// browser on the static site can't call it directly; the Worker fetches it
// server-side and re-serves with CORS. Configure the proxy URL via env:
//   VITE_FLIGHT_API=https://your-worker.workers.dev
const PROXY = import.meta.env.VITE_FLIGHT_API || ''

// OpenSky /states/all returns a flat array per aircraft; these are the indices
// we use (see OpenSky docs). Mapping once here keeps the rest typed.
function mapState(s) {
  const lon = s[5]
  const lat = s[6]
  if (lon == null || lat == null) return null
  return {
    id: s[0],                        // icao24
    callsign: (s[1] || '').trim(),
    country: s[2],
    lat,
    lon,
    baroAlt: s[7],                   // barometric altitude (m)
    onGround: !!s[8],
    velocity: s[9],                  // m/s
    heading: s[10] ?? 0,             // true track, deg
    vertRate: s[11],                 // m/s
    geoAlt: s[13],                   // geometric altitude (m)
    reg: '',
    type: '',
    mach: null,
  }
}

/**
 * Poll the flight proxy for live aircraft.
 * Returns { flights, time, status, error, count, configured }.
 *   status: 'unconfigured' | 'loading' | 'live' | 'error'
 */
export function useFlightData({ intervalMs = 15000 } = {}) {
  const [flights, setFlights] = useState([])
  const [time, setTime] = useState(null)
  const [status, setStatus] = useState(PROXY ? 'loading' : 'unconfigured')
  const [error, setError] = useState(null)
  const timer = useRef(null)
  const backoff = useRef(intervalMs)

  useEffect(() => {
    if (!PROXY) {
      setStatus('unconfigured')
      return
    }
    let cancelled = false

    async function tick() {
      try {
        const ctrl = new AbortController()
        const to = setTimeout(() => ctrl.abort(), 15000)
        const res = await fetch(PROXY, { signal: ctrl.signal }).finally(() => clearTimeout(to))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        const list = (data.states || []).map(mapState).filter(Boolean)
        setFlights(list)
        setTime(data.time ? new Date(data.time * 1000) : new Date())
        setStatus('live')
        setError(null)
        backoff.current = intervalMs
        schedule()
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setError(e.message || 'fetch failed')
        // keep the last snapshot on screen; back off and retry
        backoff.current = Math.min(backoff.current * 1.6, 60000)
        schedule()
      }
    }

    function schedule() {
      clearTimeout(timer.current)
      timer.current = setTimeout(tick, backoff.current)
    }

    tick()
    return () => {
      cancelled = true
      clearTimeout(timer.current)
    }
  }, [intervalMs])

  return { flights, time, status, error, count: flights.length, configured: !!PROXY }
}
