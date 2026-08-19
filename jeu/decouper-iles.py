"""Découpe déterministe des planches d'îles 4 x 4.

Contrairement à l'ancien découpage par détection de silhouettes, les limites
viennent uniquement de la grille. Une fumée ou une lueur ne peut donc jamais
être prise pour une illustration voisine. Chaque cellule est ensuite recentrée
dans un carré identique, sans étirer son contenu.
"""
from pathlib import Path
from PIL import Image

RACINE = Path(__file__).resolve().parents[1]
PLANCHES = RACINE / "img" / "planches" / "iles"
SORTIE = RACINE / "img" / "iles"
BIOMES = ("guerriere", "marecageuse", "volcanique", "arcanique")
TAILLE = 320
MARGE = 18


def limites(longueur: int) -> list[int]:
    """Quatre parts exactes, y compris lorsque la planche fait 1254 px."""
    return [(i * longueur) // 4 for i in range(5)]


def nettoyer(cellule: Image.Image) -> Image.Image:
    cellule = cellule.convert("RGBA")
    px = cellule.load()
    # Les générations portent parfois un halo alpha 1..11 sur le fond.
    for y in range(cellule.height):
        for x in range(cellule.width):
            r, g, b, a = px[x, y]
            if a < 12:
                px[x, y] = (r, g, b, 0)

    alpha = cellule.getchannel("A")
    boite = alpha.getbbox()
    if not boite:
        return Image.new("RGBA", (TAILLE, TAILLE))
    objet = cellule.crop(boite)
    max_cote = TAILLE - MARGE * 2
    echelle = min(max_cote / objet.width, max_cote / objet.height, 1.0)
    if echelle < 1:
        objet = objet.resize(
            (max(1, round(objet.width * echelle)), max(1, round(objet.height * echelle))),
            Image.Resampling.LANCZOS,
        )
    cadre = Image.new("RGBA", (TAILLE, TAILLE))
    cadre.alpha_composite(objet, ((TAILLE - objet.width) // 2, (TAILLE - objet.height) // 2))
    return cadre


def decouper(planche: Path, tier: int) -> int:
    image = Image.open(planche).convert("RGBA")
    xs, ys = limites(image.width), limites(image.height)
    n = 0
    for ligne, biome in enumerate(BIOMES):
        for colonne in range(4):
            cellule = image.crop((xs[colonne], ys[ligne], xs[colonne + 1], ys[ligne + 1]))
            nom = f"tier-{tier:02d}-{biome}-v{colonne + 1:02d}.png"
            nettoyer(cellule).save(SORTIE / nom, optimize=True)
            n += 1
    return n


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    total = 0
    for tier in range(1, 11):
        planche = PLANCHES / f"iles-tier-{tier:02d}.png"
        if not planche.exists():
            raise FileNotFoundError(planche)
        total += decouper(planche, tier)
    print(f"{total} îles découpées sur grille fixe dans {SORTIE}")


if __name__ == "__main__":
    main()
