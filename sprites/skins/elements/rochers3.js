"use strict";
/* ============================================================
   LAB — rochers3.js (SÉRIE 3)
   4 rochers vus de dessus pour le slot 'rock' :
   - r3-base-v2 : le rocher ACTUEL du jeu (getObstacleCanvas de
     sprites-world.js : 3 blocs de granit, polygones à 8 pans,
     dégradé diagonal, reflet haut-gauche) fidèlement repris et
     fini — facettes ombrées, fissures, mousse, herbe animée.
   - r3-erratique-quartz : bloc anguleux, veines de quartz qui
     scintillent en déphasage.
   - r3-siege-poli : rocher-assise poli, papillon qui tournoie.
   - r3-eboulis-lezard : croissant d'éboulis, lézard curieux en
     cycle fondu aux deux bouts.
   Boucle d'anim exacte de 3.2 s, la roche reste immobile.
   Self-contained : ne touche qu'à window.LAB_ELEMENTS.
   ============================================================ */
window.LAB_ELEMENTS = window.LAB_ELEMENTS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers self-contained (copiés de serie2-casernes.js) ----------
  var TAU = Math.PI * 2;
  function hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function hex(r,g2,b){function q(v){v=Math.max(0,Math.min(255,Math.round(v)));return(v<16?'0':'')+v.toString(16);}return'#'+q(r)+q(g2)+q(b);}
  function shade(c,k){var a=hx(c);return k>=0?hex(a[0]+(255-a[0])*k,a[1]+(255-a[1])*k,a[2]+(255-a[2])*k):hex(a[0]*(1+k),a[1]*(1+k),a[2]*(1+k));}
  function mix(c1,c2,t){var A=hx(c1),B=hx(c2);return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
  function prng(seed){var a=(seed|0)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  // ombre au sol : ellipse sombre translucide décalée (+3k, +4k), AVANT le corps
  function ground(g, dx, dy, rx, ry, al) {
    g.fillStyle = 'rgba(20,30,15,' + al + ')';
    g.beginPath(); g.ellipse(dx, dy, rx, ry, 0, 0, TAU); g.fill();
  }
  // rehaut clair doux (ellipse inclinée)
  function sheen(g, x, y, rx, ry, al, rot) {
    g.fillStyle = 'rgba(255,255,255,' + al + ')';
    g.beginPath(); g.ellipse(x, y, rx, ry, rot === undefined ? -0.4 : rot, 0, TAU); g.fill();
  }
  // trait effilé (fissures, brindilles)
  function taper(g, pts, w0, w1, col) {
    g.strokeStyle = col; g.lineCap = 'round';
    for (var i = 0; i < pts.length - 1; i++) {
      g.lineWidth = w0 + (w1 - w0) * (i / (pts.length - 1));
      g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
    }
  }
  // brin d'herbe qui peut osciller (sway = décalage horizontal de la pointe)
  function blade(g, x, y, dx, h, w, col, sway) {
    sway = sway || 0;
    g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + dx * 0.35 + sway * 0.4, y - h * 0.6, x + dx + sway, y - h);
    g.stroke();
  }
  // polygone irrégulier "à pans" — MÊME formule que le rocher du jeu
  // (sprites-world.js getObstacleCanvas) : 8 pans, a = i/8*TAU + .3,
  // rayon 0.78..1.08, léger soulèvement -ry*0.2. Retourne les sommets.
  function pans(cx, cy, rx, ry, rnd) {
    var pts = [];
    for (var i = 0; i <= 8; i++) {
      var a = i / 8 * TAU + 0.3, kk = 0.78 + rnd() * 0.3;
      pts.push([cx + Math.cos(a) * rx * kk, cy + Math.sin(a) * ry * kk - ry * 0.2]);
    }
    return pts;
  }
  function path(g, pts) {
    g.beginPath();
    for (var i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  // silhouette lisse (sommets reliés par quadratiques via les milieux)
  function smoothBlob(g, cx, cy, rx, ry, n, rnd, jmin, jspan, rot) {
    var pts = [], i;
    for (i = 0; i < n; i++) {
      var a = i / n * TAU + (rot || 0), k = jmin + rnd() * jspan;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    g.beginPath();
    g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.closePath();
  }
  // point interpolé le long d'une polyligne (t dans 0..1)
  function alongPts(pts, t) {
    var f = t * (pts.length - 1), i = Math.min(pts.length - 2, f | 0), u = f - i;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u];
  }
  function reg(slot, v) { var R = window.LAB_ELEMENTS.variants; (R[slot] = R[slot] || []).push(v); }

  // teintes granit du jeu
  var GLITE = '#b2aea2', GDARK = '#6e6a60';

  // ============================================================
  // 1. Rocher v2 — la silhouette ACTUELLE du jeu, finie avec soin.
  //    Roche immobile ; seuls les brins d'herbe au pied respirent.
  // ============================================================
  reg('rock', { id: 'r3-base-v2', label: 'Rocher v2 (base animée)',
    anim: 'roche immobile ; 3 brins d\'herbe oscillent (sin k=1, déphasés)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12, i;
      ground(g, 3 * k, 4 * k, r * 1.08, r * 0.5, 0.24);

      // --- les 3 blocs du jeu : principal + 2 petits devant ---
      // (proportions reprises de getObstacleCanvas : [60,60,33,25],
      //  [37..45,74,18,13], [78..84,76,15,11] sur canvas 120)
      var blocks = [
        [0, -r * 0.02, r * 0.92, r * 0.7],
        [-r * (0.5 + rnd() * 0.13), r * 0.4, r * 0.46, r * 0.33],
        [r * (0.58 + rnd() * 0.1), r * 0.44, r * 0.38, r * 0.28]
      ];
      var mainPts = null;
      for (var b = 0; b < blocks.length; b++) {
        var B = blocks[b];
        // ombre de contact : les petits blocs assombrissent le pied du grand
        if (b > 0) {
          g.fillStyle = 'rgba(30,28,24,0.16)';
          g.beginPath(); g.ellipse(B[0], B[1] - B[3] * 0.35, B[2] * 1.05, B[3] * 0.8, 0, 0, TAU); g.fill();
        }
        var pts = pans(B[0], B[1], B[2], B[3], rnd);
        if (b === 0) mainPts = pts;
        // dégradé diagonal gris — identique au jeu
        var gd = g.createLinearGradient(B[0] - B[2], B[1] - B[3], B[0] + B[2], B[1] + B[3]);
        gd.addColorStop(0, GLITE); gd.addColorStop(1, GDARK);
        g.fillStyle = gd;
        path(g, pts); g.fill();

        // facettes ombrées distinctes : un triangle par pan, teinté
        // selon l'orientation face à la lumière (haut-gauche)
        var cxm = 0, cym = 0, n = pts.length - 1;
        for (i = 0; i < n; i++) { cxm += pts[i][0]; cym += pts[i][1]; }
        cxm /= n; cym /= n;
        for (i = 0; i < n; i++) {
          var p = pts[i], q = pts[i + 1];
          var mx = (p[0] + q[0]) / 2 - cxm, my = (p[1] + q[1]) / 2 - cym;
          var d = (mx * -0.6 + my * -0.8) / Math.max(1, B[2]);   // -1..1 : face à la lumière ?
          g.fillStyle = d > 0
            ? 'rgba(255,255,255,' + (0.035 + 0.085 * Math.min(1, d)) + ')'
            : 'rgba(28,26,22,' + (0.03 + 0.09 * Math.min(1, -d)) + ')';
          g.beginPath(); g.moveTo(cxm, cym); g.lineTo(p[0], p[1]); g.lineTo(q[0], q[1]);
          g.closePath(); g.fill();
        }
      }

      // --- fissures fines (comme le jeu, en plus soigné) ---
      var fx = (rnd() - 0.5) * r * 0.5, fy = -r * 0.45 + rnd() * r * 0.2;
      taper(g, [[fx, fy],
                [fx + (rnd() - 0.5) * r * 0.24, fy + r * 0.34],
                [fx + (rnd() - 0.5) * r * 0.3, fy + r * 0.66]],
        Math.max(0.8, r * 0.1), Math.max(0.4, r * 0.03), 'rgba(30,28,24,.34)');
      var f2 = fx + r * 0.12;
      taper(g, [[f2, fy + r * 0.3], [f2 + r * 0.26, fy + r * 0.42]],
        Math.max(0.5, r * 0.05), Math.max(0.3, r * 0.02), 'rgba(30,28,24,.24)');

      // --- reflet clair haut-gauche (position du jeu : 49,45 sur 120) ---
      sheen(g, -r * 0.22, -r * 0.3, r * 0.24, r * 0.12, 0.25);
      // liseré lumineux discret sur l'arête haute du bloc principal
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineCap = 'round';
      g.lineWidth = Math.max(0.7, r * 0.06);
      g.beginPath();
      g.moveTo(mainPts[5][0], mainPts[5][1]);
      g.quadraticCurveTo((mainPts[5][0] + mainPts[6][0]) / 2, mainPts[6][1] - r * 0.04,
                         mainPts[6][0], mainPts[6][1]);
      g.stroke();

      // --- mousse au pied (2 plaques comme le jeu + petits points) ---
      g.fillStyle = 'rgba(122,160,90,.7)';
      g.beginPath(); g.ellipse(-r * (0.15 + rnd() * 0.15), r * 0.62, r * 0.2, r * 0.085, 0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(r * 0.35, r * 0.66, r * 0.15, r * 0.07, -0.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(160,196,120,.5)';
      for (i = 0; i < 3; i++) {
        g.beginPath();
        g.arc((rnd() - 0.4) * r * 0.8, r * (0.56 + rnd() * 0.12), Math.max(0.5, r * 0.03), 0, TAU);
        g.fill();
      }

      // --- accent de vie : 3 brins d'herbe qui oscillent doucement ---
      for (i = 0; i < 3; i++) {
        var bx = (rnd() - 0.5) * r * 1.65, by = r * (0.55 + rnd() * 0.18);
        var dx = (rnd() - 0.5) * r * 0.26, h = r * (0.3 + rnd() * 0.22);
        var ph = rnd();                                    // déphasage par brin
        var sway = Math.sin(PH * TAU + ph * TAU) * r * 0.05;   // k=1 : boucle parfaite
        blade(g, bx, by, dx, h, Math.max(0.6, r * (0.05 + rnd() * 0.03)),
          i % 2 ? '#78a858' : '#588838', sway);
      }
    } });

  // ============================================================
  // 2. Bloc erratique à veines de quartz — anguleux, minéral,
  //    les veines blanches scintillent en déphasage.
  // ============================================================
  reg('rock', { id: 'r3-erratique-quartz', label: 'Erratique à quartz',
    anim: 'étoiles de quartz qui scintillent en déphasage (sin k=1)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12, i;
      ground(g, 3 * k, 4 * k, r * 1.02, r * 0.5, 0.24);

      // silhouette anguleuse : 7 pans francs, gris plus froid
      var n = 7, pts = [];
      for (i = 0; i <= n; i++) {
        var a = i / n * TAU + 0.5, kk = 0.8 + rnd() * 0.32;
        pts.push([Math.cos(a) * r * 0.95 * kk, Math.sin(a) * r * 0.74 * kk - r * 0.12]);
      }
      function bloc() { path(g, pts); }
      var gd = g.createLinearGradient(-r * 0.9, -r * 0.9, r * 0.75, r * 0.7);
      gd.addColorStop(0, '#a4a09a'); gd.addColorStop(1, '#5e5a52');
      g.fillStyle = gd;
      bloc(); g.fill();

      // facette sommitale en biseau : le même contour, réduit et
      // décalé vers la lumière — donne le volume du bloc
      g.fillStyle = shade('#a4a09a', 0.13);
      g.beginPath();
      for (i = 0; i < pts.length; i++) {
        var px = pts[i][0] * 0.6 - r * 0.1, py = pts[i][1] * 0.52 - r * 0.17;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
      // ombrage interne du flanc bas-droit (petite ombre portée interne)
      g.save();
      bloc(); g.clip();
      g.fillStyle = 'rgba(26,24,20,0.18)';
      g.beginPath(); g.ellipse(r * 0.42, r * 0.42, r * 0.85, r * 0.5, 0.3, 0, TAU); g.fill();

      // --- veines de quartz : sillon sombre + fil blanc, clippées ---
      var veins = [], nv = 2 + ((rnd() * 2) | 0);              // 2-3 veines
      for (var v = 0; v < nv; v++) {
        var vx = -r * (0.75 - v * 0.28) + (rnd() - 0.5) * r * 0.16;
        var vp = [[vx, -r * (0.66 + rnd() * 0.12)]];
        for (i = 1; i <= 4; i++)
          vp.push([vx + i * r * 0.22 + (rnd() - 0.5) * r * 0.14,
                   -r * 0.66 + i * r * 0.32 + (rnd() - 0.5) * r * 0.1]);
        veins.push(vp);
        // sillon (ombre du creux) légèrement décalé
        g.strokeStyle = 'rgba(30,28,24,0.3)'; g.lineCap = 'round';
        g.lineWidth = Math.max(1, r * 0.09);
        g.beginPath();
        for (i = 0; i < vp.length; i++)
          i ? g.lineTo(vp[i][0] + r * 0.03, vp[i][1] + r * 0.04) : g.moveTo(vp[i][0] + r * 0.03, vp[i][1] + r * 0.04);
        g.stroke();
        // fil de quartz, luminosité qui respire doucement (k=1)
        var glow = 0.42 + 0.14 * Math.sin((PH + v * 0.33) * TAU);
        g.strokeStyle = 'rgba(244,247,252,' + glow + ')';
        g.lineWidth = Math.max(0.7, r * 0.055);
        g.beginPath();
        for (i = 0; i < vp.length; i++) i ? g.lineTo(vp[i][0], vp[i][1]) : g.moveTo(vp[i][0], vp[i][1]);
        g.stroke();
      }
      g.restore();

      // --- étoiles de quartz : scintillement déphasé, alpha
      //     proportionnel à tw -> fondu complet aux deux bouts,
      //     aucun pop possible (le seuil 0.03 coupe à alpha ~0.02) ---
      for (i = 0; i < 4; i++) {
        var vp2 = veins[i % veins.length];
        var sp = alongPts(vp2, 0.2 + (i * 0.83) % 0.62 + rnd() * 0.1);
        var tw = 0.5 + 0.5 * Math.sin((PH + rnd()) * TAU);     // k=1, déphasé
        if (tw < 0.03) continue;
        var ss = r * (0.07 + 0.09 * tw);
        g.strokeStyle = 'rgba(255,255,255,' + (0.8 * tw) + ')';
        g.lineCap = 'round'; g.lineWidth = Math.max(0.5, r * 0.035);
        g.beginPath();
        g.moveTo(sp[0] - ss, sp[1]); g.lineTo(sp[0] + ss, sp[1]);
        g.moveTo(sp[0], sp[1] - ss); g.lineTo(sp[0], sp[1] + ss);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,' + (0.85 * tw) + ')';
        g.beginPath(); g.arc(sp[0], sp[1], Math.max(0.5, ss * 0.22), 0, TAU); g.fill();
      }

      // lichen ocre discret + éclats au pied
      g.fillStyle = 'rgba(179,150,105,.45)';
      g.beginPath(); g.ellipse(r * 0.4, -r * 0.05, r * 0.16, r * 0.09, 0.5, 0, TAU); g.fill();
      for (i = 0; i < 3; i++) {
        var ex = (rnd() - 0.5) * r * 1.7, ey = r * (0.56 + rnd() * 0.2), es = r * (0.08 + rnd() * 0.08);
        g.fillStyle = mix('#a4a09a', '#5e5a52', 0.3 + rnd() * 0.4);
        g.beginPath();
        g.moveTo(ex - es, ey + es * 0.5); g.lineTo(ex + (rnd() - 0.5) * es, ey - es);
        g.lineTo(ex + es, ey + es * 0.5);
        g.closePath(); g.fill();
      }
    } });

  // ============================================================
  // 3. Rocher-siège poli — assise plate satinée ; un papillon
  //    tournoie paresseusement au-dessus (boucle cos/sin k=1).
  // ============================================================
  reg('rock', { id: 'r3-siege-poli', label: 'Rocher-siège poli',
    anim: 'papillon qui tournoie au-dessus (cos/sin k=1, ailes k=8)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12, i;
      ground(g, 3 * k, 4 * k, r * 0.98, r * 0.46, 0.22);

      var warm = mix(GLITE, '#b3a48e', 0.35);                  // granit chaud patiné
      // corps trapu, silhouette lisse (galet assis)
      var gd = g.createLinearGradient(-r * 0.8, -r * 0.9, r * 0.6, r * 0.7);
      gd.addColorStop(0, warm); gd.addColorStop(1, mix(GDARK, '#5e564a', 0.5));
      g.fillStyle = gd;
      smoothBlob(g, 0, r * 0.02, r * 0.92, r * 0.64, 8, prng((seed | 0) + 5), 0.9, 0.14, 0.4);
      g.fill();

      // assise : ellipse plate, dégradé radial satiné décalé haut-gauche
      var topY = -r * 0.3, trx = r * 0.74, trY = r * 0.36;
      // liseré d'ombre sous le rebord (petite ombre portée interne)
      g.fillStyle = 'rgba(30,26,20,0.22)';
      g.beginPath(); g.ellipse(0, topY + r * 0.05, trx * 1.02, trY * 1.02, 0, 0, TAU); g.fill();
      var tg = g.createRadialGradient(-trx * 0.35, topY - trY * 0.3, r * 0.06, 0, topY, trx * 1.15);
      tg.addColorStop(0, shade(warm, 0.24));
      tg.addColorStop(0.7, warm);
      tg.addColorStop(1, mix(warm, GDARK, 0.55));
      g.fillStyle = tg;
      g.beginPath(); g.ellipse(0, topY, trx, trY, 0, 0, TAU); g.fill();

      // creux d'usure au centre de l'assise (des générations de fesses)
      g.fillStyle = 'rgba(90,80,66,0.14)';
      g.beginPath(); g.ellipse(r * 0.05, topY + r * 0.03, r * 0.34, r * 0.16, 0.1, 0, TAU); g.fill();
      // satin : deux arcs doux qui suivent le rebord poli
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = Math.max(1, r * 0.09);
      g.beginPath(); g.arc(0, topY, trx * 0.76, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = Math.max(0.6, r * 0.05);
      g.beginPath(); g.arc(r * 0.04, topY + r * 0.02, trx * 0.55, Math.PI * 1.15, Math.PI * 1.5); g.stroke();

      // couture minérale sur le flanc + 2 brins d'herbe au pied
      taper(g, [[-r * 0.72, r * 0.14], [-r * 0.58, r * 0.34], [-r * 0.5, r * 0.5]],
        Math.max(0.6, r * 0.05), Math.max(0.3, r * 0.02), 'rgba(30,28,24,.3)');
      blade(g, -r * (0.7 + rnd() * 0.2), r * 0.52, -r * 0.12, r * (0.3 + rnd() * 0.14),
        Math.max(0.6, r * 0.06), '#588838', 0);
      blade(g, r * (0.72 + rnd() * 0.15), r * 0.5, r * 0.14, r * (0.26 + rnd() * 0.12),
        Math.max(0.5, r * 0.05), '#78a858', 0);

      // --- papillon : orbite elliptique k=1 (boucle parfaite),
      //     petit bob k=2, battement d'ailes k=8 ---
      var A = PH * TAU + rnd() * TAU;                          // départ propre à l'instance
      var brx = r * 0.52, bry = r * 0.2;
      var bx = Math.cos(A) * brx, by = topY - r * 0.28 + Math.sin(A) * bry
             + Math.sin(PH * TAU * 2) * r * 0.04;
      // ombre volante minuscule sur l'assise
      g.fillStyle = 'rgba(20,30,15,0.12)';
      g.beginPath(); g.ellipse(bx * 0.9, topY + r * 0.04, r * 0.08, r * 0.035, 0, 0, TAU); g.fill();
      // orientation : tangente de l'orbite
      var rotB = Math.atan2(Math.cos(A) * bry, -Math.sin(A) * brx);
      var flap = 0.3 + 0.7 * Math.abs(Math.sin(PH * TAU * 8)); // k=8, boucle
      var bs = r * 0.13;                                       // échelle papillon
      var wing = rnd() < 0.5 ? '#f0a43c' : '#f093a4';          // orangé ou rose selon l'instance
      g.save();
      g.translate(bx, by); g.rotate(rotB);
      g.fillStyle = wing;
      g.beginPath(); g.ellipse(-bs * 0.15, -bs * 0.55 * flap, bs * 0.42, bs * 0.62 * flap, -0.25, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(-bs * 0.15, bs * 0.55 * flap, bs * 0.42, bs * 0.62 * flap, 0.25, 0, TAU); g.fill();
      g.fillStyle = shade(wing, 0.35);
      g.beginPath(); g.ellipse(-bs * 0.2, -bs * 0.4 * flap, bs * 0.16, bs * 0.24 * flap, -0.25, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(-bs * 0.2, bs * 0.4 * flap, bs * 0.16, bs * 0.24 * flap, 0.25, 0, TAU); g.fill();
      g.fillStyle = '#4a4038';                                 // petit corps
      g.beginPath(); g.ellipse(bs * 0.1, 0, bs * 0.34, bs * 0.1, 0, 0, TAU); g.fill();
      g.restore();
    } });

  // ============================================================
  // 4. Éboulis en arc — croissant de pierres roulées ; un lézard
  //    pointe le museau entre deux pierres puis se retire
  //    (fondu aux DEUX bouts du cycle : invisible à PH=0).
  // ============================================================
  reg('rock', { id: 'r3-eboulis-lezard', label: 'Éboulis au lézard',
    anim: 'lézard qui pointe puis se retire (cycle fondu aux deux bouts)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12, i;
      ground(g, 3 * k, 4 * k, r * 1.12, r * 0.55, 0.2);

      // lit de terre sablonneuse sous l'arc
      g.fillStyle = 'rgba(203,186,140,0.32)';
      smoothBlob(g, 0, r * 0.05, r * 1.05, r * 0.62, 8, prng((seed | 0) + 3), 0.85, 0.2, 0.7);
      g.fill();

      // --- croissant de 6 pierres, grosses au centre de l'arc ---
      var a0 = 2.2 + (rnd() - 0.5) * 0.5;                      // ouverture de l'arc (bas-droit libre)
      var span = 3.4, ns = 6, stones = [], s;
      for (i = 0; i < ns; i++) {
        var t = i / (ns - 1);
        var a = a0 + t * span;
        var mid = Math.sin(t * Math.PI);                       // 0 aux bouts, 1 au centre
        stones.push({
          x: Math.cos(a) * r * 0.62 + (rnd() - 0.5) * r * 0.1,
          y: Math.sin(a) * r * 0.44 + (rnd() - 0.5) * r * 0.08,
          s: r * (0.2 + 0.17 * mid + rnd() * 0.05),
          rot: rnd() * TAU,
          warmth: rnd() * 0.45
        });
      }
      stones.sort(function (p, q) { return p.y - q.y; });      // fond d'abord

      // la niche du lézard : entre les 2 pierres les plus grosses
      var big = stones.slice().sort(function (p, q) { return q.s - p.s; });
      var gapX = (big[0].x + big[1].x) / 2, gapY = (big[0].y + big[1].y) / 2;
      var gapA = Math.atan2(gapY * 0.6, gapX) ;                // il sort vers l'extérieur de l'arc

      // pierres derrière le lézard (y plus petit que la niche)
      function drawStone(S) {
        var tint = mix(GLITE, '#b3a48e', S.warmth);
        var gd = g.createLinearGradient(S.x - S.s, S.y - S.s, S.x + S.s, S.y + S.s);
        gd.addColorStop(0, shade(tint, 0.1)); gd.addColorStop(1, mix(tint, GDARK, 0.7));
        g.fillStyle = gd;
        smoothBlob(g, S.x, S.y, S.s, S.s * 0.8, 7, prng((S.x * 31 + S.y * 17) | 0), 0.84, 0.24, S.rot);
        g.fill();
        sheen(g, S.x - S.s * 0.28, S.y - S.s * 0.32, S.s * 0.3, S.s * 0.15, 0.2);
      }
      for (i = 0; i < ns; i++) if (stones[i].y <= gapY) drawStone(stones[i]);

      // --- le lézard : bell(u) vaut 0 aux deux extrémités du cycle ->
      //     alpha ET sortie passent par 0, aucun saut à la boucle,
      //     et à animT=0 la scène est propre (pas de lézard) ---
      var u = PH, bell = 0;
      if (u > 0.3 && u < 0.85) bell = Math.sin((u - 0.3) / 0.55 * Math.PI);
      if (bell > 0.01) {
        var out = bell * r * 0.26;                             // distance de sortie
        g.save();
        g.globalAlpha = Math.min(1, bell * 1.6) * bell;        // fondu doux
        g.translate(gapX, gapY);
        g.rotate(gapA + Math.sin(PH * TAU * 2) * 0.05 * bell); // le museau balaie un peu
        g.translate(out, 0);
        var ls = r * 0.3;                                      // échelle lézard
        // corps effilé (l'arrière reste caché derrière la pierre)
        var lg = g.createLinearGradient(-ls, 0, ls * 0.6, 0);
        lg.addColorStop(0, '#6d9440'); lg.addColorStop(1, '#8bb054');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(-ls * 0.9, -ls * 0.16);
        g.quadraticCurveTo(ls * 0.15, -ls * 0.24, ls * 0.42, -ls * 0.12);
        g.quadraticCurveTo(ls * 0.62, 0, ls * 0.42, ls * 0.12);
        g.quadraticCurveTo(ls * 0.15, ls * 0.24, -ls * 0.9, ls * 0.16);
        g.closePath(); g.fill();
        // rayure dorsale + pattes avant
        g.strokeStyle = 'rgba(60,86,34,0.7)'; g.lineCap = 'round';
        g.lineWidth = Math.max(0.5, ls * 0.09);
        g.beginPath(); g.moveTo(-ls * 0.8, 0); g.quadraticCurveTo(0, -ls * 0.04, ls * 0.4, 0); g.stroke();
        g.lineWidth = Math.max(0.5, ls * 0.11);
        g.strokeStyle = '#6d9440';
        g.beginPath(); g.moveTo(ls * 0.12, ls * 0.16); g.lineTo(ls * 0.26, ls * 0.34); g.stroke();
        g.beginPath(); g.moveTo(ls * 0.12, -ls * 0.16); g.lineTo(ls * 0.26, -ls * 0.34); g.stroke();
        // yeux perlés de part et d'autre du museau
        g.fillStyle = '#2c2c24';
        g.beginPath(); g.arc(ls * 0.34, -ls * 0.13, Math.max(0.5, ls * 0.06), 0, TAU); g.fill();
        g.beginPath(); g.arc(ls * 0.34, ls * 0.13, Math.max(0.5, ls * 0.06), 0, TAU); g.fill();
        g.restore();
      }

      // pierres devant le lézard (le masquent quand il rentre)
      for (i = 0; i < ns; i++) if (stones[i].y > gapY) drawStone(stones[i]);

      // petits cailloux épars + touffe d'herbe au bout de l'arc
      for (i = 0; i < 4; i++) {
        var px = (rnd() - 0.4) * r * 1.3, py = r * (0.3 + rnd() * 0.3);
        g.fillStyle = mix(GLITE, GDARK, 0.35 + rnd() * 0.35);
        g.beginPath(); g.ellipse(px, py, r * (0.045 + rnd() * 0.035), r * 0.035, rnd(), 0, TAU); g.fill();
      }
      var tx = Math.cos(a0) * r * 0.72, ty = Math.sin(a0) * r * 0.5;
      blade(g, tx, ty, -r * 0.1, r * (0.26 + rnd() * 0.12), Math.max(0.6, r * 0.06), '#588838', 0);
      blade(g, tx + r * 0.08, ty + r * 0.03, r * 0.12, r * (0.2 + rnd() * 0.1), Math.max(0.5, r * 0.05), '#78a858', 0);
    } });
})();
