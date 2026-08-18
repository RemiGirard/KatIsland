"use strict";
/* ============================================================
   LAB — arbres3.js (SÉRIE 3)
   4 arbres vus de dessus pour le slot 'tree' (ids préfixés 'a3-') :
   - a3-base-v2     : l'arbre rond ACTUEL du terrain, enfin fini
                      (lobes fondus sans délimitation, lumière côté
                      soleil, pointe de tronc, houle + feuilles)
   - a3-bouleau     : bouleau clair au feuillage léger qui scintille
   - a3-pin-parasol : pin parasol à trois étages d'aiguilles
   - a3-sorbier     : sorbier aux baies rouges picoré par un oiseau
   Boucle d'animation EXACTE : 3.2 s. Self-contained : ne touche
   qu'à window.LAB_ELEMENTS. Aucun aléa non déterministe.
   ============================================================ */
window.LAB_ELEMENTS = window.LAB_ELEMENTS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers locaux (recopiés, self-contained) ----------
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

  // tache radiale très douce SANS bord (modelé du feuillage — sous clip)
  function patch(g, x, y, rr, col, al) {
    var pg = g.createRadialGradient(x, y, 0, x, y, rr);
    pg.addColorStop(0, rgba(col, al));
    pg.addColorStop(1, rgba(col, 0));
    g.fillStyle = pg;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }

  // trait quadratique effilé (branches fines, mèches)
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

  // contour organique FIGÉ : les irrégularités sont tirées UNE fois à la
  // création, le tracé est donc retraçable à l'identique (fill puis clip)
  // sans jonglage de séquence prng. SANS beginPath (multi-lobes = 1 chemin).
  function mkBlob(cx, cy, rx, ry, n, rnd, jmin, jspan, rot) {
    var ks = [];
    for (var i = 0; i < n; i++) ks.push(jmin + rnd() * jspan);
    return function (g) {
      for (var j = 0; j < n; j++) {
        var a = j / n * TAU + (rot || 0);
        var px = cx + Math.cos(a) * rx * ks[j], py = cy + Math.sin(a) * ry * ks[j];
        j ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
    };
  }

  // couronne d'aiguilles FIGÉE : étoile à n pointes (rayons ext/int alternés),
  // légèrement aplatie verticalement (vue 3/4 très douce)
  function mkSpikes(rOut, rIn, n, rnd, rot) {
    var ks = [];
    for (var i = 0; i < n * 2; i++) ks.push(0.88 + rnd() * 0.24);
    return function (g) {
      for (var j = 0; j < n * 2; j++) {
        var a = j / (n * 2) * TAU + rot;
        var rad = (j % 2 === 0 ? rOut : rIn) * ks[j];
        var px = Math.cos(a) * rad, py = Math.sin(a) * rad * 0.92;
        j ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
    };
  }

  // trace un chemin unique à partir d'une liste de contours figés
  function pathOf(g, tracers) {
    g.beginPath();
    for (var i = 0; i < tracers.length; i++) tracers[i](g);
  }

  function reg(slot, v) { var R = window.LAB_ELEMENTS.variants; (R[slot] = R[slot] || []).push(v); }

  // ============================================================
  // 1) ARBRE V2 (BASE ANIMÉE) — la silhouette RONDE actuelle du
  //    terrain, gardée à l'identique (disque de rayon r + ombre
  //    décalée), mais finie : lobes fondus par taches radiales
  //    douces (aucun cercle visible), lumière côté soleil
  //    (haut-gauche), pointe de tronc au bas.
  //    Anim : houle très douce (k=1) + 2 feuilles qui se détachent.
  // ============================================================
  reg('tree', { id: 'a3-base-v2', label: 'Arbre v2 (base animée)',
    anim: 'houle douce du feuillage (k=1) + deux feuilles qui se détachent en cycle fondu',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;

      // ----- paramètres seedés, tirés UNE fois en tête (ordre fixe) -----
      var nl = 2 + ((rnd() * 2) | 0);                    // 2-3 lobes internes
      var la = [], lr = [];
      for (var i = 0; i < nl; i++) {
        la.push((i + 0.3) / nl * TAU + rnd() * 0.5);     // angle du sommet de lobe
        lr.push(r * (0.46 + rnd() * 0.14));              // rayon de la tache claire
      }
      var glints = [];                                   // petites touches feuillues
      for (i = 0; i < 4; i++) {
        glints.push([ -r * (0.05 + rnd() * 0.45), -r * (0.15 + rnd() * 0.4),
                      r * (0.08 + rnd() * 0.05), rnd() * 2 ]);
      }
      var leaves = [];                                   // 2 feuilles détachées
      for (i = 0; i < 2; i++) {
        var aa = rnd() * TAU;
        leaves.push([ i * 0.47 + rnd() * 0.12,           // décalage de cycle
                      Math.cos(aa) * r * 0.55,           // départ x (bord de couronne)
                      Math.sin(aa) * r * 0.4 ]);         // départ y
      }
      var tside = rnd() < 0.5 ? -1 : 1;                  // côté de la pointe de tronc

      // ----- ombre au sol : même décalage que l'arbre actuel (+3,+4) -----
      ground(g, 3 * k, 4 * k, r * 1.0, r * 0.52, 0.20);

      // ----- pointe de tronc visible au bas de la couronne -----
      g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = Math.max(1, r * 0.2);
      g.beginPath();
      g.moveTo(tside * r * 0.1, r * 1.06);
      g.quadraticCurveTo(tside * r * 0.04, r * 0.88, 0, r * 0.68);
      g.stroke();
      g.strokeStyle = '#6e5434'; g.lineWidth = Math.max(0.6, r * 0.075);
      g.beginPath();
      g.moveTo(tside * r * 0.09, r * 1.03);
      g.quadraticCurveTo(tside * r * 0.05, r * 0.9, tside * r * 0.02, r * 0.76);
      g.stroke();

      // ----- houle très douce : scale/offset sinusoïdaux (k=1) -----
      var sw = Math.sin(PH * TAU), cw = Math.cos(PH * TAU);
      g.save();
      g.translate(sw * r * 0.012, cw * r * 0.008);
      g.scale(1 + sw * 0.012, 1 - sw * 0.008);

      // disque EXACT de rayon r, dégradé radial décentré (comme l'actuel, raffiné)
      var cg = g.createRadialGradient(-r * 0.32, -r * 0.34, r * 0.08, 0, 0, r * 1.02);
      cg.addColorStop(0, shade('#78a858', 0.34));
      cg.addColorStop(0.55, '#588838');
      cg.addColorStop(1, mix('#3e5e28', '#2c451c', 0.35));
      g.fillStyle = cg;
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();

      // ----- modelé sous clip : lobes FONDUS, aucune délimitation -----
      g.save();
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.clip();
      for (i = 0; i < nl; i++) {
        var lx = Math.cos(la[i]) * r * 0.42, ly = Math.sin(la[i]) * r * 0.38 - r * 0.05;
        // sommet de lobe : clarté douce…
        patch(g, lx, ly, lr[i], shade('#78a858', 0.42), 0.32);
        // …et creux ombré à mi-chemin du lobe suivant (la « vallée » fondue)
        var a2 = la[i] + TAU / nl * 0.5;
        patch(g, Math.cos(a2) * r * 0.52, Math.sin(a2) * r * 0.46, r * 0.3, '#2c451c', 0.20);
      }
      // lumière côté soleil (haut-gauche), en deux passes très douces
      patch(g, -r * 0.34, -r * 0.38, r * 0.52, '#ffffff', 0.18);
      patch(g, -r * 0.14, -r * 0.56, r * 0.32, shade('#78a858', 0.6), 0.26);
      // ombre de masse côté opposé + assise sombre en bas
      patch(g, r * 0.42, r * 0.4, r * 0.55, '#24401a', 0.28);
      patch(g, 0, r * 0.64, r * 0.6, '#2c451c', 0.22);
      // touches feuillues côté soleil (petites virgules claires)
      for (i = 0; i < glints.length; i++) {
        var G = glints[i];
        g.fillStyle = 'rgba(255,255,255,.13)';
        g.beginPath(); g.ellipse(G[0], G[1], G[2], G[2] * 0.45, G[3], 0, TAU); g.fill();
      }
      g.restore();   // clip
      g.restore();   // houle

      // ----- 2 feuilles qui se détachent, cycles décalés + fondu aux 2 bouts -----
      for (i = 0; i < leaves.length; i++) {
        var L = leaves[i];
        var t = (PH + L[0]) % 1;
        var al = t < 0.12 ? t / 0.12 : (t > 0.72 ? Math.max(0, (1 - t) / 0.28) : 1);
        if (al <= 0) continue;
        var dir = L[1] >= 0 ? 1 : -1;
        var fx = L[1] + dir * t * r * 0.3 + Math.sin(t * TAU * 2) * r * 0.09;
        var fy = L[2] + t * r * 1.1;
        g.globalAlpha = al * 0.9;
        g.fillStyle = mix('#78a858', '#e8c85a', 0.3 + i * 0.2);
        g.save();
        g.translate(fx, fy); g.rotate(t * TAU * 2 + i * 1.7);
        g.beginPath(); g.ellipse(0, 0, r * 0.065, r * 0.032, 0, 0, TAU); g.fill();
        // nervure centrale minuscule
        g.strokeStyle = 'rgba(90,110,50,.55)'; g.lineWidth = Math.max(0.3, r * 0.012);
        g.beginPath(); g.moveTo(-r * 0.05, 0); g.lineTo(r * 0.05, 0); g.stroke();
        g.restore();
        g.globalAlpha = 1;
      }
    } });

  // ============================================================
  // 2) BOULEAU CLAIR — feuillage léger vert tendre, tronc blanc
  //    à marques sombres, branches blanches entrevues dans les
  //    éclaircies, deux touffes détachées bien aériennes.
  //    Anim : scintillement des feuilles en déphasage (k=2)
  //    + frisson très léger de la couronne (k=1).
  // ============================================================
  reg('tree', { id: 'a3-bouleau', label: 'Bouleau clair',
    anim: 'scintillement des feuilles en déphasage (k=2) + frisson léger de la couronne (k=1)',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;

      // ----- paramètres seedés (ordre fixe) -----
      var tracers = [
        mkBlob(0, -r * 0.12, r * 0.68, r * 0.54, 10, rnd, 0.8, 0.28, 0.4),
        mkBlob(-r * 0.38, r * 0.04, r * 0.38, r * 0.3, 9, rnd, 0.78, 0.3, 1.3),
        mkBlob(r * 0.4, -r * 0.04, r * 0.36, r * 0.28, 9, rnd, 0.78, 0.3, 2.2)
      ];
      // touffes détachées (feuillage aéré) : angle, distance, taille
      var tufts = [];
      for (var i = 0; i < 2; i++) {
        var ta = -0.4 - i * 2.2 + rnd() * 0.7;
        tufts.push({
          x: Math.cos(ta) * r * (0.82 + rnd() * 0.12),
          y: Math.sin(ta) * r * (0.6 + rnd() * 0.1) - r * 0.1,
          s: r * (0.13 + rnd() * 0.05),
          tr: mkBlob(0, 0, 1, 0.8, 8, rnd, 0.78, 0.32, rnd() * TAU)
        });
      }
      // scintillements : position, taille, phase, rotation
      var glints = [];
      for (i = 0; i < 7; i++) {
        glints.push([ (rnd() - 0.5) * r * 1.15, -r * 0.12 + (rnd() - 0.5) * r * 0.85,
                      r * (0.05 + rnd() * 0.045), rnd(), rnd() * 3 ]);
      }
      var bmarks = [ r * 0.95, r * 0.8, r * 0.66 ];      // hauteurs des marques du tronc

      ground(g, 3 * k, 4 * k, r * 1.0, r * 0.5, 0.18);

      // ----- tronc blanc de bouleau, marques sombres -----
      g.strokeStyle = '#ece9dd'; g.lineCap = 'round'; g.lineWidth = Math.max(1, r * 0.14);
      g.beginPath();
      g.moveTo(-r * 0.02, r * 1.04);
      g.quadraticCurveTo(-r * 0.06, r * 0.78, -r * 0.02, r * 0.46);
      g.stroke();
      // flanc ombré du tronc
      g.strokeStyle = 'rgba(120,116,104,.45)'; g.lineWidth = Math.max(0.5, r * 0.04);
      g.beginPath();
      g.moveTo(r * 0.035, r * 1.0);
      g.quadraticCurveTo(0, r * 0.78, r * 0.03, r * 0.52);
      g.stroke();
      // marques horizontales caractéristiques
      g.strokeStyle = 'rgba(42,42,36,.6)'; g.lineWidth = Math.max(0.5, r * 0.035);
      for (i = 0; i < bmarks.length; i++) {
        var mxx = -r * 0.045 + (i % 2) * r * 0.02;
        g.beginPath(); g.moveTo(mxx, bmarks[i]); g.lineTo(mxx + r * 0.075, bmarks[i] - r * 0.012); g.stroke();
      }

      // ----- frisson léger : skew k=1 très subtil -----
      var sw = Math.sin(PH * TAU);
      g.save();
      g.translate(0, -r * 0.05);
      g.transform(1 + sw * 0.008, 0, sw * 0.022, 1, 0, 0);

      // masse principale : UN chemin, UN dégradé (vert tendre lumineux)
      pathOf(g, tracers);
      var cg = g.createRadialGradient(-r * 0.28, -r * 0.42, r * 0.08, 0, -r * 0.05, r * 1.0);
      cg.addColorStop(0, shade('#a6c868', 0.34));
      cg.addColorStop(0.6, '#94ba5c');
      cg.addColorStop(1, mix('#7ba24e', '#5a7a3a', 0.6));
      g.fillStyle = cg;
      g.fill();

      // ----- modelé + branches blanches entrevues, sous clip -----
      g.save();
      pathOf(g, tracers);
      g.clip();
      // éclaircies : le feuillage léger laisse deviner les branches claires
      patch(g, -r * 0.1, -r * 0.02, r * 0.24, '#5a7a3a', 0.32);
      patch(g, r * 0.22, -r * 0.3, r * 0.2, '#5a7a3a', 0.26);
      taperQ(g, -r * 0.06, r * 0.14, -r * 0.14, -r * 0.12, -r * 0.34, -r * 0.34,
        Math.max(0.7, r * 0.05), Math.max(0.4, r * 0.018), rgba('#ece9dd', 0.6));
      taperQ(g, -r * 0.02, r * 0.1, r * 0.14, -r * 0.1, r * 0.34, -r * 0.36,
        Math.max(0.7, r * 0.05), Math.max(0.4, r * 0.018), rgba('#ece9dd', 0.55));
      // petites marques sombres sur les branches (écorce de bouleau)
      g.strokeStyle = 'rgba(42,42,36,.4)'; g.lineWidth = Math.max(0.4, r * 0.02);
      g.beginPath(); g.moveTo(-r * 0.2, -r * 0.2); g.lineTo(-r * 0.16, -r * 0.17); g.stroke();
      g.beginPath(); g.moveTo(r * 0.2, -r * 0.2); g.lineTo(r * 0.24, -r * 0.18); g.stroke();
      // lumière haut-gauche + assise ombrée
      patch(g, -r * 0.3, -r * 0.42, r * 0.42, '#ffffff', 0.22);
      patch(g, r * 0.05, r * 0.26, r * 0.55, '#5a7a3a', 0.3);
      patch(g, r * 0.5, r * 0.02, r * 0.3, '#5a7a3a', 0.2);
      // scintillement : chaque glint pulse en déphasage (k=2, phase seedée)
      for (i = 0; i < glints.length; i++) {
        var G = glints[i];
        var tw = 0.5 + 0.5 * Math.sin(PH * TAU * 2 + G[3] * TAU);
        g.fillStyle = rgba('#f2f6d8', 0.07 + tw * 0.26);
        g.beginPath(); g.ellipse(G[0], G[1], G[2], G[2] * 0.5, G[4], 0, TAU); g.fill();
      }
      g.restore();   // clip

      // ----- touffes détachées, aériennes (dans le même frisson) -----
      for (i = 0; i < tufts.length; i++) {
        var T = tufts[i];
        g.save();
        g.translate(T.x, T.y);
        g.scale(T.s, T.s);
        g.beginPath(); T.tr(g);
        var tg = g.createRadialGradient(-0.3, -0.4, 0.1, 0, 0, 1.1);
        tg.addColorStop(0, shade('#a6c868', 0.4));
        tg.addColorStop(1, mix('#7ba24e', '#5a7a3a', 0.5));
        g.fillStyle = tg;
        g.fill();
        g.restore();
        // le glint de la touffe scintille aussi (k=2, phase liée à i)
        var tw2 = 0.5 + 0.5 * Math.sin(PH * TAU * 2 + i * 2.4);
        g.fillStyle = rgba('#f2f6d8', 0.1 + tw2 * 0.2);
        g.beginPath(); g.ellipse(T.x - T.s * 0.25, T.y - T.s * 0.3, T.s * 0.35, T.s * 0.18, 0.6, 0, TAU); g.fill();
      }
      g.restore();   // frisson
    } });

  // ============================================================
  // 3) PIN PARASOL — trois étages d'aiguilles en couronnes
  //    étoilées, décalés vers le haut-gauche (vue 3/4 douce),
  //    tronc roux qui dépasse en bas à droite, bourgeon au sommet.
  //    Anim : les étages oscillent en rotation en contre-phase
  //    (k=1 et k=2), le bourgeon scintille doucement (k=1).
  // ============================================================
  reg('tree', { id: 'a3-pin-parasol', label: 'Pin parasol',
    anim: 'étages qui oscillent en rotation en contre-phase (k=1 / k=2) + bourgeon qui scintille',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;

      // ----- étages seedés (ordre fixe) : du bas vers le haut -----
      var tiers = [
        { x: 0,          y: 0,          ro: r * 0.98, ri: r * 0.76, n: 14,
          c0: '#3c6e40', c1: '#1f3d24', rot: rnd() * TAU, tr: null, tex: [] },
        { x: -r * 0.06,  y: -r * 0.1,   ro: r * 0.66, ri: r * 0.5,  n: 11,
          c0: '#4a8050', c1: '#28522e', rot: rnd() * TAU, tr: null, tex: [] },
        { x: -r * 0.1,   y: -r * 0.18,  ro: r * 0.38, ri: r * 0.27, n: 8,
          c0: '#5a9458', c1: '#33633a', rot: rnd() * TAU, tr: null, tex: [] }
      ];
      for (var i = 0; i < tiers.length; i++) {
        var T = tiers[i];
        T.tr = mkSpikes(T.ro, T.ri, T.n, rnd, T.rot);
        // texture d'aiguilles : rayons seedés (angle + longueur)
        var nst = 10 - i * 2;
        for (var j = 0; j < nst; j++) T.tex.push([rnd() * TAU, 0.55 + rnd() * 0.4]);
      }

      ground(g, 3 * k, 4 * k, r * 1.08, r * 0.56, 0.24);

      // ----- tronc roux, visible en bas à droite (les étages penchent à gauche) -----
      g.strokeStyle = '#9a6a48'; g.lineCap = 'round'; g.lineWidth = Math.max(1, r * 0.16);
      g.beginPath();
      g.moveTo(r * 0.16, r * 1.05);
      g.quadraticCurveTo(r * 0.1, r * 0.8, r * 0.04, r * 0.55);
      g.stroke();
      g.strokeStyle = '#7a4e32'; g.lineWidth = Math.max(0.6, r * 0.06);
      g.beginPath();
      g.moveTo(r * 0.14, r * 1.02);
      g.quadraticCurveTo(r * 0.1, r * 0.84, r * 0.06, r * 0.64);
      g.stroke();

      // ----- étages, avec ombre douce de l'étage supérieur sur l'inférieur -----
      for (i = 0; i < tiers.length; i++) {
        T = tiers[i];
        // ombre portée du prochain étage AVANT de le dessiner (assise en douceur)
        if (i > 0) patch(g, T.x + 1.6 * k, T.y + 2.6 * k, T.ro * 1.08, '#0e2412', 0.32);
        // oscillation : k entier, phase et amplitude propres à l'étage
        var sway = i === 0 ? Math.sin(PH * TAU) * 0.012
                 : i === 1 ? Math.sin(PH * TAU + 2.1) * 0.022
                 :           Math.sin(PH * TAU * 2 + 0.7) * 0.02;
        g.save();
        g.translate(T.x, T.y);
        g.rotate(sway);
        // couronne étoilée : un chemin, un dégradé
        g.beginPath(); T.tr(g);
        var cg = g.createRadialGradient(-T.ro * 0.25, -T.ro * 0.3, T.ro * 0.08, 0, 0, T.ro * 1.02);
        cg.addColorStop(0, shade(T.c0, 0.2));
        cg.addColorStop(0.6, T.c0);
        cg.addColorStop(1, T.c1);
        g.fillStyle = cg;
        g.fill();
        // fin liseré sombre pour asseoir les pointes
        g.strokeStyle = rgba('#142a18', 0.3); g.lineJoin = 'round';
        g.lineWidth = Math.max(0.6, r * 0.025);
        g.stroke();
        // texture d'aiguilles sous clip (rayons alternés sombre/clair)
        g.save();
        g.beginPath(); T.tr(g);
        g.clip();
        for (j = 0; j < T.tex.length; j++) {
          var a = T.tex[j][0], ln = T.tex[j][1];
          g.strokeStyle = (j % 2) ? rgba('#142a18', 0.28) : rgba(shade(T.c0, 0.45), 0.22);
          g.lineWidth = Math.max(0.5, r * 0.028);
          g.beginPath();
          g.moveTo(Math.cos(a) * T.ri * 0.3, Math.sin(a) * T.ri * 0.28);
          g.lineTo(Math.cos(a) * T.ro * ln, Math.sin(a) * T.ro * ln * 0.92);
          g.stroke();
        }
        // lumière côté soleil
        patch(g, -T.ro * 0.32, -T.ro * 0.36, T.ro * 0.48, '#ffffff', 0.13);
        g.restore();   // clip
        g.restore();   // rotation de l'étage
      }

      // ----- bourgeon au sommet, scintillement doux (k=1) -----
      var bx = tiers[2].x, by = tiers[2].y;
      var tw = 0.5 + 0.5 * Math.sin(PH * TAU);
      g.fillStyle = '#6fae6d';
      g.beginPath(); g.arc(bx, by, Math.max(1, r * 0.06), 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,' + (0.18 + tw * 0.25) + ')';
      g.beginPath(); g.arc(bx - r * 0.015, by - r * 0.015, Math.max(0.6, r * 0.032), 0, TAU); g.fill();
    } });

  // ============================================================
  // 4) SORBIER AUX BAIES — couronne verte fraîche piquée de
  //    grappes de baies rouge vif, nichées dans des creux d'ombre.
  //    Anim : un petit oiseau arrive en fondu, picore une grappe
  //    (hochements k=8 sous enveloppe), une baie tombe, puis il
  //    s'efface — tout sur le cycle de 3.2 s.
  // ============================================================
  reg('tree', { id: 'a3-sorbier', label: 'Sorbier aux baies',
    anim: 'un oiseau vient picorer les baies en cycle fondu, une baie tombe pendant le repas',
    draw: function (g, r, seed, animT) {
      var rnd = prng(seed);
      var PH = ((animT || 0) % 3.2) / 3.2;
      var k = r / 12;

      // ----- paramètres seedés (ordre fixe, AUCUN rnd dans le code animé) -----
      var tracers = [
        mkBlob(0, -r * 0.14, r * 0.62, r * 0.5, 10, rnd, 0.82, 0.26, 0.5),
        mkBlob(-r * 0.3, r * 0.02, r * 0.4, r * 0.3, 9, rnd, 0.8, 0.28, 1.4),
        mkBlob(r * 0.32, -r * 0.06, r * 0.38, r * 0.29, 9, rnd, 0.8, 0.28, 2.5)
      ];
      // grappes : la première est FIXE en haut-droite (perchoir de l'oiseau)
      var clusters = [{ x: r * 0.3 + (rnd() - 0.5) * r * 0.08,
                        y: -r * 0.36 + (rnd() - 0.5) * r * 0.06, b: [] }];
      var nc = 2 + ((rnd() * 2) | 0);                    // + 2-3 grappes libres
      for (var i = 0; i < nc; i++) {
        clusters.push({ x: (rnd() - 0.55) * r * 0.85, y: -r * 0.1 + (rnd() - 0.4) * r * 0.5, b: [] });
      }
      for (i = 0; i < clusters.length; i++) {
        var nb = 5 + ((rnd() * 2) | 0);                  // 5-6 baies par grappe
        for (var j = 0; j < nb; j++) {
          var ba = rnd() * TAU, bd = rnd() * r * 0.065;
          clusters[i].b.push([Math.cos(ba) * bd, Math.sin(ba) * bd * 0.8,
                              r * (0.034 + rnd() * 0.014)]);
        }
      }
      var tside = rnd() < 0.5 ? -1 : 1;

      ground(g, 3 * k, 4 * k, r * 0.95, r * 0.5, 0.20);

      // ----- tronc -----
      g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = Math.max(1, r * 0.15);
      g.beginPath();
      g.moveTo(tside * r * 0.08, r * 1.0);
      g.quadraticCurveTo(tside * r * 0.02, r * 0.72, 0, r * 0.44);
      g.stroke();
      g.strokeStyle = '#6e5434'; g.lineWidth = Math.max(0.5, r * 0.055);
      g.beginPath();
      g.moveTo(tside * r * 0.07, r * 0.97);
      g.quadraticCurveTo(tside * r * 0.03, r * 0.76, tside * r * 0.01, r * 0.54);
      g.stroke();

      // ----- respiration minuscule de la couronne (k=1) -----
      var br = 1 + Math.sin(PH * TAU) * 0.006;
      g.save();
      g.scale(br, br);

      // couronne : un chemin, un dégradé (vert frais)
      pathOf(g, tracers);
      var cg = g.createRadialGradient(-r * 0.26, -r * 0.4, r * 0.08, 0, -r * 0.05, r * 0.95);
      cg.addColorStop(0, shade('#74a850', 0.3));
      cg.addColorStop(0.6, '#68994a');
      cg.addColorStop(1, mix('#527c38', '#35521f', 0.55));
      g.fillStyle = cg;
      g.fill();

      // ----- modelé + grappes, sous clip -----
      g.save();
      pathOf(g, tracers);
      g.clip();
      patch(g, -r * 0.28, -r * 0.4, r * 0.4, '#ffffff', 0.2);
      patch(g, r * 0.02, r * 0.24, r * 0.55, '#35521f', 0.3);
      patch(g, -r * 0.5, r * 0.05, r * 0.28, '#35521f', 0.2);
      // feuilles pennées suggérées : fines arêtes claires
      g.strokeStyle = rgba(shade('#74a850', 0.5), 0.4); g.lineWidth = Math.max(0.4, r * 0.02);
      g.beginPath(); g.moveTo(-r * 0.4, -r * 0.16); g.lineTo(-r * 0.2, -r * 0.26); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.06, -r * 0.5); g.lineTo(r * 0.1, -r * 0.55); g.stroke();
      // grappes de baies nichées dans des creux d'ombre
      for (i = 0; i < clusters.length; i++) {
        var C = clusters[i];
        patch(g, C.x, C.y, r * 0.16, '#26400f', 0.45);   // creux feuillu derrière
        // tigelles
        g.strokeStyle = 'rgba(96,64,32,.55)'; g.lineWidth = Math.max(0.4, r * 0.018);
        g.beginPath(); g.moveTo(C.x - r * 0.02, C.y - r * 0.09); g.lineTo(C.x, C.y - r * 0.01); g.stroke();
        g.beginPath(); g.moveTo(C.x + r * 0.03, C.y - r * 0.08); g.lineTo(C.x + r * 0.01, C.y); g.stroke();
        for (j = 0; j < C.b.length; j++) {
          var B = C.b[j];
          var bxx = C.x + B[0], byy = C.y + B[1], rb = B[2];
          g.fillStyle = '#b8281f';
          g.beginPath(); g.arc(bxx, byy, rb, 0, TAU); g.fill();
          g.fillStyle = '#e0503c';
          g.beginPath(); g.arc(bxx - rb * 0.28, byy - rb * 0.3, rb * 0.58, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,255,255,.7)';
          g.beginPath(); g.arc(bxx - rb * 0.35, byy - rb * 0.4, rb * 0.2, 0, TAU); g.fill();
        }
        // le feuillage remonte sur le haut de la grappe (intégration douce)
        patch(g, C.x - r * 0.03, C.y - r * 0.11, r * 0.11, '#4e7a34', 0.5);
      }
      g.restore();   // clip
      g.restore();   // respiration

      // ----- L'OISEAU PICOREUR (cycle fondu complet sur 3.2 s) -----
      var C0 = clusters[0];
      var t = PH;
      // enveloppe d'apparition/disparition : alpha nul aux DEUX bouts du cycle
      var al = Math.max(0, Math.min(1, Math.min(t / 0.18, (1 - t) / 0.2)));
      if (al > 0) {
        var cs = r * 0.3;                                // échelle de l'oiseau
        var tIn = Math.min(1, t / 0.18);
        var tOut = t > 0.8 ? (t - 0.8) / 0.2 : 0;
        // il se pose en glissant, repart vers le haut-droite
        var dx = (1 - tIn) * r * 0.22 + tOut * r * 0.28;
        var dy = -(1 - tIn) * r * 0.3 - tOut * tOut * r * 0.45;
        // picorage : hochements rapides (k=8) sous enveloppe lisse au milieu du cycle
        var w = Math.max(0, Math.min(1, (t - 0.3) / 0.45));
        var bob = Math.sin(PH * TAU * 8) * Math.sin(w * Math.PI);
        g.save();
        g.globalAlpha = al * 0.98;
        // perché juste au-dessus-gauche de la grappe, tourné vers elle
        g.translate(C0.x - cs * 0.75 + dx, C0.y - cs * 0.55 + dy);
        g.rotate(0.55 + bob * 0.14);
        // queue
        g.fillStyle = '#54708a';
        g.beginPath();
        g.moveTo(-cs * 0.38, -cs * 0.1); g.lineTo(-cs * 0.85, -cs * 0.02);
        g.lineTo(-cs * 0.4, cs * 0.12); g.closePath(); g.fill();
        // corps dodu
        g.fillStyle = '#6a88a0';
        g.beginPath(); g.ellipse(0, 0, cs * 0.42, cs * 0.3, 0, 0, TAU); g.fill();
        // aile repliée
        g.fillStyle = '#54708a';
        g.beginPath(); g.ellipse(-cs * 0.05, -cs * 0.03, cs * 0.26, cs * 0.15, -0.3, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(0.4, cs * 0.04);
        g.beginPath(); g.moveTo(-cs * 0.24, -cs * 0.08); g.quadraticCurveTo(-cs * 0.02, -cs * 0.14, cs * 0.14, -cs * 0.05); g.stroke();
        // poitrine orangée (rouge-gorge des sorbiers)
        g.fillStyle = '#e8965a';
        g.beginPath(); g.ellipse(cs * 0.26, cs * 0.14, cs * 0.16, cs * 0.12, 0.5, 0, TAU); g.fill();
        // tête
        g.fillStyle = '#6a88a0';
        g.beginPath(); g.arc(cs * 0.38, cs * 0.02, cs * 0.2, 0, TAU); g.fill();
        // bec vers la grappe
        g.fillStyle = '#3f3a32';
        g.beginPath();
        g.moveTo(cs * 0.52, cs * 0.08); g.lineTo(cs * 0.72, cs * 0.2);
        g.lineTo(cs * 0.46, cs * 0.2); g.closePath(); g.fill();
        // oeil
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.beginPath(); g.arc(cs * 0.42, -cs * 0.04, cs * 0.055, 0, TAU); g.fill();
        g.fillStyle = '#2c2c34';
        g.beginPath(); g.arc(cs * 0.435, -cs * 0.035, cs * 0.028, 0, TAU); g.fill();
        // reflet du dos
        g.fillStyle = 'rgba(255,255,255,.16)';
        g.beginPath(); g.ellipse(-cs * 0.02, -cs * 0.14, cs * 0.24, cs * 0.09, -0.2, 0, TAU); g.fill();
        g.restore();
      }

      // ----- une baie se décroche pendant le picorage (fondu aux 2 bouts) -----
      if (t > 0.5 && t < 0.95) {
        var bt = (t - 0.5) / 0.45;
        var bal = bt < 0.15 ? bt / 0.15 : (bt > 0.7 ? Math.max(0, (1 - bt) / 0.3) : 1);
        if (bal > 0) {
          var fbx = C0.x + Math.sin(bt * TAU) * r * 0.02;
          var fby = C0.y + r * 0.06 + bt * bt * r * 0.85;
          var frb = r * 0.042;
          g.globalAlpha = bal * 0.95;
          g.fillStyle = '#b8281f';
          g.beginPath(); g.arc(fbx, fby, frb, 0, TAU); g.fill();
          g.fillStyle = '#e0503c';
          g.beginPath(); g.arc(fbx - frb * 0.3, fby - frb * 0.3, frb * 0.5, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
      }
    } });
})();
