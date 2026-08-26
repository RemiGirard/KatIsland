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
    if (G().syncVillageParty) G().syncVillageParty();
    const g = G().gen();
    const l = [];
    /* La compagnie d'aventure est la sélection de la Tour, pas l'ancien
       catalogue de héros ni un maître d'œuvre ajouté en secret. */
    for (const fiche of g.roster.filter(x => x.village && g.party.indexOf(x.id) >= 0)) {
      const hid = fiche && fiche.id;
      const def = hid && GD().heroById(hid), hs = hid && G().heroState(hid);
      if (def && hs) l.push({ id: hid, nom: nomDe(def.name), cls: def.cls, lvl: hs.lvl || 1, def });
    }
    return l;
  }

  let choisi = null, atelierChoisi = null, trempeSlot = 0;

  function ouvrir(qui, onglet) {
    if (G().syncVillageParty) G().syncVillageParty();
    const l = membres();
    if (!l.length) {
      U.dire('Choisissez d’abord au moins un habitant pour la Tour.', 'alerte');
      return;
    }
    if (qui) choisi = qui;
    if (!l.some(m => m.id === choisi)) choisi = l[0].id;
    U.ouvrir('compagnie', {
      onglet:onglet || undefined,
      titre: 'Préparer la compagnie', sous: 'Habitants, équipement, talents et comportement', classe: 'large',
      sousVif: () => {
        const g = G().gen();
        return g.party.length + ' habitant' + (g.party.length > 1 ? 's' : '') + ' prêt' + (g.party.length > 1 ? 's' : '');
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
    if (!l.length) {
      c.appendChild(el('div', { class:'vide', text:'Aucun habitant n’est sélectionné pour la Tour.' }));
      return null;
    }
    /* un membre par bouton, nom entier : « Le » ne dit rien à personne. */
    c.appendChild(U.segments(l.map(m => ({
      v: m.id,
      n: m.nom,
      t: m.nom + '  ·  niveau ' + m.lvl,
    })), choisi, v => { choisi = v; U.ouvrir('compagnie', {}); }));
    const m = l.find(x => x.id === choisi) || l[0];
    choisi = m.id;
    const style = G().styleCombat ? G().styleCombat(m.id) : null;
    if (style) {
      const p = style.progression || { niveau:1, pct:0, dans:0, pour:20 };
      c.appendChild(el('div', { class:'maitrise-aventure' },
        el('div', { class:'rangee entre' },
          el('span', { class:'eti', text:style.equipe ? 'Style pratiqué' : 'Origine' }),
          el('b', { text:style.nom + (style.equipe ? ' · maîtrise ' + p.niveau : '') })),
        style.equipe
          ? el('div', { class:'maitrise-aventure-jauge' }, el('i', { style:'width:' + Math.round(p.pct * 100) + '%' }))
          : el('div', { class:'note', text:'Équipez une arme : elle définit le style, les dégâts, les pouvoirs et l’arbre qui progressera.' }),
        style.equipe ? el('small', { text:Math.round(p.dans) + ' / ' + Math.round(p.pour) + ' XP dans ce rang' }) : null));
    }
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
    const propre = it.nom || nom;
    return propre + '  ·  T' + it.tier + ((it.amelioration || 0) ? '  ·  +' + it.amelioration : '');
  }
  function illustrationObjet(it, taille) {
    const b = it && GD().baseById(it.base);
    const u = it && it.unique && GD().uniqueById ? GD().uniqueById(it.unique) : null;
    const src = (u && u.image) || (b && b.image);
    if (!src) return null;
    return el('img', { src, alt:'', class:'objet-aventure-art', onerror:function(){ if (b && b.image && this.src.indexOf(b.image) < 0) this.src=b.image; },
      style:'width:' + (taille || 62) + 'px;height:' + (taille || 62) + 'px' });
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
    if (G().assurerObjet) G().assurerObjet(it);
    const renfort = Math.max(0, Math.min(20, it.amelioration || 0));
    const carte = el('div', { class: 'cadre objet-renfort renfort-' + renfort,
      style: '--rarete:' + col + ';--renfort:' + renfort },
      el('div', { class: 'rangee entre' },
        el('div', { class:'rangee' }, illustrationObjet(it, 58),
          el('span', { class: 'tt', style: 'font-size:13px', text: libelleObjet(it) })),
        el('span', { class: 'eti', style: 'color:' + col, text: R.name + (renfort ? '  +' + renfort : '') })),
      lignes);
    if ((it.trempes || []).length) carte.appendChild(el('div',{class:'objet-trempes'},(it.trempes || []).map(t => {
      const d = GD().temperById && GD().temperById(t.id);
      return el('span',{text:(d ? d.nom : t.id) + ' · rang ' + (t.puissance || 1)});
    })));
    if (actions) carte.appendChild(el('div', { class: 'rangee enroule', style: 'margin-top:8px' }, actions));
    return carte;
  }

  function rendreEquipement(c) {
    const m = selecteur(c);
    if (!m) return;
    const g = G().gen();
    const holder = G().heroState(m.id);
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
            G().unequipItem(s, m.id);
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
    if (!m) return;
    const g = G().gen();
    c.appendChild(el('div', { class: 'note',
      text: 'Ce que la compagnie a rapporté du fond. Chaque habitant peut apprendre toutes les armes et porter toutes les armures.' }));
    const tresors = GD().TRESORS_AVENTURE || [];
    if (tresors.length) {
      c.appendChild(U.section('Trésors de la Tour', Object.keys(g.tresors || {}).length + ' / ' + tresors.length));
      const galerie = el('div',{class:'tresors-aventure'});
      for (const t of tresors) {
        const trouve = !!(g.tresors || {})[t.id];
        galerie.appendChild(el('div',{class:'tresor-aventure' + (trouve?' trouve':' cache'),title:trouve?t.desc:'Trésor encore inconnu'},
          el('img',{src:t.image,alt:''}),el('b',{text:trouve?t.nom:'Inconnu'}),
          trouve ? el('small',{text:Object.entries(t.bonus||{}).map(([k,v])=>'+'+Math.round(v*100)+' % '+({loot:'butin',rare:'rareté',xp:'expérience',speed:'exploration'}[k]||k)).join(' · ')}) : null));
      }
      c.appendChild(galerie);
    }
    if (!g.bag.length) {
      c.appendChild(el('div', { class: 'vide', html: 'Le sac est vide.<br>Il se remplit dans le Puits.' }));
      return;
    }
    const tri = g.bag.slice().sort((a, b) => (b.power || 0) - (a.power || 0));
    for (const it of tri) {
      const refus = G().equipRefus(it, m.id);
      c.appendChild(carteObjet(it, [
        el('button', { class: 'b mini primaire', text: refus ? 'refusé' : 'Équiper', disabled: !!refus,
          title: refus || '', onclick: () => {
            G().equipItem(it, m.id);
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

  function objetsPossedes() {
    if (G().syncVillageParty) G().syncVillageParty();
    const g = G().gen(), out = [];
    for (const it of (g.bag || [])) out.push({it,ou:'Sac'});
    const porteurs = [];
    for (const hs of (g.roster || []).filter(x=>x.village)) {
      const def=GD().heroById(hs.id);
      if (def) porteurs.push({holder:hs,nom:nomDe(def.name)});
    }
    for (const p of porteurs) for (const slot in (p.holder.gear || {})) {
      const it = p.holder.gear[slot]; if (it) out.push({it,ou:p.nom + ' · ' + (GD().GENERAL.slotName[slot] || slot)});
    }
    return out;
  }

  function rafraichirForge(bid) {
    if (window.UIFen && bid) window.UIFen.ouvrirBatiment(bid);
  }

  function rendreAtelier(c, mode, bid) {
    const l = objetsPossedes();
    c.appendChild(el('div',{class:'note',text:mode==='trempe'
      ? "La trempe grave un bonus de combat sur une pièce. Le second emplacement s’ouvre lorsque la pièce atteint +8."
      : "Le renforcement possède vingt niveaux et augmente toute la puissance de la pièce. Les matériaux profonds viennent des gardiens et des expéditions."}));
    if (!l.length) { c.appendChild(el('div',{class:'vide',text:'Aucune pièce à travailler. Descendez dans la Tour pour en trouver.'})); return; }
    if (!atelierChoisi || !l.some(x => x.it === atelierChoisi)) atelierChoisi = l[0].it;
    const bande = el('div',{class:'atelier-objets'});
    for (const x of l) bande.appendChild(el('button',{class:'atelier-objet' + (x.it === atelierChoisi ? ' actif' : ''),title:x.ou + ' · ' + libelleObjet(x.it),onclick:()=>{
      atelierChoisi=x.it; trempeSlot=0; rafraichirForge(bid);
    }},illustrationObjet(x.it,52),el('span',{text:'+' + (x.it.amelioration || 0)})));
    c.appendChild(bande);
    const it = atelierChoisi; if (G().assurerObjet) G().assurerObjet(it);
    c.appendChild(U.section('Pièce choisie'));
    c.appendChild(carteObjet(it));
    const max = GD().ITEM_UPGRADE_MAX || 20, niveau = it.amelioration || 0;
    if (mode !== 'trempe') {
      const cout = GD().itemUpgradeCost(it);
      c.appendChild(el('div',{class:'atelier-renfort'},
      el('div',{class:'rangee entre'},el('div',{},el('div',{class:'tt',text:'Renforcement ' + niveau + ' / ' + max}),
        el('div',{class:'eti',text:'Puissance totale × ' + (GD().itemUpgradeMult(it)).toFixed(2).replace('.',',')})),
        niveau >= max ? el('span',{class:'niv',text:'maximum'}) : null),
      el('div',{class:'renfort-paliers'},Array.from({length:20},(_,i)=>el('i',{class:i<niveau?'on':''}))),
      cout ? U.listeRes(cout,{verifier:true}) : null,
      niveau < max ? el('button',{class:'b primaire',text:'Renforcer en +' + (niveau + 1),disabled:!window.Etat.assez(cout),onclick:()=>{
        const r=G().upgradeItem(it); U.dire(r.ok?'Pièce renforcée en +' + r.niveau + '.':r.raison,r.ok?'bien':'alerte'); rafraichirForge(bid);
      }}) : null));
      return;
    }

    c.appendChild(U.section('Trempe', niveau >= 8 ? 'deux emplacements' : 'second emplacement à +8'));
    const slots = el('div',{class:'trempe-slots'});
    const maxSlots = niveau >= 8 ? 2 : 1;
    for (let i=0;i<2;i++) {
      const t=it.trempes[i], d=t && GD().temperById(t.id), ouvert=i<maxSlots;
      slots.appendChild(el('button',{class:'trempe-slot' + (i===trempeSlot?' actif':'') + (!ouvert?' ferme':''),disabled:!ouvert,onclick:()=>{trempeSlot=i;rafraichirForge(bid);}},
        d ? el('img',{src:d.image,alt:''}) : el('span',{class:'trempe-vide',text:ouvert?'+':'—'}),
        el('b',{text:d?d.nom:(ouvert?'Emplacement libre':'À +8')})));
    }
    c.appendChild(slots);
    const coutT = GD().temperCost(it,trempeSlot);
    c.appendChild(U.listeRes(coutT,{verifier:true}));
    const aff = el('div',{class:'trempe-grille'});
    for (const d of GD().TEMPER_AFFIXES || []) aff.appendChild(el('button',{class:'trempe-affixe',disabled:!window.Etat.assez(coutT),onclick:()=>{
      const r=G().temperItem(it,d.id,trempeSlot);U.dire(r.ok?'Trempe fixée : '+r.nom+'.':r.raison,r.ok?'bien':'alerte');rafraichirForge(bid);
    }},el('img',{src:d.image,alt:''}),el('span',{},el('b',{text:d.nom}),el('small',{text:d.desc}))));
    c.appendChild(aff);
  }

  /* =================================================================
     CE QU'IL SAIT
     ================================================================= */
  function rendreTalents(c) {
    const m = selecteur(c);
    if (!m) return;
    if (m.def && m.def.sansArme) {
      c.appendChild(el('div', { class:'vide', text:'Un paysan sans arme n’a pas encore de style. Équipez une arme pour ouvrir son arbre de pratique.' }));
      return;
    }
    const arbre = GD().talentTree(m.cls);
    const pts = G().talentPts(m.id);
    const engages = G().talentSpent(m.id);
    c.appendChild(el('div', { class: 'rangee entre' },
      el('span', { class: 'eti', text: engages + ' point(s) engagé(s)' }),
      el('span', { class: 'niv', text: pts + ' à dépenser' })));
    if (!arbre) { c.appendChild(el('div', { class: 'vide', text: 'Pas encore d’arbre pour ce style d’arme.' })); return; }
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
    if (!m) return;
    if (m.def && m.def.sansArme) {
      c.appendChild(el('div', { class:'vide', text:'Équipez une arme avant de choisir une posture de combat.' }));
      return;
    }
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
    if (!l.length) c.appendChild(el('div', { class: 'vide', text: 'Aucune posture pour ce style d’arme.' }));
  }

  window.UICompagnie = {
    ouvrir,
    rendreForgeRenfort:(c,bid)=>rendreAtelier(c,'renfort',bid),
    rendreForgeTrempe:(c,bid)=>rendreAtelier(c,'trempe',bid),
    get choisi() { return choisi; }
  };

})();
