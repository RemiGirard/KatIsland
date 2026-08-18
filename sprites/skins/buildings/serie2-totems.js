"use strict";
/* ============================================================
   LAB SÉRIE 2 — serie2-totems.js
   Totems de ralliement : 3 concepts déclinés dans les 3 camps
   (slots 'reinforce_cats' / 'reinforce_birds' / 'reinforce_neutre').
   - tambour-de-guerre : tambour sur trépied + maillet monté
   - carillon          : potence + suspensions déphasées
   - statue-heros      : socle de pierre + héros nimbé d'or
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
    cats:   { wall:'#f4ddb8', wallSh:'#d9b98a', roof:'#f08c42', roofSh:'#c9662a', accent:'#e76f51', flag:'#f08c42', door:'#8a5a30' },
    birds:  { wall:'#e6f1f8', wallSh:'#bcd6e6', roof:'#48a9d8', roofSh:'#2f7ea8', accent:'#3a86ff', flag:'#48a9d8', door:'#4a6a80' },
    neutre: { wall:'#d8d5ce', wallSh:'#b2aea6', roof:'#a8a49c', roofSh:'#847f76', accent:'#98948c', flag:'#b0aca4', door:'#6e6a62' }
  };
  var GOLD = '#f4c542';

  // pelote de laine (motif fétiche des chats)
  function yarn(g, x, y, r, col) {
    var yg = g.createRadialGradient(x - r * .4, y - r * .4, r * .2, x, y, r);
    yg.addColorStop(0, mix(col, '#ffffff', .38)); yg.addColorStop(1, shade(col, -.2));
    g.fillStyle = yg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = shade(col, -.38); g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, r * .64, .5, 2.7); g.stroke();
    g.beginPath(); g.arc(x, y, r * .34, 3.3, 5.7); g.stroke();
  }

  function reg(slot, v) { var R = window.LAB_BUILDINGS.variants; (R[slot] = R[slot] || []).push(v); }

  /* ============================================================
     1) TAMBOUR DE GUERRE — gros fût sur trépied, potence latérale
        portant le maillet, baguettes croisées au pied.
        Anim : le maillet se lève lentement, frappe, la peau vibre.
     ============================================================ */
  function drumDraw(f) {
    var P = PAL[f];
    return function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);

      // cadence du maillet (repos .08 -> levée .35 -> frappe -> rebond -> repos)
      var a;
      if (PH < 0.38) a = 0.08 + (PH / 0.38) * 0.27;
      else if (PH < 0.5) { var t1 = (PH - 0.38) / 0.12; a = 0.35 * (1 - t1 * t1); }
      else if (PH < 0.6) a = 0.1 * Math.sin(((PH - 0.5) / 0.1) * Math.PI);
      else a = 0.08 * ((PH - 0.6) / 0.4);
      // vibration de la peau juste après l'impact (décroissante, boucle propre)
      var vib = (PH >= 0.5 && PH < 0.75)
        ? Math.sin((PH - 0.5) * TAU * 8) * (1 - (PH - 0.5) / 0.25) * 1.4 : 0;

      var LEG = f === 'birds' ? '#6e5434' : (f === 'neutre' ? '#7a746a' : '#8a6a44');
      var cordC = f === 'cats' ? P.accent : (f === 'birds' ? '#c9a86a' : '#847f76');

      // patte arrière du trépied (derrière le fût)
      twig(g, 52, 56, 49, 87, 3, shade(LEG, -.2));

      // fût du tambour
      var bodyC = f === 'cats' ? '#dcb77e' : (f === 'birds' ? '#8a6a44' : '#a8a296');
      var bgD = g.createLinearGradient(37, 0, 67, 0);
      bgD.addColorStop(0, shade(bodyC, .2)); bgD.addColorStop(.55, bodyC); bgD.addColorStop(1, shade(bodyC, -.26));
      g.fillStyle = bgD;
      g.beginPath();
      g.moveTo(37, 41); g.lineTo(37, 56);
      g.quadraticCurveTo(37, 61.5, 45, 62.4);
      g.quadraticCurveTo(52, 63.1, 59, 62.4);
      g.quadraticCurveTo(67, 61.5, 67, 56);
      g.lineTo(67, 41); g.closePath(); g.fill();
      // matière du fût selon le camp
      if (f === 'cats') {
        g.strokeStyle = 'rgba(122,90,52,.26)'; g.lineWidth = 1.1;      // cannelures carton
        for (var x1 = 40.5; x1 <= 64; x1 += 4) { g.beginPath(); g.moveTo(x1, 44); g.lineTo(x1, 59.5); g.stroke(); }
        pawPrint(g, 52, 51.5, 2.7, 'rgba(122,90,52,.5)');
      } else if (f === 'birds') {
        g.strokeStyle = 'rgba(50,34,16,.42)'; g.lineWidth = 1.2;       // écorce du tronc creux
        [41.5, 46.5, 57.5, 63].forEach(function (bx) {
          g.beginPath(); g.moveTo(bx, 43.5); g.quadraticCurveTo(bx + 1.6, 52, bx - .8, 60); g.stroke();
        });
        g.fillStyle = '#31220f'; g.beginPath(); g.ellipse(61.5, 52.5, 2.5, 3.3, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.arc(60.6, 51.2, 1.1, 0, TAU); g.fill();
      } else {
        g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.1;          // douves grises disjointes
        [44, 52, 60].forEach(function (bx) { g.beginPath(); g.moveTo(bx, 43.5); g.lineTo(bx - .6, 60); g.stroke(); });
        g.fillStyle = 'rgba(110,140,84,.5)';
        g.beginPath(); g.ellipse(40.5, 58, 3.6, 2.1, .3, 0, TAU); g.fill();
      }
      // laçage de tension en zigzag
      g.strokeStyle = cordC; g.lineWidth = 1.4; g.globalAlpha = .9;
      for (var xz = 39; xz < 63; xz += 8) {
        g.beginPath(); g.moveTo(xz, 43.5); g.lineTo(xz + 4, 57.5); g.lineTo(xz + 8, 43.5); g.stroke();
      }
      g.globalAlpha = 1;
      if (f === 'neutre') { // une corde a lâché et pendouille
        g.strokeStyle = '#847f76'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(47, 44); g.quadraticCurveTo(45.2, 50, 46.4, 55); g.stroke();
      }

      // peau tendue (vibre après l'impact)
      var skinY = 40 + vib;
      var sg = g.createRadialGradient(48, skinY - 2, 2, 52, skinY, 15);
      sg.addColorStop(0, shade(P.wall, .16)); sg.addColorStop(1, shade(P.wall, -.16));
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(52, skinY, 14.4, 4.8, 0, 0, TAU); g.fill();
      if (f === 'cats') {          // trois griffures d'accordage
        g.strokeStyle = 'rgba(150,100,50,.55)'; g.lineWidth = 1.1;
        for (var d = -3.4; d <= 3.5; d += 3.4) {
          g.beginPath(); g.moveTo(46.5 + d, skinY - 2.2); g.quadraticCurveTo(49.5 + d, skinY, 53.5 + d, skinY + 2.4); g.stroke();
        }
      } else if (f === 'birds') {  // coutures + plume glissée sous le cerclage
        g.strokeStyle = 'rgba(74,106,128,.55)'; g.lineWidth = 1;
        [-.85, -.3, .3, .85].forEach(function (t) {
          g.beginPath(); g.moveTo(52 + t * 13, skinY - 1.5 + Math.abs(t)); g.lineTo(52 + t * 11, skinY + .8); g.stroke();
        });
        featherMark(g, 41.5, 36.5, 3, P.flag);
      } else {                     // peau crevée, lambeau rabattu
        g.fillStyle = 'rgba(26,26,30,.8)';
        g.beginPath();
        g.moveTo(46, skinY - 1); g.lineTo(52, skinY - 2.4); g.lineTo(56, skinY + .4);
        g.lineTo(52.5, skinY + 2.5); g.lineTo(47.5, skinY + 1.7); g.closePath(); g.fill();
        g.fillStyle = shade(P.wall, -.26);
        g.beginPath(); g.moveTo(46, skinY - 1); g.lineTo(50, skinY - 4.3); g.lineTo(53.5, skinY - 2.1); g.closePath(); g.fill();
      }
      // onde discrète pendant la vibration
      if (vib !== 0) {
        g.strokeStyle = 'rgba(255,255,255,' + (Math.abs(vib) * .24).toFixed(3) + ')'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(52, skinY, 9 - vib, 2.7, 0, 0, TAU); g.stroke();
      }
      // cerclage + rehaut
      g.strokeStyle = f === 'neutre' ? '#6e6a62' : '#54402a'; g.lineWidth = 2.6;
      g.beginPath(); g.ellipse(52, 40, 15, 5.2, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.26)'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(52, 39.2, 11.6, 3.5, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();

      // pattes avant du trépied + ligatures
      twig(g, 41, 58, 33, 87, 3.4, LEG);
      twig(g, 63, 58, 71, 87, 3.4, shade(LEG, -.12));
      g.strokeStyle = cordC; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(39.5, 57.5); g.lineTo(43.5, 60); g.stroke();
      g.beginPath(); g.moveTo(64.5, 57.5); g.lineTo(60.5, 60); g.stroke();

      // baguettes croisées, pointes emmaillotées
      twig(g, 24, 87, 35, 65, 2.3, shade(LEG, .16));
      twig(g, 35, 87, 24, 66, 2.3, LEG);
      g.fillStyle = f === 'neutre' ? '#b2aea6' : P.accent;
      g.beginPath(); g.arc(35, 64.6, 2.2, 0, TAU); g.fill();
      g.beginPath(); g.arc(24, 65.6, 2.2, 0, TAU); g.fill();

      // potence du maillet
      g.fillStyle = f === 'neutre' ? '#8a8478' : '#6e5434';
      g.beginPath(); g.ellipse(84.2, 86.5, 8, 3.2, 0, 0, TAU); g.fill();
      twig(g, 84, 62, 76.5, 86, 2.4, shade(LEG, -.16));       // jambe de force
      var pg = g.createLinearGradient(81, 0, 88, 0);
      pg.addColorStop(0, shade(LEG, .2)); pg.addColorStop(1, shade(LEG, -.28));
      g.fillStyle = pg; rr(g, 81.4, 34, 5.6, 52, 2.6); g.fill();

      // bras + tête du maillet (rotation autour de l'axe)
      var dx = -24, dy = 3.5, ca = Math.cos(a), sa = Math.sin(a);
      var hxp = 84.2 + dx * ca - dy * sa, hyp = 36.5 + dx * sa + dy * ca;
      taperedStroke(g, [[84.2, 36.5], [(84.2 + hxp) / 2, (36.5 + hyp) / 2 - 1], [hxp, hyp]],
        3.6, 2.4, f === 'neutre' ? '#7a746a' : '#6e5434');
      g.fillStyle = GOLD; g.beginPath(); g.arc(84.2, 36.5, 2, 0, TAU); g.fill();
      g.save(); g.translate(hxp, hyp); g.rotate(-a);
      if (f === 'birds') {          // tête-bec du maillet
        g.fillStyle = '#e8a13c';
        g.beginPath(); g.moveTo(-3.6, -3); g.lineTo(3.6, -3); g.lineTo(0, 4.6); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,.18)';
        g.beginPath(); g.moveTo(0, -3); g.lineTo(3.6, -3); g.lineTo(0, 4.6); g.closePath(); g.fill();
      } else {
        var hc = f === 'cats' ? P.accent : '#98948c';
        var hg = g.createRadialGradient(-1.2, -1.2, .6, 0, 0, 4.4);
        hg.addColorStop(0, mix(hc, '#ffffff', .4)); hg.addColorStop(1, shade(hc, -.24));
        g.fillStyle = hg; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
        g.strokeStyle = shade(hc, -.4); g.lineWidth = 1;
        g.beginPath(); g.arc(0, 0, 2.5, .6, 2.8); g.stroke();
        if (f === 'neutre') { g.fillStyle = 'rgba(26,26,30,.4)'; g.beginPath(); g.arc(1.6, 1.4, 1.2, 0, TAU); g.fill(); }
      }
      g.restore();
      if (f === 'cats') yarn(g, 93.5, 84, 3.4, P.flag);
      else if (f === 'birds') {
        g.fillStyle = '#e8c96a';
        [[92, 85.5], [95, 84], [93.5, 87]].forEach(function (q) { g.beginPath(); g.arc(q[0], q[1], 1.2, 0, TAU); g.fill(); });
      }
    };
  }

  /* ============================================================
     2) CARILLON DE RALLIEMENT — potence de bois, cinq suspensions
        de tailles différentes qui se balancent en déphasage.
     ============================================================ */
  function carillonDraw(f) {
    var P = PAL[f];
    return function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);
      var WD = f === 'neutre' ? '#7a746a' : '#8a6a44';
      var WDd = f === 'neutre' ? '#5e584e' : '#54402a';

      // socle
      g.fillStyle = f === 'neutre' ? '#8a8478' : '#b8a284';
      g.beginPath(); g.ellipse(44, 85.5, 12, 4.6, 0, 0, TAU); g.fill();
      g.fillStyle = f === 'neutre' ? '#9a948a' : '#cbb695';
      g.beginPath(); g.ellipse(44, 84, 8.5, 3.2, 0, 0, TAU); g.fill();

      // poteau + traverse + jambe de force
      var pg = g.createLinearGradient(40, 0, 47, 0);
      pg.addColorStop(0, shade(WD, .22)); pg.addColorStop(1, shade(WD, -.26));
      g.fillStyle = pg; rr(g, 40.6, 21, 6.2, 64, 2.8); g.fill();
      var tg = g.createLinearGradient(0, 22, 0, 28);
      tg.addColorStop(0, shade(WD, .26)); tg.addColorStop(1, shade(WD, -.2));
      g.fillStyle = tg; rr(g, 38, 22.6, 52.5, 5.2, 2.6); g.fill();
      g.fillStyle = WDd; g.beginPath(); g.arc(89.6, 25.2, 3, 0, TAU); g.fill(); // bout sculpté
      g.fillStyle = GOLD; g.beginPath(); g.arc(43.7, 19, 2.6, 0, TAU); g.fill(); // faîteau
      twig(g, 46, 41, 61, 27.6, 3, shade(WD, -.08));
      // veinage discret de la traverse
      g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(50, 25.4); g.lineTo(84, 25.1); g.stroke();

      // identité du pied selon le camp
      if (f === 'cats') {
        g.strokeStyle = 'rgba(70,46,20,.55)'; g.lineWidth = 1.2;   // griffures d'appel
        for (var d = -2.4; d <= 2.4; d += 2.4) { g.beginPath(); g.moveTo(42.4 + d, 60); g.lineTo(44.4 + d, 72); g.stroke(); }
        var cg = g.createLinearGradient(0, 78, 0, 84);
        cg.addColorStop(0, mix(P.accent, '#ffffff', .5)); cg.addColorStop(1, P.accent);
        g.fillStyle = cg; g.beginPath(); g.ellipse(58, 83.5, 8.5, 3.6, 0, 0, TAU); g.fill();
        g.fillStyle = shade(P.accent, -.3);
        [52.5, 58, 63.5].forEach(function (bx) { g.beginPath(); g.arc(bx, 83.4, .9, 0, TAU); g.fill(); });
      } else if (f === 'birds') {
        g.strokeStyle = '#7a5c34'; g.lineWidth = 2;                // nid lové contre le pied
        g.beginPath(); g.ellipse(56, 83.5, 8, 3.4, 0, 0, TAU); g.stroke();
        g.strokeStyle = '#c9a06a'; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(56, 82.6, 6.4, 2.6, 0, 0, TAU); g.stroke();
        g.fillStyle = '#f2ead2'; g.beginPath(); g.ellipse(56, 82.2, 2.6, 3.2, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(140,120,80,.5)'; g.beginPath(); g.arc(55.2, 82.8, .7, 0, TAU); g.fill();
        twig(g, 49, 84.5, 44.5, 80.5, 1.4, '#8a6a3c');
      } else {
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.1;       // fissure élégante + mousse
        g.beginPath(); g.moveTo(43, 50); g.lineTo(41.6, 60); g.lineTo(44.4, 68); g.stroke();
        g.fillStyle = 'rgba(110,140,84,.55)';
        g.beginPath(); g.ellipse(41, 79, 4.4, 2.4, .3, 0, TAU); g.fill();
      }

      // cinq suspensions (taille, longueur et phase différentes)
      var items = [
        { x: 52.5, L: 11, s: .85, ph: 0.0 },
        { x: 61,   L: 17, s: 1.2,  ph: 1.7 },
        { x: 70,   L: 12, s: .8,  ph: 3.4 },
        { x: 79,   L: 19, s: 1.05, ph: 5.0 },
        { x: 86.5, L: 9,  s: .7,  ph: 2.5 }
      ];
      var strC = f === 'neutre' ? 'rgba(90,88,80,.85)' : 'rgba(90,64,32,.85)';
      items.forEach(function (it, i) {
        var sw = Math.sin(PH * TAU + it.ph) * .15;
        var bx = it.x + Math.sin(sw) * it.L, by = 27.8 + Math.cos(sw) * it.L;
        g.strokeStyle = strC; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(it.x, 27.8);
        g.quadraticCurveTo(it.x + Math.sin(sw) * it.L * .4, 27.8 + it.L * .55, bx, by);
        g.stroke();
        g.save(); g.translate(bx, by); g.rotate(sw); g.scale(it.s, it.s);
        if (f === 'cats') {
          if (i % 2 === 0) {   // grelot doré fendu
            var gg = g.createRadialGradient(-1.2, 1.2, .5, 0, 2.4, 4.4);
            gg.addColorStop(0, '#ffe08a'); gg.addColorStop(1, '#b8862a');
            g.fillStyle = gg; g.beginPath(); g.arc(0, 2.6, 3.8, 0, TAU); g.fill();
            g.strokeStyle = '#8a5f1e'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(-2.5, 3.5); g.lineTo(2.5, 3.5); g.stroke();
            g.fillStyle = '#8a5f1e'; g.beginPath(); g.arc(0, 1.5, .9, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(-1.4, 1, 1, 0, TAU); g.fill();
          } else yarn(g, 0, 3, 3.6, i === 1 ? P.accent : P.flag);
        } else if (f === 'birds') {
          if (i % 2 === 0) {   // coquille spiralée
            var sh = g.createRadialGradient(-1, 1.6, .5, 0, 2.6, 4);
            sh.addColorStop(0, '#f6efe0'); sh.addColorStop(1, '#c0a888');
            g.fillStyle = sh; g.beginPath(); g.arc(0, 2.6, 3.6, 0, TAU); g.fill();
            g.strokeStyle = '#8a7458'; g.lineWidth = 1;
            g.beginPath(); g.arc(-.4, 2.4, 2.3, .4, TAU * .92); g.stroke();
            g.beginPath(); g.arc(.2, 2.8, 1.1, 1.2, TAU * .8); g.stroke();
          } else featherMark(g, 0, 3.2, 3.4, i === 1 ? P.flag : mix(P.flag, '#ffffff', .4));
        } else {               // clé rouillée
          var rc = mix('#847f76', '#9a6a3a', .55);
          g.strokeStyle = rc; g.lineWidth = 1.7;
          g.beginPath(); g.arc(0, 2, 2.5, 0, TAU); g.stroke();
          g.beginPath(); g.moveTo(0, 4.4); g.lineTo(0, 9.6); g.stroke();
          g.beginPath(); g.moveTo(0, 9.4); g.lineTo(2.3, 9.4); g.stroke();
          g.beginPath(); g.moveTo(0, 7.4); g.lineTo(1.7, 7.4); g.stroke();
          g.fillStyle = 'rgba(154,106,58,.45)'; g.beginPath(); g.arc(.6, 5.8, 1, 0, TAU); g.fill();
        }
        g.restore();
        // ligature au point d'accroche
        g.fillStyle = WDd; g.beginPath(); g.arc(it.x, 27.6, 1.2, 0, TAU); g.fill();
      });

      // un objet tombé au sol, selon le camp
      if (f === 'cats') {
        yarn(g, 71, 86, 3, mix(P.flag, '#ffffff', .3));
      } else if (f === 'birds') {
        g.fillStyle = '#e8c96a';
        [[70, 86], [73.5, 85], [72, 87.5]].forEach(function (q) { g.beginPath(); g.arc(q[0], q[1], 1.1, 0, TAU); g.fill(); });
      } else {
        g.save(); g.translate(66, 86.5); g.rotate(1.25);
        g.strokeStyle = mix('#847f76', '#9a6a3a', .55); g.lineWidth = 1.5;
        g.beginPath(); g.arc(0, 0, 1.9, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(0, 1.8); g.lineTo(0, 6.4); g.moveTo(0, 6.2); g.lineTo(1.8, 6.2); g.stroke();
        g.restore();
      }
    };
  }

  /* ============================================================
     3) STATUE DU HÉROS — socle de pierre à corniche, héros de
        pierre (patte levée / aile déployée / silhouette voilée),
        offrandes au pied. Anim : la lueur dorée pulse au sommet.
     ============================================================ */
  function statueDraw(f) {
    var P = PAL[f];
    return function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);
      var pulse = .5 + .5 * Math.sin(PH * TAU);

      // lueur dorée derrière le sommet (pulse doux)
      var gc = f === 'neutre' ? '248,236,198' : '255,214,110';
      var ga = (f === 'neutre' ? .15 : .24) + .13 * pulse;
      var grad = g.createRadialGradient(56.5, 30, 2, 56.5, 30, 16.5 + 2.5 * pulse);
      grad.addColorStop(0, 'rgba(' + gc + ',' + ga.toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(' + gc + ',0)');
      g.fillStyle = grad; g.beginPath(); g.arc(56.5, 30, 20.5, 0, TAU); g.fill();

      // pierre teintée selon le camp
      var ST = f === 'cats' ? mix('#a8a296', '#c9a86a', .3)
             : f === 'birds' ? mix('#a8a296', '#bcd6e6', .28) : '#98938a';
      var STl = shade(ST, .2), STd = shade(ST, -.24);
      function stoneFill(x0, x1) {
        var sg = g.createLinearGradient(x0, 0, x1, 0);
        sg.addColorStop(0, STl); sg.addColorStop(.6, ST); sg.addColorStop(1, STd);
        return sg;
      }

      // socle : emmarchement, dé, corniche
      g.fillStyle = stoneFill(36, 76); rr(g, 36, 77.5, 40, 9.5, 3); g.fill();
      g.fillStyle = stoneFill(40, 72); rr(g, 40.5, 69, 31, 9.5, 2.5); g.fill();
      g.fillStyle = STl; rr(g, 38.5, 65.5, 35, 4.6, 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(44, 82); g.lineTo(57, 82); g.stroke();
      g.beginPath(); g.moveTo(61, 82); g.lineTo(71, 82.3); g.stroke();
      g.beginPath(); g.moveTo(49, 72); g.lineTo(49, 76.5); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(40, 66.6); g.lineTo(70, 66.6); g.stroke();
      // emblème gravé sur le dé
      if (f === 'cats') pawPrint(g, 56, 72.5, 2.8, 'rgba(0,0,0,.22)');
      else if (f === 'birds') featherMark(g, 56, 73.5, 3.4, 'rgba(0,0,0,.2)');
      else { g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.4; g.beginPath(); g.arc(56, 73.5, 3, .7, TAU - .5); g.stroke(); }

      if (f === 'cats') {
        // ----- héros chat assis, patte levée -----
        taperedStroke(g, [[65, 63], [72.5, 60], [72, 52.5]], 3.2, 1.8, STd);   // queue
        g.fillStyle = stoneFill(44, 68);
        g.beginPath();
        g.moveTo(45, 65.6);
        g.quadraticCurveTo(44, 46, 51, 38.5);
        g.quadraticCurveTo(56, 34.5, 61, 38.5);
        g.quadraticCurveTo(67.5, 46, 67, 65.6);
        g.closePath(); g.fill();
        // oreilles puis tête
        [[-1, 51], [1, 60]].forEach(function (q) {
          g.fillStyle = ST;
          g.beginPath(); g.moveTo(q[1], 28.5); g.lineTo(q[1] + q[0] * 2.5, 20.5); g.lineTo(q[1] + q[0] * 6, 26.5); g.closePath(); g.fill();
        });
        g.fillStyle = stoneFill(48.5, 63.5);
        g.beginPath(); g.arc(56, 32, 7.2, 0, TAU); g.fill();
        // patte levée (salut du héros)
        taperedStroke(g, [[64, 50], [70, 40], [70.3, 30.5]], 4.6, 3, ST);
        g.fillStyle = STl; g.beginPath(); g.arc(70.4, 28.6, 3.2, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = .9;
        g.beginPath(); g.moveTo(69.2, 26.4); g.lineTo(69.4, 28); g.moveTo(70.9, 26.1); g.lineTo(70.9, 27.8); g.stroke();
        // visage serein + poitrail
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.1;
        g.beginPath(); g.arc(52.8, 31.6, 1.7, .3, Math.PI - .3); g.stroke();
        g.beginPath(); g.arc(59.2, 31.6, 1.7, .3, Math.PI - .3); g.stroke();
        g.fillStyle = 'rgba(0,0,0,.3)';
        g.beginPath(); g.moveTo(54.9, 34.4); g.lineTo(57.1, 34.4); g.lineTo(56, 35.9); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(52, 50, 7, Math.PI * .7, Math.PI * 1.25); g.stroke();
        // collier peint + médaille
        g.strokeStyle = P.accent; g.lineWidth = 2.4;
        g.beginPath(); g.arc(56, 33, 8.2, Math.PI * .28, Math.PI * .72); g.stroke();
        g.fillStyle = GOLD; g.beginPath(); g.arc(56, 42.2, 1.7, 0, TAU); g.fill();
        // offrandes : pelotes et gamelle de croquettes
        yarn(g, 42.5, 84.5, 3.5, P.accent); yarn(g, 70.5, 85.5, 2.9, P.flag);
        g.fillStyle = '#8a5a30'; g.beginPath(); g.ellipse(56, 87, 5.4, 2.3, 0, 0, TAU); g.fill();
        g.fillStyle = '#9a6a3a';
        [[53.8, 86.2], [56.6, 85.8], [58.4, 86.6]].forEach(function (q) { g.beginPath(); g.ellipse(q[0], q[1], 1.4, 1, .3, 0, TAU); g.fill(); });
      } else if (f === 'birds') {
        // ----- héros oiseau, aile déployée -----
        taperedStroke(g, [[47, 62], [41, 66], [37.5, 64.5]], 3.4, 1.6, STd);   // plumes de queue
        g.fillStyle = stoneFill(45, 66);
        g.beginPath();
        g.moveTo(46, 65.6);
        g.quadraticCurveTo(44.5, 48, 52, 42);
        g.quadraticCurveTo(58, 38.5, 62, 44);
        g.quadraticCurveTo(66.5, 51, 65.5, 65.6);
        g.closePath(); g.fill();
        // tête + bec de pierre
        g.fillStyle = stoneFill(46, 58);
        g.beginPath(); g.arc(52, 36.5, 6.2, 0, TAU); g.fill();
        g.fillStyle = STd;
        g.beginPath(); g.moveTo(46.6, 35.2); g.lineTo(41.2, 37.6); g.lineTo(46.8, 38.6); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.1;
        g.beginPath(); g.arc(51.2, 35.6, 1.6, .3, Math.PI - .3); g.stroke();   // œil clos
        // aile déployée vers le ciel
        g.fillStyle = stoneFill(56, 78);
        g.beginPath();
        g.moveTo(57.5, 53);
        g.quadraticCurveTo(60, 38, 71.5, 26.5);
        g.quadraticCurveTo(74.5, 31, 74, 35);
        g.lineTo(76.5, 40.5);
        g.quadraticCurveTo(72, 49, 65.5, 52.5);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1.1;                    // rémiges gravées
        g.beginPath(); g.moveTo(59.5, 49); g.quadraticCurveTo(64, 40, 70.5, 30); g.stroke();
        g.beginPath(); g.moveTo(61.5, 51); g.quadraticCurveTo(67, 44, 73.5, 36.5); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(58.5, 50); g.quadraticCurveTo(61.5, 39.5, 70.5, 28.5); g.stroke();
        // jabot peint + graine d'or au bec
        g.strokeStyle = P.accent; g.lineWidth = 2.2;
        g.beginPath(); g.arc(53, 45, 5.4, Math.PI * .2, Math.PI * .8); g.stroke();
        g.fillStyle = GOLD; g.beginPath(); g.arc(43.5, 40.5, 1.5, 0, TAU); g.fill();
        // offrandes : graines, baies, plume posée
        g.fillStyle = '#e8c96a';
        [[48, 85.5], [51, 86.8], [54, 85.2], [57.5, 86.6], [61, 85.6]].forEach(function (q) { g.beginPath(); g.arc(q[0], q[1], 1.2, 0, TAU); g.fill(); });
        g.fillStyle = '#c85a4a';
        g.beginPath(); g.arc(67, 85.5, 2, 0, TAU); g.fill();
        g.beginPath(); g.arc(70.5, 86.6, 1.6, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(66.4, 84.9, .7, 0, TAU); g.fill();
        featherMark(g, 42, 85, 2.8, '#e6ddc4');
      } else {
        // ----- héros oublié, silhouette encapuchonnée érodée -----
        g.fillStyle = stoneFill(44, 68);
        g.beginPath();
        g.moveTo(45.5, 65.6);
        g.quadraticCurveTo(44.5, 48, 49, 37.5);
        g.lineTo(47.8, 34.5);                       // épaule ébréchée
        g.quadraticCurveTo(50, 28.5, 56, 27);
        g.quadraticCurveTo(62.5, 28.5, 64, 34);
        g.lineTo(66.2, 37);                          // accroc du voile
        g.quadraticCurveTo(67.5, 50, 66.5, 65.6);
        g.closePath(); g.fill();
        // creux de la capuche + drapé
        g.fillStyle = 'rgba(24,24,28,.72)';
        g.beginPath(); g.ellipse(56.5, 34.5, 4.2, 5, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.24)'; g.lineWidth = 1.4;
        g.beginPath(); g.arc(56, 33, 6.6, Math.PI * 1.05, Math.PI * 1.8); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(51, 44); g.quadraticCurveTo(49.5, 55, 50.5, 64); g.stroke();
        g.beginPath(); g.moveTo(61.5, 44); g.quadraticCurveTo(63, 55, 62, 64); g.stroke();
        // fissure fine + mousse installée
        g.strokeStyle = 'rgba(0,0,0,.24)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(58, 40); g.lineTo(56.5, 48); g.lineTo(59, 55); g.stroke();
        g.fillStyle = 'rgba(110,140,84,.55)';
        g.beginPath(); g.ellipse(48.5, 39, 3, 1.8, .5, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(64, 62, 3.6, 2, -.3, 0, TAU); g.fill();
        // offrandes anciennes : galets empilés, bougie éteinte, plume grise
        g.fillStyle = '#8a8478'; g.beginPath(); g.ellipse(44, 86, 3.4, 2, 0, 0, TAU); g.fill();
        g.fillStyle = '#a49e92'; g.beginPath(); g.ellipse(44, 83.6, 2.4, 1.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#b2aca0'; g.beginPath(); g.ellipse(44, 81.8, 1.5, 1, 0, 0, TAU); g.fill();
        g.fillStyle = '#e6ddc4'; rr(g, 66.5, 83, 3.2, 4.4, 1.2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .9;
        g.beginPath(); g.moveTo(68.1, 83); g.lineTo(68.1, 81.6); g.stroke();
        featherMark(g, 57, 86, 2.4, '#b2aea6');
      }

      // étincelles discrètes autour du sommet (respirent avec la lueur)
      [[45.5, 24, 0], [68, 22.5, 2.1], [60, 15.5, 4.2]].forEach(function (q) {
        var al = Math.max(0, Math.sin(PH * TAU + q[2])) * .55;
        if (al < .04) return;
        g.strokeStyle = 'rgba(' + gc + ',' + al.toFixed(3) + ')'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(q[0] - 1.8, q[1]); g.lineTo(q[0] + 1.8, q[1]);
        g.moveTo(q[0], q[1] - 1.8); g.lineTo(q[0], q[1] + 1.8); g.stroke();
      });
    };
  }

  // ---------- enregistrement : 3 concepts × 3 camps ----------
  ['cats', 'birds', 'neutre'].forEach(function (f) {
    reg('reinforce_' + f, {
      id: 'tambour-de-guerre', label: 'Tambour de guerre',
      anim: 'le maillet frappe le tambour', draw: drumDraw(f)
    });
    reg('reinforce_' + f, {
      id: 'carillon', label: 'Carillon de ralliement',
      anim: 'les suspensions se balancent déphasées', draw: carillonDraw(f)
    });
    reg('reinforce_' + f, {
      id: 'statue-heros', label: 'Statue du héros',
      anim: 'lueur dorée pulsant au sommet', draw: statueDraw(f)
    });
  });
})();
