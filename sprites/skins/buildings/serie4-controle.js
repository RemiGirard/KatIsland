"use strict";
/* ============================================================
   LAB — serie4-controle.js (SÉRIE 4)
   Le POINT DE CONTRÔLE (drapeau capturable) : 3 designs déclinés
   chats / oiseaux / neutre (seule la teinte flag/accent change) :
   1) pc4-base-v2   : le drapeau actuel du jeu, fidèlement amélioré
                      ET animé (tissu qui ondule, étoile scintillante).
   2) pc4-girouette : borne-cadran gravée, flèche-girouette qui tourne.
   3) pc4-cairn     : cairn de pierres à guirlandes de fanions flottants.
   Canvas 112×112, sol y≈84-88, boucle d'anim exacte de 3.2 s.
   Self-contained : ne touche qu'à window.LAB_BUILDINGS.
   ============================================================ */
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers locaux (copiés de serie2-casernes.js) ----------
  var TAU = Math.PI * 2;
  function hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function hex(r,g2,b){function q(v){v=Math.max(0,Math.min(255,Math.round(v)));return(v<16?'0':'')+v.toString(16);}return'#'+q(r)+q(g2)+q(b);}
  function shade(c,k){var a=hx(c);return k>=0?hex(a[0]+(255-a[0])*k,a[1]+(255-a[1])*k,a[2]+(255-a[2])*k):hex(a[0]*(1+k),a[1]*(1+k),a[2]*(1+k));}
  function mix(c1,c2,t){var A=hx(c1),B=hx(c2);return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
  function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
  function softShadow(g,x,y,rx,ry,a){var s=g.createRadialGradient(x,y,1,x,y,rx);s.addColorStop(0,'rgba(20,30,15,'+a+')');s.addColorStop(1,'rgba(20,30,15,0)');g.save();g.fillStyle=s;g.translate(x,y);g.scale(1,ry/rx);g.translate(-x,-y);g.beginPath();g.arc(x,y,rx,0,TAU);g.fill();g.restore();}
  function prng(seed){var a=(seed|0)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  // ---------- petits helpers propres à la série ----------
  function twig(g,x0,y0,x1,y1,w,c){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();}
  // brin d'herbe courbé
  function blade(g,x,y,dx,dy,c){g.strokeStyle=c;g.lineWidth=1.3;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+dx*.35,y+dy*.65,x+dx,y+dy);g.stroke();}
  // étoile à n branches
  function star(g,cx,cy,n,rO,rI,rot){g.beginPath();for(var i=0;i<n*2;i++){var r=(i%2===0)?rO:rI;var a=rot+i*Math.PI/n;var px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;if(i===0)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();}
  // pommeau doré bombé (dégradé radial + reflet)
  function goldKnob(g,x,y,r){var p=g.createRadialGradient(x-r*.35,y-r*.4,r*.15,x,y,r*1.05);p.addColorStop(0,'#ffeead');p.addColorStop(.55,'#f4c542');p.addColorStop(1,'#b8862a');g.fillStyle=p;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();g.fillStyle='rgba(255,255,255,.75)';g.beginPath();g.arc(x-r*.35,y-r*.4,r*.28,0,TAU);g.fill();}
  // petit éclat de lumière en croix (alpha pilotée par l'anim)
  function sparkle(g,x,y,r,a){if(a<=0.01)return;g.strokeStyle='rgba(255,248,220,'+a.toFixed(3)+')';g.lineWidth=1.1;g.lineCap='round';g.beginPath();g.moveTo(x-r,y);g.lineTo(x+r,y);g.moveTo(x,y-r);g.lineTo(x,y+r);g.stroke();}

  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  var PAL = {
    cats:   { wall: '#f4ddb8', wallSh: '#d9b98a', roof: '#f08c42', roofSh: '#c9662a', accent: '#e76f51', flag: '#f08c42', door: '#8a5a30' },
    birds:  { wall: '#e6f1f8', wallSh: '#bcd6e6', roof: '#48a9d8', roofSh: '#2f7ea8', accent: '#3a86ff', flag: '#48a9d8', door: '#4a6a80' },
    neutre: { wall: '#d8d5ce', wallSh: '#b2aea6', roof: '#a8a49c', roofSh: '#847f76', accent: '#98948c', flag: '#b0aca4', door: '#6e6a62' }
  };
  var HERBE = 'rgba(106,148,80,.85)', MOUSSE = 'rgba(122,160,90,.6)';

  /* ============================================================
     DESIGN 1 — pc4-base-v2 : le drapeau du jeu, amélioré et ANIMÉ.
     Socle de pierres à dégradés, mât bois veiné (nœud, ligatures),
     pommeau doré à éclat, drapeau échancré dont le tissu ondule
     (sin k=2, phase décalée le long du tissu) et étoile qui
     scintille (sin k=3). À animT=0 : belle vague figée, impeccable.
     ============================================================ */
  function drawDrapeauV2(g, animT, P) {
    var PH = (animT % 3.2) / 3.2;
    g.lineJoin = 'round'; g.lineCap = 'round';
    softShadow(g, 56, 88, 34, 10, 0.24);

    // ---- socle de pierres empilées ----
    var sg = g.createLinearGradient(0, 78, 0, 88);
    sg.addColorStop(0, '#cfc9ba'); sg.addColorStop(1, '#9b9587');
    g.fillStyle = sg;
    g.beginPath(); g.ellipse(56, 83.2, 17, 4.8, 0, 0, TAU); g.fill();
    var sg2 = g.createRadialGradient(52, 78.5, 1, 56, 80.5, 13);
    sg2.addColorStop(0, '#e0dbcc'); sg2.addColorStop(1, '#b4ae9f');
    g.fillStyle = sg2;
    g.beginPath(); g.ellipse(56, 80.3, 12.5, 4.6, 0, 0, TAU); g.fill();
    // pierres rondes calées contre le socle (dégradé + rehaut chacune)
    [[44.5, 83.6, 5, .2], [67.5, 84.2, 4.4, -.15], [56, 85.3, 5.2, .1]].forEach(function (q) {
      var pg = g.createLinearGradient(q[0] - q[2], q[1] - q[2], q[0] + q[2], q[1] + q[2]);
      pg.addColorStop(0, shade('#a9a294', .22)); pg.addColorStop(1, shade('#a9a294', -.2));
      g.fillStyle = pg;
      g.beginPath(); g.ellipse(q[0], q[1], q[2], q[2] * .5, q[3], 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(q[0], q[1] - .7, q[2] * .6, q[2] * .26, q[3], Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    });
    // brins d'herbe au pied
    [[38, 86.5, -3.4, -5.5], [41.5, 87, -1, -6.5], [72.5, 86.5, 2.2, -5.5], [76, 85.8, 3.6, -4.6]].forEach(function (b) {
      blade(g, b[0], b[1], b[2], b[3], HERBE);
    });

    // ---- mât de bois : veines, nœud, ligatures de corde ----
    var mg = g.createLinearGradient(52, 0, 60, 0);
    mg.addColorStop(0, '#8a6a44'); mg.addColorStop(.5, '#6e5434'); mg.addColorStop(1, '#54402a');
    g.fillStyle = mg; rr(g, 53.5, 14, 5, 68, 2.4); g.fill();
    g.strokeStyle = 'rgba(44,30,16,.4)'; g.lineWidth = .9;
    g.beginPath(); g.moveTo(55, 22); g.quadraticCurveTo(54.3, 46, 55.1, 70); g.stroke();
    g.beginPath(); g.moveTo(57.2, 27); g.quadraticCurveTo(57.8, 50, 57.1, 76); g.stroke();
    g.beginPath(); g.ellipse(55.7, 62, .9, 1.5, .2, 0, TAU); g.stroke(); // nœud du bois
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(54.3, 16); g.lineTo(54.3, 79); g.stroke();
    // ligatures de corde aux deux attaches du tissu
    g.strokeStyle = '#c9a86a'; g.lineWidth = 1.5;
    [16.2, 18, 40.6, 42.4].forEach(function (ly) {
      g.beginPath(); g.moveTo(53.1, ly + .4); g.lineTo(59, ly - .4); g.stroke();
    });

    // ---- pommeau doré + éclat qui respire (sin k=1) ----
    goldKnob(g, 56, 11.6, 3.4);
    sparkle(g, 58.6, 9.2, 2.1, (Math.sin(PH * TAU) * .5 + .5) * .85);

    // ---- drapeau échancré, tissu ondulant ----
    // vague : sin k=2, phase décalée le long du tissu, amplitude
    // nulle au mât (t=0) pour une attache parfaitement fixe.
    function wv(t) { return Math.sin(PH * TAU * 2 - t * 2.6) * 2.4 * t; }
    var fg = g.createLinearGradient(0, 13, 0, 42);
    fg.addColorStop(0, shade(P.flag, .2)); fg.addColorStop(1, shade(P.flag, -.22));
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(58.5, 17);
    g.quadraticCurveTo(76, 12.5 + wv(.5), 93, 19 + wv(1));
    g.lineTo(84, 27 + wv(.78));      // échancrure en queue d'hirondelle
    g.lineTo(94, 34 + wv(1));
    g.quadraticCurveTo(77, 42 + wv(.55), 58.5, 40);
    g.closePath(); g.fill();
    g.strokeStyle = shade(P.flag, -.4); g.lineWidth = 1.3;
    g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1;
    // plis mouvants : deux ombres, un rehaut, portés par la même vague
    g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(64, 19.5 + wv(.18)); g.quadraticCurveTo(67.5, 27.5 + wv(.3), 64.5, 37.6 + wv(.2)); g.stroke();
    g.beginPath(); g.moveTo(76.5, 17.4 + wv(.55)); g.quadraticCurveTo(81, 26.5 + wv(.7), 78, 38.2 + wv(.6)); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(70, 18 + wv(.38)); g.quadraticCurveTo(73.5, 26.5 + wv(.5), 70.8, 38 + wv(.4)); g.stroke();
    // ourlet côté mât
    g.strokeStyle = 'rgba(60,44,26,.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(58.5, 17); g.lineTo(58.5, 40); g.stroke();

    // ---- étoile cousue au tissu, scintillement doux (sin k=3) ----
    var tw = Math.sin(PH * TAU * 3);
    g.save(); g.translate(71, 27.6 + wv(.42)); g.scale(1 + .07 * tw, 1 + .07 * tw);
    g.fillStyle = 'rgba(255,255,255,' + (0.78 + 0.18 * tw).toFixed(3) + ')';
    star(g, 0, 0, 5, 5.2, 2.1, -Math.PI / 2); g.fill();
    g.restore();
    // deux poussières d'étoile qui clignotent en décalé
    sparkle(g, 80, 22.5 + wv(.7), 1.6, (Math.sin(PH * TAU * 3 + 2.1) * .5 + .5) * .6);
    sparkle(g, 64.5, 32.5 + wv(.2), 1.3, (Math.sin(PH * TAU * 3 + 4.2) * .5 + .5) * .55);
  }

  /* ============================================================
     DESIGN 2 — pc4-girouette : borne-cadran gravée. Fût de pierre
     adouci sur deux marches, cadran-boussole gravé à losange peint,
     bandeau aux couleurs du camp, et au sommet une flèche-girouette
     qui fait UN tour complet par boucle (rotation simulée par
     aplatissement horizontal : scaleX = cos(PH·TAU), le dos du
     métal est plus sombre — le changement de teinte se produit
     quand la flèche est vue par la tranche, donc invisible).
     ============================================================ */
  function drawGirouette(g, animT, P) {
    var PH = (animT % 3.2) / 3.2;
    g.lineJoin = 'round'; g.lineCap = 'round';
    softShadow(g, 56, 88, 34, 10, 0.24);

    // ---- deux marches de pierre ----
    var s1 = g.createLinearGradient(0, 82, 0, 88);
    s1.addColorStop(0, shade('#b2ada0', .16)); s1.addColorStop(1, shade('#b2ada0', -.2));
    g.fillStyle = s1; rr(g, 36, 82, 40, 6, 2.6); g.fill();
    var s2 = g.createLinearGradient(0, 76.5, 0, 83);
    s2.addColorStop(0, shade('#c0bbae', .18)); s2.addColorStop(1, shade('#c0bbae', -.14));
    g.fillStyle = s2; rr(g, 41, 76.5, 30, 6.5, 2.6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(43, 78); g.lineTo(69, 78); g.stroke();
    // herbe et caillou contre les marches
    blade(g, 34.5, 86, -3, -5.5, HERBE);
    blade(g, 78, 85.5, 3, -5, HERBE);
    blade(g, 74.5, 86.5, 1, -6, MOUSSE.replace('.6', '.8'));
    g.fillStyle = '#a9a294'; g.beginPath(); g.ellipse(33, 86.6, 2.4, 1.3, .2, 0, TAU); g.fill();
    g.fillStyle = MOUSSE; g.beginPath(); g.ellipse(40, 82.2, 3.2, 1.5, .25, 0, TAU); g.fill();

    // ---- fût de pierre adouci ----
    var bg = g.createLinearGradient(44, 0, 68, 0);
    bg.addColorStop(0, shade('#c6c0b2', .2)); bg.addColorStop(.5, '#c6c0b2'); bg.addColorStop(1, shade('#c6c0b2', -.26));
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(45.5, 77);
    g.quadraticCurveTo(43.5, 52, 48, 33.5);
    g.quadraticCurveTo(50, 27.5, 56, 27);
    g.quadraticCurveTo(62, 27.5, 64, 33.5);
    g.quadraticCurveTo(68.5, 52, 66.5, 77);
    g.quadraticCurveTo(56, 79.5, 45.5, 77);
    g.closePath(); g.fill();
    // mouchetis de grain déterministe
    var rn = prng(21); g.fillStyle = 'rgba(60,54,44,.08)';
    for (var i = 0; i < 14; i++) {
      g.beginPath(); g.arc(48 + rn() * 16, 33 + rn() * 40, .8 + rn() * .7, 0, TAU); g.fill();
    }
    // arête de lumière, fissure discrète, petit éclat manquant
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(48, 71); g.quadraticCurveTo(46.4, 50, 49.8, 34.5); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(62.5, 62.5); g.lineTo(60.6, 68); g.lineTo(63.2, 73); g.stroke();
    g.beginPath(); g.moveTo(50, 29.5); g.lineTo(52.5, 31.5); g.stroke();

    // ---- cadran-boussole gravé ----
    g.strokeStyle = 'rgba(60,54,44,.42)'; g.lineWidth = 2;
    g.beginPath(); g.arc(56, 47, 9.6, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.24)'; g.lineWidth = 1;
    g.beginPath(); g.arc(56, 47, 7.2, 0, TAU); g.stroke();
    for (i = 0; i < 8; i++) {  // graduations, cardinales plus marquées
      var a = i * TAU / 8, card = (i % 2 === 0);
      var r0 = card ? 6.4 : 7.8, r1 = card ? 9.3 : 9;
      g.strokeStyle = 'rgba(60,54,44,' + (card ? '.5' : '.32') + ')';
      g.lineWidth = card ? 1.6 : 1;
      g.beginPath();
      g.moveTo(56 + Math.cos(a) * r0, 47 + Math.sin(a) * r0);
      g.lineTo(56 + Math.cos(a) * r1, 47 + Math.sin(a) * r1);
      g.stroke();
    }
    // losange central peint aux couleurs du camp + rivet doré
    g.save(); g.translate(56, 47); g.rotate(Math.PI / 4);
    var dg = g.createLinearGradient(-3, -3, 3, 3);
    dg.addColorStop(0, mix(P.accent, '#ffffff', .38)); dg.addColorStop(1, shade(P.accent, -.18));
    g.fillStyle = dg; rr(g, -2.9, -2.9, 5.8, 5.8, 1.2); g.fill();
    g.strokeStyle = shade(P.accent, -.4); g.lineWidth = 1; g.globalAlpha = .6;
    rr(g, -2.9, -2.9, 5.8, 5.8, 1.2); g.stroke(); g.globalAlpha = 1;
    g.restore();
    g.fillStyle = '#f4c542'; g.beginPath(); g.arc(56, 47, 1.1, 0, TAU); g.fill();

    // ---- bandeau peint (marque du camp) + fanions gravés ----
    var bd = g.createLinearGradient(0, 60.5, 0, 65.4);
    bd.addColorStop(0, mix(P.flag, '#ffffff', .3)); bd.addColorStop(1, shade(P.flag, -.2));
    g.fillStyle = bd; rr(g, 45.4, 60.5, 21.4, 4.9, 2.2); g.fill();
    g.strokeStyle = shade(P.flag, -.42); g.lineWidth = 1; g.globalAlpha = .5;
    rr(g, 45.4, 60.5, 21.4, 4.9, 2.2); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.75)';
    [50, 56, 62].forEach(function (fx) {
      g.beginPath(); g.moveTo(fx - 1.7, 61.4); g.lineTo(fx + 1.7, 61.4); g.lineTo(fx, 64.4); g.closePath(); g.fill();
    });

    // ---- chapiteau + axe ----
    var cp = g.createLinearGradient(0, 23, 0, 28.8);
    cp.addColorStop(0, shade('#a9a294', .2)); cp.addColorStop(1, shade('#a9a294', -.2));
    g.fillStyle = cp; rr(g, 47.5, 23.8, 17, 5, 2.2); g.fill();
    g.fillStyle = shade('#c0bbae', .12); rr(g, 46.3, 22.4, 19.4, 2.8, 1.4); g.fill();
    twig(g, 56, 22.4, 56, 16.8, 2, '#5e584e');

    // ---- flèche-girouette : un tour complet par boucle ----
    var va = PH * TAU;                       // rotation continue
    var sx2 = Math.cos(va);                  // aplatissement = rotation vue de face
    var lift = Math.sin(PH * TAU * 2) * .4;  // léger tressautement dans le vent
    var fc = sx2 < 0 ? shade(P.flag, -.2) : P.flag; // dos du métal plus sombre
    g.save(); g.translate(56, 15 + lift); g.scale(sx2 === 0 ? .0001 : sx2, 1);
    // empennage double
    g.fillStyle = shade(fc, -.08);
    g.beginPath();
    g.moveTo(-12.5, -1); g.lineTo(-21.5, -5.2); g.lineTo(-17.8, 0);
    g.lineTo(-21.5, 5.2); g.lineTo(-12.5, 1);
    g.closePath(); g.fill();
    // hampe + tête de flèche
    g.fillStyle = fc; rr(g, -14, -1.2, 30, 2.4, 1.2); g.fill();
    g.beginPath(); g.moveTo(15.5, -4.4); g.lineTo(23.5, 0); g.lineTo(15.5, 4.4); g.closePath(); g.fill();
    g.strokeStyle = shade(fc, -.42); g.lineWidth = 1; g.globalAlpha = .55;
    g.beginPath(); g.moveTo(15.5, -4.4); g.lineTo(23.5, 0); g.lineTo(15.5, 4.4); g.closePath(); g.stroke();
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = .9;
    g.beginPath(); g.moveTo(-10, -.4); g.lineTo(13, -.4); g.stroke();
    g.restore();
    // rotule dorée par-dessus le joint + éclat
    goldKnob(g, 56, 15 + lift, 2.2);
    sparkle(g, 57.8, 13 + lift, 1.6, (Math.sin(PH * TAU) * .5 + .5) * .7);
  }

  /* ============================================================
     DESIGN 3 — pc4-cairn : cairn de cinq pierres moussues, mât
     central à pommeau doré et deux guirlandes de fanions triangulaires
     tendues vers des piquets. Les cordes respirent (sin k=1) et
     chaque fanion flotte avec sa propre phase (sin k=2). Anneau
     peint aux couleurs du camp sur la pierre du bas.
     ============================================================ */
  function drawCairn(g, animT, P) {
    var PH = (animT % 3.2) / 3.2;
    g.lineJoin = 'round'; g.lineCap = 'round';
    softShadow(g, 56, 88, 34, 10, 0.24);

    // ---- piquets d'ancrage des guirlandes ----
    twig(g, 26.5, 84, 27.5, 66.5, 2.8, '#6e5434');
    twig(g, 86.5, 84, 85.8, 68.5, 2.8, '#6e5434');
    g.fillStyle = '#54402a';
    g.beginPath(); g.arc(27.5, 66.5, 1.3, 0, TAU); g.fill();
    g.beginPath(); g.arc(85.8, 68.5, 1.3, 0, TAU); g.fill();

    // ---- mât central (sa base sera enterrée sous les pierres) ----
    twig(g, 57, 58, 57, 13.5, 4.2, '#6e5434');
    twig(g, 55.9, 56, 55.9, 15, 1.1, '#a8845a'); // arête de lumière du bois
    // flamme du sommet qui claque (sin k=2)
    var swT = Math.sin(PH * TAU * 2) * 1.6;
    g.fillStyle = P.flag;
    g.beginPath();
    g.moveTo(59, 13.2);
    g.quadraticCurveTo(65.5, 13.4 + swT * .4, 70, 15.2 + swT);
    g.lineTo(59, 18);
    g.closePath(); g.fill();
    g.strokeStyle = shade(P.flag, -.38); g.lineWidth = 1; g.globalAlpha = .5;
    g.beginPath();
    g.moveTo(59, 13.2);
    g.quadraticCurveTo(65.5, 13.4 + swT * .4, 70, 15.2 + swT);
    g.lineTo(59, 18);
    g.closePath(); g.stroke();
    g.globalAlpha = 1;

    // ---- guirlandes : cordes qui respirent (sin k=1, phases décalées) ----
    var bobL = Math.sin(PH * TAU) * 1.4;
    var bobR = Math.sin(PH * TAU + 2.4) * 1.4;
    var L0 = [55.2, 16.5], LC = [38, 33 + bobL], L1 = [27.5, 66.5];
    var R0 = [58.8, 16.5], RC = [75, 36 + bobR], R1 = [85.8, 68.5];
    g.strokeStyle = 'rgba(90,64,32,.85)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(L0[0], L0[1]); g.quadraticCurveTo(LC[0], LC[1], L1[0], L1[1]); g.stroke();
    g.beginPath(); g.moveTo(R0[0], R0[1]); g.quadraticCurveTo(RC[0], RC[1], R1[0], R1[1]); g.stroke();

    // point sur la courbe de Bézier quadratique
    function qp(p0, c, p1, t) {
      var u = 1 - t;
      return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
              u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
    }
    // fanion triangulaire suspendu, pointe qui flotte
    function fanion(x, y, sw, col) {
      var pgd = g.createLinearGradient(0, y, 0, y + 8);
      pgd.addColorStop(0, mix(col, '#ffffff', .28)); pgd.addColorStop(1, shade(col, -.16));
      g.fillStyle = pgd;
      g.beginPath(); g.moveTo(x - 3.1, y + .3); g.lineTo(x + 3.1, y - .3); g.lineTo(x + sw, y + 7.4); g.closePath(); g.fill();
      g.strokeStyle = shade(col, -.42); g.lineWidth = .9; g.globalAlpha = .45;
      g.beginPath(); g.moveTo(x - 3.1, y + .3); g.lineTo(x + 3.1, y - .3); g.lineTo(x + sw, y + 7.4); g.closePath(); g.stroke();
      g.globalAlpha = 1;
    }
    var cols = [P.flag, mix(P.flag, '#ffffff', .5)];
    var ts = [.2, .42, .64, .84];
    for (var i = 0; i < 4; i++) {
      var pl = qp(L0, LC, L1, ts[i]);
      fanion(pl[0], pl[1], Math.sin(PH * TAU * 2 + i * 1.15) * 1.9, cols[i % 2]);
      var pr = qp(R0, RC, R1, ts[i]);
      fanion(pr[0], pr[1], Math.sin(PH * TAU * 2 + i * 1.15 + 1.7) * 1.9, cols[(i + 1) % 2]);
    }

    // ---- les cinq pierres du cairn (dégradé + rehaut chacune) ----
    function stone(cx, cy, rx, ry, rot, base) {
      var sgd = g.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      sgd.addColorStop(0, shade(base, .22)); sgd.addColorStop(.55, base); sgd.addColorStop(1, shade(base, -.24));
      g.fillStyle = sgd;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.24)'; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(cx, cy - ry * .28, rx * .58, ry * .4, rot, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    }
    stone(56, 79, 20.5, 8, 0, '#b3ac9d');
    stone(45.5, 69.5, 11, 6.6, .12, '#c0b9a9');
    stone(66.5, 70.5, 10.2, 6.2, -.1, '#a9a294');
    stone(56, 61, 11.5, 6.4, .06, '#bcb5a5');
    stone(56.5, 53, 7, 4.6, -.08, '#cac3b2');
    // mouchetis de grain sur chaque pierre (déterministe)
    var rn = prng(31); g.fillStyle = 'rgba(60,54,44,.09)';
    [[56, 79, 20.5, 8], [45.5, 69.5, 11, 6.6], [66.5, 70.5, 10.2, 6.2], [56, 61, 11.5, 6.4], [56.5, 53, 7, 4.6]].forEach(function (s) {
      for (var k = 0; k < 3; k++) {
        var ang = rn() * TAU, rad = rn() * .55;
        g.beginPath();
        g.arc(s[0] + Math.cos(ang) * s[2] * rad, s[1] + Math.sin(ang) * s[3] * rad, .7 + rn() * .6, 0, TAU);
        g.fill();
      }
    });
    // fissures + mousse
    g.strokeStyle = 'rgba(0,0,0,.13)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(48, 77); g.lineTo(46, 80.5); g.lineTo(48.5, 83); g.stroke();
    g.beginPath(); g.moveTo(60.5, 58.5); g.lineTo(62.5, 61.5); g.stroke();
    g.fillStyle = MOUSSE;
    g.beginPath(); g.ellipse(43, 74.8, 4.2, 2, .3, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(63.5, 56.8, 3, 1.5, -.2, 0, TAU); g.fill();

    // ---- anneau peint : la marque du territoire ----
    g.strokeStyle = P.accent; g.lineWidth = 2.2; g.globalAlpha = .9;
    g.beginPath(); g.ellipse(56, 78.6, 4.9, 3.5, 0, 0, TAU); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = P.accent; g.beginPath(); g.arc(56, 78.6, 1.3, 0, TAU); g.fill();

    // ---- herbe, caillou, petite fleur ----
    [[33, 86.5, -3, -5], [39, 87.2, -1.5, -6], [73, 86.8, 2, -5.5], [76.5, 86, 3.2, -4.6]].forEach(function (b) {
      blade(g, b[0], b[1], b[2], b[3], HERBE);
    });
    g.fillStyle = '#a9a294'; g.beginPath(); g.ellipse(36.5, 86.6, 2.4, 1.2, .2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(106,148,80,.9)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(79.5, 86); g.quadraticCurveTo(79.2, 83.5, 80, 81.6); g.stroke();
    g.fillStyle = '#f6f1e6';
    [[-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4]].forEach(function (p) {
      g.beginPath(); g.arc(80 + p[0], 80.6 + p[1], 1.05, 0, TAU); g.fill();
    });
    g.fillStyle = '#f4c542'; g.beginPath(); g.arc(80, 80.6, .95, 0, TAU); g.fill();

    // ---- pommeau doré du mât + éclat décalé ----
    goldKnob(g, 57, 11.8, 2.5);
    sparkle(g, 59, 9.6, 1.7, (Math.sin(PH * TAU + 3.1) * .5 + .5) * .75);
  }

  /* ============================================================
     ENREGISTREMENT : 3 designs × 3 camps = 9 variantes.
     Même id pour un design dans les trois slots ; seule la palette
     (flag/accent) change, la structure est strictement identique.
     ============================================================ */
  [['controle_cats', 'cats'], ['controle_birds', 'birds'], ['controle_neutre', 'neutre']].forEach(function (q) {
    var P = PAL[q[1]];
    reg(q[0], {
      id: 'pc4-base-v2', label: 'Drapeau v2 (base animée)',
      anim: "le tissu ondule, l'étoile scintille",
      draw: function (g, animT) { drawDrapeauV2(g, animT, P); }
    });
    reg(q[0], {
      id: 'pc4-girouette', label: 'Borne-girouette',
      anim: 'la flèche-girouette fait un tour complet',
      draw: function (g, animT) { drawGirouette(g, animT, P); }
    });
    reg(q[0], {
      id: 'pc4-cairn', label: 'Cairn à fanions',
      anim: 'les guirlandes de fanions flottent au vent',
      draw: function (g, animT) { drawCairn(g, animT, P); }
    });
  });
})();
