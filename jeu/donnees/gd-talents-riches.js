/* ============================================================
   GRIFFES & PLUMES — data-talents.js
   LES ARBRES DE TALENTS : 9 classes (le Général compris) ×
   5 branches × 5 nœuds, plus 2 voies exclusives × 3 nœuds.

   FORME D'UNE BRANCHE — identique pour les 9 classes :
     branche 1 : t1 passif · t2 POUVOIR (le précoce, libre) · t3 · t4 · t5 CAPSTONE
     branches 2 et 3 : t1 · t2 · t3 · t4 POUVOIR [choix:'<cls>_a'] · t5 CAPSTONE
     branches 4 et 5 : t1 · t2 · t3 · t4 POUVOIR [choix:'<cls>_b'] · t5 CAPSTONE
     → les 5 nœuds de tier 5 portent tous choix:'<cls>_capstone' : UN SEUL.
   Un personnage porte donc AU PLUS 5 pouvoirs : celui de sa classe (offert,
   slot 0), le précoce, un de `_a`, un de `_b`, celui de sa voie.

   LE VOCABULAIRE EST FERMÉ. Un effet écrit ici et que le moteur ne joue pas
   n'est pas « du contenu en avance » : c'est une promesse muette faite au
   joueur. Le diagnostic à l'origine de cette réécriture : 92 `proc` distincts
   déclarés, 3 lus. D'où la règle : rien n'entre ici qui ne soit dans
   `GameData.PROC_KINDS` / `GameData.ABILITY_MODS` / `GameData.POWERS`
   (data-general.js), et `dev/smoke-pouvoirs.js` refuse le reste.

   Effets possibles, et QUI les lit :
     { kind:'stat',  stat:'dmg', add:4 }                    → combatStats (plat)
     { kind:'pct',   stat:'hp',  pct:0.10 }                 → combatStats (%)
     { kind:'pct',   stat:'loot'|'xp'|'rare', pct:0.10 }    → talentMeta
     { kind:'proc',  proc:'crit', chance:0.12, mult:1.6 }   → l'arène, 7 accroches
     { kind:'aura',  stat:'dmg', pct:0.05 }                 → recalcAuras (LA COMPAGNIE)
     { kind:'ability', cible:'classe'|'<powerId>'|'*', mod:'cd', pct:-0.2 }
                                                            → appliquerMods au spawn
     { kind:'power', power:'<powerId>' }                    → heroPowerIds
   `power` est une CHAÎNE, jamais un objet inliné : un pouvoir inliné dans un
   nœud ne peut être ni partagé, ni corrigé en un endroit, ni re-résolu après
   le rechargement d'une sauvegarde.

   `choix:'<idGroupe>'` — L'EXCLUSION EST UN GROUPE, pas une paire : prendre un
   membre ferme tous les autres. Le champ s'appelle `choix`. Ni `excl`, ni
   `exclut`.
   ============================================================ */
"use strict";

  // helpers compacts. Le 7ᵉ argument `opt` porte tout ce qui est optionnel
  // (`choix`, `req`) sans allonger la signature de tous les nœuds.
  const TN = (id, name, icon, tier, desc, effect, opt) =>
    Object.assign({ id, name, icon, tier, desc, effect }, opt || {});
  const SN = (id, name, icon, tier, desc, effect, opt) =>
    Object.assign({ id, name, icon, tier, desc, effect, spec: 1 }, opt || {});

  GameData.TALENT_TREES = {

    // ==================== GUERRIER ====================
    // Le pouvoir précoce (Javelot) est en Précision ; les paires sont
    // gu_a « comment il frappe » et gu_b « ce qu'il fait du reste ».
    guerrier: { branches: [
      { id: 'fureur', name: 'Fureur', icon: '🔥', nodes: [
        TN('gu_f1', 'Griffes acérées', '💢', 1, '+4 dégâts', { kind: 'stat', stat: 'dmg', add: 4 }),
        TN('gu_f2', 'Frénésie', '⚡', 2, '+12 % de vitesse d’attaque', { kind: 'pct', stat: 'aspd', pct: 0.12 }),
        TN('gu_f3', 'Coup critique', '🎯', 3, '12 % de chance de frapper ×1,6', { kind: 'proc', proc: 'crit', chance: 0.12, mult: 1.6 }),
        TN('gu_f4', 'DÉCAPITATION', '☠️', 4, 'POUVOIR : il traverse la salle pour finir un blessé',
           { kind: 'power', power: 'gu_decapitation' }, { choix: 'gu_a' }),
        // CAPSTONE — absorbe l'ancienne « Exécution » de ce tier : un seul
        // effet par nœud, donc les chiffres montent au lieu de s'additionner.
        TN('gu_f5', 'Soif de sang', '🐺', 5, 'Chaque ennemi tombé : +35 % de vitesse d’attaque pendant 5 s',
           { kind: 'proc', proc: 'frenzy', chance: 1.0, dur: 5, spd: 1.35 }, { choix: 'gu_capstone' }),
      ]},
      { id: 'endurance', name: 'Endurance', icon: '🛡️', nodes: [
        TN('gu_e1', 'Peau dure', '❤️', 1, '+30 PV', { kind: 'stat', stat: 'hp', add: 30 }),
        TN('gu_e2', 'Cuirasse', '🦺', 2, '+8 armure', { kind: 'stat', stat: 'armor', add: 8 }),
        // `lifesteal` est une STAT lue par l'arène, pas un proc (§5.6).
        TN('gu_e3', 'Vampirisme', '🥩', 3, '8 % des dégâts infligés reviennent en PV', { kind: 'stat', stat: 'lifesteal', add: 0.08 }),
        TN('gu_e4', 'PIERRE-DE-GARDE', '🪨', 4, 'POUVOIR : il s’enracine — armure doublée, insensible aux entraves',
           { kind: 'power', power: 'gu_pierre' }, { choix: 'gu_b' }),
        TN('gu_e5', 'Indomptable', '🏔️', 5, 'Survit à un coup mortel, une fois par tranche de 45 s',
           { kind: 'proc', proc: 'undying', chance: 1.0, cd: 45 }, { choix: 'gu_capstone' }),
      ]},
      { id: 'technique', name: 'Technique', icon: '🌀', nodes: [
        TN('gu_t1', 'Pas vifs', '🏃', 1, '+12 vitesse', { kind: 'stat', stat: 'mspd', add: 12 }),
        TN('gu_t2', 'Esquive', '💫', 2, '10 % d’esquive', { kind: 'proc', proc: 'dodge', chance: 0.10 }),
        TN('gu_t3', 'Désarmement', '🔓', 3, '10 % de repousser ce qu’il touche', { kind: 'proc', proc: 'push', chance: 0.10, force: 30 }),
        TN('gu_t4', 'TOURBILLON', '🌪️', 4, 'POUVOIR : il tourne sur lui-même, personne n’ose entrer',
           { kind: 'power', power: 'gu_tourbillon' }, { choix: 'gu_a' }),
        TN('gu_t5', 'Danse des lames', '🤺', 5, 'Fracas : rayon doublé',
           { kind: 'ability', cible: 'classe', mod: 'radius', pct: 1.0 }, { choix: 'gu_capstone' }),
      ]},
      { id: 'commandement', name: 'Commandement', icon: '📯', nodes: [
        TN('gu_c1', 'Cri de guerre', '📢', 1, 'La compagnie : +5 % de dégâts', { kind: 'aura', stat: 'dmg', pct: 0.05 }),
        TN('gu_c2', 'Ralliement', '🚩', 2, 'Chaque ennemi tombé rend 2 % des PV à la compagnie', { kind: 'proc', proc: 'rally_kill', chance: 1.0, heal: 0.02 }),
        TN('gu_c3', 'Ardeur', '🔥', 3, 'Fracas : recharge −25 %', { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.25 }),
        TN('gu_c4', 'CROC-EN-JAMBE', '👟', 4, 'POUVOIR : il fauche un groupe entier, qui reste au sol',
           { kind: 'power', power: 'gu_croc' }, { choix: 'gu_b' }),
        // CAPSTONE — reprend et amplifie « Inspiration », le passif déplacé.
        TN('gu_c5', 'Meneur d’hommes', '🏆', 5, 'La compagnie : +12 % de vitesse d’attaque',
           { kind: 'aura', stat: 'aspd', pct: 0.12 }, { choix: 'gu_capstone' }),
      ]},
      { id: 'precision', name: 'Précision', icon: '🎯', nodes: [
        TN('gu_p1', 'Lancer', '📏', 1, '+40 de portée', { kind: 'stat', stat: 'range', add: 40 }),
        TN('gu_p2', 'JAVELOT', '🪃', 2, 'POUVOIR : un fer lancé qui traverse la file',
           { kind: 'power', power: 'gu_javelot' }),
        TN('gu_p3', 'Fer large', '🗡️', 3, 'Javelot : +60 % de largeur', { kind: 'ability', cible: 'gu_javelot', mod: 'w', pct: 0.6 }),
        TN('gu_p4', 'Enchaînement', '⛓️', 4, 'Fracas touche une seconde cible', { kind: 'ability', cible: 'classe', mod: 'chain', pct: 1 }),
        TN('gu_p5', 'Tir fatal', '💀', 5, 'Sous 15 % des PV de la cible : dégâts ×2,5',
           { kind: 'proc', proc: 'execute', threshold: 0.15, mult: 2.5 }, { choix: 'gu_capstone' }),
      ]},
    ]},

    // ==================== GARDE ====================
    garde: { branches: [
      { id: 'rempart', name: 'Rempart', icon: '🧱', nodes: [
        TN('ga_r1', 'Bouclier lourd', '🛡️', 1, '+12 armure', { kind: 'stat', stat: 'armor', add: 12 }),
        TN('ga_r2', 'Muraille', '🏗️', 2, '+50 PV', { kind: 'stat', stat: 'hp', add: 50 }),
        TN('ga_r3', 'Renvoi', '🪞', 3, '15 % des dégâts encaissés sont renvoyés', { kind: 'proc', proc: 'thorns', chance: 1.0, pct: 0.15 }),
        TN('ga_r4', 'ANCRAGE', '⚓', 4, 'POUVOIR : il plante ses pattes — il n’avance plus, mais rien ne passe',
           { kind: 'power', power: 'ga_ancrage' }, { choix: 'ga_a' }),
        TN('ga_r5', 'Forteresse', '🏰', 5, 'Sous 50 % de ses PV : +60 % d’armure',
           { kind: 'proc', proc: 'secondwind', threshold: 0.50, armor: 0.6 }, { choix: 'ga_capstone' }),
      ]},
      { id: 'provocation', name: 'Provocation', icon: '📢', nodes: [
        TN('ga_p1', 'Cri perçant', '📢', 1, 'Provocation : rayon +30 %', { kind: 'ability', cible: 'classe', mod: 'radius', pct: 0.3 }),
        TN('ga_p2', 'Menace', '👹', 2, 'Les ennemis frappent 8 % moins fort', { kind: 'aura', stat: 'enemyDmg', pct: -0.08 }),
        TN('ga_p3', 'Appel du bouclier', '🔔', 3, 'Provocation : recharge −30 %', { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.30 }),
        TN('ga_p4', 'JUGEMENT', '⚖️', 4, 'POUVOIR : un cercle de sentence qui ronge et retient',
           { kind: 'power', power: 'ga_jugement' }, { choix: 'ga_b' }),
        TN('ga_p5', 'Présence', '💠', 5, 'La compagnie : +10 d’armure',
           { kind: 'aura', stat: 'armor', add: 10 }, { choix: 'ga_capstone' }),
      ]},
      { id: 'vigueur', name: 'Vigueur', icon: '💪', nodes: [
        TN('ga_v1', 'Constitution', '❤️', 1, '+40 PV', { kind: 'stat', stat: 'hp', add: 40 }),
        TN('ga_v2', 'REPRISE', '🩹', 2, 'POUVOIR : il se recoud sur place et se débarrasse de ce qui le ronge',
           { kind: 'power', power: 'ga_reprise' }),
        TN('ga_v3', 'Endurance', '🏃', 3, '+15 vitesse', { kind: 'stat', stat: 'mspd', add: 15 }),
        TN('ga_v4', 'Peau de fer', '🪨', 4, '+15 % de PV max', { kind: 'pct', stat: 'hp', pct: 0.15 }),
        TN('ga_v5', 'Immortel', '⭐', 5, 'Survit à un coup mortel, une fois par tranche de 75 s',
           { kind: 'proc', proc: 'undying', chance: 1.0, cd: 75 }, { choix: 'ga_capstone' }),
      ]},
      { id: 'chatiment', name: 'Châtiment', icon: '⚡', nodes: [
        TN('ga_ch1', 'Frappe lourde', '💢', 1, '+5 dégâts', { kind: 'stat', stat: 'dmg', add: 5 }),
        TN('ga_ch2', 'Contre', '🪃', 2, '30 % de rendre le coup', { kind: 'proc', proc: 'riposte', chance: 0.3, mult: 1.0 }),
        TN('ga_ch3', 'Onde de choc', '🌊', 3, '15 % de repousser ce qu’il touche', { kind: 'proc', proc: 'push', chance: 0.15, force: 35 }),
        TN('ga_ch4', 'COUP DE PAVOIS', '🧱', 4, 'POUVOIR : un coup de bouclier qui assomme et repousse',
           { kind: 'power', power: 'ga_pavois' }, { choix: 'ga_a' }),
        // CAPSTONE — « Vengeance », le passif déplacé, promu et corrigé :
        // c'est SON état de santé qui compte, donc `lowhp_dmg`, pas `execute`.
        TN('ga_ch5', 'Vengeance', '🔨', 5, 'Sous 40 % de ses PV : +50 % de dégâts',
           { kind: 'proc', proc: 'lowhp_dmg', threshold: 0.40, mult: 1.5 }, { choix: 'ga_capstone' }),
      ]},
      { id: 'sacrifice', name: 'Sacrifice', icon: '🕯️', nodes: [
        TN('ga_s1', 'Garde du corps', '🦺', 1, 'La compagnie : +5 d’armure', { kind: 'aura', stat: 'armor', add: 5 }),
        TN('ga_s2', 'Interception', '🏃', 2, '+20 vitesse', { kind: 'stat', stat: 'mspd', add: 20 }),
        TN('ga_s3', 'Bouclier humain', '🛡️', 3, 'Il encaisse pour les autres : +20 % d’armure', { kind: 'pct', stat: 'armor', pct: 0.20 }),
        TN('ga_s4', 'BOUCLIER PARTAGÉ', '🤝', 4, 'POUVOIR : la compagnie encaisse un tiers de moins pendant 8 s',
           { kind: 'power', power: 'ga_partage' }, { choix: 'ga_b' }),
        TN('ga_s5', 'Abnégation', '🕯️', 5, 'Les soins qu’il reçoit sont augmentés de 60 %',
           { kind: 'pct', stat: 'heal_recv', pct: 0.60 }, { choix: 'ga_capstone' }),
      ]},
    ]},

    // ==================== TIREUR ====================
    tireur: { branches: [
      { id: 'precision_t', name: 'Précision', icon: '🎯', nodes: [
        TN('ti_pr1', 'Œil de lynx', '👁️', 1, '+25 de portée', { kind: 'stat', stat: 'range', add: 25 }),
        TN('ti_pr2', 'Tir tendu', '📏', 2, 'Tir perçant : +35 % de longueur', { kind: 'ability', cible: 'classe', mod: 'len', pct: 0.35 }),
        TN('ti_pr3', 'Point faible', '🔎', 3, '15 % de chance de frapper ×1,8', { kind: 'proc', proc: 'crit', chance: 0.15, mult: 1.8 }),
        TN('ti_pr4', 'TIR DE SNIPER', '🔭', 4, 'POUVOIR : un trait unique, de très loin, qui fait très mal',
           { kind: 'power', power: 'ti_sniper' }, { choix: 'ti_a' }),
        TN('ti_pr5', 'Tir de barrage', '⏱️', 5, 'Tir perçant : recharge −40 %',
           { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.40 }, { choix: 'ti_capstone' }),
      ]},
      { id: 'survie', name: 'Survie', icon: '🌿', nodes: [
        TN('ti_s1', 'Agilité', '💨', 1, '+15 vitesse', { kind: 'stat', stat: 'mspd', add: 15 }),
        TN('ti_s2', 'Roulade', '🤸', 2, '12 % d’esquive', { kind: 'proc', proc: 'dodge', chance: 0.12 }),
        TN('ti_s3', 'Entrave', '🧵', 3, '25 % de ralentir la cible 2 s', { kind: 'proc', proc: 'slow', chance: 0.25, dur: 2, pct: 0.25 }),
        TN('ti_s4', 'PIÈGE À MÂCHOIRES', '🪤', 4, 'POUVOIR : un piège posé qui mord et cloue sur place',
           { kind: 'power', power: 'ti_machoires' }, { choix: 'ti_b' }),
        TN('ti_s5', 'Insaisissable', '👻', 5, '20 % d’esquive',
           { kind: 'proc', proc: 'dodge', chance: 0.20 }, { choix: 'ti_capstone' }),
      ]},
      { id: 'rapidite', name: 'Rapidité', icon: '⚡', nodes: [
        TN('ti_ra1', 'Doigts lestes', '🤌', 1, '+10 % de vitesse d’attaque', { kind: 'pct', stat: 'aspd', pct: 0.10 }),
        TN('ti_ra2', 'Double tir', '🪶', 2, '10 % de tirer deux fois', { kind: 'proc', proc: 'double', chance: 0.10 }),
        TN('ti_ra3', 'Tir rapide', '⚡', 3, '+18 % de vitesse d’attaque', { kind: 'pct', stat: 'aspd', pct: 0.18 }),
        TN('ti_ra4', 'TIR EN ÉVENTAIL', '✌️', 4, 'POUVOIR : trois traits d’un coup, en éventail',
           { kind: 'power', power: 'ti_eventail' }, { choix: 'ti_a' }),
        TN('ti_ra5', 'Frénésie du tireur', '🔥', 5, 'Chaque ennemi tombé : +35 % de vitesse d’attaque pendant 5 s',
           { kind: 'proc', proc: 'frenzy', chance: 1.0, dur: 5, spd: 1.35 }, { choix: 'ti_capstone' }),
      ]},
      { id: 'poisons', name: 'Poisons', icon: '☠️', nodes: [
        TN('ti_po1', 'Pointe venimeuse', '⚗️', 1, '30 % d’empoisonner la cible 3 s', { kind: 'proc', proc: 'poison', chance: 0.3, dur: 3, dps: 0.1 }),
        TN('ti_po2', 'Neurotoxine', '💉', 2, '25 % de percer l’armure : −4 pendant 6 s', { kind: 'proc', proc: 'puncture', chance: 0.25, dur: 6, armor: 4 }),
        TN('ti_po3', 'Venin concentré', '🧬', 3, '+10 % de dégâts', { kind: 'pct', stat: 'dmg', pct: 0.10 }),
        TN('ti_po4', 'FLÈCHE EMPOISONNÉE', '🧪', 4, 'POUVOIR : un trait qui empoisonne et se transmet',
           { kind: 'power', power: 'ti_venin' }, { choix: 'ti_b' }),
        TN('ti_po5', 'Mort lente', '💀', 5, 'Chaque coup empoisonne la cible pendant 6 s',
           { kind: 'proc', proc: 'poison', chance: 1.0, dur: 6, dps: 0.22 }, { choix: 'ti_capstone' }),
      ]},
      { id: 'eclaireur_t', name: 'Éclaireur', icon: '🧭', nodes: [
        TN('ti_e1', 'Pas de loup', '🐾', 1, '+10 vitesse', { kind: 'stat', stat: 'mspd', add: 10 }),
        TN('ti_e2', 'MARQUE DU CHASSEUR', '🎯', 2, 'POUVOIR : la cible désignée encaisse 30 % de plus, de tout le monde',
           { kind: 'power', power: 'ti_marque' }),
        TN('ti_e3', 'Traque', '🔍', 3, 'La cible qu’il vise encaisse +10 % de la compagnie', { kind: 'proc', proc: 'mark', chance: 1.0, pct: 0.10 }),
        TN('ti_e4', 'Tir de sommation', '⚠️', 4, '20 % de repousser ce qu’il touche', { kind: 'proc', proc: 'push', chance: 0.20, force: 35 }),
        // CAPSTONE — « Œil du faucon », le passif que le pouvoir précoce a
        // délogé du tier 2, remonté ici avec des chiffres de capstone.
        TN('ti_e5', 'Œil du faucon', '🦅', 5, '+25 % de portée',
           { kind: 'pct', stat: 'range', pct: 0.25 }, { choix: 'ti_capstone' }),
      ]},
    ]},

    // ==================== MAGE ====================
    mage: { branches: [
      { id: 'arcane', name: 'Arcane', icon: '💠', nodes: [
        TN('ma_a1', 'Puissance arcane', '🪄', 1, '+6 dégâts', { kind: 'stat', stat: 'dmg', add: 6 }),
        TN('ma_a2', 'Trait renforcé', '🌟', 2, 'Trait arcane : +30 % de dégâts', { kind: 'ability', cible: 'classe', mod: 'mult', pct: 0.3 }),
        TN('ma_a3', 'Pénétration', '🗡️', 3, 'Ses coups ignorent 30 % de l’armure', { kind: 'proc', proc: 'penetrate', chance: 1.0, pct: 0.30 }),
        TN('ma_a4', 'NOVA ARCANE', '💠', 4, 'POUVOIR : une déflagration qui repousse tout autour de lui',
           { kind: 'power', power: 'ma_nova' }, { choix: 'ma_a' }),
        TN('ma_a5', 'Annihilation', '💢', 5, 'Trait arcane : recharge −40 %',
           { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.40 }, { choix: 'ma_capstone' }),
      ]},
      { id: 'elementaire', name: 'Élémentaire', icon: '🌊', nodes: [
        TN('ma_el1', 'Gel', '🌬️', 1, '15 % de ralentir la cible 2 s', { kind: 'proc', proc: 'slow', chance: 0.15, dur: 2, pct: 0.25 }),
        TN('ma_el2', 'Brûlure', '🔥', 2, '25 % d’enflammer la cible 4 s', { kind: 'proc', proc: 'burn', chance: 0.25, dur: 4, dps: 0.15 }),
        TN('ma_el3', 'Onde froide', '💧', 3, '+25 % de dégâts sur une cible ralentie', { kind: 'proc', proc: 'vs_slow', mult: 1.25 }),
        TN('ma_el4', 'ÉCLAIR FOURCHU', '⚡', 4, 'POUVOIR : la foudre saute d’un ennemi au suivant',
           { kind: 'power', power: 'ma_fourchu' }, { choix: 'ma_a' }),
        TN('ma_el5', 'Cataclysme', '🌋', 5, 'Trait arcane éclabousse tout autour du point d’impact',
           { kind: 'ability', cible: 'classe', mod: 'splash', pct: 0.5 }, { choix: 'ma_capstone' }),
      ]},
      { id: 'savoir', name: 'Savoir', icon: '📚', nodes: [
        TN('ma_sa1', 'Étude', '📖', 1, '+20 PV', { kind: 'stat', stat: 'hp', add: 20 }),
        TN('ma_sa2', 'Méditation', '🧘', 2, 'Régénère 0,8 % de ses PV par seconde', { kind: 'proc', proc: 'regen', chance: 1.0, pct: 0.008 }),
        TN('ma_sa3', 'Barrière', '🛡️', 3, '+12 % de PV max', { kind: 'pct', stat: 'hp', pct: 0.12 }),
        TN('ma_sa4', 'MUR DE GIVRE', '🧊', 4, 'POUVOIR : un mur de glace en travers de la salle',
           { kind: 'power', power: 'ma_givre' }, { choix: 'ma_b' }),
        TN('ma_sa5', 'Sagesse', '🦉', 5, '+25 % d’expérience gagnée',
           { kind: 'pct', stat: 'xp', pct: 0.25 }, { choix: 'ma_capstone' }),
      ]},
      { id: 'destruction', name: 'Destruction', icon: '☄️', nodes: [
        TN('ma_d1', 'Amplification', '📊', 1, '+8 % de dégâts', { kind: 'pct', stat: 'dmg', pct: 0.08 }),
        TN('ma_d2', 'Résonance', '🔔', 2, '12 % de chance de frapper ×1,7', { kind: 'proc', proc: 'crit', chance: 0.12, mult: 1.7 }),
        TN('ma_d3', 'Faille', '🕳️', 3, 'Trait arcane : +30 % de portée', { kind: 'ability', cible: 'classe', mod: 'range', pct: 0.30 }),
        TN('ma_d4', 'RUPTURE', '🔮', 4, 'POUVOIR : l’armure des ennemis touchés se fend pour 6 s',
           { kind: 'power', power: 'ma_rupture' }, { choix: 'ma_b' }),
        TN('ma_d5', 'Apocalypse', '💀', 5, 'Sous 30 % des PV de la cible : dégâts ×1,5',
           { kind: 'proc', proc: 'execute', threshold: 0.30, mult: 1.5 }, { choix: 'ma_capstone' }),
      ]},
      { id: 'illusion', name: 'Illusion', icon: '🎭', nodes: [
        TN('ma_i1', 'Mirage', '👁️', 1, '8 % d’esquive', { kind: 'proc', proc: 'dodge', chance: 0.08 }),
        TN('ma_i2', 'CLIGNEMENT', '💫', 2, 'POUVOIR : il disparaît d’un endroit et réapparaît plus loin',
           { kind: 'power', power: 'ma_clignement' }),
        TN('ma_i3', 'Déphasage', '🌫️', 3, '+14 vitesse', { kind: 'stat', stat: 'mspd', add: 14 }),
        TN('ma_i4', 'Vertige', '💤', 4, '15 % de ralentir la cible 3 s', { kind: 'proc', proc: 'slow', chance: 0.15, dur: 3, pct: 0.30 }),
        TN('ma_i5', 'Insaisissable', '👻', 5, '22 % d’esquive',
           { kind: 'proc', proc: 'dodge', chance: 0.22 }, { choix: 'ma_capstone' }),
      ]},
    ]},

    // ==================== ARTIFICIER ====================
    artificier: { branches: [
      { id: 'explosifs', name: 'Explosifs', icon: '💣', nodes: [
        TN('ar_ex1', 'Poudre noire', '🎇', 1, '+5 dégâts', { kind: 'stat', stat: 'dmg', add: 5 }),
        TN('ar_ex2', 'Charge creuse', '🕳️', 2, 'Bombe : rayon +25 %', { kind: 'ability', cible: 'classe', mod: 'radius', pct: 0.25 }),
        TN('ar_ex3', 'Fragmentation', '💢', 3, 'Bombe : +25 % de dégâts', { kind: 'ability', cible: 'classe', mod: 'mult', pct: 0.25 }),
        TN('ar_ex4', 'GRAPPE', '🧨', 4, 'POUVOIR : cinq petites charges qui retombent en grappe',
           { kind: 'power', power: 'ar_grappe' }, { choix: 'ar_a' }),
        TN('ar_ex5', 'Double charge', '✌️', 5, '30 % de tirer deux fois',
           { kind: 'proc', proc: 'double', chance: 0.30 }, { choix: 'ar_capstone' }),
      ]},
      { id: 'pieges', name: 'Pièges', icon: '🪤', nodes: [
        TN('ar_pi1', 'Fil de détente', '🧵', 1, '+10 vitesse', { kind: 'stat', stat: 'mspd', add: 10 }),
        TN('ar_pi2', 'Charge à retardement', '⏱️', 2, '25 % d’enflammer la cible 4 s', { kind: 'proc', proc: 'burn', chance: 0.25, dur: 4, dps: 0.15 }),
        TN('ar_pi3', 'Filet', '🕸️', 3, '30 % de ralentir la cible 3 s', { kind: 'proc', proc: 'slow', chance: 0.30, dur: 3, pct: 0.3 }),
        TN('ar_pi4', 'FLAQUE D’ACIDE', '⚗️', 4, 'POUVOIR : une flaque qui dissout l’armure de qui la traverse',
           { kind: 'power', power: 'ar_acide' }, { choix: 'ar_b' }),
        TN('ar_pi5', 'Sape', '🪚', 5, '35 % de percer l’armure : −6 pendant 6 s',
           { kind: 'proc', proc: 'puncture', chance: 0.35, dur: 6, armor: 6 }, { choix: 'ar_capstone' }),
      ]},
      { id: 'ingenierie', name: 'Ingénierie', icon: '⚙️', nodes: [
        TN('ar_in1', 'Blindage', '🦺', 1, '+6 armure', { kind: 'stat', stat: 'armor', add: 6 }),
        TN('ar_in2', 'BOUCLIER DE FORTUNE', '🔩', 2, 'POUVOIR : de la ferraille sanglée sur toute la compagnie',
           { kind: 'power', power: 'ar_fortune' }),
        TN('ar_in3', 'Surcharge', '🔋', 3, 'Bombe : recharge −25 %', { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.25 }),
        TN('ar_in4', 'Rouages', '⚙️', 4, '+15 % de vitesse d’attaque', { kind: 'pct', stat: 'aspd', pct: 0.15 }),
        // `cible:'*'` — toute la panoplie, pas seulement la capacité de classe.
        TN('ar_in5', 'Surrégime', '⚡', 5, 'Tous ses pouvoirs : recharge −25 %',
           { kind: 'ability', cible: '*', mod: 'cd', pct: -0.25 }, { choix: 'ar_capstone' }),
      ]},
      { id: 'alchimie', name: 'Alchimie', icon: '⚗️', nodes: [
        TN('ar_al1', 'Fiole acide', '🧪', 1, '25 % d’empoisonner la cible 3 s', { kind: 'proc', proc: 'poison', chance: 0.25, dur: 3, dps: 0.12 }),
        TN('ar_al2', 'Fumigène', '💨', 2, '10 % d’esquive', { kind: 'proc', proc: 'dodge', chance: 0.10 }),
        TN('ar_al3', 'Élixir', '🍶', 3, '+15 % de PV max', { kind: 'pct', stat: 'hp', pct: 0.15 }),
        TN('ar_al4', 'FEU GRÉGEOIS', '🔥', 4, 'POUVOIR : une nappe de feu qui brûle tant qu’elle dure',
           { kind: 'power', power: 'ar_gregeois' }, { choix: 'ar_b' }),
        TN('ar_al5', 'Catalyseur', '💎', 5, '+40 % de dégâts sur une cible en feu',
           { kind: 'proc', proc: 'vs_burn', mult: 1.4 }, { choix: 'ar_capstone' }),
      ]},
      { id: 'demolition', name: 'Démolition', icon: '🏚️', nodes: [
        TN('ar_de1', 'Masse', '🔨', 1, '+4 dégâts', { kind: 'stat', stat: 'dmg', add: 4 }),
        TN('ar_de2', 'Brèche', '💢', 2, '30 % de percer l’armure : −3 pendant 5 s', { kind: 'proc', proc: 'puncture', chance: 0.30, dur: 5, armor: 3 }),
        TN('ar_de3', 'Onde sismique', '🌊', 3, '20 % de repousser ce qu’il touche', { kind: 'proc', proc: 'push', chance: 0.20, force: 35 }),
        TN('ar_de4', 'CHARGE DE DÉMOLITION', '🪨', 4, 'POUVOIR : une charge annoncée, énorme, qui laisse un cratère',
           { kind: 'power', power: 'ar_demolition' }, { choix: 'ar_a' }),
        TN('ar_de5', 'Bouton rouge', '🕹️', 5, '+20 % de dégâts',
           { kind: 'pct', stat: 'dmg', pct: 0.20 }, { choix: 'ar_capstone' }),
      ]},
    ]},

    // ==================== ECLAIREUR ====================
    eclaireur: { branches: [
      { id: 'agilite', name: 'Agilité', icon: '💨', nodes: [
        TN('ec_ag1', 'Sprint', '🏃', 1, '+18 vitesse', { kind: 'stat', stat: 'mspd', add: 18 }),
        TN('ec_ag2', 'CROCHET', '🤸', 2, 'POUVOIR : un bond de côté qui le sort de tout',
           { kind: 'power', power: 'ec_crochet' }),
        TN('ec_ag3', 'Pas de l’ombre', '🐾', 3, '12 % d’esquive', { kind: 'proc', proc: 'dodge', chance: 0.12 }),
        TN('ec_ag4', 'Réflexes', '⚡', 4, 'Esquive : +30 % de vitesse en plus', { kind: 'ability', cible: 'classe', mod: 'spd', pct: 0.30 }),
        TN('ec_ag5', 'Intouchable', '🌟', 5, '25 % d’esquive',
           { kind: 'proc', proc: 'dodge', chance: 0.25 }, { choix: 'ec_capstone' }),
      ]},
      { id: 'assassinat', name: 'Assassinat', icon: '🗡️', nodes: [
        TN('ec_as1', 'Lame affûtée', '🗡️', 1, '+5 dégâts', { kind: 'stat', stat: 'dmg', add: 5 }),
        TN('ec_as2', 'Frappe sournoise', '🌑', 2, '+30 % de dégâts sur une cible occupée ailleurs', { kind: 'proc', proc: 'backstab', mult: 1.30 }),
        TN('ec_as3', 'Hémorragie', '🩹', 3, '30 % de faire saigner la cible 4 s', { kind: 'proc', proc: 'bleed', chance: 0.30, dur: 4, dps: 0.15 }),
        TN('ec_as4', 'ÉVENTRATION', '🔪', 4, 'POUVOIR : une entaille profonde qui saigne longtemps',
           { kind: 'power', power: 'ec_eventration' }, { choix: 'ec_a' }),
        TN('ec_as5', 'Exécution silencieuse', '💀', 5, 'Sous 25 % des PV de la cible : dégâts ×2,2',
           { kind: 'proc', proc: 'execute', threshold: 0.25, mult: 2.2 }, { choix: 'ec_capstone' }),
      ]},
      { id: 'evasion', name: 'Évasion', icon: '🌀', nodes: [
        TN('ec_ev1', 'Esquive roulée', '🧗', 1, 'Esquive : recharge −20 %', { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.20 }),
        TN('ec_ev2', 'Contre-pied', '🪃', 2, 'Une fois sur deux, il rend le coup', { kind: 'proc', proc: 'riposte', chance: 0.5, mult: 1.0 }),
        TN('ec_ev3', 'Cuir clouté', '🦺', 3, '+6 armure', { kind: 'stat', stat: 'armor', add: 6 }),
        TN('ec_ev4', 'ÉCRAN DE FUMÉE', '🌫️', 4, 'POUVOIR : un nuage où les siens deviennent introuvables',
           { kind: 'power', power: 'ec_fumee' }, { choix: 'ec_b' }),
        TN('ec_ev5', 'Fantôme', '👻', 5, 'Esquive : recharge −40 %',
           { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.40 }, { choix: 'ec_capstone' }),
      ]},
      { id: 'eclaireur_e', name: 'Éclaireur', icon: '🧭', nodes: [
        TN('ec_ec1', 'Coup d’œil', '🔎', 1, '+20 de portée', { kind: 'stat', stat: 'range', add: 20 }),
        TN('ec_ec2', 'Cartographie', '🗺️', 2, '+10 % de butin', { kind: 'pct', stat: 'loot', pct: 0.10 }),
        TN('ec_ec3', 'Guet-apens', '🌿', 3, 'Début de salle : +15 % de dégâts pendant 5 s', { kind: 'proc', proc: 'speech', chance: 1.0, dur: 5, pct: 0.15 }),
        TN('ec_ec4', 'REPÉRAGE', '🔍', 4, 'POUVOIR : toute la salle est marquée — chacun encaisse davantage',
           { kind: 'power', power: 'ec_reperage' }, { choix: 'ec_b' }),
        TN('ec_ec5', 'Pillage', '💰', 5, '+25 % de butin',
           { kind: 'pct', stat: 'loot', pct: 0.25 }, { choix: 'ec_capstone' }),
      ]},
      { id: 'duel', name: 'Duel', icon: '⚔️', nodes: [
        TN('ec_du1', 'Vivacité', '⚡', 1, '+12 % de vitesse d’attaque', { kind: 'pct', stat: 'aspd', pct: 0.12 }),
        TN('ec_du2', 'Feinte', '🎭', 2, '12 % de repousser ce qu’il touche', { kind: 'proc', proc: 'push', chance: 0.12, force: 30 }),
        TN('ec_du3', 'Enchaînement', '🔗', 3, 'Chaque ennemi tombé : +15 % de vitesse d’attaque pendant 5 s', { kind: 'proc', proc: 'frenzy', chance: 1.0, dur: 5, spd: 1.15 }),
        TN('ec_du4', 'PROVOCATION EN DUEL', '🤺', 4, 'POUVOIR : il prend un adversaire pour lui seul',
           { kind: 'power', power: 'ec_duel' }, { choix: 'ec_a' }),
        TN('ec_du5', 'Maître d’armes', '🏆', 5, 'Chaque esquive déclenche une contre-attaque à 180 %',
           { kind: 'proc', proc: 'riposte', chance: 1.0, mult: 1.8 }, { choix: 'ec_capstone' }),
      ]},
    ]},

    // ==================== SOIGNEUR ====================
    soigneur: { branches: [
      { id: 'medecine', name: 'Médecine', icon: '💚', nodes: [
        TN('so_me1', 'Baume amélioré', '🧴', 1, 'Baume : +10 % de soin', { kind: 'ability', cible: 'classe', mod: 'pct', pct: 0.10 }),
        TN('so_me2', 'TRANSFUSION', '💉', 2, 'POUVOIR : un gros soin, sur un seul, de loin',
           { kind: 'power', power: 'so_transfusion' }),
        TN('so_me3', 'Soin critique', '✨', 3, '20 % des soins comptent ×1,5', { kind: 'proc', proc: 'crit_heal', chance: 0.20, mult: 1.5 }),
        TN('so_me4', 'Antidote', '🧪', 4, 'Baume purge poison et brûlure', { kind: 'ability', cible: 'classe', mod: 'cleanse', pct: 1 }),
        TN('so_me5', 'Herboristerie', '🌱', 5, 'La compagnie régénère 0,8 % de ses PV par seconde',
           { kind: 'aura', stat: 'regen', pct: 0.008 }, { choix: 'so_capstone' }),
      ]},
      { id: 'protection', name: 'Protection', icon: '🔰', nodes: [
        TN('so_pr1', 'Bénédiction', '🙏', 1, 'La compagnie : +5 d’armure', { kind: 'aura', stat: 'armor', add: 5 }),
        TN('so_pr2', 'Bouclier sacré', '🛡️', 2, 'La compagnie : +10 % d’armure', { kind: 'aura', stat: 'armor', pct: 0.10 }),
        TN('so_pr3', 'Garde divine', '👼', 3, 'La compagnie : +8 % de PV max', { kind: 'aura', stat: 'hp', pct: 0.08 }),
        TN('so_pr4', 'SANCTUAIRE', '⛪', 4, 'POUVOIR : un cercle où l’on se soigne — mais il faut y rester',
           { kind: 'power', power: 'so_sanctuaire' }, { choix: 'so_a' }),
        TN('so_pr5', 'Immortalité', '🕯️', 5, 'Survit à un coup mortel, une fois par tranche de 60 s',
           { kind: 'proc', proc: 'undying', chance: 1.0, cd: 60 }, { choix: 'so_capstone' }),
      ]},
      { id: 'lumiere', name: 'Lumière', icon: '☀️', nodes: [
        TN('so_lu1', 'Éclat', '💡', 1, '+4 dégâts', { kind: 'stat', stat: 'dmg', add: 4 }),
        TN('so_lu2', 'Rayon', '⚡', 2, '+12 % de dégâts', { kind: 'pct', stat: 'dmg', pct: 0.12 }),
        TN('so_lu3', 'Lumière brûlante', '☀️', 3, '20 % d’enflammer la cible 3 s', { kind: 'proc', proc: 'burn', chance: 0.20, dur: 3, dps: 0.1 }),
        TN('so_lu4', 'CHÂTIMENT', '🔆', 4, 'POUVOIR : un trait de lumière qui blesse ici et soigne là-bas',
           { kind: 'power', power: 'so_chatiment' }, { choix: 'so_b' }),
        TN('so_lu5', 'Colère divine', '🌩️', 5, 'Chaque coup enflamme la cible pendant 5 s',
           { kind: 'proc', proc: 'burn', chance: 1.0, dur: 5, dps: 0.2 }, { choix: 'so_capstone' }),
      ]},
      { id: 'nature', name: 'Nature', icon: '🌱', nodes: [
        TN('so_na1', 'Sève', '🌳', 1, '+25 PV', { kind: 'stat', stat: 'hp', add: 25 }),
        TN('so_na2', 'Racines', '🪴', 2, '30 % de ralentir la cible 3 s', { kind: 'proc', proc: 'slow', chance: 0.30, dur: 3, pct: 0.3 }),
        TN('so_na3', 'Photosynthèse', '🌻', 3, 'Régénère 0,5 % de ses PV par seconde', { kind: 'proc', proc: 'regen', chance: 1.0, pct: 0.005 }),
        TN('so_na4', 'RONCES', '🌿', 4, 'POUVOIR : un tapis d’épines qui retient et entame',
           { kind: 'power', power: 'so_ronces' }, { choix: 'so_b' }),
        TN('so_na5', 'Renaissance', '🌸', 5, 'Baume : recharge −35 %',
           { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.35 }, { choix: 'so_capstone' }),
      ]},
      { id: 'sagesse_s', name: 'Sagesse', icon: '🦉', nodes: [
        TN('so_sa1', 'Concentration', '🧘', 1, 'Baume : rayon +10 %', { kind: 'ability', cible: 'classe', mod: 'radius', pct: 0.10 }),
        TN('so_sa2', 'Empathie', '💕', 2, '25 % des soins comptent ×1,4', { kind: 'proc', proc: 'crit_heal', chance: 0.25, mult: 1.4 }),
        TN('so_sa3', 'Prévoyance', '🔮', 3, 'Les soins qu’il reçoit sont augmentés de 25 %', { kind: 'pct', stat: 'heal_recv', pct: 0.25 }),
        TN('so_sa4', 'ÉGIDE', '🪞', 4, 'POUVOIR : une peau de force qui absorbe, et qui suit',
           { kind: 'power', power: 'so_egide' }, { choix: 'so_a' }),
        TN('so_sa5', 'Transcendance', '🌈', 5, 'Baume : rayon +50 %',
           { kind: 'ability', cible: 'classe', mod: 'radius', pct: 0.50 }, { choix: 'so_capstone' }),
      ]},
    ]},

    // ==================== BARDE ====================
    barde: { branches: [
      { id: 'harmonie', name: 'Harmonie', icon: '🎵', nodes: [
        TN('ba_ha1', 'Accord majeur', '🎶', 1, 'Refrain : +5 % de dégâts en plus', { kind: 'ability', cible: 'classe', mod: 'dmg', pct: 0.05 }),
        TN('ba_ha2', 'Résonance', '🔔', 2, 'Refrain dure 37 % plus longtemps', { kind: 'ability', cible: 'classe', mod: 'dur', pct: 0.375 }),
        TN('ba_ha3', 'Harmonique', '🎺', 3, 'La compagnie : +6 % de vitesse d’attaque', { kind: 'aura', stat: 'aspd', pct: 0.06 }),
        TN('ba_ha4', 'HYMNE', '🎼', 4, 'POUVOIR : un chant au sol qui porte et recoud les siens',
           { kind: 'power', power: 'ba_hymne' }, { choix: 'ba_a' }),
        TN('ba_ha5', 'Symphonie', '🎻', 5, 'Refrain : +15 % de dégâts en plus',
           { kind: 'ability', cible: 'classe', mod: 'dmg', pct: 0.15 }, { choix: 'ba_capstone' }),
      ]},
      { id: 'dissonance', name: 'Dissonance', icon: '💢', nodes: [
        TN('ba_di1', 'Note aiguë', '🔊', 1, '+4 dégâts', { kind: 'stat', stat: 'dmg', add: 4 }),
        TN('ba_di2', 'Fausse note', '📢', 2, 'Les ennemis frappent 8 % moins fort', { kind: 'aura', stat: 'enemyDmg', pct: -0.08 }),
        TN('ba_di3', 'Dissonance', '📉', 3, '20 % de percer l’armure : −4 pendant 5 s', { kind: 'proc', proc: 'puncture', chance: 0.20, dur: 5, armor: 4 }),
        TN('ba_di4', 'CACOPHONIE', '🔇', 4, 'POUVOIR : un vacarme qui ralentit les gestes de tout un groupe',
           { kind: 'power', power: 'ba_cacophonie' }, { choix: 'ba_a' }),
        TN('ba_di5', 'Chant funèbre', '💀', 5, 'Sous 25 % des PV de la cible : dégâts ×2',
           { kind: 'proc', proc: 'execute', threshold: 0.25, mult: 2.0 }, { choix: 'ba_capstone' }),
      ]},
      { id: 'rythme', name: 'Rythme', icon: '🥁', nodes: [
        TN('ba_ry1', 'Tempo', '⏱️', 1, '+10 vitesse', { kind: 'stat', stat: 'mspd', add: 10 }),
        TN('ba_ry2', 'MARCHE FORCÉE', '🥁', 2, 'POUVOIR : la compagnie double le pas et se débarrasse de ce qui la ronge',
           { kind: 'power', power: 'ba_marche' }),
        TN('ba_ry3', 'Syncopation', '💫', 3, '12 % d’esquive', { kind: 'proc', proc: 'dodge', chance: 0.12 }),
        TN('ba_ry4', 'Allegro', '⚡', 4, 'La compagnie : +15 % de vitesse', { kind: 'aura', stat: 'mspd', pct: 0.15 }),
        TN('ba_ry5', 'Presto', '🌟', 5, 'La compagnie : +12 % de vitesse d’attaque',
           { kind: 'aura', stat: 'aspd', pct: 0.12 }, { choix: 'ba_capstone' }),
      ]},
      { id: 'charme', name: 'Charme', icon: '💫', nodes: [
        TN('ba_ch1', 'Sourire', '😇', 1, '+20 PV', { kind: 'stat', stat: 'hp', add: 20 }),
        TN('ba_ch2', 'Somnolence', '💤', 2, '20 % d’engourdir la cible 3 s', { kind: 'proc', proc: 'slow', chance: 0.20, dur: 3, pct: 0.35 }),
        TN('ba_ch3', 'Envoûtement', '💞', 3, 'La compagnie : +6 % de dégâts', { kind: 'aura', stat: 'dmg', pct: 0.06 }),
        TN('ba_ch4', 'BERCEUSE', '😴', 4, 'POUVOIR : tout un groupe s’endort debout, trois secondes',
           { kind: 'power', power: 'ba_berceuse' }, { choix: 'ba_b' }),
        TN('ba_ch5', 'Idole', '🎪', 5, 'La compagnie : +14 % de dégâts',
           { kind: 'aura', stat: 'dmg', pct: 0.14 }, { choix: 'ba_capstone' }),
      ]},
      { id: 'negociation', name: 'Négociation', icon: '🤝', nodes: [
        TN('ba_ne1', 'Marchandage', '💰', 1, '+8 % de butin', { kind: 'pct', stat: 'loot', pct: 0.08 }),
        TN('ba_ne2', 'Entregent', '🛍️', 2, '+10 % d’expérience gagnée', { kind: 'pct', stat: 'xp', pct: 0.10 }),
        TN('ba_ne3', 'Réseau', '🕸️', 3, '+12 % de butin', { kind: 'pct', stat: 'loot', pct: 0.12 }),
        TN('ba_ne4', 'OVATION', '👏', 4, 'POUVOIR : la compagnie frappe plus vite pendant 6 s',
           { kind: 'power', power: 'ba_ovation' }, { choix: 'ba_b' }),
        TN('ba_ne5', 'Mécène', '👑', 5, '+30 % de butin',
           { kind: 'pct', stat: 'loot', pct: 0.30 }, { choix: 'ba_capstone' }),
      ]},
    ]},

    // ==================== GENERAL ====================
    // ATTENTION AU PLACEMENT (§6.12 du contrat) : l'Étendard, pouvoir précoce,
    // porte l'id `ge_st4` mais siège au TIER 2 de Stratégie ; « Tactique » et
    // « Coordination » descendent donc chacune d'un cran, et l'ancien passif
    // de tier 4 (« Plan de bataille », Cri rayon +40 %) est absorbé par
    // `ge_st5`. Le tableau est ordonné par TIER, pas par numéro d'id.
    general: { branches: [
      { id: 'strategie', name: 'Stratégie', icon: '🗺️', nodes: [
        TN('ge_st1', 'Ordre de charge', '📯', 1, 'Cri du Général : recharge −15 %', { kind: 'ability', cible: 'classe', mod: 'cd', pct: -0.15 }),
        TN('ge_st4', 'ÉTENDARD', '🚩', 2, 'POUVOIR : une bannière plantée — qui reste dessous frappe plus fort',
           { kind: 'power', power: 'ge_etendard' }),
        TN('ge_st2', 'Tactique', '📋', 3, 'La compagnie : +5 % de dégâts', { kind: 'aura', stat: 'dmg', pct: 0.05 }),
        TN('ge_st3', 'Coordination', '🤝', 4, 'Cri du Général : +10 % de soin', { kind: 'ability', cible: 'classe', mod: 'heal', pct: 0.10 }),
        TN('ge_st5', 'Génie militaire', '🏆', 5, 'Cri du Général : rayon +40 %',
           { kind: 'ability', cible: 'classe', mod: 'radius', pct: 0.40 }, { choix: 'general_capstone' }),
      ]},
      { id: 'leadership', name: 'Commandement', icon: '👑', nodes: [
        TN('ge_le1', 'Exemple', '🫡', 1, 'La compagnie : +3 d’armure', { kind: 'aura', stat: 'armor', add: 3 }),
        TN('ge_le2', 'Discours', '🎤', 2, 'Début de salle : +10 % de dégâts pendant 5 s', { kind: 'proc', proc: 'speech', chance: 1.0, dur: 5, pct: 0.10 }),
        TN('ge_le3', 'Loyauté', '🤞', 3, 'La compagnie : +8 % de PV max', { kind: 'aura', stat: 'hp', pct: 0.08 }),
        TN('ge_le4', 'TENEZ LA LIGNE', '🧱', 4, 'POUVOIR : la compagnie encaisse moitié moins pendant 6 s',
           { kind: 'power', power: 'ge_tenez' }, { choix: 'general_b' }),
        TN('ge_le5', 'Légende', '🌟', 5, 'La compagnie : +12 % de dégâts',
           { kind: 'aura', stat: 'dmg', pct: 0.12 }, { choix: 'general_capstone' }),
      ]},
      { id: 'combat_g', name: 'Combat', icon: '🥊', nodes: [
        TN('ge_co1', 'Entraînement', '💪', 1, '+5 dégâts', { kind: 'stat', stat: 'dmg', add: 5 }),
        TN('ge_co2', 'Cuirasse', '🦺', 2, '+8 armure', { kind: 'stat', stat: 'armor', add: 8 }),
        TN('ge_co3', 'Frappe du commandant', '💢', 3, '15 % de chance de frapper ×1,5', { kind: 'proc', proc: 'crit', chance: 0.15, mult: 1.5 }),
        TN('ge_co4', 'FER DE LANCE', '🥋', 4, 'POUVOIR : il ouvre la ligne lui-même, et ce qu’il croise tombe',
           { kind: 'power', power: 'ge_ferdelance' }, { choix: 'general_a' }),
        TN('ge_co5', 'Héros de guerre', '⭐', 5, '+20 % de dégâts',
           { kind: 'pct', stat: 'dmg', pct: 0.20 }, { choix: 'general_capstone' }),
      ]},
      { id: 'butin_g', name: 'Intendance', icon: '💰', nodes: [
        TN('ge_bu1', 'Pillage', '💰', 1, '+8 % de butin', { kind: 'pct', stat: 'loot', pct: 0.08 }),
        TN('ge_bu2', 'Négociateur', '📖', 2, '+10 % d’expérience gagnée', { kind: 'pct', stat: 'xp', pct: 0.10 }),
        TN('ge_bu3', 'Chance', '🍀', 3, '+5 % d’objets rares', { kind: 'pct', stat: 'rare', pct: 0.05 }),
        TN('ge_bu4', 'ORDRE DE MANŒUVRE', '🗺️', 4, 'POUVOIR : toute la compagnie se déplace d’un bloc, et se couvre',
           { kind: 'power', power: 'ge_manoeuvre' }, { choix: 'general_a' }),
        TN('ge_bu5', 'Fortune', '👑', 5, '+20 % de butin',
           { kind: 'pct', stat: 'loot', pct: 0.20 }, { choix: 'general_capstone' }),
      ]},
      { id: 'survie_g', name: 'Survie', icon: '⛺', nodes: [
        TN('ge_su1', 'Endurance', '🏃', 1, '+12 vitesse', { kind: 'stat', stat: 'mspd', add: 12 }),
        TN('ge_su2', 'Rationnement', '🍖', 2, 'Les soins qu’il reçoit sont augmentés de 20 %', { kind: 'pct', stat: 'heal_recv', pct: 0.20 }),
        TN('ge_su3', 'Résistance', '🪨', 3, '10 % d’esquive', { kind: 'proc', proc: 'dodge', chance: 0.10 }),
        TN('ge_su4', 'ROMPEZ !', '⛺', 4, 'POUVOIR : la compagnie souffle — on se soigne et on repart',
           { kind: 'power', power: 'ge_rompez' }, { choix: 'general_b' }),
        TN('ge_su5', 'Indestructible', '🏔️', 5, 'Survit à un coup mortel, une fois par tranche de 75 s',
           { kind: 'proc', proc: 'undying', chance: 1.0, cd: 75 }, { choix: 'general_capstone' }),
      ]},
    ]},
  };

  // ============================================================
  // LES COÛTS — c'est le seul endroit où l'arbre fait RENONCER
  // ============================================================
  //
  // LE DÉFAUT QU'ON CORRIGE. L'arbre comptait 25 nœuds par classe pour assez de
  // points pour tout acheter DEUX FOIS : il n'y avait aucun choix, seulement un
  // ordre d'achat. Un arbre qui ne fait rien renoncer n'est pas un arbre, c'est
  // une liste de courses.
  //
  // Trois verrous, et ils se tiennent :
  //   1. LE COÛT MONTE avec le tier — un nœud de tier N coûte N points.
  //   2. LES GROUPES `choix` ferment : deux paires de pouvoirs (`_a`, `_b`) et
  //      les cinq capstones, dont un seul est achetable.
  //   3. UNE VOIE EXCLUSIVE s'ouvre à 6 points engagés ; elle donne le
  //      cinquième pouvoir.
  // Résultat mesuré (dev/smoke-pouvoirs.js, bloc A7) : le build LÉGAL le plus
  // cher coûte 56 points pour 54 disponibles au niveau 100. Il faut abandonner
  // quelque chose — et la panoplie complète (5 boutons) en coûte 32.
  //
  // ⚠️ ÉCART ASSUMÉ AU CONTRAT : celui-ci figeait `TALENT_COST = [1,1,2,2,3,4]`,
  // ce qui donne un build légal maximal de 48 points pour 54 disponibles —
  // c'est-à-dire tout acheter, l'exact défaut qu'on répare. L'échelle est donc
  // strictement croissante (1-2-3-4-5). `TALENT_COST` n'est lu nulle part
  // ailleurs dans le moteur : le changement est interne à l'équilibrage.
  GameData.TALENT_COST = tier => [1, 1, 2, 3, 4, 5][Math.max(0, Math.min(5, tier | 0))] || 1;
  // UN POUVOIR COÛTE PLUS QU'UN PASSIF : c'est un bouton de plus sur la carte,
  // une recharge de plus à lire, une décision de plus en combat.
  GameData.TALENT_POWER_COST = tier => [3, 3, 3, 4, 5, 6][Math.max(0, Math.min(5, tier | 0))] || 3;
  GameData.TALENT_SPEC_AT = 6;          // points engagés avant d'ouvrir le choix de voie

  // ============================================================
  // LES SPÉCIALISATIONS — le choix qui décide de ce qu'est un héros
  // ============================================================
  // Deux voies par classe, on en prend UNE, l'autre se ferme. C'est elle qui
  // donne son identité au personnage — « mon guerrier est un Berserker », pas
  // « mon guerrier a 25 nœuds ». Son dernier nœud accorde un VRAI POUVOIR,
  // référencé par son id dans `GameData.POWERS` — jamais inliné ici.
  GameData.TALENT_SPECS = {
    guerrier: [
      { id: 'berserker', name: 'Berserker', icon: '🩸',
        txt: 'Plus il est blessé, plus il frappe. On ne le soigne pas, on le lâche.',
        nodes: [
          SN('gu_sb1', 'Rage froide', '🥶', 1, 'Sous 50 % de ses PV : +25 % de dégâts', { kind: 'proc', proc: 'lowhp_dmg', threshold: 0.5, mult: 1.25 }),
          SN('gu_sb2', 'Sang pour sang', '♨️', 2, '15 % des dégâts encaissés sont renvoyés', { kind: 'proc', proc: 'thorns', chance: 1, pct: 0.15 }),
          SN('gu_sb3', 'DÉCHAÎNEMENT', '🌋', 3, 'POUVOIR : 5 s de furie — trois fois plus vif, insensible aux entraves',
             { kind: 'power', power: 'gu_dechainement' }),
        ] },
      { id: 'rempart', name: 'Rempart', icon: '🏰',
        txt: 'Il ne tombe pas, et ce qui le frappe frappe moins fort ensuite.',
        nodes: [
          SN('gu_sr1', 'Ancrage', '⚓', 1, '+20 % d’armure', { kind: 'pct', stat: 'armor', pct: 0.20 }),
          SN('gu_sr2', 'Usure', '🪨', 2, 'Chaque coup encaissé retire 2 dégâts à l’attaquant pendant 5 s', { kind: 'proc', proc: 'wear', chance: 1, dur: 5, dmg: 2 }),
          SN('gu_sr3', 'MUR DE BOUCLIERS', '🛡️', 3, 'POUVOIR : la compagnie encaisse 60 % de moins pendant 6 s',
             { kind: 'power', power: 'gu_mur' }),
        ] },
    ],
    garde: [
      { id: 'sentinelle', name: 'Sentinelle', icon: '👁️',
        txt: 'Il tient la ligne et punit qui la franchit.',
        nodes: [
          SN('ga_ss1', 'Vigilance', '👁️', 1, 'Provocation : rayon +15 %', { kind: 'ability', cible: 'classe', mod: 'radius', pct: 0.15 }),
          SN('ga_ss2', 'Contre-charge', '💨', 2, '12 % de repousser ce qu’il touche', { kind: 'proc', proc: 'push', chance: 0.12, force: 40 }),
          SN('ga_ss3', 'HALTE-LÀ', '🚧', 3, 'POUVOIR : cloue sur place tout ce qui approche, 3 s',
             { kind: 'power', power: 'ga_halte' }),
        ] },
      { id: 'gardien', name: 'Gardien', icon: '💚',
        txt: 'Il se met devant. Toujours.',
        nodes: [
          SN('ga_sg1', 'Cohésion', '🤝', 1, 'La compagnie : +10 % d’armure', { kind: 'aura', stat: 'armor', pct: 0.10 }),
          SN('ga_sg2', 'Abri', '🧱', 2, 'La compagnie : +10 % de PV max', { kind: 'aura', stat: 'hp', pct: 0.10 }),
          SN('ga_sg3', 'SERMENT', '🫡', 3, 'POUVOIR : la compagnie devient invulnérable 3 s',
             { kind: 'power', power: 'ga_serment' }),
        ] },
    ],
    tireur: [
      { id: 'sniper', name: 'Tireur d’élite', icon: '🎯',
        txt: 'Un tir, une cible. De très loin.',
        nodes: [
          SN('ti_ss1', 'Souffle retenu', '🌬️', 1, '+60 de portée', { kind: 'stat', stat: 'range', add: 60 }),
          SN('ti_ss2', 'Coup d’œil', '🕶️', 2, '+80 % de dégâts sur un coup critique', { kind: 'proc', proc: 'critmult', chance: 1, mult: 0.8 }),
          SN('ti_ss3', 'TRANSPERCEMENT', '🗡️', 3, 'POUVOIR : un trait qui traverse toute la salle',
             { kind: 'power', power: 'ti_transperce' }),
        ] },
      { id: 'volee', name: 'Volée', icon: '🌧️',
        txt: 'Pas un tir : une averse.',
        nodes: [
          SN('ti_sv1', 'Carquois profond', '🎒', 1, '+20 % de vitesse d’attaque', { kind: 'pct', stat: 'aspd', pct: 0.20 }),
          SN('ti_sv2', 'Volée courte', '🪽', 2, 'Tir perçant part en trois traits', { kind: 'ability', cible: 'classe', mod: 'spread', pct: 3 }),
          SN('ti_sv3', 'VOLÉE DE FLÈCHES', '🌧️', 3, 'POUVOIR : une zone pilonnée pendant 4 s',
             { kind: 'power', power: 'ti_volee' }),
        ] },
    ],
    mage: [
      { id: 'pyro', name: 'Pyromancien', icon: '🔥',
        txt: 'Tout brûle, et ça continue de brûler.',
        nodes: [
          SN('ma_sp1', 'Braises', '🔥', 1, 'Chaque coup enflamme la cible 3 s', { kind: 'proc', proc: 'burn', chance: 1, dur: 3, dps: 0.2 }),
          SN('ma_sp2', 'Combustion', '💢', 2, '+30 % de dégâts sur une cible en feu', { kind: 'proc', proc: 'vs_burn', mult: 1.3 }),
          SN('ma_sp3', 'MÉTÉORE', '☄️', 3, 'POUVOIR : une masse tombe du plafond',
             { kind: 'power', power: 'ma_meteore' }),
        ] },
      { id: 'givre', name: 'Givromancien', icon: '❄️',
        txt: 'Rien ne bouge plus. C’est déjà une victoire.',
        nodes: [
          SN('ma_sg1', 'Morsure', '🥶', 1, 'Chaque coup ralentit la cible de 25 % pendant 3 s', { kind: 'proc', proc: 'slow', chance: 1, dur: 3, pct: 0.25 }),
          SN('ma_sg2', 'Fragile', '🧊', 2, '+25 % de dégâts sur une cible ralentie', { kind: 'proc', proc: 'vs_slow', mult: 1.25 }),
          SN('ma_sg3', 'BLIZZARD', '❄️', 3, 'POUVOIR : la salle gèle — tout est ralenti pendant 5 s',
             { kind: 'power', power: 'ma_blizzard' }),
        ] },
    ],
    artificier: [
      { id: 'demolisseur', name: 'Démolisseur', icon: '💣',
        txt: 'Plus gros. Toujours plus gros.',
        nodes: [
          SN('ar_sd1', 'Cône de choc', '📐', 1, 'Bombe : rayon +30 %', { kind: 'ability', cible: 'classe', mod: 'radius', pct: 0.30 }),
          SN('ar_sd2', 'Double mèche', '🕯️', 2, '20 % de tirer deux fois', { kind: 'proc', proc: 'double', chance: 0.20 }),
          SN('ar_sd3', 'BARIL', '🛢️', 3, 'POUVOIR : un baril roule et explose au contact',
             { kind: 'power', power: 'ar_baril' }),
        ] },
      { id: 'ingenieur', name: 'Ingénieur', icon: '🔧',
        txt: 'Il ne se bat pas : il installe des choses qui se battent.',
        nodes: [
          SN('ar_si1', 'Chausse-trappes', '🪤', 1, '30 % de ralentir la cible 3 s', { kind: 'proc', proc: 'slow', chance: 0.30, dur: 3, pct: 0.3 }),
          SN('ar_si2', 'Réglages', '🔧', 2, 'Tous ses pouvoirs : recharge −20 %', { kind: 'ability', cible: '*', mod: 'cd', pct: -0.20 }),
          SN('ar_si3', 'TOURELLE', '🔫', 3, 'POUVOIR : une tourelle posée arrose la zone pendant 10 s',
             { kind: 'power', power: 'ar_tourelle' }),
        ] },
    ],
    eclaireur: [
      { id: 'assassin', name: 'Assassin', icon: '🗡️',
        txt: 'Il vise ce qui est derrière, pas ce qui est devant.',
        nodes: [
          SN('ec_sa1', 'Dans le dos', '🌑', 1, '+35 % de dégâts sur une cible occupée ailleurs', { kind: 'proc', proc: 'backstab', mult: 1.35 }),
          SN('ec_sa2', 'Poison', '🧪', 2, 'Chaque coup empoisonne la cible 4 s', { kind: 'proc', proc: 'poison', chance: 1, dur: 4, dps: 0.15 }),
          SN('ec_sa3', 'EXÉCUTION', '☠️', 3, 'POUVOIR : il bondit sur le plus faible et le termine',
             { kind: 'power', power: 'ec_execution' }),
        ] },
      { id: 'batteur', name: 'Batteur d’estrade', icon: '👣',
        txt: 'Il court partout, et tout le monde le suit.',
        nodes: [
          SN('ec_sb1', 'Foulée', '🏃', 1, 'La compagnie : +15 % de vitesse', { kind: 'aura', stat: 'mspd', pct: 0.15 }),
          SN('ec_sb2', 'Fouille', '🔭', 2, '+10 % de butin', { kind: 'pct', stat: 'loot', pct: 0.10 }),
          SN('ec_sb3', 'EMBUSCADE', '🎯', 3, 'POUVOIR : la compagnie frappe deux fois plus fort pendant 4 s',
             { kind: 'power', power: 'ec_embuscade' }),
        ] },
    ],
    soigneur: [
      // ⚠️ ids `so_sap*` et non `so_sa*` : la branche « Sagesse » utilise déjà
      // so_sa1…so_sa5. Deux nœuds au même id, et `talentAnyNode` en rend un au
      // hasard — l'autre est payé et jamais joué.
      { id: 'apothicaire', name: 'Apothicaire', icon: '🧴',
        txt: 'Il soigne peu, mais tout le temps.',
        nodes: [
          SN('so_sap1', 'Onguent', '🫙', 1, 'La compagnie régénère 1,2 % de ses PV par seconde', { kind: 'aura', stat: 'regen', pct: 0.012 }),
          SN('so_sap2', 'Remèdes', '🌿', 2, 'La compagnie : +10 % de PV max', { kind: 'aura', stat: 'hp', pct: 0.10 }),
          SN('so_sap3', 'SOURCE', '⛲', 3, 'POUVOIR : une fontaine soigne la zone pendant 8 s',
             { kind: 'power', power: 'so_source' }),
        ] },
      { id: 'exorciste', name: 'Exorciste', icon: '✨',
        txt: 'Soigner, c’est bien. Ressusciter, c’est mieux.',
        nodes: [
          SN('so_se1', 'Lumière', '✨', 1, '+20 % de dégâts', { kind: 'pct', stat: 'dmg', pct: 0.20 }),
          SN('so_se2', 'Sursis', '⏳', 2, 'La compagnie : +8 d’armure', { kind: 'aura', stat: 'armor', add: 8 }),
          SN('so_se3', 'RELÈVE', '🕊️', 3, 'POUVOIR : remet un allié tombé sur pied',
             { kind: 'power', power: 'so_releve' }),
        ] },
    ],
    barde: [
      { id: 'tambour', name: 'Tambour', icon: '🥁',
        txt: 'Il donne le rythme, et la compagnie frappe dessus.',
        nodes: [
          SN('ba_st1', 'Cadence', '🎶', 1, 'La compagnie : +10 % de vitesse d’attaque', { kind: 'aura', stat: 'aspd', pct: 0.10 }),
          SN('ba_st2', 'Tenue', '🎺', 2, 'Tous ses pouvoirs durent 40 % plus longtemps', { kind: 'ability', cible: '*', mod: 'dur', pct: 0.40 }),
          SN('ba_st3', 'CHARGE', '📯', 3, 'POUVOIR : la compagnie fonce et frappe en courant, 5 s',
             { kind: 'power', power: 'ba_charge' }),
        ] },
      { id: 'complainte', name: 'Complainte', icon: '🎻',
        txt: 'Il ne renforce pas les siens : il affaiblit les autres.',
        nodes: [
          SN('ba_sc1', 'Complainte', '🎻', 1, 'Les ennemis frappent 10 % moins fort', { kind: 'aura', stat: 'enemyDmg', pct: -0.10 }),
          SN('ba_sc2', 'Torpeur', '💤', 2, '25 % d’engourdir la cible 3 s', { kind: 'proc', proc: 'slow', chance: 0.25, dur: 3, pct: 0.35 }),
          SN('ba_sc3', 'REQUIEM', '💀', 3, 'POUVOIR : les ennemis de la salle perdent la moitié de leur armure',
             { kind: 'power', power: 'ba_requiem' }),
        ] },
    ],
    // LE GÉNÉRAL A UNE VOIE COMME TOUT LE MONDE — c'est la clé qui manquait :
    // sans elle, `talentSpecs('general')` rendait vide et son onglet était un
    // bouton mort.
    general: [
      { id: 'marechal', name: 'Maréchal', icon: '📋',
        txt: 'Il ne lève jamais son arme. Il n’en a pas besoin.',
        nodes: [
          SN('ge_sm1', 'Ordres brefs', '⏱️', 1, 'La compagnie : recharges −10 %',
             { kind: 'ability', cible: '*', mod: 'cd', pct: -0.10 }),
          SN('ge_sm2', 'Relais', '🔔', 2, 'La compagnie : +8 % de dégâts',
             { kind: 'aura', stat: 'dmg', pct: 0.08 }),
          SN('ge_sm3', 'ORDRE GÉNÉRAL', '🎌', 3, 'POUVOIR : toutes les jauges de la compagnie se remplissent de moitié',
             { kind: 'power', power: 'ge_ordregeneral' }),
        ] },
      { id: 'champion', name: 'Champion', icon: '🥇',
        txt: 'Le premier dans la salle, le dernier à en sortir.',
        nodes: [
          SN('ge_sc1', 'Garde haute', '🗡️', 1, '+20 % de dégâts',
             { kind: 'pct', stat: 'dmg', pct: 0.20 }),
          SN('ge_sc2', 'Exemple', '🦺', 2, '+20 % de PV max',
             { kind: 'pct', stat: 'hp', pct: 0.20 }),
          SN('ge_sc3', 'DÉFI', '🤺', 3, 'POUVOIR : plus personne ne regarde ailleurs, 6 s',
             { kind: 'power', power: 'ge_defi' }),
        ] },
    ],
  };

  // ---------- HELPERS ----------
  GameData.talentTree = cls => GameData.TALENT_TREES[cls] || null;
  GameData.talentNode = function (cls, nodeId) {
    const tree = GameData.TALENT_TREES[cls];
    if (!tree) return null;
    for (const br of tree.branches)
      for (const n of br.nodes)
        if (n.id === nodeId) return n;
    return null;
  };
  // LES SPÉCIALISATIONS, côté lecture.
  GameData.talentSpecs = cls => GameData.TALENT_SPECS[cls] || [];
  // un nœud, qu'il vienne d'une branche ordinaire OU d'une voie de spécialisation
  GameData.talentAnyNode = function (cls, nodeId) {
    const n = GameData.talentNode(cls, nodeId);
    if (n) return n;
    for (const sp of GameData.talentSpecs(cls)) {
      for (const x of sp.nodes) if (x.id === nodeId) return x;
    }
    return null;
  };
  // à quelle VOIE appartient ce nœud (null si branche ordinaire)
  GameData.talentSpecOf = function (cls, nodeId) {
    for (const sp of GameData.talentSpecs(cls)) {
      for (const x of sp.nodes) if (x.id === nodeId) return sp;
    }
    return null;
  };
  // TOUS LES MEMBRES D'UN GROUPE `choix` — l'exclusion est un GROUPE, pas une
  // paire : `talentRefus`, `talentBloqueur` et `basculeTalent` s'appuient tous
  // les trois là-dessus, et le passage à N > 2 (les 5 capstones) est gratuit.
  GameData.talentGroupe = function (cls, groupe) {
    const out = [];
    if (!groupe) return out;
    const tree = GameData.TALENT_TREES[cls];
    if (tree) for (const br of tree.branches)
      for (const n of br.nodes) if (n.choix === groupe) out.push(n);
    for (const sp of GameData.talentSpecs(cls))
      for (const n of sp.nodes) if (n.choix === groupe) out.push(n);
    return out;
  };
  // LE COÛT D'UN NŒUD. Trois tarifs, dans cet ordre :
  //   un POUVOIR paie le tarif pouvoir (un bouton de plus) ;
  //   un passif de VOIE paie un tier de plus (c'est l'engagement principal) ;
  //   tout le reste paie son tier.
  GameData.talentCostOf = function (cls, nodeId) {
    const n = GameData.talentAnyNode(cls, nodeId);
    if (!n) return 0;
    if (n.effect && n.effect.kind === 'power') return GameData.TALENT_POWER_COST(n.tier);
    return n.spec ? GameData.TALENT_COST(n.tier + 1) : GameData.TALENT_COST(n.tier);
  };

  // ============================================================
  // LA COURBE DE PROGRESSION
  // ============================================================
  // Mesuré sur l'ancienne courbe : le 4ᵉ pouvoir demandait ~500 descentes
  // complètes, le 5ᵉ ~990. Personne ne les aurait vus. Le barème donne
  // désormais un point par niveau jusqu'au niveau 10, puis un tous les deux.
  GameData.talentPointsForLevel = function (lvl) {
    const L = Math.max(1, lvl | 0);
    return Math.min(9, L - 1) + (L > 10 ? Math.floor((L - 10) / 2) : 0);
  };   // niv 10 = 9 · niv 20 = 14 · niv 50 = 29 · niv 100 = 54
  // LE GÉNÉRAL monte plus vite (il touche 100 % de l'XP de la descente) et
  // dispose d'un point de plus.
  GameData.generalTalentPoints = function (lvl) {
    const L = Math.max(1, lvl | 0);
    return Math.min(10, L - 1) + (L > 11 ? Math.floor((L - 10) / 2) : 0);
  };   // niv 11 = 10 · niv 20 = 15 · niv 100 = 55

