/* ============================================================
   LE BOURG — js/marche.js
   DEUX CHOSES QUE L'ÉCONOMIE RÉCLAMAIT.

   1. LES DÉBITS. Un stock ne dit rien ; un DÉBIT dit tout. On mesure ce
      qui entre et ce qui sort de chaque ressource sur une fenêtre
      glissante, et l'on en déduit ce que le joueur veut vraiment savoir :
      « plein dans trois minutes », « vide dans quarante secondes ».

   2. LE MARCHÉ. Le colporteur passe et son cours change chaque jour.
      Vendre son surplus et acheter ce qui manque, c'est ce qui empêche
      une chaîne bloquée de rester bloquée — au prix fort.
   -> window.Marche
   ============================================================ */
"use strict";
(function () {

  const S = () => window.Etat.E;
  const FENETRE = 12;          // secondes de mesure avant de figer un débit

  /* =================================================================
     LES DÉBITS
     ================================================================= */
  function etatFlux() {
    const E = S();
    if (!E.flux) E.flux = { acc: {}, t: 0, taux: {}, prec: {} };
    return E.flux;
  }
  function tickFlux(dt) {
    const E = S(), F = etatFlux();
    F.t += dt;
    if (F.t < FENETRE) return;
    const dur = F.t; F.t = 0;
    for (const id in window.RES) {
      const q = E.res[id] || 0;
      const av = F.prec[id] == null ? q : F.prec[id];
      /* le débit brut ne suffit pas : un stock au plafond ne bouge plus
         alors que la production continue. On ajoute donc ce qui a été
         perdu ou vendu pendant la fenêtre — c'est bien produit. */
      const perdu = (E.gaspille[id] || 0) - (F.perdu && F.perdu[id] != null ? F.perdu[id] : (E.gaspille[id] || 0));
      F.taux[id] = ((q - av) + Math.max(0, perdu)) / dur;
      F.prec[id] = q;
    }
    if (!F.perdu) F.perdu = {};
    for (const id in E.gaspille) F.perdu[id] = E.gaspille[id];
  }
  function debit(id) { return (etatFlux().taux || {})[id] || 0; }
  /* Dans combien de temps la réserve sera-t-elle pleine, ou vide ? */
  function horizon(id) {
    const d = debit(id);
    if (Math.abs(d) < 0.0005) return null;
    const q = window.Etat.qte(id), cap = window.Etat.plafondDe(id);
    if (d > 0) {
      if (!isFinite(cap) || cap > 9000) return null;
      if (q >= cap) return { plein: true, t: 0 };
      return { plein: true, t: (cap - q) / d };
    }
    if (q <= 0) return { plein: false, t: 0 };
    return { plein: false, t: q / -d };
  }

  /* =================================================================
     LE MARCHÉ
     Le cours de chaque denrée dérive d'un jour sur l'autre, entre 70 %
     et 140 % de sa valeur. On ne peut donc pas se contenter d'acheter
     n'importe quand : il faut regarder le tableau.
     ================================================================= */
  function etatMarche() {
    const E = S();
    if (!E.marche) E.marche = { jour: -1, cours: {}, hier: {} };
    majCours();
    return E.marche;
  }
  function majCours() {
    const E = S(), M = E.marche;
    const j = Math.floor(E.tJeu / 260);
    if (M.jour === j) return;
    M.hier = M.cours || {};
    M.cours = {};
    const rng = window.Etat.mulberry(((E.graine ^ (j * 2654435761)) >>> 0) || 1);
    for (const id in window.RES) {
      const base = M.hier[id] || 1;
      /* marche aléatoire bornée : le cours se souvient de la veille, mais
         revient toujours vers un. */
      const v = base * (0.88 + rng() * 0.26) + (1 - base) * 0.18;
      M.cours[id] = Math.max(0.62, Math.min(1.55, v));
    }
    M.jour = j;
  }
  const cours = id => (etatMarche().cours[id] || 1);
  const tendance = id => {
    const M = etatMarche();
    const h = M.hier[id] || 1;
    return (M.cours[id] || 1) - h;
  };

  function ouvertVente() { return window.Etat.nivDeType('taverne') > 0; }
  function ouvertAchat() { return window.Etat.nivDeType('halle') > 0; }

  function prixVente(id) {
    const r = window.RES[id];
    if (!r || id === 'ecu') return 0;
    const n = window.Jeu ? window.Jeu.bonusNegoce() : 0;
    return Math.max(1, Math.round(r.val * cours(id) * (0.55 + n)));
  }
  function prixAchat(id) {
    const r = window.RES[id];
    if (!r || id === 'ecu') return 0;
    const n = window.Jeu ? window.Jeu.bonusNegoce() : 0;
    return Math.max(2, Math.round(r.val * cours(id) * (2.1 - Math.min(0.7, n))));
  }

  function vendre(id, n) {
    n = Math.min(Math.floor(n), Math.floor(window.Etat.qte(id)));
    if (n <= 0) return { ok: false, raison: 'Rien à vendre.' };
    if (!ouvertVente()) return { ok: false, raison: 'Il faut une taverne pour traiter avec le colporteur.' };
    const gain = prixVente(id) * n;
    const c = {}; c[id] = n;
    if (!window.Etat.depenser(c)) return { ok: false, raison: 'Rien à vendre.' };
    window.Etat.gagner('ecu', gain);
    window.Etat.journal('Vendu ' + n + ' ' + window.RES[id].nom.toLowerCase() + ' pour ' + gain + ' écus.', 'info');
    return { ok: true, gain };
  }
  function acheter(id, n) {
    n = Math.floor(n);
    if (n <= 0) return { ok: false, raison: 'Rien à acheter.' };
    if (!ouvertAchat()) return { ok: false, raison: 'Il faut une halle pour faire venir la marchandise.' };
    const cout = prixAchat(id) * n;
    if (window.Etat.qte('ecu') < cout) return { ok: false, raison: 'Écus insuffisants.' };
    window.Etat.depenser({ ecu: cout });
    const pris = window.Etat.gagner(id, n);
    window.Etat.journal('Acheté ' + pris + ' ' + window.RES[id].nom.toLowerCase() + ' pour ' + cout + ' écus.', 'info');
    return { ok: true, cout, pris };
  }

  window.Marche = {
    tickFlux, debit, horizon, etatFlux,
    etatMarche, cours, tendance, prixVente, prixAchat, vendre, acheter,
    ouvertVente, ouvertAchat,
  };

})();
