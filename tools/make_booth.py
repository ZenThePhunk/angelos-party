"""Add the photo booth pictures to the gallery.

Usage:  python3 tools/make_booth.py "/path/to/photo booth folder"

Makes a small thumbnail and a full-size web copy of every picture (originals are never changed)
and writes photos/booth/booth.json, which the photo booth in the venue reads.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "photos" / "booth"
EXTS = {".jpg", ".jpeg", ".png", ".webp"}

def main(src):
    files = sorted(p for p in Path(src).expanduser().rglob("*") if p.suffix.lower() in EXTS and not p.name.startswith("."))
    if not files:
        sys.exit(f"No pictures found in {src}")
    (OUT / "thumb").mkdir(parents=True, exist_ok=True); (OUT / "full").mkdir(parents=True, exist_ok=True)
    out = []
    for n, p in enumerate(files, 1):
        name = f"{n:04d}.jpg"
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            for folder, longest, q in (("full", 2000, 92), ("thumb", 640, 80)):
                c = im.copy(); c.thumbnail((longest, longest), Image.LANCZOS)
                c.save(OUT / folder / name, "JPEG", quality=q, optimize=True, progressive=True)
        out.append({"thumb": f"photos/booth/thumb/{name}", "full": f"photos/booth/full/{name}"})
        print(f"{n}/{len(files)}  {p.name}")
    (OUT / "booth.json").write_text(json.dumps(out, indent=1))
    print(f"\nDone: {len(out)} booth pictures ready.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
