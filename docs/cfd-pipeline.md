# CFD pipeline — real airflow over our generated models

The `/simulate` page's **Wind tunnel** tab shows a precomputed CFD run over the
same parametric A320 GLB the site renders in 3D. The runs are made with
[FluidX3D](https://github.com/ProjectPhysX/FluidX3D) (Dr. Moritz Lehmann), a
GPU lattice-Boltzmann solver, used under its research/education license. We do
**not** vendor FluidX3D into this repo — only our case files live here, in
`cfd/`.

## How it works

```
public/models/a320.glb ──(Blender, cfd/export_stl.py)──▶ FluidX3D/stl/a320.stl
cfd/setup_a320_windtunnel.cpp ──(copied over src/setup.cpp)──▶ FluidX3D build
bin/FluidX3D ──▶ PNG frames (hero/side/top) ──(ffmpeg)──▶ public/media/cfd/*.mp4
```

One command does all of it (expects a FluidX3D checkout as a sibling directory,
override with `FLUIDX3D_DIR`):

```sh
cfd/run_a320.sh
```

## The case

- **Scenario**: climb-out at 150 kn (77 m/s), 8° angle of attack, sea-level ISA
  air, landing gear removed from the mesh (`--drop-gear`).
- **Numerics**: D3Q19 lattice, FP16S storage, Smagorinsky-Lilly LES
  (`SUBGRID`), equilibrium inflow/outflow boundaries, ~31M cells for a 2 GB
  memory budget, 3.5 s of physical time (~24k steps).
- **Rendering**: Q-criterion vortex isosurfaces + solid surface, 1920×1080,
  three cameras (chase/side/top), 200 BMP frames each, assembled at 30 fps
  (≈3× slow motion).
- **Forces**: the airframe is voxelized as `TYPE_S|TYPE_X`, so
  `lbm.object_force()` reports lift/drag every 1000 steps (converted to SI in
  the log). With voxel-stairstep walls and no wall model these are indicative
  only — expect drag to read high. Do not quote them as aerodynamic data.

The shipped run (2026-07-13, M1 Max 32-core, ~940 MLUPs) settled at lift
≈ 172 kN (CL ≈ 0.39) and drag ≈ 170 kN (CD ≈ 0.38), averaged over
t = 15k–20k steps. For calibration: a real A320 at 8° would be around CL ≈ 1
with ~10× less drag — the gap is the missing boundary layer, and saying so on
the page is part of the lesson.

## Geometry gotchas (learned the hard way)

- The GLB→Blender import lands with X=length, Y=height, Z=span, and the glTF
  importer leaves objects in **quaternion rotation mode**, where setting
  `rotation_euler` silently does nothing. `cfd/export_stl.py` therefore
  transforms mesh data directly with matrices and then *verifies* orientation
  geometrically (fin tip must end up +Z/up and +Y/aft) instead of trusting axis
  conventions.
- FluidX3D's wind-tunnel convention: flow along **+Y**, so the nose faces −Y,
  span on X, Z up. Angle of attack is applied in the case file as a rotation
  about X at voxelization time.
- On macOS, link without X11 (`make macOS LDFLAGS_X11= LDLIBS_X11=`) — X11 is
  only needed for `INTERACTIVE_GRAPHICS`; offline `GRAPHICS` rendering works
  headless.
- **Apple's OpenCL driver leaks per offline render** and segfaults the process
  (exit 139, no error message, throughput degrading beforehand) after roughly
  700 `write_frame` calls — reproduced twice at ~700 and ~750 renders,
  independent of PNG vs BMP output. Budget total renders (frames × cameras)
  under ~600 per process; the case uses 200 frames × 3 cameras. Write BMP
  anyway (PNG encoding burns CPU next to a saturated GPU) and let ffmpeg do
  the compression.

## Extending to other aircraft

`export_stl.py` is variant-agnostic (the fin-tip check handles any of our
airframes). To run another variant, export its GLB, copy the A320 case, and
update `si_length`, wing area `si_S`, and the scenario constants. The A380
(`decks: 2`) voxelizes fine — it's just a bigger STL.
