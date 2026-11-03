"""Verify the bundled demos and save contact sheets for visual review."""

from pathlib import Path
import re
import subprocess

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "assets" / "media"
EVIDENCE = ROOT / "test-results"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
EVIDENCE.mkdir(exist_ok=True)


def ffmpeg(*args, data=None):
    return subprocess.run(
        [FFMPEG, "-hide_banner", "-filter_threads", "1", "-threads", "2", *map(str, args)],
        input=data, capture_output=True, check=True,
    )


def frame(file, width, height, time=0, scale=None):
    result = ffmpeg(
        *([] if time == 0 else ["-ss", time]), "-i", file, "-frames:v", 1,
        *([] if scale is None else ["-vf", f"scale={width}:{height}"]),
        "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
    )
    return np.frombuffer(result.stdout, np.uint8).reshape(height, width, 3)


def sheet(name, image):
    height, width, _ = image.shape
    ffmpeg("-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-video_size", f"{width}x{height}", "-i", "pipe:0", "-frames:v", 1,
           EVIDENCE / f"{name}.png", data=image.tobytes())


def difference(a, b):
    return np.abs(a.astype(np.int16) - b).mean()


names = ["bosque", "ciudad-nocturna", "arrecife", "galeria", "canon", "metropolis"]
thumbs = [frame(MEDIA / f"{name}.webp", 320, 180) for name in names]
sheet("demos-contact", np.vstack([np.hstack(thumbs[:3]), np.hstack(thumbs[3:])]))
for index, name in enumerate(names):
    video = index >= 4
    file = MEDIA / (name + (".mp4" if video else ".jpg"))
    width = 960 if index < 2 else 1920
    if video:
        probe = ffmpeg("-i", file, "-map", "0:v:0", "-frames:v", 1, "-f", "null", "-")
        meta = probe.stderr.decode(errors="replace")
        assert re.search(r"Duration: 00:00:15\.00", meta), meta
        assert re.search(r"Video: h264.*1920x540.*24 fps", meta), meta
        samples = [frame(file, width, 540, time) for time in (0, 4, 8, 12, 14.75)]
        assert all(difference(a, b) > 2 for a, b in zip(samples, samples[1:])), name
        panels = [frame(file, 640, 180, time, scale=True) for time in (0, 4, 8, 12, 14.75)]
        sheet(name + "-fotogramas", np.vstack(panels))
    else:
        samples = [frame(file, width, 540)]
    disparities = []
    for sample in samples:
        if index < 2:
            a, b = sample[:, :, 0], sample[:, :, 1]
        else:
            a, b = np.split(sample, 2, axis=1)
        disparities.append(difference(a, b))
    assert min(disparities) > 1, (name, disparities)
    if index in (2, 3):
        sheet(name + "-ojos", samples[0])
    print(f"{name}: {width}x540, disparidad media mínima {min(disparities):.2f}" +
          (", H.264, 24 FPS, 15.00 s" if video else ""))
