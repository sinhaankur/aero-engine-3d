"""Export a generated aircraft GLB to a single STL for FluidX3D voxelization.

Usage:
  Blender --background --factory-startup --python cfd/export_stl.py -- \
      <in.glb> <out.stl> [--drop-gear]

Output orientation matches the FluidX3D wind-tunnel convention used in our
setup: nose facing -Y (flow runs along +Y), span on X, Z up, units in metres.
The GLB imports with X=length, Y=height, Z=span but unknown signs, so after
permuting the axes the orientation is verified geometrically: the fin tip
(the extreme point on the height axis) must end up above the fuselage (+Z)
and on the tail side (+Y). Rotations are applied to the mesh data directly —
the glTF importer leaves objects in quaternion rotation mode, where setting
rotation_euler has no effect.
--drop-gear removes landing-gear parts (gear/tyre materials) for a clean
in-flight configuration.
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
drop_gear = "--drop-gear" in argv


def rotate_mesh(ob, axis, degrees):
    ob.data.transform(Matrix.Rotation(math.radians(degrees), 4, axis))


def extents(ob):
    lo = Vector((min(v.co[i] for v in ob.data.vertices) for i in range(3)))
    hi = Vector((max(v.co[i] for v in ob.data.vertices) for i in range(3)))
    return lo, hi


def fin_tip(ob):
    """Vertex farthest from the bbox center along Z, bbox-center-relative."""
    lo, hi = extents(ob)
    center = (lo + hi) / 2.0
    return max((v.co - center for v in ob.data.vertices), key=lambda p: abs(p.z))


for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=src)

meshes = []
for ob in bpy.data.objects:
    if ob.type != "MESH":
        continue
    mats = [s.material.name.lower() for s in ob.material_slots if s.material]
    if drop_gear and any("gear" in m or "tyre" in m for m in mats):
        bpy.data.objects.remove(ob, do_unlink=True)
        continue
    meshes.append(ob)

bpy.ops.object.select_all(action="DESELECT")
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
plane = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# as imported: X = length, Y = height, Z = span (signs unknown);
# permute to X = span, Y = length, Z = height
lo, hi = extents(plane)
d = hi - lo
assert d.x > d.y and d.z > d.y, f"unexpected axis layout: {tuple(d)}"
rotate_mesh(plane, "X", 90)
rotate_mesh(plane, "Z", 90)

tip = fin_tip(plane)
if tip.z < 0:  # fin points down -> roll upright
    rotate_mesh(plane, "Y", 180)
    tip = fin_tip(plane)
if tip.y < 0:  # fin (tail) on -Y -> yaw so the nose faces -Y
    rotate_mesh(plane, "Z", 180)
    tip = fin_tip(plane)

lo, hi = extents(plane)
d = hi - lo
print(f"STL dims [m]: span_x={d.x:.2f} length_y={d.y:.2f} height_z={d.z:.2f}")
print(f"fin tip (rel): y={tip.y:.2f} z={tip.z:.2f} (expect both > 0)")
assert tip.z > 0 and tip.y > 0

bpy.ops.wm.stl_export(filepath=dst, export_selected_objects=True,
                      apply_modifiers=True)
print(f"Wrote {dst}")
