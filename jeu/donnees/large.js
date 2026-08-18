/* ============================================================
   LE BOURG — donnees/large.js
   LE GRAND LARGE : CE QU'IL Y A APRÈS LA COURONNE.

   Les douze îles d'`iles.js` tiennent dans une matinée de mer. Quand
   elles sont toutes prises, la Nuée est à zéro, les bonus sont acquis,
   et le joueur se retrouve avec une flotte de six nefs et plus rien à
   en faire. Ce fichier est la suite : d'autres eaux, beaucoup plus
   loin, où l'on ne va pas avec le même bateau.

   TROIS DIFFÉRENCES AVEC LA COURONNE

   · LA DISTANCE. On ne compte plus en lieues de matinée mais en
     dizaines. Sans gréement, une seule de ces traversées durerait des
     heures — c'est le sujet : il faut d'abord améliorer les navires.
   · LA PORTÉE. Un gréement ne rend pas seulement plus rapide, il rend
     ATTEIGNABLE. Chaque palier repousse la limite au-delà de laquelle
     un capitaine refuse d'appareiller.
   · LA TERRE. Au large, ce ne sont plus des cailloux mais des
     CONTINENTS, et l'on n'en prend pas un d'un coup : on prend ses
     villes, une par une, le long de la côte.

   -> window.LARGE, window.CONTINENTS, window.Greement
   ============================================================ */
"use strict";
(function () {

  /* ---------------------------------------------------------------
     LE GRÉEMENT

     Sept paliers. Chacun donne DEUX choses : de la vitesse, et de la
     portée. La portée est la vraie serrure — c'est elle qui décide de
     ce que le joueur peut seulement TENTER — et la vitesse est ce qui
     rend le voyage supportable une fois qu'il est permis.

     Les coûts tapent dans ce que la couronne locale a rapporté : on
     arme le Grand Large avec le butin des douze îles.
     --------------------------------------------------------------- */
  const GREEMENTS = [
    { nom: 'Voile carrée', portee: 30, vite: 0,
      cout: {},
      desc: "Une toile, un mât, et la côte toujours en vue. On ne s'éloigne pas d'une matinée de rames." },
    { nom: 'Voile latine', portee: 65, vite: 0.15,
      cout: { toile: 60, corde: 45, planche: 90 },
      desc: "La vergue oblique permet de remonter le vent. On cesse d'attendre qu'il veuille bien tourner." },
    { nom: 'Carène doublée', portee: 120, vite: 0.28,
      cout: { planche: 220, resine: 60, lingotfer: 40 },
      desc: "Un second bordé, calfaté à la résine. Le ver ne perce plus, et l'on ose rester des semaines dehors." },
    { nom: 'Grand gréement', portee: 185, vite: 0.40,
      cout: { toile: 200, poutre: 30, acier: 26, medaille: 6 },
      desc: "Trois mâts, huniers et perroquets. Le navire porte enfin toute la toile qu'il peut tenir." },
    { nom: 'Astrolabe et cartes', portee: 250, vite: 0.52,
      cout: { parchemin: 60, gemme: 8, essence: 40, medaille: 12 },
      desc: "On sait où l'on est sans voir la terre. C'est cela, et rien d'autre, qui ouvre la haute mer." },
    { nom: 'Coque de haut bord', portee: 320, vite: 0.63,
      cout: { acier: 90, poutre: 70, lingotor: 14, obsidienne: 4 },
      desc: "Des œuvres mortes assez hautes pour encaisser une lame de travers sans embarquer." },
    { nom: 'Nef des lointains', portee: 9999, vite: 0.72,
      cout: { lingotor: 45, relique: 2, obsidienne: 14, chant: 3 },
      desc: "Ce que le bourg sait faire de mieux. Au-delà, il n'y a plus de carte — seulement des récits." },
  ];

  function palierGreement(n) {
    const k = Math.max(0, Math.min(GREEMENTS.length - 1, n | 0));
    return GREEMENTS[k];
  }
  function porteeDe(n) { return palierGreement(n).portee; }
  function viteDe(n) { return palierGreement(n).vite; }
  function suivant(n) {
    const k = (n | 0) + 1;
    return k < GREEMENTS.length ? GREEMENTS[k] : null;
  }

  /* ---------------------------------------------------------------
     LES TERRES DU LARGE

     `secteur` est un cap en radians : il fixe la direction où la terre
     se trouve depuis le bourg, et sert à la carte. Les villes d'un même
     continent se rangent le long de sa côte, donc autour du même cap.

     Chaque destination garde la FORME d'une île d'`iles.js` — mêmes
     champs, mêmes usages — pour que le port, les bonus permanents et le
     bilan de bataille les traitent sans rien savoir de leur origine.
     --------------------------------------------------------------- */
  const L = [];
  function d(o) { L.push(Object.assign({ large: true, cout: {}, butin: {}, bonus: {} }, o)); }

  /* --- Les eaux mortes : les premières traversées vraiment longues --- */
  d({ id: 'brumes', nom: 'Les Bancs de Brume', lieues: 38, force: 11, diff: 22, noeuds: 14, menace: 0,
      secteur: 0.35, type: 'ile',
      butin: { medaille: 12, essence: 30, gemme: 2 }, bonus: { global: 0.05 },
      desc: "Quatre jours sans voir le soleil. On y navigue à l'oreille, et l'on y trouve des épaves qui ne sont sur aucune carte." });
  d({ id: 'ecueils', nom: "L'Écueil du Guetteur", lieues: 52, force: 12, diff: 26, noeuds: 15, menace: 0,
      secteur: 1.55, type: 'ile',
      butin: { medaille: 16, obsidienne: 3, acier: 40 }, bonus: { metier: 'forge', pct: 0.22 },
      desc: "Un doigt de basalte planté dans la houle, avec un feu au sommet que personne n'avoue entretenir." });
  d({ id: 'archipelfroid', nom: "L'Archipel Froid", lieues: 74, force: 13, diff: 30, noeuds: 16, menace: 0,
      secteur: 2.70, type: 'archipel',
      butin: { medaille: 20, peau: 90, laine: 120 }, bonus: { metier: 'elevage', pct: 0.24 },
      desc: "Neuf îles basses et un vent qui ne tombe jamais. Les troupeaux y ont une laine qu'on ne trouve pas ailleurs." });
  d({ id: 'ilebrulee', nom: "L'Île Brûlée", lieues: 96, force: 14, diff: 34, noeuds: 17, menace: 0,
      secteur: 4.05, type: 'ile',
      butin: { medaille: 24, obsidienne: 8, gemme: 5 }, bonus: { metier: 'feu', pct: 0.26 },
      desc: "Le sommet fume encore. La roche y sort noire et coupante, et refroidit en lames." });

  /* --- LE PREMIER CONTINENT : la Côte Basse --- */
  d({ id: 'v_gue', nom: 'Le Gué-des-Sables', lieues: 128, force: 15, diff: 38, noeuds: 18, menace: 0,
      secteur: 0.72, continent: 'cotebasse', type: 'ville',
      butin: { medaille: 30, ble: 400, pierre: 300 }, bonus: { metier: 'champs', pct: 0.22 },
      desc: "Le premier port de la côte, bâti sur pilotis dans un estuaire. On y décharge avant même d'avoir amarré." });
  d({ id: 'v_criee', nom: 'La Criée Haute', lieues: 141, force: 16, diff: 42, noeuds: 19, menace: 0,
      secteur: 0.88, continent: 'cotebasse', type: 'ville',
      butin: { medaille: 34, poissonfume: 150, ecu: 12000 }, bonus: { metier: 'peche', pct: 0.26 },
      desc: "Trois cents barques et une halle qui ne ferme jamais. Qui tient la criée tient le prix du poisson." });
  d({ id: 'v_beffroi', nom: 'Le Beffroi', lieues: 156, force: 18, diff: 48, noeuds: 20, menace: 0,
      secteur: 1.04, continent: 'cotebasse', type: 'ville',
      butin: { medaille: 44, lingotor: 8, relique: 1 }, bonus: { global: 0.08 },
      desc: "La ville haute, derrière deux enceintes. C'est de sa tour qu'on commande toute la côte." });

  /* --- LE DEUXIÈME CONTINENT : les Marches de Fer --- */
  d({ id: 'v_fonderie', nom: 'La Fonderie Noire', lieues: 178, force: 19, diff: 54, noeuds: 21, menace: 0,
      secteur: 3.10, continent: 'marchesfer', type: 'ville',
      butin: { medaille: 50, acier: 220, lingotfer: 300 }, bonus: { metier: 'forge', pct: 0.28 },
      desc: "Huit hauts fourneaux au bord de l'eau. La fumée se voit à quinze lieues, et c'est un avertissement." });
  d({ id: 'v_arsenal', nom: "L'Arsenal", lieues: 196, force: 21, diff: 60, noeuds: 22, menace: 0,
      secteur: 3.26, continent: 'marchesfer', type: 'ville',
      butin: { medaille: 60, poutre: 160, toile: 300, acier: 140 }, bonus: { metier: 'bois', pct: 0.28 },
      desc: "On y met un navire à l'eau tous les onze jours. Le prendre, c'est prendre la façon de le faire." });
  d({ id: 'v_citadelle', nom: 'La Citadelle du Détroit', lieues: 218, force: 23, diff: 68, noeuds: 24, menace: 0,
      secteur: 3.42, continent: 'marchesfer', type: 'ville',
      butin: { medaille: 80, lingotor: 20, obsidienne: 12, relique: 1 }, bonus: { butin: 0.20 },
      desc: "Elle ferme le passage. Tant qu'elle tient, rien de ce qui vient du sud n'arrive jusqu'ici." });

  /* --- LE TROISIÈME CONTINENT : la Terre Dernière --- */
  d({ id: 'v_millemats', nom: 'Le Port aux Mille Mâts', lieues: 244, force: 25, diff: 76, noeuds: 25, menace: 0,
      secteur: 5.20, continent: 'terredern', type: 'ville',
      butin: { medaille: 100, ecu: 60000, gemme: 20 }, bonus: { global: 0.10 },
      desc: "On n'en voit pas le fond. Des quais sur trois lieues, et des pavillons qu'on ne sait pas lire." });
  d({ id: 'v_temple', nom: 'Le Temple de Sel', lieues: 272, force: 27, diff: 86, noeuds: 26, menace: 0,
      secteur: 5.36, continent: 'terredern', type: 'ville',
      butin: { medaille: 130, relique: 3, chant: 4 }, bonus: { metier: 'savoir', pct: 0.30 },
      desc: "Bâti dans une saline morte. Ce qu'on y garde n'a pas de prix, et personne n'a jamais su quoi." });
  d({ id: 'v_couronne', nom: 'La Couronne', lieues: 300, force: 30, diff: 100, noeuds: 28, menace: 0,
      secteur: 5.52, continent: 'terredern', type: 'ville',
      cout: { chant: 6, potion: 20 },
      butin: { medaille: 250, relique: 6, lingotor: 80, obsidienne: 30 }, bonus: { global: 0.18 },
      desc: "La dernière ville, et la seule qui savait que le bourg existait. On l'attendait." });

  /* Les continents, pour la carte : un nom, un cap, et les villes qui
     tiennent leur côte. La distance d'un continent est celle de sa ville
     la plus proche — c'est par là qu'on aborde. */
  const CONTINENTS = [
    { id: 'cotebasse',  nom: 'La Côte Basse',      secteur: 0.88, teinte: '#6f7f5a' },
    { id: 'marchesfer', nom: 'Les Marches de Fer', secteur: 3.26, teinte: '#77706a' },
    { id: 'terredern',  nom: 'La Terre Dernière',  secteur: 5.36, teinte: '#7a6a80' },
  ];
  for (const c of CONTINENTS) {
    c.villes = L.filter(x => x.continent === c.id);
    c.lieues = Math.min.apply(null, c.villes.map(v => v.lieues));
    c.bout   = Math.max.apply(null, c.villes.map(v => v.lieues));
  }

  function parId(id) { return L.find(x => x.id === id) || null; }
  function atteignable(dest, gr) { return !!dest && dest.lieues <= porteeDe(gr); }
  /* La destination la plus proche encore hors de portée : c'est elle
     qu'on cite au joueur pour lui dire à quoi sert le palier suivant. */
  function prochaineHorsPortee(gr) {
    const p = porteeDe(gr);
    let mieux = null;
    for (const x of L) if (x.lieues > p && (!mieux || x.lieues < mieux.lieues)) mieux = x;
    return mieux;
  }

  window.LARGE = L;
  window.CONTINENTS = CONTINENTS;
  window.Greement = { GREEMENTS, palierGreement, porteeDe, viteDe, suivant,
                      parId, atteignable, prochaineHorsPortee };

})();
