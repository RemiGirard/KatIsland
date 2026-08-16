/* ============================================================
   GRIFFES & PLUMES — sprites-weapons.js (3/9)
   Armes tenues : lance/lame, tir, bâton, munitions (+ FX de lame).
   ============================================================ */
"use strict";

  // ------------------------------------------------------------
  // LAMES — géométrie partagée petite lance / grande lance.
  // Repère : lame pointant +X, base de lame en x = bx, échelle k.
  // ol = couleur de liseré (ou null).
  // ------------------------------------------------------------
  function drawBlade(g, st, bx, k, ol) {
    const grad = g.createLinearGradient(bx - 2 * k, 0, bx + 10 * k, 0);
    grad.addColorStop(0, st.bladeC2);
    grad.addColorStop(1, st.bladeC1);
    g.fillStyle = grad;

    switch (st.blade) {
      case 'tri':
        g.beginPath();
        g.moveTo(bx + 8.5 * k, 0);
        g.lineTo(bx, -3.4 * k);
        g.lineTo(bx, 3.4 * k);
        g.closePath();
        break;

      case 'leaf':
        g.beginPath();
        g.moveTo(bx - 1 * k, 0);
        g.quadraticCurveTo(bx + 2.5 * k, -4.2 * k, bx + 10 * k, 0);
        g.quadraticCurveTo(bx + 2.5 * k, 4.2 * k, bx - 1 * k, 0);
        g.closePath();
        break;

      case 'barb':
        g.beginPath();
        g.moveTo(bx + 9 * k, 0);
        g.lineTo(bx + 1 * k, -3.3 * k);
        g.lineTo(bx - 2 * k, -5.2 * k);
        g.lineTo(bx - 0.4 * k, -1.1 * k);
        g.lineTo(bx - 0.4 * k, 1.1 * k);
        g.lineTo(bx - 2 * k, 5.2 * k);
        g.lineTo(bx + 1 * k, 3.3 * k);
        g.closePath();
        break;

      case 'trident':
        g.beginPath();
        // barre de liaison
        g.rect(bx - 0.4 * k, -3.8 * k, 1.5 * k, 7.6 * k);
        // dent centrale
        g.moveTo(bx + 9.5 * k, 0);
        g.lineTo(bx + 0.8 * k, -1.2 * k);
        g.lineTo(bx + 0.8 * k, 1.2 * k);
        g.closePath();
        // dents latérales, légèrement évasées
        for (const s of [-1, 1]) {
          g.moveTo(bx + 7 * k, s * 4.4 * k);
          g.lineTo(bx + 0.8 * k, s * 2.4 * k);
          g.lineTo(bx + 0.8 * k, s * 4.6 * k);
          g.closePath();
        }
        break;

      case 'halberd':
        g.beginPath();
        // pointe de lance
        g.moveTo(bx + 10 * k, 0);
        g.lineTo(bx + 2 * k, -1.7 * k);
        g.lineTo(bx + 2 * k, 1.7 * k);
        g.closePath();
        // fer de hache (côté haut)
        g.moveTo(bx + 0.4 * k, -1.2 * k);
        g.quadraticCurveTo(bx - 1 * k, -6.2 * k, bx + 3.8 * k, -6.4 * k);
        g.quadraticCurveTo(bx + 6 * k, -3.6 * k, bx + 5.4 * k, -1.2 * k);
        g.closePath();
        // ergot arrière (côté bas)
        g.moveTo(bx + 1 * k, 1.2 * k);
        g.lineTo(bx + 2.4 * k, 4.8 * k);
        g.lineTo(bx + 4 * k, 1.2 * k);
        g.closePath();
        break;

      case 'crescent':
        g.beginPath();
        g.arc(bx + 2 * k, 0, 6 * k, -2.0, 2.0);
        g.arc(bx - 0.6 * k, 0, 5.1 * k, 1.75, -1.75, true);
        g.closePath();
        break;

      case 'star':
        starPath(g, bx + 5 * k, 0, 5, 5.8 * k, 2.4 * k, 0);
        break;

      case 'double':
        g.beginPath();
        // grande lame feuille
        g.moveTo(bx - 0.5 * k, 0);
        g.quadraticCurveTo(bx + 2.5 * k, -3.8 * k, bx + 9.5 * k, 0);
        g.quadraticCurveTo(bx + 2.5 * k, 3.8 * k, bx - 0.5 * k, 0);
        g.closePath();
        // deux crocs recourbés vers l'arrière
        for (const s of [-1, 1]) {
          g.moveTo(bx + 0.6 * k, s * 1.0 * k);
          g.quadraticCurveTo(bx - 1.2 * k, s * 4.2 * k, bx - 4.2 * k, s * 5.6 * k);
          g.quadraticCurveTo(bx - 1.4 * k, s * 2.6 * k, bx - 0.4 * k, s * 0.4 * k);
          g.closePath();
        }
        break;

      default:
        g.beginPath();
        g.moveTo(bx + 8 * k, 0); g.lineTo(bx, -3.4 * k); g.lineTo(bx, 3.4 * k);
        g.closePath();
    }
    g.fill();
    if (ol) {
      g.strokeStyle = ol; g.lineWidth = 0.7 * k; g.lineJoin = 'round';
      g.stroke();
    }
    // étincelle centrale pour l'étoile
    if (st.blade === 'star') {
      g.fillStyle = rgba('#ffffff', 0.55);
      g.beginPath(); g.arc(bx + 5 * k, 0, 1.1 * k, 0, TAU); g.fill();
    }
  }

  // ------------------------------------------------------------
  // FX de lame : 2-3 petites particules animées (déterministes)
  // phase : 0..1 continu ; k : échelle ; n : nombre de particules
  // ------------------------------------------------------------
  const RAINBOW = ['#ff5a5a', '#ffb13c', '#ffe94d', '#5ad86e', '#4da9ff', '#b06aff'];

  function drawFx(g, fx, cx, cy, phase, k, n) {
    for (let i = 0; i < n; i++) {
      const u = ((phase + i / n) % 1 + 1) % 1;
      const seed = i * 2.399;
      switch (fx) {
        case 'flame': {
          const px = cx - 1.5 * k + Math.sin(u * TAU + seed) * 2.0 * k;
          const py = cy + 1.5 * k - u * 7.5 * k;
          g.globalAlpha = (1 - u) * 0.8;
          g.fillStyle = (i % 2) ? '#ffcf6a' : '#ff7a3c';
          g.beginPath(); g.arc(px, py, (1 - u) * 1.5 * k + 0.35 * k, 0, TAU); g.fill();
          break;
        }
        case 'ice': {
          const px = cx - 1 * k + Math.cos(seed) * 3.2 * k;
          const py = cy - 4 * k + u * 8 * k;
          const r = (1 - u * 0.5) * 1.1 * k;
          g.globalAlpha = (1 - u) * 0.85;
          g.fillStyle = '#d8f4ff';
          g.save(); g.translate(px, py); g.rotate(Math.PI / 4);
          g.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
          g.restore();
          break;
        }
        case 'spark': {
          const a = seed + u * 1.2;
          const px = cx + Math.cos(a * 2.7) * 4.5 * k;
          const py = cy + Math.sin(a * 3.4) * 3.5 * k;
          const tw = Math.max(0, Math.sin(u * TAU * 2 + seed));
          if (tw < 0.08) break;
          g.globalAlpha = tw * 0.95;
          g.strokeStyle = '#fff7c0'; g.lineWidth = 0.55 * k; g.lineCap = 'round';
          const r = (0.9 + tw) * 1.1 * k;
          g.beginPath();
          g.moveTo(px - r, py); g.lineTo(px + r, py);
          g.moveTo(px, py - r); g.lineTo(px, py + r);
          g.stroke();
          break;
        }
        case 'stars': {
          const a = u * TAU + seed;
          const px = cx + Math.cos(a) * 5 * k;
          const py = cy + Math.sin(a) * 3.6 * k;
          g.globalAlpha = 0.5 + 0.5 * Math.sin(u * TAU + seed);
          g.fillStyle = ['#ffffff', '#b48cff', '#7fd0ff'][i % 3];
          starPath(g, px, py, 4, 1.25 * k, 0.5 * k, a);
          g.fill();
          break;
        }
        case 'rainbow': {
          const a = u * TAU + seed;
          const px = cx + Math.cos(a) * 4.8 * k;
          const py = cy + Math.sin(a) * 3.4 * k;
          g.globalAlpha = 0.85;
          g.fillStyle = RAINBOW[(i + Math.floor(u * 6)) % 6];
          g.beginPath(); g.arc(px, py, 0.9 * k, 0, TAU); g.fill();
          break;
        }
      }
    }
    g.globalAlpha = 1;
  }


  // ------------------------------------------------------------
  // API : getWeaponCanvas — GRANDE lance horizontale (Forge)
  // Base statique en cache, surcouches animées (lueur, fx) par appel.
  // ------------------------------------------------------------
  function weaponGeom(st, size) {
    const back = -32;
    const bx = 16 + (st.len - 1) * 20;   // base de lame
    const bk = 2.6;                       // échelle de lame
    const tip = bx + 11 * bk;
    const kk = size / 100;
    return { back, bx, bk, tip, kk, mid: (back + tip) / 2, h: Math.round(size * 0.5) };
  }

  function buildWeaponBase(tier, size) {
    const key = 'wb|' + tier + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    const st = SGD.WEAPONS[tier].style;
    const geo = weaponGeom(st, size);
    cv = mk(size, geo.h);
    const g = cv.getContext('2d');
    g.translate(size / 2 - geo.mid * geo.kk, geo.h / 2);
    g.scale(geo.kk, geo.kk);
    g.lineJoin = 'round'; g.lineCap = 'round';

    const { back, bx, bk } = geo;
    const sh = st.shaftW * 0.8;   // demi-épaisseur du manche

    // ombre douce sous la lance
    g.globalAlpha = 0.18;
    g.fillStyle = '#1c2418';
    g.beginPath();
    g.ellipse((back + bx) / 2, sh + 7, (bx - back) / 2, 2.6, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;

    // --- manche : cylindre (dégradé vertical) ---
    const sg = g.createLinearGradient(0, -sh, 0, sh);
    sg.addColorStop(0, SGD.shade(st.shaftC, 0.4));
    sg.addColorStop(0.45, st.shaftC);
    sg.addColorStop(1, SGD.shade(st.shaftC, -0.45));
    g.fillStyle = sg;
    roundRectPath(g, back, -sh, bx - back + 1, sh * 2, sh);
    g.fill();

    // pommeau
    g.fillStyle = SGD.shade(st.shaftC, -0.3);
    g.beginPath(); g.ellipse(back, 0, 2.1, sh + 0.9, 0, 0, TAU); g.fill();
    g.fillStyle = SGD.shade(st.shaftC, 0.25);
    g.beginPath(); g.ellipse(back - 0.4, -0.6, 0.8, 0.5, 0, 0, TAU); g.fill();

    // poignée : bandes sombres en spirale
    g.strokeStyle = 'rgba(0,0,0,0.20)'; g.lineWidth = 1.3;
    for (let x = -11; x <= 1; x += 3) {
      g.beginPath(); g.moveTo(x, -sh + 0.2); g.lineTo(x + 2.2, sh - 0.2); g.stroke();
    }
    // reflet le long du manche
    g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(back + 4, -sh * 0.45); g.lineTo(bx - 3, -sh * 0.45); g.stroke();

    // --- lame (avec lueur baked si glow) ---
    if (st.glow) { g.shadowColor = st.glow; g.shadowBlur = size * 0.05; }
    drawBlade(g, st, bx, bk, rgba('#1c1a18', 0.3));
    g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)';

    // reflet spéculaire sur la lame
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(bx + 4.2 * bk, -1.1 * bk, 1.9 * bk, 0.55 * bk, -0.18, 0, TAU);
    g.fill();

    // --- garde ---
    if (st.guard) {
      const mc = SGD.mix(st.bladeC2, '#e8ecf2', 0.4);
      const gg = g.createLinearGradient(0, -7, 0, 7);
      gg.addColorStop(0, SGD.shade(mc, 0.35));
      gg.addColorStop(0.5, mc);
      gg.addColorStop(1, SGD.shade(mc, -0.4));
      g.fillStyle = gg;
      roundRectPath(g, bx - 2.6, -6.8, 3.4, 13.6, 1.7);
      g.fill();
      // boules aux extrémités
      g.fillStyle = SGD.shade(mc, 0.15);
      for (const s of [-1, 1]) {
        g.beginPath(); g.arc(bx - 0.9, s * 6.8, 1.5, 0, TAU); g.fill();
      }
    }

    // --- petites ailes ---
    if (st.wings) {
      g.fillStyle = 'rgba(255,255,255,0.94)';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(bx - 2, s * 4.5);
        g.quadraticCurveTo(bx - 13, s * 12, bx - 18, s * 7);
        g.quadraticCurveTo(bx - 11, s * 7.5, bx - 3.5, s * 2.4);
        g.closePath(); g.fill();
        // nervures
        g.strokeStyle = 'rgba(150,170,200,0.5)'; g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(bx - 4, s * 4); g.quadraticCurveTo(bx - 10, s * 8.5, bx - 15.5, s * 7.2);
        g.stroke();
      }
    }

    // --- gemme ---
    if (st.gem) {
      const gx = bx - 6, gr = 2.7;
      const gg2 = g.createRadialGradient(gx - 0.8, -0.8, 0.3, gx, 0, gr);
      gg2.addColorStop(0, '#ffffff');
      gg2.addColorStop(0.35, st.gem);
      gg2.addColorStop(1, SGD.shade(st.gem, -0.45));
      g.fillStyle = gg2;
      g.beginPath(); g.arc(gx, 0, gr, 0, TAU); g.fill();
      g.strokeStyle = SGD.shade(st.gem, -0.5); g.lineWidth = 0.6;
      g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(gx - 0.9, -0.9, 0.55, 0, TAU); g.fill();
    }

    cache.set(key, cv);
    return cv;
  }

  function getWeaponCanvas(tier, size, animT) {
    tier = clamp(tier | 0, 0, SGD.WEAPONS.length - 1);
    size = size || 260;
    animT = animT || 0;
    const st = SGD.WEAPONS[tier].style;
    const base = buildWeaponBase(tier, size);
    const cv = mk(base.width, base.height);
    const g = cv.getContext('2d');
    g.drawImage(base, 0, 0);

    // surcouches animées dans le même repère que la base
    const geo = weaponGeom(st, size);
    g.translate(size / 2 - geo.mid * geo.kk, geo.h / 2);
    g.scale(geo.kk, geo.kk);

    if (st.glow) {
      const a = 0.10 + 0.08 * (0.5 + 0.5 * Math.sin(animT * 3));
      const cx = geo.bx + 5 * geo.bk;
      const grad = g.createRadialGradient(cx, 0, 1, cx, 0, 15 * geo.bk);
      grad.addColorStop(0, rgba(st.glow, a));
      grad.addColorStop(1, rgba(st.glow, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, 0, 15 * geo.bk, 0, TAU); g.fill();
    }
    if (st.fx && st.fx !== 'none')
      drawFx(g, st.fx, geo.bx + 5 * geo.bk, 0, animT * 0.35, geo.bk * 0.9, 6);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getBladeCanvas — GRANDE lame une main horizontale (Forge, §2 D17)
  // Pattern getWeaponCanvas : base statique en cache, surcouches animées
  // (lueur, fx) par appel. 9 kinds distincts : knife / short / saber / wide /
  // rapier / flamberge / crescent / double / star. Repli lance si BLADES absent.
  // ------------------------------------------------------------
  function bladeGeom(st, size) {
    const back = -30;                        // pommeau
    const bx = -12;                          // garde / base de lame
    const bl = 26 + (st.len - 0.8) * 30;     // longueur de lame (t0 ≈ 26 → t39 ≈ 50)
    const kk = size / 100;
    return { back, bx, bl, tip: bx + bl, kk, mid: (back + bx + bl) / 2, h: Math.round(size * 0.5) };
  }

  // silhouette de lame une main : lame pointant +X, base en x = bx, longueur L.
  function drawOneHandBlade(g, st, bx, L, ol) {
    const grad = g.createLinearGradient(bx - 2, 0, bx + L, 0);
    grad.addColorStop(0, st.bladeC2);
    grad.addColorStop(1, st.bladeC1);
    g.fillStyle = grad;
    let fuller = false;

    switch (st.blade) {
      case 'knife': {                        // dos droit, ventre courbe, pointe tombante
        const w = 3.0;
        g.beginPath();
        g.moveTo(bx, -w * 0.62);
        g.lineTo(bx + L * 0.86, -w * 0.62);
        g.lineTo(bx + L, 0);
        g.quadraticCurveTo(bx + L * 0.5, w * 1.15, bx, w * 0.62);
        g.closePath();
        fuller = true;
        break;
      }
      case 'short': {                        // double tranchant droit, pointe nette
        const w = 3.8;
        g.beginPath();
        g.moveTo(bx, -w); g.lineTo(bx + L - 5, -w * 0.6); g.lineTo(bx + L, 0);
        g.lineTo(bx + L - 5, w * 0.6); g.lineTo(bx, w);
        g.closePath();
        fuller = true;
        break;
      }
      case 'saber': {                        // lame courbe, pointe relevée
        const w = 3.4;
        g.beginPath();
        g.moveTo(bx, -w * 0.6);
        g.quadraticCurveTo(bx + L * 0.55, -w * 1.7, bx + L, -w * 1.9);
        g.quadraticCurveTo(bx + L * 0.8, -w * 0.4, bx + L * 0.45, w * 0.5);
        g.quadraticCurveTo(bx + L * 0.2, w, bx, w * 0.8);
        g.closePath();
        break;
      }
      case 'wide': {                         // lame large, bout arrondi-pointu
        const w = 5.2;
        g.beginPath();
        g.moveTo(bx, -w);
        g.lineTo(bx + L * 0.72, -w * 0.92);
        g.quadraticCurveTo(bx + L, -w * 0.55, bx + L, 0);
        g.quadraticCurveTo(bx + L, w * 0.55, bx + L * 0.72, w * 0.92);
        g.lineTo(bx, w);
        g.closePath();
        fuller = true;
        break;
      }
      case 'rapier': {                       // aiguille fine + ricasso
        const w = 1.7;
        g.beginPath();
        g.rect(bx, -w * 1.3, 4, w * 2.6);    // ricasso
        g.moveTo(bx + 3, -w); g.lineTo(bx + L, 0); g.lineTo(bx + 3, w);
        g.closePath();
        break;
      }
      case 'flamberge': {                    // tranchants ondulés
        const w = 3.8;
        g.beginPath();
        g.moveTo(bx, -w);
        g.quadraticCurveTo(bx + L * 0.15, -w - 2.6, bx + L * 0.3, -w * 0.75);
        g.quadraticCurveTo(bx + L * 0.45, -w * 0.2, bx + L * 0.6, -w * 0.72);
        g.quadraticCurveTo(bx + L * 0.78, -w - 1.4, bx + L * 0.9, -w * 0.5);
        g.quadraticCurveTo(bx + L * 0.97, -w * 0.2, bx + L, 0);
        g.quadraticCurveTo(bx + L * 0.97, w * 0.2, bx + L * 0.9, w * 0.5);
        g.quadraticCurveTo(bx + L * 0.78, w + 1.4, bx + L * 0.6, w * 0.72);
        g.quadraticCurveTo(bx + L * 0.45, w * 0.2, bx + L * 0.3, w * 0.75);
        g.quadraticCurveTo(bx + L * 0.15, w + 2.6, bx, w);
        g.closePath();
        break;
      }
      case 'crescent': {                     // croc en croissant de lune
        const cx = bx + L * 0.42, R = L * 0.58;
        g.beginPath();
        g.arc(cx, 0, R, -1.55, 1.55);
        g.arc(cx - R * 0.35, 0, R * 0.82, 1.45, -1.45, true);
        g.closePath();
        break;
      }
      case 'double': {                       // deux lames jumelles + pont
        g.beginPath();
        g.rect(bx - 0.5, -5, 2.6, 10);
        for (const s of [-1, 1]) {
          g.moveTo(bx + 1, s * 4.6);
          g.lineTo(bx + L - 5, s * 3.0);
          g.lineTo(bx + L, s * 1.4);
          g.lineTo(bx + L - 6, s * 1.2);
          g.lineTo(bx + 1, s * 1.4);
          g.closePath();
        }
        break;
      }
      case 'star': {                         // lame courte + étoile en pointe
        g.beginPath();
        g.moveTo(bx, -2.2); g.lineTo(bx + L - 6, -1.4);
        g.lineTo(bx + L - 6, 1.4); g.lineTo(bx, 2.2);
        g.closePath();
        g.fill();
        if (ol) { g.strokeStyle = ol; g.lineWidth = 0.7; g.lineJoin = 'round'; g.stroke(); }
        g.fillStyle = grad;
        starPath(g, bx + L - 4, 0, 5, 6.4, 2.6, 0);
        break;
      }
      default: {                             // repli : lame courte
        const w = 3.8;
        g.beginPath();
        g.moveTo(bx, -w); g.lineTo(bx + L, 0); g.lineTo(bx, w);
        g.closePath();
      }
    }
    g.fill();
    if (ol) {
      g.strokeStyle = ol; g.lineWidth = 0.7; g.lineJoin = 'round';
      g.stroke();
    }
    // gorge centrale (fuller) sur les lames droites
    if (fuller) {
      g.strokeStyle = rgba(st.bladeC2, 0.55); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(bx + 2, 0); g.lineTo(bx + L * 0.72, 0); g.stroke();
    }
    // étincelle centrale pour l'étoile
    if (st.blade === 'star') {
      g.fillStyle = rgba('#ffffff', 0.55);
      g.beginPath(); g.arc(bx + L - 4, 0, 1.2, 0, TAU); g.fill();
    }
  }

  function buildBladeBase(tier, size) {
    const key = 'blb|' + tier + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    const st = SGD.BLADES[tier].style;
    const geo = bladeGeom(st, size);
    cv = mk(size, geo.h);
    const g = cv.getContext('2d');
    g.translate(size / 2 - geo.mid * geo.kk, geo.h / 2);
    g.scale(geo.kk, geo.kk);
    g.lineJoin = 'round'; g.lineCap = 'round';

    const { back, bx, bl } = geo;
    const gh = st.gripW * 0.9;   // demi-épaisseur de la poignée

    // ombre douce sous la lame
    g.globalAlpha = 0.18;
    g.fillStyle = '#1c2418';
    g.beginPath();
    g.ellipse((back + geo.tip) / 2, gh + 7, (geo.tip - back) / 2, 2.6, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;

    // --- poignée : cylindre court (dégradé vertical) ---
    const sg = g.createLinearGradient(0, -gh, 0, gh);
    sg.addColorStop(0, SGD.shade(st.gripC, 0.4));
    sg.addColorStop(0.45, st.gripC);
    sg.addColorStop(1, SGD.shade(st.gripC, -0.45));
    g.fillStyle = sg;
    roundRectPath(g, back + 2, -gh, bx - back - 1, gh * 2, gh);
    g.fill();

    // pommeau
    g.fillStyle = SGD.shade(st.gripC, -0.3);
    g.beginPath(); g.ellipse(back + 2, 0, 2.2, gh + 1.0, 0, 0, TAU); g.fill();
    g.fillStyle = SGD.shade(st.gripC, 0.25);
    g.beginPath(); g.ellipse(back + 1.6, -0.6, 0.8, 0.5, 0, 0, TAU); g.fill();

    // gainage : bandes sombres en spirale
    g.strokeStyle = 'rgba(0,0,0,0.20)'; g.lineWidth = 1.3;
    for (let x = back + 5; x <= bx - 4; x += 3) {
      g.beginPath(); g.moveTo(x, -gh + 0.2); g.lineTo(x + 2.2, gh - 0.2); g.stroke();
    }
    // reflet le long de la poignée
    g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(back + 5, -gh * 0.45); g.lineTo(bx - 3, -gh * 0.45); g.stroke();

    // --- lame (lueur baked si glow) ---
    if (st.glow) { g.shadowColor = st.glow; g.shadowBlur = size * 0.05; }
    drawOneHandBlade(g, st, bx, bl, rgba('#1c1a18', 0.3));
    g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)';

    // reflet spéculaire sur la lame
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(bx + bl * 0.4, -1.2, bl * 0.16, 1.1, -0.12, 0, TAU);
    g.fill();

    // --- garde : coquille pour la rapière, quillons pour le reste ---
    if (st.guard) {
      const mc = SGD.mix(st.bladeC2, '#e8ecf2', 0.4);
      if (st.blade === 'rapier') {
        g.strokeStyle = mc; g.lineWidth = 1.6;
        g.beginPath(); g.arc(bx - 1, 0, 4.6, Math.PI * 0.5, Math.PI * 1.5, true); g.stroke();
        g.fillStyle = SGD.shade(mc, 0.15);
        for (const s of [-1, 1]) { g.beginPath(); g.arc(bx - 1, s * 4.6, 1.2, 0, TAU); g.fill(); }
      } else {
        const gg = g.createLinearGradient(0, -6.4, 0, 6.4);
        gg.addColorStop(0, SGD.shade(mc, 0.35));
        gg.addColorStop(0.5, mc);
        gg.addColorStop(1, SGD.shade(mc, -0.4));
        g.fillStyle = gg;
        roundRectPath(g, bx - 2.4, -6.2, 3.2, 12.4, 1.6);
        g.fill();
        g.fillStyle = SGD.shade(mc, 0.15);
        for (const s of [-1, 1]) {
          g.beginPath(); g.arc(bx - 0.8, s * 6.2, 1.4, 0, TAU); g.fill();
        }
      }
    }

    // --- petites ailes ---
    if (st.wings) {
      g.fillStyle = 'rgba(255,255,255,0.94)';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(bx - 2, s * 4.2);
        g.quadraticCurveTo(bx - 12, s * 11, bx - 16.5, s * 6.4);
        g.quadraticCurveTo(bx - 10, s * 7, bx - 3.5, s * 2.2);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(150,170,200,0.5)'; g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(bx - 4, s * 3.8); g.quadraticCurveTo(bx - 9.5, s * 7.8, bx - 14.5, s * 6.6);
        g.stroke();
      }
    }

    // --- gemme au talon de lame ---
    if (st.gem) {
      const gx = bx - 5.5, gr = 2.5;
      const gg2 = g.createRadialGradient(gx - 0.8, -0.8, 0.3, gx, 0, gr);
      gg2.addColorStop(0, '#ffffff');
      gg2.addColorStop(0.35, st.gem);
      gg2.addColorStop(1, SGD.shade(st.gem, -0.45));
      g.fillStyle = gg2;
      g.beginPath(); g.arc(gx, 0, gr, 0, TAU); g.fill();
      g.strokeStyle = SGD.shade(st.gem, -0.5); g.lineWidth = 0.6;
      g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(gx - 0.9, -0.9, 0.5, 0, TAU); g.fill();
    }

    cache.set(key, cv);
    return cv;
  }

  function getBladeCanvas(tier, size, animT) {
    if (!SGD.BLADES || !SGD.BLADES.length) return getWeaponCanvas(tier, size, animT); // garde-fou
    tier = clamp(tier | 0, 0, SGD.BLADES.length - 1);
    size = size || 260;
    animT = animT || 0;
    const st = SGD.BLADES[tier].style;
    const base = buildBladeBase(tier, size);
    const cv = mk(base.width, base.height);
    const g = cv.getContext('2d');
    g.drawImage(base, 0, 0);

    // surcouches animées dans le même repère que la base
    const geo = bladeGeom(st, size);
    g.translate(size / 2 - geo.mid * geo.kk, geo.h / 2);
    g.scale(geo.kk, geo.kk);

    const cx = geo.bx + geo.bl * 0.6;
    if (st.glow) {
      const a = 0.10 + 0.08 * (0.5 + 0.5 * Math.sin(animT * 3));
      const grad = g.createRadialGradient(cx, 0, 1, cx, 0, geo.bl * 0.75);
      grad.addColorStop(0, rgba(st.glow, a));
      grad.addColorStop(1, rgba(st.glow, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, 0, geo.bl * 0.75, 0, TAU); g.fill();
    }
    if (st.fx && st.fx !== 'none')
      drawFx(g, st.fx, cx, 0, animT * 0.35, 2, 6);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getRangedCanvas — GRANDE arme de tir horizontale (Forge),
  // même recette que getWeaponCanvas : base statique en cache,
  // lueur + particules animées par appel. Repli lance si RANGED absent.
  // ------------------------------------------------------------
  function buildRangedBase(tier, size) {
    const key = 'rb|' + tier + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    const st = SGD.RANGED[tier].style;
    const k = clamp(st.size || 1, .7, 1.6);
    const h = Math.round(size * 0.5);
    cv = mk(size, h);
    const g = cv.getContext('2d');
    g.translate(size / 2, h / 2);
    g.scale(size / 100, size / 100);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const armC = st.armC || '#8a6a44', gripC = st.gripC || '#5c4a38',
          strC = st.stringC || '#e8e2d2', tipC = st.tipC || '#c9cdd2';

    // ombre douce au sol
    g.globalAlpha = .18; g.fillStyle = '#1c2418';
    g.beginPath(); g.ellipse(0, 16, 33, 3.1, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
    if (st.glow) { g.shadowColor = st.glow; g.shadowBlur = size * .04; }

    if (st.kind === 'bow') {
      const L = 25 * k;
      // corde tendue
      g.strokeStyle = strC; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-8, -L); g.lineTo(-8, L); g.stroke();
      // branche laminée (deux passes)
      const bg = g.createLinearGradient(-8, 0, 18, 0);
      bg.addColorStop(0, SGD.shade(armC, -.28)); bg.addColorStop(1, SGD.shade(armC, .18));
      g.strokeStyle = bg; g.lineWidth = 4.4;
      g.beginPath(); g.moveTo(-8, -L); g.quadraticCurveTo(14 + 6 * k, 0, -8, L); g.stroke();
      g.strokeStyle = SGD.shade(armC, .4); g.lineWidth = 1.1; g.globalAlpha = .8;
      g.beginPath(); g.moveTo(-7.4, -L + 3); g.quadraticCurveTo(13 + 6 * k, 0, -7.4, L - 3); g.stroke();
      g.globalAlpha = 1;
      // embouts d'encoche
      g.fillStyle = tipC;
      for (const s of [-1, 1]) { g.beginPath(); g.arc(-8, s * L, 2, 0, TAU); g.fill(); }
      // poignée gainée
      const gx = 2 + 3 * k;
      g.strokeStyle = gripC; g.lineWidth = 6.6;
      g.beginPath(); g.moveTo(gx, -6.5); g.lineTo(gx, 6.5); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
      for (const dy of [-4, -1.3, 1.4, 4.1]) { g.beginPath(); g.moveTo(gx - 3, dy); g.lineTo(gx + 3, dy + 1); g.stroke(); }
      // flèche encochée
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.1;
      g.beginPath(); g.moveTo(-27, 0); g.lineTo(29 * k, 0); g.stroke();
      g.fillStyle = tipC;
      g.beginPath(); g.moveTo(37 * k, 0); g.lineTo(27.5 * k, -4.3); g.lineTo(27.5 * k, 4.3); g.closePath(); g.fill();
      g.fillStyle = strC;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(-27, 0); g.lineTo(-33, s * 5); g.lineTo(-22, s * 1.6); g.closePath(); g.fill();
      }

    } else if (st.kind === 'crossbow') {
      // arcs d'acier repliés vers l'arrière
      g.strokeStyle = armC; g.lineWidth = 4.2;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(14, s * 2.5); g.quadraticCurveTo(2, s * 18 * k, -10, s * 22 * k); g.stroke();
      }
      g.fillStyle = tipC;
      for (const s of [-1, 1]) { g.beginPath(); g.arc(-10, s * 22 * k, 1.9, 0, TAU); g.fill(); }
      // corde armée jusqu'à la noix
      g.strokeStyle = strC; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-10, -22 * k); g.lineTo(-16, 0); g.lineTo(-10, 22 * k); g.stroke();
      // fût : bois massif
      const sg = g.createLinearGradient(0, -3.6, 0, 3.6);
      sg.addColorStop(0, SGD.shade(gripC, .35)); sg.addColorStop(.5, gripC); sg.addColorStop(1, SGD.shade(gripC, -.4));
      g.fillStyle = sg;
      roundRectPath(g, -30, -3.6, 54, 7.2, 3.4); g.fill();
      // étrier avant
      g.strokeStyle = SGD.shade(armC, -.2); g.lineWidth = 2.4;
      g.beginPath(); g.arc(28, 0, 5, -Math.PI / 2, Math.PI / 2); g.stroke();
      // noix + détente
      g.fillStyle = SGD.shade(gripC, -.45);
      g.beginPath(); g.arc(-16, 0, 2.4, 0, TAU); g.fill();
      roundRectPath(g, -20, 3.4, 3, 6, 1.4); g.fill();
      // carreau
      g.strokeStyle = '#6e5434'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(30 * k, 0); g.stroke();
      g.fillStyle = tipC;
      g.beginPath(); g.moveTo(37 * k, 0); g.lineTo(28.5 * k, -3.8); g.lineTo(28.5 * k, 3.8); g.closePath(); g.fill();

    } else if (st.kind === 'launcher') {
      // tube épais
      const tg = g.createLinearGradient(0, -8.5, 0, 8.5);
      tg.addColorStop(0, SGD.shade(armC, .4)); tg.addColorStop(.45, armC); tg.addColorStop(1, SGD.shade(armC, -.45));
      g.fillStyle = tg;
      roundRectPath(g, -28, -8.5, 56, 17, 7); g.fill();
      // frettes
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.6;
      for (const x of [-16, -2, 12]) { g.beginPath(); g.moveTo(x, -8); g.lineTo(x, 8); g.stroke(); }
      // bouche évasée
      g.fillStyle = SGD.shade(armC, -.4);
      g.beginPath(); g.ellipse(28, 0, 5, 10, 0, 0, TAU); g.fill();
      g.fillStyle = tipC;
      g.beginPath(); g.ellipse(28, 0, 3, 7.4, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(20,16,12,.8)';
      g.beginPath(); g.ellipse(28.6, 0, 1.7, 5.4, 0, 0, TAU); g.fill();
      // évent arrière
      g.fillStyle = SGD.shade(armC, -.3);
      g.beginPath(); g.moveTo(-28, -6); g.lineTo(-35, -3.4); g.lineTo(-35, 3.4); g.lineTo(-28, 6); g.closePath(); g.fill();
      // poignées + viseur
      g.fillStyle = gripC;
      roundRectPath(g, -8, 8, 5.5, 7, 2.2); g.fill();
      roundRectPath(g, 6, 8, 5.5, 7, 2.2); g.fill();
      g.strokeStyle = strC; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-4, -8.5); g.lineTo(-4, -13.5); g.lineTo(4, -13.5); g.stroke();
      // reflet du tube
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-24, -5.4); g.lineTo(24, -5.4); g.stroke();

    } else {
      // fronde : manche, lanières, pochette chargée
      const sg2 = g.createLinearGradient(0, -2.6, 0, 2.6);
      sg2.addColorStop(0, SGD.shade(gripC, .35)); sg2.addColorStop(.5, gripC); sg2.addColorStop(1, SGD.shade(gripC, -.4));
      g.fillStyle = sg2;
      roundRectPath(g, -32, -2.6, 30, 5.2, 2.5); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.2;
      for (const x of [-28, -24, -20]) { g.beginPath(); g.moveTo(x, -2.2); g.lineTo(x + 2, 2.2); g.stroke(); }
      // fourche + lanières jusqu'à la pochette
      g.strokeStyle = strC; g.lineWidth = 1.6;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(-3, 0);
        g.quadraticCurveTo(8, s * (10 + 4 * k), 18, s * 4.5);
        g.stroke();
      }
      // pochette de cuir
      const pg = g.createRadialGradient(19, -2, 1, 20, 0, 9);
      pg.addColorStop(0, SGD.shade(armC, .3)); pg.addColorStop(1, SGD.shade(armC, -.3));
      g.fillStyle = pg;
      g.beginPath(); g.ellipse(20, 0, 8.5 * k, 6.2 * k, .12, 0, TAU); g.fill();
      g.strokeStyle = SGD.shade(armC, -.45); g.lineWidth = 1; g.globalAlpha = .7; g.stroke(); g.globalAlpha = 1;
      // couture
      g.strokeStyle = SGD.shade(armC, -.4); g.lineWidth = .8;
      g.beginPath(); g.ellipse(20, 0, 6.4 * k, 4.4 * k, .12, 0, TAU); g.stroke();
      // munition
      const mg = g.createRadialGradient(18.6, -1.6, .5, 20, 0, 4.4 * k);
      mg.addColorStop(0, SGD.shade(tipC, .35)); mg.addColorStop(1, SGD.shade(tipC, -.35));
      g.fillStyle = mg;
      g.beginPath(); g.arc(20, 0, 4.2 * k, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.beginPath(); g.arc(18.8, -1.4, 1, 0, TAU); g.fill();
    }

    g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)';
    cache.set(key, cv);
    return cv;
  }

  function getRangedCanvas(tier, size, animT) {
    size = size || 260;
    animT = animT || 0;
    if (!SGD.RANGED || !SGD.RANGED.length) return getWeaponCanvas(tier, size, animT); // garde-fou
    tier = clamp(tier | 0, 0, SGD.RANGED.length - 1);
    const st = SGD.RANGED[tier].style;
    const base = buildRangedBase(tier, size);
    const cv = mk(base.width, base.height);
    const g = cv.getContext('2d');
    g.drawImage(base, 0, 0);
    g.translate(size / 2, base.height / 2);
    g.scale(size / 100, size / 100);
    const fxX = st.kind === 'sling' ? 20 : st.kind === 'launcher' ? 28 : 30;
    if (st.glow) {
      const a = 0.10 + 0.08 * (0.5 + 0.5 * Math.sin(animT * 3));
      const grad = g.createRadialGradient(fxX, 0, 1, fxX, 0, 26);
      grad.addColorStop(0, rgba(st.glow, a));
      grad.addColorStop(1, rgba(st.glow, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(fxX, 0, 26, 0, TAU); g.fill();
    }
    if (st.fx && st.fx !== 'none') drawFx(g, st.fx, fxX, 0, animT * 0.35, 2.2, 6);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getStaffCanvas — GRAND bâton/baguette horizontal (Forge)
  // ------------------------------------------------------------
  function staffGeom(st) {
    const k = clamp(st.size || 1, .7, 1.6);
    const wand = st.kind === 'wand';
    return {
      k,
      orbX: wand ? 22 : st.kind === 'scepter' ? 21 : 26,
      orbR: (wand ? 5.5 : 8) * k,
      backX: wand ? -24 : -33,
    };
  }

  function buildStaffBase(tier, size) {
    const key = 'sb|' + tier + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    const st = SGD.STAFFS[tier].style;
    const geo = staffGeom(st);
    const h = Math.round(size * 0.5);
    cv = mk(size, h);
    const g = cv.getContext('2d');
    g.translate(size / 2, h / 2);
    g.scale(size / 100, size / 100);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const shaftC = st.shaftC || '#6e5434', orb1 = st.orbC1 || '#c8f4ff', orb2 = st.orbC2 || '#3a86ff';
    const wand = st.kind === 'wand', scep = st.kind === 'scepter';

    // ombre douce
    g.globalAlpha = .18; g.fillStyle = '#1c2418';
    g.beginPath(); g.ellipse(0, 16, 32, 3, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;

    // manche : cylindre en dégradé, effilé pour la baguette
    const sw = wand ? 2.2 : 3.8;
    const sg = g.createLinearGradient(0, -sw, 0, sw);
    sg.addColorStop(0, SGD.shade(shaftC, .4));
    sg.addColorStop(.45, shaftC);
    sg.addColorStop(1, SGD.shade(shaftC, -.45));
    if (wand) {
      const pts = [];
      for (let i = 0; i <= 5; i++) pts.push([geo.backX + (geo.orbX - 4 - geo.backX) * (i / 5), 0]);
      taperedStroke(g, pts, 2.2, 4.4, shaftC);
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(geo.backX + 3, -1); g.lineTo(geo.orbX - 8, -1.4); g.stroke();
    } else {
      g.fillStyle = sg;
      roundRectPath(g, geo.backX, -sw, geo.orbX - 2 - geo.backX, sw * 2, sw); g.fill();
      // pommeau + poignée gainée
      g.fillStyle = SGD.shade(shaftC, -.3);
      g.beginPath(); g.ellipse(geo.backX, 0, 2.2, sw + 1, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.3;
      for (let x = -12; x <= 0; x += 3.2) { g.beginPath(); g.moveTo(x, -sw + .3); g.lineTo(x + 2.2, sw - .3); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(geo.backX + 4, -sw * .45); g.lineTo(geo.orbX - 6, -sw * .45); g.stroke();
    }
    // virole sous l'orbe
    g.strokeStyle = scep ? '#f4c542' : SGD.shade(shaftC, .35); g.lineWidth = wand ? 1.4 : 2;
    g.beginPath(); g.moveTo(geo.orbX - geo.orbR - 3, -sw - 1); g.lineTo(geo.orbX - geo.orbR - 3, sw + 1); g.stroke();

    // orbe (lueur baked si glow)
    if (st.glow) { g.shadowColor = st.glow; g.shadowBlur = size * .05; }
    const og = g.createRadialGradient(geo.orbX - geo.orbR * .38, -geo.orbR * .38, .8, geo.orbX, 0, geo.orbR);
    og.addColorStop(0, SGD.shade(orb1, .25));
    og.addColorStop(.55, orb1);
    og.addColorStop(1, orb2);
    g.fillStyle = og;
    g.beginPath(); g.arc(geo.orbX, 0, geo.orbR, 0, TAU); g.fill();
    g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)';
    g.strokeStyle = rgba(orb2, .8); g.lineWidth = .9; g.globalAlpha = .7; g.stroke(); g.globalAlpha = 1;
    // reflet spéculaire
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath(); g.ellipse(geo.orbX - geo.orbR * .4, -geo.orbR * .42, geo.orbR * .3, geo.orbR * .18, -.5, 0, TAU); g.fill();

    if (scep) {
      // griffes dorées qui enserrent l'orbe + joyau de base
      g.strokeStyle = '#f4c542'; g.lineWidth = 2;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(geo.orbX - geo.orbR - 2.5, s * 2);
        g.quadraticCurveTo(geo.orbX, s * (geo.orbR + 3.4), geo.orbX + geo.orbR * .62, s * geo.orbR * .72);
        g.stroke();
      }
      g.fillStyle = '#f4c542';
      starPath(g, geo.orbX - geo.orbR - 5.5, 0, 4, 3, 1.3, Math.PI / 4); g.fill();
    }
    cache.set(key, cv);
    return cv;
  }

  function getStaffCanvas(tier, size, animT) {
    size = size || 260;
    animT = animT || 0;
    if (!SGD.STAFFS || !SGD.STAFFS.length) return getWeaponCanvas(tier, size, animT); // garde-fou
    tier = clamp(tier | 0, 0, SGD.STAFFS.length - 1);
    const st = SGD.STAFFS[tier].style;
    const geo = staffGeom(st);
    const base = buildStaffBase(tier, size);
    const cv = mk(base.width, base.height);
    const g = cv.getContext('2d');
    g.drawImage(base, 0, 0);
    g.translate(size / 2, base.height / 2);
    g.scale(size / 100, size / 100);
    if (st.glow) {
      const a = 0.12 + 0.09 * (0.5 + 0.5 * Math.sin(animT * 3));
      const grad = g.createRadialGradient(geo.orbX, 0, 1, geo.orbX, 0, geo.orbR * 3.2);
      grad.addColorStop(0, rgba(st.glow, a));
      grad.addColorStop(1, rgba(st.glow, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(geo.orbX, 0, geo.orbR * 3.2, 0, TAU); g.fill();
    }
    if (st.crystals) {
      // éclats de cristal en orbite lente autour de l'orbe
      g.fillStyle = st.orbC1 || '#c8f4ff';
      for (let i = 0; i < 4; i++) {
        const a = animT * 1.4 + i * TAU / 4;
        const cx = geo.orbX + Math.cos(a) * (geo.orbR + 5.5);
        const cy = Math.sin(a) * (geo.orbR + 5.5) * .62;
        g.save(); g.translate(cx, cy); g.rotate(a);
        g.globalAlpha = .9;
        g.fillRect(-1.6, -1.6, 3.2, 3.2);
        g.restore();
      }
      g.globalAlpha = 1;
    }
    if (st.fx && st.fx !== 'none') drawFx(g, st.fx, geo.orbX, 0, animT * 0.35, 2, 6);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getOrdnanceCanvas — GROSSE pièce d'ordonnance (Forge, §9) :
  // bombe / mortier / lance-bombes, base statique en cache, lueur,
  // mèche qui crépite et particules animées par appel.
  // ------------------------------------------------------------
  function ordGeom(st) {
    const k = clamp(st.size || 1, .7, 1.6);
    if (st.kind === 'mortar') return { k, fxX: 24, fxY: -14 };
    if (st.kind === 'launcher') return { k, fxX: 30, fxY: 0 };
    return { k, fxX: 5 + 7 * k, fxY: -(11 * k + 6) };   // bout de mèche
  }

  function buildOrdnanceBase(tier, size) {
    const key = 'ord|' + tier + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    const st = SGD.ORDNANCE[tier].style;
    const geo = ordGeom(st), k = geo.k;
    const h = Math.round(size * 0.5);
    cv = mk(size, h);
    const g = cv.getContext('2d');
    g.translate(size / 2, h / 2);
    g.scale(size / 100, size / 100);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const bodyC = st.bodyC || '#5c4a38', bandC = st.bandC || '#3e3226', fuseC = st.fuseC || '#d8c8a8';

    // ombre douce au sol
    g.globalAlpha = .18; g.fillStyle = '#1c2418';
    g.beginPath(); g.ellipse(0, 18, 30, 3, 0, 0, TAU); g.fill();
    g.globalAlpha = 1;
    if (st.glow) { g.shadowColor = st.glow; g.shadowBlur = size * .04; }

    if (st.kind === 'mortar') {
      // bipied
      g.strokeStyle = SGD.shade(bandC, -.1); g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(6, -2); g.lineTo(16, 17); g.stroke();
      g.beginPath(); g.moveTo(2, 0); g.lineTo(-6, 17); g.stroke();
      // plaque de base
      g.fillStyle = SGD.shade(bodyC, -.35);
      g.beginPath(); g.ellipse(-16, 15, 10, 4, .3, 0, TAU); g.fill();
      // tube incliné, gueule au ciel
      g.save(); g.translate(-14, 12); g.rotate(-.62);
      const L = 34 + 8 * k;
      const tg = g.createLinearGradient(0, -6.5 * k, 0, 6.5 * k);
      tg.addColorStop(0, SGD.shade(bodyC, .38)); tg.addColorStop(.5, bodyC); tg.addColorStop(1, SGD.shade(bodyC, -.4));
      g.fillStyle = tg; roundRectPath(g, -4, -6.2 * k, L, 12.4 * k, 5 * k); g.fill();
      g.strokeStyle = bandC; g.lineWidth = 1.8;
      for (const x of [4, 14, 24]) { g.beginPath(); g.moveTo(x, -6 * k); g.lineTo(x, 6 * k); g.stroke(); }
      g.fillStyle = SGD.shade(bodyC, -.42);
      g.beginPath(); g.ellipse(L - 4, 0, 3.4 * k, 6.8 * k, 0, 0, TAU); g.fill();
      g.fillStyle = fuseC;
      g.beginPath(); g.ellipse(L - 4, 0, 2 * k, 5 * k, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(20,16,12,.85)';
      g.beginPath(); g.ellipse(L - 3.6, 0, 1.2 * k, 3.6 * k, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(0, -4.2 * k); g.lineTo(L - 9, -4.2 * k); g.stroke();
      g.restore();
      // obus prêt à servir, posé là comme un argument
      g.fillStyle = SGD.shade(fuseC, -.08);
      roundRectPath(g, 17, 10, 12, 5, 2.4); g.fill();
      g.fillStyle = '#a03c2c'; g.beginPath(); g.arc(30, 12.5, 2.5, 0, TAU); g.fill();

    } else if (st.kind === 'launcher') {
      // tube long à bouche évasée, ailerons arrière
      const tg = g.createLinearGradient(0, -8 * k, 0, 8 * k);
      tg.addColorStop(0, SGD.shade(bodyC, .4)); tg.addColorStop(.45, bodyC); tg.addColorStop(1, SGD.shade(bodyC, -.45));
      g.fillStyle = tg;
      roundRectPath(g, -28, -8 * k, 54, 16 * k, 6 * k); g.fill();
      g.strokeStyle = bandC; g.lineWidth = 1.8;
      for (const x of [-16, -2, 12]) { g.beginPath(); g.moveTo(x, -7.6 * k); g.lineTo(x, 7.6 * k); g.stroke(); }
      g.fillStyle = SGD.shade(bodyC, -.4);
      g.beginPath(); g.ellipse(27, 0, 5, 9.6 * k, 0, 0, TAU); g.fill();
      g.fillStyle = fuseC;
      g.beginPath(); g.ellipse(27, 0, 3, 7 * k, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(20,16,12,.8)';
      g.beginPath(); g.ellipse(27.6, 0, 1.7, 5.2 * k, 0, 0, TAU); g.fill();
      // ailerons
      g.fillStyle = SGD.shade(bandC, .12);
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(-28, s * 5 * k); g.lineTo(-35, s * 9 * k); g.lineTo(-35, s * 2 * k); g.closePath(); g.fill();
      }
      // poignées + viseur
      g.fillStyle = SGD.shade(bandC, -.15);
      roundRectPath(g, -8, 8 * k - 1, 5.5, 7, 2.2); g.fill();
      roundRectPath(g, 6, 8 * k - 1, 5.5, 7, 2.2); g.fill();
      g.strokeStyle = fuseC; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-4, -8 * k); g.lineTo(-4, -8 * k - 5); g.lineTo(4, -8 * k - 5); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-24, -5.2 * k); g.lineTo(22, -5.2 * k); g.stroke();

    } else {
      // bombe sphérique, cerclage, collerette et mèche
      const R = 14 * k;
      const bg = g.createRadialGradient(-R * .35, 2 - R * .35, 1, 0, 2, R);
      bg.addColorStop(0, SGD.shade(bodyC, .45)); bg.addColorStop(.55, bodyC); bg.addColorStop(1, SGD.shade(bodyC, -.42));
      g.fillStyle = bg; g.beginPath(); g.arc(0, 2, R, 0, TAU); g.fill();
      g.strokeStyle = bandC; g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(0, 2, R * .35, R * .95, 0, 0, TAU); g.stroke();
      g.strokeStyle = SGD.shade(bandC, -.2); g.lineWidth = 1.1; g.globalAlpha = .7;
      g.beginPath(); g.arc(0, 2, R, 0, TAU); g.stroke(); g.globalAlpha = 1;
      // collerette de mèche
      g.fillStyle = SGD.shade(bandC, -.2);
      roundRectPath(g, -3.5, 2 - R - 4.5, 7, 5.5, 1.6); g.fill();
      // mèche
      g.strokeStyle = fuseC; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 2 - R - 3);
      g.quadraticCurveTo(3 * k, 2 - R - 8, geo.fxX, geo.fxY); g.stroke();
      // reflet spéculaire
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.ellipse(-R * .4, 2 - R * .45, R * .3, R * .16, -.5, 0, TAU); g.fill();
    }

    g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)';
    cache.set(key, cv);
    return cv;
  }

  function getOrdnanceCanvas(tier, size, animT) {
    size = size || 260;
    animT = animT || 0;
    if (!SGD.ORDNANCE || !SGD.ORDNANCE.length) return getWeaponCanvas(tier, size, animT); // garde-fou
    tier = clamp(tier | 0, 0, SGD.ORDNANCE.length - 1);
    const st = SGD.ORDNANCE[tier].style;
    const geo = ordGeom(st);
    const base = buildOrdnanceBase(tier, size);
    const cv = mk(base.width, base.height);
    const g = cv.getContext('2d');
    g.drawImage(base, 0, 0);
    g.translate(size / 2, base.height / 2);
    g.scale(size / 100, size / 100);
    if (st.glow) {
      const a = 0.10 + 0.08 * (0.5 + 0.5 * Math.sin(animT * 3));
      const grad = g.createRadialGradient(geo.fxX, geo.fxY, 1, geo.fxX, geo.fxY, 26);
      grad.addColorStop(0, rgba(st.glow, a));
      grad.addColorStop(1, rgba(st.glow, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(geo.fxX, geo.fxY, 26, 0, TAU); g.fill();
    }
    // les bombes crépitent en continu : c'est contractuel
    if (st.kind !== 'mortar' && st.kind !== 'launcher') {
      g.fillStyle = Math.sin(animT * 8) > 0 ? '#ffdf6a' : '#ff8a3a';
      starPath(g, geo.fxX, geo.fxY, 4, 3 + Math.sin(animT * 6), 1.2, animT); g.fill();
    }
    if (st.fx && st.fx !== 'none') drawFx(g, st.fx, geo.fxX, geo.fxY, animT * 0.35, 2, 6);
    return cv;
  }


