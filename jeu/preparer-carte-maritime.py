"""Rend la texture de parchemin exactement raccordable sur ses quatre bords."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CHEMIN = ROOT / "img" / "iles" / "fond-carte-parchemin-tuile.png"


def main() -> None:
    src = Image.open(CHEMIN).convert("RGB")
    w, h = src.size
    grand = Image.new("RGB", (w * 2, h * 2))
    grand.paste(src, (0, 0))
    grand.paste(src.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (w, 0))
    grand.paste(src.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, h))
    grand.paste(src.transpose(Image.Transpose.ROTATE_180), (w, h))
    # Les bords de cette coupe centrale correspondent pixel pour pixel :
    # le navigateur peut répéter la texture sans couture ni changement de ton.
    tuile = grand.crop((w // 2, h // 2, w + w // 2, h + h // 2))
    tuile = tuile.resize((1024, 1024), Image.Resampling.LANCZOS)
    tuile.save(CHEMIN, optimize=True)
    print(f"Texture raccordable : {CHEMIN} ({tuile.width}x{tuile.height})")


if __name__ == "__main__":
    main()
