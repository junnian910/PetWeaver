from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


WIDTH = 384
HEIGHT = 416
ALPHA_THRESHOLD = 8
TARGET_CENTER_X = (WIDTH - 1) / 2
TARGET_FOOT = HEIGHT - 13


def shifted(image: Image.Image, dx: int, dy: int) -> Image.Image:
    source_left = max(0, -dx)
    source_top = max(0, -dy)
    source_right = min(image.width, image.width - dx)
    source_bottom = min(image.height, image.height - dy)
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    if source_right <= source_left or source_bottom <= source_top:
        return canvas
    crop = image.crop((source_left, source_top, source_right, source_bottom))
    canvas.alpha_composite(crop, (source_left + dx, source_top + dy))
    return canvas


def stabilize_frames(frame_dir: Path) -> int:
    paths = sorted(frame_dir.glob("frame-*.png"))
    if not paths:
        raise ValueError(f"no frames in {frame_dir}")

    reference = Image.open(paths[0]).convert("RGBA")
    reference_mask = reference.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    reference_box = reference_mask.getbbox()
    if reference_box is None:
        raise ValueError(f"no Alpha subject in {paths[0]}")
    left, _, right, bottom = reference_box
    dx = round(TARGET_CENTER_X - (left + right - 1) / 2)
    dy = round(TARGET_FOOT - (bottom - 1))

    for path in paths:
        image = Image.open(path).convert("RGBA")
        mask = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
        box = mask.getbbox()
        if box is None:
            raise ValueError(f"no Alpha subject in {path}")
        shifted(image, dx, dy).save(path)
    return len(paths)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: stabilize-action-video.py <ffmpeg> <video.webm>")
    ffmpeg = Path(sys.argv[1])
    video = Path(sys.argv[2]).resolve()
    if not ffmpeg.is_file():
        raise SystemExit(f"ffmpeg not found: {ffmpeg}")
    if not video.is_file():
        raise SystemExit(f"video not found: {video}")

    with tempfile.TemporaryDirectory(prefix="fafa-stabilize-") as raw_temp:
        temp = Path(raw_temp)
        frame_dir = temp / "frames"
        frame_dir.mkdir()
        subprocess.run(
            [str(ffmpeg), "-v", "error", "-y", "-c:v", "libvpx-vp9", "-i", str(video), "-map", "0:v:0", "-an", "-vsync", "0", str(frame_dir / "frame-%04d.png")],
            check=True,
        )
        frame_count = stabilize_frames(frame_dir)
        stabilized = temp / "stabilized.webm"
        subprocess.run(
            [
                str(ffmpeg), "-v", "error", "-y",
                "-framerate", "60", "-i", str(frame_dir / "frame-%04d.png"),
                "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                "-auto-alt-ref", "0", "-row-mt", "1", "-crf", "12", "-b:v", "0",
                "-metadata:s:v:0", "alpha_mode=1", str(stabilized),
            ],
            check=True,
        )
        os.replace(stabilized, video)
        print(f"stabilized {video.name}: {frame_count} frames")


if __name__ == "__main__":
    main()
