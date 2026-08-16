/* ============================================================
   LE BOURG — js/prestige.js
   LES OBJECTIFS QUI SE REMPLISSENT, ET LA CHARTE QU'ON SCELLE.

   Les objectifs se vérifient tout seuls deux fois par seconde et se
   réclament d'un clic — jamais automatiquement : ouvrir la page et voir
   trois récompenses en attente fait partie du plaisir.

   La Charte, elle, est la seule chose du jeu qu'on ne peut pas défaire.
   Elle efface le bourg et rend des SCEAUX, qui achètent des avantages
   valables pour toutes les parties suivantes.
   -> window.Prestige
   ============================================================ */
"use strict";
(function () {

  const S = () => window.Etat.E;

  function etat() {
    const E = S();
    if (!E.obj) E.obj = { faits: {}, pris: {} };
    if (!E.charte) E.charte = { sceaux: 0, perks: {}, chartes: 0, totalSceaux: 0 };
    return E;
  }

  /* =================================================================
     LES OBJECTIFS
     ================================================================= */
  function avancement(o) {
    let v = 0;
    try { v = o.mesure() || 0; } catch (e) { v = 0; }
    return Math.max(0, Math.min(1, v / o.cible));
  }
  function fait(o) { return !!etat().obj.faits[o.id]; }
  function pris(o) { return !!etat().obj.pris[o.id]; }

  let acc = 0;
  function tick(dt) {
    acc += dt;
    if (acc < 0.5) return;
    acc = 0;
    const E = etat();
    for (const o of window.OBJECTIFS) {
      if (E.obj.faits[o.id]) continue;
      if (avancement(o) >= 1) {
        E.obj.faits[o.id] = 1;
        window.Etat.journal('Objectif atteint : ' + o.nom + '.', 'butin');
        window.Etat.prevenir('objectif', o.id);
      }
    }
  }
  function reclamer(id) {
    const o = window.OBJECTIFS.find(x => x.id === id);
    const E = etat();
    if (!o || !E.obj.faits[id] || E.obj.pris[id]) return { ok: false };
    E.obj.pris[id] = 1;
    const recu = window.Etat.gagnerLot(o.rec);
    window.Etat.journal('Récompense reçue : ' + o.nom + '.', 'bien');
    return { ok: true, recu };
  }
  function reclamerTout() {
    let n = 0;
    for (const o of window.OBJECTIFS) if (reclamer(o.id).ok) n++;
    return n;
  }
  function enAttente() {
    const E = etat();
    return window.OBJECTIFS.filter(o => E.obj.faits[o.id] && !E.obj.pris[o.id]).length;
  }

  /* =================================================================
     LA CHARTE
     ================================================================= */
  /* Combien de sceaux le bourg actuel vaut-il ? On compte ce qui a
     demandé du TEMPS : la profondeur atteinte, le territoire, les
     recherches, la taille du bourg. Pas les stocks — ils se refont. */
  function sceauxGagnables() {
    const E = S();
    const prof = E.aventure.record || 0;
    const terr = E.territoires.length;
    const rech = Object.keys(E.recherches || {}).length;
    const bat = Object.keys(E.bat).length;
    const hab = E.habitants.length;
    const objs = Object.keys(E.obj ? E.obj.faits : {}).length;
    const brut = prof * 0.5 + terr * 3 + rech * 1.2 + bat * 0.5 + hab * 0.35 + objs * 0.8;
    return Math.floor(Math.max(0, brut) / 4);
  }
  function seuilAtteint() { return sceauxGagnables() >= 5; }

  function perkRang(id) { return (etat().charte.perks[id] || 0); }
  function perkEffets() {
    const out = { global: 0, habitants: 0, stock: 0, memoire: 0, ecus: 0,
                  colonne: 0, descente: 0, plans: 0 };
    for (const p of window.SCEAUX_PERKS) {
      const n = perkRang(p.id);
      if (!n) continue;
      const e = p.effet(n);
      for (const k in e) out[k] = (out[k] || 0) + e[k];
    }
    return out;
  }
  function acheterPerk(id) {
    const p = window.SCEAUX_PERKS.find(x => x.id === id);
    const E = etat();
    if (!p) return { ok: false, raison: 'Inconnu.' };
    const n = perkRang(id);
    if (n >= p.max) return { ok: false, raison: 'Dernier cran atteint.' };
    const c = p.cout(n);
    if (E.charte.sceaux < c) return { ok: false, raison: 'Il faut ' + c + ' sceaux.' };
    E.charte.sceaux -= c;
    E.charte.perks[id] = n + 1;
    window.Etat.journal('Sceau apposé : ' + p.nom + ' au cran ' + (n + 1) + '.', 'plan');
    if (window.Jeu) window.Jeu.invaliderAcquis();
    window.Etat.invaliderCap();
    return { ok: true };
  }

  /* SCELLER : on garde la charte, les sceaux, les perks, le record de
     descente et la mémoire des métiers ; tout le reste repart. */
  function sceller() {
    const E = S();
    const gain = sceauxGagnables();
    if (gain < 5) return { ok: false, raison: 'Le bourg n\'a pas encore assez fait ses preuves.' };
    const charte = {
      sceaux: (E.charte.sceaux || 0) + gain,
      perks: Object.assign({}, E.charte.perks),
      chartes: (E.charte.chartes || 0) + 1,
      totalSceaux: (E.charte.totalSceaux || 0) + gain,
    };
    const eff = perkEffets();
    const memoire = eff.memoire || 0;
    const metiersGardes = {};
    if (memoire > 0) for (const m in E.metiers) metiersGardes[m] = Math.floor((E.metiers[m] || 0) * memoire);
    const record = E.aventure.record || 0;
    const nom = E.nomBourg;

    if (window.Village) window.Village.chargerPlan([]);
    const neuf = window.Etat.recommencer();
    neuf.charte = charte;
    neuf.aventure.record = record;
    neuf.nomBourg = nom;
    for (const m in metiersGardes) neuf.metiers[m] = metiersGardes[m];
    /* ce que les sceaux offrent au départ */
    for (let i = 0; i < (eff.habitants || 0); i++) window.Etat.ajouterHabitant();
    if (eff.ecus) window.Etat.gagner('ecu', eff.ecus);
    if (eff.plans) window.Etat.gagner('plan', eff.plans);
    window.Etat.journal('La charte est scellée. Le bourg repart, ' + gain + ' sceaux en poche.', 'plan');
    window.Etat.sauver(true);
    return { ok: true, gain };
  }

  window.Prestige = {
    etat, tick, avancement, fait, pris, reclamer, reclamerTout, enAttente,
    sceauxGagnables, seuilAtteint, perkRang, perkEffets, acheterPerk, sceller,
  };

})();
