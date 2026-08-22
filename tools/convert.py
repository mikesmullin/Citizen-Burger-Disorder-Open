#!/usr/bin/env python3
"""
Unity 5 YAML scene -> three.js JSON.

PoC scope: Transform hierarchy, MeshFilter/MeshRenderer, Light, Camera.
Coordinate conversion Unity (left-handed, Z-forward) -> three.js (right-handed, Z-back):
    position   (x, y, -z)
    quaternion (-x, -y, z, w)      # conjugation by diag(1,1,-1)
    scale       unchanged
Per-node conversion composes correctly through the hierarchy because the
Z-flip M satisfies M(T1*T2)M = (M T1 M)(M T2 M) and commutes with axis scale.
"""
import re, os, json, sys

from paths import PUBLIC, ASSETS, proj, slug_from_rel, scene_json

PROJ  = proj()
ARG   = sys.argv[1] if len(sys.argv) > 1 else 'House'
# accept a bare scene name, or any path under Assets/ (prefabs included)
if os.path.exists(os.path.join(PROJ, ARG)):
    SCENE = os.path.join(PROJ, ARG)
elif os.path.exists(os.path.join(PROJ, 'Assets', ARG)):
    SCENE = os.path.join(PROJ, 'Assets', ARG)
else:
    SCENE = os.path.join(PROJ, f'Assets/{ARG}.unity')
# Name outputs from the path, not the basename: 3 prefab basenames collide
# (Cheese, Node, Sparks) and flattening them silently drops files - the exact
# mistake that wrecked the first cbe2 extraction.
rel = os.path.relpath(SCENE, os.path.join(PROJ, 'Assets'))
NAME = slug_from_rel(rel)
OUT  = sys.argv[2] if len(sys.argv) > 2 else scene_json(NAME)
TEXDIR = os.path.join(ASSETS, 'textures')

# Unity built-in primitive mesh fileIDs (in unity_builtin_extra / default resources)
PRIMITIVES = {'10202': 'Cube', '10205': 'Capsule', '10206': 'Cylinder', '10207': 'Sphere',
              '10208': 'Capsule', '10209': 'Plane', '10210': 'Quad'}
BUILTIN_GUIDS = {'0000000000000000e000000000000000',
                 '0000000000000000f000000000000000',
                 '0000000000000000d000000000000000'}

# ---------- tiny Unity-YAML reader ----------------------------------------
VEC = re.compile(r'\{x:\s*(-?[\d.eE+-]+),\s*y:\s*(-?[\d.eE+-]+),\s*z:\s*(-?[\d.eE+-]+)'
                 r'(?:,\s*w:\s*(-?[\d.eE+-]+))?\}')
PTR = re.compile(r'\{fileID:\s*(-?\d+)(?:,\s*guid:\s*([0-9a-f]{32}))?')

def read_docs(path):
    """Yield (classId, fileId, typeName, body) for each Unity YAML document."""
    txt = open(path, encoding='utf-8', errors='replace').read()
    parts = re.split(r'^--- !u!(\d+) &(-?\d+).*$', txt, flags=re.M)
    for i in range(1, len(parts), 3):
        cid, fid, body = parts[i], parts[i+1], parts[i+2]
        m = re.match(r'\s*([A-Za-z_]+):', body)
        yield cid, fid, (m.group(1) if m else '?'), body

def vec(body, key, default=(0.0, 0.0, 0.0, 1.0)):
    m = re.search(re.escape(key) + r':\s*' + VEC.pattern, body)
    if not m:
        return default
    g = m.groups()
    return (float(g[0]), float(g[1]), float(g[2]),
            float(g[3]) if g[3] is not None else 1.0)

COL = re.compile(r'\{r:\s*(-?[\d.eE+-]+),\s*g:\s*(-?[\d.eE+-]+),'
                 r'\s*b:\s*(-?[\d.eE+-]+),\s*a:\s*(-?[\d.eE+-]+)\}')

def col(body, key, default=(1.0, 1.0, 1.0, 1.0)):
    m = re.search(re.escape(key) + r':\s*' + COL.pattern, body)
    return tuple(float(g) for g in m.groups()) if m else default

def vec2(body, key, default=(0.0, 0.0)):
    m = re.search(re.escape(key) + r':\s*\{x:\s*(-?[\d.eE+-]+),\s*y:\s*(-?[\d.eE+-]+)\}', body)
    return (float(m.group(1)), float(m.group(2))) if m else default

def ptr(body, key):
    m = re.search(re.escape(key) + r':\s*' + PTR.pattern, body)
    return (m.group(1), m.group(2)) if m else (None, None)

def scalar(body, key, cast=str, default=None):
    m = re.search(r'^\s*' + re.escape(key) + r':\s*(.+?)\s*$', body, re.M)
    if not m:
        return default
    try:    return cast(m.group(1))
    except Exception: return default

# ---------- guid -> asset path (for materials) ------------------------------
def build_guid_map(root):
    g2p = {}
    for dirpath, _, files in os.walk(os.path.join(root, 'Assets')):
        for f in files:
            if not f.endswith('.meta'):
                continue
            p = os.path.join(dirpath, f)
            try: head = open(p, encoding='utf-8', errors='replace').read(400)
            except Exception: continue
            m = re.search(r'^guid:\s*([0-9a-f]{32})', head, re.M)
            if m: g2p[m.group(1)] = p[:-5]
    return g2p

_tex_cache = {}

def texture_avg(path):
    """These dev textures are flat colours; their mean IS the material colour."""
    if path in _tex_cache: return _tex_cache[path]
    rgb = None
    try:
        from PIL import Image
        import numpy as np
        with Image.open(path) as im:
            a = np.asarray(im.convert('RGB'), dtype=float) / 255.0
            rgb = [round(float(v), 4) for v in a.reshape(-1, 3).mean(axis=0)]
    except Exception:
        pass
    _tex_cache[path] = rgb
    return rgb

def srgb_to_linear(c):
    return [round(v ** 2.2, 4) for v in c]

def material_info(path, guid_map):
    """Unity legacy albedo = _Color tint * _MainTex.
    Returns (tint, avg, alpha, texture_url) all in linear space; the viewer uses
    `tex` as a map when present and falls back to tint*avg when it is not."""
    try: txt = open(path, encoding='utf-8', errors='replace').read()
    except Exception: return [1, 1, 1], [1, 1, 1], 1.0, None
    m = re.search(r'- _Color:\s*' + COL.pattern, txt)
    tint = [float(x) for x in m.groups()[:3]] if m else [1.0, 1.0, 1.0]
    alpha = float(m.group(4)) if m else 1.0

    avg, url = [1.0, 1.0, 1.0], None
    t = re.search(r'- _MainTex:\s*\n\s*m_Texture:\s*' + PTR.pattern, txt)
    if t and t.group(2):
        tp = guid_map.get(t.group(2))
        if tp and os.path.exists(tp):
            a = texture_avg(tp)
            if a: avg = a
            url = export_sprite(t.group(2))
    return srgb_to_linear(tint), srgb_to_linear(avg), alpha, url

guid_map = build_guid_map(PROJ)

# ---------- parse the scene -------------------------------------------------
gameobjects, transforms, filters, renderers, lights, cameras = {}, {}, {}, {}, {}, {}
rects, canvases, uigraphics, skinned = {}, {}, {}, {}

for cid, fid, tname, body in read_docs(SCENE):
    if   tname == 'GameObject':
        gameobjects[fid] = {'name': scalar(body, 'm_Name', str, ''),
                            'active': scalar(body, 'm_IsActive', int, 1)}
    elif tname == 'Transform':
        transforms[fid] = {
            'go':     ptr(body, 'm_GameObject')[0],
            'pos':    vec(body, 'm_LocalPosition'),
            'rot':    vec(body, 'm_LocalRotation'),
            'scale':  vec(body, 'm_LocalScale', (1.0, 1.0, 1.0, 1.0)),
            'father': ptr(body, 'm_Father')[0],
        }
    elif tname == 'RectTransform':
        transforms[fid] = {
            'go':     ptr(body, 'm_GameObject')[0],
            'pos':    vec(body, 'm_LocalPosition'),
            'rot':    vec(body, 'm_LocalRotation'),
            'scale':  vec(body, 'm_LocalScale', (1.0, 1.0, 1.0, 1.0)),
            'father': ptr(body, 'm_Father')[0],
        }
        rects[fid] = {
            'anchorMin': vec2(body, 'm_AnchorMin'),
            'anchorMax': vec2(body, 'm_AnchorMax'),
            'anchored':  vec2(body, 'm_AnchoredPosition'),
            'sizeDelta': vec2(body, 'm_SizeDelta'),
            'pivot':     vec2(body, 'm_Pivot', (0.5, 0.5)),
        }
    elif tname == 'Canvas':
        canvases[ptr(body, 'm_GameObject')[0]] = {
            'renderMode': scalar(body, 'm_RenderMode', int, 0)}
    elif tname == 'MonoBehaviour' and ('m_Sprite:' in body or 'm_Text:' in body):
        c = col(body, 'm_Color')
        uigraphics[ptr(body, 'm_GameObject')[0]] = {
            'sprite': ptr(body, 'm_Sprite')[1],
            'color':  list(c[:3]),
            'alpha':  c[3],
            'text':   scalar(body, 'm_Text', str, None)}
    elif tname == 'MeshFilter':
        filters[ptr(body, 'm_GameObject')[0]] = ptr(body, 'm_Mesh')
    elif tname == 'MeshRenderer':
        mats = re.findall(r'-\s*' + PTR.pattern, body.split('m_Materials:')[1]) \
               if 'm_Materials:' in body else []
        renderers[ptr(body, 'm_GameObject')[0]] = {
            'mats': mats,
            'enabled': scalar(body, 'm_Enabled', int, 1)}
    elif tname == 'SkinnedMeshRenderer':
        # carries its mesh inline instead of via a MeshFilter; rendered in bind
        # pose here, which is the correct closed shape for the shipping boxes
        mats_ = re.findall(r'-\s*' + PTR.pattern, body.split('m_Materials:')[1]) \
                if 'm_Materials:' in body else []
        skinned[ptr(body, 'm_GameObject')[0]] = {
            'mesh': ptr(body, 'm_Mesh'),
            'mats': mats_,
            'enabled': scalar(body, 'm_Enabled', int, 1)}
    elif tname == 'Light':
        lights[ptr(body, 'm_GameObject')[0]] = {
            'type': scalar(body, 'm_Type', int, 1),
            'color': list(col(body, 'm_Color')[:3]),
            'intensity': scalar(body, 'm_Intensity', float, 1.0),
            'range': scalar(body, 'm_Range', float, 10.0)}
    elif tname == 'Camera':
        cameras[ptr(body, 'm_GameObject')[0]] = {
            'fov': scalar(body, 'field of view', float, 60.0),
            'near': scalar(body, 'near clip plane', float, 0.3),
            'far': scalar(body, 'far clip plane', float, 1000.0)}

# material palette, deduped by guid
materials, mat_index = [], {}
def mat_id(guid):
    if guid is None: return -1
    if guid not in mat_index:
        path = guid_map.get(guid)
        if path and path.endswith('.mat'):
            tint, avg, alpha, url = material_info(path, guid_map)
            name = os.path.splitext(os.path.basename(path))[0]
        else:
            tint, avg, alpha, url, name = [0.8]*3, [1.0]*3, 1.0, None, 'unknown'
        mat_index[guid] = len(materials)
        materials.append({'name': name, 'tint': tint, 'avg': avg,
                          'opacity': alpha, 'tex': url})
    return mat_index[guid]

# ---------- RectTransform layout -------------------------------------------
# Child RectTransforms serialise m_LocalPosition as ~0; the real layout lives in
# m_AnchoredPosition + anchors, so it has to be recomputed.
def rect_size(fid, _memo={}):
    if fid in _memo: return _memo[fid]
    r = rects[fid]
    amin, amax, sd = r['anchorMin'], r['anchorMax'], r['sizeDelta']
    father = transforms[fid]['father']
    if father in rects:
        pw, ph = rect_size(father)
    else:
        pw, ph = 0.0, 0.0
    size = ((amax[0] - amin[0]) * pw + sd[0],
            (amax[1] - amin[1]) * ph + sd[1])
    _memo[fid] = size
    return size

def rect_local_xy(fid):
    """Pivot position relative to the parent rect's centre."""
    r = rects[fid]
    father = transforms[fid]['father']
    if father not in rects:
        return None                        # root canvas: use m_LocalPosition
    pw, ph = rect_size(father)
    amin, amax, ap = r['anchorMin'], r['anchorMax'], r['anchored']
    ax = (amin[0] + amax[0]) / 2.0
    ay = (amin[1] + amax[1]) / 2.0
    return (ap[0] + (ax - 0.5) * pw,
            ap[1] + (ay - 0.5) * ph)

# ---------- sprite export ---------------------------------------------------
os.makedirs(TEXDIR, exist_ok=True)
_exported = {}
def export_sprite(guid):
    if guid in _exported: return _exported[guid]
    src = guid_map.get(guid)
    if not src or not os.path.exists(src) or not src.lower().endswith(('.png', '.tga', '.tif', '.tiff', '.jpg', '.psd')):
        _exported[guid] = None
        return None
    name = re.sub(r'[^A-Za-z0-9_.-]', '_', os.path.splitext(os.path.basename(src))[0]) + '.png'
    dst = os.path.join(TEXDIR, name)
    try:
        from PIL import Image
        with Image.open(src) as im:
            im.convert('RGBA').save(dst)
        _exported[guid] = f'textures/{name}'
    except Exception:
        _exported[guid] = None
    return _exported[guid]

# ---------- emit nodes ------------------------------------------------------
nodes = []
for fid, t in transforms.items():
    go = gameobjects.get(t['go'], {})
    px, py, pz, _ = t['pos']
    rx, ry, rz, rw = t['rot']
    sx, sy, sz, _ = t['scale']

    if fid in rects:
        xy = rect_local_xy(fid)
        if xy is not None:
            px, py = xy                      # anchor-derived; z stays from m_LocalPosition

    node = {
        'id': fid,
        'name': go.get('name', ''),
        'active': go.get('active', 1),
        'parent': t['father'] if t['father'] and t['father'] != '0' else None,
        # Unity -> three.js
        'pos':   [px, py, -pz],
        'quat':  [-rx, -ry, rz, rw],
        'scale': [sx, sy, sz],
    }

    if fid in rects:
        w, h = rect_size(fid)
        node['rect'] = [round(w, 4), round(h, 4)]
        node['pivot'] = list(rects[fid]['pivot'])
        if t['go'] in canvases:
            node['canvas'] = canvases[t['go']]['renderMode']   # 2 = world space
        g = uigraphics.get(t['go'])
        if g:
            node['ui'] = {'color': srgb_to_linear(g['color']), 'alpha': g['alpha'],
                          'tex': export_sprite(g['sprite']) if g['sprite'] else None,
                          'text': g['text']}

    mesh_fid, mesh_guid = filters.get(t['go'], (None, None))
    sk = skinned.get(t['go'])
    if sk and not mesh_fid:
        mesh_fid, mesh_guid = sk['mesh']

    if mesh_fid and mesh_fid != '0':
        if mesh_guid in BUILTIN_GUIDS and mesh_fid in PRIMITIVES:
            node['mesh'] = PRIMITIVES[mesh_fid]
        else:
            node['mesh'] = 'External'           # from a model file - placeholder
            node['meshRef'] = f'{mesh_guid}:{mesh_fid}'
        r = renderers.get(t['go']) or sk
        if r is None:
            node['render'] = False          # collider-only object, no renderer
        elif not r['enabled']:
            node['render'] = False          # renderer disabled in Unity (trigger volumes)
        else:
            node['mat'] = mat_id(r['mats'][0][1] if r['mats'] else None)

    if t['go'] in lights:  node['light'] = lights[t['go']]
    if t['go'] in cameras: node['camera'] = cameras[t['go']]
    nodes.append(node)

out = {'source': rel.replace(os.sep, '/'), 'nodes': nodes, 'materials': materials}
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
json.dump(out, open(OUT, 'w'), indent=1)

hidden = sum(1 for n in nodes if n.get('render') is False)
prims = sum(1 for n in nodes if n.get('mesh') in PRIMITIVES.values())
ext   = sum(1 for n in nodes if n.get('mesh') == 'External')
print(f"nodes      {len(nodes)}")
print(f"  meshes   {prims} primitive, {ext} external")
print(f"  hidden   {hidden} (renderer disabled / collider-only)")
print(f"  ui rects {sum(1 for n in nodes if 'rect' in n)}"
      f" ({sum(1 for n in nodes if n.get('ui', {}).get('tex'))} with sprites)")
print(f"  lights   {sum(1 for n in nodes if 'light' in n)}")
print(f"  cameras  {sum(1 for n in nodes if 'camera' in n)}")
print(f"materials  {len(materials)}: {', '.join(m['name'] for m in materials)}")
print(f"-> {OUT} ({os.path.getsize(OUT)} bytes)")
