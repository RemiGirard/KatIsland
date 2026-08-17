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
