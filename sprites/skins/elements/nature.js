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

  // contour organique fermé centré sur (cx,cy) — n sommets irréguliers via rnd()
  function blob(g, cx, cy, rx, ry, n, rnd, jmin, jspan, rot) {
    g.beginPath();
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + (rot || 0), k = jmin + rnd() * jspan;
      var px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }
  // ombre portée au sol (dessinée AVANT le corps)
  function ground(g, dx, dy, rx, ry, al) {
    g.fillStyle = 'rgba(20,30,15,' + al + ')';
    g.beginPath(); g.ellipse(dx, dy, rx, ry, 0, 0, TAU); g.fill();
  }
  // trait effilé (brins, branches, mèches)
  function taper(g, pts, w0, w1, col) {
    for (var i = 0; i < pts.length - 1; i++) {
      g.strokeStyle = col; g.lineCap = 'round';
      g.lineWidth = w0 + (w1 - w0) * (i / (pts.length - 1));
      g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
    }
  }
  function reg(slot, v) { var R = window.LAB_ELEMENTS.variants; (R[slot] = R[slot] || []).push(v); }

  // ============================================================
  // ROCHERS
  // ============================================================

  reg('rock', { id: 'rocher-mousse', label: 'Rocher moussu', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      ground(g, r * 0.2, r * 0.3, r * 1.05, r * 0.55, 0.20);
      // patatoïde granit
      var gd = g.createLinearGradient(-r, -r, r, r);
      gd.addColorStop(0, '#a8a49a'); gd.addColorStop(1, '#6e6a60');
      g.fillStyle = gd;
      blob(g, 0, -r * 0.12, r, r * 0.82, 9, rnd, 0.78, 0.3, 0.3);
      g.fill();
      // rehaut peint
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.ellipse(-r * 0.28, -r * 0.42, r * 0.36, r * 0.2, -0.4, 0, TAU); g.fill();
      // fissure fine
      g.strokeStyle = 'rgba(30,28,24,.28)'; g.lineWidth = Math.max(0.7, r * 0.07);
      g.beginPath();
      g.moveTo(r * (0.1 + rnd() * 0.2), -r * 0.4);
      g.lineTo(r * (rnd() * 0.2 - 0.05), r * 0.05);
      g.lineTo(r * (rnd() * 0.25), r * 0.4);
      g.stroke();
      // plaques de mousse (2-3, plutôt sur le dessus/nord)
      var np = 2 + ((rnd() * 2) | 0);
      for (var i = 0; i < np; i++) {
        var mx = (rnd() - 0.5) * r * 0.9, my = -r * 0.15 - rnd() * r * 0.45;
        g.fillStyle = 'rgba(122,160,90,.75)';
        blob(g, mx, my, r * (0.22 + rnd() * 0.16), r * (0.14 + rnd() * 0.1), 7, rnd, 0.7, 0.5, rnd() * TAU);
        g.fill();
        g.fillStyle = 'rgba(160,196,120,.45)';
        g.beginPath(); g.ellipse(mx - r * 0.05, my - r * 0.04, r * 0.1, r * 0.05, 0.3, 0, TAU); g.fill();
      }
      // brins d'herbe au pied
      var nb = 2 + ((rnd() * 2) | 0);
      for (i = 0; i < nb; i++) {
        var bx = (rnd() - 0.5) * r * 1.7, by = r * (0.45 + rnd() * 0.2);
        var dx = (rnd() - 0.5) * r * 0.3, h = r * (0.35 + rnd() * 0.25);
        taper(g, [[bx, by], [bx + dx * 0.4, by - h * 0.6], [bx + dx, by - h]],
          Math.max(0.7, r * 0.09), Math.max(0.4, r * 0.03), '#588838');
      }
    } });

  reg('rock', { id: 'menhir', label: 'Menhir penché', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      var lean = (rnd() < 0.5 ? -1 : 1) * (0.09 + rnd() * 0.09);
      ground(g, r * 0.2, r * 0.3, r * 0.85, r * 0.42, 0.22);
      g.save();
      g.rotate(lean);
      // pierre dressée : fuseau irrégulier, plus large au pied
      var H = r * 1.9, W = r * 0.62;
      var gd = g.createLinearGradient(-W, -H, W, r * 0.4);
      gd.addColorStop(0, '#b2aea2'); gd.addColorStop(0.55, '#8e8a80'); gd.addColorStop(1, '#6e6a60');
      g.fillStyle = gd;
      g.beginPath();
      var n = 10;
      for (var i = 0; i < n; i++) {
        var t = i / n, a = t * TAU;
        var vert = -Math.cos(a);                       // -1 sommet, +1 pied
        var wk = W * (0.55 + 0.45 * (vert * 0.5 + 0.5)) * (0.85 + rnd() * 0.3);
        var px = Math.sin(a) * wk;
        var py = vert * (vert < 0 ? H : r * 0.42) + (rnd() - 0.5) * r * 0.1;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
      // arête éclairée côté haut-gauche
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(0.8, r * 0.09);
      g.beginPath();
      g.moveTo(-W * 0.34, -H * 0.86);
      g.quadraticCurveTo(-W * 0.62, -H * 0.3, -W * 0.55, r * 0.15);
      g.stroke();
      // gravure spirale discrète, à mi-hauteur
      g.strokeStyle = 'rgba(40,38,32,.35)'; g.lineWidth = Math.max(0.6, r * 0.05);
      var sx = W * 0.05, sy = -H * 0.42, sr = r * 0.3;
      g.beginPath();
      for (i = 0; i <= 26; i++) {
        var sa = i / 26 * TAU * 2.2, rr = sr * (i / 26);
        var qx = sx + Math.cos(sa) * rr, qy = sy + Math.sin(sa) * rr * 0.9;
        i ? g.lineTo(qx, qy) : g.moveTo(qx, qy);
      }
      g.stroke();
      // lichen au pied
      g.fillStyle = 'rgba(122,160,90,.6)';
      g.beginPath(); g.ellipse(-W * 0.2, r * 0.3, r * 0.26, r * 0.1, 0.2, 0, TAU); g.fill();
      g.restore();
    } });

  reg('rock', { id: 'tas-galets', label: 'Tas de galets', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      ground(g, r * 0.2, r * 0.3, r * 1.1, r * 0.5, 0.20);
      var n = 4 + ((rnd() * 3) | 0);           // 4-6 galets
      var gal = [];
      // rangée du bas puis empilés dessus
      var base = Math.min(3, n - 1);
      for (var i = 0; i < base; i++)
        gal.push([(i - (base - 1) / 2) * r * 0.72 + (rnd() - 0.5) * r * 0.16,
                  r * 0.22 + (rnd() - 0.5) * r * 0.1, r * (0.4 + rnd() * 0.18)]);
      for (i = base; i < n; i++)
        gal.push([(rnd() - 0.5) * r * 0.7, -r * (0.28 + rnd() * 0.22), r * (0.28 + rnd() * 0.16)]);
      // tri : ceux du fond (y petit) d'abord
      gal.sort(function (a, b) { return a[1] - b[1]; });
      for (i = 0; i < n; i++) {
        var p = gal[i], tint = mix('#a8a49a', '#c2bcae', rnd() * 0.7);
        var gd = g.createRadialGradient(p[0] - p[2] * 0.35, p[1] - p[2] * 0.4, p[2] * 0.1, p[0], p[1], p[2] * 1.1);
        gd.addColorStop(0, shade(tint, 0.18)); gd.addColorStop(1, mix(tint, '#6e6a60', 0.75));
        g.fillStyle = gd;
        blob(g, p[0], p[1], p[2], p[2] * 0.82, 8, rnd, 0.82, 0.24, rnd() * TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.22)';
        g.beginPath(); g.ellipse(p[0] - p[2] * 0.3, p[1] - p[2] * 0.35, p[2] * 0.3, p[2] * 0.16, -0.4, 0, TAU); g.fill();
      }
      // brin d'herbe qui dépasse entre deux galets
      var bx = (rnd() - 0.5) * r * 0.8, by = r * 0.35;
      taper(g, [[bx, by], [bx + r * 0.08, by - r * 0.4], [bx + r * 0.2, by - r * 0.6]],
        Math.max(0.6, r * 0.07), Math.max(0.4, r * 0.03), '#78a858');
    } });

  reg('rock', { id: 'rocher-fendu', label: 'Rocher fendu', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      ground(g, r * 0.2, r * 0.3, r * 1.1, r * 0.55, 0.24);
      // gros bloc massif
      var gd = g.createLinearGradient(-r, -r, r * 0.9, r * 0.8);
      gd.addColorStop(0, '#b2aea2'); gd.addColorStop(1, '#6e6a60');
      g.fillStyle = gd;
      blob(g, 0, -r * 0.15, r * 1.02, r * 0.88, 9, rnd, 0.8, 0.26, 0.5);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.ellipse(-r * 0.3, -r * 0.5, r * 0.34, r * 0.17, -0.35, 0, TAU); g.fill();
      // fissure sombre traversante (zigzag épais puis fin)
      var fx = (rnd() - 0.5) * r * 0.3;
      var pts = [[fx + r * 0.1, -r * 0.95]];
      var steps = 4 + ((rnd() * 2) | 0);
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        pts.push([fx + (rnd() - 0.5) * r * 0.42, -r * 0.95 + t * r * 1.55]);
      }
      g.strokeStyle = 'rgba(24,22,18,.72)';
      taper(g, pts, Math.max(1, r * 0.16), Math.max(0.5, r * 0.04), 'rgba(24,22,18,.72)');
      // petite fissure secondaire qui bifurque
      var m = pts[(steps / 2) | 0];
      taper(g, [[m[0], m[1]], [m[0] + r * 0.3, m[1] + r * 0.12], [m[0] + r * 0.48, m[1] + r * 0.3]],
        Math.max(0.7, r * 0.07), Math.max(0.4, r * 0.03), 'rgba(24,22,18,.5)');
      // éclats au pied
      for (i = 0; i < 3; i++) {
        var ex = (rnd() - 0.5) * r * 1.8, ey = r * (0.55 + rnd() * 0.22), es = r * (0.1 + rnd() * 0.1);
        g.fillStyle = mix('#a8a49a', '#6e6a60', 0.3 + rnd() * 0.4);
        g.beginPath();
        g.moveTo(ex - es, ey + es * 0.5); g.lineTo(ex + (rnd() - 0.5) * es, ey - es);
        g.lineTo(ex + es, ey + es * 0.5);
        g.closePath(); g.fill();
      }
    } });

  reg('rock', { id: 'rocher-cristaux', label: 'Rocher à cristaux', anim: 'scintillement des cristaux en déphasage',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      ground(g, r * 0.2, r * 0.3, r * 1.0, r * 0.5, 0.22);
      // socle rocheux gris
      var gd = g.createLinearGradient(-r, -r, r, r);
      gd.addColorStop(0, '#a8a49a'); gd.addColorStop(1, '#6e6a60');
      g.fillStyle = gd;
      blob(g, 0, 0, r * 0.95, r * 0.72, 8, rnd, 0.78, 0.3, 0.2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.ellipse(-r * 0.26, -r * 0.3, r * 0.3, r * 0.15, -0.4, 0, TAU); g.fill();
      // cristaux bleutés (3-5), pointes dressées légèrement inclinées
      var nc = 3 + ((rnd() * 3) | 0);
      for (var i = 0; i < nc; i++) {
        var cx = (rnd() - 0.5) * r * 1.0, cy = -r * (0.1 + rnd() * 0.35);
        var ch = r * (0.45 + rnd() * 0.4), cw = ch * (0.3 + rnd() * 0.12);
        var tilt = (rnd() - 0.5) * 0.7, phase = rnd();
        // scintillement subtil, déphasé par cristal
        var tw = 0.5 + 0.5 * Math.sin((PH + phase) * TAU);
        g.save();
        g.translate(cx, cy); g.rotate(tilt);
        var cg = g.createLinearGradient(-cw, -ch, cw, 0);
        cg.addColorStop(0, mix('#8fd0e8', '#ffffff', 0.15 + tw * 0.12));
        cg.addColorStop(1, '#3f88ae');
        g.fillStyle = cg;
        g.beginPath();
        g.moveTo(0, -ch); g.lineTo(cw, -ch * 0.28); g.lineTo(cw * 0.55, ch * 0.18);
        g.lineTo(-cw * 0.55, ch * 0.18); g.lineTo(-cw, -ch * 0.28);
        g.closePath(); g.fill();
        // facette claire + étincelle au sommet
        g.fillStyle = 'rgba(255,255,255,' + (0.18 + tw * 0.17) + ')';
        g.beginPath(); g.moveTo(0, -ch); g.lineTo(cw, -ch * 0.28); g.lineTo(cw * 0.2, -ch * 0.1); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,' + (0.1 + tw * 0.25) + ')';
        g.lineWidth = Math.max(0.5, r * 0.045);
        var ss = cw * 0.5;
        g.beginPath(); g.moveTo(-ss, -ch); g.lineTo(ss, -ch); g.moveTo(0, -ch - ss); g.lineTo(0, -ch + ss); g.stroke();
        g.restore();
      }
    } });

  // ============================================================
  // ARBRES (couronne vue de dessus-3/4, tous animés)
  // ============================================================

  reg('tree', { id: 'chene-touffu', label: 'Chêne touffu', anim: 'ondulation du feuillage (scale/skew sinusoïdal)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 1.05, r * 0.55, 0.22);
      // tronc en biais, visible sous la couronne
      g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = r * 0.22;
      g.beginPath(); g.moveTo(r * 0.28, r * 0.62); g.quadraticCurveTo(r * 0.12, r * 0.3, 0, r * 0.05); g.stroke();
      g.strokeStyle = '#6e5434'; g.lineWidth = r * 0.09;
      g.beginPath(); g.moveTo(r * 0.26, r * 0.6); g.quadraticCurveTo(r * 0.14, r * 0.34, r * 0.05, r * 0.12); g.stroke();
      // couronne : léger souffle (scale + skew sinusoïdaux, subtils)
      var sw = Math.sin(PH * TAU), sw2 = Math.sin(PH * TAU * 2 + 1.3);
      g.save();
      g.translate(0, -r * 0.1);
      g.transform(1 + sw * 0.02, 0, sw * 0.035 + sw2 * 0.012, 1 + sw2 * 0.015, 0, 0);
      // 3-4 lobes moutonnés
      var nl = 3 + ((rnd() * 2) | 0), lobes = [];
      for (var i = 0; i < nl; i++) {
        var a = i / nl * TAU + rnd() * 0.8;
        lobes.push([Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.34 - r * 0.05, r * (0.5 + rnd() * 0.18)]);
      }
      lobes.push([0, -r * 0.08, r * 0.62]); // masse centrale
      for (i = 0; i < lobes.length; i++) {
        var L = lobes[i];
        var cg = g.createRadialGradient(L[0] - L[2] * 0.35, L[1] - L[2] * 0.4, L[2] * 0.1, L[0], L[1], L[2]);
        cg.addColorStop(0, shade('#78a858', 0.22)); cg.addColorStop(1, '#3e5e28');
        g.fillStyle = cg;
        blob(g, L[0], L[1], L[2], L[2] * 0.9, 9, rnd, 0.84, 0.24, rnd() * TAU);
        g.fill();
      }
      // moutonnements clairs sur le dessus
      g.fillStyle = 'rgba(255,255,255,.16)';
      for (i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse((rnd() - 0.6) * r * 0.6, (rnd() - 0.7) * r * 0.5, r * (0.14 + rnd() * 0.1), r * (0.08 + rnd() * 0.05), rnd(), 0, TAU);
        g.fill();
      }
      g.restore();
    } });

  reg('tree', { id: 'saule', label: 'Saule', anim: 'balancement des mèches en déphasage',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 1.1, r * 0.55, 0.20);
      // dôme central
      var cg = g.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, -r * 0.08, r * 0.75);
      cg.addColorStop(0, shade('#78a858', 0.28)); cg.addColorStop(1, mix('#588838', '#3e5e28', 0.5));
      g.fillStyle = cg;
      blob(g, 0, -r * 0.12, r * 0.72, r * 0.6, 9, rnd, 0.82, 0.26, 0.4);
      g.fill();
      // mèches retombantes tout autour, balancement déphasé
      var nm = 8 + ((rnd() * 4) | 0);
      for (var i = 0; i < nm; i++) {
        var a = i / nm * TAU + rnd() * 0.4;
        var bx = Math.cos(a) * r * 0.58, by = Math.sin(a) * r * 0.46 - r * 0.12;
        var len = r * (0.5 + rnd() * 0.35);
        var ph = rnd();
        var sway = Math.sin(PH * TAU + ph * TAU) * r * 0.06;
        var ex = bx + Math.cos(a) * len * 0.5 + sway;
        var ey = by + len * (0.75 + Math.sin(a) * 0.15);
        var col = mix('#78a858', '#3e5e28', 0.25 + rnd() * 0.5);
        g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = Math.max(0.8, r * 0.11);
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(bx + Math.cos(a) * len * 0.45 + sway * 0.4, by + len * 0.35, ex, ey);
        g.stroke();
        // petites feuilles le long de la mèche
        g.fillStyle = shade(col, 0.2);
        g.beginPath(); g.ellipse(ex - sway * 0.3, ey - len * 0.18, r * 0.06, r * 0.1, a, 0, TAU); g.fill();
      }
      // rehaut du dôme
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.beginPath(); g.ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.14, -0.4, 0, TAU); g.fill();
    } });

  reg('tree', { id: 'pin-boule', label: 'Pin boule', anim: 'frémissement léger + chute d\'une pomme de pin par cycle',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 0.95, r * 0.5, 0.24);
      // tronc court apparent
      g.strokeStyle = '#6e5434'; g.lineCap = 'round'; g.lineWidth = r * 0.18;
      g.beginPath(); g.moveTo(-r * 0.06, r * 0.55); g.lineTo(r * 0.02, r * 0.1); g.stroke();
      // frémissement très léger de la boule
      var tr = Math.sin(PH * TAU * 3) * 0.008 + Math.sin(PH * TAU) * 0.006;
      g.save();
      g.translate(0, -r * 0.15);
      g.scale(1 + tr, 1 - tr * 0.6);
      // boule dense vert sombre
      var dark = mix('#3e5e28', '#2c451c', 0.5);
      var cg = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.08, 0, 0, r * 0.85);
      cg.addColorStop(0, mix('#588838', '#78a858', 0.4)); cg.addColorStop(1, dark);
      g.fillStyle = cg;
      blob(g, 0, 0, r * 0.82, r * 0.76, 11, rnd, 0.86, 0.2, 0.2);
      g.fill();
      // texture aiguilles : petits arcs sombres en périphérie
      g.strokeStyle = 'rgba(30,50,20,.4)'; g.lineWidth = Math.max(0.5, r * 0.05);
      for (var i = 0; i < 6; i++) {
        var a = rnd() * TAU, ar = r * (0.45 + rnd() * 0.3);
        g.beginPath(); g.arc(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.15, ar, a - 0.4, a + 0.4); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.beginPath(); g.ellipse(-r * 0.25, -r * 0.35, r * 0.26, r * 0.13, -0.4, 0, TAU); g.fill();
      // pommes de pin accrochées (2-3)
      var np = 2 + ((rnd() * 2) | 0);
      for (i = 0; i < np; i++) {
        var px = (rnd() - 0.5) * r * 0.9, py = (rnd() - 0.2) * r * 0.5;
        g.fillStyle = '#8a6a44';
        g.beginPath(); g.ellipse(px, py, r * 0.08, r * 0.11, 0.2, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(60,42,24,.6)'; g.lineWidth = Math.max(0.4, r * 0.025);
        g.beginPath(); g.moveTo(px - r * 0.06, py - r * 0.03); g.lineTo(px + r * 0.06, py - r * 0.03);
        g.moveTo(px - r * 0.06, py + r * 0.03); g.lineTo(px + r * 0.06, py + r * 0.03); g.stroke();
      }
      g.restore();
      // une pomme de pin tombe une fois par cycle (fondu en fin de chute)
      var fx = (rnd() - 0.5) * r * 0.6;
      var fp = PH;                                     // 0→1 sur le cycle
      var fy = -r * 0.3 + fp * fp * r * 1.05;          // accélération de chute
      var fa = fp < 0.12 ? fp / 0.12 : (fp > 0.8 ? Math.max(0, (1 - fp) / 0.2) : 1);
      if (fa > 0) {
        g.globalAlpha = fa * 0.95;
        g.fillStyle = '#8a6a44';
        g.beginPath(); g.ellipse(fx + Math.sin(fp * TAU * 2) * r * 0.03, fy, r * 0.07, r * 0.1, fp * 2, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
    } });

  reg('tree', { id: 'arbre-fleurs', label: 'Arbre en fleurs', anim: 'pétales qui se détachent et tombent en spirale',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      ground(g, 3 * k, 4 * k, r * 1.0, r * 0.52, 0.20);
      // tronc discret
      g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = r * 0.16;
      g.beginPath(); g.moveTo(-r * 0.12, r * 0.58); g.quadraticCurveTo(-r * 0.02, r * 0.3, r * 0.02, r * 0.08); g.stroke();
      // respiration très légère de la couronne
      var br = Math.sin(PH * TAU) * 0.012;
      g.save();
      g.translate(0, -r * 0.12);
      g.scale(1 + br, 1 - br * 0.5);
      // couronne verte tendre
      var cg = g.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.1, 0, 0, r * 0.85);
      cg.addColorStop(0, shade('#78a858', 0.3)); cg.addColorStop(1, mix('#588838', '#3e5e28', 0.4));
      g.fillStyle = cg;
      blob(g, 0, 0, r * 0.8, r * 0.7, 10, rnd, 0.82, 0.26, 0.6);
      g.fill();
      // fleurs roses piquées (grappes de 3 points + coeur clair)
      var nf = 6 + ((rnd() * 4) | 0);
      for (var i = 0; i < nf; i++) {
        var fx = (rnd() - 0.5) * r * 1.25, fyy = (rnd() - 0.55) * r * 1.05;
        if (fx * fx / (r * r * 0.64) + fyy * fyy / (r * r * 0.49) > 1) continue; // reste dans la couronne
        g.fillStyle = mix('#e8788a', '#f6bcc8', rnd() * 0.6);
        for (var p2 = 0; p2 < 3; p2++) {
          var pa = rnd() * TAU;
          g.beginPath(); g.arc(fx + Math.cos(pa) * r * 0.05, fyy + Math.sin(pa) * r * 0.05, r * (0.045 + rnd() * 0.03), 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(255,244,236,.8)';
        g.beginPath(); g.arc(fx, fyy, r * 0.025, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.15)';
      g.beginPath(); g.ellipse(-r * 0.24, -r * 0.34, r * 0.3, r * 0.14, -0.4, 0, TAU); g.fill();
      g.restore();
      // 3 pétales qui tombent en spirale, cycles décalés + fondu
      for (i = 0; i < 3; i++) {
        var off = i * 0.37 + rnd() * 0.1;
        var t = (PH + off) % 1;
        var sx = (rnd() - 0.5) * r * 1.0, sy = -r * 0.35;
        var pxx = sx + Math.sin(t * TAU * 2.2 + i) * r * 0.16 * t;
        var pyy = sy + t * r * 1.15;
        var al = t < 0.12 ? t / 0.12 : (t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1);
        if (al <= 0) continue;
        g.globalAlpha = al * 0.9;
        g.fillStyle = '#f093a4';
        g.save();
        g.translate(pxx, pyy); g.rotate(t * TAU * 1.7 + i * 2);
        g.beginPath(); g.ellipse(0, 0, r * 0.07, r * 0.04, 0, 0, TAU); g.fill();
        g.restore();
        g.globalAlpha = 1;
      }
    } });

  reg('tree', { id: 'arbre-mort', label: 'Arbre mort', anim: 'le corbeau penche la tête puis se redresse (avec pause)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;
      // ombre au sol centrée sous le PIED du tronc (r*0.04, r*0.55), décalage standard +3,+4 × r/12
      ground(g, r * 0.04 + 3 * k, r * 0.55 + 4 * k, r * 0.8, r * 0.4, 0.20);
      // tronc noueux court
      g.strokeStyle = '#6e5434'; g.lineCap = 'round'; g.lineWidth = r * 0.24;
      g.beginPath(); g.moveTo(r * 0.04, r * 0.55); g.quadraticCurveTo(-r * 0.06, r * 0.15, 0, -r * 0.1); g.stroke();
      // branches nues en éventail, graphiques et effilées
      var nb = 5 + ((rnd() * 3) | 0);
      var tip = null, tipA = 0;
      for (var i = 0; i < nb; i++) {
        var a = -TAU / 4 + (i / (nb - 1) - 0.5) * 2.2 + (rnd() - 0.5) * 0.2;
        var len = r * (0.75 + rnd() * 0.45);
        var mx = Math.cos(a) * len * 0.5 + (rnd() - 0.5) * r * 0.12;
        var my = -r * 0.1 + Math.sin(a) * len * 0.5;
        var ex = Math.cos(a) * len * (1 + (rnd() - 0.5) * 0.15);
        var ey = -r * 0.1 + Math.sin(a) * len;
        taper(g, [[0, -r * 0.1], [mx, my], [ex, ey]],
          Math.max(1, r * 0.12), Math.max(0.4, r * 0.03), '#6e5434');
        // brindille secondaire
        if (rnd() < 0.6) {
          var ba = a + (rnd() - 0.5) * 1.1;
          taper(g, [[mx, my], [mx + Math.cos(ba) * len * 0.32, my + Math.sin(ba) * len * 0.32]],
            Math.max(0.6, r * 0.05), Math.max(0.3, r * 0.02), '#8a6a44');
        }
        // retenir la branche la plus haute pour le corbeau
        if (tip === null || ey < tip[1]) { tip = [ex, ey]; tipA = a; }
      }
      // corbeau stylisé posé sur la branche haute
      var cs = r * 0.24;                                // échelle du corbeau
      // penche la tête puis se redresse : bosse lisse entre 35% et 70% du cycle, pause sinon
      var u = Math.min(1, Math.max(0, (PH - 0.35) / 0.35));
      var tilt = Math.sin(u * Math.PI) * 0.55;
      g.save();
      g.translate(tip[0], tip[1] - cs * 0.55);
      if (tipA > -TAU / 4) g.scale(-1, 1);              // regarde vers le tronc
      // corps
      g.fillStyle = '#2c2c34';
      g.beginPath(); g.ellipse(0, 0, cs * 0.62, cs * 0.48, -0.15, 0, TAU); g.fill();
      // queue
      g.beginPath(); g.moveTo(cs * 0.4, cs * 0.05); g.lineTo(cs * 0.95, cs * 0.22); g.lineTo(cs * 0.45, cs * 0.3); g.closePath(); g.fill();
      // tête (pivote autour du cou)
      g.save();
      g.translate(-cs * 0.4, -cs * 0.3); g.rotate(tilt);
      g.fillStyle = '#2c2c34';
      g.beginPath(); g.arc(0, -cs * 0.18, cs * 0.3, 0, TAU); g.fill();
      g.fillStyle = '#d8a03c';                          // bec
      g.beginPath(); g.moveTo(-cs * 0.24, -cs * 0.22); g.lineTo(-cs * 0.58, -cs * 0.1); g.lineTo(-cs * 0.2, -cs * 0.04); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)';            // oeil
      g.beginPath(); g.arc(-cs * 0.1, -cs * 0.24, cs * 0.055, 0, TAU); g.fill();
      g.restore();
      // reflet d'aile
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.beginPath(); g.ellipse(-cs * 0.05, -cs * 0.15, cs * 0.3, cs * 0.14, -0.3, 0, TAU); g.fill();
      g.restore();
    } });
})();
