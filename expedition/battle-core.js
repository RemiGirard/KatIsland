/* ============================================================
   GRIFFES & PLUMES — battle.js
   Moteur de bataille façon "Mushroom Wars" -> window.Battle
   Dépend : GameData, Sprites, FX.
   Monde logique en coordonnées fixes (map.w × map.h), letterbox
   automatique dans le canvas fourni. Aucun listener DOM ici :
   l'appelant relaie pointerDown/Move/Up en px CSS du canvas.
   ============================================================ */
"use strict";

  const BGD = window.GameData;

  // ---------------------------------------------------------------
  // Petits utilitaires
  // ---------------------------------------------------------------
  function mulberry32(seed) {
    let a = (seed >>> 0) || 123456789;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function bclamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function bdist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
  // distance d'un point à un segment (placement des obstacles)
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 < 0.001) return bdist(px, py, ax, ay);
    const t = bclamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return bdist(px, py, ax + dx * t, ay + dy * t);
  }

  const FACTION_COL = { cats: '#f08c42', birds: '#48a9d8' };
  const FACTION_COL2 = { cats: '#e76f51', birds: '#3a86ff' };
  const NEUTRAL_COL = '#9a9a92';
  const UNIT_ORDER = BGD.UNIT_ORDER;

  // badges de lisibilité au-dessus des bâtiments + tooltips FR
  const BADGES = { production: '', defense: '', reinforce: '', controle: '', banner: '', avantposte: '' };
  const CTRL_WIN_DEFAULT = (BGD.BALANCE && BGD.BALANCE.controlWinPoints) || 120;
  // §B (DESIGN13) : portée UNIFIÉE des tours de garde (riposte des nœuds 'defense')
  const TOWER_RANGE = (BGD.BALANCE && BGD.BALANCE.towerRange) || 185;
  const AOE_MAX = (BGD.BALANCE && BGD.BALANCE.aoeMaxTargets) || 4;
  const AOE_DECAY = [1, 0.7, 0.4, 0.2];
  const NODE_INFO = {
    hq:         { name: 'Quartier général',    tip: 'Produit des recrues. S’il tombe, tout tombe.' },
    production: { name: 'Caserne',             tip: 'Produit des unités en continu. À protéger, évidemment.' },
    defense:    { name: 'Tour de garde',       tip: 'Tire sur tout ennemi qui approche. Zéro sommation.' },
    reinforce:  { name: 'Totem de ralliement', tip: '+25% PV et dégâts aux unités alliées qui sortent à proximité.' },
    controle:   { name: 'Point de contrôle',   tip: 'Majorité de drapeaux = 1 pt/s. Gardez-les jusqu’au score de victoire.' },
    banner:     { name: 'Étendard',            tip: '+10% dégâts ET PV à toutes les troupes du propriétaire. Cumulable. Convoité, forcément.' },
    neutral:    { name: 'Borne neutre',        tip: 'Un caillou stratégiquement décoratif. Capturez-le quand même.' },
    avantposte: { name: 'Avant-poste',         tip: 'Capturé : vos renforts y débarquent + aura de soin (2 PV/s) pour les alliés proches.' },
  };

  const COMBAT_SCALE = (BGD.BALANCE && BGD.BALANCE.combatScale) || 1;
  const NODE_R = 26 * COMBAT_SCALE;          // rayon logique d'un nœud
  const ENTER_R = NODE_R + 8;                // §B4 : distance d'ENTRÉE dans le bâtiment (siège)
  const CONTACT_R = 14 * COMBAT_SCALE;       // rayon de mêlée
  const SEND_RATE = 12;       // (hérité) unités/s — désormais on libère par salves
  const SALVO_SIZE = 8;       // §régiment : un rang complet sort d'un coup
  const SALVO_GAP = 0.28;     // §régiment : délai entre deux salves (s)
  // §pixel : taille du bloc pixel-art (px écran) sur toute la scène ; 0 = off.
  // (réglable via BALANCE.pixelArt ; 1 = grain léger sur écrans DPR>1, no-op à DPR 1)
  const PIXEL_CSS = (BGD.BALANCE && BGD.BALANCE.pixelArt != null) ? BGD.BALANCE.pixelArt : 1;

  // throttle local des sons (en plus de celui de FX)
  const sfxLast = {};
  function sfx(name, minMs) {
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (sfxLast[name] && t - sfxLast[name] < (minMs || 120)) return;
    sfxLast[name] = t;
    try { window.FX && FX.sfx(name); } catch (e) { /* silence */ }
  }


  // ---------------------------------------------------------------
  // Battle.create — le moteur
  // ---------------------------------------------------------------
  function create(cfg) {
    const canvas = cfg.canvas;
    const ctx = canvas.getContext('2d');
    const mode = cfg.mode || (cfg.map && cfg.map.mode) || 'personal';
    const map = cfg.map;
    const pf = cfg.playerFaction || 'cats';
    const ef = BGD.other(pf);
    const difficulty = cfg.difficulty || 1;
    const ctrlWin = Math.max(1, Math.round(cfg.controlWinPoints || CTRL_WIN_DEFAULT));
    const enemyLook = cfg.enemyLook || { weapon: 0, armor: 0, evo: 0 };
    const AGENT_CAP = (BGD.BALANCE && BGD.BALANCE.agentCap) || 400;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let destroyed = false, ended = false;
    let sendRatio = 0.5;
    let selectedId = -1;
    let simT = 0; // horloge interne (secondes)
    let autoPilot = false; // IA aux commandes du camp joueur (mode farm)
    let deathFxBudget = 6; // throttle des morts en chaîne (fx/sons)
    let hoverId = -1;      // nœud survolé (tooltip)
    const composition = Array.isArray(cfg.composition) && cfg.composition.length ? cfg.composition.slice() : null;
    const obstacles = map.obstacles || [];
    const slowPools = []; // flaques de glu (potions)
    const totems = [];    // totems de soin posés (potions)
    const fxRings = [];   // anneaux d'effet éphémères (monde)
    // §D13-D4 (sorts) : effets actifs (télégraphes, zones, canaux) + particules
    // dédiées. RUNTIME PUR (jamais sérialisé), pools bornés, passe fx dédiée.
    const spellFx = [];
    const spParts = [];
    const SP_CAP = 200;           // cap global de particules de sorts
    let shakeT = 0, shakeAmp = 0; // petit shake d'impact (météore, séisme)

    // =============================================================
    // §OBST — CHAMP DE FLUX BFS par destination (contournement d'obstacles).
    // Le steering local (séparation, cœur radial, bande tangentielle) reste le
    // patron en COMBAT ; en MARCHE vers un nœud, si la ligne droite est barrée
    // par un obstacle, l'unité suit la direction d'un champ calculé par BFS
    // 8-connexe DEPUIS la destination. Calcul PARESSEUX (première demande),
    // mémoïsé par nœud, invalidé par compteur de version (obsVer) bumpé à
    // CHAQUE mutation du tableau obstacles : roches de boss, murs d'épines /
    // glace posés PUIS retirés en pleine bataille.
    // Perf : grille ~32 px (960×600 → 570 cellules), BFS ~0,1 ms par
    // destination amorti, zéro allocation dans le chemin chaud (scratchs
    // partagés + sortie via flowGX/flowGY).
    const FLOW_CELL = 32;
    const flowW = Math.max(2, Math.ceil(map.w / FLOW_CELL));
    const flowH = Math.max(2, Math.ceil(map.h / FLOW_CELL));
    const flowN = flowW * flowH;
    let obsVer = 1;                             // ++ à chaque mutation d'obstacles
    // NB : la validité d'un cache est (ver, length) — le length attrape aussi les
    // push/splice DIRECTS sur map.obstacles (harnais dev/) qui ne bumpent pas obsVer.
    let flowBlockedVer = -1, flowBlockedLen = -1;
    const flowBlocked = new Uint8Array(flowN);  // 1 = centre à < r+12 d'un obstacle
    const flowVisited = new Uint8Array(flowN);  // scratch BFS (réutilisé)
    const flowQueue = new Int32Array(flowN);    // file BFS (réutilisée)
    const flowFields = new Map();               // node.id -> { ver, dx, dy } (Int8Array)
    const FLOW_OX = [1, -1, 0, 0, 1, 1, -1, -1];
    const FLOW_OY = [0, 0, 1, -1, 1, -1, 1, -1];
    let flowGX = 0, flowGY = 0;                 // sortie de flowGoal (zéro alloc)
    let flowDX = 0, flowDY = 0;                 // direction unitaire du flux (id.)

    function flowRebuildBlocked() {
      if (flowBlockedVer === obsVer && flowBlockedLen === obstacles.length) return;
      flowBlocked.fill(0);
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const rr = (o.r || 0) + 12; // demi-gabarit d'unité
        const cx0 = Math.max(0, ((o.x - rr) / FLOW_CELL) | 0);
        const cx1 = Math.min(flowW - 1, ((o.x + rr) / FLOW_CELL) | 0);
        const cy0 = Math.max(0, ((o.y - rr) / FLOW_CELL) | 0);
        const cy1 = Math.min(flowH - 1, ((o.y + rr) / FLOW_CELL) | 0);
        for (let cy = cy0; cy <= cy1; cy++) {
          const py = (cy + 0.5) * FLOW_CELL - o.y;
          for (let cx = cx0; cx <= cx1; cx++) {
            const px = (cx + 0.5) * FLOW_CELL - o.x;
            if (px * px + py * py < rr * rr) flowBlocked[cy * flowW + cx] = 1;
          }
        }
      }
      flowBlockedVer = obsVer; flowBlockedLen = obstacles.length;
    }

    // Champ BFS générique : key = node.id (destinations nodales, ≥ 0) ou clé
    // NÉGATIVE -1-cellule (§MOUV2 : poursuite de foe barrée — champ vers la
    // CELLULE du foe). Les champs de cellule sont recyclés au-delà de 96 entrées
    // (Map = ordre d'insertion) pour borner la mémoire sur les longues batailles.
    function flowFieldAt(key, srcX, srcY) {
      let f = flowFields.get(key);
      if (f && f.ver === obsVer && f.len === obstacles.length) return f;
      flowRebuildBlocked();
      if (!f) {
        if (key < 0 && flowFields.size > 96) {
          for (const k of flowFields.keys()) { if (k < 0) { flowFields.delete(k); break; } }
        }
        f = { ver: 0, len: -1, dx: new Int8Array(flowN), dy: new Int8Array(flowN) };
        flowFields.set(key, f);
      }
      f.dx.fill(0); f.dy.fill(0);
      flowVisited.fill(0);
      // cellule source = celle du nœud ; si elle est bloquée (mur posé contre le
      // bâtiment), la plus proche cellule libre (spirale carrée) garde un champ
      let sx = bclamp((srcX / FLOW_CELL) | 0, 0, flowW - 1);
      let sy = bclamp((srcY / FLOW_CELL) | 0, 0, flowH - 1);
      if (flowBlocked[sy * flowW + sx]) {
        outer: for (let ring = 1; ring < Math.max(flowW, flowH); ring++) {
          for (let oy = -ring; oy <= ring; oy++) for (let ox = -ring; ox <= ring; ox++) {
            if (Math.max(ox < 0 ? -ox : ox, oy < 0 ? -oy : oy) !== ring) continue;
            const nx = sx + ox, ny = sy + oy;
            if (nx < 0 || ny < 0 || nx >= flowW || ny >= flowH) continue;
            if (!flowBlocked[ny * flowW + nx]) { sx = nx; sy = ny; break outer; }
          }
        }
      }
      let head = 0, tail = 0;
      const start = sy * flowW + sx;
      flowVisited[start] = 1;
      flowQueue[tail++] = start;
      while (head < tail) {
        const c = flowQueue[head++];
        const cx = c % flowW, cy = (c / flowW) | 0;
        for (let k = 0; k < 8; k++) {
          const ox = FLOW_OX[k], oy = FLOW_OY[k];
          const nx = cx + ox, ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= flowW || ny >= flowH) continue;
          const ni = ny * flowW + nx;
          if (flowVisited[ni] || flowBlocked[ni]) continue;
          // diagonale INTERDITE si un des 2 orthogonaux adjacents est bloqué
          // (pas de rase-coin à travers l'angle d'un obstacle)
          if (ox !== 0 && oy !== 0 && (flowBlocked[cy * flowW + nx] || flowBlocked[ny * flowW + cx])) continue;
          flowVisited[ni] = 1;
          f.dx[ni] = -ox; f.dy[ni] = -oy; // le flux remonte vers la cellule parente
          flowQueue[tail++] = ni;
        }
      }
      f.ver = obsVer; f.len = obstacles.length;
      return f;
    }
    function flowFieldFor(node) { return flowFieldAt(node.id, node.x, node.y); }

    // ligne de vue : segment (x0,y0)→(x1,y1) contre les cercles d'obstacles
    function flowLosClear(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0;
      const len2 = dx * dx + dy * dy;
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const rr = (o.r || 0) + 8;
        let t = len2 > 0 ? ((o.x - x0) * dx + (o.y - y0) * dy) / len2 : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const px = x0 + dx * t - o.x, py = y0 + dy * t - o.y;
        if (px * px + py * py < rr * rr) return false;
      }
      return true;
    }

    // Point de marche AVAL pour l'agent a visant le nœud tgt (dGoal = distance).
    // true → flowGX/flowGY remplis (le flux dévie la marche) ; false → ligne
    // droite (pas d'obstacle entre les deux, abords du nœud, ou champ muet —
    // comportement historique inchangé).
    // échantillonnage bilinéaire d'un champ à la position de l'agent →
    // flowDX/DY/GX/GY remplis. false si champ muet (cellule bloquée/injoignable).
    function flowSample(f, a) {
      // LERP bilinéaire des 4 cellules voisines (lissage du champ)
      const gx = a.x / FLOW_CELL - 0.5, gy = a.y / FLOW_CELL - 0.5;
      const cx0 = Math.floor(gx), cy0 = Math.floor(gy);
      const fx = gx - cx0, fy = gy - cy0;
      let vx = 0, vy = 0;
      for (let k = 0; k < 4; k++) {
        const cx = cx0 + (k & 1), cy = cy0 + (k >> 1);
        if (cx < 0 || cy < 0 || cx >= flowW || cy >= flowH) continue;
        const i = cy * flowW + cx;
        const w2 = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy);
        vx += f.dx[i] * w2; vy += f.dy[i] * w2;
      }
      const n = Math.hypot(vx, vy);
      // champ muet : agent SUR une cellule bloquée (mur de sort posé sous lui)
      // ou zone injoignable → fallback historique (la poussée radiale le sort)
      if (n < 0.05) return false;
      const LOOK = 48; // point aval ~1,5 cellule devant
      flowDX = vx / n; flowDY = vy / n;
      flowGX = a.x + flowDX * LOOK;
      flowGY = a.y + flowDY * LOOK;
      return true;
    }
    function flowGoal(a, tgt, dGoal) {
      if (obstacles.length === 0) return false;
      if (dGoal < NODE_R + 24) return false;                  // aux abords : cohue normale
      if (flowLosClear(a.x, a.y, tgt.x, tgt.y)) return false; // court-circuit ligne droite
      return flowSample(flowFieldFor(tgt), a);
    }
    // §MOUV2 : point de marche aval vers la CELLULE d'un foe (poursuite barrée
    // par un obstacle). Champ mémoïsé par cellule (clé négative, borné) — un foe
    // statique derrière une pierre coûte UN BFS amorti, un foe mobile un par
    // cellule traversée.
    function flowFoeGoal(a, fx, fy) {
      if (obstacles.length === 0) return false;
      const ci = bclamp((fy / FLOW_CELL) | 0, 0, flowH - 1) * flowW + bclamp((fx / FLOW_CELL) | 0, 0, flowW - 1);
      return flowSample(flowFieldAt(-1 - ci, fx, fy), a);
    }

    function emit(ev) {
      if (!cfg.onEvent) return;
      try {
        cfg.onEvent(ev);
      } catch (e) {
        // L'UI ne doit pas tuer la simulation, mais avaler l'erreur rend une
        // victoire ou une défaite impossible à diagnostiquer : le moteur est
        // alors figé sur `ended` sans que le joueur voie le résultat.
        console.error('[Battle] événement UI non traité :', ev && ev.type, e);
      }
    }

    // ---- stats -------------------------------------------------
    function defaultStats(faction, type) {
      const base = BGD.UNIT_TYPES[type].base;
      const isEnemy = faction !== pf;
      const wpn = isEnemy ? bclamp(enemyLook.weapon || 0, 0, BGD.WEAPONS.length - 1) : 0;
      const arm = isEnemy ? bclamp(enemyLook.armor || 0, 0, BGD.ARMORS.length - 1) : 0;
      const evo = isEnemy ? bclamp(enemyLook.evo || 0, 0, 30) : 0;
      const diff = isEnemy ? difficulty : 1;
      const em = BGD.evoStatMult(evo);
      return {
        hp: base.hp * em * BGD.ARMORS[arm].hpMult * diff,
        dmg: base.dmg * em * BGD.WEAPONS[wpn].dmgMult * diff,
        aspd: base.aspd, mspd: base.mspd, range: base.range, ability: BGD.UNIT_TYPES[type].ability || null,
        regen: 0, cat: BGD.UNIT_TYPES[type].cat || 'melee',
        weapon: wpn, armor: arm, evo: evo,
        ranged: isEnemy ? (enemyLook.ranged || 0) : 0, staff: isEnemy ? (enemyLook.staff || 0) : 0,
      };
    }
    function statsFor(faction, type) {
      if (cfg.getStats) {
        try {
          const s = cfg.getStats(faction, type);
          if (s && s.hp > 0) return s;
        } catch (e) { /* fallback */ }
      }
      return defaultStats(faction, type);
    }
    // stats "génériques" d'une garnison (pour les PV / riposte)
    function garrisonUnitHp(n, type) {
      const s = n.owner ? statsFor(n.owner, type) : BGD.UNIT_TYPES[type].base;
      // MAJ §3 : la fortification profite au camp propriétaire (joueur OU IA — scaling)
      return s.hp * (1 + (n.defBonus || 0)) * (n.owner ? 1 + bfBonus(n.owner, 'fortify') : 1);
    }
    function garrisonDmg(n) {
      // dégâts de riposte : le type le plus costaud présent
      for (let i = UNIT_ORDER.length - 1; i >= 0; i--) {
        const t = UNIT_ORDER[i];
        if (n.g[t] > 0) {
          const s = n.owner ? statsFor(n.owner, t) : BGD.UNIT_TYPES[t].base;
          return s.dmg * (1 + (n.defBonus || 0));
        }
      }
      return 0;
    }

    // ---- état runtime des nœuds ---------------------------------
    const ns = map.nodes.map(src => ({
      id: src.id, x: src.x, y: src.y, kind: src.kind,
      owner: src.owner || null,
      g: Object.assign({}, src.garrison),
      cap: src.cap, prodRate: src.prodRate || 0, prodType: src.prodType || 'lancier',
      defBonus: src.defBonus || 0,
      prodAcc: 0, queue: [], sendAcc: 0, queueOwner: null,
      gDmg: 0, hurtT: 0, bump: 0, towerCd: 1 + Math.random(),
      retalT: 0.4 + Math.random() * 0.4,
      fxPulse: 0, spawnSeq: 0,
      logiT: 0, espionHit: null, // §7 : aura porteur + participation espion à la capture
      prodBlockT: 0, // §boss corbeau (blockprod) : prod gelée tant que > 0
      healT: 0, // §B avant-poste : tick de l'aura de soin
    }));
    const nById = {};
    for (const n of ns) nById[n.id] = n;

    // Une bataille personnelle commence avec le QG du joueur en main. Sans
    // cette sélection, le premier écran montre un bouton Renfort grisé et
    // demande de deviner quel bâtiment minuscule est allié pendant que l'IA,
    // elle, joue déjà. Le joueur peut donc cliquer immédiatement une cible
    // pour avancer, ou renforcer ce point de départ.
    if (mode === 'personal') {
      const playerHq = ns.find(n => n.kind === 'hq' && n.owner === pf);
      if (playerHq) selectedId = playerHq.id;
    }

    // état de la victoire par points de contrôle
    const ctrlNodes = ns.filter(n => n.kind === 'controle');
    const ctrlTotal = ctrlNodes.length;
    const ctrlPts = { cats: 0, birds: 0 };
    let ctrlAcc = 0;
    // §6 (D15) Drapeaux : le camp du JOUEUR accumule ses points ×(1+eff).
    // Fraction portée dans ctrlFrac pour que ctrlPts reste un ENTIER (affichage).
    const ctrlFrac = { cats: 0, birds: 0 };
    const flagMul = 1 + ((cfg.building && cfg.building.flags) || 0);
    const flagMulE = 1 + ((cfg.enemyBuilding && cfg.enemyBuilding.flags) || 0); // MAJ §3 : scaling IA

    // §B avant-poste : dernier avant-poste capturé par camp (point de déploiement avancé)
    const lastOutpost = { cats: null, birds: null };
    function activeOutpost(f) {
      const last = lastOutpost[f];
      if (last && last.owner === f && last.kind === 'avantposte') return last;
      // repli : l'avant-poste possédé le plus proche du QG ADVERSE (le front)
      const hqFoe = ns.find(n2 => n2.kind === 'hq' && n2.owner && n2.owner !== f);
      let best = null, bd = Infinity;
      for (const n2 of ns) {
        if (n2.kind !== 'avantposte' || n2.owner !== f) continue;
        const d = hqFoe ? bdist(n2.x, n2.y, hqFoe.x, hqFoe.y) : -n2.x;
        if (d < bd) { bd = d; best = n2; }
      }
      return best;
    }

    // MAJ §3 : bonus d'ingénierie par camp — le joueur lit cfg.building, l'IA lit
    // cfg.enemyBuilding (scaling fourni par progression.js selon le stage).
    function bfBonus(f, id) {
      const src = f === pf ? cfg.building : cfg.enemyBuilding;
      return (src && src[id]) || 0;
    }

    // MAJ §7 : sort « piquants » — pendant un temps, les bâtiments du camp
    // enchanté mordent tout ennemi qui passe à proximité (l'ancien comportement
    // passif retiré en §1, rendu ici en VERSION ACTIVE, temporaire et alchimique).
    const spikeAuraT = { cats: 0, birds: 0 };
    const spikeAuraPow = { cats: 0, birds: 0 };

    // §6 : Étendards — +10% dmg/hp par étendard possédé, recalculé à chaque capture.
    // MAJ §3 : la piste 'banner' renforce le buff du camp (jusqu'à ~+20%/étendard).
    const bannM = { cats: 1, birds: 1 };
    function refreshBanners() {
      let c = 1, b = 1;
      for (const n of ns) {
        if (n.kind !== 'banner') continue;
        if (n.owner === 'cats') c += 0.1 * (1 + bfBonus('cats', 'banner'));
        else if (n.owner === 'birds') b += 0.1 * (1 + bfBonus('birds', 'banner'));
      }
      bannM.cats = c; bannM.birds = b;
    }
    refreshBanners();

    function nearestNode(x, y, filter) {
      let best = null, bd = 1e9;
      for (const n of ns) {
        if (filter && !filter(n)) continue;
        const d = bdist(x, y, n.x, n.y);
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    }

    function nodeGTot(n) { return gTot(n.g); }

    // ---- agents / projectiles / particules ----------------------
    const agents = [];
    const zones = []; // traînées de dégâts, volontairement légères et bornées
    let agentSeq = 1;
    let regSeq = 0;   // §régiment : compteur de vagues (concept RUNTIME, jamais sérialisé)
    const projectiles = [];
    const particles = [];
    const dmgTexts = [];
    const souls = [];        // §B5 : pool d'âmes (mort → silhouette qui s'élève)
    let pixTmp = null;       // §pixel : tampon pour le filtre pixel-art plein écran
    let soulHead = 0;        // curseur d'anneau du pool d'âmes
    let playerKills = 0;
    /* AJOUT : les pertes du camp du joueur. Le moteur savait dire
       combien il avait tué, jamais combien il avait perdu — or c'est
       ce chiffre qui décide de ce qui remonte à bord. */
    let playerLosses = 0;
    let espionLoot = 0; // §7 : butin de food ramassé sur les captures avec espion

    // ---- BOSS DE CARTE (DESIGN9 §Bataille) v2 : présences NEUTRES, INVULNÉRABLES,
    // PERMANENTES. Plus de PV, plus de mort, plus de badge. Elles n'encaissent RIEN :
    // elles INFLUENCENT la bataille par un effet permanent ou périodique (9 effets
    // distincts, dispatchés sur def.effect). RUNTIME PUR : jamais sérialisées,
    // réinstanciées depuis map.bosses à la reprise. Tout gardé défensivement : pas de
    // MAP_BOSSES / pas de map.bosses / effet inconnu = zéro crash. Elles ne capturent
    // RIEN (faction 'neutral' → hors de getControl/victoire). L'exception = la Reine
    // (effect 'spawner') qui pond une 3e ARMÉE 'wild', hostile aux DEUX camps.
    const mapBosses = [];    // {mapBoss,type,def,x,y,rad,animT,cd,aim,pool,zone,rockCount}
    const bossBeams = [];    // fx trait éphémère {x0,y0,x1,y1,life,tot,col,bolt?}
    const BOSS_FACTION = 'neutral'; // ni chats ni oiseaux ni wild → touche tout, ne capture rien
    // legacy : si un vieux data.js (champ `attack`, pas `effect`) traîne encore, on
    // ne casse rien — on traduit vers un effet v2 le temps que l'agent A atterrisse.
    const LEGACY_EFFECT = { laser: 'laser', lob: 'lightning', web: 'slow', spore: 'poison' };
    function bossEffect(def) { return def.effect || LEGACY_EFFECT[def.attack] || 'laser'; }
    function bossDefFor(type) {
      const list = BGD.MAP_BOSSES;
      if (!Array.isArray(list)) return null;
      for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === type) return list[i];
      return null;
    }
    function initMapBosses() {
      const src = map && Array.isArray(map.bosses) ? map.bosses : null;
      if (!src) return;
      for (const b of src) {
        if (!b) continue;
        const def = bossDefFor(b.type);
        if (!def) continue; // type inconnu ou MAP_BOSSES absent → on saute, sans broncher
        mapBosses.push({
          mapBoss: true, type: b.type, def, effect: bossEffect(def),
          x: +b.x || 0, y: +b.y || 0,
          rad: 22 * COMBAT_SCALE, animT: Math.random() * 6,
          cd: (def.cd || 2) * (0.3 + Math.random() * 0.6), // 1er déclenchement désynchronisé
          aim: 0, pool: null, zone: null, rockCount: 0,
        });
      }
    }
    initMapBosses();

    // cible monocible : l'unité vivante la plus proche à portée (tous camps confondus)
    function bossNearestFoe(B, range) {
      let tgt = null, td = range + 1;
      eachNear(B.x, B.y, range, (o) => {
        if (o.dead) return;
        const d = bdist(o.x, o.y, B.x, B.y);
        if (d <= range && d < td) { td = d; tgt = o; }
      });
      return tgt;
    }

    // 3e ARMÉE — faction 'wild'. Sbire de la Reine : hostile aux DEUX camps (findFoe
    // les traite en ennemis puisque leur faction diffère), ciblé par les deux, MAIS ne
    // capture RIEN et ne possède AUCUN nœud : il erre autour de son QG (le boss),
    // mord ce qui passe, et revient. PV modestes, meurt en âme (B5). RUNTIME pur.
    function wildCount(B) { let c = 0; for (const a of agents) if (!a.dead && a.wildBoss === B) c++; return c; }
    function spawnWild(B) {
      const def = B.def;
      const hp = (def.minionHp > 0 ? def.minionHp : 55) * (1 + (difficulty - 1) * 0.4);
      const dmg = (def.minionDmg > 0 ? def.minionDmg : 8) * (mode === 'personal' ? difficulty : 1);
      const an = Math.random() * Math.PI * 2;
      const rr = B.rad + 6 + Math.random() * 16;
      const x = bclamp(B.x + Math.cos(an) * rr, 8, map.w - 8);
      const y = bclamp(B.y + Math.sin(an) * rr, 8, map.h - 8);
      const st = {
        hp, dmg, aspd: def.minionAspd > 0 ? def.minionAspd : 0.85,
        mspd: def.minionSpd > 0 ? def.minionSpd : 44, range: 0,
        ability: null, regen: 0, cat: 'melee', evo: 0, weapon: 0, armor: 0, ranged: 0, staff: 0,
      };
      const a = {
        id: agentSeq++, f: 'wild', type: 'wild', wild: true, wildBoss: B, wildType: def.id,
        homeX: B.x, homeY: B.y, wanderR: (def.range > 0 ? def.range : 100),
        x, y, vx: 0, vy: 0, angle: an, phase: Math.random() * Math.PI * 2,
        hp, maxHp: hp, dmg, st, buffed: false, spec: null,
        scale: (def.minionScale > 0 ? def.minionScale : 0.5) * COMBAT_SCALE,
        target: { x: B.x, y: B.y, owner: 'wild' }, ox: 0, oy: 0,
        foe: null, scanT: Math.random() * 0.2, cd: 0.3 + Math.random() * 0.4,
        lunge: 0, flash: 0, dmgTxtT: 0, dead: false, trailT: 0, auraT: 0, boostT: 0,
        invulnT: 0.3, potBuffT: 0, potBuffPow: 0, dashCd: 1, noteT: 1, fuseT: 0.3,
        engagedBy: 0, siegeNode: null, slowT: 0, slowPow: 0, confuseT: 0, tempLife: 0, stunT: 0,
      };
      agents.push(a);
      puff(x, y, def.col || '#e0b040', 6, 30, 2.2);
      return a;
    }

    // ---- TICK DES 9 EFFETS -----------------------------------------------------
    function updateMapBosses(dt) {
      // fx traits : ils s'éteignent même s'il n'y a plus de boss
      for (let i = bossBeams.length - 1; i >= 0; i--) { bossBeams[i].life -= dt; if (bossBeams[i].life <= 0) bossBeams.splice(i, 1); }
      if (!mapBosses.length) return;
      for (let i = 0; i < mapBosses.length; i++) {
        const B = mapBosses[i];
        const def = B.def;
        B.animT += dt;
        B.cd -= dt;
        if (B.aim > 0) B.aim -= dt;
        const r = def.r > 0 ? def.r : 40;
        const range = def.range > 0 ? def.range : 130;
        const dmg = def.dmg > 0 ? def.dmg : 20;
        const col = def.col || '#c880ff';

        switch (B.effect) {
          // 1) LASER — trait instantané monocible sur la plus proche à portée, gros dégât.
          case 'laser': {
            const tgt = bossNearestFoe(B, range);
            if (!tgt || B.cd > 0) break;
            B.cd = def.cd > 0 ? def.cd : 1.4;
            B.aim = 0.18;
            hurtAgent(tgt, def.dmg > 0 ? def.dmg : 45, BOSS_FACTION, B.x, B.y);
            bossBeams.push({ x0: B.x, y0: B.y - B.rad * 0.4, x1: tgt.x, y1: tgt.y, life: 0.16, tot: 0.16, col });
            puff(tgt.x, tgt.y, col, 6, 42, 2.2);
            sfx('pop', 150);
            break;
          }
          // 2) SLOW — aura PERMANENTE : une flaque persistante centrée sur le boss
          // ralentit tout ce qui traîne dans r (réutilise slowPools ; life rafraîchie
          // ici après la décrémentation globale → jamais purgée tant que le boss vit).
          case 'slow': {
            if (!B.pool) { B.pool = { x: B.x, y: B.y, r, pow: def.slow > 0 ? def.slow : 0.55, f: BOSS_FACTION, life: 1, boss: true }; slowPools.push(B.pool); }
            B.pool.life = 1; B.pool.r = r; B.pool.pow = def.slow > 0 ? def.slow : 0.55;
            if (B.cd <= 0) { B.cd = 0.5; puff(B.x + (Math.random() - 0.5) * r, B.y + (Math.random() - 0.5) * r, col, 2, 12, 1.6); }
            break;
          }
          // 3) POISON — nuage de spores ENTRETENU dans r (réutilise zones ; z.dmg = DPS).
          case 'poison': {
            if (!B.zone) { B.zone = { x: B.x, y: B.y, f: BOSS_FACTION, life: 1, r, dmg: dmg * 0.9, col, poison: true }; zones.push(B.zone); }
            B.zone.life = 1; B.zone.r = r; B.zone.dmg = dmg * 0.9;
            if (B.cd <= 0) { B.cd = 0.6; puff(B.x + (Math.random() - 0.5) * r * 0.8, B.y + (Math.random() - 0.5) * r * 0.8, col, 3, 16, 1.8); }
            break;
          }
          // 4) PARALYZE — périodiquement, fige les unités dans r (stunned/stunT lu dans
          // update : ni marche ni attaque ~stunDur s). Léger dmg + fx éclair.
          case 'paralyze': {
            if (B.cd > 0) break;
            B.cd = def.cd > 0 ? def.cd : 3;
            const dur = def.stunDur > 0 ? def.stunDur : 1.2;
            const zap = def.dmg > 0 ? def.dmg : 4;
            let any = false;
            eachNear(B.x, B.y, r, (o) => {
              if (o.dead || bdist(o.x, o.y, B.x, B.y) > r) return;
              o.stunned = true; o.stunT = Math.max(o.stunT || 0, dur);
              if (zap > 0) hurtAgent(o, zap, BOSS_FACTION, B.x, B.y);
              any = true;
            });
            bossBeams.push({ x0: B.x, y0: B.y - r, x1: B.x, y1: B.y, life: 0.18, tot: 0.18, col, bolt: true });
            if (any) { puff(B.x, B.y, col, 8, 40, 2.4); sfx('pop', 120); }
            break;
          }
          // 5) BLOCKPROD — périodiquement, GÈLE la production des nœuds à range pendant
          // blockDur s (flag n.prodBlockT lu dans updateProduction).
          case 'blockprod': {
            if (B.cd > 0) break;
            B.cd = def.cd > 0 ? def.cd : 5;
            const dur = def.blockDur > 0 ? def.blockDur : 4;
            let touched = false;
            for (const n of ns) {
              if (bdist(n.x, n.y, B.x, B.y) > range) continue;
              n.prodBlockT = Math.max(n.prodBlockT || 0, dur);
              n.fxPulse = Math.max(n.fxPulse || 0, 0.5);
              touched = true;
            }
            if (touched) { puff(B.x, B.y, col, 8, 44, 2.4); sfx('squish', 200); }
            break;
          }
          // 6) ROCKS — périodiquement, plante une ROCHE (obstacle) près du boss. Cap
          // rockCap + distance mini aux nœuds/roches → JAMAIS 100 % bloquant.
          // L'évitement d'obstacle existant s'occupe du reste.
          case 'rocks': {
            if (B.cd > 0) break;
            B.cd = def.cd > 0 ? def.cd : 4;
            const cap = def.rockCap > 0 ? def.rockCap : 5;
            if (B.rockCount >= cap) break;
            const rr = def.rockR > 0 ? def.rockR : (16 + Math.random() * 10);
            const ring = def.range > 0 ? def.range : 70;
            for (let tries = 0; tries < 14; tries++) {
              const an = Math.random() * Math.PI * 2;
              const rad = 34 + Math.random() * ring;
              const x = bclamp(B.x + Math.cos(an) * rad, 44, map.w - 44);
              const y = bclamp(B.y + Math.sin(an) * rad, 44, map.h - 44);
              let ok = true;
              for (const n of ns) if (bdist(x, y, n.x, n.y) < rr + 58) { ok = false; break; }
              if (ok) for (const o of obstacles) if (bdist(x, y, o.x, o.y) < rr + (o.r || 0) + 30) { ok = false; break; }
              if (!ok) continue;
              obstacles.push({ kind: 'rock', x: Math.round(x), y: Math.round(y), r: Math.round(rr), seed: 1 + Math.floor(Math.random() * 999983), bossRock: true });
              obsVer++; // §OBST : invalide les champs de flux mémoïsés
              B.rockCount++;
              puff(x, y, '#8a8478', 8, 36, 2.4);
              sfx('pop', 200);
              break;
            }
            break;
          }
          // 7) SPAWNER — la Reine pond la 3e armée 'wild' (spawn tant que nb < capWild).
          case 'spawner': {
            if (B.cd > 0) break;
            B.cd = def.cd > 0 ? def.cd : 2;
            const cap = def.capWild > 0 ? def.capWild : 6;
            if (agents.length < AGENT_CAP && wildCount(B) < cap) {
              spawnWild(B);
              B.aim = 0.2;
              sfx('whoosh', 200);
            }
            break;
          }
          // 8) LIGHTNING — périodiquement, la foudre frappe 1-2 points ALÉATOIRES de
          // TOUTE la carte : éclair + AoE instantané aux DEUX camps (BOSS_FACTION).
          case 'lightning': {
            if (B.cd > 0) break;
            B.cd = def.cd > 0 ? def.cd : 3.5;
            const strikes = 1 + (Math.random() < 0.5 ? 1 : 0);
            for (let s = 0; s < strikes; s++) {
              const x = 40 + Math.random() * (map.w - 80), y = 40 + Math.random() * (map.h - 80);
              bossBeams.push({ x0: x, y0: Math.max(0, y - 140), x1: x, y1: y, life: 0.22, tot: 0.22, col: col, bolt: true });
              aoeDamage(x, y, r, dmg, BOSS_FACTION, x, y);
              puff(x, y, col, 10, 52, 2.6);
            }
            sfx('pop', 120);
            break;
          }
          // 9) LAVA — idem la foudre, mais dépose une ZONE DE LAVE persistante (DoT au
          // sol quelques secondes, réutilise zones, couleur feu).
          case 'lava': {
            if (B.cd > 0) break;
            B.cd = def.cd > 0 ? def.cd : 4;
            const strikes = 1 + (Math.random() < 0.5 ? 1 : 0);
            const lifeL = def.lavaDur > 0 ? def.lavaDur : 4;
            for (let s = 0; s < strikes; s++) {
              const x = 40 + Math.random() * (map.w - 80), y = 40 + Math.random() * (map.h - 80);
              bossBeams.push({ x0: x, y0: Math.max(0, y - 130), x1: x, y1: y, life: 0.22, tot: 0.22, col: '#ffb14d', bolt: true });
              if (zones.length < 90) zones.push({ x, y, f: BOSS_FACTION, life: lifeL, r, dmg, col: '#ff6a2a', lava: true });
              puff(x, y, '#ff7a3a', 10, 46, 2.4);
            }
            sfx('whoosh', 160);
            break;
          }
          default: break; // effet inconnu : le boss reste posé, inerte, mais présent
        }
      }
    }

    // Boss INVULNÉRABLE : pas de PV, pas de badge, pas de mort. Un décor menaçant qui agit.
    function drawMapBoss(B, t) {
      const size = Math.max(30, B.rad * 2.6);
      let cv = null;
      if (Sprites && Sprites.getBossCanvas) { try { cv = Sprites.getBossCanvas(B.type, Math.round(size), B.animT); } catch (e) { cv = null; } }
      // ombre portée
      ctx.fillStyle = 'rgba(15,20,15,0.28)';
      ctx.beginPath(); ctx.ellipse(B.x, B.y + B.rad * 0.7, B.rad * 0.9, B.rad * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      if (cv && cv.width > 0) {
        ctx.drawImage(cv, B.x - size / 2, B.y - size / 2, size, size);
      } else {
        // repli sans sprite : cercle teinté + emoji, jamais de crash
        const col = B.def.col || '#b06cff';
        const pulse = 1 + Math.sin(B.animT * 3) * 0.04;
        ctx.fillStyle = hexA(col, 0.9);
        ctx.beginPath(); ctx.arc(B.x, B.y, B.rad * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(B.x, B.y, B.rad * pulse, 0, Math.PI * 2); ctx.stroke();
        if (B.def.emoji) {
          ctx.font = Math.round(B.rad * 1.3) + 'px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(B.def.emoji, B.x, B.y + 1);
          ctx.textBaseline = 'alphabetic';
        }
      }
      // lueur d'activité (laser qui charge, reine qui pond, éclair qui claque)
      if (B.aim > 0) {
        ctx.globalAlpha = bclamp(B.aim / 0.2, 0, 1) * 0.7;
        ctx.fillStyle = B.def.col || '#ff5a5a';
        ctx.beginPath(); ctx.arc(B.x, B.y - B.rad * 0.2, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Rendu d'un sbire 'wild' : mini-skin dédié de S (getBossMinion), repli
    // getBossCanvas('reine', petit), puis cercle/emoji dessiné. Barre de vie fine.
    function drawWildMinion(a, t) {
      const size = Math.max(16, 44 * a.scale);
      let cv = null;
      try {
        if (Sprites && Sprites.getBossMinion) cv = Sprites.getBossMinion(Math.round(size), a.phase);
        else if (Sprites && Sprites.getBossCanvas) cv = Sprites.getBossCanvas(a.wildType || 'reine', Math.round(size), a.phase);
      } catch (e) { cv = null; }
      ctx.fillStyle = 'rgba(15,20,15,0.26)';
      ctx.beginPath(); ctx.ellipse(a.x, a.y + size * 0.32, size * 0.3, size * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      if (cv && cv.width > 0) {
        ctx.drawImage(cv, a.x - size / 2, a.y - size / 2, size, size);
      } else {
        const col = (a.wildBoss && a.wildBoss.def && a.wildBoss.def.col) || '#e0b040';
        ctx.fillStyle = hexA(col, 0.92);
        ctx.beginPath(); ctx.arc(a.x, a.y, size * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(a.x, a.y, size * 0.32, 0, Math.PI * 2); ctx.stroke();
      }
      if (a.flash > 0) {
        ctx.globalAlpha = Math.min(1, a.flash / 0.12) * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(a.x, a.y, size * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (a.hp < a.maxHp - 0.5) {
        const pct = bclamp(a.hp / a.maxHp, 0, 1);
        const bw = 14, bx = a.x - bw / 2, by = a.y - size * 0.42 - 4;
        ctx.fillStyle = 'rgba(20,20,30,0.55)';
        ctx.fillRect(bx - 0.5, by - 0.5, bw + 1, 3);
        ctx.fillStyle = pct > 0.5 ? '#e0b040' : (pct > 0.25 ? '#f2c24e' : '#e05252');
        ctx.fillRect(bx, by, bw * pct, 2);
      }
    }

    // grille spatiale
    const CELL = 40;
    const grid = new Map();
    function gridKey(cx, cy) { return cx * 4096 + cy; }
    function rebuildGrid() {
      grid.clear();
      for (const a of agents) {
        const k = gridKey((a.x / CELL) | 0, (a.y / CELL) | 0);
        let cell = grid.get(k);
        if (!cell) grid.set(k, cell = []);
        cell.push(a);
      }
    }
    function eachNear(x, y, r, fn) {
      const c0x = ((x - r) / CELL) | 0, c1x = ((x + r) / CELL) | 0;
      const c0y = ((y - r) / CELL) | 0, c1y = ((y + r) / CELL) | 0;
      for (let gx = c0x; gx <= c1x; gx++) {
        for (let gy = c0y; gy <= c1y; gy++) {
          const cell = grid.get(gridKey(gx, gy));
          if (!cell) continue;
          for (let i = 0; i < cell.length; i++) if (fn(cell[i]) === true) return;
        }
      }
    }

    // ---- vue / letterbox ----------------------------------------
    const view = { s: 1, ox: 0, oy: 0, cw: 0, ch: 0 };
    function resize() {
      const cw = canvas.clientWidth || 320, ch = canvas.clientHeight || 200;
      view.cw = cw; view.ch = ch;
      const bw = Math.round(cw * DPR), bh = Math.round(ch * DPR);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      view.s = Math.min(cw / map.w, ch / map.h);
      view.ox = (cw - map.w * view.s) / 2;
      view.oy = (ch - map.h * view.s) / 2;
    }
    resize();
    function toWorld(cssX, cssY) {
      return { x: (cssX - view.ox) / view.s, y: (cssY - view.oy) / view.s };
    }
    // coordonnées ÉCRAN pour FX (overlay fixed)
    function scr(wx, wy) {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + view.ox + wx * view.s, y: r.top + view.oy + wy * view.s };
    }
    function fxVisible() {
      const r = canvas.getBoundingClientRect();
      return r.width > 4 && r.bottom > 0 && r.top < (window.innerHeight || 9999);
    }

    // ---- terrain pré-rendu + décor animé (§D : cache par seed+dims+thème) --------
    const terrain = getTerrain(map, cfg.theme || map.theme);
    const critters = [];
    {
      const rnd = mulberry32(((map.seed || 3) * 51 + 9) >>> 0);
      const cols = ['#f2d24e', '#e8788a', '#b48cff'];
      for (let i = 0; i < 3; i++) {
        critters.push({
          x: rnd() * map.w, y: rnd() * map.h,
          p1: rnd() * 10, p2: rnd() * 10, sp: 0.3 + rnd() * 0.4,
          col: cols[i % 3],
        });
      }
    }

    // ---- particules ---------------------------------------------
    function puff(x, y, col, n, speed, size) {
      const cnt = Math.min(n || 6, 340 - particles.length);
      for (let i = 0; i < cnt; i++) {
        const an = Math.random() * Math.PI * 2;
        const sp = (speed || 26) * (0.4 + Math.random() * 0.8);
        particles.push({
          x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 8,
          life: 0.45 + Math.random() * 0.3, tot: 0.7,
          size: (size || 2.4) * (0.6 + Math.random() * 0.8), col: col || '#ffffff',
        });
      }
    }
    function addDmgText(x, y, txt, col) {
      if (dmgTexts.length > 40) return;
      dmgTexts.push({ x: x + (Math.random() - 0.5) * 8, y: y - 10, txt, col: col || '#fff', life: 0.6 });
    }

    // §B5 : pool d'âmes — à CHAQUE mort d'unité (champ ou bâtiment) on lâche une
    // silhouette turquoise qui monte en ondulant sur 1 s puis se dissout. Pool
    // borné, réutilisé en anneau : zéro alloc dans la boucle chaude passé le cap.
    const SOUL_CAP = 64;
    function spawnSoul(faction, x, y, size) {
      let s;
      if (souls.length < SOUL_CAP) { s = {}; souls.push(s); }
      else { s = souls[soulHead]; soulHead = (soulHead + 1) % SOUL_CAP; }
      s.x = x; s.x0 = x; s.y = y; s.y0 = y;
      s.f = (faction === 'cats' || faction === 'birds') ? faction : 'birds';
      s.size = Math.max(10, size || 16);
      s.t = 0; s.dur = 1; s.phase = Math.random() * Math.PI * 2; s.dead = false;
      s.cv = null;
      // le sprite d'âme vient de V (Sprites) ; gardé par if → repli sans crash
      if (Sprites.getSoulCanvas) { try { s.cv = Sprites.getSoulCanvas(s.f, Math.round(s.size)); } catch (e) { s.cv = null; } }
      return s;
    }

    // ---- spawn / envoi -------------------------------------------
    function rallyMult(faction) {
      return 1 + bfBonus(faction, 'rally'); // MAJ §3 : les deux camps (scaling IA)
    }
    function spawnAt(x, y, faction, type, target) {
      const st = statsFor(faction, type);
      let hp = st.hp, dmg = st.dmg;
      let buffed = false;
      // aura de renfort : appliquée au spawn si un totem allié est proche
      for (const rn of ns) {
        if (rn.kind !== 'reinforce' || rn.owner !== faction) continue;
        if (bdist(x, y, rn.x, rn.y) < 150) { buffed = true; rn.fxPulse = Math.max(rn.fxPulse, 0.6); break; }
      }
      if (buffed) { hp *= 1.25; dmg *= 1.25; }
      hp *= bannM[faction] || 1; // l'Étendard gonfle les PV à la sortie (dmg : dynamique)
      const an = Math.atan2(target.y - y, target.x - x);
      const rm = rallyMult(faction);
      const a = {
        id: agentSeq++, f: faction, type,
        x, y,
        vx: Math.cos(an) * st.mspd * 0.4 * rm, vy: Math.sin(an) * st.mspd * 0.4 * rm,
        angle: an, phase: Math.random() * Math.PI * 2,
        hp, maxHp: hp, dmg,
        st, buffed,
        // spec de rendu : les frames sont récupérées par DIRECTION dans drawAgent
        // (le modèle pivote vers son déplacement au lieu d'une rotation 2D à plat).
        spec: { faction, type, evo: st.evo || 0, weapon: st.weapon || 0, armor: st.armor || 0, ranged: st.ranged || 0, staff: st.staff || 0, ordnance: st.ordnance || 0, robe: st.robe || 0, vest: st.vest || 0, suit: st.suit || 0 },
        scale: BGD.UNIT_TYPES[type].scale * (1 + 0.04 * (BGD.visualRank ? BGD.visualRank(st.evo || 0) : (st.evo || 0))) * COMBAT_SCALE * 0.5,
        target, ox: (Math.random() - 0.5) * 34, oy: (Math.random() - 0.5) * 34,
        foe: null, scanT: Math.random() * 0.2, cd: 0.2 + Math.random() * 0.4,
        lunge: 0, flash: 0, dmgTxtT: 0, dead: false, trailT: 0, auraT: 0, boostT: 0,
        invulnT: 0.4, // invulnérabilité de sortie : fini le carnage à la porte
        potBuffT: 0, potBuffPow: 0, dashCd: 1 + Math.random(), noteT: 1 + Math.random(), fuseT: 0.3,
        engagedBy: 0, siegeNode: null, // §6 : verrouillage 1v1 + pairing de siège
        slowT: 0, slowPow: 0, confuseT: 0, tempLife: 0,
        invokeT: 4 + Math.random() * 3, // invocateur : premier appel décalé
        hasteBoostT: 0, repairAcc: 0, // §7 : buff d'horlogerie reçu + accumulateur de réparation
      };
      // §D17-3 : pouvoir d'unité — présent seulement si getStats le fournit (joueur)
      a.power = st.power || null;
      if (a.power) initPower(a);
      // §7 : l'espion sort de l'ombre — non ciblable jusqu'à sa 1re frappe
      if (st.ability === 'stealth') { a.stealthed = true; a.firstStrike = true; }
      // §7 : premier tic-tac de l'horloger décalé pour éviter les pulses synchro
      if (st.ability === 'haste') a.hasteCd = 1.5 + Math.random() * 3;
      agents.push(a);
      return a;
    }
    function spawnAgent(node, faction, type, target) {
      // spawn en ÉVENTAIL : angle réparti autour de la sortie + rayon aléatoire
      const anBase = Math.atan2(target.y - node.y, target.x - node.x);
      node.spawnSeq = (node.spawnSeq || 0) + 1;
      const fan = ((node.spawnSeq % 7) - 3) * 0.24 + (Math.random() - 0.5) * 0.12;
      const an = anBase + fan;
      const rr = NODE_R - 4 + 10 + Math.random() * 16;
      return spawnAt(node.x + Math.cos(an) * rr, node.y + Math.sin(an) * rr, faction, type, target);
    }

    function sendUnits(node, target, ratio) {
      if (!node.owner || node === target) return false;
      const total = nodeGTot(node);
      if (total < 1) return false;
      const counts = {};
      let sum = 0;
      for (const t of UNIT_ORDER) {
        const c = Math.floor((node.g[t] || 0) * ratio);
        if (c > 0) { counts[t] = c; sum += c; }
      }
      if (sum === 0) { // au moins 1 unité part
        for (const t of UNIT_ORDER) if ((node.g[t] || 0) > 0) { counts[t] = 1; sum = 1; break; }
      }
      if (sum === 0) return false;
      for (const t in counts) {
        node.g[t] -= counts[t];
        if (node.g[t] <= 0) delete node.g[t];
      }
      // §régiment : chaque envoi = une NOUVELLE vague. slots{} compte les unités
      // déjà sorties PAR TYPE (une ligne = un type, les types n'ont pas la même vitesse).
      node.queue.push({ tid: target.id, counts, left: sum, wave: ++regSeq, slots: {} });
      node.queueOwner = node.owner;
      sfx('whoosh', 200);
      return true;
    }

    function processQueue(n, dt) {
      if (!n.queue.length) { n.salvoCd = 0; return; }
      // §régiment : on libère par SALVES de 8 (un rang complet d'un même type d'un coup),
      // avec un petit délai entre deux salves. Ex : 19 unités → 8, puis 8, puis 3.
      n.salvoCd = (n.salvoCd || 0) - dt;
      while (n.salvoCd <= 0 && n.queue.length) {
        if (agents.length >= AGENT_CAP) { n.salvoCd = 0.15; return; } // on patiente, salle comble
        const q = n.queue[0];
        const target = nById[q.tid];
        // type suivant dans la file (les rapides d'abord : joli effet de vague)
        let picked = null;
        for (const t of UNIT_ORDER) {
          if (q.counts[t] > 0) { picked = t; break; }
        }
        if (!picked || !target) { n.queue.shift(); continue; }
        // La salve = jusqu'à SALVO_SIZE unités du MÊME type, sorties simultanément.
        const rdx = target.x - n.x, rdy = target.y - n.y;
        const rdl = Math.hypot(rdx, rdy) || 1;
        const regDx = rdx / rdl, regDy = rdy / rdl;
        const regId = q.wave * 32 + UNIT_ORDER.indexOf(picked);
        const batch = Math.min(SALVO_SIZE, q.counts[picked]);
        for (let k = 0; k < batch && agents.length < AGENT_CAP; k++) {
          q.counts[picked]--; q.left--;
          const a = spawnAgent(n, n.queueOwner || n.owner, picked, target);
          // §régiment : régiment (vague+type) + slot croissant + cap FIGÉ (sortie → cible).
          const slot = q.slots[picked] || 0;
          q.slots[picked] = slot + 1;
          a.reg = regId;
          a.slot = slot;
          a.regOx = n.x; a.regOy = n.y; // point de sortie, pour jauger le packing au départ
          a.regDx = regDx; a.regDy = regDy;
          puff(a.x, a.y, 'rgba(255,255,255,0.8)', 2, 16, 1.8);
        }
        if (q.left <= 0) n.queue.shift();
        n.salvoCd += SALVO_GAP; // on souffle avant la salve suivante
      }
    }

    // ---- dégâts / mort -------------------------------------------
    // src (optionnel) : l'agent attaquant — sert à l'antimagie (source.st.cat)
    function hurtAgent(a, dmg, byFaction, sx, sy, src) {
      if (a.dead || a.invulnT > 0) return; // sortie de bâtiment = 0.4 s de répit
      // §D17 antimagie : immunité TOTALE aux dégâts d'attaquants de catégorie 'magie'
      if (src && a.power && a.power.kind === 'antimagie' && src.st && src.st.cat === 'magie') {
        a.flash = 0.06;
        if ((a.pwFxT2 || 0) <= 0) { // anneau bleu de dissipation (throttlé)
          a.pwFxT2 = 0.4;
          pwFirstFx(a);
          fxRings.push({ x: a.x, y: a.y, r: 14, life: 0.25, tot: 0.25, col: '#7fb8ff' });
        }
        return;
      }
      // §D15 malediction : les maudits encaissent +X % (curseMult posé par la zone)
      if ((a.curseT || 0) > 0) dmg *= (a.curseMult || 1.25);
      // §D15 benediction : le bouclier boit les dégâts AVANT les PV
      if ((a.shieldHp || 0) > 0) {
        const soak = Math.min(a.shieldHp, dmg);
        a.shieldHp -= soak; dmg -= soak;
        if (a.shieldHp <= 0.01) { // le bouclier casse : éclat doré
          a.shieldHp = 0; a.shieldT = 0; a.pwShield = false;
          puff(a.x, a.y, '#ffe9a8', 6, 40, 2.2);
          fxRings.push({ x: a.x, y: a.y, r: 18, life: 0.3, tot: 0.3, col: '#ffd257' });
        }
        if (dmg <= 0) { a.flash = 0.08; return; } // tout absorbé, pas une égratignure
      }
      a.hp -= dmg;
      a.flash = 0.12;
      if (a.dmgTxtT <= 0) {
        addDmgText(a.x, a.y, '-' + Math.round(dmg), byFaction === pf ? '#fff3c0' : '#ffd6d6');
        a.dmgTxtT = 0.3;
      }
      if (particles.length < 300) puff((sx || a.x), (sy || a.y), '#fff0d8', 2, 30, 1.6);
      if (a.hp <= 0 && !a.dead) {
        a.dead = true;
        spawnSoul(a.f, a.x, a.y, Math.max(12, 40 * a.scale)); // §B5 : âme au champ
        if (spellFx.length) spellDeathHook(a); // §D4 ames : moisson d'âmes
        if (byFaction === pf) playerKills++;
        if (a.f === pf) playerLosses++;
        // throttle des morts en chaîne : au-delà du budget, on meurt discrètement
        if (deathFxBudget > 0) {
          deathFxBudget--;
          puff(a.x, a.y, a.f === 'cats' ? '#f4cf8a' : '#bfe2f4', 8, 42, 2.6);
          sfx('pop', 160);
        }
        if (a.st.ability === 'split' && !a.splitChild && agents.length < AGENT_CAP - 2) {
          for (const side of [-1, 1]) {
            const hp = a.maxHp * 0.38;
            agents.push({ id: agentSeq++, f: a.f, type: a.type, x: a.x, y: a.y + side * 5, vx: side * 12, vy: -side * 8,
              angle: a.angle + side * 0.5, phase: a.phase + side, hp, maxHp: hp, dmg: a.dmg * 0.48,
              st: Object.assign({}, a.st, { ability: null }), buffed: false, spec: a.spec, scale: a.scale * 0.68,
              target: a.target, ox: side * 10, oy: side * 8, foe: null, scanT: .2, cd: .35, lunge: 0, flash: 0, dmgTxtT: 0,
              dead: false, trailT: 0, auraT: 0, boostT: 0, splitChild: true,
              power: a.power || null, // §D17-3 : les rejetons héritent du pouvoir
              invulnT: 0.25, potBuffT: 0, potBuffPow: 0, dashCd: 1, noteT: 1, fuseT: 0.3 });
            // §AUD2 : les champs pw* DOIVENT être initialisés — mais SEULEMENT si le
            // parent a un pouvoir (les essaims ENNEMIS n'en ont jamais : power null,
            // initPower(null.params) crashait CHAQUE frame → le « freeze » du Front).
            if (agents[agents.length - 1].power) initPower(agents[agents.length - 1]);
                                                  // (l'héritage sans initPower → pwCd undefined → charge instantanée)
          }
          puff(a.x, a.y, '#a8fff0', 12, 44, 2.2);
        }
      }
    }

    function damageOf(a) {
      return a.dmg * (a.boostT > 0 ? 1.3 : 1) * (a.potBuffT > 0 ? 1 + (a.potBuffPow || 0) : 1)
        * ((a.rallyT || 0) > 0 ? 1.15 : 1) // §D4 fanfare : la musique tape plus fort
        * (bannM[a.f] || 1) // Étendard : +10% dmg par drapeau possédé, en direct
        * (a.pwFocus ? 1 + (a.pwFocusPct || 0.25) : 1); // §D17 focus : +dmg si non harcelé
    }

    // §7 : vitesse d'attaque effective — le pulse du chronarque presse la cadence
    function effAspd(a) {
      return a.st.aspd * ((a.hasteBoostT || 0) > 0 ? 1.3 : 1);
    }
    // §7 : espion — 1re frappe à +50 % ET démasquage (effet visible, une seule fois)
    function firstStrikeMult(a) {
      if (a.st.ability === 'stealth' && a.firstStrike) {
        a.firstStrike = false;
        a.stealthed = false;
        puff(a.x, a.y, '#d0d0e0', 10, 44, 2.4);
        addDmgText(a.x, a.y - 12, 'DÉMASQUÉ !', '#e0e0e8');
        sfx('squish', 120);
        return 1.5;
      }
      return 1;
    }

    // dégâts de zone PLAFONNÉS : max AOE_MAX cibles, décroissance 100/70/40/20 %
    // src (optionnel) : l'agent à l'origine des dégâts (antimagie lit source.st.cat)
    function aoeDamage(x, y, r, dmg, byFaction, sx, sy, src) {
      const foes = [];
      eachNear(x, y, r, (o) => {
        if (o.dead || o.f === byFaction) return;
        if (bdist(o.x, o.y, x, y) <= r) foes.push(o);
      });
      foes.sort((A, B) => bdist(A.x, A.y, x, y) - bdist(B.x, B.y, x, y));
      const nMax = Math.min(foes.length, AOE_MAX);
      for (let i = 0; i < nMax; i++) {
        hurtAgent(foes[i], dmg * AOE_DECAY[Math.min(i, AOE_DECAY.length - 1)], byFaction, sx || x, sy || y, src);
      }
      return nMax;
    }

    // ============================================================
    // §D17-3 : POUVOIRS D'UNITÉS (Salle des techniques). Un agent porte au plus
    // UN pouvoir (a.power = {id, kind, params}) — fourni par getStats côté JOUEUR
    // uniquement (les ennemis n'en ont pas). Les 19 kinds passent par des hooks
    // centralisés : initPower (spawn), powerTick (updateAgent), pwChargeMult /
    // pwAfterMelee (strike), pwAfterHit (updateProjectiles), hurtAgent (antimagie),
    // resolveSiege + damageGarrison (siege), damageOf (focus). §D18 (7 nouveaux) :
    // soin/volee/pluiefleches (cooldowns via powerTick), percant/gel/trainee/familier
    // (passifs branchés dans updateProjectiles + pwAfterHit). Les params sont
    // dépliés en champs plats a.pw* au spawn : ZÉRO allocation ni lookup d'objet
    // dans les hooks chauds (300+ agents). Visuels légers : fxRings/puff +
    // spellPart (cap SP_CAP partagé avec les sorts).
    // ============================================================
    // icône du pouvoir, flottée UNE fois au premier déclenchement (marqueur lisible
    // même pour les kinds discrets) — table constante, zéro alloc dans les hooks.
    const PW_ICON = {
      tourbillon: '', charge: '', antimagie: '', rebond: '', zone: '',
      siege: '', regen: '', vampirisme: '', epines: '', cri: '',
      pavois: '', focus: '',
      soin: '', volee: '', percant: '', pluiefleches: '', gel: '',
      trainee: '', familier: '',
    };
    function pwFirstFx(a) {
      if (a.pwSeen) return;
      a.pwSeen = true;
      addDmgText(a.x, a.y - 14, PW_ICON[a.power.kind] || '', '#ffe9a8');
    }
    function initPower(a) {
      const prm = a.power.params || {};
      a.pwFxT = 0; a.pwFxT2 = 0; a.pwSeen = false; a.spinT = 0;
      switch (a.power.kind) {
        case 'tourbillon':
          a.pwCdMax = prm.cd || 15; a.pwCd = a.pwCdMax * (0.4 + Math.random() * 0.5); // §D17quater : rentable dès ~2 ennemis
          a.pwPct = prm.pct || 0.8; a.pwRadius = prm.radius || 48; break;
        case 'charge':
          // §D17ter : charge à COOLDOWN (l'ancien modèle « élan accumulé avec un foe
          // assigné » ne partait jamais en vraie bataille : le foe n'arrive qu'au contact).
          a.pwChargeDist = prm.bdist || 150;
          a.pwChargeMult = prm.mult || (1 + (prm.pct != null ? prm.pct : 3.0)); // ×4 par défaut
          a.pwChargeCd = prm.cd || 30; // §D17quater : rare et devastateur
          a.pwCd = 0.6 + Math.random() * 0.6; // première charge rapide après l'arrivée
          a.pwPrimed = false; a.pwPrimeT = 0; a.pwDashT = 0;
          a.pwDashFoe = null; break;
        case 'rebond':
          a.pwBounces = prm.bounces || 1; a.pwBncPct = prm.pct || 0.7; break;
        case 'zone':
          a.pwZoneR = prm.radius || 26; a.pwZonePct = prm.pct || 0.5; break;
        case 'siege':
          a.pwGMult = prm.mult || 2.2; break;
        case 'regen':
          a.pwRegen = prm.pctPerSec || prm.pct || 0.02; a.pwNoFoeT = 0; break;
        case 'vampirisme':
          a.pwVampPct = prm.pct || 0.15; break;
        case 'epines':
          a.pwReflect = prm.pct || 0.18; break;
        case 'cri':
          a.pwCdMax = prm.cd || 10; a.pwCd = a.pwCdMax * (0.3 + Math.random() * 0.4);
          a.pwRadius = prm.radius || 70; a.pwSlow = prm.slowPct || prm.pct || 0.35;
          a.pwSlowDur = prm.dur || 2; break;
        case 'pavois':
          a.pwCdMax = prm.cd || 14; a.pwCd = a.pwCdMax * (0.2 + Math.random() * 0.3);
          a.pwShieldHp = prm.hp || 0; a.pwShieldPct = prm.pct || 0.3;
          a.pwShieldDur = prm.dur || 5; break;
        case 'focus':
          a.pwFocusPct = prm.pct != null ? prm.pct : 0.25; a.pwFocus = false; break;
        // ----- §D18 : les 7 nouveaux kinds -----
        case 'soin':
          a.pwCdMax = prm.cd || 45; a.pwCd = a.pwCdMax * (0.12 + Math.random() * 0.18);
          a.pwHealR = prm.radius || 110; a.pwHealPct = prm.pct || 0.35; break;
        case 'volee':
          a.pwCdMax = prm.cd || 12; a.pwCd = a.pwCdMax * (0.25 + Math.random() * 0.35);
          a.pwVolCount = prm.count || 5; a.pwVolPct = prm.pct || 0.6; a.pwVolReady = false; break;
        case 'percant':
          a.pwPierce = prm.count || 3; a.pwPierceDecay = prm.decay || 0.75; break;
        case 'pluiefleches':
          a.pwCdMax = prm.cd || 18; a.pwCd = a.pwCdMax * (0.25 + Math.random() * 0.35);
          a.pwRainR = prm.radius || 55; a.pwRainPct = prm.pct || 1.2;
          a.pwRainN = 0; a.pwRainT = 0; break;
        case 'gel':
          a.pwGelPct = prm.slowPct || prm.pct || 0.4; a.pwGelDur = prm.dur || 2; break;
        case 'trainee':
          a.pwTrPct = prm.pct || 0.25; a.pwTrDur = prm.dur || 2.5; a.pwTrW = prm.width || 14; break;
        case 'familier':
          a.pwFamChance = prm.chance || 0.3; a.pwFamMax = prm.max || 3;
          a.pwFamHp = prm.hp || 18; a.pwFamDmg = prm.dmg || 1.5; a.pwFamDur = prm.dur || 12;
          a.pwFams = null; break;
      }
    }
    // tick central (appelé par updateAgent quand a.power existe) — un dispatch,
    // pas d'allocation hors déclenchement effectif d'un pulse.
    function powerTick(a, dt) {
      switch (a.power.kind) {
        case 'tourbillon': {
          if (a.stunT > 0 || a.polyT > 0) break;
          a.pwCd = (a.pwCd || 0) - dt;
          if (a.pwCd <= 0) {
            const r = a.pwRadius || 48;
            // §AUD3 : RETIENT SON COUP tant qu'aucun ennemi vivant n'est dans le rayon —
            // sans cette garde, ~97 % des pulses partaient À VIDE pendant les marches
            // puis réarmaient 15-17 s : le joueur ne voyait JAMAIS le tourbillon en combat.
            let near = false;
            eachNear(a.x, a.y, r, (o) => { // eachNear énumère par CELLULES : re-filtrer la distance exacte
              if (!o.dead && o.f !== a.f && !o.stealthed && bdist(a.x, a.y, o.x, o.y) <= r) { near = true; return true; }
            });
            if (!near) { a.pwCd = 0.25; break; } // l'amorce s'écoule en marche → 1er pulse au 1er contact
            a.pwCd = a.pwCdMax || 6;
            const hits = aoeDamage(a.x, a.y, r, damageOf(a) * (a.pwPct || 0.8), a.f, a.x, a.y, a);
            // §D17bis : l'unité TOURNOIE vraiment (~0.45 s) — a.spinT fait tourner
            // a.angle sur lui-même (sprite directionnel : cycle voulu, PAS un bug)
            // en OUTREPASSANT le verrou de facing du corps à corps (voir updateAgent).
            a.spinT = 0.45;
            pwFirstFx(a);
            // anneau tournant + traits circulaires (ghost = trait qui orbite)
            fxRings.push({ x: a.x, y: a.y, r, life: 0.35, tot: 0.35, col: '#ffd98a' });
            for (let i = 0; i < 3; i++) {
              spellPart({ kind: 'ghost', cx: a.x, cy: a.y, ang: (i / 3) * Math.PI * 2 + a.phase, rad: r * 0.7, spin: 7, x: a.x, y: a.y, life: 0.35, col: '#ffd98a' });
            }
            if (hits) sfx('whoosh', 300);
          }
          break;
        }
        case 'charge': {
          // §D17ter : charge à COOLDOWN — l'unité repère ELLE-MÊME une victime dans
          // sa fenêtre (30..dist×1.8 px), FONCE dessus (impulsion + ×1.8 pendant
          // ~0.55 s via updateAgent) et son premier coup vaut ×mult (pwPrimed,
          // fenêtre pwPrimeT). Plus besoin d'un foe déjà assigné : en vraie bataille
          // il n'arrivait qu'au contact et la charge ne partait jamais.
          if ((a.pwDashT || 0) > 0) {
            a.pwDashT -= dt;
            // §D17quater : POURSUITE du bond — indépendante du système de foe (la
            // validation de portée relâche toute cible assignée à 100 px : le bond
            // pilote sa vélocité lui-même, plein gaz droit sur la victime).
            // §AUD3 : la charge ne vise plus JAMAIS les bâtiments (règle joueur) —
            // uniquement des agents ennemis sur le champ.
            let df2 = a.pwDashFoe;
            // §AUD2 : victime morte EN VOL → ré-acquisition immédiate dans la fenêtre
            // (60 % des charges expiraient sans coup, en partie à cause de ça)
            if (df2 && df2.dead) {
              let nv = null, nb = (a.pwChargeDist || 150) * 1.8 + 1;
              eachNear(a.x, a.y, (a.pwChargeDist || 150) * 1.8, (o) => {
                if (o.dead || o.f === a.f || o.stealthed) return;
                const dd = bdist(a.x, a.y, o.x, o.y);
                if (dd < nb) { nb = dd; nv = o; }
              });
              a.pwDashFoe = df2 = nv; // null → le bond s'éteint proprement ci-dessous
            }
            if (!df2 || df2.dead) { a.pwDashT = 0; a.pwDashFoe = null; }
            else {
              const dd2 = bdist(a.x, a.y, df2.x, df2.y);
              // verrou PILE dans la portée de frappe (strike exige ≤ stopD+1.5 : un
              // verrou à CONTACT_R+4 laissait une zone grise où la cible était
              // relâchée avant le coup — flake mesuré)
              const pinD = a.st.range > 0 ? a.st.range * 0.9 : CONTACT_R;
              if (dd2 <= pinD) {
                a.pwDashT = 0;
                a.vx = 0; a.vy = 0; // ARRÊT NET : l'inertie du ×10 emportait l'unité
                                    // 70 px au-delà de la cible → hors laisse → perdue
                if (a.foe !== df2) { dropFoe(a); a.foe = df2; df2.engagedBy = (df2.engagedBy || 0) + 1; }
                a.pwDashFoe = null;
                a.cd = Math.min(a.cd, 0.05); // §AUD2 : la lance frappe À L'IMPACT — le
                                             // cooldown résiduel mangeait la fenêtre ×4
                puff(a.x, a.y, '#cfe8ff', 5, 26, 2); // nuage de freinage (l'impact se voit)
              } else {
                const anD = Math.atan2(df2.y - a.y, df2.x - a.x);
                a.vx = Math.cos(anD) * a.st.mspd * 10; // le bond FULGURANT (×10)
                a.vy = Math.sin(anD) * a.st.mspd * 10;
                a.angle = anD;
              }
            }
            a.pwFxT = (a.pwFxT || 0) - dt; // traînée dense pendant le bond
            if (a.pwFxT <= 0) {
              a.pwFxT = 0.05;
              spellPart({ kind: 'trail', x: a.x - Math.cos(a.angle) * 8, y: a.y - Math.sin(a.angle) * 8, vx: -Math.cos(a.angle) * 26, vy: -Math.sin(a.angle) * 26, life: 0.3, size: 2, col: '#cfe8ff' });
            }
          }
          if ((a.pwPrimeT || 0) > 0) { // le bonus du premier coup expire s'il n'est pas consommé
            a.pwPrimeT -= dt;
            if (a.pwPrimeT <= 0) a.pwPrimed = false;
          }
          a.pwCd = (a.pwCd || 0) - dt;
          if (a.pwCd <= 0 && a.stunT <= 0 && (a.rootT || 0) <= 0 && (a.pwDashT || 0) <= 0) {
            const maxD = (a.pwChargeDist || 150) * 1.8, minD = 30;
            let victim = null, bd = maxD + 1;
            eachNear(a.x, a.y, maxD, (o) => {
              if (o.dead || o.f === a.f || o.stealthed) return;
              // §D17quinquies : plus de filtre ENGAGE_CAP — la charge frappe UNE fois,
              // la saturation d'engagement des mêlées de masse la privait de cible.
              const dd = bdist(a.x, a.y, o.x, o.y);
              if (dd >= minD && dd < bd) { bd = dd; victim = o; }
            });
            if (!victim) {
              // §AUD3 : rien à charger (garnisons dans les bâtiments = intouchables par
              // la charge, règle joueur) → throttle du scan et marche NORMALE.
              a.pwCd = 0.25;
            } else {
              a.pwCd = a.pwChargeCd || 30;
              // PAS d'assignation de foe ici : la validation de portée la relâcherait —
              // la poursuite du bond (pwDashFoe, plus haut) s'en charge et VERROUILLE
              // la cible au contact, où la validation la garde.
              a.pwDashFoe = victim;
              a.pwPrimed = true; a.pwPrimeT = 3.0; // §AUD2 : 2.0 s expirait dans ~30 % des cas
              a.pwDashT = 1.2; // au plus — coupé dès le contact
              const anF = Math.atan2(victim.y - a.y, victim.x - a.x);
              a.angle = anF;
              pwFirstFx(a);
              fxRings.push({ x: a.x, y: a.y, r: 12, life: 0.25, tot: 0.25, col: '#cfe8ff' });
            }
          }
          break;
        }
        case 'antimagie':
          a.pwFxT2 = (a.pwFxT2 || 0) - dt; // throttle de l'anneau de blocage (hurtAgent)
          break;
        case 'regen': {
          // hors combat UNIQUEMENT : 2 s sans foe verrouillé avant de récupérer
          if (a.foe) { a.pwNoFoeT = 0; break; }
          a.pwNoFoeT = (a.pwNoFoeT || 0) + dt;
          if (a.pwNoFoeT >= 2 && a.hp < a.maxHp) {
            a.hp = Math.min(a.maxHp, a.hp + a.maxHp * (a.pwRegen || 0.02) * dt);
            pwFirstFx(a);
            a.pwFxT = (a.pwFxT || 0) - dt;
            if (a.pwFxT <= 0) { // petites croix vertes discrètes
              a.pwFxT = 0.8;
              spellPart({ kind: 'cross', x: a.x + (Math.random() - 0.5) * 12, y: a.y - 6 - Math.random() * 6, vy: -14, life: 0.6, col: '#7ecf6a' });
            }
          }
          break;
        }
        case 'cri': {
          if (a.stunT > 0 || a.polyT > 0) break;
          a.pwCd = (a.pwCd || 0) - dt;
          if (a.pwCd <= 0) {
            let n = 0;
            const r = a.pwRadius || 70, pow = a.pwSlow || 0.35, dur = a.pwSlowDur || 2;
            eachNear(a.x, a.y, r, (o) => {
              if (o.dead || o.f === a.f) return;
              if (bdist(o.x, o.y, a.x, a.y) > r) return;
              o.slowT = Math.max(o.slowT || 0, dur); o.slowPow = pow; n++;
            });
            if (n) { // onde concentrique (double anneau)
              a.pwCd = a.pwCdMax || 7;
              pwFirstFx(a);
              fxRings.push({ x: a.x, y: a.y, r, life: 0.5, tot: 0.5, col: '#ffb34d' });
              fxRings.push({ x: a.x, y: a.y, r: r * 0.55, life: 0.35, tot: 0.35, col: '#ffd98a' });
              sfx('whoosh', 260);
            } else a.pwCd = 0.4; // personne à portée : on retente bientôt
          }
          break;
        }
        case 'pavois': {
          a.pwCd = (a.pwCd || 0) - dt;
          if (a.pwCd <= 0 && (a.shieldHp || 0) <= 0) {
            a.pwCd = a.pwCdMax || 9;
            a.shieldHp = a.pwShieldHp || a.maxHp * (a.pwShieldPct || 0.3);
            a.shieldT = a.pwShieldDur || 5;
            a.pwShield = true; // teinte bleutée dédiée (vs bénédiction dorée)
            pwFirstFx(a);
            fxRings.push({ x: a.x, y: a.y, r: 16, life: 0.4, tot: 0.4, col: '#8fd8ff' });
            puff(a.x, a.y, '#8fd8ff', 4, 26, 1.8);
          }
          break;
        }
        case 'focus':
          // actif tant que l'agent n'est PAS harcelé par ≥ 2 ennemis
          a.pwFocus = (a.engagedBy || 0) < 2;
          if (a.pwFocus && a.foe) pwFirstFx(a); // 1re activation en situation : réticule signalé
          break;
        case 'soin': {
          // §D18 : soin CIBLÉ — l'allié le plus amoché dans le rayon reçoit pct de
          // SES PV max (différent de regen : on soigne les AUTRES, pas soi-même).
          if (a.stunT > 0 || a.polyT > 0) break;
          a.pwCd = (a.pwCd || 0) - dt;
          if (a.pwCd <= 0) {
            const r = a.pwHealR || 110;
            let best = null, worst = 0.999; // ratio hp/maxHp le plus bas
            eachNear(a.x, a.y, r, (o) => {
              if (o.dead || o.f !== a.f || o === a) return;
              if (bdist(o.x, o.y, a.x, a.y) > r) return;
              const k2 = o.hp / o.maxHp;
              if (k2 < worst) { worst = k2; best = o; }
            });
            if (best) {
              a.pwCd = a.pwCdMax || 45;
              const amt = best.maxHp * (a.pwHealPct || 0.35);
              best.hp = Math.min(best.maxHp, best.hp + amt);
              pwFirstFx(a);
              // filet de cœurs/croix vertes : orbes du soigneur VERS le soigné
              for (let i = 0; i < 4; i++) {
                spellPart({ kind: 'orb', x: a.x + (Math.random() - 0.5) * 8, y: a.y - 6, tgt: best, life: 0.5 + i * 0.08, size: 2.2, col: i % 2 ? '#ff9fc0' : '#7ecf6a' });
              }
              spellPart({ kind: 'cross', x: best.x, y: best.y - 10, vy: -16, life: 0.7, col: '#7ecf6a' });
              addDmgText(best.x, best.y - 10, '+' + Math.round(amt), '#7ecf6a');
              fxRings.push({ x: best.x, y: best.y, r: 16, life: 0.35, tot: 0.35, col: '#7ecf6a' });
              sfx('pop', 260);
            } else a.pwCd = 1.2; // personne à recoller : on retâte le pouls bientôt
          }
          break;
        }
        case 'volee': {
          // §D18 : on ARME la salve — c'est strike() qui la consomme (prochaine
          // attaque à distance en éventail).
          if (!a.pwVolReady) {
            a.pwCd = (a.pwCd || 0) - dt;
            if (a.pwCd <= 0) {
              a.pwVolReady = true;
              fxRings.push({ x: a.x, y: a.y, r: 10, life: 0.25, tot: 0.25, col: '#ffd98a' });
            }
          }
          break;
        }
        case 'pluiefleches': {
          // §D18 : salves en cours d'abord (la pluie tombe même si le tireur bouge)
          if ((a.pwRainN || 0) > 0) {
            a.pwRainT -= dt;
            if (a.pwRainT <= 0) {
              a.pwRainT = 0.25; a.pwRainN--;
              const rr = a.pwRainR || 55;
              aoeDamage(a.pwRainX, a.pwRainY, rr, damageOf(a) * (a.pwRainPct || 1.2) / 6, a.f, a.pwRainX, a.pwRainY, a);
              // flèches qui TOMBENT du ciel (particules dédiées 'shaft')
              for (let i = 0; i < 5; i++) {
                const rx = a.pwRainX + (Math.random() - 0.5) * rr * 1.5;
                const ry = a.pwRainY + (Math.random() - 0.5) * rr * 1.1;
                const fh = 50 + Math.random() * 30;
                spellPart({ kind: 'shaft', x: rx, y: ry - fh, vy: 300, life: fh / 300, col: '#c9b48a' });
              }
              puff(a.pwRainX, a.pwRainY, '#ffd98a', 2, 24, 1.5);
            }
          }
          if (a.stunT > 0 || a.polyT > 0) break;
          a.pwCd = (a.pwCd || 0) - dt;
          if (a.pwCd <= 0 && (a.pwRainN || 0) <= 0) {
            // un GROUPE (≥ 2 ennemis dans 60 px) à portée de tir ? On arrose.
            const rng = Math.max(80, (a.st.range || 0) * 1.15);
            let center = null, bestN = 1;
            eachNear(a.x, a.y, rng, (o) => {
              if (o.dead || o.f === a.f || o.stealthed) return;
              if (bdist(o.x, o.y, a.x, a.y) > rng) return;
              let cnt = 0;
              eachNear(o.x, o.y, 60, (o2) => {
                if (!o2.dead && o2.f !== a.f && bdist(o2.x, o2.y, o.x, o.y) <= 60) cnt++;
              });
              if (cnt > bestN) { bestN = cnt; center = o; }
            });
            if (center) {
              a.pwCd = a.pwCdMax || 18;
              a.pwRainX = center.x; a.pwRainY = center.y;
              a.pwRainN = 6; a.pwRainT = 0.12; // 6 salves étalées sur ~1.5 s
              pwFirstFx(a);
              fxRings.push({ x: center.x, y: center.y, r: a.pwRainR || 55, life: 0.4, tot: 0.4, col: '#ffd98a' });
              sfx('whoosh', 260);
            } else a.pwCd = 0.5; // pas de groupe : on guette
          }
          break;
        }
        case 'trainee': {
          // §D18 : porté par les PROJECTILES (updateProjectiles). Au SOL uniquement
          // pour les unités sans tir (aura) : braises semées en marchant.
          if ((a.st.range || 0) > 0) break;
          a.pwFxT = (a.pwFxT || 0) - dt;
          if (a.pwFxT <= 0 && Math.hypot(a.vx || 0, a.vy || 0) > 6) {
            a.pwFxT = 0.3;
            if (zones.length < 90) {
              zones.push({ x: a.x, y: a.y, f: a.f, life: a.pwTrDur || 2.5, r: Math.max(7, (a.pwTrW || 14) * 0.6), dmg: damageOf(a) * (a.pwTrPct || 0.25), col: '#c96bff' });
              spellPart({ kind: 'ember', x: a.x, y: a.y - 2, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30, life: 0.4, size: 1.4, col: '#d879ff' });
              pwFirstFx(a);
            }
          }
          break;
        }
      }
    }
    // charge : consomme le bond armé au moment de la frappe → ×mult (flash à l'impact)
    function pwChargeMult(a) {
      if (!a.pwPrimed) return 1;
      a.pwPrimed = false; a.pwPrimeT = 0; a.pwDashT = 0; // §D17ter : bond consommé, recharge via pwCd
      a.flash = 0.15;
      fxRings.push({ x: a.x, y: a.y, r: 14, life: 0.3, tot: 0.3, col: '#cfe8ff' });
      puff(a.x, a.y, '#ffffff', 5, 40, 2);
      return a.pwChargeMult || 1.8;
    }
    // zone : éclaboussure autour de la cible (cible principale exclue, 4 max)
    function pwSplash(src, victim, x, y, dmg) {
      let hits = 0;
      const r = src.pwZoneR || 26, part = dmg * (src.pwZonePct || 0.5);
      eachNear(x, y, r, (o) => {
        if (hits >= 4 || o.dead || o === victim || o.f === src.f) return;
        if (bdist(o.x, o.y, x, y) <= r) { hurtAgent(o, part, src.f, x, y, src); hits++; }
      });
      if (hits) { puff(x, y, '#ffd98a', 3, 26, 1.7); pwFirstFx(src); }
    }
    // vampirisme : soigne pct des dégâts infligés (filet rouge vers l'agent)
    function pwVampHeal(src, x, y, dealt) {
      if (src.dead || src.hp >= src.maxHp) return;
      src.hp = Math.min(src.maxHp, src.hp + dealt * (src.pwVampPct || 0.15));
      pwFirstFx(src);
      spellPart({ kind: 'orb', x, y, tgt: src, life: 0.5, size: 2.2, col: '#e05252' });
    }
    // hooks après un coup de MÊLÉE porté (vampirisme / zone)
    function pwAfterMelee(a, foe, dealt) {
      const k = a.power.kind;
      if (k === 'vampirisme') pwVampHeal(a, foe.x, foe.y, dealt);
      else if (k === 'zone') pwSplash(a, foe, foe.x, foe.y, dealt);
    }
    // hooks après l'impact d'un PROJECTILE (vampirisme / zone / rebond).
    // victim = la cible touchée (tirs monocibles), null pour les AoE.
    function pwAfterHit(p, victim) {
      const s = p.src, k = s.power.kind, x = p.x1, y = p.y1;
      if (k === 'vampirisme') pwVampHeal(s, x, y, p.dmg);
      else if (k === 'zone') pwSplash(s, victim, x, y, p.dmg);
      else if (k === 'rebond') {
        const left = p.bnc == null ? (s.pwBounces || 1) : p.bnc;
        if (left <= 0) return;
        let nb = null, bd = 111;
        eachNear(x, y, 110, (o2) => {
          if (o2.dead || o2.f === p.f || o2 === victim || o2 === p.bFrom) return;
          if (p.aoe > 0 && bdist(o2.x, o2.y, x, y) <= p.aoe) return; // déjà arrosé par l'AoE
          const d2 = bdist(o2.x, o2.y, x, y);
          if (d2 < bd) { bd = d2; nb = o2; }
        });
        if (!nb) return;
        projectiles.push({
          kind: p.kind, x0: x, y0: y, x1: nb.x, y1: nb.y, tgt: p.kind === 'shot' ? nb : undefined,
          t: 0, dur: Math.max(0.1, bd / 300), dmg: p.dmg * (s.pwBncPct || 0.7), f: p.f, aoe: p.aoe, pal: p.pal,
          buildingMult: p.buildingMult, src: s, bnc: left - 1, bFrom: victim || null, slow: p.slow || null,
        });
        pwFirstFx(s);
        puff(x, y, '#cfe8ff', 2, 22, 1.5);
      } else if (k === 'gel') {
        // §D18 : chaque touche de projectile RALENTIT la cible — givre bref
        if (!victim || victim.dead) return;
        victim.slowT = Math.max(victim.slowT || 0, s.pwGelDur || 2);
        victim.slowPow = s.pwGelPct || 0.4;
        victim.gelT = 0.5; // teinte bleutée brève (drawAgent)
        pwFirstFx(s);
        puff(victim.x, victim.y, '#bfe8ff', 2, 16, 1.4);
        spellPart({ kind: 'star', x: victim.x + (Math.random() - 0.5) * 8, y: victim.y - 8, vy: -10, life: 0.4, size: 1.6, col: '#bfe8ff' }); // cristaux légers
      } else if (k === 'familier') {
        // §D18 : à l'impact, chance d'invoquer un CHATON/OISILLON temporaire au
        // contact (cap pwFamMax vivants par invocateur, expire via tempLife).
        if (s.dead || Math.random() >= (s.pwFamChance || 0.3)) return;
        let fams = s.pwFams;
        if (fams) { // purge des morts avant de compter le cap
          let w = 0;
          for (let i2 = 0; i2 < fams.length; i2++) if (!fams[i2].dead) fams[w++] = fams[i2];
          fams.length = w;
        } else fams = s.pwFams = [];
        if (fams.length >= (s.pwFamMax || 3) || agents.length >= AGENT_CAP) return;
        const tgtN = nearestNode(x, y, n2 => n2.owner !== s.f) || s.target || victim || s;
        const m = spawnAt(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, s.f, 'jeune_force', tgtN);
        m.tempLife = s.pwFamDur || 12;
        m.hp = m.maxHp = s.pwFamHp || 18; // faible : c'est un renfort d'appoint
        m.dmg = s.pwFamDmg || 1.5;
        m.power = null; // le chaton n'hérite d'aucune technique
        m.scale *= 0.85;
        fams.push(m);
        spellFeathers(m.x, m.y, 6); // plumes/poils à l'apparition
        pwFirstFx(s);
        sfx('pop', 240);
      }
    }

    function damageGarrison(n, dmg, byFaction, byAgent) {
      if (n.owner === byFaction) return;
      // MAJ §3 : un point de contrôle amélioré protège un peu sa garnison (−20% max)
      if (n.kind === 'controle' && n.owner) dmg *= 1 - Math.min(0.5, bfBonus(n.owner, 'flags'));
      n.gDmg += dmg;
      n.hurtT = 0.35;
      let changed = false;
      // on épuise les PV des défenseurs, les plus fragiles d'abord
      let guard = 0;
      while (guard++ < 50) {
        let front = null;
        for (const t of UNIT_ORDER) if ((n.g[t] || 0) > 0) { front = t; break; }
        if (!front) break;
        const hp = garrisonUnitHp(n, front);
        if (n.gDmg < hp) break;
        n.gDmg -= hp;
        n.g[front]--;
        if (n.g[front] <= 0) delete n.g[front];
        changed = true;
      }
      if (changed && particles.length < 300) puff(n.x, n.y - 8, '#ffffff', 3, 30, 2);
      if (nodeGTot(n) <= 0) captureNode(n, byFaction, byAgent);
    }

    function captureNode(n, faction, byAgent) {
      const wasOwner = n.owner;
      // §7 : un espion dans le coup ? la maison est vidée de ses provisions au passage
      if ((byAgent && byAgent.type === 'espion') || n.espionHit === faction) {
        const loot = 12 + Math.round((gTot(n.g) || 0) * 1.5);
        espionLoot += loot;
        addDmgText(n.x, n.y - 24, '+' + loot + ' ', '#ffe9a8');
        emit({ type: 'espionLoot', res: 'food', amount: loot, faction });
      }
      n.espionHit = null;
      n.owner = faction;
      n.g = {};
      n.gDmg = 0;
      n.queue.length = 0;
      n.bump = 1;
      n.prodAcc = 0;
      // §D11ter : le type produit suit le propriétaire — le joueur produit l'unité de
      // BASE (sa variété vient des renforts), l'IA reprend un type de son pool.
      if (mode === 'personal' && n.prodRate) {
        if (faction === pf) n.prodType = 'lancier';
        else if (map.epool && map.epool.length) n.prodType = map.epool[Math.floor(Math.random() * Math.min(2, map.epool.length))];
      }
      // le guichet de siège rend tous ses tickets : nouveau propriétaire, nouvelle file
      n.atkEngaged = 0;
      for (const ag of agents) if (ag.siegeNode === n.id) ag.siegeNode = null;
      // sécurité : si l'ennemi capture VOTRE nœud sélectionné, on désélectionne.
      // Personne ne commande la garnison d'en face, même par accident.
      if (n.id === selectedId && faction !== pf) {
        selectedId = -1;
        emit({ type: 'nodeSelected', node: null });
      }
      if (n.kind === 'banner') refreshBanners();
      // §B avant-poste : on retient le DERNIER capturé — les renforts y débarqueront
      if (n.kind === 'avantposte') lastOutpost[faction] = n;
      if (byAgent && !byAgent.dead) { // le conquérant plante le drapeau
        n.g[byAgent.type] = 1;
        byAgent.dead = true;
      }
      const col = FACTION_COL[faction];
      puff(n.x, n.y, col, 16, 60, 3);
      puff(n.x, n.y, '#ffffff', 8, 40, 2);
      if (fxVisible()) {
        const p = scr(n.x, n.y);
        try {
          FX.ring(p.x, p.y, col);
          FX.burst(p.x, p.y, { color: col, n: 14, speed: 3 });
        } catch (e) { /* fx optionnels */ }
      }
      sfx('capture', 280);
      emit({ type: 'capture', node: n, by: faction, from: wasOwner });
      emit(Object.assign({ type: 'controlChange' }, getControl()));
      // §B (DESIGN13) : DÉCAPITATION — prendre un QG finit la bataille SUR-LE-CHAMP
      // (victory si le joueur décapite, defeat si c'est son QG qui tombe).
      // checkEnd garde ses conditions d'annihilation en secours.
      if (mode === 'personal' && n.kind === 'hq' && !ended) {
        ended = true;
        sfx(faction === pf ? 'win' : 'lose');
        emit({ type: faction === pf ? 'victory' : 'defeat', reason: 'hq' });
      }
    }

    // §B4 : dégâts d'UN type de défenseur (pour les duels 1v1 dans le bâtiment).
    // Miroir de garrisonDmg, mais ciblé sur le type de front, sans étendard —
    // même barème que la riposte de garnison, pour ne rien déséquilibrer.
    function garrisonUnitDmg(n, type) {
      const s = n.owner ? statsFor(n.owner, type) : BGD.UNIT_TYPES[type].base;
      return s.dmg * (1 + (n.defBonus || 0));
    }

    // §B4 : RÉSOLUTION DU SIÈGE DANS LE BÂTIMENT. L'assaillant ENTRE et affronte
    // la garnison en CHAÎNE de duels 1v1, instantanément, puis disparaît (consommé).
    // Duel : t_a = hp_def/dmg_a (temps pour tuer), t_d = hp_a/dmg_def. Si t_a ≤ t_d,
    // l'attaquant gagne (encaisse dmg_def*t_a), le défenseur tombe (âme), suivant.
    // Sinon l'attaquant tombe (âme), le défenseur survit entamé, fin de chaîne.
    // Garnison vidée + attaquant vivant → capture, il rejoint la garnison (≥1).
    function resolveSiege(a, n) {
      // §AUD3 : on entre dans un bâtiment → la charge s'éteint (règle joueur : aucun
      // pouvoir dans les bâtiments ; le pouvoir 'siege' — anti-bâtiment par nature —
      // reste la seule exception assumée).
      a.pwPrimed = false; a.pwPrimeT = 0; a.pwDashT = 0; a.pwDashFoe = null;
      puff(n.x, n.y - 6, a.f === 'cats' ? '#f4cf8a' : '#bfe2f4', 6, 40, 2.2); // petit choc d'entrée
      if (a.st.ability === 'stealth') n.espionHit = a.f; // §7 : l'espion signe le casse
      let hpA = a.hp;
      // §D17 siege : ×mult contre les garnisons — étincelles oranges sur le nœud
      const pwSiege = (a.power && a.power.kind === 'siege') ? (a.pwGMult || 2.2) : 1;
      if (pwSiege > 1) { puff(n.x, n.y - 6, '#ffb34d', 5, 38, 2.2); pwFirstFx(a); }
      const dmgA = damageOf(a) * (a.st.ability === 'siegeBomber' ? 4.5 : 1) * firstStrikeMult(a) * pwSiege;
      if (dmgA <= 0) { a.dead = true; spawnSoul(a.f, a.x, a.y, Math.max(12, 40 * a.scale)); return; }
      let killed = 0, guard = 0;
      while (nodeGTot(n) > 0 && guard++ < 400) {
        let front = null;
        for (const t of UNIT_ORDER) if ((n.g[t] || 0) > 0) { front = t; break; }
        if (!front) break;
        const hpDef = Math.max(1, garrisonUnitHp(n, front) - n.gDmg); // reste de PV du défenseur entamé
        const dmgDef = garrisonUnitDmg(n, front);
        const tA = hpDef / dmgA;
        const tD = dmgDef > 0 ? hpA / dmgDef : Infinity;
        if (tA <= tD) {
          // l'attaquant remporte le duel : le défenseur meurt, l'attaquant encaisse
          hpA -= dmgDef * tA;
          n.gDmg = 0;
          n.g[front]--;
          if (n.g[front] <= 0) delete n.g[front];
          killed++;
          spawnSoul(n.owner, n.x + (Math.random() - 0.5) * 16, n.y - 4 + (Math.random() - 0.5) * 10, 26 * COMBAT_SCALE);
        } else {
          // l'attaquant tombe : le défenseur survit, ses PV entamés sont reportés
          n.gDmg += dmgA * tD;
          hpA = 0;
          break;
        }
      }
      n.hurtT = 0.35;
      if (killed && particles.length < 300) puff(n.x, n.y - 8, '#ffffff', 4, 34, 2.2);
      sfx('squish', 160);
      if (nodeGTot(n) <= 0 && hpA > 0) {
        // garnison vidée, l'attaquant survit → capture ; captureNode le plante en garnison (≥1)
        a.hp = hpA;
        captureNode(n, a.f, a);
      } else {
        // consommé : l'attaquant meurt à l'entrée (âme sur le champ)
        a.dead = true;
        spawnSoul(a.f, a.x, a.y, Math.max(12, 40 * a.scale));
      }
    }

    // ---- combat des agents ---------------------------------------
    // §B3 : verrouillage 1v1 STRICT — un même défenseur ne peut être verrouillé
    // que par ENGAGE_CAP assaillants au plus (le surplus ne dogpile pas : il
    // continue vers son objectif). Réglable.
    const ENGAGE_CAP = 2;
    function findFoe(a) {
      const R = (a.st.range > 0 ? a.st.range : 30) * (a.boss ? 3 : 1);
      // on choisit l'ennemi le MOINS engagé à portée (engagedBy minimal), la
      // distance ne sert que d'arbitre. Fini le dogpile où dix héros tabassent
      // le même lancier pendant que ses copains font du tourisme.
      let best = null, bestScore = Infinity;
      eachNear(a.x, a.y, R, (o) => {
        if (o.f === a.f || o.dead || o.stealthed) return; // §7 : l'espion planqué reste hors radar
        if ((o.engagedBy || 0) >= ENGAGE_CAP) return;     // §B3 : cible déjà prise, pas de curée
        const d = bdist(a.x, a.y, o.x, o.y);
        if (d > R + 1) return;
        const score = (o.engagedBy || 0) * 10000 + d;
        if (score < bestScore) { bestScore = score; best = o; }
      });
      // réservation immédiate : deux scans dans la même frame se répartissent
      if (best) best.engagedBy = (best.engagedBy || 0) + 1;
      return best;
    }
    // libération propre du verrou 1v1 : sans ça, engagedBy gonfle à vie et le
    // "moins engagé" devient une fiction statistique.
    function dropFoe(a) {
      if (a.foe) { a.foe.engagedBy = Math.max(0, (a.foe.engagedBy || 0) - 1); a.foe = null; }
      a.faceFoe = null; // libère aussi le verrou de facing (§anti-gigote)
    }
    // idem pour le ticket de siège : un mort au guichet doit rendre sa place
    function dropSiege(a) {
      if (a.siegeNode != null) {
        const n = nById[a.siegeNode];
        if (n) n.atkEngaged = Math.max(0, (n.atkEngaged || 0) - 1);
        a.siegeNode = null;
      }
    }

    // §AUD1 : le KIND du projectile suit la CATÉGORIE de l'unité — la magie tire
    // des ORBES (kind 'magic', petite zone ~20), l'explosif des OBUS en cloche
    // (kind 'lob', zone ~24), le tir des traits MONOCIBLES (kind 'shot').
    // L'ability ne garde que les cas spéciaux existants : mage 'magic' (grand
    // pouf 26 px) et artilleur 'artillery' (lob 22 px, réglage historique).
    // Fini l'invocateur/chronarque/jeune_magie au trait blanc de fronde.
    function projProfile(a) {
      const ab = a.st.ability;
      if (ab === 'magic') return { kind: 'magic', aoe: 26, bm: 0.45 };
      if (ab === 'artillery') return { kind: 'lob', aoe: 22, bm: 0.8 };
      const cat = a.st.cat || (BGD.UNIT_TYPES[a.type] && BGD.UNIT_TYPES[a.type].cat) || 'melee';
      if (cat === 'magie') return { kind: 'magic', aoe: 20, bm: 0.45 };
      if (cat === 'explosif') return { kind: 'lob', aoe: 24, bm: 0.8 };
      return { kind: 'shot', aoe: 0, bm: null }; // fronde/archer & co : monocible inchangé
    }

    function strike(a, foe) {
      a.cd = 1 / Math.max(0.2, effAspd(a));
      a.lunge = 0.2;
      a.angle = Math.atan2(foe.y - a.y, foe.x - a.x);
      // §anti-gigote : la frappe resynchronise le verrou de facing (même référence)
      a.faceFoe = foe; a.faceFx = foe.x; a.faceFy = foe.y; a.faceSx = a.x; a.faceSy = a.y;
      // §D17 charge : l'élan armé double (×mult) LE premier coup — consommé ici
      const chMul = (a.power && a.power.kind === 'charge') ? pwChargeMult(a) : 1;
      if (a.st.range > 0) {
        const ab = a.st.ability;
        const d = bdist(a.x, a.y, foe.x, foe.y);
        // §5 : couleur des projectiles selon le rang (blanc → ... → prismatique)
        const pal = BGD.projPalette ? BGD.projPalette(a.st.evo || 0) : null;
        const pp = projProfile(a); // §AUD1 : kind/zone par CATÉGORIE
        if (pp.kind !== 'shot') {
          // zone : obus en cloche (explosif) ou orbe (magie), dégâts plafonnés à l'impact
          projectiles.push({
            kind: pp.kind,
            x0: a.x, y0: a.y, x1: foe.x + (Math.random() - 0.5) * 12, y1: foe.y + (Math.random() - 0.5) * 12,
            t: 0, dur: Math.max(0.45, d / 150),
            dmg: damageOf(a) * chMul, f: a.f, pal, src: a, // §D17 : source pour antimagie/rebond/zone/vamp/siege
            aoe: pp.aoe,
            buildingMult: pp.bm,
          });
        } else {
          // tir MONOCIBLE (fronde, traqueur, entraveur) : une seule victime, la sienne
          projectiles.push({
            kind: 'shot', x0: a.x, y0: a.y, x1: foe.x, y1: foe.y, tgt: foe,
            t: 0, dur: Math.max(0.12, d / 300), dmg: damageOf(a) * chMul, f: a.f, aoe: 0, pal, src: a,
            slow: ab === 'slow' ? { t: 2, pow: 0.4 } : null, // glu : -40% mspd 2 s
          });
        }
        // §D18 volee : la salve armée — CETTE attaque part en éventail (±18°),
        // chaque projectile supplémentaire à pwVolPct des dégâts. Départ groupé.
        if (a.power && a.power.kind === 'volee' && a.pwVolReady) {
          a.pwVolReady = false; a.pwCd = a.pwCdMax || 12;
          const nEx = Math.max(1, (a.pwVolCount || 5) - 1);
          const half = Math.ceil(nEx / 2), spread = Math.PI / 10; // 18°
          const vd = Math.max(30, d);
          for (let vi = 1; vi <= nEx; vi++) {
            const off = (Math.ceil(vi / 2) / half) * spread * (vi % 2 ? 1 : -1);
            const van = a.angle + off;
            const tx = a.x + Math.cos(van) * vd, ty = a.y + Math.sin(van) * vd;
            if (pp.kind !== 'shot') {
              projectiles.push({
                kind: pp.kind, x0: a.x, y0: a.y, x1: tx, y1: ty,
                t: 0, dur: Math.max(0.45, vd / 150), dmg: damageOf(a) * (a.pwVolPct || 0.6), f: a.f, pal, src: a,
                aoe: pp.aoe, buildingMult: pp.bm,
              });
            } else {
              projectiles.push({
                kind: 'shot', x0: a.x, y0: a.y, x1: tx, y1: ty,
                t: 0, dur: Math.max(0.12, vd / 300), dmg: damageOf(a) * (a.pwVolPct || 0.6), f: a.f, aoe: 0, pal, src: a,
                slow: ab === 'slow' ? { t: 2, pow: 0.4 } : null,
              });
            }
          }
          pwFirstFx(a);
          fxRings.push({ x: a.x, y: a.y, r: 14, life: 0.3, tot: 0.3, col: '#ffd98a' });
          puff(a.x, a.y, '#ffe9a8', 4, 30, 1.8);
        }
        sfx('whoosh', 240);
      } else {
        const dealt = damageOf(a) * firstStrikeMult(a) * chMul;
        hurtAgent(foe, dealt, a.f, a.x + Math.cos(a.angle) * 10, a.y + Math.sin(a.angle) * 10, a);
        if (a.power) pwAfterMelee(a, foe, dealt); // §D17 : vampirisme / zone
        // §D17 epines : la cible rend pct des dégâts de MÊLÉE à l'attaquant
        if (foe.power && foe.power.kind === 'epines' && !a.dead && dealt > 0) {
          hurtAgent(a, dealt * (foe.pwReflect || 0.18), foe.f, a.x, a.y);
          pwFirstFx(foe);
          puff(a.x, a.y, '#a8794a', 3, 24, 1.6); // piquants bruns brefs
        }
        sfx('squish', 150);
      }
    }

    function updateAgent(a, dt) {
      a.lunge = Math.max(0, a.lunge - dt);
      a.flash = Math.max(0, a.flash - dt);
      a.boostT = Math.max(0, a.boostT - dt);
      a.hasteBoostT = Math.max(0, (a.hasteBoostT || 0) - dt); // §7 : pulse du chronarque
      a.invulnT = Math.max(0, (a.invulnT || 0) - dt);
      a.potBuffT = Math.max(0, (a.potBuffT || 0) - dt);
      a.slowT = Math.max(0, (a.slowT || 0) - dt);
      a.gelT = Math.max(0, (a.gelT || 0) - dt); // §D18 gel : givre visuel bref
      a.stunT = Math.max(0, (a.stunT || 0) - dt); // §boss méduse (paralyze)
      if (a.stunT <= 0) a.stunned = false;
      a.confuseT = Math.max(0, (a.confuseT || 0) - dt);
      if (a.dashCd > 0) a.dashCd -= dt;
      a.cd -= dt; a.dmgTxtT -= dt; a.scanT -= dt;

      // §D4 (sorts) : minuteries — fanfare (ralliement), poulet (volaille), clone
      a.rallyT = Math.max(0, (a.rallyT || 0) - dt);
      // §D15 (sorts 13-20) : racines (cloué), malédiction (marqué), bénédiction (bouclier)
      a.rootT = Math.max(0, (a.rootT || 0) - dt);
      a.curseT = Math.max(0, (a.curseT || 0) - dt);
      if ((a.shieldT || 0) > 0) {
        a.shieldT -= dt;
        if (a.shieldT <= 0) { a.shieldT = 0; a.shieldHp = 0; a.pwShield = false; } // la grâce expire sans éclat
      }
      if (a.polyT > 0) {
        a.polyT -= dt;
        dropFoe(a); // une volaille ne verrouille personne : elle picore
        if (a.polyT <= 0) {
          a.polyT = 0;
          if (a.polySave) { a.st = a.polySave.st; a.dmg = a.polySave.dmg; a.polySave = null; }
          spellFeathers(a.x, a.y, 8); // retour à la normale : re-nuage de plumes
        }
      }
      if (a.cloneT > 0) {
        a.cloneT -= dt;
        if (a.cloneT <= 0) {
          // le double d'ombre s'évapore — pas d'âme : il n'en a jamais eu
          a.dead = true;
          puff(a.x, a.y, '#3a3346', 8, 34, 2.4);
          return;
        }
      }

      // invocation temporaire : le contrat de 20 s expire, poof
      if (a.tempLife > 0) {
        a.tempLife -= dt;
        if (a.tempLife <= 0) {
          a.dead = true;
          spawnSoul(a.f, a.x, a.y, Math.max(12, 40 * a.scale)); // §B5 : l'invocation rend l'âme
          puff(a.x, a.y, '#c8c0e8', 5, 30, 2);
          return;
        }
      }

      // §D17-3 : tick du pouvoir d'unité (dispatch central, joueur uniquement)
      if (a.power) powerTick(a, dt);

      // régénération (activité "griffoir de guerre" / "perchoir zen")
      if (a.st.regen > 0 && a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * a.st.regen * dt);

      // §boss méduse (paralyze) : unité figée — ni marche, ni frappe, ni scan. On la
      // cloue sur place le temps du stun (le freinage évite la glissade inertielle).
      if (a.stunT > 0) {
        a.vx *= Math.pow(0.02, dt); a.vy *= Math.pow(0.02, dt);
        a.x = bclamp(a.x + a.vx * dt, 8, map.w - 8);
        a.y = bclamp(a.y + a.vy * dt, 8, map.h - 8);
        return;
      }

      // §D15 racines : IMMOBILISÉ (mspd effectif 0) mais PAS muselé — l'unité
      // continue de mordre/tirer ce qui passe à portée. Distinct du stun.
      if (a.rootT > 0) {
        a.vx *= Math.pow(0.002, dt); a.vy *= Math.pow(0.002, dt); // freinage net, zéro glissade
        a.x = bclamp(a.x + a.vx * dt, 8, map.w - 8);
        a.y = bclamp(a.y + a.vy * dt, 8, map.h - 8);
        const reach = (a.st.range > 0 ? a.st.range : CONTACT_R) + 4;
        if (a.foe && (a.foe.dead || bdist(a.x, a.y, a.foe.x, a.foe.y) > reach + 6)) dropFoe(a);
        const pacifistR = a.st.ability === 'support' || a.st.ability === 'heal';
        if (!a.foe && !pacifistR && a.confuseT <= 0 && a.scanT <= 0) {
          a.foe = findFoe(a);
          a.scanT = 0.22 + Math.random() * 0.12;
        }
        if (a.foe) {
          const dR2 = bdist(a.x, a.y, a.foe.x, a.foe.y);
          a.angle = lerpAngle(a.angle, Math.atan2(a.foe.y - a.y, a.foe.x - a.x), Math.min(1, dt * 10));
          if (dR2 <= reach && a.cd <= 0) strike(a, a.foe);
        }
        // §D17 tourbillon : même raciné, le pulse fait tournoyer (powerTick a tourné avant)
        if ((a.spinT || 0) > 0) { a.spinT -= dt; a.angle += dt * 14; }
        a.phase += dt * 1.2;
        return;
      }

      // ---- boss : phase à 50 % (enrage OU invocations, choisi par seed) ----
      if (a.boss) {
        if (!a.phase50 && a.hp <= a.maxHp * 0.5) {
          a.phase50 = true;
          if (a.bossMech === 'enrage') {
            a.st = Object.assign({}, a.st, { aspd: a.st.aspd * 1.4 });
            addDmgText(a.x, a.y - 20 * a.scale, 'ENRAGÉ !', '#ff6a5a');
            puff(a.x, a.y, '#ff6a5a', 16, 60, 3);
          } else {
            addDmgText(a.x, a.y - 20 * a.scale, 'À MOI LA GARDE !', '#ffd257');
            puff(a.x, a.y, '#ffd257', 12, 50, 2.6);
          }
          emit({ type: 'bossPhase', mech: a.bossMech });
          sfx('capture', 100);
        }
        if (a.phase50 && a.bossMech === 'summon') {
          a.summonT -= dt;
          if (a.summonT <= 0) {
            a.summonT = 10;
            const tgtN = nearestNode(a.x, a.y, n => n.owner !== a.f) || a.target;
            for (let i = 0; i < 3 && agents.length < AGENT_CAP; i++) {
              const an2 = Math.random() * Math.PI * 2;
              const m = spawnAt(a.x + Math.cos(an2) * 28, a.y + Math.sin(an2) * 28, a.f, 'lancier', tgtN);
              m.invulnT = 0.4;
            }
            puff(a.x, a.y, '#ffd257', 12, 50, 2.6);
            sfx('whoosh', 100);
          }
        }
      }

      if (a.st.ability === 'trail') {
        a.trailT -= dt;
        if (a.trailT <= 0) { a.trailT = 0.35; if (zones.length < 90) zones.push({ x: a.x, y: a.y, f: a.f, life: 2.3, r: 16, dmg: damageOf(a) * 0.42, col: a.f === 'cats' ? '#d981ff' : '#78e8ff' }); }
      }
      if (a.st.ability === 'damageAura') {
        a.auraT -= dt;
        if (a.auraT <= 0) { a.auraT = 0.55; aoeDamage(a.x, a.y, 34, damageOf(a) * 0.45, a.f, a.x, a.y, a); puff(a.x, a.y, '#cf77ff', 3, 12, 1.3); } // §D17 : src passé (l'antimagie doit bloquer l'aura aussi)
      }
      if (a.st.ability === 'siegeBomber') {
        a.fuseT -= dt;
        if (a.fuseT <= 0) { a.fuseT = 0.4; puff(a.x - Math.cos(a.angle) * 6, a.y - 10 * a.scale, '#ffb34d', 1, 12, 1.3); }
      }
      if (a.st.ability === 'support') {
        eachNear(a.x, a.y, 48, o => { if (!o.dead && o.f === a.f && o !== a && o.st.ability !== 'support') o.boostT = 0.8; });
        a.noteT -= dt;
        if (a.noteT <= 0) { a.noteT = 1.6; addDmgText(a.x, a.y - 8, '', '#ffe9a8'); }
        dropFoe(a);
      }
      // §5 : soigneur — aura verte, on recolle les copains (+hp/s en zone)
      if (a.st.ability === 'heal') {
        a.auraT -= dt;
        if (a.auraT <= 0) {
          a.auraT = 0.5;
          const pow = 2 + a.maxHp * 0.05;
          let healed = false;
          eachNear(a.x, a.y, 55, o => {
            if (!o.dead && o.f === a.f && o !== a && o.hp < o.maxHp) {
              o.hp = Math.min(o.maxHp, o.hp + pow);
              healed = true;
            }
          });
          if (healed) puff(a.x, a.y, '#7ecf6a', 3, 16, 1.5);
        }
        dropFoe(a); // il soigne, il ne mord pas
      }
      // §5 : invocateur — un jeune_force temporaire (20 s), périodiquement
      if (a.st.ability === 'summon' && !a.boss) {
        if (a.invokeT == null) a.invokeT = 4 + Math.random() * 3;
        a.invokeT -= dt;
        if (a.invokeT <= 0) {
          a.invokeT = 8;
          if (agents.length < AGENT_CAP) {
            const tgtN = nearestNode(a.x, a.y, n2 => n2.owner !== a.f) || a.target;
            const m = spawnAt(a.x + (Math.random() - 0.5) * 22, a.y + (Math.random() - 0.5) * 22, a.f, 'jeune_force', tgtN);
            m.tempLife = 20;
            puff(a.x, a.y, '#9cf7ff', 8, 40, 2.2);
            sfx('whoosh', 300);
          }
        }
      }

      // §7 : porteur 'logistic' — aura qui gonfle la prod des bâtiments alliés proches
      if (a.st.ability === 'logistic') {
        a.auraT -= dt;
        if (a.auraT <= 0) {
          a.auraT = 0.4;
          for (const n of ns) {
            if (n.owner !== a.f || !n.prodRate) continue;
            if (bdist(a.x, a.y, n.x, n.y) < 96) { n.logiT = Math.max(n.logiT, 0.6); n.fxPulse = Math.max(n.fxPulse, 0.35); }
          }
          puff(a.x, a.y, '#ffd257', 2, 10, 1.3);
        }
      }
      // §7 : ingenieur 'repair' — recolle la garnison du bâtiment allié le plus proche
      if (a.st.ability === 'repair') {
        const bn = nearestNode(a.x, a.y, n2 => n2.owner === a.f && bdist(a.x, a.y, n2.x, n2.y) < 130);
        if (bn && nodeGTot(bn) < bn.cap) {
          a.repairAcc = (a.repairAcc || 0) + 0.4 * dt; // +0.4 u/s
          if (a.repairAcc >= 1) {
            a.repairAcc -= 1;
            // on renforce le type déjà dominant (sinon un lancier de dépannage)
            let pick = null, pc = 0;
            for (const t in bn.g) if (bn.g[t] > pc) { pc = bn.g[t]; pick = t; }
            pick = pick || bn.prodType || 'lancier';
            bn.g[pick] = (bn.g[pick] || 0) + 1;
            bn.bump = Math.max(bn.bump, 0.4);
            bn.fxPulse = Math.max(bn.fxPulse, 0.5);
            puff(bn.x, bn.y - 6, '#9fd8ec', 3, 20, 1.6);
            if (a.dmgTxtT <= 0) { addDmgText(bn.x, bn.y - 16, '+1', '#9fd8ec'); a.dmgTxtT = 0.4; }
          }
        }
      }
      // §7 : chronarque 'haste' — pulse toutes les 6 s, +30% aspd (2 s) aux alliés proches
      if (a.st.ability === 'haste') {
        if (a.hasteCd == null) a.hasteCd = 1.5 + Math.random() * 3;
        a.hasteCd -= dt;
        if (a.hasteCd <= 0) {
          a.hasteCd = 6;
          eachNear(a.x, a.y, 92, o => { if (!o.dead && o.f === a.f) o.hasteBoostT = 2; });
          fxRings.push({ x: a.x, y: a.y, r: 92, life: 0.6, tot: 0.6, col: a.f === 'cats' ? '#c8a0ff' : '#7fd0ff' });
          puff(a.x, a.y, a.f === 'cats' ? '#c8a0ff' : '#7fd0ff', 12, 60, 2.6);
          addDmgText(a.x, a.y - 12, '⏱', '#bfe4ff');
          sfx('whoosh', 220);
        }
      }

      // recherche d'ennemis (throttlée) ; sous fumigène, on ne verrouille RIEN
      const leash = a.boss ? 240 : Math.max(60, a.st.range * 1.5);
      if (a.confuseT > 0) dropFoe(a);
      if (a.foe && (a.foe.dead || bdist(a.x, a.y, a.foe.x, a.foe.y) > leash)) dropFoe(a);
      const pacifist = a.st.ability === 'support' || a.st.ability === 'heal';
      if (!a.foe && !pacifist && a.confuseT <= 0 && a.scanT <= 0) {
        a.foe = findFoe(a);
        a.scanT = 0.22 + Math.random() * 0.12;
      }

      const tgt = a.target;
      // glu de nectar : on avance comme un lundi matin
      // MAJ §3 : les Fanions de ralliement boostent la vitesse GÉNÉRALE des unités
      let spd = a.st.mspd * (1 + bfBonus(a.f, 'rally'));
      for (let i = 0; i < slowPools.length; i++) {
        const sp2 = slowPools[i];
        if (sp2.f !== a.f && bdist(a.x, a.y, sp2.x, sp2.y) < sp2.r) { spd *= (1 - sp2.pow); break; }
      }
      if (a.slowT > 0) spd *= (1 - (a.slowPow || 0.4)); // projectile gluant de l'entraveur
      if ((a.rallyT || 0) > 0) spd *= (a.rallyMul || 1.5); // §D4 fanfare : pas de course
      // §D17quater : pendant le bond de charge, la vélocité est pilotée directement par
      // la poursuite (powerTick, mspd×10) — pas de multiplicateur ici (double compte).
      let brake = false;
      let faceLock = false;  // §anti-gigote : angle verrouillé (combat au contact / tir posté / attente)
      let marching = false;  // §attente : true si l'unité MARCHE librement vers son nœud (fenêtre de progression)
      let formMarch = false; // §régiment : true si l'unité tient sa ligne (séparation allégée)
      let sieging = false;   // §B4 : true si l'unité fonce dans une porte hostile (séparation quasi nulle)
      let flowing = false;   // §OBST : true si la marche suit le champ de flux (ligne droite barrée)

      // §attente : un foe verrouillé réveille l'unité IMMÉDIATEMENT (fin de pause)
      if (a.foe && (a.waitT > 0 || a.waitX != null)) {
        a.waitT = 0; a.waitX = null; a.progD = null; a.progT = 0; a.progWin = 1.2; a.obsStall = false;
      }

      if (a.foe) {
        let d = bdist(a.x, a.y, a.foe.x, a.foe.y);
        const stopD = a.st.range > 0 ? a.st.range * 0.92 : CONTACT_R;
        // §re-ciblage : PAS engagée (hors portée de frappe) et un ennemi NETTEMENT plus
        // proche (ratio < 0.6) est accessible → on rebascule. Cooldown 0.5 s anti ping-pong.
        if (d > stopD + 1.5) {
          a.retargetT = (a.retargetT || 0) - dt;
          if (a.retargetT <= 0) {
            a.retargetT = 0.5;
            let near = null, nd = Infinity;
            eachNear(a.x, a.y, d, (o) => {
              if (o.f === a.f || o.dead || o.stealthed || o === a.foe) return;
              if ((o.engagedBy || 0) >= ENGAGE_CAP) return; // accessible = pas déjà saturé
              const dd = bdist(a.x, a.y, o.x, o.y);
              if (dd < nd) { nd = dd; near = o; }
            });
            if (near && nd < d * 0.6) {
              dropFoe(a);
              a.foe = near; near.engagedBy = (near.engagedBy || 0) + 1;
              d = nd;
            }
          }
        }
        if (d <= stopD + 1.5) {
          brake = true;
          faceLock = true;
          // §anti-gigote : ENGAGÉE au contact → l'angle est VERROUILLÉ plein foe (atan2),
          // recalculé SEULEMENT si le foe (ou l'unité) a bougé sensiblement. Jamais par
          // la vélocité : les forces résiduelles (séparation/évitement) ne pilotent plus
          // le sprite, fini la toupie au corps à corps.
          if (a.faceFoe !== a.foe
            || Math.abs(a.foe.x - a.faceFx) + Math.abs(a.foe.y - a.faceFy) > 4
            || Math.abs(a.x - a.faceSx) + Math.abs(a.y - a.faceSy) > 4) {
            a.faceFoe = a.foe; a.faceFx = a.foe.x; a.faceFy = a.foe.y; a.faceSx = a.x; a.faceSy = a.y;
            a.angle = Math.atan2(a.foe.y - a.y, a.foe.x - a.x);
          }
          if (a.cd <= 0) strike(a, a.foe);
        } else {
          // assassin : dash sur sa proie (bien visible, très impoli)
          if (a.st.ability === 'duelist' && a.dashCd <= 0 && d < 110 && d > stopD + 6) {
            a.dashCd = 2.4;
            const anF = Math.atan2(a.foe.y - a.y, a.foe.x - a.x);
            a.vx += Math.cos(anF) * spd * 2.2;
            a.vy += Math.sin(anF) * spd * 2.2;
            puff(a.x, a.y, '#c8d8ff', 4, 20, 1.6);
          }
          // §MOUV2 : poursuite BARRÉE par une pierre — la chasse n'a pas de flux
          // par défaut (steering local assumé). MAIS si on ne se RAPPROCHE plus
          // du foe depuis ~1,2 s, que le foe est QUASI IMMOBILE (posté/ancré :
          // le cas « planqué derrière la pierre » — un foe de mêlée mouvante n'a
          // pas besoin de flux et son champ par cellule coûterait un BFS par
          // case traversée) ET que la ligne de vue est coupée par un obstacle,
          // on suit le champ de flux vers la CELLULE du foe au lieu de labourer
          // la pierre. Dès que la distance baisse à nouveau (ou LOS dégagée au
          // re-test), retour à la poursuite directe : le combat au contact
          // (d ≤ stopD) reste 100 % local, rien de téléguidé.
          if (a.chaseFoe !== a.foe) { a.chaseFoe = a.foe; a.chaseBest = d; a.chaseT = 0; a.chaseFlow = false; }
          if (d < a.chaseBest - 2) { a.chaseBest = d; a.chaseT = 0; a.chaseFlow = false; }
          else {
            a.chaseT += dt;
            if (a.chaseT >= 1.2) {
              a.chaseT = 0;
              a.chaseFlow = obstacles.length > 0
                && (a.foe.vx * a.foe.vx + a.foe.vy * a.foe.vy) < 144 // foe ~statique (< 12 px/s)
                && !flowLosClear(a.x, a.y, a.foe.x, a.foe.y);
            }
          }
          // flowing levé aussi ici : la bande tangentielle (§MOUV3) s'aligne sur
          // le flux du détour au lieu du côté engagé (flowDX/DY valides ce frame).
          if (a.chaseFlow && flowFoeGoal(a, a.foe.x, a.foe.y)) { flowing = true; steer(a, flowGX, flowGY, spd, dt); }
          else steer(a, a.foe.x, a.foe.y, spd, dt);
        }
      } else if ((a.rallyT || 0) > 0 && !a.wild) {
        // §D4 fanfare : override de cible — tout le monde converge vers le cor
        const dR = bdist(a.x, a.y, a.rallyX || tgt.x, a.rallyY || tgt.y);
        if (dR > 30) steer(a, a.rallyX, a.rallyY, spd, dt);
        else brake = true;
      } else if (a.wild) {
        // §3e armée : le sbire 'wild' MARAUDE autour de son QG (le boss). Il ne vise
        // AUCUN nœud, n'entre nulle part, ne capture RIEN — il tourne, mord ce qui
        // passe (géré par la branche a.foe), et revient dès qu'il s'éloigne trop.
        const hx = a.homeX, hy = a.homeY, wr = a.wanderR || 100;
        const dh = bdist(a.x, a.y, hx, hy);
        if (dh > wr) {
          steer(a, hx, hy, spd, dt); // rappel vers le QG
        } else {
          const oa = simT * 0.6 + a.phase;
          steer(a, hx + Math.cos(oa) * wr * 0.55, hy + Math.sin(oa) * wr * 0.55, spd * 0.55, dt);
        }
      } else {
        const dN = bdist(a.x, a.y, tgt.x, tgt.y);
        const hostile = tgt.owner !== a.f;
        // §MOUV1 : l'ordre d'assaut ne vaut que pour LA cible qui l'a déclenché
        // (re-ciblage fanfare/reflux/capture → on ré-évalue en posté normal)
        if (a.postAssault && (!hostile || a.postNode !== tgt)) a.postAssault = false;
        // §B4 : à l'approche d'une porte hostile (mêlée), on coupe quasi toute la
        // séparation → les assaillants s'engouffrent au lieu de se repousser en un
        // anneau juste devant la porte (l'ancien attroupement). Le tir garde sa
        // distance — SAUF en assaut §MOUV1 : là il s'engouffre comme la mêlée.
        sieging = hostile && dN < NODE_R + 26 && (a.st.range <= 0 || a.postAssault);
        if (a.boss && !hostile) {
          // le boss patrouille autour de son antre au lieu d'y rentrer
          const oa = simT * 0.5 + a.phase;
          steer(a, tgt.x + Math.cos(oa) * 52, tgt.y + Math.sin(oa) * 40, spd * 0.5, dt);
        } else if (dN < NODE_R - 4 && !hostile) {
          // absorption dans la garnison amie
          tgt.g[a.type] = (tgt.g[a.type] || 0) + 1;
          tgt.bump = Math.max(tgt.bump, 0.5);
          a.dead = true;
          puff(a.x, a.y, 'rgba(255,255,255,0.7)', 2, 14, 1.6);
          return;
        }
        if (hostile && a.st.range > 0 && dN < a.st.range + NODE_R * 0.5 && dN >= ENTER_R && nodeGTot(tgt) > 0 && !a.postAssault) {
          // TIR : l'artilleur/tireur pilonne la garnison À DISTANCE (il n'entre pas
          // tant qu'il peut tirer). Reste au-delà d'ENTER_R : le siège B4 gère l'intérieur.
          brake = true;
          faceLock = true; // §anti-gigote : posté en tir, le sprite reste braqué sur le bâtiment
          a.angle = lerpAngle(a.angle, Math.atan2(tgt.y - a.y, tgt.x - a.x), Math.min(1, dt * 8));
          if (a.cd <= 0) {
            a.cd = 1 / Math.max(0.2, effAspd(a));
            a.lunge = 0.16;
            // §AUD1 : même règle qu'en strike — le kind suit la CATÉGORIE (projProfile)
            const ppN = projProfile(a);
            projectiles.push({
              kind: ppN.kind,
              x0: a.x, y0: a.y, x1: tgt.x + (Math.random() - 0.5) * 16, y1: tgt.y + (Math.random() - 0.5) * 16,
              t: 0, dur: Math.max(0.4, dN / 170), dmg: damageOf(a), f: a.f, src: a, // §D17 : siege lit p.src
              aoe: ppN.aoe,
              buildingMult: ppN.bm == null ? 0.8 : ppN.bm,
            });
            sfx('whoosh', 240);
          }
          // §MOUV1 : pilonnage SANS PROGRÈS → ASSAUT. Un tireur posté dont la
          // cible ne PERD PAS de garnison sur ~9 s (production/renforts ≥ dégâts
          // de bombardement) est statufié pour la bataille entière — LE
          // "piétinement à la sortie du bâtiment" du rapport joueur (les nœuds
          // voisins sont à 130-250 px : l'anneau de tir colle à la porte de la
          // source). Dans ce cas il DONNE L'ASSAUT comme la mêlée : il marche
          // jusqu'à la porte et resolveSiege tranche (§B4 : « ça se règle, on
          // ressort mort ou propriétaire »). Tant que la garnison BAISSE, rien
          // ne change : il reste posté et pilonne (le design du tir est intact).
          const gNow = nodeGTot(tgt);
          if (a.postNode !== tgt || simT - (a.postSimT || -9) > 0.5) { a.postNode = tgt; a.postT = 0; a.postG = gNow; }
          a.postSimT = simT;
          a.postT += dt;
          if (a.postT >= 9) {
            if (gNow >= a.postG - 0.5) a.postAssault = true; // 9 s sans un mort : on y va
            a.postT = 0; a.postG = gNow;
          }
        } else if (hostile && dN < ENTER_R) {
          // §B4 : l'assaillant TOUCHE le bâtiment (dN < ENTER_R) → il ENTRE et le
          // siège se résout en chaîne de duels 1v1, instantanément. Fini
          // l'attroupement devant la porte : on entre dès qu'on l'effleure, ça se
          // règle, on ressort mort ou propriétaire. (Le tir garde sa branche à distance.)
          const defs = nodeGTot(tgt);
          if (defs <= 0) { captureNode(tgt, a.f, a); return; }
          const pacifist = a.st.ability === 'support' || a.st.ability === 'heal';
          if (damageOf(a) > 0 && !pacifist) { resolveSiege(a, tgt); return; }
          // §B2 : les non-combattants (soutien/soigneur) ne restent PAS plantés dans
          // la base ennemie : ils refluent vers l'allié le plus proche au lieu de figer.
          const back = nearestNode(a.x, a.y, n2 => n2.owner === a.f && n2 !== tgt);
          if (back) a.target = back;
          steer(a, (back || tgt).x, (back || tgt).y, spd, dt);
        } else if (a.waitT > 0) {
          // §attente : chemin bloqué → on TIENT POSITION au lieu d'orbiter/glisser le
          // long des obstacles ou de la mêlée. Angle sur la cible, ancre stable (on
          // revient doucement au point d'attente si on a été poussé), et re-essai
          // bref toutes les ~0.6 s. L'unité reste engageable : le scan de foes plus
          // haut la réveille immédiatement si un ennemi entre à portée.
          a.waitT -= dt;
          faceLock = true;
          a.angle = lerpAngle(a.angle, Math.atan2(tgt.y - a.y, tgt.x - a.x), Math.min(1, dt * 6));
          // ancre : posée à l'entrée en attente, re-posée seulement si on a été
          // projeté LOIN (tornade, boss) — jamais par la dérive des re-essais.
          if (a.waitX == null || bdist(a.x, a.y, a.waitX, a.waitY) > 120) { a.waitX = a.x; a.waitY = a.y; }
          const dw = bdist(a.x, a.y, a.waitX, a.waitY);
          if (dw > 6) steer(a, a.waitX, a.waitY, Math.min(spd, 36), dt);
          else brake = true;
          if (a.waitT <= 0) { a.progD = null; a.progT = 0; a.progWin = 0.6; } // re-essai bref
        } else if (a.slot != null && a.regDx != null) {
          // §régiment : marche façon Mushroom Wars. L'AVANCE VERS LE NŒUD reste TOUJOURS
          // dominante (jamais de point fixe qui fige l'unité en plein champ). La formation
          // n'est qu'un ÉTALEMENT LATÉRAL (ressort perpendiculaire vers le slot) + un léger
          // recul des rangs/bords (ralentissement longitudinal) → arc qui s'ouvre en avançant
          // puis se resserre à l'approche (funnel). Le pack sort serré, se déploie, entonne.
          // §B1 — RÉGLAGES FORMATION (rangs de 8 nets, courbure très faible) :
          const uw = 30 * a.scale;      // taille d'unité de référence à l'écran (px)
          const spacing = uw * 1.28;    // écart latéral LARGE → 8 bien séparés, côte à côte
          const kLat = 5;               // raideur du ressort latéral (snap franc dans la ligne)
          const rowSlow = 0.20;         // recul par rang → rangs bien séparés (0 = collés)
          const curve = 0.004;          // courbure de la ligne (col² × curve) — TRÈS faible
          const R = NODE_R + 60;        // distance de packing sortie/entrée
          const col = (a.slot % 8) - 3.5;     // colonne centrée [-3.5 .. 3.5] → 8 par rang
          const row = Math.floor(a.slot / 8); // rang (au-delà de 8, on empile derrière)
          const px = -a.regDy, py = a.regDx;  // perpendiculaire au cap
          // spread : ~0 à la sortie (dSrc petit) ET à l'entrée (dN petit), plein au milieu
          const dSrc = Math.hypot(a.x - a.regOx, a.y - a.regOy);
          const spread = bclamp(Math.min(dSrc, dN) / R, 0, 1);
          formMarch = spread > 0.25; // en déploiement : séparation allégée pour des lignes nettes
          // 1) AVANCE : on vise TOUJOURS le nœud → dN décroît sans cesse, zéro stall.
          //    Les rangs arrière traînent (séparation des rangs) + les bords à peine
          //    (courbure quasi nulle) ; à l'arrivée (spread→0) tout le monde recolle.
          const backSlow = bclamp((row * rowSlow + (col * col) * curve) * spread, 0, 0.5);
          marching = true; // §attente : marche libre → fenêtre de progression armée
          // §attente : en RE-ESSAI après blocage, on avance prudemment (pas de
          // catapultage par les forces d'obstacle si le passage est toujours fermé)
          // — SAUF stall CONTRE un obstacle (§OBST a.obsStall) : le flux guide,
          // l'évitement est actif, la vitesse reste normale.
          // §OBST : ligne droite barrée par un obstacle → on vise le point AVAL
          // du champ de flux au lieu du nœud (contournement global, plus de
          // paquets collés au mur) ; sinon, ligne droite comme avant.
          flowing = flowGoal(a, tgt, dN);
          // §OBST : re-essai après stall CONTRE un obstacle ET flux disponible →
          // vitesse normale (le flux guide, l'évitement est actif). Flux MUET
          // (mur infranchissable) ou stall de cohue : re-essai prudent historique.
          const spdF = (a.waitX != null && !(a.obsStall && flowing)) ? Math.min(spd, 22) : spd;
          // en re-essai, PAS de ralenti de formation (backSlow) — l'essai doit
          // sonder à pleine allure de re-essai, sinon une unité de rang arrière
          // (backSlow 0.5) ne peut JAMAIS atteindre le seuil de libération du
          // watchdog (vGoal/vFlow > 0.55 × vitesse de re-essai).
          const spdM = a.waitX != null ? spdF : spdF * (1 - backSlow);
          if (flowing) steer(a, flowGX, flowGY, spdM, dt);
          else steer(a, tgt.x, tgt.y, spdM, dt);
          // 2) ÉTALEMENT LATÉRAL : ressort perpendiculaire vers la colonne voulue.
          //    (coupé pendant un re-essai après blocage : l'essai avance tout
          //    droit — et coupé en CONTOURNEMENT de flux : le ressort tirerait
          //    vers la ligne droite, c.-à-d. à travers l'obstacle)
          if (a.waitX == null && !flowing) {
            const lateralDes = col * spacing * spread;                 // offset latéral cible
            const lateralAct = (a.x - tgt.x) * px + (a.y - tgt.y) * py; // offset latéral réel (projeté)
            const errLat = lateralDes - lateralAct;
            a.vx += px * errLat * kLat * dt;
            a.vy += py * errLat * kLat * dt;
          }
        } else {
          // fallback (vieux agents, rejetons de 'split', offlineResolve) : l'ancien blob
          const k = hostile ? Math.max(0.35, bclamp((dN - 50) / 140, 0, 1)) : bclamp((dN - 50) / 140, 0, 1);
          marching = true; // §attente : marche libre → fenêtre de progression armée
          flowing = flowGoal(a, tgt, dN); // §OBST : contournement par le flux si barré
          const spdFb = (a.waitX != null && !(a.obsStall && flowing)) ? Math.min(spd, 22) : spd; // §OBST : cf. régiment
          if (flowing) steer(a, flowGX, flowGY, spdFb, dt);
          else steer(a, tgt.x + a.ox * k, tgt.y + a.oy * k, spdFb, dt);
        }
      }

      if (brake) { a.vx *= Math.pow(0.002, dt); a.vy *= Math.pow(0.002, dt); }

      // séparation : quasi nulle si l'unité s'engouffre dans une porte hostile (B4,
      // sinon elle campe en anneau devant), allégée si elle tient sa ligne de
      // régiment, pleine en combat (anti-tas qui fond sous l'AoE).
      const sep = sieging ? 3 : (formMarch ? 8 : 16), sep2 = sep * sep;
      eachNear(a.x, a.y, sep, (o) => {
        if (o === a || o.dead) return;
        const dx = a.x - o.x, dy = a.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < sep2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          let f = ((sep - d) / sep) * 80 * dt;
          if (a.boss) f *= 0.15;      // le boss ne se pousse pas, il EST le mur
          else if (o.boss) f *= 2;    // ... et il écarte les petits
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        }
      });

      // évitement d'obstacles : steering tangentiel, jamais bloquant à 100 %
      // §OBST : ENGAGEMENT DE CÔTÉ — le côté de contournement (a.avoidSide) est
      // choisi UNE fois à l'entrée en zone d'influence, gardé tant qu'on reste à
      // < r+45 d'un obstacle, effacé au large. Fini le choix par frame (flips de
      // tangente qui clouaient les unités au fond des concavités).
      let nearObs = false;
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const dx = a.x - o.x, dy = a.y - o.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const rr = o.r + 8;
        if (d < o.r + 45) nearObs = true;
        if (d < rr) {
          const push = (rr - d) / rr;
          a.vx += (dx / d) * push * 260 * dt;
          a.vy += (dy / d) * push * 260 * dt;
        } else if (d < rr + 30 && (a.waitX == null || (a.obsStall && flowing))) {
          // on n'infléchit que si on fonce dedans — et jamais en re-essai après
          // un stall de COHUE (loin des obstacles) ni face à un mur SANS issue
          // (flux muet) : ces essais avancent tout droit. Un stall CONTRE un
          // obstacle AVEC un flux disponible garde l'évitement ACTIF : le
          // re-essai suit le flux et doit pouvoir longer le mur (§OBST).
          if (a.vx * -dx + a.vy * -dy > 0) {
            // §MOUV3 : en suivi de FLUX (marche §OBST ou chasse §MOUV2), la
            // tangente s'aligne sur le flux — le côté engagé (avoidSide) pouvait
            // CONTRARIER le détour au creux de DEUX pierres et clouer les unités
            // lentes (accélération de seek ∝ mspd < poussée de bande). Le flux
            // est spatialement lisse : zéro flip de tangente. Hors flux :
            // engagement historique inchangé.
            let side;
            if (flowing) {
              side = (flowDX * (-dy / d) + flowDY * (dx / d)) >= 0 ? 1 : -1;
              a.avoidSide = side; // cohérence au retour en steering direct
            } else {
              if (!a.avoidSide) a.avoidSide = (a.vx * (-dy / d) + a.vy * (dx / d)) >= 0 ? 1 : -1;
              side = a.avoidSide;
            }
            const px2 = (-dy / d) * side, py2 = (dx / d) * side;
            const k2 = 1 - (d - rr) / 30;
            a.vx += px2 * 150 * k2 * dt;
            a.vy += py2 * 150 * k2 * dt;
          }
        }
      }
      if (!nearObs) a.avoidSide = 0; // au large de tout : le côté est oublié

      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.x = bclamp(a.x, 8, map.w - 8);
      a.y = bclamp(a.y, 8, map.h - 8);

      // §attente : fenêtre glissante de PROGRESSION vers la cible (marche libre
      // uniquement). Si sur ~1.2 s l'unité ne s'est pas RAPPROCHÉE de son nœud
      // (~12 px, seuil adapté aux unités lentes/ralenties pour ne jamais geler une
      // armée en marche), elle passe en attente 0.6 s puis re-teste par essais brefs.
      if (marching && !a.boss) {
        const dGoal = bdist(a.x, a.y, tgt.x, tgt.y);
        if (a.progD == null || a.progTgt !== tgt) { a.progTgt = tgt; a.progD = dGoal; a.progT = 0; a.progX = a.x; a.progY = a.y; }
        a.progT += dt;
        const win = a.progWin || 1.2;
        if (a.progT >= win) {
          const effS = (a.waitX != null && !(a.obsStall && flowing)) ? Math.min(spd, 22) : spd; // vitesse de re-essai réduite (cohue / mur sans issue)
          let freeAgain;
          if (a.waitX != null) {
            // déjà bloquée (re-essai) : il faut (1) battre la MEILLEURE distance
            // atteinte depuis le blocage — sinon glisser vers l'axe de la cible
            // compte comme un faux progrès — ET (2) être encore en MOUVEMENT vers
            // la cible en fin d'essai : une unité coincée finit son essai encaissée
            // dans le mur à vitesse ~nulle, une unité libérée file plein pot.
            const gx2 = (tgt.x - a.x) / (dGoal || 1), gy2 = (tgt.y - a.y) / (dGoal || 1);
            const vGoal = a.vx * gx2 + a.vy * gy2;
            const ref = a.progBest != null ? Math.min(a.progBest, a.progD) : a.progD;
            // le CAP fait foi (coincé = vitesse ~nulle en fin d'essai, glissade
            // latérale = projection ~nulle) ; la distance n'exige qu'un gain réel.
            freeAgain = vGoal > effS * 0.55 && ref - dGoal > 0.5;
            // §OBST : en suivi de flux, le CAP LE LONG DU FLUX fait foi — le
            // contournement longe le mur (projection vers le but ~nulle) sans
            // être un blocage. Une unité relancée qui file le long du champ à
            // bonne allure en fin d'essai est libérée.
            if (!freeAgain && flowing && (a.vx * flowDX + a.vy * flowDY) > effS * 0.55) freeAgain = true;
          } else {
            // marche normale : ~10 px/s de rapprochement exigés (adapté aux lents)
            freeAgain = a.progD - dGoal >= win * Math.min(10, effS * 0.4);
          }
          // §OBST : en CONTOURNEMENT (flux), le progrès se mesure au DÉPLACEMENT
          // réel — longer un mur éloigne parfois du but à vol d'oiseau (ou garde
          // un cap tangentiel) sans être un blocage. Une unité qui suit le flux
          // à bonne allure n'est jamais déclarée coincée.
          if (!freeAgain && flowing && a.progX != null
            && bdist(a.x, a.y, a.progX, a.progY) >= win * effS * 0.4) freeAgain = true;
          if (!freeAgain && dGoal > NODE_R + 44) {
            a.waitT = 0.6; // bloqué → attente (jamais aux abords du nœud : la cohue y est normale)
            if (a.waitX == null) {
              a.waitX = a.x; a.waitY = a.y; a.progBest = dGoal; // ancre du point d'attente
              // §OBST : stall AU CONTACT d'un obstacle (< r+30) → le re-essai
              // suivra le FLUX avec évitement actif (voir spdF / garde de la
              // bande tangentielle). Loin de tout obstacle (cohue de mêlée,
              // porte assiégée) : comportement historique inchangé.
              a.obsStall = false;
              for (let i = 0; i < obstacles.length; i++) {
                const o = obstacles[i];
                if (bdist(a.x, a.y, o.x, o.y) < o.r + 30) { a.obsStall = true; break; }
              }
            } else a.progBest = Math.min(a.progBest, dGoal);
          } else {
            a.waitX = null; a.progBest = null; a.progWin = 1.2; a.obsStall = false; // ça progresse : régime normal
          }
          a.progT = 0; a.progD = dGoal; a.progX = a.x; a.progY = a.y;
        }
      } else if (!(a.waitT > 0) || a.foe) { // (waitT peut être undefined : jamais en attente)
        a.progD = null; a.progT = 0; // pas en marche libre : fenêtre désarmée (sans toucher au re-essai)
      }

      const sp = Math.hypot(a.vx, a.vy);
      if (sp > 2) {
        // §anti-gigote : hystérésis du facing — l'angle ne suit la vélocité que si
        // l'unité se DÉPLACE vraiment (> 25 % de sa vitesse voulue) et qu'aucun
        // verrou n'est posé (combat/tir/attente). À l'arrêt, on garde l'angle.
        if (!faceLock && sp > spd * 0.25) {
          a.angle = lerpAngle(a.angle, Math.atan2(a.vy, a.vx), Math.min(1, dt * 7));
        }
        a.phase += dt * (3.5 + sp * 0.16);
      } else {
        a.phase += dt * 1.2;
      }
      // §D17 tourbillon : pendant a.spinT, le corps TOURNOIE sur lui-même — le cycle
      // rapide de a.angle fait défiler les 8 directions du sprite (voulu, PAS un bug)
      // et OUTREPASSE le verrou de facing du corps à corps (appliqué après, il gagne).
      if ((a.spinT || 0) > 0) { a.spinT -= dt; a.angle += dt * 14; }
    }
    function steer(a, gx, gy, spd, dt) {
      const dx = gx - a.x, dy = gy - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dt * 4);
      a.vx += ((dx / d) * spd - a.vx) * k;
      a.vy += ((dy / d) * spd - a.vy) * k;
    }

    // ---- tours + riposte de garnison ------------------------------
    function updateNodeCombat(n, dt) {
      // tour de défense : flèches. MAJ §3 : dégâts de base ×2 (5 → 10) et 3 pistes
      // d'ingénierie distinctes — 'tower' (dégâts), 'towerCount' (flèches par
      // volée), 'towerRate' (cadence). Scaling IA via cfg.enemyBuilding.
      if (n.kind === 'defense' && n.owner) {
        n.towerCd -= dt;
        if (n.towerCd <= 0) {
          // §B (DESIGN13) : portée UNIFIÉE des tours (GameData.BALANCE.towerRange || 185)
          const foes = [];
          eachNear(n.x, n.y, TOWER_RANGE, (o) => {
            if (o.dead || o.f === n.owner || o.stealthed) return; // §7 : la tour ne voit pas l'espion
            foes.push([bdist(n.x, n.y, o.x, o.y), o]);
          });
          if (foes.length) {
            foes.sort((u, v) => u[0] - v[0]);
            n.towerCd = 1.2 / (1 + bfBonus(n.owner, 'towerRate'));
            n.fxPulse = Math.max(n.fxPulse, 0.6);
            // POIDS DE VOLÉE : la piste 'towerCount' donne un poids continu (1 → 5).
            // Les flèches pleines partent à 100 %, la dernière à sa FRACTION — une
            // flèche qui se remplit niveau après niveau au lieu d'apparaître d'un coup.
            const wVolley = 1 + bfBonus(n.owner, 'towerCount');
            const fullArrows = Math.floor(wVolley + 1e-6);
            const lastPart = wVolley - fullArrows;
            const shots = Math.min(foes.length, fullArrows + (lastPart > 0.005 ? 1 : 0));
            const dmg1 = 10 * (1 + n.defBonus) * (n.owner === ef ? difficulty : 1) * (1 + bfBonus(n.owner, 'tower'));
            for (let s = 0; s < shots; s++) {
              const bd = foes[s][0], foe = foes[s][1];
              const part = s < fullArrows ? 1 : lastPart;
              projectiles.push({
                kind: 'arrow', x0: n.x, y0: n.y - 18, x1: foe.x, y1: foe.y,
                t: 0, dur: Math.max(0.18, bd / 300), dmg: dmg1 * part,
                f: n.owner, aoe: 16, weak: part < 0.999,
              });
            }
            sfx('tick', 260);
          } else n.towerCd = 0.35;
        }
      }
      // MAJ §7 : garnisons urticantes — si le sort « piquants » est actif pour le
      // camp propriétaire, le bâtiment mord TOUT ennemi de passage (garnison ou pas).
      if (n.owner && (spikeAuraT[n.owner] || 0) > 0) {
        n.spikeT = (n.spikeT || 0) - dt;
        if (n.spikeT <= 0) {
          n.spikeT = 0.75;
          const pow = spikeAuraPow[n.owner] || 8;
          eachNear(n.x, n.y, NODE_R + 14, (o) => {
            if (o.dead || o.f === n.owner || o.stealthed) return;
            hurtAgent(o, pow, n.owner, n.x, n.y);
          });
        }
      }
      // riposte : la garnison mordille les assiégeants. MAJ majeure §1 : elle ne
      // mord QUE les unités qui visent ce nœud (tentative de capture) — passer à
      // côté d'un bâtiment est indolore ; seule la Tour tire à l'extérieur.
      n.retalT -= dt;
      if (n.retalT <= 0) {
        n.retalT = 0.75;
        if (nodeGTot(n) > 0) {
          const dmg = garrisonDmg(n);
          if (dmg > 0) {
            eachNear(n.x, n.y, NODE_R + 12, (o) => {
              if (o.dead || o.f === n.owner || o.stealthed) return; // §7 : pas de riposte sur l'espion planqué
              if (o.target === n) hurtAgent(o, dmg, n.owner, n.x, n.y);
            });
          }
        }
      }
    }

    // ---- projectiles ----------------------------------------------
    function updateProjectiles(dt) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.t += dt / p.dur;
        // §D18 trainee : braises arcanes semées AU SOL le long du vol (pattern
        // lava/blizzard : petites zones espacées de ~16 px, dégâts/s × durée)
        if (p.src && p.src.power && p.src.power.kind === 'trainee') {
          const tc = Math.min(p.t, 1);
          const tlen = bdist(p.x0, p.y0, p.x1, p.y1) || 1;
          if (p.tzT == null) p.tzT = 0;
          while ((tc - p.tzT) * tlen >= 16) {
            p.tzT += 16 / tlen;
            if (zones.length < 90) {
              const zx = p.x0 + (p.x1 - p.x0) * p.tzT, zy = p.y0 + (p.y1 - p.y0) * p.tzT;
              zones.push({ x: zx, y: zy, f: p.f, life: p.src.pwTrDur || 2.5, r: Math.max(7, (p.src.pwTrW || 14) * 0.6), dmg: p.dmg * (p.src.pwTrPct || 0.25), col: '#c96bff' });
              spellPart({ kind: 'ember', x: zx, y: zy - 2, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30, life: 0.4, size: 1.4, col: '#d879ff' });
              pwFirstFx(p.src);
            }
          }
        }
        if (p.t < 1) continue;
        // impact
        let hit = false;
        let pv = null; // victime monocible (percant : liste des déjà-touchés)
        if (p.kind === 'shot') {
          // monocible : la cible visée, sinon le passant le plus proche
          let o = p.tgt && !p.tgt.dead && bdist(p.tgt.x, p.tgt.y, p.x1, p.y1) < 26 ? p.tgt : null;
          if (!o) {
            let bd = 14;
            eachNear(p.x1, p.y1, 14, (o2) => {
              if (o2.dead || o2.f === p.f) return;
              const d = bdist(o2.x, o2.y, p.x1, p.y1);
              if (d < bd) { bd = d; o = o2; }
            });
          }
          if (o) {
            hurtAgent(o, p.dmg, p.f, p.x1, p.y1, p.src);
            if (p.slow && !o.dead) { // glu de l'entraveur : -40% mspd, 2 s
              o.slowT = Math.max(o.slowT || 0, p.slow.t);
              o.slowPow = p.slow.pow;
              puff(o.x, o.y, '#c8e860', 3, 18, 1.6);
            }
            if (p.src && p.src.power) pwAfterHit(p, o); // §D17 : rebond / zone / vampirisme
            hit = true;
            pv = o;
          }
        } else if (p.aoe > 0) {
          // zone plafonnée : 4 cibles max, dégâts décroissants
          hit = aoeDamage(p.x1, p.y1, p.aoe, p.dmg, p.f, p.x1, p.y1, p.src) > 0;
          if (hit && p.src && p.src.power) pwAfterHit(p, null); // §D17 : rebond / zone / vampirisme
        }
        // dégâts sur garnison proche — SAUF projectile de boss neutre : un hazard ne
        // capture pas de bâtiment (un propriétaire 'neutral' casserait contrôle/victoire)
        if (!p.neutral) for (const n of ns) {
          if (n.owner === p.f) continue;
          if (bdist(n.x, n.y, p.x1, p.y1) < NODE_R) {
            if (n.owner !== null || nodeGTot(n) > 0) {
              // §D17 siege : ×mult contre les garnisons + étincelles oranges
              const gm = (p.src && p.src.power && p.src.power.kind === 'siege') ? (p.src.pwGMult || 2.2) : 1;
              damageGarrison(n, p.dmg * (p.buildingMult == null ? 0.8 : p.buildingMult) * gm, p.f, null);
              if (gm > 1) { puff(n.x, n.y - 8, '#ffb34d', 4, 34, 2); pwFirstFx(p.src); }
              hit = true;
            }
            break;
          }
        }
        // §D18 percant : le trait CONTINUE en ligne au lieu de s'arrêter — jusqu'à
        // pwPierce touches, dégâts ×decay par cible traversée (liste p.pHit).
        if (hit && p.src && p.src.power && p.src.power.kind === 'percant') {
          const left = p.prc == null ? (p.src.pwPierce || 3) - 1 : p.prc;
          if (left > 0) {
            const an = Math.atan2(p.y1 - p.y0, p.x1 - p.x0);
            let nx = null, bd = 131;
            eachNear(p.x1, p.y1, 130, (o2) => {
              if (o2.dead || o2.f === p.f || o2.stealthed || o2 === pv) return;
              if (p.pHit && p.pHit.indexOf(o2) >= 0) return;
              if (p.aoe > 0 && bdist(o2.x, o2.y, p.x1, p.y1) <= p.aoe) return; // déjà arrosé
              const d2 = bdist(o2.x, o2.y, p.x1, p.y1);
              if (d2 < 4) return;
              const an2 = Math.atan2(o2.y - p.y1, o2.x - p.x1);
              let da = Math.abs(an2 - an);
              if (da > Math.PI) da = Math.PI * 2 - da;
              if (da > 0.45) return; // hors de l'axe du tir (~±26°)
              if (d2 < bd) { bd = d2; nx = o2; }
            });
            if (nx) {
              p.prc = left - 1;
              if (pv) (p.pHit || (p.pHit = [])).push(pv);
              p.x0 = p.x1; p.y0 = p.y1; p.x1 = nx.x; p.y1 = nx.y;
              if (p.kind === 'shot') p.tgt = nx;
              p.t = 0; p.dur = Math.max(0.08, bd / 300);
              p.tzT = 0; // trainee éventuelle : nouveau segment
              p.dmg *= (p.src.pwPierceDecay || 0.75);
              pwFirstFx(p.src);
              puff(p.x0, p.y0, '#e8e8e8', 2, 22, 1.4);
              continue; // le projectile SURVIT — trait qui continue
            }
          }
        }
        puff(p.x1, p.y1, p.kind === 'magic' ? '#d87dff' : p.kind === 'lob' ? '#f2d24e' : '#e8e8e8', p.kind === 'magic' ? 12 : p.kind === 'lob' ? 6 : 3, 40, 2.2);
        if (hit) sfx('pop', 200);
        projectiles.splice(i, 1);
      }
    }

    // ---- IA --------------------------------------------------------
    const aiFactions = mode === 'collective' ? ['cats', 'birds'] : [ef];
    const aiTimers = {};
    for (const f of aiFactions) aiTimers[f] = 1 + Math.random() * 1.5;

    // MAJ §4 : renforts IA — cfg.enemyReinforce = { interval, waves, size } fourni
    // par progression.js. Les types renforcés = ceux présents dans les garnisons
    // ennemies au départ (cohérence avec le pool de la carte).
    const eReinf = (mode === 'personal' && cfg.enemyReinforce) ? cfg.enemyReinforce : null;
    let eReinfT = eReinf ? eReinf.interval : 0;
    let eReinfLeft = eReinf ? (eReinf.waves | 0) : 0;
    const eReinfTypes = (function () {
      const out = [];
      for (const n of ns) if (n.owner === ef) for (const t in n.g) if (out.indexOf(t) < 0) out.push(t);
      return out.length ? out : ['lancier'];
    })();

    // MAJ majeure §4 : IA refondue. cfg.aiLevel (0 facile → 3 expert, fourni par
    // progression.js selon l'avancement) module TOUT : fréquence de défense,
    // taille minimale des groupes, concentration multi-nœuds, priorités.
    const aiLevel = Math.max(0, Math.min(3, cfg.aiLevel != null ? cfg.aiLevel : 1));

    // CE QUE VAUT VRAIMENT UNE CIBLE. L'IA n'évaluait que la GARNISON du
    // nœud : elle lançait des assauts « gagnants sur le papier » dans les bras
    // d'une armée du joueur postée à côté, ou déjà en route. On compte donc
    // trois choses : la garnison, les unités adverses DÉJÀ SUR PLACE (dans un
    // rayon court), et celles EN VOL vers ce nœud. Même pondération par tier
    // que gStrength — les deux chiffres doivent se comparer.
    function fieldNear(f, node, radius) {
      let s2 = 0;
      for (const a of agents) {
        if (a.dead || a.f !== f || a.wild) continue;
        const enRoute = a.target === node;
        if (!enRoute && bdist(a.x, a.y, node.x, node.y) > radius) continue;
        const i = UNIT_ORDER.indexOf(a.type);
        s2 += 1 + Math.max(0, i) * 0.8;
      }
      return s2;
    }
    function defEstimate(f, node) {
      return gStrength(node) + fieldNear(BGD.other(f), node, 110);
    }

    function aiTick(f) {
      const mine = ns.filter(n => n.owner === f);
      if (!mine.length) return;
      const foeF = BGD.other(f);
      const ctrl = getControl();
      // rubber-band en collectif : le camp minoritaire défend plus
      let aggro = difficulty;
      if (mode === 'collective') {
        const my = ctrl[f], his = ctrl[foeF];
        aggro = my < his ? 0.75 : (my > his + 0.15 ? 1.35 : 1);
      }
      // LA COURSE AUX POINTS. Premier à ctrlWin gagne — l'IA le savait à
      // peine. Deux états changent tout son comportement :
      //   — l'ADVERSAIRE approche de la victoire (> 55 % du compteur) : les
      //     points de contrôle deviennent LA priorité, en attaque comme en
      //     défense — tout le reste peut attendre ;
      //   — ELLE-MÊME approche : elle se met à DÉFENDRE ce qu'elle tient au
      //     lieu de risquer ses garnisons dans des assauts — il suffit de
      //     tenir l'horloge.
      const foePts = (typeof ctrlPts === 'object' && ctrlPts[foeF]) || 0;
      const myPts = (typeof ctrlPts === 'object' && ctrlPts[f]) || 0;
      const panique = foePts > ctrlWin * 0.55;
      const conserve = myPts > ctrlWin * 0.55 && myPts > foePts;
      // réserve de garnison : une IA douée immobilise MOINS d'unités dans ses
      // bâtiments (elle s'épuisait en petits groupes en thésaurisant partout)
      const reserve = n => Math.max(2, (n.kind === 'hq' ? 10 : 5) - aiLevel * 1.5)
        + (mode === 'personal' ? 3 / Math.max(0.5, difficulty) : 3);

      // 1) DÉFENSE : rapatrier vers un nœud attaqué — OU SUR LE POINT DE
      // L'ÊTRE. L'ancienne IA n'aidait un nœud qu'une fois frappé (`hurtT`) :
      // le joueur voyait ses assauts arriver sans la moindre réaction, et les
      // renforts partaient toujours un combat trop tard. On regarde maintenant
      // les unités du joueur EN VOL : si ce qui arrive dépasse ce qui tient la
      // porte, le nœud appelle à l'aide AVANT le premier coup.
      const defPrio = { hq: 4, banner: 3, controle: conserve || panique ? 4.2 : 2.5, production: 2, defense: 1, reinforce: 1, avantposte: 0.5 };
      let hurt = null, hurtScore = -1;
      for (const n of mine) {
        const entrant = fieldNear(f, n, 90);           // les unités ADVERSES proches ou en route
        const menace = n.hurtT > 0 || entrant > nodeGTot(n) * 0.8 + 2;
        if (!menace) continue;
        const sc = (defPrio[n.kind] || 0) * 10 + entrant - nodeGTot(n);
        if (sc > hurtScore) { hurtScore = sc; hurt = n; }
      }
      if (hurt && Math.random() < (conserve ? 0.85 : 0.55 + aiLevel * 0.15)) {
        const helpers = mine
          .filter(n => n !== hurt && nodeGTot(n) > reserve(n) + 3)
          .sort((a, b) => bdist(a.x, a.y, hurt.x, hurt.y) - bdist(b.x, b.y, hurt.x, hurt.y));
        // le QG en danger déclenche un vrai rapatriement (plusieurs nœuds)
        const nHelp = hurt.kind === 'hq' ? 1 + Math.min(2, aiLevel) : 1;
        let sent = false;
        for (let i = 0; i < Math.min(nHelp, helpers.length); i++) {
          sendUnits(helpers[i], hurt, hurt.kind === 'hq' ? 0.65 : 0.5);
          sent = true;
        }
        if (sent) return;
      }

      // 2) ATTAQUE : priorités stratégiques — caserne (production), étendard,
      // points de contrôle, QG. Minoritaire aux points de contrôle (condition
      // de victoire !) → ils passent en tête.
      let myCtrl = 0, foeCtrl = 0;
      for (const cn of ns) {
        if (cn.kind !== 'controle') continue;
        if (cn.owner === f) myCtrl++; else if (cn.owner === foeF) foeCtrl++;
      }
      const ctrlHungry = myCtrl <= foeCtrl;

      // sources triées par surplus — la concentration se sert dans l'ordre
      const sources = mine
        .map(n => ({ n, spare: nodeGTot(n) - reserve(n) }))
        .filter(s => s.spare > 0)
        .sort((a, b) => b.spare - a.spare);
      if (!sources.length) return;
      const src = sources[0].n;

      // EN MODE CONSERVATION, on n'attaque plus que l'opportun : les neutres
      // faciles, et les points de contrôle si l'adversaire en reprend. Le temps
      // joue pour nous — chaque assaut risqué est un cadeau fait au joueur.
      const targets = ns.filter(n => n.owner !== f && !(conserve && n.owner === foeF && n.kind !== 'controle'));
      if (!targets.length) return;
      let tgt = null, bs = 1e18;
      for (const t of targets) {
        let prio = 0;
        if (t.kind === 'production') prio = 2.6;                    // la caserne nourrit tout
        else if (t.kind === 'banner') prio = 2.4;
        // EN PANIQUE (l'adversaire va gagner aux points), un point de contrôle
        // vaut plus que tout — y compris le QG : décapiter prend des minutes,
        // l'horloge n'en laisse plus.
        else if (t.kind === 'controle') prio = panique ? 4.5 : ctrlHungry ? 3 : 1.6;
        else if (t.kind === 'hq') prio = panique ? 0.4 : aiLevel >= 2 ? 2.2 : 0.8;
        else if (t.kind === 'defense' || t.kind === 'reinforce') prio = 0.7;
        const ownerMult = t.owner ? 1 : 0.6; // les neutres restent des proies faciles
        // LA FORCE DU JOUEUR COMPTE : un nœud « faible » gardé par une armée
        // posée à côté n'est pas une cible, c'est une embuscade.
        const score = (defEstimate(f, t) - prio * (6 + aiLevel * 3)) * ownerMult
          + bdist(src.x, src.y, t.x, t.y) * Math.max(0.02, 0.05 - aiLevel * 0.008);
        if (score < bs) { bs = score; tgt = t; }
      }
      if (!tgt) return;

      // 3) CONCENTRATION : si la meilleure source ne suffit pas, une IA moyenne+
      // groupe jusqu'à 1+aiLevel nœuds sur la MÊME cible — fini les gouttes.
      // le besoin compte la défense RÉELLE — garnison + armée du joueur sur
      // place et en route — avec une marge qui grandit avec le niveau d'IA :
      // une IA douée ne part pas à 105 % contre une défense qu'elle voit venir.
      const need = defEstimate(f, tgt) * (1.05 + aiLevel * 0.08);
      let pow = sources[0].spare * 1.1 * aggro;
      const wave = [sources[0]];
      if (aiLevel >= 1) {
        for (let i = 1; i < sources.length && wave.length < 1 + aiLevel && pow <= need; i++) {
          wave.push(sources[i]);
          pow += sources[i].spare * 1.1 * aggro;
        }
      }
      const minGroup = 3 + aiLevel * 2; // taille minimale d'un assaut
      const total = wave.reduce((s, w) => s + w.spare, 0);
      if (total < minGroup) return;
      if (pow > need || Math.random() < Math.max(0.03, 0.12 - aiLevel * 0.025) * aggro) {
        const ratio = bclamp(0.5 + 0.25 * Math.random() * aggro + aiLevel * 0.05, 0.35, 0.9);
        for (const w of wave) sendUnits(w.n, tgt, ratio);
      }
    }

    // ---- alliés simulés (collectif) --------------------------------
    const allyTimers = { cats: 8 + Math.random() * 14, birds: 8 + Math.random() * 14 };
    function allyDeposit(f) {
      const mine = ns.filter(n => n.owner === f);
      if (!mine.length) return;
      const foeF = BGD.other(f);
      const foeNodes = ns.filter(n => n.owner === foeF);
      // nœud du camp le plus proche du front
      let node = mine[0];
      if (foeNodes.length) {
        const scored = mine.map(n => {
          let d = 1e9;
          for (const m of foeNodes) d = Math.min(d, bdist(n.x, n.y, m.x, m.y));
          return { n, d };
        }).sort((a, b) => a.d - b.d);
        node = scored[Math.min(scored.length - 1, (Math.random() * 3) | 0)].n;
      }
      // rubber-band : le camp minoritaire reçoit ~1.6× plus
      const ctrl = getControl();
      const mult = ctrl[f] < ctrl[foeF] ? 1.6 : 1;
      const r = Math.random();
      let type = 'lancier';
      if (r > 0.92) type = 'heros';
      else if (r > 0.80) type = 'artilleur';
      else if (r > 0.65) type = 'costaud';
      else if (r > 0.42) type = 'eclaireur';
      let count = Math.round((5 + Math.random() * 13) * mult);
      if (type === 'heros') count = Math.max(1, Math.round(count / 8));
      if (type === 'costaud') count = Math.max(1, Math.round(count / 2));
      node.g[type] = (node.g[type] || 0) + count;
      node.bump = 1;
      puff(node.x, node.y, FACTION_COL[f], 8, 42, 2.4);
      const names = BGD.ALLY_NAMES[f];
      const name = names[(Math.random() * names.length) | 0];
      emit({ type: 'allyDeposit', name, faction: f, unitType: type, count });
      // (le champ historique s'appelle "type" dans le contrat d'événement,
      //  mais 'type' est déjà pris par le nom d'événement → on fournit les 2)
    }

    // ---- production -------------------------------------------------
    function updateProduction(n, dt) {
      if (!n.owner || !n.prodRate) { n.prodAcc = 0; return; }
      // §boss corbeau (blockprod) : la file de prod est GELÉE — on garde l'acc en l'état
      if (n.prodBlockT > 0) { n.fxPulse = Math.max(n.fxPulse || 0, 0.2); return; }
      if (nodeGTot(n) >= n.cap) { n.prodAcc = Math.min(n.prodAcc, 0.98); return; }
      // §7 : aura logistique du porteur — +20 % tant qu'il traîne dans le coin
      const logi = n.logiT > 0 ? 1.2 : 1;
      n.prodAcc += n.prodRate * dt * (1 + bfBonus(n.owner, 'production')) * logi; // MAJ §3 : par camp
      while (n.prodAcc >= 1) {
        n.prodAcc -= 1;
        if (nodeGTot(n) < n.cap) {
          n.g[n.prodType] = (n.g[n.prodType] || 0) + 1;
          n.bump = Math.max(n.bump, 0.35);
          if (n.kind === 'production') n.fxPulse = Math.max(n.fxPulse, 0.5);
        }
      }
    }


    // ---- victoire / défaite ------------------------------------------
    let victoryT = 0;
    function checkEnd() {
      if (ended) return;
      if (mode !== 'personal') return;
      const enemyAlive = ns.some(n => n.owner === ef) || agents.some(a => a.f === ef && !a.dead);
      const playerAlive = ns.some(n => n.owner === pf) || agents.some(a => a.f === pf && !a.dead);
      if (!enemyAlive) {
        ended = true;
        sfx('win');
        emit({ type: 'victory' });
      } else if (!playerAlive) {
        ended = true;
        sfx('lose');
        emit({ type: 'defeat' });
      }
    }

    // ---- update principal ---------------------------------------------
    function update(dt) {
      if (destroyed || !dt || dt <= 0) return;
      dt = Math.min(dt, 0.1);
      simT += dt;

      if (!ended) {
        for (const n of ns) {
          updateProduction(n, dt);
          processQueue(n, dt);
        }
      }

      rebuildGrid();

      // traînées : elles ne touchent que l’ennemi qui y entre.
      for (let i = zones.length - 1; i >= 0; i--) {
        const z = zones[i]; z.life -= dt;
        if (z.life <= 0) { zones.splice(i, 1); continue; }
        eachNear(z.x, z.y, z.r, o => { if (!o.dead && o.f !== z.f && bdist(z.x, z.y, o.x, o.y) < z.r) hurtAgent(o, z.dmg * dt, z.f, z.x, z.y); });
      }
      // flaques de glu (potions) : la glu sèche, contrairement aux rancunes
      for (let i = slowPools.length - 1; i >= 0; i--) {
        slowPools[i].life -= dt;
        if (slowPools[i].life <= 0) slowPools.splice(i, 1);
      }
      // MAJ §7 : décrue du sort « piquants » par camp
      for (const f of ['cats', 'birds']) if (spikeAuraT[f] > 0) spikeAuraT[f] = Math.max(0, spikeAuraT[f] - dt);
      // totems de soin : tic de soin périodique, puis retour au silence minéral
      for (let i = totems.length - 1; i >= 0; i--) {
        const tm = totems[i]; tm.life -= dt;
        if (tm.life <= 0) { puff(tm.x, tm.y, '#8fd0a0', 6, 30, 2); totems.splice(i, 1); continue; }
        tm.tick -= dt;
        if (tm.tick <= 0) {
          tm.tick = 0.5;
          // MAJ §7 : les totems ont désormais des GENRES — soin (défaut),
          // rage (buff des alliés) et appât (attire et étourdit les ennemis).
          if (tm.kind === 'rage') {
            eachNear(tm.x, tm.y, tm.r, o => {
              if (!o.dead && o.f === tm.f) { o.potBuffT = Math.max(o.potBuffT || 0, 0.7); o.potBuffPow = tm.pow; }
            });
          } else if (tm.kind === 'lure') {
            eachNear(tm.x, tm.y, tm.r, o => {
              if (o.dead || o.f === tm.f) return;
              o.confuseT = Math.max(o.confuseT || 0, 0.7);
              dropFoe(o);
              const d = bdist(o.x, o.y, tm.x, tm.y) || 1;
              o.vx += ((tm.x - o.x) / d) * 26;
              o.vy += ((tm.y - o.y) / d) * 26;
            });
          } else {
            eachNear(tm.x, tm.y, tm.r, o => {
              if (!o.dead && o.f === tm.f && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + tm.pow * 0.5);
            });
          }
        }
      }
      // anneaux d'effet éphémères
      for (let i = fxRings.length - 1; i >= 0; i--) {
        fxRings[i].life -= dt;
        if (fxRings[i].life <= 0) fxRings.splice(i, 1);
      }
      // §D4 : sorts actifs + particules dédiées (+ décrue du shake d'impact)
      updateSpellFx(dt);
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

      if (!ended) {
        for (const a of agents) if (!a.dead) updateAgent(a, dt);
        for (const n of ns) updateNodeCombat(n, dt);
        updateMapBosses(dt); // boss de carte : ils frappent/encaissent tant que ça se bat
      }
      updateProjectiles(dt);

      // nettoyage : un mort rend son verrou 1v1 ET son ticket de siège
      for (let i = agents.length - 1; i >= 0; i--) if (agents[i].dead) {
        dropFoe(agents[i]);
        dropSiege(agents[i]);
        agents[i] = agents[agents.length - 1];
        agents.pop();
      }

      // timers de nœuds
      for (const n of ns) {
        n.hurtT = Math.max(0, n.hurtT - dt);
        n.bump = Math.max(0, n.bump - dt * 2.2);
        n.logiT = Math.max(0, n.logiT - dt); // §7 : l'aura logistique s'estompe si le porteur s'éloigne
        n.prodBlockT = Math.max(0, (n.prodBlockT || 0) - dt); // §boss corbeau : le gel de prod se dissipe
        // §B avant-poste capturé : aura de soin 2 PV/s (rayon 90) pour les alliés
        if (!ended && n.kind === 'avantposte' && n.owner) {
          n.healT = (n.healT || 0) - dt;
          if (n.healT <= 0) {
            n.healT = 0.5; // tick simple : 1 PV toutes les 0.5 s = 2 PV/s
            let healed = false;
            eachNear(n.x, n.y, 90, o => {
              if (!o.dead && o.f === n.owner && o.hp < o.maxHp) {
                o.hp = Math.min(o.maxHp, o.hp + 1);
                healed = true;
              }
            });
            if (healed && particles.length < 300) puff(n.x, n.y - 10, '#8fd0a0', 2, 14, 1.4);
          }
        }
      }

      // victoire aux points de contrôle : majorité de drapeaux = 1 pt/s,
      // premier à ctrlWin. MAJ majeure §1 : la majorité se joue CONTRE l'autre
      // camp, neutres exclus — tenir 1 point contre 0 (et 2 neutres) marque bien.
      if (!ended && ctrlTotal > 0) {
        ctrlAcc += dt;
        while (ctrlAcc >= 1) {
          ctrlAcc -= 1;
          let heldC = 0, heldB = 0;
          for (const cn of ctrlNodes) {
            if (cn.owner === 'cats') heldC++;
            else if (cn.owner === 'birds') heldB++;
          }
          const f = heldC > heldB ? 'cats' : heldB > heldC ? 'birds' : null;
          if (f) {
            // §6 (D15) Drapeaux : ×(1+eff) pour le camp du joueur UNIQUEMENT
            ctrlFrac[f] += (f === pf ? flagMul : flagMulE);
            while (ctrlFrac[f] >= 1) {
              ctrlFrac[f] -= 1;
              ctrlPts[f]++;
              emit({ type: 'controlTick', cats: ctrlPts.cats, birds: ctrlPts.birds });
              if (ctrlPts[f] >= ctrlWin && mode === 'personal' && !ended) {
                ended = true;
                sfx(f === pf ? 'win' : 'lose');
                emit({ type: f === pf ? 'victory' : 'defeat', reason: 'control' });
                break;
              }
            }
          }
        }
      }

      // IA (+ pilote automatique : en farm, le camp joueur passe sous IA)
      if (!ended) {
        const pilots = (autoPilot && aiFactions.indexOf(pf) < 0) ? aiFactions.concat([pf]) : aiFactions;
        for (const f of pilots) {
          if (aiTimers[f] == null) aiTimers[f] = 0.6;
          aiTimers[f] -= dt;
          if (aiTimers[f] <= 0) {
            aiTimers[f] = 1.5 + Math.random() * 1.5;
            aiTick(f);
          }
        }
      }

      // alliés simulés
      if (cfg.allySim && !ended) {
        for (const f of ['cats', 'birds']) {
          allyTimers[f] -= dt;
          if (allyTimers[f] <= 0) {
            allyTimers[f] = 25 + Math.random() * 45;
            allyDeposit(f);
          }
        }
      }

      // MAJ §4 : renforts IA par intervalles (mode personal) — l'ennemi ne reçoit
      // plus toute son armée d'un coup ; des vagues arrivent à son QG, ce qui
      // pousse aussi le joueur à jouer avec ses propres renforts.
      if (!ended && eReinf && eReinfLeft > 0) {
        eReinfT -= dt;
        if (eReinfT <= 0) {
          eReinfT = eReinf.interval;
          eReinfLeft--;
          let node = null;
          for (const n of ns) if (n.owner === ef && n.kind === 'hq') { node = n; break; }
          if (!node) { // QG tombé : la vague arrive au nœud le plus garni
            let bg = -1;
            for (const n of ns) if (n.owner === ef && nodeGTot(n) > bg) { bg = nodeGTot(n); node = n; }
          }
          if (node) {
            let left = Math.max(1, eReinf.size | 0);
            const count = left;
            while (left > 0) {
              const t = eReinfTypes[(Math.random() * eReinfTypes.length) | 0];
              const k = Math.min(left, 1 + ((Math.random() * 3) | 0));
              node.g[t] = (node.g[t] || 0) + k;
              left -= k;
            }
            node.bump = 1;
            puff(node.x, node.y, FACTION_COL[ef], 10, 46, 2.6);
            emit({ type: 'enemyReinforce', count, wavesLeft: eReinfLeft });
          }
        }
      }

      // particules / textes
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(0.1, dt); p.vy = p.vy * Math.pow(0.1, dt) - 20 * dt;
      }
      for (let i = dmgTexts.length - 1; i >= 0; i--) {
        const d = dmgTexts[i];
        d.life -= dt; d.y -= 22 * dt;
        if (d.life <= 0) dmgTexts.splice(i, 1);
      }
      // §B5 : âmes — montée (~28 px) + ondulation + fondu sur 1 s, puis extinction
      for (let i = 0; i < souls.length; i++) {
        const s = souls[i];
        if (s.dead) continue;
        s.t += dt;
        if (s.t >= s.dur) { s.dead = true; continue; }
        const k = s.t / s.dur;
        s.y = s.y0 - k * 28;
        s.x = s.x0 + Math.sin(s.phase + k * Math.PI * 3) * 5;
      }

      victoryT -= dt;
      if (victoryT <= 0) { victoryT = 0.5; checkEnd(); }
    }

    // ---- pointeur -------------------------------------------------------
    let pDown = false, pDrag = false, dragFrom = -1;
    let pX = 0, pY = 0, downX = 0, downY = 0;
    function nodeAt(wx, wy) {
      let best = null, bd = 30 * COMBAT_SCALE;
      for (const n of ns) {
        const d = bdist(wx, wy, n.x, n.y);
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    }
    function pointerDown(cssX, cssY) {
      if (destroyed) return;
      const w = toWorld(cssX, cssY);
      pX = w.x; pY = w.y; downX = w.x; downY = w.y;
      pDown = true; pDrag = false;
      const n = nodeAt(w.x, w.y);
      if (mode === 'personal') {
        if (n && n.owner === pf) { dragFrom = n.id; }
        else dragFrom = -1;
      }
    }
    function pointerMove(cssX, cssY) {
      if (destroyed) return;
      const w = toWorld(cssX, cssY);
      pX = w.x; pY = w.y;
      const hov = nodeAt(w.x, w.y);
      hoverId = hov ? hov.id : -1; // tooltip au survol (NODE_INFO)
      if (pDown && !pDrag && bdist(w.x, w.y, downX, downY) > 10 / view.s) pDrag = true;
    }
    function pointerUp(cssX, cssY) {
      if (destroyed) return;
      const w = toWorld(cssX, cssY);
      pX = w.x; pY = w.y;
      const wasDrag = pDrag, from = dragFrom;
      pDown = false; pDrag = false; dragFrom = -1;
      const n = nodeAt(w.x, w.y);

      if (mode === 'collective') {
        // pas d'envoi manuel : on signale juste la sélection à l'UI
        selectedId = n ? n.id : -1;
        emit({ type: 'nodeSelected', node: n || null });
        if (n) sfx('click', 120);
        return;
      }

      // ---- mode personal ----
      if (wasDrag && from >= 0) {
        const src = nById[from];
        if (n && n !== src && src.owner === pf) {
          sendUnits(src, n, sendRatio);
          selectedId = src.id;
        }
        emit({ type: 'nodeSelected', node: nById[selectedId] || null });
        return;
      }
      // clic simple
      if (!n) {
        if (selectedId >= 0) { selectedId = -1; emit({ type: 'nodeSelected', node: null }); }
        return;
      }
      if (n.owner === pf) {
        // clic nœud ami = sélection (le renfort ami se fait par drag)
        selectedId = n.id;
        sfx('click', 120);
        emit({ type: 'nodeSelected', node: n });
      } else if (selectedId >= 0) {
        // garde-fou : si le nœud sélectionné a changé de main entre-temps,
        // on ne commande PAS la garnison d'en face. Question de principe.
        const src = nById[selectedId];
        if (src && src.owner === pf) sendUnits(src, n, sendRatio);
        else { selectedId = -1; emit({ type: 'nodeSelected', node: null }); }
      }
    }

    // ---- rendu -----------------------------------------------------------
    function drawNode(n, t) {
      const col = n.owner ? FACTION_COL[n.owner] : NEUTRAL_COL;
      // halo faction
      const haloR = 38 * COMBAT_SCALE;
      const halo = ctx.createRadialGradient(n.x, n.y + 4, 4, n.x, n.y + 4, haloR);
      const hurt = n.hurtT > 0;
      halo.addColorStop(0, hurt ? 'rgba(230,60,50,0.4)' : hexA(col, n.owner ? 0.30 : 0.14));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(n.x, n.y + 4, haloR, 0, Math.PI * 2); ctx.fill();

      const bump = n.bump > 0 ? 1 + Math.sin(n.bump * Math.PI) * 0.09 : 1;
      const shake = hurt ? Math.sin(t * 55) * 1.4 : 0;
      const s = 0.62 * COMBAT_SCALE * bump;
      ctx.save();
      ctx.translate(n.x + shake, n.y);
      ctx.scale(s, s);
      ctx.translate(-56, -60);
      // §skins : skin lab dessiné EN DIRECT (boucle d'anim 3.2 s, déphasée par
      // nœud pour éviter l'effet chorale) ; sans skin, sprite cuit historique
      // (l'Étendard et l'Avant-poste passent par leur helper dédié)
      const lv = window.LabSkins ? LabSkins.building(n.kind, n.owner) : null;
      let drawn = false;
      if (lv) {
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        try { lv.draw(ctx, t + n.id * 0.53); drawn = true; } catch (e) { drawn = false; }
      }
      if (!drawn) {
        const spr = n.kind === 'banner' ? getBannerSprite(n.owner)
          : n.kind === 'avantposte' ? getOutpostSprite(n.owner)
            : Sprites.getNodeCanvas(n.kind, n.owner, 112);
        ctx.drawImage(spr, 0, 0);
      }
      ctx.restore();
    }

    function drawNodeUI(n) {
      // compteur de garnison : gros chiffre outliné
      const tot = nodeGTot(n);
      ctx.font = '800 ' + Math.round(15 * COMBAT_SCALE) + 'px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const ty = n.y + 34 * COMBAT_SCALE;
      ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(25,25,35,0.85)';
      ctx.strokeText(String(tot), n.x, ty);
      ctx.fillStyle = n.owner ? '#ffffff' : '#e8e8e0';
      ctx.fillText(String(tot), n.x, ty);

      // jauge de production
      if (n.owner && n.prodRate > 0) {
        const bw = 28 * COMBAT_SCALE, bh = 3.5 * COMBAT_SCALE, bx = n.x - bw / 2, by = n.y + 43 * COMBAT_SCALE;
        ctx.fillStyle = 'rgba(20,20,30,0.4)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = FACTION_COL[n.owner];
        ctx.fillRect(bx, by, bw * bclamp(n.prodAcc, 0, 1), bh);
      }
      // file d'envoi : petit indicateur
      if (n.queue.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '700 ' + Math.round(9 * COMBAT_SCALE) + 'px Nunito, system-ui, sans-serif';
        let left = 0; for (const q of n.queue) left += q.left;
        ctx.fillText('▲' + left, n.x + 28 * COMBAT_SCALE, ty);
      }
      // badge de lisibilité : on sait ENFIN qui fait quoi d'un coup d'œil
      const badge = BADGES[n.kind];
      if (badge) {
        ctx.font = Math.round(11 * COMBAT_SCALE) + 'px system-ui, sans-serif';
        ctx.globalAlpha = 0.92;
        ctx.fillText(badge, n.x, n.y - 46 * COMBAT_SCALE);
        ctx.globalAlpha = 1;
      }
    }

    // tooltip au survol (NODE_INFO) : nom + explication, en coordonnées monde
    function drawTooltip() {
      if (hoverId < 0 || pDown) return;
      const hn = nById[hoverId];
      const info = hn && NODE_INFO[hn.kind];
      if (!info) return;
      ctx.font = '600 10px Nunito, system-ui, sans-serif';
      // découpe grossière du tip en lignes de ~34 caractères
      const tip = hn.kind === 'controle'
        ? 'Majorité de drapeaux = 1 pt/s. Premier à ' + ctrlWin + ' pts gagne.'
        : info.tip;
      const words = tip.split(' ');
      const lines = [];
      let cur = '';
      for (const wd of words) {
        if ((cur + ' ' + wd).trim().length > 34) { lines.push(cur.trim()); cur = wd; }
        else cur += ' ' + wd;
      }
      if (cur.trim()) lines.push(cur.trim());
      const title = (BADGES[hn.kind] ? BADGES[hn.kind] + ' ' : '') + info.name;
      let bw = ctx.measureText(title).width + 20;
      for (const ln of lines) bw = Math.max(bw, ctx.measureText(ln).width + 16);
      const bh = 22 + lines.length * 12;
      let bx = bclamp(hn.x + 26, 6, map.w - bw - 6);
      let by = bclamp(hn.y - bh - 24, 6, map.h - bh - 6);
      ctx.fillStyle = 'rgba(22,26,24,0.88)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 6); else ctx.rect(bx, by, bw, bh);
      ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffe9a8';
      ctx.font = '800 11px Nunito, system-ui, sans-serif';
      ctx.fillText(title, bx + 8, by + 14);
      ctx.fillStyle = '#e8e8e0';
      ctx.font = '600 10px Nunito, system-ui, sans-serif';
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], bx + 8, by + 27 + i * 12);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    }

    function hexA(hex, a) {
      const c = hex.replace('#', '');
      const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function drawAgent(a) {
      if (a.polyT > 0) { drawChicken(a); return; } // §D4 poulet : volaille flat
      const sc = a.scale;
      const shadow = getShadow();
      // §7 : halo logistique doux du porteur (rendu sous le sprite)
      if (a.st.ability === 'logistic') {
        const rr = 15 * sc + Math.sin(a.phase * 1.5) * 1.5;
        const hg = ctx.createRadialGradient(a.x, a.y, 2, a.x, a.y, rr * 1.6);
        hg.addColorStop(0, 'rgba(255,210,87,0.22)');
        hg.addColorStop(1, 'rgba(255,210,87,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(a.x, a.y, rr * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.drawImage(shadow, a.x - 22 * sc, a.y - 7 * sc, 44 * sc, 22 * sc);
      // le modèle pseudo-3D est rendu FACE à sa direction de déplacement (yaw),
      // pas de rotation 2D (qui le coucherait).
      const dir = Sprites.dirForAngle ? Sprites.dirForAngle(a.angle) : 0;
      const frames = a.spec ? Sprites.getUnitFrames(Object.assign({ dir }, a.spec)) : a.frames;
      const fi = ((a.phase / (Math.PI * 2)) * 16) | 0;
      const spr = frames[((fi % 16) + 16) % 16];
      const lunge = a.lunge > 0 ? Math.sin((1 - a.lunge / 0.18) * Math.PI) : 0;
      // §7 : espion planqué — silhouette fantomatique tant qu'il n'a pas frappé
      const ghost = a.stealthed ? 0.4 : 1;
      ctx.save();
      if (ghost < 1) ctx.globalAlpha = ghost;
      // §D4 clone : le double d'ombre est rendu assombri (restore rend le filtre)
      if (a.cloneT > 0) { try { ctx.filter = 'brightness(0.45) saturate(0.55)'; } catch (e) { /* vieux canvas */ } }
      // MAJ §7 : spectre — translucide et teinté turquoise (sort « spectres »)
      if (a.spectral) {
        ctx.globalAlpha *= 0.55;
        try { ctx.filter = 'sepia(1) saturate(4) hue-rotate(120deg) brightness(1.2)'; } catch (e) { /* vieux canvas */ }
      }
      ctx.translate(a.x + Math.cos(a.angle) * lunge * 5, a.y + Math.sin(a.angle) * lunge * 5);
      const sq = 1 + lunge * 0.12;
      ctx.scale(sc * 0.5 * sq, sc * 0.5 * (2 - sq));
      ctx.drawImage(spr, -64, -64);
      if (a.flash > 0) {
        ctx.globalAlpha = Math.min(1, a.flash / 0.12) * 0.75;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(spr, -64, -64);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // §D18 gel : teinte bleutée brève sur la cible givrée
      if ((a.gelT || 0) > 0) {
        ctx.globalAlpha = Math.min(1, a.gelT / 0.4) * 0.35;
        ctx.fillStyle = '#9fd8ff';
        ctx.beginPath(); ctx.arc(a.x, a.y - 8 * sc, 12 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // bannière de renfort
      if (a.buffed) {
        ctx.strokeStyle = 'rgba(90,60,30,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x + 7, a.y - 15 * sc - 6); ctx.lineTo(a.x + 7, a.y - 15 * sc + 1); ctx.stroke();
        ctx.fillStyle = FACTION_COL2[a.f];
        ctx.beginPath();
        ctx.moveTo(a.x + 7, a.y - 15 * sc - 6);
        ctx.lineTo(a.x + 12.5, a.y - 15 * sc - 4);
        ctx.lineTo(a.x + 7, a.y - 15 * sc - 2);
        ctx.closePath(); ctx.fill();
      }
      // barre de vie fine, seulement si blessé
      if (a.hp < a.maxHp - 0.5) {
        const pct = bclamp(a.hp / a.maxHp, 0, 1);
        const bw = 13, bx = a.x - bw / 2, by = a.y - 16 * sc - 4;
        ctx.fillStyle = 'rgba(20,20,30,0.55)';
        ctx.fillRect(bx - 0.5, by - 0.5, bw + 1, 3);
        ctx.fillStyle = pct > 0.5 ? '#7ecf6a' : (pct > 0.25 ? '#f2c24e' : '#e05252');
        ctx.fillRect(bx, by, bw * pct, 2);
      }
    }

    function drawProjectile(p) {
      const t = bclamp(p.t, 0, 1);
      const x = p.x0 + (p.x1 - p.x0) * t;
      let y = p.y0 + (p.y1 - p.y0) * t;
      // §5 : couleur par rang (blanc → bleu → rouge → doré → prismatique)
      const pal = p.pal || null;
      const prisma = pal && pal.prismatic ? 'hsl(' + (((p.t * 900) | 0) % 360) + ',90%,72%)' : null;
      if (p.kind === 'lob') {
        const d = bdist(p.x0, p.y0, p.x1, p.y1);
        const hgt = Math.min(70, d * 0.35);
        const yy = y - Math.sin(Math.PI * t) * hgt;
        // ombre au sol
        ctx.fillStyle = 'rgba(20,30,15,0.25)';
        ctx.beginPath(); ctx.ellipse(x, y, 3.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
        if (pal && pal.glow) {
          ctx.globalAlpha = 0.3; ctx.fillStyle = prisma || pal.glow;
          ctx.beginPath(); ctx.arc(x, yy, 5.6, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = pal ? pal.c2 : (p.f === 'cats' ? '#e2a94e' : '#5a7a8e');
        ctx.beginPath(); ctx.arc(x, yy, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pal ? pal.c1 : 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(x - 1, yy - 1, 1.2, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'magic') {
        const pulse = 3.5 + Math.sin(t * 30) * .8;
        ctx.globalAlpha = .25;
        ctx.fillStyle = prisma || (pal && pal.glow) || '#d879ff';
        ctx.beginPath(); ctx.arc(x, y, pulse * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = pal ? pal.c1 : '#f2ccff';
        ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.fill();
      } else {
        const an = Math.atan2(p.y1 - p.y0, p.x1 - p.x0);
        if (pal && pal.glow && p.kind !== 'arrow') {
          ctx.globalAlpha = 0.35; ctx.strokeStyle = prisma || pal.glow; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(an) * 5, y - Math.sin(an) * 5);
          ctx.lineTo(x + Math.cos(an) * 5, y + Math.sin(an) * 5);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // la flèche en cours de MONTÉE EN PUISSANCE (piste ‹ volée ›) part plus
        // fine et plus pâle : on VOIT qu’elle n’est pas encore à pleine charge.
        ctx.strokeStyle = p.kind === 'arrow'
          ? (p.weak ? 'rgba(90,70,40,0.45)' : 'rgba(90,70,40,0.9)')
          : (pal ? pal.c2 : 'rgba(90,70,40,0.9)');
        ctx.lineWidth = p.weak ? 1 : 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(an) * 5, y - Math.sin(an) * 5);
        ctx.lineTo(x + Math.cos(an) * 5, y + Math.sin(an) * 5);
        ctx.stroke();
      }
    }

    function render(time) {
      if (destroyed) return;
      let t = time || 0;
      if (t > 20000) t = t / 1000; // tolère ms ou secondes
      // resize auto si le canvas a changé de taille CSS
      if (canvas.clientWidth !== view.cw || canvas.clientHeight !== view.ch) resize();
      if (view.cw < 8) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#1e2620';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // §D4 : petit shake d'impact (météore, séisme) — jitter du monde, bref
      let shX = 0, shY = 0;
      if (shakeT > 0) {
        const kS = Math.min(1, shakeT * 4) * shakeAmp;
        shX = (Math.random() - 0.5) * 2 * kS;
        shY = (Math.random() - 0.5) * 2 * kS;
      }
      ctx.setTransform(DPR * view.s, 0, 0, DPR * view.s, DPR * (view.ox + shX), DPR * (view.oy + shY));

      // terrain
      ctx.drawImage(terrain, 0, 0, map.w, map.h);

      // §skins : éléments naturels ANIMÉS (mares/rochers/arbres du lab) —
      // au-dessus du terrain cuit, sous les nœuds/unités ; boucle 3.2 s
      // déphasée par seed pour ne pas onduler en chœur
      if (map.dynElems && map.dynElems.length) {
        for (const d of map.dynElems) {
          ctx.save();
          ctx.translate(d.x, d.y);
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          try { d.v.draw(ctx, d.r, d.seed, t + (d.seed % 977) * 0.01); } catch (e) {}
          ctx.restore();
        }
      }

      // §boss golem (rocks) : les roches POSÉES à chaud ne sont pas sur le terrain
      // pré-rendu → on les peint ici (l'évitement, lui, les voit déjà via obstacles).
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (!o.bossRock) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.ellipse(o.x + 3, o.y + 5, o.r, o.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        const rgd = ctx.createLinearGradient(o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r);
        rgd.addColorStop(0, '#a8a49a'); rgd.addColorStop(1, '#6e6a60');
        ctx.fillStyle = rgd;
        ctx.beginPath(); ctx.arc(o.x, o.y - o.r * 0.15, o.r * 0.92, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(o.x - o.r * 0.25, o.y - o.r * 0.4, o.r * 0.32, o.r * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
      }

      // traînées au sol, avant les unités pour une lecture immédiate
      for (const z of zones) {
        ctx.globalAlpha = Math.min(.46, z.life * .22); ctx.fillStyle = z.col;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1.15 - z.life * .05), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // flaques de glu (potions) : nappe miel + contour, lisible et poisseux
      // (§D4 : le blizzard fournit son propre col/col2 — nappe bleutée au sol)
      for (const sp2 of slowPools) {
        ctx.globalAlpha = Math.min(0.38, 0.12 + sp2.life * 0.05);
        ctx.fillStyle = sp2.col || '#e8b93a';
        ctx.beginPath(); ctx.arc(sp2.x, sp2.y, sp2.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = sp2.col2 || '#c89a20'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sp2.x, sp2.y, sp2.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // totems de soin : caillou bienveillant + aura verte qui respire
      for (const tm of totems) {
        ctx.globalAlpha = 0.14 + 0.05 * Math.sin(t * 4);
        ctx.fillStyle = '#7ecf6a';
        ctx.beginPath(); ctx.arc(tm.x, tm.y, tm.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(20,30,15,0.25)';
        ctx.beginPath(); ctx.ellipse(tm.x + 2, tm.y + 8, 8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a8478';
        ctx.fillRect(tm.x - 5, tm.y - 12, 10, 19);
        ctx.fillStyle = '#a8a296';
        ctx.fillRect(tm.x - 6.5, tm.y - 17, 13, 6);
        ctx.fillStyle = '#7ecf6a';
        ctx.beginPath(); ctx.arc(tm.x, tm.y - 4, 2.4 + Math.sin(t * 6) * 0.6, 0, Math.PI * 2); ctx.fill();
      }

      // §D4 : sols de sorts (télégraphe météore, zones pluie/âmes, ronces, halos)
      drawSpellsUnder(t);

      // décor animé très discret : papillons/lucioles
      for (const c of critters) {
        const cx = c.x + Math.sin(t * c.sp + c.p1) * 60;
        const cy = c.y + Math.sin(t * c.sp * 0.7 + c.p2) * 40;
        const flap = Math.sin(t * 14 + c.p1) * 0.5 + 0.6;
        ctx.fillStyle = c.col; ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.ellipse(cx - 1.6 * flap, cy, 1.7 * flap, 1, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 1.6 * flap, cy, 1.7 * flap, 1, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // §B (DESIGN13) : portée des TOURS, dessinée SOUS les unités — cercle pointillé
      // + disque très léger. Rouge pour les tours ENNEMIES, couleur faction pour les
      // alliées. 2-4 cercles par frame : les tours changent de camp, on ne cache rien.
      let dashOn = false;
      for (const n of ns) {
        if (n.kind !== 'defense' || !n.owner) continue;
        if (!dashOn) { ctx.setLineDash([6, 6]); dashOn = true; }
        ctx.lineWidth = 1.5;
        if (n.owner !== pf) {
          ctx.strokeStyle = 'rgba(200,60,40,0.55)';
          ctx.fillStyle = 'rgba(200,60,40,0.05)';
        } else {
          ctx.strokeStyle = hexA(FACTION_COL[n.owner], 0.35);
          ctx.fillStyle = hexA(FACTION_COL[n.owner], 0.03);
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, TOWER_RANGE, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      if (dashOn) ctx.setLineDash([]);

      // halos + sélection sous tout le reste
      const sel = selectedId >= 0 ? nById[selectedId] : null;
      if (sel && sel.owner === pf) {
        const r = 32 + Math.sin(t * 5) * 2.5;
        ctx.strokeStyle = hexA(FACTION_COL[pf], 0.85);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(sel.x, sel.y + 3, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = hexA(FACTION_COL[pf], 0.3);
        ctx.beginPath(); ctx.arc(sel.x, sel.y + 3, r + 4, 0, Math.PI * 2); ctx.stroke();
      }

      // nœuds + agents triés par y (lisibilité des chevauchements)
      const drawables = [];
      for (const n of ns) drawables.push(n);
      for (const a of agents) if (!a.dead) drawables.push(a);
      for (const B of mapBosses) if (!B.dead) drawables.push(B); // boss de carte, triés par y
      drawables.sort((A, B) => A.y - B.y);
      for (const d of drawables) {
        if (d.mapBoss) drawMapBoss(d, t);
        else if (d.kind) drawNode(d, t);
        else if (d.wild) drawWildMinion(d, t);
        else drawAgent(d);
      }

      // projectiles au-dessus
      for (const p of projectiles) drawProjectile(p);

      // rayons de boss (laser) : au-dessus des unités, brefs et nets
      for (const bm of bossBeams) {
        ctx.globalAlpha = bclamp(bm.life / bm.tot, 0, 1);
        ctx.strokeStyle = bm.col; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bm.x0, bm.y0); ctx.lineTo(bm.x1, bm.y1); ctx.stroke();
        ctx.globalAlpha *= 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bm.x0, bm.y0); ctx.lineTo(bm.x1, bm.y1); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // anneaux d'effet (impact de potion) : ça s'étend, ça s'efface, ça suffit
      for (const rg2 of fxRings) {
        const k = 1 - bclamp(rg2.life / rg2.tot, 0, 1);
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.strokeStyle = rg2.col; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(rg2.x, rg2.y, 10 + (rg2.r - 10) * k, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // particules
      for (const p of particles) {
        ctx.globalAlpha = bclamp(p.life / p.tot, 0, 1) * 0.9;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // §D4 : particules de sorts + voile sépia du sablier
      drawSpellsOver(t);

      // §B5 : âmes qui s'élèvent (au-dessus des unités, sous l'UI). Sprite de V si
      // dispo, sinon repli blob turquoise translucide — jamais de crash.
      for (let i = 0; i < souls.length; i++) {
        const s = souls[i];
        if (s.dead) continue;
        const k = bclamp(s.t / s.dur, 0, 1);
        ctx.globalAlpha = (1 - k) * 0.8;
        if (s.cv && s.cv.width > 0) {
          ctx.drawImage(s.cv, s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
        } else {
          ctx.fillStyle = '#3fe0d0';
          ctx.beginPath(); ctx.ellipse(s.x, s.y, s.size * 0.32, s.size * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // UI des nœuds (compteurs par-dessus tout, pour la lisibilité)
      for (const n of ns) drawNodeUI(n);
      drawTooltip();

      // §B (DESIGN13) : SCORE DE CONTRÔLE — jauge cats vs birds en haut du canvas,
      // dessin flat (deux barres + chiffres). Visible SEULEMENT si la carte a des
      // nœuds 'controle'. Premier à ctrlWin : la victoire aux points existante.
      if (ctrlTotal > 0) {
        const bw = 120, bh = 7, gap = 30, gy = 12, cx = map.w / 2;
        const kc = bclamp(ctrlPts.cats / ctrlWin, 0, 1);
        const kb = bclamp(ctrlPts.birds / ctrlWin, 0, 1);
        // fonds
        ctx.fillStyle = 'rgba(22,26,24,0.55)';
        ctx.fillRect(cx - gap - bw, gy, bw, bh);
        ctx.fillRect(cx + gap, gy, bw, bh);
        // barres : chats vers la gauche depuis le centre, oiseaux vers la droite
        ctx.fillStyle = FACTION_COL.cats;
        ctx.fillRect(cx - gap - bw * kc, gy, bw * kc, bh);
        ctx.fillStyle = FACTION_COL.birds;
        ctx.fillRect(cx + gap, gy, bw * kb, bh);
        // liserés
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(cx - gap - bw, gy, bw, bh);
        ctx.strokeRect(cx + gap, gy, bw, bh);
        // chiffres + drapeau central
        ctx.font = '800 11px Nunito, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(25,25,35,0.85)';
        const yTxt = gy + bh / 2 + 0.5;
        ctx.strokeText(String(ctrlPts.cats), cx - gap - bw - 14, yTxt);
        ctx.fillStyle = FACTION_COL.cats;
        ctx.fillText(String(ctrlPts.cats), cx - gap - bw - 14, yTxt);
        ctx.strokeText(String(ctrlPts.birds), cx + gap + bw + 14, yTxt);
        ctx.fillStyle = FACTION_COL.birds;
        ctx.fillText(String(ctrlPts.birds), cx + gap + bw + 14, yTxt);
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeText('' + ctrlWin, cx, yTxt);
        ctx.fillText('' + ctrlWin, cx, yTxt);
        ctx.textBaseline = 'middle';
      }

      // mini nombres de dégâts
      ctx.font = '800 10px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const d of dmgTexts) {
        ctx.globalAlpha = bclamp(d.life / 0.6, 0, 1);
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(25,25,35,0.8)';
        ctx.strokeText(d.txt, d.x, d.y);
        ctx.fillStyle = d.col;
        ctx.fillText(d.txt, d.x, d.y);
      }
      ctx.globalAlpha = 1;

      // flèche de visée pendant le drag (personal)
      if (mode === 'personal' && pDown && pDrag && dragFrom >= 0) {
        const src = nById[dragFrom];
        const hov = nodeAt(pX, pY);
        const tx = hov && hov !== src ? hov.x : pX;
        const ty = hov && hov !== src ? hov.y : pY;
        const an = Math.atan2(ty - src.y, tx - src.x);
        const d = bdist(src.x, src.y, tx, ty);
        ctx.strokeStyle = hexA(FACTION_COL[pf], 0.85);
        ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.setLineDash([8, 7]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.moveTo(src.x + Math.cos(an) * 30, src.y + Math.sin(an) * 30);
        ctx.lineTo(tx - Math.cos(an) * 14, ty - Math.sin(an) * 14);
        ctx.stroke();
        ctx.setLineDash([]);
        // pointe
        if (d > 40) {
          ctx.fillStyle = hexA(FACTION_COL[pf], 0.9);
          ctx.save();
          ctx.translate(tx - Math.cos(an) * 8, ty - Math.sin(an) * 8);
          ctx.rotate(an);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-11, -6.5); ctx.lineTo(-11, 6.5); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // anneau sur la cible survolée
        if (hov && hov !== src) {
          ctx.strokeStyle = hexA(hov.owner === pf ? '#7ecf6a' : '#e05252', 0.85);
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(hov.x, hov.y + 3, 34, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // §pixel : filtre pixel-art sur TOUTE la scène de bataille. Les unités sont trop
      // petites pour qu'un baking par sprite se voie ; on pixelise le rendu final à la
      // résolution écran (downscale moyenné → upscale au plus proche = gros pixels nets).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // §pixel : actif dès que le bloc dépasse le pixel physique (sinon c'est un
      // no-op qui coûterait une copie plein-canvas par frame — ancien seuil 1.1 supprimé)
      if (PIXEL_CSS > 0 && PIXEL_CSS * DPR > 1.001) {
        // §pixel : bloc FRACTIONNAIRE — l'arrondi entier gonflait le filtre (1.6×DPR1
        // → 2 blocs, +25 % du réglage voulu) et rendait la constante insensible.
        const pxDev = Math.max(1, PIXEL_CSS * DPR);
        const dw = canvas.width, dh = canvas.height;
        const sw = Math.max(1, Math.round(dw / pxDev)), sh = Math.max(1, Math.round(dh / pxDev));
        if (!pixTmp) pixTmp = document.createElement('canvas');
        pixTmp.width = sw; pixTmp.height = sh;
        const pg = pixTmp.getContext('2d');
        pg.imageSmoothingEnabled = true;
        pg.clearRect(0, 0, sw, sh);
        pg.drawImage(canvas, 0, 0, dw, dh, 0, 0, sw, sh);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, dw, dh);
        ctx.drawImage(pixTmp, 0, 0, sw, sh, 0, 0, dw, dh);
        ctx.imageSmoothingEnabled = true;
      }
    }

    // ---- API publique -----------------------------------------------------
    function getControl() {
      let c = 0, b = 0;
      for (const n of ns) {
        if (n.owner === 'cats') c++;
        else if (n.owner === 'birds') b++;
      }
      const tot = ns.length || 1;
      return { cats: c / tot, birds: b / tot };
    }

    function serialize() {
      return {
        nodes: ns.map(n => ({ id: n.id, owner: n.owner, garrison: Object.assign({}, n.g) })),
        t: Date.now(),
      };
    }

    function deploy(nodeId, type, count) {
      let n = nById[nodeId];
      if (!n || !UNIT_ORDER.includes(type) || !(count > 0)) return false;
      // compo verrouillée (expédition) : le moteur refuse ce que l'UI filtre déjà
      if (composition && composition.indexOf(type) < 0) return false;
      // §B avant-poste : POINT DE DÉPLOIEMENT AVANCÉ — les renforts visant le QG
      // débarquent au dernier avant-poste capturé du camp (le plus proche du front).
      if (mode === 'personal' && n.kind === 'hq' && n.owner) {
        const op = activeOutpost(n.owner);
        if (op) n = op;
      }
      n.g[type] = (n.g[type] || 0) + Math.floor(count);
      n.bump = 1;
      puff(n.x, n.y, FACTION_COL[n.owner || pf], 10, 46, 2.6);
      if (fxVisible()) {
        const p = scr(n.x, n.y);
        try { FX.burst(p.x, p.y, { color: FACTION_COL[pf], n: 10, speed: 3 }); } catch (e) { }
      }
      return true;
    }

    // §9 (DESIGN2) : le lance-potions, enfin sorti du rodage chez l'ingénieur.
    // def = entrée de BGD.POTIONS ; (wx, wy) en coordonnées MONDE (via screenToWorld).
    function castPotion(def, wx, wy) {
      if (destroyed || !def || !def.battle) return false;
      const b = def.battle;
      const r = b.radius || 60;
      wx = bclamp(+wx || 0, 8, map.w - 8);
      wy = bclamp(+wy || 0, 8, map.h - 8);
      let col = '#ffffff';
      if (b.kind === 'aoe') {
        col = '#ff8a5a';
        // dégâts francs dans le rayon — SANS le plafond AOE_MAX, pensé pour les
        // projectiles à la chaîne, pas pour un consommable payé rubis sur l'ongle
        const foes = [];
        eachNear(wx, wy, r, o => { if (!o.dead && o.f !== pf && bdist(o.x, o.y, wx, wy) <= r) foes.push(o); });
        for (const o of foes) hurtAgent(o, b.power, pf, wx, wy);
        // et une claque aux garnisons prises dans le souffle
        for (const n of ns) {
          if (n.owner === pf) continue;
          if (bdist(n.x, n.y, wx, wy) < r + NODE_R * 0.5 && (n.owner !== null || nodeGTot(n) > 0)) {
            damageGarrison(n, b.power * 0.6, pf, null);
          }
        }
        puff(wx, wy, '#ffb34d', 16, 70, 3.2);
        sfx('pop', 80);
      } else if (b.kind === 'heal') {
        col = '#7ecf6a';
        eachNear(wx, wy, r, o => { if (!o.dead && o.f === pf && bdist(o.x, o.y, wx, wy) <= r) o.hp = Math.min(o.maxHp, o.hp + b.power); });
        puff(wx, wy, '#9fe88a', 10, 40, 2.4);
      } else if (b.kind === 'slow') {
        col = '#f2c24e';
        // f = pf : la glu du joueur ne colle QUE les pattes ennemies
        slowPools.push({ x: wx, y: wy, r, pow: b.power, f: pf, life: b.duration || 6 });
        puff(wx, wy, '#f2d24e', 8, 30, 2.2);
      } else if (b.kind === 'buff') {
        col = '#ffd257';
        eachNear(wx, wy, r, o => {
          if (!o.dead && o.f === pf && bdist(o.x, o.y, wx, wy) <= r) { o.potBuffT = b.duration || 10; o.potBuffPow = b.power || 0.4; }
        });
        puff(wx, wy, '#ffe9a8', 10, 44, 2.4);
      } else if (b.kind === 'summon') {
        col = '#c8d8ff';
        const unit = (b.unit && BGD.UNIT_TYPES[b.unit]) ? b.unit : 'lancier';
        const tgtN = nearestNode(wx, wy, n2 => n2.owner !== pf) || nearestNode(wx, wy, null);
        const count = Math.max(1, Math.round(b.power || 1));
        for (let i = 0; i < count; i++) {
          if (agents.length >= AGENT_CAP || !tgtN) break;
          const an = (i / count) * Math.PI * 2 + Math.random() * 0.8;
          const rr = 6 + Math.random() * Math.max(10, r * 0.6);
          const m = spawnAt(wx + Math.cos(an) * rr, wy + Math.sin(an) * rr, pf, unit, tgtN);
          if (b.duration > 0) m.tempLife = b.duration;
        }
        puff(wx, wy, '#ffffff', 12, 48, 2.6);
        sfx('whoosh', 80);
      } else if (b.kind === 'confuse') {
        col = '#c8c8d8';
        eachNear(wx, wy, r, o => {
          if (!o.dead && o.f !== pf && bdist(o.x, o.y, wx, wy) <= r) { o.confuseT = Math.max(o.confuseT || 0, b.duration || 1.5); dropFoe(o); }
        });
        puff(wx, wy, '#e0e0e8', 14, 34, 2.8);
      } else if (b.kind === 'healtotem') {
        col = '#8fd0a0';
        totems.push({ x: wx, y: wy, r, pow: b.power || 10, f: pf, life: b.duration || 8, tick: 0.2 });
        puff(wx, wy, '#8fd0a0', 8, 36, 2.2);
      } else if (b.kind === 'freeze') {
        // MAJ §7 : la Bombe gelante MARCHE enfin — gel net + petite morsure de froid
        col = '#9fd8ff';
        eachNear(wx, wy, r, o => {
          if (o.dead || o.f === pf || bdist(o.x, o.y, wx, wy) > r) return;
          if (!((o.stunT || 0) > 0)) { o.vx = 0; o.vy = 0; }
          o.stunT = Math.max(o.stunT || 0, b.duration || 2.5);
          o.gelT = Math.max(o.gelT || 0, b.duration || 2.5);
          if (b.power) hurtAgent(o, b.power, pf, wx, wy);
        });
        puff(wx, wy, '#bfe8ff', 14, 44, 2.6);
      } else if (b.kind === 'healzone') {
        // MAJ §7 : brume soignante — zone de soin sans totem (même moteur)
        col = '#a8e8c8';
        totems.push({ x: wx, y: wy, r, pow: b.power || 8, f: pf, life: b.duration || 8, tick: 0.2, kind: 'heal' });
        puff(wx, wy, '#c8f0d8', 10, 40, 2.4);
      } else if (b.kind === 'ragetotem') {
        // MAJ §7 : totem de rage — buff continu des alliés dans le rayon
        col = '#ff9a7a';
        totems.push({ x: wx, y: wy, r, pow: b.power || 0.35, f: pf, life: b.duration || 8, tick: 0.2, kind: 'rage' });
        puff(wx, wy, '#ffb49a', 10, 40, 2.4);
      } else if (b.kind === 'lure') {
        // MAJ §7 : appât — attire et fait tituber les ennemis vers le point
        col = '#ffd9a0';
        totems.push({ x: wx, y: wy, r: r * 1.4, pow: 0, f: pf, life: b.duration || 6, tick: 0.2, kind: 'lure' });
        puff(wx, wy, '#ffe0b0', 10, 44, 2.4);
      } else {
        return false;
      }
      fxRings.push({ x: wx, y: wy, r, life: 0.5, tot: 0.5, col });
      if (fxVisible()) {
        const p = scr(wx, wy);
        try { FX.ring(p.x, p.y, col); } catch (e) { /* fx optionnels */ }
      }
      sfx('deploy', 60);
      return true;
    }

    // ============================================================
    // §D13-D4 : SORTS — castSpell(id, lvl, wx, wy), les 12 sorts du Grimoire.
    // Réutilise les systèmes existants (AoE, slowPools, zones, stun, soins,
    // spawnAt, puff/ring, bossBeams pour les éclairs) + un pool BORNÉ de
    // particules dédiées (SP_CAP, dessiné dans la passe fx). RUNTIME PUR.
    // ============================================================
    function spellPart(p) {
      if (spParts.length >= SP_CAP) return null;
      p.tot = p.life = p.life || 0.6;
      p.sw = Math.random() * Math.PI * 2;
      spParts.push(p);
      return p;
    }
    function spellFeathers(x, y, n) {
      for (let i = 0; i < n; i++) {
        spellPart({
          kind: 'feather', x: x + (Math.random() - 0.5) * 14, y: y - 4 - Math.random() * 10,
          life: 0.7 + Math.random() * 0.5, size: 2 + Math.random() * 1.6,
          col: Math.random() < 0.8 ? '#f6f2e8' : '#e05252',
        });
      }
    }
    // l'ennemi (du joueur) le plus proche d'un point, hors liste déjà touchée
    function nearestFoeAgent(x, y, r, skip) {
      let best = null, bd = r + 1;
      eachNear(x, y, r, (o) => {
        if (o.dead || o.f === pf || (skip && skip.indexOf(o) >= 0)) return;
        const d = bdist(o.x, o.y, x, y);
        if (d < bd) { bd = d; best = o; }
      });
      return best;
    }
    // §D4-7 poulet : sauvegarde type/stats puis stats inoffensives, PV conservés
    function polymorphAgent(a, dur) {
      a.polySave = { st: a.st, dmg: a.dmg };
      a.st = Object.assign({}, a.st, { dmg: 0, mspd: 16, range: 0, ability: null });
      a.dmg = 0;
      a.polyT = dur;
      dropFoe(a); dropSiege(a);
      spellFeathers(a.x, a.y, 10); // nuage de plumes à la transformation
    }
    // §D4-10 ames : une mort ennemie dans une zone de Moisson soigne les alliés
    // proches du mort (30% de ses PV max, répartis) — orbes turquoise à l'appui.
    function spellDeathHook(a) {
      if (a.f === pf) return;
      for (const e of spellFx) {
        if (e.kind !== 'ames') continue;
        if (bdist(a.x, a.y, e.x, e.y) > e.r) continue;
        const allies = [];
        eachNear(a.x, a.y, 110, (o) => { if (!o.dead && o.f === pf && o.hp < o.maxHp) allies.push(o); });
        if (!allies.length) break;
        const each = (a.maxHp * 0.3) / allies.length;
        for (const al of allies) {
          al.hp = Math.min(al.maxHp, al.hp + each);
          spellPart({ kind: 'orb', x: a.x, y: a.y, tgt: al, life: 0.8, size: 2.6, col: '#3fe0d0' });
        }
        break; // une seule moisson par mort, même si les zones se chevauchent
      }
    }
    // §D4-1 météore : l'impact, une fois l'ombre au sol arrivée à maturité
    function meteorImpact(e) {
      const s = e.stats;
      const foes = [];
      eachNear(e.x, e.y, s.radius, (o) => {
        if (!o.dead && o.f !== pf && bdist(o.x, o.y, e.x, e.y) <= s.radius) foes.push(o);
      });
      for (const o of foes) hurtAgent(o, s.power, pf, e.x, e.y);
      for (const n of ns) {
        if (n.owner === pf) continue;
        if (bdist(n.x, n.y, e.x, e.y) < s.radius + NODE_R * 0.5 && (n.owner !== null || nodeGTot(n) > 0)) {
          damageGarrison(n, s.power * 0.5, pf, null);
        }
      }
      fxRings.push({ x: e.x, y: e.y, r: s.radius, life: 0.5, tot: 0.5, col: '#ff8a3a' });
      fxRings.push({ x: e.x, y: e.y, r: s.radius * 1.5, life: 0.7, tot: 0.7, col: '#ffd257' });
      puff(e.x, e.y, '#ffb34d', 16, 80, 3.2);
      puff(e.x, e.y, '#ff6a2a', 10, 50, 2.6);
      for (let i = 0; i < 18; i++) { // braises qui retombent (gravité)
        const an = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 90;
        spellPart({
          kind: 'ember', x: e.x, y: e.y - 4, vx: Math.cos(an) * sp, vy: -40 - Math.random() * 90,
          life: 0.6 + Math.random() * 0.5, size: 1.6 + Math.random() * 1.6,
          col: Math.random() < 0.5 ? '#ff8a3a' : '#ffd257',
        });
      }
      shakeT = 0.35; shakeAmp = 3;
      sfx('pop', 60);
    }

    // tick des sorts actifs + des particules dédiées (appelé par update)
    function updateSpellFx(dt) {
      // particules d'abord : elles survivent à la fin de leur effet
      for (let i = spParts.length - 1; i >= 0; i--) {
        const p = spParts[i];
        p.life -= dt;
        if (p.life <= 0 || (p.kind === 'orb' && (!p.tgt || p.tgt.dead))) {
          spParts[i] = spParts[spParts.length - 1]; spParts.pop(); continue;
        }
        switch (p.kind) {
          case 'flake': p.y += 26 * dt; p.x += Math.sin(p.life * 5 + p.sw) * 14 * dt; break;
          case 'feather': p.y += 24 * dt; p.x += Math.sin(p.life * 6 + p.sw) * 22 * dt; break;
          case 'ember': case 'sprout': case 'grain':
            p.vy = (p.vy || 0) + (p.kind === 'grain' ? 150 : 260) * dt;
            p.x += (p.vx || 0) * dt; p.y += p.vy * dt; break;
          case 'ghost': p.ang += (p.spin || 3.5) * dt; p.rad = Math.max(3, p.rad - p.rad * 2.4 * dt); break;
          case 'drop': p.y += 130 * dt; if (p.y1 != null && p.y >= p.y1) p.life = 0; break;
          case 'orb': {
            const d = bdist(p.x, p.y, p.tgt.x, p.tgt.y) || 1;
            if (d < 7) { p.life = 0; break; }
            p.x += ((p.tgt.x - p.x) / d) * 250 * dt;
            p.y += ((p.tgt.y - p.y) / d) * 250 * dt;
            break;
          }
          case 'note': p.y -= 26 * dt; p.x += Math.sin(p.life * 5 + p.sw) * 12 * dt; break;
          default: p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
        }
      }
      if (!spellFx.length) return;
      for (let i = spellFx.length - 1; i >= 0; i--) {
        const e = spellFx[i];
        e.t += dt;
        const left = e.dur - e.t;
        switch (e.kind) {
          case 'meteore':
            if (e.t >= e.dur && !e.hit) { e.hit = true; meteorImpact(e); }
            break;
          case 'blizzard': { // flocons en continu dans la zone
            e.acc = (e.acc || 0) + dt * 16;
            while (e.acc >= 1) {
              e.acc -= 1;
              const an = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * e.r;
              spellPart({
                kind: 'flake', x: e.x + Math.cos(an) * rr, y: e.y + Math.sin(an) * rr - 16,
                life: 0.8 + Math.random() * 0.5, size: 1.4 + Math.random() * 1.2, col: '#eaf6ff',
              });
            }
            break;
          }
          case 'brouillard': { // MAJ §7 : nappe grise — les TIREURS ennemis y perdent le nord
            e.acc = (e.acc || 0) + dt * 9;
            while (e.acc >= 1) {
              e.acc -= 1;
              const an = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * e.r;
              spellPart({
                kind: 'ghost', x: e.x + Math.cos(an) * rr, y: e.y + Math.sin(an) * rr,
                ang: Math.random() * Math.PI * 2, rad: 9 + Math.random() * 8, spin: 1.5,
                life: 0.9 + Math.random() * 0.6, size: 5 + Math.random() * 5, col: 'rgba(200,206,216,0.5)',
              });
            }
            e.tick = (e.tick || 0) - dt;
            if (e.tick <= 0) {
              e.tick = 0.35;
              eachNear(e.x, e.y, e.r, o => {
                if (o.dead || o.f === pf) return;
                if (o.st && o.st.range > 0 && bdist(o.x, o.y, e.x, e.y) <= e.r) {
                  o.confuseT = Math.max(o.confuseT || 0, 0.55);
                  dropFoe(o);
                }
              });
            }
            break;
          }
          case 'epines': { // dégâts de contact légers + pousses vertes
            e.tick = (e.tick || 0) - dt;
            if (e.tick <= 0) {
              e.tick = 0.3;
              for (const o of e.obs) {
                eachNear(o.x, o.y, o.r + 8, (v) => {
                  if (v.dead || v.f === pf) return;
                  if (bdist(v.x, v.y, o.x, o.y) <= o.r + 8) hurtAgent(v, e.pow * 0.3, pf, o.x, o.y);
                });
              }
              const o2 = e.obs[(Math.random() * e.obs.length) | 0];
              if (o2) spellPart({
                kind: 'sprout', x: o2.x + (Math.random() - 0.5) * o2.r * 1.4, y: o2.y,
                vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 50, life: 0.5, size: 1.8, col: '#6fae4a',
              });
            }
            if (e.t >= e.dur && e.obs.length) {
              // le mur se fane : on retire les obstacles TEMPORAIRES posés au cast
              for (const o of e.obs) {
                const ix = obstacles.indexOf(o);
                if (ix >= 0) obstacles.splice(ix, 1);
                puff(o.x, o.y, '#6fae4a', 4, 26, 1.8);
              }
              e.obs.length = 0;
              obsVer++; // §OBST : invalide les champs de flux mémoïsés
            }
            break;
          }
          case 'poigne': { // aspiration : vélocité ADDITIVE vers le point
            const k = (e.pow || 60) * 6 * dt;
            eachNear(e.x, e.y, e.r, (o) => {
              if (o.dead || o.f === pf) return;
              const d = bdist(o.x, o.y, e.x, e.y);
              if (d > e.r || d < 8) return;
              o.vx += ((e.x - o.x) / d) * k;
              o.vy += ((e.y - o.y) / d) * k;
            });
            e.acc = (e.acc || 0) + dt * 24;
            while (e.acc >= 1) {
              e.acc -= 1;
              spellPart({
                kind: 'ghost', cx: e.x, cy: e.y, ang: Math.random() * Math.PI * 2,
                rad: e.r * (0.6 + Math.random() * 0.4), spin: 3 + Math.random() * 2,
                x: e.x, y: e.y, life: 0.5, col: '#b48cff',
              });
            }
            break;
          }
          case 'pluie': { // soin de zone sur la durée + gouttes + éclats verts
            e.tick = (e.tick || 0) - dt;
            if (e.tick <= 0) {
              e.tick = 0.5;
              eachNear(e.x, e.y, e.r, (o) => {
                if (o.dead || o.f !== pf || o.hp >= o.maxHp) return;
                if (bdist(o.x, o.y, e.x, e.y) > e.r) return;
                o.hp = Math.min(o.maxHp, o.hp + e.pow * 0.5);
                spellPart({ kind: 'cross', x: o.x + (Math.random() - 0.5) * 10, y: o.y - 8, life: 0.5, col: '#7ecf6a' });
              });
            }
            e.acc = (e.acc || 0) + dt * 20;
            while (e.acc >= 1) {
              e.acc -= 1;
              const an = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * e.r;
              const gx = e.x + Math.cos(an) * rr, gy = e.y + Math.sin(an) * rr;
              spellPart({ kind: 'drop', x: gx, y: gy - 34 - Math.random() * 20, y1: gy, life: 0.6, size: 1.3, col: '#9fd4f0' });
            }
            break;
          }
          case 'ames': { // le vrai travail est dans spellDeathHook — ici, l'ambiance
            e.acc = (e.acc || 0) + dt * 4;
            while (e.acc >= 1) {
              e.acc -= 1;
              const an = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * e.r;
              spellPart({
                kind: 'mote', x: e.x + Math.cos(an) * rr, y: e.y + Math.sin(an) * rr,
                vx: 0, vy: -14, life: 0.7, size: 1.6, col: '#3fe0d0',
              });
            }
            break;
          }
          case 'sablier': { // les retardataires (spawnés en cours) sont figés aussi
            for (const o of agents) {
              if (o.dead || o.f === pf) continue;
              if (!((o.stunT || 0) > 0)) { o.vx = 0; o.vy = 0; } // gel net à l'entrée
              o.stunned = true;
              if ((o.stunT || 0) < left) o.stunT = left;
            }
            e.acc = (e.acc || 0) + dt * 10;
            while (e.acc >= 1) {
              e.acc -= 1;
              spellPart({
                kind: 'grain', x: e.x + (Math.random() - 0.5) * 6, y: e.y - 36,
                vx: (Math.random() - 0.5) * 14, vy: 20, life: 0.7, size: 1.1, col: '#e8c878',
              });
            }
            break;
          }
          case 'fanfare': { // les recrues fraîches rejoignent la charge en route
            for (const o of agents) {
              if (o.dead || o.f !== pf) continue;
              if ((o.rallyT || 0) < left) o.rallyT = left;
              o.rallyX = e.x; o.rallyY = e.y; o.rallyMul = e.speed || 1.5;
            }
            e.acc = (e.acc || 0) + dt * 5;
            while (e.acc >= 1) {
              e.acc -= 1;
              spellPart({
                kind: 'note', x: e.x + (Math.random() - 0.5) * 26, y: e.y - 10,
                life: 0.9, col: '#ffd257', glyph: Math.random() < 0.5 ? '' : '',
              });
            }
            break;
          }
          case 'glace': { // §D15-13 : GEL au contact (stun réappliqué) + brume froide
            e.tick = (e.tick || 0) - dt;
            if (e.tick <= 0) {
              e.tick = 0.25;
              for (const o of e.obs) {
                eachNear(o.x, o.y, o.r + 8, (v) => {
                  if (v.dead || v.f === pf || v.boss) return;
                  if (bdist(v.x, v.y, o.x, o.y) > o.r + 8) return;
                  if (!((v.stunT || 0) > 0)) { v.vx = 0; v.vy = 0; } // gel net à l'entrée
                  v.stunned = true;
                  v.stunT = Math.max(v.stunT || 0, e.stun || 1);
                  spellPart({ kind: 'flake', x: v.x, y: v.y - 10, life: 0.5, size: 1.4, col: '#eaf6ff' });
                });
              }
              const o2 = e.obs[(Math.random() * e.obs.length) | 0];
              if (o2) spellPart({ // brume qui s'échappe des cristaux
                kind: 'flake', x: o2.x + (Math.random() - 0.5) * o2.r * 1.6, y: o2.y - 4,
                life: 0.8 + Math.random() * 0.4, size: 1.6, col: '#d8f2ff',
              });
            }
            if (e.t >= e.dur && e.obs.length) { // la glace fond : on rend les obstacles temporaires
              for (const o of e.obs) {
                const ix = obstacles.indexOf(o);
                if (ix >= 0) obstacles.splice(ix, 1);
                puff(o.x, o.y, '#bfe4f8', 4, 26, 1.8);
              }
              e.obs.length = 0;
              obsVer++; // §OBST : invalide les champs de flux mémoïsés
            }
            break;
          }
          case 'tornade': { // §D15-14 : errance brownienne + aspiration + éjection
            e.wa += (Math.random() - 0.5) * 9 * dt; // cap qui dérive doucement
            e.x = bclamp(e.x + Math.cos(e.wa) * 26 * dt, 20, map.w - 20);
            e.y = bclamp(e.y + Math.sin(e.wa) * 26 * dt, 20, map.h - 20);
            eachNear(e.x, e.y, e.r, (o) => {
              if (o.dead || o.f === pf || o.boss) return;
              const d = bdist(o.x, o.y, e.x, e.y);
              if (d > e.r) return;
              if (d > 18) { // aspiration vers l'œil
                const k = 240 * dt;
                o.vx += ((e.x - o.x) / d) * k;
                o.vy += ((e.y - o.y) / d) * k;
              } else { // ÉJECTION radiale aléatoire (push..2×push px) + petit dégât
                const an = Math.random() * Math.PI * 2, push = e.push + Math.random() * e.push;
                o.x = bclamp(o.x + Math.cos(an) * push, 8, map.w - 8);
                o.y = bclamp(o.y + Math.sin(an) * push, 8, map.h - 8);
                o.vx = Math.cos(an) * 120; o.vy = Math.sin(an) * 120;
                hurtAgent(o, e.pow, pf, e.x, e.y);
              }
            });
            e.acc = (e.acc || 0) + dt * 14; // débris qui tournoient
            while (e.acc >= 1) {
              e.acc -= 1;
              spellPart({
                kind: 'ghost', cx: e.x, cy: e.y, ang: Math.random() * Math.PI * 2,
                rad: e.r * (0.4 + Math.random() * 0.6), spin: 5 + Math.random() * 3,
                x: e.x, y: e.y, life: 0.5, col: '#c9b89a',
              });
            }
            break;
          }
          case 'racines': { // §D15-15 : on cloue tout ce qui traîne dans la zone
            eachNear(e.x, e.y, e.r, (o) => {
              if (o.dead || o.f === pf || o.boss) return;
              if (bdist(o.x, o.y, e.x, e.y) > e.r) return;
              if ((o.rootT || 0) < left) o.rootT = left;
            });
            e.acc = (e.acc || 0) + dt * 8; // lianes qui s'enroulent
            while (e.acc >= 1) {
              e.acc -= 1;
              const an = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * e.r;
              spellPart({
                kind: 'sprout', x: e.x + Math.cos(an) * rr, y: e.y + Math.sin(an) * rr,
                vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 40,
                life: 0.5, size: 1.6, col: '#4a8a3e',
              });
            }
            break;
          }
          case 'mines': { // §D15-16 : contact ennemi → boum AoE 40 px, sinon désarmement
            for (let m = e.mines.length - 1; m >= 0; m--) {
              const mn = e.mines[m];
              let boom = false;
              eachNear(mn.x, mn.y, 14, (o) => {
                if (boom || o.dead || o.f === pf) return;
                if (bdist(o.x, o.y, mn.x, mn.y) <= 14) boom = true;
              });
              if (boom) {
                aoeDamage(mn.x, mn.y, 40, e.pow, pf, mn.x, mn.y);
                fxRings.push({ x: mn.x, y: mn.y, r: 40, life: 0.4, tot: 0.4, col: '#ff8a3a' });
                puff(mn.x, mn.y, '#ffb34d', 8, 50, 2.4);
                puff(mn.x, mn.y, '#5a5048', 5, 30, 2.2);
                sfx('pop', 120);
                e.mines.splice(m, 1);
              }
            }
            if (e.t >= e.dur && e.mines.length) { // non déclenchées : petite fumée d'adieu
              for (const mn of e.mines) puff(mn.x, mn.y, '#b0a898', 4, 22, 1.8);
              e.mines.length = 0;
            }
            if (!e.mines.length) e.t = e.dur; // plus une charge → l'effet se retire
            break;
          }
          case 'rayon': { // §D15-18 : dégâts continus le long du segment + étincelles
            const dxR = e.x1 - e.x, dyR = e.y1 - e.y;
            const L2 = dxR * dxR + dyR * dyR || 1;
            const midX = (e.x + e.x1) / 2, midY = (e.y + e.y1) / 2;
            eachNear(midX, midY, Math.sqrt(L2) / 2 + 30, (o) => {
              if (o.dead || o.f === pf) return;
              const tt = bclamp(((o.x - e.x) * dxR + (o.y - e.y) * dyR) / L2, 0, 1);
              const hx2 = e.x + dxR * tt, hy2 = e.y + dyR * tt;
              if (bdist(o.x, o.y, hx2, hy2) > 13) return;
              hurtAgent(o, e.pow * dt, pf, hx2, hy2);
              e.spark = (e.spark || 0) + dt * 8; // étincelles aux impacts (throttlées)
              if (e.spark >= 1) {
                e.spark -= 1;
                spellPart({
                  kind: 'ember', x: hx2, y: hy2, vx: (Math.random() - 0.5) * 60,
                  vy: -30 - Math.random() * 40, life: 0.4, size: 1.4, col: '#ffe14d',
                });
              }
            });
            break;
          }
          case 'malediction': { // §D15-19 : la zone marque les ennemis (curseT/curseMult)
            e.tick = (e.tick || 0) - dt;
            if (e.tick <= 0) {
              e.tick = 0.25;
              eachNear(e.x, e.y, e.r, (o) => {
                if (o.dead || o.f === pf) return;
                if (bdist(o.x, o.y, e.x, e.y) > e.r) return;
                o.curseT = Math.max(o.curseT || 0, Math.min(1.2, left + 0.2)); // colle un peu après la sortie
                o.curseMult = e.mult;
              });
            }
            e.acc = (e.acc || 0) + dt * 6; // volutes violettes
            while (e.acc >= 1) {
              e.acc -= 1;
              const an = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * e.r;
              spellPart({
                kind: 'mote', x: e.x + Math.cos(an) * rr, y: e.y + Math.sin(an) * rr,
                vx: 0, vy: -16, life: 0.8, size: 1.6, col: '#b06ae0',
              });
            }
            break;
          }
          case 'aigle': { // §D15-20 : le rapace file, frappe chacun UNE fois (~50 px de large)
            e.x += e.vx * dt; e.y += e.vy * dt;
            eachNear(e.x, e.y, e.w + 4, (o) => {
              if (o.dead || o.f === pf || e.hit.indexOf(o) >= 0) return;
              if (bdist(o.x, o.y, e.x, e.y) > e.w) return;
              e.hit.push(o);
              hurtAgent(o, e.pow, pf, e.x, e.y);
              spellFeathers(o.x, o.y, 4);
            });
            e.acc = (e.acc || 0) + dt * 20; // traînée de plumes spectrale
            while (e.acc >= 1) {
              e.acc -= 1;
              spellPart({
                kind: 'feather', x: e.x + (Math.random() - 0.5) * 18, y: e.y + (Math.random() - 0.5) * 10,
                life: 0.6, size: 1.8, col: '#cfe8ff',
              });
            }
            break;
          }
        }
        if (e.t >= e.dur) spellFx.splice(i, 1);
      }
    }

    // ---- passe fx SOUS les unités : télégraphes et zones au sol ----
    function drawSpellsUnder(t) {
      if (!spellFx.length) return;
      for (const e of spellFx) {
        if (e.kind === 'meteore') {
          // l'ombre circulaire qui GROSSIT au sol (télégraphe)
          const k = bclamp(e.t / e.dur, 0, 1);
          const rr = Math.max(6, e.stats.radius * (0.25 + 0.75 * k));
          ctx.globalAlpha = 0.2 + 0.18 * k;
          ctx.fillStyle = '#241a10';
          ctx.beginPath(); ctx.ellipse(e.x, e.y, rr, rr * 0.82, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.35 + 0.5 * k;
          ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 40;
          ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        } else if (e.kind === 'pluie') {
          ctx.globalAlpha = 0.10 + 0.03 * Math.sin(t * 4);
          ctx.fillStyle = '#7ecf6a';
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
        } else if (e.kind === 'ames') {
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = '#3fe0d0'; ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 6]); ctx.lineDashOffset = t * 20;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r + Math.sin(t * 3) * 3, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        } else if (e.kind === 'fanfare') {
          const hg = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, 46);
          hg.addColorStop(0, 'rgba(255,210,87,0.30)');
          hg.addColorStop(1, 'rgba(255,210,87,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(e.x, e.y, 46, 0, Math.PI * 2); ctx.fill();
        } else if (e.kind === 'poigne') {
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = '#b48cff'; ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 7]); ctx.lineDashOffset = -t * 60;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.9 - 0.25 * Math.sin(t * 5)), 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        } else if (e.kind === 'epines') {
          // buissons d'épines : pousse à l'arrivée, fanage sur la fin
          const grow = Math.min(1, e.t * 4, Math.max(0.15, (e.dur - e.t) * 2.5));
          for (const o of e.obs) {
            const r = o.r * grow;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#3f6a30';
            ctx.beginPath(); ctx.arc(o.x, o.y + 2, r * 0.9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5a8a3e';
            for (let s2 = 0; s2 < 5; s2++) {
              const an = (s2 / 5) * Math.PI * 2 + o.x * 0.13;
              ctx.beginPath();
              ctx.moveTo(o.x + Math.cos(an) * r * 0.4, o.y + Math.sin(an) * r * 0.4);
              ctx.lineTo(o.x + Math.cos(an + 0.5) * r * 0.5, o.y + Math.sin(an + 0.5) * r * 0.5);
              ctx.lineTo(o.x + Math.cos(an + 0.22) * (r + 5), o.y + Math.sin(an + 0.22) * (r + 5) - 3);
              ctx.closePath(); ctx.fill();
            }
          }
        } else if (e.kind === 'glace') {
          // cristaux bleus : socle gelé + pics de glace + brume froide
          const grow = Math.min(1, e.t * 4, Math.max(0.15, (e.dur - e.t) * 2.5));
          for (const o of e.obs) {
            const r = o.r * grow;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#bfe4f8';
            ctx.beginPath(); ctx.ellipse(o.x, o.y + 2, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#8ec8ee';
            for (let s2 = 0; s2 < 4; s2++) {
              const an = (s2 / 4) * Math.PI * 2 + o.x * 0.17;
              const bx = o.x + Math.cos(an) * r * 0.5, by = o.y + Math.sin(an) * r * 0.3;
              ctx.beginPath();
              ctx.moveTo(bx - 3, by);
              ctx.lineTo(bx, by - r * (0.8 + (s2 % 2) * 0.5));
              ctx.lineTo(bx + 3, by);
              ctx.closePath(); ctx.fill();
            }
            ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 3 + o.x);
            ctx.fillStyle = '#eaf6ff';
            ctx.beginPath(); ctx.arc(o.x, o.y + 3, r * 1.4, 0, Math.PI * 2); ctx.fill();
          }
        } else if (e.kind === 'racines') {
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = '#4a8a3e';
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = '#4a8a3e'; ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 5]); ctx.lineDashOffset = t * 14;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        } else if (e.kind === 'mines') {
          for (const mn of e.mines) {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#5a5048';
            ctx.beginPath(); ctx.ellipse(mn.x, mn.y, 5, 3.6, 0, 0, Math.PI * 2); ctx.fill();
            // clignotement discret du témoin d'armement
            const blink = (Math.sin(t * 6 + mn.x) + 1) / 2;
            ctx.globalAlpha = 0.25 + 0.6 * blink;
            ctx.fillStyle = '#ff5a4a';
            ctx.beginPath(); ctx.arc(mn.x, mn.y - 1.5, 1.3, 0, Math.PI * 2); ctx.fill();
          }
        } else if (e.kind === 'malediction') {
          ctx.globalAlpha = 0.10 + 0.04 * Math.sin(t * 3);
          ctx.fillStyle = '#b06ae0';
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = '#b06ae0'; ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 24;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        } else if (e.kind === 'tornade') {
          ctx.globalAlpha = 0.2; // l'ombre de l'entonnoir au sol
          ctx.fillStyle = '#241a10';
          ctx.beginPath(); ctx.ellipse(e.x, e.y, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // ---- passe fx AU-DESSUS : particules de sorts + voile sépia du sablier ----
    function drawSpellsOver(t) {
      for (const p of spParts) {
        const k = bclamp(p.life / p.tot, 0, 1);
        ctx.globalAlpha = Math.min(1, k * 1.4) * 0.9;
        if (p.kind === 'note') {
          ctx.font = '800 11px Nunito, system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = p.col;
          ctx.fillText(p.glyph || '', p.x, p.y);
        } else if (p.kind === 'cross') {
          ctx.strokeStyle = p.col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x - 3, p.y); ctx.lineTo(p.x + 3, p.y);
          ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x, p.y + 3);
          ctx.stroke();
        } else if (p.kind === 'ghost') {
          const gx = p.cx + Math.cos(p.ang) * p.rad, gy = p.cy + Math.sin(p.ang) * p.rad;
          ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + Math.cos(p.ang + Math.PI / 2) * 7, gy + Math.sin(p.ang + Math.PI / 2) * 7);
          ctx.stroke();
        } else if (p.kind === 'feather') {
          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, (p.size || 2) * 1.5, (p.size || 2) * 0.6, Math.sin(p.life * 4 + p.sw) * 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'orb') {
          ctx.fillStyle = p.col;
          ctx.globalAlpha = Math.min(1, k * 1.4) * 0.35;
          ctx.beginPath(); ctx.arc(p.x, p.y, (p.size || 2.6) * 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = Math.min(1, k * 1.4) * 0.95;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2.6, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'shaft') {
          // §D18 pluie de flèches : trait vertical qui tombe du ciel
          ctx.strokeStyle = p.col; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y); ctx.stroke();
        } else if (p.kind === 'star') {
          // §D15 benediction : étincelle à 4 branches (+ croix diagonale)
          const s3 = (p.size || 2) + 1;
          ctx.strokeStyle = p.col; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x - s3, p.y); ctx.lineTo(p.x + s3, p.y);
          ctx.moveTo(p.x, p.y - s3); ctx.lineTo(p.x, p.y + s3);
          ctx.moveTo(p.x - s3 * 0.55, p.y - s3 * 0.55); ctx.lineTo(p.x + s3 * 0.55, p.y + s3 * 0.55);
          ctx.moveTo(p.x + s3 * 0.55, p.y - s3 * 0.55); ctx.lineTo(p.x - s3 * 0.55, p.y + s3 * 0.55);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // §D4-11 sablier : voile sépia (alpha 0.12) + sablier flottant qui se vide
      for (const e of spellFx) {
        if (e.kind !== 'sablier') continue;
        const fade = bclamp(Math.min(e.t * 6, (e.dur - e.t) * 4), 0, 1);
        ctx.globalAlpha = 0.12 * fade;
        ctx.fillStyle = '#8a6428';
        ctx.fillRect(0, 0, map.w, map.h);
        ctx.globalAlpha = fade;
        const hx = e.x, hy = e.y - 30 + Math.sin(t * 3) * 3;
        ctx.strokeStyle = '#6a5030'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(hx - 7, hy - 10); ctx.lineTo(hx + 7, hy - 10);
        ctx.lineTo(hx - 7, hy + 10); ctx.lineTo(hx + 7, hy + 10);
        ctx.closePath(); ctx.stroke();
        const k2 = bclamp(1 - e.t / e.dur, 0, 1); // sable restant en haut
        ctx.fillStyle = '#f2d24e';
        ctx.beginPath();
        ctx.moveTo(hx - 6 * k2, hy - 1 - 8 * k2); ctx.lineTo(hx + 6 * k2, hy - 1 - 8 * k2); ctx.lineTo(hx, hy - 1);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx, hy + 1); ctx.lineTo(hx - 6 * (1 - k2) - 1, hy + 9); ctx.lineTo(hx + 6 * (1 - k2) + 1, hy + 9);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // §D15 : les effets « en l'air » — entonnoir de tornade, faisceau, aigle fantôme
      for (const e of spellFx) {
        if (e.kind === 'tornade') {
          // entonnoir : ellipses empilées qui vacillent (plus large en haut)
          const fade = bclamp(Math.min(e.t * 4, (e.dur - e.t) * 3), 0, 1);
          for (let i2 = 0; i2 < 5; i2++) {
            const k2 = i2 / 4;
            const rr = 6 + k2 * 22, yy = e.y - 4 - k2 * 34;
            const wob = Math.sin(t * 9 - i2 * 1.2) * (2 + k2 * 4);
            ctx.globalAlpha = (0.5 - k2 * 0.25) * fade;
            ctx.strokeStyle = '#c9b89a'; ctx.lineWidth = 2.4 - k2;
            ctx.beginPath(); ctx.ellipse(e.x + wob, yy, rr, rr * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
          }
        } else if (e.kind === 'rayon') {
          const pulse = 0.75 + 0.25 * Math.sin(t * 18);
          const fade = bclamp(Math.min(e.t * 6, (e.dur - e.t) * 4), 0, 1);
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.28 * fade;
          ctx.strokeStyle = '#fff8d0'; ctx.lineWidth = 9 * pulse;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x1, e.y1); ctx.stroke();
          ctx.globalAlpha = 0.9 * fade;
          ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3.2 * pulse;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x1, e.y1); ctx.stroke();
          ctx.fillStyle = '#fff8d0'; // la source lumineuse
          ctx.beginPath(); ctx.arc(e.x, e.y, 4.5 * pulse, 0, Math.PI * 2); ctx.fill();
        } else if (e.kind === 'aigle') {
          // silhouette d'aigle fantôme dessinée canvas, 2 frames de battement
          const flap = ((e.t * 8) | 0) % 2;
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(Math.atan2(e.vy, e.vx));
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = '#cfe8ff';
          ctx.beginPath(); ctx.ellipse(0, 0, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill(); // corps
          ctx.beginPath(); ctx.arc(11, 0, 3.4, 0, Math.PI * 2); ctx.fill();           // tête
          ctx.fillStyle = '#ffd257'; // bec
          ctx.beginPath(); ctx.moveTo(14, -1); ctx.lineTo(17.5, 0); ctx.lineTo(14, 1); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#b8d8f4'; // ailes (frame haute / frame basse)
          const w1 = flap ? -14 : -6, w2 = flap ? 6 : 14;
          ctx.beginPath();
          ctx.moveTo(-2, -2); ctx.quadraticCurveTo(-6, w1, -16, w1 - 2);
          ctx.quadraticCurveTo(-4, w1 * 0.4, 4, -2); ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-2, 2); ctx.quadraticCurveTo(-6, w2, -16, w2 + 2);
          ctx.quadraticCurveTo(-4, w2 * 0.4, 4, 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#cfe8ff'; // queue
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-18, -4); ctx.lineTo(-18, 4); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      // §D15 : marqueurs d'état sur les unités — halo de bouclier, marque des
      // maudits, lianes des racinés (checks bon marché, agents bornés à AGENT_CAP)
      for (const a of agents) {
        if (a.dead) continue;
        if ((a.shieldHp || 0) > 0) {
          ctx.globalAlpha = 0.4 + 0.15 * Math.sin(t * 6 + a.id);
          // §D17 pavois : teinte bleutée dédiée (la bénédiction garde son doré)
          ctx.strokeStyle = a.pwShield ? '#8fd8ff' : '#ffd257'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(a.x, a.y - 4, 13 * (a.scale || 1) + 2, 0, Math.PI * 2); ctx.stroke();
        }
        // §D17-3 : marqueurs de pouvoirs (aura antimagie permanente, réticule focus)
        if (a.power) {
          if (a.power.kind === 'antimagie') {
            ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 5 + a.id);
            ctx.strokeStyle = '#7fb8ff'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(a.x, a.y - 3, 11 * (a.scale || 1) + 3, 0, Math.PI * 2); ctx.stroke();
          } else if (a.power.kind === 'focus' && a.pwFocus && a.foe) {
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = '#ffd257'; ctx.lineWidth = 1.2;
            const rr3 = 9 * (a.scale || 1) + 3;
            ctx.beginPath(); ctx.arc(a.x, a.y - 3, rr3, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(a.x - rr3 - 2, a.y - 3); ctx.lineTo(a.x - rr3 + 2, a.y - 3);
            ctx.moveTo(a.x + rr3 - 2, a.y - 3); ctx.lineTo(a.x + rr3 + 2, a.y - 3);
            ctx.moveTo(a.x, a.y - 3 - rr3 - 2); ctx.lineTo(a.x, a.y - 3 - rr3 + 2);
            ctx.moveTo(a.x, a.y - 3 + rr3 - 2); ctx.lineTo(a.x, a.y - 3 + rr3 + 2);
            ctx.stroke();
          }
        }
        if ((a.curseT || 0) > 0) {
          ctx.globalAlpha = 0.85;
          ctx.font = '700 9px Nunito, system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#b06ae0';
          ctx.fillText('', a.x, a.y - 16 - 3 * Math.sin(t * 4 + a.id));
        }
        if ((a.rootT || 0) > 0) {
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = '#4a8a3e'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
          for (let v2 = 0; v2 < 3; v2++) {
            const an = (v2 / 3) * Math.PI * 2 + a.id;
            ctx.beginPath();
            ctx.moveTo(a.x + Math.cos(an) * 6, a.y + 4);
            ctx.quadraticCurveTo(a.x + Math.cos(an) * 9, a.y - 2,
              a.x + Math.cos(an) * 5, a.y - 7 + Math.sin(t * 5 + v2) * 1.5);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // §D4-7 : le poulet flat — corps ovale blanc, crête rouge, bec, 2 frames de
    // marche. Aucun Sprites requis : tout est dessiné ici, façon jelly.
    function drawChicken(a) {
      const sc = Math.max(0.7, a.scale * 1.8);
      const step = ((a.phase * 1.6) | 0) % 2;
      ctx.drawImage(getShadow(), a.x - 12 * sc, a.y - 3 * sc, 24 * sc, 12 * sc);
      ctx.save();
      ctx.translate(a.x, a.y);
      const flip = Math.cos(a.angle) < 0 ? -1 : 1;
      ctx.scale(flip * sc, sc);
      // pattes (2 frames de marche)
      ctx.strokeStyle = '#e8a020'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath();
      if (step) { ctx.moveTo(-2.5, 4); ctx.lineTo(-4, 8.5); ctx.moveTo(2.5, 4); ctx.lineTo(4.5, 8); }
      else { ctx.moveTo(-2.5, 4); ctx.lineTo(-4.5, 8); ctx.moveTo(2.5, 4); ctx.lineTo(4, 8.5); }
      ctx.stroke();
      // corps ovale blanc + queue + tête
      ctx.fillStyle = '#f6f2e8';
      ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-6.5, -1.5); ctx.lineTo(-10.5, -6); ctx.lineTo(-5.5, -3.6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(5.6, -5.6, 3.4, 0, Math.PI * 2); ctx.fill();
      // crête rouge
      ctx.fillStyle = '#e05252';
      ctx.beginPath(); ctx.arc(4.6, -8.8, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6.4, -9.1, 1.2, 0, Math.PI * 2); ctx.fill();
      // bec + œil
      ctx.fillStyle = '#f0a030';
      ctx.beginPath(); ctx.moveTo(8.8, -6.2); ctx.lineTo(11.6, -5.3); ctx.lineTo(8.8, -4.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a2a30';
      ctx.beginPath(); ctx.arc(6.4, -6, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // barre de vie standard (PV conservés : ça reste une cible)
      if (a.hp < a.maxHp - 0.5) {
        const pct = bclamp(a.hp / a.maxHp, 0, 1);
        const bw = 13, bx = a.x - bw / 2, by = a.y - 18;
        ctx.fillStyle = 'rgba(20,20,30,0.55)';
        ctx.fillRect(bx - 0.5, by - 0.5, bw + 1, 3);
        ctx.fillStyle = pct > 0.5 ? '#7ecf6a' : (pct > 0.25 ? '#f2c24e' : '#e05252');
        ctx.fillRect(bx, by, bw * pct, 2);
      }
    }

    // §D13-D4 + §D15-§8 : LE GRIMOIRE EN ACTE — les 20 sorts. (wx, wy) en coordonnées
    // MONDE (screenToWorld côté UI), stats effectives via BGD.spellStats(id, lvl).
    // Retourne false si la bataille est finie ou le sort inconnu.
    // SPELL_FALLBACK supprimé — ses valeurs divergeaient des données (mines
    // count 5 vs 3+lvl, rayon 240 px vs 170+15lvl) et data-battle se charge
    // TOUJOURS avant ce fichier : la béquille ne servait qu'à mentir. Un sort
    // absent de SPELLS renvoie false, comme le contrat le dit déjà.
    function castSpell(id, lvl, wx, wy) {
      if (destroyed || ended) return false;
      const s = BGD.spellStats ? BGD.spellStats(id, lvl) : null;
      if (!s) return false;
      wx = bclamp(+wx || 0, 8, map.w - 8);
      wy = bclamp(+wy || 0, 8, map.h - 8);
      let col = '#ffe9a8';
      switch (s.kind) {
        // 1) ombre qui grossit s.delay s, puis gros boum + braises + shake
        case 'meteore':
          col = '#ff8a3a';
          spellFx.push({ kind: 'meteore', x: wx, y: wy, t: 0, dur: s.delay || 1.2, stats: s });
          sfx('whoosh', 60);
          break;
        // 2) zone gel : slow 70 % (slowPools teintée) + DoT léger (zones) + flocons
        case 'blizzard':
          col = '#9fd4f0';
          slowPools.push({ x: wx, y: wy, r: s.radius, pow: s.slow || 0.7, f: pf, life: s.duration || 5, col: '#7fb8e8', col2: '#5a90c0' });
          if (zones.length < 90) zones.push({ x: wx, y: wy, f: pf, life: s.duration || 5, r: s.radius, dmg: s.power, col: '#9fd4f0' });
          spellFx.push({ kind: 'blizzard', x: wx, y: wy, r: s.radius, t: 0, dur: s.duration || 5 });
          sfx('deploy', 60);
          break;
        // 3) éclair sur le plus proche du point, REBONDIT (portée de saut s.radius),
        // dégâts ×0.85 par saut, polyline brisée blanche/jaune 0.2 s par saut
        case 'chaine': {
          const jump = s.radius || 120;
          const hit = [];
          let cur = nearestFoeAgent(wx, wy, Math.max(jump, 160), hit);
          let sx = wx, sy = wy - 40, dmg = s.power;
          for (let h = 0; h < (s.count || 4) && cur; h++) {
            const mx = (sx + cur.x) / 2 + (Math.random() - 0.5) * 22;
            const my = (sy + cur.y) / 2 + (Math.random() - 0.5) * 22;
            bossBeams.push({ x0: sx, y0: sy, x1: mx, y1: my, life: 0.2, tot: 0.2, col: '#fff8d0', bolt: true });
            bossBeams.push({ x0: mx, y0: my, x1: cur.x, y1: cur.y, life: 0.2, tot: 0.2, col: '#ffe14d', bolt: true });
            puff(cur.x, cur.y, '#fff8d0', 4, 34, 1.8);
            hit.push(cur);
            sx = cur.x; sy = cur.y;
            hurtAgent(cur, dmg, pf, cur.x, cur.y);
            dmg *= 0.85;
            cur = nearestFoeAgent(sx, sy, jump, hit);
          }
          sfx('pop', 60);
          break;
        }
        // 4) mur d'épines TEMPORAIRE : 3-4 obstacles perpendiculaires à l'axe
        // ennemi + dégâts de contact légers. NB perf : l'évitement est un simple
        // steering O(agents × obstacles) — +3-4 cercles quelques secondes, c'est
        // epsilon (aucun graphe de pathfinding à invalider, terrain intact).
        case 'epines': {
          col = '#6fae4a';
          const len = s.len || 90;
          const foeN = nearestNode(wx, wy, n2 => n2.owner && n2.owner !== pf);
          const anW = (foeN ? Math.atan2(foeN.y - wy, foeN.x - wx) : 0) + Math.PI / 2;
          const nObs = len > 120 ? 4 : 3;
          const obs = [];
          for (let i = 0; i < nObs; i++) {
            const k = i / (nObs - 1) - 0.5;
            const o = {
              x: bclamp(wx + Math.cos(anW) * len * k, 14, map.w - 14),
              y: bclamp(wy + Math.sin(anW) * len * k, 14, map.h - 14),
              r: Math.max(10, len / (nObs * 2) + 4),
              temp: true, spike: true,
            };
            obstacles.push(o); obs.push(o);
            for (let j = 0; j < 4; j++) { // pousses vertes qui jaillissent
              spellPart({
                kind: 'sprout', x: o.x + (Math.random() - 0.5) * o.r, y: o.y + 2,
                vx: (Math.random() - 0.5) * 40, vy: -70 - Math.random() * 60,
                life: 0.5 + Math.random() * 0.3, size: 1.8, col: '#6fae4a',
              });
            }
          }
          obsVer++; // §OBST : murs posés → invalide les champs de flux mémoïsés
          spellFx.push({ kind: 'epines', obs, t: 0, dur: s.duration || 5, pow: s.power || 8 });
          sfx('squish', 60);
          break;
        }
        // 5) poigne spectrale : aspiration continue + spirale de traits fantômes
        case 'poigne':
          col = '#b48cff';
          spellFx.push({ kind: 'poigne', x: wx, y: wy, r: s.radius || 110, t: 0, dur: s.duration || 1.5, pow: s.power || 60 });
          sfx('whoosh', 60);
          break;
        // 6) pluie réparatrice : soin de zone sur la durée (power PV/s)
        case 'pluie':
          col = '#7ecf6a';
          spellFx.push({ kind: 'pluie', x: wx, y: wy, r: s.radius || 85, t: 0, dur: s.duration || 6, pow: s.power || 10 });
          sfx('deploy', 60);
          break;
        // 7) malédiction du poulet : les count ennemis les plus proches du point
        case 'poulet': {
          col = '#f6f2e8';
          const rP = s.radius || 90;
          const foes = [];
          eachNear(wx, wy, rP, (o) => {
            if (o.dead || o.f === pf || o.boss || o.polyT > 0) return;
            if (bdist(o.x, o.y, wx, wy) <= rP) foes.push(o);
          });
          foes.sort((A, B2) => bdist(A.x, A.y, wx, wy) - bdist(B2.x, B2.y, wx, wy));
          const nT = Math.min(foes.length, Math.max(1, Math.round(s.count || 2)));
          for (let i = 0; i < nT; i++) polymorphAgent(foes[i], s.duration || 5);
          sfx('squish', 60);
          break;
        }
        // 8) séisme : dégâts modérés + knockback (s.push px) + stun court
        case 'seisme': {
          col = '#c9a96a';
          const rS = s.radius || 100;
          const foes = [];
          eachNear(wx, wy, rS, (o) => {
            if (o.dead || o.f === pf) return;
            if (bdist(o.x, o.y, wx, wy) <= rS) foes.push(o);
          });
          for (const o of foes) {
            hurtAgent(o, s.power, pf, wx, wy);
            if (o.dead) continue;
            const d = bdist(o.x, o.y, wx, wy) || 1;
            const dxn = (o.x - wx) / d, dyn = (o.y - wy) / d;
            o.x = bclamp(o.x + dxn * (s.push || 40), 8, map.w - 8);
            o.y = bclamp(o.y + dyn * (s.push || 40), 8, map.h - 8);
            o.vx += dxn * 60; o.vy += dyn * 60;
            o.stunned = true;
            o.stunT = Math.max(o.stunT || 0, s.stun || 0.8);
          }
          // anneaux de fissures + poussière + shake
          for (let i = 0; i < 3; i++) {
            fxRings.push({ x: wx, y: wy, r: rS * (0.45 + i * 0.28), life: 0.4 + i * 0.12, tot: 0.4 + i * 0.12, col: '#c9a96a' });
          }
          puff(wx, wy, '#b8a488', 14, 60, 2.8);
          shakeT = 0.3; shakeAmp = 2.5;
          sfx('pop', 60);
          break;
        }
        // 9) double d'ombre : duplique l'unité ALLIÉE la plus proche du point
        case 'clone': {
          col = '#8a80a8';
          let src = null, bd = 1e9;
          for (const o of agents) {
            if (o.dead || o.f !== pf || o.boss || o.wild || o.cloneT > 0 || o.polyT > 0) continue;
            const d = bdist(o.x, o.y, wx, wy);
            if (d < bd) { bd = d; src = o; }
          }
          if (src && agents.length < AGENT_CAP) {
            const tgt = (src.target && src.target.x != null) ? src.target
              : (nearestNode(wx, wy, n2 => n2.owner !== pf) || ns[0]);
            const c = spawnAt(src.x + 10, src.y + 8, pf, src.type, tgt);
            c.cloneT = s.duration || 12;
            puff(c.x, c.y, '#3a3346', 10, 40, 2.4);
          }
          sfx('whoosh', 60);
          break;
        }
        // 10) moisson des âmes : zone où chaque mort ennemie soigne les alliés
        case 'ames':
          col = '#3fe0d0';
          spellFx.push({ kind: 'ames', x: wx, y: wy, r: s.radius || 80, t: 0, dur: s.duration || 8 });
          sfx('capture', 60);
          break;
        // 11) sablier : fige TOUS les ennemis (stun global) + voile sépia.
        // Vélocité coupée net : le temps s'arrête, pas de glissade inertielle.
        case 'sablier':
          col = '#e8c878';
          for (const o of agents) {
            if (o.dead || o.f === pf) continue;
            o.stunned = true;
            o.stunT = Math.max(o.stunT || 0, s.duration || 1.5);
            o.vx = 0; o.vy = 0;
          }
          spellFx.push({ kind: 'sablier', x: wx, y: wy, t: 0, dur: s.duration || 1.5 });
          sfx('tick', 60);
          break;
        // 12) fanfare : ralliement au point + mspd ×1.5 + dmg ×1.15 + notes
        case 'fanfare':
          col = '#ffd257';
          for (const o of agents) {
            if (o.dead || o.f !== pf) continue;
            o.rallyT = Math.max(o.rallyT || 0, s.duration || 6);
            o.rallyX = wx; o.rallyY = wy; o.rallyMul = s.speed || 1.5;
          }
          spellFx.push({ kind: 'fanfare', x: wx, y: wy, t: 0, dur: s.duration || 6, speed: s.speed || 1.5 });
          sfx('capture', 60);
          break;
        // 13) mur de GLACE : obstacles temporaires (pattern épines) qui GÈLENT au
        // contact (stun réappliqué) au lieu de blesser — cristaux bleus + brume.
        case 'glace': {
          col = '#9fd8f8';
          const lenG = s.len || s.radius || 90;
          const foeNG = nearestNode(wx, wy, n2 => n2.owner && n2.owner !== pf);
          const anG = (foeNG ? Math.atan2(foeNG.y - wy, foeNG.x - wx) : 0) + Math.PI / 2;
          const nObsG = lenG > 120 ? 4 : 3;
          const obsG = [];
          for (let i = 0; i < nObsG; i++) {
            const k = i / (nObsG - 1) - 0.5;
            const o = {
              x: bclamp(wx + Math.cos(anG) * lenG * k, 14, map.w - 14),
              y: bclamp(wy + Math.sin(anG) * lenG * k, 14, map.h - 14),
              r: Math.max(10, lenG / (nObsG * 2) + 4),
              temp: true, ice: true,
            };
            obstacles.push(o); obsG.push(o);
            puff(o.x, o.y, '#d8f2ff', 5, 32, 2);
            for (let j = 0; j < 3; j++) { // éclats de givre au jaillissement
              spellPart({
                kind: 'flake', x: o.x + (Math.random() - 0.5) * o.r * 1.4, y: o.y - 6 - Math.random() * 8,
                life: 0.7 + Math.random() * 0.4, size: 1.4 + Math.random(), col: '#eaf6ff',
              });
            }
          }
          obsVer++; // §OBST : murs posés → invalide les champs de flux mémoïsés
          spellFx.push({ kind: 'glace', obs: obsG, t: 0, dur: s.duration || 5, stun: s.freeze || s.stun || 1 });
          sfx('deploy', 60);
          break;
        }
        // 14) tornade ERRANTE : entonnoir brownien qui aspire puis ÉJECTE
        // (déplacement radial aléatoire 60-120 px) avec petit dégât.
        case 'tornade':
          col = '#c9b89a';
          spellFx.push({
            kind: 'tornade', x: wx, y: wy, r: s.radius || 70, t: 0, dur: s.duration || 6,
            pow: s.power || 12, push: s.push || 60, wa: Math.random() * Math.PI * 2,
          });
          sfx('whoosh', 60);
          break;
        // 15) racines : IMMOBILISE (rootT — mspd 0, mais l'unité attaque encore)
        case 'racines': {
          col = '#4a8a3e';
          const rRac = s.radius || 90;
          spellFx.push({ kind: 'racines', x: wx, y: wy, r: rRac, t: 0, dur: s.duration || 4 });
          for (let i = 0; i < 10; i++) { // lianes qui jaillissent au cast
            const an = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * rRac;
            spellPart({
              kind: 'sprout', x: wx + Math.cos(an) * rr, y: wy + Math.sin(an) * rr,
              vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 50,
              life: 0.5 + Math.random() * 0.2, size: 2, col: '#4a8a3e',
            });
          }
          sfx('squish', 60);
          break;
        }
        // 16) mines : count charges posées autour du point (rayon radius), AoE 40 px
        // au contact, désarmées après duration — clignotement discret, fumée à l'armement.
        case 'mines': {
          col = '#c86a4a';
          const rMi = s.radius || 60, nMi = Math.max(1, Math.round(s.count || 5));
          const mines = [];
          for (let i = 0; i < nMi; i++) {
            const an = (i / nMi) * Math.PI * 2 + Math.random() * 0.8;
            const rr = i === 0 ? 0 : (0.35 + Math.random() * 0.65) * rMi;
            const mx = bclamp(wx + Math.cos(an) * rr, 10, map.w - 10);
            const my = bclamp(wy + Math.sin(an) * rr, 10, map.h - 10);
            mines.push({ x: mx, y: my });
            puff(mx, my, '#b0a898', 3, 18, 1.6); // fumée à l'armement
          }
          spellFx.push({ kind: 'mines', mines, t: 0, dur: s.duration || 20, pow: s.power || 55 });
          sfx('deploy', 60);
          break;
        }
        // 17) bénédiction : BOUCLIER absorbant (shieldHp=power, duration s max) aux
        // alliés dans radius — halo doré + étoiles ; hurtAgent le consomme d'abord.
        case 'benediction': {
          col = '#ffd257';
          const rBe = s.radius || 100;
          eachNear(wx, wy, rBe, (o) => {
            if (o.dead || o.f !== pf) return;
            if (bdist(o.x, o.y, wx, wy) > rBe) return;
            o.shieldHp = Math.max(o.shieldHp || 0, s.power || 60);
            o.shieldT = s.duration || 8;
            fxRings.push({ x: o.x, y: o.y, r: 16, life: 0.4, tot: 0.4, col: '#ffd257' });
            for (let i = 0; i < 3; i++) {
              spellPart({
                kind: 'star', x: o.x + (Math.random() - 0.5) * 16, y: o.y - 8 - Math.random() * 8,
                vy: -18, life: 0.7, size: 2, col: '#ffe9a8',
              });
            }
          });
          sfx('capture', 60);
          break;
        }
        // 18) rayon : FAISCEAU fixe du point de cast vers le nœud ennemi le plus
        // proche (segment ~radius px), power dégâts/s aux ennemis traversés.
        case 'rayon': {
          col = '#ffe14d';
          const lenR = s.len || s.radius || 240;
          const foeNR = nearestNode(wx, wy, n2 => n2.owner && n2.owner !== pf);
          const anR = foeNR ? Math.atan2(foeNR.y - wy, foeNR.x - wx) : 0;
          spellFx.push({
            kind: 'rayon', x: wx, y: wy,
            x1: bclamp(wx + Math.cos(anR) * lenR, 4, map.w - 4),
            y1: bclamp(wy + Math.sin(anR) * lenR, 4, map.h - 4),
            t: 0, dur: s.duration || 3, pow: s.power || 40,
          });
          sfx('whoosh', 60);
          break;
        }
        // 19) malédiction : +power % de dégâts SUBIS (curseT/curseMult lus par
        // hurtAgent) pour les ennemis en zone pendant duration — volutes violettes.
        case 'malediction': {
          col = '#b06ae0';
          // power : fraction (0.38 = +38 %) si <= 3, sinon pourcentage (25 = +25 %)
          const powM = s.power || 0.25;
          spellFx.push({
            kind: 'malediction', x: wx, y: wy, r: s.radius || 95, t: 0,
            dur: s.duration || 6, mult: 1 + (powM > 3 ? powM / 100 : powM),
          });
          sfx('squish', 60);
          break;
        }
        // 20) aigle FANTÔME : traverse la carte en ligne droite (bord le plus proche
        // → bord opposé, via le point) et frappe chaque ennemi une fois (~50 px de large).
        case 'aigle': {
          col = '#cfe8ff';
          const dl = wx, dr = map.w - wx, dtp = wy, db = map.h - wy;
          const mE = Math.min(dl, dr, dtp, db);
          let ax0, ay0, ax1, ay1;
          if (mE === dl) { ax0 = 0; ay0 = wy; ax1 = map.w; ay1 = wy; }
          else if (mE === dr) { ax0 = map.w; ay0 = wy; ax1 = 0; ay1 = wy; }
          else if (mE === dtp) { ax0 = wx; ay0 = 0; ax1 = wx; ay1 = map.h; }
          else { ax0 = wx; ay0 = map.h; ax1 = wx; ay1 = 0; }
          const dTot = bdist(ax0, ay0, ax1, ay1) || 1;
          const spdA = s.speed || 420;
          spellFx.push({
            kind: 'aigle', x: ax0, y: ay0,
            vx: ((ax1 - ax0) / dTot) * spdA, vy: ((ay1 - ay0) / dTot) * spdA,
            t: 0, dur: dTot / spdA, pow: s.power || 80,
            w: (s.radius || 56) / 2, hit: [], // radius = LARGEUR de frappe (~50 px)
          });
          sfx('whoosh', 60);
          break;
        }
        // ---- MAJ majeure §7 : les 5 nouveaux sorts d'alchimie ----
        case 'piquants': { // vos bâtiments mordent les passants ennemis (temporaire)
          col = '#9dd45a';
          spikeAuraT[pf] = Math.max(spikeAuraT[pf] || 0, s.duration || 20);
          spikeAuraPow[pf] = Math.max(spikeAuraPow[pf] || 0, s.power || 8);
          for (const n2 of ns) if (n2.owner === pf) n2.fxPulse = Math.max(n2.fxPulse || 0, 0.8);
          sfx('whoosh', 70);
          break;
        }
        case 'gel': { // grand gel de zone : fige net + morsure de froid
          col = '#9fd8ff';
          eachNear(wx, wy, s.radius || 90, o => {
            if (o.dead || o.f === pf) return;
            if (!((o.stunT || 0) > 0)) { o.vx = 0; o.vy = 0; }
            o.stunT = Math.max(o.stunT || 0, s.duration || 2.5);
            o.gelT = Math.max(o.gelT || 0, s.duration || 2.5);
            if (s.power) hurtAgent(o, s.power, pf, wx, wy);
          });
          puff(wx, wy, '#bfe8ff', 16, 50, 2.8);
          break;
        }
        case 'brouillard': { // nappe qui désoriente les tireurs ennemis
          col = '#c9cfd8';
          spellFx.push({ kind: 'brouillard', x: wx, y: wy, r: s.radius || 100, t: 0, dur: s.duration || 8, tick: 0 });
          sfx('whoosh', 50);
          break;
        }
        case 'lave': { // nappe de lave : brûle ceux qui y marchent (réutilise `zones`)
          col = '#ff6a2a';
          if (zones.length < 90) zones.push({ x: wx, y: wy, f: pf, life: s.duration || 6, r: s.radius || 80, dmg: s.power || 25, col: '#ff6a2a', lava: true });
          puff(wx, wy, '#ff9a4a', 18, 60, 3);
          sfx('pop', 90);
          break;
        }
        case 'spectres': { // ost spectral : renforts turquoise translucides, ~30 s
          col = '#3fe0d0';
          const countS = Math.max(1, Math.round(s.count || 4));
          const tgtN2 = nearestNode(wx, wy, n2 => n2.owner !== pf) || nearestNode(wx, wy, null);
          for (let i2 = 0; i2 < countS; i2++) {
            if (agents.length >= AGENT_CAP || !tgtN2) break;
            const an2 = (i2 / countS) * Math.PI * 2;
            const m2 = spawnAt(wx + Math.cos(an2) * 22, wy + Math.sin(an2) * 22, pf, i2 % 3 === 0 ? 'costaud' : 'lancier', tgtN2);
            m2.tempLife = s.duration || 30;
            m2.spectral = true; // teinte turquoise translucide (drawAgent)
          }
          puff(wx, wy, '#7ff0e0', 16, 52, 2.8);
          sfx('whoosh', 90);
          break;
        }
        default:
          return false;
      }
      // signature commune : nom flottant du sort + anneau au point + fx overlay
      const def = (BGD.SPELLS || []).find(sp2 => sp2.id === id);
      if (def) addDmgText(wx, wy - 16, (def.icon ? def.icon + ' ' : '') + def.name, col);
      fxRings.push({ x: wx, y: wy, r: s.radius || 46, life: 0.5, tot: 0.5, col });
      if (fxVisible()) {
        const p = scr(wx, wy);
        try { FX.ring(p.x, p.y, col); } catch (e) { /* fx optionnels */ }
      }
      return true;
    }

    // §9 (DESIGN2) : boss — spawné devant le QG ennemi, ×12 PV, scale ×1.6,
    // mécanique à 50 % (enrage ou invocations) choisie par la seed de la carte.
    if (cfg.boss && cfg.boss.type && BGD.UNIT_TYPES[cfg.boss.type]) {
      const hqE = ns.find(n2 => n2.kind === 'hq' && n2.owner === ef);
      if (hqE) {
        const bmult = cfg.boss.mult || 1;
        const bb = spawnAt(hqE.x + 30, hqE.y, ef, cfg.boss.type, hqE);
        bb.boss = true;
        bb.hp = bb.maxHp = bb.hp * 12 * bmult;
        bb.dmg *= bmult;
        bb.scale *= 1.6;
        bb.bossMech = ((map.seed || 0) % 2) ? 'enrage' : 'summon';
        bb.summonT = 10;
      }
    }

    const api = {
      update, render, resize,
      pointerDown, pointerMove, pointerUp,
      setSendRatio: r => { sendRatio = bclamp(r || 0.5, 0.05, 1); },
      deploy,
      castPotion,
      castSpell, // §D4 : les 12 sorts du Grimoire
      canCast: () => !destroyed && !ended,
      screenToWorld: toWorld,
      setAutoPilot: v => { autoPilot = !!v; if (autoPilot && aiTimers[pf] == null) aiTimers[pf] = 0.5; },
      getControl,
      getControlWinPoints: () => ctrlWin,
      serialize,
      takePlayerKills: () => { const k = playerKills; playerKills = 0; return k; },
      getPlayerLosses: () => playerLosses,
      takeEspionLoot: () => { const f = espionLoot; espionLoot = 0; return f; }, // §7 : butin food ramassé par l'espion
      getSelectedNode: () => (selectedId >= 0 ? nById[selectedId] : null),
      isEnded: () => ended,
      destroy: () => {
        destroyed = true;
        agents.length = 0; projectiles.length = 0; particles.length = 0; dmgTexts.length = 0;
        souls.length = 0; soulHead = 0;
        mapBosses.length = 0; bossBeams.length = 0;
        // §D4 : sorts — on rend aussi les obstacles TEMPORAIRES (épines) à la carte
        spellFx.length = 0; spParts.length = 0;
        for (let i = obstacles.length - 1; i >= 0; i--) if (obstacles[i].temp) obstacles.splice(i, 1);
        obsVer++; flowFields.clear(); // §OBST : plus aucun champ mémoïsé après destroy
        grid.clear();
      },
    };
    // Hooks de test OPT-IN : le jeu réel ne passe jamais cfg.testHooks, donc aucun
    // hook de debug ne traîne dans l'API livrée (le joueur n'en veut plus). Seuls
    // les harnais dev/ les demandent — accès lecture seule aux agents/âmes.
    if (cfg.testHooks) {
      api._agents = () => agents.slice();
      api._souls = () => souls.filter(s => !s.dead);
      api._mapBosses = () => mapBosses.slice();
      api._zones = () => zones.slice();
      api._projectiles = () => projectiles.slice(); // §D18 : volee / percant mesurables
      api._slowPools = () => slowPools.slice();
      api._bossBeams = () => bossBeams.slice();
      api._spellFx = () => spellFx.slice();
      api._spParts = () => spParts.slice();
      api._nodes = () => ns.map(n => ({ id: n.id, owner: n.owner, kind: n.kind, prodRate: n.prodRate, prodBlockT: n.prodBlockT || 0, tot: nodeGTot(n) }));
      api._obstacles = () => obstacles.slice();
      // §OBST : hooks du harnais diag-obstacles — mutation d'obstacles PAR LES
      // MÊMES règles que le runtime (push/splice + bump de version) + lecture
      // du compteur d'invalidation des champs de flux.
      api._obsVer = () => obsVer;
      api._addObstacle = (o) => { obstacles.push(o); obsVer++; return o; };
      api._removeObstacle = (o) => { const ix = obstacles.indexOf(o); if (ix >= 0) { obstacles.splice(ix, 1); obsVer++; } };
      // §MOUV : pose directe d'un agent (harnais diag-mouv — figurants ennemis
      // placés au pixel près derrière un obstacle, sans passer par l'IA de nœuds)
      api._spawnAt = (x, y, f, type, tgtId) => spawnAt(x, y, f, type, nById[tgtId]);
    }
    return api;
  }

  window.Battle = {
    generateMap,
    create,
    applySerialized,
    offlineResolve,
  };
