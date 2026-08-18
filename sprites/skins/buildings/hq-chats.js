"use strict";
/* ============================================================
   LAB — hq-chats.js
   4 variantes de QG pour le camp des chats (slot 'hq_cats').
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

  // palette chats + carton
  var P = { wall:'#f4ddb8', wallSh:'#d9b98a', flag:'#f08c42', flagSh:'#c9662a', accent:'#e76f51', door:'#8a5a30' };
  var CARD = '#dcb77e', CARDSH = '#b8935c', INK = '#7a5a34';
  var SISAL = '#c9a86a', WOOD = '#8a6a44';

  // pelote de laine (motif récurrent du camp)
  function yarnBall(g, x, y, r, col) {
    var yg = g.createRadialGradient(x - r * .4, y - r * .4, r * .2, x, y, r);
    yg.addColorStop(0, mix(col, '#ffffff', .38)); yg.addColorStop(1, shade(col, -.18));
    g.fillStyle = yg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = shade(col, -.38); g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, r * .66, .5, 2.7); g.stroke();
    g.beginPath(); g.arc(x, y, r * .36, 3.3, 5.7); g.stroke();
  }

  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  /* ============================================================
     1) CHÂTEAU ARBRE À CHAT — trois poteaux sisal, passerelle de
        corde, coussins-créneaux, plumeau suspendu qui se balance.
     ============================================================ */
  reg('hq_cats', {
    id: 'chateau-arbre-a-chat', label: 'Château arbre à chat',
    anim: 'le plumeau suspendu se balance',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);

      // socle : grosse planche chaleureuse
      var bg = g.createLinearGradient(0, 78, 0, 88);
      bg.addColorStop(0, shade(WOOD, .22)); bg.addColorStop(1, shade(WOOD, -.26));
      g.fillStyle = bg; rr(g, 16, 79, 80, 9, 4.5); g.fill();
      g.strokeStyle = 'rgba(60,42,20,.3)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(22, 83.6); g.lineTo(90, 83.6); g.stroke();
      g.beginPath(); g.arc(26, 83.4, 1.7, 0, TAU); g.stroke(); // nœud du bois
      pawPrint(g, 66, 82.4, 2.2, 'rgba(90,58,30,.5)');         // empreinte tamponnée
      yarnBall(g, 21, 74, 5.4, P.accent);                       // pelote au pied
      g.strokeStyle = shade(P.accent, -.3); g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(26, 76); g.quadraticCurveTo(34, 80, 40, 77.5); g.stroke();

      function post(cx, w, yTop) {
        var pg = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
        pg.addColorStop(0, shade(SISAL, .24)); pg.addColorStop(.5, SISAL); pg.addColorStop(1, shade(SISAL, -.3));
        g.fillStyle = pg; rr(g, cx - w / 2, yTop, w, 80 - yTop, w * .42); g.fill();
        g.strokeStyle = 'rgba(110,80,40,.45)'; g.lineWidth = 1.3;
        for (var y = yTop + 4; y < 77; y += 4.4) {
          g.beginPath(); g.moveTo(cx - w / 2 + 1.2, y); g.lineTo(cx + w / 2 - 1.2, y - 2.2); g.stroke();
        }
      }
      function platform(cx, cy, rx, nCush) {
        // coussins-créneaux orange, derrière le rebord
        for (var i = 0; i < nCush; i++) {
          var t = nCush === 1 ? 0 : i / (nCush - 1) - .5, x = cx + t * rx * 1.35, w2 = rx * .42;
          var cg = g.createLinearGradient(0, cy - 9, 0, cy);
          cg.addColorStop(0, mix(P.accent, '#ffffff', .5)); cg.addColorStop(1, P.accent);
          g.fillStyle = cg; rr(g, x - w2 / 2, cy - 8.5, w2, 9, 3.2); g.fill();
          g.fillStyle = shade(P.accent, -.35);
          g.beginPath(); g.arc(x, cy - 4.6, .9, 0, TAU); g.fill(); // bouton couture
        }
        // plateau : tranche puis dessus
        g.fillStyle = shade(WOOD, -.08);
        g.beginPath(); g.ellipse(cx, cy + 2.6, rx, rx * .34, 0, 0, TAU); g.fill();
        var tg = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
        tg.addColorStop(0, shade('#a8845a', .22)); tg.addColorStop(1, shade('#a8845a', -.16));
        g.fillStyle = tg; g.beginPath(); g.ellipse(cx, cy, rx, rx * .34, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(cx, cy - .8, rx * .62, rx * .18, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      }

      // marche-pied central, donjon-poteau gauche, tour droite
      post(56, 9, 64); platform(56, 63, 9, 1);
      post(32, 13, 22); post(80, 11, 40);
      // griffures de service sur le grand poteau
      g.strokeStyle = 'rgba(70,46,20,.55)'; g.lineWidth = 1.2;
      for (var d = -2.6; d <= 2.6; d += 2.6) {
        g.beginPath(); g.moveTo(30 + d, 56); g.lineTo(32.5 + d, 70); g.stroke();
      }
      platform(80, 39, 13, 3);
      platform(32, 21, 15, 4);

      // passerelle de corde entre les deux tours
      var x0 = 45, y0 = 24, x1 = 68, y1 = 41;
      g.strokeStyle = WOOD; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(56, 38, x1, y1); g.stroke();
      g.beginPath(); g.moveTo(x0, y0 + 4); g.quadraticCurveTo(56, 42, x1, y1 + 4); g.stroke();
      for (var i = 1; i <= 5; i++) {
        var t = i / 6, mt = 1 - t;
        var px = mt * mt * x0 + 2 * mt * t * 56 + t * t * x1;
        var py = mt * mt * (y0 + 4) + 2 * mt * t * 42 + t * t * (y1 + 4);
        g.strokeStyle = '#a8845a'; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(px - 3.2, py - 1); g.lineTo(px + 3.2, py + 1); g.stroke();
      }

      // potence + jouet plumeau (ANIM : balancement doux)
      twig(g, 84, 40, 96, 31, 2.6, WOOD);
      var sw = Math.sin(PH * TAU) * .18;
      var ax = 95, ay = 31, L = 15;
      var tx = ax + Math.sin(sw) * L, ty = ay + Math.cos(sw) * L;
      g.strokeStyle = 'rgba(90,64,32,.8)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(ax, ay);
      g.quadraticCurveTo(ax + Math.sin(sw) * L * .5, ay + L * .55, tx, ty); g.stroke();
      for (var k = -1; k <= 1; k++) {
        featherMark(g, tx + k * 2.4, ty + 3.6 + Math.abs(k) * .8, 3.4,
          k === 0 ? P.flag : mix(P.flag, '#ffffff', .4));
      }
      g.fillStyle = shade(P.accent, -.05); g.beginPath(); g.arc(tx, ty, 2.3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(tx - .7, ty - .7, .9, 0, TAU); g.fill();
    }
  });

  /* ============================================================
     2) FORTERESSE DE PANIERS — donjon d'osier sur 3 niveaux,
        trône capitonné sous auvent rayé, pelotes-boulets.
        Anim : un bout de queue dépasse et bat lentement.
     ============================================================ */
  reg('hq_cats', {
    id: 'forteresse-paniers', label: 'Forteresse de paniers',
    anim: 'une queue bat au sommet',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);

      function basket(cx, yTop, yBot, hwTop, hwBot) {
        var bg = g.createLinearGradient(cx - hwTop, 0, cx + hwTop, 0);
        bg.addColorStop(0, shade('#c89a5c', .2)); bg.addColorStop(.55, '#c89a5c'); bg.addColorStop(1, shade('#c89a5c', -.26));
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(cx - hwBot, yBot);
        g.quadraticCurveTo(cx - hwTop - 2, (yTop + yBot) / 2, cx - hwTop, yTop);
        g.lineTo(cx + hwTop, yTop);
        g.quadraticCurveTo(cx + hwTop + 2, (yTop + yBot) / 2, cx + hwBot, yBot);
        g.quadraticCurveTo(cx, yBot + 3.5, cx - hwBot, yBot);
        g.closePath(); g.fill();
        // tressage
        g.strokeStyle = 'rgba(90,60,26,.35)'; g.lineWidth = 1.3;
        for (var yy = yTop + 5.5; yy < yBot - 2; yy += 6) {
          for (var x = cx - hwTop + 3; x < cx + hwTop - 4; x += 7) {
            g.beginPath(); g.arc(x + 3.5, yy, 3.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
          }
        }
        // ombre interne sous le rebord, puis rebord roulé
        g.fillStyle = 'rgba(0,0,0,.13)';
        g.beginPath(); g.ellipse(cx, yTop + 2.6, hwTop * .96, 3, 0, 0, Math.PI); g.fill();
        g.strokeStyle = '#9a7038'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(cx, yTop, hwTop, 4, 0, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(cx, yTop - 1, hwTop * .85, 2.6, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      }

      basket(56, 62, 86, 29, 24);
      basket(56, 44, 64, 23, 19);
      basket(56, 28, 46, 16, 13);

      // empreinte sur le panier du bas + échelle d'assaut amie
      pawPrint(g, 68, 73, 2.8, 'rgba(90,58,30,.4)');
      g.strokeStyle = '#8a6a44'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(89, 85); g.lineTo(80, 60); g.stroke();
      g.beginPath(); g.moveTo(95, 84); g.lineTo(86, 59); g.stroke();
      g.lineWidth = 1.8;
      for (var i = 0; i < 3; i++) {
        var yy = 78 - i * 7.5, xx = 87.6 - i * 2.6;
        g.beginPath(); g.moveTo(xx, yy + 1); g.lineTo(xx + 6.2, yy); g.stroke();
      }

      // pelotes-boulets au pied du donjon
      yarnBall(g, 25, 82, 5.6, P.accent);
      yarnBall(g, 35, 84.5, 4.8, P.flag);
      yarnBall(g, 30, 75.5, 4.2, mix(P.flag, '#ffffff', .35));
      g.strokeStyle = shade(P.accent, -.3); g.lineWidth = 1;
      g.beginPath(); g.moveTo(30, 84); g.quadraticCurveTo(40, 88, 47, 85); g.stroke();

      // ANIM : bout de queue qui dépasse du panier du haut
      var s = Math.sin(PH * TAU) * 3;
      taperedStroke(g, [[66, 30], [72, 24 + s * .6], [77, 18 + s]], 4.6, 2.4, '#7a5a44');
      g.fillStyle = P.wall; g.beginPath(); g.arc(77.3, 17.6 + s, 2.5, 0, TAU); g.fill();

      // trône-coussin capitonné sur le rebord
      var cg = g.createLinearGradient(0, 20, 0, 31);
      cg.addColorStop(0, mix(P.accent, '#ffffff', .55)); cg.addColorStop(1, P.accent);
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(56, 25.5, 13.5, 5.6, 0, 0, TAU); g.fill();
      g.strokeStyle = shade(P.accent, -.32); g.lineWidth = 1; g.globalAlpha = .55;
      g.beginPath(); g.ellipse(56, 25.5, 13.5, 5.6, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = shade(P.accent, -.28);
      [46, 56, 66].forEach(function (x) { g.beginPath(); g.arc(x, 25.5, 1.1, 0, TAU); g.fill(); });

      // auvent rayé sur deux piquets
      twig(g, 44, 27, 44, 12.5, 2, '#6e5434');
      twig(g, 68, 27, 68, 12.5, 2, '#6e5434');
      g.save();
      g.beginPath();
      g.moveTo(38, 14);
      g.quadraticCurveTo(56, 6.5, 74, 14);
      for (var a = 3; a >= 0; a--) {
        g.arc(42.5 + a * 9, 14, 4.5, 0, Math.PI, false);
      }
      g.closePath();
      g.clip();
      g.fillStyle = '#f6f1e6'; g.fillRect(36, 5, 40, 15);
      g.fillStyle = P.flag;
      for (var x2 = 38; x2 < 74; x2 += 9) g.fillRect(x2, 5, 4.5, 15);
      g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(36, 12.5, 40, 7);
      g.restore();
      g.strokeStyle = 'rgba(140,90,40,.5)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(38, 14); g.quadraticCurveTo(56, 6.5, 74, 14); g.stroke();
    }
  });

  /* ============================================================
     3) CHÂTEAU CARTON DELUXE — double tour crénelée à découpes
        rondes, pont-levis chatière au scotch doré, guirlande
        de fanions (ANIM), fenêtres feutre, drapeau patte.
     ============================================================ */
  reg('hq_cats', {
    id: 'chateau-carton-deluxe', label: 'Château carton deluxe',
    anim: 'la guirlande de fanions ondule',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);

      function tower(x, w, yTop) {
        var tg = g.createLinearGradient(x, 0, x + w, 0);
        tg.addColorStop(0, shade(CARD, .14)); tg.addColorStop(.6, CARD); tg.addColorStop(1, shade(CARD, -.16));
        g.fillStyle = tg; rr(g, x, yTop, w, 84 - yTop, 3); g.fill();
        // bande crénelée à découpes RONDES (ciseaux appliqués)
        var yt = yTop - 9, W = w + 4, xl = x - 2, r = 3.6;
        var c1 = xl + W * .33, c2 = xl + W * .67;
        g.fillStyle = shade(CARD, .07);
        g.beginPath();
        g.moveTo(xl, yTop + 2);
        g.lineTo(xl, yt + 2.5); g.quadraticCurveTo(xl, yt, xl + 2.5, yt);
        g.lineTo(c1 - r, yt); g.arc(c1, yt, r, Math.PI, 0, true);
        g.lineTo(c2 - r, yt); g.arc(c2, yt, r, Math.PI, 0, true);
        g.lineTo(xl + W - 2.5, yt); g.quadraticCurveTo(xl + W, yt, xl + W, yt + 2.5);
        g.lineTo(xl + W, yTop + 2);
        g.closePath(); g.fill();
        // cannelures visibles sur la tranche découpée
        g.strokeStyle = 'rgba(122,90,52,.35)'; g.lineWidth = 1;
        for (var xx = xl + 3; xx < xl + W - 2; xx += 3.2) {
          g.beginPath(); g.moveTo(xx, yt + .8); g.lineTo(xx, yt + 3); g.stroke();
        }
        g.strokeStyle = 'rgba(122,90,52,.3)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(xl + 1, yTop + 2.5); g.lineTo(xl + W - 1, yTop + 2.5); g.stroke();
      }

      // corps central (courtine) + tours
      var wg = g.createLinearGradient(40, 0, 72, 0);
      wg.addColorStop(0, shade(CARD, .1)); wg.addColorStop(1, shade(CARD, -.06));
      g.fillStyle = wg; rr(g, 40, 58, 32, 28, 3); g.fill();
      g.fillStyle = shade(CARD, .05);
      g.beginPath();
      g.moveTo(42, 58); g.lineTo(46, 50.5); g.lineTo(66, 50.5); g.lineTo(70, 58);
      g.closePath(); g.fill(); // rabat de chemin de ronde
      tower(20, 24, 30);
      tower(68, 24, 38);
      // pierres gribouillées au feutre sur la courtine
      g.strokeStyle = 'rgba(122,90,52,.4)'; g.lineWidth = 1.2;
      [[45, 63], [56, 61.5], [65, 64], [50, 68.5], [61, 68]].forEach(function (q) {
        g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + 5, q[1] - .6); g.stroke();
      });

      // fenêtres feutre soignées (arche + croisillon + rideau)
      function window_(cx, cy) {
        g.fillStyle = 'rgba(74,52,28,.85)';
        g.beginPath(); g.moveTo(cx - 4, cy + 5); g.lineTo(cx - 4, cy - 1);
        g.arc(cx, cy - 1, 4, Math.PI, 0); g.lineTo(cx + 4, cy + 5); g.closePath(); g.fill();
        g.strokeStyle = INK; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(cx - 4, cy + 5); g.lineTo(cx - 4, cy - 1);
        g.arc(cx, cy - 1, 4, Math.PI, 0); g.lineTo(cx + 4, cy + 5); g.closePath(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(cx, cy - 4.5); g.lineTo(cx, cy + 4.5); g.stroke();
        g.fillStyle = P.accent;
        g.beginPath(); g.moveTo(cx - 4, cy - 2); g.quadraticCurveTo(cx - 1.5, cy, cx - 3.5, cy + 5);
        g.lineTo(cx - 4, cy + 5); g.closePath(); g.fill();
      }
      window_(32, 44); window_(80, 52); window_(32, 62);

      // scotch doré : diagonale sur la tour droite + renfort de coin
      g.globalAlpha = .5; g.fillStyle = '#f4c542';
      g.save(); g.translate(80, 70); g.rotate(-.45); g.fillRect(-14, -3, 28, 6); g.restore();
      g.save(); g.translate(41, 82); g.rotate(.35); g.fillRect(-9, -2.6, 18, 5.2); g.restore();
      g.globalAlpha = 1;

      // pont-levis chatière : arche, planche baissée, cordelettes
      g.fillStyle = 'rgba(50,32,16,.85)';
      g.beginPath(); g.moveTo(49, 86); g.lineTo(49, 76);
      g.arc(56, 76, 7, Math.PI, 0); g.lineTo(63, 86); g.closePath(); g.fill();
      var dg = g.createLinearGradient(0, 82, 0, 88);
      dg.addColorStop(0, shade('#c9a06a', .12)); dg.addColorStop(1, shade('#c9a06a', -.18));
      g.fillStyle = dg;
      g.beginPath(); g.moveTo(48, 84.5); g.lineTo(64, 84.5); g.lineTo(67, 88); g.lineTo(45, 88);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,60,26,.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(52, 85); g.lineTo(50.5, 88); g.stroke();
      g.beginPath(); g.moveTo(60, 85); g.lineTo(61.5, 88); g.stroke();
      g.strokeStyle = 'rgba(150,110,40,.8)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(49, 84); g.lineTo(46.5, 70); g.stroke();
      g.beginPath(); g.moveTo(63, 84); g.lineTo(65.5, 70); g.stroke();
      g.fillStyle = '#f4c542';
      g.beginPath(); g.arc(46.5, 69.5, 1.5, 0, TAU); g.fill();
      g.beginPath(); g.arc(65.5, 69.5, 1.5, 0, TAU); g.fill();
      pawPrint(g, 74, 84, 2.2, 'rgba(90,58,30,.45)');

      // drapeau patte au sommet de la grande tour
      g.strokeStyle = '#6e5a40'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(32, 21); g.lineTo(32, 8); g.stroke();
      var fg = g.createLinearGradient(0, 8, 0, 18);
      fg.addColorStop(0, shade(P.flag, .18)); fg.addColorStop(1, shade(P.flag, -.15));
      g.fillStyle = fg;
      g.beginPath(); g.moveTo(33, 8.5); g.quadraticCurveTo(46, 6, 54, 10.5);
      g.lineTo(48, 13); g.quadraticCurveTo(44, 15.5, 33, 17.5); g.closePath(); g.fill();
      pawPrint(g, 40.5, 11.2, 2.4, 'rgba(255,255,255,.88)');

      // ANIM : guirlande de fanions entre les deux tours
      var gx0 = 42, gy0 = 25, gx1 = 70, gy1 = 33;
      var cyc = 44 + Math.sin(PH * TAU) * 2.2;
      g.strokeStyle = 'rgba(110,80,44,.75)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(gx0, gy0); g.quadraticCurveTo(56, cyc, gx1, gy1); g.stroke();
      var cols = [P.accent, '#f6f1e6', P.flag, '#f6f1e6', P.accent];
      for (var i = 0; i < 5; i++) {
        var t = (i + 1) / 6, mt = 1 - t;
        var px = mt * mt * gx0 + 2 * mt * t * 56 + t * t * gx1;
        var py = mt * mt * gy0 + 2 * mt * t * cyc + t * t * gy1;
        var an = Math.sin(PH * TAU * 2 + i * 1.05) * .16;
        g.save(); g.translate(px, py); g.rotate(an);
        g.fillStyle = cols[i];
        g.beginPath(); g.moveTo(-3.4, 0); g.lineTo(3.4, 0); g.lineTo(0, 7.5); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = .8; g.stroke();
        g.restore();
      }
    }
  });

  /* ============================================================
     4) DONJON DE COUSSINS — coussins capitonnés empilés, oreilles
        de chat au sommet, tunnel de tissu, cheminée-poêle.
        Anim : ronds de fumée qui montent (cycle + fondu).
     ============================================================ */
  reg('hq_cats', {
    id: 'donjon-coussins', label: 'Donjon de coussins',
    anim: 'ronds de fumée qui montent',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);

      function cushion(cx, cy, hw, hh, col, btns) {
        var cg = g.createLinearGradient(0, cy - hh, 0, cy + hh);
        cg.addColorStop(0, mix(col, '#ffffff', .42)); cg.addColorStop(.55, col); cg.addColorStop(1, shade(col, -.24));
        g.fillStyle = cg;
        g.beginPath();
        g.moveTo(cx - hw + 4, cy - hh);
        g.quadraticCurveTo(cx, cy - hh - 4, cx + hw - 4, cy - hh);
        g.quadraticCurveTo(cx + hw + 3.5, cy, cx + hw - 4, cy + hh);
        g.quadraticCurveTo(cx, cy + hh + 3.5, cx - hw + 4, cy + hh);
        g.quadraticCurveTo(cx - hw - 3.5, cy, cx - hw + 4, cy - hh);
        g.closePath(); g.fill();
        // couture centrale en pointillés
        g.save();
        g.setLineDash([3, 2.6]);
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(cx - hw + 5, cy + 1); g.quadraticCurveTo(cx, cy + 3.5, cx + hw - 5, cy + 1); g.stroke();
        g.restore();
        // boutons capitonnés (fossettes)
        for (var i = 0; i < btns.length; i++) {
          var bx = cx + btns[i], by = cy - hh * .32;
          var dg = g.createRadialGradient(bx, by, .4, bx, by, 3.6);
          dg.addColorStop(0, 'rgba(0,0,0,.28)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = dg; g.beginPath(); g.arc(bx, by, 3.6, 0, TAU); g.fill();
          g.fillStyle = shade(col, -.42); g.beginPath(); g.arc(bx, by, 1.15, 0, TAU); g.fill();
        }
        // rehaut du bourrelet supérieur
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx - hw * .55, cy - hh - 1.2);
        g.quadraticCurveTo(cx, cy - hh - 3.6, cx + hw * .55, cy - hh - 1.2); g.stroke();
      }

      cushion(56, 76, 33, 10, P.wall, [-20, 0, 20]);
      cushion(56, 57, 27, 9, P.accent, [-13, 13]);
      cushion(56, 40, 21, 8, P.flag, [-9, 9]);
      // oreilles de chat cousues, puis coussin-sommet par-dessus
      [[-1, 47], [1, 65]].forEach(function (q) {
        var s = q[0], bx = q[1];
        g.fillStyle = P.flag;
        g.beginPath(); g.moveTo(bx - 5 * s, 22); g.lineTo(bx, 11); g.lineTo(bx + 6 * s, 21);
        g.closePath(); g.fill();
        g.fillStyle = mix(P.accent, '#ffffff', .45);
        g.beginPath(); g.moveTo(bx - 2 * s, 20); g.lineTo(bx + .6 * s, 14.5); g.lineTo(bx + 3.4 * s, 19.5);
        g.closePath(); g.fill();
      });
      cushion(56, 25, 14, 6.5, P.wall, [0]);
      pawPrint(g, 56, 39, 2.6, 'rgba(255,255,255,.8)');

      // pièce rapiécée cousue sur le coussin du bas
      g.fillStyle = 'rgba(220,183,126,.9)'; rr(g, 33, 71, 9.5, 8, 2); g.fill();
      g.save(); g.setLineDash([2, 2]);
      g.strokeStyle = 'rgba(90,58,30,.55)'; g.lineWidth = 1; rr(g, 34.2, 72.2, 7.1, 5.6, 1.5); g.stroke();
      g.restore();

      // porte-tunnel en tissu + lambrequin festonné
      g.fillStyle = 'rgba(58,38,22,.9)';
      g.beginPath(); g.moveTo(48, 85.5); g.lineTo(48, 76);
      g.arc(56, 76, 8, Math.PI, 0); g.lineTo(64, 85.5);
      g.quadraticCurveTo(56, 88, 48, 85.5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(56, 76, 6.2, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.fillStyle = P.accent;
      for (var sc = 0; sc < 3; sc++) {
        g.beginPath(); g.arc(50.7 + sc * 5.3, 69, 2.8, 0, Math.PI); g.fill();
      }
      // plis du tissu de part et d'autre de l'entrée
      g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(45.5, 78); g.quadraticCurveTo(44.5, 82, 45.5, 85.5); g.stroke();
      g.beginPath(); g.moveTo(66.5, 78); g.quadraticCurveTo(67.5, 82, 66.5, 85.5); g.stroke();

      // cheminée-poêle à croquettes (tuyau + hublot qui rougeoie)
      var pg = g.createLinearGradient(77, 0, 85, 0);
      pg.addColorStop(0, shade('#a8a296', .18)); pg.addColorStop(1, shade('#8a8478', -.14));
      g.fillStyle = pg; rr(g, 78, 26, 6.5, 28, 2.2); g.fill();
      g.fillStyle = '#847f76'; rr(g, 75.5, 22.5, 11.5, 4.2, 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(78.5, 34); g.lineTo(84, 34); g.stroke();
      g.beginPath(); g.moveTo(78.5, 45); g.lineTo(84, 45); g.stroke();
      g.fillStyle = '#4a3a28'; g.beginPath(); g.arc(81.2, 50, 2.6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,170,70,.9)'; g.beginPath(); g.arc(81.2, 50, 1.3, 0, TAU); g.fill();
      // petit tas de croquettes sous le poêle
      g.fillStyle = '#9a6a3a';
      [[88, 85], [92, 84], [90, 86.5], [94, 86]].forEach(function (q) {
        g.beginPath(); g.ellipse(q[0], q[1], 1.9, 1.3, .3, 0, TAU); g.fill();
      });

      // ANIM : ronds de fumée (3 anneaux en cycle, fondu aux bords)
      for (var i = 0; i < 3; i++) {
        var c = (PH + i / 3) % 1;
        var sy = 20 - c * 12;
        var sx = 81.2 + Math.sin(c * TAU) * 1.4;
        var srr = 1.7 + c * 3.1;
        var al = Math.sin(c * Math.PI) * .5;
        g.strokeStyle = 'rgba(238,238,230,' + al.toFixed(3) + ')';
        g.lineWidth = 1.7;
        g.beginPath(); g.ellipse(sx, sy, srr, srr * .72, 0, 0, TAU); g.stroke();
      }
    }
  });
})();
