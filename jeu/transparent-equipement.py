"""Retire le fond clair des planches d'équipement illustrées.

Le fond est détecté depuis les bords : les blancs, gris très clairs et le
damier éventuellement aplati disparaissent, sans effacer les reflets blancs
enfermés à l'intérieur des contours sombres des objets.
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "img" / "planches" / "equipement-illustre"
OUTPUT = ROOT / "img" / "planches" / "equipement-illustre-transparent"


def detourer(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGB")
    # Le remplissage tolérant part des quatre coins. Il traverse le blanc,
    # ses légères ombres et les deux gris du damier, mais s'arrête aux contours
    # colorés ou sombres. La couleur sentinelle n'existe pas dans les images.
    travail = image.copy()
    sentinelle = (1, 2, 3)
    w, h = travail.size
    for point in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(travail, point, sentinelle, thresh=48)
    fond = np.all(np.asarray(travail) == sentinelle, axis=2)

    alpha = Image.fromarray((~fond).astype(np.uint8) * 255, "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.65))
    rgba = image.convert("RGBA")
    rgba.putalpha(alpha)
    output.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(output, optimize=True)


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    fichiers = sorted(SOURCE.glob("*.png"))
    if not fichiers:
        print(f"Aucune planche dans {SOURCE}", file=sys.stderr)
        return 1
    for source in fichiers:
        detourer(source, OUTPUT / source.name)
        print(source.name)
    print(f"{len(fichiers)} planches détourées dans {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
