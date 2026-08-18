"use strict";
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ------------------------------------------------------------
  // Helpers locaux (self-contained)
  // ------------------------------------------------------------
  var TAU = Math.PI * 2;
  function hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function hex(r,g2,b){function q(v){v=Math.max(0,Math.min(255,Math.round(v)));return(v<16?'0':'')+v.toString(16);}return'#'+q(r)+q(g2)+q(b);}
  function shade(c,k){var a=hx(c);return k>=0?hex(a[0]+(255-a[0])*k,a[1]+(255-a[1])*k,a[2]+(255-a[2])*k):hex(a[0]*(1+k),a[1]*(1+k),a[2]*(1+k));}
  function mix(c1,c2,t){var A=hx(c1),B=hx(c2);return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
  function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function softShadow(g,x,y,rx,ry,a){var s=g.createRadialGradient(x,y,1,x,y,rx);s.addColorStop(0,'rgba(20,30,15,'+a+')');s.addColorStop(1,'rgba(20,30,15,0)');g.save();g.fillStyle=s;g.translate(x,y);g.scale(1,ry/rx);g.translate(-x,-y);g.beginPath();g.arc(x,y,rx,0,TAU);g.fill();g.restore();}
  function twig(g,x0,y0,x1,y1,w,c){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
  function pawPrint(g,x,y,r,c){g.fillStyle=c;g.beginPath();g.ellipse(x,y+r*.5,r,r*.8,0,0,TAU);g.fill();[-.75,0,.75].forEach(function(a){g.beginPath();g.arc(x+Math.sin(a)*r*1.35,y-r*.75+Math.abs(a)*r*.35,r*.42,0,TAU);g.fill();});}
  function featherMark(g,x,y,r,c){g.fillStyle=c;g.save();g.translate(x,y);g.rotate(-.6);g.beginPath();g.moveTo(0,-r);g.quadraticCurveTo(r*.85,-r*.2,0,r*1.15);g.quadraticCurveTo(-r*.85,-r*.2,0,-r);g.closePath();g.fill();g.restore();}
  function taperedStroke(g,pts,w0,w1,color){g.strokeStyle=color;g.lineCap='round';var n=pts.length-1;for(var i=0;i<n;i++){g.lineWidth=w0+(w1-w0)*(i/n);g.beginPath();g.moveTo(pts[i][0],pts[i][1]);g.lineTo(pts[i+1][0],pts[i+1][1]);g.stroke();}}

  // Palettes faction (nodePal du jeu)
  var PAL = {
    cats:   { wall:'#f4ddb8', wallSh:'#d9b98a', roof:'#f08c42', roofSh:'#c9662a', accent:'#e76f51', flag:'#f08c42', door:'#8a5a30' },
    birds:  { wall:'#e6f1f8', wallSh:'#bcd6e6', roof:'#48a9d8', roofSh:'#2f7ea8', accent:'#3a86ff', flag:'#48a9d8', door:'#4a6a80' },
    neutre: { wall:'#d8d5ce', wallSh:'#b2aea6', roof:'#a8a49c', roofSh:'#847f76', accent:'#98948c', flag:'#b0aca4', door:'#6e6a62' }
  };
  // Bois : chaud pour les factions vivantes, grisé pour le neutre
  function facWood(f){
    if (f === 'neutre') return { a:'#9a958a', b:'#7c776c', c:'#5f5b52', light:'#b5b0a4' };
    return { a:'#8a6a44', b:'#6e5434', c:'#54402a', light:'#c9a86a' };
  }
  // Poteau de bois avec rehaut côté lumière (haut-gauche)
  function pole(g, x0, y0, x1, y1, w, base, hi) {
    g.strokeStyle = base; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (hi) {
      var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / L * w * 0.24, ny = dx / L * w * 0.24;
      if (nx > 0) { nx = -nx; ny = -ny; }
      g.strokeStyle = hi; g.lineWidth = Math.max(1, w * 0.34); g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo(x1 + nx, y1 + ny); g.stroke();
      g.globalAlpha = 1;
    }
  }

  // ============================================================
  // 1) MIRADOR — tour de guet sur pilotis, longue-vue pivotante
  // ============================================================
  function drawMirador(g, animT, fac) {
    var P = PAL[fac], W = facWood(fac);
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 34, 10, 0.24);

    // ---- pilotis arrière (plus sombres) ----
    pole(g, 46, 83, 51, 47, 4.2, W.c, null);
    pole(g, 66, 83, 61, 47, 4.2, W.c, null);
    // ---- croisillons ----
    pole(g, 41, 79, 69, 56, 2.8, shade(W.b, -0.14), null);
    pole(g, 71, 79, 43, 56, 2.8, W.b, null);
    // ---- pilotis avant ----
    pole(g, 38, 86, 47, 46, 5.4, W.b, W.light);
    pole(g, 74, 86, 65, 46, 5.4, W.b, W.light);

    // détails de faction sur les pieds
    if (fac === 'cats') {
      // griffures affectueuses sur le pilotis avant-gauche
      g.strokeStyle = 'rgba(70,46,20,0.55)'; g.lineWidth = 1.2;
      for (var d3 = -1; d3 <= 1; d3++) {
        g.beginPath(); g.moveTo(40 + d3 * 2, 64 + d3); g.lineTo(42.5 + d3 * 2, 74 + d3); g.stroke();
      }
    } else if (fac === 'birds') {
      // brindilles fichées au pied des échasses
      twig(g, 44, 82, 36, 78, 1.6, '#8a6a3c');
      twig(g, 70, 84, 78, 79, 1.6, '#c9a06a');
    } else {
      // mousse au pied + ligature de corde qui répare un pilotis
      g.fillStyle = 'rgba(122,160,90,0.55)';
      g.beginPath(); g.ellipse(39, 85.5, 5.5, 2.4, 0.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(73, 86.5, 4.5, 2, -0.2, 0, TAU); g.fill();
      g.strokeStyle = W.light; g.lineWidth = 1.3;
      for (var ry = 0; ry < 3; ry++) {
        g.beginPath(); g.moveTo(66.6 - ry * 0.5, 64 + ry * 2.4); g.lineTo(72.6 - ry * 0.5, 63 + ry * 2.4); g.stroke();
      }
    }

    // ---- échelle (à droite, glissée derrière la plateforme) ----
    pole(g, 80, 87, 73, 49, 2.4, W.b, null);
    pole(g, 88, 85, 81, 47, 2.4, W.b, null);
    for (var li = 0; li < 5; li++) {
      var lt = 0.14 + li * 0.18;
      twig(g, 80 + (73 - 80) * lt, 87 + (49 - 87) * lt, 88 + (81 - 88) * lt, 85 + (47 - 85) * lt, 2, W.a);
    }

    // ---- plateforme ----
    var pg = g.createLinearGradient(0, 42, 0, 51);
    pg.addColorStop(0, shade(W.a, 0.28));
    pg.addColorStop(1, shade(W.a, -0.18));
    g.fillStyle = pg; rr(g, 33, 42.5, 46, 8, 3); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
    for (var px = 42; px <= 72; px += 10) { g.beginPath(); g.moveTo(px, 43.5); g.lineTo(px, 49.5); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.14)'; rr(g, 35, 48.6, 42, 2.2, 1.1); g.fill();

    if (fac === 'birds') {
      // plateforme-nid : brindilles tressées le long du bord
      var tw = [[33,44,41,41.4],[40,42,48,44.4],[47,44.4,56,41.2],[55,41.4,63,44.2],[62,44.4,70,41.4],[69,42,79,44.2]];
      for (var ti = 0; ti < tw.length; ti++) {
        twig(g, tw[ti][0], tw[ti][1], tw[ti][2], tw[ti][3], 1.5, ti % 2 ? '#8a6a3c' : '#c9a06a');
      }
      // œuf couvé sur la plateforme + plume coincée
      g.fillStyle = '#f2ead2';
      g.beginPath(); g.ellipse(44, 40.6, 2.6, 3.2, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(140,120,80,0.5)';
      g.beginPath(); g.arc(43.2, 41.2, 0.7, 0, TAU); g.fill();
      g.beginPath(); g.arc(44.8, 39.6, 0.55, 0, TAU); g.fill();
      featherMark(g, 76.5, 40.5, 2.8, 'rgba(230,240,248,0.9)');
    } else if (fac === 'cats') {
      pawPrint(g, 67, 46.3, 1.9, 'rgba(122,90,52,0.5)');
    } else {
      // planche manquante (mais proprement manquante) + mousse
      g.fillStyle = 'rgba(40,38,34,0.45)'; g.fillRect(59, 43.6, 4, 5.8);
      g.fillStyle = 'rgba(122,160,90,0.5)';
      g.beginPath(); g.ellipse(36.5, 42.6, 3.4, 1.5, 0.15, 0, TAU); g.fill();
    }

    // ---- montants du garde-corps (grimpent derrière la toile) ----
    pole(g, 37, 43, 37, 29, 2.6, W.b, null);
    pole(g, 75, 43, 75, 29, 2.6, W.b, null);
    pole(g, 56, 43, 56, 34.5, 2.2, W.b, null);

    // ---- toit ----
    if (fac === 'birds') {
      // grand toit-feuille
      var lgB = g.createLinearGradient(0, 14, 0, 34);
      lgB.addColorStop(0, '#8cbb72'); lgB.addColorStop(1, '#5e8f4e');
      g.fillStyle = lgB;
      g.beginPath();
      g.moveTo(26, 32);
      g.quadraticCurveTo(50, 13, 84, 25);
      g.quadraticCurveTo(58, 35, 26, 32);
      g.closePath(); g.fill();
      // nervures
      g.strokeStyle = 'rgba(64,102,50,0.75)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(28, 31.6); g.quadraticCurveTo(54, 25.5, 82, 25.2); g.stroke();
      g.lineWidth = 1;
      var vn = [[36,29.6,33,24.5],[46,27.6,44,20.8],[58,26.3,58,19.4],[70,25.6,73,20.2]];
      for (var vi = 0; vi < vn.length; vi++) {
        g.beginPath(); g.moveTo(vn[vi][0], vn[vi][1]); g.lineTo(vn[vi][2], vn[vi][3]); g.stroke();
      }
      // pétiole qui dépasse
      twig(g, 26, 32, 21, 35, 2, '#6e8f4e');
      // petite feuille compagne
      g.fillStyle = '#74a35e';
      g.beginPath();
      g.moveTo(70, 30);
      g.quadraticCurveTo(82, 20, 92, 28);
      g.quadraticCurveTo(81, 33, 70, 30);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(64,102,50,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(72, 29.6); g.quadraticCurveTo(82, 25.5, 90, 27.6); g.stroke();
    } else {
      var canvasCol = (fac === 'neutre') ? P.flag : P.roof;
      var rg2 = g.createLinearGradient(0, 14, 0, 36);
      rg2.addColorStop(0, shade(canvasCol, 0.22));
      rg2.addColorStop(1, shade(canvasCol, -0.15));
      g.fillStyle = rg2;
      g.beginPath();
      g.moveTo(30, 28);
      g.quadraticCurveTo(56, 14, 82, 28);
      g.lineTo(79, 31);
      if (fac === 'cats') {
        for (var sx = 79; sx > 34; sx -= 7.5) g.quadraticCurveTo(sx - 3.75, 35.5, sx - 7.5, 31);
      } else {
        // toile déchirée mais nette
        g.lineTo(74, 35.5); g.lineTo(69, 31.5); g.lineTo(63, 36);
        g.lineTo(56, 31.5); g.lineTo(50, 36.5); g.lineTo(43, 31.5);
        g.lineTo(37, 34.5); g.lineTo(33, 31);
      }
      g.closePath(); g.fill();
      if (fac === 'cats') {
        // rayures de toile
        g.save();
        g.beginPath();
        g.moveTo(30, 28);
        g.quadraticCurveTo(56, 14, 82, 28);
        g.lineTo(79, 31);
        for (var sx2 = 79; sx2 > 34; sx2 -= 7.5) g.quadraticCurveTo(sx2 - 3.75, 35.5, sx2 - 7.5, 31);
        g.closePath(); g.clip();
        g.fillStyle = shade(P.roofSh, -0.02); g.globalAlpha = 0.5;
        g.fillRect(38, 12, 7, 26); g.fillRect(54, 12, 7, 26); g.fillRect(70, 12, 7, 26);
        g.globalAlpha = 1;
        g.restore();
      } else {
        // rustine recousue (délabré mais soigné)
        g.fillStyle = 'rgba(255,255,255,0.16)'; rr(g, 58, 22.5, 9.5, 7, 1.5); g.fill();
        g.strokeStyle = 'rgba(60,58,54,0.5)'; g.lineWidth = 1;
        var st = [[58,24,56.5,25],[58,27.5,56.5,28.5],[67.5,24,69,25],[67.5,27.5,69,28.5]];
        for (var si = 0; si < st.length; si++) {
          g.beginPath(); g.moveTo(st[si][0], st[si][1]); g.lineTo(st[si][2], st[si][3]); g.stroke();
        }
      }
      g.strokeStyle = shade(canvasCol, -0.35); g.lineWidth = 1.2; g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(30, 28); g.quadraticCurveTo(56, 14, 82, 28); g.stroke();
      g.globalAlpha = 1;
    }

    // ---- lisse du garde-corps (devant la toile) ----
    g.fillStyle = shade(W.a, 0.12); rr(g, 34.5, 32.5, 43, 3, 1.5); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(35.5, 35); g.lineTo(76.5, 35); g.stroke();

    // ---- LONGUE-VUE (animée : pivote lentement, aller-retour) ----
    pole(g, 63, 43, 63, 38, 2, W.c, null);
    g.save();
    g.translate(63, 37);
    g.rotate(-0.25 + 0.16 * Math.sin(PH * TAU));
    g.fillStyle = shade(W.a, 0.06); rr(g, -12, -2.6, 12.5, 5.2, 2.4); g.fill();
    g.fillStyle = W.b; rr(g, -19, -2, 8, 4, 2); g.fill();
    g.fillStyle = '#f4c542'; g.fillRect(-13, -2.9, 2.4, 5.8);
    g.fillStyle = W.c; rr(g, 0.2, -1.8, 3, 3.6, 1.5); g.fill();
    g.fillStyle = 'rgba(230,245,255,0.85)';
    g.beginPath(); g.arc(-17.6, 0, 1.3, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.3)'; rr(g, -11, -2, 9, 1.4, 0.7); g.fill();
    g.restore();

    // ---- accessoires au sol ----
    if (fac === 'cats') {
      // gamelle de service (le guet creuse)
      g.fillStyle = shade(P.accent, -0.2);
      g.beginPath(); g.ellipse(23, 84.5, 8, 3.6, 0, 0, TAU); g.fill();
      g.fillStyle = P.accent;
      g.beginPath(); g.ellipse(23, 83, 8, 3.4, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(90,50,25,0.9)';
      g.beginPath(); g.ellipse(23, 83.2, 5.6, 2.1, 0, 0, TAU); g.fill();
      g.fillStyle = '#b8894c';
      g.beginPath(); g.arc(20.6, 82.8, 1.25, 0, TAU); g.fill();
      g.beginPath(); g.arc(23.6, 83.6, 1.25, 0, TAU); g.fill();
      g.beginPath(); g.arc(25.8, 82.6, 1.15, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(23, 82.6, 7.2, 2.8, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
    } else if (fac === 'birds') {
      g.fillStyle = '#e8c96a';
      g.beginPath(); g.arc(29, 86, 1.4, 0, TAU); g.fill();
      g.beginPath(); g.arc(33, 84.4, 1.2, 0, TAU); g.fill();
      g.beginPath(); g.arc(26, 83.6, 1.1, 0, TAU); g.fill();
    } else {
      // petit panneau gris, un peu de guingois mais lisible
      pole(g, 24, 86, 24, 73, 2.2, W.b, null);
      g.save(); g.translate(24, 70.5); g.rotate(-0.08);
      var sg3 = g.createLinearGradient(0, -4, 0, 4);
      sg3.addColorStop(0, shade(P.wall, 0.06)); sg3.addColorStop(1, shade(P.wallSh, -0.05));
      g.fillStyle = sg3; rr(g, -8, -3.6, 16, 7.2, 1.5); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-5, -0.8); g.lineTo(1.5, -0.8); g.stroke();
      g.beginPath(); g.moveTo(-5, 1.6); g.lineTo(4, 1.6); g.stroke();
      g.restore();
    }
  }

  // ============================================================
  // 2) CAMPEMENT — feu, tente basse, rondin-banc, provisions
  // ============================================================
  function drawCampement(g, animT, fac) {
    var P = PAL[fac], W = facWood(fac);
    var PH = (animT % 3.2) / 3.2;
    var lit = fac !== 'neutre';
    softShadow(g, 56, 88, 36, 10, 0.22);

    // ---- tente basse (gauche) ----
    softShadow(g, 33, 85.5, 21, 6.5, 0.14);
    var tg = g.createLinearGradient(0, 58, 0, 85);
    tg.addColorStop(0, shade(P.roof, 0.24));
    tg.addColorStop(1, shade(P.roof, -0.16));
    g.fillStyle = tg;
    g.beginPath();
    g.moveTo(14, 84);
    g.quadraticCurveTo(20, 67, 33, 59.5);
    g.quadraticCurveTo(46, 67, 51, 84);
    g.quadraticCurveTo(33, 87, 14, 84);
    g.closePath(); g.fill();
    // piquet de faîte
    twig(g, 33, 60.5, 33, 54, 2, W.b);
    g.fillStyle = W.light; g.beginPath(); g.arc(33, 53.4, 1.5, 0, TAU); g.fill();
    // coutures sur la pente gauche
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
    var stt = [[24,72,26.4,73.4],[20.5,77,23,78.4],[27.6,66.8,30,68]];
    for (var si2 = 0; si2 < stt.length; si2++) {
      g.beginPath(); g.moveTo(stt[si2][0], stt[si2][1]); g.lineTo(stt[si2][2], stt[si2][3]); g.stroke();
    }
    // entrée sombre + rabat
    g.fillStyle = 'rgba(28,23,19,0.85)';
    g.beginPath();
    g.moveTo(25, 84); g.quadraticCurveTo(33, 63.5, 41, 84);
    g.quadraticCurveTo(33, 85.8, 25, 84);
    g.closePath(); g.fill();
    g.strokeStyle = shade(P.roof, 0.32); g.lineWidth = 2;
    g.beginPath(); g.moveTo(33.6, 64.8); g.quadraticCurveTo(38.5, 73, 41, 84); g.stroke();
    // intérieur douillet par faction
    if (fac === 'cats') {
      g.fillStyle = mix(P.accent, '#ffffff', 0.35);
      g.beginPath(); g.ellipse(32.5, 83.2, 5, 1.9, 0, 0, TAU); g.fill();
      pawPrint(g, 21, 73.5, 2.4, 'rgba(255,255,255,0.75)');
    } else if (fac === 'birds') {
      g.fillStyle = '#e8c96a';
      g.beginPath(); g.ellipse(32.5, 83.4, 4.6, 1.7, 0, 0, TAU); g.fill();
      featherMark(g, 21, 73, 3, 'rgba(255,255,255,0.8)');
    } else {
      // rustine cousue sur toile grise
      g.fillStyle = shade(P.roof, 0.14); rr(g, 17.5, 70.5, 7.5, 6.5, 1.2); g.fill();
      g.strokeStyle = 'rgba(50,48,44,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(17.5, 72.4); g.lineTo(16, 73.2); g.stroke();
      g.beginPath(); g.moveTo(25, 72.4); g.lineTo(26.5, 73.2); g.stroke();
      g.beginPath(); g.moveTo(17.5, 75.2); g.lineTo(16, 76); g.stroke();
    }
    // corde + piquet
    g.strokeStyle = 'rgba(90,72,48,0.7)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(35, 62.5); g.quadraticCurveTo(46, 72, 53, 82.5); g.stroke();
    twig(g, 53, 82.5, 55, 86.5, 2, W.b);

    // ---- foyer : cendre, pierres, bûches ----
    g.fillStyle = lit ? '#b8a284' : '#aaa79e';
    g.beginPath(); g.ellipse(68, 80.5, 12.5, 4.8, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(62,52,42,0.5)';
    g.beginPath(); g.ellipse(68, 80.5, 8.5, 3.1, 0, 0, TAU); g.fill();
    var stones = [[56,80.5,4.2],[61,84,4.6],[69,85.5,5],[77,83.5,4.4],[81,79.5,3.8],[74,76.5,3.6],[62,76.2,3.4]];
    for (var ki = 0; ki < stones.length; ki++) {
      var st2 = stones[ki];
      g.fillStyle = ki % 2 ? '#8a8478' : '#989286';
      g.beginPath(); g.ellipse(st2[0], st2[1], st2[2], st2[2] * 0.72, 0, 0, TAU); g.fill();
      g.fillStyle = '#a8a296';
      g.beginPath(); g.ellipse(st2[0] - st2[2] * 0.25, st2[1] - st2[2] * 0.3, st2[2] * 0.55, st2[2] * 0.38, 0, 0, TAU); g.fill();
    }
    // bûches croisées
    twig(g, 61, 81, 75, 77.5, 4, lit ? W.b : '#4a4640');
    twig(g, 62, 77.5, 74.5, 82, 4, lit ? shade(W.b, 0.14) : '#5a564e');
    g.fillStyle = lit ? W.light : '#8a8478';
    g.beginPath(); g.arc(61.2, 80.9, 1.6, 0, TAU); g.fill();
    g.beginPath(); g.arc(74.4, 81.9, 1.6, 0, TAU); g.fill();

    // ---- rondin-banc (avant) ----
    var bg2 = g.createLinearGradient(0, 82, 0, 89);
    bg2.addColorStop(0, shade(W.a, 0.18));
    bg2.addColorStop(1, shade(W.a, -0.26));
    g.fillStyle = bg2; rr(g, 55, 82, 32, 6.5, 3.2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(58, 84.2); g.lineTo(83, 84.2); g.stroke();
    g.beginPath(); g.moveTo(60, 86.4); g.lineTo(80, 86.4); g.stroke();
    // rondelle de coupe avec cernes
    g.fillStyle = W.light;
    g.beginPath(); g.ellipse(87.2, 85.2, 3.3, 3.1, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(90,64,32,0.55)'; g.lineWidth = 1;
    g.beginPath(); g.arc(87.2, 85.2, 1.9, 0.4, TAU - 0.6); g.stroke();
    g.beginPath(); g.arc(87.2, 85.2, 0.8, 1.2, TAU); g.stroke();

    // ---- pile de provisions (droite) ----
    if (fac === 'cats') {
      // caisse de croquettes en carton
      var cg = g.createLinearGradient(82, 0, 100, 0);
      cg.addColorStop(0, shade('#dcb77e', 0.14)); cg.addColorStop(1, shade('#dcb77e', -0.1));
      g.fillStyle = cg; rr(g, 82, 65, 18, 14.5, 2); g.fill();
      // rabats entrouverts
      g.fillStyle = '#b8935c';
      g.beginPath(); g.moveTo(82.5, 65.5); g.lineTo(85.5, 61); g.lineTo(91, 62); g.lineTo(90.5, 65.5); g.closePath(); g.fill();
      g.fillStyle = shade('#b8935c', 0.14);
      g.beginPath(); g.moveTo(99.5, 65.5); g.lineTo(96.5, 61.5); g.lineTo(91, 62); g.lineTo(91.5, 65.5); g.closePath(); g.fill();
      // scotch
      g.globalAlpha = 0.5; g.fillStyle = '#f2e6c0'; g.fillRect(89.4, 65, 3.4, 14.5); g.globalAlpha = 1;
      pawPrint(g, 86.6, 73, 2.1, 'rgba(122,90,52,0.42)');
      // croquettes renversées
      g.fillStyle = '#b8894c';
      g.beginPath(); g.arc(84, 82, 1.4, 0, TAU); g.fill();
      g.beginPath(); g.arc(88, 83.6, 1.3, 0, TAU); g.fill();
      g.beginPath(); g.arc(92.5, 82.2, 1.4, 0, TAU); g.fill();
      g.beginPath(); g.arc(96, 84, 1.2, 0, TAU); g.fill();
    } else if (fac === 'birds') {
      // sac de graines dodu
      var sg = g.createLinearGradient(80, 0, 100, 0);
      sg.addColorStop(0, shade('#e6ddc4', 0.1)); sg.addColorStop(1, shade('#c4b894', -0.06));
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(82, 82);
      g.quadraticCurveTo(80, 68, 88, 64.5);
      g.quadraticCurveTo(90, 61.5, 92.5, 64.5);
      g.quadraticCurveTo(100.5, 68, 99.5, 82);
      g.quadraticCurveTo(90.5, 86, 82, 82);
      g.closePath(); g.fill();
      // pli + lien
      g.strokeStyle = 'rgba(90,72,48,0.4)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(85, 70); g.quadraticCurveTo(90, 73, 96.5, 70); g.stroke();
      g.strokeStyle = '#7a5c34'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(86.6, 65.2); g.lineTo(94, 64.4); g.stroke();
      // graines qui débordent
      g.fillStyle = '#e8c96a';
      g.beginPath(); g.arc(79.5, 84, 1.3, 0, TAU); g.fill();
      g.beginPath(); g.arc(76.6, 86, 1.15, 0, TAU); g.fill();
      g.beginPath(); g.arc(101.6, 84, 1.2, 0, TAU); g.fill();
      featherMark(g, 79, 77.5, 2.8, 'rgba(230,240,248,0.85)');
    } else {
      // caisse grise, couvercle de travers, corde encore fière
      var ng = g.createLinearGradient(83, 0, 100, 0);
      ng.addColorStop(0, shade(P.wall, 0.04)); ng.addColorStop(1, shade(P.wallSh, -0.05));
      g.fillStyle = ng; rr(g, 83, 67.5, 17, 12.5, 1.8); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(88.5, 68.5); g.lineTo(88.5, 79); g.stroke();
      g.beginPath(); g.moveTo(94.5, 68.5); g.lineTo(94.5, 79); g.stroke();
      g.save(); g.translate(91.5, 66.6); g.rotate(-0.12);
      g.fillStyle = shade(P.wall, 0.1); rr(g, -10, -2.2, 20, 4, 1.4); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(90,86,78,0.8)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(86, 67.5); g.lineTo(86, 80); g.stroke();
      g.fillStyle = 'rgba(122,160,90,0.55)';
      g.beginPath(); g.ellipse(98.5, 80.5, 3.6, 1.7, -0.15, 0, TAU); g.fill();
    }

    // ---- feu (animé) ou braises ----
    if (lit) {
      var s1 = Math.sin(PH * TAU * 2), s2 = Math.sin(PH * TAU * 3);
      // halo chaud qui respire
      var glow = g.createRadialGradient(68, 74, 2, 68, 74, 18);
      glow.addColorStop(0, 'rgba(255,180,80,' + (0.28 + 0.05 * s2).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(68, 74, 18, 0, TAU); g.fill();
      // flamme principale
      g.fillStyle = '#f08c42';
      g.beginPath();
      g.moveTo(61.5, 79);
      g.quadraticCurveTo(59.5 + s1, 68, 68 + s1 * 2.4, 60.5 - s2 * 2.5);
      g.quadraticCurveTo(76.5 - s1, 68, 74.5, 79);
      g.quadraticCurveTo(68, 82, 61.5, 79);
      g.closePath(); g.fill();
      // cœur clair
      g.fillStyle = '#f4c542';
      g.beginPath();
      g.moveTo(64.2, 79);
      g.quadraticCurveTo(63 + s1, 71, 68 + s1 * 2.8, 66 - s2 * 2);
      g.quadraticCurveTo(73 - s1, 71, 71.8, 79);
      g.quadraticCurveTo(68, 80.6, 64.2, 79);
      g.closePath(); g.fill();
      // petite langue latérale
      g.fillStyle = 'rgba(240,140,66,0.85)';
      g.beginPath();
      g.moveTo(74, 78.5);
      g.quadraticCurveTo(78 - s1, 72.5, 76.5 - s1 * 1.5, 68.5 + s2);
      g.quadraticCurveTo(79.2, 74.5, 77.6, 78.5);
      g.closePath(); g.fill();
      // deux ronds de fumée en cycle
      for (var ri = 0; ri < 2; ri++) {
        var c = (PH + ri * 0.5) % 1;
        var al = Math.sin(c * Math.PI) * 0.28;
        var rrad = 3 + c * 4.5;
        g.strokeStyle = 'rgba(225,228,232,' + al.toFixed(3) + ')';
        g.lineWidth = 2.4;
        g.beginPath();
        g.ellipse(68 + Math.sin(c * TAU) * 3, 63 - c * 33, rrad, rrad * 0.55, 0, 0, TAU);
        g.stroke();
      }
    } else {
      // braises grises, feu éteint mais rangé
      var coals = [[64,78.5,3],[70,79.6,3.4],[74.4,77.4,2.6],[66.8,76.4,2.4]];
      for (var ci = 0; ci < coals.length; ci++) {
        g.fillStyle = '#6e6a62';
        g.beginPath(); g.ellipse(coals[ci][0], coals[ci][1], coals[ci][2], coals[ci][2] * 0.7, 0, 0, TAU); g.fill();
        g.fillStyle = '#8a8478';
        g.beginPath(); g.ellipse(coals[ci][0] - 0.7, coals[ci][1] - 0.8, coals[ci][2] * 0.5, coals[ci][2] * 0.32, 0, 0, TAU); g.fill();
      }
      // très léger filet de fumée résiduelle
      for (var wi = 0; wi < 2; wi++) {
        var cw = (PH + wi * 0.5) % 1;
        var alw = Math.sin(cw * Math.PI) * 0.12;
        g.strokeStyle = 'rgba(210,212,216,' + alw.toFixed(3) + ')';
        g.lineWidth = 1.6;
        g.beginPath();
        g.ellipse(68.5 + Math.sin(cw * TAU) * 2, 70 - cw * 26, 1.8 + cw * 2.4, (1.8 + cw * 2.4) * 0.5, 0, 0, TAU);
        g.stroke();
      }
    }
  }

  // ============================================================
  // 3a) GUÉRITE chats — tonneau-griffoir à hublot
  // ============================================================
  function drawGueriteCats(g, animT) {
    var P = PAL.cats;
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 32, 9.5, 0.24);

    function barrelPath() {
      g.beginPath();
      g.moveTo(39, 42);
      g.quadraticCurveTo(30, 63, 39, 83);
      g.quadraticCurveTo(56, 88, 73, 83);
      g.quadraticCurveTo(82, 63, 73, 42);
      g.quadraticCurveTo(56, 37.5, 39, 42);
      g.closePath();
    }
    // corps du tonneau
    var bg = g.createLinearGradient(34, 0, 80, 0);
    bg.addColorStop(0, shade('#8a6a44', 0.3));
    bg.addColorStop(0.45, '#8a6a44');
    bg.addColorStop(1, shade('#8a6a44', -0.3));
    g.fillStyle = bg; barrelPath(); g.fill();
    // douves
    g.strokeStyle = 'rgba(60,42,22,0.35)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(46.5, 40.5); g.quadraticCurveTo(41.5, 62, 46.5, 84.5); g.stroke();
    g.beginPath(); g.moveTo(65.5, 40.5); g.quadraticCurveTo(70.5, 62, 65.5, 84.5); g.stroke();
    // cerclages
    g.strokeStyle = '#54402a'; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(38.4, 44.2); g.quadraticCurveTo(56, 48.4, 73.6, 44.2); g.stroke();
    g.beginPath(); g.moveTo(38.2, 80.2); g.quadraticCurveTo(56, 84.6, 73.8, 80.2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(39, 43); g.quadraticCurveTo(56, 47.2, 73, 43); g.stroke();
    g.beginPath(); g.moveTo(38.8, 79); g.quadraticCurveTo(56, 83.4, 73.2, 79); g.stroke();
    // bande sisal griffoir (bas) + griffures
    g.save(); barrelPath(); g.clip();
    g.fillStyle = '#c9a86a'; g.fillRect(30, 68, 52, 10.5);
    g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 1.2;
    for (var x2 = 33; x2 < 80; x2 += 5) {
      g.beginPath(); g.moveTo(x2, 78.2); g.lineTo(x2 + 3.6, 68.2); g.stroke();
    }
    g.strokeStyle = 'rgba(70,46,20,0.6)'; g.lineWidth = 1.3;
    for (var d4 = -3; d4 <= 3; d4 += 3) {
      g.beginPath(); g.moveTo(59.6 + d4, 69.2); g.lineTo(61.8 + d4, 77.4); g.stroke();
    }
    g.restore();
    // couvercle bombé
    g.fillStyle = '#6e5434';
    g.beginPath(); g.ellipse(56, 40.5, 17.4, 4.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#8a6a44';
    g.beginPath(); g.ellipse(56, 39.8, 15, 3.4, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(56, 39.6, 11, 2.2, 0, Math.PI * 1.05, Math.PI * 1.8); g.stroke();
    // petit fanion de service
    pole(g, 56, 38, 56, 27.5, 1.8, '#6e5a40', null);
    g.fillStyle = P.flag;
    g.beginPath(); g.moveTo(57, 27.8); g.lineTo(65.5, 30.2); g.lineTo(57, 32.6); g.closePath(); g.fill();

    // hublot
    g.fillStyle = '#54402a';
    g.beginPath(); g.arc(56, 57.5, 9.8, 0, TAU); g.fill();
    var hg = g.createRadialGradient(53, 54.5, 1, 56, 57.5, 8.8);
    hg.addColorStop(0, '#3a2c1e'); hg.addColorStop(1, '#150f08');
    g.fillStyle = hg;
    g.beginPath(); g.arc(56, 57.5, 8.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(56, 57.5, 7.6, Math.PI * 1.1, Math.PI * 1.55); g.stroke();

    // OREILLES (anim) : la sentinelle jette un œil par le hublot
    var rise = Math.max(0, Math.sin(PH * TAU));
    if (rise > 0.01) {
      g.save();
      g.beginPath(); g.arc(56, 57.5, 8.6, 0, TAU); g.clip();
      var hy = 75.5 - rise * 16;
      g.fillStyle = '#3a2a1c';
      g.beginPath(); g.arc(56, hy, 6.6, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(51.6, hy - 3.2); g.lineTo(49.8, hy - 10.5); g.lineTo(55.2, hy - 5.8); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(60.4, hy - 3.2); g.lineTo(62.2, hy - 10.5); g.lineTo(56.8, hy - 5.8); g.closePath(); g.fill();
      var ey = Math.max(0, (rise - 0.55) * 2.2);
      if (ey > 0) {
        g.fillStyle = 'rgba(244,197,66,' + Math.min(1, ey).toFixed(3) + ')';
        g.beginPath(); g.arc(53.4, hy - 1.2, 1.15, 0, TAU); g.fill();
        g.beginPath(); g.arc(58.6, hy - 1.2, 1.15, 0, TAU); g.fill();
      }
      g.restore();
    }

    // auvent rayé au-dessus du hublot
    function awningPath() {
      g.beginPath();
      g.moveTo(43, 44.5);
      g.quadraticCurveTo(56, 40.5, 69, 44.5);
      g.lineTo(70.5, 46.8);
      for (var sx = 70.5; sx > 45; sx -= 6.6) g.quadraticCurveTo(sx - 3.3, 49.3, sx - 6.6, 46.8);
      g.closePath();
    }
    var ag = g.createLinearGradient(0, 40, 0, 50);
    ag.addColorStop(0, shade(P.roof, 0.2)); ag.addColorStop(1, shade(P.roof, -0.12));
    g.fillStyle = ag; awningPath(); g.fill();
    g.save(); awningPath(); g.clip();
    g.fillStyle = P.roofSh; g.globalAlpha = 0.5;
    g.fillRect(46, 39, 4.4, 12); g.fillRect(55, 39, 4.4, 12); g.fillRect(64, 39, 4.4, 12);
    g.globalAlpha = 1; g.restore();
    g.strokeStyle = shade(P.roofSh, -0.1); g.lineWidth = 1; g.globalAlpha = 0.5;
    awningPath(); g.stroke(); g.globalAlpha = 1;

    // pelote de garde + empreinte
    g.fillStyle = P.accent;
    g.beginPath(); g.arc(86, 82.5, 5.2, 0, TAU); g.fill();
    g.strokeStyle = shade(P.accent, -0.35); g.lineWidth = 1.1;
    g.beginPath(); g.arc(86, 82.5, 3.5, 0.6, 2.8); g.stroke();
    g.beginPath(); g.arc(86, 82.5, 1.9, 3.4, 5.6); g.stroke();
    g.beginPath(); g.moveTo(81, 84.5); g.quadraticCurveTo(75, 87, 70, 85); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.beginPath(); g.arc(84.4, 80.8, 1.7, 0, TAU); g.fill();
    pawPrint(g, 30, 85.5, 2.2, 'rgba(110,85,55,0.42)');
  }

  // ============================================================
  // 3b) GUÉRITE oiseaux — nichoir de guet sur échasses
  // ============================================================
  function drawGueriteBirds(g, animT) {
    var P = PAL.birds;
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 30, 9, 0.22);

    // échasses + croisillon
    pole(g, 46, 82, 66, 58, 2.2, '#54402a', null);
    pole(g, 66, 82, 46, 58, 2.2, shade('#54402a', 0.16), null);
    pole(g, 45, 87, 48, 54, 3.6, '#6e5434', '#c9a86a');
    pole(g, 67, 87, 64, 54, 3.6, '#6e5434', '#c9a86a');

    // corps du nichoir
    var wg = g.createLinearGradient(38, 0, 74, 0);
    wg.addColorStop(0, shade(P.wall, 0.12));
    wg.addColorStop(1, shade(P.wallSh, -0.04));
    g.fillStyle = wg; rr(g, 38, 30, 36, 26, 4.5); g.fill();
    // planches
    g.strokeStyle = 'rgba(70,90,105,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(39.5, 37); g.lineTo(72.5, 37); g.stroke();
    g.beginPath(); g.moveTo(39.5, 44); g.lineTo(72.5, 44); g.stroke();
    g.beginPath(); g.moveTo(39.5, 51); g.lineTo(72.5, 51); g.stroke();
    // ombre portée du toit
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(38.5, 31, 35, 3);

    // toit à deux pentes
    var rg = g.createLinearGradient(0, 19, 0, 33);
    rg.addColorStop(0, shade(P.roof, 0.24));
    rg.addColorStop(1, P.roofSh);
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(33, 32.5); g.lineTo(56, 19.5); g.lineTo(79, 32.5);
    g.lineTo(76.5, 34.5); g.lineTo(56, 23); g.lineTo(35.5, 34.5);
    g.closePath(); g.fill();
    g.fillStyle = shade(P.roof, -0.05);
    g.beginPath(); g.moveTo(35.5, 34.5); g.lineTo(56, 23); g.lineTo(76.5, 34.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(53.5, 21.8); g.lineTo(36, 31.6); g.stroke();

    // grand trou d'observation
    g.fillStyle = shade(P.wallSh, -0.14);
    g.beginPath(); g.arc(56, 43, 9.6, 0, TAU); g.fill();
    var hg2 = g.createRadialGradient(53.5, 40.5, 1, 56, 43, 8.6);
    hg2.addColorStop(0, '#2a3640'); hg2.addColorStop(1, '#0c1116');
    g.fillStyle = hg2;
    g.beginPath(); g.arc(56, 43, 8.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.1;
    g.beginPath(); g.arc(56, 43, 7.7, Math.PI * 1.1, Math.PI * 1.55); g.stroke();

    // ŒIL (anim) : apparaît dans le trou puis cligne
    var vis = Math.max(0, Math.sin(PH * TAU));
    if (vis > 0.02) {
      var blink = Math.pow(Math.max(0, -Math.sin(PH * TAU * 2)), 14);
      var op = Math.min(1, vis * 2.2);
      var sy = Math.max(0.06, 1 - blink);
      g.save();
      g.beginPath(); g.arc(56, 43, 8.6, 0, TAU); g.clip();
      g.translate(56, 43.5); g.scale(1, sy);
      g.globalAlpha = op;
      g.fillStyle = '#f6f2e6';
      g.beginPath(); g.arc(0, 0, 5.6, 0, TAU); g.fill();
      g.fillStyle = '#f4a83c';
      g.beginPath(); g.arc(0.3, 0.2, 3.9, 0, TAU); g.fill();
      g.fillStyle = '#1c1410';
      g.beginPath(); g.arc(0.4, 0.3, 2.1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(-1.2, -1.4, 1.1, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.restore();
    }

    // perchoir + brindilles du rebord
    twig(g, 56, 51.5, 64, 56.5, 2.2, '#54402a');
    var tw2 = [[39,55.4,47,53.8],[46,54,54,55.8],[53,55.6,61,53.8],[60,54,68,55.6],[66,55.4,73,54]];
    for (var ti2 = 0; ti2 < tw2.length; ti2++) {
      twig(g, tw2[ti2][0], tw2[ti2][1], tw2[ti2][2], tw2[ti2][3], 1.4, ti2 % 2 ? '#8a6a3c' : '#c9a06a');
    }
    // plume peinte + graines au sol
    featherMark(g, 68, 35.5, 2.8, 'rgba(58,134,255,0.5)');
    g.fillStyle = '#e8c96a';
    g.beginPath(); g.arc(50, 87.6, 1.3, 0, TAU); g.fill();
    g.beginPath(); g.arc(54.5, 86, 1.15, 0, TAU); g.fill();
    g.beginPath(); g.arc(61, 87.4, 1.25, 0, TAU); g.fill();
  }

  // ============================================================
  // 3c) GUÉRITE neutre — cabane à outils penchée, lanterne
  // ============================================================
  function drawGueriteNeutre(g, animT) {
    var P = PAL.neutre;
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 32, 9.5, 0.24);

    g.save();
    g.translate(56, 86); g.rotate(-0.05); g.translate(-56, -86);
    // murs de planches grises
    var wg = g.createLinearGradient(36, 0, 76, 0);
    wg.addColorStop(0, shade(P.wall, 0.1));
    wg.addColorStop(1, shade(P.wallSh, -0.06));
    g.fillStyle = wg;
    g.beginPath();
    g.moveTo(36, 46); g.lineTo(75, 52); g.lineTo(76, 84);
    g.quadraticCurveTo(56, 87, 36, 84);
    g.closePath(); g.fill();
    // lignes de planches (suivent la pente)
    g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(44, 47.4); g.lineTo(44, 84.6); g.stroke();
    g.beginPath(); g.moveTo(53, 48.8); g.lineTo(53, 85.4); g.stroke();
    g.beginPath(); g.moveTo(70, 51.4); g.lineTo(70, 85); g.stroke();
    // planche légèrement disjointe (élégamment)
    g.save(); g.translate(64, 68); g.rotate(0.06);
    g.fillStyle = 'rgba(30,28,26,0.28)'; g.fillRect(-1.4, -17, 2.8, 34);
    g.restore();
    // fissure élégante
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(40.5, 56); g.lineTo(39, 64); g.lineTo(41.5, 70); g.stroke();

    // porte entrouverte
    g.fillStyle = 'rgba(26,25,23,0.82)'; rr(g, 45, 58, 14, 26, 2); g.fill();
    g.save(); g.translate(45.5, 58.5); g.rotate(0.12);
    var dg = g.createLinearGradient(-9, 0, 1, 0);
    dg.addColorStop(0, shade(P.wall, 0.05)); dg.addColorStop(1, shade(P.wallSh, 0.02));
    g.fillStyle = dg; rr(g, -9.5, 0, 10, 24.5, 1.5); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-4.6, 1.5); g.lineTo(-4.6, 23.5); g.stroke();
    g.fillStyle = P.door;
    g.beginPath(); g.arc(-2, 12.5, 1.2, 0, TAU); g.fill();
    g.restore();

    // fenêtre carrée au carreau fendu
    g.fillStyle = 'rgba(30,32,36,0.75)'; rr(g, 62.5, 61.5, 9, 8.5, 1.2); g.fill();
    g.strokeStyle = shade(P.wallSh, -0.12); g.lineWidth = 1.4;
    rr(g, 62.5, 61.5, 9, 8.5, 1.2); g.stroke();
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(67, 62); g.lineTo(67, 69.6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.moveTo(63.5, 64.5); g.lineTo(66, 68); g.lineTo(65, 69.5); g.stroke();

    // toit monopente débordant
    var rg = g.createLinearGradient(0, 39, 0, 56);
    rg.addColorStop(0, shade(P.roof, 0.16));
    rg.addColorStop(1, shade(P.roofSh, -0.05));
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(29, 42); g.lineTo(82, 50); g.lineTo(81, 56); g.lineTo(28, 48);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(30, 43.2); g.lineTo(80, 50.8); g.stroke();
    // mousse douillette sur le toit
    g.fillStyle = 'rgba(122,160,90,0.55)';
    g.beginPath(); g.ellipse(44, 45.6, 4.6, 1.9, 0.15, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(59, 48.6, 3.4, 1.5, 0.15, 0, TAU); g.fill();

    // balai appuyé contre le mur gauche
    pole(g, 30, 85, 36.5, 52, 2, '#7c776c', null);
    g.strokeStyle = '#b0a687'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(31.6, 79); g.lineTo(27, 87.2); g.stroke();
    g.beginPath(); g.moveTo(31.9, 79.3); g.lineTo(29.4, 87.8); g.stroke();
    g.beginPath(); g.moveTo(32.2, 79.5); g.lineTo(31.8, 88); g.stroke();
    g.beginPath(); g.moveTo(32.4, 79.3); g.lineTo(34.2, 87.6); g.stroke();
    g.strokeStyle = 'rgba(90,86,78,0.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(30.6, 79); g.lineTo(33.6, 79.8); g.stroke();
    g.restore();

    // LANTERNE (anim) accrochée à l'avant-toit
    g.strokeStyle = '#5f5b52'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(79, 51.4, 1.8, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
    g.save();
    g.translate(79, 52);
    g.rotate(0.15 * Math.sin(PH * TAU));
    g.strokeStyle = '#5f5b52'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 4.6); g.stroke();
    // halo tiède
    var lg2 = g.createRadialGradient(0, 10.5, 1, 0, 10.5, 9.5);
    lg2.addColorStop(0, 'rgba(244,197,66,0.28)');
    lg2.addColorStop(1, 'rgba(244,197,66,0)');
    g.fillStyle = lg2;
    g.beginPath(); g.arc(0, 10.5, 9.5, 0, TAU); g.fill();
    // corps + vitre
    g.fillStyle = '#6e6a62'; rr(g, -4, 5, 8, 10.5, 2.5); g.fill();
    g.fillStyle = '#f4c542'; rr(g, -2.6, 6.8, 5.2, 7, 1.5); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.arc(-1, 8.6, 1.1, 0, TAU); g.fill();
    g.fillStyle = '#5f5b52'; rr(g, -4.8, 3.4, 9.6, 2.6, 1.2); g.fill();
    g.restore();

    // pied du bâtiment : mousse, caillou, touffe d'herbe
    g.fillStyle = 'rgba(122,160,90,0.55)';
    g.beginPath(); g.ellipse(41, 86.5, 5, 2.1, 0.2, 0, TAU); g.fill();
    g.fillStyle = '#a8a296';
    g.beginPath(); g.ellipse(27, 86.5, 3.2, 2.2, 0, 0, TAU); g.fill();
    g.fillStyle = '#8a8478';
    g.beginPath(); g.ellipse(26.2, 87.2, 1.6, 1, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(110,150,84,0.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(72, 87.5); g.quadraticCurveTo(72.5, 84, 71.4, 82); g.stroke();
    g.beginPath(); g.moveTo(74, 87.5); g.quadraticCurveTo(75.4, 84.5, 76.6, 83); g.stroke();
  }

  // ------------------------------------------------------------
  // Enregistrement des variantes
  // ------------------------------------------------------------
  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  reg('avantposte_cats', { id: 'mirador', label: 'Mirador', anim: 'la longue-vue pivote lentement',
    draw: function (g, animT) { drawMirador(g, animT, 'cats'); } });
  reg('avantposte_birds', { id: 'mirador', label: 'Mirador', anim: 'la longue-vue pivote lentement',
    draw: function (g, animT) { drawMirador(g, animT, 'birds'); } });
  reg('avantposte_neutre', { id: 'mirador', label: 'Mirador', anim: 'la longue-vue pivote lentement',
    draw: function (g, animT) { drawMirador(g, animT, 'neutre'); } });

  reg('avantposte_cats', { id: 'campement', label: 'Campement', anim: 'flammes et ronds de fumée',
    draw: function (g, animT) { drawCampement(g, animT, 'cats'); } });
  reg('avantposte_birds', { id: 'campement', label: 'Campement', anim: 'flammes et ronds de fumée',
    draw: function (g, animT) { drawCampement(g, animT, 'birds'); } });
  reg('avantposte_neutre', { id: 'campement', label: 'Campement', anim: 'mince filet de fumée résiduelle',
    draw: function (g, animT) { drawCampement(g, animT, 'neutre'); } });

  reg('avantposte_cats', { id: 'guerite', label: 'Guérite', anim: 'des oreilles surgissent au hublot',
    draw: function (g, animT) { drawGueriteCats(g, animT); } });
  reg('avantposte_birds', { id: 'guerite', label: 'Guérite', anim: 'un œil apparaît et cligne',
    draw: function (g, animT) { drawGueriteBirds(g, animT); } });
  reg('avantposte_neutre', { id: 'guerite', label: 'Guérite', anim: 'la lanterne oscille doucement',
    draw: function (g, animT) { drawGueriteNeutre(g, animT); } });
})();
