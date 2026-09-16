#!/usr/bin/env python3
import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description="Encode normalized pixel frames as a PetWeaver VP9-alpha action video.")
    parser.add_argument("--frames-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--input-fps", type=int, default=4)
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir).resolve()
    output = Path(args.output).resolve()
    ffmpeg = Path(args.ffmpeg).resolve()
    if not ffmpeg.is_file():
        raise SystemExit(f"ffmpeg not found: {ffmpeg}")
    frames = sorted(frames_dir.glob("[0-9][0-9].png"))
    if len(frames) != 8:
        raise SystemExit(f"expected 8 normalized frames, found {len(frames)}")
    sizes = set()
    for frame in frames:
        with Image.open(frame) as image:
            sizes.add(image.size)
    if sizes != {(128, 128)}:
        raise SystemExit(f"all frames must be 128x128, found {sorted(sizes)}")
    if args.input_fps <= 0 or args.input_fps > 30:
        raise SystemExit("input-fps must be between 1 and 30")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="petweaver-encode-") as temporary:
        prepared = Path(temporary)
        for index, frame_path in enumerate(frames):
            with Image.open(frame_path) as source:
                sprite = source.convert("RGBA").resize((384, 384), Image.Resampling.NEAREST)
            canvas = Image.new("RGBA", (384, 416), (0, 0, 0, 0))
            canvas.alpha_composite(sprite, (0, 32))
            canvas.save(prepared / f"{index:02d}.png")

        command = [
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", str(args.input_fps),
            "-i", str(prepared / "%02d.png"),
            "-an",
            "-r", "60",
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-auto-alt-ref", "0",
            "-row-mt", "1",
            "-crf", "12",
            "-b:v", "0",
            "-metadata:s:v:0", "alpha_mode=1",
            str(output),
        ]
        completed = subprocess.run(command, check=False)
    if completed.returncode != 0:
        raise SystemExit(f"ffmpeg exited with code {completed.returncode}")
    print(output)


if __name__ == "__main__":
    main()
