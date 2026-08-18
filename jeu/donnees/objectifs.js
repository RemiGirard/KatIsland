/* ============================================================
   LE BOURG — donnees/objectifs.js
   LES OBJECTIFS, et LA CHARTE.

   1. LES OBJECTIFS ne sont pas des trophées : ils disent au joueur ce
      qu'il n'a pas encore essayé. Chacun se remplit tout seul et paie
      une fois — souvent en écus, parfois en plans, toujours en direction.

   2. LA CHARTE est la fin de partie. Quand le bourg a fait ses preuves,
      on la scelle : tout repart, mais on garde des SCEAUX qui achètent
      des avantages définitifs. C'est le seul endroit du jeu où l'on perd
      volontairement ce qu'on a bâti.
   -> window.OBJECTIFS, window.SCEAUX_PERKS
   ============================================================ */
"use strict";
(function () {

  const O = [];
  /* o(id, groupe, nom, desc, cible, mesure, recompense) */
  function o(id, gr, nom, desc, cible, mesure, rec) {
    O.push({ id, gr, nom, desc, cible, mesure, rec });
  }

  const E = () => window.Etat.E;
  const nbBat = () => Object.keys(E().bat).length;
  const nbType = t => window.Etat.batsDeType(t).length;
  const totalRes = cat => {
    let n = 0;
    for (const id in window.RES) if (window.RES[id].cat === cat) n += window.Etat.qte(id);
    return n;
  };

  /* ---------------- BÂTIR ---------------- */
  o('b1', 'batir', 'Un toit et un filet', 'Poser vos deux premiers édifices.',
    2, () => nbBat(), { ecu: 150 });
  o('b2', 'batir', 'Un vrai hameau', 'Dix édifices debout en même temps.',
    10, () => nbBat(), { ecu: 1200, planche: 30 });
  o('b3', 'batir', 'Le bourg', 'Vingt édifices debout en même temps.',
    20, () => nbBat(), { ecu: 6000, poutre: 4 });
  o('b4', 'batir', 'La cité', 'Trente édifices debout en même temps.',
    30, () => nbBat(), { ecu: 30000, plan: 1 });
  o('b5', 'batir', 'Le grand œuvre', 'Un édifice au niveau dix.',
    1, () => { let n = 0; for (const b in E().bat) if (E().bat[b].niv >= 10) n++; return n; },
    { ecu: 40000, plan: 1 });

  /* ---------------- PEUPLER ---------------- */
  o('p1', 'peupler', 'On n\'est plus seul', 'Cinq habitants au bourg.',
    5, () => E().habitants.length, { ecu: 400 });
  o('p2', 'peupler', 'Une vraie communauté', 'Quinze habitants au bourg.',
    15, () => E().habitants.length, { ecu: 3000, pain: 40 });
  o('p3', 'peupler', 'Le bourg déborde', 'Trente habitants au bourg.',
    30, () => E().habitants.length, { ecu: 20000 });
  o('p4', 'peupler', 'Un maître en son art', 'Un habitant au niveau dix.',
    1, () => E().habitants.filter(h => (h.niv || 1) >= 10).length, { ecu: 9000 });
  o('p5', 'peupler', 'La bonne humeur', 'Atteindre 90 de moral.',
    90, () => E().moral, { ecu: 6000, miel: 20 });

  /* ---------------- PRODUIRE ---------------- */
  o('r1', 'produire', 'Les premières planches', 'Avoir 100 planches en réserve.',
    100, () => window.Etat.qte('planche'), { ecu: 500 });
  o('r2', 'produire', 'La coulée', 'Avoir 50 lingots de fer en réserve.',
    50, () => window.Etat.qte('lingotfer'), { ecu: 2500 });
  o('r3', 'produire', 'L\'acier', 'Avoir 25 lingots d\'acier en réserve.',
    25, () => window.Etat.qte('acier'), { ecu: 12000 });
  o('r4', 'produire', 'Le grenier plein', 'Deux mille unités de vivres au total.',
    2000, () => totalRes('vivres'), { ecu: 8000 });
  o('r5', 'produire', 'Le trésor', 'Cent mille écus au coffre.',
    100000, () => window.Etat.qte('ecu'), { plan: 1, lingotor: 5 });
  o('r6', 'produire', 'L\'outillage', 'Forger vingt outillages.',
    20, () => window.Etat.qte('outil') + window.Etat.qte('outilacier'), { ecu: 7000 });
  o('r7', 'produire', 'Le savoir écrit', 'Copier trois grimoires.',
    3, () => window.Etat.qte('sort'), { ecu: 25000, plan: 1 });

  /* ---------------- APPRENDRE ---------------- */
  o('s1', 'apprendre', 'Le premier acquis', 'Acquérir une recherche.',
    1, () => Object.keys(E().recherches || {}).length, { ecu: 800 });
  o('s2', 'apprendre', 'Une branche entière', 'Acquérir sept recherches.',
    7, () => Object.keys(E().recherches || {}).length, { ecu: 9000 });
  o('s3', 'apprendre', 'Le bourg savant', 'Acquérir vingt recherches.',
    20, () => Object.keys(E().recherches || {}).length, { ecu: 50000, plan: 2 });
  o('s4', 'apprendre', 'Le rang de maître', 'Porter un métier au rang dix.',
    10, () => Math.max.apply(null, Object.keys(window.METIERS).map(m => window.Etat.rangMetier(m))),
    { ecu: 15000 });
  o('s5', 'apprendre', 'Les contremaîtres', 'Engager quatre contremaîtres.',
    4, () => Object.keys((E().auto || {}).acquis || {}).length, { ecu: 20000 });

  /* ---------------- DESCENDRE ---------------- */
  o('d1', 'descendre', 'Le premier étage', 'Descendre à l\'étage 3 de la Tour sombre.',
    3, () => E().aventure.record, { ecu: 900 });
  o('d2', 'descendre', 'Les grottes', 'Descendre à l\'étage 10.',
    10, () => E().aventure.record, { ecu: 4500, essence: 10 });
  o('d3', 'descendre', 'Les cristaux', 'Descendre à l\'étage 20.',
    20, () => E().aventure.record, { ecu: 18000, gemme: 3 });
  o('d4', 'descendre', 'La lave', 'Descendre à l\'étage 35.',
    35, () => E().aventure.record, { ecu: 60000, obsidienne: 3, plan: 1 });
  o('d5', 'descendre', 'Le pays des morts', 'Descendre à l\'étage 50.',
    50, () => E().aventure.record, { ecu: 200000, relique: 1, plan: 2 });
  o('d6', 'descendre', 'La compagnie', 'Recruter trois compagnons.',
    3, () => (window.GameState && window.GameState.gen ? window.GameState.gen().roster.length : 0),
    { ecu: 12000 });

  /* ---------------- CONQUÉRIR ---------------- */
  o('g1', 'conquerir', 'La première colonne', 'Former dix unités à la caserne.',
    10, () => E().armee.unites, { ecu: 1500 });
  o('g2', 'conquerir', 'Les Basses Berges', 'Prendre un territoire.',
    1, () => window.Etat.nbConquetes(), { ecu: 5000, medaille: 2 });
  o('g3', 'conquerir', 'Le comté', 'Prendre six territoires.',
    6, () => window.Etat.nbConquetes(), { ecu: 40000, medaille: 6 });
  o('g4', 'conquerir', 'Toute la vallée', 'Prendre les douze territoires.',
    12, () => window.Etat.nbConquetes(), { ecu: 250000, relique: 2, plan: 3 });
  o('g5', 'conquerir', 'Rempart tenu', 'Repousser un raid sans un dégât.',
    1, () => E().raidsRepousses || 0, { ecu: 10000 });
  o('g6', 'conquerir', 'Le mur', 'Porter la défense du bourg à cent.',
    100, () => window.Jeu.defenseTotale(), { ecu: 30000 });

  /* ---------------- LES PORTES ET LA TOUR ----------------
     Ces objectifs-là ne récompensent pas l'accumulation : ils pointent
     ce que le joueur n'a pas encore ESSAYÉ. Ouvrir les portes, tenir un
     péril, revenir chercher quelqu'un. */
  const T = () => window.Tour;
  o('p6', 'peupler', 'Ouvrir les portes', 'Accueillir votre premier voyageur choisi parmi trois.',
    1, () => E().portes.accueillis || 0, { ecu: 400 });
  o('p7', 'peupler', 'On en parle sur la route', 'Accueillir vingt habitants aux portes du bourg.',
    20, () => E().portes.accueillis || 0, { ecu: 9000, tourte: 10 });
  o('p8', 'peupler', 'Un nom qui vaut', 'Accueillir un habitant Insigne ou Légende.',
    1, () => E().habitants.filter(h => h.rarete === 'insigne' || h.rarete === 'legende').length,
    { ecu: 5000, parchemin: 4 });
  o('p9', 'peupler', 'Personne ne part', 'Atteindre vingt habitants sans avoir renvoyé quiconque.',
    20, () => (E().portes.renvois || 0) ? 0 : E().habitants.length, { ecu: 15000, relique: 0 });

  o('d5', 'descendre', 'Paré pour le feu', 'Tenir dix charges de garde de feu en réserve.',
    10, () => window.Etat.qte('gardefeu'), { ecu: 4000 });
  o('d6', 'descendre', 'Le premier gardien', 'Ouvrir un gardien de la tour.',
    1, () => T() ? T().gardiensOuverts().length : 0, { ecu: 3000, essence: 5 });
  o('d7', 'descendre', 'La tournée des gardiens', 'Ouvrir cinq gardiens.',
    5, () => T() ? T().gardiensOuverts().length : 0, { ecu: 22000, gemme: 3 });
  o('d8', 'descendre', 'On ne laisse personne', "Ramener quelqu'un des profondeurs.",
    1, () => E().aventure.ramenes || 0, { ecu: 12000, cire: 30 });
  o('d9', 'descendre', "L'équipée au complet",
    'Descendre avec quatre habitants du bourg à la fois.',
    4, () => T() ? T().equipee().length : 0, { ecu: 8000, poissonfume: 20 });

  o('c5', 'conquerir', "Sortir plutôt qu'attendre", 'Repousser la Menace par une sortie.',
    1, () => E().sorties || 0, { ecu: 2500 });
  o('c6', 'conquerir', "Le bourg qu'on ne pille pas", 'Cinq sorties victorieuses.',
    5, () => E().sorties || 0, { ecu: 20000, medaille: 3 });

  o('a5', 'apprendre', "L'œil du chercheur", 'Faire cinq cents trouvailles au travail.',
    500, () => E().trouvailles || 0, { ecu: 7000 });
  o('a6', 'apprendre', 'Rien ne se perd', 'Faire cinq mille trouvailles.',
    5000, () => E().trouvailles || 0, { ecu: 45000, plan: 1 });

  const GROUPES = {
    batir:     { id: 'batir',     nom: 'Bâtir' },
    peupler:   { id: 'peupler',   nom: 'Peupler' },
    produire:  { id: 'produire',  nom: 'Produire' },
    apprendre: { id: 'apprendre', nom: 'Apprendre' },
    descendre: { id: 'descendre', nom: 'Descendre' },
    conquerir: { id: 'conquerir', nom: 'Conquérir' },
  };

  /* =================================================================
     LES SCEAUX DE LA CHARTE
     Ce qu'on garde quand on recommence. Chaque avantage est définitif
     et s'empile d'une charte à l'autre.
     ================================================================= */
  const PERKS = [
    { id: 'cadence', nom: 'La main leste', max: 20,
      desc: 'Chaque cran ajoute 4 % de cadence à tout le bourg, pour toujours.',
      cout: n => 1 + n, effet: n => ({ global: 0.04 * n }) },
    { id: 'depart', nom: 'Le premier convoi', max: 10,
      desc: 'Chaque cran fait commencer la partie suivante avec un habitant de plus.',
      cout: n => 2 + n * 2, effet: n => ({ habitants: n }) },
    { id: 'reserve', nom: 'Les caves anciennes', max: 12,
      desc: 'Chaque cran ajoute 15 % à tous les plafonds de stockage.',
      cout: n => 1 + Math.floor(n * 1.5), effet: n => ({ stock: 0.15 * n }) },
    { id: 'savoir', nom: 'La mémoire du bourg', max: 8,
      desc: 'Chaque cran conserve un rang de métier sur deux d\'une charte à l\'autre.',
      cout: n => 3 + n * 3, effet: n => ({ memoire: 0.5 * Math.min(1, n / 4) }) },
    { id: 'coffre', nom: 'Le coffre scellé', max: 10,
      desc: 'Chaque cran fait commencer la partie suivante avec 5 000 écus de plus.',
      cout: n => 1 + n, effet: n => ({ ecus: 5000 * n }) },
    { id: 'colonne', nom: 'Les vétérans', max: 10,
      desc: 'Chaque cran donne 8 % de colonne en plus et 6 % de butin de descente.',
      cout: n => 2 + n * 2, effet: n => ({ colonne: 0.08 * n, descente: 0.06 * n }) },
    { id: 'plan', nom: 'Les plans conservés', max: 5,
      desc: 'Chaque cran conserve un plan d\'une charte à l\'autre.',
      cout: n => 4 + n * 4, effet: n => ({ plans: n }) },
  ];

  window.OBJECTIFS = O;
  window.OBJ_GROUPES = GROUPES;
  window.SCEAUX_PERKS = PERKS;

})();
