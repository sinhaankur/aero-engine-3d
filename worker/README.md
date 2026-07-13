# Flight-data proxy (Cloudflare Worker)

The `/live` page shows real worldwide aircraft from the [OpenSky Network](https://opensky-network.org).
OpenSky doesn't send a CORS header, so a browser on the static site can't call
it directly. This tiny Worker fetches the data server-side, caches it for ~10s
(to respect OpenSky's anonymous rate limits), and re-serves it with an open CORS
header so the browser can read it.

## Deploy (one time, free)

1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. From this `worker/` directory:
   ```bash
   npm install -g wrangler   # or: npx wrangler ...
   npx wrangler login
   npx wrangler deploy
   ```
   Wrangler prints a URL like `https://ada-flight-proxy.<you>.workers.dev`.

3. Point the site at it. Create `.env` (or `.env.local`) in the repo root:
   ```
   VITE_FLIGHT_API=https://ada-flight-proxy.<you>.workers.dev
   ```
   Rebuild (`npm run build`). For the deployed GitHub Pages site, set the same
   variable in the Pages/Actions build environment.

That's it — the globe will populate with live traffic.

## Optional: higher rate limits

Anonymous OpenSky works but is throttled. With a free OpenSky account you get
more headroom:
```bash
npx wrangler secret put OPENSKY_USER
npx wrangler secret put OPENSKY_PASS
```

## Endpoints

- `GET /` — whole planet (`/states/all`)
- `GET /?bbox=lamin,lomin,lamax,lomax` — bounded box (smaller payload)

## Why not call OpenSky / adsb.lol directly?

Neither sends `Access-Control-Allow-Origin`, so browsers block the response
(verified: both fail with a CORS error from `localhost`/Pages). `curl` works
because it ignores CORS — which is misleading. Public CORS proxies work but are
unreliable (rate-limited, intermittent 500s), so this dedicated Worker is the
robust path.
