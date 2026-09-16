"""把既有动作视频整体平移+等比缩放，使首帧角色对齐统一几何（高361/底403/中心192）。"""
from __future__ import annotations

import glob
import os
import subprocess
import sys
import tempfile

from PIL import Image

FF = os.path.join('remotion-pet', 'node_modules', '.pnpm',
                  '@remotion+compositor-win32-x64-msvc@4.0.506', 'node_modules',
                  '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')
FFPROBE = FF.replace('ffmpeg.exe', 'ffprobe.exe')

TARGET_H = 361
FOOT = 403
CENTER = 192


def bbox_of(image: Image.Image):
    return image.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()


def align(video_path: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        frame_dir = os.path.join(tmp, 'frames')
        os.makedirs(frame_dir)
        subprocess.run([FF, '-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', video_path,
                        '-map', '0:v:0', '-an', '-vsync', '0',
                        os.path.join(frame_dir, 'f-%04d.png')], check=True)
        frames = sorted(glob.glob(os.path.join(frame_dir, 'f-*.png')))
        if not frames:
            raise SystemExit(f'no frames decoded: {video_path}')

        first = Image.open(frames[0]).convert('RGBA')
        b = bbox_of(first)
        h = b[3] - b[1]
        scale = TARGET_H / h
        # 首帧 bbox 底/中心 -> 缩放后重新贴位
        new_w = round(first.width * scale)
        new_h = round(first.height * scale)
        dx = round(CENTER - (b[0] + b[2]) / 2 * scale)
        dy = round(FOOT - (b[3] - 1) * scale)

        out_dir = os.path.join(tmp, 'out')
        os.makedirs(out_dir)
        for index, path in enumerate(frames, start=1):
            image = Image.open(path).convert('RGBA')
            resized = image.resize((new_w, new_h), Image.LANCZOS)
            canvas = Image.new('RGBA', (384, 416), (0, 0, 0, 0))
            canvas.alpha_composite(resized, (dx, dy))
            canvas.save(os.path.join(out_dir, f'f-{index:04d}.png'))

        probe = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0',
                                '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', video_path],
                               capture_output=True, text=True, check=True)
        rate = probe.stdout.strip() or '60/1'
        target = os.path.abspath(video_path)
        subprocess.run([FF, '-v', 'error', '-y', '-framerate', rate,
                        '-i', os.path.join(out_dir, 'f-%04d.png'),
                        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '12',
                        '-auto-alt-ref', '0', '-metadata:s:v:0', 'alpha_mode=1',
                        '-an', target], check=True)

        check = Image.open(os.path.join(out_dir, 'f-0001.png')).convert('RGBA')
        cb = bbox_of(check)
        print(f'{os.path.basename(video_path)}: scale={scale:.4f} -> 高={cb[3]-cb[1]} 中心={(cb[0]+cb[2])/2:.1f} 底={cb[3]-1}')


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        align(arg)
