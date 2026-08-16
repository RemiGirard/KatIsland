/* ============================================================
   GRIFFES & PLUMES — sprites-armor.js (4/9)
   Armure/robe/gilet/combinaison/bouclier — les 10 lignes de forge.
   ============================================================ */
"use strict";

  // ------------------------------------------------------------
  // API : getArmorIcon — plastron stylisé mignon
  // ------------------------------------------------------------
  function getArmorIcon(tier, faction, size) {
    size = size || 72;
    tier = clamp(tier | 0, 0, SGD.ARMORS.length - 1);
    faction = faction === 'birds' ? 'birds' : 'cats';
    const key = 'a|' + tier + '|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;

    const ar = SGD.ARMORS[tier];
    // paliers RELATIFS à la longueur de ligne (§3 D16) : les détails
    // (liseré, rivets, métal, scintillement) s'étalent sur toute la ligne ;
    // la teinte s'intensifie à l'intérieur d'un palier (rang à rang).
    const pi = garmentPalierInfo(tier, SGD.ARMORS.length);
    const pal = pi.pal;
    const capeC = SGD.shade(ar.capeC, pi.sub * 0.12);
    const metal = SGD.shade(ar.metalC || SGD.shade(capeC, -0.18), pi.sub * 0.08);
    const acc = SGD.FACTIONS[faction].acc;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 72, size / 72);
    g.lineJoin = 'round'; g.lineCap = 'round';

    // (VAGUE OMBRES) plus d'ombre propre à la pièce d'équipement : seul le
    // PERSONNAGE porte la sienne, au sol. Les armes n'en ont jamais eu.

    // torse : trapèze arrondi, épaules larges, taille resserrée
    const grad = g.createLinearGradient(0, 12, 0, 62);
    grad.addColorStop(0, SGD.shade(capeC, 0.28));
    grad.addColorStop(0.55, capeC);
    grad.addColorStop(1, SGD.shade(capeC, -0.3));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(15, 16);
    g.quadraticCurveTo(36, 10, 57, 16);
    g.quadraticCurveTo(58, 36, 50, 50);
    g.quadraticCurveTo(44, 60, 36, 61);
    g.quadraticCurveTo(28, 60, 22, 50);
    g.quadraticCurveTo(14, 36, 15, 16);
    g.closePath();
    g.fill();
    // liseré (palier 1+)
    if (pal >= 1) {
      g.strokeStyle = SGD.shade(capeC, 0.5); g.lineWidth = 2.2;
      g.stroke();
    } else {
      g.strokeStyle = SGD.shade(capeC, -0.4); g.lineWidth = 1.2;
      g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1;
    }

    // encolure
    g.fillStyle = SGD.shade(capeC, -0.35);
    g.beginPath();
    g.ellipse(36, 15.5, 8.5, 4.5, 0, 0, Math.PI);
    g.fill();

    // reflet du plastron
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath();
    g.ellipse(28, 28, 7, 12, 0.3, 0, TAU);
    g.fill();

    // épaulières (métal au palier 3+, sinon tissu)
    for (const s of [-1, 1]) {
      const px = 36 + s * 21;
      const pc = pal >= 3 ? metal : SGD.shade(capeC, 0.12);
      const pg = g.createLinearGradient(px, 12, px, 26);
      pg.addColorStop(0, SGD.shade(pc, 0.35));
      pg.addColorStop(1, SGD.shade(pc, -0.3));
      g.fillStyle = pg;
      g.beginPath();
      g.ellipse(px, 19, 8, 6.5, s * 0.25, 0, TAU);
      g.fill();
      g.strokeStyle = SGD.shade(pc, -0.4); g.lineWidth = 1;
      g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
    }

    // rivets (palier 2+)
    if (pal >= 2) {
      g.fillStyle = SGD.shade(metal, 0.3);
      for (const p of [[22, 22], [50, 22], [24, 42], [48, 42]]) {
        g.beginPath(); g.arc(p[0], p[1], 1.6, 0, TAU); g.fill();
      }
    }

    // emblème central de faction
    g.fillStyle = acc;
    g.beginPath(); g.arc(36, 36, 6.2, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    if (faction === 'cats') {
      // petite empreinte de patte
      g.beginPath(); g.arc(36, 37.5, 2.4, 0, TAU); g.fill();
      for (const a of [-0.7, 0, 0.7]) {
        g.beginPath();
        g.arc(36 + Math.sin(a) * 3.4, 34.2 + Math.abs(a) * 1.1, 1.1, 0, TAU);
        g.fill();
      }
    } else {
      // petite plume
      g.save();
      g.translate(36, 36); g.rotate(-0.6);
      g.beginPath();
      g.moveTo(0, -4);
      g.quadraticCurveTo(3, -1, 0, 4.2);
      g.quadraticCurveTo(-3, -1, 0, -4);
      g.closePath(); g.fill();
      g.restore();
    }

    // ceinture
    g.fillStyle = SGD.shade(capeC, -0.42);
    g.beginPath();
    g.moveTo(23, 51); g.quadraticCurveTo(36, 56, 49, 51);
    g.quadraticCurveTo(36, 60, 23, 51);
    g.closePath(); g.fill();

    // scintillement (palier 4)
    if (pal >= 4) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.1; g.lineCap = 'round';
      for (const p of [[46, 26, 2.6], [27, 46, 2.0], [42, 18, 1.6]]) {
        g.globalAlpha = 0.9;
        g.beginPath();
        g.moveTo(p[0] - p[2], p[1]); g.lineTo(p[0] + p[2], p[1]);
        g.moveTo(p[0], p[1] - p[2]); g.lineTo(p[0], p[1] + p[2]);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // §5 D15 / §3 D16 — vêtements de catégorie PAR TIER : ROBES (magie),
  // VESTS (tir), SUITS (explosif). Même gabarit de torse 72×72 que
  // getArmorIcon (le billboard 'gamearmor' les pose à l'identique sur
  // l'unité) ; 5 PALIERS visuels RELATIFS à la longueur de la ligne
  // (palier = floor(tier×5/len)) : les 5 matériaux s'étalent sur toute
  // la ligne quelle que soit sa longueur (15, 40…). `sub` (0..1) est la
  // progression À L'INTÉRIEUR du palier : la teinte s'intensifie d'un
  // rang à l'autre sans changer de matériau — proche mais pas identique.
  // ------------------------------------------------------------
  function garmentPalierInfo(tier, len) {
    len = Math.max(1, len | 0);
    const u = clamp(tier, 0, len - 1) * 5 / len;
    const pal = Math.min(4, Math.floor(u));
    return { pal, sub: clamp(u - pal, 0, 1) };
  }
  // signatures souples : f(tier, size) OU f(tier, faction, size) (pattern getArmorIcon)
  function garmentArgs(tier, faction, size, line) {
    if (typeof faction === 'number' && size == null) { size = faction; faction = 'cats'; }
    return {
      tier: clamp(tier | 0, 0, (line ? line.length : 1) - 1),
      faction: faction === 'birds' ? 'birds' : 'cats',
      size: size || 72,
    };
  }
  // petit emblème de faction (patte / plume), même langage que getArmorIcon
  function drawFactionMark(g, faction, x, y, r) {
    g.fillStyle = SGD.FACTIONS[faction].acc;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    const k = r / 6.2;
    if (faction === 'cats') {
      g.beginPath(); g.arc(x, y + 1.5 * k, 2.4 * k, 0, TAU); g.fill();
      for (const a of [-0.7, 0, 0.7]) {
        g.beginPath();
        g.arc(x + Math.sin(a) * 3.4 * k, y - 1.8 * k + Math.abs(a) * 1.1 * k, 1.1 * k, 0, TAU);
        g.fill();
      }
    } else {
      g.save(); g.translate(x, y); g.rotate(-0.6); g.scale(k, k);
      g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(3, -1, 0, 4.2);
      g.quadraticCurveTo(-3, -1, 0, -4); g.closePath(); g.fill();
      g.restore();
    }
  }
  function drawGarmentSparkles(g, pts) {
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.1; g.lineCap = 'round';
    g.globalAlpha = 0.9;
    for (const p of pts) {
      g.beginPath();
      g.moveTo(p[0] - p[2], p[1]); g.lineTo(p[0] + p[2], p[1]);
      g.moveTo(p[0], p[1] - p[2]); g.lineTo(p[0], p[1] + p[2]);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // ------------------------------------------------------------
  // API : getRobeIcon — robe LONGUE de mage par tier.
  // Paliers : toile brute → teinte + ceinture → liserés → runes → astral.
  // Capuche légère (style.hood) posée en col, jamais sur la tête.
  // ------------------------------------------------------------
  function getRobeIcon(tier, faction, size) {
    const na = garmentArgs(tier, faction, size, SGD.ROBES);
    tier = na.tier; faction = na.faction; size = na.size;
    const key = 'gr|' + tier + '|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;

    const st = (SGD.ROBES && SGD.ROBES[tier].style) || {};
    const pi = garmentPalierInfo(tier, (SGD.ROBES && SGD.ROBES.length) || 1);
    const pal = pi.pal;
    // teinte qui s'intensifie à l'intérieur du palier (progression rang à rang)
    const tint = SGD.shade(st.tint || '#b8a888', pi.sub * 0.12);
    const trim = SGD.shade(st.trim || SGD.shade(tint, -0.3), pi.sub * 0.10);
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 72, size / 72);
    g.lineJoin = 'round'; g.lineCap = 'round';

    // (VAGUE OMBRES) plus d'ombre propre à la pièce d'équipement : seul le
    // PERSONNAGE porte la sienne, au sol. Les armes n'en ont jamais eu.

    // silhouette : épaules douces, jupe qui s'évase jusqu'à l'ourlet
    const robePath = () => {
      g.beginPath();
      g.moveTo(21, 15);
      g.quadraticCurveTo(36, 10, 51, 15);
      g.quadraticCurveTo(54, 38, 58, 62);
      g.quadraticCurveTo(47, 67, 36, 67);
      g.quadraticCurveTo(25, 67, 14, 62);
      g.quadraticCurveTo(18, 38, 21, 15);
      g.closePath();
    };
    const grad = g.createLinearGradient(0, 10, 0, 67);
    grad.addColorStop(0, SGD.shade(tint, 0.26));
    grad.addColorStop(0.55, tint);
    grad.addColorStop(1, SGD.shade(tint, -0.3));
    g.fillStyle = grad;
    robePath(); g.fill();

    // contour : liseré trim clair dès le palier 2, sinon ombre discrète
    if (pal >= 2) {
      g.strokeStyle = SGD.shade(trim, 0.25); g.lineWidth = 2;
      robePath(); g.stroke();
    } else {
      g.strokeStyle = SGD.shade(tint, -0.4); g.lineWidth = 1.2;
      g.globalAlpha = 0.5; robePath(); g.stroke(); g.globalAlpha = 1;
    }

    // tombé du tissu : deux plis verticaux doux
    g.strokeStyle = SGD.shade(tint, -0.22); g.lineWidth = 1.2; g.globalAlpha = 0.55;
    for (const px of [28, 44]) {
      g.beginPath(); g.moveTo(px, 30); g.quadraticCurveTo(px + (px < 36 ? -2 : 2), 48, px + (px < 36 ? -3 : 3), 63);
      g.stroke();
    }
    g.globalAlpha = 1;

    if (pal === 0) {
      // toile brute : reprises cousues + cordelette nouée
      g.strokeStyle = SGD.shade(tint, -0.45); g.lineWidth = 1; g.globalAlpha = 0.8;
      for (const p of [[25, 34, 5, 2], [44, 50, 5, -2], [33, 58, 4, 1]]) {
        g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + p[2], p[1] + p[3]); g.stroke();
        for (let i = 0; i <= 2; i++) {
          const x = p[0] + p[2] * i / 2, y = p[1] + p[3] * i / 2;
          g.beginPath(); g.moveTo(x, y - 1.4); g.lineTo(x, y + 1.4); g.stroke();
        }
      }
      g.globalAlpha = 1;
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(20, 37); g.quadraticCurveTo(36, 41, 52, 37); g.stroke();
      g.fillStyle = '#6a4e2e';
      g.beginPath(); g.arc(36, 39.5, 1.8, 0, TAU); g.fill();
    } else {
      // teinte colorée : reflet satiné + large ceinture d'étoffe trim
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.ellipse(28, 27, 6, 11, 0.28, 0, TAU); g.fill();
      g.fillStyle = trim;
      g.beginPath();
      g.moveTo(19.5, 35); g.quadraticCurveTo(36, 39, 52.5, 35);
      g.lineTo(52.9, 40); g.quadraticCurveTo(36, 44, 19.1, 40);
      g.closePath(); g.fill();
      g.strokeStyle = SGD.shade(trim, -0.35); g.lineWidth = 0.9; g.globalAlpha = 0.7;
      g.beginPath(); g.moveTo(19.5, 35); g.quadraticCurveTo(36, 39, 52.5, 35); g.stroke();
      g.globalAlpha = 1;
    }

    // liserés : galon central de l'encolure à l'ourlet + galon d'ourlet
    if (pal >= 2) {
      g.strokeStyle = SGD.shade(trim, 0.25); g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(36, 17); g.lineTo(36, 66); g.stroke();
      g.beginPath(); g.moveTo(16, 61); g.quadraticCurveTo(36, 66, 56, 61); g.stroke();
    }

    // runes brodées le long de l'ourlet (palier 4 : elles s'illuminent)
    if (pal >= 3) {
      const runeC = SGD.shade(trim, pal >= 4 ? 0.45 : 0.2);
      g.strokeStyle = runeC; g.lineWidth = 1.3; g.globalAlpha = 0.95;
      for (const r of [[25, 53], [36, 56], [47, 53]]) {
        g.beginPath();
        g.moveTo(r[0], r[1] - 2.6); g.lineTo(r[0], r[1] + 2.6);
        g.moveTo(r[0], r[1] - 1.2); g.lineTo(r[0] + 2.4, r[1] - 2.8);
        g.moveTo(r[0], r[1] + 0.6); g.lineTo(r[0] + 2.4, r[1] + 2.4);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // astral (palier 4) : voûte étoilée sur la jupe + scintillements
    if (pal >= 4) {
      g.fillStyle = SGD.shade(trim, 0.5);
      for (const p of [[24, 44], [43, 48], [31, 60], [50, 57], [39, 30]]) {
        g.beginPath(); g.arc(p[0], p[1], 0.9, 0, TAU); g.fill();
      }
      drawGarmentSparkles(g, [[46, 26, 2.4], [26, 50, 2.0], [40, 62, 1.6]]);
    }

    // capuche légère rabattue en col (tiers hauts — jamais sur la tête)
    if (st.hood) {
      g.fillStyle = SGD.shade(tint, -0.12);
      g.beginPath(); g.ellipse(36, 13.5, 11.5, 4.6, 0, Math.PI, TAU); g.fill();
      g.strokeStyle = pal >= 2 ? SGD.shade(trim, 0.25) : SGD.shade(tint, -0.35);
      g.lineWidth = 1.1; g.globalAlpha = 0.8;
      g.beginPath(); g.ellipse(36, 13.5, 11.5, 4.6, 0, Math.PI, TAU); g.stroke();
      g.globalAlpha = 1;
    }

    // encolure
    g.fillStyle = SGD.shade(tint, -0.38);
    g.beginPath(); g.ellipse(36, 15.5, 7.5, 3.8, 0, 0, Math.PI); g.fill();

    // broche-emblème de faction sur la poitrine
    drawFactionMark(g, faction, 36, 27, 4.6);

    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getVestIcon — gilet COURT de tireur à sangles par tier.
  // Paliers : cuir simple → renforts → poches/carquois → plaques → high-tech.
  // ------------------------------------------------------------
  function getVestIcon(tier, faction, size) {
    const na = garmentArgs(tier, faction, size, SGD.VESTS);
    tier = na.tier; faction = na.faction; size = na.size;
    const key = 'gv|' + tier + '|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;

    const st = (SGD.VESTS && SGD.VESTS[tier].style) || {};
    const pi = garmentPalierInfo(tier, (SGD.VESTS && SGD.VESTS.length) || 1);
    const pal = pi.pal;
    // teinte qui s'intensifie à l'intérieur du palier (progression rang à rang)
    const tint = SGD.shade(st.tint || '#8a9a6a', pi.sub * 0.12);
    const trim = SGD.shade(st.trim || SGD.shade(tint, -0.3), pi.sub * 0.10);
    const metal = SGD.shade('#aab6c4', pi.sub * 0.08);
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 72, size / 72);
    g.lineJoin = 'round'; g.lineCap = 'round';

    // (VAGUE OMBRES) plus d'ombre propre à la pièce d'équipement : seul le
    // PERSONNAGE porte la sienne, au sol. Les armes n'en ont jamais eu.

    // gilet court : épaules larges, ourlet droit au-dessus de la taille
    const vestPath = () => {
      g.beginPath();
      g.moveTo(16, 16);
      g.quadraticCurveTo(36, 10, 56, 16);
      g.quadraticCurveTo(57, 34, 53, 50);
      g.quadraticCurveTo(36, 55, 19, 50);
      g.quadraticCurveTo(15, 34, 16, 16);
      g.closePath();
    };
    const grad = g.createLinearGradient(0, 10, 0, 55);
    grad.addColorStop(0, SGD.shade(tint, 0.26));
    grad.addColorStop(0.55, tint);
    grad.addColorStop(1, SGD.shade(tint, -0.28));
    g.fillStyle = grad;
    vestPath(); g.fill();
    if (pal >= 2) {
      g.strokeStyle = SGD.shade(trim, 0.25); g.lineWidth = 2;
      vestPath(); g.stroke();
    } else {
      g.strokeStyle = SGD.shade(tint, -0.4); g.lineWidth = 1.2;
      g.globalAlpha = 0.5; vestPath(); g.stroke(); g.globalAlpha = 1;
    }

    // ouverture frontale : chemise sombre + laçage
    g.fillStyle = SGD.shade(tint, -0.45);
    g.beginPath();
    g.moveTo(32, 14.5); g.lineTo(40, 14.5);
    g.lineTo(39, 53); g.lineTo(33, 53);
    g.closePath(); g.fill();
    g.strokeStyle = SGD.shade(tint, 0.35); g.lineWidth = 1; g.globalAlpha = 0.85;
    for (const y of [22, 30, 38, 45]) {
      g.beginPath(); g.moveTo(32.6, y); g.lineTo(39.4, y + 2); g.stroke();
    }
    g.globalAlpha = 1;

    // couture d'épaule (cuir simple : la base respire déjà l'atelier)
    g.strokeStyle = SGD.shade(tint, -0.3); g.lineWidth = 0.9; g.globalAlpha = 0.6;
    g.beginPath(); g.moveTo(18, 20); g.quadraticCurveTo(36, 15, 54, 20); g.stroke();
    g.globalAlpha = 1;

    // renforts d'épaules matelassés (palier 1+)
    if (pal >= 1) {
      for (const s of [-1, 1]) {
        const px = 36 + s * 15;
        g.fillStyle = SGD.shade(tint, -0.2);
        g.beginPath(); g.ellipse(px, 17.5, 7, 4.6, s * 0.2, 0, TAU); g.fill();
        g.strokeStyle = SGD.shade(tint, -0.42); g.lineWidth = 0.9; g.globalAlpha = 0.7;
        g.beginPath(); g.ellipse(px, 17.5, 7, 4.6, s * 0.2, 0, TAU); g.stroke();
        g.globalAlpha = 1;
      }
    }

    // poches plaquées + carquois stylisé (palier 2+)
    if (pal >= 2) {
      for (const px of [20, 43]) {
        g.fillStyle = SGD.shade(tint, 0.12);
        roundRectPath(g, px, 40, 9, 8, 1.8); g.fill();
        g.fillStyle = SGD.shade(tint, -0.28);
        roundRectPath(g, px, 40, 9, 3.2, 1.6); g.fill();
        g.strokeStyle = SGD.shade(tint, -0.4); g.lineWidth = 0.8; g.globalAlpha = 0.7;
        roundRectPath(g, px, 40, 9, 8, 1.8); g.stroke(); g.globalAlpha = 1;
      }
      // mini-carquois en travers de l'épaule droite : 3 empennes qui dépassent
      g.save(); g.translate(49, 20); g.rotate(0.5);
      g.fillStyle = '#5a4630';
      roundRectPath(g, -3, -2, 6, 9, 2); g.fill();
      g.strokeStyle = trim; g.lineWidth = 1.2;
      for (const fx of [-1.6, 0, 1.6]) {
        g.beginPath(); g.moveTo(fx, -2); g.lineTo(fx * 1.5, -6.4); g.stroke();
      }
      g.restore();
    }

    // sangle en bandoulière + boucle (signature de la ligne, tous tiers)
    g.strokeStyle = pal >= 4 ? SGD.shade(trim, -0.1) : '#4e3a26';
    g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(21, 14); g.lineTo(50, 50); g.stroke();
    g.fillStyle = pal >= 3 ? SGD.shade(metal, 0.15) : '#8a7a5a';
    g.save(); g.translate(37.5, 34.5); g.rotate(0.88);
    roundRectPath(g, -3, -2.4, 6, 4.8, 1); g.fill();
    g.restore();

    // plaques légères de poitrine (palier 3+)
    if (pal >= 3) {
      for (const px of [20, 42]) {
        const pg = g.createLinearGradient(px, 25, px, 37);
        pg.addColorStop(0, SGD.shade(metal, 0.3));
        pg.addColorStop(1, SGD.shade(metal, -0.25));
        g.fillStyle = pg;
        roundRectPath(g, px, 25, 10, 12, 2.4); g.fill();
        g.strokeStyle = SGD.shade(metal, -0.4); g.lineWidth = 0.9; g.globalAlpha = 0.7;
        roundRectPath(g, px, 25, 10, 12, 2.4); g.stroke(); g.globalAlpha = 1;
        g.fillStyle = SGD.shade(metal, 0.35);
        for (const rv of [[px + 2, 27], [px + 8, 27], [px + 2, 35], [px + 8, 35]]) {
          g.beginPath(); g.arc(rv[0], rv[1], 0.9, 0, TAU); g.fill();
        }
      }
    }

    // high-tech (palier 4) : lisérés lumineux + cœur d'énergie
    if (pal >= 4) {
      g.strokeStyle = SGD.shade(trim, 0.4); g.lineWidth = 1.4; g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(19.5, 48); g.quadraticCurveTo(36, 53, 52.5, 48); g.stroke();
      g.beginPath(); g.moveTo(18, 24); g.lineTo(18.8, 40); g.stroke();
      g.beginPath(); g.moveTo(54, 24); g.lineTo(53.2, 40); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = SGD.shade(trim, 0.5);
      g.beginPath(); g.arc(37.5, 34.5, 1.6, 0, TAU); g.fill();
      drawGarmentSparkles(g, [[47, 27, 2.2], [25, 46, 1.8]]);
    }

    // encolure
    g.fillStyle = SGD.shade(tint, -0.38);
    g.beginPath(); g.ellipse(36, 15, 7.5, 3.6, 0, 0, Math.PI); g.fill();

    // insigne de faction sur le pan gauche
    drawFactionMark(g, faction, 26, 21, 3.8);

    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getSuitIcon — combinaison d'artificier par tier.
  // Paliers : tablier → rembourrage → bandes réfléchissantes → casque-col
  // (autour du cou, JAMAIS sur la tête) → blindage.
  // ------------------------------------------------------------
  function getSuitIcon(tier, faction, size) {
    const na = garmentArgs(tier, faction, size, SGD.SUITS);
    tier = na.tier; faction = na.faction; size = na.size;
    const key = 'gs|' + tier + '|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;

    const st = (SGD.SUITS && SGD.SUITS[tier].style) || {};
    const pi = garmentPalierInfo(tier, (SGD.SUITS && SGD.SUITS.length) || 1);
    const pal = pi.pal;
    // teinte qui s'intensifie à l'intérieur du palier (progression rang à rang)
    const tint = SGD.shade(st.tint || '#8a6a52', pi.sub * 0.12);
    const trim = SGD.shade(st.trim || SGD.shade(tint, -0.3), pi.sub * 0.10);
    const metal = SGD.shade('#9aa6b2', pi.sub * 0.08);
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 72, size / 72);
    g.lineJoin = 'round'; g.lineCap = 'round';

    // (VAGUE OMBRES) plus d'ombre propre à la pièce d'équipement : seul le
    // PERSONNAGE porte la sienne, au sol. Les armes n'en ont jamais eu.

    // torse complet, même trapèze que le plastron d'armure
    const suitPath = () => {
      g.beginPath();
      g.moveTo(15, 16);
      g.quadraticCurveTo(36, 10, 57, 16);
      g.quadraticCurveTo(58, 36, 50, 50);
      g.quadraticCurveTo(44, 60, 36, 61);
      g.quadraticCurveTo(28, 60, 22, 50);
      g.quadraticCurveTo(14, 36, 15, 16);
      g.closePath();
    };
    const grad = g.createLinearGradient(0, 12, 0, 62);
    grad.addColorStop(0, SGD.shade(tint, 0.26));
    grad.addColorStop(0.55, tint);
    grad.addColorStop(1, SGD.shade(tint, -0.3));
    g.fillStyle = grad;
    suitPath(); g.fill();
    if (pal >= 2) {
      g.strokeStyle = SGD.shade(trim, 0.25); g.lineWidth = 2;
      suitPath(); g.stroke();
    } else {
      g.strokeStyle = SGD.shade(tint, -0.4); g.lineWidth = 1.2;
      g.globalAlpha = 0.5; suitPath(); g.stroke(); g.globalAlpha = 1;
    }

    // rembourrage capitonné (palier 1+) : bandes horizontales moelleuses
    if (pal >= 1) {
      g.strokeStyle = SGD.shade(tint, -0.25); g.lineWidth = 1.1; g.globalAlpha = 0.55;
      for (const y of [24, 32, 40, 48]) {
        g.beginPath(); g.moveTo(18, y); g.quadraticCurveTo(36, y + 2.4, 54 - (y - 24) * 0.18, y); g.stroke();
      }
      g.globalAlpha = 1;
      g.strokeStyle = SGD.shade(tint, 0.3); g.lineWidth = 0.8; g.globalAlpha = 0.5;
      for (const y of [23, 31, 39, 47]) {
        g.beginPath(); g.moveTo(19, y); g.quadraticCurveTo(36, y + 2.2, 53, y); g.stroke();
      }
      g.globalAlpha = 1;
    }

    // TABLIER frontal + bretelles (signature de la ligne, tous tiers)
    g.fillStyle = SGD.shade(tint, -0.15);
    roundRectPath(g, 27, 21, 18, 35, 4); g.fill();
    g.strokeStyle = SGD.shade(tint, -0.4); g.lineWidth = 1; g.globalAlpha = 0.7;
    roundRectPath(g, 27, 21, 18, 35, 4); g.stroke(); g.globalAlpha = 1;
    g.strokeStyle = SGD.shade(tint, -0.42); g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(30, 21); g.lineTo(26, 13.5); g.stroke();
    g.beginPath(); g.moveTo(42, 21); g.lineTo(46, 13.5); g.stroke();

    if (pal === 0) {
      // tablier roussi : brûlures + pièce recousue
      g.fillStyle = 'rgba(40,28,18,0.4)';
      for (const b of [[32, 46, 2.6], [41, 36, 1.9], [37, 52, 1.5]]) {
        g.beginPath(); g.arc(b[0], b[1], b[2], 0, TAU); g.fill();
      }
      g.strokeStyle = SGD.shade(tint, -0.45); g.lineWidth = 0.9; g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(30, 29); g.lineTo(35, 31); g.stroke();
      for (let i = 0; i <= 2; i++) {
        g.beginPath(); g.moveTo(30 + 2.5 * i, 28 + i * 0.9); g.lineTo(30 + 2.5 * i, 31.4 + i * 0.9); g.stroke();
      }
      g.globalAlpha = 1;
    }

    // bandes réfléchissantes (palier 2+) : deux diagonales jaune sécurité
    if (pal >= 2) {
      for (const y0 of [34, 44]) {
        g.save();
        suitPath(); g.clip();
        g.fillStyle = '#ffd75a';
        g.beginPath();
        g.moveTo(15, y0 + 6); g.lineTo(57, y0 - 4);
        g.lineTo(57, y0); g.lineTo(15, y0 + 10);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(15, y0 + 8); g.lineTo(57, y0 - 2); g.stroke();
        g.restore();
      }
    }

    // ceinture d'outillage
    g.fillStyle = SGD.shade(tint, -0.42);
    g.beginPath();
    g.moveTo(23, 51); g.quadraticCurveTo(36, 56, 49, 51);
    g.quadraticCurveTo(36, 60, 23, 51);
    g.closePath(); g.fill();
    g.fillStyle = pal >= 3 ? SGD.shade(metal, 0.2) : '#8a7a5a';
    roundRectPath(g, 33, 51.5, 6, 4, 1); g.fill();

    // casque-col (palier 3+) : anneau matelassé-métal AUTOUR DU COU
    if (pal >= 3) {
      g.strokeStyle = SGD.shade(metal, -0.15); g.lineWidth = 3.6;
      g.beginPath(); g.ellipse(36, 15, 10.5, 4.4, 0, 0, TAU); g.stroke();
      g.strokeStyle = SGD.shade(metal, 0.3); g.lineWidth = 1.2; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(36, 14.2, 10.5, 4.2, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.globalAlpha = 1;
    }

    // blindage (palier 4) : plaques d'épaules + rivets + scintillement
    if (pal >= 4) {
      for (const s of [-1, 1]) {
        const px = 36 + s * 17;
        const pg = g.createLinearGradient(px, 14, px, 26);
        pg.addColorStop(0, SGD.shade(metal, 0.35));
        pg.addColorStop(1, SGD.shade(metal, -0.3));
        g.fillStyle = pg;
        g.beginPath(); g.ellipse(px, 19.5, 7.2, 6, s * 0.25, 0, TAU); g.fill();
        g.strokeStyle = SGD.shade(metal, -0.4); g.lineWidth = 1;
        g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
      }
      g.fillStyle = SGD.shade(metal, 0.3);
      for (const p of [[22, 30], [50, 30], [24, 44], [48, 44]]) {
        g.beginPath(); g.arc(p[0], p[1], 1.4, 0, TAU); g.fill();
      }
      drawGarmentSparkles(g, [[46, 26, 2.4], [27, 40, 1.9]]);
    }

    // encolure (sous le col)
    if (pal < 3) {
      g.fillStyle = SGD.shade(tint, -0.38);
      g.beginPath(); g.ellipse(36, 15.5, 8, 4, 0, 0, Math.PI); g.fill();
    }

    // badge de faction sur la bavette du tablier
    drawFactionMark(g, faction, 36, 27, 4.2);

    cache.set(key, cv);
    return cv;
  }

  // ------------------------------------------------------------
  // API : getShieldIcon — bouclier de la garde PAR TIER (§2 D17).
  // 3 shapes (round = rondache / kite = écu / tower = pavois), umbo central,
  // liseré trim, emblème patte/plume de faction. 5 paliers de matériaux
  // RELATIFS à la longueur de ligne (garmentPalierInfo) : bois brut →
  // rivets → double liseré → renforts métal → scintillement ; la teinte
  // s'intensifie à l'intérieur du palier. Signature souple (tier, size)
  // OU (tier, faction, size), pattern getArmorIcon.
  // ------------------------------------------------------------
  function getShieldIcon(tier, faction, size) {
    const na = garmentArgs(tier, faction, size, SGD.SHIELDS);
    tier = na.tier; faction = na.faction; size = na.size;
    const key = 'shl|' + tier + '|' + faction + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;

    const st = (SGD.SHIELDS && SGD.SHIELDS[tier].style) || {};
    const pi = garmentPalierInfo(tier, (SGD.SHIELDS && SGD.SHIELDS.length) || 1);
    const pal = pi.pal;
    // teinte qui s'intensifie à l'intérieur du palier (progression rang à rang)
    const tint = SGD.shade(st.tint || '#8a8f98', pi.sub * 0.12);
    const trim = SGD.shade(st.trim || SGD.shade(tint, -0.3), pi.sub * 0.10);
    const shape = st.shape || 'round';
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 72, size / 72);
    g.lineJoin = 'round'; g.lineCap = 'round';

    // (VAGUE OMBRES) plus d'ombre propre à la pièce d'équipement : seul le
    // PERSONNAGE porte la sienne, au sol. Les armes n'en ont jamais eu.

    // silhouette : rondache / écu / pavois-tour
    const path = () => {
      g.beginPath();
      if (shape === 'round') {
        g.arc(36, 37, 25, 0, TAU);
      } else if (shape === 'kite') {
        g.moveTo(36, 10);
        g.quadraticCurveTo(58, 14, 59, 24);
        g.quadraticCurveTo(58, 44, 36, 66);
        g.quadraticCurveTo(14, 44, 13, 24);
        g.quadraticCurveTo(14, 14, 36, 10);
        g.closePath();
      } else {   // tower : pavois haut à sommet cintré
        g.moveTo(15, 16);
        g.quadraticCurveTo(36, 8, 57, 16);
        g.lineTo(57, 56);
        g.quadraticCurveTo(48, 64, 36, 66);
        g.quadraticCurveTo(24, 64, 15, 56);
        g.closePath();
      }
    };
    const cy = shape === 'kite' ? 33 : (shape === 'tower' ? 38 : 37);

    // fond bombé
    const grad = g.createLinearGradient(0, 8, 0, 66);
    grad.addColorStop(0, SGD.shade(tint, 0.28));
    grad.addColorStop(0.55, tint);
    grad.addColorStop(1, SGD.shade(tint, -0.3));
    g.fillStyle = grad;
    path(); g.fill();

    // reflet satiné
    g.fillStyle = 'rgba(255,255,255,0.20)';
    g.beginPath(); g.ellipse(29, cy - 8, 7, 11, 0.3, 0, TAU); g.fill();

    // palier 0 : planches brutes + éraflures de service
    if (pal === 0) {
      path(); g.save(); g.clip();
      g.strokeStyle = SGD.shade(tint, -0.35); g.lineWidth = 1.1; g.globalAlpha = 0.55;
      for (const px of [26, 36, 46]) {
        g.beginPath(); g.moveTo(px, 8); g.lineTo(px, 68); g.stroke();
      }
      g.beginPath(); g.moveTo(22, 46); g.lineTo(30, 52); g.stroke();
      g.beginPath(); g.moveTo(44, 24); g.lineTo(50, 30); g.stroke();
      g.restore(); g.globalAlpha = 1;
    }

    // liseré trim (net dès le palier 1, sinon ombre discrète)
    path();
    if (pal >= 1) {
      g.strokeStyle = SGD.shade(trim, 0.2); g.lineWidth = 2.6; g.stroke();
    } else {
      g.strokeStyle = SGD.shade(tint, -0.4); g.lineWidth = 1.4;
      g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
    }

    // double liseré intérieur (palier 2+)
    if (pal >= 2) {
      g.save();
      g.translate(36, cy); g.scale(0.84, 0.84); g.translate(-36, -cy);
      path();
      g.restore();
      g.strokeStyle = SGD.shade(trim, -0.1); g.lineWidth = 1.2;
      g.globalAlpha = 0.8; g.stroke(); g.globalAlpha = 1;
    }

    // rivets du pourtour (palier 1+)
    if (pal >= 1) {
      const rivets = shape === 'round'
        ? [[36, 16], [56, 37], [36, 58], [16, 37]]
        : shape === 'kite'
          ? [[36, 14], [54, 24], [36, 60], [18, 24]]
          : [[20, 20], [52, 20], [20, 52], [52, 52]];
      g.fillStyle = SGD.shade(trim, 0.35);
      for (const p of rivets) {
        g.beginPath(); g.arc(p[0], p[1], 1.7, 0, TAU); g.fill();
      }
    }

    // renforts métal horizontaux (palier 3+)
    if (pal >= 3) {
      path(); g.save(); g.clip();
      g.fillStyle = rgba(SGD.shade(trim, -0.1), 0.5);
      g.fillRect(10, cy - 13, 52, 3.4);
      g.fillRect(10, cy + 9, 52, 3.4);
      g.restore();
    }

    // umbo central : bosse métallique bombée
    const uy = cy + 4;
    const ug = g.createRadialGradient(34, uy - 2, 1, 36, uy, 7.4);
    ug.addColorStop(0, SGD.shade(trim, 0.5));
    ug.addColorStop(0.6, trim);
    ug.addColorStop(1, SGD.shade(trim, -0.4));
    g.fillStyle = ug;
    g.beginPath(); g.arc(36, uy, 7, 0, TAU); g.fill();
    g.strokeStyle = SGD.shade(trim, -0.45); g.lineWidth = 1;
    g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.arc(33.8, uy - 2.2, 1.5, 0, TAU); g.fill();

    // emblème de faction (patte / plume) au-dessus de l'umbo
    drawFactionMark(g, faction, 36, cy - 11, 5);

    // scintillement (palier 4)
    if (pal >= 4) {
      drawGarmentSparkles(g, [[24, cy - 6, 2.2], [50, cy + 2, 2.4], [36, cy + 16, 1.8]]);
    }

    cache.set(key, cv);
    return cv;
  }


