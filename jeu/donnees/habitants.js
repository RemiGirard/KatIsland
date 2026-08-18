/* ============================================================
   LE BOURG — donnees/habitants.js
   CE QU'EST UN HABITANT.

   Un habitant n'est pas une unité de production interchangeable :
   c'est quelqu'un. Il arrive avec un métier de prédilection, une
   RARETÉ, et deux à quatre TRAITS — des qualités et des défauts qui
   se voient dans les chiffres et qu'on ne peut pas corriger.

   Le jeu ne vous donne jamais un habitant : il vous en propose TROIS
   et vous en prenez un. C'est là qu'est le choix — un légendaire qui
   mange pour deux contre un commun sans histoire, un Meneur qui pousse
   tout le bourg mais refuse la tour, un Chanceux grognon.

   -> window.HAB
   ============================================================ */
"use strict";
(function () {

  /* =================================================================
     LES TRAITS
     Chaque trait est une TABLE, pas un cas particulier dans le moteur :
     on peut donc en poser quatre sur le même habitant sans que rien ne
     se contredise. Les champs absents valent « aucun effet ».

       vitesse(ctx)  multiplicateur de cadence au poste
       chantier      multiplicateur de cadence au chantier
       conso         part de vivres mangée (1 = la ration normale)
       matiere       part de matières consommée par cycle
       butin         multiplicateur des chances de trouvaille
       saut          probabilité qu'un cycle ne coûte aucune matière
       perte         probabilité qu'un cycle soit gâché
       usure         usure de l'outillage de son atelier
       moral         ce qu'il ajoute (ou retire) au moral du bourg
       defense       ce qu'il ajoute aux remparts
       negoce        ce qu'il ajoute au prix de vente
       auraVitesse   ce qu'il apporte à TOUS LES AUTRES postes
       auraXp        ce qu'il apporte à l'expérience des autres
       voisins       ce qu'il fait aux autres postes de SON bâtiment
       pv / degats    en expédition
       refuse        ce qu'il n'acceptera jamais de faire
     ================================================================= */
  const T = {};
  function trait(o) { T[o.id] = o; return o; }

  /* ---------------- les qualités ---------------- */
  trait({ id: 'matinal', nom: 'Matinal', genre: 'qualite', poids: 10,
    desc: 'Debout avant le jour : +14 % de cadence tant qu\'il fait clair.',
    vitesse: c => c.jour ? 1.14 : 1 });
  trait({ id: 'noctambule', nom: 'Noctambule', genre: 'qualite', poids: 10,
    desc: 'Ne dort qu\'à l\'aube : +14 % de cadence une fois la nuit tombée.',
    vitesse: c => c.jour ? 1 : 1.14 });
  trait({ id: 'solide', nom: 'Solide', genre: 'qualite', poids: 10,
    desc: '+14 % à la mine, à la forge et au feu.',
    vitesse: c => (c.metier === 'mine' || c.metier === 'forge' || c.metier === 'feu') ? 1.14 : 1 });
  trait({ id: 'adroit', nom: 'Adroit', genre: 'qualite', poids: 10,
    desc: '+14 % au tissage, au savoir et à la cuisine.',
    vitesse: c => (c.metier === 'tissage' || c.metier === 'savoir' || c.metier === 'cuisine') ? 1.14 : 1 });
  trait({ id: 'patient', nom: 'Patient', genre: 'qualite', poids: 9,
    desc: '+16 % sur les ouvrages de plus d\'une minute.',
    vitesse: c => c.duree > 60 ? 1.16 : 1 });
  trait({ id: 'vif', nom: 'Vif', genre: 'qualite', poids: 9,
    desc: '+16 % sur les gestes de moins de quinze secondes.',
    vitesse: c => c.duree < 15 ? 1.16 : 1 });
  trait({ id: 'frugal', nom: 'Frugal', genre: 'qualite', poids: 9,
    desc: 'Se contente d\'un tiers de ration en moins.', conso: 0.65 });
  trait({ id: 'chanceux', nom: 'Chanceux', genre: 'qualite', poids: 7,
    desc: 'Ses trouvailles tombent 45 % plus souvent.', butin: 1.45 });
  trait({ id: 'econome', nom: 'Économe', genre: 'qualite', poids: 7,
    desc: 'Un cycle sur huit ne consomme aucune matière.', saut: 0.125 });
  trait({ id: 'batisseur', nom: 'Bâtisseur', genre: 'qualite', poids: 8,
    desc: '+28 % de cadence au chantier du bourg.', chantier: 1.28 });
  trait({ id: 'meneur', nom: 'Meneur', genre: 'qualite', poids: 5,
    desc: 'Fait travailler tous les AUTRES postes 4 % plus vite.', auraVitesse: 0.04 });
  trait({ id: 'pedagogue', nom: 'Pédagogue', genre: 'qualite', poids: 5,
    desc: 'Les autres habitants gagnent 15 % d\'expérience en plus.', auraXp: 0.15 });
  trait({ id: 'bricoleur', nom: 'Bricoleur', genre: 'qualite', poids: 7,
    desc: 'L\'outillage de son atelier s\'use 45 % moins vite.', usure: 0.55 });
  trait({ id: 'negociant', nom: 'Négociant', genre: 'qualite', poids: 6,
    desc: '+8 % sur tout ce que le bourg vend.', negoce: 0.08 });
  trait({ id: 'sentinelle', nom: 'Sentinelle', genre: 'qualite', poids: 6,
    desc: 'Monte la garde : +7 de défense au bourg.', defense: 7 });
  trait({ id: 'avenant', nom: 'Avenant', genre: 'qualite', poids: 6,
    desc: 'On l\'aime bien : +5 de moral au bourg.', moral: 5 });
  trait({ id: 'robuste', nom: 'Robuste', genre: 'qualite', poids: 6,
    desc: 'Encaisse : +30 % de points de vie dans la tour.', pv: 1.30 });
  trait({ id: 'hardi', nom: 'Hardi', genre: 'qualite', poids: 6,
    desc: 'Frappe fort : +20 % de dégâts dans la tour.', degats: 1.20 });
  trait({ id: 'entetes', nom: 'Entêté', genre: 'qualite', poids: 5,
    desc: 'Ne lâche rien : +7 % de cadence partout, à toute heure.',
    vitesse: () => 1.07 });
  trait({ id: 'soigneux', nom: 'Soigneux', genre: 'qualite', poids: 6,
    desc: 'Gâche 12 % de matières en moins à chaque cycle.', matiere: 0.88 });

  /* ---------------- les défauts ---------------- */
  trait({ id: 'gourmand', nom: 'Gourmand', genre: 'defaut', poids: 10,
    desc: 'Mange pour un et demi.', conso: 1.55 });
  trait({ id: 'lent', nom: 'Lent', genre: 'defaut', poids: 9,
    desc: '−12 % de cadence, partout, toujours.', vitesse: () => 0.88 });
  trait({ id: 'distrait', nom: 'Distrait', genre: 'defaut', poids: 8,
    desc: 'Un cycle sur douze part en fumée.', perte: 0.083 });
  trait({ id: 'grognon', nom: 'Grognon', genre: 'defaut', poids: 8,
    desc: 'Il pèse sur l\'ambiance : −5 de moral au bourg.', moral: -5 });
  trait({ id: 'maladroit', nom: 'Maladroit', genre: 'defaut', poids: 8,
    desc: '−16 % en forge, au tissage et au savoir.',
    vitesse: c => (c.metier === 'forge' || c.metier === 'tissage' || c.metier === 'savoir') ? 0.84 : 1 });
  trait({ id: 'brute', nom: 'Brute', genre: 'defaut', poids: 8,
    desc: '−16 % à la cuisine, au savoir et à l\'élevage.',
    vitesse: c => (c.metier === 'cuisine' || c.metier === 'savoir' || c.metier === 'elevage') ? 0.84 : 1 });
  trait({ id: 'dormeur', nom: 'Dormeur', genre: 'defaut', poids: 8,
    desc: 'La nuit, il ne rend plus qu\'un quart.',
    vitesse: c => c.jour ? 1 : 0.75 });
  trait({ id: 'reveur', nom: 'Rêveur', genre: 'defaut', poids: 7,
    desc: '−22 % sur les ouvrages de plus d\'une minute.',
    vitesse: c => c.duree > 60 ? 0.78 : 1 });
  trait({ id: 'brouillon', nom: 'Brouillon', genre: 'defaut', poids: 7,
    desc: 'Gaspille 22 % de matières de plus à chaque cycle.', matiere: 1.22 });
  trait({ id: 'superstitieux', nom: 'Superstitieux', genre: 'defaut', poids: 7,
    desc: 'Ne ramasse pas ce qui brille : −35 % de trouvailles.', butin: 0.65 });
  trait({ id: 'bavard', nom: 'Bavard', genre: 'defaut', poids: 7,
    desc: 'Les autres postes de SON bâtiment perdent 7 %.', voisins: -0.07 });
  trait({ id: 'fragile', nom: 'Fragile', genre: 'defaut', poids: 7,
    desc: '−30 % de points de vie dans la tour.', pv: 0.70 });
  trait({ id: 'peureux', nom: 'Peureux', genre: 'defaut', poids: 6,
    desc: 'Refuse net de descendre dans la tour.', refuse: 'tour' });
  trait({ id: 'casseur', nom: 'Casseur', genre: 'defaut', poids: 6,
    desc: 'Use l\'outillage de son atelier moitié plus vite.', usure: 1.55 });
  trait({ id: 'pantouflard', nom: 'Pantouflard', genre: 'defaut', poids: 6,
    desc: 'Refuse le chantier : −45 % s\'il y est mis de force.', chantier: 0.55 });

  const QUALITES = Object.keys(T).filter(k => T[k].genre === 'qualite');
  const DEFAUTS = Object.keys(T).filter(k => T[k].genre === 'defaut');

  /* =================================================================
     LES RARETÉS
     Ce qui distingue une rareté, ce n'est pas « plus de chiffres » :
     c'est le NOMBRE DE TRAITS et l'absence — ou non — d'un défaut. Un
     insigne porte trois qualités ET un défaut ; un rare n'a que deux
     qualités mais rien à lui reprocher. Il n'y a donc pas d'ordre
     évident : il y a un choix.
     ================================================================= */
  const RARETES = {
    commun:   { id:'commun',   nom:'Commun',    rang:0, poids:100, q:1, d:1, niv:1,
                col:'#8f8799', desc:'Une paire de bras, une habitude, un travers.' },
    estime:   { id:'estime',   nom:'Estimé',    rang:1, poids:44,  q:2, d:1, niv:1,
                col:'#7fb069', desc:'On parle de lui au village d\'à côté.' },
    rare:     { id:'rare',     nom:'Rare',      rang:2, poids:20,  q:2, d:0, niv:2,
                col:'#5f93cc', desc:'Deux qualités, aucun défaut connu.' },
    insigne:  { id:'insigne',  nom:'Insigne',   rang:3, poids:7,   q:3, d:1, niv:3,
                col:'#e6c069', desc:'Trois dons, et le caractère qui va avec.' },
    legende:  { id:'legende',  nom:'Légende',   rang:4, poids:2,   q:4, d:0, niv:5,
                col:'#e0625c', desc:'On raconte encore ce qu\'il a fait ailleurs.' },
  };
  const RARETES_IDS = ['commun', 'estime', 'rare', 'insigne', 'legende'];

  /* Le tirage penche du bon côté quand le bourg a de quoi séduire :
     du moral, une taverne, une chapelle, des recherches. `attrait` va
     de 0 (personne ne vient) à 3 et au-delà (on choisit ses gens). */
  function tirerRarete(rng, attrait) {
    /* On plafonne : même un bourg somptueux ne doit pas ne plus voir
       que des légendes se présenter — il resterait alors zéro décision
       à prendre à la porte. */
    const a = Math.max(0, Math.min(3.5, attrait || 0));
    let total = 0; const p = [];
    for (const id of RARETES_IDS) {
      const r = RARETES[id];
      /* l'attrait multiplie surtout le haut de la table */
      const w = r.poids * Math.pow(1 + a, r.rang * 0.85);
      p.push(w); total += w;
    }
    let x = rng() * total;
    for (let i = 0; i < p.length; i++) { x -= p[i]; if (x <= 0) return RARETES_IDS[i]; }
    return 'commun';
  }

  function tirerDans(rng, pool, n, exclus) {
    const out = [];
    const dispo = pool.filter(id => !exclus || exclus.indexOf(id) < 0);
    for (let k = 0; k < n && dispo.length; k++) {
      let total = 0;
      for (const id of dispo) total += T[id].poids;
      let x = rng() * total, choisi = dispo[0];
      for (const id of dispo) { x -= T[id].poids; if (x <= 0) { choisi = id; break; } }
      out.push(choisi);
      dispo.splice(dispo.indexOf(choisi), 1);
    }
    return out;
  }

  /* Deux traits ne doivent pas se contredire bêtement : un Matinal
     Dormeur est cocasse, un Lent Entêté est une soustraction inutile. */
  const INCOMPATIBLES = [
    ['matinal', 'dormeur'], ['entetes', 'lent'], ['frugal', 'gourmand'],
    ['chanceux', 'superstitieux'], ['econome', 'brouillon'], ['soigneux', 'brouillon'],
    ['bricoleur', 'casseur'], ['robuste', 'fragile'], ['patient', 'reveur'],
    ['avenant', 'grognon'], ['batisseur', 'pantouflard'], ['adroit', 'maladroit'],
    ['solide', 'brute'], ['hardi', 'peureux'],
  ];
  function contredit(liste, id) {
    for (const [a, b] of INCOMPATIBLES) {
      if (a === id && liste.indexOf(b) >= 0) return true;
      if (b === id && liste.indexOf(a) >= 0) return true;
    }
    return false;
  }
  function completer(rng, pool, n, deja) {
    const out = [];
    let garde = 0;
    while (out.length < n && garde++ < 60) {
      const [c] = tirerDans(rng, pool, 1, deja.concat(out));
      if (!c) break;
      if (contredit(deja.concat(out), c)) continue;
      out.push(c);
    }
    return out;
  }

  /* Fabrique un POSTULANT complet : rareté, traits, métier, niveau. */
  function postulant(rng, id, nom, metiers, attrait) {
    const rid = tirerRarete(rng, attrait);
    const R = RARETES[rid];
    const traits = [];
    traits.push.apply(traits, completer(rng, QUALITES, R.q, traits));
    traits.push.apply(traits, completer(rng, DEFAUTS, R.d, traits));
    return {
      id, nom,
      rarete: rid,
      /* Le sexe ne change rien aux chiffres : il ne sert qu'à choisir le
         visage. On le tire ici pour qu'il soit fixé une fois pour
         toutes — un habitant ne doit pas changer de figure d'une
         session à l'autre. */
      sexe: rng() < 0.5 ? 'homme' : 'femme',
      talent: metiers[(rng() * metiers.length) | 0],
      traits,
      niv: R.niv, xp: 0, cycles: 0,
      metierXp: {},
      aventure: { endurance: 1, intelligence: 1, dexterite: 1, force: 1 },
      aff: null,
    };
  }

  /* =================================================================
     LECTURE DES EFFETS
     Un seul endroit sait additionner des traits. Le moteur demande, il
     ne récite pas la liste.
     ================================================================= */
  function listeTraits(h) {
    if (!h) return [];
    if (h.traits && h.traits.length) return h.traits;
    return h.trait ? [h.trait] : [];          // sauvegardes d'avant les portes
  }
  function a(h, id) { return listeTraits(h).indexOf(id) >= 0; }

  function produit(h, champ, ctx) {
    let v = 1;
    for (const t of listeTraits(h)) {
      const d = T[t]; if (!d) continue;
      const f = d[champ];
      if (f == null) continue;
      v *= (typeof f === 'function') ? f(ctx || {}) : f;
    }
    return v;
  }
  function somme(h, champ) {
    let v = 0;
    for (const t of listeTraits(h)) {
      const d = T[t]; if (!d) continue;
      if (typeof d[champ] === 'number') v += d[champ];
    }
    return v;
  }
  function refuse(h, quoi) {
    for (const t of listeTraits(h)) if (T[t] && T[t].refuse === quoi) return true;
    return false;
  }
  /* La probabilité qu'un cycle saute, ou soit gâché : on cumule sans
     jamais dépasser des bornes raisonnables. */
  function chance(h, champ) {
    let v = 0;
    for (const t of listeTraits(h)) { const d = T[t]; if (d && d[champ]) v += d[champ]; }
    return Math.min(0.5, v);
  }

  window.HAB = {
    TRAITS: T, QUALITES, DEFAUTS, RARETES, RARETES_IDS,
    trait: id => T[id] || null,
    listeTraits, a, produit, somme, refuse, chance,
    postulant, tirerRarete, contredit,
  };

})();
