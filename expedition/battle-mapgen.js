/* ============================================================
   GRIFFES & PLUMES — battle-mapgen.js (1/3)
   Génération de carte, sérialisation, résolution hors-ligne.
   AUCUNE dépendance à l'état de battle-core.js (create()) — pur
   copier-coller, zéro édition (voir commit pour la preuve de diff).
   ============================================================ */
"use strict";

  // ---------------------------------------------------------------
  // Génération de carte (PRNG déterministe)
  // ---------------------------------------------------------------

  // compos ennemies variées par seed (2 types de catégories différentes)
  // §D11ter : pools ennemis ordonnés du basique à l'avancé — la fenêtre de tirage
  // s'élargit avec le stage global : plus on avance, plus la production IA varie.
  // Le JOUEUR, lui, ne produit que l'unité de BASE : sa variété vient des renforts.
  const ENEMY_POOLS = [
    ['lancier', 'eclaireur'], ['lancier', 'fronde'], ['lancier', 'costaud'],
    ['eclaireur', 'traqueur'], ['lancier', 'sapeur'], ['costaud', 'fronde'],
    ['lancier', 'essaim'], ['eclaireur', 'mage'],
    ['costaud', 'mage'], ['traqueur', 'essaim'], ['costaud', 'traqueur'],
    ['sapeur', 'mage'], ['mage', 'essaim'], ['mage', 'assassin'], ['essaim', 'aura'],
  ];

  // post-traitement commun : relaxation, nœuds de contrôle, obstacles
  function postProcessMap(map, rnd, opts) {
    const ns = map.nodes;
    const lockX = !!map.treeLayout; // en arbre, on ne bouge que les Y

    // 1) relaxation : on écarte les nœuds trop proches (minD réduit pour plus d'espacement)
    for (let it = 0; it < 40; it++) {
      let moved = false;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i], b = ns[j];
          const d = bdist(a.x, a.y, b.x, b.y);
          const minD = 72;
          if (d >= minD || d < 0.01) continue;
          const push = (minD - d) / 2;
          const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
          if (a.kind !== 'hq') { if (!lockX) a.x -= ux * push; a.y -= uy * push; }
          if (b.kind !== 'hq') { if (!lockX) b.x += ux * push; b.y += uy * push; }
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const n of ns) {
      if (n.kind === 'hq') continue;
      n.x = Math.round(bclamp(n.x, 54, map.w - 54));
      n.y = Math.round(bclamp(n.y, 54, map.h - 54));
    }

    // 2) points de contrôle (3 sur cartes moyennes/grandes)
    // §B (DESIGN13) : si la carte EN A DÉJÀ (kind 'controle' importé du map-lab ou
    // généré en amont), on ne double pas — on complète seulement jusqu'au quota.
    const haveCtrl = ns.filter(n => n.kind === 'controle').length;
    const wantCtrl = Math.max(0, (opts.controlNodes != null ? opts.controlNodes : (ns.length >= 7 ? 3 : 0)) - haveCtrl);
    const slots = [[0.34, 0.22], [0.5, 0.78], [0.66, 0.4]];
    for (let i = 0; i < wantCtrl; i++) {
      let bx = map.w * slots[i % slots.length][0], by = map.h * slots[i % slots.length][1];
      for (let tries = 0; tries < 50; tries++) {
        const x = bx + (rnd() - 0.5) * 130, y = by + (rnd() - 0.5) * 110;
        if (x < 54 || x > map.w - 54 || y < 50 || y > map.h - 50) continue;
        let ok = true;
        for (const n of ns) if (bdist(x, y, n.x, n.y) < 84) { ok = false; break; }
        if (!ok) continue;
        bx = x; by = y; break;
      }
      const n = {
        id: ns.length, x: Math.round(bx), y: Math.round(by),
        kind: 'controle', owner: null,
        garrison: { lancier: 2 + Math.round(rnd() * 2) },
        cap: 30, prodRate: 0, prodType: 'lancier', defBonus: 0,
      };
      ns.push(n);
      // arêtes décoratives vers les 2 nœuds les plus proches
      if (map.edges) {
        const near = ns.filter(m => m !== n && m.kind !== 'controle')
          .sort((a, b) => bdist(n.x, n.y, a.x, a.y) - bdist(n.x, n.y, b.x, b.y))
          .slice(0, 2);
        for (const m of near) map.edges.push([m.id, n.id]);
      }
    }

    // 3) obstacles : 2-5, jamais sur un nœud, jamais bloquant un chemin à 100 %
    const segs = [];
    if (map.edges && map.edges.length) {
      const byId = {};
      for (const n of ns) byId[n.id] = n;
      for (const e of map.edges) {
        const a = byId[e[0]], b = byId[e[1]];
        if (a && b) segs.push([a.x, a.y, b.x, b.y]);
      }
    } else {
      for (let i = 0; i < ns.length; i++)
        for (let j = i + 1; j < ns.length; j++)
          if (bdist(ns[i].x, ns[i].y, ns[j].x, ns[j].y) < 220)
            segs.push([ns[i].x, ns[i].y, ns[j].x, ns[j].y]);
    }
    const obs = [];
    const zoned = map.zoned || null;
    const nObs = (zoned ? 3 : 2) + Math.floor(rnd() * 4);
    for (let k = 0; k < nObs; k++) {
      for (let tries = 0; tries < 70; tries++) {
        const r = 24 + rnd() * 22;
        let x, y;
        if (zoned) {
          // §6 : les obstacles se plantent ENTRE les zones, sur les frontières de la grille
          if (rnd() < 0.6) {
            const line = 1 + Math.floor(rnd() * (zoned.zc - 1));
            x = line * (map.w / zoned.zc) + (rnd() - 0.5) * 30;
            y = 70 + rnd() * (map.h - 140);
          } else {
            const line = 1 + Math.floor(rnd() * (zoned.zr - 1));
            y = line * (map.h / zoned.zr) + (rnd() - 0.5) * 26;
            x = 80 + rnd() * (map.w - 160);
          }
          x = bclamp(x, 80, map.w - 80); y = bclamp(y, 70, map.h - 70);
        } else {
          x = 80 + rnd() * (map.w - 160); y = 70 + rnd() * (map.h - 140);
        }
        let ok = true;
        for (const n of ns) if (bdist(x, y, n.x, n.y) < r + 58) { ok = false; break; }
        if (ok) for (const o of obs) if (bdist(x, y, o.x, o.y) < r + o.r + 46) { ok = false; break; }
        if (ok) for (const s of segs) if (distSeg(x, y, s[0], s[1], s[2], s[3]) < r * 0.6 + 8) { ok = false; break; }
        if (!ok) continue;
        obs.push({
          kind: rnd() < 0.45 ? 'water' : 'rock',
          x: Math.round(x), y: Math.round(y), r: Math.round(r),
          seed: 1 + Math.floor(rnd() * 999983),
        });
        break;
      }
    }
    map.obstacles = obs;
    return map;
  }

  function generateMap(opts) {
    opts = opts || {};
    const w = opts.w || 960, h = opts.h || 600;
    const mode = opts.mode || 'personal';
    const seed = (opts.seed === undefined ? 1 : opts.seed);
    const rnd = mulberry32(seed * 2654435761 + 7);
    const pf = opts.playerFaction || 'cats';
    const ef = BGD.other(pf);
    let count = opts.nodeCount || (mode === 'collective' ? 16 : 8);
    count = mode === 'collective' ? bclamp(count, 8, 22) : bclamp(count, 4, 16);

    const nodes = [];
    const margin = 50;
    function farEnough(x, y, minD) {
      for (const n of nodes) if (bdist(x, y, n.x, n.y) < minD) return false;
      return true;
    }
    function place(x0, x1, y0, y1) {
      let minD = 75;
      for (let tries = 0; tries < 220; tries++) {
        const x = x0 + rnd() * (x1 - x0);
        const y = y0 + rnd() * (y1 - y0);
        if (farEnough(x, y, minD)) return { x, y };
        if (tries % 40 === 39) minD -= 6; // on relâche si c'est trop serré
      }
      return { x: x0 + rnd() * (x1 - x0), y: y0 + rnd() * (y1 - y0) };
    }
    function mk(kind, owner, x, y) {
      const n = {
        id: nodes.length, x: Math.round(x), y: Math.round(y),
        kind, owner: owner || null,
        garrison: {}, cap: 60, prodRate: 0, prodType: 'lancier', defBonus: 0,
      };
      if (kind === 'hq') { n.cap = 150; n.prodRate = 0.4; }
      else if (kind === 'production') {
        n.cap = 70;
        n.prodRate = 0.45 + rnd() * 0.3;
        n.prodType = rnd() < 0.72 ? 'lancier' : (rnd() < 0.6 ? 'eclaireur' : 'costaud');
      }
      else if (kind === 'defense') { n.defBonus = 0.5; n.cap = 50; }
      else if (kind === 'reinforce') { n.cap = 45; }
      else if (kind === 'banner') { n.cap = 40; }
      else if (kind === 'controle') { n.cap = 30; }
      else if (kind === 'avantposte') { n.cap = 45; } // §B : cap 45, pas de production
      nodes.push(n);
      return n;
    }
    function garrison(n, type, c) { n.garrison[type] = (n.garrison[type] || 0) + c; }

    if (mode === 'personal') {
      // §A (DESIGN13) : REFONTE — des cartes qui RESPIRENT, calées sur le style des
      // 7 cartes manuelles de `exemples-batailles/` : 10-14 nœuds bien espacés,
      // QG aux extrémités, TOUT le reste neutre gardé par des gardiens, gros
      // obstacles sur l'axe central, boss aux passages stratégiques.
      const depth = opts.treeDepth != null ? opts.treeDepth : 0;
      // §D11 : la taille des garnisons scale avec le stage GLOBAL, pour que
      // les villes tardives restent un défi (l'armée du joueur ne les écrase plus).
      const garMult = (BGD.stageGarrisonMult && opts.stage) ? BGD.stageGarrisonMult(opts.stage) : 1;
      const eg = c => Math.max(1, Math.round(c * garMult)); // taille garnison GARDIENS/ENNEMIE
      // §D11ter : compo ennemie tirée dans une fenêtre de pools qui S'ÉLARGIT avec le
      // stage (2 pools au début, +1 tous les 2 stages) — la variété IA suit la progression.
      const stage = opts.stage || 1;
      const poolMax = Math.min(ENEMY_POOLS.length, 2 + Math.floor((stage - 1) / 2));
      const epool = ENEMY_POOLS[Math.floor(rnd() * poolMax)].slice();
      if (opts.elite) epool.push(rnd() < 0.5 ? 'assassin' : 'aura');
      // GARDIENS neutres : pool basique uniquement (owner null = ils défendent
      // leur bâtiment mais n'attaquent jamais — l'IA ne pilote que cats/birds).
      const gpool = ['lancier', 'eclaireur', 'costaud', 'fronde'];
      const gpick = () => gpool[Math.floor(rnd() * gpool.length)];

      // §D14 : SYMÉTRIE — l'équité prime. Miroir AXIAL x→w−x par défaut ;
      // variante ~15 % : symétrie CENTRALE (rotation 180°) → cartes diagonales
      // équitables. Recette : QG joueur + 4-6 nœuds sur la MOITIÉ gauche
      // (x ≤ w/2−60 ⇒ chaque nœud est à ≥ 120 px de son PROPRE miroir, et des
      // miroirs des autres nœuds gauches : w − x1 − x2 ≥ 120) + 0-2 nœuds SUR
      // l'axe (jamais dédoublés), puis miroir : jumeau droit de même kind/cap,
      // garnison de gardiens tirée AVANT le miroir et appliquée aux DEUX.
      // Le QG ennemi est le miroir du QG joueur (position ; sa garnison garde
      // la recette D11ter — c'est la difficulté, pas le terrain). La relaxation
      // D13 disparaît : le placement garantit ≥ 120 px, la garder casserait la symétrie.
      const central = rnd() < 0.15;
      const mir = central
        ? p => ({ x: w - p.x, y: h - p.y })
        : p => ({ x: w - p.x, y: p.y });

      // -- plan des kinds : le mix D13 décliné PAR CÔTÉ --
      // par côté : 1-2 production, 1-2 defense, 0-1 reinforce, 1 controle, 1 banner ;
      // ensemble : 2-3 controle, 2 banner (jumeaux), 1-2 avantposte (axe ou jumeaux).
      const axisMax = central ? 1 : 2; // en rotation 180°, seul le CENTRE est invariant
      const avpOnAxis = rnd() < (central ? 0.5 : 0.4);
      const axisKinds = [];
      if (avpOnAxis) axisKinds.push('avantposte');
      if (axisKinds.length < axisMax && rnd() < 0.45) axisKinds.push('controle'); // 3e controle
      const A = axisKinds.length;
      const leftKinds = ['production', 'defense', 'controle', 'banner'];
      if (!avpOnAxis) leftKinds.push('avantposte');
      // total = 2 QG + 2·L + A ∈ [10,14] ; le nodeCount demandé sert de cible
      const Lmin = Math.max(leftKinds.length, Math.ceil((8 - A) / 2));
      const Lmax = Math.min(6, Math.floor((12 - A) / 2));
      const L = bclamp(Math.round((count - 2 - A) / 2), Lmin, Lmax);
      const extraCaps = { production: 2, defense: 2, reinforce: 1 };
      while (leftKinds.length < L) {
        const pool = ['production', 'defense', 'reinforce']
          .filter(k => leftKinds.filter(x => x === k).length < extraCaps[k]);
        if (!pool.length) break;
        leftKinds.push(pool[Math.floor(rnd() * pool.length)]);
      }
      for (let i = leftKinds.length - 1; i > 0; i--) { // mélange
        const j = Math.floor(rnd() * (i + 1));
        const t2 = leftKinds[i]; leftKinds[i] = leftKinds[j]; leftKinds[j] = t2;
      }
      count = 2 + 2 * leftKinds.length + A; // 10-14 par construction

      // -- QG joueur à gauche ; QG ennemi = miroir exact --
      const hqX = 40 + rnd() * 30; // x 40-70 (miroir : 890-920)
      const hqY = central
        ? (rnd() < 0.5 ? 90 + rnd() * 60 : h - 90 - rnd() * 60) // coins → diagonale
        : h * 0.4 + rnd() * h * 0.2; // 240-360 sur 600
      const hq1 = mk('hq', pf, hqX, hqY);
      garrison(hq1, 'lancier', 14 + depth * 2);
      const hm = mir(hq1); // coordonnées déjà arrondies par mk → miroir exact
      const hq2 = mk('hq', ef, hm.x, hm.y);
      hq2.prodType = epool[0]; // §D11ter : le QG ennemi produit SON pool (le joueur : l'unité de base)
      garrison(hq2, epool[0], eg(11 + count + depth * 3));
      garrison(hq2, epool[1], eg(3 + Math.round(rnd() * 3 + depth * 0.5)));

      // garnison de GARDIENS neutres : tirée UNE fois, appliquée aux deux jumeaux
      const guardDraw = kind => {
        const gs = kind === 'defense' ? eg(4 + Math.round(rnd() * 6 + depth))
          : kind === 'controle' ? eg(2 + Math.round(rnd() * 2))
            : eg(3 + Math.round(rnd() * 7 + depth * 0.5));
        const gar = [[gpick(), gs]];
        if (rnd() < 0.35) gar.push([gpick(), eg(1 + Math.round(rnd() * 2))]);
        return gar;
      };

      // -- nœuds d'AXE (leur propre miroir : jamais dédoublés) --
      for (const kind of axisKinds) {
        let ay = h / 2; // symétrie centrale : le point invariant, c'est le centre
        if (!central) { // axiale : n'importe où sur la colonne, à ≥ 150 de tout
          const okYs = []; let bestY = h / 2, bestD = -1;
          for (let y = 70; y <= h - 70; y += 8) {
            let d = Infinity;
            for (const n of nodes) d = Math.min(d, bdist(w / 2, y, n.x, n.y));
            if (d >= 150) okYs.push(y);
            if (d > bestD) { bestD = d; bestY = y; }
          }
          ay = okYs.length ? okYs[Math.floor(rnd() * okYs.length)] : bestY;
        }
        const n = mk(kind, null, w / 2, ay);
        for (const g of guardDraw(kind)) garrison(n, g[0], g[1]);
      }

      // -- moitié gauche : rejection sampling minD 155 → 122, filet en grille --
      // (contre les nœuds RÉELS seulement : les distances aux miroirs sont
      // garanties par la borne x ≤ w/2 − 60, cf. commentaire d'en-tête)
      const X0 = 90, X1 = w / 2 - 60, Y0 = 52, Y1 = h - 52;
      const leftSpot = () => {
        let md = 155;
        for (let tries = 0; tries < 300; tries++) {
          const x = X0 + rnd() * (X1 - X0);
          const y = Y0 + rnd() * (Y1 - Y0);
          if (farEnough(x, y, md)) return { x, y };
          if (tries % 50 === 49) md = Math.max(122, md - 9);
        }
        // filet déterministe : la case de grille la plus dégagée
        let best = { x: X0, y: Y0 }, bestD = -1;
        for (let gx = X0; gx <= X1; gx += 15) for (let gy = Y0; gy <= Y1; gy += 15) {
          let d = Infinity;
          for (const n of nodes) d = Math.min(d, bdist(gx, gy, n.x, n.y));
          if (d > bestD) { bestD = d; best = { x: gx, y: gy }; }
        }
        return best;
      };
      for (const kind of leftKinds) {
        const p = leftSpot();
        const a = mk(kind, null, p.x, p.y);
        const m2 = mir(a); // a.x/a.y arrondis par mk → jumeau exact
        const b = mk(kind, null, m2.x, m2.y);
        // jumeau STRICT : mk tire prodRate/prodType au hasard → on recopie
        b.cap = a.cap; b.defBonus = a.defBonus;
        b.prodRate = a.prodRate; b.prodType = a.prodType;
        // SEULS les QG sont possédés : gardiens neutres IDENTIQUES des deux côtés
        for (const g of guardDraw(kind)) { garrison(a, g[0], g[1]); garrison(b, g[0], g[1]); }
      }

      // arêtes décoratives : chaque nœud relié à ses 2 plus proches voisins
      const edges = [];
      const seen = {};
      for (const a of nodes) {
        const near = nodes.filter(m => m !== a)
          .sort((m1, m2) => bdist(a.x, a.y, m1.x, m1.y) - bdist(a.x, a.y, m2.x, m2.y))
          .slice(0, 2);
        for (const m of near) {
          const key = Math.min(a.id, m.id) + '|' + Math.max(a.id, m.id);
          if (seen[key]) continue;
          seen[key] = true;
          edges.push([a.id, m.id]);
        }
      }

      // obstacles : 0-3 blobs eau/roche GROS (r 45-150), ≥ 70 px de tout nœud,
      // SYMÉTRIQUES : une PAIRE miroir (même kind/r/seed) et/ou UN blob à
      // cheval sur l'axe (compte une fois, centré — au centre exact en
      // symétrie centrale). 0→rien, 1→axe, 2→paire, 3→paire+axe.
      const obs = [];
      const nObs = Math.floor(rnd() * 4); // 0-3
      if (nObs >= 2) { // paire miroir, plutôt près de l'axe (sculpte les passages)
        let r = 45 + rnd() * 105;
        for (let tries = 0; tries < 80; tries++) {
          // §placement : marge sur l'EMPRISE VISUELLE (~1.2r pour les variantes
          // du lab), pas seulement le rayon de collision — ≥ 30 px entre le
          // blob et son propre miroir, dessin compris
          const maxX = w / 2 - r * 1.2 - 15;
          if (maxX < 60) { r = Math.max(45, r * 0.86); continue; }
          const cx = maxX - rnd() * rnd() * (maxX - 60); // biais vers l'axe central
          const cy = 40 + rnd() * (h - 80);
          let ok = true;
          // contre les nœuds RÉELS (jumeaux inclus) : couvre le blob miroir par symétrie
          for (const n of nodes) if (bdist(cx, cy, n.x, n.y) < Math.max(r + 70, r * 1.2 + 55)) { ok = false; break; }
          if (!ok) { if (tries % 10 === 9) r = Math.max(45, r * 0.86); continue; }
          const o1 = {
            kind: rnd() < 0.7 ? 'water' : 'rock',
            x: Math.round(cx), y: Math.round(cy), r: Math.round(r),
            seed: 1 + Math.floor(rnd() * 999983),
          };
          const m3 = mir(o1);
          obs.push(o1, { kind: o1.kind, x: m3.x, y: m3.y, r: o1.r, seed: o1.seed });
          break;
        }
      }
      if (nObs === 1 || nObs === 3) { // blob d'axe : son propre miroir
        let r = 45 + rnd() * 105;
        for (let tries = 0; tries < 80; tries++) {
          const cx = w / 2, cy = central ? h / 2 : 40 + rnd() * (h - 80);
          let ok = true;
          for (const n of nodes) if (bdist(cx, cy, n.x, n.y) < Math.max(r + 70, r * 1.2 + 55)) { ok = false; break; }
          if (ok) for (const o of obs) if (bdist(cx, cy, o.x, o.y) < Math.max(r + o.r + 30, (r + o.r) * 1.2 + 12)) { ok = false; break; }
          if (!ok) {
            if (central) { if (r <= 45) break; r = Math.max(45, r * 0.86); } // centre occupé
            else if (tries % 10 === 9) r = Math.max(45, r * 0.86);
            continue;
          }
          obs.push({
            kind: rnd() < 0.7 ? 'water' : 'rock',
            x: Math.round(cx), y: Math.round(cy), r: Math.round(r),
            seed: 1 + Math.floor(rnd() * 999983),
          });
          break;
        }
      }

      // BOSS stratégiques (opts.bossCount>0 ou opts.bosses = liste de types) :
      // colonne centrale x = w/2 ± 70, aux passages {centre, haut, bas}, jamais
      // superposés à un nœud (≥ 90 px). Les cartes JSON qui fournissent déjà
      // map.bosses ne passent pas ici : create() les instancie telles quelles.
      const bossList = [];
      const wantB = Array.isArray(opts.bosses) ? opts.bosses.length : ((opts.bossCount | 0) || 0);
      if (wantB > 0) {
        const slots = [[0.5, 0.5], [0.5, 0.12], [0.5, 0.88]]; // centre, passage haut, passage bas
        for (let i = slots.length - 1; i > 0; i--) {
          const j = Math.floor(rnd() * (i + 1));
          const t2 = slots[i]; slots[i] = slots[j]; slots[j] = t2;
        }
        const bpool = Array.isArray(BGD.MAP_BOSSES) ? BGD.MAP_BOSSES : [];
        for (let i = 0; i < Math.min(wantB, 3); i++) {
          const sl = slots[i];
          let bx = 0, by = 0, placed = false;
          for (let tries = 0; tries < 60; tries++) {
            const x = w / 2 + (rnd() - 0.5) * 140; // x = w/2 ± 70
            const y = bclamp(h * sl[1] + (rnd() - 0.5) * 50, 40, h - 40);
            let ok = true;
            for (const n of nodes) if (bdist(x, y, n.x, n.y) < 90) { ok = false; break; }
            if (ok) for (const bb of bossList) if (bdist(x, y, bb.x, bb.y) < 70) { ok = false; break; }
            if (!ok) continue;
            bx = x; by = y; placed = true; break;
          }
          if (!placed) continue; // pas de place propre → on saute, jamais collé à un nœud
          const type = Array.isArray(opts.bosses) ? opts.bosses[i]
            : (bpool.length ? bpool[Math.floor(rnd() * bpool.length)].id : null);
          if (type) bossList.push({ type, x: Math.round(bx), y: Math.round(by) });
        }
      }

      const map = { w, h, seed, theme: opts.theme || null, nodes, edges, obstacles: obs, epool, sym: central ? 'central' : 'axial' };
      if (bossList.length) map.bosses = bossList;
      return map;
    } else {
      // collectif : 2 QG + nœuds répartis, ~40% chats / 40% birds / 20% neutres
      const chq = place(margin + 10, w * 0.14, h * 0.3, h * 0.7);
      mk('hq', 'cats', chq.x, chq.y);
      const bhq = place(w * 0.86, w - margin - 10, h * 0.3, h * 0.7);
      mk('hq', 'birds', bhq.x, bhq.y);
      const rest = [];
      // Distribution en zones : ~25% bords gauche, ~25% bords droit, ~50% centre (plus d'espace)
      for (let i = 0; i < count - 2; i++) {
        let p;
        const zone = rnd();
        if (zone < 0.25) {
          // bord gauche (rapide pour joueur)
          p = place(margin, w * 0.28, margin + 40, h - margin - 40);
        } else if (zone < 0.5) {
          // bord droit (rapide pour ennemi)
          p = place(w * 0.72, w - margin, margin + 40, h - margin - 40);
        } else {
          // zone centrale (tactique, plus d'espace)
          p = place(w * 0.28, w * 0.72, margin, h - margin);
        }
        const r = rnd();
        let kind = 'neutral';
        if (r < 0.44) kind = 'production';
        else if (r < 0.60) kind = 'defense';
        else if (r < 0.72) kind = 'reinforce';
        rest.push(mk(kind, null, p.x, p.y));
      }
      rest.sort((a, b) => a.x - b.x);
      const nCats = Math.round(rest.length * 0.42);
      const nBirds = Math.round(rest.length * 0.42);
      rest.forEach((n, i) => {
        if (i < nCats) n.owner = 'cats';
        else if (i >= rest.length - nBirds) n.owner = 'birds';
        else n.owner = null;
        const gs = n.owner ? 10 + Math.round(rnd() * 14) : 4 + Math.round(rnd() * 9);
        garrison(n, 'lancier', gs);
        if (n.owner && rnd() < 0.4) garrison(n, 'eclaireur', 2 + Math.round(rnd() * 4));
      });
      // garnisons des QG
      garrison(nodes[0], 'lancier', 24); garrison(nodes[0], 'costaud', 3);
      garrison(nodes[1], 'lancier', 24); garrison(nodes[1], 'costaud', 3);
      // un Étendard au centre : que les deux camps aient une bonne raison de se détester
      const bcand = rest.filter(n2 => !n2.owner && n2.x > w * 0.3 && n2.x < w * 0.7);
      if (bcand.length) {
        const b = bcand[Math.floor(rnd() * bcand.length)];
        b.kind = 'banner'; b.cap = 40; b.prodRate = 0; b.defBonus = 0;
      }
    }

    return postProcessMap({ w, h, seed, theme: opts.theme || null, nodes }, rnd, opts);
  }

  // ---------------------------------------------------------------
  // Sérialisation robuste
  // ---------------------------------------------------------------
  function applySerialized(map, data) {
    if (!map || !data || !Array.isArray(data.nodes)) return map;
    const byId = {};
    for (const n of map.nodes) byId[n.id] = n;
    for (const s of data.nodes) {
      if (!s) continue;
      const n = byId[s.id];
      if (!n) continue; // nœud disparu d'une vieille sauvegarde : ignoré
      n.owner = (s.owner === 'cats' || s.owner === 'birds') ? s.owner : null;
      const g = {};
      if (s.garrison && typeof s.garrison === 'object') {
        for (const t of UNIT_ORDER) {
          const v = Math.floor(+s.garrison[t] || 0);
          if (v > 0) g[t] = Math.min(v, 9999);
        }
      }
      n.garrison = g;
    }
    return map;
  }

  function gTot(g) { let n = 0; for (const k in g) n += g[k]; return n; }
  function gStrength(n) {
    let s = 0;
    for (const t in n.garrison) {
      const i = UNIT_ORDER.indexOf(t);
      s += n.garrison[t] * (1 + Math.max(0, i) * 0.8);
    }
    return s * (1 + (n.defBonus || 0));
  }

  // ---------------------------------------------------------------
  // Résolution hors-ligne (statistique, sans agents)
  // ---------------------------------------------------------------
  function offlineResolve(map, data, seconds, params) {
    params = params || {};
    if (data) applySerialized(map, data);
    const cap = (BGD.BALANCE && BGD.BALANCE.citySimCapSec) || 21600;
    seconds = bclamp(Math.floor(seconds || 0), 0, cap);
    const slices = Math.floor(seconds / 60);
    const flipCount = { cats: 0, birds: 0 };
    if (slices <= 0) {
      return { flips: 0, summary: 'Le front n’a pas bougé d’une moustache.' };
    }
    const rnd = mulberry32(((map.seed || 1) * 31 + slices * 7 + 13) >>> 0);
    const power = { cats: params.powerCats || 1, birds: params.powerBirds || 1 };
    const ns = map.nodes;

    // voisins (frontières potentielles)
    const neigh = ns.map(() => []);
    for (let i = 0; i < ns.length; i++)
      for (let j = i + 1; j < ns.length; j++)
        if (bdist(ns[i].x, ns[i].y, ns[j].x, ns[j].y) < 250) { neigh[i].push(j); neigh[j].push(i); }

    for (let s = 0; s < slices; s++) {
      // production
      for (const n of ns) {
        if (!n.owner || !n.prodRate) continue;
        if (gTot(n.garrison) >= n.cap) continue;
        const add = Math.min(Math.round(n.prodRate * 60), n.cap - gTot(n.garrison));
        if (add > 0) n.garrison[n.prodType] = (n.garrison[n.prodType] || 0) + add;
      }
      // pression statistique sur les frontières (max 1 bascule / tranche :
      // le front bouge, mais sans tourner à la machine à laver)
      let flipped = false;
      for (let i = 0; i < ns.length && !flipped; i++) {
        const n = ns[i];
        const press = { cats: 0, birds: 0 };
        for (const j of neigh[i]) {
          const m = ns[j];
          if (!m.owner || m.owner === n.owner) continue;
          press[m.owner] += gStrength(m) * power[m.owner] * 0.5;
        }
        for (const f of ['cats', 'birds']) {
          if (n.owner === f || press[f] <= 0) continue;
          const def = Math.max(4, gStrength(n) * (n.owner ? power[n.owner] : 0.8));
          const ratio = press[f] / def;
          if (ratio < 1.3) continue;
          const p = Math.min(0.10, 0.02 * ratio);
          if (rnd() < p) {
            // bascule : le nœud tombe, l'attaquant y laisse une petite garnison
            n.owner = f;
            n.garrison = { lancier: 3 + Math.round(rnd() * 6) };
            // les voisins attaquants perdent des troupes dans l'assaut
            for (const j of neigh[i]) {
              const m = ns[j];
              if (m.owner !== f) continue;
              for (const t in m.garrison) m.garrison[t] = Math.max(1, Math.floor(m.garrison[t] * 0.65));
            }
            flipCount[f]++;
            flipped = true;
            break;
          }
        }
      }
    }

    const flips = flipCount.cats + flipCount.birds;
    let summary;
    const catName = BGD.FACTIONS.cats.name, birdName = BGD.FACTIONS.birds.name;
    if (flips === 0) {
      summary = 'Pendant votre absence, le front n’a presque pas bougé. Grosse ambiance sieste générale.';
    } else if (flipCount.cats > flipCount.birds) {
      summary = 'Pendant votre absence, ' + catName + ' ont gagné du terrain : ' +
        flipCount.cats + ' point(s) capturé(s) contre ' + flipCount.birds + '. Miaou triomphant !';
    } else if (flipCount.birds > flipCount.cats) {
      summary = 'Pendant votre absence, ' + birdName + ' ont gagné du terrain : ' +
        flipCount.birds + ' point(s) capturé(s) contre ' + flipCount.cats + '. Ça piaille fort là-haut !';
    } else {
      summary = 'Pendant votre absence, ça s’est échangé des politesses : ' +
        flipCount.cats + ' point(s) de chaque côté. Match nul, tout le monde boude.';
    }
    return { flips, summary };
  }


