"use strict";
/* ============================================================
   LAB — amelioration.js
   Variantes du bâtiment d'AMÉLIORATION (kind 'banner', +10% dmg/hp).
   Remplace le drapeau (trop proche du point de contrôle) par de
   vrais bâtiments : forge de camp, camp d'entraînement, atelier.
   Slots : banner_cats / banner_birds / banner_neutre.
   ============================================================ */
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
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
    cats:  { wall:'#f4ddb8', wallSh:'#d9b98a', roof:'#f08c42', roofSh:'#c9662a', accent:'#e76f51', flag:'#f08c42', door:'#8a5a30' },
    birds: { wall:'#e6f1f8', wallSh:'#bcd6e6', roof:'#48a9d8', roofSh:'#2f7ea8', accent:'#3a86ff', flag:'#48a9d8', door:'#4a6a80' },
    neutre:{ wall:'#d8d5ce', wallSh:'#b2aea6', roof:'#a8a49c', roofSh:'#847f76', accent:'#98948c', flag:'#b0aca4', door:'#6e6a62' }
  };
  var W1 = '#8a6a44', W2 = '#6e5434', W3 = '#54402a', WL = '#c9a86a';
  var STRAW = '#e8c96a', STONE = '#a8a296', STONE_SH = '#8a8478';

  // petit brin d'herbe qui frémit (détail vivant des variantes neutres)
  function grassBlade(g, x, y, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    taperedStroke(g, [[0, 0], [1.2, -5], [3.4, -9]], 1.8, .6, '#7aa05a');
    g.restore();
    g.fillStyle = 'rgba(110,140,84,0.55)';
    g.beginPath(); g.ellipse(x + 2, y + 1, 4, 1.8, .15, 0, TAU); g.fill();
  }
  // tache de mousse douce
  function moss(g, x, y, rx, ry, a) {
    g.fillStyle = 'rgba(110,140,84,' + a + ')';
    g.beginPath(); g.ellipse(x, y, rx, ry, .25, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x + rx * .5, y - ry * .5, rx * .5, ry * .55, -.3, 0, TAU); g.fill();
  }
  // billot de bois (support d'enclume) : cylindre, cernes, écorce
  function stump(g, cx, topY, botY, rx) {
    var bg = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
    bg.addColorStop(0, shade(W1, .12)); bg.addColorStop(.55, W1); bg.addColorStop(1, shade(W1, -.3));
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(cx - rx, topY); g.lineTo(cx - rx + 1, botY);
    g.quadraticCurveTo(cx, botY + 4, cx + rx - 1, botY);
    g.lineTo(cx + rx, topY); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,42,20,0.35)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(cx - rx * .45, topY + 3); g.lineTo(cx - rx * .55, botY - 2); g.stroke();
    g.beginPath(); g.moveTo(cx + rx * .5, topY + 3); g.lineTo(cx + rx * .6, botY - 3); g.stroke();
    g.fillStyle = shade(WL, .1);
    g.beginPath(); g.ellipse(cx, topY, rx, rx * .38, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(cx, topY, rx * .62, rx * .24, 0, 0, TAU); g.stroke();
    g.beginPath(); g.ellipse(cx - 1, topY, rx * .3, rx * .11, 0, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(90,64,32,0.75)';
    g.beginPath(); g.arc(cx + rx * .35, topY + 1, 1.1, 0, TAU); g.fill(); // nœud du bois
  }
  // enclume ronde et sympathique ; beak=true : corne en bec d'oiseau
  function anvil(g, ax, topY, cIron, beak) {
    var iron = g.createLinearGradient(0, topY, 0, topY + 17);
    iron.addColorStop(0, shade(cIron, .22)); iron.addColorStop(.5, cIron); iron.addColorStop(1, shade(cIron, -.26));
    // pied évasé
    g.fillStyle = iron; rr(g, ax - 10, topY + 11, 20, 6, 2.5); g.fill();
    // taille
    rr(g, ax - 6, topY + 5, 12, 7, 2); g.fill();
    // table
    rr(g, ax - 13, topY, 26, 6.5, 3); g.fill();
    // corne
    g.beginPath();
    if (beak) {
      g.moveTo(ax + 11, topY + .5);
      g.quadraticCurveTo(ax + 23, topY - .5, ax + 22, topY + 7.5);
      g.quadraticCurveTo(ax + 17, topY + 4.5, ax + 11, topY + 6);
    } else {
      g.moveTo(ax + 11, topY + 1);
      g.quadraticCurveTo(ax + 20, topY + .5, ax + 19, topY + 5.5);
      g.quadraticCurveTo(ax + 15, topY + 4, ax + 11, topY + 5.5);
    }
    g.closePath(); g.fill();
    // rehaut de table + ombre sous la table
    g.fillStyle = 'rgba(255,255,255,0.3)'; rr(g, ax - 11, topY + 1, 18, 2, 1); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.16)'; rr(g, ax - 8, topY + 6.5, 16, 1.6, .8); g.fill();
  }
  // marteau (manche + tête), dessiné dans le repère courant
  function hammer(g, x0, y0, x1, y1, headC, padC) {
    taperedStroke(g, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1]], 3.4, 2.4, WL);
    g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = .8;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    var a = Math.atan2(y1 - y0, x1 - x0);
    g.save(); g.translate(x1, y1); g.rotate(a + Math.PI / 2);
    var hg = g.createLinearGradient(-6, 0, 6, 0);
    hg.addColorStop(0, shade(headC, .25)); hg.addColorStop(1, shade(headC, -.25));
    g.fillStyle = hg; rr(g, -6, -4.5, 12, 9, 3.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)'; rr(g, -4.5, -3.2, 5, 2.2, 1.1); g.fill();
    if (padC) { // coussinet félin sur la panne
      g.fillStyle = padC;
      g.beginPath(); g.ellipse(0, 4.2, 3.4, 2, 0, 0, TAU); g.fill();
      g.fillStyle = shade(padC, -.25);
      [-1.8, 0, 1.8].forEach(function (dx) { g.beginPath(); g.arc(dx, 3.1, .8, 0, TAU); g.fill(); });
    }
    g.restore();
  }
  // brève étincelle en étoile (alpha piloté par l'appelant)
  function sparkStar(g, x, y, r, alpha) {
    if (alpha <= 0.01) return;
    g.save(); g.globalAlpha = alpha;
    g.strokeStyle = '#ffd66e'; g.lineWidth = 1.6;
    for (var i = 0; i < 4; i++) {
      var a = i * TAU / 4 + .5;
      g.beginPath(); g.moveTo(x + Math.cos(a) * r * .3, y + Math.sin(a) * r * .3);
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke();
    }
    g.fillStyle = '#fff3c8'; g.beginPath(); g.arc(x, y, r * .32, 0, TAU); g.fill();
    g.restore();
  }

  // ============================================================
  // 1) FORGE DE CAMP — enclume sur billot, auvent, râtelier d'armes
  // ============================================================
  function drawForge(g, animT, fac) {
    var P = PAL[fac], PH = (animT % 3.2) / 3.2, cold = fac === 'neutre';
    var sw = Math.sin(PH * TAU * 2); // 2 frappes par boucle
    softShadow(g, 56, 88, 34, 10, 0.24);

    // ---- râtelier d'armes (gauche) : deux montants + traverses
    var rackW = cold ? PAL.neutre.roofSh : W2;
    twig(g, 12, 84, 12, 53, 3.2, rackW);
    twig(g, 30, 84, 30, 53, 3.2, rackW);
    twig(g, 9, 58, 33, 57, 2.4, cold ? PAL.neutre.roof : W1);
    twig(g, 9, 74, 33, 73, 2.4, cold ? PAL.neutre.roof : W1);
    if (fac === 'cats') {
      // lances-griffoirs : hampes claires, tête gainée de sisal
      [15, 21, 27].forEach(function (x, i) {
        var dx = (i - 1) * 1.2;
        twig(g, x + dx, 50, x, 82, 2.6, WL);
        g.fillStyle = STRAW; rr(g, x + dx - 2.6, 47, 5.2, 11, 2.6); g.fill();
        g.strokeStyle = 'rgba(150,110,50,0.65)'; g.lineWidth = .9;
        for (var y = 49.5; y < 56.5; y += 2.2) { g.beginPath(); g.moveTo(x + dx - 2.2, y); g.lineTo(x + dx + 2.2, y - .7); g.stroke(); }
      });
    } else if (fac === 'birds') {
      // plumes-flèches : fûts fins, empennage teinté faction, pointe pierre
      [15, 21, 27].forEach(function (x, i) {
        var dx = (i - 1) * 1.4;
        twig(g, x + dx, 48, x, 82, 1.7, W2);
        g.fillStyle = i === 1 ? shade(P.flag, .25) : P.flag;
        g.save(); g.translate(x + dx, 51); g.rotate(dx * .06);
        g.beginPath(); g.moveTo(0, -4); g.lineTo(4, 3); g.lineTo(0, 1.4); g.lineTo(-4, 3); g.closePath(); g.fill();
        g.restore();
        g.fillStyle = STONE_SH; g.beginPath(); g.arc(x, 82.5, 1.6, 0, TAU); g.fill();
      });
    } else {
      // râtelier presque vide : une hampe brisée, une corde qui pend
      twig(g, 18, 55, 16, 70, 2.2, PAL.neutre.door);
      twig(g, 16, 70, 21, 80, 1.6, PAL.neutre.door);
      g.strokeStyle = 'rgba(120,112,100,0.8)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(26, 58); g.quadraticCurveTo(27.5, 66, 25.5, 71); g.stroke();
    }

    // ---- auvent d'atelier au-dessus de l'enclume
    var poleC = cold ? PAL.neutre.door : W2;
    twig(g, 35, 84, 33.5, 30, 3.4, poleC);
    twig(g, 93, 84, 94.5, 25, 3.4, poleC);
    var ag = g.createLinearGradient(0, 14, 0, 34);
    ag.addColorStop(0, shade(P.roof, .18)); ag.addColorStop(1, shade(P.roof, -.14));
    g.fillStyle = ag;
    g.beginPath();
    g.moveTo(29, 32); g.lineTo(35, 16); g.quadraticCurveTo(66, 12.5, 97, 13);
    g.lineTo(99, 26); g.closePath(); g.fill();
    // feston du bord avant (ou lambeaux côté neutre)
    g.fillStyle = shade(P.roofSh, cold ? .04 : .08);
    if (cold) {
      g.beginPath();
      g.moveTo(29, 31); g.lineTo(99, 25); g.lineTo(97, 31); g.lineTo(88, 27.5);
      g.lineTo(83, 35); g.lineTo(74, 28.5); g.lineTo(66, 33); g.lineTo(52, 29.5);
      g.lineTo(46, 35); g.lineTo(37, 31); g.closePath(); g.fill();
    } else {
      g.beginPath(); g.moveTo(29, 31); g.lineTo(99, 25);
      for (var i = 4; i >= 0; i--) {
        var t0 = i / 5, t1 = (i + 1) / 5;
        var xa = 29 + t0 * 70, xb = 29 + t1 * 70;
        g.lineTo(xb, 25 + (1 - t1) * 6);
        g.quadraticCurveTo((xa + xb) / 2, 30 + (1 - (t0 + t1) / 2) * 6 + 4.5, xa, 25 + (1 - t0) * 6);
      }
      g.closePath(); g.fill();
    }
    g.strokeStyle = shade(P.roofSh, -.15); g.lineWidth = 1; g.globalAlpha = .5;
    g.beginPath(); g.moveTo(31, 30.5); g.lineTo(98, 24.5); g.stroke(); g.globalAlpha = 1;
    // couture / rapiéçage sur la toile
    if (fac === 'cats') {
      pawPrint(g, 62, 20.5, 3.1, 'rgba(255,255,255,0.8)');
    } else if (fac === 'birds') {
      featherMark(g, 62, 20, 3.4, 'rgba(255,255,255,0.85)');
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; // brindilles cousues sur l'ourlet
      g.beginPath(); g.moveTo(40, 17.5); g.lineTo(46, 16.8); g.stroke();
    } else {
      g.fillStyle = 'rgba(255,255,255,0.14)'; rr(g, 74, 16, 9, 7, 1.5); g.fill();
      g.strokeStyle = 'rgba(90,86,78,0.6)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(74, 17.5); g.lineTo(83, 18); g.moveTo(74.5, 21.5); g.lineTo(83, 21); g.stroke();
    }

    // ---- foyer de forge (entre râtelier et billot)
    var fx = 43, fy = 79;
    g.fillStyle = STONE_SH;
    [[-7, 1.5], [-3.5, 3.6], [1.5, 3.8], [6, 2], [8, -.8]].forEach(function (q) {
      g.beginPath(); g.ellipse(fx + q[0], fy + q[1], 3.4, 2.4, .3, 0, TAU); g.fill();
    });
    if (cold) {
      g.fillStyle = '#5e584e';
      g.beginPath(); g.ellipse(fx, fy + 1, 5.5, 2.6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; // cendres froides
      g.beginPath(); g.ellipse(fx - 1, fy + .4, 2.6, 1.1, .2, 0, TAU); g.fill();
    } else {
      g.fillStyle = '#4a3020';
      g.beginPath(); g.ellipse(fx, fy + 1, 5.5, 2.6, 0, 0, TAU); g.fill();
      var glow = 0.55 + 0.18 * Math.sin(PH * TAU); // braises qui respirent
      var gg = g.createRadialGradient(fx, fy, 1, fx, fy, 7);
      gg.addColorStop(0, 'rgba(255,180,80,' + glow + ')');
      gg.addColorStop(.55, 'rgba(240,110,50,' + glow * .55 + ')');
      gg.addColorStop(1, 'rgba(240,110,50,0)');
      g.fillStyle = gg; g.beginPath(); g.arc(fx, fy, 7, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,225,150,' + (0.5 + 0.25 * Math.sin(PH * TAU * 3)) + ')';
      g.beginPath(); g.arc(fx - 1.5, fy + .5, 1.1, 0, TAU); g.fill();
      g.beginPath(); g.arc(fx + 2, fy - .3, .9, 0, TAU); g.fill();
    }

    // ---- billot + enclume
    stump(g, 68, 66, 84, 12);
    var ironC = cold ? '#9a9288' : (fac === 'birds' ? STONE : '#6e7076'); // bec-enclume en pierre chez les oiseaux
    anvil(g, 68, 48, ironC, fac === 'birds');
    if (cold) { // rouille élégante sur la forge éteinte
      g.strokeStyle = 'rgba(160,96,52,0.5)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(61, 50); g.quadraticCurveTo(60, 56, 62, 60); g.stroke();
      g.beginPath(); g.moveTo(73, 51); g.quadraticCurveTo(74, 55, 73, 58); g.stroke();
      moss(g, 60, 65.5, 4.5, 1.8, .6);
    } else if (fac === 'birds') {
      g.fillStyle = 'rgba(47,126,168,0.8)'; // œil peint sur le bec-enclume
      g.beginPath(); g.arc(76, 51.5, 1.3, 0, TAU); g.fill();
    }

    // ---- le marteau : levier monté sur le poteau droit, il frappe la table
    if (cold) {
      // forge froide : marteau posé sur l'enclume, pinces contre le billot
      hammer(g, 88, 60, 74, 49, '#8a857c', null);
      g.strokeStyle = PAL.neutre.door; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(55, 83); g.lineTo(59, 68); g.stroke();
      g.beginPath(); g.moveTo(58, 83); g.lineTo(59.5, 68); g.stroke();
      g.beginPath(); g.arc(59.3, 67, 1.6, 0, TAU); g.stroke();
      grassBlade(g, 28, 86, 0.05 * Math.sin(PH * TAU)); // seul frémissement
    } else {
      var ang = 0.10 + 0.10 * sw; // levé quand sw=+1, impact quand sw=-1
      g.save(); g.translate(91, 40); g.rotate(ang);
      g.fillStyle = W3; g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill(); // axe
      hammer(g, 0, 0, -21, 8, fac === 'cats' ? '#6e7076' : STONE_SH,
        fac === 'cats' ? mix(PAL.cats.accent, '#ffffff', .35) : null);
      if (fac === 'birds') { // plumette nouée au manche
        featherMark(g, -10, 6.5, 2.4, shade(P.flag, .3));
      }
      g.restore();
      sparkStar(g, 66, 44, 5, Math.pow(Math.max(0, -sw), 8) * .95); // étincelle à l'impact
    }

    // ---- petits détails de sol
    if (fac === 'cats') {
      pawPrint(g, 51, 86, 2, 'rgba(120,86,50,0.5)');
      g.fillStyle = P.accent; g.beginPath(); g.arc(87, 84.5, 3.6, 0, TAU); g.fill(); // pelote qui traîne
      g.strokeStyle = shade(P.accent, -.35); g.lineWidth = .9;
      g.beginPath(); g.arc(87, 84.5, 2.3, .5, 2.9); g.stroke();
      g.beginPath(); g.moveTo(90.4, 85.6); g.quadraticCurveTo(96, 87.5, 100, 85.5); g.stroke();
    } else if (fac === 'birds') {
      g.fillStyle = STRAW; // graines renversées
      [[52, 86.5], [55.5, 87.5], [58, 86], [54, 85.2]].forEach(function (q) {
        g.beginPath(); g.ellipse(q[0], q[1], 1.2, .8, .5, 0, TAU); g.fill();
      });
      taperedStroke(g, [[100, 84], [103, 79]], 2.2, .7, '#e6ddc4'); // plume tombée
    } else {
      moss(g, 88, 85.5, 5, 2.2, .5);
      g.fillStyle = STONE; g.beginPath(); g.ellipse(20, 86.5, 3, 1.6, .2, 0, TAU); g.fill();
    }
  }

  // ============================================================
  // 2) CAMP D'ENTRAÎNEMENT — mannequin de paille, cible, haltères
  // ============================================================
  function drawDummyBody(g, P, fac) {
    // corps de paille (dessiné dans le repère du mannequin, pivot 46,84)
    var slump = fac === 'neutre';
    rr(g, 44, 44, 4, 40, 2); // pique centrale
    var pg = g.createLinearGradient(43, 0, 47, 0);
    pg.addColorStop(0, shade(WL, .15)); pg.addColorStop(1, shade(WL, -.25));
    g.fillStyle = pg; rr(g, 44, 44, 4, 40, 2); g.fill();
    // bras (traverse) + moufles de paille
    twig(g, 31, 50.5, 61, 48.5, 3, slump ? PAL.neutre.door : W1);
    g.fillStyle = slump ? mix(STRAW, '#b2aea6', .55) : STRAW;
    g.beginPath(); g.ellipse(30.5, 50.5, 3.6, 2.8, -.3, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(61.5, 48.3, 3.6, 2.8, .3, 0, TAU); g.fill();
    // torse dodu
    var straw0 = slump ? mix(STRAW, '#b2aea6', .5) : STRAW;
    var tg = g.createLinearGradient(35, 46, 57, 70);
    tg.addColorStop(0, shade(straw0, .2)); tg.addColorStop(1, shade(straw0, -.22));
    g.fillStyle = tg;
    g.beginPath(); g.ellipse(46, 58, 11.5, 12.5, slump ? .06 : 0, 0, TAU); g.fill();
    // brins de paille qui dépassent
    g.strokeStyle = shade(straw0, -.35); g.lineWidth = 1;
    [[36, 66, -3, 4], [56, 66, 3, 4], [40, 47, -2, -3.6], [52, 47, 2, -3.6]].forEach(function (q) {
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + q[2], q[1] + q[3]); g.stroke();
    });
    // ceinture de corde, double tour
    g.strokeStyle = slump ? 'rgba(100,96,88,0.85)' : 'rgba(138,106,68,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(35.5, 60); g.quadraticCurveTo(46, 63.5, 56.5, 60); g.stroke();
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(35.8, 62); g.quadraticCurveTo(46, 65.3, 56.2, 62); g.stroke();
    // texture paille du torse
    g.strokeStyle = 'rgba(150,112,50,' + (slump ? .3 : .45) + ')'; g.lineWidth = .9;
    [[42, 52, 41, 57], [47, 51, 47, 56], [51, 53, 52, 58], [43, 66, 42, 70], [50, 66, 51, 70]].forEach(function (q) {
      g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.stroke();
    });
    // tête
    g.save();
    if (slump) { g.translate(46, 43); g.rotate(.34); g.translate(-46, -43); }
    var hgd = g.createRadialGradient(43, 32, 1, 46, 35, 9);
    hgd.addColorStop(0, shade(straw0, .25)); hgd.addColorStop(1, shade(straw0, -.18));
    g.fillStyle = hgd;
    g.beginPath(); g.arc(46, 35, 7.6, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,112,50,0.5)'; g.lineWidth = .9;
    g.beginPath(); g.arc(46, 35, 5.2, .7, 2.2); g.stroke();
    if (fac === 'cats') {
      // les chats s'entraînent contre un mannequin-OISEAU : bec + plume
      g.fillStyle = '#e8a03c';
      g.beginPath(); g.moveTo(43.5, 36.5); g.lineTo(48.5, 36.5); g.lineTo(46, 41); g.closePath(); g.fill();
      g.fillStyle = '#4a3a28';
      g.beginPath(); g.arc(42.6, 33.4, 1.15, 0, TAU); g.fill();
      g.beginPath(); g.arc(49.4, 33.4, 1.15, 0, TAU); g.fill();
      featherMark(g, 48.5, 27, 3, PAL.birds.wallSh); // houppette de plumes
    } else if (fac === 'birds') {
      // les oiseaux s'entraînent contre un mannequin-CHAT : oreilles + moustaches
      g.fillStyle = straw0;
      g.beginPath(); g.moveTo(40, 31); g.lineTo(38.5, 24); g.lineTo(44.5, 28.4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(52, 31); g.lineTo(53.5, 24); g.lineTo(47.5, 28.4); g.closePath(); g.fill();
      g.fillStyle = '#4a3a28';
      g.beginPath(); g.arc(43, 33.6, 1.1, 0, TAU); g.fill();
      g.beginPath(); g.arc(49, 33.6, 1.1, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(45, 36.6); g.lineTo(47, 36.6); g.lineTo(46, 38.2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(74,58,40,0.75)'; g.lineWidth = .8;
      [[41, 36.3, 36.4, 35.4], [41, 37.6, 36.6, 38], [51, 36.3, 55.6, 35.4], [51, 37.6, 55.4, 38]].forEach(function (q) {
        g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[2], q[3]); g.stroke();
      });
    } else {
      // mannequin fatigué : un œil-bouton, une couture triste
      g.fillStyle = '#5e584e'; g.beginPath(); g.arc(43.4, 34.2, 1.3, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(94,88,78,0.8)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(47.5, 33.2); g.lineTo(50.5, 34.8); g.moveTo(47.6, 34.8); g.lineTo(50.4, 33.2); g.stroke();
      g.beginPath(); g.moveTo(43, 39); g.quadraticCurveTo(46, 37.6, 49, 39.2); g.stroke();
    }
    g.restore();
    // marques d'entraînement sur le torse
    if (fac === 'cats') {
      g.strokeStyle = 'rgba(150,100,40,0.8)'; g.lineWidth = 1.2;
      [-3.4, 0, 3.4].forEach(function (d) {
        g.beginPath(); g.moveTo(42 + d, 52.5); g.quadraticCurveTo(44 + d, 57.5, 43 + d, 62); g.stroke();
      });
    } else if (fac === 'birds') {
      g.fillStyle = 'rgba(120,86,44,0.75)'; // impacts de bec
      [[42.5, 55], [49, 53.5], [46, 59.5]].forEach(function (q) {
        g.beginPath(); g.arc(q[0], q[1], 1.05, 0, TAU); g.fill();
      });
    } else {
      g.fillStyle = 'rgba(178,174,166,0.9)'; rr(g, 41, 56, 7, 6, 1.5); g.fill();
      g.strokeStyle = 'rgba(110,106,98,0.8)'; g.lineWidth = .8; // rapiéçage
      g.beginPath(); g.moveTo(41, 57.6); g.lineTo(48, 58); g.moveTo(41, 60.4); g.lineTo(48, 60); g.stroke();
    }
  }

  function drawTraining(g, animT, fac) {
    var P = PAL[fac], PH = (animT % 3.2) / 3.2, slump = fac === 'neutre';
    softShadow(g, 56, 88, 34, 10, 0.24);
    softShadow(g, 88, 87, 15, 5.5, 0.16);

    // ---- cible ronde sur piquet (droite)
    twig(g, 88, 84, 88, 58, 3.2, slump ? PAL.neutre.door : W2);
    twig(g, 88, 70, 98, 84, 2.4, slump ? PAL.neutre.door : W2); // jambe de force
    var ringA = slump ? mix(P.flag, '#d8d5ce', .35) : P.flag;
    var discs = [[12.2, slump ? shade(ringA, -.1) : shade(ringA, -.05)], [9, '#f2e6c0'], [5.8, ringA], [2.6, slump ? '#9a968e' : P.accent]];
    discs.forEach(function (q) {
      g.fillStyle = q[1];
      g.beginPath(); g.arc(88, 52, q[0], 0, TAU); g.fill();
    });
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.1;
    g.beginPath(); g.arc(88, 52, 12.2, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.ellipse(84, 47, 4.5, 2.6, -.6, 0, TAU); g.fill();
    if (fac === 'cats') {
      // pelote écrasée sur la cible, fil qui pend
      g.fillStyle = shade(P.accent, .1);
      g.beginPath(); g.ellipse(84.5, 50, 3.2, 2.7, .3, 0, TAU); g.fill();
      g.strokeStyle = shade(P.accent, -.3); g.lineWidth = .9;
      g.beginPath(); g.arc(84.5, 50, 1.9, .4, 2.6); g.stroke();
      g.beginPath(); g.moveTo(85, 52.6); g.quadraticCurveTo(83, 62, 85.5, 70); g.stroke();
    } else if (fac === 'birds') {
      // deux flèches empennées plantées
      [[93.5, 47.5, .5], [84, 56.5, 2.4]].forEach(function (q) {
        g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
        twig(g, 0, 0, 9, -4, 1.5, W2);
        g.fillStyle = shade(P.flag, .2);
        g.beginPath(); g.moveTo(9, -4); g.lineTo(13, -7.5); g.lineTo(11.5, -3.2); g.lineTo(14, -1.6); g.closePath(); g.fill();
        g.restore();
      });
    } else {
      // cible ébréchée + vieille flèche cassée au pied
      g.fillStyle = '#c6c2ba';
      g.beginPath(); g.moveTo(97.5, 45); g.lineTo(100.5, 48); g.lineTo(96.8, 49.5); g.closePath(); g.fill();
      twig(g, 94, 83, 101, 80, 1.4, PAL.neutre.roofSh);
      moss(g, 88, 63, 3.4, 1.6, .55);
    }

    // ---- banc d'haltères (gauche)
    if (!slump) {
      g.fillStyle = shade(W1, -.05); rr(g, 13, 73, 26, 4, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, 14, 73.6, 24, 1.2, .6); g.fill();
      twig(g, 16, 77, 15, 84, 2.6, W2); twig(g, 36, 77, 37, 84, 2.6, W2);
      // barre + poids de faction
      twig(g, 15, 68.5, 37, 68.5, 2, '#7a746a');
      if (fac === 'cats') {
        [15, 37].forEach(function (x) {
          g.fillStyle = P.flag; g.beginPath(); g.arc(x, 68.5, 5, 0, TAU); g.fill();
          g.strokeStyle = shade(P.flag, -.35); g.lineWidth = 1;
          g.beginPath(); g.arc(x, 68.5, 3.3, .6, 2.8); g.stroke();
          g.beginPath(); g.arc(x, 68.5, 1.8, 3.3, 5.5); g.stroke();
        });
        pawPrint(g, 26, 84.5, 2, 'rgba(120,86,50,0.5)');
      } else {
        [15, 37].forEach(function (x) {
          g.fillStyle = '#cfc4ae'; g.beginPath(); g.ellipse(x, 68.5, 4.4, 5.4, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(140,120,80,0.55)';
          g.beginPath(); g.arc(x - 1.2, 69.5, .8, 0, TAU); g.fill();
          g.beginPath(); g.arc(x + 1.3, 67.2, .6, 0, TAU); g.fill();
        });
        g.fillStyle = STRAW;
        [[24, 86], [27.5, 85], [25.5, 87.2]].forEach(function (q) {
          g.beginPath(); g.ellipse(q[0], q[1], 1.1, .75, .4, 0, TAU); g.fill();
        });
      }
    } else {
      // banc renversé, poids fendu : plus personne ne s'entraîne ici
      g.save(); g.translate(24, 80); g.rotate(-.28);
      g.fillStyle = PAL.neutre.roof; rr(g, -12, -2, 24, 4, 2); g.fill();
      g.restore();
      g.fillStyle = '#b8b2a4'; g.beginPath(); g.ellipse(14, 84, 4.6, 3.6, .2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(12, 81.5); g.lineTo(14.5, 84.5); g.lineTo(13.4, 86.8); g.stroke();
      grassBlade(g, 36, 86, 0.06 * Math.sin(PH * TAU));
    }

    // ---- mannequin (au centre) : il encaisse et oscille
    // socle : butte de terre + sacs de sable
    g.fillStyle = slump ? '#b2aea6' : '#b8a284';
    g.beginPath(); g.ellipse(46, 84, 12, 4.6, 0, 0, TAU); g.fill();
    g.fillStyle = slump ? '#a8a49c' : '#c9b18e';
    g.beginPath(); g.ellipse(52.5, 85.5, 4.6, 3, .3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = .8;
    g.beginPath(); g.moveTo(50, 85); g.lineTo(55, 86); g.stroke();
    var rot = slump
      ? 0.10 + 0.02 * Math.sin(PH * TAU)                       // affaissé, presque immobile
      : 0.075 * Math.sin(PH * TAU * 2) + 0.03 * Math.sin(PH * TAU * 3); // vient d'encaisser
    g.save(); g.translate(46, 84); g.rotate(rot); g.translate(-46, -84);
    drawDummyBody(g, P, fac);
    g.restore();
  }

  // ============================================================
  // 3) ATELIER D'ARMURIER — tente ouverte, établi, meule qui tourne
  // ============================================================
  function drawArmory(g, animT, fac) {
    var P = PAL[fac], PH = (animT % 3.2) / 3.2, dead = fac === 'neutre';
    softShadow(g, 56, 88, 34, 10, 0.24);
    softShadow(g, 90, 87, 15, 5.5, 0.16);

    // ---- tente-atelier ouverte (gauche)
    var apexX = 44, apexY = dead ? 24 : 19;
    var cg = g.createLinearGradient(0, apexY, 0, 84);
    cg.addColorStop(0, shade(P.roof, .22)); cg.addColorStop(.6, P.roof); cg.addColorStop(1, shade(P.roof, -.18));
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(12, 84);
    if (dead) { g.quadraticCurveTo(26, 46, apexX, apexY); } // pente qui s'affaisse
    else { g.quadraticCurveTo(24, 48, apexX, apexY); }
    g.quadraticCurveTo(62, 46, 76, 84);
    g.quadraticCurveTo(44, 87.5, 12, 84);
    g.closePath(); g.fill();
    // coutures de la toile
    g.strokeStyle = shade(P.roofSh, -.1); g.lineWidth = 1; g.globalAlpha = .55;
    g.beginPath(); g.moveTo(apexX - 1, apexY + 5); g.quadraticCurveTo(30, 52, 24, 82); g.stroke();
    g.beginPath(); g.moveTo(apexX + 1, apexY + 5); g.quadraticCurveTo(58, 52, 64, 82); g.stroke();
    g.globalAlpha = 1;
    // ouverture sombre + pan retroussé
    g.fillStyle = 'rgba(34,28,22,0.88)';
    g.beginPath(); g.moveTo(apexX, apexY + 9);
    g.quadraticCurveTo(56, 48, 60, 84); g.lineTo(29, 84);
    g.quadraticCurveTo(34, 50, apexX, apexY + 9); g.closePath(); g.fill();
    g.fillStyle = shade(P.roofSh, .12); // pan roulé sur le côté
    g.beginPath(); g.moveTo(29.5, 84); g.quadraticCurveTo(33, 52, apexX - 1, apexY + 8);
    g.quadraticCurveTo(38, 54, 36.5, 84); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = .9;
    g.beginPath(); g.moveTo(34.5, 60); g.quadraticCurveTo(36.4, 72, 35.5, 82); g.stroke();
    // piquet de faîte + corde d'ancrage
    twig(g, apexX, apexY + 2, apexX, apexY - 6, 2.2, dead ? PAL.neutre.door : W2);
    g.strokeStyle = dead ? 'rgba(100,96,88,0.7)' : 'rgba(90,64,32,0.7)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(apexX - .5, apexY - 4); g.lineTo(20, 84); g.stroke();
    twig(g, 19, 80, 21, 85, 2, dead ? PAL.neutre.door : W2);
    // emblème sur la toile
    if (fac === 'cats') pawPrint(g, 22, 68, 3, 'rgba(255,255,255,0.8)');
    else if (fac === 'birds') featherMark(g, 22, 67, 3.6, 'rgba(255,255,255,0.85)');
    else {
      g.fillStyle = 'rgba(255,255,255,0.16)'; rr(g, 17, 62, 8.5, 7, 1.5); g.fill();
      g.strokeStyle = 'rgba(90,86,78,0.6)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(17.5, 64); g.lineTo(25, 64.5); g.moveTo(17.5, 67.5); g.lineTo(25, 67); g.stroke();
      moss(g, 15, 81, 4.5, 2, .6);
    }

    // ---- établi dans l'ouverture, outils dessus
    g.fillStyle = shade(W1, .08); rr(g, 33, 66, 24, 3.6, 1.6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.16)'; rr(g, 34, 66.5, 22, 1.1, .5); g.fill();
    twig(g, 36, 69, 35, 83, 2.2, W3); twig(g, 54, 69, 55, 83, 2.2, W3);
    if (dead) {
      // outils abandonnés à plat, toile d'araignée dans l'ouverture
      twig(g, 38, 64.5, 46, 65.5, 1.6, '#7a746a');
      g.fillStyle = '#8a857c'; rr(g, 44.5, 62.8, 4.4, 3.4, 1.2); g.fill();
      g.strokeStyle = 'rgba(230,230,225,0.4)'; g.lineWidth = .7;
      g.beginPath(); g.moveTo(41, 36); g.lineTo(50, 46); g.moveTo(46.5, 34); g.lineTo(44, 46);
      g.moveTo(42, 40.5); g.quadraticCurveTo(46, 42.5, 49.5, 41.5); g.stroke();
    } else {
      // marteau posé + lame en attente
      g.save(); g.translate(41, 64.6); g.rotate(-.15);
      twig(g, -4, .6, 4, -.6, 1.6, WL);
      g.fillStyle = '#6e7076'; rr(g, 3, -3.2, 4.2, 5, 1.4); g.fill();
      g.restore();
      g.fillStyle = fac === 'cats' ? '#d9dde2' : '#cfc4ae';
      g.beginPath(); g.moveTo(48, 65.6); g.quadraticCurveTo(53, 62.5, 56, 63.4);
      g.quadraticCurveTo(53, 65.4, 48.6, 66.6); g.closePath(); g.fill();
    }
    // outils suspendus au bord de la toile (tenailles + maillet)
    var swingT = dead ? 0.07 * Math.sin(PH * TAU) : 0; // le pendu se balance si abandonné
    g.save(); g.translate(63, 52); g.rotate(swingT);
    g.strokeStyle = 'rgba(70,54,30,0.85)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 6); g.stroke();
    g.strokeStyle = dead ? '#8a857c' : '#6e7076'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-2.2, 6); g.quadraticCurveTo(0, 9, -1.6, 12.5); g.stroke();
    g.beginPath(); g.moveTo(2.2, 6); g.quadraticCurveTo(0, 9, 1.6, 12.5); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(70,54,30,0.85)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(70, 56.5); g.lineTo(70, 61); g.stroke();
    twig(g, 67.6, 61.5, 72.4, 61.5, 2.6, dead ? '#8a857c' : WL); // petit maillet

    // ---- meule à aiguiser (droite) sur chevalet
    var mx = 90, my = 60, mr = 12.5;
    twig(g, 81, 84, mx - 1.5, my + 2, 3, dead ? PAL.neutre.door : W2);
    twig(g, 100, 84, mx + 1.5, my + 2, 3, dead ? PAL.neutre.door : W2);
    twig(g, 80, 84, 101, 84, 2.6, dead ? PAL.neutre.door : W1);
    var wg = g.createRadialGradient(mx - 4, my - 5, 2, mx, my, mr + 1);
    wg.addColorStop(0, shade(STONE, .22)); wg.addColorStop(.75, STONE); wg.addColorStop(1, shade(STONE, -.24));
    g.fillStyle = wg;
    g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    g.strokeStyle = shade(STONE_SH, -.15); g.lineWidth = 2.2;
    g.beginPath(); g.arc(mx, my, mr - 1.1, 0, TAU); g.stroke();
    // rotation : 4 évidements + repère de tranche tournent (2 tours / boucle)
    var ang = dead ? 0.55 : PH * TAU * 2;
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (var i = 0; i < 4; i++) {
      var a = ang + i * TAU / 4;
      g.beginPath(); g.arc(mx + Math.cos(a) * 6.4, my + Math.sin(a) * 6.4, 1.7, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(mx, my, mr - 3.4, ang + .35, ang + 1.5); g.stroke();
    // moyeu + manivelle solidaire de la roue
    g.fillStyle = W3; g.beginPath(); g.arc(mx, my, 2.6, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(mx - .7, my - .7, .9, 0, TAU); g.fill();
    if (!dead) {
      var ca = ang + .9;
      twig(g, mx, my, mx + Math.cos(ca) * 5.5, my + Math.sin(ca) * 5.5, 1.8, W2);
      g.fillStyle = WL;
      g.beginPath(); g.arc(mx + Math.cos(ca) * 5.5, my + Math.sin(ca) * 5.5, 1.7, 0, TAU); g.fill();
    } else {
      g.strokeStyle = 'rgba(160,96,52,0.45)'; g.lineWidth = 1.2; // rouille fine
      g.beginPath(); g.arc(mx, my, mr - 5.5, 2.6, 4.1); g.stroke();
      moss(g, mx + 8, my + 9, 3.6, 1.7, .55);
    }

    // ---- la lame qu'on aiguise + micro-étincelles au contact
    if (!dead) {
      var bx = mx - 9.5, by = my - 8.5; // point de contact haut-gauche
      g.save(); g.translate(bx, by); g.rotate(-.5);
      g.fillStyle = fac === 'cats' ? '#dfe3e8' : '#d8cdb4';
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-8, -6.5, -14, -6);
      g.quadraticCurveTo(-9, -2.6, -.5, 1.6); g.closePath(); g.fill();
      g.fillStyle = fac === 'cats' ? mix(PAL.cats.accent, '#ffffff', .3) : shade(PAL.birds.flag, .1);
      rr(g, -17.5, -8.2, 5, 4, 1.6); g.fill(); // petite poignée faction
      g.restore();
      for (var s = 0; s < 3; s++) {
        var p = (PH * 4 + s / 3) % 1, fa = Math.sin(p * Math.PI);
        var sx = bx - 2 - p * 8 - s, sy = by - 2 - p * 5 + p * p * 6 + s * .8;
        g.fillStyle = 'rgba(255,214,110,' + (fa * .85) + ')';
        g.beginPath(); g.arc(sx, sy, 1.1 - p * .5, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(255,240,190,' + (0.35 + 0.25 * Math.sin(PH * TAU * 4)) + ')';
      g.beginPath(); g.arc(bx - 1, by - 1, 1.3, 0, TAU); g.fill();
    }

    // ---- détails de faction au sol
    if (fac === 'cats') {
      g.fillStyle = P.accent; g.beginPath(); g.arc(70, 82, 3.4, 0, TAU); g.fill();
      g.strokeStyle = shade(P.accent, -.35); g.lineWidth = .9;
      g.beginPath(); g.arc(70, 82, 2.1, .5, 2.8); g.stroke();
      pawPrint(g, 63, 86, 1.9, 'rgba(120,86,50,0.5)');
    } else if (fac === 'birds') {
      twig(g, 74, 84, 79, 76, 1.5, W2); // flèche fraîchement finie
      g.fillStyle = shade(P.flag, .2);
      g.beginPath(); g.moveTo(79, 76); g.lineTo(82.5, 72.5); g.lineTo(81.2, 76.6); g.closePath(); g.fill();
      g.fillStyle = STRAW;
      [[65, 86], [68, 87], [66.5, 84.8]].forEach(function (q) {
        g.beginPath(); g.ellipse(q[0], q[1], 1.1, .75, .4, 0, TAU); g.fill();
      });
    } else {
      grassBlade(g, 74, 86, 0.05 * Math.sin(PH * TAU + 0));
      g.fillStyle = STONE; g.beginPath(); g.ellipse(66, 86, 2.8, 1.5, .3, 0, TAU); g.fill();
    }
  }

  // ============================================================
  // Enregistrement des variantes
  // ============================================================
  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  var CONCEPTS = [
    { id: 'forge-de-camp', label: 'Forge de camp', fn: drawForge,
      anim: { cats: 'le marteau frappe l\'enclume', birds: 'le marteau frappe l\'enclume', neutre: 'brin d\'herbe qui frémit' } },
    { id: 'camp-entrainement', label: 'Camp d\'entraînement', fn: drawTraining,
      anim: { cats: 'le mannequin encaisse et oscille', birds: 'le mannequin encaisse et oscille', neutre: 'oscillation infime du mannequin' } },
    { id: 'atelier-armurier', label: 'Atelier d\'armurier', fn: drawArmory,
      anim: { cats: 'la meule tourne, micro-étincelles', birds: 'la meule tourne, micro-étincelles', neutre: 'les tenailles pendues se balancent' } }
  ];
  [['banner_cats', 'cats'], ['banner_birds', 'birds'], ['banner_neutre', 'neutre']].forEach(function (S) {
    var slot = S[0], fac = S[1];
    CONCEPTS.forEach(function (C) {
      reg(slot, {
        id: C.id, label: C.label, anim: C.anim[fac],
        draw: (function (fn, f) { return function (g, animT) { fn(g, animT || 0, f); }; })(C.fn, fac)
      });
    });
  });
})();
