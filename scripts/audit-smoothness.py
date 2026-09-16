import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

def analyze(video: Path, ffmpeg: str) -> dict:
    scale = 48
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        result = subprocess.run(
            [ffmpeg, '-v', 'error', '-y', '-i', str(video), '-vf', f'scale={scale}:-1',
             '-vsync', '0', str(tmp / 'f-%04d.png')],
            capture_output=True,
        )
        frames = sorted(tmp.glob('*.png'))
        if len(frames) < 3:
            return {'frames': len(frames), 'error': result.stderr.decode(errors='replace')[:200] or 'too few frames'}
        diffs = []
        prev = list(frames[0].open().convert('L').getdata()) if False else None
        imgs = [list(Image.open(f).convert('L').getdata()) for f in frames]
        frozen_runs = []
        run = 0
        for a, b in zip(imgs, imgs[1:]):
            total = sum(abs(x - y) for x, y in zip(a, b))
            mean = total / len(a)  # 0..255
            diffs.append(mean)
            if mean < 0.5:
                run += 1
            else:
                if run:
                    frozen_runs.append(run)
                run = 0
        if run:
            frozen_runs.append(run)
        avg = sum(diffs) / len(diffs)
        frozen = sum(1 for d in diffs if d < 0.5) / len(diffs) * 100
        jumps = sum(1 for d in diffs if d > 8.0) / len(diffs) * 100
        return {
            'frames': len(frames),
            'avgDiff': round(avg, 2),
            'frozenPct': round(frozen, 1),
            'jumpPct': round(jumps, 1),
            'maxHoldFrames': max(frozen_runs) if frozen_runs else 0,
        }

def main() -> int:
    video = Path(sys.argv[1])
    ffmpeg = sys.argv[2]
    result = analyze(video, ffmpeg)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if 'error' not in result else 1

if __name__ == '__main__':
    sys.exit(main())
