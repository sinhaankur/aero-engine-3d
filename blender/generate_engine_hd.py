"""
High-detail parametric turbofan GLB generator (headless Blender).

Standalone companion to generate_airframe_hd.py. That script builds whole
aircraft (with engines attached); this one builds a *single engine on its own*,
laid out for the exploded-view / cutaway EngineViewer on the site. It closes a
real gap: the airframe generator had a `build_engine()` for engines-on-a-wing,
but the standalone engine GLBs that feed /#/engine/<id> had no committed
generator — now they do, reproducible from public specs like the airframes.

CONTRACT — the glTF node names below are a hard interface. src/data/engineParts.js
keys every exploded-view part, blueprint callout and Brayton-cycle stage to these
exact node names, shared across all engine models. DO NOT rename them without
updating that file in lockstep:

    01_Nacelle_Cowl   02_Fan_Case      03_Spinner        04_Fan_Blades
    01b_Inlet_Lip     05_Core_Casing   06_Combustor      07_Turbine
    08_Exhaust_Nozzle 09_Exhaust_Plug  10_Pylon          11_Reduction_Gearbox (GTF only)

Air flows front (+X) to back (−X): the spinner/fan sit at +X, the exhaust plug at
−X, matching the `offset` signs in engineParts.js (positive slides a part toward
the intake in the explode). Export is Y-up GLB, same settings as the airframe
generator, so the downstream Draco step (npx @gltf-transform/cli draco) is
unchanged. Draco preserves node names, so the part-animation code is unaffected.

Run (one engine, or a batch — the specs file is a JSON array):
    blender --background --python generate_engine_hd.py -- <engine-spec.json> <outdir>

Then compress + install (see the airbus-engine-3d skill / README):
    npx @gltf-transform/cli draco <outdir>/<id>.glb public/models/<id>.glb
"""

import bpy
import bmesh
import json
import math
import sys
import os

TAU = math.tau


# --------------------------------------------------------------------------- #
# scene + material helpers  (mirrors generate_airframe_hd.py so the two
# generators share one look and the same Blender-version-safe socket handling)
# --------------------------------------------------------------------------- #
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _set(bsdf, key, val):
    # Principled BSDF socket names drift across Blender versions; set safely.
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = val


def mat(name, rgba, metallic=0.2, roughness=0.5, coat=0.0, ior=1.45, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    _set(bsdf, "Base Color", rgba)
    _set(bsdf, "Metallic", metallic)
    _set(bsdf, "Roughness", roughness)
    if coat:
        _set(bsdf, "Coat Weight", coat)
        _set(bsdf, "Clearcoat", coat)
        _set(bsdf, "Coat Roughness", 0.08)
        _set(bsdf, "Clearcoat Roughness", 0.08)
    if emission:
        # the hot section glows a little in the cutaway
        _set(bsdf, "Emission Color", emission)
        _set(bsdf, "Emission", emission)
        _set(bsdf, "Emission Strength", 1.4)
    return m


def new_mesh_obj(name, coll=None):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def assign(ob, material):
    ob.data.materials.clear()
    ob.data.materials.append(material)
    return ob


def shade_smooth(ob, smooth=True):
    for p in ob.data.polygons:
        p.use_smooth = smooth
    return ob


def hex_to_rgba(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255,
            int(h[4:6], 16) / 255, 1.0)


def materials(spec):
    lip = spec.get("lip_polished", False)
    return {
        # the outer cowl: painted composite with the wet clearcoat sheen
        "nacelle": mat("E_Nacelle", hex_to_rgba(spec.get("cowl_color", "#e7ebf0")),
                       0.5, 0.22, coat=0.5),
        # intake lip: bright chrome (V2500 is famously bare polished metal)
        "lip": mat("E_Lip", (0.90, 0.92, 0.95, 1), 0.98, 0.06 if lip else 0.12),
        "fancase": mat("E_FanCase", (0.74, 0.77, 0.81, 1), 0.6, 0.26),
        "fan": mat("E_Fan", hex_to_rgba(spec.get("fan_color", "#23262b")), 0.85, 0.22),
        "spinner": mat("E_Spinner", (0.07, 0.07, 0.09, 1), 0.75, 0.28),
        "core": mat("E_Core", (0.58, 0.60, 0.64, 1), 0.85, 0.30),
        "combustor": mat("E_Combustor", (0.26, 0.10, 0.06, 1), 0.7, 0.45,
                         emission=(0.55, 0.14, 0.03, 1)),  # glowing hot
        "turbine": mat("E_Turbine", (0.40, 0.33, 0.22, 1), 0.85, 0.35,
                       emission=(0.20, 0.08, 0.02, 1)),
        "hot": mat("E_Hot", (0.16, 0.15, 0.16, 1), 0.85, 0.40),
        "plug": mat("E_Plug", (0.30, 0.29, 0.30, 1), 0.7, 0.42),
        "pylon": mat("E_Pylon", (0.60, 0.63, 0.67, 1), 0.5, 0.40),
        "gearbox": mat("E_Gearbox", (0.52, 0.45, 0.20, 1), 0.9, 0.28),  # brassy
    }


# --------------------------------------------------------------------------- #
# small geometry utilities (bmesh)
# --------------------------------------------------------------------------- #
def ring(bm, x, radius, n, z_off=0.0):
    """A ring of `n` verts in the Y–Z plane at station x (engine axis = X)."""
    vs = []
    for i in range(n):
        a = TAU * i / n
        vs.append(bm.verts.new((x, radius * math.cos(a), radius * math.sin(a) + z_off)))
    return vs


def loft(bm, rings, closed=True):
    n = len(rings[0])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for s in range(n if closed else n - 1):
            s2 = (s + 1) % n
            bm.faces.new((r0[s], r0[s2], r1[s2], r1[s]))


def obj_from_bm(bm, name, material, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_mesh_obj(name)
    bm.to_mesh(ob.data)
    bm.free()
    assign(ob, material)
    shade_smooth(ob, smooth)
    return ob


def tube(name, material, profile, n=48, smooth=True):
    """Build a surface of revolution from a [(x, radius), ...] profile.
    Open at both ends (it's a shell / casing, seen in cutaway)."""
    bm = bmesh.new()
    rings = [ring(bm, x, max(r, 1e-4), n) for (x, r) in profile]
    loft(bm, rings, closed=True)
    return obj_from_bm(bm, name, material, smooth)


# --------------------------------------------------------------------------- #
# engine components — each returns an object named with its contract node name
# Geometry is axisymmetric about X; air enters at +X (xf), leaves at −X (xr).
# --------------------------------------------------------------------------- #
def build_nacelle(spec, mats):
    """01_Nacelle_Cowl — the aerodynamic outer shell / bypass duct wall."""
    R = spec["fan_dia"] / 2.0
    ro = R * 1.16                       # cowl outer radius (bypass duct wall)
    xf, xr = spec["x_intake"], spec["x_nozzle"] + 0.2
    L = xf - xr
    prof = []
    N = 22
    for i in range(N + 1):
        t = i / N
        x = xf - t * L
        # fat near the fan, tapering to a boat-tail toward the rear
        bulge = math.sin(min(t * 1.25, 1.0) * math.pi) * 0.5 + 0.5
        r = ro * (0.62 + 0.38 * bulge) * (1.0 - 0.18 * t)
        prof.append((x, r))
    return tube("01_Nacelle_Cowl", mats["nacelle"], prof, n=56)


def build_inlet_lip(spec, mats):
    """01b_Inlet_Lip — the rounded (often chrome) leading edge of the intake."""
    R = spec["fan_dia"] / 2.0
    ro = R * 1.16
    x0 = spec["x_intake"]
    bm = bmesh.new()
    n = 56
    # a half-torus rolled lip: cross-section circle swept around the inlet
    minor = ro * 0.10
    rings = []
    for j in range(13):
        a = math.pi * j / 12            # 0..pi, folds the lip inward
        x = x0 - minor + minor * math.cos(a)
        rr = ro - minor + minor * math.sin(a)
        rings.append(ring(bm, x, rr, n))
    loft(bm, rings, closed=True)
    return obj_from_bm(bm, "01b_Inlet_Lip", mats["lip"])


def build_fan_case(spec, mats):
    """02_Fan_Case — structural containment ring around the fan."""
    R = spec["fan_dia"] / 2.0
    x = spec["x_fan"]
    prof = [(x + 0.28, R * 1.05), (x + 0.10, R * 1.10),
            (x - 0.10, R * 1.10), (x - 0.28, R * 1.05)]
    return tube("02_Fan_Case", mats["fancase"], prof, n=56)


def build_spinner(spec, mats):
    """03_Spinner — the nose cone at the fan centre."""
    hub = spec["fan_dia"] * 0.11
    x0 = spec["x_fan"] + hub * 2.4      # tip pokes forward of the fan
    bm = bmesh.new()
    n = 40
    rings = []
    N = 14
    for i in range(N + 1):
        t = i / N
        x = x0 - t * (hub * 2.4)
        r = hub * math.sin(t * math.pi / 2) ** 0.8  # ogive cone
        rings.append(ring(bm, x, max(r, 1e-4), n))
    loft(bm, rings, closed=True)
    bm.faces.new(list(rings[-1]))       # cap the back
    return obj_from_bm(bm, "03_Spinner", mats["spinner"])


def build_fan(spec, mats):
    """04_Fan_Blades — the hub plus `blades` twisted aerofoil blades."""
    R = spec["fan_dia"] / 2.0
    hub = spec["fan_dia"] * 0.11
    x = spec["x_fan"]
    blades = int(spec.get("fan_blades", 20))
    bm = bmesh.new()
    # central hub disc
    hub_prof = [(x + hub * 0.6, hub), (x, hub * 1.05), (x - hub * 0.6, hub)]
    hrings = [ring(bm, px, pr, 28) for (px, pr) in hub_prof]
    loft(bm, hrings, closed=True)
    # blades: a thin twisted quad strip from root to tip
    for b in range(blades):
        a = TAU * b / blades
        twist = math.radians(32)        # root-to-tip twist
        chord = R * 0.26
        verts = []
        M = 5
        for i in range(M + 1):
            t = i / M
            rr = hub + (R - hub) * t
            lt = twist * (1 - t)        # more stagger near the root
            # leading / trailing edge points, rotated by blade angle `a`
            for sgn in (+1, -1):
                xc = x + sgn * (chord / 2) * math.cos(lt)
                off = sgn * (chord / 2) * math.sin(lt)
                y = (rr) * math.cos(a) - off * math.sin(a)
                z = (rr) * math.sin(a) + off * math.cos(a)
                verts.append(bm.verts.new((xc, y, z)))
        for i in range(M):
            a0, b0 = verts[2 * i], verts[2 * i + 1]
            a1, b1 = verts[2 * i + 2], verts[2 * i + 3]
            bm.faces.new((a0, b0, b1, a1))
    return obj_from_bm(bm, "04_Fan_Blades", mats["fan"])


def build_core(spec, mats):
    """05_Core_Casing — the compressor casing (the gas-generator spool)."""
    R = spec["fan_dia"] / 2.0
    xf = spec["x_fan"] - 0.5
    xr = spec["x_combustor"] + 0.2
    rc = R * 0.42                        # core radius
    prof = [(xf, rc * 0.96), (xf - (xf - xr) * 0.5, rc), (xr, rc * 0.82)]
    return tube("05_Core_Casing", mats["core"], prof, n=40)


def build_combustor(spec, mats):
    """06_Combustor — annular can where fuel burns (glows in the cutaway)."""
    R = spec["fan_dia"] / 2.0
    x = spec["x_combustor"]
    rc = R * 0.34
    prof = [(x + 0.35, rc), (x, rc * 1.08), (x - 0.35, rc)]
    return tube("06_Combustor", mats["combustor"], prof, n=36)


def build_turbine(spec, mats):
    """07_Turbine — the turbine spool downstream of the combustor."""
    R = spec["fan_dia"] / 2.0
    x = spec["x_turbine"]
    rc = R * 0.38
    bm = bmesh.new()
    # short casing
    prof = [(x + 0.3, rc * 0.9), (x, rc), (x - 0.3, rc * 0.86)]
    rings = [ring(bm, px, pr, 36) for (px, pr) in prof]
    loft(bm, rings, closed=True)
    # a couple of disc stages to read as turbine wheels
    for xs, rs in ((x + 0.12, rc * 0.78), (x - 0.12, rc * 0.74)):
        disc = [ring(bm, xs + 0.03, rs, 24), ring(bm, xs - 0.03, rs, 24)]
        loft(bm, disc, closed=True)
    return obj_from_bm(bm, "07_Turbine", mats["turbine"])


def build_nozzle(spec, mats):
    """08_Exhaust_Nozzle — convergent core exhaust nozzle."""
    R = spec["fan_dia"] / 2.0
    xf = spec["x_turbine"] - 0.3
    xr = spec["x_nozzle"]
    r0, r1 = R * 0.34, R * 0.24
    prof = [(xf, r0), (xr, r1)]
    return tube("08_Exhaust_Nozzle", mats["hot"], prof, n=36)


def build_plug(spec, mats):
    """09_Exhaust_Plug — the central tail cone in the exhaust."""
    R = spec["fan_dia"] / 2.0
    x0 = spec["x_turbine"] - 0.2
    xr = spec["x_nozzle"] - 0.5
    bm = bmesh.new()
    n = 32
    rings = []
    N = 12
    for i in range(N + 1):
        t = i / N
        x = x0 - t * (x0 - xr)
        r = R * 0.22 * (1 - t) ** 0.9
        rings.append(ring(bm, x, max(r, 1e-4), n))
    loft(bm, rings, closed=True)
    bm.faces.new(list(reversed(rings[0])))
    return obj_from_bm(bm, "09_Exhaust_Plug", mats["plug"])


def build_pylon(spec, mats):
    """10_Pylon — the strut hanging the engine from the wing (sits on top)."""
    R = spec["fan_dia"] / 2.0
    top = R * 1.16
    xf = spec["x_fan"] - 0.4
    xr = spec["x_turbine"]
    bm = bmesh.new()
    h = R * 0.9                          # reaches up toward the wing
    w = R * 0.10
    pts = [
        (xf, -w, top), (xf, w, top), (xr, w, top), (xr, -w, top),           # bottom
        (xf + 0.2, -w * 0.6, top + h), (xf + 0.2, w * 0.6, top + h),
        (xr - 0.2, w * 0.6, top + h), (xr - 0.2, -w * 0.6, top + h),        # top
    ]
    vs = [bm.verts.new(p) for p in pts]
    faces = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
             (3, 2, 6, 7), (0, 3, 7, 4), (1, 2, 6, 5)]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    return obj_from_bm(bm, "10_Pylon", mats["pylon"], smooth=False)


def build_gearbox(spec, mats):
    """11_Reduction_Gearbox — GTF only; a disc just ahead of the core."""
    R = spec["fan_dia"] / 2.0
    x = spec["x_fan"] - 0.7
    rc = R * 0.30
    prof = [(x + 0.14, rc * 0.9), (x, rc), (x - 0.14, rc * 0.9)]
    return tube("11_Reduction_Gearbox", mats["gearbox"], prof, n=32)


# --------------------------------------------------------------------------- #
# assembly + export
# --------------------------------------------------------------------------- #
def derive_stations(spec):
    """Fill in axial station positions (metres along +X) from a compact spec.
    Everything scales off the fan diameter so a spec only needs the headline
    numbers; air enters at +X_intake and leaves at −X_nozzle."""
    D = spec["fan_dia"]
    spec.setdefault("x_intake", D * 1.05)
    spec.setdefault("x_fan", D * 0.78)
    spec.setdefault("x_combustor", -D * 0.15)
    spec.setdefault("x_turbine", -D * 0.55)
    spec.setdefault("x_nozzle", -D * 1.00)
    return spec


def build_engine(spec, outdir):
    reset_scene()
    derive_stations(spec)
    mats = materials(spec)

    objs = [
        build_nacelle(spec, mats),
        build_inlet_lip(spec, mats),
        build_fan_case(spec, mats),
        build_spinner(spec, mats),
        build_fan(spec, mats),
        build_core(spec, mats),
        build_combustor(spec, mats),
        build_turbine(spec, mats),
        build_nozzle(spec, mats),
        build_plug(spec, mats),
        build_pylon(spec, mats),
    ]
    if spec.get("gearbox"):
        objs.append(build_gearbox(spec, mats))

    # smooth the big curved shells so the silhouette reads clean, not faceted
    for ob in objs:
        if ob.name in ("01_Nacelle_Cowl", "02_Fan_Case", "05_Core_Casing"):
            m = ob.modifiers.new(name="Subsurf", type="SUBSURF")
            m.levels = m.render_levels = 1
            m.use_limit_surface = True
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier=m.name)

    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f"{spec['id']}.glb")
    bpy.ops.export_scene.gltf(
        filepath=out, export_format="GLB",
        use_selection=True, export_apply=True, export_yup=True)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in objs if o.type == "MESH")
    size_kb = os.path.getsize(out) / 1024
    print(f"[OK] {spec['id']}: {len(objs)} parts, ~{tris} tris, "
          f"{size_kb:.0f} KB -> {out}")
    return out


def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    if len(argv) < 2:
        print("usage: blender --background --python generate_engine_hd.py "
              "-- <engine-spec.json> <outdir>")
        return
    specs_path, outdir = argv[0], argv[1]
    with open(specs_path) as f:
        specs = json.load(f)
    if isinstance(specs, dict):
        specs = [specs]
    for spec in specs:
        build_engine(spec, outdir)


if __name__ == "__main__":
    main()
