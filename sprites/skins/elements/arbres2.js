"use strict";
window.LAB_ELEMENTS = window.LAB_ELEMENTS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers self-contained ----------
  var TAU = Math.PI * 2;
  function hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function hex(r,g2,b){function q(v){v=Math.max(0,Math.min(255,Math.round(v)));return(v<16?'0':'')+v.toString(16);}return'#'+q(r)+q(g2)+q(b);}
  function shade(c,k){var a=hx(c);return k>=0?hex(a[0]+(255-a[0])*k,a[1]+(255-a[1])*k,a[2]+(255-a[2])*k):hex(a[0]*(1+k),a[1]*(1+k),a[2]*(1+k));}
  function mix(c1,c2,t){var A=hx(c1),B=hx(c2);return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
  function prng(seed){var a=(seed|0)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function rgba(c, a) { var v = hx(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')'; }

  // ombre portée au sol (dessinée AVANT le corps)
  function ground(g, dx, dy, rx, ry, al) {
    g.fillStyle = 'rgba(20,30,15,' + al + ')';
    g.beginPath(); g.ellipse(dx, dy, rx, ry, 0, 0, TAU); g.fill();
  }

  // sous-chemin organique (SANS beginPath : plusieurs lobes = UN SEUL chemin)
  function lobe(g, cx, cy, rx, ry, n, rnd, jmin, jspan, rot) {
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + (rot || 0), k = jmin + rnd() * jspan;
      var px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }

  // masse continue : lobes [x,y,rx,ry,rot] fusionnés en un chemin, UN dégradé
  function leafMass(g, lobes, rnd, c0, c1, gx, gy, gr) {
    g.beginPath();
    for (var i = 0; i < lobes.length; i++) {
      var L = lobes[i];
      lobe(g, L[0], L[1], L[2], L[3], 9, rnd, 0.84, 0.22, L[4] || 0);
    }
    var cg = g.createRadialGradient(gx, gy, gr * 0.08, 0, gy * 0.4, gr);
    cg.addColorStop(0, c0); cg.addColorStop(1, c1);
    g.fillStyle = cg;
    g.fill();
  }

  // tache radiale très douce SANS bord (modelé du feuillage — à utiliser sous clip)
  function patch(g, x, y, rr, col, al) {
    var pg = g.createRadialGradient(x, y, 0, x, y, rr);
    pg.addColorStop(0, rgba(col, al));
    pg.addColorStop(1, rgba(col, 0));
    g.fillStyle = pg;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }

  // trait quadratique effilé (mèches fluides, pointes fines)
  function taperQ(g, x0, y0, cx, cy, x1, y1, w0, w1, col) {
    g.strokeStyle = col; g.lineCap = 'round';
    var N = 8, px = x0, py = y0;
    for (var i = 1; i <= N; i++) {
      var t = i / N, u = 1 - t;
      var qx = u * u * x0 + 2 * u * t * cx + t * t * x1;
      var qy = u * u * y0 + 2 * u * t * cy + t * t * y1;
      g.lineWidth = Math.max(0.4, w0 + (w1 - w0) * ((i - 0.5) / N));
      g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke();
      px = qx; py = qy;
    }
  }

  function reg(slot, v) { var R = window.LAB_ELEMENTS.variants; (R[slot] = R[slot] || []).push(v); }

  // ============================================================
  // ARBRES v2 — feuillage : masse CONTINUE (un chemin, un dégradé),
  // modelé par taches radiales douces, jamais de cercles visibles.
  // ============================================================

  // ---------- 1. Saule II : dôme retombant + mèches fluides ----------
  reg('tree', { id: 'saule-2', label: 'Saule II', anim: 'mèches balancées en déphasage doux, dôme qui respire à peine',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 1.05, r * 0.55, 0.20);
      // respiration à peine perceptible du dôme (k=1)
      var br = 1 + Math.sin(PH * TAU) * 0.008;
      // dôme retombant CONTINU : calotte + jupe basse fusionnées dans un chemin
      var lobes = [
        [0, -r * 0.18 * br, r * 0.78 * br, r * 0.58 * br, 0.3],
        [-r * 0.1, r * 0.06, r * 0.62 * br, r * 0.42 * br, 1.1],
        [r * 0.14, r * 0.04, r * 0.56 * br, r * 0.4 * br, 2.0]
      ];
      leafMass(g, lobes, rnd, shade('#78a858', 0.3), mix('#588838', '#3e5e28', 0.6),
        -r * 0.25, -r * 0.42, r * 1.05);
      // modelé doux à l'intérieur de la masse
      g.save();
      g.beginPath();
      var rnd2 = prng(seed);          // même séquence -> même chemin pour le clip
      for (var i = 0; i < lobes.length; i++) {
        var L = lobes[i];
        lobe(g, L[0], L[1], L[2], L[3], 9, rnd2, 0.84, 0.22, L[4] || 0);
      }
      g.clip();
      patch(g, -r * 0.28, -r * 0.42, r * 0.55, '#ffffff', 0.22);
      patch(g, r * 0.1, -r * 0.5, r * 0.4, shade('#78a858', 0.4), 0.3);
      patch(g, 0, r * 0.28, r * 0.7, '#3e5e28', 0.35);
      patch(g, -r * 0.45, r * 0.1, r * 0.4, '#3e5e28', 0.22);
      // stries verticales très douces (tombé du feuillage)
      for (i = 0; i < 4; i++) {
        var vx = (rnd() - 0.5) * r * 1.1;
        patch(g, vx, r * (0.05 + rnd() * 0.2), r * 0.16, '#3e5e28', 0.16);
      }
      g.restore();
      // 5-7 mèches FLUIDES qui débordent du dôme, balancement déphasé (k entiers)
      var nm = 5 + ((rnd() * 3) | 0);
      for (i = 0; i < nm; i++) {
        var a = (i / nm - 0.5) * 2.6 + Math.PI / 2 + (rnd() - 0.5) * 0.3; // plutôt vers le bas/les côtés
        var bx = Math.cos(a) * r * 0.5, by = -r * 0.2 + Math.sin(a) * r * 0.38;
        var len = r * (0.55 + rnd() * 0.35);
        var side = Math.cos(a);                          // -1 gauche … +1 droite
        var sway = Math.sin(PH * TAU + i * 1.1) * r * 0.055
                 + Math.sin(PH * TAU * 2 + i * 0.7) * r * 0.02;
        var ex = bx + side * r * 0.3 + sway;
        var ey = by + len;
        var cxp = bx + side * r * 0.34 + sway * 0.45;
        var cyp = by + len * 0.42;
        var col = mix('#78a858', '#3e5e28', 0.2 + rnd() * 0.5);
        taperQ(g, bx, by, cxp, cyp, ex, ey, Math.max(0.8, r * 0.1), Math.max(0.4, r * 0.02), col);
        // rehaut fin sur le haut de la mèche (peint doux)
        taperQ(g, bx - r * 0.02, by - r * 0.02, cxp - r * 0.02, cyp - r * 0.03,
          bx + (ex - bx) * 0.55 - r * 0.02, by + (ey - by) * 0.5,
          Math.max(0.5, r * 0.04), Math.max(0.3, r * 0.015), rgba(shade(col, 0.35), 0.7));
      }
    } });

  // ---------- 2. Feuillu noble : grande canopée moutonnée unie ----------
  reg('tree', { id: 'feuillu-noble', label: 'Feuillu noble', anim: 'canopée qui ondule (skew k=1) + une feuille tombe par cycle',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 1.1, r * 0.55, 0.22);
      // tronc visible en biais sous la canopée
      g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = r * 0.2;
      g.beginPath(); g.moveTo(r * 0.3, r * 0.64); g.quadraticCurveTo(r * 0.14, r * 0.3, r * 0.02, r * 0.0); g.stroke();
      g.strokeStyle = '#6e5434'; g.lineWidth = r * 0.08;
      g.beginPath(); g.moveTo(r * 0.28, r * 0.62); g.quadraticCurveTo(r * 0.16, r * 0.34, r * 0.07, r * 0.06); g.stroke();
      // ondulation de la canopée : skew/scale sinusoïdal k=1, très subtil
      var sw = Math.sin(PH * TAU);
      g.save();
      g.translate(0, -r * 0.18);
      g.transform(1 + sw * 0.015, 0, sw * 0.03, 1 + Math.cos(PH * TAU) * 0.008, 0, 0);
      // 3-4 lobes moutonnés + coeur, TOUS dans le même chemin
      var nl = 3 + ((rnd() * 2) | 0);
      var lobes = [[0, -r * 0.02, r * 0.58, r * 0.46, 0.5]];
      for (var i = 0; i < nl; i++) {
        var a = Math.PI + (i + 0.5) / nl * Math.PI + (rnd() - 0.5) * 0.3; // arc supérieur
        lobes.push([Math.cos(a) * r * 0.46, -r * 0.02 + Math.sin(a) * r * 0.36,
          r * (0.36 + rnd() * 0.14), r * (0.3 + rnd() * 0.1), rnd() * TAU]);
      }
      leafMass(g, lobes, rnd, shade('#78a858', 0.26), '#3e5e28', -r * 0.3, -r * 0.5, r * 1.1);
      // modelé : 2 trouées de lumière douces + ombres de masse
      g.save();
      g.beginPath();
      var rnd2 = prng(seed);
      // realigne la séquence du clip : nl + 4 tirages par lobe construit (a, rx, ry, rot)
      rnd2();
      for (i = 0; i < nl * 4; i++) rnd2();
      for (i = 0; i < lobes.length; i++) {
        var L = lobes[i];
        lobe(g, L[0], L[1], L[2], L[3], 9, rnd2, 0.84, 0.22, L[4] || 0);
      }
      g.clip();
      patch(g, -r * 0.3 + rnd() * r * 0.1, -r * 0.38, r * 0.42, shade('#78a858', 0.55), 0.45); // trouée 1
      patch(g, r * 0.24, -r * 0.14, r * 0.32, shade('#78a858', 0.5), 0.38);                    // trouée 2
      patch(g, -r * 0.32, -r * 0.42, r * 0.3, '#ffffff', 0.2);
      patch(g, r * 0.05, r * 0.3, r * 0.6, '#3e5e28', 0.35);
      patch(g, r * 0.45, r * 0.05, r * 0.35, '#3e5e28', 0.22);
      g.restore();
      g.restore();
      // une feuille tombe par cycle (fondu aux deux extrémités)
      var t = PH;
      var sx = (rnd() - 0.5) * r * 0.7, sy = -r * 0.28;
      var lx = sx + Math.sin(t * TAU * 2) * r * 0.12 * (0.3 + t);
      var ly = sy + t * r * 1.15;
      var al = t < 0.15 ? t / 0.15 : (t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1);
      if (al > 0) {
        g.globalAlpha = al * 0.9;
        g.fillStyle = mix('#78a858', '#f2d24e', 0.35);
        g.save();
        g.translate(lx, ly); g.rotate(t * TAU * 2 + 1);
        g.beginPath(); g.ellipse(0, 0, r * 0.07, r * 0.035, 0, 0, TAU); g.fill();
        g.restore();
        g.globalAlpha = 1;
      }
    } });

  // ---------- 3. Pommier : canopée unie + pommes intégrées ----------
  reg('tree', { id: 'pommier', label: 'Pommier', anim: 'une pomme se décroche, tombe et disparaît en fondu (une par cycle)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 0.95, r * 0.5, 0.20);
      // tronc court
      g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = r * 0.16;
      g.beginPath(); g.moveTo(-r * 0.06, r * 0.56); g.quadraticCurveTo(-r * 0.01, r * 0.3, r * 0.02, r * 0.04); g.stroke();
      g.strokeStyle = '#6e5434'; g.lineWidth = r * 0.06;
      g.beginPath(); g.moveTo(-r * 0.05, r * 0.54); g.quadraticCurveTo(r * 0.01, r * 0.32, r * 0.05, r * 0.1); g.stroke();
      // respiration minuscule (k=1)
      var br = 1 + Math.sin(PH * TAU) * 0.007;
      // canopée unie plus petite : 3 lobes fusionnés en un chemin
      var lobes = [
        [0, -r * 0.2 * br, r * 0.58 * br, r * 0.48 * br, 0.4],
        [-r * 0.3, -r * 0.08, r * 0.4 * br, r * 0.33 * br, 1.4],
        [r * 0.32, -r * 0.1, r * 0.38 * br, r * 0.31 * br, 2.6]
      ];
      leafMass(g, lobes, rnd, shade('#78a858', 0.3), mix('#588838', '#3e5e28', 0.55),
        -r * 0.26, -r * 0.42, r * 0.95);
      // clip : modelé + pommes DANS la masse
      g.save();
      g.beginPath();
      var rnd2 = prng(seed);
      for (var i = 0; i < lobes.length; i++) {
        var L = lobes[i];
        lobe(g, L[0], L[1], L[2], L[3], 9, rnd2, 0.84, 0.22, L[4] || 0);
      }
      g.clip();
      patch(g, -r * 0.26, -r * 0.42, r * 0.38, '#ffffff', 0.2);
      patch(g, 0, r * 0.16, r * 0.55, '#3e5e28', 0.32);
      // 4-6 pommes selon seed, bien intégrées
      var na = 4 + ((rnd() * 3) | 0);
      for (i = 0; i < na; i++) {
        var ax = (rnd() - 0.5) * r * 1.05, ay = -r * 0.18 + (rnd() - 0.45) * r * 0.62;
        var ra = r * (0.07 + rnd() * 0.025);
        // creux d'ombre feuillue derrière la pomme (elle niche dans la masse)
        patch(g, ax, ay, ra * 2.2, '#3e5e28', 0.4);
        var ag = g.createRadialGradient(ax - ra * 0.35, ay - ra * 0.4, ra * 0.1, ax, ay, ra * 1.05);
        ag.addColorStop(0, '#e86858'); ag.addColorStop(1, '#a02c28');
        g.fillStyle = ag;
        g.beginPath(); g.arc(ax, ay, ra, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.3)';
        g.beginPath(); g.ellipse(ax - ra * 0.3, ay - ra * 0.35, ra * 0.3, ra * 0.18, -0.5, 0, TAU); g.fill();
        // le feuillage remonte doucement sur le haut de la pomme
        patch(g, ax + ra * 0.2, ay - ra * 1.1, ra * 1.3, '#588838', 0.5);
      }
      g.restore();
      // une pomme se décroche et tombe (fondu apparition/disparition)
      var t = PH;
      var fx = (rnd() - 0.5) * r * 0.6;
      var fy = -r * 0.12 + t * t * r * 1.05;             // chute accélérée
      var fa = t < 0.1 ? t / 0.1 : (t > 0.78 ? Math.max(0, (1 - t) / 0.22) : 1);
      if (fa > 0) {
        var ra2 = r * 0.075;
        g.globalAlpha = fa * 0.95;
        var fg = g.createRadialGradient(fx - ra2 * 0.35, fy - ra2 * 0.4, ra2 * 0.1, fx, fy, ra2 * 1.05);
        fg.addColorStop(0, '#e86858'); fg.addColorStop(1, '#a02c28');
        g.fillStyle = fg;
        g.beginPath(); g.arc(fx + Math.sin(t * TAU) * r * 0.02, fy, ra2, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.3)';
        g.beginPath(); g.arc(fx - ra2 * 0.3, fy - ra2 * 0.3, ra2 * 0.22, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
    } });

  // ---------- 4. Bosquet : couronnes fusionnées, troncs multiples ----------
  reg('tree', { id: 'bosquet', label: 'Bosquet', anim: 'respiration légère déphasée entre les masses (k=1 et k=2)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 1.15, r * 0.52, 0.22);
      // 2-3 couronnes de tailles différentes
      var nmass = 2 + ((rnd() * 2) | 0);
      var mx = [], my = [], mr = [], rot = [];
      for (var i = 0; i < nmass; i++) {
        mx.push((i - (nmass - 1) / 2) * r * 0.56 + (rnd() - 0.5) * r * 0.12);
        my.push(-r * (0.14 + rnd() * 0.16));
        mr.push(r * (0.38 + rnd() * 0.22));
        rot.push(rnd() * TAU);
      }
      // troncs multiples visibles dessous (dessinés AVANT la masse)
      for (i = 0; i < nmass; i++) {
        g.strokeStyle = (i % 2) ? '#6e5434' : '#8a6a44';
        g.lineCap = 'round'; g.lineWidth = r * (0.1 + (mr[i] / r) * 0.1);
        var tx = mx[i] + (rnd() - 0.5) * r * 0.12;
        g.beginPath();
        g.moveTo(tx + r * 0.05, r * 0.55);
        g.quadraticCurveTo(tx + r * 0.02, r * 0.25, mx[i], my[i] + mr[i] * 0.3);
        g.stroke();
      }
      // respiration déphasée : masses paires k=1, impaires k=2 (entiers)
      var lobes = [];
      for (i = 0; i < nmass; i++) {
        var kk = (i % 2) ? 2 : 1;
        var b = 1 + Math.sin(PH * TAU * kk + i * 2.1) * 0.016;
        lobes.push([mx[i], my[i], mr[i] * b, mr[i] * 0.82 * b, rot[i]]);
      }
      // liaison centrale pour garantir la fusion en une seule masse
      if (nmass > 1) lobes.push([(mx[0] + mx[nmass - 1]) / 2, -r * 0.16, r * 0.34, r * 0.26, 0.8]);
      leafMass(g, lobes, rnd, shade('#78a858', 0.28), '#3e5e28', -r * 0.3, -r * 0.45, r * 1.15);
      // modelé doux par masse
      g.save();
      g.beginPath();
      var rnd2 = prng(seed);
      // realigne la séquence : consomme les tirages faits avant la construction des lobes
      rnd2();                                            // nmass
      for (i = 0; i < nmass; i++) { rnd2(); rnd2(); rnd2(); rnd2(); }  // mx,my,mr,rot
      for (i = 0; i < nmass; i++) rnd2();                // tx des troncs
      for (i = 0; i < lobes.length; i++) {
        var L = lobes[i];
        lobe(g, L[0], L[1], L[2], L[3], 9, rnd2, 0.84, 0.22, L[4] || 0);
      }
      g.clip();
      for (i = 0; i < nmass; i++) {
        patch(g, mx[i] - mr[i] * 0.3, my[i] - mr[i] * 0.4, mr[i] * 0.6, shade('#78a858', 0.42), 0.4);
        patch(g, mx[i] + mr[i] * 0.1, my[i] + mr[i] * 0.5, mr[i] * 0.75, '#3e5e28', 0.35);
      }
      // rehaut blanc doux sur la plus grande masse
      var big = 0;
      for (i = 1; i < nmass; i++) if (mr[i] > mr[big]) big = i;
      patch(g, mx[big] - mr[big] * 0.32, my[big] - mr[big] * 0.45, mr[big] * 0.45, '#ffffff', 0.22);
      // creux d'ombre aux jonctions entre masses
      for (i = 0; i + 1 < nmass; i++) {
        patch(g, (mx[i] + mx[i + 1]) / 2, (my[i] + my[i + 1]) / 2 + r * 0.08, r * 0.22, '#3e5e28', 0.28);
      }
      g.restore();
    } });
})();
