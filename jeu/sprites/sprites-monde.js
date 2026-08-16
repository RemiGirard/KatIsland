/* ============================================================
   LE BOURG — sprites/sprites-monde.js   (module manquant, réécrit)

   `sprites-index.js` publie vingt-huit fonctions ; cinq modules
   seulement étaient livrés. Celui-ci fournit les quatre familles
   absentes que les moteurs appellent réellement :

     · les NŒUDS de bataille (tours à prendre, étendard, avant-poste) ;
     · les OBSTACLES du terrain (rocher, mare) et du donjon ;
     · les BOSS et leurs sbires ;
     · les petites pièces : âme qui s'échappe, emblème, bannière,
       mannequin d'entraînement, icône d'activité, mascotte.

   Portée partagée avec `sprites-core.js` : on réutilise `mk`, `rgba`,
   `clamp`, `SGD`, `softShadow`, `roundRectPath`, `starPath`.
   ============================================================ */
"use strict";

  const cacheMonde = new Map();
  const TAU2 = Math.PI * 2;

  function accentDe(owner) {
    if (owner && SGD.FACTIONS && SGD.FACTIONS[owner]) return SGD.FACTIONS[owner].acc;
    return '#8a8f96';
  }
  /* PRNG déterministe : deux rochers de même graine doivent être le même
     rocher, sinon le terrain scintille à chaque recuisson. */
  function ru(seed) {
    let a = (seed | 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================================================
     LES NŒUDS — ce qu'on prend et ce qu'on défend.
     Un nœud n'est pas un jeton : c'est un OUVRAGE. Socle de pierre,
     fût, toiture, et la couleur du camp portée par la bannière et le
     bandeau de la porte — pour qu'on lise l'appartenance de loin.
     ============================================================ */
  function getNodeCanvas(kind, owner, size) {
    size = size || 112;
    const key = 'n|' + kind + '|' + (owner || 'x') + '|' + size;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const acc = accentDe(owner);
    const S = size / 112;
    const cx = size / 2, sol = size * 0.86;

    softShadow(g, cx, sol, size * 0.34, size * 0.13, 0.34);

    if (kind === 'banner') {
      // L'ÉTENDARD : une hampe plantée, un lé qui claque, un tertre.
      g.fillStyle = '#6b5a44';
      g.fillRect(cx - 2 * S, sol - 62 * S, 4 * S, 62 * S);
      g.fillStyle = '#8a7660'; g.fillRect(cx - 2 * S, sol - 62 * S, 1.6 * S, 62 * S);
      g.fillStyle = acc;
      g.beginPath();
      g.moveTo(cx + 2 * S, sol - 60 * S);
      g.lineTo(cx + 34 * S, sol - 52 * S);
      g.lineTo(cx + 24 * S, sol - 40 * S);
      g.lineTo(cx + 34 * S, sol - 28 * S);
      g.lineTo(cx + 2 * S, sol - 24 * S);
      g.closePath(); g.fill();
      g.fillStyle = rgba('#000000', .22);
      g.beginPath();
      g.moveTo(cx + 2 * S, sol - 40 * S); g.lineTo(cx + 24 * S, sol - 40 * S);
      g.lineTo(cx + 34 * S, sol - 28 * S); g.lineTo(cx + 2 * S, sol - 24 * S);
      g.closePath(); g.fill();
      g.fillStyle = '#8a8272';
      g.beginPath(); g.ellipse(cx, sol, 22 * S, 8 * S, 0, 0, TAU2); g.fill();
      g.fillStyle = '#a29a8c';
      g.beginPath(); g.ellipse(cx, sol - 2 * S, 18 * S, 6 * S, 0, 0, TAU2); g.fill();
      cacheMonde.set(key, cv); return cv;
    }

    const grand = kind === 'avantposte';
    const hFut = (grand ? 54 : 42) * S;
    const lFut = (grand ? 46 : 38) * S;

    // socle
    g.fillStyle = '#5f594c';
    g.beginPath(); g.ellipse(cx, sol, lFut * 0.72, 11 * S, 0, 0, TAU2); g.fill();
    g.fillStyle = '#7a7466';
    g.beginPath(); g.ellipse(cx, sol - 3 * S, lFut * 0.66, 9 * S, 0, 0, TAU2); g.fill();

    // fût : un tronc de cône appareillé, la lumière vient de la gauche
    for (let j = 0; j < hFut; j++) {
      const t = j / hFut;
      const w = lFut * (1 - 0.16 * t);
      const y = sol - 4 * S - j;
      for (let i = -w / 2; i < w / 2; i += 1) {
        const u = (i + w / 2) / w;
        const base = u < 0.34 ? '#9a9284' : (u < 0.72 ? '#837c6f' : '#635d52');
        g.fillStyle = ((j % Math.max(3, Math.round(7 * S))) === 0) ? '#575145' : base;
        g.fillRect(cx + i, y, 1, 1);
      }
    }
    // bandeau du camp, à mi-hauteur
    g.fillStyle = acc;
    g.fillRect(cx - lFut * 0.46, sol - 4 * S - hFut * 0.55, lFut * 0.92, 5 * S);
    g.fillStyle = rgba('#ffffff', .22);
    g.fillRect(cx - lFut * 0.46, sol - 4 * S - hFut * 0.55, lFut * 0.92, 1.4 * S);

    // porte
    g.fillStyle = '#241d16';
    g.fillRect(cx - 7 * S, sol - 4 * S - 20 * S, 14 * S, 20 * S);
    g.fillStyle = '#3c3126';
    g.fillRect(cx - 7 * S, sol - 4 * S - 20 * S, 14 * S, 3 * S);

    // couronnement : créneaux, puis toit conique pour l'avant-poste
    const yTop = sol - 4 * S - hFut;
    g.fillStyle = '#8a8272';
    g.fillRect(cx - lFut * 0.5 - 2 * S, yTop - 6 * S, lFut + 4 * S, 6 * S);
    g.fillStyle = '#a29a8c';
    g.fillRect(cx - lFut * 0.5 - 2 * S, yTop - 6 * S, lFut + 4 * S, 1.6 * S);
    for (let i = 0; i < 5; i++) {
      const x = cx - lFut * 0.5 + i * (lFut / 4.4);
      g.fillStyle = '#7a7466';
      g.fillRect(x, yTop - 11 * S, lFut / 9, 5 * S);
    }
    if (grand) {
      g.fillStyle = SGD.shade(acc, -0.32);
      g.beginPath();
      g.moveTo(cx, yTop - 34 * S);
      g.lineTo(cx + lFut * 0.56, yTop - 10 * S);
      g.lineTo(cx - lFut * 0.56, yTop - 10 * S);
      g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', .16);
      g.beginPath();
      g.moveTo(cx, yTop - 34 * S);
      g.lineTo(cx - lFut * 0.56, yTop - 10 * S);
      g.lineTo(cx - lFut * 0.14, yTop - 10 * S);
      g.closePath(); g.fill();
      // fanion
      g.fillStyle = '#4a4238'; g.fillRect(cx - 1 * S, yTop - 46 * S, 2 * S, 13 * S);
      g.fillStyle = acc;
      g.beginPath(); g.moveTo(cx + 1 * S, yTop - 46 * S);
      g.lineTo(cx + 14 * S, yTop - 42 * S); g.lineTo(cx + 1 * S, yTop - 38 * S);
      g.closePath(); g.fill();
    }
    cacheMonde.set(key, cv); return cv;
  }
  function getNodeRef(kind, owner, size) { return getNodeCanvas(kind, owner, size); }

  /* ============================================================
     LES OBSTACLES
     ============================================================ */
  function getObstacleCanvas(kind, seed) {
    const size = 96;
    const key = 'o|' + kind + '|' + (seed | 0);
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const r = ru(seed || 1);

    if (kind === 'water') {
      // une mare : trois nappes concentriques, la plus claire au centre
      const cx = size / 2, cy = size / 2;
      const rx = size * (0.40 + r() * 0.06), ry = size * (0.27 + r() * 0.05);
      const nappes = [['#2c4b63', 1], ['#365d79', 0.86], ['#43708e', 0.66], ['#5b8fae', 0.4]];
      for (const [col, k] of nappes) {
        g.fillStyle = col;
        g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU2); g.fill();
      }
      g.strokeStyle = rgba('#cfe8f4', .34); g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const yy = cy - ry * 0.3 + i * ry * 0.32;
        g.beginPath();
        g.moveTo(cx - rx * 0.5, yy); g.lineTo(cx + rx * 0.34, yy); g.stroke();
      }
      // roseaux au bord
      for (let i = 0, n = 4 + (r() * 4 | 0); i < n; i++) {
        const a = r() * TAU2;
        const x = cx + Math.cos(a) * rx * 0.92, y = cy + Math.sin(a) * ry * 0.92;
        g.strokeStyle = '#4e6b3a'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y - 8 - r() * 8); g.stroke();
      }
      cacheMonde.set(key, cv); return cv;
    }

    // rocher : silhouette à facettes, trois tons, mousse au pied
    const cx = size / 2, sol = size * 0.78;
    softShadow(g, cx, sol, size * 0.30, size * 0.10, 0.30);
    const n = 7, pts = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i / (n - 1)) * Math.PI;
      const rr = size * (0.22 + r() * 0.13);
      pts.push([cx + Math.cos(a) * rr * 1.25, sol + Math.sin(a) * rr * 0.95]);
    }
    g.fillStyle = '#6f695c';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.closePath(); g.fill();
    g.fillStyle = '#8a8272';
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < 4; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineTo(cx, sol);
    g.closePath(); g.fill();
    g.fillStyle = '#a29a8c';
    g.beginPath(); g.moveTo(pts[1][0], pts[1][1]);
    g.lineTo(pts[2][0], pts[2][1]); g.lineTo(cx - size * 0.05, sol - size * 0.06);
    g.closePath(); g.fill();
    g.fillStyle = '#4e6b3a';
    for (let i = 0, m = 5 + (r() * 5 | 0); i < m; i++)
      g.fillRect(cx - size * 0.24 + r() * size * 0.48, sol - 2 - r() * 4, 2 + r() * 3, 2);
    cacheMonde.set(key, cv); return cv;
  }
  function getObstacleRef(kind, size, seed) {
    const base = getObstacleCanvas(kind === 'water' ? 'water' : 'rock', seed || 1);
    if (!size || size === base.width) return base;
    const key = 'or|' + kind + '|' + size + '|' + (seed | 0);
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(Math.round(size), Math.round(size));
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0, cv.width, cv.height);
    cacheMonde.set(key, cv); return cv;
  }
  function getTerrainRef(theme, w, h) { return null; }
  function getDecorRef(kind, size, seed) { return getObstacleRef(kind, size, seed); }

  /* ============================================================
     L'ÂME. Quand une unité tombe, un peu d'elle monte : une flamme
     froide aux couleurs de son camp, qui s'efface en deux secondes.
     ============================================================ */
  function getSoulCanvas(faction, size) {
    size = Math.max(6, size || 24);
    const key = 's|' + faction + '|' + size;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const acc = accentDe(faction);
    const cx = size / 2, cy = size * 0.55, r = size * 0.30;
    const gr = g.createRadialGradient(cx, cy, 1, cx, cy, r * 2.1);
    gr.addColorStop(0, rgba(SGD.shade(acc, 0.55), 0.95));
    gr.addColorStop(0.45, rgba(acc, 0.5));
    gr.addColorStop(1, rgba(acc, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(cx, cy, r * 2.1, 0, TAU2); g.fill();
    g.fillStyle = rgba('#ffffff', 0.85);
    g.beginPath();
    g.moveTo(cx, cy - r * 1.5);
    g.quadraticCurveTo(cx + r * 0.8, cy, cx, cy + r * 0.9);
    g.quadraticCurveTo(cx - r * 0.8, cy, cx, cy - r * 1.5);
    g.fill();
    cacheMonde.set(key, cv); return cv;
  }

  /* ============================================================
     LES BOSS. Une masse, deux yeux, et la silhouette de son type —
     assez pour qu'on comprenne, à l'écran d'une bataille, que celui-là
     n'est pas comme les autres.
     ============================================================ */
  const BOSS_TEINTES = {
    reine:    ['#7f6fc0', '#4a3f80'],
    colosse:  ['#8a6a45', '#4f3a24'],
    rapace:   ['#5f9ad0', '#2f5f8f'],
    ombre:    ['#3a3448', '#1a1622'],
    chaudron: ['#4f8a63', '#2c5240'],
  };
  function getBossCanvas(type, size, animT) {
    size = Math.max(24, size || 96);
    const ph = Math.round(((animT || 0) * 4) % 4);       // 4 poses seulement : c'est un cache
    const key = 'b|' + type + '|' + size + '|' + ph;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const t = BOSS_TEINTES[type] || BOSS_TEINTES.reine;
    const cx = size / 2, sol = size * 0.90;
    const bob = Math.sin(ph / 4 * TAU2) * size * 0.018;

    softShadow(g, cx, sol, size * 0.36, size * 0.12, 0.42);

    // le corps : une masse ovale posée bas, plus large que haute
    const rx = size * 0.34, ry = size * 0.30;
    const cy = sol - ry - size * 0.06 + bob;
    g.fillStyle = t[1];
    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU2); g.fill();
    g.fillStyle = t[0];
    g.beginPath(); g.ellipse(cx - rx * 0.10, cy - ry * 0.16, rx * 0.86, ry * 0.80, 0, 0, TAU2); g.fill();
    g.fillStyle = rgba('#ffffff', 0.14);
    g.beginPath(); g.ellipse(cx - rx * 0.32, cy - ry * 0.42, rx * 0.36, ry * 0.26, 0, 0, TAU2); g.fill();

    // les attributs du type
    if (type === 'reine' || type === 'ombre') {
      g.fillStyle = SGD.shade(t[0], 0.30);
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(cx + i * rx * 0.32, cy - ry * 0.86);
        g.lineTo(cx + i * rx * 0.32 + rx * 0.10, cy - ry * 1.42);
        g.lineTo(cx + i * rx * 0.32 + rx * 0.20, cy - ry * 0.86);
        g.closePath(); g.fill();
      }
    } else if (type === 'rapace') {
      g.fillStyle = SGD.shade(t[1], -0.10);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * rx * 0.5, cy - ry * 0.2);
        g.quadraticCurveTo(cx + s * rx * 1.7, cy - ry * (1.1 + bob * 0.02), cx + s * rx * 1.5, cy + ry * 0.5);
        g.quadraticCurveTo(cx + s * rx * 1.0, cy + ry * 0.1, cx + s * rx * 0.5, cy + ry * 0.3);
        g.closePath(); g.fill();
      }
    } else if (type === 'colosse') {
      g.fillStyle = t[1];
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(cx + s * rx * 0.95, cy + ry * 0.28, rx * 0.30, ry * 0.52, 0, 0, TAU2);
        g.fill();
      }
    } else if (type === 'chaudron') {
      g.fillStyle = '#2a2620';
      g.fillRect(cx - rx * 0.75, cy - ry * 1.05, rx * 1.5, ry * 0.22);
      g.fillStyle = '#ff9a3a';
      g.beginPath(); g.ellipse(cx, cy - ry * 0.9, rx * 0.55, ry * 0.16, 0, 0, TAU2); g.fill();
    }

    // les yeux : deux fentes claires, c'est ce qui fait le monstre
    g.fillStyle = '#ffe9a8';
    const ey = cy - ry * 0.22, ex = rx * 0.34;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * ex, ey, rx * 0.13, ry * 0.10, 0, 0, TAU2); g.fill();
    }
    g.fillStyle = '#20242c';
    for (const s of [-1, 1]) g.fillRect(cx + s * ex - 1, ey - ry * 0.10, 2, ry * 0.20);

    cacheMonde.set(key, cv); return cv;
  }
  function getBossMinion(size, phase) {
    size = Math.max(10, size || 34);
    const ph = Math.round(((phase || 0) * 3) % 3);
    const key = 'bm|' + size + '|' + ph;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const cx = size / 2, cy = size * 0.55;
    softShadow(g, cx, size * 0.86, size * 0.26, size * 0.09, 0.28);
    g.fillStyle = '#3a3448';
    g.beginPath(); g.ellipse(cx, cy, size * 0.28, size * 0.24, 0, 0, TAU2); g.fill();
    g.fillStyle = '#574f6c';
    g.beginPath(); g.ellipse(cx - size * 0.05, cy - size * 0.05, size * 0.22, size * 0.18, 0, 0, TAU2); g.fill();
    g.fillStyle = '#ffe9a8';
    g.fillRect(cx - size * 0.13, cy - size * 0.05, size * 0.09, size * 0.05);
    g.fillRect(cx + size * 0.04, cy - size * 0.05, size * 0.09, size * 0.05);
    cacheMonde.set(key, cv); return cv;
  }
  function getNestCanvas(owner, size) {
    size = size || 72;
    const key = 'nest|' + (owner || 'x') + '|' + size;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const cx = size / 2, sol = size * 0.80;
    softShadow(g, cx, sol + size * 0.06, size * 0.30, size * 0.10, 0.30);
    // brindilles entrelacées
    g.strokeStyle = '#6b5436'; g.lineWidth = Math.max(1, size * 0.035);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * size * 0.30, sol + Math.sin(a) * size * 0.11);
      g.lineTo(cx + Math.cos(a + 1.6) * size * 0.30, sol + Math.sin(a + 1.6) * size * 0.11);
      g.stroke();
    }
    g.fillStyle = '#3a2c1e';
    g.beginPath(); g.ellipse(cx, sol - size * 0.03, size * 0.20, size * 0.07, 0, 0, TAU2); g.fill();
    g.fillStyle = accentDe(owner);
    g.beginPath(); g.ellipse(cx, sol - size * 0.05, size * 0.09, size * 0.06, 0, 0, TAU2); g.fill();
    cacheMonde.set(key, cv); return cv;
  }

  /* ============================================================
     PETITES PIÈCES
     ============================================================ */
  function getMannequinCanvas(tier, size) {
    size = size || 72;
    const key = 'mq|' + (tier | 0) + '|' + size;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const cx = size / 2, sol = size * 0.90, S = size / 72;
    softShadow(g, cx, sol, size * 0.24, size * 0.07, 0.30);
    g.fillStyle = '#5c4128'; g.fillRect(cx - 3 * S, sol - 46 * S, 6 * S, 46 * S);
    g.fillStyle = '#6d5236'; g.fillRect(cx - 22 * S, sol - 36 * S, 44 * S, 5 * S);
    g.fillStyle = '#c9a24a';
    g.beginPath(); g.ellipse(cx, sol - 50 * S, 8 * S, 8 * S, 0, 0, TAU2); g.fill();
    g.fillStyle = '#a89060';
    g.fillRect(cx - 12 * S, sol - 42 * S, 24 * S, 22 * S);
    g.fillStyle = rgba('#000000', .2);
    g.fillRect(cx - 12 * S, sol - 30 * S, 24 * S, 10 * S);
    const t = Math.max(0, Math.min(5, tier | 0));
    for (let i = 0; i < t; i++) {
      g.fillStyle = '#8d9199';
      g.fillRect(cx - 10 * S + i * 5 * S, sol - 40 * S, 3 * S, 18 * S);
    }
    cacheMonde.set(key, cv); return cv;
  }

  function getActivityIcon(id, size) {
    size = size || 32;
    const key = 'ai|' + id + '|' + size;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const S = size / 32;
    const teintes = { peche: '#5f9ad0', bois: '#8a6a45', mine: '#8a7a6a', feu: '#ff9a3a',
                      forge: '#8d9199', guerre: '#8c3b34', savoir: '#7f6fc0' };
    const c = teintes[id] || '#8a8272';
    g.fillStyle = SGD.shade(c, -0.35);
    roundRectPath(g, 4 * S, 4 * S, 24 * S, 24 * S, 3 * S); g.fill();
    g.fillStyle = c;
    roundRectPath(g, 6 * S, 6 * S, 20 * S, 20 * S, 2 * S); g.fill();
    g.fillStyle = rgba('#ffffff', .28);
    g.fillRect(6 * S, 6 * S, 20 * S, 3 * S);
    cacheMonde.set(key, cv); return cv;
  }

  function getEmblem(faction, size) {
    size = size || 64;
    const key = 'em|' + faction + '|' + size;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(size, size), g = cv.getContext('2d');
    const acc = accentDe(faction), S = size / 64, cx = size / 2, cy = size / 2;
    // l'écu
    g.fillStyle = SGD.shade(acc, -0.42);
    g.beginPath();
    g.moveTo(cx - 22 * S, cy - 24 * S); g.lineTo(cx + 22 * S, cy - 24 * S);
    g.lineTo(cx + 22 * S, cy + 6 * S); g.quadraticCurveTo(cx, cy + 30 * S, cx - 22 * S, cy + 6 * S);
    g.closePath(); g.fill();
    g.fillStyle = acc;
    g.beginPath();
    g.moveTo(cx - 18 * S, cy - 20 * S); g.lineTo(cx + 18 * S, cy - 20 * S);
    g.lineTo(cx + 18 * S, cy + 4 * S); g.quadraticCurveTo(cx, cy + 24 * S, cx - 18 * S, cy + 4 * S);
    g.closePath(); g.fill();
    g.fillStyle = SGD.shade(acc, 0.42);
    if (faction === 'birds') {
      // une plume
      g.beginPath();
      g.moveTo(cx - 9 * S, cy + 10 * S); g.quadraticCurveTo(cx + 2 * S, cy - 4 * S, cx + 9 * S, cy - 14 * S);
      g.quadraticCurveTo(cx + 5 * S, cy + 2 * S, cx - 5 * S, cy + 12 * S);
      g.closePath(); g.fill();
    } else {
      // une empreinte
      g.beginPath(); g.ellipse(cx, cy + 6 * S, 8 * S, 6 * S, 0, 0, TAU2); g.fill();
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.ellipse(cx + i * 7 * S, cy - 5 * S, 3 * S, 4 * S, 0, 0, TAU2); g.fill();
      }
      g.beginPath(); g.ellipse(cx + 11 * S, cy + 1 * S, 3 * S, 3.4 * S, 0, 0, TAU2); g.fill();
    }
    cacheMonde.set(key, cv); return cv;
  }

  function getFactionBanner(faction, w, h) {
    w = w || 48; h = h || 72;
    const key = 'fb|' + faction + '|' + w + '|' + h;
    if (cacheMonde.has(key)) return cacheMonde.get(key);
    const cv = mk(w, h), g = cv.getContext('2d');
    const acc = accentDe(faction);
    g.fillStyle = acc; g.fillRect(0, 0, w, h - h * 0.18);
    g.fillStyle = rgba('#000000', .20);
    g.fillRect(0, h * 0.5, w, h * 0.32);
    g.fillStyle = acc;
    g.beginPath();
    g.moveTo(0, h - h * 0.18); g.lineTo(w / 2, h - h * 0.32);
    g.lineTo(w, h - h * 0.18); g.lineTo(w, h - h * 0.20); g.lineTo(0, h - h * 0.20);
    g.closePath(); g.fill();
    const em = getEmblem(faction, Math.min(w, h) * 0.7);
    g.drawImage(em, (w - em.width) / 2, h * 0.14);
    cacheMonde.set(key, cv); return cv;
  }

  /* La mascotte : la silhouette du camp, dessinée en direct dans un
     contexte fourni. Sert aux écrans de résultat. */
  function drawMascot(g, faction, x, y, size) {
    size = size || 64;
    const acc = accentDe(faction);
    const S = size / 64;
    g.save(); g.translate(x, y);
    g.fillStyle = SGD.shade(acc, -0.25);
    g.beginPath(); g.ellipse(0, 8 * S, 20 * S, 18 * S, 0, 0, TAU2); g.fill();
    g.fillStyle = acc;
    g.beginPath(); g.ellipse(0, -12 * S, 14 * S, 12 * S, 0, 0, TAU2); g.fill();
    if (faction === 'birds') {
      g.fillStyle = '#e0c463';
      g.beginPath(); g.moveTo(12 * S, -12 * S); g.lineTo(26 * S, -8 * S); g.lineTo(12 * S, -5 * S);
      g.closePath(); g.fill();
    } else {
      g.fillStyle = acc;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 6 * S, -21 * S); g.lineTo(s * 13 * S, -30 * S); g.lineTo(s * 14 * S, -18 * S);
        g.closePath(); g.fill();
      }
    }
    g.fillStyle = '#20242c';
    g.beginPath(); g.ellipse(-5 * S, -13 * S, 2 * S, 3 * S, 0, 0, TAU2); g.fill();
    g.beginPath(); g.ellipse(5 * S, -13 * S, 2 * S, 3 * S, 0, 0, TAU2); g.fill();
    g.restore();
  }
