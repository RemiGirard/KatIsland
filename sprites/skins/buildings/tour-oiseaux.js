/* ============================================================
   LAB — tour-oiseaux.js
   4 variantes de TOUR DE GARDE DES OISEAUX (slot 'defense_birds')
   Style peint doux "jelly/goofy", canvas 112x112, anim boucle 3.2 s.
   ============================================================ */
"use strict";
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers self-contained ----------
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

  // palette oiseaux + matériaux du jeu
  var P = { wall:'#e6f1f8', wallSh:'#bcd6e6', roof:'#48a9d8', roofSh:'#2f7ea8', accent:'#3a86ff', door:'#4a6a80' };
  var WICKER = '#c89a5c', WOOD = '#8a6a44', WOOD_D = '#54402a', WOOD_M = '#6e5434', SEED = '#e8c96a';

  // petite sentinelle stylisee (silhouette ronde + bec) ; headAng = rotation de la tete
  function sentinel(g, x, y, s, cBody, headAng, flip) {
    var f = flip ? -1 : 1;
    g.save(); g.translate(x, y); g.scale(f, 1);
    // queue
    g.fillStyle = shade(cBody, -.18);
    g.beginPath(); g.moveTo(-2.4*s, -0.4*s);
    g.quadraticCurveTo(-5.4*s, -1.4*s, -5.8*s, 1.6*s);
    g.quadraticCurveTo(-3.6*s, 1.4*s, -2.2*s, 1.2*s); g.closePath(); g.fill();
    // corps dodu
    g.fillStyle = cBody;
    g.beginPath(); g.ellipse(0, 0, 3.1*s, 2.6*s, 0, 0, TAU); g.fill();
    // ventre clair
    g.fillStyle = shade(cBody, .3);
    g.beginPath(); g.ellipse(0.6*s, 0.8*s, 1.9*s, 1.4*s, 0, 0, TAU); g.fill();
    // tete pivotante
    g.save(); g.translate(2.1*s, -2.5*s); g.rotate(headAng || 0);
    g.fillStyle = cBody;
    g.beginPath(); g.arc(0, 0, 1.9*s, 0, TAU); g.fill();
    g.fillStyle = '#f4c542';
    g.beginPath(); g.moveTo(1.5*s, -0.5*s); g.lineTo(3.5*s, 0.2*s); g.lineTo(1.4*s, 0.9*s); g.closePath(); g.fill();
    g.fillStyle = 'rgba(20,26,32,.9)';
    g.beginPath(); g.arc(0.5*s, -0.5*s, 0.55*s, 0, TAU); g.fill();
    g.restore();
    g.restore();
  }

  // brindilles tissees horizontales dans une zone clippee
  function weaveRows(g, y0, y1, xAt, step) {
    for (var y = y0, i = 0; y < y1; y += step, i++) {
      var span = xAt(y), xl = span[0], xr = span[1];
      var c = (i % 3 === 0) ? shade(WICKER, .18) : (i % 3 === 1) ? WICKER : shade(WICKER, -.2);
      g.strokeStyle = c; g.lineWidth = 2.1; g.lineCap = 'round';
      var seg = (xr - xl) / 3;
      for (var k2 = 0; k2 < 3; k2++) {
        var sx = xl + seg * k2 + 1, ex = xl + seg * (k2 + 1) - 1;
        g.beginPath(); g.moveTo(sx, y + (k2 % 2 ? 1 : 0));
        g.quadraticCurveTo((sx + ex) / 2, y + (k2 % 2 ? -1.6 : 1.6), ex, y + (k2 % 2 ? 0 : 1));
        g.stroke();
      }
    }
  }

  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  // ============================================================
  // 1) TOUR PERCHOIR ROYAL — brindilles tressees, perchoirs en
  //    spirale, toit champignon bleu a pompon. La sentinelle du
  //    sommet tourne la tete.
  // ============================================================
  reg('defense_birds', {
    id: 'tour-perchoir-royal', label: 'Tour perchoir royal',
    anim: 'la sentinelle tourne la tête',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      var headAng = Math.sin(PH * TAU) * 0.18 + Math.sin(PH * TAU * 2) * 0.05;
      softShadow(g, 56, 88, 34, 10, 0.24);
      // butte d'herbe et pierres au pied
      g.fillStyle = '#9a8f76';
      g.beginPath(); g.ellipse(56, 84, 22, 7.5, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(122,160,90,.7)';
      g.beginPath(); g.ellipse(42, 84.5, 7, 3, .2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(70, 85.5, 6, 2.6, -.2, 0, TAU); g.fill();
      // fut de la tour : trapeze aux flancs bombes, s'affine vers le haut
      function xAt(y) {
        var t = (y - 26) / (84 - 26);           // 0 en haut, 1 en bas
        var half = 8 + 8.5 * t + Math.sin(t * Math.PI) * 2.2; // ventre jelly
        return [56 - half, 56 + half];
      }
      var body = g.createLinearGradient(38, 0, 74, 0);
      body.addColorStop(0, shade(WICKER, .22));
      body.addColorStop(.55, WICKER);
      body.addColorStop(1, shade(WICKER, -.28));
      g.beginPath();
      g.moveTo(xAt(84)[0], 84);
      g.quadraticCurveTo(xAt(55)[0] - 1.5, 55, xAt(26)[0], 26);
      g.lineTo(xAt(26)[1], 26);
      g.quadraticCurveTo(xAt(55)[1] + 1.5, 55, xAt(84)[1], 84);
      g.quadraticCurveTo(56, 88, xAt(84)[0], 84);
      g.closePath();
      g.save(); g.clip();
      g.fillStyle = body; g.fillRect(30, 24, 52, 66);
      weaveRows(g, 30, 84, xAt, 5.2);
      // ombre interne au pied + rehaut haut-gauche
      var iv = g.createLinearGradient(0, 60, 0, 86);
      iv.addColorStop(0, 'rgba(0,0,0,0)'); iv.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = iv; g.fillRect(30, 58, 52, 30);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath(); g.ellipse(48, 36, 7, 13, .25, 0, TAU); g.fill();
      g.restore();
      // porte d'envol sombre en bas, encadree de brindilles
      g.fillStyle = '#3a2c18';
      g.beginPath(); g.arc(56, 78, 6.2, Math.PI, 0); g.lineTo(62.2, 84); g.lineTo(49.8, 84); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.beginPath(); g.arc(54, 76, 2.4, 0, TAU); g.fill();
      twig(g, 48.5, 84, 49.5, 72.5, 1.8, WOOD_M);
      twig(g, 63.5, 84, 62.5, 72.5, 1.8, WOOD_M);
      // 3 perchoirs en spirale + sentinelles
      twig(g, 40, 68, 30, 64, 2.6, WOOD_M);
      twig(g, 30, 64, 30, 67.5, 1.4, WOOD_D);
      sentinel(g, 31, 60.5, 1.05, P.door, Math.sin(PH * TAU) * 0.06, true);
      twig(g, 72, 55, 82, 50.5, 2.6, WOOD_M);
      twig(g, 82, 50.5, 82, 54, 1.4, WOOD_D);
      sentinel(g, 81, 47, 1.0, mix(P.door, P.roof, .35), Math.sin(PH * TAU + 2) * 0.05, false);
      twig(g, 43, 41, 34, 37.5, 2.4, WOOD_M);
      sentinel(g, 35, 34.5, 0.9, P.door, Math.sin(PH * TAU + 4) * 0.05, true);
      // toit champignon bleu, bien dodu
      var cap = g.createRadialGradient(48, 16, 3, 56, 22, 26);
      cap.addColorStop(0, shade(P.roof, .32));
      cap.addColorStop(.6, P.roof);
      cap.addColorStop(1, P.roofSh);
      g.fillStyle = cap;
      g.beginPath();
      g.moveTo(34, 28);
      g.quadraticCurveTo(36, 11, 56, 10.5);
      g.quadraticCurveTo(76, 11, 78, 28);
      g.quadraticCurveTo(70, 31.5, 56, 31.5);
      g.quadraticCurveTo(42, 31.5, 34, 28);
      g.closePath(); g.fill();
      // lisiere du chapeau (ombre portee sur la tour)
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.beginPath(); g.ellipse(56, 29.5, 20, 3.4, 0, 0, TAU); g.fill();
      // pois clairs du champignon
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); g.ellipse(46, 18, 3.2, 2.4, .3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(64, 15.5, 2.4, 1.9, -.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(69, 23, 1.8, 1.4, .4, 0, TAU); g.fill();
      // pompon accent
      g.fillStyle = P.accent;
      g.beginPath(); g.arc(56, 9.5, 3.4, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.beginPath(); g.arc(54.8, 8.4, 1.3, 0, TAU); g.fill();
      // sentinelle royale du sommet, tete qui balaie l'horizon
      twig(g, 68, 27, 74, 20.5, 2.2, WOOD_M);
      sentinel(g, 74.5, 17, 1.15, mix(P.door, '#22303c', .35), headAng, false);
      // charmes : plume plantee dans le tressage + graines tombees
      featherMark(g, 43, 58, 4.6, 'rgba(255,255,255,.8)');
      g.fillStyle = SEED;
      g.beginPath(); g.arc(68, 82.5, 1.4, 0, TAU); g.fill();
      g.beginPath(); g.arc(72.5, 84.2, 1.2, 0, TAU); g.fill();
      g.beginPath(); g.arc(65, 85.5, 1.1, 0, TAU); g.fill();
    }
  });

  // ============================================================
  // 2) NID-BALLISTE — socle de pierres, nid fortifie a mi-hauteur,
  //    grande fronde de brindilles au sommet, panier de baies.
  //    L'elastique vibre puis se retend.
  // ============================================================
  reg('defense_birds', {
    id: 'nid-balliste', label: 'Nid-balliste',
    anim: 'l’élastique vibre et se retend',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      // vibration amortie qui boucle : forte juste apres le "tir", nulle a PH=0
      var env = 0.5 - 0.5 * Math.cos(PH * TAU);       // 0 -> 1 -> 0
      var vib = Math.sin(PH * TAU * 5) * 2.6 * env;    // tremblement de l'elastique
      softShadow(g, 56, 88, 34, 10, 0.24);
      // socle de grosses pierres rondes
      var stones = [
        [44, 80, 10, 7.5, .1], [66, 81, 9.5, 7, -.15],
        [56, 84, 11, 6.5, 0], [36, 84.5, 6.5, 4.5, .2], [75, 84.5, 6, 4.2, -.2],
      ];
      for (var i = 0; i < stones.length; i++) {
        var q = stones[i];
        var sg = g.createRadialGradient(q[0] - q[2] * .35, q[1] - q[3] * .5, 1, q[0], q[1], q[2] * 1.25);
        sg.addColorStop(0, shade('#a8a296', .2));
        sg.addColorStop(.65, '#a8a296');
        sg.addColorStop(1, '#8a8478');
        g.fillStyle = sg;
        g.beginPath(); g.ellipse(q[0], q[1], q[2], q[3], q[4], 0, TAU); g.fill();
      }
      // mousse douillette entre les pierres
      g.fillStyle = 'rgba(122,160,90,.75)';
      g.beginPath(); g.ellipse(48, 76.5, 5.5, 2.4, .3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(63, 78, 4.4, 2, -.25, 0, TAU); g.fill();
      // tronc-mat central, legerement conique
      var tg = g.createLinearGradient(49, 0, 63, 0);
      tg.addColorStop(0, shade(WOOD, .22)); tg.addColorStop(.5, WOOD); tg.addColorStop(1, WOOD_D);
      g.fillStyle = tg;
      g.beginPath();
      g.moveTo(50.5, 78); g.quadraticCurveTo(51.5, 55, 53, 34);
      g.lineTo(59, 34); g.quadraticCurveTo(60.5, 55, 61.5, 78);
      g.quadraticCurveTo(56, 80, 50.5, 78); g.closePath(); g.fill();
      // noeud du bois + corde d'arrimage
      g.fillStyle = 'rgba(50,34,16,.5)';
      g.beginPath(); g.ellipse(58, 68, 1.7, 2.4, .2, 0, TAU); g.fill();
      g.strokeStyle = '#e0cfa0'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(51.5, 62); g.lineTo(60.8, 60); g.stroke();
      g.beginPath(); g.moveTo(51.6, 64.2); g.lineTo(60.9, 62.2); g.stroke();
      // NID FORTIFIE a mi-hauteur : anneau de brindilles + petits pieux
      var ng = g.createLinearGradient(0, 42, 0, 58);
      ng.addColorStop(0, '#b08a54'); ng.addColorStop(1, '#7a5c34');
      g.fillStyle = ng;
      g.beginPath(); g.ellipse(56, 50, 22, 9.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#4e3a20';
      g.beginPath(); g.ellipse(56, 47.5, 15, 5.2, 0, 0, TAU); g.fill();
      // brindilles herissees du nid (bruit fixe code en dur)
      var tw = [
        [35, 51, 27, 47, 1.6], [39, 45, 31, 40.5, 1.4], [76, 50, 84.5, 46, 1.6],
        [73, 45, 81, 40, 1.4], [44, 56.5, 37, 60, 1.3], [69, 56.5, 76.5, 60, 1.3],
        [50, 42.5, 45, 37.5, 1.2], [63, 42.5, 68, 37.5, 1.2],
      ];
      for (var j = 0; j < tw.length; j++) {
        var t2 = tw[j];
        twig(g, t2[0], t2[1], t2[2], t2[3], t2[4], j % 2 ? '#8a6a3c' : '#c9a06a');
      }
      // pieux defensifs plantes dans le nid
      for (var k2 = 0; k2 < 4; k2++) {
        var px = [40, 48, 64, 72][k2];
        twig(g, px, 52, px - 1 + (k2 % 2) * 2, 42.5, 2.2, WOOD_M);
        g.fillStyle = shade(WOOD_M, .3);
        g.beginPath(); g.arc(px - 1 + (k2 % 2) * 2, 42, 1.2, 0, TAU); g.fill();
      }
      // oeuf casque qui monte la garde dans le nid
      g.fillStyle = '#f2ead2';
      g.beginPath(); g.ellipse(61, 45.5, 3.6, 4.4, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(140,120,80,.5)';
      g.beginPath(); g.arc(60, 46.5, .8, 0, TAU); g.fill();
      g.fillStyle = P.roofSh;
      g.beginPath(); g.arc(61, 43.5, 3.1, Math.PI * 1.05, Math.PI * 1.95);
      g.quadraticCurveTo(61, 41.2, 64, 43.2); g.closePath(); g.fill();
      // FRONDE au sommet : fourche en Y
      taperedStroke(g, [[56, 36], [50, 26], [45.5, 17.5]], 4.6, 2.6, WOOD_M);
      taperedStroke(g, [[56, 36], [62, 26], [66.5, 17.5]], 4.6, 2.6, WOOD_M);
      // ligatures aux pointes
      g.strokeStyle = P.accent; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(43.8, 19.5); g.lineTo(47.4, 18.6); g.stroke();
      g.beginPath(); g.moveTo(64.6, 18.6); g.lineTo(68.2, 19.5); g.stroke();
      // elastique vibrant + poche garnie d'une baie
      var midY = 26.5 + vib, midX = 56;
      g.strokeStyle = '#c9662a'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(45.5, 17.5);
      g.quadraticCurveTo(50, 22 + vib * .6, midX - 3.5, midY);
      g.moveTo(66.5, 17.5);
      g.quadraticCurveTo(62, 22 + vib * .6, midX + 3.5, midY);
      g.stroke();
      // poche de cuir
      g.fillStyle = '#9a7444';
      g.beginPath(); g.ellipse(midX, midY, 4.6, 3.2, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.beginPath(); g.ellipse(midX, midY + .8, 3.2, 1.6, 0, 0, TAU); g.fill();
      // baie chargee, prete a partir
      g.fillStyle = '#c0455a';
      g.beginPath(); g.arc(midX, midY - 1.4, 2.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)';
      g.beginPath(); g.arc(midX - .8, midY - 2.2, .9, 0, TAU); g.fill();
      // panier de munitions (baies) contre le socle
      var bg = g.createLinearGradient(0, 72, 0, 86);
      bg.addColorStop(0, shade(WICKER, .12)); bg.addColorStop(1, shade(WICKER, -.25));
      g.fillStyle = bg;
      g.beginPath(); g.moveTo(23, 75); g.quadraticCurveTo(24, 86, 31, 86);
      g.quadraticCurveTo(38, 86, 39, 75); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,60,26,.4)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(24.5, 79); g.quadraticCurveTo(31, 81, 37.5, 79); g.stroke();
      g.beginPath(); g.moveTo(25.5, 82.5); g.quadraticCurveTo(31, 84.2, 36.5, 82.5); g.stroke();
      // baies qui debordent
      var berries = [[27, 74], [31.5, 72.5], [36, 74.2], [29.5, 76]];
      for (var b = 0; b < berries.length; b++) {
        g.fillStyle = b % 2 ? '#c0455a' : '#a83a52';
        g.beginPath(); g.arc(berries[b][0], berries[b][1], 2.4, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)';
        g.beginPath(); g.arc(berries[b][0] - .8, berries[b][1] - .8, .8, 0, TAU); g.fill();
      }
      // charme : plume gardienne accrochee a la fourche
      featherMark(g, 68.5, 24, 4.2, 'rgba(255,255,255,.75)');
    }
  });

  // ============================================================
  // 3) PHARE A PLUME — tour effilee bleu pale, lanterne vitree,
  //    grande plume girouette. La girouette oscille, la lanterne pulse.
  // ============================================================
  reg('defense_birds', {
    id: 'phare-plume', label: 'Phare à plume',
    anim: 'girouette oscille, lanterne pulse',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      var vane = Math.sin(PH * TAU) * 0.14 + Math.sin(PH * TAU * 3) * 0.03;
      var glow = 0.30 + 0.16 * (0.5 + 0.5 * Math.sin(PH * TAU * 2));
      softShadow(g, 56, 88, 34, 10, 0.24);
      // assise de pierre
      g.fillStyle = '#8a8478';
      g.beginPath(); g.ellipse(56, 84, 20, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#a8a296';
      g.beginPath(); g.ellipse(56, 82, 17.5, 5.6, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(122,160,90,.65)';
      g.beginPath(); g.ellipse(43, 83.5, 5.5, 2.4, .25, 0, TAU); g.fill();
      // fut effile bleu pale, flancs doucement incurves
      var wg = g.createLinearGradient(40, 0, 72, 0);
      wg.addColorStop(0, shade(P.wall, .25));
      wg.addColorStop(.5, P.wall);
      wg.addColorStop(1, P.wallSh);
      g.fillStyle = wg;
      g.beginPath();
      g.moveTo(41, 82);
      g.quadraticCurveTo(45.5, 58, 48, 40);
      g.lineTo(64, 40);
      g.quadraticCurveTo(66.5, 58, 71, 82);
      g.quadraticCurveTo(56, 85.5, 41, 82);
      g.closePath(); g.fill();
      // bandes en spirale du phare, teinte toit
      g.save();
      g.beginPath();
      g.moveTo(41, 82); g.quadraticCurveTo(45.5, 58, 48, 40);
      g.lineTo(64, 40); g.quadraticCurveTo(66.5, 58, 71, 82);
      g.quadraticCurveTo(56, 85.5, 41, 82); g.closePath();
      g.clip();
      g.fillStyle = P.roof; g.globalAlpha = .85;
      var bands = [[40, 46.5, 7], [52, 49, 8], [64, 52, 9], [76, 55.5, 10]];
      for (var i = 0; i < bands.length; i++) {
        var by = bands[i][0], half = bands[i][2];
        g.beginPath();
        g.moveTo(56 - bands[i][1], by + 5);
        g.quadraticCurveTo(56, by + 8.5, 56 + bands[i][1], by + 3);
        g.lineTo(56 + bands[i][1], by + 3 + half);
        g.quadraticCurveTo(56, by + 8.5 + half, 56 - bands[i][1], by + 5 + half);
        g.closePath(); g.fill();
      }
      g.globalAlpha = 1;
      // ombre laterale interne + rehaut
      var iv = g.createLinearGradient(44, 0, 71, 0);
      iv.addColorStop(0, 'rgba(255,255,255,.28)');
      iv.addColorStop(.35, 'rgba(255,255,255,0)');
      iv.addColorStop(.8, 'rgba(0,0,0,0)');
      iv.addColorStop(1, 'rgba(30,50,70,.22)');
      g.fillStyle = iv; g.fillRect(38, 38, 36, 48);
      g.restore();
      // hublot rond au tiers, oeil du phare
      g.fillStyle = P.door;
      g.beginPath(); g.arc(56, 62, 4.6, 0, TAU); g.fill();
      g.fillStyle = '#22303c';
      g.beginPath(); g.arc(56, 62, 3.1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.arc(54.8, 60.8, 1.2, 0, TAU); g.fill();
      g.strokeStyle = shade(P.door, .2); g.lineWidth = 1.1;
      g.beginPath(); g.arc(56, 62, 4.6, 0, TAU); g.stroke();
      // porte arrondie en bas
      g.fillStyle = P.door;
      g.beginPath(); g.arc(56, 76, 5.4, Math.PI, 0); g.lineTo(61.4, 83); g.lineTo(50.6, 83); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.2)';
      g.beginPath(); g.arc(54, 74.5, 1.8, 0, TAU); g.fill();
      g.fillStyle = '#f4c542';
      g.beginPath(); g.arc(59, 78, 1, 0, TAU); g.fill();
      // galerie sous la lanterne
      g.fillStyle = WOOD_M;
      rr(g, 44, 37.5, 24, 4, 2); g.fill();
      g.fillStyle = shade(WOOD_M, .25);
      rr(g, 44, 37.5, 24, 1.6, 1); g.fill();
      // halo de la lanterne (pulse)
      var hg = g.createRadialGradient(56, 29, 2, 56, 29, 22);
      hg.addColorStop(0, 'rgba(255,232,150,' + glow.toFixed(3) + ')');
      hg.addColorStop(1, 'rgba(255,232,150,0)');
      g.fillStyle = hg;
      g.beginPath(); g.arc(56, 29, 22, 0, TAU); g.fill();
      // cage vitree
      var lg = g.createLinearGradient(46, 0, 66, 0);
      lg.addColorStop(0, 'rgba(255,246,205,.95)');
      lg.addColorStop(1, 'rgba(244,214,120,.95)');
      g.fillStyle = lg;
      rr(g, 47, 22.5, 18, 15, 3); g.fill();
      // flamme-graine au centre (pulse discretement en taille)
      g.fillStyle = '#f4a83c';
      g.beginPath(); g.ellipse(56, 30.5, 2.6, 3.4 + glow * 1.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff3c2';
      g.beginPath(); g.ellipse(56, 31.2, 1.3, 1.8, 0, 0, TAU); g.fill();
      // montants de la cage
      g.strokeStyle = P.door; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(51.5, 23); g.lineTo(51.5, 37.5); g.stroke();
      g.beginPath(); g.moveTo(60.5, 23); g.lineTo(60.5, 37.5); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(48.5, 25.5); g.lineTo(48.5, 34); g.stroke();
      // toit conique bleu de la lanterne
      var cg = g.createLinearGradient(0, 15, 0, 24);
      cg.addColorStop(0, shade(P.roof, .2)); cg.addColorStop(1, P.roofSh);
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(44.5, 23.5); g.quadraticCurveTo(56, 12.5, 67.5, 23.5);
      g.quadraticCurveTo(56, 26.5, 44.5, 23.5); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.3)';
      g.beginPath(); g.ellipse(51, 19.5, 3.4, 1.6, .5, 0, TAU); g.fill();
      // GIROUETTE-PLUME au sommet (oscille autour du pivot)
      g.save();
      g.translate(56, 16); g.rotate(vane);
      twig(g, 0, 1, 0, -6.5, 2, WOOD_D);
      // traverse + petit contrepoids
      twig(g, -9, -4.5, 9, -4.5, 1.6, WOOD_D);
      g.fillStyle = '#f4c542';
      g.beginPath(); g.arc(-9.5, -4.5, 1.8, 0, TAU); g.fill();
      // grande plume qui prend le vent
      g.save();
      g.translate(9.5, -4.5); g.rotate(.12);
      g.fillStyle = P.accent;
      g.beginPath();
      g.moveTo(-1.5, 0);
      g.quadraticCurveTo(6, -7.5, 16, -5);
      g.quadraticCurveTo(9, -1.2, 3, .8);
      g.quadraticCurveTo(9, 1.6, 15, 4.4);
      g.quadraticCurveTo(6, 6.8, -1.5, 0);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(7, -1.2, 14.5, -3.6); g.stroke();
      g.restore();
      g.fillStyle = '#f4c542';
      g.beginPath(); g.arc(0, -4.5, 1.5, 0, TAU); g.fill();
      g.restore();
      // charmes : plume posee contre la porte + graines sur le seuil
      featherMark(g, 68, 79, 3.8, 'rgba(90,120,150,.55)');
      g.fillStyle = SEED;
      g.beginPath(); g.arc(48, 84.5, 1.2, 0, TAU); g.fill();
      g.beginPath(); g.arc(51.5, 85.8, 1, 0, TAU); g.fill();
    }
  });

  // ============================================================
  // 4) TOUR DES GUETTEURS — gros mat central, 3 paniers de guet
  //    superposes decales, echelles de corde, fanion effiloche.
  //    Le fanion ondule.
  // ============================================================
  reg('defense_birds', {
    id: 'tour-guetteurs', label: 'Tour des guetteurs',
    anim: 'le fanion ondule',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      function wave(k) { return Math.sin(PH * TAU * 2 + k) * 2.4; }
      softShadow(g, 56, 88, 34, 10, 0.24);
      // motte de terre + pierres de calage
      g.fillStyle = '#9a8f76';
      g.beginPath(); g.ellipse(56, 85, 18, 6.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#a8a296';
      g.beginPath(); g.ellipse(45, 85.5, 5.5, 3.4, .2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(67, 86, 5, 3, -.2, 0, TAU); g.fill();
      // MAT central epais, leger fruit
      var mg = g.createLinearGradient(49, 0, 64, 0);
      mg.addColorStop(0, shade(WOOD, .25)); mg.addColorStop(.45, WOOD); mg.addColorStop(1, WOOD_D);
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(50, 85); g.quadraticCurveTo(51.5, 50, 53, 16);
      g.lineTo(59.5, 16); g.quadraticCurveTo(61, 50, 62.5, 85);
      g.quadraticCurveTo(56, 87, 50, 85); g.closePath(); g.fill();
      // ecorce : deux noeuds + stries fines
      g.fillStyle = 'rgba(50,34,16,.5)';
      g.beginPath(); g.ellipse(58.5, 74, 1.6, 2.3, .2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(54, 38, 1.3, 1.9, -.15, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(50,34,16,.28)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(55.5, 20); g.quadraticCurveTo(54.8, 45, 55.2, 70); g.stroke();
      // --- panier de guet : demi-corbeille en osier accrochee au mat ---
      function basket(cx, cy, w, hh, flip) {
        var s = flip ? -1 : 1;
        // corde de suspension vers le mat
        g.strokeStyle = '#e0cfa0'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(cx, cy - hh + 2); g.lineTo(cx - s * (w * .55), cy - hh - 6); g.stroke();
        // corbeille
        var bg2 = g.createLinearGradient(0, cy - hh, 0, cy + 2);
        bg2.addColorStop(0, shade(WICKER, .16)); bg2.addColorStop(1, shade(WICKER, -.26));
        g.fillStyle = bg2;
        g.beginPath();
        g.moveTo(cx - w / 2, cy - hh);
        g.quadraticCurveTo(cx - w / 2 - 1.5, cy, cx, cy + 1.5);
        g.quadraticCurveTo(cx + w / 2 + 1.5, cy, cx + w / 2, cy - hh);
        g.closePath(); g.fill();
        // tissage : deux rangs d'arceaux
        g.strokeStyle = 'rgba(90,60,26,.42)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(cx - w / 2 + 1.5, cy - hh * .5);
        g.quadraticCurveTo(cx, cy - hh * .5 + 3, cx + w / 2 - 1.5, cy - hh * .5); g.stroke();
        g.beginPath(); g.moveTo(cx - w / 2 + 2.5, cy - hh * .12);
        g.quadraticCurveTo(cx, cy - hh * .12 + 2.4, cx + w / 2 - 2.5, cy - hh * .12); g.stroke();
        // rebord roule
        g.strokeStyle = shade(WICKER, -.12); g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx - w / 2 - .5, cy - hh);
        g.quadraticCurveTo(cx, cy - hh + 2.4, cx + w / 2 + .5, cy - hh); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(cx - w / 2 + 1, cy - hh + .4);
        g.quadraticCurveTo(cx, cy - hh + 2.4, cx + w / 2 - 1, cy - hh + .4); g.stroke();
      }
      // panier bas (gauche) avec guetteur
      basket(41, 68, 21, 12, false);
      sentinel(g, 40, 54.5, 1.05, P.door, Math.sin(PH * TAU) * 0.05, true);
      // panier median (droite) avec guetteur au bicorne-plume
      basket(71, 50, 20, 11.5, true);
      sentinel(g, 72, 37, 1.0, mix(P.door, P.roof, .3), Math.sin(PH * TAU + 2.6) * 0.05, false);
      featherMark(g, 76.5, 33.5, 2.6, 'rgba(255,255,255,.8)');
      // panier sommital (petit, a cheval sur le mat) avec longue-vue en brindille
      basket(52, 30, 17, 10, false);
      sentinel(g, 51, 17.5, 0.95, P.door, Math.sin(PH * TAU + 4.4) * 0.06, false);
      twig(g, 54.5, 15.5, 60, 13, 1.8, WOOD_D);
      g.fillStyle = P.accent;
      g.beginPath(); g.arc(60.8, 12.7, 1.4, 0, TAU); g.fill();
      // echelles de corde entre les paniers
      function ropeLadder(x0, y0, x1, y1) {
        g.strokeStyle = '#e0cfa0'; g.lineWidth = 1.3;
        var nx = (y1 - y0), ny = -(x1 - x0), nl = Math.sqrt(nx * nx + ny * ny);
        nx = nx / nl * 2.6; ny = ny / nl * 2.6;
        g.beginPath(); g.moveTo(x0 - nx, y0 - ny); g.lineTo(x1 - nx, y1 - ny); g.stroke();
        g.beginPath(); g.moveTo(x0 + nx, y0 + ny); g.lineTo(x1 + nx, y1 + ny); g.stroke();
        g.strokeStyle = '#c9a06a'; g.lineWidth = 1.5;
        for (var t = .15; t < 1; t += .2) {
          var mx = x0 + (x1 - x0) * t, my = y0 + (y1 - y0) * t;
          g.beginPath(); g.moveTo(mx - nx, my - ny); g.lineTo(mx + nx, my + ny); g.stroke();
        }
      }
      ropeLadder(44, 82, 41, 70);
      ropeLadder(48, 66, 66, 52);
      ropeLadder(68, 46, 55, 32);
      // FANION effiloche au sommet, qui ondule
      twig(g, 56, 16, 56, 7.5, 1.8, WOOD_D);
      g.fillStyle = '#f4c542';
      g.beginPath(); g.arc(56, 7, 1.7, 0, TAU); g.fill();
      var fg = g.createLinearGradient(0, 8, 0, 22);
      fg.addColorStop(0, shade(P.roof, .18)); fg.addColorStop(1, P.roofSh);
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(57.5, 9);
      g.quadraticCurveTo(70, 8 + wave(0) * .5, 82, 10.5 + wave(1));
      // bord de fuite effiloche (trois languettes)
      g.lineTo(76, 13.5 + wave(1.6));
      g.lineTo(81, 15.5 + wave(2.2));
      g.lineTo(73.5, 17 + wave(2.8));
      g.lineTo(77.5, 19.5 + wave(3.4));
      g.quadraticCurveTo(67, 21.5 + wave(2), 57.5, 19.5);
      g.closePath(); g.fill();
      g.strokeStyle = P.roofSh; g.lineWidth = 1.1; g.globalAlpha = .5;
      g.beginPath(); g.moveTo(57.5, 9); g.lineTo(57.5, 19.5); g.stroke(); g.globalAlpha = 1;
      featherMark(g, 64, 14.2 + wave(1) * .4, 3, 'rgba(255,255,255,.85)');
      // charmes au sol : graines renversees + petite plume perdue
      g.fillStyle = SEED;
      g.beginPath(); g.arc(38, 84, 1.2, 0, TAU); g.fill();
      g.beginPath(); g.arc(41.5, 86, 1.1, 0, TAU); g.fill();
      g.beginPath(); g.arc(35.5, 86.4, 1, 0, TAU); g.fill();
      featherMark(g, 74, 82, 3.2, 'rgba(160,180,200,.7)');
    }
  });
})();
