/* ============================================================
   LE BOURG — js/ui-fenetres.js
   Les fenêtres du jeu. Il n'y a pas de menu : on clique un édifice et
   sa fenêtre s'ouvre au-dessus de lui ; on clique le sol et c'est le
   carnet du maître d'œuvre qui s'ouvre.

   Chaque fenêtre a ses onglets — les POSTES d'abord, parce que c'est
   là que le joueur passe sa partie ; puis le chantier d'amélioration,
   l'outillage, et la notice.
   ============================================================ */
"use strict";
(function () {

  const U = window.UI, el = U.el;
  const E = () => window.Etat.E;
  let postulantChoisi = null;
  let collectionFiltre = 'tous', habFicheId = null, entrainementHabId = null;

  /* =================================================================
     OUTILS D'AFFICHAGE PARTAGÉS
     ================================================================= */
  function ligneCout(cout, titre) {
    return el('div', {},
      el('div', { class: 'eti', text: titre }),
      U.listeRes(cout, { verifier: true }));
  }

  /* ------------------------------------------------------------------
     LA VIGNETTE D'UN HABITANT : son métier de prédilection en icône, son
     nom, son niveau et son trait. C'est la carte d'identité qu'on relit
     à chaque affectation.
     ------------------------------------------------------------------ */
  /* Une PASTILLE DE TRAIT : verte si c'est une qualité, corail si c'est
     un défaut. Le texte complet est dans l'infobulle — la couleur suffit
     à lire une fiche d'un coup d'œil. */
  function pastilleTrait(id) {
    const T = window.HAB.trait(id);
    if (!T) return null;
    return el('span', { class: 'trait ' + T.genre, title: T.desc, text: T.nom });
  }
  function bandeTraits(h, opts) {
    opts = opts || {};
    const l = el('div', { class: 'traits' + (opts.serre ? ' serre' : '') });
    for (const t of window.HAB.listeTraits(h)) { const p = pastilleTrait(t); if (p) l.appendChild(p); }
    if (!l.firstChild) l.appendChild(el('span', { class: 'faible', text: 'sans histoire' }));
    return l;
  }
  /* L'ÉTIQUETTE DE RARETÉ, dans sa couleur. */
  function etiqRarete(h) {
    const R = window.HAB.RARETES[h.rarete] || window.HAB.RARETES.commun;
    return el('span', { class: 'rarete r-' + R.id, title: R.desc, text: R.nom });
  }

  /* ------------------------------------------------------------------
     QUAND UN ONGLET A-T-IL QUELQUE CHOSE À DIRE ?

     La règle est la même partout : dès que la chose est ARRIVÉE UNE
     FOIS dans la partie, elle ne repart plus. On ne fait pas clignoter
     une fonction d'entrée et de sortie selon l'état du stock — ce
     serait pire que de la montrer tout le temps.
     ------------------------------------------------------------------ */
  function jamaisRevient(cle) {
    /* `vus` est déjà le registre de ce que le bourg a découvert : on
       s'y greffe plutôt que d'inventer un second journal. */
    return !!E().vus['ui:' + cle];
  }
  function retenir(cle) { E().vus['ui:' + cle] = true; }

  /* LES ÉTABLIS : rien à acheter tant que l'atelier est au niveau 1 et
     que le bourg n'a pas un écu. */
  function aVuUneAmelioration(b) {
    if (jamaisRevient('amelio')) return true;
    const assezRiche = window.Etat.qte('ecu') >= 60;
    if (b.niv >= 2 || assezRiche || (b.am && Object.keys(b.am).length)) {
      retenir('amelio'); return true;
    }
    return false;
  }
  /* L'OUTILLAGE : il n'existe pas avant la forge. */
  function aVuUnOutil(b) {
    if (jamaisRevient('outil')) return true;
    const stock = (window.OUTILS_QUALITES || []).some(q => window.Etat.qte(q.res) > 0 || (q.legacy && window.Etat.qte(q.legacy) > 0));
    if (b.outil || stock || window.Etat.qte('outil') > 0 || window.Etat.qte('outilacier') > 0
        || window.Etat.aBatiment('forge')) { retenir('outil'); return true; }
    return false;
  }
  /* LES ANNEXES : c'est une mécanique tardive. On l'ouvre quand
     l'atelier a mûri, ou dès qu'une annexe a déjà été bâtie quelque
     part — le joueur connaît alors la notion. */
  function aVuUneAnnexe(b) {
    if (jamaisRevient('annexe')) return true;
    if ((b.raff && Object.keys(b.raff).length) || b.niv >= 3) { retenir('annexe'); return true; }
    for (const id in E().bat) {
      const x = E().bat[id];
      if (x.raff && Object.keys(x.raff).length) { retenir('annexe'); return true; }
    }
    return false;
  }

  /* L'avatar d'un habitant : son visage si le joueur a déposé les
     images, l'icône de son métier sinon. Un seul endroit le décide. */
  function avatarHab(h, taille, classe) {
    const meta = window.METIERS[h.talent] || { nom: '—', ico: { f: 'cube', c: ['#8a8272'] } };
    const v = window.Img ? window.Img.portrait(h) : null;
    const box = el('div', { class: 'av' + (classe ? ' ' + classe : '') + (v ? ' face' : ''),
      title: h.nom + ' — ' + meta.nom });
    box.appendChild(v ? window.Img.vignette(v, taille + 12, h.nom) : U.ico(meta.ico, taille));
    return box;
  }

  function vignetteHabitant(h, rec) {
    const meta = window.METIERS[h.talent] || { nom: '—', ico: { f: 'cube', c: ['#8a8272'] } };
    const bonus = rec ? window.Jeu.facteurHabitant(h, rec) : 1;
    const accorde = rec && h.talent === rec.metier;
    return el('div', { class: 'rangee', style: 'flex:1;min-width:0' },
      avatarHab(h, 20, accorde ? 'or' : ''),
      el('div', { class: 'qui', style: 'flex:1;min-width:0' },
        el('i', { text: meta.nom + (accorde ? '  ·  à son métier' : '') }),
        el('div', { class: 'rangee', style: 'gap:8px' },
          el('b', { text: h.nom }), etiqRarete(h)),
        bandeTraits(h, { serre: true })),
      el('span', { class: 'niv', text: 'niv ' + (h.niv || 1) }),
      rec ? el('span', { class: bonus >= 1.15 ? 'grand bon' : (bonus < 0.99 ? 'grand mauvais' : 'grand doux'),
        title: 'Ce que cet habitant rend à ce poste précis',
        text: '×' + bonus.toFixed(2).replace('.', ',') }) : null);
  }

  /* Le choix de l'habitant : une petite fenêtre qui classe les candidats
     par ce qu'ils rendraient ICI. */
  /* ------------------------------------------------------------------
     PRENDRE LE MEILLEUR.
     Le classement existait déjà — il ne servait qu'à dresser une liste.
     On s'en sert pour DÉCIDER, et l'on annonce le résultat : sans quoi
     le joueur ne sait pas qui vient d'être placé.
     ------------------------------------------------------------------ */
  function nomDuMeilleur(bid, i) {
    const c = window.Jeu.candidatsPoste(bid, i);
    return c && c.length ? c[0].h.nom : null;
  }
  function prendreLeMeilleur(bid, i) {
    const c = window.Jeu.candidatsPoste(bid, i);
    if (!c || !c.length) { U.dire('Personne de libre au bourg.', 'alerte'); return; }
    const h = c[0].h;
    window.Jeu.assigner(bid, i, h.id);
    const b = E().bat[bid];
    const rec = b && b.postes[i] && b.postes[i].rec ? window.REC[b.postes[i].rec] : null;
    U.dire(h.nom + ' prend le poste' +
           (rec && h.talent === rec.metier ? ' — c\'est son métier.' : '.'), 'bien');
    rafraichirVillage();
  }

  /* POURVOIR TOUT L'ATELIER. On place du poste le plus utile au moins
     utile : ceux qui ont déjà une tâche d'abord, puisqu'eux
     produiront dès la seconde suivante. */
  function pourvoirTout(bid) {
    const b = E().bat[bid];
    if (!b) return;
    const ordre = b.postes.map((p, i) => i)
      .filter(i => !b.postes[i].hab)
      .sort((a, z) => (b.postes[z].rec ? 1 : 0) - (b.postes[a].rec ? 1 : 0));
    let n = 0;
    for (const i of ordre) {
      if (!window.Etat.habitantsLibres().length) break;
      const c = window.Jeu.candidatsPoste(bid, i);
      if (!c || !c.length) break;
      window.Jeu.assigner(bid, i, c[0].h.id); n++;
    }
    U.dire(n ? n + ' poste' + (n > 1 ? 's' : '') + ' pourvu' + (n > 1 ? 's' : '') + '.'
             : 'Personne de libre au bourg.', n ? 'bien' : 'alerte');
    rafraichirVillage();
  }

  function choisirHabitant(bid, i) {
    window.UIDock.ouvrirSousPanneau({
      titre: 'Qui prend ce poste ?', sous: window.BAT[E().bat[bid].type].nom,
      rendu: c => {
        const cands = window.Jeu.candidatsPoste(bid, i);
        const b = E().bat[bid];
        const rec = b && b.postes[i] && b.postes[i].rec ? window.REC[b.postes[i].rec] : null;
        if (!cands.length) {
          c.appendChild(el('div', { class: 'vide',
            html: 'Aucun habitant libre.<br>Libérez un poste, ou faites venir du monde.' }));
          return;
        }
        c.appendChild(el('div', { class: 'note', text: rec
          ? 'Classés par ce qu\'ils rendraient à cette tâche : le métier de prédilection compte pour un cinquième, le niveau et le trait pour le reste.'
          : 'Choisissez d\'abord une tâche pour les classer utilement.' }));
        for (const cd of cands) {
          c.appendChild(el('div', { class: 'cadre', style: 'cursor:pointer',
            onclick: () => {
              window.Jeu.assigner(bid, i, cd.h.id);
              window.UIDock.fermerSousPanneau(); rafraichirVillage();
            } },
            el('div', { class: 'rangee' }, vignetteHabitant(cd.h, rec),
              el('button', { class: 'b mini primaire', text: 'Affecter' }))));
        }
      },
    });
  }

  function illustrationRecette(rec, taille, classe) {
    if (!rec) return null;
    const sortie = Object.keys(rec.out || {})[0];
    const src = rec.image || (window.Img && sortie && window.Img.res(sortie, true))
      || (window.Img && window.Img.metier(rec.metier));
    return src ? el('img', { src, alt:'', class:classe || 'poste-recette-art',
      style:'width:' + taille + 'px;height:' + taille + 'px' }) : null;
  }

  function blocPoste(b, i) {
    const p = b.postes[i];
    const dispo = window.BatUtil.recettesDe(b.type, b.niv, b);
    const h = p.hab ? window.Etat.habitant(p.hab) : null;
    const rec = p.rec ? window.REC[p.rec] : null;
    const v = rec ? window.Jeu.vitessePoste(b, rec, h) : 1;

    const box = el('div', { class: 'poste' + (h ? (p.bloque ? ' bloque' : (rec ? ' actif' : '')) : ' vacant') });

    /* --- qui tient le poste --- */
    box.appendChild(el('div', { class: 'haut' },
      h ? vignetteHabitant(h, rec)
        : el('div', { class: 'rangee', style: 'flex:1' },
            el('div', { class: 'av' }, window.Img && window.Img.bat(b.type)
              ? el('img', { src:window.Img.bat(b.type), alt:'', class:'poste-bat-art' }) : null),
            el('div', { class: 'qui' },
              el('i', { text: 'poste ' + (i + 1) }),
              el('b', { class: 'faible', text: 'personne au poste' }))),
      h ? el('button', { class: 'b mini', text: 'Libérer',
            title: 'Libérer le poste\n' + h.nom + ' redevient disponible et pourra tenir '
                 + 'un autre poste, ou le chantier. Rien n\'est perdu : ce poste s\'arrête, '
                 + 'voilà tout.',
            onclick: () => { window.Etat.libererHabitant(p.hab);
              U.dire(h.nom + ' quitte le poste et redevient libre.', 'info');
              rafraichirVillage(); } })
        : el('div', { class: 'rangee', style: 'gap:4px' },
            el('button', { class: 'b mini primaire', text: 'Prendre',
              disabled: !window.Etat.habitantsLibres().length,
              title: nomDuMeilleur(b.id, i)
                ? 'Prendre le meilleur\nPlace ' + nomDuMeilleur(b.id, i)
                  + ', le mieux fait pour cette tâche parmi ceux qui ne font rien.'
                : 'Personne ne se tourne les pattes en ce moment.',
              onclick: () => prendreLeMeilleur(b.id, i) }),
            el('button', { class: 'b mini', text: '…',
              disabled: !window.Etat.habitantsLibres().length,
              title: 'Choisir soi-même\nOuvre la liste des candidats, classés par ce qu\'ils '
                   + 'rendraient à cette tâche.',
              onclick: () => choisirHabitant(b.id, i) }))));

    /* --- ce qu'on y fait --- */
    box.appendChild(el('div', { class: 'rangee entre', style: 'margin-bottom:8px' },
      el('div', { class: 'rangee', style: 'flex:1;min-width:0' },
        rec ? illustrationRecette(rec, 27) : null,
        el('span', { class: 'tt', style: 'font-size:14px;flex:1;min-width:0',
          text: rec ? rec.nom : 'aucune tâche' }),
        rec ? el('span', { class: 'niv', title: 'Nombre de cycles restants',
          text: p.reste == null ? 'en boucle' : '×' + p.reste }) : null),
      el('button', { class: 'b mini' + (rec ? '' : ' primaire'), text: rec ? 'Changer' : 'Choisir',
        onclick: () => choisirTache(b.id, i) })));

    if (rec) {
      const parMin = 60 / (rec.duree / Math.max(0.001, v));
      const pct = p.bloque ? 0 : Math.min(1, p.prog / rec.duree);
      box.appendChild(el('div', { style: 'margin-top:12px' },
        U.barre(pct, 'grande ' + (p.bloque ? 'rouge raye' : (h ? 'vert' : '')),
          p.bloque ? 'en attente de matière' : (h ? U.duree(rec.duree / Math.max(0.001, v)) + ' par cycle' : 'aucun ouvrier'),
          h && !p.bloque ? (Math.round(parMin * 10) / 10).toString().replace('.', ',') + ' /min' : '')));

      const details = el('details', { class: 'poste-details' });
      details.appendChild(el('summary', { text: 'Rendement, répétition et file d’attente' }));
      const detailCorps = el('div', { class: 'poste-details-corps' });
      details.appendChild(detailCorps);

      const ent = el('div', { class: 'rangee enroule', style: 'margin-top:8px' });
      if (Object.keys(rec.in).length) {
        ent.appendChild(el('span', { class: 'eti', text: 'consomme' }));
        for (const r in rec.in) ent.appendChild(U.puce(r, rec.in[r], { mini: true, insuffisant: window.Etat.qte(r) < rec.in[r] }));
      }
      if (Object.keys(rec.out).length) {
        ent.appendChild(el('span', { class: 'eti', text: 'rend' }));
        for (const r in rec.out) ent.appendChild(U.puce(r, rec.out[r], { mini: true, gain: true }));
      }
      if (rec.recrue) ent.appendChild(el('span', { class: 'puce gain mini', text: '+1 habitant' }));
      if (rec.unite) ent.appendChild(el('span', { class: 'puce gain mini', text: '+1 unité' }));
      if (rec.xpArmee) ent.appendChild(el('span', { class: 'puce gain mini', text: '+' + rec.xpArmee + ' xp' }));
      if (rec.menace) ent.appendChild(el('span', { class: 'puce gain mini', text: rec.menace + ' menace' }));
      detailCorps.appendChild(ent);

      /* LES TROUVAILLES, chances réelles à l'appui — celles de l'ouvrage
         et celles du métier, multipliées par ce que vaut l'habitant au
         poste. Un Chanceux se voit dans les pourcentages, pas seulement
         dans sa fiche. */
      const kButin = window.HAB.produit(h, 'butin') *
                     (1 + window.Jeu.amelioDe(b, 'oeil') + window.Jeu.acquis().butin);
      const tousLoots = (rec.loot || []).concat(window.ButinUtil.tableDe(rec.metier, rec.duree, 1));
      if (tousLoots.length) {
        const lo = el('div', { class: 'rangee enroule', style: 'margin-top:8px' },
          el('span', { class: 'eti', title: 'Par cycle, en tenant compte de qui tient le poste.',
                       text: 'trouvailles' }));
        for (const l of tousLoots) {
          const pc = Math.min(0.995, l.p * kButin) * 100;
          lo.appendChild(U.puce(l.res, null, { mini: true, butin: true,
            texte: (pc >= 10 ? Math.round(pc) : Math.round(pc * 10) / 10).toString().replace('.', ',') + ' %' }));
        }
        if (kButin > 1.02 || kButin < 0.98)
          lo.appendChild(el('span', { class: 'eti-or',
            title: 'Le caractère de l\'habitant, l\'œil exercé de l\'atelier et les recherches du bourg.',
            text: '×' + kButin.toFixed(2).replace('.', ',') }));
        detailCorps.appendChild(lo);
      }
      if (p.bloque) {
        const m = window.Etat.manque(rec.in);
        detailCorps.appendChild(el('div', { class: 'note mauvais', style: 'margin-top:8px',
          text: 'Il manque : ' + m.map(x => (window.RES[x.id] ? window.RES[x.id].nom : x.id) + ' (' + Math.floor(x.il) + '/' + x.faut + ')').join(', ') }));
      }

      /* --- combien de fois --- */
      const poss = window.Jeu.cyclesPossibles(p.rec);
      detailCorps.appendChild(el('div', { class: 'rangee enroule', style: 'margin-top:8px' },
        el('span', { class: 'eti', text: 'répéter' }),
        U.segments([
          { v: null, n: 'en boucle', t: 'Sans fin, tant qu\'il y a de la matière' },
          { v: 10, n: '×10' }, { v: 50, n: '×50' }, { v: 200, n: '×200' },
        ], p.reste == null ? null : (p.reste === 10 ? 10 : p.reste === 50 ? 50 : p.reste === 200 ? 200 : 'x'),
          val => { window.Jeu.definirRecette(b.id, i, p.rec, val); rafraichirVillage(); }),
        poss > 0 && poss < 1e6 ? el('button', { class: 'b mini',
          title: 'Autant de cycles que la réserve le permet',
          text: 'tout (×' + poss + ')',
          onclick: () => { window.Jeu.definirRecette(b.id, i, p.rec, poss); rafraichirVillage(); } }) : null,
        el('button', { class: 'b mini danger', text: 'Arrêter',
          onclick: () => { window.Jeu.definirRecette(b.id, i, null); rafraichirVillage(); } })));

      /* --- la file du poste --- */
      const file = p.file || [];
      detailCorps.appendChild(el('div', { class: 'rangee entre', style: 'margin-top:12px' },
        el('span', { class: 'eti', text: file.length ? 'à la suite (' + file.length + ')' : 'à la suite' }),
        el('button', { class: 'b mini', text: 'Ajouter', disabled: file.length >= 8,
          onclick: () => choisirTache(b.id, i, true) })));
      if (file.length) {
        for (let k = 0; k < file.length; k++) {
          const f = file[k], fr = window.REC[f.rec];
          detailCorps.appendChild(el('div', { class: 'job', style: 'margin-top:4px' },
            illustrationRecette(fr, 23),
            el('span', { class: 'jn', text: fr.nom }),
            el('span', { class: 'jr', text: f.n == null ? 'en boucle' : '×' + f.n }),
            el('div', { class: 'fl' },
              el('button', { class: 'b mini carre', text: '↑', disabled: k === 0,
                onclick: () => { window.Jeu.deplacerFile(b.id, i, k, -1); } }),
              el('button', { class: 'b mini carre', text: '↓', disabled: k === file.length - 1,
                onclick: () => { window.Jeu.deplacerFile(b.id, i, k, 1); } }),
              el('button', { class: 'b mini carre danger', text: '×',
                onclick: () => { window.Jeu.retirerFile(b.id, i, k); } }))));
        }
      }
      detailCorps.appendChild(el('div', { class: 'note', style: 'margin-top:8px', text: rec.desc }));
      box.appendChild(details);
    } else {
      box.appendChild(el('div', { class: 'note',
        text: 'Choisissez une tâche : elle se répétera en boucle, ou le nombre de fois que vous demanderez, puis cédera la place à la suivante de la file.' }));
    }
    return box;
  }

  /* ------------------------------------------------------------------
     LE CHOIX D'UNE TÂCHE
     Un menu, pas une liste déroulante : on veut voir d'un coup ce que
     chaque tâche consomme, ce qu'elle rend, combien de temps elle prend
     et ce qu'elle peut faire tomber.
     ------------------------------------------------------------------ */
  function choisirTache(bid, i, aLaSuite) {
    window.UIDock.ouvrirSousPanneau({
      titre: aLaSuite ? 'Ajouter à la file' : 'Que fait-on ici ?',
      sous: window.BAT[E().bat[bid].type].nom,
      rendu: c => {
        const b = E().bat[bid];
        if (!b) return;
        const dispo = window.BatUtil.recettesDe(b.type, b.niv, b);
        const toutes = window.BAT[b.type].recettes || [];
        const h = b.postes[i] && b.postes[i].hab ? window.Etat.habitant(b.postes[i].hab) : null;
        c.appendChild(el('div', { class: 'note',
          text: aLaSuite ? 'Elle prendra le relais quand la tâche en cours aura fini son compte.'
                         : 'Elle démarrera tout de suite, en boucle. Vous pourrez lui donner un compte ensuite.' }));
        for (const rid of toutes) {
          const r = window.REC[rid];
          const ok = dispo.includes(rid);
          const v = ok ? window.Jeu.vitessePoste(b, r, h) : 1;
          const carte = el('div', { 'data-cle': rid, class: 'cat-item' + (ok ? '' : ' impossible'),
            onclick: ok ? () => {
              if (aLaSuite) window.Jeu.ajouterFile(bid, i, rid, null);
              else window.Jeu.definirRecette(bid, i, rid, null);
              window.UIDock.fermerSousPanneau(); rafraichirVillage();
            } : null },
            el('div', { class: 'vig' }, illustrationRecette(r, 58, 'illustration-recette')),
            el('div', { class: 'cc' },
              el('h3', { text: r.nom }),
              el('div', { class: 'm', text: ok ? U.duree(r.duree / Math.max(0.001, v)) + ' par cycle  ·  ' +
                (Math.round(60 / (r.duree / Math.max(0.001, v)) * 10) / 10).toString().replace('.', ',') + ' /min'
                : 'niveau ' + r.niv + ' requis' }),
              (function () {
                const l = el('div', { class: 'rangee enroule' });
                for (const k in r.in) l.appendChild(U.puce(k, r.in[k], { mini: true, insuffisant: window.Etat.qte(k) < r.in[k] }));
                if (Object.keys(r.in).length && Object.keys(r.out).length)
                  l.appendChild(el('span', { class: 'faible', text: '→' }));
                for (const k in r.out) l.appendChild(U.puce(k, r.out[k], { mini: true, gain: true }));
                for (const lo of (r.loot || []))
                  l.appendChild(U.puce(lo.res, null, { mini: true, butin: true, texte: (Math.round(lo.p * 1000) / 10).toString().replace('.', ',') + ' %' }));
                return l;
              })(),
              el('div', { class: 'note', style: 'margin-top:8px', text: r.desc })));
          c.appendChild(carte);
        }
      },
    });
  }

  /* =================================================================
     LA FENÊTRE D'UN ÉDIFICE
     ================================================================= */
  function rendreArsenal(c, bid) {
    const b = E().bat[bid];
    if (!b || !window.Armee) return;
    const limite = Math.min(40, b.niv * 4);
    const travail = E().armee && E().armee.forge;
    c.appendChild(el('div', { class: 'arsenal-entete' },
      el('div', {},
        el('div', { class: 'tt', text: 'Arsenal du bourg' }),
        el('div', { class: 'note', text: 'Chaque famille progresse séparément. Un niveau de forge révèle quatre nouveaux paliers.' })),
      el('div', { class: 'arsenal-limite', text: 'PALIER ' + limite + ' / 40' })));

    const noms = { melee: 'Corps à corps', distance: 'Distance', magie: 'Magie' };
    for (const type of ['melee', 'distance', 'magie']) {
      const bloc = el('section', { class: 'arsenal-famille' },
        el('h3', { text: noms[type] }));
      const grille = el('div', { class: 'arsenal-grille' });
      for (const slot of ['arme', 'armure']) {
        const tier = window.Armee.tierEquipement(type, slot);
        const suivant = tier + 1;
        const actuel = window.Armee.objetEquipement(type, slot, tier);
        const prochain = suivant <= 40 ? window.Armee.objetEquipement(type, slot, suivant) : actuel;
        const cout = suivant <= 40 ? window.Armee.coutEquipement(type, slot, suivant) : {};
        const verrou = suivant > limite;
        const fini = tier >= 40;
        const enCours = travail && travail.type === type && travail.slot === slot;
        const occupe = travail && !enCours;
        const carte = el('div', { class: 'arsenal-carte' },
          el('div', { class: 'arsenal-visuel' },
            el('img', { src: window.Armee.imageEquipement(type, slot, Math.max(1, tier)), alt: actuel ? actuel.name : slot }),
            el('span', { class: 'arsenal-tier', text: tier ? 'T' + tier : 'NON ÉQUIPÉ' })),
          el('div', { class: 'arsenal-corps' },
            el('div', { class: 'eti', text: slot === 'arme' ? 'ARME' : 'ARMURE' }),
            el('div', { class: 'tt arsenal-nom', text: actuel ? actuel.name : 'Équipement rudimentaire' }),
            el('div', { class: 'note', text: actuel ? actuel.desc : 'La première pièce peut être forgée avec du bois et du poisson.' }),
            enCours ? el('div', { class: 'arsenal-suivant' },
              el('div', { class: 'rangee entre' },
                el('span', { class: 'eti-or', text: 'Forge en cours · T' + travail.tier }),
                el('span', { class: 'eti', text: U.duree(Math.max(0, travail.duree - travail.prog)) })),
              U.barre(travail.prog / travail.duree, 'grande or', '', Math.round(travail.prog / travail.duree * 100) + ' %')) :
            fini ? el('div', { class: 'eti-or', text: 'Ligne achevée · palier 40' }) :
              el('div', { class: 'arsenal-suivant' },
                el('div', { class: 'rangee entre' },
                  el('span', { class: 'eti-or', text: 'T' + suivant + ' · ' + (prochain ? prochain.name : '') }),
                  verrou ? el('span', { class: 'eti mauvais', text: 'Forge niv. ' + Math.ceil(suivant / 4) }) : null),
                U.listeRes(cout, { verifier: true }),
                el('button', { class: 'b primaire', text: verrou ? 'Palier verrouillé' : (occupe ? 'Forge occupée' : 'Forger'),
                  disabled: verrou || occupe || !window.Etat.assez(cout), onclick: () => {
                    const r = window.Armee.ameliorerEquipement(type, slot, limite);
                    U.dire(r.ok ? (r.objet.name + ' entre en forge · ' + U.duree(r.objet.craftTime) + '.') : r.raison, r.ok ? 'bien' : 'alerte');
                    rafraichirVillage();
                  } }))));
        grille.appendChild(carte);
      }
      bloc.appendChild(grille);
      c.appendChild(bloc);
    }
  }

  /* Une seule grammaire pour tous les bâtiments. Le volet droit utilise
     ces métadonnées pour afficher des languettes illustrées et ne révèle
     les fonctions avancées qu'au niveau où elles deviennent pertinentes. */
  function ongletsBatiment(bid) {
    const bb = E().bat[bid];
    if (!bb) return [];
    const def = window.BAT[bb.type];
    const imageRes = id => window.Img ? window.Img.res(id, true) : null;
    const imageBat = () => window.Img ? window.Img.bat(bb.type) : null;
    const ong = [];
    const ajouter = (id, nom, rendu, niveau, couleur, image) => ong.push({
      id, nom, rendu, niveau: niveau || 1, couleur: couleur || 'bleu',
      image: image || imageBat(),
    });

    if (bb.postes.length) ajouter('postes', bb.type === 'caserne' ? 'Recrutement' : 'Activité',
      c => rendrePostes(c, bid), 1, 'bleu', imageBat());
    if (bb.type === 'caserne' && window.UIArmee) {
      ong.unshift({ id:'effectifs', nom:'Effectifs', rendu:c => window.UIArmee.rendreEffectifs(c, bid), niveau:1, couleur:'bleu', image:imageRes('arme') });
      ajouter('colonne', 'Colonne', c => window.UIArmee.rendreColonne(c, bid), 2, 'vert', imageRes('armure'));
      ajouter('techniques', 'Techniques', c => window.UIArmee.rendreTechniques(c, bid), 3, 'orange', imageRes('parchemin'));
    }
    if (bb.type === 'entrainement' && window.Entrainement)
      ong.unshift({ id:'entrainer', nom:'Entraîner', rendu:c => rendreEntrainementIndividuel(c, bid), niveau:1, couleur:'bleu', image:imageBat() });
    if (bb.type === 'forge' && window.Armee) {
      ong.unshift({ id:'arsenal', nom:'Arsenal', rendu:c => rendreArsenal(c, bid), niveau:1, couleur:'bleu', image:imageRes('arme') });
      if (window.UICompagnie) {
        ajouter('renfort', 'Renforcement', c => window.UICompagnie.rendreForgeRenfort(c, bid), 2, 'vert', imageRes('armure'));
        ajouter('trempe', 'Trempe', c => window.UICompagnie.rendreForgeTrempe(c, bid), 3, 'orange', imageRes('poussiere_trempe'));
      }
    }

    /* Le jaune signifie toujours « faire grandir le bâtiment ». */
    ajouter('niveau', 'Améliorer', c => rendreNiveau(c, bid), 1, 'jaune', imageRes('plan'));

    if (bb.postes.length && aVuUneAmelioration(bb))
      ajouter('amelio', 'Perfectionnements', c => rendreAmelio(c, bid), 2, 'violet', imageRes('plan'));
    if (bb.postes.length && aVuUnOutil(bb))
      ajouter('outil', 'Outillage', c => rendreOutil(c, bid), 2, 'vert', imageRes('outil'));
    if (window.RaffUtil && window.RaffUtil.pourBat(bb.type).length && aVuUneAnnexe(bb))
      ajouter('annexe', 'Annexes', c => rendreAnnexes(c, bid), 3, 'orange', imageBat());

    /* Le port et la Tour sont interceptés par ouvrirBatiment et gardent
       toujours leurs pages dédiées. Ces entrées ne servent qu'aux rares
       appelants historiques qui rendent encore les portes en panneau. */
    if (def.porte === 'aventure') ong.unshift({ id:'descente', nom:'Descente', rendu:c => window.UIAventure.rendre(c), niveau:1, couleur:'bleu', image:imageBat() });
    if (def.porte === 'expedition') ong.unshift({ id:'expedition', nom:'Expédition', rendu:c => window.UIExpedition.rendre(c), niveau:1, couleur:'bleu', image:imageBat() });
    return ong;
  }

  function ouvrirBatiment(bid) {
    /* LE PORT N'A PLUS DE FENÊTRE. Il EST la carte marine — on l'ouvre
       donc directement, et tout ce qu'on y faisait vit maintenant dans
       le flanc gauche de cette carte. On intercepte ici plutôt qu'à
       chaque appelant : le clic dans le village, la vignette du dock et
       le raccourci du bilan passent tous par cette porte. */
    const bp = window.Etat.E.bat[bid];
    if (bp && bp.type === 'port' && !bp.chantier) {
      if (window.UIDock) window.UIDock.fermerBatiment();
      ouvrirCarteMarine(null, null); return;
    }
    /* La Tour n'ouvre plus une fiche de bâtiment chargée. Elle commence par
       les groupes enregistrés, puis seulement par le grand écran de préparation. */
    if (bp && bp.type === 'descente' && !bp.chantier && window.UIAventure) {
      if (window.UIDock) window.UIDock.fermerBatiment();
      window.UIAventure.ouvrirEquipes(); return;
    }
    const b = E().bat[bid];
    if (!b) return;
    if (window.UIDock && window.UIDock.ouvrirBatiment) {
      window.UIDock.ouvrirBatiment(bid);
    }
  }

  function rendrePostes(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    if (b.endommage > 0) {
      c.appendChild(el('div', { class: 'cadre' },
        el('div', { class: 'eti mauvais', text: 'Bâtiment endommagé' }),
        el('div', { class: 'note', text: 'Le raid l\'a abîmé : il travaille à 40 % tant qu\'il n\'est pas remis en état. La remise en état passe par le chantier.' }),
        el('div', { style: 'margin-top:8px' },
          el('button', { class: 'b primaire', text: 'Mettre au chantier', onclick: () => {
            const r = window.Jeu.reparer(bid);
            U.dire(r.ok ? 'Réparation en file.' : r.raison, r.ok ? 'bien' : 'alerte');
          } }))));
    }
    const libres = window.Etat.habitantsLibres().length;
    const tenus = b.postes.filter(p => p.hab).length;
    const actifs = b.postes.filter(p => p.hab && p.rec && !p.bloque).length;
    const vacants = b.postes.length - tenus;
    c.appendChild(U.stats([
      ['postes tenus', tenus + ' / ' + b.postes.length, tenus === b.postes.length ? 'bon' : ''],
      ['en production', actifs, actifs ? 'bon' : 'mauvais'],
      ['libres au bourg', libres, libres ? '' : 'faible'],
    ]));

    /* LA BARRE D'ACTION. Elle ne dit que ce qu'il y a à faire ici et
       maintenant — et disparaît quand il n'y a rien à faire. */
    if (vacants && libres) {
      c.appendChild(el('div', { class: 'appel' },
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { class: 'tt', style: 'font-size:13px',
            text: vacants + ' poste' + (vacants > 1 ? 's' : '') + ' sans personne' }),
          el('div', { class: 'eti', text: libres + ' habitant' + (libres > 1 ? 's' : '') + ' sans emploi au bourg' })),
        el('button', { class: 'b primaire', text: vacants > 1 ? 'Tout pourvoir' : 'Pourvoir',
          title: 'Pourvoir l\'atelier\nPlace les meilleurs candidats disponibles sur '
               + 'chaque poste vide, en commençant par ceux qui ont déjà une tâche.',
          onclick: () => pourvoirTout(bid) })));
    } else if (vacants && !libres) {
      c.appendChild(el('div', { class: 'appel calme' },
        el('div', { style: 'flex:1' },
          el('div', { class: 'tt', style: 'font-size:13px',
            text: vacants + ' poste' + (vacants > 1 ? 's' : '') + ' sans personne' }),
          el('div', { class: 'eti', text: 'personne de libre — bâtissez un logement, ou libérez un poste ailleurs' })),
        el('button', { class: 'b', text: 'Voir les habitants',
          onclick: () => window.UIFen.ouvrirHabitants('roles') })));
    }
    if (b.outil && b.outil.restant > 0)
      c.appendChild(el('div', { class: 'rangee entre' },
        el('span', { class: 'eti-or', text: 'outillé · ' + window.RES[b.outil.type].nom.toLowerCase() }),
        el('span', { class: 'eti', text: b.outil.restant + ' cycles restants' })));
    c.appendChild(U.section('Les postes'));
    const liste = el('div', {});
    for (let i = 0; i < b.postes.length; i++) liste.appendChild(blocPoste(b, i));
    c.appendChild(liste);
    if (b.niv < (window.BAT[b.type].nivMax || 10)) {
      const suiv = window.BatUtil.postesDe(b.type, b.niv + 1);
      if (suiv > b.postes.length)
        c.appendChild(el('div', { class: 'note', text: 'Le niveau ' + (b.niv + 1) + ' ouvrira un poste de plus.' }));
    }
  }

  function rendreNiveau(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    const def = window.BAT[b.type];
    const max = def.nivMax || 10;
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', text: 'Niveau ' + b.niv + ' / ' + max }),
        el('span', { class: 'eti', text: window.BatUtil.postesDe(b.type, b.niv) + ' postes' })),
      el('div', { class: 'sep' }),
      tableauNiveau(b)));

    if (b.niv >= max) {
      c.appendChild(el('div', { class: 'note', text: 'Cet édifice a atteint son dernier niveau. Il n\'y a plus rien à lui apprendre.' }));
      return;
    }
    const enFile = E().chantier.file.some(j => j.bat === bid);
    const cout = window.BatUtil.coutNiveau(b.type, b.niv + 1);
    const temps = window.BatUtil.tempsNiveau(b.type, b.niv + 1);
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'eti-or', text: 'Passer au niveau ' + (b.niv + 1) }),
      el('div', { class: 'sep' }),
      ligneCout(cout, 'coût'),
      el('div', { class: 'rangee entre', style: 'margin-top:8px' },
        el('span', { class: 'eti', text: 'chantier : ' + U.duree(temps) }),
        el('button', {
          class: 'b primaire', text: enFile ? 'déjà en file' : 'Mettre au chantier',
          disabled: enFile || !window.Etat.assez(cout),
          onclick: () => {
            const r = window.Jeu.ameliorer(bid);
            U.dire(r.ok ? def.nom + ' : amélioration en file de chantier.' : r.raison, r.ok ? 'bien' : 'alerte');
          },
        }))));
    c.appendChild(el('div', { class: 'note',
      text: 'Un chantier n\'avance que si un habitant est affecté au chantier du bourg. Bâtir, c\'est renoncer à produire.' }));
  }

  /* ------------------------------------------------------------------
     LES ANNEXES
     Une annexe ne fait pas grandir l'atelier : elle lui ajoute un corps
     de bâtiment, et avec lui des gestes qui n'existaient nulle part. On
     la paie en matériaux et on la bâtit au chantier, comme un édifice —
     mais elle ne coûte pas de parcelle.
     ------------------------------------------------------------------ */
  function rendreAnnexes(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    if (!b.raff) b.raff = {};
    const liste = window.RaffUtil.pourBat(b.type);
    c.appendChild(el('div', { class: 'note',
      text: "Ce qu'on greffe sur l'atelier plutôt qu'à côté. Une annexe ouvre des tâches nouvelles — et se voit depuis la falaise." }));

    for (const r of liste) {
      const bati = !!b.raff[r.id];
      const enFile = E().chantier.file.some(j => j.k === 'raffiner' && j.bat === bid && j.raff === r.id);
      const cout = window.RaffUtil.coutDe(b.type, r.id, b.niv);
      const temps = window.RaffUtil.tempsDe(b.type, r.id, b.niv);
      /* ce que l'annexe débloque : on le montre AVANT l'achat, sinon on
         paie sans savoir pour quoi */
      const ouvre = (window.BAT[b.type].recettes || [])
        .filter(rid => window.REC[rid] && window.REC[rid].raff === r.id)
        .map(rid => window.REC[rid].nom);

      const corps = [
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', text: r.nom }),
          el('span', { class: bati ? 'eti-or' : 'eti', text: bati ? 'bâtie' : U.duree(temps) })),
        el('div', { class: 'note', style: 'margin-top:4px', text: r.desc }),
      ];
      if (ouvre.length)
        corps.push(el('div', { class: 'eti', style: 'margin-top:8px',
          text: 'ouvre : ' + ouvre.join(', ') }));
      for (const k in r.effet)
        corps.push(el('div', { class: 'eti-or', style: 'margin-top:4px',
          text: k + ' + ' + Math.round(r.effet[k] * 100) + ' %' }));

      if (!bati) {
        corps.push(el('div', { class: 'sep' }));
        corps.push(ligneCout(cout, 'coût'));
        corps.push(el('div', { class: 'rangee entre', style: 'margin-top:8px' },
          el('span', { class: 'eti', text: 'chantier : ' + U.duree(temps) }),
          el('button', {
            class: 'b primaire', text: enFile ? 'déjà en file' : 'Mettre au chantier',
            disabled: enFile || !window.Etat.assez(cout),
            onclick: () => {
              const rr = window.Jeu.raffiner(bid, r.id);
              U.dire(rr.ok ? r.nom + ' : chantier ouvert.' : rr.raison, rr.ok ? 'bien' : 'alerte');
            },
          })));
      }
      c.appendChild(el('div', { class: 'cadre' + (bati ? ' actif' : '') }, ...corps));
    }
    c.appendChild(el('div', { class: 'note faible',
      text: "Le coût d'une annexe monte avec le niveau de l'atelier : on ne greffe pas une cave sur un édifice de maître au prix d'une cabane." }));
  }

  /* ------------------------------------------------------------------
     LES AMÉLIORATIONS D'ATELIER
     Achetées ici, tout de suite, sans passer par le chantier — et payées
     en écus ET en ce que l'atelier produit lui-même. C'est le puits où
     part la production quand elle devient pléthorique.
     ------------------------------------------------------------------ */
  function rendreAmelio(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    if (!b.am) b.am = {};
    const mat = window.AmelioUtil.matiereDe(b.type);
    c.appendChild(el('div', { class: 'note',
      text: 'Chaque cran se paie en écus et en ' + (mat ? window.RES[mat].nom.toLowerCase() : 'matière') +
            ' — ce que cet atelier produit lui-même. Les derniers crans réclament de l\'outillage : la forge commande tout le bourg.' }));
    for (const a of window.AMELIO) {
      const rang = b.am[a.id] || 0;
      const fini = rang >= a.max;
      const cout = fini ? {} : window.AmelioUtil.coutAmelio(b.type, a.id, rang);
      const ok = !fini && window.Etat.assez(cout);
      const e = a.effet(Math.max(1, rang || 1));
      const cle = Object.keys(e)[0];
      const val = a.effet(rang)[cle] || 0;
      c.appendChild(el('div', { class: 'cadre' + (rang ? ' actif' : '') },
        el('div', { class: 'rangee' },
          el('div', { class: 'av' + (rang ? ' or' : '') },
            window.Img && window.Img.bat(b.type)
              ? el('img', { src:window.Img.bat(b.type), alt:'', class:'amelio-art' }) : null),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'rangee entre' },
              el('span', { class: 'tt', style: 'font-size:14px', text: a.nom }),
              el('span', { class: 'niv', text: rang + ' / ' + a.max })),
            el('div', { class: 'note', style: 'margin-top:4px', text: a.desc })),
          el('span', { class: rang ? 'grand bon' : 'grand faible',
            text: cle === 'postes' ? '+' + val : '+' + Math.round(val * 100) + ' %' })),
        el('div', { style: 'margin-top:8px' },
          U.barre(rang / a.max, 'vert', '', rang + ' / ' + a.max)),
        fini ? el('div', { class: 'eti-or', style: 'margin-top:8px', text: 'dernier cran atteint' })
             : el('div', { class: 'rangee entre', style: 'margin-top:8px;flex-wrap:wrap' },
                 U.listeRes(cout, { verifier: true }),
                 el('button', { class: 'b mini primaire', text: 'Améliorer', disabled: !ok,
                   onclick: () => {
                     const r = window.Jeu.acheterAmelio(bid, a.id);
                     U.dire(r.ok ? a.nom + ' : cran ' + (rang + 1) + '.' : r.raison, r.ok ? 'bien' : 'alerte');
                   } }))));
    }
  }

  /* ------------------------------------------------------------------
     L'ARBRE DES RECHERCHES
     Quatre branches, sept crans. On ne peut pas tout mener de front :
     c'est là que se décide le visage d'une partie.
     ------------------------------------------------------------------ */
  function ouvrirRecherches(brInit) {
    U.ouvrir('recherches', {
      titre: 'Les recherches du bourg', sous: 'Acquis définitifs',
      onglet: brInit, classe: 'large',
      sousVif: () => {
        const n = Object.keys(E().recherches || {}).length;
        return n + ' / ' + window.RECHERCHES.length + ' acquises';
      },
      onglets: () => Object.values(window.RECH_BRANCHES).map(br => ({
        id: br.id, nom: br.nom, rendu: c => rendreBranche(c, br),
      })),
    });
  }
  function rendreBranche(c, br) {
    const noeuds = window.RECHERCHES.filter(n => n.br === br.id).sort((a, b) => a.rang - b.rang);
    const pris = noeuds.filter(n => window.Jeu.aRecherche(n.id)).length;
    c.appendChild(el('div', { class: 'rangee' },
      el('div', { class: 'av or' }, U.ico(br.ico, 20)),
      el('div', { style: 'flex:1' },
        el('div', { class: 'note', text: br.desc }),
        el('div', { style: 'margin-top:8px' },
          U.barre(pris / noeuds.length, 'grande', br.nom, pris + ' / ' + noeuds.length)))));
    let rangCourant = -1;
    for (const n of noeuds) {
      if (n.rang !== rangCourant) { rangCourant = n.rang; c.appendChild(U.section('Cran ' + n.rang)); }
      const acquise = window.Jeu.aRecherche(n.id);
      const ouverte = window.Jeu.rechercheOuverte(n.id);
      const payable = ouverte && !acquise && window.Etat.assez(n.cout);
      const manquants = n.req.filter(r => !window.Jeu.aRecherche(r))
        .map(r => (window.RECHERCHES.find(x => x.id === r) || {}).nom).filter(Boolean);
      c.appendChild(el('div', { class: 'cadre' + (acquise ? ' actif' : (ouverte ? '' : ' mort')) },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', style: 'font-size:15px', text: n.nom }),
          acquise ? el('span', { class: 'niv', text: 'acquise' }) : null),
        el('div', { class: 'note', style: 'margin-top:4px', text: n.desc }),
        acquise ? null : el('div', { class: 'rangee entre', style: 'margin-top:12px;flex-wrap:wrap' },
          U.listeRes(n.cout, { verifier: true }),
          el('button', { class: 'b mini primaire', text: 'Acquérir', disabled: !payable,
            onclick: () => {
              const r = window.Jeu.acheterRecherche(n.id);
              U.dire(r.ok ? 'Recherche acquise : ' + n.nom : r.raison, r.ok ? 'bien' : 'alerte');
            } })),
        (!acquise && manquants.length) ? el('div', { class: 'note mauvais', style: 'margin-top:8px',
          text: 'Demande d\'abord : ' + manquants.join(', ') }) : null));
    }
  }

  function tableauNiveau(b) {
    const t = el('table', { class: 'tabl' });
    const def = window.BAT[b.type];
    const lig = (k, a, bb) => t.appendChild(el('tr', {}, el('th', { text: k }),
      el('td', { class: 'n', text: a }), el('td', { class: 'n eti-or', text: bb || '' })));
    t.appendChild(el('tr', {}, el('th', { text: '' }), el('th', { class: 'n', text: 'actuel' }), el('th', { class: 'n', text: 'suivant' })));
    const n2 = Math.min((def.nivMax || 10), b.niv + 1);
    lig('Postes', window.BatUtil.postesDe(b.type, b.niv), n2 > b.niv ? window.BatUtil.postesDe(b.type, n2) : '');
    lig('Cadence', '×' + (1 + 0.12 * (b.niv - 1)).toFixed(2).replace('.', ','), n2 > b.niv ? '×' + (1 + 0.12 * (n2 - 1)).toFixed(2).replace('.', ',') : '');
    if (def.logement) lig('Logement', window.BatUtil.logementDe(b.type, b.niv), n2 > b.niv ? window.BatUtil.logementDe(b.type, n2) : '');
    if (def.stock) {
      const s = window.BatUtil.stockDe(b.type, b.niv), s2 = n2 > b.niv ? window.BatUtil.stockDe(b.type, n2) : null;
      for (const cat in s) lig('Stock ' + (window.CAT_RES[cat] ? window.CAT_RES[cat].nom.toLowerCase() : cat), U.fmt(s[cat]), s2 ? U.fmt(s2[cat]) : '');
    }
    if (def.effet) for (const k in def.effet) {
      const v = def.effet[k] * (1 + 0.35 * (b.niv - 1));
      const v2 = def.effet[k] * (1 + 0.35 * (n2 - 1));
      lig(k[0].toUpperCase() + k.slice(1), Math.round(v * 100) / 100, n2 > b.niv ? Math.round(v2 * 100) / 100 : '');
    }
    const nb = window.BatUtil.recettesDe(b.type, b.niv, b).length;
    const nb2 = n2 > b.niv ? window.BatUtil.recettesDe(b.type, n2, b).length : nb;
    if (nb2 > nb) lig('Tâches', nb, nb2);
    return t;
  }

  function rendreOutil(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    const defB = window.BAT[b.type];
    const active = (b.postes || []).find(p => p.rec && window.REC[p.rec]);
    const metier = active ? window.REC[active.rec].metier
      : ((defB.recettes || []).map(id => window.REC[id]).find(Boolean) || {}).metier || 'batisse';
    const art = window.OutilUtil ? window.OutilUtil.imageMetier(metier) : null;
    c.appendChild(el('div', { class: 'note',
      text: "Chaque métier a son propre nécessaire. Le matériau fixe la cadence et la durée ; une qualité remplace la précédente sans perdre les vieux stocks." }));
    if (b.outil) {
      const q = window.OutilUtil && window.OutilUtil.de(b.outil);
      const maxi = b.outil.maximum || (q ? q.cycles : (b.outil.type === 'outilacier' ? 520 : 190));
      const pct = b.outil.restant / Math.max(1, maxi);
      c.appendChild(el('div', { class: 'cadre actif outil-equipe', style:q ? '--outil-col:' + q.col : '' },
        el('div', { class: 'rangee entre' },
          el('div', { class:'rangee' }, art ? el('img',{src:art,alt:'',class:'outil-art'}) : U.icoRes(b.outil.type,32),
            el('div',{}, el('span', { class: 'tt', text:(window.METIERS[metier] || {}).nom || 'Outillage' }),
              el('div',{class:'eti',text:q ? q.nom : ((window.RES[b.outil.type] || {}).nom || 'Outillage')}))),
          el('span', { class: 'eti-or', text:'× ' + (q ? q.mult : (b.outil.type === 'outilacier' ? 1.9 : 1.4)).toFixed(2).replace('.', ',') })),
        el('div', { style: 'margin-top:8px' }, U.barre(pct, 'vert')),
        el('div', { class: 'eti', style: 'margin-top:4px', text: b.outil.restant + ' cycles avant usure' })));
    } else {
      c.appendChild(el('div', { class: 'cadre' }, el('div', { class: 'note faible', text: "Cet atelier travaille à mains nues." })));
    }
    const qualites = window.OUTILS_QUALITES || [
      {id:'fer',res:'outil',nom:'Fer',mult:1.4,cycles:190,col:'#899299'},
      {id:'acier',res:'outilacier',nom:'Acier',mult:1.9,cycles:520,col:'#bdc8d1'}
    ];
    const forge = window.Etat.nivDeType('forge'), scierie = window.Etat.nivDeType('scierie');
    c.appendChild(el('div',{class:'outil-grille'}, qualites.filter(q => {
      const stock = window.Etat.qte(q.res) + (q.legacy ? window.Etat.qte(q.legacy) : 0);
      return stock > 0 || (q.id === 'bois' ? scierie >= 2 : forge >= q.niv);
    }).map(q => {
      const stock = window.Etat.qte(q.res) + (q.legacy ? window.Etat.qte(q.legacy) : 0);
      return el('div', { class: 'cadre outil-choix', style:'--outil-col:' + q.col },
        el('div', { class: 'rangee entre' },
          el('div', { class: 'rangee' }, art ? el('img',{src:art,alt:'',class:'outil-art petit'}) : U.icoRes(q.res,26),
            el('div', {}, el('div', { class: 'tt', text:q.nom }),
              el('div', { class: 'eti', text:'× ' + q.mult.toFixed(2).replace('.', ',') + ' · ' + q.cycles + ' cycles' }))),
          el('button', { class: 'b mini', text: 'Équiper (' + U.fmt(stock) + ')', disabled: stock < 1,
            onclick: () => { const r = window.Jeu.outiller(bid, q.id);
              U.dire(r.ok ? 'Outils de ' + q.nom.toLowerCase() + ' équipés.' : r.raison, r.ok ? 'bien' : 'alerte'); } })));
    })));
  }

  function rendreEntrainementIndividuel(c, bid) {
    const habitants = E().habitants.slice().sort((a,b) => (b.niv || 1) - (a.niv || 1));
    if (!habitants.length) { c.appendChild(el('div',{class:'vide',text:'Personne à entraîner.'})); return; }
    if (!entrainementHabId || !window.Etat.habitant(entrainementHabId)) entrainementHabId = habitants[0].id;
    c.appendChild(el('div',{class:'note',text:"Une séance vise un habitant et une caractéristique. Le prix monte avec sa maîtrise : les premiers exercices ne réclament que poisson et bois, les champions consomment des matériaux de la Tour."}));
    const portraits = el('div',{class:'entrainement-portraits'});
    for (const h of habitants) portraits.appendChild(el('button',{
      class:'entrainement-portrait' + (h.id === entrainementHabId ? ' actif' : ''),
      title:h.nom, onclick:() => { entrainementHabId = h.id; window.UIDock.ouvrirBatiment(bid, 'entrainer'); }
    }, avatarHab(h,44), el('span',{text:h.nom.split(' ')[0]})));
    c.appendChild(portraits);
    const h = window.Etat.habitant(entrainementHabId);
    c.appendChild(el('div',{class:'entrainement-tete'}, avatarHab(h,72,'or'),
      el('div',{},el('div',{class:'tt',text:h.nom}),el('div',{class:'eti',text:'Choisissez ce qu’il doit pratiquer maintenant.'}))));
    const grille = el('div',{class:'entrainement-grille'});
    for (const id of ['force','dexterite','endurance','intelligence']) {
      const d = window.Entrainement.ATTR[id], p = window.Etat.progresAttributHabitant(h,id);
      const cout = window.Entrainement.cout(h,id), ok = window.Etat.assez(cout);
      grille.appendChild(el('div',{class:'cadre entrainement-carte'},
        el('div',{class:'rangee entre'},
          el('div',{class:'rangee'},el('img',{src:d.image,alt:'',class:'entrainement-stat-art'}),
            el('div',{},el('div',{class:'tt',text:d.nom}),el('div',{class:'eti-or',text:'niveau ' + p.niveau}))),
          el('span',{class:'eti',text:Math.round(p.pct * 100) + ' %'})),
        el('div',{class:'mini-progression'},el('i',{style:'width:' + Math.round(p.pct * 100) + '%'})),
        U.listeRes(cout,{verifier:true}),
        el('button',{class:'b primaire',text:'Faire une séance',disabled:!ok,onclick:() => {
          const r = window.Entrainement.pratiquer(h.id,id);
          U.dire(r.ok ? d.nom + ' : +' + r.gain + ' XP.' : r.raison,r.ok ? 'bien' : 'alerte');
          window.UIDock.ouvrirBatiment(bid, 'entrainer');
        }})));
    }
    c.appendChild(grille);
  }

  /* ==================================================================
     LE PORT — LA FLOTTE

     Un navire, une carte. On voit sa cale, ce qu'elle contient, et le
     seul geste qui compte selon son état : charger s'il est à quai,
     attendre s'il est en mer, se battre s'il mouille devant une île.
     ================================================================== */
  function rendreFlotte(c, cle, rafraichir) {
    const P = window.Port;
    if (!P) return;
    const navs = P.navires();
    const quais = P.quaisMax();

    c.appendChild(U.stats([
      ['navires', navs.length + ' / ' + quais],
      ['en mer', navs.filter(n => n.etat !== 'quai').length],
      ['îles prises', P.assure().prises.length],
    ]));

    for (const n of navs) c.appendChild(carteNavire(n, cle, rafraichir));

    const v = P.peutArmer();
    const bloc = el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'eti-or', text: 'armer un navire de plus' }),
        el('span', { class: 'eti', text: navs.length + ' / ' + quais + ' quais' })));
    if (v.cout) bloc.appendChild(el('div', { style: 'margin-top:8px' }, ligneCout(v.cout, 'coût')));
    bloc.appendChild(el('div', { class: 'rangee entre', style: 'margin-top:8px' },
      el('span', { class: 'eti', text: v.ok ? 'le chantier naval est prêt' : v.pourquoi }),
      el('button', { class: 'b primaire', text: 'Armer', disabled: !v.ok,
        onclick: () => { const r = P.armerNavire();
          U.dire(r.ok ? 'Un navire de plus est à quai.' : r.pourquoi, r.ok ? 'bien' : 'alerte'); } })));
    c.appendChild(bloc);
  }

  function carteNavire(n, cle, rafraichir) {
    const P = window.Port;
    const et = P.etatNavire(n);
    const ile = P.ileDe(n);
    const pris = P.placesPrises(n.cargo);
    const box = el('div', { class: 'cadre' + (n.etat === 'mouillage' ? ' actif' : '') },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', text: n.nom }),
        el('span', { class: n.etat === 'mouillage' ? 'eti-or' : 'eti', text: et.court })));

    /* LA CALE EN BARRE. C'est la contrainte du jeu : elle doit se voir
       avant tout le reste. */
    box.appendChild(el('div', { style: 'margin-top:8px' },
      U.barre(pris / Math.max(1, n.places), 'grande ' + (pris >= n.places ? 'or' : 'vert'),
        'cale', pris + ' / ' + n.places + ' places')));

    if (n.cargo.length)
      box.appendChild(el('div', { class: 'rangee enroule', style: 'margin-top:8px' },
        ...n.cargo.map(x => el('span', { class: 'puce mini',
          text: x.n + ' × ' + nomUnite(x.type) }))));
    else if (n.etat === 'quai')
      box.appendChild(el('div', { class: 'note', style: 'margin-top:4px', text: 'Cale vide.' }));

    if (n.etat === 'mer' || n.etat === 'retour')
      box.appendChild(el('div', { style: 'margin-top:8px' },
        U.barre(1 - n.reste / Math.max(1, n.total), 'grande bleu',
          n.etat === 'mer' ? 'vers ' + (ile ? ile.nom : '—') : 'retour au bourg',
          U.duree(n.reste))));

    const actions = el('div', { class: 'rangee', style: 'margin-top:12px;gap:6px' });
    if (n.etat === 'quai') {
      actions.appendChild(el('button', { class: 'b', text: 'Charger la cale',
        onclick: () => {
          if (cle) {
            navireCaleFlanc[cle] = n.id;
            ongletFlanc[cle] = 'cale';
            if (rafraichir) rafraichir();
          } else ouvrirCale(n.id);
        } }));
      const ag = P.peutAgrandir(n.id);
      actions.appendChild(el('button', { class: 'b', text: 'Agrandir la cale',
        disabled: !ag.ok,
        title: ag.ok ? 'Passer à ' + ag.vers.nom + ' — ' + ag.vers.places + ' places' : ag.pourquoi,
        onclick: () => { const r = P.agrandir(n.id);
          U.dire(r.ok ? 'La cale est agrandie.' : r.pourquoi, r.ok ? 'bien' : 'alerte'); } }));
    } else if (n.etat === 'mouillage' && !n.combattu) {
      /* UNE BATAILLE DÉJÀ OUVERTE — typiquement après un rechargement de
         la page, qui a gardé l'expédition mais perdu l'écran. Renvoyer le
         joueur vers elle, avec une porte de secours, au lieu du refus sec
         « une bataille est déjà en cours » qui le laissait enfermé dehors. */
      if (E().expedition) {
        actions.appendChild(el('button', { class: 'b primaire large', text: 'Rejoindre la bataille',
          onclick: () => window.UIExpedition.ouvrir() }));
        actions.appendChild(el('button', { class: 'b danger', text: 'Abandonner',
          onclick: () => {
            if (confirm('Abandonner cette expédition ? Le navire reprend son équipage, sans butin.')) {
              window.UIExpedition.abandonnerReprise();
              U.dire('Expédition abandonnée : l\'équipage est resté à bord.', 'info');
            }
          } }));
      } else {
        actions.appendChild(el('button', { class: 'b primaire large', text: 'Lancer la bataille',
          onclick: () => { window.Port.combattre(n.id); } }));
      }
    } else if (n.etat === 'mouillage' && n.combattu) {
      /* L'ÎLE EST PRISE. Le navire ne rentre pas d'office : on pousse
         plus loin avec les survivants, ou l'on met le cap sur le bourg.
         C'est le seul moment du jeu où l'on joue son avance. */
      box.appendChild(el('div', { class: 'appel', style: 'margin-top:12px' },
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { class: 'tt', style: 'font-size:13px',
            text: n.gagne ? 'L\'île est prise' : 'La bataille est perdue' }),
          el('div', { class: 'eti',
            text: P.placesPrises(n.cargo) + ' survivants à bord — on peut enchaîner' }))));
      actions.appendChild(el('button', { class: 'b primaire', text: 'Pousser plus loin',
        onclick: () => ouvrirSuite(n.id) }));
      actions.appendChild(el('button', { class: 'b', text: 'Rentrer au bourg',
        onclick: () => { window.Port.rentrerAuBourg(n.id);
          U.dire('Le navire met le cap sur le bourg.', 'bien'); } }));
    }
    if (actions.children.length) box.appendChild(actions);
    return box;
  }

  /* ==================================================================
     LE CHANTIER NAVAL

     Un seul gréement pour toute la flotte : c'est le bourg qui sait
     construire, pas tel ou tel navire. Chaque palier donne DEUX choses,
     et il faut les montrer toutes les deux — la vitesse se sent, la
     PORTÉE se subit : c'est elle qui décide si le Grand Large est
     seulement tentable.
     ================================================================== */
  function rendreChantier(c) {
    const P = window.Port, G = window.Greement;
    if (!P || !G) return;
    const n = P.greement();
    const actuel = G.palierGreement(n);
    const suiv = G.suivant(n);
    const v = P.peutGreer();

    c.appendChild(el('div', { class: 'note',
      text: "Un navire ne va pas plus loin que son gréement ne le permet. "
          + "Le chantier ne touche pas la cale — il touche la mer qu'on peut mettre "
          + 'derrière soi.' }));

    c.appendChild(el('div', { class: 'cadre actif' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', style: 'font-size:14px', text: actuel.nom }),
        el('span', { class: 'eti-or', text: 'palier ' + n })),
      el('div', { class: 'note', style: 'margin-top:6px', text: actuel.desc }),
      el('div', { class: 'rangee entre', style: 'margin-top:8px' },
        el('span', { class: 'eti', text: 'portée de la flotte' }),
        el('span', { class: 'eti-or', text: P.portee() + ' lieues' })),
      el('div', { class: 'rangee entre', style: 'margin-top:4px' },
        el('span', { class: 'eti', text: 'gain de vitesse' }),
        el('span', { class: 'eti-or', text: Math.round(actuel.vite * 100) + ' %' }))));

    if (!suiv) {
      c.appendChild(el('div', { class: 'cadre creux' },
        el('div', { class: 'eti-or', text: 'chantier au bout de son art' }),
        el('div', { class: 'note', style: 'margin-top:6px',
          text: "Il n'y a plus rien à ajouter à ces navires. Ce qui reste à prendre "
              + 'se prend avec ceux-là.' })));
      return;
    }

    /* CE QUE LE PALIER SUIVANT VA CHERCHER. Une amélioration qu'on ne
       sait pas relier à une destination n'est qu'une dépense : on cite
       donc la terre la plus proche qu'elle met à portée. */
    const cible = G.prochaineHorsPortee(n);
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', style: 'font-size:14px', text: suiv.nom }),
        el('span', { class: 'eti', text: 'palier ' + (n + 1) })),
      el('div', { class: 'note', style: 'margin-top:6px', text: suiv.desc }),
      el('div', { class: 'rangee entre', style: 'margin-top:8px' },
        el('span', { class: 'eti', text: 'portée' }),
        el('span', { class: 'eti-or', text: P.portee() + ' → ' + suiv.portee + ' lieues' })),
      el('div', { class: 'rangee entre', style: 'margin-top:4px' },
        el('span', { class: 'eti', text: 'vitesse' }),
        el('span', { class: 'eti-or',
          text: Math.round(actuel.vite * 100) + ' → ' + Math.round(suiv.vite * 100) + ' %' })),
      cible && cible.lieues <= suiv.portee
        ? el('div', { class: 'note', style: 'margin-top:6px',
            text: 'Met ' + cible.nom + ' à portée (' + cible.lieues + ' lieues).' })
        : null,
      el('div', { style: 'margin-top:8px' }, U.listeRes(suiv.cout, { verifier: true })),
      el('button', { class: 'b primaire pleine', style: 'margin-top:8px',
        text: v.ok ? 'Armer le chantier' : (v.pourquoi || 'Impossible'), disabled: !v.ok,
        onclick: () => { const r = P.greer();
          U.dire(r.ok ? ('Le chantier livre : ' + r.palier.nom + '.') : r.pourquoi,
                 r.ok ? 'bien' : 'alerte'); } })));
  }

  function nomUnite(t) {
    const u = window.GameData.UNIT_TYPES[t];
    return u ? (u.name && u.name.cats ? u.name.cats : t) : t;
  }

  /* LA CALE. Son contenu est maintenant un vrai panneau réutilisable :
     sur la carte du port il vit dans le flanc gauche, donc jamais derrière
     la page plein écran. Le vieux dialogue ne sert que de repli. */
  function rendreContenuCale(c, navId, options) {
    options = options || {};
    const P = window.Port, n = P.navire(navId);
    if (!n) return;
    const refaire = options.rafraichir || function () {};
    const pris = P.placesPrises(n.cargo);
    c.appendChild(el('div', { class:'cale-entete' },
      el('div', {}, el('div', { class:'tt', text:n.nom }),
        el('div', { class:'note', text:'Composez les troupes qui partiront réellement.' })),
      el('b', { text:pris + ' / ' + n.places })));
    c.appendChild(el('div', { class:'cale-jauge' },
      U.barre(pris / Math.max(1, n.places), 'grande ' + (pris >= n.places ? 'or' : 'vert'),
        'places occupées', Math.max(0, n.places - pris) + ' libres')));

    const types = P.typesEmbarquables();
    if (!types.length) {
      c.appendChild(el('div', { class:'vide cale-vide' },
        el('div', { class:'tt', text:'Aucune unité disponible' }),
        el('div', { class:'note',
          text:"Formez d'abord des unités à la caserne. Elles apparaîtront ensuite ici pour être embarquées." })));
    }
    const liste = el('div', { class:'cale-unites' });
    for (const t of types) {
      const d = window.GameData.UNIT_TYPES[t] || {};
      const pop = d.pop || 1;
      const embarque = (n.cargo.find(x => x.type === t) || { n:0 }).n;
      const libre = P.disponible(t);
      const placeLibre = Math.max(0, n.places - P.placesPrises(n.cargo));
      const ajoutPossible = Math.min(libre, Math.floor(placeLibre / pop));
      const src = window.Img && window.Img.unite ? window.Img.unite(t) : null;
      liste.appendChild(el('div', { class:'cale-unite' + (embarque ? ' embarquee' : '') },
        el('div', { class:'cale-unite-art' },
          src ? window.Img.vignette(src, 58, nomUnite(t)) : el('span', { text:nomUnite(t).charAt(0) })),
        el('div', { class:'cale-unite-corps' },
          el('div', { class:'rangee entre' },
            el('b', { text:nomUnite(t) }),
            el('span', { class:'cale-unite-nombre', text:embarque + ' à bord' })),
          el('div', { class:'eti', text:libre + ' disponible' + (libre > 1 ? 's' : '')
            + ' · ' + pop + ' place' + (pop > 1 ? 's' : '') + ' par unité' }),
          el('div', { class:'cale-unite-actions' },
            ...[1, 5, 25].map(k => el('button', { class:'b mini', text:'+' + k,
              disabled:ajoutPossible <= 0, onclick:() => {
                const r = P.charger(n.id, t, k);
                if (!r.ok) U.dire(r.pourquoi, 'alerte');
                refaire();
              } })),
            el('button', { class:'b mini', text:'Tout', disabled:ajoutPossible <= 0,
              onclick:() => { const r=P.charger(n.id,t,ajoutPossible);
                if (!r.ok) U.dire(r.pourquoi,'alerte'); refaire(); } }),
            el('button', { class:'b mini danger', text:'−1', disabled:embarque <= 0,
              onclick:() => { P.decharger(n.id,t,1); refaire(); } }),
            el('button', { class:'b mini danger', text:'Retirer', disabled:embarque <= 0,
              onclick:() => { P.decharger(n.id,t); refaire(); } }))));
    }
    if (types.length) c.appendChild(liste);
    c.appendChild(el('div', { class:'cale-pied' },
      el('button', { class:'b', text:'Vider la cale', disabled:!n.cargo.length,
        onclick:() => { P.viderCale(n.id); refaire(); } }),
      el('button', { class:'b primaire', text:options.finTexte || 'Choisir une île',
        onclick:options.fin || (() => { U.fermer('cale'); ouvrirDestination(navId); }) })));
  }

  function ouvrirCale(navId) {
    U.ouvrir('cale', { titre:'La cale', sous:"Ce qu'on emmène", classe:'large',
      onglets:[{ id:'c', nom:'Embarquement', rendu:c => rendreContenuCale(c, navId, {
        rafraichir:() => U.ouvrir('cale', {})
      }) }] });
  }

  /* ==================================================================
     LA CARTE MARITIME

     Choisir une île se faisait sur une pile de douze blocs identiques :
     la distance n'y était qu'un nombre de plus. Or c'est ELLE la
     contrainte du port — elle se paie en temps de mer, et le navire
     manque au bourg pendant tout ce temps. On la remet donc à sa place,
     sur une carte, où l'on voit d'un coup d'œil ce qui est à portée de
     matinée et ce qui demande une flotte.

     POURQUOI DU SVG ET PAS UNE TOILE. Les fenêtres se redessinent cinq
     fois par seconde et passent par la réconciliation de `ui-noyau` : en
     SVG la carte est du DOM comme le reste, donc le morphage ne touche
     que ce qui a bougé, le survol est du CSS et les infobulles maison
     (`data-bulle`) marchent sans une ligne de plus. Une toile aurait
     obligé à refaire à la main le dessin, la détection de survol et les
     bulles — pour le même résultat à l'écran.
     ================================================================== */
  const NS_SVG = 'http://www.w3.org/2000/svg';

  /* `el` ne peut pas servir ici : il passe par `createElement`, qui
     rendrait des balises HTML inertes portant le nom d'une forme. On
     garde en revanche ses conventions d'écriture — `text` pour le
     contenu, `title` pour l'infobulle maison. */
  function sv(tag, attrs) {
    const n = document.createElementNS(NS_SVG, tag);
    if (attrs) for (const k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'title') { if (attrs[k]) n.setAttribute('data-bulle', attrs[k]); }
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) { for (const x of c) if (x) n.appendChild(x); }
      else n.appendChild(c);
    }
    return n;
  }
  const ar = v => Math.round(v * 10) / 10;

  /* DEUX THÉÂTRES, UNE SEULE CARTE.

     `local` est la couronne du bourg : vingt-cinq lieues, une matinée de
     mer, des cailloux. `large` commence là où elle finit — trois cents
     lieues, des continents, et des villes qu'on prend une par une. Le
     dessin est le même, seule l'échelle change ; c'est voulu, pour que
     le joueur qui a appris à lire la première sache lire la seconde.

     L'ÉCHELLE EST AFFINE dans les deux cas : autant de lieues de plus,
     autant de pixels de plus, donc les anneaux se lisent comme une
     règle. `r0` n'est pas un biais mais la place que tient le bourg
     lui-même — rien ne se pose dessus. */
  const CARTES = {
    /* La carte locale est une feuille CARRÉE, bien plus grande que sa
       fenêtre. Chaque tier ajoute une couronne sans déplacer celles déjà
       connues — et la fenêtre ne glisse que jusqu'au tier découvert. */
    local: { L: 40000, H: 40000, cx: 20000, cy: 20000,
             r0: 110, pas: 85, lieuesMax: 10, anneau: 1,
             unite: 'TIER', libelle: 'Les eaux explorées' },
    large: { L: 880, H: 620, cx: 440, cy: 310,
             r0: 46, pas: 0.775, lieuesMax: 310, anneau: 50,
             unite: 'LIEUES', libelle: 'Le Grand Large' },
  };
  const CRAN = 5 * Math.PI / 180;   // le pas de rotation quand deux terres se serrent
  const MARGE = 4;                  // le vide gardé autour de chaque emprise

  let CARTE = CARTES.local;
  const rayonLieues = l => CARTE.r0 + l * CARTE.pas;

  /* L'ANGLE D'UNE TERRE NE DOIT JAMAIS BOUGER. Une carte qui se rebat à
     chaque ouverture n'est pas une carte : le joueur doit pouvoir dire
     « la Saline, c'est plein ouest » et avoir raison la partie suivante.

     Au large, l'angle est ÉCRIT dans les données (`secteur`) parce que
     les villes d'un même continent doivent se tenir sur la même côte.
     Dans la couronne, il sort d'un HACHAGE de l'identifiant — même
     identifiant, même angle, pour toujours, sans rien stocker. */
  function hachage(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    /* FNV seul laisse les identifiants courts groupés dans le premier
       tiers de l'intervalle — les douze îles se seraient serrées dans le
       même quart de mer. Le brassage final (celui de MurmurHash3) rend
       les bits de poids fort utilisables, et la couronne se remplit. */
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /* LA TAILLE DIT LA FORCE. C'est le canal le plus direct qu'on ait sur
     une carte : une grosse île, c'est une grosse garnison, et cela se
     lit sans légende ni comptage. Les crans exacts restent dans
     l'infobulle et dans la fiche, pour qui veut le chiffre. Au large les
     forces montent à trente : on écrase l'échelle pour que la Couronne
     ne fasse pas trois fois la taille de la carte. */
  const tailleIle = f => f <= 10 ? 30 + f * 3.15 : 45 + Math.sqrt(f - 10) * 4;

  /* TROIS TEINTES, PAS DIX. La taille dit déjà la force au pixel près ;
     la teinte répond à la seule question qu'on se pose devant la carte :
     est-ce à ma portée ? */
  const teinteForce = f => f <= 3 ? 'douce' : (f <= 6 ? 'rude' : 'ardente');

  /* UN ARCHIPEL PAR TIER, PAS UNE RONDE D'ÎLES. Chaque tier occupe une
     bande de mer assez profonde pour que ses forces 1 à 10 s'éloignent
     réellement du bourg. Les bandes ne se recouvrent pas : même la plus
     facile du tier suivant reste au-delà de la plus dure du précédent. */
  const ARCHIPEL_DEPART = 195;
  const ARCHIPEL_LARGEUR = 410;
  const ARCHIPEL_PAS = 700;
  const ANGLE_OR = Math.PI * (3 - Math.sqrt(5));
  const tailleIleLocale = f => tailleIle(f) * (1.55 + Math.max(1, Math.min(10, f)) * .055);
  let cerclesMemo = null;
  function cerclesLocal() {
    if (cerclesMemo) return cerclesMemo;
    const out = [];
    const s = tailleIleLocale(10) * 1.18 + 12;
    for (let tier = 1; tier <= 10; tier++) {
      const interieur = ARCHIPEL_DEPART + (tier - 1) * ARCHIPEL_PAS;
      out.push({ interieur, exterieur: interieur + ARCHIPEL_LARGEUR,
        r: interieur + ARCHIPEL_LARGEUR, s, n: 10, tier });
    }
    cerclesMemo = out;
    return out;
  }
  /* le bord extérieur d'un tier : le dernier cercle, plus sa plus grande
     île, plus une respiration — c'est lui qui borne la fenêtre */
  function bordTier(ti) {
    const c = cerclesLocal()[Math.max(1, Math.min(10, ti)) - 1];
    return c.r + c.s + 34;
  }

  /* CE QUI OCCUPE VRAIMENT LA PLACE, C'EST LE NOM. Un îlot fait six
     pixels de rayon, son nom en fait cent : caler les cailloux les uns
     par rapport aux autres ne suffit pas, il faut caler les étiquettes.
     On tient donc pour chaque terre deux emprises — le caillou et sa
     boîte de texte — et rien ne doit se croiser.

     La largeur du texte est ESTIMÉE : la carte se calcule avant d'être à
     l'écran, et l'on ne mesure pas un texte qui n'existe pas encore. Un
     peu large vaut mieux qu'un peu juste. */
  function poser(p, a) {
    const co = Math.cos(a), si = Math.sin(a);
    p.a = a;
    p.x = CARTE.cx + p.r * co;
    p.y = CARTE.cy + p.r * si;
    /* LE NOM PART VERS LE LARGE, jamais vers le centre : il ne peut donc
       pas venir se coucher sur les libellés d'anneaux. Les terres du nord
       s'écartent un peu plus — c'est de ce côté que flotte le fanion. */
    const d = p.taille + 13 + (si < -0.35 ? 10 : 0);
    p.nx = p.x + co * d;
    p.ny = p.y + si * d + 3.4;
    p.ancre = co > 0.25 ? 'start' : (co < -0.25 ? 'end' : 'middle');
    const w = p.ile.nom.length * 5.6 + 6;
    const g = p.ancre === 'start' ? p.nx : (p.ancre === 'end' ? p.nx - w : p.nx - w / 2);
    p.boite = { x1: g, y1: p.ny - 9.5, x2: g + w, y2: p.ny + 4 };
    /* L'emprise du caillou réserve aussi la hauteur du fanion, qu'il
       soit hissé ou non : la carte ne doit pas se réorganiser le jour où
       la terre est prise. */
    p.pave = { x1: p.x - p.taille - MARGE, y1: p.y - p.taille - 14,
               x2: p.x + p.taille + MARGE, y2: p.y + p.taille + MARGE };
  }
  const croise = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
  function genent(A, B) {
    return croise(A.pave, B.pave) || croise(A.boite, B.boite)
        || croise(A.pave, B.boite) || croise(A.boite, B.pave);
  }

  /* Le plan ne dépend que des données : on le calcule une fois PAR
     THÉÂTRE. Le mémoriser n'est pas une optimisation, c'est la preuve
     que la carte ne peut pas changer entre deux ouvertures. */
  const plans = {};
  function planIles(theatre) {
    const t = theatre || 'local';
    const clePlan = t === 'local' ? 'local:' + (window.Port && window.Port.rayon ? window.Port.rayon() : 1) : t;
    if (plans[clePlan]) return plans[clePlan];
    const memoire = CARTE;
    CARTE = CARTES[t];

    /* LES LIBELLÉS D'ANNEAUX SONT POSÉS LES PREMIERS, comme des terres
       qu'on ne dessine pas : les vraies s'écarteront d'elles-mêmes de
       l'échelle au lieu de venir s'asseoir dessus. */
    const pris = [];
    if (t === 'local') {
      /* un libellé par tier, posé sur sa couronne */
      for (let ti = 1; ti <= 10; ti++) {
        const r = cerclesLocal()[ti - 1].r;
        const y = CARTE.cy - r + 3, w = (ti + ' ' + CARTE.unite).length * 5.6 + 6;
        const b = { x1: CARTE.cx - w / 2, y1: y - 9.5, x2: CARTE.cx + w / 2, y2: y + 4 };
        pris.push({ pave: b, boite: b });
      }
    } else {
      for (let l = CARTE.anneau; l <= CARTE.lieuesMax; l += CARTE.anneau) {
        const y = CARTE.cy - rayonLieues(l) + 3, w = (l + ' ' + CARTE.unite).length * 5.6 + 6;
        const b = { x1: CARTE.cx - w / 2, y1: y - 9.5, x2: CARTE.cx + w / 2, y2: y + 4 };
        pris.push({ pave: b, boite: b });
      }
    }
    pris.push({ pave: { x1: CARTE.cx - 88, y1: CARTE.cy - 78, x2: CARTE.cx + 88, y2: CARTE.cy + 88 },
                boite: { x1: CARTE.cx - 56, y1: CARTE.cy + 70, x2: CARTE.cx + 56, y2: CARTE.cy + 88 } });

    const rayonOuvert = window.Port && window.Port.rayon ? Math.min(10, window.Port.rayon()) : 1;
    const source = t === 'large' ? (window.LARGE || [])
      : (window.ILES || []).filter(ile => (ile.tier || 1) <= rayonOuvert);
    const l = source.map(ile => ({
      ile,
      r: t === 'local' ? rayonLieues(ile.tier || 1) : rayonLieues(ile.lieues),
      taille: tailleIle(ile.force),
      /* au large le relèvement est écrit dans les données ; dans la
         couronne il se pose plus bas, cercle par cercle */
      a0: ile.secteur != null ? ile.secteur : 0,
      fixe: ile.secteur != null,
    }));
    /* La force décide d'abord de la DISTANCE, puis de la taille. Un petit
       bruit radial donne une côte naturelle mais reste bien inférieur à
       l'écart entre deux forces : une force 7 ne peut donc jamais se
       retrouver plus près qu'une force 6. Les angles suivent la spirale
       d'or, enrichie d'un léger écart propre à l'île : pas de roue, pas
       d'alignements en rayons, et une répartition stable entre parties. */
    if (t === 'local') {
      for (const p of l) {
        const ti = p.ile.tier || 1;
        const f = Math.max(1, Math.min(10, p.ile.force || 1));
        const c = cerclesLocal()[ti - 1];
        const i = f - 1;
        const radial = (hachage(p.ile.id + ':distance') - .5) * 24;
        p.r = c.interieur + (i / 9) * (c.exterieur - c.interieur) + radial;
        p.taille = tailleIleLocale(f);
        p.a0 = -Math.PI / 2 + ((ti - 1) * 10 + i) * ANGLE_OR
          + (hachage(p.ile.id + ':cap') - .5) * .52;
      }
    }
    for (const p of l) {
      /* DEUX TERRES PEUVENT TOMBER AU MÊME RELÈVEMENT. Le hachage ne
         garantit qu'une chose : la stabilité. On dégage donc ce qui se
         chevauche en faisant tourner d'un cran fixe, alternativement d'un
         bord et de l'autre, dans l'ordre du tableau — c'est-à-dire de
         façon parfaitement reproductible. Une ville de continent garde
         en revanche son cap : elle est sur une côte, elle n'en bouge
         pas ; c'est le rayon qui la sépare de ses voisines. */
      let k = 0;
      poser(p, p.a0);
      /* sans nom sur la carte locale, l'emprise de l'île EST son caillou :
         la boîte de texte n'a plus à réserver cent pixels de mer */
      if (t === 'local') p.boite = p.pave;
      if (!p.fixe)
        while (k++ < 71 && pris.some(q => genent(p, q))) {
          poser(p, p.a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * CRAN);
          if (t === 'local') p.boite = p.pave;
        }
      pris.push(p);
      /* Un contour à sept faces, tiré du même hachage : chaque terre
         garde sa silhouette d'une partie à l'autre, et aucune n'est un
         rond. Les villes, elles, sont carrées — c'est bâti, pas né. */
      const pts = [];
      const faces = p.ile.type === 'ville' ? 5 : 7;
      for (let s = 0; s < faces; s++) {
        const an = s / faces * Math.PI * 2;
        const dd = p.taille * (0.72 + 0.42 * hachage(p.ile.id + '#' + s));
        pts.push(ar(Math.cos(an) * dd) + ',' + ar(Math.sin(an) * dd));
      }
      p.contour = pts.join(' ');
    }
    plans[clePlan] = l;
    CARTE = memoire;
    return plans[clePlan];
  }
  function planDe(id, theatre) {
    return planIles(theatre).find(p => p.ile.id === id) || null;
  }

  /* LA CÔTE D'UN CONTINENT. On la trace comme une bande de terre qui
     barre le fond de la carte derrière ses villes : un arc côtier
     dentelé côté mer, un arc franc côté large. Sans elle, trois villes
     alignées ne se lisent pas comme un continent mais comme trois îles
     de plus. */
  function traceContinent(cont, theatre) {
    const plan = planIles(theatre);
    const villes = plan.filter(p => p.ile.continent === cont.id);
    if (!villes.length) return null;
    const memoire = CARTE; CARTE = CARTES[theatre];
    const a0 = Math.min.apply(null, villes.map(v => v.a)) - 0.30;
    const a1 = Math.max.apply(null, villes.map(v => v.a)) + 0.30;
    const rIn = Math.min.apply(null, villes.map(v => v.r)) - 16;
    const rOut = Math.max.apply(null, villes.map(v => v.r)) + 46;
    const pts = [];
    const N = 26;
    /* la côte, dentelée : c'est ce qui la distingue de la limite du large */
    for (let i = 0; i <= N; i++) {
      const a = a0 + (a1 - a0) * i / N;
      const d = rIn - hachage(cont.id + ':c' + i) * 13;
      pts.push(ar(CARTE.cx + Math.cos(a) * d) + ',' + ar(CARTE.cy + Math.sin(a) * d));
    }
    for (let i = N; i >= 0; i--) {
      const a = a0 + (a1 - a0) * i / N;
      const d = rOut + hachage(cont.id + ':o' + i) * 22;
      pts.push(ar(CARTE.cx + Math.cos(a) * d) + ',' + ar(CARTE.cy + Math.sin(a) * d));
    }
    const am = (a0 + a1) / 2, rm = (rIn + rOut) / 2 + 10;
    const out = { points: pts.join(' '),
                  nx: CARTE.cx + Math.cos(am) * rm, ny: CARTE.cy + Math.sin(am) * rm,
                  angle: am * 180 / Math.PI };
    CARTE = memoire;
    return out;
  }

  /* Ce que le survol raconte : le nom, la mer à franchir, la force, ce
     que sa prise rend au bourg, et ce qu'on en rapporte. */
  function bulleIle(ile, nav, prise) {
    const duree = window.IleUtil.traversee(ile.lieues, nav ? nav.palier : 0);
    const butin = Object.keys(ile.butin).map(k =>
      ile.butin[k] + ' ' + (window.RES[k] ? window.RES[k].nom.toLowerCase() : k));
    const l = [ile.nom,
      ile.lieues + ' lieues — ' + U.duree(duree) + ' de mer',
      '· force ' + ile.force];
    if (ile.menace) l.push('· la prendre fait retomber la Nuée de ' + ile.menace + ' points');
    l.push('· butin : ' + (butin.length ? butin.join(', ') : 'rien'));
    const P = window.Port;
    if (P && P.portee && ile.lieues > P.portee())
      l.push('· HORS DE PORTÉE : la flotte ne tient que ' + P.portee() + ' lieues');
    if (prise) l.push('· déjà prise');
    return l.join('\n');
  }

  /* LA FENÊTRE CARRÉE. Le parchemin ne montre d'abord que la première
     couronne ; chaque tier découvert élargit d'un anneau ce que la souris
     peut atteindre — jamais davantage. Au large, la feuille tient entière
     dans la fenêtre : il n'y a rien à faire glisser. */
  function cadreMer(t, rayon) {
    const C = CARTES[t];
    if (t !== 'local') {
      const demi = Math.max(C.L, C.H) / 2;
      return { minDemi: demi, defDemi: demi, maxDemi: demi };
    }
    const r = cerclesLocal();
    /* PAR DÉFAUT, LA MER PROCHE : les deux premiers cercles, gros et
       lisibles — c'est là qu'on décide sa première sortie. La molette
       zoome du premier cercle jusqu'au tier découvert entier, la
       glisse complète ce qui déborde ; rien n'est hors d'atteinte. */
    return {
      minDemi: 300,
      defDemi: bordTier(1),
      maxDemi: bordTier(rayon),
    };
  }
  function bride(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function dessinerMer(nav, choisi, theatre, vue) {
    const t = theatre || 'local';
    const memoire = CARTE; CARTE = CARTES[t];
    const C = CARTE, rMax = t === 'local' ? bordTier(10) : rayonLieues(C.lieuesMax);
    const vb = vue || { x: 0, y: 0, demi: Math.max(C.L, C.H) / 2 };
    const P = window.Port;
    const portee = P && P.portee ? P.portee() : 9999;
    const porteeCarte = t === 'local'
      ? Math.max(1, Math.min(10, P && P.rayon ? P.rayon() : 1))
      : portee;
    const carte = sv('svg', { class: 'mer-carte',
      viewBox: ar(vb.x) + ' ' + ar(vb.y) + ' ' + ar(vb.demi * 2) + ' ' + ar(vb.demi * 2),
      role: 'img', 'aria-label': 'Carte marine — ' + C.libelle });
    const defs = sv('defs');
    /* LE PARCHAMIN À SA TAILLE NATURELLE. Le motif fait 512 px à l'écran,
       quel que soit le zoom : c'est du papier, pas un objet du monde.
       On convertit donc les pixels écran en unités de la feuille d'après
       l'étendue vue — sans ça, la grande carte montrait un papier
       minuscule, réduit comme un timbre. */
    const tuile = ar(512 * (2 * vb.demi) / 950);
    const motif = sv('pattern', { id: 'papier-mer-' + t, patternUnits: 'userSpaceOnUse',
      width: tuile, height: tuile });
    motif.appendChild(sv('image', { href: 'img/iles/fond-carte-parchemin-tuile.png',
      x: 0, y: 0, width: tuile, height: tuile, preserveAspectRatio: 'none' }));
    defs.appendChild(motif); carte.appendChild(defs);
    carte.appendChild(sv('rect', { class: 'mer-papier-base', x: 0.5, y: 0.5,
      width: C.L - 1, height: C.H - 1, rx: 5 }));
    carte.appendChild(sv('rect', { class: 'mer-fond', x: 0.5, y: 0.5,
      width: C.L - 1, height: C.H - 1, rx: 5,
      fill: 'url(#papier-mer-' + t + ')' }));

    /* LES LIGNES DE RHUMB ne portent aucune information : elles disent
       que ceci est une carte marine, et elles tirent l'œil du bourg vers
       le large. Seize aires de vent, comme sur les portulans. */
    const rhumbs = sv('g', { class: 'mer-rhumbs' });
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8;
      rhumbs.appendChild(sv('line', {
        x1: ar(C.cx + Math.cos(a) * 27), y1: ar(C.cy + Math.sin(a) * 27),
        x2: ar(C.cx + Math.cos(a) * rMax), y2: ar(C.cy + Math.sin(a) * rMax) }));
    }
    carte.appendChild(rhumbs);

    /* LA HOULE : trois arcs de vaguelettes semés entre les anneaux. Ils
       ne disent rien non plus, et c'est leur seul rôle — une carte
       marine sans mer dessinée n'est qu'un diagramme. */
    const houle = sv('g', { class: 'mer-houle' });
    /* la houle ne seme que la mer VUE : au large toute la feuille, dans
       la couronne seulement ce que le tier découvert ouvre */
    const rHoule = t === 'local' ? bordTier(porteeCarte) : rMax;
    for (let i = 0; i < 48; i++) {
      const a = hachage('h' + i) * Math.PI * 2;
      const r = 70 + hachage('hr' + i) * Math.max(60, rHoule - 90);
      const x = C.cx + Math.cos(a) * r, y = C.cy + Math.sin(a) * r;
      houle.appendChild(sv('path', { class: 'mer-vague',
        d: 'M' + ar(x - 7) + ',' + ar(y) + ' q3.5,-2.6 7,0 q3.5,2.6 7,0' }));
    }
    carte.appendChild(houle);

    /* LES CONTINENTS d'abord : ce sont des fonds de carte, les villes se
       posent dessus. */
    if (t === 'large' && window.CONTINENTS) {
      const terres = sv('g', { class: 'mer-continents' });
      for (const cont of window.CONTINENTS) {
        const tr = traceContinent(cont, t);
        if (!tr) continue;
        terres.appendChild(sv('polygon', { class: 'mer-continent',
          points: tr.points, title: cont.nom + '\n' + cont.villes.length
            + ' villes sur la côte, de ' + cont.lieues + ' à ' + cont.bout + ' lieues' }));
        terres.appendChild(sv('text', { class: 'mer-continent-nom',
          x: ar(tr.nx), y: ar(tr.ny), 'text-anchor': 'middle',
          transform: 'rotate(' + ar(tr.angle + (Math.cos(tr.angle * Math.PI / 180) < 0 ? 180 : 0))
                   + ',' + ar(tr.nx) + ',' + ar(tr.ny) + ')',
          text: cont.nom.toUpperCase() }));
      }
      carte.appendChild(terres);
    }

    /* LES ANNEAUX DE DISTANCE, avec leur libellé posé sur le trait plein
       nord : le halo de mer que porte le texte coupe l'anneau derrière
       lui, comme sur une carte gravée. */
    const anneaux = sv('g', { class: 'mer-anneaux' });
    if (t === 'local') {
      /* Une couronne par tier : la carte se lit comme un territoire,
         pas comme un instrument de mesure. */
      for (const c of cerclesLocal()) {
        anneaux.appendChild(sv('circle', { class: 'mer-anneau', cx: C.cx, cy: C.cy, r: ar(c.r) }));
        anneaux.appendChild(sv('text', { class: 'mer-lieues',
          x: C.cx, y: ar(C.cy - c.r + 3), text: c.tier + ' ' + C.unite }));
      }
    } else {
      for (let l = C.anneau; l <= C.lieuesMax; l += C.anneau) {
        const r = rayonLieues(l);
        anneaux.appendChild(sv('circle', { class: 'mer-anneau', cx: C.cx, cy: C.cy, r: ar(r) }));
        anneaux.appendChild(sv('text', { class: 'mer-lieues',
          x: C.cx, y: ar(C.cy - r + 3), text: l + ' ' + C.unite }));
      }
    }
    carte.appendChild(anneaux);

    /* LA LIMITE DE PORTÉE. C'est la seule ligne de la carte qui parle du
       joueur et non du monde : au-delà, le capitaine refuse. La tracer
       vaut mieux que de le dire, parce qu'on voit du même coup ce que le
       prochain gréement irait chercher. */
    if (porteeCarte < C.lieuesMax * 1.4 && porteeCarte > 0) {
      const rp = t === 'local' ? bordTier(porteeCarte)
                               : rayonLieues(Math.min(porteeCarte, C.lieuesMax));
      carte.appendChild(sv('circle', { class: 'mer-portee', cx: C.cx, cy: C.cy, r: ar(rp) }));
      carte.appendChild(sv('text', { class: 'mer-portee-nom',
        x: C.cx, y: ar(C.cy + rp - 6), text: 'PORTÉE DE LA FLOTTE' }));
    }

    /* LA ROUTE de la terre choisie : un trait du bourg jusqu'à elle, et
       rien d'autre. Le temps de mer est à trois centimètres de là, dans
       la fiche, où rien ne le gêne. */
    const routes = sv('g', { class: 'mer-routes' });
    const cap = choisi ? planDe(choisi.id, t) : null;
    if (cap) routes.appendChild(sv('line', { class: 'mer-route',
      x1: ar(C.cx + Math.cos(cap.a) * 27), y1: ar(C.cy + Math.sin(cap.a) * 27),
      x2: ar(cap.x), y2: ar(cap.y) }));
    carte.appendChild(routes);

    /* LE BOURG, au centre. La Tour reste reconnaissable, mais sous la
       forme d'un symbole d'encre vu du dessus : une carte ne contient
       jamais la maquette 3D de ce qu'elle représente. */
    carte.appendChild(sv('g', { class: 'mer-bourg',
      transform: 'translate(' + C.cx + ',' + C.cy + ')',
      title: 'Le bourg\nToutes les distances se comptent d\'ici.' },
      sv('path', { class:'mer-bourg-cote',
        d:'M-72,-19 C-65,-47 -33,-62 -7,-53 C16,-66 52,-50 61,-25 C82,-4 67,30 43,39 C25,63 -14,61 -31,47 C-61,46 -82,14 -72,-19 Z' }),
      sv('path', { class:'mer-bourg-hachures',
        d:'M-57,-28 l12,5 M-64,-8 l14,4 M42,-37 l10,8 M49,26 l10,-4 M-32,42 l8,-9 M17,48 l5,-10' }),
      sv('path', { class:'mer-bourg-sentier', d:'M0,16 C11,25 21,35 34,47' }),
      sv('g', { class:'mer-bourg-tour-carte' },
        sv('circle', { r:15 }), sv('circle', { r:8 }),
        sv('rect', { x:-4,y:-21,width:8,height:7 }),
        sv('rect', { x:-4,y:14,width:8,height:7 }),
        sv('rect', { x:-21,y:-4,width:7,height:8 }),
        sv('rect', { x:14,y:-4,width:7,height:8 }),
        sv('circle', { class:'mer-bourg-feu', r:2.4 })),
      sv('path', { class:'mer-bourg-quai', d:'M33,46 l16,10 M37,40 l17,11 M48,56 l7,-9' }),
      sv('text', { class: 'mer-bourg-nom', x: 0, y: 75, text: 'VOTRE ÎLE' })));

    const iles = sv('g', { class: 'mer-iles' });
    for (const p of planIles(t)) {
      const I = p.ile;
      const prise = window.Port.estPrise(I.id);
      const loin = I.lieues > portee;
      const g = sv('g', {
        class: 'mer-ile ' + teinteForce(I.force) + (prise ? ' prise' : '')
             + (loin ? ' loin' : '') + (I.type === 'ville' ? ' ville' : '')
             + (choisi && choisi.id === I.id ? ' choisie' : ''),
        'data-cle': I.id, 'data-ile': I.id,
        transform: 'translate(' + ar(p.x) + ',' + ar(p.y) + ')',
        title: bulleIle(I, nav, prise) });
      /* une cible de clic confortable : les îlots proches font six
         pixels de rayon, on ne vise pas cela à la souris */
      g.appendChild(sv('circle', { class: 'mer-zone', r: ar(Math.max(17, p.taille + 9)) }));
      if (choisi && choisi.id === I.id)
        g.appendChild(sv('circle', { class: 'mer-halo', r: ar(p.taille + 7) }));
      const imageIle = window.IleUtil && window.IleUtil.imageCartePour
        ? window.IleUtil.imageCartePour(I)
        : (window.IleUtil && window.IleUtil.imagePour ? window.IleUtil.imagePour(I) : I.image);
      if (imageIle) {
        const cote = p.taille * 2.55;
        g.appendChild(sv('image', { class: 'mer-illustration', href: imageIle,
          x: ar(-cote / 2), y: ar(-cote / 2), width: ar(cote), height: ar(cote),
          preserveAspectRatio: 'xMidYMid meet' }));
      } else g.appendChild(sv('polygon', { class: 'mer-terre', points: p.contour }));
      /* UNE VILLE N'EST PAS UNE ÎLE : on lui pose des toits et un beffroi,
         pour que la côte se lise comme habitée. */
      if (I.type === 'ville') {
        g.appendChild(sv('rect', { class: 'mer-ville-tour',
          x: -1.8, y: ar(-p.taille - 7), width: 3.6, height: ar(p.taille + 7) }));
        g.appendChild(sv('polygon', { class: 'mer-ville-toit',
          points: '-6,0 -3,-5 0,0' }));
        g.appendChild(sv('polygon', { class: 'mer-ville-toit',
          points: '2,0 5,-4 8,0' }));
      }
      /* LE FANION DU BOURG sur les terres tenues : c'est la marque qu'on
         cherche des yeux en rouvrant la carte. */
      if (prise) {
        const h = -p.taille - 12;
        g.appendChild(sv('line', { class: 'mer-mat',
          x1: 0, y1: ar(-p.taille + 2), x2: 0, y2: ar(h) }));
        g.appendChild(sv('polygon', { class: 'mer-fanion',
          points: '0,' + ar(h) + ' 7.5,' + ar(h + 2.7) + ' 0,' + ar(h + 5.4) }));
      }
      /* LE NOM NE SE LIT PLUS SUR LA COURONNE : il encombrait la mer et
         doublait l'infobulle. Il reste au large, où les villes sont des
         repères de côte qu'on apprend par cœur. */
      if (t !== 'local') g.appendChild(sv('text', { class: 'mer-nom', 'text-anchor': p.ancre,
        x: ar(p.nx - p.x), y: ar(p.ny - p.y), text: I.nom }));
      iles.appendChild(g);
    }
    carte.appendChild(iles);

    /* LA ROSE, dans l'angle laissé vide par le dernier anneau. Huit
       aires, la fleur de lys au nord : c'est le seul ornement de la
       carte, et il sert — on y lit l'orientation d'un coup. */
    /* LA ROSE SUIT LA FENÊTRE, pas la feuille : glisser le parchemin ne
       doit pas emporter le nord. */
    const rose = sv('g', { class: 'mer-rose',
      transform: 'translate(' + ar(vb.x + 66) + ',' + ar(vb.y + vb.demi * 2 - 70) + ')' });
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, r = k % 2 ? 13 : 25;
      rose.appendChild(sv('polygon', { class: 'mer-rose-branche' + (k === 6 ? ' nord' : ''),
        points: [ar(Math.cos(a) * r) + ',' + ar(Math.sin(a) * r),
                 ar(Math.cos(a + 0.30) * 5) + ',' + ar(Math.sin(a + 0.30) * 5),
                 ar(Math.cos(a - 0.30) * 5) + ',' + ar(Math.sin(a - 0.30) * 5)].join(' ') }));
    }
    rose.appendChild(sv('circle', { class: 'mer-rose-moyeu', r: 3.2 }));
    rose.appendChild(sv('text', { class: 'mer-rose-n', x: 0, y: -30, text: 'N' }));
    carte.appendChild(rose);

    /* L'ÉCHELLE. Une carte sans échelle oblige à compter les anneaux ;
       avec elle, on mesure une distance à l'œil. Dans la couronne, les
       quarante cercles étiquetés SONT l'échelle : un trait de plus ne
       mesurerait rien, leurs pas n'étant pas égaux. */
    if (t !== 'local') {
      const eL = CARTE.anneau * CARTE.pas;
      const ex = vb.x + vb.demi * 2 - 40 - eL, ey = vb.y + vb.demi * 2 - 34;
      carte.appendChild(sv('g', { class: 'mer-echelle' },
        sv('line', { x1: ar(ex), y1: ey, x2: ar(ex + eL), y2: ey }),
        sv('line', { x1: ar(ex), y1: ey - 4, x2: ar(ex), y2: ey + 4 }),
        sv('line', { x1: ar(ex + eL), y1: ey - 4, x2: ar(ex + eL), y2: ey + 4 }),
        sv('text', { class: 'mer-echelle-nom', x: ar(ex + eL / 2), y: ey - 8,
          'text-anchor': 'middle', text: CARTE.anneau + ' ' + CARTE.unite })));
    }

    CARTE = memoire;
    return carte;
  }

  /* LA FICHE, à côté de la carte. Tant qu'aucune île n'est choisie, elle
     sert de légende : c'est le meilleur endroit pour apprendre à lire la
     carte, puisque c'est là qu'on regarde ensuite. */
  function ficheMer(choisi, nav, o) {
    const boite = el('div', { class: 'mer-fiche' });
    if (!choisi) {
      boite.appendChild(el('div', { class: 'mer-fiche-carte mer-fiche-accueil' },
        el('div', { class: 'mer-fiche-accueil-visuel' },
          el('img', { src: 'img/iles/ile-bourg-tour-sombre.png', alt: 'Votre île et la Tour sombre' })),
        el('div', { class: 'mer-fiche-accueil-corps' },
          el('div', { class: 'mer-fiche-sur', text: 'VOTRE PORT D’ATTACHE' }),
          el('div', { class: 'mer-fiche-grand-titre', text: 'Choisissez une destination' }),
          el('div', { class: 'mer-fiche-aide' },
            el('span', { text: '1' }), el('p', { text: 'Cliquez une île pour étudier sa garnison et son butin.' })),
          el('div', { class: 'mer-fiche-aide' },
            el('span', { text: '2' }), el('p', { text: 'Chargez la cale, puis appareillez depuis sa fiche.' })),
          el('div', { class: 'mer-fiche-gestes', text: 'Glisser pour naviguer · molette pour zoomer' }))));
      return boite;
    }
    const P = window.Port;
    const prise = P.estPrise(choisi.id);
    const duree = window.IleUtil.traversee(choisi.lieues, nav ? nav.palier : 0);
    const v = nav ? P.peutAppareiller(nav.id, choisi.id) : { ok: false, pourquoi: '' };
    const box = el('div', { class: 'cadre mer-fiche-carte' + (prise ? ' actif' : ''),
      /* SANS CLE, LA RÉCONCILIATION GARDE LA PREMIÈRE FICHE : le morphage
         ne remplace pas un cadre dont le jumeau a la même tête. La cle
         porte l'île — changer d'île, c'est changer de noeud. */
      'data-cle': 'fiche-' + choisi.id });
    /* L'ILLUSTRATION D'ABORD : c'est elle qu'on a cliquée sur la carte,
       c'est elle qu'on veut reconnaître ici. */
    const illu = window.IleUtil && window.IleUtil.imagePour ? window.IleUtil.imagePour(choisi) : choisi.image;
    if (illu) box.appendChild(el('div', { class: 'mer-fiche-hero' },
      el('img', { class: 'mer-fiche-illu', src: illu, alt: choisi.nom }),
      prise ? el('span', { class: 'mer-fiche-pris', text: 'SÉCURISÉE' }) : null));
    box.appendChild(el('div', { class: 'rangee entre', style: 'margin-top:8px' },
        el('span', { class: 'tt', style: 'font-size:14px', text: choisi.nom }),
        prise ? el('span', { class: 'eti-or', text: 'déjà prise' }) : null));
    box.appendChild(el('div', { class: 'eti', style: 'margin-top:4px',
      text: (choisi.tier ? 'tier ' + choisi.tier + ' · ' : '') + choisi.lieues + ' lieues · ' + U.duree(duree) + ' de mer' }));
    box.appendChild(el('div', { class: 'note', style: 'margin-top:6px', text: choisi.desc }));
    if (choisi.biome) box.appendChild(el('div', { class: 'appel mer-biome biome-' + choisi.biome, style: 'margin-top:8px' },
      el('div', { style: 'flex:1' },
        el('div', { class: 'eti-or', text: choisi.biome.toUpperCase() }),
        el('div', { class: 'note', text: choisi.effetBiome || '' }))));
    /* LA FORCE en dix crans : on la lit sans compter. */
    box.appendChild(el('div', { class: 'rangee entre', style: 'margin-top:8px' },
      el('span', { class: 'eti', text: 'force' }),
      el('div', { class: 'force' },
        ...Array.from({ length: 10 }, (_, i) =>
          el('i', { class: i < choisi.force ? 'on' : '' })))));
    /* AU LARGE, LA NUÉE N'EST PLUS LE SUJET : elle est retombée à zéro
       depuis longtemps quand on arme pour trois cents lieues. Ce qu'on
       y cherche, c'est le butin et l'avantage permanent — on annonce
       donc cela, et non un « −0 point » qui ne veut rien dire. */
    box.appendChild(choisi.menace
      ? el('div', { class: 'rangee entre', style: 'margin-top:6px' },
          el('span', { class: 'eti', text: 'la prendre fait retomber la Nuée de' }),
          el('span', { class: 'eti-or', text: choisi.menace + ' points' }))
      : el('div', { class: 'rangee entre', style: 'margin-top:6px' },
          el('span', { class: 'eti', text: choisi.type === 'ville' ? 'ville côtière' : 'terre du large' }),
          el('span', { class: 'eti-or', text: 'butin et avantage' })));
    /* LE MATÉRIEL DE SIÈGE : le seul péage fixe, et seulement au large. */
    if (Object.keys(choisi.cout || {}).length)
      box.appendChild(el('div', { style: 'margin-top:8px' }, ligneCout(choisi.cout, 'matériel de siège')));
    /* LES VIVRES. On montre la quantité de rations que la traversée
       demande ET ce qui sortira des réserves pour les fournir : le
       joueur doit voir qu'il paie en poisson tant qu'il n'a pas de four,
       et que la tourte lui rendra de la place quand il ira loin. */
    if (nav) {
      const rav = window.Port.ravitaillement(nav.id, choisi.id);
      if (rav) {
        box.appendChild(el('div', { class: 'rangee entre', style: 'margin-top:8px' },
          el('span', { class: 'eti', text: 'vivres pour la traversée' }),
          el('span', { class: rav.manque > 0 ? 'eti-corail' : 'eti-or',
            text: rav.rations + ' rations' })));
        if (rav.manque > 0)
          box.appendChild(el('div', { class: 'note', style: 'margin-top:4px',
            text: 'Il en manque ' + rav.manque + '. Toute nourriture fait ration : '
                + 'le poisson au plus court, la tourte pour le large.' }));
        else
          box.appendChild(U.listeRes(rav.cout, {}));
      }
    }
    box.appendChild(el('div', { class: 'eti', style: 'margin-top:8px', text: 'butin' }));
    box.appendChild(U.listeRes(choisi.butin, { gain: true }));
    if (nav) {
      box.appendChild(el('div', { class: 'eti', style: 'margin-top:12px',
        text: v.ok ? 'prêt à appareiller' : v.pourquoi }));
      box.appendChild(el('button', { class: 'b primaire pleine mer-appareiller', style: 'margin-top:6px',
        text: 'Appareiller', disabled: !v.ok,
        onclick: () => { const r = P.appareiller(nav.id, choisi.id);
          if (r.ok) { if (o.apresDepart) o.apresDepart(); U.dire('Le navire appareille.', 'bien'); }
          else U.dire(r.pourquoi, 'alerte'); } }));
    } else {
      box.appendChild(el('div', { class: 'note', style: 'margin-top:12px',
        text: 'On n\'y va qu\'en navire : chargez une cale depuis La flotte.' }));
    }
    boite.appendChild(box);
    return boite;
  }

  /* L'île retenue vit hors du rendu, sinon elle disparaîtrait au premier
     rafraîchissement — il y en a cinq par seconde. Une entrée par carte
     ouverte : celle du port et celle d'un navire ne se marchent pas
     dessus. */
  const choixIle = {};
  /* Le théâtre regardé, par carte ouverte. Il ne vit pas non plus dans
     le rendu : on ne veut pas retomber sur la couronne à chaque
     rafraîchissement quand on est en train de lire le Grand Large. */
  const theatreVu = {};
  const vueMer = {};
  const glisseMer = {};

  /* ==================================================================
     LE FLANC DU PORT

     Le port n'a plus de fenêtre à lui. Le cliquer ouvre LA CARTE, et
     tout ce qu'on faisait dans sa fenêtre — armer, charger, agrandir,
     placer des postes, monter le chantier naval — se fait maintenant
     dans cette colonne, à gauche de la mer.

     C'est le bon endroit : on arme un navire POUR une destination, et
     l'on choisit une destination EN FONCTION de ce qu'on peut armer.
     Les séparer en deux fenêtres obligeait à faire l'aller-retour de
     mémoire.
     ================================================================== */
  const ongletFlanc = {};          // l'onglet ouvert, par carte
  const navireCaleFlanc = {};      // le navire que ce flanc est en train de charger
  function panneauxDuPort(bid, cle, rafraichir) {
    /* La carte n'est pas la fiche technique du bâtiment. Postes, niveau,
       améliorations, outillage et notice restent accessibles en cliquant
       le port sur l'île ; ici on ne garde que ce qui sert à partir. */
    const pans = [
      { id:'flotte', nom:'Flotte', rendu:c => rendreFlotte(c, cle, rafraichir) },
      { id:'chantier', nom:'Chantier', rendu:c => rendreChantier(c) },
    ];
    const navId = navireCaleFlanc[cle];
    const nav = navId && window.Port.navire(navId);
    if (nav && nav.etat === 'quai') pans.splice(1, 0, {
      id:'cale', nom:'Cale', rendu:c => rendreContenuCale(c, nav.id, {
        rafraichir,
        finTexte:'Chargement terminé',
        fin:() => { ongletFlanc[cle]='flotte'; if (rafraichir) rafraichir(); },
      })
    });
    return pans;
  }
  function flancDuPort(cle, rafraichir) {
    const E2 = window.Etat.E;
    const bid = Object.keys(E2.bat).find(k => E2.bat[k].type === 'port');
    if (!bid) return null;
    const pans = panneauxDuPort(bid, cle, rafraichir);
    const actif = pans.find(x => x.id === ongletFlanc[cle]) || pans[0];
    /* LE MÊME BANDEAU QUE PARTOUT AILLEURS. J'avais invente des pastilles
       a moi : un deuxieme langage d'onglets dans un jeu qui en a deja un,
       c'est-a-dire un jeu qui ne parle plus d'une seule voix. On reprend
       `fen-onglets`, la classe que `ui-noyau` pose sur toutes les
       fenetres — meme graisse, meme casse, meme trait corail sous
       l'onglet ouvert. */
    const P = window.Port;
    const rayon = P.rayon ? Math.min(10, P.rayon()) : 1;
    const prises = P.prisesCouronne ? P.prisesCouronne(rayon) : 0;
    const elargir = P.peutElargirRayon ? P.peutElargirRayon() : { ok: false, pourquoi: '' };
    const entete = el('div', { class: 'port-flanc-entete' },
      el('div', { class: 'port-flanc-marque' },
        el('span', { class: 'port-flanc-ancre', text: '⚓' }),
        el('div', {},
          el('div', { class: 'port-flanc-sur', text: 'PORT DU BOURG' }),
          el('div', { class: 'port-flanc-titre', text: 'Préparer la traversée' }))),
      el('div', { class: 'port-flanc-chiffres' },
        el('div', {}, el('b', { text: P.navires().length + ' / ' + P.quaisMax() }), el('span', { text: 'navires' })),
        el('div', {}, el('b', { text: P.portee() }), el('span', { text: 'lieues' })),
        el('div', {}, el('b', { text: 'T' + rayon }), el('span', { text: 'rayon' }))),
      el('div', { class: 'port-rayon' },
        el('div', { class: 'port-rayon-ligne' },
          el('span', { text: 'Couronne actuelle' }), el('b', { text: prises + ' / 10' })),
        el('div', { class: 'port-rayon-barre' },
          el('i', { style: 'width:' + Math.min(100, prises * 10) + '%' }))),
      el('button', { class: 'b port-rayon-action',
        text: rayon >= 10 ? 'Ouvrir le Grand Large' : 'Élargir le rayon',
        disabled: !elargir.ok, title: elargir.ok ? 'Découvrir la couronne suivante.' : elargir.pourquoi,
        onclick: () => {
          const r = P.elargirRayon();
          U.dire(r.ok ? (r.rayon > 10 ? 'Le Grand Large est cartographié.' : 'Nouveau rayon découvert.') : r.pourquoi,
            r.ok ? 'butin' : 'alerte');
          choixIle[cle] = null; if (rafraichir) rafraichir();
        } }));
    const barre = el('div', { class: 'fen-onglets port-flanc-onglets' },
      ...pans.map(x => el('button', {
        class: (x.id === actif.id ? 'on' : ''), text: x.nom,
        onclick: () => { ongletFlanc[cle] = x.id; if (rafraichir) rafraichir(); } })));
    const corps = el('div', { class: 'flanc-corps' });
    try { actif.rendu(corps); } catch (e) { /* un panneau qui casse ne doit pas emporter la carte */ }
    return el('div', { class: 'carte-flanc' }, entete, barre, corps);
  }

  function rendreCarteMer(c, o) {
    const P = window.Port;
    if (!P) return;
    /* SANS NAVIRE DÉSIGNÉ, LE PREMIER À QUAI FAIT L'AFFAIRE : c'est lui
       qui prendrait le cap — et la fiche de droite peut alors offrir le
       bouton « Appareiller » dès qu'une île est choisie et la cale prête. */
    const nav = o.navId ? P.navire(o.navId)
      : (P.navires().find(n => n.etat === 'quai') || null);
    if (o.navId && !nav) return;
    const choisi = choixIle[o.cle] ? window.IleUtil.parId(choixIle[o.cle]) : null;
    /* LE GRAND LARGE NE S'AFFICHE QUE QUAND IL EXISTE. Tant que la
       couronne n'est pas prise, un second onglet ne montrerait qu'une
       carte vide et des distances inatteignables. */
    const ouvert = window.IleUtil.largeOuvert && window.IleUtil.largeOuvert();
    const t = (ouvert && theatreVu[o.cle] === 'large') ? 'large' : 'local';

    /* Le clic est pris ICI, pas sur chaque île : `el` est le seul à
       greffer des gestionnaires que la réconciliation sait rafraîchir,
       et il ne fabrique pas de SVG. Le relais lit `data-ile` sur ce qui
       a été touché. `tabindex` déclaré à la main écarte le rôle de
       bouton que `el` poserait sinon sur toute la carte. */
    let modesMer = null;
    if (ouvert) {
      const onglet = (id, nom, sous) => el('button', {
        class: 'mer-mode' + (t === id ? ' on' : ''), text: nom, title: sous,
        onclick: () => { theatreVu[o.cle] = id; choixIle[o.cle] = null;
                         if (o.rafraichir) o.rafraichir(); } });
      modesMer = el('div', { class: 'mer-modes', onpointerdown: ev => ev.stopPropagation() },
        onglet('local', 'Les eaux du bourg', 'La couronne actuellement cartographiée.'),
        onglet('large', 'Le Grand Large', 'Ce qui commence là où la couronne finit.'));
    }
    /* LA FENÊTRE SUR LA FEUILLE. Le parchemin est immense, la fenêtre
       carrée et SANS ASCENSEUR : c'est la `viewBox` qu'on déplace à la
       souris, bridée au dernier tier découvert. Au tier 1, la fenêtre
       tient exactement sur la première couronne — rien ne bouge. */
    const rayonCarte = (t === 'local' && P.rayon) ? Math.max(1, Math.min(10, P.rayon())) : 1;
    const cadre = cadreMer(t, rayonCarte);
    let vue = vueMer[o.cle];
    if (!vue || vue.t !== t || vue.demi == null)
      vue = vueMer[o.cle] = { t, demi: cadre.defDemi,
        x: CARTES[t].cx - cadre.defDemi, y: CARTES[t].cy - cadre.defDemi };
    vue.demi = bride(vue.demi, cadre.minDemi, cadre.maxDemi);
    /* LA VUE NE QUITTE JAMAIS LA MER OUVERTE : quel que soit le zoom,
       les bords restent dans le tier découvert. */
    const bx0 = CARTES[t].cx - cadre.maxDemi, by0 = CARTES[t].cy - cadre.maxDemi;
    const bx1 = () => CARTES[t].cx + cadre.maxDemi - 2 * vue.demi;
    const by1 = () => CARTES[t].cy + cadre.maxDemi - 2 * vue.demi;
    vue.x = bride(vue.x, bx0, bx1());
    vue.y = bride(vue.y, by0, by1());
    const poserVue = n => { if (n) n.setAttribute('viewBox',
      ar(vue.x) + ' ' + ar(vue.y) + ' ' + ar(vue.demi * 2) + ' ' + ar(vue.demi * 2)); };
    let drag = null;
    const toile = el('div', { class: 'mer-toile', tabindex: '-1',
      onpointerdown: ev => {
        if (ev.button !== 0) return;
        drag = { x: ev.clientX, y: ev.clientY, vx: vue.x, vy: vue.y, bouge: false };
      },
      onpointermove: ev => {
        if (!drag) return;
        const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        /* LA CAPTURE N'ARRIVE QU'AVEC LA GLISSE. Capturer dès
           pointerdown retirait le CLIC à l'île visée : l'événement
           remontait sur la toile et la sélection ne se faisait
           jamais. */
        if (!drag.bouge && Math.abs(dx) + Math.abs(dy) > 5) {
          drag.bouge = true;
          try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) { }
        }
        if (!drag.bouge) return;
        const k = (2 * vue.demi) / Math.max(1, ev.currentTarget.clientWidth);
        vue.x = bride(drag.vx - dx * k, bx0, bx1());
        vue.y = bride(drag.vy - dy * k, by0, by1());
        poserVue(ev.currentTarget.querySelector('svg'));
      },
      onpointerup: ev => {
        if (drag && drag.bouge) glisseMer[o.cle] = performance.now();
        drag = null;
        if (ev.currentTarget.hasPointerCapture(ev.pointerId)) ev.currentTarget.releasePointerCapture(ev.pointerId);
      },
      /* LA MOLETTE ZOOME : près du premier cercle les îles sont
         grandes, dézoomé le tier entier tient dans la fenêtre. Le
         point sous le curseur ne bouge pas. */
      onwheel: ev => {
        if (cadre.minDemi >= cadre.maxDemi) return;
        ev.preventDefault();
        const rect = ev.currentTarget.getBoundingClientRect();
        const fx = (ev.clientX - rect.left) / Math.max(1, rect.width);
        const fy = (ev.clientY - rect.top) / Math.max(1, rect.height);
        const wx = vue.x + fx * 2 * vue.demi, wy = vue.y + fy * 2 * vue.demi;
        vue.demi = bride(vue.demi * (ev.deltaY > 0 ? 1.18 : 1 / 1.18),
                         cadre.minDemi, cadre.maxDemi);
        vue.x = bride(wx - fx * 2 * vue.demi, bx0, bx1());
        vue.y = bride(wy - fy * 2 * vue.demi, by0, by1());
        poserVue(ev.currentTarget.querySelector('svg'));
      },
      onclick: ev => {
      if (glisseMer[o.cle] && performance.now() - glisseMer[o.cle] < 180) return;
      const cible = ev.target && ev.target.closest ? ev.target.closest('[data-ile]') : null;
      if (!cible) return;
      const id = cible.getAttribute('data-ile');
      choixIle[o.cle] = choixIle[o.cle] === id ? null : id;
      if (o.rafraichir) o.rafraichir();
    } });
    toile.appendChild(dessinerMer(nav, choisi, t, { x: vue.x, y: vue.y, demi: vue.demi }));
    if (modesMer) toile.appendChild(modesMer);
    /* TROIS COLONNES en pleine page : les commandes du port à gauche, la
       mer au milieu, la terre choisie à droite. Dans une fenêtre ordinaire
       — l'onglet « Les îles » d'un autre écran — on garde les deux
       colonnes d'origine : il n'y a pas la place, et le flanc ferait
       doublon avec les onglets de la fenêtre elle-même. */
    const flanc = o.avecFlanc ? flancDuPort(o.cle, o.rafraichir) : null;
    c.appendChild(el('div', { class: 'carte-mer' + (flanc ? ' a-flanc' : '') },
      flanc, toile, ficheMer(choisi, nav, o)));
  }

  /* LA CARTE PREND TOUT L'ÉCRAN. Une fenêtre flottante, même grande,
     reste une fenêtre posée sur le village ; une carte, elle, veut une
     table entière. On l'ouvre par-dessus tout — feuille à gauche, fiche
     à droite — et on la ferme d'une croix ou d'Échap. */
  let pleineNoeud = null, pleineCorps = null, pleineTitre = null, pleineSous = null;
  let pleineOuvert = false, pleineOpts = null;
  function rafraichirPleine() {
    if (!pleineCorps || !pleineOpts) return;
    U.vide(pleineCorps);
    rendreCarteMer(pleineCorps, {
      cle: pleineOpts.cle, navId: pleineOpts.navId, avecFlanc: true,
      rafraichir: rafraichirPleine, apresDepart: pleineOpts.apresDepart,
    });
  }
  function fermerCarteMarine() {
    pleineOuvert = false;
    if (pleineNoeud) pleineNoeud.classList.remove('vu');
  }
  function ouvrirCarteMarine(navId, apresDepart) {
    if (!pleineNoeud) {
      pleineTitre = el('h2', { text: '' });
      pleineSous = el('div', { class: 'sous', text: '' });
      pleineCorps = el('div', { class: 'carte-pleine-corps' });
      pleineNoeud = el('div', { class: 'carte-pleine' },
        el('div', { class: 'carte-pleine-tete' },
          el('div', { class: 'ti' }, pleineTitre, pleineSous),
          el('button', { class: 'fen-x', title: 'Fermer (Échap)', text: '×',
            onclick: () => fermerCarteMarine() })),
        pleineCorps);
      document.body.appendChild(pleineNoeud);
      /* Échap ferme la carte AVANT que le noyau n'entende la touche et
         ne referme aussi une fenêtre qui n'y était pour rien. */
      addEventListener('keydown', ev => {
        if (ev.key === 'Escape' && pleineOuvert) {
          ev.stopImmediatePropagation();
          fermerCarteMarine();
        }
      }, true);
    }
    pleineOpts = { cle: navId ? 'dest:' + navId : 'carte', navId: navId || null,
                   apresDepart: apresDepart || null };
    pleineTitre.textContent = navId ? 'Où met-on le cap ?' : 'La carte marine';
    pleineSous.textContent = navId ? 'Carte des eaux du bourg'
                                   : 'Les eaux du bourg et le Grand Large';
    pleineOuvert = true;
    pleineNoeud.classList.add('vu');
    rafraichirPleine();
  }

  /* LE CHOIX DE L'ÎLE, quand un navire attend un cap : le même plein
     écran, avec le bouton « Appareiller » dans la fiche. */
  function ouvrirDestination(navId) {
    choixIle['dest:' + navId] = null;
    ouvrirCarteMarine(navId, () => fermerCarteMarine());
  }

  /* POUSSER PLUS LOIN. Les distances se comptent depuis l'île où l'on
     est, pas depuis le port : enchaîner deux îles voisines coûte deux
     lieues, pas vingt. C'est l'intérêt de ne pas rentrer — et le
     risque, puisqu'on repart avec ce qui a survécu. */
  function ouvrirSuite(navId) {
    U.ouvrir('suite', {
      titre: 'Pousser plus loin', sous: 'Sans repasser par le bourg', classe: 'large',
      onglets: [{ id: 's', nom: 'Cap suivant', rendu: c => {
        const P = window.Port, n = P.navire(navId);
        if (!n) return;
        const ici = window.IleUtil.parId(n.ile);
        c.appendChild(el('div', { class: 'note',
          text: 'Le navire mouille devant ' + (ici ? ici.nom : '—') + ' avec '
              + P.placesPrises(n.cargo) + ' unités encore debout. Les distances se comptent '
              + 'depuis ici : une île voisine est à deux pas, et l\'on ne repasse pas par le port.' }));
        c.appendChild(el('div', { class: 'rangee enroule', style: 'margin-top:8px' },
          ...n.cargo.map(x => el('span', { class: 'puce mini',
            text: x.n + ' × ' + nomUnite(x.type) }))));
        /* ON POUSSE DANS SON PROPRE THÉÂTRE. Un navire qui mouille
           devant une ville du Grand Large n'a rien à faire de la liste
           des douze îles du bourg — elles sont à trois cents lieues
           derrière lui. On lui propose ses voisines, pas ses souvenirs. */
        const voisines = (ici && ici.large) ? (window.LARGE || [])
          : (window.IleUtil && window.IleUtil.visibles ? window.IleUtil.visibles() : window.ILES);
        for (const ile of voisines) {
          if (ile.id === n.ile) continue;
          const v = P.peutContinuer(n.id, ile.id);
          const lieues = P.ecart(n.ile, ile.id);
          const duree = window.IleUtil.traversee(lieues, n.palier);
          c.appendChild(el('div', { class: 'cadre' },
            el('div', { class: 'rangee entre' },
              el('span', { class: 'tt', style: 'font-size:14px', text: ile.nom }),
              el('span', { class: 'eti', text: lieues + ' lieues d\'ici · ' + U.duree(duree) })),
            el('div', { class: 'rangee entre', style: 'margin-top:6px' },
              el('span', { class: 'eti', text: 'force' }),
              el('div', { class: 'force' },
                ...Array.from({ length: 10 }, (_, i) =>
                  el('i', { class: i < ile.force ? 'on' : '' })))),
            el('div', { class: 'rangee entre', style: 'margin-top:8px' },
              el('span', { class: 'eti', text: v.ok ? '−' + ile.menace + ' de Nuée' : v.pourquoi }),
              el('button', { class: 'b primaire', text: 'Mettre le cap', disabled: !v.ok,
                onclick: () => { const r = P.continuer(n.id, ile.id);
                  if (r.ok) { U.fermer('suite'); U.dire('Le navire ne rentre pas.', 'bien'); }
                  else U.dire(r.pourquoi, 'alerte'); } }))));
        }
      } }],
    });
  }

  /* LA CARTE A SA TABLE. L'onglet du port ne porte plus la carte elle-
     même — il en garde l'invitation, et c'est le plein écran qui la
     déroule, plus grand et plus lisible. */
  function rendreIles(c, F) {
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'eti-or', text: 'LA CARTE MARINE' }),
      el('div', { class: 'note', style: 'margin-top:6px',
        text: "Le bourg est au centre, chaque anneau révèle un nouveau tier. "
            + "On y lit d'un coup d'œil ce qui est à portée de matinée et ce qui "
            + "demande une flotte — et l'on n'y lance rien sans avoir chargé une cale." }),
      el('button', { class: 'b primaire pleine', style: 'margin-top:12px',
        text: 'Dérouler la carte marine', onclick: () => ouvrirCarteMarine() })));
  }

  function rendreNotice(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    const def = window.BAT[b.type];
    c.appendChild(el('div', { class: 'note', text: def.desc }));
    c.appendChild(el('div', { class: 'sep' }));
    const dispo = window.BatUtil.recettesDe(b.type, b.niv, b);
    const toutes = def.recettes || [];
    if (toutes.length) {
      c.appendChild(el('div', { class: 'eti-or', text: 'ce qu\'on y fait' }));
      for (const rid of toutes) {
        const r = window.REC[rid];
        const ok = dispo.includes(rid);
        c.appendChild(el('div', { class: 'cadre' + (ok ? '' : ' mort') },
          el('div', { class: 'rangee entre' },
            el('span', { class: 'tt', text: r.nom }),
            el('span', { class: 'eti', text: ok ? U.duree(r.duree) : 'niveau ' + r.niv })),
          el('div', { class: 'note', style: 'margin-top:4px', text: r.desc })));
      }
    }
    c.appendChild(el('div', { class: 'sep' }));
    c.appendChild(el('div', { class: 'rangee entre' },
      el('span', { class: 'eti', text: 'expérience de l\'édifice' }),
      el('span', { class: 'eti-or', text: U.fmt(b.xp || 0) })));
  }

  /* =================================================================
     LE CARNET DU MAÎTRE D'ŒUVRE
     Catalogue, file d'attente, et affectation des bras au chantier.
     ================================================================= */
  let typeAPoser = null;
  let coulAPoser = null;

  function ouvrirChantier(onglet) {
    U.ouvrir('chantier', {
      titre: 'Chantier du bourg', sous: "Maître d'œuvre",
      onglet: onglet || 'batir',
      sousVif: () => {
        const f = E().chantier.file;
        return f.length ? f.length + ' ouvrage' + (f.length > 1 ? 's' : '') + ' en attente'
                        : "Maître d'œuvre · rien en cours";
      },
      onglets: [
        { id: 'batir', nom: 'Bâtir', rendu: rendreCatalogue },
        { id: 'file', nom: 'File', rendu: rendreFile },
        { id: 'bras', nom: 'Ouvriers', rendu: rendreOuvriers },
      ],
    });
  }

  function vignetteBat(type) {
    /* Les planches de bâtiments sont désormais la vignette principale.
       Le dessin métier reste un repli pour les anciennes sauvegardes ou
       les bâtiments ajoutés sans illustration. */
    const def = window.BAT[type];
    const image = window.Img && window.Img.bat ? window.Img.bat(type) : null;
    if (image) return window.Img.vignette(image, 56, def.nom, 'vig-bat');
    const parMetier = {
      recolte: { f: 'epi', c: ['#c9a94e', '#8f7430'] },
      atelier: { f: 'enclume', c: ['#4a4e56', '#7a7e86'] },
      elevage: { f: 'pot', c: ['#e8e4d6', '#b8b2a0', '#8d9199'] },
      stock: { f: 'tonneau', c: ['#8a6a45', '#5a412a'] },
      vie: { f: 'oeuf', c: ['#e8dcc4', '#c4b696'] },
      guerre: { f: 'epee', c: ['#c9cdd2', '#8a8f96'] },
      commerce: { f: 'piece', c: ['#d8b048', '#8a6a2a'] },
      porte: { f: 'etoile', c: ['#8fd8e0', '#4a8f9c'] },
    };
    return U.ico(parMetier[def.cat] || { f: 'cube', c: ['#8a8272'] }, 30);
  }

  function rendreCatalogue(c) {
    const cat = window.Jeu.catalogue();
    if (!cat.length) {
      c.appendChild(el('div', { class: 'vide', text: 'Rien à bâtir pour l\'instant.' }));
      return;
    }
    c.appendChild(el('div', { class: 'note',
      text: 'Choisissez un ouvrage, puis désignez la parcelle dans le village. Les matériaux sont retenus dès la pose ; le chantier n\'avance que si un habitant y travaille.' }));
    const groupes = { recolte: 'Récolte', atelier: 'Ateliers', elevage: 'Élevage',
                      stock: 'Réserves', vie: 'Vie du bourg', commerce: 'Commerce',
                      guerre: 'Guerre', porte: 'Les portes' };
    for (const g in groupes) {
      const l = cat.filter(t => window.BAT[t].cat === g);
      if (!l.length) continue;
      c.appendChild(el('div', { class: 'eti-or', style: 'margin-top:12px', text: groupes[g] }));
      for (const type of l) c.appendChild(carteCatalogue(type));
    }
  }

  function carteCatalogue(type) {
    const def = window.BAT[type];
    const cout = window.Jeu.coutConstruction(type);
    const abordable = window.Etat.assez(cout);
    const dejaUn = window.Etat.batsDeType(type).length;
    const unique = ['port', 'descente', 'chateau', 'moulinEau'].includes(type);
    const bloque = unique && dejaUn > 0;
    const carte = el('div', { class: 'cat-item' + (abordable && !bloque ? '' : ' impossible'),
      onclick: () => { if (bloque) { U.dire('Le bourg n\'en a qu\'un.', 'alerte'); return; }
        if (!abordable) { U.dire('Matériaux insuffisants.', 'alerte'); return; }
        entrerConstruction(type); } },
      el('div', { class: 'vig' }, vignetteBat(type)),
      el('div', { class: 'cc' },
        el('h3', { text: def.nom + (dejaUn ? '  ×' + dejaUn : '') }),
        el('div', { class: 'm', text: def.metier + ' · ' + U.duree(window.BatUtil.tempsNiveau(type, 1)) }),
        U.listeRes(cout, { verifier: true, rien: 'gratuit' }),
        el('div', { class: 'note', style: 'margin-top:4px', text: def.desc })));
    return carte;
  }

  function rendreFile(c) {
    const f = E().chantier.file;
    if (!f.length) {
      c.appendChild(el('div', { class: 'vide', text: 'La file est vide.\nLe maître d\'œuvre fait les cent pas.' }));
      return;
    }
    const v = window.Jeu.vitesseChantier();
    c.appendChild(el('div', { class: 'rangee entre' },
      el('span', { class: 'eti', text: E().chantier.ouvriers.length + ' ouvrier(s) · cadence ×' + v.toFixed(2).replace('.', ',') }),
      el('span', { class: v > 0 ? 'eti-or' : 'eti mauvais', text: v > 0 ? 'en cours' : 'à l\'arrêt' })));
    f.forEach((job, i) => {
      const tete = i === 0;
      const pct = tete ? Math.min(1, E().chantier.prog / job.temps) : 0;
      const reste = tete && v > 0 ? (job.temps - E().chantier.prog) / v : (v > 0 ? job.temps / v : null);
      const j = el('div', { class: 'job' + (tete ? ' tete' : '') },
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { class: 'rangee entre' },
            el('span', { class: 'jn', text: (tete ? '' : (i + 1) + '. ') + job.nom }),
            el('span', { class: 'jr', text: U.duree(reste) })),
          tete ? el('div', { style: 'margin-top:4px' }, U.barre(pct, v > 0 ? '' : 'rouge')) : null),
        el('div', { class: 'fl' },
          el('button', { class: 'b mini', text: '↑', disabled: i === 0, onclick: () => window.Jeu.deplacerOuvrage(i, -1) }),
          el('button', { class: 'b mini', text: '↓', disabled: i === f.length - 1, onclick: () => window.Jeu.deplacerOuvrage(i, 1) }),
          el('button', { class: 'b mini danger', text: '×', title: 'Annuler et récupérer les matériaux',
            onclick: () => { window.Jeu.annulerOuvrage(i); U.dire('Ouvrage annulé, matériaux rendus.'); } })));
      c.appendChild(j);
    });
  }

  function rendreOuvriers(c) {
    const E2 = E();
    c.appendChild(el('div', { class: 'note',
      text: "Le chantier n'avance QUE si des habitants y travaillent. Chaque ouvrier supplémentaire ajoute 85 % de cadence — mais ce sont autant de postes de production laissés vides." }));
    const affectes = E2.chantier.ouvriers.map(id => window.Etat.habitant(id)).filter(Boolean);
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', text: 'Au chantier' }),
        el('span', { class: 'eti-or', text: '×' + window.Jeu.vitesseChantier().toFixed(2).replace('.', ',') })),
      el('div', { class: 'sep' }),
      affectes.length ? el('div', { class: 'colonne' }, affectes.map(h =>
        el('div', { class: 'rangee entre' },
          el('span', { text: h.nom }),
          el('button', { class: 'b mini danger', text: 'Retirer',
            onclick: () => { window.Etat.libererHabitant(h.id); rafraichirVillage(); } }))))
        : el('div', { class: 'note faible', text: 'Personne. Rien ne se bâtit.' })));

    const libres = window.Etat.habitantsLibres();
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', text: 'Disponibles' }),
        el('span', { class: 'eti', text: libres.length + '' })),
      el('div', { class: 'sep' }),
      libres.length ? el('div', { class: 'colonne' }, libres.map(h =>
        el('div', { class: 'rangee entre' },
          el('span', { text: h.nom }),
          el('button', { class: 'b mini primaire', text: 'Au chantier',
            onclick: () => { window.Etat.affecterChantier(h.id); rafraichirVillage(); } }))))
        : el('div', { class: 'note faible', text: 'Aucun habitant libre. Libérez un poste, ou faites naître du monde à la nurserie.' })));
  }

  /* =================================================================
     MODE CONSTRUCTION
     ================================================================= */
  function entrerConstruction(type, opts) {
    typeAPoser = type;
    coulAPoser = opts && opts.coul != null ? opts.coul : null;
    window.Village.modeConstruction(type);
    const b = document.getElementById('barre-cons');
    b.classList.add('vu');
    U.vide(b);
    b.appendChild(el('span', { class: 'q' }, 'Désignez la parcelle pour ', el('b', { text: window.BAT[type].nom })));
    const cat = window.BAT[type].cat;
    b.appendChild(el('span', { class: 'eti', text:
      (cat === 'recolte' || cat === 'elevage')
        ? 'parcelle au sol uniquement'
        : 'cliquez un toit pour empiler' }));
    b.appendChild(el('button', { class: 'b', text: 'Annuler', onclick: quitterConstruction }));
    U.fermer('chantier');
  }
  function quitterConstruction() {
    typeAPoser = null;
    if (window.Village) window.Village.modeConstruction(null);
    document.getElementById('barre-cons').classList.remove('vu');
  }
  function poserIci(pos) {
    if (!typeAPoser) return;
    const t = typeAPoser;
    const r = window.Jeu.poserBatiment(t, pos.x, pos.r, {
      coul: coulAPoser, niveau: Math.max(0, pos.y | 0),
    });
    if (!r.ok) { U.dire(r.raison, 'alerte'); return; }
    U.dire(window.BAT[t].nom + ' : chantier ouvert.', 'bien');
    quitterConstruction();
    ouvrirChantier('file');
  }

  /* =================================================================
     LES RÉSERVES
     ================================================================= */
  function ouvrirReserves(catInit) {
    U.ouvrir('reserves', {
      titre: 'Réserves du bourg', sous: 'Ce que le bourg possède', classe: 'large',
      onglet: catInit,
      onglets: () => {
        /* Huit catégories dont six vides au premier jour. On ne montre
           que celles dont quelque chose est DÉJÀ passé par le bourg —
           et l'on garde celle qu'on regarde, pour ne pas la voir
           disparaître sous les doigts. */
        const vue = cat => {
          if (cat.id === catInit) return true;
          for (const id in window.RES)
            if (window.RES[id].cat === cat.id &&
                (E().vus['res:' + id] || window.Etat.qte(id) > 0)) return true;
          return false;
        };
        const l = Object.values(window.CAT_RES).sort((a, b) => a.ordre - b.ordre)
          .filter(vue)
          .map(cat => ({ id: cat.id, nom: cat.nom, rendu: c => rendreCategorie(c, cat) }));
        /* le marché n'a de sens qu'une fois qu'on a de quoi vendre */
        if (window.Etat.aBatiment('halle') || window.Etat.qte('ecu') > 0 || E().vus['ui:marche']) {
          E().vus['ui:marche'] = true;
          l.push({ id: 'marche', nom: 'Marché', rendu: rendreMarche });
        }
        return l.length ? l : [{ id: 'vivres', nom: 'Vivres',
          rendu: c => rendreCategorie(c, window.CAT_RES.vivres) }];
      },
    });
  }

  /* LA CASE D'UNE RESSOURCE.

     C'était une ligne : icône, nom, sous-titre, quantité, débit. Cinq
     informations par ressource, quatre-vingt-dix-huit ressources — une
     colonne illisible où l'on ne trouvait jamais ce qu'on cherchait.

     C'est maintenant une CASE : l'image, et le nombre. Le reste — le
     nom, ce qu'elle vaut, ce qui entre et sort, dans combien de temps
     elle déborde — attend dans l'infobulle, à portée de souris. On
     reconnaît un stock d'un coup d'œil ; on ne le LIT que si l'on
     doute. */
  function caseRes(id, cap) {
    const r = window.RES[id], q = window.Etat.qte(id);
    const d = window.Marche ? window.Marche.debit(id) : 0;
    const h = window.Marche ? window.Marche.horizon(id) : null;
    const plein = cap && cap < 9000 && q >= cap;
    const parMin = d * 60;

    const bulle = [r.nom, r.desc, ''];
    bulle.push('en réserve : ' + U.fmt(q) + (cap && cap < 9000 ? ' / ' + U.fmt(cap) : ''));
    if (Math.abs(parMin) >= 0.05)
      bulle.push('débit : ' + (parMin > 0 ? '+' : '') +
                 (Math.round(parMin * 10) / 10).toString().replace('.', ',') + ' /min');
    if (h && h.t > 0 && h.t < 36000)
      bulle.push((h.plein ? 'au plafond dans ' : 'épuisée dans ') + U.duree(h.t));
    else if (plein) bulle.push('AU PLAFOND — ce qui entre est perdu');
    if (r.val) bulle.push('valeur : ' + U.fmt(r.val) + ' écus');

    const suivie = !!(window.UIDock && window.UIDock.estSuivie(id));
    const cls = 'case-res' + (plein ? ' plein' : '')
              + (d > 0.002 ? ' monte' : (d < -0.002 ? ' baisse' : ''))
              + (q <= 0 ? ' zero' : '') + (suivie ? ' suivie' : '');
    const suivi = el('button', { class: 'case-suivre' + (suivie ? ' on' : ''),
      title: suivie ? 'Retirer du bandeau' : 'Suivre dans le bandeau',
      'aria-label': (suivie ? 'Ne plus suivre ' : 'Suivre ') + r.nom,
      text: suivie ? '★' : '☆',
      onclick: ev => {
        ev.stopPropagation();
        const on = window.UIDock.basculerSuivi(id);
        suivi.classList.toggle('on', on);
        suivi.textContent = on ? '★' : '☆';
        suivi.title = on ? 'Retirer du bandeau' : 'Suivre dans le bandeau';
        suivi.parentNode.classList.toggle('suivie', on);
      } });
    return el('div', { class: cls, title: bulle.filter(x => x !== null).join('\n') },
      suivi,
      el('div', { class: 'im' }, U.icoRes(id, 40)),
      el('span', { class: 'q', text: U.fmt(q) }),
      el('span', { class: 'nm', text: r.nom }));
  }

  function rendreCategorie(c, cat) {
    const cap = window.Etat.plafonds()[cat.id];
    const ids = window.RES_ORDRE.filter(id => window.RES[id].cat === cat.id);
    const connus = ids.filter(id => E().vus['res:' + id] || window.Etat.qte(id) > 0);
    if (cap && cap < 9000) {
      const total = connus.reduce((s, id) => s + window.Etat.qte(id), 0);
      const pleins = connus.filter(id => window.Etat.qte(id) >= cap).length;
      c.appendChild(U.stats([
        ['en réserve', U.fmt(total)],
        ['plafond', U.fmt(cap)],
        ['au plafond', pleins, pleins ? 'mauvais' : 'bon'],
      ]));
      const bStock = cat.batStock;
      if (bStock && !window.Etat.aBatiment(bStock))
        c.appendChild(el('div', { class: 'note mauvais',
          text: 'Le bourg n\'a pas de ' + window.BAT[bStock].nom.toLowerCase() + ' : tout ce qui dépasse le plafond est perdu.' }));
    }
    if (!connus.length) {
      /* Un vide n'est pas une erreur, c'est une étape. On dit d'où
         viendra la première au lieu de constater l'absence — et l'on
         laisse de quoi y aller. */
      const v = el('div', { class: 'vide' },
        el('div', { text: 'Rien de cette sorte n\'est encore passé par le bourg.' }));
      const bStock = cat.batStock;
      if (bStock && !window.Etat.aBatiment(bStock))
        v.appendChild(el('div', { class: 'note', style: 'margin-top:8px',
          text: 'Il faudra de toute façon ' + window.BAT[bStock].nom.toLowerCase()
              + ' pour en garder plus que la poignée du départ.' }));
      v.appendChild(el('button', { class: 'b', style: 'margin-top:12px',
        text: 'Que bâtir ?',
        onclick: () => { U.fermer('reserves'); window.UIFen.ouvrirChantier(); } }));
      c.appendChild(v);
      return;
    }
    /* les ressources qui débordent d'abord, puis celles qui montent */
    const tri = connus.slice().sort((a, b) => {
      const da = window.Marche ? window.Marche.debit(a) : 0, db = window.Marche ? window.Marche.debit(b) : 0;
      const pa = (cap && window.Etat.qte(a) >= cap) ? 1 : 0, pb = (cap && window.Etat.qte(b) >= cap) ? 1 : 0;
      return (pb - pa) || (db - da) || (window.Etat.qte(b) - window.Etat.qte(a));
    });
    c.appendChild(el('div', { class: 'suivi-aide', text: '☆ Cliquez pour afficher une ressource dans le bandeau.' }));
    const grille = el('div', { class: 'quadrillage-res' });
    for (const id of tri) grille.appendChild(caseRes(id, cap));
    c.appendChild(grille);
    const gasp = Object.keys(E().gaspille).filter(id => window.RES[id] && window.RES[id].cat === cat.id && E().gaspille[id] > 0);
    if (gasp.length) {
      c.appendChild(U.section('Perdu faute de place'));
      c.appendChild(U.listeRes(gasp.reduce((o, id) => (o[id] = Math.round(E().gaspille[id]), o), {})));
      if (!window.Auto.acquis('vente'))
        c.appendChild(el('div', { class: 'note',
          text: 'Le facteur de commerce, une fois engagé, rachèterait tout cela au lieu de le laisser perdre.' }));
    }
  }

  /* ------------------------------------------------------------------
     LE MARCHÉ. Le cours dérive chaque jour : on ne peut pas acheter
     n'importe quand sans regarder le tableau.
     ------------------------------------------------------------------ */
  let marcheCat = 'vivres';
  function rendreMarche(c) {
    const M = window.Marche;
    const vend = M.ouvertVente(), ach = M.ouvertAchat();
    c.appendChild(U.stats([
      ['écus', U.fmt(window.Etat.qte('ecu')), 'bon'],
      ['vente', vend ? 'ouverte' : 'fermée', vend ? 'bon' : 'mauvais'],
      ['achat', ach ? 'ouvert' : 'fermé', ach ? 'bon' : 'mauvais'],
      ['négoce', '+' + Math.round(window.Jeu.bonusNegoce() * 100) + ' %'],
    ]));
    if (!vend) c.appendChild(el('div', { class: 'note mauvais',
      text: 'Il faut une taverne pour que le colporteur s\'arrête, et une halle pour qu\'il apporte de la marchandise.' }));
    c.appendChild(el('div', { class: 'note',
      text: 'Le cours change chaque jour, entre les deux tiers et une fois et demie la valeur. Vendre au bon moment double la recette.' }));
    c.appendChild(U.segments(
      Object.values(window.CAT_RES).sort((a, b) => a.ordre - b.ordre)
        .filter(x => x.id !== 'monnaie').map(x => ({ v: x.id, n: x.nom })),
      marcheCat, v => { marcheCat = v; U.ouvrir('reserves', { onglet: 'marche' }); }));

    const ids = window.RES_ORDRE.filter(id => window.RES[id].cat === marcheCat
      && (E().vus['res:' + id] || window.Etat.qte(id) > 0));
    if (!ids.length) { c.appendChild(el('div', { class: 'vide', text: 'Rien à négocier de cette sorte.' })); return; }
    for (const id of ids) {
      const r = window.RES[id], q = window.Etat.qte(id);
      const pv = M.prixVente(id), pa = M.prixAchat(id);
      const t = M.tendance(id);
      c.appendChild(el('div', { class: 'cadre' },
        el('div', { class: 'rangee' },
          U.icoRes(id, 30),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'rangee entre' },
              el('span', { class: 'tt', style: 'font-size:14px', text: r.nom }),
              el('span', { class: t > 0.02 ? 'eti bon' : (t < -0.02 ? 'eti mauvais' : 'eti'),
                text: 'cours ×' + M.cours(id).toFixed(2).replace('.', ',') +
                      (t > 0.02 ? '  en hausse' : t < -0.02 ? '  en baisse' : '  stable') })),
            el('div', { class: 'eti', style: 'margin-top:4px',
              text: 'en réserve : ' + U.fmt(q) })),
          el('div', { class: 'colonne', style: 'gap:4px' },
            el('div', { class: 'rangee', style: 'gap:4px' },
              el('button', { class: 'b mini', text: 'vendre 10', disabled: !vend || q < 10,
                title: (pv * 10) + ' écus', onclick: () => { const z = M.vendre(id, 10); if (!z.ok) U.dire(z.raison, 'alerte'); } }),
              el('button', { class: 'b mini', text: 'tout', disabled: !vend || q < 1,
                title: (pv * Math.floor(q)) + ' écus', onclick: () => { const z = M.vendre(id, q); if (!z.ok) U.dire(z.raison, 'alerte'); } })),
            el('div', { class: 'rangee', style: 'gap:4px' },
              el('button', { class: 'b mini primaire', text: 'acheter 10', disabled: !ach || window.Etat.qte('ecu') < pa * 10,
                title: (pa * 10) + ' écus', onclick: () => { const z = M.acheter(id, 10); if (!z.ok) U.dire(z.raison, 'alerte'); } }),
              el('button', { class: 'b mini primaire', text: '×100', disabled: !ach || window.Etat.qte('ecu') < pa * 100,
                title: (pa * 100) + ' écus', onclick: () => { const z = M.acheter(id, 100); if (!z.ok) U.dire(z.raison, 'alerte'); } })))),
        el('div', { class: 'rangee', style: 'margin-top:8px' },
          el('span', { class: 'eti', text: 'vente' }), U.puce('ecu', pv, { mini: true, gain: true }),
          el('span', { class: 'eti', text: 'achat' }), U.puce('ecu', pa, { mini: true }))));
    }
  }

  /* =================================================================
     LES HABITANTS
     ================================================================= */
  function ouvrirHabitants(onglet) {
    if (typeof onglet === 'string' && onglet.indexOf('fiche:') === 0) {
      habFicheId = onglet.slice(6); onglet = 'fiche';
    } else if (onglet === 'collection') habFicheId = null;
    U.ouvrir('habitants', {
      onglet: typeof onglet === 'string' ? onglet : undefined,
      titre: 'Les habitants', sous: 'Qui fait quoi', classe: 'habitants-fen',
      sousVif: () => { const n = E().habitants.length, l = window.Etat.habitantsLibres().length;
        return n + (n > 1 ? ' habitants' : ' habitant') + ' · ' + l + (l > 1 ? ' libres' : ' libre'); },
      onglets: () => [
        { id: 'collection', nom: 'Collection', rendu: rendreCollection },
        ...(habFicheId ? [{ id: 'fiche', nom: 'Fiche', rendu: rendreFicheHabitant }] : []),
        { id: 'portes', nom: 'Les portes', rendu: rendrePortes },
        { id: 'roles', nom: 'Affectations', rendu: rendreRoles },
        { id: 'metiers', nom: 'Métiers du bourg', rendu: rendreMetiers },
        { id: 'traits', nom: 'Caractères', rendu: rendreTraits },
        { id: 'memorial', nom: 'Ceux qui sont partis', rendu: rendreMemorial },
      ],
    });
  }

  function progressionIndividu(h, metier) {
    return window.Etat.progresMetierHabitant(h, metier);
  }

  function rendreCollection(c) {
    const habitants = E().habitants.slice().sort((a, b) => (b.niv || 1) - (a.niv || 1));
    const filtres = [{ id:'tous', nom:'Tous' }, { id:'libres', nom:'Libres' }, { id:'travail', nom:'Au travail' }]
      .concat(Object.keys(window.HAB.RARETES || {}).map(id => ({ id, nom: window.HAB.RARETES[id].nom })));
    c.appendChild(el('div', { class:'collection-filtres' }, filtres.map(f =>
      el('button', { class:'b mini' + (collectionFiltre === f.id ? ' primaire' : ''), text:f.nom,
        onclick:() => { collectionFiltre = f.id; ouvrirHabitants('collection'); } }))));
    const vus = habitants.filter(h => collectionFiltre === 'tous' ||
      (collectionFiltre === 'libres' && !h.aff) || (collectionFiltre === 'travail' && h.aff) || h.rarete === collectionFiltre);
    c.appendChild(el('div', { class:'collection-compte', text: vus.length + ' habitant' + (vus.length > 1 ? 's' : '') }));
    const grille = el('div', { class:'collection-grille' });
    for (const h of vus) {
      const R = window.HAB.RARETES[h.rarete] || window.HAB.RARETES.commun;
      /* LA CARTE PORTRAIT. Le visage prend toute la carte ; le nom, le
         métier, la rareté et le niveau vivent dans un volet blanc qui
         monte du bas au survol — la carte se lit d'un coup d'œil, le
         détail se mérite (voir .carte-infos dans la feuille de style).
         PAS D'INFOBULLE : elle répéterait ce que le volet affiche déjà. */
      const av = avatarHab(h, 150, 'carte-portrait');
      delete av.dataset.bulle;
      grille.appendChild(el('button', { class:'carte-habitant', onclick:() => ouvrirHabitants('fiche:' + h.id) },
        av,
        el('span', { class:'carte-infos' },
          el('span', { class:'collection-nom', text:h.nom }),
          el('span', { class:'collection-meta', text:(window.METIERS[h.talent] || {}).nom || '—' }),
          el('span', { class:'carte-infos-ligne' },
            el('span', { class:'collection-badge r-' + R.id, text:R.nom }),
            el('span', { class:'collection-niveau', text:'Niv. ' + (h.niv || 1) })))));
    }
    c.appendChild(grille);
  }

  function rendreFicheHabitant(c) {
    const h = window.Etat.habitant(habFicheId) || E().habitants[0];
    if (!h) { c.appendChild(el('div', { class:'vide', text:'Aucun habitant.' })); return; }
    window.Etat.assurerProgression(h);
    const R = window.HAB.RARETES[h.rarete] || window.HAB.RARETES.commun;
    c.appendChild(el('div', { class:'fiche-hab-tete' }, avatarHab(h, 86, 'fiche-avatar'),
      el('div', { class:'fiche-hab-identite' }, el('h2', { text:h.nom }), etiqRarete(h),
        el('div', { class:'eti', text:((window.METIERS[h.talent] || {}).nom || '—') + ' · niveau ' + (h.niv || 1) }),
        bandeTraits(h))));
    c.appendChild(U.section('Expérience générale', 'niveau ' + (h.niv || 1)));
    const niveauPct = Math.min(1, (h.xp || 0) / window.Etat.xpPourNiveau(h.niv || 1));
    c.appendChild(U.barre(niveauPct, 'grande vert', Math.round(niveauPct * 100) + '%', U.fmt(h.xp || 0) + ' / ' + U.fmt(window.Etat.xpPourNiveau(h.niv || 1))));
    if (window.VieVillage) {
      const vie = window.VieVillage.assurerHabitant(h), ville = window.VieVillage.resume();
      c.appendChild(U.section('Vie au bourg', vie.humeur));
      c.appendChild(el('div',{class:'moral-habitant'},
        el('div',{class:'moral-score'},el('strong',{text:Math.round(vie.moral)}),el('span',{text:'/ 100'})),
        el('div',{style:'flex:1'},el('div',{class:'tt',text:vie.plainte}),
          el('div',{class:'eti',text:'Cible actuelle : ' + Math.round(vie.cible) + ' · harmonie du bourg : ' + ville.harmonie}))));
      c.appendChild(el('div',{class:'indices-village'},
        [['Propreté',ville.proprete],['Sécurité',ville.securite],['Loisirs',ville.loisir],['Logement',ville.logement],['Repas',ville.repas]].map(x =>
          el('div',{class:'indice-village'},el('span',{text:x[0]}),el('b',{text:x[1]})) )));
    }
    c.appendChild(U.section('Maîtrise des métiers', 'niveaux sans limite'));
    const metiers = el('div',{class:'progressions-verticales metiers'});
    for (const m of Object.keys(window.METIERS)) {
      const p = progressionIndividu(h, m), pct = p.pct;
      const meta = window.METIERS[m], src = window.Img && window.Img.metier(m);
      metiers.appendChild(el('div',{class:'jauge-verticale',title:meta.nom + ' · ' + U.fmt(p.dans) + ' / ' + U.fmt(p.pour) + ' XP'},
        el('b',{text:p.niveau}),
        el('div',{class:'jauge-tube'},el('i',{style:'height:' + Math.round(pct * 100) + '%'})),
        src ? el('img',{src,alt:'',class:'jauge-icone'}) : el('span',{class:'jauge-icone dessin'},U.ico(meta.ico,24)),
        el('span',{text:meta.nom})));
    }
    c.appendChild(metiers);
    c.appendChild(U.section('Attributs d’aventure', 'progression par pratique'));
    const attrs = el('div',{class:'progressions-verticales attributs'});
    for (const [id, nom, image] of [['force','Force','dmg'], ['dexterite','Dextérité','aspd'], ['endurance','Endurance','hp'], ['intelligence','Intelligence','esh']]) {
      const p = window.Etat.progresAttributHabitant(h, id);
      attrs.appendChild(el('div',{class:'jauge-verticale aventure',title:nom + ' · ' + U.fmt(p.dans) + ' / ' + U.fmt(p.pour) + ' XP'},
        el('b',{text:p.niveau}),
        el('div',{class:'jauge-tube'},el('i',{style:'height:' + Math.round(p.pct * 100) + '%'})),
        el('img',{src:'img/objets/aventure/stats/' + image + '.png',alt:'',class:'jauge-icone'}),
        el('span',{text:nom})));
    }
    c.appendChild(attrs);
    c.appendChild(el('button', { class:'b', style:'margin-top:14px', text:'Retour à la collection', onclick:() => ouvrirHabitants('collection') }));
  }
  function rendreRoles(c) {
    const E2 = E();
    const log = window.Etat.logementTotal();
    const libres = window.Etat.habitantsLibres().length;
    const ateliers = Object.keys(E2.bat).map(id => E2.bat[id]).filter(b => b.postes && b.postes.length);
    const postes = ateliers.reduce((n, b) => n + b.postes.length, 0);
    const tenus = ateliers.reduce((n, b) => n + b.postes.filter(p => p.hab).length, 0);
    c.appendChild(U.stats([
      ['habitants', E2.habitants.length + ' / ' + log, E2.habitants.length >= log ? 'mauvais' : 'bon'],
      ['sans emploi', libres, libres ? 'faible' : 'bon'],
      ['postes tenus', tenus + ' / ' + postes, tenus === postes && postes ? 'bon' : ''],
      ['cadence', '×' + window.Jeu.multGlobal().toFixed(2).replace('.', ',')],
    ]));

    const vacants = Math.max(0, postes - tenus);
    if (libres && vacants) c.appendChild(el('div', { class: 'appel affect-appel' },
      el('div', { style: 'flex:1;min-width:0' },
        el('div', { class: 'tt', style: 'font-size:14px', text: 'Le bourg peut produire davantage' }),
        el('div', { class: 'eti', text: Math.min(libres, vacants) + ' affectation(s) disponible(s)' })),
      el('button', { class: 'b primaire', text: 'Répartir au mieux', onclick: () => {
        /* D'abord les postes dont la tâche est déjà choisie, puis les
           autres : un clic relance réellement la production. */
        const cibles = [];
        for (const b of ateliers) for (let i = 0; i < b.postes.length; i++)
          if (!b.postes[i].hab) cibles.push({ b, i, pret: !!b.postes[i].rec });
        cibles.sort((a, z) => (z.pret ? 1 : 0) - (a.pret ? 1 : 0));
        for (const x of cibles) {
          if (!window.Etat.habitantsLibres().length) break;
          window.Jeu.assignerAuto(x.b.id, x.i);
        }
        rafraichirVillage();
      } })));

    c.appendChild(U.section('Ateliers'));
    if (!ateliers.length) c.appendChild(el('div', { class: 'vide',
      html: 'Aucun atelier pour le moment.<br>La pêcherie est un bon premier poste.' }));
    for (const b of ateliers) {
      const defB = window.BAT[b.type];
      const occupes = b.postes.filter(p => p.hab).length;
      const actifs = b.postes.filter(p => p.hab && p.rec && !p.bloque).length;
      const premierVide = b.postes.findIndex(p => !p.hab);
      const productions = b.postes.map(p => p.rec && window.REC[p.rec] ? window.REC[p.rec].nom : null).filter(Boolean);
      c.appendChild(el('div', { 'data-cle': 'aff-' + b.id, class: 'affect-ligne',
        onclick: () => window.UIFen.ouvrirBatiment(b.id) },
        el('div', { class: 'affect-ico' },
          (window.Img && window.Img.metier && window.Img.metier(defB.metier))
            ? window.Img.vignette(window.Img.metier(defB.metier), 30, defB.metier, 'vig-metier')
            : U.ico(window.METIERS[defB.metier] ? window.METIERS[defB.metier].ico : { f:'cube', c:['#789'] }, 24)),
        el('div', { class: 'affect-main' },
          el('div', { class: 'rangee entre' },
            el('span', { class: 'tt', style: 'font-size:14px', text: defB.nom }),
            el('span', { class: 'affect-compte ' + (actifs ? 'bon' : ''), text: occupes + ' / ' + b.postes.length })),
          el('div', { class: 'eti', text: productions.length ? productions.join(' · ') : 'tâche à choisir' })),
        premierVide >= 0 ? el('button', { class: 'b mini' + (libres ? ' primaire' : ''),
          disabled: !libres, text: '+ meilleur', onclick: ev => {
            ev.stopPropagation(); window.Jeu.assignerAuto(b.id, premierVide); rafraichirVillage();
          } }) : el('span', { class: 'etat-ok', text: 'complet' })));
    }

    c.appendChild(U.section('Habitants'));
    const tries = E2.habitants.slice().sort((a, b) => (a.aff ? 1 : 0) - (b.aff ? 1 : 0) || (b.niv || 1) - (a.niv || 1));
    const liste = el('div', { class: 'affect-habitants' });
    for (const h of tries) {
      let ou = 'sans affectation', quoi = '', rec = null;
      if (h.aff && h.aff.k === 'poste') {
        const b = E2.bat[h.aff.bat];
        if (b) { ou = window.BAT[b.type].nom;
          const p = b.postes[h.aff.i];
          rec = p && p.rec ? window.REC[p.rec] : null;
          quoi = rec ? rec.nom : 'sans tâche'; }
      } else if (h.aff && h.aff.k === 'chantier') { ou = 'Chantier du bourg'; quoi = 'bâtit'; }
      const meta = window.METIERS[h.talent] || { nom: '—', ico: { f: 'cube', c: ['#8a8272'] } };
      liste.appendChild(el('div', { 'data-cle': h.id, class: 'affect-habitant' + (h.aff ? '' : ' libre'),
        title: window.HAB.listeTraits(h).map(t => window.HAB.trait(t).nom).join(' · ') },
        avatarHab(h, 18, h.aff ? 'vert' : ''),
        el('div', { class: 'affect-identite' },
          el('div', { class: 'rangee' }, el('b', { text: h.nom }), etiqRarete(h),
            el('span', { class: 'niv', text: 'niv ' + (h.niv || 1) })),
          el('span', { text: meta.nom + ' · ' + ou + (quoi ? ' · ' + quoi : '') })),
        h.aff ? el('button', { class: 'b mini', text: 'Libérer', onclick: () => {
          window.Etat.libererHabitant(h.id); rafraichirVillage();
        } }) : el('button', { class: 'b mini', text: 'Chantier', onclick: () => {
          window.Etat.affecterChantier(h.id); rafraichirVillage();
        } })));
    }
    c.appendChild(liste);
  }
  function rendreMetiers(c) {
    c.appendChild(el('div', { class: 'note',
      text: "Ce rang-là appartient au BOURG, pas à l'individu : un bourg qui a beaucoup pêché pêche vite, quel que soit le pêcheur. Chaque rang ajoute 3 % de cadence à toutes les tâches du métier — et cet acquis ne se perd jamais." }));
    const l = Object.keys(window.METIERS).map(m => ({ m, p: window.Etat.progresMetier(m) }))
      .sort((a, b) => b.p.rang - a.p.rang);
    for (const { m, p } of l) {
      const meta = window.METIERS[m];
      const terr = window.Expedition ? window.Expedition.bonusMetier(m) : 1;
      c.appendChild(el('div', { class: 'cadre' },
        el('div', { class: 'rangee' },
          el('div', { class: 'av' },
            (window.Img && window.Img.metier && window.Img.metier(m))
              ? window.Img.vignette(window.Img.metier(m), 26, meta.nom, 'vig-metier')
              : U.ico(meta.ico, 20)),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'rangee entre' },
              el('span', { class: 'tt', style: 'font-size:14px', text: meta.nom }),
              el('span', { class: 'eti-or', text: 'rang ' + p.rang })),
            el('div', { style: 'margin-top:8px' },
              U.barre(p.dans / p.pour, 'grande vert',
                '×' + (1 + 0.03 * (p.rang - 1)).toFixed(2).replace('.', ',') +
                (terr > 1.001 ? '  ·  territoire ×' + terr.toFixed(2).replace('.', ',') : ''),
                U.fmt(p.dans) + ' / ' + U.fmt(p.pour)))))));
    }
  }

  function rendreTraits(c) {
    const E2 = E();
    c.appendChild(el('div', { class: 'note',
      text: "Chacun arrive avec un métier de prédilection, une rareté et deux à quatre traits — qualités et défauts mêlés, définitifs. Rien de cela ne demande de surveillance : c'est ce qui rend le CHOIX de l'habitant intéressant." }));
    c.appendChild(U.section('Raretés au bourg'));
    const parR = {};
    for (const h of E2.habitants) parR[h.rarete] = (parR[h.rarete] || 0) + 1;
    const gr = el('div', { class: 'grille-res' });
    for (const id of window.HAB.RARETES_IDS) {
      const R = window.HAB.RARETES[id];
      gr.appendChild(el('div', { class: 'item-res r-' + id + ((parR[id] || 0) ? '' : ' mort'), title: R.desc },
        el('div', { class: 'pastille-r', style: 'background:' + R.col }),
        el('div', { class: 'n' }, el('b', { text: R.nom }),
          el('i', { text: R.q + ' qualité' + (R.q > 1 ? 's' : '') + (R.d ? ', ' + R.d + ' défaut' : ', aucun défaut') })),
        el('span', { class: 'q', text: parR[id] || 0 })));
    }
    c.appendChild(gr);
    c.appendChild(U.section('Métiers de prédilection'));
    const parTalent = {};
    for (const h of E2.habitants) (parTalent[h.talent] = parTalent[h.talent] || []).push(h);
    const g = el('div', { class: 'grille-res' });
    for (const m in window.METIERS) {
      const n = (parTalent[m] || []).length;
      g.appendChild(el('div', { class: 'item-res' + (n ? '' : ' mort'),
        title: (parTalent[m] || []).map(h => h.nom).join(', ') },
        U.ico(window.METIERS[m].ico, 26),
        el('div', { class: 'n' }, el('b', { text: window.METIERS[m].nom }),
          el('i', { text: '+20 % sur ce métier' })),
        el('span', { class: 'q', text: n })));
    }
    c.appendChild(g);
    for (const genre of ['qualite', 'defaut']) {
      c.appendChild(U.section(genre === 'qualite' ? 'Qualités' : 'Défauts'));
      const ids = genre === 'qualite' ? window.HAB.QUALITES : window.HAB.DEFAUTS;
      for (const t of ids) {
        const T = window.HAB.TRAITS[t];
        const gens = E2.habitants.filter(h => window.HAB.a(h, t));
        c.appendChild(el('div', { 'data-cle': t, class: 'cadre' + (gens.length ? '' : ' mort') },
          el('div', { class: 'rangee entre' },
            pastilleTrait(t),
            el('span', { class: 'eti-or', text: gens.length ? gens.length + '' : '—' })),
          el('div', { class: 'note', style: 'margin-top:4px', text: T.desc }),
          gens.length ? el('div', { class: 'eti', style: 'margin-top:4px',
            text: gens.map(h => h.nom).join('  ·  ') }) : null));
      }
    }
  }

  /* =================================================================
     LES PORTES DU BOURG

     Un toit libre, de quoi manger, et l'on ouvre. Trois voyageurs se
     présentent, on en garde UN — les deux autres repartent pour de bon.
     Refermer la fenêtre ne relance pas les dés : ce sont les mêmes trois
     tant qu'on n'a pas tranché.
     ================================================================= */
  function rendrePortes(c) {
    const E2 = E();
    const pl = window.Etat.placesLibres();
    const barre = window.Etat.portesBarrees();
    const cout = window.Etat.coutAccueil();
    const vivres = window.Etat.vivresDisponibles();
    const attrait = window.Etat.attraitBourg();

    /* Une fois les portes ouvertes, tout le reste s'efface. Ce moment est
       un choix de personnage, pas une sous-section d'un rapport de stock. */
    if (E2.portes.postulants) {
      const refus = window.Etat.apercuRefus();
      if (postulantChoisi != null && !E2.portes.postulants[postulantChoisi]) postulantChoisi = null;
      c.appendChild(el('div', { class: 'choix-portes-tete' },
        el('div', { class: 'choix-portes-sur', text: 'Les portes du bourg' }),
        el('div', { class: 'choix-portes-titre', text: 'Choisissez votre nouvel habitant' }),
        el('div', { class: 'choix-portes-sous', text: 'Chaque voyageur apporte un talent et un caractère différents. Vous n’en accueillez qu’un.' })));
      const g = el('div', { class: 'postulants' });
      for (let k = 0; k < E2.portes.postulants.length; k++) g.appendChild(cartePostulant(k, () => {
        postulantChoisi = k; rafraichirVillage();
      }));
      c.appendChild(g);
      c.appendChild(el('div', { class: 'choix-portes-actions' },
        el('button', { class: 'b danger refuser-candidats', text: 'Refuser les trois',
          title: 'Portes closes ' + U.duree(refus.duree) + ' · cadence −' + Math.round(refus.force * 100) + ' % · moral −' + refus.moral,
          onclick: () => {
            const avert = 'Refuser ces trois voyageurs ?\n\nPortes closes : ' + U.duree(refus.duree)
              + '\nCadence globale : −' + Math.round(refus.force * 100) + ' %'
              + '\nMoral : −' + refus.moral;
            if (window.Reglages.lire('confirmer') && !confirm(avert)) return;
            postulantChoisi = null; window.Etat.refuserTous(); rafraichirVillage();
          } }),
        el('button', { class: 'b primaire confirmer-candidat', disabled: postulantChoisi == null,
          text: postulantChoisi == null ? 'Choisissez une carte' : 'Confirmer ce choix', onclick: () => {
            if (postulantChoisi == null) return;
            window.Etat.accueillir(postulantChoisi); postulantChoisi = null; rafraichirVillage();
          } })));
      c.appendChild(el('div', { class: 'choix-portes-prix-refus',
        text: 'Refuser : portes closes ' + U.duree(refus.duree)
          + ' · cadence −' + Math.round(refus.force * 100) + ' % · moral −' + refus.moral
          + ' · prochains candidats moins rares' }));
      return;
    }

    c.appendChild(U.stats([
      ['toits libres', pl, pl ? 'bon' : 'mauvais'],
      ['repas en réserve', Math.floor(vivres) + ' / ' + cout, vivres >= cout ? 'bon' : 'mauvais'],
      ['attrait du bourg', '×' + (1 + attrait).toFixed(2).replace('.', ','), attrait > 0.6 ? 'bon' : ''],
      ['accueillis', E2.portes.accueillis || 0],
    ]));

    /* CE QUI VA SORTIR DE LA GRANGE, en clair.

       Le coût s'affichait « 24 portions ». Le mot n'existe nulle part
       ailleurs dans le jeu : aucun compteur ne le montre, aucune recette
       ne le rend, et le joueur n'a donc aucun moyen de savoir s'il en a.
       On montre le PANIER réel — un poisson, deux blés — et la notion
       cesse d'être abstraite. */
    const ap = window.Etat.apercuAccueil();
    const bloc = el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'eti-or', text: 'ce que coûte une bouche de plus' }),
        el('span', { class: ap.suffit ? 'eti' : 'eti mauvais',
          text: ap.suffit ? 'la grange y suffit' : 'il manque de quoi nourrir' })));
    if (Object.keys(ap.panier).length)
      bloc.appendChild(el('div', { style: 'margin-top:8px' }, U.listeRes(ap.panier)));
    else
      bloc.appendChild(el('div', { class: 'note mauvais', style: 'margin-top:4px',
        text: "La grange est vide : il n'y a rien à sortir. Faites pêcher, labourer ou traire." }));

    /* ET CE QU'EST UNE PORTION. La notion est juste — un navet ne
       nourrit pas comme une tourte — mais elle n'était expliquée
       nulle part. On la dit ici, avec la table. */
    const POR = window.Jeu.PORTIONS || {};
    const enStock = Object.keys(POR).filter(k => window.Etat.qte(k) > 0)
      .sort((a, b) => POR[b] - POR[a]);
    const lignes = ["Ce qu'on appelle un repas",
      'De quoi nourrir un chat une fois. Chaque vivre en vaut plus ou moins :', ''];
    for (const k of (enStock.length ? enStock : Object.keys(POR)).slice(0, 9))
      lignes.push('· ' + window.RES[k].nom + ' : ' +
        String(POR[k]).replace('.', ',') + ' repas' + " l'unité");
    lignes.push('');
    lignes.push('Le bourg sort toujours ce qui nourrit le MOINS : on garde les tourtes pour les jours maigres.');
    bloc.appendChild(el('div', { class: 'note', style: 'margin-top:8px',
      title: lignes.join('\n'),
      text: "Un repas d'avance, pris dans ce qui nourrit le moins. Survolez pour voir ce que vaut chaque vivre." }));
    c.appendChild(bloc);

    /* ce que l'attrait change, en clair : les chances de chaque rareté */
    c.appendChild(U.section('Ce qui se présentera'));
    const poids = [];
    let tot = 0;
    for (const id of window.HAB.RARETES_IDS) {
      const R = window.HAB.RARETES[id];
      const w = R.poids * Math.pow(1 + attrait, R.rang * 0.85);
      poids.push({ id, R, w }); tot += w;
    }
    const jauge = el('div', { class: 'jauge-raretes' });
    for (const x of poids)
      jauge.appendChild(el('i', { class: 'r-' + x.id,
        style: 'width:' + (x.w / tot * 100).toFixed(2) + '%;background:' + x.R.col,
        title: x.R.nom + ' — ' + (x.w / tot * 100).toFixed(1).replace('.', ',') + ' %' }));
    c.appendChild(jauge);
    const lg = el('div', { class: 'rangee enroule', style: 'margin-top:8px' });
    for (const x of poids)
      lg.appendChild(el('span', { class: 'rarete r-' + x.id,
        text: x.R.nom + ' ' + (x.w / tot * 100).toFixed(1).replace('.', ',') + ' %' }));
    c.appendChild(lg);
    c.appendChild(el('div', { class: 'note',
      text: 'Le moral, la taverne, la chapelle et le donjon font venir du meilleur monde. Chaque renvoi, lui, abîme la réputation du bourg pour de bon.' }));

    c.appendChild(U.section('Ouvrir'));
    const v = window.Etat.peutOuvrirPortes();
    if (barre > 0) {
      c.appendChild(el('div', { class: 'cadre alerte' },
        el('div', { class: 'tt', style: 'font-size:14px', text: 'Les portes sont closes' }),
        el('div', { class: 'note mauvais', style: 'margin-top:4px',
          text: 'La rumeur court encore. Personne ne se présentera avant ' + U.duree(barre) + '.' }),
        el('div', { style: 'margin-top:8px' },
          U.barre(1 - barre / Math.max(1, 180 * Math.pow(1.35, Math.min(6, (E2.portes.renvois || 1) - 1))),
            'grande rouge', 'réputation', U.duree(barre)))));
    }
    c.appendChild(el('button', {
      class: 'b primaire large', disabled: !v.ok,
      text: v.ok
        ? 'Ouvrir les portes  —  ' + (Object.keys(ap.panier).length
            ? Object.keys(ap.panier).map(k => ap.panier[k] + ' ' + window.RES[k].nom.toLowerCase()).join(', ')
            : 'rien en réserve')
        : 'Impossible d\'ouvrir',
      onclick: () => { window.Etat.ouvrirPortes(); rafraichirVillage(); } }));
    if (!v.ok) {
      c.appendChild(el('div', { class: 'note mauvais', text: v.pourquoi }));
      /* UN REFUS DOIT PORTER SA SORTIE. Un bouton gris et une phrase qui
         constate laissent le joueur devant rien — surtout ici, où les
         portes sont la seule source d'habitants. */
      if (/vivres/i.test(v.pourquoi))
        c.appendChild(el('div', { class: 'appel calme', style: 'margin-top:8px' },
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'tt', style: 'font-size:13px', text: 'Il faut de quoi nourrir' }),
            el('div', { class: 'eti',
              text: 'La pêcherie et le champ sont les deux sources de départ : mettez-y quelqu\'un.' })),
          el('button', { class: 'b', text: 'Voir les vivres',
            onclick: () => window.UIFen.ouvrirReserves('vivres') })));
      else if (/toit/i.test(v.pourquoi))
        c.appendChild(el('div', { class: 'appel calme', style: 'margin-top:8px' },
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'tt', style: 'font-size:13px', text: 'Il faut un toit' }),
            el('div', { class: 'eti', text: 'Une maison neuve ouvre une place ; il faut bâtir un quartier pour grandir.' })),
          el('button', { class: 'b', text: 'Que bâtir ?',
            onclick: () => window.UIFen.ouvrirChantier() })));
    } else c.appendChild(el('div', { class: 'note',
      text: 'Ces vivres sortent de la grange quel que soit celui qu\'on garde — même si l\'on renvoie les trois.' }));

    if (E2.malaise && E2.malaise.reste) c.appendChild(el('div', { class: 'cadre alerte' },
      el('div', { class: 'tt', style: 'font-size:14px', text: 'Le bourg fait la tête' }),
      el('div', { class: 'note mauvais', style: 'margin-top:4px',
        text: 'Tout le monde travaille ' + Math.round((1 - window.Etat.facteurMalaise()) * 100) +
              ' % moins vite. Cela passera dans ' + U.duree(E2.malaise.reste) + '.' }),
      el('div', { style: 'margin-top:8px' },
        U.barre(1 - E2.malaise.reste / Math.max(1, E2.malaise.total || 1), 'grande rouge',
          'apaisement', U.duree(E2.malaise.reste)))));
  }

  /* LA CARTE D'UN POSTULANT.

     C'est le seul écran du jeu où l'on choisit QUI vit là, et c'était
     jusqu'ici trois lignes de texte. On lui donne maintenant ce qu'il
     mérite : le VISAGE d'abord, grand, puis le nom, le métier, et deux
     lignes seulement — ce qu'il apporte, ce qu'il coûte.

     Le reste des traits reste lisible au survol : on n'encombre pas un
     choix avec ce qui ne le décide pas. */
  function cartePostulant(k, selectionner) {
    const p = E().portes.postulants[k];
    const R = window.HAB.RARETES[p.rarete];
    const meta = window.METIERS[p.talent] || { nom: '—', ico: { f: 'cube', c: ['#8a8272'] } };
    const T = window.HAB.TRAITS;

    /* on sépare les qualités des défauts : le joueur veut voir la
       colonne verte et la colonne rouge, pas une bouillie mêlée */
    const qual = [], def = [];
    for (const t of (p.traits || [])) {
      const d = T[t]; if (!d) continue;
      (d.genre === 'defaut' ? def : qual).push(d);
    }

    const visage = window.Img ? window.Img.portrait(p) : null;
    let portrait = null;
    if (visage) {
      portrait = window.Img.vignette(visage, 420, p.nom, 'grand');
      /* La vignette générique est volontairement dimensionnée en pixels.
         Ici, la carte doit au contraire remplir tout son cadre, quelle que
         soit la taille de la fenêtre. */
      portrait.style.width = '100%';
      portrait.style.height = '100%';
    }
    const av = visage
      ? el('div', { class: 'figure' }, portrait)
      : el('div', { class: 'figure sans' }, U.ico(meta.ico, 54));

    function ligneTrait(d, bon) {
      return el('div', { class: 'tr ' + (bon ? 'bon' : 'mal'), title: d.desc || '' },
        el('span', { class: 'pt' }),
        el('span', { class: 'nm', text: d.nom }));
    }

    return el('div', { 'data-cle': 'p' + k,
      class: 'postulant r-' + p.rarete + (postulantChoisi === k ? ' choisi' : ''),
      title: postulantChoisi === k ? p.nom + ' est sélectionné' : 'Sélectionner ' + p.nom,
      onclick: selectionner },
      el('div', { class: 'fanion', style: 'background:' + R.col, title: R.nom + ' — ' + R.desc },
        U.ico(meta.ico, 15)),
      av,
      el('div', { class: 'corps' },
        el('div', { class: 'nom', style: 'color:' + R.col, text: p.nom }),
        el('div', { class: 'role', text: meta.nom + ' · niveau ' + p.niv }),
        el('div', { class: 'filet' }),
        qual.length ? el('div', { class: 'bloc-tr' },
          el('div', { class: 'chap bon', text: 'bonus' }),
          ...qual.map(d => ligneTrait(d, true))) : null,
        def.length ? el('div', { class: 'bloc-tr' },
          el('div', { class: 'chap mal', text: 'malus' }),
          ...def.map(d => ligneTrait(d, false))) : null,
        !def.length ? el('div', { class: 'bloc-tr' },
          el('div', { class: 'chap bon', text: 'aucun défaut connu' })) : null));
  }

  /* Renvoyer quelqu'un : on dit le prix AVANT, en toutes lettres. */
  function confirmerRenvoi(h) {
    const E2 = E();
    const n = E2.portes.renvois || 0;
    const duree = Math.round(180 * Math.pow(1.35, Math.min(6, n)));
    const force = Math.min(0.42, 0.14 + 0.05 * Math.min(5, n));
    U.ouvrir('renvoi', {
      titre: 'Renvoyer ' + h.nom + ' ?', sous: 'Ce que le bourg vous fera payer',
      onglets: [{ id: 'x', nom: 'Conséquences', rendu: c => {
        c.appendChild(el('div', { class: 'note',
          text: 'On ne chasse pas quelqu\'un sans que tout le monde le sache. Le bourg boude, et personne ne se présente plus aux portes pendant un moment.' }));
        c.appendChild(U.stats([
          ['portes closes', U.duree(duree), 'mauvais'],
          ['cadence', '−' + Math.round(force * 100) + ' %', 'mauvais'],
          ['moral', '−14', 'mauvais'],
          ['renvois déjà faits', n, n ? 'mauvais' : ''],
        ]));
        c.appendChild(el('div', { class: 'note mauvais',
          text: 'Chaque renvoi suivant coûtera plus cher que celui-ci, et abaisse durablement l\'attrait du bourg.' }));
        c.appendChild(el('div', { class: 'rangee', style: 'margin-top:12px' },
          el('button', { class: 'b large', text: 'Le garder',
            onclick: () => U.fermer('renvoi') }),
          el('button', { class: 'b danger large', text: 'Le renvoyer quand même',
            onclick: () => { window.Etat.renvoyer(h.id); U.fermer('renvoi'); rafraichirVillage(); } })));
      } }],
    });
  }

  function rendreMemorial(c) {
    const E2 = E();
    c.appendChild(el('div', { class: 'note',
      text: 'Le bourg tient la liste. Un renvoi et une mort dans la tour coûtent exactement la même chose : les portes closes, le moral en berne, et tout le monde qui traîne des pattes.' }));
    c.appendChild(U.stats([
      ['départs', E2.memorial.length],
      ['renvois', E2.portes.renvois || 0, (E2.portes.renvois || 0) ? 'mauvais' : ''],
      ['refus aux portes', E2.portes.refus || 0],
      ['attrait perdu', '−' + ((E2.portes.renvois || 0) * 0.25).toFixed(2).replace('.', ','),
        (E2.portes.renvois || 0) ? 'mauvais' : ''],
    ]));
    if (!E2.memorial.length) {
      c.appendChild(el('div', { class: 'vide', html: 'Personne n\'est jamais parti.<br>Que cela dure.' }));
      return;
    }
    c.appendChild(U.section('Ceux qui sont partis'));
    for (const m of E2.memorial) {
      const R = window.HAB.RARETES[m.rarete] || window.HAB.RARETES.commun;
      c.appendChild(el('div', { class: 'cadre' },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', style: 'font-size:14px', text: m.nom }),
          el('span', { class: 'rarete r-' + R.id, text: R.nom })),
        el('div', { class: 'eti', style: 'margin-top:4px',
          text: m.fin + '  ·  niveau ' + m.niv + '  ·  jour ' + Math.floor(m.t / 260) })));
    }
  }

  /* =================================================================
     LE BOURG — l'état général
     ================================================================= */
  function ouvrirBourg(onglet) {
    U.ouvrir('bourg', {
      titre: window.Village ? window.Village.nom() : 'Le bourg', sous: 'État général',
      onglet: onglet,
      sousVif: () => 'Jour ' + E().jours + ' · ' + (window.Village ? window.Village.rang() : ''),
      onglets: () => {
        const E2 = E();
        const ong = [{ id: 'general', nom: 'Bourg', rendu: rendreBourg }];
        /* Les acquis, les contremaîtres et la charte sont des
           mécaniques de milieu de partie. Tant qu'aucune n'a servi,
           les nommer ne fait qu'allonger la barre. */
        if (Object.keys(E2.recherches || {}).length || E2.jours >= 3 || onglet === 'acquis')
          ong.push({ id: 'acquis', nom: 'Acquis', rendu: rendreAcquis });
        const unContremaitre = window.Auto &&
          (window.Auto.CONTREMAITRES || []).some(x => window.Auto.acquis(x.id));
        if (unContremaitre || E2.jours >= 5 || onglet === 'auto')
          ong.push({ id: 'auto', nom: 'Contremaîtres', rendu: rendreAuto });
        ong.push({ id: 'objectifs', nom: 'Objectifs', rendu: rendreObjectifs });
        /* la charte n'a de sens qu'une fois un sceau à portée */
        const charteUtile = window.Prestige &&
          (window.Prestige.seuilAtteint() || (window.Prestige.etat().sceaux || 0) > 0);
        if (charteUtile || onglet === 'charte')
          ong.push({ id: 'charte', nom: 'La charte', rendu: rendreCharte });
        if (E2.menace > 8 || E2.jours >= 2 || onglet === 'menace')
          ong.push({ id: 'menace', nom: 'Menace', rendu: rendreMenace });
        ong.push({ id: 'journal', nom: 'Journal', rendu: rendreJournal });
        ong.push({ id: 'partie', nom: 'Partie', rendu: rendrePartie });
        return ong;
      },
    });
  }
  function rendreBourg(c) {
    const E2 = E();
    const t = el('table', { class: 'tabl' });
    const l = (k, v) => t.appendChild(el('tr', {}, el('th', { text: k }), el('td', { class: 'n', text: v })));
    l('Habitants', E2.habitants.length + ' / ' + window.Etat.logementTotal());
    l('Édifices', Object.keys(E2.bat).length);
    l('Moral', E2.moral + ' / 100');
    l('Cadence générale', '×' + window.Jeu.multGlobal().toFixed(2).replace('.', ','));
    l('Vivres', E2.famine ? 'RUPTURE' : 'suffisants');
    l('Défense', window.Jeu.defenseTotale());
    l('Compagnie', E2.armee.unites + ' unités · xp ' + U.fmt(E2.armee.xp));
    l('Descente', 'record ' + E2.aventure.record + ' étages');
    l('Territoires', window.Etat.nbConquetes());
    l('Raids subis', E2.raids);
    c.appendChild(el('div', { class: 'cadre' }, t));
    c.appendChild(el('div', { class: 'note',
      text: "Le moral vient de la chapelle, des arbres à chat et des repas ; il multiplie toutes les cadences du bourg. La famine le fait chuter d'un coup." }));
  }
  /* Tout ce que le bourg a gagné pour de bon, en un seul tableau : c'est
     la page qu'on relit pour savoir où l'on en est. */
  function rendreAcquis(c) {
    const A = window.Jeu.acquis();
    const n = Object.keys(E().recherches || {}).length;
    c.appendChild(el('div', { class: 'rangee entre' },
      el('span', { class: 'eti', text: n + ' recherche' + (n > 1 ? 's' : '') + ' sur ' + window.RECHERCHES.length }),
      el('button', { class: 'b mini primaire', text: 'Ouvrir l\'arbre', onclick: () => ouvrirRecherches() })));
    const lignes = [
      ['Cadence générale', A.global, '%'],
      ['Rendement', A.rendement, '%'],
      ['Économie de matière', A.conso, '%'],
      ['Trouvailles', A.butin, '%'],
      ['Stockage', A.stock, '%'],
      ['Expérience', A.xp, '%'],
      ['Immigration', A.immigration, '%'],
      ['Négoce', A.negoce, '%'],
      ['Menace freinée', A.menace, '%'],
      ['Butin de la descente', A.descente, '%'],
      ['Colonne', A.colonne, '%'],
      ['Moral', A.moral, 'pts'],
      ['Défense', A.defense, 'pts'],
    ].filter(l => l[1]);
    if (lignes.length) {
      c.appendChild(U.section('Effets permanents'));
      const t = el('table', { class: 'tabl' });
      for (const [k, v, u] of lignes)
        t.appendChild(el('tr', {}, el('th', { text: k }),
          el('td', { class: 'n g bon', text: '+' + (u === '%' ? Math.round(v * 100) : Math.round(v)) + ' ' + u })));
      c.appendChild(el('div', { class: 'cadre creux' }, t));
    }
    const mets = Object.keys(A.metier).filter(m => A.metier[m]);
    if (mets.length) {
      c.appendChild(U.section('Cadence par métier'));
      const g = el('div', { class: 'liste-res' });
      for (const m of mets)
        g.appendChild(el('span', { class: 'puce gain' }, U.ico(window.METIERS[m].ico, 18),
          el('b', { text: window.METIERS[m].nom + '  +' + Math.round(A.metier[m] * 100) + ' %' })));
      c.appendChild(g);
    }
    const rends = Object.keys(A.rendementMetier).filter(m => A.rendementMetier[m]);
    if (rends.length) {
      c.appendChild(U.section('Rendement par métier'));
      const g = el('div', { class: 'liste-res' });
      for (const m of rends)
        g.appendChild(el('span', { class: 'puce butin' }, U.ico(window.METIERS[m].ico, 18),
          el('b', { text: window.METIERS[m].nom + '  +' + Math.round(A.rendementMetier[m] * 100) + ' %' })));
      c.appendChild(g);
    }
    if (!lignes.length && !mets.length)
      c.appendChild(el('div', { class: 'vide',
        html: 'Aucune recherche encore.<br>Le bourg n\'a que ses bras et son bon sens.' }));
  }

  /* ------------------------------------------------------------------
     LES CONTREMAÎTRES. Chacun retire une corvée, jamais une décision :
     ils rangent derrière le joueur, ils ne jouent pas à sa place.
     ------------------------------------------------------------------ */
  function rendreAuto(c) {
    const A = window.Auto.etatAuto();
    const engages = window.Auto.CONTREMAITRES.filter(x => window.Auto.acquis(x.id)).length;
    c.appendChild(el('div', { class: 'note',
      text: "Chacun s'engage une fois pour toutes, puis s'allume et s'éteint à volonté. Aucun ne fabrique quoi que ce soit : ils n'enlèvent que la corvée." }));
    c.appendChild(U.barre(engages / window.Auto.CONTREMAITRES.length, 'grande',
      'contremaîtres engagés', engages + ' / ' + window.Auto.CONTREMAITRES.length));
    for (const x of window.Auto.CONTREMAITRES) {
      const pris = window.Auto.acquis(x.id);
      const on = window.Auto.actif(x.id);
      c.appendChild(el('div', { class: 'cadre' + (on ? ' actif' : (pris ? '' : ' mort')) },
        el('div', { class: 'rangee' },
          el('div', { class: 'av' + (on ? ' or' : '') }, U.ico(x.ico, 20)),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'tt', style: 'font-size:14px', text: x.nom }),
            el('div', { class: 'note', style: 'margin-top:4px', text: x.desc })),
          pris ? U.bascule(on, v => { window.Auto.basculer(x.id, v); })
               : null),
        el('div', { class: 'note faible', style: 'margin-top:4px', text: x.note }),
        pris ? null : el('div', { class: 'rangee entre', style: 'margin-top:8px;flex-wrap:wrap' },
          U.listeRes(x.cout, { verifier: true }),
          el('button', { class: 'b mini primaire', text: 'Engager',
            disabled: !window.Etat.assez(x.cout),
            onclick: () => {
              const r = window.Auto.acheter(x.id);
              U.dire(r.ok ? x.nom + ' entre en fonction.' : r.raison, r.ok ? 'bien' : 'alerte');
            } }))));
    }
    if (window.Auto.acquis('chantier')) {
      c.appendChild(U.section('Réglage du chef de chantier'));
      c.appendChild(el('div', { class: 'cadre' },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'eti', text: 'bras qu\'il a le droit de prendre' }),
          el('span', { class: 'niv', text: A.brasChantier + '' })),
        el('div', { style: 'margin-top:8px' },
          U.segments([1, 2, 3, 4, 5, 6].map(n => ({ v: n, n: n + '' })), A.brasChantier,
            v => { A.brasChantier = v; })),
        el('div', { class: 'note', style: 'margin-top:8px',
          text: 'Plus il en prend, plus le chantier avance — et moins il reste de monde aux ateliers.' })));
    }
    if (E().venteAuto) {
      c.appendChild(U.section('Ce que le colporteur a racheté'));
      c.appendChild(el('div', { class: 'rangee' },
        U.puce('ecu', Math.round(E().venteAuto), { gain: true }),
        el('span', { class: 'note', text: 'depuis le début de la partie' })));
    }
  }

  /* ------------------------------------------------------------------
     LES OBJECTIFS. Ils ne récompensent pas : ils ORIENTENT. On les
     réclame à la main, parce qu'ouvrir la page et trouver trois
     récompenses en attente fait partie du plaisir.
     ------------------------------------------------------------------ */
  let objGroupe = 'batir';
  function rendreObjectifs(c) {
    const P = window.Prestige;
    const attente = P.enAttente();
    const faits = window.OBJECTIFS.filter(o => P.fait(o)).length;
    c.appendChild(U.stats([
      ['atteints', faits + ' / ' + window.OBJECTIFS.length, faits ? 'bon' : ''],
      ['à réclamer', attente, attente ? 'bon' : 'faible'],
      ['sceaux en vue', P.sceauxGagnables()],
    ]));
    if (attente) c.appendChild(el('button', { class: 'b primaire pleine',
      text: 'Réclamer les ' + attente + ' récompenses en attente',
      onclick: () => { const n = P.reclamerTout(); U.dire(n + ' récompense(s) encaissée(s).', 'butin'); } }));
    c.appendChild(U.segments(Object.values(window.OBJ_GROUPES).map(g => ({ v: g.id, n: g.nom })),
      objGroupe, v => { objGroupe = v; U.ouvrir('bourg', { onglet: 'objectifs' }); }));
    const l = window.OBJECTIFS.filter(o => o.gr === objGroupe);
    for (const o of l) {
      const av = P.avancement(o);
      const f = P.fait(o), pr = P.pris(o);
      let v = 0; try { v = o.mesure() || 0; } catch (e) { }
      c.appendChild(el('div', { class: 'cadre' + (pr ? ' mort' : (f ? ' actif' : '')) },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', style: 'font-size:13px', text: o.nom }),
          pr ? el('span', { class: 'eti', text: 'réclamé' })
             : (f ? el('button', { class: 'b mini primaire', text: 'Réclamer',
                     onclick: () => { P.reclamer(o.id); } })
                  : el('span', { class: 'eti', text: U.fmt(Math.min(v, o.cible)) + ' / ' + U.fmt(o.cible) }))),
        el('div', { class: 'note', style: 'margin-top:4px', text: o.desc }),
        pr ? null : el('div', { style: 'margin-top:8px' },
          U.barre(av, f ? 'vert' : '', '', Math.round(av * 100) + ' %')),
        pr ? null : el('div', { class: 'rangee enroule', style: 'margin-top:8px' },
          el('span', { class: 'eti', text: 'récompense' }),
          Object.keys(o.rec).map(k => U.puce(k, o.rec[k], { mini: true, gain: true })))));
    }
  }

  /* ------------------------------------------------------------------
     LA CHARTE. La seule chose du jeu qu'on ne peut pas défaire.
     ------------------------------------------------------------------ */
  function rendreCharte(c) {
    const P = window.Prestige;
    const E2 = E();
    const ch = P.etat().charte;
    const gain = P.sceauxGagnables();
    c.appendChild(U.stats([
      ['chartes scellées', ch.chartes || 0],
      ['sceaux en main', ch.sceaux || 0, (ch.sceaux || 0) ? 'bon' : ''],
      ['gagnés en tout', ch.totalSceaux || 0],
      ['à gagner ici', gain, gain >= 5 ? 'bon' : 'mauvais'],
    ]));
    c.appendChild(el('div', { class: 'note',
      text: "Sceller la charte efface le bourg — ses édifices, ses habitants, ses recherches, son territoire — et rend des SCEAUX. Les sceaux achètent des avantages qui valent pour toutes les parties suivantes. Le record de descente, lui, ne se perd jamais." }));
    c.appendChild(U.barre(Math.min(1, gain / 5), 'grande ' + (gain >= 5 ? 'vert' : 'rouge'),
      'de quoi sceller', gain + ' / 5 sceaux'));
    c.appendChild(el('div', { class: 'cadre' + (gain >= 5 ? '' : ' mort') },
      el('div', { class: 'note',
        text: gain >= 5 ? 'Le bourg a fait ses preuves. On peut sceller.'
                        : 'Il faut descendre plus bas, prendre du territoire ou pousser les recherches.' }),
      el('div', { style: 'margin-top:8px' },
        el('button', { class: 'b danger', text: 'Sceller la charte  (+' + gain + ' sceaux)',
          disabled: gain < 5,
          onclick: () => {
            if (window.Reglages.lire('confirmer') &&
                !confirm('Sceller la charte ? Le bourg entier repart de zéro. Vous gagnerez ' + gain + ' sceaux.')) return;
            const r = P.sceller();
            if (!r.ok) { U.dire(r.raison, 'alerte'); return; }
            location.reload();
          } }))));

    c.appendChild(U.section('Ce que les sceaux achètent'));
    for (const p of window.SCEAUX_PERKS) {
      const n = P.perkRang(p.id);
      const fini = n >= p.max;
      const cout = fini ? 0 : p.cout(n);
      c.appendChild(el('div', { class: 'cadre' + (n ? ' actif' : '') },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', style: 'font-size:13px', text: p.nom }),
          el('span', { class: 'niv', text: n + ' / ' + p.max })),
        el('div', { class: 'note', style: 'margin-top:4px', text: p.desc }),
        el('div', { style: 'margin-top:8px' }, U.barre(n / p.max, 'violet', '', n + ' / ' + p.max)),
        fini ? null : el('div', { class: 'rangee entre', style: 'margin-top:8px' },
          el('span', { class: 'eti-or', text: cout + ' sceau' + (cout > 1 ? 'x' : '') }),
          el('button', { class: 'b mini primaire', text: 'Apposer',
            disabled: (ch.sceaux || 0) < cout,
            onclick: () => { const r = P.acheterPerk(p.id); if (!r.ok) U.dire(r.raison, 'alerte'); } }))));
    }
  }

  /* ------------------------------------------------------------------
     LA MENACE. Ce n'est plus une jauge qui attend cent pour frapper :
     elle pèse tout du long, par paliers, et le joueur peut la faire
     retomber quand il le décide en sortant à sa rencontre.
     ------------------------------------------------------------------ */
  function rendreMenace(c) {
    const E2 = E();
    const pct = E2.menace / 100;
    const P = window.Jeu.palierMenace();
    const perte = Math.round((1 - P.mult) * 100);

    c.appendChild(U.stats([
      ['état du bourg', P.nom, perte ? 'mauvais' : 'bon'],
      ['cadence', perte ? '−' + perte + ' %' : 'entière', perte ? 'mauvais' : 'bon'],
      ['menace', Math.floor(E2.menace) + ' / 100', E2.menace > 68 ? 'mauvais' : ''],
      ['montée', '+' + (window.Jeu.tauxMenace() * 60).toFixed(1).replace('.', ',') + ' /min'],
    ]));

    /* l'échelle entière, avec le palier où l'on se trouve : le joueur
       doit voir ce qu'il gagnerait à faire retomber la jauge d'un cran. */
    c.appendChild(U.section('Ce que coûte la peur'));
    const ech = el('div', { class: 'echelle' });
    let bas = 0;
    for (const q of window.Jeu.PALIERS_MENACE) {
      const haut = Math.min(100, q.max);
      ech.appendChild(el('div', {
        'data-cle': q.id, class: 'ech-pas' + (q.id === P.id ? ' ici' : ''),
        style: 'flex:' + (haut - bas), title: q.desc },
        el('b', { text: q.nom }),
        el('i', { text: q.mult === 1 ? 'cadence entière' : '−' + Math.round((1 - q.mult) * 100) + ' %' })));
      bas = haut;
    }
    c.appendChild(ech);
    c.appendChild(el('div', { style: 'margin-top:8px' },
      U.barre(pct, 'enorme ' + (E2.menace > 68 ? 'rouge' : (E2.menace > 25 ? '' : 'vert')),
        P.nom, Math.floor(E2.menace) + ' / 100')));
    c.appendChild(el('div', { class: 'note', text: P.desc }));

    /* --- PAR OÙ LA FAIRE RETOMBER --- */
    c.appendChild(U.section('La faire retomber'));
    const aPort = window.Etat.aBatiment('port');
    const P2 = window.Port;
    const mouilles = aPort && P2 ? P2.navires().filter(n => n.etat === 'mouillage') : [];
    const enMer = aPort && P2 ? P2.navires().filter(n => n.etat === 'mer').length : 0;

    const bloc = el('div', { class: 'cadre' + (mouilles.length ? ' actif' : '') },
      el('div', { class: 'note',
        text: "La Nuée ne recule pas d'elle-même, et l'on ne va pas la chercher à pied : "
            + "le bourg est sur une île. On arme un navire, on charge la cale, on traverse, "
            + "et l'on prend la sienne. C'est la SEULE façon de faire baisser cette jauge." }));

    if (!aPort) {
      bloc.appendChild(el('div', { class: 'note mauvais', style: 'margin-top:8px',
        text: "Le bourg n'a pas de port : la jauge ne peut que monter." }));
      bloc.appendChild(el('button', { class: 'b primaire large', style: 'margin-top:12px',
        text: 'Que bâtir ?', onclick: () => { U.fermerTout(); window.UIFen.ouvrirChantier(); } }));
    } else {
      const b = window.Etat.batsDeType('port')[0];
      bloc.appendChild(U.stats([
        ['navires', P2.navires().length + ' / ' + P2.quaisMax()],
        ['en traversée', enMer],
        ['devant une île', mouilles.length, mouilles.length ? 'bon' : ''],
        ['îles prises', P2.assure().prises.length],
      ]));
      /* ce que rapporterait la prochaine île à portée */
      const proches = (window.ILES || []).slice().sort((a, z) => a.lieues - z.lieues);
      if (proches.length) bloc.appendChild(el('div', { class: 'note', style: 'margin-top:8px',
        text: 'La plus proche, ' + proches[0].nom + ', est à ' + proches[0].lieues +
              ' lieues et ferait retomber la Nuée de ' + proches[0].menace + ' points.' }));
      bloc.appendChild(el('button', { class: 'b primaire large', style: 'margin-top:12px',
        text: mouilles.length ? 'Un navire attend l\'ordre de bataille' : 'Ouvrir le port',
        onclick: () => { U.fermerTout(); window.UIFen.ouvrirBatiment(b.id); } }));
    }
    c.appendChild(bloc);

    /* --- la défense passive --- */
    c.appendChild(U.section('Si on ne sort pas'));
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', text: 'Défense ' + window.Jeu.defenseTotale() }),
        el('span', { class: 'eti', text: 'contre ' + (40 + window.Etat.nbConquetes() * 14 + E2.raids * 6) + ' attendus' })),
      el('div', { class: 'note', style: 'margin-top:8px',
        text: "Remparts, caserne, tours de guet, garnison et sentinelles. Si la défense égale la force du raid, il est repoussé sans un seul dégât — et rapporte une médaille." }),
      el('div', { class: 'note',
        text: "Tenir le guet à la tour fait aussi redescendre la jauge, lentement et sans risque." })));
  }
  function rendreJournal(c) {
    const j = E().journal;
    if (!j.length) { c.appendChild(el('div', { class: 'vide', text: 'Rien à raconter pour l\'instant.' })); return; }
    for (const e of j.slice(0, 70))
      c.appendChild(el('div', { class: 'jl ' + e.genre },
        el('span', { class: 't', text: U.duree(e.t).replace(' ', '') }),
        el('span', { class: 'x', text: e.txt })));
  }
  /* ==================================================================
     LES RÉGLAGES
     Un idle se joue longtemps : ce qui gêne au bout de deux heures gêne
     ensuite tous les jours. Chaque réglage répond à une gêne précise.
     ================================================================== */
  function ouvrirReglages(onglet) {
    U.ouvrir('reglages', {
      titre: 'Réglages', sous: 'Confort et personnalisation',
      onglet: onglet, classe: 'large',
      onglets: [
        { id: 'affichage', nom: 'Affichage', rendu: rendreReglagesAffichage },
        { id: 'jeu', nom: 'Jeu', rendu: rendreReglagesJeu },
        { id: 'bourg', nom: 'Le bourg', rendu: rendreReglagesBourg },
        { id: 'partie', nom: 'Partie', rendu: rendrePartie },
      ],
    });
  }

  /* une ligne de réglage : intitulé, explication, contrôle à droite */
  function ligneReglage(nom, expl, controle) {
    return el('div', { class: 'cadre' },
      el('div', { class: 'rangee' },
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { class: 'tt', style: 'font-size:13px', text: nom }),
          expl ? el('div', { class: 'note', style: 'margin-top:4px', text: expl }) : null),
        controle));
  }
  const R = () => window.Reglages;

  function rendreReglagesAffichage(c) {
    const o = R().O();
    c.appendChild(ligneReglage('Notation des nombres',
      'Comment s\'écrivent les grands nombres. « 12 340 », « 12,3 k » ou « 12,3k ».',
      U.segments([{ v: 'court', n: '12,3 k' }, { v: 'complet', n: '12 340' }, { v: 'compact', n: '12,3k' }],
        o.notation, v => R().ecrire('notation', v))));
    c.appendChild(ligneReglage('Taille de l\'interface',
      'Agrandit ou réduit tout ce qui flotte au-dessus du village.',
      U.segments([90, 100, 110, 125].map(n => ({ v: n, n: n + ' %' })), o.echelle,
        v => R().ecrire('echelle', v))));
    c.appendChild(ligneReglage('Couleur d\'accent',
      'La teinte des titres, des onglets actifs et des points d\'attention.',
      U.segments(Object.keys(R().ACCENTS).map(k => ({ v: k, n: R().ACCENTS[k].nom })), o.accent,
        v => R().ecrire('accent', v))));
    c.appendChild(ligneReglage('Côté du dock',
      'Les chargements en cours à gauche ou à droite de l\'écran.',
      U.segments([{ v: 'gauche', n: 'Gauche' }, { v: 'droite', n: 'Droite' }], o.dockCote,
        v => R().ecrire('dockCote', v))));
    c.appendChild(U.section('Dans le village'));
    c.appendChild(ligneReglage('Gains flottants',
      'Ce qui vient d\'être produit monte au-dessus de l\'atelier.',
      U.bascule(o.gains, v => R().ecrire('gains', v))));
    c.appendChild(ligneReglage('Gestes de métier',
      'La canne, la hache, le marteau : les habitants au poste montrent ce qu\'ils font.',
      U.bascule(o.gestes, v => R().ecrire('gestes', v))));
    c.appendChild(ligneReglage('Les habitants',
      'Un chat par habitant du bourg. Il se promène quand il ne fait rien, '
      + 'et se tient à son atelier quand il travaille. Les sprites sont ceux '
      + 'de la compagnie en expédition ; les volumes tournent vraiment sur eux-mêmes.',
      U.segments([{ v: 'sprite', n: 'Sprites' }, { v: 'bloc', n: 'Volumes' },
                  { v: 'aucun', n: 'Aucun' }], o.habitants || 'sprite',
        v => R().ecrire('habitants', v))));
    c.appendChild(ligneReglage('Nom des bâtiments',
      'Maintenez Alt pour lire le village, ou laissez les noms visibles en permanence.',
      U.segments([{v:'alt',n:'Avec Alt'},{v:'toujours',n:'Toujours'},{v:'aucun',n:'Masqués'}],
        o.nomsBatiments || 'alt', v => R().ecrire('nomsBatiments',v))));
    c.appendChild(ligneReglage('Densité de la foule',
      'Combien de silhouettes animent les terrasses, en plus de vos habitants.',
      U.segments([{ v: 0, n: 'Clairsemée' }, { v: 1, n: 'Dense' }, { v: 2, n: 'Foule' }], o.foule,
        v => R().ecrire('foule', v))));
  }

  function rendreReglagesJeu(c) {
    const o = R().O();
    c.appendChild(ligneReglage('Vitesse du jour',
      'La course du soleil. Elle n\'accélère rien de l\'économie — seulement la lumière, et les traits Matinal et Noctambule.',
      U.segments([{ v: 'lent', n: 'Lente' }, { v: 'normal', n: 'Normale' },
                  { v: 'rapide', n: 'Rapide' }, { v: 'fige', n: 'Figée' }], o.vitesseJour,
        v => R().ecrire('vitesseJour', v))));
    c.appendChild(ligneReglage('Messages volants',
      'Les bandeaux qui apparaissent en haut de l\'écran.',
      U.segments([{ v: 'tous', n: 'Tous' }, { v: 'importants', n: 'Importants' }, { v: 'aucun', n: 'Aucun' }],
        o.messages, v => R().ecrire('messages', v))));
    c.appendChild(ligneReglage('Demander confirmation',
      'Avant de démolir, d\'abandonner une bataille ou de recommencer.',
      U.bascule(o.confirmer, v => R().ecrire('confirmer', v))));
    c.appendChild(U.section('Raccourcis'));
    const t = el('table', { class: 'tabl' });
    for (const [k, v] of [['O', 'replier le dock'], ['C', 'carnet du chantier'], ['R', 'réserves'],
      ['H', 'habitants'], ['B', 'le bourg'], ['G', 'réglages'], ['Alt', 'noms des bâtiments'], ['W', 'tout fermer'],
      ['Échap', 'fermer la fenêtre du dessus / annuler une pose']])
      t.appendChild(el('tr', {}, el('th', { text: k }), el('td', { text: v })));
    c.appendChild(el('div', { class: 'cadre creux' }, t));
  }

  function rendreReglagesBourg(c) {
    const E2 = E();
    const champ = el('input', { class: 's', value: window.Village ? window.Village.nom() : '', maxlength: 34 });
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'tt', style: 'font-size:13px', text: 'Nom du bourg' }),
      el('div', { class: 'note', style: 'margin:4px 0 8px',
        text: 'Celui qui s\'affiche en haut à gauche, et dans le journal.' }),
      el('div', { class: 'rangee' }, champ,
        el('button', { class: 'b mini primaire', text: 'Renommer', onclick: () => {
          const v = champ.value.trim();
          if (!v) return;
          window.Village.renommer(v); E2.nomBourg = v;
          window.Etat.journal('Le bourg s\'appelle désormais ' + v + '.', 'info');
          U.dire('Le bourg s\'appelle désormais ' + v + '.', 'bien');
        } }))));
    c.appendChild(U.section('Le bourg en chiffres'));
    c.appendChild(U.stats([
      ['jour', E2.jours],
      ['temps de jeu', U.duree(E2.tJeu)],
      ['édifices', Object.keys(E2.bat).length],
      ['habitants', E2.habitants.length],
      ['recherches', Object.keys(E2.recherches || {}).length],
      ['territoires', window.Etat.nbConquetes()],
      ['descente', E2.aventure.record],
      ['raids', E2.raids],
    ]));
    c.appendChild(U.section('Le décor'));
    c.appendChild(el('div', { class: 'rangee enroule' },
      el('button', { class: 'b', text: 'Basculer jour / nuit', onclick: () => {
        const h = window.Village.heure();
        window.Village.heure(h > 0.2 && h < 0.8 ? 0.95 : 0.42);
      } }),
      el('button', { class: 'b', text: 'Capturer le village', onclick: () => {
        const a = document.createElement('a');
        a.download = (window.Village.nom() || 'bourg').replace(/\s/g, '-') + '.png';
        a.href = window.Village.canvas().toDataURL('image/png'); a.click();
      } })));
  }

  function rendrePartie(c) {
    c.appendChild(el('div', { class: 'note',
      text: 'La partie s\'enregistre toute seule dans ce navigateur, et le bourg continue de travailler pendant votre absence — jusqu\'à douze heures rattrapées au retour.' }));
    c.appendChild(el('div', { class: 'rangee enroule' },
      el('button', { class: 'b primaire', text: 'Enregistrer maintenant',
        onclick: () => { window.Etat.sauver(true); U.dire('Partie enregistrée.', 'bien'); } })));

    c.appendChild(U.section('Emporter la partie'));
    const zone = el('input', { class: 's', placeholder: 'collez ici un texte de sauvegarde…' });
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'note', style: 'margin-bottom:8px',
        text: 'Le texte ci-dessous contient toute la partie. Copiez-le pour la mettre à l\'abri, ou collez-en un pour la reprendre ailleurs.' }),
      el('div', { class: 'rangee enroule' },
        el('button', { class: 'b', text: 'Copier la partie', onclick: () => {
          const t = window.Reglages.exporter();
          if (!t) { U.dire('Export impossible.', 'alerte'); return; }
          zone.value = t;
          zone.select();
          try { navigator.clipboard.writeText(t); } catch (e) { document.execCommand('copy'); }
          U.dire('Partie copiée dans le presse-papiers.', 'bien');
        } }),
        el('button', { class: 'b', text: 'Reprendre une partie', onclick: () => {
          if (!zone.value.trim()) { U.dire('Collez d\'abord un texte de sauvegarde.', 'alerte'); return; }
          if (window.Reglages.lire('confirmer') && !confirm('Remplacer la partie en cours ?')) return;
          const r = window.Reglages.importer(zone.value);
          if (!r.ok) { U.dire(r.raison, 'alerte'); return; }
          location.reload();
        } })),
      el('div', { style: 'margin-top:8px' }, zone)));

    c.appendChild(U.section('Repartir de zéro'));
    c.appendChild(el('div', { class: 'cadre alerte' },
      el('div', { class: 'note mauvais',
        text: 'Efface ce bourg, ses habitants, ses recherches et son territoire. Rien n\'en revient.' }),
      el('div', { style: 'margin-top:8px' },
        el('button', { class: 'b danger', text: 'Recommencer une partie', onclick: () => {
          if (window.Reglages.lire('confirmer') && !confirm('Effacer ce bourg et repartir de zéro ?')) return;
          /* on ÉCRIT une partie neuve avant de recharger : effacer seul ne
             suffit pas, la sauvegarde de fermeture de page réécrirait
             l'ancienne juste après. */
          if (window.Village) window.Village.chargerPlan([]);
          window.Etat.recommencer();
          location.reload();
        } }))));
  }

  window.UIFen = {
    ouvrirBatiment, ouvrirChantier, ouvrirReserves, ouvrirHabitants, ouvrirBourg, ouvrirRecherches, ouvrirReglages,
    ongletsBatiment,
    entrerConstruction, quitterConstruction, poserIci,
    get typeAPoser() { return typeAPoser; },
  };
  U.quitterConstruction = quitterConstruction;

  function rafraichirVillage() {
    if (window.App && window.App.majAffectations) window.App.majAffectations();
  }

})();
