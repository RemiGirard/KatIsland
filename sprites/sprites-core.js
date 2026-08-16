/* ============================================================
   GRIFFES & PLUMES — sprites.js
   Bibliothèque d'art procédural. Style "peint" : dégradés radiaux
   doux, rayures en multiply, traits effilés, très peu de contours.
   Dépend de window.GameData. -> window.Sprites
   ============================================================ */
"use strict";

  const SGD = window.GameData;
  const US = 128;            // taille des sprites d'unité
  const FRAMES = 16;        // frames de marche
  const UNIT_DIRS = 16;     // directions (yaw) pré-rendues pour l'orientation en bataille
  const TAU = Math.PI * 2;

  // Cache global : Map clé string -> canvas | canvas[] (génération lazy)
  const cache = new Map();


  // ------------------------------------------------------------
  // Petits utilitaires
  // ------------------------------------------------------------
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  // petit filtre pixel-art : downscale (moyenné) puis upscale au plus proche (blocs).
  function pixelate(cv, px) {
    const w = cv.width, h = cv.height, sw = Math.max(1, Math.round(w / px)), sh = Math.max(1, Math.round(h / px));
    const t = mk(sw, sh), tg = t.getContext('2d');
    tg.imageSmoothingEnabled = true; tg.drawImage(cv, 0, 0, w, h, 0, 0, sw, sh);
    const g = cv.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h); g.drawImage(t, 0, 0, sw, sh, 0, 0, w, h);
    g.restore(); g.imageSmoothingEnabled = true;
  }
  // §pixel : le grain CUIT des sprites (portraits des menus, garnison, forge…) suit
  // BALANCE.pixelArt — même curseur que le filtre de scène de bataille.
  // base = grain historique (3) à l'ancien réglage 1.6 ; 0 → pas de grain du tout.
  function bakePx(base) {
    const GB = window.GameData && window.GameData.BALANCE;
    const p = (GB && GB.pixelArt != null) ? GB.pixelArt : 1.6;
    if (p <= 0) return 0;
    return Math.max(1, Math.round(base * p / 1.6));
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function rgba(hex, a) {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16),
          g = parseInt(h.slice(2, 4), 16),
          b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // Trait effilé (queue, plumes, plumets) : segments de largeur décroissante
  function taperedStroke(g, pts, w0, w1, color) {
    g.strokeStyle = color; g.lineCap = 'round';
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      g.lineWidth = w0 + (w1 - w0) * (i / n);
      g.beginPath();
      g.moveTo(pts[i][0], pts[i][1]);
      g.lineTo(pts[i + 1][0], pts[i + 1][1]);
      g.stroke();
    }
  }

  function roundRectPath(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function starPath(g, cx, cy, spikes, rOut, rIn, rot) {
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = (i % 2 === 0) ? rOut : rIn;
      const a = rot + (i / (spikes * 2)) * TAU;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }


  // Ombre portée douce (dégradé radial écrasé)
  function softShadow(g, cx, cy, rx, ry, alpha) {
    const grad = g.createRadialGradient(cx, cy, 1, cx, cy, rx);
    grad.addColorStop(0, 'rgba(20,30,25,' + alpha + ')');
    grad.addColorStop(1, 'rgba(20,30,25,0)');
    g.save();
    g.translate(cx, cy); g.scale(1, ry / rx); g.translate(-cx, -cy);
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, rx, 0, TAU); g.fill();
    g.restore();
  }


