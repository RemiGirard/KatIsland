/* ============================================================
   LE BOURG — donnees/iles.js
   LES ÎLES, ET CE QU'IL EN COÛTE D'Y ALLER.

   Le bourg est sur une île. Tout ce qui n'est pas lui est de l'autre
   côté de l'eau — et l'on n'y va pas en marchant. C'est le PORT qui
   décide désormais de la guerre : on affrète un navire, on le remplit,
   on l'envoie, il navigue, et l'on se bat à l'arrivée.

   Chaque île porte trois nombres que le joueur lit avant de partir :

     · `lieues` — la distance. Elle se paie en TEMPS de traversée, pas
       en matière. Une île proche se harcèle ; une île lointaine
       s'organise, parce que le navire est immobilisé pendant tout le
       trajet et qu'on n'en a qu'un au début.
     · `force` — ce qu'il y a en face, sur dix. C'est l'indicateur, pas
       le calcul : le calcul, c'est `diff`.
     · `menace` — combien la prendre fait retomber la Nuée. C'EST LA
       SEULE FAÇON de faire baisser la jauge : plus on va loin, plus on
       gagne d'air.

   -> window.ILES, window.IleUtil
   ============================================================ */
"use strict";
(function () {

  const I = [];
  /* f(id, nom, lieues, force, diff, noeuds, menace, cout, butin, bonus, desc) */
  function f(id, nom, lieues, force, diff, noeuds, menace, cout, butin, bonus, desc) {
    I.push({ id, nom, lieues, force, diff, noeuds, menace,
             cout: cout || {}, butin: butin || {}, bonus: bonus || {}, desc: desc || '' });
  }

  /* ---------------------------------------------------------------
     DIX COURONNES, DIX FORCES PAR COURONNE.

     La force reste volontairement comprise entre 1 et 10 : elle dit la
     taille de la garnison DANS la couronne. Le tier dit à quel point le
     monde est devenu dangereux. Ainsi une force 1 du tier 6 reste plus
     dure qu'une force 10 du tier 1, sans rendre la jauge illisible.

     Quatre biomes tournent dans chaque couronne. Le nom du PNG reprend
     exactement tier + biome + variante ; l'interface n'a aucun registre
     d'images à maintenir à côté des données.
     --------------------------------------------------------------- */
  const BIOMES = {
    guerriere: {
      nom: ['Bastion', 'Fort', 'Citadelle', 'Camp retranché'],
      desc: "Une île militaire. Ses murailles abritent davantage de garnisons et ses renforts arrivent plus vite.",
      effet: "Garnisons ennemies +30 % · renforts accélérés",
    },
    marecageuse: {
      nom: ['Marais', 'Mangrove', 'Tourbière', 'Eaux mortes'],
      desc: "Une brume vénéneuse rampe entre les racines. Hors de la protection d'un bâtiment, toutes les unités s'affaiblissent peu à peu.",
      effet: "Poison progressif hors des bâtiments",
    },
    volcanique: {
      nom: ['Caldeira', 'Fournaise', 'Île de basalte', 'Mont ardent'],
      desc: "Le sol n'a pas fini de refroidir. Des roches tombent et les impacts laissent des plaques de lave temporaires.",
      effet: "Chutes de roches · flaques de lave",
    },
    arcanique: {
      nom: ['Sanctuaire', 'Observatoire', 'Ruines levantes', 'Couronne de cristal'],
      desc: "Les ruines chargent l'air d'électricité. Des décharges frappent périodiquement les groupes trop serrés.",
      effet: "Orages arcaniques sur les concentrations de troupes",
    },
  };
  const ORDRE_BIOMES = ['guerriere', 'marecageuse', 'volcanique', 'arcanique'];
  const ADJECTIFS = ['Basses', 'Voilées', 'Rousses', 'Anciennes', 'Fendues', 'Perdues', 'Hautes', 'Noires', 'Souveraines', 'Dernières'];

  for (let tier = 1; tier <= 10; tier++) for (let force = 1; force <= 10; force++) {
    const biome = ORDRE_BIOMES[(force + tier - 2) % ORDRE_BIOMES.length];
    const bd = BIOMES[biome];
    const variante = ((force * 3 + tier * 5) % 4) + 1;
    const id = 'couronne-' + tier + '-ile-' + force;
    const nom = bd.nom[(force + tier) % bd.nom.length] + ' des ' + ADJECTIFS[tier - 1];
    const diff = (tier - 1) * 4 + force;
    const lieues = Math.round((tier - 1) * 28 + 1 + force * 2.35);
    const noeuds = Math.min(28, 5 + Math.floor(diff * 0.58));
    const menace = Math.min(60, 5 + tier * 3 + force * 2);
    const butin = { medaille: Math.round((2 + force) * Math.pow(1.72, tier - 1)) };
    if (biome === 'guerriere') butin.acier = Math.round((4 + force * 2) * tier);
    if (biome === 'marecageuse') butin.herbe = Math.round((8 + force * 3) * tier);
    if (biome === 'volcanique') butin.obsidienne = Math.max(1, Math.round((force + tier) / 3));
    if (biome === 'arcanique') butin.essence = Math.round((3 + force) * tier);
    const bonus = force === 10 ? { global: 0.01 + tier * 0.004 } : {};
    f(id, nom, lieues, force, diff, noeuds, menace, {}, butin, bonus,
      bd.desc);
    const ile = I[I.length - 1];
    ile.tier = tier;
    ile.biome = biome;
    ile.effetBiome = bd.effet;
    ile.variante = variante;
    ile.image = 'img/iles/tier-' + String(tier).padStart(2, '0') + '-' + biome +
                '-v' + String(variante).padStart(2, '0') + '.png';
  }

  /* ---------------------------------------------------------------
     LA FLOTTE

     On commence avec UNE barque de vingt places. C'est peu, et c'est
     le sujet : vingt places obligent à choisir ce qu'on embarque. La
     cale s'agrandit par paliers, et l'on finit par armer plusieurs
     navires de mille — mais alors on a une économie derrière.
     --------------------------------------------------------------- */
  const CALES = [
    { places: 20,   nom: 'Barque',        cout: { planche: 30, corde: 10 } },
    { places: 45,   nom: 'Chaloupe',      cout: { planche: 70, corde: 24, toile: 6 } },
    { places: 100,  nom: 'Cogue',         cout: { poutre: 8, planche: 120, toile: 14 } },
    { places: 220,  nom: 'Caraque',       cout: { poutre: 18, planche: 200, toile: 30, lingotfer: 20 } },
    { places: 450,  nom: 'Galion',        cout: { poutre: 34, planche: 340, toile: 60, acier: 24 } },
    { places: 1000, nom: 'Nef de haut bord', cout: { poutre: 60, planche: 600, toile: 120, acier: 60, lingotor: 8 } },
  ];

  /* ---------------------------------------------------------------
     LES VIVRES, EN RATIONS

     Une expédition mange. Longtemps on a demandé un ALIMENT PRÉCIS —
     tant de pain pour la troisième île — et c'était un mur : le pain
     veut une caserne, trois niveaux de champ, un moulin, une cuisine
     et un puits, quand la troisième île est à quatre lieues du quai.
     Le joueur avait un port, des soldats, un bateau, et se voyait
     refuser la mer faute d'un four.

     On ne demande donc plus un aliment mais une QUANTITÉ DE RATIONS,
     que l'on paie avec ce qu'on a. Ce qui change d'un vivre à l'autre,
     c'est sa DENSITÉ : ce qui tient dans une cale et ce qui se garde en
     mer. Le poisson frais nourrit un homme un jour et pourrit ensuite —
     parfait pour aller à trois lieues, ruineux pour aller à vingt. La
     tourte, le fromage et le poisson fumé sont les vraies provisions de
     bord. La cuisine cesse ainsi d'être une barrière pour devenir ce
     qu'elle doit être : un gain de place.
     --------------------------------------------------------------- */
  const RATIONS = {
    /* frais et encombrant — bon pour la première couronne */
    poisson: 1, ble: 1, legume: 1, tournesol: 1, fruit: 1, lait: 1, champignon: 1,
    /* travaillé */
    farine: 2, farineclaire: 2, miel: 2, viande: 3,
    /* provisions de bord : ça se garde */
    confiture: 4, cidre: 4, pain: 5, fromage: 6, poissonfume: 7,
    /* la vraie ration de mer */
    tourte: 14,
  };

  /* Ce qu'il faut embarquer : la distance et le nombre de bouches. Une
     poignée d'éclaireurs pour l'île d'en face ne coûte presque rien ;
     mille hommes vers le large sont une campagne agricole. */
  function rationsRequises(lieues, unites) {
    return Math.max(1, Math.ceil((lieues || 0) * 2.2 + (unites || 0) * 0.55));
  }

  /* Ce que le bourg peut fournir, et dans quel ordre on y puise. On
     entame TOUJOURS par le moins dense : ce qui se garde le moins doit
     partir le premier, et le joueur garde ses tourtes pour le large. */
  function vivresEnStock() {
    const out = [];
    for (const id in RATIONS) {
      const n = window.Etat ? window.Etat.qte(id) : 0;
      if (n > 0) out.push({ res: id, n, parUnite: RATIONS[id] });
    }
    out.sort((a, b) => a.parUnite - b.parUnite);
    return out;
  }
  function rationsDisponibles() {
    let t = 0;
    for (const v of vivresEnStock()) t += v.n * v.parUnite;
    return t;
  }
  /* Le détail de ce qui sera prélevé, sans rien dépenser : la fenêtre du
     port le montre avant que le joueur ne s'engage. */
  function prelevementPour(rations) {
    const pris = {};
    let reste = rations;
    for (const v of vivresEnStock()) {
      if (reste <= 0) break;
      const n = Math.min(v.n, Math.ceil(reste / v.parUnite));
      if (n <= 0) continue;
      pris[v.res] = n;
      reste -= n * v.parUnite;
    }
    return { cout: pris, manque: Math.max(0, reste) };
  }

  /* Le prix d'un navire SUPPLÉMENTAIRE. Il monte franchement : une
     flotte est un luxe, et le bourg doit le mériter deux fois. */
  function coutNavire(n) {
    const k = Math.pow(2.35, n);
    return {
      planche: Math.round(60 * k), corde: Math.round(20 * k),
      poutre: Math.round(4 * k), toile: Math.round(8 * k),
    };
  }

  /* LE TEMPS DE MER. Une lieue vaut quarante secondes à la voile ; un
     navire plus grand porte plus de toile et va donc plus vite, mais à
     peine — ce qu'on gagne en cale, on le paie en inertie.

     LE GRÉEMENT, lui, change tout : c'est la seule chose qui rende le
     Grand Large praticable. Sans lui, trois cents lieues font trois
     heures et demie de mer ; au dernier palier, moins d'une heure.
     On le lit de l'état quand l'appelant ne le précise pas — il n'y a
     qu'un bourg, donc qu'un chantier naval. */
  function greementCourant() {
    try { return (window.Port && window.Port.greement) ? window.Port.greement() : 0; }
    catch (e) { return 0; }
  }
  function traversee(lieues, palier, gr) {
    const vent = 1 - Math.min(0.34, palier * 0.07);
    const g = gr == null ? greementCourant() : gr;
    const toile = 1 - (window.Greement ? window.Greement.viteDe(g) : 0);
    return Math.max(4, Math.round(lieues * 40 * vent * toile));
  }

  /* Une destination peut venir de la couronne locale OU du Grand Large.
     Tout le reste du jeu — le port, les bonus permanents, le bilan de
     bataille — passe par ici et n'a donc pas à savoir laquelle. */
  const ANCIENNES = ['berges','taillis','carriere','paturage','plateau','saline',
    'boisancien','veine','falaise','gouffre','minesnoires','aire'];
  function parId(id) {
    const local = I.find(x => x.id === id);
    if (local) return local;
    const ancien = ANCIENNES.indexOf(id);
    if (ancien >= 0) return I[Math.min(I.length - 1, ancien)];
    return (window.LARGE && window.LARGE.find(x => x.id === id)) || null;
  }
  function couronne(n) {
    n = Math.max(1, Math.min(10, n | 0));
    return I.filter(x => x.tier === n);
  }
  function visibles() {
    const n = window.Port && window.Port.rayon ? window.Port.rayon() : 1;
    return couronne(Math.min(10, n));
  }
  /* Une même sauvegarde garde toujours la même silhouette, mais deux îles
     du même biome ne sont pas condamnées à partager le même dessin. La
     graine du bourg choisit parmi les quatre variantes de la planche. */
  function imagePour(ile) {
    if (!ile || !ile.tier || !ile.biome) return ile && ile.image;
    const graine = (window.Etat && window.Etat.E && window.Etat.E.graine) || 1;
    let h = (graine ^ 2166136261) >>> 0;
    const txt = ile.id + ':' + ile.biome;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    const v = (h >>> 0) % 4 + 1;
    return 'img/iles/tier-' + String(ile.tier).padStart(2, '0') + '-' + ile.biome +
      '-v' + String(v).padStart(2, '0') + '.png';
  }
  /* Toutes les destinations, les deux théâtres confondus. */
  function toutes() { return I.concat(window.LARGE || []); }
  /* Le onzième élargissement ouvre l'ancienne carte du Grand Large. */
  function largeOuvert() {
    return !!(window.Port && window.Port.rayon && window.Port.rayon() > 10);
  }
  function palierDe(places) {
    let k = 0;
    for (let i = 0; i < CALES.length; i++) if (CALES[i].places <= places) k = i;
    return k;
  }

  window.ILES = I;
  window.IleUtil = { CALES, coutNavire, traversee, parId, palierDe,
                     RATIONS, rationsRequises, rationsDisponibles, prelevementPour, vivresEnStock,
                     toutes, couronne, visibles, imagePour, BIOMES, largeOuvert };

})();
