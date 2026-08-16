# Trois systèmes d'un jeu de navigateur — un noyau et son contexte

Ce document décrit le **code** livré ici : un extrait d'un jeu écrit en
JavaScript, pas un projet complet. D'autres matériaux peuvent l'accompagner dans
ce dossier ; ils parlent d'eux-mêmes.

**18 fichiers, 24 490 lignes**, dans quatre répertoires. Aucune dépendance
externe, aucun outil de build, aucun fichier image.

## La mission

Reconstruire le jeu autour de ce noyau : le système de ressources, le village,
l'économie, la progression — et tout ce qui semblera juste.

Quatre choses doivent continuer de **fonctionner comme aujourd'hui** :

1. **les batailles de l'Expédition** (`battle-core.js` et ses deux compagnons) ;
2. **l'arène de l'Aventure** (`adventure.js`) ;
3. **les unités et leurs pouvoirs** (`data-units.js`) : 26 types, leurs stats,
   leurs évolutions et leurs 90 pouvoirs activables — tourbillon, charge, gel,
   vampirisme, épines, volée… répartis sur 19 mécaniques que le moteur de
   bataille sait déjà exécuter ;
4. **les sprites** (`sprites-*.js`, `model3d.js`), avec le vocabulaire visuel de
   l'équipement qu'ils dessinent (`data-forge.js`).

Ce qui les entoure — la campagne, l'arbre de nœuds, les villes, la structure de
la descente, le roster, le butin, les écrans — est fourni pour montrer comment
ces moteurs étaient alimentés, **pas pour être conservé**. Le remplacer par autre
chose est non seulement permis, c'est attendu.

Ces moteurs ne demandent presque rien à l'extérieur : **quatre entrées**, l'objet
de sauvegarde, trois fonctions d'effets, et rien du tout côté interface. Trois de
ces quatre entrées sont des utilitaires de couleur, donnés en entier dans
`CONTRAT.md` — il n'y a rien à deviner.

---

## Comment ce code est fait

Cinq conventions à connaître avant de lire quoi que ce soit.

**Pas de modules.** Aucun `import`, aucun `export` dans tout l'extrait. Chaque
fichier est un `<script>` classique chargé dans un ordre précis, et tout se
rejoint sur des espaces de noms globaux : `window.Battle`, `window.Progression`,
`window.Adventure`, `window.Sprites`, `window.GameData`, `window.Model3D`.

**La portée est partagée.** C'est le piège principal. Les fichiers d'une même
famille ne sont pas indépendants : ils se lisent comme un seul fichier découpé.
`sprites-core.js` déclare `US`, `FRAMES`, `UNIT_DIRS` et `SGD` au niveau global ;
`sprites-units.js`, `sprites-weapons.js` et `sprites-armor.js` s'en servent sans
les redéclarer. `sprites-units.js` déclare `bakeQ`, que `sprites-index.js`
consomme. Charger ces fichiers dans le désordre produit une `ReferenceError`.

**L'ordre est écrit dans les en-têtes.** Les commentaires de tête portent leur
rang : `(1/3)`, `(4/9)`, `(6/6, dernier — dépendances d'ordre)`. Le fichier
`index` d'une famille vient toujours en dernier et assemble le namespace public.

**Tout est dessiné, rien n'est chargé.** Les sprites sont du code : des canvas 2D
remplis par de l'art procédural (dégradés radiaux, rayures en multiply, tri
peintre pseudo-3D). Il n'existe aucun PNG d'unité, d'arme ou d'armure — la
silhouette, l'arme, l'armure et les insignes de rang sont composés à la volée,
puis pré-rendus en 16 directions et 16 frames de marche.

**La langue du code est le français**, commentaires comme identifiants.

---

## Ce que contient le dossier

### `expedition/` — 9 771 lignes

Le mode de conquête : une carte, un parcours à embranchements, et des batailles
temps réel où l'on envoie des troupes d'un camp vers un autre.

| fichier | lignes | | rôle, d'après son propre en-tête |
|---|---:|---|---|
| `battle-core.js` | 5 157 | **noyau** | Le moteur de bataille façon « Mushroom Wars » → `window.Battle`. Dépend de `GameData`, `Sprites`, `FX` |
| `battle-mapgen.js` | 598 | **noyau** | Génération de carte, sérialisation, résolution hors-ligne. Pur, sans état |
| `battle-terrain.js` | 459 | **noyau** | Décors (ombre, étendard, avant-poste) et terrain pré-rendu par thème |
| `progression.js` | 2 277 | contexte | Carte globale des villes → parcours en ville isométrique avec embranchements → batailles par étapes |
| `data-battle.js` | 435 | contexte | Sorts et grimoire, forge, ingénierie de guerre, boss de carte, constantes d'équilibrage |
| `data-world.js` | 845 | contexte | Villes, arbre d'expédition, objectifs, prestige. Se termine par une IIFE auto-exécutée |

### `aventure/` — 10 035 lignes

Une descente infinie en donjon : une compagnie de héros, des arènes carrées
successives, du butin, des talents.

| fichier | lignes | | rôle, d'après son propre en-tête |
|---|---:|---|---|
| `adventure.js` | 5 740 | **noyau** | L'arène tactique : une salle carrée de 13×13 carreaux, les combattants y entrent, s'y battent, en sortent |
| `data-general.js` | 1 818 | contexte | Héros nommés, biomes, salles, butin, objets, reliques, plans. Tout vient de tables : aucune salle écrite à la main |
| `state-general.js` | 1 269 | contexte | Le moteur : roster, compagnie, descente, butin, talents. Modèle « façon Diablo » |
| `ui-general.js` | 1 208 | contexte | L'écran : l'arène en canvas, les portraits, les postures |

### `unites/` — 1 659 lignes

Les combattants et ce qu'ils portent.

| fichier | lignes | | rôle |
|---|---:|---|---|
| `data-units.js` | 601 | **noyau** | 26 types d'unités : ordre, catégories, stats de base, évolutions, rangs — et `UNIT_POWERS`, les 90 pouvoirs activables |
| `data-forge.js` | 1 058 | **noyau visuel** | Les 10 lignes d'équipement (40 tiers chacune) : armes, lames, armures, boucliers, tir, bâtons, munitions, robes, gilets, cuirasses |

Les pouvoirs sont déclarés par unité et par rang — `PW('lancier', 'tourbillon',
'Moulinet moustachu', '🌀', …, { cd: 15, pct: 1.2, radius: 40 })` — et se
répartissent sur **19 mécaniques** que `battle-core.js` sait déjà exécuter :
tourbillon, charge, gel, soin, épines, vampirisme, volée, pluie de flèches,
perçant, rebond, zone, siège, traînée, régénération, focus, cri, pavois,
antimagie, familier.

`data-units.js` est **autonome** : tout ce qu'il lit, il le définit lui-même.

`data-forge.js` ne contient pas de règles de forge, seulement des descripteurs
visuels : `{ len, shaftC, blade, bladeC1, guard, gem, glow, wings, fx }` par
palier. C'est l'apparence des armes et des armures, pas leur économie.

### `sprites/` — 3 025 lignes

Les sprites des unités, des armes et des armures. Ce sont des générateurs, pas
des images — et ce sont eux qui imposent la forme des tables d'équipement
listées dans `CONTRAT.md`. **Les six fichiers sont du noyau.**

| fichier | lignes | rôle |
|---|---:|---|
| `sprites-core.js` | 105 | La base de la bibliothèque d'art procédural, et les constantes partagées par toute la famille |
| `sprites-units.js` | 423 | Rang → couleurs (cape, crête, couronne), file de génération asynchrone, frames d'unité |
| `sprites-weapons.js` | 1 097 | Les armes : lames, armes de jet, bâtons, explosifs |
| `sprites-armor.js` | 788 | Les armures : robes, vestes, harnois, boucliers |
| `sprites-index.js` | 44 | Assemble `window.Sprites`. **Prévu pour neuf modules ; il n'y en a que cinq ici** |
| `model3d.js` | 568 | Moteur pseudo-3D : projection orthographique, tri peintre par z. Les sprites d'unité s'appuient dessus |

---

## Ce que le noyau réclame — beaucoup moins qu'il n'y paraît

Les moteurs à préserver vont chercher des choses hors d'eux-mêmes, mais la liste
est courte. `CONTRAT.md` la donne nom par nom ; voici l'ordre de grandeur :

| espace de noms | exigé par le noyau |
|---|---|
| `GameData` | **4 entrées** : `FACTIONS` et trois utilitaires de couleur — dont la source complète est donnée dans `CONTRAT.md` |
| `GameState` | **l'objet `state`**, la sauvegarde brute |
| `FX` | **3 fonctions** décoratives — des coquilles vides suffiraient |
| `UI` | **rien.** Les moteurs ne touchent jamais à l'interface |

C'est tout. Les tables d'unités et d'équipement, qui formaient l'essentiel de
cette liste, sont maintenant dans le dossier. Les fichiers de contexte ajoutent
encore une vingtaine d'entrées par-dessus : les garder fait gagner du temps, les
remplacer ne casse rien.

Attention aux alias : `progression.js` lit `GD`, `battle-core.js` lit `BGD` et
les sprites lisent `SGD` — ce sont trois noms pour le même `GameData`.

Côté sprites, **quatre des neuf modules sont absents** (bâtiments, monde,
effets, boss). `sprites-index.js` est fourni quand même, parce qu'il documente
toute la surface publique : sur ses 28 fonctions, 13 sont présentes — exactement
celles des unités, des armes et des armures — et 15 renvoient à du code absent
(`getBossCanvas`, `getNodeCanvas`, `getEmblem`, `drawMascot`, `getTerrainRef`…).
En l'état, ce fichier lèverait donc une `ReferenceError` : c'est une carte, pas
un point d'entrée fonctionnel.

Tout le reste du jeu manque, et c'est le sujet : l'économie, la production, le
village, les écrans, la sauvegarde, la coque applicative, le fichier qui décide
de l'ordre de chargement. Rien de tout cela n'est imposé — le noyau ne demande
que les quatre entrées ci-dessus. Le jeu qui les entoure est à inventer.

---

## Note d'usage

Ce dossier est une **copie**. Le jeu d'origine n'a pas été modifié et continue
de tourner avec ses propres fichiers ; rien de ce qui sera fait ici ne le
touchera. Aucun secret, aucune clé, aucune donnée de joueur n'a été copiée.
