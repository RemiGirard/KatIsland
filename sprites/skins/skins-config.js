/* ============================================================
   GRIFFES & PLUMES — skins/skins-config.js
   Choix de skins validés au terrain-lab (lab/terrain_ronron.lab.json).
   - Bâtiments : UNE variante choisie par slot kind_camp ; slot absent
     ou vide = sprite historique du jeu (fallback).
   - Éléments naturels (tree/rock/water) : PAS de variante figée — la
     carte de combat tire une variante par élément à la génération
     (LabSkins.pickElem, déterministe par seed).
   Dépend des bibliothèques skins/buildings/* et skins/elements/*
   (window.LAB_BUILDINGS / window.LAB_ELEMENTS), chargées avant.
   ============================================================ */
"use strict";
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
window.LAB_ELEMENTS = window.LAB_ELEMENTS || { variants: {}, chosen: {} };

// variantes bâtiments retenues (export terrain_ronron.lab.json § variantes)
window.LAB_BUILDINGS.chosen = {
  hq_cats: 'chateau-carton-deluxe',
  hq_birds: 'grand-chene-royal-2',
  production_cats: 'c4-pension',
  production_birds: 'grange-voliere',
  production_neutre: 'halle-recrues',
  defense_cats: 't4-mirador',
  defense_birds: 'tour-guetteurs',
  // defense_neutre : pas de variante choisie -> tour grise historique
  banner_cats: 'forge-de-camp',
  banner_birds: 'camp-entrainement',
  banner_neutre: 'atelier-armurier',
  avantposte_cats: 'mirador',
  avantposte_birds: 'mirador',
  avantposte_neutre: 'poste-ecoute',
  reinforce_cats: 'carillon',
  reinforce_birds: 'carillon',
  reinforce_neutre: 'carillon',
  controle_cats: 'pc4-base-v2',
  controle_birds: 'pc4-base-v2',
  controle_neutre: 'pc4-base-v2',
};

// pools d'éléments naturels RETENUS (liste validée par Yogael) — seules ces
// variantes sont tirées à la génération de carte ; les autres restent
// disponibles dans les bibliothèques mais ne sortent jamais en jeu.
window.LAB_ELEMENTS.pool = {
  water: [
    'mare-roseaux',        // Mare aux roseaux
    'etang-poisson',       // Étang au poisson
    'mare-boueuse',        // Mare boueuse
    'mare-brumeuse',       // Mare brumeuse
    'cascade-mini',        // Cascade miniature
    'mare-lucioles',       // Mare aux lucioles
  ],
  rock: [
    'dalle-empilee',       // Dalles empilées
    'rocher-mousse',       // Rocher moussu
    'menhir',              // Menhir penché
    'rocher-cristaux',     // Rocher à cristaux
    'roc-duo',             // Duo adossé
    'r3-base-v2',          // Rocher v2
    'r3-erratique-quartz', // Erratique à quartz
    'r3-siege-poli',       // Rocher-siège poli
  ],
  tree: [
    'chene-touffu',        // Chêne touffu
    'pin-boule',           // Pin boule
    'arbre-fleurs',        // Arbre en fleurs
    'arbre-mort',          // Arbre mort
    'feuillu-noble',       // Feuillu noble
    'pommier',             // Pommier
    'bosquet',             // Bosquet
    'a3-pin-parasol',      // Pin parasol
  ],
};

window.LabSkins = (function () {
  function slotOwner(owner) {
    return owner === 'cats' ? 'cats' : (owner === 'birds' ? 'birds' : 'neutre');
  }

  // variante bâtiment choisie pour (kind, owner) — null si aucune
  function building(kind, owner) {
    const B = window.LAB_BUILDINGS;
    if (!B || !B.chosen) return null;
    const slot = kind + '_' + slotOwner(owner);
    const id = B.chosen[slot];
    if (!id) return null;
    const list = (B.variants && B.variants[slot]) || [];
    for (const v of list) if (v.id === id) return v;
    return null;
  }

  // variantes RETENUES d'un élément naturel ('tree' | 'rock' | 'water') :
  // les variantes enregistrées, filtrées par le pool validé (ordre du pool)
  const poolCache = {};
  function elemVariants(kind) {
    if (poolCache[kind]) return poolCache[kind];
    const E = window.LAB_ELEMENTS;
    const all = (E && E.variants && E.variants[kind]) || [];
    const ids = (E && E.pool && E.pool[kind]) || null;
    let list = all;
    if (ids) {
      list = [];
      for (const id of ids) {
        const v = all.find(x => x.id === id);
        if (v) list.push(v);
      }
    }
    if (list.length) poolCache[kind] = list; // ne fige pas une liste encore vide
    return list;
  }

  // tirage déterministe d'une variante par seed (hash mulberry : des seeds
  // voisins donnent des variantes décorrélées, la carte reste reproductible)
  function pickElem(kind, seed) {
    const list = elemVariants(kind);
    if (!list.length) return null;
    let a = (seed | 0) || 1;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return list[Math.floor(u * list.length) % list.length];
  }

  return { building, elemVariants, pickElem };
})();
