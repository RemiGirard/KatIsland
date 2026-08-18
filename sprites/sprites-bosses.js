/* ============================================================
   GRIFFES & PLUMES — sprites-bosses.js (8/9)
   Les 9 peintres de boss de carte + sbires.
   ============================================================ */
"use strict";

  // ------------------------------------------------------------
  // API : getBossCanvas — BOSS de carte (DESIGN9). Présences NEUTRES
  // invulnérables, skin "peint" animable. Cache par (id, size, frame
  // d'anim quantifiée). animT (s) pilote un cycle discret. 9 skins :
  // taupe, limace, champignon, meduse, corbeau, golem, reine, orage,
  // volcan. Fallback dessiné si id inconnu. Sbires : getBossMinion.
  // ------------------------------------------------------------
  const BOSS_FRAMES = 12;      // frames d'animation par boss
  const BOSS_PERIOD = 2.4;     // durée d'un cycle complet (s)

  // couleur du boss : lue dans GameData.MAP_BOSSES, repli si absent
  function bossCol(id, fallback) {
    const list = (SGD && SGD.MAP_BOSSES) || [];
    for (const b of list) if (b.id === id) return b.col || fallback;
    return fallback;
  }

  function getBossCanvas(id, size, animT) {
    id = id == null ? '' : String(id);
    size = clamp(size | 0, 24, 512) || 96;
    animT = +animT || 0;
    // phase quantifiée : t ∈ {0/N .. (N-1)/N}, boucle sur BOSS_PERIOD
    let ph = (animT % BOSS_PERIOD) / BOSS_PERIOD;
    if (ph < 0) ph += 1;
    const frame = Math.floor(ph * BOSS_FRAMES) % BOSS_FRAMES;
    const key = 'boss|' + id + '|' + size + '|' + frame;
    let cv = cache.get(key);
    if (cv) return cv;

    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    // repère centré, ~[-50..50], sol vers y=36
    g.translate(size / 2, size / 2);
    g.scale(size / 100, size / 100);
    const t = frame / BOSS_FRAMES;                 // 0..1 (discret)
    const s = Math.sin(t * TAU), c = Math.cos(t * TAU);

    softShadow(g, 0, 40, 34, 11, .28);

    const painter = BOSS_PAINTERS[id] || bossFallback;
    painter(g, bossCol(id, '#8a7a5a'), t, s, c);

    cache.set(key, cv);
    return cv;
  }

  // ---- painters : dessinent dans le repère centré [-50..50], sol y≈36 ----
  const BOSS_PAINTERS = {
    // La Taupe Laser : motte de terre + taupe qui sort, yeux qui s'allument
    taupe(g, col, t, s) {
      const em = s * 0.5 + 0.5;                    // émergence 0..1
      const by = 14 - em * 20;                      // hauteur du corps
      // motte de terre (devant/derrière)
      const dirt = '#6b4e30';
      g.fillStyle = SGD.shade(dirt, -.12);
      g.beginPath(); g.ellipse(0, 30, 34, 15, 0, 0, TAU); g.fill();
      // corps de taupe (velours sombre)
      const bg = g.createRadialGradient(-4, by - 4, 3, 0, by, 20);
      bg.addColorStop(0, SGD.shade(col, .28)); bg.addColorStop(1, SGD.shade(col, -.34));
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(0, by + 4, 18, 20, 0, 0, TAU); g.fill();
      // museau rose pointu
      g.fillStyle = '#d98a8a';
      g.beginPath(); g.ellipse(0, by - 8, 7, 5.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#8a4a4a';
      g.beginPath(); g.arc(0, by - 9, 1.8, 0, TAU); g.fill();
      // grosses griffes fouisseuses
      g.strokeStyle = '#e6ddc4'; g.lineWidth = 1.6;
      for (const sx of [-1, 1]) for (const d of [-2, 0, 2]) {
        g.beginPath(); g.moveTo(sx * 13, by + 8); g.lineTo(sx * (16 + Math.abs(d)), by + 12 + d); g.stroke();
      }
      // yeux laser : lueur qui monte avec l'émergence
      const gl = em * em;
      for (const sx of [-1, 1]) {
        const ex = sx * 5, ey = by - 3;
        if (gl > 0.05) {
          const gr = g.createRadialGradient(ex, ey, .5, ex, ey, 7);
          gr.addColorStop(0, rgba('#ff3a2a', .85 * gl)); gr.addColorStop(1, rgba('#ff3a2a', 0));
          g.fillStyle = gr; g.beginPath(); g.arc(ex, ey, 7, 0, TAU); g.fill();
        }
        g.fillStyle = gl > 0.55 ? '#ffd0c0' : SGD.mix('#3a2a2a', '#ff3a2a', gl);
        g.beginPath(); g.arc(ex, ey, 2.2, 0, TAU); g.fill();
      }
      // amorce de rayon quand les yeux sont au max
      if (gl > 0.7) {
        g.strokeStyle = rgba('#ff5a3a', (gl - 0.7) * 2.6); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(0, by - 3); g.lineTo(0, by - 3 - 22 * (gl - 0.7) * 3); g.stroke();
      }
      // mottes projetées
      g.fillStyle = dirt;
      for (const p of [[-24, 26], [22, 24], [-14, 32], [15, 31]]) {
        g.beginPath(); g.arc(p[0], p[1], 3.2, 0, TAU); g.fill();
      }
    },

    // La Limace Gluante : corps mou luisant, tentacules oculaires, bave permanente
    limace(g, col, t, s) {
      const ooze = s * 0.5 + 0.5;                  // ondulation 0..1
      // traînée de bave brillante au sol
      g.fillStyle = rgba('#c8f0a0', .32);
      g.beginPath(); g.ellipse(4, 34, 34, 8, 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#eaffc8', .5);
      for (const p of [[-22, 34], [-8, 35], [10, 34], [24, 33]]) { g.beginPath(); g.arc(p[0], p[1], 2.2, 0, TAU); g.fill(); }
      g.save(); g.translate(0, 2 - ooze * 2);
      // corps mou allongé, dos arqué
      const bg = g.createLinearGradient(0, -6, 0, 30);
      bg.addColorStop(0, SGD.shade(col, .34)); bg.addColorStop(1, SGD.shade(col, -.28));
      g.fillStyle = bg;
      g.beginPath();
      g.moveTo(-30, 30);
      g.quadraticCurveTo(-34, 6, -16, 2);
      g.quadraticCurveTo(0, -6, 20, 2);
      g.quadraticCurveTo(34, 6, 30, 20);
      g.quadraticCurveTo(20, 32, 0, 30);
      g.closePath(); g.fill();
      // reflet gluant
      g.fillStyle = rgba('#ffffff', .28 + ooze * .16);
      g.beginPath(); g.ellipse(-2, 6, 18, 5, -.15, 0, TAU); g.fill();
      // manteau (bosse dorsale)
      g.fillStyle = SGD.shade(col, -.12);
      g.beginPath(); g.ellipse(-4, 12, 12, 9, 0, 0, TAU); g.fill();
      // tentacules oculaires qui frétillent
      for (const sx of [22, 28]) {
        const wob = Math.sin(t * TAU + sx) * 2;
        g.strokeStyle = SGD.shade(col, .1); g.lineWidth = 4;
        g.beginPath(); g.moveTo(sx, 6); g.lineTo(sx + 3 + wob, -12); g.stroke();
        g.fillStyle = '#2a2018'; g.beginPath(); g.arc(sx + 3 + wob, -13, 2.4, 0, TAU); g.fill();
      }
      g.restore();
      // gouttes de bave qui perlent
      for (let i = 0; i < 3; i++) {
        const u = (t + i / 3) % 1;
        g.fillStyle = rgba('#c8f0a0', (1 - u) * .6);
        g.beginPath(); g.arc(-14 + i * 14, 24 + u * 14, 1.6 + u, 0, TAU); g.fill();
      }
    },

    // La Méduse Électrique : cloche translucide, tentacules, décharge périodique
    meduse(g, col, t, s) {
      const pulse = 1 + s * 0.08;
      const arc = (Math.sin(t * TAU * 2) * .5 + .5);   // charge 0..1
      // halo électrique au moment de la décharge
      if (arc > .3) {
        const gr = g.createRadialGradient(0, 6, 6, 0, 6, 44);
        gr.addColorStop(0, rgba('#bff4ff', .3 * arc)); gr.addColorStop(1, rgba('#bff4ff', 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 6, 44, 0, TAU); g.fill();
      }
      // tentacules ondulants
      g.strokeStyle = rgba(SGD.shade(col, -.1), .85); g.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const bx = -18 + i * 6;
        const sw = Math.sin(t * TAU + i * 0.7) * 4;
        g.beginPath(); g.moveTo(bx, 8);
        g.bezierCurveTo(bx + sw, 20, bx - sw, 30, bx + sw * 0.6, 40);
        g.stroke();
      }
      // cloche (dôme translucide, pulse)
      g.save(); g.translate(0, 4); g.scale(pulse, pulse); g.translate(0, -4);
      const bg = g.createRadialGradient(-6, -4, 4, 0, 4, 26);
      bg.addColorStop(0, SGD.shade(col, .4)); bg.addColorStop(1, SGD.shade(col, -.2));
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(0, 4, 24, 18, 0, Math.PI, TAU); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(0, 4, 24, 6, 0, 0, TAU); g.fill();
      // franges du bord
      g.fillStyle = SGD.shade(col, -.16);
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.arc(i * 7, 8, 3, 0, Math.PI); g.fill(); }
      // organes lumineux internes
      g.fillStyle = rgba('#eaffff', .7);
      for (const p of [[-8, -2], [8, -2], [0, -8]]) { g.beginPath(); g.arc(p[0], p[1], 2.4, 0, TAU); g.fill(); }
      g.restore();
      // arcs électriques au pic de charge
      if (arc > .55) {
        g.strokeStyle = rgba('#eaffff', arc); g.lineWidth = 1.6;
        g.shadowColor = '#9fe8ff'; g.shadowBlur = 8;
        for (let k = 0; k < 3; k++) {
          const a0 = t * TAU + k * TAU / 3;
          let px = Math.cos(a0) * 10, py = 10 + Math.sin(a0) * 8;
          g.beginPath(); g.moveTo(px, py);
          for (let j = 1; j <= 3; j++) { const rad = 16 + j * 7; const aa = a0 + (j % 2 ? .4 : -.4); px = Math.cos(aa) * rad; py = 10 + Math.sin(aa) * rad * .8; g.lineTo(px, py); }
          g.stroke();
        }
        g.shadowBlur = 0;
      }
    },

    // Le Champignon Vénéneux : chapeau qui pulse + nuage de spores toxiques
    champignon(g, col, t, s) {
      const pulse = 1 + s * 0.06;
      // pied crème
      const sg = g.createLinearGradient(-10, 0, 10, 0);
      sg.addColorStop(0, '#e4d7bc'); sg.addColorStop(1, '#c8b592');
      g.fillStyle = sg;
      roundRectPath(g, -11, 2, 22, 30, 8); g.fill();
      // volve
      g.fillStyle = '#d8c9a8';
      g.beginPath(); g.ellipse(0, 33, 15, 5, 0, 0, TAU); g.fill();
      // chapeau
      g.save(); g.translate(0, 2); g.scale(pulse, pulse); g.translate(0, -2);
      const cg = g.createRadialGradient(-6, -6, 3, 0, 0, 30);
      cg.addColorStop(0, SGD.shade(col, .32)); cg.addColorStop(1, SGD.shade(col, -.24));
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(0, 2, 28, 20, 0, Math.PI, 0); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(0, 2, 28, 6, 0, 0, TAU); g.fill();
      // taches claires
      g.fillStyle = rgba('#fbf1e2', .9);
      for (const p of [[-14, -6, 3.4], [6, -10, 4], [16, -3, 3], [-4, -3, 2.6], [-20, 0, 2.4]]) {
        g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); g.fill();
      }
      g.restore();
      // visage colérique sur le pied
      g.fillStyle = '#2a2018';
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(sx * 2, 12); g.lineTo(sx * 7, 14); g.lineTo(sx * 3, 16); g.closePath(); g.fill();
      }
      g.strokeStyle = '#2a2018'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 26, 5, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
      // nuage de spores qui monte
      for (let i = 0; i < 5; i++) {
        const u = (t + i / 5) % 1;
        const a = i / 5 * TAU + t * 2;
        const sx = Math.cos(a) * (18 + u * 14);
        const sy = 2 - u * 26;
        g.fillStyle = rgba('#c86ad0', (1 - u) * .55);
        g.beginPath(); g.arc(sx, sy, 2 + u * 2.4, 0, TAU); g.fill();
      }
    },

    // Le Corbeau Saboteur : encapuchonné, œil jaune, clé à molette au poing
    corbeau(g, col, t) {
      const flap = Math.sin(t * TAU * 2);
      // ailes en cape qui battent
      g.fillStyle = SGD.shade(col, -.24);
      for (const sx of [-1, 1]) {
        g.save(); g.translate(sx * 6, 4); g.rotate(sx * flap * 0.18);
        g.beginPath();
        g.moveTo(0, -6);
        g.quadraticCurveTo(sx * 30, -4, sx * 34, 16);
        g.quadraticCurveTo(sx * 20, 12, 0, 18);
        g.closePath(); g.fill();
        g.restore();
      }
      // corps sombre
      const bg = g.createLinearGradient(0, -14, 0, 30);
      bg.addColorStop(0, SGD.shade(col, .2)); bg.addColorStop(1, SGD.shade(col, -.3));
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(0, 12, 15, 20, 0, 0, TAU); g.fill();
      // capuche
      g.fillStyle = SGD.shade(col, -.34);
      g.beginPath();
      g.moveTo(-13, -2);
      g.quadraticCurveTo(-16, -20, 0, -22);
      g.quadraticCurveTo(16, -20, 13, -2);
      g.quadraticCurveTo(0, -6, -13, -2);
      g.closePath(); g.fill();
      // ombre du visage sous la capuche
      g.fillStyle = '#12101a';
      g.beginPath(); g.ellipse(0, -8, 9, 8, 0, 0, TAU); g.fill();
      // bec
      g.fillStyle = '#e0a020';
      g.beginPath(); g.moveTo(-3, -8); g.lineTo(10, -5); g.lineTo(-3, -3); g.closePath(); g.fill();
      // œil luisant qui pulse
      const glow = 0.5 + 0.5 * Math.sin(t * TAU * 3);
      g.fillStyle = SGD.mix('#4a3a10', '#ffd24a', glow);
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 4, -10, 1.8, 0, TAU); g.fill(); }
      // clé à molette de saboteur
      g.strokeStyle = '#b8bcc4'; g.lineWidth = 3;
      g.save(); g.translate(12, 20); g.rotate(flap * 0.2 - .3);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 10); g.stroke();
      g.beginPath(); g.arc(0, -2, 3.4, Math.PI * 0.2, Math.PI * 1.8); g.stroke();
      g.restore();
    },

    // Le Golem d'Éboulis : cailloux facettés empilés, fissures de magma, éboulis
    golem(g, col, t, s) {
      const rumble = Math.sin(t * TAU * 3) * 0.6;
      const rock = (x, y, r, dv) => {
        const rg = g.createRadialGradient(x - r * .3, y - r * .3, r * .2, x, y, r);
        rg.addColorStop(0, SGD.shade(col, .22 + dv)); rg.addColorStop(1, SGD.shade(col, -.3 + dv));
        g.fillStyle = rg; g.beginPath();
        g.moveTo(x - r, y);
        g.lineTo(x - r * .5, y - r); g.lineTo(x + r * .6, y - r * .8);
        g.lineTo(x + r, y + r * .2); g.lineTo(x + r * .3, y + r); g.lineTo(x - r * .6, y + r * .8);
        g.closePath(); g.fill();
      };
      g.save(); g.translate(rumble, 0);
      rock(-10, 30, 8, -.06); rock(10, 30, 8, -.06);   // jambes
      rock(-20, 12, 7, 0); rock(20, 12, 7, 0);          // bras
      rock(0, 10, 18, 0);                                // torse
      rock(0, -12, 11, .04);                             // tête
      // yeux de magma
      const glow = 0.5 + 0.5 * s;
      g.fillStyle = SGD.mix('#3a1a0a', '#ff8a2a', glow);
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 4, -13, 2, 0, TAU); g.fill(); }
      // fissures lumineuses
      g.strokeStyle = rgba('#ff8a2a', .3 + glow * .4); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-8, 4); g.lineTo(-2, 10); g.lineTo(-6, 18); g.stroke();
      g.beginPath(); g.moveTo(8, 2); g.lineTo(3, 12); g.stroke();
      g.restore();
      // cailloux qui dégringolent
      g.fillStyle = SGD.shade(col, -.2);
      for (let i = 0; i < 3; i++) { const u = (t + i / 3) % 1; g.beginPath(); g.arc(-16 + i * 16, 20 + u * 18, 2 + i * .4, 0, TAU); g.fill(); }
    },

    // La Reine des Nuées : abdomen rayé couronné, nuée de sbires en orbite
    reine(g, col, t) {
      const buzz = Math.sin(t * TAU * 4);
      // sbires (nuée) en orbite
      for (let i = 0; i < 5; i++) {
        const a = t * TAU + i / 5 * TAU;
        const rr = 34 + Math.sin(t * TAU * 2 + i) * 4;
        const x = Math.cos(a) * rr, y = 6 + Math.sin(a) * rr * 0.55;
        g.fillStyle = SGD.shade(col, -.1);
        g.beginPath(); g.ellipse(x, y, 3, 2.2, a, 0, TAU); g.fill();
        g.fillStyle = rgba('#ffffff', .5);
        g.beginPath(); g.ellipse(x, y - 2, 2.4, 1.2, 0, 0, TAU); g.fill();
      }
      // ailes de la reine (floues)
      g.fillStyle = rgba('#eaf4ff', .4);
      for (const sx of [-1, 1]) {
        g.save(); g.translate(sx * 8, 2); g.rotate(sx * (0.3 + buzz * 0.12));
        g.beginPath(); g.ellipse(sx * 10, -2, 12, 6, 0, 0, TAU); g.fill();
        g.restore();
      }
      // abdomen rayé
      const bg = g.createLinearGradient(0, 2, 0, 34);
      bg.addColorStop(0, SGD.shade(col, .3)); bg.addColorStop(1, SGD.shade(col, -.24));
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(0, 18, 15, 20, 0, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.ellipse(0, 18, 15, 20, 0, 0, TAU); g.clip();
      g.fillStyle = '#2a2012'; for (const yy of [8, 18, 28]) g.fillRect(-16, yy, 32, 4);
      g.restore();
      // dard
      g.fillStyle = '#20180c';
      g.beginPath(); g.moveTo(-3, 36); g.lineTo(3, 36); g.lineTo(0, 44); g.closePath(); g.fill();
      // thorax + tête
      g.fillStyle = SGD.shade(col, -.14);
      g.beginPath(); g.arc(0, -2, 10, 0, TAU); g.fill();
      g.fillStyle = SGD.shade(col, -.28);
      g.beginPath(); g.arc(0, -14, 7, 0, TAU); g.fill();
      g.fillStyle = '#1a140a';
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 3, -15, 2, 3, 0, 0, TAU); g.fill(); }
      // couronne
      g.fillStyle = '#ffd24a';
      g.beginPath();
      g.moveTo(-7, -20); g.lineTo(-7, -24); g.lineTo(-3.5, -21); g.lineTo(0, -26);
      g.lineTo(3.5, -21); g.lineTo(7, -24); g.lineTo(7, -20); g.closePath(); g.fill();
      // antennes
      g.strokeStyle = '#20180c'; g.lineWidth = 1.4;
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(sx * 3, -20); g.lineTo(sx * 7, -28); g.stroke();
        g.fillStyle = '#20180c'; g.beginPath(); g.arc(sx * 7, -28, 1.4, 0, TAU); g.fill();
      }
    },

    // Le Nuage d'Orage : masse bouffante grognonne, éclair intermittent
    orage(g, col, t, s) {
      const flash = Math.pow(Math.max(0, Math.sin(t * TAU * 2)), 6);   // éclair bref
      // lueur d'éclair vers le bas
      if (flash > .05) {
        const gr = g.createRadialGradient(0, 24, 4, 0, 24, 40);
        gr.addColorStop(0, rgba('#fff7c0', .6 * flash)); gr.addColorStop(1, rgba('#fff7c0', 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 24, 40, 0, TAU); g.fill();
      }
      const bob = s * 1.5;
      g.save(); g.translate(0, bob);
      // lobes du nuage
      const lobes = [[-18, 2, 15], [-4, -6, 17], [14, 0, 15], [22, 6, 11], [-22, 8, 11], [2, 8, 18]];
      for (const [x, y, r] of lobes) {
        const cg = g.createRadialGradient(x - r * .3, y - r * .4, r * .2, x, y, r);
        cg.addColorStop(0, SGD.shade(col, .28)); cg.addColorStop(1, SGD.shade(col, -.24));
        g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      // visage grognon
      g.fillStyle = '#1c1c26';
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 8, 2, 2.2, 0, TAU); g.fill(); }
      g.strokeStyle = '#1c1c26'; g.lineWidth = 1.6;
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 4, -3); g.lineTo(sx * 12, -1); g.stroke(); }
      g.beginPath(); g.arc(0, 14, 5, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
      g.restore();
      // éclair qui zèbre le sol
      if (flash > .1) {
        g.strokeStyle = rgba('#fff2a0', 1); g.lineWidth = 2.4;
        g.shadowColor = '#ffe860'; g.shadowBlur = 10;
        g.beginPath();
        g.moveTo(-2, 20 + bob); g.lineTo(-8, 30 + bob); g.lineTo(-2, 30 + bob); g.lineTo(-9, 44 + bob);
        g.stroke();
        g.shadowBlur = 0;
      }
    },

    // Le Cône Grondant : volcan qui fume, cratère incandescent, éruption
    volcan(g, col, t, s) {
      const erupt = Math.max(0, Math.sin(t * TAU * 2));
      // panache de fumée
      for (let i = 0; i < 4; i++) {
        const u = (t + i / 4) % 1;
        g.fillStyle = rgba('#6a5a52', (1 - u) * .4);
        g.beginPath(); g.arc(Math.sin(u * 6 + i) * 6, -14 - u * 20, 4 + u * 6, 0, TAU); g.fill();
      }
      // cône
      const bg = g.createLinearGradient(-20, 34, 20, 34);
      bg.addColorStop(0, SGD.shade(col, -.3)); bg.addColorStop(.5, SGD.shade(col, .12)); bg.addColorStop(1, SGD.shade(col, -.3));
      g.fillStyle = bg;
      g.beginPath(); g.moveTo(-30, 36); g.lineTo(-11, -8); g.lineTo(11, -8); g.lineTo(30, 36); g.closePath(); g.fill();
      // stries de roche
      g.strokeStyle = SGD.shade(col, -.34); g.lineWidth = 1.2;
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 8, 0); g.lineTo(sx * 20, 30); g.stroke(); }
      // coulées de lave
      g.strokeStyle = rgba('#ff7a2a', .8); g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-4, -6); g.lineTo(-8, 8); g.lineTo(-14, 26); g.stroke();
      g.beginPath(); g.moveTo(6, -6); g.lineTo(10, 12); g.stroke();
      // cratère incandescent
      const gr = g.createRadialGradient(0, -8, 2, 0, -8, 14);
      gr.addColorStop(0, SGD.mix('#ffd24a', '#ff5a1a', 0.3)); gr.addColorStop(1, rgba('#ff5a1a', .1));
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, -8, 12, 5, 0, 0, TAU); g.fill();
      // gerbe de projections
      if (erupt > .1) {
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.26;
          const d = erupt * (14 + (i % 2) * 8);
          const x = Math.cos(a) * d * 0.7, y = -8 + Math.sin(a) * d - erupt * 6;
          g.fillStyle = rgba(i % 2 ? '#ffd24a' : '#ff5a1a', erupt);
          g.beginPath(); g.arc(x, y, 2.2 + (i % 3 === 0 ? 1.4 : 0), 0, TAU); g.fill();
        }
      }
    },
  };

  // fallback : blob neutre + « ? » pour un id inconnu
  function bossFallback(g, col) {
    const bg = g.createRadialGradient(-5, 8, 4, 0, 14, 26);
    bg.addColorStop(0, SGD.shade(col, .3)); bg.addColorStop(1, SGD.shade(col, -.3));
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(0, 14, 24, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#f4e24a';
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 8, 8, 5, 0, TAU); g.fill(); }
    g.fillStyle = '#201808';
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * 8, 9, 2.2, 0, TAU); g.fill(); }
    g.fillStyle = '#3a2a10';
    g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', 0, 30);
  }

  // ------------------------------------------------------------
  // API : getBossMinion — sbire de la Reine des Nuées (effect 'spawner').
  // Petit frelon 'wild' hostile aux DEUX camps. Mini-skin dédié (pas la
  // reine rétrécie) : dard, œil rouge menaçant, ailes qui bourdonnent.
  // Même cache/anim que getBossCanvas. Reprend la couleur du boss 'reine'.
  // ------------------------------------------------------------
  function getBossMinion(size, animT) {
    size = clamp(size | 0, 12, 256) || 40;
    animT = +animT || 0;
    let ph = (animT % BOSS_PERIOD) / BOSS_PERIOD;
    if (ph < 0) ph += 1;
    const frame = Math.floor(ph * BOSS_FRAMES) % BOSS_FRAMES;
    const key = 'bossmin|' + size + '|' + frame;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.translate(size / 2, size / 2);
    g.scale(size / 100, size / 100);
    const t = frame / BOSS_FRAMES;
    const buzz = Math.sin(t * TAU * 5);
    const col = bossCol('reine', '#e0b040');
    softShadow(g, 0, 34, 18, 6, .2);
    // ailes floues
    g.fillStyle = rgba('#eaf4ff', .45);
    for (const sx of [-1, 1]) {
      g.save(); g.translate(sx * 4, -6); g.rotate(sx * (0.4 + buzz * 0.2));
      g.beginPath(); g.ellipse(sx * 10, 0, 14, 7, 0, 0, TAU); g.fill();
      g.restore();
    }
    // abdomen rayé
    const bg = g.createLinearGradient(0, -4, 0, 30);
    bg.addColorStop(0, SGD.shade(col, .3)); bg.addColorStop(1, SGD.shade(col, -.24));
    g.fillStyle = bg;
    g.beginPath(); g.ellipse(0, 12, 13, 20, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.ellipse(0, 12, 13, 20, 0, 0, TAU); g.clip();
    g.fillStyle = '#241a0c'; for (const yy of [2, 12, 22]) g.fillRect(-14, yy, 28, 4);
    g.restore();
    // dard
    g.fillStyle = '#1a1208';
    g.beginPath(); g.moveTo(-3, 30); g.lineTo(3, 30); g.lineTo(0, 40); g.closePath(); g.fill();
    // tête
    g.fillStyle = SGD.shade(col, -.28);
    g.beginPath(); g.arc(0, -12, 9, 0, TAU); g.fill();
    // gros yeux menaçants
    g.fillStyle = '#d83a2a';
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 4, -12, 2.6, 3.4, sx * .2, 0, TAU); g.fill(); }
    // antennes
    g.strokeStyle = '#1a1208'; g.lineWidth = 1.6;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 3, -18); g.lineTo(sx * 7, -26); g.stroke(); }
    cache.set(key, cv);
    return cv;
  }


