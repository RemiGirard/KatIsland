/* ============================================================
   GRIFFES & PLUMES — progression.js
   Mode Expédition : carte globale des villes -> parcours en ville
   isométrique avec embranchements -> batailles "personal" par étapes.
   -> window.Progression
   Dépend : Battle, GameData, GameState, UI, Sprites, FX.
   ============================================================ */
"use strict";
(function () {

  const GD = window.GameData;

  let root = null;
  let overviewView = null, missionView = null, battleView = null;
  let ovCanvas = null, ovCtx = null;
  let treeWrap = null, treeCanvas = null, treeCtx = null;
  let treeCache = { key: null, rows: null };
  let treeHits = [];
  let hoverNode = null;       // nœud atteignable sous la souris (tooltip)
  let hoverPos = null;        // {x,y} css : le tooltip suit le curseur
  let bCanvas = null;
  let battle = null;
  let battleStage = 0;
  let battleChoice = null;
  let battleNode = null;      // nœud de l'arbre en cours de bataille
  let battleOver = false;
  let battleStarted = false;  // phase de préparation : le terrain attend le joueur
  let selType = 'lancier', selQty = 5;
  let battleSendRatio = 0.5, battlePrepUnits = 0;
  let selectedNode = null;
  let pendingPotion = null;   // potion en attente de ciblage sur le canvas
  let potionCd = 0;           // recharge globale des potions (s)
  let pendingScroll = null;   // §D4 : parchemin (sort) en attente de ciblage
  let scrollCd = 0;           // §D4 : recharge globale COURTE des parchemins (s)
  let pgTime = 0, hudT = 0;
  let curView = 'overview'; // 'overview' | 'mission' | 'battle'
  const els = {};

  function pf() { return GameState.state.faction || 'cats'; }
  function st() { return GameState.state; }

  // §D13 §E : constante d'ÉLITE unique, partagée avec data.js (fallback local)
  const ELITE_MULT = GD.EXPEDITION_ELITE_MULT || 1.6;

  const GOOFY_BRIEFS = [
    "Les éclaireurs rapportent que l'ennemi a fait des réserves de graines. Ou de croquettes. Bref, il faut y aller.",
    'Le plan est simple : on capture tout, et après on fait la sieste. Dans cet ordre. Promis.',
    "D'après nos espions, la garnison ennemie est \"très motivée\". Nous aussi. Enfin, après le goûter.",
    "Le Haut Commandement a dessiné le plan d'attaque sur une serviette. C'est du sérieux.",
    "Objectif : leur QG. Méthode : beaucoup de courage et un peu de chaos. Comme d'habitude.",
    'La météo annonce une pluie de renforts. Les nôtres, si tout va bien.',
    "Mission acceptée ! Enfin, personne n'a vraiment demandé votre avis, mais vous êtes partant, non ?",
    'Selon la légende, le premier arrivé sur le QG ennemi gagne le respect ET les miettes.',
  ];

  function ensurePath() {
    const s = st();
    if (!s.progression.path) s.progression.path = [];
  }

  function rewardChips(rewards, container) {
    container.innerHTML = '';
    for (const k in rewards) {
      const info = UI.res(k);
      const chip = document.createElement('span');
      chip.className = 'pg-chip';
      chip.textContent = info.icon + ' ' + UI.fmt(rewards[k]);
      container.appendChild(chip);
    }
  }


  // couleur associée à un choix (cohérente entre la ville isométrique et les cartes)
  const CHOICE_COLORS = { supplies: '#e0a83f', materials: '#5aa8c9', glory: '#b478d8', boss: '#f4c542' };

  function mulberry32(seed) {
    let a = (seed >>> 0) || 7;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // -----------------------------------------------------------
  // Styles (préfixe pg-)
  // -----------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('pg-styles')) return;
    const s = document.createElement('style');
    s.id = 'pg-styles';
    // §D11ter : FLAT woodcut (DESIGN3 §11) — tokens du jeu (--card/--line/--acc),
    // bordures fines, ombres DURES 0 2px 0, rayons r-sm/md/lg. Zéro blanc translucide.
    s.textContent = [
      '.pg-root{display:flex;flex-direction:column;gap:9px;flex:1;min-height:0;}',
      // ---- vue 1 : GLOBE pseudo-3D flat qui tourne doucement, drapeaux par statut ----
      '.pg-ovview{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;}',
      '.pg-world{position:relative;flex:1;min-height:440px;overflow:hidden;',
      ' background:var(--paper);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);}',
      '.pg-globe{position:absolute;inset:0;cursor:grab;touch-action:none;}',
      '.pg-globe.drag{cursor:grabbing;}',
      '.pg-cityfocus{position:absolute;left:12px;bottom:12px;width:196px;z-index:5;',
      ' background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow);',
      ' padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px;}',
      '.pg-cityfocus canvas{display:block;width:100%;height:auto;border-radius:var(--r-sm);}',
      '.pg-cardname{font-weight:900;font-size:12.5px;text-align:center;line-height:1.1;color:var(--ink);}',
      '.pg-cardsub{font-weight:800;font-size:10.5px;color:var(--acc);text-align:center;}',
      '.pg-enter{cursor:pointer;width:100%;margin-top:2px;border-radius:var(--r-sm);padding:6px 8px;',
      ' font-weight:800;font-size:12px;background:var(--acc);border:1px solid var(--acc-dark);',
      ' box-shadow:0 2px 0 var(--acc-dark);color:#f8f2e4;transition:transform .15s var(--jelly);}',
      '.pg-enter:hover{transform:translateY(-1px);} .pg-enter:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-hint{text-align:center;font-size:12px;font-weight:700;color:var(--ink-soft);}',
      // ---- vue 2 : ville -> parcours linéaire ----
      '.pg-missionview{display:none;flex-direction:column;gap:9px;flex:1;min-height:0;overflow-y:auto;padding-right:4px;}',
      '.pg-card{max-width:900px;width:100%;margin:0 auto;flex:0 0 auto;',
      ' background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow);',
      ' padding:11px 13px;animation:popIn .25s ease-out;}',
      '.pg-missionhead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;}',
      '.pg-back{cursor:pointer;border-radius:var(--r-sm);background:var(--card-solid);',
      ' border:1px solid var(--line-dark);box-shadow:0 2px 0 var(--line-dark);',
      ' padding:5px 10px;font-weight:800;font-size:12px;color:var(--ink);flex:0 0 auto;',
      ' transition:transform .15s var(--jelly);}',
      '.pg-back:hover{transform:translateY(-1px);} .pg-back:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-kicker{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--ink-soft);}',
      '.pg-title{font-size:19px;font-weight:900;margin:1px 0;color:var(--ink);}',
      '.pg-stage{font-size:12.5px;font-weight:800;color:var(--acc);}',
      '.pg-desc{font-size:12.5px;font-weight:600;color:var(--ink-soft);margin:6px 0 0;line-height:1.4;}',
      '.pg-note{font-size:12px;font-weight:700;color:var(--ink-soft);margin-top:9px;}',
      // §D11quater : parcours en ZIGZAG vertical (serpentin) — pas de scroll horizontal.
      '.pg-treewrap{position:relative;border-radius:var(--r-md);overflow:hidden;margin-top:9px;',
      ' background:var(--paper);border:1px solid var(--line);}',
      '.pg-path{position:relative;width:100%;}',
      '.pg-st{position:absolute;transform:translate(-50%,-50%);}',
      '.pg-dot{width:46px;height:46px;border-radius:999px;display:flex;align-items:center;justify-content:center;',
      ' font-size:19px;background:var(--card-solid);border:1px solid var(--line-dark);box-shadow:0 2px 0 var(--line-dark);',
      ' transition:transform .15s var(--jelly);}',
      '.pg-st.done .pg-dot{background:var(--good);border-color:var(--good-dark);box-shadow:0 2px 0 var(--good-dark);color:#f8f2e4;}',
      '.pg-st.current .pg-dot{cursor:pointer;background:var(--acc-soft);border-color:var(--acc-dark);',
      ' box-shadow:0 2px 0 var(--acc-dark);animation:pgBob 1.4s ease-in-out infinite;}',
      '.pg-st.current .pg-dot:hover{transform:translateY(-2px);} .pg-st.current .pg-dot:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-st.boss .pg-dot{font-size:23px;width:54px;height:54px;}',
      '.pg-st.locked .pg-dot{opacity:.5;filter:grayscale(.6);box-shadow:none;}',
      '@keyframes pgBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}',
      // §D11quinquies : chiffres AU-DESSUS des pastilles (sinon ils croisent les pointillés)
      '.pg-stlabel{position:absolute;bottom:calc(100% + 3px);left:50%;transform:translateX(-50%);white-space:nowrap;',
      ' font-weight:800;font-size:10.5px;text-align:center;color:var(--ink-soft);line-height:1.1;}',
      '.pg-st.current .pg-stlabel{color:var(--acc);}',
      '.pg-decor{position:absolute;transform:translate(-50%,-50%);pointer-events:none;opacity:.95;}',
      '.pg-decor canvas{display:block;}',
      // ---- choix de butin (popup) ----
      '.pg-lootlist{display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow-y:auto;margin-top:8px;}',
      '.pg-lootrow{display:flex;align-items:center;gap:10px;padding:7px 9px;cursor:pointer;text-align:left;',
      ' background:var(--card-solid);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--shadow-sm);',
      ' font-weight:700;font-size:12.5px;color:var(--ink);transition:transform .12s var(--jelly);}',
      '.pg-lootrow:hover{transform:translateY(-1px);} .pg-lootrow:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-lootrow .ic{font-size:22px;flex:0 0 auto;}',
      '.pg-lootrow .tx{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;}',
      '.pg-lootrow .tx small{color:var(--ink-soft);font-weight:700;}',
      '.pg-lootrow .rw{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:45%;}',
      '.pg-fchip{background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:2px 7px;',
      ' font-weight:800;font-size:11px;white-space:nowrap;color:var(--ink);}',
      '.pg-legend{font-size:11.5px;font-weight:700;color:var(--ink-soft);text-align:center;margin-top:6px;}',
      '.pg-potions{display:none;gap:5px;align-items:center;}',
      '.pg-potion{position:relative;width:34px;height:34px;cursor:pointer;font-size:16px;line-height:1;padding:0;',
      ' background:var(--card-solid);border:1px solid var(--line-dark);box-shadow:0 2px 0 var(--line-dark);',
      ' border-radius:var(--r-sm);transition:transform .15s var(--jelly);}',
      '.pg-potion:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-potion.aim{border-color:var(--acc-dark);box-shadow:0 2px 0 var(--acc-dark);background:var(--acc-soft);}',
      '.pg-potion:disabled{opacity:.4;cursor:not-allowed;}',
      '.pg-potion .n{position:absolute;bottom:-5px;right:-5px;background:var(--ink);color:#f8f2e4;',
      ' font-weight:800;font-size:9px;border-radius:999px;padding:1px 4px;z-index:1;}',
      '.pg-potion .cdo{position:absolute;inset:0;display:none;align-items:center;justify-content:center;',
      ' font-weight:900;font-size:12px;color:#f8f2e4;background:rgba(46,38,32,.55);border-radius:var(--r-sm);}',
      '.pg-potion.cd .cdo{display:flex;}',
      '.pg-chip{background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:5px 11px;',
      ' font-weight:800;font-size:12.5px;color:var(--ink);}',
      // ---- vue 3 : bataille ----
      '.pg-battleview{display:none;flex-direction:column;gap:8px;flex:1;min-height:0;}',
      '.pg-hud{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:0 0 auto;',
      ' background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--shadow-sm);padding:5px 8px;}',
      '.pg-hud .sp{flex:1;}',
      '.pg-ratio{display:flex;gap:4px;}',
      '.pg-rbtn{cursor:pointer;border-radius:var(--r-sm);padding:4px 8px;font-weight:800;font-size:11.5px;color:var(--ink);',
      ' background:var(--card-solid);border:1px solid var(--line-dark);box-shadow:0 2px 0 var(--line-dark);',
      ' transition:transform .15s var(--jelly);}',
      '.pg-rbtn:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-rbtn.on{background:var(--acc);border-color:var(--acc-dark);box-shadow:0 2px 0 var(--acc-dark);color:#f8f2e4;}',
      '.pg-unit{position:relative;cursor:pointer;padding:1px;background:var(--card-solid);',
      ' border:1px solid var(--line-dark);box-shadow:0 2px 0 var(--line-dark);border-radius:var(--r-sm);',
      ' transition:transform .15s var(--jelly);}',
      '.pg-unit:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-unit.on{border-color:var(--acc-dark);box-shadow:0 2px 0 var(--acc-dark);background:var(--acc-soft);}',
      '.pg-unit .n{position:absolute;bottom:-4px;right:-4px;background:var(--ink);color:#f8f2e4;',
      ' font-weight:800;font-size:9px;border-radius:999px;padding:1px 4px;}',
      '.pg-send{cursor:pointer;border-radius:var(--r-sm);padding:5px 10px;font-weight:800;font-size:12px;',
      ' background:var(--good);border:1px solid var(--good-dark);box-shadow:0 2px 0 var(--good-dark);color:#f8f2e4;',
      ' transition:transform .15s var(--jelly);}',
      '.pg-send:active{transform:translateY(1px);box-shadow:none;} .pg-send:disabled{opacity:.45;cursor:not-allowed;}',
      '.pg-start{cursor:pointer;border-radius:var(--r-sm);padding:6px 12px;font-weight:900;font-size:12px;',
      ' background:var(--acc);border:1px solid var(--acc-dark);box-shadow:0 2px 0 var(--acc-dark);color:#f8f2e4;',
      ' transition:transform .15s var(--jelly);}',
      '.pg-start:active{transform:translateY(1px);box-shadow:none;}',
      '.pg-quit{cursor:pointer;border-radius:var(--r-sm);padding:5px 10px;font-weight:800;font-size:12px;',
      ' background:transparent;border:1px solid var(--bad);color:var(--bad);transition:transform .15s var(--jelly);}',
      '.pg-quit:active{transform:translateY(1px);}',
      '.pg-canvaswrap{flex:1;min-height:340px;border-radius:var(--r-lg);overflow:hidden;',
      ' border:1px solid var(--line-dark);box-shadow:var(--shadow);background:#1e2620;}',
      '.pg-canvaswrap canvas{display:block;width:100%;height:100%;cursor:pointer;touch-action:none;}',
      '.pg-selinfo{font-size:12px;font-weight:700;color:var(--ink-soft);flex:0 0 auto;}',
      '.pg-selinfo.prep{padding:6px 9px;border-left:3px solid var(--acc);background:var(--acc-soft);color:var(--ink);}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // -----------------------------------------------------------
  // Vue 1 : carte globale des villes
  // -----------------------------------------------------------
  let ovCityPos = [];
  let ovIslands = null;



  // dessine la vignette d'une ville : silhouette UNIQUE selon son thème (decor)
  // -> renvoie la ligne de sol (pour placer le texte en dessous)
  function drawCityCluster(g, cx, cy, R, status, city, cityIndex, t) {
    const locked = status.state === 'locked';
    // couleurs de la ville, grisées si verrouillée
    function C(c, d) {
      let col = GD.shade(c, d || 0);
      if (locked) col = GD.mix(col, '#a8a49c', 0.6);
      return col;
    }
    const base = city.theme.g2, acc = city.theme.g1;
    const baseline = cy + R * 0.6;
    const lw = Math.max(1, R * 0.06);

    // halo pulsant si ville courante
    if (status.state === 'current') {
      const fcol = GD.FACTIONS[pf()].acc;
      const pr = R * (2.0 + Math.sin(t * 3) * 0.14);
      const glow = g.createRadialGradient(cx, cy, R * 0.3, cx, cy, pr);
      glow.addColorStop(0, fcol + '4d');
      glow.addColorStop(1, fcol + '00');
      g.fillStyle = glow;
      g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2); g.fill();
    }

    // ombre au sol
    g.fillStyle = 'rgba(40,40,30,0.16)';
    g.beginPath(); g.ellipse(cx, baseline + R * 0.1, R * 1.75, R * 0.36, 0, 0, Math.PI * 2); g.fill();

    // petits helpers de formes (coordonnées en unités de R, ancrées sur baseline)
    function box(dx, w, hh, col, yOff) {
      const bw = w * R, bh = hh * R, bx = cx + dx * R - bw / 2, by = baseline - (yOff || 0) * R - bh;
      g.fillStyle = col; g.fillRect(bx, by, bw, bh);
      g.strokeStyle = C(base, -0.32); g.lineWidth = lw; g.strokeRect(bx, by, bw, bh);
    }
    function roofTri(dx, w, hh, rh, col) {
      const bw = w * R;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx + dx * R - bw / 2, baseline - hh * R);
      g.lineTo(cx + dx * R + bw / 2, baseline - hh * R);
      g.lineTo(cx + dx * R, baseline - (hh + rh) * R);
      g.closePath(); g.fill();
      g.strokeStyle = C(base, -0.32); g.lineWidth = lw; g.stroke();
    }
    function dome(dx, w, col, yOff) {
      g.fillStyle = col;
      g.beginPath();
      g.arc(cx + dx * R, baseline - (yOff || 0) * R, w * R / 2, Math.PI, 0);
      g.closePath(); g.fill();
      g.strokeStyle = C(base, -0.32); g.lineWidth = lw; g.stroke();
    }
    function disc(dx, dyUp, r, col) {
      g.fillStyle = col;
      g.beginPath(); g.arc(cx + dx * R, baseline - dyUp * R, r * R, 0, Math.PI * 2); g.fill();
      g.strokeStyle = C(base, -0.32); g.lineWidth = lw; g.stroke();
    }
    function windows(dx, w, hh, rows) {
      g.fillStyle = locked ? 'rgba(230,230,220,0.4)' : 'rgba(255,240,180,0.75)';
      const bw = w * R;
      for (let r2 = 0; r2 < rows; r2++) {
        for (let c2 = 0; c2 < 2; c2++) {
          g.fillRect(cx + dx * R - bw * 0.28 + c2 * bw * 0.38, baseline - hh * R * (0.82 - r2 * 0.24), bw * 0.17, hh * R * 0.09);
        }
      }
    }

    switch (city.theme.decor) {
      case 'park': // Ronron-les-Bains : dômes de spa + vapeur
        dome(-0.95, 1.0, C(base, 0.08));
        dome(0.05, 1.55, C(base, 0.25));
        dome(1.0, 0.85, C(base, -0.05));
        g.strokeStyle = locked ? 'rgba(240,240,235,0.4)' : 'rgba(255,255,255,0.75)';
        g.lineWidth = lw * 1.4; g.lineCap = 'round';
        for (const sx of [-0.2, 0.3]) {
          const ph = (t * 0.8 + sx) % 1;
          g.globalAlpha = 0.7 - ph * 0.5;
          g.beginPath();
          g.moveTo(cx + sx * R, baseline - (0.85 + ph * 0.5) * R);
          g.quadraticCurveTo(cx + (sx + 0.14) * R, baseline - (1.05 + ph * 0.5) * R, cx + sx * R, baseline - (1.25 + ph * 0.5) * R);
          g.stroke();
        }
        g.globalAlpha = 1;
        break;
      case 'rooftop': // Plumopolis : tours fines très hautes
        box(-1.05, 0.5, 1.5, C(base, 0.12)); windows(-1.05, 0.5, 1.5, 3);
        box(-0.4, 0.55, 2.2, C(base, 0.28)); windows(-0.4, 0.55, 2.2, 4);
        box(0.28, 0.5, 1.8, C(base, -0.02)); windows(0.28, 0.5, 1.8, 3);
        box(0.95, 0.45, 2.5, C(base, 0.18)); windows(0.95, 0.45, 2.5, 4);
        g.strokeStyle = C(base, -0.25); g.lineWidth = lw;
        g.beginPath(); g.moveTo(cx + 0.95 * R, baseline - 2.5 * R); g.lineTo(cx + 0.95 * R, baseline - 2.9 * R); g.stroke();
        break;
      case 'sand': // Croquetteville : maisons basses du désert + croquettes
        box(-1.0, 0.95, 0.75, C(base, 0.2)); dome(-1.0, 0.7, C(base, 0.32), 0.75);
        box(0.05, 1.1, 0.95, C(base, 0.08));
        box(1.05, 0.8, 0.6, C(base, 0.26)); dome(1.05, 0.55, C(base, 0.38), 0.6);
        for (const [ddx, ddy] of [[-0.5, 0.12], [0.6, 0.1], [0.1, 0.2]]) disc(ddx, ddy, 0.09, C('#a5701f', 0.15));
        break;
      case 'sky': // Bec-sur-Ciel : cité perchée sur un piton + nuage
        box(0.1, 0.55, 1.15, C(base, -0.12));                       // piton
        g.fillStyle = C(base, 0.25);
        g.fillRect(cx - 0.85 * R, baseline - 1.4 * R, 1.9 * R, 0.25 * R); // plateforme
        g.strokeStyle = C(base, -0.32); g.lineWidth = lw;
        g.strokeRect(cx - 0.85 * R, baseline - 1.4 * R, 1.9 * R, 0.25 * R);
        box(-0.35, 0.5, 0.75, C(base, 0.35), 1.4); roofTri(-0.35, 0.5, 2.15, 0.35, C(acc, 0.1));
        box(0.45, 0.45, 0.95, C(base, 0.2), 1.4); roofTri(0.45, 0.45, 2.35, 0.3, C(acc, 0.1));
        g.fillStyle = locked ? 'rgba(240,240,238,0.5)' : 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.ellipse(cx - 1.15 * R, baseline - 1.85 * R + Math.sin(t * 1.2) * R * 0.06, 0.5 * R, 0.2 * R, 0, 0, Math.PI * 2);
        g.fill();
        break;
      case 'fortress': { // Griffegrad : muraille crénelée + donjon + drapeau
        box(0, 2.7, 0.85, C(base, 0.05));
        for (let i2 = -2; i2 <= 2; i2++) box(i2 * 0.56, 0.3, 1.02, C(base, 0.12));
        box(0, 0.85, 1.7, C(base, 0.22));
        box(-0.28, 0.22, 1.88, C(base, 0.12)); box(0.28, 0.22, 1.88, C(base, 0.12));
        g.strokeStyle = C(base, -0.3); g.lineWidth = lw;
        g.beginPath(); g.moveTo(cx, baseline - 1.7 * R); g.lineTo(cx, baseline - 2.15 * R); g.stroke();
        g.fillStyle = locked ? '#b8b4aa' : '#e05252';
        const fw = Math.sin(t * 4) * 0.05;
        g.beginPath();
        g.moveTo(cx, baseline - 2.15 * R);
        g.lineTo(cx + (0.42 + fw) * R, baseline - 2.02 * R);
        g.lineTo(cx, baseline - 1.9 * R);
        g.closePath(); g.fill();
        break;
      }
      case 'harbor': // Port-au-Poisson : maisons à toit pointu + voilier
        box(-1.05, 0.7, 0.85, C(base, 0.25)); roofTri(-1.05, 0.7, 0.85, 0.42, C('#b06a4a', locked ? 0 : 0.05));
        box(-0.3, 0.6, 0.62, C(base, 0.38)); roofTri(-0.3, 0.6, 0.62, 0.36, C('#b06a4a', 0.18));
        g.fillStyle = C('#7a5a3a', 0.1);
        g.beginPath(); // coque
        g.moveTo(cx + 0.45 * R, baseline - 0.18 * R);
        g.lineTo(cx + 1.55 * R, baseline - 0.18 * R);
        g.lineTo(cx + 1.3 * R, baseline + 0.12 * R);
        g.lineTo(cx + 0.7 * R, baseline + 0.12 * R);
        g.closePath(); g.fill();
        g.strokeStyle = C(base, -0.3); g.lineWidth = lw;
        g.beginPath(); g.moveTo(cx + R, baseline - 0.18 * R); g.lineTo(cx + R, baseline - 1.05 * R); g.stroke();
        g.fillStyle = locked ? 'rgba(235,235,230,0.6)' : '#f6f2e8';
        g.beginPath();
        g.moveTo(cx + R, baseline - 1.05 * R);
        g.lineTo(cx + (1 + 0.5 + Math.sin(t * 1.5) * 0.04) * R, baseline - 0.45 * R);
        g.lineTo(cx + R, baseline - 0.32 * R);
        g.closePath(); g.fill();
        break;
      case 'meadow': // La Grande Pelote : pelote géante + maisonnettes
        disc(0.45, 0.85, 0.85, C(acc, 0.05));
        g.strokeStyle = C(acc, -0.25); g.lineWidth = lw * 1.3;
        g.beginPath(); g.arc(cx + 0.45 * R, baseline - 0.85 * R, 0.62 * R, Math.PI * 0.15, Math.PI * 0.95); g.stroke();
        g.beginPath(); g.arc(cx + 0.45 * R, baseline - 0.85 * R, 0.5 * R, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        box(-1.05, 0.6, 0.6, C(base, 0.28)); roofTri(-1.05, 0.6, 0.6, 0.32, C(base, -0.05));
        box(-0.45, 0.5, 0.45, C(base, 0.4)); roofTri(-0.45, 0.5, 0.45, 0.26, C(base, 0.05));
        break;
      case 'junkyard': // Cartonnia : cartons empilés avec scotch
        box(-0.65, 1.0, 0.9, C(base, 0.18));
        box(0.5, 0.9, 0.7, C(base, 0.3));
        box(-0.1, 0.85, 0.75, C(base, 0.08), 0.9);
        g.strokeStyle = locked ? 'rgba(220,215,205,0.6)' : 'rgba(245,238,220,0.85)';
        g.lineWidth = lw * 1.8;
        g.beginPath(); g.moveTo(cx - 1.15 * R, baseline - 0.45 * R); g.lineTo(cx - 0.15 * R, baseline - 0.45 * R); g.stroke();
        g.beginPath(); g.moveTo(cx + 0.05 * R, baseline - 0.35 * R); g.lineTo(cx + 0.95 * R, baseline - 0.35 * R); g.stroke();
        g.beginPath(); g.moveTo(cx - 0.52 * R, baseline - 1.28 * R); g.lineTo(cx + 0.32 * R, baseline - 1.28 * R); g.stroke();
        break;
      case 'forest': { // Nid-Royal : arbres + nid douillet
        for (const [tx, th2, cr] of [[-0.95, 0.55, 0.42], [0.05, 0.8, 0.55], [1.0, 0.5, 0.38]]) {
          box(tx, 0.16, th2, C('#7a5a38', 0.05));
          disc(tx, th2 + cr * 0.75, cr, C(acc, 0.12));
        }
        g.strokeStyle = C('#8a6a42', 0.05); g.lineWidth = lw * 1.5;
        g.beginPath(); g.arc(cx + 0.05 * R, baseline - 1.28 * R, 0.2 * R, 0, Math.PI, false); g.stroke();
        g.fillStyle = locked ? '#c8c4ba' : '#f4c542';
        g.beginPath(); g.arc(cx + 0.05 * R, baseline - 1.32 * R, 0.08 * R, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'fishmarket': { // Sardinople : étals + poisson-enseigne doré
        box(-1.0, 0.8, 0.7, C(base, 0.25)); roofTri(-1.0, 0.8, 0.7, 0.35, C(acc, 0.1));
        box(0.05, 0.7, 0.55, C(base, 0.35)); roofTri(0.05, 0.7, 0.55, 0.3, C('#b06a4a', 0.1));
        g.fillStyle = C('#d8b048', 0.05);
        g.beginPath(); g.ellipse(cx + 0.95 * R, baseline - 1.1 * R, 0.55 * R, 0.28 * R, -0.15, 0, Math.PI * 2); g.fill();
        g.strokeStyle = C(base, -0.3); g.lineWidth = lw; g.stroke();
        g.beginPath(); // queue du poisson
        g.moveTo(cx + 1.45 * R, baseline - 1.1 * R);
        g.lineTo(cx + 1.75 * R, baseline - 1.32 * R);
        g.lineTo(cx + 1.75 * R, baseline - 0.9 * R);
        g.closePath(); g.fill(); g.stroke();
        disc(0.72, 1.16, 0.05, C('#2e2620', 0));
        break;
      }
      case 'windmill': { // Vol-au-Vent : moulin à ailes tournantes
        box(-0.95, 0.65, 0.7, C(base, 0.3)); roofTri(-0.95, 0.65, 0.7, 0.32, C(base, 0));
        g.fillStyle = C(base, 0.15);
        g.beginPath();
        g.moveTo(cx + 0.25 * R, baseline);
        g.lineTo(cx + 0.45 * R, baseline - 1.5 * R);
        g.lineTo(cx + 1.05 * R, baseline - 1.5 * R);
        g.lineTo(cx + 1.25 * R, baseline);
        g.closePath(); g.fill();
        g.strokeStyle = C(base, -0.32); g.lineWidth = lw; g.stroke();
        dome(0.75, 0.62, C(acc, 0.05), 1.5);
        const wcx = cx + 0.75 * R, wcy = baseline - 1.62 * R;
        g.strokeStyle = C('#7a5a3a', 0.1); g.lineWidth = lw * 1.6;
        for (let k = 0; k < 4; k++) {
          const an = t * 0.9 + k * Math.PI / 2;
          g.beginPath(); g.moveTo(wcx, wcy);
          g.lineTo(wcx + Math.cos(an) * R * 0.85, wcy + Math.sin(an) * R * 0.85);
          g.stroke();
        }
        break;
      }
      case 'fields': { // Picorama : sillons + ferme + tournesol géant
        g.strokeStyle = C(acc, -0.1); g.lineWidth = lw * 1.4;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(cx - 1.55 * R, baseline - 0.1 * R - k * 0.2 * R);
          g.lineTo(cx + 0.05 * R, baseline - 0.1 * R - k * 0.2 * R);
          g.stroke();
        }
        box(0.75, 0.75, 0.65, C('#b06a4a', 0.15)); roofTri(0.75, 0.75, 0.65, 0.4, C(base, -0.05));
        g.strokeStyle = C('#5a7a3a', 0.1); g.lineWidth = lw * 1.4;
        g.beginPath(); g.moveTo(cx - 0.85 * R, baseline); g.lineTo(cx - 0.85 * R, baseline - 1.0 * R); g.stroke();
        disc(-0.85, 1.15, 0.3, C('#d8b028', 0.1));
        disc(-0.85, 1.15, 0.13, C('#7a5a2a', 0));
        break;
      }
      case 'gears': { // Ferraille-sur-Rouille : usine + engrenage qui tourne
        box(-0.85, 1.0, 0.8, C(base, 0.2)); windows(-0.85, 1.0, 0.8, 1);
        box(-1.25, 0.22, 1.3, C(base, 0.05));
        const gcx = cx + 0.78 * R, gcy = baseline - 0.75 * R, gr = 0.6 * R;
        g.fillStyle = C('#8a8078', 0.1);
        for (let k = 0; k < 8; k++) {
          const an = t * 0.5 + k * Math.PI / 4;
          g.save(); g.translate(gcx, gcy); g.rotate(an);
          g.fillRect(gr - lw, -0.09 * R, 0.22 * R, 0.18 * R);
          g.restore();
        }
        g.beginPath(); g.arc(gcx, gcy, gr, 0, Math.PI * 2); g.fill();
        g.strokeStyle = C(base, -0.3); g.lineWidth = lw; g.stroke();
        g.fillStyle = C(base, 0.35);
        g.beginPath(); g.arc(gcx, gcy, gr * 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
        break;
      }
      case 'cushions': { // Soyeuse-les-Coussins : pile de coussins moelleux
        const cushion = (dx, w2, hh, yOff, col) => {
          const bw = w2 * R, bh = hh * R, bx = cx + dx * R - bw / 2, by = baseline - yOff * R - bh;
          g.fillStyle = col;
          g.beginPath();
          if (g.roundRect) g.roundRect(bx, by, bw, bh, bh * 0.45); else g.rect(bx, by, bw, bh);
          g.fill(); g.strokeStyle = C(base, -0.3); g.lineWidth = lw; g.stroke();
        };
        cushion(0.25, 1.7, 0.5, 0, C(acc, 0.1));
        cushion(0.15, 1.4, 0.45, 0.5, C(base, 0.25));
        cushion(0.35, 1.1, 0.42, 0.95, C(acc, -0.05));
        cushion(0.25, 0.8, 0.38, 1.37, C(base, 0.4));
        box(-1.2, 0.5, 0.9, C(base, 0.2)); roofTri(-1.2, 0.5, 0.9, 0.3, C(base, -0.05));
        break;
      }
      case 'throne': { // Trône-du-Perchoir : trône monumental à pointe dorée
        box(0, 1.5, 0.35, C(base, 0.05));
        box(0, 1.15, 0.3, C(base, 0.15), 0.35);
        box(0, 0.95, 0.75, C(acc, 0.05), 0.65);
        box(0, 0.85, 1.3, C(acc, -0.05), 0.65);
        box(-0.32, 0.2, 0.25, C(acc, 0.1), 1.95);
        box(0, 0.2, 0.4, C('#d8b028', 0.1), 1.95);
        box(0.32, 0.2, 0.25, C(acc, 0.1), 1.95);
        box(-1.15, 0.45, 0.75, C(base, 0.3)); roofTri(-1.15, 0.45, 0.75, 0.3, C(base, 0));
        box(1.15, 0.45, 0.6, C(base, 0.3)); roofTri(1.15, 0.45, 0.6, 0.28, C(base, 0));
        break;
      }
      case 'city': default: // Moustache City : skyline dense
        box(-1.2, 0.55, 1.1, C(base, 0.05)); windows(-1.2, 0.55, 1.1, 2);
        box(-0.6, 0.6, 1.9, C(base, 0.22)); windows(-0.6, 0.6, 1.9, 3);
        box(0.05, 0.55, 1.45, C(base, -0.08)); windows(0.05, 0.55, 1.45, 3);
        box(0.68, 0.6, 2.3, C(base, 0.15)); windows(0.68, 0.6, 2.3, 4);
        box(1.28, 0.5, 0.95, C(base, 0.3)); windows(1.28, 0.5, 0.95, 2);
        break;
    }

    // emoji signature de la ville (identité au premier coup d'œil)
    g.font = Math.round(R * 0.72) + 'px system-ui';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.globalAlpha = locked ? 0.55 : 1;
    g.fillText(city.emoji || '🏘️', cx - R * 1.7, baseline - R * 2.1);
    g.globalAlpha = 1;

    // statut au-dessus de la ville
    const icon = status.state === 'locked' ? '🔒' : status.state === 'done' ? '🏆' : '📍';
    const bob = status.state === 'current' ? Math.sin(t * 2.6) * R * 0.08 : 0;
    g.font = '900 ' + Math.round(R * 0.8) + 'px system-ui';
    g.fillText(icon, cx + R * 0.15, baseline - R * 2.75 + bob);

    return baseline;
  }



  function showOverview() {
    curView = 'overview';
    overviewView.style.display = 'flex';
    missionView.style.display = 'none';
    battleView.style.display = 'none';
    renderWorld();
    if (UI.renderArmyComposition && els.armyComp) UI.renderArmyComposition(els.armyComp);
  }

  function showMission() {
    curView = 'mission';
    overviewView.style.display = 'none';
    missionView.style.display = 'flex';
    battleView.style.display = 'none';
    refreshMission();
  }

  // §D11quinquies : GLOBE pseudo-3D flat — projection orthographique (comme le moteur
  // d'unités), rotation douce, villes plantées d'un drapeau (rouge = en cours,
  // vert = conquise, gris = verrouillée), route du tour en pointillés sur la sphère.
  let globeCv = null, globeG = null, globeHits = [];
  const globeState = { rotBase: null, offset: 0, drag: null };
  const RAD = Math.PI / 180;

  // §D11septies : les villes vivent SUR les continents (2 îles seulement dans le monde).
  // Longitudes STRICTEMENT croissantes ville → ville : les tronçons de route occupent
  // des bandes disjointes et ne peuvent jamais se croiser.
  const GLOBE_CITY_LL = [
    [30, 10], [8, 26], [-14, 34], [-28, 44],       // Griffontinent (ouest)
    [40, 96], [-24, 110], [34, 128], [-28, 144],   // Plumérie du Nord / Terres Australes (zigzag)
    [12, 179],                                     // Île du Perchoir (1re des DEUX îles)
    [14, 206], [-12, 224], [18, 240], [-16, 256],  // Croquettia (équatorial)
    [36, 290], [6, 308], [30, 328],                // Moustachie (est)
  ];
  function cityLL(i) {
    const n = GLOBE_CITY_LL.length;
    const c = GLOBE_CITY_LL[i % n];
    return { lat: c[0] * RAD, lon: (c[1] + Math.floor(i / n) * 360) * RAD };
  }

  // continents MODÉLISÉS : polygones (lat,lon) aux côtes lissées + détails intérieurs
  // (chaînes de montagnes, forêts, lacs). 5 continents + 2 îles, pas une de plus.
  const GLOBE_LANDS = [
    { // Griffontinent — villes 1-4
      col: '#a9b287',
      pts: [[38, 4], [44, 16], [40, 30], [30, 40], [20, 36], [12, 46], [2, 42], [-8, 50], [-20, 46], [-30, 52], [-36, 40], [-32, 26], [-22, 18], [-12, 22], [-4, 12], [6, 16], [16, 8], [28, 0]],
      mts: [[22, 22], [-26, 34]], forest: [[-6, 32], [-24, 40], [33, 12], [14, 40]],
      lakes: [[4, 28], [-18, 30]],
      rivers: [[[21, 21], [13, 25], [5, 21], [-2, 15]], [[-25, 35], [-18, 40], [-12, 45]]],
    },
    { // Plumérie du Nord — villes 5 et 7
      col: '#b6ab79',
      pts: [[52, 88], [56, 104], [50, 122], [42, 138], [30, 148], [22, 136], [26, 120], [18, 108], [26, 94], [38, 84]],
      mts: [[44, 112], [36, 134]], forest: [[33, 99], [28, 126], [44, 128]],
      lakes: [[36, 120]],
      rivers: [[[43, 113], [38, 118], [32, 113], [27, 106]]],
    },
    { // Terres Australes — villes 6 et 8
      col: '#a9b287',
      pts: [[-8, 100], [-16, 116], [-10, 132], [-18, 148], [-30, 160], [-40, 150], [-38, 132], [-28, 118], [-34, 104], [-22, 96]],
      mts: [[-32, 140], [-27, 107]], forest: [[-20, 104], [-16, 122], [-34, 148]],
      lakes: [[-24, 130]],
      rivers: [[[-31, 138], [-25, 133], [-19, 127], [-17, 121]]],
    },
    { // Île du Perchoir — ville 9 (île 1/2)
      col: '#b6ab79',
      pts: [[19, 173], [21, 182], [14, 188], [6, 184], [5, 175], [12, 170]],
      mts: [[10, 176]], forest: [[15, 180]], lakes: [], rivers: [],
    },
    { // Croquettia — villes 10 à 13
      col: '#b6ab79',
      pts: [[20, 196], [30, 210], [24, 228], [32, 244], [20, 260], [6, 266], [-8, 258], [-18, 266], [-28, 254], [-22, 238], [-30, 222], [-18, 208], [-6, 214], [2, 198]],
      mts: [[6, 234], [22, 214], [-20, 244]], forest: [[16, 210], [-20, 250], [24, 250], [-12, 216]],
      lakes: [[-6, 228], [16, 254]],
      rivers: [[[7, 233], [1, 225], [-5, 217], [-13, 212]], [[21, 245], [15, 251], [9, 257], [4, 261]]],
    },
    { // Moustachie — villes 14 à 16
      col: '#a9b287',
      pts: [[48, 282], [52, 298], [44, 314], [50, 330], [38, 342], [24, 334], [16, 322], [4, 336], [-6, 344], [-16, 334], [-10, 318], [-20, 308], [-12, 294], [0, 300], [10, 288], [22, 296], [34, 280]],
      mts: [[38, 302], [22, 312]], forest: [[14, 298], [-4, 328], [42, 324], [28, 288]],
      lakes: [[30, 324], [-8, 308]],
      rivers: [[[37, 301], [30, 306], [23, 301], [16, 295]], [[21, 313], [14, 319], [8, 326], [3, 331]]],
    },
    { // Îlot du Bout-du-Monde — décoratif (île 2/2)
      col: '#a9b287',
      pts: [[-36, 352], [-34, 359], [-40, 363], [-46, 358], [-44, 350]],
      mts: [], forest: [[-40, 356]], lakes: [], rivers: [],
    },
  ];

  // nuages : dérivent lentement PAR RAPPORT au sol (vitesse propre en rad/s)
  const GLOBE_CLOUDS = [
    { la: 34, lo: 60, s: 1.1, v: 0.014 }, { la: -16, lo: 74, s: 0.9, v: 0.010 },
    { la: 8, lo: 158, s: 1.2, v: 0.017 }, { la: -38, lo: 195, s: 0.85, v: 0.012 },
    { la: 46, lo: 226, s: 1.0, v: 0.009 }, { la: -6, lo: 292, s: 1.15, v: 0.015 },
    { la: 20, lo: 346, s: 0.9, v: 0.011 }, { la: -28, lo: 20, s: 0.8, v: 0.013 },
  ];

  function drawGlobe(t) {
    if (!globeCv || !els.world) return;
    const cssW = els.world.clientWidth, cssH = els.world.clientHeight;
    if (cssW < 60 || cssH < 60) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(cssW * DPR), bh = Math.round(cssH * DPR);
    if (globeCv.width !== bw || globeCv.height !== bh) {
      globeCv.width = bw; globeCv.height = bh;
      globeCv.style.width = cssW + 'px'; globeCv.style.height = cssH + 'px';
    }
    const g = globeG;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, cssW, cssH);
    const s = st();
    const stage = s.progression.stage || 1;
    const curIdx = GD.expeditionZoneIndex(stage);
    if (globeState.rotBase == null) globeState.rotBase = -cityLL(curIdx).lon - t * 0.05;
    const rot = globeState.rotBase + globeState.offset + t * 0.05; // rotation douce
    const tilt = -0.3, cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    const R = Math.min(cssW * 0.36, cssH * 0.36), cx = cssW * 0.5, cy = cssH * 0.5;
    const INK = 'rgba(46,38,32,';
    function proj(lat, lon) {
      const cl = Math.cos(lat);
      const x = cl * Math.sin(lon + rot), y = Math.sin(lat), z = cl * Math.cos(lon + rot);
      const y2 = y * cosT - z * sinT, z2 = y * sinT + z * cosT;
      return { sx: cx + x * R, sy: cy - y2 * R, z: z2, x, y2 };
    }
    // point derrière l'horizon → rabattu sur le limbe (silhouette propre des continents)
    function projClip(lat, lon) {
      const p = proj(lat, lon);
      if (p.z <= 0) {
        const m = Math.hypot(p.x, p.y2) || 1e-6;
        p.sx = cx + (p.x / m) * R; p.sy = cy - (p.y2 / m) * R;
      }
      return p;
    }

    // océan + contour woodcut
    g.fillStyle = '#94aebb';
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // quartier d'ombre flat sur le bord droit (volume sans dégradé)
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(46,38,32,.07)';
    g.beginPath(); g.arc(cx + R * 0.35, cy - R * 0.1, R * 1.05, 0, Math.PI * 2);
    g.rect(cx - R, cy - R, 2 * R, 2 * R);
    g.fill('evenodd');
    g.restore();

    // graticule : parallèles + méridiens (échantillonnés, faces visibles)
    g.strokeStyle = INK + '.10)'; g.lineWidth = 1.2;
    const drawSampled = pts => {
      let open = false;
      g.beginPath();
      for (const p of pts) {
        if (p.z > 0.01) { open ? g.lineTo(p.sx, p.sy) : g.moveTo(p.sx, p.sy); open = true; }
        else open = false;
      }
      g.stroke();
    };
    for (const la of [-60, -30, 0, 30, 60]) {
      const pts = []; for (let k = 0; k <= 60; k++) pts.push(proj(la * RAD, k / 60 * Math.PI * 2));
      drawSampled(pts);
    }
    for (let lo = 0; lo < 360; lo += 30) {
      const pts = []; for (let k = 0; k <= 40; k++) pts.push(proj((-90 + k / 40 * 180) * RAD, lo * RAD));
      drawSampled(pts);
    }

    // vaguelettes 〰 sur l'océan (fixées à la sphère, tournent avec elle)
    g.strokeStyle = INK + '.14)'; g.lineWidth = 1.3;
    for (let i = 0; i < 16; i++) {
      const p = proj((-52 + (i * 47) % 104) * RAD, (i * 83 % 360) * RAD);
      if (p.z <= 0.15) continue;
      const ws = (0.6 + 0.4 * p.z) * R * 0.045;
      g.beginPath(); g.arc(p.sx - ws * 0.6, p.sy, ws * 0.55, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke();
      g.beginPath(); g.arc(p.sx + ws * 0.6, p.sy, ws * 0.55, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke();
    }

    // §D11septies : CONTINENTS modélisés — côtes lissées (quadratiques par points
    // médians), silhouette rabattue au limbe, puis lacs, chaînes de montagnes, forêts.
    for (const land of GLOBE_LANDS) {
      const pv = land.pts.map(v => projClip(v[0] * RAD, v[1] * RAD));
      let maxZ = -1;
      for (const p of pv) if (p.z > maxZ) maxZ = p.z;
      if (maxZ <= 0.04) continue;
      g.globalAlpha = Math.min(1, maxZ * 1.6);
      g.fillStyle = land.col;
      g.strokeStyle = INK + '.30)'; g.lineWidth = 1.5; g.lineJoin = 'round';
      const n2 = pv.length;
      const mid = (a2, b3) => ({ x: (a2.sx + b3.sx) / 2, y: (a2.sy + b3.sy) / 2 });
      g.beginPath();
      let m0 = mid(pv[n2 - 1], pv[0]);
      g.moveTo(m0.x, m0.y);
      for (let k = 0; k < n2; k++) {
        const m1 = mid(pv[k], pv[(k + 1) % n2]);
        g.quadraticCurveTo(pv[k].sx, pv[k].sy, m1.x, m1.y);
      }
      g.closePath(); g.fill(); g.stroke();
      // rivières : des hauteurs vers la côte, courbes lissées
      for (const rv of (land.rivers || [])) {
        const rp = rv.map(v => proj(v[0] * RAD, v[1] * RAD));
        let mz = -1;
        for (const p of rp) if (p.z > mz) mz = p.z;
        if (mz <= 0.10) continue;
        g.strokeStyle = '#94aebb'; g.lineWidth = 1.7; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(rp[0].sx, rp[0].sy);
        for (let k = 1; k < rp.length - 1; k++) {
          g.quadraticCurveTo(rp[k].sx, rp[k].sy, (rp[k].sx + rp[k + 1].sx) / 2, (rp[k].sy + rp[k + 1].sy) / 2);
        }
        g.lineTo(rp[rp.length - 1].sx, rp[rp.length - 1].sy);
        g.stroke();
      }
      // lacs
      for (const lk of (land.lakes || [])) {
        const p = proj(lk[0] * RAD, lk[1] * RAD);
        if (p.z <= 0.12) continue;
        const ls = 0.7 + 0.3 * p.z;
        g.fillStyle = '#94aebb'; g.strokeStyle = INK + '.25)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(p.sx, p.sy, R * 0.045 * ls, R * 0.028 * ls, 0.3, 0, Math.PI * 2);
        g.fill(); g.stroke();
      }
      // chaîne de montagnes : 3 sommets, neige sur le plus haut
      for (const mt of (land.mts || [])) {
        const p = proj(mt[0] * RAD, mt[1] * RAD);
        if (p.z <= 0.12) continue;
        const ds = (0.75 + 0.3 * p.z) * R * 0.05;
        g.fillStyle = '#8d8672'; g.strokeStyle = INK + '.35)'; g.lineWidth = 1;
        for (const mk of [[-0.9, 0.62], [0.85, 0.72], [0, 1]]) {
          const bx = p.sx + mk[0] * ds, hh = ds * mk[1];
          g.beginPath();
          g.moveTo(bx - hh * 0.85, p.sy + ds * 0.45);
          g.lineTo(bx + hh * 0.85, p.sy + ds * 0.45);
          g.lineTo(bx, p.sy + ds * 0.45 - hh * 1.3);
          g.closePath(); g.fill(); g.stroke();
        }
        g.fillStyle = '#eef0ea';
        g.beginPath();
        g.moveTo(p.sx - ds * 0.26, p.sy + ds * 0.45 - ds * 0.82);
        g.lineTo(p.sx + ds * 0.26, p.sy + ds * 0.45 - ds * 0.82);
        g.lineTo(p.sx, p.sy + ds * 0.45 - ds * 1.3);
        g.closePath(); g.fill();
      }
      // forêt : bosquet de 4 frondaisons
      for (const fo of (land.forest || [])) {
        const p = proj(fo[0] * RAD, fo[1] * RAD);
        if (p.z <= 0.12) continue;
        const ds = (0.75 + 0.3 * p.z) * R * 0.022;
        g.fillStyle = '#7d9464'; g.strokeStyle = INK + '.25)'; g.lineWidth = 0.8;
        for (const fk of [[-1.1, 0.2, 1], [0, -0.5, 1.25], [1.1, 0.3, 0.95], [0.3, 0.8, 0.85]]) {
          g.beginPath();
          g.arc(p.sx + fk[0] * ds * 1.4, p.sy + fk[1] * ds * 1.4, ds * fk[2], 0, Math.PI * 2);
          g.fill(); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }

    // calottes polaires
    for (const pole of [1, -1]) {
      const ring = [];
      for (let k = 0; k <= 36; k++) ring.push(projClip(pole * 72 * RAD, k / 36 * 360 * RAD));
      let maxZ = -1;
      for (const p of ring) if (p.z > maxZ) maxZ = p.z;
      if (maxZ <= 0.04) continue;
      g.globalAlpha = Math.min(1, maxZ * 1.6);
      g.fillStyle = '#e2e6dc'; g.strokeStyle = INK + '.22)'; g.lineWidth = 1.3;
      g.beginPath();
      ring.forEach((p, k) => { k ? g.lineTo(p.sx, p.sy) : g.moveTo(p.sx, p.sy); });
      g.closePath(); g.fill(); g.stroke();
      g.globalAlpha = 1;
    }

    // route du tour : courbes SINUEUSES sur la sphère. La longitude est strictement
    // croissante d'une ville à la suivante (bandes disjointes) → deux tronçons ne
    // peuvent JAMAIS se croiser, on voyage sans jamais recouper la route.
    g.strokeStyle = INK + '.34)'; g.lineWidth = 2; g.lineCap = 'round';
    g.setLineDash([2, 7]);
    const nC = GD.CITIES.length;
    for (let i = 0; i + 1 < nC; i++) { // la route S'ARRÊTE à la dernière ville (pas de bouclage)
      const a = cityLL(i), b2 = cityLL(i + 1);
      const bend = (i % 2 ? -1 : 1) * (5 + (i * 37) % 5) * RAD; // sinuosité déterministe
      const pts = [];
      for (let k = 0; k <= 18; k++) {
        const u = k / 18;
        const lat = a.lat + (b2.lat - a.lat) * u + Math.sin(u * Math.PI) * bend;
        pts.push(proj(lat, a.lon + (b2.lon - a.lon) * u));
      }
      drawSampled(pts);
    }
    g.setLineDash([]);

    // nuages : puffs flat qui dérivent au-dessus du terrain (sous les drapeaux)
    for (const cl2 of GLOBE_CLOUDS) {
      const p = proj(cl2.la * RAD, cl2.lo * RAD + t * cl2.v);
      if (p.z <= 0.05) continue;
      const cs = (0.7 + 0.4 * p.z) * cl2.s * R * 0.052;
      g.globalAlpha = Math.min(1, p.z * 1.8) * 0.82;
      // contour d'UNION : silhouette encre un poil plus large SOUS le blanc —
      // un seul bord extérieur, les puffs internes restent invisibles.
      const puffs = dr => {
        g.beginPath();
        g.ellipse(p.sx, p.sy, cs + dr, cs * 0.62 + dr, 0, 0, Math.PI * 2);
        g.ellipse(p.sx - cs * 0.8, p.sy + cs * 0.18, cs * 0.62 + dr, cs * 0.42 + dr, 0, 0, Math.PI * 2);
        g.ellipse(p.sx + cs * 0.85, p.sy + cs * 0.15, cs * 0.55 + dr, cs * 0.4 + dr, 0, 0, Math.PI * 2);
        g.fill();
      };
      g.fillStyle = INK + '.16)'; puffs(1.3);
      g.fillStyle = '#f6f4ec'; puffs(0);
      g.globalAlpha = 1;
    }

    // villes : drapeau planté, tri arrière -> avant
    globeHits = [];
    const cities = GD.CITIES.map((city, index) => {
      const ll = cityLL(index);
      return { city, index, p: proj(ll.lat, ll.lon), status: GD.cityStatus(stage, index) };
    }).filter(c => c.p.z > 0.02).sort((c1, c2) => c1.p.z - c2.p.z);
    const FLAG_COLS = {
      current: ['#a83a2e', '#6d251c'],
      done: ['#5a7a4a', '#435c37'],
      locked: ['#a09a8c', '#6f6152'],
    };
    for (const c of cities) {
      const sc = 0.72 + 0.38 * c.p.z;
      const x = c.p.sx, y = c.p.sy;
      const stt = c.status.state;
      const cols = FLAG_COLS[stt] || FLAG_COLS.locked;
      const wave = stt === 'current' ? Math.sin(t * 3.2) * 1.4 * sc : 0;
      const h = 19 * sc, fw = 13 * sc, fh = 8 * sc;
      // socle
      g.fillStyle = '#e9dfc6'; g.strokeStyle = INK + '.6)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(x, y, 3 * sc, 1.8 * sc, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      // mât + pommeau doré
      g.strokeStyle = INK + '.85)'; g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
      g.fillStyle = '#c9a44a'; g.strokeStyle = INK + '.6)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y - h, 1.7 * sc, 0, Math.PI * 2); g.fill(); g.stroke();
      // fanion à queue d'aronde (flotte pour la ville en cours)
      g.fillStyle = cols[0]; g.strokeStyle = cols[1]; g.lineWidth = 1.2; g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(x + 1 * sc, y - h + 0.6 * sc);
      g.lineTo(x + fw, y - h + 0.6 * sc + wave);
      g.lineTo(x + fw - 3.6 * sc, y - h + 0.6 * sc + fh * 0.5 + wave * 0.6);
      g.lineTo(x + fw, y - h + 0.6 * sc + fh + wave * 0.3);
      g.lineTo(x + 1 * sc, y - h + 0.6 * sc + fh);
      g.closePath(); g.fill(); g.stroke();
      // liseré clair côté mât (relief flat)
      g.strokeStyle = 'rgba(248,242,228,.5)'; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 2 * sc, y - h + 1.6 * sc);
      g.lineTo(x + 2 * sc, y - h + fh - 0.4 * sc);
      g.stroke();
      // nom (halo papier pour rester lisible sur l'océan)
      if (c.p.z > 0.22) {
        const fs = Math.max(9, Math.round(10.5 * sc));
        g.font = '800 ' + fs + 'px Nunito, system-ui';
        g.textAlign = 'center'; g.textBaseline = 'top';
        g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = '#efe6d2';
        g.strokeText(c.city.name, x, y + 4);
        g.fillStyle = stt === 'locked' ? INK + '.45)' : INK + '.85)';
        g.fillText(c.city.name, x, y + 4);
      }
      globeHits.push({ x, y: y - h * 0.5, r: 16 * sc, index: c.index });
    }
  }

  function globeCityClick(index) {
    const status = GD.cityStatus(st().progression.stage || 1, index);
    const city = GD.CITIES[index];
    FX.sfx('click');
    if (status.state === 'current') showMission();
    else if (status.state === 'done') UI.toast('🏆 ' + city.name + ' — déjà conquise' + (status.laps > 1 ? ' ×' + status.laps : '') + ' !', { icon: '✓', cls: 'good' });
    else UI.toast('🔒 Terminez les villes précédentes pour atteindre ' + city.name + '.', { icon: '🔒' });
  }

  function renderWorld() {
    if (!els.world) return;
    const wrap = els.world;
    wrap.innerHTML = '';
    globeHits = [];
    globeState.rotBase = null; // recadrera la ville courante face au joueur
    globeState.offset = 0;
    globeCv = document.createElement('canvas');
    globeCv.className = 'pg-globe';
    globeG = globeCv.getContext('2d');
    globeCv.addEventListener('pointerdown', e => {
      globeState.drag = { x: e.clientX, moved: 0 };
      globeCv.classList.add('drag');
      if (globeCv.setPointerCapture) try { globeCv.setPointerCapture(e.pointerId); } catch (err) { }
    });
    globeCv.addEventListener('pointermove', e => {
      const d = globeState.drag;
      if (!d) return;
      const dx = e.clientX - d.x;
      d.x = e.clientX; d.moved += Math.abs(dx);
      globeState.offset += dx * 0.006;
    });
    globeCv.addEventListener('pointerup', e => {
      const d = globeState.drag;
      globeState.drag = null;
      globeCv.classList.remove('drag');
      if (d && d.moved > 6) return; // c'était un drag, pas un clic
      const rect = globeCv.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      for (let k = globeHits.length - 1; k >= 0; k--) {
        const h2 = globeHits[k];
        if (Math.hypot(h2.x - x, h2.y - y) <= h2.r + 4) { globeCityClick(h2.index); return; }
      }
    });
    wrap.appendChild(globeCv);

    // carte focus : la ville courante en illustration + bouton d'entrée
    const s = st();
    const stage = s.progression.stage || 1;
    const idx = GD.expeditionZoneIndex(stage);
    const city = GD.CITIES[idx];
    const status = GD.cityStatus(stage, idx);
    const card = document.createElement('div');
    card.className = 'pg-cityfocus';
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const CW = 180, CH = 96;
    const cv = document.createElement('canvas');
    cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
    const cg = cv.getContext('2d');
    cg.scale(DPR, DPR);
    drawCityCluster(cg, CW / 2, CH * 0.58, 21, status, city, idx, 0);
    card.appendChild(cv);
    const name = document.createElement('div');
    name.className = 'pg-cardname';
    name.textContent = city.name;
    const sub = document.createElement('div');
    sub.className = 'pg-cardsub';
    sub.textContent = '📍 étape ' + ((status.depth || 0) + 1) + '/' + GD.EXPEDITION_TREE_DEPTH;
    const btn = document.createElement('button');
    btn.className = 'pg-enter';
    btn.textContent = '⚔️ Entrer dans la ville';
    btn.addEventListener('click', () => { FX.sfx('click'); showMission(); });
    card.appendChild(name); card.appendChild(sub); card.appendChild(btn);
    wrap.appendChild(card);
    drawGlobe(pgTime);
  }

  // §D11quater : parcours de ville en ZIGZAG (serpentin vertical) — points reliés en
  // pointillés + petits détails urbains MODÉLISÉS dans le style flat woodcut.
  const PATH_DECOS = ['trash', 'tree', 'house', 'bench', 'lamp', 'fountain', 'crate', 'bush', 'sign', 'barrel'];

  // §D11quinquies : mini-illustrations canvas (fill mat + trait encre), pas d'emoji.
  function decorCanvas(kind) {
    const S = 44, DPR = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.width = S * DPR; cv.height = S * DPR;
    cv.style.width = S + 'px'; cv.style.height = S + 'px';
    const g = cv.getContext('2d');
    g.scale(DPR, DPR);
    const ink = 'rgba(46,38,32,.72)';
    g.strokeStyle = ink; g.lineWidth = 1.5; g.lineJoin = 'round'; g.lineCap = 'round';
    const fillS = (col, path) => { g.fillStyle = col; path(); g.fill(); g.stroke(); };
    const rect = (x, y, w, h) => { g.beginPath(); g.rect(x, y, w, h); };
    const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); };
    // ombre au sol commune
    g.fillStyle = 'rgba(46,38,32,.10)';
    g.beginPath(); g.ellipse(22, 37, 13, 3, 0, 0, Math.PI * 2); g.fill();
    switch (kind) {
      case 'trash': // poubelle renversée, couvercle à côté, épluchures
        g.save(); g.translate(19, 31); g.rotate(1.35);
        fillS('#8f979c', () => rect(-5, -9, 10, 17));
        g.strokeStyle = ink; g.beginPath(); g.moveTo(-5, -4); g.lineTo(5, -4); g.stroke();
        g.beginPath(); g.moveTo(-5, 1); g.lineTo(5, 1); g.stroke();
        g.restore();
        fillS('#a8b0b5', () => { g.beginPath(); g.ellipse(33, 34, 5, 2.2, -0.35, 0, Math.PI * 2); });
        fillS('#c8b060', () => disc(30, 28, 1.6));
        fillS('#a8c070', () => disc(9, 34, 1.8));
        break;
      case 'tree': // arbre de parc
        fillS('#8a6a44', () => rect(20, 23, 4, 13));
        fillS('#8fa471', () => disc(22, 16, 9.5));
        fillS('#9db07f', () => disc(15.5, 21.5, 5));
        break;
      case 'house': // maisonnette
        fillS('#c9b691', () => rect(11, 20, 22, 15));
        fillS('#a8694a', () => { g.beginPath(); g.moveTo(8, 20); g.lineTo(36, 20); g.lineTo(22, 9); g.closePath(); });
        fillS('#7a5a3a', () => rect(19, 27, 6, 8));
        fillS('#e8dcb8', () => rect(14, 23, 5, 5));
        break;
      case 'bench': // banc public
        fillS('#7a5a3a', () => rect(13, 28, 3, 8));
        fillS('#7a5a3a', () => rect(28, 28, 3, 8));
        fillS('#a87c50', () => rect(10, 25.5, 24, 4));
        fillS('#a87c50', () => rect(10, 16, 24, 3));
        g.beginPath(); g.moveTo(12, 19); g.lineTo(12, 25.5); g.moveTo(32, 19); g.lineTo(32, 25.5); g.stroke();
        break;
      case 'lamp': // lampadaire
        g.fillStyle = 'rgba(232,200,106,.30)';
        g.beginPath(); g.arc(22, 10, 7.5, 0, Math.PI * 2); g.fill();
        fillS('#5c5448', () => rect(20.7, 12, 2.6, 23));
        fillS('#5c5448', () => rect(17, 33.5, 10, 2.5));
        fillS('#e8c86a', () => disc(22, 10, 3.6));
        break;
      case 'fountain': // fontaine
        fillS('#9fb2bc', () => { g.beginPath(); g.ellipse(22, 32, 12, 4.2, 0, 0, Math.PI * 2); });
        fillS('#b4c2ca', () => rect(19.5, 21, 5, 10));
        fillS('#9fb2bc', () => { g.beginPath(); g.ellipse(22, 20, 6.5, 2.6, 0, 0, Math.PI * 2); });
        g.strokeStyle = 'rgba(130,170,190,.9)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(17, 21); g.quadraticCurveTo(13, 25, 14, 29); g.stroke();
        g.beginPath(); g.moveTo(27, 21); g.quadraticCurveTo(31, 25, 30, 29); g.stroke();
        break;
      case 'crate': // caisse en bois
        fillS('#b08c58', () => rect(12, 21, 20, 15));
        g.beginPath(); g.moveTo(12, 21); g.lineTo(32, 36); g.moveTo(32, 21); g.lineTo(12, 36); g.stroke();
        break;
      case 'bush': // buisson fleuri
        fillS('#8fa471', () => disc(17, 30, 6.5));
        fillS('#9db07f', () => disc(26, 29, 7.5));
        fillS('#8fa471', () => disc(22, 33, 6));
        fillS('#c86a7a', () => disc(19, 27, 1.5));
        fillS('#c8a03a', () => disc(27, 25, 1.5));
        break;
      case 'sign': // panneau d'affichage
        fillS('#7a5a3a', () => rect(20.7, 18, 2.6, 18));
        fillS('#c9b691', () => rect(12, 9, 20, 12));
        g.beginPath(); g.moveTo(15, 13); g.lineTo(29, 13); g.moveTo(15, 17); g.lineTo(25, 17); g.stroke();
        break;
      case 'barrel': default: // tonneau
        fillS('#a87848', () => {
          g.beginPath();
          if (g.roundRect) g.roundRect(15, 20, 14, 16, 4); else g.rect(15, 20, 14, 16);
        });
        g.beginPath(); g.moveTo(15, 25); g.lineTo(29, 25); g.moveTo(15, 31); g.lineTo(29, 31); g.stroke();
        break;
    }
    return cv;
  }
  function renderPath() {
    if (!els.path) return;
    const s = st();
    const stage = s.progression.stage || 1;
    const depth = GD.expeditionDepth(stage);
    const rows = getTree(); // arbre linéaire : rows[i] = [nœud]
    const nR = rows.length;
    const wrap = els.path;
    wrap.innerHTML = '';
    const W = Math.max(300, (treeWrap.clientWidth || 620) - 2);
    const perRow = W < 470 ? 3 : 4;
    const nRows = Math.ceil(nR / perRow);
    const padX = 58, padY = 46, rowH = 92;
    const H = padY * 2 + (nRows - 1) * rowH;
    wrap.style.height = H + 'px';
    const colW = (W - padX * 2) / Math.max(1, perRow - 1);

    // positions serpentin : une rangée sur deux va de droite à gauche
    const pts = [];
    for (let i = 0; i < nR; i++) {
      const r = Math.floor(i / perRow);
      let c = i % perRow;
      if (r % 2 === 1) c = perRow - 1 - c;
      pts.push({ x: padX + c * colW, y: padY + r * rowH, row: r });
    }

    // chemin pointillé (SVG) passant par tous les points ; la portion parcourue en vert
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    const dTo = n => pts.slice(0, n + 1).map((p, i) => (i ? 'L ' : 'M ') + p.x + ' ' + p.y).join(' ');
    const mkPath = (n, stroke, width, op) => {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('d', dTo(n)); el.setAttribute('fill', 'none');
      el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', width);
      el.setAttribute('stroke-dasharray', '2 8'); el.setAttribute('stroke-linecap', 'round');
      el.setAttribute('opacity', op);
      svg.appendChild(el);
    };
    mkPath(nR - 1, 'var(--line-dark, #8a7a5e)', 3, '.5');
    if (depth > 0) mkPath(Math.min(depth, nR - 1), 'var(--good, #5a7a4a)', 3.5, '.9');
    wrap.appendChild(svg);

    // détails urbains MODÉLISÉS : dans les virages + quelques-uns en bord de route
    const rnd = mulberry32(GD.expeditionZoneIndex(stage) * 97 + cityLap() * 13 + 3);
    const deco = (x, y) => {
      const d = document.createElement('div');
      d.className = 'pg-decor';
      d.appendChild(decorCanvas(PATH_DECOS[Math.floor(rnd() * PATH_DECOS.length)]));
      d.style.left = x + 'px'; d.style.top = y + 'px';
      d.style.transform = 'translate(-50%,-50%) rotate(' + Math.round((rnd() - 0.5) * 10) + 'deg)';
      wrap.appendChild(d);
    };
    for (let i = 0; i + 1 < nR; i++) {
      if (pts[i].row !== pts[i + 1].row) { // virage : à l'extérieur de la courbe
        const side = pts[i].x > W / 2 ? 1 : -1;
        deco(pts[i].x + side * 36, (pts[i].y + pts[i + 1].y) / 2);
      } else if (rnd() < 0.4) { // bord de route entre deux points
        deco((pts[i].x + pts[i + 1].x) / 2, pts[i].y + (rnd() < 0.5 ? -30 : 30));
      }
    }

    // les étapes
    for (let i = 0; i < nR; i++) {
      const node = rows[i][0];
      const state = i < depth ? 'done' : i === depth ? 'current' : 'locked';
      const isBoss = node && node.type === 'boss';
      const stEl = document.createElement('div');
      stEl.className = 'pg-st ' + state + (isBoss ? ' boss' : '');
      stEl.style.left = pts[i].x + 'px';
      stEl.style.top = pts[i].y + 'px';
      const dot = document.createElement('div');
      dot.className = 'pg-dot';
      dot.textContent = state === 'done' ? '✓' : nodeMeta(node).icon;
      stEl.appendChild(dot);
      const label = document.createElement('div');
      label.className = 'pg-stlabel';
      label.textContent = isBoss ? 'Boss' : (state === 'current' ? 'Étape ' + (i + 1) : String(i + 1));
      // au virage, le pointillé vertical arrive PAR LE HAUT : on décale le chiffre de côté
      if (i > 0 && pts[i - 1].row !== pts[i].row) {
        const side = pts[i].x > W / 2 ? 1 : -1;
        label.style.transform = 'translateX(-50%) translateX(' + side * 30 + 'px)';
      }
      stEl.appendChild(label);
      if (state === 'current') dot.addEventListener('click', () => { FX.sfx('click'); openRewardChoice(node); });
      wrap.appendChild(stEl);
    }
  }

  // §D11 : popup de CHOIX DE RÉCOMPENSE (remplace le choix de route sur la carte).
  function openRewardChoice(node) {
    const stage = st().progression.stage || 1;
    const meta = nodeMeta(node);
    if (node.type === 'boss') {
      const rw = GD.stageRewards(stage);
      let chips = '';
      for (const k in rw) chips += '<span class="pg-chip">+' + UI.fmt(rw[k]) + ' ' + UI.res(k).icon + '</span>';
      UI.popup({
        title: '👑 Boss de région — ' + GD.stageCity(stage).name,
        html: '<div style="text-align:center"><div style="font-size:40px">👑</div>' +
          '<p style="font-weight:800;margin:6px 0">Assaut final ! Victoire = ville conquise et zone suivante débloquée.</p>' +
          '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0">' + chips + '</div></div>',
        buttons: [
          { label: 'Pas encore', cls: 'ghost', cb: () => { } },
          { label: '⚔️ À l’assaut !', cls: 'primary', cb: () => launch(node, 'boss') },
        ],
      });
      return;
    }
    const elite = node.type === 'elite';
    let list = '';
    GD.EXPEDITION_CHOICES.forEach(c => {
      const rw = GD.choiceRewards(stage, c);
      if (elite) for (const k in rw) rw[k] = Math.round(rw[k] * ELITE_MULT);
      let chips = '';
      for (const k in rw) chips += '<span class="pg-fchip">+' + UI.fmt(rw[k]) + ' ' + UI.res(k).icon + '</span>';
      list += '<div class="pg-lootrow" style="cursor:default">' +
        '<span class="ic">' + c.icon + '</span>' +
        '<span class="tx"><b>' + c.label + '</b><small>' + c.desc + '</small></span>' +
        '<span class="rw">' + chips + '</span></div>';
    });
    const buttons = GD.EXPEDITION_CHOICES.map(c => ({
      label: c.icon + ' ' + c.label, cls: 'primary', cb: () => launch(node, c.id),
    }));
    buttons.unshift({ label: 'Pas encore', cls: 'ghost', cb: () => { } });
    UI.popup({
      title: meta.icon + ' ' + meta.label + ' — étape ' + (node.row + 1) +
        (elite ? ' · butin ×' + String(ELITE_MULT).replace('.', ',') : ''),
      html: '<p style="text-align:center;font-size:13px;opacity:.82;margin:2px 0 8px">Même bataille — <b>choisissez votre butin</b> :</p>' +
        '<div class="pg-lootlist">' + list + '</div>',
      buttons,
    });
  }

  // -----------------------------------------------------------
  // Vue 2 : arbre d'expédition façon Slay the Spire — HORIZONTAL
  // (gauche -> droite, colonnes = étapes, voies exclusives)
  // -----------------------------------------------------------
  const NODE_META = {
    fight: { icon: '⚔️', label: 'Escarmouche' },
    elite: { icon: '💀', label: 'Élite' },
    boss: { icon: '👑', label: 'Boss de région' },
  };
  // les vieux arbres pouvaient contenir des 'event' : traités comme des combats
  function nodeMeta(n) { return NODE_META[n.type] || NODE_META.fight; }
  const TREE_COL_W = 118, TREE_PAD = 34;
  const INK = '#5a4430';

  function cityLap() {
    const stage = st().progression.stage || 1;
    return GD.cityStatus(stage, GD.expeditionZoneIndex(stage)).laps || 0;
  }

  function getTree() {
    const stage = st().progression.stage || 1;
    const ci = GD.expeditionZoneIndex(stage);
    const key = ci + '|' + cityLap();
    if (treeCache.key !== key) treeCache = { key, rows: GD.expTree(ci, cityLap()) };
    return treeCache.rows;
  }







  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }








  function refreshMission() {
    const s = st();
    ensurePath();
    const stage = s.progression.stage || 1;
    const city = GD.stageCity(stage);
    const depth = GD.expeditionDepth(stage);

    els.stageTitle.textContent = city.name;
    els.stageNum.textContent = 'Étape ' + (depth + 1) + ' / ' + GD.EXPEDITION_TREE_DEPTH + '  ·  niveau ' + stage;
    els.stageDesc.textContent = city.desc + ' — ' + GOOFY_BRIEFS[(stage - 1) % GOOFY_BRIEFS.length];

    els.note.textContent = '💪 Chaque victoire : +' + Math.round(GD.STAGE_BONUS_PER_WIN * 100) +
      ' % de puissance pour votre camp à ' + city.name + ' (max ' + Math.round(GD.STAGE_BONUS_CAP * 100) + ' %).';
    // stock réellement déployable (les ouvriers affectés ne comptent pas)
    let army = 0;
    if (GameState.availableArmy) {
      for (const t of (GD.UNIT_ORDER || [])) army += GameState.availableArmy(t);
    } else {
      army = GameState.armyTotal();
    }
    if (army > 0) {
      els.note.textContent += ' 🎒 ' + UI.fmt(army) + ' unité(s) déployables en renfort.';
    }
    renderPath();
  }

  // NB : s.progression.cleared (historique du défunt mode farm) reste dans la save
  // pour compatibilité, mais n'est plus alimenté ni lu.

  // avance la position dans l'arbre (après victoire)
  // -> renvoie true si on change de ville
  function advanceTo(node) {
    const s = st();
    ensurePath();
    s.progression.path[node.row] = node.id;
    s.progression.nodeId = node.id;
    const stage = s.progression.stage || 1;
    const zoneChange = GD.isZoneTransition(stage, stage + 1);
    s.progression.stage = stage + 1;
    s.progression.bestStage = Math.max(s.progression.bestStage || 0, stage);
    if (zoneChange) {
      s.progression.path = [];
      s.progression.nodeId = null;
      treeCache.key = null;
    }
    s.lifetime.stages = (s.lifetime.stages || 0) + 1;
    GameState.save();
    GameState.notify();
    return zoneChange;
  }

  // -----------------------------------------------------------
  // Lancement des batailles (nœud d'arbre)
  // -----------------------------------------------------------
  function nodeChoice(node, stage, overrideId) {
    if (node.type === 'boss') return GD.expeditionChoices(stage)[0];
    const cid = overrideId || node.choiceId;
    const base = GD.EXPEDITION_CHOICES.find(c => c.id === cid) || GD.EXPEDITION_CHOICES[0];
    const elite = node.type === 'elite';
    const rewards = GD.choiceRewards(stage, base);
    if (elite) for (const k in rewards) rewards[k] = Math.round(rewards[k] * ELITE_MULT);
    return {
      id: base.id,
      icon: elite ? '💀' : base.icon,
      label: (elite ? 'Élite — ' : '') + base.label,
      desc: base.desc,
      // §D11 : la difficulté vient de stageDifficulty (défi constant) ; l'élite reste un cran au-dessus.
      // §D13 §E : diffMult de profondeur (1 + row×0.04) appliqué ICI (source de vérité
      // unique côté progression — GD.EXPEDITION_CHOICES est brut, pas de double application).
      diffMult: (base.diffMult || 1) * (1 + (node.row || 0) * 0.04) * (elite ? 1.3 : 1),
      rewards,
      elite,
    };
  }

  // boss d'une ville : type et bonus déterministes
  function bossConfig(ci, lap) {
    const pool = ['costaud', 'mage', 'artilleur', 'assassin', 'heros'];
    const rnd = mulberry32(ci * 331 + lap * 17 + 5);
    return { type: pool[Math.floor(rnd() * pool.length)], mult: 1 + lap * 0.2 };
  }

  function launch(node, choiceId) {
    const s = st();
    if (GameState.compReady && !GameState.compReady()) {
      UI.toast('Choisissez au moins une unité réellement disponible avant de partir. Les ouvriers restent au village.', { icon: '🧩' });
      showOverview();
      return;
    }
    const stage = s.progression.stage || 1;
    const city = GD.stageCity(stage);
    const choice = nodeChoice(node, stage, choiceId);
    battleStage = stage;
    battleChoice = choice;
    battleNode = node;
    selectedNode = null;
    startBattle({
      seed: stage * 7919 + (node.id ? node.id.length : 3) * 17 + Math.round((node.col || 0) * 3),
      difficulty: GD.stageDifficulty(stage) * (choice.diffMult || 1),
      title: nodeMeta(node).icon + ' ' + choice.label + ' — ' + city.name,
      boss: node.type === 'boss' ? bossConfig(GD.expeditionZoneIndex(stage), cityLap()) : null,
    });
    UI.toast('« ' + choice.label + ' » — bonne chasse !', { icon: choice.icon });
  }

  function startBattle(o) {
    const s = st();
    const f = pf();
    const stage = battleStage;
    const city = GD.stageCity(stage);
    const look = GD.stageEnemyLook(stage);
    const depth = GD.expeditionDepth(stage);
    battleOver = false;
    battleStarted = false;
    battlePrepUnits = 0;
    pendingPotion = null;
    potionCd = 0;
    pendingScroll = null;
    scrollCd = 0;

    const map = Battle.generateMap({
      seed: o.seed,
      nodeCount: GD.stageNodeCount(stage),
      mode: 'personal', playerFaction: f, theme: city.theme,
      treeDepth: depth, stage: stage, // §D11 : taille des garnisons ~ stage global
    });

    // composition assainie : uniquement des types connus de data.js
    let comp = (s.composition && s.composition.units && s.composition.units.length)
      ? s.composition.units.filter(t => GD.UNIT_TYPES[t]) : [];
    if (!comp.length) comp = ['lancier'];

    const cfg = {
      canvas: bCanvas, map, mode: 'personal', playerFaction: f,
      difficulty: o.difficulty, enemyLook: look,
      composition: comp,
      getStats: (faction, type) => {
        if (faction === f) return GameState.getUnitStats(type);
        const u = GD.UNIT_TYPES[type];
        const base = u.base;
        const em = GD.evoStatMult(look.evo);
        // §9 : chaque catégorie frappe avec SA ligne d'arme et s'habille avec SA ligne d'armure
        const cat = u.cat || 'melee';
        const pick = (arr, tier) => arr[Math.min(tier || 0, arr.length - 1)];
        let wMult = pick(GD.WEAPONS, look.weapon).dmgMult;
        if (cat === 'tir' && GD.RANGED) wMult = pick(GD.RANGED, look.ranged).dmgMult;
        else if (cat === 'magie' && GD.STAFFS) wMult = pick(GD.STAFFS, look.staff).dmgMult;
        else if (cat === 'explosif' && GD.ORDNANCE) wMult = pick(GD.ORDNANCE, look.ordnance).dmgMult;
        let aMult = pick(GD.ARMORS, look.armor).hpMult;
        if (cat === 'magie' && GD.ROBES) aMult = pick(GD.ROBES, look.robe).hpMult;
        else if (cat === 'tir' && GD.VESTS) aMult = pick(GD.VESTS, look.vest).hpMult;
        else if (cat === 'explosif' && GD.SUITS) aMult = pick(GD.SUITS, look.suit).hpMult;
        // §D13 §B (tours) : seules les unités à distance PUISSANTES (tier ≥ 4)
        // gagnent +0.8 %/tier d'arme de portée et peuvent dépasser une tour.
        let range = base.range;
        if (range > 0 && (cat === 'tir' || cat === 'explosif') && GD.unitTier(type) >= 4) {
          const wTier = cat === 'tir' ? (look.ranged || 0) : (look.ordnance || 0);
          range = GD.rangedRangeBonus
            ? base.range * GD.rangedRangeBonus(type, wTier)
            : base.range * (1 + 0.008 * wTier);
        }
        return {
          hp: base.hp * em * aMult * o.difficulty,
          dmg: base.dmg * em * wMult * o.difficulty,
          aspd: base.aspd, mspd: base.mspd, range, ability: u.ability || null,
          cat, pop: u.pop || 1,
          weapon: look.weapon, armor: look.armor, evo: look.evo,
          ranged: look.ranged || 0, staff: look.staff || 0,
          ordnance: look.ordnance || 0, robe: look.robe || 0,
          vest: look.vest || 0, suit: look.suit || 0,
        };
      },
      onEvent: onBattleEvent,
      building: {
        tower: GameState.buildingBonus('tower'), production: GameState.buildingBonus('production'),
        fortify: GameState.buildingBonus('fortify'), rally: GameState.buildingBonus('rally'),
        flags: GameState.buildingBonus('flags'), // §6 (D15) : points de contrôle ×(1+eff)
        // MAJ §3 : les 3 pistes de la Tour + l'Étendard améliorable
        towerCount: GameState.buildingBonus('towerCount'), towerRate: GameState.buildingBonus('towerRate'),
        banner: GameState.buildingBonus('banner'),
      },
      // MAJ §3/§4 : l'IA améliore AUSSI ses bâtiments — niveau commun aux pistes,
      // calé sur le stage (le joueur démarre vers la 6e expédition, l'IA aussi).
      enemyBuilding: (function () {
        const eLvl = Math.max(0, Math.min(100, Math.round((stage - 5) * 1.5)));
        const out = {};
        for (const id in GD.BUILDFORGE) out[id] = GD.BUILDFORGE[id].eff(eLvl) - 1;
        return out;
      })(),
      // MAJ §4 : comportement IA progressif — facile (0) → moyen (1) →
      // difficile (2) → expert (3) au fil des stages.
      aiLevel: Math.min(3, Math.floor((stage - 1) / 8)),
      controlWinPoints: (GD.BALANCE.controlWinPointsByStage || [])[stage - 1]
        || GD.BALANCE.controlWinPoints,
      // MAJ §4 : renforts IA par vagues — remplace le « tout d'un coup ». Les
      // garnisons de départ sont plus sobres (stageGarrisonMult plafonné) et la
      // puissance manquante arrive PAR INTERVALLES pendant la bataille.
      enemyReinforce: stage >= 4 ? {
        interval: Math.max(30, 60 - stage),                      // de ~56 s à 30 s
        waves: Math.min(6, 1 + Math.floor(stage / 5)),
        size: Math.round((4 + stage * 0.8) * (o.difficulty > 2 ? 1.2 : 1)),
      } : null,
    };
    if (o.boss) cfg.boss = o.boss;
    battle = Battle.create(cfg);
    selectedNode = battle.getSelectedNode ? battle.getSelectedNode() : null;
    battle.setSendRatio(0.5);
    setRatioUI(0.5);

    els.battleTitle.textContent = o.title;
    els.quitBtn.style.display = '';
    buildUnitButtons();
    buildPotionBar();
    buildScrollBar(); // §D4 : parchemins de sorts
    els.startBtn.style.display = '';
    refreshHud();

    curView = 'battle';
    overviewView.style.display = 'none';
    missionView.style.display = 'none';
    battleView.style.display = 'flex';
    battle.resize();
    FX.sfx('deploy');
  }

  function endBattle() {
    if (battle) {
      st().lifetime.kills += battle.takePlayerKills();
      battle.destroy();
      battle = null;
    }
    battleStarted = false;
    battlePrepUnits = 0;
    battleChoice = null;
    battleNode = null;
    pendingPotion = null;
    pendingScroll = null;
    if (bCanvas) bCanvas.style.cursor = 'pointer';
    showMission();
    GameState.notify();
  }

  function onBattleEvent(ev) {
    const f = pf();
    if (ev.type === 'nodeSelected') {
      selectedNode = (ev.node && ev.node.owner === f) ? ev.node : null;
      refreshHud();
    } else if (ev.type === 'capture') {
      if (ev.by === f) {
        st().lifetime.captures++;
        GameState.notify();
      }
    } else if (ev.type === 'enemyReinforce') {
      // MAJ §4 : l'ennemi reçoit une vague — le joueur est prévenu
      UI.toast('⚠️ Renforts ennemis : +' + ev.count + ' unités' +
        (ev.wavesLeft > 0 ? ' (' + ev.wavesLeft + ' vague' + (ev.wavesLeft > 1 ? 's' : '') + ' à venir)' : ' (dernière vague)'),
        { icon: '🪂', cls: 'warn' });
    } else if (ev.type === 'victory') {
      if (!battleOver) {
        battleOver = true;
        if (ev.reason === 'control') {
          st().stats.controlWins = (st().stats.controlWins || 0) + 1;
        }
        onVictory();
      }
    } else if (ev.type === 'defeat') {
      if (!battleOver) {
        battleOver = true;
        onDefeat();
      }
    }
  }

  // -----------------------------------------------------------
  // Victoire / défaite
  // -----------------------------------------------------------
  function onVictory() {
    const s = st();
    // (VAGUE RANGS 2) LE RANG SE SOLDE ICI : les renforts envoyés forment
    // leur type, et la victoire paie la prime.
    soldeCampagne(true);
    ensurePath();
    const stage = battleStage;
    const city = GD.stageCity(stage);
    const node = battleNode;
    const choice = battleChoice || GD.expeditionChoices(stage)[0];
    const rewards = choice.rewards || GD.stageRewards(stage);
    const isBoss = node && node.type === 'boss';

    let html = '<div style="text-align:center">';
    html += '<div style="font-size:40px;margin-bottom:6px">' + (isBoss ? '👑' : '🏆') + '</div>';
    html += '<p style="font-weight:800;margin:4px 0">' + choice.label + ' — victoire !</p>';
    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:12px 0">';
    // (VAGUE ARBRE) « Œil du pilleur » : le QG majore le butin d'Expédition.
    const pillage = 1 + (GameState.qgBonus ? GameState.qgBonus('expe_butin') : 0);
    for (const k in rewards) {
      const gain = Math.ceil(rewards[k] * pillage);
      GameState.add(k, gain);
      const info = UI.res(k);
      html += '<span class="pg-chip">+' + UI.fmt(gain) + ' ' + info.icon + '</span>';
    }
    html += '</div>';
    html += '<p style="font-size:13px;font-weight:700;opacity:.8">🐾 Vos renforts rentrent à la caserne, plus expérimentés.</p>';

    // MAJ §6 : loot d'ingrédients de cuisine (quantité et rareté selon le stage)
    if (GD.kitchenLootRoll && GameState.kitchenGrant) {
      const ingLoot = GD.kitchenLootRoll(stage);
      GameState.kitchenGrant(ingLoot);
      let ingChips = '';
      for (const id in ingLoot) {
        const ing = GD.kitchenIngredient(id);
        if (ing) ingChips += '<span class="pg-chip" title="' + ing.name + '">' + ing.icon + ' +' + ingLoot[id] + '</span>';
      }
      if (ingChips) html += '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:6px 0"><span class="muted" style="align-self:center">🍲 butin de cuisine :</span>' + ingChips + '</div>';
      // recette lootable : une chance d'en découvrir une nouvelle au bon stage
      const kk = GameState.kitchen ? GameState.kitchen() : null;
      if (kk && Math.random() < 0.25) {
        const cand = (GD.KITCHEN_RECIPES || []).filter(r => !kk.unlocked[r.id] && r.unlock.type === 'loot' && stage >= r.unlock.stage);
        if (cand.length) {
          const rr = cand[(Math.random() * cand.length) | 0];
          kk.unlocked[rr.id] = true;
          html += '<p style="font-weight:800;margin:4px 0">📜 Recette découverte : ' + rr.icon + ' <b>' + rr.name + '</b> !</p>';
        }
      }
    }

    if (!s.world) s.world = {};
    if (!s.world[city.id]) s.world[city.id] = { nodes: null, lastSim: Date.now(), stageBonus: 0 };
    const w = s.world[city.id];
    const before = w.stageBonus || 0;
    w.stageBonus = Math.min(GD.STAGE_BONUS_CAP, before + GD.STAGE_BONUS_PER_WIN);
    if (w.stageBonus > before) {
      html += '<p style="font-size:13px;font-weight:700;opacity:.8">🚩 Puissance de votre camp à ' + city.name +
        ' : +' + Math.round(w.stageBonus * 100) + ' %</p>';
    } else {
      html += '<p style="font-size:13px;font-weight:700;opacity:.8">🚩 Bonus de ' + city.name + ' déjà au maximum !</p>';
    }

    s.stats.battlesWon = (s.stats.battlesWon || 0) + 1;
    if (battle) s.lifetime.kills += battle.takePlayerKills();

    let zoneChange = false;
    if (node) zoneChange = advanceTo(node);
    else { GameState.save(); GameState.notify(); }

    if (zoneChange) {
      const nextCity = GD.stageCity(stage + 1);
      html += '<p style="font-size:14px;font-weight:900;margin-top:10px;color:var(--acc,#f08c42)">🗺️ Nouvelle zone : ' +
        nextCity.name + ' !</p>';
      if (UI.log) UI.log('👑 Boss de ' + city.name + ' plié. ' + nextCity.name + ' fait déjà ses valises.');
    } else if (isBoss && UI.log) {
      UI.log('👑 Boss de ' + city.name + ' plié.');
    }
    html += '</div>';

    FX.sfx('win');

    UI.popup({
      title: zoneChange ? '🗺️ Zone conquise !' : '🎉 VICTOIRE !',
      html,
      buttons: [{
        label: zoneChange ? 'Explorer la nouvelle zone →' : 'Continuer l’expédition →',
        cls: 'primary',
        cb: () => {
          endBattle();
          // POLISH P6 : bannière d'étape franchie en refermant le popup
          if (zoneChange && UI.banner) {
            const nextCity = GD.stageCity(stage + 1);
            UI.banner(`🗺️ <b>${city.name}</b> conquise — cap sur <b>${nextCity.name}</b> !`, { icon: '👑' });
          }
        },
      }],
    });
  }

  // solde le carnet de campagne et annonce les rangs gagnés
  function soldeCampagne(victoire) {
    if (!GameState.campagneSolde) return;
    let montees = [];
    try { montees = GameState.campagneSolde(victoire) || []; } catch (e) { montees = []; }
    for (const m of montees) {
      const u = GD.UNIT_TYPES[m.type];
      UI.toast('🌟 <b>' + (u ? u.name[st().faction] : m.type) + '</b> passe rang ' + m.evo
        + (victoire ? ' — la victoire forme vite.' : '.'), { icon: '🌟', cls: 'gold' });
    }
  }
  function onDefeat() {
    // même à la défaite, ceux qui se sont battus ont appris — sans prime.
    soldeCampagne(false);
    const s = st();
    if (battle) s.lifetime.kills += battle.takePlayerKills();
    s.stats.battlesLost = (s.stats.battlesLost || 0) + 1;
    GameState.save();
    FX.sfx('lose');
    const lines = [
      'Repli stratégique ! Les moustaches repousseront.',
      "Ce n'était pas une défaite, c'était une reconnaissance TRÈS approfondie du terrain.",
      "L'ennemi a eu de la chance. Beaucoup de chance. Trop de chance, si vous voulez notre avis.",
      'Le Haut Commandement suggère : plus de troupes, plus de lances, plus de goûter.',
    ];
    UI.popup({
      title: '😿 Repli !',
      html: '<div style="text-align:center"><div style="font-size:38px;margin-bottom:6px">🏳️</div><p style="font-weight:700">' +
        lines[(Math.random() * lines.length) | 0] +
        '</p><p style="font-size:13px;opacity:.75">Aucune pénalité : vos renforts reviennent à la caserne. Entraînez-les, forgez une meilleure lance, et revenez leur montrer qui commande.</p></div>',
      buttons: [{
        label: 'On y retournera !', cls: 'primary',
        cb: () => { endBattle(); },
      }],
    });
  }

  function confirmQuit() {
    UI.popup({
      title: 'Abandonner la bataille ?',
      html: "<p style=\"text-align:center;font-weight:700\">Les unités déjà déployées resteront sur place (et feront la sieste chez l'ennemi). Sûr de vous ?</p>",
      buttons: [
        { label: 'Rester et se battre !', cls: 'primary', cb: () => { } },
        {
          label: 'Abandonner', cls: 'danger',
          cb: () => {
            battleOver = true;
            soldeCampagne(null);
            endBattle();
            UI.toast('Repli en bon ordre. Enfin, en ordre à peu près.', { icon: '🏳️' });
          },
        },
      ],
    });
  }

  // -----------------------------------------------------------
  // HUD de bataille : renforts (composition), potions
  // -----------------------------------------------------------
  function setRatioUI(r) {
    battleSendRatio = r;
    for (const b of els.ratios) b.el.classList.toggle('on', Math.abs(b.r - r) < 0.01);
  }

  // boutons de renfort : UNIQUEMENT les unités de la composition
  function buildUnitButtons() {
    const f = pf();
    const s = st();
    els.unitsWrap.innerHTML = '';
    els.units = {};
    const comp = (s.composition && s.composition.units && s.composition.units.length)
      ? s.composition.units : ['lancier'];
    if (comp.indexOf(selType) === -1) selType = comp[0];
    for (const t of comp) {
      if (!GD.UNIT_TYPES[t]) continue;
      const b = document.createElement('button');
      b.className = 'pg-unit';
      b.title = GD.UNIT_TYPES[t].name[f];
      try {
        // les tiers viennent de getUnitStats (source de vérité §9), défensif si absent
        let us = null;
        try { us = GameState.getUnitStats(t); } catch (e2) { us = null; }
        us = us || {};
        const icon = Sprites.getUnitIcon({
          faction: f, type: t,
          evo: (us.evo !== undefined ? us.evo : (s.evo && s.evo[t])) || 0,
          weapon: (us.weapon !== undefined ? us.weapon : s.weaponTier) || 0,
          armor: (us.armor !== undefined ? us.armor : s.armorTier) || 0,
          ranged: (us.ranged !== undefined ? us.ranged : s.rangedTier) || 0,
          staff: (us.staff !== undefined ? us.staff : s.staffTier) || 0,
          ordnance: us.ordnance || 0,
          robe: us.robe || 0,
          vest: us.vest || 0,
          suit: us.suit || 0,
        }, 28);
        icon.style.display = 'block';
        b.appendChild(icon);
      } catch (e) { b.textContent = '🪖'; }
      const cnt = document.createElement('span');
      cnt.className = 'n';
      cnt.textContent = '0';
      b.appendChild(cnt);
      b.addEventListener('click', () => { selType = t; FX.sfx('click'); refreshHud(); });
      els.unitsWrap.appendChild(b);
      els.units[t] = { btn: b, count: cnt };
    }
  }

  // barre de potions : celles de la composition, stock potionsInv
  function buildPotionBar() {
    const s = st();
    const f = pf();
    els.potionBar.innerHTML = '';
    els.potions = [];
    const ids = (s.composition && s.composition.potions) || [];
    els.potionBar.style.display = ids.length ? 'flex' : 'none';
    for (const id of ids) {
      const def = (GD.POTIONS || []).find(p => p.id === id);
      if (!def) continue;
      const b = document.createElement('button');
      b.className = 'pg-potion';
      b.title = def.name[f] + ' — ' + def.desc;
      b.textContent = def.icon;
      const cnt = document.createElement('span');
      cnt.className = 'n';
      cnt.textContent = '0';
      b.appendChild(cnt);
      const cdo = document.createElement('span');
      cdo.className = 'cdo';
      b.appendChild(cdo);
      b.addEventListener('click', () => togglePotionAim(def));
      els.potionBar.appendChild(b);
      els.potions.push({ id, def, el: b, n: cnt, cdo });
    }
    refreshPotionBar();
  }

  function togglePotionAim(def) {
    if (!battle || battleOver) return;
    if (pendingPotion && pendingPotion.id === def.id) {
      pendingPotion = null;
      setAimUI();
      return;
    }
    if (potionCd > 0) {
      UI.toast('Potions en recharge (' + Math.ceil(potionCd) + ' s). Patience, alchimie.', { icon: '⏳' });
      FX.sfx('error');
      return;
    }
    if ((st().potionsInv[def.id] || 0) <= 0) {
      UI.toast('Stock vide. La Cuisine attend vos ordres.', { icon: '🧪' });
      FX.sfx('error');
      return;
    }
    pendingScroll = null; // une seule visée à la fois
    pendingPotion = def;
    FX.sfx('click');
    setAimUI();
  }

  function setAimUI() {
    if (bCanvas) bCanvas.style.cursor = (pendingPotion || pendingScroll) ? 'crosshair' : 'pointer';
    for (const p of els.potions || []) {
      p.el.classList.toggle('aim', !!(pendingPotion && pendingPotion.id === p.id));
    }
    for (const p of els.scrolls || []) {
      p.el.classList.toggle('aim', !!(pendingScroll && pendingScroll.id === p.id));
    }
    if (pendingPotion) {
      els.selInfo.textContent = '🎯 ' + pendingPotion.name[pf()] + ' : cliquez sur le champ de bataille pour la lancer.';
    } else if (pendingScroll) {
      els.selInfo.textContent = '🎯 ' + pendingScroll.icon + ' ' + pendingScroll.name + ' : cliquez sur le champ de bataille pour jeter le sort.';
    } else {
      refreshHud();
    }
  }

  function castPendingPotion(cssX, cssY) {
    const def = pendingPotion;
    pendingPotion = null;
    setAimUI();
    if (!battle || !def) return;
    if (!battle.castPotion) {
      UI.toast('Le lance-potions est encore en rodage chez l’ingénieur.', { icon: '🧪' });
      return;
    }
    if (!GameState.usePotion(def.id)) {
      UI.toast('Stock vide. La Cuisine attend vos ordres.', { icon: '🧪' });
      return;
    }
    let wx = cssX, wy = cssY;
    if (battle.screenToWorld) {
      const p = battle.screenToWorld(cssX, cssY);
      wx = p.x; wy = p.y;
    }
    // MAJ §7 : la potion part au NIVEAU courant (stats renforcées par la mèche)
    const leveled = GameState.potionStats ? GameState.potionStats(def.id) : null;
    battle.castPotion(leveled ? Object.assign({}, def, { battle: leveled }) : def, wx, wy);
    potionCd = 5; // recharge globale
    FX.sfx('deploy');
    GameState.notify();
    refreshPotionBar();
  }

  function refreshPotionBar() {
    if (!els.potions) return;
    const inv = st().potionsInv || {};
    const onCd = potionCd > 0;
    for (const p of els.potions) {
      const n = inv[p.id] || 0;
      p.n.textContent = UI.fmt(n);
      p.el.disabled = n <= 0;
      p.el.classList.toggle('cd', onCd);
      p.cdo.textContent = onCd ? Math.ceil(potionCd) : '';
    }
  }

  // -----------------------------------------------------------
  // §D13-D4 : barre de PARCHEMINS (sorts) — mêmes styles .pg-potion que les
  // potions, préfixe scroll. Liste les sorts avec parchemins en stock OU un
  // niveau appris (grisé si 0 parchemin). Clic → visée → clic canvas →
  // useScroll + battle.castSpell. Cooldown global court (2 s) partagé.
  // -----------------------------------------------------------
  function buildScrollBar() {
    const s = st();
    if (!els.scrollBar) return;
    els.scrollBar.innerHTML = '';
    els.scrolls = [];
    const lvlOf = id => (GameState.spellLevel ? GameState.spellLevel(id) : 0);
    const list = (GD.SPELLS || []).filter(sp =>
      ((s.scrolls && s.scrolls[sp.id]) || 0) > 0 || lvlOf(sp.id) > 0);
    // aucun sort appris ET aucun parchemin : barre masquée
    els.scrollBar.style.display = list.length ? 'flex' : 'none';
    for (const sp of list) {
      const b = document.createElement('button');
      b.className = 'pg-potion';
      const lvl = Math.max(1, lvlOf(sp.id));
      b.title = '📜 ' + sp.name + ' (niv ' + lvl + ') — ' + sp.desc;
      b.textContent = sp.icon;
      const cnt = document.createElement('span');
      cnt.className = 'n';
      cnt.textContent = '0';
      b.appendChild(cnt);
      const cdo = document.createElement('span');
      cdo.className = 'cdo';
      b.appendChild(cdo);
      b.addEventListener('click', () => toggleScrollAim(sp));
      els.scrollBar.appendChild(b);
      els.scrolls.push({ id: sp.id, def: sp, el: b, n: cnt, cdo });
    }
    refreshScrollBar();
  }

  function toggleScrollAim(def) {
    if (!battle || battleOver) return;
    if (pendingScroll && pendingScroll.id === def.id) {
      pendingScroll = null;
      setAimUI();
      return;
    }
    if (scrollCd > 0) {
      UI.toast('Grimoire en recharge (' + Math.ceil(scrollCd) + ' s). Les mots reprennent leur souffle.', { icon: '⏳' });
      FX.sfx('error');
      return;
    }
    if (((st().scrolls || {})[def.id] || 0) <= 0) {
      UI.toast('Plus de parchemin ! La Cuisine attend vos ordres.', { icon: '📜' });
      FX.sfx('error');
      return;
    }
    pendingPotion = null; // une seule visée à la fois
    pendingScroll = def;
    FX.sfx('click');
    setAimUI();
  }

  function castPendingScroll(cssX, cssY) {
    const def = pendingScroll;
    pendingScroll = null;
    setAimUI();
    if (!battle || !def) return;
    if (!battle.castSpell) {
      UI.toast('Le Grimoire est encore chez le relieur.', { icon: '📜' });
      return;
    }
    let wx = cssX, wy = cssY;
    if (battle.screenToWorld) {
      const p = battle.screenToWorld(cssX, cssY);
      wx = p.x; wy = p.y;
    }
    const ok = GameState.useScroll(def.id)
      && battle.castSpell(def.id, (GameState.spellLevel && GameState.spellLevel(def.id)) || 1, wx, wy);
    if (ok) {
      scrollCd = 2; // cooldown global court, anti-spam
      FX.sfx('deploy');
    } else {
      UI.toast('Le parchemin refuse de crépiter. (Stock vide ou bataille finie.)', { icon: '📜' });
    }
    GameState.notify();
    refreshScrollBar();
  }

  function refreshScrollBar() {
    if (!els.scrolls) return;
    const inv = st().scrolls || {};
    const onCd = scrollCd > 0;
    for (const p of els.scrolls) {
      const n = inv[p.id] || 0;
      p.n.textContent = UI.fmt(n);
      p.el.disabled = n <= 0; // appris mais sans stock : grisé
      p.el.classList.toggle('cd', onCd);
      p.cdo.textContent = onCd ? Math.ceil(scrollCd) : '';
    }
  }

  function refreshHud() {
    // stock DÉPLOYABLE (availableArmy) : les ouvriers affectés restent au boulot
    const avail = GameState.availableArmy || GameState.armyCount;
    const defUnite = GD.UNIT_TYPES[selType];
    const nomUnite = defUnite ? defUnite.name[pf()] : 'unité';
    const reserveUnite = Math.max(0, avail(selType) || 0);
    const renfortPret = Math.min(selQty, reserveUnite);
    for (const t in els.units) {
      const u = els.units[t];
      const reserve = Math.max(0, avail(t) || 0);
      u.count.textContent = UI.fmt(reserve);
      u.btn.setAttribute('aria-label', GD.UNIT_TYPES[t].name[pf()] + ' — ' + UI.fmt(reserve) + ' en réserve');
      u.btn.classList.toggle('on', selType === t);
    }
    for (const q of els.qtys) q.el.classList.toggle('on', q.n === selQty);
    const ok = !!selectedNode;
    els.sendBtn.disabled = !ok;
    els.sendBtn.textContent = '🪂 Parachuter ×' + selQty;
    els.sendBtn.title = ok
      ? 'Parachuter ' + renfortPret + ' ' + nomUnite + ' sur le nœud sélectionné'
      : 'Sélectionnez d’abord un nœud de votre couleur';
    if (battle && !pendingPotion) {
      if (!battleStarted) {
        els.selInfo.classList.add('prep');
        if (!ok) {
          els.selInfo.textContent = '1/3 Cliquez votre QG ou un nœud de votre couleur sur la carte.';
        } else if (battlePrepUnits <= 0) {
          els.selInfo.textContent = '1/3 Base sélectionnée ✓ · 2/3 ' + nomUnite + ' ×' + renfortPret
            + ' : cliquez « Parachuter » · 3/3 Lancez l’assaut.';
        } else {
          els.selInfo.textContent = '✓ ' + battlePrepUnits + ' renfort' + (battlePrepUnits > 1 ? 's' : '')
            + ' parachuté' + (battlePrepUnits > 1 ? 's' : '') + ' · Ordres ' + Math.round(battleSendRatio * 100)
            + ' % : cliquez un nœud ami puis sa cible, ajoutez des renforts ou lancez l’assaut.';
        }
        return;
      }
      els.selInfo.classList.remove('prep');
      const cible = battle.getControlWinPoints ? battle.getControlWinPoints() : GD.BALANCE.controlWinPoints;
      const objectif = '🏁 Majorité des drapeaux jusqu’à ' + cible + ' pts · ';
      els.selInfo.textContent = objectif + (ok
        ? '🎯 Nœud n°' + selectedNode.id + ' sélectionné · cliquez une cible pour avancer, ou parachutez des renforts ici.'
        : 'Sélectionnez un nœud ami, puis une cible à conquérir.');
    }
  }

  function doReinforce() {
    if (!battle || !selectedNode) return;
    const avail = GameState.availableArmy || GameState.armyCount;
    const n = Math.min(selQty, avail(selType));
    if (n <= 0) {
      UI.toast('Stock vide pour cette unité ! La Nurserie recrute (ou vos ouvriers squattent les postes).', { icon: '😿' });
      FX.sfx('error');
      return;
    }
    if (!GameState.useArmy(selType, n)) return;
    battle.deploy(selectedNode.id, selType, n);
    battlePrepUnits += n;
    st().lifetime.deposits++;
    GameState.notify();
    FX.sfx('deploy');
    try { FX.floatFromEl(els.sendBtn, '+' + n + ' 🪖', 'gain'); } catch (e) { }
    refreshHud();
  }

  function startAssault() {
    if (!battle || battleOver || battleStarted) return;
    battleStarted = true;
    els.startBtn.style.display = 'none';
    FX.sfx('deploy');
    UI.toast('Les ordres sont donnés. À l’assaut !', { icon: '⚔️' });
    refreshHud();
  }

  // -----------------------------------------------------------
  // DOM
  // -----------------------------------------------------------
  function buildDom() {
    injectStyles();
    root = document.createElement('div');
    root.className = 'pg-root';

    // ---- vue 1 : carte globale + panneau de préparation ----
    // MAJ village : à GAUCHE la Composition de bataille + l'Armée (venues du QG),
    // à DROITE le globe. Sur écran vertical, empilé (CSS .pg-ovmain).
    overviewView = document.createElement('div');
    overviewView.className = 'pg-ovview';
    const ovMain = document.createElement('div');
    ovMain.className = 'pg-ovmain';
    const ovSide = document.createElement('div');
    ovSide.className = 'pg-ovside';
    els.armyComp = ovSide;
    const world = document.createElement('div');
    world.className = 'pg-world';
    els.world = world;
    ovMain.appendChild(ovSide);
    ovMain.appendChild(world);
    const ovHint = document.createElement('div');
    ovHint.className = 'pg-hint';
    ovHint.textContent = '🗺️ Votre expédition, ville par ville. Cliquez sur votre position actuelle pour y entrer ! · ⬅️ préparez votre composition avant de partir.';
    overviewView.appendChild(ovMain);
    overviewView.appendChild(ovHint);

    // ---- vue 2 : arbre d'expédition ----
    missionView = document.createElement('div');
    missionView.className = 'pg-missionview';
    const card = document.createElement('div');
    card.className = 'pg-card';

    const head = document.createElement('div');
    head.className = 'pg-missionhead';
    const back = document.createElement('button');
    back.className = 'pg-back';
    back.textContent = '← Carte globale';
    back.addEventListener('click', () => { FX.sfx('click'); showOverview(); });
    const headTxt = document.createElement('div');
    const kicker = document.createElement('div');
    kicker.className = 'pg-kicker';
    kicker.textContent = '🧭 Expédition';
    const title = document.createElement('div');
    title.className = 'pg-title';
    els.stageTitle = title;
    const stageNum = document.createElement('div');
    stageNum.className = 'pg-stage';
    els.stageNum = stageNum;
    headTxt.appendChild(kicker); headTxt.appendChild(title); headTxt.appendChild(stageNum);
    head.appendChild(back); head.appendChild(headTxt);

    const desc = document.createElement('div');
    desc.className = 'pg-desc';
    els.stageDesc = desc;

    treeWrap = document.createElement('div');
    treeWrap.className = 'pg-treewrap';
    const path = document.createElement('div');
    path.className = 'pg-path';
    els.path = path;
    treeWrap.appendChild(path);

    const legend = document.createElement('div');
    legend.className = 'pg-legend';
    legend.textContent = '⚔️ combat · 💀 élite · 👑 boss de région — avancez de gauche à droite. Cliquez l’étape en cours et choisissez votre butin.';

    const note = document.createElement('div');
    note.className = 'pg-note';
    els.note = note;

    card.appendChild(head); card.appendChild(desc); card.appendChild(treeWrap);
    card.appendChild(legend); card.appendChild(note);
    missionView.appendChild(card);

    // ---- vue 3 : bataille ----
    battleView = document.createElement('div');
    battleView.className = 'pg-battleview';

    const hud = document.createElement('div');
    hud.className = 'pg-hud';
    const bTitle = document.createElement('div');
    bTitle.style.cssText = 'font-weight:900;font-size:13px;';
    els.battleTitle = bTitle;

    const ratio = document.createElement('div');
    ratio.className = 'pg-ratio';
    els.ratios = [];
    for (const r of [0.25, 0.5, 1.0]) {
      const b = document.createElement('button');
      b.className = 'pg-rbtn';
      b.textContent = Math.round(r * 100) + ' %';
      b.title = 'Fraction de la garnison envoyée à chaque ordre';
      b.setAttribute('aria-label', 'Ordres : envoyer ' + Math.round(r * 100) + ' % de la garnison');
      b.addEventListener('click', () => {
        if (battle) battle.setSendRatio(r);
        setRatioUI(r);
        FX.sfx('click');
        refreshHud();
      });
      ratio.appendChild(b);
      els.ratios.push({ r, el: b });
    }

    const units = document.createElement('div');
    units.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
    els.unitsWrap = units;
    els.units = {};

    const qtys = document.createElement('div');
    qtys.style.cssText = 'display:flex;gap:4px;';
    els.qtys = [];
    for (const n of (GD.BALANCE.depositBatch || [1, 5, 25, 100])) {
      const q = document.createElement('button');
      q.className = 'pg-rbtn';
      q.textContent = '×' + n;
      q.title = 'Nombre de renforts parachutés sur le nœud choisi';
      q.setAttribute('aria-label', 'Parachuter ' + n + ' renfort' + (n > 1 ? 's' : ''));
      q.addEventListener('click', () => { selQty = n; FX.sfx('click'); refreshHud(); });
      qtys.appendChild(q);
      els.qtys.push({ n, el: q });
    }
    selQty = (GD.BALANCE.depositBatch || [1, 5])[1] || 5;

    const sendBtn = document.createElement('button');
    sendBtn.className = 'pg-send';
    sendBtn.textContent = '🪂 Parachuter ×' + selQty;
    sendBtn.disabled = true;
    sendBtn.addEventListener('click', doReinforce);
    els.sendBtn = sendBtn;

    const startBtn = document.createElement('button');
    startBtn.className = 'pg-start';
    startBtn.textContent = '⚔️ Lancer l’assaut';
    startBtn.title = 'Démarre la bataille quand vos renforts et vos premiers ordres sont prêts';
    startBtn.addEventListener('click', startAssault);
    els.startBtn = startBtn;

    const potionBar = document.createElement('div');
    potionBar.className = 'pg-potions';
    els.potionBar = potionBar;
    els.potions = [];

    // §D4 : barre de PARCHEMINS (sorts), mêmes styles que les potions
    const scrollBar = document.createElement('div');
    scrollBar.className = 'pg-potions';
    els.scrollBar = scrollBar;
    els.scrolls = [];

    const spacer = document.createElement('div');
    spacer.className = 'sp';

    const quitBtn = document.createElement('button');
    quitBtn.className = 'pg-quit';
    quitBtn.textContent = '🏳️ Abandonner';
    quitBtn.addEventListener('click', confirmQuit);
    els.quitBtn = quitBtn;

    hud.appendChild(bTitle);
    hud.appendChild(ratio);
    hud.appendChild(units);
    hud.appendChild(qtys);
    hud.appendChild(sendBtn);
    hud.appendChild(startBtn);
    hud.appendChild(potionBar);
    hud.appendChild(scrollBar);
    hud.appendChild(spacer);
    hud.appendChild(quitBtn);

    const selInfo = document.createElement('div');
    selInfo.className = 'pg-selinfo';
    els.selInfo = selInfo;

    const cWrap = document.createElement('div');
    cWrap.className = 'pg-canvaswrap';
    bCanvas = document.createElement('canvas');
    cWrap.appendChild(bCanvas);
    bCanvas.addEventListener('pointerdown', e => {
      if (!battle) return;
      const r = bCanvas.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      if (pendingPotion) { castPendingPotion(cx, cy); return; }
      if (pendingScroll) { castPendingScroll(cx, cy); return; } // §D4 : sort visé
      bCanvas.setPointerCapture && bCanvas.setPointerCapture(e.pointerId);
      battle.pointerDown(cx, cy);
    });
    bCanvas.addEventListener('pointermove', e => {
      if (!battle || pendingPotion || pendingScroll) return;
      const r = bCanvas.getBoundingClientRect();
      battle.pointerMove(e.clientX - r.left, e.clientY - r.top);
    });
    bCanvas.addEventListener('pointerup', e => {
      if (!battle || pendingPotion || pendingScroll) return;
      const r = bCanvas.getBoundingClientRect();
      battle.pointerUp(e.clientX - r.left, e.clientY - r.top);
    });

    battleView.appendChild(hud);
    battleView.appendChild(selInfo);
    battleView.appendChild(cWrap);

    root.appendChild(overviewView);
    root.appendChild(missionView);
    root.appendChild(battleView);
  }

  // -----------------------------------------------------------
  // Cycle de vie
  // -----------------------------------------------------------
  let killT = 0, idleRedrawT = 0, armyCompT = 0;
  function tick(dt) {
    pgTime += dt || 0;
    if (potionCd > 0) potionCd = Math.max(0, potionCd - (dt || 0));
    if (scrollCd > 0) scrollCd = Math.max(0, scrollCd - (dt || 0)); // §D4

    if (battle) {
      if (battleStarted) battle.update(dt);
      battle.render(pgTime);
      hudT += dt;
      if (hudT >= 0.7) {
        hudT = 0;
        refreshHud();
        refreshPotionBar();
        refreshScrollBar(); // §D4 : stock + cooldown des parchemins
      }
      killT += dt;
      if (killT >= 2) {
        killT = 0;
        const k = battle.takePlayerKills();
        if (k > 0) { st().lifetime.kills += k; GameState.notify(); }
      }
    } else if (curView === 'overview') {
      drawGlobe(pgTime); // §D11quinquies : le globe tourne doucement
      // MAJ village : rafraîchit le panneau Compo/Armée (les unités éclosent en
      // continu) — jamais pendant qu'on manipule une chip (focus dans le panneau).
      armyCompT += dt || 0;
      if (armyCompT >= 1.5 && UI.renderArmyComposition && els.armyComp
        && !(els.armyComp.contains && els.armyComp.contains(document.activeElement))) {
        armyCompT = 0;
        UI.renderArmyComposition(els.armyComp);
      }
    }
    // le parcours de ville (mission) reste du DOM statique — aucun redraw par frame.
  }

  function init() {
    buildDom();
    // §D11quater : carte-monde et zigzag dépendent des dimensions → re-rendu au resize
    let rsT = null;
    window.addEventListener('resize', () => {
      clearTimeout(rsT);
      rsT = setTimeout(() => {
        if (curView === 'overview') renderWorld();
        else if (curView === 'mission') renderPath();
      }, 150);
    });
    showOverview();
    UI.registerTab('expedition', {
      el: root,
      onShow: () => {
        if (battle) { battle.resize(); }
        else if (curView === 'mission') refreshMission();
        else renderWorld();
      },
      onHide: () => { /* la bataille est mise en pause (tick non appelé) */ },
      tick,
    });
  }

  // Le camp de la carte ouvre directement le parcours courant après son
  // animation de départ. La carte globale reste accessible par le retour.
  // (VAGUE STOCK) montrerCarte = la VUE D'ENSEMBLE (le globe). La caserne
  // du village y mène — prepareExpedition, lui, saute direct à la préparation
  // de mission et CACHE la carte (constaté : « je devrais arriver sur la
  // carte globale »).
  window.Progression = { init, tick, prepareExpedition: showMission, montrerCarte: showOverview };
})();
