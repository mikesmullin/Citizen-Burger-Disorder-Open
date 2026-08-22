#!/usr/bin/env python3
"""Independently compose world transforms from scene.json and print reference
values, so the browser's three.js result can be diffed against them."""
import json, math, sys, os

from paths import normalize_slug, scene_json, expected_json

A = sys.argv[1] if len(sys.argv) > 1 else 'House'
NAME = normalize_slug(A)
src = scene_json(NAME)
if not os.path.exists(src):
    sys.exit(f'no scene json: {src}')
d = json.load(open(src))
by_id = {n['id']: n for n in d['nodes']}

def qmul(a, b):
    ax,ay,az,aw = a; bx,by,bz,bw = b
    return (aw*bx+ax*bw+ay*bz-az*by,
            aw*by-ax*bz+ay*bw+az*bx,
            aw*bz+ax*by-ay*bx+az*bw,
            aw*bw-ax*bx-ay*by-az*bz)

def qrot(q, v):
    x,y,z,w = q; vx,vy,vz = v
    tx = 2*(y*vz - z*vy); ty = 2*(z*vx - x*vz); tz = 2*(x*vy - y*vx)
    return (vx + w*tx + (y*tz - z*ty),
            vy + w*ty + (z*tx - x*tz),
            vz + w*tz + (x*ty - y*tx))

def world(nid, _memo={}):
    """Returns (world_pos, world_quat, world_scale) - TRS composition, matching three.js."""
    if nid in _memo: return _memo[nid]
    n = by_id[nid]
    lp, lq, ls = tuple(n['pos']), tuple(n['quat']), tuple(n['scale'])
    if not n['parent'] or n['parent'] not in by_id:
        r = (lp, lq, ls)
    else:
        pp, pq, ps = world(n['parent'])
        scaled = (lp[0]*ps[0], lp[1]*ps[1], lp[2]*ps[2])
        rotated = qrot(pq, scaled)
        r = ((pp[0]+rotated[0], pp[1]+rotated[1], pp[2]+rotated[2]),
             qmul(pq, lq),
             (ps[0]*ls[0], ps[1]*ls[1], ps[2]*ls[2]))
    _memo[nid] = r
    return r

out = {}
for n in d['nodes']:
    if n.get('mesh') or n.get('rect'):
        p, q, s = world(n['id'])
        out[n['id']] = {'name': n['name'],
                        'pos': [round(v, 6) for v in p],
                        'quat': [round(v, 6) for v in q],
                        'scale': [round(v, 6) for v in s]}
dst = expected_json(NAME)
os.makedirs(os.path.dirname(dst), exist_ok=True)
json.dump(out, open(dst, 'w'), indent=1)
print(f"computed world transforms for {len(out)} nodes -> {dst}")
xs = [v['pos'][0] for v in out.values()]; ys=[v['pos'][1] for v in out.values()]; zs=[v['pos'][2] for v in out.values()]
print(f"  x [{min(xs):8.2f} .. {max(xs):7.2f}]")
print(f"  y [{min(ys):8.2f} .. {max(ys):7.2f}]")
print(f"  z [{min(zs):8.2f} .. {max(zs):7.2f}]")
