/* ============================================================
   LE BOURG — js/vie-village.js
   Le village comme lieu habité : propreté, sécurité, loisirs et moral
   individuel. Les valeurs sont dérivées de ce qui existe à l'écran ;
   elles ne sont jamais des jauges décoratives sans cause.
   ============================================================ */
"use strict";
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const E = () => window.Etat.E;

  const PLAINTES = {
    faim: ["Mon estomac vient de déposer une réclamation.", "Le menu du jour ressemble beaucoup au menu d'hier : rien."],
    sale: ["La rue colle aux pattes. La rue nie tout.", "J'ai trouvé un balai. Il cherchait son employé."],
    peur: ["Quelqu'un a encore dit que la Nuée était ‘presque là’.", "Les remparts grincent plus fort que le garde."],
    ennui: ["J'ai compté les tuiles. Deux fois.", "Même la pelote refuse de sortir."],
    logement: ["Mon lit est occupé. Par son propriétaire, paraît-il.", "Nous sommes trois dans une chambre prévue pour deux chats et demi."],
    travail: ["Je produis, donc je suis fatigué.", "Mon outil connaît mieux mes pattes que moi."],
    bien: ["Aujourd'hui, le bourg ronronne juste.", "Rien ne brûle et la soupe est chaude : méfiance."],
  };

  function assurerHabitant(h) {
    if (!h.vie || typeof h.vie !== 'object') h.vie = {};
    const v = h.vie;
    if (typeof v.moral !== 'number') v.moral = 55;
    if (typeof v.cible !== 'number') v.cible = v.moral;
    if (!v.humeur) v.humeur = 'stable';
    if (!v.plainte) v.plainte = PLAINTES.bien[0];
    if (typeof v.revision !== 'number') v.revision = 0;
    return v;
  }

  function sommeEffet(cle) {
    let n = 0;
    for (const bid in E().bat) {
      const b = E().bat[bid], d = window.BAT[b.type];
      if (!d || !d.effet || !d.effet[cle]) continue;
      const postes = (b.postes || []).filter(p => p.hab).length;
      const actif = b.postes && b.postes.length ? Math.max(0.35, postes / b.postes.length) : 1;
      n += d.effet[cle] * (1 + 0.28 * Math.max(0, b.niv - 1)) * actif;
    }
    return n;
  }

  function etatVillage() {
    const e = E();
    if (!e.village || typeof e.village !== 'object') e.village = {};
    const v = e.village;
    for (const k of ['propreteBonus','securiteBonus','loisirBonus','entretienBonus'])
      if (typeof v[k] !== 'number') v[k] = 0;
    const pop = Math.max(1, e.habitants.length);
    const logements = Math.max(1, window.Etat.logementTotal());
    const occupation = pop / logements;
    const endommages = Object.values(e.bat).filter(b => b.endommage > 0).length;
    const vivres = ['poisson','pain','tourte','poissonfume','fromage'].reduce((n,id) => n + window.Etat.qte(id), 0);

    v.proprete = clamp(62 - Math.max(0, pop - 4) * 1.7 - endommages * 5
      + sommeEffet('proprete') + v.propreteBonus, 0, 100);
    v.securite = clamp(52 + sommeEffet('securite') + sommeEffet('defense') * 0.32
      + ((e.armee && e.armee.garnison) || 0) * 1.5 - (e.menace || 0) * 0.38
      - endommages * 4 + v.securiteBonus, 0, 100);
    v.loisir = clamp(38 + sommeEffet('loisir') + sommeEffet('moral') * 1.1
      - Math.max(0, pop - 8) * 0.8 + v.loisirBonus, 0, 100);
    v.logement = clamp(100 - Math.max(0, occupation - 0.70) * 135, 0, 100);
    v.repas = e.famine ? 3 : clamp(45 + (vivres / pop) * 4.5, 35, 100);
    v.entretien = clamp(72 - endommages * 18 + v.entretienBonus, 0, 100);
    v.harmonie = Math.round(v.proprete * 0.20 + v.securite * 0.25 + v.loisir * 0.18
      + v.logement * 0.16 + v.repas * 0.16 + v.entretien * 0.05);
    return v;
  }

  function humeurPour(n) {
    if (n >= 86) return 'rayonnant';
    if (n >= 70) return 'content';
    if (n >= 50) return 'stable';
    if (n >= 30) return 'morose';
    return 'à bout';
  }
  function clePlainte(v, h) {
    const valeurs = [
      ['faim', v.repas], ['sale', v.proprete], ['peur', v.securite],
      ['ennui', v.loisir], ['logement', v.logement],
    ].sort((a,b) => a[1] - b[1]);
    if (valeurs[0][1] < 52) return valeurs[0][0];
    if (h.aff && valeurs[0][1] < 70) return 'travail';
    return 'bien';
  }
  function choisirPhrase(h, cle) {
    const l = PLAINTES[cle] || PLAINTES.bien;
    let n = 0, s = String(h.id || '') + ':' + Math.floor(E().tJeu / 90);
    for (let i = 0; i < s.length; i++) n = (Math.imul(n, 33) + s.charCodeAt(i)) | 0;
    return l[Math.abs(n) % l.length];
  }

  function tick(dt) {
    const e = E(), ville = etatVillage();
    const village = e.village;
    /* Les actions municipales créent un répit, pas un bonus éternel. */
    const decay = Math.max(0, dt) * 0.018;
    for (const k of ['propreteBonus','securiteBonus','loisirBonus','entretienBonus'])
      village[k] = Math.max(0, (village[k] || 0) - decay);
    for (const h of e.habitants) {
      const vie = assurerHabitant(h);
      let cible = ville.harmonie + window.HAB.somme(h, 'moral') * 4;
      if (h.aff && h.aff.k === 'chantier') cible -= 5;
      if (h.aff && h.aff.k === 'poste') {
        const b = e.bat[h.aff.bat];
        if (b && b.endommage > 0) cible -= 9;
        if (b && b.postes[h.aff.i] && b.postes[h.aff.i].bloque) cible -= 4;
      }
      vie.cible = clamp(cible, 0, 100);
      const pas = 1 - Math.exp(-Math.max(0, dt) / 150);
      vie.moral = clamp(vie.moral + (vie.cible - vie.moral) * pas, 0, 100);
      vie.humeur = humeurPour(vie.moral);
      vie.revision -= dt;
      if (vie.revision <= 0) {
        const cle = clePlainte(ville, h);
        vie.plainte = choisirPhrase(h, cle);
        vie.revision = 65 + (Math.abs(String(h.id).length * 17) % 50);
      }
    }
    village.moralMoyen = moralGlobal();
  }

  function moralGlobal() {
    const l = E().habitants;
    if (!l.length) return 50;
    return Math.round(l.reduce((n,h) => n + assurerHabitant(h).moral, 0) / l.length);
  }

  function finirRecette(rec, h) {
    if (!rec) return;
    const v = etatVillage();
    if (rec.proprete) v.propreteBonus = clamp((v.propreteBonus || 0) + rec.proprete * 0.45, 0, 40);
    if (rec.securite) v.securiteBonus = clamp((v.securiteBonus || 0) + rec.securite * 0.45, 0, 30);
    if (rec.loisir) v.loisirBonus = clamp((v.loisirBonus || 0) + rec.loisir * 0.45, 0, 45);
    if (rec.entretien) v.entretienBonus = clamp((v.entretienBonus || 0) + rec.entretien * 0.45, 0, 35);
    if (h && (rec.proprete || rec.loisir || rec.securite)) {
      const vie = assurerHabitant(h);
      vie.moral = clamp(vie.moral + 0.6, 0, 100);
    }
  }

  function resume() {
    const v = etatVillage();
    return {
      proprete:Math.round(v.proprete), securite:Math.round(v.securite), loisir:Math.round(v.loisir),
      logement:Math.round(v.logement), repas:Math.round(v.repas), entretien:Math.round(v.entretien),
      harmonie:Math.round(v.harmonie), moral:moralGlobal(),
    };
  }

  window.VieVillage = { assurerHabitant, etatVillage, tick, moralGlobal, finirRecette, resume, humeurPour };
})();
