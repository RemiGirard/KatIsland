/* ============================================================
   LE BOURG — 3d/habitants3d.js
   LES HABITANTS DANS LE VILLAGE.

   Un chat par habitant réel. Le bourg cesse d'être une maquette : on
   voit qui travaille et qui traîne, et l'on comprend d'un coup d'œil ce
   que le bandeau met trois chiffres à dire.

   QUATRE PIÈCES, indépendantes :

   1. LA CARTE. Le village 3D donne tout : chaque cellule connaît ses
      quatre voisines par arête (`c.nb`), et `c.b.length` dit si elle
      porte un bâtiment. On ne calcule aucune collision — on refuse
      d'entrer dans une cellule bâtie. Les PORTES se lisent dans les
      modèles : une face déclarée `'ouvert'` est un percement, et la
      cellule d'en face est le pas de porte. Rien n'est ajouté au décor
      pour les signaler — le moteur les DÉTECTE, il ne les dessine pas.

   2. LES AGENTS. Une machine à états minuscule, nourrie par `h.aff` —
      l'affectation réelle de l'habitant. L'image ne peut donc pas
      mentir sur ce que fait le bourg.

   3. LE GESTE. Un chat au poste ne reste pas planté : il sort SON
      outil et fait SON mouvement. La faux couche le blé, la hache monte
      et tombe, la canne trempe, le marteau bat l'enclume. Un chômeur,
      lui, s'assoit, se lèche la patte ou regarde ailleurs.

   4. LE RENDU, en deux dos interchangeables :
        · `bloc`   — des chats humanoïdes en volumes, avec un visage et
          des outils. Ils tournent vraiment sur eux-mêmes.
        · `sprite` — les sprites de la compagnie, ceux des expéditions.
          Seize directions, seize poses, sautillement et balancement
          déjà cuits dans les images.

   -> window.Habitants3D
   ============================================================ */
"use strict";
(function () {

  const D = () => window.__VDOC;
  const E = () => window.Etat.E;
  const TAU = Math.PI * 2;

  /* --- mise en scène ------------------------------------------------
     La hauteur d'un chat est donnée EN PART D'ÉTAGE : un bloc du
     village fait 0,62, et un chat doit faire un peu plus de la moitié
     d'un étage. Rien ne se règle « à l'œil » ici — la première version
     donnait des chats de 0,56, presque aussi hauts qu'une maison. */
  const PART_ETAGE   = 0.52;   // un chat = 52 % d'un étage
  const VITESSE      = 1.15;   // cellules par seconde
  const PAS_PAR_CELL = 2.1;    // cycles de pas par cellule parcourue
  const PAUSE_MIN    = 1.0, PAUSE_MAX = 4.0;
  const DEDANS_MIN   = 3.0, DEDANS_MAX = 10.0;
  const SOL          = 0.07;   // le sol du document est plat, à 0.06

  /* La boîte réellement occupée par un sprite dans son canevas de 128.
     Mesurée, pas devinée : le chat tient sur 110 px de haut et ses
     pattes touchent à la ligne 115. On s'en sert pour la mise à
     l'échelle et pour l'ancrage au sol. */
  const SPR = { hauteur: 110 / 128, pieds: 115 / 128 };

  let groupe = null;
  let agents = new Map();
  let mode = 'sprite';
  let horloge = 0;
  let carte = null, signaturePlan = '';

  /* ==================================================================
     1. LA CARTE ET LES PORTES
     ================================================================== */

  const CULTURES = { champ:1, tournesol:1, potager:1, fleurs:1, pepiniere:1, herboristerie:1 };

  function signature() {
    const cs = D().cellules;
    let s = cs.length + ':';
    for (const c of cs) if (c.b.length) s += c.i + ',' + c.b.length + ';';
    return s;
  }

  function construireCarte() {
    const cs = D().cellules;
    const bats = window.Village ? window.Village.batiments() : [];

    /* LES CULTURES SE TRAVERSENT. Un champ n'est pas un mur : ses
       cellules portent des sillons. Le laboureur doit pouvoir gagner le
       milieu de son blé, et un chat qui contourne un champ au lieu de
       le couper a l'air bête. */
    const cultivee = new Uint8Array(cs.length);
    for (const b of bats)
      if (CULTURES[b.type]) for (const i of (b.cells || [])) cultivee[i] = 1;

    const libre = new Uint8Array(cs.length);
    for (const c of cs) libre[c.i] = (c.b.length && !cultivee[c.i]) ? 0 : 1;

    /* LES PORTES SE LISENT DANS LE MODÈLE — on ne les devine pas.

       Chaque part d'un bâtiment déclare ses quatre faces : `'mur'`,
       `'deco'`, ou `'ouvert'`. Une face OUVERTE est un percement — c'est
       la halle de la forge, le porche de la boulangerie, le hangar de
       la scierie. Le document la creuse d'ailleurs à l'affichage
       (`panneauPerce`).

       L'arête MONDE d'une face locale `f` est `(f + sp.r) % 4` : la
       rotation de la pièce fait tourner ses faces sur la grille. La
       cellule d'en face, `c.nb[i]`, est donc le seuil réel — le pas de
       porte, tel qu'un maçon l'a posé.

       Ma première version prenait « la cellule de bord qui touche le
       plus de cellules du bâtiment ». Ça donnait une entrée plausible,
       parfois derrière, et surtout inventée. Là, c'est la bonne. */
    const TYPES = D().TYPES;
    const portes = new Map();      // idBâtiment -> [cellules de seuil réelles]
    const seuils = new Map();      // idBâtiment -> toutes les cellules de bord
    for (const b of bats) {
      const dedans = new Set(b.cells || []);
      const bord = [], pas = [];
      /* LE PORCHE DONNE SUR LA COUR, pas sur la rue. Les modèles le
         disent : la part de cour porte `df:0` — « devant la part 0 »,
         celle dont une face est ouverte. Le chemin réel est donc en deux
         temps : la rue mène à la cour, la cour mène au corps par le
         percement. On collecte les deux bouts. */
      const vises = new Set();
      for (const i of (b.cells || [])) {
        const c = cs[i]; if (!c) continue;
        for (const v of c.nb)
          if (v && libre[v.i] && !dedans.has(v.i) && bord.indexOf(v) < 0) bord.push(v);
        for (let L = 0; L < c.b.length; L++) {
          const sp = c.sp[L]; if (!sp) continue;
          const part = TYPES[sp.t] && TYPES[sp.t].parts[sp.p];
          if (!part || !part.faces) continue;
          for (let f = 0; f < 4; f++) {
            if (part.faces[f] !== 'ouvert') continue;
            const v = c.nb[(f + sp.r) % 4];
            if (!v) continue;
            /* la face ouverte donne dehors : c'est un seuil direct */
            if (libre[v.i] && !dedans.has(v.i)) { if (pas.indexOf(v) < 0) pas.push(v); }
            /* elle donne sur une part du bâtiment — la cour : on retient
               la cellule visée, et l'on cherchera par où l'on y entre */
            else vises.add(v);
          }
        }
      }
      /* par où entre-t-on dans la cour ? par ses côtés libres. */
      for (const v of vises)
        for (const w of v.nb)
          if (w && libre[w.i] && !dedans.has(w.i) && pas.indexOf(w) < 0) pas.push(w);

      seuils.set(b.id, bord);
      /* Faute d'ouverture atteignable — un porche qui donne sur la mer,
         un mur mitoyen — on retombe sur le bord : mieux vaut entrer par
         un côté que rester dehors pour toujours. */
      portes.set(b.id, pas.length ? pas : bord);
    }

    const flanables = cs.filter(c =>
      libre[c.i] && !cultivee[c.i] && c.nb.filter(Boolean).length >= 3);

    carte = { libre, cultivee, seuils, portes, flanables, cs, bats };
    return carte;
  }

  function laCarte() {
    const s = signature();
    if (!carte || s !== signaturePlan) { signaturePlan = s; construireCarte(); }
    return carte;
  }

  function chemin(depart, arrivee) {
    const M = laCarte();
    if (!depart || !arrivee || depart === arrivee) return [];
    const vu = new Map([[depart.i, null]]);
    const file = [depart]; let tete = 0;
    while (tete < file.length) {
      const c = file[tete++];
      if (c === arrivee) break;
      for (const v of c.nb) {
        if (!v || vu.has(v.i)) continue;
        if (!M.libre[v.i] && v !== arrivee) continue;
        vu.set(v.i, c); file.push(v);
      }
    }
    if (!vu.has(arrivee.i)) return null;
    const route = [];
    for (let c = arrivee; c; c = vu.get(c.i)) route.push(c);
    route.reverse(); route.shift();
    return route;
  }

  function auHasard(l) { return l[(Math.random() * l.length) | 0] || null; }
  function hache(s) {
    let n = 0; s = String(s);
    for (let i = 0; i < s.length; i++) n = (Math.imul(n, 31) + s.charCodeAt(i)) | 0;
    return n;
  }

  /* ==================================================================
     2. LES MÉTIERS : L'OUTIL ET LE GESTE
     ================================================================== */

  /* `geste` décide de l'animation du bras ; `outil` de ce qu'il tient.
     Deux métiers peuvent partager un geste — on ne dessine pas
     quatorze animations pour dire « il travaille ». */
  const METIER = {
    peche:    { outil:'canne',   geste:'tremper' },
    bois:     { outil:'hache',   geste:'fendre'  },
    champs:   { outil:'faux',    geste:'faucher' },
    elevage:  { outil:'seau',    geste:'devant'  },
    mine:     { outil:'pioche',  geste:'fendre'  },
    feu:      { outil:'tisonnier', geste:'devant' },
    forge:    { outil:'marteau', geste:'battre'  },
    tissage:  { outil:'navette', geste:'devant'  },
    cuisine:  { outil:'louche',  geste:'devant'  },
    savoir:   { outil:'plume',   geste:'ecrire'  },
    batisse:  { outil:'marteau', geste:'battre'  },
    guerre:   { outil:'lance',   geste:'garde'   },
    poterie:  { outil:'tour',    geste:'devant'  },
    negoce:   { outil:'bourse',  geste:'devant'  },
  };
  function metierDe(h) { return (h && h.talent) || 'batisse'; }
  function reglesDe(h) { return METIER[metierDe(h)] || METIER.batisse; }

  /* Ce que fait un chat qui n'a rien à faire. Trois oisivetés, tirées
     de son identifiant puis renouvelées : un village où tout le monde
     se lèche la patte en même temps ne trompe personne. */
  const OISIVETES = ['assis', 'toilette', 'guette', 'etirement'];

  function lieuDe(h) {
    if (!h || !h.aff) return null;
    if (h.aff.k === 'poste') return h.aff.bat || null;
    if (h.aff.k === 'chantier') {
      const f = E().chantier.file[0];
      return f ? f.bat : null;
    }
    return null;
  }

  /* ==================================================================
     3. LES AGENTS
     ================================================================== */

  function nouvelAgent(h) {
    const M = laCarte();
    const c = auHasard(M.flanables) || M.cs[0];
    return {
      id: h.id, c, x: c ? c.cx : 0, z: c ? c.cz : 0,
      route: [], but: null,
      etat: 'pause', minuteur: Math.random() * PAUSE_MAX,
      cap: Math.random() * TAU, phase: Math.random() * 16,
      oisivete: OISIVETES[Math.abs(hache(h.id)) % OISIVETES.length],
      dedans: false, objet: null, rendu: null,
      derniereImage: -1, derniereDir: -1,
    };
  }

  /* OÙ SE TIENT-ON POUR TRAVAILLER ?

     LA RÉPONSE ÉTAIT DÉJÀ DANS LES MODÈLES. Presque chaque bâtiment du
     document porte une part marquée `cour:true` — « rend la part en
     terrasse basse » : l'appentis ouvert de la forge, le ponton de la
     pêcherie, la basse-cour de la bergerie, le carré du champ. C'est
     l'endroit prévu pour qu'on y travaille, dallé et sans mur.

     On n'a donc RIEN à ajouter aux modélisations : il suffit de trouver
     cette cour et d'y poser l'ouvrier. Son sol est à `L·H + 0,13` —
     c'est la dalle que `courSpeciale` pose au-dessus du bloc.

     Faute de cour, on retombe sur le seuil de la porte : mieux vaut un
     chat devant l'atelier qu'un chat encastré dans un mur. */
  function courDe(idBat) {
    const M = laCarte();
    const b = window.Village ? window.Village.batiment(idBat) : null;
    if (!b || !b.cells) return null;
    const TYPES = D().TYPES;
    const cs = M.cs;
    const trouvees = [];
    for (const i of b.cells) {
      const c = cs[i]; if (!c || !c.b.length) continue;
      /* on regarde chaque niveau : la cour n'est pas toujours au sol
         (celle de l'orfèvre est à l'étage, aux cristaux) */
      for (let L = 0; L < c.b.length; L++) {
        const sp = c.sp[L];
        if (!sp) continue;
        const part = TYPES[sp.t] && TYPES[sp.t].parts[sp.p];
        if (!part || !part.cour) continue;
        trouvees.push({ c, L, y: L * D().H + 0.13, champ: part.champ !== undefined });
      }
    }
    return trouvees.length ? trouvees : null;
  }

  function posteDeTravail(idBat, idHab) {
    const M = laCarte();
    const b = window.Village ? window.Village.batiment(idBat) : null;
    if (!b) return null;

    const cours = courDe(idBat);
    if (cours) {
      /* toujours la même cour pour un habitant donné : il ne doit pas
         sauter d'un coin à l'autre à chaque cycle */
      const q = cours[Math.abs(hache(idHab)) % cours.length];
      return { c: q.c, y: q.y };
    }

    const bords = M.seuils.get(idBat);
    const pp = M.portes.get(idBat);
    if (pp && pp.length) return { c: pp[Math.abs(hache(idHab)) % pp.length], y: SOL };
    if (bords && bords.length)
      return { c: bords[Math.abs(hache(idHab)) % bords.length], y: SOL };
    return null;
  }

  /* LE POSTE DU PÊCHEUR est AU BORD DE L'EAU, pas devant une porte.

     Et le bord de l'eau se DÉTECTE, il ne se devine pas : une cellule
     de rive n'a pas ses quatre voisines — il n'y a rien de l'autre côté
     de son arête libre, c'est la mer. On prend la plus proche de la
     pêcherie parmi celles-là.

     La version précédente prenait « le bord du bâtiment le plus loin du
     centre de l'île », ce qui plaçait souvent le pêcheur sur la terre
     ferme, dos à la pêcherie mais loin de l'eau. */
  let rivesCache = null, rivesSig = '';
  function rives() {
    const M = laCarte();
    if (rivesCache && rivesSig === signaturePlan) return rivesCache;
    rivesSig = signaturePlan;
    rivesCache = M.cs.filter(c =>
      M.libre[c.i] && c.nb.filter(Boolean).length < 4);
    return rivesCache;
  }

  function bordDeLEau(idBat) {
    const M = laCarte();
    const b = window.Village ? window.Village.batiment(idBat) : null;
    const r = rives();
    if (!r.length) {
      /* île sans rive libre : on se rabat sur le bord du bâtiment */
      const bords = M.seuils.get(idBat);
      return bords && bords.length ? { c: bords[0], y: SOL } : null;
    }
    /* la rive la plus proche de la pêcherie : le pêcheur ne traverse pas
       l'île pour tremper sa ligne */
    let ax = 0, az = 0, n = 0;
    for (const i of ((b && b.cells) || [])) {
      const c = M.cs[i]; if (!c) continue;
      ax += c.cx; az += c.cz; n++;
    }
    if (!n) { ax = 0; az = 0; }
    else { ax /= n; az /= n; }
    let proche = r[0], d = Infinity;
    for (const c of r) {
      const q = (c.cx - ax) * (c.cx - ax) + (c.cz - az) * (c.cz - az);
      if (q < d) { d = q; proche = c; }
    }
    return { c: proche, y: SOL };
  }

  function tournerVers(a, b, cs) {
    if (!b || !b.cells || !b.cells.length) return;
    let cx = 0, cz = 0;
    for (const i of b.cells) { const c = cs[i]; if (!c) continue; cx += c.cx; cz += c.cz; }
    cx /= b.cells.length; cz /= b.cells.length;
    if (Math.hypot(cx - a.x, cz - a.z) > 0.12) a.cap = Math.atan2(cz - a.z, cx - a.x);
  }

  function decider(a, h) {
    const M = laCarte();
    const lieu = lieuDe(h);

    if (lieu) {
      const b = window.Village.batiment(lieu);
      const pecheur = b && b.type === 'pecherie';

      /* LA JOURNÉE DU PÊCHEUR. Il ne se tient pas devant la porte : il
         va au bord de l'eau, il trempe sa canne, et de temps en temps
         il porte sa prise à la pêcherie. C'est purement visuel — les
         chaînes de production ne savent rien de ces allers-retours —
         mais c'est ce qui fait qu'un village a l'air habité. */
      if (pecheur) {
        const eau = bordDeLEau(lieu);
        const cour = posteDeTravail(lieu, a.id);
        if (a.etape === 'porter' && cour) {
          if (a.c === cour.c) {
            /* arrivé à la pêcherie : on dépose, on souffle, on repart */
            a.etat = 'depose'; a.minuteur = 1.6 + Math.random();
            a.panier = false;
            tournerVers(a, b, M.cs); a.yCible = cour.y;
            return;
          }
          const r = chemin(a.c, cour.c);
          if (r && r.length) { a.route = r; a.but = cour.c; a.yCible = cour.y;
            a.etat = 'marche'; a.rentre = false; return; }
        }
        if (eau) {
          if (a.c === eau.c) {
            a.etat = 'peche'; a.minuteur = 6 + Math.random() * 7;
            a.yCible = eau.y;
            /* face au large : on tourne le dos à l'île */
            a.cap = Math.atan2(a.z, a.x);
            return;
          }
          const r = chemin(a.c, eau.c);
          if (r && r.length) { a.route = r; a.but = eau.c; a.yCible = eau.y;
            a.etat = 'marche'; a.rentre = false; a.etape = 'pecher'; return; }
        }
      }

      const cible = posteDeTravail(lieu, a.id);
      if (cible) {
        if (a.c === cible.c) {
          a.etat = 'travaille'; a.minuteur = 4 + Math.random() * 5;
          a.yCible = cible.y;
          tournerVers(a, b, M.cs);
          return;
        }
        const r = chemin(a.c, cible.c);
        if (r && r.length) { a.route = r; a.but = cible.c; a.yCible = cible.y;
          a.etat = 'marche'; a.rentre = false; return; }
      }
      a.etat = 'pause'; a.minuteur = 2; return;
    }

    /* SANS EMPLOI : une fois sur quatre on rentre chez soi — par la
       porte, jamais par un mur — sinon on traîne sur l'île. */
    if (Math.random() < 0.25) {
      const logis = M.bats.filter(b =>
        b.type === 'maison' || b.type === 'chateau' || b.type === 'arbrechat' || b.type === 'taverne');
      const m = auHasard(logis);
      const pp = m ? M.portes.get(m.id) : null;
      const porte = pp && pp.length ? pp[(Math.random() * pp.length) | 0] : null;
      if (porte) {
        const r = chemin(a.c, porte);
        if (r) { a.route = r; a.but = porte; a.etat = 'marche'; a.rentre = true; a.chez = m.id; return; }
      }
    }
    const cible = auHasard(M.flanables);
    const r = cible ? chemin(a.c, cible) : null;
    if (r && r.length) { a.route = r; a.but = cible; a.etat = 'marche'; a.rentre = false; }
    else {
      a.etat = 'pause'; a.minuteur = PAUSE_MIN + Math.random() * PAUSE_MAX;
      a.oisivete = OISIVETES[(Math.random() * OISIVETES.length) | 0];
    }
  }

  function avancer(a, h, dt) {
    /* la hauteur glisse vers celle du poste : monter sur la dalle d'une
       cour ne doit pas se faire d'un saut sec */
    const yv = a.yCible == null ? SOL : a.yCible;
    a.y = (a.y == null) ? yv : a.y + (yv - a.y) * Math.min(1, dt * 6);

    switch (a.etat) {
      case 'pause':
      case 'travaille':
        a.minuteur -= dt;
        a.phase += dt * 6;
        if (a.minuteur <= 0) decider(a, h);
        break;

      /* LE PÊCHEUR. Il trempe, il attend, il ferre — et il remonte
         quelque chose une fois sur deux. Quand son panier est plein, il
         part le porter à la pêcherie. */
      case 'peche':
        a.minuteur -= dt;
        a.phase += dt * 6;
        if (a.minuteur <= 0) {
          a.panier = true; a.etape = 'porter';
          decider(a, h);
        }
        break;
      case 'depose':
        a.minuteur -= dt;
        a.phase += dt * 6;
        if (a.minuteur <= 0) { a.etape = 'pecher'; decider(a, h); }
        break;
      case 'dedans':
        a.minuteur -= dt;
        if (a.minuteur <= 0) { a.dedans = false; decider(a, h); }
        break;
      case 'marche': {
        const s = a.route[0];
        if (!s) {
          /* arrivé au but : si c'était un poste, on décide tout de
             suite — sinon on reste plantés une seconde de trop. */
          if (!a.rentre && lieuDe(h)) { decider(a, h); break; }
          if (a.rentre) {
            a.dedans = true; a.etat = 'dedans';
            a.minuteur = DEDANS_MIN + Math.random() * (DEDANS_MAX - DEDANS_MIN);
          } else {
            a.etat = 'pause'; a.minuteur = PAUSE_MIN + Math.random() * PAUSE_MAX;
            a.oisivete = OISIVETES[(Math.random() * OISIVETES.length) | 0];
          }
          break;
        }
        const dx = s.cx - a.x, dz = s.cz - a.z;
        const d = Math.hypot(dx, dz), pas = VITESSE * dt;
        if (d <= pas || d < 1e-4) { a.x = s.cx; a.z = s.cz; a.c = s; a.route.shift(); }
        else {
          a.x += dx / d * pas; a.z += dz / d * pas;
          a.cap = Math.atan2(dz, dx);
        }
        /* LA CADENCE SUIT LE PAS, pas l'horloge : le cycle avance avec
           la DISTANCE parcourue, donc les pattes ne patinent jamais,
           quelle que soit la vitesse. Une cellule franchie vaut
           PAS_PAR_CELL cycles complets, et un cycle vaut seize images. */
        a.phase += pas * PAS_PAR_CELL * 16;
        break;
      }
    }
  }

  /* ==================================================================
     4a. LE RENDU EN SPRITES
     ================================================================== */

  const ALLURE = {
    peche:'eclaireur', bois:'costaud', champs:'lancier', elevage:'lancier',
    mine:'costaud', feu:'costaud', forge:'costaud', tissage:'eclaireur',
    cuisine:'lancier', savoir:'eclaireur', batisse:'costaud', guerre:'lancier',
    poterie:'lancier', negoce:'eclaireur',
  };

  /* L'ATLAS N'A QU'UN CYCLE DE MARCHE — aucune pose de travail. Un
     sprite au poste restait donc planté, ce qui donnait l'air en panne
     plutôt qu'occupé.

     On enveloppe donc le sprite dans un GROUPE, et l'on accroche à côté
     de lui l'outil de son métier, en vrai volume. Le chat reste dessiné
     et fait face à la caméra ; l'outil, lui, tourne et frappe dans le
     monde. C'est un mélange assumé, et c'est ce qui rend le geste
     lisible sans redessiner seize poses par métier. */
  function creerSprite(a, h) {
    geometries();
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, alphaTest: 0.06, depthWrite: false, fog: true,
    });
    const s = new THREE.Sprite(mat);
    /* Le sprite est ancré au centre par défaut. Les pattes du chat sont
       à la ligne 115 sur 128 : c'est LÀ qu'il faut le poser au sol,
       sinon il flotte ou s'enfonce. */
    s.center.set(0.5, 1 - SPR.pieds);
    const k = (D().H * PART_ETAGE) / SPR.hauteur;
    s.scale.set(k, k, 1);
    s.userData.cv = cv;
    s.userData.ctx = cv.getContext('2d');
    s.userData.tex = tex;

    const g = new THREE.Group();
    g.add(s);

    const reg = reglesDe(h);
    const bras = new THREE.Group();
    bras.position.set(0, D().H * PART_ETAGE * 0.55, 0);
    const outil = creerOutil(reg.outil);
    outil.scale.setScalar(0.62);
    bras.add(outil);
    bras.visible = false;
    g.add(bras);

    /* le panier de la pêche : il n'apparaît que plein */
    const panier = new THREE.Mesh(G.seau, mat_bois());
    panier.scale.setScalar(0.5);
    panier.position.set(0.10, D().H * PART_ETAGE * 0.22, 0);
    panier.visible = false;
    g.add(panier);

    g.userData = { sprite: s, bras, outil, panier, geste: reg.geste };
    return g;
  }
  function mat_bois() { return mat('#8a6a45'); }

  /* LA DIRECTION À L'ÉCRAN.

     Un sprite fait toujours face à la caméra : ce qu'on choisit, c'est
     de quel côté le chat regarde À L'ÉCRAN. Il faut donc projeter son
     cap monde dans le repère de la caméra.

     La caméra du document est en orbite : position = cible + r·(sinφ·sinθ,
     cosφ, sinφ·cosθ). Son vecteur DROITE au sol est (cosθ, −sinθ) et
     son vecteur BAS-écran (cosθ, sinθ)… ce qui revient à faire tourner
     le cap de +θ. La première version soustrayait θ : les chats
     regardaient de travers dès qu'on tournait autour de l'île. */
  function dirEcran(a) {
    const S = window.Sprites;
    const theta = D().orbite ? D().orbite.theta : 0;
    return S.dirForAngle(a.cap + theta);
  }

  /* LE GESTE, côté sprites. L'outil est un vrai objet : on le fait
     tourner autour de l'épaule du chat dessiné. Chaque métier a son
     mouvement, le même que celui des chats en volumes. */
  function majOutilSprite(a, h) {
    const d = a.objet.userData;
    const auTravail = a.etat === 'travaille' || a.etat === 'peche';
    d.bras.visible = auTravail;
    d.panier.visible = !!a.panier && a.etat !== 'peche';
    if (!auTravail) return;

    /* l'outil se place du côté où le chat regarde à l'écran, pour ne pas
       lui passer devant la figure */
    const theta = D().orbite ? D().orbite.theta : 0;
    const cote = Math.cos(a.cap + theta) >= 0 ? 1 : -1;
    d.bras.position.x = cote * D().H * PART_ETAGE * 0.30;
    d.bras.rotation.y = -theta;

    const t = horloge * 2.4 + a.phase * 0.2;
    switch (d.geste) {
      case 'fendre':
        d.bras.rotation.z = cote * (2.0 - Math.abs(Math.sin(t)) * 2.1);
        break;
      case 'battre':
        d.bras.rotation.z = cote * (1.5 - Math.abs(Math.sin(t * 1.7)) * 1.5);
        break;
      case 'faucher':
        d.bras.rotation.z = cote * 1.15;
        d.bras.rotation.y = -theta + Math.sin(t * 0.8) * 0.7;
        break;
      case 'tremper': {
        /* la canne plonge vers l'eau, et le BOUCHON danse : c'est lui
           qu'on regarde. De temps en temps ça mord, et la gaule se
           relève d'un coup sec. */
        const mord = Math.sin(t * 0.23) > 0.93;
        d.bras.rotation.z = cote * (mord ? 0.35 : 0.85) + Math.sin(t * 0.6) * 0.05;
        const u = d.outil.userData;
        if (u && u.bouchon) {
          u.bouchon.position.y = u.bouchon.userData0 == null
            ? (u.bouchon.userData0 = u.bouchon.position.y)
            : u.bouchon.userData0 + Math.sin(t * 3.1) * 0.012;
        }
        break;
      }
      case 'ecrire':
        d.bras.rotation.z = cote * 1.35 + Math.sin(t * 2.2) * 0.10;
        break;
      case 'garde':
        d.bras.rotation.z = cote * 0.18;
        break;
      default:
        d.bras.rotation.z = cote * (1.25 + Math.sin(t * 1.4) * 0.14);
    }
  }

  function majSprite(a, h) {
    const S = window.Sprites;
    if (!S || !S.getUnitFrames) return;
    majOutilSprite(a, h);
    const dir = dirEcran(a);
    const enMarche = a.etat === 'marche';
    /* Le sautillement et le balancement sont DÉJÀ cuits dans les seize
       images du cycle : il n'y a rien à ajouter, seulement à défiler.
       C'est exactement ce que fait la bataille — `phase/TAU*16`. */
    const f = enMarche ? (((Math.floor(a.phase) % S.FRAMES) + S.FRAMES) % S.FRAMES) : 0;
    if (dir === a.derniereDir && f === a.derniereImage) return;
    const cible = a.objet.userData.sprite;
    const frames = S.getUnitFrames({
      faction:'cats', type: ALLURE[metierDe(h)] || 'lancier',
      dir, worker: true, evo: Math.min(4, (h.niv || 1) - 1),
    });
    const img = frames && frames[f];
    /* LA CUISSON EST ASYNCHRONE : une direction jamais demandée n'est
       pas encore dessinée. On ne retient donc la pose qu'après avoir
       RÉELLEMENT dessiné — sinon on croit l'avoir posée, on n'y revient
       jamais, et le chat reste figé pour toujours. */
    if (!img) return;
    a.derniereDir = dir; a.derniereImage = f;
    const ctx = cible.userData.ctx;
    ctx.clearRect(0, 0, 128, 128);
    ctx.drawImage(img, 0, 0);
    cible.userData.tex.needsUpdate = true;
  }

  /* ==================================================================
     4b. LE RENDU EN VOLUMES — des chats humanoïdes

     Debout sur deux pattes, une tête ronde avec un vrai visage, deux
     bras qui tiennent l'outil du métier. Tout en boîtes, en aplats,
     sans texture : la langue du village.

     Les géométries sont partagées entre tous les chats — un seul jeu de
     boîtes pour vingt habitants.
     ================================================================== */
  let G = null;
  function geometries() {
    if (G) return G;
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    G = {
      torse:   B(0.30, 0.34, 0.20),
      bassin:  B(0.26, 0.14, 0.19),
      tete:    B(0.30, 0.26, 0.26),
      museau:  B(0.13, 0.09, 0.08),
      oreille: B(0.09, 0.12, 0.04),
      oeil:    B(0.06, 0.07, 0.03),
      pupille: B(0.03, 0.05, 0.02),
      nez:     B(0.04, 0.03, 0.03),
      bras:    B(0.08, 0.24, 0.08),
      patte:   B(0.10, 0.24, 0.11),
      pied:    B(0.11, 0.06, 0.16),
      queue:   B(0.07, 0.07, 0.30),
      /* les outils */
      manche:  B(0.03, 0.40, 0.03),
      fer:     B(0.14, 0.09, 0.04),
      tete_marteau: B(0.09, 0.08, 0.13),
      seau:    B(0.13, 0.13, 0.13),
      canne:   B(0.02, 0.52, 0.02),
      plume:   B(0.02, 0.14, 0.02),
      bourse:  B(0.10, 0.11, 0.09),
    };
    return G;
  }

  const ROBES = [
    ['#e2a94e','#a06a24'], ['#efe6d2','#b8ac92'], ['#8d8578','#5f5a52'],
    ['#c9a24a','#8f7430'], ['#5f5a52','#3a3630'], ['#b4763f','#7d4c26'],
    ['#d8cbb0','#a89880'], ['#7f6a52','#4f4034'], ['#3a3630','#26221e'],
  ];
  const matCache = new Map();
  function mat(hex) {
    if (!matCache.has(hex))
      matCache.set(hex, new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) }));
    return matCache.get(hex);
  }

  /* L'outil, en pièces détachées, accroché à la patte droite. */
  function creerOutil(sorte) {
    const g = new THREE.Group();
    const bois = mat('#8a6a45'), acier = mat('#b9c2cc'), sombre = mat('#4a3524');
    switch (sorte) {
      case 'hache': {
        const m = new THREE.Mesh(G.manche, bois); m.position.y = -0.14; g.add(m);
        const f = new THREE.Mesh(G.fer, acier); f.position.set(0.07, 0.04, 0); g.add(f);
        break;
      }
      case 'pioche': {
        const m = new THREE.Mesh(G.manche, bois); m.position.y = -0.14; g.add(m);
        const f = new THREE.Mesh(G.fer, acier); f.position.set(0, 0.06, 0);
        f.rotation.z = 0.4; g.add(f);
        break;
      }
      case 'faux': {
        const m = new THREE.Mesh(G.manche, bois); m.position.y = -0.14; g.add(m);
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.03, 0.04), acier);
        l.position.set(0.15, -0.32, 0); g.add(l);
        break;
      }
      case 'marteau': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.03), bois);
        m.position.y = -0.09; g.add(m);
        const t = new THREE.Mesh(G.tete_marteau, acier); t.position.y = 0.05; g.add(t);
        break;
      }
      /* LA CANNE, avec sa ligne et son hameçon. Une gaule seule ne dit
         rien ; c'est le fil qui tombe et le bouchon posé sur l'eau qui
         font comprendre, de loin, que ce chat-là pêche. */
      case 'canne': {
        const gaule = new THREE.Mesh(G.canne, bois);
        gaule.position.y = -0.10; gaule.rotation.z = -0.5;
        g.add(gaule);
        /* le bout de la gaule, d'où part le fil : la canne mesure 0,52
           et penche de −0,5 rad autour de son milieu */
        const L = 0.52;
        const bx = Math.sin(0.5) * (L / 2), by = -0.10 + Math.cos(0.5) * (L / 2);
        const fil = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.30, 0.006), mat('#efe9d8'));
        fil.position.set(bx, by - 0.15, 0);
        g.add(fil);
        const bouchon = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), mat('#c4443a'));
        bouchon.position.set(bx, by - 0.30, 0);
        g.add(bouchon);
        const hamecon = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.012), mat('#b9c2cc'));
        hamecon.position.set(bx, by - 0.345, 0);
        g.add(hamecon);
        g.userData.fil = fil; g.userData.bouchon = bouchon; g.userData.hamecon = hamecon;
        break;
      }
      case 'seau':   g.add(new THREE.Mesh(G.seau, sombre)); break;
      case 'bourse': g.add(new THREE.Mesh(G.bourse, mat('#8a6a2a'))); break;
      case 'plume': {
        const p = new THREE.Mesh(G.plume, mat('#efe6d2')); p.rotation.z = -0.6; g.add(p);
        break;
      }
      case 'lance': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.52, 0.025), bois);
        g.add(m);
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.02), acier);
        f.position.y = 0.30; g.add(f);
        break;
      }
      case 'tisonnier': {
        const m = new THREE.Mesh(G.manche, acier); m.position.y = -0.14; g.add(m);
        break;
      }
      case 'navette': {
        const n = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.05), bois);
        g.add(n); break;
      }
      case 'louche': {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.24, 0.025), bois);
        m.position.y = -0.09; g.add(m);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.09), acier);
        b.position.y = -0.22; g.add(b);
        break;
      }
      default: {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), bois);
        g.add(m);
      }
    }
    return g;
  }

  function creerBloc(a, h) {
    geometries();
    const r = ROBES[Math.abs(hache(a.id)) % ROBES.length];
    const clair = mat(r[0]), fonce = mat(r[1]);
    const noir = mat('#241f1c'), blanc = mat('#f6f2e6'), rose = mat('#d98f92');

    const g = new THREE.Group();

    /* --- le corps, debout --- */
    const bassin = new THREE.Mesh(G.bassin, clair); bassin.position.y = 0.30; g.add(bassin);
    const torse = new THREE.Mesh(G.torse, clair); torse.position.y = 0.53; g.add(torse);
    /* le plastron, plus clair : ça donne un devant et un dos */
    const plastron = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.24, 0.02), blanc);
    plastron.position.set(0, 0.52, 0.105); g.add(plastron);

    /* --- LE VISAGE. C'est lui qui rend le chat sympathique : une tête
       large, un museau clair qui avance, de grands yeux posés bas, et
       des oreilles bien écartées. --- */
    const tete = new THREE.Group(); tete.position.y = 0.83; g.add(tete);
    tete.add(new THREE.Mesh(G.tete, clair));
    const museau = new THREE.Mesh(G.museau, blanc);
    museau.position.set(0, -0.06, 0.14); tete.add(museau);
    const nez = new THREE.Mesh(G.nez, rose);
    nez.position.set(0, -0.03, 0.185); tete.add(nez);
    for (const s of [-1, 1]) {
      const o = new THREE.Mesh(G.oeil, blanc);
      o.position.set(s * 0.075, 0.03, 0.132); tete.add(o);
      const p = new THREE.Mesh(G.pupille, noir);
      p.position.set(s * 0.075, 0.03, 0.147); tete.add(p);
      const e = new THREE.Mesh(G.oreille, fonce);
      e.position.set(s * 0.10, 0.17, -0.01);
      e.rotation.z = s * 0.22; tete.add(e);
    }

    /* --- les membres --- */
    const brasG = new THREE.Group(), brasD = new THREE.Group();
    for (const [grp, s] of [[brasG, -1], [brasD, 1]]) {
      grp.position.set(s * 0.19, 0.66, 0);
      const b = new THREE.Mesh(G.bras, clair);
      b.position.y = -0.12; grp.add(b);
      g.add(grp);
    }
    const jambes = [];
    for (const s of [-1, 1]) {
      const j = new THREE.Group(); j.position.set(s * 0.08, 0.24, 0);
      const p = new THREE.Mesh(G.patte, clair); p.position.y = -0.12; j.add(p);
      const pi = new THREE.Mesh(G.pied, fonce); pi.position.set(0, -0.22, 0.03); j.add(pi);
      g.add(j); jambes.push(j);
    }
    const queue = new THREE.Group(); queue.position.set(0, 0.34, -0.11);
    const q = new THREE.Mesh(G.queue, fonce); q.position.z = -0.15; queue.add(q);
    g.add(queue);

    /* --- l'outil, dans la patte droite --- */
    const reg = reglesDe(h);
    const outil = creerOutil(reg.outil);
    outil.position.set(0, -0.24, 0.04);
    brasD.add(outil);
    outil.visible = false;

    g.userData = { tete, brasG, brasD, jambes, queue, outil, geste: reg.geste, torse };
    /* l'échelle : un chat debout mesure environ 1,05 en modèle ; on le
       ramène à PART_ETAGE d'un étage, comme les sprites. */
    const k = (D().H * PART_ETAGE) / 1.05;
    g.scale.setScalar(k);
    return g;
  }

  /* Les animations. Une seule fonction, un aiguillage par état — c'est
     plus court que quatre fonctions qui se ressemblent. */
  function majBloc(a, h, base) {
    const g = a.objet, d = g.userData;
    if (base == null) base = SOL;
    g.rotation.y = -a.cap + Math.PI / 2;
    const p = a.phase;

    if (a.etat === 'marche') {
      d.outil.visible = false;
      /* les jambes alternent, les bras balancent en opposition, le
         corps sautille — c'est le même mouvement que les sprites */
      d.jambes[0].rotation.x = Math.sin(p) * 0.55;
      d.jambes[1].rotation.x = Math.sin(p + Math.PI) * 0.55;
      d.brasG.rotation.x = Math.sin(p + Math.PI) * 0.42;
      d.brasD.rotation.x = Math.sin(p) * 0.42;
      g.position.y = base + Math.abs(Math.sin(p)) * 0.016;
      d.torse.rotation.z = Math.sin(p) * 0.05;
      d.queue.rotation.x = Math.sin(p * 0.5) * 0.18;
      d.tete.rotation.y = 0; d.tete.rotation.x = 0;
      return;
    }

    g.position.y = base;
    d.jambes[0].rotation.x = 0; d.jambes[1].rotation.x = 0;
    d.torse.rotation.z = 0;
    /* on remet la stature debout : l'oisiveté « assis » descend le
       torse, et sans remise à zéro le chat resterait accroupi au
       travail comme à la marche. */
    d.torse.position.y = 0.53; d.tete.position.y = 0.83;

    if (a.etat === 'travaille' || a.etat === 'peche' || a.etat === 'depose') {
      d.outil.visible = a.etat !== 'depose';
      const t = horloge * 2.4 + a.phase * 0.2;
      switch (d.geste) {
        case 'fendre':                       // la hache, la pioche
          d.brasD.rotation.x = -1.5 + Math.abs(Math.sin(t)) * 1.9;
          d.brasG.rotation.x = d.brasD.rotation.x * 0.7;
          d.torse.rotation.x = -Math.abs(Math.sin(t)) * 0.22;
          break;
        case 'battre':                       // le marteau sur l'enclume
          d.brasD.rotation.x = -1.1 + Math.abs(Math.sin(t * 1.7)) * 1.3;
          d.brasG.rotation.x = -0.5;
          break;
        case 'faucher':                      // la faux couche le blé
          d.brasD.rotation.x = -0.4;
          d.brasG.rotation.x = -0.4;
          g.rotation.y += Math.sin(t * 0.8) * 0.5;
          d.torse.rotation.y = Math.sin(t * 0.8) * 0.3;
          break;
        case 'tremper':                      // la canne trempe dans l'eau
          d.brasD.rotation.x = -0.9;
          d.brasG.rotation.x = -0.7;
          d.outil.rotation.z = -0.5 + Math.sin(t * 0.5) * 0.10;
          d.tete.rotation.x = 0.22;
          break;
        case 'ecrire':                       // la plume court sur le vélin
          d.brasD.rotation.x = -1.15;
          d.brasD.rotation.z = Math.sin(t * 2.2) * 0.14;
          d.tete.rotation.x = 0.34;
          break;
        case 'garde':                        // la lance, au repos d'armes
          d.brasD.rotation.x = -0.25;
          d.tete.rotation.y = Math.sin(horloge * 0.7) * 0.5;
          break;
        default:                             // les deux pattes devant
          d.brasD.rotation.x = -1.25 + Math.sin(t * 1.4) * 0.16;
          d.brasG.rotation.x = -1.25 - Math.sin(t * 1.4) * 0.16;
          d.tete.rotation.x = 0.18;
      }
      d.queue.rotation.x = Math.sin(horloge * 1.1) * 0.12;
      return;
    }

    /* --- OISIF. Il ne reste pas planté : il s'assoit, se lèche la
       patte, regarde autour de lui, ou s'étire. --- */
    d.outil.visible = false;
    d.brasD.rotation.z = 0; d.torse.rotation.y = 0;
    const t = horloge;
    switch (a.oisivete) {
      case 'assis':
        /* assis : les pattes repliées devant, le corps descendu d'un
           demi-cran. On reste AU-DESSUS du sol — un chat qui s'enfonce
           dans la terrasse n'a l'air ni assis ni content. */
        g.position.y = base;
        d.jambes[0].rotation.x = 1.25; d.jambes[1].rotation.x = 1.25;
        d.torse.position.y = 0.44; d.tete.position.y = 0.74;
        d.brasG.rotation.x = 0.12; d.brasD.rotation.x = 0.12;
        d.queue.rotation.y = Math.sin(t * 1.3) * 0.45;
        d.tete.rotation.y = Math.sin(t * 0.4) * 0.35;
        break;
      case 'toilette':
        d.brasD.rotation.x = -1.9;
        d.tete.rotation.x = 0.55 + Math.sin(t * 5.5) * 0.13;
        d.tete.rotation.y = 0.28;
        d.brasG.rotation.x = 0;
        d.queue.rotation.x = Math.sin(t * 0.8) * 0.20;
        break;
      case 'etirement': {
        const u = (Math.sin(t * 0.8) + 1) / 2;
        d.brasG.rotation.x = -2.0 * u; d.brasD.rotation.x = -2.0 * u;
        d.torse.rotation.x = -0.28 * u;
        d.tete.rotation.x = -0.30 * u;
        d.queue.rotation.x = -0.5 * u;
        break;
      }
      default:                               // guette
        d.brasG.rotation.x = 0; d.brasD.rotation.x = 0;
        d.tete.rotation.y = Math.sin(t * 0.55) * 0.85;
        d.tete.rotation.x = Math.sin(t * 0.31) * 0.12;
        d.queue.rotation.y = Math.sin(t * 0.9) * 0.30;
    }
  }

  /* ==================================================================
     L'ORCHESTRE
     ================================================================== */

  function objetPour(a, h) { return mode === 'bloc' ? creerBloc(a, h) : creerSprite(a, h); }

  function poser() {
    if (!groupe) {
      groupe = new THREE.Group(); groupe.name = 'habitants';
      D().scene.add(groupe);
    }
    return groupe;
  }

  function liberer(o) {
    const tuer = x => {
      if (!x.material) return;
      const l = Array.isArray(x.material) ? x.material : [x.material];
      /* les matières et les géométries des chats en volumes sont
         PARTAGÉES : on ne détruit que les textures propres au sprite. */
      for (const m of l) if (m.map && m.map.isCanvasTexture) { m.map.dispose(); m.dispose(); }
    };
    if (o.traverse) o.traverse(tuer); else tuer(o);
  }

  function accorder() {
    const g = poser();
    const vivants = new Set();
    for (const h of E().habitants) {
      vivants.add(h.id);
      let a = agents.get(h.id);
      if (!a) { a = nouvelAgent(h); agents.set(h.id, a); }
      /* le métier peut changer : l'outil doit suivre */
      const reg = reglesDe(h);
      if (a.objet && a.rendu === 'bloc' && a.objet.userData.geste !== reg.geste) a.rendu = null;
      if (!a.objet || a.rendu !== mode) {
        if (a.objet) { g.remove(a.objet); liberer(a.objet); }
        a.objet = objetPour(a, h); a.rendu = mode;
        a.derniereDir = -1; a.derniereImage = -1;
        g.add(a.objet);
      }
    }
    for (const [id, a] of Array.from(agents)) {
      if (vivants.has(id)) continue;
      if (a.objet) { g.remove(a.objet); liberer(a.objet); }
      agents.delete(id);
    }
  }

  function tout(dt) {
    if (!window.__VDOC || !window.Etat || !window.Village) return;
    if (mode === 'aucun') {
      if (groupe) groupe.visible = false;
      return;
    }
    horloge += dt;
    if (groupe) groupe.visible = true;
    laCarte();
    accorder();
    for (const h of E().habitants) {
      const a = agents.get(h.id);
      if (!a || !a.objet) continue;
      avancer(a, h, dt);
      a.objet.visible = !a.dedans;
      if (a.dedans) continue;
      a.objet.position.x = a.x;
      a.objet.position.z = a.z;
      const base = a.y == null ? SOL : a.y;
      if (mode === 'bloc') majBloc(a, h, base);
      else {
        /* un balancement d'effort par-dessus le geste de l'outil : le
           chat dessiné ne peut pas se pencher, son corps entier oscille */
        const effort = (a.etat === 'travaille' || a.etat === 'peche')
          ? Math.abs(Math.sin(horloge * 4.2 + a.phase)) * 0.018 : 0;
        a.objet.position.y = base + effort;
        majSprite(a, h);
      }
    }
  }

  function definirMode(m) {
    if (m !== 'sprite' && m !== 'bloc' && m !== 'aucun') return;
    if (m === mode) return;
    mode = m;
    if (window.Etat && E().options) E().options.habitants = m;
    for (const a of agents.values()) a.rendu = null;
  }
  function modeCourant() { return mode; }
  function demarrer() {
    if (window.Etat && E().options && E().options.habitants) mode = E().options.habitants;
    poser();
  }

  window.Habitants3D = {
    tick: tout, definirMode, modeCourant, demarrer,
    get compte() { return agents.size; },
    etats() {
      const out = [];
      for (const [id, a] of agents)
        out.push({ id, etat: a.etat, cellule: a.c ? a.c.i : null, dedans: a.dedans,
                   route: a.route.length, oisivete: a.oisivete, cap: a.cap });
      return out;
    },
    portes() {
      const M = laCarte(); const out = [];
      for (const [bid, l] of M.portes)
        out.push({ bat: bid, cellules: l.map(c => c.i) });
      return out;
    },
  };

})();
