/* ============================================================
   LE BOURG — js/etat.js
   L'état de la partie, sa sauvegarde, et les règles d'accès aux
   ressources (plafonds de stockage, dépense, encaissement).

   Tout ce que le joueur possède tient dans un seul objet sérialisable.
   Les autres modules NE MODIFIENT JAMAIS `E` directement : ils passent
   par les fonctions de ce fichier, qui sont les seules à connaître les
   plafonds, la perte au débordement et le journal.
   -> window.Etat
   ============================================================ */
"use strict";
(function () {

  const CLE = 'bourg.sauvegarde.v1';
  const VERSION = 2;

  /* ---------------- noms d'habitants ---------------- */
  const PRENOMS = ['Moustache','Grisou','Pistache','Nougat','Salsifis','Bouchon','Câpre','Réglisse',
    'Pruneau','Girofle','Tourbe','Praline','Sarrasin','Muscade','Chicorée','Bergamote','Écorce',
    'Silex','Bruyère','Genièvre','Verjus','Tourteau','Poivre','Amande','Cresson','Fenouil',
    'Ardoise','Chanvre','Osier','Gravier','Sureau','Coriandre','Millet','Ortie','Tanaisie',
    'Bourrache','Cardamome','Estragon','Livèche','Marjolaine','Absinthe','Angélique'];
  const SURNOMS = ['le Court','aux Yeux Pâles','la Rousse','le Boiteux','du Quai','des Hauts',
    "d'en Bas",'le Silencieux','la Vive','le Patient','aux Grandes Oreilles','le Tondu',
    'la Grimpeuse','de la Meule','le Trempé','au Long Dos'];

  let compteurNom = 0;
  function nomHabitant(rng) {
    const p = PRENOMS[(rng() * PRENOMS.length) | 0];
    const s = rng() < 0.35 ? ' ' + SURNOMS[(rng() * SURNOMS.length) | 0] : '';
    compteurNom++;
    return p + s;
  }

  /* Les traits vivent dans donnees/habitants.js — un habitant en porte
     désormais plusieurs, qualités et défauts mêlés. */
  const TRAITS = window.HAB.TRAITS;
  const TRAITS_IDS = Object.keys(TRAITS);

  function xpPourNiveau(n) { return Math.round(60 * Math.pow(1.30, Math.max(0, n - 1))); }
  function rangHabitant(h) { return (h && h.niv) || 1; }
  const ATTRS_AVENTURE = ['endurance', 'intelligence', 'dexterite', 'force'];
  function progressionInfinie(xp, base, croissance) {
    xp = Math.max(0, Number(xp) || 0);
    base = Math.max(1, base || 100);
    croissance = Math.max(1.01, croissance || 1.30);
    let niveau = 1, seuil = base, restant = xp, garde = 0;
    while (restant >= seuil && garde++ < 100000) {
      restant -= seuil;
      niveau++;
      seuil = Math.max(1, Math.round(seuil * croissance));
    }
    return { niveau, dans: restant, pour: seuil, pct: Math.min(1, restant / seuil) };
  }
  function assurerProgression(h) {
    if (!h) return;
    if (!h.metierXp || typeof h.metierXp !== 'object') h.metierXp = {};
    if (!h.caracXp || typeof h.caracXp !== 'object') h.caracXp = {};
    /* Migration des premières sauvegardes où les caractéristiques étaient
       stockées directement comme niveaux. */
    for (const a of ATTRS_AVENTURE) {
      if (typeof h.caracXp[a] !== 'number') {
        const ancienNiveau = h.aventure && typeof h.aventure[a] === 'number' ? h.aventure[a] : 1;
        let xp = 0, seuil = 20;
        for (let n = 1; n < ancienNiveau; n++) { xp += seuil; seuil = Math.round(seuil * 1.28); }
        h.caracXp[a] = xp;
      }
    }
    if (h.aventure) delete h.aventure;
  }
  function progresMetierHabitant(h, metier) {
    assurerProgression(h);
    return progressionInfinie(h && h.metierXp ? h.metierXp[metier] : 0, 100, 1.35);
  }
  function progresAttributHabitant(h, attribut) {
    assurerProgression(h);
    return progressionInfinie(h && h.caracXp ? h.caracXp[attribut] : 0, 20, 1.28);
  }
  function gagnerXpHabitant(h, n, metier) {
    if (!h || !n) return;
    assurerProgression(h);
    if (metier) h.metierXp[metier] = (h.metierXp[metier] || 0) + n;
    h.xp = (h.xp || 0) + n * (1 + ((window.Jeu && window.Jeu.acquis) ? window.Jeu.acquis().xp : 0));
    let garde = 0;
    while (h.xp >= xpPourNiveau(h.niv || 1) && garde++ < 100000) {
      h.xp -= xpPourNiveau(h.niv || 1);
      h.niv = (h.niv || 1) + 1;
      journal(h.nom + ' passe au niveau ' + h.niv + '.', 'rang');
      prevenir('niveauHabitant', h);
    }
  }
  function gagnerAttribut(h, attribut, n) {
    if (!h || !ATTRS_AVENTURE.includes(attribut) || !n) return;
    assurerProgression(h);
    h.caracXp[attribut] = Math.max(0, (h.caracXp[attribut] || 0) + n);
    prevenir('attributHabitant', h);
  }

  /* ---------------- l'état neuf ---------------- */
  function neuf(graine) {
    const rng = mulberry(graine || ((Math.random() * 1e9) | 0));
    const E = {
      v: VERSION,
      graine: graine || ((Math.random() * 1e9) | 0),
      nomBourg: '',
      t: Date.now(),
      tJeu: 0,                       // secondes de jeu écoulées
      heure: 0.30,                   // position dans la journée (0..1)

      res: {},                       // id de ressource -> quantité
      gaspille: {},                  // ce qui a débordé, pour le dire au joueur

      bat: {},                       // idInstance -> { type, niv, xp, outil, postes[] , enChantier }
      seqBat: 0,

      habitants: [],                 // { id, nom, aff:{k:'poste'|'chantier'|'garnison', bat, i} }
      seqHab: 0,

      chantier: { file: [], prog: 0, ouvriers: [] },

      metiers: {},                   // id de métier -> xp
      recherches: {},                // les acquis définitifs du bourg

      moral: 50,
      menace: 0,
      jours: 0,
      raids: 0,

      armee: { unites: 0, xp: 0, palierArme: 0, palierArmure: 0, garnison: 0,
        equipement: {
          melee: { arme: 0, armure: 0 }, distance: { arme: 0, armure: 0 }, magie: { arme: 0, armure: 0 },
        }, forge: null },
      territoires: [],               // zones conquises en expédition
      expedition: null,              // bataille en cours (sérialisée)
      aventure: { profondeur: 0, record: 0, encours: null, sacoche: {} },

      /* LES PORTES DU BOURG. On n'accueille personne par hasard : quand
         un toit est libre, on ouvre, trois postulants se présentent, on
         en garde un. Renvoyer quelqu'un barre les portes et laisse un
         MALAISE qui pèse sur tout le bourg. */
      portes: { postulants: null, barrees: 0, renvois: 0, accueillis: 0, refus: 0 },
      malaise: { reste: 0, force: 0 },
      memorial: [],                  // ceux qui sont partis, et comment

      vus: {},                       // ce que le joueur a déjà découvert (pour l'UI)
      journal: [],
      options: { vitesseJour: 1 / 260, sonsCoupes: true, dockOuvert: true },
    };
    for (const id in window.RES) E.res[id] = 0;
    for (const m in window.METIERS) E.metiers[m] = 0;
    // le premier habitant : c'est tout ce qu'a le bourg
    E.habitants.push(fabriquerHabitant(rng, 'h' + (++E.seqHab), 0));
    E.vus.pecherie = true;
    return E;
  }

  /* Un habitant NEUF, tiré au sort sans postulants — c'est le premier
     du bourg, ou un renfort accordé par un événement. */
  function fabriquerHabitant(rng, id, quand, attrait) {
    const metiers = Object.keys(window.METIERS);
    const p = window.HAB.postulant(rng, id, nomHabitant(rng), metiers,
                                   attrait == null ? 0 : attrait);
    p.arrive = quand || 0;
    return p;
  }

  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let E = neuf();
  const abonnes = [];

  function prevenir(quoi, data) {
    for (const f of abonnes) { try { f(quoi, data); } catch (e) { console.warn(e); } }
  }

  /* =================================================================
     PLAFONDS DE STOCKAGE
     Chaque catégorie a son plafond, somme du plafond de base et de ce
     qu'apportent les bâtiments de stockage. Ce qui dépasse est PERDU —
     et le joueur en est averti, sinon il croit à un bug.
     ================================================================= */
  let capCache = null, capVer = 0;
  function invaliderCap() { capCache = null; }

  function plafonds() {
    if (capCache) return capCache;
    const out = Object.assign({}, window.PLAFOND_BASE);
    for (const bid in E.bat) {
      const b = E.bat[bid];
      const s = window.BatUtil.stockDe(b.type, b.niv);
      if (!s) continue;
      for (const c in s) out[c] = (out[c] || 0) + s[c];
    }
    /* les recherches de greniers et de halles montent TOUS les plafonds */
    const k = 1 + ((window.Jeu && window.Jeu.acquis) ? window.Jeu.acquis().stock : 0);
    if (k > 1) for (const c in out) if (out[c] < 9000) out[c] = Math.round(out[c] * k);
    capCache = out;
    return out;
  }
  function plafondDe(resId) {
    const r = window.RES[resId];
    if (!r) return Infinity;
    return plafonds()[r.cat] != null ? plafonds()[r.cat] : Infinity;
  }

  /* ---------------- lecture / écriture des ressources ---------------- */
  function qte(id) { return E.res[id] || 0; }

  function assez(cout) {
    for (const id in cout) if (qte(id) < cout[id]) return false;
    return true;
  }
  function manque(cout) {
    const out = [];
    for (const id in cout) if (qte(id) < cout[id]) out.push({ id, il: qte(id), faut: cout[id] });
    return out;
  }
  function depenser(cout) {
    if (!assez(cout)) return false;
    for (const id in cout) E.res[id] = qte(id) - cout[id];
    invaliderCap();
    return true;
  }
  /* Encaisser en respectant le plafond. Renvoie ce qui a RÉELLEMENT été
     rangé — l'appelant peut ainsi dire « 3 perdus, la grange est pleine ». */
  function gagner(id, n) {
    if (!window.RES[id] || n <= 0) return 0;
    const cap = plafondDe(id);
    const avant = qte(id);
    const place = Math.max(0, cap - avant);
    const pris = Math.min(n, place);
    E.res[id] = avant + pris;
    const perdu = n - pris;
    if (perdu > 0) {
      /* LE FACTEUR DE COMMERCE, s'il est en fonction, rachète ce qui
         déborde au lieu de le laisser pourrir sur le quai. */
      const vendu = (window.Auto && window.Auto.vendreDebordement) ? window.Auto.vendreDebordement(id, perdu) : 0;
      if (!vendu) {
        E.gaspille[id] = (E.gaspille[id] || 0) + perdu;
        prevenir('debordement', { id, perdu });
      }
    }
    if (pris > 0 && !E.vus['res:' + id]) { E.vus['res:' + id] = true; prevenir('decouverte', { res: id }); }
    invaliderCap();
    return pris;
  }
  function gagnerLot(lot) {
    const recu = {};
    for (const id in lot) { const n = gagner(id, lot[id]); if (n) recu[id] = n; }
    return recu;
  }

  /* =================================================================
     CE QUI EST CONQUIS

     Deux registres pour une raison d'histoire. L'ancienne conquête de
     ZONE inscrivait sa prise dans `territoires` ; depuis que le portail
     a disparu et que toute la guerre part du port, une victoire s'écrit
     dans `port.prises`. Or huit lecteurs — les trois objectifs de
     conquête, la montée de la Nuée, la force des raids, le prestige et
     deux affichages — comptaient encore le seul premier registre, qui
     ne bouge donc plus jamais. Le joueur prenait douze îles et voyait
     « Territoires : 0 », avec trois objectifs indécrochables.

     On expose ici LA source unique, dédoublonnée : une île et l'ancienne
     zone qui lui correspond portent le même identifiant, et ne doivent
     compter que pour une.
     ================================================================= */
  function conquetes() {
    const vus = Object.create(null), out = [];
    for (const id of (E.territoires || [])) if (!vus[id]) { vus[id] = 1; out.push(id); }
    for (const id of ((E.port && E.port.prises) || [])) if (!vus[id]) { vus[id] = 1; out.push(id); }
    return out;
  }
  function nbConquetes() { return conquetes().length; }

  /* =================================================================
     BÂTIMENTS
     ================================================================= */
  function batsDeType(type) {
    const out = [];
    for (const id in E.bat) if (E.bat[id].type === type) out.push(E.bat[id]);
    return out;
  }
  function nivDeType(type) {
    let n = 0;
    for (const id in E.bat) if (E.bat[id].type === type && E.bat[id].niv > n) n = E.bat[id].niv;
    return n;
  }
  function aBatiment(type) { return nivDeType(type) > 0; }

  function creerBatiment(type, idVillage) {
    const def = window.BAT[type];
    const b = {
      id: idVillage, type, niv: 1, xp: 0,
      outil: null,                       // { type:'outil'|'outilacier', restant:n }
      am: {},                            // améliorations d'atelier achetées
      raff: {},                          // annexes bâties : { abattoir:true, … }
      postes: [], endommage: 0,
    };
    majPostes(b);
    E.bat[b.id] = b;
    E.vus['bat:' + type] = true;
    invaliderCap();
    return b;
  }
  function majPostes(b) {
    /* le nombre de postes tient compte des établis achetés et des
       recherches : c'est le moteur qui sait, pas la table. */
    const n = (window.Jeu && window.Jeu.postesEffectifs)
      ? window.Jeu.postesEffectifs(b) : window.BatUtil.postesDe(b.type, b.niv);
    /* `reste` : combien de cycles il reste à faire (null = en boucle).
       `file`  : ce qui prendra le relais quand celui-ci sera épuisé. */
    while (b.postes.length < n)
      b.postes.push({ rec: null, prog: 0, hab: null, bloque: false, cycles: 0, reste: null, file: [] });
    for (const p of b.postes) { if (!p.file) p.file = []; if (p.reste === undefined) p.reste = null; }
    while (b.postes.length > n) {
      const p = b.postes.pop();
      if (p && p.hab) libererHabitant(p.hab);
    }
  }

  /* =================================================================
     HABITANTS
     ================================================================= */
  function habitant(id) { return E.habitants.find(h => h.id === id) || null; }
  function habitantsLibres() { return E.habitants.filter(h => !h.aff); }
  function ajouterHabitant(attrait) {
    const rng = mulberry((E.graine ^ (E.seqHab * 2654435761) ^ ((E.tJeu * 1000) | 0)) >>> 0);
    const h = fabriquerHabitant(rng, 'h' + (++E.seqHab), E.tJeu, attrait);
    E.habitants.push(h);
    prevenir('habitant', h);
    return h;
  }
  /* Combien d'habitants AU TRAVAIL portent un trait donné — sert aux auras. */
  function compteTrait(t) {
    let n = 0;
    for (const h of E.habitants) if (h.aff && window.HAB.a(h, t)) n++;
    return n;
  }

  /* =================================================================
     LES PORTES DU BOURG

     Un toit libre est une INVITATION, pas une arrivée. Le joueur ouvre
     les portes lui-même : trois postulants se présentent, il en garde
     un — et les deux autres repartent pour de bon. C'est le seul
     endroit du jeu où l'on choisit QUI vit là.

     Le prix n'est pas en écus mais en vivres : on n'ouvre pas sa porte
     la grange vide. Et si l'on renvoie quelqu'un, la nouvelle court :
     les portes restent closes un moment, et le bourg boude.
     ================================================================= */
  function placesLibres() { return Math.max(0, logementTotal() - E.habitants.length); }
  function portesBarrees() { return Math.max(0, (E.portes.barrees || 0) - E.tJeu); }

  /* De quoi nourrir la bouche de plus, d'avance : le coût monte avec la
     population, pour qu'un bourg de trente ne recrute pas comme un
     bourg de trois. */
  /* CE QUE COÛTE UNE BOUCHE DE PLUS.

     C'était 24 + 7 par habitant : trente et un repas pour le PREMIER,
     soit une trentaine de poissons, quand le bourg n'a qu'un pêcheur et
     qu'il mange déjà. Sept minutes de pêche pour une paire de pattes,
     alors que les portes sont la principale source d'habitants — le
     début de partie s'en trouvait bloqué net.

     On garde la pente — chaque bouche rend la suivante plus chère,
     c'est ce qui empêche d'empiler le bourg sans nourrir — mais on
     abaisse la marche d'entrée. */
  function coutAccueil() {
    return Math.round(12 + 6 * E.habitants.length);
  }
  function vivresDisponibles() {
    let p = 0;
    const POR = (window.Jeu && window.Jeu.PORTIONS) || {};
    for (const id in POR) p += qte(id) * POR[id];
    return p;
  }
  /* CE QUI VA RÉELLEMENT SORTIR DE LA GRANGE.

     Le coût s'exprimait en « portions » — une unité qui n'existe nulle
     part ailleurs dans le jeu, qu'aucun compteur n'affiche et qu'aucune
     recette ne rend. Le joueur lisait « 24 portions » et n'avait aucun
     moyen de savoir s'il en avait, ni comment en faire.

     La quantité reste juste : c'est ainsi qu'on paie un repas selon ce
     qui nourrit. Mais on peut MONTRER le panier exact avant de le
     prendre — un poisson, deux blés — et l'abstraction disparaît.

     `apercu` : on calcule sans rien dépenser. Le même code sert donc à
     l'affichage et au paiement, et les deux ne peuvent pas diverger. */
  function panierAccueil(apercu) {
    const POR = (window.Jeu && window.Jeu.PORTIONS) || {};
    let reste = coutAccueil();
    const ordre = (window.Jeu && window.Jeu.ORDRE_REPAS) || Object.keys(POR);
    const panier = {};
    for (const id of ordre) {
      if (reste <= 0) break;
      const dispo = qte(id); if (dispo <= 0) continue;
      const pris = Math.min(dispo, Math.ceil(reste / POR[id]));
      panier[id] = pris;
      reste -= pris * POR[id];
      if (!apercu) E.res[id] = dispo - pris;
    }
    if (!apercu) invaliderCap();
    return { panier, manque: Math.max(0, reste), suffit: reste <= 0 };
  }
  function apercuAccueil() { return panierAccueil(true); }
  function payerAccueil() { return panierAccueil(false).suffit; }

  /* L'ATTRAIT DU BOURG : ce qui décide de la qualité du tirage. */
  function attraitBourg() {
    let a = (E.moral - 50) / 34;                       // le moral, d'abord
    for (const bid in E.bat) {
      const b = E.bat[bid];
      const def = window.BAT[b.type];
      if (def && def.effet && def.effet.attrait) a += def.effet.attrait * (1 + 0.3 * (b.niv - 1));
    }
    if (window.Jeu && window.Jeu.acquis) a += window.Jeu.acquis().immigration * 2;
    a -= (E.portes.renvois || 0) * 0.25;               // le bourg a une réputation
    a -= Math.min(4, E.portes.refus || 0) * 0.35;       // faire venir puis refuser se sait aussi
    return Math.max(0, a);
  }

  function peutOuvrirPortes() {
    if (placesLibres() <= 0) return { ok: false, pourquoi: 'Aucun toit libre. Bâtissez un logement.' };
    if (portesBarrees() > 0) return { ok: false, pourquoi: 'Les portes sont closes : personne ne se présentera avant un moment.' };
    if (E.portes.postulants) return { ok: true, deja: true };
    if (vivresDisponibles() < coutAccueil())
      return { ok: false, pourquoi: 'Pas assez de vivres pour nourrir une bouche de plus.' };
    return { ok: true };
  }

  /* Ouvrir : on tire TROIS postulants, et on les garde en mémoire. Le
     joueur peut refermer la fenêtre et revenir : ce sont les mêmes
     trois. On ne relance pas les dés en fermant les yeux. */
  function ouvrirPortes() {
    const v = peutOuvrirPortes();
    if (!v.ok) return null;
    if (E.portes.postulants) return E.portes.postulants;
    if (!payerAccueil()) return null;
    const metiers = Object.keys(window.METIERS);
    const attrait = attraitBourg();
    const lot = [];
    const pris = [];
    for (let k = 0; k < 3; k++) {
      const rng = mulberry((E.graine ^ ((E.portes.accueillis + 1) * 40503) ^
                            (k * 2654435761) ^ ((E.tJeu * 997) | 0)) >>> 0);
      /* trois voyageurs, trois prénoms : deux Praline à la même porte,
         et le joueur ne sait plus lequel il a pris. */
      let nom = nomHabitant(rng), garde = 0;
      while (garde++ < 24 && pris.some(x => x.split(' ')[0] === nom.split(' ')[0])) nom = nomHabitant(rng);
      pris.push(nom);
      const p = window.HAB.postulant(rng, 'p' + k, nom, metiers, attrait);
      p.arrive = E.tJeu;
      lot.push(p);
    }
    E.portes.postulants = lot;
    journal('Les portes s\'ouvrent : trois voyageurs demandent à rester.', 'info');
    prevenir('portes', lot);
    return lot;
  }

  function accueillir(k) {
    const lot = E.portes.postulants;
    if (!lot || !lot[k]) return null;
    if (placesLibres() <= 0) return null;
    const p = lot[k];
    p.id = 'h' + (++E.seqHab);
    p.arrive = E.tJeu;
    E.habitants.push(p);
    E.portes.postulants = null;
    E.portes.accueillis = (E.portes.accueillis || 0) + 1;
    journal(p.nom + ' pose son sac au bourg — ' + window.HAB.RARETES[p.rarete].nom.toLowerCase() + '.', 'bien');
    prevenir('habitant', p);
    return p;
  }

  /* Renvoyer les trois : ce n'est pas un bouton pour relancer le tirage.
     Le premier refus ferme déjà les portes quatre heures réelles ; les
     suivants durent davantage. Pendant ce temps le bourg perd du moral
     et travaille moins vite. Le rattrapage hors-ligne fait bien avancer
     cette attente, comme le reste de l'économie. */
  function apercuRefus() {
    const n = E.portes.refus || 0;
    return {
      duree: Math.round(4 * 3600 * Math.pow(1.35, Math.min(4, n))),
      force: Math.min(0.35, 0.20 + 0.04 * Math.min(4, n)),
      moral: Math.min(24, 12 + n * 3),
    };
  }
  function refuserTous() {
    if (!E.portes.postulants) return false;
    const peine = apercuRefus();
    E.portes.postulants = null;
    E.portes.refus = (E.portes.refus || 0) + 1;
    E.portes.barrees = Math.max(E.portes.barrees || 0, E.tJeu + peine.duree);
    E.malaise = { reste: peine.duree, total: peine.duree, force: peine.force,
                  raison: 'refus aux portes' };
    E.moralBonus = (E.moralBonus || 0) - peine.moral;
    invaliderCap();
    journal('Les trois voyageurs sont repartis. Les portes resteront closes ' +
      Math.round(peine.duree / 3600) + ' h et le bourg tourne au ralenti.', 'alerte');
    prevenir('portes', null);
    return peine;
  }

  /* =================================================================
     RENVOYER QUELQU'UN — et ce que ça coûte

     Le bourg n'oublie pas. Chaque départ forcé barre les portes plus
     longtemps que le précédent, laisse un MALAISE qui ralentit tout le
     monde, et fait tomber le moral. C'est réversible, mais lentement.
     Un mort dans la tour compte pareil : la peine est la même.
     ================================================================= */
  function peineDeDepart(raison) {
    const n = (E.portes.renvois || 0);
    const duree = Math.round(180 * Math.pow(1.35, Math.min(6, n)));
    E.portes.renvois = n + 1;
    E.portes.barrees = Math.max(E.portes.barrees || 0, E.tJeu + duree);
    E.portes.postulants = null;
    const force = Math.min(0.42, 0.14 + 0.05 * Math.min(5, n));
    E.malaise = { reste: Math.round(duree * 1.4), total: Math.round(duree * 1.4), force,
                  raison: raison || 'renvoi' };
    E.moralBonus = (E.moralBonus || 0) - 14;
    invaliderCap();
    return { duree, force };
  }

  function renvoyer(hid) {
    const h = habitant(hid); if (!h) return null;
    libererHabitant(hid);
    const i = E.habitants.indexOf(h);
    if (i >= 0) E.habitants.splice(i, 1);
    E.memorial.unshift({ nom: h.nom, rarete: h.rarete, niv: h.niv, t: E.tJeu, fin: 'renvoyé' });
    if (E.memorial.length > 40) E.memorial.length = 40;
    const p = peineDeDepart('renvoi');
    journal(h.nom + ' est prié de partir. Le bourg le prend mal.', 'alerte');
    prevenir('depart', { h, peine: p, fin: 'renvoyé' });
    return p;
  }

  /* Perdu dans la tour : même peine, autre récit. */
  /* =================================================================
     LES NEUF VIES

     Un chat qui tombe dans la tour ne meurt pas : il y laisse une vie.
     Neuf fois, on peut descendre chercher le corps et payer le rite. La
     dixième, il n'y a plus rien à ramener.

     Le compteur vit sur l'habitant, pas sur la descente : c'est une
     propriété du chat, qu'il emporte d'une expédition à l'autre. Une
     sauvegarde d'avant n'en a pas — on la considère intacte, neuf vies
     pleines, plutôt que de punir après coup des chats déjà tombés.
     ================================================================= */
  const VIES_MAX = 9;
  function vies(h) {
    if (!h) return 0;
    if (h.vies == null) h.vies = VIES_MAX;
    return h.vies;
  }
  /* Rend ce qu'il reste APRÈS le coup. Zéro veut dire : plus de rite
     possible, l'appelant doit passer par `perdre`. */
  function perdreVie(hid) {
    const h = habitant(hid); if (!h) return 0;
    h.vies = Math.max(0, vies(h) - 1);
    prevenir('vieHabitant', h);
    return h.vies;
  }
  /* Le rite ne rend PAS la vie dépensée — sinon il n'y aurait pas de
     compte à tenir. Cette porte existe pour ce qui viendra plus tard :
     un repos long, une relique, une fête. */
  function rendreVie(hid, n) {
    const h = habitant(hid); if (!h) return 0;
    h.vies = Math.min(VIES_MAX, vies(h) + (n || 1));
    prevenir('vieHabitant', h);
    return h.vies;
  }

  function perdre(hid, ou) {
    const h = habitant(hid); if (!h) return null;
    libererHabitant(hid);
    const i = E.habitants.indexOf(h);
    if (i >= 0) E.habitants.splice(i, 1);
    E.memorial.unshift({ nom: h.nom, rarete: h.rarete, niv: h.niv, t: E.tJeu,
                         fin: ou ? ('perdu — ' + ou) : 'perdu dans la tour' });
    if (E.memorial.length > 40) E.memorial.length = 40;
    const p = peineDeDepart('perte');
    journal(h.nom + ' n\'est pas remonté. Le bourg fait silence.', 'alerte');
    prevenir('depart', { h, peine: p, fin: 'perdu' });
    return p;
  }

  /* Le malaise s'efface tout seul, à condition qu'on lui laisse le temps. */
  function tickMalaise(dt) {
    if (!E.malaise || !E.malaise.reste) return;
    E.malaise.reste = Math.max(0, E.malaise.reste - dt);
    if (!E.malaise.reste) {
      E.malaise = { reste: 0, force: 0 };
      journal('Le bourg a tourné la page.', 'bien');
    }
  }
  function facteurMalaise() {
    if (!E.malaise || !E.malaise.reste) return 1;
    const u = E.malaise.reste / Math.max(1, E.malaise.total || 1);
    return 1 - E.malaise.force * u;
  }
  function logementTotal() {
    let n = 2;                            // deux paillasses au fond de la première cabane
    const parMaison = (window.Jeu && window.Jeu.acquis) ? window.Jeu.acquis().logementParMaison : 0;
    for (const bid in E.bat) {
      const b = E.bat[bid];
      const l = window.BatUtil.logementDe(b.type, b.niv);
      if (l) n += l + (b.type === 'maison' ? parMaison : 0);
    }
    return n;
  }
  function libererHabitant(hid) {
    const h = habitant(hid); if (!h) return;
    if (h.aff && h.aff.k === 'poste') {
      const b = E.bat[h.aff.bat];
      if (b && b.postes[h.aff.i] && b.postes[h.aff.i].hab === hid) {
        b.postes[h.aff.i].hab = null;
        b.postes[h.aff.i].prog = 0;
      }
    } else if (h.aff && h.aff.k === 'chantier') {
      const k = E.chantier.ouvriers.indexOf(hid);
      if (k >= 0) E.chantier.ouvriers.splice(k, 1);
    }
    h.aff = null;
    prevenir('affectation', h);
  }
  function affecterPoste(hid, bid, i) {
    const h = habitant(hid), b = E.bat[bid];
    if (!h || !b || !b.postes[i]) return false;
    if (b.postes[i].hab && b.postes[i].hab !== hid) libererHabitant(b.postes[i].hab);
    libererHabitant(hid);
    b.postes[i].hab = hid;
    h.aff = { k: 'poste', bat: bid, i };
    prevenir('affectation', h);
    return true;
  }
  function affecterChantier(hid) {
    const h = habitant(hid); if (!h) return false;
    libererHabitant(hid);
    E.chantier.ouvriers.push(hid);
    h.aff = { k: 'chantier' };
    prevenir('affectation', h);
    return true;
  }

  /* =================================================================
     MÉTIERS — l'expérience est commune au bourg, pas à l'individu.
     Un bourg qui a beaucoup pêché pêche vite, quel que soit le pêcheur.
     ================================================================= */
  function rangMetier(m) {
    const xp = E.metiers[m] || 0;
    // 100 xp pour le rang 2, puis +35 % à chaque rang
    let r = 1, seuil = 100, cum = 0;
    while (cum + seuil <= xp && r < 60) { cum += seuil; seuil = Math.round(seuil * 1.35); r++; }
    return r;
  }
  function progresMetier(m) {
    const xp = E.metiers[m] || 0;
    let r = 1, seuil = 100, cum = 0;
    while (cum + seuil <= xp && r < 60) { cum += seuil; seuil = Math.round(seuil * 1.35); r++; }
    return { rang: r, dans: xp - cum, pour: seuil };
  }
  function gagnerXp(m, n) {
    if (!m || !n) return;
    const avant = rangMetier(m);
    const k = 1 + ((window.Jeu && window.Jeu.acquis) ? window.Jeu.acquis().xp : 0);
    E.metiers[m] = (E.metiers[m] || 0) + n * k;
    const apres = rangMetier(m);
    if (apres > avant) { journal('Rang de ' + window.METIERS[m].nom + ' : ' + apres, 'rang'); prevenir('rang', { m, rang: apres }); }
  }

  /* =================================================================
     JOURNAL — la mémoire courte du bourg, lue par le dock.
     ================================================================= */
  function journal(txt, genre) {
    E.journal.unshift({ t: E.tJeu, txt, genre: genre || 'info' });
    if (E.journal.length > 160) E.journal.length = 160;
    prevenir('journal', E.journal[0]);
  }

  /* =================================================================
     SAUVEGARDE
     ================================================================= */
  let tDerniereSauve = 0;
  function sauver(force) {
    const now = Date.now();
    if (!force && now - tDerniereSauve < 4000) return;
    tDerniereSauve = now;
    E.t = now;
    try { localStorage.setItem(CLE, JSON.stringify(E)); }
    catch (e) { console.warn('sauvegarde impossible :', e.message); }
  }
  function charger() {
    let brut = null;
    try { brut = localStorage.getItem(CLE); } catch (e) { return false; }
    if (!brut) return false;
    try {
      const d = JSON.parse(brut);
      if (!d || (d.v !== VERSION && d.v !== 1)) return false;
      // on complète : une sauvegarde d'hier peut ignorer une ressource d'aujourd'hui
      for (const id in window.RES) if (d.res[id] == null) d.res[id] = 0;
      for (const m in window.METIERS) if (d.metiers[m] == null) d.metiers[m] = 0;
      /* une sauvegarde d'avant les portes : chacun garde le trait qu'il
         avait, on lui en tire un second et une rareté, de façon
         déterministe — pour qu'il ne change plus jamais ensuite. */
      const metiers = Object.keys(window.METIERS);
      for (const h of (d.habitants || [])) {
        const rng = mulberry((d.graine ^ (parseInt(String(h.id).slice(1), 10) * 2654435761)) >>> 0);
        if (!h.talent) h.talent = metiers[(rng() * metiers.length) | 0];
        if (typeof h.niv !== 'number') h.niv = 1;
        if (typeof h.xp !== 'number') h.xp = 0;
        assurerProgression(h);
        if (typeof h.cycles !== 'number') h.cycles = 0;
        if (!h.traits || !h.traits.length) {
          const garde = (h.trait && window.HAB.TRAITS[h.trait]) ? [h.trait] : [];
          const q = window.HAB.QUALITES, df = window.HAB.DEFAUTS;
          h.traits = garde.concat(
            garde.length ? [] : [q[(rng() * q.length) | 0]],
            [df[(rng() * df.length) | 0]]);
          h.traits = h.traits.filter((x, i, a) => x && a.indexOf(x) === i &&
                                     !window.HAB.contredit(a.slice(0, i), x));
        }
        if (!h.rarete) h.rarete = h.traits.length >= 3 ? 'rare' : 'commun';
      }
      if (!d.portes) d.portes = { postulants: null, barrees: 0, renvois: 0, accueillis: 0, refus: 0 };
      if (!d.malaise) d.malaise = { reste: 0, force: 0 };
      if (!d.memorial) d.memorial = [];
      d.v = VERSION;
      if (!d.recherches) d.recherches = {};
      for (const bid in (d.bat || {})) {
        if (!d.bat[bid].am) d.bat[bid].am = {};
        if (!d.bat[bid].raff) d.bat[bid].raff = {};   // sauvegarde d'avant les annexes
      }
      /* LE PORTAIL EST DEVENU LE PORT. Depuis que la guerre passe par la
         mer, le portail d'expédition n'a plus d'objet — mais le joueur
         l'a payé, et il tenait exactement ce rôle. On le convertit donc
         au lieu de l'effacer ; s'il a déjà un port, on retire le
         doublon. Sans cette migration, le jeu plante au chargement sur
         un type qui n'existe plus. */
      {
        const aDejaPort = Object.keys(d.bat || {}).some(k => d.bat[k].type === 'port');
        for (const bid of Object.keys(d.bat || {})) {
          if (d.bat[bid].type !== 'portail') continue;
          if (aDejaPort) { delete d.bat[bid]; continue; }
          d.bat[bid].type = 'port';
          d.bat[bid].postes = [];
        }
        /* et l'on nettoie tout type devenu inconnu : mieux vaut perdre
           une bâtisse qu'un jeu qui ne démarre plus. */
        for (const bid of Object.keys(d.bat || {}))
          if (!window.BAT[d.bat[bid].type]) delete d.bat[bid];
      }
      if (!d.aventure) d.aventure = { profondeur: 0, record: 0, encours: null, sacoche: {} };
      if (!d.armee) d.armee = { unites: 0, xp: 0, palierArme: 0, palierArmure: 0, garnison: 0 };
      if (!d.territoires) d.territoires = [];
      E = d;
      invaliderCap();
      return true;
    } catch (e) { console.warn('sauvegarde illisible :', e.message); return false; }
  }
  function effacer() { try { localStorage.removeItem(CLE); } catch (e) { } }
  function recommencer(graine) { E = neuf(graine); invaliderCap(); sauver(true); return E; }

  window.Etat = {
    get E() { return E; },
    neuf, recommencer, charger, sauver, effacer,
    abonner(f) { abonnes.push(f); },
    prevenir,
    qte, assez, manque, depenser, gagner, gagnerLot,
    plafonds, plafondDe, invaliderCap,
    conquetes, nbConquetes,
    batsDeType, nivDeType, aBatiment, creerBatiment, majPostes,
    habitant, habitantsLibres, ajouterHabitant, logementTotal, compteTrait,
    libererHabitant, affecterPoste, affecterChantier,
    placesLibres, portesBarrees, coutAccueil, vivresDisponibles, attraitBourg, apercuAccueil,
    peutOuvrirPortes, ouvrirPortes, accueillir, apercuRefus, refuserTous,
    renvoyer, perdre, peineDeDepart, tickMalaise, facteurMalaise,
    rangMetier, progresMetier, gagnerXp,
    rangHabitant, gagnerXpHabitant, gagnerAttribut, assurerProgression,
    VIES_MAX, vies, perdreVie, rendreVie,
    progresMetierHabitant, progresAttributHabitant, progressionInfinie, xpPourNiveau,
    TRAITS, TRAITS_IDS,
    journal,
    nomHabitant, mulberry,
  };

})();
