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

  function vignetteHabitant(h, rec) {
    const meta = window.METIERS[h.talent] || { nom: '—', ico: { f: 'cube', c: ['#8a8272'] } };
    const bonus = rec ? window.Jeu.facteurHabitant(h, rec) : 1;
    const accorde = rec && h.talent === rec.metier;
    return el('div', { class: 'rangee', style: 'flex:1;min-width:0' },
      el('div', { class: 'av' + (accorde ? ' or' : ''), title: 'Prédilection : ' + meta.nom },
        U.ico(meta.ico, 20)),
      el('div', { class: 'qui', style: 'flex:1;min-width:0' },
        el('i', { text: meta.nom + (accorde ? '  ·  à son métier' : '') }),
        el('div', { class: 'rangee', style: 'gap:7px' },
          el('b', { text: h.nom }), etiqRarete(h)),
        bandeTraits(h, { serre: true })),
      el('span', { class: 'niv', text: 'niv ' + (h.niv || 1) }),
      rec ? el('span', { class: bonus >= 1.15 ? 'grand bon' : (bonus < 0.99 ? 'grand mauvais' : 'grand doux'),
        title: 'Ce que cet habitant rend à ce poste précis',
        text: '×' + bonus.toFixed(2).replace('.', ',') }) : null);
  }

  /* Le choix de l'habitant : une petite fenêtre qui classe les candidats
     par ce qu'ils rendraient ICI. */
  function choisirHabitant(bid, i) {
    U.ouvrir('affecter', {
      titre: 'Qui prend ce poste ?', sous: window.BAT[E().bat[bid].type].nom,
      onglets: [{ id: 'l', nom: 'Candidats', rendu: c => {
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
              U.fermer('affecter'); rafraichirVillage();
            } },
            el('div', { class: 'rangee' }, vignetteHabitant(cd.h, rec),
              el('button', { class: 'b mini primaire', text: 'Affecter' }))));
        }
      } }],
    });
  }

  function blocPoste(b, i) {
    const p = b.postes[i];
    const dispo = window.BatUtil.recettesDe(b.type, b.niv);
    const h = p.hab ? window.Etat.habitant(p.hab) : null;
    const rec = p.rec ? window.REC[p.rec] : null;
    const v = rec ? window.Jeu.vitessePoste(b, rec, h) : 1;

    const box = el('div', { class: 'poste' + (h ? (p.bloque ? ' bloque' : (rec ? ' actif' : '')) : ' vacant') });

    /* --- qui tient le poste --- */
    box.appendChild(el('div', { class: 'haut' },
      h ? vignetteHabitant(h, rec)
        : el('div', { class: 'rangee', style: 'flex:1' },
            el('div', { class: 'av' }, U.ico({ f: 'oeuf', c: ['#3a3448', '#241f30'] }, 20)),
            el('div', { class: 'qui' },
              el('i', { text: 'poste ' + (i + 1) }),
              el('b', { class: 'faible', text: 'personne au poste' }))),
      h ? el('button', { class: 'b mini danger', text: 'Retirer',
            onclick: () => { window.Etat.libererHabitant(p.hab); rafraichirVillage(); } })
        : el('button', { class: 'b mini primaire', text: 'Affecter',
            disabled: !window.Etat.habitantsLibres().length,
            onclick: () => choisirHabitant(b.id, i) })));

    /* --- ce qu'on y fait --- */
    box.appendChild(el('div', { class: 'rangee entre', style: 'margin-bottom:8px' },
      el('div', { class: 'rangee', style: 'flex:1;min-width:0' },
        rec ? U.ico(window.METIERS[rec.metier].ico, 18) : null,
        el('span', { class: 'tt', style: 'font-size:14px;flex:1;min-width:0',
          text: rec ? rec.nom : 'aucune tâche' }),
        rec ? el('span', { class: 'niv', title: 'Nombre de cycles restants',
          text: p.reste == null ? 'en boucle' : '×' + p.reste }) : null),
      el('button', { class: 'b mini' + (rec ? '' : ' primaire'), text: rec ? 'Changer' : 'Choisir',
        onclick: () => choisirTache(b.id, i) })));

    if (rec) {
      const parMin = 60 / (rec.duree / Math.max(0.001, v));
      const pct = p.bloque ? 0 : Math.min(1, p.prog / rec.duree);
      box.appendChild(el('div', { style: 'margin-top:10px' },
        U.barre(pct, 'grande ' + (p.bloque ? 'rouge raye' : (h ? 'vert' : '')),
          p.bloque ? 'en attente de matière' : (h ? U.duree(rec.duree / Math.max(0.001, v)) + ' par cycle' : 'aucun ouvrier'),
          h && !p.bloque ? (Math.round(parMin * 10) / 10).toString().replace('.', ',') + ' /min' : '')));

      const ent = el('div', { class: 'rangee enroule', style: 'margin-top:9px' });
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
      box.appendChild(ent);

      /* LES TROUVAILLES, chances réelles à l'appui — celles de l'ouvrage
         et celles du métier, multipliées par ce que vaut l'habitant au
         poste. Un Chanceux se voit dans les pourcentages, pas seulement
         dans sa fiche. */
      const kButin = window.HAB.produit(h, 'butin') *
                     (1 + window.Jeu.amelioDe(b, 'oeil') + window.Jeu.acquis().butin);
      const tousLoots = (rec.loot || []).concat(window.ButinUtil.tableDe(rec.metier, rec.duree, 1));
      if (tousLoots.length) {
        const lo = el('div', { class: 'rangee enroule', style: 'margin-top:6px' },
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
        box.appendChild(lo);
      }
      if (p.bloque) {
        const m = window.Etat.manque(rec.in);
        box.appendChild(el('div', { class: 'note mauvais', style: 'margin-top:6px',
          text: 'Il manque : ' + m.map(x => (window.RES[x.id] ? window.RES[x.id].nom : x.id) + ' (' + Math.floor(x.il) + '/' + x.faut + ')').join(', ') }));
      }

      /* --- combien de fois --- */
      const poss = window.Jeu.cyclesPossibles(p.rec);
      box.appendChild(el('div', { class: 'rangee enroule', style: 'margin-top:9px' },
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
      box.appendChild(el('div', { class: 'rangee entre', style: 'margin-top:10px' },
        el('span', { class: 'eti', text: file.length ? 'à la suite (' + file.length + ')' : 'à la suite' }),
        el('button', { class: 'b mini', text: 'Ajouter', disabled: file.length >= 8,
          onclick: () => choisirTache(b.id, i, true) })));
      if (file.length) {
        for (let k = 0; k < file.length; k++) {
          const f = file[k], fr = window.REC[f.rec];
          box.appendChild(el('div', { class: 'job', style: 'margin-top:5px' },
            U.ico(window.METIERS[fr.metier].ico, 16),
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
      box.appendChild(el('div', { class: 'note', style: 'margin-top:8px', text: rec.desc }));
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
    U.ouvrir('tache', {
      titre: aLaSuite ? 'Ajouter à la file' : 'Que fait-on ici ?',
      sous: window.BAT[E().bat[bid].type].nom,
      onglets: [{ id: 't', nom: 'Tâches', rendu: c => {
        const b = E().bat[bid];
        if (!b) return;
        const dispo = window.BatUtil.recettesDe(b.type, b.niv);
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
              U.fermer('tache'); rafraichirVillage();
            } : null },
            el('div', { class: 'vig' }, U.ico(window.METIERS[r.metier].ico, 32)),
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
              el('div', { class: 'note', style: 'margin-top:6px', text: r.desc })));
          c.appendChild(carte);
        }
      } }],
    });
  }

  /* =================================================================
     LA FENÊTRE D'UN ÉDIFICE
     ================================================================= */
  function ouvrirBatiment(bid) {
    const b = E().bat[bid];
    if (!b) return;
    const def = window.BAT[b.type];
    const ancre = window.Village ? window.Village.ecran(bid) : null;
    if (window.Village) window.Village.selection(bid);

    U.ouvrir('bat:' + bid, {
      titre: def.nom, sous: def.metier + ' · niveau ' + b.niv,
      ancre,
      titreVif: () => window.BAT[E().bat[bid] ? E().bat[bid].type : b.type].nom,
      sousVif: () => {
        const bb = E().bat[bid]; if (!bb) return '';
        return def.metier + ' · niveau ' + bb.niv + (bb.endommage > 0 ? ' · ENDOMMAGÉ' : '');
      },
      surFermeture: () => { if (window.Village) window.Village.selection(null); },
      onglets: () => {
        const bb = E().bat[bid];
        const ong = [];
        if (bb && bb.postes.length) ong.push({ id: 'postes', nom: 'Postes', rendu: c => rendrePostes(c, bid) });
        ong.push({ id: 'niveau', nom: 'Niveau', rendu: c => rendreNiveau(c, bid) });
        if (bb && bb.postes.length) ong.push({ id: 'amelio', nom: 'Améliorations', rendu: c => rendreAmelio(c, bid) });
        if (bb && bb.postes.length) ong.push({ id: 'outil', nom: 'Outillage', rendu: c => rendreOutil(c, bid) });
        if (def.porte === 'aventure') ong.unshift({ id: 'descente', nom: 'Descente', rendu: c => window.UIAventure.rendre(c) });
        if (def.porte === 'expedition') ong.unshift({ id: 'expedition', nom: 'Expédition', rendu: c => window.UIExpedition.rendre(c) });
        ong.push({ id: 'notice', nom: 'Notice', rendu: c => rendreNotice(c, bid) });
        return ong;
      },
    });
  }

  function rendrePostes(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    if (b.endommage > 0) {
      c.appendChild(el('div', { class: 'cadre' },
        el('div', { class: 'eti mauvais', text: 'Bâtiment endommagé' }),
        el('div', { class: 'note', text: 'Le raid l\'a abîmé : il travaille à 40 % tant qu\'il n\'est pas remis en état. La remise en état passe par le chantier.' }),
        el('div', { style: 'margin-top:7px' },
          el('button', { class: 'b primaire', text: 'Mettre au chantier', onclick: () => {
            const r = window.Jeu.reparer(bid);
            U.dire(r.ok ? 'Réparation en file.' : r.raison, r.ok ? 'bien' : 'alerte');
          } }))));
    }
    const libres = window.Etat.habitantsLibres().length;
    const tenus = b.postes.filter(p => p.hab).length;
    const actifs = b.postes.filter(p => p.hab && p.rec && !p.bloque).length;
    c.appendChild(U.stats([
      ['postes tenus', tenus + ' / ' + b.postes.length, tenus === b.postes.length ? 'bon' : ''],
      ['en production', actifs, actifs ? 'bon' : 'mauvais'],
      ['niveau', b.niv],
      ['libres au bourg', libres, libres ? '' : 'faible'],
    ]));
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
          el('div', { class: 'av' + (rang ? ' or' : '') }, U.ico(a.ico, 20)),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'rangee entre' },
              el('span', { class: 'tt', style: 'font-size:14px', text: a.nom }),
              el('span', { class: 'niv', text: rang + ' / ' + a.max })),
            el('div', { class: 'note', style: 'margin-top:3px', text: a.desc })),
          el('span', { class: rang ? 'grand bon' : 'grand faible',
            text: cle === 'postes' ? '+' + val : '+' + Math.round(val * 100) + ' %' })),
        el('div', { style: 'margin-top:8px' },
          U.barre(rang / a.max, 'vert', '', rang + ' / ' + a.max)),
        fini ? el('div', { class: 'eti-or', style: 'margin-top:8px', text: 'dernier cran atteint' })
             : el('div', { class: 'rangee entre', style: 'margin-top:9px;flex-wrap:wrap' },
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
        el('div', { style: 'margin-top:7px' },
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
        acquise ? null : el('div', { class: 'rangee entre', style: 'margin-top:10px;flex-wrap:wrap' },
          U.listeRes(n.cout, { verifier: true }),
          el('button', { class: 'b mini primaire', text: 'Acquérir', disabled: !payable,
            onclick: () => {
              const r = window.Jeu.acheterRecherche(n.id);
              U.dire(r.ok ? 'Recherche acquise : ' + n.nom : r.raison, r.ok ? 'bien' : 'alerte');
            } })),
        (!acquise && manquants.length) ? el('div', { class: 'note mauvais', style: 'margin-top:6px',
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
    const nb = window.BatUtil.recettesDe(b.type, b.niv).length;
    const nb2 = n2 > b.niv ? window.BatUtil.recettesDe(b.type, n2).length : nb;
    if (nb2 > nb) lig('Tâches', nb, nb2);
    return t;
  }

  function rendreOutil(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    c.appendChild(el('div', { class: 'note',
      text: "Un atelier outillé travaille bien plus vite. L'outillage s'use à chaque cycle : la forge doit tourner pour que le reste du bourg avance." }));
    if (b.outil) {
      const pct = b.outil.restant / (b.outil.type === 'outilacier' ? 520 : 190);
      c.appendChild(el('div', { class: 'cadre actif' },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', text: window.RES[b.outil.type].nom }),
          el('span', { class: 'eti-or', text: b.outil.type === 'outilacier' ? '× 1,9' : '× 1,4' })),
        el('div', { style: 'margin-top:7px' }, U.barre(pct, 'vert')),
        el('div', { class: 'eti', style: 'margin-top:4px', text: b.outil.restant + ' cycles avant usure' })));
    } else {
      c.appendChild(el('div', { class: 'cadre' }, el('div', { class: 'note faible', text: "Cet atelier travaille à mains nues." })));
    }
    for (const t of ['outil', 'outilacier']) {
      const q = window.Etat.qte(t);
      c.appendChild(el('div', { class: 'cadre' },
        el('div', { class: 'rangee entre' },
          el('div', { class: 'rangee' }, U.ico(window.RES[t].ico, 22),
            el('div', {}, el('div', { class: 'tt', text: window.RES[t].nom }),
              el('div', { class: 'eti', text: (t === 'outilacier' ? '× 1,9 · 520' : '× 1,4 · 190') + ' cycles' }))),
          el('button', { class: 'b', text: 'Équiper (' + U.fmt(q) + ')', disabled: q < 1,
            onclick: () => { const r = window.Jeu.outiller(bid, t);
              U.dire(r.ok ? 'Atelier outillé.' : r.raison, r.ok ? 'bien' : 'alerte'); } }))));
    }
  }

  function rendreNotice(c, bid) {
    const b = E().bat[bid];
    if (!b) return;
    const def = window.BAT[b.type];
    c.appendChild(el('div', { class: 'note', text: def.desc }));
    c.appendChild(el('div', { class: 'sep' }));
    const dispo = window.BatUtil.recettesDe(b.type, b.niv);
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
    /* La vignette du catalogue est l'ICÔNE DU MÉTIER, pas une image du
       bâtiment : le bâtiment, on le verra en vrai en le posant. */
    const def = window.BAT[type];
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
      c.appendChild(el('div', { class: 'eti-or', style: 'margin-top:10px', text: groupes[g] }));
      for (const type of l) c.appendChild(carteCatalogue(type));
    }
  }

  function carteCatalogue(type) {
    const def = window.BAT[type];
    const cout = window.Jeu.coutConstruction(type);
    const abordable = window.Etat.assez(cout);
    const dejaUn = window.Etat.batsDeType(type).length;
    const unique = ['portail', 'descente', 'chateau', 'moulinEau'].includes(type);
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
        el('div', { class: 'note', style: 'margin-top:5px', text: def.desc })));
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
    window.Village.modeConstruction('chantier');
    const b = document.getElementById('barre-cons');
    b.classList.add('vu');
    U.vide(b);
    b.appendChild(el('span', { class: 'q' }, 'Désignez la parcelle pour ', el('b', { text: window.BAT[type].nom })));
    b.appendChild(el('span', { class: 'eti', text: 'la terrasse suit le curseur' }));
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
    const r = window.Jeu.poserBatiment(t, pos.x, pos.r, { coul: coulAPoser });
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
        const l = Object.values(window.CAT_RES).sort((a, b) => a.ordre - b.ordre)
          .map(cat => ({ id: cat.id, nom: cat.nom, rendu: c => rendreCategorie(c, cat) }));
        l.push({ id: 'marche', nom: 'Marché', rendu: rendreMarche });
        return l;
      },
    });
  }

  /* La ligne d'une ressource : ce qu'on en a, ce qui entre ou sort par
     minute, et dans combien de temps elle débordera ou manquera. Un
     stock ne dit rien ; un DÉBIT dit tout. */
  function ligneRes(id, cap) {
    const r = window.RES[id], q = window.Etat.qte(id);
    const d = window.Marche ? window.Marche.debit(id) : 0;
    const h = window.Marche ? window.Marche.horizon(id) : null;
    const plein = cap && cap < 9000 && q >= cap;
    const cls = 'item-res' + (plein ? ' plein' : '') + (d > 0.002 ? ' monte' : (d < -0.002 ? ' baisse' : ''));
    const parMin = d * 60;
    let sous = 'palier ' + r.tier;
    if (h && h.t > 0 && h.t < 36000) sous = (h.plein ? 'plein dans ' : 'vide dans ') + U.duree(h.t);
    else if (plein) sous = 'au plafond';
    return el('div', { class: cls, title: r.desc },
      U.ico(r.ico, 26),
      el('div', { class: 'n' }, el('b', { text: r.nom }), el('i', { text: sous })),
      el('span', { class: 'q' }, U.fmt(q),
        el('small', { text: Math.abs(parMin) < 0.05 ? '—'
          : (parMin > 0 ? '+' : '') + (Math.round(parMin * 10) / 10).toString().replace('.', ',') + '/min' })));
  }

  function rendreCategorie(c, cat) {
    const cap = window.Etat.plafonds()[cat.id];
    const ids = window.RES_ORDRE.filter(id => window.RES[id].cat === cat.id);
    const connus = ids.filter(id => E().vus['res:' + id] || window.Etat.qte(id) > 0);
    c.appendChild(el('div', { class: 'note', text: cat.desc }));
    if (cap && cap < 9000) {
      const total = connus.reduce((s, id) => s + window.Etat.qte(id), 0);
      const pleins = connus.filter(id => window.Etat.qte(id) >= cap).length;
      c.appendChild(U.stats([
        ['plafond', U.fmt(cap)],
        ['au plafond', pleins, pleins ? 'mauvais' : 'bon'],
        ['en réserve', U.fmt(total)],
        ['sortes', connus.length],
      ]));
      const bStock = cat.batStock;
      if (bStock && !window.Etat.aBatiment(bStock))
        c.appendChild(el('div', { class: 'note mauvais',
          text: 'Le bourg n\'a pas de ' + window.BAT[bStock].nom.toLowerCase() + ' : tout ce qui dépasse le plafond est perdu.' }));
    }
    if (!connus.length) {
      c.appendChild(el('div', { class: 'vide', text: 'Rien de cette sorte n\'est encore passé par le bourg.' }));
      return;
    }
    /* les ressources qui débordent d'abord, puis celles qui montent */
    const tri = connus.slice().sort((a, b) => {
      const da = window.Marche ? window.Marche.debit(a) : 0, db = window.Marche ? window.Marche.debit(b) : 0;
      const pa = (cap && window.Etat.qte(a) >= cap) ? 1 : 0, pb = (cap && window.Etat.qte(b) >= cap) ? 1 : 0;
      return (pb - pa) || (db - da) || (window.Etat.qte(b) - window.Etat.qte(a));
    });
    const grille = el('div', { class: 'grille-res' });
    for (const id of tri) grille.appendChild(ligneRes(id, cap));
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
          U.ico(r.ico, 26),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'rangee entre' },
              el('span', { class: 'tt', style: 'font-size:14px', text: r.nom }),
              el('span', { class: t > 0.02 ? 'eti bon' : (t < -0.02 ? 'eti mauvais' : 'eti'),
                text: 'cours ×' + M.cours(id).toFixed(2).replace('.', ',') +
                      (t > 0.02 ? '  en hausse' : t < -0.02 ? '  en baisse' : '  stable') })),
            el('div', { class: 'eti', style: 'margin-top:3px',
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
        el('div', { class: 'rangee', style: 'margin-top:7px' },
          el('span', { class: 'eti', text: 'vente' }), U.puce('ecu', pv, { mini: true, gain: true }),
          el('span', { class: 'eti', text: 'achat' }), U.puce('ecu', pa, { mini: true }))));
    }
  }

  /* =================================================================
     LES HABITANTS
     ================================================================= */
  function ouvrirHabitants(onglet) {
    U.ouvrir('habitants', {
      onglet: typeof onglet === 'string' ? onglet : undefined,
      titre: 'Les habitants', sous: 'Qui fait quoi',
      sousVif: () => { const n = E().habitants.length, l = window.Etat.habitantsLibres().length;
        return n + (n > 1 ? ' habitants' : ' habitant') + ' · ' + l + (l > 1 ? ' libres' : ' libre'); },
      onglets: [
        { id: 'portes', nom: 'Les portes', rendu: rendrePortes },
        { id: 'roles', nom: 'Affectations', rendu: rendreRoles },
        { id: 'metiers', nom: 'Métiers du bourg', rendu: rendreMetiers },
        { id: 'traits', nom: 'Caractères', rendu: rendreTraits },
        { id: 'memorial', nom: 'Ceux qui sont partis', rendu: rendreMemorial },
      ],
    });
  }
  function rendreRoles(c) {
    const E2 = E();
    const log = window.Etat.logementTotal();
    const libres = window.Etat.habitantsLibres().length;
    c.appendChild(U.stats([
      ['habitants', E2.habitants.length + ' / ' + log, E2.habitants.length >= log ? 'mauvais' : 'bon'],
      ['sans emploi', libres, libres ? 'faible' : 'bon'],
      ['vivres / min', (window.Jeu.besoinTotal() * 60).toFixed(1).replace('.', ',')],
      ['cadence', '×' + window.Jeu.multGlobal().toFixed(2).replace('.', ',')],
    ]));
    c.appendChild(U.barre(E2.habitants.length / Math.max(1, log),
      'grande ' + (E2.habitants.length >= log ? 'rouge' : 'vert'),
      'toits occupés', E2.habitants.length + ' / ' + log));
    const pl = window.Etat.placesLibres();
    c.appendChild(el('div', { class: 'note',
      text: pl <= 0
        ? 'Plus un seul toit libre : personne ne peut s\'installer et aucune portée ne peut être élevée. Bâtissez une maison.'
        : pl + ' toit' + (pl > 1 ? 's libres' : ' libre') + ' : autant de fois que vous pouvez ouvrir les portes.' }));
    if (pl > 0) c.appendChild(el('button', { class: 'b primaire large',
      text: 'Ouvrir les portes  (' + pl + ')',
      onclick: () => { window.UIFen.ouvrirHabitants('portes'); } }));

    c.appendChild(U.section('Qui fait quoi'));
    const tries = E2.habitants.slice().sort((a, b) => (a.aff ? 0 : 1) - (b.aff ? 0 : 1) || (b.niv || 1) - (a.niv || 1));
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
      const prog = (h.xp || 0) / window.Etat.xpPourNiveau(h.niv || 1);
      c.appendChild(el('div', { 'data-cle': h.id, class: 'cadre fiche r-' + (h.rarete || 'commun') + (h.aff ? '' : ' mort') },
        el('div', { class: 'rangee' },
          el('div', { class: 'av' + (h.aff ? ' vert' : '') }, U.ico(meta.ico, 20)),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'rangee' },
              el('span', { class: 'tt', style: 'font-size:15px', text: h.nom }),
              etiqRarete(h),
              el('span', { class: 'niv', text: 'niv ' + (h.niv || 1) })),
            el('div', { class: 'eti', style: 'margin-top:4px',
              text: meta.nom + '  ·  ' + ou + (quoi ? '  ·  ' + quoi : '') })),
          h.aff ? el('button', { class: 'b mini danger', text: 'Libérer',
              onclick: () => { window.Etat.libererHabitant(h.id); rafraichirVillage(); } })
                : el('button', { class: 'b mini', text: 'Au chantier',
              onclick: () => { window.Etat.affecterChantier(h.id); rafraichirVillage(); } })),
        el('div', { style: 'margin-top:8px' }, bandeTraits(h)),
        el('div', { style: 'margin-top:8px' }, U.barre(prog, 'bleu', 'expérience',
          U.fmt(h.xp || 0) + ' / ' + U.fmt(window.Etat.xpPourNiveau(h.niv || 1)))),
        el('div', { class: 'rangee entre', style: 'margin-top:8px' },
          el('span', { class: 'note', style: 'font-size:10.5px',
            text: 'Arrivé au bourg il y a ' + U.duree(E2.tJeu - (h.arrive || 0)) + '.' }),
          el('button', { class: 'b mini danger', text: 'Renvoyer',
            title: 'Le faire partir. Le bourg le prendra très mal.',
            onclick: () => confirmerRenvoi(h) }))));
    }
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
          el('div', { class: 'av' }, U.ico(meta.ico, 20)),
          el('div', { style: 'flex:1;min-width:0' },
            el('div', { class: 'rangee entre' },
              el('span', { class: 'tt', style: 'font-size:14px', text: meta.nom }),
              el('span', { class: 'eti-or', text: 'rang ' + p.rang })),
            el('div', { style: 'margin-top:7px' },
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
          gens.length ? el('div', { class: 'eti', style: 'margin-top:5px',
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

    c.appendChild(U.stats([
      ['toits libres', pl, pl ? 'bon' : 'mauvais'],
      ['coût d\'accueil', cout + ' portions', vivres >= cout ? '' : 'mauvais'],
      ['attrait du bourg', '×' + (1 + attrait).toFixed(2).replace('.', ','), attrait > 0.6 ? 'bon' : ''],
      ['accueillis', E2.portes.accueillis || 0],
    ]));

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
    const lg = el('div', { class: 'rangee enroule', style: 'margin-top:7px' });
    for (const x of poids)
      lg.appendChild(el('span', { class: 'rarete r-' + x.id,
        text: x.R.nom + ' ' + (x.w / tot * 100).toFixed(1).replace('.', ',') + ' %' }));
    c.appendChild(lg);
    c.appendChild(el('div', { class: 'note',
      text: 'Le moral, la taverne, la chapelle et le donjon font venir du meilleur monde. Chaque renvoi, lui, abîme la réputation du bourg pour de bon.' }));

    /* --- les trois postulants --- */
    if (E2.portes.postulants) {
      c.appendChild(U.section('Trois voyageurs à la porte'));
      c.appendChild(el('div', { class: 'note',
        text: 'Vous en gardez un. Les deux autres reprennent la route et ne reviendront pas.' }));
      const g = el('div', { class: 'postulants' });
      for (let k = 0; k < E2.portes.postulants.length; k++) g.appendChild(cartePostulant(k));
      c.appendChild(g);
      c.appendChild(el('button', { class: 'b danger large', text: 'Les renvoyer tous les trois',
        title: 'Les portes resteront closes deux minutes.',
        onclick: () => { window.Etat.refuserTous(); rafraichirVillage(); } }));
      return;
    }

    c.appendChild(U.section('Ouvrir'));
    const v = window.Etat.peutOuvrirPortes();
    if (barre > 0) {
      c.appendChild(el('div', { class: 'cadre alerte' },
        el('div', { class: 'tt', style: 'font-size:14px', text: 'Les portes sont closes' }),
        el('div', { class: 'note mauvais', style: 'margin-top:5px',
          text: 'La rumeur court encore. Personne ne se présentera avant ' + U.duree(barre) + '.' }),
        el('div', { style: 'margin-top:9px' },
          U.barre(1 - barre / Math.max(1, 180 * Math.pow(1.35, Math.min(6, (E2.portes.renvois || 1) - 1))),
            'grande rouge', 'réputation', U.duree(barre)))));
    }
    c.appendChild(el('button', {
      class: 'b primaire large', disabled: !v.ok,
      text: v.ok ? 'Ouvrir les portes  —  ' + cout + ' portions' : 'Impossible d\'ouvrir',
      onclick: () => { window.Etat.ouvrirPortes(); rafraichirVillage(); } }));
    if (!v.ok) c.appendChild(el('div', { class: 'note mauvais', text: v.pourquoi }));
    else c.appendChild(el('div', { class: 'note',
      text: 'On nourrit d\'avance la bouche de plus : ' + cout + ' portions sortent de la grange, quel que soit celui qu\'on garde.' }));

    if (E2.malaise && E2.malaise.reste) c.appendChild(el('div', { class: 'cadre alerte' },
      el('div', { class: 'tt', style: 'font-size:14px', text: 'Le bourg fait la tête' }),
      el('div', { class: 'note mauvais', style: 'margin-top:5px',
        text: 'Tout le monde travaille ' + Math.round((1 - window.Etat.facteurMalaise()) * 100) +
              ' % moins vite. Cela passera dans ' + U.duree(E2.malaise.reste) + '.' }),
      el('div', { style: 'margin-top:9px' },
        U.barre(1 - E2.malaise.reste / Math.max(1, E2.malaise.total || 1), 'grande rouge',
          'apaisement', U.duree(E2.malaise.reste)))));
  }

  function cartePostulant(k) {
    const p = E().portes.postulants[k];
    const R = window.HAB.RARETES[p.rarete];
    const meta = window.METIERS[p.talent] || { nom: '—', ico: { f: 'cube', c: ['#8a8272'] } };
    return el('div', { 'data-cle': 'p' + k, class: 'postulant r-' + p.rarete },
      el('div', { class: 'liseret', style: 'background:' + R.col }),
      el('div', { class: 'rangee entre' },
        etiqRarete(p),
        el('span', { class: 'niv', text: 'niv ' + p.niv })),
      el('div', { class: 'rangee', style: 'margin-top:8px' },
        el('div', { class: 'av or' }, U.ico(meta.ico, 20)),
        el('div', { style: 'flex:1;min-width:0' },
          el('div', { class: 'tt', style: 'font-size:15px', text: p.nom }),
          el('div', { class: 'eti', style: 'margin-top:3px',
            text: meta.nom + '  ·  +' + (p.rarete === 'legende' ? 35 : 20) + ' %' }))),
      el('div', { style: 'margin-top:9px' }, bandeTraits(p)),
      el('button', { class: 'b primaire large', style: 'margin-top:10px', text: 'L\'accueillir',
        onclick: () => { window.Etat.accueillir(k); rafraichirVillage(); } }));
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
        c.appendChild(el('div', { class: 'rangee', style: 'margin-top:10px' },
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
      onglets: [
        { id: 'general', nom: 'Bourg', rendu: rendreBourg },
        { id: 'acquis', nom: 'Acquis', rendu: rendreAcquis },
        { id: 'auto', nom: 'Contremaîtres', rendu: rendreAuto },
        { id: 'objectifs', nom: 'Objectifs', rendu: rendreObjectifs },
        { id: 'charte', nom: 'La charte', rendu: rendreCharte },
        { id: 'menace', nom: 'Menace', rendu: rendreMenace },
        { id: 'journal', nom: 'Journal', rendu: rendreJournal },
        { id: 'partie', nom: 'Partie', rendu: rendrePartie },
      ],
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
    l('Territoires', E2.territoires.length);
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
            el('div', { class: 'note', style: 'margin-top:3px', text: x.desc })),
          pris ? U.bascule(on, v => { window.Auto.basculer(x.id, v); })
               : null),
        el('div', { class: 'note faible', style: 'margin-top:5px', text: x.note }),
        pris ? null : el('div', { class: 'rangee entre', style: 'margin-top:9px;flex-wrap:wrap' },
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
        el('div', { class: 'note', style: 'margin-top:6px',
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
        pr ? null : el('div', { class: 'rangee enroule', style: 'margin-top:7px' },
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
      el('div', { style: 'margin-top:9px' },
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

    /* --- la sortie --- */
    c.appendChild(U.section('Sortir à sa rencontre'));
    const v = window.Jeu.sortiePossible();
    const gain = window.Jeu.gainSortie();
    const z = window.Expedition && window.Expedition.zoneSortie ? window.Expedition.zoneSortie() : null;
    const f = (z && window.Expedition.forces) ? window.Expedition.forces(z) : null;
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'note',
        text: "Attendre les cent points, c'est subir le raid chez soi. Sortir, c'est choisir son moment : les murs restent intacts, la jauge retombe pour de bon, et l'on ramasse ce que la colonne transportait." }),
      f ? U.stats([
        ['menace après', Math.max(0, Math.floor(E2.menace - gain)), 'bon'],
        ['le bourg aligne', f.bourg, f.bourg >= f.nuee ? 'bon' : 'mauvais'],
        ['la Nuée aligne', f.nuee],
        ['bras engagés', z.cout.unites + ' / ' + E2.armee.unites,
          E2.armee.unites >= z.cout.unites ? '' : 'mauvais'],
      ]) : null,
      z ? el('div', { style: 'margin-top:9px' },
        el('div', { class: 'eti', text: 'ce qu\'on ramassera' }),
        U.listeRes(z.butin, { gain: true })) : null,
      el('button', { class: 'b primaire large', style: 'margin-top:10px',
        disabled: !v.ok, text: v.ok ? 'Faire une sortie' : 'Sortie impossible',
        onclick: () => { U.fermerTout(); window.Expedition.lancerSortie(); } }),
      v.ok ? null : el('div', { class: 'note mauvais', style: 'margin-top:6px', text: v.pourquoi })));

    /* --- la défense passive --- */
    c.appendChild(U.section('Si on ne sort pas'));
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', text: 'Défense ' + window.Jeu.defenseTotale() }),
        el('span', { class: 'eti', text: 'contre ' + (40 + E2.territoires.length * 14 + E2.raids * 6) + ' attendus' })),
      el('div', { class: 'note', style: 'margin-top:6px',
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
          expl ? el('div', { class: 'note', style: 'margin-top:3px', text: expl }) : null),
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
      ['H', 'habitants'], ['B', 'le bourg'], ['G', 'réglages'], ['W', 'tout fermer'],
      ['Échap', 'fermer la fenêtre du dessus / annuler une pose']])
      t.appendChild(el('tr', {}, el('th', { text: k }), el('td', { text: v })));
    c.appendChild(el('div', { class: 'cadre creux' }, t));
  }

  function rendreReglagesBourg(c) {
    const E2 = E();
    const champ = el('input', { class: 's', value: window.Village ? window.Village.nom() : '', maxlength: 34 });
    c.appendChild(el('div', { class: 'cadre' },
      el('div', { class: 'tt', style: 'font-size:13px', text: 'Nom du bourg' }),
      el('div', { class: 'note', style: 'margin:3px 0 8px',
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
      ['territoires', E2.territoires.length],
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
      el('div', { style: 'margin-top:9px' },
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
    entrerConstruction, quitterConstruction, poserIci,
    get typeAPoser() { return typeAPoser; },
  };
  U.quitterConstruction = quitterConstruction;

  function rafraichirVillage() {
    if (window.App && window.App.majAffectations) window.App.majAffectations();
  }

})();
