/* ============================================================
   GRIFFES & PLUMES — ui-general.js
   L'ONGLET DU GÉNÉRAL — LA DESCENTE INFINIE :
     1. 🏕️ L'arène (canvas + portraits + postures)
     2. 🎖️ La compagnie (roster, équipement, talents)
     3. ⛏️ La descente (progression, checkpoint, bouton Descendre)
   ============================================================ */
"use strict";

  // ---------- portraits ----------
  function genPortraitCanvas(spec, size) {
    size = size || 54;
    const s = GameState.state;
    const cv = document.createElement('canvas');
    const dpr = 2;
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const r = size / 2;
    g.save();
    g.beginPath(); g.arc(r, r, r - 1.5, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = spec.tint || '#8a6a44'; g.stroke();
    g.clip();
    try {
      const icon = Sprites.getUnitIcon({ faction: s.faction, type: spec.base, evo: spec.evo || 0, weapon: s.weaponTier, armor: s.armorTier }, Math.round(size * 0.92));
      if (icon) g.drawImage(icon, r - size * 0.46, r - size * 0.5, size * 0.92, size * 0.92);
    } catch (e) { }
    g.restore();
    if (spec.icon) {
      g.font = '900 ' + Math.round(size * 0.28) + 'px Nunito, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = spec.tint || '#5a4632';
      g.beginPath(); g.arc(size - r * 0.34, size - r * 0.34, size * 0.17, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f8f2e4';
      g.fillText(spec.icon, size - r * 0.34, size - r * 0.32);
    }
    return cv;
  }
  // LES PIÈCES D'ÉQUIPEMENT SONT DESSINÉES, plus des emoji : le même 🗡️ servait
  // pour une épée commune de tier 1 et pour une légendaire de tier 20, et son
  // rendu changeait d'une machine à l'autre. Chaque famille a son dessin, et la
  // rareté en teinte le métal (cf. drawItemArt dans adventure.js).
  function fillGenItems(root) {
    if (!root || !root.querySelectorAll) return;
    const AV = window.Adventure && Adventure.preview;
    if (!AV || !AV.item) return;
    root.querySelectorAll('[data-genitem]').forEach(slot => {
      if (slot.dataset.filled) return;
      const part = String(slot.dataset.genitem).split('|');
      const size = parseInt(slot.dataset.gensize || '30', 10);
      try {
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        cv.style.width = cv.style.height = size + 'px';
        if (!AV.item(cv.getContext('2d'), part[0], size, part[1])) return;
        slot.textContent = '';
        slot.appendChild(cv);
        slot.dataset.filled = '1';
      } catch (e) { }
    });
  }
  function fillGenPortraits(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-genpor]').forEach(slot => {
      if (slot.dataset.filled) return;
      const id = slot.dataset.genpor;
      const size = parseInt(slot.dataset.gensize || '54', 10);
      let spec;
      if (id === '__general') {
        spec = { base: 'heros', tint: '#c9a24a', icon: '🎖️' };
      } else {
        const h = UGD.heroById(id);
        if (!h) return;
        spec = { base: h.base, tint: h.tint, icon: h.icon };
      }
      try { slot.textContent = ''; slot.appendChild(genPortraitCanvas(spec, size)); slot.dataset.filled = '1'; } catch (e) { }
    });
  }

  // ---------- petits formats ----------
  function genItemName(it) {
    if (!it) return '—';
    const s = GameState.state;
    const base = UGD.baseById(it.base);
    const nm = base ? (base[s.faction] || base.cats) : '?';
    return (base ? base.icon + ' ' : '') + nm;
  }
  // la rareté d'une pièce : couleur, nom, nombre de lignes
  function genRarity(it) { return UGD.rarityById(it && it.rarity); }
  // « Plaque · T7 · Rare » — de quoi juger une pièce d'un coup d'œil
  function genItemSub(it) {
    if (!it) return '';
    const base = UGD.baseById(it.base);
    const fam = base && base.fam ? UGD.famOf(base.fam) : null;
    const R = genRarity(it);
    const f = GameState.state.faction;
    return (fam ? (fam.name[f] || fam.name.cats) + ' · ' : '') + 'T' + it.tier + ' · ' + R.name;
  }
  function genItemStats(it) {
    const out = {};
    if (!it) return out;
    const base = UGD.baseById(it.base);
    if (base) out[base.stat] = (out[base.stat] || 0) + (it.power || 0);
    for (const L of (it.lines || [])) {
      const def = UGD.lineById(L.id);
      if (def && UGD.GEN_STATS[def.stat]) out[def.stat] = (out[def.stat] || 0) + L.val;
    }
    return out;
  }
  function genStatBits(it, sep) {
    const st = genItemStats(it);
    const bits = [];
    for (const k of UGD.GEN_STAT_ORDER) {
      if (!st[k]) continue;
      const d = UGD.GEN_STATS[k];
      const v = st[k] > 0 ? '+' + UGD.genStatFmt(k, st[k]) : UGD.genStatFmt(k, st[k]);
      bits.push(`<i class="${st[k] < 0 ? 'bad' : ''}">${d.icon} ${v}</i>`);
    }
    return bits.join(sep || ' ');
  }
  // LA RARETÉ SE VOIT PARTOUT OÙ LA PIÈCE SE MONTRE. Une couleur en ligne sur
  // le libellé : `.gn-it i` (le stat-bit) garde la sienne, une règle sur
  // l'élément battant toujours une couleur héritée du parent.
  function genItemLine(it) {
    if (!it) return '<span class="muted">vide</span>';
    const R = genRarity(it);
    return `<span class="gn-it" style="color:${R.col}">T${it.tier} ${genItemName(it)} ${genStatBits(it)}</span>`;
  }
  function genHeroName(h) { return h.name[GameState.state.faction] || h.name.cats; }

  // ---------- zone 1 : le Général & la compagnie ----------
  // L'ACCÈS À UN ARBRE, ÉCRIT UNE SEULE FOIS.
  //
  // Le bouton du Général existait mais personne ne le trouvait : classe
  // `.gh-tal`, donc `position:absolute` — or ses ancêtres (`.gn-head`, `.card`)
  // ne sont PAS positionnés, si bien qu'il se posait à 3 px du coin haut-droit
  // de l'ÉCRAN (mesuré : x = 1226 sur 1280), hors de sa carte, sous le bouton
  // doré, en 51 × 27 px à 0,7 d'opacité et pour tout libellé un émoji seul.
  // Trois formats, une seule fonction et trois points d'appel :
  //   'plein' → le bouton doré du Général, libellé en clair ;
  //   'bar'   → le rappel dans la barre d'actions de la compagnie ;
  //   'coin'  → la pastille d'angle d'une tuile de compagnon (là, ça marche :
  //             `.gn-hero` est positionné).
  function genTalentBtnHtml(id, pts, format) {
    const gen = id === '__general';
    const badge = pts > 0 ? ' <b class="tp-avail">' + pts + '</b>' : '';
    const tip = escTip((gen
      ? 'Arbre de commandement|Ses nœuds profitent à TOUTE la compagnie.'
      : 'Arbre de talents|Les nœuds de ce compagnon.')
      + (pts > 0 ? '|' + pts + ' point(s) à dépenser' : '|aucun point à dépenser'));
    if (format === 'coin') {
      return `<button class="btn ghost gh-tal ${pts > 0 ? 'has' : ''}" data-gentalent="${id}"
        data-tip="${tip}">🌳${badge}</button>`;
    }
    if (format === 'bar') {
      return `<button class="btn ghost gn-talbtn ${pts > 0 ? 'has' : ''}" data-gentalent="${id}"
        data-tip="${tip}">🌳 Arbre du Général${badge}</button>`;
    }
    return `<button class="btn gold gn-talbtn ${pts > 0 ? 'has' : ''}" data-gentalent="${id}"
      data-tip="${tip}">🌳 Arbre${badge}</button>`;
  }
  function genHeaderHtml(g) {
    const st = GameState.generalStats();
    // LE GÉNÉRAL A UN ARBRE, comme n'importe quel héros. Son bouton ne pouvait
    // pas exister avant : il était émis dans la boucle sur `g.roster`, où le
    // Général n'est pas — il EST l'objet qui contient ce roster.
    const ptsGen = GameState.talentPts ? GameState.talentPts('__general') : 0;
    const puiss = GameState.talentPower
      ? GameState.talentPower().toFixed(2).replace('.', ',') : '1,00';
    const s = GameState.state;
    const chief = (UGD.FACTIONS[s.faction] && UGD.FACTIONS[s.faction].chief) || 'Le Général';
    const need = UGD.GENERAL.xpFor(g.lvl);
    const pct = Math.min(100, Math.round((g.xp / Math.max(1, need)) * 100));
    let stats = '';
    for (const k of UGD.GEN_STAT_ORDER) {
      const d = UGD.GEN_STATS[k];
      stats += `<span class="gn-stat" title="${d.name} — ${d.desc}">${d.icon} <b>${st[k]}</b></span>`;
    }
    return `<div class="gn-head">
      <span class="gn-por" data-genpor="__general" data-gensize="64"></span>
      <div class="gn-id">
        <div class="gn-name">${chief} <span class="gn-lvl">niv. ${g.lvl}</span></div>
        <div class="gn-stats">${stats}</div>
        <div class="gn-xp"><div class="wick-bar"><i style="--p:${(pct / 100).toFixed(3)}"></i></div>
          <span class="muted">${pct} % vers le niveau ${g.lvl + 1}</span></div>
      </div>
      <div class="gn-actions">
        <button class="btn gold gn-eqbtn" id="gen-equip">🎒 Équiper</button>
        ${genTalentBtnHtml('__general', ptsGen, 'plein')}
      </div>
      <div class="gn-puiss" data-tip="Puissance de la compagnie|Ce que vos talents et vos pouvoirs ajoutent au calcul hors écran.|Sans ce chiffre, six heures d’arbre n’auraient aucun témoin en mode automatique.">⚡ puissance de la compagnie <b>×${puiss}</b></div>
    </div>`;
  }
  function genRosterHtml(g) {
    const max = GameState.generalPartyMax();
    let tiles = '';
    for (const hs of g.roster) {
      const def = UGD.heroById(hs.id);
      if (!def) continue;
      const cls = UGD.HERO_CLASSES[def.cls];
      const inParty = g.party.indexOf(hs.id) >= 0;
      const hurt = GameState.heroHurt(hs.id);
      const left = hurt ? (hs.hurtUntil - Date.now()) / 1000 : 0;
      const pts = hs.talentPts || 0;
      tiles += `<div class="gn-hero ${inParty ? 'on' : ''} ${hurt ? 'hurt' : ''}" data-genhero="${hs.id}">
        <span class="gh-por" data-genpor="${hs.id}" data-gensize="46"></span>
        <span class="gh-nm">${genHeroName(def)}</span>
        <span class="gh-cl">${cls.icon} ${cls.name} · niv. ${hs.lvl || 1}${pts > 0 ? ' · <b class="tp-avail">' + pts + ' PT</b>' : ''}</span>
        <span class="gh-st">${hurt ? '<span class="gh-hurt">🩹 ' + UI.fmtTime(left) + '</span>'
          : inParty ? '<span class="gh-in">✅ du voyage</span>' : '<span class="muted">au camp</span>'}</span>
        ${genTalentBtnHtml(hs.id, pts, 'coin')}
      </div>`;
    }
    if (!g.roster.length) tiles = `<p class="muted" style="grid-column:1/-1;text-align:center">Aucun compagnon. On en trouve dans les profondeurs.</p>`;
    return `<div class="dj-sep"><span>🤝 La compagnie — ${g.party.length}/${max} au départ</span></div>
      <div class="gn-roster">${tiles}</div>`;
  }

  // ---------- zone 2 : la descente EN COURS ----------
  // Quand la compagnie est au camp, cette zone n'existe pas : il n'y a rien à
  // y dire que la scène ne dise déjà (le bouton porte l'action, le bandeau
  // porte les chiffres). Une carte vide qui prend un tiers de l'écran pour
  // répéter « cliquez sur le bouton », c'est de la place volée.
  // PAS DE BOUTONS DE PILOTAGE ICI. « 🤖 Auto » et « 🏳️ Remonter » vivent dans
  // l'en-tête de la carte d'arène (`.bld-ctl`, plus bas dans renderGeneral).
  // Cette carte-ci les redessinait en réutilisant les MÊMES identifiants
  // (gen-auto / gen-abort) : deux nœuds pour un seul id, et `querySelector` ne
  // rend que le premier. La seconde paire n'était donc branchée sur rien — on
  // cliquait « Remonter » et il ne se passait rien. Un doublon d'identifiant
  // est un bouton mort SILENCIEUX. (Verrouillé par dev/smoke-d17-ui.js.)
  function genDescentHtml(g) {
    const d = g.descent;
    if (!d) return '';
    const biome = UGD.dungeonBiome(d.floor);
    const kind = UGD.roomKind(d.roomType);
    let jour = '';
    for (const e of d.log.slice(-5)) {
      jour += `<div class="gm-line ${e.ok === false ? 'ko' : 'ok'}"><span class="gl-ic">${e.icon}</span>
        <span class="gl-tx"><b>${e.name}</b> — ${e.txt || ''}</span></div>`;
    }
    return `<div class="gn-descent">
      <div class="gd-top">
        <span class="gd-biome">${biome.icon} <b>${biome.name[GameState.state.faction] || biome.name.cats}</b></span>
        <span class="gd-floor">Étage <b>${d.floor}</b></span>
        <span class="gd-cp muted">💾 Checkpoint : ${d.checkpoint}</span>
        <span class="gd-kind">${kind.icon} ${kind.name}</span>
      </div>
      <div class="gm-journal">${jour || '<span class="muted">La compagnie entre dans le donjon…</span>'}</div>
    </div>`;
  }

  // ---------- L'ARÈNE ----------
  // Posture IA : petits boutons colorés (pas un menu déroulant)
  const STANCE_COLS = ['#c0563e', '#4a7fb0', '#3f9b6a', '#7a52c0'];
  function genStanceSelect(p) {
    if (!p || !p.cls) return '';
    const stances = UGD.stancesFor(p.cls === 'general' ? 'general' : p.cls);
    const cur = p.stance || stances[0].id;
    let btns = '';
    stances.forEach((st, i) => {
      const on = st.id === cur;
      const col = STANCE_COLS[i % STANCE_COLS.length];
      btns += `<button class="st-btn ${on ? 'on' : ''}" data-avstance="${p.id}" data-stance="${st.id}"
        style="${on ? 'background:' + col + ';border-color:' + col + ';color:#fff;' : 'border-color:' + col + ';color:' + col + ';'}"
        title="${st.name} — ${st.desc}">${st.icon}</button>`;
    });
    return `<div class="st-row">${btns}</div>`;
  }
  function genPortCardHtml(p) {
    if (!p) return '<div class="av-port empty"></div>';
    const pct = Math.max(0, Math.min(100, Math.round((p.hp / Math.max(1, p.hpMax)) * 100)));
    // LA PANOPLIE, EN BOUTONS RONDS À JAUGE. Un personnage porte jusqu'à cinq
    // pouvoirs : une carte pleine largeur par pouvoir ne tiendrait pas dans une
    // colonne de 170 px face à une arène de 442. Des disques de 24 px, trois par
    // ligne, dont l'anneau se remplit — c'est le « le cri se remplit » demandé.
    //
    // `.attend` répond à la frustration n°1 du mode automatique : jauge pleine
    // et rien qui part. Le moteur dit POURQUOI (`motif`), l'infobulle le répète.
    // Sans ces trois mots, le joueur lit un bug là où il y a une règle.
    let pws = '';
    for (const pw of (p.pouvoirs || [])) {
      const cls = ['av-pw'];
      if (!pw.pret) cls.push('cd');
      if (pw.pret && pw.motif) cls.push('attend');
      pws += `<button class="${cls.join(' ')}" data-avcast="${p.id}|${pw.i}"
        data-wick="pouvoir:${p.id}~${pw.id}" style="--p:${pw.ratio.toFixed(3)}"
        data-tip="${escTip(pw.name)}|${escTip(pw.txt || '')}|${pw.pret
          ? (pw.motif ? 'prêt — mais il ' + escTip(pw.motif) : 'prêt')
          : 'recharge : ' + Math.ceil(pw.cd) + ' s'}"
        ${pw.pret ? '' : 'disabled'}><span class="pw-ic">${pw.icon}</span>${pw.pret
          ? '' : `<span class="pw-cd">${Math.ceil(pw.cd)}</span>`}</button>`;
    }
    if (pws) pws = '<span class="av-pws">' + pws + '</span>';
    return `<div class="av-port ${p.sel ? 'sel' : ''} ${p.dead ? 'dead' : ''}" data-avsel="${p.id}">
      <span class="ap-por" data-genpor="${p.id}" data-gensize="46"></span>
      <span class="ap-nm">${p.name}</span>
      <span class="ap-hp"><i style="width:${pct}%"></i></span>
      <span class="ap-n">${p.hp}/${p.hpMax}</span>
      ${genStanceSelect(p)}
      ${pws}
    </div>`;
  }
  function genArenaHtml(g) {
    const snap = window.Adventure && Adventure.active() ? Adventure.snapshot() : null;
    const d = g.descent;
    const kind = d ? UGD.roomKind(d.roomType) : { icon: '🏕️', name: 'Le camp', desc: 'on affûte, on souffle' };
    const party = snap ? snap.party : [];
    // CINQ UNITÉS, CINQ CARTES. `GENERAL.partySize` rend 4 compagnons dès le
    // niveau 18 : avec le Général cela fait cinq, et la découpe en deux paires
    // en laissait un SANS carte — donc sans portrait, sans posture et sans un
    // seul bouton de pouvoir. On répartit au prorata, trois par colonne au plus.
    const mid = Math.ceil(party.length / 2);
    const left = party.slice(0, Math.min(mid, 3)), right = party.slice(Math.min(mid, 3), 6);
    const auto = GameState.advAuto();
    return `<div class="av-wrap">
      <div class="av-head">${kind.icon} <b>${kind.name}</b>
        <span class="muted">— ${kind.desc}${snap && snap.phase === 'fight'
          ? ' · vague ' + snap.waveNum + '/' + snap.waveTotal
            + (snap.waveTheme ? ' (' + snap.waveTheme + ')' : '')
            + ' · ' + snap.foes + '/' + snap.foesTotal + ' ennemi(s)'
            + (snap.trophee ? ' · 🎯 ' + (snap.trophee.etat === 'abattu' ? 'trophée abattu !'
              : snap.trophee.etat === 'echappe' ? 'le trophée a filé…'
              : 'trophée en fuite (' + snap.trophee.hp + ' PV)') : '')
          : ''}</span></div>
      <div class="av-main">
        <div class="av-side">${left.map(genPortCardHtml).join('')}</div>
        <div class="av-stage"><canvas id="av-canvas"></canvas></div>
        <div class="av-side">${right.map(genPortCardHtml).join('')}</div>
      </div>
      <p class="muted dj-note av-help">${auto
        ? 'En <b>🤖 auto</b>, l\'IA se bat selon les postures. Passez en <b>🎮 manuel</b> pour commander.'
        : 'Clic <b>unité</b> = sélectionner · clic <b>sol</b> = déplacer · clic <b>ennemi</b> = attaquer · clic droit = ordre · clic sur un <b>pouvoir</b> = le lancer'}</p>
    </div>`;
  }

  // ---------- bind arena ----------
  function bindArena(page) {
    if (!window.Adventure) return;
    if (!GameState.gen().descent && !Adventure.active()) {
      try { Adventure.beginCamp('tour'); } catch (e) { }
    }
    // Le bouton dessiné sous la tour ET la tour elle-même mènent ici
    // (cf. Adventure.clickAt, branche « camp »).
    // UNE SEULE ACTION AU CAMP, qui suit l'état : tant qu'un butin attend, le
    // bouton l'encaisse ; ensuite il fait repartir la compagnie. C'est le même
    // bouton dessiné sous la tour, il change juste de visage.
    const entrer = () => {
      if (GameState.gen().report) {
        const r = GameState.claimReport();
        if (r) { FX.sfx('coin'); genReportPopup(r); dirty = true; }
        else FX.sfx('error');
        return;
      }
      if (GameState.startDescent()) {
        FX.sfx('build');
        UI.toast('⛏️ La compagnie entre dans le donjon.', { icon: '⛏️', cls: 'good' });
        dirty = true;
      } else FX.sfx('error');
    };
    Adventure.setOnTowerClick(entrer);
    const cv = page.querySelector('#av-canvas');
    if (cv && Adventure.active()) {
      Adventure.attach(cv);
      let downPos = null, downTime = 0;
      cv.addEventListener('pointerdown', e => {
        const r = cv.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        if (e.button === 2) { Adventure.rightClick(x, y); dirty = true; return; }
        downPos = { x, y }; downTime = Date.now();
      });
      cv.addEventListener('pointermove', e => {
        const r = cv.getBoundingClientRect();
        Adventure.hoverAt(e.clientX - r.left, e.clientY - r.top);
        // le curseur dit que le bouton du camp est cliquable
        cv.style.cursor = (Adventure.campHot && Adventure.campHot()) ? 'pointer' : '';
        if (downPos && Date.now() - downTime > 180) {
          // drag = box select
          if (!dragActive) { dragActive = true; }
        }
      });
      cv.addEventListener('pointerup', e => {
        const r = cv.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        if (downPos && dragActive && Math.hypot(x - downPos.x, y - downPos.y) > 15) {
          Adventure.boxSelect(downPos.x, downPos.y, x, y);
        } else if (downPos) {
          Adventure.clickAt(x, y, e.shiftKey);
        }
        downPos = null; dragActive = false;
        dirty = true;
      });
      cv.addEventListener('contextmenu', e => { e.preventDefault(); });
    }
    let dragActive = false;
    page.querySelectorAll('[data-avsel]').forEach(b => b.addEventListener('click', ev => {
      Adventure.select(b.dataset.avsel, ev.shiftKey);
      FX.sfx('click'); dirty = true;
    }));
    page.querySelectorAll('[data-avcast]').forEach(b => b.addEventListener('click', () => {
      // « id|index » : il faut dire QUEL pouvoir, un personnage en porte cinq.
      const deux = String(b.dataset.avcast).split('|');
      const id = deux[0], i = deux.length > 1 ? (parseInt(deux[1], 10) || 0) : 0;
      Adventure.select(id, false);
      if (Adventure.castAbility(id, i)) { if (Adventure.aiming()) UI.toast('🎯 Cliquez l\'endroit à viser.', { icon: '🎯' }); dirty = true; }
      else FX.sfx('error');
    }));
    page.querySelectorAll('[data-avstance]').forEach(btn => btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const heroId = btn.dataset.avstance;
      const stanceId = btn.dataset.stance;
      if (GameState.setHeroStance(heroId, stanceId)) {
        FX.sfx('click'); dirty = true;
      }
    }));
  }

  // ---------- TALENT TREE POPUP (arbre façon Diablo) ----------
  // Layout : racine en haut au centre, 5 branches qui s'éventent vers le bas,
  // nœuds reliés par des lignes SVG. Pas des colonnes : un vrai arbre.
  // L'ARBRE DE TALENTS.
  //
  // Il était posé en pixels absolus dans un cadre de 720 × 560, ce qui le
  // rognait sur toute fenêtre plus étroite. Il est maintenant en `viewBox` :
  // le SVG se met à l'échelle, et les nœuds suivent en pourcentage.
  //
  // Et surtout il MONTRE le choix : les cinq branches ordinaires en éventail,
  // puis les DEUX VOIES exclusives en bas. Prendre l'une ferme l'autre — on le
  // voit, au lieu de le découvrir en cliquant.
  const TT_W = 760, TT_H = 620;
  function ttRefusTxt(code, spec) {
    switch (code) {
      case 'deja': return 'déjà pris';
      case 'points': return 'pas assez de points';
      case 'prerequis': return 'il faut le nœud précédent';
      case 'tropTot': return 'il faut d’abord engager ' + UGD.TALENT_SPEC_AT + ' points dans les branches';
      case 'autrevoie': return 'vous avez choisi l’autre voie' + (spec ? ' (' + spec.name + ')' : '');
      // LES GROUPES D'EXCLUSION : prendre un nœud en ferme d'autres. Le joueur
      // doit LIRE lequel — un nœud grisé sans explication ressemble à un bug.
      case 'exclu': return 'fermé par : ' + (spec && spec.name ? spec.name : 'un autre choix');
      case 'amont': return 'en aval d’un nœud fermé';
      default: return '';
    }
  }
  function genTalentPopup(heroId) {
    // LE PORTEUR, ET NON « LE HÉROS ». C'est ici que l'arbre du Général était
    // fermé : la fonction cherchait sa fiche dans le roster (`heroState`) et
    // dans la table des héros (`heroById`), deux endroits où il n'est pas — il
    // EST l'objet qui contient le roster. Ses 25 nœuds existaient, écrits pour
    // lui, et aucun chemin de l'écran n'y menait. `talentOwner` résout les deux
    // cas d'un coup.
    const o = GameState.talentOwner ? GameState.talentOwner(heroId) : null;
    if (!o) return;
    const cls = o.cls, def = o.def;
    const tree = UGD.talentTree(cls);
    if (!tree) return;
    const clsDef = UGD.HERO_CLASSES[cls] || { icon: '🎖️', name: 'Commandement' };
    const pts = GameState.talentPts ? GameState.talentPts(heroId) : 0;
    // TABLEAU PLAT : l'arbre était `{ branche: [ids] }`, deux structures pour
    // une seule liste. Un `indexOf` remplace la double boucle.
    const talents = Array.isArray(o.holder.talents) ? o.holder.talents : [];
    const voieChoisie = GameState.heroSpec ? GameState.heroSpec(heroId) : null;
    const engages = GameState.talentSpent ? GameState.talentSpent(heroId) : 0;
    const portes = GameState.heroPowerIds ? GameState.heroPowerIds(heroId) : [];

    const rootX = TT_W / 2, rootY = 40;
    let lines = '';
    let nodes = '';
    const pris = id => talents.indexOf(id) >= 0;
    // un nœud, quelle que soit sa famille
    const poser = (node, x, y, prev, clsSup) => {
      const owned = pris(node.id);
      const refus = GameState.talentRefusCode ? GameState.talentRefusCode(heroId, node.id) : null;
      const cout = UGD.talentCostOf(cls, node.id);
      const col = owned ? '#ffcc3d' : (!refus ? 'rgba(255,204,61,0.45)' : 'rgba(255,255,255,0.14)');
      lines += `<line x1="${prev.x}" y1="${prev.y}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="${owned ? 3 : 2}"/>`;
      // UN NŒUD-POUVOIR SE VOIT. C'est ce que le joueur vient chercher : sa
      // recharge est écrite dessous, et il porte l'anneau doré.
      const pid = (node.effect && node.effect.kind === 'power') ? node.effect.power : null;
      const pdef = pid && UGD.powerById ? UGD.powerById(pid) : null;
      const bits = [node.name, node.desc, 'Coût=' + cout + ' point' + (cout > 1 ? 's' : '')];
      if (pdef) bits.push('Pouvoir=' + pdef.icon + ' ' + pdef.name + ' · ' + Math.round(pdef.cd) + ' s');
      if (owned) bits.push('Acquis');
      else if (refus) {
        // ON NOMME CE QUI FERME. « Indisponible » tout court se lit comme un
        // bug ; « fermé par : Génie militaire » se lit comme une règle.
        const bloq = (refus === 'exclu' && GameState.talentBloqueur)
          ? GameState.talentBloqueur(heroId, node.id) : null;
        bits.push('Indisponible=' + ttRefusTxt(refus, bloq || voieChoisie));
        if (refus === 'exclu') bits.push('Cliquez pour BASCULER sur celui-ci');
      }
      const etat = owned ? 'owned' : (!refus ? 'avail' : 'locked');
      const marques = [etat, clsSup || ''];
      if (pdef) marques.push('ttn-pouv');
      if (refus === 'exclu') marques.push('exclu');
      else if (refus === 'amont') marques.push('amont');
      nodes += `<div class="ttn ${marques.join(' ')}" data-ttnode="${heroId}|${node.id}"
        style="left:${(x / TT_W * 100).toFixed(2)}%;top:${(y / TT_H * 100).toFixed(2)}%"
        data-tip="${bits.join('|').replace(/"/g, '&quot;')}">
        <span class="ttn-ic">${pdef ? pdef.icon : node.icon}</span><span class="ttn-nm">${node.name}</span>
        <span class="ttn-co">${cout}</span></div>`;
    };

    // --- les cinq branches ordinaires, en éventail ---
    tree.branches.forEach((br, i) => {
      const dir = i - 2;
      let prev = { x: rootX, y: rootY };
      br.nodes.forEach(node => {
        const x = rootX + dir * (30 + node.tier * 27);
        const y = rootY + node.tier * 66;
        poser(node, x, y, prev);
        prev = { x, y };
      });
      const last = br.nodes[br.nodes.length - 1];
      const lx = rootX + dir * (30 + last.tier * 27), ly = rootY + last.tier * 66;
      nodes += `<div class="ttn-label" style="left:${(lx / TT_W * 100).toFixed(2)}%;top:${((ly + 32) / TT_H * 100).toFixed(2)}%">${br.name}</div>`;
    });

    // --- LES DEUX VOIES, en bas : le choix qui décide de ce qu'est le héros ---
    const voies = UGD.talentSpecs(cls);
    const yVoie = rootY + 6 * 66 + 24;
    voies.forEach((sp, k) => {
      const cx = TT_W * (k === 0 ? 0.26 : 0.74);
      const ferme = !!voieChoisie && voieChoisie.id !== sp.id;
      nodes += `<div class="ttn-voie ${voieChoisie && voieChoisie.id === sp.id ? 'on' : ferme ? 'off' : ''}"
        style="left:${(cx / TT_W * 100).toFixed(2)}%;top:${(yVoie / TT_H * 100).toFixed(2)}%"
        data-tip="${(sp.name + '|' + sp.txt + (ferme ? '|Fermée : vous avez choisi ' + voieChoisie.name : '')).replace(/"/g, '&quot;')}">
        ${sp.icon} ${sp.name}</div>`;
      let prev = { x: cx, y: yVoie + 18 };
      sp.nodes.forEach(node => {
        poser(node, cx, yVoie + 22 + node.tier * 58, prev, 'spec' + (ferme ? ' barre' : ''));
        prev = { x: cx, y: yVoie + 22 + node.tier * 58 };
      });
    });

    nodes += `<div class="ttn root" style="left:50%;top:${(rootY / TT_H * 100).toFixed(2)}%">
      <span class="ttn-ic">${clsDef.icon}</span><span class="ttn-nm">${clsDef.name}</span></div>`;

    UI.popup({
      title: `Talents — ${def ? genHeroName(def) : ((UGD.FACTIONS[GameState.state.faction] || {}).chief || 'Le Général')} (${clsDef.name})`,
      wide: true,
      html: `<div class="tt-head">
          <span>Points : <b class="tp-avail">${pts}</b></span>
          <span class="muted">engagés : ${engages}</span>
          <span class="muted">pouvoirs : ${portes.length}/${UGD.POWER_SLOTS || 5}</span>
          <span class="muted">${voieChoisie ? 'voie : ' + voieChoisie.icon + ' ' + voieChoisie.name
            : 'voie à choisir à ' + UGD.TALENT_SPEC_AT + ' points engagés'}</span>
          <button class="btn ghost" id="tt-refund">Réinitialiser</button>
        </div>
        <div class="tt-legende muted">⬤ passif · ◆ pouvoir · ⊘ fermé par un autre choix (cliquez pour basculer)</div>
        ${portes.length ? '<div class="tt-portes">Pouvoirs acquis : ' + portes.map(id => {
          const d2 = UGD.powerById ? UGD.powerById(id) : null;
          return d2 ? d2.icon + ' <b>' + d2.name + '</b> <span class="muted">' + Math.round(d2.cd) + ' s</span>' : id;
        }).join(' · ') + '</div>' : ''}
        <div class="tt-wrap">
          <svg class="tt-svg" viewBox="0 0 ${TT_W} ${TT_H}" preserveAspectRatio="xMidYMin meet">${lines}</svg>
          ${nodes}
        </div>`,
      buttons: [{ label: 'Fermer', cls: 'ghost' }],
      onOpen: box => {
        box.querySelectorAll('[data-ttnode]').forEach(el => el.addEventListener('click', () => {
          const deux = el.dataset.ttnode.split('|');
          const hid = deux[0], nid = deux[1];
          if (GameState.spendTalent(hid, nid)) { FX.sfx('capture'); dirty = true; UI.closePopup(); genTalentPopup(hid); return; }
          const code = GameState.talentRefusCode ? GameState.talentRefusCode(hid, nid) : null;
          // UN CHOIX SE CHANGE. Un nœud fermé par un autre membre de son groupe
          // n'est pas un mur : cliquer dessus BASCULE. Sans ça, une erreur de
          // clic coûtait une réinitialisation complète de l'arbre.
          if (code === 'exclu' && GameState.basculeTalent) {
            // PAS DE FENÊTRE DE CONFIRMATION. Le projet en compte déjà cinquante
            // et cherche à en avoir moins de dix ; et surtout la bascule est
            // GRATUITE et réversible d'un clic — demander « êtes-vous sûr ? »
            // pour un geste sans conséquence, c'est du bruit. On bascule, et on
            // DIT ce qui vient de changer.
            const bloq = GameState.talentBloqueur ? GameState.talentBloqueur(hid, nid) : null;
            if (GameState.basculeTalent(hid, nid)) {
              FX.sfx('capture'); dirty = true;
              UI.toast('🌳 Choix changé : ' + ((bloq && bloq.name) || 'l’autre nœud')
                + ' rendu, ce nœud pris à la place.', { icon: '🌳', cls: 'good' });
              UI.closePopup(); genTalentPopup(hid);
            } else FX.sfx('error');
            return;
          }
          // ON DIT POURQUOI. Un clic sans effet et sans explication, c'est un
          // bug du point de vue du joueur.
          FX.sfx('error');
          if (code && code !== 'deja') {
            const bloq = (code === 'exclu' && GameState.talentBloqueur) ? GameState.talentBloqueur(hid, nid) : null;
            UI.toast(ttRefusTxt(code, bloq || GameState.heroSpec(hid)), { icon: '🌳' });
          }
        }));
        const ref = box.querySelector('#tt-refund');
        if (ref) ref.addEventListener('click', () => {
          if (GameState.refundTalents(heroId)) { FX.sfx('click'); dirty = true; UI.closePopup(); genTalentPopup(heroId); }
        });
      },
    });
  }

  // ---------- equipment popup ----------
  let invSel = -1;
  // LES SEPT EMPLACEMENTS DU MOTEUR, ENFIN TOUS DESSINÉS. L'écran n'en montrait
  // que six : le BOUCLIER manquait. Or il existe en données (`GENERAL.slots`),
  // il tombe au butin comme les autres (`rollItem` tire uniformément dans
  // `ITEM_BASES`, soit ≈ 3 % des pièces) et `GameState.equipRefus` sait déjà
  // l'arbitrer (classe + arme à deux mains). Résultat : une pièce sur trente
  // encombrait le coffre À VIE, sans le moindre moyen de la porter ni de
  // comprendre pourquoi. C'est le piège « données plus riches que le moteur »,
  // à l'envers : ici c'est l'ÉCRAN qui était en retard sur les deux autres.
  // Gauche = ce qu'on enfile, droite = ce qu'on tient.
  const EQ_LEFT = ['casque', 'armure', 'gants', 'bottes'];
  const EQ_RIGHT = ['arme', 'bouclier', 'bijou'];
  // LE TRI PAR CLASSE ET LE PORTEUR DE RÉFÉRENCE, mémorisés le temps de la
  // session : on rouvre le coffre là où on l'avait laissé. `genInvCls` vaut
  // `undefined` tant qu'on n'a rien choisi (on prend alors la classe du porteur
  // sélectionné), `null` pour « tout », un id de classe sinon.
  let genInvCls;
  let genInvWho = '__general';

  // stats complètes d'un objet (principale + suffixe + affixes) pour le tooltip
  // Les LIGNES d'une pièce : la première vient de sa famille, les autres de sa
  // rareté (1 ligne pour un commun, 5 pour un légendaire).
  function genItemFullStats(it) {
    const lines = [];
    if (!it) return lines;
    const base = UGD.baseById(it.base);
    if (base) {
      const S = UGD.GEN_STATS[base.stat];
      lines.push({ icon: S ? S.icon : '✚', main: 1, stat: base.stat, val: it.power || 0,
                   txt: '+' + UGD.genStatFmt(base.stat, it.power || 0) + ' ' + (S ? S.name : base.stat) });
    }
    for (const L of (it.lines || [])) {
      const def = UGD.lineById(L.id);
      if (!def) continue;
      const S = UGD.GEN_STATS[def.stat];
      lines.push({ icon: def.icon, val: L.val,
                   stat: S ? def.stat : null, affix: S ? null : def.stat,
                   txt: S ? '+' + UGD.genStatFmt(def.stat, L.val) + ' ' + S.name : UGD.lineFmt(def, L.val) });
    }
    return lines;
  }
  // tooltip HTML avec comparaison à la pièce actuellement équipée
  // `porteur` = le nom du porteur de référence. Il change le PIED de l'infobulle :
  // avec lui on nomme la pièce comparée, et surtout on dit « emplacement libre »
  // quand il n'y a rien en face — sinon une pièce sans concurrente s'affiche
  // exactement comme une pièce jamais comparée, et le joueur ne sait pas s'il
  // regarde une comparaison ou un simple descriptif.
  function genItemTooltipHtml(it, current, porteur) {
    const base = UGD.baseById(it.base);
    const nm = base ? (base[GameState.state.faction] || base.cats) : '?';
    const R = genRarity(it);
    let h = `<div class="tip-h" style="color:${R.col}">${base ? base.icon : '🎒'} <b>${nm}</b> <span class="tip-tier">T${it.tier}</span></div>`;
    h += `<div class="tip-slot muted">${UGD.GENERAL.slotName[it.slot] || it.slot} · ${genItemSub(it)}</div>`;
    const lines = genItemFullStats(it);
    const curLines = current ? genItemFullStats(current) : [];
    let hausses = 0;
    for (const ln of lines) {
      // LA COMPARAISON TIENT EN UN SIGNE. L'ancienne version écrivait le delta
      // chiffré entre parenthèses sur CHAQUE ligne, en vert ou en rouge : cinq
      // lignes de stats devenaient dix nombres, et on ne voyait plus l'objet.
      // La règle est maintenant celle d'un regard : une petite flèche VERTE si
      // la ligne est meilleure que la pièce portée, RIEN si elle est moins
      // bonne — l'absence se lit aussi vite que le signe, sans peindre
      // l'infobulle en rouge.
      // AUCUN `title=` sur ces flèches : il serait mort à l'écran (`.item-tip`
      // porte `pointer-events: none`, le natif ne se déclenche jamais) et la
      // règle du projet l'interdit pour du texte joueur. La légende est écrite
      // EN CLAIR au pied de l'infobulle, quelques lignes plus bas.
      const cur = curLines.find(c => (c.stat && c.stat === ln.stat) || (c.affix && c.affix === ln.affix));
      let cmp = '';
      if (cur) {
        const d = ln.val - cur.val;
        if (d > 0.001) { cmp = ' <span class="tip-up">▲</span>'; hausses++; }
      } else if (current) {
        cmp = ' <span class="tip-up">▲</span>'; hausses++;
      }
      h += `<div class="tip-ln">${ln.icon} ${ln.txt}${cmp}</div>`;
    }
    let pied = '';
    if (current) {
      const RC = genRarity(current);
      pied = 'Actuel' + (porteur ? ' — ' + porteur : '') + ' : <span style="color:' + RC.col + '">'
        + genItemName(current) + ' T' + current.tier + '</span>';
    } else if (porteur) {
      pied = porteur + ' : <b>emplacement libre</b>';
    }
    if (hausses) pied += (pied ? '<br>' : '') + '▲ = meilleur que ce qui est porté';
    if (pied) h += `<div class="tip-cur muted">${pied}</div>`;
    return h;
  }
  // l'infobulle d'un bouton de tri : « Guerrier / 15 pièces sur 111 / … »
  function genInvTipHtml(txt) {
    const p = String(txt == null ? '' : txt).split('|');
    let h = `<div class="tip-h">${p[0] || ''}</div>`;
    for (let i = 1; i < p.length; i++) if (p[i]) h += `<div class="tip-ln muted">${p[i]}</div>`;
    return h;
  }
  // gestion du tooltip flottant
  let tipEl = null;
  function showTip(html, x, y) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'item-tip';
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    const r = tipEl.getBoundingClientRect();
    let lx = x + 14, ly = y + 14;
    if (lx + r.width > window.innerWidth - 8) lx = x - r.width - 14;
    if (ly + r.height > window.innerHeight - 8) ly = y - r.height - 14;
    tipEl.style.left = lx + 'px'; tipEl.style.top = ly + 'px';
  }
  function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

  // UNE PIÈCE PORTÉE GARDE SA COULEUR DE RARETÉ. Avant, `.eq-slot.on` peignait
  // tout le monde avec le même accent de faction : un commun de T1 et un
  // légendaire de T20 avaient exactement la même bordure, et l'information
  // qu'on venait de lire dans le coffre disparaissait au moment de l'équiper.
  // Le style est EN LIGNE (il bat les règles du damier sans `!important`), donc
  // le retour visuel de survol et de dépôt passe au `box-shadow` — cf. le bloc
  // ajouté en fin de style.css.
  // POURQUOI CET EMPLACEMENT EST GRIS. Un emplacement qu'on ne peut pas garnir
  // et qui ressemble à un emplacement vide, c'est un clic dans le vide répété
  // à chaque partie. Seul le bouclier est concerné : il dépend de la classe ET
  // de l'arme portée (une arme à deux mains le condamne), donc son état change
  // en cours de route — raison de plus pour le DIRE.
  function genSlotRefus(who, slot) {
    if (slot !== 'bouclier') return null;
    const cls = GameState.heroClassOf(who.id) || 'general';
    if (!UGD.gearOf(cls).bouclier) return 'Cette classe ne porte pas de bouclier.';
    if (UGD.armeDeuxMains((who.holder.gear || {}).arme)) return 'Son arme se tient à deux mains — la seconde main n’est pas libre.';
    return null;
  }
  function genEqSlotHtml(who, slot) {
    const it = (who.holder.gear || {})[slot];
    const R = it ? genRarity(it) : null;
    const refus = it ? null : genSlotRefus(who, slot);
    return `<div class="eq-slot ${it ? 'on rar' : ''} ${refus ? 'no' : ''}" data-eqslot="${who.id}|${slot}" data-tipitem="${who.id}|${slot}"${
      refus ? ' data-eqno="' + escTip(refus) + '"' : ''}${
      R ? ' style="border-color:' + R.col + ';--rar:' + R.col + '"' : ''}>
      <span class="eq-ic"${it ? ' data-genitem="' + it.base + '|' + it.rarity + '" data-gensize="26"' : ''}>${
        it ? '' : UGD.GENERAL.slotIcon[slot]}</span>
      <span class="eq-nm"${R ? ' style="color:' + R.col + '"' : ''}>${it ? 'T' + it.tier : UGD.GENERAL.slotName[slot]}</span></div>`;
  }
  // le CONTENU d'une fiche de porteur, séparé de son enveloppe : c'est lui
  // qu'on repeint après un équipement, sans toucher au nœud qui porte les
  // écouteurs ni à la position de défilement de la colonne.
  function genEqMemberInner(who) {
    return `<div class="eq-name">${who.icon} <b>${who.name}</b> <i class="muted">${who.role}</i></div>
      <div class="eq-body">
        <div class="eq-col">${EQ_LEFT.map(sl => genEqSlotHtml(who, sl)).join('')}</div>
        <div class="eq-sil" data-genpor="${who.id}" data-gensize="84"></div>
        <div class="eq-col">${EQ_RIGHT.map(sl => genEqSlotHtml(who, sl)).join('')}</div>
      </div>`;
  }
  function genEqMemberHtml(who, sel) {
    return `<div class="eq-member ${sel ? 'sel' : ''}" data-eqwho="${who.id}">${genEqMemberInner(who)}</div>`;
  }
  // TOUTE LA COMPAGNIE, pas seulement les partants. La liste ne parcourait que
  // `g.party` : un compagnon resté au camp était tout bonnement INÉQUIPABLE, il
  // fallait le faire partir pour lui donner une pièce puis le remettre au camp.
  // Les partants restent en tête, le reste suit, et le rôle le dit.
  function genEqRoster() {
    const g = GameState.gen();
    const out = [{ id: '__general', holder: g, base: g.stats, name: (UGD.FACTIONS[GameState.state.faction] || {}).chief || 'Le Général', icon: '🎖️', role: 'niveau ' + g.lvl }];
    const vus = {};
    const pousse = (hid, campe) => {
      if (vus[hid]) return;
      const def = UGD.heroById(hid);
      const hs = GameState.heroState(hid);
      if (!def || !hs) return;
      vus[hid] = 1;
      out.push({ id: hid, holder: hs, base: def.stats, name: genHeroName(def), icon: def.icon,
                 role: (UGD.HERO_CLASSES[def.cls] || {}).name + ' · niv. ' + (hs.lvl || 1) + (campe ? ' · au camp' : '') });
    };
    for (const hid of g.party) pousse(hid, false);
    for (const hs of (g.roster || [])) pousse(hs.id, true);
    return out;
  }
  // ---- LE TRI PAR CLASSE ----
  // On n'écrit AUCUNE règle d'équipement ici : `GameData.equipRefus(cls, item)`
  // est la seule autorité, et c'est une fonction PURE de (classe, base) — donc
  // la liste ne saute pas quand on change une arme. (`GameState.equipRefus`, la
  // variante qui teste aussi le deux-mains, dépend de l'équipement porté : elle
  // reste pour la TENTATIVE d'équipement, jamais pour le tri.)
  // Les index rendus sont les index RÉELS du sac : `GameState.equipItem` fait
  // `bag.splice` puis `bag.push`, tout ce qui suit glisse d'un cran.
  function genInvIdx() {
    const g = GameState.gen();
    const out = [];
    for (let i = 0; i < g.bag.length; i++) {
      const it = g.bag[i];
      if (!it) continue;
      if (genInvCls && UGD.equipRefus(genInvCls, it)) continue;
      out.push(i);
    }
    return out;
  }
  function genInvCountTxt() {
    const g = GameState.gen();
    const n = genInvIdx().length;
    return genInvCls ? n + ' pièce(s) sur ' + g.bag.length : g.bag.length + ' pièce(s)';
  }
  function genInvBagHtml() {
    const g = GameState.gen();
    const idx = genInvIdx();
    const cells = Math.max(24, Math.ceil((idx.length + 1) / 6) * 6);
    let grid = '';
    for (let k = 0; k < cells; k++) {
      const i = idx[k];
      if (i === undefined) { grid += '<div class="inv-cell empty"></div>'; continue; }
      const it = g.bag[i];
      const R = genRarity(it);
      // pas de `title=` : le natif surgissait une seconde après `.item-tip` et
      // par-dessus (et `title` n'existe pas sur tablette).
      grid += `<div class="inv-cell ${invSel === i ? 'sel' : ''}" data-invitem="${i}" draggable="true"
        style="border-color:${R.col}">
        <span class="ic-ic" data-genitem="${it.base}|${it.rarity}" data-gensize="30"></span>
        <span class="ic-t" style="color:${R.col}">T${it.tier}</span></div>`;
    }
    return grid;
  }
  function genInvFiltHtml(roster) {
    const g = GameState.gen();
    const ici = {};
    for (const w of roster) { const c = GameState.heroClassOf(w.id); if (c) ici[c] = 1; }
    let btns = `<button class="st-btn eq-fbtn ${genInvCls ? '' : 'on'}" data-invcls=""
      data-invtip="${escTip('Tout le coffre|' + g.bag.length + ' pièce(s), portables ou non')}">Tout</button>`;
    for (const cid in UGD.HERO_CLASSES) {
      const c = UGD.HERO_CLASSES[cid];
      let n = 0;
      for (const it of g.bag) if (it && !UGD.equipRefus(cid, it)) n++;
      btns += `<button class="st-btn eq-fbtn ${genInvCls === cid ? 'on' : ''} ${ici[cid] ? 'ici' : ''}"
        data-invcls="${cid}" data-invtip="${escTip(c.icon + ' ' + c.name + '|' + n + ' pièce(s) sur '
          + g.bag.length + ' à sa portée|' + (ici[cid] ? 'présent dans la compagnie' : 'personne de cette classe ici'))}"
        >${c.icon}</button>`;
    }
    return btns;
  }
  function genInventoryPopup() {
    const g = GameState.gen();
    const who = genEqRoster();
    for (const w of who) if (!w.holder.gear) w.holder.gear = {};
    invSel = -1;
    // LE PORTEUR DE RÉFÉRENCE : celui dont l'équipement sert de point de
    // comparaison dans l'infobulle du coffre, et dont la classe arme le tri par
    // défaut. Il se change d'un clic sur une fiche de la colonne de gauche.
    if (!who.some(w => w.id === genInvWho)) genInvWho = who[0].id;
    if (genInvCls === undefined) genInvCls = GameState.heroClassOf(genInvWho) || null;
    const refWho = () => who.find(w => w.id === genInvWho) || who[0];
    UI.popup({
      title: '🎒 Équipement de la compagnie',
      wide: true,
      html: `<p class="muted" style="text-align:center;margin:0 0 8px">Cliquez un porteur à gauche : le coffre ne montre plus que ce qu'il peut porter, et chaque infobulle se compare à ce qu'il a déjà. Glissez une pièce sur un emplacement — clic sur un emplacement occupé = retirer.</p>
        <div class="eq-layout">
          <div class="eq-left">
            <div class="eq-lh">👥 La compagnie</div>
            <div id="eq-mem">${who.map(w => genEqMemberHtml(w, w.id === genInvWho)).join('')}</div>
          </div>
          <div class="eq-right">
            <div class="eq-lh">📦 Le coffre <span class="muted" id="eq-bagn">${genInvCountTxt()}</span></div>
            <div class="eq-fbar" id="eq-filt">${genInvFiltHtml(who)}</div>
            <div class="inv-grid eq-grid" id="eq-bag">${genInvBagHtml()}</div>
          </div>
        </div>`,
      buttons: [{ label: 'Fermer', cls: 'ghost' }],
      onOpen: box => {
        fillGenPortraits(box);
        fillGenItems(box);
        // LE RAFRAÎCHISSEMENT DE L'ÉCRAN DU DESSOUS EST DIFFÉRÉ À LA FERMETURE.
        // `dirty = true` posé fenêtre ouverte fait reconstruire l'onglet dans
        // les 200 ms (ui-tick.js appelle `renderActiveTab` sans tester
        // `popupRoot`) : le `<canvas id="av-canvas">` est détruit, `Adventure.attach`
        // remet `bgCanvas = null`, et le décor repart d'une frame vide — ce qui
        // se voit à travers le fond translucide du popup.
        if (popupRoot) popupRoot._cleanup = () => { hideTip(); dirty = true; };
        const bagEl = box.querySelector('#eq-bag');
        const bagN = box.querySelector('#eq-bagn');
        const filtEl = box.querySelector('#eq-filt');

        // ---- REPEINTURE EN PLACE : plus jamais de reconstruction ----
        // `rebuild()` faisait `UI.closePopup()` + `genInventoryPopup()`, soit un
        // #popup-root retiré puis recréé à CHAQUE geste : `fadeIn 0.2s` et
        // `popupIn 0.3s` rejouées (le clignotement), un second `FX.sfx('pop')`,
        // les deux zones défilantes remises en haut et la sélection perdue.
        // Le coffre a DEUX ascenseurs imbriqués (`.eq-right` et la grille) et il
        // faut les garder : `.inv-cell` porte `aspect-ratio: 1/1`, sans hauteur
        // bornée les colonnes `1fr` explosent (mesuré : 302 px au lieu de 44).
        // On sauve donc les deux positions de défilement.
        const colDroite = box.querySelector('.eq-right');
        const peindreCoffre = () => {
          const scCol = colDroite ? (colDroite.scrollTop || 0) : 0;
          if (bagEl) {
            const sc = bagEl.scrollTop || 0;
            // LA GRILLE SE REFAIT EN ENTIER, jamais case par case : le sac se
            // réordonne à chaque équipement et `data-invitem` EST un index de sac.
            bagEl.innerHTML = genInvBagHtml();
            // LA POSITION SE REPOSE **APRÈS** LE DESSIN DES PIÈCES. `fillGenItems`
            // remplace l'émoji de chaque case par un `<canvas>` : la hauteur des
            // cases bouge, et l'ANCRAGE DE DÉFILEMENT de Chrome corrige alors le
            // `scrollTop` tout seul. Mesuré en navigateur : reposée avant, la
            // grille repartait 3 px plus bas à chaque geste — un petit saut, mais
            // exactement le « refresh pas agréable » qu'on est en train de tuer.
            fillGenItems(bagEl);
            try { bagEl.scrollTop = sc; } catch (e) { }
          }
          if (bagN) bagN.textContent = genInvCountTxt();
          if (filtEl) filtEl.innerHTML = genInvFiltHtml(who);
          // l'étiquette de la page dessous, elle, se met à jour sans rien casser
          const lab = document.getElementById && document.getElementById('gen-bag');
          if (lab) lab.textContent = '🎒 Inventaire (' + g.bag.length + ')';
          if (colDroite) { try { colDroite.scrollTop = scCol; } catch (e) { } }
        };
        const peindrePorteur = mid => {
          const w = who.find(x => x.id === mid);
          const node = box.querySelector('[data-eqwho="' + mid + '"]');
          if (!w || !node) return;
          node.innerHTML = genEqMemberInner(w);
          fillGenPortraits(node);   // les nœuds neufs n'ont pas `dataset.filled`
          fillGenItems(node);
        };
        const majSel = () => {
          box.querySelectorAll('[data-eqwho]').forEach(n => {
            n.classList.toggle('sel', n.dataset.eqwho === genInvWho);
          });
        };

        const equip = (mid, slot, idx) => {
          const it = g.bag[idx];
          if (!it) return;
          const heroId = mid === '__general' ? null : mid;
          if (it.slot !== slot) { FX.sfx('error'); UI.toast('Cette pièce se porte à l\'emplacement <b>' + (UGD.GENERAL.slotName[it.slot] || it.slot) + '</b>.', { icon: '🎒' }); return; }
          // LA CLASSE DÉCIDE, et elle dit pourquoi : sans motif, le clic
          // tombe dans le vide et le joueur croit à un bug.
          const motif = GameState.equipRefus(it, heroId);
          if (motif) {
            FX.sfx('error');
            const qui = mid === '__general' ? 'Le Général' : genHeroName(UGD.heroById(mid));
            UI.toast('<b>' + qui + '</b> ' + motif + '.', { icon: '🚫' });
            return;
          }
          if (GameState.equipItem(it, heroId)) {
            FX.sfx('capture'); invSel = -1; hideTip();
            peindrePorteur(mid); peindreCoffre();
          } else FX.sfx('error');
        };

        // ---- DÉLÉGATION : les écouteurs sont posés UNE FOIS sur la boîte.
        // Un `innerHTML` détruit les écouteurs de ses ENFANTS, jamais ceux de
        // son parent : c'est ce qui rend la repeinture possible. `dragstart`,
        // `dragover`, `dragleave` et `drop` bullent, le glisser suit donc — à
        // condition que `draggable="true"` soit dans le GABARIT (un
        // `setAttribute` après coup ne survivrait pas à une repeinture).
        const vise = (ev, sel) => (ev.target && ev.target.closest) ? ev.target.closest(sel) : null;
        box.addEventListener('click', ev => {
          const fb = vise(ev, '[data-invcls]');
          if (fb) {
            const v = fb.dataset.invcls || '';
            genInvCls = v || null;
            // le porteur de référence suit le tri quand la classe est là
            if (v) { const w = who.find(x => GameState.heroClassOf(x.id) === v); if (w) { genInvWho = w.id; majSel(); } }
            FX.sfx('click'); hideTip(); peindreCoffre();
            return;
          }
          const sl = vise(ev, '[data-eqslot]');
          if (sl) {
            const deux = String(sl.dataset.eqslot).split('|');
            const mid = deux[0], slot = deux[1];
            if (invSel >= 0) { equip(mid, slot, invSel); return; }
            const heroId = mid === '__general' ? null : mid;
            if (GameState.unequipItem(slot, heroId)) {
              FX.sfx('click'); hideTip(); peindrePorteur(mid); peindreCoffre();
            }
            return;
          }
          const mw = vise(ev, '[data-eqwho]');
          if (mw) {
            genInvWho = mw.dataset.eqwho;
            genInvCls = GameState.heroClassOf(genInvWho) || null;
            FX.sfx('click'); hideTip(); majSel(); peindreCoffre();
            return;
          }
          const cell = vise(ev, '[data-invitem]');
          if (cell) {
            const i = parseInt(cell.dataset.invitem, 10);
            invSel = invSel === i ? -1 : i;
            FX.sfx('click'); peindreCoffre();
          }
        });
        box.addEventListener('dragstart', ev => {
          const cell = vise(ev, '[data-invitem]');
          if (!cell) return;
          const i = parseInt(cell.dataset.invitem, 10);
          try { ev.dataTransfer.setData('text/plain', String(i)); } catch (e) { }
          // pas de repeinture ici : elle arracherait le nœud qu'on est en train
          // de glisser. On marque la case à la main.
          invSel = i; cell.classList.add('sel'); hideTip();
        });
        box.addEventListener('dragover', ev => {
          const sl = vise(ev, '[data-eqslot]');
          if (!sl) return;
          ev.preventDefault(); sl.classList.add('over');
        });
        box.addEventListener('dragleave', ev => {
          const sl = vise(ev, '[data-eqslot]');
          if (sl) sl.classList.remove('over');
        });
        box.addEventListener('drop', ev => {
          const sl = vise(ev, '[data-eqslot]');
          if (!sl) return;
          ev.preventDefault(); sl.classList.remove('over');
          const deux = String(sl.dataset.eqslot).split('|');
          let idx = invSel;
          try { const d = ev.dataTransfer.getData('text/plain'); if (d !== '') idx = parseInt(d, 10); } catch (e) { }
          equip(deux[0], deux[1], idx);
        });
        // ---- INFOBULLES. `data-tip` est INERTE dans une fenêtre (UIKit délègue
        // sur #game, or #popup-root est un FRÈRE de #game) : c'est le `showTip`
        // maison qui sert ici. Et `mouseenter` ne bulle pas — donc `mousemove`.
        box.addEventListener('mousemove', ev => {
          const fb = vise(ev, '[data-invcls]');
          if (fb) { showTip(genInvTipHtml(fb.dataset.invtip || ''), ev.clientX, ev.clientY); return; }
          const cell = vise(ev, '[data-invitem]');
          if (cell) {
            const it = g.bag[parseInt(cell.dataset.invitem, 10)];
            if (!it) { hideTip(); return; }
            // LA COMPARAISON, ENFIN ATTEIGNABLE. Le calcul existait depuis
            // toujours dans `genItemTooltipHtml`, mais les deux appels du coffre
            // passaient `null` : seul un vrai `dragstart` alimentait `current`,
            // et pendant un glisser le navigateur n'émet plus de `mousemove`.
            // Le code était donc écrit, correct, et jamais vu.
            const w = refWho();
            showTip(genItemTooltipHtml(it, (w.holder.gear || {})[it.slot] || null, w.name), ev.clientX, ev.clientY);
            return;
          }
          const sl = vise(ev, '[data-eqslot]');
          if (sl) {
            const deux = String(sl.dataset.eqslot).split('|');
            const w = who.find(x => x.id === deux[0]);
            const cur = w ? ((w.holder.gear || {})[deux[1]] || null) : null;
            const sel = invSel >= 0 ? g.bag[invSel] : null;
            if (sel && sel.slot === deux[1]) showTip(genItemTooltipHtml(sel, cur, w ? w.name : ''), ev.clientX, ev.clientY);
            else if (cur) showTip(genItemTooltipHtml(cur, null), ev.clientX, ev.clientY);
            // un emplacement GRIS dit pourquoi il l'est, au survol
            else if (sl.dataset.eqno) showTip(genInvTipHtml(UGD.GENERAL.slotName[deux[1]] + '|' + sl.dataset.eqno), ev.clientX, ev.clientY);
            else hideTip();
            return;
          }
          hideTip();
        });
        box.addEventListener('mouseleave', hideTip);
      },
    });
  }

  // ---------- report popup ----------
  function genReportPopup(r) {
    let res = '';
    for (const k in r.loot.res) res += `<span class="u-stats-chip">${UI.res(k).icon} +${UI.fmt(r.loot.res[k])}</span> `;
    let items = '';
    for (const it of r.loot.items) items += `<div class="gr-row">🎒 ${genItemLine(it)}</div>`;
    let plans = '';
    for (const id of r.loot.plans) { const p = UGD.planById(id); if (p) plans += `<div class="gr-row">${p.icon} <b>${p.name[GameState.state.faction] || p.name.cats}</b></div>`; }
    let relics = '';
    for (const id of r.loot.relics) { const rl = UGD.relicById(id); if (rl) relics += `<div class="gr-row">${rl.icon} <b>${rl.name[GameState.state.faction] || rl.name.cats}</b></div>`; }
    let heroes = '';
    for (const id of r.loot.heroes) { const h = UGD.heroById(id); if (h) heroes += `<div class="gr-row">${h.icon} <b>${genHeroName(h)}</b> rejoint la compagnie !</div>`; }
    UI.popup({
      title: `📜 Descente — étage ${r.floor}`,
      html: `<p style="text-align:center" class="muted">Checkpoint ${r.checkpoint}${r.fled ? ' · repli' : ''} · <b>${UI.fmt(r.xp)}</b> XP</p>
        <div style="text-align:center;margin:8px 0">${res || '<span class="muted">Rien dans les poches.</span>'}</div>
        ${items}${plans}${relics}${heroes}
        <div class="dj-sep"><span>📖 Le récit</span></div>
        <div class="gm-journal">${r.log.map(e => `<div class="gm-line"><span class="gl-ic">${e.icon}</span><span class="gl-tx"><b>${e.name}</b> — ${e.txt || ''}</span></div>`).join('')}</div>`,
      buttons: [{ label: 'Parfait', cls: 'primary' }],
    });
  }

  // ---------- relic & plan popups ----------
  function genRelicPopup() {
    const g = GameState.gen();
    const slots = GameState.relicSlots();
    let rows = '';
    for (const id in g.relics) {
      const r = UGD.relicById(id);
      if (!r) continue;
      const on = g.placed.indexOf(id) >= 0;
      rows += `<button class="gn-bagrow ${on ? 'on' : ''}" data-genrelic="${id}">
        <span class="gb-ico">${r.icon}</span>
        <span class="gb-tx"><b>${r.name[GameState.state.faction] || r.name.cats}</b> <i class="muted">— ${r.txt}</i></span>
        <span class="gb-go">${on ? '✅ posée' : 'poser'}</span></button>`;
    }
    if (!rows) rows = '<p class="muted" style="text-align:center">Aucune relique.</p>';
    UI.popup({
      title: '🏺 Les reliques',
      html: `<p class="muted" style="text-align:center">${slots} socle(s) disponible(s).</p><div class="gn-baglist">${rows}</div>`,
      buttons: [{ label: 'Fermer', cls: 'ghost' }],
      onOpen: box => box.querySelectorAll('[data-genrelic]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.genrelic;
        const on = g.placed.indexOf(id) >= 0;
        if (on ? GameState.unplaceRelic(id) : GameState.placeRelic(id)) { FX.sfx('capture'); dirty = true; UI.closePopup(); genRelicPopup(); }
        else FX.sfx('error');
      })),
    });
  }
  function genPlanPopup() {
    const g = GameState.gen();
    let rows = '';
    for (const p of UGD.PLANS) {
      const has = !!g.plans[p.id];
      rows += `<div class="gn-bagrow static ${has ? 'on' : 'dim'}">
        <span class="gb-ico">${has ? p.icon : '❔'}</span>
        <span class="gb-tx">${has ? `<b>${p.name[GameState.state.faction] || p.name.cats}</b> <i class="muted">— ${p.txt}</i>` : `<span class="muted">Plan T${p.tier} — pas trouvé</span>`}</span></div>`;
    }
    UI.popup({ title: '📐 Les plans', html: `<div class="gn-baglist">${rows}</div>`, buttons: [{ label: 'Fermer', cls: 'ghost' }] });
  }

  // Le bandeau de chiffres du camp : ce que la scène ne peut pas dire (un coût
  // avec ses icônes de ressources n'a rien à faire peint dans une image).
  function genCampMetaHtml(g) {
    if (g.descent) return '';
    const cp = g.tally.lastCheckpoint || 1;
    const biome = UGD.dungeonBiome(cp);
    const why = g.report ? null : GameState.canStartDescent();
    const bloque = {
      fatigue: 'Le Général est épuisé',
      cout: 'Pas assez de vivres',
    }[why];
    return `<div class="dj-meta">
      <span>${biome.icon} ${biome.name[GameState.state.faction] || biome.name.cats}</span>
      <span>🥖 Coût : ${UI.costHtml(UGD.descentCost(cp, g.party.length + 1))}</span>
      <span>🏆 Record : étage ${g.tally.bestFloor || 0}</span>
      <span>💾 Checkpoint : ${cp}</span>
      ${bloque ? `<span class="dj-warn">⛔ ${bloque}</span>` : ''}
    </div>`;
  }

  // ---------- l'onglet ----------
  function renderGeneral(page) {
    const g = GameState.gen();
    const nPlans = Object.keys(g.plans).length;
    const placed = g.placed.length, slots = GameState.relicSlots();

    const arenaCard = `<div class="card av-card"><h2>${g.descent
      ? UGD.dungeonBiome(g.descent.floor).icon + ' ' + (UGD.dungeonBiome(g.descent.floor).name[GameState.state.faction] || '')
      : '🏕️ Le camp'}
      <span class="hint">${g.descent ? 'étage ' + g.descent.floor : 'la compagnie attend'}</span>
      <span class="bld-ctl">
        <button class="btn ${GameState.advAuto() ? 'primary' : 'ghost'}" id="gen-auto">${GameState.advAuto() ? '🤖 Auto' : '🎮 Manuel'}</button>
        ${g.descent ? '<button class="btn ghost" id="gen-abort">🏳️ Remonter</button>' : ''}
      </span></h2>
      ${genArenaHtml(g)}
      ${genCampMetaHtml(g)}
    </div>`;

    page.innerHTML = arenaCard + (g.descent ? `
      <div class="card"><h2>⛏️ La descente <span class="hint">record : étage ${g.tally.bestFloor || 0}</span></h2>
        ${genDescentHtml(g)}
      </div>` : '') + `
      <div class="card"><h2>🎖️ La compagnie <span class="hint">${g.roster.length} compagnon(s) · ${nPlans} plan(s) · ${placed}/${slots} relique(s)</span></h2>
        ${genHeaderHtml(g)}
        ${genRosterHtml(g)}
        <div class="gn-bagbar">
          <button class="btn ghost" id="gen-bag">🎒 Inventaire (${g.bag.length})</button>
          ${genTalentBtnHtml('__general', GameState.talentPts ? GameState.talentPts('__general') : 0, 'bar')}
          <button class="btn ghost" id="gen-relics">🏺 Reliques</button>
          <button class="btn ghost" id="gen-plans">📐 Plans</button>
          <span class="pg-chip">😮‍💨 ${g.fatigue.toFixed(1)}/${UGD.GENERAL.fatigueMax}</span>
        </div>
      </div>`;

    fillGenPortraits(page);
    fillGenItems(page);
    // bindings
    const eqb = page.querySelector('#gen-equip');
    if (eqb) eqb.addEventListener('click', () => { FX.sfx('pop'); genInventoryPopup(); });
    page.querySelectorAll('[data-genhero]').forEach(b => b.addEventListener('click', ev => {
      if (ev.target.closest('[data-gentalent]')) return;
      const id = b.dataset.genhero;
      if (GameState.toggleParty(id)) { FX.sfx('click'); dirty = true; }
      else FX.sfx('error');
    }));
    page.querySelectorAll('[data-gentalent]').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      genTalentPopup(b.dataset.gentalent);
    }));
    bindArena(page);
    const au = page.querySelector('#gen-auto');
    if (au) au.addEventListener('click', () => {
      const v = !GameState.advAuto();
      GameState.setAdvAuto(v);
      FX.sfx('click');
      UI.toast(v ? '🤖 Auto' : '🎮 Manuel', { icon: v ? '🤖' : '🎮', cls: 'good' });
      dirty = true;
    });
    const ab = page.querySelector('#gen-abort');
    if (ab) ab.addEventListener('click', () => {
      if (GameState.abortDescent()) { FX.sfx('click'); UI.toast('La compagnie remonte.', { icon: '🏳️' }); dirty = true; }
    });
    const bag = page.querySelector('#gen-bag');
    if (bag) bag.addEventListener('click', () => genInventoryPopup());
    const rel = page.querySelector('#gen-relics');
    if (rel) rel.addEventListener('click', () => genRelicPopup());
    const pl = page.querySelector('#gen-plans');
    if (pl) pl.addEventListener('click', () => genPlanPopup());
  }
