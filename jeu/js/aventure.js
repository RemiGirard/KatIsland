/* ============================================================
   LE BOURG — js/aventure.js
   LA DESCENTE. Le Puits sans fond est la RAISON D'ÊTRE de toute
   l'économie : il rend des choses qu'aucun métier du bourg ne sait
   produire — essences, gemmes, obsidienne, reliques, et les PLANS qui
   ouvrent de nouvelles recettes.

   Le moteur d'arène (`adventure.js`) et le moteur de descente
   (`state-general.js`) sont conservés tels quels. Ce fichier ne fait
   que trois choses : les alimenter, les afficher, et rapatrier le
   butin dans les réserves du bourg.
   ============================================================ */
"use strict";
(function () {

  const U = () => window.UI, el = () => window.UI.el;
  const E = () => window.Etat.E;

  let ouvert = false, tArene = 0, accHorsEcran = 0, accCotes = 0;
  let plateau, scene, cvA, titre, sous, boutons, pied, gauche, droite;
  let choisiCote = '__general';

  /* =================================================================
     LE TICK — deux régimes
     Devant l'écran, l'arène est la vérité et l'on avance image par
     image. Ailleurs, la compagnie REJOUE son étage : elle rapporte du
     butin, elle ne descend pas. C'est ce qui fait qu'on a envie de
     regarder la descente au lieu de la laisser tourner.
     ================================================================= */
  function tick(dt) {
    if (window.Tour) window.Tour.tick(dt);
    if (!window.GameState || !window.GameState.generalTick) return;
    const g = window.GameState.gen();
    if (!g.descent) { majBarre(0); return; }
    if (ouvert && window.Adventure) {
      tArene += dt;
      window.GameState.generalTick(dt);
      try { window.Adventure.draw(tArene); } catch (e) { console.warn('arène :', e.message); }
      majPied();
      accCotes += dt;
      if (accCotes >= 0.45) { accCotes = 0; majCotes(); }
    } else {
      accHorsEcran += dt;
      if (accHorsEcran >= 20) { window.GameState.generalTick(accHorsEcran); accHorsEcran = 0; }
    }
    majBarre(1);
  }

  function majBarre() {
    const g = window.GameState.gen();
    const d = g.descent;
    if (!d) { E().aventure.encours = null; return; }
    E().aventure.profondeur = d.floor;
    E().aventure.record = Math.max(E().aventure.record || 0, g.tally.bestFloor || d.floor);
    E().aventure.encours = { prog: ouvert ? 0.5 : 0.25, etage: d.floor };
  }

  /* =================================================================
     LE PLATEAU — l'arène en plein écran
     ================================================================= */
  function refs() {
    plateau = document.getElementById('plateau');
    scene = document.getElementById('plateau-scene');
    cvA = document.getElementById('plateau-canvas');
    titre = document.getElementById('plateau-titre');
    sous = document.getElementById('plateau-sous');
    boutons = document.getElementById('plateau-boutons');
    pied = document.getElementById('plateau-pied');
    gauche = document.getElementById('plateau-gauche');
    droite = document.getElementById('plateau-droite');
  }

  function ouvrir() {
    refs();
    const g = window.GameState.gen();
    if (!g.descent) { U().dire('Aucune descente en cours.', 'alerte'); return; }
    ouvert = true;
    plateau.classList.add('vu');
    titre.textContent = 'La descente';
    window.Adventure.attach(cvA);
    brancherPointeur();
    majTete();
    majPied();
    majCotes();
  }
  function fermer() {
    ouvert = false;
    if (plateau) plateau.classList.remove('vu');
    if (window.Adventure && window.Adventure.detach) window.Adventure.detach();
  }

  function majTete() {
    const g = window.GameState.gen();
    const d = g.descent;
    const biome = d ? window.GameData.dungeonBiome(d.floor) : null;
    titre.textContent = d ? 'Étage ' + d.floor : 'La descente';
    const per = d && window.Tour ? window.Tour.peril(d.floor) : null;
    sous.textContent = d
      ? ((biome ? biome.name : '') + ' · ' + (per ? per.nom : '') +
         (per && per.garde ? (window.Tour.protege(d.floor) ? ' · paré' : ' · SANS GARDE') : '') +
         ' · palier ' + d.checkpoint)
      : '';
    U().vide(boutons);
    boutons.appendChild(el()('button', {
      class: 'b' + (g.auto ? ' primaire' : ''), text: g.auto ? 'IA aux commandes' : 'Commandes manuelles',
      onclick: () => { window.GameState.setAdvAuto(!g.auto); if (window.Adventure) window.Adventure.setAuto(g.auto); majTete(); },
    }));
    boutons.appendChild(el()('button', { class: 'b danger', text: 'Remonter',
      onclick: () => {
        if (!confirm('Remonter maintenant ? La compagnie garde le butin déjà ramassé.')) return;
        window.GameState.abortDescent();
        recolter();
        fermer();
      } }));
    boutons.appendChild(el()('button', { class: 'b', text: 'Retour au bourg', onclick: fermer }));
  }

  function majPied() {
    if (!pied) return;
    const g = window.GameState.gen();
    const d = g.descent;
    U().vide(pied);
    if (!d) return;
    const hp = window.Adventure && window.Adventure.partyHp ? window.Adventure.partyHp() : null;
    pied.appendChild(el()('span', { class: 'eti', text: 'butin en sacoche' }));
    const lot = {};
    for (const k in d.loot.res) lot[window.GameState.versBourg(k)] = (lot[window.GameState.versBourg(k)] || 0) + d.loot.res[k];
    pied.appendChild(U().listeRes(lot, { gain: true, rien: 'rien encore' }));
    if (d.loot.items && d.loot.items.length)
      pied.appendChild(el()('span', { class: 'puce gain', text: d.loot.items.length + ' objets' }));
    if (d.loot.plans && d.loot.plans.length)
      pied.appendChild(el()('span', { class: 'puce gain', text: d.loot.plans.length + ' plans' }));
    pied.appendChild(el()('span', { class: 'eti', style: 'margin-left:auto',
      text: 'xp ' + U().fmt(d.xp) }));
  }

  function brancherPointeur() {
    if (cvA.__branche) return;
    cvA.__branche = true;
    const pos = ev => {
      const r = cvA.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (cvA.width / r.width),
               y: (ev.clientY - r.top) * (cvA.height / r.height) };
    };
    cvA.addEventListener('pointerdown', ev => {
      if (ev.button === 2) return;
      const p = pos(ev);
      try { window.Adventure.clickAt(p.x, p.y, ev.shiftKey); } catch (e) { }
    });
    cvA.addEventListener('pointermove', ev => {
      const p = pos(ev);
      try { window.Adventure.hoverAt(p.x, p.y); } catch (e) { }
    });
    cvA.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      const p = pos(ev);
      try { window.Adventure.rightClick(p.x, p.y); } catch (e) { }
    });
    addEventListener('keydown', ev => {
      if (!ouvert) return;
      if (ev.key === 'Escape') { fermer(); return; }
      const n = parseInt(ev.key, 10);
      if (n >= 1 && n <= 6) {
        const g = window.GameState.gen();
        try { window.Adventure.castAbility('__general', n - 1); } catch (e) { }
      }
    });
  }

  /* =================================================================
     LE RAPPORT — c'est ici que le donjon paie le bourg
     ================================================================= */
  function recolter() {
    const g = window.GameState.gen();
    if (!g.report) return null;
    const r = window.GameState.claimReport();
    const recu = window.GameState.viderSacoche();
    const n = Object.keys(recu).length;
    if (n) {
      window.Etat.journal('La compagnie remonte : ' +
        Object.keys(recu).map(id => recu[id] + ' ' + window.RES[id].nom.toLowerCase()).join(', '), 'butin');
      U().dire('Butin remonté de la Tour sombre.', 'butin', 4000);
    }
    if (r && r.loot && r.loot.plans && r.loot.plans.length) {
      for (const pid of r.loot.plans) window.Etat.gagner('plan', 1);
      window.Etat.journal(r.loot.plans.length + ' plan(s) rapporté(s) des profondeurs.', 'plan');
    }
    E().aventure.encours = null;
    return r;
  }

  /* =================================================================
     LE PANNEAU DU PUITS
     ================================================================= */
  /* ==================================================================
     LE COÛT D'UN PALIER D'ARMEMENT

     Il coûtait `1 + palier` armes, et rien d'autre. Trois défauts :
     la dépense restait dérisoire au bout de dix paliers ; elle ne
     réclamait jamais mieux que la première épée forgée ; et l'acier,
     le harnois, le mithril n'avaient donc aucune raison d'exister.

     La porte de l'aventure s'ouvre tôt — c'est voulu. Ce qui doit
     monter LENTEMENT, c'est l'équipement : chaque cran demande plus,
     et bientôt demande MIEUX. Le joueur descend d'abord mal armé, et
     chaque palier suivant le renvoie travailler au bourg.
     ================================================================== */
  const ECHELLE_ARMEMENT = {
    /* palier atteint -> ce que le cran suivant réclame en plus */
    arme: [
      { des: 0, add: {} },                          // les premières lames
      { des: 3, add: { lingotfer: 4 } },            // il faut du fer en propre
      { des: 5, add: { acier: 2, charbonbois: 4 } },// la trempe
      { des: 8, add: { acier: 6, limaille: 8 } },   // la manufacture
      { des: 12, add: { mithril: 1 } },             // ce qui ne s'use pas
    ],
    armure: [
      { des: 0, add: {} },
      { des: 3, add: { cuir: 4 } },
      { des: 5, add: { bouclier: 2, drap: 2 } },
      { des: 8, add: { armure: 3, acier: 4 } },
      { des: 12, add: { mithril: 1, bijou: 1 } },
    ],
  };

  function coutArmement(res, p) {
    /* la quantité de base croît par paliers de trois : 1, 1, 1, 2, 2,
       2, 3… — franchement, mais sans mur */
    const cout = {};
    cout[res] = 1 + Math.floor(p / 3) + Math.floor(p / 7);
    for (const cran of ECHELLE_ARMEMENT[res] || []) {
      if (p < cran.des) continue;
      for (const k in cran.add) {
        /* ce qu'un cran ajoute grossit lui aussi, mais doucement */
        const n = Math.ceil(cran.add[k] * (1 + 0.25 * (p - cran.des)));
        cout[k] = (cout[k] || 0) + n;
      }
    }
    return cout;
  }

  function rendre(c) {
    const A = el();
    const g = window.GameState.gen();
    const d = g.descent;
    const rec = E().aventure.record || 0;

    c.appendChild(A('div', { class: 'cadre' },
      A('div', { class: 'rangee entre' },
        A('span', { class: 'tt', text: d ? 'Étage ' + d.floor : 'Aucune descente' }),
        A('span', { class: 'eti-or', text: 'record ' + rec })),
      A('div', { class: 'note', style: 'margin-top:8px',
        text: d ? 'La compagnie tient l\'étage ' + d.floor + '. Devant l\'écran elle descend ; en votre absence elle rejoue son étage et rapporte du butin sans progresser.'
                : "On n'a jamais trouvé le fond. On a seulement trouvé jusqu'où l'on pouvait descendre." })));

    /* ---- rapport à réclamer ---- */
    if (g.report) {
      const lot = {};
      for (const k in g.report.loot.res) {
        const id = window.GameState.versBourg(k);
        lot[id] = (lot[id] || 0) + g.report.loot.res[k];
      }
      c.appendChild(A('div', { class: 'cadre actif' },
        A('div', { class: 'tt', text: 'Rapport de descente' }),
        A('div', { class: 'note', style: 'margin-top:4px', text: 'La compagnie est remontée. Il reste à décharger.' }),
        U().listeRes(lot, { gain: true }),
        A('div', { style: 'margin-top:8px' },
          A('button', { class: 'b primaire', text: 'Décharger au bourg',
            onclick: () => { recolter(); } }))));
    }

    /* ---- lancer / suivre ---- */
    if (d) {
      c.appendChild(A('div', { class: 'rangee' },
        A('button', { class: 'b primaire', text: 'Suivre la descente', onclick: ouvrir }),
        A('button', { class: 'b danger', text: 'Rappeler la compagnie',
          onclick: () => { window.GameState.abortDescent(); recolter(); } })));
    } else {
      const cp = g.tally.lastCheckpoint || 1;
      const cout = window.GameData.descentCost(cp, g.party.length + 1);
      const lot = {};
      for (const k in cout) { const id = window.GameState.versBourg(k); lot[id] = (lot[id] || 0) + cout[k]; }
      const refus = window.GameState.canStartDescent();
      const RAISONS = { en_cours: 'une descente est déjà en cours', rapport: 'déchargez d\'abord le rapport',
                        fatigue: 'la compagnie est épuisée', cout: 'vivres insuffisants' };
      c.appendChild(A('div', { class: 'cadre' },
        A('div', { class: 'eti-or', text: 'partir de l\'étage ' + cp }),
        A('div', { class: 'sep' }),
        A('div', { class: 'eti', text: 'ravitaillement' }),
        U().listeRes(lot, { verifier: true }),
        A('div', { class: 'rangee entre', style: 'margin-top:8px' },
          A('span', { class: 'eti', text: refus ? RAISONS[refus] || refus : 'la compagnie est prête' }),
          A('button', { class: 'b primaire', text: 'Descendre', disabled: !!refus,
            onclick: () => {
              if (!window.GameState.startDescent()) { U().dire('Impossible de partir.', 'alerte'); return; }
              window.Etat.journal('La compagnie descend dans la Tour sombre (étage ' + cp + ').', 'guerre');
              ouvrir();
            } }))));
    }

    /* ---- LE PÉRIL DU MOMENT ---- */
    c.appendChild(U().section('Le péril'));
    c.appendChild(paveRoute(d ? d.floor : window.Tour.prochainDepart()));
    c.appendChild(pavePeril(d ? d.floor : window.Tour.prochainDepart()));

    /* ---- L'ÉQUIPÉE ---- */
    c.appendChild(U().section('L\'équipée'));
    c.appendChild(paveEquipee());

    /* L'essentiel tient au-dessus : partir, comprendre le péril, choisir
       l'équipée. Gardiens, armement et collection de compagnons restent
       disponibles dans un seul volet, sans charger chaque ouverture. */
    const avancee = A('details', { class: 'aventure-avancee' });
    avancee.appendChild(A('summary', {},
      A('span', { text: 'Progression, gardiens et équipement' }),
      A('span', { class: 'eti', text: 'options avancées' })));
    const avanceeCorps = A('div', { class: 'aventure-avancee-corps' });
    avancee.appendChild(avanceeCorps);

    /* ---- LES GARDIENS ---- */
    avanceeCorps.appendChild(U().section('Les gardiens'));
    avanceeCorps.appendChild(paveGardiens());

    /* ---- CEUX QUI SONT RESTÉS EN BAS ---- */
    if (window.Tour.tombes.length) {
      avanceeCorps.appendChild(U().section('Restés en bas'));
      avanceeCorps.appendChild(paveTombes());
    }

    /* ---- l'armement fourni par le bourg ---- */
    avanceeCorps.appendChild(A('div', { class: 'sep' }));
    avanceeCorps.appendChild(A('div', { class: 'eti-or', text: 'ce que le bourg fournit' }));
    avanceeCorps.appendChild(A('div', { class: 'note',
      text: "La forge équipe séparément les combattants de mêlée, de distance et de magie. Ses 40 paliers commencent avec les matières du rivage puis réclament les trouvailles de la tour." }));
    for (const [type, nom] of [['melee', 'Corps à corps'], ['distance', 'Distance'], ['magie', 'Magie']]) {
      const arme = window.Armee.tierEquipement(type, 'arme');
      const armure = window.Armee.tierEquipement(type, 'armure');
      avanceeCorps.appendChild(A('div', { class: 'cadre' },
        A('div', { class: 'rangee entre' },
          A('span', { class: 'tt', text: nom }),
          A('span', { class: 'eti-or', text: 'arme T' + arme + ' · armure T' + armure })),
        A('div', { class: 'rangee', style: 'margin-top:8px' },
          A('img', { src: window.Armee.imageEquipement(type, 'arme', arme), style: 'width:54px;height:42px;object-fit:contain' }),
          A('img', { src: window.Armee.imageEquipement(type, 'armure', armure), style: 'width:54px;height:42px;object-fit:contain' }))));
    }
    const forge = window.Etat.batsDeType('forge')[0];
    if (forge) avanceeCorps.appendChild(A('button', { class: 'b primaire', text: 'Ouvrir l’arsenal de la forge',
      onclick: () => window.UIFen.ouvrirBatiment(forge.id) }));

    /* ---- la compagnie ---- */
    avanceeCorps.appendChild(U().section('La compagnie'));
    avanceeCorps.appendChild(A('div', { class: 'cadre' },
      A('div', { class: 'rangee entre' },
        A('div', {},
          A('div', { class: 'tt', style: 'font-size:14px', text: 'Le maître d\'œuvre' }),
          A('div', { class: 'eti', style: 'margin-top:4px',
            text: 'niveau ' + g.lvl + '  ·  ' + U().fmt(g.xp) + ' xp  ·  ' +
                  g.roster.length + ' compagnon(s)  ·  ' + g.party.length + ' en ligne' })),
        A('button', { class: 'b mini primaire', text: 'Équipement et talents',
          onclick: () => window.UICompagnie.ouvrir() })),
      A('div', { style: 'margin-top:8px' },
        U().barre(Math.min(1, (g.xp || 0) / Math.max(1, window.GameData.GENERAL.xpFor(g.lvl))), 'bleu',
          'expérience', U().fmt(g.xp) + ' / ' + U().fmt(window.GameData.GENERAL.xpFor(g.lvl)))),
      g.fatigue > 0.05 ? A('div', { style: 'margin-top:8px' },
        U().barre(g.fatigue / window.GameData.GENERAL.fatigueMax, 'rouge', 'fatigue',
          (Math.round(g.fatigue * 10) / 10) + ' / ' + window.GameData.GENERAL.fatigueMax)) : null));
    /* `roster` contient des FICHES, `party` des identifiants : on ne peut
       pas parcourir l'un comme l'autre. */
    for (const fiche of g.roster) {
      const hid = fiche && fiche.id;
      const def = hid && window.GameData.heroById(hid);
      const hs = hid && window.GameState.heroState(hid);
      if (!def || !hs) continue;
      const nomH = (typeof def.name === 'string') ? def.name : (def.name.cats || def.name.birds || hid);
      const dedans = g.party.indexOf(hid) >= 0;
      avanceeCorps.appendChild(A('div', { class: 'cadre' + (dedans ? ' actif' : '') },
        A('div', { class: 'rangee entre' },
          A('div', {}, A('div', { class: 'tt', text: nomH }),
            A('div', { class: 'eti', text: (window.GameData.HERO_CLASSES[def.cls] || {}).name + ' · niveau ' + (hs.lvl || 1) })),
          A('button', { class: 'b mini' + (dedans ? ' danger' : ' primaire'), text: dedans ? 'Laisser' : 'Emmener',
            onclick: () => { window.GameState.toggleParty(hid); } }))));
    }
    if (!g.roster.length)
      avanceeCorps.appendChild(A('div', { class: 'note faible', text: 'Personne encore. Les compagnons se recrutent dans le donjon lui-même — le premier attend au deuxième étage.' }));
    c.appendChild(avancee);
  }

  function nomDe(x) {
    if (typeof x === 'string') return x;
    return x && (x.cats || x.birds) || '';
  }

  function membresEnLigne() {
    const g = window.GameState.gen();
    const out = [{ id:'__general', nom:"Maître d'œuvre", cls:'general', lvl:g.lvl || 1 }];
    for (const id of (g.party || [])) {
      const def = window.GameData.heroById(id), hs = window.GameState.heroState(id);
      if (def && hs) out.push({ id, nom:nomDe(def.name), cls:def.cls, lvl:hs.lvl || 1 });
    }
    return out;
  }

  function majCotes() {
    if (!gauche || !droite || !ouvert) return;
    const A = el(), membres = membresEnLigne();
    if (!membres.some(m => m.id === choisiCote)) choisiCote = membres[0].id;
    const hp = window.Adventure && window.Adventure.partyHp ? window.Adventure.partyHp() : {};
    U().vide(gauche);
    gauche.appendChild(A('div', { class:'cote-titre', text:'Compagnie en ligne' }));
    for (const m of membres) {
      const st = window.GameState.combatStats(m.id);
      const vie = hp && hp[m.id] != null ? hp[m.id] : st.hp;
      const pct = Math.max(0, Math.min(1, vie / Math.max(1, st.hp)));
      gauche.appendChild(A('div', { class:'plateau-membre' + (m.id === choisiCote ? ' choisi' : ''), onclick:() => { choisiCote = m.id; majCotes(); } },
        A('div', { class:'rangee' },
          A('div', { class:'plateau-portrait', text:m.nom.slice(0,1).toUpperCase() }),
          A('div', { style:'min-width:0;flex:1' },
            A('div', { class:'tt', text:m.nom }),
            A('div', { class:'eti', text:m.cls + ' · niveau ' + m.lvl }))),
        A('div', { class:'plateau-vie' }, A('i', { style:'width:' + Math.round(pct * 100) + '%' })),
        A('div', { class:'rangee entre', style:'margin-top:4px' },
          A('span', { class:'eti', text:Math.round(vie) + ' / ' + Math.round(st.hp) + ' PV' }),
          A('span', { class:'eti', text:Math.round(st.armor || 0) + ' armure' }))));
    }

    const m = membres.find(x => x.id === choisiCote), st = window.GameState.combatStats(m.id);
    const owner = window.GameState.talentOwner(m.id);
    const talents = owner ? owner.holder.talents || [] : [];
    U().vide(droite);
    droite.appendChild(A('div', { class:'cote-titre', text:'Fiche de combat' }));
    droite.appendChild(A('div', { class:'plateau-membre choisi' },
      A('div', { class:'tt', text:m.nom }),
      A('div', { class:'plateau-mini-stats' },
        A('span', { text:Math.round(st.hp) + ' PV' }), A('span', { text:Math.round(st.dmg * 10) / 10 + ' dégâts' }),
        A('span', { text:Math.round(st.armor || 0) + ' armure' }), A('span', { text:Math.round(st.mspd || 0) + ' vitesse' }),
        A('span', { text:Math.round(st.range || 0) + ' portée' }), A('span', { text:window.GameState.talentPts(m.id) + ' pts libres' }))));
    droite.appendChild(A('div', { class:'cote-titre', style:'margin-top:16px', text:'Pouvoirs' }));
    const pouvoirs = window.GameState.heroPowers(m.id);
    if (!pouvoirs.length) droite.appendChild(A('div', { class:'note faible', text:'Aucun pouvoir équipé.' }));
    for (const p of pouvoirs) droite.appendChild(A('div', { class:'plateau-pouvoir' },
      A('div', { class:'tt', text:p.name || p.nom || p.id }),
      A('div', { class:'note', text:p.desc || '' })));
    droite.appendChild(A('div', { class:'cote-titre', style:'margin-top:16px', text:'Arbre de compétences' }));
    const arbre = window.GameData.talentTree(m.cls);
    if (arbre) for (const br of arbre.branches) {
      const acquis = br.nodes.filter(n => talents.indexOf(n.id) >= 0).length;
      droite.appendChild(A('div', { class:'rangee entre ligne-deblocage' },
        A('span', { text:br.name || br.nom || br.id }), A('span', { class:acquis ? 'eti-or' : 'eti', text:acquis + ' / ' + br.nodes.length })));
    }
    droite.appendChild(A('button', { class:'b primaire', style:'width:100%;margin-top:12px', text:'Équipement et arbre complet',
      onclick:() => window.UICompagnie.ouvrir(m.id) }));
  }

  /* ==================================================================
     LE PÉRIL. Trois chiffres, et l'on sait s'il faut descendre ou
     d'abord faire tourner l'alchimie une demi-heure.
     ================================================================== */
  function pavePeril(etage) {
    const A = el();
    const T = window.Tour;
    const p = T.peril(etage);
    const pen = T.penalite(etage);
    const auto = T.autonomie(etage);
    const box = A('div', { class: 'cadre peril p-' + p.id.replace('abyme-', '') });
    box.appendChild(A('div', { class: 'rangee entre' },
      A('span', { class: 'tt', style: 'font-size:15px', text: p.nom }),
      A('span', { class: 'eti-or', text: 'étages ' + p.de + (p.a > 900 ? ' et au-delà' : ' à ' + p.a) })));
    box.appendChild(A('div', { class: 'note', style: 'margin-top:4px', text: p.desc }));
    box.appendChild(A('div', { class: 'note ' + (pen.pare || !p.garde ? '' : 'mauvais'),
      style: 'margin-top:4px', text: p.peril }));
    if (!p.garde) {
      box.appendChild(A('div', { class: 'note', style: 'margin-top:8px',
        text: 'Rien à préparer : on descend en chemise.' }));
      return box;
    }
    const r = window.RES[p.garde];
    box.appendChild(U().stats([
      ['garde requise', r.nom, pen.pare ? 'bon' : 'mauvais'],
      ['en réserve', window.Etat.qte(p.garde), pen.pare ? 'bon' : 'mauvais'],
      ['autonomie', auto === Infinity ? '—' : auto + ' étages', auto > 8 ? 'bon' : (auto ? '' : 'mauvais')],
      ['sans elle', pen.pare ? '—' : '×' + pen.degats.toFixed(1).replace('.', ',') + ' dégâts', 'mauvais'],
    ]));
    box.appendChild(A('div', { style: 'margin-top:8px' },
      U().barre(Math.min(1, auto / 20), 'grande ' + (auto >= 10 ? 'vert' : (auto ? '' : 'rouge')),
        r.nom.toLowerCase(), auto === Infinity ? '—' : auto + ' étages')));
    if (!pen.pare) box.appendChild(A('div', { class: 'note mauvais', style: 'margin-top:8px',
      text: 'Sans garde : ×' + pen.degats.toFixed(1).replace('.', ',') + ' de dégâts subis, ' +
            Math.round(pen.butin * 100) + ' % du butin, et ' + Math.round(pen.perte * 100) +
            ' % de chances par étage d\'y laisser quelqu\'un.' }));
    return box;
  }

  /* La ROUTE ENTIÈRE, d'un coup d'œil : six paliers, six gardes, et ce
     qu'il y a en réserve pour chacune. C'est ce tableau qui dit à
     l'alchimie ce qu'elle doit préparer ce soir. */
  function paveRoute(etage) {
    const A = el();
    const box = A('div', { class: 'route' });
    for (const p of window.PERILS) {
      const ici = etage >= p.de && etage <= p.a;
      const q = p.garde ? window.Etat.qte(p.garde) : null;
      const atteint = (window.Etat.E.aventure.record || 0) >= p.de;
      box.appendChild(A('div', {
        'data-cle': p.id,
        class: 'pas-route p-' + p.id + (ici ? ' ici' : '') + (atteint ? '' : ' loin'),
        title: p.nom + ' — ' + p.peril },
        A('b', { text: p.nom }),
        A('i', { text: p.de + '–' + p.a }),
        p.garde
          ? A('span', { class: q > 0 ? 'bon' : 'mauvais', text: q + ' garde' + (q > 1 ? 's' : '') })
          : A('span', { class: 'faible', text: 'sans garde' })));
    }
    return box;
  }

  /* ==================================================================
     L'ÉQUIPÉE. Ce sont des habitants : ils quittent leur poste, ils
     rapportent leur caractère, et l'on peut ne pas les revoir.
     ================================================================== */
  function paveEquipee() {
    const A = el();
    const T = window.Tour;
    const box = A('div', {});
    const eq = T.equipee(), places = T.placesEquipee();
    box.appendChild(U().stats([
      ['équipée', eq.length + ' / ' + places, eq.length ? 'bon' : 'mauvais'],
      ['force', T.forceEquipee()],
      ['blessés', Object.keys(T.blesses).length, Object.keys(T.blesses).length ? 'mauvais' : ''],
      ['restés en bas', T.tombes.length, T.tombes.length ? 'mauvais' : ''],
    ]));
    box.appendChild(A('div', { class: 'note',
      text: "On descend avec des habitants du bourg. Ils quittent leur poste le temps de la descente, gagnent de l'expérience, et un Fragile tombe avant les autres. Un Peureux, lui, refuse net." }));

    for (const h of eq) {
      const meta = window.METIERS[h.talent] || { nom: '—', ico: { f: 'cube', c: ['#8a8272'] } };
      box.appendChild(A('div', { 'data-cle': 'eq' + h.id, class: 'cadre actif' },
        A('div', { class: 'rangee entre' },
          A('div', { class: 'rangee' },
            A('div', { class: 'av or' }, U().ico(meta.ico, 20)),
            A('div', {},
              A('div', { class: 'tt', style: 'font-size:14px', text: h.nom }),
              A('div', { class: 'eti', style: 'margin-top:4px',
                text: 'niveau ' + (h.niv || 1) + '  ·  ×' +
                      (window.HAB.produit(h, 'pv') * window.HAB.produit(h, 'degats')).toFixed(2).replace('.', ',') +
                      ' au combat' }))),
          A('button', { class: 'b mini danger', text: 'Laisser au bourg',
            onclick: () => { T.laisser(h.id); if (window.App) window.App.majAffectations(); } }))));
    }
    if (!eq.length) box.appendChild(A('div', { class: 'vide',
      html: 'Personne ne descend.<br>Choisissez qui accompagne la compagnie.' }));

    /* les candidats */
    const libres = window.Etat.E.habitants.filter(h => !T.dansEquipee(h.id) && T.disponible(h))
      .sort((a, b) => (b.niv || 1) - (a.niv || 1)).slice(0, 8);
    if (eq.length < places && libres.length) {
      box.appendChild(A('div', { class: 'eti', style: 'margin-top:12px', text: 'à emmener' }));
      const g = A('div', { class: 'rangee enroule' });
      for (const h of libres) {
        const val = (window.HAB.produit(h, 'pv') * window.HAB.produit(h, 'degats'));
        g.appendChild(A('button', {
          'data-cle': 'cand' + h.id, class: 'b mini' + (val > 1.05 ? ' primaire' : ''),
          title: window.HAB.listeTraits(h).map(t => window.HAB.trait(t).nom).join(' · '),
          text: h.nom + '  niv ' + (h.niv || 1),
          onclick: () => {
            const r = T.emmener(h.id);
            if (!r.ok) U().dire(r.pourquoi, 'alerte');
            else if (window.App) window.App.majAffectations();
          } }));
      }
      box.appendChild(g);
    }
    /* les convalescents */
    const bl = Object.keys(T.blesses);
    if (bl.length) {
      box.appendChild(A('div', { class: 'eti', style: 'margin-top:12px', text: 'en convalescence' }));
      for (const id of bl) {
        const h = window.Etat.habitant(id); if (!h) continue;
        box.appendChild(A('div', { 'data-cle': 'bl' + id, class: 'cadre' },
          A('div', { class: 'rangee entre' },
            A('span', { class: 'tt', style: 'font-size:13px', text: h.nom }),
            A('span', { class: 'eti', text: U().duree(T.convalescence(id)) })),
          A('div', { style: 'margin-top:8px' },
            U().barre(1 - T.convalescence(id) / 300, 'rouge', 'se remet', U().duree(T.convalescence(id))))));
      }
    }
    return box;
  }

  /* ==================================================================
     LES GARDIENS. Battus une fois, on peut y retourner — c'est la
     seule source de cœurs de biome, et donc de tout le reste.
     ================================================================== */
  function paveGardiens() {
    const A = el();
    const T = window.Tour;
    const box = A('div', {});
    const ouverts = T.gardiensOuverts();
    box.appendChild(A('div', { class: 'note',
      text: "Un gardien tous les dix étages. Le premier passage l'ouvre pour de bon : ensuite on peut y retourner autant qu'on veut, et c'est là que se trouvent les cœurs de biome." }));
    if (!ouverts.length) {
      const suivant = (Math.floor(T.profondeur() / 10) + 1) * 10;
      const g = T.gardienDe(suivant);
      box.appendChild(A('div', { class: 'cadre' },
        A('div', { class: 'tt', style: 'font-size:14px', text: 'Prochain : ' + (g ? g.nom : '—') }),
        A('div', { class: 'eti', style: 'margin-top:4px', text: 'étage ' + suivant }),
        A('div', { class: 'note', style: 'margin-top:4px', text: g ? g.desc : '' })));
      return box;
    }
    for (const e of ouverts.slice().reverse()) {
      const g = T.gardienDe(e); if (!g) continue;
      const ch = T.chanceGardien(e);
      const cout = T.coutRelance(e);
      const fiche = window.Etat.E.aventure.gardiens[e] || {};
      box.appendChild(A('div', { 'data-cle': 'g' + e, class: 'cadre' },
        A('div', { class: 'rangee entre' },
          A('span', { class: 'tt', style: 'font-size:14px', text: g.nom }),
          A('span', { class: 'eti-or', text: 'étage ' + e + '  ·  ' + (fiche.fois || 0) + ' fois' })),
        A('div', { class: 'note', style: 'margin-top:4px', text: g.desc }),
        A('div', { style: 'margin-top:8px' },
          U().barre(ch, 'grande ' + (ch > 0.65 ? 'vert' : (ch > 0.35 ? '' : 'rouge')),
            'chances de l\'emporter', Math.round(ch * 100) + ' %')),
        A('div', { class: 'rangee enroule', style: 'margin-top:8px' },
          A('span', { class: 'eti', text: 'butin' }),
          ...Object.keys(g.butin).map(k => U().puce(k, g.butin[k], { mini: true, gain: true }))),
        A('div', { class: 'rangee entre', style: 'margin-top:8px' },
          U().listeRes(cout, { verifier: true }),
          A('button', { class: 'b mini primaire', text: 'Y retourner',
            disabled: !window.Etat.assez(cout) || !T.equipee().length,
            onclick: () => {
              const r = T.relancerGardien(e);
              if (!r.ok) { U().dire(r.pourquoi, 'alerte'); return; }
              if (r.gagne) U().dire(g.nom + ' tombe. Butin ramené.', 'butin', 4500);
              else U().dire('L\'équipée recule' + (r.perdu ? ' — ' + r.perdu.nom + ' est resté en bas.' : '.'),
                            'alerte', 5000);
            } }))));
    }
    return box;
  }

  /* ==================================================================
     CEUX QUI SONT RESTÉS EN BAS. On paie le rite, ou l'on renonce —
     et renoncer coûte exactement ce que coûte un renvoi.
     ================================================================== */
  function paveTombes() {
    const A = el();
    const T = window.Tour;
    const box = A('div', {});
    box.appendChild(A('div', { class: 'note mauvais',
      text: "Ils ne sont pas encore perdus : le corps attend qu'on vienne le chercher. Renoncer, en revanche, coûte au bourg exactement ce que coûte un renvoi — portes closes, moral en berne, cadence en baisse." }));
    for (const t of T.tombes) {
      const cout = T.coutRite(t.id);
      box.appendChild(A('div', { 'data-cle': 't' + t.id, class: 'cadre alerte' },
        A('div', { class: 'rangee entre' },
          A('span', { class: 'tt', style: 'font-size:14px', text: t.nom }),
          A('span', { class: 'eti', text: 'étage ' + t.etage + '  ·  ' + t.ou })),
        A('div', { class: 'eti', style: 'margin-top:4px', text: 'niveau ' + t.niv }),
        A('div', { class: 'eti', style: 'margin-top:8px', text: 'le rite demande' }),
        U().listeRes(cout, { verifier: true }),
        A('div', { class: 'rangee', style: 'margin-top:8px' },
          A('button', { class: 'b primaire', text: 'Aller le chercher',
            disabled: !window.Etat.assez(cout),
            onclick: () => {
              const r = T.ramener(t.id);
              U().dire(r.ok ? r.nom + ' est remonté.' : r.pourquoi, r.ok ? 'bien' : 'alerte', 4500);
            } }),
          A('button', { class: 'b danger', text: 'Renoncer',
            onclick: () => {
              T.abandonner(t.id);
              U().dire('Le bourg ferme ses portes et baisse la tête.', 'alerte', 5000);
            } }))));
    }
    return box;
  }

  window.UIAventure = { rendre, ouvrir, fermer, tick, recolter,
    get ouvert() { return ouvert; } };
  window.Aventure = { tick };

})();
