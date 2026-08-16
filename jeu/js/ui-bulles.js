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

  let barre = null, rail = null, paletteEl = null;

  function construire() {
    const couche = document.getElementById('couche');
    paletteEl = el('div', { id: 'bulles-palette' });
    rail = el('div', { id: 'bulles-rail' });
    barre = el('div', { id: 'bulles' }, paletteEl, rail);
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

  function rendre() {
    if (!rail) return;
    const types = window.Jeu.catalogue();
    U().rendreDans(rail, hote => {
      for (const t of types) {
        const def = window.BAT[t];
        const cout = window.Jeu.coutConstruction(t);
        const abordable = window.Etat.assez(cout);
        const nouveau = !E().vus['bulle:' + t];
        const metier = window.METIERS[def.metier] ? def.metier
          : Object.keys(window.METIERS).find(m => window.METIERS[m].nom === def.metier);
        const ico = metier && window.METIERS[metier] ? window.METIERS[metier].ico
          : { f: 'marteau', c: ['#8d9199', '#5a5e66'] };
        const titre = def.nom + ' — ' +
          (Object.keys(cout).length
            ? Object.keys(cout).map(k => cout[k] + ' ' + (window.RES[k] ? window.RES[k].nom.toLowerCase() : k)).join(', ')
            : 'ne coûte rien');
        hote.appendChild(el('button', {
          'data-cle': t,
          class: 'bulle' + (abordable ? '' : ' pauvre') + (nouveau ? ' neuve' : ''),
          title: titre,
          onclick: () => choisir(t),
        },
          U().ico(ico, 22),
          el('span', { class: 'n', text: def.nom }),
          nouveau ? el('i', { class: 'point' }) : null));
      }
    });
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
