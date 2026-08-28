/* ============================================================
   LE BOURG — donnees/raffinages.js
   LES ANNEXES, ou : ce qu'on ajoute À UN BÂTIMENT plutôt qu'à côté.

   Un idle se joue longtemps, et la place manque vite sur l'île. Or
   beaucoup de gestes n'ont pas besoin d'un édifice à eux : abattre une
   bête appartient à la bergerie, laver le minerai appartient à la
   mine, battre le blé appartient au champ. Les sortir dans un
   bâtiment séparé aurait mangé une parcelle pour rien.

   Un RAFFINAGE est donc une amélioration qu'on achète DANS un
   bâtiment, et qui fait trois choses :

     1. il coûte des matériaux et du temps de chantier — c'est un
        ouvrage, il passe par la file comme le reste ;
     2. il OUVRE DES RECETTES qui n'existaient nulle part avant. Une
        recette portant `raff:'abattoir'` reste invisible tant que la
        bergerie n'a pas son abattoir ;
     3. il CHANGE LE BÂTIMENT. `annexe` nomme le corps qui se greffe —
        le village le lit et repose l'édifice avec sa dépendance.

   C'est la couche incrémentale qui manquait entre « je monte d'un
   niveau » (qui ne fait qu'accélérer) et « je bâtis un édifice » (qui
   coûte une parcelle) : ici, on ouvre une CHAÎNE.
   -> window.RAFFINAGES, window.RaffUtil
   ============================================================ */
"use strict";
(function () {

  const R = [];
  /* f(id, bat, nom, desc, cout, temps, annexe, effet, niveau)
     `niveau` évite qu'une annexe avancée apparaisse avant que le corps
     principal soit capable de la porter. */
  function f(id, bat, nom, desc, cout, temps, annexe, effet, niveau) {
    R.push({ id, bat, nom, desc, cout, temps, annexe: annexe || null,
      effet: effet || {}, niv: niveau || 1 });
  }

  /* ---------------------------------------------------------------
     L'ÉLEVAGE — l'abattoir. Jusqu'ici la bergerie « abattait » dans un
     coin sans qu'on sache où ; c'est maintenant un bâtiment, avec son
     billot, ses crochets et son baquet. Il rend aussi ce qu'on ne
     tirait de nulle part : le suif.
     --------------------------------------------------------------- */
  f('abattoir', 'bergerie', 'Abattoir',
    "Un appentis à l'écart, dallé et pentu, avec son billot et ses crochets. On y tire d'une bête tout ce qu'elle donne — et non plus la seule viande.",
    { planche: 24, pierretaille: 8, outil: 2 }, 180, 'appentis',
    { rendement: 0.10 });
  f('abattoir', 'etable', 'Abattoir',
    "Le même appentis, mais taillé pour des bêtes qui pèsent trois fois plus. Le treuil n'est pas un luxe.",
    { planche: 30, pierretaille: 12, outil: 3 }, 220, 'appentis',
    { rendement: 0.10 });

  /* LA LAITERIE — la fromagerie affinée */
  f('cave', 'laiterie', "Cave d'affinage",
    "Creusée dans le contrefort, voûtée, à onze degrés toute l'année. Le fromage y prend six mois et vaut quatre fois plus.",
    { pierretaille: 22, poutre: 2, sable: 20 }, 200, 'cave',
    { rendement: 0.15 });

  /* LA MINE — le lavage du minerai */
  f('laverie', 'mine', 'Laverie',
    "Un chenal, deux bassins et un tamis. On lave la roche concassée : ce qui reste au fond est plus riche, et l'on y trouve ce qu'on ne cherchait pas.",
    { planche: 20, corde: 6, eau: 30 }, 190, 'appentis',
    { butin: 0.25 });

  /* LE CHAMP — l'aire de battage */
  f('aire', 'champ', 'Aire de battage',
    "Une aire de terre battue, dure comme pierre, et le fléau qui va avec. Le grain se sépare de la paille — et la paille, on croyait la perdre.",
    { pierre: 18, planche: 12 }, 140, 'aire',
    { rendement: 0.12 });

  /* LA SCIERIE — quatre choix qui construisent peu à peu une cour
     industrielle complète. Chacun ouvre une boucle différente et chacun
     reçoit un corps visible dans le village. */
  f('parc_grumes', 'scierie', 'Parc à grumes',
    "Une aire drainée, des chevalets et un chariot. Les troncs sont triés avant la lame au lieu de bloquer la cour.",
    { planche:18, corde:6, pierre:10 }, 125, 'parc',
    { cadence:0.05 }, 3);
  f('sechoir', 'scierie', 'Séchoir à bois',
    "Des piles espacées de tasseaux, sous un toit ouvert aux quatre vents. Deux ans d'attente en vrai ; ici, quelques minutes — et le bois ne travaille plus.",
    { planche: 26, poutre: 1 }, 160, 'sechoir',
    { rendement: 0.14 }, 4);
  f('recuperateur', 'scierie', 'Cour des chutes',
    "Un bac couvert, une presse et beaucoup de balais. Les chutes deviennent des briquettes pour les fours du bourg.",
    { planche:42, lingotfer:6, corde:10 }, 230, 'appentis',
    { rendement:0.08 }, 6);
  f('roue_hydraulique', 'scierie', 'Grande roue hydraulique',
    "Un canal de bois et une roue haute comme le hangar entraînent la scie sans épuiser les ouvriers.",
    { poutre:12, lingotfer:14, pierretaille:20 }, 330, 'roue',
    { cadence:0.18 }, 7);

  /* LA PÊCHERIE — le vivier */
  f('vivier', 'pecherie', 'Vivier',
    "Un bassin grillagé dans le courant, où l'on garde vivant ce qui ne se mange pas le jour même. La pêche cesse d'être une loterie.",
    { planche: 18, corde: 8, pierre: 10 }, 150, 'bassin',
    { rendement: 0.12 });

  /* LA FORGE — le martinet */
  f('martinet', 'forge', 'Martinet',
    "Un marteau de cent livres, relevé par la roue et lâché tout seul. Le forgeron ne fait plus que tenir la pièce — et il en tient trois fois plus.",
    { poutre: 2, lingotfer: 12, corde: 6 }, 260, 'roue',
    { cadence: 0.20 });

  /* LE MOULIN — la bluterie */
  f('bluterie', 'moulin', 'Bluterie',
    "Un tamis de soie tendu sur un tambour, secoué par la meule elle-même. Le son s'en va d'un côté, la fleur de farine de l'autre.",
    { planche: 16, toile: 4, fil: 8 }, 170, 'appentis',
    {});

  /* LA TUILERIE — le four à chaux */
  f('chaufour', 'tuilerie', 'Four à chaux',
    "Une tour trapue où la pierre cuit trois jours pour devenir poudre. C'est elle qui fait le mortier, l'enduit, et le blanc des murs.",
    { pierretaille: 20, charbonbois: 14 }, 210, 'tour',
    { rendement: 0.10 });

  /* LE RUCHER — la cirerie, et le carré de fleurs qui va avec */
  f('cirerie', 'rucher', 'Cirerie',
    "On fond les vieux rayons au bain-marie, on coule la cire en pains. Le miel n'était que la moitié de ce que donne une ruche.",
    { planche: 14, poterie: 4, eau: 12 }, 130, 'appentis',
    { rendement: 0.12 });

  /* LA POTERIE — le tour à pied */
  f('tour_pied', 'poterie', 'Tour à pied',
    "Le plateau ne se lance plus à la main : un volant de pierre, un pied dessus, et les deux pattes restent libres pour la terre.",
    { pierretaille: 10, planche: 12, outil: 2 }, 150, 'appentis',
    { cadence: 0.18 });

  /* LA PÉPINIÈRE — le pressoir. Un verger sans pressoir ne fait que
     nourrir ; avec, il rapporte. */
  f('pressoir', 'pepiniere', 'Pressoir',
    "Une auge, une vis de chêne et un levier long comme deux chats. On y broie ce que le panier a de trop mûr — et c'est justement le meilleur.",
    { poutre: 2, planche: 18, pierretaille: 8 }, 180, 'appentis',
    { rendement: 0.12 });

  /* L'ALCHIMIE — l'alambic à fleurs */
  f('alambic', 'alchimie', 'Alambic à fleurs',
    "Un col de cygne en cuivre et beaucoup de patience. Trois cents fleurs entrent, une fiole sort — et se vend le prix d'un harnois.",
    { lingotcuivre: 8, verre: 6, fiole: 6 }, 240, 'tour',
    {});

  /* ---------------------------------------------------------------
     LES RECETTES QUE CES ANNEXES OUVRENT
     Elles vivent dans batiments.js comme les autres, marquées d'un
     `raff` : c'est BatUtil.recettesDe qui les cache tant que
     l'annexe n'est pas bâtie.
     --------------------------------------------------------------- */

  const parBat = {};
  for (const r of R) (parBat[r.bat] = parBat[r.bat] || []).push(r);

  function pourBat(bat) { return parBat[bat] || []; }
  function trouver(bat, id) { return R.find(r => r.bat === bat && r.id === id) || null; }
  /* le coût monte avec le niveau du bâtiment : on ne greffe pas une
     annexe sur un édifice de maître au prix d'une cabane */
  function coutDe(bat, id, niv) {
    const r = trouver(bat, id);
    if (!r) return null;
    const k = 1 + 0.12 * Math.max(0, (niv || 1) - 1);
    const out = {};
    for (const m in r.cout) out[m] = Math.max(1, Math.round(r.cout[m] * k));
    return out;
  }
  function tempsDe(bat, id, niv) {
    const r = trouver(bat, id);
    return r ? Math.round(r.temps * (1 + 0.08 * Math.max(0, (niv || 1) - 1))) : 0;
  }

  window.RAFFINAGES = R;
  window.RaffUtil = { pourBat, trouver, coutDe, tempsDe };

})();
