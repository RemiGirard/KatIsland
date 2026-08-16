/* ============================================================
   LE BOURG — donnees/gd-talents.js
   L'ARBRE DE TALENTS des héros de la descente.

   `state-general.js` (le moteur de l'Aventure, conservé) réclame huit
   entrées pour faire vivre ses talents ; le fichier qui les portait n'a
   pas été livré. On le réécrit ici, mais à notre façon : plutôt que
   d'écrire à la main neuf arbres de vingt-trois nœuds, on les COMPOSE
   à partir de gabarits — trois branches ordinaires, deux voies
   exclusives, et des effets tirés d'une table par classe.

   Forme d'un nœud, telle que la lit le moteur :
     { id, tier, nom, desc, effect:{kind,…}, choix?, req?, spec? }
   `kind` vaut 'stat' (add), 'pct' (pct), 'proc', 'aura' ou 'ability'.
   ============================================================ */
"use strict";

(function () {

  const TIERS = 5;              // profondeur d'une branche ordinaire
  const TIERS_VOIE = 4;         // profondeur d'une voie
  GameData.TALENT_SPEC_AT = 8;  // points engagés avant de pouvoir choisir sa voie

  /* Combien de points a-t-on au niveau n ? Un par niveau, et le Général
     en reçoit deux d'avance — c'est lui qui porte la compagnie. */
  GameData.talentPointsForLevel = lvl => Math.max(0, (lvl | 0));
  GameData.generalTalentPoints = lvl => Math.max(0, (lvl | 0)) + 2;
  GameData.talentCostOf = function (cls, nodeId) {
    const n = GameData.talentAnyNode(cls, nodeId);
    return n && n.spec ? 2 : 1;
  };

  /* ---------------------------------------------------------------
     LES GABARITS DE BRANCHE. Chaque classe reçoit trois branches, et
     chaque branche est une montée régulière sur une même idée : on ne
     mélange pas « frapper plus fort » et « courir plus vite » dans la
     même colonne, sinon aucune décision n'a de saveur.
     --------------------------------------------------------------- */
  const B = (id, nom, desc, effets) => ({ id, nom, desc, effets });

  const BRANCHES = {
    force:   B('force', 'Force', 'Frapper plus fort, et plus souvent.',
      [{ k: 'stat', s: 'dmg', v: 3 }, { k: 'pct', s: 'dmg', v: 0.06 },
       { k: 'stat', s: 'dmg', v: 5 }, { k: 'pct', s: 'aspd', v: 0.08 },
       { k: 'pct', s: 'dmg', v: 0.12 }]),
    endurance: B('endurance', 'Endurance', 'Tenir debout plus longtemps que l\'autre.',
      [{ k: 'stat', s: 'hp', v: 22 }, { k: 'stat', s: 'armor', v: 4 },
       { k: 'pct', s: 'hp', v: 0.09 }, { k: 'stat', s: 'armor', v: 7 },
       { k: 'pct', s: 'hp', v: 0.16 }]),
    vivacite: B('vivacite', 'Vivacité', 'Arriver le premier, partir avant le coup.',
      [{ k: 'stat', s: 'mspd', v: 6 }, { k: 'pct', s: 'aspd', v: 0.06 },
       { k: 'stat', s: 'mspd', v: 9 }, { k: 'pct', s: 'mspd', v: 0.10 },
       { k: 'pct', s: 'aspd', v: 0.14 }]),
    portee:  B('portee', 'Portée', 'Régler la question avant qu\'elle approche.',
      [{ k: 'stat', s: 'range', v: 14 }, { k: 'pct', s: 'dmg', v: 0.06 },
       { k: 'stat', s: 'range', v: 22 }, { k: 'pct', s: 'aspd', v: 0.09 },
       { k: 'pct', s: 'dmg', v: 0.13 }]),
    arcanes: B('arcanes', 'Arcanes', 'Ce que les runes accordent, elles le reprennent.',
      [{ k: 'pct', s: 'dmg', v: 0.07 }, { k: 'stat', s: 'dmg', v: 4 },
       { k: 'pct', s: 'aspd', v: 0.07 }, { k: 'stat', s: 'hp', v: 20 },
       { k: 'pct', s: 'dmg', v: 0.15 }]),
    fortune: B('fortune', 'Fortune', 'Revenir plus riche qu\'on n\'est parti.',
      [{ k: 'pct', s: 'loot', v: 0.06 }, { k: 'pct', s: 'xp', v: 0.07 },
       { k: 'pct', s: 'loot', v: 0.10 }, { k: 'pct', s: 'rare', v: 0.05 },
       { k: 'pct', s: 'loot', v: 0.16 }]),
    secours: B('secours', 'Secours', 'Recoudre, rassurer, ronchonner.',
      [{ k: 'stat', s: 'hp', v: 18 }, { k: 'aura', stat: 'hp', pct: 0.05 },
       { k: 'pct', s: 'hp', v: 0.10 }, { k: 'aura', stat: 'armor', add: 4 },
       { k: 'aura', stat: 'hp', pct: 0.12 }]),
    commandement: B('commandement', 'Commandement', 'Il ne gagne pas les combats : il les fait gagner.',
      [{ k: 'aura', stat: 'dmg', pct: 0.05 }, { k: 'stat', s: 'hp', v: 20 },
       { k: 'aura', stat: 'armor', add: 3 }, { k: 'pct', s: 'dmg', v: 0.08 },
       { k: 'aura', stat: 'dmg', pct: 0.12 }]),
  };

  /* Les VOIES : deux identités exclusives par classe, ouvertes après
     huit points engagés. Prendre l'une ferme l'autre — c'est ce qui fait
     qu'une compagnie de quatre a quatre visages. */
  const VOIES = {
    brute:   { nom: 'La Brute',   desc: 'Tout dans le premier coup.',
      effets: [{ k: 'pct', s: 'dmg', v: 0.16 }, { k: 'stat', s: 'dmg', v: 9 },
               { k: 'pct', s: 'aspd', v: 0.12 }, { k: 'pct', s: 'dmg', v: 0.25 }] },
    roc:     { nom: 'Le Roc',     desc: 'Rien ne passe.',
      effets: [{ k: 'stat', s: 'armor', v: 10 }, { k: 'pct', s: 'hp', v: 0.18 },
               { k: 'aura', stat: 'armor', add: 5 }, { k: 'pct', s: 'hp', v: 0.28 }] },
    fleche:  { nom: 'La Flèche',  desc: 'Deux traits pendant qu\'un autre en tire un.',
      effets: [{ k: 'pct', s: 'aspd', v: 0.16 }, { k: 'stat', s: 'range', v: 26 },
               { k: 'pct', s: 'dmg', v: 0.14 }, { k: 'pct', s: 'aspd', v: 0.24 }] },
    ombre:   { nom: "L'Ombre",    desc: 'Là où l\'on ne regardait pas.',
      effets: [{ k: 'pct', s: 'mspd', v: 0.18 }, { k: 'pct', s: 'dmg', v: 0.14 },
               { k: 'pct', s: 'rare', v: 0.08 }, { k: 'pct', s: 'dmg', v: 0.24 }] },
    flamme:  { nom: 'La Flamme',  desc: 'Ce qui brûle ne se relève pas.',
      effets: [{ k: 'pct', s: 'dmg', v: 0.18 }, { k: 'stat', s: 'dmg', v: 8 },
               { k: 'pct', s: 'aspd', v: 0.10 }, { k: 'pct', s: 'dmg', v: 0.26 }] },
    source:  { nom: 'La Source',  desc: 'On repart avec tout le monde.',
      effets: [{ k: 'aura', stat: 'hp', pct: 0.10 }, { k: 'stat', s: 'hp', v: 30 },
               { k: 'aura', stat: 'armor', add: 6 }, { k: 'aura', stat: 'hp', pct: 0.22 }] },
    banniere:{ nom: 'La Bannière', desc: 'La compagnie entière frappe plus fort.',
      effets: [{ k: 'aura', stat: 'dmg', pct: 0.09 }, { k: 'pct', s: 'xp', v: 0.12 },
               { k: 'aura', stat: 'aspd', pct: 0.07 }, { k: 'aura', stat: 'dmg', pct: 0.18 }] },
    coffre:  { nom: 'Le Coffre',  desc: 'On redescend surtout pour ce qu\'on remonte.',
      effets: [{ k: 'pct', s: 'loot', v: 0.18 }, { k: 'pct', s: 'rare', v: 0.09 },
               { k: 'pct', s: 'xp', v: 0.14 }, { k: 'pct', s: 'loot', v: 0.30 }] },
  };

  /* Quelle classe reçoit quoi. Trois branches, deux voies. */
  const PLAN = {
    guerrier:   { br: ['force', 'endurance', 'vivacite'],   voies: ['brute', 'roc'] },
    garde:      { br: ['endurance', 'force', 'commandement'], voies: ['roc', 'banniere'] },
    tireur:     { br: ['portee', 'vivacite', 'force'],      voies: ['fleche', 'ombre'] },
    mage:       { br: ['arcanes', 'portee', 'endurance'],   voies: ['flamme', 'fleche'] },
    artificier: { br: ['arcanes', 'force', 'fortune'],      voies: ['flamme', 'coffre'] },
    eclaireur:  { br: ['vivacite', 'fortune', 'portee'],    voies: ['ombre', 'coffre'] },
    soigneur:   { br: ['secours', 'endurance', 'arcanes'],  voies: ['source', 'roc'] },
    barde:      { br: ['commandement', 'fortune', 'vivacite'], voies: ['banniere', 'coffre'] },
    general:    { br: ['commandement', 'endurance', 'force'], voies: ['banniere', 'roc'] },
  };

  /* ---------------------------------------------------------------
     COMPOSITION. On fabrique une fois pour toutes, au chargement.
     --------------------------------------------------------------- */
  const ROMAINS = ['I', 'II', 'III', 'IV', 'V'];

  function effetVers(e) {
    if (e.k === 'stat') return { kind: 'stat', stat: e.s, add: e.v };
    if (e.k === 'pct') return { kind: 'pct', stat: e.s, pct: e.v };
    if (e.k === 'aura') return { kind: 'aura', stat: e.stat, pct: e.pct || 0, add: e.add || 0 };
    return { kind: 'stat', stat: 'hp', add: 5 };
  }
  function libelle(e) {
    const NOM = { hp: 'PV', dmg: 'dégâts', aspd: "vitesse d'attaque", mspd: 'vitesse',
                  armor: 'armure', range: 'portée', loot: 'butin', xp: 'expérience', rare: 'rareté' };
    if (e.k === 'stat') return '+' + e.v + ' ' + (NOM[e.s] || e.s);
    if (e.k === 'pct') return '+' + Math.round(e.v * 100) + ' % ' + (NOM[e.s] || e.s);
    if (e.k === 'aura') return 'Compagnie : +' + (e.pct ? Math.round(e.pct * 100) + ' % ' : e.add + ' ') + (NOM[e.stat] || e.stat);
    return '';
  }

  const ARBRES = {};
  const SPECS = {};

  for (const cls in PLAN) {
    const plan = PLAN[cls];
    const branches = plan.br.map(bid => {
      const g = BRANCHES[bid];
      const nodes = [];
      for (let t = 1; t <= TIERS; t++) {
        const e = g.effets[t - 1];
        nodes.push({
          id: cls + '.' + bid + '.' + t, tier: t,
          nom: g.nom + ' ' + ROMAINS[t - 1],
          desc: libelle(e),
          effect: effetVers(e),
        });
      }
      /* Au troisième cran, la branche se dédouble en un CHOIX : deux
         nœuds du même groupe, dont un seul peut être pris. C'est le
         premier vrai carrefour, bien avant les voies. */
      const alt = {
        id: cls + '.' + bid + '.3b', tier: 3, choix: cls + '.' + bid + '.carrefour',
        nom: g.nom + ' III — variante',
        desc: libelle({ k: 'pct', s: 'loot', v: 0.08 }),
        effect: { kind: 'pct', stat: 'loot', pct: 0.08 },
        req: [cls + '.' + bid + '.2'],
      };
      nodes[2].choix = cls + '.' + bid + '.carrefour';
      nodes.splice(3, 0, alt);
      // le tier 4 accepte l'un OU l'autre des deux nœuds du carrefour
      const t4 = nodes.find(n => n.tier === 4);
      if (t4) t4.req = [nodes[2].id, alt.id];
      return { id: bid, nom: g.nom, desc: g.desc, nodes };
    });

    const specs = plan.voies.map(vid => {
      const v = VOIES[vid];
      const nodes = [];
      for (let t = 1; t <= TIERS_VOIE; t++) {
        const e = v.effets[t - 1];
        nodes.push({
          id: cls + '.voie.' + vid + '.' + t, tier: t, spec: vid,
          nom: v.nom + ' ' + ROMAINS[t - 1],
          desc: libelle(e),
          effect: effetVers(e),
        });
      }
      return { id: vid, nom: v.nom, desc: v.desc, nodes };
    });

    ARBRES[cls] = { cls, branches, specs };
    SPECS[cls] = specs;
  }

  /* ---------------------------------------------------------------
     LES HUIT ENTRÉES QUE LIT `state-general.js`
     --------------------------------------------------------------- */
  GameData.talentTree = cls => ARBRES[cls] || null;
  GameData.talentSpecs = cls => SPECS[cls] || [];

  GameData.talentAnyNode = function (cls, nodeId) {
    const t = ARBRES[cls];
    if (!t) return null;
    for (const b of t.branches) { const n = b.nodes.find(x => x.id === nodeId); if (n) return n; }
    for (const s of t.specs) { const n = s.nodes.find(x => x.id === nodeId); if (n) return n; }
    return null;
  };
  GameData.talentSpecOf = function (cls, nodeId) {
    const t = ARBRES[cls];
    if (!t) return null;
    return t.specs.find(s => s.nodes.some(n => n.id === nodeId)) || null;
  };
  GameData.talentGroupe = function (cls, choix) {
    const t = ARBRES[cls];
    if (!t || !choix) return [];
    const out = [];
    for (const b of t.branches) for (const n of b.nodes) if (n.choix === choix) out.push(n);
    return out;
  };

})();
