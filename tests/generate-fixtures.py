"""Render an original 3D scene from two cameras and encode the test media.

Run with Python, NumPy and imageio-ffmpeg installed.
"""

import math
import argparse
from pathlib import Path
import struct
import subprocess
import zlib

import imageio_ffmpeg
import numpy as np


WIDTH, HEIGHT = 320, 180
FPS, DURATION = 18, 6
OUTPUT = Path(__file__).parent / "fixtures"
PIXEL_X, PIXEL_Y = np.meshgrid(
    ((np.arange(WIDTH) + 0.5) / WIDTH - 0.5) * 1.7,
    (0.5 - (np.arange(HEIGHT) + 0.5) / HEIGHT) * 1.7 * HEIGHT / WIDTH,
)
LIGHT = np.array([-0.5, 0.8, -0.6])
LIGHT /= np.linalg.norm(LIGHT)


def render(eye, phase, scene):
    origin = np.array([eye, 1.3, 0.0])
    rays = np.stack(
        [PIXEL_X - eye / 5, PIXEL_Y - 0.12, np.ones_like(PIXEL_X)], axis=-1
    )
    rays /= np.linalg.norm(rays, axis=-1, keepdims=True)
    depth = np.full((HEIGHT, WIDTH), np.inf)
    color = np.broadcast_to([19, 28, 47], (HEIGHT, WIDTH, 3)).copy().astype(float)

    downward = rays[..., 1] < -0.003
    floor_depth = np.where(downward, -origin[1] / np.minimum(rays[..., 1], -0.003), np.inf)
    floor = floor_depth < 32
    floor_hits = origin + rays[floor] * floor_depth[floor, None]
    cells = (np.floor(floor_hits[:, 0]) + np.floor(floor_hits[:, 2])) % 2
    fade = np.exp(-floor_depth[floor, None] / 16)
    color[floor] = (np.array([37, 58, 73]) + 32 * cells[:, None]) * fade + (
        np.array([19, 28, 47]) * (1 - fade)
    )
    depth[floor] = floor_depth[floor]

    spheres = [
        ([-1.05, 0.57, 3.25], 0.57, [255, 158, 111]),
        ([0.62 + 0.28 * math.sin(phase), 0.8 + 0.14 * math.sin(phase), 4.4], 0.72, [84, 207, 222]),
        ([2.1, 1.06, 6.3], 1.06, [172, 147, 252]),
        ([-1.85, 1.14, 7.4], 1.14, [210, 220, 240]),
    ]
    if scene == "constelacion":
        spheres = [
            ([0.65 * math.sin(phase), 0.68, 3.4], 0.62, [245, 215, 104]),
            ([-1.28, 1.54, 4.7], 0.45, [247, 121, 181]),
            ([1.55, 1.21, 5.3], 0.80, [107, 231, 165]),
            ([-0.28, 2.13, 7.1], 0.67, [128, 168, 252]),
        ]
    for center, radius, base in spheres:
        offset = np.array(center) - origin
        projection = rays @ offset
        discriminant = projection**2 - offset @ offset + radius**2
        distance = projection - np.sqrt(np.maximum(discriminant, 0))
        visible = (discriminant > 0) & (distance > 0) & (distance < depth)
        normal = (rays[visible] * distance[visible, None] - offset) / radius
        shading = 0.28 + 0.72 * np.maximum(normal @ LIGHT, 0)
        color[visible] = shading[:, None] * np.array(base)
        depth[visible] = distance[visible]
    return np.uint8(np.clip(color, 0, 255))


def png(path, rgb):
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    height, width, _ = rgb.shape
    rows = b"".join(b"\0" + row.tobytes() for row in rgb)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows, 9))
        + chunk(b"IEND", b"")
    )


def stereo(phase, scene):
    return render(-0.13, phase, scene), render(0.13, phase, scene)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scene", choices=["orbital", "constelacion"], default="orbital")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    left, right = stereo(0, args.scene)
    png(args.output / f"{args.scene}-sbs.png", np.concatenate([left, right], axis=1))
    gray = np.array([0.2126, 0.7152, 0.0722])
    right_luma = right @ gray
    png(args.output / f"{args.scene}-anaglifo.png", np.uint8(np.stack([left @ gray, right_luma, right_luma], axis=-1)))

    encoder = subprocess.Popen(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo", "-pixel_format", "rgb24",
            "-video_size", f"{2 * WIDTH}x{HEIGHT}", "-framerate", str(FPS), "-i", "-",
            "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=44100",
            "-c:v", "libx264", "-profile:v", "baseline", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-af", "volume=0.08", "-movflags", "+faststart",
            "-shortest", str(args.output / f"{args.scene}-sbs.mp4"),
        ],
        stdin=subprocess.PIPE,
    )
    with encoder.stdin:
        for frame in range(FPS * DURATION):
            phase = 2 * math.pi * frame / (FPS * DURATION)
            encoder.stdin.write(np.concatenate(stereo(phase, args.scene), axis=1).tobytes())
    if encoder.wait():
        raise RuntimeError("FFmpeg could not encode the test MP4")


if __name__ == "__main__":
    main()
