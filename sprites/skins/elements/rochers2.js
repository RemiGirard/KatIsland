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

  // silhouette PLEINE et LISSE : sommets à peine jitterés, reliés par
  // courbes quadratiques passant par les milieux (aucune arête dure)
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
  // ombre portée au sol (TOUJOURS dessinée avant le corps)
  function ground(g, r, rx, ry, al) {
    g.fillStyle = 'rgba(20,30,15,' + al + ')';
    g.beginPath(); g.ellipse(r * 0.2, r * 0.3, rx, ry, 0, 0, TAU); g.fill();
  }
  // dégradé granit chaud, lumière haut-gauche
  function stoneGrad(g, r, cLite, cDark) {
    var gd = g.createLinearGradient(-r * 0.85, -r * 0.95, r * 0.7, r * 0.75);
    gd.addColorStop(0, cLite); gd.addColorStop(1, cDark);
    return gd;
  }
  // rehaut blanc doux (ellipse haut-gauche)
  function sheen(g, x, y, rx, ry, al, rot) {
    g.fillStyle = 'rgba(255,255,255,' + al + ')';
    g.beginPath(); g.ellipse(x, y, rx, ry, rot || -0.4, 0, TAU); g.fill();
  }
  // brin d'herbe effilé
  function blade(g, x, y, dx, h, w, col) {
    g.strokeStyle = col; g.lineCap = 'round';
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx * 0.35, y - h * 0.6, x + dx, y - h); g.stroke();
    g.lineWidth = w * 0.5;
    g.beginPath(); g.moveTo(x + dx * 0.5, y - h * 0.75); g.lineTo(x + dx, y - h); g.stroke();
  }
  function reg(slot, v) { var R = window.LAB_ELEMENTS.variants; (R[slot] = R[slot] || []).push(v); }

  // ============================================================
  // ROCHERS v2 — silhouettes simples et pleines, gris chauds,
  // 2 teintes max + un accent, détails minuscules et rares.
  // ============================================================

  // 1. Roc en dôme — LE rocher par défaut : un seul dôme patatoïde
  reg('rock', { id: 'roc-dome', label: 'Roc en dôme', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      var rot = rnd() * 0.8;
      // même silhouette pour fill puis clip : prng dédié à la forme
      function domePath() { smoothBlob(g, 0, -r * 0.1, r * 0.98, r * 0.8, 8, prng((seed | 0) + 7), 0.9, 0.14, rot); }
      ground(g, r, r * 1.0, r * 0.48, 0.20);
      // dôme bien plein, jitter minime => silhouette nette
      g.fillStyle = stoneGrad(g, r, '#aeaaa0', '#6e6a60');
      domePath();
      g.fill();
      // strate claire horizontale très douce (clip sur le dôme)
      g.save();
      domePath();
      g.clip();
      var sy = -r * (0.05 + rnd() * 0.12), sh = r * 0.16;
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath();
      g.moveTo(-r * 1.2, sy);
      g.quadraticCurveTo(0, sy - r * 0.12, r * 1.2, sy);
      g.lineTo(r * 1.2, sy + sh);
      g.quadraticCurveTo(0, sy + sh - r * 0.12, -r * 1.2, sy + sh);
      g.closePath(); g.fill();
      g.restore();
      // rehaut haut-gauche
      sheen(g, -r * 0.3, -r * 0.48, r * 0.34, r * 0.17, 0.24);
      // 2 brins d'herbe au pied, c'est tout
      blade(g, -r * (0.55 + rnd() * 0.25), r * 0.5, -r * 0.14, r * (0.34 + rnd() * 0.16), Math.max(0.7, r * 0.07), '#588838');
      blade(g, r * (0.6 + rnd() * 0.2), r * 0.52, r * 0.16, r * (0.3 + rnd() * 0.14), Math.max(0.6, r * 0.06), '#78a858');
    } });

  // 2. Duo adossé — un grand + un petit épaulés, composition à la seed
  reg('rock', { id: 'roc-duo', label: 'Duo adossé', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      var side = rnd() < 0.5 ? -1 : 1;              // le petit à gauche ou à droite
      var smallR = r * (0.42 + rnd() * 0.12);
      var bx = -side * r * 0.22, by = -r * 0.14;    // grand, léger recul
      var sx = side * r * 0.62, sy = r * 0.12;      // petit, devant, épaulé
      ground(g, r, r * 1.12, r * 0.5, 0.20);
      // grand dôme derrière
      g.fillStyle = stoneGrad(g, r, '#aeaaa0', '#6e6a60');
      smoothBlob(g, bx, by, r * 0.82, r * 0.72, 8, rnd, 0.9, 0.14, rnd());
      g.fill();
      sheen(g, bx - r * 0.26, by - r * 0.36, r * 0.28, r * 0.14, 0.24);
      // ombre mutuelle propre : le petit assombrit doucement le flanc du grand
      g.fillStyle = 'rgba(40,36,30,0.14)';
      g.beginPath();
      g.ellipse(sx - side * smallR * 0.5, sy - smallR * 0.25, smallR * 0.85, smallR * 0.7, side * 0.3, 0, TAU);
      g.fill();
      // petit dôme devant, une pointe plus chaud
      g.fillStyle = stoneGrad(g, smallR * 2, mix('#aeaaa0', '#b3a48e', 0.3), mix('#6e6a60', '#7a705e', 0.4));
      smoothBlob(g, sx, sy, smallR, smallR * 0.82, 7, rnd, 0.9, 0.14, rnd());
      g.fill();
      sheen(g, sx - smallR * 0.3, sy - smallR * 0.4, smallR * 0.4, smallR * 0.2, 0.22);
    } });

  // 3. Dalles empilées — 3 dalles plates et lisses, très zen
  reg('rock', { id: 'dalle-empilee', label: 'Dalles empilées', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      ground(g, r, r * 1.0, r * 0.46, 0.22);
      var widths = [1.0, 0.82, 0.62];
      var y = r * 0.34;                              // pose de la pile
      for (var i = 0; i < 3; i++) {
        var rx = r * widths[i] * (0.96 + rnd() * 0.08);
        var ry = rx * 0.34;
        var th = r * (0.2 - i * 0.03);               // dalles un peu plus fines en haut
        var off = (i === 0 ? 0 : (i % 2 ? 1 : -1)) * r * (0.06 + rnd() * 0.08); // débords alternés
        var tint = mix('#a8a49a', '#b3a48e', 0.12 + rnd() * 0.2); // gris chaud, nuance par dalle
        var topY = y - th;
        g.save();
        g.translate(off, 0);
        g.rotate((rnd() - 0.5) * 0.04);              // à peine posé de travers
        // tranche (flanc) : teinte sombre unie, aucune ligne
        g.fillStyle = mix(tint, '#6e6a60', 0.72);
        g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, TAU); g.fill();
        g.fillRect(-rx, topY, rx * 2, th);
        // face supérieure : dégradé doux haut-gauche
        var gd = g.createLinearGradient(-rx * 0.8, topY - ry, rx * 0.7, topY + ry);
        gd.addColorStop(0, shade(tint, 0.14)); gd.addColorStop(1, mix(tint, '#6e6a60', 0.45));
        g.fillStyle = gd;
        g.beginPath(); g.ellipse(0, topY, rx, ry, 0, 0, TAU); g.fill();
        g.restore();
        y = topY + th * 0.1;                         // la suivante se pose dessus
      }
      // unique rehaut satiné sur la dalle du sommet
      sheen(g, -r * 0.18, y - r * 0.05, r * 0.26, r * 0.08, 0.22, -0.15);
    } });

  // 4. Roc strié — dôme aux strates sédimentaires en courbes douces
  reg('rock', { id: 'roc-strie', label: 'Roc strié', anim: 'aucune',
    draw: function (g, r, seed) {
      var rnd = prng(seed);
      var rot = rnd() * 0.9;
      // même silhouette pour fill puis clip : prng dédié à la forme
      function domePath() { smoothBlob(g, 0, -r * 0.1, r, r * 0.82, 8, prng((seed | 0) + 13), 0.9, 0.13, rot); }
      ground(g, r, r * 1.02, r * 0.48, 0.20);
      // dôme plein
      g.fillStyle = stoneGrad(g, r, '#b0aca2', '#6e6a60');
      domePath();
      g.fill();
      // strates : bandes translucides courbes clippées, AUCUNE ligne
      g.save();
      domePath();
      g.clip();
      var ns = 3 + ((rnd() * 2) | 0);                // 3-4 strates
      for (var i = 0; i < ns; i++) {
        var sy = -r * 0.62 + (i + 0.5) * (r * 1.5 / ns) + (rnd() - 0.5) * r * 0.06;
        var sh = r * (0.14 + rnd() * 0.08);
        var dip = r * (0.08 + rnd() * 0.08);         // courbure douce
        // alternance gris clair / ocre discret
        g.fillStyle = (i % 2)
          ? 'rgba(179,150,105,0.16)'                 // accent ocre
          : 'rgba(255,255,255,0.09)';
        g.beginPath();
        g.moveTo(-r * 1.3, sy);
        g.quadraticCurveTo(0, sy - dip, r * 1.3, sy);
        g.lineTo(r * 1.3, sy + sh);
        g.quadraticCurveTo(0, sy + sh - dip, -r * 1.3, sy + sh);
        g.closePath(); g.fill();
      }
      g.restore();
      // rehaut haut-gauche
      sheen(g, -r * 0.3, -r * 0.5, r * 0.32, r * 0.16, 0.22);
    } });

  // 5. Pierre de lune — galet géant très lisse, rehaut satiné qui glisse à peine
  reg('rock', { id: 'pierre-lune', label: 'Pierre de lune', anim: 'le rehaut satiné glisse très légèrement (k=1, ±r*0.04)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var slide = Math.sin(PH * TAU) * r * 0.04;     // k=1, subtil
      ground(g, r, r * 0.98, r * 0.46, 0.20);
      var tilt = (rnd() - 0.5) * 0.14;
      g.save();
      g.rotate(tilt);
      // galet parfait : simple ellipse, dégradé radial nacré haut-gauche
      var gd = g.createRadialGradient(-r * 0.34, -r * 0.42, r * 0.08, 0, -r * 0.05, r * 1.15);
      gd.addColorStop(0, '#c6c2b8');
      gd.addColorStop(0.55, '#a8a49a');
      gd.addColorStop(1, '#75716a');
      g.fillStyle = gd;
      g.beginPath(); g.ellipse(0, -r * 0.05, r, r * 0.78, 0, 0, TAU); g.fill();
      // rehaut satiné en croissant : deux arcs épais et doux, qui glissent
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.26)';
      g.lineWidth = Math.max(1, r * 0.13);
      g.beginPath(); g.arc(slide, -r * 0.05, r * 0.62, Math.PI * 1.08, Math.PI * 1.62); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = Math.max(0.7, r * 0.07);
      g.beginPath(); g.arc(slide * 0.7, -r * 0.05, r * 0.46, Math.PI * 1.12, Math.PI * 1.55); g.stroke();
      // minuscule éclat clair (seul détail)
      var ex = -r * (0.15 + rnd() * 0.2), ey = -r * (0.3 + rnd() * 0.15);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.arc(ex, ey, Math.max(0.6, r * 0.045), 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = Math.max(0.4, r * 0.02);
      var es = r * 0.1;
      g.beginPath(); g.moveTo(ex - es, ey); g.lineTo(ex + es, ey);
      g.moveTo(ex, ey - es); g.lineTo(ex, ey + es); g.stroke();
      g.restore();
    } });
})();
