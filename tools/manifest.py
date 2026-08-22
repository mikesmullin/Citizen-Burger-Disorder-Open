#!/usr/bin/env python3
"""Build manifest.json — the index the viewer's picker reads."""
import json, os

from paths import ASSETS, iter_prefab_jsons

items = []
for slug, p in sorted(iter_prefab_jsons()):
    d = json.load(open(p))
    nodes = d['nodes']
    if not nodes:
        continue                                    # binary source, nothing to show
    meshes = [n for n in nodes if n.get('mesh')]
    src = d.get('source', '')
    parts = slug.split('/')
    items.append({
        'slug':   slug,
        'label':  parts[-1],
        'group':  'scene' if len(parts) == 1 else parts[-2],
        'kind':   'scene' if src.endswith('.unity') else 'prefab',
        'nodes':  len(nodes),
        'meshes': len(meshes),
        'prim':   sum(1 for n in meshes if n['mesh'] != 'External'),
        'ui':     sum(1 for n in nodes if n.get('ui')),
        'mats':   len(d['materials']),
        'source': src,
    })

# scenes first, then prefabs by descending richness
items.sort(key=lambda i: (i['kind'] != 'scene', -i['prim'], -i['nodes'], i['label'].lower()))
json.dump(items, open(os.path.join(ASSETS, 'manifest.json'), 'w'), indent=1)

sc = sum(1 for i in items if i['kind'] == 'scene')
print(f"manifest.json: {len(items)} entries ({sc} scenes, {len(items)-sc} prefabs)")
print(f"  with primitives: {sum(1 for i in items if i['prim'])}")
print(f"  empty of meshes: {sum(1 for i in items if not i['meshes'])}")
