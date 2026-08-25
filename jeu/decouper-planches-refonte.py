"""Nettoie, contrôle et découpe les planches 4 × 4 de la refonte.

Une planche refusée n'est jamais découpée : 16 cellules, contenu dans
chaque cellule et alpha réel sur les bords sont vérifiés avant écriture.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]

SHEETS = {
    "img/planches/outils/outils-metiers-01.png": (
        "img/outils",
        ["peche", "bois", "champs", "elevage", "mine", "feu", "forge", "tissage",
         "cuisine", "savoir", "batisse", "guerre", "poterie", "negoce", "entretien", "loisirs"],
    ),
    "img/planches/objets/alchimie-potions-03.png": (
        "img/objets/alchimie",
        ["voile-spores", "serum-lunaire", "essence-azur", "venin-couronne",
         "elixir-astres", "huile-braise", "prisme-givre", "distillat-nuee",
         "tonique-epines", "fiole-foudre", "baume-geant", "potion-miroir",
         "essence-chance", "brouillard-sommeil", "coeur-liquide", "elixir-neuf-vies"],
    ),
    "img/planches/objets/cuisine-recettes-03.png": (
        "img/objets/cuisine",
        ["ragout-sous-bois", "veloute-lunaire", "tourte-morille-azur", "brochette-amanite-reine",
         "consomme-astres", "brioche-verger", "cassolette-port", "festin-garnison",
         "pain-noix-miel", "gratin-racines", "terrine-fumoir", "tarte-champignons-lune",
         "soupe-cendre", "fromage-herbes", "ration-capitaine", "banquet-neuf-vies"],
    ),
    "img/planches/ressources/ressources-trouvailles-01.png": (
        "@res",
        ["champignon", "champignon_lune", "champignon_azur", "champignon_reine", "champignon_astre",
         "poussiere_trempe", "sceauancien", "eclatnuee", "braisevivante", "veninreine",
         "givreancien", "resine", "ambre", "perle", "ecaille", "relique"],
    ),
    "img/planches/iles/iles-carte-papier-01.png": (
        "img/iles/carte",
        ["guerriere-v01", "guerriere-v02", "guerriere-v03", "guerriere-v04",
         "marecageuse-v01", "marecageuse-v02", "marecageuse-v03", "marecageuse-v04",
         "volcanique-v01", "volcanique-v02", "volcanique-v03", "volcanique-v04",
         "arcanique-v01", "arcanique-v02", "arcanique-v03", "arcanique-v04"],
    ),
    "img/planches/objets/uniques-aventure-01.png": (
        "img/objets/aventure/uniques",
        ["brisemur", "faucheuse", "oeildelynx", "trait9", "barilnoir", "pavois", "serment", "cape9",
         "heaumecri", "bottesfumee", "gantsronces", "larme", "refrain", "dentcreuse", "fioleverte", "braisier"],
    ),
    "img/planches/objets/uniques-aventure-02.png": (
        "img/objets/aventure/uniques",
        ["cendrier", "lamegivre", "coeurgel", "fourche", "paratonnerre", "voilenoir", "crocombre", "osselet",
         "suaire", "fendoir", "massacre", "harnaisdos", "ancre", "cridefer", "halte", "jugement"],
    ),
    "img/planches/objets/uniques-aventure-03.png": (
        "img/objets/aventure/uniques",
        ["sanctuaire", "mainsjointes", "talonvif", "cormarche", "etendard", "oeilrepere",
         "tresor-coffret-nuee", "tresor-idole-neuf-vies", "tresor-couronne-fond", "tresor-carte-effacee",
         "tresor-cle-abyme", "tresor-oeuf-cristal", "tresor-reliquaire", "tresor-boussole-noire",
         "tresor-lanterne-ame", "tresor-des-maudit"],
    ),
}


def transparent_background(src: Image.Image) -> Image.Image:
    """Retire uniquement un fond neutre connecté aux bords."""
    im = src.convert("RGBA")
    w, h = im.size
    px = im.load()
    candidate = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or (min(r, g, b) >= 216 and max(r, g, b) - min(r, g, b) <= 24):
                candidate[y * w + x] = 1
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft(); i = y * w + x
        if seen[i] or not candidate[i]:
            continue
        seen[i] = 1
        px[x, y] = (*px[x, y][:3], 0)
        if x: q.append((x - 1, y))
        if x + 1 < w: q.append((x + 1, y))
        if y: q.append((x, y - 1))
        if y + 1 < h: q.append((x, y + 1))
    return im


def normalize(cell: Image.Image, size: int = 384, content: int = 332) -> tuple[Image.Image, tuple[int, int, int, int]]:
    alpha = cell.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bbox:
        raise ValueError("cellule vide")
    # Une silhouette qui touche une frontière indique un mauvais découpage.
    marge = min(bbox[0], bbox[1], cell.width - bbox[2], cell.height - bbox[3])
    if marge < 2:
        raise ValueError(f"contenu contre une frontière (marge {marge}px)")
    crop = cell.crop(bbox)
    scale = min(content / crop.width, content / crop.height)
    nw, nh = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(crop, ((size - nw) // 2, (size - nh) // 2))
    return canvas, bbox


def adaptive_bounds(im: Image.Image, vertical: bool) -> list[int]:
    """Trouve le centre des trois gouttières réelles proches des quarts.

    ImageGen respecte l'ordre 4 × 4 mais peut décaler une rangée de quelques
    pixels. Couper aveuglément à 25 % amputait alors une lame. On cherche la
    plus longue bande entièrement transparente autour de chaque quart.
    """
    a = im.getchannel("A")
    dim = im.width if vertical else im.height
    autre = im.height if vertical else im.width
    occ = []
    for p in range(dim):
        if vertical:
            occ.append(sum(1 for q in range(autre) if a.getpixel((p, q)) > 8))
        else:
            occ.append(sum(1 for q in range(autre) if a.getpixel((q, p)) > 8))
    out = [0]
    rayon = max(8, round(dim * .10))
    for k in (1, 2, 3):
        centre = round(k * dim / 4)
        lo, hi = max(out[-1] + 4, centre - rayon), min(dim - 4, centre + rayon)
        bandes, debut = [], None
        seuil = max(1, round(autre * .002))
        for p in range(lo, hi + 1):
            if occ[p] <= seuil and debut is None:
                debut = p
            if (occ[p] > seuil or p == hi) and debut is not None:
                fin = p if occ[p] <= seuil and p == hi else p - 1
                bandes.append((debut, fin)); debut = None
        if not bandes:
            raise ValueError(f"aucune gouttière transparente près de {k}/4")
        bandes.sort(key=lambda b: ((b[1] - b[0]), -abs((b[0] + b[1]) / 2 - centre)), reverse=True)
        b = bandes[0]
        out.append(round((b[0] + b[1]) / 2))
    out.append(dim)
    return out


def process(path_rel: str, target_rel: str, names: list[str]) -> dict:
    if len(names) != 16:
        raise ValueError(f"{path_rel}: le catalogue ne contient pas 16 noms")
    path = ROOT / path_rel
    if not path.exists():
        return {"sheet": path_rel, "status": "missing"}
    clean = transparent_background(Image.open(path))
    alpha = clean.getchannel("A")
    if alpha.getextrema()[0] != 0:
        raise ValueError(f"{path_rel}: aucun alpha transparent après nettoyage")
    corners = [alpha.getpixel((0, 0)), alpha.getpixel((clean.width - 1, 0)),
               alpha.getpixel((0, clean.height - 1)), alpha.getpixel((clean.width - 1, clean.height - 1))]
    if any(c != 0 for c in corners):
        raise ValueError(f"{path_rel}: coins non transparents {corners}")
    clean.save(path, optimize=True)
    target = None if target_rel == "@res" else ROOT / target_rel
    if target is not None:
        target.mkdir(parents=True, exist_ok=True)
    w, h = clean.size
    # Les plats larges ne s'alignent pas toujours sur une gouttière verticale
    # unique pour les quatre rangées. On détecte donc les colonnes séparément
    # dans chaque rangée : aucun plat ne peut être amputé par la silhouette
    # d'une autre rangée.
    ys = adaptive_bounds(clean, False)
    xs_par_rangee = [
        adaptive_bounds(clean.crop((0, ys[row], clean.width, ys[row + 1])), True)
        for row in range(4)
    ]
    icons = []
    for i, name in enumerate(names):
        row, col = divmod(i, 4)
        xs = xs_par_rangee[row]
        x0, x1 = xs[col], xs[col + 1]
        y0, y1 = ys[row], ys[row + 1]
        icon, bbox = normalize(clean.crop((x0, y0, x1, y1)))
        if target_rel == "@res":
            out = ROOT / "img" / "res" / name / f"{name}.png"
            out.parent.mkdir(parents=True, exist_ok=True)
        else:
            out = target / f"{name}.png"
        icon.save(out, optimize=True)
        icons.append({"id": name, "file": out.relative_to(ROOT).as_posix(), "sourceBox": bbox})
    return {"sheet": path_rel, "status": "ok", "size": clean.size,
            "boundaries": {"xByRow": xs_par_rangee, "y": ys}, "icons": icons}


def main() -> None:
    report = [process(path, target, names) for path, (target, names) in SHEETS.items()]
    out = ROOT / "img" / "planches" / "refonte-manifest.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = [r for r in report if r["status"] == "ok"]
    print(f"{len(ok)} planche(s) validée(s), {sum(len(r['icons']) for r in ok)} icônes découpées")
    for r in report:
        print(r["status"], r["sheet"])


if __name__ == "__main__":
    main()
