/* ============================================================
   LE BOURG — js/ui-dock.js
   Deux pièces d'interface permanentes, et seulement deux :

   · LE BANDEAU, en haut : de l'information vive, pas une barre de menu.
     Chaque compteur est cliquable et ouvre la fenêtre qui le concerne.
   · LE DOCK, à gauche, superposé au village : TOUS les chargements en
     cours du bourg, la file du chantier en tête. Il se replie d'un
     clic pour rendre le village entier à l'œil.
   ============================================================ */
"use strict";
(function () {

  const U = window.UI, el = U.el;
  const E = () => window.Etat.E;

  let dock, liste, pied, tete, bandeau, poignee, survol;
  let replie = false;

  function construire() {
    const couche = document.getElementById('couche');

    /* ---------------- bandeau ---------------- */
    bandeau = el('div', { id: 'bandeau' });
    couche.appendChild(bandeau);

    /* ---------------- dock ---------------- */
    tete = el('div', { id: 'dock-tete' });
    liste = el('div', { id: 'dock-liste' });
    pied = el('div', { id: 'dock-pied' });
    dock = el('div', { id: 'dock' }, tete, liste, pied);
    poignee = el('div', { id: 'dock-poignee', title: 'Replier / déplier (touche O)' }, el('span', { text: '‹' }));
    poignee.addEventListener('click', basculer);
    couche.appendChild(dock);
    couche.appendChild(poignee);

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

  function majTete() {
    U.vide(tete);
    tete.appendChild(el('div', {},
      el('div', { class: 'tt', text: 'Ordres du jour' }),
      el('div', { class: 'eti', id: 'dock-compte', text: '' })));
    tete.appendChild(el('button', { class: 'b mini', text: 'Replier', onclick: basculer }));
  }

  /* =================================================================
     LE BANDEAU
     ================================================================= */
  /* ------------------------------------------------------------------
     LE BANDEAU. On le rebâtit franchement à chaque fois, puis on le
     FOND dans celui qui est déjà à l'écran : les nœuds survivent, donc
     le survol tient, et les jauges glissent au lieu de sauter.
     ------------------------------------------------------------------ */
  function bloc(cle, valeur, opts) {
    opts = opts || {};
    const col = el('div', { class: 'col' },
      el('span', { class: 'v ' + (opts.classe || ''), text: valeur }));
    if (opts.jauge != null) {
      const j = el('div', { class: 'jauge-mince' + (opts.danger ? ' danger' : (opts.or ? ' or' : '')) });
      const i = el('i'); i.style.width = Math.max(0, Math.min(100, opts.jauge * 100)).toFixed(1) + '%';
      j.appendChild(i); col.appendChild(j);
    }
    col.appendChild(el('span', { class: 'k', text: cle }));
    return el('div', {
      'data-cle': cle, class: 'bloc' + (opts.action ? '' : ' inerte'),
      title: opts.titre || '', onclick: opts.action || null,
    }, opts.ico ? U.ico(opts.ico, 20) : null, col);
  }

  function majBandeau() {
    U.rendreDans(bandeau, b => remplirBandeau(b));
  }

  function remplirBandeau(hote) {
    const E2 = E();
    const pousser = n => { hote.appendChild(n); return n; };

    pousser(el('div', { 'data-cle': '__titre', class: 'bloc grow',
      onclick: () => window.UIFen.ouvrirBourg() },
      el('div', { class: 'col' },
        el('span', { class: 'nomv', text: window.Village ? window.Village.nom() : '—' }),
        el('span', { class: 'k',
          text: (window.Village ? window.Village.rang() : '') + '  ·  jour ' + E2.jours }))));

    const libres = window.Etat.habitantsLibres().length;
    pousser(bloc('habitants', libres + ' / ' + E2.habitants.length, {
      classe: libres ? 'bon' : '', titre: 'Habitants libres sur le total. Un habitant libre est un poste qui ne tourne pas.',
      action: () => window.UIFen.ouvrirHabitants(),
    }));

    /* LES PORTES. Un toit libre est une décision qui attend : le bandeau
       le dit, sinon le joueur ne pense jamais à ouvrir. */
    const places = window.Etat.placesLibres();
    const closes = window.Etat.portesBarrees();
    const troisLa = !!(E2.portes && E2.portes.postulants);
    if (places > 0 || closes > 0 || troisLa) pousser(bloc('portes',
      troisLa ? '3 à la porte' : (closes > 0 ? U.duree(closes) : places + ''), {
      ico: { f: 'porte', c: ['#8a6a44', '#4a3524'] },
      classe: troisLa ? 'bon' : (closes > 0 ? 'mauvais' : 'bon'),
      titre: troisLa ? 'Trois voyageurs attendent votre réponse.'
        : closes > 0 ? 'Les portes sont closes : le bourg a mauvaise réputation en ce moment.'
        : places + ' toit(s) libre(s). Ouvrez les portes pour choisir qui s\'installe.',
      action: () => window.UIFen.ouvrirHabitants('portes'),
    }));

    pousser(bloc('écus', U.fmt(window.Etat.qte('ecu')), {
      ico: window.RES.ecu.ico, titre: 'Le trésor du bourg.',
      action: () => window.UIFen.ouvrirReserves('monnaie'),
    }));

    const vivres = etatVivres();
    pousser(bloc('vivres', vivres.txt, {
      ico: window.RES.pain.ico, classe: E2.famine ? 'mauvais' : (vivres.s > 1800 ? 'bon' : ''),
      jauge: Math.min(1, vivres.s / 3600), danger: vivres.s < 300, or: vivres.s < 900,
      titre: 'Autonomie de la grange au rythme actuel. Vide : tout ralentit de moitié.',
      action: () => window.UIFen.ouvrirReserves('vivres'),
    }));

    pousser(bloc('moral', E2.moral, {
      jauge: E2.moral / 100, danger: E2.moral < 35,
      classe: E2.moral >= 70 ? 'bon' : (E2.moral < 35 ? 'mauvais' : ''),
      titre: 'Le moral multiplie toutes les cadences du bourg (×' +
             window.Jeu.multGlobal().toFixed(2).replace('.', ',') + ' actuellement).',
      action: () => window.UIFen.ouvrirBourg('general'),
    }));

    pousser(bloc('menace', Math.floor(E2.menace), {
      jauge: E2.menace / 100, danger: E2.menace > 65,
      classe: E2.menace > 80 ? 'mauvais' : '',
      titre: 'À 100, une colonne arrive. Défense actuelle : ' + window.Jeu.defenseTotale() + '.',
      action: () => window.UIFen.ouvrirBourg('menace'),
    }));

    /* les objectifs à réclamer : un point d'attention discret, mais qui
       ne laisse pas une récompense dormir six heures. */
    const att = window.Prestige ? window.Prestige.enAttente() : 0;
    if (att) pousser(bloc('à réclamer', att, {
      ico: { f: 'etoile', c: ['#e8d6a8', '#b09a60'] }, classe: 'bon',
      titre: att + ' objectif(s) atteint(s) attendent leur récompense.',
      action: () => window.UIFen.ouvrirBourg('objectifs'),
    }));

    const f = E2.chantier.file.length;
    const job = E2.chantier.file[0];
    const sansBras = f && !E2.chantier.ouvriers.length;
    pousser(bloc(f ? 'chantier' : 'chantier', f ? f + '' : '—', {
      ico: window.METIERS.batisse.ico,
      classe: sansBras ? 'mauvais' : '',
      jauge: job ? Math.min(1, E2.chantier.prog / job.temps) : null,
      danger: !!sansBras, or: !sansBras,
      titre: f ? (sansBras ? 'Personne au chantier : rien n\'avance.'
                           : job.nom + ' — ' + E2.chantier.ouvriers.length + ' ouvrier(s)')
               : 'Rien en chantier. Cliquez le sol pour ouvrir le carnet.',
      action: () => window.UIFen.ouvrirChantier(),
    }));

    pousser(bloc('heure', window.Village ? U.heure(window.Village.heure()) : '—', { classe: 'faible' }));

    /* le dernier bloc : les réglages. Discret, toujours à la même place. */
    pousser(bloc('réglages', '·', {
      ico: { f: 'roue', c: ['#6d5236', '#3a2c1e'] }, classe: 'faible',
      titre: 'Affichage, confort, sauvegarde  (touche G)',
      action: () => window.UIFen.ouvrirReglages(),
    }));

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
           '|' + (x.detail || '') + '|' + x.lieu +
           '|' + Math.round((x.prog || 0) * 400) + '|' + Math.round(x.reste || 0);
  }
  const vues = new Map();
  function majDock() {
    const t = window.Jeu.taches();
    U.rendreDans(liste, hote => {
      if (!t.length) {
        vues.clear();
        hote.appendChild(el('div', { 'data-cle': 'vide', class: 'vide',
          html: 'Le bourg ne fait rien.<br><br>Ouvrez un édifice et mettez<br>un habitant au travail.' }));
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
    return el('div', { class: cls, 'data-cle': x.id, 'data-id': x.id, onclick: () => ouvrirDe(x) },
      el('div', { class: 'l1' },
        el('span', { class: 'ico' }, U.ico(x.ico, 18)),
        el('span', { class: 'nom', text: x.nom }),
        el('span', { class: 'tps', text: Math.round((x.prog || 0) * 100) + ' %' })),
      U.barre(x.prog, 'grande ' + teinte + (x.bloque ? ' raye' : ''),
        x.bloque ? 'en attente' : x.hab,
        x.bloque ? '' : U.duree(x.reste)),
      el('div', { class: 'l2' },
        el('span', { class: 'ou', text: x.lieu + (x.attente ? ' +' + x.attente : '') }),
        el('span', { class: 'qu', text: x.detail || '' })));
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
    pied.textContent = libres
      ? libres + ' habitant' + (libres > 1 ? 's' : '') + ' sans emploi'
      : 'Tout le monde est au travail.';
    if (E2.famine) { pied.textContent = 'FAMINE — cadences réduites de moitié.'; pied.className = 'mauvais'; }
    else pied.className = '';
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

  window.UIDock = { construire, majDock, majBandeau, montrerSurvol, basculer,
    get replie() { return replie; } };

})();
