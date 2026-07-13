/**
 * Cloudflare Worker: CORS proxy + cache in front of the OpenSky Network API.
 *
 * The site is a static GitHub Pages app, and OpenSky (like most flight APIs)
 * doesn't send an Access-Control-Allow-Origin header, so a browser can't call it
 * directly. This Worker fetches the data server-side (no CORS there), caches it
 * briefly to respect OpenSky's anonymous rate limits, and re-serves it with an
 * open CORS header so the browser is happy.
 *
 * Endpoints:
 *   GET /            -> OpenSky /states/all (whole planet)
 *   GET /?bbox=la_min,lo_min,la_max,lo_max  -> bounded query (smaller payload)
 *
 * Optional auth: set OPENSKY_USER + OPENSKY_PASS as Worker secrets to use an
 * OpenSky account (higher rate limits). Anonymous works without them.
 */

const OPENSKY = 'https://opensky-network.org/api/states/all'
const CACHE_SECONDS = 10 // OpenSky anonymous data resolution is ~10s anyway

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)
    const bbox = url.searchParams.get('bbox')
    let target = OPENSKY
    if (bbox) {
      const [laMin, loMin, laMax, loMax] = bbox.split(',')
      target = `${OPENSKY}?lamin=${laMin}&lomin=${loMin}&lamax=${laMax}&lomax=${loMax}`
    }

    // Edge cache keyed by the upstream URL so repeated hits within the window
    // don't re-poll OpenSky (and don't burn its rate limit).
    const cache = caches.default
    const cacheKey = new Request(target, { method: 'GET' })
    let hit = await cache.match(cacheKey)
    if (hit) {
      return withCors(hit)
    }

    const headers = {}
    if (env.OPENSKY_USER && env.OPENSKY_PASS) {
      const basic = btoa(`${env.OPENSKY_USER}:${env.OPENSKY_PASS}`)
      headers['Authorization'] = `Basic ${basic}`
    }

    let upstream
    try {
      upstream = await fetch(target, { headers, cf: { cacheTtl: CACHE_SECONDS } })
    } catch (e) {
      return json({ error: 'upstream fetch failed', detail: String(e) }, 502)
    }

    if (!upstream.ok) {
      return json({ error: 'opensky error', status: upstream.status }, upstream.status)
    }

    const body = await upstream.text()
    const res = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
        ...CORS,
      },
    })
    // store a cacheable copy at the edge
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
