/* ============================================================
   LE BOURG — js/ui-bulles.js
   LES BULLES DE CONSTRUCTION. Quand le maître d'œuvre apprend un
   nouveau plan, il n'attend plus qu'on ouvre le carnet : le bâtiment
   apparaît dans une bulle en bas de l'écran, avec une pastille tant
   qu'on n'y a pas touché. Un clic, et l'on désigne la parcelle.

   Pour la MAISON, le clic ouvre d'abord la palette : c'est le joueur
   qui choisit la couleur de ses murs, comme dans le bourg flottant.
   ============================================================ */
"use strict";
(function () {

  const U = () => window.UI, el = (...a) => window.UI.el(...a);
  const E = () => window.Etat.E;

  /* la palette des maisons — la même table que le rendu 3D */
  const PAL = [
    '#f4ead4','#f6cd72','#e8a03c','#dd6f3f','#c33c33','#e58f9b',
    '#9a5b8e','#4d6fa3','#57a19c','#7ba05b','#f2f1e9','#93918a','#5d4a3c'
  ];
  let coulMaison = 3;

  let barre = null, rail = null, paletteEl = null, nav = null, filtres = null;
  let onglet = 'batir', famille = 'recolte', replie = true;

  function construire() {
    const couche = document.getElementById('couche');
    paletteEl = el('div', { id: 'bulles-palette' });
    nav = el('div', { id: 'bulles-nav' });
    filtres = el('div', { id: 'bulles-filtres' });
    rail = el('div', { id: 'bulles-rail' });
    barre = el('div', { id: 'bulles' }, paletteEl,
      el('div', { id: 'chantier-bas' }, nav, filtres, rail));
    couche.appendChild(barre);
    rendrePalette();
    rendre();

    window.Etat.abonner((quoi, data) => {
      if (quoi === 'deblocage' || quoi === 'construit' || quoi === 'chantier') rendre();
    });
    /* l'accessibilité des coûts bouge sans événement : on rafraîchit doucement */
    setInterval(rendre, 1500);
  }

  function rendrePalette() {
    U().vide(paletteEl);
    PAL.forEach((hex, i) => {
      const b = el('button', {
        class: 'nuance' + (i === coulMaison ? ' choisie' : ''),
        title: 'Couleur des murs',
        onclick: () => {
          coulMaison = i;
          rendrePalette();
          /* si l'on est déjà en train de poser une maison, la couleur
             suit le choix sans refaire le trajet */
          if (window.UIFen.typeAPoser === 'maison')
            window.UIFen.entrerConstruction('maison', { coul: i });
        },
      });
      b.style.background = hex;
      paletteEl.appendChild(b);
    });
    paletteEl.classList.remove('vu');
  }

  /* LES FAMILLES. Le joueur ne cherche pas « le bâtiment n° 31 » : il
     cherche « de quoi produire », « de quoi ranger », « de quoi tenir
     un siège ». On range dans cet ordre-là, et l'on n'affiche un
     intertitre que si la famille a quelque chose dedans. */
  const FAMILLES = [
    { id: 'recolte', nom: 'Récolte',  cats: ['recolte'] },
    { id: 'atelier', nom: 'Ateliers', cats: ['atelier'] },
    { id: 'vie',     nom: 'Vivre',    cats: ['vie', 'stock', 'commerce'] },
    { id: 'guerre',  nom: 'Défense',  cats: ['guerre', 'porte'] },
  ];

  function rendre() {
    if (!rail) return;
    const types = window.Jeu.catalogue();
    const file = E().chantier.file, ouvriers = E().chantier.ouvriers;

    U().rendreDans(nav, hote => {
      const tab = (id, texte) => el('button', { 'data-cle': id,
        class: 'chantier-tab' + (onglet === id ? ' on' : ''), text: texte,
        onclick: () => { onglet = id; replie = false; rendre(); } });
      hote.appendChild(tab('batir', 'Bâtir'));
      hote.appendChild(tab('file', 'File' + (file.length ? ' · ' + file.length : '')));
      hote.appendChild(tab('bras', 'Ouvriers' + (ouvriers.length ? ' · ' + ouvriers.length : '')));
      hote.appendChild(el('button', { class: 'chantier-carnet', title: 'Ouvrir le carnet complet',
        'aria-label': 'Ouvrir le carnet complet', text: '↗',
        onclick: () => window.UIFen.ouvrirChantier(onglet) }));
      hote.appendChild(el('button', { class: 'chantier-replier',
        title: replie ? 'Déplier le chantier' : 'Replier le chantier',
        'aria-label': replie ? 'Déplier le chantier' : 'Replier le chantier',
        text: replie ? '⌃' : '⌄', onclick: () => { replie = !replie; rendre(); } }));
    });
    barre.classList.toggle('replie', replie);

    U().rendreDans(filtres, hote => {
      if (replie || onglet !== 'batir') return;
      const presentes = FAMILLES.filter(f => types.some(t => f.cats.indexOf(window.BAT[t].cat) >= 0));
      if (!presentes.some(f => f.id === famille) && presentes.length) famille = presentes[0].id;
      for (const f of presentes) hote.appendChild(el('button', { 'data-cle': f.id,
        class: 'chantier-filtre' + (famille === f.id ? ' on' : ''), text: f.nom,
        onclick: () => { famille = f.id; rendre(); } }));
    });

    U().rendreDans(rail, hote => {
      if (replie) return;
      if (onglet === 'file') { rendreFileCompacte(hote); return; }
      if (onglet === 'bras') { rendreOuvriersCompacts(hote); return; }
      const fam = FAMILLES.find(f => f.id === famille);
      const lot = fam ? types.filter(t => fam.cats.indexOf(window.BAT[t].cat) >= 0) : [];
      for (const t of lot) hote.appendChild(bulle(t));
      if (!lot.length) hote.appendChild(el('div', { class: 'chantier-vide', text: 'Aucun plan dans cette famille.' }));
    });
  }

  function rendreFileCompacte(hote) {
    const f = E().chantier.file;
    if (!f.length) {
      hote.appendChild(el('div', { class: 'chantier-vide', text: 'Aucun ouvrage en attente.' }));
      hote.appendChild(el('button', { class: 'chantier-action', text: 'Choisir un plan',
        onclick: () => { onglet = 'batir'; rendre(); } }));
      return;
    }
    f.forEach((job, i) => {
      const pct = i === 0 ? Math.min(1, E().chantier.prog / job.temps) : 0;
      hote.appendChild(el('button', { class: 'chantier-job', title: job.nom + ' — ouvrir la file',
        onclick: () => window.UIFen.ouvrirChantier('file') },
        el('span', { text: job.nom }),
        el('i', {}, el('b', { style: 'width:' + (pct * 100).toFixed(1) + '%' })),
        el('small', { text: i ? 'en attente' : Math.round(pct * 100) + '%' })));
    });
    hote.appendChild(el('button', { class: 'chantier-action', text: 'Gérer la file',
      onclick: () => window.UIFen.ouvrirChantier('file') }));
  }

  function rendreOuvriersCompacts(hote) {
    const affectes = E().chantier.ouvriers;
    const libres = window.Etat.habitantsLibres();
    hote.appendChild(el('div', { class: 'chantier-bras' },
      el('b', { text: affectes.length + '' }),
      el('span', { text: 'au chantier' }),
      el('i', { text: libres.length + ' libre' + (libres.length > 1 ? 's' : '') })));
    hote.appendChild(el('button', { class: 'chantier-action primaire', text: '+ Affecter',
      disabled: !libres.length || !E().chantier.file.length,
      title: !E().chantier.file.length ? 'Aucun ouvrage en file' : 'Affecter le premier habitant libre',
      onclick: () => {
        const h = window.Etat.habitantsLibres()[0]; if (!h) return;
        window.Etat.affecterChantier(h.id);
        if (window.App) { window.App.majAffectations(); window.App.rafraichirUI(); }
        rendre();
      } }));
    hote.appendChild(el('button', { class: 'chantier-action', text: '− Retirer', disabled: !affectes.length,
      onclick: () => {
        const id = E().chantier.ouvriers[E().chantier.ouvriers.length - 1];
        if (id) window.Etat.libererHabitant(id);
        if (window.App) { window.App.majAffectations(); window.App.rafraichirUI(); }
        rendre();
      } }));
    hote.appendChild(el('button', { class: 'chantier-action', text: 'Gérer',
      onclick: () => window.UIFen.ouvrirChantier('bras') }));
  }

  function bulle(t) {
    const def = window.BAT[t];
    const cout = window.Jeu.coutConstruction(t);
    const abordable = window.Etat.assez(cout);
    const nouveau = !E().vus['bulle:' + t];
    const metier = window.METIERS[def.metier] ? def.metier
      : Object.keys(window.METIERS).find(m => window.METIERS[m].nom === def.metier);
    const ico = metier && window.METIERS[metier] ? window.METIERS[metier].ico
      : { f: 'marteau', c: ['#8d9199', '#5a5e66'] };

    /* L'INFOBULLE DIT CE QU'IL MANQUE. « 12 planches, 8 pierre de
       taille » n'aide pas : ce qu'on veut savoir, c'est pourquoi la
       bulle est grise et combien il reste à trouver. */
    const lignes = [def.nom, def.desc];
    if (Object.keys(cout).length) {
      lignes.push('');
      for (const k in cout) {
        const il = Math.floor(window.Etat.qte(k));
        const nom = window.RES[k] ? window.RES[k].nom : k;
        lignes.push('· ' + nom + ' : ' + il + ' / ' + cout[k] +
                    (il < cout[k] ? '  (il manque ' + (cout[k] - il) + ')' : ''));
      }
    } else lignes.push('Ne coûte rien.');
    if (!abordable) lignes.push('Matériaux insuffisants — la bulle reste grise.');

    return el('button', {
      'data-cle': t,
      class: 'bulle' + (abordable ? '' : ' pauvre') + (nouveau ? ' neuve' : ''),
      title: lignes.join('\n'),
      onclick: () => choisir(t),
    },
      U().ico(ico, 22),
      el('span', { class: 'n', text: def.nom }),
      nouveau ? el('i', { class: 'point' }) : null);
  }

  function choisir(t) {
    E().vus['bulle:' + t] = true;
    if (t === 'maison') {
      /* la palette se déplie au-dessus des bulles, et la pose démarre
         avec la couleur courante — changer de nuance en cours de visée
         est permis, et même recommandé */
      paletteEl.classList.add('vu');
      window.UIFen.entrerConstruction('maison', { coul: coulMaison });
    } else {
      paletteEl.classList.remove('vu');
      window.UIFen.entrerConstruction(t);
    }
    rendre();
  }

  /* quitter la construction replie la palette */
  const _quitter = window.UI.quitterConstruction;
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && paletteEl) paletteEl.classList.remove('vu');
  });

  window.UIBulles = { construire, rendre,
    get couleur() { return coulMaison; } };

})();
