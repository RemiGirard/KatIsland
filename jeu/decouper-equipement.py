"""Reconstruit les 240 illustrations d'équipement avec une grille exacte.

Les armes v2 peuvent contenir le damier aplati du générateur : il est retiré
depuis le bord de chaque cellule avant toute mesure. Aucun cadrage automatique
global n'est utilisé, ce qui empêche un sprite de glisser dans la case voisine.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from collections import deque

ROOT = Path(__file__).resolve().parents[1]
PLANCHES = ROOT / "img" / "planches"
V2 = PLANCHES / "equipement-v2"
ILLUSTRE = PLANCHES / "equipement-illustre"
SORTIE = ROOT / "img" / "equipement-v2"
FAMILLES = ("melee", "distance", "magie")
PIECES = ("armes", "armures")


def bornes(total: int) -> list[int]:
    return [round(i * total / 4) for i in range(5)]


def retirer_fond(cellule: Image.Image) -> Image.Image:
    """Détoure seulement le fond relié aux quatre bords de la cellule."""
    rgb = cellule.convert("RGB")
    arr = np.asarray(rgb)
    # Les deux couleurs du damier deviennent une même image binaire. Ainsi
    # toutes les cases se touchent, contrairement au remplissage couleur.
    maxi, mini = arr.max(axis=2), arr.min(axis=2)
    candidat = ((maxi - mini) < 12) & (arr.mean(axis=2) > 195)
    h, w = candidat.shape
    fond = np.zeros_like(candidat)
    file = deque()
    for x in range(w):
        if candidat[0, x]: file.append((0, x))
        if candidat[h - 1, x]: file.append((h - 1, x))
    for y in range(h):
        if candidat[y, 0]: file.append((y, 0))
        if candidat[y, w - 1]: file.append((y, w - 1))
    while file:
        y, x = file.popleft()
        if fond[y, x] or not candidat[y, x]:
            continue
        fond[y, x] = True
        for yy in range(max(0, y - 1), min(h, y + 2)):
            for xx in range(max(0, x - 1), min(w, x + 2)):
                if not fond[yy, xx] and candidat[yy, xx]:
                    file.append((yy, xx))
    alpha = Image.fromarray((~fond).astype(np.uint8) * 255, "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.55))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def retirer_debordements(cellule: Image.Image, centre: tuple[int, int] | None = None) -> Image.Image:
    """Écarte les morceaux d'un voisin ayant franchi une ligne de grille."""
    a = np.asarray(cellule.getchannel("A")) >= 14
    h, w = a.shape
    vu = np.zeros_like(a)
    composants = []
    for y0 in range(h):
        for x0 in range(w):
            if not a[y0, x0] or vu[y0, x0]:
                continue
            file = deque([(y0, x0)]); vu[y0, x0] = True; points = []
            while file:
                y, x = file.popleft(); points.append((y, x))
                for yy in range(max(0, y - 1), min(h, y + 2)):
                    for xx in range(max(0, x - 1), min(w, x + 2)):
                        if a[yy, xx] and not vu[yy, xx]:
                            vu[yy, xx] = True; file.append((yy, xx))
            composants.append(points)
    if len(composants) < 2:
        return cellule
    if centre is None:
        principal = max(composants, key=len)
    else:
        cx, cy = centre
        # Le bon sprite est celui centré dans la case demandée, même si une
        # arme voisine plus grosse déborde dans la marge de récupération.
        principal = min(composants, key=lambda pts:
            ((sum(p[1] for p in pts) / len(pts) - cx) ** 2
             + (sum(p[0] for p in pts) / len(pts) - cy) ** 2) / max(1, len(pts) ** .35))
    ys = np.array([p[0] for p in principal]); xs = np.array([p[1] for p in principal])
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    garder = np.zeros_like(a)
    for y, x in principal: garder[y, x] = True
    # Les halos utiles touchent déjà l'objet dans les planches. Les morceaux
    # réellement séparés sont soit de la poussière, soit un voisin entré dans
    # la marge de récupération : aucun n'est conservé.
    arr = np.asarray(cellule).copy()
    arr[~garder] = 0
    return Image.fromarray(arr, "RGBA")


def normaliser(cellule: Image.Image, taille: int = 384) -> Image.Image:
    alpha = cellule.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a >= 12 else 0).getbbox()
    if not bbox:
        raise ValueError("cellule vide")
    objet = cellule.crop(bbox)
    # 12 % de marge minimale : les effets ne toucheront jamais un bord.
    max_obj = round(taille * .76)
    facteur = min(max_obj / objet.width, max_obj / objet.height, 1.0)
    if facteur < 1:
        objet = objet.resize((max(1, round(objet.width * facteur)),
                              max(1, round(objet.height * facteur))), Image.Resampling.LANCZOS)
    canevas = Image.new("RGBA", (taille, taille), (0, 0, 0, 0))
    canevas.alpha_composite(objet, ((taille - objet.width) // 2,
                                    (taille - objet.height) // 2))
    # Nettoyage des dernières poussières sur le bord.
    arr = np.asarray(canevas).copy()
    arr[:3, :, 3] = arr[-3:, :, 3] = 0
    arr[:, :3, 3] = arr[:, -3:, 3] = 0
    return Image.fromarray(arr, "RGBA")


def planche_pour(famille: str, piece: str, numero: int) -> tuple[Path, bool]:
    nom = f"{famille}-{piece}-{numero:02d}.png"
    if piece == "armes" and famille in ("melee", "distance"):
        return V2 / nom, True
    return ILLUSTRE / nom, True


def main() -> None:
    compte = 0
    for famille in FAMILLES:
        for piece in PIECES:
            dest = SORTIE / famille / ("arme" if piece == "armes" else "armure")
            dest.mkdir(parents=True, exist_ok=True)
            tier = 1
            for numero in (1, 2, 3):
                source, fond_aplati = planche_pour(famille, piece, numero)
                if not source.exists():
                    raise FileNotFoundError(source)
                img = Image.open(source).convert("RGBA")
                xs, ys = bornes(img.width), bornes(img.height)
                nombre = 8 if numero == 3 else 16
                for index in range(nombre):
                    ligne, colonne = divmod(index, 4)
                    cible = dest / f"tier-{tier:02d}.png"
                    # Les fichiers encore présents ont déjà été validés par le
                    # joueur. On restaure seulement les trous, sauf pour les
                    # deux séries d'armes explicitement régénérées.
                    marge = round(min(img.width, img.height) / 12)
                    gauche, haut = max(0, xs[colonne] - marge), max(0, ys[ligne] - marge)
                    droite, bas = min(img.width, xs[colonne + 1] + marge), min(img.height, ys[ligne + 1] + marge)
                    cellule = img.crop((gauche, haut, droite, bas))
                    centre = ((xs[colonne] + xs[colonne + 1]) // 2 - gauche,
                              (ys[ligne] + ys[ligne + 1]) // 2 - haut)
                    if fond_aplati or cellule.getchannel("A").getextrema() == (255, 255):
                        cellule = retirer_fond(cellule)
                    cellule = retirer_debordements(cellule, centre)
                    final = normaliser(cellule)
                    final.save(cible, optimize=True)
                    tier += 1
                    compte += 1
            if tier != 41:
                raise RuntimeError(f"{famille}/{piece}: {tier - 1} tiers")
    print(f"{compte} sprites reconstruits dans {SORTIE}")


if __name__ == "__main__":
    main()
