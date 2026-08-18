/* ============================================================
   LAB — casernes.js
   Variantes de CASERNES (production) pour oiseaux et neutre.
   3 concepts : grange-volière, nid-manufacture, halle des recrues.
   Style peint doux "jelly/goofy", canvas 112x112, anim boucle 3.2 s.
   ============================================================ */
"use strict";
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers locaux (self-contained) ----------
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

  // palettes faction (nodePal du jeu)
  var PB = { wall:'#e6f1f8', wallSh:'#bcd6e6', roof:'#48a9d8', roofSh:'#2f7ea8', accent:'#3a86ff', flag:'#48a9d8', door:'#4a6a80' };
  var PN = { wall:'#d8d5ce', wallSh:'#b2aea6', roof:'#a8a49c', roofSh:'#847f76', accent:'#98948c', flag:'#b0aca4', door:'#6e6a62' };

  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  /* ============================================================
     1. GRANGE-VOLIÈRE
     Oiseaux : grange 2 niveaux en planches bleutées, toit à double
     pente, 3 trous d'envol + perchoirs, sac de graines, échelle.
     Anim : un oisillon sort du trou central, regarde, rentre.
     Neutre : même grange grise, volets clos, porte condamnée,
     panneau "à vendre" pendu qui oscille.
     ============================================================ */
  function drawGrange(g, N, animT) {
    var PH = (animT % 3.2) / 3.2;
    var P = N ? PN : PB;
    softShadow(g, 56, 88, 34, 10, 0.24);

    // ---- corps : deux niveaux de planches ----
    var wg = g.createLinearGradient(34, 0, 78, 0);
    wg.addColorStop(0, shade(P.wallSh, .20));
    wg.addColorStop(.55, P.wallSh);
    wg.addColorStop(1, shade(P.wallSh, -.16));
    g.fillStyle = wg; rr(g, 34, 44, 44, 42, 3); g.fill();
    // lignes de planches (fines, pas de noir dur)
    g.strokeStyle = N ? 'rgba(40,40,44,0.16)' : 'rgba(40,70,95,0.18)';
    g.lineWidth = 1;
    var yy, py = [49, 55, 68, 74, 80];
    for (var pi = 0; pi < py.length; pi++) {
      yy = py[pi];
      g.beginPath(); g.moveTo(36, yy); g.lineTo(76, yy); g.stroke();
    }
    g.globalAlpha = .5;
    g.beginPath(); g.moveTo(49, 68.5); g.lineTo(49, 80); g.stroke();
    g.beginPath(); g.moveTo(65, 68); g.lineTo(65, 74); g.stroke();
    g.globalAlpha = 1;
    // montants d'angle
    g.fillStyle = shade(P.wallSh, -.14);
    rr(g, 34, 44, 4, 42, 2); g.fill();
    rr(g, 74, 44, 4, 42, 2); g.fill();
    // bandeau entre les deux niveaux
    g.fillStyle = shade(P.wallSh, -.24);
    rr(g, 32, 60, 48, 4, 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    rr(g, 32, 60, 48, 1.4, 1); g.fill();

    // ---- trous d'envol (niveau haut) + perchoirs ----
    var holes = [44, 56, 68], hxx, hi;
    for (hi = 0; hi < 3; hi++) {
      hxx = holes[hi];
      g.fillStyle = N ? '#3a3a40' : '#26323e';
      g.beginPath(); g.arc(hxx, 52, 4.2, 0, TAU); g.fill();
      g.strokeStyle = N ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.35)';
      g.lineWidth = 1.6;
      g.beginPath(); g.arc(hxx, 52, 4.6, 0, TAU); g.stroke();
      if (!N) twig(g, hxx, 56.6, hxx + (hxx < 56 ? -5.5 : 5.5), 59.5, 2, '#54402a');
    }

    if (!N) {
      // ---- ANIM : oisillon qui sort du trou central, regarde, rentre ----
      var p = Math.max(0, Math.sin(PH * TAU));
      var pop = p * p * (3 - 2 * p);           // sortie douce avec pause en bas
      var look = Math.sin(PH * TAU * 3) * pop; // petit regard gauche/droite
      g.save();
      g.beginPath(); g.arc(56, 52, 4.0, 0, TAU); g.clip();
      var hy = 61 - pop * 9.5;
      g.fillStyle = '#f4d35e';
      g.beginPath(); g.arc(56 + look * 1.1, hy, 3.8, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.beginPath(); g.arc(54.8 + look * 1.1, hy - 1.6, 1.4, 0, TAU); g.fill();
      // houppette
      twig(g, 56 + look * 1.1, hy - 3.6, 55 + look * 1.1, hy - 5.4, 1, '#d9a83c');
      // yeux + bec
      g.fillStyle = '#2c2418';
      g.beginPath(); g.arc(54.6 + look * 1.7, hy - .8, .7, 0, TAU); g.fill();
      g.beginPath(); g.arc(57.4 + look * 1.7, hy - .8, .7, 0, TAU); g.fill();
      g.fillStyle = '#e8843c';
      g.beginPath();
      g.moveTo(55 + look * 1.7, hy + .5); g.lineTo(57 + look * 1.7, hy + .5);
      g.lineTo(56 + look * 1.7, hy + 2); g.closePath(); g.fill();
      g.restore();
    } else {
      // volets cloués sur les trous
      for (hi = 0; hi < 3; hi++) {
        hxx = holes[hi];
        g.fillStyle = '#9a968c';
        rr(g, hxx - 4.6, 47.6, 9.2, 8.8, 1.5); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(hxx - 4, 52); g.lineTo(hxx + 4, 52); g.stroke();
        g.fillStyle = 'rgba(60,56,50,0.6)';
        g.beginPath(); g.arc(hxx - 2.6, 49.8, .8, 0, TAU); g.fill();
        g.beginPath(); g.arc(hxx + 2.6, 54.2, .8, 0, TAU); g.fill();
      }
    }

    // ---- porte en arche + (neutre) planche clouée ----
    g.fillStyle = P.door;
    g.beginPath();
    g.moveTo(48, 85); g.lineTo(48, 73);
    g.arc(56, 73, 8, Math.PI, 0);
    g.lineTo(64, 85); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(50, 83); g.lineTo(50, 73);
    g.arc(56, 73, 6, Math.PI, Math.PI * 1.5); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.arc(60.5, 76.5, 1.1, 0, TAU); g.fill(); // poignée
    if (N) {
      g.save(); g.translate(56, 76); g.rotate(-.32);
      g.fillStyle = '#a8a49c'; rr(g, -13, -2.6, 26, 5.2, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.2)'; rr(g, -13, -2.6, 26, 1.6, 1.5); g.fill();
      g.fillStyle = 'rgba(60,56,50,0.7)';
      g.beginPath(); g.arc(-10, 0, .9, 0, TAU); g.fill();
      g.beginPath(); g.arc(10, 0, .9, 0, TAU); g.fill();
      g.restore();
    }

    // ---- pignon-toit à double pente (gambrel) ----
    var rg = g.createLinearGradient(0, 23, 0, 47);
    rg.addColorStop(0, shade(P.roof, .16));
    rg.addColorStop(1, shade(P.roof, -.20));
    g.fillStyle = rg;
    g.beginPath();
    g.moveTo(28, 47); g.lineTo(39, 31); g.lineTo(56, 23);
    g.lineTo(73, 31); g.lineTo(84, 47); g.closePath(); g.fill();
    // reflet haut-gauche
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.moveTo(39, 31); g.lineTo(56, 23); g.lineTo(56, 27); g.lineTo(42, 33.5);
    g.closePath(); g.fill();
    // arêtes du toit
    g.strokeStyle = shade(P.roofSh, -.05); g.lineWidth = 1.6; g.globalAlpha = .7;
    g.beginPath();
    g.moveTo(28, 47); g.lineTo(39, 31); g.lineTo(56, 23);
    g.lineTo(73, 31); g.lineTo(84, 47); g.stroke();
    g.globalAlpha = .35; g.lineWidth = 1;
    g.beginPath(); g.moveTo(33, 46); g.lineTo(41, 34.5); g.stroke();
    g.beginPath(); g.moveTo(79, 46); g.lineTo(71, 34.5); g.stroke();
    g.globalAlpha = 1;
    // lucarne à foin dans le pignon
    g.fillStyle = N ? '#33333a' : '#26323e';
    g.beginPath();
    g.moveTo(51.5, 39.5); g.lineTo(51.5, 34);
    g.arc(56, 34, 4.5, Math.PI, 0);
    g.lineTo(60.5, 39.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.2;
    g.beginPath(); g.arc(56, 34, 4.9, Math.PI, 0); g.stroke();
    g.beginPath(); g.moveTo(51.1, 34); g.lineTo(51.1, 39.5); g.moveTo(60.9, 34); g.lineTo(60.9, 39.5); g.stroke();

    if (!N) {
      // ---- sac de graines (gauche) ----
      var sg = g.createLinearGradient(17, 0, 35, 0);
      sg.addColorStop(0, shade('#c9a86a', .18)); sg.addColorStop(1, shade('#c9a86a', -.24));
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(20, 86); g.quadraticCurveTo(16.5, 73, 23, 68.5);
      g.quadraticCurveTo(25.5, 64.5, 28.5, 68.5);
      g.quadraticCurveTo(35, 72, 34, 80);
      g.quadraticCurveTo(33.6, 86.5, 26.5, 87);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,64,32,0.7)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(22.5, 67.6); g.quadraticCurveTo(25.6, 66.4, 28.8, 67.8); g.stroke(); // lien du col
      g.strokeStyle = 'rgba(90,64,32,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(21, 76); g.quadraticCurveTo(25, 78, 31, 76.5); g.stroke(); // couture
      g.fillStyle = '#e8c96a';
      var sd = [[34, 84.5], [38, 86.5], [36.5, 88.6], [41, 88]], si;
      for (si = 0; si < sd.length; si++) { g.beginPath(); g.arc(sd[si][0], sd[si][1], 1.2, 0, TAU); g.fill(); }
      // ---- échelle vers le niveau haut (droite) ----
      twig(g, 81, 85, 75, 60, 1.8, '#7a5c34');
      twig(g, 87, 84, 81, 59, 1.8, '#7a5c34');
      var u, li2;
      for (li2 = 0; li2 < 4; li2++) {
        u = .16 + li2 * .22;
        twig(g, 81 - 6 * u, 85 - 25 * u, 87 - 6 * u, 84 - 25 * u, 1.5, '#9a7444');
      }
      // plume près de la porte
      featherMark(g, 42, 80, 3, 'rgba(58,134,255,0.4)');
    } else {
      // ---- ANIM : panneau "à vendre" pendu à une potence, oscille ----
      twig(g, 34, 52, 21, 49.5, 2.4, '#6e6a62');
      g.fillStyle = '#847f76';
      g.beginPath(); g.arc(21, 49.5, 1.6, 0, TAU); g.fill();
      var sw = Math.sin(PH * TAU) * .11 + Math.sin(PH * TAU * 2) * .035;
      g.save(); g.translate(21, 49.5); g.rotate(sw);
      g.strokeStyle = 'rgba(70,66,58,0.85)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-4.5, 1); g.lineTo(-4.5, 7); g.stroke();
      g.beginPath(); g.moveTo(4.5, 1); g.lineTo(4.5, 7); g.stroke();
      var bg = g.createLinearGradient(0, 7, 0, 17.5);
      bg.addColorStop(0, shade('#b2aea6', .12)); bg.addColorStop(1, shade('#b2aea6', -.14));
      g.fillStyle = bg; rr(g, -8.5, 7, 17, 10.5, 2); g.fill();
      g.strokeStyle = 'rgba(60,56,50,0.5)'; g.lineWidth = 1;
      rr(g, -8.5, 7, 17, 10.5, 2); g.stroke();
      // gribouillis "à vendre" (illisible mais convaincant)
      g.strokeStyle = 'rgba(70,66,58,0.75)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-5.5, 10.5); g.quadraticCurveTo(0, 9.4, 5.5, 10.6); g.stroke();
      g.beginPath(); g.moveTo(-4.5, 14); g.quadraticCurveTo(0, 13, 4, 14.2); g.stroke();
      g.restore();
      // mousse au pied + fissure élégante
      g.fillStyle = 'rgba(122,160,90,0.6)';
      g.beginPath(); g.ellipse(70, 85, 6.5, 2.8, -.15, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(39, 86.5, 5, 2.2, .2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(70, 63); g.lineTo(67.5, 70); g.lineTo(70.5, 77); g.stroke();
    }
  }

  reg('production_birds', {
    id: 'grange-voliere', label: 'Grange-volière', anim: 'oisillon sort et regarde',
    draw: function (g, animT) { drawGrange(g, false, animT); }
  });
  reg('production_neutre', {
    id: 'grange-voliere', label: 'Grange-volière', anim: 'le panneau oscille',
    draw: function (g, animT) { drawGrange(g, true, animT); }
  });

  /* ============================================================
     2. NID-MANUFACTURE
     Oiseaux : grand nid tressé sur 3 pilotis, entonnoir à graines
     en écorce au-dessus, goulotte vers le nid.
     Anim : graines qui tombent de la goulotte (points en cycle).
     Neutre : structure vide grise, entonnoir cabossé.
     Anim : goutte d'eau qui tombe dans une flaque.
     ============================================================ */
  function drawNid(g, N, animT) {
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 34, 10, 0.24);
    var wood = N ? '#8a8478' : '#8a6a44';
    var woodD = N ? '#5e584e' : '#54402a';
    var woodL = N ? '#a8a49c' : '#a8845a';

    // ---- pilotis (3) + traverse ----
    twig(g, 38, 86, 45, 61, 4.5, wood);
    twig(g, 74, 86, 67, 61, 4.5, wood);
    twig(g, 56, 88, 56, 63, 4.5, woodD);
    twig(g, 42, 75, 70, 73, 2.4, woodD);
    if (N) { // pilotis fendu
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(40.5, 79); g.lineTo(42.5, 73); g.lineTo(41.5, 68); g.stroke();
    }
    // poteaux porteurs de l'entonnoir
    twig(g, 44, 62, 47, 27, 2.8, wood);
    twig(g, 68, 62, 65, 27, 2.8, wood);

    // ---- grand nid tressé ----
    var ng = g.createLinearGradient(0, 45, 0, 68);
    if (N) { ng.addColorStop(0, '#9a968c'); ng.addColorStop(1, '#6e6a62'); }
    else { ng.addColorStop(0, '#b08a54'); ng.addColorStop(1, '#7a5c34'); }
    g.fillStyle = ng;
    g.beginPath(); g.ellipse(56, 56, 25, 11, 0, 0, TAU); g.fill();
    g.fillStyle = N ? '#46443e' : '#4e3a20';
    g.beginPath(); g.ellipse(56, 53.5, 16, 5.5, 0, 0, TAU); g.fill();
    // brindilles du bord (positions fixes, déterministes)
    var RT = [[33, 53, 9, -3], [43, 48, 9, 2], [55, 45.5, 10, -2], [67, 48, 9, 3],
              [76, 54, 8, -2], [69, 63, 9, 2], [50, 65.5, 9, -3], [37, 61, 8, 2]];
    var ti;
    for (ti = 0; ti < RT.length; ti++) {
      var q = RT[ti];
      twig(g, q[0], q[1], q[0] + q[2], q[1] + q[3], 1.4,
        ti % 2 ? (N ? '#9a968c' : '#c9a06a') : (N ? '#7a766c' : '#8a6a3c'));
    }
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(56, 51.5, 20, 7, 0, Math.PI * 1.05, Math.PI * 1.75); g.stroke();

    // ---- entonnoir en écorce ----
    var fg = g.createLinearGradient(40, 0, 72, 0);
    if (N) { fg.addColorStop(0, shade('#9a968c', .16)); fg.addColorStop(.5, '#9a968c'); fg.addColorStop(1, shade('#9a968c', -.22)); }
    else { fg.addColorStop(0, shade('#b08a54', .18)); fg.addColorStop(.5, '#b08a54'); fg.addColorStop(1, shade('#b08a54', -.26)); }
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(40, 26); g.lineTo(72, 26); g.lineTo(61, 38.5); g.lineTo(51, 38.5);
    g.closePath(); g.fill();
    // stries d'écorce
    g.strokeStyle = N ? 'rgba(40,40,44,0.25)' : 'rgba(60,40,20,0.28)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(46, 27.5); g.lineTo(52.5, 37.5); g.stroke();
    g.beginPath(); g.moveTo(56, 27.5); g.lineTo(56, 37.5); g.stroke();
    g.beginPath(); g.moveTo(66, 27.5); g.lineTo(59.5, 37.5); g.stroke();
    // cerclage
    g.strokeStyle = N ? 'rgba(70,66,58,0.6)' : 'rgba(90,64,32,0.6)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(43.5, 30.5); g.quadraticCurveTo(56, 32.5, 68.5, 30.5); g.stroke();
    // col du haut
    g.fillStyle = N ? '#77736a' : '#5e4426';
    g.beginPath(); g.ellipse(56, 26, 16, 3.4, 0, 0, TAU); g.fill();
    g.fillStyle = N ? 'rgba(180,176,166,0.5)' : 'rgba(220,180,120,0.45)';
    g.beginPath(); g.ellipse(56, 25.4, 12.5, 2.1, 0, 0, TAU); g.fill();
    if (N) {
      // cabossé : bosse d'ombre + rustine cousue
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.beginPath(); g.ellipse(66, 30, 2.6, 4, .5, 0, TAU); g.fill();
      g.save(); g.translate(48, 32.5); g.rotate(-.25);
      g.fillStyle = '#b2aea6'; rr(g, -3.4, -2.8, 6.8, 5.6, 1.2); g.fill();
      g.strokeStyle = 'rgba(60,56,50,0.55)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(-3.4, -1); g.lineTo(-4.6, -1.8); g.moveTo(-3.4, 1.2); g.lineTo(-4.6, .6);
      g.moveTo(3.4, -1); g.lineTo(4.6, -1.8); g.moveTo(3.4, 1.2); g.lineTo(4.6, .6); g.stroke();
      g.restore();
    }
    // bec verseur + goulotte vers le nid
    g.fillStyle = woodD; rr(g, 52.5, 38.5, 7, 4.5, 2); g.fill();
    g.strokeStyle = wood; g.lineWidth = 4.6;
    g.beginPath(); g.moveTo(57.5, 43.5); g.lineTo(65.5, 47.5); g.stroke();
    g.strokeStyle = woodL; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(57.8, 43); g.lineTo(65.5, 46.9); g.stroke();
    g.fillStyle = woodD;
    g.beginPath(); g.ellipse(66.2, 47.8, 1.6, 2.2, .5, 0, TAU); g.fill();

    if (!N) {
      // ---- ANIM : graines qui tombent de la goulotte ----
      var i2, c, a;
      for (i2 = 0; i2 < 3; i2++) {
        c = ((PH * 2) + i2 / 3) % 1;
        a = Math.sin(c * Math.PI);
        g.globalAlpha = a * .95;
        g.fillStyle = i2 === 1 ? '#f4d35e' : '#e8c96a';
        g.beginPath(); g.arc(66 + (i2 - 1) * 1.6, 48.5 + c * 8, 1.25, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      // tas de graines dans le nid + œuf couvé
      g.fillStyle = '#e8c96a';
      g.beginPath(); g.ellipse(65.5, 55, 4.6, 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#d9a83c';
      g.beginPath(); g.arc(63.5, 54.4, .9, 0, TAU); g.fill();
      g.beginPath(); g.arc(67.5, 55.6, .9, 0, TAU); g.fill();
      g.fillStyle = '#f2ead2';
      g.beginPath(); g.ellipse(47, 52.5, 3.4, 4.2, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(140,120,80,0.5)';
      g.beginPath(); g.arc(46, 53.5, .8, 0, TAU); g.fill();
      g.beginPath(); g.arc(48.2, 51.2, .6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.beginPath(); g.ellipse(45.9, 50.6, 1.1, 1.5, .4, 0, TAU); g.fill();
      // plume plantée dans le bord du nid
      featherMark(g, 36, 50, 3.4, 'rgba(58,134,255,0.5)');
      // graines tombées au sol
      g.fillStyle = '#e8c96a';
      g.beginPath(); g.arc(44, 87, 1.1, 0, TAU); g.fill();
      g.beginPath(); g.arc(49, 88.6, 1.1, 0, TAU); g.fill();
    } else {
      // ---- ANIM : goutte d'eau qui tombe dans une flaque ----
      var c2 = (PH * 2) % 1;
      var a2 = Math.sin(c2 * Math.PI);
      g.fillStyle = 'rgba(150,190,215,' + (a2 * .9).toFixed(3) + ')';
      g.beginPath();
      g.ellipse(56, 44.5 + c2 * 11, 1.05, 1.6 + c2 * .8, 0, 0, TAU); g.fill();
      // flaque + rond dans l'eau (repart quand la goutte touche)
      g.fillStyle = 'rgba(130,160,180,0.45)';
      g.beginPath(); g.ellipse(56, 57, 5, 1.8, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,225,240,' + (Math.min(1, c2 * 6) * (1 - c2) * .5).toFixed(3) + ')';
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(56, 57, 1.5 + c2 * 3.4, .6 + c2 * 1.2, 0, 0, TAU); g.stroke();
      // mousse sur le bord du nid + fil d'araignée
      g.fillStyle = 'rgba(122,160,90,0.55)';
      g.beginPath(); g.ellipse(40, 61, 5, 2.2, .3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(71, 59.5, 4, 1.8, -.25, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(66.5, 29); g.quadraticCurveTo(70, 40, 68.5, 51); g.stroke();
    }
  }

  reg('production_birds', {
    id: 'nid-manufacture', label: 'Nid-manufacture', anim: 'graines tombent en cycle',
    draw: function (g, animT) { drawNid(g, false, animT); }
  });
  reg('production_neutre', {
    id: 'nid-manufacture', label: 'Nid-manufacture', anim: 'goutte d’eau qui tombe',
    draw: function (g, animT) { drawNid(g, true, animT); }
  });

  /* ============================================================
     3. HALLE DES RECRUES
     Oiseaux : grande tente-halle rayée bleue ouverte sur un côté,
     enseigne œuf suspendue, 3 œufs alignés sur des coussinets.
     Anim : l'enseigne se balance.
     Neutre : halle grise rapiécée, enseigne vide.
     Anim : un pan de toile frémit.
     ============================================================ */
  function drawHalle(g, N, animT) {
    var PH = (animT % 3.2) / 3.2;
    var P = N ? PN : PB;
    softShadow(g, 56, 88, 36, 10, 0.24);

    // ---- sol de la halle ----
    g.fillStyle = N ? '#8f8b82' : '#c9b892';
    g.beginPath(); g.ellipse(56, 84, 25, 4.5, 0, 0, TAU); g.fill();

    // ---- intérieur sombre (côté ouvert) ----
    var ig = g.createLinearGradient(0, 56, 0, 84);
    ig.addColorStop(0, 'rgba(30,26,34,0.94)');
    ig.addColorStop(1, 'rgba(56,50,54,0.72)');
    g.fillStyle = ig;
    g.beginPath();
    g.moveTo(33, 57); g.lineTo(79, 57); g.lineTo(77, 82.5);
    g.quadraticCurveTo(56, 86.5, 35, 82.5); g.closePath(); g.fill();
    // poteau central + caisse, devinés dans la pénombre
    g.fillStyle = 'rgba(140,110,70,0.4)'; rr(g, 54.4, 58, 3.2, 25, 1.4); g.fill();
    g.fillStyle = 'rgba(150,130,95,0.28)'; rr(g, 39, 71, 10, 9.5, 1.5); g.fill();
    if (!N) { g.strokeStyle = 'rgba(200,180,140,0.3)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(63, 66); g.lineTo(73, 65); g.stroke(); } // perchoir intérieur

    // ---- toit-tente rayé ----
    g.save();
    g.beginPath();
    g.moveTo(26, 56); g.lineTo(36, 30); g.lineTo(76, 30); g.lineTo(86, 56);
    g.closePath(); g.clip();
    var stripeA = N ? '#a8a49c' : P.roof;
    var stripeB = N ? '#c6c2ba' : '#e9f4fa';
    var sx, k = 0;
    for (sx = 22; sx < 90; sx += 9, k++) {
      g.fillStyle = k % 2 ? stripeB : stripeA;
      g.fillRect(sx, 28, 9, 30);
    }
    var rgd = g.createLinearGradient(0, 30, 0, 56);
    rgd.addColorStop(0, 'rgba(255,255,255,0.22)');
    rgd.addColorStop(.45, 'rgba(255,255,255,0)');
    rgd.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = rgd; g.fillRect(22, 28, 68, 30);
    if (N) {
      // rustines cousues
      g.save(); g.translate(47, 40); g.rotate(.18);
      g.fillStyle = '#c4c0b8'; rr(g, -4.5, -3.8, 9, 7.6, 1.6); g.fill();
      g.strokeStyle = 'rgba(70,66,58,0.55)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(-4.5, -1.4); g.lineTo(-6, -2.2); g.moveTo(-4.5, 1.6); g.lineTo(-6, 1);
      g.moveTo(4.5, -1.4); g.lineTo(6, -2.2); g.moveTo(4.5, 1.6); g.lineTo(6, 1); g.stroke();
      g.restore();
      g.save(); g.translate(66, 47); g.rotate(-.14);
      g.fillStyle = '#94908a'; rr(g, -4, -3.2, 8, 6.4, 1.4); g.fill();
      g.strokeStyle = 'rgba(70,66,58,0.5)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(-4, 0); g.lineTo(-5.4, -.6); g.moveTo(4, 0); g.lineTo(5.4, -.6); g.stroke();
      g.restore();
    }
    g.restore();
    // contour doux du toit
    g.strokeStyle = shade(P.roofSh, -.05); g.lineWidth = 1.4; g.globalAlpha = .6;
    g.beginPath();
    g.moveTo(26, 56); g.lineTo(36, 30); g.lineTo(76, 30); g.lineTo(86, 56); g.stroke();
    g.globalAlpha = 1;
    // faîtage arrondi
    var cg = g.createLinearGradient(0, 26.5, 0, 32);
    cg.addColorStop(0, shade(P.roof, .22)); cg.addColorStop(1, shade(P.roof, -.14));
    g.fillStyle = cg; rr(g, 33.5, 26.5, 45, 5.4, 2.7); g.fill();

    // ---- lambrequin à festons ----
    for (sx = 26, k = 0; sx < 86; sx += 10, k++) {
      if (N && k === 1) continue; // feston manquant : rapiécé, pas fini
      g.fillStyle = k % 2 ? stripeB : stripeA;
      g.beginPath();
      g.moveTo(sx, 55); g.lineTo(sx + 10, 55);
      g.arc(sx + 5, 55, 5, 0, Math.PI);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1;
      g.beginPath(); g.arc(sx + 5, 55, 5, 0, Math.PI); g.stroke();
    }

    // ---- poteaux d'angle + hauban ----
    var pg = g.createLinearGradient(31, 0, 35, 0);
    pg.addColorStop(0, '#a8845a'); pg.addColorStop(1, '#6e5434');
    if (N) { pg = g.createLinearGradient(31, 0, 35, 0); pg.addColorStop(0, '#9a968c'); pg.addColorStop(1, '#6e6a62'); }
    g.fillStyle = pg; rr(g, 31, 56, 3.6, 29, 1.8); g.fill();
    var pg2 = g.createLinearGradient(77, 0, 81, 0);
    if (N) { pg2.addColorStop(0, '#9a968c'); pg2.addColorStop(1, '#6e6a62'); }
    else { pg2.addColorStop(0, '#a8845a'); pg2.addColorStop(1, '#6e5434'); }
    g.fillStyle = pg2; rr(g, 77.4, 56, 3.6, 29, 1.8); g.fill();
    g.strokeStyle = N ? 'rgba(90,86,78,0.7)' : 'rgba(122,92,52,0.75)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(31.6, 59); g.lineTo(23, 84.5); g.stroke();
    twig(g, 21.6, 86, 24.2, 81.5, 2, N ? '#77736a' : '#7a5c34'); // piquet

    if (!N) {
      // ---- 3 œufs sur coussinets (les recrues en devenir) ----
      var eggs = [[42, 81], [70, 81], [56, 83]], e, ei;
      for (ei = 0; ei < 3; ei++) {
        e = eggs[ei];
        var cgr = g.createLinearGradient(0, e[1] - 2.6, 0, e[1] + 2.6);
        cgr.addColorStop(0, mix(P.accent, '#ffffff', .55));
        cgr.addColorStop(1, mix(P.accent, '#000000', .12));
        g.fillStyle = cgr;
        g.beginPath(); g.ellipse(e[0], e[1], 6.4, 2.8, 0, 0, TAU); g.fill();
        g.fillStyle = shade(P.accent, -.3);
        g.beginPath(); g.arc(e[0], e[1] + .4, .9, 0, TAU); g.fill(); // bouton capitonné
        g.fillStyle = '#f2ead2';
        g.beginPath(); g.ellipse(e[0], e[1] - 4.6, 3.5, 4.5, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(140,120,80,0.5)';
        g.beginPath(); g.arc(e[0] - 1.2, e[1] - 3.4, .8, 0, TAU); g.fill();
        g.beginPath(); g.arc(e[0] + 1.4, e[1] - 6, .6, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.beginPath(); g.ellipse(e[0] - 1.2, e[1] - 6.6, 1.1, 1.5, .4, 0, TAU); g.fill();
      }
      // fanion du faîtage + bol de graines d'accueil
      g.fillStyle = P.accent;
      g.beginPath(); g.moveTo(34.5, 27.5); g.lineTo(25, 30.5); g.lineTo(34.5, 33.5);
      g.closePath(); g.fill();
      g.fillStyle = '#9a7a4e';
      g.beginPath(); g.ellipse(27, 86, 4.4, 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8c96a';
      g.beginPath(); g.ellipse(27, 85.2, 3, 1.2, 0, 0, TAU); g.fill();
    } else {
      // paille éparse et seau oublié
      g.strokeStyle = 'rgba(180,170,130,0.6)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(44, 84); g.lineTo(50, 82.5); g.stroke();
      g.beginPath(); g.moveTo(46, 85.8); g.lineTo(52.5, 85); g.stroke();
      g.beginPath(); g.moveTo(62, 84.5); g.lineTo(67, 83); g.stroke();
      g.fillStyle = '#88847c';
      g.beginPath(); g.moveTo(66.5, 79); g.lineTo(72.5, 79); g.lineTo(71.5, 85.5); g.lineTo(67.5, 85.5);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(50,48,44,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(69.5, 79, 3, 1, 0, 0, TAU); g.stroke();
    }

    // ---- enseigne œuf suspendue (potence à droite) ----
    twig(g, 79, 58, 93, 53, 2.2, N ? '#77736a' : '#6e5434');
    g.fillStyle = N ? '#847f76' : '#8a6a44';
    g.beginPath(); g.arc(93, 53, 1.5, 0, TAU); g.fill();
    var sw = N ? 0 : (Math.sin(PH * TAU) * .13 + Math.sin(PH * TAU * 3) * .03);
    g.save(); g.translate(93, 53); g.rotate(sw);
    g.strokeStyle = 'rgba(70,60,45,0.85)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-3, 1); g.lineTo(-3, 6); g.stroke();
    g.beginPath(); g.moveTo(3, 1); g.lineTo(3, 6); g.stroke();
    var eg = g.createLinearGradient(0, 6, 0, 21);
    if (N) { eg.addColorStop(0, shade('#b2aea6', .1)); eg.addColorStop(1, shade('#b2aea6', -.16)); }
    else { eg.addColorStop(0, shade('#c9a86a', .15)); eg.addColorStop(1, shade('#c9a86a', -.2)); }
    g.fillStyle = eg;
    g.beginPath(); g.ellipse(0, 13.5, 6.4, 7.8, 0, 0, TAU); g.fill();
    g.strokeStyle = N ? 'rgba(60,56,50,0.5)' : 'rgba(90,64,32,0.55)'; g.lineWidth = 1.1;
    g.beginPath(); g.ellipse(0, 13.5, 6.4, 7.8, 0, 0, TAU); g.stroke();
    if (!N) {
      // œuf peint sur l'enseigne
      g.fillStyle = '#f2ead2';
      g.beginPath(); g.ellipse(0, 13.5, 3.6, 5, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(140,120,80,0.55)';
      g.beginPath(); g.arc(-1, 14.5, .7, 0, TAU); g.fill();
      g.beginPath(); g.arc(1.2, 11.8, .6, 0, TAU); g.fill();
    } else {
      // enseigne vide : juste le fantôme de l'ancienne peinture
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, 13.5, 3.4, 4.8, 0, .5, TAU - 1); g.stroke();
    }
    g.restore();

    if (N) {
      // ---- ANIM : un pan de toile déchiré frémit (coin gauche) ----
      var fx = Math.sin(PH * TAU * 2) * 1.7 + Math.sin(PH * TAU * 3) * .7;
      g.fillStyle = '#b2aea6';
      g.beginPath();
      g.moveTo(26.5, 56.5); g.lineTo(34.5, 57.5);
      g.quadraticCurveTo(33.5 + fx * .5, 62.5, 29 + fx, 68.5);
      g.quadraticCurveTo(26.5 + fx * .4, 62.5, 26.5, 56.5);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,66,58,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(34.5, 57.5); g.quadraticCurveTo(33.5 + fx * .5, 62.5, 29 + fx, 68.5); g.stroke();
      // mousse au pied du poteau droit
      g.fillStyle = 'rgba(122,160,90,0.55)';
      g.beginPath(); g.ellipse(80, 86, 5.5, 2.4, .2, 0, TAU); g.fill();
    }
  }

  reg('production_birds', {
    id: 'halle-recrues', label: 'Halle des recrues', anim: 'l’enseigne se balance',
    draw: function (g, animT) { drawHalle(g, false, animT); }
  });
  reg('production_neutre', {
    id: 'halle-recrues', label: 'Halle des recrues', anim: 'un pan de toile frémit',
    draw: function (g, animT) { drawHalle(g, true, animT); }
  });
})();
