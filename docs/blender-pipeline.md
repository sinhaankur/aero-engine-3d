# Blender → glTF model pipeline

Authored 3D models live in [`public/models/`](../public/models/) as `.glb` files
and are referenced from the data files via the `model` field on an aircraft or
engine. When `model` is empty, the app renders a **parametric fallback** built
from the aircraft's `dimensions` — so the site is always functional even before
any model is authored.

## Naming convention

| Asset            | File                                  | `model` field value          |
| ---------------- | ------------------------------------- | ---------------------------- |
| Airframe         | `public/models/<aircraftId>.glb`      | `/models/a320.glb`           |
| Engine           | `public/models/engine-<engineId>.glb` | `/models/engine-leap-1a.glb` |

Keep the source `.blend` in `blender/` (the build ignores `.blend1/.blend2`
autosaves). Export only the optimised `.glb` into `public/models/`.

## Export settings (Blender)

1. Model in **real-world metres** so scale matches the `dimensions` data and the
   procedural fallback. Apply all transforms (Object → Apply → All Transforms).
2. Centre the model on the world origin; nose toward **+X**, up toward **+Y**.
3. `File → Export → glTF 2.0 (.glb)` with:
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects** (select the airframe collection first)
   - Transform: **+Y Up** (glTF convention; drei/three handles this)
   - Geometry: apply modifiers, export normals, **compress with Draco** for big meshes
4. Target a sane budget: a few hundred K triangles max for a whole airframe so
   the page stays responsive.

## Quick export via the Blender MCP (optional)

This repo was scaffolded with a live Blender MCP connection available. To export
the currently-selected objects to a `.glb`, the assistant can run (in Object
mode, with the airframe collection selected):

```python
import bpy
bpy.ops.export_scene.gltf(
    filepath="/Users/sinhaankur/aircraft-engine-design/public/models/a320.glb",
    export_format='GLB',
    use_selection=True,
    export_apply=True,        # apply modifiers
    export_yup=True,
)
```

> Note: at scaffold time the connected Blender scene contained an unrelated
> X-Wing project in Edit mode. Do **not** export that — switch to / open the
> correct airframe `.blend` and Object mode first.

## Wiring a model into the site

1. Drop `a320.glb` into `public/models/`.
2. In [`src/data/families/a320.js`](../src/data/families/a320.js), set the
   aircraft's `model: '/models/a320.glb'`.
3. The detail page's 3D viewer loads it automatically; the "parametric model"
   note disappears once `model` is set.
