/* ============================================================
   GRIFFES & PLUMES — model3d.js
   Moteur pseudo-3D porté DIRECTEMENT de newgraph/equip-lab.html.
   Projection orthographique (place/rot YAW+PITCH), tri peintre par z,
   ombrage par normale, back-face culling — AUCUNE perspective.
   -> window.Model3D.render(ctx, model, opts)
      opts = {yaw, pitch, hop, rock, scale, camX, camY}
   Le rock (balancement avant/arrière) est appliqué à TOUT SAUF la tête ;
   le hop (sautillement vertical) est appliqué au modèle entier.
   Dépend de rien (utilise ses propres helpers couleur/vecteur).
   ============================================================ */
"use strict";
(function () {

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  function h2rgb(h) { h = (h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgb2h(r) { return '#' + r.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) { const A = h2rgb(a), B = h2rgb(b); return rgb2h([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]); }
  function shade(a, amt) { return amt >= 0 ? mix(a, '#ffffff', amt) : mix(a, '#000000', -amt); }
  function rgba(a, al) { const c = h2rgb(a); return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`; }
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vlen = a => Math.hypot(a[0], a[1], a[2]), norm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dir = (az, el) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];

  // ---------- état de rendu (module-scope, réinitialisé à chaque render) ----------
  let g = null;        // ctx 2D courant
  let M = null;        // modèle courant
  let YAW = 0, PITCH = 0.26;
  let ROCK = 0;        // balancement avant/arrière (rad) du groupe non-tête
  let PART_HEAD = false; // vrai pendant la construction d'une part de tête (pas de rock)
  let sp = 'cat';

  // §4 : les éléments de tête ne SAUTENT que (pas de rock). Tout le reste se balance.
  const HEAD_IDS = new Set(['head', 'ears', 'eyes', 'nose', 'mouth', 'whiskers', 'brows',
    'cheeks', 'headStripes', 'fangs', 'beak', 'crest', 'tuft', 'helmet', 'crown']);
  const HIP = [0, 6, 0]; // pivot du balancement (hanche), axe X (profondeur y↔z)

  // balancement avant/arrière : rotation autour de l'axe X à la hanche
  function preRot(p) {
    if (PART_HEAD || !ROCK) return p;
    const dy = p[1] - HIP[1], dz = p[2] - HIP[2];
    const c = Math.cos(ROCK), s = Math.sin(ROCK);
    return [p[0], HIP[1] + dy * c - dz * s, HIP[2] + dy * s + dz * c];
  }
  function rot(p) {
    p = preRot(p);
    const cy = Math.cos(YAW), sy = Math.sin(YAW), cp = Math.cos(PITCH), sp2 = Math.sin(PITCH);
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy, y1 = p[1];
    return [x1, y1 * cp - z1 * sp2, y1 * sp2 + z1 * cp];
  }
  const place = p => { const r = rot(p); return { s: [r[0], -r[1]], z: r[2] }; };

  // ---------- ancrage d'équipement ----------
  function anchorBase(id) {
    const P = n => M.parts.find(x => x.id === n);
    if (!id || id === 'none') return [0, 0, 0];
    if (id === 'head') return (M.head || [0, 20, 0]).slice();
    if (id === 'body') { const b = P('body'); return b ? b.pos.slice() : [0, 11, 0]; }
    if (sp === 'cat') {
      const c = P('claws') || P('arms'); const hx = c ? Math.abs(c.pos[0]) : 4.5, hy = c ? c.pos[1] : 5.5, hz = c ? c.pos[2] : 0.4;
      if (id === 'rightArm') return [hx, hy, hz + 0.4]; if (id === 'leftArm') return [-hx, hy, hz + 0.4]; if (id === 'hands') return [0, hy + 0.6, Math.abs(hz) + 2.4];
    } else {
      const w = P('wings'); const wx = w ? Math.abs(w.pos[0]) : 5.6, wy = w ? w.pos[1] - 2 : 8, wz = w ? w.pos[2] : 0.6;
      if (id === 'rightArm') return [wx, wy, wz + 0.4]; if (id === 'leftArm') return [-wx, wy, wz + 0.4]; if (id === 'hands') return [0, wy, Math.abs(wz) + 2.4];
    }
    return [0, 0, 0];
  }
  function partWorld(p) { const b = anchorBase(p.anchorId); return [b[0] + p.pos[0], b[1] + p.pos[1], b[2] + p.pos[2]]; }

  // ---------- primitives de dessin (portées de equip-lab.html) ----------
  function faceFill(pts3, base) { // triangle 3D ombré par sa normale
    const s = pts3.map(place);
    const e1 = sub(pts3[1], pts3[0]), e2 = sub(pts3[2], pts3[0]); let nf = norm(cross(e1, e2));
    const nz = rot(nf)[2]; const col = mix(shade(base, -.28), shade(base, .32), smooth(-0.6, 1, nz));
    const z = (s[0].z + s[1].z + s[2].z) / 3;
    return { z, draw() { g.fillStyle = col; g.beginPath(); g.moveTo(s[0].s[0], s[0].s[1]); g.lineTo(s[1].s[0], s[1].s[1]); g.lineTo(s[2].s[0], s[2].s[1]); g.closePath(); g.fill(); } };
  }

  function earDrawable(p, side) {
    const az = p.anchor.az * side, el = p.anchor.el, n = dir(az, el), C = M.head, R = M.RH, up = [0, 1, 0];
    let O = add(C, scl(n, R * 0.8)); if (p.spread) O = add(O, [side * p.spread, 0, 0]);
    let U = norm(cross(up, n)); if (vlen(U) < 1e-3) U = [1, 0, 0];
    const V = norm(add(up, scl(n, p.tilt)));
    const model = p.model || 'pyramide';
    const w = (model === 'pointue' ? p.w * 0.66 : p.w), h = (model === 'pointue' ? p.h * 1.28 : p.h);
    if (model === 'arrondie' || model === 'ogive') {
      const N = norm(cross(U, V)), front = rot(N)[2] > 0.02;
      const o = place(O), Us = sub(place(add(O, U)).s, o.s), Vs = sub(place(add(O, V)).s, o.s);
      const shape = () => {
        g.beginPath(); g.moveTo(-w * 0.5, 0);
        if (model === 'ogive') { g.quadraticCurveTo(-w * 0.5, h * 0.7, 0, h); g.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.5, 0); }
        else { g.quadraticCurveTo(-w * 0.55, h * 0.95, 0, h); g.quadraticCurveTo(w * 0.55, h * 0.95, w * 0.5, 0); }
        g.closePath();
      };
      return {
        z: o.z, draw() {
          g.save(); g.transform(Us[0], Us[1], Vs[0], Vs[1], o.s[0], o.s[1]);
          if (front) {
            const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, shade(p.col, -.25)); gr.addColorStop(1, p.col); g.fillStyle = gr; shape(); g.fill();
            if (p.inner > 0) { g.fillStyle = rgba(p.col2 || M.pal.pink, .85); g.beginPath(); g.moveTo(-w * 0.28, h * 0.1); g.quadraticCurveTo(-w * 0.3, h * 0.6, 0, h * (model === 'ogive' ? 0.82 : 0.72)); g.quadraticCurveTo(w * 0.3, h * 0.6, w * 0.28, h * 0.1); g.closePath(); g.fill(); }
          } else {
            g.fillStyle = shade(p.col, -.26); shape(); g.fill();
            g.strokeStyle = shade(p.col, -.4); g.lineWidth = .3; shape(); g.stroke();
          }
          g.restore();
        }
      };
    }
    const bl = add(O, scl(U, -w * 0.5)), br = add(O, scl(U, w * 0.5));
    const apex = add(add(O, scl(V, h)), scl(n, p.depth * 0.5)), ridge = add(O, scl(n, p.depth));
    const fL = faceFill([bl, ridge, apex], p.col), fR = faceFill([br, ridge, apex], p.col), fB = faceFill([bl, br, apex], shade(p.col, -.16));
    return {
      z: (fL.z + fR.z + fB.z) / 3, draw() {
        [fL, fR, fB].sort((a, b) => a.z - b.z).forEach(f => f.draw());
        if (p.inner > 0 && rot(n)[2] > 0.12) {
          const io = add(O, scl(n, p.depth * 1.05));
          const il = add(io, scl(U, -w * 0.5 * p.inner)), ir = add(io, scl(U, w * 0.5 * p.inner)), ia = add(add(O, scl(V, h * 0.72)), scl(n, p.depth * 0.7));
          const s = [il, ir, ia].map(place); g.fillStyle = rgba(p.col2 || M.pal.pink, .85);
          g.beginPath(); g.moveTo(s[0].s[0], s[0].s[1]); g.lineTo(s[1].s[0], s[1].s[1]); g.lineTo(s[2].s[0], s[2].s[1]); g.closePath(); g.fill();
        }
      }
    };
  }

  function beakDrawable(p) {
    const az = p.anchor.az, el = p.anchor.el, n = dir(az, el), C = M.head, R = M.RH;
    const O = add(C, scl(n, R * 0.95));
    let T = cross([0, 1, 0], n); if (vlen(T) < 1e-3) T = [1, 0, 0]; T = norm(T); const B = norm(cross(n, T));
    let w = p.w, len = p.length, drop = p.drop; const model = p.model || 'pyramide';
    if (model === 'long') { w *= 0.62; len *= 1.6; } else if (model === 'large') { w *= 1.5; len *= 0.7; drop *= 1.2; }
    const hh = w * 0.7;
    const tl = add(add(O, scl(T, -w)), scl(B, hh)), tr = add(add(O, scl(T, w)), scl(B, hh));
    const bl = add(add(O, scl(T, -w)), scl(B, -hh)), br = add(add(O, scl(T, w)), scl(B, -hh));
    const apex = add(add(O, scl(n, len)), scl(B, -drop));
    const faces = [faceFill([tl, tr, apex], p.col), faceFill([bl, br, apex], shade(p.col, -.1)),
      faceFill([tl, bl, apex], p.col), faceFill([tr, br, apex], p.col)];
    const zc = Math.max(...faces.map(f => f.z));
    return { z: zc, draw() { faces.sort((a, b) => a.z - b.z).forEach(f => f.draw()); } };
  }

  function tailDrawable(p) {
    const base = p.pos;
    const d = norm([p.side, Math.sin(p.elev), -Math.max(0.15, Math.cos(p.elev))]);
    const tip = add(base, scl(d, p.length));
    const bs = place(base), tsp = place(tip);
    return {
      z: (bs.z + tsp.z) / 2, draw() {
        const bodyCol = (M.parts.find(x => x.id === 'body') || {}).col || p.col;
        const gr = g.createLinearGradient(bs.s[0], bs.s[1], tsp.s[0], tsp.s[1]);
        gr.addColorStop(0, bodyCol); gr.addColorStop(.35, p.col); gr.addColorStop(1, shade(p.col, .42));
        g.strokeStyle = gr; g.lineCap = 'round'; g.lineWidth = p.thick * 2;
        g.beginPath(); g.moveTo(bs.s[0], bs.s[1]); g.lineTo(tsp.s[0], tsp.s[1]); g.stroke();
        g.fillStyle = shade(p.col, .42); g.beginPath(); g.arc(tsp.s[0], tsp.s[1], p.thick * 0.9, 0, TAU); g.fill();
      }
    };
  }

  function wingDrawable(p, side) {
    const c = [side * p.pos[0], p.pos[1], p.pos[2]], o = place(c), model = p.model || 'ovale';
    return {
      z: o.z + p.layer * 0.3, draw() {
        g.save(); g.translate(o.s[0], o.s[1]); g.rotate(side * 0.2);
        if (model === 'plumes') {
          g.scale(side, 1); const base = mix(p.col, shade(p.col, -.3), .2);
          for (let i = 0; i < 3; i++) {
            const u = i / 2; g.fillStyle = mix(base, shade(p.col, -.3), u * 0.5);
            g.beginPath(); g.ellipse(u * 0.4, i * 1.9 * (p.h / 7), p.w * (0.9 - u * 0.15), p.h * (0.5 - i * 0.05), 0, 0, TAU); g.fill();
            g.strokeStyle = rgba(shade(p.col, -.3), .5); g.lineWidth = .5; g.beginPath(); g.moveTo(0, -p.h * 0.55 + i * 1.4); g.lineTo(0, p.h * 0.4 + i * 0.4); g.stroke();
          }
        }
        else {
          const gr = g.createLinearGradient(0, -p.h * 0.5, 0, p.h * 0.5); gr.addColorStop(0, shade(p.col, -.28)); gr.addColorStop(1, shade(p.col, .42)); g.fillStyle = gr;
          if (model === 'pointue') { g.beginPath(); g.moveTo(-p.w * 0.6, -p.h * 0.45); g.quadraticCurveTo(p.w, -p.h * 0.05, 0, p.h * 0.5); g.quadraticCurveTo(-p.w * 0.9, p.h * 0.05, -p.w * 0.6, -p.h * 0.45); g.closePath(); g.fill(); }
          else {
            g.beginPath(); g.ellipse(0, 0, p.w, p.h * 0.5, 0, 0, TAU); g.fill();
            g.strokeStyle = rgba(shade(p.col, -.35), .3); g.lineWidth = .4; g.beginPath(); g.moveTo(0, -p.h * 0.4); g.lineTo(0, p.h * 0.45); g.stroke();
          }
        }
        g.restore();
      }
    };
  }

  function noseDrawable(p) {
    const az = p.anchor.az, el = p.anchor.el, n = dir(az, el), C = M.head, R = M.RH;
    const O = add(C, scl(n, R * 0.98)); let T = cross([0, 1, 0], n); if (vlen(T) < 1e-3) T = [1, 0, 0]; T = norm(T); const B = norm(cross(n, T));
    const model = p.model || 'pyramide', s = p.size;
    if (model === 'pyramide') {
      const w = s * 0.9, hh = s * 0.7, len = p.protrusion, drop = p.drop;
      const tl = add(add(O, scl(T, -w)), scl(B, hh)), tr = add(add(O, scl(T, w)), scl(B, hh));
      const bl = add(add(O, scl(T, -w * 0.5)), scl(B, -hh)), br = add(add(O, scl(T, w * 0.5)), scl(B, -hh));
      const apex = add(add(O, scl(n, len)), scl(B, -drop));
      const faces = [faceFill([tl, tr, apex], p.col), faceFill([tl, bl, apex], p.col), faceFill([tr, br, apex], p.col), faceFill([bl, br, apex], shade(p.col, -.12))];
      return { z: Math.max(...faces.map(f => f.z)), draw() { faces.sort((a, b) => a.z - b.z).forEach(f => f.draw()); } };
    }
    const o = place(O), U = sub(place(add(O, T)).s, o.s), V = sub(place(add(O, B)).s, o.s), nr = rot(n);
    return {
      z: o.z, draw() {
        if (nr[2] <= 0.02) return; g.save(); g.transform(U[0], U[1], V[0], V[1], o.s[0], o.s[1]); g.fillStyle = p.col;
        if (model === 'triangle') { g.beginPath(); g.moveTo(-1.1 * s, -0.4 * s); g.lineTo(1.1 * s, -0.4 * s); g.lineTo(0, 0.9 * s); g.closePath(); g.fill(); }
        else {
          g.beginPath(); g.moveTo(0, 0.9 * s); g.bezierCurveTo(1.2 * s, 0.3 * s, 1.1 * s, -1.1 * s, 0, -0.75 * s); g.bezierCurveTo(-1.1 * s, -1.1 * s, -1.2 * s, 0.3 * s, 0, 0.9 * s); g.closePath(); g.fill();
          g.fillStyle = rgba('#fff', .3); g.beginPath(); g.ellipse(-0.3 * s, -0.35 * s, 0.35 * s, 0.25 * s, 0, 0, TAU); g.fill();
        }
        g.restore();
      }
    };
  }

  function fantailDrawable(p) {
    const base = p.pos, n = p.count | 0, bs = place(base), items = [];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0; const ang = t * p.spread, wob = Math.sin(i * 1.7) * 0.35;
      const d = norm([Math.sin(ang) * 0.9, Math.sin(p.elev) + Math.cos(ang) * 0.15, -Math.max(0.2, Math.cos(p.elev))]);
      const mid = add(base, scl(d, p.length * 0.55)), tip = add(add(base, scl(d, p.length)), [wob, 0.4, 0]);
      items.push([bs.s, place(mid).s, place(tip).s, place(add(base, scl(d, p.length))).z]);
    }
    items.sort((a, b) => a[3] - b[3]);
    return {
      z: bs.z, draw() {
        for (const it of items) {
          g.strokeStyle = p.col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = p.thick;
          g.beginPath(); g.moveTo(it[0][0], it[0][1]); g.quadraticCurveTo(it[1][0], it[1][1], it[2][0], it[2][1]); g.stroke();
          g.strokeStyle = shade(p.col, .28); g.lineWidth = p.thick * 0.4; g.beginPath(); g.moveTo(it[1][0], it[1][1]); g.lineTo(it[2][0], it[2][1]); g.stroke();
        }
      }
    };
  }

  function crestDrawable(p) {
    const C = M.head, R = M.RH, c = p.count | 0, up = [0, 1, 0];
    const az0 = p.anchor ? p.anchor.az : 0, el0 = p.anchor ? p.anchor.el : 1.0, spc = (p.spacing != null ? p.spacing : 0.16), rd = (p.redress != null ? p.redress : 0.2);
    const lean = norm([0, 1, -rd]), items = [];
    for (let i = 0; i < c; i++) {
      const t = c > 1 ? (i - (c - 1) / 2) / ((c - 1) / 2) : 0; const el = el0 - t * spc;
      const bn = dir(az0, el), base = add(C, scl(bn, R)), apex = add(base, scl(lean, p.size));
      let sd = norm(cross(up, bn)); if (vlen(sd) < 1e-3) sd = [1, 0, 0];
      const bl = add(base, scl(sd, -p.size * 0.28)), br = add(base, scl(sd, p.size * 0.28));
      items.push({ bl: place(bl).s, br: place(br).s, ap: place(apex).s, z: place(base).z });
    }
    items.sort((a, b) => a.z - b.z);
    return {
      z: place(add(C, scl(dir(az0, el0), R))).z + 0.4, draw() {
        for (const it of items) {
          const gr = g.createLinearGradient(it.bl[0], it.bl[1], it.ap[0], it.ap[1]); gr.addColorStop(0, shade(p.col, -.18)); gr.addColorStop(1, p.col); g.fillStyle = gr;
          g.beginPath(); g.moveTo(it.bl[0], it.bl[1]); g.quadraticCurveTo((it.bl[0] + it.ap[0]) / 2, (it.bl[1] + it.ap[1]) / 2, it.ap[0], it.ap[1]);
          g.quadraticCurveTo((it.br[0] + it.ap[0]) / 2, (it.br[1] + it.ap[1]) / 2, it.br[0], it.br[1]); g.closePath(); g.fill();
        }
      }
    };
  }

  function clawsDrawable(p, side) {
    const c = [(p.mirror ? side : 1) * p.pos[0], p.pos[1], p.pos[2]], o = place(c);
    return {
      z: o.z + p.layer * 0.3 + 0.5, draw() {
        g.save(); g.translate(o.s[0], o.s[1]); g.rotate(p.angle || 0); g.fillStyle = p.col;
        const cnt = p.count | 0, s = p.size, spd = p.spread;
        for (let i = 0; i < cnt; i++) { const x = (i - (cnt - 1) / 2) * spd; g.beginPath(); g.moveTo(x - 0.5 * s, 0); g.lineTo(x + 0.5 * s, 0); g.lineTo(x, 1.5 * s); g.closePath(); g.fill(); }
        g.restore();
      }
    };
  }

  function stripesDrawable(p) {
    if (p.target === 'head') {
      const C = M.head, R = M.RH, n = p.count | 0, az0 = p.anchor.az, el0 = p.anchor.el, cvg = p.converge || 0;
      const nn = dir(az0, el0), nr0 = rot(nn), O = add(C, scl(nn, R));
      let T = cross([0, 1, 0], nn); if (vlen(T) < 1e-3) T = [1, 0, 0]; T = norm(T); const B = norm(cross(nn, T));
      const o = place(O), U = sub(place(add(O, T)).s, o.s), V = sub(place(add(O, B)).s, o.s), half = p.len * 0.45;
      return {
        z: o.z + 0.35, draw() {
          if (nr0[2] <= 0.02) return;
          g.save(); g.transform(U[0], U[1], V[0], V[1], o.s[0], o.s[1]); g.rotate(p.angle || 0);
          g.globalCompositeOperation = 'multiply'; g.strokeStyle = p.col; g.lineWidth = p.w; g.lineCap = 'round'; g.globalAlpha = clamp(0.34 - (p.soft * 0.1), 0.06, 0.5); if (p.soft > 0) g.filter = 'blur(' + (p.soft * 1.4) + 'px)';
          for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * p.spacing; g.beginPath(); g.moveTo(off * (1 - cvg), -half); g.lineTo(off * (1 + cvg), half); g.stroke(); }
          g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
        }
      };
    }
    const bp = M.parts.find(x => x.id === 'body') || { pos: [0, 11, 0], rx: 5.5, ry: 5.8 };
    const c = bp.pos, rx = bp.rx, ry = bp.ry, cnt = p.count | 0, cvg = p.converge || 0, half = p.len * 0.5;
    const nn = [0, 0, 1], nr = rot(nn), O = add(c, [0, 0, rx * 0.55]);
    const oc = place(c), o = place(O), U = sub(place(add(O, [1, 0, 0])).s, o.s), V = sub(place(add(O, [0, 1, 0])).s, o.s);
    return {
      z: o.z + 0.2, draw() {
        if (nr[2] <= 0.02) return;
        g.save(); g.beginPath(); g.ellipse(oc.s[0], oc.s[1], rx, ry, 0, 0, TAU); g.clip();
        g.transform(U[0], U[1], V[0], V[1], o.s[0], o.s[1]);
        g.globalCompositeOperation = 'multiply'; g.strokeStyle = p.col; g.lineWidth = p.w; g.lineCap = 'round'; g.globalAlpha = clamp(0.30 - (p.soft * 0.1), 0.05, 0.45); if (p.soft > 0) g.filter = 'blur(' + (p.soft * 1.4) + 'px)';
        for (let i = 0; i < cnt; i++) { const off = (i - (cnt - 1) / 2) * p.spacing; g.beginPath(); g.moveTo(off * (1 - cvg), -half); g.lineTo(off * (1 + cvg), half); g.stroke(); }
        g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
      }
    };
  }

  function skinFrame(p, side) {
    const az = (p.anchor ? p.anchor.az : 0) * side, el = p.anchor ? p.anchor.el : 0, n = dir(az, el), R = M.RH, C = M.head;
    const O = add(C, scl(n, R)); let T = cross([0, 1, 0], n); if (vlen(T) < 1e-3) T = [1, 0, 0]; T = norm(T); const B = norm(cross(n, T));
    return { O, U: T, V: B, N: n };
  }

  function drawSkin(p, a, side, nz) {
    g.globalAlpha = a;
    if (p.kind === 'eye') {
      const w = p.w, h = p.h, SCc = 1.3;
      const almond = (ww, hh) => { g.beginPath(); g.moveTo(-ww, 0.2); g.quadraticCurveTo(0, -hh, ww, 0.2); g.quadraticCurveTo(0, hh * 0.9, -ww, 0.2); g.closePath(); };
      const gc = g.createLinearGradient(0, -h * SCc, 0, h * SCc); gc.addColorStop(0, shade(p.col, -.55)); gc.addColorStop(.5, shade(p.col, -.12)); gc.addColorStop(1, shade(p.col, .42));
      g.fillStyle = gc; almond(w * SCc, h * SCc); g.fill();
      almond(w, h); g.save(); g.clip(); g.fillStyle = p.col; g.fillRect(-w - 1, -h - 1, 2 * w + 2, 2 * h + 2);
      g.fillStyle = '#141210'; g.beginPath(); g.ellipse(0, 0.2, p.pupil, h * 0.85, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0.35 * w, -0.85, 0.55, 0, TAU); g.fill(); g.restore();
    }
    else if (p.kind === 'nose') {
      const s = p.size; if (p.soft > 0) { g.globalAlpha = a * 0.9; }
      g.fillStyle = p.col; g.beginPath(); g.moveTo(-1.1 * s, -0.4 * s); g.lineTo(1.1 * s, -0.4 * s); g.lineTo(0, 0.9 * s); g.closePath(); g.fill();
    }
    else if (p.kind === 'mouth') {
      g.strokeStyle = rgba(shade(p.col, -.1), .9); g.lineWidth = .8; g.lineCap = 'round'; const w = p.width, cu = p.curve;
      g.beginPath(); g.moveTo(0, -0.4); g.quadraticCurveTo(-w * 0.55, cu, -w, cu * 0.4); g.stroke();
      g.beginPath(); g.moveTo(0, -0.4); g.quadraticCurveTo(w * 0.55, cu, w, cu * 0.4); g.stroke();
    }
    else if (p.kind === 'fangs') {
      g.fillStyle = p.col; const spd = p.spread, sz = p.size;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * spd - 0.5, 0); g.lineTo(s * spd + 0.5, 0); g.lineTo(s * spd * 0.9, sz); g.closePath(); g.fill(); }
    }
    else if (p.kind === 'whisker') {
      g.lineWidth = (p.finesse != null ? p.finesse : 0.6); g.lineCap = 'round';
      for (const k of [-0.9, 0, 0.9]) { const gr = g.createLinearGradient(0, k * 0.5, side * p.len, k * 1.4); gr.addColorStop(0, '#4a4a4a'); gr.addColorStop(1, '#ececec'); g.strokeStyle = gr; g.beginPath(); g.moveTo(0, k * 0.5); g.lineTo(side * p.len, k * 1.4); g.stroke(); }
    }
    else if (p.kind === 'cheek') {
      const rx = p.rx, ry = p.ry;
      if (p.soft > 0) { const gr = g.createRadialGradient(0, 0, rx * (1 - p.soft) * 0.5, 0, 0, rx); gr.addColorStop(0, rgba(p.col, a * 0.55)); gr.addColorStop(1, rgba(p.col, 0)); g.fillStyle = gr; } else g.fillStyle = rgba(p.col, a * 0.5);
      g.save(); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
    }
    else if (p.kind === 'tuft') {
      g.strokeStyle = p.col; g.lineCap = 'round'; const n = p.count | 0;
      for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 0.7; g.lineWidth = 1.4; g.beginPath(); g.moveTo(off, 0); g.lineTo(off * 0.6, -p.size); g.stroke(); }
    }
    else if (p.kind === 'brow') {
      g.strokeStyle = p.col; g.lineWidth = p.thick; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-p.len * 0.5, 0.2); g.quadraticCurveTo(0, -p.len * 0.4, p.len * 0.5, -0.1); g.stroke();
    }
    g.globalAlpha = 1;
  }

  function volFill(p, cx, cy, rx, ry) {
    if (p.kind === 'sphere' || p.kind === 'blob') {
      const gr = g.createRadialGradient(cx - rx * 0.32, cy - ry * 0.34, rx * 0.1, cx, cy, Math.max(rx, ry));
      gr.addColorStop(0, shade(p.col, .34)); gr.addColorStop(.55, p.col); gr.addColorStop(1, shade(p.col, -.28)); return gr;
    }
    const gr = g.createLinearGradient(cx, cy - ry, cx, cy + ry); gr.addColorStop(0, shade(p.col, -.3)); gr.addColorStop(.5, p.col); gr.addColorStop(1, shade(p.col, .34)); return gr;
  }
  function drawVol(p, o) {
    const cx = o.s[0], cy = o.s[1];
    if (p.kind === 'capsule') {
      const r = p.r, L = p.length; g.fillStyle = volFill(p, cx, cy, r, L / 2);
      const x = cx - r, y = cy - L / 2; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + 2 * r, y, x + 2 * r, y + L, r); g.arcTo(x + 2 * r, y + L, x, y + L, r); g.arcTo(x, y + L, x, y, r); g.arcTo(x, y, x + 2 * r, y, r); g.closePath(); g.fill(); return;
    }
    const rx = p.rx || p.r, ry = p.ry || p.r; g.fillStyle = volFill(p, cx, cy, rx, ry); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    if (p.kind === 'blob') { const nb = rot([0, 0, 1]); if (nb[2] > 0) { g.globalAlpha = .5 * smooth(0, .4, nb[2]); g.fillStyle = M.pal.belly; g.beginPath(); g.ellipse(cx, cy + 1, rx * 0.55 * (0.4 + 0.6 * nb[2]), ry * 0.6, 0, 0, TAU); g.fill(); g.globalAlpha = 1; } }
    if (p.kind === 'sphere') { g.globalAlpha = .14; g.fillStyle = shade(p.col, -.28); g.beginPath(); g.ellipse(cx, cy + ry * 0.55, rx * 0.78, ry * 0.36, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
  }

  // ---------- billboards d'équipement (armes/armure) ----------
  function drawBillboard(spr, o, p, baseH, world) {
    const dm = p.dmode || 'facefront';
    let z = o.z + (p.layer || 0) * 0.5;
    if (dm === 'front') z = o.z + 1000;
    else if (dm === 'back') z = o.z - 1000;
    else if (dm === 'facefront') { const zy = world ? (-world[0] * Math.sin(YAW) + world[2] * Math.cos(YAW)) : 1; z = o.z + (p.layer || 0) * 0.5 + smooth(0, 1.5, zy) * 1000; }
    return {
      z: z, draw() {
        if (!spr || !spr.width) { return; }
        const sx = (p.sx != null ? p.sx : 1), sy = (p.sy != null ? p.sy : 1);
        const rotA = (p.rot || 0) + (p.follow || 0) * YAW;
        const fold = 1 - (p.fold || 0) * (1 - Math.abs(Math.cos(YAW)));
        const fx = (p.flipH ? -1 : 1) * sx * fold, fy = (p.flipV ? -1 : 1) * sy;
        const k = baseH / spr.height;
        g.save(); g.translate(o.s[0], o.s[1]); g.rotate(rotA);
        g.transform(1, 0, (p.shear || 0), 1, 0, 0); g.scale(fx, fy); g.imageSmoothingEnabled = true;
        g.drawImage(spr, -spr.width * k / 2, -spr.height * k / 2, spr.width * k, spr.height * k); g.restore();
      }
    };
  }
  function drawWeaponPart(p) { const w = partWorld(p); return drawBillboard(p.sprite, place(w), p, p.baseH != null ? p.baseH : 22, w); }
  function drawGameArmorPart(p) { const w = partWorld(p); return drawBillboard(p.sprite, place(w), p, p.baseH != null ? p.baseH : 10, w); }
  // §2 D17 : bouclier de la garde — billboard au bras gauche (dmode 'front' :
  // toujours dessiné par-dessus, lisible de face COMME de dos).
  function drawGameShieldPart(p) { const w = partWorld(p); return drawBillboard(p.sprite, place(w), p, p.baseH != null ? p.baseH : 13, w); }

  function drawShieldPart(p) {
    const o = place(p.pos);
    return {
      z: o.z + p.layer * 0.3, draw() {
        g.save(); g.translate(o.s[0], o.s[1]); g.rotate(p.rot || 0); const sc = p.scale || 1; g.scale(sc, sc);
        g.fillStyle = shade(p.col, -.25); g.beginPath(); g.moveTo(0, -4.2); g.quadraticCurveTo(4, -4, 4, 0); g.quadraticCurveTo(4, 3.6, 0, 5.2); g.quadraticCurveTo(-4, 3.6, -4, 0); g.quadraticCurveTo(-4, -4, 0, -4.2); g.closePath(); g.fill();
        const gr = g.createRadialGradient(-1, -1.4, 0.5, 0, 0, 5); gr.addColorStop(0, shade(p.col, .3)); gr.addColorStop(1, p.col); g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, -3.4); g.quadraticCurveTo(3.2, -3.2, 3.2, 0); g.quadraticCurveTo(3.2, 2.9, 0, 4.3); g.quadraticCurveTo(-3.2, 2.9, -3.2, 0); g.quadraticCurveTo(-3.2, -3.2, 0, -3.4); g.closePath(); g.fill();
        g.fillStyle = shade(p.col, -.4); g.beginPath(); g.ellipse(0, 0.8, 1.1, 1.3, 0, 0, TAU); g.fill();
        for (const dx of [-1.1, -0.4, 0.4, 1.1]) { g.beginPath(); g.ellipse(dx, -0.9, 0.34, 0.5, 0, 0, TAU); g.fill(); }
        g.restore();
      }
    };
  }
  function drawCapePart(p) {
    const o = place(p.pos);
    return {
      z: o.z + p.layer * 0.3, draw() {
        g.save(); g.translate(o.s[0], o.s[1]);
        const gr = g.createLinearGradient(0, -p.h * 0.5, 0, p.h * 0.5); gr.addColorStop(0, p.col); gr.addColorStop(1, shade(p.col, -.3)); g.fillStyle = gr;
        g.beginPath(); g.moveTo(-p.w * 0.35, -p.h * 0.5); g.lineTo(p.w * 0.35, -p.h * 0.5); g.quadraticCurveTo(p.w * 0.55, 0, p.w * 0.5, p.h * 0.5);
        g.lineTo(p.w * 0.16, p.h * 0.42); g.lineTo(0, p.h * 0.5); g.lineTo(-p.w * 0.16, p.h * 0.42); g.lineTo(-p.w * 0.5, p.h * 0.5); g.quadraticCurveTo(-p.w * 0.55, 0, -p.w * 0.35, -p.h * 0.5); g.closePath(); g.fill();
        g.strokeStyle = rgba('#000000', .12); g.lineWidth = .5; for (const dx of [-p.w * 0.18, p.w * 0.18]) { g.beginPath(); g.moveTo(dx, -p.h * 0.4); g.lineTo(dx * 1.4, p.h * 0.45); g.stroke(); }
        g.restore();
      }
    };
  }
  function drawHelmetPart(p) {
    const n = dir(p.anchor.az, p.anchor.el);
    const O = add(add(M.head, scl(n, M.RH * (p.lift != null ? p.lift : 0.9))), [0, p.dy || 0, p.dz || 0]);
    const o = place(O);
    return {
      z: o.z + p.layer * 0.3 + 0.3, draw() {
        g.save(); g.translate(o.s[0], o.s[1]); g.rotate(p.rot || 0);
        const s = p.size, gr = g.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s); gr.addColorStop(0, shade(p.col, .35)); gr.addColorStop(.6, p.col); gr.addColorStop(1, shade(p.col, -.3)); g.fillStyle = gr;
        g.beginPath(); g.ellipse(0, 0, s, s * 0.85, 0, Math.PI, TAU); g.lineTo(-s, s * 0.1); g.quadraticCurveTo(0, s * 0.35, s, s * 0.1); g.closePath(); g.fill();
        g.fillStyle = shade(p.col, -.35); g.fillRect(-s, s * 0.02, 2 * s, s * 0.16);
        g.fillStyle = shade(p.col, .2); g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(0.5, -s * 0.85 - 1.2); g.lineTo(-0.5, -s * 0.85 - 1.2); g.closePath(); g.fill();
        g.restore();
      }
    };
  }
  function drawCrownPart(p) {
    const n = dir(p.anchor.az, p.anchor.el);
    const O = add(add(M.head, scl(n, M.RH * (p.lift != null ? p.lift : 1))), [0, p.dy || 0, p.dz || 0]);
    const o = place(O);
    return {
      z: o.z + p.layer * 0.3 + 0.4, draw() {
        g.save(); g.translate(o.s[0], o.s[1]); g.rotate(p.rot || 0); const s = p.size;
        // halo lumineux doux (rang) : glow radial derrière/sous la couronne, teinte assortie
        if (p.halo) {
          const hc = p.haloCol || p.col;
          const hg = g.createRadialGradient(0, s * 0.05, s * 0.12, 0, s * 0.05, s * 1.7);
          hg.addColorStop(0, rgba(hc, 0.5)); hg.addColorStop(0.45, rgba(hc, 0.2)); hg.addColorStop(1, rgba(hc, 0));
          g.fillStyle = hg; g.beginPath(); g.arc(0, s * 0.05, s * 1.7, 0, TAU); g.fill();
        }
        const gr = g.createLinearGradient(0, -s * 0.5, 0, s * 0.4); gr.addColorStop(0, shade(p.col, .4)); gr.addColorStop(1, shade(p.col, -.25)); g.fillStyle = gr;
        g.beginPath(); g.moveTo(-s * 0.5, s * 0.35); g.lineTo(-s * 0.5, -s * 0.1); g.lineTo(-s * 0.28, s * 0.15); g.lineTo(-s * 0.16, -s * 0.4); g.lineTo(0, s * 0.1); g.lineTo(s * 0.16, -s * 0.4); g.lineTo(s * 0.28, s * 0.15); g.lineTo(s * 0.5, -s * 0.1); g.lineTo(s * 0.5, s * 0.35); g.closePath(); g.fill();
        g.fillStyle = '#e05a5a'; for (const dx of [-0.16, 0.16]) { g.beginPath(); g.arc(dx * s, -s * 0.34, s * 0.07, 0, TAU); g.fill(); } g.beginPath(); g.arc(0, s * 0.05, s * 0.08, 0, TAU); g.fill();
        g.restore();
      }
    };
  }

  // ---------- assemblage : tri peintre ----------
  function drawParts() {
    const draws = [];
    for (const p of M.parts) {
      if (!p.vis) continue;
      PART_HEAD = HEAD_IDS.has(p.id);          // §4 : la tête ne subit pas le rock
      const sides = p.mirror ? [-1, 1] : [0];
      for (const side of sides) {
        const s1 = side || 1;
        if (p.kind === 'sphere' || p.kind === 'blob' || p.kind === 'capsule') {
          const c = p.pos ? [(p.mirror ? s1 : 1) * p.pos[0], p.pos[1], p.pos[2]] : [0, 0, 0]; const o = place(c);
          draws.push({ z: o.z + p.layer * 0.3, fn: () => drawVol(p, o) });
        }
        else if (p.kind === 'tail') { const d = tailDrawable(p); draws.push({ z: d.z + p.layer * 0.3, fn: d.draw }); }
        else if (p.kind === 'ear') { const d = earDrawable(p, s1); draws.push({ z: d.z + p.layer * 0.3, fn: d.draw }); }
        else if (p.kind === 'beak') { const d = beakDrawable(p); draws.push({ z: d.z + p.layer * 0.3, fn: d.draw }); }
        else if (p.kind === 'nose') { const d = noseDrawable(p); draws.push({ z: d.z + p.layer * 0.3, fn: d.draw }); }
        else if (p.kind === 'fantail') { const d = fantailDrawable(p); draws.push({ z: d.z + p.layer * 0.3, fn: d.draw }); }
        else if (p.kind === 'crest') { const d = crestDrawable(p); draws.push({ z: d.z + p.layer * 0.3, fn: d.draw }); }
        else if (p.kind === 'claws') { const d = clawsDrawable(p, s1); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'weapon') { const d = drawWeaponPart(p); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'gamearmor') { const d = drawGameArmorPart(p); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'gameshield') { const d = drawGameShieldPart(p); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'shield') { const d = drawShieldPart(p); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'cape') { const d = drawCapePart(p); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'helmet') { const d = drawHelmetPart(p); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'crown') { const d = drawCrownPart(p); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'wing') { const d = wingDrawable(p, s1); draws.push({ z: d.z, fn: d.draw }); }
        else if (p.kind === 'stripes') { const d = stripesDrawable(p); draws.push({ z: d.z + p.layer * 0.3, fn: d.draw }); }
        else if (p.kind === 'tuft') {
          const fr = skinFrame(p, s1); const nr = rot(fr.N); if (nr[2] <= 0.02) continue;
          const o = place(fr.O), U = sub(place(add(fr.O, fr.U)).s, o.s), V = sub(place(add(fr.O, fr.V)).s, o.s);
          draws.push({ z: o.z + p.layer * 0.3 + 0.4, fn: () => { g.save(); g.transform(U[0], U[1], V[0], V[1], o.s[0], o.s[1]); drawSkin(p, 1, s1, nr[2]); g.restore(); } });
        }
        else {
          const fr = skinFrame(p, s1); const nr = rot(fr.N); if (nr[2] <= 0.02) continue;
          const o = place(fr.O), U = sub(place(add(fr.O, fr.U)).s, o.s), V = sub(place(add(fr.O, fr.V)).s, o.s);
          const a = smooth(0.02, 0.3, nr[2]);
          draws.push({ z: o.z + p.layer * 0.3 + 0.4, fn: () => { g.save(); g.transform(U[0], U[1], V[0], V[1], o.s[0], o.s[1]); g.rotate(p.angle || 0); if (p.soft > 0) g.filter = 'blur(' + (p.soft * 1.6) + 'px)'; drawSkin(p, a, s1, nr[2]); g.restore(); g.filter = 'none'; } });
        }
      }
    }
    PART_HEAD = false;
    draws.sort((a, b) => a.z - b.z);
    for (const d of draws) d.fn();
  }

  // ============================================================
  // API publique
  // ============================================================
  const CENTER_Y = 14; // centre vertical du modèle (unités modèle)

  function render(ctx, model, opts) {
    opts = opts || {};
    g = ctx; M = model; sp = model.sp || 'cat';
    YAW = opts.yaw || 0;
    PITCH = (opts.pitch != null ? opts.pitch : 0.26);
    ROCK = opts.rock || 0;
    const SC = opts.scale || 3.4, hop = opts.hop || 0;
    const camX = opts.camX || 0, camY = opts.camY || 0;

    g.save();
    g.translate(camX, camY);
    g.scale(SC, SC);
    g.translate(0, CENTER_Y);

    // ombre au sol (sans hop ni rock — elle reste posée)
    PART_HEAD = true; const savedRock = ROCK; ROCK = 0;
    const fs = place([0, 1.2, 0]);
    ROCK = savedRock; PART_HEAD = false;
    g.fillStyle = 'rgba(28,38,24,0.26)';
    g.beginPath(); g.ellipse(fs.s[0], fs.s[1] + 0.6, 7.4, 2.2, 0, 0, TAU); g.fill();

    // le sautillement lève tout le modèle
    g.translate(0, -hop);
    drawParts();
    g.restore();
  }

  // AUTO:model3d-data
  // Généré par dev/gen-model3d-data.js depuis public/labs/newgraph/*.json.
  // Modifier les JSON, puis relancer le générateur.
  const CAT_JSON = {"sp":"cat","pal":{"fur":"#f5a63c","furHi":"#ffd489","shade":"#b9611a","belly":"#ffe8c6","stripe":"#773f03","pink":"#ff9c9c"},"head":[0,20,0],"RH":9,"parts":[{"id":"tail","name":"Queue","kind":"tail","pos":[0.1,7.9,-2.2],"elev":-0.6,"side":0,"length":3,"thick":1,"layer":-2,"col":"#f5a63c","vis":1},{"id":"legs","name":"Jambes","kind":"capsule","mirror":1,"pos":[1.72,4.15,0.4],"r":1.5,"length":6,"layer":-1,"col":"#f5a63c","vis":1},{"id":"arms","name":"Bras","kind":"capsule","mirror":1,"pos":[4.47,9.6,0.4],"r":1.3,"length":9,"layer":0,"col":"#f5a63c","vis":1},{"id":"claws","name":"Griffes","kind":"claws","mirror":1,"pos":[4.5,5.5,0.3],"count":3,"size":0.5,"spread":0.75,"angle":-0.01,"layer":1,"col":"#fff4e0","vis":1},{"id":"body","name":"Corps","kind":"blob","pos":[0,11,0],"rx":5.5,"ry":5.8,"layer":0,"col":"#f5a63c","vis":0},{"id":"head","name":"Tête","kind":"sphere","pos":[0,20,0],"r":9,"layer":1,"col":"#f5a63c","vis":1},{"id":"headStripes","name":"Rayures tête","kind":"stripes","target":"head","count":3,"spacing":2.75,"len":6.8,"w":1.3,"converge":0.16,"soft":0.65,"angle":0,"anchor":{"az":-0.014,"el":0.707},"layer":3,"col":"#773f03","vis":1},{"id":"ears","name":"Oreilles","kind":"ear","mirror":1,"model":"ogive","anchor":{"az":0.78,"el":0.74},"w":5.5,"h":5.8,"spread":2.1,"tilt":0.04,"depth":1.9,"inner":0.56,"layer":2,"col":"#f5a63c","col2":"#ff9c9c","vis":1},{"id":"cheeks","name":"Joues","kind":"cheek","mirror":1,"anchor":{"az":0.418,"el":-0.23},"rx":3,"ry":1.65,"soft":1,"layer":3,"col":"#f97171","vis":1},{"id":"whiskers","name":"Moustaches","kind":"whisker","mirror":1,"anchor":{"az":0.34,"el":-0.23},"len":5.2,"finesse":0.3,"soft":0,"layer":3,"col":"#ffffff","vis":1},{"id":"brows","name":"Sourcils","kind":"brow","mirror":1,"anchor":{"az":0.42,"el":0.28},"len":1.8,"thick":0.8,"angle":0.25,"soft":0,"layer":4,"col":"#8a4a12","vis":0},{"id":"eyes","name":"Yeux","kind":"eye","mirror":1,"anchor":{"az":0.46,"el":0.06},"w":1.9,"h":2.5,"pupil":0.38,"angle":0,"soft":0,"layer":4,"col":"#8fbf4a","vis":1},{"id":"nose","name":"Museau","kind":"nose","model":"pyramide","anchor":{"az":0,"el":-0.297},"size":1.1,"protrusion":1,"drop":0.9,"layer":4,"col":"#ff9c9c","vis":1},{"id":"mouth","name":"Bouche","kind":"mouth","anchor":{"az":0,"el":-0.44},"width":2.5,"curve":0.7,"angle":3.13,"soft":0,"layer":4,"col":"#b9611a","vis":1},{"id":"fangs","name":"Crocs","kind":"fangs","anchor":{"az":-0.007,"el":-0.48},"size":1.2,"spread":2.15,"angle":3.13,"soft":0,"layer":3,"col":"#fbf6ea","vis":1},{"id":"weapon","name":"Arme","kind":"weapon","model":"lance","pos":[-10.48,14.68,1.5],"scale":1,"rot":-1.64,"layer":0,"col":"#c9d2dc","vis":1,"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},{"id":"shield","name":"Bouclier","kind":"shield","pos":[4.97,7.77,1.2],"scale":1,"rot":0,"layer":5,"col":"#8a5a2a","vis":0},{"id":"cape","name":"Cape","kind":"cape","pos":[0.37,6.73,-3],"w":6,"h":9,"layer":-1,"col":"#5f9e46","vis":1},{"id":"helmet","name":"Casque","kind":"helmet","anchor":{"az":-0.052,"el":1.42},"size":6.4,"lift":0.82,"dy":0.6,"dz":-0.4,"rot":0,"layer":3,"col":"#8a5a2a","vis":0},{"id":"crown","name":"Couronne","kind":"crown","anchor":{"az":0,"el":1.42},"size":8,"lift":0.85,"dy":0.4,"dz":-0.6,"rot":0,"layer":3,"col":"#ffd24d","vis":0},{"id":"gamearmor","name":"Armure (jeu)","kind":"gamearmor","pos":[0.07,-1.9,1.5],"sx":1.55,"sy":1.55,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0,"anchorId":"body","dmode":"auto","layer":0,"col":"#c9d2dc","vis":1},{"id":"gameshield","name":"Bouclier (jeu)","kind":"gameshield","pos":[9.1,4.3,1.3],"sx":0.95,"sy":0.95,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0,"anchorId":"leftArm","dmode":"front","layer":2,"col":"#c9d2dc","vis":0}]};
  const BIRD_JSON = {"sp":"bird","pal":{"fur":"#7ac043","furHi":"#c0e883","shade":"#4a852a","belly":"#eaf6cf","stripe":"#5c9c34","pink":"#ff9c9c"},"head":[0,20,0],"RH":7.7,"parts":[{"id":"tail","name":"Queue","kind":"fantail","pos":[0,10.5,-4],"count":3,"spread":0.7,"elev":0.15,"length":7,"thick":2.2,"layer":-2,"col":"#7ac043","vis":1},{"id":"legs","name":"Pattes","kind":"capsule","mirror":1,"pos":[2,3.6,0.4],"r":0.7,"length":5,"layer":-1,"col":"#e0872f","vis":1},{"id":"wings","name":"Ailes","kind":"wing","mirror":1,"model":"ovale","pos":[5.6,11,0.6],"w":2,"h":8.2,"layer":-1,"col":"#7ac043","vis":1},{"id":"body","name":"Corps","kind":"blob","pos":[0,11,0],"rx":5.6,"ry":6.2,"layer":0,"col":"#7ac043","vis":0},{"id":"head","name":"Tête","kind":"sphere","pos":[0,20,0],"r":7.7,"layer":1,"col":"#7ac043","vis":1},{"id":"tuft","name":"Touffe","kind":"tuft","count":3,"size":3.4,"anchor":{"az":-0.05,"el":0.85},"layer":2,"col":"#7ac043","vis":1},{"id":"crest","name":"Crête","kind":"crest","count":3,"size":2.2,"spacing":0.16,"redress":0.2,"anchor":{"az":0.02,"el":1.2},"layer":2,"col":"#e0532f","vis":1},{"id":"beak","name":"Bec","kind":"beak","model":"pyramide","anchor":{"az":0,"el":-0.05},"w":1.7,"length":2.1,"drop":2.6,"layer":3,"col":"#f0932b","vis":1},{"id":"cheeks","name":"Joues","kind":"cheek","mirror":1,"anchor":{"az":0.55,"el":-0.12},"rx":1.5,"ry":1,"soft":0.6,"layer":3,"col":"#ff9c9c","vis":1},{"id":"eyes","name":"Yeux","kind":"eye","mirror":1,"anchor":{"az":0.5,"el":0.05},"w":0.8,"h":1.05,"pupil":0.9,"angle":0,"soft":0,"layer":4,"col":"#1c2a1c","vis":1},{"id":"weapon","name":"Arme","kind":"weapon","model":"lance","pos":[-10.82,11.68,1.5],"scale":1,"rot":-1.56,"layer":0,"col":"#c9d2dc","vis":1,"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},{"id":"shield","name":"Bouclier","kind":"shield","pos":[-4.4,8.5,1.2],"scale":1,"rot":0,"layer":5,"col":"#8a5a2a","vis":0},{"id":"cape","name":"Cape","kind":"cape","pos":[0,12,-3],"w":6,"h":9,"layer":-1,"col":"#d0532f","vis":0},{"id":"helmet","name":"Casque","kind":"helmet","anchor":{"az":0,"el":1.35},"size":5,"lift":0.82,"dy":0.6,"dz":-0.3,"rot":0,"layer":3,"col":"#8a5a2a","vis":0},{"id":"crown","name":"Couronne","kind":"crown","anchor":{"az":0,"el":0.95},"size":3.4,"layer":3,"col":"#ffd24d","vis":0},{"id":"gamearmor","name":"Armure (jeu)","kind":"gamearmor","pos":[0,-0.4,1.5],"sx":1.65,"sy":1.65,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0,"anchorId":"body","dmode":"auto","layer":0,"col":"#c9d2dc","vis":1},{"id":"gameshield","name":"Bouclier (jeu)","kind":"gameshield","pos":[10.8,1.5,1],"sx":1,"sy":1,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0,"anchorId":"leftArm","dmode":"front","layer":2,"col":"#c9d2dc","vis":0}]};
  const PLACEMENT = {"cat":{"weapon":{"lance":{"pos":[-10.48,14.68,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":-1.64,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"tir":{"pos":[-10.58,7.84,1.5],"anchorId":"rightArm","dmode":"facefront","sx":0.65,"sy":0.65,"rot":-1.76,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"baton":{"pos":[-10.71,11.76,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":-1.68,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"explosif":{"pos":[-9.73,4.03,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":-0.22,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"garde":{"pos":[-10.3,11.2,1.5],"anchorId":"rightArm","dmode":"facefront","sx":0.9,"sy":0.9,"rot":-1.55,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0}},"armor":{"pos":[0.07,-1.9,1.5],"anchorId":"body","dmode":"auto","sx":1.55,"sy":1.55,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"shield":{"pos":[9.1,4.3,1.3],"anchorId":"leftArm","dmode":"front","sx":0.95,"sy":0.95,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0}},"bird":{"weapon":{"lance":{"pos":[-10.82,11.68,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":-1.56,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"tir":{"pos":[-10.89,7.21,1.5],"anchorId":"rightArm","dmode":"facefront","sx":0.7,"sy":0.7,"rot":-1.56,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"baton":{"pos":[-11.36,9.5,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":-1.68,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"explosif":{"pos":[-10.67,3.33,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":0.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"garde":{"pos":[-10.8,9.4,1.5],"anchorId":"rightArm","dmode":"facefront","sx":0.9,"sy":0.9,"rot":-1.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0}},"armor":{"pos":[0,-0.4,1.5],"anchorId":"body","dmode":"auto","sx":1.65,"sy":1.65,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"shield":{"pos":[10.8,1.5,1],"anchorId":"leftArm","dmode":"front","sx":1,"sy":1,"rot":0,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0}}};
  const PLACEMENT_TIER = {"cat":{"weapon":{"explosif":{"0":{"pos":[-9.94,3.89,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":0.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"1":{"pos":[-9.94,3.89,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":0.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"2":{"pos":[-9.94,3.89,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":0.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0}}}},"bird":{"weapon":{"explosif":{"0":{"pos":[-9.94,3.89,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":0.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"1":{"pos":[-9.94,3.89,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":0.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0},"2":{"pos":[-9.94,3.89,1.5],"anchorId":"rightArm","dmode":"facefront","sx":1,"sy":1,"rot":0.5,"shear":0,"flipH":0,"flipV":0,"follow":0,"fold":0}}}}};
  // /AUTO:model3d-data

  const clone = o => JSON.parse(JSON.stringify(o));

  window.Model3D = {
    render,
    CAT: () => clone(CAT_JSON),
    BIRD: () => clone(BIRD_JSON),
    placement: (species, cat, tier) => {
      const P = PLACEMENT[species] || PLACEMENT.cat;
      const base = P.weapon[cat] || P.weapon.lance;
      const ov = (PLACEMENT_TIER[species] && PLACEMENT_TIER[species].weapon[cat] && PLACEMENT_TIER[species].weapon[cat][tier]) || null;
      return clone(ov ? Object.assign({}, base, ov) : base);
    },
    armorPlacement: species => clone((PLACEMENT[species] || PLACEMENT.cat).armor),
    // §2 D17 : placement du bouclier de la garde (billboard bras gauche)
    shieldPlacement: species => clone((PLACEMENT[species] || PLACEMENT.cat).shield),
    // helpers exposés (utiles à sprites.js / debug)
    shade, mix,
    get PLACEMENT() { return clone(PLACEMENT); },
    get PLACEMENT_TIER() { return clone(PLACEMENT_TIER); },
  };
})();
