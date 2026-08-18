/* ============================================================
   GRIFFES & PLUMES — sprites-fx.js (7/9)
   Âmes, emblème, mascottes, nid, icônes d'activité, bannière,
   mannequin.
   ============================================================ */
"use strict";

  // ------------------------------------------------------------
  const SOUL_CAT = [
    [0, 0.34, 0.56, 0.52, 0],       // corps
    [0.58, 0.46, 0.34, 0.13, -0.7], // queue
    [-0.22, 0.86, 0.16, 0.24, 0],   // patte g
    [0.22, 0.86, 0.16, 0.24, 0],    // patte d
    [0, -0.42, 0.44, 0.42, 0],      // tête
    [-0.3, -0.82, 0.14, 0.22, -0.35],// oreille g
    [0.3, -0.82, 0.14, 0.22, 0.35], // oreille d
  ];
  const SOUL_BIRD = [
    [0, 0.3, 0.5, 0.56, 0],         // corps (œuf)
    [-0.44, 0.32, 0.18, 0.36, 0.35],// aile g
    [0.44, 0.32, 0.18, 0.36, -0.35],// aile d
    [-0.02, 0.9, 0.3, 0.2, 0.15],   // queue en éventail
    [-0.15, 0.92, 0.08, 0.16, 0],   // patte g
    [0.15, 0.92, 0.08, 0.16, 0],    // patte d
    [0, -0.4, 0.37, 0.37, 0],       // tête
    [0, -0.78, 0.1, 0.2, 0],        // huppe
  ];
  function getSoulCanvas(faction, size) {
    faction = faction === 'birds' ? 'birds' : 'cats';
    size = clamp(size | 0, 8, 512) || 48;
    const key = 'soul|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    const parts = faction === 'cats' ? SOUL_CAT : SOUL_BIRD;
    const R = size * 0.42, cx = size / 2, cy = size / 2;
    const grow = Math.max(1, size * 0.03);
    // On peint la masse OPAQUE dans un tampon (pas de doublons d'alpha aux
    // recouvrements), puis on la reporte translucide d'un coup.
    const temp = mk(size, size), tg = temp.getContext('2d');
    function stamp(color, extra) {
      tg.fillStyle = color;
      for (const s of parts) {
        tg.beginPath();
        tg.ellipse(cx + s[0] * R, cy + s[1] * R, s[2] * R + extra, s[3] * R + extra, s[4] || 0, 0, TAU);
        tg.fill();
      }
    }
    stamp('#d8fff9', grow);   // liseré clair (masse dilatée)
    stamp('#3fe0d0', 0);      // corps turquoise
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.globalAlpha = 0.72;
    g.drawImage(temp, 0, 0);
    g.globalAlpha = 1;
    { const pxb = bakePx(3); if (pxb > 1) pixelate(cv, pxb); }   // grain lié à BALANCE.pixelArt
    cache.set(key, cv);
    return cv;
  }


  // ------------------------------------------------------------
  // API : getEmblem v2 — écusson de bois gravé, tête de chef à
  // l'encre, rivets. Moins kawaii, plus salle de guerre.
  // ------------------------------------------------------------
  function getEmblem(faction, size) {
    size = size || 96;
    faction = faction === 'birds' ? 'birds' : 'cats';
    const key = 'e2|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.translate(size / 2, size / 2);
    g.scale(size / 96, size / 96);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const F = SGD.FACTIONS[faction];
    const ink = '#2e2318';
    const shield = function () {
      g.beginPath();
      g.moveTo(-37, -40); g.lineTo(37, -40);
      g.quadraticCurveTo(37, 8, 25, 26);
      g.quadraticCurveTo(12, 42, 0, 46);
      g.quadraticCurveTo(-12, 42, -25, 26);
      g.quadraticCurveTo(-37, 8, -37, -40);
      g.closePath();
    };

    // planches de bois
    const wgrad = g.createLinearGradient(-38, 0, 38, 0);
    wgrad.addColorStop(0, '#a8845a');
    wgrad.addColorStop(.5, '#c9a06a');
    wgrad.addColorStop(1, '#8a6a44');
    g.fillStyle = wgrad; shield(); g.fill();

    g.save(); shield(); g.clip();
    // rainures + veines
    g.strokeStyle = 'rgba(60,40,20,.4)'; g.lineWidth = 1.4;
    for (const x of [-19, 0, 19]) { g.beginPath(); g.moveTo(x, -42); g.lineTo(x, 48); g.stroke(); }
    g.strokeStyle = 'rgba(60,40,20,.18)'; g.lineWidth = 1;
    for (const q of [[-29, -22, 8], [11, -30, 9], [-9, 34, 6], [29, 12, 6]]) {
      g.beginPath(); g.ellipse(q[0], q[1], q[2], q[2] * .45, .3, 0, TAU); g.stroke();
    }
    // champ central teinté faction
    g.globalAlpha = .88;
    const bgg = g.createRadialGradient(-6, -10, 2, 0, 0, 42);
    bgg.addColorStop(0, SGD.mix(F.acc, '#ffffff', .12));
    bgg.addColorStop(1, SGD.shade(F.acc2, -.3));
    g.fillStyle = bgg;
    g.beginPath();
    g.moveTo(-29, -32); g.lineTo(29, -32);
    g.quadraticCurveTo(29, 6, 19, 21);
    g.quadraticCurveTo(9, 33, 0, 36);
    g.quadraticCurveTo(-9, 33, -19, 21);
    g.quadraticCurveTo(-29, 6, -29, -32);
    g.closePath(); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = rgba(ink, .7); g.lineWidth = 1.6; g.stroke();

    // tête gravée à l'encre
    g.fillStyle = ink;
    if (faction === 'cats') {
      // chat de face, anguleux, regard en fente
      g.beginPath();
      g.moveTo(-17, -6);
      g.lineTo(-15, -23); g.lineTo(-6, -13);
      g.lineTo(6, -13); g.lineTo(15, -23); g.lineTo(17, -6);
      g.quadraticCurveTo(18, 12, 0, 18);
      g.quadraticCurveTo(-18, 12, -17, -6);
      g.closePath(); g.fill();
      // yeux : fentes claires
      g.fillStyle = SGD.mix(F.acc, '#ffffff', .6);
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * 3.5, -1.6); g.lineTo(s * 12, -4.8); g.lineTo(s * 11, -.4); g.lineTo(s * 4.5, 1);
        g.closePath(); g.fill();
      }
      // moustaches gravées
      g.strokeStyle = ink; g.lineWidth = 1.7;
      for (const s of [-1, 1]) for (const dy of [7, 11]) {
        g.beginPath(); g.moveTo(s * 16, dy); g.lineTo(s * 26, dy - 2.4); g.stroke();
      }
      // nez-fente
      g.strokeStyle = ink; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, 7); g.lineTo(0, 12); g.stroke();
    } else {
      // rapace de profil, arcade lourde, bec crochu
      g.beginPath();
      g.moveTo(-16, 22);
      g.lineTo(-18, -6);
      g.quadraticCurveTo(-15, -21, 2, -21);
      g.quadraticCurveTo(12, -21, 15, -13);
      g.lineTo(25, -9);
      g.quadraticCurveTo(28, -3, 18, 0);
      g.lineTo(11, -1);
      g.quadraticCurveTo(13, 9, 4, 15);
      g.lineTo(6, 22); g.lineTo(-2, 17); g.lineTo(-4, 24); g.lineTo(-10, 17);
      g.closePath(); g.fill();
      // œil : fente claire sous l'arcade
      g.fillStyle = SGD.mix(F.acc, '#ffffff', .6);
      g.beginPath(); g.moveTo(1, -12.5); g.lineTo(12, -10.5); g.lineTo(2, -8); g.closePath(); g.fill();
    }
    g.restore();

    // bordure encrée + rivets + entailles
    g.strokeStyle = ink; g.lineWidth = 3; shield(); g.stroke();
    for (const q of [[-31, -34], [31, -34], [-23, 19], [23, 19], [0, 40]]) {
      g.fillStyle = '#c3ccd6';
      g.beginPath(); g.arc(q[0], q[1], 2.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(30,26,20,.6)'; g.lineWidth = .8; g.stroke();
    }
    g.strokeStyle = 'rgba(46,35,24,.55)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(20, -40); g.lineTo(27, -29); g.stroke();
    g.beginPath(); g.moveTo(-31, 8); g.lineTo(-23, 18); g.stroke();

    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // API : drawMascot — grosse mascotte animée vue de face 3/4
  // Dessinée dans un repère local ~130 unités de haut, origine au sol.
  // ------------------------------------------------------------
  function drawMascot(ctx, faction, x, y, scale, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (faction === 'birds') drawBirdMascot(ctx, t);
    else drawCatMascot(ctx, t);
    ctx.restore();
  }

  function drawCatMascot(g, t) {
    // Général Moustache : chat tigré doré, assis, dodu et fier
    const fur = '#e2a94e', hi = '#f6d494', sh = '#8a5c22', stripe = '#a06a24';
    const capeC = SGD.FACTIONS.cats.acc2;
    const breathe = Math.sin(t * 2.1) * 1.5;
    const blink = ((t + 1.3) % 3.8) > 3.66;
    const tailA = Math.sin(t * 1.4);

    softShadow(g, 0, 2, 46, 12, 0.20);

    // --- queue qui balance, enroulée sur le côté ---
    {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const ang = 2.6 + u * 2.2 + tailA * 0.25 * u;
        pts.push([
          -22 + Math.cos(ang) * 26 * u,
          -6 - Math.sin(ang) * 30 * u * (0.75 + 0.1 * tailA),
        ]);
      }
      taperedStroke(g, pts, 10, 4.5, fur);
      g.globalAlpha = 0.25;
      taperedStroke(g, pts.map(p => [p[0] + 1.6, p[1] + 1.2]), 4, 1.8, sh);
      g.globalAlpha = 1;
      // bout de queue crème
      const tip = pts[pts.length - 1];
      g.fillStyle = hi;
      g.beginPath(); g.arc(tip[0], tip[1], 4.2, 0, TAU); g.fill();
    }

    // --- cape d'apparat derrière le corps ---
    {
      const sway = Math.sin(t * 0.9) * 2;
      const cg = g.createLinearGradient(0, -66, 0, -4);
      cg.addColorStop(0, SGD.shade(capeC, 0.15));
      cg.addColorStop(1, SGD.shade(capeC, -0.25));
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(-24, -60);
      g.quadraticCurveTo(-40 - sway, -30, -35 - sway, -4);
      g.quadraticCurveTo(0, 3, 35 + sway, -4);
      g.quadraticCurveTo(40 + sway, -30, 24, -60);
      g.closePath(); g.fill();
      g.strokeStyle = '#f4c542'; g.lineWidth = 1.8; g.globalAlpha = 0.8;
      g.stroke(); g.globalAlpha = 1;
    }

    // --- corps poire, respiration ---
    {
      const bg2 = g.createRadialGradient(-4, -44 + breathe * 0.4, 4, 0, -34, 44);
      bg2.addColorStop(0, hi);
      bg2.addColorStop(0.55, fur);
      bg2.addColorStop(1, sh);
      g.fillStyle = bg2;
      g.beginPath();
      g.ellipse(0, -33 + breathe * 0.3, 30, 35 + breathe * 0.5, 0, 0, TAU);
      g.fill();
    }
    // hanches
    for (const s of [-1, 1]) {
      g.fillStyle = fur;
      g.beginPath(); g.ellipse(s * 22, -13, 12, 14, s * 0.15, 0, TAU); g.fill();
      g.globalAlpha = 0.3; g.strokeStyle = sh; g.lineWidth = 1.4; g.stroke();
      g.globalAlpha = 1;
    }
    // poitrail clair
    g.fillStyle = hi;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.ellipse(0, -27 + breathe * 0.4, 15, 21, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;

    // rayures du corps (multiply)
    g.save();
    g.beginPath(); g.ellipse(0, -33, 30, 35, 0, 0, TAU); g.clip();
    g.globalCompositeOperation = 'multiply';
    g.strokeStyle = stripe; g.globalAlpha = 0.22; g.lineWidth = 4;
    for (const s of [-1, 1]) {
      for (const yy of [-52, -42, -32]) {
        g.beginPath();
        g.moveTo(s * 30, yy);
        g.quadraticCurveTo(s * 20, yy + 3, s * 14, yy - 2);
        g.stroke();
      }
    }
    g.restore(); g.globalAlpha = 1;

    // pattes avant
    for (const s of [-1, 1]) {
      g.fillStyle = hi;
      g.beginPath(); g.ellipse(s * 10, -3, 7, 5, 0, 0, TAU); g.fill();
      g.strokeStyle = sh; g.lineWidth = 1; g.globalAlpha = 0.4;
      g.beginPath();
      g.moveTo(s * 8, -5.5); g.lineTo(s * 8, -1.5);
      g.moveTo(s * 12, -5.5); g.lineTo(s * 12, -1.5);
      g.stroke();
      g.globalAlpha = 1;
    }

    // médaille du Général
    g.strokeStyle = '#c8442e'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(11, -49 + breathe * 0.4); g.lineTo(13, -42 + breathe * 0.4); g.stroke();
    const mg2 = g.createRadialGradient(12, -40 + breathe * 0.4, 0.5, 13, -39 + breathe * 0.4, 5);
    mg2.addColorStop(0, '#ffe9a0');
    mg2.addColorStop(1, '#c89020');
    g.fillStyle = mg2;
    g.beginPath(); g.arc(13, -39 + breathe * 0.4, 4.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    starPath(g, 13, -39 + breathe * 0.4, 5, 2.6, 1.1, -Math.PI / 2);
    g.fill();

    // ================= TÊTE =================
    const hy = -74 + breathe;
    // oreilles
    for (const s of [-1, 1]) {
      g.fillStyle = fur;
      g.beginPath();
      g.moveTo(s * 8, hy - 14);
      g.lineTo(s * 22, hy - 28);
      g.lineTo(s * 20, hy - 8);
      g.closePath(); g.fill();
      g.fillStyle = '#e8909a';
      g.beginPath();
      g.moveTo(s * 11, hy - 14.5);
      g.lineTo(s * 19.5, hy - 23.5);
      g.lineTo(s * 18, hy - 11);
      g.closePath(); g.fill();
    }
    // crâne
    {
      const hg = g.createRadialGradient(-3, hy - 6, 2, 0, hy, 26);
      hg.addColorStop(0, hi);
      hg.addColorStop(0.6, fur);
      hg.addColorStop(1, sh);
      g.fillStyle = hg;
      g.beginPath(); g.ellipse(0, hy, 23, 21, 0, 0, TAU); g.fill();
    }
    // joues
    g.fillStyle = fur;
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(s * 18, hy + 9, 7, 5.5, s * 0.4, 0, TAU); g.fill();
    }
    // rayures du front
    g.save();
    g.beginPath(); g.ellipse(0, hy, 23, 21, 0, 0, TAU); g.clip();
    g.globalCompositeOperation = 'multiply';
    g.strokeStyle = stripe; g.globalAlpha = 0.28; g.lineWidth = 3;
    for (const dx of [-7, 0, 7]) {
      g.beginPath();
      g.moveTo(dx, hy - 20);
      g.quadraticCurveTo(dx * 0.6, hy - 13, dx * 0.5, hy - 10);
      g.stroke();
    }
    g.restore(); g.globalAlpha = 1;

    // yeux (clignement périodique)
    for (const s of [-1, 1]) {
      if (blink) {
        g.strokeStyle = sh; g.lineWidth = 2;
        g.beginPath(); g.arc(s * 9, hy - 2, 4, 0.25, Math.PI - 0.25); g.stroke();
      } else {
        g.fillStyle = '#fffcf2';
        g.beginPath(); g.ellipse(s * 9, hy - 2.5, 5, 6, 0, 0, TAU); g.fill();
        g.fillStyle = '#3fbf5a';
        g.beginPath(); g.ellipse(s * 9, hy - 2, 4, 5, 0, 0, TAU); g.fill();
        g.fillStyle = '#141210';
        g.beginPath(); g.ellipse(s * 9, hy - 1.6, 2, 4.2, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.beginPath(); g.arc(s * 7.6, hy - 4.4, 1.3, 0, TAU); g.fill();
      }
      // paupière tombante + sourcil froncé : regard de chef de guerre
      g.fillStyle = fur;
      g.beginPath(); g.ellipse(s * 9, hy - 8.2, 5.6, 3.2, s * 0.1, 0, TAU); g.fill();
      g.strokeStyle = '#54401e'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(s * 4, hy - 5.8); g.lineTo(s * 14.5, hy - 9.4); g.stroke();
    }
    // cicatrice de vétéran sur l'arcade gauche
    g.strokeStyle = rgba(sh, .85); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-16.5, hy - 14); g.lineTo(-13, hy - 6.5); g.stroke();
    g.beginPath(); g.moveTo(-17, hy - 11); g.lineTo(-13.2, hy - 12.4); g.stroke();
    // museau + truffe
    g.fillStyle = hi;
    g.beginPath(); g.ellipse(0, hy + 9.5, 8.5, 6, 0, 0, TAU); g.fill();
    g.fillStyle = '#d87a88';
    g.beginPath();
    g.moveTo(-3, hy + 6.2); g.lineTo(3, hy + 6.2); g.lineTo(0, hy + 9.6);
    g.closePath(); g.fill();
    // LA moustache du Général : deux belles virgules sombres
    g.strokeStyle = '#54401e'; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      const curl = Math.sin(t * 1.1 + s) * 0.6;
      const pts = [];
      for (let i = 0; i <= 5; i++) {
        const u = i / 5;
        pts.push([
          s * (2.5 + 13 * u),
          hy + 11 - 8 * u * u - curl * u,
        ]);
      }
      taperedStroke(g, pts, 3.2, 1.2, '#54401e');
    }
    // bouche ferme, léger rictus — un général ne minaude pas
    g.strokeStyle = sh; g.lineWidth = 1.4; g.globalAlpha = 0.8;
    g.beginPath(); g.moveTo(-4.5, hy + 12.2); g.quadraticCurveTo(0, hy + 13, 5.5, hy + 11.4); g.stroke();
    g.globalAlpha = 1;
    // petit croc qui dépasse
    g.fillStyle = '#fffcf2';
    g.beginPath(); g.moveTo(3.2, hy + 11.8); g.lineTo(5.4, hy + 11.3); g.lineTo(4.6, hy + 14.4); g.closePath(); g.fill();
    // moustaches fines
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
    for (const s of [-1, 1]) {
      for (const dy of [0, 3.5]) {
        g.beginPath();
        g.moveTo(s * 10, hy + 8 + dy * 0.5);
        g.quadraticCurveTo(s * 23, hy + 6 + dy, s * 30, hy + 8 + dy * 1.5);
        g.stroke();
      }
    }
  }

  function drawBirdMascot(g, t) {
    // Maréchale Plume : oiseau bleu rond et fier, plumet de cheffe
    const fur = '#6fb8dd', hi = '#cfeafb', sh = '#39789e';
    const breathe = Math.sin(t * 2.0 + 0.8) * 1.5;
    const blink = ((t + 0.4) % 4.2) > 4.05;
    const flapM = Math.sin(t * 1.8) * 2.6;

    softShadow(g, 0, 2, 44, 12, 0.20);

    // --- queue : éventail de plumes derrière ---
    for (let i = 0; i < 5; i++) {
      const v = i / 4 - 0.5;
      const ang = Math.PI / 2 + v * 0.9;
      const sway = Math.sin(t * 1.3 + i) * 1.4;
      const pts = [];
      for (let j = 0; j <= 5; j++) {
        const u = j / 5;
        pts.push([
          -Math.cos(ang) * (26 + 6 * (1 - Math.abs(v) * 2)) * u * 0.7 - 14 * u * v,
          -8 + (10 + sway) * u,
        ]);
      }
      taperedStroke(g, pts, 7, 3, i % 2 === 0 ? SGD.mix(fur, sh, 0.35) : fur);
    }

    // --- corps : gros oeuf dodu ---
    {
      const bg2 = g.createRadialGradient(-5, -52 + breathe * 0.4, 4, 0, -40, 48);
      bg2.addColorStop(0, hi);
      bg2.addColorStop(0.55, fur);
      bg2.addColorStop(1, sh);
      g.fillStyle = bg2;
      g.beginPath();
      g.ellipse(0, -39 + breathe * 0.3, 32, 39 + breathe * 0.5, 0, 0, TAU);
      g.fill();
    }
    // ventre clair
    g.fillStyle = hi;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.ellipse(0, -28 + breathe * 0.4, 19, 23, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    // petites vaguelettes de plumage sur le ventre
    g.strokeStyle = rgba(sh, 0.25); g.lineWidth = 1.4;
    for (const yy of [-34, -26, -18]) {
      for (const dx of [-8, 2]) {
        g.beginPath();
        g.arc(dx + 3, yy + breathe * 0.4, 5, 0.3, Math.PI - 0.3);
        g.stroke();
      }
    }

    // --- ailes qui se soulèvent ---
    for (const s of [-1, 1]) {
      g.save();
      g.translate(s * 29, -46 + breathe * 0.3 - flapM);
      g.rotate(s * (0.30 - flapM * 0.03));
      const wg = g.createLinearGradient(0, -18, 0, 20);
      wg.addColorStop(0, SGD.mix(fur, hi, 0.3));
      wg.addColorStop(1, SGD.mix(fur, sh, 0.45));
      g.fillStyle = wg;
      g.beginPath();
      g.ellipse(0, 2, 9.5, 21, 0, 0, TAU);
      g.fill();
      // pennes
      g.strokeStyle = rgba(sh, 0.4); g.lineWidth = 1.6;
      for (const dy of [8, 13, 18]) {
        g.beginPath();
        g.arc(0, dy - 4, 7, 0.5, Math.PI - 0.5);
        g.stroke();
      }
      g.restore();
    }

    // médaille de la Maréchale
    g.strokeStyle = '#3a5aa8'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(12, -52 + breathe * 0.4); g.lineTo(14, -45 + breathe * 0.4); g.stroke();
    const mg3 = g.createRadialGradient(13, -43 + breathe * 0.4, 0.5, 14, -42 + breathe * 0.4, 5);
    mg3.addColorStop(0, '#ffe9a0');
    mg3.addColorStop(1, '#c89020');
    g.fillStyle = mg3;
    g.beginPath(); g.arc(14, -42 + breathe * 0.4, 4.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    starPath(g, 14, -42 + breathe * 0.4, 5, 2.6, 1.1, -Math.PI / 2);
    g.fill();

    // ================= VISAGE (l'oiseau est tout rond) =================
    const fy = -62 + breathe;
    // arcade lourde de rapace : sourcils froncés vers le bec
    g.strokeStyle = sh; g.lineWidth = 3.2; g.globalAlpha = 0.85;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 4, fy - 7); g.lineTo(s * 15.5, fy - 10.4);
      g.stroke();
    }
    g.globalAlpha = 1;
    // yeux
    for (const s of [-1, 1]) {
      if (blink) {
        g.strokeStyle = sh; g.lineWidth = 2;
        g.beginPath(); g.arc(s * 10, fy, 4.2, 0.25, Math.PI - 0.25); g.stroke();
      } else {
        g.fillStyle = '#fffcf2';
        g.beginPath(); g.arc(s * 10, fy, 5.6, 0, TAU); g.fill();
        g.fillStyle = '#26221e';
        g.beginPath(); g.arc(s * 9.4, fy + 0.4, 3.6, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.beginPath(); g.arc(s * 8, fy - 1.4, 1.4, 0, TAU); g.fill();
      }
      // paupière mi-close : la Maréchale évalue, elle ne s'émerveille pas
      g.fillStyle = fur;
      g.beginPath(); g.ellipse(s * 10, fy - 5.6, 6, 2.8, s * 0.28, 0, TAU); g.fill();
    }
    // joues
    g.fillStyle = 'rgba(240,140,120,0.4)';
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(s * 17, fy + 8, 5, 3.5, 0, 0, TAU); g.fill();
    }
    // bec losange
    g.fillStyle = '#f5a94e';
    g.beginPath();
    g.moveTo(-6, fy + 6.5); g.lineTo(6, fy + 6.5); g.lineTo(0, fy + 16);
    g.closePath(); g.fill();
    g.fillStyle = '#d87f2a';
    g.beginPath();
    g.moveTo(-4, fy + 10.5); g.lineTo(4, fy + 10.5); g.lineTo(0, fy + 16);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.ellipse(-1.8, fy + 8.4, 1.6, 1, 0.4, 0, TAU); g.fill();

    // --- plumet de cheffe sur le crâne ---
    {
      const top = -96 + breathe;
      for (const p of [[-7, '#3a86ff', 0], [0, '#f4c542', 0.4], [7, '#48a9d8', 0.8]]) {
        const sway = Math.sin(t * 1.6 + p[2] * 4) * 2.4;
        const pts = [];
        for (let i = 0; i <= 5; i++) {
          const u = i / 5;
          pts.push([
            p[0] + p[0] * 0.5 * u + sway * u * u,
            top + 2 - 15 * u,
          ]);
        }
        taperedStroke(g, pts, 4.2, 1.4, p[1]);
      }
      // petit képi doré à la base du plumet
      g.fillStyle = '#2f5a8e';
      g.beginPath();
      g.ellipse(0, top + 4, 13, 5.5, 0, Math.PI, TAU);
      g.fill();
      g.strokeStyle = '#f4c542'; g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(-12.5, top + 4); g.lineTo(12.5, top + 4);
      g.stroke();
    }

    // pattes
    g.strokeStyle = '#e8963c'; g.lineWidth = 3.2;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 10, -4); g.lineTo(s * 10, 0);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 10 - 3.5, 0.8); g.lineTo(s * 10, -0.4); g.lineTo(s * 10 + 3.5, 0.8);
      g.stroke();
    }
  }


  // ------------------------------------------------------------
  // API : getNestCanvas — nid du playground du Dojo
  // (panier douillet côté chats, nid de brindilles côté oiseaux)
  // ------------------------------------------------------------
  function getNestCanvas(faction, size) {
    size = size || 52;
    faction = faction === 'birds' ? 'birds' : 'cats';
    const key = 'nest|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 52, size / 52);
    g.lineJoin = 'round'; g.lineCap = 'round';
    softShadow(g, 26, 40, 20, 7, .22);

    if (faction === 'cats') {
      // panier d'osier, coussin qui déborde
      const bgd = g.createLinearGradient(0, 20, 0, 44);
      bgd.addColorStop(0, '#d0a468'); bgd.addColorStop(1, '#96703e');
      g.fillStyle = bgd;
      g.beginPath(); g.ellipse(26, 30, 19, 12, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,60,26,.4)'; g.lineWidth = 1.2;
      for (const yy of [27, 33, 38]) for (let x = 12; x < 40; x += 7) {
        g.beginPath(); g.arc(x + 3, yy, 3.4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      }
      g.strokeStyle = '#7a5a30'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(26, 22, 18, 6, 0, 0, TAU); g.stroke();
      const cg = g.createLinearGradient(0, 16, 0, 26);
      cg.addColorStop(0, '#f2b8a0'); cg.addColorStop(1, '#e08060');
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(26, 21, 14.5, 5, 0, 0, TAU); g.fill();
      g.fillStyle = '#c96a4e';
      for (const x of [19, 26, 33]) { g.beginPath(); g.arc(x, 21, .9, 0, TAU); g.fill(); }
    } else {
      // nid de brindilles, creux sombre, œuf en attente
      const rn = mulberry(11);
      const bgd = g.createLinearGradient(0, 18, 0, 44);
      bgd.addColorStop(0, '#b08a54'); bgd.addColorStop(1, '#6e5230');
      g.fillStyle = bgd;
      g.beginPath(); g.ellipse(26, 29, 19, 12.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#463218';
      g.beginPath(); g.ellipse(26, 25, 12.5, 6, 0, 0, TAU); g.fill();
      for (let i = 0; i < 16; i++) {
        const a = rn() * TAU, rr = 13 + rn() * 6;
        const x = 26 + Math.cos(a) * rr, y = 29 + Math.sin(a) * rr * .55;
        const dx = 3 + rn() * 4, dy = (rn() - .5) * 3;
        twig(g, x - dx, y + dy, x + dx, y - dy, 1 + rn() * .8, rn() < .5 ? '#8a6a3c' : '#c9a06a');
      }
      g.fillStyle = '#f2ead2';
      g.beginPath(); g.ellipse(26, 25, 3.4, 4.2, .2, 0, TAU); g.fill();
    }
    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getActivityIcon — LES 28 AGRÈS du terrain de jeu du Dojo
  // (20 historiques + 8 communs, repère 44 px, style peint).
  // Plus AUCUN jeton générique : chaque agrès a sa tête.
  // ------------------------------------------------------------
  function getActivityIcon(id, size) {
    size = size || 44;
    const key = 'act|' + id + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 44, size / 44);
    g.lineJoin = 'round'; g.lineCap = 'round';
    softShadow(g, 22, 38, 15, 5, .2);

    if (id === 'roue') {
      // roue de course sur son support
      g.strokeStyle = '#8a6a44'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(14, 38); g.lineTo(22, 22); g.lineTo(30, 38); g.stroke();
      g.fillStyle = '#e8dcc0';
      g.beginPath(); g.arc(22, 20, 13, 0, TAU); g.fill();
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.6;
      g.beginPath(); g.arc(22, 20, 13, 0, TAU); g.stroke();
      g.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + .4;
        g.beginPath(); g.moveTo(22, 20); g.lineTo(22 + Math.cos(a) * 12, 20 + Math.sin(a) * 12); g.stroke();
      }
      g.fillStyle = '#5c4626'; g.beginPath(); g.arc(22, 20, 2.4, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,90,50,.5)'; g.lineWidth = 2;
      g.beginPath(); g.arc(22, 20, 16, -.6, .5); g.stroke();
    } else if (id === 'laser') {
      // pointeur + POINT ROUGE (l'ennemi ultime)
      g.fillStyle = '#3a3f4a';
      g.save(); g.translate(10, 12); g.rotate(.6);
      roundRectPath(g, -6, -3, 14, 6, 3); g.fill();
      g.fillStyle = '#c3ccd6'; g.beginPath(); g.arc(8, 0, 2.2, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(240,70,70,.5)'; g.lineWidth = 1.2;
      g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(18, 16); g.lineTo(30, 30); g.stroke();
      g.setLineDash([]);
      const gl = g.createRadialGradient(30, 31, .5, 30, 31, 8);
      gl.addColorStop(0, 'rgba(255,80,70,.9)'); gl.addColorStop(1, 'rgba(255,80,70,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(30, 31, 8, 0, TAU); g.fill();
      g.fillStyle = '#ff4646'; g.beginPath(); g.arc(30, 31, 3, 0, TAU); g.fill();
    } else if (id === 'pelote') {
      // pelote géante + brin
      const pg = g.createRadialGradient(18, 18, 2, 22, 23, 14);
      pg.addColorStop(0, '#f08a7a'); pg.addColorStop(1, '#c04a3e');
      g.fillStyle = pg;
      g.beginPath(); g.arc(22, 23, 13, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,30,26,.55)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(22, 23, 10, .5, 2.6); g.stroke();
      g.beginPath(); g.arc(22, 23, 7, 3.2, 5.6); g.stroke();
      g.beginPath(); g.arc(22, 23, 11.5, 3.8, 5.2); g.stroke();
      g.strokeStyle = '#c04a3e'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(33, 29); g.quadraticCurveTo(40, 33, 38, 40); g.stroke();
    } else if (id === 'coussin') {
      // coussin blindé : capitons + coins rivetés
      const cg = g.createLinearGradient(0, 12, 0, 34);
      cg.addColorStop(0, '#b48ad2'); cg.addColorStop(1, '#7a54a0');
      g.fillStyle = cg;
      roundRectPath(g, 7, 13, 30, 20, 7); g.fill();
      g.strokeStyle = 'rgba(60,30,90,.4)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(15, 15); g.lineTo(29, 31); g.moveTo(29, 15); g.lineTo(15, 31); g.stroke();
      g.fillStyle = '#4e3670'; g.beginPath(); g.arc(22, 23, 1.6, 0, TAU); g.fill();
      g.fillStyle = '#c3ccd6';
      for (const q of [[9.5, 15.5], [34.5, 15.5], [9.5, 30.5], [34.5, 30.5]]) {
        g.beginPath(); g.arc(q[0], q[1], 1.8, 0, TAU); g.fill();
      }
    } else if (id === 'griffoir') {
      // griffoir de guerre : poteau lacéré
      g.fillStyle = '#8a6a44'; g.beginPath(); g.ellipse(22, 38, 12, 4, 0, 0, TAU); g.fill();
      const pg2 = g.createLinearGradient(16, 0, 28, 0);
      pg2.addColorStop(0, '#d0aa6a'); pg2.addColorStop(1, '#96703e');
      g.fillStyle = pg2; roundRectPath(g, 16.5, 8, 11, 30, 4); g.fill();
      g.strokeStyle = 'rgba(110,80,40,.5)'; g.lineWidth = 1.2;
      for (let y = 11; y < 37; y += 3.6) { g.beginPath(); g.moveTo(17, y); g.lineTo(27, y - 1.8); g.stroke(); }
      g.strokeStyle = '#f6f0dc'; g.lineWidth = 1.6;
      for (const d of [-3, 0, 3]) { g.beginPath(); g.moveTo(20 + d, 15); g.lineTo(23 + d, 27); g.stroke(); }
    } else if (id === 'soufflerie') {
      // soufflerie d'entraînement au vol
      g.fillStyle = '#9aa4ae'; roundRectPath(g, 8, 28, 12, 10, 3); g.fill();
      const fg = g.createRadialGradient(13, 20, 1, 14, 22, 12);
      fg.addColorStop(0, '#d8e2ea'); fg.addColorStop(1, '#8894a0');
      g.fillStyle = fg; g.beginPath(); g.arc(14, 21, 10.5, 0, TAU); g.fill();
      g.fillStyle = '#5c6874';
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * TAU + .5;
        g.beginPath();
        g.moveTo(14, 21);
        g.quadraticCurveTo(14 + Math.cos(a) * 9, 21 + Math.sin(a) * 9, 14 + Math.cos(a + .8) * 7.5, 21 + Math.sin(a + .8) * 7.5);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#3a444e'; g.beginPath(); g.arc(14, 21, 2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(130,180,220,.8)'; g.lineWidth = 1.8;
      for (const q of [[27, 15, 12], [28, 21, 15], [27, 27, 11]]) {
        g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[0] + q[2] * .6, q[1] - 2, q[0] + q[2], q[1]); g.stroke();
      }
    } else if (id === 'miroir') {
      // miroir aux alouettes (à se battre contre soi-même)
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(15, 38); g.lineTo(22, 32); g.lineTo(29, 38); g.stroke();
      g.fillStyle = '#8a6a44';
      g.beginPath(); g.ellipse(22, 19, 11.5, 14.5, 0, 0, TAU); g.fill();
      const mg = g.createLinearGradient(13, 8, 30, 30);
      mg.addColorStop(0, '#e8f4fa'); mg.addColorStop(.55, '#b8d8ea');
      mg.addColorStop(1, '#8ab4cc');
      g.fillStyle = mg;
      g.beginPath(); g.ellipse(22, 19, 9, 12, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(17, 11); g.lineTo(25, 24); g.stroke();
      g.beginPath(); g.moveTo(21, 9); g.lineTo(27, 18); g.stroke();
    } else if (id === 'cible') {
      // cible à vers : rondelles + appât
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(22, 30); g.lineTo(22, 39); g.stroke();
      for (const q of [[13, '#f2ead2'], [9, '#e05252'], [5.5, '#f2ead2'], [2.6, '#e05252']]) {
        g.fillStyle = q[1];
        g.beginPath(); g.arc(22, 18, q[0], 0, TAU); g.fill();
      }
      // le ver (la paie du tireur d'élite)
      g.strokeStyle = '#e88aa0'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(30, 32); g.quadraticCurveTo(34, 28, 37, 32); g.quadraticCurveTo(39, 35, 41, 32); g.stroke();
      g.fillStyle = '#5c3038'; g.beginPath(); g.arc(30.5, 31.5, .9, 0, TAU); g.fill();
    } else if (id === 'mangeoire') {
      // mangeoire musclée : plateau de graines + haltère
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(22, 24); g.lineTo(22, 38); g.stroke();
      g.fillStyle = '#9a7a4e'; roundRectPath(g, 8, 18, 28, 6, 2.4); g.fill();
      g.fillStyle = '#e8c96a';
      const rn3 = mulberry(5);
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(11 + rn3() * 22, 19 + rn3() * 2.6, 1.1, 0, TAU); g.fill(); }
      // la petite haltère (on ne picore pas gratuitement ici)
      g.strokeStyle = '#3a3f4a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(28, 33); g.lineTo(38, 33); g.stroke();
      g.fillStyle = '#3a3f4a';
      roundRectPath(g, 26.5, 29.5, 3, 7, 1.2); g.fill();
      roundRectPath(g, 36.5, 29.5, 3, 7, 1.2); g.fill();
    } else if (id === 'perchoir') {
      // perchoir zen : branche, enso, feuille
      g.strokeStyle = 'rgba(120,140,120,.6)'; g.lineWidth = 2;
      g.beginPath(); g.arc(22, 20, 13, .6, TAU - .3); g.stroke();
      twig(g, 8, 30, 36, 26, 3, '#7a5c34');
      twig(g, 30, 27, 36, 20, 1.8, '#7a5c34');
      g.fillStyle = '#7aa05a';
      g.beginPath(); g.ellipse(37.5, 18.5, 2.2, 4, .5, 0, TAU); g.fill();
      g.fillStyle = '#e8dcc0';
      g.beginPath(); g.ellipse(20, 27.5, 5, 2.4, 0, 0, TAU); g.fill();
    } else if (id === 'roue_lestee') {
      // roue de course + gueuses de plomb accrochées
      g.strokeStyle = '#8a6a44'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(13, 37); g.lineTo(20, 22); g.lineTo(27, 37); g.stroke();
      g.fillStyle = '#d8cbb0'; g.beginPath(); g.arc(20, 20, 12, 0, TAU); g.fill();
      g.strokeStyle = '#7a5c34'; g.lineWidth = 2.4; g.beginPath(); g.arc(20, 20, 12, 0, TAU); g.stroke();
      g.lineWidth = 1.3;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .3; g.beginPath(); g.moveTo(20, 20); g.lineTo(20 + Math.cos(a) * 11, 20 + Math.sin(a) * 11); g.stroke(); }
      g.fillStyle = '#5a616b';
      roundRectPath(g, 29, 24, 9, 7, 2); g.fill();
      roundRectPath(g, 31, 32, 8, 6, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '900 5px Nunito, sans-serif'; g.textAlign = 'center';
      g.fillText('10', 33.5, 29);
    } else if (id === 'sac_sable') {
      // sac de frappe suspendu, cuir lacéré
      g.strokeStyle = '#6a5a48'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 6); g.lineTo(34, 6); g.stroke();
      g.beginPath(); g.moveTo(22, 6); g.lineTo(22, 11); g.stroke();
      const bg = g.createLinearGradient(15, 0, 30, 0);
      bg.addColorStop(0, '#c98a52'); bg.addColorStop(1, '#8e5c2e');
      g.fillStyle = bg; roundRectPath(g, 14, 11, 16, 26, 7); g.fill();
      g.strokeStyle = 'rgba(70,45,20,.45)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(14, 19); g.lineTo(30, 19); g.moveTo(14, 30); g.lineTo(30, 30); g.stroke();
      g.strokeStyle = '#f2ead2'; g.lineWidth = 1.4;
      for (const d of [0, 4]) { g.beginPath(); g.moveTo(18 + d, 22); g.lineTo(23 + d, 28); g.stroke(); }
    } else if (id === 'filet_pend') {
      // filet à pendules : cadre + mailles + boules qui se balancent
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(8, 8); g.lineTo(36, 8); g.moveTo(9, 8); g.lineTo(9, 38); g.moveTo(35, 8); g.lineTo(35, 38); g.stroke();
      g.strokeStyle = 'rgba(120,100,70,.55)'; g.lineWidth = 1;
      for (let x = 12; x < 35; x += 5) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, 26); g.stroke(); }
      for (let y = 12; y < 27; y += 5) { g.beginPath(); g.moveTo(10, y); g.lineTo(34, y); g.stroke(); }
      g.strokeStyle = '#6a5a48'; g.lineWidth = 1.2;
      for (const q of [[15, 30], [22, 34], [29, 28]]) {
        g.beginPath(); g.moveTo(q[0], 12); g.lineTo(q[0], q[1]); g.stroke();
        g.fillStyle = '#b06a4a'; g.beginPath(); g.arc(q[0], q[1] + 2.5, 3, 0, TAU); g.fill();
      }
    } else if (id === 'lampe_sorc') {
      // lampe de sorcière : lanterne + flamme mauve + volutes
      g.strokeStyle = '#5c4a36'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(22, 4); g.lineTo(22, 10); g.stroke();
      g.fillStyle = '#4a4a52'; roundRectPath(g, 13, 10, 18, 4, 2); g.fill();
      roundRectPath(g, 13, 32, 18, 5, 2); g.fill();
      const lg = g.createLinearGradient(0, 14, 0, 32);
      lg.addColorStop(0, 'rgba(200,160,255,.55)'); lg.addColorStop(1, 'rgba(120,80,190,.45)');
      g.fillStyle = lg; roundRectPath(g, 15, 13, 14, 20, 3); g.fill();
      g.strokeStyle = 'rgba(60,50,70,.6)'; g.lineWidth = 1.2; roundRectPath(g, 15, 13, 14, 20, 3); g.stroke();
      const fg2 = g.createRadialGradient(22, 25, 1, 22, 25, 8);
      fg2.addColorStop(0, '#f2e2ff'); fg2.addColorStop(.5, '#b075f0'); fg2.addColorStop(1, 'rgba(140,80,220,0)');
      g.fillStyle = fg2; g.beginPath(); g.arc(22, 25, 8, 0, TAU); g.fill();
      g.fillStyle = '#e8d0ff';
      g.beginPath(); g.moveTo(22, 18); g.quadraticCurveTo(26, 24, 22, 29); g.quadraticCurveTo(18, 24, 22, 18); g.fill();
    } else if (id === 'baril_roule') {
      // baril de poudre sur sa rampe (rouler sans exploser, tout un art)
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(4, 36); g.lineTo(40, 30); g.stroke();
      g.save(); g.translate(22, 22); g.rotate(-.16);
      const dg = g.createLinearGradient(-11, 0, 11, 0);
      dg.addColorStop(0, '#8a5a3a'); dg.addColorStop(.5, '#c08a52'); dg.addColorStop(1, '#7a4a2a');
      g.fillStyle = dg; roundRectPath(g, -11, -9, 22, 18, 5); g.fill();
      g.strokeStyle = '#5a6068'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-6, -9); g.lineTo(-6, 9); g.moveTo(6, -9); g.lineTo(6, 9); g.stroke();
      g.fillStyle = '#3a2a1a'; g.font = '900 8px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('💥', 0, 0);
      g.restore();
      g.strokeStyle = 'rgba(120,90,50,.5)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(22, 22, 15, 2.4, 3.5); g.stroke();
    } else if (id === 'courant_asc') {
      // courant ascendant : rocher + spirale d'air qui monte
      g.fillStyle = '#8a8f96'; g.beginPath(); g.ellipse(22, 37, 13, 5, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,180,220,.85)'; g.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const y = 32 - i * 9;
        g.beginPath();
        g.moveTo(11 + i, y); g.quadraticCurveTo(22, y - 7, 33 - i, y - 1);
        g.stroke();
      }
      g.strokeStyle = 'rgba(160,210,240,.6)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(22, 33); g.quadraticCurveTo(28, 22, 22, 12); g.quadraticCurveTo(16, 6, 22, 3); g.stroke();
    } else if (id === 'rocher_becq') {
      // rocher à becquée : caillou strié + éclats
      g.fillStyle = '#6f7680';
      g.beginPath(); g.moveTo(8, 36); g.lineTo(13, 16); g.lineTo(26, 9); g.lineTo(36, 20); g.lineTo(33, 36); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.beginPath(); g.moveTo(13, 16); g.lineTo(26, 9); g.lineTo(27, 22); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,45,55,.5)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(16, 33); g.lineTo(22, 22); g.lineTo(30, 26); g.stroke();
      g.fillStyle = '#c9d2dc';
      for (const q of [[12, 12], [34, 13], [38, 30]]) { g.beginPath(); g.arc(q[0], q[1], 1.6, 0, TAU); g.fill(); }
    } else if (id === 'voliere_mir') {
      // volière à miroirs : cage + éclats réfléchissants
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.2;
      g.beginPath(); g.arc(22, 24, 14, Math.PI, TAU); g.stroke();
      g.beginPath(); g.moveTo(8, 24); g.lineTo(8, 36); g.moveTo(36, 24); g.lineTo(36, 36); g.moveTo(6, 37); g.lineTo(38, 37); g.stroke();
      g.strokeStyle = 'rgba(140,110,70,.55)'; g.lineWidth = 1;
      for (const x of [14, 22, 30]) { g.beginPath(); g.moveTo(x, 12 + Math.abs(22 - x) * .35); g.lineTo(x, 36); g.stroke(); }
      const mg2 = g.createLinearGradient(16, 16, 28, 30);
      mg2.addColorStop(0, '#eaf6ff'); mg2.addColorStop(1, '#9dc4dc');
      g.fillStyle = mg2;
      g.beginPath(); g.moveTo(18, 18); g.lineTo(27, 21); g.lineTo(24, 31); g.lineTo(17, 27); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(19, 21); g.lineTo(23, 28); g.stroke();
    } else if (id === 'nuage_runes') {
      // nuage de runes : nuée + glyphes qui tournent
      g.fillStyle = 'rgba(190,175,225,.9)';
      g.beginPath();
      g.arc(16, 24, 8, 0, TAU); g.arc(24, 20, 10, 0, TAU); g.arc(31, 25, 7, 0, TAU);
      g.rect(16, 24, 15, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(20, 19, 5, 0, TAU); g.fill();
      g.fillStyle = '#7a52c0'; g.font = '900 9px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ᚱ', 14, 36); g.fillText('ᚷ', 23, 39); g.fillText('ᛉ', 32, 35);
      g.strokeStyle = 'rgba(160,120,230,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(14, 32); g.lineTo(14, 33.5); g.moveTo(23, 34); g.lineTo(23, 36); g.moveTo(32, 31); g.lineTo(32, 32.5); g.stroke();
    } else if (id === 'champ_mines') {
      // champ de mines à grelots : herbe + grelots à fil tendu
      g.fillStyle = '#8fae62'; g.beginPath(); g.ellipse(22, 36, 17, 6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,70,40,.7)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(6, 27); g.lineTo(38, 24); g.stroke();
      for (const q of [[12, 29], [22, 27.5], [32, 26]]) {
        g.fillStyle = '#e8c24a'; g.beginPath(); g.arc(q[0], q[1] + 4, 4, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(120,90,20,.7)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(q[0] - 3.4, q[1] + 4); g.lineTo(q[0] + 3.4, q[1] + 4); g.stroke();
        g.fillStyle = '#8a6a20'; g.beginPath(); g.arc(q[0], q[1] + 6.6, 1, 0, TAU); g.fill();
      }
      g.strokeStyle = '#6f8a44'; g.lineWidth = 1.4;
      for (const x of [9, 17, 27, 36]) { g.beginPath(); g.moveTo(x, 36); g.quadraticCurveTo(x + 1.5, 31, x + 3, 29); g.stroke(); }
    } else if (id === 'parcours') {
      // parcours d'obstacles : haies + fanions
      g.fillStyle = '#9aad72'; g.beginPath(); g.ellipse(22, 38, 18, 4, 0, 0, TAU); g.fill();
      for (const q of [[10, 26], [22, 22], [34, 28]]) {
        g.strokeStyle = '#8a6a44'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(q[0] - 4, 37); g.lineTo(q[0] - 4, q[1]); g.moveTo(q[0] + 4, 37); g.lineTo(q[0] + 4, q[1]); g.stroke();
        g.fillStyle = '#d8564a'; roundRectPath(g, q[0] - 6, q[1] - 2, 12, 4, 1.6); g.fill();
        g.fillStyle = '#f2ead2'; roundRectPath(g, q[0] - 6, q[1] + 3, 12, 3, 1.2); g.fill();
      }
      g.fillStyle = '#e8b83a';
      g.beginPath(); g.moveTo(38, 8); g.lineTo(38, 20); g.lineTo(31, 14); g.closePath(); g.fill();
      g.strokeStyle = '#8a6a44'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(38, 7); g.lineTo(38, 24); g.stroke();
    } else if (id === 'poutre') {
      // poutre d'équilibre : tréteaux + plateau + plume posée
      g.fillStyle = '#8a6a44';
      g.beginPath(); g.moveTo(8, 38); g.lineTo(13, 24); g.lineTo(16, 24); g.lineTo(12, 38); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(36, 38); g.lineTo(31, 24); g.lineTo(28, 24); g.lineTo(32, 38); g.closePath(); g.fill();
      const pg3 = g.createLinearGradient(0, 18, 0, 25);
      pg3.addColorStop(0, '#e2c893'); pg3.addColorStop(1, '#b08a52');
      g.fillStyle = pg3; roundRectPath(g, 6, 19, 32, 6, 2.4); g.fill();
      g.strokeStyle = 'rgba(110,80,40,.45)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(9, 22); g.lineTo(35, 22); g.stroke();
      g.fillStyle = '#f2ead2';
      g.beginPath(); g.ellipse(24, 15, 2.6, 5.5, .5, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,110,70,.7)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(22.5, 19.5); g.lineTo(26, 10); g.stroke();
    } else if (id === 'mur') {
      // mur de grimpe : panneau + prises colorées + corde
      const wg = g.createLinearGradient(0, 6, 0, 38);
      wg.addColorStop(0, '#c8b48e'); wg.addColorStop(1, '#9a7a52');
      g.fillStyle = wg; roundRectPath(g, 9, 6, 26, 32, 3); g.fill();
      g.strokeStyle = 'rgba(90,65,30,.5)'; g.lineWidth = 1.2; roundRectPath(g, 9, 6, 26, 32, 3); g.stroke();
      const rn4 = mulberry(11);
      const cols = ['#d8564a', '#4a90d8', '#58b368', '#e8b83a'];
      for (let i = 0; i < 8; i++) {
        g.fillStyle = cols[i % 4];
        const x = 13 + rn4() * 18, y = 10 + rn4() * 24;
        g.beginPath(); g.ellipse(x, y, 2.4, 1.8, rn4() * 3, 0, TAU); g.fill();
      }
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(33, 5); g.quadraticCurveTo(38, 20, 34, 37); g.stroke();
    } else if (id === 'fontaine') {
      // fontaine : vasque, jet, gouttes
      g.fillStyle = '#a8b6c2'; g.beginPath(); g.ellipse(22, 34, 15, 6, 0, 0, TAU); g.fill();
      g.fillStyle = '#7f8e9c'; g.beginPath(); g.ellipse(22, 32, 15, 6, 0, 0, TAU); g.fill();
      g.fillStyle = '#6fb6d8'; g.beginPath(); g.ellipse(22, 32, 12, 4.4, 0, 0, TAU); g.fill();
      g.fillStyle = '#a8b6c2'; roundRectPath(g, 20, 18, 4, 13, 1.6); g.fill();
      g.beginPath(); g.ellipse(22, 18, 7, 2.6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,205,235,.85)'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(22, 10); g.quadraticCurveTo(30, 16, 29, 27); g.stroke();
      g.beginPath(); g.moveTo(22, 10); g.quadraticCurveTo(14, 16, 15, 27); g.stroke();
      g.fillStyle = '#bfe6f4';
      for (const q of [[13, 22], [31, 20], [22, 8]]) { g.beginPath(); g.arc(q[0], q[1], 1.5, 0, TAU); g.fill(); }
    } else if (id === 'duel') {
      // cage de duel : arène ronde + deux armes croisées
      g.fillStyle = '#c8b48e'; g.beginPath(); g.ellipse(22, 27, 16, 11, 0, 0, TAU); g.fill();
      g.strokeStyle = '#7a5c34'; g.lineWidth = 2; g.beginPath(); g.ellipse(22, 27, 16, 11, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(120,90,50,.45)'; g.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(22 + Math.cos(a) * 16, 27 + Math.sin(a) * 11); g.lineTo(22 + Math.cos(a) * 16, 27 + Math.sin(a) * 11 - 7); g.stroke(); }
      g.strokeStyle = '#c3ccd6'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(14, 24); g.lineTo(30, 10); g.moveTo(30, 24); g.lineTo(14, 10); g.stroke();
      g.strokeStyle = '#8a5a2a'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(12, 26); g.lineTo(15, 23); g.moveTo(32, 26); g.lineTo(29, 23); g.stroke();
    } else if (id === 'stand') {
      // stand de tir : cibles alignées + flèche plantée
      g.fillStyle = '#9aad72'; g.beginPath(); g.ellipse(22, 37, 18, 5, 0, 0, TAU); g.fill();
      for (const q of [[12, 22, 6], [24, 19, 8], [35, 24, 5]]) {
        g.strokeStyle = '#8a6a44'; g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(q[0], q[1] + q[2]); g.lineTo(q[0], 36); g.stroke();
        g.fillStyle = '#f2ead2'; g.beginPath(); g.arc(q[0], q[1], q[2], 0, TAU); g.fill();
        g.fillStyle = '#d8564a'; g.beginPath(); g.arc(q[0], q[1], q[2] * .55, 0, TAU); g.fill();
        g.fillStyle = '#f2ead2'; g.beginPath(); g.arc(q[0], q[1], q[2] * .2, 0, TAU); g.fill();
      }
      g.strokeStyle = '#6a5a48'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(30, 9); g.lineTo(24.6, 18); g.stroke();
      g.fillStyle = '#e8dcc0';
      g.beginPath(); g.moveTo(30, 9); g.lineTo(34, 6); g.lineTo(32, 12); g.closePath(); g.fill();
    } else if (id === 'obelisque') {
      // obélisque runique : pierre dressée, glyphes, halo
      const og = g.createLinearGradient(16, 0, 30, 0);
      og.addColorStop(0, '#8e93a8'); og.addColorStop(.5, '#c2c6d6'); og.addColorStop(1, '#6e7488');
      g.fillStyle = og;
      g.beginPath(); g.moveTo(18, 36); g.lineTo(19.5, 12); g.lineTo(22, 6); g.lineTo(24.5, 12); g.lineTo(26, 36); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(50,55,70,.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(22, 7); g.lineTo(22, 35); g.stroke();
      g.fillStyle = '#7a52c0'; g.font = '900 6px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ᚦ', 22, 16); g.fillText('ᛊ', 22, 24); g.fillText('ᛗ', 22, 31);
      const hg = g.createRadialGradient(22, 20, 2, 22, 20, 16);
      hg.addColorStop(0, 'rgba(160,110,240,.30)'); hg.addColorStop(1, 'rgba(160,110,240,0)');
      g.fillStyle = hg; g.beginPath(); g.arc(22, 20, 16, 0, TAU); g.fill();
      g.fillStyle = '#6a6f80'; g.beginPath(); g.ellipse(22, 37, 11, 3.6, 0, 0, TAU); g.fill();
    } else if (id === 'mortier') {
      // mortier d'exercice : tube incliné + boulet + fumée
      g.fillStyle = '#7a5c34'; roundRectPath(g, 10, 31, 24, 6, 2); g.fill();
      g.save(); g.translate(21, 26); g.rotate(-.62);
      const tg = g.createLinearGradient(-7, 0, 7, 0);
      tg.addColorStop(0, '#3f454e'); tg.addColorStop(.5, '#788290'); tg.addColorStop(1, '#333940');
      g.fillStyle = tg; roundRectPath(g, -7, -13, 14, 24, 3); g.fill();
      g.fillStyle = '#2b3038'; g.beginPath(); g.ellipse(0, -13, 7, 2.6, 0, 0, TAU); g.fill();
      g.restore();
      g.fillStyle = '#2b3038'; g.beginPath(); g.arc(33, 12, 4.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(31.6, 10.6, 1.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(220,220,225,.55)';
      g.beginPath(); g.arc(13, 12, 4, 0, TAU); g.arc(18, 8, 3, 0, TAU); g.arc(9, 8, 2.4, 0, TAU); g.fill();
    } else {
      // jeton générique (ne devrait plus servir : tout agrès a son dessin)
      g.fillStyle = '#c9a06a'; g.beginPath(); g.arc(22, 22, 13, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.8)';
      starPath(g, 22, 22, 5, 7, 3, -Math.PI / 2); g.fill();
    }
    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getFactionBanner — bannière woodcut de l'écran titre :
  // parchemin usé, cadre gravé, lances croisées, silhouette du chef
  // à l'encre, banderole au nom de la faction.
  // ------------------------------------------------------------
  function getFactionBanner(faction, w, h) {
    faction = faction === 'birds' ? 'birds' : 'cats';
    w = w || 240; h = h || 300;
    const key = 'ban|' + faction + '|' + w + '|' + h;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(w, h);
    const g = cv.getContext('2d');
    g.scale(w / 240, h / 300);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const F = SGD.FACTIONS[faction];
    const ink = '#33261a';
    const rn = mulberry(faction === 'cats' ? 42 : 137);

    // parchemin au bord déchiré
    g.fillStyle = '#e8dcbb';
    g.beginPath();
    let first = true;
    const seg = function (x, y) { first ? g.moveTo(x, y) : g.lineTo(x, y); first = false; };
    for (let x = 12; x <= 228; x += 16) seg(x, 10 + (rn() - .5) * 7);
    for (let y = 24; y <= 282; y += 16) seg(228 + (rn() - .5) * 8, y);
    for (let x = 228; x >= 12; x -= 16) seg(x, 290 + (rn() - .5) * 7);
    for (let y = 282; y >= 24; y -= 16) seg(12 + (rn() - .5) * 8, y);
    g.closePath(); g.fill();
    // grain + taches d'usure
    g.globalAlpha = .05; g.fillStyle = '#5a4526';
    for (let i = 0; i < 240; i++) g.fillRect(14 + rn() * 212, 12 + rn() * 276, 1 + rn() * 2, 1 + rn() * 2);
    g.globalAlpha = .09;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.ellipse(22 + rn() * 196, 18 + rn() * 264, 6 + rn() * 16, 4 + rn() * 10, rn() * 3, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    // double cadre gravé + hachures d'angle
    g.strokeStyle = ink; g.lineWidth = 4; g.strokeRect(22, 20, 196, 260);
    g.lineWidth = 1.5; g.strokeRect(29, 27, 182, 246);
    g.strokeStyle = rgba(ink, .5); g.lineWidth = 1.2;
    for (const c of [[22, 20, 1, 1], [218, 20, -1, 1], [22, 280, 1, -1], [218, 280, -1, -1]]) {
      for (let i = 1; i <= 4; i++) {
        g.beginPath();
        g.moveTo(c[0] + c[2] * (6 + i * 7), c[1] + c[3] * 4);
        g.lineTo(c[0] + c[2] * 4, c[1] + c[3] * (6 + i * 7));
        g.stroke();
      }
    }

    // devise mordante en tête
    g.fillStyle = ink;
    g.font = '700 12px Georgia, "Times New Roman", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(faction === 'cats' ? '— TOUT EST À NOUS —' : '— LE CIEL NE SUFFIT PLUS —', 120, 46);

    // lances croisées derrière le médaillon
    for (const s of [-1, 1]) {
      g.strokeStyle = '#6b5232'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(120 - s * 58, 82); g.lineTo(120 + s * 58, 204); g.stroke();
      g.fillStyle = '#8f939c';
      g.beginPath();
      g.moveTo(120 - s * 58 - s * 10, 62);
      g.lineTo(120 - s * 58 + s * 5, 78);
      g.lineTo(120 - s * 58 - s * 13, 84);
      g.closePath(); g.fill();
      g.strokeStyle = rgba(ink, .5); g.lineWidth = 1.2; g.stroke();
    }

    // médaillon : champ faction hachuré + silhouette du chef
    g.fillStyle = F.acc;
    g.beginPath(); g.arc(120, 142, 62, 0, TAU); g.fill();
    g.save();
    g.beginPath(); g.arc(120, 142, 62, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(58,42,22,.28)'; g.lineWidth = 1.1;
    for (let i = 0; i < 14; i++) {
      g.beginPath(); g.moveTo(58 + i * 10, 80); g.lineTo(38 + i * 10, 204); g.stroke();
    }
    g.fillStyle = ink;
    if (faction === 'cats') {
      // Général Moustache de profil, menton haut, l'air peu impressionné
      g.beginPath();
      g.moveTo(86, 178);
      g.quadraticCurveTo(84, 142, 96, 124);
      g.lineTo(90, 98); g.lineTo(112, 110);
      g.lineTo(118, 106); g.lineTo(124, 84); g.lineTo(140, 104);
      g.quadraticCurveTo(152, 110, 158, 122);
      g.lineTo(172, 128);
      g.quadraticCurveTo(174, 134, 166, 136);
      g.lineTo(168, 142);
      g.quadraticCurveTo(160, 148, 150, 146);
      g.quadraticCurveTo(150, 164, 142, 178);
      g.closePath(); g.fill();
      // œil : fente de parchemin
      g.fillStyle = '#e8dcbb';
      g.beginPath(); g.moveTo(138, 118); g.lineTo(154, 122); g.lineTo(140, 125.5); g.closePath(); g.fill();
      // moustaches de général
      g.strokeStyle = ink; g.lineWidth = 2.4;
      for (const dy of [0, 6]) {
        g.beginPath(); g.moveTo(158, 138 + dy);
        g.quadraticCurveTo(176, 135 + dy, 185, 140 + dy);
        g.stroke();
      }
      // griffures dans le champ (signature locale)
      g.strokeStyle = 'rgba(58,42,22,.5)'; g.lineWidth = 2.2;
      for (const d of [0, 7, 14]) {
        g.beginPath(); g.moveTo(72 + d, 96); g.lineTo(80 + d, 122); g.stroke();
      }
    } else {
      // Maréchale Plume : rapace de profil, arcade lourde
      g.beginPath();
      g.moveTo(88, 180);
      g.quadraticCurveTo(82, 132, 100, 110);
      g.quadraticCurveTo(116, 92, 140, 96);
      g.quadraticCurveTo(154, 98, 160, 110);
      g.lineTo(180, 118);
      g.quadraticCurveTo(186, 124, 172, 130);
      g.lineTo(156, 128);
      g.quadraticCurveTo(158, 142, 148, 152);
      g.lineTo(151, 161); g.lineTo(140, 156); g.lineTo(143, 167); g.lineTo(130, 160);
      g.quadraticCurveTo(126, 172, 122, 180);
      g.closePath(); g.fill();
      // œil sous l'arcade
      g.fillStyle = '#e8dcbb';
      g.beginPath(); g.moveTo(140, 110); g.lineTo(158, 114); g.lineTo(142, 118.5); g.closePath(); g.fill();
      // plumes qui tombent (le champ de bataille approche)
      g.fillStyle = 'rgba(58,42,22,.5)';
      for (const q of [[76, 100, .5], [170, 168, -.4]]) {
        g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
        g.beginPath();
        g.moveTo(0, -7); g.quadraticCurveTo(5, -1, 0, 8); g.quadraticCurveTo(-5, -1, 0, -7);
        g.closePath(); g.fill();
        g.restore();
      }
    }
    g.restore();
    g.strokeStyle = ink; g.lineWidth = 4.5;
    g.beginPath(); g.arc(120, 142, 62, 0, TAU); g.stroke();
    g.lineWidth = 1.4;
    g.beginPath(); g.arc(120, 142, 55, 0, TAU); g.stroke();

    // banderole du nom, bouts fourchus
    g.fillStyle = SGD.shade(F.acc2, -.08);
    g.beginPath();
    g.moveTo(44, 232); g.lineTo(196, 232); g.lineTo(196, 260); g.lineTo(44, 260);
    g.closePath(); g.fill();
    for (const s of [-1, 1]) {
      const x = s < 0 ? 44 : 196;
      g.beginPath();
      g.moveTo(x, 232); g.lineTo(x + s * 16, 236); g.lineTo(x + s * 8, 246);
      g.lineTo(x + s * 16, 256); g.lineTo(x, 260);
      g.closePath(); g.fill();
    }
    g.strokeStyle = ink; g.lineWidth = 2.2;
    g.strokeRect(44, 232, 152, 28);
    g.fillStyle = '#f2e8cc';
    g.font = '900 21px Georgia, "Times New Roman", serif';
    g.fillText(F.name.toUpperCase(), 120, 247);

    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // §4 — MANNEQUIN d'entraînement du dojo : cible simple et flat,
  // épouvantail à plumes (oiseaux) / pelote-cible griffée (chats).
  // Statique, sobre, additif à la scène du dojo. Cache par (faction, size).
  // ------------------------------------------------------------
  function getMannequinCanvas(faction, size) {
    size = size || 96;
    const bird = faction === 'birds';
    const key = 'mannequin|' + (bird ? 'birds' : 'cats') + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    const k = size / 96;
    g.translate(size / 2, size / 2);
    g.scale(k, k);
    g.lineJoin = 'round';

    // ombre au sol
    g.fillStyle = 'rgba(20,30,25,.16)';
    g.beginPath(); g.ellipse(0, 40, 22, 6, 0, 0, TAU); g.fill();
    // poteau de bois planté en terre
    g.fillStyle = '#8a6a44';
    roundRectPath(g, -3, -6, 6, 46, 2); g.fill();
    g.strokeStyle = 'rgba(58,38,18,.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 38); g.stroke();
    g.fillStyle = '#6e4a28';
    g.beginPath(); g.moveTo(-3, 38); g.lineTo(3, 38); g.lineTo(0, 44); g.closePath(); g.fill();

    if (bird) {
      // épouvantail à plumes : traverse + corps de jute + tête sac
      g.strokeStyle = '#8a6a44'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-24, -2); g.lineTo(24, -2); g.stroke();
      // plumes qui dépassent aux bras et à la tête
      for (const q of [[-24, -2, -1], [24, -2, 1], [0, -28, 0]]) {
        taperedStroke(g, [[q[0], q[1]], [q[0] + q[2] * 6, q[1] - 11]], 2.4, .6, '#e8e2d4');
        taperedStroke(g, [[q[0], q[1]], [q[0] + q[2] * 10, q[1] - 6]], 2, .5, '#c9b48a');
      }
      // corps en toile de jute
      g.fillStyle = '#c8a86a';
      roundRectPath(g, -13, -14, 26, 26, 6); g.fill();
      g.strokeStyle = 'rgba(90,64,32,.35)'; g.lineWidth = 1;
      for (const dy of [-6, 2]) { g.beginPath(); g.moveTo(-12, dy); g.lineTo(12, dy); g.stroke(); }
      // cible peinte sur le torse
      for (const rr of [[9, '#3a352c'], [5.5, '#c8503c'], [2, '#3a352c']]) {
        g.strokeStyle = rr[1]; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -1, rr[0], 0, TAU); g.stroke();
      }
      // tête sac de toile + yeux en croix cousus
      g.fillStyle = '#d8bd84';
      g.beginPath(); g.arc(0, -20, 8, 0, TAU); g.fill();
      g.strokeStyle = '#5a4632'; g.lineWidth = 1.4;
      for (const ex of [-3, 3]) {
        g.beginPath();
        g.moveTo(ex - 1.4, -22); g.lineTo(ex + 1.4, -19);
        g.moveTo(ex + 1.4, -22); g.lineTo(ex - 1.4, -19);
        g.stroke();
      }
    } else {
      // pelote-cible griffée : gros coussin cible + balafres de griffes
      g.fillStyle = '#b89a6a';
      roundRectPath(g, -6, -8, 12, 12, 3); g.fill();
      const grad = g.createRadialGradient(-3, -18, 2, 0, -14, 20);
      grad.addColorStop(0, '#e8dcc0'); grad.addColorStop(1, '#cbb488');
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, -14, 18, 0, TAU); g.fill();
      for (const rr of [[14, '#3a352c'], [9.5, '#c8503c'], [5, '#3a352c']]) {
        g.strokeStyle = rr[1]; g.lineWidth = 2; g.beginPath(); g.arc(0, -14, rr[0], 0, TAU); g.stroke();
      }
      g.fillStyle = '#c8503c'; g.beginPath(); g.arc(0, -14, 2, 0, TAU); g.fill();
      // trois balafres de griffes en travers
      g.strokeStyle = 'rgba(58,38,28,.55)'; g.lineWidth = 1.4; g.lineCap = 'round';
      for (const off of [-4, 0, 4]) {
        g.beginPath();
        g.moveTo(-10 + off, -22);
        g.quadraticCurveTo(-2 + off, -14, -8 + off, -6);
        g.stroke();
      }
      // brins de rembourrage qui s'échappent
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 1;
      for (const q of [[-14, -16, -1], [15, -12, 1]]) {
        g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + q[2] * 5, q[1] - 4); g.stroke();
      }
    }

    cache.set(key, cv);
    return cv;
  }




