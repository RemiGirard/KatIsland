/* ============================================================
   GRIFFES & PLUMES — data-world.js (6/6, dernier — dépendances d\x27ordre)
   Villes, expédition, objectifs/succès, prestige,
   MAP_BOSSES(?) ... et RES_USES : une IIFE auto-exécutée qui lit
   PRESQUE TOUTES les autres clés GameData -> doit rester le dernier
   fichier data-*.js chargé (voir index.html).
   ============================================================ */
"use strict";

  // ---------- villes du monde ----------
  GameData.CITIES = [
    { id: 'ronron', name: 'Ronron-les-Bains', emoji: '♨️', x: 0.16, y: 0.62, nodeCount: 14,
      desc: 'Station thermale réputée pour ses siestes de 14 heures.',
      bonus: { res: 'food', pct: 0.06 }, theme: { g1: '#8fbc6f', g2: '#6da054', decor: 'park' } },
    { id: 'plumopolis', name: 'Plumopolis', emoji: '🪶', x: 0.34, y: 0.28, nodeCount: 16,
      desc: 'La grande cité verticale. Interdite aux vertiges.',
      bonus: { res: 'mat2', pct: 0.08 }, theme: { g1: '#9aa8b8', g2: '#7a8898', decor: 'rooftop' } },
    { id: 'croquette', name: 'Croquetteville', emoji: '🍪', x: 0.52, y: 0.55, nodeCount: 15,
      desc: 'Ses rues pavées de croquettes. Personne ne sait qui les pave.',
      bonus: { res: 'food', pct: 0.10 }, theme: { g1: '#d8b878', g2: '#b89858', decor: 'sand' } },
    { id: 'becsurciel', name: 'Bec-sur-Ciel', emoji: '☁️', x: 0.68, y: 0.22, nodeCount: 14,
      desc: 'Perchée si haut que les nuages demandent la permission.',
      bonus: { res: 'mat1', pct: 0.08 }, theme: { g1: '#a8c4d8', g2: '#88a8c0', decor: 'sky' } },
    { id: 'griffegrad', name: 'Griffegrad', emoji: '🏰', x: 0.84, y: 0.45, nodeCount: 18,
      desc: 'Forteresse légendaire. Le paillasson dit "DÉGAGE".',
      bonus: { power: 0.04 }, theme: { g1: '#98988a', g2: '#78786a', decor: 'fortress' } },
    { id: 'portpoisson', name: 'Port-au-Poisson', emoji: '⚓', x: 0.10, y: 0.32, nodeCount: 15,
      desc: 'Ça sent le poisson à 3 kilomètres. C’est un argument de vente.',
      bonus: { res: 'food', pct: 0.12 }, theme: { g1: '#7fb890', g2: '#5a9878', decor: 'harbor' } },
    { id: 'pelote', name: 'La Grande Pelote', emoji: '🧶', x: 0.42, y: 0.78, nodeCount: 14,
      desc: 'Une ville construite autour d’une pelote géante. Personne n’ose tirer le fil.',
      bonus: { res: 'mat1', pct: 0.12 }, theme: { g1: '#c89ab8', g2: '#a87a98', decor: 'meadow' } },
    { id: 'cartonnia', name: 'Cartonnia', emoji: '📦', x: 0.62, y: 0.72, nodeCount: 16,
      desc: 'Gratte-ciels en carton. Étonnamment stables. Sauf sous la pluie.',
      bonus: { res: 'mat3', pct: 0.10 }, theme: { g1: '#c0a880', g2: '#a08860', decor: 'junkyard' } },
    { id: 'nidroyal', name: 'Nid-Royal', emoji: '🌳', x: 0.78, y: 0.80, nodeCount: 15,
      desc: 'La canopée dorée. Chaque branche est une avenue.',
      bonus: { res: 'milk', pct: 0.10 }, theme: { g1: '#78a858', g2: '#588838', decor: 'forest' } },
    { id: 'moustache', name: 'Moustache City', emoji: '🎩', x: 0.90, y: 0.15, nodeCount: 20,
      desc: 'La mégalopole. Tout le monde veut sa moustache sur le drapeau.',
      bonus: { power: 0.06 }, theme: { g1: '#8898a8', g2: '#687888', decor: 'city' } },
    // §D11ter : 6 villes de plus — le tour du monde passe à 16 chapitres (scaling allongé).
    { id: 'sardinople', name: 'Sardinople', emoji: '🐟', x: 0.24, y: 0.48, nodeCount: 16,
      desc: 'Capitale mondiale de la sardine. L’odeur fait partie du patrimoine.',
      bonus: { res: 'milk', pct: 0.12 }, theme: { g1: '#7fa8c8', g2: '#5f88a8', decor: 'fishmarket' } },
    { id: 'volauvent', name: 'Vol-au-Vent', emoji: '🌬️', x: 0.55, y: 0.10, nodeCount: 16,
      desc: 'Toujours en courant d’air. Les chapeaux y sont interdits par arrêté.',
      bonus: { res: 'mat2', pct: 0.12 }, theme: { g1: '#b8c8d8', g2: '#93a5b5', decor: 'windmill' } },
    { id: 'picorama', name: 'Picorama', emoji: '🌻', x: 0.30, y: 0.90, nodeCount: 17,
      desc: 'Des champs à perte de bec. Même le tourisme picore.',
      bonus: { res: 'essence', pct: 0.10 }, theme: { g1: '#c8b858', g2: '#a39336', decor: 'fields' } },
    { id: 'ferraille', name: 'Ferraille-sur-Rouille', emoji: '⚙️', x: 0.72, y: 0.58, nodeCount: 17,
      desc: 'Tout y grince, mais tout y tourne. Huile interdite : tradition.',
      bonus: { res: 'parts', pct: 0.10 }, theme: { g1: '#a89078', g2: '#887058', decor: 'gears' } },
    { id: 'soyeuse', name: 'Soyeuse-les-Coussins', emoji: '🛋️', x: 0.14, y: 0.82, nodeCount: 18,
      desc: 'On y marche sur du velours. Littéralement. Chuchotez.',
      bonus: { res: 'fabric', pct: 0.10 }, theme: { g1: '#c8a0b8', g2: '#a37e96', decor: 'cushions' } },
    { id: 'perchoir', name: 'Trône-du-Perchoir', emoji: '👑', x: 0.95, y: 0.66, nodeCount: 22,
      desc: 'Le sommet du monde. Le paillasson dit « prosternez-vous ».',
      bonus: { power: 0.08 }, theme: { g1: '#b09858', g2: '#8f7a3f', decor: 'throne' } },
  ];
  GameData.cityBonusLabel = function (city, faction) {
    if (city.bonus.power) return '+' + Math.round(city.bonus.power * 100) + '% puissance au combat';
    const r = GameData.RESOURCES[city.bonus.res][faction];
    return '+' + Math.round(city.bonus.pct * 100) + '% de ' + r.name;
  };

  // ============================================================
  // QUELLE LIGNE DE FORGE ARME QUELLE CATÉGORIE D'UNITÉ.
  // Le tier de la ligne s'applique à TOUTE l'armée — il n'y a plus d'entrepôt
  // d'exemplaires ni de garnison à équiper à la main (le Front a été retiré) :
  // ces deux tables servent au rendu des combattants et à l'écran de la Forge.
  // ============================================================
  GameData.LINE_FOR_CAT = {
    melee: { w: 'weapon', a: 'armor' },
    tir: { w: 'ranged', a: 'vest' },
    magie: { w: 'staff', a: 'robe' },
    explosif: { w: 'ordnance', a: 'suit' },
    garde: { w: 'blades', a: 'shields' }, // §D17-2 : la garde a SES deux lignes
  };
  // §D17-2 : 10 lignes — state.js attend les clés d'état bladeTier/shieldTier
  GameData.LINE_ARR = {
    weapon: GameData.WEAPONS, ranged: GameData.RANGED, staff: GameData.STAFFS, ordnance: GameData.ORDNANCE,
    blades: GameData.BLADES,
    armor: GameData.ARMORS, robe: GameData.ROBES, vest: GameData.VESTS, suit: GameData.SUITS,
    shields: GameData.SHIELDS,
  };
  // ---------- étapes (mode Expédition) ----------
  GameData.EXPEDITION_TREE_DEPTH = 10;

  function expRnd(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  GameData.expeditionDepth = stage => (stage - 1) % GameData.EXPEDITION_TREE_DEPTH;
  GameData.expeditionZoneIndex = stage => Math.floor((stage - 1) / GameData.EXPEDITION_TREE_DEPTH) % GameData.CITIES.length;
  GameData.stageCity = stage => GameData.CITIES[GameData.expeditionZoneIndex(stage)];
  GameData.isExpeditionBoss = stage => GameData.expeditionDepth(stage) === GameData.EXPEDITION_TREE_DEPTH - 1;
  GameData.isZoneTransition = (oldStage, newStage) =>
    GameData.expeditionZoneIndex(oldStage) !== GameData.expeditionZoneIndex(newStage);

  // §D11 : le choix = un BONUS de récompense (jamais une pénalité), même difficulté.
  // On BOOSTE la ressource focalisée ; les autres restent au plein taux de base.
  GameData.EXPEDITION_CHOICES = [
    { id: 'supplies', label: 'Butin de ravitaillement', icon: '🍱', desc: 'Un gros bonus de nourriture.',
      diffMult: 1.0, focus: { food: 2.6 } },
    { id: 'materials', label: 'Butin de matériaux', icon: '🧶', desc: 'Un gros bonus de matériaux.',
      diffMult: 1.0, focus: { mat1: 2.6, mat2: 2.5, mat3: 2.4 } },
    { id: 'glory', label: 'Butin de gloire', icon: '🎖️', desc: 'Un gros bonus de médailles.',
      diffMult: 1.0, focus: { medals: 3 } },
  ];

  GameData.expeditionChoices = function (stage) {
    const depth = GameData.expeditionDepth(stage);
    const rnd = expRnd(stage * 7919 + depth * 31 + 7);
    if (GameData.isExpeditionBoss(stage)) {
      const rw = GameData.stageRewards(stage);
      return [{
        id: 'boss', label: 'Assaut final', icon: '👑',
        desc: 'Le QG ennemi de la région. Victoire = nouvelle zone !',
        diffMult: 1.25, rewards: rw, isBoss: true,
      }];
    }
    const pool = GameData.EXPEDITION_CHOICES.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    const count = depth === 0 ? 2 : 3;
    return pool.slice(0, count).map(c => ({
      id: c.id, label: c.label, icon: c.icon, desc: c.desc,
      diffMult: c.diffMult * (1 + depth * 0.04),
      rewards: GameData.choiceRewards(stage, c),
    }));
  };

  GameData.choiceRewards = function (stage, choice) {
    const base = GameData.stageRewards(stage);
    const rw = {};
    // §D11 : focus >= 1 = boost ; jamais de nerf sous le plein taux de base.
    for (const k in base) rw[k] = Math.max(1, Math.round(base[k] * Math.max(1, (choice.focus || {})[k] || 1)));
    return rw;
  };

  // §D11 : défi constant — la difficulté (PV/dégâts) monte plus vite pour suivre
  // la courbe de puissance du joueur (évolutions + tiers + taille d'armée).
  // MAJ §4 : 1.12 → 1.13 — l'IA a MOINS d'unités au départ (cap ci-dessous,
  // fini les 10 vs 100) mais des unités PLUS FORTES + des renforts par vagues.
  // LA RAMPE INTRA-VILLE, adoucie sur les trois premiers stages : un lancier
  // ennemi multipliait ses PV par 9 et ses dégâts par 16 entre le stage 1 et le
  // boss de la « ville tutoriel ». La pente reste (×1,13 par stage), mais elle
  // ne démarre qu'au stage 3 — les deux premiers combats apprennent les gestes,
  // ils ne punissent pas encore.
  // CONTINUITÉ : la pente douce des stages 1-3 se raccorde à la pente pleine —
  // sans ce raccord, le stage 4 sautait de 26 % d'un coup et le « sortir du
  // tutoriel » se vivait comme un mur, exactement ce qu'on corrige.
  GameData.stageDifficulty = stage => {
    const st = Math.max(1, stage);
    const exp = st <= 3 ? (st - 1) * 0.55 : 1.1 + (st - 3);
    return Math.pow(1.13, exp);
  };
  // MAJ §4 : croissance des garnisons de départ adoucie et PLAFONNÉE (×2 max) —
  // la masse ennemie arrive désormais en RENFORTS échelonnés (cfg.enemyReinforce).
  // LES GARNISONS DES PREMIERS STAGES SONT ALLÉGÉES.
  //
  // Le multiplicateur ne descendait jamais sous ×1 : la ville 1, censée être un
  // tutoriel, alignait ~21-24 défenseurs au QG et 3 à 10 gardiens PAR NŒUD
  // (doublés par la symétrie) contre 14 unités de départ. Et les GARDIENS
  // NEUTRES combattent à stats brutes, hors multiplicateur de difficulté :
  // baisser `stageDifficulty` ne les touchait pas. Le seul levier honnête est
  // le NOMBRE — c'est lui qu'on abaisse.
  //
  //   stage 1 : ×0,45   stage 2 : ×0,62   stage 3 : ×0,79   stage 4+ : ≥ ×0,96
  GameData.stageGarrisonMult = stage => {
    const st = Math.max(1, stage);
    if (st < 4) return 0.45 + (st - 1) * 0.17;
    return Math.min(2, 0.96 + (st - 4) * 0.05);
  };
  GameData.stageEnemyLook = stage => ({
    weapon: Math.min(39, Math.floor((stage - 1) * 0.8)),
    ranged: Math.min(39, Math.floor((stage - 1) * 0.8)),
    staff: Math.min(39, Math.floor((stage - 1) * 0.8)),
    ordnance: Math.min(39, Math.floor((stage - 1) * 0.8)),
    blade: Math.min(39, Math.floor((stage - 1) * 0.8)),   // §D17-2 : lames ennemies
    armor: Math.min(39, Math.floor((stage - 1) / 4)),
    robe: Math.min(39, Math.floor((stage - 1) / 4)),
    vest: Math.min(39, Math.floor((stage - 1) / 4)),
    suit: Math.min(39, Math.floor((stage - 1) / 4)),
    shield: Math.min(39, Math.floor((stage - 1) / 4)),    // §D17-2 : boucliers ennemis
    evo: Math.min(30, Math.floor((stage - 1) * 1.35)),
  });
  GameData.stageNodeCount = stage => Math.min(14, 5 + Math.floor((stage - 1) / 2));
  // §D11 : récompenses GÉNÉREUSES — plus de bridage ÷2 en early ; la bataille
  // redevient une vraie source de ressources du début à la fin.
  // MAJ majeure §2 : récompenses de bataille FORTEMENT augmentées (~×3 food/matériaux,
  // ~×2 médailles) — gagner doit rembourser les unités sacrifiées ET leur temps de
  // production, sinon la bataille bloque la progression.
  GameData.stageRewards = function (stage) {
    const depth = GameData.expeditionDepth(stage);
    const depthBonus = 1 + depth * 0.15;
    const r = {
      medals: Math.max(6, Math.round((12 + stage * 2.5) * depthBonus)),
      food: Math.max(1, Math.round(950 * Math.pow(1.34, stage - 1) * depthBonus)),
    };
    if (stage >= 3) r.mat1 = Math.max(1, Math.round(80 * Math.pow(1.27, stage - 3) * depthBonus));
    if (stage >= 6) r.mat2 = Math.max(1, Math.round(50 * Math.pow(1.25, stage - 6) * depthBonus));
    if (stage >= 10) r.mat3 = Math.max(1, Math.round(32 * Math.pow(1.23, stage - 10) * depthBonus));
    return r;
  };
  GameData.STAGE_BONUS_PER_WIN = 0.02;  // % de puissance faction dans la ville liée
  GameData.STAGE_BONUS_CAP = 0.30;

  // §D13-E : LE multiplicateur d'élite — constante UNIQUE, partagée par les
  // récompenses (ici) ET les stats des garnisons d'élite (state/battle la lisent).
  GameData.EXPEDITION_ELITE_MULT = 1.6;
  // §15 : aperçu des récompenses d'un nœud de l'arbre d'expédition.
  // fight = choiceRewards du choiceId, elite = ×ELITE_MULT, boss = stageRewards pleins.
  GameData.expNodeRewards = function (stage, node) {
    if (node.type === 'boss') return GameData.stageRewards(stage);
    const choice = GameData.EXPEDITION_CHOICES.find(c => c.id === node.choiceId)
      || GameData.EXPEDITION_CHOICES[0];
    const rw = GameData.choiceRewards(stage, choice);
    if (node.type === 'elite') for (const k in rw) rw[k] = Math.round(rw[k] * GameData.EXPEDITION_ELITE_MULT);
    return rw;
  };

  // ---------- ARBRE D'EXPÉDITION (type Slay the Spire, §15) ----------
  // Retourne un tableau de 10 rangées ; chaque rangée = tableau de nœuds
  // {id, row, col, type:'fight'|'elite'|'boss', choiceId, next:[ids]}.
  // UNIQUEMENT des batailles (plus d'events). Déterministe pour
  // (cityIndex, lap). Rangée 9 = 1 seul boss.
  // §D11 : arbre LINÉAIRE — 1 nœud par rangée, points reliés en chemin (le « choix »
  // est désormais un choix de RÉCOMPENSE au lancement, plus un embranchement de carte).
  // Déterministe pour (cityIndex, lap). Rangée finale = boss de région.
  GameData.expTree = function (cityIndex, lap) {
    const rnd = expRnd((cityIndex + 1) * 6971 + (lap + 1) * 433 + 17);
    const ROWS = GameData.EXPEDITION_TREE_DEPTH;
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      const isBossRow = r === ROWS - 1;
      let type = 'fight';
      if (isBossRow) type = 'boss';
      else if (r >= 3 && rnd() < 0.22) type = 'elite';
      const choiceId = type === 'boss' ? 'boss'
        : GameData.EXPEDITION_CHOICES[Math.floor(rnd() * GameData.EXPEDITION_CHOICES.length)].id;
      rows.push([{ id: 'n' + r + '_0', row: r, col: 1.5, type, choiceId, next: [] }]);
    }
    // au moins 1 élite par ville
    if (!rows.some(row => row[0].type === 'elite')) {
      const r = 3 + Math.floor(rnd() * Math.max(1, ROWS - 4)); // 3..ROWS-2
      if (rows[r][0].type === 'fight') rows[r][0].type = 'elite';
    }
    // chaînage linéaire : chaque nœud pointe vers le suivant
    for (let r = 0; r < ROWS - 1; r++) rows[r][0].next.push(rows[r + 1][0].id);
    return rows;
  };

  // statut d'une ville sur la carte globale de l'Expédition
  // -> { state: 'locked'|'current'|'done', depth (0..TREE_DEPTH), laps (fois où la ville a été bouclée) }
  GameData.cityStatus = function (stage, cityIndex) {
    const N = GameData.CITIES.length;
    const visitIdx = Math.floor((stage - 1) / GameData.EXPEDITION_TREE_DEPTH);
    const zoneIndex = visitIdx % N;
    const lap = Math.floor(visitIdx / N);
    if (cityIndex === zoneIndex) {
      return { state: 'current', depth: GameData.expeditionDepth(stage), laps: lap };
    }
    const laps = cityIndex < zoneIndex ? lap + 1 : lap;
    return { state: laps > 0 ? 'done' : 'locked', depth: laps > 0 ? GameData.EXPEDITION_TREE_DEPTH : 0, laps };
  };

  // ---------- noms des alliés simulés ----------
  GameData.ALLY_NAMES = {
    cats: ['Griffou_du_93', 'MoustacheMax', 'RonronKing', 'ChatBotté', 'MinouDu77',
      'PattesDeVelours', 'SirMiaou', 'CroquetteLord', 'FélixLeFélin', 'MmeMoustaches',
      'ChatPitre', 'GriffesDacier', 'PoiluDu13', 'CommandantRonron', 'NinjaDuCanapé'],
    birds: ['PiafMaster', 'PlumeFatale', 'BecDeFer', 'CuiCuiSuprême', 'AigleRoyal_31',
      'DameColibri', 'PioupiouWar', 'LordPigeon', 'HirondelleX', 'PlumeDouce',
      'CorbeauMalin', 'MésangeTurbo', 'PicVert_du_69', 'GénéralPiou', 'FauconNocturne'],
  };

  // ---------- objectifs (séquentiels) ----------
  // check(s) -> {cur, max} ; complété si cur >= max
  // `guide` reste optionnel : l'objectif décrit aussi le prochain geste sans
  // dupliquer toute la progression dans le Conseiller.
  const G = (desc, icon, reward, check, guide) => ({ desc, icon, reward, check, guide: guide || null });
  // « ce bâtiment est-il posé ? » — la même source que le village et le
  // conseiller (s.villageBati), pour qu'aucun des trois ne puisse mentir.
  const bati = (s, cle) => ({ cur: ((s.villageBati || []).indexOf(cle) >= 0) ? 1 : 0, max: 1 });
  GameData.GOALS = [
    // ---- L'OUVERTURE : on bâtit le village, une marche à la fois ----
    // Le Général finance le QG ; le panneau d'objectif doit donc annoncer CE
    // geste avant de réclamer un bâtiment encore impayable. Trois clics font
    // exactement les 9 nourritures du plan, sans répétition artificielle.
    G('Donner 3 encouragements', '👋', { food: 40 }, s => ({ cur: s.lifetime.clicks, max: 3 }), { kind: 'pet' }),
    G('Poser le Quartier Général', '🏰', { food: 60 }, s => bati(s, 'qg'), { kind: 'building', key: 'qg' }),
    G('Bâtir l’atelier de nourriture', '🌱', { food: 80 }, s => bati(s, 'production'), { kind: 'building', key: 'production' }),
    G('Acheter votre 1er générateur', '🥣', { food: 220 }, s => ({ cur: totalGens(s), max: 1 }), { kind: 'production', res: 'food' }),
    // Avant la Mine, aucun système ne fournit encore de matériau 1. La prime
    // finance donc les deux stations nécessaires à la première naissance.
    G('Bâtir la Nurserie', '🍼', { food: 700, mat1: 35 }, s => bati(s, 'nursery'), { kind: 'building', key: 'nursery' }),
    G('Faire éclore votre 1re unité', '🐣', { food: 500 }, s => ({ cur: s.lifetime.units, max: 1 }), { kind: 'page', tab: 'nursery', label: 'Ouvrir la Nurserie' }),
    G('Bâtir la Mine — vos combattants réclament du métal', '⛏️', { food: 500, mat1: 20 }, s => bati(s, 'mine'), { kind: 'building', key: 'mine' }),
    G('Cumuler 5 niveaux de générateurs', '🏗️', { food: 400 }, s => ({ cur: totalGens(s), max: 5 }), { kind: 'production', res: 'food' }),
    G('Bâtir la Caserne', '⚔️', { food: 700, mat1: 30 }, s => bati(s, 'militaire'), { kind: 'building', key: 'militaire' }),
    G('Avoir 5 unités en stock', '⚔️', { food: 300, mat1: 10 }, s => ({ cur: armyTotal(s), max: 5 }), { kind: 'page', tab: 'nursery', label: 'Voir la Nurserie' }),
    G('Choisir votre première unité pour l’Expédition', '🧩', { food: 250 }, s => ({ cur: compUnits(s), max: 1 }), { kind: 'page', tab: 'expedition', label: 'Composer l’armée' }),
    G('Gagner l’étape 1 de l’Expédition', '🚩', { medals: 3, food: 400 }, s => ({ cur: s.progression.bestStage, max: 1 }), { kind: 'page', tab: 'expedition', label: 'Partir en Expédition' }),
    G('Forger votre 1re lance', '🔨', { food: 500 }, s => ({ cur: s.weaponTier, max: 1 }),
      { kind: 'page', tab: 'forge', label: 'Ouvrir la Forge', building: 'forge', production: 'mat1',
        work: { kind: 'forge', line: 'weapon', label: 'La première lance' } }),
    // MAJ §5 : haut fait guide — la Forge tourne toute seule, allez voir une arme grimper
    G('Améliorer une arme au rang 2 à la Forge', '⚒️', { food: 600 }, s => ({ cur: Math.min(2, Math.max(s.weaponTier || 0, s.bladeTier || 0, s.rangedTier || 0, s.staffTier || 0, s.ordnanceTier || 0)), max: 2 }),
      { kind: 'page', tab: 'forge', label: 'Ouvrir la Forge',
        work: { kind: 'forge', lines: ['weapon', 'blades', 'ranged', 'staff', 'ordnance'], label: 'L’amélioration choisie' } }),
    // La première naissance exige déjà un berceau et une couveuse : réclamer
    // ensuite « construire un pondoir » se validait tout seul. On apprend à la
    // place le vrai geste suivant du volet, améliorer un atelier existant.
    G('Améliorer une couveuse au niveau 2', '🐣', { food: 700, mat1: 50 },
      s => ({ cur: hatchHighestWorkshopLevel(s), max: 2 }),
      { kind: 'page', tab: 'nursery', label: 'Ouvrir la Nurserie' }),
    G('Faire éclore 25 juvéniles', '🐾', { food: 400 }, s => ({ cur: (s.lifetime.hatched || 0), max: 25 }),
      { kind: 'page', tab: 'nursery', label: 'Voir la production' }),
    // MAJ §5 : le Jardin niv 2 débloque l'affectation des ouvriers — ce haut fait guide
    G('Atteindre la maîtrise 2 des ateliers (débloque les ouvriers)', '🏭', { food: 400 }, s => ({ cur: (s.buildings && s.buildings.production) || 1, max: 2 })),
    G('Affecter 5 ouvriers à un poste', '👷', { food: 500 }, s => ({ cur: workTotal(s), max: 5 })),
    G('Cumuler 10 niveaux de générateurs', '🏘️', { food: 800 }, s => ({ cur: totalGens(s), max: 10 })),
    // Les postes achetables ont été remplacés par une file continue dont
    // les créneaux viennent du niveau du Dojo. On conserve l'index de l'objectif
    // et on apprend le geste vivant : lancer une piste.
    G('Lancer un entraînement avec une recrue', '🏗️', { food: 700 }, s => ({ cur: (s.dojoUp && s.dojoUp.actives && s.dojoUp.actives.length) || 0, max: 1 }),
      { kind: 'page', tab: 'training', label: 'Ouvrir le Dojo', building: 'dojo', unit: 'base' }),
    G('Obtenir 1 niveau d’entraînement', '🥋', { food: 600 }, s => ({ cur: trainTotal(s), max: 1 }),
      { kind: 'page', tab: 'training', label: 'Voir l’entraînement', unit: 'base' }),
    G('Assigner une activité au Dojo', '🎪', { food: 500 }, s => ({ cur: dojoAssigned(s), max: 1 })),
    // Les anciennes marmites achetables ont été retirées au profit de la
    // fabrication en boucle. L'objectif reste À CET INDEX pour les sauvegardes,
    // mais demande désormais le vrai geste vivant à ce moment de la partie :
    // poser l'Alchimie, prochain bâtiment de la chaîne.
    G('Bâtir l’Alchimie', '⚗️', { food: 900 }, s => bati(s, 'alchimie'),
      { kind: 'building', key: 'alchimie' }),
    G('Gagner l’étape 3', '🚩', { medals: 5, mat1: 25 }, s => ({ cur: s.progression.bestStage, max: 3 })),
    // (LE TROC A ÉTÉ RETIRÉ) Cet objectif promettait d'ouvrir un comptoir qui
    // n'existe plus. Il est REMPLACÉ et non supprimé : les objectifs sont
    // séquentiels et la sauvegarde retient un index — en retirer un décalerait
    // tous les suivants, et un joueur avancé changerait d'objectif sans
    // comprendre. Le QG 3 reste un vrai palier, il ouvre juste autre chose.
    G('Monter le QG au niveau 3', '🏰', { food: 1200 }, s => ({ cur: (s.buildings && s.buildings.qg) || 1, max: 3 })),
    G('Déployer des unités sur la carte du monde', '🌍', { medals: 4 }, s => ({ cur: s.lifetime.deposits, max: 1 })),
    G('Forger la lance de rang 5', '🔱', { mat2: 15 }, s => ({ cur: s.weaponTier, max: 5 })),
    G('Recruter 25 unités au total', '🎖️', { food: 2000 }, s => ({ cur: s.lifetime.units, max: 25 })),
    G('Craft une armure', '🛡️', { food: 1500 }, s => ({ cur: s.armorTier, max: 1 })),
    G('Préparer une potion de bataille', '🧪', { food: 1200 }, s => ({ cur: s.lifetime.potions || 0, max: 1 })),
    G('Vaincre 50 ennemis', '💥', { medals: 6 }, s => ({ cur: s.lifetime.kills, max: 50 })),
    G('Gagner l’étape 5', '🚩', { medals: 8, mat2: 20 }, s => ({ cur: s.progression.bestStage, max: 5 })),
    G('Première évolution d’unité', '🌟', { food: 3000 }, s => ({ cur: evoTotal(s), max: 1 })),
    G('Cumuler 25 niveaux de générateurs', '🏙️', { food: 5000, mat1: 50 }, s => ({ cur: totalGens(s), max: 25 })),
    G('Forger la lance de rang 10', '⚜️', { medals: 10 }, s => ({ cur: s.weaponTier, max: 10 })),
    G('Capturer 20 points de contrôle', '🏳️', { medals: 8 }, s => ({ cur: s.lifetime.captures, max: 20 })),
    G('Gagner l’étape 10', '🏆', { medals: 15, mat3: 15 }, s => ({ cur: s.progression.bestStage, max: 10 })),
    G('10 niveaux d’entraînement', '🥋', { mat2: 40 }, s => ({ cur: trainTotal(s), max: 10 })),
    G('1 amélioration de catégorie au Dojo', '📚', { food: 4000 }, s => ({ cur: catTrainTotal(s), max: 1 })),
    G('Préparer 10 potions de bataille', '⚗️', { medals: 10 }, s => ({ cur: s.lifetime.potions || 0, max: 10 })),
    G('Recruter 100 unités au total', '🎖️', { food: 15000 }, s => ({ cur: s.lifetime.units, max: 100 })),
    G('Forger la lance de rang 15', '🌠', { medals: 20 }, s => ({ cur: s.weaponTier, max: 15 })),
    G('Vaincre 500 ennemis', '💥', { medals: 20, mat3: 25 }, s => ({ cur: s.lifetime.kills, max: 500 })),
    G('Gagner l’étape 20', '🏆', { medals: 30 }, s => ({ cur: s.progression.bestStage, max: 20 })),
    G('Forger la lance de rang 20', '🔥', { medals: 30 }, s => ({ cur: s.weaponTier, max: 20 })),
    G('Recruter 500 unités au total', '👑', { food: 100000, medals: 25 }, s => ({ cur: s.lifetime.units, max: 500 })),
    G('Forger LA LANCE ULTIME', '🌈', { medals: 100 }, s => ({ cur: s.weaponTier, max: 29 })),
    G('Forger L’AU-DELÀ DE LA LANCE', '🌌', { medals: 250 }, s => ({ cur: s.weaponTier, max: 39 })),
    // §8 (D5)
    G('Dresser votre 1er mannequin d’entraînement', '🎯', { food: 5000, mat2: 20 }, s => ({ cur: mannequinCount(s), max: 1 })),
    G('Améliorer un bâtiment au niveau 5', '🏛️', { medals: 15, food: 20000 }, s => ({ cur: maxBuildingLvl(s), max: 5 })),
    G('Faire naître une unité de Tier 6', '👑', { medals: 40 }, s => ({ cur: hasTier6(s) ? 1 : 0, max: 1 })),
  ];
  function mannequinCount(s) { return (s.mannequins || []).filter(m => m && m.type).length; }
  function maxBuildingLvl(s) { let m = 0; for (const k in (s.buildings || {})) m = Math.max(m, s.buildings[k] || 0); return m; }
  function hasTier6(s) {
    for (const k in (s.army || {})) if ((GameData.UNIT_TIER[k] || 0) === 6 && s.army[k] > 0) return true;
    return false;
  }
  function totalGens(s) {
    const ids = new Set((GameData.GENERATORS || []).map(g => g.id));
    let n = 0; for (const k in s.generators) if (ids.has(k)) n += s.generators[k];
    return n;
  }
  function armyTotal(s) { let n = 0; for (const k in s.army) n += s.army[k]; return n; }
  function trainTotal(s) { let n = 0; for (const k in s.training) n += s.training[k]; return n; }
  function evoTotal(s) { let n = 0; for (const k in s.evo) n += s.evo[k]; return n; }
  function compUnits(s) { return s.composition && s.composition.units ? s.composition.units.length : 0; }
  function dojoAssigned(s) {
    if (!s.dojo || !s.dojo.assign) return 0;
    let n = 0; for (const k in s.dojo.assign) if (s.dojo.assign[k]) n++;
    return n;
  }
  function alambicParts(s) {
    const a = s.alambic || {};
    let n = 0;
    for (const c of (a.cuves || [])) if (c && c.res) n++;
    for (const f of (a.fioles || [])) if (f && f.recipe) n++;
    for (const p of (a.pipes || [])) {
      if (p && Number.isInteger(p.c) && Number.isInteger(p.f)) n++;
    }
    return n;
  }
  function catTrainTotal(s) { let n = 0; for (const k in (s.catTraining || {})) n += s.catTraining[k]; return n; }
  function hatchHighestWorkshopLevel(s) {
    const built = s.hatchery && s.hatchery.built;
    if (!built) return 0;
    let lvl = 0;
    for (const station of (GameData.HATCHERY.COUVEUSES || [])) {
      lvl = Math.max(lvl, built[station.id] || 0);
    }
    return lvl;
  }
  function workTotal(s) {
    if (!s.work) return 0;
    let n = 0, pct = 0;
    for (const d in s.work) for (const k in s.work[d]) {
      const poste = s.work[d][k] || {};
      n += poste.n || 0; // sauvegardes d'avant l'affectation en parts
      pct += poste.pct || 0;
    }
    n += Math.floor(armyTotal(s) * Math.min(1, pct));
    return n;
  }
  function compPts(s) {
    if (!s.composition) return 0;
    let p = 0;
    for (const t of s.composition.units || []) { const u = GameData.UNIT_TYPES[t]; if (u) p += u.pts || 1; }
    for (const id of s.composition.potions || []) { const q = GameData.POTIONS.find(x => x.id === id); if (q) p += q.pts || 1; }
    return p;
  }

  // ---------- succès ----------
  const ACH = (id, name, desc, icon, check) => ({ id, name, desc, icon, check });
  GameData.ACHIEVEMENTS = [
    ACH('click100', 'Papouilleur fou', '100 encouragements donnés au chef.', '👋', s => s.lifetime.clicks >= 100),
    ACH('click1000', 'Main de velours', '1 000 encouragements. Le chef ronronne.', '🤲', s => s.lifetime.clicks >= 1000),
    ACH('food10k', 'Garde-manger', '10 000 nourritures amassées au total.', '🍱', s => s.lifetime.food >= 10000),
    ACH('food1m', 'Grenier national', '1 million de nourritures au total.', '🏦', s => s.lifetime.food >= 1e6),
    ACH('gen25', 'Promoteur', '25 générateurs possédés.', '🏘️', s => { let n = 0; for (const k in s.generators) n += s.generators[k]; return n >= 25; }),
    ACH('gen100', 'Baron industriel', '100 générateurs possédés.', '🏭', s => { let n = 0; for (const k in s.generators) n += s.generators[k]; return n >= 100; }),
    ACH('units50', 'Sergent recruteur', '50 unités produites au total.', '📯', s => s.lifetime.units >= 50),
    ACH('units1000', 'Légion de poils et de plumes', '1 000 unités produites.', '🎺', s => s.lifetime.units >= 1000),
    ACH('kills100', 'Première escarmouche', '100 ennemis vaincus.', '⚔️', s => s.lifetime.kills >= 100),
    ACH('kills5000', 'Terreur du champ de bataille', '5 000 ennemis vaincus.', '☠️', s => s.lifetime.kills >= 5000),
    ACH('stage5', 'Explorateur', 'Étape 5 de l’Expédition atteinte.', '🗺️', s => s.progression.bestStage >= 5),
    ACH('stage15', 'Conquérant', 'Étape 15 de l’Expédition atteinte.', '🏔️', s => s.progression.bestStage >= 15),
    ACH('stage30', 'Vétéran des étoiles', 'Étape 30. Sérieusement ?', '🌟', s => s.progression.bestStage >= 30),
    ACH('weapon10', 'Maître forgeron', 'Lance de rang 10 forgée.', '🔨', s => s.weaponTier >= 10),
    ACH('weapon20', 'Forge légendaire', 'Lance de rang 20 forgée.', '🌋', s => s.weaponTier >= 20),
    ACH('weapon29', 'LA LANCE', 'Vous avez forgé LA LANCE ULTIME.', '🌈', s => s.weaponTier >= 29),
    ACH('armor9', 'Inarrêtable', 'Armure céleste forgée.', '🛡️', s => s.armorTier >= 9),
    ACH('evo4', 'Légende vivante', 'Une unité évoluée au rang Légendaire.', '👑', s => { for (const k in s.evo) if (s.evo[k] >= 4) return true; return false; }),
    ACH('captures100', 'Planteur de drapeaux', '100 points de contrôle capturés.', '🏳️', s => s.lifetime.captures >= 100),
    ACH('deposits50', 'Pilier de la coalition', '50 déploiements sur la carte du monde.', '🌍', s => s.lifetime.deposits >= 50),
    ACH('crafts25', 'Artisan du dimanche', '25 objets fabriqués.', '🧰', s => s.lifetime.crafts >= 25),
    ACH('medals100', 'Poitrail décoré', '100 médailles gagnées au total.', '🎖️', s => (s.stats.medalsEarned || 0) >= 100),
    ACH('playtime1h', 'On est bien là', '1 heure de jeu. Le canapé approuve.', '🛋️', s => s.lifetime.playtime >= 3600),
    ACH('playtime10h', 'Stratège de salon', '10 heures de jeu. Respect.', '🧠', s => s.lifetime.playtime >= 36000),
    ACH('weapon39', 'Au-delà du raisonnable', 'L’AU-DELÀ DE LA LANCE est forgé. Arrêtez-vous.', '🌌', s => s.weaponTier >= 39),
    ACH('armor14', 'Concept de blessure : rejeté', 'L’ARMURE ABSOLUE est forgée.', '🏛️', s => s.armorTier >= 14),
    ACH('compo10', 'Théoricien du bocal', 'Une composition à 10 points pile. Optimisé.', '🧩', s => compPts(s) >= 10),
    ACH('potions25', 'Alchimiste de terrain', '25 potions préparées. La cuisine sent bizarre.', '🧪', s => (s.lifetime.potions || 0) >= 25),
    ACH('dojo5', 'Colonie de vacances militaire', 'Les 5 activités du Dojo occupées en même temps.', '🎪', s => dojoAssigned(s) >= 5),
    ACH('cattrain10', 'Directeur des études', '10 niveaux d’améliorations de catégorie.', '📚', s => catTrainTotal(s) >= 10),
    ACH('control10', 'Majorité absolue', '10 victoires par contrôle de zone.', '🚩', s => (s.stats.controlWins || 0) >= 10),
    // §D12-6 : ACH 'farm50' supprimé avec le farm (la clé save stats.farmLoops reste, plus jamais lue)
    ACH('hatch100', 'Directeur de crèche', '100 unités écloses. Les couveuses ronflent.', '🐣', s => (s.lifetime.hatched || 0) >= 100),
    ACH('workers100', 'Négrier bienveillant', '100 ouvriers affectés en même temps.', '👷', s => workTotal(s) >= 100),
    ACH('ordnance10', 'Artificier diplômé', 'Explosif de rang 10 forgé.', '🧨', s => (s.ordnanceTier || 0) >= 10),
    // IDs conservés pour les sauvegardes ; les anciens ateliers/postes n'ont
    // plus d'API d'achat. Ces succès suivent leurs remplaçants vivants.
    ACH('atelier4', 'Verrier amateur', 'Un alambic de 4 pièces assemblé.', '⚗️', s => alambicParts(s) >= 4),
    ACH('dojo10', 'Campus militaire', '10 niveaux d’entraînement cumulés.', '🏯', s => trainTotal(s) >= 10),
    // §8 (D5)
    ACH('mannequin1', 'Maître d’armes', 'Premier mannequin d’entraînement dressé. Le rang se gagne à la sueur.', '🎯', s => (s.mannequins || []).some(m => m && m.type)),
    ACH('building5', 'Bâtisseur ambitieux', 'Un bâtiment porté au niveau 5. Le béton coule dans les veines.', '🏛️', s => { for (const k in (s.buildings || {})) if ((s.buildings[k] || 0) >= 5) return true; return false; }),
    ACH('tier6', 'Sang de légende', 'Une unité de Tier 6 a vu le jour. Le panthéon a de la place.', '👑', s => { for (const k in (s.army || {})) if ((GameData.UNIT_TIER[k] || 0) === 6 && s.army[k] > 0) return true; return false; }),
  ];

  // ============================================================
  // LA VALEUR-NOURRITURE d'une ressource. Le comptoir de troc l'utilisait ; il
  // a été retiré, mais la table RESTE : la Cuisine s'en sert pour chiffrer le
  // coût d'une recette (state-cuisine.js). Ce n'est pas une table de troc,
  // c'est une échelle de valeur.
  // ============================================================
  // Valeur de chaque ressource en équivalent-nourriture. §D13-E : les medals y
  // FIGURENT désormais (~50, leçon AUD1 — une ressource sans valeur déclarée est
  // une ressource que les systèmes oublient), mais restent NON troquables, comme
  // les ressources de ville. eggs n'y figure pas : la ponte ne se brade pas.
  GameData.RES_VALUE = {
    food: 1, mat1: 6, mat2: 14, mat3: 22, milk: 30,
    essence: 120, parts: 150, fabric: 170, salpetre: 400, elixir: 450,
    medals: 50,
    // §D12-2 : ressources de ville — échelle 60 → 4000 (les dernières villes sont chères)
    therma: 60, ferblanc: 80, selgemme: 105, brume: 140, granit: 185, nacre: 245,
    chanvre: 320, colle: 425, ambre: 560, charbon: 745, huile: 985, zephyr: 1300,
    pollenor: 1720, vieilacier: 2270, soiefine: 3000, orroyal: 4000,
    // §D13-D1 : ressources craftées — valeur ≈ celle des intrants, marge d'alambic incluse
    vapeur: 200, acierplume: 260, brouillard: 330, poudre: 380,
    verreambre: 1800, feugras: 3200, catalyseur: 5500, filarcane: 7500,
  };
  // Taux volontairement défavorable : 65% de la valeur s'évapore. C'est un puits,
  // pas une banque. Le comptable du marché a une moustache et zéro scrupule.

  // ============================================================
  // DESIGN4 §3 : PRESTIGE — « La Nouvelle Portée » / « La Grande Migration »
  // ============================================================
  GameData.PRESTIGE_UNLOCK_STAGE = 11; // premier boss de ville vaincu
  GameData.PRESTIGE_NAME = { cats: 'La Nouvelle Portée', birds: 'La Grande Migration' };
  // 6 perks permanents, 5 niveaux, coût en dynasty ×2.2 par niveau (GameData.perkCost).
  GameData.PRESTIGE_PERKS = [
    { id: 'moustache_prod', icon: '🥸', name: 'Moustache Héréditaire', max: 5, base: 6, pct: 0.20,
      desc: '+20 % de production globale par niveau. Les générateurs obéissent à la moustache, pas à vous.' },
    { id: 'papouilles', icon: '🤲', name: 'Papouilles Ancestrales', max: 5, base: 4, mult: 2,
      desc: 'Clic ×2 par niveau. Un savoir-faire transmis de coussinet en coussinet.' },
    { id: 'caserne', icon: '🏰', name: 'Caserne Dynastique', max: 5, base: 4, flat: 15,
      desc: '+15 de population maximale par niveau. On pousse les murs. Les murs signent.' },
    { id: 'contremaitre', icon: '📋', name: 'Contremaître Éternel', max: 5, base: 5, pct: 0.08,
      desc: 'Ouvriers +8 % de vitesse par niveau (multiplicatif). Il est mort en 1892. Il pointe encore.' },
    { id: 'veterans', icon: '🎖️', name: 'Sang de Vétéran', max: 5, base: 6, pct: 0.10,
      desc: '+10 % de dégâts et de PV en bataille par niveau. Les cicatrices sont héréditaires. N’expliquez pas.' },
    { id: 'garde_manger', icon: '🏺', name: 'Garde-Manger Enterré', max: 5, base: 5,
      desc: 'Chaque nouvelle portée démarre avec un pécule (nourriture et matériaux). Les ancêtres planquaient. Bien.' },
  ];
  GameData.perkCost = (perk, lvl) => Math.ceil(perk.base * Math.pow(2.2, lvl));
  // pécule du perk garde_manger au niveau n (appliqué par prestigeReset)
  GameData.gardeMangerStart = n => n > 0
    ? { food: Math.round(1500 * Math.pow(3, n - 1)), mat1: Math.round(60 * Math.pow(3, n - 1)) }
    : null;

  // ============================================================
  // DESIGN4 §1 : RES_USES — à quoi SERT chaque ressource (tooltips D)
  // ============================================================
  // Généré en scannant les VRAIS coûts du jeu : zéro promesse creuse. Chaque
  // entrée est une courte étiquette FR ; l'ordre va du plus parlant au plus annexe.
  GameData.RES_USES = (function () {
    const U = {};
    for (const r of GameData.RES_KEYS) U[r] = [];
    U.eggs = [];
    const MAXL = 8;
    const add = (res, label) => {
      if (!U[res]) U[res] = [];
      if (U[res].indexOf(label) === -1 && U[res].length < MAXL) U[res].push(label);
    };
    // 1) générateurs : achat + consommation continue des chaînes avancées
    for (const g of GameData.GENERATORS) {
      for (const k in g.baseCost) add(k, 'générateurs (achat)');
      for (const k in (g.consumes || {})) add(k, 'chaînes avancées (conso continue)');
    }
    // 2) forge : premier tier où la ressource apparaît, par ligne ; si elle irrigue
    //    5 lignes ou plus, on condense (le tooltip n'est pas un cadastre)
    const LINES = [
      ['lances', GameData.WEAPONS], ['tirs', GameData.RANGED], ['bâtons', GameData.STAFFS],
      ['explosifs', GameData.ORDNANCE], ['lames', GameData.BLADES], ['armures', GameData.ARMORS],
      ['robes', GameData.ROBES], ['gilets', GameData.VESTS], ['combinaisons', GameData.SUITS],
      ['boucliers', GameData.SHIELDS],
    ];
    const forgeFirst = {}; // res -> [{label, tier}]
    for (const [label, arr] of LINES) {
      const first = {};
      arr.forEach((it, i) => { for (const k in it.cost) if (first[k] === undefined) first[k] = i; });
      for (const k in first) (forgeFirst[k] = forgeFirst[k] || []).push({ label, tier: first[k] });
    }
    for (const k in forgeFirst) {
      const lst = forgeFirst[k];
      if (lst.length >= 5) add(k, 'forge (' + lst.length + ' lignes)');
      else for (const e of lst) add(k, 'forge : ' + e.label + (e.tier > 0 ? ' T' + e.tier + '+' : ''));
    }
    // 3) évolutions : premier rang où la ressource entre au tarif
    const evoFirst = {};
    for (let e = 0; e < 30; e++) {
      const c = GameData.evoCost('lancier', e);
      for (const k in c) { if (k === 'units') continue; if (evoFirst[k] === undefined) evoFirst[k] = e; }
    }
    for (const k in evoFirst) add(k, 'évolutions' + (evoFirst[k] > 0 ? ' (rang ' + evoFirst[k] + '+)' : ''));
    // 3bis) LE RECRUTEMENT — jamais scanné jusqu'ici. Le nectar vert et le poil
    // pourpre ne servent QU'À ça (Perroquet Tambour, Aigle Majesté) : leur
    // infobulle annonçait « — », c'est-à-dire « ne sert à rien », pour deux
    // ressources dont dépend le recrutement de deux unités.
    for (const id in (GameData.UNIT_TYPES || {})) {
      for (const k in (GameData.UNIT_TYPES[id].cost || {})) add(k, 'recrutement d’unités');
    }
    // 4) recettes d'éclosion (les œufs nourrissent les couveuses)
    for (const t in GameData.HATCH_RECIPES) {
      const R = GameData.HATCH_RECIPES[t];
      for (const k in (R.res || {})) add(k, k === 'eggs' ? 'couveuses de juvéniles' : 'recettes d’éclosion');
    }
    // 4bis) LE MÉTAL PAYÉ À LA NAISSANCE — jamais scanné jusqu'ici. C'est
    // pourtant le seul client PERMANENT de la Mine et de la Fonderie : sans
    // cette ligne, les infobulles du minerai et des lingots annonçaient les
    // seules lignes de forge, et l'audit ne voyait pas le tier qu'ils exigent.
    if (GameData.metalNaissance) {
      for (const t in (GameData.UNIT_TYPES || {})) {
        const m = GameData.metalNaissance(t);
        for (const k in (m || {})) add(k, 'métal payé à la naissance des unités');
      }
    }
    // 5) cuisine : potions, consommables, alchimie, ateliers
    for (const p of GameData.POTIONS) for (const k in p.cost) add(k, 'potions de bataille');
    for (const c of GameData.CONSUMABLES) for (const k in c.cost) add(k, 'consommables');
    // §D15-7 : l'alambic — intrants des recettes (les cityRes y trouvent leur puits) + pièces
    for (const id in GameData.ALAMBIC.recipes) {
      for (const k in GameData.ALAMBIC.recipes[id].inputs) add(k, 'alambic (' + id + ')');
    }
    for (const n of [0, 3]) {
      for (const k in GameData.ALAMBIC.cuveCost(n)) add(k, 'pièces d’alambic');
      for (const k in GameData.ALAMBIC.fioleCost(n)) add(k, 'pièces d’alambic');
      for (const k in GameData.ALAMBIC.pipeCost(n)) add(k, 'pièces d’alambic');
    }
    for (let i = 0; i < GameData.ATELIERS.max; i++) for (const k in GameData.ATELIERS.buyCost(i)) add(k, 'ateliers de cuisine');
    // 5bis) LA MINE : la fonderie mange le minerai, l'équipement ouvre la profondeur
    if (GameData.MINE) {
      for (const k in GameData.MINE.foundry.in) add(k, 'fonderie (coulée des lingots)');
      for (const m of GameData.MINERALS) add(m.id, 'fonderie (coulée des lingots)');
      add('etai', 'creusement de la mine (blocs stériles)');
      for (const k in GameData.MINE.etaiCost(0)) add(k, 'étais de mine');
      // (VAGUE FONDERIE) plus rien ne s'achète au fond : mineurs et creusets
      // viennent des niveaux de la Mine et de la Fonderie.
      for (const id of GameData.MINE.gearOrder) {
        const g = GameData.MINE.gear[id];
        for (const lvl of [0, 2, 4]) for (const k in g.cost(lvl)) add(k, 'équipement de mine');
      }
    }
    // 6) infrastructures : dojo, enclumes, ingénierie, nurserie, clic
    for (let n = 0; n < GameData.DOJO2.max; n++) for (const k in GameData.DOJO2.buildCost(n)) add(k, 'postes du Dojo');
    // les agrès du terrain de jeu : un chantier à part entière (18 par faction)
    for (const a of (GameData.ACTIVITIES.birds || [])) for (const k in (a.cost || {})) add(k, 'agrès du terrain de jeu');
    for (let i = 0; i < GameData.MANNEQUINS.max; i++) for (const k in GameData.MANNEQUINS.buyCost(i)) add(k, 'mannequins d’entraînement');
    for (let i = 1; i < GameData.FORGE.maxAnvils; i++) for (const k in GameData.FORGE.anvilCost(i)) add(k, 'enclumes de forge');
    // L'ÉCHANTILLON DOIT COUVRIR TOUTE LA PISTE.
    // On ne lisait que les niveaux 0 et 12 : les six paliers de ressources
    // posés plus haut (BF_STEPS va jusqu'à 74) n'apparaissaient nulle part.
    // Une ressource dont la seule utilité est au niveau 60 s'affichait donc
    // « sert à rien » dans l'infobulle — le joueur n'avait aucun moyen de
    // savoir pourquoi la raffiner. On balaie la piste entière.
    for (const id in GameData.BUILDFORGE) {
      const bf = GameData.BUILDFORGE[id];
      for (let lvl = 0; lvl <= (bf.max || 100); lvl += 4) {
        for (const k in bf.cost(lvl)) add(k, 'ingénierie d’expédition');
      }
    }
    // LES PISTES DU DOJO — jamais scannées jusqu'ici, alors qu'elles drainent
    // en continu (dojoDrainCost) : la brindille ambrée du 5e cran et le nectar
    // raffiné des crans 25 et 40 étaient invisibles pour l'infobulle.
    for (const trackId in (GameData.TRAINING || {})) {
      for (let lvl = 0; lvl <= 45; lvl += 5) {
        for (const k in (GameData.dojoDrainCost(trackId, lvl) || {})) add(k, 'pistes du Dojo');
      }
    }
    for (const k in GameData.NURSERY.capCost(0)) add(k, 'capacité de caserne');
    for (const st of GameData.HATCHERY.PONDOIRS.concat(GameData.HATCHERY.COUVEUSES)) {
      for (const k in st.cost) add(k, 'pondoirs & couveuses');
    }
    for (const k in GameData.clickCost(0)) add(k, 'papouilles améliorées');
    // 6bis) §D12/§D13 : QG, arsenal & quartiers de garnison, Grimoire & parchemins
    // LES SIX BÂTIMENTS, pas seulement le QG. On ne lisait que le QG : le
    // matériau 2 raffiné, qui paie les paliers de Nurserie à partir du niveau
    // 6, n'était réclamé par personne d'après l'infobulle.
    for (const bid in GameData.BUILDINGS) {
      const b = GameData.BUILDINGS[bid];
      if (!b || typeof b.cost !== 'function') continue;
      const label = bid === 'qg' ? 'le Grand QG' : 'bâtiment : ' + (b.name ? b.name.cats : bid);
      for (let lvl = 2; lvl <= (b.max || 10); lvl += 2) for (const k in b.cost(lvl)) add(k, label);
    }
    // Le Grimoire n'était lu qu'au niveau 1, et le Pollen d'Or était recollé à
    // la main par-dessus — une rustine qui ne pouvait que se périmer (le
    // niveau 5 réclame désormais aussi du pollen abyssal, et la rustine ne le
    // savait pas). On lit les cinq niveaux : plus rien à tenir à jour ailleurs.
    for (const sp of GameData.SPELLS) {
      for (let lvl = 1; lvl <= (sp.maxLvl || 5); lvl++) {
        for (const k in sp.upCost(lvl)) add(k, lvl >= 4 ? 'Grimoire (sorts niv 4-5)' : 'Grimoire (sorts)');
      }
    }
    for (const id in GameData.PARCHMENTS) for (const k in GameData.PARCHMENTS[id].cost) add(k, 'parchemins de bataille');
    return U;
  })();

  // ---------- constantes d'équilibrage ----------
  GameData.BALANCE = {
    offlineCapSec: 12 * 3600,
    autosaveSec: 10,
    agentCap: 400,
    critChance: 0.05, critMult: 10,
    pateBonus: 0.5,
    milkMult: 2,
    citySimCapSec: 6 * 3600,
    depositBatch: [1, 5, 25, 100],
    combatScale: 1.56,
    aoeMaxTargets: 4,        // cibles max touchées par un impact de zone
    controlWinPoints: 120,   // points de contrôle accumulés pour gagner
    // Les premières étapes enseignent la prise de drapeaux sans imposer deux
    // minutes d'attente une fois la carte comprise. Dès l'étape 7, la course
    // rejoint la durée complète des batailles avancées.
    controlWinPointsByStage: [30, 45, 60, 75, 90, 105],
    towerRange: 185,         // §B (D13) : portée UNIFIÉE des tours de garde — battle.js la lit (plus de fallback implicite)
    pixelArt: 0,             // §pixel : taille du bloc pixel-art des scènes de bataille (px écran, fractionnaire).
                             // 0 = off (rendu lisse partout — filtre retiré) ; 1 = grain léger sur écrans DPR>1 ; 1.1-1.2 = visible partout.
    // §D13-E : plafond du Festin — gain ≤ min(rate×1800, feastCapMult×coût équiv-food).
    // state.js l'applique ; la marmite ne rend plus 10 000× sa mise.
    feastCapMult: 250,
  };
  // §D12-6 : farmRewardMult est MORT avec le farm d'expédition (purge complète).

  // ---------- §DESIGN9 : BOSS de carte v2 (présences NEUTRES INVULNÉRABLES) ----------
  // Plus de PV, plus de mort : ce sont des CONTRAINTES DE TERRAIN posées dans le map-lab
  // qui influencent la bataille des DEUX camps par un effet permanent/périodique DISTINCT.
  // Effets marquants mais JAMAIS one-shot d'un groupe entier : des obstacles, pas des exécuteurs.
  //
  // Champs communs : { id, name{cats,birds}, emoji, effect, col, desc }.
  //   effect ∈ 'laser'|'slow'|'poison'|'paralyze'|'blockprod'|'rocks'|'spawner'|'lightning'|'lava'
  //   range : portée de ciblage (laser, blockprod).      r : rayon de zone/aura.
  //   cd    : période en s (0 ou absent = aura permanente sans cd).
  //   dmg   : dégât par coup (laser/paralyze/lightning) OU dégât/s (poison/lava).
  // Params spécifiques par effet :
  //   slow      → slowPct  (% de ralentissement dans r, entretenu en continu).
  //   paralyze  → stunDur  (s d'immobilisation+mutisme des unités de r ; + dmg léger).
  //   blockprod → blockDur (s de gel de production des nœuds à range).
  //   rocks     → rockCap (nb max de roches vivantes), rockR (rayon d'une roche),
  //               spawnR (rayon de pose autour du boss), rockGap (dist mini nœuds/roches).
  //   spawner   → capWild (nb max de sbires 'wild' vivants), + stats des sbires :
  //               minHp, minDmg, minCd, minRange, minSpeed. cd = période de spawn.
  //   lightning → bolts (nb d'impacts/salve), r (rayon AoE au sol). Frappe TOUTE la carte.
  //   lava      → bolts (nb d'impacts/salve), r (rayon de la flaque), lavaDur (s de vie de la flaque).
  GameData.MAP_BOSSES = [
    {
      id: 'taupe',
      name: { cats: 'La Taupe Laser', birds: 'La Taupe Laser' },
      emoji: '🦫',
      effect: 'laser', range: 140, cd: 1.4, dmg: 24, r: 0, col: '#8a6a44',
      desc: 'Sort d’une motte, allume ses yeux, et grave un trait fumant sur le plus proche. Monocible et douloureux ; elle vise, elle ne mitraille pas.',
    },
    {
      id: 'limace',
      name: { cats: 'La Limace Gluante', birds: 'La Limace Gluante' },
      emoji: '🐌',
      effect: 'slow', r: 74, slowPct: 55, col: '#9fc84e',
      desc: 'Bave une flaque permanente qui englue tout ce qui traîne autour d’elle. On n’en meurt pas ; on y patauge, et c’est bien pire.',
    },
    {
      id: 'champignon',
      name: { cats: 'Le Champignon Vénéneux', birds: 'Le Champignon Vénéneux' },
      emoji: '🍄',
      effect: 'poison', r: 64, dmg: 7, col: '#b4567e',
      desc: 'Immobile, susceptible, franchement toxique : un nuage de spores permanent qui ronge sur la durée quiconque s’attarde dans son périmètre.',
    },
    {
      id: 'meduse',
      name: { cats: 'La Méduse Électrique', birds: 'La Méduse Électrique' },
      emoji: '⚡',
      effect: 'paralyze', r: 72, cd: 4.2, stunDur: 1.2, dmg: 5, col: '#5ad0e0',
      desc: 'Flotte, pulse, puis décharge : les unités du rayon sont figées et muettes une seconde. Le dégât est ridicule ; le silence, mortel.',
    },
    {
      id: 'corbeau',
      name: { cats: 'Le Corbeau Saboteur', birds: 'Le Corbeau Saboteur' },
      emoji: '🐦‍⬛',
      effect: 'blockprod', range: 132, cd: 6.0, blockDur: 3.5, col: '#3a3550',
      desc: 'Encapuchonné, clé à molette au poing : il gèle la production des bâtiments à portée. Vos usines toussent pendant qu’il ricane.',
    },
    {
      id: 'golem',
      name: { cats: 'Le Golem d’Éboulis', birds: 'Le Golem d’Éboulis' },
      emoji: '🪨',
      effect: 'rocks', cd: 3.6, rockCap: 5, rockR: 12, spawnR: 46, rockGap: 26, col: '#8a8f98',
      desc: 'Un tas de cailloux mal empilé qui recrache des rochers autour de lui. Il ne mure jamais tout à fait : il vous force juste à faire le détour.',
    },
    {
      id: 'reine',
      name: { cats: 'La Reine des Nuées', birds: 'La Reine des Nuées' },
      emoji: '🐝',
      effect: 'spawner', cd: 5.0, capWild: 6,
      minHp: 60, minDmg: 6, minCd: 1.2, minRange: 26, minSpeed: 46, col: '#e0b040',
      desc: 'Pond des sbires en boucle : une 3e armée sauvage, hostile aux DEUX camps, qui ne prend aucun nœud mais mord tout le monde. Tuez la nuée, pas la reine (intuable).',
    },
    {
      id: 'orage',
      name: { cats: 'Le Nuage d’Orage', birds: 'Le Nuage d’Orage' },
      emoji: '🌩️',
      effect: 'lightning', cd: 3.0, dmg: 14, r: 34, bolts: 2, col: '#6a78a0',
      desc: 'Boude en altitude et lâche la foudre n’importe où sur la carte. Impossible à esquiver par la fuite : le ciel choisit, pas vous.',
    },
    {
      id: 'volcan',
      name: { cats: 'Le Cône Grondant', birds: 'Le Cône Grondant' },
      emoji: '🌋',
      effect: 'lava', cd: 4.0, dmg: 8, r: 30, lavaDur: 4.0, bolts: 1, col: '#c8502a',
      desc: 'Crache des giclées de lave sur des points au hasard, laissant des flaques brûlantes qui grillent le sol quelques secondes. Le terrain devient le piège.',
    },
  ];

  // ============================================================
  // §LAB : MODE TEST DIRECT du labo d'équilibrage (balance-lab.html).
  // Opt-in : la clé localStorage 'balanceLabLive' = '1' (bouton 🧪 du labo).
  // Applique les édits (chemins littéraux dans GameData) AVANT le chargement
  // des autres modules — ils capturent leurs constantes à la lecture.
  // Limites assumées : formules (__formula) ignorées, structures dérivées à la
  // lecture (ex. PARCHMENT_ITEMS) non recalculées. Ce mode est ÉPHÉMÈRE (test
  // local, localStorage) ; la voie DÉFINITIVE est d'éditer les fichiers de
  // données eux-mêmes (Balance Lab / endpoint Vite /__lab/set) — jamais
  // d'override committé.
  // ============================================================
  // Applique une map { 'chemin.pointé': { new } } sur GameData. Renvoie
  // [appliqués, ignorés]. Utilisé par le test direct du balance-lab (localStorage).
  function applyLabEdits(edits) {
    let applied = 0, skipped = 0;
    for (const path in edits) {
      if (path.endsWith('.__formula')) { skipped++; continue; }
      const keys = path.split('.');
      let o = GameData;
      for (let i = 0; i < keys.length - 1 && o != null; i++) o = o[keys[i]];
      const last = keys[keys.length - 1];
      if (o != null && typeof o === 'object' && last in o && typeof o[last] !== 'object' && typeof o[last] !== 'function') {
        o[last] = edits[path].new; applied++;
      } else skipped++;
    }
    return [applied, skipped];
  }

  GameData.__labOverrides = 0;
  try {
    let applied = 0, skipped = 0;
    // MODE TEST DIRECT (balance-lab.html) : édits ÉPHÉMÈRES en localStorage,
    // appliqués uniquement après consentement explicite ('balanceLabLive' =
    // '1'). Pour un réglage permanent, on édite le fichier de données
    // (endpoint /__lab/set).
    if (window.__allowLabOverrides === true && typeof localStorage !== 'undefined' && localStorage.getItem('balanceLabLive') === '1') {
      const lab = JSON.parse(localStorage.getItem('balanceLab.v2') || '{}');
      const [a, s] = applyLabEdits(lab.edits || {}); applied += a; skipped += s;
    }
    GameData.__labOverrides = applied;
    GameData.__labSkipped = skipped;
    if (applied || skipped) console.info('[labo] test direct : ' + applied + ' appliqué(s)' + (skipped ? ', ' + skipped + ' ignoré(s)' : ''));
  } catch (e) { console.warn('[labo] test direct ignoré :', e.message); }

  window.GameData = GameData;
