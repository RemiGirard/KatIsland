"""Nettoie et découpe les planches 4 x 4 d'objets du jeu.

Les rendus peuvent contenir un faux damier aplati. Le masque de fond part
uniquement des bords et ne traverse que les pixels clairs et neutres : les
reflets blancs enfermés dans les objets restent donc intacts.
"""
from __future__ import annotations

from collections import deque
from pathlib import Path
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "img" / "planches" / "objets"
OUT = ROOT / "img" / "objets"

CATALOG = {
    "alchimie-potions-01": (
        "alchimie",
        ["soin", "antidote", "givre", "garde-feu", "garde-ombre", "garde-foudre",
         "peau-pierre", "celerite", "rage", "precision", "regeneration", "bouclier-arcane",
         "invisibilite", "bombe-alchimique", "glu", "rappel-vital"],
    ),
    "alchimie-potions-02": (
        "alchimie",
        ["totem-soin", "totem-rage", "confusion", "bombe-gel", "zone-soin", "leurre",
         "nuage-toxique", "purification", "force-geant", "esprit-vif", "vision-nocturne",
         "chance", "peau-fer", "bombe-feu", "acide", "phoenix"],
    ),
    "cuisine-recettes-01": (
        "cuisine",
        ["pain-rustique", "poisson-fume", "tourte-poisson", "galettes-miel", "confiture-baies",
         "tourte-farine-claire", "marmite-pecheur", "brochette-poisson", "soupe-legumes",
         "pain-fromage", "chausson-champignons", "ration-marche", "bouillie-lait-miel",
         "tarte-verger", "plateau-fromage", "racines-roties"],
    ),
    "cuisine-recettes-02": (
        "cuisine",
        ["chaudree-marin", "planche-fumee", "roti-miel", "champignons-farcis", "tarte-creme-baies",
         "cidre-epice", "galette-tournesol", "tourte-legumes", "petit-dejeuner-pecheur",
         "ragout-epice", "quenelles-fromage", "tourte-fete", "fruits-confits", "ration-secours",
         "soupe-aventurier", "banquet-village"],
    ),
    "aventure-stats-01": (
        "aventure/stats",
        ["hp", "esh", "dmg", "aspd", "mspd", "armor", "range", "esh-regen",
         "lifesteal", "armor-pen", "loot", "item-find", "rarity", "res-fire", "res-cold", "res-poison"],
    ),
    "aventure-armes-01": (
        "aventure/armes",
        ["epee", "hache", "lance", "masse", "dagues", "arc", "arbalete", "baton",
         "sceptre", "bombe", "rapiere", "couperet", "arme-hast", "marteau", "arc-recourbe", "baguette"],
    ),
    "aventure-armures-01": (
        "aventure/armures",
        ["casque-plaque", "casque-maille", "casque-cuir", "casque-robe",
         "armure-plaque", "armure-maille", "armure-cuir", "armure-robe",
         "gants-plaque", "gants-maille", "gants-cuir", "gants-robe",
         "bottes-plaque", "bottes-maille", "bottes-cuir", "bottes-robe"],
    ),
    "aventure-accessoires-01": (
        "aventure/accessoires",
        ["bouclier", "pavois", "amulette", "anneau", "fetiche", "longue-vue", "sac-aventurier",
         "carte-donjon", "cle-ancienne", "boussole", "lanterne", "grappin", "crochets",
         "grimoire", "orbe", "ceinture-potions"],
    ),
    "aventure-reliques-01": (
        "aventure/reliques",
        ["gamelle", "pelote", "sifflet", "enclume", "lanterne", "marmite", "sablier", "oeuf",
         "boussole", "graal", "etendard", "creuset", "couronne", "coeur", "meridien", "astrolabe"],
    ),
    "aventure-tresors-01": (
        "aventure/tresors",
        ["coffre", "coffre-royal", "bourse", "ecus", "rubis", "saphir", "emeraude", "perles",
         "plan", "parchemin-scelle", "croc", "ecaille-dragon", "coeur-biome", "oeil-abyme",
         "tablette", "reliquaire"],
    ),
}


def transparent_background(src: Image.Image) -> Image.Image:
    im = src.convert("RGBA")
    w, h = im.size
    px = im.load()
    candidate = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # Les deux tons du faux damier sont presque blancs et neutres.
            if min(r, g, b) >= 220 and max(r, g, b) - min(r, g, b) <= 22:
                candidate[y * w + x] = 1

    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or not candidate[i]:
            continue
        seen[i] = 1
        px[x, y] = (*px[x, y][:3], 0)
        if x: q.append((x - 1, y))
        if x + 1 < w: q.append((x + 1, y))
        if y: q.append((x, y - 1))
        if y + 1 < h: q.append((x, y + 1))
    return im


def normalize(cell: Image.Image, size: int = 384, content: int = 330) -> Image.Image:
    alpha = cell.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if not bbox:
        return canvas
    crop = cell.crop(bbox)
    scale = min(content / crop.width, content / crop.height)
    nw, nh = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.alpha_composite(crop, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def main() -> None:
    report = []
    for sheet_id, (folder, names) in CATALOG.items():
        path = SHEETS / f"{sheet_id}.png"
        if not path.exists():
            raise FileNotFoundError(path)
        clean = transparent_background(Image.open(path))
        clean.save(path, optimize=True)
        target = OUT / folder
        target.mkdir(parents=True, exist_ok=True)
        w, h = clean.size
        cells = []
        for i, name in enumerate(names):
            row, col = divmod(i, 4)
            x0, x1 = round(col * w / 4), round((col + 1) * w / 4)
            y0, y1 = round(row * h / 4), round((row + 1) * h / 4)
            icon = normalize(clean.crop((x0, y0, x1, y1)))
            out_path = target / f"{name}.png"
            icon.save(out_path, optimize=True)
            a = icon.getchannel("A")
            cells.append({"id": name, "file": out_path.relative_to(ROOT).as_posix(),
                          "opaqueBox": a.point(lambda v: 255 if v > 8 else 0).getbbox()})
        report.append({"sheet": path.relative_to(ROOT).as_posix(), "icons": cells})
    (SHEETS / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(report)} planches et {sum(len(x['icons']) for x in report)} icônes traitées")


if __name__ == "__main__":
    main()
