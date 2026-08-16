/* ============================================================
   GRIFFES & PLUMES — sprites-units.js (2/9)
   Rang → couleurs (cape/crête/couronne), file de génération
   asynchrone, getUnitFrames/getUnitIcon/renderUnitFrame.
   Dépend de sprites-core.js, sprites-weapons.js, sprites-armor.js
   et window.Model3D (déjà chargé avant sprites-*.js).
   ============================================================ */
"use strict";

  // ------------------------------------------------------------
  // §V — insignes de RANG (visualRank 0..5) : montée en gamme.
  // Rang 0 = neutre (indices non utilisés / tenue de base). Progression
  // wine → acier → pourpre royal → or → cosmique. Rien de criard en bas.
  // ------------------------------------------------------------
  const RANK_CAPE = ['#5f9e46', '#8c3a44', '#5c6b78', '#4a3170', '#b58a2a', '#2f8f9c'];
  const RANK_CROWN = ['#c8a24a', '#c86a3a', '#c0cad4', '#f4c542', '#ffd700', '#9cf7ff'];
  const RANK_CREST = ['#e0532f', '#e8452f', '#f07a2a', '#f4b02f', '#ffcf3a', '#9cf7ff'];
  function rankCapeColor(r) { return RANK_CAPE[clamp(r | 0, 0, 5)]; }
  function rankCrownColor(r) { return RANK_CROWN[clamp(r | 0, 0, 5)]; }
  function rankCrestColor(r) { return RANK_CREST[clamp(r | 0, 0, 5)]; }

  // ------------------------------------------------------------
  // §V3 — ÂME : silhouette de base fusionnée (corps+tête+membres en une
  // masse, sans visage ni arme), turquoise translucide + liseré clair.
  // Ellipses en coordonnées normalisées [-1..1] : [cx, cy, rx, ry, rot].

  // ------------------------------------------------------------
  // API : getUnitFrames — 16 canvases 128×128 (cache lazy)
  // opts : {faction, type, evo, weapon, armor, ranged, staff,
  //         ordnance, robe, vest, suit} (§14, §9)
  // ------------------------------------------------------------
  // §2 — remplace la palette du modèle 3D par celle du type (look/evoPalette).
  // fur→fur, furHi→furHi, shade→shade, stripe→stripe ; belly = shade(fur,+.4) ;
  // yeux = look.eye ; le rose (pink) est conservé.
  function recolorModel(model, look) {
    const bp = model.pal;
    const map = {};
    if (bp.fur) map[bp.fur.toLowerCase()] = look.fur;
    if (bp.furHi) map[bp.furHi.toLowerCase()] = look.furHi;
    if (look.shade && bp.shade) map[bp.shade.toLowerCase()] = look.shade;
    if (look.stripe && bp.stripe) map[bp.stripe.toLowerCase()] = look.stripe;
    for (const p of model.parts) {
      if (p.kind === 'eye') { if (look.eye) p.col = look.eye; continue; }
      if (p.col) { const c = p.col.toLowerCase(); if (map[c]) p.col = map[c]; }
    }
    model.pal = {
      fur: look.fur, furHi: look.furHi, shade: look.shade || bp.shade,
      belly: SGD.shade(look.fur, 0.4), stripe: look.stripe || bp.stripe, pink: bp.pink,
    };
  }

  // §FRZ : anti-gel du Front — la cuisson d'une (look × direction) coûte plusieurs
  // millisecondes ; au premier contact les unités s'éparpillent sur 16 directions
  // d'un coup → rafale de cuissons bloquantes (~10 s après l'ouverture : le gel
  // rapporté par le joueur). Remède : (1) repli immédiat sur la direction VOISINE
  // déjà cuite, (2) file de cuisson asynchrone à budget (6 ms/battement),
  // (3) préchauffage des 15 autres directions dès la première apparition d'un look.
  const lookDirs = new Map();      // baseKey -> Set(dirs cuites)
  const bakeQ = [];                // { o (opts sync), key }
  const bakePending = new Set();   // clés en file (dédoublonnage)
  let bakeT = null;
  // §FRZ3 : la génération d'arrière-plan travaille IMAGE PAR IMAGE (3-5 ms
  // l'unité) avec un budget de 5 ms toutes les 16 ms. Générer une direction
  // entière d'un coup (~30 ms) faisait ramer le lancement ; la limiter à une
  // par 300 ms laissait les sprites orientés du mauvais côté pendant des
  // secondes. Ici : jamais plus de ~5 ms volées par frame, et une direction
  // demandée est prête en ~0,1 s.
  const modelCache = new Map();   // baseKey -> { model, scale } (modèle configuré réutilisable)
  function modelFor(baseKey, P) {
    let mc = modelCache.get(baseKey);
    if (!mc) {
      mc = configureModel(P);
      modelCache.set(baseKey, mc);
      if (modelCache.size > 16) modelCache.delete(modelCache.keys().next().value);
    }
    return mc;
  }
  function pumpSlice(budgetMs) {
    const now = () => (window.performance && performance.now) ? performance.now() : Date.now();
    const t0 = now();
    while (bakeQ.length && now() - t0 < budgetMs) {
      const job = bakeQ[0];
      if (cache.get(job.key)) { bakePending.delete(job.key); bakeQ.shift(); continue; }
      const mc = modelFor(job.baseKey, job.P);
      job.frames.push(renderUnitFrame(mc.model, mc.scale, job.dir, job.f++));
      if (job.f >= FRAMES) {
        cache.set(job.key, job.frames);
        framesRange(job.key);
        let dirs = lookDirs.get(job.baseKey);
        if (!dirs) { dirs = new Set(); lookDirs.set(job.baseKey, dirs); }
        dirs.add(job.dir);
        bakePending.delete(job.key);
        bakeQ.shift();
      }
    }
  }
  function startPump() {
    if (bakeT != null || !bakeQ.length) return;
    try {
      // requestAnimationFrame : cadencé sur l'affichage réel (60 fps quand le jeu
      // est visible, en pause sinon) — insensible au bridage des minuteurs.
      if (typeof requestAnimationFrame === 'function') {
        bakeT = requestAnimationFrame(function () { bakeT = null; pumpSlice(5); startPump(); });
      } else {
        bakeT = setTimeout(function () { bakeT = null; pumpSlice(5); startPump(); }, 32);
      }
    } catch (e) { bakeT = null; /* environnement sans timer (tests node) : tout reste synchrone */ }
  }

  // LE CACHE D'IMAGES D'UNITÉS N'AVAIT AUCUNE BORNE. Chaque apparence x
  // direction retient SEIZE canvas de 128x128, soit ~1 Mo. Une longue partie
  // qui débloque beaucoup de types et les fait marcher dans toutes les
  // directions accumulait donc des centaines de mégaoctets — c'est ce que
  // montrait le relevé mémoire (des milliers de canvas « détachés », qui
  // sont simplement des canvas de cache, hors du DOM).
  // Le plafond est GÉNÉREUX : en jeu normal rien n'est jamais évincé (une
  // éviction coûte une recuisson de seize images). Il n'existe que pour
  // qu'une session très longue ne grossisse pas sans fin.
  const FRAMES_MAX = 192;
  const framesOrdre = new Map();      // clé -> rang d'usage (Map = ordre d'insertion)
  function framesUtilise(key) {
    framesOrdre.delete(key);
    framesOrdre.set(key, 1);
  }
  function framesRange(key) {
    framesUtilise(key);
    while (framesOrdre.size > FRAMES_MAX) {
      const vieille = framesOrdre.keys().next();
      if (vieille.done) break;
      framesOrdre.delete(vieille.value);
      cache.delete(vieille.value);
    }
  }
  function getUnitFrames(opts) {
    const M3 = window.Model3D;
    const faction = opts.faction === 'birds' ? 'birds' : 'cats';
    const type = SGD.UNIT_TYPES[opts.type] ? opts.type : 'lancier';
    const ut = SGD.UNIT_TYPES[type];
    const cat = ut.cat || 'melee';
    const rank = clamp(opts.evo | 0, 0, 30);
    const evo = SGD.visualRank ? SGD.visualRank(rank) : clamp(rank, 0, 4);
    const weapon = clamp(opts.weapon | 0, 0, SGD.WEAPONS.length - 1);
    const armor = clamp(opts.armor | 0, 0, SGD.ARMORS.length - 1);
    // tiers d'arme / d'armure : seuls pertinents pour leur catégorie
    const ranged = (cat === 'tir' && SGD.RANGED) ? clamp(opts.ranged | 0, 0, SGD.RANGED.length - 1) : 0;
    const staff = (cat === 'magie' && SGD.STAFFS) ? clamp(opts.staff | 0, 0, SGD.STAFFS.length - 1) : 0;
    const ordnance = (cat === 'explosif' && SGD.ORDNANCE) ? clamp(opts.ordnance | 0, 0, SGD.ORDNANCE.length - 1) : 0;
    const robe = (cat === 'magie' && SGD.ROBES) ? clamp(opts.robe | 0, 0, SGD.ROBES.length - 1) : 0;
    const vest = (cat === 'tir' && SGD.VESTS) ? clamp(opts.vest | 0, 0, SGD.VESTS.length - 1) : 0;
    const suit = (cat === 'explosif' && SGD.SUITS) ? clamp(opts.suit | 0, 0, SGD.SUITS.length - 1) : 0;
    // §2 D17 : la garde porte lame (main) + bouclier (bras gauche)
    const blade = (cat === 'garde' && SGD.BLADES) ? clamp(opts.blade | 0, 0, SGD.BLADES.length - 1) : 0;
    const shield = (cat === 'garde' && SGD.SHIELDS) ? clamp(opts.shield | 0, 0, SGD.SHIELDS.length - 1) : 0;
    const dir = ((opts.dir | 0) % UNIT_DIRS + UNIT_DIRS) % UNIT_DIRS;   // direction (yaw) pré-rendue
    // MAJ §8 : worker = le MÊME modèle, sans arme ni armure, avec un TABLIER
    // (pour le village animé du QG — pas un nouveau modèle d'unité).
    const worker = !!opts.worker;
    // MAJ village : bare = même skin SANS arme ni bouclier (mais SANS tablier) —
    // pour le Général sur la place, qui porte notre couronne + sceptre à la place.
    const bare = !!opts.bare;
    const baseKey = 'u3|' + faction + '|' + type + '|' + evo + '|' + weapon + '|' + armor + '|' + ranged + '|' + staff
      + '|' + ordnance + '|' + robe + '|' + vest + '|' + suit + '|' + blade + '|' + shield + (worker ? '|w' : '') + (bare ? '|b' : '');
    const key = baseKey + '|d' + dir;
    // paramètres normalisés — partagés entre le rendu direct et la file d'arrière-plan
    const P = { faction, type, ut, cat, rank, evo, weapon, armor, ranged, staff, ordnance, robe, vest, suit, blade, shield, worker, bare };
    let frames = cache.get(key);
    if (frames) { framesUtilise(key); return frames; }

    // §FRZ : direction manquante mais look déjà connu → file asynchrone + repli
    // sur la direction cuite la plus proche (écart ≤ 2-3 crans, invisible en mêlée).
    if (!opts.sync) {
      const dirs = lookDirs.get(baseKey);
      if (dirs && dirs.size) {
        if (!bakePending.has(key)) {
          bakePending.add(key);
          // direction réellement AFFICHÉE → tête de file (le pré-calcul passe après)
          bakeQ.unshift({ key, baseKey, P, dir, frames: [], f: 0 });
          startPump();
        }
        let best = -1, bd = 99;
        for (const d2 of dirs) {
          const dd = Math.min((d2 - dir + UNIT_DIRS) % UNIT_DIRS, (dir - d2 + UNIT_DIRS) % UNIT_DIRS);
          if (dd < bd) { bd = dd; best = d2; }
        }
        const fb = cache.get(baseKey + '|d' + best);
        if (fb) return fb;
      }
    }

    const mc = modelFor(baseKey, P);
    frames = [];
    for (let f = 0; f < FRAMES; f++) frames.push(renderUnitFrame(mc.model, mc.scale, dir, f));
    cache.set(key, frames);
    framesRange(key);
    // Enregistre la direction générée. PAS de pré-calcul des autres directions :
    // remplir la file d'avance occupait ~5 ms de CHAQUE frame pendant tout le
    // début de bataille (le lag rapporté). À la demande seulement : pendant la
    // marche la file reste vide, et une direction affichée arrive en 2-3 frames.
    let dirs = lookDirs.get(baseKey);
    if (!dirs) { dirs = new Set(); lookDirs.set(baseKey, dirs); }
    dirs.add(dir);
    return frames;
  }

  // MAJ §8 : le TABLIER d'ouvrier — billboard de torse (même repère 128×128 que
  // le plastron getArmorIcon) : bavette + jupe de tissu, bretelles, grande poche.
  // Teinte chaude côté chats, gris-bleu côté oiseaux. Caché par faction.
  const apronCache = {};
  function getApronCanvas(faction) {
    if (apronCache[faction]) return apronCache[faction];
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const cloth = faction === 'birds' ? '#7e96ac' : '#c98d5c';
    const clothHi = faction === 'birds' ? '#9db4c8' : '#e2ac78';
    const strap = faction === 'birds' ? '#5a7086' : '#a06a40';
    // bretelles (derrière la bavette)
    g.strokeStyle = strap;
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(50, 40); g.lineTo(38, 18); g.stroke();
    g.beginPath(); g.moveTo(78, 40); g.lineTo(90, 18); g.stroke();
    // jupe du tablier (trapèze arrondi)
    const grad = g.createLinearGradient(0, 36, 0, 112);
    grad.addColorStop(0, clothHi);
    grad.addColorStop(1, cloth);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(46, 36);
    g.lineTo(82, 36);
    g.quadraticCurveTo(86, 60, 94, 100);
    g.quadraticCurveTo(64, 112, 34, 100);
    g.quadraticCurveTo(42, 60, 46, 36);
    g.closePath();
    g.fill();
    // ceinture nouée
    g.strokeStyle = strap;
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(38, 62); g.quadraticCurveTo(64, 70, 90, 62); g.stroke();
    // grande poche ventrale
    g.fillStyle = cloth;
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(50, 76); g.lineTo(78, 76); g.lineTo(76, 96);
    g.quadraticCurveTo(64, 100, 52, 96);
    g.closePath();
    g.fill(); g.stroke();
    // surpiqûres claires sur les bords
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(48, 40);
    g.quadraticCurveTo(44, 62, 37, 98);
    g.stroke();
    g.beginPath();
    g.moveTo(80, 40);
    g.quadraticCurveTo(84, 62, 91, 98);
    g.stroke();
    g.setLineDash([]);
    apronCache[faction] = c;
    return c;
  }

  // Configure le modèle 3D complet d'un look (couleurs, arme, armure, bouclier,
  // insignes de rang) — réutilisé pour les 16 directions via modelFor().
  function configureModel(Pc) {
    const M3 = window.Model3D;
    const faction = Pc.faction, type = Pc.type, ut = Pc.ut, cat = Pc.cat, rank = Pc.rank, evo = Pc.evo;
    const weapon = Pc.weapon, armor = Pc.armor, ranged = Pc.ranged, staff = Pc.staff, ordnance = Pc.ordnance;
    const robe = Pc.robe, vest = Pc.vest, suit = Pc.suit, blade = Pc.blade, shield = Pc.shield;
    const species = faction === 'cats' ? 'cat' : 'bird';
    const model = species === 'cat' ? M3.CAT() : M3.BIRD();
    // couleur par type + décalage d'évolution (evoPalette combine les deux)
    recolorModel(model, SGD.evoPalette(faction, type, rank));

    // --- arme portée (§3) : catégorie -> sprite + placement newgraph ---
    const wp = model.parts.find(x => x.id === 'weapon');
    if (wp) {
      if (ut.juvenile || ut.worker) { wp.vis = 0; }   // §4 : juvéniles et ouvriers n'ont pas d'arme
      else {
        let spr, pcat, tier;
        if (cat === 'tir') { spr = getRangedCanvas(ranged, 220); pcat = 'tir'; tier = ranged; }
        else if (cat === 'magie') { spr = getStaffCanvas(staff, 220); pcat = 'baton'; tier = staff; }
        else if (cat === 'explosif') { spr = getOrdnanceCanvas(ordnance, 220); pcat = 'explosif'; tier = ordnance; }
        else if (cat === 'garde') { spr = getBladeCanvas(blade, 220); pcat = 'garde'; tier = blade; }   // §2 D17
        else { spr = getWeaponCanvas(weapon, 220); pcat = 'lance'; tier = weapon; }
        Object.assign(wp, M3.placement(species, pcat, tier));
        wp.kind = 'weapon'; wp.sprite = spr; wp.baseH = 22; wp.vis = 1;
      }
    }

    // --- armure (§3, §5 D15) : torse masqué + vêtement de la ligne de la
    // catégorie (magie = ROBE, tir = GILET, explosif = COMBINAISON, sinon ARMURE),
    // chacun avec son rendu PAR TIER, même placement/échelle que le plastron. ---
    const ga = model.parts.find(x => x.id === 'gamearmor');
    if (ga) {
      Object.assign(ga, M3.armorPlacement(species));
      let garment;
      if (cat === 'magie') garment = getRobeIcon(robe, faction, 128);
      else if (cat === 'tir') garment = getVestIcon(vest, faction, 128);
      else if (cat === 'explosif') garment = getSuitIcon(suit, faction, 128);
      else garment = getArmorIcon(armor, faction, 128);
      ga.kind = 'gamearmor'; ga.sprite = garment; ga.baseH = 10; ga.vis = 1;
    }
    // --- bouclier (§2 D17) : la garde le porte au bras gauche, billboard
    // 'gameshield' toujours lisible (dmode 'front'), ~0.8× le torse. ---
    const gs = model.parts.find(x => x.id === 'gameshield');
    if (gs) {
      if (cat === 'garde' && !ut.juvenile && M3.shieldPlacement) {
        Object.assign(gs, M3.shieldPlacement(species));
        gs.kind = 'gameshield'; gs.sprite = getShieldIcon(shield, faction, 128);
        gs.baseH = 13; gs.vis = 1;
      } else gs.vis = 0;
    }
    const body = model.parts.find(x => x.id === 'body');
    if (body) body.vis = 0;   // le foyer du torse EST le plastron

    // --- MAJ §8 : OUVRIER DU VILLAGE — même modèle, désarmé et en tablier ---
    if (Pc.worker) {
      if (wp) wp.vis = 0;                          // pas d'arme au travail
      if (gs) gs.vis = 0;                          // pas de bouclier non plus
      if (ga) ga.sprite = getApronCanvas(faction); // le tablier remplace le plastron
    }
    // --- MAJ village : le GÉNÉRAL — désarmé, mais sans tablier (couronne/sceptre ajoutés à part) ---
    if (Pc.bare) {
      if (wp) wp.vis = 0;
      if (gs) gs.vis = 0;
    }

    // --- rang VISIBLE (§V, à la place du casque) : évo = visualRank 0..5. ---
    // V1 : le casque ne s'affiche JAMAIS (on le garde dans le modèle pour l'éditeur).
    const helmet = model.parts.find(x => x.id === 'helmet');
    if (helmet) helmet.vis = 0;
    // V2 — TOUS : la cape monte en gamme dès le rang ≥1 (rang 0 = tenue neutre,
    // on laisse la cape de référence intacte). Cape teintée = insigne de rang.
    if (evo >= 1) {
      const cape = model.parts.find(x => x.id === 'cape');
      if (cape) { cape.col = rankCapeColor(evo); cape.vis = 1; }
    }
    if (faction === 'birds') {
      // V2 — OISEAUX : la crête gagne en couleur ET en hauteur avec le rang.
      const crest = model.parts.find(x => x.id === 'crest');
      if (crest) { crest.col = rankCrestColor(evo); crest.size = 2.2 + evo * 0.5; crest.vis = 1; }
    } else {
      // V2 — CHATS : couronne teintée + halo doux assorti dès le rang ≥1. Pas de casque.
      const crown = model.parts.find(x => x.id === 'crown');
      if (crown) {
        if (evo >= 1) {
          const cc = rankCrownColor(evo);
          crown.col = cc; crown.haloCol = cc; crown.halo = 1; crown.vis = 1;
        } else { crown.vis = 0; crown.halo = 0; }
      }
    }

    // échelle : type.scale est appliqué EN AVAL (battle/ui) — ici seule la
    // croissance d'évolution est intégrée, pour des frames d'assiette constante.
    let scale = 3.4 * (1 + 0.04 * evo);
    if (ut.juvenile) scale *= 0.82;   // les juvéniles sont un peu plus petits
    return { model, scale };
  }

  // Rend UNE image d'animation d'un look configuré (direction + phase de marche).
  function renderUnitFrame(model, scale, dir, f) {
    const cv = mk(US, US);
    const g = cv.getContext('2d');
    g.translate(US / 2, US / 2);
    const phase = (f / FRAMES) * TAU;
    // §4 : sautillement vertical commun + balancement avant/arrière (hors tête)
    const hop = 0.9 * Math.abs(Math.sin(phase));
    const rock = 0.14 * Math.sin(phase + Math.PI / 2);
    window.Model3D.render(g, model, { yaw: dir / UNIT_DIRS * TAU, pitch: 0.26, hop, rock, scale });
    { const pxb = bakePx(3); if (pxb > 1) pixelate(cv, pxb); }   // filtre pixel-art dosé par BALANCE.pixelArt
    return cv;
  }

  // ------------------------------------------------------------
  // API : getUnitIcon — pose statique tournée face HAUT pour l'UI
  // ------------------------------------------------------------
  function getUnitIcon(opts, size) {
    size = size || 72;
    const faction = opts.faction === 'birds' ? 'birds' : 'cats';
    const type = SGD.UNIT_TYPES[opts.type] ? opts.type : 'lancier';
    const evo = clamp(opts.evo | 0, 0, 30);
    const weapon = clamp(opts.weapon | 0, 0, SGD.WEAPONS.length - 1);
    const armor = clamp(opts.armor | 0, 0, SGD.ARMORS.length - 1);
    const ranged = SGD.RANGED ? clamp(opts.ranged | 0, 0, SGD.RANGED.length - 1) : 0;
    const staff = SGD.STAFFS ? clamp(opts.staff | 0, 0, SGD.STAFFS.length - 1) : 0;
    const ordnance = SGD.ORDNANCE ? clamp(opts.ordnance | 0, 0, SGD.ORDNANCE.length - 1) : 0;
    const robe = SGD.ROBES ? clamp(opts.robe | 0, 0, SGD.ROBES.length - 1) : 0;
    const vest = SGD.VESTS ? clamp(opts.vest | 0, 0, SGD.VESTS.length - 1) : 0;
    const suit = SGD.SUITS ? clamp(opts.suit | 0, 0, SGD.SUITS.length - 1) : 0;
    const blade = SGD.BLADES ? clamp(opts.blade | 0, 0, SGD.BLADES.length - 1) : 0;
    const shield = SGD.SHIELDS ? clamp(opts.shield | 0, 0, SGD.SHIELDS.length - 1) : 0;
    const key = 'i|' + faction + '|' + type + '|' + evo + '|' + weapon + '|' + armor + '|' + ranged + '|' + staff
      + '|' + ordnance + '|' + robe + '|' + vest + '|' + suit + '|' + blade + '|' + shield + '|' + size;
    let cv = cache.get(key);
    if (cv) return cv;

    const frame = getUnitFrames({ faction, type, evo, weapon, armor, ranged, staff, ordnance, robe, vest, suit, blade, shield })[0];
    cv = mk(size, size);
    const g = cv.getContext('2d');
    // §5 : le modèle 3D est déjà de FACE — pas de rotation, on recadre juste
    // la frame 0 (128px) dans la taille demandée avec un léger zoom.
    const k = size / 108;
    g.translate(size / 2, size / 2);
    g.scale(k, k);
    g.drawImage(frame, -US / 2, -US / 2);
    cache.set(key, cv);
    return cv;
  }


  // direction (yaw) pré-rendue pour un angle de déplacement de bataille.
  // Repère : mvt vers le bas de l'écran = face caméra (yaw 0), vers le haut = de dos.
  function dirForAngle(moveAngle) {
    // face caméra quand l'unité descend (+Y), profil droit quand elle va à droite (+X),
    // de dos quand elle monte. Repère écran (Y vers le bas).
    const yaw = Math.PI / 2 - (moveAngle || 0);
    return ((Math.round(yaw / TAU * UNIT_DIRS) % UNIT_DIRS) + UNIT_DIRS) % UNIT_DIRS;
  }

