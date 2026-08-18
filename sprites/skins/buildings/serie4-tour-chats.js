"use strict";
/* ============================================================
   LAB — serie4-tour-chats.js (SÉRIE 4)
   5 variantes pour le slot 'defense_cats' (tour de garde féline) :
   t4-base-v2   : l'arbre à chat de guerre du jeu, fignolé + animé
   t4-mirador   : arbre à chat mirador à plateformes et vigie
   t4-caisses   : pile de caisses en carton avec périscope
   t4-phare     : phare à pelote de laine lumineuse
   t4-catapulte : catapulte à pelotes sur tourelle crénelée
   Canvas 112×112, sol y≈84-88, boucle d'anim exacte de 3.2 s.
   Self-contained : ne touche qu'à window.LAB_BUILDINGS.
   ============================================================ */
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers locaux (copie conforme série 2) ----------
  var TAU = Math.PI * 2;
  function hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function hex(r,g2,b){function q(v){v=Math.max(0,Math.min(255,Math.round(v)));return(v<16?'0':'')+v.toString(16);}return'#'+q(r)+q(g2)+q(b);}
  function shade(c,k){var a=hx(c);return k>=0?hex(a[0]+(255-a[0])*k,a[1]+(255-a[1])*k,a[2]+(255-a[2])*k):hex(a[0]*(1+k),a[1]*(1+k),a[2]*(1+k));}
  function mix(c1,c2,t){var A=hx(c1),B=hx(c2);return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
  function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function softShadow(g,x,y,rx,ry,a){var s=g.createRadialGradient(x,y,1,x,y,rx);s.addColorStop(0,'rgba(20,30,15,'+a+')');s.addColorStop(1,'rgba(20,30,15,0)');g.save();g.fillStyle=s;g.translate(x,y);g.scale(1,ry/rx);g.translate(-x,-y);g.beginPath();g.arc(x,y,rx,0,TAU);g.fill();g.restore();}
  function twig(g,x0,y0,x1,y1,w,c){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
  function pawPrint(g,x,y,r,c){g.fillStyle=c;g.beginPath();g.ellipse(x,y+r*.5,r,r*.8,0,0,TAU);g.fill();[-.75,0,.75].forEach(function(a){g.beginPath();g.arc(x+Math.sin(a)*r*1.35,y-r*.75+Math.abs(a)*r*.35,r*.42,0,TAU);g.fill();});}
  function taperedStroke(g,pts,w0,w1,color){g.strokeStyle=color;g.lineCap='round';var n=pts.length-1;for(var i=0;i<n;i++){g.lineWidth=w0+(w1-w0)*(i/n);g.beginPath();g.moveTo(pts[i][0],pts[i][1]);g.lineTo(pts[i+1][0],pts[i+1][1]);g.stroke();}}
  function prng(seed){var a=(seed|0)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  var PAL = {
    cats:   { wall: '#f4ddb8', wallSh: '#d9b98a', roof: '#f08c42', roofSh: '#c9662a', accent: '#e76f51', flag: '#f08c42', door: '#8a5a30' },
    birds:  { wall: '#e6f1f8', wallSh: '#bcd6e6', roof: '#48a9d8', roofSh: '#2f7ea8', accent: '#3a86ff', flag: '#48a9d8', door: '#4a6a80' },
    neutre: { wall: '#d8d5ce', wallSh: '#b2aea6', roof: '#a8a49c', roofSh: '#847f76', accent: '#98948c', flag: '#b0aca4', door: '#6e6a62' }
  };
  var WOOD = '#8a6a44', WOODM = '#6e5434', WOODD = '#54402a', LWOOD = '#c9a86a';
  var CARD = '#dcb77e', CARDSH = '#b8935c', INK = '#7a5a34';

  // brins d'herbe au pied (3 brins, penchés par le vent dominant)
  function herbe(g, x, y, h, lean) {
    g.lineCap = 'round';
    [['rgba(106,148,78,.85)', 0], ['rgba(122,160,90,.75)', -1.6], ['rgba(96,136,70,.8)', 1.7]].forEach(function (b) {
      g.strokeStyle = b[0]; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x + b[1], y);
      g.quadraticCurveTo(x + b[1] + lean * .6, y - h * .6, x + b[1] + lean * 1.6, y - h);
      g.stroke();
    });
  }
  // pelote de laine roulée (dégradé + brins enroulés)
  function pelote(g, x, y, r, col) {
    var pg = g.createRadialGradient(x - r * .35, y - r * .4, r * .2, x, y, r);
    pg.addColorStop(0, mix(col, '#ffffff', .45)); pg.addColorStop(1, shade(col, -.24));
    g.fillStyle = pg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = shade(col, -.4); g.lineWidth = Math.max(.7, r * .16);
    g.beginPath(); g.arc(x, y, r * .68, .5, 2.7); g.stroke();
    g.beginPath(); g.arc(x, y, r * .42, 3.3, 5.6); g.stroke();
    g.beginPath(); g.ellipse(x, y, r * .9, r * .52, -.7, 2.5, 4.2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.4)';
    g.beginPath(); g.arc(x - r * .35, y - r * .42, r * .22, 0, TAU); g.fill();
  }

  /* ============================================================
     1) t4-base-v2 — l'arbre à chat de guerre ACTUEL du jeu
        (silhouette fidèle : socle, poteau sisal, deux plateformes
        à coussin, griffures, fanion, jouet suspendu), fignolé :
        dégradés, chevilles, nœud du bois, capitons, herbe.
        Anim : le jouet suspendu se balance au bout de sa ficelle.
     ============================================================ */
  reg('defense_cats', {
    id: 't4-base-v2', label: 'Tour v2 (base animée)', anim: 'le jouet suspendu se balance',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2, P = PAL.cats;
      softShadow(g, 56, 88, 34, 10, 0.24);
      // herbe et caillou au pied
      herbe(g, 33, 86.5, 6, 1.2); herbe(g, 80, 87, 5, -1.2);
      g.fillStyle = '#b9b2a2'; g.beginPath(); g.ellipse(77, 86, 2.6, 1.5, .2, 0, TAU); g.fill();
      // socle : planche épaisse, rehaut, deux chevilles, nœud du bois
      var sg = g.createLinearGradient(0, 79, 0, 88);
      sg.addColorStop(0, shade(WOOD, .16)); sg.addColorStop(1, shade(WOOD, -.26));
      g.fillStyle = sg; rr(g, 38, 80, 36, 8, 3); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(41, 81.8); g.lineTo(71, 81.8); g.stroke();
      g.fillStyle = 'rgba(60,42,20,.55)';
      g.beginPath(); g.arc(42.5, 84, 1.1, 0, TAU); g.fill();
      g.beginPath(); g.arc(69.5, 84, 1.1, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,42,20,.4)'; g.lineWidth = 1;
      g.beginPath(); g.arc(63, 84.4, 1.5, .4, TAU); g.stroke();
      // poteau sisal (fidèle au jeu) + rehaut vertical
      var pg2 = g.createLinearGradient(50, 0, 62, 0);
      pg2.addColorStop(0, shade(LWOOD, .2)); pg2.addColorStop(.5, LWOOD); pg2.addColorStop(1, shade(LWOOD, -.3));
      g.fillStyle = pg2; rr(g, 51, 26, 10, 56, 4); g.fill();
      g.strokeStyle = 'rgba(110,80,40,.5)'; g.lineWidth = 1.4;
      for (var y = 30; y < 80; y += 4.5) { g.beginPath(); g.moveTo(51.5, y); g.lineTo(60.5, y - 2.4); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(53, 29); g.lineTo(53, 79); g.stroke();
      // plateformes garnies : ombre portée, plateau en dégradé,
      // coussin capitonné à boutons et couture
      [[56, 52, 20], [56, 26, 15]].forEach(function (q) {
        g.fillStyle = 'rgba(40,26,10,.18)';
        g.beginPath(); g.ellipse(q[0], q[1] + 2.6, q[2] * .92, q[2] * .3, 0, 0, TAU); g.fill();
        var wg = g.createLinearGradient(q[0] - q[2], 0, q[0] + q[2], 0);
        wg.addColorStop(0, shade(WOOD, .26)); wg.addColorStop(1, shade(WOOD, -.1));
        g.fillStyle = wg;
        g.beginPath(); g.ellipse(q[0], q[1], q[2], q[2] * .38, 0, 0, TAU); g.fill();
        var cg = g.createLinearGradient(0, q[1] - q[2] * .3, 0, q[1] + q[2] * .16);
        cg.addColorStop(0, mix(P.accent, '#ffffff', .4)); cg.addColorStop(1, shade(P.accent, -.14));
        g.fillStyle = cg;
        g.beginPath(); g.ellipse(q[0], q[1] - 1.4, q[2] * .8, q[2] * .26, 0, 0, TAU); g.fill();
        g.fillStyle = shade(P.accent, -.35);
        [-.45, 0, .45].forEach(function (t) {
          g.beginPath(); g.arc(q[0] + t * q[2], q[1] - 1.4, .9, 0, TAU); g.fill();
        });
        g.strokeStyle = shade(P.accent, -.3); g.lineWidth = .9; g.globalAlpha = .6;
        g.beginPath(); g.ellipse(q[0], q[1] - 1.4, q[2] * .8, q[2] * .26, 0, .2, Math.PI - .2); g.stroke();
        g.globalAlpha = 1;
      });
      // griffures de service (fidèle)
      g.strokeStyle = 'rgba(70,46,20,.6)'; g.lineWidth = 1.2;
      [-2.4, 0, 2.4].forEach(function (d) {
        g.beginPath(); g.moveTo(54 + d, 62); g.lineTo(56 + d, 74); g.stroke();
      });
      // fanion au sommet, ourlé et souligné
      twig(g, 56, 24, 56, 10, 2, '#6e5a40');
      var fgd = g.createLinearGradient(0, 11, 0, 18);
      fgd.addColorStop(0, shade(P.flag, .18)); fgd.addColorStop(1, shade(P.flag, -.16));
      g.fillStyle = fgd;
      g.beginPath(); g.moveTo(57, 11); g.lineTo(68, 14); g.lineTo(57, 17.5); g.closePath(); g.fill();
      g.strokeStyle = shade(P.flag, -.4); g.lineWidth = .9; g.globalAlpha = .5;
      g.beginPath(); g.moveTo(57, 11); g.lineTo(68, 14); g.lineTo(57, 17.5); g.closePath(); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#f4c542'; g.beginPath(); g.arc(56, 9.4, 1.6, 0, TAU); g.fill();
      // ANIM : le jouet suspendu (pelote + plume) se balance
      // pivot au bord de la plateforme haute, angle de repos .21
      var a = .21 + Math.sin(PH * TAU) * .32;
      g.save(); g.translate(70, 27); g.rotate(a);
      g.strokeStyle = '#5c4626'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 12.4); g.stroke();
      pelote(g, 0, 15.4, 3.4, P.flag);
      g.fillStyle = mix(P.accent, '#ffffff', .3);
      g.beginPath(); g.moveTo(0, 18.6);
      g.quadraticCurveTo(2.4, 21.2, .6, 23.6);
      g.quadraticCurveTo(-1.5, 21, 0, 18.6); g.closePath(); g.fill();
      g.restore();
    }
  });

  /* ============================================================
     2) t4-mirador — arbre à chat mirador : tronc massif, échelons
        cloués, deux plateformes en quinconce (pelote de réserve,
        coussin de sieste), nid-de-pie à claire-voie sous auvent
        festonné, et une vigie rousse très concentrée.
        Anim : la tête de la vigie balaie lentement l'horizon.
     ============================================================ */
  reg('defense_cats', {
    id: 't4-mirador', label: 'Mirador à plateformes', anim: 'la vigie tourne la tête',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2, P = PAL.cats;
      softShadow(g, 56, 88, 34, 10, 0.24);
      herbe(g, 30, 87, 6, 1); herbe(g, 84, 86.5, 5.5, -1.2);
      // tronc massif légèrement conique
      var tg = g.createLinearGradient(48, 0, 66, 0);
      tg.addColorStop(0, shade(WOOD, .22)); tg.addColorStop(.5, WOOD); tg.addColorStop(1, shade(WOOD, -.28));
      g.fillStyle = tg;
      g.beginPath();
      g.moveTo(48, 86); g.quadraticCurveTo(50, 60, 51.5, 33);
      g.lineTo(60.5, 33); g.quadraticCurveTo(62, 60, 64, 86);
      g.quadraticCurveTo(56, 88, 48, 86); g.closePath(); g.fill();
      // veines + nœud du bois + moucheture d'écorce
      g.strokeStyle = 'rgba(70,46,20,.35)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(54, 38); g.quadraticCurveTo(53, 60, 54.5, 84); g.stroke();
      g.beginPath(); g.moveTo(58.5, 36); g.quadraticCurveTo(59.5, 58, 58.5, 82); g.stroke();
      g.strokeStyle = 'rgba(70,46,20,.5)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(56.5, 66, 1.8, 2.4, .2, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(70,46,20,.35)';
      g.beginPath(); g.ellipse(56.5, 66, .7, 1, .2, 0, TAU); g.fill();
      var rn = prng(3);
      for (var s = 0; s < 5; s++) {
        g.beginPath(); g.arc(52 + rn() * 8, 40 + rn() * 42, .6, 0, TAU); g.fill();
      }
      // échelons cloués sur le tronc
      for (var i = 0; i < 5; i++) {
        var ey = 78 - i * 9;
        var lg = g.createLinearGradient(0, ey, 0, ey + 3);
        lg.addColorStop(0, shade(LWOOD, .18)); lg.addColorStop(1, shade(LWOOD, -.2));
        g.fillStyle = lg; rr(g, 51, ey, 10.5, 3, 1.4); g.fill();
        g.fillStyle = 'rgba(60,42,20,.5)';
        g.beginPath(); g.arc(52.7, ey + 1.5, .6, 0, TAU); g.fill();
        g.beginPath(); g.arc(59.8, ey + 1.5, .6, 0, TAU); g.fill();
      }
      // plateforme basse (gauche) + équerre + pelote de réserve
      twig(g, 50, 71, 34, 62.5, 2.6, WOODM);
      var p1 = g.createLinearGradient(0, 58, 0, 63);
      p1.addColorStop(0, shade(LWOOD, .22)); p1.addColorStop(1, shade(LWOOD, -.22));
      g.fillStyle = p1; rr(g, 29, 58, 24, 4.5, 2); g.fill();
      pelote(g, 36.5, 54.6, 3.8, P.flag);
      // plateforme droite + équerre + coussin de sieste boutonné
      twig(g, 62, 57, 78, 48.5, 2.6, WOODM);
      var p2 = g.createLinearGradient(0, 44, 0, 49);
      p2.addColorStop(0, shade(LWOOD, .22)); p2.addColorStop(1, shade(LWOOD, -.22));
      g.fillStyle = p2; rr(g, 60, 44, 24, 4.5, 2); g.fill();
      var cg2 = g.createLinearGradient(0, 40, 0, 46);
      cg2.addColorStop(0, mix(P.accent, '#ffffff', .45)); cg2.addColorStop(1, shade(P.accent, -.12));
      g.fillStyle = cg2; g.beginPath(); g.ellipse(73.5, 43, 7.5, 3, 0, 0, TAU); g.fill();
      g.fillStyle = shade(P.accent, -.32);
      g.beginPath(); g.arc(70.5, 43, .8, 0, TAU); g.fill();
      g.beginPath(); g.arc(76.5, 43, .8, 0, TAU); g.fill();
      // étais du nid-de-pie
      twig(g, 52, 42, 44, 33.8, 2.4, WOODM);
      twig(g, 60, 42, 68, 33.8, 2.4, WOODM);
      // paroi arrière du panier (plus sombre)
      g.fillStyle = shade(WOOD, -.28); rr(g, 42, 21.5, 28, 11.5, 3); g.fill();
      // LA VIGIE — corps entre les deux parois
      g.fillStyle = '#e8a35c';
      g.beginPath(); g.ellipse(56, 27, 5.5, 4, 0, 0, TAU); g.fill();
      // ANIM : la tête pivote lentement (cou à 56,23.5)
      var ha = Math.sin(PH * TAU) * .3;
      g.save(); g.translate(56, 23.5); g.rotate(ha);
      // oreilles + intérieur rosé
      g.fillStyle = '#e8a35c';
      g.beginPath(); g.moveTo(-3.6, -6.2); g.lineTo(-4.4, -9.6); g.lineTo(-.9, -7.2); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(3.6, -6.2); g.lineTo(4.4, -9.6); g.lineTo(.9, -7.2); g.closePath(); g.fill();
      g.fillStyle = '#f0b98a';
      g.beginPath(); g.moveTo(-3.3, -6.6); g.lineTo(-3.8, -8.6); g.lineTo(-1.8, -7.1); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(3.3, -6.6); g.lineTo(3.8, -8.6); g.lineTo(1.8, -7.1); g.closePath(); g.fill();
      // tête + rayures de tigre
      var hg = g.createRadialGradient(-1.2, -5.4, 1, 0, -4, 4.6);
      hg.addColorStop(0, mix('#e8a35c', '#ffffff', .3)); hg.addColorStop(1, '#dd934c');
      g.fillStyle = hg; g.beginPath(); g.arc(0, -4, 4.1, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(150,90,40,.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-1.4, -7.8); g.lineTo(-1.1, -6.4); g.stroke();
      g.beginPath(); g.moveTo(1.4, -7.8); g.lineTo(1.1, -6.4); g.stroke();
      // yeux plissés de pro + nez + moustaches
      g.fillStyle = '#33261a';
      g.beginPath(); g.arc(-1.6, -4.4, .75, 0, TAU); g.fill();
      g.beginPath(); g.arc(1.6, -4.4, .75, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.arc(-1.85, -4.65, .28, 0, TAU); g.fill();
      g.beginPath(); g.arc(1.35, -4.65, .28, 0, TAU); g.fill();
      g.fillStyle = '#c96a4a';
      g.beginPath(); g.moveTo(-.7, -2.7); g.lineTo(.7, -2.7); g.lineTo(0, -1.8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(90,58,30,.5)'; g.lineWidth = .7;
      g.beginPath(); g.moveTo(-2.2, -2.4); g.lineTo(-5.2, -2.9); g.stroke();
      g.beginPath(); g.moveTo(-2.2, -1.9); g.lineTo(-5, -1.6); g.stroke();
      g.beginPath(); g.moveTo(2.2, -2.4); g.lineTo(5.2, -2.9); g.stroke();
      g.beginPath(); g.moveTo(2.2, -1.9); g.lineTo(5, -1.6); g.stroke();
      g.restore();
      // paroi avant du panier à claire-voie + lisse + emblème
      var fw = g.createLinearGradient(0, 24.5, 0, 33.5);
      fw.addColorStop(0, shade(WOOD, .18)); fw.addColorStop(1, shade(WOOD, -.18));
      g.fillStyle = fw; rr(g, 41, 24.5, 30, 9, 3); g.fill();
      g.strokeStyle = 'rgba(60,42,20,.35)'; g.lineWidth = 1;
      for (var vx = 46; vx <= 66; vx += 5) {
        g.beginPath(); g.moveTo(vx, 25.5); g.lineTo(vx, 32.5); g.stroke();
      }
      pawPrint(g, 56, 29, 2.1, 'rgba(201,102,42,.55)');
      var rg = g.createLinearGradient(0, 22.6, 0, 25.8);
      rg.addColorStop(0, shade(LWOOD, .24)); rg.addColorStop(1, shade(LWOOD, -.14));
      g.fillStyle = rg; rr(g, 40, 22.6, 32, 3.2, 1.6); g.fill();
      // auvent : poteaux, toit, feston, pompon
      twig(g, 44, 23.5, 44, 11.5, 1.8, WOODD);
      twig(g, 68, 23.5, 68, 11.5, 1.8, WOODD);
      var rgd = g.createLinearGradient(0, 3.5, 0, 12);
      rgd.addColorStop(0, shade(P.roof, .2)); rgd.addColorStop(1, shade(P.roof, -.1));
      g.fillStyle = rgd;
      g.beginPath(); g.moveTo(40, 11.5); g.lineTo(56, 3.5); g.lineTo(72, 11.5); g.closePath(); g.fill();
      g.strokeStyle = P.roofSh; g.lineWidth = 1; g.globalAlpha = .55;
      g.beginPath(); g.moveTo(40, 11.5); g.lineTo(56, 3.5); g.lineTo(72, 11.5); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = shade(P.roof, -.12);
      [44, 52, 60, 68].forEach(function (cx) {
        g.beginPath(); g.arc(cx, 11.5, 2.6, 0, Math.PI); g.fill();
      });
      g.fillStyle = '#f4c542'; g.beginPath(); g.arc(56, 3.2, 1.5, 0, TAU); g.fill();
    }
  });

  /* ============================================================
     3) t4-caisses — pile de trois caisses en carton scotchées :
        chatière découpée au feutre, meurtrière à deux yeux,
        marquages gribouillés, queue qui dépasse d'une couture,
        et périscope en tubes de carton émergeant des rabats.
        Anim : le périscope scrute les environs (haut/bas).
     ============================================================ */
  reg('defense_cats', {
    id: 't4-caisses', label: 'Caisses à périscope', anim: 'le périscope scrute les environs',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2, P = PAL.cats;
      softShadow(g, 56, 88, 34, 10, 0.24);
      herbe(g, 27, 87, 6, 1.4); herbe(g, 87, 86.5, 5, -1);
      // GRANDE CAISSE du bas
      var b1 = g.createLinearGradient(30, 0, 82, 0);
      b1.addColorStop(0, shade(CARD, .16)); b1.addColorStop(.55, CARD); b1.addColorStop(1, shade(CARD, -.18));
      g.fillStyle = b1; rr(g, 30, 58, 52, 28, 3); g.fill();
      // tranche cannelée visible sur le flanc droit
      g.fillStyle = 'rgba(122,90,52,.22)';
      for (var cx2 = 75.5; cx2 <= 79; cx2 += 2.3) g.fillRect(cx2, 60, 1.2, 24);
      // couture de scotch horizontale
      g.globalAlpha = .5; g.fillStyle = '#f2e6c0'; g.fillRect(30, 62.5, 52, 5); g.globalAlpha = 1;
      // éraflures du carton (vécu)
      var rn = prng(7);
      g.strokeStyle = 'rgba(122,90,52,.3)'; g.lineWidth = .9;
      for (var e = 0; e < 4; e++) {
        var ex = 34 + rn() * 20, ey2 = 70 + rn() * 12;
        g.beginPath(); g.moveTo(ex, ey2); g.lineTo(ex + 3 + rn() * 3, ey2 - 1 - rn() * 2); g.stroke();
      }
      // chatière découpée + rabat replié + contour feutre
      g.fillStyle = 'rgba(50,32,14,.82)';
      g.beginPath(); g.moveTo(48, 86); g.lineTo(48, 76); g.arc(56, 76, 8, Math.PI, 0); g.lineTo(64, 86); g.closePath(); g.fill();
      g.fillStyle = shade(CARDSH, .1);
      g.beginPath(); g.moveTo(64, 86); g.lineTo(72, 83); g.lineTo(70, 73); g.lineTo(64, 75.5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(122,90,52,.35)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(64, 75.5); g.lineTo(70, 73); g.stroke();
      g.strokeStyle = INK; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(48, 84); g.lineTo(48, 76); g.arc(56, 76, 8, Math.PI, 0); g.lineTo(64, 84); g.stroke();
      // tampon patte + flèche « vers l'ennemi »
      pawPrint(g, 38.5, 72, 2.4, 'rgba(201,102,42,.45)');
      g.strokeStyle = INK; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(67, 71); g.lineTo(75, 71); g.stroke();
      g.beginPath(); g.moveTo(72.6, 68.8); g.lineTo(75.4, 71); g.lineTo(72.6, 73.2); g.stroke();
      // queue rayée qui dépasse de la couture
      taperedStroke(g, [[77.5, 58.5], [80.6, 63.5], [78.8, 70]], 4, 2.2, '#e8a35c');
      g.strokeStyle = 'rgba(150,90,40,.65)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(78.6, 60.6); g.lineTo(80.6, 61.4); g.stroke();
      g.beginPath(); g.moveTo(79.4, 64.6); g.lineTo(81.2, 65.2); g.stroke();
      g.fillStyle = '#f6f1e6'; g.beginPath(); g.arc(78.8, 70.4, 1.7, 0, TAU); g.fill();
      // CAISSE du milieu, en léger retrait
      var b2 = g.createLinearGradient(35, 0, 77, 0);
      b2.addColorStop(0, shade(CARD, .2)); b2.addColorStop(.5, shade(CARD, .04)); b2.addColorStop(1, shade(CARD, -.14));
      g.fillStyle = b2; rr(g, 35, 38, 42, 21, 3); g.fill();
      g.fillStyle = 'rgba(40,26,10,.14)'; g.fillRect(35, 56.5, 42, 2.5); // ombre d'appui
      // meurtrière : fente sombre, deux yeux aux aguets
      g.fillStyle = 'rgba(40,24,8,.85)'; rr(g, 41, 44, 16, 6, 3); g.fill();
      g.fillStyle = '#f6f1e6';
      g.beginPath(); g.ellipse(45.6, 47, 1.9, 1.6, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(51.4, 47, 1.9, 1.6, 0, 0, TAU); g.fill();
      g.fillStyle = '#3a2c1c';
      g.beginPath(); g.arc(46.2, 47.1, .85, 0, TAU); g.fill();
      g.beginPath(); g.arc(52, 47.1, .85, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)';
      g.beginPath(); g.arc(45.9, 46.7, .3, 0, TAU); g.fill();
      g.beginPath(); g.arc(51.7, 46.7, .3, 0, TAU); g.fill();
      // gribouillis « fragile » : verre à pied + soulignés
      g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.moveTo(64, 42.5); g.lineTo(68, 42.5); g.stroke();
      g.beginPath(); g.moveTo(64.6, 42.5); g.quadraticCurveTo(66, 45, 66, 46.4); g.stroke();
      g.beginPath(); g.moveTo(67.4, 42.5); g.quadraticCurveTo(66, 45, 66, 46.4); g.stroke();
      g.beginPath(); g.moveTo(66, 46.4); g.lineTo(66, 48.2); g.stroke();
      g.beginPath(); g.moveTo(64.6, 48.4); g.lineTo(67.4, 48.4); g.stroke();
      g.beginPath(); g.moveTo(62.5, 51.5); g.lineTo(69.5, 51.5); g.stroke();
      g.beginPath(); g.moveTo(63.5, 53.4); g.lineTo(68.5, 53.4); g.stroke();
      // scotch vertical sur la caisse du milieu
      g.globalAlpha = .45; g.fillStyle = '#f2e6c0';
      g.save(); g.translate(59.5, 48.5); g.rotate(.05); g.fillRect(-2.3, -10.5, 4.6, 21); g.restore();
      g.globalAlpha = 1;
      // PETITE CAISSE du haut : intérieur sombre, tube, rabats ouverts
      var b3 = g.createLinearGradient(41, 0, 71, 0);
      b3.addColorStop(0, shade(CARD, .22)); b3.addColorStop(1, shade(CARD, -.1));
      g.fillStyle = b3; rr(g, 41, 22, 30, 17, 3); g.fill();
      g.fillStyle = 'rgba(40,26,10,.14)'; g.fillRect(41, 36.5, 30, 2.5);
      g.fillStyle = 'rgba(50,32,14,.8)'; rr(g, 43, 22, 26, 4, 2); g.fill();
      // tube vertical du périscope (carton, bagues, scotch de base)
      var tb = g.createLinearGradient(52.5, 0, 59.5, 0);
      tb.addColorStop(0, shade(CARD, .18)); tb.addColorStop(1, shade(CARDSH, -.08));
      g.fillStyle = tb; rr(g, 52.5, 6, 7, 18, 3); g.fill();
      g.strokeStyle = 'rgba(122,90,52,.35)'; g.lineWidth = 1;
      [10.5, 14.5, 18.5].forEach(function (ry) {
        g.beginPath(); g.moveTo(53, ry); g.lineTo(59, ry); g.stroke();
      });
      g.globalAlpha = .5; g.fillStyle = '#f2e6c0'; g.fillRect(51.5, 20.5, 9, 3); g.globalAlpha = 1;
      // rabats ouverts de part et d'autre
      g.fillStyle = CARDSH;
      g.beginPath(); g.moveTo(41, 23); g.lineTo(34, 13); g.lineTo(46, 14.5); g.lineTo(49, 23); g.closePath(); g.fill();
      g.fillStyle = shade(CARDSH, .15);
      g.beginPath(); g.moveTo(71, 23); g.lineTo(78, 13); g.lineTo(66, 14.5); g.lineTo(63, 23); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(122,90,52,.3)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(41, 23); g.lineTo(34, 13); g.stroke();
      g.beginPath(); g.moveTo(71, 23); g.lineTo(78, 13); g.stroke();
      // ANIM : tête du périscope qui pivote (scrute haut/bas)
      var pa = Math.sin(PH * TAU) * .4;
      g.save(); g.translate(56, 8); g.rotate(pa);
      var hb = g.createLinearGradient(0, -3.1, 0, 3.1);
      hb.addColorStop(0, shade(CARD, .24)); hb.addColorStop(1, shade(CARDSH, -.04));
      g.fillStyle = hb; rr(g, -3.2, -3.1, 14.5, 6.2, 3.1); g.fill();
      g.strokeStyle = 'rgba(122,90,52,.35)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(2.4, -3.1); g.lineTo(2.4, 3.1); g.stroke();
      // œilleton : bague sombre + verre + reflet
      g.fillStyle = WOODD; g.beginPath(); g.arc(11.3, 0, 2.8, 0, TAU); g.fill();
      g.fillStyle = '#2c3038'; g.beginPath(); g.arc(11.3, 0, 1.9, 0, TAU); g.fill();
      g.fillStyle = 'rgba(160,210,235,.8)'; g.beginPath(); g.arc(11.6, -.3, 1.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(11, -.8, .5, 0, TAU); g.fill();
      g.restore();
    }
  });

  /* ============================================================
     4) t4-phare — phare de guet : fût conique à deux bandes
        héraldiques, hublot, porte en arche, galerie de bois et
        chambre vitrée où trône une pelote de laine lumineuse.
        Anim : la pelote-lampe palpite (halo + faisceaux doux).
     ============================================================ */
  reg('defense_cats', {
    id: 't4-phare', label: 'Phare à pelote', anim: 'la pelote-lampe palpite doucement',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2, P = PAL.cats;
      var pu = Math.sin(PH * TAU); // pulsation du phare
      softShadow(g, 56, 88, 34, 10, 0.24);
      // rochers d'assise + herbe
      g.fillStyle = '#b2a794'; g.beginPath(); g.ellipse(42, 84.8, 5.5, 3, .2, 0, TAU); g.fill();
      g.fillStyle = '#a89d8a'; g.beginPath(); g.ellipse(69, 85.1, 5, 2.7, -.2, 0, TAU); g.fill();
      g.fillStyle = '#beb3a0'; g.beginPath(); g.ellipse(55, 85.7, 4.4, 2.2, .1, 0, TAU); g.fill();
      herbe(g, 34, 85.5, 5, 1); herbe(g, 79, 85, 5, -1);
      // FAISCEAUX doux de part et d'autre de la lampe (pulsent)
      var ba = .1 + pu * .05;
      var lb = g.createLinearGradient(50, 0, 6, 0);
      lb.addColorStop(0, 'rgba(255,214,110,' + ba.toFixed(3) + ')'); lb.addColorStop(1, 'rgba(255,214,110,0)');
      g.fillStyle = lb;
      g.beginPath(); g.moveTo(50, 20); g.lineTo(6, 13); g.lineTo(6, 30); g.lineTo(50, 27); g.closePath(); g.fill();
      var rb = g.createLinearGradient(62, 0, 106, 0);
      rb.addColorStop(0, 'rgba(255,214,110,' + ba.toFixed(3) + ')'); rb.addColorStop(1, 'rgba(255,214,110,0)');
      g.fillStyle = rb;
      g.beginPath(); g.moveTo(62, 20); g.lineTo(106, 13); g.lineTo(106, 30); g.lineTo(62, 27); g.closePath(); g.fill();
      // FÛT conique (chemin réutilisé pour le clip des bandes)
      function fut() {
        g.beginPath();
        g.moveTo(41, 85); g.lineTo(47, 34); g.lineTo(65, 34); g.lineTo(71, 85);
        g.quadraticCurveTo(56, 88, 41, 85); g.closePath();
      }
      var wg = g.createLinearGradient(41, 0, 71, 0);
      wg.addColorStop(0, shade(P.wall, .18)); wg.addColorStop(.5, P.wall); wg.addColorStop(1, shade(P.wall, -.2));
      g.fillStyle = wg; fut(); g.fill();
      // bandes héraldiques légèrement hélicoïdales + ombre du bord
      g.save(); fut(); g.clip();
      var bg = g.createLinearGradient(0, 44, 0, 55.5);
      bg.addColorStop(0, shade(P.roof, .12)); bg.addColorStop(1, shade(P.roof, -.12));
      g.fillStyle = bg;
      g.beginPath(); g.moveTo(38, 44); g.lineTo(74, 48.5); g.lineTo(74, 55.5); g.lineTo(38, 51); g.closePath(); g.fill();
      var bg2 = g.createLinearGradient(0, 64, 0, 75.5);
      bg2.addColorStop(0, shade(P.roof, .12)); bg2.addColorStop(1, shade(P.roof, -.12));
      g.fillStyle = bg2;
      g.beginPath(); g.moveTo(38, 64); g.lineTo(74, 68.5); g.lineTo(74, 75.5); g.lineTo(38, 71); g.closePath(); g.fill();
      var edge = g.createLinearGradient(59, 0, 71, 0);
      edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(70,40,20,.16)');
      g.fillStyle = edge; g.fillRect(59, 34, 12, 52);
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(48.5, 36); g.lineTo(44, 83); g.stroke();
      g.restore();
      // hublot rond cerclé de bois
      g.fillStyle = LWOOD; g.beginPath(); g.arc(56, 60, 4.4, 0, TAU); g.fill();
      var hgd = g.createRadialGradient(54.8, 58.8, .5, 56, 60, 3.2);
      hgd.addColorStop(0, '#cfe6f2'); hgd.addColorStop(1, '#7fb0cc');
      g.fillStyle = hgd; g.beginPath(); g.arc(56, 60, 3.2, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,58,30,.5)'; g.lineWidth = .9;
      g.beginPath(); g.arc(56, 60, 4.4, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(54.6, 58.6, 1, 0, TAU); g.fill();
      // porte en arche + poignée dorée + linteau
      g.fillStyle = P.door;
      g.beginPath(); g.moveTo(51, 84.8); g.lineTo(51, 77); g.arc(56, 77, 5, Math.PI, 0); g.lineTo(61, 84.8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(53, 83.5); g.lineTo(53, 77); g.stroke();
      g.fillStyle = '#f4c542'; g.beginPath(); g.arc(58.6, 79.5, 1, 0, TAU); g.fill();
      g.fillStyle = shade(LWOOD, -.1); rr(g, 49.5, 70.6, 13, 2.4, 1.2); g.fill();
      // galerie : corniche débordante à double épaisseur
      var gal = g.createLinearGradient(0, 29.5, 0, 34);
      gal.addColorStop(0, shade(WOOD, .2)); gal.addColorStop(1, shade(WOOD, -.22));
      g.fillStyle = gal; rr(g, 42, 29.5, 28, 4.5, 2); g.fill();
      g.fillStyle = shade(WOOD, -.3); rr(g, 44, 33.4, 24, 1.6, .8); g.fill();
      // montants de la chambre de la lampe
      g.fillStyle = WOODD; rr(g, 46.4, 17, 2.2, 13, 1); g.fill(); rr(g, 63.4, 17, 2.2, 13, 1); g.fill();
      // ANIM : halo qui palpite derrière la vitre
      var halR = 11 + pu * 2.2, halA = .34 + pu * .12;
      var hal = g.createRadialGradient(56, 23.5, 1, 56, 23.5, halR);
      hal.addColorStop(0, 'rgba(255,224,130,' + halA.toFixed(3) + ')');
      hal.addColorStop(1, 'rgba(255,224,130,0)');
      g.fillStyle = hal; g.beginPath(); g.arc(56, 23.5, halR, 0, TAU); g.fill();
      // la pelote-lampe
      pelote(g, 56, 24, 6, P.flag);
      // vitre : voile + reflet diagonal + croisillon
      g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, 47.5, 17.5, 17, 12, 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(50, 27.5); g.lineTo(58, 19); g.stroke();
      g.fillStyle = 'rgba(84,64,42,.65)'; rr(g, 55.3, 17.2, 1.4, 12.6, .7); g.fill();
      // toit conique + gouttière + pommeau doré
      g.fillStyle = shade(P.roof, -.2); rr(g, 43.5, 15.8, 25, 2.4, 1.2); g.fill();
      var rgd = g.createLinearGradient(0, 7.5, 0, 16);
      rgd.addColorStop(0, shade(P.roof, .2)); rgd.addColorStop(1, shade(P.roof, -.08));
      g.fillStyle = rgd;
      g.beginPath(); g.moveTo(44, 16); g.lineTo(56, 7); g.lineTo(68, 16); g.closePath(); g.fill();
      g.strokeStyle = P.roofSh; g.lineWidth = 1; g.globalAlpha = .5;
      g.beginPath(); g.moveTo(44, 16); g.lineTo(56, 7); g.lineTo(68, 16); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#f4c542'; g.beginPath(); g.arc(56, 6.2, 1.7, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(55.5, 5.7, .55, 0, TAU); g.fill();
    }
  });

  /* ============================================================
     5) t4-catapulte — tourelle en carton renforcé, créneaux,
        plateforme pivotante et catapulte à cuillère chargée d'une
        pelote ; réserve de munitions moelleuses au pied.
        Anim : une pelote décrit une cloche dans le ciel, fil de
        laine à la traîne (fondu complet aux deux extrémités).
     ============================================================ */
  reg('defense_cats', {
    id: 't4-catapulte', label: 'Catapulte à pelotes', anim: 'une pelote vole en cloche',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2, P = PAL.cats;
      softShadow(g, 56, 88, 34, 10, 0.24);
      herbe(g, 30, 87, 5.5, 1); herbe(g, 96, 84.5, 5, -1.2);
      // réserve de munitions : trois pelotes empilées
      pelote(g, 82, 83.5, 3.6, P.flag);
      pelote(g, 89, 84.2, 3.3, mix(P.flag, '#ffffff', .25));
      pelote(g, 85.5, 78.6, 3.2, P.accent);
      // TOURELLE en carton renforcé
      var tg = g.createLinearGradient(38, 0, 74, 0);
      tg.addColorStop(0, shade(CARD, .16)); tg.addColorStop(.55, CARD); tg.addColorStop(1, shade(CARD, -.2));
      g.fillStyle = tg; rr(g, 38, 52, 36, 34, 4); g.fill();
      // cannelures verticales du carton
      g.fillStyle = 'rgba(122,90,52,.16)';
      for (var x = 42; x < 71; x += 6) g.fillRect(x, 54, 2, 30);
      // scotch de renfort en biais sur l'angle
      g.globalAlpha = .45; g.fillStyle = '#f2e6c0';
      g.save(); g.translate(42.5, 57.5); g.rotate(.6); g.fillRect(-8, -2.4, 16, 4.8); g.restore();
      g.globalAlpha = 1;
      // porte en arche sombre + tampon patte
      g.fillStyle = 'rgba(50,32,14,.8)';
      g.beginPath(); g.moveTo(51, 85.4); g.lineTo(51, 78); g.arc(56, 78, 5, Math.PI, 0); g.lineTo(61, 85.4); g.closePath(); g.fill();
      pawPrint(g, 67.5, 61, 2.5, 'rgba(201,102,42,.5)');
      // plateforme pivotante (disque de bois)
      var pf = g.createLinearGradient(0, 43.5, 0, 51.5);
      pf.addColorStop(0, shade(WOOD, .22)); pf.addColorStop(1, shade(WOOD, -.2));
      g.fillStyle = pf; g.beginPath(); g.ellipse(56, 47.5, 16.5, 4.2, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,42,20,.4)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(56, 47.5, 12.5, 3, 0, .3, Math.PI - .3); g.stroke();
      // CATAPULTE — bâti en A, axe, torsion de corde
      twig(g, 48, 46.5, 54.2, 32.5, 3, WOODM);
      twig(g, 63, 46.5, 56.8, 32.5, 3, WOODM);
      twig(g, 47.5, 40.5, 63.5, 40.5, 2.2, WOODD);
      // bras : contrepoids en bas, cuillère chargée en haut
      g.strokeStyle = WOODD; g.lineWidth = 4.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(47.5, 43.5); g.lineTo(66, 18.5); g.stroke();
      g.strokeStyle = LWOOD; g.lineWidth = 2.8;
      g.beginPath(); g.moveTo(47.9, 43.1); g.lineTo(65.7, 18.9); g.stroke();
      // axe + enroulement de corde de tension
      g.fillStyle = WOODD; g.beginPath(); g.arc(55.5, 32.5, 2.3, 0, TAU); g.fill();
      g.strokeStyle = '#c9b26a'; g.lineWidth = 1;
      g.beginPath(); g.arc(55.5, 32.5, 3, .6, 2.4); g.stroke();
      g.beginPath(); g.arc(55.5, 32.5, 3.6, 3.6, 5.4); g.stroke();
      // petit sac de contrepoids noué
      g.fillStyle = '#8a8062'; g.beginPath(); g.ellipse(47.2, 45.8, 2.9, 3.4, .15, 0, TAU); g.fill();
      g.strokeStyle = '#6e6650'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(45.4, 43.6); g.lineTo(49.2, 43.2); g.stroke();
      // cuillère + pelote chargée (prête à partir)
      g.save(); g.translate(66.5, 17.5); g.rotate(-.5);
      g.fillStyle = shade(LWOOD, -.12);
      g.beginPath(); g.arc(0, 0, 4.2, 0, Math.PI); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(60,42,20,.45)'; g.lineWidth = .9;
      g.beginPath(); g.arc(0, 0, 4.2, 0, Math.PI); g.closePath(); g.stroke();
      g.restore();
      pelote(g, 67, 14.6, 3, P.accent);
      // CRÉNEAUX en avant-plan (la catapulte est derrière)
      for (var m = 0; m < 4; m++) {
        var mx = 38 + m * 9.87;
        var mg = g.createLinearGradient(0, 45.5, 0, 52.5);
        mg.addColorStop(0, shade(CARD, m % 2 ? .18 : .08)); mg.addColorStop(1, shade(CARDSH, -.05));
        g.fillStyle = mg; rr(g, mx, 45.5, 6.4, 7.5, 1.6); g.fill();
      }
      g.fillStyle = 'rgba(40,26,10,.14)'; g.fillRect(38, 52.2, 36, 1.6);
      // fanion de tourelle
      twig(g, 71.5, 45.5, 71.5, 36, 1.6, '#6e5a40');
      g.fillStyle = P.flag;
      g.beginPath(); g.moveTo(72.3, 36.6); g.lineTo(79, 38.8); g.lineTo(72.3, 41.4); g.closePath(); g.fill();
      // ANIM : pelote en cloche + fil de laine à la traîne
      var u = PH, al = .5 - .5 * Math.cos(PH * TAU);
      var fx = 66 + u * 38, fy = 16 - 46 * u * (1 - u) + u * 6;
      if (al > .003) {
        g.strokeStyle = P.flag; g.globalAlpha = al * .4; g.lineWidth = 1;
        g.beginPath(); g.moveTo(67, 16.5);
        g.quadraticCurveTo((67 + fx) / 2, fy + 9, fx, fy); g.stroke();
        g.globalAlpha = al * .95;
        g.save(); g.translate(fx, fy); g.rotate(u * TAU * 2);
        pelote(g, 0, 0, 2.9, P.flag);
        g.restore();
        g.globalAlpha = 1;
      }
    }
  });
})();
