#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops


def parse_hex(value: str) -> tuple[int, int, int]:
    normalized = value.strip().lstrip("#")
    if len(normalized) != 6:
        raise argparse.ArgumentTypeError("chroma must be #RRGGBB")
    try:
        return tuple(int(normalized[index:index + 2], 16) for index in (0, 2, 4))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("chroma must be #RRGGBB") from exc


def foreground_mask(image: Image.Image, chroma: tuple[int, int, int], threshold: int) -> Image.Image:
    rgb = image.convert("RGB")
    difference = ImageChops.difference(rgb, Image.new("RGB", rgb.size, chroma))
    red, green, blue = difference.split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    chroma_mask = maximum.point(lambda value: 255 if value > threshold else 0)
    source_alpha = image.getchannel("A").point(lambda value: 255 if value > 8 else 0)
    return ImageChops.multiply(chroma_mask, source_alpha)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract one approved PetWeaver action sheet.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--columns", type=int, default=4)
    parser.add_argument("--rows", type=int, default=2)
    parser.add_argument("--frame-size", type=int, default=128)
    parser.add_argument("--padding", type=int, default=8)
    parser.add_argument("--chroma", type=parse_hex, default=parse_hex("#FF00FF"))
    parser.add_argument("--threshold", type=int, default=64)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    if args.columns <= 0 or args.rows <= 0:
        raise SystemExit("columns and rows must be positive")
    if args.frame_size < 32 or args.frame_size > 512:
        raise SystemExit("frame-size must be between 32 and 512")
    if args.padding < 0 or args.padding * 2 >= args.frame_size:
        raise SystemExit("padding leaves no room for the sprite")

    source = Image.open(args.input).convert("RGBA")
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    frames: list[Image.Image] = []
    report = []

    for row in range(args.rows):
        for column in range(args.columns):
            left = round(column * source.width / args.columns)
            top = round(row * source.height / args.rows)
            right = round((column + 1) * source.width / args.columns)
            bottom = round((row + 1) * source.height / args.rows)
            cell = source.crop((left, top, right, bottom))
            mask = foreground_mask(cell, args.chroma, args.threshold)
            box = mask.getbbox()
            frame_index = row * args.columns + column
            if box is None:
                raise SystemExit(f"frame {frame_index:02d} is empty")
            touches_boundary = box[0] <= 1 or box[1] <= 1 or box[2] >= cell.width - 1 or box[3] >= cell.height - 1
            if args.strict and touches_boundary:
                raise SystemExit(f"frame {frame_index:02d} touches its implicit grid boundary")

            keyed = cell.copy()
            keyed.putalpha(mask)
            crop = keyed.crop(box)
            available = args.frame_size - args.padding * 2
            scale = min(available / crop.width, available / crop.height)
            target_size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
            sprite = crop.resize(target_size, Image.Resampling.NEAREST)
            frame = Image.new("RGBA", (args.frame_size, args.frame_size), (0, 0, 0, 0))
            x = (args.frame_size - sprite.width) // 2
            y = args.frame_size - args.padding - sprite.height
            frame.alpha_composite(sprite, (x, y))
            frame.save(output / f"{frame_index:02d}.png")
            frames.append(frame)
            report.append({
                "frame": frame_index,
                "sourceCell": [left, top, right, bottom],
                "sourceForeground": list(box),
                "touchesGridBoundary": touches_boundary,
                "outputForeground": list(frame.getchannel("A").getbbox() or (0, 0, 0, 0)),
            })

    expected = args.columns * args.rows
    if len(frames) != expected:
        raise SystemExit(f"extracted {len(frames)} frames, expected {expected}")
    frames[0].save(
        output / "preview.gif",
        save_all=True,
        append_images=frames[1:],
        duration=250,
        loop=0,
        disposal=2,
    )
    (output / "extraction.json").write_text(
        json.dumps({"ok": True, "frameCount": len(frames), "frames": report}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"extracted {len(frames)} frames to {output}")


if __name__ == "__main__":
    main()
