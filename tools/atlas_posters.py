#!/usr/bin/env python3
"""Pack kiosk poster PNGs into one atlas for InstancedMesh UVs.

Only the sheets listed in public/game/systems/posters.js POSTERS (keep in
sync). Cells match the in-game sheet aspect (PW/PH = 1.05/1.45) so
runtime UVs are a uniform grid; each image is stretched into its cell
the same way MeshStandardMaterial already stretched a unique map.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTER_DIR = os.path.join(ROOT, 'public', 'assets', 'textures', 'posters')
OUT_PNG = os.path.join(POSTER_DIR, 'atlas.png')
OUT_JSON = os.path.join(POSTER_DIR, 'atlas.json')

# Same order as posters.js — instance index == this index.
POSTERS = [
    'CoverYourBurger',
    'Poster2',
    'MenuBoard',
    'DoubleCheese',
    'WhyIsAustraliaSo',
    '5gDMYkH',
    'BLCkYpI',
    'jTZL8p0',
    'n0kvMQ6',
    'N1psFxI',
    'o41Pq',
    'VF9IcfX',
    'Vq6ad',
    'wS8OjJU',
]

# In-game sheet is PW x PH = 1.05 x 1.45.
CELL_W = 512
CELL_H = 704
PAD = 2
COLS = 4


def main():
    n = len(POSTERS)
    rows = (n + COLS - 1) // COLS
    atlas_w = COLS * CELL_W
    atlas_h = rows * CELL_H
    atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))
    frames = {}
    for i, pid in enumerate(POSTERS):
        path = os.path.join(POSTER_DIR, pid + '.png')
        if not os.path.isfile(path):
            print('missing', path, file=sys.stderr)
            continue
        im = Image.open(path).convert('RGBA')
        col, row = i % COLS, i // COLS
        x = col * CELL_W
        y = row * CELL_H
        inner_w = CELL_W - PAD * 2
        inner_h = CELL_H - PAD * 2
        fitted = im.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
        atlas.paste(fitted, (x + PAD, y + PAD))
        # GL UVs, origin bottom-left (Texture.flipY = true).
        u = (x + PAD) / atlas_w
        v = 1 - (y + PAD + inner_h) / atlas_h
        du = inner_w / atlas_w
        dv = inner_h / atlas_h
        frames[pid] = {
            'i': i, 'col': col, 'row': row,
            'u': round(u, 6), 'v': round(v, 6),
            'du': round(du, 6), 'dv': round(dv, 6),
        }
    atlas.save(OUT_PNG, 'PNG')
    meta = {
        'image': './assets/textures/posters/atlas.png',
        'size': [atlas_w, atlas_h],
        'cell': [CELL_W, CELL_H],
        'cols': COLS,
        'rows': rows,
        'pad': PAD,
        'order': POSTERS,
        'frames': frames,
    }
    with open(OUT_JSON, 'w') as f:
        json.dump(meta, f, indent=2)
        f.write('\n')
    print('wrote', os.path.relpath(OUT_PNG, ROOT), atlas.size, 'frames', len(frames))


if __name__ == '__main__':
    main()
