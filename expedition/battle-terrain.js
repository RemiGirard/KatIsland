/* ============================================================
   GRIFFES & PLUMES — battle-terrain.js (2/3)
   Sprites décoratifs (ombre/étendard/avant-poste), terrain pré-rendu
   par thème. AUCUNE dépendance à l'état de battle-core.js.
   ============================================================ */
"use strict";

  // Ombre douce pré-rendue (lazy : pas de DOM avant le boot)
  let shadowSpr = null;
  function getShadow() {
    if (shadowSpr) return shadowSpr;
    const cv = document.createElement('canvas');
    cv.width = 48; cv.height = 24;
    const g = cv.getContext('2d');
    const rg = g.createRadialGradient(24, 12, 2, 24, 12, 20);
    rg.addColorStop(0, 'rgba(20,30,15,0.30)');
    rg.addColorStop(1, 'rgba(20,30,15,0)');
    g.fillStyle = rg;
    g.save(); g.translate(24, 12); g.scale(1, 0.5); g.translate(-24, -12);
    g.beginPath(); g.arc(24, 12, 20, 0, Math.PI * 2); g.fill();
    g.restore();
    shadowSpr = cv;
    return cv;
  }

  // Sprite de l'Étendard : celui de S si déclaré, sinon fallback dessiné ici.
  // (Un drapeau planté qui rend tout le monde 10 % plus désagréable.)
  const bannerSprCache = {};
  function getBannerSprite(owner) {
    const key = owner || 'none';
    if (bannerSprCache[key]) return bannerSprCache[key];
    let spr = null;
    try {
      if (window.Sprites && Sprites.getNodeCanvas) spr = Sprites.getNodeCanvas('banner', owner, 112);
    } catch (e) { spr = null; }
    if (spr && !(spr.width > 0)) spr = null;
    if (!spr) {
      const cv = document.createElement('canvas');
      cv.width = 112; cv.height = 112;
      const g = cv.getContext('2d');
      g.lineJoin = 'round'; g.lineCap = 'round';
      const col = owner ? FACTION_COL[owner] : NEUTRAL_COL;
      const col2 = owner ? FACTION_COL2[owner] : '#7a7a72';
      // butte de pierres
      g.fillStyle = 'rgba(20,30,15,0.22)';
      g.beginPath(); g.ellipse(56, 88, 26, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a8478';
      g.beginPath(); g.ellipse(56, 84, 20, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a8a296';
      g.beginPath(); g.ellipse(50, 81, 8, 5, -0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(64, 82, 7, 4.5, 0.3, 0, Math.PI * 2); g.fill();
      // hampe
      g.strokeStyle = '#5a4630'; g.lineWidth = 4.5;
      g.beginPath(); g.moveTo(54, 84); g.lineTo(58, 22); g.stroke();
      g.fillStyle = '#7a6142';
      g.beginPath(); g.arc(58, 20, 3.4, 0, Math.PI * 2); g.fill();
      // drapeau échancré
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(59, 24); g.lineTo(96, 30); g.lineTo(86, 41); g.lineTo(95, 52); g.lineTo(58, 54);
      g.closePath(); g.fill();
      g.strokeStyle = col2; g.lineWidth = 2; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
      // épées croisées, sobres et menaçantes
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(68, 32); g.lineTo(82, 46); g.stroke();
      g.beginPath(); g.moveTo(82, 32); g.lineTo(68, 46); g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.beginPath(); g.moveTo(69, 43); g.lineTo(74, 43); g.stroke();
      g.beginPath(); g.moveTo(76, 43); g.lineTo(81, 43); g.stroke();
      spr = cv;
    }
    bannerSprCache[key] = spr;
    return spr;
  }

  // §B (DESIGN13) : sprite de l'Avant-poste — petit fortin/tente, marqueur simple
  // et DISTINCT (palissade + tente teintée faction + fanion). Dessiné ici : le kind
  // est nouveau, Sprites ne le connaît pas encore.
  const outpostSprCache = {};
  function getOutpostSprite(owner) {
    const key = owner || 'none';
    if (outpostSprCache[key]) return outpostSprCache[key];
    // skin lab choisi (mirador / poste-ecoute) : servi par Sprites comme les autres
    let labSpr = null;
    try {
      if (window.LabSkins && LabSkins.building('avantposte', owner) &&
          window.Sprites && Sprites.getNodeCanvas)
        labSpr = Sprites.getNodeCanvas('avantposte', owner, 112);
    } catch (e) { labSpr = null; }
    if (labSpr && labSpr.width > 0) {
      outpostSprCache[key] = labSpr;
      return labSpr;
    }
    const cv = document.createElement('canvas');
    cv.width = 112; cv.height = 112;
    const g = cv.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const col = owner ? FACTION_COL[owner] : NEUTRAL_COL;
    const col2 = owner ? FACTION_COL2[owner] : '#7a7a72';
    // ombre + butte de terre battue
    g.fillStyle = 'rgba(20,30,15,0.22)';
    g.beginPath(); g.ellipse(56, 88, 30, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9a8f76';
    g.beginPath(); g.ellipse(56, 84, 26, 10, 0, 0, Math.PI * 2); g.fill();
    // palissade de rondins (le fortin)
    g.fillStyle = '#7a6142';
    for (let i = 0; i < 5; i++) {
      const x = 34 + i * 11;
      g.fillRect(x, 62, 8, 22);
      g.beginPath(); g.arc(x + 4, 62, 4, Math.PI, 0); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(34 + i * 11 - 1.5, 64); g.lineTo(34 + i * 11 - 1.5, 82); g.stroke(); }
    // tente en toile teintée faction
    g.fillStyle = col;
    g.beginPath(); g.moveTo(56, 34); g.lineTo(80, 66); g.lineTo(32, 66); g.closePath(); g.fill();
    g.strokeStyle = col2; g.lineWidth = 2; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
    // entrée sombre
    g.fillStyle = 'rgba(30,26,22,0.85)';
    g.beginPath(); g.moveTo(56, 48); g.lineTo(64, 66); g.lineTo(48, 66); g.closePath(); g.fill();
    // fanion
    g.strokeStyle = '#5a4630'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(56, 34); g.lineTo(56, 18); g.stroke();
    g.fillStyle = col2;
    g.beginPath(); g.moveTo(57, 18); g.lineTo(74, 22); g.lineTo(57, 27); g.closePath(); g.fill();
    outpostSprCache[key] = cv;
    return cv;
  }


  // ---------------------------------------------------------------
  // Terrain pré-rendu par thème
  // ---------------------------------------------------------------
  const TERRAIN_RES = 2; // sur-échantillonnage pour rester net une fois agrandi

  // §skins : réglages du sol validés au terrain-lab
  // (lab/terrain_ronron.lab.json § reglagesTerrain) — grandes taches
  // colorées très floutées + grain d'herbe dense.
  const SOL = {
    tacheCount: 65,          // nombre de taches
    tacheAlpha: 0.05,        // opacité d'une tache
    tacheBlur: 40,           // flou (px) : fond les ovales dans le sol
    tacheSize: 2.5,          // multiplicateur de taille
    tacheLight: 0,           // proportion de taches blanches (0 = aucune)
    tacheCol: '235,215,0',   // #ebd700
    grainCount: 400,         // brins d'herbe
    grainAlpha: 0.28,        // opacité des brins
  };

  function paintTerrain(map, theme) {
    const w = map.w, h = map.h;
    const cv = document.createElement('canvas');
    cv.width = w * TERRAIN_RES; cv.height = h * TERRAIN_RES;
    const g = cv.getContext('2d');
    g.scale(TERRAIN_RES, TERRAIN_RES);
    const rnd = mulberry32(((map.seed || 1) * 977 + 5) >>> 0);
    const g1 = (theme && theme.g1) || '#8fbc6f';
    const g2 = (theme && theme.g2) || '#6da054';
    const decor = (theme && theme.decor) || 'park';
    // §skins : éléments naturels à variante lab — PAS cuits dans le canvas,
    // listés ici ({v, x, y, r, seed}) et animés chaque frame par la bataille
    map.dynElems = [];

    // fond : dégradé radial doux
    const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, BGD.shade(g1, 0.08));
    grad.addColorStop(0.6, g1);
    grad.addColorStop(1, g2);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // taches peintes — réglages terrain-lab (SOL) : ellipses floutées colorées
    g.save();
    if (SOL.tacheBlur > 0) g.filter = 'blur(' + SOL.tacheBlur + 'px)';
    for (let i = 0; i < SOL.tacheCount; i++) {
      g.fillStyle = rnd() < SOL.tacheLight
        ? 'rgba(255,255,255,' + (SOL.tacheAlpha * 0.9).toFixed(3) + ')'
        : 'rgba(' + SOL.tacheCol + ',' + SOL.tacheAlpha.toFixed(3) + ')';
      g.beginPath();
      g.ellipse(rnd() * w, rnd() * h, (18 + rnd() * 55) * SOL.tacheSize, (10 + rnd() * 26) * SOL.tacheSize, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // §placement : segments de chemins (calculés tôt — les arbres du décor
    // s'en tiennent à l'écart, le tracé pointillé les réutilise plus bas)
    const ns = map.nodes;
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

    // décor par thème (2-3 éléments peints, discrets)
    g.save();
    const dark = BGD.shade(g2, -0.28), lite = BGD.shade(g1, 0.3);
    function blob(x, y, r, col, a) {
      g.globalAlpha = a; g.fillStyle = col;
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const an = i / 10 * Math.PI * 2;
        const rr = r * (0.8 + rnd() * 0.35);
        const px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * 0.8;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill(); g.globalAlpha = 1;
    }
    function tree(x, y, r) {
      // §skins : variante d'arbre du lab (tirage déterministe par position) —
      // pas cuite dans le terrain : listée dans map.dynElems, la bataille
      // l'anime chaque frame. Fallback sans variante : le rond peint historique.
      const sd = ((x * 73 + y * 151) | 0) || 1;
      const tv = window.LabSkins ? LabSkins.pickElem('tree', sd) : null;
      if (tv) {
        map.dynElems.push({ v: tv, x, y, r, seed: sd });
        return;
      }
      g.globalAlpha = 0.22; g.fillStyle = 'rgba(0,0,0,0.5)';
      g.beginPath(); g.ellipse(x + 3, y + 4, r, r * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.85;
      const tg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      tg.addColorStop(0, BGD.shade(g1, 0.35)); tg.addColorStop(1, dark);
      g.fillStyle = tg;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // §placement : un arbre du décor ne se pose ni sur un bâtiment, ni sur un
    // obstacle, ni sur un chemin, ni sur un autre arbre. Tirage avec rejet ;
    // sans place propre après 50 essais, l'arbre saute (le décor respire).
    const placedTrees = [];
    map.decorTrees = placedTrees; // exposé sur la carte (audit / futurs usages)
    function distSeg2(x, y, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      const L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2)) : 0;
      return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    }
    function treeSpot(r) {
      for (let tries = 0; tries < 50; tries++) {
        const x = 40 + rnd() * (w - 80), y = 40 + rnd() * (h - 80);
        let ok = true;
        for (const n of ns) if (bdist(x, y, n.x, n.y) < r + 52) { ok = false; break; }
        if (ok) for (const o of (map.obstacles || [])) if (bdist(x, y, o.x, o.y) < r + o.r * 1.2 + 8) { ok = false; break; }
        if (ok) for (const t2 of placedTrees) if (bdist(x, y, t2.x, t2.y) < r + t2.r + 6) { ok = false; break; }
        if (ok) for (const s of segs) if (distSeg2(x, y, s[0], s[1], s[2], s[3]) < r + 14) { ok = false; break; }
        if (ok) { placedTrees.push({ x, y, r }); return { x, y }; }
      }
      return null;
    }
    function treeAt(r) {
      const p = treeSpot(r);
      if (p) tree(p.x, p.y, r);
    }
    function box(x, y, ww, hh, col, a) {
      g.globalAlpha = a; g.fillStyle = col;
      g.save(); g.translate(x, y); g.rotate((rnd() - 0.5) * 0.5);
      g.fillRect(-ww / 2, -hh / 2, ww, hh);
      g.globalAlpha = a * 0.5; g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
      g.strokeRect(-ww / 2, -hh / 2, ww, hh);
      g.restore(); g.globalAlpha = 1;
    }
    const px = () => 40 + rnd() * (w - 80), py = () => 40 + rnd() * (h - 80);

    switch (decor) {
      case 'park':
        for (let i = 0; i < 6; i++) treeAt(12 + rnd() * 10);
        for (let i = 0; i < 16; i++) {
          g.fillStyle = ['#e8788a', '#f2d24e', '#f8f4ec'][(rnd() * 3) | 0]; g.globalAlpha = 0.75;
          g.beginPath(); g.arc(px(), py(), 1.6 + rnd(), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        }
        break;
      case 'rooftop':
        for (let i = 0; i < 7; i++) box(px(), py(), 46 + rnd() * 60, 34 + rnd() * 40, rnd() < 0.5 ? BGD.shade(g2, -0.12) : BGD.shade(g1, 0.12), 0.5);
        for (let i = 0; i < 5; i++) box(px(), py(), 10, 8, '#c8ccd4', 0.7);
        break;
      case 'sand':
        g.strokeStyle = lite; g.globalAlpha = 0.35; g.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          const x = px(), y = py();
          g.beginPath(); g.arc(x, y, 16 + rnd() * 22, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
        g.globalAlpha = 1;
        for (let i = 0; i < 4; i++) {
          const x = px(), y = py();
          g.fillStyle = '#5a9058'; g.globalAlpha = 0.8;
          g.beginPath(); g.ellipse(x, y, 3.4, 9, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(x - 5, y - 2, 2.2, 5, -0.5, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        }
        break;
      case 'sky':
        for (let i = 0; i < 7; i++) blob(px(), py(), 26 + rnd() * 30, '#ffffff', 0.16);
        g.globalAlpha = 0.12; g.fillStyle = '#fff8d8';
        g.beginPath(); g.arc(w * 0.85, h * 0.12, 90, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        break;
      case 'fortress':
        g.strokeStyle = 'rgba(0,0,0,0.09)'; g.lineWidth = 1.4;
        for (let x = 30; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, h); g.stroke(); }
        for (let y = 30; y < h; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 5); g.stroke(); }
        for (let i = 0; i < 5; i++) blob(px(), py(), 12 + rnd() * 10, dark, 0.25);
        break;
      case 'harbor': {
        const wg = g.createLinearGradient(0, h - 90, 0, h);
        wg.addColorStop(0, 'rgba(70,150,190,0)'); wg.addColorStop(1, 'rgba(56,130,180,0.55)');
        g.fillStyle = wg; g.fillRect(0, h - 90, w, 90);
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.6;
        for (let i = 0; i < 5; i++) {
          const y = h - 12 - rnd() * 50, x = rnd() * w;
          g.beginPath(); g.arc(x, y, 10 + rnd() * 14, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        }
        for (let i = 0; i < 4; i++) box(px(), 40 + rnd() * (h - 160), 10, 13, '#9a6a3a', 0.8);
        break;
      }
      case 'meadow': {
        // la Grande Pelote !
        const x = w * (0.2 + rnd() * 0.6), y = h * (0.2 + rnd() * 0.6);
        g.globalAlpha = 0.7; g.fillStyle = '#d6708a';
        g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x, y, 6 + i * 5.5, i, i + 2.4); g.stroke(); }
        g.globalAlpha = 1;
        for (let i = 0; i < 22; i++) {
          g.fillStyle = ['#e8788a', '#b48cff', '#f2d24e'][(rnd() * 3) | 0]; g.globalAlpha = 0.7;
          g.beginPath(); g.arc(px(), py(), 1.6 + rnd() * 1.2, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        }
        break;
      }
      case 'junkyard':
        for (let i = 0; i < 6; i++) box(px(), py(), 22 + rnd() * 22, 16 + rnd() * 14, '#c0a068', 0.55);
        for (let i = 0; i < 3; i++) {
          const x = px(), y = py();
          g.strokeStyle = '#3a3a3a'; g.globalAlpha = 0.5; g.lineWidth = 5;
          g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
        }
        break;
      case 'forest':
        for (let i = 0; i < 11; i++) treeAt(14 + rnd() * 14);
        for (let i = 0; i < 8; i++) blob(px(), py(), 10 + rnd() * 14, '#fff8c8', 0.06);
        break;
      case 'city':
        g.fillStyle = 'rgba(60,60,70,0.30)';
        g.fillRect(0, h * 0.42, w, 34);
        g.fillRect(w * 0.55, 0, 30, h);
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2; g.setLineDash([12, 12]);
        g.beginPath(); g.moveTo(0, h * 0.42 + 17); g.lineTo(w, h * 0.42 + 17); g.stroke();
        g.beginPath(); g.moveTo(w * 0.55 + 15, 0); g.lineTo(w * 0.55 + 15, h); g.stroke();
        g.setLineDash([]);
        for (let i = 0; i < 4; i++) box(px(), py(), 34 + rnd() * 30, 26 + rnd() * 20, BGD.shade(g2, -0.15), 0.45);
        break;
      default:
        for (let i = 0; i < 5; i++) treeAt(12 + rnd() * 8);
    }
    g.restore();

    // brins d'herbe / grain — réglages terrain-lab (SOL)
    g.strokeStyle = 'rgba(20,45,20,' + SOL.grainAlpha.toFixed(3) + ')'; g.lineWidth = 1.4;
    for (let i = 0; i < SOL.grainCount; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y - 6); g.stroke();
    }

    // Les cartes spécialisées peuvent garder ces segments pour réserver le sol
    // au pathfinding tout en dessinant leur propre réseau physique par-dessus.
    if (!map.hidePaths) {
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(30,30,20,0.14)'; g.lineWidth = 3;
      g.setLineDash([1, 10]);
      for (const s of segs) {
        g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke();
      }
      g.setLineDash([]);
    }

    // obstacles (eau / rocher) — variante lab par seed (animée : listée dans
    // map.dynElems, pas cuite) > sprite de B > fallback peint
    for (const o of (map.obstacles || [])) {
      const ekind = o.kind === 'water' ? 'water' : 'rock';
      const ev = window.LabSkins ? LabSkins.pickElem(ekind, o.seed | 0) : null;
      if (ev) {
        map.dynElems.push({ v: ev, x: o.x, y: o.y, r: o.r, seed: (o.seed | 0) || 1 });
        continue;
      }
      let spr = null;
      try { if (window.Sprites && Sprites.getObstacleCanvas) spr = Sprites.getObstacleCanvas(o.kind, o.seed); } catch (e) { spr = null; }
      if (spr) {
        const s = (o.r * 2.3) / Math.max(1, spr.width);
        g.drawImage(spr, o.x - spr.width * s / 2, o.y - spr.height * s / 2, spr.width * s, spr.height * s);
        continue;
      }
      const orn = mulberry32(o.seed || 1);
      if (o.kind === 'water') {
        const wgd = g.createRadialGradient(o.x - o.r * 0.2, o.y - o.r * 0.2, 2, o.x, o.y, o.r);
        wgd.addColorStop(0, '#8fd0e8'); wgd.addColorStop(1, '#3f88ae');
        g.fillStyle = wgd;
        g.beginPath();
        for (let i = 0; i <= 12; i++) {
          const an = i / 12 * Math.PI * 2;
          const rr = o.r * (0.82 + orn() * 0.24);
          const px2 = o.x + Math.cos(an) * rr, py2 = o.y + Math.sin(an) * rr * 0.82;
          i ? g.lineTo(px2, py2) : g.moveTo(px2, py2);
        }
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(o.x + (orn() - 0.5) * o.r, o.y + (orn() - 0.5) * o.r * 0.6, 4 + orn() * 7, Math.PI * 1.1, Math.PI * 1.9);
          g.stroke();
        }
      } else {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.beginPath(); g.ellipse(o.x + 3, o.y + 5, o.r, o.r * 0.55, 0, 0, Math.PI * 2); g.fill();
        const rgd = g.createLinearGradient(o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r);
        rgd.addColorStop(0, '#a8a49a'); rgd.addColorStop(1, '#6e6a60');
        g.fillStyle = rgd;
        g.beginPath();
        for (let i = 0; i <= 8; i++) {
          const an = i / 8 * Math.PI * 2 + 0.3;
          const rr = o.r * (0.78 + orn() * 0.3);
          const px2 = o.x + Math.cos(an) * rr, py2 = o.y + Math.sin(an) * rr * 0.8 - o.r * 0.15;
          i ? g.lineTo(px2, py2) : g.moveTo(px2, py2);
        }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.beginPath(); g.ellipse(o.x - o.r * 0.25, o.y - o.r * 0.4, o.r * 0.35, o.r * 0.2, -0.4, 0, Math.PI * 2); g.fill();
      }
    }
    return cv;
  }

  // §D (DESIGN13) : cache du terrain par seed+dims+thème — le lane (et les relances
  // d'une même carte) réutilisent le canvas au lieu de tout repeindre à chaque create.
  let terrainCacheKey = null, terrainCacheCv = null, terrainCacheDyn = null;
  function getTerrain(map, theme) {
    const th = theme || {};
    const key = (map.seed || 0) + '|' + map.w + '|' + map.h + '|' +
      (th.g1 || '') + '|' + (th.g2 || '') + '|' + (th.decor || '') + '|' +
      map.nodes.length + '|' + ((map.obstacles && map.obstacles.length) || 0) + '|' +
      ((map.edges && map.edges.length) || 0);
    if (terrainCacheKey === key && terrainCacheCv) {
      // même carte régénérée (nouvel objet map) : on lui rattache la liste
      // d'éléments animés mémorisée avec le canvas
      if (terrainCacheDyn) map.dynElems = terrainCacheDyn;
      return terrainCacheCv;
    }
    terrainCacheCv = paintTerrain(map, theme);
    terrainCacheDyn = map.dynElems || null;
    terrainCacheKey = key;
    return terrainCacheCv;
  }

