/* ============================================================
   GRIFFES & PLUMES — state-general.js
   LE MOTEUR DE L'AVENTURE : roster, compagnie, DESCENTE INFINIE, butin, talents.

   LE MODÈLE (façon Diablo) : une expédition est une DESCENTE dans un donjon
   sans fond. On entre par la tour en ruine, on nettoie chaque étage — en auto
   (l'IA joue) ou à la main — puis on descend. Tous les 5 étages = checkpoint.
   Si on perd, l'expédition s'arrête et on récupère le butin accumulé.

   Trois règles qui tiennent tout :
   1. RIEN NE BLOQUE L'IDLE. Hors écran, un calcul rapide FARME l'étage courant
      pour du butin et de l'XP, sans avancer la profondeur.
   2. L'ARÈNE EST LA VÉRITÉ : `Adventure` simule le combat et c'est SON verdict
      qui fait avancer la descente.
   3. TOUT TIRAGE EST SEEDÉ par la descente — même run, même récit.
   ============================================================ */
"use strict";

  // ---------------- outils ----------------
  function genRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function genPick(rng, list, wKey) {
    let tot = 0;
    for (const it of list) tot += (wKey ? (it[wKey] || 0) : (it[1] || 0));
    if (tot <= 0) return list[0];
    let r = rng() * tot;
    for (const it of list) {
      r -= (wKey ? (it[wKey] || 0) : (it[1] || 0));
      if (r <= 0) return it;
    }
    return list[list.length - 1];
  }
  const genClamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function GEN_DATA() { return GD.GENERAL || null; }
  function GEN_BASE_STATS() {
    const G = GEN_DATA();
    return (G && G.baseStats) || { hp: 140, dmg: 12, aspd: 1, mspd: 72, armor: 14, range: 0 };
  }

  // ---------------- l'état ----------------
  // Incrémenter ce numéro remet à zéro la progression DANS LE DONJON de tous
  // les joueurs à leur prochain chargement (cf. GameState.gen). À n'incrémenter
  // que si un changement de moteur rend les étages déjà parcourus caducs.
  const GEN_RESET_SEQ = 1;
  // Incrémenter ce numéro remet à zéro l'ÉQUIPEMENT de tous les joueurs (sac et
  // pièces portées) au prochain chargement. À n'incrémenter que si la forme des
  // objets change au point qu'ils ne se lisent plus.
  const GEN_GEAR_SEQ = 1;
  // Incrémenter ce numéro REND TOUS LES POINTS DE TALENT et vide les arbres.
  // Compteur SÉPARÉ de `resetSeq` : celui-là efface la progression dans le
  // donjon (record, checkpoint), qui n'a rien à voir avec la forme des arbres.
  // Les réunir ferait payer au joueur, en étages perdus, un changement de
  // structure de données.
  const GEN_TALENT_SEQ = 1;

  GameState.gen = function () {
    const s = GameState.state;
    if (!s.general || typeof s.general !== 'object') s.general = {};
    const g = s.general;
    if (typeof g.lvl !== 'number') g.lvl = 1;
    if (typeof g.xp !== 'number') g.xp = 0;
    if (!g.stats) g.stats = Object.assign({}, GEN_BASE_STATS());
    if (!g.gear) g.gear = { arme: null, armure: null, talisman: null };
    if (!Array.isArray(g.roster)) g.roster = [];
    if (!Array.isArray(g.party)) g.party = [];
    if (!Array.isArray(g.bag)) g.bag = [];
    if (!g.plans) g.plans = {};
    if (!g.relics) g.relics = {};
    if (!Array.isArray(g.placed)) g.placed = [];
    // LE GÉNÉRAL A UN ARBRE ET UNE POSTURE, comme n'importe quel héros. Il ne
    // vit pas dans `g.roster` : il EST l'objet qui le contient. Sans ces deux
    // champs, `GameState.talentOwner('__general')` n'aurait nulle part où
    // écrire, et son onglet resterait un bouton mort.
    if (!Array.isArray(g.talents)) g.talents = [];
    if (g.stance === undefined) g.stance = null;
    if (typeof g.fatigue !== 'number') g.fatigue = 0;
    if (!g.tally) g.tally = { descents: 0, floors: 0, hurt: 0, bestFloor: 0, lastCheckpoint: 1 };
    if (typeof g.auto !== 'boolean') g.auto = true;
    if (g.descent === undefined) g.descent = null;
    if (g.report === undefined) g.report = null;
    // migration : ancien format mission -> descent
    if (g.mission && !g.descent) {
      g.descent = null;
      g.mission = null;
    }
    // REMISE À ZÉRO DE LA DESCENTE (une seule fois par palier de `resetSeq`).
    // Les étages parcourus avant la refonte de l'IA l'ont été avec un gardien
    // qui ne frappait pas : le record et le checkpoint ne veulent plus rien
    // dire. On efface la progression du DONJON — et RIEN d'autre : le niveau
    // du Général, ses compagnons, leurs talents, le sac, les plans et les
    // reliques sont du travail de joueur, on n'y touche pas.
    // Les anciennes pièces (préfixe/suffixe/affixes, 6 emplacements) ne se
    // lisent plus : familles, raretés et lignes de stats les ont remplacées.
    // On vide le sac et les emplacements plutôt que d'exposer des objets muets.
    if ((g.gearSeq | 0) < GEN_GEAR_SEQ) {
      g.gearSeq = GEN_GEAR_SEQ;
      g.bag = [];
      g.gear = {};
      for (const h of g.roster) h.gear = {};
    }
    if ((g.resetSeq | 0) < GEN_RESET_SEQ) {
      g.resetSeq = GEN_RESET_SEQ;
      g.descent = null;
      g.report = null;
      g.fatigue = 0;
      g.tally = Object.assign(g.tally || {}, { bestFloor: 0, lastCheckpoint: 1 });
    }
    // LES ARBRES CHANGENT DE FORME : `{ branche: [ids] }` devient un TABLEAU
    // PLAT, et le compteur `talentPts` disparaît (les points sont désormais
    // DÉRIVÉS du niveau, cf. GameState.talentPts). On vide les arbres — le
    // remboursement est intégral et gratuit, précisément parce qu'il n'y a
    // plus d'addition à faire : rien à rendre, rien à voler.
    if ((g.talentSeq | 0) < GEN_TALENT_SEQ) {
      g.talentSeq = GEN_TALENT_SEQ;
      g.talents = []; delete g.talentPts;
      for (const h of g.roster) { h.talents = []; delete h.talentPts; }
      g.talentReset = true;                      // l'écran le dit au joueur
    }
    // FILET PERMANENT, indépendant du compteur. Un id de nœud disparu (branche
    // remaniée, nœud renommé) resterait sinon dans la liste : il coûterait 0
    // point ET satisferait fantomatiquement le prérequis du nœud suivant.
    for (const h of g.roster.concat([g])) {
      if (!Array.isArray(h.talents)) { h.talents = []; continue; }
      if (!h.talents.length) continue;
      const cls = h === g ? 'general' : ((GD.heroById(h.id) || {}).cls);
      h.talents = h.talents.filter(id => cls && GD.talentAnyNode(cls, id));
    }
    return g;
  };

  // ---------------- RECOMMENCER L'AVENTURE (et rien d'autre) ----------------
  // POURQUOI CETTE FONCTION EXISTE.
  //
  // Tester le donjon depuis l'étage 1 demandait d'effacer TOUTE la partie
  // (`GameState.reset`), donc de refaire des heures d'économie avant de pouvoir
  // payer une descente. On veut l'inverse : rendre le Général à son premier
  // jour et laisser l'économie debout.
  //
  // ET SURTOUT : le même piège que celui consigné sur `GameState.reset`
  // (state-core.js) s'applique ici. Une remise à zéro écrite « à la main » dans
  // la console est réécrite quelques secondes plus tard, parce que :
  //   — l'autosave tourne toutes les 10 s ;
  //   — un AUTRE onglet du jeu, resté ouvert, garde l'ancien état EN MÉMOIRE et
  //     le republie avec un `lastSeen` plus récent — et c'est le plus récent qui
  //     gagne à la lecture. L'onglet oublié écrase donc toujours le nouveau.
  // D'où l'ordre imposé ci-dessous : on écrit l'état, on le sauvegarde tout de
  // suite, on POUSSE le cloud sans attendre le prochain tick, et on recharge la
  // page — ce qui referme la fenêtre de course. Il reste une règle que le code
  // ne peut pas garantir : les AUTRES onglets du jeu doivent être fermés.
  GameState.resetAventure = function () {
    const g = GameState.gen();
    // on ferme l'arène avant de vider la compagnie sous ses pieds
    try { if (typeof window !== 'undefined' && window.Adventure && window.Adventure.active()) window.Adventure.end(); } catch (e) { }
    g.lvl = 1; g.xp = 0;
    g.stats = Object.assign({}, GEN_BASE_STATS());
    g.gear = {};                     // les pièces portées
    g.roster = []; g.party = [];      // les compagnons recrutés
    g.bag = [];                       // le sac
    g.talents = []; delete g.talentPts;
    g.stance = null;
    g.relics = {}; g.placed = [];     // reliques trouvées et serties
    g.plans = {};                     // plans rapportés du donjon
    g.descent = null; g.report = null; g.fatigue = 0;
    g.tally = { descents: 0, floors: 0, hurt: 0, bestFloor: 0, lastCheckpoint: 1 };
    delete g.talentReset;             // ce n'est pas une migration : pas de message
    GameState.notify();
    GameState.save();
    // on ne laisse PAS le cloud pour plus tard : c'est lui qui arbitre au
    // prochain chargement, et un push différé perd la course contre un onglet
    // resté ouvert.
    try { if (typeof window !== 'undefined' && window.__cloud && window.__cloud.flush) window.__cloud.flush(); } catch (e) { }
    return true;
  };

  // ---------------- la compagnie ----------------
  GameState.generalPartyMax = function () {
    return Math.min(GD.GENERAL.maxParty, GD.GENERAL.partySize(GameState.gen().lvl));
  };
  GameState.heroState = function (id) {
    return GameState.gen().roster.find(h => h.id === id) || null;
  };
  GameState.heroHurt = function (id) {
    const h = GameState.heroState(id);
    return !!(h && h.hurtUntil && h.hurtUntil > Date.now());
  };
  GameState.setParty = function (ids) {
    const g = GameState.gen();
    const max = GameState.generalPartyMax();
    const out = [];
    for (const id of (ids || [])) {
      if (out.length >= max) break;
      if (!GameState.heroState(id) || GameState.heroHurt(id)) continue;
      if (out.indexOf(id) === -1) out.push(id);
    }
    g.party = out;
    GameState.notify();
    return out;
  };
  GameState.toggleParty = function (id) {
    const g = GameState.gen();
    const ix = g.party.indexOf(id);
    if (ix >= 0) { g.party.splice(ix, 1); GameState.notify(); return true; }
    if (g.party.length >= GameState.generalPartyMax()) return false;
    if (!GameState.heroState(id) || GameState.heroHurt(id)) return false;
    g.party.push(id);
    GameState.notify();
    return true;
  };

  // ---------------- stats ----------------
  // ---------------- LES STATS DE COMBAT — LISTE BLANCHE ----------------
  // LES FRACTIONS. Ces stats-là n'ont pas de base : elles valent 0 et montent
  // par ADDITION (un « soins reçus +30 % » vaut 0,30). Les multiplier serait
  // les avaler en silence — `(undefined || 0) * 1,3` fait 0, et c'est
  // exactement ce que faisait mkHero : `heal_recv` n'a jamais rien valu.
  const GEN_STAT_FRACTIONS = ['lifesteal', 'armorPen', 'heal_recv',
                              'resFire', 'resCold', 'resPoison', 'resLightning',
                              /* les cinq elements au complet : l'ombre
                                 manquait, et la resistance magique avec. */
                              'resShadow', 'resMagic',
                              /* la penetration magique repond a resMagic
                                 comme armorPen repond a l'armure. */
                              'magicPen',
                              /* le critique, et la vitesse en pourcentage :
                                 des fractions, donc additives et plafonnees
                                 par GD.LINE_CAP a l'application. */
                              'critChance', 'critMult', 'mspdPct'];
  /* Le plafond s'applique a la SOMME, pas ligne par ligne : trois pieces
     a +20 % de vitesse ne doivent pas donner +60 %. Sans ce passage, les
     bornes de LINE_CAP ne bornaient qu'un objet isole. */
  function genBorner(stat, v) {
    const cap = GD && GD.LINE_CAP ? GD.LINE_CAP[stat] : null;
    return (cap == null) ? v : Math.min(cap, v);
  }
  // LA LISTE BLANCHE. Tout ce qui n'est pas là-dedans n'est PAS une stat de
  // combat : `loot`, `xp` et `rare` passent par `talentMeta()`, et les lignes
  // d'objet `lootPct`/`itemPct`/`rarePct` sont lues par `partyStat()`. Sans
  // cette clôture, un `pct` sur une clé inconnue créait une stat fantôme que
  // personne ne lit — un effet muet de plus.
  // LECTURE PARESSEUSE, et c'est une contrainte de chargement, pas un détail :
  // `GEN_STAT_ORDER` vit dans `data-general.js`, et plusieurs harnais chargent
  // `state-general.js` SANS ce bloc. Lue au chargement, la table était
  // `undefined` et le fichier entier levait à l'évaluation — trois harnais sont
  // morts d'un `.concat` sur rien. On la résout au premier appel, avec un repli.
  let GEN_COMBAT_KEYS = null;
  function GEN_KEYS() {
    if (GEN_COMBAT_KEYS) return GEN_COMBAT_KEYS;
    const ordre = (GD && GD.GEN_STAT_ORDER)
      || ['hp', 'dmg', 'aspd', 'mspd', 'armor', 'range'];
    GEN_COMBAT_KEYS = ordre.concat(GEN_STAT_FRACTIONS);
    return GEN_COMBAT_KEYS;
  }
  const GEN_IS_FRACTION = {};
  for (const k of GEN_STAT_FRACTIONS) GEN_IS_FRACTION[k] = 1;

  // LE RÉSOLVEUR UNIQUE : base + niveau + équipement + talents, pour un
  // compagnon comme pour le Général. `mkHero` (l'arène) et `generalStats`
  // (le calcul hors écran) l'appellent tous les deux — c'est ce qui garantit
  // que le chiffre affiché est celui qui frappe.
  GameState.combatStats = function (id) {
    const st = {};
    for (const k of GEN_KEYS()) st[k] = 0;
    const o = GameState.talentOwner(id);
    if (!o) return st;
    // 1. LA BASE. Le Général porte ses stats en propre (elles montent à chaque
    //    niveau) ; un compagnon a la fiche de sa classe, majorée de 12 % par
    //    niveau. L'arrondi au dixième est celui de l'arène : ne pas y toucher,
    //    sinon les chiffres de l'écran et ceux du combat divergent.
    if (o.def) {
      const lvlMult = 1 + 0.12 * Math.max(0, (o.holder.lvl || 1) - 1);
      for (const k of GD.GEN_STAT_ORDER) st[k] = Math.round((o.def.stats[k] || 0) * lvlMult * 10) / 10;
    } else {
      const base = o.holder.stats || {};
      for (const k of GD.GEN_STAT_ORDER) st[k] = base[k] || 0;
    }
    // 2. L'ÉQUIPEMENT
    const gear = o.holder.gear || {};
    for (const slot of GD.GENERAL.slots) {
      const it = gear[slot];
      if (!it) continue;
      const b = GD.baseById(it.base);
      const renfort = GD.itemUpgradeMult ? GD.itemUpgradeMult(it) : 1;
      if (b && st[b.stat] !== undefined) st[b.stat] += (it.power || 0) * renfort;
      for (const L of (it.lines || [])) {
        const def = GD.lineById(L.id);
        if (def && st[def.stat] !== undefined) st[def.stat] += L.val * renfort;
      }
    }
    // 3. LES TALENTS : les plats d'abord, les pourcentages ensuite.
    const T = GameState.talentBonuses(id);
    for (const k in T.stats) if (st[k] !== undefined) st[k] += T.stats[k];
    for (const k in T.pcts) {
      if (st[k] === undefined) continue;                 // hors liste blanche
      if (GEN_IS_FRACTION[k]) st[k] += T.pcts[k];        // une fraction s'additionne
      else st[k] = Math.round(st[k] * (1 + T.pcts[k]) * 10) / 10;
    }
    /* LE PLAFOND S'APPLIQUE A LA SOMME, une fois tout accumule — objets,
       talents, auras. Le borner ligne par ligne ne bornait rien : trois
       pieces a +20 % de vitesse faisaient +60 %, et le personnage sortait
       de toutes les zones avant qu'elles se posent. */
    for (const k in GEN_IS_FRACTION) if (st[k] != null) st[k] = genBorner(k, st[k]);
    /* La vitesse en pourcentage se verse dans la vitesse reelle : c'est
       une fraction pour pouvoir etre plafonnee, mais le moteur ne lit que
       `mspd`. Sans ce report, la ligne existait et ne faisait rien. */
    if (st.mspdPct) st.mspd = Math.round(st.mspd * (1 + st.mspdPct) * 10) / 10;
    return st;
  };

  GameState.generalStats = function () {
    const g = GameState.gen();
    const out = { loot: 0, speed: 0, rare: 0, injury: 0, heal: 0, xp: 0 };
    for (const k of GEN_KEYS()) out[k] = 0;
    // LA PUISSANCE DE LA COMPAGNIE = la somme des fiches RÉSOLUES, talents
    // compris. Avant, ce cumul recopiait `def.stats` et ignorait l'arbre :
    // quarante points dépensés ne pesaient rien hors écran.
    for (const id of ['__general'].concat(g.party)) {
      const st = GameState.combatStats(id);
      for (const k of GEN_KEYS()) out[k] += st[k] || 0;
    }
    for (const id of g.party) {
      const def = GD.heroById(id);
      const p = def && def.perk;
      if (!p || !GameState.heroState(id)) continue;
      if (p.kind === 'stat') out[p.stat] = (out[p.stat] || 0) + (p.add || 0);
      else if (p.kind === 'injury') out.injury += p.pct || 0;
      else if (p.kind === 'speed') out.speed += p.pct || 0;
      else if (p.kind === 'heal') out.heal += p.pct || 0;
      else if (p.kind === 'loot') out.loot += (p.pct || 0) * 0.5;
    }
    out.loot += GameState.relicBonus('loot');
    out.speed += GameState.relicBonus('expl');
    // LES CANAUX MÉTA de l'arbre. Ils étaient déclarés en données et lus par
    // PERSONNE : `addLoot`, `floorCleared` et `rollItem` les prennent ici.
    const T = GameState.talentMeta();
    out.loot += T.loot;
    out.rare += T.rare;
    out.xp = (out.xp || 0) + T.xp;
    return out;
  };
  GameState.partyPower = function () {
    const st = GameState.generalStats();
    const dps = (st.dmg || 0) * Math.max(0.2, (st.aspd || 1) / Math.max(1, GameState.gen().party.length + 1));
    const tank = (st.hp || 1) * (1 + (st.armor || 0) / 120);
    return Math.round(Math.sqrt(Math.max(1, dps * tank)));
  };

  // ---------------- les reliques ----------------
  GameState.relicSlots = function () { return GD.RELIC_SLOTS(GameState.gen().lvl); };
  GameState.placeRelic = function (id) {
    const g = GameState.gen();
    if (!g.relics[id]) return false;
    if (g.placed.indexOf(id) >= 0) return true;
    if (g.placed.length >= GameState.relicSlots()) return false;
    g.placed.push(id);
    GameState.notify();
    return true;
  };
  GameState.unplaceRelic = function (id) {
    const g = GameState.gen();
    const ix = g.placed.indexOf(id);
    if (ix < 0) return false;
    g.placed.splice(ix, 1);
    GameState.notify();
    return true;
  };
  GameState.relicBonus = function (kind, arg) {
    const s = GameState.state;
    const g = s.general;
    if (!g || !Array.isArray(g.placed) || !g.placed.length) return 0;
    let n = 0;
    for (const id of g.placed) {
      const r = GD.relicById(id);
      if (!r || !r.effect || r.effect.kind !== kind) continue;
      if (kind === 'gen') {
        if (r.effect.res !== 'all' && arg && r.effect.res !== arg) continue;
      } else if (kind === 'speed') {
        if (arg && r.effect.domain !== arg) continue;
      }
      n += r.effect.pct || 0;
    }
    return n;
  };

  // ---------------- LES PLANS ----------------
  GameState.planHas = function (id) {
    const g = GameState.state.general;
    return !!(g && g.plans && g.plans[id]);
  };
  GameState.plansOwned = function () {
    const g = GameState.state.general;
    return g && g.plans ? Object.keys(g.plans).length : 0;
  };

  // ---------------- LE MODE DE JEU ----------------
  GameState.advAuto = function () { return !!GameState.gen().auto; };
  GameState.setAdvAuto = function (v) {
    const g = GameState.gen();
    g.auto = !!v;
    if (window.Adventure && Adventure.active()) Adventure.setAuto(g.auto);
    GameState.notify();
    return g.auto;
  };

  // ---------------- LA DESCENTE INFINIE ----------------
  GameState.descent = function () { return GameState.gen().descent; };

  GameState.canStartDescent = function () {
    const g = GameState.gen();
    if (g.descent) return 'en_cours';
    if (g.report) return 'rapport';
    if (g.fatigue >= GD.GENERAL.fatigueMax) return 'fatigue';
    const cp = g.tally.lastCheckpoint || 1;
    if (!GameState.canAfford(GD.descentCost(cp, g.party.length + 1))) return 'cout';
    return null;
  };

  GameState.startDescent = function () {
    const g = GameState.gen();
    if (GameState.canStartDescent()) return false;
    const cp = g.tally.lastCheckpoint || 1;
    if (!GameState.spend(GD.descentCost(cp, g.party.length + 1))) return false;
    const seed = ((Date.now() / 1000) | 0) ^ ((g.tally.descents + 1) * 2654435761);
    g.descent = {
      floor: cp,
      checkpoint: cp,
      seed,
      phase: 'fight',
      roomType: GD.floorType(cp),
      loot: { res: {}, items: [], plans: [], relics: [], heroes: [] },
      lootMult: 1, xp: 0, log: [],
      party: g.party.slice(),
      hp: null,
      active: true,
    };
    g.tally.descents++;
    GameState.notify();
    return true;
  };

  GameState.descentProgress = function () {
    const d = GameState.gen().descent;
    if (!d) return null;
    const biome = GD.dungeonBiome(d.floor);
    return { floor: d.floor, checkpoint: d.checkpoint, biome, phase: d.phase,
             roomType: d.roomType, xp: d.xp };
  };

  // ---------------- LE BUTIN ----------------
  function addLoot(d, biomeId, rng, mult) {
    const table = GD.lootTable(biomeId);
    const pickRes = genPick(rng, table.res);
    const id = pickRes[0];
    const tier = GD.dungeonBiome(d.floor).tier;
    // LE BUFF DE CUISINE qui boostait « les gains du Front » s'applique
    // désormais au BUTIN D'AVENTURE : le Front a disparu, ses ressources sont
    // versées ici et en Expédition, selon l'étage atteint. Sans ce report,
    // trois recettes de la Cuisine n'auraient plus aucun effet — un buff mort
    // qu'on continuerait de cuisiner sans rien y gagner.
    const km = 1 + (GameState.kitchenBuff ? GameState.kitchenBuff('front') : 0);
    // LE BUTIN DE L'ARBRE entre ICI, et nulle part ailleurs : `d.lootMult` vaut
    // toujours 1 depuis `startDescent`, si bien que « +20 % de butin » restait
    // une phrase dans une infobulle.
    const st = GameState.generalStats();
    // (VAGUE ARBRE) « Flair du chercheur » — le magic find du QG s'ajoute au
    // butin de l'arbre du Général, il ne le remplace pas.
    const flair = GameState.qgBonus ? GameState.qgBonus('aventure_butin') : 0;
    const n = Math.ceil(GD.lootAmount(tier, d.floor) * mult * km * (1 + (st.loot || 0) + flair) * (0.7 + rng() * 0.6));
    if (n > 0) d.loot.res[id] = (d.loot.res[id] || 0) + n;
    return { id, n };
  }
  // UNE PIÈCE DE BUTIN. Trois tirages, dans cet ordre :
  //   1. le TIER, dicté par l'étage (cf. GameData.lootTierMix) ;
  //   2. la RARETÉ, qui décide combien de LIGNES DE STATS la pièce portera ;
  //   3. la FAMILLE, tirée dans un emplacement au hasard.
  // La ligne 1 est toujours celle de la famille ; les suivantes sont tirées
  // sans doublon dans GameData.ITEM_LINES.
  function rollItem(rng, floor, chance) {
    const tier = GD.rollTier(floor, rng);
    let rarity = GD.rollRarity(floor, chance || 0, rng);
    const bases = GD.ITEM_BASES;
    const base = bases[Math.floor(rng() * bases.length)];
    /* UNE UNIQUE EST UNE PIÈCE NOMMÉE, PAS UN PALIER DE PLUS. Elle doit
       donc trouver un modèle pour son emplacement ; sinon la rareté
       retombe d'un cran, plutôt que de rendre une « unique » sans don
       — l'étiquette promettrait un pouvoir que la pièce n'a pas. */
    let unique = null;
    if (rarity === 'unique') {
      const cand = GD.uniquesPour ? GD.uniquesPour(base.slot) : [];
      if (cand.length) unique = cand[Math.floor(rng() * cand.length)];
      else rarity = 'legendaire';
    }
    const R = GD.rarityById(rarity);
    // les lignes SECONDAIRES (la principale vient de la famille)
    const lines = [];
    const pool = GD.ITEM_LINES.filter(l => l.stat !== base.stat);
    for (let k = 0; k < R.lines - 1 && pool.length; k++) {
      const L = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      lines.push({ id: L.id, val: GD.lineValue(L, tier, rarity) });
    }
    const it = {
      base: base.id, slot: base.slot, fam: base.fam || null,
      tier, rarity, stat: base.stat,
      power: GD.itemValue(base.id, tier, rarity),
      lines, amelioration:0, trempes:[],
    };
    /* `don` est un IDENTIFIANT de pouvoir, jamais un objet : comme pour
       les nœuds d'arbre, une définition inlinée ne pourrait être ni
       partagée, ni corrigée en un endroit, ni re-résolue au chargement
       d'une vieille sauvegarde. */
    if (unique) { it.unique = unique.id; it.nom = unique.nom; it.don = unique.don; }
    return it;
  }
  // ---------------- LE RECRUTEMENT D'UN COMPAGNON ----------------
  // UN SEUL ENDROIT, pour que « trouvé » veuille dire « il se bat avec vous ».
  // Avant, un héros trouvé n'existait qu'à la FIN de la descente (claimReport),
  // arrivait au NIVEAU 1 et n'entrait pas dans la compagnie : la trouvaille ne
  // se sentait pas, et surtout elle n'aidait jamais au gardien de la descente
  // où on l'avait faite. Désormais il entre tout de suite, au niveau du
  // Général, et prend la place libre s'il y en a une.
  // Renvoie false si ce héros est DÉJÀ au roster : c'est le garde-fou contre
  // le doublon (claimReport rejoue la même liste sur les sauvegardes en cours).
  function recruterHeros(g, id, d) {
    if (!id || GameState.heroState(id)) return false;
    g.roster.push({ id, lvl: Math.max(1, g.lvl | 0), xp: 0, gear: {}, hurtUntil: 0,
                    talents: [], stance: null });
    if (!Array.isArray(g.party)) g.party = [];
    if (g.party.indexOf(id) === -1 && g.party.length < GameState.generalPartyMax()) {
      g.party.push(id);
      // la descente EN COURS le compte aussi : sans ça il se bat sans toucher
      // l'XP de la descente où il vient d'arriver.
      if (d && Array.isArray(d.party) && d.party.indexOf(id) === -1) d.party.push(id);
    }
    return true;
  }
  // récompense aléatoire à la fin d'un étage
  function floorReward(g, d, biomeId, rng) {
    const table = GD.lootTable(biomeId);
    const tier = GD.dungeonBiome(d.floor).tier;
    const roll = rng();
    /* ON NE RECRUTE PLUS DANS LE DONJON.

       Le donjon rendait des héros à CLASSE FIXE, tirés d'un catalogue :
       on descendait pour trouver son groupe. Ce n'est plus le sujet — le
       joueur part avec des habitants de son bourg, qu'il a accueillis aux
       portes, nourris et formés, et ce qu'ils deviennent tient à ce qu'on
       leur met dans les mains, pas à une étiquette trouvée sous terre.

       Les deux tirages qui vivaient ici — le premier compagnon garanti au
       deuxième étage, puis un jet par étage — sont retirés. Le dé continue
       sa course vers les autres récompenses : une salle ne rend donc pas
       moins qu'avant, elle rend autre chose.

       `recruterHeros` reste, et reste utilisé par `claimReport` : de
       vieilles sauvegardes portent encore des héros dans leur butin, et
       les faire disparaître au chargement perdrait des personnages que le
       joueur a déjà vus arriver. */

    if (roll < table.relic) {
      const pool = GD.RELICS.filter(r => r.tier <= tier && !g.relics[r.id]
        && d.loot.relics.indexOf(r.id) === -1);
      if (pool.length) {
        const r = pool[Math.floor(rng() * pool.length)];
        d.loot.relics.push(r.id);
        return { icon: '', txt: r.name[GameState.state.faction] || r.name.cats };
      }
    }
    if (roll < table.plan) {
      const pool = GD.PLANS.filter(p => p.tier <= tier && !g.plans[p.id]
        && d.loot.plans.indexOf(p.id) === -1);
      if (pool.length) {
        const p = pool[Math.floor(rng() * pool.length)];
        d.loot.plans.push(p.id);
        return { icon: '', txt: p.name[GameState.state.faction] || p.name.cats };
      }
    }
    if (roll < table.item) {
      // « objets rares +5 % » : l'arbre pèse sur le tirage de rareté, à côté
      // des lignes de chance portées par l'équipement.
      const st = GameState.generalStats();
      const it = rollItem(rng, d.floor, GameState.partyStat('rarePct') + (st.rare || 0));
      d.loot.items.push(it);
      return { icon: '', txt: 'un objet dans le sac' };
    }
    const got = addLoot(d, biomeId, rng, d.lootMult * 1.4);
    return { icon: '', txt: 'butin ramassé', res: got };
  }

  // ---------------- UN ÉTAGE EST NETTOYÉ ----------------
  GameState.floorCleared = function (res) {
    const g = GameState.gen();
    const d = g.descent;
    if (!d || d.phase !== 'fight') return false;
    const biome = GD.dungeonBiome(d.floor);
    const rng = genRng(d.seed ^ ((d.floor + 1) * 2246822519));
    const kind = GD.roomKind(d.roomType);
    const won = !res || res.won !== false;

    if (!won) {
      d.log.push({ icon: '', name: kind.name, txt: 'La compagnie est débordée. On décroche.' });
      finishDescent(g, d, true);
      return true;
    }
    // la fiche RÉSOLUE de la compagnie (talents compris) : elle sert aux
    // blessures, à l'XP et au butin de cet étage.
    const st = GameState.generalStats();
    // blessés
    for (const id of ((res && res.hurt) || [])) {
      const hs = GameState.heroState(id);
      if (!hs) continue;
      const hours = GD.GENERAL.healHours(0.6, st.armor);
      hs.hurtUntil = Math.max(hs.hurtUntil || 0, Date.now() + hours * 3600000);
      g.tally.hurt++;
    }
    // feu de camp soigne
    if (kind.heal) {
      if (window.Adventure && Adventure.active()) Adventure.healParty(kind.heal);
      for (const id of d.party) {
        const hs = GameState.heroState(id);
        if (hs && hs.hurtUntil > Date.now()) hs.hurtUntil = Date.now() + (hs.hurtUntil - Date.now()) * (1 - kind.heal);
      }
    }
    // XP + butin — « +10 % d'XP » n'avait AUCUN multiplicateur pour s'appliquer.
    d.xp += Math.round((kind.boss ? 45 : kind.id === 'elite' ? 22 : 10) * biome.tier * (1 + (st.xp || 0)));
    addLoot(d, biome.id, rng, d.lootMult * (kind.bonus || 1) * 0.6);
    const got = floorReward(g, d, biome.id, rng);
    d.log.push({
      icon: kind.icon, name: 'Étage ' + d.floor,
      txt: (kind.boss ? 'Le gardien tombe.' : 'Salle nettoyée.') + (got ? ' — ' + got.icon + ' ' + got.txt : ''),
      ok: true,
    });
    // LA CHASSE : le trophée abattu avant l'escalier paie une SECONDE part de
    // butin (`kind.trophee`, data-general). L'arène pose le drapeau dans son
    // résultat ; le rattrapage hors-ligne, lui, ne chasse pas — pas de prime.
    if (res && res.trophee) {
      addLoot(d, biome.id, rng, d.lootMult * (kind.trophee || 2) * 0.6);
      d.log.push({ icon: '', name: 'Trophée', txt: 'La bête est tombée avant l\'escalier — la prime est belle.', ok: true });
    }
    // UN POINT DE TALENT AU GARDIEN DE CHAQUE BIOME. Il découple l'arbre du
    // niveau : le joueur associe « je suis descendu plus profond » à « j'ai un
    // nouveau pouvoir », qui est le rythme du jeu — et non celui d'une
    // exponentielle d'XP (mesuré : le 4e pouvoir demandait ~500 descentes).
    /* LE GARDIEN VAINCU DEVIENT UNE PROIE.

       On l'a battu une fois : on saura le refaire. Il entre au tableau
       des gardiens connus, avec la PROFONDEUR À LAQUELLE on l'a pris —
       c'est elle qui fixera ce qu'il rapporte en farm, et non le simple
       fait de l'avoir croisé. Repasser plus bas sur le même gardien
       améliore donc la prise. */
    if (kind.boss) {
      if (!g.gardiens || typeof g.gardiens !== 'object') g.gardiens = {};
      const cle = biome.id;
      const avant = g.gardiens[cle] || 0;
      if (d.floor > avant) {
        g.gardiens[cle] = d.floor;
        d.log.push({ icon: '', name: 'Gardien connu',
          txt: avant ? 'On le reprendra plus bas : étage ' + d.floor + '.'
                     : 'Sa tanière est notée — on pourra y retourner sans descendre.',
          ok: true });
      }
    }
    if (kind.boss && d.floor % 10 === 0) {
      for (const id of d.party) { const h = GameState.heroState(id); if (h) h.talentBonusPts = (h.talentBonusPts | 0) + 1; }
      g.talentBonusPts = (g.talentBonusPts | 0) + 1;
    }
    g.tally.floors++;
    // checkpoint tous les 5 étages
    if (d.floor % 5 === 0) {
      d.checkpoint = d.floor;
      if (d.floor > g.tally.bestFloor) g.tally.bestFloor = d.floor;
      d.log.push({ icon: '', name: 'Checkpoint', txt: 'Progression sauvegardée — étage ' + d.floor, ok: true });
    }
    /* ON NE DESCEND PLUS TOUT SEUL.

       L'étage suivant s'enchaînait sans rien demander : la descente
       filait jusqu'à ce que la compagnie tombe, et le joueur ne
       décidait de rien — il regardait. Or c'est LA décision du mode
       aventure : ce qu'on a gagné vaut-il ce qu'on risque en allant
       plus bas ?

       On s'arrête donc sur un PALIER. La descente reste ouverte, le
       butin est en main, et rien ne bouge tant que le joueur n'a pas
       tranché : `descendreEncore` ou `abortDescent`. */
    d.phase = 'palier';
    GameState.notify();
    return true;
  };

  /* LE PAS SUIVANT, à la demande. C'est ici, et nulle part ailleurs,
     que la profondeur augmente. */
  GameState.descendreEncore = function () {
    const g = GameState.gen();
    const d = g.descent;
    if (!d || d.phase !== 'palier') return false;
    d.floor++;
    d.roomType = GD.floorType(d.floor);
    d.phase = 'fight';
    GameState.notify();
    return true;
  };
  /* Le joueur est-il devant ce choix ? L'interface s'en sert pour poser
     ses deux boutons, et le rattrapage hors-ligne pour s'arrêter là. */
  /* ------------------------------------------------------------------
     LE FARM DES GARDIENS

     Un gardien battu se refait en idle : on envoie la compagnie sur sa
     tanière et elle en rapporte, sans qu'on ait à redescendre les
     étages qui y mènent. C'est ce qui rend une descente profonde
     durablement utile au lieu d'être un record qu'on regarde.

     Le rendement suit la PROFONDEUR à laquelle on l'a pris : rebattre
     le même gardien plus bas améliore la rente.
     ------------------------------------------------------------------ */
  GameState.gardiensConnus = function () {
    const g = GameState.gen();
    if (!g.gardiens || typeof g.gardiens !== 'object') g.gardiens = {};
    return Object.keys(g.gardiens).map(id => ({ id, etage: g.gardiens[id] }));
  };
  /* Celui qu'on farme, s'il y en a un. On ne peut en tenir qu'un : la
     compagnie est une, et la partager n'aurait pas de sens. */
  GameState.gardienFarme = function () {
    const g = GameState.gen();
    return g.farm && g.gardiens && g.gardiens[g.farm] ? g.farm : null;
  };
  GameState.farmerGardien = function (id) {
    const g = GameState.gen();
    if (id && (!g.gardiens || !g.gardiens[id])) return false;
    g.farm = id || null;
    g.farmT = 0;
    GameState.notify();
    return true;
  };
  /* LE BATTEMENT DU FARM. Une prise toutes les `FARM_CYCLE` secondes,
     appelé depuis le tick de l'aventure. On ne farme QUE si la
     compagnie n'est pas déjà en descente : elle ne peut pas être à deux
     endroits. */
  const FARM_CYCLE = 45;
  GameState.tickFarm = function (dt) {
    const g = GameState.gen();
    if (g.descent) return null;
    const id = GameState.gardienFarme();
    if (!id) return null;
    g.farmT = (g.farmT || 0) + (dt || 0);
    if (g.farmT < FARM_CYCLE) return null;
    g.farmT -= FARM_CYCLE;
    const etage = g.gardiens[id] || 5;
    const rng = genRng((Date.now() ^ (etage * 2654435761)) >>> 0);
    /* La prise d'un gardien farmé : le butin de son étage, et une
       chance d'objet — c'est pour l'objet qu'on y retourne. */
    const faux = { floor: etage, loot: { res: {}, items: [], relics: [], heroes: [] },
                   lootMult: 1, xp: 0, log: [], party: [] };
    addLoot(faux, id, rng, 1.1);
    if (rng() < 0.34) faux.loot.items.push(rollItem(rng, etage, 0));
    GameState.notify();
    return { gardien: id, etage, loot: faux.loot };
  };

  GameState.surPalier = function () {
    const d = GameState.gen().descent;
    return !!(d && d.phase === 'palier');
  };

  // ---------------- FIN DE DESCENTE ----------------
  function finishDescent(g, d, fled) {
    // sauvegarde le checkpoint pour la prochaine descente
    g.tally.lastCheckpoint = d.checkpoint;
    if (d.checkpoint > g.tally.bestFloor) g.tally.bestFloor = d.checkpoint;
    g.report = {
      floor: d.floor, checkpoint: d.checkpoint, fled: !!fled,
      loot: d.loot, xp: d.xp, log: d.log, party: d.party, at: Date.now(),
      bestFloor: Math.max(g.tally.bestFloor, d.checkpoint),
    };
    g.descent = null;
    g.fatigue = genClamp(g.fatigue + GD.GENERAL.restPerRoom * d.floor * 0.3, 0, GD.GENERAL.fatigueMax);
    if (window.Adventure && Adventure.active()) Adventure.end();
    GameState.notify();
  }
  GameState.abortDescent = function () {
    const g = GameState.gen();
    const d = g.descent;
    if (!d) return false;
    d.log.push({ icon: '', name: 'Repli', txt: 'La compagnie remonte à la surface.' });
    finishDescent(g, d, true);
    return true;
  };
  // le joueur encaisse le butin
  GameState.claimReport = function () {
    const g = GameState.gen();
    const r = g.report;
    if (!r) return null;
    const s = GameState.state;
    for (const k in r.loot.res) s.res[k] = (s.res[k] || 0) + r.loot.res[k];
    for (const it of r.loot.items) g.bag.push(it);
    for (const id of r.loot.plans) g.plans[id] = 1;
    for (const id of r.loot.relics) g.relics[id] = 1;
    // LES COMPAGNONS SONT DÉJÀ ENTRÉS (recruterHeros, pendant la descente) —
    // cette boucle ne sert plus qu'aux RAPPORTS EN ATTENTE des sauvegardes
    // faites avant ce correctif. `recruterHeros` refuse un doublon, donc la
    // rejouer ne crée jamais deux fois le même héros.
    for (const id of r.loot.heroes) recruterHeros(g, id, null);
    GameState.generalXp(r.xp);
    for (const id of (r.party || g.party)) {
      const hs = GameState.heroState(id);
      if (!hs) continue;
      hs.xp = (hs.xp || 0) + Math.round(r.xp * 0.5);
      // LA COURBE PASSE DE 1,4 À 1,20. À 1,4, le 4e pouvoir demandait ~500
      // descentes complètes et le 5e ~990 : on écrivait des arbres que
      // personne n'allait voir.
      let need = Math.ceil(80 * Math.pow(1.20, (hs.lvl || 1) - 1));
      let guard = 0;
      while (hs.xp >= need && (hs.lvl || 1) < 100 && guard++ < 200) {
        hs.xp -= need; hs.lvl = (hs.lvl || 1) + 1;
        // PLUS DE COMPTEUR `talentPts` : les points sont DÉRIVÉS du niveau
        // (GameState.talentPts). Deux vérités qui devaient rester d'accord
        // n'y arrivaient pas — le remboursement du Général en rendait 1 par
        // nœud, quel qu'en soit le prix.
        need = Math.ceil(80 * Math.pow(1.20, hs.lvl - 1));
      }
    }
    g.report = null;
    GameState.notify();
    return r;
  };
  GameState.generalXp = function (n) {
    const g = GameState.gen();
    g.xp += Math.max(0, n | 0);
    let need = GD.GENERAL.xpFor(g.lvl);
    let guard = 0;
    while (g.xp >= need && g.lvl < GD.GENERAL.maxLevel && guard++ < 200) {
      g.xp -= need;
      g.lvl++;
      const gain = GD.GENERAL.levelGain;
      const boost = g.lvl % 5 === 0 ? 2.5 : 1;
      for (const k of GD.GEN_STAT_ORDER) {
        g.stats[k] = Math.round(((g.stats[k] || 0) + (gain[k] || 0) * boost) * 100) / 100;
      }
      need = GD.GENERAL.xpFor(g.lvl);
    }
    return g.lvl;
  };

  // ---------------- TALENTS ----------------
  // À QUI APPARTIENT CET ARBRE ? — le Général n'est pas dans `g.roster` : il
  // EST l'objet qui le contient. Sans cet aiguillage, les neuf fonctions de
  // talents et les deux de posture sortent sur `null` et son onglet est un
  // bouton mort. C'est la racine des DÉFAUTS 2 ET 3, corrigés d'un coup.
  GameState.talentOwner = function (id) {
    if (id === '__general') {
      const g = GameState.gen();
      if (!Array.isArray(g.talents)) g.talents = [];
      return { holder: g, cls: 'general', def: null };
    }
    const hs = GameState.heroState(id);
    const def = GD.heroById(id);
    if (!hs || !def) return null;
    if (!Array.isArray(hs.talents)) hs.talents = [];
    return { holder: hs, cls: def.cls, def };
  };
  GameState.heroClassOf = function (id) {
    const o = GameState.talentOwner(id);
    return o ? o.cls : null;
  };

  // ---- les trois outils que toute la section réutilise ----
  const genTalentPris = (o, nodeId) => o.holder.talents.indexOf(nodeId) >= 0;
  // la BRANCHE ordinaire qui contient ce nœud (null pour un nœud de voie)
  function genTalentBranche(cls, nodeId) {
    const tree = GD.talentTree(cls);
    if (!tree) return null;
    return tree.branches.find(b => b.nodes.some(n => n.id === nodeId)) || null;
  }
  // DE QUOI CE NŒUD DÉPEND-IL ? — `req` (une liste en OU) surclasse la règle
  // implicite « le nœud de tier−1 de la même branche ». Un tier 1 ne dépend de
  // rien : la liste est vide, et une liste vide n'a jamais bloqué personne.
  function genTalentAmonts(cls, node) {
    const out = [];
    if (Array.isArray(node.req) && node.req.length) {
      for (const rid of node.req) { const n = GD.talentAnyNode(cls, rid); if (n) out.push(n); }
      return out;
    }
    if ((node.tier | 0) <= 1) return out;
    const groupe = node.spec ? GD.talentSpecOf(cls, node.id) : genTalentBranche(cls, node.id);
    if (!groupe) return out;
    const prev = groupe.nodes.find(n => n.tier === node.tier - 1);
    if (prev) out.push(prev);
    return out;
  }
  // QUEL NŒUD FERME CELUI-CI ? — soit un membre déjà pris de son groupe
  // `choix`, soit, de proche en proche, celui qui ferme son amont. Le mémo
  // sert autant à la performance qu'à l'anti-boucle.
  function genTalentBloqueur(o, nodeId, memo) {
    if (Object.prototype.hasOwnProperty.call(memo, nodeId)) return memo[nodeId];
    memo[nodeId] = null;                                   // garde-fou anti-cycle
    const node = GD.talentAnyNode(o.cls, nodeId);
    if (!node) return null;
    if (node.choix) {
      for (const m of GD.talentGroupe(o.cls, node.choix)) {
        if (m.id !== nodeId && genTalentPris(o, m.id)) { memo[nodeId] = m; return m; }
      }
    }
    const amonts = genTalentAmonts(o.cls, node);
    if (!amonts.length) return null;
    // un amont DÉJÀ PRIS suffit : la route est ouverte.
    for (const a of amonts) if (genTalentPris(o, a.id)) return null;
    let premier = null;
    for (const a of amonts) {
      const b = genTalentBloqueur(o, a.id, memo);
      if (!b) return null;                                 // il reste une route
      if (!premier) premier = b;
    }
    memo[nodeId] = premier;
    return premier;
  }

  // COMBIEN DE POINTS ONT ÉTÉ ENGAGÉS ? — c'est le seuil qui ouvre le choix de
  // spécialisation, et la moitié du calcul des points restants.
  GameState.talentSpent = function (id) {
    const o = GameState.talentOwner(id);
    if (!o) return 0;
    let n = 0;
    for (const nodeId of o.holder.talents) n += GD.talentCostOf(o.cls, nodeId);
    return n;
  };
  // COMBIEN DE POINTS RESTE-T-IL ? — DÉRIVÉ, jamais stocké. `talentPts` était
  // un compteur incrémenté d'un côté et décrémenté de l'autre : deux vérités
  // qui devaient rester d'accord et qui ne le restaient pas. Ici il n'y a plus
  // qu'une soustraction, donc plus aucun endroit où voler le joueur.
  GameState.talentPts = function (id) {
    const o = GameState.talentOwner(id);
    if (!o) return 0;
    // REPLI DÉFENSIF : plusieurs harnais chargent l'état sans `data-talents.js`.
    // Sans ce garde, un barème absent ne rendait pas 0 point — il faisait
    // TOMBER l'onglet entier du Général, écran blanc à la clé.
    const lvl = o.holder.lvl || 1;
    const bar = o.cls === 'general' ? GD.generalTalentPoints : GD.talentPointsForLevel;
    const bareme = typeof bar === 'function' ? bar(lvl) : 0;
    return Math.max(0, bareme + (o.holder.talentBonusPts | 0) - GameState.talentSpent(id));
  };
  // LA VOIE CHOISIE, ou null. Une seule par personnage — c'est tout le principe.
  GameState.heroSpec = function (id) {
    const o = GameState.talentOwner(id);
    if (!o) return null;
    for (const nodeId of o.holder.talents) {
      const sp = GD.talentSpecOf(o.cls, nodeId);
      if (sp) return sp;
    }
    return null;
  };
  // Le nom à montrer dans l'infobulle d'un nœud fermé.
  GameState.talentBloqueur = function (id, nodeId) {
    const o = GameState.talentOwner(id);
    if (!o) return null;
    return genTalentBloqueur(o, nodeId, {});
  };

  // POURQUOI CE NŒUD EST-IL REFUSÉ ? — rendu en clair, pour que l'écran le dise
  // au lieu de laisser un clic sans effet.
  //
  // L'ORDRE DES CODES EST LE MESSAGE. `'points'` passe EN DERNIER : quand il
  // était testé en troisième, un nœud à la fois exclu et trop cher annonçait
  // « pas assez de points », le joueur économisait — et le nœud restait
  // refusé. Un refus qui ment coûte plus cher qu'un refus qui manque.
  GameState.talentRefus = function (id, nodeId) {
    const o = GameState.talentOwner(id);
    if (!o) return { code: 'inconnu' };
    const node = GD.talentAnyNode(o.cls, nodeId);
    if (!node) return { code: 'inconnu' };
    if (genTalentPris(o, nodeId)) return { code: 'deja' };
    // 1. L'EXCLUSION. Prendre un membre d'un groupe `choix` ferme tous les
    //    autres — c'est ce qui fait du build une identité et non une liste de
    //    courses. La bascule (basculeTalent) reste la porte de sortie.
    if (node.choix) {
      for (const m of GD.talentGroupe(o.cls, node.choix)) {
        if (m.id !== nodeId && genTalentPris(o, m.id)) return { code: 'exclu', node: m };
      }
    }
    const spec = GD.talentSpecOf(o.cls, nodeId);
    if (spec) {
      const deja = GameState.heroSpec(id);
      if (deja && deja.id !== spec.id) return { code: 'autrevoie' };
    }
    // 2. EN AVAL D'UN NŒUD FERMÉ : inutile de parler de prérequis, ce chemin
    //    entier est mort tant que le groupe amont n'est pas basculé.
    const bl = genTalentBloqueur(o, nodeId, {});
    if (bl) return { code: 'amont', node: bl };
    const amonts = genTalentAmonts(o.cls, node);
    if (amonts.length && !amonts.some(a => genTalentPris(o, a.id))) {
      return { code: 'prerequis', node: amonts[0] };
    }
    if (spec && GameState.talentSpent(id) < GD.TALENT_SPEC_AT) return { code: 'tropTot' };
    if (GameState.talentPts(id) < GD.talentCostOf(o.cls, nodeId)) return { code: 'points' };
    return null;
  };
  // compat : le seul code, pour qui n'a pas besoin du nœud bloqueur.
  GameState.talentRefusCode = function (id, nodeId) {
    const r = GameState.talentRefus(id, nodeId);
    return r ? r.code : null;
  };

  GameState.spendTalent = function (id, nodeId) {
    const o = GameState.talentOwner(id);
    if (!o) return false;
    if (GameState.talentRefus(id, nodeId)) return false;
    o.holder.talents.push(nodeId);
    GameState.notify();
    return true;
  };
  // LA BASCULE. Cliquer l'autre membre d'un groupe ÉCHANGE les deux sans
  // toucher au reste de l'arbre. Sans elle, une exclusion est une punition ;
  // avec elle, c'est une identité qu'on essaie.
  GameState.basculeTalent = function (id, nodeId) {
    const o = GameState.talentOwner(id);
    if (!o) return false;
    const node = GD.talentAnyNode(o.cls, nodeId);
    if (!node || !node.choix) return false;                // ce n'est pas un choix
    if (genTalentPris(o, nodeId)) return false;
    const retires = [];
    for (const m of GD.talentGroupe(o.cls, node.choix)) {
      if (m.id === nodeId) continue;
      const ix = o.holder.talents.indexOf(m.id);
      if (ix >= 0) { o.holder.talents.splice(ix, 1); retires.push(m.id); }
    }
    if (!retires.length) return false;                     // rien à échanger
    if (GameState.talentRefus(id, nodeId)) {               // l'échange ne passe pas
      for (const rid of retires) o.holder.talents.push(rid);
      return false;
    }
    o.holder.talents.push(nodeId);
    GameState.notify();
    return true;
  };
  // ON REND TOUT, sans compter : les points étant dérivés, vider la liste les
  // restitue à 100 % — il n'y a pas d'addition à rater.
  GameState.refundTalents = function (id) {
    const o = GameState.talentOwner(id);
    if (!o || !o.holder.talents.length) return false;
    o.holder.talents = [];
    GameState.notify();
    return true;
  };

  // LES POUVOIRS PORTÉS — la liste qui alimente les boutons de la carte de
  // portrait. Le slot 0 est TOUJOURS la capacité de classe (offerte) ; l'arbre
  // ajoute les siens par tier croissant, donc dans l'ordre où on les a gagnés.
  // Le plafond n'est pas décoratif : au-delà de cinq, la colonne de portrait
  // devient un tableau de bord.
  GameState.heroPowerIds = function (id) {
    const o = GameState.talentOwner(id);
    if (!o) return [];
    const out = [];
    const base = GD.CLASS_POWER[o.cls];
    if (base) out.push(base);
    const arbre = [];
    for (const nodeId of o.holder.talents) {
      const n = GD.talentAnyNode(o.cls, nodeId);
      if (!n || !n.effect || n.effect.kind !== 'power') continue;
      const pid = n.effect.power;
      // une CHAÎNE, jamais un objet : un pouvoir inliné dans un nœud ne peut
      // être ni partagé, ni corrigé en un endroit, ni re-résolu après un
      // rechargement de sauvegarde. Une vieille donnée inlinée est ignorée.
      if (typeof pid !== 'string' || !pid) continue;
      arbre.push({ pid, tier: n.tier | 0 });
    }
    /* LES DONS DES PIÈCES UNIQUES. Ils passent AVANT les pouvoirs
       d'arbre : on ne trouve pas une unique tous les jours, et il serait
       absurde qu'elle soit celle qu'on écrête quand les cinq places sont
       prises. Après la capacité de classe, donc, et avant le reste. */
    const gear = (o.holder && o.holder.gear) || {};
    for (const slot in gear) {
      const it = gear[slot];
      if (it && typeof it.don === 'string' && it.don && out.indexOf(it.don) < 0)
        out.push(it.don);
    }
    arbre.sort((a, b) => a.tier - b.tier);
    for (const x of arbre) if (out.indexOf(x.pid) < 0) out.push(x.pid);
    return out.slice(0, GD.POWER_SLOTS || 5);
  };
  // compat : les mêmes, en définitions.
  GameState.heroPowers = function (id) {
    const out = [];
    for (const pid of GameState.heroPowerIds(id)) {
      const P = GD.powerById(pid);
      if (P) out.push(P);
    }
    return out;
  };

  // CE QUE L'ARBRE DONNE, trié par canal. Chaque canal a désormais un
  // lecteur : `stats`/`pcts` → combatStats, `metas` → generalStats,
  // `procs`/`auras`/`mods` → l'arène. Un canal sans lecteur est un effet muet,
  // et c'est ce qu'étaient 92 procs sur 95.
  GameState.talentBonuses = function (id) {
    const out = { stats: {}, pcts: {}, metas: { loot: 0, xp: 0, rare: 0 },
                  procs: [], auras: [], mods: [] };
    const o = GameState.talentOwner(id);
    if (!o) return out;
    for (const nodeId of o.holder.talents) {
      // talentAnyNode, PAS talentNode : les nœuds de VOIE vivent dans
      // TALENT_SPECS, que talentNode ne fouille pas. Avec le mauvais
      // résolveur, le joueur payait le tarif MAJORÉ d'une voie et n'en
      // recevait RIEN.
      const node = GD.talentAnyNode(o.cls, nodeId);
      if (!node || !node.effect) continue;
      const e = node.effect;
      if (e.kind === 'stat') out.stats[e.stat] = (out.stats[e.stat] || 0) + (e.add || 0);
      else if (e.kind === 'pct') {
        // LES TROIS CANAUX MÉTA ne sont pas des stats de combat : ils ne
        // passent pas par la fiche, ils pèsent sur le butin, l'XP et la rareté.
        if (e.stat === 'loot' || e.stat === 'xp' || e.stat === 'rare') out.metas[e.stat] += (e.pct || 0);
        else out.pcts[e.stat] = (out.pcts[e.stat] || 0) + (e.pct || 0);
      }
      else if (e.kind === 'proc') out.procs.push(e);
      else if (e.kind === 'aura') out.auras.push(e);
      // un mod d'ability doit dire SUR QUEL POUVOIR il porte : `'classe'`
      // (défaut, le sens historique des 19 mods existants), un id de pouvoir,
      // ou `'*'` pour toute la panoplie.
      else if (e.kind === 'ability') out.mods.push(Object.assign({ cible: 'classe' }, e));
    }
    /* Les trempes équipées utilisent les mêmes canaux que l'arbre. Elles
       deviennent ainsi de vrais effets de combat (proc, stat, pourcentage
       ou fortune), et jamais une ligne de texte sans lecteur. */
    for (const slot in (o.holder.gear || {})) {
      const it = o.holder.gear[slot];
      for (const t of ((it && it.trempes) || [])) {
        const e = GD.temperEffect ? GD.temperEffect(t) : null;
        if (!e) continue;
        if (e.kind === 'stat') out.stats[e.stat] = (out.stats[e.stat] || 0) + (e.add || 0);
        else if (e.kind === 'pct') out.pcts[e.stat] = (out.pcts[e.stat] || 0) + (e.pct || 0);
        else if (e.kind === 'proc') out.procs.push(e);
        else if (e.kind === 'meta' && out.metas[e.stat] != null) out.metas[e.stat] += e.pct || 0;
      }
    }
    return out;
  };

  // LE BUTIN, L'XP ET LA RARETÉ de tout le monde, en un chiffre par canal.
  GameState.talentMeta = function () {
    const g = GameState.gen();
    const out = { loot: 0, xp: 0, rare: 0 };
    for (const id of ['__general'].concat(g.party)) {
      const m = GameState.talentBonuses(id).metas;
      out.loot += m.loot || 0;
      out.xp += m.xp || 0;
      out.rare += m.rare || 0;
    }
    return out;
  };
  // CE QUE PÈSE L'ARBRE HORS ÉCRAN — le seul endroit où les pouvoirs comptent
  // pendant une absence (`farmOdds`). Sans ce facteur, quarante points dépensés
  // rapporteraient exactement autant que zéro, dans le mode où se joue la
  // majorité des parties (`g.auto` vaut true par défaut).
  GameState.talentPower = function () {
    let s = 0, procs = 0;
    for (const id of ['__general'].concat(GameState.gen().party)) {
      for (const pid of GameState.heroPowerIds(id)) {
        const P = GD.powerById(pid);
        if (!P || !P.cd) continue;
        s += ((P.mult || 0) * 0.5 + (P.pct || 0) * 4 + (P.dmg || 0) * 2 + (P.dr || 0) * 3
              + (P.heal || 0) * 3 + (P.abs || 0) * 3 + (P.dur ? 0.2 : 0)) / P.cd;
      }
      procs += (GameState.talentBonuses(id).procs || []).length;
    }
    return 1 + Math.min(0.6, s * 0.35) + Math.min(0.3, procs * 0.02);   // 1 → 1,9
  };

  // ---------------- équipement ----------------
  // cumul d'une stat d'objet sur toute la compagnie (chance, butin, trouvaille)
  GameState.partyStat = function (stat) {
    const g = GameState.gen();
    let n = 0;
    const porteurs = [g].concat(g.party.map(id => GameState.heroState(id)).filter(Boolean));
    for (const h of porteurs) {
      for (const slot of GD.GENERAL.slots) {
        const it = (h.gear || {})[slot];
        if (!it) continue;
        const b = GD.baseById(it.base);
        const renfort = GD.itemUpgradeMult ? GD.itemUpgradeMult(it) : 1;
        if (b && b.stat === stat) n += (it.power || 0) * renfort;
        for (const L of (it.lines || [])) {
          const def = GD.lineById(L.id);
          if (def && def.stat === stat) n += L.val * renfort;
        }
      }
    }
    return n;
  };

  // La CLASSE décide de ce qu'on peut porter : un mage ne met pas de plaque,
  // un tireur ne prend pas la hache. Le refus dit pourquoi — sinon le joueur
  // clique dans le vide sans comprendre.
  GameState.equipRefus = function (item, heroId) {
    const cls = heroId ? ((GD.heroById(heroId) || {}).cls || 'general') : 'general';
    const motif = GD.equipRefus(cls, item);
    if (motif) return motif;
    // une arme à deux mains condamne le bouclier, et réciproquement
    const holder = heroId ? GameState.heroState(heroId) : GameState.gen();
    const gear = (holder && holder.gear) || {};
    const b = GD.baseById(item.base);
    if (b && b.slot === 'bouclier' && GD.armeDeuxMains(gear.arme)) return 'son arme se tient à deux mains';
    /* LE COUPLAGE ARME / ARMURE. On refuse dans les DEUX sens : poser une
       plaque sur un mage, comme donner un arc à quelqu'un déjà en plaque.
       Sans la réciproque, l'ordre d'équipement décidait de la règle — on
       s'habillait d'abord, on prenait l'arme ensuite, et tout passait. */
    const voieTenue = GD.voieDe(gear.arme);
    const famPosee = GD.famArmure(item);
    if (famPosee && voieTenue && !GD.armureVaPour(voieTenue, famPosee))
      return 'le ' + (GD.VOIE_NOM[voieTenue] || voieTenue) + ' ne se porte pas en ' + famPosee;
    if (b && b.slot === 'arme') {
      const voiePosee = GD.voieDe(item);
      for (const slot of ['casque', 'armure', 'gants', 'bottes']) {
        const fam = GD.famArmure(gear[slot]);
        if (fam && voiePosee && !GD.armureVaPour(voiePosee, fam))
          return 'il porte de la ' + fam + ', qui ne va pas au ' +
                 (GD.VOIE_NOM[voiePosee] || voiePosee);
      }
    }
    return null;
  };

  GameState.equipItem = function (item, heroId) {
    const g = GameState.gen();
    const ix = g.bag.indexOf(item);
    if (ix < 0) return false;
    const holder = heroId ? GameState.heroState(heroId) : g;
    if (!holder) return false;
    if (!holder.gear) holder.gear = {};
    if (GameState.equipRefus(item, heroId)) return false;
    const old = holder.gear[item.slot] || null;
    holder.gear[item.slot] = item;
    // on prend une arme à deux mains : le bouclier retourne au coffre
    if (item.slot === 'arme' && GD.armeDeuxMains(item) && holder.gear.bouclier) {
      g.bag.push(holder.gear.bouclier);
      holder.gear.bouclier = null;
    }
    g.bag.splice(ix, 1);
    if (old) g.bag.push(old);
    GameState.notify();
    return true;
  };
  GameState.unequipItem = function (slot, heroId) {
    const g = GameState.gen();
    const holder = heroId ? GameState.heroState(heroId) : g;
    if (!holder || !holder.gear || !holder.gear[slot]) return false;
    g.bag.push(holder.gear[slot]);
    holder.gear[slot] = null;
    GameState.notify();
    return true;
  };
  function itemPossede(item) {
    if (!item) return false;
    const g = GameState.gen();
    if ((g.bag || []).indexOf(item) >= 0) return true;
    const porteurs = [g].concat((g.roster || []).map(x => GameState.heroState(x.id)).filter(Boolean));
    return porteurs.some(h => Object.values(h.gear || {}).indexOf(item) >= 0);
  }
  function assurerObjet(item) {
    if (!item) return item;
    if (typeof item.amelioration !== 'number') item.amelioration = 0;
    if (!Array.isArray(item.trempes)) item.trempes = [];
    return item;
  }
  GameState.upgradeItem = function (item) {
    if (!itemPossede(item)) return {ok:false,raison:'Cette pièce n’appartient pas à la compagnie.'};
    if (!window.Etat || !window.Etat.aBatiment('forge')) return {ok:false,raison:'Construisez la forge pour renforcer l’équipement.'};
    assurerObjet(item);
    if (item.amelioration >= (GD.ITEM_UPGRADE_MAX || 20)) return {ok:false,raison:'Cette pièce est déjà au renforcement maximal.'};
    const cout = GD.itemUpgradeCost && GD.itemUpgradeCost(item);
    if (!cout || !window.Etat.assez(cout)) return {ok:false,raison:'Il manque des matériaux de renforcement.'};
    window.Etat.depenser(cout);
    item.amelioration++;
    GameState.notify(); window.Etat.sauver(true);
    return {ok:true,niveau:item.amelioration};
  };
  GameState.temperItem = function (item, affixeId, slot) {
    if (!itemPossede(item)) return {ok:false,raison:'Cette pièce n’appartient pas à la compagnie.'};
    if (!window.Etat || !window.Etat.aBatiment('forge')) return {ok:false,raison:'Construisez la forge pour pratiquer la trempe.'};
    const d = GD.temperById && GD.temperById(affixeId);
    if (!d) return {ok:false,raison:'Trempe inconnue.'};
    assurerObjet(item);
    const max = item.amelioration >= 8 ? 2 : 1;
    slot = Math.max(0, slot == null ? item.trempes.length : (slot | 0));
    if (slot >= max) return {ok:false,raison:item.amelioration < 8 ? 'Le second emplacement s’ouvre au renforcement +8.' : 'Les deux trempes sont déjà occupées.'};
    if (item.trempes.some((t,i) => i !== slot && t.id === affixeId)) return {ok:false,raison:'Cette trempe est déjà présente sur la pièce.'};
    const cout = GD.temperCost(item, slot);
    if (!window.Etat.assez(cout)) return {ok:false,raison:'Il manque des ressources rapportées d’aventure.'};
    window.Etat.depenser(cout);
    item.trempes[slot] = {id:affixeId,puissance:1 + Math.floor(item.amelioration / 5)};
    GameState.notify(); window.Etat.sauver(true);
    return {ok:true,nom:d.nom};
  };
  GameState.itemPossede = itemPossede;
  GameState.assurerObjet = assurerObjet;
  GameState.sellItem = function (item) {
    const g = GameState.gen();
    const ix = g.bag.indexOf(item);
    if (ix < 0) return false;
    g.bag.splice(ix, 1);
    const s = GameState.state;
    const R = GD.rarityById(item.rarity);
    s.res.food = (s.res.food || 0) + (item.power || 1) * (GD.itemUpgradeMult ? GD.itemUpgradeMult(item) : 1)
      * 120 * item.tier * (R ? R.mult : 1);
    GameState.notify();
    return true;
  };
  GameState.healHeroNow = function (id) {
    const hs = GameState.heroState(id);
    if (!hs || !hs.hurtUntil || hs.hurtUntil <= Date.now()) return false;
    const hours = (hs.hurtUntil - Date.now()) / 3600000;
    const cost = { food: Math.ceil(4000 * hours), food_t2: Math.ceil(2 * hours) };
    if (!(GameState.spendMixed ? GameState.spendMixed(cost) : GameState.spend(cost))) return false;
    hs.hurtUntil = 0;
    GameState.notify();
    return true;
  };

  // ---------------- posture (stance) ----------------
  // LE GÉNÉRAL A UNE POSTURE, comme les autres. Elle passait par `heroState` +
  // `heroById`, tous deux nuls pour `'__general'` : sa posture était figée en
  // dur à 'commandant' dans l'arène, et son sélecteur ne servait à rien.
  GameState.heroStance = function (id) {
    const o = GameState.talentOwner(id);
    if (!o) return GD.defaultStance('general');
    if (!o.holder.stance) o.holder.stance = GD.defaultStance(o.cls);
    return o.holder.stance;
  };
  GameState.setHeroStance = function (id, stanceId) {
    const o = GameState.talentOwner(id);
    if (!o) return false;
    if (!GD.stanceById(stanceId)) return false;      // une posture inconnue ne s'écrit pas
    o.holder.stance = stanceId;
    GameState.notify();
    return true;
  };

  // ---------------- LE CALCUL RAPIDE (hors écran) ----------------
  // ---------------- HORS ÉCRAN : ON FARME, ON NE DESCEND PLUS ----------------
  // POURQUOI CETTE RÈGLE.
  //
  // Le rattrapage hors-ligne faisait AVANCER la descente : un jet de dé par
  // étage, avec des chances plancher de 15 %. Mesuré (script de comparaison,
  // compagnie de milieu de partie) : jusqu'à l'étage 12 le modèle et le vrai
  // combat s'accordent, mais à partir du 15 il annonçait 65 à 74 % de victoire
  // là où l'arène en donne 0 %. Deux erreurs se cumulaient :
  //   — un boss ne comptait que ×2,2, alors que ses PV réels vont de ×7 (tour)
  //     à ×22 (morts), avec patrons, phases et portails en plus ;
  //   — les salles à OBJECTIF (survie, escorte, cristal, chasse) étaient traitées
  //     comme un peu PLUS FACILES qu'un combat (mult 0,9-0,95), alors qu'on peut
  //     y perdre sans jamais manquer de puissance — le convoi meurt, le
  //     chronomètre tombe, on sort de la lumière du cristal.
  // Conséquence pour le joueur : l'absence poussait le CHECKPOINT bien au-delà
  // de ce qu'il sait battre, et il revenait bloqué sur un étage infranchissable.
  //
  // LA RÈGLE EST DONC RENVERSÉE : la profondeur ne s'achète qu'en PRÉSENCE.
  // Hors écran la compagnie REJOUE l'étage courant — elle en rapporte du butin
  // et de l'XP, jamais un étage de plus. Rien ne bloque l'idle (il produit), et
  // rien ne ment (il ne prétend pas gagner ce qu'il perdrait).
  //
  // Le rendement suit les chances de victoire au lieu de les TIRER AU SORT :
  // une compagnie à son aise récolte plein pot, une compagnie dépassée gratte.
  // C'est ce qui remplace la loterie à 15 % — et ce qui fait qu'une descente
  // hors écran ne se termine plus jamais par surprise.
  function farmOdds(g, d) {
    const kind = GD.roomKind(d.roomType);
    if (!kind.foes) return 1;
    const diff = GD.floorDifficulty(d.floor);
    const power = GameState.partyPower() * GameState.talentPower() * (1 + d.party.length * 0.35);
    // la menace, cette fois SANS mensonge : les PV réels du gardien du biome,
    // et un objectif ne rend pas une salle plus facile.
    const boss = (GD.advFoes ? (GD.advFoes(GD.dungeonBiome(d.floor).id) || {}).boss : null) || null;
    const bossMult = kind.boss ? Math.max(2.2, (boss && boss.hpMult ? boss.hpMult : 7) * 0.55) : 1;
    const objectif = (kind.dur != null || kind.id === 'escorte' || kind.id === 'chasse') ? 1.35 : 1;
    const threat = 26 * diff.hp * Math.max(1, kind.mult || 1) * bossMult * objectif;
    return genClamp(power / (power + threat), 0, 1);
  }
  // UN CYCLE DE FARM : le butin et l'XP d'un étage rejoué, au prorata des
  // chances. Ne touche NI `d.floor`, NI le checkpoint, NI la fin de descente.
  function farmFloor(g, d, cycles) {
    const kind = GD.roomKind(d.roomType);
    if (!kind.foes || cycles <= 0) return 0;
    const o = farmOdds(g, d);
    // sous 20 % de chances la compagnie est dépassée : elle tient la position
    // et ne rapporte rien. Elle ne MEURT pas pour autant — mourir sans le
    // joueur, sur un étage qu'il n'a pas choisi de tenter, serait injuste.
    if (o < 0.2) return 0;
    const biome = GD.dungeonBiome(d.floor);
    const st = GameState.generalStats();
    let n = 0;
    for (let k = 0; k < cycles; k++) {
      const rng = genRng(d.seed ^ ((d.floor + 7) * 374761393) ^ ((d.farmed | 0) + k + 1) * 2654435761);
      // le rendement d'un étage REJOUÉ vaut une fraction de sa première prise :
      // farmer n'est pas descendre, et ne doit jamais le remplacer.
      addLoot(d, biome.id, rng, d.lootMult * (kind.bonus || 1) * 0.6 * o * 0.45);
      d.xp += Math.round((kind.boss ? 45 : kind.id === 'elite' ? 22 : 10) * biome.tier * (1 + (st.xp || 0)) * o * 0.35);
      n++;
      // une blessure de temps en temps, d'autant plus rare qu'on domine
      if (rng() > 0.55 + o * 0.4) {
        const id = d.party[(rng() * d.party.length) | 0];
        const hs = GameState.heroState(id);
        if (hs) {
          const hours = GD.GENERAL.healHours(0.35, st.armor);
          hs.hurtUntil = Math.max(hs.hurtUntil || 0, Date.now() + hours * 3600000);
          g.tally.hurt++;
        }
      }
    }
    d.farmed = (d.farmed | 0) + n;
    return n;
  }

  // ---------------- LE TICK ----------------
  const GEN_LIVE_DT = 5;
  GameState.generalTick = function (dt) {
    const s = GameState.state;
    if (!s.faction || !GEN_DATA()) return;
    const g = GameState.gen();
    if (g.fatigue > 0 && !g.descent) {
      g.fatigue = Math.max(0, g.fatigue - GD.GENERAL.fatigueRecoverPerHour * (dt / 3600));
    }
    const d = g.descent;
    if (!d) return;
    if (d.phase !== 'fight') return;

    const live = dt <= GEN_LIVE_DT && window.Adventure;
    if (!live) {
      // HORS ÉCRAN : la compagnie REJOUE l'étage courant. Elle en rapporte du
      // butin, elle ne descend pas d'un pouce — descendre demande d'être là.
      const cycles = Math.min(80, Math.max(1, Math.floor(dt / 20)));
      const fait = farmFloor(g, d, cycles);
      if (fait > 0) {
        // UNE SEULE ligne de journal pour toute l'absence : quatre-vingts
        // lignes « salle rejouée » noieraient le récit de la descente.
        const der = d.log[d.log.length - 1];
        if (der && der.farm) {
          der.tours += fait;
          der.txt = 'La compagnie a tenu l’étage ' + d.floor + ' — ' + der.tours + ' passage(s) en votre absence.';
        } else {
          d.log.push({ icon: '', name: 'Étage ' + d.floor, farm: true, tours: fait,
            txt: 'La compagnie a tenu l’étage ' + d.floor + ' — ' + fait + ' passage(s) en votre absence.' });
        }
        GameState.notify();
      }
      return;
    }
    // devant l'écran : l'arène est la vérité
    const biome = GD.dungeonBiome(d.floor);
    if (Adventure.active() && Adventure.isCamp && Adventure.isCamp()) Adventure.end();
    if (!Adventure.active()) {
      Adventure.begin({
        biome: biome.id, floor: d.floor, room: d.roomType, auto: g.auto, hp: d.hp,
        // PERDRE FAISAIT DESCENDRE D'UN ÉTAGE. Voici pourquoi.
        //
        // L'arène appelle `onEnd('lost', résultat)` — deux arguments, l'issue
        // puis le détail (adventure.js). Ce rappel n'en lisait qu'UN : il
        // recevait donc la CHAÎNE 'lost' là où il attendait l'objet. Et dans
        // `floorCleared`, le test est `res.won !== false` : sur une chaîne,
        // `res.won` vaut `undefined`, donc `undefined !== false` est VRAI. La
        // défaite était comptée comme une victoire — butin crédité, étage
        // suivant, checkpoint posé.
        //
        // Le rattrapage hors-ligne, lui, passait bien un objet : seul le combat
        // joué DEVANT L'ÉCRAN était touché. C'est ce qui rendait le bug si
        // déroutant — il ne se produisait qu'en jouant. (Depuis, l'absence ne
        // franchit plus d'étage du tout : elle farme.)
        //
        // On normalise ici, et on accepte les deux formes : un appelant qui
        // enverrait l'objet seul reste correct.
        onEnd: (issue, detail) => {
          const dd = GameState.gen().descent;
          if (dd) dd.hp = (window.Adventure && Adventure.partyHp) ? Adventure.partyHp() : null;
          let res = detail;
          if (!res || typeof res !== 'object') {
            res = (issue && typeof issue === 'object') ? issue : { won: issue !== 'lost', hurt: [] };
          }
          // ceinture ET bretelles : si l'issue dit « perdu », elle fait foi,
          // quoi que raconte le détail.
          if (issue === 'lost') res = Object.assign({}, res, { won: false });
          GameState.floorCleared(res);
          // fin de l'arène pour que le prochain tick crée celle de l'étage suivant
          if (window.Adventure && Adventure.active()) Adventure.end();
        },
      });
    }
    Adventure.tick(dt);
  };
