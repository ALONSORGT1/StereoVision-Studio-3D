"""Generate actual encoded files for import compatibility regression checks."""

from pathlib import Path
import struct
import subprocess

import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "fixtures" / "imports"
OUTPUT.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SOURCE = ROOT / "fixtures" / "orbital-sbs.png"

for name, options in [
    ("fotografia.jpg", []),
    ("captura.png", ["-pix_fmt", "rgb48be"]),
    ("imagen.webp", []),
    ("imagen.gif", []),
    ("imagen.bmp", []),
    ("imagen.avif", ["-c:v", "libaom-av1", "-still-picture", "1", "-cpu-used", "8"]),
]:
    subprocess.run([
        FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
        "-threads", "1", "-i", str(SOURCE), "-vf", "scale=129:97",
        "-frames:v", "1", "-threads", "1", *options, str(OUTPUT / name),
    ], check=True)

# A valid extended-size 'free' atom preceding ftyp. Chunk offsets must move too.
original = bytearray((ROOT / "fixtures" / "orbital-sbs.mp4").read_bytes())
prefix = struct.pack(">I4sQ", 1, b"free", 24) + bytes(8)
containers = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"edts", b"dinf"}


def update_offsets(start, end):
    cursor = start
    while cursor + 8 <= end:
        size, kind = struct.unpack_from(">I4s", original, cursor)
        header = 8
        if size == 1:
            size = struct.unpack_from(">Q", original, cursor + 8)[0]
            header = 16
        if size == 0:
            size = end - cursor
        if size < header or cursor + size > end:
            raise ValueError("Invalid test MP4")
        body = cursor + header
        if kind in containers:
            update_offsets(body, cursor + size)
        if kind in {b"stco", b"co64"}:
            count = struct.unpack_from(">I", original, body + 4)[0]
            code, step = (">I", 4) if kind == b"stco" else (">Q", 8)
            for index in range(count):
                pos = body + 8 + index * step
                offset = struct.unpack_from(code, original, pos)[0]
                struct.pack_into(code, original, pos, offset + len(prefix))
        cursor += size


update_offsets(0, len(original))
(OUTPUT / "cabecera-extendida.mp4").write_bytes(prefix + original)
print("Generated", len(list(OUTPUT.iterdir())), "import fixtures")
