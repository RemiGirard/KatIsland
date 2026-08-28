/* ============================================================
   LE BOURG — 3d/village3d.js
   L'ADAPTATEUR. Le village du joueur (village-doc.js) est importé tel
   quel et ne connaît rien du jeu ; le jeu, lui, appelle `window.Village`
   depuis toujours. Ce fichier est le seul pont entre les deux, et il ne
   dessine RIEN : il traduit.

   Trois traductions, et c'est tout :

   1. UN BÂTIMENT DU JEU DEVIENT UN TYPE DU DOCUMENT. La forge du jeu
      appelle la Forge du document, avec ses quatre parts, sa cour et
      ses cheminées. Ce que le document ne connaît pas devient une
      maison, dans une couleur choisie par catégorie.
   2. LE CLIC. Le document sait viser une cellule ; le jeu veut savoir
      QUEL bâtiment. On tient donc la table cellule → bâtiment, et l'on
      renvoie l'un pour l'autre.
   3. LE PLAN. Le jeu enregistre son bourg ; on note pour chaque
      bâtiment sa cellule d'ancrage, et l'on rejoue à la reprise.
   ============================================================ */
"use strict";
(function () {

  const D = () => window.__VDOC;

  /* ---------------------------------------------------------------
     LA TABLE DE CORRESPONDANCE.
     À gauche le bâtiment du jeu, à droite le type du document — celui
     qui a été dessiné pour lui. Ce qui n'y figure pas se bâtit en
     maison ordinaire : le document les traite déjà très bien, et mieux
     vaut une maison juste qu'un modèle inventé.
     --------------------------------------------------------------- */
  const VERS_DOC = {
    pecherie:'Pêcherie', scierie:'Scierie', champ:'Champ', tournesol:'Champ de tournesols',
    pepiniere:'Pépinière', potager:'Potager', fleurs:'Champ de fleurs', puits:'Puits',
    maison:'Maison', grange:'Grange', entrepot:'Entrepôt', carriere:'Carrière',
    mine:'Mine', charbonniere:'Charbonnière', fonderie:'Fonderie', forge:'Forge',
    armurerie:'Armurerie', tuilerie:'Tuilerie', poterie:'Poterie', verrerie:'Verrerie',
    moulin:'Moulin à vent', moulinEau:'Moulin à eau', cuisine:'Four banal', fumoir:'Fumoir',
    bergerie:'Bergerie', etable:'Étable', laiterie:'Laiterie', rucher:'Rucher',
    filature:'Filature', tisserand:'Atelier de tissage', tannerie:'Tannerie',
    herboristerie:'Herboristerie', alchimie:'Laboratoire d’alchimie', scriptorium:'Scriptorium',
    orfevre:'Orfèvre', taverne:'Taverne', port:'Le Port', halle:'Halle',
    nurserie:'Nurserie', entrainement:'Terrain d’entraînement', caserne:'Caserne',
    rempart:'Rempart', tour:'Tour de guet', eglise:'Chapelle', chateau:'Donjon',
    arbrechat:'Arbre à chat', descente:'Tour sombre',
  };
  /* la teinte d'une maison ordinaire, par catégorie du jeu — pour que
     le bourg se lise même là où le document n'a pas de modèle */
  const TEINTE_CAT = {
    recolte: 9, atelier: 3, stockage: 11, commerce: 2,
    vie: 5, guerre: 12, porte: 6,
  };

  let iDoc = null;
  function indexDoc(type){
    if(!iDoc){
      iDoc = {};
      D().TYPES.forEach((t,k)=>{ iDoc[t.nom] = k; });
    }
    const nom = VERS_DOC[type];
    return nom != null && iDoc[nom] != null ? iDoc[nom] : -1;
  }

  /* ---------------- l'état de l'adaptateur ---------------- */
  const bats = new Map();                // id -> {id,type,pour,cell,L,slots[],...}
  const parCell = new Map();             // « cellule:niveau » -> id de bâtiment
  let SEQ = 0, NOM = '', graine = 1;
  let listeners = {}, modeCons = null;
  let lancé = false;

  const NOMS = ['Port-au-Chat','Griffebourg','Miaulency','Poilroux-sur-Mer',
    'Ronronville','Quaidoux','Moustezel','Patte-Blanche','Velours-le-Bas'];
  const RANGS = [[0,'écart'],[3,'hameau'],[8,'village'],[15,'bourg'],[24,'bourg franc'],[34,'cité']];
  const palierDe = niv => (niv|0) >= 8 ? 2 : ((niv|0) >= 4 ? 1 : 0);
  const NOMS_PALIER = ['rustique', 'établi', 'de maître'];

  /* ================================================================
     POSER — on emprunte les règles du document
     ================================================================ */
  const cle = (c, L) => c.i + ':' + L;
  function occupees(){
    const s = new Set();
    for(const c of D().cellules) for(let L=0; L<(c.b || []).length; L++)
      if(c.b[L] >= 0) s.add(cle(c, L));
    return s;
  }

  /* Les parcelles de production vivent du sol : champ, élevage, pêche,
     coupe et extraction ne s'empilent jamais. Le bâti urbain, les maisons
     et les ateliers peuvent au contraire former de vrais quartiers hauts. */
  function empilable(type){
    const d = window.BAT && window.BAT[type];
    return !(d && (d.cat === 'recolte' || d.cat === 'elevage')) &&
           type !== 'descente' && !surLaRive(type);
  }

  /* Les modèles `bordEau` du document — la Pêcherie, le Port — jettent
     un ponton dans la mer depuis leur face avant. Posés sur un toit, le
     tablier et ses pilotis pendraient à mi-ciel : ils restent au sol, et
     seulement sur une cellule qui touche l'eau. */
  function surLaRive(type){
    const doc = D();
    if(!doc) return false;
    const t = indexDoc(type);
    return t >= 0 && !!doc.TYPES[t].bordEau;
  }

  /* Les parcelles d'accueil, de la plus proche du bourg à la plus
     lointaine. On les essaie dans l'ordre : un bâtiment à plusieurs
     parts peut refuser une place trop serrée, et c'est le document qui
     le sait — `placementOk` — pas nous. */
  function candidats(pref, L){
    const cs = D().cellules;
    if(pref != null) return cs[pref] ? [cs[pref]] : [];
    let cx = 0, cz = 0, n = 0;
    for(const [,b] of bats){ const c = cs[b.cell]; if(!c) continue; cx += c.cx; cz += c.cz; n++; }
    if(n){ cx /= n; cz /= n; }
    const libres = cs.filter(c => !parCell.has(cle(c, L)) && !((c.b || [])[L] >= 0));
    libres.sort((a,b) => Math.hypot(a.cx-cx, a.cz-cz) - Math.hypot(b.cx-cx, b.cz-cz));
    return libres;
  }

  function poserInterne(type, cellPref, id, pour, niv, coul, niveau){
    const doc = D();
    const cible = pour || type;
    const t = indexDoc(cible);
    const def = window.BAT ? window.BAT[cible] : null;
    const L = Math.max(0, niveau | 0);
    if(L > 0 && !empilable(cible)) return null;
    /* un chantier se pose en bloc nu, couleur bois : il sera remplacé */
    doc.typeCourant = pour ? -1 : t;
    doc.couleur = pour ? 12
      : (coul != null ? coul
         : (t >= 0 ? 0 : (def && TEINTE_CAT[def.cat] != null ? TEINTE_CAT[def.cat] : 3)));

    const avant = occupees();
    let pose = null;
    /* LE CHANTIER DOIT TENIR LA PLACE DU BÂTIMENT FINI.

       Il se pose en bloc nu : `typeCourant` vaut -1, et le document
       n'applique donc AUCUNE règle du modèle. Sans garde-fou on ouvrait
       un chantier de port en plein bourg, et le port fini, refusé là,
       allait se bâtir à l'autre bout de l'île.

       « La cellule touche l'eau » ne suffisait pas : `placementOk`
       exige EN PLUS que la face avant donne sur le large à une rotation
       donnée, et que les trois autres parts trouvent des cellules
       libres et non protégées. Sur un angle de côte — deux faces sans
       voisin — le chantier passait et le port non : le joueur payait,
       voyait l'échafaudage, et retrouvait son port ailleurs à
       l'achèvement. On demande donc au document la règle du bâtiment
       FINI ; `meilleureRotation` l'essaie dans les quatre sens et rend
       -1 si aucun ne tient. */
    for(const c of candidats(cellPref, L)){
      if(pour && t >= 0 && doc.meilleureRotation(c, L, t) < 0) continue;
      if(doc.poser({c, L})){ pose = c; break; }
    }
    /* En mode construction, conserver le type choisi après la tentative : le
       fantôme montre ainsi l'emprise réelle du port sur la bande littorale. */
    doc.typeCourant = modeCons ? indexDoc(modeCons) : -1;
    if(!pose) return null;

    /* Toutes les cellules que le document vient d'occuper appartiennent
       à ce bâtiment : c'est ainsi qu'un clic sur n'importe quelle part
       — la cour, la tourelle, l'appentis — ouvre la bonne fenêtre. */
    const bat = {
      id: id || ('e' + (++SEQ)),
      type, pour: pour || null, cell: pose.i, L,
      r: (pose.sp && pose.sp[L] && pose.sp[L].r) || 0,
      niv: niv || 1, coul: coul != null ? coul : null,
      cells: [], slots: [],
    };
    const nId = parseInt(String(bat.id).slice(1), 10);
    if(Number.isFinite(nId)) SEQ = Math.max(SEQ, nId);
    for(const c of doc.cellules) for(let LL=0; LL<(c.b || []).length; LL++){
      const k = cle(c, LL);
      if(avant.has(k) || c.b[LL] < 0) continue;
      bat.cells.push(c.i);
      bat.slots.push({cell:c.i, L:LL});
      parCell.set(k, bat.id);
    }
    if(!bat.slots.length){
      bat.cells.push(pose.i); bat.slots.push({cell:pose.i, L});
      parCell.set(cle(pose, L), bat.id);
    }
    bat.xr = bat.cell / doc.cellules.length;
    bats.set(bat.id, bat);
    if(type === 'scierie' && !pour){
      const eco = window.Etat && window.Etat.E && window.Etat.E.bat[bat.id];
      appliquerEtatScierie(bat, (eco && eco.niv) || bat.niv || 1, (eco && eco.raff) || {});
    }
    return bat;
  }

  /* ================================================================
     REJOUER UN BÂTIMENT DU PLAN — SANS JAMAIS LE PERDRE

     Une sauvegarde garde la cellule d'ancrage, pas la règle qui l'avait
     autorisée. Or la règle change : le port se posait autrefois en
     maison ordinaire — une cellule, n'importe où, y compris empilée sur
     un toit — et il est depuis un modèle `bordEau` de quatre parts qui
     exige la rive. Rejoué tel quel, il était refusé sur sa cellule
     d'origine et disparaissait de l'île tout en restant dans l'état du
     jeu : plus rien à cliquer, plus de ponton, donc plus de flotte du
     tout. Même chose pour les bâtiments rejoués APRÈS un modèle qui
     s'est mis à occuper plus de place qu'avant.

     Un plan ne doit jamais perdre un bâtiment. On essaie donc sa
     parcelle, puis n'importe quelle parcelle, puis le sol.
     ================================================================ */
  function rejouer(e){
    const L = e.L || 0;
    const essais = [[e.cell != null ? e.cell : null, L]];
    if(e.cell != null) essais.push([null, L]);
    if(L > 0) essais.push([null, 0]);
    for(const [cell, LL] of essais){
      const b = poserInterne(e.type, cell, e.id, e.pour || null, e.niv || 1, e.coul, LL);
      if(b) return b;
    }
    return null;
  }

  function retirerInterne(id){
    const bat = bats.get(id);
    if(!bat) return false;
    const cs = D().cellules;
    const c = cs[bat.cell];
    if(c && c.b && c.b[bat.L] >= 0) D().retirer({c, L: bat.L});
    /* ce que le document aurait laissé (une part orpheline) : on nettoie */
    for(const slot of bat.slots){
      const cc = cs[slot.cell], k = cc && cle(cc, slot.L);
      if(cc && parCell.get(k) === id && cc.b && cc.b[slot.L] >= 0){
        cc.b[slot.L] = -1; cc.sp[slot.L] = undefined;
      }
      if(k) parCell.delete(k);
    }
    bats.delete(id);
    return true;
  }

  /* Le modèle V44 ne change jamais après sa pose. Les niveaux et annexes
     restent des données économiques, sans modifier sa géométrie. */
  function appliquerEtatScierie(bat, niv, raff){
    if(!bat || bat.type !== 'scierie' || bat.pour) return false;
    bat.niv = Math.max(1, niv | 0);
    bat.raff = Object.assign({}, raff || {});
    return false;
  }

  /* ================================================================
     LE PONTON — le contrat avec les navires

     Un modèle `bordEau` du document porte une part marquée
     `ponton:true`. Le document jette ce ponton à la construction et
     n'en garde aucune trace : rien, dans `__VDOC`, ne dit où le tablier
     s'arrête. On le RECALCULE ici, avec la même géométrie que
     `ponton()` dans village-doc.js :

       - l'arête monde d'une face locale `f` vaut `(f + sp.r) % 4`, et
         le ponton part de la face locale 0 — celle que `bordEau` force
         à donner sur le large ;
       - le tablier part du MILIEU de cette arête, suit la normale
         sortante de la cellule (du centre vers le milieu de l'arête)
         et court de 0,05 à 1,60 ;
       - il est posé à `niveau × H + 0,02`.

     Ces trois nombres sont les seuls qu'on duplique. S'ils bougent dans
     `ponton()`, il faut les corriger ici — et nulle part ailleurs.

     `pontonDe(idBâtiment)` renvoie, ou `null` si ce bâtiment n'a pas de
     ponton (ce qui est le cas de tous sauf la pêcherie et le port) :

       { x, z   position monde du BOUT du tablier
         y      hauteur du tablier, dans le repère du document
         dx, dz vecteur unitaire du tablier vers le large
         cap    le même cap en radians, `Math.atan2(dz, dx)`
         cell   indice de la cellule qui porte le ponton
         L      niveau de cette part
         id     le bâtiment, pour ne pas avoir à le repasser }

     Un navire qui accoste vient donc en (x, z) par le cap opposé
     (`cap + Math.PI`) ; un navire qui appareille sort suivant `cap`.
     ================================================================ */
  const PONTON_DEBUT = 0.05, PONTON_LONG = 1.55, PONTON_Y = 0.02;

  function pontonDe(x){
    const b = typeof x === 'string' ? bats.get(x) : (x && x.id ? bats.get(x.id) : null);
    const doc = D();
    if(!b || !doc) return null;
    const cs = doc.cellules, TY = doc.TYPES;
    for(const slot of (b.slots || [])){
      const c = cs[slot.cell];
      const sp = c && c.sp ? c.sp[slot.L] : null;
      if(!sp) continue;
      const T = TY[sp.t];
      const part = T && T.parts[sp.p];
      /* En V44 les trois cellules ne portent plus le décor historique
         `ponton:true` : le quai est dessiné par l'architecture spéciale du
         type. Sa cellule d'ancrage (partie 0) reste la même. */
      if(!T || (!part || !part.ponton) && !(T.bordEau && sp.p === 0)) continue;
      const i = sp.r % 4;
      const A = doc.P[c.q[i]], B = doc.P[c.q[(i+1)%4]];
      const mx = (A[0]+B[0])/2, mz = (A[1]+B[1])/2;
      let dx = mx - c.cx, dz = mz - c.cz;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const bout = PONTON_DEBUT + PONTON_LONG;
      return { x: mx + dx*bout, z: mz + dz*bout,
               y: slot.L * doc.H + PONTON_Y,
               dx, dz, cap: Math.atan2(dz, dx),
               cell: c.i, L: slot.L, id: b.id };
    }
    return null;
  }

  /* ================================================================
     LE CLIC ET LE SURVOL, traduits pour le jeu
     ================================================================ */
  function batDeCellule(c, L){
    if(!c) return null;
    const id = parCell.get(cle(c, Math.max(0, L | 0)));
    return id ? bats.get(id) : null;
  }

  function brancher(){
    D().surClic = (t, bouton) => {
      if(!t) return false;
      if(modeCons){
        const p = t.pose;
        const bonNiveau = p && (p.L === 0 || empilable(modeCons));
        if(p && bonNiveau && !parCell.has(cle(p.c, p.L))){
          if(listeners.pose) listeners.pose(modeCons, {x: p.c.i, y: p.L, r: null});
        } else if(listeners.poseRefus) listeners.poseRefus(modeCons);
        return false;
      }
      const cible = t.sup || t.pose;
      const bat = cible ? batDeCellule(cible.c, cible.L) : null;
      if(bat){ if(listeners.selection) listeners.selection(bat); return false; }
      if(listeners.sol) listeners.sol({x: t.pose ? t.pose.c.i : null, r: null});
      return false;
    };
    let dernier = null;
    D().surSurvol = (t) => {
      const cible = t && (t.sup || t.pose);
      const bat = cible ? batDeCellule(cible.c, cible.L) : null;
      if(modeCons) D().surlignerBatiment(null);
      else D().surlignerBatiment(bat ? bat.slots : null);
      if(bat === dernier) return;
      dernier = bat;
      if(listeners.survol) listeners.survol(bat || null);
    };
  }

  /* ================================================================
     L'API DU JEU — inchangée, c'est tout l'intérêt
     ================================================================ */
  window.Village = {

    init(opts){
      opts = opts || {};
      graine = opts.graine || 1;
      NOM = opts.nom || NOMS[Math.abs(graine) % NOMS.length];
      bats.clear(); parCell.clear(); SEQ = 0;
      D().regenererIle(graine);
      brancher();
      D().constructionActive = false;
      D().canvas.style.cursor = 'url("img/ui/curseur-patte-griffe.png") 6 4, pointer';
      return this;
    },
    demarrer(){ if(lancé) return; lancé = true; D().demarrer(); },
    uneImage(){ D().uneImage(); },
    surTick(fn){ D().surTick = fn; },
    hooks(h){ listeners = h || {}; },

    /* ---- le plan ---- */
    poser(type, vx, r, id, niv, coul, niveau){
      const b = poserInterne(type, (typeof vx === 'number' ? Math.round(vx) : null),
                             id, null, niv, coul, niveau);
      if(b) D().demanderRebati();
      return b;
    },
    poserChantier(typeCible, vx, r, id, coul, niveau){
      const b = poserInterne(typeCible, (typeof vx === 'number' ? Math.round(vx) : null),
                             id, typeCible, 1, coul, niveau);
      if(b) D().demanderRebati();
      return b;
    },
    /* Annexes et niveaux n'altèrent jamais la maquette V44. */
    rafraichir(id){
      const b = bats.get(id);
      if(!b) return false;
      const e = window.Etat && window.Etat.E && window.Etat.E.bat[id];
      b.niv = (e && e.niv) || b.niv || 1;
      b.raff = Object.assign({}, (e && e.raff) || b.raff || {});
      return true;
    },
    configurerScierie(id, niv, raff){
      const b = bats.get(id);
      return appliquerEtatScierie(b, niv, raff);
    },
    retirer(id){
      const ok = retirerInterne(id);
      if(ok) D().demanderRebati();
      return ok;
    },
    /* Les bâtiments du document ont leur forme définitive dès la pose :
       le niveau du jeu ne change pas la silhouette, on ne rebâtit donc
       pas pour rien. */
    rehausser(id, niv){
      const b = bats.get(id);
      if(!b) return false;
      b.niv = niv;
      return false;
    },
    palier(niv){ return palierDe(niv); },
    nomPalier(niv){ return NOMS_PALIER[palierDe(niv)]; },
    batiments(){ return [...bats.values()]; },
    batiment(id){ return bats.get(id) || null; },

    /* ---- les pontons : voir le contrat plus haut ---- */
    pontonDe(id){ return pontonDe(id); },
    /* tous les pontons du bourg, dans l'ordre des bâtiments — de quoi
       répartir une flotte sans avoir à deviner qui a un quai */
    pontons(){
      const out = [];
      for(const id of bats.keys()){ const p = pontonDe(id); if(p) out.push(p); }
      return out;
    },
    plan(){
      return [...bats.values()].map(b => ({
        id: b.id, type: b.type, pour: b.pour || null,
        cell: b.cell, L: b.L || 0, r: b.r, niv: b.niv, coul: b.coul,
        xr: b.cell / D().cellules.length,
      }));
    },
    /* Projection indépendante de la caméra 3D. Les coordonnées restent celles
       du document : la couche 2D peut donc dessiner un vrai plan vertical et
       retrouver les bâtiments empilés sans lire la sauvegarde économique. */
    planArchitecture(){
      const doc = D();
      if(!doc) return { cellules:[], batiments:[] };
      const cellules = doc.cellules.map(c => ({
        i:c.i, cx:c.cx, cz:c.cz,
        q:c.q.map(i => ({x:doc.P[i][0], z:doc.P[i][1]}))
      }));
      const batiments = [...bats.values()].map(b => ({
        id:b.id, type:b.type, pour:b.pour || null, L:b.L || 0,
        niv:b.niv || 1, r:b.r || 0,
        slots:(b.slots || []).map(s => {
          const c=doc.cellules[s.cell];
          return c ? {cell:c.i,L:s.L,cx:c.cx,cz:c.cz,
            q:c.q.map(i => ({x:doc.P[i][0],z:doc.P[i][1]}))} : null;
        }).filter(Boolean)
      }));
      return {cellules,batiments};
    },
    selectionnerPlan(id){
      const b=bats.get(id);
      if(!b) return false;
      if(listeners.selection) listeners.selection(b);
      return true;
    },
    poserSurPlan(cell){
      if(!modeCons) return false;
      const doc=D(), c=doc && doc.cellules[Math.max(0,cell|0)];
      const t=indexDoc(modeCons);
      const libre=!!c && !parCell.has(cle(c,0)) && !((c.b||[])[0]>=0);
      const tient=libre && (t<0 || doc.meilleureRotation(c,0,t)>=0);
      if(tient){
        if(listeners.pose) listeners.pose(modeCons,{x:c.i,y:0,r:null});
        return true;
      }
      if(listeners.poseRefus) listeners.poseRefus(modeCons);
      return false;
    },
    chargerPlan(p){
      bats.clear(); parCell.clear(); SEQ = 0;
      D().vider();
      for(const e of (p || [])) rejouer(e);
      D().demanderRebati();
      D().recentrer();
      return this;
    },
    possible(){
      return D().cellules.some(c => !parCell.has(cle(c, 0)) && !((c.b || [])[0] >= 0));
    },
    /* Le moteur en a besoin pour EXPLIQUER un refus : une parcelle
       d'intérieur est bien libre, il lui manque seulement la mer. Sans
       cela le joueur relit « pas de parcelle libre » sur une place vide
       et cherche une erreur qui n'existe pas. */
    bordEau(type){ return surLaRive(type); },

    /* ---- le mode construction ---- */
    modeConstruction(type){
      modeCons = type || null;
      D().constructionActive = !!modeCons;
      if(modeCons) D().surlignerBatiment(null);
      D().typeCourant = modeCons ? indexDoc(modeCons) : -1;
      if(D().grille) D().grille.visible = !!modeCons;
      if(!modeCons && D().survol) D().survol.visible = false;
      if(D().canvas) D().canvas.style.cursor = modeCons
        ? 'crosshair'
        : 'url("img/ui/curseur-patte-griffe.png") 6 4, pointer';
    },
    enConstruction(){ return !!modeCons; },

    /* ---- les habitants : le document mène sa propre vie ---- */
    population(){}, affecter(){}, affecterA(){}, pecheurs(){}, libererTous(){},
    actifs(){}, actif(){ return false; },

    /* ---- les signes ---- */
    ping(){}, gain(){}, souffle(){},
    selection(id){ if(!id && D().survol) D().survol.visible = false; },

    /* ---- projection à l'écran, pour ancrer les fenêtres ---- */
    ecran(x){
      const b = typeof x === 'string' ? bats.get(x) : (x && x.id ? bats.get(x.id) : null);
      if(!b) return null;
      const c = D().cellules[b.cell];
      if(!c) return null;
      const cam = D().camera, cv = D().canvas;
      const haut = (c.b ? c.b.length : 1) * D().H + 0.5;
      const v  = new THREE.Vector3(c.cx, haut, c.cz).project(cam);
      const v2 = new THREE.Vector3(c.cx, 0, c.cz).project(cam);
      const r = cv.getBoundingClientRect();
      const sx  = r.left + (v.x*0.5+0.5)*r.width;
      const sy  = r.top + (-v.y*0.5+0.5)*r.height;
      const sol = r.top + (-v2.y*0.5+0.5)*r.height;
      return { x: sx-40, y: sy, w: 80, h: Math.max(10, sol-sy), cx: sx, cy: sy, sol, k: 1 };
    },

    /* ---- le temps : celui du document, rapporté à la journée du jeu.
       Son cycle dure cent quatre-vingts secondes ; figer le temps le
       cale sur le plein jour, comme le faisait son bouton de ciel. ---- */
    heure(){ return ((D().temps % 180) / 180 + 0.25) % 1; },
    vitesseJour(){ return 1/180; },
    figerTemps(b){ D().modeJour = b ? 0 : 2; },
    densite(){}, reglages(){},
    dimensions(){ return { W: D().cellules.length, H: 1 }; },
    zones(){ return {}; },
    sol(){ return 0; },
    nom(){ return NOM; },
    renommer(n){ if(n) NOM = String(n).slice(0, 40); return NOM; },
    rang(){
      const n = [...bats.values()].filter(b => !b.pour).length;
      let r = RANGS[0][1];
      for(const [seuil, nom] of RANGS) if(n >= seuil) r = nom;
      return r;
    },
    graine(){ return graine; },
    canvas(){ return D().canvas; },
    fps(){ return 60; },
    occupation(){
      const pris = new Set([...parCell.keys()].map(k => k.split(':')[0])).size;
      return { pris, total: D().cellules.length };
    },
  };

})();
