/* ============================================================
   GRIFFES & PLUMES — adventure.js
   L'ARÈNE DE L'AVENTURE — le combat tactique de l'onglet .

   LA SALLE EST UN CARRÉ de 13×13 carreaux. Les aventuriers entrent par le
   bas, les ennemis tiennent le reste. Salle nettoyée → étage suivant.

   Rendu : sprites pseudo-3D orientés, ombre portée, tri par profondeur,
   fond pré-rendu sur offscreen canvas, particules atmosphériques.

   Deux modes :
     - MANUEL : clic sur unité pour sélectionner, clic sol pour déplacer,
       clic droit = ordre, capacités au clavier/bouton. Auto-attack conservé.
     - AUTO : IA par POSTURE (stance) — chaque classe a son comportement.

   -> window.Adventure
   ============================================================ */
"use strict";

  (function () {
    const A = {};
    let arena = null;
    let canvas = null, ctx = null;
    let bgCanvas = null, bgCtx = null;   // offscreen static layer
    let onEnd = null;
    let onTowerClick = null;   // callback quand on clique la tour au camp
    const GRID_W = 16, GRID_H = 13;   // arène rectangulaire : plus large que haute
    let CELL = 34;
    // GABARIT DES UNITÉS — fraction de carreau qu'occupe une unité, FIXE quelle
    // que soit la taille de la fenêtre (cf. drawUnit). Monter cette valeur
    // grossit toute la troupe, ennemis compris ; la descendre l'affine.
    const UNIT_GAUGE = 32 / 34;
    let W = GRID_W * CELL, H = GRID_H * CELL;
    let particles = [];                    // atmospheric particles (pooled)
    let shakeT = 0, shakeMag = 0;         // screen shake
    let hoverUnit = null;                  // hovered unit (manual mode)
    let dragStart = null, dragEnd = null;  // box-select

    const AD = () => window.GameData;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const sfx = n => { try { if (window.FX && FX.sfx) FX.sfx(n); } catch (e) { } };

    function rngOf(seed) {
      let a = (seed >>> 0) || 1;
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }


    // éclaircir / assombrir une couleur #rrggbb — sert au décor et aux bêtes
    function shade(hex, k) {
      const n = parseInt((hex || '#888888').slice(1), 16);
      const c = v => Math.max(0, Math.min(255, Math.round(v * k)));
      return 'rgb(' + c((n >> 16) & 255) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
    }

    // ------------------------------------------------------------
    // LE MOBILIER DU DONJON
    // ------------------------------------------------------------
    // Avant, la salle empruntait les décors du VILLAGE (arbres, bancs, fontaines) :
    // ça ne racontait rien d'un donjon. Ici chaque objet est dessiné à la main,
    // dans le trait du village — aplats doux, contour encre, ombre portée — et
    // chacun bouge un peu : la flamme danse, le champignon respire, l'eau ondule.
    //
    // Repère local : (0,0) est le POINT AU SOL de l'objet, on dessine vers le haut.
    // `s` est sa hauteur de référence, `r` un tirage stable propre à l'objet.
    const INK = 'rgba(42,34,26,0.55)';
    function propShadow(g, w, h) {
      g.fillStyle = 'rgba(28,22,14,0.22)';
      g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.fill();
    }
    function inkPath(g, fill, s2, path) {
      g.fillStyle = fill; path(); g.fill();
      g.strokeStyle = INK; g.lineWidth = Math.max(0.9, s2 * 0.035); g.stroke();
    }
    // une flamme qui danse : deux gouttes imbriquées + un halo qui respire
    function drawFlame(g, x, y, s2, T, seed, cold) {
      const w = 0.55 + 0.16 * Math.sin(T * 8.3 + seed);
      const h = 1 + 0.18 * Math.sin(T * 6.1 + seed * 1.7);
      const gl = g.createRadialGradient(x, y - s2 * 0.3, 1, x, y - s2 * 0.3, s2 * 3.4);
      gl.addColorStop(0, cold ? 'rgba(150,210,255,0.34)' : 'rgba(255,190,90,0.34)');
      gl.addColorStop(1, cold ? 'rgba(90,150,220,0)' : 'rgba(240,140,40,0)');
      g.fillStyle = gl;
      g.beginPath(); g.arc(x, y - s2 * 0.3, s2 * 3.4, 0, Math.PI * 2); g.fill();
      const drop = (k, col) => {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(x, y - s2 * 1.5 * h * k);
        g.quadraticCurveTo(x + s2 * 0.62 * w * k, y - s2 * 0.5 * k, x, y);
        g.quadraticCurveTo(x - s2 * 0.62 * w * k, y - s2 * 0.5 * k, x, y - s2 * 1.5 * h * k);
        g.fill();
      };
      drop(1, cold ? '#5aa8e0' : '#e8742a');
      drop(0.62, cold ? '#a8e0ff' : '#ffc23c');
      drop(0.28, cold ? '#e8f8ff' : '#fff0b0');
    }

    const DUNGEON_PROPS = {
      // ---- TORCHE MURALE : une petite applique, pas un flambeau ----
      // Elle est VISSÉE AU MUR : platine, deux rivets, un bras court, un anneau
      // et une mèche qui brûle. Haute d'à peine deux tiers de carreau — elle
      // éclaire la salle sans y prendre de place.
      torche(g, s2, T, r) {
        const arm = Math.cos(r * 6.28) < 0 ? -1 : 1;   // le bras part d'un côté ou de l'autre
        g.save();
        g.scale(arm, 1);
        // platine plaquée contre la pierre
        inkPath(g, '#3f3831', s2, () => {
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.09, -s2 * 0.3, s2 * 0.18, s2 * 0.26, s2 * 0.03)
                       : g.rect(-s2 * 0.09, -s2 * 0.3, s2 * 0.18, s2 * 0.26));
        });
        g.fillStyle = '#6b6157';                        // les deux rivets
        g.beginPath(); g.arc(0, -s2 * 0.25, s2 * 0.022, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(0, -s2 * 0.09, s2 * 0.022, 0, Math.PI * 2); g.fill();
        // bras coudé qui écarte la flamme du mur
        g.strokeStyle = '#4a423a'; g.lineWidth = Math.max(1.3, s2 * 0.05); g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, -s2 * 0.2);
        g.quadraticCurveTo(s2 * 0.14, -s2 * 0.26, s2 * 0.16, -s2 * 0.38);
        g.stroke();
        g.lineCap = 'butt';
        // l'anneau qui tient la mèche
        g.strokeStyle = '#5c5249'; g.lineWidth = Math.max(1.2, s2 * 0.04);
        g.beginPath(); g.ellipse(s2 * 0.16, -s2 * 0.4, s2 * 0.075, s2 * 0.05, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#2c2520';                        // la mèche poissée
        g.beginPath(); g.ellipse(s2 * 0.16, -s2 * 0.43, s2 * 0.05, s2 * 0.055, 0, 0, Math.PI * 2); g.fill();
        g.restore();
        drawFlame(g, arm * s2 * 0.16, -s2 * 0.46, s2 * 0.15, T, r * 6.28, false);
      },
      // ---- BRASERO : un trépied bas, pas un chaudron ----
      brasero(g, s2, T, r) {
        propShadow(g, s2 * 0.3, s2 * 0.11);
        // trépied : trois tiges fines avec un pied
        g.strokeStyle = '#3a3129'; g.lineWidth = Math.max(1.1, s2 * 0.035); g.lineCap = 'round';
        for (const dx of [-0.19, 0, 0.19]) {
          g.beginPath(); g.moveTo(dx * s2, -s2 * 0.02); g.lineTo(dx * s2 * 0.42, -s2 * 0.3); g.stroke();
        }
        g.lineCap = 'butt';
        // vasque peu profonde
        inkPath(g, '#584c44', s2, () => {
          g.beginPath();
          g.moveTo(-s2 * 0.26, -s2 * 0.3); g.lineTo(s2 * 0.26, -s2 * 0.3);
          g.lineTo(s2 * 0.21, -s2 * 0.42); g.lineTo(-s2 * 0.21, -s2 * 0.42); g.closePath();
        });
        g.fillStyle = '#7b6d61';                   // le rebord, vu de trois quarts
        g.beginPath(); g.ellipse(0, -s2 * 0.42, s2 * 0.22, s2 * 0.065, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c4441e';                   // les braises
        g.beginPath(); g.ellipse(0, -s2 * 0.43, s2 * 0.16, s2 * 0.045, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffb648';
        g.beginPath(); g.ellipse(-s2 * 0.04, -s2 * 0.44, s2 * 0.07, s2 * 0.022, 0, 0, Math.PI * 2); g.fill();
        drawFlame(g, 0, -s2 * 0.45, s2 * 0.2, T, r * 6.28, false);
      },
      // ---- CHAMPIGNON : mignon, il respire ----
      champignon(g, s2, T, r, glow) {
        propShadow(g, s2 * 0.3, s2 * 0.11);
        const sway = Math.sin(T * 1.4 + r * 6.28) * 0.045;
        g.save(); g.rotate(sway);
        inkPath(g, '#efe4cf', s2, () => {          // pied
          g.beginPath();
          g.moveTo(-s2 * 0.13, 0);
          g.quadraticCurveTo(-s2 * 0.1, -s2 * 0.36, -s2 * 0.14, -s2 * 0.52);
          g.lineTo(s2 * 0.14, -s2 * 0.52);
          g.quadraticCurveTo(s2 * 0.1, -s2 * 0.36, s2 * 0.13, 0);
          g.closePath();
        });
        const capCol = r < 0.5 ? '#c0483c' : '#8a5fbf';
        inkPath(g, capCol, s2, () => {             // chapeau bombé
          g.beginPath();
          g.moveTo(-s2 * 0.42, -s2 * 0.5);
          g.quadraticCurveTo(0, -s2 * 1.02, s2 * 0.42, -s2 * 0.5);
          g.quadraticCurveTo(0, -s2 * 0.36, -s2 * 0.42, -s2 * 0.5);
          g.closePath();
        });
        g.fillStyle = 'rgba(255,248,232,0.9)';     // pois
        for (const q of [[-0.18, -0.66, 0.075], [0.12, -0.72, 0.06], [0.25, -0.57, 0.045]]) {
          g.beginPath(); g.arc(q[0] * s2, q[1] * s2, q[2] * s2, 0, Math.PI * 2); g.fill();
        }
        g.restore();
        if (glow) {                                 // il éclaire dans le noir
          const pulse = 0.16 + 0.07 * Math.sin(T * 2 + r * 6.28);
          const gl = g.createRadialGradient(0, -s2 * 0.6, 1, 0, -s2 * 0.6, s2 * 1.5);
          gl.addColorStop(0, 'rgba(150,255,190,' + pulse + ')');
          gl.addColorStop(1, 'rgba(90,220,150,0)');
          g.fillStyle = gl; g.beginPath(); g.arc(0, -s2 * 0.6, s2 * 1.5, 0, Math.PI * 2); g.fill();
        }
      },
      // ---- CRISTAL : une grappe qui pulse ----
      cristal(g, s2, T, r) {
        propShadow(g, s2 * 0.34, s2 * 0.12);
        const puls = 0.5 + 0.28 * Math.sin(T * 1.9 + r * 6.28);
        const gl = g.createRadialGradient(0, -s2 * 0.5, 1, 0, -s2 * 0.5, s2 * 1.6);
        gl.addColorStop(0, 'rgba(190,170,255,' + (0.22 * puls + 0.1) + ')');
        gl.addColorStop(1, 'rgba(120,100,220,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(0, -s2 * 0.5, s2 * 1.6, 0, Math.PI * 2); g.fill();
        const shard = (dx, h, w, tilt, c1, c2) => {
          g.save(); g.translate(dx * s2, 0); g.rotate(tilt);
          inkPath(g, c1, s2, () => {
            g.beginPath(); g.moveTo(-w * s2, 0); g.lineTo(-w * s2 * 0.7, -h * s2 * 0.72);
            g.lineTo(0, -h * s2); g.lineTo(w * s2 * 0.7, -h * s2 * 0.72); g.lineTo(w * s2, 0); g.closePath();
          });
          g.fillStyle = c2;                        // facette éclairée
          g.beginPath(); g.moveTo(0, -h * s2); g.lineTo(w * s2 * 0.7, -h * s2 * 0.72);
          g.lineTo(w * s2, 0); g.lineTo(0, -h * s2 * 0.12); g.closePath(); g.fill();
          g.restore();
        };
        shard(-0.26, 0.62, 0.15, -0.22, '#6a54b0', '#a894e8');
        shard(0.28, 0.5, 0.13, 0.26, '#5c4aa0', '#9b88dc');
        shard(0.02, 0.95, 0.19, 0.02, '#7c66c8', '#c4b4ff');
      },
      // ---- OSSEMENTS : crâne et fémurs croisés ----
      os(g, s2, T, r) {
        propShadow(g, s2 * 0.4, s2 * 0.12);
        g.save(); g.rotate(r * 0.5 - 0.25);
        const femur = (a) => {
          g.save(); g.rotate(a);
          inkPath(g, '#e6dcc4', s2, () => {
            g.beginPath();
            (g.roundRect ? g.roundRect(-s2 * 0.44, -s2 * 0.05, s2 * 0.88, s2 * 0.1, s2 * 0.05)
                         : g.rect(-s2 * 0.44, -s2 * 0.05, s2 * 0.88, s2 * 0.1));
          });
          g.fillStyle = '#f2ead6';
          for (const sx of [-1, 1]) {
            g.beginPath(); g.arc(sx * s2 * 0.44, -s2 * 0.05, s2 * 0.06, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.arc(sx * s2 * 0.44, s2 * 0.05, s2 * 0.06, 0, Math.PI * 2); g.fill();
          }
          g.restore();
        };
        femur(0.42); femur(-0.42);
        inkPath(g, '#f0e8d2', s2, () => {          // crâne
          g.beginPath(); g.ellipse(0, -s2 * 0.16, s2 * 0.26, s2 * 0.23, 0, 0, Math.PI * 2);
        });
        inkPath(g, '#e6dcc0', s2, () => {          // mâchoire
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.13, -s2 * 0.02, s2 * 0.26, s2 * 0.1, s2 * 0.04)
                       : g.rect(-s2 * 0.13, -s2 * 0.02, s2 * 0.26, s2 * 0.1));
        });
        g.fillStyle = '#3a322a';                   // orbites
        g.beginPath(); g.ellipse(-s2 * 0.1, -s2 * 0.2, s2 * 0.07, s2 * 0.08, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.ellipse(s2 * 0.1, -s2 * 0.2, s2 * 0.07, s2 * 0.08, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      },
      // ---- PIERRE TOMBALE ----
      tombe(g, s2, T, r) {
        propShadow(g, s2 * 0.36, s2 * 0.12);
        g.save(); g.rotate((r - 0.5) * 0.16);      // elle penche un peu
        inkPath(g, '#8e8a82', s2, () => {
          g.beginPath();
          g.moveTo(-s2 * 0.3, 0); g.lineTo(-s2 * 0.3, -s2 * 0.62);
          g.quadraticCurveTo(0, -s2 * 0.98, s2 * 0.3, -s2 * 0.62);
          g.lineTo(s2 * 0.3, 0); g.closePath();
        });
        g.fillStyle = 'rgba(60,56,50,0.45)';       // gravure
        g.fillRect(-s2 * 0.12, -s2 * 0.6, s2 * 0.24, s2 * 0.05);
        g.fillRect(-s2 * 0.04, -s2 * 0.72, s2 * 0.08, s2 * 0.28);
        g.fillStyle = 'rgba(60,56,50,0.28)';
        g.fillRect(-s2 * 0.16, -s2 * 0.32, s2 * 0.32, s2 * 0.035);
        g.fillRect(-s2 * 0.16, -s2 * 0.22, s2 * 0.32, s2 * 0.035);
        g.restore();
        g.fillStyle = '#5f7a4a';                   // touffe d'herbe au pied
        for (const dx of [-0.34, 0.32]) {
          g.beginPath(); g.moveTo(dx * s2, 0);
          g.quadraticCurveTo(dx * s2 * 1.15, -s2 * 0.1, dx * s2 * 1.3, -s2 * 0.02);
          g.quadraticCurveTo(dx * s2 * 1.1, -s2 * 0.04, dx * s2, 0); g.fill();
        }
      },
      // ---- COFFRE : bas sur pattes, planches et ferrures rivetées ----
      coffre(g, s2, T, r) {
        propShadow(g, s2 * 0.32, s2 * 0.1);
        const w = s2 * 0.54, h = s2 * 0.24, lid = s2 * 0.16;
        g.fillStyle = '#3f2f1c';                   // les quatre pieds
        for (const dx of [-0.44, 0.44]) g.fillRect(dx * w - s2 * 0.02, -s2 * 0.04, s2 * 0.05, s2 * 0.05);
        inkPath(g, '#8a5f34', s2, () => {          // la caisse
          g.beginPath();
          (g.roundRect ? g.roundRect(-w / 2, -h - s2 * 0.02, w, h, s2 * 0.02)
                       : g.rect(-w / 2, -h - s2 * 0.02, w, h));
        });
        g.strokeStyle = 'rgba(70,48,24,0.45)';     // les planches
        g.lineWidth = Math.max(0.7, s2 * 0.016);
        for (const k of [0.33, 0.66]) {
          g.beginPath(); g.moveTo(-w / 2, -h - s2 * 0.02 + h * k);
          g.lineTo(w / 2, -h - s2 * 0.02 + h * k); g.stroke();
        }
        inkPath(g, '#a87643', s2, () => {          // le couvercle bombé
          g.beginPath();
          g.moveTo(-w / 2 - s2 * 0.01, -h - s2 * 0.02);
          g.quadraticCurveTo(0, -h - lid - s2 * 0.06, w / 2 + s2 * 0.01, -h - s2 * 0.02);
          g.closePath();
        });
        g.strokeStyle = 'rgba(70,48,24,0.4)';      // nervure du couvercle
        g.beginPath();
        g.moveTo(-w * 0.4, -h - s2 * 0.05);
        g.quadraticCurveTo(0, -h - lid * 0.75, w * 0.4, -h - s2 * 0.05);
        g.stroke();
        g.fillStyle = '#4e3a1e';                   // deux ferrures rivetées
        for (const dx of [-0.28, 0.28]) {
          g.fillRect(dx * w - s2 * 0.018, -h - s2 * 0.02, s2 * 0.036, h);
          g.fillStyle = '#8a7250';
          g.beginPath(); g.arc(dx * w, -h + h * 0.25, s2 * 0.012, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(dx * w, -h + h * 0.75, s2 * 0.012, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#4e3a1e';
        }
        g.fillStyle = '#c9a03a';                   // la serrure en laiton
        g.beginPath();
        (g.roundRect ? g.roundRect(-s2 * 0.045, -h - s2 * 0.06, s2 * 0.09, s2 * 0.1, s2 * 0.02)
                     : g.rect(-s2 * 0.045, -h - s2 * 0.06, s2 * 0.09, s2 * 0.1));
        g.fill();
        g.strokeStyle = INK; g.lineWidth = Math.max(0.7, s2 * 0.02); g.stroke();
        g.fillStyle = '#5c4526';
        g.beginPath(); g.arc(0, -h - s2 * 0.01, s2 * 0.016, 0, Math.PI * 2); g.fill();
        const tw = Math.max(0, Math.sin(T * 1.7 + r * 6.28));   // l'éclat qui passe
        g.globalAlpha = tw * 0.8; g.fillStyle = '#fff8d0';
        g.beginPath(); g.arc(w * 0.2, -h - lid * 0.6, s2 * 0.025, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      },
      // ---- STALAGMITE ----
      stalagmite(g, s2, T, r) {
        propShadow(g, s2 * 0.3, s2 * 0.1);
        const lean = (r - 0.5) * 0.2;
        const cone = (dx, h, w, col) => {
          inkPath(g, col, s2, () => {
            g.beginPath();
            g.moveTo(dx * s2 - w * s2, 0);
            g.quadraticCurveTo(dx * s2 - w * s2 * 0.45, -h * s2 * 0.55, dx * s2 + lean * s2, -h * s2);
            g.quadraticCurveTo(dx * s2 + w * s2 * 0.45, -h * s2 * 0.55, dx * s2 + w * s2, 0);
            g.closePath();
          });
        };
        cone(-0.2, 0.5, 0.14, '#5f574c');
        cone(0.18, 0.66, 0.16, '#6b6256');
        cone(0, 1, 0.22, '#7d7365');
        g.fillStyle = 'rgba(255,255,255,0.13)';    // arête éclairée
        g.beginPath(); g.moveTo(-s2 * 0.06, 0); g.lineTo(lean * s2, -s2); g.lineTo(s2 * 0.05, 0); g.fill();
      },
      // ---- FLAQUE : elle ondule ----
      flaque(g, s2, T, r) {
        g.fillStyle = 'rgba(30,50,60,0.4)';
        g.beginPath(); g.ellipse(0, 0, s2 * 0.52, s2 * 0.24, 0, 0, Math.PI * 2); g.fill();
        const wg = g.createRadialGradient(-s2 * 0.12, -s2 * 0.06, 1, 0, 0, s2 * 0.5);
        wg.addColorStop(0, '#7fc4e0'); wg.addColorStop(1, '#33708f');
        g.fillStyle = wg;
        g.beginPath(); g.ellipse(0, 0, s2 * 0.46, s2 * 0.2, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = Math.max(0.8, s2 * 0.025);
        for (let i = 0; i < 2; i++) {
          const k = ((T * 0.5 + r + i * 0.5) % 1);
          g.globalAlpha = 1 - k;
          g.beginPath(); g.ellipse(0, 0, s2 * 0.1 + k * s2 * 0.34, s2 * 0.045 + k * s2 * 0.15, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.globalAlpha = 1;
      },
      // ---- ÉVENT DE LAVE : il bouillonne ----
      geyser(g, s2, T, r) {
        g.fillStyle = 'rgba(40,14,6,0.5)';
        g.beginPath(); g.ellipse(0, 0, s2 * 0.5, s2 * 0.22, 0, 0, Math.PI * 2); g.fill();
        const lg = g.createRadialGradient(0, -s2 * 0.04, 1, 0, 0, s2 * 0.46);
        lg.addColorStop(0, '#ffd776'); lg.addColorStop(0.5, '#e8621e'); lg.addColorStop(1, '#8a2a10');
        g.fillStyle = lg;
        g.beginPath(); g.ellipse(0, 0, s2 * 0.42, s2 * 0.18, 0, 0, Math.PI * 2); g.fill();
        for (let i = 0; i < 3; i++) {             // bulles qui crèvent
          const k = ((T * 0.7 + r + i * 0.33) % 1);
          const bx = Math.cos(r * 6.28 + i * 2.1) * s2 * 0.24;
          g.globalAlpha = (1 - k) * 0.85;
          g.fillStyle = '#ffb648';
          g.beginPath(); g.arc(bx, -k * s2 * 0.5, s2 * 0.07 * (1 - k * 0.4), 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
        const gl = g.createRadialGradient(0, 0, 1, 0, 0, s2 * 1.4);
        gl.addColorStop(0, 'rgba(255,150,50,0.22)'); gl.addColorStop(1, 'rgba(200,80,20,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(0, 0, s2 * 1.4, 0, Math.PI * 2); g.fill();
      },
      // ---- PILE DE GRIMOIRES : trois volumes posés de guingois ----
      livres(g, s2, T, r) {
        propShadow(g, s2 * 0.26, s2 * 0.09);
        const cols = ['#8c3a3a', '#33628c', '#5d7a3a', '#6a4a8c'];
        let y = 0;
        for (let i = 0; i < 3; i++) {
          const h = s2 * 0.085, w = s2 * (0.44 - i * 0.05);
          const tilt = ((r * 7 + i * 0.37) % 1 - 0.5) * 0.2;
          g.save(); g.translate(0, y); g.rotate(tilt);
          inkPath(g, cols[(Math.floor(r * 4) + i) % cols.length], s2, () => {
            g.beginPath();
            (g.roundRect ? g.roundRect(-w / 2, -h, w, h, s2 * 0.012) : g.rect(-w / 2, -h, w, h));
          });
          g.fillStyle = '#efe6cf';                 // la tranche des pages
          g.fillRect(-w / 2 + s2 * 0.03, -h + s2 * 0.012, w - s2 * 0.045, h * 0.5);
          g.strokeStyle = 'rgba(240,230,205,0.5)';  // les nerfs du dos
          g.lineWidth = Math.max(0.6, s2 * 0.012);
          g.beginPath(); g.moveTo(-w / 2 + s2 * 0.012, -h * 0.75);
          g.lineTo(-w / 2 + s2 * 0.012, -h * 0.25); g.stroke();
          g.restore();
          y -= h + s2 * 0.006;
        }
        // un signet doré qui dépasse
        g.strokeStyle = '#c9a03a'; g.lineWidth = Math.max(0.8, s2 * 0.018);
        g.beginPath(); g.moveTo(s2 * 0.14, y + s2 * 0.05); g.lineTo(s2 * 0.2, y + s2 * 0.12); g.stroke();
      },
      // ---- TOILE D'ARAIGNÉE (dans un angle) ----
      toile(g, s2, T, r) {
        g.save();
        g.translate(0, -s2 * 0.62);
        g.strokeStyle = 'rgba(235,232,224,0.5)';
        g.lineWidth = Math.max(0.7, s2 * 0.02);
        const R = s2 * 0.62, a0 = -Math.PI * 0.5 + (r - 0.5) * 0.8;
        for (let i = 0; i <= 5; i++) {            // rayons
          const a = a0 + (i / 5) * Math.PI;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke();
        }
        for (let k = 1; k <= 3; k++) {            // arcs
          const rr = (k / 3) * R;
          g.beginPath();
          for (let i = 0; i <= 5; i++) {
            const a = a0 + (i / 5) * Math.PI;
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
            i ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.stroke();
        }
        const bob = Math.sin(T * 1.6 + r * 6.28) * s2 * 0.04;   // l'araignée se balance
        g.fillStyle = '#2e2620';
        g.beginPath(); g.ellipse(R * 0.35, R * 0.5 + bob, s2 * 0.07, s2 * 0.06, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(46,38,32,0.7)'; g.lineWidth = Math.max(0.7, s2 * 0.018);
        for (const dx of [-1, 1]) for (const dy of [-0.5, 0.4]) {
          g.beginPath(); g.moveTo(R * 0.35, R * 0.5 + bob);
          g.lineTo(R * 0.35 + dx * s2 * 0.11, R * 0.5 + bob + dy * s2 * 0.09); g.stroke();
        }
        g.restore();
      },
      // ---- STATUE BRISÉE ----
      statue(g, s2, T, r) {
        propShadow(g, s2 * 0.4, s2 * 0.14);
        inkPath(g, '#7e7668', s2, () => {          // socle
          g.beginPath(); g.rect(-s2 * 0.34, -s2 * 0.18, s2 * 0.68, s2 * 0.18);
        });
        inkPath(g, '#9a9284', s2, () => {          // corps, cassé net en haut
          g.beginPath();
          g.moveTo(-s2 * 0.2, -s2 * 0.18);
          g.lineTo(-s2 * 0.24, -s2 * 0.72);
          g.lineTo(-s2 * 0.06, -s2 * 0.62); g.lineTo(s2 * 0.08, -s2 * 0.78);
          g.lineTo(s2 * 0.22, -s2 * 0.6); g.lineTo(s2 * 0.2, -s2 * 0.18);
          g.closePath();
        });
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.beginPath(); g.moveTo(-s2 * 0.2, -s2 * 0.18); g.lineTo(-s2 * 0.24, -s2 * 0.72);
        g.lineTo(-s2 * 0.12, -s2 * 0.66); g.lineTo(-s2 * 0.1, -s2 * 0.18); g.closePath(); g.fill();
        inkPath(g, '#8e8678', s2, () => {          // la tête tombée à côté
          g.beginPath(); g.ellipse(s2 * 0.42, -s2 * 0.1, s2 * 0.14, s2 * 0.12, 0.4, 0, Math.PI * 2);
        });
        g.fillStyle = 'rgba(50,44,36,0.5)';
        g.beginPath(); g.arc(s2 * 0.38, -s2 * 0.12, s2 * 0.03, 0, Math.PI * 2); g.fill();
      },
      // ---- TOUFFE DE MOUSSE / FOUGÈRE ----
      mousse(g, s2, T, r) {
        propShadow(g, s2 * 0.28, s2 * 0.08);
        const sway = Math.sin(T * 1.1 + r * 6.28) * 0.06;
        for (let i = -3; i <= 3; i++) {
          const a = i * 0.22 + sway;
          const h = s2 * (0.5 - Math.abs(i) * 0.055);
          g.strokeStyle = i % 2 ? '#4f7a3c' : '#66a04e';
          g.lineWidth = Math.max(1.1, s2 * 0.05);
          g.lineCap = 'round';
          g.beginPath(); g.moveTo(0, 0);
          g.quadraticCurveTo(Math.sin(a) * h * 0.5, -h * 0.7, Math.sin(a) * h, -h);
          g.stroke();
        }
        g.lineCap = 'butt';
      },
    };
    // Ce qui a l'air solide L'EST : un brasero ou une tombe bloque vraiment le
    // passage et coupe la ligne de vue des tireurs. Ce qui est plat (torche au
    // mur, flaque, mousse, ossements, toile) se traverse. Rien ne ment.
    const PROP_SOLIDE = { brasero: 1, statue: 1, tombe: 1, coffre: 1, stalagmite: 1,
      cristal: 1, livres: 1, champignon: 1 };
    const PROP_FLAT = { torche: 1, toile: 1, flaque: 1, mousse: 1, os: 1, geyser: 1 };
    // GABARIT de chaque objet, en carreaux. Un meuble de donjon doit meubler,
    // pas écraser la salle : rien ne dépasse ~1,2 carreau de haut une fois
    // dessiné. (La valeur est la HAUTEUR DE RÉFÉRENCE ; chaque dessin n'en
    // occupe qu'une fraction — cf. les fonctions de DUNGEON_PROPS.)
    const PROP_TAILLE = {
      torche: 0.9, toile: 0.85, brasero: 1.3, champignon: 0.98, cristal: 1.05,
      os: 1.2, tombe: 0.98, coffre: 1.5, stalagmite: 1.05, flaque: 1.2,
      geyser: 1.2, livres: 1.6, statue: 1.15, mousse: 1.1,
    };
    // quelle silhouette pour quel objet — sert au placement (largeur au sol)
    const PROP_FOOT = { torche: 0.25, brasero: 0.5, champignon: 0.4, cristal: 0.45, os: 0.5,
      tombe: 0.45, coffre: 0.5, stalagmite: 0.4, flaque: 0.55, geyser: 0.55, livres: 0.45,
      toile: 0.2, statue: 0.5, mousse: 0.35 };


    // ------------------------------------------------------------
    // LES BÊTES DU DONJON
    // ------------------------------------------------------------
    // Les huit animaux existaient en DONNÉES (nom, comportement, élément) mais
    // personne ne les dessinait : ils empruntaient les sprites d'unités chats /
    // oiseaux. Ici ils ont leur propre silhouette, un même squelette de
    // quadrupède décliné en proportions, plus deux cas à part (l'oiseau, le
    // crapaud). Tout est dessiné de profil, pattes qui balancent sur la phase
    // de marche — la même horloge que les unités de bataille.
    //
    // Repère local : (0,0) = les pattes au sol, on regarde vers la DROITE,
    // `s` = hauteur de référence.

    // ------------------------------------------------------------
    // L'ÉQUIPEMENT DESSINÉ — une icône par famille, teintée par rareté
    // ------------------------------------------------------------
    // Les pièces s'affichaient en EMOJI : la même  pour une épée commune de
    // tier 1 et pour une légendaire de tier 20, et un rendu qui change d'une
    // machine à l'autre. Ici chaque famille a son dessin, et la RARETÉ teinte
    // le métal, la garde et le liseré : on lit la pièce sans lire son texte.
    //
    // Repère local : boîte de -0,5 à +0,5 sur les deux axes, `s` = côté.
    const RARETE_METAL = {
      commun:     { froid: '#9aa0a6', chaud: '#6f757a', or: '#7d7468', gemme: null },
      inhabituel: { froid: '#a8c0a2', chaud: '#6e8a68', or: '#7f8a62', gemme: '#5fa35f' },
      rare:       { froid: '#a8bcd8', chaud: '#6a7f9e', or: '#7a86a0', gemme: '#4a86c8' },
      epique:     { froid: '#bfaad8', chaud: '#7d6a9c', or: '#8a7aa8', gemme: '#8a56c0' },
      legendaire: { froid: '#e2cf9a', chaud: '#a8862e', or: '#d8ab2c', gemme: '#ffb830' },
      unique:     { froid: '#e8b4a4', chaud: '#a83c2a', or: '#c2452f', gemme: '#ff5a3c' },
    };
    const ART_BOIS = '#6b4c2a', ART_BOIS_C = '#8a6a40', ART_CUIR = '#7a5636';
    function artInk(g, s2) { g.strokeStyle = 'rgba(24,20,16,0.55)'; g.lineWidth = Math.max(0.8, s2 * 0.028); }
    function artPath(g, s2, fill, path) { g.fillStyle = fill; path(); g.fill(); artInk(g, s2); g.stroke(); }

    const ITEM_ART = {
      // ---------------- ARMES ----------------
      arme_epee(g, s2, M) {
        artPath(g, s2, M.froid, () => {            // la lame
          g.beginPath();
          g.moveTo(-s2 * 0.05, s2 * 0.06); g.lineTo(s2 * 0.05, s2 * 0.06);
          g.lineTo(s2 * 0.04, -s2 * 0.34); g.lineTo(0, -s2 * 0.44); g.lineTo(-s2 * 0.04, -s2 * 0.34);
          g.closePath();
        });
        g.fillStyle = 'rgba(255,255,255,0.35)';    // la gouttière
        g.fillRect(-s2 * 0.012, -s2 * 0.32, s2 * 0.024, s2 * 0.34);
        artPath(g, s2, M.or, () => {               // la garde
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.19, s2 * 0.06, s2 * 0.38, s2 * 0.06, s2 * 0.02)
                       : g.rect(-s2 * 0.19, s2 * 0.06, s2 * 0.38, s2 * 0.06));
        });
        artPath(g, s2, ART_CUIR, () => {           // la fusée
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.035, s2 * 0.12, s2 * 0.07, s2 * 0.22, s2 * 0.02)
                       : g.rect(-s2 * 0.035, s2 * 0.12, s2 * 0.07, s2 * 0.22));
        });
        artPath(g, s2, M.or, () => {               // le pommeau
          g.beginPath(); g.arc(0, s2 * 0.38, s2 * 0.055, 0, Math.PI * 2);
        });
      },
      arme_hache(g, s2, M) {
        artPath(g, s2, ART_BOIS, () => {           // le manche
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.035, -s2 * 0.3, s2 * 0.07, s2 * 0.7, s2 * 0.025)
                       : g.rect(-s2 * 0.035, -s2 * 0.3, s2 * 0.07, s2 * 0.7));
        });
        artPath(g, s2, M.froid, () => {            // le fer, en croissant
          g.beginPath();
          g.moveTo(s2 * 0.02, -s2 * 0.34);
          g.quadraticCurveTo(s2 * 0.42, -s2 * 0.26, s2 * 0.34, s2 * 0.02);
          g.quadraticCurveTo(s2 * 0.2, -s2 * 0.08, s2 * 0.02, -s2 * 0.06);
          g.closePath();
        });
        g.fillStyle = 'rgba(255,255,255,0.28)';
        g.beginPath();
        g.moveTo(s2 * 0.06, -s2 * 0.3); g.quadraticCurveTo(s2 * 0.3, -s2 * 0.22, s2 * 0.26, -s2 * 0.02);
        g.lineTo(s2 * 0.08, -s2 * 0.08); g.closePath(); g.fill();
        artPath(g, s2, M.chaud, () => {            // la bague de tête
          g.beginPath(); g.rect(-s2 * 0.06, -s2 * 0.32, s2 * 0.12, s2 * 0.07);
        });
      },
      arme_lance(g, s2, M) {
        artPath(g, s2, ART_BOIS, () => {
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.03, -s2 * 0.22, s2 * 0.06, s2 * 0.66, s2 * 0.02)
                       : g.rect(-s2 * 0.03, -s2 * 0.22, s2 * 0.06, s2 * 0.66));
        });
        artPath(g, s2, M.froid, () => {            // le fer de lance
          g.beginPath();
          g.moveTo(0, -s2 * 0.46);
          g.quadraticCurveTo(s2 * 0.1, -s2 * 0.3, s2 * 0.05, -s2 * 0.16);
          g.lineTo(-s2 * 0.05, -s2 * 0.16);
          g.quadraticCurveTo(-s2 * 0.1, -s2 * 0.3, 0, -s2 * 0.46);
          g.closePath();
        });
        artPath(g, s2, M.or, () => {               // la douille
          g.beginPath(); g.rect(-s2 * 0.055, -s2 * 0.17, s2 * 0.11, s2 * 0.06);
        });
        g.strokeStyle = M.chaud; g.lineWidth = Math.max(1, s2 * 0.03);
        g.beginPath(); g.moveTo(-s2 * 0.03, s2 * 0.1); g.lineTo(s2 * 0.03, s2 * 0.1); g.stroke();
      },
      arme_masse(g, s2, M) {
        artPath(g, s2, ART_BOIS, () => {
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.04, -s2 * 0.12, s2 * 0.08, s2 * 0.56, s2 * 0.025)
                       : g.rect(-s2 * 0.04, -s2 * 0.12, s2 * 0.08, s2 * 0.56));
        });
        artPath(g, s2, M.chaud, () => {            // la tête, à pans
          g.beginPath();
          g.moveTo(-s2 * 0.17, -s2 * 0.2); g.lineTo(-s2 * 0.1, -s2 * 0.42);
          g.lineTo(s2 * 0.1, -s2 * 0.42); g.lineTo(s2 * 0.17, -s2 * 0.2);
          g.lineTo(s2 * 0.1, -s2 * 0.06); g.lineTo(-s2 * 0.1, -s2 * 0.06);
          g.closePath();
        });
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.beginPath();
        g.moveTo(-s2 * 0.16, -s2 * 0.2); g.lineTo(-s2 * 0.09, -s2 * 0.4);
        g.lineTo(-s2 * 0.02, -s2 * 0.4); g.lineTo(-s2 * 0.05, -s2 * 0.08); g.closePath(); g.fill();
        artPath(g, s2, M.or, () => {
          g.beginPath(); g.arc(0, s2 * 0.42, s2 * 0.05, 0, Math.PI * 2);
        });
      },
      arme_dagues(g, s2, M) {
        for (const side of [-1, 1]) {
          g.save();
          g.translate(side * s2 * 0.14, 0);
          g.rotate(side * 0.28);
          artPath(g, s2, M.froid, () => {
            g.beginPath();
            g.moveTo(-s2 * 0.04, s2 * 0.04); g.lineTo(s2 * 0.04, s2 * 0.04);
            g.lineTo(s2 * 0.03, -s2 * 0.22); g.lineTo(0, -s2 * 0.32); g.lineTo(-s2 * 0.03, -s2 * 0.22);
            g.closePath();
          });
          artPath(g, s2, M.or, () => {
            g.beginPath(); g.rect(-s2 * 0.1, s2 * 0.04, s2 * 0.2, s2 * 0.045);
          });
          artPath(g, s2, ART_CUIR, () => {
            g.beginPath();
            (g.roundRect ? g.roundRect(-s2 * 0.03, s2 * 0.085, s2 * 0.06, s2 * 0.17, s2 * 0.02)
                         : g.rect(-s2 * 0.03, s2 * 0.085, s2 * 0.06, s2 * 0.17));
          });
          g.restore();
        }
      },
      arme_arc(g, s2, M) {
        g.strokeStyle = ART_BOIS_C; g.lineWidth = Math.max(1.6, s2 * 0.07); g.lineCap = 'round';
        g.beginPath();                              // le corps de l'arc
        g.moveTo(s2 * 0.06, -s2 * 0.42);
        g.quadraticCurveTo(-s2 * 0.34, 0, s2 * 0.06, s2 * 0.42);
        g.stroke();
        g.strokeStyle = ART_BOIS; g.lineWidth = Math.max(0.8, s2 * 0.03);
        g.beginPath();
        g.moveTo(s2 * 0.06, -s2 * 0.42);
        g.quadraticCurveTo(-s2 * 0.3, 0, s2 * 0.06, s2 * 0.42);
        g.stroke();
        g.strokeStyle = '#e6ddc8'; g.lineWidth = Math.max(0.8, s2 * 0.022);
        g.beginPath();                              // la corde
        g.moveTo(s2 * 0.06, -s2 * 0.42); g.lineTo(s2 * 0.16, 0); g.lineTo(s2 * 0.06, s2 * 0.42);
        g.stroke(); g.lineCap = 'butt';
        artPath(g, s2, M.or, () => {                // la poignée
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.28, -s2 * 0.06, s2 * 0.09, s2 * 0.12, s2 * 0.02)
                       : g.rect(-s2 * 0.28, -s2 * 0.06, s2 * 0.09, s2 * 0.12));
        });
      },
      arme_arbalete(g, s2, M) {
        artPath(g, s2, ART_BOIS, () => {           // l'arbrier
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.05, -s2 * 0.3, s2 * 0.1, s2 * 0.68, s2 * 0.025)
                       : g.rect(-s2 * 0.05, -s2 * 0.3, s2 * 0.1, s2 * 0.68));
        });
        g.strokeStyle = M.chaud; g.lineWidth = Math.max(1.4, s2 * 0.055); g.lineCap = 'round';
        g.beginPath();                              // l'arc, en travers
        g.moveTo(-s2 * 0.38, -s2 * 0.14);
        g.quadraticCurveTo(0, -s2 * 0.34, s2 * 0.38, -s2 * 0.14);
        g.stroke();
        g.strokeStyle = '#e6ddc8'; g.lineWidth = Math.max(0.8, s2 * 0.022);
        g.beginPath(); g.moveTo(-s2 * 0.38, -s2 * 0.14); g.lineTo(0, s2 * 0.02); g.lineTo(s2 * 0.38, -s2 * 0.14); g.stroke();
        g.lineCap = 'butt';
        artPath(g, s2, M.froid, () => {            // le carreau engagé
          g.beginPath();
          g.moveTo(0, -s2 * 0.42); g.lineTo(s2 * 0.05, -s2 * 0.3);
          g.lineTo(-s2 * 0.05, -s2 * 0.3); g.closePath();
        });
        artPath(g, s2, M.or, () => {               // la noix
          g.beginPath(); g.arc(0, s2 * 0.06, s2 * 0.05, 0, Math.PI * 2);
        });
      },
      arme_baton(g, s2, M) {
        artPath(g, s2, ART_BOIS_C, () => {
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.035, -s2 * 0.18, s2 * 0.07, s2 * 0.62, s2 * 0.025)
                       : g.rect(-s2 * 0.035, -s2 * 0.18, s2 * 0.07, s2 * 0.62));
        });
        g.strokeStyle = 'rgba(60,40,20,0.4)'; g.lineWidth = Math.max(0.7, s2 * 0.02);
        for (const y of [0.02, 0.16, 0.3]) {        // les nœuds du bois
          g.beginPath(); g.moveTo(-s2 * 0.035, s2 * y); g.lineTo(s2 * 0.035, s2 * y - s2 * 0.02); g.stroke();
        }
        artPath(g, s2, M.chaud, () => {            // la fourche
          g.beginPath();
          g.moveTo(-s2 * 0.18, -s2 * 0.4);
          g.quadraticCurveTo(-s2 * 0.06, -s2 * 0.12, 0, -s2 * 0.16);
          g.quadraticCurveTo(s2 * 0.06, -s2 * 0.12, s2 * 0.18, -s2 * 0.4);
          g.quadraticCurveTo(s2 * 0.04, -s2 * 0.24, 0, -s2 * 0.24);
          g.quadraticCurveTo(-s2 * 0.04, -s2 * 0.24, -s2 * 0.18, -s2 * 0.4);
          g.closePath();
        });
        if (M.gemme) {                              // la pierre sertie
          const gl = g.createRadialGradient(0, -s2 * 0.32, 1, 0, -s2 * 0.32, s2 * 0.14);
          gl.addColorStop(0, '#ffffff'); gl.addColorStop(0.4, M.gemme); gl.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gl;
          g.beginPath(); g.arc(0, -s2 * 0.32, s2 * 0.14, 0, Math.PI * 2); g.fill();
        }
        artPath(g, s2, M.gemme || M.froid, () => {
          g.beginPath(); g.arc(0, -s2 * 0.32, s2 * 0.06, 0, Math.PI * 2);
        });
      },
      arme_sceptre(g, s2, M) {
        artPath(g, s2, M.or, () => {
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.03, -s2 * 0.1, s2 * 0.06, s2 * 0.54, s2 * 0.02)
                       : g.rect(-s2 * 0.03, -s2 * 0.1, s2 * 0.06, s2 * 0.54));
        });
        artPath(g, s2, M.chaud, () => {            // le fleuron
          g.beginPath();
          g.moveTo(0, -s2 * 0.44);
          g.quadraticCurveTo(s2 * 0.2, -s2 * 0.3, s2 * 0.1, -s2 * 0.12);
          g.lineTo(-s2 * 0.1, -s2 * 0.12);
          g.quadraticCurveTo(-s2 * 0.2, -s2 * 0.3, 0, -s2 * 0.44);
          g.closePath();
        });
        g.fillStyle = M.gemme || '#e8e0cc';
        g.beginPath(); g.arc(0, -s2 * 0.26, s2 * 0.07, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath(); g.arc(-s2 * 0.02, -s2 * 0.29, s2 * 0.025, 0, Math.PI * 2); g.fill();
        g.strokeStyle = M.or; g.lineWidth = Math.max(1, s2 * 0.03);
        g.beginPath(); g.moveTo(-s2 * 0.08, -s2 * 0.08); g.lineTo(s2 * 0.08, -s2 * 0.08); g.stroke();
      },
      arme_bombe(g, s2, M) {
        artPath(g, s2, '#3a3038', () => {          // la sphère
          g.beginPath(); g.arc(0, s2 * 0.1, s2 * 0.28, 0, Math.PI * 2);
        });
        g.fillStyle = 'rgba(255,255,255,0.2)';
        g.beginPath(); g.arc(-s2 * 0.1, 0, s2 * 0.09, 0, Math.PI * 2); g.fill();
        artPath(g, s2, M.chaud, () => {            // le collet
          g.beginPath(); g.rect(-s2 * 0.07, -s2 * 0.26, s2 * 0.14, s2 * 0.1);
        });
        g.strokeStyle = ART_CUIR; g.lineWidth = Math.max(1, s2 * 0.035); g.lineCap = 'round';
        g.beginPath();                              // la mèche
        g.moveTo(0, -s2 * 0.26);
        g.quadraticCurveTo(s2 * 0.18, -s2 * 0.4, s2 * 0.1, -s2 * 0.46);
        g.stroke(); g.lineCap = 'butt';
        g.fillStyle = '#ffd77a';
        g.beginPath(); g.arc(s2 * 0.1, -s2 * 0.47, s2 * 0.05, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff3c8';
        g.beginPath(); g.arc(s2 * 0.1, -s2 * 0.47, s2 * 0.022, 0, Math.PI * 2); g.fill();
      },
      // ---------------- BOUCLIER ----------------
      bouclier(g, s2, M) {
        artPath(g, s2, M.chaud, () => {
          g.beginPath();
          g.moveTo(-s2 * 0.3, -s2 * 0.34);
          g.lineTo(s2 * 0.3, -s2 * 0.34);
          g.lineTo(s2 * 0.28, s2 * 0.1);
          g.quadraticCurveTo(0, s2 * 0.44, -s2 * 0.28, s2 * 0.1);
          g.closePath();
        });
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.moveTo(-s2 * 0.3, -s2 * 0.34); g.lineTo(0, -s2 * 0.34);
        g.lineTo(0, s2 * 0.4); g.quadraticCurveTo(-s2 * 0.2, s2 * 0.2, -s2 * 0.28, s2 * 0.1);
        g.closePath(); g.fill();
        g.strokeStyle = M.or; g.lineWidth = Math.max(1.2, s2 * 0.04);
        g.beginPath(); g.moveTo(0, -s2 * 0.3); g.lineTo(0, s2 * 0.34); g.stroke();
        g.beginPath(); g.moveTo(-s2 * 0.26, -s2 * 0.06); g.lineTo(s2 * 0.26, -s2 * 0.06); g.stroke();
        artPath(g, s2, M.or, () => {               // l'umbo
          g.beginPath(); g.arc(0, -s2 * 0.06, s2 * 0.08, 0, Math.PI * 2);
        });
      },
    };

    // ---- LES PIÈCES D'ARMURE : une silhouette par emplacement, une TEXTURE
    //      par famille. On ne redessine pas 16 fois le même casque.
    function artTexture(g, s2, fam, x, y, w, h) {
      g.save();
      g.beginPath();
      (g.roundRect ? g.roundRect(x, y, w, h, s2 * 0.03) : g.rect(x, y, w, h));
      g.clip();
      if (fam === 'plaque') {                       // deux plaques rivetées
        g.strokeStyle = 'rgba(20,18,16,0.35)'; g.lineWidth = Math.max(0.8, s2 * 0.022);
        g.beginPath(); g.moveTo(x, y + h * 0.45); g.lineTo(x + w, y + h * 0.45); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 3; i++) {
          g.beginPath(); g.arc(x + w * (0.2 + i * 0.3), y + h * 0.2, s2 * 0.016, 0, Math.PI * 2); g.fill();
        }
      } else if (fam === 'maille') {                // les anneaux
        g.strokeStyle = 'rgba(20,18,16,0.3)'; g.lineWidth = Math.max(0.6, s2 * 0.014);
        const r = s2 * 0.035;
        for (let yy = y; yy < y + h; yy += r * 1.5) {
          for (let xx = x + ((Math.round(yy / (r * 1.5)) % 2) ? r : 0); xx < x + w; xx += r * 2) {
            g.beginPath(); g.arc(xx, yy, r * 0.62, 0, Math.PI * 2); g.stroke();
          }
        }
      } else if (fam === 'cuir') {                  // coutures et sangle
        g.strokeStyle = 'rgba(40,28,16,0.4)'; g.lineWidth = Math.max(0.7, s2 * 0.018);
        g.setLineDash([s2 * 0.03, s2 * 0.026]);
        g.beginPath(); g.moveTo(x + w * 0.16, y); g.lineTo(x + w * 0.16, y + h); g.stroke();
        g.beginPath(); g.moveTo(x + w * 0.84, y); g.lineTo(x + w * 0.84, y + h); g.stroke();
        g.setLineDash([]);
      } else {                                      // robe : des plis
        g.strokeStyle = 'rgba(30,24,40,0.28)'; g.lineWidth = Math.max(0.7, s2 * 0.018);
        for (let i = 1; i < 4; i++) {
          const xx = x + w * (i / 4);
          g.beginPath(); g.moveTo(xx, y); g.quadraticCurveTo(xx + w * 0.04, y + h * 0.5, xx, y + h); g.stroke();
        }
      }
      g.restore();
    }
    const ART_TEINTE = { plaque: '#8e949a', maille: '#7f858c', cuir: '#8a6238', robe: '#6a5a8c' };
    const ART_PIECE = {
      casque(g, s2, M, fam) {
        const col = ART_TEINTE[fam];
        artPath(g, s2, col, () => {                 // la calotte
          g.beginPath();
          g.moveTo(-s2 * 0.26, s2 * 0.14);
          g.quadraticCurveTo(-s2 * 0.28, -s2 * 0.34, 0, -s2 * 0.34);
          g.quadraticCurveTo(s2 * 0.28, -s2 * 0.34, s2 * 0.26, s2 * 0.14);
          g.closePath();
        });
        artTexture(g, s2, fam, -s2 * 0.26, -s2 * 0.34, s2 * 0.52, s2 * 0.48);
        g.fillStyle = 'rgba(20,18,16,0.7)';         // la vue
        g.fillRect(-s2 * 0.19, -s2 * 0.06, s2 * 0.38, s2 * 0.07);
        artPath(g, s2, M.or, () => {                // le nasal
          g.beginPath(); g.rect(-s2 * 0.035, -s2 * 0.14, s2 * 0.07, s2 * 0.3);
        });
      },
      armure(g, s2, M, fam) {
        const col = ART_TEINTE[fam];
        artPath(g, s2, col, () => {                 // le plastron
          g.beginPath();
          g.moveTo(-s2 * 0.3, -s2 * 0.26);
          g.lineTo(-s2 * 0.16, -s2 * 0.34); g.lineTo(s2 * 0.16, -s2 * 0.34);
          g.lineTo(s2 * 0.3, -s2 * 0.26);
          g.lineTo(s2 * 0.24, s2 * 0.3);
          g.quadraticCurveTo(0, s2 * 0.44, -s2 * 0.24, s2 * 0.3);
          g.closePath();
        });
        artTexture(g, s2, fam, -s2 * 0.3, -s2 * 0.34, s2 * 0.6, s2 * 0.76);
        artPath(g, s2, M.or, () => {                // le col
          g.beginPath(); g.rect(-s2 * 0.12, -s2 * 0.36, s2 * 0.24, s2 * 0.07);
        });
      },
      gants(g, s2, M, fam) {
        const col = ART_TEINTE[fam];
        artPath(g, s2, col, () => {                 // la paume
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.2, -s2 * 0.1, s2 * 0.4, s2 * 0.34, s2 * 0.05)
                       : g.rect(-s2 * 0.2, -s2 * 0.1, s2 * 0.4, s2 * 0.34));
        });
        artTexture(g, s2, fam, -s2 * 0.2, -s2 * 0.1, s2 * 0.4, s2 * 0.34);
        for (let i = 0; i < 4; i++) {               // les doigts
          artPath(g, s2, col, () => {
            g.beginPath();
            (g.roundRect ? g.roundRect(-s2 * 0.19 + i * s2 * 0.1, -s2 * 0.34, s2 * 0.08, s2 * 0.26, s2 * 0.03)
                         : g.rect(-s2 * 0.19 + i * s2 * 0.1, -s2 * 0.34, s2 * 0.08, s2 * 0.26));
          });
        }
        artPath(g, s2, ART_CUIR, () => {            // la manchette
          g.beginPath(); g.rect(-s2 * 0.22, s2 * 0.22, s2 * 0.44, s2 * 0.1);
        });
      },
      bottes(g, s2, M, fam) {
        const col = ART_TEINTE[fam];
        artPath(g, s2, col, () => {                 // la tige
          g.beginPath();
          g.moveTo(-s2 * 0.16, -s2 * 0.36);
          g.lineTo(s2 * 0.12, -s2 * 0.36);
          g.lineTo(s2 * 0.14, s2 * 0.16);
          g.lineTo(s2 * 0.34, s2 * 0.2);
          g.lineTo(s2 * 0.34, s2 * 0.36);
          g.lineTo(-s2 * 0.18, s2 * 0.36);
          g.closePath();
        });
        artTexture(g, s2, fam, -s2 * 0.18, -s2 * 0.36, s2 * 0.52, s2 * 0.72);
        artPath(g, s2, '#3a2f22', () => {           // la semelle
          g.beginPath(); g.rect(-s2 * 0.2, s2 * 0.3, s2 * 0.56, s2 * 0.09);
        });
        g.strokeStyle = M.or; g.lineWidth = Math.max(1, s2 * 0.03);
        g.beginPath(); g.moveTo(-s2 * 0.16, -s2 * 0.24); g.lineTo(s2 * 0.13, -s2 * 0.24); g.stroke();
      },
    };
    const ART_BIJOU = {
      bijou_amulette(g, s2, M) {
        g.strokeStyle = ART_CUIR; g.lineWidth = Math.max(1, s2 * 0.03);
        g.beginPath(); g.arc(0, -s2 * 0.1, s2 * 0.26, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke();
        artPath(g, s2, M.or, () => {
          g.beginPath();
          g.moveTo(0, s2 * 0.34); g.lineTo(s2 * 0.18, s2 * 0.06);
          g.lineTo(0, -s2 * 0.16); g.lineTo(-s2 * 0.18, s2 * 0.06);
          g.closePath();
        });
        g.fillStyle = M.gemme || '#e8e0cc';
        g.beginPath(); g.arc(0, s2 * 0.08, s2 * 0.08, 0, Math.PI * 2); g.fill();
      },
      bijou_anneau(g, s2, M) {
        g.strokeStyle = M.or; g.lineWidth = Math.max(2, s2 * 0.09);
        g.beginPath(); g.arc(0, s2 * 0.08, s2 * 0.24, 0, Math.PI * 2); g.stroke();
        artInk(g, s2); g.stroke();
        artPath(g, s2, M.gemme || M.froid, () => {
          g.beginPath();
          g.moveTo(0, -s2 * 0.36); g.lineTo(s2 * 0.13, -s2 * 0.2);
          g.lineTo(0, -s2 * 0.04); g.lineTo(-s2 * 0.13, -s2 * 0.2);
          g.closePath();
        });
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath(); g.moveTo(0, -s2 * 0.34); g.lineTo(s2 * 0.06, -s2 * 0.21); g.lineTo(0, -s2 * 0.12); g.closePath(); g.fill();
      },
      bijou_fetiche(g, s2, M) {
        g.strokeStyle = ART_CUIR; g.lineWidth = Math.max(1, s2 * 0.028);
        g.beginPath(); g.moveTo(-s2 * 0.2, -s2 * 0.34); g.lineTo(s2 * 0.2, -s2 * 0.34); g.stroke();
        for (const dx of [-0.14, 0, 0.14]) {        // trois plumes pendues
          g.save();
          g.translate(dx * s2, -s2 * 0.3);
          g.rotate(dx * 0.5);
          artPath(g, s2, dx === 0 ? (M.gemme || '#c8b48a') : '#b6a184', () => {
            g.beginPath(); g.ellipse(0, s2 * 0.2, s2 * 0.055, s2 * 0.22, 0, 0, Math.PI * 2);
          });
          g.strokeStyle = 'rgba(60,46,30,0.5)'; g.lineWidth = Math.max(0.6, s2 * 0.016);
          g.beginPath(); g.moveTo(0, s2 * 0.02); g.lineTo(0, s2 * 0.4); g.stroke();
          g.restore();
        }
      },
      bijou_lunette(g, s2, M) {
        artPath(g, s2, M.chaud, () => {             // le corps
          g.beginPath();
          (g.roundRect ? g.roundRect(-s2 * 0.34, -s2 * 0.1, s2 * 0.44, s2 * 0.2, s2 * 0.04)
                       : g.rect(-s2 * 0.34, -s2 * 0.1, s2 * 0.44, s2 * 0.2));
        });
        artPath(g, s2, M.or, () => {                // le tube tiré
          g.beginPath();
          (g.roundRect ? g.roundRect(s2 * 0.08, -s2 * 0.14, s2 * 0.28, s2 * 0.28, s2 * 0.04)
                       : g.rect(s2 * 0.08, -s2 * 0.14, s2 * 0.28, s2 * 0.28));
        });
        g.fillStyle = M.gemme || '#9fd0e8';         // la lentille
        g.beginPath(); g.ellipse(s2 * 0.34, 0, s2 * 0.05, s2 * 0.13, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath(); g.ellipse(s2 * 0.34, -s2 * 0.04, s2 * 0.02, s2 * 0.05, 0, 0, Math.PI * 2); g.fill();
      },
    };
    // le dessin d'une pièce, quelle qu'elle soit
    function drawItemArt(g, baseId, size, rarityId) {
      const M = RARETE_METAL[rarityId] || RARETE_METAL.commun;
      const fn = ITEM_ART[baseId] || ART_BIJOU[baseId];
      g.save();
      g.translate(size / 2, size / 2);
      g.lineJoin = 'round';
      if (fn) { try { fn(g, size, M); } catch (e) { } }
      else {
        // pièce d'armure : silhouette de l'emplacement + texture de la famille
        const part = baseId.split('_');
        const dessin = ART_PIECE[part[0]];
        if (dessin) { try { dessin(g, size, M, part[1] || 'plaque'); } catch (e) { } }
      }
      g.restore();
      return !!(fn || ART_PIECE[baseId.split('_')[0]]);
    }

    // ------------------------------------------------------------
    // LES MONSTRES DU DONJON — bipèdes, comme tout le monde ici
    // ------------------------------------------------------------
    // Ils étaient dessinés à quatre pattes : ça ne collait pas. Dans ce jeu les
    // chats et les oiseaux se tiennent DEBOUT, avec des bras et une arme — un
    // quadrupède au milieu d'eux ressemble à une pièce venue d'un autre jeu.
    // Tous partagent donc le même squelette humanoïde, décliné en carrure, en
    // pelage, en tête et en arme.
    //
    // Repère local : (0,0) = les pieds au sol, on regarde vers la DROITE,
    // `s` = hauteur totale.
    function membre(g, x, y, len, ang, col, w) {
      g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.sin(ang) * len * 0.55, y + len * 0.55,
                         x + Math.sin(ang) * len, y + len * 0.96);
      g.stroke();
      g.lineCap = 'butt';
    }
    // l'arme que la bête tient dans sa patte avant
    function armeMonstre(g, s2, kind, T) {
      g.save();
      if (kind === 'gourdin') {
        g.strokeStyle = '#6b4c2a'; g.lineWidth = s2 * 0.055; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(s2 * 0.05, -s2 * 0.3); g.stroke();
        g.fillStyle = '#7d5a32';
        g.beginPath(); g.ellipse(s2 * 0.06, -s2 * 0.36, s2 * 0.075, s2 * 0.1, 0.2, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#4a3620';
        for (const q of [[-0.03, -0.4], [0.05, -0.33]]) {
          g.beginPath(); g.arc(q[0] * s2 + s2 * 0.06, q[1] * s2, s2 * 0.018, 0, Math.PI * 2); g.fill();
        }
      } else if (kind === 'lame') {
        g.strokeStyle = '#4a4038'; g.lineWidth = s2 * 0.035;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s2 * 0.06); g.stroke();
        g.fillStyle = '#c8cdd4';
        g.beginPath();
        g.moveTo(-s2 * 0.022, -s2 * 0.07); g.lineTo(s2 * 0.022, -s2 * 0.07);
        g.lineTo(s2 * 0.012, -s2 * 0.36); g.lineTo(0, -s2 * 0.4); g.lineTo(-s2 * 0.012, -s2 * 0.36);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(60,66,74,0.6)'; g.lineWidth = 0.8; g.stroke();
      } else if (kind === 'fronde') {
        g.strokeStyle = '#7a6a4a'; g.lineWidth = s2 * 0.02;
        g.beginPath(); g.arc(0, -s2 * 0.12, s2 * 0.1, 0.4, Math.PI - 0.4); g.stroke();
        g.fillStyle = '#5d5348';
        g.beginPath(); g.arc(0, -s2 * 0.02, s2 * 0.035, 0, Math.PI * 2); g.fill();
      } else if (kind === 'fiole') {
        g.fillStyle = '#3f6b32';
        g.beginPath(); g.ellipse(0, -s2 * 0.09, s2 * 0.055, s2 * 0.07, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#8fd06a';
        g.beginPath(); g.ellipse(-s2 * 0.015, -s2 * 0.1, s2 * 0.022, s2 * 0.03, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#6b5a3a';
        g.fillRect(-s2 * 0.02, -s2 * 0.17, s2 * 0.04, s2 * 0.05);
        const bul = 0.5 + 0.5 * Math.sin(T * 5);
        g.globalAlpha = bul; g.fillStyle = '#b8f090';
        g.beginPath(); g.arc(0, -s2 * 0.21, s2 * 0.02, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      } else if (kind === 'pique') {
        g.strokeStyle = '#6b4c2a'; g.lineWidth = s2 * 0.028; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, s2 * 0.05); g.lineTo(s2 * 0.03, -s2 * 0.42); g.stroke();
        g.fillStyle = '#c8cdd4';
        g.beginPath();
        g.moveTo(s2 * 0.03, -s2 * 0.52); g.lineTo(s2 * 0.06, -s2 * 0.4);
        g.lineTo(s2 * 0.0, -s2 * 0.4); g.closePath(); g.fill();
        g.lineCap = 'butt';
      }
      g.restore();
    }
    // LE SQUELETTE COMMUN : jambes, torse, bras, tête, oreilles, queue.
    function bipede(g, s2, ph, moving, C) {
      const sw = Math.sin(ph) * (moving ? 1 : 0.14);
      const bob = Math.abs(Math.sin(ph)) * s2 * (moving ? 0.028 : 0.01);
      const hanche = -s2 * (C.jambe || 0.36);
      const epaule = hanche - s2 * (C.torse || 0.3);
      const lw = Math.max(1.6, s2 * 0.07);
      const sombre = shade(C.corps, 0.7);
      g.save();
      g.translate(0, -bob);

      // ---- queue, tout derrière ----
      const qx = -s2 * 0.1, qy = hanche + s2 * 0.04;
      if (C.queue === 'nue') {
        g.strokeStyle = '#c99a94'; g.lineWidth = Math.max(1.1, s2 * 0.035); g.lineCap = 'round';
        g.beginPath(); g.moveTo(qx, qy);
        g.quadraticCurveTo(qx - s2 * 0.3, qy - s2 * 0.12 + sw * s2 * 0.05, qx - s2 * 0.36, qy + s2 * 0.16);
        g.stroke(); g.lineCap = 'butt';
      } else if (C.queue === 'panache') {
        g.fillStyle = C.corps;
        g.beginPath();
        g.moveTo(qx, qy - s2 * 0.05);
        g.quadraticCurveTo(qx - s2 * 0.34, qy - s2 * 0.24 + sw * s2 * 0.04, qx - s2 * 0.4, qy + s2 * 0.1);
        g.quadraticCurveTo(qx - s2 * 0.2, qy + s2 * 0.12, qx, qy + s2 * 0.08);
        g.closePath(); g.fill();
        g.fillStyle = C.bout || '#f7efe2';
        g.beginPath(); g.ellipse(qx - s2 * 0.36, qy - s2 * 0.06, s2 * 0.075, s2 * 0.07, 0, 0, Math.PI * 2); g.fill();
      } else if (C.queue === 'touffue' || C.queue === 'longue') {
        g.strokeStyle = C.corps; g.lineWidth = s2 * (C.queue === 'touffue' ? 0.075 : 0.05); g.lineCap = 'round';
        g.beginPath(); g.moveTo(qx, qy);
        g.quadraticCurveTo(qx - s2 * 0.26, qy - s2 * 0.2, qx - s2 * 0.18 + Math.sin(ph * 3) * s2 * 0.05, qy - s2 * 0.3);
        g.stroke(); g.lineCap = 'butt';
      } else if (C.queue === 'plumes') {
        g.fillStyle = sombre;
        g.beginPath();
        g.moveTo(qx, qy - s2 * 0.06); g.lineTo(qx - s2 * 0.3, qy + s2 * 0.06);
        g.lineTo(qx - s2 * 0.28, qy - s2 * 0.12); g.closePath(); g.fill();
      }

      // ---- jambe arrière, puis bras arrière (derrière le torse) ----
      membre(g, -s2 * 0.05, hanche, s2 * (C.jambe || 0.36), -sw * 0.55, sombre, lw);
      membre(g, -s2 * 0.02, epaule + s2 * 0.03, s2 * (C.bras || 0.3), sw * 0.5, sombre, lw * 0.85);

      // ---- le torse ----
      g.fillStyle = C.corps;
      g.beginPath();
      g.moveTo(-s2 * 0.15, hanche + s2 * 0.03);
      g.quadraticCurveTo(-s2 * 0.19, epaule + s2 * 0.05, -s2 * 0.13, epaule);
      g.lineTo(s2 * 0.13, epaule);
      g.quadraticCurveTo(s2 * 0.19, epaule + s2 * 0.05, s2 * 0.15, hanche + s2 * 0.03);
      g.closePath(); g.fill();
      g.fillStyle = C.ventre;                       // le plastron clair
      g.beginPath();
      g.ellipse(s2 * 0.02, (hanche + epaule) / 2 + s2 * 0.02, s2 * 0.1, Math.abs(epaule - hanche) * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK; g.lineWidth = Math.max(0.9, s2 * 0.022);
      g.beginPath();
      g.moveTo(-s2 * 0.15, hanche + s2 * 0.03);
      g.quadraticCurveTo(-s2 * 0.19, epaule + s2 * 0.05, -s2 * 0.13, epaule);
      g.lineTo(s2 * 0.13, epaule);
      g.quadraticCurveTo(s2 * 0.19, epaule + s2 * 0.05, s2 * 0.15, hanche + s2 * 0.03);
      g.closePath(); g.stroke();
      if (C.ceinture) {                             // une ceinture, ça habille
        g.fillStyle = '#4a3a24';
        g.fillRect(-s2 * 0.16, hanche - s2 * 0.02, s2 * 0.32, s2 * 0.045);
        g.fillStyle = '#c9a03a';
        g.fillRect(-s2 * 0.03, hanche - s2 * 0.03, s2 * 0.06, s2 * 0.065);
      }

      // ---- jambe avant ----
      membre(g, s2 * 0.05, hanche, s2 * (C.jambe || 0.36), sw * 0.55, C.corps, lw);

      // ---- LA TÊTE ----
      const tr = s2 * (C.tete || 0.15);
      const ty = epaule - tr * 0.85;
      g.save();
      g.translate(s2 * 0.02, ty);
      g.rotate(Math.sin(ph) * (moving ? 0.05 : 0.018));
      // oreilles / crête, derrière le crâne
      g.fillStyle = shade(C.corps, 0.88);
      if (C.oreille === 'pointue') {
        for (const dx of [-0.45, 0.25]) {
          g.beginPath();
          g.moveTo(dx * tr, -tr * 0.55); g.lineTo(dx * tr - tr * 0.1, -tr * 1.7);
          g.lineTo(dx * tr + tr * 0.55, -tr * 0.75); g.closePath(); g.fill();
        }
      } else if (C.oreille === 'ronde') {
        g.beginPath(); g.arc(-tr * 0.45, -tr * 0.7, tr * 0.42, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(tr * 0.35, -tr * 0.8, tr * 0.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#dda9a3';
        g.beginPath(); g.arc(-tr * 0.45, -tr * 0.7, tr * 0.22, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(tr * 0.35, -tr * 0.8, tr * 0.21, 0, Math.PI * 2); g.fill();
      } else if (C.oreille === 'tombante') {
        g.beginPath();
        g.ellipse(-tr * 0.5, -tr * 0.05, tr * 0.28, tr * 0.6, 0.3 + Math.sin(ph) * 0.09, 0, Math.PI * 2);
        g.fill();
      } else if (C.oreille === 'huppe') {
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(i * tr * 0.16 - tr * 0.1, -tr * 0.7);
          g.lineTo(i * tr * 0.24 - tr * 0.3, -tr * 1.5);
          g.lineTo(i * tr * 0.16 + tr * 0.1, -tr * 0.75); g.closePath(); g.fill();
        }
      } else {
        g.beginPath(); g.arc(-tr * 0.35, -tr * 0.65, tr * 0.25, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(tr * 0.3, -tr * 0.7, tr * 0.24, 0, Math.PI * 2); g.fill();
      }
      // crâne
      g.fillStyle = C.corps;
      g.beginPath(); g.ellipse(0, 0, tr * 0.9, tr * 0.82, 0, 0, Math.PI * 2); g.fill();
      if (C.raie) {
        g.fillStyle = '#efe9dd';
        g.beginPath(); g.ellipse(tr * 0.25, -tr * 0.1, tr * 0.72, tr * 0.28, -0.1, 0, Math.PI * 2); g.fill();
      }
      // museau ou bec
      if (C.bec) {
        g.fillStyle = '#3a3038';
        g.beginPath();
        g.moveTo(tr * 0.55, -tr * 0.12); g.lineTo(tr * 1.5, tr * 0.02);
        g.lineTo(tr * 0.55, tr * 0.22); g.closePath(); g.fill();
      } else {
        g.fillStyle = C.corps;
        g.beginPath(); g.ellipse(tr * 0.68, tr * 0.18, tr * 0.46, tr * 0.32, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = C.museau || '#3a3028';
        g.beginPath(); g.ellipse(tr * 1.06, tr * 0.14, tr * 0.15, tr * 0.12, 0, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = INK; g.lineWidth = Math.max(0.8, s2 * 0.02);
      g.beginPath(); g.ellipse(0, 0, tr * 0.9, tr * 0.82, 0, 0, Math.PI * 2); g.stroke();
      if (C.defenses) {                             // les canines du sanglier
        g.fillStyle = '#f0e6cc'; g.strokeStyle = INK; g.lineWidth = Math.max(0.7, s2 * 0.016);
        g.beginPath();
        g.moveTo(tr * 0.9, tr * 0.32);
        g.quadraticCurveTo(tr * 1.3, tr * 0.24, tr * 1.12, -tr * 0.1);
        g.quadraticCurveTo(tr * 1.0, tr * 0.16, tr * 0.9, tr * 0.32);
        g.fill(); g.stroke();
      }
      // l'œil
      g.fillStyle = C.oeil || '#241e18';
      g.beginPath(); g.arc(tr * 0.36, -tr * 0.22, tr * 0.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(tr * 0.41, -tr * 0.28, tr * 0.055, 0, Math.PI * 2); g.fill();
      g.restore();

      // ---- bras avant + son arme ----
      const bx = s2 * 0.12, by = epaule + s2 * 0.03;
      const bl = s2 * (C.bras || 0.3);
      membre(g, bx, by, bl, -sw * 0.5 + 0.25, C.corps, lw * 0.85);
      g.save();
      g.translate(bx + Math.sin(-sw * 0.5 + 0.25) * bl, by + bl * 0.96);
      g.rotate(-0.25 + sw * 0.12);
      armeMonstre(g, s2, C.arme, ph);
      g.restore();
      g.restore();
    }
    const BESTIAIRE = {
      rat:      { jambe: 0.3,  torse: 0.28, bras: 0.26, tete: 0.14, oreille: 'ronde',    queue: 'nue',
                  corps: '#8d8478', ventre: '#c8c0af', museau: '#dba9a3', arme: 'lame',    oeil: '#3a1e1e' },
      chien:    { jambe: 0.34, torse: 0.32, bras: 0.3,  tete: 0.16, oreille: 'tombante', queue: 'touffue',
                  corps: '#a5763f', ventre: '#dcb787', arme: 'gourdin', ceinture: 1 },
      renard:   { jambe: 0.34, torse: 0.3,  bras: 0.29, tete: 0.155, oreille: 'pointue', queue: 'panache',
                  corps: '#d2723a', ventre: '#f4e6d2', bout: '#f9f2e6', arme: 'lame', oeil: '#2a1a08' },
      blaireau: { jambe: 0.28, torse: 0.36, bras: 0.28, tete: 0.17, oreille: 'petite',   queue: 'courte',
                  corps: '#4e4a48', ventre: '#b8b2a8', raie: 1, arme: 'gourdin' },
      fouine:   { jambe: 0.36, torse: 0.26, bras: 0.3,  tete: 0.13, oreille: 'petite',   queue: 'longue',
                  corps: '#7d5a34', ventre: '#ecdfc2', arme: 'lame', ceinture: 1 },
      sanglier: { jambe: 0.32, torse: 0.4,  bras: 0.31, tete: 0.19, oreille: 'petite',   queue: 'courte',
                  corps: '#4f3b2c', ventre: '#6d5544', defenses: 1, arme: 'pique' },
      corbeau:  { jambe: 0.34, torse: 0.28, bras: 0.28, tete: 0.14, oreille: 'huppe',    queue: 'plumes',
                  corps: '#2e2836', ventre: '#4a4152', bec: 1, arme: 'fronde', oeil: '#e8d24a' },
      crapaud:  { jambe: 0.26, torse: 0.34, bras: 0.26, tete: 0.17, oreille: 'petite',   queue: 'courte',
                  corps: '#5c9147', ventre: '#d8dc92', museau: '#3f6b32', arme: 'fiole', oeil: '#f0d040' },
    };
    const DUNGEON_FOES = {};
    for (const id in BESTIAIRE) {
      DUNGEON_FOES[id] = (function (C) {
        return function (g, s2, ph, moving) { bipede(g, s2, ph, moving, C); };
      })(BESTIAIRE[id]);
    }

    // ------------------------------------------------------------
    // BIOME DECOR — 6 thèmes du donjon
    // ------------------------------------------------------------
    const BIOME_DECOR = {
      tour:        { props: ['torche', 'torche', 'brasero', 'livres', 'statue', 'coffre'], rocks: 2, columns: 3,
                     wall: '#7a7264', wallLip: '#a9a08e', floor: '#a99f8c', joint: 'rgba(50,44,32,0.18)',
                     particle: 'dust', particleCol: 'rgba(180,160,120,' },
      grotte:      { props: ['stalagmite', 'stalagmite', 'flaque', 'champignon', 'torche', 'os'], rocks: 5,
                     wall: '#4a4440', wallLip: '#6e645c', floor: '#7a7068', joint: 'rgba(30,24,18,0.22)',
                     particle: 'drip', particleCol: 'rgba(140,180,200,' },
      cristaux:    { props: ['cristal', 'cristal', 'cristal', 'stalagmite', 'coffre'], rocks: 3, crystals: 10,
                     wall: '#3e3860', wallLip: '#6a5f9a', floor: '#5a5080', joint: 'rgba(20,16,40,0.20)',
                     particle: 'sparkle', particleCol: 'rgba(180,160,255,' },
      champignons: { props: ['champignon', 'champignon', 'champignon', 'mousse', 'mousse', 'flaque'], rocks: 2, glowShrooms: 1,
                     wall: '#3a5a3a', wallLip: '#5a8a5a', floor: '#4a6a42', joint: 'rgba(20,40,18,0.18)',
                     particle: 'spore', particleCol: 'rgba(160,220,140,' },
      lave:        { props: ['geyser', 'geyser', 'os', 'stalagmite', 'brasero'], rocks: 6, lava: 6,
                     wall: '#5a2a1a', wallLip: '#8a4a2a', floor: '#6a3a28', joint: 'rgba(40,16,8,0.24)',
                     particle: 'ember', particleCol: 'rgba(255,160,60,' },
      morts:       { props: ['tombe', 'tombe', 'os', 'os', 'toile', 'torche'], rocks: 4, columns: 2,
                     wall: '#4a4a52', wallLip: '#7a7a86', floor: '#5a5a64', joint: 'rgba(20,20,28,0.20)',
                     particle: 'wisp', particleCol: 'rgba(140,220,180,' },
    };
    const decorOf = id => BIOME_DECOR[id] || BIOME_DECOR.tour;

    // On ne jette plus le mobilier au hasard sur l'anneau extérieur : on COMPOSE
    // la salle. Les torches rythment les murs, une paire d'objets encadre le
    // fond, le reste habite les bords — et rien ne se pose sur un obstacle, un
    // tonneau, le couloir d'entrée ou l'aire de spawn. Ce qui est haut devient
    // un vrai obstacle : la salle se lit et se joue pareil.
    function buildDecor(biomeId, seed, obstacles, barrels) {
      const D = decorOf(biomeId);
      const rng = rngOf(seed || 1);
      const list = [], solides = [];
      // `busy` = ce qui occupe physiquement le sol ; `couloirs` = ce qu'on ne
      // bouche jamais pour que la salle reste jouable. Un objet ACCROCHÉ AU MUR
      // (torche, toile) ne gêne personne : il ignore les couloirs.
      const busy = [];
      for (const o of (obstacles || [])) busy.push({ x: o.x, y: o.y, r: o.r + CELL * 0.4 });
      for (const b of (barrels || [])) busy.push({ x: b.x, y: b.y, r: b.r + CELL * 0.55 });
      // Les COULOIRS qu'un objet posé au sol ne bouche jamais. Un objet
      // accroché au mur (torche, toile) ne gêne personne : il les ignore.
      const couloirs = [
        { x: cx(), y: H, r: CELL * 3 },          // l'arrivée de la compagnie
        { x: cx(), y: cyc(), r: CELL * 2.4 },    // le centre reste jouable
      ];
      // L'ESCALIER, lui, s'impose à TOUT LE MONDE : il est percé DANS le mur du
      // fond, une applique posée dessus se retrouverait au milieu de l'arche.
      const sortie = { x: stairX(), y: stairY(), r: CELL * 2.3 };
      const libre = (x, y, r, mural) => {
        if (x < CELL * 0.5 || x > W - CELL * 0.5 || y < CELL * 0.5 || y > H - CELL * 0.6) return false;
        for (const b of busy) if (Math.hypot(x - b.x, y - b.y) < b.r + r) return false;
        if (Math.hypot(x - sortie.x, y - sortie.y) < sortie.r + r) return false;
        if (!mural) for (const b of couloirs) if (Math.hypot(x - b.x, y - b.y) < b.r + r) return false;
        return true;
      };
      const poser = (kind, x, y, sizeK, extra) => {
        const mural = kind === 'torche' || kind === 'toile';
        // plancher d'encombrement : même une applique menue garde ses distances,
        // sinon une touffe de mousse vient se coller sous la flamme.
        const r = CELL * Math.max(0.32, (PROP_FOOT[kind] || 0.4) * 0.9);
        if (!libre(x, y, r, mural)) return false;
        busy.push({ x, y, r });
        const size = Math.round(CELL * sizeK * (0.9 + rng() * 0.28));
        const d = Object.assign({ kind, size, x, y, seed: 1 + Math.floor(rng() * 900) }, extra || {});
        list.push(d);
        if (PROP_SOLIDE[kind]) solides.push({ x, y, r: r * 0.72, kind: 'prop', ghost: true });
        return true;
      };
      const veut = k => D.props.indexOf(k) >= 0;
      const glow = !!D.glowShrooms;

      // 1) LES TORCHES SONT AU MUR, à intervalle régulier : ça éclaire ET ça
      //    donne une cadence à la salle (une torche tous les 4 carreaux).
      if (veut('torche')) {
        // Collées à la maçonnerie, et petites (0,9 carreau de gabarit → moins
        // des deux tiers d'un carreau une fois dessinées). Sur le mur du fond
        // elles ENCADRENT l'escalier par paires symétriques au lieu de défiler
        // à intervalle fixe : sinon l'une d'elles tombait sur l'arche.
        for (const dx of [2.6, 5.2, 7.2]) {
          poser('torche', stairX() - dx * CELL, CELL * 0.52, PROP_TAILLE.torche);
          poser('torche', stairX() + dx * CELL, CELL * 0.52, PROP_TAILLE.torche);
        }
        for (let gy = 3; gy < GRID_H - 2; gy += 4) {
          poser('torche', CELL * 0.5, (gy + 0.5) * CELL, PROP_TAILLE.torche);
          poser('torche', W - CELL * 0.5, (gy + 0.5) * CELL, PROP_TAILLE.torche);
        }
      }
      // 2) LES TOILES pendent dans les angles hauts, jamais ailleurs.
      if (veut('toile')) {
        poser('toile', CELL * 1.1, CELL * 1.1, PROP_TAILLE.toile);
        poser('toile', W - CELL * 1.1, CELL * 1.1, PROP_TAILLE.toile);
      }
      // 3) UNE PAIRE SYMÉTRIQUE encadre le fond : l'œil a un point d'ancrage.
      const paire = D.props.find(k => k !== 'torche' && k !== 'toile' && !PROP_FLAT[k]);
      if (paire) {
        poser(paire, CELL * 2.3, CELL * 2.1, PROP_TAILLE[paire] || 1.3);
        poser(paire, W - CELL * 2.3, CELL * 2.1, PROP_TAILLE[paire] || 1.3);
      }
      // 4) LE RESTE habite les bords, avec une chance de doubler en miroir.
      const reste = D.props.filter(k => k !== 'torche' && k !== 'toile');
      for (const kind of reste) {
        for (let tries = 0; tries < 24; tries++) {
          const gauche = rng() < 0.5;
          const gx = gauche ? rng() * 3.2 : GRID_W - 3.2 + rng() * 3.2;
          const gy = 1 + rng() * (GRID_H - 2.5);
          const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL;
          const tk = PROP_TAILLE[kind] || 1.3;
          if (!poser(kind, x, y, tk, glow && kind === 'champignon' ? { glow: 1 } : null)) continue;
          if (rng() < 0.35) poser(kind, W - x, y, tk * 0.9, glow && kind === 'champignon' ? { glow: 1 } : null);
          break;
        }
      }
      // 5) Des petites touches au sol pour meubler les vides (jamais solides).
      const semis = D.floorProp || (veut('champignon') ? 'mousse' : (veut('os') ? 'os' : null));
      if (semis) {
        for (let i = 0; i < 4; i++) {
          const x = CELL + rng() * (W - CELL * 2), y = CELL + rng() * (H - CELL * 2);
          poser(semis, x, y, (PROP_TAILLE[semis] || 1.3) * 0.75);
        }
      }

      // les nappes peintes au sol (lave, cristaux, colonnes de fond)
      const paint = [];
      for (let i = 0; i < (D.lava || 0); i++)
        paint.push({ kind: 'lava', x: rng() * W, y: rng() * H, r: CELL * (0.7 + rng() * 1.1), a: rng() * 6.28 });
      for (let i = 0; i < (D.crystals || 0); i++)
        paint.push({ kind: 'crystal', x: CELL + rng() * (W - CELL * 2), y: CELL + rng() * (H - CELL * 2),
                     r: CELL * (0.3 + rng() * 0.35), a: rng() * 6.28 });
      const specks = [];
      for (let i = 0; i < 60; i++)
        specks.push({ x: rng() * W, y: rng() * H, r: 1 + rng() * 2.4, a: 0.05 + rng() * 0.09 });
      const cracks = [];
      for (let i = 0; i < 8; i++) {
        const x0 = rng() * W, y0 = rng() * H, a0 = rng() * 6.28, L = CELL * (0.8 + rng() * 2);
        cracks.push({ x: x0, y: y0, x2: x0 + Math.cos(a0) * L, y2: y0 + Math.sin(a0) * L, w: 0.6 + rng() });
      }
      return { list, paint, specks, cracks, cfg: D, solides };
    }

    // ------------------------------------------------------------
    // OBSTACLES SOLIDES + LIGNE DE VUE + COLLISIONS
    // ------------------------------------------------------------
    // Les salles ont des OBSTACLES (piliers, rochers, caisses) qui bloquent le
    // déplacement ET la ligne de vue des tireurs. Le layout varie par étage.
    const LAYOUTS = ['ouvert', 'piliers', 'couvert', 'colonnes', 'encombre'];
    // Les cinq plans de salle. Chaque pose passe par `add` qui REFUSE ce qui
    // chevauche une pierre déjà là, l'entrée ou l'axe central : avant, les
    // dispositions « couvert » et « encombré » tiraient au hasard et empilaient
    // deux rochers sur le même carreau.
    function buildObstacles(floor, seed) {
      const rng = rngOf(seed || 1);
      const layout = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
      const obs = [];
      const m = CELL * 1.2;                 // on ne colle pas aux murs
      const libre = (x, y, r) => {
        if (x < m || x > W - m || y < m || y > H - m) return false;
        if (Math.abs(x - cx()) < CELL * 1.6 && y > H * 0.72) return false;   // devant l'escalier
        if (Math.abs(x - cx()) < CELL * 1.6 && y < CELL * 1.8) return false; // sous l'arrivée ennemie
        for (const o of obs) if (Math.hypot(x - o.x, y - o.y) < o.r + r + CELL * 0.55) return false;
        return true;
      };
      const add = (x, y, r, kind) => {
        if (!libre(x, y, r)) return false;
        obs.push({ x, y, r, kind: kind || 'rock' });
        return true;
      };
      // une pose MIROIR : la salle se lit mieux quand elle a un axe
      const paire = (x, y, r, kind) => { add(x, y, r, kind); add(W - x, y, r, kind); };

      if (layout === 'piliers') {
        paire(W * 0.28, H * 0.32, CELL * 0.55, 'column');
        paire(W * 0.28, H * 0.66, CELL * 0.55, 'column');
      } else if (layout === 'colonnes') {
        // une colonnade décalée de l'axe : on peut passer des deux côtés
        for (let i = 0; i < 3; i++) paire(W * 0.38, H * (0.26 + i * 0.23), CELL * 0.5, 'column');
      } else if (layout === 'couvert') {
        // du couvert éparpillé pour le kite, mais jamais deux pierres soudées
        const n = 5 + Math.floor(rng() * 3);
        for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
          const x = m + rng() * (W - m * 2);
          const y = m + rng() * (H - m * 2.2);
          if (add(x, y, CELL * (0.4 + rng() * 0.22), rng() < 0.5 ? 'rock' : 'crate')) i++;
        }
      } else if (layout === 'encombre') {
        // deux tas symétriques sur les flancs, le centre reste une allée
        for (let i = 0, tries = 0; i < 3 && tries < 40; tries++) {
          const y = m + rng() * (H - m * 2);
          const dx = m + rng() * CELL * 1.8;
          if (add(dx, y, CELL * 0.48, 'crate')) { add(W - dx, y + (rng() - 0.5) * CELL, CELL * 0.48, 'crate'); i++; }
        }
      }
      // 'ouvert' : la salle nue, pour respirer entre deux étages encombrés
      return { list: obs, layout };
    }
    // TONNEAUX EXPLOSIFS : feu / glace / poison. Détruits par les attaques,
    // ils explosent en dégâts élémentaires de zone (amis ET ennemis).
    // ============================================================
    // LES PORTAILS DE TÉLÉPORTATION
    // ============================================================
    // AVANT, les vagues APPARAISSAIENT DE NULLE PART. Deux réponses : entrer
    // par l'escalier, ou sortir de PORTAILS que le joueur doit détruire. On
    // fait les deux — s'il y a des portails vivants, les renforts en sortent ;
    // sinon ils descendent l'escalier.
    //
    // Un portail est un DILEMME : tant qu'il tient, il ponde en chaîne — mais
    // s'en occuper, c'est tourner le dos aux ennemis déjà là. Il vit DANS
    // `arena.foes` : c'est ce qui le rend ciblable par tout le pipeline
    // existant (clic, ciblage, dégâts) sans une ligne de plus. En échange,
    // trois endroits le FILTRENT : la formation (sinon il serait téléporté en
    // rang), l'IA (sinon il « viserait » un héros), et le pas de déplacement.
    function mkPortal(i, x, y, diff, floor) {
      const hp = Math.round(30 * ((diff && diff.hp) || 1) * (1 + floor * 0.04));
      return {
        side: 'foe', id: 'f' + i, portal: true,
        name: 'Portail', type: 'portail',
        tint: '#8a5ad4', elem: null,
        hp, hpMax: hp,
        st: { dmg: 0, aspd: 1, mspd: 0, range: 0, armor: 0.15, hp: 1 },
        x, y, dest: null, target: null, dead: false,
        scale: 1, phase: Math.random() * 6.28, atkT: 0,
        lunge: 0, hitT: 0, deadT: 0, moving: false,
        spawnT: 3.5,           // première ponte rapide : le danger s'annonce
      };
    }
    function portalSpots(floor, seed, obstacles) {
      // pas de portails dans les premiers étages : on apprend d'abord à se battre
      if (floor < 3) return [];
      const rng = rngOf((seed || 1) ^ 0x9e3779b9);
      if (rng() > 0.45) return [];                       // un peu moins d'une salle sur deux
      const n = floor >= 12 && rng() < 0.4 ? 2 : 1;
      const out = [];
      const r = CELL * 0.55;
      const libre = (x, y) => {
        if (Math.hypot(x - stairX(), y - stairY()) < CELL * 2.4) return false;
        for (const o of (obstacles || [])) if (Math.hypot(x - o.x, y - o.y) < o.r + r + CELL * 0.5) return false;
        for (const b of out) if (Math.hypot(x - b.x, y - b.y) < CELL * 3) return false;
        return true;
      };
      for (let i = 0, tries = 0; i < n && tries < 50; tries++) {
        // dans la MOITIÉ HAUTE : un portail collé aux héros serait une exécution
        const x = CELL * 1.5 + rng() * (W - CELL * 3);
        const y = CELL * 1.5 + rng() * (H * 0.45);
        if (libre(x, y)) { out.push({ x, y }); i++; }
      }
      return out;
    }
    // OÙ APPARAÎT UN RENFORT : à un portail vivant s'il y en a — c'est leur
    // raison d'être — sinon au pied de l'escalier. Les ennemis ENTRENT par
    // quelque part, ils ne se matérialisent plus au milieu de la salle.
    function spawnPoint(k) {
      const ports = arena.foes.filter(f => f.portal && !f.dead);
      if (ports.length) {
        const pt = ports[k % ports.length];
        return { x: pt.x + Math.cos(k * 2.4) * CELL * 0.8, y: pt.y + CELL * 0.7 + Math.abs(Math.sin(k * 1.7)) * CELL * 0.5 };
      }
      return { x: stairX() + (k % 3 - 1) * CELL * 0.8, y: stairY() + CELL * (0.8 + Math.floor(k / 3) * 0.7) };
    }

    function buildBarrels(floor, seed, obstacles) {
      const rng = rngOf(seed || 1);
      const elems = ['feu', 'froid', 'poison'];
      const n = 1 + Math.floor(rng() * 3);  // 1-3 tonneaux
      const out = [];
      const r = CELL * 0.4;
      const libre = (x, y) => {
        if (Math.abs(x - cx()) < CELL * 1.6 && y > H * 0.72) return false;   // devant l'escalier
        for (const o of (obstacles || [])) if (Math.hypot(x - o.x, y - o.y) < o.r + r + CELL * 0.5) return false;
        for (const b of out) if (Math.hypot(x - b.x, y - b.y) < r * 2 + CELL * 0.6) return false;
        return true;
      };
      for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
        const x = CELL * 1.5 + rng() * (W - CELL * 3);
        const y = CELL * 1.5 + rng() * (H - CELL * 3.5);
        if (libre(x, y)) out.push({ x, y, elem: elems[Math.floor(rng() * elems.length)], hp: 20, r, dead: false }), i++;
      }
      return out;
    }
    function explodeBarrel(b) {
      if (b.dead) return;
      b.dead = true;
      const E = AD().ELEMENTS[b.elem];
      const radius = CELL * 2.2;
      const dmg = 15 + (arena.floor || 1) * 2;
      // zone visuelle
      arena.zones.push({ kind: 'fx', shape: 'circle', x: b.x, y: b.y, r: radius, t: 0, dur: 0.45, col: E.col });
      burst(b.x, b.y, E.col, 14);
      shakeT = 0.25; shakeMag = 5;
      sfx('spell');
      // dégâts à tout ce qui est dans la zone (amis + ennemis)
      for (const f of arena.foes) {
        if (!f.dead && dist(f, b) < radius) hurtFoe(f, dmg);
      }
      for (const p of arena.party) {
        if (!p.dead && dist(p, b) < radius) hurtHero(p, dmg * 0.7, b.elem);
      }
      arena.floats.push({ x: b.x, y: b.y - CELL, txt: E.icon + ' Boom !', t: 0, col: E.col });
    }
    // endommage les tonneaux proches d'un point d'impact
    function damageBarrelsAt(x, y, dmg) {
      if (!arena || !arena.barrels) return;
      for (const b of arena.barrels) {
        if (b.dead) continue;
        if (Math.hypot(b.x - x, b.y - y) < CELL * 0.9) {
          b.hp -= dmg;
          if (b.hp <= 0) explodeBarrel(b);
        }
      }
    }
    // repousse une unité hors des obstacles
    function collideObstacles(e) {
      if (!arena || !arena.obstacles) return;
      for (const o of arena.obstacles.list) {
        const d = dist(e, o);
        const minD = o.r + CELL * 0.3;
        if (d < minD && d > 0.001) {
          const push = (minD - d);
          e.x += ((e.x - o.x) / d) * push;
          e.y += ((e.y - o.y) / d) * push;
        }
      }
    }
    // ---- NAVIGATION ----
    // Avant : on visait le but en ligne droite et `collideObstacles` repoussait.
    // Résultat, une unité qui avait un pilier sur sa route repartait dedans à
    // chaque image et restait plaquée contre la pierre. Maintenant on GARDE la
    // direction voulue tant que la route est libre, et dès qu'un obstacle la
    // coupe on rase son bord du côté le plus court.
    const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    function steerAround(e, tx, ty) {
      const want = Math.atan2(ty - e.y, tx - e.x);
      if (!arena || !arena.obstacles || !arena.obstacles.list.length) return want;
      const goal = Math.hypot(tx - e.x, ty - e.y);
      let best = null, bd = 1e9;
      for (const o of arena.obstacles.list) {
        const dx = o.x - e.x, dy = o.y - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.001 || d >= bd) continue;
        const R = o.r + CELL * 0.45 * (e.scale || 1);
        if (d > goal + R) continue;                       // il est au-delà du but
        const ao = Math.atan2(dy, dx);
        const hw = Math.asin(clamp(R / Math.max(R, d), -1, 1));
        if (Math.abs(angDiff(ao, want)) > hw) continue;   // pas sur la route
        best = { ao, hw }; bd = d;
      }
      if (!best) return want;
      const side = angDiff(want, best.ao) >= 0 ? 1 : -1;  // on passe au plus court
      return best.ao + side * (best.hw + 0.14);
    }
    // SÉPARATION : deux unités du même camp ne se superposent pas. Sans elle,
    // toute la troupe s'empile sur un seul point et on ne voit qu'un sprite.
    // (On ne sépare PAS d'un camp à l'autre : ça casserait le contact au corps
    // à corps.)
    function separateFrom(e) {
      if (!arena) return;
      const mine = e.side === 'party' ? arena.party : arena.foes;
      const rE = CELL * 0.32 * (e.scale || 1);
      const lo = MARGIN() * 0.6, hiX = W - MARGIN() * 0.6, hiY = H - MARGIN() * 0.6;
      for (const o of mine) {
        if (o === e || o.dead) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = Math.hypot(dx, dy);
        const minD = rE + CELL * 0.32 * (o.scale || 1);
        if (d >= minD) continue;
        if (d < 0.001) {                       // pile au même endroit : on décale
          const a0 = (e.id.charCodeAt(e.id.length - 1) % 8) * 0.785;
          e.x = clamp(e.x + Math.cos(a0) * minD * 0.5, lo, hiX);
          e.y = clamp(e.y + Math.sin(a0) * minD * 0.5, lo, hiY);
          continue;
        }
        const push = (minD - d) * 0.5;
        e.x = clamp(e.x + (dx / d) * push, lo, hiX);
        e.y = clamp(e.y + (dy / d) * push, lo, hiY);
      }
    }
    // COINCÉ : si on pousse sans avancer (angle mort entre deux obstacles, mur),
    // on part en détour perpendiculaire le temps de se dégager.
    //
    // ATTENTION au pas de temps : on compare ce qu'on a parcouru à ce qu'on
    // AURAIT DÛ parcourir, jamais à un nombre de pixels fixe. Avec un seuil
    // absolu, à 60 images/s une unité lente avance moins que le seuil À CHAQUE
    // IMAGE : elle se croyait coincée en permanence, lâchait sa cible et
    // repartait en détour sans fin. En jeu, le gardien ne frappait plus une
    // seule fois — et le harnais, qui simule par pas de 0,1 s, n'y voyait rien.
    function trackStuck(e, dt, moveTo, sp) {
      const adv = Math.hypot(e.x - (e._px == null ? e.x : e._px), e.y - (e._py == null ? e.y : e._py));
      e._px = e.x; e._py = e.y;
      const attendu = Math.max(0.001, sp * dt);
      e._stuckT = adv < attendu * 0.2 ? (e._stuckT || 0) + dt : 0;
      if (e._stuckT <= 0.7) return;
      e._stuckT = 0;
      const a = Math.atan2(moveTo.y - e.y, moveTo.x - e.x)
        + ((e.id.charCodeAt(e.id.length - 1) % 2) ? 1.25 : -1.25);
      e.dest = { x: clamp(e.x + Math.cos(a) * CELL * 2.4, MARGIN(), W - MARGIN()),
                 y: clamp(e.y + Math.sin(a) * CELL * 2.4, MARGIN(), H - MARGIN()) };
      e.target = null;
      e._freeT = 1.1;            // on se dégage d'abord, on re-cible ensuite
    }
    // ligne de vue : un segment ne doit traverser aucun obstacle
    function hasLOS(a, b) {
      if (!arena || !arena.obstacles || !arena.obstacles.list.length) return true;
      for (const o of arena.obstacles.list) {
        if (distToSeg(o, a, b) < o.r) return false;
      }
      return true;
    }
    // point avec LOS sur une cible (pour se repositionner)
    function spotWithLOS(from, target) {
      // essaie quelques positions autour de la position actuelle
      const base = Math.atan2(target.y - from.y, target.x - from.x);
      for (let k = 0; k < 8; k++) {
        const a = base + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.8;
        const nx = clamp(from.x + Math.cos(a) * CELL * 2, MARGIN(), W - MARGIN());
        const ny = clamp(from.y + Math.sin(a) * CELL * 2, MARGIN(), H - MARGIN());
        if (hasLOS({ x: nx, y: ny }, target)) return { x: nx, y: ny };
      }
      return null;
    }

    const MARGIN = () => CELL * 0.7;
    // LA SORTIE. On entre par le bas, on ressort EN FACE : l'escalier est
    // percé dans le mur du fond, au centre. Il était auparavant dessiné en bas
    // — pile sur l'endroit où la compagnie apparaît — et seulement une fois la
    // salle nettoyée. C'est un lieu de la salle : il est là du début à la fin.
    const stairX = () => W / 2;
    const stairY = () => CELL * 1.05;
    const cx = () => W / 2, cyc = () => H / 2;

    // ------------------------------------------------------------
    // COMBATTANTS
    // ------------------------------------------------------------
    // ------------------------------------------------------------
    // LA PANOPLIE D'UN PERSONNAGE — `p.pouvoirs`
    // ------------------------------------------------------------
    // AVANT : `p.ab` (la capacité de classe) d'un côté, `p.abs2` (les pouvoirs
    // de voie) de l'autre, deux canaux, deux recharges, et une astuce qui
    // PRÊTAIT le premier au second le temps d'un tir.
    // MAINTENANT : UN seul tableau de slots `{ pid, p, cd, cdMax }`.
    // `slot.p` est une COPIE de la définition, obligatoirement : un talent
    // « +40 % de rayon » qui écrirait dans `GameData.POWERS` polluerait tous
    // les héros de toutes les parties.
    const MODS_SCALAIRES = { cd: 1, radius: 1, mult: 1, dur: 1, len: 1, heal: 1,
                             dmg: 1, pct: 1, spd: 1, range: 1, w: 1, tick: 1 };
    const MODS_DRAPEAUX = { chain: 1, spread: 1, splash: 1, cleanse: 1 };
    // ------------------------------------------------------------
    // LES REGISTRES — LA LISTE DE CE QUE CE FICHIER JOUE VRAIMENT
    // ------------------------------------------------------------
    // Le défaut qu'on répare ici est celui d'un vocabulaire de données plus
    // riche que le moteur : quinze nœuds sur vingt-cinq étaient écrits, payés
    // par le joueur, et n'avaient AUCUN effet — aucun test ne pouvait le voir,
    // parce qu'un harnais qui lit des tables ne sait pas ce que le code exécute.
    // Ces trois listes sont donc la VÉRITÉ du moteur, exposées par
    // `A.registres()`, et `dev/smoke-pouvoirs.js` croise les données contre
    // elles. Règle : on n'ajoute un nom ici QU'EN ÉCRIVANT son code au-dessus.
    const KINDS_JOUES = ['aoe_self', 'aoe_point', 'bolt', 'line', 'heal',
      'buff_party', 'buff_self', 'taunt', 'rally', 'field', 'dash'];
    const PROCS_JOUES = ['backstab', 'bleed', 'burn', 'crit', 'crit_heal', 'critmult',
      'dodge', 'double', 'execute', 'frenzy', 'lowhp_dmg', 'mark', 'penetrate',
      'poison', 'puncture', 'push', 'rally_kill', 'regen', 'riposte', 'secondwind',
      'slow', 'speech', 'thorns', 'undying', 'vs_burn', 'vs_slow', 'wear'];
    const TAGS_LUS = ['degats', 'zone', 'controle', 'soin', 'bouclier',
      'mobilite', 'buff', 'debuff'];
    const BUFFS_LUS = ['dmg', 'aspd', 'spd', 'armor', 'armorPct', 'dodge', 'dr',
      'abs', 'invuln', 'immuneStun', 'recv', 'heal_recv'];
    function appliquerMods(def, mods, pid, estClasse) {
      const p = Object.assign({}, def);
      for (const m of (mods || [])) {
        if (!m || !m.mod) continue;
        // SUR QUEL POUVOIR ? `'classe'` (le sens historique des mods déjà
        // écrits), un id précis, ou `'*'` pour toute la panoplie. Sans ce
        // test, un nœud écrit pour le Fracas raccourcissait aussi la
        // Décapitation — et deux pouvoirs sur trois n'ont jamais rien reçu.
        const c = m.cible || 'classe';
        if (!(c === '*' || c === pid || (c === 'classe' && estClasse))) continue;
        if (MODS_SCALAIRES[m.mod] && p[m.mod] != null) p[m.mod] *= (1 + (m.pct || 0));
        else if (MODS_DRAPEAUX[m.mod]) p[m.mod] = Math.max(p[m.mod] || 0, m.pct || 1);
      }
      // LE CUMUL DE `cd` EST BORNÉ À −50 % : trois nœuds de −20 / −25 / −35 %
      // se multipliaient sans borne. Plancher absolu : 4 secondes.
      const cdBase = def.cd > 0 ? def.cd : 8;
      p.cd = Math.max(cdBase * 0.5, Math.max(4, p.cd > 0 ? p.cd : cdBase));
      return p;
    }
    function batirPouvoirs(id, cls, mods) {
      const ids = (GameState.heroPowerIds && GameState.heroPowerIds(id))
        || [(AD().CLASS_POWER || {})[cls]];
      const out = [];
      for (const pid of ids) {
        const def = AD().powerById ? AD().powerById(pid) : null;
        if (!def) continue;                  // id inconnu (vieille sauvegarde) : on saute
        // `out.length === 0` : le slot 0 est TOUJOURS la capacité de classe,
        // c'est lui que visent les mods de cible `'classe'`.
        const p = appliquerMods(def, mods, pid, out.length === 0);
        out.push({ pid, p, cd: 0, cdMax: Math.max(4, p.cd) });
      }
      return out;
    }
    // L'INDEX DES PROCS, bâti UNE fois au spawn : chaque point d'accroche lit
    // `p.procs[nom]` au lieu de balayer les douze effets du personnage à
    // chaque coup porté, soixante fois par seconde.
    function indexerProcs(procs) {
      const ix = {};
      for (const pr of (procs || [])) {
        if (!pr || !pr.proc) continue;
        if (!ix[pr.proc]) ix[pr.proc] = [];
        ix[pr.proc].push(pr);
      }
      return ix;
    }

    function mkHero(id, def, hs, i, n) {
      // LE RÉSOLVEUR UNIQUE (base + niveau + équipement + talents) vit dans
      // `GameState.combatStats` : l'arène et l'écran lisent le MÊME chiffre.
      // `mkHero` en tenait une seconde version, où un `pct` sur une clé absente
      // de la fiche était avalé en silence.
      const st = (GameState.combatStats && GameState.combatStats(id)) || {};
      const cls = (GameState.heroClassOf && GameState.heroClassOf(id))
        || (def ? def.cls : 'general');
      const talents = GameState.talentBonuses ? GameState.talentBonuses(id)
        : { stats: {}, pcts: {}, procs: [], auras: [], mods: [] };
      const span = Math.min(n, 4);
      // LA POSTURE VIENT DE L'ÉTAT, Général compris : elle était écrite en dur
      // pour lui, donc son choix ne descendait jamais jusqu'à l'arène.
      const stance = GameState.heroStance ? GameState.heroStance(id) : null;
      return {
        side: 'party', id,
        name: def ? (def.name[GameState.state.faction] || def.name.cats) : 'Général',
        cls, type: def ? def.base : 'heros', tint: def ? def.tint : '#c9a24a',
        icon: def ? def.icon : '', stance,
        st, hp: st.hp, hpMax: st.hp,
        /* LE BOUCLIER D’ENERGIE. Plein au depart : on entre dans la salle
           reposé. `eshT` compte le temps ECOULE DEPUIS LE DERNIER COUP —
           c’est lui qui decide du repit, pas un minuteur global. */
        esh: st.esh || 0, eshMax: st.esh || 0, eshT: 0,
        x: cx() + (i - (span - 1) / 2) * CELL * 1.1,
        y: H - MARGIN() - CELL * 0.4,
        angle: -Math.PI / 2, phase: Math.random() * 6.28, atkT: 0,
        lunge: 0, hitT: 0, deadT: 0, moving: false,
        dest: null, target: null, dead: false,
        // UN tableau de pouvoirs, UN index de procs. `gcd` est le délai commun
        // entre deux lâchers d'un même personnage (0,6 s, posé par fireAbility).
        pouvoirs: batirPouvoirs(id, cls, talents.mods),
        procs: indexerProcs(talents.procs),
        buffs: {}, statuses: {}, talents,
        gcd: 0, stunT: 0, ctrlT: 0,
      };
    }
    function mkFoe(type, i, n, diff, boss) {
      // les animaux du donjon ont leur propre fiche
      const animal = AD().animalById(type);
      const u = AD().UNIT_TYPES[animal ? animal.base : type] || AD().UNIT_TYPES.lancier;
      const b = u.base || { hp: 40, dmg: 4, range: 0, mspd: 40, aspd: 0.8 };
      const hpMult = (diff.hp || 1) * (boss ? boss.hpMult : 1);
      const hp = Math.round(b.hp * hpMult * 1.5);
      const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
      const col = i % cols, row = Math.floor(i / cols);
      const behavior = animal ? animal.behavior : AD().enemyBehavior(type);
      const elem = animal ? animal.elem : AD().enemyElem(type);
      const scale = boss ? 1.55 : (animal ? (animal.scale || 1) : 1);
      const name = animal ? (animal.name[GameState.state.faction] || animal.name.cats)
                          : u.name[GameState.state.faction === 'cats' ? 'birds' : 'cats'];
      return {
        side: 'foe', id: 'f' + i,
        name, type: animal ? animal.base : type, animalId: animal ? type : null,
        power: animal ? animal.power : null, powCd: animal && animal.power ? rnd(2, 5) : 0,
        boss: !!boss, behavior, elem,
        tint: boss ? '#a03a3a' : (elem ? AD().ELEMENTS[elem].col : '#7a5a4a'),
        hp, hpMax: hp,
        st: {
          dmg: b.dmg * (diff.dmg || 1) * (boss ? 1.6 : 1),
          aspd: b.aspd || 0.8,
          mspd: (b.mspd || 40) * (boss ? 0.8 : 1),
          range: b.range || 0, armor: boss ? 6 : 1, hp,
        },
        angle: Math.PI / 2, phase: Math.random() * 6.28, atkT: 0,
        lunge: 0, hitT: 0, deadT: 0, moving: false,
        // UN ENNEMI NAÎT ÉQUIPÉ DE SES DEUX CARTES : buffs et statuts. Elles
        // manquaient, et chaque site qui voulait ralentir ou galvaniser un
        // ennemi devait les créer lui-même — ou écrivait dans le vide.
        buffs: {}, statuses: {}, stunT: 0, ctrlT: 0,
        x: clamp(cx() + (col - (cols - 1) / 2) * CELL * 1.6, MARGIN(), W - MARGIN()),
        y: clamp(MARGIN() + CELL * 0.6 + row * CELL * 1.4, MARGIN(), H * 0.55),
        dest: null, target: null, dead: false,
        // la fiche du boss (seuils de phase, tempo) : bossThink la lit avec
        // repli sur les valeurs historiques quand un champ manque
        bossCfg: boss || null,
        patterns: boss ? (boss.patterns || []).map(p => ({ p, t: rnd(2.5, 5) })) : [],
        scale,
      };
    }
    /* ==================================================================
       LES INVOCATIONS

       Une hydre de feu, un squelette releve, une tourelle : trois noms
       pour la meme chose — une unite ALLIEE, temporaire, qui se bat toute
       seule et disparait.

       Elle vit dans `arena.party`, et ce n est pas un raccourci : c est
       ce qui lui donne gratuitement le deplacement, le ciblage, l attaque,
       les statuts et le rendu. Rien de tout cela n a ete reecrit.

       MAIS ELLE N EST PAS UN HEROS, et trois endroits doivent le savoir :
       la condition de defaite (une compagnie morte autour d une hydre
       vivante est une defaite), la selection (on ne lui donne pas d ordre)
       et le contexte de l IA (un soigneur ne gaspille pas ses soins sur
       ce qui va s evanouir). Le drapeau `_invoque` les distingue, comme
       `protege` distingue deja la caisse d escorte.
       ================================================================== */
    let seqInvoque = 0;
    function mkInvoque(maitre, ab) {
      const u = AD().UNIT_TYPES[ab.unite] || AD().UNIT_TYPES.lancier;
      const b = u.base || { hp: 40, dmg: 4, range: 0, mspd: 40, aspd: 0.8 };
      /* Elle emprunte une part des degats de son invocateur : sans cela
         une hydre lancee au dixieme etage tape comme au premier, et le
         pouvoir cesse de valoir un point d arbre passe un moment. */
      const part = ab.part || 0.6;
      const dmg = (b.dmg || 4) + (maitre.st.dmg || 0) * part;
      const hp = Math.round((b.hp || 40) * (ab.pv || 1.2));
      const elem = ab.elem || null;
      return {
        side: 'party', id: 'inv' + (++seqInvoque),
        _invoque: true, vieT: ab.dur || 8,
        name: ab.nomUnite || 'invocation',
        type: ab.unite || 'lancier', elem,
        tint: elem && AD().ELEMENTS[elem] ? AD().ELEMENTS[elem].col : '#8ab4a0',
        hp, hpMax: hp,
        st: { dmg, aspd: b.aspd || 0.9, mspd: (b.mspd || 40) * (ab.mobile === false ? 0 : 1),
              range: ab.range || b.range || 0, armor: 2, hp },
        angle: -Math.PI / 2, phase: Math.random() * 6.28, atkT: 0,
        lunge: 0, hitT: 0, deadT: 0, moving: false,
        buffs: {}, statuses: {}, stunT: 0, ctrlT: 0,
        x: clamp(maitre.x + rnd(-CELL, CELL), MARGIN(), W - MARGIN()),
        y: clamp(maitre.y + rnd(-CELL, CELL), MARGIN(), H - MARGIN()),
        dest: null, target: null, dead: false,
        pouvoirs: [], procs: null, talents: null, gcd: 0,
      };
    }

    // LE VIVIER DES RENFORTS : animaux ET soldats, pondéré par la profondeur.
    // Avant, les portails et les renforts de survie ne pondaient QUE la faune
    // dès qu'un biome en avait — les soldats du lieu n'entraient jamais en
    // cours de salle. Plus on descend, plus la garnison prend le pas.
    function pickFoeType(cfg, floor) {
      const types = (cfg && cfg.types) || [];
      const animals = ((cfg && cfg.animals) || []).filter(a => AD().animalById(a));
      if (!types.length && !animals.length) return null;
      const pSoldat = (types.length && animals.length)
        ? clamp(0.35 + (floor || 1) * 0.012, 0, 0.8) : (types.length ? 1 : 0);
      const pool = Math.random() < pSoldat ? types : animals;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // LES THÈMES DE VAGUE : k thèmes DISTINCTS, tirés mélangés dans
    // GameData.WAVE_THEMES — deux vagues d'affilée ne se ressemblent pas.
    function pickWaveThemes(k) {
      const ids = Object.keys(AD().WAVE_THEMES || {});
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
      }
      const out = [];
      for (let i = 0; i < k; i++) out.push(ids.length ? ids[i % ids.length] : null);
      return out;
    }
    // l'essaim est nombreux mais frêle : le thème retouche la bête à la ponte
    function applyWaveTheme(f, th) {
      if (!th || !f || f.portal) return;
      if (th.hpMult) { f.hp = f.hpMax = Math.max(1, Math.round(f.hpMax * th.hpMult)); f.st.hp = f.hpMax; }
      if (th.dmgMult) f.st.dmg = f.st.dmg * th.dmgMult;
    }
    // COMPOSITION : mélange de types selon la profondeur (plus c'est profond,
    // plus il y a de tireurs et de spécialistes). Le THÈME de la vague, s'il
    // y en a un, impose ses propres ratios (meute, escouade, tirailleurs…).
    function buildComposition(cfg, n, floor, th) {
      const types = cfg.types;
      const out = [];
      const ranged = types.filter(t => (AD().UNIT_TYPES[t] && (AD().UNIT_TYPES[t].base || {}).range > 0));
      const melee = types.filter(t => !ranged.includes(t));
      const rangedRatio = (th && th.rangedRatio != null) ? th.rangedRatio : Math.min(0.5, 0.15 + floor * 0.01);
      // LA FAUNE DU LIEU (et pas les huit espèces au hasard) : plus on descend,
      // plus les bêtes du coin sont nombreuses.
      const animals = (cfg.animals || []).filter(a => AD().animalById(a));
      const animalRatio = (th && th.animalRatio != null) ? th.animalRatio : Math.min(0.5, 0.18 + floor * 0.014);
      for (let k = 0; k < n; k++) {
        if (animals.length && Math.random() < animalRatio) {
          out.push(animals[Math.floor(Math.random() * animals.length)]);
        } else if (ranged.length && Math.random() < rangedRatio) {
          out.push(ranged[Math.floor(Math.random() * ranged.length)]);
        } else if (melee.length) {
          out.push(melee[Math.floor(Math.random() * melee.length)]);
        } else {
          out.push(types[k % types.length]);
        }
      }
      return out;
    }
    // FORMATION : schéma de placement des ennemis. `force` (venu d'un thème
    // de vague) impose un schéma précis — l'essaim se pose EN essaim.
    function applyFormation(foes, floor, force) {
      const n = foes.length;
      if (!n) return;
      const fmts = ['ligne', 'v', 'essaim', 'flancs'];
      const fmt = (force && fmts.indexOf(force) >= 0) ? force : fmts[Math.floor(Math.random() * fmts.length)];
      const midY = H * 0.3;
      if (fmt === 'ligne') {
        foes.forEach((f, k) => { f.x = clamp(cx() + (k - (n - 1) / 2) * CELL * 1.5, MARGIN(), W - MARGIN()); f.y = midY; });
      } else if (fmt === 'v') {
        foes.forEach((f, k) => {
          const off = k - (n - 1) / 2;
          f.x = clamp(cx() + off * CELL * 1.6, MARGIN(), W - MARGIN());
          f.y = clamp(midY + Math.abs(off) * CELL * 1.1, MARGIN(), H * 0.55);
        });
      } else if (fmt === 'essaim') {
        foes.forEach((f, k) => {
          const a = (k / n) * Math.PI * 2;
          f.x = clamp(cx() + Math.cos(a) * CELL * 2.2, MARGIN(), W - MARGIN());
          f.y = clamp(midY + Math.sin(a) * CELL * 1.6, MARGIN(), H * 0.55);
        });
      } else {  // flancs
        foes.forEach((f, k) => {
          const side = k % 2 === 0 ? -1 : 1;
          f.x = clamp(cx() + side * (W * 0.28 + Math.floor(k / 2) * CELL), MARGIN(), W - MARGIN());
          f.y = clamp(midY + Math.floor(k / 2) * CELL * 1.2, MARGIN(), H * 0.55);
        });
      }
      // les tireurs restent en arrière
      foes.forEach(f => { if (rangeOf(f) > 0) f.y = clamp(f.y - CELL * 1.5, MARGIN(), H * 0.5); });
    }
    // ------------------------------------------------------------
    // ÉLITES (champions) : une unité du roster promue à un haut RANG,
    // avec les pouvoirs que le dojo débloque (via son `ability`).
    // ------------------------------------------------------------
    const ELITE_RANKS = [
      { rank: 8,  mult: 2.2, col: '#b9c6d2', label: 'd\'Élite' },
      { rank: 14, mult: 3.2, col: '#f4c542', label: 'Royal' },
      { rank: 22, mult: 4.5, col: '#ffd700', label: 'Légendaire' },
    ];
    function promoteElite(f, floor) {
      const tier = ELITE_RANKS[Math.min(ELITE_RANKS.length - 1, Math.floor(floor / 12))];
      const u = AD().UNIT_TYPES[f.type];
      f.elite = true;
      f.eliteRank = tier.rank;
      f.eliteCol = tier.col;
      f.st.hp = Math.round(f.st.hp * tier.mult);
      f.hp = f.st.hp; f.hpMax = f.st.hp;
      f.st.dmg = f.st.dmg * (1 + tier.mult * 0.35);
      f.st.armor = (f.st.armor || 0) + 3;
      f.scale = (f.scale || 1) * 1.25;
      f.eliteAbility = (u && u.ability) || null;
      f._eliteCd = 0;
      // nom avec le suffixe de rang
      if (u && u.name) {
        const base = u.name[GameState.state.faction === 'cats' ? 'birds' : 'cats'] || u.name.cats;
        f.name = base + ' ' + tier.label;
      }
      return f;
    }
    // ------------------------------------------------------------
    // ALÉAS D'ÉTAGE : météores / pluies de flèches à esquiver
    // ------------------------------------------------------------
    function hazardFor(floor, biomeId) {
      // certains biomes ont un aléa signature
      if (biomeId === 'lave') return 'meteor';
      if (biomeId === 'grotte' || biomeId === 'cristaux') return 'arrows';
      if (floor % 4 === 2) return Math.random() < 0.5 ? 'meteor' : 'arrows';
      return null;
    }
    function spawnHazard() {
      const kind = arena.hazardKind;
      const targets = arena.party.filter(p => !p.dead);
      if (!targets.length) return;
      const dmg = 8 + (arena.floor || 1) * 1.5;
      if (kind === 'meteor') {
        const n = 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          arena.zones.push({ kind: 'tell', shape: 'circle',
            x: clamp(t.x + rnd(-CELL * 1.5, CELL * 1.5), MARGIN(), W - MARGIN()),
            y: clamp(t.y + rnd(-CELL * 1.5, CELL * 1.5), MARGIN(), H - MARGIN()),
            r: CELL * 1.3, t: -k * 0.3, dur: 1.3, dmg, icon: '' });
        }
        arena.floats.push({ x: cx(), y: CELL * 1.5, txt: ' Pluie de météores !', t: 0, col: '#ff8a4a' });
      } else if (kind === 'arrows') {
        // rangée de flèches qui balaie (lignes verticales)
        const n = 3;
        for (let k = 0; k < n; k++) {
          const x = W * (0.25 + 0.25 * k) + rnd(-CELL, CELL);
          arena.zones.push({ kind: 'tell', shape: 'line',
            x, y: 0, x2: x + rnd(-CELL, CELL), y2: H,
            w: CELL * 1.1, t: -k * 0.35, dur: 1.2, dmg, icon: '' });
        }
        arena.floats.push({ x: cx(), y: CELL * 1.5, txt: ' Pluie de flèches !', t: 0, col: '#d8cfae' });
      }
      sfx('spell');
    }
    // pouvoirs d'élite (capacités du dojo adaptées à l'arène)
    function eliteThink(f, dt) {
      if (!f.elite || !f.eliteAbility) return;
      f._eliteCd = (f._eliteCd || 0) - dt;
      if (f._eliteCd > 0) return;
      const ab = f.eliteAbility;
      const alive = arena.party.filter(p => !p.dead);
      if (!alive.length) return;
      if (ab === 'damageAura') {
        f._eliteCd = 2.5;
        for (const p of alive) if (dist(p, f) < CELL * 2.2) hurtHero(p, f.st.dmg * 0.6);
        arena.zones.push({ kind: 'fx', shape: 'circle', x: f.x, y: f.y, r: CELL * 2.2, t: 0, dur: 0.4, col: f.eliteCol });
      } else if (ab === 'heal' || ab === 'support') {
        f._eliteCd = 4;
        for (const e of arena.foes) {
          if (!e.dead && e.id !== f.id && dist(e, f) < CELL * 3) {
            e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.15);
            arena.floats.push({ x: e.x, y: e.y - 20, txt: '+' + Math.round(e.hpMax * 0.15), t: 0, col: '#8ef0a8' });
          }
        }
      } else if (ab === 'haste') {
        f._eliteCd = 6;
        // 0,5 = +50 % : la carte de buffs est ADDITIVE (c'était « × 1,5 »)
        for (const e of arena.foes) if (!e.dead && dist(e, f) < CELL * 3) putBuff(e, 'spd', 0.5, 3);
        arena.zones.push({ kind: 'fx', shape: 'circle', x: f.x, y: f.y, r: CELL * 3, t: 0, dur: 0.4, col: '#9cf7ff' });
      } else if (ab === 'slow') {
        f._eliteCd = 5;
        for (const p of alive) if (dist(p, f) < CELL * 3) applyStatus(p, 'chill', 'froid');
      } else if (ab === 'trail') {
        f._eliteCd = 3;
        const t = alive[Math.floor(Math.random() * alive.length)];
        arena.zones.push({ kind: 'tell', shape: 'circle', x: t.x, y: t.y, r: CELL * 1.1, t: 0, dur: 1.0, dmg: f.st.dmg * 1.2, icon: '' });
      } else if (ab === 'split') {
        // à la mort : se divise (géré dans la boucle de mort)
      }
    }
    // ------------------------------------------------------------
    // LA CARTE DE BUFFS — UNE seule, pour LES DEUX CAMPS
    // ------------------------------------------------------------
    // AVANT : trois minuteries écrites à la main (`dmgT`, `spdT`, `armorT`), et
    // `armor` en DRAPEAU (« × 2 »). Toute clé neuve — `dr`, `invuln`, `abs`,
    // `aspd`, `immuneStun`, `recv` — n'aurait JAMAIS expiré : un
    // « invulnérable 3 s » serait devenu « invulnérable jusqu'à l'escalier ».
    //
    // MAINTENANT : `e.buffs = { clé: { v, t } }`, UNE boucle d'expiration (en
    // tête de stepUnit), et toutes les valeurs sont des FRACTIONS ADDITIVES
    // (`spd: 0.9` = +90 % de vitesse). Les clés admises : `GameData.BUFF_KEYS`.
    // La conversion depuis la donnée se fait au SITE DE TIR, jamais ici.
    const bf = (e, k) => (e && e.buffs && e.buffs[k] && e.buffs[k].t > 0) ? e.buffs[k].v : 0;
    function putBuff(e, k, v, dur) {
      // une valeur absente (`ab.dodge` sur un pouvoir qui n'en a pas) ne pose
      // rien : sinon `bf` rendrait `undefined` et toute l'arithmétique de
      // l'arène partirait en NaN, sans une seule exception pour le dire.
      if (!e || v == null || !isFinite(v) || !(dur > 0)) return;
      if (!e.buffs) e.buffs = {};
      const cur = e.buffs[k];
      // LE MAX, JAMAIS L'ÉCRASEMENT : sinon un petit buff annule un gros.
      if (cur && cur.t > 0 && cur.v >= v) { cur.t = Math.max(cur.t, dur); return; }
      e.buffs[k] = { v, t: dur };
    }
    const dmgOf = e => (e.st.dmg || 1) * (1 + bf(e, 'dmg'));
    // LE RALENTISSEMENT VAUT DES DEUX CÔTÉS : il n'était appliqué qu'à la
    // compagnie, donc geler un ennemi ne le ralentissait pas.
    const spdOf = e => (e.st.mspd || 40) * (1 + bf(e, 'spd')) * slowOf(e);
    const rangeOf = e => (e.st.range || 0);
    // `aspd` n'avait AUCUN terme de buff : toute la famille « cadence » était
    // muette à la naissance, y compris le score de menace que l'IA en tire.
    const aspdOf = e => Math.max(0.15, (e.st.aspd || 0.8) * (1 + bf(e, 'aspd')));

    // ------------------------------------------------------------
    // OUVRIR / FERMER UNE SALLE
    // ------------------------------------------------------------
    A.isFight = tplId => !!(AD().advIsFight && AD().advIsFight(tplId));

    A.begin = function (opts) {
      const g = GameState.gen();
      const biomeId = opts.biome || 'tour';
      const biome = AD().biomeById(biomeId) || AD().DUNGEON_BIOMES[0];
      const salle = opts.room || 'combat';
      const cfg = AD().advFoes(biomeId);
      const kind = AD().roomKind(salle);
      const isBoss = !!kind.boss;
      // LE GABARIT DE LA SALLE PÈSE SUR LES ENNEMIS : une salle d'élite frappe
      // et encaisse presque le double, une salle au trésor est mal gardée.
      // `kind.mult` ne servait qu'au rattrapage hors-ligne — l'arène le lit
      // aussi, sinon la « salle d'élite » était PLUS FACILE qu'un combat.
      const diff0 = AD().floorDifficulty(opts.floor || 1);
      const kmult = isBoss ? 1 : (kind.mult || 1);
      const diff = { hp: diff0.hp * kmult, dmg: diff0.dmg * kmult, tier: diff0.tier, biome: diff0.biome };
      const party = [];
      /* La descente fige l'équipe au moment où le joueur appuie sur
         « Descendre ». On ne relit pas une ancienne compagnie de héros et on
         n'ajoute surtout plus le Général anonyme : chaque silhouette dans la
         salle correspond à un habitant choisi au bourg. */
      const idsPartants = (g.descent && Array.isArray(g.descent.party))
        ? g.descent.party.slice() : g.party.slice();
      const nP = idsPartants.length;
      let i = 0;
      for (const hid of idsPartants) {
        const def = AD().heroById(hid);
        const hs = GameState.heroState(hid);
        if (!def || !hs) continue;
        party.push(mkHero(hid, def, hs, i, nP));
        i++;
      }
      if (opts.hp) {
        for (const pp of party) {
          if (typeof opts.hp[pp.id] === 'number') pp.hp = Math.max(1, Math.min(pp.hpMax, opts.hp[pp.id]));
        }
      }
      const foes = [];
      const foeCount = AD().floorEnemyCount(opts.floor || 1, isBoss);
      let pendingWaves = [];
      let waveThemes = [];
      if (isBoss) {
        foes.push(mkFoe(cfg.boss.type, 0, 1, diff, cfg.boss));
        for (let k = 0; k < Math.min(foeCount - 1, 2); k++)
          foes.push(mkFoe(cfg.types[k % cfg.types.length], k + 1, foeCount, diff, null));
      } else if ((kind.foes || 0) > 0) {
        const n = Math.max(1, Math.round(foeCount * kind.foes));
        /* LES VAGUES. Trois au plus, « on tient ~1 minute » : c'était le
           coeur du probleme. Un etage doit durer CINQ MINUTES pour que ce
           que le joueur a prepare — pouvoirs, postures, replis — ait le
           temps de servir. On monte donc a neuf vagues, et la montee
           suit la profondeur au lieu de plafonner tout de suite.

           CHAQUE VAGUE GARDE SON THEME (meute, escouade, tirailleurs,
           essaim), tire sans doublon : la salle se raconte, elle ne se
           repete pas. `pickWaveThemes` recycle quand on lui en demande
           plus qu'il n'en existe. */
        const nWaves = Math.min(9, 3 + Math.floor((opts.floor || 1) / 3) + (n >= 5 ? 1 : 0));
        waveThemes = pickWaveThemes(nWaves);
        const perWave = Math.ceil(n / nWaves);
        for (let w = 0; w < nWaves; w++) {
          const th = AD().waveTheme ? AD().waveTheme(waveThemes[w]) : null;
          const nW = Math.max(1, Math.round(perWave * ((th && th.count) || 1)));
          const waveComp = buildComposition(cfg, nW, opts.floor || 1, th);
          if (w === 0) {
            for (let k = 0; k < waveComp.length; k++) {
              const nf = mkFoe(waveComp[k], k, waveComp.length, diff, null);
              applyWaveTheme(nf, th);
              foes.push(nf);
            }
          } else if (waveComp.length) {
            pendingWaves.push({ comp: waveComp, theme: waveThemes[w] });
          }
        }
        applyFormation(foes.filter(f => !f.portal), opts.floor || 1,
          ((AD().waveTheme && AD().waveTheme(waveThemes[0])) || {}).formation);
      }
      // ÉLITE : sur les étages normaux, une chance qu'un ennemi soit un
      // champion ; dans une SALLE D'ÉLITE c'est la règle — un garanti, deux
      // si la première vague est fournie.
      if (!isBoss && foes.length) {
        if (salle === 'elite') {
          promoteElite(foes[0], opts.floor || 1);
          if (foes.length >= 4) promoteElite(foes[1], opts.floor || 1);
        } else if ((opts.floor || 1) >= 3 && Math.random() < 0.55) {
          promoteElite(foes[Math.floor(Math.random() * foes.length)], opts.floor || 1);
        }
      }
      // LA CHASSE : le trophée entre en scène — une bête dorée qui ne rend
      // aucun coup et fait route vers l'escalier (comportement « fuyard »,
      // branche trophée). Il part du bas de la salle : toute la longueur à
      // remonter, c'est la fenêtre de tir.
      if (salle === 'chasse') {
        const gibier = (cfg.animals && cfg.animals.length)
          ? cfg.animals[Math.floor(Math.random() * cfg.animals.length)] : cfg.types[0];
        const tr = mkFoe(gibier, foes.length, 1, diff, null);
        tr.id = 'trophee'; tr.trophee = true;
        tr.behavior = 'fuyard';
        tr.power = null;                                  // pas de pouvoir : il FUIT, c'est tout
        tr.name = 'Trophée : ' + tr.name;
        tr.tint = '#e8c04a';
        tr.scale = (tr.scale || 1) * 1.35;
        tr.hp = tr.hpMax = Math.round(tr.hpMax * 2.6);    // coriace : la chasse doit durer
        tr.st.hp = tr.hpMax;
        tr.st.dmg = 0;
        tr.st.mspd = (tr.st.mspd || 40) * 0.55;           // et lent — on PEUT le rattraper
        tr.x = clamp(cx() + rnd(-CELL * 2, CELL * 2), MARGIN(), W - MARGIN());
        tr.y = H * 0.62;
        foes.push(tr);
      }
      // On pose la STRUCTURE (obstacles, tonneaux) avant le MOBILIER : le décor
      // a besoin de savoir ce qui occupe déjà le sol pour ne rien chevaucher.
      const obstacles = buildObstacles(opts.floor || 1, ((opts.floor || 1) * 104729) ^ Math.floor(Math.random() * 65536));
      const barrels = buildBarrels(opts.floor || 1, ((opts.floor || 1) * 2246822519) ^ Math.floor(Math.random() * 65536), obstacles.list);
      const decor = buildDecor(biomeId, ((opts.floor || 1) * 7919) ^ Math.floor(Math.random() * 65536), obstacles.list, barrels);
      // le mobilier haut devient un vrai obstacle : ce qu'on voit, on le contourne
      for (const sol of decor.solides) obstacles.list.push(sol);
      // LES PORTAILS : posés dans les salles de combat ordinaires, jamais chez
      // un boss (il a ses propres invocations) ni dans une salle à vagues déjà
      // nulles. Ils rejoignent `arena.foes` — c'est ce qui les rend ciblables
      // et ce qui retient l'escalier de s'ouvrir tant qu'ils tiennent.
      if (!isBoss && foes.length && salle === 'combat') {
        for (const spot of portalSpots(opts.floor || 1,
          ((opts.floor || 1) * 668265263) ^ Math.floor(Math.random() * 65536), obstacles.list)) {
          foes.push(mkPortal(foes.length, spot.x, spot.y, diff, opts.floor || 1));
        }
      }
      // L'OBJECTIF DE LA SALLE. Trois verbes en plus de « tuer tout le monde » :
      //   survie  — tenir un temps donné sous des vagues qui ne s'arrêtent pas ;
      //   escorte — une caisse immobile à garder en vie jusqu'au bout ;
      //   cristal — rester dans la lumière d'un cristal qui se déplace.
      let objectif = null;
      if (salle === 'survie' || salle === 'cristal') {
        objectif = { kind: salle, tLeft: (kind.dur || 26) + (opts.floor || 1) * 0.35, refillT: 0 };
      } else if (salle === 'escorte') {
        objectif = { kind: 'escorte' };
        // LA CAISSE : un membre de la compagnie qui ne se défend pas. Dans
        // `party`, donc les ennemis la visent naturellement (leur ciblage
        // prend le plus proche) — rien à inventer côté IA adverse.
        party.push({
          side: 'party', id: '__prot', protege: true,
          name: 'Le convoi', cls: 'convoi', type: 'convoi',
          tint: '#c9a24a', icon: '', stance: null,
          st: { dmg: 0, aspd: 1, mspd: 0, range: 0, armor: 0.1,
            hp: Math.round(90 * ((diff && diff.hp) || 1)) },
          hp: Math.round(90 * ((diff && diff.hp) || 1)),
          hpMax: Math.round(90 * ((diff && diff.hp) || 1)),
          x: cx(), y: H * 0.55,
          angle: -Math.PI / 2, phase: Math.random() * 6.28, atkT: 0,
          lunge: 0, hitT: 0, deadT: 0, moving: false,
          dest: null, target: null, dead: false,
          // une caisse ne lance rien : la panoplie est VIDE, pas absente —
          // les boucles de recharge et les procs la traversent sans test.
          pouvoirs: [], procs: {}, buffs: {}, statuses: {},
          talents: { stats: {}, pcts: {}, procs: [], auras: [], mods: [] },
          gcd: 0, stunT: 0, ctrlT: 0,
        });
      }
      let cristal = null;
      if (salle === 'cristal') {
        cristal = { x: cx(), y: H * 0.5, r: CELL * 2.6, t: 0 };
      }
      arena = {
        objectif, cristal,
        decor, obstacles, barrels,
        biome: { id: biomeId }, floor: opts.floor || 1, room: salle, kind, isBoss,
        party, foes, zones: [], floats: [], shots: [], bursts: [], sel: {}, pending: null,
        phase: 'fight', t: 0, auto: !!opts.auto,
        calm: foes.length === 0,
        pendingWaves, waveT: 0, waveNum: 1, waveTotal: 1 + pendingWaves.length, diff,
        waveThemes, _lastTheme: waveThemes[0] || null,
        tropheeSort: null,
        // le malus de dégâts ennemis posé par les auras (-1..0), lu par hurtHero
        malusEnnemi: 0,
        hazardT: 0, hazardKind: hazardFor(opts.floor || 1, biomeId),
      };
      // LES AURAS, une fois la compagnie posée : elles fixent `stBase` et le
      // plafond de PV. Sans cet appel, elles n'entreraient jamais en jeu.
      recalcAuras();
      procsEntree(party);                        // POINT D'ACCROCHE E : le discours
      // L'OBJECTIF S'ANNONCE À L'ENTRÉE : une salle qui change les règles sans
      // le dire ressemble à un bug, pas à une surprise.
      if (objectif) {
        const msg = objectif.kind === 'survie' ? '⏳ TENEZ ' + Math.ceil(objectif.tLeft) + ' secondes !'
          : objectif.kind === 'escorte' ? ' PROTÉGEZ le convoi !'
          : ' RESTEZ dans la lumière du cristal !';
        arena.floats.push({ x: cx(), y: cyc() - CELL, txt: msg, t: -0.4, col: '#ffe9a8' });
      }
      // la chasse aussi s'annonce : le trophée n'attendra pas
      if (salle === 'chasse') {
        arena.floats.push({ x: cx(), y: cyc() - CELL, txt: ' ABATTEZ le trophée avant l\'escalier !', t: -0.4, col: '#ffe9a8' });
      }
      if (party[0]) arena.sel[party[0].id] = true;
      onEnd = opts.onEnd || null;
      bgCanvas = null; // force bg rebuild
      initParticles();
      return arena;
    };
    A.end = function () { if (arena) arena.pending = null; arena = null; onEnd = null; bgCanvas = null; };
    A.beginCamp = function (biomeId) {
      const ar = A.begin({ biome: biomeId || 'tour', room: 'repos', auto: true, floor: 1 });
      if (ar) { ar.camp = true; ar.calm = true; ar.phase = 'camp'; }
      return ar;
    };
    A.setOnTowerClick = function (fn) { onTowerClick = fn; };
    A.isCamp = () => !!(arena && arena.camp);
    A.active = () => !!arena;
    A.phase = () => (arena ? arena.phase : null);
    A.setAuto = function (v) {
      if (!arena) return;
      arena.auto = !!v;
      // PIÈGE : une visée en attente + le passage en auto = tous les clics de
      // l'arène avalés par `castPending`, sans moyen d'en sortir.
      if (arena.auto) arena.pending = null;
    };

    // ------------------------------------------------------------
    // ORDRES DU JOUEUR
    // ------------------------------------------------------------
    A.select = function (id, add) {
      if (!arena) return;
      if (!add) arena.sel = {};
      arena.sel[id] = true;
    };
    A.selectAll = function () {
      if (!arena) return;
      arena.sel = {};
      for (const p of arena.party) if (!p.dead && !p._invoque) arena.sel[p.id] = true;
    };
    A.selected = () => (arena ? arena.party.filter(p => arena.sel[p.id] && !p.dead) : []);

    A.clickAt = function (x, y, shift) {
      if (!arena) return;
      if (arena.pending) { castPending(x, y); return; }
      // camp : clic sur la tour = lancer la descente
      if (arena.camp) {
        const R = campGoRect();
        const surBouton = x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h;
        const tw = W / 2, base = H * 0.56, bh = CELL * 4.6;
        const surTour = Math.abs(x - tw) < CELL * 1.6 && y > (base - bh - CELL) && y < (base + CELL);
        if ((surBouton || surTour) && onTowerClick) {
          campPress = 0.16;
          onTowerClick();
        }
        return;
      }
      // clic sur une unité alliée = sélection
      const clickedAlly = arena.party.find(p => !p.dead && dist(p, { x, y }) < CELL * 0.55);
      if (clickedAlly) {
        if (shift) { arena.sel[clickedAlly.id] = !arena.sel[clickedAlly.id]; }
        else { arena.sel = {}; arena.sel[clickedAlly.id] = true; }
        sfx('click');
        return;
      }
      // clic sur ennemi = attack
      const foe = arena.foes.find(f => !f.dead && dist(f, { x, y }) < CELL * 0.6 * (f.scale || 1));
      const sel = A.selected();
      if (!sel.length) return;
      for (const p of sel) {
        if (foe) { p.target = foe.id; p.dest = null; }
        else { p.dest = { x: clamp(x, MARGIN(), W - MARGIN()), y: clamp(y, MARGIN(), H - MARGIN()) }; p.target = null; }
      }
      sfx(foe ? 'click' : 'pop');
    };
    A.rightClick = function (x, y) {
      if (!arena) return;
      if (arena.pending) { arena.pending = null; return; }
      const foe = arena.foes.find(f => !f.dead && dist(f, { x, y }) < CELL * 0.7 * (f.scale || 1));
      const sel = A.selected();
      for (const p of sel) {
        if (foe) { p.target = foe.id; p.dest = null; }
        else { p.dest = { x: clamp(x, MARGIN(), W - MARGIN()), y: clamp(y, MARGIN(), H - MARGIN()) }; p.target = null; }
      }
      sfx('pop');
    };
    A.hoverAt = function (x, y) {
      if (!arena) return;
      if (arena.camp) {
        const R = campGoRect();
        campHover = x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h;
        return;
      }
      hoverUnit = arena.party.find(p => !p.dead && dist(p, { x, y }) < CELL * 0.55) || null;
    };
    // le curseur change au survol du bouton du camp
    A.campHot = () => !!(arena && arena.camp && campHover);
    A.campGoRect = campGoRect;
    A.boxSelect = function (x0, y0, x1, y1) {
      if (!arena) return;
      const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
      const ty = Math.min(y0, y1), by = Math.max(y0, y1);
      arena.sel = {};
      for (const p of arena.party) {
        if (!p.dead && p.x >= lx && p.x <= rx && p.y >= ty && p.y <= by) arena.sel[p.id] = true;
      }
      if (!Object.keys(arena.sel).length) arena.sel[arena.party[0].id] = true;
    };
    // LE TIR À LA MAIN. `i` est l'INDEX DU SLOT : un personnage porte jusqu'à
    // cinq pouvoirs, il faut donc dire lequel. `i` omis ⇒ slot 0 (la capacité
    // de classe), ce qui garde les vieux appels valides.
    A.castAbility = function (heroId, i) {
      if (!arena || arena.phase !== 'fight') return false;
      const p = arena.party.find(h => h.id === heroId && !h.dead);
      if (!p || !p.pouvoirs) return false;
      const slot = p.pouvoirs[i == null ? 0 : (i | 0)];
      if (!slot || !slot.p || slot.cd > 0) return false;
      const k = slot.p.kind;
      if (k === 'aoe_point' || k === 'line' || k === 'bolt' || k === 'field' || k === 'dash') {
        // on passe en VISÉE : le prochain clic dans l'arène donne le point
        arena.pending = { hero: p.id, slot: i == null ? 0 : (i | 0) };
        return true;
      }
      return fireAbility(p, slot, null, null, null);
    };
    A.cancelAim = function () { if (arena) arena.pending = null; };
    A.aiming = () => !!(arena && arena.pending);
    function castPending(x, y) {
      const en = arena.pending;
      arena.pending = null;
      if (!en) return;
      const p = arena.party.find(h => h.id === en.hero && !h.dead);
      if (!p || !p.pouvoirs) return;
      const slot = p.pouvoirs[en.slot || 0];
      if (!slot || !slot.p || slot.cd > 0) return;
      fireAbility(p, slot, x, y, null);
    }
    // OÙ EN EST LA JAUGE — croissante et normalisée : `0` juste après le tir,
    // `1` quand c'est prêt. C'est littéralement « le cri se remplit », et c'est
    // ce que l'écran met dans son `conic-gradient`. `pid` omis ⇒ slot 0.
    A.powerRatio = function (heroId, pid) {
      if (!arena) return null;
      const p = arena.party.find(h => h.id === heroId);
      if (!p || !p.pouvoirs) return null;
      const s = pid ? p.pouvoirs.find(x => x.pid === pid) : p.pouvoirs[0];
      return s ? (s.cdMax > 0 ? clamp(1 - s.cd / s.cdMax, 0, 1) : 1) : null;
    };

    // ------------------------------------------------------------
    // DÉGÂTS ET CAPACITÉS
    // ------------------------------------------------------------
    // éclats de particules à l'impact
    function burst(x, y, col, n) {
      if (!arena || !arena.bursts) return;
      for (let i = 0; i < (n || 6); i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = CELL * (1.5 + Math.random() * 2.5);
        arena.bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - CELL, r: 1.5 + Math.random() * 2, t: 0, life: 0.35 + Math.random() * 0.2, col });
      }
    }
    // LA MORT D'UN ENNEMI, à un seul endroit : le coup direct et la brûlure
    // qui l'achève doivent produire exactement la même chose (le , la
    // division de l'élite). Sinon un poison ferait disparaître un champion
    // sans ses rejetons — et personne ne le verrait venir.
    function tuerFoe(f) {
      if (!arena || f.dead) return;
      f.dead = true; f.deadT = 0.55; f.hp = 0;
      arena.floats.push({ x: f.x, y: f.y - CELL * 0.7, txt: '', t: 0, col: '#ffd08a' });
      // élite « split » : se divise en deux plus petits
      if (f.elite && f.eliteAbility === 'split' && !f.splitChild && arena.foes.length < 14) {
        for (let k = 0; k < 2; k++) {
          const child = mkFoe(f.type, arena.foes.length + k, 2, arena.diff, null);
          child.x = clamp(f.x + (k === 0 ? -1 : 1) * CELL * 0.8, MARGIN(), W - MARGIN());
          child.y = f.y;
          child.st.hp = Math.round(f.hpMax * 0.3); child.hp = child.st.hp; child.hpMax = child.st.hp;
          child.st.dmg = f.st.dmg * 0.4;
          child.scale = (child.scale || 1) * 0.75;
          child.splitChild = true;
          arena.foes.push(child);
        }
        arena.floats.push({ x: f.x, y: f.y - CELL, txt: ' Division !', t: 0, col: '#ffd08a' });
      }
      procsMort();                                  // POINT D'ACCROCHE C
    }
    // `status` (4e argument) : le statut posé sur la cible touchée. Sans lui,
    // tout pouvoir qui brûle, empoisonne, gèle ou électrise un ENNEMI était
    // muet — `applyStatus` n'était jamais appelé que sur la compagnie.
    function hurtFoe(f, n, armorPen, status) {
      if (!arena) return;
      if (f._feinte > 0) {                          // FEINTE : il n'est plus là
        arena.floats.push({ x: f.x, y: f.y - CELL * 0.6, txt: 'raté', t: 0, col: '#cfd8e4' });
        return;
      }
      // `armorPct` fraise l'armure (valeur NÉGATIVE pour l'entamer), `recv`
      // majore tout ce que la cible encaisse : les deux vivent dans la carte
      // de buffs, donc ils expirent comme le reste.
      const arm = Math.max(0, (f.st.armor || 0) * (1 + bf(f, 'armorPct')) - (armorPen || 0));
      const red = 1 - clamp(arm / 100, 0, 0.6);
      n *= (1 + bf(f, 'recv'));
      f.hp -= n * red;
      f.hitT = 0.14;
      burst(f.x, f.y - CELL * 0.3, '#ffd08a', 5);
      // les attaques touchent aussi les tonneaux proches
      damageBarrelsAt(f.x, f.y, n * 0.5);
      arena.floats.push({ x: f.x, y: f.y - CELL * 0.5, txt: '-' + Math.round(n * red), t: 0, col: '#e8f0ff' });
      if (status) applyStatus(f, status, null);
      if (f.hp <= 0 && !f.dead) tuerFoe(f);
    }
    // `src` (4e argument) : QUI frappe. Sans lui, riposte, épines et usure —
    // toute la colonne « coup reçu » — ne pouvaient être que des promesses
    // écrites. Il reste facultatif : une zone ou un aléa d'étage n'a personne
    // à qui rendre le coup.
    function hurtHero(p, n, elemId, src) {
      if (!arena) return;
      // ---- POINT D'ACCROCHE B : LA COMPAGNIE REÇOIT UN COUP ----
      const IX = p.procs || null;
      const esq = bf(p, 'dodge');
      if (esq > 0 && Math.random() < esq) {
        arena.floats.push({ x: p.x, y: p.y - 20, txt: 'esquive', t: 0, col: '#bfe6f4' });
        return;
      }
      if (IX) for (const pr of (IX.dodge || [])) {
        if (!tireProc(pr)) continue;
        arena.floats.push({ x: p.x, y: p.y - 20, txt: 'esquive', t: 0, col: '#bfe6f4' });
        return;
      }
      // dégâts élémentaires : réduits par la résistance, appliquent un statut
      let elemCol = null;
      if (elemId && AD().ELEMENTS[elemId]) {
        const E = AD().ELEMENTS[elemId];
        const res = (p.st && p.st[E.res]) || 0;
        n = n * (1 - clamp(res, 0, 0.75));
        elemCol = E.col;
        applyStatus(p, E.status, elemId);
      }
      // `armor` était un DRAPEAU (« × 2 ») : c'est désormais une fraction, et
      // la Provocation pose `armor: 1.0` — le même +100 %, mais chiffré.
      const armor = (p.st.armor || 0) * (1 + bf(p, 'armor'));
      let red = 1 - clamp(armor / 100, 0, 0.7);
      red *= (1 - clamp(bf(p, 'dr'), 0, 0.6));
      // LA RÉDUCTION TOTALE NE DESCEND JAMAIS SOUS 15 % des dégâts : `invuln`
      // est le seul zéro, et il est binaire et borné dans le temps.
      red = Math.max(0.15, red);
      n *= red * (1 + (arena.malusEnnemi || 0));
      if (bf(p, 'invuln') > 0) {
        arena.floats.push({ x: p.x, y: p.y - 20, txt: 'invulnérable', t: 0, col: '#bfe6f4' });
        return;
      }
      // L'ABSORPTION passe AVANT les points de vie, et se consomme.
      const abs = bf(p, 'abs');
      if (abs > 0) { const pris = Math.min(abs, n); p.buffs.abs.v -= pris; n -= pris; }
      /* LE BOUCLIER D’ENERGIE, ensuite.

         Il vient APRES l’absorption temporaire — celle-ci est un buff qui
         expire, on la depense donc en premier pendant qu’elle vaut encore
         quelque chose — et AVANT les points de vie, ce qui est toute sa
         raison d’etre : il encaisse a leur place, et il revient seul.

         TOUT COUP REMET LE REPIT A ZERO, meme entierement absorbe. Sinon
         un personnage sous le feu continu rechargerait en se faisant
         tirer dessus, et le bouclier deviendrait une seconde barre de vie
         infinie au lieu d’une recompense pour s’etre degage. */
      if (p.eshMax > 0) {
        p.eshT = 0;
        if (p.esh > 0) {
          const pris = Math.min(p.esh, n);
          p.esh -= pris; n -= pris;
          if (pris > 0) {
            burst(p.x, p.y - CELL * 0.3, '#7ac8ff', 3);
            if (p.esh <= 0)
              arena.floats.push({ x: p.x, y: p.y - 26, txt: 'bouclier brisé', t: 0, col: '#7ac8ff' });
          }
        }
      }
      // TOUT ABSORBÉ : on le DIT, sinon le coup est silencieux et le joueur
      // croit que l'ennemi a raté.
      if (n <= 0) {
        if (abs > 0) arena.floats.push({ x: p.x, y: p.y - 20, txt: 'absorbé', t: 0, col: '#bfe6f4' });
        return;
      }
      p.hp -= n;
      /* L'endurance n'augmente que si le coup traverse réellement esquive,
         absorption, bouclier d'énergie et armure pour enlever des PV. */
      if (window.GameState && GameState.enregistrerCoupRecu)
        GameState.enregistrerCoupRecu(p.id, n);
      p.hitT = 0.14;
      burst(p.x, p.y - CELL * 0.3, elemCol || '#ff9a8a', 5);
      arena.floats.push({ x: p.x, y: p.y - CELL * 0.5, txt: '-' + Math.round(n), t: 0, col: elemCol || '#ffb0a0' });
      // CE QUI SE REND. Épines et riposte demandent l'assaillant, d'où `src` ;
      // `wear` l'entame durablement (en points dans la donnée, en fraction ici,
      // parce que seule la carte de buffs expire).
      if (IX && src && src.side === 'foe' && !src.dead) {
        for (const pr of (IX.thorns || [])) if (tireProc(pr)) hurtFoe(src, n * (pr.pct || 0.15), 0, null);
        for (const pr of (IX.riposte || [])) {
          if (!tireProc(pr)) continue;
          arena.floats.push({ x: p.x, y: p.y - 30, txt: 'riposte', t: 0, col: '#ffe9a8' });
          hurtFoe(src, dmgOf(p) * (pr.mult || 1), 0, null);
          break;
        }
        for (const pr of (IX.wear || [])) if (tireProc(pr))
          putBuff(src, 'dmg', -clamp((pr.dmg || 2) / Math.max(1, src.st.dmg || 1), 0, 0.9), pr.dur || 5);
      }
      // SECOND SOUFFLE : UNE fois par salle, sous le seuil, l'armure monte.
      if (IX) for (const pr of (IX.secondwind || [])) {
        if (p._swFait || p.hp > p.hpMax * (pr.threshold || 0.3)) continue;
        p._swFait = 1;
        putBuff(p, 'armor', pr.armor || 0.3, 8);
        arena.floats.push({ x: p.x, y: p.y - 30, txt: 'second souffle', t: 0, col: '#ffe9a8' });
        break;
      }
      if (p.hp <= 0 && !p.dead) {
        // INDOMPTABLE : il refuse de tomber, une fois par recharge.
        const un = IX && IX.undying && IX.undying[0];
        if (un && (!p._undyingCd || p._undyingCd <= 0)) {
          p.hp = 1; p._undyingCd = un.cd || 60;
          arena.floats.push({ x: p.x, y: p.y - 30, txt: ' Indomptable !', t: 0, col: '#ffe9a8' });
          return;
        }
        p.dead = true; p.hp = 0; p.deadT = 0.55;
        // UNE AURA MEURT AVEC SON PORTEUR : sans ce recalcul, la compagnie
        // garderait le bonus d'un mort jusqu'à l'escalier.
        recalcAuras();
      }
    }
    // effets de statut élémentaires (DoT / ralentissement)
    function applyStatus(p, status, elemId) {
      if (!p.statuses) p.statuses = {};
      /* LA TABLE EST FERMEE, et c'est voulu : un statut inconnu sort par
         le `return` ci-dessous et ne fait RIEN. Ajouter un element sans
         ajouter son statut ici, c'est ajouter un element muet.
         `wither` est celui de l'ombre : il ronge plus fort que le poison
         mais moins longtemps, et alourdit legerement sa cible. */
      const cfg = { burn: { dur: 3, dps: 0.06 }, poison: { dur: 4, dps: 0.05 },
                    chill: { dur: 2.5, slow: 0.5 }, shock: { dur: 0.8, slow: 0.7 },
                    wither: { dur: 3.5, dps: 0.075, slow: 0.15 } }[status];
      if (!cfg) return;
      p.statuses[status] = { t: cfg.dur, dps: cfg.dps || 0, slow: cfg.slow || 0, elem: elemId };
    }
    // LES DEUX CAMPS : `tickStatuses` n'était appelé que pour la compagnie.
    // Un ennemi qui brûle brûle donc vraiment — et s'il en meurt, il meurt par
    // la même porte que d'un coup d'épée (`tuerFoe`), rejetons compris.
    function tickStatuses(p, dt) {
      if (!p.statuses) return;
      for (const k in p.statuses) {
        const st = p.statuses[k];
        st.t -= dt;
        if (st.dps > 0 && !p.dead) {
          p.hp -= p.hpMax * st.dps * dt;
          if (p.hp <= 0 && !p.dead) {
            if (p.side === 'foe') tuerFoe(p);
            else { p.dead = true; p.hp = 0; p.deadT = 0.55; recalcAuras(); }
          }
        }
        if (st.t <= 0) delete p.statuses[k];
      }
    }
    // ------------------------------------------------------------
    // LE CONTRÔLE — `stun`
    // ------------------------------------------------------------
    // Une unité étourdie ne pense pas, ne bouge pas, ne frappe pas. Avec des
    // RENDEMENTS DÉCROISSANTS : au-delà de 3 s de contrôle cumulé (qui se
    // purgent en ~10 s), tout nouveau stun retombe en simple ralentissement.
    // Sans ce garde-fou, trois pouvoirs de contrôle verrouillent un boss du
    // début à la fin — et le boss est le seul contenu qui exige de jouer.
    function putStun(e, dur) {
      if (!arena || !e || e.dead || !(dur > 0)) return false;
      if (bf(e, 'immuneStun') > 0) return false;
      if (e.boss) dur = Math.min(dur, 1);                  // un boss ne se range pas
      e.ctrlT = (e.ctrlT || 0) + dur;
      if (e.ctrlT > 3) { applyStatus(e, 'chill', null); return false; }
      e.stunT = Math.max(e.stunT || 0, dur);
      e.target = null; e.dest = null;
      arena.floats.push({ x: e.x, y: e.y - CELL * 0.7, txt: '', t: 0, col: '#ffe9a8' });
      return true;
    }
    // ------------------------------------------------------------
    // L'ENTONNOIR DE SOIN — un SEUL endroit soigne
    // ------------------------------------------------------------
    // Sans lui, « soins reçus +30 % » demanderait quatre correctifs — et le
    // cinquième soin, celui qu'on ajoutera l'an prochain, l'oublierait.
    // La RÉSURRECTION n'est pas un soin : `soigne` refuse un mort, c'est voulu
    // (`A.healParty` garde la sienne en propre).
    function soigne(h, n, src) {
      if (!arena || !h || !(n > 0)) return 0;
      if (h.dead) return 0;
      n *= (1 + ((h.st && h.st.heal_recv) || 0) + bf(h, 'heal_recv'));
      if (src && src.procs && src.procs.crit_heal)
        for (const pr of src.procs.crit_heal) if (Math.random() < pr.chance) n *= pr.mult;
      const avant = h.hp;
      h.hp = Math.min(h.hpMax, h.hp + n);
      const gagne = h.hp - avant;
      if (gagne > 0) arena.floats.push({ x: h.x, y: h.y - 20, txt: '+' + Math.round(gagne), t: 0, col: '#8ef0a8' });
      return gagne;
    }
    // ------------------------------------------------------------
    // LES AURAS — recalculées sur ÉVÉNEMENT, jamais par image
    // ------------------------------------------------------------
    // Une aura « alliés proches » coûterait party × party `dist()` par image,
    // et une aura sur `hp` déplacerait `hpMax` en continu — or `p.st` est la
    // référence PARTAGÉE qu'expose `snapshot()` : les chiffres de l'écran
    // clignoteraient. ~4 recalculs par salle au lieu de 60 par seconde. Les
    // descriptions de données disent donc « la compagnie », jamais « les
    // alliés proches ».
    function recalcAuras() {
      if (!arena) return;                                  // ré-entrance d'onEnd
      const cum = { dmg: 0, aspd: 0, armor: 0, hp: 0, mspd: 0, regen: 0, enemyDmg: 0 };
      const plat = { armor: 0, mspd: 0, dmg: 0 };
      for (const h of arena.party) {
        if (h.dead || h.protege || !h.talents) continue;
        for (const a of (h.talents.auras || [])) {
          if (!a || !a.stat) continue;
          if (a.pct) cum[a.stat] = (cum[a.stat] || 0) + a.pct;
          if (a.add) plat[a.stat] = (plat[a.stat] || 0) + a.add;
        }
      }
      arena.malusEnnemi = cum.enemyDmg || 0;               // lu dans hurtHero
      for (const h of arena.party) {
        if (!h.st) continue;
        if (!h.stBase) h.stBase = Object.assign({}, h.st);
        for (const k of ['dmg', 'aspd', 'armor', 'mspd'])
          h.st[k] = (h.stBase[k] || 0) * (1 + (cum[k] || 0)) + (plat[k] || 0);
        // L'AURA DE PV BOUGE LE PLAFOND : sans report proportionnel, un allié
        // qui meurt fait chuter `hpMax` sous `hp` — et l'écran affiche 132/100.
        const nMax = (h.stBase.hp || 1) * (1 + (cum.hp || 0));
        if (nMax !== h.hpMax) {
          const r = h.hpMax > 0 ? clamp(h.hp / h.hpMax, 0, 1) : 0;
          h.hpMax = nMax; h.st.hp = nMax; h.hp = Math.min(nMax, nMax * r);
        }
        h.regen = cum.regen || 0;                          // lu dans stepUnit
      }
    }
    const slowOf = p => {
      if (!p.statuses) return 1;
      let s = 1;
      for (const k in p.statuses) if (p.statuses[k].slow) s = Math.min(s, p.statuses[k].slow);
      return s;
    };
    function distToSeg(pt, a, b) {
      const vx = b.x - a.x, vy = b.y - a.y;
      const wx = pt.x - a.x, wy = pt.y - a.y;
      const L = vx * vx + vy * vy || 1;
      const t = clamp((wx * vx + wy * vy) / L, 0, 1);
      return Math.hypot(pt.x - (a.x + vx * t), pt.y - (a.y + vy * t));
    }
    // ------------------------------------------------------------
    // LA CHARGE UTILE — ce qu'un pouvoir FAIT à une unité
    // ------------------------------------------------------------
    // UN SEUL endroit lit `mult`, `status`, `stun`, `slow`, `push`, `recv`,
    // `armorPct`, `vamp`, `pct`. Avant, chaque `case` de `fireAbility` n'en
    // lisait qu'un ou deux et TOUT le reste de la donnée tombait dans le vide :
    // un pouvoir annoncé « étourdit 3 s » ne faisait que des dégâts.
    //
    // `dose` = ce que l'appel transporte : des DÉGÂTS pour un ennemi (déjà
    // multipliés par `mult` — une zone survit à son lanceur, elle porte donc
    // son chiffre), des POINTS DE SOIN pour un allié. Rendu : `{ d, h }`, ce
    // qui a réellement été infligé et soigné (les « faits d'armes »).
    function chargeUtile(cible, ab, dose, src, origine) {
      const r = { d: 0, h: 0 };
      if (!arena || !cible || cible.dead) return r;
      ab = ab || {};
      // `src` peut être un id (une zone survit à son lanceur) ou l'unité même.
      const srcU = (typeof src === 'string')
        ? (arena.party.find(h => h.id === src) || null) : (src || null);
      const dur = ab.dur || 5;
      // ---- UN ALLIÉ : jamais de dégâts (une zone du joueur n'est pas
      //      symétrique, sinon l'IA se suicide sur son propre météore).
      if (cible.side === 'party') {
        if (cible.protege) return r;
        const soin = dose > 0 ? dose : (ab.pct ? cible.hpMax * ab.pct : 0);
        if (soin > 0) r.h += soigne(cible, soin, srcU);
        if (ab.heal) r.h += soigne(cible, cible.hpMax * ab.heal, srcU);
        appliquerBuffs(cible, ab);
        if (ab.cleanse) cible.statuses = {};
        return r;
      }
      // ---- UN ENNEMI ----
      if (dose > 0) {
        const avant = cible.hp;
        hurtFoe(cible, dose, (srcU && srcU.st && srcU.st.armorPen) || 0, ab.status || null);
        r.d = Math.max(0, avant - cible.hp);
        if (r.d > 0 && srcU && srcU.side === 'party' && window.GameState && GameState.enregistrerPratiqueArme)
          GameState.enregistrerPratiqueArme(srcU.id, r.d);
        // LE VOL DE VIE d'un pouvoir passe par l'entonnoir comme tout soin.
        if (ab.vamp && srcU) r.h += soigne(srcU, r.d * ab.vamp, srcU);
      } else if (ab.status) applyStatus(cible, ab.status, null);
      if (ab.stun > 0) putStun(cible, ab.stun);
      // un ralentissement de ZONE se rafraîchit tant qu'on y est, et s'éteint
      // peu après qu'on en soit sorti : deux tics, pas la durée de la zone.
      if (ab.slow > 0) ralentir(cible, ab.slow, ab.tick ? Math.max(1, ab.tick * 2) : dur);
      // LES DEBUFFS vivent dans la carte de buffs : ils expirent comme le reste.
      if (ab.recv) putBuff(cible, 'recv', ab.recv, dur);
      if (ab.armorPct) putBuff(cible, 'armorPct', ab.armorPct, dur);
      if (ab.aspd < 0) putBuff(cible, 'aspd', ab.aspd, dur);
      if (ab.push > 0) pousser(cible, origine || srcU, ab.push);
      return r;
    }
    // TOUTES LES CLÉS DE BUFF, PAS SEULEMENT `dmg`. `dr`, `invuln`, `abs`,
    // `spd`, `armor`, `dodge`, `immuneStun`, `heal_recv` tombaient dans le
    // vide : Mur de boucliers et Serment ne faisaient RIEN.
    function appliquerBuffs(h, ab) {
      if (!h || !ab) return;
      const K = AD().BUFF_KEYS || {};
      const dur = ab.dur || 5;
      for (const k in K) {
        const v = ab[k];
        if (v == null || !isFinite(v) || v === 0) continue;
        putBuff(h, k, v, dur);
      }
    }
    // LE RALENTISSEMENT. `slow: 0.6` = 60 % de vitesse EN MOINS. Il passe par
    // la carte des STATUTS (`slowOf` en prend le minimum, des deux côtés) et
    // non par un buff `spd` : `putBuff` garde le MAX, donc c'est le
    // ralentissement le plus FAIBLE qui l'emporterait.
    function ralentir(e, part, dur) {
      if (!e || !(part > 0)) return;
      if (!e.statuses) e.statuses = {};
      const v = clamp(1 - part, 0.1, 0.99);
      const cur = e.statuses.chill;
      if (cur && cur.slow <= v) { cur.t = Math.max(cur.t, dur); return; }
      e.statuses.chill = { t: Math.max(dur, cur ? cur.t : 0), dps: 0, slow: v, elem: null };
    }
    // LA POUSSÉE part TOUJOURS du point d'impact, pas du lanceur : une bombe
    // repousse depuis l'endroit où elle tombe.
    function pousser(e, origine, force) {
      if (!e || !origine || !(force > 0)) return;
      const a = Math.atan2(e.y - origine.y, e.x - origine.x);
      e.x = clamp(e.x + Math.cos(a) * force, MARGIN(), W - MARGIN());
      e.y = clamp(e.y + Math.sin(a) * force, MARGIN(), H - MARGIN());
    }
    // OÙ TOMBE LE COUP : le point visé borné par la portée, plus l'extrémité
    // de la ligne. Sans visée NI cible, le pouvoir part sur le plus proche, et
    // à défaut droit devant : un pouvoir ne doit jamais être avalé en silence.
    function pointVise(p, ab, tx, ty) {
      let ax = tx, ay = ty;
      if (ax == null || ay == null) {
        const c = nearest(p, arena.foes);
        if (c) { ax = c.x; ay = c.y; }
        else { ax = p.x + Math.cos(p.angle || 0) * CELL * 3; ay = p.y + Math.sin(p.angle || 0) * CELL * 3; }
      }
      const a = Math.atan2(ay - p.y, ax - p.x);
      const d = Math.min(Math.hypot(ax - p.x, ay - p.y), ab.range != null ? ab.range : 1e9);
      const x = clamp(p.x + Math.cos(a) * d, MARGIN(), W - MARGIN());
      const y = clamp(p.y + Math.sin(a) * d, MARGIN(), H - MARGIN());
      const L = ab.len || 0;
      return { x, y, a, x2: x + Math.cos(a) * L, y2: y + Math.sin(a) * L };
    }
    // ------------------------------------------------------------
    // LES PROCS — SEPT POINTS D'ACCROCHE, un index pré-calculé
    // ------------------------------------------------------------
    // `p.procs` est bâti UNE fois au spawn (`indexerProcs`) : chaque accroche
    // lit UNE clé, jamais les douze effets du personnage. Le vocabulaire est
    // FERMÉ (`GameData.PROC_KINDS`) — mesuré, les données déclaraient 92 procs
    // dont le moteur n'en lisait que trois. Un mot que l'arène ne joue pas est
    // un mensonge fait au joueur, pas une fonctionnalité « à venir ».
    //   A coup porté · B coup reçu · C un ennemi meurt · D périodique ·
    //   E début de salle · G soin émis (dans `soigne`).
    const tireProc = pr => Math.random() < (pr.chance == null ? 1 : pr.chance);
    // Un DoT posé par un proc porte SA dose et SA durée : passer par
    // `applyStatus` les écraserait par les réglages élémentaires du donjon.
    // `bleed` n'a pas d'icône à lui : c'est un poison, le joueur le lit pareil.
    function poserDot(cible, cle, pr) {
      if (!cible.statuses) cible.statuses = {};
      const dps = pr.dps || pr.pct || 0.05;
      const dur = pr.dur || 3;
      const cur = cible.statuses[cle];
      if (cur && cur.dps >= dps) { cur.t = Math.max(cur.t, dur); return; }
      cible.statuses[cle] = { t: Math.max(dur, cur ? cur.t : 0), dps, slow: 0, elem: null };
    }
    // ---- A : LA COMPAGNIE PORTE UN COUP ----
    // Rend les dégâts modifiés, la pénétration gagnée et le second coup ; pose
    // au passage ce qui se colle à la cible (elle peut mourir du coup : on
    // pose avant de frapper, sinon un poison de la mort ne prend jamais).
    function procsCoup(e, tgt, dmg) {
      const out = { dmg, pen: 0, encore: false };
      const IX = e.procs;
      if (!IX || !tgt) return out;
      let crit = false, mult = 1;
      for (const pr of (IX.crit || [])) if (tireProc(pr)) { crit = true; mult *= (pr.mult || 1.5); }
      // `critmult` MAJORE le critique (« +80 % de dégâts critiques »), il n'en
      // crée pas : hors critique, il ne vaut rien.
      if (crit) for (const pr of (IX.critmult || [])) if (tireProc(pr)) mult += (pr.mult || 0);
      for (const pr of (IX.execute || []))
        if (tgt.hp / Math.max(1, tgt.hpMax) <= (pr.threshold || 0.2) && tireProc(pr)) mult *= (pr.mult || 1.5);
      for (const pr of (IX.lowhp_dmg || []))
        if (e.hp / Math.max(1, e.hpMax) <= (pr.threshold || 0.5) && tireProc(pr)) mult *= (pr.mult || 1.2);
      // DANS LE DOS : la cible s'occupe de quelqu'un d'autre.
      for (const pr of (IX.backstab || []))
        if (tgt.target && tgt.target !== e.id && tireProc(pr)) mult *= (pr.mult || 1.3);
      for (const pr of (IX.vs_slow || [])) if (slowOf(tgt) < 1 && tireProc(pr)) mult *= (pr.mult || 1.25);
      for (const pr of (IX.vs_burn || []))
        if (tgt.statuses && tgt.statuses.burn && tireProc(pr)) mult *= (pr.mult || 1.3);
      out.dmg = dmg * mult;
      if (crit) arena.floats.push({ x: tgt.x, y: tgt.y - CELL, txt: 'CRIT!', t: 0, col: '#ffe040' });
      // la pénétration en FRACTION de l'armure de la cible (la donnée dit `pct`)
      for (const pr of (IX.penetrate || [])) if (tireProc(pr)) out.pen += (tgt.st.armor || 0) * (pr.pct || 0.3);
      for (const pr of (IX.double || [])) if (tireProc(pr)) { out.encore = true; break; }
      for (const pr of (IX.poison || [])) if (tireProc(pr)) { poserDot(tgt, 'poison', pr); break; }
      for (const pr of (IX.burn || [])) if (tireProc(pr)) { poserDot(tgt, 'burn', pr); break; }
      for (const pr of (IX.bleed || [])) if (tireProc(pr)) { poserDot(tgt, 'poison', pr); break; }
      for (const pr of (IX.slow || [])) if (tireProc(pr)) { ralentir(tgt, pr.pct || 0.35, pr.dur || 2); break; }
      // L'ARMURE ENTAMÉE est écrite en POINTS dans la donnée ; la carte de
      // buffs ne connaît que des fractions — et elle est la seule à expirer.
      for (const pr of (IX.puncture || [])) if (tireProc(pr)) {
        putBuff(tgt, 'armorPct', -clamp((pr.armor || 3) / Math.max(1, tgt.st.armor || 1), 0, 0.9), pr.dur || 5);
        break;
      }
      for (const pr of (IX.mark || [])) if (tireProc(pr)) { putBuff(tgt, 'recv', pr.pct || 0.1, pr.dur || 6); break; }
      for (const pr of (IX.push || [])) if (tireProc(pr)) { pousser(tgt, e, pr.force || 30); break; }
      return out;
    }
    // ---- C : UN ENNEMI TOMBE ----
    // Le tueur n'est PAS connu (une brûlure achève aussi bien qu'une épée) :
    // l'effet porte donc sur qui le porte, dans toute la compagnie — la même
    // règle que les auras, et la seule qui ne mente pas.
    function procsMort() {
      if (!arena) return;
      let cri = 0;
      for (const h of arena.party) {
        if (h.dead || h.protege || !h.procs) continue;
        for (const pr of (h.procs.frenzy || [])) if (tireProc(pr)) putBuff(h, 'spd', (pr.spd || 1.2) - 1, pr.dur || 3);
        for (const pr of (h.procs.rally_kill || [])) if (tireProc(pr)) cri = Math.max(cri, pr.heal || 0.02);
      }
      if (cri > 0) for (const h of arena.party) if (!h.dead && !h.protege) soigne(h, h.hpMax * cri, null);
    }
    // ---- E : L'ENTRÉE DANS LA SALLE ----
    // Le discours d'avant-combat ne se joue qu'ici, une fois, et il porte sur
    // toute la compagnie : c'est un discours, pas une pensée intime.
    function procsEntree(party) {
      if (!arena) return;
      for (const h of party) {
        if (!h.procs || !h.procs.speech) continue;
        for (const pr of h.procs.speech) {
          if (!tireProc(pr)) continue;
          for (const a of party) if (!a.dead && !a.protege) putBuff(a, 'dmg', pr.pct || 0.1, pr.dur || 5);
          arena.floats.push({ x: h.x, y: h.y - 30, txt: 'en avant !', t: 0, col: '#ffe9a8' });
        }
      }
    }

    // ------------------------------------------------------------
    // LE TIR — un SLOT, une cible explicite
    // ------------------------------------------------------------
    // `slot` (et non plus `p.ab`) : c'est ce qui a supprimé l'astuce du canal
    // emprunté, qui n'était pas ré-entrante (un `onEnd` déclenché sous
    // `fireAbility` laissait la capacité de classe pointée sur le pouvoir
    // prêté) et qui écrasait la recharge modée.
    // `cible` (5e argument) : l'IA impose SA cible sans passer par `p.target`,
    // donc sans se battre avec l'hystérésis d'`aimAt` (verrou de 1,1 à 2,2 s).
    function fireAbility(p, slot, tx, ty, cible) {
      if (!arena || !p || !slot || !slot.p) return false;
      const ab = slot.p;                     // la COPIE modée, jamais l'objet de GameData
      slot.cd = slot.cdMax;                  // les mods sont déjà dans cdMax
      p.gcd = 0.6;
      // LES FAITS D'ARMES : ce que ce pouvoir a réellement fait dans la salle,
      // pour le rapport de fin (« Coup d'éclat :  Déchaînement »).
      const faits = slot._faits || (slot._faits = { casts: 0, dmg: 0, heal: 0 });
      faits.casts++;
      const base = dmgOf(p);
      // LE NOM ÉCRIT EST UN PRIVILÈGE : au-delà de trois annonces de 105 px la
      // salle devient illisible. Seuls les grands coups et le personnage
      // sélectionné s'annoncent ; les autres ne posent que leur icône.
      const bavard = (ab.cd || 0) >= 25 || arena.sel[p.id];
      arena.floats.push({ x: p.x, y: p.y - 30, txt: bavard ? ab.icon + ' ' + ab.name : ab.icon,
                          t: 0, col: '#ffe9a8' });
      sfx('spell');
      if (cible && tx == null) { tx = cible.x; ty = cible.y; }
      // un seul point d'entrée pour blesser : la charge utile, et le compteur
      const frappe = (u, org, n) => {
        const r = chargeUtile(u, ab, n == null ? base * (ab.mult || 0) : n, p, org || p);
        faits.dmg += r.d; faits.heal += r.h;
      };
      switch (ab.kind) {
        case 'aoe_self': {
          const R = ab.radius || 50;
          for (const f of arena.foes) if (!f.dead && dist(f, p) < R) frappe(f, p);
          arena.zones.push({ kind: 'fx', shape: 'circle', side: 'party', x: p.x, y: p.y, r: R, t: 0, dur: 0.35, col: '#ffd08a' });
          break;
        }
        case 'aoe_point': {
          const pt = pointVise(p, ab, tx, ty);
          const R = ab.radius || 50;
          if (ab.delay > 0) {
            // L'ANNONCE. `side: 'party'` est ce qui empêche `dodgeZones` de
            // faire détaler la compagnie devant sa propre bombe, et `z.dmg` est
            // PRÉ-CALCULÉ : le lanceur peut être mort à l'atterrissage.
            arena.zones.push({ kind: 'tell', shape: 'circle', side: 'party', owner: p.id, ab, faits,
              x: pt.x, y: pt.y, r: R, t: 0, dur: ab.delay,
              dmg: base * (ab.mult || 0), icon: ab.icon });
          } else {
            for (const f of arena.foes) if (!f.dead && dist(f, pt) < R) frappe(f, pt);
            // `splash` : l'onde qui déborde du cratère, pour une fraction du coup.
            if (ab.splash > 0) for (const f of arena.foes) {
              if (f.dead) continue;
              const d = dist(f, pt);
              if (d >= R && d < R * 1.6) frappe(f, pt, base * (ab.mult || 0) * ab.splash);
            }
            arena.zones.push({ kind: 'fx', shape: 'circle', side: 'party', x: pt.x, y: pt.y, r: R, t: 0, dur: 0.4, col: '#ffb45a' });
          }
          break;
        }
        case 'bolt': {
          const portee = (ab.range || 200) + CELL;
          let but = (cible && !cible.dead && cible.side === 'foe') ? cible : null;
          if (!but && tx != null) {
            let bd = 1e9;
            for (const f of arena.foes) { if (f.dead) continue; const d = Math.hypot(f.x - tx, f.y - ty); if (d < bd) { bd = d; but = f; } }
          }
          if (!but) but = nearest(p, arena.foes);
          if (!but || dist(but, p) > portee) break;
          // `chain` : le trait REBONDIT de proche en proche, un peu plus faible
          // à chaque saut. C'est un DRAPEAU du pouvoir, jamais un kind.
          const sauts = Math.max(1, Math.round(ab.chain || 1));
          const vus = {};
          let cur = but, de = p, n = base * (ab.mult || 0);
          for (let k = 0; k < sauts && cur; k++) {
            vus[cur.id] = 1;
            arena.zones.push({ kind: 'bolt', side: 'party', x: de.x, y: de.y, x2: cur.x, y2: cur.y, t: 0, dur: 0.28, col: '#b58cff' });
            frappe(cur, de, n);
            de = { x: cur.x, y: cur.y };
            n *= 0.8;
            let suiv = null, bd = CELL * 3.2;
            for (const f of arena.foes) { if (f.dead || vus[f.id]) continue; const d = dist(f, de); if (d < bd) { bd = d; suiv = f; } }
            cur = suiv;
          }
          break;
        }
        case 'line': {
          const pt = pointVise(p, ab, tx, ty);
          const n = Math.max(1, Math.round(ab.spread || 1));
          const L = ab.len || 190, larg = ab.w || 26;
          for (let k = 0; k < n; k++) {
            // `spread` : l'éventail, ±25° d'ouverture autour de la visée.
            const a = pt.a + (n === 1 ? 0 : (k - (n - 1) / 2) * 0.4363);
            const bout = { x: p.x + Math.cos(a) * L, y: p.y + Math.sin(a) * L };
            for (const f of arena.foes) if (!f.dead && distToSeg(f, p, bout) < larg) frappe(f, p);
            arena.zones.push({ kind: 'bolt', side: 'party', x: p.x, y: p.y, x2: bout.x, y2: bout.y, t: 0, dur: 0.3, col: '#9ad86a' });
          }
          break;
        }
        case 'heal': {
          const R = ab.radius != null ? ab.radius : (ab.range || 0);
          let releve = false;
          for (const h of arena.party) {
            if (h.protege) continue;
            if (h.id !== p.id && dist(h, p) > R) continue;
            if (h.dead) {
              // LA RÉSURRECTION N'EST PAS UN SOIN : `soigne` refuse un mort.
              if (!(ab.revive > 0)) continue;
              h.dead = false; h.deadT = 0;
              h.hp = Math.max(1, h.hpMax * Math.min(1, ab.revive));
              releve = true;
              arena.floats.push({ x: h.x, y: h.y - 24, txt: 'debout !', t: 0, col: '#8ef0a8' });
              continue;
            }
            if (ab.pct) faits.heal += soigne(h, h.hpMax * ab.pct, p);
            if (ab.cleanse) h.statuses = {};
          }
          // une aura perdue à la mort ne revient QUE par ce recalcul
          if (releve) recalcAuras();
          arena.zones.push({ kind: 'fx', shape: 'circle', side: 'party', x: p.x, y: p.y, r: Math.max(R, CELL), t: 0, dur: 0.5, col: '#8ef0a8' });
          break;
        }
        case 'buff_party': {
          for (const h of arena.party) {
            if (h.dead || h.protege) continue;
            // LE RAYON COMPTE ENFIN (il était ignoré). Compensation prévue par
            // le contrat : tous les `buff_party` du catalogue portent au moins
            // à 160 px, le Refrain à 200 — l'arène fait ~442 px de côté.
            if (ab.radius && dist(h, p) > ab.radius) continue;
            appliquerBuffs(h, ab);
            if (ab.cleanse) h.statuses = {};
            if (ab.recharge) for (const s of (h.pouvoirs || [])) s.cd = Math.max(0, s.cd - s.cdMax * ab.recharge);
          }
          arena.zones.push({ kind: 'fx', shape: 'circle', side: 'party', x: p.x, y: p.y, r: ab.radius || CELL * 4, t: 0, dur: 0.5, col: '#ffe9a8' });
          break;
        }
        case 'buff_self': {
          appliquerBuffs(p, ab);
          if (ab.cleanse) p.statuses = {};
          break;
        }
        case 'taunt': {
          const R = ab.radius || 130, d = ab.dur || 5;
          // `armor: 1.0` = +100 % : l'ancien drapeau « × 2 », chiffré.
          putBuff(p, 'armor', ab.armor != null ? ab.armor : 1, d);
          if (ab.dr) putBuff(p, 'dr', ab.dr, d);
          for (const f of arena.foes) {
            if (f.dead || dist(f, p) > R) continue;
            f.target = p.id;
            // LE VERROU : sans lui `aimAt` rendrait la cible au plus proche à
            // l'image suivante, et la Provocation ne durerait rien du tout.
            f.retarget = Math.max(f.retarget || 0, d);
          }
          arena.zones.push({ kind: 'fx', shape: 'circle', side: 'party', x: p.x, y: p.y, r: R, t: 0, dur: 0.4, col: '#ffd08a' });
          break;
        }
        case 'rally': {
          const R = ab.radius || CELL * 5;
          for (const h of arena.party) {
            if (h.dead || h.protege || dist(h, p) > R) continue;
            appliquerBuffs(h, ab);
            if (ab.heal) faits.heal += soigne(h, h.hpMax * ab.heal, p);
            if (ab.cleanse) h.statuses = {};
          }
          arena.zones.push({ kind: 'fx', shape: 'circle', side: 'party', x: p.x, y: p.y, r: R, t: 0, dur: 0.5, col: '#ffe9a8' });
          break;
        }
        // LA ZONE QUI DURE. Trois briques : l'accumulateur (boucle des zones),
        // la charge utile (`chargeUtile`) et le RENDU — sans lui, une zone qui
        // blesse est invisible, donc un pouvoir muet.
        case 'field': {
          const pt = pointVise(p, ab, tx, ty);
          // UN SEUL `field` par lanceur : le nouveau remplace l'ancien, sinon
          // l'artificier tapisse la salle et le plafond global saute.
          for (let i = arena.zones.length - 1; i >= 0; i--)
            if (arena.zones[i].kind === 'field' && arena.zones[i].owner === p.id) arena.zones.splice(i, 1);
          arena.zones.push({ kind: 'field', side: 'party', owner: p.id, ab, faits,
            shape: ab.len ? 'line' : 'circle',
            x: pt.x, y: pt.y, x2: pt.x2, y2: pt.y2, r: ab.radius || CELL, w: ab.w,
            t: 0, dur: ab.dur || 4, tick: ab.tick || 0.5, next: 0,
            base: base * (ab.mult || 0), allie: !!ab.allie,
            col: ab.allie ? '#8ef0a8' : '#ffb45a' });
          break;
        }
        // LE BOND. Même patron que la charge d'un monstre : on note le départ,
        // on arrive, et tout ce qui était sur le segment le sent passer.
        case 'summon': {
          /* On ne laisse pas proliferer : au-dela de `max` invocations
             vivantes du meme maitre, la plus ancienne s en va. Sans ce
             plafond, un pouvoir a 6 s de recharge et 12 s de duree
             remplissait l arene et rendait tout le reste illisible. */
          const max = Math.max(1, ab.max || 1);
          const miennes = arena.party.filter(u => u._invoque && u._maitre === p.id && !u.dead);
          while (miennes.length >= max) { const v = miennes.shift(); v.dead = true; v.deadT = 0; }
          const n = Math.max(1, Math.round(ab.nb || 1));
          for (let k = 0; k < n; k++) {
            const inv = mkInvoque(p, ab);
            inv._maitre = p.id;
            arena.party.push(inv);
            burst(inv.x, inv.y, inv.tint, 8);
          }
          break;
        }
        case 'dash': {
          const sujets = ab.groupe ? arena.party.filter(h => !h.dead && !h.protege) : [p];
          const L = ab.len || CELL * 4;
          for (const u of sujets) {
            const vers = (tx == null) ? pointVise(u, ab, null, null) : { x: tx, y: ty };
            const a = Math.atan2(vers.y - u.y, vers.x - u.x);
            const d = Math.min(L, Math.hypot(vers.x - u.x, vers.y - u.y) || L);
            const ax = u.x, ay = u.y;
            u.x = clamp(u.x + Math.cos(a) * d, MARGIN(), W - MARGIN());
            u.y = clamp(u.y + Math.sin(a) * d, MARGIN(), H - MARGIN());
            u._freeT = 0.15;                 // l'IA ne redécide pas dans la même image
            u.dest = null;
            arena.zones.push({ kind: 'bolt', side: 'party', x: ax, y: ay, x2: u.x, y2: u.y, t: 0, dur: 0.25, col: '#cfd8e4' });
            if (ab.mult) for (const f of arena.foes)
              if (!f.dead && distToSeg(f, { x: ax, y: ay }, u) < (ab.w || 30)) frappe(f, { x: ax, y: ay });
            // ici `invuln` est une DURÉE (le temps du bond), là où sur un
            // `buff_self` c'est un drapeau porté par `dur`.
            if (ab.invuln) putBuff(u, 'invuln', 1, ab.invuln > 0 ? ab.invuln : 0.3);
            if (ab.cleanse) u.statuses = {};
          }
          break;
        }
      }
      return true;
    }

    // ------------------------------------------------------------
    // BOSS ZONES
    // ------------------------------------------------------------
    // UN PATRON SE JOUE ICI : la traduction en zones, sortie de la boucle pour
    // pouvoir ENCHAÎNER deux patrons au dernier souffle. `delay` retarde toute
    // l'annonce (les zones naissent avec un `t` négatif, mécanique existante).
    function castPattern(f, P, targets, delay) {
      const off = delay || 0;
      const tg = targets[Math.floor(Math.random() * targets.length)];
      if (P.kind === 'circle') arena.zones.push({ kind: 'tell', shape: 'circle', x: tg.x, y: tg.y, r: P.r, t: -off, dur: P.tell, dmg: f.st.dmg * P.mult, icon: P.icon });
      else if (P.kind === 'ring') arena.zones.push({ kind: 'tell', shape: 'ring', x: f.x, y: f.y, r: P.r, inner: P.inner, t: -off, dur: P.tell, dmg: f.st.dmg * P.mult, icon: P.icon });
      else if (P.kind === 'multi') {
        for (let k = 0; k < (P.n || 3); k++) {
          const t2 = targets[Math.floor(Math.random() * targets.length)];
          arena.zones.push({ kind: 'tell', shape: 'circle', x: clamp(t2.x + rnd(-CELL, CELL), MARGIN(), W - MARGIN()), y: clamp(t2.y + rnd(-CELL, CELL), MARGIN(), H - MARGIN()), r: P.r, t: -k * 0.25 - off, dur: P.tell, dmg: f.st.dmg * P.mult, icon: P.icon });
        }
      } else if (P.kind === 'star') {
        // TROIS LIGNES EN ÉTOILE depuis le boss, décalées : le motif se lit,
        // et il y a toujours un couloir sûr — le trouver EST l'esquive.
        const a0 = Math.random() * Math.PI * 2;
        for (let k = 0; k < (P.n || 3); k++) {
          const a = a0 + k * (Math.PI * 2 / (P.n || 3));
          arena.zones.push({ kind: 'tell', shape: 'line', x: f.x, y: f.y,
            x2: f.x + Math.cos(a) * P.len, y2: f.y + Math.sin(a) * P.len,
            w: P.w, t: -k * 0.25 - off, dur: P.tell, dmg: f.st.dmg * P.mult, icon: P.icon });
        }
      } else if (P.kind === 'cross') {
        // LA CROIX : deux lignes perpendiculaires qui TRAVERSENT le boss de
        // part en part. Quatre quadrants sûrs — on choisit le sien et on y va.
        const a0 = Math.random() * Math.PI;
        for (let k = 0; k < 2; k++) {
          const a = a0 + k * (Math.PI / 2);
          arena.zones.push({ kind: 'tell', shape: 'line',
            x: f.x - Math.cos(a) * P.len, y: f.y - Math.sin(a) * P.len,
            x2: f.x + Math.cos(a) * P.len, y2: f.y + Math.sin(a) * P.len,
            w: P.w, t: -k * 0.2 - off, dur: P.tell, dmg: f.st.dmg * P.mult, icon: P.icon });
        }
      } else if (P.kind === 'chase') {
        // LA TRAQUE : des impacts qui SUIVENT la cible — rester immobile est
        // la seule mauvaise réponse. Chaque annonce vise la position COURANTE
        // de la cible au moment où elle part, avec un petit retard.
        for (let k = 0; k < (P.n || 5); k++) {
          arena.zones.push({ kind: 'tell', shape: 'circle', chase: tg.id,
            x: tg.x, y: tg.y, r: P.r, t: -k * 0.4 - off, dur: P.tell, dmg: f.st.dmg * P.mult, icon: P.icon });
        }
      } else if (P.kind === 'line') {
        const a = Math.atan2(tg.y - f.y, tg.x - f.x);
        arena.zones.push({ kind: 'tell', shape: 'line', x: f.x, y: f.y, x2: f.x + Math.cos(a) * P.len, y2: f.y + Math.sin(a) * P.len, w: P.w, t: -off, dur: P.tell, dmg: f.st.dmg * P.mult, icon: P.icon });
      }
      arena.floats.push({ x: f.x, y: f.y - 34, txt: P.icon + ' ' + P.name, t: -off, col: '#ff9a8a' });
    }
    function bossThink(f, dt) {
      // PHASES DU BOSS — les seuils et le tempo viennent de SA fiche
      // (ADV_FOES[biome].boss : enrageAt / summonAt / desperateAt / tempo),
      // avec repli sur les valeurs historiques : enrage 50 %, portail 60 %,
      // dernier souffle 25 %. `summonAt: 0` = ce boss n'invoque jamais.
      const cfgB = f.bossCfg || {};
      const enrageAt = cfgB.enrageAt != null ? cfgB.enrageAt : 0.5;
      const summonAt = cfgB.summonAt != null ? cfgB.summonAt : 0.6;
      const desperateAt = cfgB.desperateAt != null ? cfgB.desperateAt : 0.25;
      const tempo = cfgB.tempo || {};
      const hpPct = f.hp / f.hpMax;
      if (!f.enraged && hpPct <= enrageAt) {
        f.enraged = true;
        f.st.dmg *= 1.4;
        f.st.aspd = (f.st.aspd || 0.8) * 1.3;
        arena.floats.push({ x: f.x, y: f.y - CELL * 1.2, txt: ' ENRAGÉ !', t: 0, col: '#ff6a4a' });
        arena.zones.push({ kind: 'fx', shape: 'circle', x: f.x, y: f.y, r: CELL * 2.5, t: 0, dur: 0.5, col: '#ff6a4a' });
      }
      // L'INVOCATION EST UN PORTAIL, pas deux sbires sortis de nulle part.
      // Ça pose un vrai choix : frapper le boss, ou la source de ses renforts.
      // Le portail du boss est plus fragile qu'un portail de salle — c'est une
      // mécanique de combat, pas un siège.
      if (summonAt > 0 && !f.summoned && hpPct <= summonAt) {
        f.summoned = true;
        const diff = AD().floorDifficulty(arena.floor);
        const pt = mkPortal(arena.foes.length,
          clamp(f.x + (Math.random() < 0.5 ? -1 : 1) * CELL * 2.2, MARGIN() + CELL, W - MARGIN() - CELL),
          clamp(f.y + CELL * 0.6, MARGIN() + CELL, H * 0.55), diff, arena.floor);
        pt.hp = Math.round(pt.hp * 0.55); pt.hpMax = pt.hp;
        pt.spawnT = 2.5;
        arena.foes.push(pt);
        arena.floats.push({ x: f.x, y: f.y - CELL * 1.5, txt: ' Un portail s’ouvre !', t: 0, col: '#b88ae8' });
        sfx('pop');
      }
      // TROISIÈME PHASE, au quart des PV : le boss enchaîne ses patrons deux
      // fois plus vite. La fin d'un combat de boss doit être son sommet, pas
      // son ralentissement.
      if (!f.desperate && hpPct <= desperateAt) {
        f.desperate = true;
        arena.floats.push({ x: f.x, y: f.y - CELL * 1.2, txt: ' DERNIER SOUFFLE !', t: 0, col: '#ff6a4a' });
        arena.zones.push({ kind: 'fx', shape: 'circle', x: f.x, y: f.y, r: CELL * 3, t: 0, dur: 0.6, col: '#ff6a4a' });
        sfx('error');
      }
      // patrons plus rapides en enrage, frénétiques au dernier souffle — sauf
      // personnalité contraire (un boss « lourd » a un tempo.base > 1)
      const speedMult = f.desperate ? (tempo.desperate != null ? tempo.desperate : 0.45)
        : f.enraged ? (tempo.enrage != null ? tempo.enrage : 0.7)
        : (tempo.base != null ? tempo.base : 1);
      for (const pat of f.patterns) {
        pat.t -= dt;
        if (pat.t > 0) continue;
        const P = AD().BOSS_PATTERNS[pat.p];
        if (!P) { pat.t = 9; continue; }
        pat.t = P.every * rnd(0.85, 1.2) * speedMult;
        const targets = arena.party.filter(p => !p.dead);
        if (!targets.length) continue;
        castPattern(f, P, targets, 0);
        // AU DERNIER SOUFFLE, LES COUPS S'ENCHAÎNENT : quand un patron part,
        // une chance sur trois d'en déclencher un SECOND, différent, 0,4 s
        // derrière — la fin d'un boss doit être son sommet.
        if (f.desperate && f.patterns.length > 1 && Math.random() < 0.35) {
          const autres = f.patterns.filter(q => q.p !== pat.p);
          const P2 = autres.length ? AD().BOSS_PATTERNS[autres[Math.floor(Math.random() * autres.length)].p] : null;
          if (P2) castPattern(f, P2, targets, 0.4);
        }
      }
    }
    function inZone(p, z, pad) {
      pad = pad || 0;
      if (z.shape === 'circle') return dist(p, z) < z.r + pad;
      if (z.shape === 'ring') { const d = dist(p, z); return d < z.r + pad && d > (z.inner || 0) - pad; }
      if (z.shape === 'line') return distToSeg(p, z, { x: z.x2, y: z.y2 }) < (z.w || 40) / 2 + pad;
      return false;
    }
    // UNE ZONE A UN CAMP. Celles du joueur ne touchent QUE les ennemis : les
    // zones de boss sont symétriques par nature, celles de la compagnie ne le
    // sont pas — sinon l'IA se suicide sur son propre météore.
    // `z.dmg` d'une zone alliée est PRÉ-CALCULÉ à l'émission (`dmgOf × mult`) :
    // le lanceur peut être mort à l'atterrissage.
    function zoneHits(z) {
      if (!arena) return;
      if (z.side === 'party') {
        // LA CHARGE UTILE GÉNÉRIQUE, avec la zone pour ORIGINE : une bombe
        // repousse depuis son cratère, pas depuis un lanceur peut-être mort.
        for (const f of arena.foes) {
          if (f.dead || !inZone(f, z, 0)) continue;
          const r = chargeUtile(f, z.ab, z.dmg, z.owner, z);
          if (z.faits) { z.faits.dmg += r.d; z.faits.heal += r.h; }
        }
        return;                                    // pas de secousse pour un coup allié
      }
      for (const p of arena.party) if (!p.dead && inZone(p, z, 0)) hurtHero(p, z.dmg);
      shakeT = 0.2; shakeMag = 4;                   // la secousse est le vocabulaire du BOSS
    }
    // PLAFOND DES ZONES ALLIÉES. `dodgeZones` est en O(zones) par héros et par
    // sous-pas : c'est le dernier O(Z) du moteur. Trois annonces alliées au
    // sol au maximum, la plus vieille meurt.
    function plafonnerZonesAlliees() {
      if (!arena || !arena.zones) return;
      const idx = [];
      for (let i = 0; i < arena.zones.length; i++) {
        const z = arena.zones[i];
        if (z.side === 'party' && (z.kind === 'tell' || z.kind === 'field')) idx.push(i);
      }
      for (let k = 0; k < idx.length - 3; k++) arena.zones.splice(idx[k] - k, 1);
    }

    // ------------------------------------------------------------
    // IA — POSTURES JOUEUR
    // ------------------------------------------------------------
    // Avant, l'IA réécrivait `target` à CHAQUE image : viser « le PV le plus
    // bas » faisait sauter la cible dès qu'un ennemi prenait un coup, et les
    // unités passaient leur temps à se retourner sans jamais frapper. On garde
    // maintenant sa cible une seconde ou deux, sauf si elle meurt.
    function aimAt(e, t, list) {
      if (!t) return;
      if (e.target === t.id) return;
      if ((e.retarget || 0) > 0 && list.find(o => o.id === e.target && !o.dead)) return;
      e.target = t.id;
      e.retarget = rnd(1.1, 2.2);
    }
    function nearest(from, list) {
      let best = null, bd = 1e9;
      for (const e of list) { if (e.dead) continue; const d = dist(from, e); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    function lowestHp(list) {
      let best = null, bp = 2;
      for (const e of list) { if (e.dead) continue; const p = e.hp / e.hpMax; if (p < bp) { bp = p; best = e; } }
      return best;
    }
    // LE CŒUR DU GROUPE ENNEMI : l'ennemi qui a le plus de congénères autour
    // de lui (rayon donné). C'est là qu'une tempête ou une bombe rapportent.
    function densestFoe(radius) {
      let best = null, bn = -1;
      for (const f of arena.foes) {
        if (f.dead || f.portal) continue;
        let n = 0;
        for (const o of arena.foes) if (!o.dead && !o.portal && dist(o, f) < radius) n++;
        if (n > bn) { bn = n; best = f; }
      }
      return best ? { foe: best, n: bn } : null;
    }
    // le centre de gravité des vivants (pour rester au milieu des siens)
    function partyCenter(sauf) {
      let mx = 0, my = 0, n = 0;
      for (const h of arena.party) {
        if (h.dead || (sauf && h.id === sauf.id)) continue;
        mx += h.x; my += h.y; n++;
      }
      return n ? { x: mx / n, y: my / n, n } : null;
    }
    function dodgeZones(p) {
      for (const z of arena.zones) {
        // ON N'ESQUIVE PAS SES PROPRES BOMBES. `dodgeZones` est en priorité
        // ABSOLUE dans `autoPlay` : sans ce test de camp, la moindre annonce
        // du joueur fait détaler les cinq personnages — le lanceur compris —
        // pendant une seconde et demie, toutes les trente secondes.
        if (z.kind !== 'tell' || z.side === 'party') continue;
        if (!inZone(p, z, CELL * 0.3)) continue;
        let ax, ay, need;
        if (z.shape === 'circle') { ax = p.x - z.x; ay = p.y - z.y; need = z.r + CELL * 0.8 - dist(p, z); }
        else if (z.shape === 'ring') { ax = z.x - p.x; ay = z.y - p.y; need = Math.max(CELL, dist(p, z) - (z.inner || 0) * 0.4); }
        else { const a = Math.atan2(z.y2 - z.y, z.x2 - z.x) + Math.PI / 2; ax = Math.cos(a); ay = Math.sin(a); need = (z.w || 40) / 2 + CELL * 0.8 - distToSeg(p, z, { x: z.x2, y: z.y2 }); }
        let L = Math.hypot(ax, ay);
        if (L < 0.001) { const a0 = ((Math.abs(p.x) * 7 + Math.abs(p.y) * 13) % 628) / 100; ax = Math.cos(a0); ay = Math.sin(a0); L = 1; }
        const step = clamp(need + CELL * 0.6, CELL, CELL * 4);
        const base = Math.atan2(ay, ax);
        for (let k = 0; k < 8; k++) {
          const a = base + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.7;
          const nx = clamp(p.x + Math.cos(a) * step, MARGIN(), W - MARGIN());
          const ny = clamp(p.y + Math.sin(a) * step, MARGIN(), H - MARGIN());
          if (Math.hypot(nx - p.x, ny - p.y) > CELL * 0.35) { p.dest = { x: nx, y: ny }; p.target = null; return true; }
        }
        return false;
      }
      return false;
    }
    // ------------------------------------------------------------
    // LE CONTEXTE DE SALLE — calculé UNE fois par sous-pas
    // ------------------------------------------------------------
    // Cinq personnages qui interrogent chacun « qui est le plus blessé ? / où
    // est le groupe le plus dense ? » font cinq balayages de la salle par
    // image. Ces réponses sont les MÊMES pour tout le monde : on les calcule
    // une fois, on les passe. À 24 ennemis et 5 alliés, c'est la différence
    // entre un balayage et vingt-cinq.
    function contexteIA() {
      const foes = [], party = [];
      for (const f of arena.foes) if (!f.dead && !f.portal) foes.push(f);
      /* Une invocation n entre pas dans le contexte de l IA : un soigneur
         qui verse ses soins sur ce qui va s evanouir dans huit secondes
         les gaspille, et le blesse a cote attend. */
      for (const h of arena.party) if (!h.dead && !h.protege && !h._invoque) party.push(h);
      let blesse = null, pire = 2;
      for (const h of party) {
        const r = h.hp / Math.max(1, h.hpMax);
        if (r < pire) { pire = r; blesse = h; }
      }
      return {
        foes, party, nFoes: foes.length,
        blesse, pireRatio: blesse ? pire : 1,
        // le groupe le plus serré : lu par les postures de zone
        amas: densestFoe(CELL * 2),
        centre: party.length ? partyCenter(null) : null,
      };
    }
    // L'ARRIÈRE-LIGNE. Un tireur ou un lanceur de sorts ennemi tue plus qu'un
    // targier, et il est le plus souvent DERRIÈRE — donc jamais choisi par un
    // ciblage « le plus proche ». On le reconnaît à sa portée et à son rôle,
    // et on prend celui qui est le plus LOIN du front (le plus au fond).
    function arriereFoe(foes) {
      let best = null, bs = -1;
      for (const f of foes) {
        const distant = (f.st && f.st.range > 0) ? 1 : 0;
        const role = (f.behavior === 'ranged_kiter' || f.behavior === 'zone_caster') ? 1 : 0;
        if (!distant && !role) continue;
        // plus il est haut dans la salle (loin de l'entrée de la compagnie),
        // plus il est « à l'arrière »
        const sc = (H - f.y) + role * CELL * 2 + distant * CELL;
        if (sc > bs) { bs = sc; best = f; }
      }
      return best;
    }
    // LE PLUS MENAÇANT : ce qui fait le plus de dégâts par seconde, avec une
    // prime à celui qui frappe DÉJÀ un des nôtres — le danger réel, pas le
    // danger théorique.
    function plusMenacant(foes) {
      let best = null, bs = -1;
      for (const f of foes) {
        const st = f.st || {};
        let sc = (st.dmg || 0) * (st.aspd || 1) * (f.boss ? 2.5 : f.elite ? 1.6 : 1);
        if (f.target && arena.party.some(h => h.id === f.target && !h.dead)) sc *= 1.4;
        if (sc > bs) { bs = sc; best = f; }
      }
      return best;
    }
    // SUR QUI ce pouvoir part-il ? La posture décide en premier (`pol.cible`),
    // et si elle laisse faire (`null`) c'est le pouvoir qui dit ce qu'il veut
    // (`ia.veut`). Un pouvoir centré sur le lanceur n'a pas de cible du tout.
    function cibleDe(p, slot, ctx) {
      const ab = slot.p;
      const k = ab.kind;
      if (k === 'buff_self' || k === 'aoe_self' || k === 'taunt' || k === 'dash') return null;
      if (k === 'heal' || k === 'rally' || k === 'buff_party') return ctx.blesse || p;
      const POL = (AD().polOf ? AD().polOf(p.stance) : null) || {};
      const veut = POL.cible || (ab.ia && ab.ia.veut) || 'proche';
      switch (veut) {
        case 'faible':  return lowestHp(ctx.foes) || nearest(p, ctx.foes);
        case 'arriere': return arriereFoe(ctx.foes) || nearest(p, ctx.foes);
        case 'menace':  return plusMenacant(ctx.foes) || nearest(p, ctx.foes);
        case 'groupe':  return (ctx.amas && ctx.amas.foe) || nearest(p, ctx.foes);
        case 'blesse':  return ctx.blesse || p;
        case 'soi':     return null;
        default:        return nearest(p, ctx.foes);
      }
    }
    // FAUT-IL TIRER ? On refuse pour des raisons que le joueur puisse LIRE :
    // le motif remonte jusqu'à l'infobulle du bouton, parce qu'une jauge pleine
    // qui ne part pas ressemble sinon à un bug.
    function veutTirer(p, slot, ctx, cible) {
      const ab = slot.p;
      const POL = (AD().polOf ? AD().polOf(p.stance) : null) || {};
      const q = ab.quand || {};
      const k = ab.kind;
      slot.motif = null;
      // 1. LES SOINS ET LES RALLIEMENTS : jamais à pleine vie. Le seuil vient
      //    de la posture (le triage soigne dès 85 %, le berserker à 40 %).
      if (k === 'heal' || k === 'rally') {
        const seuil = q.hpAllie != null ? q.hpAllie : (POL.seuilAllie != null ? POL.seuilAllie : 0.6);
        if (ctx.pireRatio > seuil) { slot.motif = 'attend un blessé'; return false; }
        return true;
      }
      // 2. LES ZONES : elles ne valent que sur un GROUPE. Une bombe de 30 s de
      //    recharge sur un ennemi isolé est du gâchis — sauf si on est acculé.
      const estZone = (ab.tags || []).indexOf('zone') >= 0;
      if (estZone) {
        const mini = q.foesMin != null ? q.foesMin : (POL.groupe || 2);
        const n = (ctx.amas && ctx.amas.n) || 0;
        const proche = nearest(p, ctx.foes);
        const accule = proche && dist(p, proche) < CELL * 1.4;
        if (n < mini && !accule) { slot.motif = 'attend ' + mini + ' ennemis groupés'; return false; }
      }
      // 3. LES BUFFS ET LES PROVOCATIONS : il faut un combat en cours.
      if (k === 'buff_party' || k === 'buff_self' || k === 'taunt') {
        const proche = nearest(p, ctx.foes);
        if (!proche || dist(p, proche) > CELL * 5) { slot.motif = 'attend le contact'; return false; }
        return true;
      }
      // 4. SEUILS ÉCRITS DANS LE POUVOIR (« sous 50 % de MES PV »…).
      if (q.hpSoi != null && p.hp / Math.max(1, p.hpMax) > q.hpSoi) { slot.motif = 'attend d’être blessé'; return false; }
      if (q.foesMin != null && ctx.nFoes < q.foesMin) { slot.motif = 'attend ' + q.foesMin + ' ennemis'; return false; }
      // 5. LA PORTÉE, pour tout ce qui vise.
      if (cible) {
        const portee = ab.range || ab.len || ab.radius || CELL * 4;
        if (dist(p, cible) > portee) { slot.motif = 'hors de portée'; return false; }
      } else if (k !== 'aoe_self' && k !== 'dash') {
        const proche = nearest(p, ctx.foes);
        if (!proche) { slot.motif = 'aucune cible'; return false; }
        if (dist(p, proche) > (ab.radius || CELL * 4)) { slot.motif = 'hors de portée'; return false; }
      }
      return true;
    }
    // QUEL pouvoir part, parmi ceux qui sont prêts ? On note chacun par le goût
    // de la posture pour ses ÉTIQUETTES (`pol.prio.zone`, `pol.prio.soin`…)
    // multiplié par sa propre priorité, et on lâche le meilleur. UN seul par
    // personnage à la fois : `gcd` empêche les enchaînements en 500 ms, et
    // `arena.castJetons` empêche les cinq personnages de tirer sur la même
    // image — deux jetons par seconde pour toute la compagnie.
    function lancerPouvoirs(p, ctx) {
      if (!p.pouvoirs || !p.pouvoirs.length) return false;
      if (p.gcd > 0) return false;
      if (arena.castJetons <= 0) return false;
      const POL = (AD().polOf ? AD().polOf(p.stance) : null) || {};
      const prio = POL.prio || {};
      let best = null, bestSlot = -1, bs = -1, bestCible = null;
      for (let i = 0; i < p.pouvoirs.length; i++) {
        const slot = p.pouvoirs[i];
        if (!slot || !slot.p) continue;
        if (slot.cd > 0) { slot.motif = null; continue; }   // pas prêt : rien à dire
        const cible = cibleDe(p, slot, ctx);
        if (!veutTirer(p, slot, ctx, cible)) continue;
        let sc = ((slot.p.ia && slot.p.ia.prio) || 50) / 50;
        for (const tag of (slot.p.tags || [])) sc *= (prio[tag] != null ? prio[tag] : 1);
        // à note égale, le pouvoir à LONGUE recharge passe devant : c'est le
        // gros coup, il ne doit pas être coiffé par un petit sort de 8 s.
        sc += (slot.cdMax || 0) * 0.004;
        if (sc > bs) { bs = sc; best = slot; bestSlot = i; bestCible = cible; }
      }
      if (!best) return false;
      arena.castJetons -= 1;
      const k = best.p.kind;
      // les kinds qui visent un POINT reçoivent des coordonnées ; les autres
      // reçoivent la cible elle-même (5e argument), ce qui contourne
      // l'hystérésis de `aimAt` sans jamais toucher à `p.retarget`.
      if (bestCible && (k === 'aoe_point' || k === 'line' || k === 'bolt' || k === 'field' || k === 'dash')) {
        return fireAbility(p, best, bestCible.x, bestCible.y, bestCible);
      }
      return fireAbility(p, best, null, null, bestCible);
    }

    function autoPlay(p) {
      if (dodgeZones(p)) return;
      if (arena.phase !== 'fight') return;
      if (p._freeT > 0) return;            // en train de se dégager d'un obstacle
      const stance = p.stance || 'berserker';
      const foe = nearest(p, arena.foes);
      if (!foe) return;
      // L'ASTUCE DU CANAL EMPRUNTÉ EST SUPPRIMÉE. Elle prêtait `p.ab` au
      // pouvoir de voie le temps d'un tir, puis le rendait. Trois raisons :
      // elle n'existait que parce que `fireAbility` lisait `p.ab` en dur (il
      // prend maintenant un SLOT) ; elle n'était pas ré-entrante — tout ce qui,
      // sous `fireAbility`, peut terminer la salle laissait la capacité de
      // classe pointée sur le pouvoir prêté, et le `try/catch` VIDE avalait
      // l'exception ET sautait la restauration ; enfin elle écrasait la
      // recharge, donc un mod `cd` sur un pouvoir de voie n'a jamais pu
      // s'appliquer. Les cinq pouvoirs passent désormais par `p.pouvoirs`, et
      // c'est `lancerPouvoirs` (§5.8) qui choisit lequel part.
      //
      // LES POUVOIRS : la panoplie entière passe par `lancerPouvoirs`, qui note
      // chaque pouvoir prêt selon la posture et lâche le meilleur. C'est ici
      // que « plusieurs pouvoirs » cesse d'être une promesse de données.
      lancerPouvoirs(p, arena._ctx || contexteIA());
      // LE CIBLAGE PAR POSTURE. Chaque posture de GameData.AI_STANCES a son
      // cas — sa description est le cahier des charges, le case l'exécute.
      switch (stance) {
        // les brutes : viser le PV le plus bas et cogner (le « combattant »
        // du Général est de cette famille — mêlée DPS, au contact)
        case 'berserker': case 'assassin': case 'executeur': case 'focaliseur': case 'combattant': {
          aimAt(p, lowestHp(arena.foes) || foe, arena.foes); p.dest = null;
          break;
        }
        case 'vengeur': {
          // il PUNIT : vise en priorité l'ennemi qui s'en prend à la compagnie
          let att = null, bd = 1e9;
          for (const f2 of arena.foes) {
            if (f2.dead || f2.portal || !f2.target) continue;
            if (!arena.party.some(h => h.id === f2.target && !h.dead)) continue;
            const d = dist(p, f2);
            if (d < bd) { bd = d; att = f2; }
          }
          aimAt(p, att || foe, arena.foes); p.dest = null;
          break;
        }
        case 'tempete': {
          // AoE sur les GROUPES : elle vise là où les ennemis se serrent
          const dc = densestFoe(CELL * 2);
          aimAt(p, (dc && dc.foe) || foe, arena.foes); p.dest = null;
          break;
        }
        case 'sapeur': {
          // la bombe au cœur des groupes — et du champ : il recule si on le serre
          const dc = densestFoe(CELL * 2);
          aimAt(p, (dc && dc.foe) || foe, arena.foes);
          if (dist(p, foe) < CELL * 2 && rangeOf(p) > 0) {
            const a = Math.atan2(p.y - foe.y, p.x - foe.x);
            p.dest = { x: clamp(p.x + Math.cos(a) * CELL * 2, MARGIN(), W - MARGIN()),
                       y: clamp(p.y + Math.sin(a) * CELL * 2, MARGIN(), H - MARGIN()) };
            p.target = null;
          } else p.dest = null;
          break;
        }
        case 'piegeur': {
          // déni de terrain : il tient l'ennemi À DISTANCE et pilonne l'approche
          aimAt(p, foe, arena.foes);
          if (dist(p, foe) < CELL * 2.5 && rangeOf(p) > 0) {
            const a = Math.atan2(p.y - foe.y, p.x - foe.x);
            p.dest = { x: clamp(p.x + Math.cos(a) * CELL * 2, MARGIN(), W - MARGIN()),
                       y: clamp(p.y + Math.sin(a) * CELL * 2, MARGIN(), H - MARGIN()) };
            p.target = null;
          } else p.dest = null;
          break;
        }
        case 'eclaireur': {
          // très mobile : jamais deux secondes au même endroit — un pas de
          // côté régulier autour de sa cible, plus dur à viser
          aimAt(p, foe, arena.foes);
          const d = dist(p, foe);
          if (d < CELL * 1.2 && rangeOf(p) > 0) {
            const a = Math.atan2(p.y - foe.y, p.x - foe.x);
            p.dest = { x: clamp(p.x + Math.cos(a) * CELL * 2, MARGIN(), W - MARGIN()),
                       y: clamp(p.y + Math.sin(a) * CELL * 2, MARGIN(), H - MARGIN()) };
            p.target = null;
          } else if ((Math.floor(arena.t) % 3) === 2 && d < CELL * 5) {
            const a = Math.atan2(foe.y - p.y, foe.x - p.x) + ((Math.floor(arena.t / 3) % 2) ? 1.57 : -1.57);
            p.dest = { x: clamp(p.x + Math.cos(a) * CELL * 1.4, MARGIN(), W - MARGIN()),
                       y: clamp(p.y + Math.sin(a) * CELL * 1.4, MARGIN(), H - MARGIN()) };
            p.target = null;
          } else p.dest = null;
          break;
        }
        case 'triage': {
          // le PV% le plus bas D'ABORD : il se porte au chevet, le reste attend
          const ally = lowestHp(arena.party.filter(h => !h.dead && h.id !== p.id));
          const s0 = p.pouvoirs && p.pouvoirs[0];
          const portee = (s0 && s0.p.radius) ? s0.p.radius * 0.8 : CELL * 3;
          if (ally && ally.hp / ally.hpMax < 0.85 && dist(p, ally) > portee) {
            p.dest = { x: ally.x + rnd(-CELL * 0.6, CELL * 0.6), y: ally.y + rnd(-CELL * 0.6, CELL * 0.6) };
            p.target = null;
          } else { aimAt(p, foe, arena.foes); p.dest = null; }
          break;
        }
        case 'chef': {
          // au CENTRE du groupe : ses refrains portent sur tout le monde
          const c = partyCenter(p);
          if (c && Math.hypot(c.x - p.x, c.y - p.y) > CELL * 2.2) {
            p.dest = { x: c.x, y: c.y }; p.target = null;
          } else { aimAt(p, foe, arena.foes); p.dest = null; }
          break;
        }
        case 'dueliste': {
          // FOCUS FIRE : il appuie la cible déjà travaillée par la compagnie
          const compte = {};
          for (const h of arena.party) {
            if (h.dead || h.id === p.id || !h.target) continue;
            compte[h.target] = (compte[h.target] || 0) + 1;
          }
          let focus = null, bn = 0;
          for (const id in compte) {
            if (compte[id] <= bn) continue;
            const f2 = arena.foes.find(o => o.id === id && !o.dead);
            if (f2) { bn = compte[id]; focus = f2; }
          }
          if (focus && p.target !== focus.id) p.retarget = 0;   // il suit le groupe sans traîner
          aimAt(p, focus || lowestHp(arena.foes) || foe, arena.foes); p.dest = null;
          break;
        }
        case 'commandant': {
          // le Général SOUTIENT : un demi-pas derrière le centre des siens,
          // d'où son cri porte sur toute la compagnie
          const c = partyCenter(p);
          if (c && c.n >= 2 && Math.hypot(c.x - p.x, (c.y + CELL * 0.8) - p.y) > CELL * 2.5) {
            p.dest = { x: c.x, y: clamp(c.y + CELL * 0.8, MARGIN(), H - MARGIN()) };
            p.target = null;
          } else { aimAt(p, foe, arena.foes); p.dest = null; }
          break;
        }
        case 'sentinel': case 'berger': {
          const ally = lowestHp(arena.party.filter(h => !h.dead && h.id !== p.id));
          if (ally && ally.hp / ally.hpMax < 0.5) {
            if (dist(p, ally) > CELL * 2) { p.dest = { x: ally.x + rnd(-CELL, CELL), y: ally.y + rnd(-CELL, CELL) }; p.target = null; }
            else { aimAt(p, foe, arena.foes); p.dest = null; }
          } else { aimAt(p, foe, arena.foes); p.dest = null; }
          break;
        }
        case 'harceleur': {
          aimAt(p, foe, arena.foes);
          if (dist(p, foe) < CELL * 1.5 && rangeOf(p) > 0) {
            const a = Math.atan2(p.y - foe.y, p.x - foe.x);
            p.dest = { x: clamp(p.x + Math.cos(a) * CELL * 2, MARGIN(), W - MARGIN()), y: clamp(p.y + Math.sin(a) * CELL * 2, MARGIN(), H - MARGIN()) };
          } else p.dest = null;
          break;
        }
        case 'mur': {
          // (son contrôle et son bouclier partent par `lancerPouvoirs`, qui
          // connaît sa politique `controle 2,0 · bouclier 1,5`)
          aimAt(p, foe, arena.foes); p.dest = null;
          break;
        }
        default: { aimAt(p, foe, arena.foes); p.dest = null; }
      }
    }

    // ------------------------------------------------------------
    // IA — COMPORTEMENTS ENNEMIS
    // ------------------------------------------------------------
    // ------------------------------------------------------------
    // LES POUVOIRS DES MONSTRES
    // ------------------------------------------------------------
    // Un monstre n'est pas une couleur : c'est un problème. Chacun a le sien,
    // annoncé par une étiquette au-dessus de sa tête pour que le joueur
    // apprenne à le reconnaître avant de le subir.
    function crie(f, P) {
      arena.floats.push({ x: f.x, y: f.y - CELL * 1.1, txt: P.icon + ' ' + P.name, t: 0, col: '#ffcf8a' });
    }
    function monsterPower(f, dt) {
      const pw = f.power;
      if (!pw) return;
      const P = AD().MONSTER_POWERS[pw.id];
      if (!P) return;
      const vivants = arena.party.filter(p => !p.dead);
      // --- les passifs : ils se déclenchent sur un seuil de vie ---
      if (pw.id === 'carapace') {
        if (!f._cara && f.hp < f.hpMax * (pw.seuil || 0.4)) {
          f._cara = 1;
          f.st.armor = (f.st.armor || 1) * (pw.mult || 3);
          crie(f, P);
          arena.zones.push({ kind: 'fx', shape: 'circle', x: f.x, y: f.y, r: CELL, t: 0, dur: 0.5, col: '#b0a898' });
        }
        return;
      }
      if (pw.id === 'scission') {
        if (!f._fendu && f.hp < f.hpMax * (pw.seuil || 0.5) && arena.foes.length < 24) {
          f._fendu = 1;
          crie(f, P);
          for (const k of [-1, 1]) {
            const petit = mkFoe(f.animalId, arena.foes.length, 1, arena.diff, null);
            petit.id = f.id + 's' + (k > 0 ? 1 : 0);
            petit.hp = petit.hpMax = Math.max(1, Math.round(f.hpMax * 0.35));
            petit.scale = (f.scale || 1) * 0.72;
            petit._fendu = 1;                       // les rejetons ne se refendent pas
            petit.x = clamp(f.x + k * CELL * 0.8, MARGIN(), W - MARGIN());
            petit.y = clamp(f.y + CELL * 0.3, MARGIN(), H - MARGIN());
            arena.foes.push(petit);
          }
        }
        return;
      }
      // --- les actifs : un délai, puis ça part ---
      f.powCd -= dt;
      if (f.powCd > 0 || !vivants.length) return;
      f.powCd = pw.cd || 8;
      const cible = nearest(f, vivants);
      if (pw.id === 'hurlement') {
        crie(f, P);
        let n = 0;
        for (const o of arena.foes) {
          if (o.dead || dist(o, f) > CELL * (pw.rayon || 4)) continue;
          putBuff(o, 'dmg', pw.bonus || 0.45, pw.duree || 5);
          n++;
        }
        arena.zones.push({ kind: 'fx', shape: 'circle', x: f.x, y: f.y, r: CELL * (pw.rayon || 4), t: 0, dur: 0.6, col: '#e08a3a' });
        if (n > 1) arena.floats.push({ x: f.x, y: f.y - CELL * 1.5, txt: 'la meute s’excite', t: 0, col: '#e08a3a' });
        return;
      }
      if (pw.id === 'feinte') {
        crie(f, P);
        f._feinte = (pw.duree || 2.5);              // il devient insaisissable
        return;
      }
      if (pw.id === 'larcin') {
        if (!cible || dist(f, cible) > CELL * 2.2) { f.powCd = 2; return; }
        crie(f, P);
        f._vole = (f._vole || 0) + (pw.part || 0.12);
        arena.floats.push({ x: cible.x, y: cible.y - CELL * 0.9, txt: ' butin volé !', t: 0, col: '#e8c04a' });
        // et il détale à l'opposé
        const a = Math.atan2(f.y - cible.y, f.x - cible.x);
        f.dest = { x: clamp(f.x + Math.cos(a) * CELL * 5, MARGIN(), W - MARGIN()),
                   y: clamp(f.y + Math.sin(a) * CELL * 5, MARGIN(), H - MARGIN()) };
        f.target = null; f._freeT = 2;
        return;
      }
      if (pw.id === 'charge') {
        if (!cible || dist(f, cible) < CELL * 1.5 || dist(f, cible) > CELL * (pw.portee || 5)) { f.powCd = 1.5; return; }
        crie(f, P);
        const a = Math.atan2(cible.y - f.y, cible.x - f.x);
        arena.zones.push({ kind: 'tell', shape: 'line', x: f.x, y: f.y,
          x2: f.x + Math.cos(a) * CELL * (pw.portee || 5), y2: f.y + Math.sin(a) * CELL * (pw.portee || 5),
          w: CELL * 0.9, t: 0, dur: 0.7, dmg: (f.st.dmg || 5) * (pw.degats || 1.6), icon: '' });
        f.dest = { x: clamp(f.x + Math.cos(a) * CELL * (pw.portee || 5), MARGIN(), W - MARGIN()),
                   y: clamp(f.y + Math.sin(a) * CELL * (pw.portee || 5), MARGIN(), H - MARGIN()) };
        f.target = null; f._freeT = 0.8;
        return;
      }
      if (pw.id === 'nuee') {
        const miens = arena.foes.filter(o => o.animalId === f.animalId && !o.dead).length;
        if (miens > (pw.max || 2) + 1 || arena.foes.length > 20) { f.powCd = 4; return; }
        crie(f, P);
        const ami = mkFoe(f.animalId, arena.foes.length, 1, arena.diff, null);
        ami.id = f.id + 'n' + arena.foes.length;
        ami.x = clamp(f.x + rnd(-CELL, CELL), MARGIN(), W - MARGIN());
        ami.y = clamp(MARGIN() + CELL * 0.5, MARGIN(), H * 0.4);
        ami.powCd = (pw.cd || 13) * 2;              // le renfort n'appelle pas tout de suite
        arena.foes.push(ami);
        return;
      }
      if (pw.id === 'crachat') {
        if (!cible) return;
        crie(f, P);
        arena.zones.push({ kind: 'tell', shape: 'circle', x: cible.x, y: cible.y,
          r: CELL * (pw.rayon || 1.5), t: 0, dur: 0.9, dmg: (f.st.dmg || 5) * 1.2, icon: '' });
        return;
      }
    }

    function foeThink(f, dt) {
      if (f.portal) return;      // un portail ne pense pas — il se contente d'exister
      if (f.stunT > 0) return;   // ÉTOURDI : il ne pense pas non plus (cf. putStun)
      if (f.boss) bossThink(f, dt);
      monsterPower(f, dt);
      if (f._feinte > 0) f._feinte -= dt;
      if (f.elite) eliteThink(f, dt);
      if (f._freeT > 0) return;            // il se dégage d'un obstacle
      const behavior = f.behavior || 'rusher';
      const alive = arena.party.filter(p => !p.dead);
      if (!alive.length) { f.target = null; return; }
      switch (behavior) {
        case 'rusher': {
          aimAt(f, nearest(f, alive), alive);
          f.dest = null;
          break;
        }
        case 'flanker': {
          const t = nearest(f, alive);
          if (!t) break;
          aimAt(f, t, alive);
          // approach from the side
          if (dist(f, t) > CELL * 2.5) {
            const a = Math.atan2(t.y - f.y, t.x - f.x) + (f.id.charCodeAt(1) % 2 ? 1.2 : -1.2);
            f.dest = { x: clamp(t.x + Math.cos(a) * CELL * 1.5, MARGIN(), W - MARGIN()), y: clamp(t.y + Math.sin(a) * CELL * 1.5, MARGIN(), H - MARGIN()) };
          } else f.dest = null;
          break;
        }
        case 'ranged_kiter': {
          const t = nearest(f, alive);
          if (!t) break;
          aimAt(f, t, alive);
          const d = dist(f, t);
          if (d < CELL * 2) {
            const a = Math.atan2(f.y - t.y, f.x - t.x);
            f.dest = { x: clamp(f.x + Math.cos(a) * CELL * 2, MARGIN(), W - MARGIN()), y: clamp(f.y + Math.sin(a) * CELL * 2, MARGIN(), H - MARGIN()) };
          } else f.dest = null;
          break;
        }
        case 'bruiser': {
          // target highest HP
          let best = null, bhp = 0;
          for (const p of alive) { if (p.hp > bhp) { bhp = p.hp; best = p; } }
          aimAt(f, best, alive);
          f.dest = null;
          break;
        }
        case 'swarmer': {
          // focus same target as nearest ally foe
          const allyFoe = arena.foes.find(x => !x.dead && x.id !== f.id && x.target);
          const meute = allyFoe && alive.find(p => p.id === allyFoe.target);
          aimAt(f, meute || nearest(f, alive), alive);
          f.dest = null;
          break;
        }
        case 'zone_caster': {
          const t = nearest(f, alive);
          if (!t) break;
          aimAt(f, t, alive);
          // stay back and create zones
          if (dist(f, t) < CELL * 3) {
            const a = Math.atan2(f.y - t.y, f.x - t.x);
            f.dest = { x: clamp(f.x + Math.cos(a) * CELL * 1.5, MARGIN(), W - MARGIN()), y: clamp(f.y + Math.sin(a) * CELL * 1.5, MARGIN(), H - MARGIN()) };
          } else f.dest = null;
          // mini zone attack
          if (!f._zoneCd) f._zoneCd = 0;
          f._zoneCd -= dt;
          if (f._zoneCd <= 0 && t) {
            f._zoneCd = rnd(4, 7);
            arena.zones.push({ kind: 'tell', shape: 'circle', x: t.x, y: t.y, r: CELL * 1.2, t: 0, dur: 1.2, dmg: f.st.dmg * 1.5, icon: '' });
          }
          break;
        }
        case 'fuyard': {
          const t = nearest(f, alive);
          if (!t) break;
          // LE TROPHÉE DE CHASSE : un fuyard-né. Il ne se bat jamais et vise
          // l'ESCALIER dès l'entrée — plus pressé quand on le blesse. S'il
          // l'atteint, il s'échappe : la prime est perdue, pas la salle.
          if (f.trophee) {
            f.target = null;
            f.dest = { x: stairX(), y: stairY() + CELL * 0.5 };
            // 0,35 = +35 % (c'était « × 1,35 ») : la carte de buffs est ADDITIVE
            if (f.hp < f.hpMax * 0.6) putBuff(f, 'spd', 0.35, 0.5);
            if (Math.hypot(f.x - stairX(), f.y - stairY()) < CELL * 1.3) {
              f.dead = true; f.deadT = 0.3; f.echappe = true;
              arena.floats.push({ x: f.x, y: f.y - CELL, txt: ' Le trophée s\'échappe !', t: 0, col: '#ffcf8a' });
            }
            break;
          }
          // SOUS 35 % DE VIE, IL DÉTALE : un bond via _freeT pour se dégager,
          // puis il se tient hors de portée. En pleine santé : un rusher
          // prudent — il charge, mais recule d'un pas si on le cerne.
          if (f.hp < f.hpMax * 0.35) {
            const d = dist(f, t);
            if (d < CELL * 4) {
              const a = Math.atan2(f.y - t.y, f.x - t.x);
              f.dest = { x: clamp(f.x + Math.cos(a) * CELL * 3.5, MARGIN(), W - MARGIN()),
                         y: clamp(f.y + Math.sin(a) * CELL * 3.5, MARGIN(), H - MARGIN()) };
              f.target = null; f._freeT = 0.9;
            } else { f.target = null; f.dest = null; }
          } else {
            const cernes = alive.filter(p => dist(p, f) < CELL * 2).length;
            if (cernes >= 2) {
              const a = Math.atan2(f.y - t.y, f.x - t.x);
              f.dest = { x: clamp(f.x + Math.cos(a) * CELL * 1.5, MARGIN(), W - MARGIN()),
                         y: clamp(f.y + Math.sin(a) * CELL * 1.5, MARGIN(), H - MARGIN()) };
              f.target = null;
            } else { aimAt(f, t, alive); f.dest = null; }
          }
          break;
        }
        case 'meute': {
          // LE CHEF DE MEUTE : le congénère le plus costaud encore debout.
          // Toute la meute converge sur SA cible — et à plusieurs, on court.
          let chef = null, bhp = -1;
          for (const o of arena.foes) {
            if (o.dead || o.portal || o.behavior !== 'meute') continue;
            if (o.hpMax > bhp) { bhp = o.hpMax; chef = o; }
          }
          const cibleChef = (chef && chef !== f && chef.target)
            ? alive.find(p => p.id === chef.target) : null;
          if (cibleChef && f.target !== cibleChef.id) f.retarget = 0;   // la meute ne traîne pas
          aimAt(f, cibleChef || nearest(f, alive), alive);
          f.dest = null;
          let proches = 0;
          for (const o of arena.foes) {
            if (o === f || o.dead || o.portal || o.behavior !== 'meute') continue;
            if (dist(o, f) < CELL * 3.5) proches++;
          }
          // 0,18 = +18 % (c'était « × 1,18 ») : la carte de buffs est ADDITIVE
          if (proches >= 2) putBuff(f, 'spd', 0.18, 0.5);
          break;
        }
        case 'garde': {
          // LE GARDE DU CORPS : il colle le tireur/caster allié le plus proche
          // et S'INTERPOSE — il se poste entre son protégé et le héros qui le
          // menace, aux deux tiers du chemin, côté danger.
          let prot = null, bd = 1e9;
          for (const o of arena.foes) {
            if (o.dead || o.portal || o === f || o.trophee) continue;
            const tire = rangeOf(o) > 0 || o.behavior === 'zone_caster' || o.behavior === 'ranged_kiter';
            if (!tire) continue;
            const d = dist(f, o);
            if (d < bd) { bd = d; prot = o; }
          }
          const menace = prot ? nearest(prot, alive) : null;
          if (prot && menace) {
            const ix = prot.x + (menace.x - prot.x) * 0.6;
            const iy = prot.y + (menace.y - prot.y) * 0.6;
            if (Math.hypot(f.x - ix, f.y - iy) > CELL * 0.8) {
              f.dest = { x: clamp(ix, MARGIN(), W - MARGIN()), y: clamp(iy, MARGIN(), H - MARGIN()) };
              f.target = null;
            } else { aimAt(f, menace, alive); f.dest = null; }
          } else {
            // plus personne à protéger : il se bat comme tout le monde
            aimAt(f, nearest(f, alive), alive); f.dest = null;
          }
          break;
        }
        default: { aimAt(f, nearest(f, alive), alive); f.dest = null; }
      }
    }

    // ------------------------------------------------------------
    // LE TICK
    // ------------------------------------------------------------
    function stepUnit(e, dt, foesList) {
      // UNE SEULE BOUCLE D'EXPIRATION, pour toutes les clés de la carte : ce
      // sont les trois minuteries écrites à la main qui laissaient `dr`,
      // `invuln`, `abs`, `aspd`, `immuneStun` et `recv` courir sans fin.
      if (e.buffs) for (const k in e.buffs) {
        const b = e.buffs[k];
        if (b.t > 0) { b.t -= dt; if (b.t <= 0) { b.v = 0; b.t = 0; } }
      }
      /* LA RECHARGE DU BOUCLIER. Elle ne demarre qu’apres `ESH_REPIT`
         secondes sans avoir rien pris — c’est ce delai, et lui seul, qui
         fait la difference entre une reserve qu’on menage et une barre de
         vie de plus. Le test porte sur `eshMax` : seuls les porteurs en ont
         un, la boucle ne coute donc rien aux autres ni aux ennemis. */
      if (e.eshMax > 0 && !e.dead) {
        e.eshT = (e.eshT || 0) + dt;
        const repit = (AD().ESH_REPIT != null) ? AD().ESH_REPIT : 4;
        if (e.eshT >= repit && e.esh < e.eshMax) {
          const parSec = (e.st && e.st.eshRegen) || (e.eshMax * 0.12);
          e.esh = Math.min(e.eshMax, e.esh + parSec * dt);
        }
      }
      // LE CONTRÔLE se purge en ~10 s ; tant qu'il dure, l'unité est absente.
      if (e.ctrlT > 0) e.ctrlT = Math.max(0, e.ctrlT - dt * 0.3);
      if (e.stunT > 0) {
        e.stunT -= dt; e.moving = false; e.phase = (e.phase || 0) + dt * 0.4;
        if (e.statuses) tickStatuses(e, dt);   // il brûle quand même
        return;                                // ni pensée, ni pas, ni coup
      }
      // LES RECHARGES — chaque slot a la sienne, et AUCUNE autre fonction
      // n'écrit dans `slot.cd` : `fireAbility` la remplit, `recharge` (le
      // drapeau d'un `buff_party`) la raccourcit. `stepUnit` tourne aussi en
      // phase `cleared` et au camp : elles descendent pendant la marche vers
      // l'escalier, comme avant.
      if (e.pouvoirs) for (const s of e.pouvoirs) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      // LE DÉLAI COMMUN entre deux lâchers d'un même personnage : six pouvoirs
      // qui s'enchaînent en 3,5 s, c'est un enchaînement ; en 500 ms, un bug.
      if (e.gcd > 0) e.gcd = Math.max(0, e.gcd - dt);
      if (e._undyingCd > 0) e._undyingCd -= dt;
      if (e.lunge > 0) e.lunge = Math.max(0, e.lunge - dt);
      if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
      if (e._freeT > 0) e._freeT -= dt;
      if (e.retarget > 0) e.retarget -= dt;
      if (e.statuses) tickStatuses(e, dt);        // LES DEUX CAMPS, sans condition
      // LA RÉGÉNÉRATION D'AURA — par paliers d'une seconde, jamais par image :
      // un « +2 » qui clignote soixante fois par seconde masque la salle.
      // POINT D'ACCROCHE D : la régénération d'AURA et celle des PROCS passent
      // par le même palier — deux compteurs pour la même chose divergeraient.
      let regenT = e.regen || 0;
      if (e.procs) for (const pr of (e.procs.regen || [])) regenT += (pr.pct || 0);
      if (regenT > 0 && !e.dead) {
        e._regenT = (e._regenT || 0) + dt;
        if (e._regenT >= 1) { const n = e.hpMax * regenT * e._regenT; e._regenT = 0; soigne(e, n, null); }
      }
      e.moving = false;
      const tgt = e.target ? foesList.find(f => f.id === e.target && !f.dead) : null;
      let moveTo = null;
      if (tgt) {
        const d = dist(e, tgt);
        const isRanged = rangeOf(e) > 0;
        const reach = isRanged ? rangeOf(e) : CELL * 0.75 * (tgt.scale || 1) + CELL * 0.2;
        // les tireurs ont besoin de la ligne de vue
        const los = isRanged ? hasLOS(e, tgt) : true;
        if (d > reach || !los) {
          if (isRanged && d <= reach && !los) {
            // à portée mais pas de vue : on se repositionne
            const spot = spotWithLOS(e, tgt);
            if (spot) e.dest = spot;
            moveTo = e.dest || tgt;
          } else {
            moveTo = tgt;
          }
        }
        else {
          e.atkT -= dt;
          if (e.atkT <= 0) {
            e.atkT = 1 / aspdOf(e);
            e.angle = Math.atan2(tgt.y - e.y, tgt.x - e.x);
            e.lunge = 0.18;
            if (rangeOf(e) > 0 && arena.shots) {
              const oy = -CELL * 0.35;
              arena.shots.push({ x0: e.x, y0: e.y + oy, x: e.x, y: e.y + oy, tx: tgt.x, ty: tgt.y + oy, t: 0,
                dur: Math.max(0.1, dist(e, tgt) / (CELL * 16)), side: e.side, magic: (e.cls === 'mage' || e.cls === 'soigneur' || e.cls === 'artificier') });
            }
            const dmg = dmgOf(e);
            if (e.side === 'party') {
              // ---- POINT D'ACCROCHE A : la compagnie porte un coup ----
              const coup = procsCoup(e, tgt, dmg);
              const pen = (e.st.armorPen || 0) + coup.pen;
              const avant = tgt.hp;
              hurtFoe(tgt, coup.dmg, pen);
              let pratiques = Math.max(0, avant - tgt.hp);
              // `double` : le coup part DEUX fois — et jamais sur un cadavre.
              if (coup.encore && !tgt.dead) {
                const avant2 = tgt.hp;
                hurtFoe(tgt, coup.dmg, pen);
                pratiques += Math.max(0, avant2 - tgt.hp);
              }
              if (pratiques > 0 && window.GameState && GameState.enregistrerPratiqueArme)
                GameState.enregistrerPratiqueArme(e.id, pratiques);
              // le VOL DE VIE passe par l'entonnoir comme tous les soins
              if (e.st.lifesteal && !e.dead) soigne(e, coup.dmg * e.st.lifesteal, e);
            }
            // le 4e argument dit QUI frappe : c'est lui qui rend possibles la
            // riposte, les épines et l'usure.
            else hurtHero(tgt, dmg, e.elem, e);
          }
        }
      } else if (e.dest) {
        if (Math.hypot(e.dest.x - e.x, e.dest.y - e.y) < CELL * 0.2) e.dest = null;
        else moveTo = e.dest;
      }
      if (moveTo) {
        const a = steerAround(e, moveTo.x, moveTo.y);   // on CONTOURNE le décor
        const sp = spdOf(e);                            // `slowOf` est DANS spdOf, les deux camps
        e.x = clamp(e.x + Math.cos(a) * sp * dt, MARGIN() * 0.6, W - MARGIN() * 0.6);
        e.y = clamp(e.y + Math.sin(a) * sp * dt, MARGIN() * 0.6, H - MARGIN() * 0.6);
        collideObstacles(e);   // ne traverse pas les obstacles
        separateFrom(e);       // ni ses camarades
        e.angle = a;
        e.phase = (e.phase || 0) + dt * (3.5 + sp * 0.16);
        e.moving = true;
        trackStuck(e, dt, moveTo, sp);
      } else {
        e.phase = (e.phase || 0) + dt * 1.2;
        separateFrom(e);       // même à l'arrêt, chacun sa place
        e._stuckT = 0; e._px = e.x; e._py = e.y;
      }
    }
    function stepFx(dt) {
      if (!arena) return;
      const sh = arena.shots || [];
      for (let i = sh.length - 1; i >= 0; i--) {
        const o = sh[i]; o.t += dt;
        const k = clamp(o.t / o.dur, 0, 1);
        o.x = o.x0 + (o.tx - o.x0) * k;
        o.y = o.y0 + (o.ty - o.y0) * k - Math.sin(k * Math.PI) * CELL * 0.4;
        if (k >= 1) sh.splice(i, 1);
      }
      for (const e of arena.party) if (e.dead && e.deadT > 0) e.deadT = Math.max(0, e.deadT - dt);
      for (const e of arena.foes) if (e.dead && e.deadT > 0) e.deadT = Math.max(0, e.deadT - dt);
      // éclats d'impact
      const bu = arena.bursts || [];
      for (let i = bu.length - 1; i >= 0; i--) {
        const b = bu[i];
        b.t += dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += CELL * 6 * dt;  // gravité
        if (b.t > b.life) bu.splice(i, 1);
      }
    }

    A.tick = function (dt) {
      if (!arena) return;
      let left = Math.min(3, Math.max(0, dt || 0));
      let guard = 0;
      while (left > 0 && arena && guard++ < 40) {
        const step = Math.min(0.1, left);
        left -= step;
        stepArena(step);
      }
      // update particles
      updateParticles(dt);
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    };
    function stepArena(dt) {
      if (!arena) return;
      arena.t += dt;
      if (arena.camp) {
        for (const p of arena.party) {
          if (p.dead) continue;
          if (!p.dest || Math.hypot(p.dest.x - p.x, p.dest.y - p.y) < CELL * 0.25)
            p.dest = { x: clamp(p.x + rnd(-CELL * 2.5, CELL * 2.5), MARGIN(), W - MARGIN()), y: clamp(p.y + rnd(-CELL * 1.5, CELL * 1.5), MARGIN(), H - MARGIN()) };
          stepUnit(p, dt * 0.45, arena.foes);
        }
        for (let i = arena.floats.length - 1; i >= 0; i--) { arena.floats[i].t += dt; if (arena.floats[i].t > 1.1) arena.floats.splice(i, 1); }
        stepFx(dt);
        return;
      }
      if (arena.calm && arena.phase === 'fight') {
        if (arena.t > 2) { arena.phase = 'cleared'; if (onEnd) { try { onEnd('won', A.result()); } catch (e) { } } }
        return;
      }
      plafonnerZonesAlliees();
      for (let i = arena.zones.length - 1; i >= 0; i--) {
        const z = arena.zones[i]; z.t += dt;
        // LA ZONE QUI DURE. Elle n'éclate pas : elle prélève à chaque `tick`,
        // et son total sur toute sa durée vaut la charge utile annoncée.
        if (z.kind === 'field') {
          const cadence = z.tick || 0.5;
          z.next = (z.next || 0) - dt;
          if (z.next <= 0) {
            z.next = cadence;
            const dedans = z.allie ? arena.party : arena.foes;
            // LE TOTAL SUR TOUTE LA DURÉE vaut la charge utile annoncée : la
            // zone prélève une FRACTION à chaque tic, elle ne la répète pas.
            const frac = cadence / Math.max(0.1, z.dur);
            const part = (z.base || 0) * frac;
            for (const u of dedans) {
              if (u.dead || u.protege) continue;
              if (!inZone(u, z, 0)) continue;
              const dose = z.allie ? u.hpMax * ((z.ab && z.ab.pct) || 0) * frac : part;
              const r = chargeUtile(u, z.ab, dose, z.owner, z);
              if (z.faits) { z.faits.dmg += r.d; z.faits.heal += r.h; }
            }
          }
          if (z.t >= z.dur) arena.zones.splice(i, 1);
          continue;
        }
        // LA TRAQUE : tant que l'annonce n'a pas éclaté, elle SUIT sa cible —
        // en retard, pour qu'on puisse la semer en bougeant. Une poursuite
        // parfaite serait inesquivable, donc injuste.
        if (z.chase && z.kind === 'tell' && z.t < z.dur * 0.7) {
          const cible = arena.party.find(pp => pp.id === z.chase && !pp.dead);
          if (cible) {
            z.x += (cible.x - z.x) * Math.min(1, dt * 2.2);
            z.y += (cible.y - z.y) * Math.min(1, dt * 2.2);
          }
        }
        if (z.kind === 'tell' && z.t >= z.dur) { zoneHits(z); z.kind = 'boom'; z.t = 0; z.dur = 0.25; }
        else if (z.kind !== 'tell' && z.t >= z.dur) arena.zones.splice(i, 1);
      }
      // aléa d'étage (météores / flèches) toutes les ~12s
      if (arena.phase === 'fight' && arena.hazardKind) {
        arena.hazardT += dt;
        if (arena.hazardT > 12) {
          arena.hazardT = 0;
          spawnHazard();
        }
      }
      // LE BUDGET DE TIR DE LA COMPAGNIE, en SECONDES et non en images : deux
      // lâchers par seconde. `A.tick` fait un sous-pas par image en régime
      // normal, mais jusqu'à trente sur l'image de rattrapage au retour d'un
      // onglet en arrière-plan — un budget « une fois par image » y autoriserait
      // trente tirs d'un coup.
      arena.castJetons = (arena.castJetons || 0) + dt * 2;
      if (arena.castJetons > 2) arena.castJetons = 2;
      // le contexte de salle, calculé UNE fois pour les cinq personnages
      arena._ctx = arena.auto ? contexteIA() : null;
      for (const p of arena.party) {
        if (p.dead) continue;
        /* LE TEMPS D UNE INVOCATION. Il court meme hors combat : ce qui
           est appele pour une salle ne doit pas suivre jusqu a la
           suivante. Elle s efface sans laisser de cadavre a ramasser. */
        if (p._invoque) {
          p.vieT -= dt;
          if (p.vieT <= 0) { p.dead = true; p.deadT = 0; burst(p.x, p.y, p.tint, 6); continue; }
        }
        if (arena.auto) autoPlay(p);
        else if (arena.phase === 'fight' && !p.target && !p.dest) {
          // auto-attack when enemy in range (manual mode)
          const near = nearest(p, arena.foes);
          if (near && dist(p, near) < (rangeOf(p) > 0 ? rangeOf(p) : CELL * 1.2)) p.target = near.id;
        } else if (arena.phase !== 'fight') { p.target = null; }
        stepUnit(p, dt, arena.foes);
      }
      if (arena.phase === 'fight') {
        for (const f of arena.foes) {
          if (f.dead) continue;
          // UN PORTAIL NE PENSE PAS, NE MARCHE PAS : IL PONDE. Toutes les ~7 s,
          // plafonné à huit ennemis vivants — sinon une salle négligée devient
          // une marée injouable au lieu d'une punition lisible.
          if (f.portal) {
            f.spawnT -= dt;
            const vivants = arena.foes.filter(x => !x.dead && !x.portal).length;
            if (f.spawnT <= 0 && vivants < 8) {
              f.spawnT = 7 - Math.min(2.5, arena.floor * 0.06);
              const cfg = AD().advFoes(arena.biome.id);
              // le portail pond dans TOUT le vivier du biome — faune ET
              // garnison, la garnison prenant le pas avec la profondeur
              const type = pickFoeType(cfg, arena.floor);
              if (type) {
                const nf = mkFoe(type, arena.foes.length, 1, arena.diff, null);
                nf.x = f.x + (Math.random() - 0.5) * CELL;
                nf.y = f.y + CELL * 0.8;
                arena.foes.push(nf);
                arena.zones.push({ kind: 'fx', shape: 'circle', x: f.x, y: f.y, r: CELL * 1.1, t: 0, dur: 0.4, col: '#b88ae8' });
                sfx('pop');
              }
            }
            continue;
          }
          foeThink(f, dt);
          stepUnit(f, dt, arena.party);
        }
      }
      for (let i = arena.floats.length - 1; i >= 0; i--) { arena.floats[i].t += dt; if (arena.floats[i].t > 1.1) arena.floats.splice(i, 1); }
      stepFx(dt);
      if (arena.phase === 'fight') {
        // ---- LES OBJECTIFS, avant la règle générale ----
        const obj = arena.objectif;
        if (obj) {
          // LA CAISSE TOMBE : c'est perdu, quoi qu'il reste d'ennemis. On le
          // dit franchement — l'escorte n'a qu'une règle et c'est celle-là.
          if (obj.kind === 'escorte') {
            const prot = arena.party.find(p => p.protege);
            if (prot && prot.dead) {
              arena.phase = 'lost';
              sfx('error');
              arena.floats.push({ x: cx(), y: cyc(), txt: ' Le convoi est perdu…', t: 0, col: '#ff9a8a' });
              if (onEnd) { try { onEnd('lost', A.result()); } catch (e) { } }
              if (!arena) return;
            }
          }
          // LE TEMPS À TENIR (survie et cristal) : quand il expire, on décroche
          // par l'escalier — même si la salle grouille encore. C'est le point :
          // on ne nettoie pas, on SURVIT.
          if (obj.tLeft != null) {
            obj.tLeft -= dt;
            if (obj.tLeft <= 0) {
              arena.phase = 'cleared';
              arena.clearT = 0;
              sfx('fanfare');
              arena.floats.push({ x: cx(), y: cyc(), txt: '⏳ Tenu ! On décroche.', t: 0, col: '#ffe9a8' });
            } else {
              // les vagues NE S'ARRÊTENT PAS. La branche normale de vagues est
              // débranchée pour les salles à minuterie (elle mène à `cleared`) :
              // c'est donc ICI qu'on les fait défiler — les vagues PRÉVUES
              // d'abord, puis des renforts improvisés tant que le temps court.
              const foesVivants = arena.foes.some(f => !f.dead && !f.portal);
              if (!foesVivants) {
                obj.refillT = (obj.refillT || 0) + dt;
                if (obj.refillT > 1.4) {
                  obj.refillT = 0;
                  let comp = null, th = null;
                  const prevu = (arena.pendingWaves && arena.pendingWaves.length)
                    ? arena.pendingWaves.shift() : null;
                  if (prevu) {
                    comp = prevu.comp || prevu;            // vieux format toléré
                    th = AD().waveTheme ? AD().waveTheme(prevu.theme) : null;
                    if (prevu.theme) arena._lastTheme = prevu.theme;
                  } else {
                    // renfort improvisé : un THÈME différent du précédent, et
                    // un vivier qui mêle faune et garnison selon la profondeur
                    const cfg = AD().advFoes(arena.biome.id);
                    const ids = Object.keys(AD().WAVE_THEMES || {}).filter(t2 => t2 !== arena._lastTheme);
                    const thId = ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
                    th = AD().waveTheme ? AD().waveTheme(thId) : null;
                    if (thId) arena._lastTheme = thId;
                    const n = Math.max(1, Math.round((2 + Math.floor(Math.random() * 2)) * ((th && th.count) || 1)));
                    if (th) comp = buildComposition(cfg, n, arena.floor || 1, th);
                    else {
                      comp = [];
                      for (let k = 0; k < n; k++) { const t2 = pickFoeType(cfg, arena.floor); if (t2) comp.push(t2); }
                    }
                  }
                  for (let k = 0; k < comp.length; k++) {
                    const nf = mkFoe(comp[k], arena.foes.length, 1, arena.diff, null);
                    const pt = spawnPoint(k);
                    nf.x = pt.x; nf.y = pt.y;
                    applyWaveTheme(nf, th);
                    arena.foes.push(nf);
                  }
                  arena.waveNum++;
                  arena.floats.push({ x: cx(), y: cyc(), txt: ' Encore ' + Math.ceil(obj.tLeft) + ' s'
                    + (th ? ' — ' + th.name : ''), t: 0, col: '#ffe9a8' });
                  sfx('pop');
                }
              }
            }
          }
          // LE CRISTAL SE DÉPLACE, et sa lumière est la seule zone sûre. En
          // sortir coûte des PV en continu — assez pour obliger à suivre,
          // jamais assez pour tuer d'un coup d'inattention.
          if (obj.kind === 'cristal' && arena.cristal && arena.phase === 'fight') {
            const c = arena.cristal;
            c.t += dt;
            // une dérive lente en huit : jamais deux fois le même chemin des yeux
            c.x = cx() + Math.sin(c.t * 0.22) * (W * 0.3);
            c.y = H * 0.45 + Math.sin(c.t * 0.31 + 1.7) * (H * 0.22);
            for (const pm of arena.party) {
              if (pm.dead) continue;
              if (Math.hypot(pm.x - c.x, pm.y - c.y) > c.r) {
                pm.hp -= pm.hpMax * 0.045 * dt;
                pm.hitT = Math.max(pm.hitT || 0, 0.1);
                if (pm.hp <= 0 && !pm.dead) { pm.dead = true; pm.deadT = 0.55; }
              }
            }
          }
          if (!arena || arena.phase !== 'fight') { /* l'objectif a tranché */ }
        }
        // LA CHASSE : le sort du trophée se joue UNE fois — abattu avant
        // l'escalier (la prime est due, cf. A.result) ou envolé. La salle,
        // elle, reste une salle de combat ordinaire : on la nettoie.
        if (arena.room === 'chasse' && !arena.tropheeSort) {
          const tr = arena.foes.find(x => x.trophee);
          if (tr && tr.dead) {
            arena.tropheeSort = tr.echappe ? 'echappe' : 'abattu';
            if (arena.tropheeSort === 'abattu') {
              arena.floats.push({ x: tr.x, y: tr.y - CELL, txt: ' Trophée abattu !', t: 0, col: '#ffe9a8' });
              sfx('fanfare');
            }
          }
        }
        const foesLeft = arena.foes.some(f => !f.dead);
        // LA CAISSE NE COMPTE PAS comme survivante : des héros morts autour
        // d'un convoi intact, c'est une défaite, pas une attente.
        /* NI LA CAISSE NI UNE INVOCATION ne comptent comme survivantes :
           des heros morts autour d une hydre encore debout, c est une
           defaite, pas une attente. */
        const partyLeft = arena.party.some(p => !p.dead && !p.protege && !p._invoque);
        if (!partyLeft) {
          arena.phase = 'lost';
          sfx('error');
          if (onEnd) { try { onEnd('lost', A.result()); } catch (e) { } }
          if (!arena) return;
        } else if (!foesLeft && !(arena.objectif && arena.objectif.tLeft != null)) {
          // vague suivante ? (les salles à MINUTERIE ne se nettoient pas : leur
          // fin est le chronomètre, géré plus haut)
          if (arena.pendingWaves && arena.pendingWaves.length) {
            arena.waveT += dt;
            if (arena.waveT > 1.2) {  // petite pause entre les vagues
              arena.waveT = 0;
              arena.waveNum++;
              const vague = arena.pendingWaves.shift();
              const waveComp = vague.comp || vague;        // vieux format toléré
              const th = (AD().waveTheme && vague.theme) ? AD().waveTheme(vague.theme) : null;
              if (vague.theme) arena._lastTheme = vague.theme;
              for (let k = 0; k < waveComp.length; k++) {
                const nf = mkFoe(waveComp[k], arena.foes.length + k, waveComp.length, arena.diff, null);
                const pt = spawnPoint(k);
                nf.x = pt.x; nf.y = pt.y;
                applyWaveTheme(nf, th);
                arena.foes.push(nf);
              }
              // PAS de remise en formation : elle téléporterait les renforts
              // loin de leur point d'entrée — et le portail avec eux.
              // Le thème s'annonce : « Vague 2/3 — Tirailleurs », on sait qui entre.
              arena.floats.push({ x: cx(), y: cyc(), txt: ' Vague ' + arena.waveNum + ' / ' + arena.waveTotal
                + (th ? ' — ' + th.name : ''), t: 0, col: '#ffe9a8' });
              sfx('pop');
            }
          } else {
            arena.phase = 'cleared';
            arena.clearT = 0;
            sfx('fanfare');
          }
        }
      }
      // transition : escalier pour descendre à l'étage suivant
      if (arena.phase === 'cleared') {
        arena.clearT = (arena.clearT || 0) + dt;
        // l'escalier apparaît en bas au centre

        // la compagnie marche vers l'escalier
        for (const p of arena.party) {
          if (p.dead) continue;
          p.target = null;
          p.dest = { x: stairX() + rnd(-CELL * 0.8, CELL * 0.8), y: stairY() + CELL * (0.9 + Math.random() * 0.5) };
          stepUnit(p, dt, arena.foes);
        }
        // après 1.8s (ou tout le monde en bas), on finit
        const allDown = arena.party.filter(p => !p.dead).every(p => p.y < stairY() + CELL * 2);
        if (arena.clearT > 1.8 || (arena.clearT > 0.6 && allDown)) {
          if (onEnd) { try { onEnd('won', A.result()); } catch (e) { } }
        }
      }
    }
    A.result = function () {
      if (!arena) return null;
      return {
        won: arena.phase !== 'lost', boss: arena.isBoss,
        hurt: arena.party.filter(p => p.dead || p.hp < p.hpMax * 0.4).map(p => p.id).filter(id => id !== '__general'),
        dead: arena.party.filter(p => p.dead).map(p => p.id),
        foes: arena.foes.length,
        // LA CHASSE : le trophée abattu avant l'escalier vaut une prime —
        // state-general la lit dans floorCleared
        trophee: arena.tropheeSort === 'abattu',
      };
    };
    A.partyHp = function () {
      if (!arena) return null;
      const out = {};
      for (const p of arena.party) out[p.id] = Math.max(0, Math.round(p.hp));
      return out;
    };
    A.partyHurt = function () {
      if (!arena) return 0;
      let hp = 0, max = 0;
      for (const p of arena.party) { hp += Math.max(0, p.hp); max += p.hpMax; }
      return max > 0 ? 1 - hp / max : 0;
    };
    A.healParty = function (pct) {
      if (!arena) return;
      let releve = false;
      for (const p of arena.party) {
        // LA RÉSURRECTION RESTE EN PROPRE : `soigne` refuse un mort, c'est
        // voulu — on remet debout d'abord, on soigne ensuite.
        if (p.dead) {
          p.dead = false; p.deadT = 0;
          p.hp = p.hpMax * Math.max(0.25, pct * 0.6);
          releve = true;
          arena.floats.push({ x: p.x, y: p.y - 20, txt: '+' + Math.round(p.hp), t: 0, col: '#8ef0a8' });
        } else soigne(p, p.hpMax * pct, null);
      }
      // une aura perdue à la mort ne revient que par ce recalcul
      if (releve) recalcAuras();
    };

    // ------------------------------------------------------------
    // PARTICULES ATMOSPHÉRIQUES
    // ------------------------------------------------------------
    function initParticles() {
      particles = [];
      if (!arena) return;
      const D = decorOf(arena.biome.id);
      for (let i = 0; i < 35; i++) {
        particles.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-4, 4), vy: rnd(-8, -1),
          r: rnd(1, 3), a: rnd(0.1, 0.4), life: rnd(2, 6), t: rnd(0, 5), kind: D.particle });
      }
    }
    function updateParticles(dt) {
      for (const p of particles) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < -5 || p.y > H + 5 || p.x < -5 || p.x > W + 5 || p.t > p.life) {
          p.x = rnd(0, W); p.y = H + rnd(0, 10); p.t = 0;
          p.vy = rnd(-8, -1);
        }
      }
    }

    // ------------------------------------------------------------
    // RENDU
    // ------------------------------------------------------------
    function buildBg() {
      if (!arena) return;
      if (typeof document === 'undefined') return;   // headless
      bgCanvas = document.createElement('canvas');
      bgCanvas.width = W; bgCanvas.height = H;
      bgCtx = bgCanvas.getContext('2d');
      const g = bgCtx;
      const D = arena.decor ? arena.decor.cfg : decorOf(arena.biome.id);
      // floor
      const bg = g.createRadialGradient(W / 2, H * 0.42, CELL, W / 2, H / 2, W * 0.78);
      bg.addColorStop(0, shade(D.floor, 1.12));
      bg.addColorStop(1, shade(D.floor, 0.82));
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      for (let gy = 0; gy < GRID_H; gy++) for (let gx = (gy % 2); gx < GRID_W; gx += 2) g.fillRect(gx * CELL, gy * CELL, CELL, CELL);
      g.strokeStyle = D.joint; g.lineWidth = 1;
      for (let i = 1; i < GRID_W; i++) { g.beginPath(); g.moveTo(i * CELL + 0.5, 0); g.lineTo(i * CELL + 0.5, H); g.stroke(); }
      for (let i = 1; i < GRID_H; i++) { g.beginPath(); g.moveTo(0, i * CELL + 0.5); g.lineTo(W, i * CELL + 0.5); g.stroke(); }
      const dec = arena.decor;
      if (dec) {
        for (const sp of dec.specks) { g.fillStyle = 'rgba(60,44,26,' + sp.a + ')'; g.beginPath(); g.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = 'rgba(50,38,24,0.13)';
        for (const c of dec.cracks) { g.lineWidth = c.w; g.beginPath(); g.moveTo(c.x, c.y); g.lineTo((c.x + c.x2) / 2 + 4, (c.y + c.y2) / 2 - 3); g.lineTo(c.x2, c.y2); g.stroke(); }
      }
      // walls
      const t = Math.max(8, Math.round(CELL * 0.42));
      const band = (x, y, w, h, horiz) => {
        const gd = horiz ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0);
        gd.addColorStop(0, shade(D.wall, 1.18)); gd.addColorStop(1, shade(D.wall, 0.78));
        g.fillStyle = gd; g.fillRect(x, y, w, h);
      };
      band(0, 0, W, t, true); band(0, H - t, W, t, true);
      band(0, 0, t, H, false); band(W - t, 0, t, H, false);
      g.strokeStyle = 'rgba(30,22,14,0.26)'; g.lineWidth = 1;
      const stone = CELL * 0.72;
      for (let x = 0; x < W; x += stone) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, t); g.stroke(); g.beginPath(); g.moveTo(x + stone / 2, H - t); g.lineTo(x + stone / 2, H); g.stroke(); }
      for (let y = 0; y < H; y += stone) { g.beginPath(); g.moveTo(0, y); g.lineTo(t, y); g.stroke(); g.beginPath(); g.moveTo(W - t, y + stone / 2); g.lineTo(W, y + stone / 2); g.stroke(); }
      g.fillStyle = shade(D.wallLip, 1.0);
      g.fillRect(0, 0, W, 3); g.fillRect(0, 0, 3, H); g.fillRect(W - 3, 0, 3, H); g.fillRect(0, H - 3, W, 3);
      // vignette
      const vig = g.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.72);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.25)');
      g.fillStyle = vig; g.fillRect(0, 0, W, H);
    }
    function rescaleArena(k) {
      if (!arena || !isFinite(k) || k === 1) return;
      const pt = o => { if (!o) return; o.x *= k; o.y *= k; };
      for (const e of arena.party.concat(arena.foes)) { pt(e); pt(e.dest); }
      for (const z of arena.zones) { pt(z); if (z.r) z.r *= k; if (z.inner) z.inner *= k; if (z.w) z.w *= k; if (z.x2 != null) { z.x2 *= k; z.y2 *= k; } }
      for (const o of (arena.shots || [])) { pt(o); o.x0 *= k; o.y0 *= k; o.tx *= k; o.ty *= k; }
      if (arena.obstacles) for (const o of arena.obstacles.list) { pt(o); o.r *= k; }
      if (arena.barrels) for (const b of arena.barrels) { pt(b); b.r *= k; }
      const dec = arena.decor;
      if (dec) { for (const d of dec.list) { pt(d); d.size = Math.round(d.size * k); }
        for (const q of (dec.solides || [])) { pt(q); q.r *= k; } for (const q of dec.paint) { pt(q); if (q.r) q.r *= k; } for (const sp of dec.specks) pt(sp); for (const c of dec.cracks) { pt(c); c.x2 *= k; c.y2 *= k; } }
      bgCanvas = null;
    }
    A.attach = function (cv) {
      canvas = cv || null;
      ctx = canvas ? canvas.getContext('2d') : null;
      if (!canvas) return;
      const box = canvas.parentNode ? (canvas.parentNode.clientWidth || 640) : 640;
      const prev = CELL;
      // taille confortable par défaut (celle qu'on avait en réduisant la fenêtre)
      CELL = clamp(Math.floor((box - 4) / GRID_W), 32, 42);
      W = CELL * GRID_W; H = CELL * GRID_H;
      if (arena && prev !== CELL) rescaleArena(CELL / prev);
      canvas.width = W; canvas.height = H;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      bgCanvas = null;
    };
    A.detach = function () { canvas = null; ctx = null; };
    A.size = () => ({ w: W, h: H, cell: CELL, grid: GRID_H, gridW: GRID_W });

    function drawProp(g, d, T) {
      if (d.kind === 'column') {
        const w = d.r * 0.9, h = CELL * 2.2;
        g.save(); g.translate(d.x, d.y);
        g.fillStyle = 'rgba(50,40,26,0.22)'; g.beginPath(); g.ellipse(0, 0, w * 0.9, w * 0.4, 0, 0, Math.PI * 2); g.fill();
        const gd = g.createLinearGradient(-w, 0, w, 0);
        gd.addColorStop(0, '#8f8878'); gd.addColorStop(0.45, '#cfc7b4'); gd.addColorStop(1, '#7d7565');
        g.fillStyle = gd; g.fillRect(-w * 0.55, -h, w * 1.1, h);
        g.restore();
        return;
      }
      // le mobilier du donjon : on dessine, on n'emprunte plus au village
      const fn = DUNGEON_PROPS[d.kind];
      if (fn) {
        g.save();
        g.translate(d.x, d.y);
        try { fn(g, d.size, T, (d.seed % 1000) / 1000, d.glow); } catch (e) { }
        g.restore();
        return;
      }
      let spr = null;
      try { spr = d.obst && Sprites.getObstacleRef ? Sprites.getObstacleRef(d.kind, d.size, d.seed) : null; } catch (e) { spr = null; }
      if (spr) g.drawImage(spr, d.x - d.size / 2, d.y - d.size * 0.73, d.size, d.size);
    }
    // obstacle solide (flat design) : pilier, rocher, caisse
    function drawObstacle(g, o) {
      g.save();
      g.translate(o.x, o.y);
      // ombre douce
      g.fillStyle = 'rgba(40,32,20,0.2)';
      g.beginPath(); g.ellipse(0, o.r * 0.3, o.r * 1.1, o.r * 0.4, 0, 0, Math.PI * 2); g.fill();
      if (o.kind === 'column') {
        // PILIER en pseudo-3D (vue légèrement du dessus, façon Diablo/Baldur's)
        const w = o.r * 1.15, h = CELL * 2.6;
        // ombre portée au sol (décalée vers la droite)
        g.fillStyle = 'rgba(30,26,18,0.25)';
        g.beginPath(); g.ellipse(w * 0.3, 2, w * 1.1, w * 0.42, 0, 0, Math.PI * 2); g.fill();
        // base (socle) — ellipse
        g.fillStyle = '#6e6455';
        g.beginPath(); g.ellipse(0, 0, w * 0.85, w * 0.34, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#847a68';
        g.beginPath(); g.ellipse(0, -w * 0.12, w * 0.78, w * 0.3, 0, 0, Math.PI * 2); g.fill();
        // fût cylindrique : dégradé horizontal pour le volume
        const cg = g.createLinearGradient(-w * 0.6, 0, w * 0.6, 0);
        cg.addColorStop(0, '#5f5648');
        cg.addColorStop(0.3, '#a89c88');
        cg.addColorStop(0.5, '#c4b8a2');
        cg.addColorStop(0.75, '#8a7f6c');
        cg.addColorStop(1, '#574e40');
        g.fillStyle = cg;
        g.beginPath();
        g.moveTo(-w * 0.55, -w * 0.12);
        g.lineTo(-w * 0.5, -h);
        g.lineTo(w * 0.5, -h);
        g.lineTo(w * 0.55, -w * 0.12);
        g.closePath(); g.fill();
        // cannelures (stries verticales)
        g.strokeStyle = 'rgba(70,60,46,0.28)'; g.lineWidth = 1;
        for (let i = -2; i <= 2; i++) {
          const fx = i * w * 0.18;
          g.beginPath(); g.moveTo(fx * 1.05, -w * 0.15); g.lineTo(fx, -h); g.stroke();
        }
        // chapiteau (somme) — ellipse + bandeau
        g.fillStyle = '#8a7f6c';
        g.beginPath(); g.ellipse(0, -h, w * 0.62, w * 0.24, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#a89c88';
        g.fillRect(-w * 0.72, -h - w * 0.34, w * 1.44, w * 0.2);
        g.fillStyle = '#c4b8a2';
        g.beginPath(); g.ellipse(0, -h - w * 0.34, w * 0.72, w * 0.2, 0, 0, Math.PI * 2); g.fill();
        // fissure discrète
        g.strokeStyle = 'rgba(60,50,38,0.3)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-w * 0.15, -h * 0.75); g.lineTo(w * 0.05, -h * 0.5); g.lineTo(-w * 0.1, -h * 0.28); g.stroke();
        g.restore();
        return;
      } else if (o.kind === 'crate') {
        // CAISSE : trois planches, une écharpe en diagonale, des coins ferrés
        // et le dessus vu de trois quarts. (Avant : un carré et deux traits.)
        const w = o.r * 1.55, h = o.r * 1.3, top = o.r * 0.34;
        g.fillStyle = '#9c7440';                    // face avant
        g.beginPath();
        (g.roundRect ? g.roundRect(-w / 2, -h, w, h, o.r * 0.06) : g.rect(-w / 2, -h, w, h));
        g.fill();
        g.strokeStyle = 'rgba(70,48,24,0.5)';       // le joint des planches
        g.lineWidth = Math.max(0.8, o.r * 0.05);
        for (const k of [0.33, 0.66]) {
          g.beginPath(); g.moveTo(-w / 2 + w * k, -h); g.lineTo(-w / 2 + w * k, 0); g.stroke();
        }
        g.strokeStyle = 'rgba(120,90,48,0.85)';     // l'écharpe
        g.lineWidth = Math.max(1.2, o.r * 0.12);
        g.beginPath(); g.moveTo(-w / 2 + o.r * 0.1, -o.r * 0.12);
        g.lineTo(w / 2 - o.r * 0.1, -h + o.r * 0.12); g.stroke();
        g.fillStyle = '#b98d52';                    // le dessus, en perspective
        g.beginPath();
        g.moveTo(-w / 2, -h); g.lineTo(-w / 2 + top * 0.6, -h - top);
        g.lineTo(w / 2 + top * 0.6, -h - top); g.lineTo(w / 2, -h);
        g.closePath(); g.fill();
        g.fillStyle = '#5c4526';                    // coins ferrés
        for (const dx of [-1, 1]) {
          g.fillRect(dx * w / 2 - (dx > 0 ? o.r * 0.13 : 0), -h, o.r * 0.13, o.r * 0.18);
          g.fillRect(dx * w / 2 - (dx > 0 ? o.r * 0.13 : 0), -o.r * 0.18, o.r * 0.13, o.r * 0.18);
        }
        g.strokeStyle = INK; g.lineWidth = Math.max(0.9, o.r * 0.055);
        g.beginPath();
        (g.roundRect ? g.roundRect(-w / 2, -h, w, h, o.r * 0.06) : g.rect(-w / 2, -h, w, h));
        g.stroke();
      } else {
        // rocher
        const r = o.r;
        const gd = g.createRadialGradient(-r * 0.3, -r * 0.5, r * 0.2, 0, -r * 0.3, r * 1.2);
        gd.addColorStop(0, '#9a9488'); gd.addColorStop(1, '#5a5448');
        g.fillStyle = gd;
        g.beginPath();
        g.moveTo(-r, 0);
        g.lineTo(-r * 0.7, -r * 0.9);
        g.lineTo(r * 0.2, -r * 1.1);
        g.lineTo(r, -r * 0.5);
        g.lineTo(r * 0.8, 0);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(40,36,28,0.3)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-r * 0.3, -r * 0.9); g.lineTo(0, -r * 0.4); g.stroke();
      }
      g.restore();
    }
    // TONNEAU EXPLOSIF : un vrai fût — douves galbées, trois cerclages, le
    // dessus en ellipse, la lueur de l'élément qui suinte entre les planches et
    // une mèche qui grésille. (Avant : un rectangle arrondi et un emoji collé.)
    function drawBarrel(g, b, T) {
      const E = AD().ELEMENTS[b.elem];
      const r = b.r * 0.92;
      const h = r * 2.05, w = r * 1.5;
      g.save();
      g.translate(b.x, b.y);
      g.fillStyle = 'rgba(40,32,20,0.22)';
      g.beginPath(); g.ellipse(0, 0, w * 0.62, r * 0.24, 0, 0, Math.PI * 2); g.fill();
      // le fût, galbé au milieu
      const bg = g.createLinearGradient(-w * 0.6, 0, w * 0.6, 0);
      bg.addColorStop(0, '#6a4e2e'); bg.addColorStop(0.4, '#b08a58');
      bg.addColorStop(0.62, '#9c7748'); bg.addColorStop(1, '#5d4325');
      g.fillStyle = bg;
      g.beginPath();
      g.moveTo(-w * 0.42, -h * 0.06);
      g.quadraticCurveTo(-w * 0.6, -h * 0.5, -w * 0.42, -h * 0.94);
      g.lineTo(w * 0.42, -h * 0.94);
      g.quadraticCurveTo(w * 0.6, -h * 0.5, w * 0.42, -h * 0.06);
      g.closePath(); g.fill();
      // les douves
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = Math.max(0.7, r * 0.045);
      for (const k of [-0.5, 0, 0.5]) {
        g.beginPath();
        g.moveTo(k * w * 0.42, -h * 0.08);
        g.quadraticCurveTo(k * w * 0.58, -h * 0.5, k * w * 0.42, -h * 0.92);
        g.stroke();
      }
      // la lueur de l'élément, qui suinte entre les planches
      const glow = 0.45 + 0.3 * Math.sin(T * 3 + b.x);
      g.globalAlpha = glow * 0.85;
      g.strokeStyle = E.col; g.lineWidth = Math.max(1, r * 0.07);
      for (const k of [-0.25, 0.25]) {
        g.beginPath();
        g.moveTo(k * w * 0.5, -h * 0.28);
        g.quadraticCurveTo(k * w * 0.6, -h * 0.5, k * w * 0.5, -h * 0.72);
        g.stroke();
      }
      g.globalAlpha = 1;
      // trois cerclages de fer
      g.strokeStyle = '#4a3a24'; g.lineWidth = Math.max(1.2, r * 0.11);
      for (const ky of [0.16, 0.5, 0.86]) {
        const bulge = 1 - Math.abs(ky - 0.5) * 0.5;
        g.beginPath();
        g.moveTo(-w * 0.45 * bulge - w * 0.03, -h * ky);
        g.lineTo(w * 0.45 * bulge + w * 0.03, -h * ky);
        g.stroke();
      }
      // le dessus
      g.fillStyle = '#8a6a42';
      g.beginPath(); g.ellipse(0, -h * 0.94, w * 0.42, r * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = Math.max(0.8, r * 0.05); g.stroke();
      // le cœur élémentaire qui pulse par la bonde
      g.fillStyle = E.col; g.globalAlpha = glow;
      g.beginPath(); g.ellipse(0, -h * 0.94, w * 0.16, r * 0.08, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      // la mèche, et son étincelle
      g.strokeStyle = '#6b5a3a'; g.lineWidth = Math.max(1, r * 0.06); g.lineCap = 'round';
      g.beginPath();
      g.moveTo(w * 0.1, -h * 0.96);
      g.quadraticCurveTo(w * 0.34, -h * 1.12, w * 0.26, -h * 1.24);
      g.stroke();
      g.lineCap = 'butt';
      const spark = 0.5 + 0.5 * Math.sin(T * 11 + b.x);
      g.globalAlpha = spark;
      g.fillStyle = '#ffd77a';
      g.beginPath(); g.arc(w * 0.26, -h * 1.26, r * 0.11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff3c8';
      g.beginPath(); g.arc(w * 0.26, -h * 1.26, r * 0.05, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.restore();
    }
    // LE PORTAIL : une arche de pierre levée, un voile qui tourne, une lueur
    // qui s'intensifie à l'approche de la ponte. Il doit se lire comme une
    // STRUCTURE — pas comme un ennemi de plus — et dire sans texte qu'il
    // fabrique du danger.
    // LE CONVOI : une caisse cerclée, qui tremble quand on la frappe. Elle ne
    // se défend pas — son dessin doit dire « fragile et précieux », pas
    // « combattant de plus ».
    function drawProtege(g, e, T) {
      g.save();
      g.translate(e.x, e.y);
      if (e.hitT > 0) g.translate((Math.random() - 0.5) * 3, 0);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(0, CELL * 0.34, CELL * 0.5, CELL * 0.16, 0, 0, Math.PI * 2); g.fill();
      // la caisse
      g.fillStyle = e.hitT > 0 ? '#e8cf9a' : '#a8845a';
      g.fillRect(-CELL * 0.42, -CELL * 0.5, CELL * 0.84, CELL * 0.78);
      g.fillStyle = '#8a6a44';
      g.fillRect(-CELL * 0.42, -CELL * 0.18, CELL * 0.84, CELL * 0.1);
      g.fillRect(-CELL * 0.08, -CELL * 0.5, CELL * 0.16, CELL * 0.78);
      // le cerclage
      g.strokeStyle = '#5a4630'; g.lineWidth = 2;
      g.strokeRect(-CELL * 0.42, -CELL * 0.5, CELL * 0.84, CELL * 0.78);
      // les PV — la seule chose qu'on surveille sur cette caisse
      const k = e.hp / Math.max(1, e.hpMax);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(-CELL * 0.5, -CELL * 0.72, CELL, 4);
      g.fillStyle = k > 0.4 ? '#7ec97e' : '#e06a5a';
      g.fillRect(-CELL * 0.5, -CELL * 0.72, CELL * k, 4);
      g.restore();
    }

    function drawPortal(g, e, T) {
      g.save();
      g.translate(e.x, e.y);
      const k = e.hp / Math.max(1, e.hpMax);
      const urg = e.spawnT != null ? Math.max(0, 1 - e.spawnT / 4) : 0;
      // l'ombre
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.ellipse(0, CELL * 0.42, CELL * 0.62, CELL * 0.2, 0, 0, Math.PI * 2); g.fill();
      // les deux montants et le linteau, en pierre sombre
      g.fillStyle = e.hitT > 0 ? '#b9a6d8' : '#4a3d5e';
      g.fillRect(-CELL * 0.55, -CELL * 0.85, CELL * 0.22, CELL * 1.25);
      g.fillRect(CELL * 0.33, -CELL * 0.85, CELL * 0.22, CELL * 1.25);
      g.fillRect(-CELL * 0.62, -CELL * 1.0, CELL * 1.24, CELL * 0.24);
      // le voile : des arcs qui tournent, plus vifs quand la ponte approche
      for (let i = 0; i < 3; i++) {
        const a0 = T * (1.4 + i * 0.5) + i * 2.1;
        g.strokeStyle = 'rgba(184,138,232,' + (0.35 + urg * 0.45) + ')';
        g.lineWidth = 2.4 - i * 0.5;
        g.beginPath();
        g.arc(0, -CELL * 0.28, CELL * (0.34 - i * 0.07), a0, a0 + 3.6);
        g.stroke();
      }
      // le cœur, qui palpite
      g.fillStyle = 'rgba(200,160,255,' + (0.5 + 0.3 * Math.sin(T * 5 + e.phase)) + ')';
      g.beginPath(); g.arc(0, -CELL * 0.28, CELL * (0.12 + urg * 0.06), 0, Math.PI * 2); g.fill();
      // les points de vie : une barre courte — c'est une structure, on la SIÈGE
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(-CELL * 0.5, -CELL * 1.2, CELL, 4);
      g.fillStyle = k > 0.4 ? '#b88ae8' : '#e06a5a';
      g.fillRect(-CELL * 0.5, -CELL * 1.2, CELL * k, 4);
      g.restore();
    }

    function drawUnit(g, e, T) {
      const s = GameState.state;
      // TAILLE DES UNITÉS — tout ce qui suit s'écrit « CELL * x * sc », donc `sc`
      // ne doit PAS contenir lui-même un facteur de carreau : sinon la taille
      // devient QUADRATIQUE et l'unité enfle quatre fois plus vite que la salle
      // (carreau 32 → sprite ≈ 1,4 carreau ; carreau 66 → sprite ≈ 2,9 carreaux).
      // `sc` ne porte plus que le gabarit propre de l'unité (boss ×1,55, élite…)
      // multiplié par une RÉFÉRENCE FIXE — celle de la fenêtre étroite (carreau
      // 32 px), la taille validée en jeu. Une unité occupe donc la même fraction
      // de carreau à toute échelle : ≈1,4 carreau de large, fenêtre large ou non.
      const sc = (e.scale || 1) * UNIT_GAUGE;
      const dying = e.dead && e.deadT > 0;
      const dk = dying ? clamp(e.deadT / 0.55, 0, 1) : 1;
      const lg = e.lunge > 0 ? Math.sin((1 - e.lunge / 0.18) * Math.PI) : 0;
      const sq = 1 + lg * 0.12;
      g.save();
      g.translate(e.x + Math.cos(e.angle || 0) * lg * CELL * 0.16, e.y + Math.sin(e.angle || 0) * lg * CELL * 0.16);
      if (dying) {
        // âme qui monte : le corps s'efface, une lumière s'élève
        g.globalAlpha = dk * 0.6;
        const rise = (1 - dk) * CELL * 1.4;
        g.translate(0, -rise);
        // halo de l'âme
        const soulA = dk * 0.7;
        const sg = g.createRadialGradient(0, -CELL * 0.3 * sc, 2, 0, -CELL * 0.3 * sc, CELL * 0.7 * sc);
        sg.addColorStop(0, 'rgba(200,230,255,' + soulA + ')');
        sg.addColorStop(0.5, 'rgba(160,200,255,' + (soulA * 0.5) + ')');
        sg.addColorStop(1, 'rgba(120,160,220,0)');
        g.fillStyle = sg;
        g.beginPath(); g.arc(0, -CELL * 0.3 * sc, CELL * 0.7 * sc, 0, Math.PI * 2); g.fill();
      }
      // shadow
      g.fillStyle = 'rgba(60,45,25,0.24)';
      g.beginPath(); g.ellipse(0, CELL * 0.36 * sc, CELL * 0.36 * sc, CELL * 0.14 * sc, 0, 0, Math.PI * 2); g.fill();
      // selection ring (animated dashes)
      if (!dying && e.side === 'party' && arena.sel[e.id]) {
        const puls = 0.72 + 0.22 * Math.sin(T * 3.4);
        g.strokeStyle = 'rgba(240,192,74,' + puls + ')'; g.lineWidth = 2.2;
        g.setLineDash([6, 4]); g.lineDashOffset = -T * 20;
        g.beginPath(); g.ellipse(0, CELL * 0.34 * sc, CELL * 0.46 * sc, CELL * 0.19 * sc, 0, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
      }
      // hover highlight
      if (!dying && e === hoverUnit && !arena.sel[e.id]) {
        g.strokeStyle = 'rgba(200,220,255,0.5)'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(0, CELL * 0.34 * sc, CELL * 0.42 * sc, CELL * 0.17 * sc, 0, 0, Math.PI * 2); g.stroke();
      }
      // L'ARC DE RECHARGE AU SOL — la causalité, sans un mot.
      //
      // En mode automatique (le mode par DÉFAUT), le joueur regarde l'arène,
      // pas la colonne de portraits : la jauge d'un bouton qu'il ne fixe pas ne
      // lui apprend rien. L'arc se dessine sous les pieds du personnage, il se
      // remplit, il se vide — et à cet instant précis le personnage lance
      // quelque chose. On montre le pouvoir le PLUS LENT encore en recharge :
      // c'est le gros coup, celui qu'on attend. Rien quand tout est prêt : un
      // anneau permanent deviendrait du bruit.
      if (!dying && e.side === 'party' && !e.protege && e.pouvoirs && e.pouvoirs.length) {
        let lent = null;
        for (const sl of e.pouvoirs) {
          if (!sl || sl.cd <= 0 || !(sl.cdMax > 0)) continue;
          if (!lent || sl.cdMax > lent.cdMax) lent = sl;
        }
        if (lent) {
          const r = clamp(1 - lent.cd / lent.cdMax, 0, 1);
          const ry = CELL * 0.34 * sc;
          g.save();
          g.translate(0, ry);
          g.scale(1, 0.42);                       // l'ellipse du sol, vue de trois quarts
          g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3.4;
          g.beginPath(); g.arc(0, 0, CELL * 0.5 * sc, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = e.tint || '#ffe06b';
          g.lineWidth = 1.4 + r * 2.2;            // il ÉPAISSIT en se remplissant
          g.globalAlpha = 0.4 + r * 0.5;
          g.beginPath();
          g.arc(0, 0, CELL * 0.5 * sc, -Math.PI / 2, -Math.PI / 2 + r * Math.PI * 2);
          g.stroke();
          g.restore();
          g.globalAlpha = 1;
        }
      }
      // LES BÊTES ont leur propre silhouette (cf. DUNGEON_FOES)
      let drawn = false;
      if (e.animalId && DUNGEON_FOES[e.animalId]) {
        const face = Math.cos(e.angle || 0) < 0 ? -1 : 1;
        g.save();
        g.translate(0, CELL * 0.34 * sc);    // les pattes se posent sur l'ombre
        g.scale(face * sq, 2 - sq);          // miroir selon le sens de marche
        try { DUNGEON_FOES[e.animalId](g, CELL * 1.55 * sc, e.phase || 0, !!e.moving); } catch (err) { }
        if (e.hitT > 0) {                    // l'éclair du coup reçu
          g.globalAlpha = (e.hitT / 0.14) * 0.5;
          g.globalCompositeOperation = 'lighter';
          try { DUNGEON_FOES[e.animalId](g, CELL * 1.55 * sc, e.phase || 0, !!e.moving); } catch (err) { }
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 1;
        }
        g.restore();
        drawn = true;
      }
      if (!drawn) try {
        const dir = Sprites.dirForAngle ? Sprites.dirForAngle(e.angle || 0) : 0;
        const frames = Sprites.getUnitFrames && Sprites.getUnitFrames({ faction: e.side === 'party' ? s.faction : (s.faction === 'cats' ? 'birds' : 'cats'), type: e.type, evo: 0, weapon: s.weaponTier, armor: s.armorTier, dir, sync: true });
        if (frames && frames.length) {
          const fi = ((e.phase || 0) / (Math.PI * 2) * 16) | 0;
          const spr = frames[((fi % frames.length) + frames.length) % frames.length];
          const k = (CELL * 1.5 * sc) / 128;
          g.save(); g.scale(k * sq, k * (2 - sq)); g.drawImage(spr, -64, -74);
          if (e.hitT > 0) { g.globalAlpha = (e.hitT / 0.14) * 0.6; g.globalCompositeOperation = 'lighter'; g.drawImage(spr, -64, -74); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
          g.restore();
          drawn = true;
        }
      } catch (err) { }
      if (!drawn) {
        try {
          const icon = Sprites.getUnitIcon({ faction: e.side === 'party' ? s.faction : (s.faction === 'cats' ? 'birds' : 'cats'), type: e.type, evo: 0, weapon: s.weaponTier, armor: s.armorTier }, Math.round(CELL * sc));
          if (icon) g.drawImage(icon, -CELL * sc / 2, -CELL * sc * 0.7, CELL * sc, CELL * sc);
        } catch (err) { }
      }
      // HP bar (rounded)
      if (!dying) {
        const w = CELL * 0.9 * sc, pct = clamp(e.hp / e.hpMax, 0, 1);
        const bx = -w / 2, by = -CELL * 0.82 * sc;
        g.fillStyle = 'rgba(30,22,14,0.55)';
        g.beginPath(); (g.roundRect ? g.roundRect(bx, by, w, 5, 2) : g.rect(bx, by, w, 5)); g.fill();
        g.fillStyle = e.side === 'party' ? '#6fd08a' : (e.boss ? '#e05252' : '#d88a5a');
        g.beginPath(); (g.roundRect ? g.roundRect(bx, by, w * pct, 5, 2) : g.rect(bx, by, w * pct, 5)); g.fill();
        /* LE BOUCLIER, en surimpression de la barre de vie et non a cote :
           il se lit comme une avance sur les points de vie, ce qu'il est.
           Un liseré bleu par-dessus le vert, qui fond avant lui. */
        if (e.eshMax > 0 && e.esh > 0) {
          const pe = clamp(e.esh / e.eshMax, 0, 1);
          g.fillStyle = '#7ac8ff';
          g.beginPath(); (g.roundRect ? g.roundRect(bx, by - 3.5, w * pe, 3, 1.5)
                                      : g.rect(bx, by - 3.5, w * pe, 3)); g.fill();
        }
        if (e.boss) { g.fillStyle = '#7a2a2a'; g.font = '900 9px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText(' ' + e.name, 0, -CELL * 1.0 * sc); }
        // élite : anneau doré + nom de rang
        if (e.elite && !e.boss) {
          const puls = 0.6 + 0.25 * Math.sin(T * 3);
          g.strokeStyle = e.eliteCol || '#f4c542'; g.globalAlpha = puls; g.lineWidth = 2.5;
          g.beginPath(); g.ellipse(0, CELL * 0.34 * sc, CELL * 0.5 * sc, CELL * 0.21 * sc, 0, 0, Math.PI * 2); g.stroke();
          g.globalAlpha = 1;
          g.fillStyle = e.eliteCol || '#f4c542'; g.font = '900 8.5px Nunito, sans-serif'; g.textAlign = 'center';
          g.fillText(' ' + e.name, 0, -CELL * 1.0 * sc);
        }
        // ICÔNES DE STATUT — DES DEUX CÔTÉS. Elles n'étaient dessinées que sur
        // la compagnie : brûler un ennemi ne se voyait nulle part, donc, pour
        // le joueur, ça n'existait pas.
        if (e.statuses) {
          const icons = [];
          for (const k in e.statuses) {
            const ic = { burn: '', poison: '', chill: '', shock: '' }[k];
            if (ic) icons.push(ic);
          }
          if (icons.length) {
            g.font = '900 ' + Math.round(CELL * 0.3) + 'px Nunito, sans-serif';
            g.textAlign = 'center';
            g.fillText(icons.join(''), 0, -CELL * 1.05 * sc);
          }
        }
        // ÉTOURDI : un état qui ne se voit pas sur l'unité n'existe pas.
        if (e.stunT > 0) {
          g.font = '900 ' + Math.round(CELL * 0.42) + 'px Nunito, sans-serif';
          g.textAlign = 'center';
          g.fillText('', 0, -CELL * 1.32 * sc);
        }
      }
      g.globalAlpha = 1;
      g.restore();
    }
    function drawShot(g, o) {
      const a = Math.atan2(o.ty - o.y0, o.tx - o.x0);
      g.save(); g.translate(o.x, o.y); g.rotate(a);
      if (o.magic) {
        const r = CELL * 0.16;
        const gd = g.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
        gd.addColorStop(0, o.side === 'party' ? 'rgba(180,230,255,0.95)' : 'rgba(255,180,140,0.95)');
        gd.addColorStop(1, 'rgba(90,160,220,0)');
        g.fillStyle = gd; g.beginPath(); g.arc(0, 0, r * 2.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r * 0.6, 0, Math.PI * 2); g.fill();
      } else {
        const L = CELL * 0.42;
        g.strokeStyle = 'rgba(50,38,24,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-L, 0); g.lineTo(L * 0.5, 0); g.stroke();
        g.fillStyle = '#d8cfae'; g.beginPath(); g.moveTo(L, 0); g.lineTo(L * 0.35, -3); g.lineTo(L * 0.35, 3); g.closePath(); g.fill();
      }
      g.restore();
    }

    A.draw = function (T) {
      if (!arena || !ctx || !canvas || !canvas.isConnected) return;
      const g = ctx;
      T = typeof T === 'number' ? T : 0;
      g.save();
      // screen shake
      if (shakeT > 0) g.translate(rnd(-shakeMag, shakeMag), rnd(-shakeMag, shakeMag));

      // ---- MODE CAMP : surface + tour + compagnie ----
      if (arena.camp) {
        drawCampScene(g, T);
        // la compagnie se balade autour de la tour
        const layer = [];
        for (const e of arena.party) { if (!e.dead || e.deadT > 0) layer.push({ y: e.y, unit: e }); }
        layer.sort((a, b) => a.y - b.y);
        for (const it of layer) drawUnit(g, it.unit, T);
        for (const f of arena.floats) {
          const k = clamp(f.t / 1.1, 0, 1);
          g.globalAlpha = 1 - k; g.fillStyle = f.col || '#fff';
          g.font = '900 12px Nunito, sans-serif'; g.textAlign = 'center';
          g.fillText(f.txt, f.x, f.y - k * 22); g.globalAlpha = 1;
        }
        g.restore();
        return;
      }

      // ---- MODE COMBAT : donjon ----
      // background (offscreen)
      if (!bgCanvas) buildBg();
      if (bgCanvas) g.drawImage(bgCanvas, 0, 0);
      // animated biome paint (lava glow, crystals)
      const dec = arena.decor;
      if (dec) {
        for (const q of dec.paint) {
          if (q.kind === 'lava') {
            const pulse = 0.55 + 0.18 * Math.sin(T * 1.6 + q.a);
            const gd = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, q.r);
            gd.addColorStop(0, 'rgba(255,190,70,' + pulse + ')'); gd.addColorStop(0.55, 'rgba(226,96,32,' + (pulse * 0.7) + ')'); gd.addColorStop(1, 'rgba(120,30,10,0)');
            g.fillStyle = gd; g.save(); g.translate(q.x, q.y); g.rotate(q.a); g.scale(1, 0.55);
            g.beginPath(); g.arc(0, 0, q.r, 0, Math.PI * 2); g.fill(); g.restore();
          } else if (q.kind === 'crystal') {
            const pulse = 0.3 + 0.15 * Math.sin(T * 2.2 + q.a);
            const gd = g.createRadialGradient(q.x, q.y, 1, q.x, q.y, q.r * 1.6);
            gd.addColorStop(0, 'rgba(190,170,255,' + pulse + ')'); gd.addColorStop(1, 'rgba(120,100,200,0)');
            g.fillStyle = gd; g.beginPath(); g.arc(q.x, q.y, q.r * 1.6, 0, Math.PI * 2); g.fill();
          }
        }
      }
      // LE CRISTAL ET SA LUMIÈRE — la seule zone SÛRE de la salle. Dessinée
      // sous tout le reste : c'est un état du sol, pas un objet posé dessus.
      if (arena.cristal && arena.phase === 'fight') {
        const c = arena.cristal;
        const gr = g.createRadialGradient(c.x, c.y, c.r * 0.3, c.x, c.y, c.r);
        gr.addColorStop(0, 'rgba(150,220,255,0.16)');
        gr.addColorStop(1, 'rgba(150,220,255,0.02)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.fill();
        // le bord de la lumière : un liseré doux, pas un mur
        g.strokeStyle = 'rgba(150,220,255,0.25)'; g.lineWidth = 1.5;
        g.setLineDash([6, 8]);
        g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.stroke();
        g.setLineDash([]);
        // le cristal lui-même
        g.save();
        g.translate(c.x, c.y - CELL * 0.3);
        g.rotate(Math.sin(T * 0.8) * 0.08);
        g.fillStyle = 'rgba(160,225,255,0.9)';
        g.beginPath();
        g.moveTo(0, -CELL * 0.55); g.lineTo(CELL * 0.26, 0);
        g.lineTo(0, CELL * 0.4); g.lineTo(-CELL * 0.26, 0);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.stroke();
        g.restore();
      }
      // zones
      for (const z of arena.zones) {
        g.save();
        if (z.kind === 'tell') {
          // UNE ZONE À ÉVITER EST UNE OMBRE AU SOL, PAS UN PANNEAU.
          //
          // L'ancien rendu traçait un CONTOUR épais et remplissait jusqu'à 42 %
          // d'opacité : la zone hurlait plus fort que les personnages, et trois
          // annonces simultanées rendaient la salle illisible. Le sol n'a pas à
          // dominer ce qui marche dessus.
          //
          // Le nouveau rendu : pas de contour, un remplissage discret… et c'est
          // le BORD INTERNE qui monte avec le temps — un dégradé qui se resserre
          // vers le centre dit « ça va tomber » aussi bien qu'un trait rouge,
          // sans en avoir le poids visuel.
          const k = clamp(z.t / z.dur, 0, 1);
          const a0 = 0.06 + 0.14 * k;              // 6 → 20 % : jamais un aplat
          // LE CAMP SE LIT EN 100 ms : la menace est ROUGE, le coup de la
          // compagnie est OR. Sans cette distinction, le joueur fuit ses
          // propres bombes aussi sûrement que l'IA le faisait.
          const RGB = z.side === 'party' ? '240,192,74' : '220,60,50';
          if (z.shape === 'circle') {
            const gr = g.createRadialGradient(z.x, z.y, z.r * (0.5 - 0.3 * k), z.x, z.y, z.r);
            gr.addColorStop(0, 'rgba(' + RGB + ',' + (a0 * 0.5) + ')');
            gr.addColorStop(1, 'rgba(' + RGB + ',' + a0 + ')');
            g.fillStyle = gr;
            g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.fill();
          } else if (z.shape === 'ring') {
            g.fillStyle = 'rgba(' + RGB + ',' + a0 + ')';
            g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.arc(z.x, z.y, z.inner || 0, 0, Math.PI * 2, true); g.fill();
          } else if (z.shape === 'line') {
            const a = Math.atan2(z.y2 - z.y, z.x2 - z.x);
            g.translate(z.x, z.y); g.rotate(a);
            const L = Math.hypot(z.x2 - z.x, z.y2 - z.y);
            g.fillStyle = 'rgba(' + RGB + ',' + a0 + ')';
            g.fillRect(0, -(z.w || 40) / 2, L, z.w || 40);
          }
        } else if (z.kind === 'field') {
          // LA ZONE QUI DURE — même grammaire que l'annonce : un remplissage
          // CONSTANT et discret (18 % au plus, l'ancien rendu montait à 42 %
          // et trois zones rendaient la salle illisible) plus un liseré animé
          // qui dit « c'est vivant ». Sans rendu, une zone qui blesse est un
          // pouvoir muet.
          const RGB = z.allie ? '142,240,168' : '255,180,90';
          const fin = clamp((z.dur - z.t) / 0.6, 0, 1);      // elle s'éteint en douceur
          g.globalAlpha = fin;
          g.fillStyle = 'rgba(' + RGB + ',0.18)';
          if (z.shape === 'line') {
            const a = Math.atan2(z.y2 - z.y, z.x2 - z.x);
            g.save(); g.translate(z.x, z.y); g.rotate(a);
            g.fillRect(0, -(z.w || 40) / 2, Math.hypot(z.x2 - z.x, z.y2 - z.y), z.w || 40);
            g.restore();
          } else {
            g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.fill();
            g.strokeStyle = 'rgba(' + RGB + ',0.55)'; g.lineWidth = 1.6;
            g.setLineDash([5, 4]); g.lineDashOffset = -T * 14;
            g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.stroke();
            g.setLineDash([]);
          }
          g.globalAlpha = 1;
        } else if (z.kind === 'boom') {
          const k = 1 - clamp(z.t / z.dur, 0, 1);
          g.fillStyle = 'rgba(255,170,90,' + (0.55 * k) + ')';
          if (z.shape === 'line') { const a = Math.atan2(z.y2 - z.y, z.x2 - z.x); g.translate(z.x, z.y); g.rotate(a); g.fillRect(0, -(z.w || 40) / 2, Math.hypot(z.x2 - z.x, z.y2 - z.y), z.w || 40); }
          else { g.beginPath(); g.arc(z.x, z.y, z.r, 0, Math.PI * 2); g.fill(); }
        } else if (z.kind === 'fx') {
          const k = 1 - clamp(z.t / z.dur, 0, 1);
          g.strokeStyle = z.col; g.globalAlpha = k; g.lineWidth = 3;
          g.beginPath(); g.arc(z.x, z.y, z.r * (1.1 - k * 0.25), 0, Math.PI * 2); g.stroke();
        } else if (z.kind === 'bolt') {
          const k = 1 - clamp(z.t / z.dur, 0, 1);
          g.strokeStyle = z.col; g.globalAlpha = k; g.lineWidth = 4;
          g.beginPath(); g.moveTo(z.x, z.y); g.lineTo(z.x2, z.y2); g.stroke();
        }
        g.restore();
      }
      // move lines
      for (const p of arena.party) {
        if (p.dead || !p.dest || !arena.sel[p.id]) continue;
        g.strokeStyle = 'rgba(120,220,140,0.7)'; g.lineWidth = 1.5; g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.dest.x, p.dest.y); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.arc(p.dest.x, p.dest.y, 5, 0, Math.PI * 2); g.stroke();
      }
      // L'ESCALIER EST UN LIEU : il se dessine AVANT les unités (on passe
      // devant), et il est là du premier au dernier instant de la salle.
      if (!arena.camp) drawStaircase(g, T, arena.phase === 'cleared', arena.clearT || 0);
      // depth-sorted layer
      const layer = [];
      if (arena.decor) { for (const d of arena.decor.list) layer.push({ y: d.y, deco: d }); for (const q of arena.decor.paint) if (q.kind === 'column') layer.push({ y: q.y, deco: q }); }
      if (arena.obstacles) { for (const o of arena.obstacles.list) if (!o.ghost) layer.push({ y: o.y, obst: o }); }
      if (arena.barrels) { for (const b of arena.barrels) if (!b.dead) layer.push({ y: b.y, barrel: b }); }
      for (const e of arena.party.concat(arena.foes)) { if (!e.dead || e.deadT > 0) layer.push({ y: e.y, unit: e }); }
      layer.sort((a, b) => a.y - b.y);
      for (const it of layer) {
        if (it.unit && it.unit.portal) drawPortal(g, it.unit, T);
        else if (it.unit && it.unit.protege) drawProtege(g, it.unit, T);
        else if (it.unit) drawUnit(g, it.unit, T);
        else if (it.obst) drawObstacle(g, it.obst);
        else if (it.barrel) drawBarrel(g, it.barrel, T);
        else drawProp(g, it.deco, T);
      }
      for (const o of (arena.shots || [])) drawShot(g, o);
      // particles
      const D = decorOf(arena.biome.id);
      for (const p of particles) {
        const alpha = p.a * (1 - p.t / p.life);
        if (alpha <= 0) continue;
        g.fillStyle = D.particleCol + alpha.toFixed(2) + ')';
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
      }
      // éclats d'impact
      for (const b of (arena.bursts || [])) {
        const alpha = 1 - b.t / b.life;
        if (alpha <= 0) continue;
        g.globalAlpha = alpha;
        g.fillStyle = b.col;
        g.beginPath(); g.arc(b.x, b.y, b.r * alpha, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      // floats
      for (const f of arena.floats) {
        const k = clamp(f.t / 1.1, 0, 1);
        g.globalAlpha = 1 - k; g.fillStyle = f.col || '#fff';
        g.font = '900 12px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillText(f.txt, f.x, f.y - k * 22);
        g.globalAlpha = 1;
      }
      // box select
      if (dragStart && dragEnd) {
        g.strokeStyle = 'rgba(240,192,74,0.8)'; g.lineWidth = 1.5; g.setLineDash([4, 3]);
        g.strokeRect(dragStart.x, dragStart.y, dragEnd.x - dragStart.x, dragEnd.y - dragStart.y);
        g.setLineDash([]);
      }
      // overlays
      if (arena.pending) {
        g.fillStyle = 'rgba(40,30,18,0.6)'; g.fillRect(0, 0, W, 22);
        g.fillStyle = '#f8f2e4'; g.font = '900 12px Nunito, sans-serif'; g.textAlign = 'center';
        g.fillText(' Cliquez l\'endroit à viser (clic droit : annuler)', W / 2, 15);
      }

      if (arena.phase === 'lost') {
        g.fillStyle = 'rgba(30,22,14,0.6)'; g.fillRect(0, H / 2 - 26, W, 52);
        g.fillStyle = '#ff9a8a'; g.font = '900 19px Nunito, sans-serif'; g.textAlign = 'center';
        g.fillText(' La compagnie décroche…', W / 2, H / 2 + 6);
      }
      g.restore();
    };

    // escalier de descente (flat design, apparaît en bas)
    // L'ESCALIER — LA SORTIE DE LA SALLE.
    // Un portail de pierre appareillé dans le mur du fond : deux jambages, un
    // linteau à chevron, et derrière, des marches qui s'enfoncent dans le noir.
    // Tant qu'il reste des ennemis, DEUX BATTANTS de chêne cerclés de fer le
    // ferment, chaîne et cadenas au milieu. La salle nettoyée, la chaîne tombe
    // et les battants s'écartent en glissant derrière les jambages : la lumière
    // de l'étage suivant monte des marches.
    function drawStaircase(g, T, ouvert, t) {
      const sx = stairX(), sy = stairY();
      const w = CELL * 2.5, h = CELL * 2.15;      // l'ouverture
      const jamb = CELL * 0.42;                   // largeur d'un jambage
      const open = ouvert ? clamp(t / 0.55, 0, 1) : 0;
      const ease = open * open * (3 - 2 * open);  // départ et arrivée en douceur
      g.save();
      g.translate(sx, sy);

      // ---------- l'ouverture : un rectangle à sommet arrondi ----------
      const baie = () => {
        const r = w * 0.42;
        g.beginPath();
        g.moveTo(-w / 2, h * 0.5);
        g.lineTo(-w / 2, -h * 0.5 + r);
        g.quadraticCurveTo(-w / 2, -h * 0.5, -w / 2 + r, -h * 0.5);
        g.lineTo(w / 2 - r, -h * 0.5);
        g.quadraticCurveTo(w / 2, -h * 0.5, w / 2, -h * 0.5 + r);
        g.lineTo(w / 2, h * 0.5);
        g.closePath();
      };
      g.fillStyle = '#0d0a08'; baie(); g.fill();

      // ---------- les marches, qui s'enfoncent vers le haut ----------
      g.save();
      baie(); g.clip();
      const n = 6;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);                    // 0 = la plus proche
        const mw = w * (0.92 - k * 0.42);
        const my = h * 0.5 - i * (h * 0.152);
        const lum = (1 - k) * (ouvert ? 1 : 0.42);
        const c = v => Math.round(v * (0.22 + lum * 0.78));
        g.fillStyle = 'rgb(' + c(168) + ',' + c(146) + ',' + c(112) + ')';
        g.fillRect(-mw / 2, my - h * 0.115, mw, h * 0.115);
        g.fillStyle = 'rgba(12,8,6,0.55)';        // la contremarche
        g.fillRect(-mw / 2, my - h * 0.145, mw, h * 0.032);
        g.fillStyle = 'rgba(255,236,190,' + (0.1 * (1 - k) * (ouvert ? 1 : 0.25)) + ')';
        g.fillRect(-mw / 2, my - h * 0.118, mw, h * 0.014);   // le nez de marche
      }
      // la lueur de l'étage suivant, tout au fond
      if (ouvert) {
        const puls = 0.55 + 0.25 * Math.sin(T * 2.2);
        const gl = g.createRadialGradient(0, -h * 0.3, 2, 0, -h * 0.3, w * 0.8);
        gl.addColorStop(0, 'rgba(255,208,124,' + (0.42 * puls * ease) + ')');
        gl.addColorStop(1, 'rgba(255,170,60,0)');
        g.fillStyle = gl;
        g.beginPath(); g.arc(0, -h * 0.3, w * 0.8, 0, Math.PI * 2); g.fill();
      }

      // ---------- LES DEUX BATTANTS (dans l'ouverture) ----------
      if (ease < 1) {
        const slide = (w / 2 + jamb) * ease;      // ils rentrent dans les jambages
        for (const side of [-1, 1]) {
          g.save();
          g.translate(side * slide, 0);
          const x0 = side < 0 ? -w / 2 : 0;
          // le chêne
          const bois = g.createLinearGradient(x0, 0, x0 + w / 2, 0);
          bois.addColorStop(0, side < 0 ? '#4a3520' : '#5e4526');
          bois.addColorStop(1, side < 0 ? '#5e4526' : '#42301a');
          g.fillStyle = bois;
          g.fillRect(x0, -h * 0.5, w / 2, h);
          // les planches
          g.strokeStyle = 'rgba(28,18,10,0.5)';
          g.lineWidth = Math.max(0.9, CELL * 0.03);
          for (let k = 1; k < 3; k++) {
            const px = x0 + (w / 2) * (k / 3);
            g.beginPath(); g.moveTo(px, -h * 0.5); g.lineTo(px, h * 0.5); g.stroke();
          }
          // deux ferrures horizontales, avec rivets
          g.fillStyle = '#3b352e';
          for (const ky of [-0.28, 0.24]) {
            g.fillRect(x0, h * ky, w / 2, h * 0.075);
            g.fillStyle = '#6d655a';
            for (let k = 0; k < 3; k++) {
              g.beginPath();
              g.arc(x0 + (w / 2) * (0.18 + k * 0.32), h * ky + h * 0.037, CELL * 0.035, 0, Math.PI * 2);
              g.fill();
            }
            g.fillStyle = '#3b352e';
          }
          // l'anneau de tirage
          g.strokeStyle = '#7a7064'; g.lineWidth = Math.max(1.4, CELL * 0.05);
          g.beginPath();
          g.arc(side < 0 ? -CELL * 0.34 : CELL * 0.34, h * 0.02, CELL * 0.17, 0, Math.PI * 2);
          g.stroke();
          g.restore();
        }
        // la chaîne et le cadenas, tant que ce n'est pas ouvert
        if (ease < 0.35) {
          const a = 1 - ease / 0.35;
          g.globalAlpha = a;
          g.strokeStyle = '#5e574d'; g.lineWidth = Math.max(1.6, CELL * 0.06);
          g.beginPath();
          g.moveTo(-w * 0.34, -h * 0.06);
          g.quadraticCurveTo(0, h * 0.06, w * 0.34, -h * 0.06);
          g.stroke();
          g.fillStyle = '#8a8073';
          g.beginPath();
          (g.roundRect ? g.roundRect(-CELL * 0.2, h * 0.0, CELL * 0.4, CELL * 0.34, CELL * 0.07)
                       : g.rect(-CELL * 0.2, h * 0.0, CELL * 0.4, CELL * 0.34));
          g.fill();
          g.strokeStyle = '#5e574d'; g.lineWidth = Math.max(1.2, CELL * 0.045);
          g.beginPath(); g.arc(0, h * 0.005, CELL * 0.11, Math.PI, 0); g.stroke();
          g.fillStyle = '#3a342c';
          g.beginPath(); g.arc(0, h * 0.14, CELL * 0.05, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 1;
        }
      }
      g.restore();                                 // fin du découpage de la baie

      // ---------- L'ENCADREMENT DE PIERRE ----------
      const bloc = (bx, by, bw2, bh2, clair) => {
        g.fillStyle = clair ? '#b3a68e' : '#93876f';
        g.fillRect(bx, by, bw2, bh2);
        g.strokeStyle = 'rgba(46,38,28,0.35)'; g.lineWidth = 1;
        g.strokeRect(bx + 0.5, by + 0.5, bw2 - 1, bh2 - 1);
      };
      // les deux jambages, appareillés en assises alternées
      const rows = 7, rh = (h + jamb) / rows;
      for (let i = 0; i < rows; i++) {
        const by = -h * 0.5 - jamb * 0.5 + i * rh;
        bloc(-w / 2 - jamb, by, jamb, rh, i % 2 === 0);
        bloc(w / 2, by, jamb, rh, i % 2 === 1);
      }
      // le linteau
      bloc(-w / 2 - jamb, -h * 0.5 - jamb * 1.25, w + jamb * 2, jamb * 0.75, true);
      // le chevron gravé dans le linteau : « ça descend »
      g.strokeStyle = 'rgba(60,50,36,0.55)'; g.lineWidth = Math.max(1.6, CELL * 0.055);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const off of [-0.12, 0.12]) {
        g.beginPath();
        g.moveTo(-CELL * 0.34, -h * 0.5 - jamb * (1.0 + off));
        g.lineTo(0, -h * 0.5 - jamb * (0.72 + off));
        g.lineTo(CELL * 0.34, -h * 0.5 - jamb * (1.0 + off));
        g.stroke();
      }
      g.lineCap = 'butt'; g.lineJoin = 'miter';
      // l'ombre que l'encadrement projette dans la baie
      const ob = g.createLinearGradient(0, -h * 0.5, 0, -h * 0.5 + CELL * 0.7);
      ob.addColorStop(0, 'rgba(8,6,4,0.55)'); ob.addColorStop(1, 'rgba(8,6,4,0)');
      g.save(); baie(); g.clip();
      g.fillStyle = ob; g.fillRect(-w / 2, -h * 0.5, w, CELL * 0.7);
      g.restore();
      // le trait d'encre qui cerne l'ouverture
      g.strokeStyle = 'rgba(34,26,18,0.6)'; g.lineWidth = Math.max(1.4, CELL * 0.05);
      baie(); g.stroke();

      // ---------- ouvert : le chevron lumineux appelle ----------
      if (ease > 0.6) {
        const bob = Math.sin(T * 3.2) * CELL * 0.1;
        g.globalAlpha = (ease - 0.6) / 0.4 * (0.5 + 0.4 * Math.abs(Math.sin(T * 3.2)));
        g.fillStyle = '#ffe6a8';
        g.beginPath();
        g.moveTo(-CELL * 0.3, h * 0.2 + bob);
        g.lineTo(CELL * 0.3, h * 0.2 + bob);
        g.lineTo(0, h * 0.46 + bob);
        g.closePath(); g.fill();
        g.globalAlpha = 1;
      }
      g.restore();
    }

    // ------------------------------------------------------------
    // LE CAMP : même sol que le village/bataille + tour en style bâtiment
    // ------------------------------------------------------------
    let campGround = null, campGroundKey = '';
    function getCampGround() {
      const key = W + 'x' + H;
      if (campGround && campGroundKey === key) return campGround;
      let cv = null;
      // réutilise paintTerrain (battle-terrain.js) = EXACTEMENT le même rendu
      if (typeof paintTerrain === 'function') {
        try {
          const map = { w: W, h: H, seed: 4242, nodes: [], edges: [], obstacles: [] };
          cv = paintTerrain(map, { g1: '#8fbc6f', g2: '#6da054', decor: 'park' });
        } catch (e) { cv = null; }
      }
      if (!cv) {
        if (typeof document === 'undefined') return null;   // headless : pas de sol
        cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const gg = cv.getContext('2d');
        const lg = gg.createLinearGradient(0, 0, 0, H);
        lg.addColorStop(0, '#8fbc6f'); lg.addColorStop(1, '#6da054');
        gg.fillStyle = lg; gg.fillRect(0, 0, W, H);
      }
      campGround = cv; campGroundKey = key;
      return cv;
    }
    // la tour en style « bâtiment » du jeu (dégradés, coins ronds, ombre douce)
    function drawTower(g, T) {
      const tw = W / 2, base = H * 0.56;
      const bw = CELL * 2.4;          // largeur du corps
      const bh = CELL * 4.6;          // hauteur du corps
      const top = base - bh;
      const sh = (hex, k) => {
        const n = parseInt(hex.slice(1), 16);
        const c = v => Math.max(0, Math.min(255, Math.round(v * k)));
        return 'rgb(' + c((n >> 16) & 255) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
      };
      const stone = '#a89a82', stoneD = '#7d7058', ink = '#5c5040';
      g.save();
      g.translate(tw, base);
      // ombre douce au sol
      g.fillStyle = 'rgba(30,45,20,0.28)';
      g.beginPath(); g.ellipse(0, 4, bw * 0.75, CELL * 0.42, 0, 0, Math.PI * 2); g.fill();
      // butte de pierres à la base
      g.fillStyle = sh(stone, 0.85);
      g.beginPath(); g.ellipse(0, 0, bw * 0.62, CELL * 0.32, 0, 0, Math.PI * 2); g.fill();
      // CORPS : pierre avec dégradé horizontal (lumière à gauche)
      const body = g.createLinearGradient(-bw / 2, 0, bw / 2, 0);
      body.addColorStop(0, sh(stone, 1.12));
      body.addColorStop(0.5, stone);
      body.addColorStop(1, sh(stone, 0.72));
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(-bw / 2, 0);
      g.lineTo(-bw * 0.42, -bh);
      g.lineTo(bw * 0.42, -bh);
      g.lineTo(bw / 2, 0);
      g.closePath(); g.fill();
      // assises de pierres (lignes horizontales + joints décalés)
      g.strokeStyle = 'rgba(92,80,64,0.3)'; g.lineWidth = 1;
      const rows = 8;
      for (let i = 1; i < rows; i++) {
        const y = -(i * bh / rows);
        const hw = bw / 2 - (bw / 2 - bw * 0.42) * (i / rows);
        g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke();
        // joints verticaux décalés
        const off = (i % 2) * (hw / 2);
        for (let x = -hw + off; x < hw; x += hw / 1.5) {
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bh / rows); g.stroke();
        }
      }
      // CRÉNEAUX au sommet (merlons)
      g.fillStyle = sh(stone, 0.9);
      const mw = bw * 0.16, mh = CELL * 0.34;
      for (let i = 0; i < 4; i++) {
        const mx = -bw * 0.42 + i * (bw * 0.84 / 3) - mw / 2;
        g.beginPath();
        (g.roundRect ? g.roundRect(mx, -bh - mh, mw, mh + 2, 2) : g.rect(mx, -bh - mh, mw, mh + 2));
        g.fill();
      }
      // bandeau sous créneaux
      g.fillStyle = sh(stoneD, 1.0);
      g.fillRect(-bw * 0.44, -bh, bw * 0.88, CELL * 0.14);
      // FENÊTRES : quatre arches, et QUELQU'UN DERRIÈRE. Deux yeux ronds
      // suivent la scène, clignent de temps en temps et se déplacent un peu :
      // la tour n'est pas un décor mort, elle vous regarde monter.
      const lucarnes = [
        { sx: -1, y: -bh * 0.66, r: 0.135, blink: 0.0 },
        { sx: 1, y: -bh * 0.66, r: 0.135, blink: 1.7 },
        { sx: -1, y: -bh * 0.38, r: 0.115, blink: 3.1 },
        { sx: 1, y: -bh * 0.38, r: 0.115, blink: 4.4 },
      ];
      for (const L of lucarnes) {
        const wx = L.sx * bw * 0.2, wy = L.y, rr = CELL * L.r;
        // l'embrasure noire
        g.fillStyle = '#221b16';
        g.beginPath();
        g.moveTo(wx - rr, wy);
        g.lineTo(wx - rr, wy - rr * 1.2);
        g.arc(wx, wy - rr * 1.2, rr, Math.PI, 0);
        g.lineTo(wx + rr, wy);
        g.closePath(); g.fill();
        g.strokeStyle = sh(stoneD, 0.85); g.lineWidth = 1.6; g.stroke();
        // la chandelle du fond
        const gl = 0.26 + 0.1 * Math.sin(T * 1.8 + L.sx * 1.3);
        const wg = g.createRadialGradient(wx, wy - rr * 0.9, 1, wx, wy - rr * 0.9, rr * 1.6);
        wg.addColorStop(0, 'rgba(255,196,96,' + gl + ')');
        wg.addColorStop(1, 'rgba(255,170,60,0)');
        g.fillStyle = wg;
        g.beginPath(); g.arc(wx, wy - rr * 0.9, rr * 1.6, 0, Math.PI * 2); g.fill();
        // LES YEUX : ils balaient lentement, et clignent d'un coup
        const cy = wy - rr * 1.05;
        const look = Math.sin(T * 0.6 + L.blink) * rr * 0.22;
        const cycle = (T * 0.55 + L.blink) % 4.2;
        const ferme = cycle > 4.0;                 // ~0,2 s de clignement
        const ew = rr * 0.34, eh = ferme ? rr * 0.05 : rr * 0.38;
        for (const dx of [-0.34, 0.34]) {
          g.fillStyle = '#fdf6e4';
          g.beginPath(); g.ellipse(wx + dx * rr + look, cy, ew, eh, 0, 0, Math.PI * 2); g.fill();
          if (!ferme) {
            g.fillStyle = '#241c16';
            g.beginPath();
            g.ellipse(wx + dx * rr + look * 1.5, cy + rr * 0.03, ew * 0.46, eh * 0.6, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.beginPath(); g.arc(wx + dx * rr + look * 1.5 + ew * 0.2, cy - eh * 0.28, ew * 0.16, 0, Math.PI * 2); g.fill();
          }
        }
      }
      // PORTE : grande arche sombre (l'entrée du donjon)
      const dw = bw * 0.36, dh = CELL * 1.5;
      g.fillStyle = '#241c14';
      g.beginPath();
      g.moveTo(-dw / 2, 0);
      g.lineTo(-dw / 2, -dh * 0.55);
      g.arc(0, -dh * 0.55, dw / 2, Math.PI, 0);
      g.lineTo(dw / 2, 0);
      g.closePath(); g.fill();
      // lueur chaude qui respire dans l'entrée
      const dgl = 0.22 + 0.1 * Math.sin(T * 2.2);
      const eg = g.createRadialGradient(0, -dh * 0.3, 2, 0, -dh * 0.3, dw * 0.55);
      eg.addColorStop(0, 'rgba(220,150,60,' + dgl + ')');
      eg.addColorStop(1, 'rgba(120,70,20,0)');
      g.fillStyle = eg;
      g.beginPath(); g.arc(0, -dh * 0.3, dw * 0.55, 0, Math.PI * 2); g.fill();
      // contour de l'arche
      g.strokeStyle = sh(stoneD, 0.9); g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-dw / 2, 0);
      g.lineTo(-dw / 2, -dh * 0.55);
      g.arc(0, -dh * 0.55, dw / 2, Math.PI, 0);
      g.lineTo(dw / 2, 0);
      g.stroke();
      // marches devant la porte
      g.fillStyle = sh(stone, 0.95);
      g.fillRect(-dw * 0.7, 0, dw * 1.4, 4);
      g.fillStyle = sh(stone, 0.82);
      g.fillRect(-dw * 0.85, 4, dw * 1.7, 4);
      // (pas de drapeau : la tour se passe de bannière)
      // lierre sur le flanc (touche vivante)
      g.fillStyle = '#5a9a3a';
      for (let i = 0; i < 5; i++) {
        const lx = -bw * 0.4 + i * 2.5;
        const ly = -bh * 0.15 - i * CELL * 0.55;
        const sway = Math.sin(T * 1.3 + i) * 1;
        g.beginPath(); g.ellipse(lx + sway, ly, 4, 3, 0.3, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    // ---- LE BOUTON DE DESCENTE, DANS LA FENÊTRE ----
    // Il vit SOUS LA TOUR, dans la scène : on regarde la tour, on voit la
    // porte, on voit le bouton. Plus besoin de chercher un contrôle ailleurs
    // dans la page. Sa géométrie est une fonction pure pour que le clic sache
    // où il est sans dépendre d'un rendu déjà passé.
    let campHover = false, campPress = 0;
    function campGoRect() {
      const bw = Math.min(W * 0.6, CELL * 6.4);
      const bh = CELL * 1.05;
      return { x: W / 2 - bw / 2, y: H * 0.56 + CELL * 0.75, w: bw, h: bh };
    }
    // UN SEUL BOUTON, TROIS ÉTATS. Il n'y a jamais qu'une seule chose à faire
    // au camp : soit on encaisse le butin du voyage précédent, soit on repart,
    // soit on ne peut pas et il dit pourquoi. Deux boutons pour ça, c'était un
    // de trop — et une carte entière pour les héberger, deux de trop.
    function campGoInfo() {
      let why = null, floor = 1, party = 1, butin = null;
      try {
        const g = GameState.gen();
        butin = g.report || null;
        why = GameState.canStartDescent();
        floor = g.tally.lastCheckpoint || 1;
        party = g.party.length;
      } catch (e) { }
      if (butin) return { mode: 'butin', butin, ok: true, floor, party, why: null };
      return { mode: why ? 'bloque' : 'partir', why, floor, party, ok: !why };
    }
    function drawCampGo(g, T) {
      const R = campGoRect(), info = campGoInfo();
      const press = campPress > 0 ? 1 : 0;
      const dy = press ? 4 : 0;
      g.save();
      g.translate(R.x, R.y + dy);
      const OR = info.mode === 'butin';        // le butin se réclame en doré
      // l'ombre-barre sous le bouton : elle disparaît quand on appuie
      if (!press) {
        g.fillStyle = info.ok ? (OR ? '#8a6410' : '#7a3222') : '#5c554a';
        g.beginPath();
        (g.roundRect ? g.roundRect(0, 5, R.w, R.h, 8) : g.rect(0, 5, R.w, R.h));
        g.fill();
      }
      // l'aplat
      const base = info.ok
        ? (OR ? (campHover ? '#b8901e' : '#d8ab2c') : (campHover ? '#8a3f2a' : '#b8563a'))
        : '#8e877a';
      g.fillStyle = base;
      g.beginPath();
      (g.roundRect ? g.roundRect(0, 0, R.w, R.h, 8) : g.rect(0, 0, R.w, R.h));
      g.fill();
      // un liseré clair en haut : la lumière tombe du ciel
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.beginPath();
      (g.roundRect ? g.roundRect(2, 2, R.w - 4, R.h * 0.34, 6) : g.rect(2, 2, R.w - 4, R.h * 0.34));
      g.fill();
      // l'icône, dans une pastille
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.beginPath(); g.arc(R.h * 0.62, R.h / 2, R.h * 0.33, 0, Math.PI * 2); g.fill();
      g.font = '900 ' + Math.round(R.h * 0.44) + 'px Nunito, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(OR ? '' : (info.ok ? '' : ''), R.h * 0.62, R.h / 2 + 1);
      // le texte
      const RAISON = {
        rapport: 'Récupérez d’abord le butin',
        fatigue: 'Le Général est épuisé',
        cout: 'Pas assez de vivres',
        en_cours: 'La compagnie est déjà en bas',
      };
      g.textAlign = 'left';
      g.fillStyle = OR ? '#3a2c06' : (info.ok ? '#fff8ef' : '#efeade');
      g.font = '900 ' + Math.round(R.h * 0.36) + 'px Nunito, sans-serif';
      g.fillText(OR ? 'Récupérer le butin'
        : (info.ok ? 'Descendre au donjon' : 'Descente impossible'), R.h * 1.15, R.h * 0.36);
      g.globalAlpha = 0.85;
      g.font = '800 ' + Math.round(R.h * 0.26) + 'px Nunito, sans-serif';
      let sous = RAISON[info.why] || '';
      if (OR) {
        const b = info.butin;
        const nRes = Object.keys(b.loot.res || {}).length;
        const nObj = (b.loot.items || []).length;
        const bits = ['étage ' + b.floor];
        if (nRes) bits.push(nRes + ' ressource' + (nRes > 1 ? 's' : ''));
        if (nObj) bits.push(nObj + ' objet' + (nObj > 1 ? 's' : ''));
        if (b.xp) bits.push(Math.round(b.xp) + ' XP');
        sous = bits.join(' · ');
      } else if (info.ok) {
        sous = 'étage ' + info.floor + ' · ' + info.party + ' aventurier' + (info.party > 1 ? 's' : '');
      }
      g.fillText(sous, R.h * 1.15, R.h * 0.7);
      g.globalAlpha = 1;
      // le chevron qui appelle
      if (info.ok) {
        const bob = Math.sin(T * 3.2) * 2;
        g.fillStyle = OR ? 'rgba(58,44,6,0.6)' : 'rgba(255,255,255,0.75)';
        g.beginPath();
        g.moveTo(R.w - R.h * 0.75, R.h * 0.4 + bob);
        g.lineTo(R.w - R.h * 0.3, R.h * 0.4 + bob);
        g.lineTo(R.w - R.h * 0.525, R.h * 0.66 + bob);
        g.closePath(); g.fill();
      }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.restore();
    }

    function drawCampScene(g, T) {
      // sol identique au village / à la bataille
      const ground = getCampGround();
      if (ground) g.drawImage(ground, 0, 0, W, H);
      // la tour au centre
      drawTower(g, T);
      // et son bouton, juste dessous
      if (campPress > 0) campPress = Math.max(0, campPress - 0.05);
      drawCampGo(g, T);
    }

    A.snapshot = function () {
      if (!arena) return null;
      return {
        phase: arena.phase, auto: arena.auto, aiming: !!arena.pending,
        biome: arena.biome.id, isBoss: arena.isBoss, floor: arena.floor,
        room: arena.room, roomIcon: arena.camp ? '' : (arena.kind ? arena.kind.icon : ''),
        roomName: arena.camp ? 'Le camp' : (arena.kind ? arena.kind.name : 'Salle'),
        calm: !!arena.calm, camp: !!arena.camp,
        // L'OBJECTIF DE LA SALLE, pour que l'écran le dise : le temps restant
        // d'une survie, les PV du convoi — le joueur ne doit pas les deviner.
        objectif: arena.objectif ? {
          kind: arena.objectif.kind,
          tLeft: arena.objectif.tLeft != null ? Math.max(0, Math.ceil(arena.objectif.tLeft)) : null,
          protHp: (() => { const pr = arena.party.find(x => x.protege); return pr ? Math.max(0, Math.round(pr.hp)) : null; })(),
          protMax: (() => { const pr = arena.party.find(x => x.protege); return pr ? Math.round(pr.hpMax) : null; })(),
        } : null,
        party: arena.party.map(p => ({
          id: p.id, name: p.name, icon: p.icon, cls: p.cls, tint: p.tint, type: p.type, stance: p.stance,
          hp: Math.max(0, Math.round(p.hp)), hpMax: Math.round(p.hpMax), dead: p.dead,
          sel: !!arena.sel[p.id], st: p.st,
          // LA PANOPLIE. `ratio` est CROISSANT et normalisé : 0 juste après le
          // tir, 1 quand c'est prêt — littéralement « le cri se remplit », et
          // c'est ce que l'écran met dans son dégradé conique. `motif` dit
          // pourquoi un pouvoir PRÊT n'est pas parti : sans lui, une jauge
          // pleine et immobile ressemble à un bug.
          pouvoirs: (p.pouvoirs || []).map((s, i) => ({
            i, id: s.pid, icon: s.p.icon, name: s.p.name, txt: s.p.txt,
            cd: Math.max(0, Math.round(s.cd * 10) / 10), cdMax: s.cdMax,
            ratio: s.cdMax > 0 ? clamp(1 - s.cd / s.cdMax, 0, 1) : 1,
            pret: s.cd <= 0,
            motif: s.cd <= 0 ? (s.motif || null) : null,
          })),
          // ALIAS DÉPRÉCIÉ du slot 0, le temps que tout l'écran migre.
          ab: (p.pouvoirs && p.pouvoirs[0]) ? {
            id: p.pouvoirs[0].pid, icon: p.pouvoirs[0].p.icon, name: p.pouvoirs[0].p.name,
            txt: p.pouvoirs[0].p.txt, cd: p.pouvoirs[0].cd, cdMax: p.pouvoirs[0].cdMax,
            ready: p.pouvoirs[0].cd <= 0,
          } : null,
        })),
        foes: arena.foes.filter(f => !f.dead).length,
        foesTotal: arena.foes.length,
        waveNum: arena.waveNum || 1, waveTotal: arena.waveTotal || 1,
        // le THÈME de la vague en cours, en français, pour que l'écran le dise
        waveTheme: (() => {
          const th = (AD().waveTheme && arena._lastTheme) ? AD().waveTheme(arena._lastTheme) : null;
          return th ? th.name : null;
        })(),
        // LA CHASSE : où en est le trophée — en fuite (avec ses PV), abattu, échappé
        trophee: (() => {
          if (arena.room !== 'chasse') return null;
          const tr = arena.foes.find(x => x.trophee);
          return { etat: arena.tropheeSort || 'en_fuite', hp: tr ? Math.max(0, Math.round(tr.hp)) : 0 };
        })(),
      };
    };

    // ------------------------------------------------------------
    // APERÇU HORS JEU — pour l'atelier « Export sprites »
    // ------------------------------------------------------------
    // Tout ce que L'Aventure dessine vit dans ce fichier et n'est donc visible
    // nulle part ailleurs. Ces trois fonctions donnent un accès propre au
    // catalogue (mobilier, bestiaire, décors de camp) sans exposer l'intérieur
    // du moteur ni exiger une partie en cours.
    A.preview = {
      propKinds: () => Object.keys(DUNGEON_PROPS),
      foeKinds: () => Object.keys(DUNGEON_FOES),
      // le dessin d'une pièce d'équipement (l'UI et l'atelier d'export s'en servent)
      item: (g, baseId, size, rarityId) => drawItemArt(g, baseId, size, rarityId),
      itemBases: () => AD().ITEM_BASES.map(b => b.id),
      biomes: () => Object.keys(BIOME_DECOR),
      // le mobilier d'un biome, avec son gabarit réel en carreaux
      propsOf: id => (decorOf(id).props || []).slice(),
      taille: kind => PROP_TAILLE[kind] || 1.3,
      solide: kind => !!PROP_SOLIDE[kind],
      prop(g, kind, size, T, seed, glow) {
        const fn = DUNGEON_PROPS[kind];
        if (!fn) return false;
        fn(g, size, T || 0, (((seed || 1) % 1000) / 1000), glow);
        return true;
      },
      foe(g, id, size, phase, moving) {
        const fn = DUNGEON_FOES[id];
        if (!fn) return false;
        fn(g, size, phase || 0, !!moving);
        return true;
      },
      // une scène entière (la tour du camp, le portail de sortie) rendue à la
      // taille demandée : on prête W/H/CELL le temps du dessin, puis on rend.
      scene(g, what, w, h, cell, T, ouvert) {
        const sw = W, sh = H, sc = CELL;
        W = w; H = h; CELL = cell || Math.floor(w / GRID_W);
        try {
          if (what === 'tour') drawTower(g, T || 0);
          else if (what === 'escalier') drawStaircase(g, T || 0, !!ouvert, 9);
        } catch (e) { }
        W = sw; H = sh; CELL = sc;
      },
    };
    // CE QUE LE MOTEUR JOUE VRAIMENT. Le harnais croise les DONNÉES contre ce
    // registre : un pouvoir dont le `kind` n'est pas ici, un `proc` dont le nom
    // n'est pas ici, sont du décor — et c'est exactement le défaut historique
    // (des nœuds écrits, payés par le joueur, sans le moindre effet).
    A.registres = function () {
      return {
        kinds: KINDS_JOUES.slice(),
        procs: PROCS_JOUES.slice(),
        buffs: BUFFS_LUS.slice(),
        // les ÉTIQUETTES sont lues par `lancerPouvoirs` via `pol.prio[tag]` :
        // c'est par elles qu'une posture préfère une zone à un soin. « zone »
        // a en plus son test propre dans `veutTirer` (pas de bombe sur un isolé).
        tags: TAGS_LUS.slice(),
        veut: ['proche', 'groupe', 'arriere', 'faible', 'menace', 'blesse', 'soi'],
        mods: Object.keys(MODS_SCALAIRES).concat(Object.keys(MODS_DRAPEAUX)),
        stances: (function () {
          const out = [];
          const T = (AD().AI_STANCES) || {};
          for (const c in T) for (const st of T[c]) out.push(st.id);
          return out;
        })(),
      };
    };
    A._probe = { dodge: p => dodgeZones(p), auto: p => autoPlay(p), inZone, arena: () => arena,
      // la panoplie d'un personnage, et de quoi FORCER un pouvoir dans un slot
      // pour le jouer isolément (le harnais teste les 72, un personnage n'en
      // porte que 5).
      pouvoirs: heroId => {
        if (!arena) return null;
        const p = arena.party.find(h => h.id === heroId);
        return p ? p.pouvoirs : null;
      },
      poser: (heroId, pid) => {
        if (!arena) return null;
        const p = arena.party.find(h => h.id === heroId);
        const def = AD().powerById ? AD().powerById(pid) : null;
        if (!p || !def) return null;
        const slot = { pid, p: appliquerMods(def, (p.talents || {}).mods, pid, false), cd: 0, cdMax: Math.max(4, def.cd || 8) };
        p.pouvoirs = [slot];
        p.gcd = 0;
        return slot;
      },
      tirer: (heroId, tx, ty, cible) => {
        if (!arena) return false;
        const p = arena.party.find(h => h.id === heroId);
        if (!p || !p.pouvoirs || !p.pouvoirs[0]) return false;
        p.gcd = 0; p.pouvoirs[0].cd = 0;
        return fireAbility(p, p.pouvoirs[0], tx, ty, cible || null);
      },
      ctx: () => (arena ? contexteIA() : null),
      arriere: () => (arena ? arriereFoe(contexteIA().foes) : null),
      menacant: () => (arena ? plusMenacant(contexteIA().foes) : null),
      props: () => DUNGEON_PROPS, bestes: () => DUNGEON_FOES, solides: () => PROP_SOLIDE,
      stair: () => ({ x: stairX(), y: stairY() }),
      // fait apparaître une bête donnée dans l'arène courante (harnais)
      spawn: id => {
        if (!arena) return null;
        const f = mkFoe(id, arena.foes.length, 1, arena.diff, null);
        f.id = 'p' + arena.foes.length;
        arena.foes.push(f);
        return f;
      },
      // sondes du harnais : le vivier des renforts, une composition à thème,
      // un patron de boss posé à la main, un tour de réflexion d'un foe
      pickFoe: (cfg, floor) => pickFoeType(cfg, floor),
      comp: (cfg, n, floor, themeId) => buildComposition(cfg, n, floor,
        AD().waveTheme ? AD().waveTheme(themeId) : null),
      castPat: (f, pid, delay) => {
        if (!arena) return false;
        const P = AD().BOSS_PATTERNS[pid];
        const targets = arena.party.filter(p => !p.dead);
        if (!P || !targets.length) return false;
        castPattern(f, P, targets, delay || 0);
        return true;
      },
      think: f => foeThink(f, 0.1),
      // SONDES DU SOCLE D'ARÈNE : la carte de buffs, le contrôle, l'entonnoir
      // de soin, les auras et la pose d'une zone. Rien de tout cela n'a de
      // déclencheur public tant que les pouvoirs ne sont pas branchés — sans
      // ces poignées, aucun harnais ne peut prouver qu'un buff expire, qu'un
      // stun immobilise ou qu'une zone alliée ne fait pas fuir la compagnie.
      // LA PANOPLIE ET LE TIR, pour le harnais : `pouvoirs` rend les slots
      // vivants (avec `cd`/`cdMax`), `tirer` lâche un slot par son index sans
      // passer par l'écran ni par l'IA — c'est la seule façon de prouver
      // qu'un `kind` part vraiment.
      pouvoirs: heroId => {
        if (!arena) return null;
        const p = arena.party.find(h => h.id === heroId);
        return p ? (p.pouvoirs || []) : null;
      },
      tirer: (heroId, i, tx, ty, cible) => {
        if (!arena) return false;
        const p = arena.party.find(h => h.id === heroId && !h.dead);
        const slot = p && p.pouvoirs && p.pouvoirs[i | 0];
        return slot ? fireAbility(p, slot, tx == null ? null : tx, ty == null ? null : ty, cible || null) : false;
      },
      buff: (e, k, v, dur) => putBuff(e, k, v, dur),
      bf: (e, k) => bf(e, k),
      stun: (e, dur) => putStun(e, dur),
      soigne: (h, n, src) => soigne(h, n, src),
      auras: () => recalcAuras(),
      zone: z => { if (arena) { arena.zones.push(z); plafonnerZonesAlliees(); } return z; },
      hurtFoe: (f, n, pen, status) => hurtFoe(f, n, pen, status),
      // `src` (4e argument) : l'assaillant, sans quoi riposte / épines / usure
      // ne peuvent pas être éprouvées par un harnais.
      hurtHero: (p, n, elemId, src) => hurtHero(p, n, elemId, src) };
    window.Adventure = A;
  })();
