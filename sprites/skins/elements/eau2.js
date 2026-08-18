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

  // Contour organique de flaque, deja aplati (ry = 0.8*rx).
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
  // Degrade d'eau : clair haut-gauche -> profond.
  function waterFill(g, r, c1, c2) {
    var gd = g.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.08, 0, 0, r * 1.05);
    gd.addColorStop(0, c1); gd.addColorStop(1, c2);
    return gd;
  }
  // Berge + eau (motif commun v1) ; renvoie les points du contour d'eau.
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
  // Petits arcs de reflets blancs.
  function glints(g, rnd, r, alpha, n) {
    g.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
    g.lineWidth = Math.max(1, r * 0.05);
    for (var i = 0; i < (n || 3); i++) {
      g.beginPath();
      g.arc((rnd() - 0.5) * r * 0.9, (rnd() - 0.5) * r * 0.55, r * (0.12 + rnd() * 0.18), Math.PI * 1.05, Math.PI * 1.9);
      g.stroke();
    }
  }
  // Halo elliptique tres doux (degrade radial -> transparent).
  // col = 'R,G,B' (chaine), a = alpha au centre, sy = aplatissement vertical.
  function softGlow(g, x, y, rad, sy, col, a) {
    g.save(); g.translate(x, y); g.scale(1, sy);
    var gd = g.createRadialGradient(0, 0, rad * 0.08, 0, 0, rad);
    gd.addColorStop(0, 'rgba(' + col + ',' + a + ')');
    gd.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = gd;
    g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.fill();
    g.restore();
  }
  // Galet LISSE style v2 : blob arrondi en degrade chaud + rehaut, zero facette.
  function smoothStone(g, rnd, x, y, w, h, rot, c1, c2) {
    g.save(); g.translate(x, y); g.rotate(rot);
    var gd = g.createLinearGradient(-w, -h, w * 0.8, h);
    gd.addColorStop(0, c1); gd.addColorStop(1, c2);
    g.fillStyle = gd;
    var j1 = 0.9 + rnd() * 0.2, j2 = 0.9 + rnd() * 0.2;
    g.beginPath();
    g.moveTo(-w, 0);
    g.quadraticCurveTo(-w * 0.95, -h * j1, 0, -h);
    g.quadraticCurveTo(w * 0.95, -h * j2, w, 0);
    g.quadraticCurveTo(w * 0.92, h * 0.95, 0, h);
    g.quadraticCurveTo(-w * 0.92, h * 0.95, -w, 0);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.beginPath(); g.ellipse(-w * 0.25, -h * 0.35, w * 0.42, h * 0.28, -0.3, 0, TAU); g.fill();
    g.restore();
  }

  // ------------------------------------------------------------------
  // 1. Etang au poisson II — berge fondue, ombre qui circule, saut ample
  // ------------------------------------------------------------------
  reg('water', {
    id: 'etang-poisson-2', label: 'Étang au poisson II',
    anim: 'ombre du poisson qui circule sous la surface, saut en arc haut avec 3 gouttes et ondes concentriques',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      // contour NON aplati : on dessine berge+eau sous scale(1,0.8) pour que
      // le degrade radial suive exactement le rivage (berge fondue, aucun trait)
      var pts = [], a, rr;
      for (i = 0; i < 12; i++) {
        a = i / 12 * TAU;
        rr = r * (0.94 + rnd() * 0.1);
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      g.save(); g.scale(1, 0.8);
      // assise de sable (meme contour, agrandi)
      g.fillStyle = '#cfc39a';
      g.save(); g.scale(1.18, 1.18); traceLoop(g, pts); g.fill(); g.restore();
      // eau : le degrade FINIT couleur sable => transition berge->eau fondue
      var gd = g.createRadialGradient(-r * 0.22, -r * 0.2, r * 0.08, 0, 0, r * 1.05);
      gd.addColorStop(0, '#8fd0e8');
      gd.addColorStop(0.5, '#5several');
      gd.addColorStop(0.78, '#3f88ae');
      gd.addColorStop(1, '#cfc39a');
      g.fillStyle = gd;
      traceLoop(g, pts); g.fill();
      g.restore();
      // 2 zones de profondeur douces (halos sombres, aucun bord)
      softGlow(g, -r * 0.28 + rnd() * r * 0.1, r * 0.12, r * 0.42, 0.7, '22,62,92', 0.3);
      softGlow(g, r * 0.3, -r * 0.14 + rnd() * r * 0.1, r * 0.3, 0.7, '22,62,92', 0.22);
      glints(g, rnd, r, 0.3);
      // orbite du poisson (ombre qui CIRCULE toute la boucle)
      function orb(t) {
        var th = t * TAU;
        return [Math.cos(th) * r * 0.38, Math.sin(th) * r * 0.24];
      }
      var J0 = 0.42, J1 = 0.66, jt = (PH - J0) / (J1 - J0);
      var SP = orb(PH), th = PH * TAU;
      var tangA = Math.atan2(Math.cos(th) * 0.63, -Math.sin(th));
      var sal = 0.3;
      if (jt >= 0 && jt <= 1) sal *= 1 - Math.sin(jt * Math.PI); // l'ombre s'efface pendant le saut
      if (sal > 0.02) {
        g.save(); g.translate(SP[0], SP[1]); g.rotate(tangA);
        g.fillStyle = 'rgba(16,48,70,' + sal + ')';
        g.beginPath(); g.ellipse(0, 0, r * 0.21, r * 0.075, 0, 0, TAU); g.fill();
        g.restore();
      }
      var P0 = orb(J0), P1 = orb(J1);
      // saut : arc haut et elegant entre position de decollage et d'amerrissage
      if (jt >= 0 && jt <= 1) {
        var e = jt;
        var fx = P0[0] + (P1[0] - P0[0]) * e;
        var fy = P0[1] + (P1[1] - P0[1]) * e - Math.sin(e * Math.PI) * r * 0.72;
        var dirA = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]);
        g.save(); g.translate(fx, fy); g.rotate(dirA + (e - 0.5) * 1.9);
        var fs = r * 0.19;
        var fgd = g.createLinearGradient(0, -fs * 0.45, 0, fs * 0.45);
        fgd.addColorStop(0, '#9cc2d2'); fgd.addColorStop(1, '#48788f');
        g.fillStyle = fgd;
        g.beginPath();
        g.moveTo(-fs, 0);
        g.quadraticCurveTo(0, -fs * 0.6, fs * 0.82, 0);
        g.quadraticCurveTo(0, fs * 0.55, -fs, 0);
        g.closePath(); g.fill();
        g.beginPath(); // queue
        g.moveTo(-fs * 0.88, 0); g.lineTo(-fs * 1.34, -fs * 0.4); g.lineTo(-fs * 1.24, fs * 0.34);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.32)';
        g.beginPath(); g.ellipse(fs * 0.08, -fs * 0.2, fs * 0.4, fs * 0.13, -0.2, 0, TAU); g.fill();
        g.restore();
        // 3 gouttes projetees a l'amerrissage
        if (e > 0.58) {
          var dt = (e - 0.58) / 0.42;
          for (i = 0; i < 3; i++) {
            var da = -Math.PI * (0.2 + i * 0.3);
            var dd = r * (0.08 + dt * 0.24) * (0.75 + i * 0.18);
            var dxp = P1[0] + Math.cos(da) * dd;
            var dyp = P1[1] + Math.sin(da) * dd + dt * dt * r * 0.14;
            g.fillStyle = 'rgba(235,248,252,' + (0.7 * (1 - dt)) + ')';
            g.beginPath(); g.arc(dxp, dyp, Math.max(0.6, r * 0.032 * (1 - dt * 0.4)), 0, TAU); g.fill();
          }
        }
      }
      // ondes concentriques qui s'elargissent en fondu apres l'amerrissage
      if (PH > J1) {
        var wt = (PH - J1) / (1 - J1);
        for (i = 0; i < 3; i++) {
          var w2 = (wt - i * 0.16) / (1 - i * 0.16);
          if (w2 <= 0 || w2 >= 1) continue;
          g.strokeStyle = 'rgba(255,255,255,' + (0.38 * (1 - w2) * Math.min(1, w2 / 0.1)) + ')';
          g.lineWidth = Math.max(0.7, r * 0.032);
          g.beginPath();
          g.ellipse(P1[0], P1[1], r * (0.06 + w2 * 0.48), r * (0.05 + w2 * 0.35), 0, 0, TAU);
          g.stroke();
        }
      }
    }
  });

  // ------------------------------------------------------------------
  // 2. Lagune turquoise — haut-fond sableux + vaguelettes qui glissent
  // ------------------------------------------------------------------
  reg('water', {
    id: 'lagune-turquoise', label: 'Lagune turquoise',
    anim: 'deux reflets-vaguelettes qui glissent en continu sur l\'eau claire',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      var pts = bankAndWater(g, rnd, r, '#e2d5a8', '#a6ecdf', '#2e7ca6', 0.12);
      g.save();
      traceLoop(g, pts); g.clip();
      // haut-fond sableux visible dans un coin (halo sable sous l'eau claire)
      var ca = rnd() * TAU;
      var hfx = Math.cos(ca) * r * 0.58, hfy = Math.sin(ca) * r * 0.46;
      softGlow(g, hfx, hfy, r * 0.58, 0.8, '234,214,164', 0.5);
      softGlow(g, hfx * 1.15, hfy * 1.15, r * 0.3, 0.8, '244,228,182', 0.4);
      // fosse turquoise profonde a l'oppose
      softGlow(g, -hfx * 0.7, -hfy * 0.7, r * 0.45, 0.8, '20,90,120', 0.3);
      // 2 reflets-vaguelettes qui traversent la lagune en continu (k entier)
      var wa = rnd() * Math.PI - Math.PI / 2; // direction de glisse seedee
      for (i = 0; i < 2; i++) {
        var off = i * 0.5 + rnd() * 0.1;
        var t = (PH + off) % 1;                 // 1 cycle entier chacun
        var al = 0.34 * Math.sin(t * Math.PI);  // fondu aux deux extremites
        if (al < 0.02) continue;
        var d = (t - 0.5) * r * 1.5;
        var vx = Math.cos(wa) * d + (rnd() - 0.5) * r * 0.2;
        var vy = Math.sin(wa) * d * 0.7 + (rnd() - 0.5) * r * 0.15;
        g.save(); g.translate(vx, vy); g.rotate(wa + Math.PI / 2);
        g.strokeStyle = 'rgba(255,255,255,' + al + ')';
        g.lineWidth = Math.max(0.9, r * 0.045); g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-r * 0.34, 0);
        g.quadraticCurveTo(0, -r * 0.07, r * 0.34, 0);
        g.stroke();
        g.lineWidth = Math.max(0.6, r * 0.025);
        g.beginPath();
        g.moveTo(-r * 0.2, r * 0.07);
        g.quadraticCurveTo(0, r * 0.02, r * 0.2, r * 0.07);
        g.stroke();
        g.restore();
      }
      g.restore();
      glints(g, rnd, r, 0.35, 2);
    }
  });

  // ------------------------------------------------------------------
  // 3. Mare brumeuse — eau sombre + nappes de brume qui derivent
  // ------------------------------------------------------------------
  reg('water', {
    id: 'mare-brumeuse', label: 'Mare brumeuse',
    anim: 'deux nappes de brume translucides qui dérivent lentement au-dessus de l\'eau sombre',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      bankAndWater(g, rnd, r, '#aa9c7c', '#6890a4', '#243c4e', 0.12);
      // reflets discrets sur l'eau calme
      glints(g, rnd, r, 0.14, 2);
      // silhouette d'arbre noyee dans le reflet (tache sombre douce)
      softGlow(g, (rnd() - 0.5) * r * 0.7, (rnd() - 0.5) * r * 0.4, r * 0.3, 0.7, '14,26,32', 0.35);
      // 2 nappes de brume : ellipses en degrade tres doux, alpha .10-.16,
      // derive en sinus k=1 (boucle sans couture) + respiration d'alpha
      for (i = 0; i < 2; i++) {
        var ph = rnd() * TAU;
        var bx = (rnd() - 0.5) * r * 0.5;
        var by = (rnd() - 0.5) * r * 0.45 - r * 0.08;
        var dx = Math.sin(PH * TAU + ph) * r * 0.17;
        var dy = Math.cos(PH * TAU + ph) * r * 0.045;
        var al = 0.13 + 0.03 * Math.sin(PH * TAU + ph + 1.3);
        softGlow(g, bx + dx, by + dy, r * (0.62 + rnd() * 0.18), 0.34, '235,240,242', al);
        // frange plus fine qui traine derriere la nappe
        softGlow(g, bx + dx * 1.4 - r * 0.12, by + dy + r * 0.07, r * 0.32, 0.28, '235,240,242', al * 0.8);
      }
    }
  });

  // ------------------------------------------------------------------
  // 4. Cascade miniature — surplomb lisse, filet scintillant, ecume
  // ------------------------------------------------------------------
  reg('water', {
    id: 'cascade-mini', label: 'Cascade miniature',
    anim: 'filet d\'eau qui scintille, écume à 3 bulles en cycles décalés, ondes au point de chute',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      // bassin (legerement decale vers le bas pour laisser la place au surplomb)
      g.save(); g.translate(0, r * 0.14);
      var pts = bankAndWater(g, rnd, r * 0.82, '#cfc39a', '#8fd0e8', '#3f88ae', 0.14);
      glints(g, rnd, r * 0.82, 0.3, 2);
      g.restore();
      var FX = r * 0.02, FY = -r * 0.24; // point de chute dans le bassin
      // ondes qui s'elargissent en continu depuis le point de chute (2 cycles decales)
      for (i = 0; i < 2; i++) {
        var wt = (PH + i * 0.5) % 1;
        var wal = 0.3 * Math.sin(wt * Math.PI); // fondu aux deux bouts
        if (wal > 0.02) {
          g.strokeStyle = 'rgba(255,255,255,' + wal + ')';
          g.lineWidth = Math.max(0.7, r * 0.03);
          g.beginPath();
          g.ellipse(FX, FY + r * 0.03, r * (0.08 + wt * 0.3), r * (0.05 + wt * 0.2), 0, 0, TAU);
          g.stroke();
        }
      }
      // surplomb rocheux LISSE (ombre douce d'abord, decalee)
      softGlow(g, -r * 0.02 + r * 0.08, -r * 0.5 + r * 0.12, r * 0.5, 0.5, '20,30,15', 0.22);
      smoothStone(g, rnd, -r * 0.3, -r * 0.5, r * 0.26, r * 0.19, -0.15, '#a8a49a', '#6e6a60');
      smoothStone(g, rnd, -r * 0.02, -r * 0.58, r * 0.36, r * 0.24, 0.08, mix('#a8a49a', '#b2a89a', 0.5), '#736e62');
      // touche de mousse sur le surplomb
      g.fillStyle = 'rgba(122,160,90,.6)';
      g.beginPath(); g.ellipse(-r * 0.2, -r * 0.62, r * 0.1, r * 0.045, 0.3, 0, TAU); g.fill();
      // filet d'eau qui tombe de la levre du surplomb dans le bassin
      var LX = r * 0.02, LY = -r * 0.42;
      g.strokeStyle = 'rgba(200,236,246,.85)';
      g.lineWidth = Math.max(1.1, r * 0.055); g.lineCap = 'round';
      g.beginPath();
      g.moveTo(LX, LY);
      g.quadraticCurveTo(LX + r * 0.03, (LY + FY) / 2, FX, FY);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.lineWidth = Math.max(0.6, r * 0.024);
      g.beginPath();
      g.moveTo(LX + r * 0.008, LY + r * 0.02);
      g.quadraticCurveTo(LX + r * 0.035, (LY + FY) / 2, FX + r * 0.008, FY - r * 0.02);
      g.stroke();
      // scintillement : 2 eclats qui descendent le filet (cycles k=2, fondu)
      for (i = 0; i < 2; i++) {
        var st = (PH * 2 + i * 0.5) % 1;
        var sal = 0.75 * Math.sin(st * Math.PI);
        if (sal < 0.03) continue;
        var sx = LX + (FX - LX) * st + r * 0.02 * Math.sin(st * Math.PI);
        var sy = LY + (FY - LY) * st;
        g.fillStyle = 'rgba(255,255,255,' + sal + ')';
        g.beginPath(); g.ellipse(sx, sy, Math.max(0.5, r * 0.02), Math.max(0.8, r * 0.045), 0, 0, TAU); g.fill();
      }
      // ecume au point de chute : dome blanc qui respire
      var puls = 1 + 0.1 * Math.sin(PH * TAU * 2);
      softGlow(g, FX, FY + r * 0.02, r * 0.16 * puls, 0.7, '255,255,255', 0.55);
      // 3 bulles en cycles decales : naissent dans l'ecume, derivent, eclatent
      for (i = 0; i < 3; i++) {
        var bo = rnd();
        var bdx = (rnd() - 0.5) * r * 0.3;
        var bt = (PH * 2 + bo) % 1; // 2 cycles entiers, fondu sinus
        var bal = 0.6 * Math.sin(bt * Math.PI);
        if (bal < 0.03) continue;
        var bxx = FX + bdx * bt, byy = FY + r * 0.05 + bt * r * 0.1;
        var bs = Math.max(0.6, r * (0.03 + bt * 0.03));
        g.strokeStyle = 'rgba(255,255,255,' + bal + ')';
        g.lineWidth = Math.max(0.5, r * 0.022);
        g.beginPath(); g.arc(bxx, byy, bs, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(255,255,255,' + (bal * 0.5) + ')';
        g.beginPath(); g.arc(bxx - bs * 0.3, byy - bs * 0.3, bs * 0.3, 0, TAU); g.fill();
      }
    }
  });

  // ------------------------------------------------------------------
  // 5. Mare aux lucioles — points chauds qui clignotent + reflets
  // ------------------------------------------------------------------
  reg('water', {
    id: 'mare-lucioles', label: 'Mare aux lucioles',
    anim: '4-5 lucioles qui clignotent et dérivent en déphasage, reflets chauds dans l\'eau',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed), PH = (animT % 3.2) / 3.2, i;
      var pts = bankAndWater(g, rnd, r, '#948466', '#54789e', '#1c3048', 0.12);
      // lueur crepusculaire froide sur un bord de l'eau
      g.save(); traceLoop(g, pts); g.clip();
      softGlow(g, -r * 0.3, -r * 0.3, r * 0.5, 0.8, '150,180,214', 0.16);
      g.restore();
      glints(g, rnd, r, 0.12, 2);
      // herbes sombres de la berge (2 touffes discretes)
      for (i = 0; i < 2; i++) {
        var ha = rnd() * TAU;
        var hbx = Math.cos(ha) * r * 1.0, hby = Math.sin(ha) * r * 0.8;
        g.strokeStyle = i ? '#3e5e28' : '#4c6a32';
        g.lineWidth = Math.max(0.7, r * 0.03); g.lineCap = 'round';
        for (var k = 0; k < 3; k++) {
          var hh = r * (0.16 + rnd() * 0.1);
          var hl = (rnd() - 0.5) * r * 0.1;
          g.beginPath(); g.moveTo(hbx + k * r * 0.035, hby);
          g.quadraticCurveTo(hbx + hl * 0.4, hby - hh * 0.6, hbx + hl + k * r * 0.02, hby - hh);
          g.stroke();
        }
      }
      // 5 lucioles : derive en sinus k=1 (boucle propre), clignotement
      // dephase avec fondu (sin k=2 redresse), reflet chaud dans l'eau
      var nF = 5;
      for (i = 0; i < nF; i++) {
        var bx = (rnd() - 0.5) * r * 1.05;
        var by = (rnd() - 0.5) * r * 0.6 - r * 0.12;
        var p1 = rnd() * TAU, p2 = rnd() * TAU, pb = rnd() * TAU;
        var fx = bx + Math.sin(PH * TAU + p1) * r * 0.11;
        var fy = by + Math.cos(PH * TAU + p2) * r * 0.07;
        var tw = Math.sin(PH * TAU * 2 + pb);
        tw = tw > 0 ? tw : 0; // eteinte la moitie du temps, fondu naturel
        if (tw < 0.04) continue;
        // reflet dans l'eau : halo chaud aplati juste sous la luciole
        softGlow(g, fx, fy + r * 0.16, r * 0.13, 0.4, '255,196,110', 0.3 * tw);
        g.fillStyle = 'rgba(255,210,120,' + (0.25 * tw) + ')';
        g.beginPath(); g.ellipse(fx, fy + r * 0.16, r * 0.045, r * 0.018, 0, 0, TAU); g.fill();
        // halo puis coeur de la luciole
        softGlow(g, fx, fy, r * (0.1 + 0.05 * tw), 1, '255,214,120', 0.55 * tw);
        g.fillStyle = 'rgba(255,240,190,' + (0.9 * tw) + ')';
        g.beginPath(); g.arc(fx, fy, Math.max(0.6, r * 0.026), 0, TAU); g.fill();
      }
    }
  });
})();
