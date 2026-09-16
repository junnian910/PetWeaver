from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


SEQUENCES = {
    "idle": ([0, 1, 2, 3, 4, 5], 12),
    "waving": ([0, 1, 2, 1, 3], 6),
    "jumping": (["idle", 0, 1, 2, 3, 4, "idle"], 6),
    "failed": ([0, 1, 2, 3, 4, 5, 6, 7], 6),
    "waiting": ([0, 1, 2, 3, 4, 5], 6),
}


def core_anchor_x(image: Image.Image) -> float:
    alpha = image.getchannel("A")
    total = weighted_x = 0
    for y in range(25, 180):
        for x in range(72, 120):
            value = alpha.getpixel((x, y))
            total += value
            weighted_x += x * value
    return weighted_x / total if total else 95.5


def align(image: Image.Image) -> Image.Image:
    shift = 95.5 - core_anchor_x(image)
    return image.transform(
        image.size,
        Image.Transform.AFFINE,
        (1, 0, -shift, 0, 1, 0),
        resample=Image.Resampling.BICUBIC,
    )


def render_video(ffmpeg: Path, assets: Path, output: Path, state: str, fps: int) -> None:
    order, transition_frames = SEQUENCES[state]
    state_frames = [align(Image.open(path).convert("RGBA")) for path in sorted((assets / state).glob("*.png"))]
    idle = align(Image.open(assets / "idle" / "00.png").convert("RGBA"))
    selected = [idle if index == "idle" else state_frames[index] for index in order]
    with tempfile.TemporaryDirectory(prefix=f"fafa-{state}-") as temp:
        temp_dir = Path(temp)
        frame_number = 0
        for index, current in enumerate(selected):
            following = selected[(index + 1) % len(selected)]
            for step in range(transition_frames):
                progress = step / transition_frames
                eased = (1 - math.cos(math.pi * progress)) / 2
                frame = Image.blend(current, following, eased)
                frame.save(temp_dir / f"{frame_number:04d}.png")
                frame_number += 1
        output.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error",
                "-framerate", str(fps), "-i", str(temp_dir / "%04d.png"),
                "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                "-auto-alt-ref", "0", "-row-mt", "1", "-crf", "20", "-b:v", "0",
                "-metadata:s:v:0", "alpha_mode=1", str(output),
            ],
            check=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fps", type=int, default=30)
    args = parser.parse_args()
    if not args.ffmpeg.is_file():
        raise SystemExit(f"FFmpeg not found: {args.ffmpeg}")
    if args.output.exists():
        shutil.rmtree(args.output)
    for state in SEQUENCES:
        render_video(args.ffmpeg, args.assets, args.output / f"{state}.webm", state, args.fps)


if __name__ == "__main__":
    main()
