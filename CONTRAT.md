# Ce que le noyau lit — et rien de plus

Ce fichier est **généré depuis le code**. Il ne dicte pas comment refaire le jeu :
il dit seulement ce que les moteurs conservés vont chercher à l'extérieur d'eux-mêmes.
Tout ce qui n'est pas listé ici est libre.

Le **noyau** — celui dont le fonctionnement doit être préservé — c'est :

- `battle-core.js`, `battle-mapgen.js`, `battle-terrain.js` — les batailles de l'Expédition
- `adventure.js` — l'arène de l'Aventure
- `data-units.js` — les 26 unités, leurs stats, leurs évolutions et leurs 90 pouvoirs
- `sprites-*.js` et `model3d.js` — les sprites

`data-forge.js` accompagne les sprites : c'est le vocabulaire visuel de
l'équipement (10 lignes × 40 tiers), ce que les sprites dessinent réellement.
Le remplacer est possible, mais l'allure des unités change avec lui.

Les six autres fichiers sont du **contexte** : la campagne, la carte, la
descente, le roster, le butin, les écrans. Ils sont fournis pour montrer comment
le noyau était alimenté, pas pour être conservés. Les remplacer, les réécrire ou
les jeter ne casse pas les moteurs.

## Le strict minimum

Sans ça, les moteurs ne tournent pas. C'est tout ce qui est vraiment exigé.

### `GameData` — 4 entrées

`FACTIONS` · `mix()` · `other()` · `shade()`

Trois utilitaires de couleur et la table des deux camps. Rien qui touche à
l'économie, aux coûts ou au rythme du jeu. Leur source complète est plus bas :
il n'y a rien à deviner.

### `GameState` — 1 entrée

`state`

`state` est l'objet de sauvegarde brut. Le reste de ce que le noyau lit dans
`GameState` est déjà fourni par `state-general.js`, si tu le gardes.

### `FX` — 3 entrées

`burst()` · `ring()` · `sfx()`

Des effets décoratifs. Trois fonctions vides suffiraient à faire tourner le jeu.

### `UI` — rien

Le noyau n'appelle **jamais** l'interface. Les moteurs sont indépendants de l'écran.

## Offert si tu gardes les fichiers de contexte

Ces entrées sont déjà écrites dans le dossier. Les garder évite de les refaire ;
les remplacer par autre chose de cohérent marche aussi.

**`GameData`** (16) — 
`ALLY_NAMES` · `ARMORS` · `BALANCE` · `BLADES` · `MAP_BOSSES` · `ORDNANCE` · `RANGED` · `ROBES` · `SHIELDS` · `SPELLS` · `STAFFS` · `SUITS` · `VESTS` · `WEAPONS` · `spellStats()` · `stageGarrisonMult()`

**`GameState`** (8) — 
`canStartDescent()` · `combatStats()` · `gen()` · `heroClassOf()` · `heroPowerIds()` · `heroStance()` · `heroState()` · `talentBonuses()`

## La forme que lisent les sprites

`data-units.js` et `data-forge.js` satisfont déjà tout ce tableau : il n'y a
rien à faire. Il n'a d'intérêt que si tu décides de **remplacer** ces tables —
alors les sprites continueront de les lire ainsi.

| ce qui est lu | forme attendue |
|---|---|
| `shade(couleur, delta)` | Fonction de teinte. **152 appels** : la plus sollicitée du lot |
| `mix()`, `visualRank()`, `evoPalette()`, `projPalette()` | Utilitaires de couleur et de rang |
| `FACTIONS` | Objet à deux clés, `cats` et `birds`, chacune avec au moins `acc` |
| `UNIT_TYPES` | Objet indexé par identifiant, chaque entrée ayant `cat` (`melee`, `tir`, `magie`, `explosif`, `garde`) |
| `WEAPONS`, `BLADES`, `RANGED`, `STAFFS`, `ORDNANCE` | Tableaux ordonnés par tier. Champs lus selon l'arme : `kind`, `shape`, `size`, `len`, `gem`, `glow`, `wings`, `fx`… |
| `ARMORS` | Tableau ordonné par tier, entrées avec `capeC` (et `metalC` facultatif) |
| `ROBES`, `VESTS`, `SUITS`, `SHIELDS` | Tableaux ordonnés par tier, chaque entrée portant un objet `style` |

La **longueur** de ces tableaux est libre : le code borne l'indice par
`TABLE.length - 1` et étale les paliers visuels sur la longueur disponible.
Six tiers ou vingt, peu importe — seul l'ordre compte. Les champs manquants
retombent sur des valeurs par défaut : une table minimale donne des sprites
sobres, pas une erreur.

## Les utilitaires manquants, en entier

Ils sont trop petits pour mériter d'être devinés. Voici leur source, telle
qu'elle était. Les reprendre ou les réécrire, peu importe.

```js
function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0]+h[0] + h[1]+h[1] + h[2]+h[2];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgb2hex(r, g, b) {
  return '#' + [r,g,b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function mix(a, b, t) {           // interpolation linéaire entre deux couleurs
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t);
}
function shade(c, t) {            // t > 0 éclaircit, t < 0 assombrit
  return t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t);
}

GameData.mix = mix;
GameData.shade = shade;
GameData.other = f => (f === 'cats' ? 'birds' : 'cats');   // la faction adverse
```

Et `FACTIONS`, dont le noyau ne lit que deux champs — une couleur d'accent et
un nom. Tout le reste (identité, devise, chef) est libre :

```js
GameData.FACTIONS = {
  cats:  { name: 'Les Chats',   acc: '#f08c42' },
  birds: { name: 'Les Oiseaux', acc: '#48a9d8' },
};
```

Les deux camps sont une hypothèse du moteur : `other()` bascule de l'un à
l'autre, et les sprites se teintent avec `acc`.

## L'ordre de chargement

Vraie contrainte technique, celle-là : ce sont des `<script>` classiques à
portée partagée. Pour les sprites, l'ordre est `model3d.js` → `sprites-core.js`
→ `sprites-weapons.js` → `sprites-armor.js` → `sprites-units.js` →
`sprites-index.js`. `GameData` doit exister avant eux.

`sprites-index.js` publie 28 fonctions dont 15 viennent de modules absents
(bâtiments, monde, effets, boss) : les écrire, ou les retirer de l'index.

## Ce qui est libre

Tout le reste. Les ressources, le village, la production, les bâtiments, le
recrutement, la progression, les écrans, la sauvegarde — mais aussi la campagne
d'expédition, l'arbre de nœuds, les villes, la structure de la descente, les
héros, le butin et les objets. Le noyau n'en dépend pas.
