/* ============================================================
   LE BOURG — js/tour.js
   CE QUE LE BOURG MET DANS LE PUITS, ET CE QU'IL RISQUE D'Y PERDRE.

   Le moteur d'arène est conservé tel quel : il sait faire une bataille,
   il ne sait rien du bourg. Ce fichier est la couche qui manque, et
   elle tient en trois idées.

   1. LE PÉRIL. Tous les vingt étages, ce qui tue change de nature. On
      descend quand même sans la garde qui convient — simplement, on
      encaisse le double, on ramasse le tiers, et l'on risque d'y
      laisser quelqu'un. Ce n'est pas un mur, c'est une facture.
   2. LE GARDIEN. Un tous les dix étages. Le premier passage l'ouvre ;
      ensuite on peut y retourner autant qu'on veut. C'est la seule
      source de cœurs de biome, donc de tout l'équipement profond.
   3. L'ÉQUIPÉE. On descend avec des HABITANTS, pas avec des pions. Ils
      quittent leur poste, ils rapportent leur niveau et leur caractère,
      et s'ils tombent il faut payer un rite pour les ramener — sinon
      ils sont perdus, et le bourg le paie exactement comme un renvoi.
   -> window.Tour
   ============================================================ */
"use strict";
(function () {

  const E = () => window.Etat.E;
  const PU = () => window.PerilUtil;

  /* L'état de la tour vit dans la sauvegarde du bourg. */
  function T() {
    const a = E().aventure;
    if (!a.gardes) a.gardes = {};
    if (!a.gardiens) a.gardiens = {};
    if (!a.equipe) a.equipe = [];
    if (!a.blesses) a.blesses = {};
    if (!a.tombes) a.tombes = [];
    return a;
  }

  /* =================================================================
     LE PÉRIL
     ================================================================= */
  function peril(etage) { return PU().perilDe(etage || profondeur()); }
  function profondeur() {
    const g = window.GameState && window.GameState.gen ? window.GameState.gen() : null;
    if (g && g.descent) return g.descent.floor;
    return (E().aventure.record || 0) + 1;
  }
  function prochainDepart() {
    const g = window.GameState && window.GameState.gen ? window.GameState.gen() : null;
    return (g && g.tally && g.tally.lastCheckpoint) || 1;
  }

  /* Combien de charges le bourg a en réserve pour ce péril-là. */
  function chargesDe(p) {
    if (!p || !p.garde) return Infinity;
    return window.Etat.qte(p.garde);
  }
  function protege(etage) {
    const p = peril(etage);
    if (!p.garde) return true;
    return chargesDe(p) > 0;
  }

  /* Consommer une charge pour un étage. Sans charge, on descend quand
     même : la pénalité fait le reste, et le joueur l'a lue avant. */
  function acq() { return (window.Jeu && window.Jeu.acquis) ? window.Jeu.acquis() : {}; }

  function consommer(etage) {
    const p = peril(etage);
    if (!p.garde) return true;
    const A = acq();
    /* « Onguents épaissis » : une charge sur quatre ne part pas. */
    if (A.garde && Math.random() < A.garde) return true;
    const cout = (p.abyme && !A.abyme) ? 2 : 1;
    if (window.Etat.qte(p.garde) < cout) return false;
    window.Etat.depenser({ [p.garde]: cout });
    return true;
  }

  /* Ce que coûte l'imprudence. Trois nombres, affichés avant le départ. */
  function penalite(etage) {
    const p = peril(etage);
    if (!p.garde) return { degats: 1, butin: 1, perte: 0, nom: p.nom };
    if (protege(etage)) return { degats: 1, butin: 1, perte: 0, nom: p.nom, pare: true };
    return { degats: p.abyme ? 2.6 : 2.0, butin: p.abyme ? 0.25 : 0.35,
             perte: p.abyme ? 0.16 : 0.09, nom: p.nom };
  }

  /* Combien d'étages le bourg peut tenir dans le péril courant. */
  function autonomie(etage) {
    const p = peril(etage);
    if (!p.garde) return Infinity;
    const A = acq();
    const parEtage = ((p.abyme && !A.abyme) ? 2 : 1) * (1 - (A.garde || 0));
    return Math.floor(chargesDe(p) / Math.max(0.01, parEtage));
  }

  /* =================================================================
     LES GARDIENS
     ================================================================= */
  function gardienDe(etage) { return PU().gardienPour(etage); }
  function gardienOuvert(etage) { return !!T().gardiens[etage]; }
  function gardiensOuverts() {
    return Object.keys(T().gardiens).map(Number).sort((a, b) => a - b);
  }
  /* Le premier passage ouvre le gardien pour de bon. */
  function ouvrirGardien(etage) {
    const g = gardienDe(etage);
    if (!g || T().gardiens[etage]) return false;
    T().gardiens[etage] = { fois: 0, depuis: E().tJeu };
    window.Etat.journal(g.nom + ' est tombé. On peut désormais y retourner.', 'guerre');
    window.Etat.prevenir('gardien', { etage, g });
    return true;
  }

  /* Ce que coûte une expédition punitive sur un gardien déjà battu :
     du ravitaillement, des gardes, et le temps de la compagnie. */
  function coutRelance(etage) {
    const g = gardienDe(etage); if (!g) return null;
    const p = PU().perilDe(etage);
    const c = { poissonfume: Math.max(2, Math.round(etage / 8)),
                potion: Math.max(1, Math.round(etage / 30)) };
    if (p.garde) c[p.garde] = p.abyme ? 4 : 2;
    return c;
  }
  /* Les chances de l'emporter : ce que la compagnie vaut contre l'étage. */
  function forceEquipee() {
    const g = window.GameState && window.GameState.gen ? window.GameState.gen() : null;
    let f = 6 + (g ? (g.lvl || 1) * 2 : 0);
    f += (E().armee.palierArme || 0) * 3.5;
    f += (E().armee.palierArmure || 0) * 2.5;
    for (const hid of T().equipe) {
      const h = window.Etat.habitant(hid); if (!h) continue;
      f += (2 + (h.niv || 1) * 0.9)
         * window.HAB.produit(h, 'degats') * window.HAB.produit(h, 'pv');
    }
    return Math.round(f);
  }
  function chanceGardien(etage) {
    const f = forceEquipee();
    const mur = 10 + etage * 1.15;
    const p = penalite(etage);
    const base = (f / (f + mur)) / (p.degats || 1);
    return Math.max(0.03, Math.min(0.96, base * (1 + (acq().gardien || 0))));
  }

  /* L'AFFRONTEMENT, résolu d'un coup : on connaît la chance avant de
     lancer, on en assume le résultat. C'est un choix, pas une roulette
     déguisée en bataille. */
  function relancerGardien(etage) {
    const g = gardienDe(etage);
    if (!g) return { ok: false, pourquoi: 'Aucun gardien à cet étage.' };
    if (!gardienOuvert(etage)) return { ok: false, pourquoi: 'Ce gardien n\'a jamais été battu.' };
    if (!T().equipe.length) return { ok: false, pourquoi: 'Personne dans l\'équipée.' };
    const cout = coutRelance(etage);
    if (!window.Etat.assez(cout)) return { ok: false, pourquoi: 'Ravitaillement insuffisant.' };
    window.Etat.depenser(cout);
    const ch = chanceGardien(etage);
    const gagne = Math.random() < ch;
    const fiche = T().gardiens[etage];
    fiche.fois = (fiche.fois || 0) + 1;
    if (gagne) {
      /* « Lire les cœurs » : un gardien bien connu rend davantage. */
      const kb = 1 + (acq().gardienButin || 0);
      const lot = {};
      for (const k in g.butin) lot[k] = Math.max(1, Math.round(g.butin[k] * kb));
      const recu = window.Etat.gagnerLot(lot);
      window.Etat.journal(g.nom + ' tombe une fois de plus (' + fiche.fois + ').', 'butin');
      for (const hid of T().equipe) {
        const h = window.Etat.habitant(hid);
        if (h) window.Etat.gagnerXpHabitant(h, Math.round(8 + etage * 0.8));
      }
      return { ok: true, gagne: true, butin: recu, chance: ch };
    }
    /* La défaite ne tue pas d'office : elle blesse, et parfois elle prend. */
    const p = penalite(etage);
    const victime = tirerVictime();
    let perdu = null, blesse = null;
    if (victime) {
      if (Math.random() < 0.35 + p.perte) perdu = tomber(victime, g.nom);
      else blesse = blesser(victime, Math.round(120 + etage * 4));
    }
    window.Etat.journal('L\'équipée n\'a pas eu raison de ' + g.nom + '.', 'alerte');
    return { ok: true, gagne: false, chance: ch, perdu, blesse };
  }

  /* =================================================================
     L'ÉQUIPÉE — des habitants, pas des pions
     ================================================================= */
  function disponible(h) {
    if (!h) return false;
    if (T().blesses[h.id]) return false;
    if (window.HAB.refuse(h, 'tour')) return false;
    return true;
  }
  function placesEquipee() {
    /* Le terrain d'entraînement et la caserne décident du nombre de
       pattes qu'on peut emmener : on ne descend pas à vingt. */
    let n = 2;
    n += window.Etat.nivDeType('entrainement') > 0 ? 1 : 0;
    n += Math.floor(window.Etat.nivDeType('caserne') / 2);
    n += Math.floor(window.Etat.nivDeType('descente') / 2);
    n += acq().equipee || 0;                 // « La grande équipée »
    return Math.max(1, Math.min(8, n));
  }
  function dansEquipee(hid) { return T().equipe.indexOf(hid) >= 0; }
  function emmener(hid) {
    const h = window.Etat.habitant(hid);
    if (!h) return { ok: false, pourquoi: 'Cet habitant n\'existe plus.' };
    if (dansEquipee(hid)) return { ok: false, pourquoi: 'Il est déjà de l\'équipée.' };
    if (window.HAB.refuse(h, 'tour'))
      return { ok: false, pourquoi: h.nom + ' est Peureux : il ne descendra jamais.' };
    if (T().blesses[hid]) return { ok: false, pourquoi: h.nom + ' est en convalescence.' };
    if (T().equipe.length >= placesEquipee())
      return { ok: false, pourquoi: 'L\'équipée est au complet (' + placesEquipee() + ').' };
    /* On descend en quittant son poste : c'est le vrai coût. */
    window.Etat.libererHabitant(hid);
    T().equipe.push(hid);
    window.Etat.prevenir('equipee', { hid, dedans: true });
    return { ok: true };
  }
  function laisser(hid) {
    const i = T().equipe.indexOf(hid);
    if (i < 0) return false;
    T().equipe.splice(i, 1);
    window.Etat.prevenir('equipee', { hid, dedans: false });
    return true;
  }
  function equipee() {
    return T().equipe.map(id => window.Etat.habitant(id)).filter(Boolean);
  }
  /* On purge les fantômes : un habitant renvoyé ou perdu ne doit pas
     rester dans la liste et fausser la force de l'équipée. */
  function nettoyer() {
    const t = T();
    t.equipe = t.equipe.filter(id => !!window.Etat.habitant(id));
    for (const id in t.blesses) if (!window.Etat.habitant(id)) delete t.blesses[id];
  }

  /* ---- les blessures ---- */
  function blesser(hid, duree) {
    const h = window.Etat.habitant(hid); if (!h) return null;
    T().blesses[hid] = { jusqua: E().tJeu + duree, depuis: E().tJeu };
    laisser(hid);
    window.Etat.libererHabitant(hid);
    window.Etat.journal(h.nom + ' remonte mal en point : convalescence.', 'alerte');
    window.Etat.prevenir('blesse', { hid, duree });
    return { nom: h.nom, duree };
  }
  function convalescence(hid) {
    const b = T().blesses[hid];
    if (!b) return 0;
    return Math.max(0, b.jusqua - E().tJeu);
  }
  function tickBlessures() {
    const t = T();
    for (const id in t.blesses) {
      if (t.blesses[id].jusqua <= E().tJeu) {
        delete t.blesses[id];
        const h = window.Etat.habitant(id);
        if (h) window.Etat.journal(h.nom + ' est sur pattes. Il peut reprendre un poste.', 'bien');
      }
    }
  }

  /* ---- la mort, et le rite qui la défait ---- */
  function tirerVictime() {
    const l = equipee();
    if (!l.length) return null;
    /* le plus fragile paie d'abord — c'est ce qui rend le trait Fragile
       lisible autrement que par un chiffre. */
    let pire = l[0], score = 1e9;
    for (const h of l) {
      const s = (h.niv || 1) * window.HAB.produit(h, 'pv');
      if (s < score) { score = s; pire = h; }
    }
    return pire.id;
  }
  /* Tomber, ce n'est pas encore être perdu : le corps attend qu'on
     vienne le chercher. Le bourg a le temps de décider. */
  function tomber(hid, ou) {
    const h = window.Etat.habitant(hid); if (!h) return null;
    laisser(hid);
    window.Etat.libererHabitant(hid);
    T().tombes.unshift({ id: hid, nom: h.nom, rarete: h.rarete, niv: h.niv,
                         ou: ou || 'la tour', t: E().tJeu, etage: profondeur() });
    if (T().tombes.length > 12) T().tombes.length = 12;
    window.Etat.journal(h.nom + ' est tombé dans ' + (ou || 'la tour') +
                        '. On peut encore aller le chercher.', 'alerte');
    window.Etat.prevenir('tombe', { hid, ou });
    return { nom: h.nom, id: hid };
  }
  /* LE RITE. Ramener quelqu'un coûte cher et ne se marchande pas — mais
     c'est toujours moins cher que de perdre un Insigne de niveau douze. */
  function coutRite(hid) {
    const t = T().tombes.find(x => x.id === hid);
    if (!t) return null;
    const k = (1 + (t.niv || 1) * 0.35) * (1 - (acq().rite || 0));
    return { essence: Math.max(1, Math.round(3 * k)),
             potion: Math.max(1, Math.round(k)),
             cire: Math.max(2, Math.round(6 * k)),
             ecu: Math.round(320 * k) };
  }
  function ramener(hid) {
    const i = T().tombes.findIndex(x => x.id === hid);
    if (i < 0) return { ok: false, pourquoi: 'Personne de ce nom n\'attend en bas.' };
    const cout = coutRite(hid);
    if (!window.Etat.assez(cout)) return { ok: false, pourquoi: 'Le rite demande davantage.', cout };
    window.Etat.depenser(cout);
    const t = T().tombes.splice(i, 1)[0];
    E().aventure.ramenes = (E().aventure.ramenes || 0) + 1;
    const h = window.Etat.habitant(hid);
    if (h) {
      blesser(hid, 300);
      window.Etat.journal(t.nom + ' est remonté. Il ne dira jamais ce qu\'il a vu.', 'bien');
    }
    window.Etat.prevenir('ramene', { hid });
    return { ok: true, nom: t.nom };
  }
  /* Renoncer : le bourg le paie comme un renvoi, parce que c'en est un. */
  function abandonner(hid) {
    const i = T().tombes.findIndex(x => x.id === hid);
    if (i < 0) return false;
    const t = T().tombes.splice(i, 1)[0];
    window.Etat.perdre(hid, 'l\'étage ' + t.etage);
    return true;
  }

  /* =================================================================
     LE TICK — les blessures guérissent, les gardes se consomment
     ================================================================= */
  let acc = 0, dernierEtage = 0;
  function tick(dt) {
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    nettoyer();
    tickBlessures();
    /* Chaque étage FRANCHI consomme une garde. On regarde le compteur
       du moteur d'arène plutôt que de l'instrumenter : il reste intact. */
    const g = window.GameState && window.GameState.gen ? window.GameState.gen() : null;
    if (!g || !g.descent) { dernierEtage = 0; return; }
    const f = g.descent.floor;
    if (dernierEtage && f > dernierEtage) {
      for (let e = dernierEtage + 1; e <= f; e++) {
        consommer(e);
        const gd = gardienDe(e);
        if (gd && !gardienOuvert(e)) ouvrirGardien(e);
        /* sans garde, l'étage prélève son dû */
        const p = penalite(e);
        if (p.perte > 0 && Math.random() < p.perte) {
          const v = tirerVictime();
          if (v) tomber(v, p.nom);
        }
      }
    }
    dernierEtage = f;
  }

  window.Tour = {
    peril, profondeur, prochainDepart, chargesDe, protege, consommer,
    penalite, autonomie,
    gardienDe, gardienOuvert, gardiensOuverts, ouvrirGardien,
    coutRelance, relancerGardien, chanceGardien, forceEquipee,
    equipee, placesEquipee, dansEquipee, emmener, laisser, disponible,
    blesser, convalescence, tomber, ramener, abandonner, coutRite,
    get tombes() { return T().tombes; },
    get blesses() { return T().blesses; },
    tick, nettoyer,
  };

})();
