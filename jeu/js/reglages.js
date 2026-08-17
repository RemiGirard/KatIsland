/* ============================================================
   LE BOURG — js/reglages.js
   LES RÉGLAGES, et la fenêtre qui va avec.

   Un idle se joue longtemps : ce qui gêne au bout de deux heures gêne
   ensuite tous les jours. Chaque réglage ici répond à une gêne précise —
   la taille du texte, la notation des grands nombres, la place du dock,
   le bruit des messages, la vitesse du jour.

   Tout est appliqué IMMÉDIATEMENT et enregistré avec la partie.
   -> window.Reglages
   ============================================================ */
"use strict";
(function () {

  const DEFAUTS = {
    notation: 'court',        // court | complet | compact
    echelle: 100,             // 90 · 100 · 110 · 125
    accent: 'corail',         // corail | or | vert | bleu | violet
    dockCote: 'gauche',       // gauche | droite
    gains: true,              // les gains qui montent au-dessus des ateliers
    gestes: true,             // les gestes de métier
    foule: 1,                 // 0 clairsemée · 1 dense · 2 foule
    /* Le rendu des habitants dans le village : les sprites de la
       compagnie (ceux des expéditions) ou de petits chats en volumes.
       Les deux existent pour être comparés — l'un a le charme dessiné,
       l'autre tourne vraiment sur lui-même. */
    habitants: 'sprite',      // 'sprite' | 'bloc' | 'aucun'
    vitesseJour: 'normal',    // lent | normal | rapide | fige
    messages: 'tous',         // tous | importants | aucun
    confirmer: true,          // demander avant les gestes irréversibles
  };

  const ACCENTS = {
    corail:  { nom: 'Corail',  v: '#e0625c', v2: '#8f3a37' },
    or:      { nom: 'Or',      v: '#e6c069', v2: '#8a6f34' },
    vert:    { nom: 'Mousse',  v: '#7fb069', v2: '#48663a' },
    bleu:    { nom: 'Rivière', v: '#5f9ad0', v2: '#35597a' },
    violet:  { nom: 'Bruyère', v: '#8f7fc0', v2: '#57487f' },
  };
  const VITESSES = { lent: 1 / 520, normal: 1 / 260, rapide: 1 / 110, fige: 0 };

  function O() {
    const E = window.Etat.E;
    if (!E.options) E.options = {};
    for (const k in DEFAUTS) if (E.options[k] === undefined) E.options[k] = DEFAUTS[k];
    return E.options;
  }

  function lire(k) { return O()[k]; }
  function ecrire(k, v) {
    O()[k] = v;
    appliquer();
    window.Etat.sauver();
    window.Etat.prevenir('reglage', k);
  }

  /* ---------------------------------------------------------------
     APPLIQUER : tout ce qui doit changer d'aspect ou de comportement.
     --------------------------------------------------------------- */
  function appliquer() {
    const o = O(), r = document.documentElement;
    const a = ACCENTS[o.accent] || ACCENTS.corail;
    r.style.setProperty('--corail', a.v);
    r.style.setProperty('--corail2', a.v2);
    const c = document.getElementById('couche');
    if (c) c.style.zoom = (o.echelle / 100).toFixed(2);
    document.body.classList.toggle('dock-droite', o.dockCote === 'droite');
    if (window.Village) {
      window.Village.vitesseJour(VITESSES[o.vitesseJour] != null ? VITESSES[o.vitesseJour] : DEFAUTS.vitesseJour);
      window.Village.figerTemps(o.vitesseJour === 'fige');
      window.Village.densite(o.foule);
      window.Village.reglages({ gains: !!o.gains, gestes: !!o.gestes });
    if (window.Habitants3D) window.Habitants3D.definirMode(o.habitants || 'sprite');
    }
  }

  /* ---------------------------------------------------------------
     LA NOTATION DES NOMBRES
     --------------------------------------------------------------- */
  function formater(n) {
    n = Math.floor(n || 0);
    const mode = O().notation;
    if (mode === 'complet') return n.toLocaleString('fr-FR');
    if (mode === 'compact') {
      if (n < 1000) return String(n);
      const u = ['', 'k', 'M', 'G', 'T', 'P'];
      let i = 0, v = n;
      while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
      return (v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)) + u[i];
    }
    if (n < 1000) return String(n);
    if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace('.', ',') + ' k';
    if (n < 1e9) return (n / 1e6).toFixed(2).replace('.', ',') + ' M';
    if (n < 1e12) return (n / 1e9).toFixed(2).replace('.', ',') + ' G';
    return (n / 1e12).toFixed(2).replace('.', ',') + ' T';
  }

  /* ---------------------------------------------------------------
     EXPORT / IMPORT — une partie doit pouvoir suivre son joueur.
     --------------------------------------------------------------- */
  function exporter() {
    const E = window.Etat.E;
    if (window.Village) E.plan = window.Village.plan();
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(E)))); }
    catch (e) { return null; }
  }
  function importer(txt) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(String(txt).trim()))));
      if (!d || !d.habitants) return { ok: false, raison: 'Ce texte n\'est pas une partie.' };
      localStorage.setItem('bourg.sauvegarde.v1', JSON.stringify(d));
      return { ok: true };
    } catch (e) { return { ok: false, raison: 'Texte illisible : ' + e.message }; }
  }

  window.Reglages = { DEFAUTS, ACCENTS, VITESSES, O, lire, ecrire, appliquer, formater, exporter, importer };

})();
