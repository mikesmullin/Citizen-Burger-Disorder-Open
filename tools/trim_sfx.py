#!/usr/bin/env python3
"""Trim leading and trailing silence from translated SFX MP3s.

The Unity clips were copied as-is by tools/build_audio.py; several have a
noticeable pad before the hit (Chopping is ~180 ms of quiet). This is a
one-shot cleanup over public/assets/audio/sfx/.

  python3 tools/trim_sfx.py --dry-run
  python3 tools/trim_sfx.py
  python3 tools/trim_sfx.py public/assets/audio/sfx/Chopping.mp3
"""
import argparse, math, os, struct, subprocess, sys, tempfile

from paths import ASSETS, ROOT

SFX_DIR = os.path.join(ASSETS, 'audio', 'sfx')
SR = 44100
WIN = SR // 100  # 10 ms RMS windows
# Relative to peak window RMS. Quiet beds (SoftMeat) stay intact;
# delayed transients (Chopping, MeatSlap) get cropped.
THRESH = 0.04
PAD_START = 0.010
PAD_END = 0.025
MIN_KEEP = 0.040


def pcm_mono(path):
    p = subprocess.run(
        [
            'ffmpeg', '-hide_banner', '-loglevel', 'error',
            '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-',
        ],
        capture_output=True, check=True,
    )
    n = len(p.stdout) // 2
    return struct.unpack('<' + f'{n}h', p.stdout)


def bounds(samples, thresh=THRESH, pad_start=PAD_START, pad_end=PAD_END):
    n = len(samples)
    if n < WIN:
        return 0.0, n / SR
    rms = []
    for i in range(0, n, WIN):
        chunk = samples[i:i + WIN]
        rms.append(math.sqrt(sum(s * s for s in chunk) / len(chunk)))
    peak = max(rms) or 1.0
    cut = peak * thresh
    start_w = next((i for i, r in enumerate(rms) if r >= cut), 0)
    end_w = len(rms) - 1
    for i in range(len(rms) - 1, -1, -1):
        if rms[i] >= cut:
            end_w = i
            break
    start = max(0.0, start_w * WIN / SR - pad_start)
    end = min(n / SR, (end_w + 1) * WIN / SR + pad_end)
    if end - start < MIN_KEEP:
        return 0.0, n / SR
    return start, end


def encode_trim(src, dest, start, end):
    af = f'atrim=start={start:.4f}:end={end:.4f},asetpts=PTS-STARTPTS'
    subprocess.check_call([
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-i', src, '-af', af,
        '-c:a', 'libmp3lame', '-q:a', '2',
        dest,
    ])


def iter_targets(args):
    if args.paths:
        for p in args.paths:
            yield os.path.abspath(p)
        return
    for name in sorted(os.listdir(SFX_DIR)):
        if name.lower().endswith('.mp3'):
            yield os.path.join(SFX_DIR, name)


def main():
    ap = argparse.ArgumentParser(description='Trim silence from translated SFX')
    ap.add_argument('paths', nargs='*', help='MP3s (default: public/assets/audio/sfx)')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--thresh', type=float, default=THRESH)
    ap.add_argument('--pad-start', type=float, default=PAD_START)
    ap.add_argument('--pad-end', type=float, default=PAD_END)
    args = ap.parse_args()

    rows = []
    for src in iter_targets(args):
        if not os.path.isfile(src):
            sys.exit(f'no file: {src}')
        samples = pcm_mono(src)
        dur = len(samples) / SR
        start, end = bounds(
            samples, thresh=args.thresh,
            pad_start=args.pad_start, pad_end=args.pad_end,
        )
        lead = start
        tail = dur - end
        changed = lead > 0.004 or tail > 0.004
        rec = {
            'name': os.path.relpath(src, ROOT),
            'dur': dur, 'start': start, 'end': end,
            'lead': lead, 'tail': tail, 'keep': end - start,
            'changed': changed,
        }
        rows.append(rec)
        if not changed or args.dry_run:
            continue
        fd, tmp = tempfile.mkstemp(suffix='.mp3', dir=os.path.dirname(src))
        os.close(fd)
        try:
            encode_trim(src, tmp, start, end)
            os.replace(tmp, src)
        except Exception:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise

    print(f"{'file':40} {'dur':>7} {'lead':>7} {'tail':>7} {'keep':>7}  note")
    for r in rows:
        note = 'trim' if r['changed'] else 'ok'
        if args.dry_run and r['changed']:
            note = 'would trim'
        print(
            f"{r['name']:40} {r['dur'] * 1000:6.0f}ms "
            f"{r['lead'] * 1000:6.0f}ms {r['tail'] * 1000:6.0f}ms "
            f"{r['keep'] * 1000:6.0f}ms  {note}"
        )
    n = sum(1 for r in rows if r['changed'])
    if args.dry_run:
        print(f'{n}/{len(rows)} would trim')
    else:
        print(f'{n}/{len(rows)} trimmed')


if __name__ == '__main__':
    main()
