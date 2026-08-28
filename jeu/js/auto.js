/* ============================================================
   LE BOURG — js/auto.js
   LES CONTREMAÎTRES.

   Un jeu idle qui demande de tout refaire à la main n'est pas un jeu
   idle, c'est un métier. Chaque contremaître retire UNE corvée précise —
   jamais une décision. Ils ne créent pas d'habitants, ne fabriquent
   rien, n'ouvrent aucun poste : ils rangent derrière le joueur.

   Chacun s'achète une fois, puis s'allume et s'éteint librement.
   -> window.Auto
   ============================================================ */
"use strict";
(function () {

  const S = () => window.Etat.E;

  const CONTREMAITRES = [
    { id: 'postes', nom: 'Le contremaître des ateliers',
      desc: "Un poste qui a une tâche mais personne pour la tenir reçoit automatiquement le meilleur habitant disponible.",
      note: 'Il ne choisit jamais la tâche : cela reste votre affaire.',
      cout: { ecu: 2500 }, ico: { f: 'marteau', c: ['#8d9199', '#5a5e66'] } },
    { id: 'boucle', nom: 'La commande permanente',
      desc: "Quand une commande arrive à son terme, la tâche repart en boucle au lieu de laisser le poste vide.",
      note: 'La file, elle, garde toujours la priorité.',
      cout: { ecu: 4000 }, ico: { f: 'roue', c: ['#6d5236', '#3a2c1e'] } },
    { id: 'chantier', nom: 'Le chef de chantier',
      desc: "Organise les équipes du maître d’œuvre et accélère de 35 % tous les ouvrages en file.",
      note: 'Il ne prend aucun habitant dans les ateliers.',
      cout: { ecu: 6000, planche: 60 }, ico: { f: 'hache', c: ['#8d9199', '#5a5e66'] } },
    { id: 'outil', nom: "Le magasinier d'outils",
      desc: "Rééquipe un atelier dès que son outillage rend l'âme, si la réserve le permet.",
      note: "Il prend toujours le meilleur outillage disponible.",
      cout: { ecu: 9000, outil: 4 }, ico: { f: 'enclume', c: ['#4a4e56', '#7a7e86'] } },
    { id: 'vente', nom: 'Le facteur de commerce',
      desc: "Ce qui déborde d'un plafond n'est plus perdu : il le vend au colporteur au prix courant.",
      note: 'Rien ne remplace un entrepôt — mais on ne jette plus rien.',
      cout: { ecu: 15000, poterie: 20 }, ico: { f: 'piece', c: ['#d8b048', '#8a6a2a'] } },
    { id: 'reparation', nom: 'Le maître maçon',
      desc: "Met d'office en file de chantier tout bâtiment endommagé par un raid.",
      note: 'La matière est prélevée comme pour une réparation ordinaire.',
      cout: { ecu: 20000, pierretaille: 60 }, ico: { f: 'brique', c: ['#a8563f', '#6f3626'] } },
    { id: 'descente', nom: "L'intendant de la compagnie",
      desc: "Décharge le rapport de descente dès qu'il arrive, et renvoie la compagnie si le ravitaillement suit.",
      note: 'Il ne descend jamais plus bas que le dernier palier atteint.',
      cout: { ecu: 40000, plan: 1 }, ico: { f: 'ame', c: ['#8fd8e0', '#4a8f9c'] } },
  ];

  function etatAuto() {
    const E = S();
    if (!E.auto) E.auto = { actifs: {}, acquis: {} };
    if (!E.auto.actifs) E.auto.actifs = {};
    if (!E.auto.acquis) E.auto.acquis = {};
    return E.auto;
  }
  const acquis = id => !!etatAuto().acquis[id];
  const actif = id => !!(etatAuto().acquis[id] && etatAuto().actifs[id]);

  function acheter(id) {
    const c = CONTREMAITRES.find(x => x.id === id);
    if (!c) return { ok: false, raison: 'Inconnu.' };
    const A = etatAuto();
    if (A.acquis[id]) return { ok: false, raison: 'Déjà engagé.' };
    if (!window.Etat.assez(c.cout)) return { ok: false, raison: 'Il manque de quoi le payer.' };
    window.Etat.depenser(c.cout);
    A.acquis[id] = 1; A.actifs[id] = 1;
    window.Etat.journal(c.nom + ' entre en fonction.', 'bien');
    window.Etat.prevenir('auto', id);
    return { ok: true };
  }
  function basculer(id, v) {
    const A = etatAuto();
    if (!A.acquis[id]) return false;
    A.actifs[id] = v ? 1 : 0;
    window.Etat.prevenir('auto', id);
    return true;
  }

  /* =================================================================
     LE TRAVAIL DES CONTREMAÎTRES
     On ne les fait pas tourner à chaque image : deux fois par seconde
     suffit largement, et ça garde la boucle de rendu tranquille.
     ================================================================= */
  let acc = 0;
  function tick(dt) {
    acc += dt;
    if (acc < 0.5) return;
    const pas = acc; acc = 0;
    const E = S();

    /* ---- le contremaître des ateliers ---- */
    if (actif('postes')) {
      let libres = window.Etat.habitantsLibres().length;
      if (libres > 0) {
        for (const bid in E.bat) {
          const b = E.bat[bid];
          for (let i = 0; i < b.postes.length && libres > 0; i++) {
            const p = b.postes[i];
            if (p.hab || !p.rec) continue;
            const r = window.Jeu.assignerAuto(bid, i);
            if (r.ok) libres--;
          }
          if (libres <= 0) break;
        }
      }
    }

    /* ---- le magasinier d'outils ---- */
    if (actif('outil')) {
      for (const bid in E.bat) {
        const b = E.bat[bid];
        if (b.outil && b.outil.restant > 0) continue;
        if (!b.postes.some(p => p.hab && p.rec)) continue;
        if (window.Etat.qte('outilacier') >= 1) window.Jeu.outiller(bid, 'outilacier');
        else if (window.Etat.qte('outil') >= 1) window.Jeu.outiller(bid, 'outil');
      }
    }

    /* ---- le maître maçon ---- */
    if (actif('reparation')) {
      for (const bid in E.bat) {
        if (E.bat[bid].endommage <= 0) continue;
        if (E.chantier.file.some(j => j.bat === bid && j.k === 'reparer')) continue;
        window.Jeu.reparer(bid);
      }
    }

    /* ---- l'intendant de la compagnie ---- */
    if (actif('descente') && window.GameState && window.GameState.gen) {
      const g = window.GameState.gen();
      if (g.report && window.UIAventure) window.UIAventure.recolter();
      else if (!g.descent && !g.report && !window.GameState.canStartDescent()) {
        if (window.GameState.startDescent())
          window.Etat.journal('La compagnie repart pour le Puits.', 'guerre');
      }
    }
  }

  /* Le facteur de commerce : appelé depuis `Etat.gagner` quand une
     ressource déborde. Renvoie les écus qu'il en a tirés, ou 0. */
  function vendreDebordement(id, n) {
    if (!actif('vente')) return 0;
    const r = window.RES[id];
    if (!r || !r.val || id === 'ecu') return 0;
    const prix = r.val * (1 + (window.Jeu ? window.Jeu.bonusNegoce() : 0));
    const gain = Math.max(1, Math.round(n * prix * 0.55));   // le colporteur prend sa part
    const E = S();
    E.res.ecu = (E.res.ecu || 0) + gain;
    E.venteAuto = (E.venteAuto || 0) + gain;
    return gain;
  }

  window.Auto = { CONTREMAITRES, etatAuto, acquis, actif, acheter, basculer, tick, vendreDebordement };

})();
