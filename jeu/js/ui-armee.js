/* ============================================================
   LE BOURG — js/ui-armee.js
   Caserne : effectifs typés, colonne d'expédition et techniques.
   ============================================================ */
"use strict";
(function () {
  const U = window.UI, el = U.el;
  const A = () => window.Armee;
  const E = () => window.Etat.E;
  const GD = () => window.GameData;
  const rafraichir = bid => window.UIFen.ouvrirBatiment(bid);

  function carteUnite(t, bid, compacte) {
    const a = E().armee, d = GD().UNIT_TYPES[t], s = A().stats(t);
    const n = a.types[t] || 0, rang = a.rangs[t] || 0;
    const actif = a.composition.indexOf(t) >= 0;
    const p = A().pouvoirActif(t);
    const illustration = window.Img && window.Img.unite ? window.Img.unite(t) : null;
    return el('div', { class: 'carte-unite' + (actif ? ' en-colonne' : '') },
      illustration
        ? el('div', { class: 'unite-sceau unite-image cat-' + d.cat },
            window.Img.vignette(illustration, 64, A().nom(t), 'vig-unite'),
            el('span', { class: 'unite-quantite', text: String(n) }))
        : el('div', { class: 'unite-sceau cat-' + d.cat, text: String(n) }),
      el('div', { class: 'unite-corps' },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', text: A().nom(t) }),
          el('span', { class: 'niv', text: 'rang ' + rang })),
        el('div', { class: 'eti', text: (GD().CATS_META[d.cat] || {}).name || d.cat }),
        compacte ? null : el('div', { class: 'unite-stats' },
          el('span', { text: Math.round(s.hp) + ' PV' }),
          el('span', { text: Math.round(s.dmg * 10) / 10 + ' dégâts' }),
          el('span', { text: s.range > 0 ? Math.round(s.range) + ' portée' : 'mêlée' })),
        p ? el('div', { class: 'unite-technique', text: p.name }) :
            el('div', { class: 'unite-technique faible', text: 'aucune technique active' })),
      el('button', { class: 'b mini' + (actif ? ' primaire' : ''),
        text: actif ? 'Dans la colonne' : 'Ajouter',
        title: actif ? 'Retirer cette formation de la prochaine bataille' : 'Aligner cette formation lors de la prochaine bataille',
        onclick: () => {
          if (!A().basculer(t)) U.dire('La colonne accepte cinq formations au maximum.', 'alerte');
          rafraichir(bid);
        } }));
  }

  function rendreEffectifs(c, bid) {
    A().assure();
    const possedes = A().typesPossedes();
    c.appendChild(U.stats([
      ['unités formées', E().armee.unites],
      ['formations connues', possedes.length],
      ['dans la colonne', A().nombreColonne(), A().nombreColonne() ? 'bon' : 'mauvais'],
      ['puissance', Math.round(A().puissance())],
    ]));
    c.appendChild(el('div', { class: 'note' },
      'Chaque poste de caserne forme le type choisi dans sa liste de tâches. Les quatre premières formations ne coûtent que du bois et du poisson.'));
    c.appendChild(U.section('Effectifs', 'cliquez pour composer'));
    if (!possedes.length) c.appendChild(el('div', { class: 'vide', text: 'Aucune unité. Affectez un habitant puis choisissez une formation dans son poste.' }));
    const liste = el('div', { class: 'liste-unites' });
    for (const t of possedes) liste.appendChild(carteUnite(t, bid, false));
    c.appendChild(liste);
    c.appendChild(U.section('Formations à découvrir'));
    const niv = (Object.values(E().bat).find(b => b.type === 'caserne') || {}).niv || 1;
    const prochains = (GD().UNIT_ORDER || []).filter(t => !GD().UNIT_TYPES[t].juvenile && possedes.indexOf(t) < 0).slice(0, 8);
    for (const t of prochains) {
      const rec = window.REC['former_' + t];
      c.appendChild(el('div', { class: 'rangee entre ligne-deblocage' },
        el('span', { text: A().nom(t) }),
        el('span', { class: rec && rec.niv <= niv ? 'eti-or' : 'eti',
          text: rec && rec.niv <= niv ? 'formation disponible aux postes' : 'caserne niveau ' + (rec ? rec.niv : '?') })));
    }
  }

  function rendreTechniques(c, bid) {
    A().assure();
    c.appendChild(el('div', { class: 'note' },
      'Une formation n’emporte qu’une technique active. Elle gagne des rangs en combattant et à l’entraînement ; de nouvelles techniques s’ouvrent aux rangs 8, 10, 14, 18 et 20.'));
    const possedes = A().typesPossedes();
    if (!possedes.length) { c.appendChild(el('div', { class: 'vide', text: 'Formez d’abord une unité.' })); return; }
    for (const t of possedes) {
      const rang = E().armee.rangs[t] || 0;
      const actif = A().pouvoirActif(t);
      c.appendChild(U.section(A().nom(t), 'rang ' + rang));
      const pouvoirs = (GD().UNIT_POWERS || {})[t] || [];
      if (!pouvoirs.length) c.appendChild(el('div', { class: 'note faible', text: 'Cette formation n’a pas encore de doctrine propre.' }));
      for (const p of pouvoirs) {
        const ouvert = rang >= (p.unlockEvo || 0), choisi = actif && actif.id === p.id;
        c.appendChild(el('div', { class: 'cadre technique' + (choisi ? ' actif' : (!ouvert ? ' mort' : '')) },
          el('div', { class: 'rangee entre' },
            el('span', { class: 'tt', text: p.name }),
            choisi ? el('span', { class: 'niv', text: 'active' }) :
              el('button', { class: 'b mini', text: ouvert ? 'Activer' : 'rang ' + p.unlockEvo,
                disabled: !ouvert, onclick: () => { A().choisirPouvoir(t, p.id); rafraichir(bid); } })),
          el('div', { class: 'note', text: p.desc })));
      }
    }
  }

  function rendreColonne(c, bid) {
    A().assure();
    const ligne = A().colonne();
    c.appendChild(U.stats([
      ['formations', ligne.length + ' / 5'], ['soldats', A().nombreColonne()],
      ['puissance estimée', Math.round(A().puissance(ligne))],
      ['arme / armure', (E().armee.palierArme || 0) + ' / ' + (E().armee.palierArmure || 0)],
    ]));
    c.appendChild(el('div', { class: 'note' },
      'C’est cette colonne — et seulement elle — qui part en expédition. Les unités laissées au bourg ne risquent aucune perte.'));
    for (const x of ligne) c.appendChild(carteUnite(x.type, bid, true));
    if (!ligne.length) c.appendChild(el('div', { class: 'vide', text: 'La colonne est vide. Ajoutez une formation depuis l’onglet Effectifs.' }));
  }

  window.UIArmee = { rendreEffectifs, rendreTechniques, rendreColonne, carteUnite };
})();
