/* ============================================================
   LE BOURG — js/ui-compagnie.js
   L'ÉCRAN DE LA COMPAGNIE.

   Le moteur de descente conservé sait tout faire — équiper, dépenser
   des talents, changer de posture — mais il n'avait pas d'écran. Le
   voici : un onglet par membre, et pour chacun trois pages qui
   répondent à trois questions différentes.

     · CE QU'IL PORTE   — sept emplacements, et le sac rapporté du fond.
     · CE QU'IL SAIT    — trois branches, deux voies exclusives.
     · COMMENT IL SE BAT — sa posture, lue par l'arène.
   -> window.UICompagnie
   ============================================================ */
"use strict";
(function () {

  const U = window.UI, el = U.el;
  const G = () => window.GameState;
  const GD = () => window.GameData;

  const COUL_RARETE = { commun: '#8b8378', inhabituel: '#4f9a52', rare: '#3d7ab8',
                        epique: '#8a56c0', legendaire: '#d08a20' };

  /* Les tables héritées portent les noms PAR CAMP : `{cats, birds}`. Le
     bourg est du côté des griffes ; on résout donc toujours par le camp
     de la partie, jamais en affichant l'objet brut. */
  function nomDe(x) {
    if (x == null) return '';
    if (typeof x === 'string') return x;
    const f = (G().state && G().state.faction) || 'cats';
    return x[f] || x.cats || x.birds || '';
  }
  function membres() {
    const g = G().gen();
    const l = [{ id: '__general', nom: 'Le maître d\'œuvre', cls: 'general', lvl: g.lvl }];
    /* ATTENTION : `roster` contient des FICHES, `party` des identifiants.
       Les confondre fait disparaître tous les compagnons de l'écran. */
    for (const fiche of g.roster) {
      const hid = fiche && fiche.id;
      const def = hid && GD().heroById(hid), hs = hid && G().heroState(hid);
      if (def && hs) l.push({ id: hid, nom: nomDe(def.name), cls: def.cls, lvl: hs.lvl || 1, def });
    }
    return l;
  }

  let choisi = '__general';

  function ouvrir(qui) {
    if (qui) choisi = qui;
    U.ouvrir('compagnie', {
      titre: 'La compagnie', sous: 'Ce qu\'elle porte et ce qu\'elle sait', classe: 'large',
      sousVif: () => {
        const g = G().gen();
        return (1 + g.roster.length) + ' membres  ·  ' + g.party.length + ' en ligne';
      },
      onglets: [
        { id: 'equipement', nom: 'Équipement', rendu: rendreEquipement },
        { id: 'talents', nom: 'Talents', rendu: rendreTalents },
        { id: 'posture', nom: 'Postures', rendu: rendrePostures },
        { id: 'sac', nom: 'Le sac', rendu: rendreSac },
      ],
    });
  }

  /* Le sélecteur de membre, en tête de chaque page. */
  function selecteur(c) {
    const l = membres();
    /* un membre par bouton, nom entier : « Le » ne dit rien à personne. */
    c.appendChild(U.segments(l.map(m => ({
      v: m.id,
      n: m.id === '__general' ? 'Maître d\'œuvre' : m.nom,
      t: m.nom + '  ·  niveau ' + m.lvl,
    })), choisi, v => { choisi = v; U.ouvrir('compagnie', {}); }));
    const m = l.find(x => x.id === choisi) || l[0];
    choisi = m.id;
    const st = G().combatStats(m.id);
    c.appendChild(U.stats([
      ['niveau', m.lvl],
      ['PV', Math.round(st.hp || 0)],
      ['dégâts', Math.round((st.dmg || 0) * 10) / 10],
      ['armure', Math.round(st.armor || 0)],
      ['vitesse', Math.round(st.mspd || 0)],
      ['portée', Math.round(st.range || 0)],
    ]));
    return m;
  }

  /* =================================================================
     CE QU'IL PORTE
     ================================================================= */
  function libelleObjet(it) {
    const b = GD().baseById(it.base);
    const nom = b ? (nomDe(b.cats) || nomDe(b.name) || it.base) : it.base;
    return nom + '  ·  T' + it.tier;
  }
  function carteObjet(it, actions) {
    const R = GD().rarityById(it.rarity);
    const col = COUL_RARETE[it.rarity] || '#8b8378';
    const lignes = el('div', { class: 'rangee enroule', style: 'margin-top:4px' });
    if (it.stat) lignes.appendChild(el('span', { class: 'puce mini gain',
      text: GD().genStatFmt ? (it.stat + ' ' + Math.round(it.power)) : ('+' + Math.round(it.power)) }));
    for (const L of (it.lines || [])) {
      const def = GD().lineById ? GD().lineById(L.id) : null;
      lignes.appendChild(el('span', { class: 'puce mini',
        text: def && GD().lineFmt ? GD().lineFmt(def, L.val) : (L.id + ' ' + Math.round(L.val)) }));
    }
    const carte = el('div', { class: 'cadre', style: 'border-left:3px solid ' + col },
      el('div', { class: 'rangee entre' },
        el('span', { class: 'tt', style: 'font-size:13px', text: libelleObjet(it) }),
        el('span', { class: 'eti', style: 'color:' + col, text: R.name })),
      lignes);
    if (actions) carte.appendChild(el('div', { class: 'rangee enroule', style: 'margin-top:8px' }, actions));
    return carte;
  }

  function rendreEquipement(c) {
    const m = selecteur(c);
    const g = G().gen();
    const holder = m.id === '__general' ? g : G().heroState(m.id);
    if (!holder) return;
    if (!holder.gear) holder.gear = {};
    const slots = GD().GENERAL.slots;
    c.appendChild(U.section('Ce qu\'il porte'));
    for (const s of slots) {
      const it = holder.gear[s];
      const nomS = GD().GENERAL.slotName[s] || s;
      if (it) {
        c.appendChild(carteObjet(it,
          el('button', { class: 'b mini danger', text: 'Retirer', onclick: () => {
            G().unequipItem(s, m.id === '__general' ? null : m.id);
            U.ouvrir('compagnie', {});
          } })));
        c.lastChild.insertBefore(el('div', { class: 'eti', text: nomS }), c.lastChild.firstChild);
      } else {
        c.appendChild(el('div', { class: 'cadre mort' },
          el('div', { class: 'rangee entre' },
            el('span', { class: 'eti', text: nomS }),
            el('span', { class: 'note faible', text: 'vide' }))));
      }
    }
  }

  function rendreSac(c) {
    const m = selecteur(c);
    const g = G().gen();
    c.appendChild(el('div', { class: 'note',
      text: 'Ce que la compagnie a rapporté du fond. Une pièce refusée l\'est pour une raison : chaque classe a ses armes.' }));
    if (!g.bag.length) {
      c.appendChild(el('div', { class: 'vide', html: 'Le sac est vide.<br>Il se remplit dans le Puits.' }));
      return;
    }
    const tri = g.bag.slice().sort((a, b) => (b.power || 0) - (a.power || 0));
    for (const it of tri) {
      const refus = GD().equipRefus(m.cls, it);
      c.appendChild(carteObjet(it, [
        el('button', { class: 'b mini primaire', text: refus ? 'refusé' : 'Équiper', disabled: !!refus,
          title: refus || '', onclick: () => {
            G().equipItem(it, m.id === '__general' ? null : m.id);
            U.ouvrir('compagnie', {});
          } }),
        el('button', { class: 'b mini danger', text: 'Vendre', onclick: () => {
          G().sellItem(it);
          const recu = G().viderSacoche();
          const n = Object.keys(recu)[0];
          U.dire(n ? 'Vendu contre ' + recu[n] + ' ' + window.RES[n].nom.toLowerCase() : 'Vendu.', 'bien');
          U.ouvrir('compagnie', {});
        } }),
        refus ? el('span', { class: 'note mauvais', text: refus }) : null,
      ]));
    }
  }

  /* =================================================================
     CE QU'IL SAIT
     ================================================================= */
  function rendreTalents(c) {
    const m = selecteur(c);
    const arbre = GD().talentTree(m.cls);
    const pts = G().talentPts(m.id);
    const engages = G().talentSpent(m.id);
    c.appendChild(el('div', { class: 'rangee entre' },
      el('span', { class: 'eti', text: engages + ' point(s) engagé(s)' }),
      el('span', { class: 'niv', text: pts + ' à dépenser' })));
    if (!arbre) { c.appendChild(el('div', { class: 'vide', text: 'Pas d\'arbre pour cette classe.' })); return; }
    const o = G().talentOwner(m.id);
    const pris = id => o && o.holder.talents.indexOf(id) >= 0;

    const bloc = (groupe, voie) => {
      c.appendChild(U.section(groupe.nom || groupe.name || groupe.id, voie ? 'voie' : ''));
      const description = groupe.desc || groupe.txt;
      if (description) c.appendChild(el('div', { class: 'note', text: description }));
      for (const n of groupe.nodes) {
        const dedans = pris(n.id);
        const refus = dedans ? null : G().talentRefus(m.id, n.id);
        const cout = GD().talentCostOf(m.cls, n.id);
        const RAISONS = { deja: 'déjà pris', exclu: 'un autre choix ferme celui-ci',
          autrevoie: 'vous avez choisi l\'autre voie', amont: 'un nœud plus haut est fermé',
          prerequis: 'il faut d\'abord celui qui précède', tropTot: 'il faut ' + GD().TALENT_SPEC_AT + ' points engagés',
          points: 'pas assez de points' };
        c.appendChild(el('div', { class: 'cadre' + (dedans ? ' actif' : (refus ? ' mort' : '')) },
          el('div', { class: 'rangee entre' },
            el('span', { class: 'tt', style: 'font-size:13px', text: n.nom || n.name || n.id }),
            dedans ? el('span', { class: 'niv', text: 'acquis' })
                   : el('button', { class: 'b mini primaire', text: 'Prendre (' + cout + ')',
                       disabled: !!refus, onclick: () => { G().spendTalent(m.id, n.id); U.ouvrir('compagnie', {}); } })),
          el('div', { class: 'note', style: 'margin-top:4px', text: n.desc || '' }),
          refus ? el('div', { class: 'note mauvais', style: 'margin-top:4px',
            text: RAISONS[refus.code] || refus.code }) : null));
      }
    };
    for (const b of arbre.branches) bloc(b, false);
    c.appendChild(U.section('Les voies', 'exclusives'));
    c.appendChild(el('div', { class: 'note',
      text: 'À partir de ' + GD().TALENT_SPEC_AT + ' points engagés, une seule des deux s\'ouvre — et elle se ferme sur l\'autre.' }));
    for (const s of (arbre.specs || GD().talentSpecs(m.cls) || [])) bloc(s, true);
  }

  /* =================================================================
     COMMENT IL SE BAT
     ================================================================= */
  function rendrePostures(c) {
    const m = selecteur(c);
    const l = GD().stancesFor(m.cls) || [];
    const o = G().talentOwner(m.id);
    const cour = (o && o.holder.stance) || GD().defaultStance(m.cls);
    c.appendChild(el('div', { class: 'note',
      text: 'La posture dit à l\'arène comment ce membre se comporte quand l\'IA tient la barre. Elle ne change rien quand vous jouez à la main.' }));
    for (const s of l) {
      c.appendChild(el('div', { class: 'cadre' + (s.id === cour ? ' actif' : ''), style: 'cursor:pointer',
        onclick: () => { G().setHeroStance(m.id, s.id); U.ouvrir('compagnie', {}); } },
        el('div', { class: 'rangee entre' },
          el('span', { class: 'tt', style: 'font-size:13px', text: s.name || s.nom || s.id }),
          s.id === cour ? el('span', { class: 'niv', text: 'en cours' }) : null),
        el('div', { class: 'note', style: 'margin-top:4px', text: s.desc || '' })));
    }
    if (!l.length) c.appendChild(el('div', { class: 'vide', text: 'Aucune posture pour cette classe.' }));
  }

  window.UICompagnie = { ouvrir, get choisi() { return choisi; } };

})();
