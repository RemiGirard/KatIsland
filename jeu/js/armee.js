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
    if (!a.equipement) {
      const arme = Math.max(0, Math.min(40, a.palierArme | 0));
      const armure = Math.max(0, Math.min(40, a.palierArmure | 0));
      a.equipement = {
        melee: { arme, armure }, distance: { arme, armure }, magie: { arme, armure },
      };
    }
    for (const type of ['melee', 'distance', 'magie']) {
      if (!a.equipement[type]) a.equipement[type] = { arme: 0, armure: 0 };
      a.equipement[type].arme = Math.max(0, Math.min(40, a.equipement[type].arme | 0));
      a.equipement[type].armure = Math.max(0, Math.min(40, a.equipement[type].armure | 0));
    }
    if (a.forge === undefined) a.forge = null;
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

  function famille(t) {
    if (t === 'melee' || t === 'distance' || t === 'magie') return t;
    const cat = typeof t === 'string' && GD().UNIT_TYPES[t] ? GD().UNIT_TYPES[t].cat : t;
    if (cat === 'tir' || cat === 'explosif') return 'distance';
    if (cat === 'magie') return 'magie';
    return 'melee';
  }

  const LIGNES = {
    melee: { arme: 'WEAPONS', armure: 'ARMORS' },
    distance: { arme: 'RANGED', armure: 'VESTS' },
    magie: { arme: 'STAFFS', armure: 'ROBES' },
  };

  function tierEquipement(type, slot) {
    const a = assure(), f = famille(type);
    return (a.equipement[f] && a.equipement[f][slot]) || 0;
  }

  function objetEquipement(type, slot, tier) {
    const f = famille(type), ligne = GD()[LIGNES[f][slot]] || [];
    const n = tier == null ? tierEquipement(f, slot) : tier;
    return n > 0 ? ligne[Math.min(ligne.length, n) - 1] : null;
  }

  function imageEquipement(type, slot, tier) {
    const f = famille(type), n = Math.max(1, Math.min(40, tier || tierEquipement(f, slot) || 1));
    return 'img/equipement/' + f + '/' + slot + '/tier-' + String(n).padStart(2, '0') + '.png';
  }

  /* Les quatre premiers objets restent accessibles avec les ressources du
     rivage. Ensuite chaque tranche fait entrer une matière réellement
     nouvelle, jusqu'aux composants rapportés de la tour. */
  function coutEquipement(type, slot, tier) {
    const f = famille(type), n = Math.max(1, Math.min(40, tier | 0));
    const textile = f === 'distance' ? 'cuir' : (f === 'magie' ? 'drap' : (slot === 'armure' ? 'cuir' : 'charbonbois'));
    if (n <= 4) return { bois: 4 + n * 3, poisson: 3 + n * 2 };
    if (n <= 8) return { lingotfer: 2 + (n - 5) * 2, bois: 8 + n * 2 };
    if (n <= 12) return { lingotfer: 8 + (n - 9) * 3, [textile]: 3 + (n - 9) * 2 };
    if (n <= 16) return { bronze: 5 + (n - 13) * 3, cuir: 4 + (n - 13) * 2 };
    if (n <= 20) return { acier: 6 + (n - 17) * 4, [textile]: 8 + (n - 17) * 3 };
    if (n <= 24) return { lingotargent: 5 + (n - 21) * 3, acier: 12 + (n - 21) * 4 };
    if (n <= 28) return { lingotor: 3 + (n - 25) * 2, gemme: 1 + (n - 25) };
    if (n <= 32) return { mithril: 2 + (n - 29) * 2, essence: 5 + (n - 29) * 3 };
    if (n <= 36) return { obsidienne: 3 + (n - 33) * 2, coeurbiome: 1 + (n - 33) };
    return { relique: 1 + Math.floor((n - 37) / 2), oeilabyme: 1 + (n - 37), mithril: 10 + (n - 37) * 5 };
  }

  function ameliorerEquipement(type, slot, limite) {
    const a = assure(), f = famille(type), prochain = tierEquipement(f, slot) + 1;
    if (a.forge) return { ok: false, raison: 'La forge travaille déjà sur une autre pièce.' };
    if (prochain > 40) return { ok: false, raison: 'Cette ligne a atteint le palier 40.' };
    if (limite != null && prochain > limite) return { ok: false, raison: 'Améliorez la forge pour débloquer ce palier.' };
    const cout = coutEquipement(f, slot, prochain);
    if (!window.Etat.depenser(cout)) return { ok: false, raison: 'Il manque des ressources.' };
    const objet = objetEquipement(f, slot, prochain);
    a.forge = { type: f, slot, tier: prochain, prog: 0,
      duree: Math.max(1, (objet && objet.craftTime) || 30) };
    return { ok: true, tier: prochain, objet, attente: true };
  }

  function avancerForge(dt) {
    const a = assure(), job = a.forge;
    if (!job) return null;
    job.prog = Math.min(job.duree, (job.prog || 0) + Math.max(0, dt || 0));
    if (job.prog < job.duree) return null;
    a.equipement[job.type][job.slot] = job.tier;
    a.palierArme = Math.max(a.palierArme || 0, ...Object.values(a.equipement).map(x => x.arme));
    a.palierArmure = Math.max(a.palierArmure || 0, ...Object.values(a.equipement).map(x => x.armure));
    const fini = Object.assign({}, job, { objet: objetEquipement(job.type, job.slot, job.tier) });
    a.forge = null;
    if (window.Etat && window.Etat.journal) window.Etat.journal('Forge achevée : ' + fini.objet.name + '.', 'plan');
    return fini;
  }

  function stats(t) {
    const a = assure();
    const d = GD().UNIT_TYPES[t];
    if (!d) return null;
    const rang = a.rangs[t] || 0;
    const evo = GD().evoStatMult ? GD().evoStatMult(rang) : Math.pow(1.055, rang);
    const f = famille(t), arme = tierEquipement(f, 'arme'), armure = tierEquipement(f, 'armure');
    const s = Object.assign({}, d.base);
    s.hp *= evo * (1 + armure * 0.055);
    s.dmg *= evo * (1 + arme * 0.085);
    s.armure = armure * 2.2;
    s.cat = d.cat || 'melee';
    s.ability = d.ability || null;
    s.regen = 0;
    /* Dans le moteur hérité, weapon/armor sont des indices visuels, pas
       des valeurs de défense. Les mélanger cassait les silhouettes. */
    s.weapon = f === 'melee' ? Math.max(0, arme - 1) : 0;
    s.armor = f === 'melee' ? Math.max(0, armure - 1) : 0;
    s.ranged = f === 'distance' ? Math.max(0, arme - 1) : 0;
    s.vest = f === 'distance' ? Math.max(0, armure - 1) : 0;
    s.staff = f === 'magie' ? Math.max(0, arme - 1) : 0;
    s.robe = f === 'magie' ? Math.max(0, armure - 1) : 0;
    s.evo = rang;
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
    stats, statsCombat, puissance, gagnerXp, pertes, famille, tierEquipement,
    objetEquipement, imageEquipement, coutEquipement, ameliorerEquipement, avancerForge };
  assure();
})();
