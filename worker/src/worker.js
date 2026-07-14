/**
 * Cloudflare Worker: CORS proxy + cache in front of live ADS-B flight data.
 *
 * The site is a static GitHub Pages app and flight APIs don't send CORS
 * headers, so a browser can't call them directly. This Worker fetches the data
 * server-side, caches it briefly, and re-serves it with an open CORS header.
 *
 * Upstream is airplanes.live. OpenSky (the original upstream) hard-blocks
 * requests from Cloudflare's egress IPs (522 at their edge, verified via an
 * in-worker probe), and adsb.lol rate-limits them (429); airplanes.live
 * answers normally. It only serves regional queries (max 250 nm radius), so
 * the Worker fans out over a fixed set of tiles covering the world's busy
 * airspace, merges + dedupes, and returns OpenSky-shaped data:
 *
 *   { time, states: [[icao24, callsign, country, null, null, lon, lat,
 *      baroAltM, onGround, velocityMs, track, vertRateMs, null, geoAltM,
 *      squawk, false, 0, reg, type, mach], ...] }
 *
 * Indices 0-16 match OpenSky /states/all so existing clients keep working;
 * 17-19 are extensions (registration, ICAO type, Mach) airplanes.live gives
 * us for free.
 */

const UPSTREAM = 'https://api.airplanes.live/v2/point'
const RADIUS_NM = 250
const CACHE_SECONDS = 15

// Tile centres [lat, lon] — each covers a 250 nm-radius circle (~930 km wide).
// Chosen to blanket the dense corridors: Europe, North America, East/South
// Asia, Middle East, plus the biggest southern-hemisphere hubs.
const TILES = [
  // Europe
  [51, -1], [48, 8], [41, 3], [52, 20], [59, 16], [41, 28],
  // North America
  [42, -74], [34, -84], [42, -88], [33, -97], [34, -118], [39, -122], [47, -122], [26, -80], [40, -105],
  // Asia
  [36, 140], [37, 127], [31, 121], [40, 116], [23, 113], [14, 101], [1, 104], [28, 77], [19, 73],
  // Middle East
  [25, 55],
  // South America
  [-23, -46], [-34, -59], [5, -74],
  // Africa & Oceania
  [-26, 28], [30, 31], [-36, 148],
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const FT = 0.3048            // ft -> m
const KT = 0.514444          // kn -> m/s
const FPM = 0.00508          // ft/min -> m/s

function mapAircraft(a) {
  if (a.lat == null || a.lon == null) return null
  const onGround = a.alt_baro === 'ground'
  const baroAlt = typeof a.alt_baro === 'number' ? a.alt_baro * FT : null
  return [
    a.hex,                                            // 0 icao24
    (a.flight || '').trim(),                          // 1 callsign
    '',                                               // 2 origin country (n/a)
    null, null,                                       // 3,4 time_position, last_contact
    a.lon, a.lat,                                     // 5,6
    baroAlt,                                          // 7 baro altitude [m]
    onGround,                                         // 8
    a.gs != null ? a.gs * KT : null,                  // 9 velocity [m/s]
    a.track ?? a.true_heading ?? 0,                   // 10 track [deg]
    a.baro_rate != null ? a.baro_rate * FPM : null,   // 11 vertical rate [m/s]
    null,                                             // 12 sensors
    typeof a.alt_geom === 'number' ? a.alt_geom * FT : null, // 13 geo altitude [m]
    a.squawk || null,                                 // 14
    false, 0,                                         // 15,16 spi, position_source
    a.r || '',                                        // 17 registration (ext)
    a.t || '',                                        // 18 ICAO type (ext)
    a.mach ?? null,                                   // 19 Mach (ext)
  ]
}

async function fetchTile([lat, lon]) {
  const r = await fetch(`${UPSTREAM}/${lat}/${lon}/${RADIUS_NM}`, {
    headers: { 'User-Agent': 'AirbusEngine3D-live/1.0 (educational)', 'Accept': 'application/json' },
  })
  if (!r.ok) throw new Error(`tile ${lat},${lon}: HTTP ${r.status}`)
  const data = await r.json()
  return data.ac || []
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    // Edge cache so any number of visitors costs one upstream sweep per window.
    const cache = caches.default
    const cacheKey = new Request('https://flight-proxy.internal/global', { method: 'GET' })
    const hit = await cache.match(cacheKey)
    if (hit) return withCors(hit)

    // Fetch tiles in small batches to stay polite to airplanes.live.
    const byHex = new Map()
    const errors = []
    const BATCH = 6
    for (let i = 0; i < TILES.length; i += BATCH) {
      const results = await Promise.allSettled(TILES.slice(i, i + BATCH).map(fetchTile))
      for (const res of results) {
        if (res.status === 'rejected') { errors.push(String(res.reason)); continue }
        for (const a of res.value) if (a.hex && !byHex.has(a.hex)) byHex.set(a.hex, a)
      }
    }

    if (byHex.size === 0) {
      return json({ error: 'all upstream tiles failed', detail: errors.slice(0, 3) }, 502)
    }

    const states = []
    for (const a of byHex.values()) {
      const s = mapAircraft(a)
      if (s) states.push(s)
    }

    const res = json({ time: Math.floor(Date.now() / 1000), states })
    res.headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
    ctx.waitUntil(cache.put(cacheKey, res.clone()))
    return res
  },
}

function withCors(res) {
  const r = new Response(res.body, res)
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v)
  return r
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
