/* ============================================================
   LE BOURG — js/ui-dock.js
   Trois pièces d'interface permanentes :

   · LE BANDEAU, en haut : de l'information vive, pas une barre de menu.
     Chaque compteur est cliquable et ouvre la fenêtre qui le concerne.
   · LE DOCK, à gauche, superposé au village : TOUS les chargements en
     cours du bourg, la file du chantier en tête. Il se replie d'un
     clic pour rendre le village entier à l'œil.
   · LES PRODUCTIONS, à droite : les ressources que les bâtiments déjà
     construits savent fabriquer, avec un raccourci pour lancer le poste.
   ============================================================ */
"use strict";
(function () {

  const U = window.UI, el = U.el;
  const E = () => window.Etat.E;

  let dock, liste, pied, tete, bandeau, menaceLigne, poignee, survol;
  let prod, prodCorps, prodPoignee;
  let replie = false, prodReplie = false, prodChoisie = null;

  function construire() {
    const couche = document.getElementById('couche');

    /* ---------------- bandeau ---------------- */
    bandeau = el('div', { id: 'bandeau' });
    couche.appendChild(bandeau);
    menaceLigne = el('button', { id: 'menace-ligne', title: 'Ouvrir la menace',
      onclick: () => window.UIFen.ouvrirBourg('menace') });
    couche.appendChild(menaceLigne);

    /* ---------------- dock ---------------- */
    tete = el('div', { id: 'dock-tete' });
    liste = el('div', { id: 'dock-liste' });
    pied = el('div', { id: 'dock-pied' });
    dock = el('div', { id: 'dock' }, tete, liste, pied);
    poignee = el('div', { id: 'dock-poignee', title: 'Replier / déplier (touche O)' }, el('span', { text: '‹' }));
    poignee.addEventListener('click', basculer);
    couche.appendChild(dock);
    couche.appendChild(poignee);

    /* ---------------- productions, à droite ---------------- */
    prodCorps = el('div', { id: 'productions-corps' });
    prod = el('div', { id: 'productions' },
      el('div', { id: 'productions-tete' },
        el('div', {},
          el('div', { class: 'tt', text: 'Productions' }),
          el('div', { class: 'eti', text: 'Ce que le bourg sait faire' })),
        el('button', { class: 'b mini', text: 'Replier', onclick: basculerProductions })),
      prodCorps);
    prodPoignee = el('div', { id: 'productions-poignee', title: 'Replier / déplier les productions' },
      el('span', { text: '›' }));
    prodPoignee.addEventListener('click', basculerProductions);
    couche.appendChild(prod);
    couche.appendChild(prodPoignee);

    survol = el('div', { id: 'survol' });
    couche.appendChild(survol);

    couche.appendChild(el('div', { id: 'barre-cons' }));
    couche.appendChild(el('div', { id: 'messages' }));

    majTete();
  }

  function basculer() {
    replie = !replie;
    dock.classList.toggle('replie', replie);
    poignee.style.left = replie ? '0px' : '';
    poignee.firstChild.textContent = replie ? '›' : '‹';
    E().options.dockOuvert = !replie;
  }

  function basculerProductions() {
    prodReplie = !prodReplie;
    prod.classList.toggle('replie', prodReplie);
    prodPoignee.style.right = prodReplie ? '0px' : '';
    prodPoignee.firstChild.textContent = prodReplie ? '‹' : '›';
  }

  function majTete() {
    U.vide(tete);
    tete.appendChild(el('div', {},
      el('div', { class: 'tt', text: 'En cours' }),
      el('div', { class: 'eti', id: 'dock-compte', text: '' })));
    tete.appendChild(el('button', { class: 'b mini', text: 'Replier', onclick: basculer }));
  }

  /* =================================================================
     LE VOLET DES PRODUCTIONS
     Une ressource n'apparaît que lorsqu'un bâtiment présent sait déjà
     exécuter une recette qui la rend. Le joueur part donc du résultat
     recherché, puis le volet remonte jusqu'au poste qui peut le produire.
     ================================================================= */
  function productionsDisponibles() {
    const parRes = new Map();
    for (const bid in E().bat) {
      const b = E().bat[bid];
      const recettes = window.BatUtil.recettesDe(b.type, b.niv, b);
      for (const rid of recettes) {
        const rec = window.REC[rid]; if (!rec) continue;
        for (const resId in rec.out) {
          if (!rec.out[resId] || !window.RES[resId]) continue;
          if (!parRes.has(resId)) parRes.set(resId, { id: resId, sources: [] });
          parRes.get(resId).sources.push({ bid, b, rid, rec });
        }
      }
    }
    return Array.from(parRes.values()).sort((a, b) => {
      const ra = window.RES[a.id], rb = window.RES[b.id];
      return String(ra.cat).localeCompare(String(rb.cat), 'fr') || ra.nom.localeCompare(rb.nom, 'fr');
    });
  }

  function debitRessource(item) {
    let total = 0;
    for (const s of item.sources) {
      for (const p of s.b.postes) {
        if (p.rec !== s.rid || !p.hab || p.bloque) continue;
        const h = window.Etat.habitant(p.hab);
        const v = window.Jeu.vitessePoste(s.b, s.rec, h);
        total += s.rec.out[item.id] * 60 / (s.rec.duree / Math.max(.001, v));
      }
    }
    return total;
  }

  function majProductions() {
    if (!prodCorps) return;
    const items = productionsDisponibles();
    if (prodChoisie && !items.some(x => x.id === prodChoisie)) prodChoisie = null;
    U.rendreDans(prodCorps, hote => {
      if (!items.length) {
        hote.appendChild(el('div', { class: 'prod-vide' },
          el('div', { class: 'tt', text: 'Rien à produire' }),
          el('div', { class: 'note', text: 'Construisez une pêcherie, un champ ou un atelier : ses ressources apparaîtront ici.' })));
        return;
      }
      hote.appendChild(el('div', { class: 'prod-intro', text: 'Choisissez une ressource pour voir où et comment la produire.' }));
      const grille = el('div', { id: 'productions-grille' });
      for (const item of items) {
        const r = window.RES[item.id], debit = debitRessource(item);
        grille.appendChild(el('button', {
          'data-cle': item.id, class: 'prod-res' + (prodChoisie === item.id ? ' on' : ''),
          title: r.nom + '\nStock : ' + U.fmt(window.Etat.qte(item.id)),
          onclick: () => { prodChoisie = item.id; majProductions(); },
        },
          el('span', { class: 'prod-res-ico' }, U.icoRes(item.id, 30)),
          el('span', { class: 'prod-res-texte' },
            el('b', { text: r.nom }),
            el('i', { text: debit > 0 ? '+' + (Math.round(debit * 10) / 10).toString().replace('.', ',') + '/min' : U.fmt(window.Etat.qte(item.id)) + ' en stock' }))));
      }
      hote.appendChild(grille);
      if (prodChoisie) {
        const item = items.find(x => x.id === prodChoisie);
        if (item) hote.appendChild(detailProduction(item));
      }
    });
  }

  function detailProduction(item) {
    const r = window.RES[item.id];
    const box = el('div', { id: 'production-detail', 'data-cle': 'detail:' + item.id },
      el('div', { class: 'prod-detail-titre' },
        U.icoRes(item.id, 38),
        el('div', {}, el('div', { class: 'tt', text: r.nom }),
          el('div', { class: 'eti', text: U.fmt(window.Etat.qte(item.id)) + ' en réserve' }))));

    for (const s of item.sources) {
      const actifs = s.b.postes.filter(p => p.rec === s.rid && p.hab && !p.bloque).length;
      let i = s.b.postes.findIndex(p => p.rec === s.rid && !p.hab);
      if (i < 0) i = s.b.postes.findIndex(p => p.hab && !p.rec);
      if (i < 0) i = s.b.postes.findIndex(p => !p.hab);
      const poste = i >= 0 ? s.b.postes[i] : null;
      const besoinHabitant = !!(poste && !poste.hab);
      const libre = window.Etat.habitantsLibres().length > 0;
      const meta = window.METIERS[s.rec.metier];
      const ligne = el('div', { class: 'prod-source' },
        el('div', { class: 'prod-source-haut' },
          meta ? U.ico(meta.ico, 20) : null,
          el('div', { class: 'prod-source-nom' },
            el('b', { text: s.rec.nom }),
            el('span', { text: window.BAT[s.b.type].nom + ' · ' + s.rec.out[item.id] + ' par cycle · ' + U.duree(s.rec.duree) })),
          actifs ? el('span', { class: 'prod-actif', text: actifs + ' actif' + (actifs > 1 ? 's' : '') }) : null));
      const flux = el('div', { class: 'prod-flux' });
      for (const k in s.rec.in) flux.appendChild(U.puce(k, s.rec.in[k], { mini: true, insuffisant: window.Etat.qte(k) < s.rec.in[k] }));
      if (Object.keys(s.rec.in).length) flux.appendChild(el('span', { class: 'prod-fleche', text: '→' }));
      flux.appendChild(U.puce(item.id, s.rec.out[item.id], { mini: true, gain: true }));
      ligne.appendChild(flux);

      if (poste) {
        ligne.appendChild(el('button', { class: 'b mini pleine' + ((!besoinHabitant || libre) ? ' primaire' : ''),
          disabled: besoinHabitant && !libre,
          text: besoinHabitant && !libre ? 'Aucun habitant libre' : (actifs ? 'Ajouter un travailleur' : 'Produire'),
          onclick: () => {
            window.Jeu.definirRecette(s.bid, i, s.rid, null);
            if (!poste.hab) {
              const a = window.Jeu.assignerAuto(s.bid, i);
              if (!a.ok) { U.dire(a.raison, 'alerte'); return; }
            }
            U.dire(r.nom + ' : production lancée.', 'bien');
            if (window.App) { window.App.majAffectations(); window.App.rafraichirUI(); }
          } }));
      } else {
        ligne.appendChild(el('button', { class: 'b mini pleine', text: actifs ? 'Voir la production' : 'Tous les postes sont pris',
          onclick: () => window.UIFen.ouvrirBatiment(s.bid) }));
      }
      box.appendChild(ligne);
    }
    return box;
  }

  /* =================================================================
     LE BANDEAU
     ================================================================= */
  /* ------------------------------------------------------------------
     LE BANDEAU. On le rebâtit franchement à chaque fois, puis on le
     FOND dans celui qui est déjà à l'écran : les nœuds survivent, donc
     le survol tient, et les jauges glissent au lieu de sauter.
     ------------------------------------------------------------------ */
  /* `rang` : 1 = ce qu'on lit tout le temps, 2 = ce qu'on consulte,
     3 = ce qui doit se faire oublier. `alerte` : une décision attend,
     ou quelque chose se gâte — c'est le SEUL cas où l'on colore. */
  function bloc(cle, valeur, opts) {
    opts = opts || {};
    const col = el('div', { class: 'col' },
      el('span', { class: 'v ' + (opts.classe || ''), text: valeur }));
    if (opts.jauge != null) {
      const j = el('div', { class: 'jauge-mince' + (opts.danger ? ' danger' : (opts.or ? ' or' : '')) });
      const i = el('i'); i.style.width = Math.max(0, Math.min(100, opts.jauge * 100)).toFixed(1) + '%';
      j.appendChild(i); col.appendChild(j);
    }
    col.appendChild(el('span', { class: 'k', text: opts.libelle || cle }));
    return el('div', {
      'data-cle': cle,
      class: 'bloc r' + (opts.rang || 2)
           + (opts.action ? '' : ' inerte')
           + (opts.alerte ? ' alerte' : '')
           + (opts.attente ? ' attente' : ''),
      title: opts.titre || '', onclick: opts.action || null,
    }, opts.res ? U.icoRes(opts.res, 22)
      : (opts.ico ? U.ico(opts.ico, 20) : null), col);
  }

  /* Un séparateur de groupe : un vide franc, pas un filet de plus. */
  function ecart() { return el('div', { class: 'ecart' }); }

  function majBandeau() {
    U.rendreDans(bandeau, b => remplirBandeau(b));
    majMenaceLigne();
  }

  function ressourcesSuivies() {
    if (!E().options) E().options = {};
    if (!Array.isArray(E().options.ressourcesSuivies))
      E().options.ressourcesSuivies = ['ecu', 'pain', 'planche'];
    E().options.ressourcesSuivies = E().options.ressourcesSuivies
      .filter((id, i, a) => window.RES[id] && a.indexOf(id) === i).slice(0, 4);
    return E().options.ressourcesSuivies;
  }

  function estSuivie(id) { return ressourcesSuivies().indexOf(id) >= 0; }

  function basculerSuivi(id) {
    if (!window.RES[id]) return false;
    const l = ressourcesSuivies(), i = l.indexOf(id);
    if (i >= 0) l.splice(i, 1);
    else {
      if (l.length >= 4) {
        U.dire('Quatre ressources maximum dans le bandeau.', 'alerte');
        return false;
      }
      l.push(id);
    }
    window.Etat.sauver(true);
    majBandeau();
    return l.indexOf(id) >= 0;
  }

  function majMenaceLigne() {
    if (!menaceLigne) return;
    const E2 = E(), pal = window.Jeu.palierMenace();
    const pct = Math.max(0, Math.min(100, E2.menace));
    U.rendreDans(menaceLigne, h => {
      const piste = el('span', { class: 'menace-piste' });
      const plein = el('i'); plein.style.width = pct.toFixed(1) + '%'; piste.appendChild(plein);
      h.appendChild(piste);
      h.appendChild(el('span', { class: 'menace-legende',
        text: 'Menace ' + Math.floor(pct) + '% · cadence ' + Math.round(pal.mult * 100) + '%' }));
    });
    menaceLigne.classList.toggle('alerte', pct >= 65);
    menaceLigne.title = pal.nom + ' — ' + pal.desc + '\nCliquer pour agir.';
  }

  function remplirBandeau(hote) {
    const E2 = E();
    const pousser = n => { hote.appendChild(n); return n; };

    pousser(el('div', { 'data-cle': '__titre', class: 'bloc grow r1',
      title: 'Le bourg : moral, menace, objectifs, mémorial.',
      onclick: () => window.UIFen.ouvrirBourg() },
      el('div', { class: 'col' },
        el('span', { class: 'nomv', text: window.Village ? window.Village.nom() : '—' }),
        el('span', { class: 'k',
          text: (window.Village ? window.Village.rang() : '') + '  ·  jour ' + E2.jours }))));

    pousser(ecart());

    /* LES BRAS. Le chiffre qui décide de tout le reste : on l'écrit en
       grand, et l'on ne signale que le cas qui appelle un geste —
       quelqu'un qui ne fait rien. */
    const libres = window.Etat.habitantsLibres().length;
    pousser(bloc(libres ? 'sans emploi' : 'habitants',
      libres ? libres + ' libre' + (libres > 1 ? 's' : '') : E2.habitants.length + '', {
      rang: 1, attente: !!libres,
      titre: libres
        ? libres + ' habitant(s) ne font rien. Un habitant libre est un poste qui ne tourne pas — placez-les.'
        : E2.habitants.length + ' habitants, tous au travail.',
      action: () => window.UIFen.ouvrirHabitants('roles'),
    }));

    /* LES PORTES. Un toit libre est une décision qui attend : le bandeau
       le dit, sinon le joueur ne pense jamais à ouvrir. */
    const places = window.Etat.placesLibres();
    const closes = window.Etat.portesBarrees();
    const troisLa = !!(E2.portes && E2.portes.postulants);
    if (places > 0 || closes > 0 || troisLa) pousser(bloc('portes',
      troisLa ? '3 à la porte' : (closes > 0 ? U.duree(closes) : places + ''), {
      ico: { f: 'porte', c: ['#8a6a44', '#4a3524'] },
      rang: 1, attente: troisLa || places > 0, alerte: closes > 0,
      titre: troisLa ? 'Trois voyageurs attendent votre réponse.'
        : closes > 0 ? 'Les portes sont closes : le bourg a mauvaise réputation en ce moment.'
        : places + ' toit(s) libre(s). Ouvrez les portes pour choisir qui s\'installe.',
      action: () => window.UIFen.ouvrirHabitants('portes'),
    }));

    pousser(ecart());

    /* Le joueur décide ce qui mérite une place permanente. Les étoiles
       du stock alimentent directement cette rangée. */
    for (const id of ressourcesSuivies()) {
      const r = window.RES[id], q = window.Etat.qte(id);
      const d = window.Marche ? window.Marche.debit(id) * 60 : 0;
      const cap = window.Etat.plafonds()[r.cat];
      const plein = cap && cap < 9000 && q >= cap;
      pousser(bloc('suivi:' + id, U.fmt(q), {
        res: id, rang: 2, alerte: !!plein, libelle: r.nom,
        titre: r.nom + ' : ' + U.fmt(q) + (cap && cap < 9000 ? ' / ' + U.fmt(cap) : '')
          + (Math.abs(d) >= .05 ? '\n' + (d > 0 ? '+' : '') + (Math.round(d * 10) / 10).toString().replace('.', ',') + ' /min' : '')
          + '\nRetirez ou ajoutez des suivis dans les réserves.',
        action: () => window.UIFen.ouvrirReserves(r.cat),
      }));
    }
    pousser(bloc('stocks', '+', {
      rang: 3, libelle: 'suivre', titre: 'Choisir les ressources affichées dans le bandeau.',
      action: () => window.UIFen.ouvrirReserves(),
    }));

    pousser(ecart());

    pousser(bloc('moral', E2.moral + '%', {
      rang: 2, alerte: E2.moral < 35,
      jauge: E2.moral / 100, danger: E2.moral < 35,
      classe: E2.moral >= 70 ? 'bon' : (E2.moral < 35 ? 'mauvais' : ''),
      titre: 'Le moral multiplie toutes les cadences du bourg (×' +
             window.Jeu.multGlobal().toFixed(2).replace('.', ',') + ' actuellement).',
      action: () => window.UIFen.ouvrirBourg('general'),
    }));

    /* les objectifs à réclamer : un point d'attention discret, mais qui
       ne laisse pas une récompense dormir six heures. */
    const att = window.Prestige ? window.Prestige.enAttente() : 0;
    if (att) pousser(bloc('à réclamer', att, {
      ico: { f: 'etoile', c: ['#e8d6a8', '#b09a60'] }, classe: 'bon',
      titre: att + ' objectif(s) atteint(s) attendent leur récompense.',
      action: () => window.UIFen.ouvrirBourg('objectifs'),
    }));

    pousser(ecart());

    pousser(bloc('heure', window.Village ? U.heure(window.Village.heure()) : '—', {
      rang: 3, classe: 'faible',
      titre: 'Jour ' + E2.jours + ' au bourg. La nuit, les fenêtres s\'allument ;\n'
           + 'les cadences, elles, ne changent pas.',
    }));

    /* le dernier bloc : les réglages. Discret, toujours à la même place. */
    pousser(bloc('réglages', '·', {
      ico: { f: 'roue', c: ['#6d5236', '#3a2c1e'] }, rang: 3, classe: 'faible',
      titre: 'Affichage, confort, sauvegarde  (touche G)',
      action: () => window.UIFen.ouvrirReglages(),
    }));

  }

  /* Combien de sortes sont au plafond. C'est la seule chose que le
     bandeau ait besoin de dire sur les stocks : le reste attend dans
     l'inventaire. */
  function comptePleins() {
    const caps = window.Etat.plafonds();
    let n = 0;
    for (const id in window.RES) {
      const cap = caps[window.RES[id].cat];
      if (cap && cap < 9000 && window.Etat.qte(id) >= cap) n++;
    }
    return n;
  }

  function etatVivres() {
    let total = 0;
    for (const id in window.Jeu.PORTIONS) total += window.Etat.qte(id) * window.Jeu.PORTIONS[id];
    const conso = Math.max(0.001, E().habitants.length * window.Jeu.BESOIN_PAR_HABITANT);
    const s = total / conso;
    if (E().famine) return { txt: 'vide', s: 0 };
    if (s > 3600 * 3) return { txt: 'abondants', s };
    return { txt: U.duree(s), s };
  }

  /* =================================================================
     LE DOCK — la liste des barres
     ================================================================= */
  /* La signature d'une tâche : tout ce qui se voit sur sa carte. Tant
     qu'elle ne change pas, on ne refabrique rien du tout — un bourg de
     cinquante ateliers ne coûte alors que les deux barres qui bougent. */
  function signature(x) {
    return x.k + '|' + x.nom + '|' + x.bloque + '|' + (x.attente || 0) + '|' + x.hab +
           '|' + (x.detail || '') + '|' + x.lieu + '|' + (x.res || '') + '|' + (x.type || '') + '|' + (x.unite || '') + '|' + (x.debit || 0) +
           '|' + Math.round((x.prog || 0) * 400) + '|' + Math.round(x.reste || 0);
  }
  const vues = new Map();
  function majDock() {
    /* CE QUI EST BLOQUÉ PASSE DEVANT. Une barre à l'arrêt faute de
       matière est la seule qui réclame quelque chose ; noyée au milieu
       de douze barres qui avancent, elle ne se voit pas. On garde
       l'ordre d'origine pour tout le reste — un dock qui se réordonne
       sans cesse est illisible. */
    const t = window.Jeu.taches().slice().sort((a, b) =>
      (b.bloque ? 1 : 0) - (a.bloque ? 1 : 0));
    U.rendreDans(liste, hote => {
      if (!t.length) {
        vues.clear();
        const rien = el('div', { 'data-cle': 'vide', class: 'vide' },
          el('div', { text: 'Le bourg ne fait rien.' }));
        /* Un panneau qui constate un vide doit porter le geste qui le
           comble : sans quoi le joueur lit une remontrance et va
           chercher ailleurs par où commencer. */
        const nBat = Object.keys(E().bat).length;
        const libres = window.Etat.habitantsLibres().length;
        if (!nBat) {
          rien.appendChild(el('div', { class: 'note', style: 'margin-top:8px',
            text: "L'île est nue. Posez un premier édifice : la pêcherie nourrit, la scierie bâtit." }));
          rien.appendChild(el('button', { class: 'b primaire', style: 'margin-top:12px',
            text: 'Choisir quoi bâtir', onclick: () => window.UIFen.ouvrirChantier() }));
        } else if (libres) {
          rien.appendChild(el('div', { class: 'note', style: 'margin-top:8px',
            text: libres + ' habitant' + (libres > 1 ? 's' : '') + ' sans emploi. Un poste tenu, et le bourg repart.' }));
          rien.appendChild(el('button', { class: 'b primaire', style: 'margin-top:12px',
            text: 'Placer les bras', onclick: () => window.UIFen.ouvrirHabitants('roles') }));
        } else {
          rien.appendChild(el('div', { class: 'note', style: 'margin-top:8px',
            text: 'Aucun habitant disponible. Bâtissez un logement, puis ouvrez les portes.' }));
          rien.appendChild(el('button', { class: 'b', style: 'margin-top:12px',
            text: 'Voir les habitants', onclick: () => window.UIFen.ouvrirHabitants('roles') }));
        }
        hote.appendChild(rien);
        return;
      }
      const vus = new Set();
      for (const x of t) {
        vus.add(x.id);
        const sig = signature(x), vu = vues.get(x.id);
        if (vu && vu.sig === sig && vu.noeud.parentNode === liste) {
          hote.appendChild(el('div', { 'data-cle': x.id, 'data-vif': '1' }));
          continue;
        }
        const n = carte(x);
        vues.set(x.id, { sig, noeud: n });
        hote.appendChild(n);
      }
      for (const id of Array.from(vues.keys())) if (!vus.has(id)) vues.delete(id);
    });
    /* le nœud gardé en place est celui qui vit dans le dock : on
       réaligne le cache après la fusion. */
    for (const [id, vu] of vues)
      if (vu.noeud.parentNode !== liste) {
        const vrai = liste.querySelector('[data-cle="' + CSS.escape(id) + '"]');
        if (vrai) vu.noeud = vrai;
      }
    const cp = document.getElementById('dock-compte');
    if (cp) cp.textContent = t.length ? t.length + ' en cours' : 'rien en cours';
    majPied();
  }

  /* `data-cle` porte l'identité de la tâche : la réconciliation sait
     alors qu'une carte qui descend d'un cran reste LA MÊME carte, et
     ne va pas recopier le contenu d'une voisine dedans. */
  function carte(x) {
    const cls = 'tache ' + x.k + (x.bloque ? ' bloquee' : '');
    const teinte = x.bloque ? 'rouge' : (x.k === 'chantier' ? '' :
                   x.k === 'aventure' ? 'bleu' : x.k === 'expedition' ? 'violet' : 'vert');
    const pct = Math.round((x.prog || 0) * 100);
    const gain = x.bloque ? 'en attente'
      : x.res && x.debit ? '+' + (Math.round(x.debit * 10) / 10).toString().replace('.', ',') + '/min'
      : (x.reste != null ? U.duree(x.reste) : pct + '%');
    const titre = [x.nom, x.lieu, x.hab, x.detail, x.bloque ? 'En attente' : U.duree(x.reste)]
      .filter(Boolean).join('\n');
    let visuel = null;
    if (x.unite && window.Img && window.Img.unite) {
      const src = window.Img.unite(x.unite);
      if (src) visuel = window.Img.vignette(src, 44, x.nom, 'vig-unite tache-image');
    }
    if (!visuel && x.k === 'chantier' && x.type && window.Img && window.Img.bat) {
      const src = window.Img.bat(x.type);
      if (src) visuel = window.Img.vignette(src, 44, x.lieu || x.nom, 'vig-bat tache-image');
    }
    /* Une production classique doit rester identifiée par sa ressource
       (bois, poisson, etc.) : le bâtiment ne prend sa place que pour les
       chantiers sans sortie, ou les tâches spéciales sans ressource. */
    if (!visuel && x.res) visuel = U.icoRes(x.res, 44);
    if (!visuel && x.bat && window.Img && window.Img.bat) {
      const b = E().bat[x.bat], src = b ? window.Img.bat(b.type) : null;
      if (src) visuel = window.Img.vignette(src, 44, x.lieu || x.nom, 'vig-bat tache-image');
    }
    if (!visuel) visuel = U.ico(x.ico, 38);
    return el('div', { class: cls, 'data-cle': x.id, 'data-id': x.id, title: titre,
      'aria-label': x.nom + ', ' + gain, onclick: () => ouvrirDe(x) },
      el('span', { class: 'tache-visuel' }, visuel),
      el('div', { class: 'tache-lecture' },
        el('div', { class: 'tache-mini' },
          el('span', { text: x.res && window.RES[x.res] ? window.RES[x.res].nom : x.nom }),
          el('i', { text: pct + '%' })),
        U.barre(x.prog, 'grande ' + teinte + (x.bloque ? ' raye' : '')),
        el('div', { class: 'tache-gain', text: gain })));
  }

  function ouvrirDe(x) {
    if (x.k === 'poste') window.UIFen.ouvrirBatiment(x.bat);
    else if (x.k === 'chantier') window.UIFen.ouvrirChantier('file');
    else if (x.k === 'aventure') window.UIAventure.ouvrir();
    else if (x.k === 'expedition') window.UIExpedition.ouvrir();
  }

  function majPied() {
    const E2 = E();
    const libres = window.Etat.habitantsLibres().length;
    /* L'information la plus actionnable de l'écran ne peut pas rester
       inerte : on la rend cliquable, et l'on montre qu'elle l'est. */
    pied.className = libres ? 'appelable' : '';
    pied.onclick = libres ? (() => window.UIFen.ouvrirHabitants('roles')) : null;
    /* un attribut vide reste un attribut : le survol croirait avoir une
       bulle à montrer, et clignoterait sur un cadre vide. */
    if (libres) pied.dataset.bulle = ['Placer les bras',
      libres + ' habitant(s) ne produisent rien. Cliquez pour les affecter.'].join('\n');
    else delete pied.dataset.bulle;
    pied.textContent = libres
      ? libres + ' habitant' + (libres > 1 ? 's' : '') + ' sans emploi  ·  placer'
      : 'Tout le monde est au travail.';
    /* la famine prime sur tout : c'est la seule chose à lire ici. */
    if (E2.famine) {
      pied.textContent = 'FAMINE — cadences réduites de moitié.';
      pied.className = 'mauvais';
      pied.onclick = () => window.UIFen.ouvrirReserves('vivres');
      pied.dataset.bulle = ['La grange est vide',
                    'Tout le bourg travaille à moitié vitesse tant qu\'il n\'y a rien à manger.',
                    'Cliquez pour voir les vivres.'].join('\n');
    }
  }

  /* =================================================================
     L'INFOBULLE DE SURVOL DU VILLAGE
     ================================================================= */
  function montrerSurvol(bat) {
    if (!bat) { survol.classList.remove('vu'); return; }
    const b = E().bat[bat.id];
    const def = b ? window.BAT[b.type] : null;
    /* L'infobulle suit la souris : la refabriquer à chaque pixel la
       faisait battre. On n'y remplace plus que les mots qui changent. */
    U.rendreDans(survol, h => {
      if (def) {
        h.appendChild(el('div', { class: 'n', text: def.nom + ' · niv ' + b.niv }));
        const actifs = b.postes.filter(p => p.hab && p.rec).length;
        h.appendChild(el('div', { class: 'd',
          text: b.endommage > 0 ? 'endommagé'
            : (b.postes.length ? actifs + ' / ' + b.postes.length + ' postes actifs' : def.metier) }));
      } else {
        const job = E().chantier.file.find(j => j.bat === bat.id);
        h.appendChild(el('div', { class: 'n', text: job ? job.nom : 'Chantier' }));
        h.appendChild(el('div', { class: 'd', text: job ? 'en chantier' : '' }));
      }
    });
    const p = window.Village.ecran(bat);
    if (p) {
      survol.style.left = Math.round(p.cx) + 'px';
      survol.style.top = Math.round(p.cy - 8) + 'px';
    }
    survol.classList.add('vu');
  }

  window.UIDock = { construire, majDock, majBandeau, majProductions, montrerSurvol, basculer,
    estSuivie, basculerSuivi,
    get replie() { return replie; },
    get productionReplie() { return prodReplie; } };

})();
