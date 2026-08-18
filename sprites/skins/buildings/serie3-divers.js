"use strict";
/* ============================================================
   LAB — serie3-divers.js
   SÉRIE 3 — variantes diverses demandées à l'unité.
   Ici : 'hq_birds' / grand-chene-royal-2 — version II du Grand
   chêne royal. Exigence clé : la canopée est UNE SEULE masse
   moutonnée continue (un unique chemin fermé de lobes rempli
   d'un unique dégradé radial), modelés internes = taches
   radiales très douces SANS bord. Tronc plus noble (racines
   évasées, nervures d'écorce), maisons-nids dans des creux de
   la canopée, passerelle de corde plus fine, lanterne chaude.
   Canvas 112×112, sol y≈84-88, boucle d'anim exacte de 3.2 s.
   Self-contained : ne touche qu'à window.LAB_BUILDINGS.
   ============================================================ */
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers ----------
  var TAU = Math.PI * 2;
  function hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function hex(r,g2,b){function q(v){v=Math.max(0,Math.min(255,Math.round(v)));return(v<16?'0':'')+v.toString(16);}return'#'+q(r)+q(g2)+q(b);}
  function shade(c,k){var a=hx(c);return k>=0?hex(a[0]+(255-a[0])*k,a[1]+(255-a[1])*k,a[2]+(255-a[2])*k):hex(a[0]*(1+k),a[1]*(1+k),a[2]*(1+k));}
  function mix(c1,c2,t){var A=hx(c1),B=hx(c2);return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
  function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function softShadow(g,x,y,rx,ry,a){var s=g.createRadialGradient(x,y,1,x,y,rx);s.addColorStop(0,'rgba(20,30,15,'+a+')');s.addColorStop(1,'rgba(20,30,15,0)');g.save();g.fillStyle=s;g.translate(x,y);g.scale(1,ry/rx);g.translate(-x,-y);g.beginPath();g.arc(x,y,rx,0,TAU);g.fill();g.restore();}
  function twig(g,x0,y0,x1,y1,w,c){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
  function featherMark(g,x,y,r,c){g.fillStyle=c;g.save();g.translate(x,y);g.rotate(-.6);g.beginPath();g.moveTo(0,-r);g.quadraticCurveTo(r*.85,-r*.2,0,r*1.15);g.quadraticCurveTo(-r*.85,-r*.2,0,-r);g.closePath();g.fill();g.restore();}
  // tache radiale très douce, sans aucun bord visible
  function softPatch(g,x,y,r,rgbaIn){var p=g.createRadialGradient(x,y,r*.06,x,y,r);p.addColorStop(0,rgbaIn);p.addColorStop(1,rgbaIn.replace(/[\d.]+\)$/,'0)'));g.fillStyle=p;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}

  var PB = { wall:'#e6f1f8', wallSh:'#bcd6e6', roof:'#48a9d8', roofSh:'#2f7ea8', accent:'#3a86ff' };
  var WOODM = '#6e5434', WOODD = '#54402a';

  function reg(slot, v) { var R = window.LAB_BUILDINGS.variants; (R[slot] = R[slot] || []).push(v); }

  /* ============================================================
     OISEAUX — GRAND CHÊNE ROYAL II
     Le QG vedette, retravaillé : canopée en une seule masse
     moutonnée continue (un chemin fermé + un dégradé radial,
     modelés internes en taches douces sans bord), tronc noble à
     racines évasées et nervures, maisons-nids nichées dans des
     creux, passerelle de corde fine, lanterne chaude.
     ANIM : la canopée respire (k=1), la lanterne oscille (k=2).
     ============================================================ */
  reg('hq_birds', {
    id: 'grand-chene-royal-2', label: 'Grand chêne royal II',
    anim: 'canopée qui respire, lanterne oscille',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2, i;
      softShadow(g, 56, 88, 34, 10, 0.24);

      // ---- tronc noble : fût élancé, racines évasées ----
      var tg = g.createLinearGradient(40, 0, 70, 0);
      tg.addColorStop(0, '#a3835a'); tg.addColorStop(.5, '#7a5c38'); tg.addColorStop(1, WOODD);
      g.fillStyle = tg;
      g.beginPath();
      g.moveTo(33, 88);
      g.quadraticCurveTo(44, 86, 47, 74);   // évasement gauche
      g.quadraticCurveTo(49, 60, 50, 46);
      g.lineTo(63, 46);
      g.quadraticCurveTo(64, 60, 66, 74);
      g.quadraticCurveTo(69, 86, 80, 88);   // évasement droit
      g.quadraticCurveTo(73, 86.2, 67, 87.6);  // orteils de racines
      g.quadraticCurveTo(61.5, 89.6, 56.5, 87.4);
      g.quadraticCurveTo(51, 89.6, 46, 87.4);
      g.quadraticCurveTo(40, 86.2, 33, 88);
      g.closePath(); g.fill();
      // nervures d'écorce (2-3), rehaut et nœud
      g.strokeStyle = 'rgba(50,34,16,.42)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(53, 50); g.quadraticCurveTo(51.5, 66, 48, 82); g.stroke();
      g.beginPath(); g.moveTo(59.5, 52); g.quadraticCurveTo(60.5, 68, 64, 83); g.stroke();
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(56.2, 55); g.quadraticCurveTo(55.6, 68, 55.2, 79); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(51.2, 52); g.quadraticCurveTo(50.2, 66, 46.6, 79); g.stroke();
      g.strokeStyle = 'rgba(50,34,16,.4)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(58.6, 68, 2, 2.8, 0, 0, TAU); g.stroke();
      // départ des racines souligné
      g.strokeStyle = 'rgba(50,34,16,.32)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(38, 86.8); g.quadraticCurveTo(44, 83.5, 46.8, 76); g.stroke();
      g.beginPath(); g.moveTo(75, 86.8); g.quadraticCurveTo(68.5, 83.5, 66.2, 76); g.stroke();

      // ---- ANIM k=1 : la canopée respire (scale vertical ±1.5 %) ----
      g.save();
      var sc = 1 + 0.015 * Math.sin(PH * TAU);
      g.translate(56, 30); g.scale(1, sc); g.translate(-56, -30);

      // canopée : UN SEUL chemin fermé de lobes moutonnés
      function canopyPath() {
        g.beginPath();
        g.moveTo(23, 45);
        g.quadraticCurveTo(11, 43, 13.5, 33);      // lobe bas-gauche
        g.quadraticCurveTo(6.5, 24, 18, 18.5);     // lobe gauche
        g.quadraticCurveTo(17.5, 9, 31, 11);       // lobe haut-gauche
        g.quadraticCurveTo(40, 4.5, 53, 8.5);      // sommet gauche
        g.quadraticCurveTo(65, 3.5, 74, 10);       // sommet droit
        g.quadraticCurveTo(87.5, 8, 89, 18);       // lobe haut-droit
        g.quadraticCurveTo(101.5, 22, 95.5, 31.5); // lobe droit
        g.quadraticCurveTo(103.5, 41, 89.5, 45.5); // lobe bas-droit
        g.quadraticCurveTo(85, 52.5, 75.5, 49);    // ourlet inférieur
        g.quadraticCurveTo(67, 54.5, 57.5, 50.5);
        g.quadraticCurveTo(48, 55, 38.5, 49.5);
        g.quadraticCurveTo(29, 52.5, 23, 45);
        g.closePath();
      }
      // UN SEUL dégradé radial : clair haut-gauche -> sombre bas-droit
      var cg = g.createRadialGradient(37, 17, 5, 55, 31, 64);
      cg.addColorStop(0, '#93bf68');
      cg.addColorStop(.45, '#639348');
      cg.addColorStop(1, '#3c5c2b');
      canopyPath(); g.fillStyle = cg; g.fill();
      // modelés internes : 3 taches radiales très douces, sans bord
      g.save(); canopyPath(); g.clip();
      softPatch(g, 33, 17, 19, 'rgba(218,238,180,.16)');
      softPatch(g, 68, 14, 15, 'rgba(218,238,180,.11)');
      softPatch(g, 74, 42, 24, 'rgba(16,36,12,.17)');
      g.restore();

      // ---- maisons-nids nichées dans des creux de la canopée ----
      function maison(cx, cy, w) {
        var h = w * .82;
        // creux d'ombre douce derrière la maison (sans bord)
        softPatch(g, cx, cy - h * .1, w * 1.15, 'rgba(14,30,10,.30)');
        // murs de planches claires
        var wg = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
        wg.addColorStop(0, mix(PB.wall, '#ffffff', .18));
        wg.addColorStop(.6, PB.wall); wg.addColorStop(1, PB.wallSh);
        g.fillStyle = wg; rr(g, cx - w / 2, cy - h / 2, w, h, 2.6); g.fill();
        g.strokeStyle = 'rgba(74,106,128,.28)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(cx - w / 2 + 1.4, cy - h * .12); g.lineTo(cx + w / 2 - 1.4, cy - h * .12); g.stroke();
        g.beginPath(); g.moveTo(cx - w / 2 + 1.4, cy + h * .2); g.lineTo(cx + w / 2 - 1.4, cy + h * .2); g.stroke();
        // toit bombé bleu
        var rg = g.createLinearGradient(0, cy - h / 2 - w * .6, 0, cy - h / 2 + 1.5);
        rg.addColorStop(0, shade(PB.roof, .2)); rg.addColorStop(1, PB.roofSh);
        g.fillStyle = rg;
        g.beginPath();
        g.moveTo(cx - w / 2 - 2.6, cy - h / 2 + 1);
        g.quadraticCurveTo(cx, cy - h / 2 - w * .72, cx + w / 2 + 2.6, cy - h / 2 + 1);
        g.quadraticCurveTo(cx, cy - h / 2 - 1.2, cx - w / 2 - 2.6, cy - h / 2 + 1);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(cx - w * .34, cy - h / 2 - w * .22);
        g.quadraticCurveTo(cx, cy - h / 2 - w * .46, cx + w * .3, cy - h / 2 - w * .2);
        g.stroke();
        // trou d'envol + perchoir
        g.fillStyle = '#28211a';
        g.beginPath(); g.arc(cx, cy + h * .06, w * .17, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.2)';
        g.beginPath(); g.arc(cx - w * .05, cy, w * .06, 0, TAU); g.fill();
        twig(g, cx, cy + h * .3, cx + w * .32, cy + h * .46, 1.5, WOODD);
        // frondaison qui retombe doucement sur le faîte (sans bord)
        softPatch(g, cx, cy - h / 2 - w * .34, w * .72, 'rgba(94,142,64,.42)');
      }
      maison(34, 37, 15);
      maison(77, 31, 13.5);
      maison(56, 19, 11.5);

      // ---- passerelle de corde, plus fine ----
      g.strokeStyle = 'rgba(110,84,52,.9)'; g.lineWidth = .9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(41, 40.5); g.quadraticCurveTo(56, 47, 70.5, 35.5); g.stroke();
      g.beginPath(); g.moveTo(41, 42.4); g.quadraticCurveTo(56, 49, 70.5, 37.4); g.stroke();
      for (i = 1; i <= 5; i++) {
        var t2 = i / 6, mt2 = 1 - t2;
        var bx = mt2 * mt2 * 41 + 2 * mt2 * t2 * 56 + t2 * t2 * 70.5;
        var by = mt2 * mt2 * 40.5 + 2 * mt2 * t2 * 47 + t2 * t2 * 35.5;
        twig(g, bx, by + .3, bx + .5, by + 2.3, 1.4, '#a8804c');
      }
      // cordelette fine vers la maison du sommet
      g.strokeStyle = 'rgba(110,84,52,.7)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(59.5, 22.5); g.quadraticCurveTo(64.5, 27, 73, 27.5); g.stroke();

      g.restore(); // fin respiration canopée

      // ---- ANIM k=2 : petite lanterne chaude qui oscille ----
      twig(g, 85, 33, 90.5, 36.5, 2.2, WOODM);
      twig(g, 90.5, 36.5, 94.5, 39.5, 1.5, WOODM);
      g.save();
      g.translate(94.5, 39.5);
      g.rotate(Math.sin(PH * TAU * 2) * .10);
      g.strokeStyle = 'rgba(80,60,30,.85)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 5); g.stroke();
      var lg = g.createRadialGradient(0, 10, .8, 0, 10, 7.5);
      lg.addColorStop(0, 'rgba(255,216,120,.85)'); lg.addColorStop(1, 'rgba(255,216,120,0)');
      g.fillStyle = lg; g.beginPath(); g.arc(0, 10, 7.5, 0, TAU); g.fill();
      g.fillStyle = WOODD; rr(g, -2.7, 5.4, 5.4, 1.8, .8); g.fill();
      var lb = g.createLinearGradient(-2.2, 0, 2.2, 0);
      lb.addColorStop(0, '#f8d878'); lb.addColorStop(1, '#cf9c2e');
      g.fillStyle = lb; rr(g, -2.2, 7, 4.4, 6, 1.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,.45)';
      g.beginPath(); g.arc(-.7, 9.3, .9, 0, TAU); g.fill();
      g.fillStyle = WOODD; rr(g, -2.7, 13, 5.4, 1.6, .8); g.fill();
      g.restore();

      // ---- au pied : glands et une plume tombée ----
      [[42, 87, .35], [79, 86.5, -.25]].forEach(function (q) {
        g.save(); g.translate(q[0], q[1]); g.rotate(q[2]);
        g.fillStyle = '#b07c3e';
        g.beginPath(); g.ellipse(0, .8, 1.9, 2.5, 0, 0, TAU); g.fill();
        g.fillStyle = WOODM;
        g.beginPath(); g.ellipse(0, -1.3, 2.1, 1.3, 0, 0, TAU); g.fill();
        g.strokeStyle = WOODM; g.lineWidth = .9; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, -2.4); g.lineTo(.6, -4); g.stroke();
        g.restore();
      });
      featherMark(g, 28, 84.5, 3.2, 'rgba(188,214,230,.9)');
    }
  });
})();
