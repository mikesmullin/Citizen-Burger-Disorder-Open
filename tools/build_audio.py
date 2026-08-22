#!/usr/bin/env python3
"""Copy/transcode Unity audio into public/assets/audio/.

Music is re-encoded as 128k MP3 (the original is ~6.5 MB). SFX are copied
as-is — they are already a few kilobytes each. Browser WebAudio here
could not decode Opus, so we stay on MP3.

  export CBD_PROJ=/path/to/Citizen-Burger-Disorder-Open
  python3 tools/build_audio.py
"""
import json, os, re, shutil, subprocess, sys

from paths import ASSETS, ROOT

PROJ = os.environ.get('CBD_PROJ') or os.path.join(ROOT, 'tmp', 'Citizen-Burger-Disorder-Open')
OUT = os.path.join(ASSETS, 'audio')
MUSIC_DIR = os.path.join(OUT, 'music')
SFX_DIR = os.path.join(OUT, 'sfx')


def proper_case(stem):
    parts = re.split(r'[-_]+', stem)
    out = []
    for p in parts:
        if not p:
            continue
        m = re.match(r'([A-Za-z]+)(\d*)$', p)
        if m:
            word, num = m.group(1), m.group(2)
            out.append(word[:1].upper() + word[1:].lower() + num)
        else:
            out.append(p[:1].upper() + p[1:].lower())
    return ''.join(out)


def label_of(ident):
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', ident)
    s = re.sub(r'([A-Za-z])(\d)', r'\1 \2', s)
    return s


def collect(kind, folder):
    rows = []
    if not os.path.isdir(folder):
        return rows
    for dirpath, _, files in os.walk(folder):
        for name in sorted(files):
            if not name.lower().endswith('.mp3'):
                continue
            src = os.path.join(dirpath, name)
            rel = os.path.relpath(src, PROJ).replace('\\', '/')
            ident = proper_case(os.path.splitext(name)[0])
            rows.append({
                'id': ident,
                'label': label_of(ident),
                'kind': kind,
                'source': rel,
                'src_path': src,
            })
    rows.sort(key=lambda r: r['source'].lower())
    return rows


def encode_music(src, dest):
    cmd = [
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-i', src, '-c:a', 'libmp3lame', '-b:a', '128k', dest,
    ]
    subprocess.check_call(cmd)


def main():
    music_src = os.path.join(PROJ, 'Assets', 'Music')
    sfx_src = os.path.join(PROJ, 'Assets', 'Sounds')
    if not os.path.isdir(music_src) and not os.path.isdir(sfx_src):
        sys.exit(f'no Unity audio at {PROJ} — set CBD_PROJ')

    os.makedirs(MUSIC_DIR, exist_ok=True)
    os.makedirs(SFX_DIR, exist_ok=True)

    catalog = {'music': [], 'sfx': []}

    for clip in collect('music', music_src):
        dest_name = clip['id'] + '.mp3'
        dest = os.path.join(MUSIC_DIR, dest_name)
        encode_music(clip['src_path'], dest)
        catalog['music'].append({
            'id': clip['id'],
            'label': clip['label'],
            'src': f'audio/music/{dest_name}',
            'source': clip['source'],
        })
        print(f"music  {clip['source']} -> {dest_name}")

    sfx_clips = collect('sfx', sfx_src)
    sfx_clips.sort(key=lambda c: (('/Collisions/' in c['source']), c['source'].lower()))
    for clip in sfx_clips:
        dest_name = clip['id'] + '.mp3'
        dest = os.path.join(SFX_DIR, dest_name)
        shutil.copy2(clip['src_path'], dest)
        catalog['sfx'].append({
            'id': clip['id'],
            'label': clip['label'],
            'src': f'audio/sfx/{dest_name}',
            'source': clip['source'],
        })
        print(f"sfx    {clip['source']} -> {dest_name}")

    keep = os.path.join(OUT, '.gitkeep')
    if os.path.exists(keep):
        os.remove(keep)

    with open(os.path.join(OUT, 'catalog.json'), 'w') as f:
        json.dump(catalog, f, indent=1)
        f.write('\n')

    n_m, n_s = len(catalog['music']), len(catalog['sfx'])
    print(f'catalog.json: {n_m} music, {n_s} sfx')


if __name__ == '__main__':
    main()
