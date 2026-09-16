from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BATCHES = ROOT / "asset-work" / "action-batches"
REMOTION_POSES = ROOT / "remotion-pet" / "public" / "action-poses"


RAW = {
    "act_spin": [
        "act_spin01.png",
        "act_spin2.png",
        "act_spin3.png",
    ],
    "act_flip_hair": ["act_flip_hair1.png", "act_flip_hair2.png"],
    "act_table": ["generated_act_table_prepare_v1.png", "act_table2.png"],
    "act_lookaround": ["act_lookaround1.png", "act_lookaround2.png"],
    "act_roll": [
        "ChatGPT Image 2026年8月13日 20_58_51 (8).png",
        "ChatGPT Image 2026年8月13日 21_02_17 (3).png",
        "ChatGPT Image 2026年8月13日 21_02_18 (4).png",
        "ChatGPT Image 2026年8月13日 21_02_18 (5).png",
    ],
    "act_hop": [
        "ChatGPT Image 2026年8月13日 21_02_19 (6).png",
        "ChatGPT Image 2026年8月13日 21_46_42 (7).png",
        "ChatGPT Image 2026年8月13日 21_46_42 (8).png",
    ],
    "act_rub_eye": ["ChatGPT Image 2026年8月13日 21_02_20 (8).png"],
    "act_sneeze": [
        "ChatGPT Image 2026年8月13日 21_20_04 (1).png",
        "ChatGPT Image 2026年8月13日 21_20_04 (2).png",
        "ChatGPT Image 2026年8月13日 21_20_05 (3).png",
    ],
    "act_dance": [
        "ChatGPT Image 2026年8月13日 21_20_05 (4).png",
        "ChatGPT Image 2026年8月13日 21_20_06 (5).png",
        "ChatGPT Image 2026年8月13日 21_20_06 (6).png",
    ],
    "act_work": [
        "ChatGPT Image 2026年8月13日 21_20_07 (7).png",
        "ChatGPT Image 2026年8月13日 21_20_07 (8).png",
    ],
    "act_ink": [
        "ChatGPT Image 2026年8月13日 21_24_53 (1).png",
        "ChatGPT Image 2026年8月13日 21_24_54 (2).png",
        "ChatGPT Image 2026年8月13日 21_24_54 (3).png",
    ],
    "act_firework": [
        "ChatGPT Image 2026年8月13日 21_24_55 (4).png",
        "ChatGPT Image 2026年8月13日 21_24_55 (5).png",
        "ChatGPT Image 2026年8月13日 21_24_55 (6).png",
    ],
    "act_intro": [
        "ChatGPT Image 2026年8月13日 21_24_56 (7).png",
        "ChatGPT Image 2026年8月13日 21_24_56 (8).png",
    ],
    "act_joke": [
        "ChatGPT Image 2026年8月13日 21_28_53 (1).png",
        "ChatGPT Image 2026年8月13日 21_28_53 (2).png",
        "ChatGPT Image 2026年8月13日 21_28_54 (3).png",
        "ChatGPT Image 2026年8月13日 21_28_54 (4).png",
    ],
    "gift_thanks": [
        "ChatGPT Image 2026年8月13日 21_28_54 (5).png",
        "ChatGPT Image 2026年8月13日 21_28_55 (6).png",
    ],
    "special_hourly": ["ChatGPT Image 2026年8月13日 21_28_55 (8).png"],
    "special_lottery": [
        "ChatGPT Image 2026年8月13日 21_28_55 (7).png",
        "ChatGPT Image 2026年8月13日 21_33_09 (1).png",
        "ChatGPT Image 2026年8月13日 21_33_10 (2).png",
    ],
    "state_move": [
        "ChatGPT Image 2026年8月13日 21_33_10 (3).png",
        "ChatGPT Image 2026年8月13日 21_33_10 (4).png",
    ],
    "state_observe": [
        "ChatGPT Image 2026年8月13日 21_42_45 (7).png",
        "ChatGPT Image 2026年8月13日 21_42_45 (8).png",
        "ChatGPT Image 2026年8月13日 21_46_39 (1).png",
    ],
    "state_talking": [
        "ChatGPT Image 2026年8月13日 21_33_12 (7).png",
        "ChatGPT Image 2026年8月13日 21_33_12 (8).png",
    ],
    "gift_sc": ["generated_gift_sc_v1.png"],
    "gift_guard": ["generated_gift_guard_v1.png"],
}


def normalize(source: Path, destination: Path, align_to_center: bool = False) -> tuple[tuple[int, int, int, int], tuple[int, int, int, int]]:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > 8 else 0)
    source_box = mask.getbbox()
    if source_box is None:
        raise ValueError(f"no visible subject: {source}")
    cropped = image.crop(source_box)
    target_height = 361
    target_width = max(1, round(cropped.width * target_height / cropped.height))
    if target_width > 340:
        target_width = 340
        target_height = max(1, round(cropped.height * target_width / cropped.width))
    resized = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (384, 416), (0, 0, 0, 0))
    x = round((384 - target_width) / 2)
    if align_to_center:
        x = round((384 - target_width) / 2 - ((source_box[0] + source_box[2] - 1) / 2 - image.width / 2) * target_width / cropped.width)
    y = 404 - target_height
    canvas.alpha_composite(resized, (x, y))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination)
    final_box = canvas.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if final_box is None:
        raise ValueError(f"normalized pose has no visible subject: {destination}")
    return source_box, final_box


def prepare(action_id: str) -> None:
    sources = RAW[action_id]
    normalized = BATCHES / action_id / "normalized"
    if normalized.exists():
        shutil.rmtree(normalized)
    normalized.mkdir(parents=True, exist_ok=True)
    for index, filename in enumerate(sources, 1):
        source = BATCHES / filename
        if not source.exists():
            raise FileNotFoundError(source)
        target_name = f"{action_id}-{index:02d}.png"
        destination = normalized / target_name
        source_box, final_box = normalize(source, destination, align_to_center=action_id in {'act_sneeze', 'act_dance', 'act_ink', 'act_firework'})
        remotion_target = REMOTION_POSES / target_name
        remotion_target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destination, remotion_target)
        print(f"{action_id} {target_name} source_box={source_box} final_box={final_box}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", choices=[*RAW, "all"], default="all")
    args = parser.parse_args()
    action_ids = RAW if args.action == "all" else [args.action]
    for action_id in action_ids:
        prepare(action_id)


if __name__ == "__main__":
    main()
