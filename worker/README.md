# Flight-data proxy (Cloudflare Worker)

The `/live` page shows real worldwide aircraft from the
[airplanes.live](https://airplanes.live) ADS-B network. Flight APIs don't send
CORS headers, so a browser on the static site can't call them directly. This
Worker fetches the data server-side, caches it briefly (~15s), and re-serves
it with an open CORS header.

airplanes.live only answers regional queries (max 250 nm radius), so the
Worker sweeps a fixed set of ~30 tiles covering the world's busiest airspace,
merges and dedupes the results, and returns them in OpenSky
`/states/all`-compatible shape (indices 0–16), with extensions at 17–19:
registration, ICAO type, Mach. The edge cache means any number of visitors
costs one upstream sweep per 15 s window.

## Why not OpenSky (the original upstream)?

OpenSky hard-blocks requests from Cloudflare Workers' egress IPs — their edge
returns `522` even though the same request succeeds from a residential IP
(verified with an in-worker probe on 2026-07-14). adsb.lol rate-limits
Cloudflare IPs (`429`). airplanes.live answers normally and provides richer
per-aircraft fields.

## Deploy (one time, free)

1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. From this `worker/` directory:
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```
   Wrangler prints a URL like `https://ada-flight-proxy.<you>.workers.dev`.
   The current deployment lives at
   `https://ada-flight-proxy.sinhaankur827-f9c.workers.dev`.

3. Point the site at it. Create `.env.local` in the repo root:
   ```
   VITE_FLIGHT_API=https://ada-flight-proxy.<you>.workers.dev
   ```
   For the deployed GitHub Pages site, the URL is set in
   `.github/workflows/deploy.yml` (it is public by design — it ships in the
   client bundle anyway).

## Endpoint

- `GET /` — merged worldwide snapshot, `{ time, states: [...] }`
