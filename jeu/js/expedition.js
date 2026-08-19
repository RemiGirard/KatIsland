/* ============================================================
   LE BOURG — js/expedition.js
   LA BATAILLE D'ÎLE.

   On ne part plus par une porte : le bourg est sur une île, et toute
   la guerre passe par LE PORT. Ce module ne décide de rien — il MÈNE
   la bataille que le port a préparée, avec la cale que le joueur a
   remplie, et rend le résultat au port.

   Le moteur est celui de l'ancien jeu (`expedition/battle-core.js`),
   avec sa configuration complète : IA progressive, renforts par
   vagues, statistiques d'arme et d'armure par catégorie.
   ============================================================ */
"use strict";
(function () {

  const U = () => window.UI, el = () => window.UI.el;
  const E = () => window.Etat.E;

  /* =================================================================
     LES ZONES. Difficulté croissante, et surtout : chacune répond à un
     goulot d'étranglement précis de l'économie. On ne prend pas une
     zone « parce qu'elle est là » — on la prend parce que la scierie
     n'arrive plus à suivre.
     ================================================================= */
  const ZONES = [
    { id: 'berges',   nom: 'Les Basses Berges', diff: 1, noeuds: 5,
      desc: "Une langue de gravier que la Nuée utilise pour remonter la rivière sans être vue.",
      cout: { unites: 3, poisson: 12 }, bonus: { metier: 'peche', pct: 0.14 },
      butin: { medaille: 1, essence: 2 } },
    { id: 'taillis',  nom: 'Le Taillis Brûlé', diff: 2, noeuds: 6,
      desc: "Ils y mettent le feu chaque printemps pour dégager leur vue. On peut leur retirer l'habitude.",
      cout: { unites: 4, poisson: 20 }, bonus: { metier: 'bois', pct: 0.14 },
      butin: { medaille: 1, bois: 40 } },
    { id: 'carriere', nom: 'La Carrière Haute', diff: 3, noeuds: 7,
      desc: "Un front de taille abandonné, tenu par une garnison qui n'en tire rien.",
      cout: { unites: 6, pain: 8 }, bonus: { metier: 'mine', pct: 0.14 },
      butin: { medaille: 2, pierre: 60 } },
    { id: 'paturage', nom: 'Les Grands Pâturages', diff: 4, noeuds: 7,
      desc: "De l'herbe à perte de vue et personne pour y mener un troupeau. Une aberration.",
      cout: { unites: 8, pain: 10 }, bonus: { metier: 'elevage', pct: 0.16 },
      butin: { medaille: 2, laine: 30, peau: 12 } },
    { id: 'plateau',  nom: 'Le Plateau du Vent', diff: 5, noeuds: 8,
      desc: "Le vent y est régulier toute l'année. Le meunier en rêve depuis qu'il a des dents.",
      cout: { unites: 10, tourte: 3 }, bonus: { metier: 'cuisine', pct: 0.18 },
      butin: { medaille: 3, ble: 90 } },
    { id: 'saline',   nom: 'La Saline', diff: 6, noeuds: 8,
      desc: "Des tables d'évaporation en escalier. Qui tient le sel tient l'hiver.",
      cout: { unites: 12, tourte: 4 }, bonus: { global: 0.05 },
      butin: { medaille: 3, poissonfume: 20 } },
    { id: 'boisancien', nom: 'Le Bois Ancien', diff: 7, noeuds: 9,
      desc: "Des fûts de six mètres de tour. Une seule de ces poutres porterait un rempart.",
      cout: { unites: 14, tourte: 5 }, bonus: { metier: 'bois', pct: 0.20 },
      butin: { medaille: 4, poutre: 6, planche: 40 } },
    { id: 'veine',    nom: 'La Veine Rouge', diff: 8, noeuds: 9,
      desc: "Un affleurement de fer si pur qu'on le prend d'abord pour de la brique.",
      cout: { unites: 16, potion: 2 }, bonus: { metier: 'feu', pct: 0.20 },
      butin: { medaille: 4, lingotfer: 20 } },
    { id: 'falaise',  nom: 'La Falaise aux Nids', diff: 10, noeuds: 10,
      desc: "C'est de là qu'elles partent. Y monter, c'est couper la Menace à la racine.",
      cout: { unites: 20, potion: 3 }, bonus: { menaceTaux: -0.30 },
      butin: { medaille: 6, essence: 12 } },
    { id: 'gouffre',  nom: 'Le Gouffre Sonnant', diff: 12, noeuds: 11,
      desc: "Une autre entrée du Puits, prise depuis toujours. La compagnie y descendrait moins loin, mais plus riche.",
      cout: { unites: 24, potion: 4 }, bonus: { butin: 0.15 },
      butin: { medaille: 8, gemme: 3, essence: 20 } },
    { id: 'minesnoires', nom: 'Les Mines Noires', diff: 15, noeuds: 12,
      desc: "On y taille une pierre qui ne réfléchit rien. La fonderie saura quoi en faire.",
      cout: { unites: 30, potion: 6 }, bonus: { metier: 'forge', pct: 0.22 },
      butin: { medaille: 10, obsidienne: 4 } },
    { id: 'aire',     nom: "L'Aire du Grand Bec", diff: 20, noeuds: 14,
      desc: "Le nid du chef. Personne n'y est allé deux fois — et le premier n'en est pas revenu.",
      cout: { unites: 40, potion: 10, chant: 2 }, bonus: { global: 0.12 },
      butin: { medaille: 20, relique: 1, obsidienne: 8 } },
  ];

  let bataille = null, zoneEnCours = null, colonneEnCours = [], ouvert = false, tB = 0, tCotes = 0;
  /* LE JEU MANUEL : ce qui reste en chaloupe, et le type qu'on tient
     au bout du doigt. `auto` dit qui commande. */
  let reserve = {}, typeChoisi = null, auto = true, barreRenforts = null;
  let plateau, scene, cvB, titre, sous, boutons, pied, gauche, droite;

  function refs() {
    plateau = document.getElementById('plateau');
    scene = document.getElementById('plateau-scene');
    cvB = document.getElementById('plateau-canvas');
    titre = document.getElementById('plateau-titre');
    sous = document.getElementById('plateau-sous');
    boutons = document.getElementById('plateau-boutons');
    pied = document.getElementById('plateau-pied');
    gauche = document.getElementById('plateau-gauche');
    droite = document.getElementById('plateau-droite');
  }

  function zoneById(id) { return ZONES.find(z => z.id === id) || null; }
  function prises() { return E().territoires || []; }
  function estPrise(id) { return prises().indexOf(id) >= 0; }
  function prochaine() { return ZONES.find(z => !estPrise(z.id)) || null; }

  /* ==================================================================
     CE QUI EST TENU, ET QUI DONNE UN AVANTAGE

     Deux registres, pour une raison d'histoire : l'ancienne conquête de
     ZONE inscrivait sa prise dans `E().territoires` (plus bas dans ce
     fichier), tandis qu'une victoire d'île — la seule qui se joue
     encore — s'inscrit dans `E().port.prises` (port.js). Les trois
     fonctions ci-dessous ne lisaient que le premier registre : le
     joueur prenait une île, le bilan lui promettait « toutes les tâches
     de pêche gagnent 14 % de cadence », et le multiplicateur restait à
     1,00 pour toujours. On lit donc les DEUX, et l'on dédoublonne : une
     île et sa zone portent le même identifiant et le même bonus.
     ================================================================== */
  function avantages() {
    const vus = Object.create(null), out = [];
    const ajouter = (id, b) => { if (!b || vus[id]) return; vus[id] = 1; out.push(b); };
    for (const id of prises()) { const z = zoneById(id); if (z) ajouter(id, z.bonus); }
    const p = E().port && E().port.prises;
    if (p && window.IleUtil) for (const id of p) {
      const i = window.IleUtil.parId(id); if (i) ajouter(id, i.bonus);
    }
    return out;
  }

  /* Les bonus permanents, lus par le moteur de production. */
  function bonusMetier(metier) {
    let m = 1;
    for (const b of avantages()) {
      if (b.metier === metier) m *= 1 + b.pct;
      if (b.global) m *= 1 + b.global;
    }
    return m;
  }
  function bonusButin() {
    let b = 0;
    for (const x of avantages()) if (x.butin) b += x.butin;
    return b;
  }
  function facteurMenace() {
    let f = 1;
    for (const b of avantages()) if (b.menaceTaux) f *= 1 + b.menaceTaux;
    return f;
  }

  /* =================================================================
     LANCEMENT D'UNE BATAILLE
     ================================================================= */
  /* =================================================================
     LA SORTIE

     Ce n'est pas une conquête : c'est la colonne du bourg qui va
     au-devant de celle qui approche. Il n'y a pas de territoire à
     gagner — seulement la jauge de Menace à faire retomber, et les
     armes ramassées sur le terrain.

     La zone n'existe pas dans la table : on la FABRIQUE à la mesure de
     la menace du moment. À vingt-cinq c'est une escarmouche, à
     quatre-vingt-quinze c'est le raid qu'on prend de vitesse.
     ================================================================= */
  function zoneSortie() {
    const E2 = E();
    const m = E2.menace;
    const diff = Math.max(1, Math.round(m / 7));
    const gain = window.Jeu.gainSortie();
    return {
      id: '__sortie', sortie: true, nom: 'Sortie du bourg', diff,
      noeuds: Math.max(4, Math.min(9, 4 + Math.floor(m / 18))),
      desc: "La colonne de la Nuée approche. On ne l'attend pas : on va la trouver.",
      cout: { unites: Math.max(1, Math.ceil(1 + m / 22)) },
      bonus: {},
      gainMenace: gain,
      butin: butinSortie(m),
    };
  }
  /* Ce qu'on ramasse : des médailles, et ce que la Nuée transportait. */
  function butinSortie(m) {
    const b = { medaille: Math.max(1, Math.round(m / 26)) };
    if (m >= 35) b.essence = Math.round(1 + m / 30);
    if (m >= 55) b.plume = Math.round(2 + m / 20);
    if (m >= 75) b.gemme = 1;
    return b;
  }
  /* ==================================================================
     CE QUE VAUT UNE UNITÉ DE LA NUÉE

     Repris de l'ancien lanceur, ligne pour ligne. Le principe : chaque
     CATÉGORIE d'unité frappe avec SA ligne d'arme et s'habille avec SA
     ligne d'armure — un archer ne tient pas une épée, un mage ne porte
     pas de maille. Sans cela, tout le camp adverse se battait avec
     l'équipement de mêlée du premier palier.
     ================================================================== */
  function statsNuee(type, look, diff) {
    const GD = window.GameData;
    const u = GD.UNIT_TYPES[type];
    if (!u) return null;
    const base = u.base;
    const em = GD.evoStatMult ? GD.evoStatMult(look.evo) : Math.pow(1.055, look.evo || 0);
    const cat = u.cat || 'melee';
    const pick = (arr, tier) => (arr && arr.length)
      ? arr[Math.min(tier || 0, arr.length - 1)] : { dmgMult: 1, hpMult: 1 };

    let wMult = pick(GD.WEAPONS, look.weapon).dmgMult;
    if (cat === 'tir' && GD.RANGED) wMult = pick(GD.RANGED, look.ranged).dmgMult;
    else if (cat === 'magie' && GD.STAFFS) wMult = pick(GD.STAFFS, look.staff).dmgMult;
    else if (cat === 'explosif' && GD.ORDNANCE) wMult = pick(GD.ORDNANCE, look.ordnance).dmgMult;

    let aMult = pick(GD.ARMORS, look.armor).hpMult;
    if (cat === 'magie' && GD.ROBES) aMult = pick(GD.ROBES, look.robe).hpMult;
    else if (cat === 'tir' && GD.VESTS) aMult = pick(GD.VESTS, look.vest).hpMult;
    else if (cat === 'explosif' && GD.SUITS) aMult = pick(GD.SUITS, look.suit).hpMult;

    /* seules les unités à distance PUISSANTES gagnent de la portée avec
       leur palier d'arme — et peuvent dépasser une tour */
    let range = base.range;
    if (range > 0 && (cat === 'tir' || cat === 'explosif') &&
        GD.unitTier && GD.unitTier(type) >= 4) {
      const wTier = cat === 'tir' ? (look.ranged || 0) : (look.ordnance || 0);
      range = GD.rangedRangeBonus
        ? base.range * GD.rangedRangeBonus(type, wTier)
        : base.range * (1 + 0.008 * wTier);
    }
    return {
      hp: base.hp * em * (aMult || 1) * diff,
      dmg: base.dmg * em * (wMult || 1) * diff,
      aspd: base.aspd, mspd: base.mspd, range,
      ability: u.ability || null, cat, pop: u.pop || 1,
      weapon: look.weapon, armor: look.armor, evo: look.evo,
      ranged: look.ranged || 0, staff: look.staff || 0,
      ordnance: look.ordnance || 0, robe: look.robe || 0,
      vest: look.vest || 0, suit: look.suit || 0,
    };
  }

  /* ==================================================================
     UNE ÎLE, VUE DEPUIS LE PORT

     La zone de bataille se déduit de l'île — sa difficulté, ses nœuds,
     son butin — mais la COLONNE vient de la cale du navire. C'est toute
     la différence avec l'ancienne sortie : on ne se bat pas avec ce que
     le bourg possède, on se bat avec ce qu'on a eu la place d'emmener.
     ================================================================== */
  let navireEnCours = null;

  function zoneDeLIle(ile) {
    return {
      id: 'ile:' + ile.id, ile: ile.id, nom: ile.nom, diff: ile.diff,
      noeuds: ile.noeuds, desc: ile.desc,
      cout: { unites: 1 },          // la cale a déjà été payée à l'embarquement
      bonus: ile.bonus || {}, butin: ile.butin || {},
      gainMenace: ile.menace,
      tier: ile.tier || 1, force: ile.force || 1, biome: ile.biome || null,
      effetBiome: ile.effetBiome || '',
    };
  }

  function lancerIle(ile, navire) {
    if (!ile || !navire) return;
    navireEnCours = navire;
    lancer(zoneDeLIle(ile), { cale: navire.cargo.map(c => ({ type: c.type, n: c.n })) });
  }

  /* LA SORTIE N'EXISTE PLUS. On ne part plus « à pied » : le bourg est
     sur une île, et toute la guerre passe désormais par le port. La
     fonction reste pour les sauvegardes qui la citent encore, mais
     elle renvoie au quai au lieu de lancer quoi que ce soit. */
  function lancerSortie() {
    const b = window.Etat.batsDeType('port')[0];
    if (b) { U().dire('La guerre passe par le port : armez un navire.', 'info');
             window.UIFen.ouvrirBatiment(b.id); }
    else U().dire('Il faut un port pour aller se battre.', 'alerte');
  }

  function lancer(zid, options) {
    const reprise = options && options.reprise;
    const z = (zid && typeof zid === 'object') ? zid : zoneById(zid);
    if (!z) return;
    if (!z.sortie && estPrise(z.id)) { U().dire('Cette zone est déjà tenue.', 'alerte'); return; }
    const E2 = E();
    const ligne = reprise && E2.expedition && E2.expedition.ligne
      ? E2.expedition.ligne.map(x => ({ type:x.type, n:x.n }))
      : (options && options.cale && options.cale.length
          ? options.cale.map(x => ({ type:x.type, n:x.n }))
          : (window.Armee ? window.Armee.colonne() : [{ type:'lancier', n:E2.armee.unites }]));
    const effectif = ligne.reduce((n, x) => n + x.n, 0);
    if (effectif < z.cout.unites) {
      U().dire('La colonne doit aligner ' + z.cout.unites + ' unités au minimum.', 'alerte'); return;
    }
    const cout = {};
    for (const k in z.cout) if (k !== 'unites') cout[k] = z.cout[k];
    if (!reprise && !window.Etat.assez(cout)) { U().dire('Ravitaillement insuffisant.', 'alerte'); return; }
    if (!reprise) window.Etat.depenser(cout);

    refs();
    ouvert = true; zoneEnCours = z; colonneEnCours = ligne; tB = 0; tCotes = 0;
    plateau.classList.add('vu');
    dimensionner();

    const seed = ((Date.now() / 1000) | 0) ^ (z.diff * 2654435761);
    /* `treeDepth` décide de la ramification du réseau de positions :
       une expédition profonde n'est pas une ligne droite. L'ancien jeu
       la calait sur l'avancement ; ici, sur la difficulté de la zone. */
    const map = window.Battle.generateMap({
      seed, mode: 'personal', playerFaction: 'cats',
      nodeCount: z.noeuds, stage: z.diff,
      theme: z.theme || null,
      treeDepth: Math.max(0, Math.min(3, Math.floor(z.diff / 5))),
      w: cvB.width, h: cvB.height,
    });
    const compo = equilibrer(map, z, ligne);
    /* LA DIFFICULTÉ. La couronne fixe le socle, la force module à
       l'intérieur — même découpage que pour les types et l'équipement,
       pour que les trois disent la même chose au joueur. */
    const diffMult = (1 + ((z.tier || 1) - 1) * 0.42 + ((z.force || 1) - 1) * 0.05)
                   * (z.biome === 'guerriere' ? 1.30 : 1);
    /* L'ÉQUIPEMENT DE LA NUÉE. L'ancien jeu tirait ces indices d'un
       « look » complet — une ligne par catégorie d'unité. On le
       reconstitue : sans lui, les archers ennemis se battaient avec
       l'arme de mêlée du premier palier. */
    /* L'ÉQUIPEMENT DE LA NUÉE sort maintenant de la COURONNE et de la
       FORCE, non plus de `diff` qui mélangeait les deux. Elle s'arme aux
       mêmes tables de forge que le bourg : ce que le joueur a devant lui
       est ce qu'il pourrait forger, et il peut donc le juger. */
    const pf = palierForge(z.tier || 1, z.force || 1);
    const look = {
      weapon: pf, armor: pf, ranged: pf, staff: pf,
      ordnance: pf, robe: pf, vest: pf, suit: pf,
      /* l'évolution monte avec la couronne seule : c'est le rang de la
         bête, pas son fourbi. */
      evo: Math.max(0, Math.min(3, Math.floor(((z.tier || 1) - 1) / 3))),
    };
    bataille = window.Battle.create({
      canvas: cvB, map, mode: 'personal', playerFaction: 'cats',
      difficulty: diffMult,
      composition: compo,
      getStats: (faction, type) => faction === 'cats'
        ? (window.Armee ? window.Armee.statsCombat(faction, type) : null)
        : statsNuee(type, look, diffMult),
      enemyLook: look,
      environment: z.biome ? { type: z.biome, tier: z.tier || 1,
        force: z.force || 1 } : null,

      /* L'IA MONTE EN GAMME. Zéro : elle se contente d'attaquer ce
         qu'elle voit. Trois : elle tient ses positions, concentre ses
         envois et vise ce qui fait mal. C'est ce réglage qui manquait
         le plus — il restait bloqué au milieu. */
      aiLevel: Math.min(3, Math.floor((z.diff - 1) / 8)),

      /* LES POINTS DE CONTRÔLE À TENIR pour l'emporter, plus nombreux
         à mesure que les cartes grandissent. */
      controlWinPoints: (window.GameData.BALANCE.controlWinPointsByStage || [])[z.diff - 1]
        || window.GameData.BALANCE.controlWinPoints,

      /* LES RENFORTS PAR VAGUES. Sans eux, toute la garnison adverse
         tombait d'un bloc au début : on gagnait ou l'on perdait dans la
         première minute. Par vagues, la bataille respire — on prend une
         position, on la tient, la suivante arrive. */
      enemyReinforce: z.diff >= 4 ? {
        interval: Math.max(22, (60 - z.diff) * (z.biome === 'guerriere' ? 0.72 : 1)),
        waves: Math.min(6, 1 + Math.floor(z.diff / 5)),
        size: Math.round((4 + z.diff * 0.8) * (diffMult > 2 ? 1.2 : 1)),
      } : null,

      onEvent: evenement,
    });
    /* LE JOUEUR TIENT LA BARRE. L'ancien mode était manuel : on gardait
       une réserve et on la versait où il fallait. Le pilote automatique
       reste, d'un clic, pour les batailles qu'on ne veut pas mener. */
    auto = false;
    bataille.setAutoPilot(false);
    typeChoisi = Object.keys(reserve)[0] || null;
    construireRenforts();
    /* SANS CECI, RIEN NE RÉPOND. `brancherPointeur()` pose les écouteurs
       de souris sur le canevas — pointerdown/move/up. Il n'était appelé
       que dans le chemin de reprise ; une bataille lancée depuis le
       port démarrait donc sourde à tout clic. */
    brancherPointeur();
    E2.expedition = { zone: z.id, zoneSpec:z, ligne:ligne, prog: 0, sortie: !!z.sortie,
                      nom: (z.sortie ? 'Sortie — ' : 'Expédition — ') + z.nom };
    window.Etat.journal(z.sortie
      ? 'La colonne sort à la rencontre de la Nuée.'
      : 'La colonne part pour ' + z.nom + '.', 'guerre');
    majTete();
    majCotes();
  }

  function reprendre() {
    const ex = E().expedition;
    if (!ex) return;
    const z = ex.zoneSpec || zoneById(ex.zone) || (ex.sortie ? zoneSortie() : null);
    if (!z) { E().expedition = null; U().dire('Cette ancienne expédition ne peut pas être reprise.', 'alerte'); return; }
    /* UNE REPRISE D'ÎLE DOIT RETROUVER SON NAVIRE. Le rechargement de la
       page a perdu `navireEnCours` : sans lui, `terminer()` ignorait le
       port — pas de survivants comptés, pas de butin en cale, et le
       navire restait mouillé devant l'île pour l'éternité. */
    if (z.ile && window.Port) {
      navireEnCours = window.Port.navires().find(n => n.etat === 'mouillage' && n.ile === z.ile) || null;
    }
    lancer(z, { reprise:true });
  }

  /* LA PORTE DE SECOURS. La bataille est enregistrée mais le joueur ne
     veut — ou ne peut — pas la rejouer : on la solde sans combat. Le
     navire reprend son équipage tel quel (personne n'est tombé dans une
     bataille qui n'a pas eu lieu) et reste au mouillage, libre de
     repartir. Sans elle, une expédition bloquée tenait le port en
     otage : « une bataille est déjà en cours », sans porte de sortie. */
  function abandonnerReprise() {
    const ex = E().expedition;
    if (!ex) return;
    const z = ex.zoneSpec || {};
    if (z.ile && window.Port) {
      const nav = window.Port.navires().find(n => n.etat === 'mouillage' && n.ile === z.ile);
      if (nav) {
        const vivants = {};
        for (const c of nav.cargo) vivants[c.type] = c.n;
        window.Port.resultat(nav.id, false, vivants);
      }
    }
    E().expedition = null;
    window.Etat.journal('L\'expédition est abandonnée avant d\'avoir été menée.', 'alerte');
  }

  /* ------------------------------------------------------------------
     L'ÉQUILIBRAGE. La carte générée ignore tout du bourg : elle donne au
     joueur une garnison forfaitaire. Or ce qui doit décider d'une
     bataille, c'est LE TRAVAIL DU BOURG — le nombre d'unités formées au
     la caserne et le palier d'armement de la forge. On
     réécrit donc la garnison de départ, et l'on cale la garnison adverse
     sur la difficulté de la zone.
     ------------------------------------------------------------------ */
  /* Ce que chaque camp alignera. On l'affiche AVANT le départ : une
     colonne qu'on envoie à l'aveugle est une colonne qu'on regrette. */
  function forces(z) {
    const ligne = window.Armee ? window.Armee.colonne() : [{ type:'lancier', n:Math.max(1, E().armee.unites) }];
    const bourg = window.Armee ? Math.round(window.Armee.puissance(ligne)) : ligne[0].n;
    return { bourg, nuee: Math.round(bourg * (0.50 + 0.075 * z.diff)) };
  }

  /* CE QUI DÉBARQUE, ET CE QUI ATTEND.

     Verser toute la cale au premier instant ne laissait rien à décider.
     On débarque UN TIERS — de quoi tenir la tête de pont — et le reste
     forme la réserve : le joueur la place où il veut, quand il veut.
     C'est le cœur du jeu manuel de l'ancien mode. */
  const PART_DEBARQUEE = 0.34;

  /* ==================================================================
     CE QUE LA NUÉE ALIGNE

     Deux nombres décrivent une île, et ils ne disent pas la même chose.

     LE TIER DE LA CARTE dit QUELLES unités on trouve. Au premier, la
     Nuée n'a que ses bandes de base ; chaque couronne franchie lui ouvre
     un palier de plus, jusqu'aux héros et aux chronarques du dixième.
     C'est la seule progression qui change la NATURE du combat.

     LA FORCE DE L'ÎLE (1 à 10) dit COMBIEN, et avec quel équipement. À
     l'intérieur d'une couronne on retrouve donc la même gamme d'unités
     du plus faible au plus fort — ce qui rend une couronne lisible : on
     sait ce qu'on va croiser, on ne sait pas encore combien.

     Sans cette séparation, `diff` mélangeait les deux : une île faible
     d'une couronne haute alignait des chronarques en guenilles, et une
     île forte d'une couronne basse des lanciers en armure de fin de
     partie. Ni l'un ni l'autre ne se lisait.
     ================================================================== */
  /* Six paliers d'unités pour dix couronnes : on en ouvre un peu plus
     d'un tous les deux tiers, et le dernier n'arrive qu'au bout. */
  function palierMax(tier) {
    return Math.max(1, Math.min(6, 1 + Math.ceil((tier || 1) * 0.55)));
  }
  /* L'ÉQUIPEMENT DE FORGE. Trois crans par couronne, plus trois que la
     force distribue à l'intérieur : une île 10 d'un tier vaut à peu près
     une île 1 du suivant, ce qui donne une pente continue sur trente
     paliers sans marche brutale au passage d'une couronne. */
  function palierForge(tier, force) {
    const t = Math.max(1, tier || 1), f = Math.max(1, Math.min(10, force || 1));
    return Math.max(0, Math.min(30, Math.round((t - 1) * 3 + (f - 1) / 3)));
  }
  /* Les types que la Nuée peut aligner à cette profondeur, RANGÉS DU
     PLUS COMMUN AU PLUS RARE. Le tri est nécessaire : `UNIT_TYPES` est
     dans l'ordre où il a été écrit, pas dans celui des paliers — les
     recrues y figurent en dernier. Sans tri, le reliquat d'arrondi
     tombait sur le dernier venu, c'est-à-dire au hasard. */
  function typesNuee(tier) {
    const GD = window.GameData;
    const max = palierMax(tier);
    const out = [];
    for (const t in (GD.UNIT_TYPES || {})) {
      const p = GD.unitTier ? GD.unitTier(t) : 1;
      if (p <= max) out.push({ type: t, palier: p });
    }
    /* jamais vide : une couronne sans type jouable rendrait la carte
       infranchissable au lieu de difficile. */
    out.sort((a, b) => a.palier - b.palier || (a.type < b.type ? -1 : 1));
    return out.length ? out : [{ type: 'lancier', palier: 2 }];
  }

  function equilibrer(map, z, ligne) {
    const compo = ligne.map(x => x.type);
    const g = {};
    reserve = {};
    for (const x of ligne) {
      const debarque = Math.max(1, Math.round(x.n * PART_DEBARQUEE));
      g[x.type] = Math.min(x.n, debarque);
      const reste = x.n - g[x.type];
      if (reste > 0) reserve[x.type] = reste;
    }
    const total = ligne.reduce((n, x) => n + x.n, 0);
    /* LA DIFFICULTÉ EST UN RAPPORT, pas un coefficient absolu. On mesure
       ce que le bourg aligne, on décide ce que doit aligner la Nuée —
       une fraction aux Basses Berges, le double et plus à l'Aire — et
       l'on renormalise TOUTES les garnisons adverses sur ce total. Le
       joueur sait alors ce qu'il lui manque : des unités, ou une forge. */
    const cible = total * (0.50 + 0.075 * z.diff);
    let somme = 0;
    const adverses = [];
    for (const n of map.nodes) {
      if (n.owner === 'cats' && n.kind === 'hq') { n.garrison = g; n.g = g; continue; }
      const gg = n.garrison || n.g || {};
      let s = 0; for (const k in gg) s += gg[k];
      if (s > 0) { adverses.push({ n, gg, s, hq: n.owner === 'birds' }); somme += s; }
    }
    if (somme > 0) {
      const k = cible / somme;
      for (const a of adverses) {
        /* les positions neutres cèdent plus vite que le quartier général :
           il faut que la carte s'ouvre, sinon la bataille est un mur. */
        const kk = a.hq ? k * 1.15 : k * 0.85;
        for (const t in a.gg) a.gg[t] = Math.max(1, Math.round(a.gg[t] * kk));
      }
    }
    /* ON REPEUPLE LES GARNISONS AVEC CE QUE LA COURONNE AUTORISE.

       `generateMap` tire ses types d'un `stage` générique, sans rien
       savoir de nos couronnes : une île du premier tier pouvait donc
       aligner des assassins. On garde les EFFECTIFS qu'il a calculés —
       c'est lui qui sait équilibrer une carte — et l'on remplace les
       TYPES par ceux du palier permis.

       La force de l'île décide de la part d'unités hautes : à force 1 on
       ne voit que le bas du panier, à force 10 le palier maximal domine.
       Le tirage est déterministe (position du nœud) : deux ouvertures de
       la même île donnent la même garnison. */
    const dispo = typesNuee(z.tier || 1);
    const fr = Math.max(1, Math.min(10, z.force || 1));
    /* LE CENTRE DE GRAVITÉ DES PALIERS SUIT LA FORCE.

       Premier jet : je pondérais par `pow(force/10, palierMax - palier)`.
       C'était à l'envers — une île de force 1 au dixième tier alignait
       douze chronarques, et une île de force 10 au premier tier n'avait
       que des recrues. Exactement le défaut que je prétendais corriger.

       On vise donc un PALIER CIBLE qui glisse du plus bas au plus haut à
       mesure que la force monte, et l'on répartit en cloche autour de
       lui. Une île faible aligne le bas du panier, une île forte le haut,
       et entre les deux on croise un mélange — ce qui rend une couronne
       lisible : on sait ce qui attend, on découvre en quelle proportion. */
    const pMin = dispo[0].palier;
    const pMax = dispo[dispo.length - 1].palier;
    const palierVise = pMin + (pMax - pMin) * ((fr - 1) / 9);
    for (const a of adverses) {
      const total = Math.max(1, Math.round(a.s));
      const poids = dispo.map(d => 1 / (1 + 2.2 * Math.abs(d.palier - palierVise)));
      const somme2 = poids.reduce((n, x) => n + x, 0) || 1;
      /* le reliquat d'arrondi va au palier le PLUS PROCHE du palier vise, pas
         au dernier du tableau : sinon il grossissait toujours le haut. */
      let pivot = 0;
      for (let i = 1; i < dispo.length; i++)
        if (Math.abs(dispo[i].palier - palierVise) < Math.abs(dispo[pivot].palier - palierVise)) pivot = i;
      const neuf = {};
      let reste = total;
      for (let i = 0; i < dispo.length && reste > 0; i++) {
        const n = Math.min(reste, Math.round(total * poids[i] / somme2));
        if (n > 0) { neuf[dispo[i].type] = (neuf[dispo[i].type] || 0) + n; reste -= n; }
      }
      if (reste > 0) neuf[dispo[pivot].type] = (neuf[dispo[pivot].type] || 0) + reste;
      a.n.garrison = neuf; a.n.g = neuf;
    }
    return compo;
  }

  function dimensionner() {
    const r = scene.getBoundingClientRect();
    cvB.width = Math.max(640, Math.min(1440, Math.round(r.width)));
    cvB.height = Math.max(420, Math.min(900, Math.round(r.height)));
    cvB.style.width = ''; cvB.style.height = '';
    if (bataille) bataille.resize();
  }

  function evenement(ev) {
    if (!ev) return;
    if (ev.type === 'victory') terminer(true);
    else if (ev.type === 'defeat') terminer(false);
    else if (ev.type === 'capture') U().dire('Position prise.', 'bien', 1400);
  }

  /* LES UNITÉS ENCORE VIVANTES, par type.

     On additionne les garnisons qui nous appartiennent, plus la réserve
     jamais débarquée. Mais ATTENTION : sur cette carte, une position
     tenue PRODUIT des unités toute la bataille. Compter les garnisons
     telles quelles donnait quarante-trois survivants pour vingt
     embarqués — le navire rentrait plus plein qu'il n'était parti.

     Ces renforts-là sont des levées locales : elles tiennent l'île,
     elles ne montent pas à bord. On PLAFONNE donc chaque type à ce
     qu'on avait embarqué. On peut revenir avec moins, jamais avec
     plus. */
  function survivants() {
    const brut = {};
    for (const t in reserve) if (reserve[t] > 0) brut[t] = reserve[t];
    try {
      const s = bataille && bataille.serialize ? bataille.serialize() : null;
      for (const n of ((s && s.nodes) || [])) {
        if (n.owner !== 'cats') continue;
        for (const t in (n.garrison || {})) {
          const q = Math.floor(n.garrison[t] || 0);
          if (q > 0) brut[t] = (brut[t] || 0) + q;
        }
      }
    } catch (e) { }

    const embarque = {};
    for (const x of colonneEnCours) embarque[x.type] = (embarque[x.type] || 0) + x.n;

    /* LES MORTS, COMPTÉS PAR LE MOTEUR. Plafonner aux effectifs
       embarqués ne suffisait pas : les positions tenues produisent sans
       cesse, si bien que les garnisons restaient pleines et que trois
       défaites de suite ne coûtaient pas une seule unité. On retire
       donc les pertes RÉELLES du camp.

       Approximation assumée : le moteur ne distingue pas nos embarqués
       des levées faites sur place, donc une levée tombée compte comme
       un des nôtres. L'erreur va dans le sens de l'usure, ce qui est le
       bon sens pour une expédition qu'on veut faire durer. */
    let morts = 0;
    try { morts = (bataille && bataille.getPlayerLosses) ? bataille.getPlayerLosses() : 0; }
    catch (e) { morts = 0; }

    const out = {};
    const ordre = Object.keys(embarque);
    /* on retire d'abord des types les plus nombreux : une compagnie
       fond par son gros, pas par ses spécialistes */
    ordre.sort((a, b) => (embarque[b] || 0) - (embarque[a] || 0));
    const reste = {};
    for (const t of ordre) reste[t] = Math.min(brut[t] || 0, embarque[t] || 0);
    let aRetirer = morts;
    while (aRetirer > 0) {
      let touche = false;
      for (const t of ordre) {
        if (aRetirer <= 0) break;
        if (reste[t] > 0) { reste[t]--; aRetirer--; touche = true; }
      }
      if (!touche) break;                 // il ne reste plus personne
    }
    for (const t in reste) if (reste[t] > 0) out[t] = reste[t];
    return out;
  }

  /* LA FIN DE BATAILLE

     Chaque issue a ses comptes à rendre — le port pour une île, la
     jauge de Menace pour une sortie, la carte des territoires pour une
     conquête — mais TOUTES sortent par la même porte. La bataille
     d'île sortait autrefois par un `return` prématuré : elle réglait
     ses comptes, ouvrait son bilan, et laissait le plateau plein écran
     affiché sur un champ de bataille mort. Le joueur restait enfermé
     devant. On calcule donc ce qu'il y a à calculer, puis on ferme, et
     seulement ensuite on montre le bilan.
     ================================================================= */
  /* LES PANNES DE BATAILLE, DITES UNE FOIS.

     Une exception dans la boucle de bataille se répète à chaque image.
     La signaler à chaque fois noierait la console ; la taire laisse le
     joueur devant un champ de bataille à moitié peint sans explication.
     On garde donc la PREMIÈRE de chaque sorte, avec sa pile, et l'on
     compte les suivantes — c'est ce compte qui dit si la panne est
     ponctuelle ou permanente. */
  const pannes = {};
  function signalerPanne(quoi, e) {
    if (!pannes[quoi]) {
      pannes[quoi] = 1;
      console.error('Bataille — panne de ' + quoi + ' :', e && e.message, e);
      U().dire('La bataille a rencontré une panne de ' + quoi + '. Voyez la console.', 'alerte', 5000);
    } else pannes[quoi]++;
  }
  /* Ce que le harnais de contrôle interroge après coup. */
  function pannesVues() { return Object.assign({}, pannes); }

  function terminer(gagne) {
    const z = zoneEnCours;
    const E2 = E();
    E2.expedition = null;
    if (!z) { fermer(); return; }

    /* Ce que le bilan aura à montrer. Chaque chemin le remplit à sa
       façon ; aucun ne s'échappe avant la fermeture commune.
       `faits` porte ce que la victoire a VRAIMENT changé : le bilan
       annonçait autrefois quarante-cinq points de menace et une
       garnison écrits en dur, alors que le chemin d'île en retire
       `ile.menace` — huit aux Basses Berges — et ne poste personne. */
    let recu = null;
    const faits = { menace: 0 };

    /* UNE BATAILLE D'ÎLE APPARTIENT AU PORT. C'est lui qui fait
       retomber la Nuée, remplit la cale de butin et renvoie le navire
       au bourg — le module d'expédition ne fait que la mener. */
    if (z.ile && window.Port && navireEnCours) {
      /* CE QUI RESTE DEBOUT, compté et non estimé. On additionne les
         garnisons encore à nous sur toute la carte, et l'on y rajoute
         la réserve jamais débarquée : c'est exactement ce qui remonte
         à bord. Ce qui est tombé ne rentre pas.
         `survivants()` lit la bataille et la colonne : il faut donc
         l'appeler AVANT que la fermeture ne les efface. */
      const nav = navireEnCours; navireEnCours = null;
      /* C'est `Port.resultat` qui retire la menace de l'île, et la jauge
         bute sur zéro : on relève la baisse RÉELLE de part et d'autre
         plutôt que de la recopier depuis la table. */
      const avant = E2.menace;
      window.Port.resultat(nav.id, gagne, survivants());
      faits.menace = Math.round(avant - E2.menace);
      if (window.Armee) window.Armee.gagnerXp(colonneEnCours, gagne ? 55 + z.diff * 16 : 18 + z.diff * 5);
      recu = gagne ? (z.butin || {}) : {};
    } else if (gagne && z.sortie) {
      /* Une sortie ne rapporte pas de terre : elle rachète du temps. */
      const av = E2.menace;
      E2.menace = Math.max(0, E2.menace - z.gainMenace);
      const pertes = Math.ceil(colonneEnCours.reduce((n,x) => n + x.n, 0) * 0.18);
      if (window.Armee) window.Armee.pertes(colonneEnCours, pertes); else E2.armee.unites = Math.max(0, E2.armee.unites - pertes);
      if (window.Armee) window.Armee.gagnerXp(colonneEnCours, 35 + z.diff * 12);
      E2.sorties = (E2.sorties || 0) + 1;
      recu = window.Etat.gagnerLot(z.butin);
      window.Etat.journal('Sortie victorieuse : la Menace retombe de ' +
        Math.round(av - E2.menace) + ' points.', 'guerre');
      U().dire('La Nuée reflue. Menace ' + Math.round(av) + ' → ' + Math.round(E2.menace) + '.', 'bien', 5000);
    } else if (gagne) {
      if (!estPrise(z.id)) E2.territoires.push(z.id);
      const avant = E2.menace;
      E2.menace = Math.max(0, E2.menace - 45);
      faits.menace = Math.round(avant - E2.menace);
      faits.garnison = true;
      const pertes = Math.ceil(colonneEnCours.reduce((n,x) => n + x.n, 0) * 0.22);
      if (window.Armee) window.Armee.pertes(colonneEnCours, pertes); else E2.armee.unites = Math.max(0, E2.armee.unites - pertes);
      if (window.Armee) window.Armee.gagnerXp(colonneEnCours, 55 + z.diff * 16);
      E2.armee.garnison += 1;
      recu = window.Etat.gagnerLot(z.butin);
      window.Etat.journal('Victoire à ' + z.nom + '. Le territoire est au bourg.', 'guerre');
      U().dire('Victoire — ' + z.nom + ' est prise.', 'bien', 5000);
    } else {
      E2.menace = Math.min(100, E2.menace + (z.sortie ? 4 : 8));
      /* Une défaite coûte des bras, pas la partie : on doit pouvoir
         reformer une colonne et revenir, mieux armé. */
      const pertes = Math.ceil(colonneEnCours.reduce((n,x) => n + x.n, 0) * 0.38);
      if (window.Armee) window.Armee.pertes(colonneEnCours, pertes); else E2.armee.unites = Math.max(0, E2.armee.unites - pertes);
      if (window.Armee) window.Armee.gagnerXp(colonneEnCours, 18 + z.diff * 5);
      window.Etat.journal('Défaite à ' + z.nom + '. La colonne rentre décimée.', 'alerte');
      U().dire('Défaite. La colonne rentre décimée.', 'alerte', 5000);
    }

    /* LE PLATEAU D'ABORD, LE BILAN ENSUITE.

       `fermer()` retire la classe 'vu' du plateau, détruit la bataille
       et vide les côtés : c'est le seul geste qui rend la main au
       joueur, et il doit passer quelle que soit l'issue. Le bilan, lui,
       est une fenêtre de l'interface ordinaire — il n'appartient pas au
       plateau et survit donc à sa fermeture, posé sur le bourg
       retrouvé.

       On ferme franchement, sans différé : `terminer()` est appelé
       depuis le dernier geste de l'`update` du moteur, il ne reste rien
       à faire derrière nous. */
    fermer();
    montrerBilan(gagne, z, recu, faits);
  }

  function montrerBilan(gagne, z, recu, faits) {
    faits = faits || { menace: 0 };
    /* `ouvrir()` sur une clé DÉJÀ ouverte ne fait que remettre l'ancienne
       fenêtre au premier plan : elle garde sa configuration d'origine.
       Un joueur qui laisse traîner son bilan verrait donc le compte
       rendu de la bataille PRÉCÉDENTE. On ferme l'ancienne d'abord. */
    U().fermer('bilan-exp');
    U().ouvrir('bilan-exp', {
      titre: gagne ? 'Territoire pris' : 'La colonne rentre',
      sous: z.nom,
      onglets: [{ id: 'b', nom: 'Bilan', rendu: c => {
        const A = el();
        c.appendChild(A('div', { class: 'note', text: gagne ? z.desc : 'La position tient toujours. Il faudra revenir en nombre.' }));
        if (gagne && z.sortie) {
          c.appendChild(A('div', { class: 'eti-or', text: 'la jauge retombe' }));
          c.appendChild(A('div', { class: 'note',
            text: 'La Menace a perdu ' + z.gainMenace + ' points. Le bourg reprend sa cadence : ' +
                  window.Jeu.palierMenace().nom.toLowerCase() + '.' }));
          c.appendChild(A('div', { class: 'eti-or', text: 'ramassé sur le terrain' }));
          c.appendChild(U().listeRes(recu || {}, { gain: true }));
          c.appendChild(A('div', { class: 'note',
            text: 'Aucun territoire : une sortie ne prend rien, elle rachète du temps.' }));
        } else if (gagne && z.ile) {
          /* UNE ÎLE N'EST PAS UNE ZONE. La menace retombe de ce que
             l'île vaut, personne ne reste en garnison, et le butin ne
             tombe pas dans les magasins : il est en cale et le restera
             jusqu'à ce que le navire touche le quai. Dire autre chose
             ferait attendre au joueur des ressources qui ne viennent
             qu'au retour, et une baisse de jauge qui n'a pas eu lieu. */
          c.appendChild(A('div', { class: 'eti-or', text: 'avantage permanent' }));
          c.appendChild(A('div', { class: 'note', text: libelleBonus(z) }));
          c.appendChild(A('div', { class: 'eti-or', text: 'chargé en cale' }));
          c.appendChild(U().listeRes(recu || {}, { gain: true }));
          c.appendChild(A('div', { class: 'note',
            text: 'La Nuée retombe de ' + faits.menace + ' points. Le butin est à bord : il sera débarqué quand le navire rentrera au bourg.' }));
        } else if (gagne) {
          c.appendChild(A('div', { class: 'eti-or', text: 'avantage permanent' }));
          c.appendChild(A('div', { class: 'note', text: libelleBonus(z) }));
          c.appendChild(A('div', { class: 'eti-or', text: 'butin' }));
          c.appendChild(U().listeRes(recu || {}, { gain: true }));
          c.appendChild(A('div', { class: 'note',
            text: 'La menace retombe de ' + faits.menace + ' points' +
                  (faits.garnison ? ', et un détachement reste en garnison.' : '.') }));
        } else {
          c.appendChild(A('div', { class: 'note mauvais', text: 'Unités perdues, menace en hausse. Formez du monde au terrain d\'entraînement avant de repartir.' }));
        }
        /* LA PORTE DE SORTIE. Une fenêtre de fin qu'on ne peut quitter
           que par la croix du coin est un cul-de-sac : on la referme
           d'un bouton qui dit où l'on retourne. */
        c.appendChild(A('div', { class: 'rangee', style: 'margin-top:14px' },
          A('button', { class: 'b primaire', text: 'Retour au bourg',
            onclick: () => U().fermer('bilan-exp') })));
      } }],
    });
  }

  function libelleBonus(z) {
    const b = z.bonus;
    if (b.metier) return 'Toutes les tâches de ' + window.METIERS[b.metier].nom.toLowerCase() +
      ' gagnent ' + Math.round(b.pct * 100) + ' % de cadence.';
    if (b.global) return 'Toutes les cadences du bourg gagnent ' + Math.round(b.global * 100) + ' %.';
    if (b.butin) return 'Le butin de la descente augmente de ' + Math.round(b.butin * 100) + ' %.';
    if (b.menaceTaux) return 'La menace monte ' + Math.round(-b.menaceTaux * 100) + ' % moins vite.';
    return '';
  }

  function fermer() {
    if (barreRenforts) { barreRenforts.remove(); barreRenforts = null; }
    ouvert = false;
    if (plateau) plateau.classList.remove('vu');
    if (bataille) { bataille.destroy(); bataille = null; }
    zoneEnCours = null;
    colonneEnCours = [];
    E().expedition = null;
  }

  function tick(dt) {
    if (!ouvert || !bataille) return;
    tB += dt;
    /* La bataille peut se TERMINER pendant son propre `update` — l'issue
       arrive par événement et détruit l'instance. On garde donc la
       référence et l'on vérifie qu'elle vaut encore quelque chose avant
       de dessiner, sinon on peint dans le vide. */
    const b = bataille;
    /* METTRE À JOUR ET PEINDRE SONT DEUX CHOSES.

       Elles partageaient un seul `try`, et l'erreur finissait dans un
       `console.warn` sans pile. Deux ennuis : une exception au calcul
       emportait le dessin de l'image, et une exception au dessin laissait
       une image à moitié peinte — le décor et les chemins, puis plus rien
       — sans que RIEN ne le dise, soixante fois par seconde.

       On les sépare donc, et l'on garde la pile de la PREMIÈRE erreur de
       chaque sorte : répéter le même message soixante fois par seconde ne
       renseigne personne, mais le perdre non plus. */
    try {
      b.update(dt);
    } catch (e) { signalerPanne('calcul', e); }
    if (bataille === b) {
      try { b.render(); } catch (e) { signalerPanne('dessin', e); }
    }
    if (!bataille) return;
    if (E().expedition) {
      const c = bataille.getControl ? bataille.getControl() : null;
      if (c) E().expedition.prog = Math.min(1, (c.cats || 0) / Math.max(1, (c.cats || 0) + (c.birds || 0)));
    }
    /* MAJPIED VIDAIT ET RECONSTRUISAIT SON PIED SOIXANTE FOIS PAR
       SECONDE — un rythme que rien ne justifie pour trois chiffres de
       contrôle. `majCotes()` était déjà limité à 0,45 s ; `majPied()`
       ne l'était pas, et tournait donc en pure perte à chaque image de
       la bataille pendant qu'un plateau chargé lui dispute déjà le
       processeur. On l'aligne sur le même rythme. */
    tCotes += dt;
    if (tCotes >= 0.45) { tCotes = 0; majPied(); majCotes(); }
  }

  function majTete() {
    const A = el();
    titre.textContent = zoneEnCours ? zoneEnCours.nom : 'Expédition';
    sous.textContent = zoneEnCours ? 'difficulté ' + zoneEnCours.diff + ' · ' + zoneEnCours.noeuds + ' positions' : '';
    U().vide(boutons);
    /* Le libellé initial doit dire ce qui EST, pas ce qui pourrait être :
       le joueur commande par défaut, le bouton doit donc s'afficher tel
       quel dès la première image, pas seulement après un clic. */
    boutons.appendChild(A('button', { class: 'b' + (auto ? ' primaire' : ''),
      text: auto ? 'IA aux commandes' : 'Commandes manuelles',
      onclick: () => {
        auto = !auto;
        if (bataille) bataille.setAutoPilot(auto);
        /* On REBÂTIT la tête au lieu de retoucher ce seul bouton : la
           retraite dépend elle aussi de qui commande, et elle doit
           apparaître ou disparaître dans le même geste. */
        majTete();
      } }));
    for (const r of [0.25, 0.5, 1]) {
      boutons.appendChild(A('button', { class: 'b mini', text: Math.round(r * 100) + ' %',
        title: 'Proportion de garnison envoyée à chaque ordre',
        onclick: () => { if (bataille) bataille.setSendRatio(r); } }));
    }
    /* L'IA NE BAT JAMAIS EN RETRAITE. Quand le pilote automatique tient
       la barre, il mène la bataille à son terme, quoi qu'il arrive : le
       bouton n'a donc pas à exister. On abandonne quand on commande, pas
       quand on regarde. */
    if (!auto) boutons.appendChild(A('button', { class: 'b danger', text: 'Battre en retraite',
      onclick: () => { if (confirm('Abandonner la bataille ?')) terminer(false); } }));
  }

  function majPied() {
    if (!pied || !bataille) return;
    const c = bataille.getControl ? bataille.getControl() : null;
    U().vide(pied);
    if (c) {
      pied.appendChild(el()('span', { class: 'eti', text: 'contrôle' }));
      pied.appendChild(el()('span', { class: 'puce gain', text: 'Bourg ' + (c.cats || 0) }));
      pied.appendChild(el()('span', { class: 'puce', text: 'Nuée ' + (c.birds || 0) }));
    }
    pied.appendChild(el()('span', { class: 'eti', style: 'margin-left:auto',
      text: 'clic sur une position, puis sur la cible' }));
  }

  function majCotes() {
    if (!gauche || !droite || !ouvert || !zoneEnCours) return;
    const A = el();
    U().vide(gauche);
    gauche.appendChild(A('div', { class:'cote-titre', text:'Colonne engagée' }));
    for (const x of colonneEnCours) {
      const s = window.Armee ? window.Armee.stats(x.type) : null;
      const p = window.Armee ? window.Armee.pouvoirActif(x.type) : null;
      const famille = window.Armee ? window.Armee.famille(x.type) : 'melee';
      const tierArme = window.Armee ? window.Armee.tierEquipement(famille, 'arme') : 0;
      const tierArmure = window.Armee ? window.Armee.tierEquipement(famille, 'armure') : 0;
      const illustration = window.Img && window.Img.unite ? window.Img.unite(x.type) : null;
      gauche.appendChild(A('div', { class:'plateau-membre' },
        A('div', { class:'rangee' },
          illustration
            ? A('div', { class:'plateau-portrait unite-portrait' },
                window.Img.vignette(illustration, 52, window.Armee ? window.Armee.nom(x.type) : x.type, 'vig-unite'),
                A('span', { class:'unite-quantite', text:String(x.n) }))
            : A('div', { class:'plateau-portrait', text:String(x.n) }),
          A('div', { style:'min-width:0' },
            A('div', { class:'tt', text:window.Armee ? window.Armee.nom(x.type) : x.type }),
            A('div', { class:'eti', text:p ? p.name : 'sans technique' }))),
        s ? A('div', { class:'plateau-mini-stats' },
          A('span', { text:Math.round(s.hp) + ' PV' }),
          A('span', { text:Math.round(s.dmg * 10) / 10 + ' dégâts' }),
          A('span', { text:Math.round(s.armure || 0) + ' armure' }),
          A('span', { text:s.range > 0 ? Math.round(s.range) + ' portée' : 'mêlée' })) : null,
        tierArme || tierArmure ? A('div', { class:'plateau-equipement' },
          tierArme ? A('div', { class:'plateau-equipement-piece', title:'Arme équipée · palier ' + tierArme },
            A('img', { src:window.Armee.imageEquipement(famille, 'arme', tierArme), alt:'Arme équipée' }),
            A('span', { text:'T' + tierArme })) : null,
          tierArmure ? A('div', { class:'plateau-equipement-piece', title:'Armure équipée · palier ' + tierArmure },
            A('img', { src:window.Armee.imageEquipement(famille, 'armure', tierArmure), alt:'Armure équipée' }),
            A('span', { text:'T' + tierArmure })) : null) :
          A('div', { class:'eti faible', text:'aucun équipement forgé' })));
    }
    U().vide(droite);
    droite.appendChild(A('div', { class:'cote-titre', text:zoneEnCours.sortie ? 'Repousser la Menace' : 'Objectif territorial' }));
    droite.appendChild(A('div', { class:'plateau-membre choisi' },
      A('div', { class:'tt', text:zoneEnCours.nom }),
      A('div', { class:'note', text:zoneEnCours.desc }),
      zoneEnCours.biome ? A('div', { class:'appel biome-' + zoneEnCours.biome, style:'margin-top:10px' },
        A('div', { class:'eti-or', text:zoneEnCours.biome.toUpperCase() }),
        A('div', { class:'note', text:zoneEnCours.effetBiome || '' })) : null,
      A('div', { class:'plateau-mini-stats' },
        A('span', { text:'difficulté ' + zoneEnCours.diff }),
        A('span', { text:zoneEnCours.noeuds + ' positions' }),
        A('span', { text:colonneEnCours.reduce((n,x) => n+x.n,0) + ' soldats' }),
        A('span', { text:'Menace ' + Math.round(E().menace) }))));
    const c = bataille && bataille.getControl ? bataille.getControl() : null;
    if (c) {
      const den = Math.max(1, (c.cats || 0) + (c.birds || 0));
      droite.appendChild(A('div', { class:'cote-titre', style:'margin-top:16px', text:'Contrôle du terrain' }));
      droite.appendChild(U().barre((c.cats || 0) / den, 'grande vert', 'Bourg ' + (c.cats || 0), 'Nuée ' + (c.birds || 0)));
    }
    droite.appendChild(A('div', { class:'cote-titre', style:'margin-top:16px', text:'Ordres' }));
    droite.appendChild(A('div', { class:'note', text:'Sélectionnez une position alliée, puis sa cible. Les boutons du haut règlent la part de garnison envoyée. L’IA peut reprendre les commandes à tout moment.' }));
    if (zoneEnCours.sortie) droite.appendChild(A('div', { class:'cadre actif', style:'margin-top:12px' },
      A('div', { class:'eti-or', text:'gain si victoire' }),
      A('div', { class:'tt', text:'−' + zoneEnCours.gainMenace + ' Menace' })));
  }

  function brancherPointeur() {
    if (!cvB || cvB.__brancheB) return;
    cvB.__brancheB = true;
    const pos = ev => {
      const r = cvB.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (cvB.width / r.width),
               y: (ev.clientY - r.top) * (cvB.height / r.height) };
    };
    cvB.addEventListener('pointerdown', ev => {
      if (!bataille) return;
      const p = pos(ev);
      bataille.pointerDown(p.x, p.y);
      /* DÉBARQUER ICI. Le moteur vient de sélectionner la position
         cliquée ; si l'on tient un type en réserve, on l'y verse. On ne
         débarque QUE sur une position à nous — ailleurs, le clic garde
         son sens habituel. */
      if (!typeChoisi || !(reserve[typeChoisi] > 0)) return;
      const n = bataille.getSelectedNode ? bataille.getSelectedNode() : null;
      if (!n || n.owner !== 'cats') { U().dire('On ne débarque que sur une position tenue.', 'alerte', 1800); return; }
      const lot = Math.max(1, Math.ceil(reserve[typeChoisi] * partRenfort));
      if (bataille.deploy(n.id, typeChoisi, lot)) {
        reserve[typeChoisi] -= lot;
        if (reserve[typeChoisi] <= 0) { delete reserve[typeChoisi];
          typeChoisi = Object.keys(reserve)[0] || null; }
        majRenforts();
      }
    });
    cvB.addEventListener('pointermove', ev => { if (!bataille) return; const p = pos(ev); bataille.pointerMove(p.x, p.y); });
    cvB.addEventListener('pointerup', ev => { if (!bataille) return; const p = pos(ev); bataille.pointerUp(p.x, p.y); });
  }

  /* ==================================================================
     LA BARRE DE RENFORTS

     En bas de l'écran de bataille : un bouton par type encore en
     chaloupe, avec ce qu'il en reste. On en choisit un, on clique la
     carte, il débarque. C'est tout le jeu manuel — et il n'a pas besoin
     d'être plus compliqué.
     ================================================================== */
  let partRenfort = 0.5;

  function construireRenforts() {
    if (!plateau) return;
    if (!barreRenforts) {
      barreRenforts = el()('div', { id: 'renforts' });
      plateau.appendChild(barreRenforts);
    }
    majRenforts();
  }

  function majRenforts() {
    if (!barreRenforts) return;
    const A = el();
    U().rendreDans(barreRenforts, h => {
      const types = Object.keys(reserve).filter(t => reserve[t] > 0);
      const totalRes = types.reduce((n, t) => n + reserve[t], 0);

      h.appendChild(A('div', { class: 'ren-tt' },
        A('span', { class: 'eti-or', text: 'en chaloupe' }),
        A('span', { class: 'n', text: totalRes ? totalRes + ' unités' : 'plus rien à débarquer' })));

      if (!types.length) {
        h.appendChild(A('div', { class: 'ren-vide',
          text: auto ? 'Tout est engagé. Le capitaine mène la bataille.'
                     : 'Tout est engagé. À vous de jouer avec ce qui est à terre.' }));
      } else {
        const g = A('div', { class: 'ren-liste' });
        for (const t of types) {
          const u = window.GameData.UNIT_TYPES[t];
          const b = A('button', {
            'data-cle': t,
            class: 'ren-u' + (t === typeChoisi ? ' choisi' : ''),
            title: (u ? u.name.cats : t) + '\n' + reserve[t] + ' encore à bord.\n'
                 + 'Choisissez-le, puis cliquez une position que vous tenez.',
            onclick: () => { typeChoisi = t; majRenforts(); },
          });
          const ic = window.Sprites && window.Sprites.getUnitIcon
            ? (() => { try { return window.Sprites.getUnitIcon({ faction:'cats', type:t }, 26); }
                       catch (e) { return null; } })() : null;
          if (ic) b.appendChild(ic);
          b.appendChild(A('span', { class: 'n', text: String(reserve[t]) }));
          g.appendChild(b);
        }
        h.appendChild(g);

        /* combien on verse d'un coup */
        h.appendChild(A('div', { class: 'ren-part' },
          A('span', { class: 'eti', text: 'par vague' }),
          ...[0.25, 0.5, 1].map(r => A('button', {
            class: 'b mini' + (Math.abs(partRenfort - r) < 0.01 ? ' primaire' : ''),
            text: Math.round(r * 100) + ' %',
            onclick: () => { partRenfort = r; majRenforts(); } }))));
      }
    });
  }

  /* =================================================================
     LE PANNEAU DU PORTAIL
     ================================================================= */
  function rendre(c) {
    const A = el();
    const E2 = E();
    c.appendChild(A('div', { class: 'cadre' },
      A('div', { class: 'rangee entre' },
        A('span', { class: 'tt', text: E2.armee.unites + ' unités formées' }),
        A('span', { class: 'eti-or', text: prises().length + ' / ' + ZONES.length + ' territoires' })),
      A('div', { class: 'note', style: 'margin-top:8px',
        text: "Les premières unités se forment à la caserne avec du bois et du poisson. L'entraînement et l'équipement viennent ensuite. Une victoire coûte du monde : la compagnie ne rentre jamais entière." })));

    if (E2.expedition) {
      c.appendChild(A('div', { class: 'cadre actif' },
        A('div', { class: 'tt', text: 'Bataille en cours' }),
        A('div', { class: 'rangee', style: 'margin-top:8px;gap:6px' },
          A('button', { class: 'b primaire', text: 'Rejoindre la bataille', onclick: () => {
            if (!bataille) { reprendre(); return; }
            refs(); ouvert = true; plateau.classList.add('vu'); dimensionner(); majTete(); majCotes(); brancherPointeur();
          } }),
          A('button', { class: 'b danger', text: 'Abandonner', onclick: () => {
            if (confirm('Abandonner cette expédition ? Le navire reprend son équipage, sans butin.')) abandonnerReprise();
          } }))));
    }

    for (const z of ZONES) {
      const pris = estPrise(z.id);
      const dispo = !pris && ZONES.filter(y => !estPrise(y.id)).indexOf(z) === 0;
      const assezU = (window.Armee ? window.Armee.nombreColonne() : E2.armee.unites) >= z.cout.unites;
      const cout = {}; for (const k in z.cout) if (k !== 'unites') cout[k] = z.cout[k];
      c.appendChild(A('div', { class: 'cadre' + (pris ? ' actif' : (dispo ? '' : ' mort')) },
        A('div', { class: 'rangee entre' },
          A('span', { class: 'tt', text: z.nom }),
          A('span', { class: 'eti', text: pris ? 'tenue' : 'difficulté ' + z.diff })),
        A('div', { class: 'note', style: 'margin-top:4px', text: z.desc }),
        A('div', { class: 'note', style: 'margin-top:4px' },
          A('em', { text: libelleBonus(z) })),
        pris ? null : (function () {
          const f = forces(z);
          const ecart = f.bourg / Math.max(1, f.nuee);
          const mot = ecart > 1.5 ? 'nette supériorité' : ecart > 1.1 ? 'avantage au bourg'
                    : ecart > 0.85 ? 'combat serré' : ecart > 0.6 ? 'désavantage' : 'suicidaire';
          const bloc = A('div', { style: 'margin-top:8px' });
          bloc.appendChild(U().barre(Math.min(1, ecart / 2), 'grande ' + (ecart > 1.1 ? 'vert' : (ecart > 0.85 ? '' : 'rouge')),
            'la colonne ≈ ' + f.bourg, 'la Nuée ≈ ' + f.nuee));
          bloc.appendChild(A('div', { class: 'rangee entre', style: 'margin-top:4px' },
            A('span', { class: 'eti', text: 'ce que le bourg alignera' }),
            A('span', { class: ecart > 1.1 ? 'eti-or' : 'eti mauvais', text: mot })));
          const compo = window.Armee ? window.Armee.colonne().map(x => x.type) : ['lancier'];
          bloc.appendChild(A('div', { class: 'rangee enroule', style: 'margin-top:8px' },
            A('span', { class: 'eti', text: 'composition' }),
            compo.map(t => A('span', { class: 'puce mini gain', text: window.Armee ? window.Armee.nom(t) : t })),
            !compo.length ? A('span', { class: 'note mauvais', text: 'colonne vide — composez-la à la caserne' }) : null));
          return bloc;
        })(),
        pris ? null : A('div', { class: 'rangee entre', style: 'margin-top:8px;flex-wrap:wrap' },
          A('div', { class: 'rangee', style: 'flex-wrap:wrap' },
            A('span', { class: 'puce' + (assezU ? '' : ' insuffisant'), text: z.cout.unites + ' unités minimum' }),
            U().listeRes(cout, { verifier: true, rien: '' })),
          A('button', { class: 'b primaire', text: 'Lancer la colonne',
            disabled: !dispo || !assezU || !window.Etat.assez(cout) || !!E2.expedition,
            onclick: () => lancer(z.id) }))));
    }
  }

  addEventListener('resize', () => { if (ouvert && bataille) dimensionner(); });

  window.UIExpedition = { rendre, ouvrir: () => { refs(); if (E().expedition) { if (!bataille) reprendre(); else { ouvert = true; plateau.classList.add('vu'); dimensionner(); majTete(); majCotes(); brancherPointeur(); } } },
    fermer, tick, ZONES, bonusMetier, bonusButin, facteurMenace, estPrise, prises,
    lancerSortie, zoneSortie, forces, lancerIle, zoneDeLIle, reprendre, abandonnerReprise };
  window.Expedition = { tick, bonusMetier, bonusButin, facteurMenace, lancerSortie, zoneSortie,
                        forces, pannesVues };

})();
