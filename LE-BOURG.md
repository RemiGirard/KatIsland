# Le Bourg — griffes, plumes et charpente

Un jeu de navigateur bâti autour du noyau livré dans ce dossier : un
**idle / incrémental de village** en pixel art, avec une descente
tactique en donjon et des batailles temps réel d'expansion.

Ouvrir le jeu :

```bash
node jeu/serveur.js
```

puis `http://localhost:8099`. Aucune dépendance, aucun outil de build.
La partie s'enregistre toute seule dans le navigateur (`localStorage`)
et le bourg continue de travailler en votre absence, jusqu'à douze
heures rattrapées.

---

## 1. Ce que le joueur fait

On commence avec **un chat, une rivière et rien d'autre**.

On bâtit une pêcherie — elle ne coûte rien —, on y met l'habitant, et le
poisson entre. Avec du poisson on paie une scierie ; avec du bois, une
maison ; avec un toit libre et de quoi manger, **il vient quelqu'un**.
Chaque habitant de plus est une barre de production de plus, et c'est là
tout le jeu : le bourg n'est pas limité par le temps, il est limité par
le nombre de pattes.

Puis la chaîne s'allonge — champ, moulin, four, carrière, mine,
charbonnière, fonderie, forge — et l'on finit par forger des **armes**,
des **harnois** et des **outils**. Les armes forment des unités au
terrain d'entraînement ; les unités prennent du **territoire** par le
portail d'expédition ; le territoire donne des cadences que rien
d'autre ne donne. Les harnois équipent la compagnie qui descend dans le
**Puits sans fond**, seul endroit d'où remontent les essences, les
gemmes, l'obsidienne et les **plans**.

L'objectif, c'est la profondeur : jusqu'où le bourg peut-il envoyer sa
compagnie, et en faire revenir quelque chose.

## 1 bis. Ce que le joueur décide

Trois décisions reviennent sans cesse, et elles se contredisent.

**Qui vit ici.** Personne ne s'installe tout seul. Quand un toit est
libre, on **ouvre les portes** — cela coûte des vivres (24 + 7 par
habitant), trois voyageurs se présentent, et l'on en garde **un**. Les
deux autres reprennent la route pour de bon, et refermer la fenêtre ne
relance pas les dés. Chaque postulant porte une **rareté** et deux à
quatre **traits**, qualités et défauts mêlés :

| rareté | qualités | défauts | niveau |
|---|---|---|---|
| Commun | 1 | 1 | 1 |
| Estimé | 2 | 1 | 1 |
| Rare | 2 | — | 2 |
| Insigne | 3 | 1 | 3 |
| Légende | 4 | — | 5, et +35 % sur son métier |

Il n'y a donc pas d'ordre évident : un Rare sans défaut vaut parfois
mieux qu'un Insigne Gourmand. Le tirage penche du bon côté quand le
bourg a de quoi séduire — moral, taverne, chapelle, donjon — et chaque
**renvoi** abîme sa réputation pour de bon.

**Qui, et où.** Chaque habitant naît avec un **métier de prédilection**
(+20 % dans ce métier). Il gagne des niveaux en travaillant, et cette
expérience le suit partout. La fenêtre d'affectation classe les
candidats par ce qu'ils rendraient *à ce poste précis*, en clair : ×1,42.
Les 35 traits ont des effets qui se lisent : Bricoleur use l'outillage
45 % moins vite, Casseur moitié plus ; Bavard fait perdre 7 % aux autres
postes de **son** bâtiment ; Distrait gâche un cycle sur douze ; Peureux
refuse net de descendre dans la tour.

**Quoi, et combien de fois.** Un poste ne se contente pas d'une tâche en
boucle : on lui donne un **compte** (×10, ×200, « tout ce que la réserve
permet ») et une **file** de tâches qui prendront le relais. On programme
sa nuit au lieu de la surveiller.

**Où passe le surplus.** Trois puits, trois rythmes : les **améliorations
d'atelier** (locales, payées en écus et en ce que l'atelier produit), les
**recherches du bourg** (globales, définitives, quatre branches qu'on ne
peut pas mener de front), et la **Charte** (fin de partie : tout repart,
on garde des sceaux).

**Qui descend, et ce qu'on risque.** L'équipée de la tour se compose
d'**habitants du bourg**. Ils quittent leur poste, ils emportent leur
niveau et leur caractère — un Fragile tombe avant les autres. S'ils
tombent, le corps attend en bas : on paie un **rite** pour aller le
chercher, ou l'on renonce, et renoncer coûte au bourg exactement ce que
coûte un renvoi.

## 2. Les trois contraintes

Un idle sans contrainte se joue tout seul. Celui-ci en a trois, et elles
se contredisent — c'est ce qui fait les décisions.

**Un poste = un habitant = une barre.** Un bâtiment n'agit pas seul : il
offre des postes, et un poste ne tourne que si quelqu'un s'y tient. Le
nombre d'habitants est le vrai plafond de la partie — et l'on ne
l'augmente qu'en bâtissant des toits, puis en ouvrant les portes.

**Le chantier est unique, et il réclame des bras.** Construire et
améliorer passent par une file d'attente commune à tout le bourg, qu'on
ordonne comme on veut — mais elle n'avance QUE si un habitant y est
affecté. Bâtir, c'est renoncer à produire. C'est la décision qu'on prend
vingt fois par partie.

**Les terrasses sont finies.** Chaque édifice occupe une parcelle réelle
sur l'une des trois terrasses du bourg. On peut défricher les buissons,
pas déplacer un voisin. À quarante bâtiments, la place manque — et il
faut choisir ce qu'on garde.

S'y ajoutent trois pressions.

Les **plafonds de stockage** par catégorie : ce qui dépasse est perdu, et
on le voit.

La **Menace**, qui monte toute seule dès que le bourg vaut la peine
d'être pillé — et qui **pèse tout du long**, par cinq paliers :

| jauge | état | cadence |
|---|---|---|
| 0–24 | Calme | entière |
| 25–44 | Guetté | −7 % |
| 45–67 | Pressé | −18 % |
| 68–87 | Assiégé | −32 % |
| 88–100 | Aux abois | −45 % |

Attendre les cent points, c'est subir le raid chez soi. La **sortie** —
une bataille calibrée sur la jauge du moment — la fait retomber de
30 + 45 %, garde les murs intacts, et ramasse ce que la colonne
transportait. C'est cher en bras, et c'est précisément la question :
faut-il des pêcheurs ou des lances ?

Le **malaise**, enfin : un renvoi ou une mort dans la tour ferme les
portes (3 min, ×1,35 à chaque récidive), fait tomber le moral de 14 et
ralentit tout le bourg de 14 à 42 %, le temps que la page se tourne.

## 2 bis. Le village en trois dimensions

Le rendu pixel-art a été remplacé par le village 3D du joueur,
**importé tel quel** depuis `village 3D.html` : même île, même côte,
même terrain, mêmes essences d'arbres, mêmes bâtiments et leurs parts,
mêmes toits, mêmes intérieurs, même cycle du jour. Rien n'y a été
redessiné.

- `jeu/3d/village-doc.js` — le script du document, verbatim. Quatre
  choses seulement y ont été retirées ou neutralisées, parce que le jeu
  s'en charge : la barre d'outils du bac à sable, la palette,
  l'enregistrement dans l'URL, et le peuplement aléatoire au démarrage.
  **L'île du jeu commence vide** ; le joueur la bâtit. Les entrailles
  sont exposées en fin de fichier (`window.__VDOC`).
- `jeu/3d/village3d.js` — l'adaptateur. Il ne dessine rien : il traduit.
  Un bâtiment du jeu devient un type du document (la forge du jeu
  appelle la Forge du document, avec ses quatre parts et sa cour) ; ce
  que le document ne connaît pas se bâtit en maison, dans une couleur
  choisie par catégorie. Il tient aussi la table cellule → bâtiment,
  qui fait qu'un clic sur n'importe quelle part — la cour, la tourelle,
  l'appentis — ouvre la bonne fenêtre.

| bâtiment du jeu | type du document |
|---|---|
| forge · cuisine · moulin · bergerie | Forge · Boulangerie · Moulin · Bergerie |
| pecherie · mine · scierie · laiterie | Pêcherie · Mine · Scierie · Laiterie |
| champ · herboristerie · rucher | Blé · Légumes · Fleurs |
| alchimie · taverne · nurserie | Alchimie · Auberge · Pépinière |
| descente · caserne | Tour sombre · Caserne |

La construction passe par les **bulles**, en bas de l'écran : chaque
plan appris y apparaît avec une pastille ; un clic, puis on désigne la
parcelle — la grille du document ne se montre qu'à ce moment-là. Pour
la **maison**, la palette se déplie et le joueur choisit la couleur de
ses murs, exactement comme dans le document.

## 3. L'interface

Il n'y a **pas de menu**. Le village occupe tout l'écran, et tout le
reste flotte au-dessus :

- **le bandeau**, en haut : des compteurs vivants, chacun cliquable —
  habitants, écus, vivres, moral, menace, chantier, heure ;
- **le dock**, à gauche, superposé au village : tous les chargements en
  cours, la file du chantier en tête, avec le temps restant, le lieu et
  le nom de celui qui travaille. Il se replie d'un clic (touche `O`) ;
- **les fenêtres flottantes** : cliquer un édifice ouvre sa fenêtre
  au-dessus de lui — postes, amélioration, outillage, notice. Cliquer le
  sol ouvre le carnet du maître d'œuvre. On les déplace, elles se
  souviennent de leur place.

Aucune émoji, aucune image : **toutes les icônes sont dessinées**, sur
une grille de 16×16, par `jeu/js/icones.js`.

Raccourcis : `O` dock · `C` chantier · `R` réserves · `H` habitants ·
`B` bourg · `G` réglages · `W` tout fermer · `Échap` fermer / annuler.

**L'interface ne se rebâtit pas, elle se fond.** Les fenêtres se
rafraîchissent cinq fois par seconde ; plutôt que de vider leur corps —
ce qui détruisait le bouton sous le curseur et faisait tout clignoter —
`UI.morphe()` fabrique l'affichage voulu à côté puis ne touche qu'aux
textes et attributs qui ont changé. Les nœuds survivent, et avec eux le
survol, le focus, le défilement et les transitions CSS. Mesuré à
55 tâches et 3 fenêtres ouvertes : 1 464 nœuds détruits par seconde
avant, 22 après ; 5,04 ms par rafraîchissement avant, 0,96 ms après.

## 4. Ce que le village montre

Le rendu n'est pas une illustration : il **dit l'état du jeu**.

- Un atelier sans ouvrier ne fume pas, sa roue ne tourne pas, son
  brasier est froid. Un bourg à l'arrêt se voit d'un coup d'œil.
- Les habitants affectés **rejoignent réellement leur poste** : ils
  prennent l'escalier de terrasse, longent l'étage et travaillent sur
  place. Les autres flânent.
- Chaque cycle terminé fait **monter au-dessus de l'atelier** la chose
  qui vient d'être produite, avec sa quantité.
- Un chantier est un vrai chantier : charpente nue et roue de levage, à
  l'emplacement exact — et à l'emprise exacte — du bâtiment à venir.
- Les **escaliers de terrasse** sont des ouvrages : volée de pierre qui
  fuit vers le fond, limons, bornes, et le sentier usé qui y mène.

## 4 bis. Les trois âges d'un édifice

Un atelier de niveau 1 et un atelier de niveau 9 ne peuvent pas se
ressembler. Plutôt que de redessiner quarante générateurs, le palier
agit là où **tout** passe : la couverture et le parement.

| niveaux | palier | couverture | parement | signes |
|---|---|---|---|---|
| 1–3 | rustique | bardeau, planche | moellon, crépi | mousse sur le faîte, pied du mur qui boit |
| 4–7 | établi | tuile cuite | hourdis de brique | lanterne à la porte |
| 8+ | de maître | lauze scellée | pierre de taille | soubassement appareillé, faîtage doré, oriflamme au blason |

Le bâtiment se refabrique **sur place** au passage d'un palier
(`Village.rehausser`) : il ne bouge pas d'un pixel, il change de visage.

## 5. Les deux portes

**Le Puits sans fond** (aventure). Une descente infinie, étage par
étage, jouée dans l'arène tactique conservée. Devant l'écran, la
compagnie descend ; en votre absence, elle rejoue son étage et rapporte
du butin sans progresser — il faut donc regarder pour aller plus loin.
Le ravitaillement se paie en poisson fumé, puis en potions et en
tourtes : le fumoir est la porte d'entrée du donjon. La forge et
l'armurerie n'y descendent pas, elles **équipent** : chaque palier
d'armement ajoute définitivement aux caractéristiques de la compagnie.

**Le Portail d'expédition** (bataille). Douze zones, difficulté
croissante, chacune répondant à un goulot d'étranglement précis de
l'économie — la pêche, le bûcheronnage, la mine, l'élevage, la forge, la
montée de la Menace, le butin de la descente. Chaque victoire donne un
**avantage permanent** et fait retomber la Menace de 45 points. La force
de la colonne est celle du bourg : le nombre d'unités formées et le
palier d'armement. Le rapport de forces est annoncé avant le départ.

**La Menace** monte seule dès cinq bâtiments, plus vite si le bourg est
gros et le territoire large. À 100, une colonne arrive : la première
n'est qu'une reconnaissance qui vide un quart de la grange ; les
suivantes cassent des bâtiments, sauf si la défense (remparts, caserne,
tours, garnison) égale leur force. Deux façons de la faire baisser :
tenir le guet à la tour, ou aller au-devant par le portail.

---

## 5 bis. La tour : périls, gardiens, équipée

Tous les **vingt étages**, ce qui tue change de nature. Le décor tourne
plus vite : on peut traverser trois paysages sans changer de danger, et
le joueur apprend à lire le **péril**, non le papier peint.

| étages | péril | garde | ce qu'il fait sans elle |
|---|---|---|---|
| 1–20 | Les Galeries | — | rien, on descend en chemise |
| 21–40 | Les Fournaises | Garde de feu | ronge la compagnie, fait fondre le butin |
| 41–60 | Les Fongères | Garde de venin | les soins ne prennent plus |
| 61–80 | Le Grand Froid | Garde de gel | tout ralentit |
| 81–100 | Les Orages Enfouis | Garde de foudre | décharges au hasard |
| 101–120 | L'Envers | Garde d'ombre | ce qu'on ne voit pas frappe en premier |
| 121+ | L'Abîme | double garde | tout compte double |

Une garde est une **charge** : elle s'use à chaque étage franchi. Sans
elle on descend quand même — ×2 de dégâts subis, 35 % du butin, et 9 %
de chances par étage d'y laisser quelqu'un. Ce n'est pas un mur, c'est
une facture, et elle est affichée avant le départ.

Les gardes se préparent au **laboratoire d'alchimie**, et chacune
consomme une **trouvaille** qu'aucun métier ne produit : écaille et
résine pour le feu, racine amère pour le venin, plume de Nuée pour le
gel, ambre pour la foudre, perle pour l'ombre. C'est ce qui relie la
pêche du mardi à l'étage soixante.

Un **gardien** tous les dix étages. Le premier passage l'ouvre pour de
bon ; ensuite on peut y retourner autant qu'on veut, et c'est la seule
source de **cœurs de biome** — donc de tout l'équipement profond. La
fenêtre du Puits affiche pour chacun ses chances réelles, son butin
connu et le ravitaillement qu'il demande.

## 5 ter. Les trouvailles

Chaque métier a sa **table de trouvailles** (`donnees/butins.js`), qui
s'ajoute au butin propre à chaque recette. La probabilité est donnée
*par minute de travail* et mise à l'échelle de la durée du cycle : on ne
gagne rien à hacher une tâche longue en tâches courtes. Un rang de
métier minimum garde les trouvailles rares pour plus tard — on ne pêche
pas de perle le premier jour.

La fenêtre d'un poste affiche les **chances réelles**, caractère de
l'habitant compris : un Chanceux se voit dans les pourcentages, pas
seulement dans sa fiche.

## 6. Le code

### Ce qui a été conservé, intact

Le noyau désigné par `CONTRAT.md` :

| fichier | rôle |
|---|---|
| `expedition/battle-core.js`, `battle-mapgen.js`, `battle-terrain.js` | le moteur de bataille |
| `aventure/adventure.js` | l'arène tactique |
| `aventure/data-general.js`, `state-general.js` | biomes, héros, butin, descente |
| `unites/data-units.js`, `data-forge.js` | 26 unités, 90 pouvoirs, 10 lignes d'équipement |
| `sprites/*.js`, `model3d.js` | les sprites procéduraux |

Une seule modification y a été faite, purement textuelle et sans effet
sur la logique : **les émoji ont été retirés des libellés**, pour que
l'arène s'accorde au reste du jeu.

### Ce qui a été écrit

```
index.html                  la coque : ordre de chargement, canvas, plateau
jeu/serveur.js              serveur statique de développement (+ capture d'écran)
jeu/verif.js                audit de cohérence de l'économie (node jeu/verif.js)

jeu/donnees/gd-core.js      remplace le `data-core.js` absent : FACTIONS, couleurs,
                            BALANCE, sorts, potions, minéraux
jeu/donnees/gd-talents.js   remplace le fichier de talents absent : arbres composés
                            (3 branches + 2 voies exclusives) pour les 9 classes
jeu/donnees/ressources.js   87 ressources, 8 catégories, plafonds de stockage
jeu/donnees/batiments.js    41 bâtiments, 103 recettes, tables de butin, déblocages
jeu/donnees/ameliorations.js  améliorations d'atelier + 33 recherches, 4 branches
jeu/donnees/objectifs.js    47 objectifs en 6 groupes, et les sceaux de la Charte
jeu/donnees/butins.js       les trouvailles par métier, les 6 périls de la tour,
                            les 12 gardiens et leur butin
jeu/donnees/habitants.js    35 traits (qualités et défauts), 5 raretés, le tirage
                            des postulants aux portes du bourg

jeu/sprites/sprites-monde.js  les 4 modules de sprites absents : nœuds de bataille,
                              obstacles, boss, âmes, emblèmes, bannières, mascotte

jeu/js/moteur-village.js    le moteur de rendu du bourg, extrait de
                            village/bourg-medieval.html et instrumenté :
                            village vide, pose explicite, mode construction avec
                            aperçu, affectation des habitants, projection écran
jeu/js/icones.js            50 formes dessinées au pixel, mises en cache
jeu/js/etat.js              l'état, la sauvegarde, les plafonds, les métiers,
                            les portes du bourg, le renvoi et sa peine
jeu/js/moteur.js            le tick idle : postes, chantier, vivres, paliers de
                            menace, sorties, raids, rattrapage hors-ligne
jeu/js/tour.js              périls et gardes, gardiens re-farmables, l'équipée
                            d'habitants, blessures, rites et pertes
jeu/js/pont-combat.js       le pont vers les moteurs conservés : GameState, FX,
                            traduction du vocabulaire de butin
jeu/js/ui-noyau.js          fenêtres flottantes, formats, puces, barres, et la
                            RÉCONCILIATION DOM (`morphe`) qui a supprimé le
                            clignotement de toute l'interface
jeu/js/ui-fenetres.js       les fenêtres : édifice, chantier, réserves, habitants, bourg
jeu/js/ui-dock.js           le bandeau et le dock des chargements
jeu/js/aventure.js          la descente : panneau, plateau, remontée du butin
jeu/js/expedition.js        les 12 zones, l'équilibrage des batailles, les bilans
jeu/js/app.js               l'assemblage, une seule boucle, la synchronisation
```

Il n'y a **qu'une boucle** : celle du rendu du village. Elle tire le
moteur de jeu à chaque image ; l'interface se rafraîchit cinq fois par
seconde, pas soixante. Quand l'onglet passe en arrière-plan, le
navigateur suspend le rendu — l'horloge murale est relue à chaque image
et le retard est rattrapé exactement comme au chargement.

### L'audit

```bash
node jeu/verif.js
```

Il vérifie que toute ressource consommée est produite quelque part, que
toute recette est déclarée dans son bâtiment, qu'aucun coût n'est
circulaire, et il **simule l'ordre réel d'ouverture du carnet** en
partant de zéro. Résultat attendu : *aucune faute*, et les 41 bâtiments
atteignables.

### Ajouter quelque chose

- **Une ressource** : une ligne `r(...)` dans `donnees/ressources.js`.
  L'icône est un descripteur `{ forme, couleurs }` ; les formes vivent
  dans `js/icones.js`.
- **Une recette** : un appel `x(...)` dans `donnees/batiments.js`, plus
  son identifiant dans la liste `recettes` du bâtiment. Relancer
  l'audit.
- **Un bâtiment** : un appel `b(...)`, une entrée dans `DEBLOCAGE`, et
  un générateur de sprite. Les générateurs se trouvent dans la section
  9 ter de `js/moteur-village.js` et se déclarent dans les tables `GEN`
  et `RANGEES` juste au-dessus.
- **Une zone d'expédition** : une entrée dans `ZONES`, en haut de
  `js/expedition.js`.
- **Un trait d'habitant** : un appel `trait({...})` dans
  `donnees/habitants.js`. Les champs disponibles (`vitesse`, `conso`,
  `butin`, `usure`, `voisins`, `pv`, `degats`…) sont documentés en tête
  du fichier ; ajouter aussi la paire dans `INCOMPATIBLES` si le trait
  en contredit un autre.
- **Une trouvaille de métier** : une ligne `T(res, p, [min,max], rang)`
  dans la table du métier, `donnees/butins.js`. `p` est une probabilité
  par minute de travail. Relancer l'audit : il vérifie que la ressource
  existe et qu'elle sert à quelque chose.
- **Un péril ou un gardien** : les tables `PERILS` et `GARDIENS`, dans
  le même fichier. L'audit refuse un péril dont la garde ne se fabrique
  nulle part.

---

## 7. Ce qui reste ouvert

- L'**IA de bataille** du moteur conservé est capricieuse : deux
  colonnes de force égale ne donnent pas toujours le même résultat.
  C'est pour cela que le rapport de forces est annoncé d'avance, que la
  défaite ne coûte que 45 % de la colonne, et que le joueur peut
  reprendre la barre à tout moment.
- Les **gemmes** et l'**obsidienne** ne viennent que des tables de butin
  (mine profonde et descente) : c'est voulu, mais c'est le point de la
  chaîne le plus dépendant de la chance.
- La **fenêtre de compagnie** de la descente montre le roster et permet
  d'emmener ou de laisser ; l'équipement pièce par pièce et l'arbre de
  talents existent dans le moteur mais n'ont pas encore d'écran dédié.
- L'**équipée d'habitants** décide de la force, des pertes et de
  l'expérience gagnée dans la tour ; les silhouettes dessinées dans
  l'arène restent, elles, celles du moteur conservé.
- Les **gardiens au-delà de l'étage 120** rejouent la dernière entrée de
  la table, majorée de 35 % par palier. C'est un garde-fou, pas un
  contenu : la table mérite d'être prolongée quand quelqu'un ira
  vraiment si bas.
