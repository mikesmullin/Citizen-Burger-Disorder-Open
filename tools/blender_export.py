"""blender -b --factory-startup --python blender_export.py -- <src.blend> <outdir> <slug>

Writes one .bin per mesh in the same layout fbx.py produces:
float32 [ positions | normals | uvs ], non-indexed triangles.

Coordinates: (x, y, -z), the same as fbx.py — NOT the usual Blender Z-up -> Y-up
swap. Verified empirically: bun-bottom exists as both .blend and .fbx, and the raw
Blender data (x=2.00 y=0.35 z=2.00) already matches the FBX-derived mesh axis for
axis, so these models were authored Y-up. Negating Z reverses winding, so the
triangle corner order is reversed to compensate.
Meshes are ordered by name to match Unity's import order (fileID 4300000 + 2*i).
"""
import bpy, sys, os, json, struct
from mathutils import Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir, slug = argv[0], argv[1], argv[2]

bpy.ops.wm.open_mainfile(filepath=src)
os.makedirs(outdir, exist_ok=True)

objs = sorted([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: o.name)
entries = []
emitted = 0          # only meshes that actually produce geometry get an id

for obj in objs:
    me = obj.data
    try:
        me.calc_loop_triangles()
    except Exception:
        pass
    uv_layer = me.uv_layers.active.data if me.uv_layers.active else None

    # Unity bakes the object's transform into the imported mesh, so apply
    # matrix_world here — otherwise anything rotated or scaled in Blender comes
    # out in the wrong pose (the fire extinguisher ends up lying on its side).
    M = obj.matrix_world
    NM = M.to_3x3().inverted_safe().transposed()

    P, N, T = [], [], []
    for tri in me.loop_triangles:
        for li in reversed(tri.loops):
            loop = me.loops[li]
            v = M @ me.vertices[loop.vertex_index].co
            P.extend((v.x, v.y, -v.z))
            n = (NM @ (loop.normal if tri.use_smooth else tri.normal)).normalized()
            N.extend((n.x, n.y, -n.z))
            if uv_layer:
                uv = uv_layer[li].uv
                T.extend((uv.x, uv.y))
            else:
                T.extend((0.0, 0.0))

    if not P:
        continue
    file_id = 4300000 + 2 * emitted
    base = slug if emitted == 0 else f'{slug}_{emitted + 1}'
    emitted += 1
    buf = bytearray()
    for arr in (P, N, T):
        buf += struct.pack(f'<{len(arr)}f', *arr)
    open(os.path.join(outdir, base + '.bin'), 'wb').write(buf)
    xs = P[0::3]; ys = P[1::3]; zs = P[2::3]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    minz, maxz = min(zs), max(zs)
    sx, sy, sz = maxx-minx, maxy-miny, maxz-minz
    entries.append({'fileId': file_id, 'name': obj.name, 'bin': f'models/{base}.bin',
                    'verts': len(P) // 3, 'tris': len(P) // 9,
                    'hasNormals': True, 'hasUvs': uv_layer is not None,
                    'bounds': {'min': [minx, miny, minz], 'max': [maxx, maxy, maxz]},
                    'size': [sx, sy, sz],
                    'longest': max(sx, sy, sz),
                    'center': [(minx+maxx)/2, (miny+maxy)/2, (minz+maxz)/2]})

print('ENTRIES:' + json.dumps(entries))
