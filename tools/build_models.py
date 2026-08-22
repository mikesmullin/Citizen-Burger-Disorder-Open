#!/usr/bin/env python3
"""Resolve every external mesh reference in the converted scenes to a real model
file, extract it, and write models.json  ("<guid>:<fileID>" -> descriptor)."""
import json, os, re, subprocess, sys

from paths import ASSETS, TOOLS, proj, iter_prefab_jsons, mesh_proper_name

PROJ = proj()
OUT  = os.path.join(ASSETS, 'models')

# guid -> asset path
guid_map = {}
for root, _, files in os.walk(os.path.join(PROJ, 'Assets')):
    for f in files:
        if not f.endswith('.meta'):
            continue
        p = os.path.join(root, f)
        m = re.search(r'^guid:\s*([0-9a-f]{32})', open(p, encoding='utf-8', errors='replace').read(400), re.M)
        if m:
            guid_map[m.group(1)] = p[:-5]

# every external mesh ref used by any converted scene/prefab
needed = {}
for _, p in iter_prefab_jsons():
    for n in json.load(open(p))['nodes']:
        if n.get('mesh') == 'External' and n.get('meshRef'):
            guid, fid = n['meshRef'].split(':')
            needed.setdefault(guid, set()).add(int(fid))

index, skipped, remapped = {}, [], []
for guid, fids in sorted(needed.items()):
    src = guid_map.get(guid)
    if not src or not os.path.exists(src):
        skipped.append((guid, 'unresolved guid'))
        continue
    slug = mesh_proper_name(os.path.splitext(os.path.basename(src))[0])
    ext = os.path.splitext(src)[1].lower()

    if ext in ('.fbx',):
        head = open(src, 'rb').read(24)
        if not head.startswith(b';') and b'FBX' in head:
            skipped.append((os.path.basename(src), 'binary FBX - not supported'))
            continue
        r = subprocess.run([sys.executable, os.path.join(TOOLS, 'fbx.py'), src, OUT, slug],
                           capture_output=True, text=True)
        line = [l for l in r.stdout.splitlines() if l.startswith('[')]
        entries = json.loads(line[-1]) if line else []
    elif ext == '.blend':
        r = subprocess.run(['blender', '-b', '--factory-startup', '--python',
                            os.path.join(TOOLS, 'blender_export.py'), '--', src, OUT, slug],
                           capture_output=True, text=True)
        line = [l for l in r.stdout.splitlines() if l.startswith('ENTRIES:')]
        entries = json.loads(line[-1][len('ENTRIES:'):]) if line else []
    else:
        skipped.append((os.path.basename(src), f'unhandled {ext}'))
        continue

    if not entries:
        skipped.append((os.path.basename(src), 'no meshes extracted'))
        continue

    # Unity's sub-asset ids don't always line up with our extraction order
    # (its .blend import goes through its own FBX conversion). The scenes tell us
    # exactly which ids exist, so when the counts agree, pair them up in order.
    want = sorted(fids)
    got  = sorted(entries, key=lambda e: e['fileId'])
    if len(want) == len(got) and [e['fileId'] for e in got] != want:
        for e, fid in zip(got, want):
            e['fileId'] = fid
        remapped.append((os.path.basename(src), len(want)))

    for e in entries:
        index[f"{guid}:{e['fileId']}"] = dict(e, source=os.path.relpath(src, PROJ))

json.dump(index, open(os.path.join(ASSETS, 'models.json'), 'w'), indent=1)

wanted = sum(len(v) for v in needed.values())
have   = sum(1 for guid, fids in needed.items() for f in fids if f'{guid}:{f}' in index)
print(f"models.json: {len(index)} meshes extracted")
print(f"  refs satisfied: {have}/{wanted}")
tris = sum(e['tris'] for e in index.values())
print(f"  total triangles: {tris}")
if remapped:
    print("  fileID remapped onto scene demand:")
    for n, c in remapped:
        print(f"    {n}: {c} mesh(es)")
if skipped:
    print("  skipped:")
    for n, why in skipped:
        print(f"    {n}: {why}")
