/* ============================================================
   LE BOURG — js/armee.js
   Registre des unités formées au bourg. L'ancienne sauvegarde ne
   connaissait qu'un compteur : elle est migrée en lanciers, sans perte.
   ============================================================ */
"use strict";
(function () {
  const E = () => window.Etat.E;
  const GD = () => window.GameData;

  function assure() {
    const a = E().armee || (E().armee = {});
    if (!a.types) {
      a.types = {};
      if ((a.unites || 0) > 0) a.types.lancier = a.unites | 0;
    }
    if (!a.rangs) a.rangs = {};
    if (!a.xpTypes) a.xpTypes = {};
    if (!a.pouvoirs) a.pouvoirs = {};
    if (!Array.isArray(a.composition)) a.composition = [];
    for (const t in a.types) {
      if (a.types[t] > 0 && a.rangs[t] == null) a.rangs[t] = 3;
      choisirPouvoirInitial(t);
    }
    synchroniser();
    if (!a.composition.length) {
      a.composition = typesPossedes().slice(0, 5);
    }
    a.composition = a.composition.filter(t => (a.types[t] || 0) > 0).slice(0, 5);
    return a;
  }

  function synchroniser() {
    const a = E().armee;
    if (!a || !a.types) return 0;
    a.unites = Object.keys(a.types).reduce((n, t) => n + Math.max(0, a.types[t] | 0), 0);
    return a.unites;
  }

  function typesPossedes() {
    const a = E().armee;
    const ordre = (GD().UNIT_ORDER || []).filter(t => !GD().isWorker || !GD().isWorker(t));
    return ordre.filter(t => a && a.types && (a.types[t] || 0) > 0);
  }

  function nom(t) {
    const d = GD().UNIT_TYPES && GD().UNIT_TYPES[t];
    return d ? ((d.name && (d.name.cats || d.name)) || t) : t;
  }

  function choisirPouvoirInitial(t) {
    const a = E().armee;
    if (!a || !a.pouvoirs || a.pouvoirs[t]) return;
    const rang = (a.rangs && a.rangs[t]) || 0;
    const p = ((GD().UNIT_POWERS || {})[t] || []).find(x => (x.unlockEvo || 0) <= rang);
    if (p) a.pouvoirs[t] = p.id;
  }

  function ajouter(t, n) {
    const a = assure();
    if (!GD().UNIT_TYPES[t]) t = 'lancier';
    a.types[t] = (a.types[t] || 0) + Math.max(0, n | 0);
    if (a.rangs[t] == null) a.rangs[t] = 3;
    choisirPouvoirInitial(t);
    if (a.composition.indexOf(t) < 0 && a.composition.length < 5) a.composition.push(t);
    synchroniser();
    return a.types[t];
  }

  function retirer(t, n) {
    const a = assure();
    const pris = Math.min(a.types[t] || 0, Math.max(0, n | 0));
    a.types[t] = Math.max(0, (a.types[t] || 0) - pris);
    if (!a.types[t]) a.composition = a.composition.filter(x => x !== t);
    synchroniser();
    return pris;
  }

  function colonne() {
    const a = assure();
    let ts = a.composition.filter(t => (a.types[t] || 0) > 0);
    if (!ts.length) ts = typesPossedes().slice(0, 5);
    return ts.map(t => ({ type: t, n: a.types[t] | 0 })).filter(x => x.n > 0);
  }

  function nombreColonne() { return colonne().reduce((n, x) => n + x.n, 0); }

  function basculer(t) {
    const a = assure();
    if (!(a.types[t] > 0)) return false;
    const i = a.composition.indexOf(t);
    if (i >= 0) a.composition.splice(i, 1);
    else {
      if (a.composition.length >= 5) return false;
      a.composition.push(t);
    }
    return true;
  }

  function pouvoirActif(t) {
    const a = assure();
    const id = a.pouvoirs[t];
    return ((GD().UNIT_POWERS || {})[t] || []).find(p => p.id === id) || null;
  }

  function choisirPouvoir(t, id) {
    const a = assure();
    const p = ((GD().UNIT_POWERS || {})[t] || []).find(x => x.id === id);
    if (!p || (p.unlockEvo || 0) > (a.rangs[t] || 0)) return false;
    a.pouvoirs[t] = id;
    return true;
  }

  function stats(t) {
    const a = assure();
    const d = GD().UNIT_TYPES[t];
    if (!d) return null;
    const rang = a.rangs[t] || 0;
    const evo = GD().evoStatMult ? GD().evoStatMult(rang) : Math.pow(1.055, rang);
    const arme = a.palierArme || 0, armure = a.palierArmure || 0;
    const s = Object.assign({}, d.base);
    s.hp *= evo * (1 + armure * 0.055);
    s.dmg *= evo * (1 + arme * 0.085);
    s.armure = armure * 2.2;
    s.cat = d.cat || 'melee';
    s.ability = d.ability || null;
    s.regen = 0;
    /* Dans le moteur hérité, weapon/armor sont des indices visuels, pas
       des valeurs de défense. Les mélanger cassait les silhouettes. */
    s.weapon = Math.min(((GD().WEAPONS || []).length || 1) - 1, arme);
    s.armor = Math.min(((GD().ARMORS || []).length || 1) - 1, armure);
    s.ranged = 0; s.staff = 0; s.evo = rang;
    s.power = pouvoirActif(t);
    return s;
  }

  function statsCombat(faction, t) {
    return faction === 'cats' ? stats(t) : null;
  }

  function puissance(ligne) {
    return (ligne || colonne()).reduce((sum, x) => {
      const s = stats(x.type);
      if (!s) return sum;
      const portee = s.range > 0 ? 1.12 : 1;
      const soutien = s.dmg <= 0 ? 1.35 : 1;
      const technique = s.power ? 1.18 : 1;
      return sum + x.n * (Math.sqrt(Math.max(1, s.hp)) * Math.max(0.8, s.dmg || 1) * portee * soutien * technique);
    }, 0);
  }

  function gagnerXp(ligne, gain) {
    const a = assure();
    const ls = (ligne && ligne.length ? ligne : colonne());
    if (!ls.length || !gain) return;
    const part = Math.max(1, Math.round(gain / ls.length));
    for (const x of ls) {
      a.xpTypes[x.type] = (a.xpTypes[x.type] || 0) + part;
      let garde = 0;
      while ((a.rangs[x.type] || 0) < 30 && garde++ < 30) {
        const besoin = 35 + (a.rangs[x.type] || 0) * 22;
        if (a.xpTypes[x.type] < besoin) break;
        a.xpTypes[x.type] -= besoin;
        a.rangs[x.type] = (a.rangs[x.type] || 0) + 1;
        choisirPouvoirInitial(x.type);
      }
    }
    a.xp = (a.xp || 0) + gain;
  }

  function pertes(ligne, n) {
    const ls = (ligne || colonne()).map(x => ({ type: x.type, n: x.n }));
    let reste = Math.min(nombreColonne(), Math.max(0, n | 0));
    const perdu = {};
    while (reste > 0 && ls.some(x => x.n > 0)) {
      for (const x of ls) {
        if (!reste) break;
        if (x.n > 0) { x.n--; reste--; perdu[x.type] = (perdu[x.type] || 0) + 1; retirer(x.type, 1); }
      }
    }
    return perdu;
  }

  window.Armee = { assure, synchroniser, typesPossedes, nom, ajouter, retirer,
    colonne, nombreColonne, basculer, pouvoirActif, choisirPouvoir,
    stats, statsCombat, puissance, gagnerXp, pertes };
  assure();
})();
