/* ============================================================
   LE BOURG — donnees/iles.js
   LES ÎLES, ET CE QU'IL EN COÛTE D'Y ALLER.

   Le bourg est sur une île. Tout ce qui n'est pas lui est de l'autre
   côté de l'eau — et l'on n'y va pas en marchant. C'est le PORT qui
   décide désormais de la guerre : on affrète un navire, on le remplit,
   on l'envoie, il navigue, et l'on se bat à l'arrivée.

   Chaque île porte trois nombres que le joueur lit avant de partir :

     · `lieues` — la distance. Elle se paie en TEMPS de traversée, pas
       en matière. Une île proche se harcèle ; une île lointaine
       s'organise, parce que le navire est immobilisé pendant tout le
       trajet et qu'on n'en a qu'un au début.
     · `force` — ce qu'il y a en face, sur dix. C'est l'indicateur, pas
       le calcul : le calcul, c'est `diff`.
     · `menace` — combien la prendre fait retomber la Nuée. C'EST LA
       SEULE FAÇON de faire baisser la jauge : plus on va loin, plus on
       gagne d'air.

   -> window.ILES, window.IleUtil
   ============================================================ */
"use strict";
(function () {

  const I = [];
  /* f(id, nom, lieues, force, diff, noeuds, menace, cout, butin, bonus, desc) */
  function f(id, nom, lieues, force, diff, noeuds, menace, cout, butin, bonus, desc) {
    I.push({ id, nom, lieues, force, diff, noeuds, menace,
             cout: cout || {}, butin: butin || {}, bonus: bonus || {}, desc: desc || '' });
  }

  /* ---------------------------------------------------------------
     LA PREMIÈRE COURONNE — à vue du bourg.
     Deux à quatre lieues : on part le matin, on se bat, on rentre. Ce
     sont les îles qu'on prend avant d'avoir une vraie flotte.
     --------------------------------------------------------------- */
  f('berges', 'Les Basses Berges', 2, 1, 1, 5, 8,
    { poisson: 12 }, { medaille: 1, essence: 2 }, { metier: 'peche', pct: 0.14 },
    "Une langue de gravier que la Nuée utilise pour remonter la rivière sans être vue. On y aborde à marée basse.");
  f('taillis', 'Le Taillis Brûlé', 3, 2, 2, 6, 10,
    { poisson: 20 }, { medaille: 1, bois: 40 }, { metier: 'bois', pct: 0.14 },
    "Ils y mettent le feu chaque printemps pour dégager leur vue. On peut leur retirer l'habitude.");
  f('carriere', 'La Carrière Haute', 4, 3, 3, 7, 12,
    { pain: 8 }, { medaille: 2, pierre: 60 }, { metier: 'mine', pct: 0.14 },
    "Un front de taille abandonné, tenu par une garnison qui n'en tire rien.");

  /* ---------------------------------------------------------------
     LA DEUXIÈME COURONNE — une journée de mer.
     Cinq à neuf lieues : il faut un navire qu'on accepte de perdre de
     vue, donc une cale qui vaille le voyage.
     --------------------------------------------------------------- */
  f('paturage', 'Les Grands Pâturages', 6, 4, 4, 7, 15,
    { pain: 10 }, { medaille: 2, laine: 30, peau: 12 }, { metier: 'elevage', pct: 0.16 },
    "De l'herbe à perte de vue et personne pour y mener un troupeau. Une aberration.");
  f('plateau', 'Le Plateau du Vent', 7, 5, 5, 8, 18,
    { tourte: 3 }, { medaille: 3, ble: 90 }, { metier: 'cuisine', pct: 0.18 },
    "Le vent y est régulier toute l'année. Le meunier en rêve depuis qu'il a des dents.");
  f('saline', 'La Saline', 8, 5, 6, 8, 20,
    { tourte: 4 }, { medaille: 3, poissonfume: 20 }, { global: 0.05 },
    "Des tables d'évaporation en escalier. Qui tient le sel tient l'hiver.");
  f('boisancien', 'Le Bois Ancien', 9, 6, 7, 9, 22,
    { tourte: 5 }, { medaille: 4, poutre: 6, planche: 40 }, { metier: 'bois', pct: 0.20 },
    "Des fûts de six mètres de tour. Une seule de ces poutres porterait un rempart.");

  /* ---------------------------------------------------------------
     LE LARGE — plusieurs jours de mer.
     Dix lieues et plus : on n'y va qu'avec une flotte, et le navire
     manque au bourg pendant tout ce temps.
     --------------------------------------------------------------- */
  f('veine', 'La Veine Rouge', 11, 7, 8, 9, 26,
    { potion: 2 }, { medaille: 4, lingotfer: 20 }, { metier: 'feu', pct: 0.20 },
    "Un affleurement de fer si pur qu'on le prend d'abord pour de la brique.");
  f('falaise', 'La Falaise aux Nids', 13, 8, 10, 10, 34,
    { potion: 3 }, { medaille: 6, essence: 12 }, { menaceTaux: -0.30 },
    "C'est de là qu'elles partent. Y aborder, c'est couper la Nuée à la racine.");
  f('gouffre', 'Le Gouffre Sonnant', 15, 8, 12, 11, 38,
    { potion: 4 }, { medaille: 8, gemme: 3, essence: 20 }, { butin: 0.15 },
    "Une autre entrée du Puits, prise depuis toujours. La compagnie y descendrait moins loin, mais plus riche.");
  f('minesnoires', 'Les Mines Noires', 18, 9, 15, 12, 44,
    { potion: 6 }, { medaille: 10, obsidienne: 4 }, { metier: 'forge', pct: 0.22 },
    "On y taille une pierre qui ne réfléchit rien. La fonderie saura quoi en faire.");
  f('aire', "L'Aire du Grand Bec", 24, 10, 20, 14, 60,
    { potion: 10, chant: 2 }, { medaille: 20, relique: 1, obsidienne: 8 }, { global: 0.12 },
    "Le nid du chef. Personne n'y est allé deux fois — et le premier n'en est pas revenu.");

  /* ---------------------------------------------------------------
     LA FLOTTE

     On commence avec UNE barque de vingt places. C'est peu, et c'est
     le sujet : vingt places obligent à choisir ce qu'on embarque. La
     cale s'agrandit par paliers, et l'on finit par armer plusieurs
     navires de mille — mais alors on a une économie derrière.
     --------------------------------------------------------------- */
  const CALES = [
    { places: 20,   nom: 'Barque',        cout: { planche: 30, corde: 10 } },
    { places: 45,   nom: 'Chaloupe',      cout: { planche: 70, corde: 24, toile: 6 } },
    { places: 100,  nom: 'Cogue',         cout: { poutre: 8, planche: 120, toile: 14 } },
    { places: 220,  nom: 'Caraque',       cout: { poutre: 18, planche: 200, toile: 30, lingotfer: 20 } },
    { places: 450,  nom: 'Galion',        cout: { poutre: 34, planche: 340, toile: 60, acier: 24 } },
    { places: 1000, nom: 'Nef de haut bord', cout: { poutre: 60, planche: 600, toile: 120, acier: 60, lingotor: 8 } },
  ];

  /* Le prix d'un navire SUPPLÉMENTAIRE. Il monte franchement : une
     flotte est un luxe, et le bourg doit le mériter deux fois. */
  function coutNavire(n) {
    const k = Math.pow(2.35, n);
    return {
      planche: Math.round(60 * k), corde: Math.round(20 * k),
      poutre: Math.round(4 * k), toile: Math.round(8 * k),
    };
  }

  /* LE TEMPS DE MER. Une lieue vaut quarante secondes à la voile ; un
     navire plus grand porte plus de toile et va donc plus vite, mais à
     peine — ce qu'on gagne en cale, on le paie en inertie. */
  function traversee(lieues, palier) {
    const vent = 1 - Math.min(0.34, palier * 0.07);
    return Math.round(lieues * 40 * vent);
  }

  function parId(id) { return I.find(x => x.id === id) || null; }
  function palierDe(places) {
    let k = 0;
    for (let i = 0; i < CALES.length; i++) if (CALES[i].places <= places) k = i;
    return k;
  }

  window.ILES = I;
  window.IleUtil = { CALES, coutNavire, traversee, parId, palierDe };

})();
