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
    {}, { medaille: 1, essence: 2 }, { metier: 'peche', pct: 0.14 },
    "Une langue de gravier que la Nuée utilise pour remonter la rivière sans être vue. On y aborde à marée basse.");
  f('taillis', 'Le Taillis Brûlé', 3, 2, 2, 6, 10,
    {}, { medaille: 1, bois: 40 }, { metier: 'bois', pct: 0.14 },
    "Ils y mettent le feu chaque printemps pour dégager leur vue. On peut leur retirer l'habitude.");
  f('carriere', 'La Carrière Haute', 4, 3, 3, 7, 12,
    {}, { medaille: 2, pierre: 60 }, { metier: 'mine', pct: 0.14 },
    "Un front de taille abandonné, tenu par une garnison qui n'en tire rien.");

  /* ---------------------------------------------------------------
     LA DEUXIÈME COURONNE — une journée de mer.
     Cinq à neuf lieues : il faut un navire qu'on accepte de perdre de
     vue, donc une cale qui vaille le voyage.
     --------------------------------------------------------------- */
  f('paturage', 'Les Grands Pâturages', 6, 4, 4, 7, 15,
    {}, { medaille: 2, laine: 30, peau: 12 }, { metier: 'elevage', pct: 0.16 },
    "De l'herbe à perte de vue et personne pour y mener un troupeau. Une aberration.");
  f('plateau', 'Le Plateau du Vent', 7, 5, 5, 8, 18,
    {}, { medaille: 3, ble: 90 }, { metier: 'cuisine', pct: 0.18 },
    "Le vent y est régulier toute l'année. Le meunier en rêve depuis qu'il a des dents.");
  f('saline', 'La Saline', 8, 5, 6, 8, 20,
    {}, { medaille: 3, poissonfume: 20 }, { global: 0.05 },
    "Des tables d'évaporation en escalier. Qui tient le sel tient l'hiver.");
  f('boisancien', 'Le Bois Ancien', 9, 6, 7, 9, 22,
    {}, { medaille: 4, poutre: 6, planche: 40 }, { metier: 'bois', pct: 0.20 },
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

  /* ---------------------------------------------------------------
     LES VIVRES, EN RATIONS

     Une expédition mange. Longtemps on a demandé un ALIMENT PRÉCIS —
     tant de pain pour la troisième île — et c'était un mur : le pain
     veut une caserne, trois niveaux de champ, un moulin, une cuisine
     et un puits, quand la troisième île est à quatre lieues du quai.
     Le joueur avait un port, des soldats, un bateau, et se voyait
     refuser la mer faute d'un four.

     On ne demande donc plus un aliment mais une QUANTITÉ DE RATIONS,
     que l'on paie avec ce qu'on a. Ce qui change d'un vivre à l'autre,
     c'est sa DENSITÉ : ce qui tient dans une cale et ce qui se garde en
     mer. Le poisson frais nourrit un homme un jour et pourrit ensuite —
     parfait pour aller à trois lieues, ruineux pour aller à vingt. La
     tourte, le fromage et le poisson fumé sont les vraies provisions de
     bord. La cuisine cesse ainsi d'être une barrière pour devenir ce
     qu'elle doit être : un gain de place.
     --------------------------------------------------------------- */
  const RATIONS = {
    /* frais et encombrant — bon pour la première couronne */
    poisson: 1, ble: 1, legume: 1, tournesol: 1, fruit: 1, lait: 1, champignon: 1,
    /* travaillé */
    farine: 2, farineclaire: 2, miel: 2, viande: 3,
    /* provisions de bord : ça se garde */
    confiture: 4, cidre: 4, pain: 5, fromage: 6, poissonfume: 7,
    /* la vraie ration de mer */
    tourte: 14,
  };

  /* Ce qu'il faut embarquer : la distance et le nombre de bouches. Une
     poignée d'éclaireurs pour l'île d'en face ne coûte presque rien ;
     mille hommes vers le large sont une campagne agricole. */
  function rationsRequises(lieues, unites) {
    return Math.max(1, Math.ceil((lieues || 0) * 2.2 + (unites || 0) * 0.55));
  }

  /* Ce que le bourg peut fournir, et dans quel ordre on y puise. On
     entame TOUJOURS par le moins dense : ce qui se garde le moins doit
     partir le premier, et le joueur garde ses tourtes pour le large. */
  function vivresEnStock() {
    const out = [];
    for (const id in RATIONS) {
      const n = window.Etat ? window.Etat.qte(id) : 0;
      if (n > 0) out.push({ res: id, n, parUnite: RATIONS[id] });
    }
    out.sort((a, b) => a.parUnite - b.parUnite);
    return out;
  }
  function rationsDisponibles() {
    let t = 0;
    for (const v of vivresEnStock()) t += v.n * v.parUnite;
    return t;
  }
  /* Le détail de ce qui sera prélevé, sans rien dépenser : la fenêtre du
     port le montre avant que le joueur ne s'engage. */
  function prelevementPour(rations) {
    const pris = {};
    let reste = rations;
    for (const v of vivresEnStock()) {
      if (reste <= 0) break;
      const n = Math.min(v.n, Math.ceil(reste / v.parUnite));
      if (n <= 0) continue;
      pris[v.res] = n;
      reste -= n * v.parUnite;
    }
    return { cout: pris, manque: Math.max(0, reste) };
  }

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
     peine — ce qu'on gagne en cale, on le paie en inertie.

     LE GRÉEMENT, lui, change tout : c'est la seule chose qui rende le
     Grand Large praticable. Sans lui, trois cents lieues font trois
     heures et demie de mer ; au dernier palier, moins d'une heure.
     On le lit de l'état quand l'appelant ne le précise pas — il n'y a
     qu'un bourg, donc qu'un chantier naval. */
  function greementCourant() {
    try { return (window.Port && window.Port.greement) ? window.Port.greement() : 0; }
    catch (e) { return 0; }
  }
  function traversee(lieues, palier, gr) {
    const vent = 1 - Math.min(0.34, palier * 0.07);
    const g = gr == null ? greementCourant() : gr;
    const toile = 1 - (window.Greement ? window.Greement.viteDe(g) : 0);
    return Math.max(4, Math.round(lieues * 40 * vent * toile));
  }

  /* Une destination peut venir de la couronne locale OU du Grand Large.
     Tout le reste du jeu — le port, les bonus permanents, le bilan de
     bataille — passe par ici et n'a donc pas à savoir laquelle. */
  function parId(id) {
    const local = I.find(x => x.id === id);
    if (local) return local;
    return (window.LARGE && window.LARGE.find(x => x.id === id)) || null;
  }
  /* Toutes les destinations, les deux théâtres confondus. */
  function toutes() { return I.concat(window.LARGE || []); }
  /* LE GRAND LARGE NE S'OUVRE QU'UNE FOIS LA COURONNE PRISE. Tant qu'il
     reste une île à vue du bourg, on n'a rien à faire à trois cents
     lieues — et la carte resterait illisible. */
  function largeOuvert() {
    const p = (window.Etat && window.Etat.E && window.Etat.E.port && window.Etat.E.port.prises) || [];
    return I.every(x => p.indexOf(x.id) >= 0);
  }
  function palierDe(places) {
    let k = 0;
    for (let i = 0; i < CALES.length; i++) if (CALES[i].places <= places) k = i;
    return k;
  }

  window.ILES = I;
  window.IleUtil = { CALES, coutNavire, traversee, parId, palierDe,
                     RATIONS, rationsRequises, rationsDisponibles, prelevementPour, vivresEnStock,
                     toutes, largeOuvert };

})();
