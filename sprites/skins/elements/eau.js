"use strict";
window.LAB_ELEMENTS = window.LAB_ELEMENTS || { variants: {}, chosen: {} };
(function () {
  var TAU = Math.PI * 2;
  function hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function hex(r,g2,b){function q(v){v=Math.max(0,Math.min(255,Math.round(v)));return(v<16?'0':'')+v.toString(16);}return'#'+q(r)+q(g2)+q(b);}
  function shade(c,k){var a=hx(c);return k>=0?hex(a[0]+(255-a[0])*k,a[1]+(255-a[1])*k,a[2]+(255-a[2])*k):hex(a[0]*(1+k),a[1]*(1+k),a[2]*(1+k));}
  function mix(c1,c2,t){var A=hx(c1),B=hx(c2);return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
  function prng(seed){var a=(seed|0)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  function reg(slot, v) { var R = window.LAB_ELEMENTS.variants; (R[slot] = R[slot] || []).push(v); }

  // Contour organique de flaque : n points irreguliers, aplatie ry = 0.8*rx.
  function pondPts(rnd, r, n, base, jit) {
    var pts = [], i, a, rr;
    for (i = 0; i < n; i++) {
      a = i / n * TAU;
      rr = r * (base + rnd() * jit);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.8]);
    }
    return pts;
  }
  // Trace lissee (quadratiques par points milieux) d'une boucle fermee.
  function traceLoop(g, pts) {
    var n = pts.length, i, p, q2, mx, my;
    g.beginPath();
    g.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (i = 0; i < n; i++) {
      p = pts[i]; q2 = pts[(i + 1) % n];
      mx = (p[0] + q2[0]) / 2; my = (p[1] + q2[1]) / 2;
      g.quadraticCurveTo(p[0], p[1], mx, my);
    }
    g.closePath();
  }
  // Remplissage eau : degrade radial clair haut-gauche -> profond.
  function waterFill(g, r, c1, c2) {
    var gd = g.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.08, 0, 0, r * 1.05);
    gd.addColorStop(0, c1); gd.addColorStop(1, c2);
    return gd;
  }
  // Berge + eau (motif commun) : renvoie le rnd deja consomme pareil pour tous.
  function bankAndWater(g, rnd, r, bankC, c1, c2, bankK) {
    var pts = pondPts(rnd, r, 12, 0.92, 0.2);
    g.fillStyle = bankC;
    g.save(); g.scale(1 + (bankK || 0.12), 1 + (bankK || 0.12));
    traceLoop(g, pts); g.fill();
    g.restore();
    g.fillStyle = waterFill(g, r, c1, c2);
    traceLoop(g, pts); g.fill();
    return pts;
  }
  // 3 petits arcs de reflets blancs (comme dans le jeu).
  function glints(g, rnd, r, alpha) {
    g.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
    g.lineWidth = Math.max(1, r * 0.05);
    for (var i = 0; i < 3; i++) {
      g.beginPath();
      g.arc((rnd() - 0.5) * r * 0.9, (rnd() - 0.5) * r * 0.55, r * (0.12 + rnd() * 0.18), Math.PI * 1.05, Math.PI * 1.9);
      g.stroke();
    }
  }

  // ------------------------------------------------------------------
  // 1. Mare aux nenuphars — nenuphars qui derivent + grenouille sauteuse
  // ------------------------------------------------------------------
  reg('water', {
    id: 'mare-nenuphars', label: 'Mare aux nénuphars',
    anim: 'nénuphars qui dérivent, grenouille qui saute une fois par cycle',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      bankAndWater(g, rnd, r, '#cfc39a', '#8fd0e8', '#3f88ae');
      glints(g, rnd, r, 0.3);
      // pads : 2 a 4 nenuphars, positions seedees, derive douce
      var nPads = 2 + Math.floor(rnd() * 3), pads = [];
      for (i = 0; i < nPads; i++) {
        pads.push({
          x: (rnd() - 0.5) * r * 1.1, y: (rnd() - 0.5) * r * 0.7,
          s: r * (0.16 + rnd() * 0.08), a: rnd() * TAU, ph: rnd() * TAU
        });
      }
      for (i = 0; i < nPads; i++) {
        var p = pads[i];
        var dx = Math.sin(PH * TAU + p.ph) * r * 0.035;
        var dy = Math.cos(PH * TAU + p.ph) * r * 0.02;
        g.save(); g.translate(p.x + dx, p.y + dy); g.rotate(p.a);
        g.fillStyle = i === 0 ? '#78a858' : mix('#5da05a', '#78a858', rnd());
        g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.72, 0, 0, TAU); g.fill();
        // encoche du nenuphar
        g.fillStyle = '#3f88ae';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(p.s * 1.05, -p.s * 0.3); g.lineTo(p.s * 1.05, p.s * 0.25); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(62,94,40,.5)'; g.lineWidth = Math.max(0.6, r * 0.02);
        g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.72, 0, 0, TAU); g.stroke();
        if (i === 0) { // fleur rose sur le premier
          g.fillStyle = '#e890b0';
          for (var k = 0; k < 5; k++) {
            var fa = k / 5 * TAU;
            g.beginPath(); g.ellipse(Math.cos(fa) * p.s * 0.28, Math.sin(fa) * p.s * 0.22, p.s * 0.22, p.s * 0.13, fa, 0, TAU); g.fill();
          }
          g.fillStyle = '#f8d868';
          g.beginPath(); g.arc(0, 0, p.s * 0.14, 0, TAU); g.fill();
        }
        g.restore();
      }
      // grenouille : saute du pad A au pad B pendant PH [0.35, 0.6]
      var A = pads[0], B = pads[nPads - 1];
      var jt = (PH - 0.35) / 0.25, onA = PH < 0.35;
      var fx, fy, fal = 1, squash = 1;
      if (jt >= 0 && jt <= 1) {
        var e = jt;
        fx = A.x + (B.x - A.x) * e; fy = A.y + (B.y - A.y) * e - Math.sin(e * Math.PI) * r * 0.45;
        squash = 1.15;
      } else { fx = onA ? A.x : B.x; fy = (onA ? A.y : B.y) - r * 0.03; }
      // fondu au raccord de boucle : disparait sur B en fin de cycle, reapparait sur A au debut
      if (PH > 0.9) fal = (1 - PH) / 0.1;
      else if (PH < 0.1) fal = PH / 0.1;
      g.save(); g.globalAlpha = 0.95 * fal; g.translate(fx, fy);
      var fs = r * 0.11;
      g.fillStyle = '#588838';
      g.beginPath(); g.ellipse(0, 0, fs * squash, fs * 0.75 / squash, 0, 0, TAU); g.fill();
      g.fillStyle = '#78a858';
      g.beginPath(); g.arc(-fs * 0.45, -fs * 0.55, fs * 0.3, 0, TAU); g.arc(fs * 0.45, -fs * 0.55, fs * 0.3, 0, TAU); g.fill();
      g.fillStyle = '#2a2a22';
      g.beginPath(); g.arc(-fs * 0.45, -fs * 0.6, fs * 0.12, 0, TAU); g.arc(fs * 0.45, -fs * 0.6, fs * 0.12, 0, TAU); g.fill();
      g.restore();
    }
  });

  // ------------------------------------------------------------------
  // 2. Mare aux roseaux — roseaux qui ondulent + libellule en circuit
  // ------------------------------------------------------------------
  reg('water', {
    id: 'mare-roseaux', label: 'Mare aux roseaux',
    anim: 'roseaux qui ondulent, libellule en orbite elliptique',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i, k;
      bankAndWater(g, rnd, r, '#c9bd92', '#8fd0e8', '#3f88ae');
      glints(g, rnd, r, 0.32);
      // touffes de roseaux sur la berge : 3-5 touffes de 2-3 tiges
      var nT = 3 + Math.floor(rnd() * 3);
      for (i = 0; i < nT; i++) {
        var a = rnd() * TAU;
        var bx = Math.cos(a) * r * 1.0, by = Math.sin(a) * r * 0.8;
        var ph = rnd() * TAU, nS = 2 + Math.floor(rnd() * 2);
        for (k = 0; k < nS; k++) {
          var h = r * (0.34 + rnd() * 0.22);
          var lean = (rnd() - 0.5) * r * 0.12;
          var sway = Math.sin(PH * TAU + ph + k * 0.9) * r * 0.05;
          var tx = bx + lean + sway, ty = by - h;
          g.strokeStyle = k % 2 ? '#78a858' : '#588838';
          g.lineWidth = Math.max(0.8, r * 0.035);
          g.beginPath(); g.moveTo(bx + k * r * 0.04, by);
          g.quadraticCurveTo(bx + lean * 0.4, by - h * 0.6, tx, ty);
          g.stroke();
          // quenouille brune
          g.fillStyle = k % 2 ? '#8a6a44' : '#6e5434';
          g.beginPath(); g.ellipse(tx, ty - r * 0.05, Math.max(0.9, r * 0.035), r * 0.1, sway * 0.03, 0, TAU); g.fill();
        }
      }
      // libellule : orbite elliptique au-dessus de l'eau, leger fondu aux extremes
      var ox = Math.cos(PH * TAU) * r * 0.55, oy = Math.sin(PH * TAU) * r * 0.3 - r * 0.25;
      var head = PH * TAU + Math.PI / 2;
      g.save(); g.translate(ox, oy); g.rotate(head);
      g.globalAlpha = 0.75 + 0.25 * Math.sin(PH * TAU * 2);
      var ds = r * 0.09;
      g.strokeStyle = '#4a6a9a'; g.lineWidth = Math.max(0.8, ds * 0.3); g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -ds * 0.8); g.lineTo(0, ds * 1.4); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)';
      var wob = 0.7 + 0.3 * Math.sin(PH * TAU * 8);
      g.beginPath(); g.ellipse(-ds * 0.9 * wob, 0, ds * 0.95, ds * 0.3, -0.25, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(ds * 0.9 * wob, 0, ds * 0.95, ds * 0.3, 0.25, 0, TAU); g.fill();
      g.fillStyle = '#38507a';
      g.beginPath(); g.arc(0, -ds * 0.8, ds * 0.28, 0, TAU); g.fill();
      g.restore();
    }
  });

  // ------------------------------------------------------------------
  // 3. Etang au poisson — poisson qui saute + ronds concentriques
  // ------------------------------------------------------------------
  reg('water', {
    id: 'etang-poisson', label: 'Étang au poisson',
    anim: 'poisson qui saute une fois par cycle, éclaboussure et ondes',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      bankAndWater(g, rnd, r, '#c2b78e', '#6fb8d8', '#2e6a92', 0.1);
      glints(g, rnd, r, 0.28);
      var jx = (rnd() - 0.5) * r * 0.4, jy = (rnd() - 0.5) * r * 0.25; // point de saut
      // ombre du poisson sous la surface (visible hors du saut, croisiere lente)
      var jt = (PH - 0.35) / 0.22; // fenetre de saut [0.35, 0.57]
      if (jt < 0 || jt > 1) {
        var swim = PH < 0.35 ? PH / 0.35 : (PH - 0.57) / 0.43 - 1;
        var sx = jx + Math.sin(swim * Math.PI * 2) * r * 0.3;
        var sy = jy + Math.cos(swim * Math.PI) * r * 0.14;
        g.fillStyle = 'rgba(20,50,70,.3)';
        g.beginPath(); g.ellipse(sx, sy, r * 0.24, r * 0.09, Math.sin(swim * Math.PI) * 0.4, 0, TAU); g.fill();
      } else {
        // saut : silhouette en arc, rotation qui suit la trajectoire
        var e = jt, ax = jx + (e - 0.5) * r * 0.45, ay = jy - Math.sin(e * Math.PI) * r * 0.6;
        g.save(); g.translate(ax, ay); g.rotate((e - 0.5) * 2.2);
        var fs = r * 0.2;
        var fgd = g.createLinearGradient(0, -fs * 0.4, 0, fs * 0.4);
        fgd.addColorStop(0, '#8fb8c8'); fgd.addColorStop(1, '#4a7a94');
        g.fillStyle = fgd;
        g.beginPath();
        g.moveTo(-fs, 0);
        g.quadraticCurveTo(0, -fs * 0.62, fs * 0.8, 0);
        g.quadraticCurveTo(0, fs * 0.55, -fs, 0);
        g.closePath(); g.fill();
        g.beginPath(); // queue
        g.moveTo(-fs * 0.9, 0); g.lineTo(-fs * 1.35, -fs * 0.4); g.lineTo(-fs * 1.25, fs * 0.35);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.beginPath(); g.ellipse(fs * 0.1, -fs * 0.2, fs * 0.4, fs * 0.14, -0.2, 0, TAU); g.fill();
        g.restore();
        // eclaboussures a l'entree et la sortie
        var spl = e < 0.25 ? Math.sin(e / 0.25 * Math.PI) : (e > 0.78 ? Math.sin((e - 0.78) / 0.22 * Math.PI) : 0);
        if (spl > 0) {
          g.strokeStyle = 'rgba(255,255,255,' + (0.5 * spl) + ')';
          g.lineWidth = Math.max(1, r * 0.045); g.lineCap = 'round';
          for (i = 0; i < 5; i++) {
            var sa = -Math.PI * (0.15 + i * 0.175), sl = r * (0.1 + 0.12 * (1 - spl));
            g.beginPath();
            g.moveTo(jx + Math.cos(sa) * r * 0.08, jy + Math.sin(sa) * r * 0.06);
            g.lineTo(jx + Math.cos(sa) * (r * 0.08 + sl), jy + Math.sin(sa) * (r * 0.06 + sl * 0.7));
            g.stroke();
          }
        }
      }
      // ronds concentriques apres l'atterrissage (PH 0.6 -> 1)
      if (PH > 0.6) {
        var wt = (PH - 0.6) / 0.4;
        for (i = 0; i < 2; i++) {
          var w2 = Math.max(0, wt - i * 0.18) / (1 - i * 0.18);
          if (w2 <= 0 || w2 >= 1) continue;
          g.strokeStyle = 'rgba(255,255,255,' + (0.4 * (1 - w2)) + ')';
          g.lineWidth = Math.max(0.8, r * 0.035);
          g.beginPath(); g.ellipse(jx, jy, r * (0.08 + w2 * 0.5), r * (0.06 + w2 * 0.38), 0, 0, TAU); g.stroke();
        }
      }
    }
  });

  // ------------------------------------------------------------------
  // 4. Source scintillante — etincelles dephasees + micro-ondulations
  // ------------------------------------------------------------------
  reg('water', {
    id: 'source-scintillante', label: 'Source scintillante',
    anim: 'étincelles qui scintillent en déphasage, micro-ondulations',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      var pts = bankAndWater(g, rnd, r, '#cfc8a4', '#c2f0ee', '#3fa8b8', 0.1);
      // filet d'eau qui alimente la source (depuis un bord seedee)
      var fa = rnd() * TAU;
      var fx = Math.cos(fa) * r * 1.05, fy = Math.sin(fa) * r * 0.84;
      var flow = ((PH * 2) % 1);
      g.strokeStyle = 'rgba(190,235,240,.85)'; g.lineWidth = Math.max(1.2, r * 0.09); g.lineCap = 'round';
      g.beginPath();
      g.moveTo(fx * 1.35, fy * 1.35);
      g.quadraticCurveTo(fx * 1.1, fy * 1.1, fx * 0.8, fy * 0.8);
      g.stroke();
      // petit trait clair qui descend le filet (courant)
      g.strokeStyle = 'rgba(255,255,255,' + (0.5 * Math.sin(flow * Math.PI)) + ')';
      g.lineWidth = Math.max(0.7, r * 0.04);
      var ft = 1.35 - flow * 0.5;
      g.beginPath(); g.moveTo(fx * ft, fy * ft); g.lineTo(fx * (ft - 0.1), fy * (ft - 0.1)); g.stroke();
      // pierres de bordure : petites, claires, espacees
      var nS = 7 + Math.floor(rnd() * 4);
      for (i = 0; i < nS; i++) {
        var a = (i / nS + rnd() * 0.05) * TAU;
        var sx = Math.cos(a) * r * (1.0 + rnd() * 0.1), sy = Math.sin(a) * r * (0.8 + rnd() * 0.08);
        var ss = r * (0.07 + rnd() * 0.06);
        var sg = g.createLinearGradient(sx - ss, sy - ss, sx + ss, sy + ss);
        sg.addColorStop(0, '#b8b4aa'); sg.addColorStop(1, '#7e7a70');
        g.fillStyle = sg;
        g.beginPath(); g.ellipse(sx, sy, ss, ss * 0.75, rnd() * TAU, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.22)';
        g.beginPath(); g.ellipse(sx - ss * 0.25, sy - ss * 0.3, ss * 0.4, ss * 0.22, -0.4, 0, TAU); g.fill();
      }
      // micro-ondulations : 2 arcs dont le rayon respire a peine
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = Math.max(0.8, r * 0.035);
      for (i = 0; i < 2; i++) {
        var wob = 1 + 0.06 * Math.sin(PH * TAU + i * 2.4);
        g.beginPath();
        g.ellipse((rnd() - 0.5) * r * 0.5, (rnd() - 0.5) * r * 0.3, r * 0.28 * wob, r * 0.2 * wob, 0, Math.PI * 1.1, Math.PI * 1.85);
        g.stroke();
      }
      // etincelles : 4 points en croix qui scintillent en dephasage
      for (i = 0; i < 4; i++) {
        var ex = (rnd() - 0.5) * r * 1.1, ey = (rnd() - 0.5) * r * 0.7;
        var tw = Math.max(0, Math.sin(PH * TAU * 2 + i * 1.7));
        if (tw < 0.05) continue;
        var es = r * 0.09 * (0.6 + 0.4 * tw);
        g.strokeStyle = 'rgba(255,255,255,' + (0.65 * tw) + ')';
        g.lineWidth = Math.max(0.7, r * 0.03); g.lineCap = 'round';
        g.beginPath();
        g.moveTo(ex - es, ey); g.lineTo(ex + es, ey);
        g.moveTo(ex, ey - es * 0.8); g.lineTo(ex, ey + es * 0.8);
        g.stroke();
      }
    }
  });

  // ------------------------------------------------------------------
  // 5. Mare boueuse — bulles qui montent et eclatent, brindille qui tangue
  // ------------------------------------------------------------------
  reg('water', {
    id: 'mare-boueuse', label: 'Mare boueuse',
    anim: 'bulles qui montent et éclatent en décalé, brindille qui tangue',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      bankAndWater(g, rnd, r, '#7a5c3a', '#a0985e', '#57502e', 0.16);
      // trainees de boue dans l'eau
      g.fillStyle = 'rgba(110,84,52,.35)';
      for (i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse((rnd() - 0.5) * r * 0.9, (rnd() - 0.5) * r * 0.55, r * (0.18 + rnd() * 0.16), r * (0.07 + rnd() * 0.06), rnd() * TAU, 0, TAU);
        g.fill();
      }
      glints(g, rnd, r, 0.14);
      // brindille flottante qui tangue
      var bx = (rnd() - 0.5) * r * 0.6, by = (rnd() - 0.5) * r * 0.4;
      var rock = Math.sin(PH * TAU) * 0.09 + (rnd() - 0.5) * 0.8;
      g.save(); g.translate(bx, by + Math.sin(PH * TAU * 2) * r * 0.012); g.rotate(rock);
      g.strokeStyle = '#6e5434'; g.lineWidth = Math.max(1, r * 0.05); g.lineCap = 'round';
      g.beginPath(); g.moveTo(-r * 0.3, 0); g.quadraticCurveTo(0, -r * 0.04, r * 0.32, r * 0.02); g.stroke();
      g.lineWidth = Math.max(0.7, r * 0.032);
      g.beginPath(); g.moveTo(r * 0.08, -r * 0.01); g.lineTo(r * 0.2, -r * 0.1) ; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = Math.max(0.6, r * 0.025);
      g.beginPath(); g.moveTo(-r * 0.28, r * 0.035); g.lineTo(r * 0.3, r * 0.055); g.stroke();
      g.restore();
      // bulles : 4 cycles decales — montent, grossissent, eclatent en petit anneau
      for (i = 0; i < 4; i++) {
        var ox = (rnd() - 0.5) * r * 0.9, oy = (rnd() - 0.5) * r * 0.5;
        var off = rnd();
        var bt = ((PH + off) % 1);
        var rise = bt * r * 0.16;
        if (bt < 0.82) { // montee
          var al = Math.min(1, bt / 0.15) * 0.55;
          var bs = r * (0.035 + 0.045 * bt);
          g.strokeStyle = 'rgba(225,225,195,' + al + ')';
          g.lineWidth = Math.max(0.6, r * 0.028);
          g.beginPath(); g.arc(ox, oy - rise, bs, 0, TAU); g.stroke();
          g.fillStyle = 'rgba(255,255,240,' + (al * 0.4) + ')';
          g.beginPath(); g.arc(ox - bs * 0.3, oy - rise - bs * 0.3, bs * 0.3, 0, TAU); g.fill();
        } else { // eclatement : anneau qui s'ouvre et s'estompe
          var pt = (bt - 0.82) / 0.18;
          g.strokeStyle = 'rgba(230,230,205,' + (0.5 * (1 - pt)) + ')';
          g.lineWidth = Math.max(0.6, r * 0.025);
          g.beginPath();
          g.ellipse(ox, oy - r * 0.132, r * (0.07 + pt * 0.08), r * (0.045 + pt * 0.05), 0, 0, TAU);
          g.stroke();
        }
      }
    }
  });

  // ------------------------------------------------------------------
  // 6. Bassin de pierres — onde centrale lente + reflet qui glisse
  // ------------------------------------------------------------------
  reg('water', {
    id: 'bassin-pierres', label: 'Bassin de pierres',
    anim: 'onde qui part du centre et s\'élargit, reflet miroir qui glisse',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      // assise de gravier sous le bassin
      g.fillStyle = '#b0a88f';
      g.beginPath(); g.ellipse(0, r * 0.06, r * 1.18, r * 0.95, 0, 0, TAU); g.fill();
      // eau calme miroir (contour a peine irregulier : bassin regle)
      var pts = pondPts(rnd, r, 14, 0.95, 0.08);
      g.fillStyle = waterFill(g, r, '#a8dcec', '#3f88ae');
      traceLoop(g, pts); g.fill();
      // reflet de ciel qui glisse doucement (grande tache claire)
      var gl = Math.sin(PH * TAU) * r * 0.08;
      g.save();
      traceLoop(g, pts); g.clip();
      g.fillStyle = 'rgba(255,255,255,.16)';
      g.beginPath(); g.ellipse(-r * 0.2 + gl, -r * 0.22, r * 0.55, r * 0.26, -0.35, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.1)';
      g.beginPath(); g.ellipse(r * 0.25 + gl * 0.6, r * 0.18, r * 0.3, r * 0.12, -0.35, 0, TAU); g.fill();
      // onde : un rond part du centre et s'elargit lentement, fondu
      var wt = PH, ease = 1 - (1 - wt) * (1 - wt);
      g.strokeStyle = 'rgba(255,255,255,' + (0.35 * (1 - wt) * Math.min(1, wt / 0.12)) + ')';
      g.lineWidth = Math.max(0.8, r * 0.04);
      g.beginPath(); g.ellipse(0, 0, r * (0.06 + ease * 0.62), r * (0.05 + ease * 0.48), 0, 0, TAU); g.stroke();
      // seconde onde plus discrete, a mi-chemin
      var w2 = (wt + 0.5) % 1, e2 = 1 - (1 - w2) * (1 - w2);
      g.strokeStyle = 'rgba(255,255,255,' + (0.2 * (1 - w2) * Math.min(1, w2 / 0.12)) + ')';
      g.beginPath(); g.ellipse(0, 0, r * (0.06 + e2 * 0.62), r * (0.05 + e2 * 0.48), 0, 0, TAU); g.stroke();
      g.restore();
      // bordure de pierres plates reglees, posees en couronne
      var nS = 9 + Math.floor(rnd() * 3);
      for (i = 0; i < nS; i++) {
        var a = (i / nS) * TAU + rnd() * 0.06;
        var sx = Math.cos(a) * r * 1.02, sy = Math.sin(a) * r * 0.82;
        var sw = r * (0.16 + rnd() * 0.05), sh = sw * 0.55;
        g.save(); g.translate(sx, sy); g.rotate(Math.atan2(sy * 1.25, sx) + Math.PI / 2);
        var sg = g.createLinearGradient(-sw, -sh, sw, sh);
        sg.addColorStop(0, '#a8a49a'); sg.addColorStop(1, '#6e6a60');
        g.fillStyle = sg;
        g.beginPath();
        g.moveTo(-sw, 0);
        g.quadraticCurveTo(-sw * 0.9, -sh, 0, -sh * (0.9 + rnd() * 0.2));
        g.quadraticCurveTo(sw * 0.9, -sh, sw, 0);
        g.quadraticCurveTo(sw * 0.9, sh, 0, sh * 0.95);
        g.quadraticCurveTo(-sw * 0.9, sh, -sw, 0);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.22)';
        g.beginPath(); g.ellipse(-sw * 0.2, -sh * 0.3, sw * 0.42, sh * 0.3, -0.2, 0, TAU); g.fill();
        if (rnd() < 0.4) { // mousse discrete
          g.fillStyle = 'rgba(122,160,90,.75)';
          g.beginPath(); g.ellipse(sw * 0.35, sh * 0.15, sw * 0.18, sh * 0.2, 0.5, 0, TAU); g.fill();
        }
        g.restore();
      }
    }
  });
})();
