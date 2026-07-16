"""
High-detail parametric airliner GLB generator (headless Blender).

This is the detailed successor to generate_airframe.py. It reads the *same* spec
schema (see that file's header) so it's a drop-in for any variant, but every
component is rebuilt at much higher fidelity for a web viewer:

  * fuselage lofted at 64 radial segments with a finely-stationed nose/tail and a
    smooth cockpit-to-crown transition
  * wings built from real cambered NACA-4 airfoil sections at several spanwise
    stations, with dihedral and washout, plus flap-track fairings and a sharklet
  * individual inset cabin window panes, cockpit windows and cabin doors (real
    geometry, not a painted stripe)
  * detailed engine: lipped intake, hub with curved fan blades, spinner, bypass
    nacelle, exhaust plug + nozzle, and a slim pylon
  * landing gear (nose + two main bogies), belly/wing-root fairing and blade
    antennas

Target: a convincing model that still stays roughly 1-3 MB as GLB (no Draco, to
keep the site self-contained). Triangle budget lands around 60-90k.

Run:
    blender --background --python generate_airframe_hd.py -- <specs.json> <outdir>
"""

import bpy
import bmesh
import json
import math
import sys
import os
from mathutils import Vector

TAU = math.tau


# --------------------------------------------------------------------------- #
# scene + material helpers
# --------------------------------------------------------------------------- #
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgba, metallic=0.2, roughness=0.5):
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
    return ob


def shade_smooth(ob, smooth=True):
    for p in ob.data.polygons:
        p.use_smooth = smooth
    return ob


def hex_to_rgba(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255,
            int(h[4:6], 16) / 255, 1.0)


def make_materials(spec):
    tail_rgba = hex_to_rgba(spec.get("tail_color", "#1f4fb0"))
    return {
        "skin": mat("HD_Fuselage", (0.90, 0.92, 0.95, 1), 0.30, 0.38),
        "wing": mat("HD_Wing", (0.82, 0.85, 0.89, 1), 0.30, 0.45),
        "sharklet": mat("HD_Sharklet", tail_rgba, 0.25, 0.45),
        "tail": mat("HD_Tail", tail_rgba, 0.25, 0.45),
        "nacelle": mat("HD_Nacelle", (0.66, 0.70, 0.74, 1), 0.65, 0.30),
        "cowl_lip": mat("HD_CowlLip", (0.80, 0.82, 0.85, 1), 0.85, 0.18),
        "fan": mat("HD_Fan", (0.20, 0.21, 0.23, 1), 0.75, 0.28),
        "spinner": mat("HD_Spinner", (0.10, 0.10, 0.12, 1), 0.7, 0.3),
        "hot": mat("HD_HotSection", (0.14, 0.14, 0.16, 1), 0.8, 0.35),
        "pylon": mat("HD_Pylon", (0.58, 0.61, 0.65, 1), 0.45, 0.45),
        "window": mat("HD_Window", (0.06, 0.09, 0.13, 1), 0.55, 0.12),
        "cockpit": mat("HD_Cockpit", (0.05, 0.07, 0.10, 1), 0.7, 0.10),
        "door": mat("HD_Door", (0.84, 0.86, 0.89, 1), 0.30, 0.42),
        "gear": mat("HD_Gear", (0.30, 0.31, 0.33, 1), 0.6, 0.4),
        "tyre": mat("HD_Tyre", (0.05, 0.05, 0.06, 1), 0.1, 0.8),
        "hub": mat("HD_Hub", (0.55, 0.57, 0.60, 1), 0.7, 0.35),
        "antenna": mat("HD_Antenna", (0.20, 0.22, 0.26, 1), 0.4, 0.5),
    }


# --------------------------------------------------------------------------- #
# small geometry utilities (bmesh)
# --------------------------------------------------------------------------- #
def loft_rings(bm, rings, closed=True, cap_ends=False):
    """Bridge a list of equal-length vertex rings into a tube."""
    n = len(rings[0])
    for r0, r1 in zip(rings[:-1], rings[1:]):
        for s in range(n if closed else n - 1):
            s2 = (s + 1) % n
            bm.faces.new((r0[s], r0[s2], r1[s2], r1[s]))
    if cap_ends:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(list(rings[-1]))


def obj_from_bm(bm, name, material, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_mesh_obj(name)
    bm.to_mesh(ob.data)
    bm.free()
    assign(ob, material)
    shade_smooth(ob, smooth)
    return ob


def naca4(t_max, n=32):
    """
    Half-thickness distribution of a symmetric NACA-4 airfoil over x in [0,1],
    returned as (x, y_half) pairs from LE to TE. `t_max` is max thickness ratio.
    Cambered sections are approximated by shifting the mean line separately.
    """
    pts = []
    for i in range(n + 1):
        # cosine spacing bunches points at the leading edge where curvature is high
        beta = math.pi * i / n
        x = (1 - math.cos(beta)) / 2
        yt = 5 * t_max * (0.2969 * math.sqrt(x) - 0.1260 * x
                          - 0.3516 * x**2 + 0.2843 * x**3 - 0.1015 * x**4)
        pts.append((x, yt))
    return pts


def airfoil_loop(chord, t_ratio, camber, n=32):
    """
    Closed airfoil outline as ordered (dx, dy) offsets around the section, TE ->
    upper -> LE -> lower -> TE. dx runs 0..chord (LE at 0), dy is vertical.
    """
    half = naca4(t_ratio, n)
    upper, lower = [], []
    for (x, yt) in half:
        yc = camber * (1 - (2 * x - 1) ** 2)   # simple parabolic mean line
        upper.append((x * chord, (yc + yt) * chord))
        lower.append((x * chord, (yc - yt) * chord))
    # upper LE->TE then lower TE->LE, dropping the shared LE/TE duplicates
    loop = upper + list(reversed(lower[1:-1]))
    return loop


# --------------------------------------------------------------------------- #
# fuselage
# --------------------------------------------------------------------------- #
def build_fuselage(spec, materials):
    L = spec["length"]
    R = spec["fuse_dia"] / 2.0
    decks = spec.get("decks", 1)

    # The A380 (double-deck) has a distinctly short, blunt, drooped nose — the
    # full-height cabin starts almost immediately — versus the longer tapered
    # ogive of a single-deck jet. Shape the nose accordingly.
    double_deck = decks == 2
    nose = L * (0.085 if double_deck else 0.115)
    tail = L * 0.235
    x_nose_end = -L / 2 + nose
    x_tail_start = L / 2 - tail

    # blunter growth + more droop for the double-deck nose
    nose_pow = 0.42 if double_deck else 0.62
    droop_amt = 0.24 if double_deck else 0.10

    stations = []  # (x, radius_scale, vertical_center_offset, vertical_scale)
    # nose: rounded ogive growing from a near-point, drooped slightly down
    NN = 26
    for i in range(NN):
        t = i / (NN - 1)
        x = -L / 2 + nose * t
        rs = math.sin(t * math.pi / 2) ** nose_pow
        droop = -R * droop_amt * (1 - t) ** 2   # nose tip sits low
        stations.append((x, rs, droop, 1.0))
    # cabin: constant, finely sampled so window/door cuts land cleanly later
    NC = 30
    for i in range(1, NC + 1):
        t = i / NC
        x = x_nose_end + (x_tail_start - x_nose_end) * t
        stations.append((x, 1.0, 0.0, 1.0))
    # tail: shrink + upsweep toward the fin
    NT = 30
    for i in range(1, NT + 1):
        t = i / NT
        x = x_tail_start + tail * t
        rs = (1.0 - t) ** 0.9 * 0.92 + 0.015
        up = R * 0.62 * (t ** 1.7)
        stations.append((x, max(rs, 0.015), up, 1.0 - 0.12 * t))

    seg = 112
    # real A380 section is ~8.4 m tall × 7.1 m wide -> ~1.18× taller than wide
    v_scale_deck = 1.20 if decks == 2 else 1.0
    bm = bmesh.new()
    rings = []
    for (x, rs, up, vs) in stations:
        ring = []
        for s in range(seg):
            a = (s / seg) * TAU
            y = math.sin(a) * R * rs * vs * v_scale_deck + up
            z = math.cos(a) * R * rs
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    loft_rings(bm, rings, closed=True)
    bmesh.ops.holes_fill(bm, edges=bm.edges)
    ob = obj_from_bm(bm, "Fuselage", materials["skin"], smooth=True)

    return ob, dict(nose=nose, tail=tail, R=R, x_nose_end=x_nose_end,
                    x_tail_start=x_tail_start, v_scale_deck=v_scale_deck,
                    seg=seg)


# --------------------------------------------------------------------------- #
# wing (airfoil sections)
# --------------------------------------------------------------------------- #
def build_wing(spec, materials, side, fuse):
    L = spec["length"]
    R = fuse["R"]
    span = spec["wingspan"] / 2.0
    sweep = math.radians(spec.get("sweep_deg", 25))
    dihedral = math.radians(5.5)

    root_chord = L * 0.26
    x_le_root = -L * 0.045
    z_root = R * 0.86
    y_root = -R * 0.22              # low-wing

    # spanwise stations: (frac_of_span, chord_scale, twist_deg)
    # taper is gentler through mid-span so the planform reads as a real wing,
    # with a distinct inboard trailing-edge kink like the A320's.
    st_defs = [
        (0.00, 1.00, 3.0),
        (0.12, 0.94, 2.4),
        (0.30, 0.72, 1.6),
        (0.55, 0.52, 0.8),
        (0.80, 0.37, -0.2),
        (1.00, 0.26, -1.4),   # washout: tip at lower incidence
    ]

    sections = []
    for (f, cscale, twist) in st_defs:
        z = z_root + (span - z_root) * f
        chord = root_chord * cscale
        t_ratio = 0.128 - 0.045 * f        # thins toward the tip
        camber = 0.020
        le_x = x_le_root + math.tan(sweep) * (z - z_root)
        y = y_root + math.tan(dihedral) * (z - z_root)
        loop = airfoil_loop(chord, t_ratio, camber, n=36)
        tw = math.radians(twist)
        ring = []
        for (dx, dy) in loop:
            # rotate section by twist about its LE, then place in world
            rx = dx * math.cos(tw) - dy * math.sin(tw)
            ry = dx * math.sin(tw) + dy * math.cos(tw)
            ring.append((le_x + rx, y + ry, z * side))
        sections.append(ring)

    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in ring] for ring in sections]
    loft_rings(bm, rings, closed=True)
    bm.faces.new(list(reversed(rings[0])))    # root cap (buried in fuselage)
    bm.faces.new(list(rings[-1]))             # tip cap
    ob = obj_from_bm(bm, f"Wing_{'R' if side > 0 else 'L'}",
                     materials["wing"], smooth=True)

    objs = [ob]
    # sharklet / raked tip at the outboard station
    tip_le = x_le_root + math.tan(sweep) * (span - z_root)
    tip_y = y_root + math.tan(dihedral) * (span - z_root)
    tip_chord = root_chord * 0.28
    objs += build_wingtip(spec, materials, side, tip_le, tip_chord,
                          span * side, R * 0.03, tip_y)
    # a couple of flap-track fairings under the trailing edge
    objs += build_flap_fairings(spec, materials, side, x_le_root, z_root,
                                span, sweep, dihedral, root_chord, y_root, R)
    return objs


def build_wingtip(spec, materials, side, tip_le_x, tip_chord, z_tip, thick, y0):
    sharklet = spec.get("sharklet", True)
    # A320 sharklet stands ~2.4 m; keep it modest relative to tip chord so it
    # reads as a winglet, not a sail.
    h = tip_chord * (0.85 if sharklet else 0.4)
    bm = bmesh.new()
    base = [
        (tip_le_x, y0 + thick, z_tip),
        (tip_le_x + tip_chord, y0 + thick * 0.4, z_tip),
        (tip_le_x + tip_chord, y0 - thick * 0.4, z_tip),
        (tip_le_x, y0 - thick, z_tip),
    ]
    if sharklet:  # near-vertical fin, swept back, tapering
        top = [
            (tip_le_x + tip_chord * 0.30, y0 + thick * 0.3, z_tip),
            (tip_le_x + tip_chord * 0.90, y0 + thick * 0.3, z_tip),
            (tip_le_x + tip_chord * 0.90, y0 - thick * 0.3, z_tip),
            (tip_le_x + tip_chord * 0.30, y0 - thick * 0.3, z_tip),
        ]
        top = [(x + tip_chord * 0.12, y + h, z) for (x, y, z) in top]
    else:  # raked/blended tip extends outboard with a slight rise
        dz = h * side
        top = [
            (tip_le_x + tip_chord * 0.45, y0 + thick * 0.5, z_tip + dz),
            (tip_le_x + tip_chord * 0.98, y0 + thick * 0.5, z_tip + dz),
            (tip_le_x + tip_chord * 0.98, y0 - thick * 0.5, z_tip + dz),
            (tip_le_x + tip_chord * 0.45, y0 - thick * 0.5, z_tip + dz),
        ]
    bv = [bm.verts.new(v) for v in base]
    tv = [bm.verts.new(v) for v in top]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bv[i], bv[j], tv[j], tv[i]))
    bm.faces.new(list(reversed(bv)))
    bm.faces.new(tv)
    return [obj_from_bm(bm, f"Sharklet_{'R' if side > 0 else 'L'}",
                        materials["sharklet"], smooth=False)]


def build_flap_fairings(spec, materials, side, x_le_root, z_root, span,
                        sweep, dihedral, root_chord, y_root, R):
    """Two small canoe fairings under the trailing edge (flap track fairings)."""
    objs = []
    for k, f in enumerate((0.30, 0.55)):
        z = z_root + (span - z_root) * f
        le_x = x_le_root + math.tan(sweep) * (z - z_root)
        chord = root_chord * (0.66 - 0.28 * f)
        te_x = le_x + chord
        y = y_root + math.tan(dihedral) * (z - z_root) - R * 0.06
        length = chord * 0.9
        r = R * 0.09
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=10, radius=r, depth=length,
            location=(te_x - length * 0.1, y, z * side),
            rotation=(0, math.radians(90), 0))
        fr = bpy.context.active_object
        fr.name = f"FlapFairing_{side}_{k}"
        fr.scale = (1.0, 0.7, 0.5)
        # taper the aft end into a point
        assign(fr, materials["wing"])
        shade_smooth(fr, True)
        objs.append(fr)
    return objs


# --------------------------------------------------------------------------- #
# empennage
# --------------------------------------------------------------------------- #
def build_tail(spec, materials, fuse):
    L = spec["length"]
    R = fuse["R"]
    objs = []

    # vertical fin as a swept airfoil plank
    fin_root_x = L * 0.30
    fin_chord = L * 0.155
    fin_h = spec["height"] * 0.44
    fin_sweep = L * 0.10
    y_base = R * 0.5

    def fin_section(y, le_x, chord, t):
        loop = airfoil_loop(chord, t, 0.0, n=12)
        return [(le_x + dx, y, dy) for (dx, dy) in loop]

    root = fin_section(y_base, fin_root_x, fin_chord, 0.11)
    tip = fin_section(y_base + fin_h, fin_root_x + fin_sweep,
                      fin_chord * 0.46, 0.09)
    bm = bmesh.new()
    rr = [bm.verts.new(p) for p in root]
    tr = [bm.verts.new(p) for p in tip]
    loft_rings(bm, [rr, tr], closed=True)
    bm.faces.new(list(reversed(rr)))
    bm.faces.new(tr)
    objs.append(obj_from_bm(bm, "Fin", materials["tail"], smooth=True))

    # horizontal stabiliser: swept airfoil planks both sides
    hspan = spec["wingspan"] * 0.37
    hroot = L * 0.105
    hx = L * 0.335
    hy = R * 0.34
    hsweep = L * 0.055
    for side in (-1, 1):
        def hs_section(z, le_x, chord, t):
            loop = airfoil_loop(chord, t, 0.0, n=10)
            return [(le_x + dx, hy + dy, z) for (dx, dy) in loop]
        r = hs_section(0.0, hx, hroot, 0.10)
        tp = hs_section((hspan / 2) * side, hx + hsweep, hroot * 0.4, 0.08)
        bm = bmesh.new()
        rr = [bm.verts.new(p) for p in r]
        tr = [bm.verts.new(p) for p in tp]
        loft_rings(bm, [rr, tr], closed=True)
        bm.faces.new(list(reversed(rr)))
        bm.faces.new(tr)
        objs.append(obj_from_bm(bm, f"HStab_{'R' if side > 0 else 'L'}",
                                materials["tail"], smooth=True))
    return objs


# --------------------------------------------------------------------------- #
# engine (detailed turbofan pod)
# --------------------------------------------------------------------------- #
def build_engine(spec, materials, side, index, fuse):
    L = spec["length"]
    R = fuse["R"]
    span = spec["wingspan"] / 2.0
    fan_r = spec["fan_dia"] / 2.0
    nac_r = fan_r * 1.14
    nac_len = fan_r * 3.4
    engine_count = spec.get("engine_count", 2)

    frac = (0.31, 0.53)[index] if engine_count == 4 else 0.35
    z = span * frac * side
    sweep = math.radians(spec.get("sweep_deg", 25))
    x_le_root = -L * 0.055
    z_root = R * 0.70
    le_x_at_z = x_le_root + math.tan(sweep) * (abs(z) - z_root)
    x = le_x_at_z - nac_len * 0.42
    y = -R * 0.26 - fan_r * 1.0

    objs = []
    x_front = x - nac_len / 2
    x_back = x + nac_len / 2

    # ---- nacelle cowl: lofted profile (intake lip -> belly -> exhaust taper) ----
    prof = [
        (x_front, nac_r * 0.82),
        (x_front + nac_len * 0.04, nac_r * 0.99),
        (x_front + nac_len * 0.10, nac_r * 1.00),
        (x_front + nac_len * 0.45, nac_r * 0.98),
        (x_front + nac_len * 0.72, nac_r * 0.88),
        (x_back - nac_len * 0.06, nac_r * 0.70),
        (x_back, nac_r * 0.60),
    ]
    seg = 56
    bm = bmesh.new()
    rings = []
    for (px, pr) in prof:
        ring = []
        for s in range(seg):
            a = (s / seg) * TAU
            ring.append(bm.verts.new((px, y + math.sin(a) * pr,
                                      z + math.cos(a) * pr)))
        rings.append(ring)
    loft_rings(bm, rings, closed=True)
    objs.append(obj_from_bm(bm, f"Nacelle_{side}_{index}",
                            materials["nacelle"], smooth=True))

    # ---- intake lip ring (chrome) ----
    bpy.ops.mesh.primitive_torus_add(
        major_radius=nac_r * 0.90, minor_radius=nac_r * 0.10,
        location=(x_front + nac_len * 0.02, y, z),
        rotation=(0, math.radians(90), 0))
    lip = bpy.context.active_object
    lip.name = f"CowlLip_{side}_{index}"
    assign(lip, materials["cowl_lip"])
    shade_smooth(lip, True)
    objs.append(lip)

    # ---- fan hub ----
    hub_x = x_front + nac_len * 0.20
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=20, radius=fan_r * 0.22, depth=nac_len * 0.12,
        location=(hub_x, y, z), rotation=(0, math.radians(90), 0))
    hub = bpy.context.active_object
    hub.name = f"FanHub_{side}_{index}"
    assign(hub, materials["hub"])
    shade_smooth(hub, True)
    objs.append(hub)

    # ---- curved fan blades ----
    # Each blade is a solid twisted aerofoil swept from root to tip over several
    # radial stations, with progressive twist and a chordwise camber so it reads
    # as a real wide-chord fan blade, not a flat card.
    n_blades = 22
    r0, r1 = fan_r * 0.24, fan_r * 0.98
    nrad = 5                              # radial stations along the blade
    bm = bmesh.new()
    for b in range(n_blades):
        ang0 = (b / n_blades) * TAU
        loops = []                       # one cross-section loop per radial station
        for ri in range(nrad):
            rt = ri / (nrad - 1)
            rr = r0 + (r1 - r0) * rt
            chord = fan_r * (0.30 - 0.12 * rt)          # tapers toward the tip
            thick = fan_r * (0.05 - 0.03 * rt)
            twist = math.radians(34) * (1 - rt) ** 0.8  # more twist at the root
            # sweep the blade slightly around the disc as it rises (curved look)
            ang = ang0 + math.radians(16) * rt
            ca, sa = math.cos(ang), math.sin(ang)
            # 4-vertex aerofoil box in (axial x, tangential) rotated by twist
            box = [(-chord / 2, thick / 2), (chord / 2, thick / 2 * 0.5),
                   (chord / 2, -thick / 2 * 0.5), (-chord / 2, -thick / 2)]
            loop = []
            for (cx, ct) in box:
                # twist rotates chord vs. axial
                ax = cx * math.cos(twist) - ct * math.sin(twist)
                tg = cx * math.sin(twist) + ct * math.cos(twist)
                yy = y + (rr) * sa + tg * ca
                zz = z + (rr) * ca - tg * sa
                loop.append(bm.verts.new((hub_x + ax, yy, zz)))
            loops.append(loop)
        # bridge consecutive station loops into a solid blade
        for l0, l1 in zip(loops[:-1], loops[1:]):
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new((l0[i], l0[j], l1[j], l1[i]))
        bm.faces.new(list(reversed(loops[0])))   # root cap
        bm.faces.new(list(loops[-1]))            # tip cap
    blades = obj_from_bm(bm, f"FanBlades_{side}_{index}",
                         materials["fan"], smooth=True)
    objs.append(blades)

    # ---- spinner (pointed cone) ----
    bpy.ops.mesh.primitive_cone_add(
        vertices=18, radius1=fan_r * 0.22, radius2=0, depth=fan_r * 0.55,
        location=(hub_x - nac_len * 0.12, y, z),
        rotation=(0, math.radians(-90), 0))
    spin = bpy.context.active_object
    spin.name = f"Spinner_{side}_{index}"
    assign(spin, materials["spinner"])
    shade_smooth(spin, True)
    objs.append(spin)

    # ---- exhaust plug (hot cone poking out the back) ----
    bpy.ops.mesh.primitive_cone_add(
        vertices=18, radius1=fan_r * 0.40, radius2=fan_r * 0.12,
        depth=nac_len * 0.30,
        location=(x_back + nac_len * 0.02, y, z),
        rotation=(0, math.radians(90), 0))
    plug = bpy.context.active_object
    plug.name = f"ExhaustPlug_{side}_{index}"
    assign(plug, materials["hot"])
    shade_smooth(plug, True)
    objs.append(plug)

    # ---- pylon: slim tapered wedge up to the wing ----
    bm = bmesh.new()
    px0 = x - nac_len * 0.10
    px1 = x + nac_len * 0.40
    ytop = -R * 0.52
    ybot = y + nac_r * 0.55
    tw = nac_r * 0.14
    top = [bm.verts.new(p) for p in [
        (px0, ytop, z + tw * 0.6), (px1, ytop, z + tw * 0.6),
        (px1, ytop, z - tw * 0.6), (px0, ytop, z - tw * 0.6)]]
    bot = [bm.verts.new(p) for p in [
        (px0 + nac_len * 0.08, ybot, z + tw), (px1 - nac_len * 0.04, ybot, z + tw),
        (px1 - nac_len * 0.04, ybot, z - tw), (px0 + nac_len * 0.08, ybot, z - tw)]]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((top[i], top[j], bot[j], bot[i]))
    bm.faces.new(list(reversed(top)))
    bm.faces.new(bot)
    objs.append(obj_from_bm(bm, f"Pylon_{side}_{index}",
                            materials["pylon"], smooth=False))
    return objs


# --------------------------------------------------------------------------- #
# windows, cockpit, doors
# --------------------------------------------------------------------------- #
def build_windows_doors(spec, materials, fuse):
    L = spec["length"]
    R = fuse["R"]
    decks = spec.get("decks", 1)
    # The fuselage cross-section is vertically stretched for double-deck aircraft;
    # window/door panels must follow the same stretch or they sink into the skin.
    vsd = fuse["v_scale_deck"]
    objs = []
    x0 = fuse["x_nose_end"] + R * 0.6
    x1 = fuse["x_tail_start"] - R * 0.4
    pitch = 0.53                                   # ~seat pitch between windows
    n_win = max(6, int((x1 - x0) / pitch))
    win_w = 0.26
    win_h = 0.34

    belts = [math.radians(70)]
    if decks == 2:
        # upper + lower deck belts, angles chosen for the taller oval section
        belts = [math.radians(58), math.radians(86)]

    win_mat = materials["window"]
    for a_mid in belts:
        for zside in (1, -1):
            bm = bmesh.new()
            for i in range(n_win):
                xx = x0 + (x1 - x0) * i / (n_win - 1)
                half_a = (win_h / 2) / R
                half_x = win_w / 2
                corners = []
                for (da, dx) in ((-half_a, -half_x), (half_a, -half_x),
                                 (half_a, half_x), (-half_a, half_x)):
                    aa = a_mid + da          # belt is mirrored to each side via zside
                    y = math.cos(aa) * R * vsd * 1.004
                    z = math.sin(aa) * R * 1.004 * zside
                    corners.append(bm.verts.new((xx + dx, y, z)))
                bm.faces.new(corners)
            w = obj_from_bm(bm, f"Windows_{zside}_{int(math.degrees(a_mid))}",
                            win_mat, smooth=False)
            objs.append(w)

    # ---- cockpit windows: a few angled panes near the nose ----
    ck_x = fuse["x_nose_end"] - fuse["nose"] * 0.28
    for zside in (1, -1):
        bm = bmesh.new()
        for k, a_mid in enumerate((math.radians(52), math.radians(66))):
            half_a = math.radians(7)
            corners = []
            for (da, dx) in ((-half_a, -0.34), (half_a, -0.30),
                             (half_a, 0.30), (-half_a, 0.34)):
                aa = a_mid + da
                y = math.cos(aa) * R * vsd * 1.005 + R * 0.12
                z = math.sin(aa) * R * 1.0 * zside
                corners.append(bm.verts.new((ck_x + dx, y, z)))
            bm.faces.new(corners)
        objs.append(obj_from_bm(bm, f"Cockpit_{zside}",
                                materials["cockpit"], smooth=False))

    # ---- cabin doors: raised outline panels fore/aft each side ----
    door_frac = (0.14, 0.30, 0.74, 0.90)
    for zside in (1, -1):
        for k, df in enumerate(door_frac):
            xx = x0 + (x1 - x0) * df
            a_mid = math.radians(78)
            bm = bmesh.new()
            half_a = (0.9 / 2) / R
            half_x = 0.42
            corners = []
            for (da, dx) in ((-half_a, -half_x), (half_a, -half_x),
                             (half_a, half_x), (-half_a, half_x)):
                aa = a_mid + da
                y = math.cos(aa) * R * vsd * 1.003
                z = math.sin(aa) * R * 1.003 * zside
                corners.append(bm.verts.new((xx + dx, y, z)))
            bm.faces.new(corners)
            objs.append(obj_from_bm(bm, f"Door_{zside}_{k}",
                                    materials["door"], smooth=False))
    return objs


# --------------------------------------------------------------------------- #
# landing gear, fairings, antennas
# --------------------------------------------------------------------------- #
def build_gear_and_details(spec, materials, fuse):
    L = spec["length"]
    R = fuse["R"]
    vsd = fuse["v_scale_deck"]
    Rv = R * vsd                  # vertical half-height of the (possibly oval) section
    objs = []
    ground_y = -Rv - R * 0.62     # wheels sit here below the belly

    def strut(x, z, top_y, bot_y, r):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=10, radius=r, depth=(top_y - bot_y),
            location=(x, (top_y + bot_y) / 2, z))
        s = bpy.context.active_object
        assign(s, materials["gear"])
        shade_smooth(s, True)
        return s

    def wheel(x, z, y, r):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16, radius=r, depth=r * 0.7,
            location=(x, y, z), rotation=(math.radians(90), 0, 0))
        w = bpy.context.active_object
        assign(w, materials["tyre"])
        shade_smooth(w, True)
        return w

    # nose gear
    nx = fuse["x_nose_end"] + R * 0.2
    nr = R * 0.16
    objs.append(strut(nx, 0, -Rv * 0.55, ground_y + nr, R * 0.05))
    for dz in (-nr * 0.9, nr * 0.9):
        objs.append(wheel(nx, dz, ground_y + nr, nr))

    # main gear: two bogies just aft of the wing box, one per side
    mx = -L * 0.02
    mr = R * 0.20
    for side in (-1, 1):
        mz = R * 0.55 * side
        objs.append(strut(mx, mz, -Rv * 0.30, ground_y + mr, R * 0.07))
        # 2-wheel bogie
        for dx in (-mr * 0.9, mr * 0.9):
            objs.append(wheel(mx + dx, mz, ground_y + mr, mr))

    # belly / wing-root fairing (smooth blister under the wing box) — a low,
    # elongated blister that hugs the belly rather than a big hanging pod.
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=R * 0.5, location=(-L * 0.02, -Rv * 0.78, 0))
    belly = bpy.context.active_object
    belly.scale = (3.0, 0.42, 1.35)
    belly.name = "BellyFairing"
    assign(belly, materials["skin"])
    shade_smooth(belly, True)
    objs.append(belly)

    # blade antennas: dorsal + ventral (follow the stretched section top/bottom)
    for (ax, ay, sc, nm) in ((L * 0.06, Rv * 1.0, 1.0, "AntTop"),
                             (-L * 0.12, Rv * 1.0, 0.8, "AntTop2"),
                             (L * 0.10, -Rv * 1.0, 0.7, "AntBot")):
        bm = bmesh.new()
        s = 0.5 * sc
        base_y = ay
        tip_y = ay + (0.6 * sc if ay > 0 else -0.5 * sc)
        v = [bm.verts.new(p) for p in [
            (ax - s, base_y, 0.02), (ax + s * 0.4, base_y, 0.02),
            (ax + s * 0.1, tip_y, 0.0), (ax - s * 0.2, tip_y, 0.0)]]
        bm.faces.new(v)
        objs.append(obj_from_bm(bm, nm, materials["antenna"], smooth=False))

    # APU exhaust nub at the tail tip
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=R * 0.14, radius2=R * 0.08, depth=R * 0.4,
        location=(L / 2 - R * 0.05, R * 0.62, 0),
        rotation=(0, math.radians(90), 0))
    apu = bpy.context.active_object
    apu.name = "APU_Exhaust"
    assign(apu, materials["hot"])
    shade_smooth(apu, True)
    objs.append(apu)
    return objs


# --------------------------------------------------------------------------- #
# assemble + export
# --------------------------------------------------------------------------- #
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
    all_objs += build_gear_and_details(spec, materials, fuse)

    bpy.ops.object.select_all(action="DESELECT")
    for o in all_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = all_objs[0]

    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f"{spec['id']}.glb")
    bpy.ops.export_scene.gltf(
        filepath=out, export_format="GLB",
        use_selection=True, export_apply=True, export_yup=True)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in all_objs if o.type == "MESH")
    size_kb = os.path.getsize(out) / 1024
    print(f"[OK] {spec['id']}: {len(all_objs)} objs, ~{tris} tris, "
          f"{size_kb:.0f} KB -> {out}")
    return out


def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    if len(argv) < 2:
        print("usage: blender --background --python generate_airframe_hd.py "
              "-- <specs.json> <outdir>")
        return
    specs_path, outdir = argv[0], argv[1]
    with open(specs_path) as f:
        specs = json.load(f)
    for spec in specs:
        build_aircraft(spec, outdir)


if __name__ == "__main__":
    main()
