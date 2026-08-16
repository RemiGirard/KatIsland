/* ============================================================
   GRIFFES & PLUMES — data-battle.js (5/6)
   Sorts/Grimoire, forge (max enclumes), ingénierie de guerre,
   boss de carte, constantes BALANCE.
   ============================================================ */
"use strict";

  // ============================================================
  // §D13-D4 : SORTS & PARCHEMINS — le Grimoire de la Cuisine
  // Un PARCHEMIN = consommable de bataille (fabriqué à la Cuisine) ; le lancer
  // jette le SORT au niveau permanent du Grimoire (1..5, upCost = passer de
  // lvl à lvl+1). battle.js consomme spellStats(id, lvl) via castSpell.
  // Convention : stat effective = base + perLvl × niveau (ex : chaine base
  // count 4, perLvl 1 → « rebondit sur 4+niv ennemis »).
  // ============================================================
  // §D15-8 : statsView = [{key,label,icon,unit}] — les stats PERTINENTES du sort,
  // affichées par le Grimoire en tableau chiffré base (niv 1) → actuel → prochain.
  const SV = (key, label, icon, unit) => ({ key, label, icon, unit: unit || '' });
  const SPELL = (id, name, icon, desc, base, perLvl, up, statsView) => ({
    id, name, icon, desc, maxLvl: 5,
    battle: { kind: id, base, perLvl },
    statsView: statsView || [],
    upCost: function (lvl) {
      lvl = Math.max(1, lvl | 0);
      const c = { medals: Math.round(up.medals * Math.pow(2, lvl - 1)) };
      for (const k in up) if (k !== 'medals') c[k] = Math.max(1, Math.round(up[k] * Math.pow(1.8, lvl - 1)));
      // §D13 : les niveaux 4-5 du Grimoire réclament du Pollen d'Or (ville 13 —
      // late game OPTIONNEL, jamais bloquant : les sorts restent lançables au niv 3).
      if (lvl >= 4) c.pollenor = (lvl - 3) * 2;
      // LE DERNIER CRAN SE PAIE EN POLLEN ABYSSAL — l'essence raffinée au
      // tier 4, que la Cuisine produisait sans qu'aucun consommateur ne
      // l'attende. La magie est faite d'essence : c'est la seule ressource du
      // jeu dont le raffinage le plus poussé avait un sens ici. Même contrat
      // que le Pollen d'Or juste au-dessus — le niveau 5 est OPTIONNEL, un
      // sort reste lançable à 4 sans jamais toucher à la marmite.
      // PIÈGE : upgradeSpell paie upCost(lvl COURANT) — le passage 4→5 paie
      // upCost(4). Une garde `lvl >= 5` n'est donc JAMAIS payée par personne :
      // c'est upCost(5) qui la porterait, et il n'existe pas d'achat au-delà
      // du niveau max. La borne est `>= 4`, comme pollenor.
      if (lvl >= 4) c.essence_t4 = 2;
      return c;
    },
  });
  GameData.SPELLS = [
    SPELL('meteore', 'Météore de Gouttière', '🌠',
      'Un caillou céleste livré sans sonnette : ombre au sol, gros boum, braises comprises.',
      { power: 90, radius: 70, delay: 1.2 }, { power: 45, radius: 6 }, { medals: 16, feugras: 2 },
      [SV('power', 'Dégâts', '💥'), SV('radius', 'Zone', '📏', 'px'), SV('delay', 'Délai', '⏱️', 's')]),
    SPELL('blizzard', 'Blizzard de Congélateur', '❄️',
      'Une zone entière ralentie à 70% et grignotée par le froid. Le congélateur ne pardonne pas.',
      { power: 6, radius: 80, duration: 5, slow: 0.7 }, { power: 3, radius: 5, duration: 1 }, { medals: 12, vapeur: 3 },
      [SV('power', 'Dégâts/s', '💥'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's'), SV('slow', 'Ralenti', '🐌', '%')]),
    SPELL('chaine', 'Chaîne de Rancunes', '⚡',
      'Un éclair qui rebondit d’ennemi en ennemi. Chaque rebond règle un vieux compte.',
      { power: 50, count: 4, radius: 120 }, { power: 25, count: 1 }, { medals: 12, vapeur: 3 },
      [SV('power', 'Dégâts', '💥'), SV('count', 'Rebonds', '🔗'), SV('radius', 'Portée', '📏', 'px')]),
    SPELL('epines', 'Haie de Ronces Administratives', '🌵',
      'Un mur d’épines pousse du sol : ça bloque, ça pique, et ça exige un formulaire.',
      { power: 8, len: 90, duration: 5 }, { power: 3, len: 15, duration: 1 }, { medals: 10, acierplume: 2 },
      [SV('power', 'Dégâts/s', '💥'), SV('len', 'Longueur', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('poigne', 'Poigne Spectrale', '👻',
      'Une main d’outre-tombe aspire les ennemis vers un point. Personne ne serre cette patte.',
      // power/perLvl manquait — la stat n'augmentait JAMAIS du niv 1 au 5
      // (trois colonnes identiques au Grimoire). Et son ÉTIQUETTE mentait :
      // dans le handler de battle-core, `power` est la FORCE D'ASPIRATION
      // (purement cinétique, aucun PV retiré) — on l'affiche pour ce qu'elle est.
      { radius: 110, duration: 1.5, power: 60 }, { radius: 15, duration: 0.3, power: 30 }, { medals: 14, brouillard: 2 },
      [SV('power', 'Aspiration', '🌀'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('pluie', 'Pluie Réparatrice', '🌧️',
      'Une averse verte qui recoud les alliés sur la durée. Météo capricieuse, facturation stable.',
      { power: 10, radius: 85, duration: 6 }, { power: 5, duration: 1 }, { medals: 10, vapeur: 2 },
      [SV('power', 'Soins/s', '💚'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('poulet', 'Malédiction du Poulet', '🐔',
      'Transforme les ennemis en volailles inoffensives 5 s. Les plumes ne sont pas remboursées.',
      { count: 2, duration: 5, radius: 90 }, { count: 1 }, { medals: 14, poudre: 2 },
      [SV('count', 'Cibles', '🎯'), SV('duration', 'Durée', '⏱️', 's'), SV('radius', 'Zone', '📏', 'px')]),
    SPELL('seisme', 'Séisme de Salon', '🌋',
      'Une onde de choc qui repousse et sonne tout le monde. Le tapis ne s’en est jamais remis.',
      { power: 30, radius: 100, push: 60, stun: 0.8 }, { power: 15, stun: 0.2 }, { medals: 14, poudre: 3 },
      [SV('power', 'Dégâts', '💥'), SV('radius', 'Zone', '📏', 'px'), SV('push', 'Poussée', '🌀', 'px'), SV('stun', 'Étourdi', '💫', 's')]),
    SPELL('clone', 'Double d’Ombre', '🌑',
      'Duplique une unité alliée pendant 12 s. L’original touche des droits d’auteur.',
      { count: 1, duration: 12 }, { duration: 3 }, { medals: 18, brouillard: 3 },
      [SV('count', 'Copies', '👥'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('ames', 'Moisson Polie des Âmes', '💠',
      'Pendant 8 s, chaque ennemi qui tombe soigne les alliés proches. Rien ne se perd, tout se soigne.',
      { power: 25, radius: 80, duration: 8 }, { power: 12, duration: 1 }, { medals: 20, filarcane: 1 },
      [SV('power', 'Soins', '💚'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('sablier', 'Sablier du Contrôleur', '⏳',
      'Fige TOUS les ennemis 1,5 s (+0,3 s par niveau). Le temps, lui, pointe toujours à l’heure.',
      { duration: 1.5 }, { duration: 0.3 }, { medals: 22, verreambre: 2 },
      [SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('fanfare', 'Fanfare de Charge', '🎺',
      'Vos unités convergent au pas de course (vitesse ×1,5) pendant 6 s. La musique adoucit rarement.',
      { duration: 6, speed: 1.5 }, { duration: 1 }, { medals: 16, acierplume: 3 },
      [SV('duration', 'Durée', '⏱️', 's'), SV('speed', 'Vitesse', '🏃', '×')]),
    // §D15-8 : les 8 nouveaux sorts (13-20)
    SPELL('glace', 'Muraille de Glace Rancunière', '🧊',
      'Un mur de glace jaillit du sol : ça bloque le passage et ça gèle les insistants. La politesse n’aide pas.',
      { power: 12, len: 90, duration: 5, freeze: 1 }, { power: 6, len: 12, duration: 1, freeze: 0.2 }, { medals: 14, brouillard: 2 },
      [SV('power', 'Dégâts', '💥'), SV('len', 'Longueur', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's'), SV('freeze', 'Gel', '🧊', 's')]),
    SPELL('tornade', 'Tornade de Grand Ménage', '🌪️',
      'Une tornade errante traverse le champ et disperse les rangs ennemis. Rien n’est rangé, tout est déplacé.',
      { power: 10, radius: 55, duration: 6, push: 50 }, { power: 5, radius: 5, duration: 1 }, { medals: 16, vapeur: 3 },
      [SV('power', 'Dégâts/s', '💥'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's'), SV('push', 'Poussée', '🌀', 'px')]),
    SPELL('racines', 'Racines Syndiquées', '🌿',
      'Le sol attrape les pattes ennemies de la zone et refuse de lâcher. Négociations en cours, sans issue.',
      { power: 6, radius: 85, duration: 3 }, { power: 3, radius: 8, duration: 0.6 }, { medals: 14, verreambre: 1 },
      [SV('power', 'Dégâts/s', '💥'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Immobilisation', '⛓️', 's')]),
    SPELL('mines', 'Mines à Moustaches', '💣',
      'Sème des mines discrètes qui sautent au contact. Le panneau « attention » est facturé en option.',
      { count: 3, power: 80, radius: 45 }, { count: 1, power: 35 }, { medals: 16, poudre: 3 },
      [SV('count', 'Mines', '💣'), SV('power', 'Dégâts', '💥'), SV('radius', 'Zone', '📏', 'px')]),
    SPELL('benediction', 'Bénédiction Notariée', '✨',
      'Un bouclier absorbant couvre les alliés de la zone. Les coups reçus sont adressés au service contentieux.',
      { power: 60, radius: 90, duration: 8 }, { power: 30, duration: 1 }, { medals: 18, filarcane: 1 },
      [SV('power', 'Absorption', '🛡️'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('rayon', 'Rayon du Midi Exact', '🔆',
      'Un faisceau continu balaie une ligne droite. Ce qui dépasse est prié de ne plus dépasser.',
      { power: 30, len: 170, duration: 3 }, { power: 14, len: 15, duration: 0.5 }, { medals: 18, feugras: 2 },
      [SV('power', 'Dégâts/s', '💥'), SV('len', 'Portée', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('malediction', 'Malédiction à la Bougie', '🕯️',
      'Les ennemis de la zone encaissent davantage de dégâts. La bougie brûle, la facture aussi.',
      { power: 0.3, radius: 90, duration: 8 }, { power: 0.08, duration: 1 }, { medals: 20, brouillard: 3 },
      [SV('power', 'Vulnérabilité', '🕯️', '%'), SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('aigle', 'Aigle des Recouvrements', '🦅',
      'Un rapace fantôme traverse la carte et frappe tout sur son passage. Il ne repasse pas : il n’en a pas besoin.',
      { power: 110, radius: 55 }, { power: 55, radius: 4 }, { medals: 22, catalyseur: 1 },
      [SV('power', 'Dégâts', '💥'), SV('radius', 'Envergure', '📏', 'px')]),
    // MAJ majeure §7 : les 5 sorts d'alchimie de la grande mise à jour
    SPELL('piquants', 'Garnisons Urticantes', '🌵',
      'Vos bâtiments se hérissent : tout ennemi qui passe à côté se fait mordre. Le règlement ne dit rien sur les orties.',
      { power: 8, duration: 20 }, { power: 3, duration: 4 }, { medals: 14, acierplume: 2 },
      [SV('power', 'Dégâts/morsure', '💥'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('gel', 'Grand Gel de Zone', '🥶',
      'Fige net toutes les troupes ennemies de la zone, avec une morsure de froid en prime. Le dégel n’est pas remboursé.',
      { radius: 90, duration: 2.5, power: 20 }, { radius: 8, duration: 0.5, power: 10 }, { medals: 16, vapeur: 3 },
      [SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Gel', '🧊', 's'), SV('power', 'Dégâts', '💥')]),
    SPELL('brouillard', 'Purée de Plumes', '🌫️',
      'Une nappe de brouillard où les tireurs ennemis perdent le nord (et leurs cibles). Les archers détestent ce sort.',
      { radius: 100, duration: 8 }, { radius: 12, duration: 2 }, { medals: 14, brouillard: 2 },
      [SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's')]),
    SPELL('lave', 'Nappe de Lave', '🌋',
      'Le sol devient lave : quiconque y marche s’en souvient brièvement. Prévoir des coussinets neufs.',
      { radius: 80, duration: 6, power: 25 }, { radius: 6, duration: 1, power: 10 }, { medals: 18, feugras: 3 },
      [SV('radius', 'Zone', '📏', 'px'), SV('duration', 'Durée', '⏱️', 's'), SV('power', 'Dégâts/s', '💥')]),
    SPELL('spectres', 'Ost Spectral', '👻',
      'Invoque des guerriers spectraux turquoise qui se battent pour vous ~30 s avant de rendre leur brume.',
      { count: 4, duration: 30 }, { count: 1, duration: 5 }, { medals: 20, brouillard: 3 },
      [SV('count', 'Spectres', '👻'), SV('duration', 'Durée', '⏱️', 's')]),
  ];
  // stats effectives d'un sort à un niveau de Grimoire donné
  GameData.spellStats = function (id, lvl) {
    const sp = GameData.SPELLS.find(s => s.id === id);
    if (!sp) return null;
    lvl = Math.max(1, Math.min(sp.maxLvl, (lvl | 0) || 1));
    const out = { kind: sp.battle.kind, lvl };
    for (const k in sp.battle.base) {
      let v = sp.battle.base[k] + (sp.battle.perLvl[k] || 0) * lvl;
      // REBALANCE : les sorts étaient trop discrets en bataille. On muscle les
      // dégâts/soins/absorption (power ×1,6) pour que la magie pèse vraiment sur
      // le cours d'un combat. Les durées, elles, ne bougent pas : la batterie
      // de tests est calée dessus et l'équilibre temporel tient debout.
      if (k === 'power') v *= 1.6;
      out[k] = +v.toFixed(3);
    }
    return out;
  };
  // recette du parchemin de chaque sort : papier (mat3) + craftées thématiques
  // + une pincée de cityRes. Fabriqué à la Cuisine, consommé en bataille.
  GameData.PARCHMENTS = {
    meteore:  { cost: { mat3: 12, feugras: 1, charbon: 2 }, craftTime: 90 },
    blizzard: { cost: { mat3: 10, vapeur: 2, brume: 2 }, craftTime: 80 },
    chaine:   { cost: { mat3: 10, vapeur: 2, ferblanc: 2 }, craftTime: 80 },
    epines:   { cost: { mat3: 8, acierplume: 1, chanvre: 2 }, craftTime: 70 },
    poigne:   { cost: { mat3: 10, brouillard: 1, brume: 2 }, craftTime: 85 },
    pluie:    { cost: { mat3: 8, vapeur: 1, therma: 2 }, craftTime: 60 },
    poulet:   { cost: { mat3: 10, poudre: 1, selgemme: 2 }, craftTime: 75 },
    seisme:   { cost: { mat3: 12, poudre: 2, granit: 2 }, craftTime: 95 },
    clone:    { cost: { mat3: 14, brouillard: 2, soiefine: 1 }, craftTime: 110 },
    ames:     { cost: { mat3: 14, filarcane: 1, ambre: 2 }, craftTime: 120 },
    sablier:  { cost: { mat3: 16, verreambre: 1, zephyr: 2 }, craftTime: 130 },
    fanfare:  { cost: { mat3: 12, acierplume: 2, colle: 2 }, craftTime: 100 },
    // §D15-8 : les 8 nouveaux — même pattern mat3 + craftée + cityRes
    glace:       { cost: { mat3: 12, vapeur: 2, nacre: 2 }, craftTime: 90 },
    tornade:     { cost: { mat3: 12, vapeur: 2, zephyr: 2 }, craftTime: 95 },
    racines:     { cost: { mat3: 10, verreambre: 1, chanvre: 2 }, craftTime: 85 },
    mines:       { cost: { mat3: 14, poudre: 2, vieilacier: 2 }, craftTime: 100 },
    benediction: { cost: { mat3: 14, filarcane: 1, pollenor: 2 }, craftTime: 110 },
    rayon:       { cost: { mat3: 14, verreambre: 1, ambre: 2 }, craftTime: 115 },
    malediction: { cost: { mat3: 12, brouillard: 2, charbon: 2 }, craftTime: 105 },
    aigle:       { cost: { mat3: 16, catalyseur: 1, orroyal: 1 }, craftTime: 130 },
    // MAJ majeure §7 : les 5 nouveaux — même pattern mat3 + craftée + cityRes
    piquants:   { cost: { mat3: 10, acierplume: 1, chanvre: 2 }, craftTime: 85 },
    gel:        { cost: { mat3: 12, vapeur: 2, nacre: 2 }, craftTime: 95 },
    brouillard: { cost: { mat3: 12, brouillard: 2, brume: 2 }, craftTime: 90 },
    lave:       { cost: { mat3: 14, feugras: 2, charbon: 2 }, craftTime: 105 },
    spectres:   { cost: { mat3: 16, brouillard: 2, soiefine: 1 }, craftTime: 120 },
  };
  // section « parchemins » de la Cuisine — pattern POTIONS (consommables listés)
  GameData.PARCHMENT_ITEMS = GameData.SPELLS.map(sp => ({
    id: 'parch_' + sp.id, spell: sp.id,
    name: { cats: 'Parchemin : ' + sp.name, birds: 'Parchemin : ' + sp.name },
    icon: sp.icon, desc: sp.desc,
    cost: GameData.PARCHMENTS[sp.id].cost, craftTime: GameData.PARCHMENTS[sp.id].craftTime,
  }));
  GameData.CUISINE.parcheminItems = GameData.PARCHMENT_ITEMS;

  // ---------- §15 : FORGE MULTI-ENCLUMES (prime sur §9) ----------
  // La forge devient CONTINUE : des ENCLUMES reliées à des lignes d'armes/armures
  // font monter les tiers tout seuls. i=0 est possédée gratuitement au départ.
  GameData.FORGE = {
    maxAnvils: 6,
    // coût de l'enclume i (i>=1) : mat2/mat3/food, ×~3 par enclume.
    // §D13-E : fini parts/fabric ici — l'enclume 2 exigeait la Cuisine sans le dire
    // (dépendance cachée, AUD1). Les matériaux de base suffisent.
    // ÉQUILIBRAGE : la 2e enclume (i=1) ne coûte plus que du TIER 1 — elle arrive
    // pendant que le joueur n'a encore que nourriture et matériau 1. mat2/mat3
    // n'entrent qu'à partir de la 3e, quand ils sont effectivement débloqués.
    anvilCost: function (i) {
      if (i <= 0) return {};
      const m = Math.pow(3, i - 1); // i=1 => ×1, i=2 => ×3, i=3 => ×9…
      const c = { food: Math.round(6000 * m), mat1: Math.round(260 * m) };
      if (i >= 2) c.mat2 = Math.round(200 * Math.pow(3, i - 2));
      if (i >= 3) c.mat3 = Math.round(60 * Math.pow(3, i - 3));
      return c;
    },
    // MAJ majeure §5 : prérequis ALLÉGÉ — plus besoin que TOUTES les lignes
    // d'armes atteignent le tier. Il suffit que anvilLines(i) lignes (parmi les
    // 10, armes ET armures) atteignent le tier anvilReq(i) :
    // enclume 2 → 3 lignes ≥ T3 · enclume 3 → 6 lignes ≥ T6 · enclume 4 → 9 ≥ T9…
    anvilReq: i => 3 * i,
    anvilLines: i => Math.min(10, 3 * i),
    // ÉQUILIBRAGE : les 6 enclumes jalonnent la partie entière — la 2e en deux
    // jours, la dernière après deux mois et demi. Le tier des lignes ne suffit plus.
    anvilDays: i => [0, 2, 8, 20, 42, 78][i] || 0,
  };

  // ---------- §7bis (D5) : coûts courants qui ferment les exploits ----------
  // §D12-6 : farmSupplyCost est MORT avec le farm d'expédition. Personne ne ravitaille
  // une boucle qui n'existe plus.
  // DOJO CONTINU : franchir un niveau de piste coûte une ressource, payée à
  // l'achèvement du cycle (sinon le poste se met en pause). On REBRANCHE ici les
  // anciens coûts morts TRAINING.cost / CAT_TRAINING.cost (§7bis : plus de code trompeur).
  GameData.dojoDrainCost = function (trackId, lvl) {
    lvl = Math.max(0, lvl | 0);
    let c = null;
    if (GameData.TRAINING[trackId]) c = GameData.TRAINING[trackId].cost(lvl);
    else {
      for (const cat in GameData.CAT_TRAINING) {
        for (const up of GameData.CAT_TRAINING[cat]) if (up.id === trackId) c = up.cost(lvl);
      }
    }
    if (!c) return null;
    // TISSAGE (phase 1) : à partir du 5e cran, une piste réclame de la
    // BRINDILLE AMBRÉE — un raffiné de la Cuisine. Le Dojo ne vit plus en vase
    // clos : sans marmite, les pistes plafonnent. C'est du tier 1, donc payable
    // dès le premier jour par qui allume sa cuisine.
    if (lvl >= 5) c = Object.assign({}, c, { mat1_t2: 1 + Math.floor((lvl - 5) / 5) });
    // TISSAGE (phase 3) : LE NECTAR RAFFINÉ AUX HAUTS CRANS.
    //
    // Le raffinage du nectar montait jusqu'au tier 4 pour personne : trois
    // ressources produites, zéro consommateur. Le Dojo est leur débouché
    // évident — une piste qui grimpe, ça se nourrit — et il n'avait qu'UN
    // seul lien avec la Cuisine (la brindille ambrée du 5e cran), posé très
    // tôt puis plus rien sur trente niveaux. Les crans 25 et 40 rallument ce
    // lien là où la partie se joue vraiment.
    //
    // Ce sont des crans TARDIFS et par piste : il y en a treize, et rien
    // n'oblige à pousser celle-ci. Le manque met le poste en pause, il ne
    // casse rien — principe de dégradation, jamais de blocage.
    if (lvl >= 25) c = Object.assign({}, c, { milk_t3: 1 + Math.floor((lvl - 25) / 6) });
    if (lvl >= 40) c = Object.assign({}, c, { milk_t4: 1 + Math.floor((lvl - 40) / 8) });
    return c;
  };

  // CE QUE L'ENTRAÎNEMENT COÛTE EN CHAIR.
  //
  // Une piste ne consommait que des ressources : elle tournait donc toute seule
  // pendant qu'on faisait autre chose, sans jamais rien coûter à l'armée. Un
  // entraînement, ça mobilise des recrues — et une recrue au Dojo n'est pas au
  // front. C'est ce qui donne son prix au temps qui passe.
  //
  // La facture est en UNITÉS DE BASE (le premier échelon de la faction), payée
  // à chaque cycle franchi et croissante avec le niveau. Elles sont CONSOMMÉES :
  // le Dojo devient un débouché pour la Nurserie, et progresser d'un cran se
  // décide contre l'armée qu'on garde.
  //
  // Rend `{ type, n }` ou null si l'unité de base n'existe pas encore.
  GameData.dojoUnitCost = function (trackId, lvl) {
    lvl = Math.max(0, lvl | 0);
    const base = GameData.DOJO2 && GameData.DOJO2.unitBase;
    if (!base) return null;
    // un cran tous les cinq niveaux : 1, 1, 2, 3, 5, 7…
    const n = Math.max(1, Math.round(Math.pow(1 + lvl / 5, 1.35)));
    return { type: base, n };
  };

  // ---------- INGÉNIERIE DE BATAILLE (MAJ majeure §3) ----------
  // Chaque bâtiment de bataille a sa (ou ses) piste(s), 100 niveaux chacune.
  // Rendement décroissant : eff(lvl) = 1 + K*(1 - 0.985^lvl), K propre à la piste.
  // La limite effective reste min(max, warCap()) — le QG débloque le plafond.
  // Coût : ×1.07/niv jusqu'au 10, ×1.10/niv au-delà (piste longue oblige).
  // TISSAGE (phase 2) : à partir du niveau 12 — le cran où le QG ouvre le
  // plafond suivant — un chantier d'ingénierie réclame de la POUDRE, distillée
  // à l'Alambic. On ne fortifie plus sans alchimie.
  GameData.bfWeaveCost = function (lvl, cost) {
    if (lvl < 12 || !cost) return cost;
    const c = Object.assign({}, cost);
    c.poudre = (c.poudre || 0) + Math.ceil(2 * Math.pow(1.14, lvl - 12));
    return c;
  };
  const bfEffK = K => lvl => 1 + K * (1 - Math.pow(0.985, Math.max(0, lvl)));
  const bfEff = bfEffK(0.8);
  // ÉQUILIBRAGE (échelle des tiers, docs/RESSOURCES.md) : l'ingénierie de bataille
  // exigeait parts/fabric/essence DÈS LE NIVEAU 0 — des ressources qui s'ouvrent au
  // QG 5-7. Résultat : elle était injouable pendant tout le début de partie.
  // Désormais un PALIER DE RESSOURCES par cran de plafond du QG
  // (warCap = 4 + 8·(qg−1)), pour que ce qui est atteignable soit payable :
  //   L0-11   T1  food + mat1                       (QG 1-2, plafond 4 puis 12)
  //   L12-19  T2  + mat2                            (QG 3,  plafond 20)
  //   L20-27  T2  + mat3                            (QG 4,  plafond 28)
  //   L28-35  T3  + la ressource T3 de la piste     (QG 5,  plafond 36)
  //   L36-43  T4  + la 1re ressource T4 de la piste (QG 6,  plafond 44)
  //   L44-51  T4  + la 2de ressource T4 de la piste (QG 7,  plafond 52)
  //   L52-59  T5  + mat1 raffiné (Cuisine)          (QG 8,  plafond 60)
  //   L60-67  T5  + t4a RAFFINÉ au tier 2           (QG 8+, plafond 68)
  //   L68-73  T5  + t4b RAFFINÉ au tier 3           (QG 9,  plafond 76)
  //   L74+    T5  + t4a RAFFINÉ au tier 4           (QG 10, plafond 76 = le bout)
  // `sig` = signature de la piste : { t3, t4a, t4b } — chaque piste garde son
  // identité de coût sans jamais devancer la frise de déblocage.
  //
  // LES TROIS DERNIERS CRANS SONT NEUFS, et ils réparent un trou.
  //
  // La Cuisine raffinait les mécanismes et le tissu jusqu'au tier 4 — six
  // ressources — sans qu'AUCUN consommateur ne les réclame nulle part. On
  // montait un étage de la pyramide qui ne menait à rien. L'ingénierie est
  // leur place naturelle : c'est le plus gros puits de fin de partie (8 pistes
  // × 100 niveaux), et ses pistes SONT déjà signées en parts/fabric — un
  // raffiné ne fait que prolonger l'identité de la piste au lieu d'ajouter un
  // ingrédient étranger. Comme les huit pistes se répartissent parts et fabric
  // dans les deux sens sur t4a et t4b, les SIX raffinés trouvent preneur.
  //
  // Le dernier cran est posé à 74 et pas à 90 : warCap = 4 + 8·(QG−1) et le QG
  // plafonne à 10, donc l'ingénierie s'arrête à 76. Un palier au-delà serait
  // du contenu que personne ne peut acheter — exactement le travers qu'on
  // corrige ici.
  const BF_STEPS = [
    { at: 12, res: 'mat2', q: 6 },
    { at: 20, res: 'mat3', q: 5 },
    { at: 28, res: 't3', q: 4 },
    { at: 36, res: 't4a', q: 3 },
    { at: 44, res: 't4b', q: 3 },
    { at: 52, res: 'mat1_t2', q: 2 },
    { at: 60, res: 'r4a2', q: 2 },
    { at: 68, res: 'r4b3', q: 2 },
    { at: 74, res: 'r4a4', q: 1 },
  ];
  // `r4a2` / `r4b3` / `r4a4` se LISENT : raffiné de la signature t4a au tier 2,
  // de t4b au tier 3, de t4a au tier 4. On les dérive de la signature au lieu
  // de les écrire piste par piste — sinon la même information vit à deux
  // endroits et la seconde copie finit par mentir.
  const bfRefined = (sig, key) => {
    const base = sig[key.slice(0, 3).replace('r', 't')];   // r4a2 → t4a
    return base ? base + '_t' + key.slice(3) : null;       // parts → parts_t2
  };
  const bfCost = (base, lvl, sig) => {
    lvl = Math.max(0, lvl | 0);
    const m = Math.pow(1.07, Math.min(10, lvl)) * Math.pow(1.10, Math.max(0, lvl - 10));
    const c = { food: Math.ceil(base.food * m), mat1: Math.ceil(base.mat1 * m) };
    for (const s of BF_STEPS) {
      if (lvl < s.at) continue;
      const res = (/^r4[ab]\d$/.test(s.res) ? bfRefined(sig, s.res) : sig[s.res]) || s.res;
      c[res] = (c[res] || 0) + Math.max(1, Math.ceil(s.q * Math.pow(1.11, lvl - s.at)));
    }
    // TISSAGE (phase 2) : à partir du niveau 12 — le cran où le QG ouvre le
    // plafond suivant — un chantier réclame de la POUDRE, distillée à l'Alambic.
    // On ne fortifie plus sans alchimie.
    return GameData.bfWeaveCost(lvl, c);
  };
  GameData.BUILDFORGE = {
    // --- Tour de garde : 3 pistes DISTINCTES (dégâts / nombre de tirs / cadence) ---
    tower:      { id: 'tower', icon: '🏹', name: 'Tours : projectiles', desc: 'Dégâts des flèches des tours', max: 100,
                  eff: bfEffK(1.0), cost: lvl => bfCost({ food: 800, mat1: 34 }, lvl, { t3: 'essence', t4a: 'parts', t4b: 'fabric' }) },
    // LA VOLÉE — le problème : « +1 flèche tous les 25 niveaux », c'était 24 crans
    // où il ne se passait RIEN. La solution : la volée a un POIDS continu, et une
    // flèche se REMPLIT au lieu d'apparaître d'un coup. Poids 1,63 = deux flèches,
    // la seconde à 63 % de dégâts. Chaque niveau la fait grossir, et le TOTAL au
    // niveau 100 reste ×5 — exactement l'ancien plafond : les tours ne gagnent pas
    // un gramme de puissance, elles gagnent de la lisibilité.
    towerCount: { id: 'towerCount', icon: '🎯', name: 'Tours : volée', desc: 'Des flèches en plus, qui montent en puissance à chaque niveau', max: 100,
                  eff: lvl => 1 + 4 * Math.pow(Math.min(100, Math.max(0, lvl)) / 100, 0.8),
                  // libellé lisible : « 2 flèches · 100 % + 63 % »
                  effText: function (lvl) {
                    const w = this.eff(lvl);
                    const full = Math.floor(w + 1e-6);
                    const frac = w - full;
                    const parts = [];
                    for (let i = 0; i < full; i++) parts.push('100 %');
                    if (frac > 0.005) parts.push(Math.round(frac * 100) + ' %');
                    return parts.length + ' flèche' + (parts.length > 1 ? 's' : '') + ' · ' + parts.join(' + ');
                  },
                  cost: lvl => bfCost({ food: 1100, mat1: 44 }, lvl, { t3: 'essence', t4a: 'parts', t4b: 'fabric' }) },
    towerRate:  { id: 'towerRate', icon: '⏱️', name: 'Tours : cadence', desc: 'Vitesse de tir des tours', max: 100,
                  eff: bfEffK(0.8), cost: lvl => bfCost({ food: 950, mat1: 38 }, lvl, { t3: 'milk', t4a: 'parts', t4b: 'fabric' }) },
    production: { id: 'production', icon: '🏭', name: 'Ateliers de garnison', desc: 'Vitesse de production des bâtiments', max: 100,
                  eff: bfEff, cost: lvl => bfCost({ food: 900, mat1: 36 }, lvl, { t3: 'milk', t4a: 'fabric', t4b: 'parts' }) },
    fortify:    { id: 'fortify', icon: '🏰', name: 'Murs moelleux', desc: 'PV des garnisons', max: 100,
                  eff: bfEff, cost: lvl => {
                    // §1 (D4) : les hauts murs se salpêtrent — 2e puits d'ingénierie
                    // pour l'alchimie. Le salpêtre est du TIER 1 : il peut arriver tôt.
                    const c = bfCost({ food: 850, mat1: 34 }, lvl, { t3: 'essence', t4a: 'fabric', t4b: 'parts' });
                    if (lvl >= 10) c.salpetre = Math.max(1, Math.ceil(2 * Math.pow(1.12, lvl - 10)));
                    return c;
                  } },
    // MAJ §3 : les fanions accélèrent la vitesse GÉNÉRALE des unités (plus
    // seulement la sortie de bâtiment) — K réduit, +~39% au niveau 100.
    rally:      { id: 'rally', icon: '🚩', name: 'Fanions de ralliement', desc: 'Vitesse générale de vos unités en bataille', max: 100,
                  eff: bfEffK(0.5), cost: lvl => bfCost({ food: 950, mat1: 38 }, lvl, { t3: 'milk', t4a: 'fabric', t4b: 'parts' }) },
    // MAJ §3 : l'Étendard devient améliorable — renforce son buff (+10%/étendard
    // de base, jusqu'à ~+20%/étendard au niveau 100).
    banner:     { id: 'banner', icon: '🎌', name: 'Étendards de guerre', desc: 'Renforce le buff des étendards capturés', max: 100,
                  eff: bfEffK(1.0), cost: lvl => bfCost({ food: 1000, mat1: 40 }, lvl, { t3: 'essence', t4a: 'fabric', t4b: 'parts' }) },
    // MAJ §3 : Points de contrôle — rendement en points LINÉAIRE plafonné à +20%
    // au niveau 100, et légère protection de la garnison (même bonus).
    flags:      { id: 'flags', icon: '⚑', name: 'Points de contrôle', desc: 'Rendement des points de contrôle (+20% max) et protection de leur garnison', max: 100,
                  eff: lvl => 1 + 0.2 * Math.min(100, Math.max(0, lvl)) / 100,
                  cost: lvl => bfCost({ food: 875, mat1: 35 }, lvl, { t3: 'essence', t4a: 'parts', t4b: 'fabric' }) },
  };
  // §D13-B : chaque niveau d'ingénierie est un CHANTIER — temps de construction en
  // secondes, accéléré par les ouvriers assignés (pattern workSpeedOf('war','site')).
  // MAJ §3 : courbe recalibrée pour 100 niveaux (~80 s au niv 1, ~100 min au niv 100).
  GameData.warBuildTime = lvl => Math.round(30 + 20 * Math.max(0, lvl) + 30 * Math.pow(1.05, Math.max(0, lvl)));


