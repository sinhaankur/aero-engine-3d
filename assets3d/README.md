# assets3d — master 3D asset archive

A single place that holds **every** 3D asset for this project, both the editable
sources and the exported models:

- `blend/` — Blender source files (`.blend`). Edit these to change geometry.
- `glb/` — exported glTF binaries (`.glb`), one per source.

## Important: this is an archive, not the live path

The web app loads its models from **`/public/models/`** (URLs like
`/models/engine-leap-1a-hd.glb`). When you re-export a model, write it to
**both** `public/models/` (so the site picks it up) and `assets3d/glb/` (so the
archive stays complete). The `.blend` sources also live in `blender/` for the
documented export pipeline; copies are mirrored here so all assets sit together.

## Naming convention

| Asset    | File                          |
| -------- | ----------------------------- |
| Airframe | `<aircraftId>.glb`            |
| Engine   | `engine-<engineId>.glb`       |
| HD engine| `engine-<engineId>-hd.glb`    |

Engine `.glb` part nodes are named identically across engines
(`01_Nacelle_Cowl`, `03_Spinner`, `04_Fan_Blades`, …) so one viewer drives them
all. See `docs/blender-pipeline.md` for export settings.
