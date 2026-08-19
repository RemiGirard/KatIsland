/* ============================================================
   GRIFFES & PLUMES — data-general.js
   L'ONGLET DU GÉNÉRAL : héros nommés, biomes, salles, butin, objets,
   reliques et plans. TOUT vient de tables — aucun donjon écrit à la main,
   sinon vingt explorations et le contenu est vide.

   Contrat de lecture (voir docs/PLAN-GENERAL-ET-TISSAGE.md) :
   - une MISSION = un biome + une suite de SALLES tirées de gabarits ;
   - une salle ordinaire se résout seule (jet sur une stat du groupe) ;
   - une salle CLÉ (`key: true`) attend une décision du joueur, avec un
     choix par défaut annoncé si personne ne répond (l'idle ne bloque jamais).
   ============================================================ */
"use strict";

  // ---------- LES CARACTÉRISTIQUES ----------
  // Il n'y a QUE des combats dans cet onglet : les caractéristiques sont donc
  // des stats de combat pures. Pas d'« adresse » ni d'« esprit » abstraits —
  // ce qu'on lit sur une pièce d'équipement, on le sent dans l'arène.
  GameData.GEN_STATS = {
    hp:    { id: 'hp',    icon: '', name: 'Points de vie',      desc: 'ce qu’on peut encaisser avant de tomber' },
    dmg:   { id: 'dmg',   icon: '', name: 'Dégâts',             desc: 'ce que coûte un coup à celui d’en face' },
    aspd:  { id: 'aspd',  icon: '', name: 'Vitesse d’attaque',  desc: 'coups par seconde' },
    mspd:  { id: 'mspd',  icon: '', name: 'Vitesse',            desc: 'déplacement — sortir d’une zone à temps' },
    armor: { id: 'armor', icon: '', name: 'Armure',             desc: 'réduit les dégâts reçus (plafond 70 %)' },
    range: { id: 'range', icon: '', name: 'Portée',             desc: '0 = corps à corps ; sinon, on frappe de loin' },
  };
  /* LE BOUCLIER D'ENERGIE. Une reserve qui encaisse AVANT les points de
     vie et se recharge seule apres un repit. Il ne se soigne pas : il
     revient. C'est ce qui rend jouable un personnage en tissu, qui n'a ni
     armure ni masse de vie — il evite, il encaisse le premier coup, il
     attend. Sans lui, la voie magique n'a aucune facon de survivre.
     `eshRegen` est ce qu'il regagne par seconde une fois le repit passe. */
  GameData.GEN_STATS.esh = { id: 'esh', icon: '', name: 'Bouclier',
    desc: 'encaisse avant les points de vie, et se recharge seul' };
  GameData.GEN_STATS.eshRegen = { id: 'eshRegen', icon: '', name: 'Recharge',
    desc: 'ce que le bouclier regagne par seconde' };
  GameData.GEN_STAT_ORDER = ['hp', 'esh', 'dmg', 'aspd', 'mspd', 'armor', 'range', 'eshRegen'];
  GameData.ESH_REPIT = 4.0;   // secondes sans coup recu avant que ca reparte
  // comment une stat s'affiche (l'aspd en décimales, le reste en entier)
  GameData.genStatFmt = function (k, v) {
    if (k === 'aspd') return (Math.round((v || 0) * 100) / 100).toFixed(2).replace('.', ',') + '/s';
    if (k === 'armor') return Math.round(v || 0) + '';
    return Math.round(v || 0) + '';
  };

  GameData.GENERAL = {
    maxLevel: 100,
    xpFor: lvl => Math.ceil(120 * Math.pow(1.45, Math.max(0, lvl - 1))),
    // le Général : solide, polyvalent, au contact
    baseStats: { hp: 140, dmg: 12, aspd: 1.0, mspd: 72, armor: 14, range: 0 },
    // ce que rapporte un niveau — un paquet fixe, lisible d'un coup d'œil
    levelGain: { hp: 9, dmg: 0.8, aspd: 0.012, mspd: 0.6, armor: 0.7, range: 0 },
    // SIX emplacements : on habille un aventurier de la tête aux pieds.
    // L'ordre est celui de la silhouette (haut → bas, main droite → main gauche).
    // 7 emplacements : le BOUCLIER est arrivé avec les familles d'armes
    slots: ['casque', 'armure', 'arme', 'bouclier', 'gants', 'bottes', 'bijou'],
    slotIcon: { casque: '', armure: '', arme: '', bouclier: '', gants: '', bottes: '', bijou: '' },
    slotName: { casque: 'Casque', armure: 'Armure', arme: 'Arme', bouclier: 'Bouclier', gants: 'Gants', bottes: 'Bottes', bijou: 'Bijou' },
    partySize: lvl => (lvl >= 18 ? 4 : lvl >= 8 ? 3 : 2),
    maxParty: 4,
    // convalescence : l'armure amortit, donc on rentre moins abîmé
    healHours: (sev, armor) => Math.max(0.5, sev * 4 * (1 - Math.min(0.5, (armor || 0) / 120))),
    restPerRoom: 0.35,
    fatigueMax: 10,
    fatigueRecoverPerHour: 2.5,
  };

  // ---------- LES CLASSES ----------
  GameData.HERO_CLASSES = {
    guerrier:   { id: 'guerrier',   icon: '', name: 'Guerrier',   desc: 'ouvre les portes avec la tête des autres' },
    garde:      { id: 'garde',      icon: '', name: 'Garde',      desc: 'encaisse ce que personne ne veut encaisser' },
    tireur:     { id: 'tireur',     icon: '', name: 'Tireur',     desc: 'règle les problèmes avant qu\'ils approchent' },
    mage:       { id: 'mage',       icon: '', name: 'Mage',       desc: 'lit les runes, et parfois les regrette' },
    artificier: { id: 'artificier', icon: '', name: 'Artificier', desc: 'toute serrure est une question de dosage' },
    eclaireur:  { id: 'eclaireur',  icon: '', name: 'Éclaireur',  desc: 'connaît le chemin, surtout celui du retour' },
    soigneur:   { id: 'soigneur',   icon: '', name: 'Soigneur',   desc: 'recoud, rassure, ronchonne' },
    barde:      { id: 'barde',      icon: '', name: 'Barde',      desc: 'négocie tout, y compris l\'impossible' },
    // LE GÉNÉRAL EST UNE CLASSE. Sans elle, `talentSpecs('general')`,
    // `stancesFor('general')` et toute la chaîne de refus rendent vide : son
    // onglet devient un bouton mort et son arbre affiche 0/5.
    // Vérifié : `CLASS_GEAR.general` existe déjà (plus bas dans ce fichier),
    // donc les deux boucles `for (cls in HERO_CLASSES)` de dev/smoke-general.js
    // passent sans changement.
    general:    { id: 'general',    icon: '', name: 'Général',    desc: 'il ne gagne pas les combats, il les fait gagner' },
  };

  // ---------- LES 14 HÉROS ----------
  // `base` = type d'unité dont on réutilise le sprite (pas 14 portraits à la
  // main) ; `tint` colore l'anneau du portrait ; `at` = biome où on le trouve.
  // Les stats sont celles du COMBAT, au niveau 1 (+12 % par niveau ensuite).
  //
  // `at` DOIT ÊTRE UN ID DE `DUNGEON_BIOMES` — c'est la SEULE lecture du champ
  // (state-general.js, `floorReward` : `h.at === biomeId`). Il portait encore
  // les zones du monde héritées du Front supprimé (`lisiere`, `galeries`,
  // `cote`, `ruines`, `volcan`, `astral`), qu'aucun biome du donjon ne porte :
  // l'intersection était VIDE et pas un seul compagnon n'était recrutable, dans
  // aucune partie. Mesuré avant correction : 0 héros sur 200 descentes, sur les
  // six biomes. Les six anciennes valeurs étaient déjà rangées par tier : elles
  // se lisent une à une sur les six biomes du donjon, dans le même ordre
  // (lisière→tour, galeries→grotte, côte→cristaux, ruines→champignons,
  // volcan→lave, astral→morts). Trois compagnons dans la tour, deux ou trois
  // par biome ensuite.
  const GEN_H = (id, cats, birds, cls, base, tint, at, stats, perk, talent) =>
    ({ id, name: { cats, birds }, cls, base, tint, at, stats, perk, talent,
       icon: GameData.HERO_CLASSES[cls].icon });
  GameData.HEROES = [
    GEN_H('brise', 'Brisecroc', 'Bricasse', 'guerrier', 'lancier', '#c0563e', 'tour',
      { hp: 124, dmg: 12, aspd: 1.0, mspd: 70, armor: 13, range: 0 },
      { kind: 'stat', stat: 'dmg', add: 3 },
      { kind: 'room', room: 'combat', bonus: 0.15, txt: 'cogne plus fort dans les salles de garde' }),
    GEN_H('pavois', 'Dame Pavois', 'Sire Pavois', 'garde', 'targier', '#4a7fb0', 'tour',
      { hp: 205, dmg: 7, aspd: 0.8, mspd: 56, armor: 28, range: 0 },
      { kind: 'injury', pct: 0.30 },
      { kind: 'room', room: 'elite', bonus: 0.10, txt: 'encaisse : −30 % de blessures pour la compagnie' }),
    GEN_H('vise', 'Œil-de-Vise', 'Bec-de-Vise', 'tireur', 'fronde', '#3f9b6a', 'tour',
      { hp: 86, dmg: 13, aspd: 1.15, mspd: 74, armor: 6, range: 155 },
      { kind: 'stat', stat: 'range', add: 18 },
      { kind: 'room', room: 'tresor', bonus: 0.20, txt: '+20 % de butin dans les salles au trésor' }),
    GEN_H('grimoire', 'Vieux Grimoire', 'Vieille Plume', 'mage', 'mage', '#7a52c0', 'grotte',
      { hp: 80, dmg: 17, aspd: 0.72, mspd: 60, armor: 4, range: 170 },
      { kind: 'stat', stat: 'dmg', add: 4 },
      { kind: 'room', room: 'elite', bonus: 0.20, txt: 'ses traits font mal aux élites' }),
    GEN_H('meche', 'Mèche-Courte', 'Grésil', 'artificier', 'sapeur', '#d8862a', 'grotte',
      { hp: 104, dmg: 15, aspd: 0.7, mspd: 66, armor: 11, range: 130 },
      { kind: 'loot', kindOf: 'res', pct: 0.25 },
      { kind: 'room', room: 'combat', bonus: 0.20, txt: 'ouvre les salles à l’explosif' }),
    GEN_H('boussole', 'Boussole', 'Girouette', 'eclaireur', 'eclaireur', '#c9a24a', 'grotte',
      { hp: 94, dmg: 10, aspd: 1.3, mspd: 96, armor: 7, range: 0 },
      { kind: 'speed', pct: 0.15 },
      { kind: 'room', room: 'tresor', bonus: 0.25, txt: 'trouve les réserves : +25 %' }),
    GEN_H('baume', 'Mère Baume', 'Père Baume', 'soigneur', 'soigneur', '#5fb87a', 'cristaux',
      { hp: 100, dmg: 6, aspd: 0.8, mspd: 66, armor: 9, range: 125 },
      { kind: 'heal', pct: 0.40 },
      { kind: 'room', room: 'repos', bonus: 0.50, txt: 'les feux de camp soignent deux fois mieux' }),
    GEN_H('refrain', 'Refrain', 'Ritournelle', 'barde', 'barde', '#d05a8c', 'cristaux',
      { hp: 102, dmg: 8, aspd: 0.9, mspd: 70, armor: 9, range: 110 },
      { kind: 'loot', kindOf: 'plan', pct: 0.35 },
      { kind: 'room', room: 'combat', bonus: 0.15, txt: 'son refrain porte la compagnie' }),
    GEN_H('rempart', 'Vieux Rempart', 'Grand Héron', 'garde', 'rempart', '#3a6d8f', 'cristaux',
      { hp: 240, dmg: 9, aspd: 0.75, mspd: 54, armor: 34, range: 0 },
      { kind: 'injury', pct: 0.20 },
      { kind: 'room', room: 'boss', bonus: 0.15, txt: 'tient face aux gardiens : +15 %' }),
    GEN_H('ombre', 'Patte d’Ombre', 'Aile d’Ombre', 'eclaireur', 'assassin', '#5a4a6e', 'champignons',
      { hp: 108, dmg: 19, aspd: 1.35, mspd: 100, armor: 8, range: 0 },
      { kind: 'stat', stat: 'aspd', add: 0.15 },
      { kind: 'room', room: 'elite', bonus: 0.25, txt: 'découpe les élites : +25 %' }),
    GEN_H('astre', 'Lit-les-Astres', 'Compte-Étoiles', 'mage', 'aura', '#6f7ad8', 'champignons',
      { hp: 96, dmg: 22, aspd: 0.7, mspd: 62, armor: 6, range: 180 },
      { kind: 'loot', kindOf: 'relique', pct: 0.30 },
      { kind: 'room', room: 'boss', bonus: 0.20, txt: 'lit les gardiens à livre ouvert' }),
    GEN_H('fournaise', 'Fournaise', 'Braise', 'guerrier', 'heros', '#c4452e', 'lave',
      { hp: 300, dmg: 30, aspd: 1.05, mspd: 74, armor: 24, range: 0 },
      { kind: 'stat', stat: 'dmg', add: 8 },
      { kind: 'room', room: 'boss', bonus: 0.25, txt: 'chasseur de gardiens : +25 %' }),
    GEN_H('rouages', 'Maître Rouages', 'Pic Mécano', 'artificier', 'ingenieur', '#8a8f96', 'lave',
      { hp: 190, dmg: 26, aspd: 0.85, mspd: 70, armor: 20, range: 145 },
      { kind: 'loot', kindOf: 'objet', pct: 0.30 },
      { kind: 'room', room: 'tresor', bonus: 0.25, txt: 'crochète tout : +25 %' }),
    GEN_H('chronos', 'Sablier', 'Ibis du Temps', 'mage', 'chronarque', '#c9b04a', 'morts',
      { hp: 210, dmg: 40, aspd: 0.9, mspd: 80, armor: 18, range: 200 },
      { kind: 'speed', pct: 0.25 },
      { kind: 'room', room: 'elite', bonus: 0.30, txt: 'ralentit le monde autour des élites' }),
  ];
  GameData.heroById = id => GameData.HEROES.find(h => h.id === id) || null;

  // ---------- LES BIOMES DU DONJON (descente infinie) ----------
  // Le donjon est une DESCENTE sans fin. Plus on va profond, plus le biome
  // change : tour en ruine (surface), grotte, cristaux, champignons, lave, morts.
  // Après 60 étages le cycle recommence avec un tier supérieur (plus dur, plus
  // de butin). Chaque biome dure 10 étages.
  const GEN_DB = (id, icon, cats, birds, tier, desc, decor) =>
    ({ id, icon, name: { cats, birds }, tier, desc, decor });
  GameData.DUNGEON_BIOMES = [
    GEN_DB('tour', '', 'La Tour en ruine', 'La Tour en ruine', 1,
      'Une église effondrée, porte du donjon. La lumière filtre encore.', 'tour'),
    GEN_DB('grotte', '', 'Les Grottes sombres', 'Les Grottes sombres', 2,
      'L\'humidité suinte, les parois se resserrent. On entend goutter.', 'grotte'),
    GEN_DB('cristaux', '', 'Les Cavernes de cristal', 'Les Cavernes de cristal', 3,
      'Des veines lumineuses pulsent dans la roche noire. C\'est beau et hostile.', 'cristaux'),
    GEN_DB('champignons', '', 'Le Monde des champignons', 'Le Monde des champignons', 4,
      'Des spores flottent, des lueurs bioluminescentes guident ou trompent.', 'champignons'),
    GEN_DB('lave', '', 'Les Profondeurs de lave', 'Les Profondeurs de lave', 5,
      'Le sol craque, la chaleur monte. Le butin fond ou se trempe.', 'lave'),
    GEN_DB('morts', '', 'Le Royaume des morts', 'Le Royaume des morts', 6,
      'Des ossements pavent le sol. Ce qui rampe ici n\'a plus de nom.', 'morts'),
  ];
  // retourne le biome pour un étage donné (cycle tous les 60 étages)
  GameData.dungeonBiome = function (floor) {
    const cycle = Math.floor((floor - 1) / 60);   // 0, 1, 2…
    const idx = Math.floor(((floor - 1) % 60) / 10);
    const b = GameData.DUNGEON_BIOMES[idx] || GameData.DUNGEON_BIOMES[0];
    return { base: b, cycle, tier: b.tier + cycle * 6, id: b.id, icon: b.icon,
             name: b.name, desc: b.desc, decor: b.decor };
  };
  GameData.biomeById = function (id) {
    return GameData.DUNGEON_BIOMES.find(b => b.id === id) || GameData.DUNGEON_BIOMES[0];
  };
  // coût d'une descente : vivres + rations, échelonné par le checkpoint
  GameData.descentCost = function (checkpoint, party) {
    const n = Math.max(1, (party | 0) || 1);
    const t = 1 + Math.floor((checkpoint - 1) / 10);
    const c = { food: Math.ceil(900 * Math.pow(2.4, t - 1) * n) };
    if (t >= 2) c.food_t2 = Math.ceil(4 * Math.pow(2.0, t - 2) * n);
    if (t >= 3) c.lingot_bronze = Math.ceil(2 * Math.pow(1.8, t - 3) * n);
    if (t >= 4) c.food_t3 = Math.ceil(3 * Math.pow(2.0, t - 4) * n);
    return c;
  };
  // L'APPRENTISSAGE — les premiers étages FRAPPENT moins fort.
  //
  // Le tout début de partie se joue avec un seul personnage nu : la tour tapait
  // aussi fort qu'à l'étage 30 rapporté à ce qu'on peut encaisser, et la
  // compagnie fondait avant d'avoir appris à lire une annonce de patron. La
  // rampe ne touche QUE les dégâts : les PV des ennemis, eux, ne bougent pas —
  // sinon le rendement du butin et le calcul hors écran (`farmOdds`, qui lit
  // `diff.hp`) se décaleraient d'un coup.
  //
  // `depart` = coefficient à l'étage 1 ; il remonte LINÉAIREMENT jusqu'à 1 à
  // l'étage `jusqu` — la fin du premier biome. Aucune marche : à l'entrée des
  // grottes, la rampe est éteinte et le reste du donjon est inchangé.
  // Mesuré : ×0,65 à l'étage 1, ×0,79 à l'étage 5, ×0,86 à l'étage 7, ×1 à 11.
  GameData.GEN_RAMPE_DEGATS = { jusqu: 11, depart: 0.65 };
  // difficulté d'un étage : PV et dégâts des ennemis
  GameData.floorDifficulty = function (floor) {
    const biome = GameData.dungeonBiome(floor);
    const base = Math.pow(1.18, floor - 1);
    const r = GameData.GEN_RAMPE_DEGATS;
    const doux = (r && floor < r.jusqu)
      ? r.depart + (1 - r.depart) * ((floor - 1) / (r.jusqu - 1)) : 1;
    return { hp: base * (0.8 + biome.tier * 0.25), dmg: base * (0.7 + biome.tier * 0.2) * doux,
             tier: biome.tier, biome: biome.id };
  };
  // nombre d'ennemis par étage
  /* COMBIEN D'ENNEMIS TIENT UN ÉTAGE.

     Un étage se pliait en une minute : deux à huit ennemis, trois
     vagues au plus. On descendait par à-coups, sans jamais avoir le
     temps de placer quoi que ce soit — ni un pouvoir, ni une posture,
     ni un repli. Un étage doit durer, sinon rien de ce que le joueur a
     préparé n'a l'occasion de servir.

     On vise CINQ MINUTES de combat. Le compte monte donc franchement,
     et surtout il continue de monter avec la profondeur au lieu de
     plafonner à huit dès l'étage quarante-huit.

     Le boss, lui, garde une escorte maigre : c'est LUI qu'on affronte,
     et une nuée autour de lui ne fait que cacher ses tells. */
  GameData.floorEnemyCount = function (floor, isBoss) {
    if (isBoss) return Math.min(4, 1 + Math.floor(floor / 15));
    return Math.min(26, 8 + Math.floor(floor / 3));
  };

  // ---------- LES TYPES D'ÉTAGE ----------
  // La descente est LINÉAIRE : pas de portes, pas de choix de chemin. Chaque
  // étage a un type déterminé par sa profondeur. Tous les 5 = boss, tous les
  // 10 = repos/trésor, le reste = combat.
  GameData.FLOOR_TYPES = {
    combat:  { id: 'combat',  icon: '', name: 'Salle de garde', foes: 1.0, mult: 1.0,
               desc: 'Des gardes. On passe.' },
    elite:   { id: 'elite',   icon: '', name: 'Salle d\'élite', foes: 0.7, mult: 1.9, bonus: 1.8,
               desc: 'Moins nombreux, bien plus coriaces.' },
    tresor:  { id: 'tresor',  icon: '', name: 'Salle au trésor', foes: 0.4, mult: 0.7, bonus: 2.4,
               desc: 'Une réserve mal gardée.' },
    repos:   { id: 'repos',   icon: '', name: 'Feu de camp', foes: 0, mult: 0, heal: 0.45,
               desc: 'Personne. Du repos, des bandages.' },
    boss:    { id: 'boss',    icon: '', name: 'Antre du gardien', foes: 0.4, mult: 1.0, boss: true, bonus: 2.6,
               desc: 'Quelque chose de gros vous regarde.' },
    // LES SALLES À OBJECTIF. « Tuer tout le monde » était le seul verbe du
    // donjon : cent étages du même geste. Trois autres verbes, chacun avec son
    // gabarit — `dur` est la durée à tenir, en secondes, avant le bonus d'étage.
    // HORS ÉCRAN, ces salles se FARMENT (elles ne se franchissent plus : la
    // profondeur demande d'être là — cf. `farmFloor`, state-general.js).
    // `foes` et `mult` non nuls restent obligatoires : à zéro, la salle ne
    // rapporte rien pendant une absence.
    survie:  { id: 'survie',  icon: '⏳', name: 'Tenir bon', foes: 0.8, mult: 0.9, bonus: 1.35, dur: 28,
               desc: 'Les vagues ne s\'arrêtent pas. Le temps, si.' },
    escorte: { id: 'escorte', icon: '', name: 'Le convoi', foes: 1.0, mult: 0.95, bonus: 1.45,
               desc: 'La caisse ne se défend pas. Vous, si.' },
    cristal: { id: 'cristal', icon: '', name: 'Le cristal errant', foes: 0.8, mult: 0.9, bonus: 1.5, dur: 26,
               desc: 'Restez dans sa lumière. Elle bouge.' },
    // LA CHASSE : une salle de combat ordinaire… plus un TROPHÉE — une bête
    // qui ne se bat pas et détale vers l'escalier. L'abattre avant sa sortie
    // paie une seconde part de butin (`trophee`) ; la laisser filer ne coûte
    // rien d'autre que la prime. `foes` et `mult` non nuls : hors écran elle se
    // farme comme n'importe quel combat — mais la prime du trophée, elle, ne
    // se gagne qu'en jouant (personne ne chasse à votre place).
    chasse:  { id: 'chasse',  icon: '', name: 'La chasse', foes: 0.8, mult: 0.95, bonus: 1.15, trophee: 2.2,
               desc: 'Un trophée détale vers l\'escalier. Vite.' },
  };
  GameData.roomKind = id => GameData.FLOOR_TYPES[id] || GameData.FLOOR_TYPES.combat;
  GameData.roomById = id => GameData.FLOOR_TYPES[id] || null;
  // LE TYPE D'UN ÉTAGE — déterministe, pour que deux descentes du même étage
  // donnent la même salle, et que le joueur apprenne le rythme de la tour.
  // Le boss garde ses multiples de 5 ; les objectifs s'intercalent sur des
  // périodes premières entre elles (7 et 11) pour ne jamais faire de motif.
  GameData.floorType = function (floor) {
    if (floor % 5 === 0) return 'boss';
    if (floor >= 6 && floor % 7 === 3) return 'survie';
    if (floor >= 9 && floor % 7 === 5) return 'escorte';
    if (floor >= 12 && floor % 11 === 7) return 'cristal';
    // ÉLITE, TRÉSOR, REPOS, CHASSE : les gabarits existaient, personne ne les
    // planifiait. Les règles neuves viennent APRÈS les anciennes : elles ne
    // peuvent donc réclamer que d'anciens étages « combat » — le rythme appris
    // (boss ×5, survie 17, escorte 19, cristal 29) ne bouge pas d'un cran.
    // Sur 60 étages : elite 7/16/34/43, tresor 13/22/49/58, repos 9/27/36,
    // chasse 21/37/53 — il reste 19 combats, toujours la salle dominante.
    if (floor >= 7 && floor % 9 === 7) return 'elite';
    if (floor >= 8 && floor % 9 === 4) return 'tresor';
    if (floor >= 9 && floor % 9 === 0) return 'repos';
    if (floor >= 13 && floor % 8 === 5) return 'chasse';
    return 'combat';
  };

  // ============================================================
  // L'ÉQUIPEMENT DU DONJON
  // ============================================================
  // Trois axes indépendants, et un seul chiffre au bout :
  //
  //   1. LE TIER (1 → 20) : la profondeur atteinte. ×1,55 par tier.
  //   2. LA RARETÉ (commun → légendaire) : le coup de chance. Elle multiplie
  //      la puissance ET donne des LIGNES DE STATS en plus (1 pour un commun,
  //      5 pour un légendaire).
  //   3. LA FAMILLE (épée, lance, plaque, robe…) : ce que l'objet fait, et QUI
  //      peut le porter. Un mage ne mettra jamais une plaque.
  //
  // L'ÉCHELLE EST CALÉE : le multiplicateur de rareté du légendaire vaut
  // exactement 1,55^5 — autrement dit UN LÉGENDAIRE DE TIER 1 PÈSE COMME UN
  // COMMUN DE TIER 6. Cinq tiers d'avance : assez pour qu'une belle trouvaille
  // change la descente, pas assez pour sauter un palier entier.
  GameData.ITEM_TIERS = 20;
  const GEN_TIER_STEP = 1.55;
  GameData.tierStep = () => GEN_TIER_STEP;
  // puissance brute d'un objet, avant l'échelle de sa famille
  GameData.itemPower = t => 4 * Math.pow(GEN_TIER_STEP, Math.max(1, Math.min(20, t | 0)) - 1);

  GameData.RARITIES = [
    { id: 'commun',     name: 'Commun',     icon: '', col: '#8b8378', lines: 1, mult: 1.0,  w: 100 },
    { id: 'inhabituel', name: 'Inhabituel', icon: '', col: '#4f9a52', lines: 2, mult: 1.75, w: 42 },
    { id: 'rare',       name: 'Rare',       icon: '', col: '#3d7ab8', lines: 3, mult: 3.0,  w: 15 },
    { id: 'epique',     name: 'Épique',     icon: '', col: '#8a56c0', lines: 4, mult: 5.2,  w: 5 },
    { id: 'legendaire', name: 'Légendaire', icon: '', col: '#d08a20', lines: 5, mult: 9.0,  w: 1.2 },
    /* L'UNIQUE. Six lignes de stats, mais ce n'est pas ce qui compte : une
       pièce unique DONNE UN POUVOIR à qui la porte. C'est la seule source
       d'un pouvoir qui ne vienne ni de la classe ni de l'arbre, donc la
       seule façon de sortir un personnage de son couloir. Son poids est
       volontairement dérisoire — on en trouve, pas on en collectionne. */
    { id: 'unique',     name: 'Unique',     icon: '', col: '#c2452f', lines: 6, mult: 14.0, w: 0.14 },
  ];
  GameData.rarityById = id => GameData.RARITIES.find(r => r.id === id) || GameData.RARITIES[0];

  /* ------------------------------------------------------------------
     LES PIÈCES UNIQUES

     Chacune est une pièce NOMMÉE qui accorde un pouvoir du catalogue —
     jamais un pouvoir inventé sur place : le moteur ne sait jouer que ce
     que `GameData.POWERS` déclare, et un identifiant inconnu ferait une
     pièce muette. `dev/smoke-pouvoirs.js` croise déjà les données contre
     ces tables ; on reste dans le même contrat.

     Une unique se tire dans les pièces dont l'emplacement correspond. Si
     aucune ne correspond au tirage, la rareté RETOMBE à légendaire plutôt
     que de rendre une pièce unique sans don — une unique sans pouvoir
     serait un mensonge sur l'étiquette.
     ------------------------------------------------------------------ */
  const UNQ = (id, nom, slot, don, txt) => ({ id, nom, slot, don, txt });
  GameData.UNIQUES = [
    UNQ('brisemur',  'Brise-Mur',        'arme',     'gu_fracas',
        'Le porteur frappe tout ce qui le touche.'),
    UNQ('faucheuse', 'La Faucheuse',     'arme',     'gu_tourbillon',
        'Elle tourne toute seule ; on suit.'),
    UNQ('oeildelynx','Œil-de-Lynx',      'arme',     'ti_sniper',
        'On voit où l’on tire, et de bien plus loin.'),
    UNQ('trait9',    'Le Trait Fourchu', 'arme',     'ma_fourchu',
        'Le trait se divise en chemin.'),
    UNQ('barilnoir', 'Le Baril Noir',    'arme',     'ar_baril',
        'On le pose, on s’écarte, on compte.'),
    UNQ('pavois',    'Le Pavois',        'bouclier', 'ga_pavois',
        'Derrière lui, la ligne tient.'),
    UNQ('serment',   'Serment de Pierre','armure',   'ga_serment',
        'Ce qu’il promet, il le tient jusqu’au bout.'),
    UNQ('cape9',     'Cape des Neuf',    'armure',   'ec_esquive',
        'Neuf fois on croit l’avoir touchée.'),
    UNQ('heaumecri',  'Heaume du Cri',   'casque',   'ge_cri',
        'On l’entend d’un bout à l’autre de l’étage.'),
    UNQ('bottesfumee','Bottes de Fumée', 'bottes',   'ec_fumee',
        'On part avant que le coup n’arrive.'),
    UNQ('gantsronces','Gants de Ronces', 'gants',    'so_ronces',
        'Qui les saisit le regrette.'),
    UNQ('larme',      'La Larme',        'bijou',    'so_baume',
        'Elle pleure sur les blessures des autres.'),
    UNQ('refrain',    'Le Refrain',      'bijou',    'ba_refrain',
        'On ne sait plus qui l’a commencé.'),

    /* ------------------------------------------------------------------
       LES UNIQUES D’ARCHÉTYPE

       Treize pièces ne suffisaient pas : l’arbre ouvre quatorze bosquets,
       et une voie sans pièce qui la signe reste une voie théorique. Chaque
       unique ci-dessous APPUIE un build que l’arbre rend possible —
       poison, feu, froid, foudre, ombre, nécromancie, deux mains, tank,
       paladin — au lieu d’être un palier de statistiques de plus.

       Le don reste un IDENTIFIANT du catalogue : `uniquesPour` écarte
       d’office toute pièce dont le pouvoir n’existe plus, et la rareté
       retombe alors à légendaire plutôt que de mentir sur l’étiquette.
       ------------------------------------------------------------------ */

    /* POISON — on ne frappe pas plus fort, on frappe plus longtemps */
    UNQ('dentcreuse', 'La Dent Creuse',   'arme',     'ti_venin',
        'Elle ne tue pas sur le coup. Elle ne rate jamais non plus.'),
    UNQ('fioleverte', 'La Fiole Verte',   'bijou',    'ar_acide',
        'Le bouchon est soudé. On ne l’ouvre pas, on la jette.'),

    /* FEU — ce qui brûle continue de brûler */
    UNQ('braisier',   'Le Braisier',      'arme',     'ar_gregeois',
        'On la tient par la garde, et encore, pas longtemps.'),
    UNQ('cendrier',   'Manteau de Cendre','armure',   'ma_meteore',
        'Ce qui tombe dessus n’en repart pas.'),

    /* FROID — on ne tue pas le froid, on immobilise */
    UNQ('lamegivre',  'Lame de Givre',    'arme',     'ma_givre',
        'Elle ne coupe pas : elle arrête.'),
    UNQ('coeurgel',   'Le Cœur Gelé',     'bijou',    'ma_blizzard',
        'Il bat une fois par hiver.'),

    /* FOUDRE — elle choisit son chemin toute seule */
    UNQ('fourche',    'La Fourche',       'arme',     'ma_fourchu',
        'Un coup part, trois arrivent.'),
    UNQ('paratonnerre','Le Paratonnerre', 'casque',   'ma_nova',
        'Le porter par temps clair est déjà imprudent.'),

    /* OMBRE — on frappe ce qui ne regarde pas */
    UNQ('voilenoir',  'Le Voile Noir',    'armure',   'ec_fumee',
        'On le voit surtout quand il n’est plus là.'),
    UNQ('crocombre',  'Croc d’Ombre',     'arme',     'ec_execution',
        'Il finit ce que la lumière a commencé.'),

    /* NÉCROMANCIE — ce qui est tombé n’a pas fini de servir */
    UNQ('osselet',    'L’Osselet',        'bijou',    'so_releve',
        'On le lance. Ce qui se relève ne demande pas pourquoi.'),
    UNQ('suaire',     'Le Suaire',        'armure',   'so_transfusion',
        'Il prend aux uns pour rendre aux autres, et garde sa part.'),

    /* DEUX MAINS — un seul coup, mais on ne le rejoue pas */
    UNQ('fendoir',    'Le Fendoir',       'arme',     'gu_decapitation',
        'Deux mains, et de la place autour.'),
    UNQ('massacre',   'Le Massacre',      'arme',     'gu_tourbillon',
        'On la lâche et elle continue.'),
    UNQ('harnaisdos', 'Harnais de Dos',   'armure',   'gu_dechainement',
        'Il tient les reins de ceux qui frappent trop fort.'),

    /* TANK — tenir la ligne, et la faire tenir */
    UNQ('ancre',      'L’Ancre',         'bottes',   'ga_ancrage',
        'On ne le déplace pas. On contourne.'),
    UNQ('cridefer',   'Cri de Fer',       'casque',   'ga_provoc',
        'Tout le monde se retourne. C’est le but.'),
    UNQ('halte',      'La Halte',         'bouclier', 'ga_halte',
        'Ce qui arrive là s’arrête là.'),

    /* PALADIN — ce qu’on protège vaut ce qu’on frappe */
    UNQ('jugement',   'Le Jugement',      'arme',     'ga_jugement',
        'Elle ne tranche pas la question : elle la clôt.'),
    UNQ('sanctuaire', 'Le Sanctuaire',    'bouclier', 'so_sanctuaire',
        'Derrière, on souffle. Devant, non.'),
    UNQ('mainsjointes','Mains Jointes',   'gants',    'so_baume',
        'Elles recousent plus vite qu’elles ne frappent.'),

    /* MOBILITÉ ET SOUTIEN — le reste de l’anneau */
    UNQ('talonvif',   'Talon Vif',        'bottes',   'ec_crochet',
        'Il part avant que le coup arrive, et revient après.'),
    UNQ('cormarche',  'Cor de Marche',    'bijou',    'ba_marche',
        'On marche plus vite en l’entendant. On ne sait pas pourquoi.'),
    UNQ('etendard',   'Le Vieil Étendard','armure',   'ge_etendard',
        'Il a été porté par quelqu’un qui n’est pas rentré.'),
    UNQ('oeilrepere', 'L’Œil qui Repère', 'casque',  'ec_reperage',
        'Il voit ce qui brille avant ce qui mord.'),
];
  /* On ne garde que les dons que le moteur sait jouer : une table de
     pouvoirs remaniée ne doit pas laisser d'unique muette derrière elle. */
  GameData.uniquesPour = function (slot) {
    const P = GameData.POWERS || {};
    return GameData.UNIQUES.filter(u => u.slot === slot && P[u.don]);
  };

  // ---------- LES FAMILLES D'ARMES ----------
  // `stat` = ce que la ligne PRINCIPALE de l'arme pousse ; `scale` convertit la
  // puissance brute dans l'unité de cette stat (on n'ajoute pas « +39 » à une
  // vitesse d'attaque). `deuxMains` interdit le bouclier.
  const GEN_WF = (id, icon, cats, birds, stat, scale, extra) =>
    Object.assign({ id, icon, name: { cats, birds }, stat, scale }, extra || {});
  GameData.WEAPON_FAMS = {
    epee:     GEN_WF('epee',     '', 'Épée',        'Épée',           'dmg',   1.00),
    hache:    GEN_WF('hache',    '', 'Hache',        'Hache',          'dmg',   1.45, { deuxMains: 1 }),
    lance:    GEN_WF('lance',    '', 'Lance',        'Pique',          'dmg',   1.15, { portee: 1 }),
    masse:    GEN_WF('masse',    '', 'Masse',        'Marteau',        'dmg',   1.30),
    dagues:   GEN_WF('dagues',   '', 'Dagues',       'Serres jumelles','aspd',  0.038, { deuxMains: 1 }),
    arc:      GEN_WF('arc',      '', 'Arc',          'Arc de plume',   'range', 5.0,  { deuxMains: 1, tir: 1 }),
    arbalete: GEN_WF('arbalete', '', 'Arbalète',     'Arbalète',       'dmg',   1.20, { deuxMains: 1, tir: 1 }),
    baton:    GEN_WF('baton',    '', 'Bâton runique','Branche runique','dmg',   1.10, { deuxMains: 1, tir: 1 }),
    sceptre:  GEN_WF('sceptre',  '', 'Sceptre',      'Sceptre',        'hp',    6.5),
    bombe:    GEN_WF('bombe',    '', 'Bombes',       'Bombes',         'dmg',   1.25, { tir: 1 }),
  };
  // ---------- LES FAMILLES D'ARMURE ----------
  // La famille décide de la stat que POUSSENT casque, armure, gants et bottes.
  GameData.ARMOR_FAMS = {
    plaque: { id: 'plaque', icon: '', name: { cats: 'Plaque', birds: 'Plaque' }, stat: 'armor', scale: 1.00 },
    maille: { id: 'maille', icon: '', name: { cats: 'Maille', birds: 'Maille' }, stat: 'armor', scale: 0.70 },
    cuir:   { id: 'cuir',   icon: '', name: { cats: 'Cuir',   birds: 'Cuir' },   stat: 'mspd',  scale: 1.90 },
    robe:   { id: 'robe',   icon: '', name: { cats: 'Robe',   birds: 'Étole' },  stat: 'hp',    scale: 7.5 },
  };
  GameData.famOf = id => GameData.WEAPON_FAMS[id] || GameData.ARMOR_FAMS[id] || null;

  // ---------- QUI PORTE QUOI ----------
  // La règle du mode : une classe a SES armes et SES armures. Un tireur ne
  // met pas de plaque, un mage ne prend pas la hache. C'est ce qui donne du
  // sens à un butin — sinon on ramasse tout et on équipe le plus gros chiffre.
  GameData.CLASS_GEAR = {
    guerrier:   { armes: ['epee', 'hache'],        armures: ['plaque', 'maille'], bouclier: 1 },
    garde:      { armes: ['lance', 'masse'],       armures: ['plaque'],           bouclier: 1 },
    tireur:     { armes: ['arc', 'arbalete'],      armures: ['cuir', 'maille'] },
    mage:       { armes: ['baton'],                armures: ['robe'] },
    artificier: { armes: ['bombe', 'arbalete'],    armures: ['cuir', 'maille'] },
    eclaireur:  { armes: ['dagues', 'arc'],        armures: ['cuir'] },
    soigneur:   { armes: ['sceptre', 'baton'],     armures: ['robe'] },
    barde:      { armes: ['dagues', 'epee'],       armures: ['cuir'] },
    // le Général est polyvalent, mais pas universel
    general:    { armes: ['epee', 'lance', 'masse'], armures: ['plaque', 'maille'], bouclier: 1 },
  };
  GameData.gearOf = cls => GameData.CLASS_GEAR[cls] || GameData.CLASS_GEAR.general;

  // ---------- LES EMPLACEMENTS ----------
  // 7 depuis la refonte : le BOUCLIER est arrivé avec les familles d'armes
  // (une main libre, ça se mérite — les armes à deux mains l'interdisent).
  GameData.ITEM_SLOTS = ['casque', 'armure', 'arme', 'bouclier', 'gants', 'bottes', 'bijou'];

  // ---------- LE CATALOGUE ----------
  // Engendré depuis les familles : une pièce par (emplacement × famille). Pas
  // de liste à la main à tenir à jour quand on ajoute une famille.
  GameData.ITEM_BASES = (function () {
    const out = [];
    const PIECES = {
      casque: { cats: ['Heaume', 'Coiffe de maille', 'Capuche', 'Chaperon'], birds: ['Heaume', 'Coiffe de maille', 'Capuche', 'Chaperon'], icon: ['', '', '', ''], part: 0.55 },
      armure: { cats: ['Cuirasse', 'Haubert', 'Veste', 'Robe'], birds: ['Plastron', 'Haubert', 'Veste', 'Étole'], icon: ['', '', '', ''], part: 1.0 },
      gants:  { cats: ['Gantelets', 'Mitons', 'Mitaines', 'Manchettes'], birds: ['Serres ferrées', 'Mitons', 'Mitaines', 'Manchettes'], icon: ['', '', '', ''], part: 0.45 },
      bottes: { cats: ['Grèves', 'Chausses', 'Bottes', 'Chaussons'], birds: ['Grèves', 'Chausses', 'Bottes', 'Chaussons'], icon: ['', '', '', ''], part: 0.5 },
    };
    const FAMS = ['plaque', 'maille', 'cuir', 'robe'];
    // armes
    for (const id in GameData.WEAPON_FAMS) {
      const f = GameData.WEAPON_FAMS[id];
      out.push({ id: 'arme_' + id, slot: 'arme', fam: id, icon: f.icon,
                 cats: f.name.cats, birds: f.name.birds, stat: f.stat, scale: f.scale });
    }
    // bouclier (toujours de la famille plaque)
    out.push({ id: 'bouclier', slot: 'bouclier', fam: 'plaque', icon: '',
               cats: 'Bouclier', birds: 'Pavois', stat: 'armor', scale: 0.85 });
    // pièces d'armure : 4 emplacements × 4 familles
    for (const slot in PIECES) {
      const P = PIECES[slot];
      FAMS.forEach(function (fam, i) {
        const F = GameData.ARMOR_FAMS[fam];
        out.push({ id: slot + '_' + fam, slot, fam, icon: P.icon[i],
                   cats: P.cats[i], birds: P.birds[i], stat: F.stat, scale: F.scale * P.part });
      });
    }
    // bijoux : sans famille, tout le monde peut
    out.push({ id: 'bijou_amulette', slot: 'bijou', fam: null, icon: '', cats: 'Amulette',  birds: 'Pendentif',    stat: 'hp',    scale: 6.0 });
    out.push({ id: 'bijou_anneau',   slot: 'bijou', fam: null, icon: '', cats: 'Anneau',    birds: 'Bague',        stat: 'dmg',   scale: 0.7 });
    out.push({ id: 'bijou_fetiche',  slot: 'bijou', fam: null, icon: '', cats: 'Fétiche',   birds: 'Grigri',       stat: 'armor', scale: 0.6 });
    out.push({ id: 'bijou_lunette',  slot: 'bijou', fam: null, icon: '', cats: 'Longue-vue',birds: 'Longue-vue',   stat: 'range', scale: 4.0 });
    return out;
  })();
  GameData.baseById = id => GameData.ITEM_BASES.find(b => b.id === id) || null;

  /* ------------------------------------------------------------------
     CE QU'ON PEUT PORTER AVEC CE QU'ON TIENT

     Trois façons de se battre, trois façons de s'habiller. Ce n'est pas
     une contrainte gratuite : c'est ce qui fait qu'un personnage EST
     quelque chose. Un chat en plaque avec un arc n'est ni un tireur ni un
     homme d'armes — c'est un tas d'objets. On tranche donc :

       le corps à corps se protège    -> plaque, ou maille pour qui court
       le tir s'allège                -> cuir
       la magie n'a que l'étoffe      -> robe

     La VOIE se lit sur l'arme tenue, pas sur une classe : c'est ce qu'on
     met dans les mains qui décide, et l'on peut en changer.
     ------------------------------------------------------------------ */
  GameData.VOIE_ARME = {
    epee: 'corps', hache: 'corps', lance: 'corps', masse: 'corps', dagues: 'corps',
    arc: 'distance', arbalete: 'distance', bombe: 'distance',
    baton: 'magie', sceptre: 'magie',
  };
  GameData.VOIE_ARMURE = {
    corps:    ['plaque', 'maille'],
    distance: ['cuir'],
    magie:    ['robe'],
  };
  GameData.VOIE_NOM = { corps: 'corps à corps', distance: 'tir', magie: 'magie' };
  /* La voie de l'arme tenue. Sans arme, aucune contrainte : on s'habille
     comme on veut tant qu'on n'a rien choisi. */
  GameData.voieDe = function (item) {
    if (!item) return null;
    const b = GameData.baseById(item.base);
    const fam = (b && b.fam) || item.fam;
    return (fam && GameData.VOIE_ARME[fam]) || null;
  };
  /* La famille d'armure d'une pièce de protection, s'il y en a une. */
  GameData.famArmure = function (item) {
    if (!item) return null;
    const b = GameData.baseById(item.base);
    const fam = (b && b.fam) || item.fam;
    return (GameData.VOIE_ARMURE.corps.concat(
            GameData.VOIE_ARMURE.distance, GameData.VOIE_ARMURE.magie)
           ).indexOf(fam) >= 0 ? fam : null;
  };
  GameData.armureVaPour = function (voie, fam) {
    if (!voie || !fam) return true;
    return (GameData.VOIE_ARMURE[voie] || []).indexOf(fam) >= 0;
  };

  // une classe peut-elle porter cette pièce ? → null si oui, un motif sinon
  GameData.equipRefus = function (cls, item) {
    if (!item) return 'rien à porter';
    const b = GameData.baseById(item.base);
    if (!b) return 'pièce inconnue';
    const G = GameData.gearOf(cls);
    if (b.slot === 'arme') {
      if (G.armes.indexOf(b.fam) < 0) {
        const noms = G.armes.map(f => GameData.WEAPON_FAMS[f].name.cats.toLowerCase());
        return 'ne manie que : ' + noms.join(', ');
      }
      return null;
    }
    if (b.slot === 'bouclier') {
      if (!G.bouclier) return 'ne porte pas de bouclier';
      return null;
    }
    if (b.fam) {
      if (G.armures.indexOf(b.fam) < 0) {
        const noms = G.armures.map(f => GameData.ARMOR_FAMS[f].name.cats.toLowerCase());
        return 'ne s’équipe qu’en : ' + noms.join(', ');
      }
      return null;
    }
    return null;                       // bijou : universel
  };
  // une arme à deux mains condamne le bouclier
  GameData.armeDeuxMains = item => {
    const b = item && GameData.baseById(item.base);
    return !!(b && b.slot === 'arme' && GameData.WEAPON_FAMS[b.fam] && GameData.WEAPON_FAMS[b.fam].deuxMains);
  };

  // ---------- LES LIGNES DE STATS ----------
  // La première ligne vient de la famille. Les suivantes sont tirées ici : plus
  // c'est rare, plus il y en a. `scale` ramène la puissance brute dans l'unité
  // de la stat, `part` dit quelle fraction de la puissance la ligne emporte
  // (une ligne secondaire pèse moins que la principale).
  const GEN_LN = (id, stat, icon, name, scale, part, pct) => ({ id, stat, icon, name, scale, part, pct: !!pct });
  GameData.ITEM_LINES = [
    GEN_LN('l_hp',    'hp',     '', 'points de vie',      5.5,   0.55),
    GEN_LN('l_dmg',   'dmg',    '', 'dégâts',             0.55,  0.55),
    GEN_LN('l_armor', 'armor',  '', 'armure',            0.55,  0.55),
    GEN_LN('l_aspd',  'aspd',   '', 'vitesse d’attaque',  0.022, 0.5),
    GEN_LN('l_mspd',  'mspd',   '', 'vitesse',            1.3,   0.5),
    GEN_LN('l_range', 'range',  '', 'portée',             3.0,   0.5),
    // lignes spéciales : elles plafonnent, sinon elles cassent le jeu
    GEN_LN('l_vamp',  'lifesteal', '', 'vol de vie',      0.0016, 1, 1),
    /* LA PERFORATION N'ETAIT PAS UNE FRACTION. Elle est declaree sans le
       drapeau `pct`, donc `lineValue` ne lui appliquait aucun plafond : au
       tier 20 en unique elle sortait a 13 888, c'est-a-dire qu'une seule
       piece annulait toute armure du jeu. C'est bien une part de l'armure
       ignoree, donc une fraction — et l'echelle descend en consequence. */
    GEN_LN('l_perce', 'armorPen',  '', 'perforation',   0.006,  1, 1),
    GEN_LN('l_butin', 'lootPct',   '', 'butin',           0.0022, 1, 1),
    GEN_LN('l_trouv', 'itemPct',   '', 'trouvaille',      0.0018, 1, 1),
    GEN_LN('l_chance','rarePct',   '', 'chance',          0.0014, 1, 1),
    GEN_LN('l_feu',   'resFire',     '', 'résistance au feu',    0.003, 1, 1),
    GEN_LN('l_froid', 'resCold',     '', 'résistance au froid',  0.003, 1, 1),
    GEN_LN('l_poison','resPoison',   '', 'résistance au poison', 0.003, 1, 1),
    GEN_LN('l_foudre','resLightning','', 'résistance à la foudre', 0.003, 1, 1),
    GEN_LN('l_ombre', 'resShadow',   '', "résistance à l'ombre",  0.003, 1, 1),
    GEN_LN('l_resmag','resMagic',    '', 'résistance magique',     0.003, 1, 1),
    /* LE BOUCLIER : une reserve plate, et sa recharge. */
    GEN_LN('l_esh',   'esh',      '', "bouclier d'énergie",       4.2,   0.55),
    GEN_LN('l_eshreg','eshRegen', '', 'recharge du bouclier',      0.35,  0.5),
    /* LES PENETRATIONS : elles ignorent une part de la defense d'en face.
       Deux, parce qu'il y a deux defenses — l'armure et la resistance. */
    GEN_LN('l_permag','magicPen', '', 'pénétration magique',       0.055, 1, 1),
    /* LE CRITIQUE. La chance de le declencher, et ce qu'il ajoute. */
    GEN_LN('l_crit',  'critChance','', 'chance de critique',       0.0022, 1, 1),
    GEN_LN('l_critd', 'critMult',  '', 'dégâts critiques',         0.010,  1, 1),
    /* LA VITESSE EN POURCENTAGE. Elle existait en plat (`mspd`), ce qui
       ne suffit pas : un plat de plus ne se sent plus quand la base a
       monte. Mais elle se PLAFONNE durement — voir LINE_CAP. */
    GEN_LN('l_haste', 'mspdPct',  '', 'vitesse de déplacement',    0.0016, 1, 1),
  ];
  GameData.lineById = id => GameData.ITEM_LINES.find(l => l.id === id) || null;
  // les stats en pourcentage sont BORNÉES : un vol de vie de 300 %, non.
  /* LES PLAFONDS.

     LA VITESSE DE DEPLACEMENT est le cas qui compte. +50 %, c'est deja
     enorme : le personnage traverse l'arene avant que la vague soit
     posee, sort de toutes les zones, et le combat cesse d'exister. On la
     bride donc a la moitie, et c'est le plafond le plus bas de la table.

     LES RESISTANCES tiennent a 75 % : au-dela on devient insensible a un
     element entier, et l'ennemi qui le porte n'a plus rien a dire.

     LES PENETRATIONS aussi, pour la raison inverse : passer 100 % de
     l'armure d'en face rendrait toute defense decorative. `armorPen`
     n'etait PAS plafonnee — c'etait un trou, deux lignes epiques
     suffisaient a l'annuler.

     LE CRITIQUE : la chance monte a 75 % (un critique garanti n'est plus
     un critique, c'est un degat de base), le multiplicateur a +300 %. */
  GameData.LINE_CAP = {
    lifesteal: 0.35, lootPct: 1.5, itemPct: 1.2, rarePct: 0.8,
    resFire: 0.75, resCold: 0.75, resPoison: 0.75, resLightning: 0.75,
    resShadow: 0.75, resMagic: 0.75,
    armorPen: 0.75, magicPen: 0.75,
    critChance: 0.75, critMult: 3.0,
    mspdPct: 0.50,
  };
  GameData.lineValue = function (line, tier, rarityId) {
    const R = GameData.rarityById(rarityId);
    const v = GameData.itemPower(tier) * R.mult * line.scale * line.part;
    if (line.pct) return Math.min(GameData.LINE_CAP[line.stat] || 9, Math.round(v * 1000) / 1000);
    if (line.stat === 'aspd') return Math.round(v * 100) / 100;
    return Math.max(1, Math.round(v));
  };
  GameData.lineFmt = function (line, val) {
    if (line.pct) return '+' + Math.round(val * 100) + ' % ' + line.name;
    return '+' + val + ' ' + line.name;
  };
  // valeur de la ligne PRINCIPALE (celle de la famille)
  GameData.itemValue = function (baseId, tier, rarityId) {
    const b = GameData.baseById(baseId);
    if (!b) return 0;
    const R = GameData.rarityById(rarityId);
    const v = GameData.itemPower(tier) * R.mult * (b.scale || 1);
    return b.stat === 'aspd' ? Math.round(v * 100) / 100 : Math.max(1, Math.round(v));
  };

  // ---------- LE BUTIN CHANGE TOUS LES 5 ÉTAGES ----------
  // Un bloc de 5 étages = un palier de tier. Au début du bloc il reste du
  // palier précédent, à la fin le suivant commence à pointer. Étage 1 : 100 %
  // de tier 1. Étage 5 : 90 % de tier 1, 10 % de tier 2. Étage 6 : 25 % de
  // tier 1, 75 % de tier 2. Et ainsi de suite jusqu'au tier 20.
  GameData.lootTierMix = function (floor) {
    const f = Math.max(1, floor | 0);
    const bloc = Math.floor((f - 1) / 5);
    const dans = ((f - 1) % 5) / 4;                       // 0 au début du bloc, 1 à la fin
    const t = Math.min(GameData.ITEM_TIERS, bloc + 1);
    const mix = {};
    const pBas = t > 1 ? 0.25 * (1 - dans) : 0;
    const pHaut = t < GameData.ITEM_TIERS ? 0.10 * dans : 0;
    if (pBas > 0.001) mix[t - 1] = Math.round(pBas * 1000) / 1000;
    mix[t] = Math.round((1 - pBas - pHaut) * 1000) / 1000;
    if (pHaut > 0.001) mix[t + 1] = Math.round(pHaut * 1000) / 1000;
    return mix;
  };
  GameData.rollTier = function (floor, rng) {
    const mix = GameData.lootTierMix(floor);
    let r = (rng ? rng() : Math.random());
    for (const t in mix) { r -= mix[t]; if (r <= 0) return parseInt(t, 10); }
    return parseInt(Object.keys(mix)[0], 10);
  };
  // la rareté s'améliore avec la profondeur, et avec la stat « chance »
  GameData.rollRarity = function (floor, chance, rng) {
    const prof = 1 + Math.min(3, Math.max(0, (floor | 0) - 1) * 0.03);
    const luck = 1 + Math.max(0, chance || 0);
    let tot = 0;
    const w = GameData.RARITIES.map(function (R, i) {
      const k = R.w * (i === 0 ? 1 : Math.pow(prof * luck, i * 0.75));
      tot += k;
      return k;
    });
    let r = (rng ? rng() : Math.random()) * tot;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return GameData.RARITIES[i].id; }
    return 'commun';
  };

  // ---------- LES RELIQUES (bonus permanents, slots limités) ----------
  // Posées au QG. Le nombre de socles est volontairement PETIT : c'est là que
  // le joueur doit renoncer à quelque chose.
  GameData.RELIC_SLOTS = lvl => Math.min(5, 1 + Math.floor(Math.max(0, lvl) / 7));
  const GEN_RL = (id, icon, cats, birds, tier, effect, txt) =>
    ({ id, icon, name: { cats, birds }, tier, effect, txt });
  GameData.RELICS = [
    GEN_RL('gamelle',  '', 'Gamelle sans fond',     'Mangeoire sans fond',   1, { kind: 'gen', res: 'food', pct: 0.10 }, '+10 % de production de nourriture'),
    GEN_RL('pelote',   '', 'Pelote éternelle',      'Brindille éternelle',   1, { kind: 'gen', res: 'mat1', pct: 0.10 }, '+10 % de production de matériau 1'),
    GEN_RL('sifflet',  '', 'Sifflet du contremaître', 'Sifflet du contremaître', 1, { kind: 'work', pct: 0.12 }, '+12 % à l\'effet des ouvriers'),
    GEN_RL('enclume',  '', 'Enclume miniature',     'Enclume miniature',     2, { kind: 'speed', domain: 'forge', pct: 0.15 }, '−15 % de temps aux lignes de forge'),
    GEN_RL('lanterne', '', 'Lanterne du fond',      'Lanterne du fond',      2, { kind: 'mine', pct: 0.20 }, '+20 % de vitesse de creusement'),
    GEN_RL('marmite',  '', 'Marmite qui n\'attend pas', 'Marmite qui n\'attend pas', 2, { kind: 'speed', domain: 'cuisine', pct: 0.15 }, '−15 % de temps de cuisine'),
    GEN_RL('sablier',  '⏳', 'Sablier fêlé',          'Sablier fêlé',          3, { kind: 'speed', domain: 'dojo', pct: 0.18 }, '−18 % de temps aux pistes du Dojo'),
    GEN_RL('oeuf',     '', 'Œuf qui ne casse pas',  'Œuf qui ne casse pas',  3, { kind: 'hatch', pct: 0.20 }, '+20 % de vitesse d\'éclosion'),
    GEN_RL('boussole', '', 'Boussole tordue',       'Boussole tordue',       3, { kind: 'expl', pct: 0.20 }, '−20 % de durée d\'exploration'),
    GEN_RL('graal',    '', 'Écuelle d\'or',         'Coupe d\'or',           4, { kind: 'gen', res: 'all', pct: 0.08 }, '+8 % sur TOUTE la production'),
    GEN_RL('etendard', '', 'Étendard rapiécé',      'Étendard rapiécé',      4, { kind: 'battle', pct: 0.12 }, '+12 % de PV et dégâts en bataille'),
    GEN_RL('creuset',  '', 'Creuset qui ne refroidit pas', 'Creuset qui ne refroidit pas', 4, { kind: 'foundry', pct: 0.25 }, '+25 % de rendement de fonderie'),
    GEN_RL('couronne', '', 'Couronne cabossée',     'Couronne cabossée',     5, { kind: 'gen', res: 'all', pct: 0.15 }, '+15 % sur TOUTE la production'),
    GEN_RL('coeur',    '', 'Cœur de la faille',     'Cœur de la faille',     5, { kind: 'expl', pct: 0.35 }, '−35 % de durée d\'exploration'),
    GEN_RL('meridien', '', 'Méridien brisé',        'Méridien brisé',        5, { kind: 'work', pct: 0.25 }, '+25 % à l\'effet des ouvriers'),
    GEN_RL('astrolabe', '', 'Astrolabe fendu',      'Astrolabe fendu',       5, { kind: 'loot', pct: 0.30 }, '+30 % de butin d\'exploration'),
  ];
  GameData.relicById = id => GameData.RELICS.find(r => r.id === id) || null;

  // ---------- LES PLANS (ce que l'exploration débloque AILLEURS) ----------
  // C'est le levier d'interdépendance le plus fort : ces recettes n'existent
  // QUE si le Général les rapporte.
  const GEN_PL = (id, icon, cats, birds, tier, target, txt) =>
    ({ id, icon, name: { cats, birds }, tier, target, txt });
  GameData.PLANS = [
    GEN_PL('p_etai',    '', 'Plan : étai renforcé',      'Plan : étai renforcé',      1, { kind: 'mine', what: 'etaiCheap' },   'Les étais coûtent 30 % de moins'),
    GEN_PL('p_ration',  '', 'Recette : ration de marche', 'Recette : ration de marche', 1, { kind: 'kitchen', what: 'ration' },  'Débloque la ration de marche à la Cuisine'),
    GEN_PL('p_alliage', '', 'Plan : alliage de cuivre',  'Plan : alliage de cuivre',  1, { kind: 'foundry', what: 'alliage' },  '+1 lingot par coulée de cuivre'),
    GEN_PL('p_trempe',  '', 'Plan : trempe rapide',      'Plan : trempe rapide',      2, { kind: 'forge', what: 'trempe' },     '−12 % de temps sur toutes les lignes de forge'),
    GEN_PL('p_distil',  '', 'Formule : distillat clair', 'Formule : distillat clair', 2, { kind: 'alambic', what: 'clair' },    '+20 % de rendement des fioles'),
    GEN_PL('p_semis',   '', 'Plan : semis serré',        'Plan : semis serré',        2, { kind: 'gen', what: 'semis' },        '+10 % sur les générateurs de matériau'),
    GEN_PL('p_agres',   '', 'Plan : agrès de fortune',   'Plan : agrès de fortune',   3, { kind: 'dojo', what: 'agres' },       'Les agrès du Dojo coûtent 25 % de moins'),
    GEN_PL('p_poudre',  '', 'Formule : poudre stable',   'Formule : poudre stable',   3, { kind: 'alambic', what: 'poudre' },   '+30 % de poudre par cycle'),
    GEN_PL('p_couvee',  '', 'Plan : couvée double',      'Plan : couvée double',      3, { kind: 'hatch', what: 'double' },     '+15 % de vitesse de couvaison'),
    GEN_PL('p_haut',    '', 'Plan : haut fourneau',      'Plan : haut fourneau',      4, { kind: 'foundry', what: 'haut' },     '−25 % de temps de coulée'),
    GEN_PL('p_arcane',  '', 'Formule : liant arcane',    'Formule : liant arcane',    4, { kind: 'alambic', what: 'arcane' },   'Débloque le fil arcane sans catalyseur'),
    GEN_PL('p_sceau',   '', 'Plan : sceau de guerre',    'Plan : sceau de guerre',    5, { kind: 'war', what: 'sceau' },        '+20 % à l\'ingénierie de bataille'),
  ];
  GameData.planById = id => GameData.PLANS.find(p => p.id === id) || null;


  // ============================================================
  // L'AVENTURE — LE COMBAT TACTIQUE
  // Une salle de combat n'est plus un jet de dés : c'est une ARÈNE. Le groupe
  // s'y déplace au clic, frappe, lance ses capacités ; les boss dessinent au sol
  // des zones qu'il faut quitter à temps. Le mode AUTO confie tout ça à l'IA —
  // le jeu reste jouable en idle, c'est le contrat de l'onglet.
  // ============================================================

  // ============================================================
  // LE VOCABULAIRE DES POUVOIRS — des listes FERMÉES.
  // Un pouvoir ne peut déclarer que ce que le moteur joue vraiment. Avant, les
  // données annonçaient 92 `proc` distincts dont l'arène n'en lisait que 3, et
  // 19 `mod` de capacité dont un seul : la moitié de l'arbre de talents était
  // une promesse écrite. La réponse n'est pas d'en implémenter 92, c'est de
  // FERMER le vocabulaire — et de refuser en données tout ce qui n'est pas là.
  // `dev/smoke-pouvoirs.js` (bloquant) croise les données contre ces tables.
  // ============================================================

  // COMMENT un pouvoir se joue. Un `kind` hors de cette liste = pouvoir muet.
  GameData.POWER_KINDS = { aoe_self: 1, aoe_point: 1, bolt: 1, line: 1, heal: 1,
                           buff_party: 1, buff_self: 1, taunt: 1, rally: 1,
                           field: 1, dash: 1 };
  // CE QU'IL FAIT, pour l'IA : c'est là-dessus que la posture pondère (`pol.prio`).
  GameData.POWER_TAGS  = { degats: 1, zone: 1, controle: 1, soin: 1,
                           bouclier: 1, mobilite: 1, buff: 1, debuff: 1 };
  // QUI viser (`ia.veut` d'un pouvoir, `pol.cible` d'une posture).
  GameData.IA_VEUT     = { proche: 1, groupe: 1, arriere: 1, faible: 1,
                           menace: 1, blesse: 1, soi: 1 };
  // LES CLÉS DE LA CARTE DE BUFFS (`e.buffs`) — une seule boucle d'expiration
  // dans l'arène, les deux camps. Toute valeur est une FRACTION ADDITIVE
  // (spd: 0,9 = +90 % de vitesse), sauf `abs` (points absorbés) et les deux
  // drapeaux bornés `invuln` / `immuneStun`.
  GameData.BUFF_KEYS   = { dmg: 1, aspd: 1, spd: 1, armor: 1, dodge: 1, dr: 1,
                           abs: 1, invuln: 1, immuneStun: 1, recv: 1,
                           armorPct: 1, heal_recv: 1 };
  // LES PROCS, par POINT D'ACCROCHE. La lettre dit OÙ l'arène les lit :
  //   A coup porté · B coup reçu · C un ennemi meurt · D périodique ·
  //   E début de salle · G soin émis.
  // Règle d'arbitrage : un « proc » qui porte un `cd:` est en réalité un
  // POUVOIR (recharge, événement visible, bouton) — il devient une entrée de
  // `POWERS`, pas une entrée d'ici.
  GameData.PROC_KINDS = {
    // A — au moment où un membre de la compagnie porte un coup
    crit: 'A', critmult: 'A', execute: 'A', lowhp_dmg: 'A', backstab: 'A',
    vs_slow: 'A', vs_burn: 'A', penetrate: 'A', double: 'A', poison: 'A',
    burn: 'A', bleed: 'A', slow: 'A', puncture: 'A', mark: 'A', push: 'A',
    // B — au moment où il en reçoit un
    dodge: 'B', undying: 'B', riposte: 'B', thorns: 'B', wear: 'B', secondwind: 'B',
    // C — un ennemi tombe
    frenzy: 'C', rally_kill: 'C',
    // D — au fil du temps
    regen: 'D',
    // E — à l'entrée dans la salle
    speech: 'E',
    // G — dans l'entonnoir de soin
    crit_heal: 'G',
  };
  // LES MODS DE CAPACITÉ : ce qu'un nœud d'arbre a le droit de retoucher sur un
  // pouvoir. `scalaire` = multiplié par (1 + pct) ; `drapeau` = posé à `pct`
  // (ou 1). Tout le reste décrit un CHAMP du pouvoir, donc appartient à sa
  // définition, pas à une modification.
  GameData.ABILITY_MODS = {
    cd: 'scalaire', radius: 'scalaire', mult: 'scalaire', dur: 'scalaire',
    len: 'scalaire', heal: 'scalaire', dmg: 'scalaire', pct: 'scalaire',
    spd: 'scalaire', range: 'scalaire', w: 'scalaire', tick: 'scalaire',
    chain: 'drapeau', spread: 'drapeau', splash: 'drapeau', cleanse: 'drapeau',
  };
  // COMBIEN DE POUVOIRS UN PERSONNAGE PORTE EN MÊME TEMPS : 1 de classe + 4
  // d'arbre. Ce n'est pas arbitraire — la colonne de portrait fait 170 px et
  // l'arbre, coûts et exclusions compris, n'en accorde pas davantage.
  GameData.POWER_SLOTS = 5;

  // ============================================================
  // LE CATALOGUE DES POUVOIRS — la source unique.
  // Une capacité de classe et un pouvoir d'arbre sont LA MÊME CHOSE : seule
  // change la façon de l'obtenir. Tout le reste du jeu ne cite qu'un `id`
  // (jamais un objet inliné : un pouvoir inliné dans un nœud d'arbre ne peut
  // être ni partagé, ni corrigé en un endroit, ni re-résolu au rechargement
  // d'une sauvegarde).
  //
  // 72 POUVOIRS : 9 classes × 8. Pour chaque classe, dans l'ordre :
  //   la CAPACITÉ DE CLASSE (offerte, slot 0), le pouvoir PRÉCOCE (tier 2 d'une
  //   branche), les deux paires exclusives (groupes `<cls>_a` et `<cls>_b`,
  //   tier 4) et les deux pouvoirs de VOIE (tier 3 des deux spécialisations).
  //   Un personnage en porte 5 au plus (`POWER_SLOTS`).
  //
  // `kind` dit comment le pouvoir se joue :
  //   aoe_self  : autour du lanceur, sans visée
  //   aoe_point : visée au sol (le clic suivant choisit l'endroit)
  //   bolt      : trait sur une CIBLE      · line : rayon qui traverse
  //   field     : une zone qui DURE        · dash : un bond
  //   heal / buff_party / buff_self / taunt / rally : effet immédiat
  // `cible` décide si le tir MANUEL passe en visée : 'soi' part tout de suite,
  // 'sol' et 'ennemi' attendent le clic suivant.
  // `ia.quand` : toutes les conditions déclarées sont en ET ; absentes, le
  // pouvoir part dès qu'il est prêt. `ia.motif` est la phrase montrée au joueur
  // quand la jauge est pleine et que rien ne part — la frustration n°1 d'un
  // mode auto.
  // ============================================================
  // NOTE DE PORTÉE : les fichiers du moteur PARTAGENT la portée lexicale (un
  // `const` de data-units.js est visible ici). D'où `GEN_PW` et non `PW`, déjà
  // pris par les pouvoirs d'unités (data-units.js) — un doublon planterait le
  // chargement du jeu, sans message.
  // `ia.prio` (0-100) départage deux pouvoirs prêts en même temps, AVANT que la
  // posture ne pondère par tag. Le barème tient en quatre paliers — l'écart
  // reste du même ordre que les poids de posture (0,4 à 2,2), sinon la posture
  // ne déciderait plus rien :
  //   70 le SAUVETAGE (conditionné à `hpSoi`/`hpAllie`, ou le relèvement d'un
  //      mort) — quand il part, c'est qu'il y a urgence ;
  //   60 le CONTRÔLE et les grands coups (recharge ≥ 20 s) ;
  //   50 les dégâts ordinaires et les capacités de classe ;
  //   45 la pure MISE EN PLACE (marquage, étendard, marche) — utile, jamais
  //      prioritaire sur un coup qui tombe.
  const GEN_PW = (o) => o;
  GameData.POWERS = {

    // ---------- GUERRIER — il ferme la distance et ne la rouvre pas ----------
    gu_fracas: GEN_PW({
      id: 'gu_fracas', cls: 'guerrier', icon: '', name: 'Fracas', cd: 9,
      kind: 'aoe_self', cible: 'soi',
      radius: 54, mult: 1.9,                      // géométrie + charge utile
      tags: ['degats', 'zone'],
      ia: { veut: 'proche', prio: 50, quand: { foesMin: 1, dist: 0.9 },
            motif: 'attend d’avoir quelqu’un au contact' },
      txt: 'Frappe tout ce qui touche le guerrier',
    }),

    gu_javelot: GEN_PW({
      id: 'gu_javelot', cls: 'guerrier', icon: '', name: 'Javelot', cd: 11,
      kind: 'line', cible: 'ennemi',
      len: 260, w: 22, mult: 2.0,
      tags: ['degats'],
      ia: { veut: 'arriere', prio: 50 },
      txt: 'Le seul geste du guerrier qui porte jusqu’au fond de la salle',
    }),

    gu_decapitation: GEN_PW({
      id: 'gu_decapitation', cls: 'guerrier', icon: '', name: 'Décapitation', cd: 20,
      kind: 'dash', cible: 'ennemi',
      len: 136, w: 30, mult: 3.0, stun: 0.6,      // len : 4 CELL (CELL ≈ 34 px)
      tags: ['degats', 'mobilite'],
      ia: { veut: 'faible', prio: 60 },
      txt: 'Il traverse la salle pour finir un blessé',
    }),

    gu_tourbillon: GEN_PW({
      id: 'gu_tourbillon', cls: 'guerrier', icon: '', name: 'Tourbillon', cd: 18,
      kind: 'field', cible: 'soi',
      radius: 60, dur: 3.5, tick: 0.4, mult: 0.5, // mult : par TIC
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 50, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Il tourne sur lui-même, personne n’ose entrer',
    }),

    gu_pierre: GEN_PW({
      id: 'gu_pierre', cls: 'guerrier', icon: '', name: 'Pierre-de-garde', cd: 26,
      kind: 'buff_self', cible: 'soi',
      dur: 6, armor: 0.8, immuneStun: 1, spd: -0.5,
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 70, quand: { hpSoi: 0.6 },
            motif: 'attend d’être sérieusement entamé' },
      txt: 'Planté comme une borne : +80 % d’armure, mais deux fois plus lent',
    }),

    gu_croc: GEN_PW({
      id: 'gu_croc', cls: 'guerrier', icon: '', name: 'Croc-en-jambe', cd: 16,
      kind: 'aoe_point', cible: 'sol',
      range: 120, radius: 55, mult: 0.6, stun: 1.2,
      tags: ['controle', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Fauche les jambes de tout un groupe',
    }),

    gu_dechainement: GEN_PW({
      id: 'gu_dechainement', cls: 'guerrier', icon: '', name: 'Déchaînement', cd: 26,
      kind: 'buff_self', cible: 'soi',
      dur: 5, spd: 2, aspd: 0.3, immuneStun: 1,
      tags: ['buff'],
      ia: { veut: 'soi', prio: 60, quand: { foesMin: 2 },
            motif: 'attend d’être à un contre deux' },
      txt: 'Cinq secondes où rien ne le ralentit et rien ne l’arrête',
    }),

    gu_mur: GEN_PW({
      id: 'gu_mur', cls: 'guerrier', icon: '', name: 'Mur de boucliers', cd: 34,
      kind: 'buff_party', cible: 'soi',
      radius: 160, dur: 6, dr: 0.6,
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 70, quand: { hpAllie: 0.6 },
            motif: 'attend que la compagnie souffre' },
      txt: 'Six secondes où la compagnie ne prend plus que 40 % des coups',
    }),

    // ---------- GARDE — il se met devant, toujours ----------
    ga_provoc: GEN_PW({
      id: 'ga_provoc', cls: 'garde', icon: '', name: 'Provocation', cd: 14,
      kind: 'taunt', cible: 'soi',
      radius: 130, dur: 5, armor: 1.0,            // +100 % d'armure : l'ancien
      tags: ['controle'],                          // drapeau « × 2 », chiffré
      ia: { veut: 'proche', prio: 50, quand: { dist: 1 },
            motif: 'attend que l’ennemi soit à portée de voix' },
      txt: 'Les ennemis ne visent plus que lui — et il encaisse deux fois mieux',
    }),

    ga_reprise: GEN_PW({
      id: 'ga_reprise', cls: 'garde', icon: '', name: 'Reprise', cd: 26,
      kind: 'heal', cible: 'soi',
      radius: 1, pct: 0.35, cleanse: 1,           // rayon 1 : LUI SEUL
      tags: ['soin'],
      ia: { veut: 'soi', prio: 70, quand: { hpSoi: 0.55 },
            motif: 'attend d’être à moitié' },
      txt: 'Il se recoud sur place, et se débarrasse de ce qui le rongeait',
    }),

    ga_ancrage: GEN_PW({
      id: 'ga_ancrage', cls: 'garde', icon: '', name: 'Ancrage', cd: 28,
      kind: 'buff_self', cible: 'soi',
      dur: 5, dr: 0.55, spd: -0.9,
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 60, quand: { foesMin: 2 },
            motif: 'attend d’avoir du monde en face' },
      txt: 'Il ne bouge plus d’un pouce — et ne prend presque plus rien',
    }),

    ga_pavois: GEN_PW({
      id: 'ga_pavois', cls: 'garde', icon: '', name: 'Coup de pavois', cd: 16,
      kind: 'aoe_self', cible: 'soi',
      radius: 70, mult: 1.1, stun: 1.2, push: 30,
      tags: ['controle', 'zone'],
      ia: { veut: 'proche', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis au contact' },
      txt: 'Un coup de bouclier qui repousse et qui sonne',
    }),

    ga_jugement: GEN_PW({
      id: 'ga_jugement', cls: 'garde', icon: '', name: 'Jugement', cd: 24,
      kind: 'field', cible: 'sol',
      range: 150, radius: 90, dur: 6, tick: 1, mult: 0.35, slow: 0.3,
      tags: ['zone', 'debuff'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Un cercle où l’on avance lentement et où l’on paie',
    }),

    ga_partage: GEN_PW({
      id: 'ga_partage', cls: 'garde', icon: '', name: 'Bouclier partagé', cd: 30,
      kind: 'buff_party', cible: 'soi',
      radius: 160, dur: 8, dr: 0.35,
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 70, quand: { hpAllie: 0.7 },
            motif: 'attend un allié entamé' },
      txt: 'Il prend sur lui une part de ce que prennent les autres',
    }),

    ga_halte: GEN_PW({
      id: 'ga_halte', cls: 'garde', icon: '', name: 'Halte-là', cd: 24,
      kind: 'aoe_point', cible: 'sol',
      range: 120, radius: 110, mult: 0.4, stun: 3,
      tags: ['controle', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Tout le monde s’arrête. Trois secondes, et personne ne discute',
    }),

    ga_serment: GEN_PW({
      id: 'ga_serment', cls: 'garde', icon: '', name: 'Serment', cd: 40,
      kind: 'buff_party', cible: 'soi',
      radius: 160, dur: 3, invuln: 1,
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 70, quand: { hpAllie: 0.35 },
            motif: 'attend que ça tourne vraiment mal' },
      txt: 'Trois secondes où plus rien ne peut blesser la compagnie',
    }),

    // ---------- TIREUR — il règle le problème avant qu'il approche ----------
    ti_percant: GEN_PW({
      id: 'ti_percant', cls: 'tireur', icon: '', name: 'Tir perçant', cd: 8,
      kind: 'line', cible: 'ennemi',
      len: 190, w: 26, mult: 2.2,
      tags: ['degats'],
      ia: { veut: 'arriere', prio: 50 },
      txt: 'Une flèche qui traverse tout sur son passage',
    }),

    ti_marque: GEN_PW({
      id: 'ti_marque', cls: 'tireur', icon: '', name: 'Marque du chasseur', cd: 16,
      kind: 'bolt', cible: 'ennemi',
      range: 250, mult: 1.0, recv: 0.3, dur: 10,
      tags: ['debuff'],
      ia: { veut: 'menace', prio: 45 },
      txt: 'La cible marquée prend 30 % de plus — de la part de tout le monde',
    }),

    ti_sniper: GEN_PW({
      id: 'ti_sniper', cls: 'tireur', icon: '', name: 'Tir de sniper', cd: 20,
      kind: 'bolt', cible: 'ennemi',
      range: 420, mult: 4.0,
      tags: ['degats'],
      ia: { veut: 'arriere', prio: 60 },
      txt: 'Un seul trait, d’un bout à l’autre de la salle',
    }),

    ti_eventail: GEN_PW({
      id: 'ti_eventail', cls: 'tireur', icon: '', name: 'Tir en éventail', cd: 11,
      kind: 'line', cible: 'ennemi',
      len: 170, w: 22, mult: 1.3, spread: 3,      // spread 3 : trois traits, ±25°
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 50, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Trois flèches d’un coup, en éventail',
    }),

    ti_machoires: GEN_PW({
      id: 'ti_machoires', cls: 'tireur', icon: '', name: 'Piège à mâchoires', cd: 14,
      kind: 'field', cible: 'sol',
      range: 90, radius: 45, dur: 12, tick: 0.5, mult: 0.6, slow: 0.7,
      tags: ['controle', 'zone'],
      ia: { veut: 'proche', prio: 60, quand: { dist: 1.2 },
            motif: 'attend que quelqu’un s’approche' },
      txt: 'On y entre vite, on en sort très lentement',
    }),

    ti_venin: GEN_PW({
      id: 'ti_venin', cls: 'tireur', icon: '', name: 'Flèche empoisonnée', cd: 15,
      kind: 'bolt', cible: 'ennemi',
      range: 200, mult: 1.4, status: 'poison', chain: 2,
      tags: ['debuff', 'degats'],
      ia: { veut: 'menace', prio: 50 },
      txt: 'Le venin trouve une deuxième victime',
    }),

    ti_transperce: GEN_PW({
      id: 'ti_transperce', cls: 'tireur', icon: '', name: 'Transpercement', cd: 18,
      kind: 'line', cible: 'ennemi',
      len: 420, w: 20, mult: 3.2,
      tags: ['degats'],
      ia: { veut: 'arriere', prio: 50 },
      txt: 'Le trait traverse la salle, et tout ce qui s’y trouve',
    }),

    ti_volee: GEN_PW({
      id: 'ti_volee', cls: 'tireur', icon: '', name: 'Volée de flèches', cd: 22,
      kind: 'field', cible: 'sol',
      range: 200, radius: 90, dur: 4, tick: 0.5, mult: 0.6,
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Quatre secondes de flèches sur le même carré de sol',
    }),

    // ---------- MAGE — il lit les runes, et parfois les regrette ----------
    ma_trait: GEN_PW({
      id: 'ma_trait', cls: 'mage', icon: '', name: 'Trait arcane', cd: 8,
      kind: 'bolt', cible: 'ennemi',
      range: 170, mult: 3.0,
      tags: ['degats'],
      ia: { veut: 'faible', prio: 50 },
      txt: 'Une décharge sur une cible, très loin',
    }),

    ma_clignement: GEN_PW({
      id: 'ma_clignement', cls: 'mage', icon: '', name: 'Clignement', cd: 10,
      kind: 'dash', cible: 'sol',
      len: 170, invuln: 0.3, cleanse: 1,          // len : 5 CELL
      tags: ['mobilite'],
      ia: { veut: 'soi', prio: 70, quand: { hpSoi: 0.7 },
            motif: 'attend d’être en danger' },
      txt: 'Il disparaît d’un endroit et reparaît cinq pas plus loin',
    }),

    ma_fourchu: GEN_PW({
      id: 'ma_fourchu', cls: 'mage', icon: '', name: 'Éclair fourchu', cd: 12,
      kind: 'bolt', cible: 'ennemi',
      range: 180, mult: 1.8, chain: 4, status: 'shock',  // chain : ×0,8 par saut
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 50, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'L’éclair saute d’un ennemi à l’autre, quatre fois',
    }),

    ma_nova: GEN_PW({
      id: 'ma_nova', cls: 'mage', icon: '', name: 'Nova arcane', cd: 22,
      kind: 'aoe_self', cible: 'soi',
      radius: 110, mult: 2.8, push: 45,
      tags: ['degats', 'zone'],
      ia: { veut: 'proche', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis au contact' },
      txt: 'Une déflagration qui souffle tout ce qui l’entoure',
    }),

    ma_givre: GEN_PW({
      id: 'ma_givre', cls: 'mage', icon: '', name: 'Mur de givre', cd: 20,
      kind: 'field', cible: 'sol',
      range: 160, len: 180, w: 30,                // `len` ⇒ zone en LIGNE
      dur: 5, tick: 0.5, mult: 0.2, slow: 0.6,
      tags: ['controle', 'zone'],
      ia: { veut: 'groupe', prio: 60 },
      txt: 'Un mur de glace en travers de la salle : on ne le franchit pas vite',
    }),

    ma_rupture: GEN_PW({
      id: 'ma_rupture', cls: 'mage', icon: '', name: 'Rupture', cd: 18,
      kind: 'aoe_point', cible: 'sol',
      range: 180, radius: 90, mult: 2.4, armorPct: -0.4, dur: 6,
      tags: ['debuff', 'zone'],
      ia: { veut: 'groupe', prio: 50, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Les armures d’un groupe s’ouvrent pendant six secondes',
    }),

    ma_meteore: GEN_PW({
      id: 'ma_meteore', cls: 'mage', icon: '', name: 'Météore', cd: 30,
      kind: 'aoe_point', cible: 'sol',
      range: 220, radius: 120, delay: 1.2, mult: 4.5,
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 3 },
            motif: 'attend trois ennemis groupés' },
      txt: 'Une ombre au sol pendant une seconde, puis le ciel tombe',
    }),

    ma_blizzard: GEN_PW({
      id: 'ma_blizzard', cls: 'mage', icon: '', name: 'Blizzard', cd: 32,
      kind: 'field', cible: 'soi',
      radius: 200, dur: 5, tick: 0.5, mult: 0.15, slow: 0.6, status: 'chill',
      tags: ['controle', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { foesMin: 3 },
            motif: 'attend trois ennemis' },
      txt: 'Toute la salle gèle : on n’y avance plus qu’au pas',
    }),

    // ---------- ARTIFICIER — toute serrure est une question de dosage ----------
    ar_bombe: GEN_PW({
      id: 'ar_bombe', cls: 'artificier', icon: '', name: 'Bombe', cd: 12,
      kind: 'aoe_point', cible: 'sol',
      range: 165, radius: 48, mult: 2.7,
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 50, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Lancée où l’on veut, elle ne fait pas dans la dentelle',
    }),

    ar_fortune: GEN_PW({
      id: 'ar_fortune', cls: 'artificier', icon: '', name: 'Bouclier de fortune', cd: 26,
      kind: 'buff_party', cible: 'soi',
      radius: 160, dur: 8, abs: 0.18,             // abs : FRACTION de hpMax absorbée
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 70, quand: { hpAllie: 0.7 },
            motif: 'attend un allié entamé' },
      txt: 'Des plaques boulonnées à la hâte : chacun encaisse un coup pour rien',
    }),

    ar_grappe: GEN_PW({
      id: 'ar_grappe', cls: 'artificier', icon: '', name: 'Grappe', cd: 18,
      kind: 'aoe_point', cible: 'sol',
      // spread 5 : cinq sous-charges autour du point (rayon 45, mèche 0,5 s,
      // ×0,8 des dégâts de la charge principale).
      range: 170, radius: 40, mult: 1.2, spread: 5,
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 50, quand: { densite: 3 },
            motif: 'attend trois ennemis groupés' },
      txt: 'Une charge qui en sème cinq autres autour d’elle',
    }),

    ar_demolition: GEN_PW({
      id: 'ar_demolition', cls: 'artificier', icon: '', name: 'Charge de démolition', cd: 34,
      kind: 'aoe_point', cible: 'sol',
      range: 150, radius: 150, delay: 1.5, mult: 5.5,
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 3 },
            motif: 'attend trois ennemis groupés' },
      txt: 'Une seconde et demie de mèche, puis un cratère',
    }),

    ar_gregeois: GEN_PW({
      id: 'ar_gregeois', cls: 'artificier', icon: '', name: 'Feu grégeois', cd: 22,
      kind: 'field', cible: 'sol',
      range: 170, radius: 80, dur: 5, tick: 0.5, mult: 0.45, status: 'burn',
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Une flaque de feu qui colle à qui la traverse',
    }),

    ar_acide: GEN_PW({
      id: 'ar_acide', cls: 'artificier', icon: '', name: 'Flaque d’acide', cd: 20,
      kind: 'field', cible: 'sol',
      range: 170, radius: 100, dur: 6, tick: 0.5, mult: 0.25, armorPct: -0.3,
      tags: ['debuff', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'L’acide ronge les armures autant que les jambes',
    }),

    ar_baril: GEN_PW({
      id: 'ar_baril', cls: 'artificier', icon: '', name: 'Baril', cd: 25,
      kind: 'aoe_point', cible: 'sol',
      range: 190, radius: 130, delay: 0.8, mult: 3.8,
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Un baril roulé dans le tas, et on compte jusqu’à un',
    }),

    ar_tourelle: GEN_PW({
      id: 'ar_tourelle', cls: 'artificier', icon: '', name: 'Tourelle', cd: 30,
      kind: 'field', cible: 'sol',
      // POSÉE PRÈS (range 90), elle ARROSE LOIN (rayon 150) pendant dix
      // secondes : c'est une zone qui tire, pas une entité — l'arène n'a pas de
      // camp « invocation », et n'en aura pas.
      range: 90, radius: 150, dur: 10, tick: 0.7, mult: 0.9,
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { foesMin: 2 },
            motif: 'attend d’avoir de quoi tirer' },
      txt: 'Une tourelle posée qui arrose la zone pendant dix secondes',
    }),

    // ---------- ÉCLAIREUR — il connaît le chemin, surtout celui du retour ----
    ec_esquive: GEN_PW({
      id: 'ec_esquive', cls: 'eclaireur', icon: '', name: 'Esquive', cd: 10,
      kind: 'buff_self', cible: 'soi',
      dur: 5, spd: 0.9, dodge: 0.5,               // spd : FRACTION additive
      tags: ['mobilite', 'bouclier'],
      ia: { veut: 'soi', prio: 50, quand: { hpSoi: 0.7 },
            motif: 'attend d’être entamé' },
      txt: 'Deux fois plus vif, et une chance sur deux d’éviter les coups',
    }),

    ec_crochet: GEN_PW({
      id: 'ec_crochet', cls: 'eclaireur', icon: '', name: 'Crochet', cd: 9,
      kind: 'dash', cible: 'sol',
      len: 170, invuln: 0.3,                      // len : 5 CELL
      tags: ['mobilite'],
      ia: { veut: 'arriere', prio: 50 },
      txt: 'Une roulade de cinq pas, intouchable au passage',
    }),

    ec_eventration: GEN_PW({
      id: 'ec_eventration', cls: 'eclaireur', icon: '', name: 'Éventration', cd: 16,
      kind: 'bolt', cible: 'ennemi',
      // LE SAIGNEMENT est joué par le statut `poison` : le vocabulaire des
      // statuts est fermé à quatre mots, et « ça continue de faire mal » est
      // exactement ce que le joueur lit.
      range: 90, mult: 2.4, status: 'poison', dur: 6,
      tags: ['degats', 'debuff'],
      ia: { veut: 'arriere', prio: 50 },
      txt: 'Une plaie qui saigne six secondes durant',
    }),

    ec_duel: GEN_PW({
      id: 'ec_duel', cls: 'eclaireur', icon: '', name: 'Provocation en duel', cd: 20,
      kind: 'taunt', cible: 'soi',
      radius: 80, dur: 6, dr: 0.3, armor: 0.5,
      tags: ['controle'],
      ia: { veut: 'menace', prio: 60 },
      txt: 'Il désigne le plus dangereux, et ne le lâche plus',
    }),

    ec_fumee: GEN_PW({
      id: 'ec_fumee', cls: 'eclaireur', icon: '', name: 'Écran de fumée', cd: 24,
      kind: 'field', cible: 'soi',
      // ZONE À DEUX FACES : `allie` porte l'esquive aux siens, `slow` ralentit
      // ceux qui la traversent.
      radius: 90, dur: 6, allie: 1, dodge: 0.4, slow: 0.3,
      tags: ['bouclier', 'zone'],
      ia: { veut: 'soi', prio: 70, quand: { hpAllie: 0.7 },
            motif: 'attend un allié entamé' },
      txt: 'Dans la fumée, les siens esquivent et les autres tâtonnent',
    }),

    ec_reperage: GEN_PW({
      id: 'ec_reperage', cls: 'eclaireur', icon: '', name: 'Repérage', cd: 30,
      kind: 'aoe_point', cible: 'sol',
      range: 440, radius: 440, mult: 0, recv: 0.2, dur: 12,  // mult 0 : AUCUN dégât
      tags: ['debuff'],
      ia: { veut: 'groupe', prio: 45, quand: { ouverture: 1 },
            motif: 'repère la salle en y entrant' },
      txt: 'Toute la salle est repérée : chacun y prend 20 % de plus',
    }),

    ec_execution: GEN_PW({
      id: 'ec_execution', cls: 'eclaireur', icon: '', name: 'Exécution', cd: 20,
      kind: 'dash', cible: 'ennemi',
      len: 204, w: 26, mult: 4.0,                 // len : 6 CELL
      tags: ['degats', 'mobilite'],
      ia: { veut: 'faible', prio: 60 },
      txt: 'Six pas en ligne droite, et le blessé n’est plus là',
    }),

    ec_embuscade: GEN_PW({
      id: 'ec_embuscade', cls: 'eclaireur', icon: '', name: 'Embuscade', cd: 38,
      kind: 'buff_party', cible: 'soi',
      radius: 190, dur: 4, dmg: 1.0,
      tags: ['buff'],
      ia: { veut: 'soi', prio: 60, quand: { foesMin: 3 },
            motif: 'attend qu’il y ait foule' },
      txt: 'Quatre secondes où la compagnie frappe deux fois plus fort',
    }),

    // ---------- SOIGNEUR — il recoud, rassure, ronchonne ----------
    so_baume: GEN_PW({
      id: 'so_baume', cls: 'soigneur', icon: '', name: 'Baume', cd: 11,
      kind: 'heal', cible: 'soi',
      radius: 160, pct: 0.28,
      tags: ['soin'],
      ia: { veut: 'blesse', prio: 50, quand: { hpAllie: 0.7 },
            motif: 'attend un allié blessé' },
      txt: 'Recoud tout le monde autour de lui',
    }),

    so_transfusion: GEN_PW({
      id: 'so_transfusion', cls: 'soigneur', icon: '', name: 'Transfusion', cd: 14,
      kind: 'heal', cible: 'soi',
      range: 250, pct: 0.45,                      // `range` (et non `radius`) : MONO-CIBLE
      tags: ['soin'],
      ia: { veut: 'blesse', prio: 70, quand: { hpAllie: 0.55 },
            motif: 'attend un allié en mauvais état' },
      txt: 'Tout d’un coup, sur un seul : près de la moitié de ses PV',
    }),

    so_sanctuaire: GEN_PW({
      id: 'so_sanctuaire', cls: 'soigneur', icon: '', name: 'Sanctuaire', cd: 26,
      kind: 'field', cible: 'soi',
      // IL SOIGNE BEAUCOUP, MAIS IL FAUT Y RESTER : 30 % sur six secondes, et
      // seulement dedans. C'est tout l'écart avec l'Égide, qui suit et n'a
      // besoin de personne.
      radius: 100, dur: 6, tick: 1, allie: 1, pct: 0.05, armor: 0.25,
      tags: ['soin', 'zone'],
      ia: { veut: 'blesse', prio: 70, quand: { hpAllie: 0.7 },
            motif: 'attend un allié entamé' },
      txt: 'Un cercle où l’on se soigne — encore faut-il y rester',
    }),

    so_egide: GEN_PW({
      id: 'so_egide', cls: 'soigneur', icon: '', name: 'Égide', cd: 28,
      kind: 'buff_party', cible: 'soi',
      radius: 170, dur: 8, abs: 0.20,             // abs : FRACTION de hpMax absorbée
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 60, quand: { foesMin: 2 },
            motif: 'attend d’avoir du monde en face' },
      txt: 'Elle ne soigne pas : elle absorbe, et elle suit',
    }),

    so_chatiment: GEN_PW({
      id: 'so_chatiment', cls: 'soigneur', icon: '', name: 'Châtiment', cd: 10,
      kind: 'bolt', cible: 'ennemi',
      range: 180, mult: 2.4, heal: 0.12,          // le soin va au plus bas de la compagnie
      tags: ['degats', 'soin'],
      ia: { veut: 'faible', prio: 50 },
      txt: 'Il frappe, et le plus mal en point de la compagnie se relève un peu',
    }),

    so_ronces: GEN_PW({
      id: 'so_ronces', cls: 'soigneur', icon: '', name: 'Ronces', cd: 22,
      kind: 'field', cible: 'sol',
      range: 180, radius: 90, dur: 6, tick: 0.5, mult: 0.3, slow: 0.7,
      tags: ['controle', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Un roncier qui pique et qui retient',
    }),

    so_source: GEN_PW({
      id: 'so_source', cls: 'soigneur', icon: '', name: 'Source', cd: 34,
      kind: 'field', cible: 'soi',
      radius: 120, dur: 8, tick: 1, allie: 1, pct: 0.06,
      tags: ['soin', 'zone'],
      ia: { veut: 'blesse', prio: 70, quand: { hpAllie: 0.7 },
            motif: 'attend un allié entamé' },
      txt: 'Une source qui coule huit secondes : on y revient',
    }),

    so_releve: GEN_PW({
      id: 'so_releve', cls: 'soigneur', icon: '', name: 'Relève', cd: 60,
      kind: 'heal', cible: 'soi',
      radius: 160, revive: 0.4, pct: 0.2, cleanse: 1,
      tags: ['soin'],
      ia: { veut: 'blesse', prio: 70 },
      txt: 'Il remet debout celui qui était tombé',
    }),

    // ---------- BARDE — il négocie tout, y compris l'impossible ----------
    ba_refrain: GEN_PW({
      id: 'ba_refrain', cls: 'barde', icon: '', name: 'Refrain', cd: 15,
      kind: 'buff_party', cible: 'soi',
      // LE RAYON DEVIENT EFFECTIF dans l'arène (il était ignoré) : 200 pour que
      // le Refrain couvre la compagnie comme avant. L'arène fait ~442 px de côté.
      radius: 200, dur: 8, dmg: 0.35,
      tags: ['buff'],
      ia: { veut: 'soi', prio: 50, quand: { foesMin: 2 },
            motif: 'attend qu’il y ait de quoi chanter' },
      txt: '+35 % de dégâts pour toute la compagnie',
    }),

    ba_marche: GEN_PW({
      id: 'ba_marche', cls: 'barde', icon: '', name: 'Marche forcée', cd: 20,
      kind: 'buff_party', cible: 'soi',
      radius: 180, dur: 6, spd: 0.6, cleanse: 1,
      tags: ['buff', 'mobilite'],
      ia: { veut: 'soi', prio: 45 },
      txt: 'La compagnie repart d’un bon pas, débarrassée de ce qui la freinait',
    }),

    ba_hymne: GEN_PW({
      id: 'ba_hymne', cls: 'barde', icon: '', name: 'Hymne', cd: 24,
      kind: 'field', cible: 'soi',
      radius: 140, dur: 4, tick: 0.5, allie: 1, dmg: 0.25, pct: 0.015,
      tags: ['buff', 'soin', 'zone'],
      ia: { veut: 'soi', prio: 60, quand: { foesMin: 2 },
            motif: 'attend qu’il y ait de quoi chanter' },
      txt: 'Autour de lui, on frappe plus fort et on se recoud',
    }),

    ba_cacophonie: GEN_PW({
      id: 'ba_cacophonie', cls: 'barde', icon: '', name: 'Cacophonie', cd: 26,
      kind: 'field', cible: 'sol',
      range: 170, radius: 120, dur: 5, tick: 0.5, aspd: -0.3, mult: 0.1,
      tags: ['debuff', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Un vacarme qui casse la cadence de tout le monde',
    }),

    ba_berceuse: GEN_PW({
      id: 'ba_berceuse', cls: 'barde', icon: '', name: 'Berceuse', cd: 22,
      kind: 'aoe_point', cible: 'sol',
      range: 140, radius: 100, mult: 0.1, stun: 3,
      tags: ['controle', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { densite: 2 },
            motif: 'attend deux ennemis groupés' },
      txt: 'Trois secondes de sommeil pour tout un groupe',
    }),

    ba_ovation: GEN_PW({
      id: 'ba_ovation', cls: 'barde', icon: '', name: 'Ovation', cd: 20,
      kind: 'buff_party', cible: 'soi',
      radius: 180, dur: 6, aspd: 0.25,
      tags: ['buff'],
      ia: { veut: 'soi', prio: 60, quand: { foesMin: 2 },
            motif: 'attend qu’il y ait de quoi applaudir' },
      txt: 'La compagnie frappe un quart plus vite',
    }),

    ba_charge: GEN_PW({
      id: 'ba_charge', cls: 'barde', icon: '', name: 'Charge', cd: 30,
      kind: 'buff_party', cible: 'soi',
      radius: 190, dur: 5, spd: 0.6, dmg: 0.4,
      tags: ['buff', 'mobilite'],
      ia: { veut: 'soi', prio: 60 },
      txt: 'On avance — et on avance en cognant',
    }),

    ba_requiem: GEN_PW({
      id: 'ba_requiem', cls: 'barde', icon: '', name: 'Requiem', cd: 40,
      kind: 'field', cible: 'soi',
      radius: 220, dur: 8, tick: 1, mult: 0.15, armorPct: -0.5,
      tags: ['debuff', 'zone'],
      ia: { veut: 'groupe', prio: 60, quand: { boss: 1 },
            motif: 'garde sa complainte pour les gros morceaux' },
      txt: 'Une complainte qui ronge les armures de toute la salle',
    }),

    // ---------- LE GÉNÉRAL — le commandement ----------
    // Aucun pouvoir mono-cible pur : tout ce qu'il fait passe par la compagnie.
    ge_cri: GEN_PW({
      id: 'ge_cri', cls: 'general', icon: '', name: 'Cri du Général', cd: 20,
      kind: 'rally', cible: 'soi',
      radius: 190, dur: 6, dmg: 0.25, heal: 0.15,
      tags: ['buff', 'soin'],
      ia: { veut: 'blesse', prio: 50, quand: { hpAllie: 0.7 },
            motif: 'attend un allié entamé' },
      txt: 'Rallie la compagnie : soigne un peu, galvanise beaucoup',
    }),

    ge_etendard: GEN_PW({
      id: 'ge_etendard', cls: 'general', icon: '', name: 'Étendard', cd: 30,
      kind: 'field', cible: 'soi',
      radius: 130, dur: 12, tick: 1, allie: 1, dmg: 0.2, armor: 0.15,
      tags: ['buff', 'zone'],
      ia: { veut: 'soi', prio: 45, quand: { ouverture: 1 },
            motif: 'plante l’étendard en entrant dans la salle' },
      txt: 'Planté au sol : autour de lui, on frappe plus fort et on tient mieux',
    }),

    ge_manoeuvre: GEN_PW({
      id: 'ge_manoeuvre', cls: 'general', icon: '', name: 'Ordre de manœuvre', cd: 26,
      kind: 'dash', cible: 'sol',
      // `groupe` : le bond emporte TOUTE la compagnie, pas seulement lui.
      groupe: 1, len: 102, armor: 0.3, dur: 4,    // len : 3 CELL
      tags: ['mobilite', 'buff'],
      ia: { veut: 'soi', prio: 60, quand: { boss: 1 },
            motif: 'garde la manœuvre pour un gros morceau' },
      txt: 'Toute la compagnie se replace d’un bloc, boucliers levés',
    }),

    ge_ferdelance: GEN_PW({
      id: 'ge_ferdelance', cls: 'general', icon: '', name: 'Fer de lance', cd: 24,
      kind: 'dash', cible: 'ennemi',
      len: 170, w: 34, mult: 2.4, stun: 0.6,      // len : 5 CELL
      tags: ['degats', 'mobilite'],
      ia: { veut: 'menace', prio: 60 },
      txt: 'Il ouvre la brèche lui-même, et ça s’entend',
    }),

    ge_rompez: GEN_PW({
      id: 'ge_rompez', cls: 'general', icon: '', name: 'Rompez !', cd: 30,
      kind: 'heal', cible: 'soi',
      radius: 190, pct: 0.12, cleanse: 1, heal_recv: 0.5, dur: 6,
      tags: ['soin'],
      ia: { veut: 'blesse', prio: 70, quand: { hpAllie: 0.6 },
            motif: 'attend que la compagnie ait besoin de souffler' },
      txt: 'Une pause dans le fracas : on se soigne, et mieux qu’avant',
    }),

    ge_tenez: GEN_PW({
      id: 'ge_tenez', cls: 'general', icon: '', name: 'Tenez la ligne', cd: 30,
      kind: 'buff_party', cible: 'soi',
      radius: 190, dur: 6, dr: 0.45,
      tags: ['bouclier'],
      ia: { veut: 'soi', prio: 70, quand: { hpAllie: 0.7 },
            motif: 'attend un allié entamé' },
      txt: 'Personne ne recule : la compagnie encaisse presque moitié moins',
    }),

    ge_ordregeneral: GEN_PW({
      id: 'ge_ordregeneral', cls: 'general', icon: '', name: 'Ordre général', cd: 50,
      kind: 'buff_party', cible: 'soi',
      // `recharge` : la MOITIÉ de la recharge de TOUS les pouvoirs de la
      // compagnie est rendue d'un coup. Le Général ne frappe pas, il fait frapper.
      radius: 220, dur: 5, recharge: 0.5, dmg: 0.2,
      tags: ['buff'],
      ia: { veut: 'soi', prio: 60, quand: { foesMin: 3 },
            motif: 'attend qu’il y ait de quoi ordonner' },
      txt: 'Toutes les jauges de la compagnie se remplissent de moitié',
    }),

    ge_defi: GEN_PW({
      id: 'ge_defi', cls: 'general', icon: '', name: 'Défi', cd: 26,
      kind: 'taunt', cible: 'soi',
      radius: 180, dur: 6, dr: 0.5, armor: 0.6,
      tags: ['controle', 'bouclier'],
      ia: { veut: 'menace', prio: 60 },
      txt: 'Plus personne ne regarde ailleurs pendant six secondes',
    }),

    /* ================================================================
       LES POUVOIRS DE L’ANNEAU

       Les soixante-douze premiers sont des capacites DE CLASSE : chacun
       appartient a un metier, et l’arbre partage n’en distribue que ce
       que ses bosquets veulent bien citer. Ceux-ci sont differents — ils
       n’appartiennent a personne et ne s’obtiennent QUE par l’arbre, au
       bout d’un theme. Ce sont eux que les runes retouchent.

       Chacun n’utilise que des `kind` que l’arene sait jouer : un pouvoir
       dont le `kind` est inconnu est un pouvoir muet, et le contrat de ce
       fichier l’interdit.
       ================================================================ */

    an_boulefeu: GEN_PW({
      id: 'an_boulefeu', cls: null, icon: '', name: 'Boule de feu', cd: 7,
      kind: 'aoe_point', cible: 'sol',
      range: 190, radius: 52, mult: 1.7, elem: 'feu',
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 62, quand: { densite: 2 },
            motif: 'attend deux ennemis groupes' },
      txt: 'Une boule qui part et qui eclate',
    }),
    an_brasier: GEN_PW({
      id: 'an_brasier', cls: null, icon: '', name: 'Brasier', cd: 11,
      kind: 'field', cible: 'sol',
      range: 160, radius: 78, dur: 5, tick: 0.5, mult: 0.45, elem: 'feu',
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 55, quand: { densite: 2 },
            motif: 'pose le feu sous un groupe' },
      txt: 'Le sol brule, et continue de bruler',
    }),
    an_nuee: GEN_PW({
      id: 'an_nuee', cls: null, icon: '', name: 'Nuee acide', cd: 10,
      kind: 'field', cible: 'sol',
      range: 170, radius: 72, dur: 6, tick: 0.6, mult: 0.38, elem: 'poison',
      tags: ['degats', 'zone', 'debuff'],
      ia: { veut: 'groupe', prio: 52, quand: { densite: 2 },
            motif: 'noie un groupe sous l acide' },
      txt: 'Un nuage qui ronge tant qu’on y reste',
    }),
    an_eclatgel: GEN_PW({
      id: 'an_eclatgel', cls: null, icon: '', name: 'Eclat de gel', cd: 8,
      kind: 'aoe_self', cible: 'soi',
      radius: 70, mult: 1.1, slow: 0.45, elem: 'froid',
      tags: ['degats', 'zone', 'controle'],
      ia: { veut: 'proche', prio: 58, quand: { foesMin: 2, dist: 0.9 },
            motif: 'attend d avoir du monde au contact' },
      txt: 'Tout ce qui touche se fige',
    }),
    an_arcfoudre: GEN_PW({
      id: 'an_arcfoudre', cls: null, icon: '', name: 'Arc de foudre', cd: 6,
      kind: 'bolt', cible: 'ennemi',
      range: 210, mult: 1.5, chain: 2, elem: 'foudre',
      tags: ['degats'],
      ia: { veut: 'menace', prio: 60, quand: { foesMin: 1 },
            motif: 'vise ce qui fait le plus mal' },
      txt: 'Elle saute d une cible a l autre',
    }),
    an_fauxombre: GEN_PW({
      id: 'an_fauxombre', cls: null, icon: '', name: 'Faux d ombre', cd: 9,
      kind: 'line', cible: 'ennemi',
      len: 240, w: 34, mult: 1.9, elem: 'ombre',
      tags: ['degats', 'zone'],
      ia: { veut: 'groupe', prio: 57, quand: { densite: 2 },
            motif: 'cherche un alignement' },
      txt: 'Une coupe qui traverse la ligne',
    }),
  };
  GameData.powerById = id => GameData.POWERS[id] || null;

  // ---------- LA CAPACITÉ DE CLASSE ----------
  // Slot 0 de tout personnage, offerte, jamais dans l'arbre.
  GameData.CLASS_POWER = {
    guerrier: 'gu_fracas', garde: 'ga_provoc', tireur: 'ti_percant', mage: 'ma_trait',
    artificier: 'ar_bombe', eclaireur: 'ec_esquive', soigneur: 'so_baume',
    barde: 'ba_refrain', general: 'ge_cri',
  };
  // ALIAS DE COMPATIBILITÉ — même nom public, mêmes objets (aucune copie : ce
  // sont les définitions du catalogue). 9 clés, comme HERO_CLASSES :
  // dev/smoke-general.js:49 teste la parité des deux tables.
  GameData.HERO_ABILITIES = {};
  for (const c in GameData.CLASS_POWER) GameData.HERO_ABILITIES[c] = GameData.POWERS[GameData.CLASS_POWER[c]];
  GameData.GENERAL_ABILITY = GameData.POWERS.ge_cri;              // déprécié
  GameData.heroAbility = cls => GameData.POWERS[GameData.CLASS_POWER[cls]] || null;

  // ---------- LES PATRONS DE BOSS ----------
  // Le boss annonce son coup : une zone rouge apparaît au sol pendant `tell`
  // secondes, puis frappe. Tout l'enjeu du combat manuel tient là — sortir à temps.
  GameData.BOSS_PATTERNS = {
    ecrasement: { id: 'ecrasement', icon: '', name: 'Écrasement', kind: 'circle', tell: 1.3, r: 74,  mult: 2.4, every: 6.5 },
    balayage:   { id: 'balayage',   icon: '', name: 'Balayage',   kind: 'ring',   tell: 1.1, r: 118, inner: 58, mult: 2.0, every: 8 },
    salve:      { id: 'salve',      icon: '', name: 'Salve',      kind: 'multi',  tell: 1.5, r: 44,  n: 3, mult: 1.8, every: 9 },
    ruee:       { id: 'ruee',       icon: '', name: 'Ruée',       kind: 'line',   tell: 1.2, len: 240, w: 56, mult: 3.0, every: 10 },
    // LE BALAYAGE TOURNANT : trois lignes qui partent en étoile depuis le boss,
    // décalées d'un quart de seconde — on lit le motif et on trouve le couloir
    // sûr, au lieu d'esquiver trois annonces sans lien.
    etoile:     { id: 'etoile',     icon: '', name: 'Étoile',     kind: 'star',   tell: 1.4, len: 220, w: 44, n: 3, mult: 2.2, every: 11 },
    // LA TRAQUE : une suite de petits impacts qui POURSUIVENT la cible — la
    // seule annonce où rester immobile est la mauvaise réponse.
    traque:     { id: 'traque',     icon: '', name: 'Traque',     kind: 'chase',  tell: 0.75, r: 38, n: 5, mult: 1.2, every: 12 },
    // LA CROIX : deux lignes perpendiculaires qui traversent le boss de part
    // en part. Quatre quadrants sûrs — le motif se lit d'un coup d'œil, il
    // suffit de choisir le sien. Composée de formes existantes (des lignes).
    croix:      { id: 'croix',      icon: '', name: 'Croix',      kind: 'cross',  tell: 1.35, len: 220, w: 46, mult: 2.3, every: 10.5 },
  };

  // ---------- QUI HABITE LE DONJON ----------
  // Les ennemis sont les unités de la faction ADVERSE. Chaque biome du donjon a
  // sa palette de types + un comportement d'IA par type.
  // `animals` = la faune propre au lieu. Avant, la composition tirait au hasard
  // dans les huit espèces : on croisait un crapaud dans la tour et un corbeau
  // dans la coulée de lave. Chaque biome n'appelle plus que ce qui y vit.
  // Le bloc `boss` accepte désormais une PERSONNALITÉ, avec repli sur les
  // valeurs historiques quand un champ manque :
  //   enrageAt    (déf. 0.5)  — seuil de PV de l'enrage ;
  //   summonAt    (déf. 0.6)  — seuil du portail d'invocation ; 0 = n'invoque JAMAIS ;
  //   desperateAt (déf. 0.25) — seuil du dernier souffle ;
  //   tempo { base, enrage, desperate } (déf. 1 / 0.7 / 0.45) — multiplie le
  //   délai entre patrons : plus PETIT = plus frénétique, plus GRAND = plus lourd.
  GameData.ADV_FOES = {
    // LE GARDIEN DE LA TOUR EST LE PREMIER BOSS DU JEU, à l'étage 5 : il doit
    // se gagner en s'y PRÉPARANT, pas en ayant déjà fini le jeu. À ×7 PV il
    // pesait 3 313 PV pour un Général de niveau 5 qui en rend 17 par seconde —
    // 191 secondes de mise à mort contre 19 secondes de survie. Mesuré :
    // 0 victoire sur 25 à TOUS les niveaux, quel que soit l'équipement.
    // Il est ramené à ×4 PV, s'emporte plus tard (0,3 au lieu de 0,5) et frappe
    // plus LOURDEMENT que vite (tempo 1,4 : ses annonces laissent le temps de
    // sortir de la zone). `summonAt` et `desperateAt` gardent leurs valeurs par
    // défaut : le portail à 60 % et le dernier souffle au quart des PV font
    // partie de son identité — et de ce que dev/smoke-arene.js vérifie.
    // Mesuré après réglage (Général niv.3, 5 pièces communes, pilotage auto,
    // 600 duels par colonne) : SEUL 0 %, à DEUX 30 %, à TROIS 70 %. Le premier
    // gardien demande donc une compagnie — et le premier compagnon est
    // désormais garanti (GameData.GEN_PREMIER_COMPAGNON).
    tour:        { types: ['lancier', 'eclaireur'], animals: ['rat', 'corbeau', 'fouine', 'belette', 'pie', 'chauvesouris'],
                   boss: { type: 'costaud',  hpMult: 4,  patterns: ['ecrasement'],
                           enrageAt: 0.3, tempo: { base: 1.4, enrage: 1, desperate: 0.63 } } },
    // LE GARDIEN DE LA GROTTE EST LENT ET LOURD : ses patrons tombent moins
    // souvent, mais la croix couvre la moitié de la salle.
    grotte:      { types: ['lancier', 'fronde', 'targier'], animals: ['rat', 'blaireau', 'crapaud', 'araignee', 'taupe', 'salamandre'],
                   boss: { type: 'targier',  hpMult: 9,  patterns: ['balayage', 'croix'],
                           tempo: { base: 1.3, enrage: 0.95, desperate: 0.6 } } },
    // L'AURA DES CRISTAUX S'EMPORTE TÔT — mais n'invoque jamais : son combat
    // est un duel, pas un siège.
    cristaux:    { types: ['fronde', 'traqueur', 'mage'], animals: ['corbeau', 'renard', 'lucane', 'hermine', 'prisme'],
                   boss: { type: 'aura',     hpMult: 12, patterns: ['salve', 'balayage', 'traque'],
                           enrageAt: 0.65, summonAt: 0 } },
    champignons: { types: ['mage', 'traqueur', 'targier', 'essaim'], animals: ['crapaud', 'sanglier', 'limace', 'guepe', 'bolet'],
                   boss: { type: 'rempart',  hpMult: 14, patterns: ['ecrasement', 'salve', 'etoile'] } },
    lave:        { types: ['sapeur', 'artilleur', 'costaud'], animals: ['chien', 'renard', 'basilic', 'scorpion', 'fournaise'],
                   boss: { type: 'artilleur', hpMult: 17, patterns: ['ruee', 'etoile', 'salve'] } },
    // LE CHRONARQUE DÉSESPÈRE PLUS TÔT ET PLUS FORT : dès 35 % de PV, un
    // tempo frénétique — la fin du dernier biome doit être son sommet.
    morts:       { types: ['mage', 'assassin', 'invocateur'], animals: ['fouine', 'chauvesouris', 'goule', 'spectre', 'liche'],
                   boss: { type: 'chronarque', hpMult: 22, patterns: ['ruee', 'etoile', 'traque', 'ecrasement', 'croix'],
                           desperateAt: 0.35, tempo: { desperate: 0.32 } } },
  };
  GameData.advFoes = id => GameData.ADV_FOES[id] || GameData.ADV_FOES.tour;

  // ---------- COMPORTEMENTS D'IA ENNEMIS ----------
  // Chaque type d'ennemi a un profil qui dicte son comportement dans l'arène.
  GameData.ENEMY_BEHAVIORS = {
    rusher:       { id: 'rusher',       desc: 'charge le héros le plus proche, ignore les zones' },
    flanker:      { id: 'flanker',      desc: 'contourne par le flanc avant d\'attaquer' },
    ranged_kiter: { id: 'ranged_kiter', desc: 'garde sa portée max, recule si on approche' },
    bruiser:      { id: 'bruiser',      desc: 'avance lentement, vise le héros le plus tanky' },
    swarmer:      { id: 'swarmer',      desc: 'reste en groupe, focus la même cible' },
    zone_caster:  { id: 'zone_caster',  desc: 'reste en retrait, pose des zones au sol' },
    // Trois profils de plus, pour que deux salles du même biome ne se jouent
    // pas pareil : celui qui refuse le combat, ceux qui chassent ensemble,
    // celui qui se sacrifie pour ses tireurs.
    fuyard:       { id: 'fuyard',       desc: 'sous 35 % de vie, il détale et se tient hors de portée' },
    meute:        { id: 'meute',        desc: 'converge sur la cible du chef de meute, plus vif à plusieurs' },
    garde:        { id: 'garde',        desc: 's\'interpose entre son protégé (tireur, mage) et le héros le plus proche' },
  };
  // assignation par type d'unité ennemie
  GameData.ENEMY_AI_MAP = {
    lancier: 'rusher', eclaireur: 'rusher', assassin: 'rusher',
    fronde: 'ranged_kiter', artilleur: 'ranged_kiter', mage: 'zone_caster',
    targier: 'garde', costaud: 'bruiser', rempart: 'garde',
    traqueur: 'flanker', essaim: 'swarmer', invocateur: 'zone_caster',
    sapeur: 'meute', aura: 'zone_caster', chronarque: 'zone_caster',
  };
  GameData.enemyBehavior = type => GameData.ENEMY_AI_MAP[type] || 'rusher';

  // ---------- ÉLÉMENTS ----------
  // Certains ennemis infligent des dégâts élémentaires + un effet de statut.
  GameData.ELEMENTS = {
    feu:      { id: 'feu',      icon: '', name: 'feu',      col: '#ff8a4a', status: 'burn',   res: 'resFire' },
    froid:    { id: 'froid',    icon: '', name: 'froid',    col: '#7ac8ff', status: 'chill',  res: 'resCold' },
    poison:   { id: 'poison',   icon: '', name: 'poison',   col: '#8adf5a', status: 'poison', res: 'resPoison' },
    foudre:   { id: 'foudre',   icon: '', name: 'foudre',   col: '#ffe04a', status: 'shock',  res: 'resLightning' },
    /* L'OMBRE. Cinquieme element, ajoute avec `resShadow` : sans lui la
       resistance existait et ne protegeait de rien. Son statut `wither`
       est declare dans `applyStatus` — un element dont le statut manque
       est un element muet. */
    ombre:    { id: 'ombre',    icon: '', name: 'ombre',    col: '#a06ad0', status: 'wither', res: 'resShadow' },
  };
  // assignation d'un élément par type d'ennemi (null = physique)
  GameData.ENEMY_ELEM = {
    mage: 'feu', invocateur: 'poison', artilleur: 'foudre',
    sapeur: 'feu', traqueur: 'froid', essaim: 'poison',
    aura: 'foudre', chronarque: 'foudre',
  };
  GameData.enemyElem = type => GameData.ENEMY_ELEM[type] || null;

  // ---------- LA FAUNE DU DONJON ----------
  // Animaux qu'on croise dans les profondeurs. Chacun a un nom, un sprite de
  // base (réutilisé), un comportement et parfois un élément.
  // ---------- LE BESTIAIRE ----------
  // Un monstre n'est pas une couleur différente : c'est un PROBLÈME différent.
  // Chacun a son POUVOIR, avec son délai propre, et l'IA du joueur doit
  // apprendre à le voir venir. `base` = le gabarit d'unité dont il hérite ses
  // stats brutes ; `scale` sa carrure ; `power` ce qui le rend pénible.
  const GEN_AN = (id, cats, birds, base, behavior, elem, scale, power) =>
    ({ id, name: { cats, birds }, base, behavior, elem, scale, power });
  GameData.MONSTER_POWERS = {
    scission:  { icon: '', name: 'Scission',   txt: 'sous 50 % de vie, il se fend en deux' },
    hurlement: { icon: '', name: 'Hurlement',  txt: 'enrage la meute autour de lui' },
    feinte:    { icon: '', name: 'Feinte',     txt: 'devient insaisissable quelques secondes' },
    carapace:  { icon: '', name: 'Carapace',   txt: 'sous 40 % de vie, son armure triple' },
    larcin:    { icon: '', name: 'Larcin',     txt: 'vole du butin et détale' },
    charge:    { icon: '', name: 'Charge',     txt: 'ruée en ligne droite qui projette' },
    nuee:      { icon: '', name: 'Nuée',       txt: 'appelle un congénère en renfort' },
    crachat:   { icon: '', name: 'Crachat',    txt: 'crache une flaque qui ronge' },
    /* LES POUVOIRS DE LA FAUNE ÉLARGIE. Chacun doit dire quelque chose que
       le joueur puisse LIRE en combat : on ne met pas un pouvoir pour
       remplir une colonne. */
    embrase:   { icon: '', name: 'Embrasement', txt: 'sa morsure met le feu' },
    givre:     { icon: '', name: 'Givre',       txt: 'fige ce qui approche de trop près' },
    arc:       { icon: '', name: 'Arc',         txt: 'la foudre saute d’une cible à l’autre' },
    drain:     { icon: '', name: 'Drain',       txt: 'ce qu’il retire, il se le rend' },
    toile:     { icon: '', name: 'Toile',       txt: 'entrave qui ralentit longtemps' },
    spores:    { icon: '', name: 'Spores',      txt: 'un nuage qui ronge et se propage' },
    fracture:  { icon: '', name: 'Fracture',    txt: 'brise l’armure de ce qu’il touche' },
    voile:     { icon: '', name: 'Voile',       txt: 'disparaît, et frappe de dos' },
    reveil:    { icon: '', name: 'Réveil',      txt: 'relève ce qui est tombé près de lui' },
    eclat:     { icon: '', name: 'Éclat',       txt: 'explose en échardes en mourant' },
  };
  GameData.ADV_ANIMALS = {
    rat:      GEN_AN('rat',      'Rat d’égout',       'Rat d’égout',       'eclaireur', 'swarmer',      'poison', 0.82,
                     { id: 'scission', cd: 0, seuil: 0.5 }),
    chien:    GEN_AN('chien',    'Molosse errant',    'Molosse errant',    'lancier',   'meute',        null,     0.95,
                     { id: 'hurlement', cd: 9, rayon: 4, bonus: 0.45, duree: 5 }),
    renard:   GEN_AN('renard',   'Renard rusé',       'Renard rusé',       'traqueur',  'fuyard',       'feu',    0.9,
                     { id: 'feinte', cd: 8, duree: 2.5 }),
    blaireau: GEN_AN('blaireau', 'Blaireau teigneux', 'Blaireau teigneux', 'targier',   'bruiser',      null,     1.0,
                     { id: 'carapace', cd: 0, seuil: 0.4, mult: 3 }),
    fouine:   GEN_AN('fouine',   'Fouine voleuse',    'Fouine voleuse',    'assassin',  'fuyard',       null,     0.86,
                     { id: 'larcin', cd: 11, part: 0.12 }),
    sanglier: GEN_AN('sanglier', 'Sanglier buté',     'Sanglier buté',     'costaud',   'rusher',       null,     1.1,
                     { id: 'charge', cd: 7, portee: 5, degats: 1.6 }),
    corbeau:  GEN_AN('corbeau',  'Corbeau guetteur',  'Corbeau guetteur',  'fronde',    'ranged_kiter', 'froid',  0.88,
                     { id: 'nuee', cd: 13, max: 2 }),
    crapaud:  GEN_AN('crapaud',  'Crapaud venimeux',  'Crapaud venimeux',  'sapeur',    'zone_caster',  'poison', 0.92,
                     { id: 'crachat', cd: 6, rayon: 1.5, duree: 6 }),

    /* ------------------------------------------------------------------
       LA FAUNE ÉLARGIE

       Huit bêtes pour six biomes, dont deux seulement portaient un
       élément : les résistances n’avaient presque rien à résister, et une
       descente entière se jouait contre le même bestiaire.

       Chaque bête neuve porte UN élément et UN pouvoir lisible. Les cinq
       éléments sont couverts, et chaque biome a désormais sa couleur
       dominante — c’est ce qui rend une résistance CHOISIE plutôt que
       subie : on sait ce qui attend en bas.
       ------------------------------------------------------------------ */
    /* LA TOUR — physique et ombre, le bestiaire d’apprentissage */
    belette:  GEN_AN('belette',  'Belette hargneuse', 'Belette hargneuse', 'eclaireur', 'flanker',      null,     0.80,
                     { id: 'voile', cd: 10, duree: 1.8 }),
    pie:      GEN_AN('pie',      'Pie chapardeuse',   'Pie chapardeuse',   'fronde',    'ranged_kiter', null,     0.84,
                     { id: 'larcin', cd: 12, part: 0.08 }),
    chauvesouris: GEN_AN('chauvesouris', 'Chauve-souris', 'Chauve-souris', 'essaim',    'swarmer',      'ombre',  0.72,
                     { id: 'drain', cd: 7, part: 0.35 }),

    /* LES GROTTES — poison et feu souterrain */
    araignee: GEN_AN('araignee', 'Araignée des puits','Araignée des puits','traqueur',  'zone_caster',  'poison', 0.90,
                     { id: 'toile', cd: 9, rayon: 2.2, duree: 4, ralenti: 0.45 }),
    taupe:    GEN_AN('taupe',    'Taupe géante',      'Taupe géante',      'costaud',   'rusher',       null,     1.05,
                     { id: 'fracture', cd: 8, perte: 0.35, duree: 6 }),
    salamandre: GEN_AN('salamandre','Salamandre noire','Salamandre noire', 'sapeur',    'bruiser',      'feu',    0.95,
                     { id: 'embrase', cd: 6, duree: 3 }),

    /* LES CRISTAUX — foudre et froid, tout y résonne */
    lucane:   GEN_AN('lucane',   'Lucane de quartz',  'Lucane de quartz',  'artilleur', 'ranged_kiter', 'foudre', 0.93,
                     { id: 'arc', cd: 8, sauts: 3, perte: 0.3 }),
    hermine:  GEN_AN('hermine',  'Hermine des glaces','Hermine des glaces','assassin',  'fuyard',       'froid',  0.86,
                     { id: 'givre', cd: 7, rayon: 1.8, duree: 2.5 }),
    prisme:   GEN_AN('prisme',   'Prisme animé',      'Prisme animé',      'aura',      'garde',        'foudre', 1.00,
                     { id: 'eclat', cd: 0, degats: 1.4, rayon: 2 }),

    /* LES CHAMPIGNONS — le poison, partout */
    limace:   GEN_AN('limace',   'Limace baveuse',    'Limace baveuse',    'targier',   'bruiser',      'poison', 1.00,
                     { id: 'crachat', cd: 7, rayon: 1.8, duree: 7 }),
    guepe:    GEN_AN('guepe',    'Guêpe fongique',    'Guêpe fongique',    'essaim',    'swarmer',      'poison', 0.74,
                     { id: 'spores', cd: 9, rayon: 2.4, duree: 5 }),
    bolet:    GEN_AN('bolet',    'Bolet marcheur',    'Bolet marcheur',    'rempart',   'garde',        'poison', 1.15,
                     { id: 'eclat', cd: 0, degats: 1.2, rayon: 2.6 }),

    /* LA LAVE — le feu, et ce qui le supporte */
    basilic:  GEN_AN('basilic',  'Basilic de scorie', 'Basilic de scorie', 'lancier',   'rusher',       'feu',    1.08,
                     { id: 'embrase', cd: 5, duree: 4 }),
    scorpion: GEN_AN('scorpion', 'Scorpion de braise','Scorpion de braise','traqueur',  'flanker',      'feu',    0.98,
                     { id: 'fracture', cd: 9, perte: 0.4, duree: 5 }),
    fournaise: GEN_AN('fournaise','Gueule de fournaise','Gueule de fournaise','mage',   'zone_caster',  'feu',    1.12,
                     { id: 'crachat', cd: 6, rayon: 2.6, duree: 5 }),

    /* LES MORTS — l’ombre, et ce qui ne reste pas mort */
    goule:    GEN_AN('goule',    'Goule affamée',     'Goule affamée',     'costaud',   'meute',        'ombre',  1.02,
                     { id: 'drain', cd: 8, part: 0.4 }),
    spectre:  GEN_AN('spectre',  'Spectre de mineur', 'Spectre de mineur', 'assassin',  'flanker',      'ombre',  0.94,
                     { id: 'voile', cd: 9, duree: 2.2 }),
    liche:    GEN_AN('liche',    'Petite liche',      'Petite liche',      'mage',      'ranged_kiter', 'ombre',  1.10,
                     { id: 'reveil', cd: 14, max: 2 }),
  };
  GameData.animalById = id => GameData.ADV_ANIMALS[id] || null;

  // ---------- LES THÈMES DE VAGUE ----------
  // Une vague n'est plus un tirage uniforme : elle a un THÈME qui fixe ses
  // ratios (part de faune, part de tireurs) — et deux vagues successives d'une
  // même salle changent toujours de thème. C'est ce qui fait qu'une salle se
  // RACONTE : d'abord la meute, puis l'escouade qui la suivait.
  //   animalRatio / rangedRatio : remplacent les ratios calculés par l'étage ;
  //   count / hpMult / dmgMult  : l'essaim est nombreux mais frêle ;
  //   formation                 : impose un schéma de placement (cf. applyFormation).
  GameData.WAVE_THEMES = {
    meute:       { id: 'meute',       icon: '', name: 'Meute',       animalRatio: 0.85, rangedRatio: 0.05 },
    escouade:    { id: 'escouade',    icon: '', name: 'Escouade',    animalRatio: 0.08, rangedRatio: 0.2 },
    tirailleurs: { id: 'tirailleurs', icon: '', name: 'Tirailleurs', animalRatio: 0.05, rangedRatio: 0.7 },
    essaim:      { id: 'essaim',      icon: '', name: 'Essaim',      animalRatio: 0.55, rangedRatio: 0.05,
                   count: 1.6, hpMult: 0.6, dmgMult: 0.75, formation: 'essaim' },
  };
  GameData.waveTheme = id => GameData.WAVE_THEMES[id] || null;

  // ---------- LES SALLES QUI SE COMBATTENT ----------
  GameData.ADV_FIGHT_ROOMS = { combat: 1, elite: 1, boss: 1, chasse: 1 };
  GameData.advIsFight = tplId => !!GameData.ADV_FIGHT_ROOMS[tplId];

  // ---------- L'ARÈNE ----------
  GameData.ARENA = {
    grid: 13,
    meleeReach: 0.75,
    minCell: 20, maxSide: 560,
  };

  // ---------- POSTURES D'IA (JOUEUR) ----------
  // Chaque classe a 2-3 postures sélectionnables. La posture change le ciblage,
  // le positionnement et l'utilisation des capacités en mode AUTO.
  //
  // LE BLOC `pol` EST LA POSTURE-POLITIQUE : `id/icon/name/desc` sont pour
  // l'écran, `pol` est pour le moteur. Pas de table parallèle — une posture est
  // UN objet, sinon les deux dérivent.
  //   cible      : surclasse le `ia.veut` du pouvoir quand elle est posée ;
  //                null = on laisse le pouvoir décider ;
  //   prio       : poids PAR TAG (cf. POWER_TAGS) — départage deux pouvoirs
  //                prêts en même temps ;
  //   seuilAllie : PV% d'un allié sous lequel un soin/bouclier se justifie ;
  //   groupe     : ennemis minimum pour lâcher une zone ;
  //   garde      : true = on garde les longues recharges pour une élite/un boss.
  // `pol` ne pilote QUE le choix du pouvoir et le surclassement de cible : le
  // PLACEMENT reste au `switch` de postures de l'arène.
  // AUCUN réglage joueur supplémentaire : on choisit une intention, pas trois
  // cases à cocher.
  GameData.AI_STANCES = {
    guerrier: [
      { id: 'berserker', icon: '', name: 'Berserker', desc: 'DPS max — vise le PV le plus bas, fonce',
        pol: { cible: 'faible', prio: { degats: 1.6, zone: 1.1, soin: 0.5 }, seuilAllie: 0.4 } },
      { id: 'sentinel',  icon: '', name: 'Sentinelle', desc: 'Protège l\'allié le plus blessé, reste proche',
        pol: { cible: 'menace', prio: { bouclier: 1.8, soin: 1.4, degats: 0.7 }, seuilAllie: 0.75 } },
    ],
    garde: [
      { id: 'mur',      icon: '', name: 'Mur', desc: 'Provocation au contact, ne poursuit jamais',
        pol: { cible: 'proche', prio: { controle: 2.0, bouclier: 1.5, degats: 0.7 }, groupe: 2 } },
      { id: 'vengeur',  icon: '', name: 'Vengeur', desc: 'Provocation + contre-attaque, punit les attaquants',
        pol: { cible: 'menace', prio: { controle: 1.5, degats: 1.3 } } },
    ],
    tireur: [
      { id: 'harceleur',  icon: '', name: 'Harceleur', desc: 'Kite le plus proche, toujours en mouvement',
        pol: { cible: 'proche', prio: { degats: 1.3, mobilite: 1.4, controle: 1.1 } } },
      { id: 'executeur',  icon: '', name: 'Exécuteur', desc: 'Vise le PV le plus bas, portée max',
        pol: { cible: 'faible', prio: { degats: 1.6, debuff: 1.2, zone: 0.6 }, garde: true } },
    ],
    mage: [
      { id: 'tempete',    icon: '', name: 'Tempête', desc: 'AoE sur les groupes d\'ennemis',
        pol: { cible: 'groupe', prio: { zone: 2.0, degats: 1.2, controle: 0.9, soin: 0.6 }, groupe: 3 } },
      { id: 'focaliseur', icon: '', name: 'Focaliseur', desc: 'Burst monocible sur une seule cible',
        pol: { cible: 'menace', prio: { degats: 1.7, debuff: 1.3, zone: 0.5 } } },
    ],
    artificier: [
      { id: 'sapeur',   icon: '', name: 'Sapeur', desc: 'Bombe au cœur des groupes',
        pol: { cible: 'groupe', prio: { zone: 1.8, degats: 1.2, bouclier: 0.8 }, groupe: 3 } },
      { id: 'piegeur',  icon: '', name: 'Piégeur', desc: 'Zones de déni, contrôle le terrain',
        pol: { cible: 'proche', prio: { controle: 1.7, zone: 1.4, degats: 0.9 } } },
    ],
    eclaireur: [
      { id: 'eclaireur', icon: '', name: 'Éclaireur', desc: 'Esquive les zones en priorité, très mobile',
        pol: { cible: 'proche', prio: { mobilite: 1.6, bouclier: 1.3, degats: 1.0 } } },
      { id: 'assassin',  icon: '', name: 'Assassin', desc: 'Burst le PV le plus bas, frappe et fuit',
        pol: { cible: 'arriere', prio: { degats: 1.6, mobilite: 1.3, zone: 0.5 }, seuilAllie: 0.4 } },
    ],
    soigneur: [
      { id: 'triage',  icon: '', name: 'Triage', desc: 'Soigne le PV% le plus bas en priorité',
        pol: { cible: 'blesse', prio: { soin: 2.2, bouclier: 1.5, degats: 0.4 }, seuilAllie: 0.85 } },
      { id: 'berger',  icon: '', name: 'Berger', desc: 'Reste au centre du groupe, soigne + buff',
        pol: { cible: 'blesse', prio: { soin: 1.6, buff: 1.4, bouclier: 1.3, degats: 0.6 }, seuilAllie: 0.65 } },
    ],
    barde: [
      { id: 'chef',     icon: '', name: 'Chef', desc: 'Buff le groupe, reste au centre',
        pol: { cible: 'groupe', prio: { buff: 1.8, soin: 1.3, zone: 1.0, degats: 0.7 } } },
      { id: 'dueliste', icon: '', name: 'Dueliste', desc: 'Debuff les ennemis, focus fire',
        pol: { cible: 'menace', prio: { debuff: 1.7, controle: 1.3, degats: 1.1 } } },
    ],
    general: [
      { id: 'commandant',  icon: '', name: 'Commandant', desc: 'Ralliement + buff, soutien',
        pol: { cible: 'blesse', prio: { buff: 2.0, soin: 1.6, bouclier: 1.4, degats: 0.6 }, groupe: 3 } },
      { id: 'combattant',  icon: '', name: 'Combattant', desc: 'Mêlée DPS, au contact',
        pol: { cible: 'faible', prio: { degats: 1.8, controle: 1.1, mobilite: 1.2, buff: 0.7 }, seuilAllie: 0.45 } },
    ],
  };
  // Le repli quand une posture est inconnue ou muette sur un point.
  GameData.AI_POL_DEFAUT = { cible: null, prio: {}, seuilAllie: 0.6, groupe: 2, garde: false };
  GameData.stancesFor = cls => GameData.AI_STANCES[cls] || GameData.AI_STANCES.guerrier;
  GameData.defaultStance = cls => (GameData.AI_STANCES[cls] || GameData.AI_STANCES.guerrier)[0].id;
  // Une posture se retrouve par son SEUL id : l'arène ne connaît pas la classe
  // du porteur au moment où elle lit sa politique.
  GameData.stanceById = function (id) {
    for (const c in GameData.AI_STANCES)
      for (const s of GameData.AI_STANCES[c]) if (s.id === id) return s;
    return null;
  };
  GameData.polOf = function (id) {
    const s = GameData.stanceById(id);
    return Object.assign({}, GameData.AI_POL_DEFAUT, (s && s.pol) || {});
  };

  // ---------- LES TABLES DE BUTIN ----------
  // Ce qu'un biome du donjon peut rendre. `res` : ressources tirées au sort ;
  // les chances d'objet/plan/relique/héros sont par EXPÉDITION.
  //
  // LE DONJON EST LA SEULE SOURCE DES RESSOURCES DE VILLE.
  //
  // Elles venaient du Front (une ville = un siège idle). Le Front a été retiré,
  // et SIX d'entre elles — brume, chanvre, colle, ambre, zephyr, vieilacier —
  // sont restées sans aucune provenance : introuvables, dans un jeu qui les
  // réclame quand même. Le QG s'arrêtait donc net au niveau 6 (le niveau 7
  // exige 7 brumes), et avec lui TOUS les plafonds qu'il commande — Jardin,
  // pôles, ingénierie. Deux recettes d'alambic (brouillard, verre d'ambre)
  // et les parchemins qui en dépendent étaient infabricables pour la même
  // raison. Aucun test ne pouvait le voir : chaque table, prise seule, est
  // parfaitement valide. C'est le croisement source × puits qui manquait.
  //
  // RÈGLE POSÉE ICI, à tenir : UN BIOME = UN TIER = SES QUATRE RESSOURCES.
  // CITY_RES est déjà découpé par paquets de 4 (data-core.js : tier = 2 +
  // ⌊i/4⌋), et les quatre biomes profonds sont déjà alignés dessus. On
  // complète donc les paquets au lieu d'inventer une distribution :
  //   cristaux    (étages 21-30) → ressources 1-4   : therma ferblanc selgemme brume
  //   champignons (étages 31-40) → ressources 5-8   : granit nacre chanvre colle
  //   lave        (étages 41-50) → ressources 9-12  : ambre charbon huile zephyr
  //   morts       (étages 51-60) → ressources 13-16 : pollenor vieilacier soiefine orroyal
  // Les quatre ressources d'un paquet pèsent le MÊME poids : aucune n'est le
  // maillon rare qui refait un blocage. L'étage exigé par le QG tombe dans le
  // biome qui livre la ressource demandée (QG 7 → étage 29, en plein cristaux).
  const GEN_LT = (biome, res, item, plan, relic, hero) => ({ biome, res, item, plan, relic, hero });
  GameData.LOOT_TABLES = [
    GEN_LT('tour',        [['food', 40], ['mat1', 30], ['cuivre', 20], ['etai', 10]],
       0.55, 0.06, 0.02, 0.10),
    GEN_LT('grotte',      [['cuivre', 30], ['bronze', 25], ['mat1', 20], ['salpetre', 15], ['lingot_cuivre', 10]],
       0.65, 0.10, 0.04, 0.10),
    GEN_LT('cristaux',    [['mat2', 24], ['fer', 20], ['lingot_bronze', 8],
                           ['therma', 12], ['ferblanc', 12], ['selgemme', 12], ['brume', 12]],
       0.72, 0.14, 0.06, 0.09),
    GEN_LT('champignons', [['mat3', 22], ['argent', 17], ['essence', 14], ['lingot_fer', 7],
                           ['granit', 10], ['nacre', 10], ['chanvre', 10], ['colle', 10]],
       0.80, 0.18, 0.09, 0.08),
    GEN_LT('lave',        [['or', 18], ['cobalt', 16], ['obsidienne', 14], ['parts', 12],
                           ['ambre', 10], ['charbon', 10], ['huile', 10], ['zephyr', 10]],
       0.88, 0.22, 0.13, 0.07),
    GEN_LT('morts',       [['astral', 20], ['fabric', 13], ['catalyseur', 7],
                           ['pollenor', 15], ['vieilacier', 15], ['soiefine', 15], ['orroyal', 15]],
       0.95, 0.28, 0.18, 0.06),
  ];
  GameData.lootTable = biome => GameData.LOOT_TABLES.find(l => l.biome === biome) || GameData.LOOT_TABLES[0];
  // LE PREMIER COMPAGNON NE SE TIRE PAS AU SORT.
  // `hero` ci-dessus est une CHANCE par étage : elle convient pour le deuxième
  // et le troisième compagnon, pas pour le premier. Une partie qui n'a pas de
  // chance reste à un seul personnage — et le gardien de l'étage 5 en demande
  // deux (mesuré : 0 % de victoires seul, quel que soit le niveau). Tant que le
  // roster est VIDE, le donjon rend donc quelqu'un d'office à cet étage.
  // `etage: 2` : la première salle reste une salle de garde qu'on fait seul
  // (c'est la présentation du combat), la deuxième donne le camarade.
  GameData.GEN_PREMIER_COMPAGNON = { etage: 2 };
  // quantité de base d'une ressource rapportée, selon le tier + profondeur
  // LE BUTIN D'UN RAMASSAGE.
  //
  // Il était trop généreux, et surtout il EXPLOSAIT avec le tier : × 3,2 par
  // biome, soit 2 255 unités dès le premier étage du sixième biome. À ce
  // régime, une descente rendait inutile tout ce que la Production fabrique —
  // et c'est le problème le plus grave qu'un incrémental puisse avoir, parce
  // qu'il vide de leur sens huit onglets d'un coup.
  //
  // Trois corrections, dans l'ordre d'importance :
  //   — la base passe de 6 à 3 : une salle rapporte de quoi compléter, pas de
  //     quoi se passer de produire ;
  //   — la marche entre biomes descend de 3,2 à 2,1 : elle reste franche (un
  //     biome vaut deux fois le précédent) sans devenir une falaise ;
  //   — la profondeur pèse un peu plus (0,12 → 0,16), pour que ce soit
  //     DESCENDRE qui paie, et non pas simplement atteindre un biome.
  //
  // Résultat : T1 étage 1 passe de 7 à 3, T6 étage 1 de 2 255 à 156, et T6
  // étage 60 de 16 509 à 1 244. Le butin reste une belle récompense, il cesse
  // d'être un raccourci.
  GameData.lootAmount = (tier, depth) => Math.ceil(3 * Math.pow(2.1, Math.max(0, tier - 1)) * (1 + depth * 0.16));

  // ============================================================
  // LA FORGE ARME LA NURSERIE
  // ============================================================
  // Une unité sortait de la Nurserie les mains vides, pendant que la Forge
  // empilait des exemplaires que personne ne réclamait. Deux systèmes côte à
  // côte, sans lien : c'est exactement ce que la règle du double lien interdit.
  //
  // Désormais, faire naître une unité CONSOMME de l'équipement — une arme et
  // une armure, pris dans les râteliers. Et la comptabilité se fait PAR TYPE,
  // pas par tier : une lance est une lance, qu'elle soit en bois ou en acier
  // astral. Sans quoi il faudrait forger la bonne génération au bon moment,
  // ce qui bloquerait la Nurserie à chaque montée de tier.
  //
  // SANS ÉQUIPEMENT, RIEN NE SORT. L'éclosion patiente, elle ne produit pas
  // d'unité désarmée : une unité sans arme fausserait tous les calculs de
  // bataille et se lirait comme un bug.
  //
  // (VAGUE MÉTAL) LES RÂTELIERS ONT DISPARU. Une unité ne réclame plus une
  // arme et une armure FORGÉES — elle réclame du MÉTAL, qu'on lui façonne à
  // la naissance. Même arbitrage (les hauts tiers coûtent cher), une chaîne
  // de moins à entretenir : la Forge sert l'armée entière par ses TIERS, pas
  // par un stock d'exemplaires.
  // (DÉMÉNAGÉ) NAISSANCE_METAL / metalNaissance vivent désormais dans
  // `data-economy.js`, à côté des recettes d'éclosion. Ils étaient ici par
  // accident d'histoire, et ce fichier se charge APRÈS `data-world.js` : la
  // dépense était donc invisible pour l'audit des tiers, qui lisait une
  // fonction pas encore définie.
