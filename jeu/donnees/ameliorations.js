/* ============================================================
   LE BOURG — donnees/ameliorations.js
   DEUX ÉTAGES D'INCRÉMENTAL, et ils ne servent pas à la même chose.

   1. LES AMÉLIORATIONS D'ATELIER. Locales, achetées à l'édifice, payées
      en écus ET en ce que l'atelier produit lui-même : pour affûter la
      scierie il faut des planches, pour agrandir la mine il faut du fer.
      C'est le puits où part la production quand elle devient pléthorique.

   2. LES RECHERCHES DU BOURG. Globales, définitives, payées en écus et
      en savoirs. Quatre branches qui ne peuvent pas être menées de front :
      c'est là que se décide le VISAGE d'une partie.
   -> window.AMELIO, window.RECHERCHES, window.RECH_BRANCHES
   ============================================================ */
"use strict";
(function () {

  /* =================================================================
     I. LES AMÉLIORATIONS D'ATELIER
     Les mêmes cinq pour tous les édifices : on les lit une fois et on
     les comprend partout. Ce qui change d'un atelier à l'autre, c'est
     la MATIÈRE qu'elles réclament — celle qu'il produit.
     ================================================================= */
  const AMELIO = [
    { id: 'cadence', nom: 'Outillage affûté', max: 8,
      desc: "Chaque cran ajoute 7 % de cadence à tous les postes de l'atelier.",
      ico: { f: 'marteau', c: ['#8d9199', '#5a5e66'] },
      effet: n => ({ cadence: 0.07 * n }) },
    { id: 'rendement', nom: 'Main sûre', max: 6,
      desc: 'Chaque cran donne 8 % de chances de sortir un exemplaire de plus à chaque cycle.',
      ico: { f: 'tas', c: ['#c9a94e', '#8f7430'] },
      effet: n => ({ rendement: 0.08 * n }) },
    { id: 'economie', nom: 'Rien ne se perd', max: 6,
      desc: 'Chaque cran retire 6 % de la matière consommée par cycle.',
      ico: { f: 'tonneau', c: ['#8a6a45', '#5a412a'] },
      effet: n => ({ conso: 0.06 * n }) },
    { id: 'oeil', nom: 'Œil exercé', max: 4,
      desc: 'Chaque cran augmente de 25 % les chances des trouvailles.',
      ico: { f: 'oeil', c: ['#e0dcd0', '#7f6fc0'] },
      effet: n => ({ butin: 0.25 * n }) },
    { id: 'etabli', nom: 'Établi supplémentaire', max: 2,
      desc: "Un poste de travail de plus, sans toucher au niveau du bâtiment.",
      ico: { f: 'enclume', c: ['#4a4e56', '#7a7e86'] },
      effet: n => ({ postes: n }) },
  ];

  /* Le coût d'un cran : des écus, et LA MATIÈRE DE L'ATELIER. On lit la
     première sortie de sa première recette — la scierie paie en planches,
     la fonderie en lingots, la pêcherie en poissons. */
  function matiereDe(type) {
    const def = window.BAT[type];
    if (!def) return null;
    for (const rid of (def.recettes || [])) {
      const r = window.REC[rid];
      if (!r) continue;
      const k = Object.keys(r.out)[0];
      if (k && window.RES[k]) return k;
    }
    return null;
  }
  function coutAmelio(type, amId, rang) {
    const a = AMELIO.find(x => x.id === amId);
    if (!a) return {};
    const base = { cadence: 1, rendement: 1.35, economie: 1.2, oeil: 1.9, etabli: 4.5 }[amId] || 1;
    const n = Math.max(0, rang);
    const mat = matiereDe(type);
    const out = { ecu: Math.round(220 * base * Math.pow(2.15, n)) };
    if (mat) out[mat] = Math.max(4, Math.round(14 * base * Math.pow(1.85, n)));
    /* au-delà du quatrième cran, il faut de l'ouvrage : la forge devient
       le goulot de tout le bourg, ce qui est exactement le but. */
    if (n >= 3) out.outil = Math.max(1, Math.round(Math.pow(1.6, n - 3)));
    if (n >= 5) out.acier = Math.max(1, Math.round(Math.pow(1.5, n - 5)));
    return out;
  }

  /* =================================================================
     II. LES RECHERCHES DU BOURG
     Quatre branches, sept crans chacune. Un nœud demande ses prérequis
     et se paie une fois pour toutes.
     ================================================================= */
  const BRANCHES = {
    recolte: { id: 'recolte', nom: 'La Terre',    desc: "Tirer plus de ce que le sol et l'eau donnent.",
               ico: { f: 'epi', c: ['#c9a94e', '#8f7430'] }, teinte: '#7fb069' },
    atelier: { id: 'atelier', nom: 'Le Feu',      desc: 'Transformer plus vite et perdre moins.',
               ico: { f: 'flamme', c: ['#ff9a3a', '#c2480e'] }, teinte: '#e0625c' },
    vie:     { id: 'vie',     nom: 'Le Toit',     desc: 'Faire venir du monde, et le garder de bonne humeur.',
               ico: { f: 'oeuf', c: ['#e8dcc4', '#c4b696'] }, teinte: '#e6c069' },
    guerre:  { id: 'guerre',  nom: 'La Garde',    desc: 'Tenir la Menace et porter la colonne plus loin.',
               ico: { f: 'epee', c: ['#c9cdd2', '#8a8f96'] }, teinte: '#8f7fc0' },
  };

  const R = [];
  /* r(id, branche, rang, nom, desc, cout, effet, prerequis) */
  function r(id, br, rang, nom, desc, cout, effet, req) {
    R.push({ id, br, rang, nom, desc, cout, effet, req: req || [] });
  }

  /* ---------------- LA TERRE ---------------- */
  r('assolement', 'recolte', 1, 'Assolement triennal',
    'Le champ, la bergerie et l’étable rendent 12 % plus vite.',
    { ecu: 900, ble: 60 }, { metier: { champs: 0.12, elevage: 0.12 } });
  r('futaie', 'recolte', 1, 'Futaie réglée',
    'La forêt est exploitée par coupes : +14 % au bûcheronnage.',
    { ecu: 900, bois: 120 }, { metier: { bois: 0.14 } });
  r('nasses', 'recolte', 2, 'Nasses doubles',
    'La rivière donne 16 % plus vite, et une trouvaille sur cinq de plus.',
    { ecu: 2200, corde: 20, poisson: 150 }, { metier: { peche: 0.16 }, butin: 0.20 }, ['futaie']);
  r('boisage', 'recolte', 2, 'Boisage de galerie',
    'Les galeries tiennent : +16 % à la mine et à la carrière.',
    { ecu: 2400, poutre: 6, planche: 80 }, { metier: { mine: 0.16 } }, ['futaie']);
  r('irrigation', 'recolte', 3, 'Rigoles d’irrigation',
    'Toute récolte gagne 10 % de cadence, et le puits rend le double.',
    { ecu: 6500, pierretaille: 40, eau: 200 }, { metier: { champs: 0.10, elevage: 0.10, peche: 0.10, bois: 0.10 } },
    ['assolement', 'nasses']);
  r('prospection', 'recolte', 4, 'Prospection au pendule',
    'Les trouvailles de toutes les récoltes tombent 60 % plus souvent.',
    { ecu: 18000, gemme: 3, parchemin: 6 }, { butin: 0.60 }, ['boisage', 'irrigation']);
  r('abondance', 'recolte', 5, 'Les grandes années',
    'Un cycle de récolte sur six rend le double.',
    { ecu: 60000, relique: 1, tourte: 40 }, { rendementMetier: { champs: 0.17, elevage: 0.17, peche: 0.17, bois: 0.17, mine: 0.17 } },
    ['prospection']);

  /* ---------------- LE FEU ---------------- */
  r('soufflet', 'atelier', 1, 'Soufflet à double chambre',
    'La forge, la fonderie et tout ce qui brûle gagnent 14 %.',
    { ecu: 1100, charbonbois: 40 }, { metier: { feu: 0.14, forge: 0.14 } });
  r('gabarits', 'atelier', 1, 'Gabarits de menuiserie',
    'Le tissage, la cuisine et le savoir gagnent 14 %.',
    { ecu: 1100, planche: 60 }, { metier: { tissage: 0.14, cuisine: 0.14, savoir: 0.14 } });
  r('recuperation', 'atelier', 2, 'Récupération des chutes',
    'Tous les ateliers consomment 10 % de matière en moins.',
    { ecu: 3200, clou: 20 }, { conso: 0.10 }, ['soufflet']);
  r('cementation', 'atelier', 3, 'Cémentation longue',
    'La fonderie et la forge gagnent encore 18 %, et rendent plus souvent un exemplaire de plus.',
    { ecu: 9000, acier: 8, charbonbois: 120 }, { metier: { feu: 0.18, forge: 0.18 }, rendement: 0.10 },
    ['recuperation']);
  r('lignes', 'atelier', 3, 'Lignes de fabrication',
    'Chaque atelier de niveau 5 ou plus ouvre un poste de plus.',
    { ecu: 12000, poutre: 12, outil: 6 }, { posteNiveau: 5 }, ['gabarits', 'recuperation']);
  r('trempe', 'atelier', 4, 'Trempe à l’huile',
    "L'outillage dure deux fois plus longtemps.",
    { ecu: 26000, huile: 40, acier: 20 }, { outilDuree: 1.0 }, ['cementation']);
  r('manufacture', 'atelier', 5, 'La manufacture',
    'Tous les ateliers gagnent 20 % de cadence, définitivement.',
    { ecu: 90000, mithril: 1, plan: 4 }, { global: 0.20 }, ['trempe', 'lignes']);

  /* ---------------- LE TOIT ---------------- */
  r('cadastre', 'vie', 1, 'Cadastre du bourg',
    'Chaque maison loge une personne de plus.',
    { ecu: 800, parchemin: 2 }, { logementParMaison: 1 });
  r('renommee', 'vie', 1, 'La renommée du bourg',
    'On vient s’installer 30 % plus vite.',
    { ecu: 900, pain: 60 }, { immigration: 0.30 });
  r('greniers', 'vie', 2, 'Greniers voûtés',
    'Tous les plafonds de stockage montent de 35 %.',
    { ecu: 2600, brique: 60 }, { stock: 0.35 }, ['cadastre']);
  r('fetes', 'vie', 2, 'Les fêtes du bourg',
    'Le moral gagne 12 points en permanence.',
    { ecu: 3000, miel: 30, drap: 6 }, { moral: 12 }, ['renommee']);
  r('ecoles', 'vie', 3, 'Les écoles',
    'Les habitants apprennent leur métier 50 % plus vite, et le bourg aussi.',
    { ecu: 8000, parchemin: 12, encre: 8 }, { xp: 0.50 }, ['fetes']);
  r('halles', 'vie', 4, 'Les grandes halles',
    'Le négoce rapporte 40 % de plus, et les plafonds montent encore de 40 %.',
    { ecu: 24000, pierretaille: 120, poutre: 10 }, { stock: 0.40, negoce: 0.40 }, ['greniers', 'ecoles']);
  r('charte', 'vie', 5, 'La charte communale',
    'Le bourg s’administre : +25 % de cadence partout et +20 points de moral.',
    { ecu: 100000, bijou: 4, plan: 3 }, { global: 0.25, moral: 20 }, ['halles']);

  /* ---------------- LA GARDE ---------------- */
  r('guet', 'guerre', 1, 'Le guet permanent',
    'La Menace monte 20 % moins vite.',
    { ecu: 1000, planche: 50 }, { menace: 0.20 });
  r('milice', 'guerre', 1, 'La milice du bourg',
    '+15 de défense, sans caserne.',
    { ecu: 1200, arme: 2 }, { defense: 15 });
  r('fortification', 'guerre', 2, 'Fortifications avancées',
    'Les remparts, la caserne et les tours comptent double.',
    { ecu: 4000, pierretaille: 90 }, { defenseMult: 1.0 }, ['milice']);
  r('intendance', 'guerre', 3, "L'intendance",
    'La colonne part avec un tiers de ravitaillement en moins et rentre avec un tiers de pertes en moins.',
    { ecu: 9000, poissonfume: 60, cuir: 30 }, { expedition: 0.33 }, ['fortification']);
  r('cartographie', 'guerre', 3, 'Cartographie des profondeurs',
    'La descente rapporte 25 % de butin en plus.',
    { ecu: 11000, parchemin: 10, essence: 20 }, { descente: 0.25 }, ['guet']);
  r('arsenal', 'guerre', 4, "L'arsenal",
    'Chaque palier d’armement vaut une fois et demie.',
    { ecu: 30000, acier: 30, armure: 6 }, { armement: 0.5 }, ['intendance']);
  r('banniere', 'guerre', 5, 'La bannière du comté',
    'La colonne aligne 30 % de monde en plus, et la Menace monte 35 % moins vite.',
    { ecu: 110000, relique: 2, chant: 6 }, { colonne: 0.30, menace: 0.35 }, ['arsenal', 'cartographie']);

  /* ---------------- LA TOUR ----------------
     Ce que le bourg apprend des profondeurs : les gardes tiennent plus
     longtemps, les gardiens cèdent plus vite, et l'on ramène ceux qui
     sont tombés sans y laisser sa chemise. */
  r('onguents', 'guerre', 2, 'Onguents épaissis',
    'Une garde de profondeur sur quatre ne se consomme pas.',
    { ecu: 5200, resine: 20, ecaille: 10 }, { garde: 0.25 }, ['guet']);
  r('assaut', 'guerre', 3, "L'art de l'assaut",
    'Les gardiens de la tour cèdent 20 % plus souvent.',
    { ecu: 14000, ossuaire: 20, arme: 6 }, { gardien: 0.20 }, ['onguents']);
  r('rites', 'guerre', 4, 'Les rites du bourg',
    "Ramener quelqu'un des profondeurs coûte 40 % de moins.",
    { ecu: 26000, cire: 60, essence: 30 }, { rite: 0.40 }, ['assaut']);
  r('equipee', 'guerre', 4, "La grande équipée",
    "Deux places de plus dans l'équipée de la tour.",
    { ecu: 34000, chant: 2, coeurbiome: 2 }, { equipee: 2 }, ['assaut']);
  r('coeurs', 'guerre', 5, 'Lire les cœurs',
    "Les gardiens rendent moitié plus, et l'abîme ne demande plus double garde.",
    { ecu: 140000, coeurbiome: 6, oeilabyme: 1 }, { gardienButin: 0.5, abyme: 1 }, ['rites', 'equipee']);

  window.AMELIO = AMELIO;
  window.AmelioUtil = { coutAmelio, matiereDe };
  window.RECHERCHES = R;
  window.RECH_BRANCHES = BRANCHES;

})();
