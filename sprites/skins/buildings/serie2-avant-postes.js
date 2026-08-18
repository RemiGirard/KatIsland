"use strict";
/* ============================================================
   LAB — SÉRIE 2 : AVANT-POSTES
   3 concepts déclinés dans les 3 slots ('avantposte_cats',
   'avantposte_birds', 'avantposte_neutre') :
     1. ballon-guet      — montgolfière captive amarrée à un treuil
     2. poste-ecoute     — tente basse + cornet acoustique sur trépied
     3. relais-lanterne  — cabane minuscule + lampadaire de signalisation
   Canvas 112×112, sol y≈84-88, boucle d'anim exacte de 3.2 s.
   Self-contained : ne touche qu'à window.LAB_BUILDINGS.
   ============================================================ */
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers locaux ----------
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

  var PAL = {
    cats:    { wall:'#f4ddb8', wallSh:'#d9b98a', roof:'#f08c42', roofSh:'#c9662a', accent:'#e76f51', flag:'#f08c42', door:'#8a5a30' },
    birds:   { wall:'#e6f1f8', wallSh:'#bcd6e6', roof:'#48a9d8', roofSh:'#2f7ea8', accent:'#3a86ff', flag:'#48a9d8', door:'#4a6a80' },
    neutral: { wall:'#d8d5ce', wallSh:'#b2aea6', roof:'#a8a49c', roofSh:'#847f76', accent:'#98948c', flag:'#b0aca4', door:'#6e6a62' }
  };
  var SLOTS = { cats: 'avantposte_cats', birds: 'avantposte_birds', neutral: 'avantposte_neutre' };

  function reg(slot, v) { var R = window.LAB_BUILDINGS.variants; (R[slot] = R[slot] || []).push(v); }
  function reg3(id, label, anims, fn) {
    ['cats', 'birds', 'neutral'].forEach(function (fac) {
      reg(SLOTS[fac], {
        id: id, label: label, anim: anims[fac],
        draw: function (g, animT) { fn(g, animT, fac, PAL[fac]); }
      });
    });
  }

  // petit fanion triangulaire
  function pennant(g, x, y, dx, col) {
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx, y + 2.2); g.lineTo(x, y + 4.4);
    g.closePath(); g.fill();
  }

  /* ============================================================
     1) BALLON DE GUET — montgolfière captive rayée, nacelle-panier,
        treuil de bois au sol. Neutre : enveloppe dégonflée aux 3/4,
        avachie de travers, nacelle renversée.
     ============================================================ */
  function drawWinch(g, woodA, woodB, ropeC) {
    // deux montants en A + tambour + manivelle
    twig(g, 82, 85, 88, 71, 3, woodB);
    twig(g, 95, 85, 88, 71, 3, woodB);
    var dg = g.createLinearGradient(0, 72, 0, 80);
    dg.addColorStop(0, shade(woodA, .28)); dg.addColorStop(.5, woodA); dg.addColorStop(1, shade(woodA, -.3));
    g.fillStyle = dg; rr(g, 80, 72.5, 17, 7.2, 3.4); g.fill();
    g.strokeStyle = ropeC; g.lineWidth = 1.2;
    for (var x = 83.5; x <= 92.5; x += 2.1) {
      g.beginPath(); g.moveTo(x, 73.6); g.lineTo(x - .8, 78.8); g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(81.5, 79); g.lineTo(95.5, 79); g.stroke();
    twig(g, 97, 76, 101, 69.5, 2, woodB);
    g.fillStyle = shade(woodA, .22); g.beginPath(); g.arc(101, 69, 2.1, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(100.4, 68.4, .8, 0, TAU); g.fill();
  }

  function drawBallonGuet(g, animT, fac, P) {
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 34, 10, 0.24);
    var wood = fac === 'neutral' ? '#8a8478' : '#8a6a44';
    var woodDk = fac === 'neutral' ? '#5e584e' : '#54402a';
    var rope = fac === 'neutral' ? 'rgba(104,100,90,.95)' : '#a8845a';
    drawWinch(g, wood, woodDk, rope);

    if (fac === 'neutral') {
      // --- enveloppe dégonflée aux 3/4, posée de travers ---
      var br = Math.sin(PH * TAU) * 1.5; // le lobe encore gonflé respire
      var eg = g.createLinearGradient(0, 56, 0, 87);
      eg.addColorStop(0, shade(P.wall, .14)); eg.addColorStop(1, shade(P.wallSh, -.1));
      g.fillStyle = eg;
      g.beginPath();
      g.moveTo(12, 84);
      g.quadraticCurveTo(9, 68, 20, 62 + br);
      g.quadraticCurveTo(30, 55.5 + br, 38, 64 + br * .5);
      g.quadraticCurveTo(44, 70, 52, 76);
      g.quadraticCurveTo(58, 80, 62, 84);
      g.quadraticCurveTo(38, 88.5, 12, 84);
      g.closePath(); g.fill();
      // rayures ternes qui suivent l'affaissement
      g.strokeStyle = 'rgba(150,146,138,.6)'; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(18, 65.5 + br); g.quadraticCurveTo(20.5, 74, 17.5, 83); g.stroke();
      g.beginPath(); g.moveTo(30, 60 + br); g.quadraticCurveTo(33, 71, 30.5, 84.5); g.stroke();
      g.beginPath(); g.moveTo(42, 68.5); g.quadraticCurveTo(46, 76.5, 44.5, 85); g.stroke();
      // plis d'ombre + rehaut du lobe (lumière haut-gauche)
      g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(24, 71 + br * .7); g.quadraticCurveTo(30, 74.5, 36, 72.5); g.stroke();
      g.beginPath(); g.moveTo(40, 77); g.quadraticCurveTo(48, 80.5, 56, 82.5); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.26)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(17, 65 + br); g.quadraticCurveTo(25, 58.5 + br, 33, 61.5 + br * .6); g.stroke();
      // pièce cousue sur la toile fatiguée
      g.fillStyle = 'rgba(178,174,166,.9)'; rr(g, 34, 74, 8, 6, 1.6); g.fill();
      g.strokeStyle = 'rgba(90,86,78,.55)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(35, 75.2); g.lineTo(41, 75.2); g.moveTo(35, 78.8); g.lineTo(41, 78.8); g.stroke();
      // anneau de bouche pincé
      g.strokeStyle = '#7a746a'; g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(60.5, 81.5, 3, 4.2, .5, 0, TAU); g.stroke();
      // nacelle renversée sur le flanc
      g.save(); g.translate(70, 80.5); g.rotate(.52);
      var kg = g.createLinearGradient(0, -4, 0, 4);
      kg.addColorStop(0, shade('#8a8478', .18)); kg.addColorStop(1, shade('#8a8478', -.24));
      g.fillStyle = kg; rr(g, -6, -4, 12, 8, 2.6); g.fill();
      g.strokeStyle = 'rgba(58,54,46,.45)'; g.lineWidth = 1;
      for (var yy = -1.6; yy <= 2.4; yy += 2) {
        g.beginPath(); g.arc(-2, yy, 2.4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        g.beginPath(); g.arc(3, yy, 2.4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      }
      g.strokeStyle = '#6e6a62'; g.lineWidth = 2; rr(g, -6, -4.6, 12, 2.4, 1.2); g.stroke();
      g.restore();
      // corde molle qui traîne jusqu'au treuil
      g.strokeStyle = rope; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(73, 84.5); g.quadraticCurveTo(77, 87.5, 81, 85);
      g.quadraticCurveTo(83.5, 83, 84.5, 79.5); g.stroke();
      return;
    }

    // --- ballon gonflé : dérive douce, la corde suit ---
    var dx = Math.sin(PH * TAU) * 2.4, dy = Math.sin(PH * TAU * 2) * .9;
    var bx = 44 + dx, by = 41 + dy, rx = 15.5, ry = 16.5;
    // enveloppe rayée (clip ellipse, fuseaux, ombrage global)
    g.save();
    g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, TAU); g.clip();
    var base = g.createLinearGradient(bx - rx, 0, bx + rx, 0);
    base.addColorStop(0, '#fdf6e4'); base.addColorStop(.55, '#f6ecd2'); base.addColorStop(1, shade('#e8dcc0', -.1));
    g.fillStyle = base; g.fillRect(bx - rx, by - ry, rx * 2, ry * 2);
    [[-1.05, -.58, shade(P.flag, -.06)], [-.24, .24, P.flag], [.58, 1.05, shade(P.flag, -.06)]].forEach(function (q) {
      g.fillStyle = q[2];
      g.beginPath();
      g.moveTo(bx, by - ry);
      g.quadraticCurveTo(bx + q[0] * rx * 1.9, by, bx, by + ry);
      g.quadraticCurveTo(bx + q[1] * rx * 1.9, by, bx, by - ry);
      g.closePath(); g.fill();
    });
    // coutures de latitude
    g.strokeStyle = 'rgba(0,0,0,.13)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(bx, by, rx * .97, ry * .42, 0, 0, Math.PI); g.stroke();
    g.beginPath(); g.ellipse(bx, by, rx * .8, ry * .74, 0, 0, Math.PI); g.stroke();
    // volume : rehaut haut-gauche, ombre à droite
    var sh = g.createLinearGradient(bx - rx, 0, bx + rx, 0);
    sh.addColorStop(0, 'rgba(255,255,255,.32)'); sh.addColorStop(.45, 'rgba(255,255,255,0)');
    sh.addColorStop(.72, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.20)');
    g.fillStyle = sh; g.fillRect(bx - rx, by - ry, rx * 2, ry * 2);
    g.restore();
    g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, TAU); g.stroke();
    // emblème de faction sur le fuseau central
    if (fac === 'cats') pawPrint(g, bx, by + .5, 3.1, 'rgba(255,255,255,.9)');
    else featherMark(g, bx, by + 1, 4, 'rgba(255,255,255,.9)');
    // jupe + suspentes + nacelle en osier
    var bky = by + ry + 5;
    g.fillStyle = 'rgba(60,38,18,.8)';
    g.beginPath(); g.ellipse(bx, by + ry - 1, 5.2, 2.1, 0, 0, TAU); g.fill();
    g.strokeStyle = rope; g.lineWidth = 1.1;
    [-6.5, 0, 6.5].forEach(function (o) {
      g.beginPath(); g.moveTo(bx + o, by + ry - 2.5 + Math.abs(o) * -.2);
      g.lineTo(bx + o * .78, bky + 1); g.stroke();
    });
    var kg2 = g.createLinearGradient(0, bky, 0, bky + 8.5);
    kg2.addColorStop(0, shade('#c89a5c', .18)); kg2.addColorStop(1, shade('#c89a5c', -.26));
    g.fillStyle = kg2; rr(g, bx - 6.2, bky, 12.4, 8.5, 2.8); g.fill();
    g.strokeStyle = 'rgba(90,60,26,.4)'; g.lineWidth = 1;
    for (var wy = bky + 2.6; wy < bky + 7.4; wy += 2.2) {
      g.beginPath(); g.arc(bx - 2.6, wy, 2.3, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.beginPath(); g.arc(bx + 2.8, wy, 2.3, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    g.strokeStyle = '#9a7038'; g.lineWidth = 2.2; rr(g, bx - 6.2, bky - .8, 12.4, 2.6, 1.3); g.stroke();
    // petit sac de lest accroché au flanc
    g.fillStyle = shade(P.accent, -.1);
    g.beginPath(); g.ellipse(bx + 7.6, bky + 4.6, 2, 2.8, .2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .9;
    g.beginPath(); g.moveTo(bx + 7, bky + 2.2); g.lineTo(bx + 8.2, bky + 2.2); g.stroke();
    // corde d'amarrage : suit la dérive, gros ventre mou
    g.strokeStyle = rope; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(bx, bky + 8.5);
    g.quadraticCurveTo((bx + 86) / 2, 86, 86.5, 75.5); g.stroke();
    // fanion de faction sur le treuil
    twig(g, 82, 71.5, 82, 62.5, 1.6, woodDk);
    pennant(g, 82.8, 62.5, 8.5, P.flag);
  }

  reg3('ballon-guet', 'Ballon de guet', {
    cats: 'le ballon dérive doucement',
    birds: 'le ballon dérive doucement',
    neutral: 'le lobe dégonflé respire encore'
  }, drawBallonGuet);

  /* ============================================================
     2) POSTE D'ÉCOUTE — tente basse + grand cornet acoustique sur
        trépied, tourné vers l'horizon. Chats : entonnoir de cuivre ;
        oiseaux : fleur-cornet en écorce ; neutre : cornet cabossé.
     ============================================================ */
  function drawPosteEcoute(g, animT, fac, P) {
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 34, 10, 0.24);
    var wood = fac === 'neutral' ? '#7a746a' : '#6e5434';

    // --- tente basse (gauche) ---
    var tg = g.createLinearGradient(14, 0, 52, 0);
    tg.addColorStop(0, shade(P.wall, .12)); tg.addColorStop(.6, P.wall); tg.addColorStop(1, shade(P.wallSh, -.06));
    g.fillStyle = tg;
    g.beginPath();
    g.moveTo(13, 85);
    g.quadraticCurveTo(28, 57, 33, 56);
    g.quadraticCurveTo(38, 57, 52, 85);
    g.quadraticCurveTo(32.5, 88, 13, 85);
    g.closePath(); g.fill();
    // pan avant éclairé
    g.fillStyle = shade(P.wall, .2); g.globalAlpha = .8;
    g.beginPath(); g.moveTo(33, 56); g.quadraticCurveTo(38, 57, 52, 85);
    g.quadraticCurveTo(45, 86.5, 38, 86.6); g.quadraticCurveTo(36, 68, 33, 56);
    g.closePath(); g.fill(); g.globalAlpha = 1;
    // ourlet rayé en bas + entrée sombre
    g.strokeStyle = P.flag; g.lineWidth = 3; g.globalAlpha = .85;
    g.beginPath(); g.moveTo(14.5, 84.4); g.quadraticCurveTo(32.5, 87.4, 50.5, 84.4); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(30,24,16,.78)';
    g.beginPath(); g.moveTo(40, 86.3); g.quadraticCurveTo(38.5, 70, 34.5, 60);
    g.quadraticCurveTo(40, 68, 45.5, 86); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(17, 80); g.quadraticCurveTo(26, 63, 32, 58.5); g.stroke();
    // faîtière qui dépasse + piquets
    twig(g, 30, 58, 25, 52.5, 2, wood);
    twig(g, 14.5, 84.5, 12, 88, 1.6, wood);
    twig(g, 50.5, 84.5, 53, 88, 1.6, wood);
    if (fac === 'cats') {
      g.fillStyle = 'rgba(233,215,180,.95)'; rr(g, 19, 70, 8, 6.5, 1.6); g.fill();
      g.strokeStyle = 'rgba(122,90,52,.5)'; g.lineWidth = .9; rr(g, 20, 71, 6, 4.5, 1.1); g.stroke();
      pawPrint(g, 28.5, 66, 2.2, 'rgba(122,80,40,.5)');
      // bol de lait devant l'entrée
      g.fillStyle = P.accent; g.beginPath(); g.ellipse(56.5, 85, 4.4, 2.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#fdf8ec'; g.beginPath(); g.ellipse(56.5, 84.4, 3, 1.3, 0, 0, TAU); g.fill();
    } else if (fac === 'birds') {
      featherMark(g, 24, 54, 4, mix(P.flag, '#ffffff', .3));
      taperedStroke(g, [[15, 82], [19, 76.5], [24, 72.5]], 2.2, 1, '#8a6a44'); // brindille cousue
      g.fillStyle = '#e8c96a'; // graines devant l'entrée
      [[54, 85.5], [57.5, 84.3], [56, 87], [59.5, 86.2]].forEach(function (q) {
        g.beginPath(); g.ellipse(q[0], q[1], 1.2, .8, .4, 0, TAU); g.fill();
      });
    } else {
      g.fillStyle = 'rgba(110,140,84,.5)'; // mousse sur la toile grise
      g.beginPath(); g.ellipse(22, 76, 5, 2.6, .3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.1; // accroc recousu
      g.beginPath(); g.moveTo(27, 68); g.lineTo(30, 73); g.stroke();
      for (var zz = 0; zz < 3; zz++) {
        g.beginPath(); g.moveTo(26.6 + zz * 1.3, 69 + zz * 1.7); g.lineTo(29 + zz * 1.3, 68.4 + zz * 1.7); g.stroke();
      }
    }

    // --- trépied + sac de lest ---
    twig(g, 74, 52, 63.5, 85.5, 3, wood);
    twig(g, 74, 52, 82, 85.5, 3, wood);
    twig(g, 74, 52, 90, 82.5, 2.6, shade(wood, -.18));
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(74.5, 55); g.lineTo(75.5, 64); g.stroke();
    g.fillStyle = shade(wood, -.1);
    g.beginPath(); g.ellipse(75.8, 66.5, 2.6, 3.4, .1, 0, TAU); g.fill();

    // --- cornet acoustique (ANIM : balayage lent de l'horizon) ---
    var a = Math.sin(PH * TAU) * .12;
    g.save(); g.translate(74, 50); g.rotate(a);
    var body = fac === 'cats' ? '#c9873f' : (fac === 'birds' ? '#8a6a44' : '#9a968c');
    if (fac === 'birds') {
      // pétales d'écorce autour de la bouche, sous le corps
      for (var p = -2; p <= 2; p++) {
        g.save(); g.translate(20.5, p * 4.1); g.rotate(p * .3);
        g.fillStyle = p % 2 ? '#c9a86a' : shade('#c9a86a', -.14);
        g.beginPath(); g.ellipse(3.4, 0, 4.6, 2.5, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(58,134,255,.35)';
        g.beginPath(); g.ellipse(5.6, 0, 1.8, 1.3, 0, 0, TAU); g.fill();
        g.restore();
      }
    }
    var cg = g.createLinearGradient(0, -9.5, 0, 9.5);
    cg.addColorStop(0, shade(body, .38)); cg.addColorStop(.5, body); cg.addColorStop(1, shade(body, -.32));
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(-16, -2);
    g.quadraticCurveTo(2, -3.2, 20, -9.5);
    g.quadraticCurveTo(23.5, 0, 20, 9.5);
    g.quadraticCurveTo(2, 3.2, -16, 2);
    g.quadraticCurveTo(-18.2, 0, -16, -2);
    g.closePath(); g.fill();
    // pavillon sombre + liseré
    g.fillStyle = fac === 'birds' ? 'rgba(40,26,12,.85)' : 'rgba(50,28,10,.8)';
    g.beginPath(); g.ellipse(20.7, 0, 2.7, 9.2, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,236,190,.5)'; g.lineWidth = 1.1;
    g.beginPath(); g.ellipse(20.7, 0, 2.7, 9.2, 0, 0, TAU); g.stroke();
    if (fac === 'cats') {
      // bagues rivetées de l'entonnoir
      g.strokeStyle = shade(body, -.45); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(3, -3.5); g.lineTo(3, 3.5); g.stroke();
      g.beginPath(); g.moveTo(12, -6.4); g.lineTo(12, 6.4); g.stroke();
      g.fillStyle = '#f4c542';
      g.beginPath(); g.arc(3, -2.2, .8, 0, TAU); g.fill();
      g.beginPath(); g.arc(12, -4.6, .8, 0, TAU); g.fill();
    } else if (fac === 'birds') {
      // stries d'écorce
      g.strokeStyle = 'rgba(50,34,16,.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-10, -1.4); g.quadraticCurveTo(4, -2.6, 16, -6.4); g.stroke();
      g.beginPath(); g.moveTo(-9, 1.8); g.quadraticCurveTo(5, 2.8, 15, 6.2); g.stroke();
    } else {
      // bosses et pièce rivetée du cornet cabossé
      g.fillStyle = 'rgba(0,0,0,.2)';
      g.beginPath(); g.ellipse(9, 3.2, 3, 1.8, .4, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(16, -4.6, 2.4, 1.5, -.5, 0, TAU); g.fill();
      g.fillStyle = shade(body, -.18); rr(g, 1, -3, 5, 5, 1); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.arc(2.2, -2, .6, 0, TAU); g.fill();
      g.beginPath(); g.arc(5, 1.2, .6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(110,150,120,.4)'; // vert-de-gris
      g.beginPath(); g.ellipse(-6, 1.4, 3.4, 1.6, .2, 0, TAU); g.fill();
    }
    // rehaut supérieur + tube d'écoute qui plonge vers la tente
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-12, -1.9); g.quadraticCurveTo(4, -3.5, 17, -7.6); g.stroke();
    taperedStroke(g, [[-16, 0], [-21, 4], [-23.5, 9.5]], 3, 1.6, shade(body, -.25));
    g.restore();
    // boulon d'axe doré
    g.fillStyle = '#f4c542'; g.beginPath(); g.arc(74, 50, 2.2, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(73.4, 49.4, .8, 0, TAU); g.fill();
  }

  reg3('poste-ecoute', "Poste d'écoute", {
    cats: "le cornet balaie l'horizon",
    birds: "le cornet balaie l'horizon",
    neutral: 'le cornet cabossé balaie encore'
  }, drawPosteEcoute);

  /* ============================================================
     3) RELAIS-LANTERNE — cabane minuscule + grand lampadaire à
        lanterne de faction, banc devant. Neutre : lanterne éteinte
        et fissurée, un papillon de nuit tourne autour.
     ============================================================ */
  function drawRelaisLanterne(g, animT, fac, P) {
    var PH = (animT % 3.2) / 3.2;
    softShadow(g, 56, 88, 34, 10, 0.24);

    // --- cabane minuscule (gauche) ---
    if (fac === 'cats') {
      // caisse en carton, rabats entrouverts, fenêtre au feutre
      var CARD = '#dcb77e';
      var wg = g.createLinearGradient(16, 0, 46, 0);
      wg.addColorStop(0, shade(CARD, .12)); wg.addColorStop(1, shade(CARD, -.1));
      g.fillStyle = wg; rr(g, 17, 66, 29, 19.5, 2.6); g.fill();
      g.fillStyle = shade(CARD, -.14);
      g.beginPath(); g.moveTo(17, 67); g.lineTo(23, 57.5); g.lineTo(33, 58.5); g.lineTo(32, 67); g.closePath(); g.fill();
      g.fillStyle = shade(CARD, .02);
      g.beginPath(); g.moveTo(46, 67); g.lineTo(41, 59); g.lineTo(33, 58.5); g.lineTo(32.5, 67); g.closePath(); g.fill();
      g.globalAlpha = .5; g.fillStyle = '#f2e6c0'; // scotch
      g.save(); g.translate(29, 73); g.rotate(-.4); g.fillRect(-10, -2.4, 20, 4.8); g.restore();
      g.globalAlpha = 1;
      g.strokeStyle = '#7a5a34'; g.lineWidth = 1.5; // fenêtre gribouillée
      g.strokeRect(36.5, 69.5, 6.5, 6.5);
      g.beginPath(); g.moveTo(39.7, 69.5); g.lineTo(39.7, 76); g.moveTo(36.5, 72.7); g.lineTo(43, 72.7); g.stroke();
      g.fillStyle = 'rgba(60,40,20,.8)'; // chatière
      g.beginPath(); g.arc(26, 85.5, 5, Math.PI, 0); g.fill();
      pawPrint(g, 21.5, 62.5, 2, 'rgba(122,80,40,.55)');
    } else if (fac === 'birds') {
      // nichoir-relais en planches, trou d'envol, nid sur le toit
      var hg = g.createLinearGradient(17, 0, 45, 0);
      hg.addColorStop(0, '#c9a06a'); hg.addColorStop(1, '#9a7444');
      g.fillStyle = hg; rr(g, 18, 64, 26, 21.5, 3); g.fill();
      g.strokeStyle = 'rgba(70,50,24,.35)'; g.lineWidth = 1;
      [69.5, 75, 80.5].forEach(function (y) {
        g.beginPath(); g.moveTo(19.5, y); g.lineTo(42.5, y); g.stroke();
      });
      g.fillStyle = P.roof;
      g.beginPath(); g.moveTo(14, 66); g.lineTo(31, 53.5); g.lineTo(48, 66); g.closePath(); g.fill();
      g.strokeStyle = P.roofSh; g.lineWidth = 1.2; g.globalAlpha = .6;
      g.beginPath(); g.moveTo(31, 55.5); g.lineTo(31, 64); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = '#31220f'; g.beginPath(); g.arc(31, 72.5, 4.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(29.7, 71.2, 1.7, 0, TAU); g.fill();
      twig(g, 31, 77.5, 38, 81.5, 1.8, '#54402a');
      // mini-nid calé contre le pignon
      g.fillStyle = '#7a5c34'; g.beginPath(); g.ellipse(43, 63.5, 5, 2.6, 0, 0, TAU); g.fill();
      twig(g, 39.5, 62.5, 46.5, 64.5, 1.2, '#c9a06a');
      g.fillStyle = '#f2ead2'; g.beginPath(); g.ellipse(43, 62.4, 1.9, 2.3, 0, 0, TAU); g.fill();
    } else {
      // guérite de pierre moussue, toit-dalle, porte béante
      var sg = g.createLinearGradient(16, 0, 46, 0);
      sg.addColorStop(0, shade(P.wall, .1)); sg.addColorStop(1, shade(P.wall, -.14));
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(18, 86); g.lineTo(19, 66); g.quadraticCurveTo(19, 63.5, 22, 63.5);
      g.lineTo(41, 63.5); g.quadraticCurveTo(44, 63.5, 44, 66); g.lineTo(45, 86);
      g.quadraticCurveTo(31.5, 88.5, 18, 86);
      g.closePath(); g.fill();
      g.fillStyle = '#847f76'; rr(g, 14.5, 59, 34, 6.5, 3.2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(17, 60.4); g.lineTo(45, 60.4); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.1; // fissures élégantes
      g.beginPath(); g.moveTo(24, 67); g.lineTo(22.5, 73); g.lineTo(25.5, 78); g.stroke();
      g.beginPath(); g.moveTo(38, 70); g.lineTo(40, 76); g.stroke();
      g.fillStyle = 'rgba(24,24,30,.72)';
      g.beginPath(); g.moveTo(27.5, 86); g.lineTo(27.5, 74); g.arc(31.5, 74, 4, Math.PI, 0);
      g.lineTo(35.5, 86); g.closePath(); g.fill();
      g.fillStyle = 'rgba(110,140,84,.55)';
      g.beginPath(); g.ellipse(20.5, 82, 4.4, 2.4, .25, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(42, 64.5, 3.2, 1.7, -.2, 0, TAU); g.fill();
    }

    // --- banc devant la cabane ---
    if (fac === 'neutral') {
      g.save(); g.translate(59, 79); g.rotate(.09);
      g.fillStyle = shade('#8a8478', .06); rr(g, -8.5, -1.7, 17, 3.4, 1.6); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-2, -1.5); g.lineTo(-1, 1.6); g.stroke();
      g.restore();
      twig(g, 52.5, 80.5, 52, 86.5, 2, '#6e6a62');
      twig(g, 65, 82, 67.5, 86.5, 2, '#6e6a62'); // pied qui lâche
    } else {
      var bg = g.createLinearGradient(0, 77, 0, 81);
      bg.addColorStop(0, shade('#8a6a44', .22)); bg.addColorStop(1, shade('#8a6a44', -.2));
      g.fillStyle = bg; rr(g, 51, 77.5, 17, 3.6, 1.7); g.fill();
      twig(g, 54, 81, 53.5, 86.5, 2, '#54402a');
      twig(g, 65, 81, 65.5, 86.5, 2, '#54402a');
      if (fac === 'cats') {
        var cc = g.createLinearGradient(0, 73.5, 0, 78);
        cc.addColorStop(0, mix(P.accent, '#ffffff', .5)); cc.addColorStop(1, P.accent);
        g.fillStyle = cc; rr(g, 54, 73.8, 11, 4.4, 2.1); g.fill();
        g.fillStyle = shade(P.accent, -.35);
        g.beginPath(); g.arc(59.5, 75.9, .9, 0, TAU); g.fill();
      } else {
        featherMark(g, 57, 75.5, 2.6, mix(P.flag, '#ffffff', .35));
        g.fillStyle = '#e8c96a';
        g.beginPath(); g.ellipse(63, 76.6, 1.2, .8, .3, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(65.3, 76.1, 1.1, .8, -.4, 0, TAU); g.fill();
      }
    }

    // --- grand lampadaire ---
    var post = fac === 'neutral' ? '#8a8478' : '#8a6a44';
    var pg = g.createLinearGradient(73, 0, 78, 0);
    pg.addColorStop(0, shade(post, .22)); pg.addColorStop(1, shade(post, -.3));
    g.fillStyle = pg; rr(g, 73, 30, 5, 56, 2.4); g.fill();
    g.fillStyle = shade(post, -.12);
    g.beginPath(); g.ellipse(75.5, 86, 6, 2.5, 0, 0, TAU); g.fill();
    g.fillStyle = shade(post, .15); g.beginPath(); g.arc(75.5, 29.8, 3, 0, TAU); g.fill();
    g.strokeStyle = shade(post, -.28); g.lineWidth = 2.6; // bras courbe
    g.beginPath(); g.moveTo(76.5, 31.5); g.quadraticCurveTo(86, 29, 89, 35); g.stroke();
    twig(g, 76.5, 39.5, 84.5, 33.5, 1.8, shade(post, -.28)); // jambe de force
    if (fac === 'cats') {
      g.strokeStyle = 'rgba(70,46,20,.55)'; g.lineWidth = 1.1; // griffures d'affûtage
      for (var d = -2; d <= 2; d += 2) {
        g.beginPath(); g.moveTo(74 + d * .6, 60); g.lineTo(75 + d * .6, 70); g.stroke();
      }
    } else if (fac === 'birds') {
      twig(g, 71, 46, 79.5, 44.5, 1.6, '#54402a'); // perchoir de service
    } else {
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(74.5, 52); g.lineTo(75.8, 62); g.lineTo(74.8, 70); g.stroke();
    }
    // maillon de suspension
    g.strokeStyle = 'rgba(60,50,40,.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(89, 35); g.lineTo(89, 38); g.stroke();

    // --- lanterne (ANIM : halo qui pulse ; neutre : éteinte) ---
    var pulse = .5 + .5 * Math.sin(PH * TAU);
    if (fac !== 'neutral') {
      var glowC = fac === 'cats' ? '255,186,84' : '132,204,255';
      var ga = .2 + .17 * pulse;
      var gr = 15 + pulse * 2.2;
      var hg2 = g.createRadialGradient(89, 46, 1.5, 89, 46, gr);
      hg2.addColorStop(0, 'rgba(' + glowC + ',' + ga.toFixed(3) + ')');
      hg2.addColorStop(1, 'rgba(' + glowC + ',0)');
      g.fillStyle = hg2; g.beginPath(); g.arc(89, 46, gr, 0, TAU); g.fill();
    }
    var frame = fac === 'cats' ? '#54402a' : (fac === 'birds' ? '#2f4a5c' : '#6e6a62');
    g.fillStyle = frame; // chapeau + anneau
    g.beginPath(); g.moveTo(84.4, 41.8); g.lineTo(93.6, 41.8); g.lineTo(91.6, 38.2); g.lineTo(86.4, 38.2);
    g.closePath(); g.fill();
    var glass;
    if (fac === 'cats') glass = mix('#f0a838', '#ffe9b2', .22 + .34 * pulse);
    else if (fac === 'birds') glass = mix('#54aede', '#e2f5ff', .22 + .34 * pulse);
    else glass = '#b6b3aa';
    var lg = g.createLinearGradient(84.8, 0, 93.2, 0);
    lg.addColorStop(0, shade(glass, .2)); lg.addColorStop(1, shade(glass, -.16));
    g.fillStyle = lg; rr(g, 84.8, 41.8, 8.4, 11.4, 2); g.fill();
    g.strokeStyle = frame; g.lineWidth = 1.4;
    rr(g, 84.8, 41.8, 8.4, 11.4, 2); g.stroke();
    g.beginPath(); g.moveTo(89, 42.2); g.lineTo(89, 52.8); g.stroke();
    if (fac === 'neutral') {
      g.strokeStyle = 'rgba(40,40,44,.55)'; g.lineWidth = .9; // vitre fissurée
      g.beginPath(); g.moveTo(86, 44); g.lineTo(88.2, 47.5); g.lineTo(87, 51.5); g.stroke();
      g.beginPath(); g.moveTo(88.2, 47.5); g.lineTo(90.8, 49); g.stroke();
    } else {
      // flamme, cœur plus clair au rythme du halo
      g.fillStyle = fac === 'cats' ? '#fff3cf' : '#f2fbff';
      g.beginPath(); g.moveTo(89, 44.6);
      g.quadraticCurveTo(91, 47.4, 89, 50.4);
      g.quadraticCurveTo(87, 47.4, 89, 44.6); g.closePath(); g.fill();
      g.fillStyle = fac === 'cats' ? 'rgba(240,140,50,.8)' : 'rgba(64,150,220,.8)';
      g.beginPath(); g.arc(89, 48.6, 1.1, 0, TAU); g.fill();
    }
    g.fillStyle = frame; g.beginPath(); g.arc(89, 54.4, 1.4, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(86, 43.4); g.lineTo(86, 51.4); g.stroke();

    // --- neutre : papillon de nuit en orbite (ANIM) ---
    if (fac === 'neutral') {
      var ma = PH * TAU;
      var mx = 89 + Math.cos(ma) * 10.5, my = 46 + Math.sin(ma) * 5.2;
      var wf = .6 + .4 * Math.sin(PH * TAU * 8);
      g.fillStyle = 'rgba(238,232,214,.9)';
      g.beginPath(); g.ellipse(mx - 1.4 * wf, my - .8, 1.7 * wf, 1.05, -.5, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(mx + 1.4 * wf, my - .8, 1.7 * wf, 1.05, .5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(150,140,118,.95)';
      g.beginPath(); g.ellipse(mx, my, .8, 1.4, 0, 0, TAU); g.fill();
    }
  }

  reg3('relais-lanterne', 'Relais-lanterne', {
    cats: 'la lueur de la lanterne pulse',
    birds: 'la lueur de la lanterne pulse',
    neutral: 'un papillon de nuit tourne autour'
  }, drawRelaisLanterne);
})();
