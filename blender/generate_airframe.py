"""
Parametric airliner GLB generator (headless Blender).

Builds a detailed airframe from a plain spec dict and exports a .glb into
public/models/. One consistent standard for the whole archive so every variant
looks convincing next to the others — the reference quality bar is the original
hand-authored a320.glb (shaped nose/tail, cabin window belt, doors, swept wings
with sharklets/wingtips, tail surfaces, detailed engine nacelles with fan face).

Conventions (match the existing models + the procedural fallback):
  * real-world metres, model centred on world origin
  * nose toward +X, wingspan along Z, up toward +Y
  * export glTF binary with +Y up

Run headless, once per aircraft, e.g.:
    Blender --background --python generate_airframe.py -- <specs.json> <outdir>

`specs.json` is a list of spec dicts (see SPEC SCHEMA below). Keeping the specs
as data (not code) means the same generator produces the A318 up to the A380 by
changing numbers, and smaller test models later can reuse it.

SPEC SCHEMA (all lengths in metres):
  id            output filename stem -> <outdir>/<id>.glb
  length        overall fuselage length
  fuse_dia      fuselage diameter (max)
  wingspan      tip-to-tip incl. wingtip device
  height        overall height (ground to fin tip); only used for fin sizing
  sweep_deg     wing quarter-chord sweep (deg), default 25
  engine_count  2 or 4
  fan_dia       engine fan diameter (nacelle sized from this)
  sharklet      True -> vertical sharklet; False -> raked/blended wingtip
  decks         1 (normal) or 2 (A380 full double deck -> taller fuselage section)
  tail_color    hex for the fin (livery accent)
"""

import bpy
import bmesh
import json
import math
import sys
import os
from mathutils import Vector, Matrix


# --------------------------------------------------------------------------- #
# scene helpers
# --------------------------------------------------------------------------- #
def reset_scene():
    """Empty the file so each aircraft is built in isolation."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgba, metallic=0.2, roughness=0.5):
    """Create (or reuse) a simple principled material."""
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def new_mesh_obj(name, coll=None):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def assign(ob, material):
    ob.data.materials.clear()
    ob.data.materials.append(material)


# --------------------------------------------------------------------------- #
# geometry builders (bmesh)
# --------------------------------------------------------------------------- #
def build_fuselage(spec, materials):
    """
    A lofted fuselage: circular cross-sections along +X, with a tapered/rounded
    nose, a constant-diameter cabin section, and an upswept tapered tail cone.
    For double-deck aircraft the mid cross-section is a taller vertical oval.
    """
    L = spec["length"]
    R = spec["fuse_dia"] / 2.0
    decks = spec.get("decks", 1)

    nose = L * 0.11
    tail = L * 0.24
    x_nose_end = -L / 2 + nose
    x_tail_start = L / 2 - tail

    # station list: (x, radius_scale, vertical_center_offset, vertical_scale)
    stations = []
    # nose: grow from a point
    for i in range(7):
        t = i / 6.0
        x = -L / 2 + nose * t
        rs = math.sin(t * math.pi / 2) ** 0.7  # fast rounded growth
        stations.append((x, rs, 0.0, 1.0))
    # cabin: constant
    ncab = 6
    for i in range(1, ncab + 1):
        t = i / ncab
        x = x_nose_end + (x_tail_start - x_nose_end) * t
        stations.append((x, 1.0, 0.0, 1.0))
    # tail: shrink + upsweep
    for i in range(1, 8):
        t = i / 7.0
        x = x_tail_start + tail * t
        rs = (1.0 - t) ** 0.85 * 0.9 + 0.02
        up = R * 0.55 * (t ** 1.6)  # tail cone rises
        stations.append((x, max(rs, 0.02), up, 1.0 - 0.15 * t))

    seg = 24  # radial resolution
    bm = bmesh.new()
    rings = []
    # vertical ovalisation for double-deck fuselage
    v_scale_deck = 1.32 if decks == 2 else 1.0
    for (x, rs, up, vs) in stations:
        ring = []
        for s in range(seg):
            a = (s / seg) * math.tau
            y = math.sin(a) * R * rs * vs * v_scale_deck + up
            z = math.cos(a) * R * rs
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    # bridge rings
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for s in range(seg):
            s2 = (s + 1) % seg
            bm.faces.new((r0[s], r0[s2], r1[s2], r1[s]))
    # caps
    bmesh.ops.holes_fill(bm, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    ob = new_mesh_obj("Fuselage")
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True
    assign(ob, materials["skin"])
    return ob, dict(nose=nose, tail=tail, R=R, x_nose_end=x_nose_end,
                    x_tail_start=x_tail_start, v_scale_deck=v_scale_deck)


def build_wing(spec, materials, side, fuse):
    """
    One wing: a swept, tapered aerofoil plank as a proper closed solid (top +
    bottom planform skins, LE/TE edges, tip cap), with a wingtip device.

    A wing station is a 4-vertex loop in the order:
      0 = leading edge top, 1 = trailing edge top,
      2 = trailing edge bottom, 3 = leading edge bottom
    """
    L = spec["length"]
    R = fuse["R"]
    span = spec["wingspan"] / 2.0
    sweep = math.radians(spec.get("sweep_deg", 25))
    root_chord = L * 0.20
    tip_chord = L * 0.06
    thick = R * 0.18

    x_le_root = -L * 0.06          # leading edge at root
    z0 = R * 0.72 * side           # start just outside the fuselage
    z1 = span * side
    dx_sweep = math.tan(sweep) * (span - abs(z0))
    y0 = -R * 0.28                 # low-wing: roots sit below the centreline

    def station(z, le_x, chord, t):
        return [
            (le_x, y0 + t / 2, z),            # 0 LE top
            (le_x + chord, y0 + t / 2, z),    # 1 TE top
            (le_x + chord, y0 - t / 2, z),    # 2 TE bottom
            (le_x, y0 - t / 2, z),            # 3 LE bottom
        ]

    tip_le_x = x_le_root + dx_sweep
    root = station(z0, x_le_root, root_chord, thick)
    tip = station(z1, tip_le_x, tip_chord, thick * 0.5)

    bm = bmesh.new()
    rv = [bm.verts.new(v) for v in root]
    tv = [bm.verts.new(v) for v in tip]
    # four spanwise faces: top skin, TE, bottom skin, LE
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((rv[i], rv[j], tv[j], tv[i]))
    bm.faces.new(rv[::-1])   # root cap (buried in fuselage)
    bm.faces.new(tv)         # tip cap
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_mesh_obj(f"Wing_{'R' if side>0 else 'L'}")
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = False
    assign(ob, materials["wing"])

    # wingtip device (sits at the tip LE/TE, rising in +Y)
    tipdev = build_wingtip(spec, materials, side, tip_le_x, tip_chord, z1, thick * 0.5, y0)
    return [ob, tipdev]


def build_wingtip(spec, materials, side, tip_le_x, tip_chord, z_tip, thick, y0):
    sharklet = spec.get("sharklet", True)
    h = tip_chord * (1.6 if sharklet else 0.5)
    bm = bmesh.new()
    if sharklet:
        base = [
            (tip_le_x, y0 + thick / 2, z_tip),
            (tip_le_x + tip_chord, y0 + thick / 2, z_tip),
            (tip_le_x + tip_chord, y0 - thick / 2, z_tip),
            (tip_le_x, y0 - thick / 2, z_tip),
        ]
        top = [
            (tip_le_x + tip_chord * 0.25, y0 + thick * 0.25, z_tip),
            (tip_le_x + tip_chord * 0.85, y0 + thick * 0.25, z_tip),
            (tip_le_x + tip_chord * 0.85, y0 - thick * 0.25, z_tip),
            (tip_le_x + tip_chord * 0.25, y0 - thick * 0.25, z_tip),
        ]
        top = [(x, y + h, z) for (x, y, z) in top]  # rise in +Y
    else:  # raked/blended wingtip: extends outboard + slight rise
        base = [
            (tip_le_x, y0 + thick / 2, z_tip),
            (tip_le_x + tip_chord, y0 + thick / 2, z_tip),
            (tip_le_x + tip_chord, y0 - thick / 2, z_tip),
            (tip_le_x, y0 - thick / 2, z_tip),
        ]
        dz = h * side
        top = [
            (tip_le_x + tip_chord * 0.4, y0 + thick * 0.35, z_tip + dz),
            (tip_le_x + tip_chord * 0.95, y0 + thick * 0.35, z_tip + dz),
            (tip_le_x + tip_chord * 0.95, y0 - thick * 0.35, z_tip + dz),
            (tip_le_x + tip_chord * 0.4, y0 - thick * 0.35, z_tip + dz),
        ]
    bv = [bm.verts.new(v) for v in base]
    tv = [bm.verts.new(v) for v in top]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bv[i], bv[j], tv[j], tv[i]))
    bm.faces.new(tv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_mesh_obj(f"Sharklet_{'R' if side>0 else 'L'}")
    bm.to_mesh(ob.data)
    bm.free()
    assign(ob, materials["sharklet"])
    return ob


def build_tail(spec, materials, fuse):
    """Vertical fin + rudder and horizontal stabiliser at the tail cone."""
    L = spec["length"]
    R = fuse["R"]
    objs = []

    # vertical fin
    fin_root_x = L * 0.30
    fin_chord = L * 0.16
    fin_h = spec["height"] * 0.42
    sweep = L * 0.09
    thick = R * 0.14
    bm = bmesh.new()
    base = [
        (fin_root_x, R * 0.5, thick / 2),
        (fin_root_x + fin_chord, R * 0.5, thick / 2),
        (fin_root_x + fin_chord, R * 0.5, -thick / 2),
        (fin_root_x, R * 0.5, -thick / 2),
    ]
    top = [
        (fin_root_x + sweep, R * 0.5 + fin_h, thick * 0.25),
        (fin_root_x + sweep + fin_chord * 0.45, R * 0.5 + fin_h, thick * 0.25),
        (fin_root_x + sweep + fin_chord * 0.45, R * 0.5 + fin_h, -thick * 0.25),
        (fin_root_x + sweep, R * 0.5 + fin_h, -thick * 0.25),
    ]
    bv = [bm.verts.new(v) for v in base]
    tv = [bm.verts.new(v) for v in top]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bv[i], bv[j], tv[j], tv[i]))
    bm.faces.new(bv[::-1])
    bm.faces.new(tv)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    fin = new_mesh_obj("Fin")
    bm.to_mesh(fin.data)
    bm.free()
    assign(fin, materials["tail"])
    objs.append(fin)

    # horizontal stabiliser (both sides), a mini swept plank
    hspan = spec["wingspan"] * 0.36
    hroot = L * 0.11
    htip = L * 0.04
    hx = L * 0.34
    hy = R * 0.35
    hthick = R * 0.10
    hsweep = L * 0.05
    for side in (-1, 1):
        bm = bmesh.new()
        z0 = 0.0
        z1 = (hspan / 2) * side
        root = [
            (hx, hy + hthick / 2, z0),
            (hx + hroot, hy + hthick / 2, z0),
            (hx + hroot, hy - hthick / 2, z0),
            (hx, hy - hthick / 2, z0),
        ]
        tip = [
            (hx + hsweep, hy + hthick * 0.3, z1),
            (hx + hsweep + htip, hy + hthick * 0.3, z1),
            (hx + hsweep + htip, hy - hthick * 0.3, z1),
            (hx + hsweep, hy - hthick * 0.3, z1),
        ]
        rv = [bm.verts.new(v) for v in root]
        tv = [bm.verts.new(v) for v in tip]
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((rv[i], rv[j], tv[j], tv[i]))
        bm.faces.new(tv)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        hs = new_mesh_obj(f"HStab_{'R' if side>0 else 'L'}")
        bm.to_mesh(hs.data)
        bm.free()
        assign(hs, materials["tail"])
        objs.append(hs)
    return objs


def build_engine(spec, materials, side, index, fuse):
    """A nacelle (tube), intake lip, fan face, and pylon under the wing."""
    L = spec["length"]
    R = fuse["R"]
    span = spec["wingspan"] / 2.0
    fan_r = spec["fan_dia"] / 2.0
    nac_r = fan_r * 1.12
    nac_len = fan_r * 3.2
    engine_count = spec.get("engine_count", 2)

    if engine_count == 4:
        frac = (0.30, 0.52)[index]
    else:
        frac = 0.34
    z = span * frac * side
    # follow the swept wing leading edge so the pod tucks under the wing, then
    # sit the nacelle forward of and below that LE (classic podded engine).
    sweep = math.radians(spec.get("sweep_deg", 25))
    x_le_root = -L * 0.06
    z_root = R * 0.72
    le_x_at_z = x_le_root + math.tan(sweep) * (abs(z) - z_root)
    x = le_x_at_z - nac_len * 0.35        # nacelle centre ahead of the LE
    y = -R * 0.28 - fan_r * 0.95          # below the (low-mounted) wing

    objs = []
    # nacelle body (cylinder along X)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=nac_r, depth=nac_len,
                                        location=(x, y, z),
                                        rotation=(0, math.radians(90), 0))
    nac = bpy.context.active_object
    nac.name = f"Nacelle_{side}_{index}"
    assign(nac, materials["nacelle"])
    objs.append(nac)

    # intake lip ring
    bpy.ops.mesh.primitive_torus_add(major_radius=nac_r * 0.98, minor_radius=nac_r * 0.08,
                                     location=(x - nac_len / 2, y, z),
                                     rotation=(0, math.radians(90), 0))
    lip = bpy.context.active_object
    lip.name = f"Lip_{side}_{index}"
    assign(lip, materials["nacelle"])
    objs.append(lip)

    # fan face (disc)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=fan_r, depth=nac_len * 0.05,
                                        location=(x - nac_len * 0.42, y, z),
                                        rotation=(0, math.radians(90), 0))
    fan = bpy.context.active_object
    fan.name = f"Fan_{side}_{index}"
    assign(fan, materials["fan"])
    objs.append(fan)

    # spinner
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=fan_r * 0.16, radius2=0,
                                    depth=fan_r * 0.5,
                                    location=(x - nac_len * 0.48, y, z),
                                    rotation=(0, math.radians(-90), 0))
    spin = bpy.context.active_object
    spin.name = f"Spinner_{side}_{index}"
    assign(spin, materials["fan"])
    objs.append(spin)

    # pylon connecting nacelle up to the wing — a slim tapered wedge, not a box
    bm = bmesh.new()
    px0 = x - nac_len * 0.15
    px1 = x + nac_len * 0.35
    ytop = -R * 0.55          # meets the wing underside
    ybot = y + nac_r * 0.6    # sits on the nacelle crown
    tw = nac_r * 0.16         # pylon half-thickness
    top = [
        bm.verts.new((px0, ytop, z + tw * 0.6)),
        bm.verts.new((px1, ytop, z + tw * 0.6)),
        bm.verts.new((px1, ytop, z - tw * 0.6)),
        bm.verts.new((px0, ytop, z - tw * 0.6)),
    ]
    bot = [
        bm.verts.new((px0 + nac_len * 0.1, ybot, z + tw)),
        bm.verts.new((px1 - nac_len * 0.05, ybot, z + tw)),
        bm.verts.new((px1 - nac_len * 0.05, ybot, z - tw)),
        bm.verts.new((px0 + nac_len * 0.1, ybot, z - tw)),
    ]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((top[i], top[j], bot[j], bot[i]))
    bm.faces.new(top[::-1])
    bm.faces.new(bot)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    pyl = new_mesh_obj(f"Pylon_{side}_{index}")
    bm.to_mesh(pyl.data)
    bm.free()
    assign(pyl, materials["pylon"])
    objs.append(pyl)
    return objs


def build_windows_doors(spec, materials, fuse):
    """
    Cabin window belt as a thin dark stripe curved onto each side of the skin
    (reads far better than trying to inset dozens of tiny holes), plus a cockpit
    glass wrap. One belt per passenger deck.
    """
    L = spec["length"]
    R = fuse["R"]
    decks = spec.get("decks", 1)
    objs = []
    x0 = fuse["x_nose_end"] + 0.4
    x1 = fuse["x_tail_start"] - 0.4
    win_mat = materials["window"]
    seg = 20
    # belt vertical angle(s): centre of the window row, in radians from top
    belts = [math.radians(74)]          # ~ just above the mid-line
    if decks == 2:
        belts = [math.radians(56), math.radians(92)]  # upper + lower deck
    belt_half = math.radians(4.5)       # belt thickness in angle
    for a_mid in belts:
        for zside in (1, -1):
            bm = bmesh.new()
            top_ring = []
            bot_ring = []
            for i in range(seg + 1):
                xx = x0 + (x1 - x0) * i / seg
                for a, ring in ((a_mid - belt_half, top_ring), (a_mid + belt_half, bot_ring)):
                    y = math.cos(a) * R * 1.002
                    z = math.sin(a) * R * 1.002 * zside
                    ring.append(bm.verts.new((xx, y, z)))
            for i in range(seg):
                bm.faces.new((top_ring[i], top_ring[i + 1], bot_ring[i + 1], bot_ring[i]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            w = new_mesh_obj(f"WindowBelt_{zside}")
            bm.to_mesh(w.data)
            bm.free()
            assign(w, win_mat)
            objs.append(w)
    # cockpit glass wrap near nose
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R * 0.9, location=(fuse["x_nose_end"] - fuse["nose"] * 0.3, R * 0.2, 0))
    ck = bpy.context.active_object
    ck.scale = (0.6, 0.5, 0.78)
    ck.name = "Cockpit_Glass"
    assign(ck, materials["cockpit"])
    objs.append(ck)
    return objs


# --------------------------------------------------------------------------- #
# assemble + export
# --------------------------------------------------------------------------- #
def make_materials(spec):
    tail_rgba = hex_to_rgba(spec.get("tail_color", "#3b82f6"))
    return {
        "skin": mat("Fuselage_Skin", (0.90, 0.92, 0.95, 1), 0.25, 0.45),
        "wing": mat("Wing_Skin", (0.80, 0.83, 0.88, 1), 0.25, 0.5),
        "sharklet": mat("Sharklet", tail_rgba, 0.2, 0.5),
        "tail": mat("Tail_Blue", tail_rgba, 0.2, 0.5),
        "nacelle": mat("AC_Nacelle", (0.60, 0.64, 0.69, 1), 0.6, 0.35),
        "fan": mat("AC_Fan", (0.18, 0.19, 0.21, 1), 0.7, 0.3),
        "pylon": mat("AC_Pylon", (0.55, 0.58, 0.62, 1), 0.4, 0.5),
        "window": mat("Window_Glass", (0.10, 0.13, 0.18, 1), 0.5, 0.2),
        "cockpit": mat("Cockpit_Glass", (0.08, 0.10, 0.14, 1), 0.6, 0.15),
        "belly": mat("Belly_Grey", (0.62, 0.65, 0.69, 1), 0.2, 0.6),
    }


def hex_to_rgba(h):
    h = h.lstrip("#")
    r = int(h[0:2], 16) / 255
    g = int(h[2:4], 16) / 255
    b = int(h[4:6], 16) / 255
    return (r, g, b, 1.0)


def build_aircraft(spec, outdir):
    reset_scene()
    materials = make_materials(spec)

    all_objs = []
    fuse_ob, fuse = build_fuselage(spec, materials)
    all_objs.append(fuse_ob)
    for side in (-1, 1):
        all_objs += build_wing(spec, materials, side, fuse)
    all_objs += build_tail(spec, materials, fuse)
    ec = spec.get("engine_count", 2)
    for side in (-1, 1):
        for idx in range(ec // 2):
            all_objs += build_engine(spec, materials, side, idx, fuse)
    all_objs += build_windows_doors(spec, materials, fuse)

    # select all mesh objects for export
    bpy.ops.object.select_all(action="DESELECT")
    for o in all_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = all_objs[0]

    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f"{spec['id']}.glb")
    # No Draco: keeps the site self-contained (drei's Draco path pulls a decoder
    # from a Google CDN). Files are small enough (~a few hundred KB) uncompressed.
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in all_objs if o.type == "MESH")
    print(f"[OK] {spec['id']}: {len(all_objs)} objs, ~{tris} tris -> {out}")
    return out


def main():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    if len(argv) < 2:
        print("usage: blender --background --python generate_airframe.py -- <specs.json> <outdir>")
        return
    specs_path, outdir = argv[0], argv[1]
    with open(specs_path) as f:
        specs = json.load(f)
    for spec in specs:
        build_aircraft(spec, outdir)


if __name__ == "__main__":
    main()
