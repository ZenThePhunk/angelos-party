"""Turn a folder of party photos into web-ready copies for the gallery.

Usage:  python3 tools/make_photos.py "/path/to/the/photographer's folder"

Makes two sizes of every photo (wall = small, for the frames; full = big, for the
pop-up viewer), sorts them by the time they were taken, and writes photos.json.
Your originals are never changed.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent.parent
WALL, FULL = HERE / "photos" / "wall", HERE / "photos" / "full"
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def taken_at(img, path):
    exif = img.getexif()
    stamp = exif.get_ifd(0x8769).get(36867) or exif.get(306)  # DateTimeOriginal, DateTime
    return (stamp or "9999", path.name.lower())


def main(src):
    files = sorted(p for p in Path(src).expanduser().rglob("*") if p.suffix.lower() in EXTS and not p.name.startswith("."))
    if not files:
        sys.exit(f"No photos found in {src}")
    WALL.mkdir(parents=True, exist_ok=True)
    FULL.mkdir(parents=True, exist_ok=True)
    found = []
    for p in files:
        with Image.open(p) as im:
            found.append((taken_at(im, p), p))
    found.sort()
    out = []
    for n, (_, p) in enumerate(found, 1):
        name = f"{n:04d}.jpg"
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            w, h = im.size
            for folder, longest, q in ((FULL, 2400, 86), (WALL, 1024, 80)):
                c = im.copy()
                c.thumbnail((longest, longest), Image.LANCZOS)
                c.save(folder / name, "JPEG", quality=q, optimize=True, progressive=True)
        out.append({"wall": f"photos/wall/{name}", "full": f"photos/full/{name}", "w": w, "h": h})
        print(f"{n}/{len(found)}  {p.name}")
    (HERE / "photos.json").write_text(json.dumps(out, indent=1))
    print(f"\nDone: {len(out)} photos ready.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
