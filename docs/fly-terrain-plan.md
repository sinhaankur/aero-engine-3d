# /fly real-world terrain — implementation plan (#3)

The `/fly` world today is a 160 km procedural farmland plane that follows the
aircraft, with a global NASA Blue Marble texture stretched over it. It looks fine
but it is **not a real place** — fly out of LHR and the land below isn't London.
This plan streams real **satellite imagery + elevation** around the aircraft so
you take off and fly over the actual Earth, as a **network-gated enhancement**
that falls back to today's procedural ground when offline (the projector, no
network) so nothing regresses.

> Status: **Phase 1 (spike) DONE — decisions locked.** Decisions: Terrarium height
> under Blue Marble colour (no imagery token); ship after real terrain SHAPE;
> edge-cache only (no R2 yet). Spike verdict below: **adopt `three-tile`**.

## Spike result — adopt `three-tile` (don't hand-roll)

Read the source (sxguojf/three-tile, `packages/lib/src`). It's production-grade and
a clean fit — hand-rolling would reinvent all of this:
- `TileMap` is a `THREE.Object3D` with `.update(camera)` → lives in OUR scene with
  OUR camera/loop; `scene.add(map)`. No separate controls required.
- `TileSource.getUrl(x,y,z)` is **overridable** → route every tile through our
  Worker `/tile` proxy (just a URL template, or a 3-line subclass).
- `TerrainRGBLoader` already decodes Terrarium/Mapbox DEM; `Martini` (RTIN) meshes
  heightmaps with `skirt`s (crack hiding) in a `PromiseWorker` (off the main thread).
- `projection.project(lon,lat) → {x,y}` → deterministic geo→world, so we can
  **translate the map so the field sits at scene origin** and **rotate it by
  `headingOffset(rwy)`** (from #1) to align real north with our runway frame.
- `imgSource` accepts `ISource[]` — **multiple stacked/switchable layers**, which
  is exactly the "different layers on the Earth" requirement (see below).

### "Different layers on the Earth" (your note)
Terrain must not be one uniform treatment — water/coast, mountains, desert, ice,
forest all need to read right. How this plan handles it:
- **Shape** is automatic: the Terrarium DEM is GLOBAL, so mountains, coastlines,
  canyons, ice sheets all get their real elevation from one source, everywhere.
- **Colour per biome** comes from the imagery layer(s). Blue Marble already varies
  by biome worldwide (green forest, tan desert, white ice, blue water). `three-tile`'s
  multi-source support lets us stack a second layer later (e.g. a water mask for
  crisp coastlines, or a landcover tint) without rework.
- **Water** specifically: flag tiles/pixels at/below sea level from the DEM and
  give them a flat reflective water material instead of displaced land — a clean
  coast/ocean read. (Phase 5 polish.)

## Goal & non-goals

- **Goal:** real land colour + coastlines + real terrain height around the
  departure/destination fields, streamed on demand, 60 fps on a mid GPU.
- **Non-goals (this pass):** global seamless flight end-to-end (we stream a moving
  window, not the whole planet); photoreal buildings (OSM 3D is a later step);
  moving the altimeter to MSL (that rides along once terrain height is real — see
  "Altitude" below).

## Why a moving tile window (not the whole Earth)

A 4 km² patch at 1 m resolution is already ~16 M vertices — rendering the planet
at full res in a browser is impossible. The field's answer is a **quadtree LOD +
a 3×3 (or 5×5) moving window** of tiles centred on the camera, high detail near,
coarse far, recycled as you move. We stream two tile pyramids:

| Layer | Source | URL template | Decode |
| --- | --- | --- | --- |
| Elevation (DEM) | AWS Terrain Tiles (Terrarium) — **openly licensed**, no key | `…/terrarium/{z}/{x}/{y}.png` | `elev_m = (R*256 + G + B/256) − 32768` |
| Imagery | TBD — **licensing decision required** (see below) | `{z}/{y}/{x}` (note y/x order!) | sRGB texture |

Max DEM zoom is 15 (~3.6 m/px at mid-latitude). Terrarium uses `{z}/{x}/{y}`;
most imagery uses `{z}/{y}/{x}` — mixing these is the classic bug.

## The licensing decision (needs your call)

This repo's policy is explicit: *never commit proprietary assets; every figure
carries a source attribution.* That applies to imagery too.

- **AWS Terrarium DEM** — genuinely open (Tilezen/joerd attribution). Safe to use.
- **ESRI World Imagery** — loads without a key BUT the licence restricts use to
  tracing/validation; using it as a live basemap is **against their terms**. I do
  **not** recommend it given the repo's ethos.
- **Recommended imagery options (open):**
  1. **Esri World Imagery is out** → use an openly-licensed basemap instead, e.g.
     a provider with a clear open/free tier, or
  2. **Keep the NASA Blue Marble** we already ship for colour and only add real
     *height* from Terrarium — less "wow" but 100% clean and offline-capable for
     the colour layer, or
  3. Pay for a keyed provider (Mapbox/MapTiler/Stadia) — clean licence, needs a
     token + the worker to inject it so it's not in client code.

**My recommendation:** start with **option 2** (real Terrarium *height* under the
existing Blue Marble colour) — it's fully clean, needs no token, and the terrain
*shape* is most of the realism. Add a keyed open imagery provider (option 3) as a
follow-up once you pick one.

## Architecture

```
                    online                                    offline
  camera ──▶ TileManager ──▶ worker /tile?… ──▶ upstream     TileManager yields
             (quadtree,       (edge cache +     (AWS DEM,     nothing → existing
              3×3 window)      R2/KV cache)      imagery)     procedural ground
                    │                                          stays (no regress)
                    ▼
        GPU-displaced tile meshes (DEM → vertex height,
        imagery → map) replace the flat ground near the field
```

- **Client:** a `TileTerrain` component (new, in `src/three/`) wrapping
  **`three-tile`** (spike decided — see above). It owns the `TileMap`, the geo→world
  offset + runway-heading rotation, the per-frame `map.update(camera)`, and the
  online/tier gating + fallback to `RealGround`.
- **Worker:** add a `/tile` route to `worker/src/worker.js` (same `url.pathname`
  routing as `/live` `/weather` `/sweep`). It proxies the upstream tile, adds an
  **edge cache** (tiles are immutable → long max-age) and optionally an **R2**
  bucket so repeat tiles are free. This keeps tokens server-side and shields us
  from upstream rate limits — the same pattern [OpenSkyFlight] uses.
- **Fallback:** if `navigator.onLine` is false, the worker 5xxs, or tiles fail,
  `TileTerrain` renders nothing and the current `RealGround` stays. Gate the
  whole thing behind a flag + device tier so the projector never pays for it.

## Collision (Rapier)

Building collision already reads `buildingLayout()`. With real height, the
**ground is no longer y=0** — the belly/gear must test against the DEM. Options:
- cheap: sample the DEM height under the aircraft each frame (bilinear on the
  decoded tile) and treat `h_agl = y − demHeight(x,z)`; crash if < 0.
- This also fixes "terrain you can fly into" (hills), not just buildings.
Keep collision gated to near-field as today.

## Altitude (the deferred MSL work lands here)

Once the ground has real height, `s.h` should be **AGL above the DEM**, and the
altimeter should show **MSL = DEM_height + AGL**. At that point move the AP
selected-altitude, cruise-alt target, and PFD together to MSL (the piece #1
deliberately deferred). `fieldElevFt` is already stashed on `simRef` for this.

## Performance budget

- 3×3 window × (imagery + DEM) = 18 tile fetches on a field change; cached after.
- DEM → geometry: build once per tile on load (off the hot loop), not per frame.
- GPU displacement (vertex shader reads DEM as a texture) avoids CPU meshing.
- Reuse `qualityTier()`: `high` → 5×5 window + zoom 14–15; `mid` → 3×3 + zoom 13;
  `low` → skip entirely (procedural ground).

## Phasing

1. **Spike (½ day):** three-tile vs hand-rolled quadtree in our scene; pick one.
2. **DEM height under Blue Marble (option 2)** — real terrain shape, clean
   licence, no token. The big realism jump, lowest risk.
3. **Worker `/tile` cache route** — edge cache + optional R2.
4. **DEM collision + AGL/MSL altitude** — fly into hills, altimeter reads MSL.
5. **Keyed open imagery (option 3)** — real satellite colour, token via worker.

## Decisions (locked)

1. **Imagery:** option 2 — real Terrarium *height* under the existing Blue Marble
   colour. No token, fully clean, offline-capable colour. Keyed imagery deferred.
2. **Cache:** edge-cache only to start (no R2 yet).
3. **Scope this round:** ship after **phase 2** (real terrain shape). Phases 4–5
   (DEM collision, MSL altitude, water material) are follow-ups.
4. **Layers:** elevation is global/automatic; biome colour from Blue Marble now,
   stackable extra layers later via `three-tile`'s multi-source support.

Sources: [AWS Terrain Tiles / Terrarium](https://github.com/tilezen/joerd/blob/master/docs/attribution.md),
[three-tile](https://github.com/sxguojf/three-tile),
[OpenSkyFlight](https://github.com/Luciddreamer-ai/OpenSkyFlight),
[geo-three](https://github.com/tentone/geo-three).
