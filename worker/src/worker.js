/**
 * Cloudflare Worker: full-globe live ADS-B snapshot with CORS.
 *
 * The site is a static GitHub Pages app and flight APIs don't send CORS
 * headers, so a browser can't call them directly. This Worker keeps a merged
 * GLOBAL aircraft snapshot in KV and re-serves it OpenSky-shaped with CORS.
 *
 * Why an incremental sweep: upstream is airplanes.live, which only answers
 * regional queries (250 nm radius max) and rate-limits bursts HARD — fanning
 * the whole ~467-tile global grid out at once gets ~70% of tiles rejected and
 * actually returns FEWER planes. So a cron sweeps the NEXT few tiles each run,
 * merging fresh aircraft into a persistent KV map (with per-aircraft last-seen
 * timestamps) and ageing out stale ones. Over a couple of minutes the whole
 * grid is covered; user requests just read the merged snapshot from KV — no
 * upstream calls on the hot path, so the map is instant and the sweep stays
 * polite. Positions can lag up to one full sweep (~2-3 min), the trade for
 * whole-planet coverage without tripping the limit.
 *
 * Snapshot shape (OpenSky /states/all compatible; 17-19 are extensions):
 *   { time, states: [[icao24, callsign, country, null, null, lon, lat,
 *      baroAltM, onGround, velocityMs, track, vertRateMs, null, geoAltM,
 *      squawk, false, 0, reg, type, mach], ...] }
 */

const UPSTREAM = 'https://api.airplanes.live/v2/point'
const RADIUS_NM = 250

// Pacing: airplanes.live rate-limits bursts, so every cron run refreshes the
// HOT tiles (the busy corridors — where most traffic is, kept low-lag) and
// advances a slice of the remaining COLD tiles (oceans / remote regions) that
// rotate through slowly in the background. Small batches + pauses keep us under
// the limit. A full cold rotation takes several minutes, so the TTL is long
// enough that a plane survives until its tile is swept again.
const COLD_PER_RUN = 34      // cold tiles advanced per cron invocation
const BATCH = 3              // concurrent upstream calls per batch
const BATCH_PAUSE_MS = 700   // pause between batches (politeness)
const AIRCRAFT_TTL_S = 1200  // 20 min — must exceed the full cold-sweep period

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const FT = 0.3048, KT = 0.514444, FPM = 0.00508

// 467 tiles blanketing every populated landmass + the major oceanic routes.
// cos(lat)-spaced so the 250 nm circles keep pace as longitude lines converge.
const TILES = [
  [-55,-77],[-55,-64],[-55,-51],[-55,-39],[-48,-79],[-48,-68],[-48,-56],[-48,-45],[-48,-34],[-48,112],
  [-48,124],[-48,135],[-48,146],[-48,158],[-48,169],[-40,-73],[-40,-63],[-40,-54],[-40,-44],[-40,-34],
  [-40,112],[-40,122],[-40,131],[-40,141],[-40,151],[-40,161],[-40,170],[-32,-81],[-32,-72],[-32,-63],
  [-32,-54],[-32,-45],[-32,-36],[-32,-18],[-32,-9],[-32,0],[-32,9],[-32,18],[-32,27],[-32,36],[-32,45],
  [-32,117],[-32,126],[-32,135],[-32,144],[-32,153],[-32,162],[-32,171],[-25,-82],[-25,-74],[-25,-65],
  [-25,-57],[-25,-49],[-25,-41],[-25,-16],[-25,-8],[-25,0],[-25,8],[-25,16],[-25,25],[-25,33],[-25,41],
  [-25,49],[-25,115],[-25,123],[-25,131],[-25,139],[-25,147],[-25,155],[-25,164],[-25,172],[-18,-78],
  [-18,-70],[-18,-63],[-18,-55],[-18,-47],[-18,-39],[-18,-16],[-18,-8],[-18,0],[-18,8],[-18,16],[-18,23],
  [-18,31],[-18,39],[-18,47],[-18,117],[-18,125],[-18,133],[-18,141],[-18,149],[-18,157],[-18,164],
  [-18,172],[-10,-80],[-10,-73],[-10,-65],[-10,-57],[-10,-50],[-10,-42],[-10,-34],[-10,-11],[-10,-4],
  [-10,4],[-10,11],[-10,19],[-10,27],[-10,34],[-10,42],[-10,50],[-10,57],[-10,65],[-10,73],[-10,80],
  [-10,88],[-10,96],[-10,119],[-10,126],[-10,134],[-10,142],[-10,149],[-10,157],[-10,165],[-10,172],
  [-2,-82],[-2,-75],[-2,-68],[-2,-60],[-2,-52],[-2,-45],[-2,-38],[-2,-15],[-2,-8],[-2,0],[-2,8],[-2,15],
  [-2,22],[-2,30],[-2,38],[-2,45],[-2,52],[-2,60],[-2,68],[-2,75],[-2,82],[-2,90],[-2,98],[5,-82],
  [5,-75],[5,-68],[5,-60],[5,-52],[5,-45],[5,-38],[5,-30],[5,-22],[5,-15],[5,-8],[5,0],[5,8],[5,15],
  [5,22],[5,30],[5,38],[5,45],[5,52],[5,60],[5,68],[5,75],[5,82],[5,90],[5,98],[5,105],[5,112],[5,120],
  [5,128],[5,135],[5,142],[5,150],[5,158],[5,165],[5,172],[12,-165],[12,-157],[12,-149],[12,-142],
  [12,-134],[12,-126],[12,-119],[12,-111],[12,-103],[12,-96],[12,-88],[12,-80],[12,-73],[12,-65],
  [12,-57],[12,-50],[12,-42],[12,-34],[12,-27],[12,-19],[12,-11],[12,-4],[12,4],[12,11],[12,19],[12,27],
  [12,34],[12,42],[12,50],[12,57],[12,65],[12,73],[12,80],[12,88],[12,96],[12,103],[12,111],[12,119],
  [12,126],[12,134],[12,142],[12,149],[12,157],[12,165],[12,172],[20,-164],[20,-156],[20,-148],[20,-140],
  [20,-132],[20,-124],[20,-116],[20,-108],[20,-100],[20,-92],[20,-84],[20,-76],[20,-68],[20,-60],
  [20,-52],[20,-36],[20,-28],[20,-20],[20,-12],[20,-4],[20,4],[20,12],[20,20],[20,28],[20,36],[20,44],
  [20,52],[20,60],[20,68],[20,76],[20,84],[20,92],[20,100],[20,108],[20,116],[20,124],[20,132],[20,140],
  [20,148],[20,156],[20,164],[20,172],[28,-163],[28,-155],[28,-147],[28,-138],[28,-130],[28,-121],
  [28,-113],[28,-105],[28,-96],[28,-88],[28,-80],[28,-71],[28,-63],[28,-54],[28,-38],[28,-29],[28,-21],
  [28,-13],[28,-4],[28,4],[28,13],[28,21],[28,29],[28,38],[28,46],[28,54],[28,63],[28,71],[28,80],
  [28,88],[28,96],[28,105],[28,113],[28,121],[28,130],[28,138],[28,147],[28,155],[28,163],[28,172],
  [35,-180],[35,-171],[35,-162],[35,-152],[35,-143],[35,-134],[35,-125],[35,-115],[35,-106],[35,-97],
  [35,-88],[35,-78],[35,-69],[35,-60],[35,-32],[35,-23],[35,-14],[35,-5],[35,5],[35,14],[35,23],[35,32],
  [35,42],[35,51],[35,60],[35,69],[35,78],[35,88],[35,97],[35,106],[35,115],[35,125],[35,134],[35,143],
  [35,152],[35,162],[35,171],[42,-180],[42,-170],[42,-159],[42,-149],[42,-139],[42,-129],[42,-118],
  [42,-108],[42,-98],[42,-87],[42,-77],[42,-67],[42,-57],[42,-46],[42,-36],[42,-26],[42,-15],[42,-5],
  [42,5],[42,15],[42,26],[42,36],[42,46],[42,57],[42,67],[42,77],[42,87],[42,98],[42,108],[42,118],
  [42,129],[42,139],[42,149],[42,159],[42,170],[50,-180],[50,-168],[50,-157],[50,-145],[50,-134],
  [50,-122],[50,-110],[50,-99],[50,-87],[50,-75],[50,-64],[50,-52],[50,-41],[50,-29],[50,-17],[50,-6],
  [50,6],[50,17],[50,29],[50,41],[50,52],[50,64],[50,75],[50,87],[50,99],[50,110],[50,122],[50,134],
  [50,145],[50,157],[50,168],[58,-166],[58,-152],[58,-138],[58,-125],[58,-111],[58,-97],[58,-83],
  [58,-69],[58,-55],[58,-42],[58,-28],[58,-14],[58,0],[58,14],[58,28],[58,42],[58,55],[58,69],[58,83],
  [58,97],[58,111],[58,125],[58,138],[58,152],[58,166],[65,-162],[65,-144],[65,-126],[65,-108],[65,-90],
  [65,-72],[65,-54],[65,0],[65,18],[65,36],[65,54],[65,72],[65,90],[65,108],[65,126],[65,144],[65,162],
  [72,-154],[72,-129],[72,-103],[72,-77],[72,0],[72,26],[72,51],[72,77],[72,103],[72,129],[72,154],
  [80,-135],[80,-90],
]

// HOT tiles: the busy corridors (Europe / N.America / Asia / ME / big S-hem
// hubs). Refreshed EVERY run so dense traffic stays low-lag; the 250 nm circles
// here hold the bulk of the world's flights.
const HOT = [
  [51,-1],[48,8],[41,3],[52,20],[59,16],[41,28],
  [42,-74],[34,-84],[42,-88],[33,-97],[34,-118],[39,-122],[47,-122],[26,-80],[40,-105],
  [36,140],[37,127],[31,121],[40,116],[23,113],[14,101],[1,104],[28,77],[19,73],
  [25,55],[-23,-46],[-34,-59],[5,-74],[-26,28],[30,31],[-36,148],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function mapAircraft(a) {
  if (a.lat == null || a.lon == null) return null
  const onGround = a.alt_baro === 'ground'
  const baroAlt = typeof a.alt_baro === 'number' ? a.alt_baro * FT : null
  return [
    a.hex,
    (a.flight || '').trim(),
    '',
    null, null,
    a.lon, a.lat,
    baroAlt,
    onGround,
    a.gs != null ? a.gs * KT : null,
    a.track ?? a.true_heading ?? 0,
    a.baro_rate != null ? a.baro_rate * FPM : null,
    null,
    typeof a.alt_geom === 'number' ? a.alt_geom * FT : null,
    a.squawk || null,
    false, 0,
    a.r || '',
    a.t || '',
    a.mach ?? null,
  ]
}

async function fetchTile([lat, lon]) {
  const r = await fetch(`${UPSTREAM}/${lat}/${lon}/${RADIUS_NM}`, {
    headers: { 'User-Agent': 'aero-engine-3d-live/2.0 (educational)', 'Accept': 'application/json' },
  })
  if (!r.ok) throw new Error(`tile ${lat},${lon}: HTTP ${r.status}`)
  const data = await r.json()
  return data.ac || []
}

// Fetch a list of tiles in small polite batches, merging any aircraft found
// into `map` with the current timestamp. Failures (rate-limit hiccups) are
// silently skipped — that tile just gets its data next rotation.
async function fetchInto(tiles, map, now) {
  for (let i = 0; i < tiles.length; i += BATCH) {
    const results = await Promise.allSettled(tiles.slice(i, i + BATCH).map(fetchTile))
    for (const res of results) {
      if (res.status !== 'fulfilled') continue
      for (const a of res.value) {
        if (!a.hex) continue
        const s = mapAircraft(a)
        if (s) map[a.hex] = { s, t: now }
      }
    }
    if (i + BATCH < tiles.length) await sleep(BATCH_PAUSE_MS)
  }
}

// One sweep step: refresh all HOT tiles (busy corridors, every run) plus the
// next COLD_PER_RUN slice of the global grid (rotating), and merge into KV.
async function sweepStep(env) {
  const cursorRaw = await env.FLIGHTS.get('cursor')
  let cursor = cursorRaw ? parseInt(cursorRaw, 10) || 0 : 0

  // merged map: { hex: { s: state[], t: lastSeenEpochS } }
  const mapRaw = await env.FLIGHTS.get('map')
  const map = mapRaw ? JSON.parse(mapRaw) : {}
  const now = Math.floor(Date.now() / 1000)

  const cold = []
  for (let i = 0; i < COLD_PER_RUN; i++) cold.push(TILES[(cursor + i) % TILES.length])

  await fetchInto(HOT, map, now)     // busy corridors — kept fresh every run
  await fetchInto(cold, map, now)    // remote / oceanic — rotates through slowly

  // age out aircraft not re-seen within the TTL
  for (const hex of Object.keys(map)) {
    if (now - map[hex].t > AIRCRAFT_TTL_S) delete map[hex]
  }

  cursor = (cursor + COLD_PER_RUN) % TILES.length
  await env.FLIGHTS.put('cursor', String(cursor))
  await env.FLIGHTS.put('map', JSON.stringify(map))
  // pre-serialise the client snapshot so the hot path is a single KV read
  const states = Object.values(map).map((e) => e.s)
  await env.FLIGHTS.put('snapshot', JSON.stringify({ time: now, states }))
  return states.length
}

// ---- weather engine: a coarse global cloud-cover grid from Open-Meteo ----
// Open-Meteo is keyless + CORS-friendly and takes many points per call, so one
// request fetches a 10°×10° grid (~612 points) of live cloud cover. Clouds move
// slowly, so we cache the grid for 10 min and every visitor shares it. Returned
// compact: { time, step, lat0, lon0, rows, cols, cloud:[0..100,...] } row-major
// from the SW corner — the globe unpacks it into a wrapping cloud layer.
const WX_STEP = 10
const WX_TTL_S = 600

function buildWeatherPoints() {
  const lats = [], lons = []
  for (let la = -80; la <= 80; la += WX_STEP)
    for (let lo = -180; lo < 180; lo += WX_STEP) { lats.push(la); lons.push(lo) }
  return { lats, lons }
}

async function fetchWeather() {
  const { lats, lons } = buildWeatherPoints()
  // single call — Open-Meteo takes all ~612 points at once, which keeps us to
  // ONE upstream hit per 10-min cache window (well within the free rate limit).
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=cloud_cover`
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!r.ok) throw new Error(`open-meteo HTTP ${r.status}`)
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error(`open-meteo non-JSON: ${text.slice(0, 60)}`) }
  const arr = Array.isArray(data) ? data : [data]
  const cloud = arr.map((p) => Math.round(p?.current?.cloud_cover ?? 0))
  const cols = Math.round(360 / WX_STEP)
  const rows = Math.round(160 / WX_STEP) + 1
  return { time: Math.floor(Date.now() / 1000), step: WX_STEP, lat0: -80, lon0: -180, rows, cols, cloud }
}

// refresh the weather grid in KV if it's older than the TTL — runs off the cron
// so user requests never trigger a live upstream fetch
async function refreshWeatherIfStale(env) {
  const cached = await env.FLIGHTS.get('weather')
  if (cached) {
    try {
      const g = JSON.parse(cached)
      if (Math.floor(Date.now() / 1000) - (g.time || 0) < WX_TTL_S) return
    } catch { /* fall through and refetch */ }
  }
  const grid = await fetchWeather()
  await env.FLIGHTS.put('weather', JSON.stringify(grid))
}

export default {
  // cron: advance the flight sweep + keep the weather grid warm
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sweepStep(env))
    ctx.waitUntil(refreshWeatherIfStale(env).catch(() => {}))
  },

  // user requests: serve the merged snapshot from KV (no upstream calls)
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    // manual trigger for local testing / warming: /sweep runs one step inline
    const url = new URL(request.url)
    if (url.pathname === '/sweep') {
      const n = await sweepStep(env)
      return json({ swept: true, aircraft: n })
    }

    // global cloud-cover grid — served straight from KV (the cron keeps it warm,
    // so the user path never makes an upstream call). Cold KV falls back to a
    // one-time inline fetch so the first visitor still gets clouds.
    if (url.pathname === '/weather') {
      const cached = await env.FLIGHTS.get('weather')
      if (cached) return withCache(new Response(cached, { headers: { 'Content-Type': 'application/json', ...CORS } }))
      try {
        const grid = await fetchWeather()
        await env.FLIGHTS.put('weather', JSON.stringify(grid))
        return withCache(json(grid))
      } catch (e) {
        return json({ error: 'weather warming up', detail: String(e).slice(0, 120) }, 503)
      }
    }

    const snap = await env.FLIGHTS.get('snapshot')
    if (!snap) {
      // cold KV (first deploy, before the first cron): do one inline step so the
      // very first visitor still gets data instead of an empty map
      const n = await sweepStep(env)
      const fresh = await env.FLIGHTS.get('snapshot')
      return withCache(json(JSON.parse(fresh || `{"time":${Math.floor(Date.now()/1000)},"states":[]}`)), n)
    }
    return withCache(new Response(snap, { headers: { 'Content-Type': 'application/json', ...CORS } }))
  },
}

function withCache(res) {
  res.headers.set('Cache-Control', 'public, max-age=10')
  return res
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
