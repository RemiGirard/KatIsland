/* ============================================================
   LE BOURG — js/images.js
   LE CHARGEUR D'IMAGES.

   Le navigateur ne sait pas lister un dossier : il ne peut demander
   qu'une adresse précise. Tout ce module sert donc à une seule chose —
   CALCULER une adresse, et savoir d'avance si elle existe.

   `img/images.json` est écrit par `node jeu/ranger-images.js`. Il dit
   quelles ressources ont une image, et combien de portraits vivent dans
   chaque dossier de métier. Sans lui, on ne demande rien : une image
   absente hurle dans la console et laisse un cadre brisé à l'écran.

   LA RÈGLE DES PORTRAITS, telle que le joueur la vit :
     · un chat COMMUN prend un visage quelconque — dossier `standard` ;
     · dès qu'il sort du lot, il prend le visage de SON MÉTIER.
   C'est ce qui fait qu'un Légende se reconnaît d'un coup d'œil dans la
   liste, sans lire une étiquette.

   -> window.Img
   ============================================================ */
"use strict";
(function () {

  let plan = null;                 // le manifeste, une fois chargé
  let pret = false;
  const enAttente = [];

  function adopter(j) {
    plan = j || { portrait: {}, res: [], bat: [], metier: [], unite: [], gardien: [] };
    plan.resSet = new Set(plan.res || []);
    plan.batSet = new Set(plan.bat || []);
    plan.metierSet = new Set(plan.metier || []);
    plan.uniteSet = new Set(plan.unite || []);
    plan.gardienSet = new Set(plan.gardien || []);
    pret = true;
    for (const f of enAttente) { try { f(); } catch (e) { } }
    enAttente.length = 0;
  }

  /* LE CHEMIN NORMAL : `img/images.js` a été chargé par une balise
     <script> avant nous. Le plan est donc là AVANT le premier rendu —
     aucune course, et cela marche même en file://, quand la page est
     ouverte d'un double-clic sans serveur. */
  if (window.__IMAGES) {
    adopter(window.__IMAGES);
  } else {
    /* Le repli, pour une arborescence où le script n'aurait pas été
       engendré : on tente le JSON, et l'on REDESSINE en arrivant —
       sans quoi l'écran garde les icônes de secours pour toujours. */
    fetch('img/images.json')
      .then(r => r.ok ? r.json() : null)
      .then(j => { adopter(j); repeindre(); })
      .catch(() => { adopter(null); });
  }

  /* Quand le plan arrive en retard, les nœuds déjà posés portent des
     icônes dessinées. On force un rendu complet : le réconciliateur
     échange alors chaque image contre la bonne. */
  function repeindre() {
    try {
      if (window.Etat && window.Etat.prevenir) window.Etat.prevenir('images', null);
      if (window.App && window.App.majAffectations) window.App.majAffectations();
    } catch (e) { }
  }

  function quandPret(f) { pret ? f() : enAttente.push(f); }

  /* ------------------------------------------------------------------
     LES RESSOURCES, LES BÂTIMENTS, LES MÉTIERS
     `cerne` : la variante à contour, pour les fonds sombres. Par
     défaut on rend la version nue — elle se pose mieux sur les
     panneaux clairs.
     ------------------------------------------------------------------ */
  function res(id, cerne) {
    if (!plan || !plan.resSet.has(id)) return null;
    return 'img/res/' + id + '/' + id + (cerne ? '-cerne' : '') + '.png';
  }
  function bat(id) {
    if (!plan || !plan.batSet.has(id)) return null;
    return 'img/bat/' + id + '/' + id + '.png';
  }
  function metier(id) {
    if (!plan || !plan.metierSet.has(id)) return null;
    return 'img/metier/' + id + '/' + id + '.png';
  }
  function unite(id) {
    if (!plan || !plan.uniteSet.has(id)) return null;
    return 'img/unite/' + id + '/' + id + '.png';
  }
  function gardien(id) {
    if (!plan || !plan.gardienSet.has(String(id))) return null;
    return 'img/gardien/' + id + '/gardien-' + id + '.png';
  }

  /* ------------------------------------------------------------------
     LES PORTRAITS
     ------------------------------------------------------------------ */

  /* Un habitant doit garder le même visage toute sa vie. On ne tire
     donc pas au sort à l'affichage : on dérive le numéro de son
     identifiant, qui ne change jamais. */
  function graineDe(h) {
    let n = 0;
    const s = String((h && h.id) || '') + '|' + String((h && h.nom) || '');
    for (let i = 0; i < s.length; i++) n = (Math.imul(n, 31) + s.charCodeAt(i)) | 0;
    return Math.abs(n);
  }

  function sexeDe(h) {
    if (h && h.sexe) return h.sexe;
    /* sauvegardes d'avant : on lui en attribue un, dérivé de son id,
       pour qu'il ne change pas d'une session à l'autre */
    return (graineDe(h) % 2) ? 'femme' : 'homme';
  }

  /* Le dossier dont ce chat relève. Commun : un visage quelconque.
     Au-dessus : le visage de son métier. */
  function dossierDe(h) {
    if (!h) return 'standard';
    return (h.rarete && h.rarete !== 'commun' && h.talent) ? h.talent : 'standard';
  }

  function portrait(h) {
    if (!plan || !h) return null;
    const sexe = sexeDe(h);
    const g = graineDe(h);
    /* on essaie son dossier, puis le sexe opposé du même dossier, puis
       le générique : mieux vaut un visage que pas de visage. */
    const essais = [
      [dossierDe(h), sexe],
      [dossierDe(h), sexe === 'homme' ? 'femme' : 'homme'],
      ['standard', sexe],
      ['standard', sexe === 'homme' ? 'femme' : 'homme'],
    ];
    for (const [d, s] of essais) {
      const e = plan.portrait[d];
      if (!e || !e[s]) continue;
      const n = (g % e[s]) + 1;
      return 'img/portrait/' + d + '/' + s + '/' +
             d + '-' + s + '-' + String(n).padStart(2, '0') + '.png';
    }
    return null;
  }

  /* ------------------------------------------------------------------
     LE RENDU
     `vignette` rend une image si elle existe, et RETOMBE sur l'icône
     dessinée sinon. Aucun appelant n'a donc à savoir si le joueur a
     déposé ses images ou non.
     ------------------------------------------------------------------ */
  function vignette(src, taille, alt, classe) {
    const i = document.createElement('img');
    i.src = src;
    i.alt = alt || '';
    i.loading = 'lazy';
    i.decoding = 'async';
    i.className = 'vig' + (classe ? ' ' + classe : '');
    i.style.width = taille + 'px';
    i.style.height = taille + 'px';
    return i;
  }

  /* L'icône d'une ressource : l'image si on l'a, le dessin sinon. C'est
     le SEUL point de bascule — tout le jeu passe par là, des puces de
     coût aux tables de butin. */
  function icoRes(id, taille, cerne) {
    const r = window.RES[id];
    const s = res(id, cerne);
    if (s) return vignette(s, taille, r ? r.nom : id, 'vig-res');
    return window.Icones.image(r ? r.ico : { f: 'cube', c: ['#8a8272'] }, taille || 24);
  }

  window.Img = {
    quandPret, res, bat, metier, portrait, sexeDe, dossierDe,
    unite, gardien, vignette, icoRes,
    get pret() { return pret; },
    get plan() { return plan; },
  };

})();
