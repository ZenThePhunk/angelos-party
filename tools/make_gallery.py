"""Turn a folder of photos into a gallery the venue can show.

Usage:  python3 tools/make_gallery.py "/path/to/photos" tyler
        (the last word is the gallery name: tyler, booth, ...)

Makes a thumbnail and a full-size web copy of every photo (originals are never changed),
in the order they were taken, and writes photos/<name>/gallery.json.
Galleries listed in SHUFFLED are mixed up instead: a fixed shuffle, so it's the same order every visit.
"""
import json, random, sys
from pathlib import Path
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent.parent
SHUFFLED = {"tyler"}   # Austin: Tyler's photos in a random (but always the same) order, not by file name
EXTS = {".jpg", ".jpeg", ".png", ".webp"}

def taken(p):
    try:
        with Image.open(p) as im:
            ex = im.getexif(); return (ex.get_ifd(0x8769).get(36867) or ex.get(306) or "9999", str(p).lower())
    except Exception:
        return ("9999", str(p).lower())

def main(src, name):
    out = HERE / "photos" / name
    files = sorted((p for p in Path(src).expanduser().rglob("*") if p.suffix.lower() in EXTS and not p.name.startswith(".")), key=taken)
    if not files:
        sys.exit(f"No photos found in {src}")
    (out / "thumb").mkdir(parents=True, exist_ok=True); (out / "full").mkdir(parents=True, exist_ok=True)
    items = []
    for n, p in enumerate(files, 1):
        fn = f"{n:04d}.jpg"
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im).convert("RGB"); w, h = im.size
            for folder, longest, q in (("full", 2000, 85), ("thumb", 500, 78)):   # Austin: keep Tyler's photos at full quality
                c = im.copy(); c.thumbnail((longest, longest), Image.LANCZOS)
                c.save(out / folder / fn, "JPEG", quality=q, optimize=True, progressive=True)
        items.append({"thumb": f"photos/{name}/thumb/{fn}", "full": f"photos/{name}/full/{fn}", "w": w, "h": h})
        print(f"{n}/{len(files)}  {p.name}", flush=True)
    if name in SHUFFLED: random.Random(f"{name}-angelos").shuffle(items)   # same seed every run → same order every time
    (out / "gallery.json").write_text(json.dumps(items, indent=1))
    print(f"\nDone: {len(items)} photos ready in the '{name}' gallery.")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
