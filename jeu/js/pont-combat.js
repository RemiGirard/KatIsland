/* ============================================================
   LE BOURG — js/pont-combat.js
   LE PONT entre l'économie du bourg et les deux moteurs conservés.

   `state-general.js` (la descente) et `battle-core.js` (les batailles)
   ne demandent presque rien : l'objet de sauvegarde, trois fonctions
   d'effets, et une poignée de crochets d'économie. Ce fichier les
   fournit — et surtout, il TRADUIT : le donjon parle un vieux
   vocabulaire de ressources (`food`, `mat1`, `lingot_bronze`…) qui
   n'est pas celui du bourg. Chaque butin remonté est converti en
   quelque chose que la grange sait ranger.

   Portée partagée, sans IIFE : les moteurs lisent les identifiants nus
   `GameState` et `GD`.
   ============================================================ */
"use strict";

const GD = window.GameData;

/* ---------------------------------------------------------------
   FX — décoratif, et volontairement discret. Les moteurs dessinent
   déjà leurs propres particules ; ces trois fonctions ne servent qu'à
   ne pas les faire tomber.
   --------------------------------------------------------------- */
window.FX = {
  burst: function () { },
  ring: function () { },
  sfx: function () { },
};

/* ---------------------------------------------------------------
   LA TRADUCTION. À gauche le vocabulaire du donjon tel qu'il est écrit
   dans `data-general.js` ; à droite ce que ça devient une fois monté
   au bourg. Ce qui n'est pas listé retombe sur les reliquats : on ne
   jette jamais un butin, on le range quelque part.
   --------------------------------------------------------------- */
const TRAD_RES = {
  food: 'poisson', food_t2: 'pain', food_t3: 'tourte',
  mat1: 'bois', mat2: 'pierre', mat3: 'planche',
  fer: 'fer', cuivre: 'cuivre', charbon: 'charbon', argent: 'argentmin', or: 'ormin',
  bronze: 'etain', cobalt: 'argentmin', astral: 'obsidienne',
  lingot_fer: 'lingotfer', lingot_cuivre: 'lingotcuivre', lingot_bronze: 'bronze',
  vieilacier: 'acier', pollenor: 'lingotor', orroyal: 'lingotor',
  obsidienne: 'obsidienne', ambre: 'gemme', nacre: 'gemme', selgemme: 'gemme',
  essence: 'essence', brume: 'essence', zephyr: 'essence', catalyseur: 'obsidienne',
  etai: 'planche', granit: 'pierretaille', salpetre: 'charbonbois',
  therma: 'huile', huile: 'huile', ferblanc: 'lingotfer',
  chanvre: 'corde', colle: 'cuir', soiefine: 'drap', fabric: 'drap',
  parts: 'clou', medals: 'medaille',
};
function versBourg(id) { return TRAD_RES[id] || (window.RES[id] ? id : 'ossuaire'); }

/* ---------------------------------------------------------------
   LE RAVITAILLEMENT DE LA DESCENTE. Le barème d'origine se comptait en
   milliers d'unités d'une ressource « food » abstraite ; le bourg, lui,
   compte des poissons fumés et des tourtes, et sa grange a un plafond.
   On réécrit donc le coût dans la monnaie du jeu — et l'on en profite
   pour en faire une PORTE : sans fumoir, pas de descente profonde.
   --------------------------------------------------------------- */
GD.descentCost = function (checkpoint, party) {
  const n = Math.max(1, (party | 0) || 1);
  const t = 1 + Math.floor((Math.max(1, checkpoint) - 1) / 10);
  const c = { poissonfume: Math.ceil(3 * Math.pow(1.75, t - 1) * n) };
  if (t >= 2) c.potion = Math.ceil(1 * Math.pow(1.5, t - 2) * n);
  if (t >= 3) c.tourte = Math.ceil(2 * Math.pow(1.55, t - 3) * n);
  if (t >= 5) c.huile = Math.ceil(2 * Math.pow(1.4, t - 5) * n);
  return c;
};

/* ---------------------------------------------------------------
   PAS D'ÉMOJI. Le bourg dessine toutes ses icônes ; les tables héritées
   du donjon, elles, en portent des centaines dans leurs libellés. On
   les retire d'un seul passage sur `GameData` — on ne touche à AUCUNE
   logique, seulement à des chaînes d'affichage. Les identifiants, les
   couleurs et les nombres passent au travers sans être vus.
   --------------------------------------------------------------- */
(function () {
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;
  const vu = new Set();
  function nettoyer(o, prof) {
    if (!o || prof > 6 || typeof o !== 'object' || vu.has(o)) return;
    vu.add(o);
    for (const k in o) {
      const v = o[k];
      if (typeof v === 'string') {
        if (v.charCodeAt(0) === 35) continue;                 // couleur '#…'
        if (!EMOJI.test(v)) { EMOJI.lastIndex = 0; continue; }
        EMOJI.lastIndex = 0;
        o[k] = v.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
      } else if (v && typeof v === 'object') nettoyer(v, prof + 1);
    }
  }
  try { nettoyer(GD, 0); } catch (e) { console.warn('nettoyage des libellés :', e.message); }
})();

const GameState = {};

/* L'objet de sauvegarde du donjon vit DANS la sauvegarde du bourg :
   une seule partie, un seul fichier. */
Object.defineProperty(GameState, 'state', {
  get: function () {
    const E = window.Etat.E;
    if (!E.combat || typeof E.combat !== 'object')
      E.combat = { faction: 'cats', res: {}, general: {} };
    if (!E.combat.res) E.combat.res = {};
    return E.combat;
  },
});

/* ---------------------------------------------------------------
   LES SIX CROCHETS D'ÉCONOMIE
   --------------------------------------------------------------- */
GameState.notify = function () {
  if (window.App && window.App.rafraichirUI) {
    // on ne redessine pas l'écran soixante fois par salle : le dock a
    // déjà son propre rythme. Ici on marque seulement que ça a bougé.
    GameState.__sale = true;
  }
};
GameState.save = function () { if (window.Etat) window.Etat.sauver(); };

/* Dépenser un coût exprimé dans le vocabulaire du donjon. */
GameState.spend = function (cout) {
  if (!cout) return true;
  const trad = {};
  for (const k in cout) {
    const id = versBourg(k);
    trad[id] = (trad[id] || 0) + cout[k];
  }
  if (!window.Etat.assez(trad)) return false;
  window.Etat.depenser(trad);
  return true;
};
GameState.spendMixed = function (cout) { return GameState.spend(cout); };
GameState.canAfford = function (cout) {
  if (!cout) return true;
  const trad = {};
  for (const k in cout) { const id = versBourg(k); trad[id] = (trad[id] || 0) + cout[k]; }
  return window.Etat.assez(trad);
};

/* Deux bonus que le jeu d'origine tirait de bâtiments que le bourg n'a
   pas sous ce nom. On les rebranche sur ce qui existe ici : la chapelle
   et le four banal. */
GameState.qgBonus = function (quoi) {
  if (quoi === 'aventure_butin') {
    const n = window.Etat.nivDeType('chateau');
    return n ? 0.05 * n : 0;
  }
  return 0;
};
GameState.kitchenBuff = function () {
  const n = window.Etat.nivDeType('cuisine');
  return n ? 0.03 * n : 0;
};
GameState.reset = function () { window.Etat.E.combat = { faction: 'cats', res: {}, general: {} }; };

/* ---------------------------------------------------------------
   LA REMONTÉE DU BUTIN. `claimReport` du moteur verse le butin dans
   `state.res`, dans son vocabulaire. On vide ce bac à chaque passage
   et l'on range tout dans les réserves du bourg — en le disant.
   --------------------------------------------------------------- */
GameState.viderSacoche = function () {
  const s = GameState.state;
  const recu = {};
  for (const k in s.res) {
    const n = Math.floor(s.res[k]);
    if (n <= 0) continue;
    const id = versBourg(k);
    const pris = window.Etat.gagner(id, n);
    if (pris > 0) recu[id] = (recu[id] || 0) + pris;
  }
  s.res = {};
  return recu;
};
GameState.TRAD_RES = TRAD_RES;
GameState.versBourg = versBourg;

window.GameState = GameState;
