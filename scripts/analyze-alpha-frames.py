import json
import sys
from pathlib import Path

from PIL import Image


def metrics(path: Path, threshold: int):
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > threshold else 0)
    box = mask.getbbox()
    if box is None:
        raise ValueError(f"{path.name}: no alpha pixels above {threshold}")
    left, top, right, bottom = box
    if box == (0, 0, image.width, image.height):
        raise ValueError(f"{path.name}: decoded frame has no transparent edge")
    return {
        "centerX": (left + right - 1) / 2,
        "centerY": (top + bottom - 1) / 2,
        "foot": bottom - 1,
    }


directory = Path(sys.argv[1])
threshold = int(sys.argv[2])
frames = [metrics(path, threshold) for path in sorted(directory.glob("frame-*.png"))]
if not frames:
    raise ValueError("no decoded PNG frames")


def span(key: str):
    values = [frame[key] for frame in frames]
    return max(values) - min(values)


def delta(key: str):
    return abs(frames[-1][key] - frames[0][key])


print(json.dumps({
    "frameCount": len(frames),
    "centerSpanX": span("centerX"),
    "centerSpanY": span("centerY"),
    "footSpan": span("foot"),
    "endCenterDeltaX": delta("centerX"),
    "endCenterDeltaY": delta("centerY"),
    "endFootDelta": delta("foot"),
}))
