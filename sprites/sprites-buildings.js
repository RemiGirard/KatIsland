/* ============================================================
   GRIFFES & PLUMES — sprites-buildings.js (5/9)
   Nœuds/bâtiments par faction (production/défense/contrôle/étendard).
   ============================================================ */
"use strict";

  // ------------------------------------------------------------
  // API : getNodeCanvas — bâtiments PAR FACTION (fini Mushroom Wars) :
  // chats = carton, paniers douillets, arbres à chat ; oiseaux =
  // brindilles, nichoirs, tours-mangeoires ; owner null = ruine grise.
  // kind 'controle' = drapeau sur mât, teinte owner.
  // ------------------------------------------------------------
  function nodePal(owner) {
    if (owner === 'cats') return {
      wall: '#f4ddb8', wallSh: '#d9b98a', roof: '#f08c42', roofSh: '#c9662a',
      accent: '#e76f51', flag: '#f08c42', door: '#8a5a30',
    };
    if (owner === 'birds') return {
      wall: '#e6f1f8', wallSh: '#bcd6e6', roof: '#48a9d8', roofSh: '#2f7ea8',
      accent: '#3a86ff', flag: '#48a9d8', door: '#4a6a80',
    };
    return {
      wall: '#d8d5ce', wallSh: '#b2aea6', roof: '#a8a49c', roofSh: '#847f76',
      accent: '#98948c', flag: '#b0aca4', door: '#6e6a62',
    };
  }

  // trait ligneux (brindilles, branches, perchoirs)
  function twig(g, x0, y0, x1, y1, w, c) {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  // empreinte de patte (emblème félin)
  function pawPrint(g, x, y, r, c) {
    g.fillStyle = c;
    g.beginPath(); g.ellipse(x, y + r * .5, r, r * .8, 0, 0, TAU); g.fill();
    for (const a of [-.75, 0, .75]) {
      g.beginPath();
      g.arc(x + Math.sin(a) * r * 1.35, y - r * .75 + Math.abs(a) * r * .35, r * .42, 0, TAU);
      g.fill();
    }
  }
  // plume stylisée (emblème aviaire)
  function featherMark(g, x, y, r, c) {
    g.fillStyle = c;
    g.save(); g.translate(x, y); g.rotate(-.6);
    g.beginPath();
    g.moveTo(0, -r);
    g.quadraticCurveTo(r * .85, -r * .2, 0, r * 1.15);
    g.quadraticCurveTo(-r * .85, -r * .2, 0, -r);
    g.closePath(); g.fill();
    g.restore();
  }

  // borne de pierre neutre (kind inconnu / 'neutral')
  function drawBorne(g, P) {
    const sg2 = g.createRadialGradient(50, 52, 4, 56, 62, 30);
    sg2.addColorStop(0, SGD.shade(P.wall, 0.18));
    sg2.addColorStop(0.7, P.wall);
    sg2.addColorStop(1, SGD.shade(P.wall, -0.22));
    g.fillStyle = sg2;
    g.beginPath();
    g.moveTo(38, 84);
    g.quadraticCurveTo(34, 52, 44, 40);
    g.quadraticCurveTo(52, 32, 62, 38);
    g.quadraticCurveTo(76, 48, 74, 84);
    g.quadraticCurveTo(56, 89, 38, 84);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.14)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(58, 44); g.lineTo(55, 52); g.lineTo(58.5, 58); g.stroke();
    g.beginPath(); g.moveTo(44, 66); g.lineTo(48.5, 70); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.30)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(56, 60, 6.5, 0.4, TAU - 0.8); g.stroke();
    g.beginPath(); g.arc(56, 60, 3, 1.2, TAU); g.stroke();
    g.fillStyle = 'rgba(122,160,90,0.75)';
    g.beginPath(); g.ellipse(44, 82, 7, 3.4, 0.2, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(66, 84, 5.5, 2.8, -0.2, 0, TAU); g.fill();
  }

  // point de contrôle : socle de pierre + mât + drapeau teinté owner
  function drawNodeControle(g, P) {
    g.fillStyle = '#b8b2a4'; g.beginPath(); g.ellipse(56, 84, 17, 7.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#cfc9ba'; g.beginPath(); g.ellipse(56, 81.5, 13, 5.5, 0, 0, TAU); g.fill();
    for (const q of [[45, 84, 5], [67, 85, 4.4], [56, 87.5, 5.6]]) {
      g.fillStyle = '#a9a294';
      g.beginPath(); g.ellipse(q[0], q[1], q[2], q[2] * .6, .2, 0, TAU); g.fill();
    }
    const mg = g.createLinearGradient(52, 0, 60, 0);
    mg.addColorStop(0, '#8a6a44'); mg.addColorStop(.5, '#6e5434'); mg.addColorStop(1, '#54402a');
    g.fillStyle = mg; roundRectPath(g, 53.5, 14, 5, 68, 2.4); g.fill();
    g.fillStyle = '#f4c542'; g.beginPath(); g.arc(56, 12, 3.2, 0, TAU); g.fill();
    // drapeau qui claque, échancré
    const fg = g.createLinearGradient(0, 16, 0, 42);
    fg.addColorStop(0, SGD.shade(P.flag, .2)); fg.addColorStop(1, SGD.shade(P.flag, -.22));
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(58.5, 17);
    g.quadraticCurveTo(78, 12, 93, 19);
    g.lineTo(84, 27); g.lineTo(94, 34);
    g.quadraticCurveTo(77, 42, 58.5, 40);
    g.closePath(); g.fill();
    g.strokeStyle = SGD.shade(P.flag, -.4); g.lineWidth = 1.3;
    g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.85)';
    starPath(g, 71, 28, 5, 5, 2, -Math.PI / 2); g.fill();
    g.strokeStyle = 'rgba(60,44,26,.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(58.5, 17); g.lineTo(58.5, 40); g.stroke();
  }

  // §6 : ÉTENDARD de bataille (+10% dmg/hp aux troupes du proprio) —
  // étendard griffé chez les chats, totem à plumes chez les oiseaux,
  // loque grise tant que personne n'y croit.
  function drawNodeBanner(g, P, owner) {
    if (owner === 'birds') {
      // socle de pierres
      g.fillStyle = '#8a7a5e'; g.beginPath(); g.ellipse(56, 85, 14, 5.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#a49a82'; g.beginPath(); g.ellipse(48, 87, 5, 2.6, .2, 0, TAU); g.fill();
      // couronne de plumes en éventail
      for (let i = 0; i < 5; i++) {
        const v = i / 4 - .5, a = -Math.PI / 2 + v * 1.15;
        const x0 = 56 + Math.cos(a) * 6, y0 = 27 + Math.sin(a) * 4;
        const x1 = 56 + Math.cos(a) * 25, y1 = 25 + Math.sin(a) * 23;
        taperedStroke(g, [[x0, y0], [(x0 + x1) / 2 + v * 3, (y0 + y1) / 2 - 1], [x1, y1]],
          4.6, 1.4, i % 2 ? SGD.shade(P.flag, .22) : P.flag);
      }
      // trois blocs sculptés, du plus large au plus fier
      for (const q of [[44, 60, 24, 25, '#8a6a44'], [47, 41, 18, 21, '#9a7a4e'], [50, 25, 12, 18, '#a8845a']]) {
        const bg = g.createLinearGradient(q[0], 0, q[0] + q[2], 0);
        bg.addColorStop(0, SGD.shade(q[4], .22)); bg.addColorStop(1, SGD.shade(q[4], -.28));
        g.fillStyle = bg; roundRectPath(g, q[0], q[1], q[2], q[3], 4); g.fill();
      }
      // liens teintés faction entre les blocs
      g.strokeStyle = P.accent; g.lineWidth = 2.2;
      for (const y of [60.5, 41.5]) { g.beginPath(); g.moveTo(46, y); g.lineTo(66, y); g.stroke(); }
      // face gravée du bloc médian : deux yeux, un bec
      g.fillStyle = 'rgba(40,28,14,.8)';
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(56 + s * 2.5, 46); g.lineTo(56 + s * 7, 44.5); g.lineTo(56 + s * 6, 48.5);
        g.closePath(); g.fill();
      }
      g.beginPath(); g.moveTo(53.5, 52); g.lineTo(58.5, 52); g.lineTo(56, 56.5); g.closePath(); g.fill();
      // emblème plume sur le bloc bas
      featherMark(g, 56, 71, 5.5, 'rgba(255,255,255,.85)');
      // petites plumes pendantes aux flancs
      for (const q of [[45, 62, -1], [67, 62, 1]]) {
        taperedStroke(g, [[q[0], q[1]], [q[0] + q[2] * 4, q[1] + 10]], 2.6, .8, '#e6ddc4');
      }
      return;
    }

    const dead = owner !== 'cats';
    // socle
    g.fillStyle = dead ? '#a8a49c' : '#b8a284';
    g.beginPath(); g.ellipse(56, 84, 12, 5, 0, 0, TAU); g.fill();
    g.save();
    if (dead) { g.translate(56, 84); g.rotate(.07); g.translate(-56, -84); } // le mât fatigue
    // mât + traverse + pointe
    const mg = g.createLinearGradient(52, 0, 60, 0);
    mg.addColorStop(0, dead ? '#8a8478' : '#8a6a44'); mg.addColorStop(1, dead ? '#5e584e' : '#54402a');
    g.fillStyle = mg; roundRectPath(g, 53.5, 12, 5, 72, 2.4); g.fill();
    g.fillStyle = dead ? '#98948c' : '#f4c542';
    starPath(g, 56, 9, 4, 4, 1.8, -Math.PI / 2); g.fill();
    g.fillStyle = dead ? '#7a746a' : '#6e5434'; roundRectPath(g, 38, 15, 36, 4.5, 2); g.fill();
    // cordelettes de suspension
    g.strokeStyle = dead ? 'rgba(70,66,58,.7)' : 'rgba(90,64,32,.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(40, 19); g.lineTo(42, 22); g.stroke();
    g.beginPath(); g.moveTo(72, 19); g.lineTo(70, 22); g.stroke();
    // toile
    const fg = g.createLinearGradient(0, 20, 0, 64);
    fg.addColorStop(0, SGD.shade(P.flag, .15)); fg.addColorStop(1, SGD.shade(P.flag, -.22));
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(41, 22); g.lineTo(71, 22);
    if (dead) {
      // loque grise en lambeaux
      g.lineTo(70, 44); g.lineTo(64, 38); g.lineTo(65, 52); g.lineTo(57, 42);
      g.lineTo(54, 55); g.lineTo(49, 40); g.lineTo(42, 48);
    } else {
      // bas de bannière lacéré par des griffes très motivées
      g.lineTo(70, 54); g.lineTo(66, 45); g.lineTo(64, 59); g.lineTo(59, 46);
      g.lineTo(56, 61); g.lineTo(51, 45); g.lineTo(48, 57); g.lineTo(42, 50);
    }
    g.closePath(); g.fill();
    g.strokeStyle = SGD.shade(P.flag, -.4); g.lineWidth = 1.2;
    g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1;
    if (dead) {
      g.fillStyle = 'rgba(255,255,255,.45)';
      starPath(g, 56, 31, 5, 4.4, 1.8, -Math.PI / 2); g.fill();
    } else {
      // patte de ralliement + les trois griffures de rigueur
      pawPrint(g, 56, 31, 4.2, 'rgba(255,255,255,.88)');
      g.strokeStyle = SGD.shade(P.flag, -.5); g.lineWidth = 2; g.globalAlpha = .75;
      for (const d of [-6, 0, 6]) {
        g.beginPath(); g.moveTo(50 + d, 25); g.quadraticCurveTo(53 + d, 33, 58 + d, 41); g.stroke();
      }
      g.globalAlpha = 1;
    }
    g.restore();
  }

  // ---- CHATS : carton, panier, arbre à chat, totem-griffoir ----
  function drawNodeCats(g, kind, P) {
    const cb = '#dcb77e', cbSh = '#b8935c', ink = '#7a5a34';
    if (kind === 'hq') {
      // fort en carton : tour annexe cannelée
      g.fillStyle = SGD.shade(cb, -.12); roundRectPath(g, 66, 44, 22, 42, 3); g.fill();
      g.fillStyle = 'rgba(122,90,52,.25)';
      for (let x = 68; x < 86; x += 5.5) g.fillRect(x, 45, 2.2, 40);
      g.fillStyle = SGD.shade(cb, -.12);
      for (const x of [66, 74.5, 83]) { roundRectPath(g, x, 38, 5, 8, 1); g.fill(); }
      // corps principal : grande boîte
      const wg = g.createLinearGradient(24, 0, 68, 0);
      wg.addColorStop(0, SGD.shade(cb, .1)); wg.addColorStop(1, SGD.shade(cb, -.06));
      g.fillStyle = wg; roundRectPath(g, 24, 40, 44, 46, 3); g.fill();
      // rabats de carton ouverts
      g.fillStyle = cbSh;
      g.beginPath(); g.moveTo(24, 41); g.lineTo(30, 28); g.lineTo(47, 30); g.lineTo(46, 41); g.closePath(); g.fill();
      g.fillStyle = SGD.shade(cbSh, .12);
      g.beginPath(); g.moveTo(68, 41); g.lineTo(62, 30); g.lineTo(47, 30); g.lineTo(47, 41); g.closePath(); g.fill();
      // scotch en travers
      g.globalAlpha = .5; g.fillStyle = '#f2e6c0';
      g.save(); g.translate(46, 62); g.rotate(-.5); g.fillRect(-24, -3.4, 48, 6.8); g.restore();
      g.globalAlpha = 1;
      // porte dessinée au feutre + vraie chatière
      g.strokeStyle = ink; g.lineWidth = 2;
      g.beginPath(); g.moveTo(38, 85); g.lineTo(38, 70); g.arc(45, 70, 7, Math.PI, 0); g.lineTo(52, 85); g.stroke();
      g.fillStyle = 'rgba(60,40,20,.8)';
      g.beginPath(); g.arc(45, 85, 5.5, Math.PI, 0); g.fill();
      // fenêtre gribouillée
      g.strokeStyle = ink; g.lineWidth = 1.6;
      g.strokeRect(56, 55, 8, 8);
      g.beginPath(); g.moveTo(60, 55); g.lineTo(60, 63); g.moveTo(56, 59); g.lineTo(64, 59); g.stroke();
      // drapeau à patte
      g.strokeStyle = '#6e5a40'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(30, 30); g.lineTo(30, 10); g.stroke();
      g.fillStyle = P.flag;
      g.beginPath(); g.moveTo(31, 11); g.quadraticCurveTo(44, 8, 53, 13);
      g.quadraticCurveTo(43, 16, 31, 20); g.closePath(); g.fill();
      pawPrint(g, 39, 13.5, 2.6, 'rgba(255,255,255,.85)');
    } else if (kind === 'production') {
      // panier douillet fortifié : osier + coussin + pelote
      const bg2 = g.createLinearGradient(0, 52, 0, 88);
      bg2.addColorStop(0, SGD.shade('#c89a5c', .15)); bg2.addColorStop(1, SGD.shade('#c89a5c', -.22));
      g.fillStyle = bg2;
      g.beginPath(); g.ellipse(56, 70, 26, 17, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,60,26,.35)'; g.lineWidth = 1.4;
      for (const yy of [63, 70, 77]) for (let x = 34; x < 78; x += 8) {
        g.beginPath(); g.arc(x + 4, yy, 4.4, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      }
      g.strokeStyle = '#9a7038'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(56, 56, 25, 8, 0, 0, TAU); g.stroke();
      // coussin qui déborde, capitonné
      const cg = g.createLinearGradient(0, 46, 0, 60);
      cg.addColorStop(0, SGD.mix(P.accent, '#ffffff', .55)); cg.addColorStop(1, P.accent);
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(56, 54, 21, 7.5, 0, 0, TAU); g.fill();
      g.strokeStyle = SGD.shade(P.accent, -.3); g.lineWidth = 1; g.globalAlpha = .5;
      g.beginPath(); g.ellipse(56, 54, 21, 7.5, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = SGD.shade(P.accent, -.25);
      for (const x of [46, 56, 66]) { g.beginPath(); g.arc(x, 54, 1.2, 0, TAU); g.fill(); }
      // pelote de laine + brin qui traîne
      g.fillStyle = P.flag; g.beginPath(); g.arc(24, 82, 6.5, 0, TAU); g.fill();
      g.strokeStyle = SGD.shade(P.flag, -.35); g.lineWidth = 1.1;
      g.beginPath(); g.arc(24, 82, 4.4, .6, 2.8); g.stroke();
      g.beginPath(); g.arc(24, 82, 2.4, 3.4, 5.6); g.stroke();
      g.beginPath(); g.moveTo(30, 84); g.quadraticCurveTo(38, 87, 44, 84); g.stroke();
      // piquets (fortifié quand même)
      twig(g, 32, 62, 27, 46, 3, '#8a6a44');
      twig(g, 80, 62, 85, 46, 3, '#8a6a44');
    } else if (kind === 'defense') {
      // arbre à chat de guerre : poteau sisal + plateformes
      g.fillStyle = SGD.shade('#8a6a44', -.1); roundRectPath(g, 38, 80, 36, 8, 3); g.fill();
      const pg = g.createLinearGradient(50, 0, 62, 0);
      pg.addColorStop(0, SGD.shade('#c9a86a', .2)); pg.addColorStop(.5, '#c9a86a'); pg.addColorStop(1, SGD.shade('#c9a86a', -.3));
      g.fillStyle = pg; roundRectPath(g, 51, 26, 10, 56, 4); g.fill();
      g.strokeStyle = 'rgba(110,80,40,.5)'; g.lineWidth = 1.4;
      for (let y = 30; y < 80; y += 4.5) { g.beginPath(); g.moveTo(51.5, y); g.lineTo(60.5, y - 2.4); g.stroke(); }
      // plateformes garnies
      for (const q of [[56, 52, 20], [56, 26, 15]]) {
        g.fillStyle = SGD.shade('#8a6a44', .12);
        g.beginPath(); g.ellipse(q[0], q[1], q[2], q[2] * .38, 0, 0, TAU); g.fill();
        g.fillStyle = P.accent; g.globalAlpha = .85;
        g.beginPath(); g.ellipse(q[0], q[1] - 1.4, q[2] * .8, q[2] * .26, 0, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      // griffures de service
      g.strokeStyle = 'rgba(70,46,20,.6)'; g.lineWidth = 1.2;
      for (const d of [-2.4, 0, 2.4]) { g.beginPath(); g.moveTo(54 + d, 62); g.lineTo(56 + d, 74); g.stroke(); }
      // jouet suspendu (mâchicoulis félin)
      g.strokeStyle = '#5c4626'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(70, 27); g.lineTo(73, 38); g.stroke();
      g.fillStyle = P.flag; g.beginPath(); g.arc(73, 41, 3.4, 0, TAU); g.fill();
      // fanion
      twig(g, 56, 24, 56, 10, 2, '#6e5a40');
      g.fillStyle = P.flag;
      g.beginPath(); g.moveTo(57, 11); g.lineTo(68, 14); g.lineTo(57, 17.5); g.closePath(); g.fill();
    } else if (kind === 'reinforce') {
      // totem-griffoir à bannière, oreilles découpées au sommet
      g.fillStyle = cbSh; g.beginPath(); g.ellipse(56, 84, 12, 5, 0, 0, TAU); g.fill();
      const mgc = g.createLinearGradient(52, 0, 60, 0);
      mgc.addColorStop(0, '#c9a86a'); mgc.addColorStop(1, '#8a6a44');
      g.fillStyle = mgc; roundRectPath(g, 52.5, 16, 7, 68, 3); g.fill();
      g.strokeStyle = 'rgba(110,80,40,.45)'; g.lineWidth = 1.2;
      for (let y = 20; y < 82; y += 5) { g.beginPath(); g.moveTo(53, y); g.lineTo(59, y - 2); g.stroke(); }
      g.fillStyle = '#8a6a44';
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(56 + s * 1, 16); g.lineTo(56 + s * 7, 6); g.lineTo(56 + s * 7.5, 16); g.closePath(); g.fill();
      }
      g.fillStyle = '#7a5e3c'; roundRectPath(g, 38, 17, 36, 4.5, 2); g.fill();
      const fg2 = g.createLinearGradient(0, 22, 0, 62);
      fg2.addColorStop(0, SGD.shade(P.flag, .15)); fg2.addColorStop(1, SGD.shade(P.flag, -.2));
      g.fillStyle = fg2;
      g.beginPath();
      g.moveTo(41, 22); g.lineTo(71, 22);
      g.lineTo(70, 58); g.lineTo(62, 50); g.lineTo(56, 60); g.lineTo(50, 50); g.lineTo(42, 58);
      g.closePath(); g.fill();
      g.strokeStyle = SGD.shade(P.flag, -.4); g.lineWidth = 1.2;
      g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1;
      pawPrint(g, 56, 34, 4.4, 'rgba(255,255,255,.88)');
    } else drawBorne(g, P);
  }

  // ---- OISEAUX : nids, nichoirs, tours-mangeoires, perchoirs ----
  function drawNodeBirds(g, kind, P) {
    if (kind === 'hq') {
      // souche porteuse
      const sg = g.createLinearGradient(36, 0, 78, 0);
      sg.addColorStop(0, '#9a7a4e'); sg.addColorStop(1, '#6e5434');
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(40, 86); g.lineTo(42, 60); g.lineTo(70, 60); g.lineTo(72, 86);
      g.quadraticCurveTo(56, 90, 40, 86); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(50,34,16,.4)'; g.lineWidth = 1.2;
      for (const x of [48, 56, 64]) { g.beginPath(); g.moveTo(x, 62); g.lineTo(x - 1, 84); g.stroke(); }
      // grand nid de brindilles
      const ng = g.createLinearGradient(0, 40, 0, 68);
      ng.addColorStop(0, '#b08a54'); ng.addColorStop(1, '#7a5c34');
      g.fillStyle = ng;
      g.beginPath(); g.ellipse(56, 54, 30, 14, 0, 0, TAU); g.fill();
      g.fillStyle = '#4e3a20';
      g.beginPath(); g.ellipse(56, 50, 21, 8, 0, 0, TAU); g.fill();
      const rn = mulberry(7);
      for (let i = 0; i < 24; i++) {
        const a2 = rn() * TAU, rr = 21 + rn() * 10;
        const x = 56 + Math.cos(a2) * rr, y = 54 + Math.sin(a2) * rr * .42;
        const dx = 4 + rn() * 5, dy = (rn() - .5) * 5;
        twig(g, x - dx, y + dy, x + dx, y - dy, 1.3 + rn(), rn() < .5 ? '#8a6a3c' : '#c9a06a');
      }
      // œufs
      for (const q of [[50, 48], [61, 49]]) {
        g.fillStyle = '#f2ead2'; g.beginPath(); g.ellipse(q[0], q[1], 4.2, 5.2, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(140,120,80,.5)';
        g.beginPath(); g.arc(q[0] - 1.2, q[1] + 1, .9, 0, TAU); g.fill();
        g.beginPath(); g.arc(q[0] + 1.4, q[1] - 1.6, .7, 0, TAU); g.fill();
      }
      // branche-mât + étendard plume
      twig(g, 76, 52, 86, 12, 2.6, '#6e5434');
      g.fillStyle = P.flag;
      g.beginPath(); g.moveTo(86, 12); g.quadraticCurveTo(99, 10, 105, 16);
      g.quadraticCurveTo(96, 19, 87, 21); g.closePath(); g.fill();
      featherMark(g, 94, 15.5, 3.2, 'rgba(255,255,255,.85)');
    } else if (kind === 'production') {
      // nichoir-mangeoire sur poteau
      twig(g, 56, 86, 56, 52, 5, '#7a5c34');
      g.fillStyle = '#9a7a4e'; roundRectPath(g, 36, 60, 40, 6, 2.4); g.fill();
      g.fillStyle = '#e8c96a';
      const rn2 = mulberry(3);
      for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(40 + rn2() * 32, 60.8 + rn2() * 2.6, 1.1, 0, TAU); g.fill(); }
      const hg = g.createLinearGradient(40, 0, 72, 0);
      hg.addColorStop(0, '#c9a06a'); hg.addColorStop(1, '#9a7444');
      g.fillStyle = hg; roundRectPath(g, 41, 34, 30, 26, 3); g.fill();
      g.strokeStyle = 'rgba(70,50,24,.35)'; g.lineWidth = 1;
      for (const y of [41, 48, 55]) { g.beginPath(); g.moveTo(42, y); g.lineTo(70, y); g.stroke(); }
      g.fillStyle = P.roof;
      g.beginPath(); g.moveTo(37, 36); g.lineTo(56, 22); g.lineTo(75, 36); g.closePath(); g.fill();
      g.strokeStyle = P.roofSh; g.lineWidth = 1.2; g.globalAlpha = .6;
      g.beginPath(); g.moveTo(56, 24); g.lineTo(56, 34); g.stroke(); g.globalAlpha = 1;
      // trou d'envol + perchoir
      g.fillStyle = '#31220f'; g.beginPath(); g.arc(56, 46, 5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(54.5, 44.5, 2, 0, TAU); g.fill();
      twig(g, 56, 52, 64, 57, 2, '#54402a');
    } else if (kind === 'defense') {
      // tour-mangeoire : silo à graines + perchoirs de tir
      twig(g, 56, 86, 56, 32, 6, '#7a5c34');
      const cg2 = g.createLinearGradient(42, 0, 70, 0);
      cg2.addColorStop(0, '#e6ddc4'); cg2.addColorStop(1, '#b8ac8a');
      g.fillStyle = cg2; roundRectPath(g, 43, 34, 26, 34, 5); g.fill();
      // meurtrière à graines
      g.fillStyle = '#4a3a22'; roundRectPath(g, 52.5, 40, 7, 20, 3); g.fill();
      g.fillStyle = '#e8c96a';
      for (let y = 57; y > 45; y -= 3.2) { g.beginPath(); g.arc(56, y, 1.5, 0, TAU); g.fill(); }
      // toit conique
      g.fillStyle = P.roof;
      g.beginPath(); g.moveTo(38, 36); g.lineTo(56, 18); g.lineTo(74, 36); g.closePath(); g.fill();
      g.strokeStyle = P.roofSh; g.lineWidth = 1.2; g.globalAlpha = .6;
      g.beginPath(); g.moveTo(56, 20); g.lineTo(56, 34); g.stroke(); g.globalAlpha = 1;
      // perchoirs de tir
      for (const q of [[43, 64, -1], [69, 64, 1], [43, 50, -1], [69, 50, 1]]) {
        twig(g, q[0], q[1], q[0] + q[2] * 9, q[1] + 2.5, 2, '#54402a');
      }
      // plateau de garde
      g.fillStyle = '#9a7a4e'; g.beginPath(); g.ellipse(56, 69, 19, 5, 0, 0, TAU); g.fill();
      // fanion
      twig(g, 56, 18, 56, 8, 1.6, '#54402a');
      g.fillStyle = P.flag;
      g.beginPath(); g.moveTo(57, 8.5); g.lineTo(67, 11); g.lineTo(57, 14); g.closePath(); g.fill();
    } else if (kind === 'reinforce') {
      // perchoir en T à bannière, plumes de ralliement
      g.fillStyle = '#8a7a5e'; g.beginPath(); g.ellipse(56, 84, 11, 4.5, 0, 0, TAU); g.fill();
      twig(g, 56, 84, 55, 20, 4.4, '#6e5434');
      twig(g, 36, 22, 76, 20, 3.6, '#7a5c34');
      twig(g, 66, 21, 75, 12, 2, '#7a5c34');
      const fg3 = g.createLinearGradient(0, 24, 0, 62);
      fg3.addColorStop(0, SGD.shade(P.flag, .15)); fg3.addColorStop(1, SGD.shade(P.flag, -.2));
      g.fillStyle = fg3;
      g.beginPath();
      g.moveTo(41, 24); g.lineTo(71, 24); g.lineTo(70, 56); g.lineTo(56, 62); g.lineTo(42, 56);
      g.closePath(); g.fill();
      g.strokeStyle = SGD.shade(P.flag, -.4); g.lineWidth = 1.2;
      g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1;
      featherMark(g, 56, 38, 6, 'rgba(255,255,255,.88)');
      for (const q of [[37, 24], [75, 22]]) {
        taperedStroke(g, [[q[0], q[1]], [q[0] - 3, q[1] + 9]], 2.4, .8, '#e6ddc4');
      }
    } else drawBorne(g, P);
  }

  // ---- NEUTRE : ruines grises, à retaper par le vainqueur ----
  function drawNodeNeutral(g, kind, P) {
    if (kind === 'hq') {
      // donjon gris ébréché
      const wg = g.createLinearGradient(28, 0, 78, 0);
      wg.addColorStop(0, SGD.shade(P.wall, .1)); wg.addColorStop(1, SGD.shade(P.wall, -.12));
      g.fillStyle = wg;
      g.beginPath();
      g.moveTo(30, 86); g.lineTo(31, 38); g.lineTo(44, 38); g.lineTo(44, 30); g.lineTo(54, 30);
      g.lineTo(54, 38); g.lineTo(66, 38); g.lineTo(68, 50); g.lineTo(78, 52); g.lineTo(80, 86);
      g.quadraticCurveTo(56, 90, 30, 86); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(48, 46); g.lineTo(45, 56); g.lineTo(49, 64); g.stroke();
      for (const y of [48, 62, 74]) { g.beginPath(); g.moveTo(34, y); g.lineTo(74, y + 2); g.stroke(); }
      g.fillStyle = 'rgba(24,24,30,.7)';
      g.beginPath(); g.moveTo(50, 86); g.lineTo(50, 72); g.arc(56, 72, 6, Math.PI, 0); g.lineTo(62, 86); g.closePath(); g.fill();
      g.fillStyle = 'rgba(110,140,84,.55)';
      g.beginPath(); g.ellipse(71, 58, 5, 9, .4, 0, TAU); g.fill();
    } else if (kind === 'production') {
      // hutte grise affaissée, toit crevé
      g.fillStyle = P.wall; g.beginPath(); g.ellipse(56, 70, 23, 16, 0, 0, TAU); g.fill();
      g.fillStyle = P.roof;
      g.beginPath(); g.moveTo(31, 60); g.quadraticCurveTo(56, 68, 81, 60); g.lineTo(58, 30); g.closePath(); g.fill();
      g.strokeStyle = P.roofSh; g.lineWidth = 1.1; g.globalAlpha = .5;
      for (const dx of [-12, 0, 12]) { g.beginPath(); g.moveTo(58, 32); g.lineTo(56 + dx, 61); g.stroke(); }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(20,20,26,.5)';
      g.beginPath(); g.ellipse(66, 44, 5, 3.4, .5, 0, TAU); g.fill();
      g.fillStyle = P.door; g.beginPath(); g.arc(56, 79, 7, Math.PI, 0); g.fill();
    } else if (kind === 'defense') {
      // tour grise fissurée, créneaux ébréchés
      const tg = g.createLinearGradient(40, 0, 74, 0);
      tg.addColorStop(0, SGD.shade(P.wall, .12));
      tg.addColorStop(.6, P.wall);
      tg.addColorStop(1, SGD.shade(P.wall, -.18));
      g.fillStyle = tg;
      g.beginPath();
      g.moveTo(41, 86); g.lineTo(43, 30); g.lineTo(69, 30); g.lineTo(71, 86);
      g.quadraticCurveTo(56, 90, 41, 86); g.closePath(); g.fill();
      g.fillStyle = SGD.shade(P.wall, -.06);
      roundRectPath(g, 38, 26, 36, 7, 2); g.fill();
      for (const q of [[39, 10], [49.5, 6], [64, 9]]) {
        g.fillStyle = SGD.shade(P.wall, .1);
        roundRectPath(g, q[0], 17 + (10 - q[1]), 6.5, q[1], 1.5); g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(52, 40); g.lineTo(49, 52); g.lineTo(54, 62); g.lineTo(51, 74); g.stroke();
      for (const yy of [46, 58, 70]) { g.beginPath(); g.moveTo(44, yy); g.lineTo(70, yy); g.stroke(); }
      g.fillStyle = 'rgba(20,20,26,.75)';
      roundRectPath(g, 54, 44, 4, 13, 2); g.fill();
      g.fillStyle = 'rgba(110,140,84,.5)';
      g.beginPath(); g.ellipse(46, 82, 6, 3, .2, 0, TAU); g.fill();
    } else if (kind === 'reinforce') {
      // mât nu, bannière grise en lambeaux
      g.fillStyle = SGD.shade(P.wall, -.1);
      g.beginPath(); g.ellipse(56, 84, 9, 4, 0, 0, TAU); g.fill();
      const mg = g.createLinearGradient(53, 0, 59, 0);
      mg.addColorStop(0, '#8a8478'); mg.addColorStop(1, '#5e584e');
      g.fillStyle = mg; roundRectPath(g, 53.5, 16, 5, 68, 2.4); g.fill();
      g.fillStyle = '#7a746a'; roundRectPath(g, 38, 18, 36, 4.5, 2); g.fill();
      const fg = g.createLinearGradient(0, 23, 0, 58);
      fg.addColorStop(0, SGD.shade(P.flag, .12)); fg.addColorStop(1, SGD.shade(P.flag, -.18));
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(41, 23); g.lineTo(71, 23);
      g.lineTo(70, 44); g.lineTo(64, 40); g.lineTo(65, 52); g.lineTo(57, 44);
      g.lineTo(54, 56); g.lineTo(49, 42); g.lineTo(42, 50);
      g.closePath(); g.fill();
      g.strokeStyle = SGD.shade(P.flag, -.35); g.lineWidth = 1.1;
      g.globalAlpha = .5; g.stroke(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,.5)';
      starPath(g, 56, 32, 5, 4.4, 1.8, -Math.PI / 2); g.fill();
    } else drawBorne(g, P);
  }

  function getNodeCanvas(kind, owner, size) {
    size = size || 112;
    const key = 'n2|' + kind + '|' + (owner || 'none') + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;
    cv = mk(size, size);
    const g = cv.getContext('2d');
    g.scale(size / 112, size / 112);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // skin validé au terrain-lab (skins/skins-config.js) : bake statique à t=0
    const lv = window.LabSkins ? LabSkins.building(kind, owner) : null;
    if (lv) {
      let ok = true;
      try { lv.draw(g, 0); } catch (e) {
        ok = false;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, size, size);
        g.scale(size / 112, size / 112);
        g.lineJoin = 'round'; g.lineCap = 'round';
      }
      if (ok) { cache.set(key, cv); return cv; }
    }
    const P = nodePal(owner);
    softShadow(g, 56, 88, 36, 10, 0.24);
    if (kind === 'controle') drawNodeControle(g, P);
    else if (kind === 'banner') drawNodeBanner(g, P, owner);
    else if (owner === 'cats') drawNodeCats(g, kind, P);
    else if (owner === 'birds') drawNodeBirds(g, kind, P);
    else drawNodeNeutral(g, kind, P);
    cache.set(key, cv);
    return cv;
  }


