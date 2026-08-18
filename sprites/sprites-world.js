/* ============================================================
   GRIFFES & PLUMES — sprites-world.js (6/9)
   Obstacles, décors, terrain, avant-poste — dépend de
   sprites-buildings.js (getNodeRef -> getNodeCanvas).
   ============================================================ */
"use strict";

  // ------------------------------------------------------------
  // RNG déterministe (obstacles, nids, parchemins)
  // ------------------------------------------------------------
  function mulberry(seed) {
    let a = (seed | 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------
  // API : getObstacleCanvas — mare ou rocher (~120 px, transparent,
  // ombre douce intégrée), déterministe par seed.
  // ------------------------------------------------------------
  function getObstacleCanvas(kind, seed) {
    kind = kind === 'water' ? 'water' : 'rock';
    const key = 'ob|' + kind + '|' + ((seed | 0) || 1);
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(120, 120);
    const g = cv.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const rn = mulberry((seed | 0) || 1);

    if (kind === 'water') {
      softShadow(g, 60, 66, 52, 22, .18);
      // berge sablonneuse
      g.fillStyle = '#cfc39a';
      g.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU;
        const px = 60 + Math.cos(a) * (44 + rn() * 10), py = 60 + Math.sin(a) * (33 + rn() * 8);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
      // eau
      const wgd = g.createRadialGradient(50, 50, 4, 60, 60, 46);
      wgd.addColorStop(0, '#8fd0e8'); wgd.addColorStop(1, '#3f88ae');
      g.fillStyle = wgd;
      g.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * TAU;
        const px = 60 + Math.cos(a) * (37 + rn() * 8), py = 60 + Math.sin(a) * (27 + rn() * 7);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
      // reflets
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.6;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(60 + (rn() - .5) * 40, 60 + (rn() - .5) * 26, 5 + rn() * 8, Math.PI * 1.05, Math.PI * 1.9);
        g.stroke();
      }
      // nénuphar
      const lx = 60 + (rn() - .5) * 30, ly = 60 + (rn() - .5) * 18;
      g.fillStyle = '#5da05a';
      g.beginPath(); g.ellipse(lx, ly, 7, 5, rn() * 2, 0, TAU); g.fill();
      g.fillStyle = '#3f88ae';
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 8, ly - 3); g.lineTo(lx + 8, ly + 2); g.closePath(); g.fill();
      // roseaux sur la berge
      for (let i = 0; i < 3; i++) {
        const a = rn() * TAU;
        const bx = 60 + Math.cos(a) * 41, by = 60 + Math.sin(a) * 30;
        const dx = (rn() - .5) * 6, dh = 12 + rn() * 6;
        taperedStroke(g, [[bx, by], [bx + dx, by - dh]], 2, .8, '#6b8f4e');
        g.fillStyle = '#8a6a3c';
        g.beginPath(); g.ellipse(bx + dx, by - dh - 3, 1.6, 4, 0, 0, TAU); g.fill();
      }
    } else {
      softShadow(g, 60, 82, 44, 16, .25);
      // 3 blocs de granit
      const blocks = [[60, 60, 33, 25], [37 + rn() * 8, 74, 18, 13], [84 - rn() * 6, 76, 15, 11]];
      for (const b of blocks) {
        const rg = g.createLinearGradient(b[0] - b[2], b[1] - b[3], b[0] + b[2], b[1] + b[3]);
        rg.addColorStop(0, '#b2aea2'); rg.addColorStop(1, '#6e6a60');
        g.fillStyle = rg;
        g.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = i / 8 * TAU + .3;
          const rr = .78 + rn() * .3;
          const px = b[0] + Math.cos(a) * b[2] * rr, py = b[1] + Math.sin(a) * b[3] * rr - b[3] * .2;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.fill();
      }
      // fissures
      g.strokeStyle = 'rgba(30,28,24,.3)'; g.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const x = 42 + rn() * 36, y = 44 + rn() * 24;
        g.beginPath();
        g.moveTo(x, y); g.lineTo(x - 3 + rn() * 6, y + 8 + rn() * 6); g.lineTo(x - 4 + rn() * 8, y + 16);
        g.stroke();
      }
      // reflet + mousse
      g.fillStyle = 'rgba(255,255,255,.25)';
      g.beginPath(); g.ellipse(49, 45, 12, 6, -.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(122,160,90,.7)';
      g.beginPath(); g.ellipse(42 + rn() * 8, 82, 8, 3.4, .2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(74, 84, 6, 2.8, -.2, 0, TAU); g.fill();
    }
    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // API : références PixelLab (pixellab/export-refs.html) — rendus
  // STANDALONE (aucune dépendance à battle.js) fidèles au style bataille.
  // getNodeRef / getObstacleRef / getTerrainRef / getDecorRef.
  // ------------------------------------------------------------
  // couleurs de camp du champ de bataille (alignées sur battle.js)
  const REF_FCOL  = { cats: '#f08c42', birds: '#48a9d8' };
  const REF_FCOL2 = { cats: '#e76f51', birds: '#3a86ff' };

  // avant-poste : butte + palissade de rondins + tente teintée faction
  // (équivalent standalone du fortin dessiné en bataille)
  function drawOutpostRef(g, owner) {
    const col = owner ? REF_FCOL[owner] : '#9a9a92';
    const col2 = owner ? REF_FCOL2[owner] : '#7a7a72';
    // ombre + butte de terre battue
    g.fillStyle = 'rgba(20,30,15,0.22)';
    g.beginPath(); g.ellipse(56, 88, 30, 10, 0, 0, TAU); g.fill();
    g.fillStyle = '#9a8f76';
    g.beginPath(); g.ellipse(56, 84, 26, 10, 0, 0, TAU); g.fill();
    // palissade de rondins (le fortin)
    g.fillStyle = '#7a6142';
    for (let i = 0; i < 5; i++) {
      const x = 34 + i * 11;
      g.fillRect(x, 62, 8, 22);
      g.beginPath(); g.arc(x + 4, 62, 4, Math.PI, 0); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(34 + i * 11 - 1.5, 64); g.lineTo(34 + i * 11 - 1.5, 82); g.stroke(); }
    // tente en toile teintée faction
    g.fillStyle = col;
    g.beginPath(); g.moveTo(56, 34); g.lineTo(80, 66); g.lineTo(32, 66); g.closePath(); g.fill();
    g.strokeStyle = col2; g.lineWidth = 2; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
    // entrée sombre
    g.fillStyle = 'rgba(30,26,22,0.85)';
    g.beginPath(); g.moveTo(56, 48); g.lineTo(64, 66); g.lineTo(48, 66); g.closePath(); g.fill();
    // fanion
    g.strokeStyle = '#5a4630'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(56, 34); g.lineTo(56, 18); g.stroke();
    g.fillStyle = col2;
    g.beginPath(); g.moveTo(57, 18); g.lineTo(74, 22); g.lineTo(57, 27); g.closePath(); g.fill();
  }

  // BÂTIMENT de bataille standalone : les 6 kinds de getNodeCanvas + 'avantposte'.
  function getNodeRef(kind, owner, size) {
    size = size || 112;
    if (kind !== 'avantposte') return getNodeCanvas(kind, owner, size);
    // avant-poste : si un skin lab est choisi, getNodeCanvas sait le dessiner
    if (window.LabSkins && LabSkins.building('avantposte', owner))
      return getNodeCanvas(kind, owner, size);
    const key = 'nref|avantposte|' + (owner || 'none') + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 112, size / 112);
    g.lineJoin = 'round'; g.lineCap = 'round';
    drawOutpostRef(g, owner);
    cache.set(key, cv);
    return cv;
  }

  // OBSTACLE de bataille ('rock' — variantes par seed — ou 'water'), taille libre.
  function getObstacleRef(kind, size, seed) {
    const src = getObstacleCanvas(kind, seed);
    size = size || src.width;
    if (size === src.width) return src;
    const key = 'obref|' + (kind === 'water' ? 'water' : 'rock') + '|' + ((seed | 0) || 1) + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(src, 0, 0, size, size);
    cache.set(key, cv);
    return cv;
  }

  // thème de terrain : accepte un id de ville ('ronron'…), un index, un nom
  // de decor ('park'…) ou directement un objet theme {g1,g2,decor}.
  function terrainTheme(x) {
    if (x && typeof x === 'object') return x;
    const cities = (SGD && SGD.CITIES) || [];
    if (typeof x === 'number' && cities[x]) return cities[x].theme || {};
    for (const c of cities) {
      if (c.id === x) return c.theme || {};
    }
    for (const c of cities) {
      if (c.theme && c.theme.decor === x) return c.theme;
    }
    return {};
  }

  // TUILE de terrain représentative d'un thème de ville : fond g1/g2 +
  // mouchetures + motif léger du decor (approximation fidèle du sol bataille).
  function getTerrainRef(cityIdOrTheme, size) {
    size = size || 128;
    const th = terrainTheme(cityIdOrTheme);
    const g1 = th.g1 || '#8fbc6f', g2 = th.g2 || '#6da054', decor = th.decor || 'park';
    const key = 'tref|' + g1 + '|' + g2 + '|' + decor + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    const S = 128;
    g.scale(size / S, size / S);
    g.lineJoin = 'round'; g.lineCap = 'round';
    let sd = 5;
    for (let i = 0; i < decor.length; i++) sd = (sd * 31 + decor.charCodeAt(i)) >>> 0;
    const rnd = mulberry(sd || 1);
    const dark = SGD.shade(g2, -0.28), lite = SGD.shade(g1, 0.3);

    // fond : dégradé radial doux (comme paintTerrain de bataille)
    const grad = g.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S * 0.72);
    grad.addColorStop(0, SGD.shade(g1, 0.08));
    grad.addColorStop(0.6, g1);
    grad.addColorStop(1, g2);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);

    // taches peintes
    for (let i = 0; i < 26; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
      g.beginPath();
      g.ellipse(rnd() * S, rnd() * S, 8 + rnd() * 22, 5 + rnd() * 11, rnd() * Math.PI, 0, TAU);
      g.fill();
    }

    const px = () => 14 + rnd() * (S - 28), py = () => 14 + rnd() * (S - 28);
    function blob(x, y, r, col, a) {
      g.globalAlpha = a; g.fillStyle = col;
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const an = i / 10 * TAU, rr = r * (0.8 + rnd() * 0.35);
        const bx = x + Math.cos(an) * rr, by = y + Math.sin(an) * rr * 0.8;
        i ? g.lineTo(bx, by) : g.moveTo(bx, by);
      }
      g.closePath(); g.fill(); g.globalAlpha = 1;
    }
    function tinyTree(x, y, r) {
      g.globalAlpha = 0.22; g.fillStyle = 'rgba(0,0,0,0.5)';
      g.beginPath(); g.ellipse(x + 2, y + 3, r, r * 0.5, 0, 0, TAU); g.fill();
      g.globalAlpha = 0.85;
      const tg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
      tg.addColorStop(0, SGD.shade(g1, 0.35)); tg.addColorStop(1, dark);
      g.fillStyle = tg;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    function box(x, y, ww, hh, col, a) {
      g.globalAlpha = a; g.fillStyle = col;
      g.save(); g.translate(x, y); g.rotate((rnd() - 0.5) * 0.5);
      g.fillRect(-ww / 2, -hh / 2, ww, hh);
      g.globalAlpha = a * 0.5; g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
      g.strokeRect(-ww / 2, -hh / 2, ww, hh);
      g.restore(); g.globalAlpha = 1;
    }
    function dots(n, cols, a, rMax) {
      for (let i = 0; i < n; i++) {
        g.fillStyle = cols[(rnd() * cols.length) | 0]; g.globalAlpha = a;
        g.beginPath(); g.arc(px(), py(), 1.2 + rnd() * (rMax || 1.2), 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
    }

    switch (decor) {
      case 'park':
        for (let i = 0; i < 3; i++) tinyTree(px(), py(), 7 + rnd() * 6);
        dots(9, ['#e8788a', '#f2d24e', '#f8f4ec'], 0.75);
        break;
      case 'rooftop':
        for (let i = 0; i < 4; i++) box(px(), py(), 22 + rnd() * 26, 16 + rnd() * 18, rnd() < 0.5 ? SGD.shade(g2, -0.12) : SGD.shade(g1, 0.12), 0.5);
        for (let i = 0; i < 3; i++) box(px(), py(), 6, 5, '#c8ccd4', 0.7);
        break;
      case 'sand':
        g.strokeStyle = lite; g.globalAlpha = 0.35; g.lineWidth = 1.6;
        for (let i = 0; i < 7; i++) {
          g.beginPath(); g.arc(px(), py(), 8 + rnd() * 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
        g.globalAlpha = 1;
        for (let i = 0; i < 2; i++) {
          const x = px(), y = py();
          g.fillStyle = '#5a9058'; g.globalAlpha = 0.8;
          g.beginPath(); g.ellipse(x, y, 2.2, 5.5, 0, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(x - 3, y - 1.4, 1.4, 3.2, -0.5, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
        break;
      case 'sky':
        for (let i = 0; i < 5; i++) blob(px(), py(), 14 + rnd() * 16, '#ffffff', 0.16);
        g.globalAlpha = 0.12; g.fillStyle = '#fff8d8';
        g.beginPath(); g.arc(S * 0.85, S * 0.12, 40, 0, TAU); g.fill(); g.globalAlpha = 1;
        break;
      case 'fortress':
        g.strokeStyle = 'rgba(0,0,0,0.09)'; g.lineWidth = 1.2;
        for (let x = 14; x < S; x += 34) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, S); g.stroke(); }
        for (let y = 14; y < S; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + 3); g.stroke(); }
        for (let i = 0; i < 4; i++) blob(px(), py(), 6 + rnd() * 6, dark, 0.25);
        break;
      case 'harbor': {
        const wg = g.createLinearGradient(0, S - 46, 0, S);
        wg.addColorStop(0, 'rgba(70,150,190,0)'); wg.addColorStop(1, 'rgba(56,130,180,0.55)');
        g.fillStyle = wg; g.fillRect(0, S - 46, S, 46);
        g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.3;
        for (let i = 0; i < 4; i++) {
          g.beginPath(); g.arc(rnd() * S, S - 7 - rnd() * 26, 5 + rnd() * 8, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        }
        for (let i = 0; i < 3; i++) box(px(), 20 + rnd() * (S - 80), 6, 8, '#9a6a3a', 0.8);
        break;
      }
      case 'meadow': {
        const x = S * (0.3 + rnd() * 0.4), y = S * (0.3 + rnd() * 0.4);
        g.globalAlpha = 0.7; g.fillStyle = '#d6708a';
        g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x, y, 4 + i * 4, i, i + 2.4); g.stroke(); }
        g.globalAlpha = 1;
        dots(12, ['#e8788a', '#b48cff', '#f2d24e'], 0.7);
        break;
      }
      case 'junkyard':
        for (let i = 0; i < 4; i++) box(px(), py(), 12 + rnd() * 14, 9 + rnd() * 9, '#c0a068', 0.55);
        for (let i = 0; i < 2; i++) {
          g.strokeStyle = '#3a3a3a'; g.globalAlpha = 0.5; g.lineWidth = 3;
          g.beginPath(); g.arc(px(), py(), 5, 0, TAU); g.stroke(); g.globalAlpha = 1;
        }
        break;
      case 'forest':
        for (let i = 0; i < 6; i++) tinyTree(px(), py(), 8 + rnd() * 8);
        for (let i = 0; i < 5; i++) blob(px(), py(), 6 + rnd() * 8, '#fff8c8', 0.06);
        break;
      case 'city':
        g.fillStyle = 'rgba(60,60,70,0.30)';
        g.fillRect(0, S * 0.42, S, 18);
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1.6; g.setLineDash([7, 7]);
        g.beginPath(); g.moveTo(0, S * 0.42 + 9); g.lineTo(S, S * 0.42 + 9); g.stroke();
        g.setLineDash([]);
        for (let i = 0; i < 3; i++) box(px(), py(), 18 + rnd() * 16, 13 + rnd() * 11, SGD.shade(g2, -0.15), 0.45);
        break;
      case 'fishmarket':
        // pavés mouillés : flaques bleutées + arcs d'écailles
        for (let i = 0; i < 5; i++) blob(px(), py(), 8 + rnd() * 10, '#bfe0f2', 0.22);
        g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.2;
        for (let i = 0; i < 8; i++) {
          g.beginPath(); g.arc(px(), py(), 3 + rnd() * 4, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
        break;
      case 'windmill':
        // plaine balayée : herbes couchées + pétales portés par le vent
        g.strokeStyle = rgba(lite, 0.6); g.lineWidth = 1.4;
        for (let i = 0; i < 14; i++) {
          const x = px(), y = py();
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 5, y - 3, x + 10, y - 2); g.stroke();
        }
        dots(7, ['#f8f4ec', '#e8b8c8', '#f2d24e'], 0.65);
        break;
      case 'fields':
        // sillons de culture + touffes jaunes
        g.strokeStyle = 'rgba(90,70,30,0.22)'; g.lineWidth = 3.5;
        for (let y = 10; y < S; y += 16) {
          g.beginPath(); g.moveTo(0, y + rnd() * 4); g.lineTo(S, y + rnd() * 4); g.stroke();
        }
        dots(10, ['#f2d24e', '#e8c02a', '#c8b858'], 0.8, 1.8);
        break;
      case 'gears':
        // plaques rivetées + engrenage + taches de rouille
        g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(S * 0.5, 0); g.lineTo(S * 0.5, S); g.stroke();
        g.beginPath(); g.moveTo(0, S * 0.55); g.lineTo(S, S * 0.55); g.stroke();
        g.fillStyle = 'rgba(40,34,28,0.4)';
        for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(px(), py(), 1.6, 0, TAU); g.fill(); }
        for (let i = 0; i < 2; i++) {
          const x = px(), y = py();
          g.strokeStyle = 'rgba(60,50,40,0.5)'; g.lineWidth = 3;
          g.beginPath(); g.arc(x, y, 7, 0, TAU); g.stroke();
          for (let k = 0; k < 6; k++) {
            const a = k / 6 * TAU;
            g.beginPath(); g.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
            g.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); g.stroke();
          }
        }
        for (let i = 0; i < 4; i++) blob(px(), py(), 5 + rnd() * 6, '#a05828', 0.18);
        break;
      case 'cushions':
        // velours matelassé : losanges + boutons de couture
        g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.4;
        for (let d = -S; d < S * 2; d += 26) {
          g.beginPath(); g.moveTo(d, 0); g.lineTo(d + S, S); g.stroke();
          g.beginPath(); g.moveTo(d, S); g.lineTo(d + S, 0); g.stroke();
        }
        g.fillStyle = '#f4c542'; g.globalAlpha = 0.75;
        for (let yy = 13; yy < S; yy += 26) for (let xx = 13; xx < S; xx += 26) {
          g.beginPath(); g.arc(xx, yy, 1.6, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
        break;
      case 'throne':
        // marbre veiné + incrustations dorées
        g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.2;
        for (let i = 0; i < 6; i++) {
          const x = px(), y = py();
          g.beginPath(); g.moveTo(x, y);
          g.quadraticCurveTo(x + 8 + rnd() * 8, y + 6, x + 18 + rnd() * 10, y + 2 + rnd() * 8);
          g.stroke();
        }
        g.strokeStyle = 'rgba(244,197,66,0.55)'; g.lineWidth = 1.8;
        g.strokeRect(16, 16, S - 32, S - 32);
        g.beginPath(); g.arc(S / 2, S / 2, 22, 0, TAU); g.stroke();
        break;
      default:
        for (let i = 0; i < 3; i++) tinyTree(px(), py(), 7 + rnd() * 5);
    }

    // grain : brins courts (fidèle au sol de bataille)
    g.strokeStyle = 'rgba(20,45,20,0.15)'; g.lineWidth = 1.1;
    for (let i = 0; i < 46; i++) {
      const x = rnd() * S, y = rnd() * S;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.4, y - 4); g.stroke();
    }
    cache.set(key, cv);
    return cv;
  }

  // ÉLÉMENT de décor urbain/naturel (habillage des cartes et du zigzag
  // d'expédition) : fill mat + trait encre, ombre douce. Base 96 px.
  const DECOR_KINDS = ['tree', 'bush', 'stump', 'fence', 'crate', 'barrel', 'lamp', 'bench', 'fountain'];
  function getDecorRef(kind, size) {
    kind = DECOR_KINDS.indexOf(kind) >= 0 ? kind : 'tree';
    size = size || 96;
    const key = 'dref|' + kind + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 96, size / 96);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const ink = 'rgba(46,38,32,0.6)';
    g.strokeStyle = ink; g.lineWidth = 2.4;
    const fillS = (col, path) => { g.fillStyle = col; path(); g.fill(); g.stroke(); };
    const rect = (x, y, w, h) => { g.beginPath(); g.rect(x, y, w, h); };
    const rrect = (x, y, w, h, r) => { roundRectPath(g, x, y, w, h, r); };
    const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
    softShadow(g, 48, 84, 28, 8, 0.2);

    if (kind === 'tree') {
      fillS('#8a6a44', () => rrect(43, 50, 10, 34, 3));
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(46, 56); g.lineTo(46, 78); g.stroke();
      g.strokeStyle = ink; g.lineWidth = 2.4;
      fillS('#7fae67', () => disc(48, 32, 22));
      fillS('#93bd78', () => disc(33, 42, 12));
      fillS('#93bd78', () => disc(63, 42, 11));
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath(); g.ellipse(42, 24, 9, 5.5, -0.5, 0, TAU); g.fill();
    } else if (kind === 'bush') {
      fillS('#7fae67', () => disc(34, 62, 15));
      fillS('#93bd78', () => disc(56, 58, 18));
      fillS('#7fae67', () => disc(46, 70, 14));
      fillS('#c86a7a', () => disc(38, 54, 3.2));
      fillS('#e0a83a', () => disc(60, 48, 3.2));
      fillS('#c86a7a', () => disc(52, 68, 2.8));
    } else if (kind === 'stump') {
      // tronc coupé : cylindre + anneaux de croissance + champignon
      fillS('#8a6a44', () => {
        g.beginPath();
        g.moveTo(28, 48); g.lineTo(28, 72);
        g.quadraticCurveTo(48, 82, 68, 72); g.lineTo(68, 48);
        g.closePath();
      });
      fillS('#c9a06a', () => { g.beginPath(); g.ellipse(48, 48, 20, 10, 0, 0, TAU); });
      g.strokeStyle = 'rgba(122,90,58,0.8)'; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(48, 48, 13, 6.2, 0, 0, TAU); g.stroke();
      g.beginPath(); g.ellipse(48, 48, 6.5, 3, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(34, 54); g.lineTo(34, 70); g.stroke();
      g.beginPath(); g.moveTo(61, 55); g.lineTo(61, 70); g.stroke();
      g.strokeStyle = ink; g.lineWidth = 2;
      fillS('#c86a5a', () => { g.beginPath(); g.ellipse(68, 62, 7, 4.6, 0, Math.PI, 0); g.closePath(); });
      fillS('#e8dcc0', () => rect(66, 62, 4, 6));
    } else if (kind === 'fence') {
      // deux poteaux + planches croisées
      fillS('#7a5a3a', () => rrect(24, 36, 8, 44, 2.5));
      fillS('#7a5a3a', () => rrect(64, 36, 8, 44, 2.5));
      fillS('#a87c50', () => {
        g.beginPath();
        g.moveTo(22, 44); g.lineTo(74, 62); g.lineTo(74, 70); g.lineTo(22, 52);
        g.closePath();
      });
      fillS('#a87c50', () => {
        g.beginPath();
        g.moveTo(74, 44); g.lineTo(22, 62); g.lineTo(22, 70); g.lineTo(74, 52);
        g.closePath();
      });
    } else if (kind === 'crate') {
      fillS('#b08c58', () => rrect(24, 36, 48, 44, 3));
      g.beginPath(); g.moveTo(24, 36); g.lineTo(72, 80); g.stroke();
      g.beginPath(); g.moveTo(72, 36); g.lineTo(24, 80); g.stroke();
      g.strokeStyle = 'rgba(60,40,20,0.4)'; g.lineWidth = 1.6;
      g.strokeRect(30, 42, 36, 32);
      // marquage patte (clin d'œil)
      pawPrint(g, 48, 56, 4.6, 'rgba(90,60,30,0.55)');
    } else if (kind === 'barrel') {
      g.save(); g.translate(48, 58); g.rotate(0.08);
      fillS('#a87848', () => rrect(-18, -24, 36, 48, 10));
      g.strokeStyle = '#5c5448'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-18, -10); g.lineTo(18, -10); g.stroke();
      g.beginPath(); g.moveTo(-18, 10); g.lineTo(18, 10); g.stroke();
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-6, -22); g.lineTo(-6, 22); g.stroke();
      g.beginPath(); g.moveTo(7, -22); g.lineTo(7, 22); g.stroke();
      g.restore();
    } else if (kind === 'lamp') {
      // halo chaud
      g.fillStyle = 'rgba(232,200,106,0.28)';
      g.beginPath(); g.arc(48, 22, 17, 0, TAU); g.fill();
      fillS('#5c5448', () => rrect(45, 28, 6, 50, 2));
      fillS('#5c5448', () => rrect(37, 76, 22, 6, 2.5));
      fillS('#4c463c', () => { g.beginPath(); g.moveTo(40, 30); g.lineTo(56, 30); g.lineTo(52, 14); g.lineTo(44, 14); g.closePath(); });
      fillS('#e8c86a', () => disc(48, 23, 6.4));
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.arc(46, 21, 2, 0, TAU); g.fill();
    } else if (kind === 'bench') {
      fillS('#7a5a3a', () => rrect(26, 60, 7, 22, 2));
      fillS('#7a5a3a', () => rrect(63, 60, 7, 22, 2));
      fillS('#a87c50', () => rrect(18, 54, 60, 9, 3));
      fillS('#a87c50', () => rrect(18, 32, 60, 8, 3));
      g.beginPath(); g.moveTo(23, 40); g.lineTo(23, 54); g.stroke();
      g.beginPath(); g.moveTo(73, 40); g.lineTo(73, 54); g.stroke();
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(18, 58.5); g.lineTo(78, 58.5); g.stroke();
      g.beginPath(); g.moveTo(18, 36); g.lineTo(78, 36); g.stroke();
    } else if (kind === 'fountain') {
      fillS('#9fb2bc', () => { g.beginPath(); g.ellipse(48, 68, 28, 12, 0, 0, TAU); });
      g.fillStyle = '#7fc4dc';
      g.beginPath(); g.ellipse(48, 66, 22, 8.5, 0, 0, TAU); g.fill();
      fillS('#b4c2ca', () => rrect(43, 38, 10, 26, 3));
      fillS('#9fb2bc', () => { g.beginPath(); g.ellipse(48, 37, 13, 5.4, 0, 0, TAU); });
      // jets d'eau
      g.strokeStyle = 'rgba(130,180,205,0.9)'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(38, 38); g.quadraticCurveTo(28, 46, 30, 60); g.stroke();
      g.beginPath(); g.moveTo(58, 38); g.quadraticCurveTo(68, 46, 66, 60); g.stroke();
      // pièces au fond
      g.fillStyle = '#f4c542';
      g.beginPath(); g.arc(40, 68, 2, 0, TAU); g.fill();
      g.beginPath(); g.arc(55, 70, 2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.beginPath(); g.ellipse(42, 63, 7, 2.6, -0.2, 0, TAU); g.fill();
    }
    cache.set(key, cv);
    return cv;
  }


