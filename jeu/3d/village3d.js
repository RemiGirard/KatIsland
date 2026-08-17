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
    forge:'Forge', cuisine:'Boulangerie', moulin:'Moulin', bergerie:'Bergerie',
    pecherie:'Pêcherie', mine:'Mine', scierie:'Scierie', laiterie:'Laiterie',
    champ:'Blé', herboristerie:'Légumes', rucher:'Fleurs',
    alchimie:'Alchimie', taverne:'Auberge', pepiniere:'Pépinière',
    descente:'Tour sombre', caserne:'Caserne',
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
           type !== 'descente';
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
    for(const c of candidats(cellPref, L)){
      if(doc.poser({c, L})){ pose = c; break; }
    }
    doc.typeCourant = -1;
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
    return bat;
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
    /* Une annexe bâtie change l'édifice. On note ce qu'il porte —
       l'appentis, la cave, la roue — et l'on redemande la bâtisse : le
       document relit `annexes` en montant les corps du bâtiment. */
    rafraichir(id){
      const b = bats.get(id);
      if(!b) return false;
      const e = window.Etat && window.Etat.E && window.Etat.E.bat[id];
      const liste = [];
      if(e && e.raff && window.RaffUtil){
        for(const rid in e.raff){
          if(!e.raff[rid]) continue;
          const r = window.RaffUtil.trouver(e.type, rid);
          if(r && r.annexe) liste.push(r.annexe);
        }
      }
      b.annexes = liste;
      D().demanderRebati();
      this.ping(id, '#e8c88a');
      return true;
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
      const avant = palierDe(b.niv || 1);
      b.niv = niv;
      return palierDe(niv) !== avant;
    },
    palier(niv){ return palierDe(niv); },
    nomPalier(niv){ return NOMS_PALIER[palierDe(niv)]; },
    batiments(){ return [...bats.values()]; },
    batiment(id){ return bats.get(id) || null; },
    plan(){
      return [...bats.values()].map(b => ({
        id: b.id, type: b.type, pour: b.pour || null,
        cell: b.cell, L: b.L || 0, r: b.r, niv: b.niv, coul: b.coul,
        xr: b.cell / D().cellules.length,
      }));
    },
    chargerPlan(p){
      bats.clear(); parCell.clear(); SEQ = 0;
      D().vider();
      for(const e of (p || []))
        poserInterne(e.type, e.cell != null ? e.cell : null, e.id,
                     e.pour || null, e.niv || 1, e.coul, e.L || 0);
      D().demanderRebati();
      D().recentrer();
      return this;
    },
    possible(){
      return D().cellules.some(c => !parCell.has(cle(c, 0)) && !((c.b || [])[0] >= 0));
    },

    /* ---- le mode construction ---- */
    modeConstruction(type){
      modeCons = type || null;
      if(D().grille) D().grille.visible = !!modeCons;
      if(!modeCons && D().survol) D().survol.visible = false;
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
