# Aircraft Engine & Airframe Design Archive

An interactive, **data-driven encyclopedia of aircraft families**. Each family
tells a chronological "journey" through every variant built over time — from the
engine up to the full airframe — with:

- 🛩 **Interactive 3D models** (react-three-fiber) — authored glTF, with a
  parametric fallback generated from each aircraft's real dimensions.
- 📐 **Technical blueprints** — top/side SVG views scaled from the same data.
- ⚙️ **Engine details** — thrust, bypass ratio, fan diameter, manufacturer.
- 📊 **Dimensions & performance** — length, span, MTOW, range, ceiling, seating.
- 🗓 **Production timelines** — first flight, entry into service, milestones.
- 🛡 **Safety records** — hull-loss rate per million departures, with explicit
  public-source attribution per aircraft.

The first fully built-out family is the **Airbus A320 family** (A318 / A319 /
A320 / A321 / A321XLR). Other Airbus families (A220, A330, A350, A380, A300/A310)
are declared as roadmap stubs.

## Tech stack

- **React 18** + **Vite**
- **react-three-fiber** + **drei** + **three** for 3D
- **react-router** (hash router, so it deploys cleanly to static hosts/GitHub Pages)
- Plain-JS data layer — the whole archive is diff-able in git, no database.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # preview the production build
```

## Projector apps (sideload APKs)

The archive doubles as a **big-screen appliance**: `projector/` builds two tiny
(~11 KB) Android WebView kiosk apps for HY300-class Android 11 projectors. Each
boots fullscreen over WiFi and auto-retries until the network is up.

| App | Loads | Download |
| --- | --- | --- |
| **Live Aviation** | the [live flight tracker](https://sinhaankur.github.io/AirbusEngine3D/#/live) — 3D globe of aircraft currently in the air | [live-aviation.apk](https://sinhaankur.github.io/AirbusEngine3D/apk/live-aviation.apk) |
| **Universe Engine** | [sinhaankur.com/tv](https://www.sinhaankur.com/tv/) — planets, the Sun, constellations, TV-first navigation | [universe-engine.apk](https://sinhaankur.github.io/AirbusEngine3D/apk/universe-engine.apk) |

**Install from a pendrive:** copy both APKs to a USB stick (FAT32), plug it into
the projector, open the file manager, tap each APK and allow *Install from
unknown sources*. Full steps live on the site's
[Projector tab](https://sinhaankur.github.io/AirbusEngine3D/#/projector).

**Rebuild:** `cd projector && ./gradlew assembleRelease` (needs JDK 17 +
Android SDK 34; outputs land in `projector/app/build/outputs/apk/`).

## Project structure

```
src/
  data/
    schema.js              # documented data shapes + risk buckets
    engines.js             # shared engine catalogue
    families/a320.js       # A320 family: variants + full specs/safety/timeline
    index.js               # family registry + lookups
  three/
    AircraftViewer.jsx     # R3F canvas: loads glTF or builds procedural model
    ProceduralAircraft.jsx # parametric airframe from dimensions data
  components/
    Blueprint.jsx          # SVG top/side technical drawing from dimensions
  pages/
    Home.jsx               # all families
    FamilyPage.jsx         # the "family journey" timeline
    AircraftPage.jsx       # 3D + blueprint + engines + specs + safety
public/models/             # authored .glb models (see docs/blender-pipeline.md)
public/apk/                # built projector APKs, served by GitHub Pages
projector/                 # Android WebView kiosk apps (two flavors, see above)
blender/                   # source .blend files
docs/blender-pipeline.md   # Blender → glTF export workflow
```

## Adding a new aircraft or family

1. Add/extend a file in `src/data/families/`. Follow the `Aircraft` and `Family`
   shapes documented in [`src/data/schema.js`](src/data/schema.js).
2. Register the family in [`src/data/index.js`](src/data/index.js) and add its
   variants to `AIRCRAFT_BY_FAMILY`.
3. (Optional) Author a glTF in Blender and wire it in — see
   [docs/blender-pipeline.md](docs/blender-pipeline.md). Until then the
   parametric model and blueprint render automatically from your dimensions.

## A note on data & safety figures

All specifications are **nominal public figures** for reference and visual
design, not certified engineering data. **Safety figures** (hull-loss rates,
accident counts) are cumulative lifetime values drawn from public aviation-safety
records and are attributed per aircraft in each variant's `safety.sources`. New
types with little service history are shown as "—" rather than a misleading rate.

## Roadmap

- [x] Phase 1 — data schema, A320 family, procedural 3D + blueprint, full UI.
- [ ] Phase 2 — author real Blender glTF airframes + standalone engine models.
- [ ] Phase 3 — comparison view (overlay variants), per-component exploded views.
- [ ] Phase 4 — Boeing / Embraer / other manufacturers.
