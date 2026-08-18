"use strict";
/* ============================================================
   LAB — serie4-caserne-chats.js (SÉRIE 4)
   5 variantes pour le slot 'production_cats' (caserne des chats) :
   1) c4-base-v2      : la caserne actuelle (panier douillet fortifié)
                        embellie + queue de chat animée.
   2) c4-entrainement : camp d'entraînement, mannequin-oiseau griffoir.
   3) c4-dojo         : tente-dojo à coussins, lampion qui se balance.
   4) c4-roulotte     : roulotte-cantine à croquettes, cheminée fumante.
   5) c4-pension      : pension à paniers superposés, des z s'envolent.
   Canvas 112×112, sol y≈84-88, boucle d'anim exacte de 3.2 s.
   Self-contained : ne touche qu'à window.LAB_BUILDINGS.
   ============================================================ */
window.LAB_BUILDINGS = window.LAB_BUILDINGS || { variants: {}, chosen: {} };
(function () {
  // ---------- helpers locaux (copiés de la série 2) ----------
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
  function prng(seed){var a=(seed|0)||1;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  function reg(slot, v) {
    var R = window.LAB_BUILDINGS.variants;
    (R[slot] = R[slot] || []).push(v);
  }

  var P = { wall: '#f4ddb8', wallSh: '#d9b98a', roof: '#f08c42', roofSh: '#c9662a', accent: '#e76f51', flag: '#f08c42', door: '#8a5a30' };
  var WOOD = '#8a6a44', WOODM = '#6e5434', WOODD = '#54402a', LWOOD = '#c9a86a';
  var OSIER = '#c89a5c', STRAW = '#e8c96a', KIB = '#9a6a3a', HERBE = 'rgba(122,160,90,.7)';

  // touffe d'herbe (3 brins) au pied des bâtiments
  function herbe(g, x, y, s) {
    taperedStroke(g, [[x, y], [x - 2 * s, y - 4.5 * s]], 1.4, .4, HERBE);
    taperedStroke(g, [[x + 1.5 * s, y], [x + 1.5 * s, y - 5.5 * s]], 1.4, .4, HERBE);
    taperedStroke(g, [[x + 3 * s, y], [x + 5 * s, y - 4 * s]], 1.4, .4, HERBE);
  }

  /* ============================================================
     1) CASERNE V2 — le panier douillet fortifié du jeu, embelli :
        osier deux tons, ombre interne sous le rebord, coutures du
        coussin, piquets à nœuds et pointes, pelote plus vivante,
        herbe au pied. Anim : une queue de chat déborde du coussin
        et bat doucement la mesure.
     ============================================================ */
  reg('production_cats', {
    id: 'c4-base-v2', label: 'Caserne v2 (base animée)', anim: 'la queue du chat bat la mesure',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);
      // herbe derrière le panier
      herbe(g, 27, 86, 1); herbe(g, 80, 86.5, .9);
      // corps du panier : osier en dégradé trois tons
      var bg2 = g.createLinearGradient(0, 52, 0, 88);
      bg2.addColorStop(0, shade(OSIER, .18));
      bg2.addColorStop(.45, OSIER);
      bg2.addColorStop(1, shade(OSIER, -.26));
      g.fillStyle = bg2;
      g.beginPath(); g.ellipse(56, 70, 26, 17, 0, 0, TAU); g.fill();
      // rehaut doux côté lumière
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.beginPath(); g.ellipse(46, 66, 10, 8, .3, 0, TAU); g.fill();
      // tressage deux tons (arcs sombres + reflets clairs décalés)
      for (var yy = 63; yy <= 77; yy += 7) {
        for (var x = 34; x < 78; x += 8) {
          g.strokeStyle = 'rgba(90,60,26,.38)'; g.lineWidth = 1.4;
          g.beginPath(); g.arc(x + 4, yy, 4.4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
          g.beginPath(); g.arc(x + 4, yy + 1.2, 4.4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        }
      }
      // ombre interne : le creux entre rebord et coussin
      g.fillStyle = 'rgba(60,38,14,.30)';
      g.beginPath(); g.ellipse(56, 58.5, 23.5, 6.5, 0, 0, TAU); g.fill();
      // coussin capitonné qui déborde
      var cg = g.createLinearGradient(0, 46, 0, 60);
      cg.addColorStop(0, mix(P.accent, '#ffffff', .55)); cg.addColorStop(1, P.accent);
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(56, 54, 21, 7.5, 0, 0, TAU); g.fill();
      g.strokeStyle = shade(P.accent, -.3); g.lineWidth = 1; g.globalAlpha = .5;
      g.beginPath(); g.ellipse(56, 54, 21, 7.5, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
      // coutures en pointillé + boutons
      g.save(); g.setLineDash([2, 3]);
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(56, 53.4, 17, 5.2, 0, 0, TAU); g.stroke();
      g.restore();
      g.fillStyle = shade(P.accent, -.25);
      [46, 56, 66].forEach(function (bx) { g.beginPath(); g.arc(bx, 54, 1.2, 0, TAU); g.fill(); });
      // ANIM : queue rousse qui déborde à droite et bat la mesure
      var s = Math.sin(PH * TAU) * 2.4;
      taperedStroke(g, [[70.5, 50.5], [76 + s * .5, 57], [78 + s, 64.5]], 4.6, 2.6, '#b9825a');
      g.strokeStyle = 'rgba(122,74,40,.55)'; g.lineWidth = 1.2; // anneau du pelage
      g.beginPath(); g.moveTo(74.4 + s * .5, 56); g.lineTo(77.6 + s * .5, 58.1); g.stroke();
      g.fillStyle = '#f6f1e6'; g.beginPath(); g.arc(78 + s, 65.2, 2.2, 0, TAU); g.fill();
      // rebord d'osier épais + reflet
      g.strokeStyle = '#9a7038'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(56, 56, 25, 8, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(56, 55.4, 24, 7.3, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
      // pelote de laine + brin qui traîne (comme dans le jeu)
      g.fillStyle = P.flag; g.beginPath(); g.arc(24, 81.4, 6.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.ellipse(22, 79, 2.8, 1.8, .5, 0, TAU); g.fill();
      g.strokeStyle = shade(P.flag, -.35); g.lineWidth = 1.1;
      g.beginPath(); g.arc(24, 81.4, 4.4, .6, 2.8); g.stroke();
      g.beginPath(); g.arc(24, 81.4, 2.4, 3.4, 5.6); g.stroke();
      g.beginPath(); g.moveTo(30, 84); g.quadraticCurveTo(38, 87, 44, 84); g.stroke();
      g.beginPath(); g.moveTo(44, 84); g.quadraticCurveTo(48, 82.5, 47, 85.5); g.stroke();
      // piquets fortifiés : pointes, nœuds du bois, ligatures
      [[32, 62, 27, 46], [80, 62, 85, 46]].forEach(function (q, qi) {
        twig(g, q[0], q[1], q[2], q[3], 3.2, WOOD);
        // pointe taillée (facette claire)
        g.fillStyle = shade(WOOD, .3);
        g.beginPath(); g.arc(q[2], q[3], 1.5, 0, TAU); g.fill();
        // nœud du bois
        g.strokeStyle = 'rgba(70,46,20,.55)'; g.lineWidth = 1;
        g.beginPath(); g.arc((q[0] + q[2]) / 2, (q[1] + q[3]) / 2 + 1, 1.1, 0, TAU); g.stroke();
        // ligature de corde vers le rebord
        g.strokeStyle = STRAW; g.lineWidth = 1.4;
        var lx = qi === 0 ? 31 : 81;
        g.beginPath(); g.moveTo(lx - 2.6, 58.5); g.lineTo(lx + 2.6, 57); g.stroke();
        g.beginPath(); g.moveTo(lx - 2.6, 60.5); g.lineTo(lx + 2.6, 59); g.stroke();
      });
    }
  });

  /* ============================================================
     2) CAMP D'ENTRAÎNEMENT — tapis de sable, râtelier à jouets,
        et le clou du spectacle : un mannequin-oiseau griffoir en
        toile de jute, tout juste giflé. Anim : il oscille encore.
     ============================================================ */
  reg('production_cats', {
    id: 'c4-entrainement', label: "Camp d'entraînement", anim: 'le mannequin-oiseau oscille',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);
      // tapis d'entraînement en sable tassé
      var sg = g.createLinearGradient(0, 77, 0, 88);
      sg.addColorStop(0, shade('#e2cfa0', .1)); sg.addColorStop(1, shade('#e2cfa0', -.16));
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(58, 82.4, 30, 5.6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(150,118,66,.4)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(58, 82.4, 30, 5.6, 0, 0, TAU); g.stroke();
      // empreintes de l'élève assidu
      pawPrint(g, 47, 81.5, 1.6, 'rgba(122,90,52,.4)');
      pawPrint(g, 55, 83.6, 1.6, 'rgba(122,90,52,.32)');
      pawPrint(g, 63, 81.8, 1.6, 'rgba(122,90,52,.4)');
      // râtelier à jouets (gauche)
      twig(g, 24, 85, 24, 48, 3, WOODM);
      twig(g, 44, 85, 44, 48, 3, WOODM);
      twig(g, 21.5, 49, 46.5, 49, 2.6, WOODD);
      // étagère basse + pelote de réserve
      var pgd = g.createLinearGradient(0, 75.5, 0, 79.5);
      pgd.addColorStop(0, shade(LWOOD, .2)); pgd.addColorStop(1, shade(LWOOD, -.18));
      g.fillStyle = pgd; rr(g, 21.5, 75.5, 25, 3.6, 1.6); g.fill();
      g.fillStyle = P.accent; g.beginPath(); g.arc(28, 73, 3, 0, TAU); g.fill();
      g.strokeStyle = shade(P.accent, -.35); g.lineWidth = .9;
      g.beginPath(); g.arc(28, 73, 1.8, .8, 3.4); g.stroke();
      // jouets suspendus : plumeau et baballe
      g.strokeStyle = 'rgba(90,64,32,.8)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(30, 49); g.lineTo(30, 56); g.stroke();
      featherMark(g, 30, 60, 4, '#7aa0b8');
      g.beginPath(); g.moveTo(38.5, 49); g.lineTo(38.5, 54); g.stroke();
      var bgd = g.createRadialGradient(37.5, 56, .6, 38.5, 57, 3.4);
      bgd.addColorStop(0, mix(P.flag, '#ffffff', .5)); bgd.addColorStop(1, shade(P.flag, -.15));
      g.fillStyle = bgd; g.beginPath(); g.arc(38.5, 57, 3.1, 0, TAU); g.fill();
      // socle du mannequin
      var scd = g.createLinearGradient(0, 79.5, 0, 86);
      scd.addColorStop(0, shade(WOODD, .18)); scd.addColorStop(1, shade(WOODD, -.15));
      g.fillStyle = scd; rr(g, 58, 79.5, 23, 6, 2.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, 60, 80.6, 19, 1.4, .7); g.fill();
      // poteau griffoir en sisal
      var pg = g.createLinearGradient(65, 0, 74, 0);
      pg.addColorStop(0, shade(LWOOD, .22)); pg.addColorStop(.5, LWOOD); pg.addColorStop(1, shade(LWOOD, -.3));
      g.fillStyle = pg; rr(g, 65.5, 42, 8, 39, 3.5); g.fill();
      g.strokeStyle = 'rgba(110,80,40,.5)'; g.lineWidth = 1.3;
      for (var y = 46; y < 79; y += 4) {
        g.beginPath(); g.moveTo(66, y); g.lineTo(73.2, y - 2.2); g.stroke();
      }
      // griffures fraîches de la séance du matin
      g.strokeStyle = 'rgba(70,46,20,.6)'; g.lineWidth = 1.1;
      for (var d = -2.2; d <= 2.2; d += 2.2) {
        g.beginPath(); g.moveTo(68.3 + d, 58); g.lineTo(70 + d, 70); g.stroke();
      }
      // ANIM : le mannequin-oiseau oscille sur son pivot
      var rot = Math.sin(PH * TAU * 2) * .07;
      g.save(); g.translate(69.5, 43.5); g.rotate(rot);
      // cou de jute
      g.fillStyle = shade('#cfb68c', -.2); rr(g, -2.2, -5, 4.4, 5.6, 1.6); g.fill();
      // tête bourrée de paille
      var hgd = g.createRadialGradient(-2.5, -13.5, 1, 0, -11.5, 9);
      hgd.addColorStop(0, shade('#cfb68c', .18)); hgd.addColorStop(1, shade('#cfb68c', -.15));
      g.fillStyle = hgd; g.beginPath(); g.arc(0, -11.5, 8, 0, TAU); g.fill();
      // couture en croix + pièce rapportée
      g.strokeStyle = 'rgba(90,64,32,.65)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-4.6, -14.6); g.lineTo(-1.6, -11.6); g.stroke();
      g.beginPath(); g.moveTo(-1.6, -14.6); g.lineTo(-4.6, -11.6); g.stroke();
      g.fillStyle = mix('#cfb68c', '#ffffff', .18); rr(g, -7, -9.5, 4.6, 3.8, 1.2); g.fill();
      g.save(); g.setLineDash([1.6, 1.6]);
      g.strokeStyle = 'rgba(90,64,32,.5)'; g.lineWidth = .8; rr(g, -6.5, -9, 3.6, 2.8, .8); g.stroke();
      g.restore();
      // œil bouton cousu
      g.fillStyle = '#5a4632'; g.beginPath(); g.arc(2.8, -13, 1.5, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(244,241,230,.7)'; g.lineWidth = .6;
      g.beginPath(); g.moveTo(2.1, -13); g.lineTo(3.5, -13); g.stroke();
      g.beginPath(); g.moveTo(2.8, -13.7); g.lineTo(2.8, -12.3); g.stroke();
      // bec en feutre
      g.fillStyle = '#f4a53c';
      g.beginPath(); g.moveTo(7.2, -13); g.lineTo(12.6, -11.2); g.lineTo(7.2, -9.4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,90,20,.5)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(7.2, -11.2); g.lineTo(11, -11.2); g.stroke();
      // plumes d'appoint sur le crâne
      taperedStroke(g, [[-1.5, -18.6], [-3.6, -23.6]], 2, .7, '#7aa0b8');
      taperedStroke(g, [[1.8, -18.8], [3, -24]], 2, .7, '#9fc3d8');
      g.restore();
      // fanion de motivation (droite)
      twig(g, 89, 84, 89, 60, 2, '#6e5a40');
      g.fillStyle = P.flag;
      g.beginPath(); g.moveTo(90, 61); g.lineTo(100, 64); g.lineTo(90, 67.5); g.closePath(); g.fill();
      // herbe autour du tapis
      herbe(g, 15, 86.5, .9); herbe(g, 96, 85.5, .8);
    }
  });

  /* ============================================================
     3) TENTE-DOJO — toile crème à bandes corail, perches croisées,
        coussins de méditation devant l'entrée, cordages, écusson
        patte. Anim : le lampion de la perche se balance.
     ============================================================ */
  reg('production_cats', {
    id: 'c4-dojo', label: 'Tente-dojo', anim: 'le lampion se balance',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);
      // plateforme de planches
      var pfd = g.createLinearGradient(0, 81.5, 0, 87.5);
      pfd.addColorStop(0, shade(LWOOD, .16)); pfd.addColorStop(1, shade(LWOOD, -.22));
      g.fillStyle = pfd; rr(g, 28, 81.5, 56, 6, 2.5); g.fill();
      g.strokeStyle = 'rgba(90,60,26,.32)'; g.lineWidth = 1;
      [40, 52, 64, 76].forEach(function (px) {
        g.beginPath(); g.moveTo(px, 82.5); g.lineTo(px, 86.5); g.stroke();
      });
      g.strokeStyle = 'rgba(60,42,20,.35)'; g.lineWidth = .9;
      g.beginPath(); g.arc(34, 84.5, 1.2, 0, TAU); g.stroke(); // nœud du bois
      // cordages vers les piquets
      g.strokeStyle = 'rgba(122,90,52,.6)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(31, 64); g.quadraticCurveTo(24, 72, 20, 80); g.stroke();
      g.beginPath(); g.moveTo(81, 64); g.quadraticCurveTo(88, 72, 92, 80); g.stroke();
      twig(g, 20, 80, 19, 85.5, 2.2, WOODD);
      twig(g, 92, 80, 93, 85.5, 2.2, WOODD);
      // toile de la tente
      var tgd = g.createLinearGradient(28, 0, 84, 0);
      tgd.addColorStop(0, shade(P.wall, .12)); tgd.addColorStop(.5, P.wall); tgd.addColorStop(1, shade(P.wallSh, -.06));
      g.fillStyle = tgd;
      g.beginPath();
      g.moveTo(28, 82);
      g.quadraticCurveTo(33, 48, 56, 30);
      g.quadraticCurveTo(79, 48, 84, 82);
      g.quadraticCurveTo(56, 85.5, 28, 82);
      g.closePath(); g.fill();
      // bandes corail qui s'évasent depuis le faîte
      g.globalAlpha = .85;
      taperedStroke(g, [[53, 34], [45.5, 55], [41, 79]], 3, 8.5, P.accent);
      taperedStroke(g, [[59, 34], [66.5, 55], [71, 79]], 3, 8.5, shade(P.accent, -.08));
      g.globalAlpha = 1;
      // coutures des lés + rehaut côté lumière
      g.save(); g.setLineDash([2.2, 2.6]);
      g.strokeStyle = 'rgba(150,110,60,.45)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(49, 40); g.quadraticCurveTo(43, 58, 40, 78); g.stroke();
      g.beginPath(); g.moveTo(63, 40); g.quadraticCurveTo(69, 58, 72, 78); g.stroke();
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(33, 60); g.quadraticCurveTo(38, 42, 52, 33); g.stroke();
      // ouverture sombre + coussin qui attend à l'intérieur
      g.fillStyle = 'rgba(44,28,14,.85)';
      g.beginPath(); g.moveTo(48.5, 81); g.quadraticCurveTo(52, 56, 56, 49);
      g.quadraticCurveTo(60, 56, 63.5, 81); g.closePath(); g.fill();
      g.fillStyle = mix(P.accent, '#ffffff', .3);
      g.beginPath(); g.ellipse(56, 77.5, 5.6, 2.4, 0, 0, TAU); g.fill();
      g.fillStyle = shade(P.accent, -.2); g.beginPath(); g.arc(56, 77.5, .9, 0, TAU); g.fill();
      // rabats de porte retroussés
      g.strokeStyle = shade(P.wallSh, -.12); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(49, 80); g.quadraticCurveTo(45.5, 66, 52.5, 52); g.stroke();
      g.beginPath(); g.moveTo(63, 80); g.quadraticCurveTo(66.5, 66, 59.5, 52); g.stroke();
      // écusson patte sur le pan droit
      pawPrint(g, 76, 62, 2.8, 'rgba(201,102,42,.55)');
      // perches croisées au faîte + fanion
      twig(g, 56, 34, 47, 20.5, 2.4, WOODM);
      twig(g, 56, 34, 65, 20.5, 2.4, WOODM);
      g.fillStyle = P.flag;
      g.beginPath(); g.moveTo(65.5, 19.5); g.lineTo(75, 22); g.lineTo(65.5, 24.8); g.closePath(); g.fill();
      // coussins de méditation devant l'entrée
      [[35, 84, 7, 3, P.flag], [77, 84.5, 6, 2.6, P.accent]].forEach(function (q) {
        var cgd = g.createLinearGradient(0, q[1] - q[3], 0, q[1] + q[3]);
        cgd.addColorStop(0, mix(q[4], '#ffffff', .45)); cgd.addColorStop(1, shade(q[4], -.15));
        g.fillStyle = cgd;
        g.beginPath(); g.ellipse(q[0], q[1], q[2], q[3], 0, 0, TAU); g.fill();
        g.fillStyle = shade(q[4], -.3); g.beginPath(); g.arc(q[0], q[1], .9, 0, TAU); g.fill();
      });
      herbe(g, 15, 87, .8); herbe(g, 97, 87, .8);
      // ANIM : lampion suspendu à la perche gauche, il se balance
      var a = Math.sin(PH * TAU) * .14;
      g.save(); g.translate(47, 20.5); g.rotate(a);
      g.strokeStyle = 'rgba(90,64,32,.85)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 5.5); g.stroke();
      // halo chaud
      var glow = g.createRadialGradient(0, 10.5, 1, 0, 10.5, 10);
      glow.addColorStop(0, 'rgba(247,200,106,.30)'); glow.addColorStop(1, 'rgba(247,200,106,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(0, 10.5, 10, 0, TAU); g.fill();
      // corps du lampion
      var lgd = g.createLinearGradient(-4, 0, 4, 0);
      lgd.addColorStop(0, shade('#f7c86a', .25)); lgd.addColorStop(.5, '#f7c86a'); lgd.addColorStop(1, shade('#f7c86a', -.22));
      g.fillStyle = lgd; rr(g, -4, 5.5, 8, 10, 3.6); g.fill();
      g.strokeStyle = 'rgba(180,110,30,.45)'; g.lineWidth = .9;
      g.beginPath(); g.moveTo(-1.6, 6); g.quadraticCurveTo(-2.2, 10.5, -1.6, 15.2); g.stroke();
      g.beginPath(); g.moveTo(1.6, 6); g.quadraticCurveTo(2.2, 10.5, 1.6, 15.2); g.stroke();
      // chapeaux + pampille
      g.fillStyle = P.door; rr(g, -2.7, 4.4, 5.4, 2.1, 1); g.fill();
      rr(g, -2.7, 15.2, 5.4, 1.8, .9); g.fill();
      g.strokeStyle = P.accent; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(0, 17); g.lineTo(0, 20.5); g.stroke();
      g.fillStyle = P.accent; g.beginPath(); g.arc(0, 21.2, 1.1, 0, TAU); g.fill();
      g.restore();
    }
  });

  /* ============================================================
     4) ROULOTTE-CANTINE — chariot de bois à toit corail, hayon
        rayé relevé en auvent, comptoir à gamelle, sac de croquettes
        éventré, brancards. Anim : la cheminée fume par bouffées.
     ============================================================ */
  reg('production_cats', {
    id: 'c4-roulotte', label: 'Roulotte-cantine', anim: 'la cheminée fume par bouffées',
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);
      // caisse de la roulotte
      var wgd = g.createLinearGradient(26, 0, 86, 0);
      wgd.addColorStop(0, shade(WOOD, .2)); wgd.addColorStop(.55, WOOD); wgd.addColorStop(1, shade(WOOD, -.24));
      g.fillStyle = wgd; rr(g, 26, 44, 60, 28, 4); g.fill();
      // planches + nœud du bois
      g.strokeStyle = 'rgba(70,46,20,.35)'; g.lineWidth = 1.1;
      [51.5, 58.5, 65.5].forEach(function (py) {
        g.beginPath(); g.moveTo(28, py); g.lineTo(84, py); g.stroke();
      });
      g.strokeStyle = 'rgba(60,42,20,.45)'; g.lineWidth = 1;
      g.beginPath(); g.arc(79, 62, 1.5, 0, TAU); g.stroke();
      g.beginPath(); g.arc(79, 62, .5, 0, TAU); g.stroke();
      // cheminée (avant le toit pour que la base plonge derrière)
      var chd = g.createLinearGradient(69, 0, 75, 0);
      chd.addColorStop(0, shade('#7d5a38', .2)); chd.addColorStop(1, shade('#7d5a38', -.25));
      g.fillStyle = chd; rr(g, 69, 26, 6, 14, 1.5); g.fill();
      g.fillStyle = WOODD; rr(g, 67.4, 24.2, 9.2, 3.2, 1.5); g.fill();
      g.fillStyle = 'rgba(20,12,4,.6)'; rr(g, 69.8, 25, 4.4, 1.4, .7); g.fill();
      // toit arrondi corail
      var rgd = g.createLinearGradient(0, 34, 0, 49);
      rgd.addColorStop(0, shade(P.roof, .2)); rgd.addColorStop(1, shade(P.roofSh, -.02));
      g.fillStyle = rgd;
      g.beginPath();
      g.moveTo(22.5, 47); g.quadraticCurveTo(56, 31, 89.5, 47);
      g.lineTo(87, 50); g.quadraticCurveTo(56, 35.5, 25, 50);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(30, 44.2); g.quadraticCurveTo(56, 33.6, 82, 44.2); g.stroke();
      // ouverture du comptoir
      g.fillStyle = 'rgba(40,26,12,.85)'; rr(g, 32, 50.5, 30, 12, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.07)'; rr(g, 33.5, 51.5, 27, 3, 1.5); g.fill();
      // hayon relevé en auvent rayé
      g.save();
      g.beginPath();
      g.moveTo(28.5, 50); g.lineTo(65.5, 50); g.lineTo(69.5, 41); g.lineTo(24.5, 41);
      g.closePath(); g.clip();
      g.fillStyle = mix(P.flag, '#ffffff', .3); g.fillRect(24, 40, 47, 11);
      g.fillStyle = P.flag;
      [28, 40, 52].forEach(function (sx) { g.fillRect(sx, 40, 6.5, 11); });
      g.restore();
      g.strokeStyle = shade(P.flag, -.3); g.lineWidth = 1.1; g.globalAlpha = .6;
      g.beginPath();
      g.moveTo(28.5, 50); g.lineTo(65.5, 50); g.lineTo(69.5, 41); g.lineTo(24.5, 41);
      g.closePath(); g.stroke(); g.globalAlpha = 1;
      // béquilles de l'auvent
      twig(g, 31, 50, 27.5, 42.5, 1.8, WOODD);
      twig(g, 63, 50, 66.5, 42.5, 1.8, WOODD);
      // comptoir en bois clair
      var cpd = g.createLinearGradient(0, 61.5, 0, 66);
      cpd.addColorStop(0, shade(LWOOD, .24)); cpd.addColorStop(1, shade(LWOOD, -.2));
      g.fillStyle = cpd; rr(g, 30, 61.8, 34, 4.2, 1.8); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.32)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(32, 63); g.lineTo(62, 63); g.stroke();
      // gamelle garnie sur le comptoir
      var bod = g.createLinearGradient(0, 57.5, 0, 62);
      bod.addColorStop(0, mix(P.accent, '#ffffff', .34)); bod.addColorStop(1, shade(P.accent, -.2));
      g.fillStyle = bod;
      g.beginPath();
      g.moveTo(39.5, 57.8); g.quadraticCurveTo(39, 61.4, 42, 62);
      g.lineTo(47, 62); g.quadraticCurveTo(50, 61.4, 49.5, 57.8);
      g.closePath(); g.fill();
      g.fillStyle = shade(P.accent, -.34);
      g.beginPath(); g.ellipse(44.5, 57.8, 5, 1.7, 0, 0, TAU); g.fill();
      g.fillStyle = KIB;
      g.beginPath(); g.ellipse(43, 57.1, 1.5, 1, .3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(46, 57.3, 1.5, 1, -.2, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(44.5, 56.2, 1.4, .95, .1, 0, TAU); g.fill();
      // patte tamponnée sur le flanc
      pawPrint(g, 74, 55, 2.6, 'rgba(201,102,42,.5)');
      // roues cerclées à rayons
      [[36, 77], [76, 77]].forEach(function (q) {
        g.fillStyle = WOODM; g.beginPath(); g.arc(q[0], q[1], 9, 0, TAU); g.fill();
        var rwd = g.createRadialGradient(q[0] - 2, q[1] - 2, 1, q[0], q[1], 7);
        rwd.addColorStop(0, shade(LWOOD, .2)); rwd.addColorStop(1, shade(LWOOD, -.18));
        g.fillStyle = rwd; g.beginPath(); g.arc(q[0], q[1], 6.6, 0, TAU); g.fill();
        g.strokeStyle = WOODD; g.lineWidth = 1.4;
        for (var k = 0; k < 4; k++) {
          var an = k * Math.PI / 4 + .3;
          g.beginPath();
          g.moveTo(q[0] - Math.cos(an) * 6, q[1] - Math.sin(an) * 6);
          g.lineTo(q[0] + Math.cos(an) * 6, q[1] + Math.sin(an) * 6);
          g.stroke();
        }
        g.fillStyle = WOODD; g.beginPath(); g.arc(q[0], q[1], 2.1, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.2;
        g.beginPath(); g.arc(q[0], q[1], 8.2, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
      });
      // brancards (prêts pour la tournée)
      twig(g, 86, 66, 101, 60, 2.6, WOODM);
      twig(g, 86, 71.5, 101, 66.5, 2.6, WOODM);
      // sac de croquettes éventré contre la roue
      g.fillStyle = '#e6d2a4';
      g.beginPath();
      g.moveTo(15, 85); g.quadraticCurveTo(13.5, 72, 19, 67.5);
      g.lineTo(26, 69); g.quadraticCurveTo(28.5, 76, 27, 85);
      g.quadraticCurveTo(21, 87.5, 15, 85);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,118,66,.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(17, 72); g.quadraticCurveTo(20.5, 77, 19.5, 84); g.stroke();
      g.save(); g.translate(21.5, 66.8); g.rotate(-.12);
      g.fillStyle = shade('#e6d2a4', -.2); rr(g, -5.5, -2.2, 11, 4.4, 2); g.fill();
      g.restore();
      pawPrint(g, 21, 78, 2.3, 'rgba(154,106,58,.5)');
      g.fillStyle = KIB;
      [[30, 85.5], [33.5, 84], [30.5, 82.5], [36, 86]].forEach(function (q) {
        g.beginPath(); g.ellipse(q[0], q[1], 1.3, .9, .4, 0, TAU); g.fill();
      });
      herbe(g, 95, 86, .9);
      // ANIM : bouffées de fumée déphasées (fondu aux deux bouts)
      for (var i = 0; i < 3; i++) {
        var u = (PH + i / 3) % 1;
        var al = Math.sin(u * Math.PI) * .5;
        g.fillStyle = 'rgba(240,238,232,' + al.toFixed(3) + ')';
        g.beginPath();
        g.arc(72 + u * 3.5 + Math.sin(u * TAU) * 1.5, 22 - u * 13, 2 + u * 3, 0, TAU);
        g.fill();
      }
    }
  });

  /* ============================================================
     5) PENSION À PANIERS — étagère de quatre niches rondes en
        osier : un roux endormi, un crème qui ronfle, un coussin
        libre, une queue qui pend. Échelle, enseigne, gamelle.
        Anim : des z s'envolent du panier du ronfleur.
     ============================================================ */
  reg('production_cats', {
    id: 'c4-pension', label: 'Pension à paniers', anim: "des z s'envolent d'un panier",
    draw: function (g, animT) {
      var PH = (animT % 3.2) / 3.2;
      softShadow(g, 56, 88, 34, 10, 0.24);
      // pieds
      g.fillStyle = WOODD; rr(g, 30, 82, 8, 5, 2); g.fill(); rr(g, 74, 82, 8, 5, 2); g.fill();
      // caisse de l'étagère
      var wgd = g.createLinearGradient(26, 0, 86, 0);
      wgd.addColorStop(0, shade(WOOD, .18)); wgd.addColorStop(.55, WOOD); wgd.addColorStop(1, shade(WOOD, -.24));
      g.fillStyle = wgd; rr(g, 26, 30, 60, 53, 4); g.fill();
      g.fillStyle = 'rgba(0,0,0,.12)'; rr(g, 81, 33, 3.6, 47, 1.8); g.fill();
      // séparations internes
      g.fillStyle = shade(WOOD, -.28);
      rr(g, 54.6, 32.5, 2.8, 48, 1.4); g.fill();
      rr(g, 28, 55.6, 56, 2.8, 1.4); g.fill();
      // toit-planche en bois clair
      var tgd = g.createLinearGradient(0, 23.5, 0, 30.5);
      tgd.addColorStop(0, shade(LWOOD, .22)); tgd.addColorStop(1, shade(LWOOD, -.16));
      g.fillStyle = tgd; rr(g, 22, 23.5, 68, 7, 3); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.32)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(26, 25.4); g.lineTo(86, 25.4); g.stroke();
      g.strokeStyle = 'rgba(60,42,20,.32)'; g.lineWidth = 1;
      g.beginPath(); g.arc(33, 28, 1.3, 0, TAU); g.stroke(); // nœud du bois
      // quatre niches rondes
      var cells = [[41, 44.5], [71, 44.5], [41, 69.5], [71, 69.5]];
      cells.forEach(function (q) {
        var dgd = g.createRadialGradient(q[0], q[1] - 2, 1, q[0], q[1], 9.5);
        dgd.addColorStop(0, 'rgba(58,36,16,.9)'); dgd.addColorStop(1, 'rgba(30,18,7,.92)');
        g.fillStyle = dgd;
        g.beginPath(); g.arc(q[0], q[1], 9.5, 0, TAU); g.fill();
        g.strokeStyle = '#9a7038'; g.lineWidth = 2.8;
        g.beginPath(); g.arc(q[0], q[1], 9.5, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1;
        g.beginPath(); g.arc(q[0], q[1], 8.6, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
        // graduations du tressage sur le cerclage
        g.strokeStyle = 'rgba(60,38,14,.45)'; g.lineWidth = 1;
        for (var k = 0; k < 8; k++) {
          var an = k / 8 * TAU + .35;
          g.beginPath();
          g.moveTo(q[0] + Math.cos(an) * 8.3, q[1] + Math.sin(an) * 8.3);
          g.lineTo(q[0] + Math.cos(an) * 10.6, q[1] + Math.sin(an) * 10.6);
          g.stroke();
        }
      });
      // niche 1 : le roux roulé en boule
      g.save(); g.beginPath(); g.arc(41, 44.5, 8.6, 0, TAU); g.clip();
      var rgd = g.createRadialGradient(39, 44, 1, 41, 46.5, 8);
      rgd.addColorStop(0, shade('#e8a86a', .15)); rgd.addColorStop(1, shade('#e8a86a', -.12));
      g.fillStyle = rgd;
      g.beginPath(); g.ellipse(41, 47.5, 7.2, 4.6, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8a86a'; g.beginPath(); g.arc(36.8, 45.4, 3.6, 0, TAU); g.fill();
      g.fillStyle = shade('#e8a86a', -.1); // oreille
      g.beginPath(); g.moveTo(34.6, 43.6); g.lineTo(34, 40); g.lineTo(37.2, 42.2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(110,64,26,.7)'; g.lineWidth = .9; // œil clos + rayures
      g.beginPath(); g.arc(36.4, 46, 1.4, .3, Math.PI - .3); g.stroke();
      g.strokeStyle = 'rgba(180,110,50,.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(42, 44.4); g.lineTo(44.5, 46.4); g.stroke();
      g.beginPath(); g.moveTo(40, 45.4); g.lineTo(42.5, 47.6); g.stroke();
      taperedStroke(g, [[46.5, 49.5], [42, 51.5], [37.5, 50.5]], 2.6, 1.4, shade('#e8a86a', -.16));
      g.restore();
      // niche 2 : le crème qui ronfle (source des z)
      g.save(); g.beginPath(); g.arc(71, 44.5, 8.6, 0, TAU); g.clip();
      var cgd = g.createRadialGradient(69, 43.5, 1, 71, 46, 8);
      cgd.addColorStop(0, '#ffffff'); cgd.addColorStop(1, '#e9dfc8');
      g.fillStyle = cgd;
      g.beginPath(); g.ellipse(71, 47, 7, 4.4, 0, 0, TAU); g.fill();
      g.fillStyle = '#f6f1e6'; g.beginPath(); g.arc(75, 45, 3.4, 0, TAU); g.fill();
      g.fillStyle = '#e5d9bd';
      g.beginPath(); g.moveTo(77.2, 43); g.lineTo(78.2, 39.6); g.lineTo(74.8, 41.6); g.closePath(); g.fill();
      g.fillStyle = '#eaa48c'; g.beginPath(); g.arc(77.8, 45.8, .8, 0, TAU); g.fill(); // truffe
      g.strokeStyle = 'rgba(140,110,70,.65)'; g.lineWidth = .9;
      g.beginPath(); g.arc(75.4, 45.4, 1.3, .3, Math.PI - .3); g.stroke();
      g.restore();
      // niche 3 : coussin libre, chambre à louer
      g.save(); g.beginPath(); g.arc(41, 69.5, 8.6, 0, TAU); g.clip();
      var kgd = g.createLinearGradient(0, 69, 0, 76);
      kgd.addColorStop(0, mix(P.accent, '#ffffff', .45)); kgd.addColorStop(1, shade(P.accent, -.14));
      g.fillStyle = kgd;
      g.beginPath(); g.ellipse(41, 73, 7, 3.4, 0, 0, TAU); g.fill();
      g.fillStyle = shade(P.accent, -.3); g.beginPath(); g.arc(41, 72.6, .9, 0, TAU); g.fill();
      g.restore();
      // pelote posée sur le rebord de la niche libre
      g.fillStyle = P.flag; g.beginPath(); g.arc(33.5, 76.5, 2.8, 0, TAU); g.fill();
      g.strokeStyle = shade(P.flag, -.35); g.lineWidth = .8;
      g.beginPath(); g.arc(33.5, 76.5, 1.7, .8, 3.2); g.stroke();
      // niche 4 : quelqu'un dort au fond, la queue dépasse
      taperedStroke(g, [[71, 74.5], [74, 80], [71.8, 85.5]], 3.4, 1.9, '#a89684');
      g.fillStyle = '#f6f1e6'; g.beginPath(); g.arc(71.8, 85.8, 1.8, 0, TAU); g.fill();
      g.fillStyle = '#a89684'; // une patte molle sur le rebord
      g.beginPath(); g.ellipse(66.5, 76.8, 2.4, 1.5, .5, 0, TAU); g.fill();
      // enseigne suspendue à l'avant-toit droit
      g.strokeStyle = 'rgba(90,64,32,.8)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(89, 30.5); g.lineTo(88.2, 35.5); g.stroke();
      g.save(); g.translate(88.2, 35.5); g.rotate(.1);
      var sgd = g.createLinearGradient(0, 0, 0, 9);
      sgd.addColorStop(0, shade('#f2e6c0', .08)); sgd.addColorStop(1, shade('#f2e6c0', -.14));
      g.fillStyle = sgd; rr(g, -8, 0, 16, 9.5, 2); g.fill();
      g.strokeStyle = 'rgba(122,90,52,.5)'; g.lineWidth = 1; rr(g, -8, 0, 16, 9.5, 2); g.stroke();
      pawPrint(g, 0, 4.2, 2.2, 'rgba(201,102,42,.7)');
      g.restore();
      // échelle du gardien, appuyée au flanc gauche
      g.strokeStyle = WOODM; g.lineWidth = 2;
      g.beginPath(); g.moveTo(14, 86); g.lineTo(24, 38); g.stroke();
      g.beginPath(); g.moveTo(22, 86); g.lineTo(32, 38); g.stroke();
      g.strokeStyle = LWOOD; g.lineWidth = 1.8;
      [.16, .33, .5, .67, .84].forEach(function (t) {
        g.beginPath();
        g.moveTo(14 + 10 * t, 86 - 48 * t);
        g.lineTo(22 + 10 * t, 86 - 48 * t);
        g.stroke();
      });
      // gamelle d'accueil + herbe
      g.fillStyle = P.accent;
      g.beginPath();
      g.moveTo(89.5, 82.5); g.quadraticCurveTo(89.2, 85.6, 91.5, 86);
      g.lineTo(95.5, 86); g.quadraticCurveTo(97.8, 85.6, 97.5, 82.5);
      g.closePath(); g.fill();
      g.fillStyle = shade(P.accent, -.34);
      g.beginPath(); g.ellipse(93.5, 82.5, 4, 1.4, 0, 0, TAU); g.fill();
      g.fillStyle = KIB;
      g.beginPath(); g.ellipse(92.5, 81.9, 1.2, .8, .3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(94.6, 82, 1.2, .8, -.2, 0, TAU); g.fill();
      herbe(g, 100, 86.5, .8); herbe(g, 8, 87, .8);
      // ANIM : deux z déphasés s'envolent du panier du ronfleur
      for (var i = 0; i < 2; i++) {
        var u = (PH + i * .5) % 1;
        var al = Math.sin(u * Math.PI) * .6;
        var zs = 2.2 + u * 1.8;
        var zx = 77 + u * 6 + Math.sin(u * TAU) * 1.5;
        var zy = 34 - u * 15;
        g.strokeStyle = 'rgba(122,90,52,' + al.toFixed(3) + ')';
        g.lineWidth = 1.4; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(zx, zy); g.lineTo(zx + zs, zy);
        g.lineTo(zx, zy + zs); g.lineTo(zx + zs, zy + zs);
        g.stroke();
      }
    }
  });
})();
