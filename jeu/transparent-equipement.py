"""Retire le fond clair des planches d'équipement illustrées.

Le fond est détecté depuis les bords : les blancs, gris très clairs et le
damier éventuellement aplati disparaissent, sans effacer les reflets blancs
enfermés à l'intérieur des contours sombres des objets.
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "img" / "planches" / "equipement-illustre"
OUTPUT = ROOT / "img" / "planches" / "equipement-illustre-transparent"


def detourer(source: Path, output: Path) -> None:
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image, dtype=np.int16)
    mini = rgb.min(axis=2)
    maxi = rgb.max(axis=2)
    chroma = maxi - mini

    # Blanc uniforme des générations finales et deux tons du damier de la
    # toute première planche. La propagation depuis les bords empêche cette
    # règle de traverser les contours noirs d'une arme ou d'une armure.
    candidat = (mini >= 218) & (chroma <= 34)
    graines = np.zeros(candidat.shape, dtype=bool)
    graines[0, :] = candidat[0, :]
    graines[-1, :] = candidat[-1, :]
    graines[:, 0] = candidat[:, 0]
    graines[:, -1] = candidat[:, -1]
    fond = ndimage.binary_propagation(graines, mask=candidat)

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
