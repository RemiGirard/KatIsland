/* ============================================================
   LE BOURG — donnees/gd-core.js   (1/n — DOIT être chargé en premier)

   Ce fichier remplace le `data-core.js` absent du dossier livré. Il ne
   décrit PAS l'économie du jeu — celle-ci vit dans `ressources.js` et
   `batiments.js`. Il ne contient QUE ce que les moteurs conservés vont
   chercher hors d'eux-mêmes : la table des deux camps, trois utilitaires
   de couleur, quelques constantes d'équilibrage, et les tables minérales
   que `data-forge.js` interroge.

   Portée PARTAGÉE, sans IIFE : `data-units.js`, `data-forge.js` et
   `data-general.js` lisent l'identifiant nu `GameData`.
   ============================================================ */
"use strict";

/* ---------------- utilitaires de couleur (source : CONTRAT.md) ---------------- */
function hex2rgb(h) {
  h = String(h).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function gdMix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function gdShade(c, t) { return t >= 0 ? gdMix(c, '#ffffff', t) : gdMix(c, '#000000', -t); }

const GameData = {};

GameData.mix = gdMix;
GameData.shade = gdShade;
GameData.other = f => (f === 'cats' ? 'birds' : 'cats');

/* ---------------- les deux camps ----------------
   Le bourg est un bourg de chats. Ce qui monte des profondeurs et ce qui
   fond sur les terrasses porte des plumes : c'est la même vieille
   querelle, vue depuis la charpente. */
GameData.FACTIONS = {
  cats: {
    name: 'Le Bourg', acc: '#d0a851',
    devise: 'On retombe toujours sur ses pattes.',
    chef: "Le maître d'œuvre",
  },
  birds: {
    name: 'La Nuée', acc: '#5f9ad0',
    devise: 'Ce qui vole ne demande pas la permission.',
    chef: 'Le Grand Bec',
  },
};

GameData.ALLY_NAMES = {
  cats: ['Moustache', 'Grisou', 'Pistache', 'Nougat', 'Salsifis', 'Bouchon', 'Câpre',
         'Réglisse', 'Pruneau', 'Girofle', 'Praline', 'Sarrasin', 'Muscade', 'Silex',
         'Bruyère', 'Genièvre', 'Verjus', 'Poivre', 'Amande', 'Cresson'],
  birds: ['Bec-Court', 'Serre-Grise', 'Plume-Noire', 'Aile-Basse', 'Cri-Rauque',
          'Duvet', 'Rémige', 'Fauve', 'Bréchet', 'Jabot', 'Huppe', 'Émouchet',
          'Gerfaut', 'Busard', 'Milan', 'Faucheur', 'Roitelet', 'Chevêche'],
};

/* ---------------- constantes lues par les moteurs ---------------- */
GameData.BALANCE = {
  agentCap: 400,                 // plafond d'unités simultanées en bataille
  aoeMaxTargets: 14,
  combatScale: 1,
  controlWinPoints: 3,
  controlWinPointsByStage: s => Math.min(6, 3 + Math.floor((s || 0) / 6)),
  citySimCapSec: 3600,
  depositBatch: 5,
  pixelArt: 1.6,                 // grain des sprites cuits
  towerRange: 170,
};

/* ---------------- bosses de carte d'expédition ----------------
   Volontairement vide au départ : les colonnes de la Nuée n'ont pas de
   champion tant que le bourg n'a pas pris de territoire. `battle-core`
   et `battle-mapgen` traitent une liste vide sans broncher. */
GameData.MAP_BOSSES = [];

/* La garnison ennemie grossit avec l'étape d'expédition. */
GameData.stageGarrisonMult = s => 1 + 0.16 * Math.max(0, (s || 1) - 1);

/* ---------------- sorts de bataille ----------------
   Le Scriptorium copie des grimoires ; un grimoire lance l'un de ces
   sorts. `battle-core` lit `spellStats(id, niveau)`. */
GameData.SPELLS = [
  { id: 'meteore', name: 'Météore', desc: "Une pierre du ciel, là où l'on désigne.",
    battle: { kind: 'meteore', base: { dmg: 60, radius: 62 }, perLvl: { dmg: 34, radius: 6 } } },
  { id: 'gel', name: 'Gel', desc: 'Le sol se prend en glace ; ce qui marche dessus ralentit.',
    battle: { kind: 'gel', base: { slow: 0.45, dur: 5, radius: 70 }, perLvl: { slow: 0.05, dur: 1.2, radius: 5 } } },
  { id: 'chaine', name: 'Chaîne', desc: "Un éclair qui rebondit d'un ennemi à l'autre.",
    battle: { kind: 'chaine', base: { dmg: 34, count: 4 }, perLvl: { dmg: 18, count: 1 } } },
  { id: 'benediction', name: 'Bénédiction', desc: 'La troupe frappe plus fort un moment.',
    battle: { kind: 'benediction', base: { pct: 0.25, dur: 8 }, perLvl: { pct: 0.06, dur: 1.5 } } },
  { id: 'mur', name: "Mur d'épines", desc: 'Un obstacle vivant, posé en travers.',
    battle: { kind: 'mur', base: { dur: 10, dmg: 12 }, perLvl: { dur: 2, dmg: 7 } } },
  { id: 'seisme', name: 'Séisme', desc: 'Le sol tremble et casse ce qui tient debout.',
    battle: { kind: 'seisme', base: { dmg: 40, radius: 110 }, perLvl: { dmg: 22, radius: 9 } } },
];
GameData.spellStats = function (id, lvl) {
  const sp = GameData.SPELLS.find(s => s.id === id);
  if (!sp) return null;
  lvl = Math.max(1, lvl | 0);
  const out = { kind: sp.battle.kind };
  for (const k in sp.battle.base)
    out[k] = sp.battle.base[k] + (sp.battle.perLvl[k] || 0) * (lvl - 1);
  return out;
};

/* ---------------- potions de bataille ----------------
   Fabriquées au laboratoire, emportées par la colonne. */
GameData.POTIONS = [
  { id: 'soin', name: 'Fiole de soin', pts: 1, cost: { potion: 1 },
    battle: { kind: 'heal', pct: 0.30, radius: 90 } },
  { id: 'glu', name: 'Fiole de glu', pts: 1, cost: { potion: 1 },
    battle: { kind: 'slow', slow: 0.5, dur: 8, radius: 80 } },
  { id: 'totem', name: 'Totem de garde', pts: 2, cost: { potion: 2, bois: 4 },
    battle: { kind: 'totem', hps: 9, dur: 14, radius: 100 } },
];

/* ---------------- minéraux ----------------
   `data-forge.js` interroge cette table pour savoir ce qui se trouve à
   quelle profondeur et ce que rend une coulée. Les identifiants sont
   ceux de l'économie du bourg : la Mine du jeu et la Mine du moteur
   parlent de la même roche. */
GameData.MINERALS = [
  { id: 'fer',       name: 'Fer',      depth: 0,  ingot: 'lingotfer',    yield: 3, prev: null,       col: '#8a7a6a' },
  { id: 'charbon',   name: 'Charbon',  depth: 2,  ingot: 'charbonbois',  yield: 3, prev: 'fer',      col: '#1e1e22' },
  { id: 'cuivre',    name: 'Cuivre',   depth: 4,  ingot: 'lingotcuivre', yield: 3, prev: 'fer',      col: '#a86a3f' },
  { id: 'etain',     name: 'Étain',    depth: 7,  ingot: 'bronze',       yield: 2, prev: 'cuivre',   col: '#9aa2ab' },
  { id: 'argentmin', name: 'Argent',   depth: 11, ingot: 'lingotargent', yield: 2, prev: 'etain',    col: '#b6bec6' },
  { id: 'ormin',     name: 'Or',       depth: 16, ingot: 'lingotor',     yield: 2, prev: 'argentmin',col: '#c9a24a' },
  { id: 'obsidienne',name: 'Obsidienne',depth:22, ingot: 'obsidienne',   yield: 1, prev: 'ormin',    col: '#3a2f48' },
  { id: 'mithril',   name: 'Mithril',  depth: 30, ingot: 'mithril',      yield: 1, prev: 'obsidienne',col:'#a8d8e0' },
];
GameData.mineralOf = id => GameData.MINERALS.find(m => m.id === id) || GameData.MINERALS[0];
GameData.BLD_ABS_MAX = { mine: 10, fonderie: 10, forge: 10 };

window.GameData = GameData;
