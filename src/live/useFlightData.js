import { useEffect, useRef, useState } from 'react'

// The live feed is airplanes.live ADS-B data, reached through a small
// CORS-adding proxy (a Cloudflare Worker — see /worker) that sweeps the
// world's busy airspace, merges the tiles and re-serves OpenSky-shaped states
// with CORS. Configure the proxy URL via env:
//   VITE_FLIGHT_API=https://your-worker.workers.dev
const PROXY = import.meta.env.VITE_FLIGHT_API || ''

// states rows are OpenSky /states/all index-compatible; 17-19 are proxy
// extensions (registration, ICAO type, Mach) from airplanes.live.
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
    reg: s[17] || '',
    type: s[18] || '',
    mach: s[19] ?? null,
  }
}

const TRACK_MAX_PTS = 16     // ~4 minutes of history per aircraft at 15 s polls
const TRACK_STALE_S = 180    // drop tracks for aircraft not seen in 3 minutes

/**
 * Poll the flight proxy for live aircraft.
 * Returns { flights, tracks, time, status, error, count, configured }.
 *   status: 'unconfigured' | 'loading' | 'live' | 'error'
 *   tracks: Map<icao24, [lat, lon, altM][]> — position history accumulated
 *   across polls this session, for drawing flight paths.
 */
export function useFlightData({ intervalMs = 15000 } = {}) {
  const [flights, setFlights] = useState([])
  const [time, setTime] = useState(null)
  const [status, setStatus] = useState(PROXY ? 'loading' : 'unconfigured')
  const [error, setError] = useState(null)
  const timer = useRef(null)
  const backoff = useRef(intervalMs)
  const tracks = useRef(new Map())
  const trackSeen = useRef(new Map())

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
        // extend each aircraft's track with its new position
        const now = data.time || Date.now() / 1000
        for (const f of list) {
          let pts = tracks.current.get(f.id)
          if (!pts) tracks.current.set(f.id, (pts = []))
          const prev = pts[pts.length - 1]
          if (!prev || prev[0] !== f.lat || prev[1] !== f.lon) {
            pts.push([f.lat, f.lon, f.baroAlt || 0])
            if (pts.length > TRACK_MAX_PTS) pts.shift()
          }
          trackSeen.current.set(f.id, now)
        }
        for (const [id, seen] of trackSeen.current) {
          if (now - seen > TRACK_STALE_S) {
            trackSeen.current.delete(id)
            tracks.current.delete(id)
          }
        }
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

  return { flights, tracks: tracks.current, time, status, error, count: flights.length, configured: !!PROXY }
}
