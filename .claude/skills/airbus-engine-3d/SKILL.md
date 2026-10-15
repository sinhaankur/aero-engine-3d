---
name: airbus-engine-3d
description: Codebase map, commands, and hard-won gotchas for AirbusEngine3D. Read this instead of exploring — it covers the site, data layer, Blender/CFD pipelines, flight-proxy worker, and projector APKs.
---

# AirbusEngine3D — working knowledge

Interactive, data-driven encyclopedia of Airbus families (6 families, 18
variants) that teaches how aircraft are designed and how each system works.
North star: open-source aviation knowledge + tooling, framed as
**Funds vs Market vs Safety** (see `docs/ROADMAP.md`). Presented as a
marketing-style site. The GitHub repo was renamed to `aero-engine-3d`, so it
deploys on GitHub Pages at `https://sinhaankur.github.io/aero-engine-3d/`
(old `AirbusEngine3D` URL now 404s).

## Commands

| Task | Command |
| --- | --- |
| Dev server (LAN-exposed on purpose) | `npm run dev` |
| Production build | `npm run build` |
| Deploy site | just `git push` — `.github/workflows/deploy.yml` builds (Node 22) and publishes Pages |
| Deploy flight proxy | `cd worker && npx wrangler deploy` |
| Regenerate an airframe GLB | `blender --background --python blender/generate_airframe_hd.py -- <specs.json> <outdir>` (specs in `blender/specs/`) |
| Regenerate the engine GLBs | `blender --background --python blender/generate_engine_hd.py -- blender/specs/engines/a320-engines.json <outdir>`, then Draco-compress into `public/models/` |
| Full CFD run | `cfd/run_a320.sh` (needs FluidX3D checkout as sibling dir, or `FLUIDX3D_DIR`) |
| Rebuild projector APKs | `cd projector && JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew assembleRelease` |

**This Mac's java stub is broken** ("Unable to locate a Java Runtime") —
always set `JAVA_HOME` to the Homebrew openjdk@17 path above. Android SDK is
at `~/Library/Android/sdk`.

## Architecture map

- `src/main.jsx` — **hash router** (`createHashRouter`). All deep links are
  `/#/live`, `/#/projector`, `/#/family/a320`, etc. `vite.config.js` also emits
  a `404.html` SPA fallback, but the `#` form is the canonical URL shape.
- `src/data/` — the whole archive as plain diffable JS, no database.
  `schema.js` documents the `Aircraft`/`Family`/`Engine` shapes (SI-first
  units); `index.js` is the registry (`FAMILIES`, `AIRCRAFT_BY_FAMILY`,
  `getAircraftUsingEngine`); `families/*.js` per family; `engines.js` shared
  engine catalogue; `engineParts.js` exploded-view part data keyed to glTF
  node names shared across all engine models; `systems.js` per-system
  explainer data whose `schematic.nodes/links` drive interactive SVGs.
- `src/three/` — `AircraftViewer` loads authored GLB or falls back to
  `ProceduralAircraft` (parametric from dimensions). `withBase()` resolves
  `/models/x.glb` against `import.meta.env.BASE_URL` — model paths in data
  files always start with `/models/` and must go through it.
- `src/components/Blueprint.jsx` — exact-looking GA drawing generated from the
  4 core dimensions (no traced artwork).
- `src/live/` — `useFlightData` polls the worker proxy (15 s interval,
  1.6× backoff to 60 s, keeps last snapshot on error); rows are OpenSky
  `/states/all`-shaped, indices 17–19 are extensions (reg, ICAO type, Mach).
  `FlightGlobe` renders the 3D globe.
- `src/sim/` — `AirfoilFlow` (2D intuition toy, NACA-4 math, stall at 15°),
  `FuelSystem` (interactive schematic), `WindTunnel` (plays the precomputed
  CFD videos from `public/media/cfd/`).
- `worker/` — Cloudflare Worker `ada-flight-proxy`: ADS-B proxy, **on-demand,
  NO cron** (the every-min cron drove KV to ~50% of the free daily tier while
  idle, so it was removed 2026-07-28 to kill cost — re-enable by uncommenting
  `[triggers]` in wrangler.toml). `/live` serves the `FLIGHTS` KV snapshot when
  fresh (<45 s); when stale it sweeps only the ~31 HOT corridors and an edge
  cache (max-age 30) collapses bursts so ~one request/window does the work —
  cost tracks real traffic, zero while idle. A 467-tile global grid + hot/cold
  `sweepStep` still exist for when the cron's re-enabled. airplanes.live
  rate-limits bursts hard (250 nm cap; a full fan-out gets ~70% rejected) so
  DON'T sweep the whole grid on the user path. Response OpenSky-shaped (idx
  17-19 = reg/type/mach). Deploy needs
  `CLOUDFLARE_ACCOUNT_ID=3f9c8ee4978248332bdbffa957684533` (two CF accounts).
  Also serves `/weather`: a 612-point (10°) global cloud-cover grid from
  Open-Meteo (keyless), warmed into KV by the cron every 10 min so the user path
  is a pure KV read (no live upstream — Open-Meteo rate-limits bursts). The
  globes' `Clouds` layer (src/live/Earth.jsx) upscales it into a drifting cloud
  sphere. Single upstream call of ~612 points is fine; do NOT chunk it (doubles
  rate-limit pressure) and a long single-call URL does NOT 1101.
- `blender/` — `generate_airframe_hd.py` is the current generator (NACA-4
  wing sections, windows/doors/gear as real geometry, 60–90k tris);
  `generate_airframe.py` is the low-detail predecessor. All variant + engine
  GLBs live in `public/models/`, **Draco-compressed** (~80% smaller, ~130 KB
  each) as a post-generation step via `npx @gltf-transform/cli draco`. The
  decoder is vendored in `public/draco/` and wired once in `main.jsx`
  (`useGLTF.setDecoderPath`) — self-hosted, not gstatic, so models decode
  offline. Draco preserves node names, so the part-animation code is unaffected.
  Re-run the compression after regenerating any GLB.
  `generate_engine_hd.py` is the **standalone turbofan generator** for the
  exploded-view engine models (`/#/engine/<id>`); the airframe generator only
  builds engines-on-a-wing. Spec-driven from `blender/specs/engines/*.json` (fan
  diameter, blade count, `gearbox` flag); stations derive off the fan diameter.
  **Its glTF node names are a hard contract with `src/data/engineParts.js`** —
  `01_Nacelle_Cowl 01b_Inlet_Lip 02_Fan_Case 03_Spinner 04_Fan_Blades
  05_Core_Casing 06_Combustor 07_Turbine 08_Exhaust_Nozzle 09_Exhaust_Plug
  10_Pylon` (+ `11_Reduction_Gearbox` on the GTF). An object's `.name` becomes
  the glTF node name. Rename nothing without editing engineParts.js in lockstep
  or the explode/blueprint/cycle highlighting breaks. Air flows +X→−X.
- `src/pages/FiguresPage.jsx` (`/#/figures`) — isometric-figure gallery from the
  `anatomy-figures` npm pkg (companion to the Anatomy skill). Each figure is
  ~1.5–2.7 MB, so figures are **lazy-loaded per-subpath-entry** (explicit
  literal-specifier import() map + IntersectionObserver); never import from the
  barrel or the one route chunks to ~20 MB.
- `cfd/` — FluidX3D case files only (FluidX3D is never vendored).
  `export_stl.py` (GLB→STL via Blender), `setup_a320_windtunnel.cpp`,
  `run_a320.sh`. See `docs/cfd-pipeline.md` before touching.
- `projector/` — Android project: one WebView kiosk codebase, two flavors →
  two ~11 KB APKs for the user's LQWELL/Magcubic HY300 projector (Android 11):
  `aviation` → `…/aero-engine-3d/#/live`, `universe` → `www.sinhaankur.com/tv/`
  (the portfolio-2026 repo's TV shell). Built APKs are committed to
  `public/apk/` and downloadable from the site's `/#/projector` page.

## Environments

- `VITE_FLIGHT_API` = `https://ada-flight-proxy.sinhaankur827-f9c.workers.dev`
  — set in `.env.local` (dev) and hardcoded in `deploy.yml` (prod). Without it
  the live page shows "unconfigured".
- Vite `base` is `/aero-engine-3d/`; dev/preview listen on all interfaces
  (`host: true`) so LAN devices (projector, phone) can load the dev server.

## Hard-won gotchas — do not re-learn these

1. **Hash router**: any URL you hand out (APKs, README, QR codes) needs `/#/`.
   A path-style deep link "works" only via the 404.html fallback and returns
   HTTP 404.
2. **OpenSky hard-blocks Cloudflare egress IPs** (522) and adsb.lol
   rate-limits (429) — airplanes.live is the only working upstream from a
   Worker. Don't "simplify" back to OpenSky.
3. **glTF import into Blender leaves objects in quaternion rotation mode** —
   setting `rotation_euler` silently does nothing. `cfd/export_stl.py`
   transforms mesh data with matrices and verifies orientation geometrically;
   keep that pattern.
4. **Apple's OpenCL driver leaks per offline FluidX3D render** and segfaults
   (~exit 139) after ~700 `write_frame` calls. Keep frames × cameras under
   ~600 per process; write BMP, let ffmpeg compress.
5. **FluidX3D flow axis is +Y** (nose faces −Y, span X, Z up); AoA is a
   rotation about X at voxelization time. On macOS build with
   `make macOS LDFLAGS_X11= LDLIBS_X11=`.
6. CFD force readouts are indicative only (voxel stairstep, no wall model —
   drag reads ~10× high). The site says so; never present them as data.
7. **Projector APKs are debug-signed on purpose** — stable local key means
   updates install over the old version. Don't add a release keystore.
8. Three.js is split into its own ~1.1 MB manual chunk
   (`vite.config.js`) — leave `chunkSizeWarningLimit` alone.
9. Policy: never scrape or commit proprietary CAD/models — everything is
   generated from public specs, and every safety figure carries a source
   attribution in `safety.sources`.
10. **Blender MCP sandbox blocks `bpy.ops.wm.read_factory_settings`** — use
    `bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)` to get a
    clean scene in LLM-run code. Good loop for iterating a model: generate GLB on
    disk → import into the live (scratch) Blender → `render_viewport_to_path` →
    read the PNG to eyeball geometry. The repo's real `.blend`/`.glb` files are
    never touched by this; the live session is a scratch default scene.

## Recipes

- **Add a variant/family**: extend `src/data/families/`, register in
  `src/data/index.js`, write a spec JSON in `blender/specs/`, run the HD
  generator, drop the GLB in `public/models/`, set `model` in the data.
- **New CFD case**: copy the A320 case, update `si_length`, `si_S`, scenario
  constants; `export_stl.py` is variant-agnostic.
- **Regenerate / add an engine model**: edit `blender/specs/engines/*.json`
  (fan diameter, blade count, `gearbox` flag, cowl/fan colours), run
  `generate_engine_hd.py`, Draco-compress the GLB into `public/models/` under the
  `model` path in `src/data/engineParts.js` (`ENGINE_MODELS[*].model`). Keep the
  glTF node names exactly as engineParts.js expects.
- **Change a projector app's target URL**: edit `LAUNCH_URL` in
  `projector/app/build.gradle` (per flavor), rebuild, copy APKs to
  `public/apk/` (filenames `live-aviation.apk`, `universe-engine.apk`), push.
