#!/usr/bin/env python3
"""One-time tire mesh: three concentric cylinders merged into one soup.

The museum truck used to draw 4 wheels × (rubber + hub + cap) = 12 meshes.
This writes a unit mesh (radius 1, width 1, axle +X) plus a 3-texel UV atlas
so one MeshStandardMaterial carries all three colours.

    python3 tools/build_tire.py

Emits:
    public/assets/models/Tire.bin     float32 [positions | normals | uvs]
    public/assets/models/Tire.json    verts / bounds / uv cells
    public/assets/textures/Tire.png   3×1 rubber | hub | cap
"""
from __future__ import annotations

import json
import math
import os
import struct
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow required: python3 -m pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BIN = os.path.join(ROOT, 'public', 'assets', 'models', 'Tire.bin')
OUT_JSON = os.path.join(ROOT, 'public', 'assets', 'models', 'Tire.json')
OUT_PNG = os.path.join(ROOT, 'public', 'assets', 'textures', 'Tire.png')

# Matches delivery.js makeWheel colours.
RUBBER = (0x1A, 0x1A, 0x1A)
HUB = (0x6E, 0x6E, 0x6E)
CAP = (0x3A, 0x3A, 0x3A)

# UV at the centre of each 3-texel atlas cell (NearestFilter, no bleed).
UV = {
    'rubber': (0.5 / 3.0, 0.5),
    'hub': (1.5 / 3.0, 0.5),
    'cap': (2.5 / 3.0, 0.5),
}

# Relative to unit radius=1, width=1. Hub/cap poke out along the axle the
# same way the old three CylinderGeometry stack did (W+0.05 / W+0.08).
# Widths relative to the rubber. The old JS stack used W+0.05 / W+0.08
# on a ~0.37 m tyre, so the hub/cap faces sit a few cm proud of the rubber.
PARTS = (
    ('rubber', 1.00, 1.00, 20),
    ('hub', 0.40, 1.14, 12),
    ('cap', 0.18, 1.22, 10),
)

SEG_MIN = 8


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _norm(v):
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) or 1.0
    return (v[0] / l, v[1] / l, v[2] / l)


class Soup:
    def __init__(self):
        self.pos = []
        self.nrm = []
        self.uv = []

    def tri(self, p0, p1, p2, n0, n1, n2, uv):
        for p, n in ((p0, n0), (p1, n1), (p2, n2)):
            self.pos.extend(p)
            self.nrm.extend(n)
            self.uv.extend(uv)

    def tri_flat(self, p0, p1, p2, uv):
        n = _norm(_cross(_sub(p1, p0), _sub(p2, p0)))
        self.tri(p0, p1, p2, n, n, n, uv)

    @property
    def verts(self):
        return len(self.pos) // 3


def ring(radius, x, segments):
    out = []
    for i in range(segments):
        a = 2.0 * math.pi * i / segments
        # YZ circle, +Y up, +Z forward — axle along X.
        out.append((x, radius * math.cos(a), radius * math.sin(a)))
    return out


def add_cylinder(soup: Soup, radius, width, segments, uv):
    segments = max(SEG_MIN, int(segments))
    x0, x1 = -width * 0.5, width * 0.5
    a = ring(radius, x0, segments)
    b = ring(radius, x1, segments)

    for i in range(segments):
        j = (i + 1) % segments
        n_i = _norm((0.0, a[i][1], a[i][2]))
        n_j = _norm((0.0, a[j][1], a[j][2]))
        # Outward (look +X from the left end): (a_i, a_j, b_j) / (a_i, b_j, b_i)
        soup.tri(a[i], a[j], b[j], n_i, n_j, n_j, uv)
        soup.tri(a[i], b[j], b[i], n_i, n_j, n_i, uv)

    c0 = (x0, 0.0, 0.0)
    c1 = (x1, 0.0, 0.0)
    for i in range(segments):
        j = (i + 1) % segments
        # −X cap, winding so the normal faces −X.
        soup.tri_flat(c0, a[j], a[i], uv)
        # +X cap.
        soup.tri_flat(c1, b[i], b[j], uv)


def bounds(pos):
    xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
    mn = [min(xs), min(ys), min(zs)]
    mx = [max(xs), max(ys), max(zs)]
    size = [mx[i] - mn[i] for i in range(3)]
    return {
        'min': [round(v, 6) for v in mn],
        'max': [round(v, 6) for v in mx],
        'size': [round(v, 6) for v in size],
        'center': [round((mn[i] + mx[i]) * 0.5, 6) for i in range(3)],
        'longest': round(max(size), 6),
    }


def write_png():
    im = Image.new('RGB', (3, 1))
    im.putpixel((0, 0), RUBBER)
    im.putpixel((1, 0), HUB)
    im.putpixel((2, 0), CAP)
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    im.save(OUT_PNG, 'PNG')


def main():
    soup = Soup()
    for name, radius, width, segs in PARTS:
        add_cylinder(soup, radius, width, segs, UV[name])

    n = soup.verts
    if n == 0 or n % 3:
        sys.exit(f'bad vert count {n}')

    blob = b''.join(
        struct.pack('<' + 'f' * len(arr), *arr)
        for arr in (soup.pos, soup.nrm, soup.uv)
    )
    os.makedirs(os.path.dirname(OUT_BIN), exist_ok=True)
    open(OUT_BIN, 'wb').write(blob)
    write_png()

    bb = bounds(soup.pos)
    meta = {
        'name': 'Tire',
        'bin': 'models/Tire.bin',
        'tex': 'textures/Tire.png',
        'verts': n,
        'tris': n // 3,
        'hasNormals': True,
        'hasUvs': True,
        'radius': 1,
        'width': 1,
        'axle': 'x',
        'source': 'tools/build_tire.py',
        **bb,
        'uv': {k: [round(u, 6), round(v, 6)] for k, (u, v) in UV.items()},
        'colors': {
            'rubber': '#1a1a1a',
            'hub': '#6e6e6e',
            'cap': '#3a3a3a',
        },
    }
    json.dump(meta, open(OUT_JSON, 'w'), indent=1)
    print(f'Tire.bin  {n} verts  {n // 3} tris  {len(blob)} bytes')
    print(f'Tire.png  3×1  rubber/hub/cap')
    print(f'Tire.json {os.path.relpath(OUT_JSON, ROOT)}')


if __name__ == '__main__':
    main()
