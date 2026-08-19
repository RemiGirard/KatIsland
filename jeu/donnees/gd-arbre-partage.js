/* ============================================================
   LE BOURG — donnees/gd-arbre-partage.js
   L'ARBRE DE TALENTS PARTAGÉ.

   Il y avait un arbre PAR CLASSE — trois branches et deux voies
   chacun — soit neuf couloirs parallèles. La classe décidait du
   personnage et l'arbre ne faisait que le confirmer : on ne pouvait
   pas construire un build, on en choisissait un dans une liste.

   Ce fichier remplace les neuf arbres par UN SEUL, que tout le monde
   parcourt. Sa forme est un ANNEAU de bosquets thématiques : on y
   entre par une extrémité — tir, corps à corps, arcanes, rempart,
   ombre, allure — et l'on avance de proche en proche. Chaque bosquet
   touche ses deux voisins, et des CORDES traversent l'anneau pour que
   deux thèmes opposés puissent quand même se rencontrer.

   C'est ce qui autorise un build à se CONSTRUIRE. On entre au tir, on
   pousse vers le venin, on continue vers le rempart : un archer qui
   empoisonne et qui encaisse. Personne n'a dessiné cette classe — elle
   est au bout d'un chemin.

   POURQUOI UN FICHIER À PART. `gd-talents-riches.js` fait 787 lignes
   et reste la source des ANCIENS arbres : de vieilles sauvegardes
   citent encore leurs identifiants de nœuds, et `talentAnyNode` doit
   pouvoir les résoudre pour ne pas effacer des points déjà dépensés.
   On le laisse donc intact et l'on se contente de rebrancher
   `GameData.TALENT_TREES` sur l'arbre commun, après lui.

   -> remplace GameData.TALENT_TREES, ajoute GameData.talentEntrees
   ============================================================ */
"use strict";
(function () {

  const GD = window.GameData;
  if (!GD || !GD.TALENT_TREES) return;   // chargé hors contexte : on ne fait rien

  const ROMAINS = ['I', 'II', 'III', 'IV', 'V'];

  /* Les effets parlent la langue que `state-general.js` lit déjà :
     `stat` pour un ajout plat, `pct` pour un pourcentage, `aura` pour ce
     qui profite à toute la compagnie, `power` pour un pouvoir. */
  const S = (stat, add) => ({ kind: 'stat', stat, add });
  const P = (stat, pct) => ({ kind: 'pct', stat, pct });
  const A = (stat, o) => Object.assign({ kind: 'aura', stat }, o);
  const PW = power => ({ kind: 'power', power });

  const NOM_STAT = { dmg: 'dégâts', hp: 'points de vie', armor: 'armure',
    aspd: 'vitesse d\'attaque', mspd: 'vitesse de déplacement', range: 'portée',
    loot: 'butin', rare: 'chance de rare', xp: 'expérience' };
  function libelle(e) {
    const n = NOM_STAT[e.stat] || e.stat;
    if (e.kind === 'stat') return '+' + e.add + ' ' + n;
    if (e.kind === 'pct') return '+' + Math.round(e.pct * 100) + ' % ' + n;
    if (e.kind === 'aura') return 'Compagnie : +' +
      (e.pct != null ? Math.round(e.pct * 100) + ' % ' : e.add + ' ') + n;
    return 'Accorde un pouvoir.';
  }

  /* Chaque bosquet : deux petits nœuds, une MAÎTRISE qui porte l'idée,
     puis un DON qui accroche un pouvoir du catalogue. Le don est un nœud
     à part, au bout : on ne l'atteint pas sans avoir traversé le thème. */
  const B = (id, nom, desc, entree, petits, maitrise, pouvoir) =>
    ({ id, nom, desc, entree: !!entree, petits, maitrise, pouvoir });

  const ANNEAU = [
    B('tir', 'Tir', 'La question se règle avant qu\'elle approche.', true,
      [S('range', 16), P('aspd', 0.07)], P('dmg', 0.14), 'ti_percant'),
    B('venin', 'Venin', 'On ne frappe pas plus fort : on frappe plus longtemps.', false,
      [P('dmg', 0.06), S('dmg', 4)], P('dmg', 0.13), 'an_nuee'),
    B('rempart', 'Rempart', 'Tenir la ligne, et la faire tenir.', true,
      [S('armor', 6), P('hp', 0.10)], S('armor', 11), 'ga_provoc'),
    B('serment', 'Serment', 'Ce qu\'on protège vaut ce qu\'on frappe.', false,
      [A('armor', { add: 4 }), S('hp', 26)], A('hp', { pct: 0.10 }), 'so_egide'),
    B('corps', 'Corps à corps', 'Fermer la distance et ne plus la rouvrir.', true,
      [S('dmg', 5), P('aspd', 0.08)], P('dmg', 0.15), 'gu_fracas'),
    B('deuxmains', 'Deux mains', 'Un seul coup, mais on ne le rejoue pas.', false,
      [S('dmg', 8), P('dmg', 0.09)], P('dmg', 0.20), 'gu_decapitation'),
    B('feu', 'Feu', 'Ce qui brûle continue de brûler.', false,
      [P('dmg', 0.08), S('dmg', 5)], P('dmg', 0.16), 'an_boulefeu'),
    B('arcanes', 'Arcanes', 'Ce que les runes accordent, elles le reprennent.', true,
      [P('dmg', 0.07), S('hp', 18)], P('dmg', 0.15), 'ma_trait'),
    B('froid', 'Froid', 'On ne tue pas le froid : on l\'immobilise.', false,
      [S('range', 12), P('dmg', 0.07)], P('aspd', 0.14), 'an_eclatgel'),
    B('foudre', 'Foudre', 'Elle choisit son chemin toute seule.', false,
      [P('aspd', 0.09), S('dmg', 6)], P('dmg', 0.17), 'an_arcfoudre'),
    B('ombre', 'Ombre', 'On frappe ce qui ne regarde pas.', true,
      [P('dmg', 0.09), S('mspd', 7)], P('dmg', 0.18), 'an_fauxombre'),
    B('necro', 'Nécromancie', 'Ce qui est tombé n\'a pas fini de servir.', false,
      [A('dmg', { pct: 0.05 }), S('hp', 22)], A('dmg', { pct: 0.11 }), 'an_ossuaire'),
    B('allure', 'Allure', 'Arriver le premier, partir avant le coup.', true,
      [S('mspd', 8), P('aspd', 0.07)], P('mspd', 0.10), 'ec_esquive'),
    B('fortune', 'Fortune', 'Revenir plus riche qu\'on n\'est parti.', false,
      [P('loot', 0.09), P('rare', 0.05)], P('loot', 0.17), 'ec_reperage'),
  ];

  /* LES CORDES : des liens qui coupent à travers l'anneau. Sans elles
     l'arbre n'est qu'un cercle, et deux thèmes opposés ne se rencontrent
     jamais — or c'est la rencontre qui fait un build. */
  const CORDES = [
    ['rempart', 'serment'], ['serment', 'arcanes'],
    ['venin', 'necro'], ['ombre', 'deuxmains'],
    ['feu', 'foudre'], ['froid', 'allure'],
    ['fortune', 'tir'], ['corps', 'rempart'],
  ];

  /* ================================================================
     LES RUNES

     Un pouvoir gagne ne devrait pas etre un point final. Au bout de
     chaque bosquet, trois RUNES retouchent le don qu’on vient d’obtenir
     — plus large, plus souvent, plus fort, qui ricoche, qui eclabousse,
     qui dure. C’est la meme idee que les runes de Diablo : ce n’est pas
     un pouvoir de plus, c’est CE pouvoir, joue autrement.

     ELLES SONT EXCLUSIVES. Les trois portent le meme groupe `choix`, et
     `talentGroupe` en interdit deux : on choisit ce que devient sa boule
     de feu, on ne l’empile pas. Sans exclusion, la question « laquelle »
     n’existerait pas, et une rune ne serait qu’un palier de plus.

     ELLES NE PEUVENT PAS ETRE MUETTES. `appliquerMods` ignore en silence
     un mod dont le champ est absent du pouvoir (`p[m.mod] != null`) :
     proposer « rayon +50 % » sur un pouvoir sans rayon serait vendre du
     vide. On lit donc la DEFINITION du pouvoir et l’on ne retient que
     les runes dont le champ existe vraiment.
     ================================================================ */
  /* L ORDRE COMPTE : les runes DISTINCTIVES viennent en tete. Ce sont
     elles qui changent la nature du pouvoir — il ricoche, il eclabousse,
     il part en trois — et non son barreme. Les runes de barreme (rayon,
     degats, recharge) ferment la marche : elles servent de repli quand un
     pouvoir n a rien de distinctif a offrir.

     `kinds` dit a quel type de pouvoir la rune s applique. Ce n est pas
     decoratif : l arene ne lit `splash` que dans `aoe_point`, `chain` que
     dans `bolt` et `spread` que dans `line`. Proposer un ricochet sur une
     zone au sol serait vendre un effet que rien ne joue. */
  const RUNES = [
    { mod: 'splash', pct: 0.6,  kinds: ['aoe_point'],
      nom: 'Eclaboussure', txt: 'l impact arrose tout ce qui borde le cratere' },
    { mod: 'chain',  pct: 3,    kinds: ['bolt'],
      nom: 'Ricochet',     txt: 'le trait rebondit de cible en cible' },
    { mod: 'spread', pct: 3,    kinds: ['line'],
      nom: 'Salve',        txt: 'il en part trois au lieu d un' },
    /* Les runes d'invocation. `dur` allonge le sursis ; `part` la fait
       mordre plus fort en empruntant davantage a son invocateur. Toutes
       deux sont des champs REELS d'un pouvoir `summon`, donc jamais
       muettes sur autre chose : le filtre par champ s'en charge. */
    { mod: 'part',   pct: 0.50,  nom: 'Fidele',      txt: 'elle emprunte bien plus de sa force' },
    { mod: 'tick',   pct: -0.35, nom: 'Devorant',    txt: 'la zone ronge bien plus souvent' },
    { mod: 'dur',    pct: 0.70,  nom: 'Persistant',  txt: 'ce qu il laisse au sol dure' },
    { mod: 'w',      pct: 0.60,  nom: 'Large',       txt: 'la coupe s elargit' },
    { mod: 'len',    pct: 0.50,  nom: 'Allonge',     txt: 'elle porte bien plus loin' },
    { mod: 'radius', pct: 0.55,  nom: 'Ample',       txt: 'la zone s elargit de moitie' },
    { mod: 'mult',   pct: 0.45,  nom: 'Brutal',      txt: 'chaque impact frappe plus lourd' },
    { mod: 'cd',     pct: -0.30, nom: 'Fulgurant',   txt: 'il revient bien plus vite' },
    { mod: 'range',  pct: 0.45,  nom: 'Lointain',    txt: 'on le lance de bien plus loin' },
  ];
  /* `cd` et `tick` vont a l envers des autres : plus ils sont PETITS,
     mieux c est. Leurs runes portent donc un pourcentage NEGATIF, que
     `appliquerMods` applique tel quel — pas besoin d une table de plus. */

  const ARBRE = (function () {
    const branches = ANNEAU.map(b => {
      const pid = t => 'a.' + b.id + '.' + t;
      const nodes = [];
      b.petits.forEach((e, i) => nodes.push({
        id: pid(i + 1), tier: i + 1, bosquet: b.id,
        nom: b.nom + ' ' + ROMAINS[i], desc: libelle(e), effect: e,
      }));
      nodes.push({ id: pid(3), tier: 3, bosquet: b.id, notable: true,
        nom: b.nom + ' — maîtrise', desc: libelle(b.maitrise), effect: b.maitrise });
      if (b.pouvoir) {
        nodes.push({ id: pid(4), tier: 4, bosquet: b.id, don: true,
          nom: b.nom + ' — don', desc: 'Accorde un pouvoir.',
          effect: PW(b.pouvoir), req: [pid(3)] });
        /* LES TROIS RUNES DU DON. On interroge la definition du pouvoir :
           seules les runes dont le champ existe sont proposees, donc
           aucune ne peut etre silencieuse. S’il n’en reste aucune — un
           pouvoir sans champ retouchable — le bosquet s’arrete au don, ce
           qui vaut mieux qu’un choix decoratif. */
        const def = (GD.POWERS || {})[b.pouvoir];
        if (def) {
          /* DEUX REGLES, PARCE QU IL Y A DEUX SORTES DE MODS.

             Un SCALAIRE multiplie un champ : `appliquerMods` l ignore en
             silence si le champ n existe pas (`p[m.mod] != null`), donc on
             exige qu il soit deja la.

             Un DRAPEAU, lui, est fait pour etre AJOUTE — une boule de feu
             ne declare pas `splash`, c est la rune qui le lui donne. Sa
             condition n est donc pas l existence du champ mais le KIND du
             pouvoir : l arene ne lit chaque drapeau que dans une seule
             branche de son `switch`. */
          const bons = RUNES.filter(function (r) {
            if (r.kinds) return r.kinds.indexOf(def.kind) >= 0;
            return def[r.mod] != null;
          }).slice(0, 3);
          const groupe = 'a.' + b.id + '.runes';
          bons.forEach((r, k) => nodes.push({
            id: pid(5) + '.' + r.mod, tier: 5, bosquet: b.id, rune: true,
            choix: groupe,
            nom: b.nom + ' — ' + r.nom, desc: r.txt,
            effect: { kind: 'ability', mod: r.mod, pct: r.pct, cible: b.pouvoir },
            req: [pid(4)],
          }));
        }
      }
      nodes[1].req = [pid(1)];
      nodes[2].req = [pid(2)];
      b._nodes = nodes;
      return { id: b.id, nom: b.nom, desc: b.desc, nodes };
    });

    /* LES AMONTS D'UN BOSQUET : ses deux voisins d'anneau, plus ses
       cordes. `req` est lu en OU par `state-general.js` (« un amont déjà
       pris suffit : la route est ouverte »), donc en lister plusieurs
       ouvre bien la route par n'importe lequel d'entre eux.

       Un bosquet d'ENTRÉE n'a aucun amont : c'est par là qu'on commence,
       et il y en a six. */
    const voisins = {};
    const lier = (a, b2) => { (voisins[a] = voisins[a] || []).push(b2); };
    for (let i = 0; i < ANNEAU.length; i++) {
      const a = ANNEAU[i], b2 = ANNEAU[(i + 1) % ANNEAU.length];
      lier(a.id, b2.id); lier(b2.id, a.id);
    }
    for (const c of CORDES) { lier(c[0], c[1]); lier(c[1], c[0]); }
    for (const b of ANNEAU) {
      const amonts = [];
      for (const v of (voisins[b.id] || [])) {
        const vb = ANNEAU.find(x => x.id === v);
        if (vb) amonts.push(vb._nodes[2].id);
      }
      /* UN BOSQUET D'ENTREE NE DOIT PAS ETRE UN MUR.

         Son premier noeud reste LIBRE — c est par la qu on commence — mais
         s il n avait que cela, rien ne pourrait y entrer : en venant du tir
         on butait sur le rempart, et l anneau se cassait en quatre ilots.
         On raccroche donc les voisins sur son DEUXIEME noeud : on peut
         commencer ici, et l on peut aussi y arriver d ailleurs. */
      if (b.entree) {
        b._nodes[0].req = [];
        b._nodes[1].req = ['a.' + b.id + '.1'].concat(amonts);
        continue;
      }
      /* on aborde un bosquet par la MAÎTRISE d'un voisin : il faut avoir
         traversé le thème d'à côté pour entrer dans celui-ci. */
      b._nodes[0].req = amonts;
    }
    return { cls: 'partage', branches, specs: [], voisins };
  })();

  /* On rebranche toutes les classes sur l'arbre commun. Les anciens
     restent accessibles pour la relecture des vieilles sauvegardes. */
  GD.TALENT_TREES_ANCIENS = GD.TALENT_TREES;
  const neuf = {};
  for (const cls in GD.TALENT_TREES) neuf[cls] = ARBRE;
  GD.TALENT_TREES = neuf;
  /* Plus de voies de spécialisation : l'arbre EST la spécialisation. */
  GD.TALENT_SPECS_ANCIENS = GD.TALENT_SPECS;
  const vides = {};
  for (const cls in (GD.TALENT_SPECS || {})) vides[cls] = [];
  GD.TALENT_SPECS = vides;

  GD.ARBRE_PARTAGE = ARBRE;
  GD.talentEntrees = () => ANNEAU.filter(b => b.entree)
    .map(b => ({ id: b.id, nom: b.nom, desc: b.desc, premier: 'a.' + b.id + '.1' }));
  GD.talentVoisins = id => (ARBRE.voisins[id] || []).slice();
  /* Un nœud d'ANCIEN arbre doit rester résoluble : sans cela un point
     dépensé avant cette refonte disparaîtrait au chargement. */
  GD.talentNoeudAncien = function (cls, nodeId) {
    const t = (GD.TALENT_TREES_ANCIENS || {})[cls];
    if (t) for (const br of t.branches) for (const n of br.nodes) if (n.id === nodeId) return n;
    for (const sp of ((GD.TALENT_SPECS_ANCIENS || {})[cls] || []))
      for (const n of sp.nodes) if (n.id === nodeId) return n;
    return null;
  };

})();
