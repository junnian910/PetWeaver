from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("image has no visible pixels")
    return bbox


def main() -> None:
    source_path, reference_path, output_path = map(Path, sys.argv[1:4])
    source = Image.open(source_path).convert("RGBA")
    reference = Image.open(reference_path).convert("RGBA")
    if source.size != reference.size:
        source = source.resize(reference.size, Image.Resampling.LANCZOS)

    source_box = alpha_bbox(source)
    reference_box = alpha_bbox(reference)
    source_center = (source_box[0] + source_box[2]) / 2
    reference_center = (reference_box[0] + reference_box[2]) / 2
    shift_x = round(reference_center - source_center)
    shift_y = reference_box[3] - source_box[3]

    aligned = Image.new("RGBA", reference.size, (0, 0, 0, 0))
    aligned.alpha_composite(source, (shift_x, shift_y))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    aligned.save(output_path)
    print(f"{output_path}: shift=({shift_x},{shift_y}), bbox={alpha_bbox(aligned)}")


if __name__ == "__main__":
    main()
