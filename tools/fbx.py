#!/usr/bin/env python3
"""
Minimal reader for ASCII FBX 6100 (what Blender 2.67 wrote in 2014).

Modern Blender refuses these outright ("ASCII FBX files are not supported"), and
they hold the only copy of several meshes (rat, plate, bun-top/bottom), so this
parses them directly.

Emits, per mesh, a flat non-indexed triangle soup:
    <out>.bin   float32  [ positions | normals | uvs ]
plus a JSON descriptor. Non-indexed keeps per-corner normals/UVs correct without
having to weld and re-split vertices.

    python3 fbx.py <file.fbx> <outdir> [slug]
"""
import re, os, sys, json, struct

NUM = re.compile(r'-?\d+\.?\d*(?:[eE][+-]?\d+)?')


def read_blocks(lines, start, end):
    """Yield (key, value_text, body_start, body_end) for entries at this level."""
    depth, i = 0, start
    while i < end:
        ln = lines[i]
        m = re.match(r'^\s*([A-Za-z][\w]*):\s*(.*)$', ln)
        if m and depth == 0:
            key, val = m.group(1), m.group(2)
            if val.rstrip().endswith('{'):
                d, j = 1, i + 1
                while j < end and d:
                    d += lines[j].count('{') - lines[j].count('}')
                    j += 1
                yield key, val, i + 1, j - 1
                i = j
                continue
            # scalar/array: absorb continuation lines beginning with ','
            j, parts = i + 1, [val]
            while j < end and lines[j].lstrip().startswith(','):
                parts.append(lines[j].lstrip())
                j += 1
            yield key, ''.join(parts), i, j
            i = j
            continue
        depth += ln.count('{') - ln.count('}')
        depth = max(depth, 0)
        i += 1


def collect(lines, start, end):
    out = {}
    for key, val, bs, be in read_blocks(lines, start, end):
        out.setdefault(key, []).append((val, bs, be))
    return out


def floats(s):  return [float(x) for x in NUM.findall(s)]
def ints(s):    return [int(float(x)) for x in NUM.findall(s)]


def parse_mesh(lines, bs, be):
    props = collect(lines, bs, be)
    if 'Vertices' not in props or 'PolygonVertexIndex' not in props:
        return None

    verts = floats(props['Vertices'][0][0])
    poly  = ints(props['PolygonVertexIndex'][0][0])

    normals, nmap = None, 'ByVertice'
    if 'LayerElementNormal' in props:
        _, nbs, nbe = props['LayerElementNormal'][0]
        np_ = collect(lines, nbs, nbe)
        if 'Normals' in np_:
            normals = floats(np_['Normals'][0][0])
            if 'MappingInformationType' in np_:
                nmap = np_['MappingInformationType'][0][0].strip().strip('"')

    uvs, uvidx, umap, uref = None, None, 'ByPolygonVertex', 'IndexToDirect'
    if 'LayerElementUV' in props:
        _, ubs, ube = props['LayerElementUV'][0]
        up = collect(lines, ubs, ube)
        if 'UV' in up:
            uvs = floats(up['UV'][0][0])
            if 'UVIndex' in up:
                uvidx = ints(up['UVIndex'][0][0])
            if 'MappingInformationType' in up:
                umap = up['MappingInformationType'][0][0].strip().strip('"')
            if 'ReferenceInformationType' in up:
                uref = up['ReferenceInformationType'][0][0].strip().strip('"')

    P, N, T = [], [], []
    face, corner_base = [], 0          # corner_base = index of face's first corner

    def emit(face_idx, base):
        # Triangle-fan the polygon. Corners are emitted 0, k+1, k rather than
        # 0, k, k+1: negating Z below mirrors the mesh, which reverses winding,
        # so the order is reversed here to put it back.
        for k in range(1, len(face_idx) - 1):
            for a, b in ((0, 0), (k + 1, k + 1), (k, k)):
                vi = face_idx[a]
                corner = base + b
                # FBX/Unity are left-handed, three.js is right-handed: negate Z
                P.extend((verts[3*vi], verts[3*vi+1], -verts[3*vi+2]))
                if normals:
                    src = vi if nmap == 'ByVertice' else corner
                    N.extend((normals[3*src], normals[3*src+1], -normals[3*src+2]))
                if uvs is not None:
                    if umap == 'ByPolygonVertex':
                        ui = uvidx[corner] if (uref == 'IndexToDirect' and uvidx) else corner
                    else:
                        ui = vi
                    if 0 <= 2*ui + 1 < len(uvs):
                        T.extend(uvs[2*ui:2*ui+2])
                    else:
                        T.extend((0.0, 0.0))

    for ci, v in enumerate(poly):
        if v < 0:
            face.append(~v)                 # negative marks the polygon's last corner
            emit(face, corner_base)
            corner_base = ci + 1
            face = []
        else:
            face.append(v)

    return {'positions': P,
            'normals': N if len(N) == len(P) else [],
            'uvs': T if len(T) * 3 == len(P) * 2 else []}


def parse_file(path):
    lines = open(path, encoding='utf-8', errors='replace').read().split('\n')
    meshes = []
    for key, val, bs, be in read_blocks(lines, 0, len(lines)):
        if key != 'Objects':
            continue
        for k2, v2, b2, e2 in read_blocks(lines, bs, be):
            if k2 != 'Model' or '"Mesh"' not in v2:
                continue
            name = re.search(r'Model::([^"]+)"', v2)
            m = parse_mesh(lines, b2, e2)
            if m and m['positions']:
                m['name'] = name.group(1) if name else f'mesh{len(meshes)}'
                meshes.append(m)
    return meshes


def write(meshes, outdir, slug):
    os.makedirs(outdir, exist_ok=True)
    entries = []
    for i, m in enumerate(meshes):
        # Unity numbers model meshes 4300000, 4300002, ... in import order
        file_id = 4300000 + 2 * i
        base = slug if i == 0 else f'{slug}_{i + 1}'
        buf = bytearray()
        for arr in (m['positions'], m['normals'], m['uvs']):
            buf += struct.pack(f'<{len(arr)}f', *arr)
        open(os.path.join(outdir, base + '.bin'), 'wb').write(buf)
        entries.append({'fileId': file_id, 'name': m['name'],
                        'bin': f'models/{base}.bin',
                        'verts': len(m['positions']) // 3,
                        'tris': len(m['positions']) // 9,
                        'hasNormals': bool(m['normals']),
                        'hasUvs': bool(m['uvs'])})
    return entries


if __name__ == '__main__':
    src = sys.argv[1]
    outdir = sys.argv[2] if len(sys.argv) > 2 else 'models'
    slug = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(os.path.basename(src))[0]
    ms = parse_file(src)
    es = write(ms, outdir, slug)
    for e in es:
        print(f"  {e['name']:<18} fileID={e['fileId']:<9} {e['verts']:>6} verts  {e['tris']:>6} tris"
              f"  normals={'y' if e['hasNormals'] else 'n'} uvs={'y' if e['hasUvs'] else 'n'}")
    print(json.dumps(es))
