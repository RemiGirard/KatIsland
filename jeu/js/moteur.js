/* ============================================================
   LE BOURG — js/moteur.js
   LE CŒUR IDLE. Il applique, seconde après seconde, les trois règles
   qui font tenir toute l'économie :

   1. UN POSTE NE TOURNE QUE S'IL A UN HABITANT. Le nombre de barres
      simultanées est exactement le nombre d'habitants affectés.
   2. LE CHANTIER EST UNIQUE ET IL A BESOIN DE BRAS. Une seule
      construction avance à la fois, et seulement si quelqu'un y est
      affecté. Bâtir, c'est renoncer à produire — c'est LE choix du jeu.
   3. LE BOURG MANGE. Chaque habitant consomme des vivres ; si la grange
      est vide, tout ralentit de moitié. On ne peut donc pas se contenter
      d'empiler des mineurs.
   -> window.Jeu
   ============================================================ */
"use strict";
(function () {

  const S = () => window.Etat.E;

  /* Combien de « portions » vaut une unité de chaque vivre. C'est ce qui
     décide de l'ordre où le bourg pioche dans la grange : on mange
     d'abord ce qui nourrit le moins, on garde les tourtes. */
  /* Toute ressource de catégorie « vivres » doit figurer ici, sinon le
     bourg refuse de la manger — elle s'entasse en pure perte et le
     joueur ne comprend pas pourquoi il a faim la grange pleine. Le
     tournesol, le fruit, la farine claire, la confiture et le cidre
     avaient été oubliés à mesure qu'on les ajoutait. */
  const PORTIONS = {
    poisson: 1, ble: 0.6, legume: 0.6, lait: 1, champignon: 1, miel: 2,
    champignon_lune: 5, champignon_azur: 10,
    farine: 1.5, viande: 2.5, pain: 3, fromage: 3.5, poissonfume: 3, tourte: 8,
    tournesol: 0.8, fruit: 1.2, farineclaire: 2, confiture: 4, cidre: 2.5,
  };
  const ORDRE_REPAS = Object.keys(PORTIONS).sort((a, b) => PORTIONS[a] - PORTIONS[b]);

  const BESOIN_PAR_HABITANT = 0.021;      // portions par seconde et par habitant

  /* =================================================================
     LES ACQUIS DU BOURG
     Recherches et améliorations d'atelier se résument à une poignée de
     nombres. On les agrège UNE FOIS et on garde le résultat : cette
     table est lue des dizaines de fois par seconde.
     ================================================================= */
  let acquisCache = null;
  function invaliderAcquis() { acquisCache = null; }
  function acquis() {
    if (acquisCache) return acquisCache;
    const E = S();
    const a = {
      global: 0, conso: 0, butin: 0, rendement: 0, stock: 0, moral: 0, xp: 0,
      immigration: 0, negoce: 0, menace: 0, defense: 0, defenseMult: 0,
      logementParMaison: 0, outilDuree: 0, expedition: 0, descente: 0,
      armement: 0, colonne: 0, posteNiveau: 0,
      garde: 0, gardien: 0, rite: 0, equipee: 0, gardienButin: 0, abyme: 0,
      metier: {}, rendementMetier: {},
    };
    for (const id in (E.recherches || {})) {
      const n = (window.RECHERCHES || []).find(x => x.id === id);
      if (!n || !E.recherches[id]) continue;
      const e = n.effet || {};
      for (const k in e) {
        if (k === 'metier' || k === 'rendementMetier') {
          for (const m in e[k]) a[k][m] = (a[k][m] || 0) + e[k][m];
        } else a[k] = (a[k] || 0) + e[k];
      }
    }
    /* LES SCEAUX DE LA CHARTE s'ajoutent aux recherches : ce sont des
       acquis d'une autre partie, mais ils comptent de la même façon. */
    if (window.Prestige) {
      const p = window.Prestige.perkEffets();
      a.global += p.global || 0;
      a.stock += p.stock || 0;
      a.colonne += p.colonne || 0;
      a.descente += p.descente || 0;
    }
    acquisCache = a;
    return a;
  }
  function aRecherche(id) { return !!(S().recherches || {})[id]; }

  /* Ce qu'apportent les améliorations d'un atelier précis. */
  function amelioDe(b, cle) {
    let v = raffDe(b, cle === 'oeil' ? 'butin' : cle);
    if (!b || !b.am) return v;
    const n = b.am[cle] || 0;
    if (!n) return v;
    const a = (window.AMELIO || []).find(x => x.id === cle);
    if (!a) return v;
    const e = a.effet(n);
    return v + (e[Object.keys(e)[0]] || 0);
  }
  /* Ce qu'apportent les ANNEXES bâties. Une annexe ne se contente pas
     d'ouvrir des recettes : l'abattoir rend mieux, le martinet frappe
     plus vite, la laverie trouve davantage. */
  function raffDe(b, cle) {
    if (!b || !b.raff || !window.RaffUtil) return 0;
    let v = 0;
    for (const id in b.raff) {
      if (!b.raff[id]) continue;
      const r = window.RaffUtil.trouver(b.type, id);
      if (r && r.effet[cle]) v += r.effet[cle];
    }
    return v;
  }
  /* Le nombre de postes RÉEL : le niveau, plus les établis achetés, plus
     ce qu'ouvre la recherche « lignes de fabrication ». */
  function postesEffectifs(b) {
    let n = window.BatUtil.postesDe(b.type, b.niv);
    if (n <= 0) return 0;
    n += (b.am && b.am.etabli) || 0;
    const pn = acquis().posteNiveau;
    if (pn && b.niv >= pn) n += 1;
    return n;
  }

  /* =================================================================
     MULTIPLICATEURS GLOBAUX
     ================================================================= */
  function moralEffectif() {
    const E = S();
    /* Le moral est désormais vécu PAR les habitants. La moyenne fournit
       le socle ; les bâtiments et événements gardent leur rôle global. */
    let m = window.VieVillage ? window.VieVillage.moralGlobal() : 50;
    for (const bid in E.bat) {
      const def = window.BAT[E.bat[bid].type];
      if (def && def.effet && def.effet.moral) m += def.effet.moral * (1 + 0.4 * (E.bat[bid].niv - 1));
    }
    m += (E.moralBonus || 0);
    m += acquis().moral;
    /* les caractères pèsent sur l'ambiance : un Avenant réchauffe, un
       Grognon refroidit — et cela se lit dans le bandeau. */
    /* Les traits individuels sont déjà versés dans leur cible personnelle
       par VieVillage. Sur une ancienne sauvegarde sans ce module, on garde
       le comportement historique. */
    if (!window.VieVillage) for (const h of E.habitants) m += window.HAB.somme(h, 'moral');
    if (E.famine) m -= 25;
    if (E.raidRecent > 0) m -= 12;
    return Math.max(0, Math.min(100, Math.round(m)));
  }
  function multGlobal() {
    const E = S();
    const mMoral = 0.86 + 0.0038 * moralEffectif();      // 0,86 à 1,24
    const mFaim = E.famine ? 0.45 : 1;
    /* LE MALAISE : ce que coûte un renvoi, ou un mort dans la tour. Il
       s'efface tout seul, mais le bourg travaille mal en attendant. */
    const mDeuil = window.Etat.facteurMalaise();
    /* LA MENACE PÈSE. Ce n'est plus une jauge qui attend cent pour
       frapper : dès qu'on est repéré, le bourg travaille moins bien —
       on double les guets, on rentre les bêtes, on ne s'éloigne plus.
       C'est ce qui donne une raison de SORTIR au lieu d'attendre. */
    return mMoral * mFaim * mDeuil * palierMenace().mult;
  }

  /* ------------------------------------------------------------------
     LES CINQ ÉTATS DU BOURG FACE À LA NUÉE.
     Des paliers, et non une pente continue : le joueur doit pouvoir
     dire « je suis à Pressé, une sortie me remet à Calme », et non
     lire une décimale qui glisse.
     ------------------------------------------------------------------ */
  const PALIERS_MENACE = [
    { max: 25,  id:'calme',    nom:'Calme',      mult:1.00,
      desc:"Personne ne regarde le bourg. On travaille sans lever la tête." },
    { max: 45,  id:'guette',   nom:'Guetté',     mult:0.93,
      desc:"On a vu passer des éclaireurs. Chacun garde un œil dehors." },
    { max: 68,  id:'presse',   nom:'Pressé',     mult:0.82,
      desc:"Les bêtes rentrent tôt, les chantiers s'arrêtent au crépuscule." },
    { max: 88,  id:'assiege',  nom:'Assiégé',    mult:0.68,
      desc:"On ne s'éloigne plus des murs. La moitié du bourg guette." },
    { max: 101, id:'abois',    nom:'Aux abois',  mult:0.55,
      desc:"Tout le monde est sur les remparts. Plus rien n'avance vraiment." },
  ];
  function palierMenace(m) {
    const v = m == null ? S().menace : m;
    for (const p of PALIERS_MENACE) if (v < p.max) return p;
    return PALIERS_MENACE[PALIERS_MENACE.length - 1];
  }
  function defenseTotale() {
    const E = S();
    let d = 4;
    for (const bid in E.bat) {
      const def = window.BAT[E.bat[bid].type];
      if (def && def.effet && def.effet.defense) d += def.effet.defense * (1 + 0.35 * (E.bat[bid].niv - 1)) * (1 + acquis().defenseMult);
    }
    d += E.armee.garnison * 3;
    d += acquis().defense;
    for (const h of E.habitants) d += window.HAB.somme(h, 'defense');
    return Math.round(d);
  }
  function bonusNegoce() {
    const E = S();
    let n = acquis().negoce;
    for (const bid in E.bat) {
      const def = window.BAT[E.bat[bid].type];
      if (def && def.effet && def.effet.negoce) n += def.effet.negoce * E.bat[bid].niv;
    }
    for (const h of E.habitants) if (h.aff) n += window.HAB.somme(h, 'negoce');
    return n;
  }

  /* =================================================================
     CE QUE VAUT UN HABITANT À CE POSTE-LÀ
     Son niveau, son métier de prédilection, son trait de caractère. Rien
     ici ne demande de surveillance : ces trois facteurs rendent
     simplement le CHOIX de l'affectation intéressant — et c'est le seul
     endroit du jeu où l'on décide qui fait quoi.
     ================================================================= */
  function facteurHabitant(h, rec, b) {
    if (!h) return 1;
    const H = window.HAB;
    let f = 1 + 0.025 * ((h.niv || 1) - 1);
    const pratique = window.Etat.progresMetierHabitant(h, rec.metier);
    f *= 1 + 0.025 * (pratique.niveau - 1);
    /* Le métier de prédilection est le SEUL à recevoir le bonus inné.
       Sa valeur suit toute l'échelle de rareté : un habitant commun a
       déjà un vrai métier, une Légende en a fait une signature. */
    if (h.talent === rec.metier) {
      const bonusTalent = { commun:1.08, estime:1.14, rare:1.22, insigne:1.31, legende:1.43 };
      f *= bonusTalent[h.rarete] || bonusTalent.commun;
    }
    const ctx = {
      metier: rec.metier, duree: rec.duree,
      jour: S().heure > 0.24 && S().heure < 0.78,
    };
    f *= H.produit(h, 'vitesse', ctx);

    /* LES AURAS. Un Meneur ne se pousse pas lui-même : il pousse les
       autres. Un Bavard, lui, ne gêne que ses voisins d'atelier. */
    const meneurs = window.Etat.compteTrait('meneur') - (H.a(h, 'meneur') ? 1 : 0);
    if (meneurs > 0) f *= 1 + 0.04 * meneurs;
    if (b && b.postes) {
      let g = 0;
      for (const q of b.postes) {
        if (!q.hab || q.hab === h.id) continue;
        const v = window.Etat.habitant(q.hab);
        if (v) g += H.somme(v, 'voisins');
      }
      if (g) f *= Math.max(0.4, 1 + g);
    }
    return f;
  }

  /* LA MAÎTRISE DE L'ATELIER. Le bâtiment apprend lui aussi en tournant :
     son expérience existait déjà dans les sauvegardes, mais ne racontait
     rien au joueur. Les paliers deviennent progressivement plus longs et
     restent sans plafond. Le bonus demeure volontairement mesuré : la
     maîtrise récompense une chaîne bien installée sans remplacer les
     habitants, l'outillage ou les améliorations concrètes. */
  function maitriseAtelier(b) {
    const xp = Math.max(0, Number(b && b.xp) || 0);
    const base = 35;
    const niveau = Math.max(1, Math.floor(Math.sqrt(xp / base)) + 1);
    const debut = base * Math.pow(niveau - 1, 2);
    const fin = base * Math.pow(niveau, 2);
    const pour = Math.max(1, fin - debut);
    const dans = Math.max(0, xp - debut);
    return {
      niveau, xp, debut, fin, dans, pour,
      pct: Math.max(0, Math.min(1, dans / pour)),
      bonus: Math.min(1.5, 0.012 * (niveau - 1)),
    };
  }

  /* Un outil est désormais attaché à une ACTIVITÉ, pas posé vaguement
     dans tout le bâtiment. Les anciennes sauvegardes qui possèdent
     `b.outil` continuent de fonctionner comme avant jusqu'à son usure. */
  function outilActif(b, rec) {
    if (!b) return null;
    if (rec && b.outilsRecette && b.outilsRecette[rec.id]) return b.outilsRecette[rec.id];
    return b.outil || null;
  }

  /* Au niveau 5, la scierie cesse d'être un simple hangar : le joueur
     choisit comment le contremaître organise la chaîne. */
  function organisationScierie(b, rec) {
    const neutre = { vitesse:1, rendement:0, butin:1 };
    if (!b || b.type !== 'scierie' || b.niv < 5 || !rec) return neutre;
    const mode = b.organisationScierie || 'equilibre';
    const transformation = ['sciage','tresser_osier','ecorce','poutres','secher_bois'].includes(rec.id);
    if (mode === 'debit') return { vitesse:rec.id === 'coupe_bois' ? 0.92 : (transformation ? 1.22 : 1), rendement:0, butin:1 };
    if (mode === 'futaie') return { vitesse:rec.id === 'coupe_bois' ? 1.05 : 1, rendement:0, butin:rec.id === 'coupe_bois' ? 1.55 : 1 };
    if (mode === 'zero') return { vitesse:transformation ? 0.92 : 1, rendement:transformation ? 0.18 : 0, butin:1 };
    return neutre;
  }

  /* Vitesse d'un poste, tous facteurs réunis. C'est la formule que le
     joueur cherche à faire grimper : niveau du bâtiment, rang du métier,
     l'habitant lui-même, l'outillage, le moral, l'état du bâtiment. */
  function vitessePoste(b, rec, hab) {
    let v = 1;
    const A = acquis();
    v *= 1 + 0.12 * (b.niv - 1);
    v *= 1 + maitriseAtelier(b).bonus;
    v *= organisationScierie(b, rec).vitesse;
    v *= 1 + 0.03 * (window.Etat.rangMetier(rec.metier) - 1);
    v *= facteurHabitant(hab, rec, b);
    v *= 1 + amelioDe(b, 'cadence');              // l'atelier, affûté
    v *= 1 + A.global;                            // les recherches du bourg
    v *= 1 + (A.metier[rec.metier] || 0);         // la branche du métier
    const outil = outilActif(b, rec);
    if (outil && outil.restant > 0) {
      const q = window.OutilUtil && window.OutilUtil.de(outil);
      v *= q ? q.mult : ((outil.type === 'outilacier') ? 1.9 : 1.4);
    }
    if (b.endommage > 0) v *= 0.4;
    /* Dans la scierie pilote, la présence, la vigueur, les relèves et la
       cadence choisie sont un seul facteur. Zéro signifie une vraie pause :
       le cycle conserve sa progression et ne consomme aucune matière. */
    if (window.VieVillage && window.VieVillage.disponibiliteTravail)
      v *= window.VieVillage.disponibiliteTravail(hab, b).facteur;
    /* LE TERRITOIRE. C'est le seul multiplicateur qui ne s'achète pas :
       il se prend par le portail d'expédition. */
    if (window.Expedition) v *= window.Expedition.bonusMetier(rec.metier);
    v *= multGlobal();
    return v;
  }
  function vitesseChantier() {
    const E = S();
    const n = E.chantier.ouvriers.length;
    if (n <= 0) return 0;
    let v = 1 + 0.85 * (n - 1);
    v *= 1 + 0.04 * (window.Etat.rangMetier('batisse') - 1);
    /* chaque ouvrier apporte SON niveau, et un Bâtisseur vaut un quart
       d'ouvrier de plus à lui seul. */
    for (const id of E.chantier.ouvriers) {
      const h = window.Etat.habitant(id);
      if (!h) continue;
      v *= 1 + 0.012 * ((h.niv || 1) - 1);
      v *= window.HAB.produit(h, 'chantier');
      if (h.talent === 'batisse') v *= 1.10;
    }
    v *= multGlobal();
    return v;
  }

  /* =================================================================
     LES VIVRES
     ================================================================= */
  /* Combien de portions le bourg consomme par seconde : chaque bouche
     compte pour elle-même — un Gourmand en vaut une et demie. */
  function besoinTotal() {
    const E = S();
    let n = 0;
    for (const h of E.habitants) n += window.HAB.produit(h, 'conso');
    return n * BESOIN_PAR_HABITANT;
  }
  function nourrir(dt) {
    const E = S();
    const besoin = besoinTotal() * dt;
    E.faim = (E.faim || 0) + besoin;
    let reste = E.faim;
    for (const id of ORDRE_REPAS) {
      if (reste <= 0) break;
      const dispo = window.Etat.qte(id);
      if (dispo <= 0) continue;
      const parUnite = PORTIONS[id];
      const voulu = Math.min(dispo, Math.floor(reste / parUnite));
      if (voulu > 0) { E.res[id] = dispo - voulu; reste -= voulu * parUnite; }
    }
    E.faim = reste;
    // au-delà d'une réserve d'un quart d'heure de retard, c'est la famine
    const seuil = besoinTotal() * 90;
    const avant = E.famine;
    E.famine = E.faim > Math.max(4, seuil);
    if (E.famine && !avant) window.Etat.journal('La grange est vide : le bourg travaille au ralenti.', 'alerte');
    if (!E.famine && avant) window.Etat.journal('Les vivres sont revenus. Le bourg reprend son rythme.', 'bien');
    if (!E.famine) E.faim = Math.min(E.faim, seuil);
  }

  /* =================================================================
     LES PORTES, PAS L'IMMIGRATION

     Personne ne s'installe plus tout seul. Un toit libre est une
     INVITATION que le joueur lance quand il le décide : il ouvre les
     portes, trois voyageurs se présentent, il en garde un. Le prix est
     en vivres, le choix est en caractères — c'est la seule façon de
     peupler le bourg, et la seule où l'on décide QUI vit là.

     La règle vit dans etat.js (ouvrirPortes / accueillir) ; il ne reste
     ici que la réserve de bouche, dont le carnet a encore besoin.
     ================================================================= */
  function reservePortions() {
    let p = 0;
    for (const id in PORTIONS) p += window.Etat.qte(id) * PORTIONS[id];
    return p;
  }

  /* =================================================================
     LA PRODUCTION
     ================================================================= */
  function tickPostes(dt) {
    const E = S();
    for (const bid in E.bat) {
      const b = E.bat[bid];
      if (b.endommage > 0) b.endommage = Math.max(0, b.endommage - dt);
      for (let i = 0; i < b.postes.length; i++) {
        const p = b.postes[i];
        if (!p.hab || !p.rec) { p.bloque = false; continue; }
        let rec = window.REC[p.rec];
        if (!rec) { p.rec = null; continue; }

        /* Début de cycle : on paie les entrées. Tant qu'on ne peut pas,
           le poste reste au repos et le dit — un poste bloqué qui ne
           s'annonce pas est la première cause d'abandon d'un jeu idle. */
        const hab = window.Etat.habitant(p.hab);
        if (window.VieVillage && window.VieVillage.disponibiliteTravail) {
          const presence = window.VieVillage.disponibiliteTravail(hab, b);
          if (!presence.actif) {
            p.pause = presence.raison;
            p.bloque = false;
            continue;
          }
        }
        if (window.EcosystemesBatiments && window.EcosystemesBatiments.peutDemarrer) {
          const local = window.EcosystemesBatiments.peutDemarrer(b, rec);
          if (!local.ok) {
            p.pause = local.raison || 'cycle naturel';
            p.bloque = false;
            continue;
          }
        }
        p.pause = null;
        if (p.prog <= 0) {
          /* L'ÉCONOME : un cycle sur huit, la matière ne part pas. On le
             décide à l'entrée du cycle, jamais à la sortie. */
          const saut = window.HAB.chance(hab, 'saut');
          const gratuit = saut > 0 && Math.random() < saut;
          if (!gratuit) {
            /* Soigneux et Brouillon changent ce que coûte un cycle. On
               arrondit par tirage, jamais par troncature : une recette
               qui ne demande qu'une unité doit voir la différence. */
            const kM = window.HAB.produit(hab, 'matiere');
            let cout = rec.in;
            if (kM !== 1) {
              cout = {};
              for (const k in rec.in) {
                const exact = rec.in[k] * kM;
                let q = Math.floor(exact);
                if (Math.random() < (exact - q)) q++;
                cout[k] = Math.max(rec.in[k] > 0 ? 1 : 0, q);
              }
            }
            if (!window.Etat.assez(cout)) { p.bloque = true; continue; }
            window.Etat.depenser(cout);
            if (cout !== rec.in) { rec = Object.create(rec); rec.in = cout; }
            /* L'ÉCONOMIE DE MATIÈRE agit en REMBOURSEMENT : on paie plein
               tarif, puis chaque unité a une chance d'être rendue. C'est
               exact en moyenne et ça marche même sur une recette qui ne
               demande qu'une seule unité. */
            const eco = Math.min(0.85, amelioDe(b, 'economie') + acquis().conso);
            if (eco > 0) for (const k in rec.in) {
              let rendu = 0;
              for (let z = 0; z < rec.in[k]; z++) if (Math.random() < eco) rendu++;
              if (rendu) window.Etat.gagner(k, rendu);
            }
          }
          p.bloque = false;
          p.prog = 0.0001;
        }
        p.prog += dt * vitessePoste(b, rec, hab);
        if (p.prog >= rec.duree) {
          p.prog = 0;
          p.cycles = (p.cycles || 0) + 1;
          /* LE DISTRAIT. Le cycle a été payé, il ne rendra rien. On le
             dit, sinon le joueur croit à une erreur de comptage. */
          const perte = window.HAB.chance(hab, 'perte');
          if (perte > 0 && Math.random() < perte)
            window.Etat.journal(hab.nom + ' a gâché un ouvrage au ' +
              window.BAT[b.type].nom.toLowerCase() + '.', 'info');
          else terminerCycle(b, p, rec, hab);
          /* LA FILE DU POSTE. Une tâche peut être lancée « en boucle »
             (reste = null) ou pour un nombre de cycles donné ; quand le
             compte tombe à zéro, la suivante prend le relais. C'est ce
             qui permet de programmer sa nuit au lieu de la surveiller. */
          if (p.reste != null) {
            p.reste--;
            if (p.reste <= 0) {
              const suite = (p.file || []).shift();
              if (suite) {
                p.rec = suite.rec; p.reste = suite.n == null ? null : suite.n;
                window.Etat.journal(window.BAT[b.type].nom + ' : ' + window.REC[suite.rec].nom + ' prend le relais.', 'info');
              } else if (window.Auto && window.Auto.actif('boucle')) {
                /* LA COMMANDE PERMANENTE : au lieu de laisser le poste
                   vide, la même tâche repart sans fin. */
                p.reste = null;
              } else {
                p.rec = null; p.reste = null;
                window.Etat.journal(window.BAT[b.type].nom + ' : la commande est terminée, le poste attend.', 'info');
                window.Etat.prevenir('posteLibre', { bat: b.id, i });
              }
            }
          }
        }
      }
    }
  }

  function terminerCycle(b, p, rec, hab) {
    const E = S();
    const A = acquis();
    /* LE RENDEMENT : une chance, par unité produite, d'en sortir une de
       plus. Là encore c'est une probabilité et non un arrondi — sinon
       les petites recettes ne verraient jamais l'amélioration. */
    const organisation = organisationScierie(b, rec);
    const rend = amelioDe(b, 'rendement') + A.rendement + (A.rendementMetier[rec.metier] || 0) + organisation.rendement;
    const sorties = {};
    for (const k in rec.out) {
      let n = rec.out[k];
      if (rend > 0) for (let z = 0; z < rec.out[k]; z++) if (Math.random() < rend) n++;
      sorties[k] = n;
    }
    if (window.EcosystemesBatiments && window.EcosystemesBatiments.modifierSorties)
      Object.assign(sorties, window.EcosystemesBatiments.modifierSorties(b, rec, sorties));
    const recu = window.Etat.gagnerLot(sorties);

    /* Table de butin : ce qui tombe EN PLUS, avec sa probabilité. C'est
       ce qui fait qu'on regarde encore une activité au bout d'une heure.
       Un Chanceux au poste la fait grimper de quarante pour cent. */
    /* Une lame synchronisée laisse aussi le temps de voir les beaux nœuds,
       la résine et les champignons avant qu'ils ne partent aux déchets.
       C'est un petit bonus de trouvailles, jamais une seconde production. */
    const rythmeButin = b.type === 'scierie'
      ? 1 + Math.max(0, (b.rythmeScierie || 0) - 65) * 0.006 : 1;
    const chance = window.HAB.produit(hab, 'butin')
                 * (1 + amelioDe(b, 'oeil') + A.butin)
                 * organisation.butin
                 * rythmeButin
                 * (1 + (window.Expedition ? window.Expedition.bonusButin() : 0) * 0.5);
    /* Deux sources qui se cumulent : le butin PROPRE à la recette — ce
       qu'on trouve en faisant précisément ce geste-là — et les
       TROUVAILLES DU MÉTIER, qui tombent quel que soit l'ouvrage et
       d'autant plus qu'il est long. La seconde table est ce qui relie
       la pêche du mardi à l'étage soixante de la tour. */
    const tables = rec.loot.concat(window.ButinUtil.tableDe(rec.metier, rec.duree, 1));
    for (const l of tables) {
      if (Math.random() < l.p * chance) {
        const n = l.n ? (l.n[0] + Math.floor(Math.random() * (l.n[1] - l.n[0] + 1))) : 1;
        const pris = window.Etat.gagner(l.res, n);
        if (pris > 0) {
          recu[l.res] = (recu[l.res] || 0) + pris;
          const r = window.RES[l.res];
          E.trouvailles = (E.trouvailles || 0) + 1;
          if (r && (r.cat === 'profond' || r.tier >= 2))
            window.Etat.journal('Trouvaille au ' + window.BAT[b.type].nom.toLowerCase() +
              ' : ' + pris + ' ' + r.nom.toLowerCase(), 'butin');
        }
      }
    }

    window.Etat.gagnerXp(rec.metier, rec.xp);
    b.xp = (b.xp || 0) + Math.round(rec.xp * 0.5);
    /* L'habitant apprend son métier : c'est SON expérience, elle le suit
       partout où on l'affecte ensuite. */
    if (hab) {
      hab.cycles = (hab.cycles || 0) + 1;
      window.Etat.gagnerXpHabitant(hab, Math.max(1, Math.round(rec.xp * 0.35)), rec.metier);
    }
    if (window.VieVillage) window.VieVillage.finirRecette(rec, hab);
    if (window.EcosystemesBatiments) window.EcosystemesBatiments.finirRecette(b, rec, hab);

    /* Effets particuliers : certaines recettes ne produisent pas une
       ressource mais un ÉTAT du bourg. */
    /* LES DEUX FILIÈRES DE POPULATION, et elles ne se croisent jamais.
       Le TRAVAILLEUR vient du dehors : une maison ouvre des places, les
       portes amènent des candidats, on choisit. Le SOLDAT naît ici : la
       nurserie rend des chatons — une ressource comme une autre, qui se
       stocke et se plafonne — et les formations avancées les dépensent.
       Un chaton ne tiendra jamais un poste. C'est ce qui rend la guerre
       chère : non pas en écus, mais en lait, en poisson et en temps de
       nurserie qu'on n'a pas mis ailleurs.

       `recrue` reste : la TAVERNE, elle, débauche un travailleur venu
       du dehors à coups de tournées. C'est cher, c'est immédiat, et
       cela ne passe pas par les portes. */
    if (rec.recrue) {
      if (E.habitants.length < window.Etat.logementTotal()) {
        const h = window.Etat.ajouterHabitant(window.Etat.attraitBourg() * 0.6);
        window.Etat.journal(h.nom + ' s\'installe au bourg.', 'bien');
      } else {
        window.Etat.journal('Pas de toit libre : il faudra bâtir avant d\'accueillir.', 'alerte');
      }
    }
    if (rec.unite) {
      const type = rec.uniteType || 'lancier';
      if (window.Armee) window.Armee.ajouter(type, rec.unite);
      else E.armee.unites += rec.unite;
      window.Etat.journal((window.Armee ? window.Armee.nom(type) : 'Une recrue') +
        ' rejoint la compagnie (' + E.armee.unites + ').', 'guerre');
    }
    if (rec.xpArmee) {
      if (window.Armee) window.Armee.gagnerXp(window.Armee.colonne(), rec.xpArmee);
      else E.armee.xp += rec.xpArmee;
    }
    if (rec.xpBourg) for (const m in E.metiers) window.Etat.gagnerXp(m, Math.round(rec.xpBourg / 6));
    if (rec.menace) E.menace = Math.max(0, E.menace + rec.menace);
    if (rec.moral) E.moralBonus = Math.min(30, (E.moralBonus || 0) + rec.moral * 0.1);

    /* L'outil s'use. C'est un puits à ressources volontaire : la forge
       doit tourner en permanence pour que le reste du bourg avance. */
    const outil = outilActif(b, rec);
    if (outil && outil.restant > 0) {
      /* Bricoleur et Casseur : l'outillage tient, ou ne tient pas. */
      const u = window.HAB.produit(hab, 'usure');
      outil.restant -= (u >= 1) ? (1 + (Math.random() < (u - 1) ? 1 : 0))
                                : (Math.random() < u ? 1 : 0);
      if (outil.restant < 0) outil.restant = 0;
      if (outil.restant <= 0) {
        window.Etat.journal('L\'outillage de « ' + rec.nom + ' » est hors d\'usage.', 'alerte');
        if (b.outilsRecette && b.outilsRecette[rec.id] === outil) delete b.outilsRecette[rec.id];
        else if (b.outil === outil) b.outil = null;
      }
    }
    /* Ce qui vient d'être produit MONTE au-dessus de l'atelier. C'est le
       seul lien direct entre le tableau des réserves et le décor : on
       voit le poisson sortir de la pêcherie. */
    if (window.Village && window.Icones) {
      let principal = null, q = 0;
      for (const id in recu) if (recu[id] > q) { principal = id; q = recu[id]; }
      if (principal && window.RES[principal])
        window.Village.gain(b.id, window.Icones.canvas(window.RES[principal].ico, 12), q);
    }
    window.Etat.prevenir('cycle', { bat: b.id, rec: rec.id, recu });
  }

  /* =================================================================
     LE CHANTIER — file unique, un ouvrage à la fois
     ================================================================= */
  function tickChantier(dt) {
    const E = S();
    const f = E.chantier.file;
    if (!f.length) {
      E.chantier.prog = 0;
      /* Une file terminée ne doit pas garder des habitants dans un faux
         emploi. Ils reviennent automatiquement disponibles et le tableau
         d'affectation peut les envoyer à la production suivante. */
      if (E.chantier.ouvriers.length) {
        const retour = E.chantier.ouvriers.slice();
        for (const hid of retour) window.Etat.libererHabitant(hid);
        window.Etat.journal((retour.length > 1 ? 'Les ouvriers quittent' : 'L\'ouvrier quitte') +
                            ' le chantier achevé.', 'chantier');
      }
      return;
    }
    const v = vitesseChantier();
    if (v <= 0) return;                       // personne aux outils : rien n'avance
    const job = f[0];
    E.chantier.prog += dt * v;
    window.Etat.gagnerXp('batisse', dt * v * 0.9);
    if (E.chantier.prog >= job.temps) {
      for (const hid of E.chantier.ouvriers) {
        const h = window.Etat.habitant(hid);
        if (h) window.Etat.gagnerXpHabitant(h, Math.max(1, Math.round(job.temps * 0.05)), 'batisse');
      }
      E.chantier.prog = 0;
      f.shift();
      acheverOuvrage(job);
    }
  }

  function acheverOuvrage(job) {
    const E = S();
    if (job.k === 'construire') {
      const b = window.Etat.creerBatiment(job.type, job.bat);
      if (window.Village) {
        window.Village.retirer(job.bat);
        const pose = window.Village.poser(job.type, Math.round(job.xr * window.Village.dimensions().W),
                                          job.r, job.bat, 1, job.coul, job.L || 0);
        if (!pose) {
          // la parcelle a disparu : on repose où l'on peut
          window.Village.poser(job.type, null, job.r, job.bat, 1, job.coul, job.L || 0);
        }
        window.Village.ping(job.bat, '#e8d6a8');
        window.Village.souffle(job.bat);
      }
      window.Etat.journal(window.BAT[job.type].nom + ' : chantier terminé.', 'bien');
      window.Etat.prevenir('construit', b);
    } else if (job.k === 'ameliorer') {
      const b = E.bat[job.bat];
      if (b) {
        b.niv++;
        window.Etat.majPostes(b);
        window.Etat.invaliderCap();
        window.Etat.journal(window.BAT[b.type].nom + ' passe au niveau ' + b.niv + '.', 'bien');
        if (window.Village) window.Village.ping(b.id, '#a8d8c0');
        window.Etat.prevenir('ameliore', b);
      }
    } else if (job.k === 'raffiner') {
      const b = E.bat[job.bat];
      if (b) {
        if (!b.raff) b.raff = {};
        b.raff[job.raff] = true;
        const r = window.RaffUtil && window.RaffUtil.trouver(b.type, job.raff);
        window.Etat.journal(window.BAT[b.type].nom + ' : ' +
          ((r && r.nom) || job.raff) + ' — l\'atelier a changé de forme.', 'bien');
        /* La scierie transmet immédiatement ses corps d'annexe au décor.
           Les autres bâtiments gardent leur signal visuel historique en
           attendant leur propre passe d'écosystème. */
        if (window.Village && b.type === 'scierie' && window.Village.configurerScierie)
          window.Village.configurerScierie(b.id, b.niv, b.raff);
        else if (window.Village) window.Village.ping(b.id, '#e8c88a');
        window.Etat.prevenir('raffine', b);
      }
    } else if (job.k === 'reparer') {
      const b = E.bat[job.bat];
      if (b) { b.endommage = 0; window.Etat.journal(window.BAT[b.type].nom + ' est réparé.', 'bien'); }
    }
    window.Etat.prevenir('chantier', null);
  }

  /* =================================================================
     LA MENACE ET LES RAIDS
     Elle monte toute seule, plus vite à mesure que le bourg grossit et
     que l'expédition prend du territoire. Quand elle déborde, une
     colonne arrive : ce que la défense n'arrête pas, elle le casse.
     ================================================================= */
  function nbBatiments() { const E = S(); let n = 0; for (const bid in E.bat) n++; return n; }
  function tauxMenace() {
    const E = S();
    const n = nbBatiments();
    /* La Nuée observe dès le premier feu, très lentement d'abord. La
       jauge enseigne ainsi sa règle dès le départ, puis la croissance
       du bourg et les territoires la rendent plus pressante. */
    let t = 0.0035 + 0.00145 * Math.max(0, n - 1) + 0.007 * window.Etat.nbConquetes();
    for (const bid in E.bat) {
      if (E.bat[bid].type === 'tour') t *= (1 - Math.min(0.45, 0.10 * E.bat[bid].niv));
    }
    if (window.Expedition) t *= window.Expedition.facteurMenace();
    t *= Math.max(0.15, 1 - acquis().menace);
    return t;
  }
  /* =================================================================
     LA SORTIE

     Attendre les cent points, c'est subir le raid. Sortir, c'est aller
     au-devant de la colonne : on choisit son moment, on garde ses murs
     intacts, et la menace retombe pour de bon. C'est cher en bras, et
     c'est précisément la question — faut-il des pêcheurs ou des lances ?
     ================================================================= */
  function sortiePossible() {
    const E = S();
    if (E.menace < 22) return { ok: false, pourquoi: 'Rien à combattre : la Nuée ne s\'est pas encore montrée.' };
    if (E.expedition) return { ok: false, pourquoi: 'Une colonne est déjà en campagne.' };
    if (E.armee.unites < 1) return { ok: false, pourquoi: 'Aucune unité formée. Levez d\'abord une recrue à la caserne.' };
    return { ok: true };
  }
  /* Ce que la sortie retirera si elle réussit : d'autant plus que la
     menace est haute — on ne fait pas une sortie pour trois points. */
  function gainSortie() {
    const E = S();
    return Math.round(Math.min(E.menace, 30 + E.menace * 0.45));
  }
  function forceSortie() {
    const E = S();
    /* la colonne d'en face est proportionnée à la jauge : à 30, c'est
       une escarmouche ; à 95, c'est ce qui allait tomber sur le bourg. */
    return 0.35 + (E.menace / 100) * 1.15;
  }

  function tickMenace(dt) {
    const E = S();
    E.menace += dt * tauxMenace();
    if (E.raidRecent > 0) E.raidRecent = Math.max(0, E.raidRecent - dt);
    if (E.menace >= 100) declencherRaid();
  }
  function declencherRaid() {
    const E = S();
    const force = 14 + 5 * nbBatiments() + window.Etat.nbConquetes() * 14 + E.raids * 6;
    const def = defenseTotale();
    const premier = E.raids === 0;
    E.menace = 22;
    E.raids++;
    E.raidRecent = 90;
    /* LA PREMIÈRE FOIS, C'EST UNE RECONNAISSANCE. Elle vide un quart de
       la grange et repart : le joueur apprend que la jauge veut dire
       quelque chose, sans perdre les deux bâtiments qu'il possède. */
    if (premier) {
      const vol = {};
      for (const id of ORDRE_REPAS) {
        const q = window.Etat.qte(id);
        if (q > 0) { const n = Math.ceil(q * 0.25); E.res[id] = q - n; vol[id] = n; }
      }
      window.Etat.journal('Une reconnaissance de la Nuée a emporté un quart de la grange. La prochaine viendra en nombre.', 'alerte');
      window.Etat.prevenir('raid', { repousse: false, force, def, touches: [], vol, reconnaissance: true });
      return;
    }
    if (def >= force) {
      E.raidsRepousses = (E.raidsRepousses || 0) + 1;
      window.Etat.journal('Un raid a été repoussé aux remparts. Aucun dégât.', 'guerre');
      window.Etat.gagner('medaille', 1);
      window.Etat.prevenir('raid', { repousse: true, force, def });
      return;
    }
    const degats = Math.min(4, 1 + Math.floor((force - def) / 30));
    const ids = Object.keys(E.bat).filter(id => window.BAT[E.bat[id].type].cat !== 'porte');
    const touches = [];
    for (let k = 0; k < degats && ids.length; k++) {
      const id = ids.splice((Math.random() * ids.length) | 0, 1)[0];
      E.bat[id].endommage = 240 + Math.random() * 300;
      touches.push(window.BAT[E.bat[id].type].nom);
      if (window.Village) window.Village.souffle(id);
    }
    // et l'on emporte des vivres
    const vol = {};
    for (const id of ORDRE_REPAS) {
      const q = window.Etat.qte(id);
      if (q > 0) { const n = Math.ceil(q * 0.25); E.res[id] = q - n; vol[id] = n; }
    }
    window.Etat.journal('RAID. ' + touches.join(', ') + ' — endommagé' + (touches.length > 1 ? 's' : '') + ', et la grange pillée.', 'alerte');
    window.Etat.prevenir('raid', { repousse: false, force, def, touches, vol });
  }

  /* =================================================================
     LE TICK
     ================================================================= */
  let accumule = 0, accCarnet = 0;
  function tick(dt) {
    const E = S();
    dt = Math.min(dt, 0.5);
    E.tJeu += dt;
    E.heure = (E.heure + dt * (E.options.vitesseJour || 1 / 260)) % 1;
    const jour = Math.floor(E.tJeu / 260);
    if (jour > E.jours) { E.jours = jour; window.Etat.prevenir('jour', jour); }
    nourrir(dt);
    window.Etat.tickMalaise(dt);
    if (window.VieVillage) window.VieVillage.tick(dt);
    if (window.Auto) window.Auto.tick(dt);
    if (window.Marche) window.Marche.tickFlux(dt);
    if (window.Prestige) window.Prestige.tick(dt);
    /* LA MER. Les navires traversent, mouillent, rentrent — même
       quand le joueur regarde ailleurs. */
    if (window.Port) window.Port.tick(dt);
    tickPostes(dt);
    tickChantier(dt);
    if (window.Armee) window.Armee.avancerForge(dt);
    tickMenace(dt);
    E.moral = moralEffectif();
    if (E.moralBonus > 0) E.moralBonus = Math.max(0, E.moralBonus - dt * 0.02);
    /* Une pénalité négative était effacée dès le tick suivant par
       Math.max(0, ...). Elle remonte désormais lentement vers zéro :
       refuser ou chasser quelqu'un marque réellement plusieurs heures. */
    else if (E.moralBonus < 0) E.moralBonus = Math.min(0, E.moralBonus + dt * 0.001);
    /* LE CARNET SE MET À JOUR TOUT SEUL. Beaucoup de déblocages tiennent
       à une RESSOURCE vue pour la première fois, pas à un bâtiment posé :
       s'en remettre aux seuls événements de construction laissait des
       plans dormir indéfiniment. */
    accCarnet += dt;
    if (accCarnet > 2) { accCarnet = 0; majDecouvertes(); }
    accumule += dt;
    if (accumule > 5) { accumule = 0; window.Etat.sauver(); }
  }

  /* Rattrapage hors-ligne. On simule vraiment, mais à gros pas : le
     joueur qui revient doit retrouver un bourg qui a travaillé, pas un
     bourg figé — ni un bourg qui a tout produit magiquement. */
  function rattraper(secondes) {
    const cap = Math.min(secondes, 12 * 3600);
    if (cap < 20) return 0;
    const pas = Math.max(1, cap / 2500);
    const E = S();
    /* On photographie AVANT, on simule, on compare : le rapport doit dire
       ce qui est entré, ce qui a débordé, ce qui s'est bloqué et ce qui
       s'est terminé — sinon le joueur revient sans savoir quoi corriger. */
    const avant = {};
    for (const id in E.res) avant[id] = E.res[id];
    const gaspAvant = {};
    for (const id in E.gaspille) gaspAvant[id] = E.gaspille[id];
    const habAvant = E.habitants.length;
    const raidsAvant = E.raids;
    const filesAvant = E.chantier.file.length;
    const nivAvant = {};
    for (const bid in E.bat) nivAvant[bid] = E.bat[bid].niv;

    for (let t = 0; t < cap; t += pas) tick(pas);

    const gains = {}, perdu = {};
    for (const id in S().res) { const d = S().res[id] - (avant[id] || 0); if (d > 0) gains[id] = d; }
    for (const id in S().gaspille) { const d = S().gaspille[id] - (gaspAvant[id] || 0); if (d > 0) perdu[id] = d; }
    const bloques = [];
    for (const bid in S().bat) {
      const b = S().bat[bid];
      for (const p of b.postes)
        if (p.hab && p.rec && p.bloque)
          bloques.push({ bat: window.BAT[b.type].nom, rec: window.REC[p.rec].nom,
                         manque: window.Etat.manque(window.REC[p.rec].in) });
    }
    const acheves = [];
    for (const bid in S().bat)
      if (nivAvant[bid] == null) acheves.push(window.BAT[S().bat[bid].type].nom);
      else if (S().bat[bid].niv > nivAvant[bid]) acheves.push(window.BAT[S().bat[bid].type].nom + ' niveau ' + S().bat[bid].niv);
    return {
      duree: cap, gains, perdu, bloques, acheves,
      habitants: S().habitants.length - habAvant,
      raids: S().raids - raidsAvant,
      resteFile: S().chantier.file.length,
      fileAvant: filesAvant,
      famine: S().famine,
      menace: S().menace,
    };
  }

  /* =================================================================
     ACTIONS DU JOUEUR
     ================================================================= */
  function debloque(type) {
    const E = S();
    const d = window.BAT[type] && window.BAT[type].deblocage;
    if (d === undefined) return false;
    if (d === null) return true;
    if (d.bat) for (const b in d.bat) if (window.Etat.nivDeType(b) < d.bat[b]) return false;
    if (d.res) for (const r in d.res) if (!E.vus['res:' + r] && window.Etat.qte(r) < d.res[r]) return false;
    return true;
  }
  /* Une fois découvert, un bâtiment reste au carnet même si l'on
     redescend sous le seuil : on ne cache pas ce qu'on a déjà montré. */
  function majDecouvertes() {
    const E = S();
    for (const type in window.BAT) {
      if (E.vus['carnet:' + type]) continue;
      if (debloque(type)) {
        E.vus['carnet:' + type] = true;
        if (window.BAT[type].apparait) { faireApparaitre(type); continue; }
        if (E.tJeu > 3) {
          window.Etat.journal('Le maître d\'œuvre sait désormais bâtir : ' + window.BAT[type].nom + '.', 'plan');
          window.Etat.prevenir('deblocage', type);
        }
      }
    }
  }

  /* ------------------------------------------------------------------
     CE QUI NE SE BÂTIT PAS, ET QUI ARRIVE QUAND MÊME.

     Le Puits sans fond n'est l'ouvrage de personne : il était là avant
     le bourg. Le jour où l'on sait forger de quoi y descendre, on le
     voit — il s'ouvre dans le village, sans chantier, sans matériaux, et
     le joueur le trouve DANS le décor plutôt que dans un menu.
     ------------------------------------------------------------------ */
  function faireApparaitre(type) {
    const E = S();
    if (!window.Village) return null;
    /* Un lieu ancien appartient à l'île, pas au chantier. Si une vieille
       sauvegarde connaît le lieu sans l'avoir dans son plan, on restaure
       seulement sa représentation dans le village. */
    const existant = Object.keys(E.bat).map(id => E.bat[id]).find(b => b.type === type);
    if (existant) {
      if (!window.Village.batiment(existant.id)) {
        const retrouve = window.Village.poser(type, null, null, existant.id, existant.niv || 1);
        if (retrouve) E.plan = window.Village.plan();
      }
      return existant;
    }
    const pose = window.Village.poser(type);
    if (!pose) return null;
    const b = window.Etat.creerBatiment(type, pose.id);
    E.plan = window.Village.plan();
    window.Village.ping(pose.id, '#e0625c');
    window.Etat.journal('Le sol s\'ouvre à l\'écart du bourg : ' + window.BAT[type].nom +
                        '. On n\'a jamais su qui l\'avait creusé.', 'plan');
    window.Etat.prevenir('apparition', { type, id: pose.id });
    window.Etat.prevenir('construit', b);
    return b;
  }
  function catalogue() {
    const E = S();
    /* Les lieux apparus dans le décor ne sont jamais des plans à poser. */
    return window.BAT_ORDRE.filter(t => E.vus['carnet:' + t] && !window.BAT[t].apparait);
  }

  function coutConstruction(type) { return window.BatUtil.coutNiveau(type, 1); }

  /* Poser un bâtiment : on paie, on plante immédiatement un CHANTIER
     dans le village (échafaudages, roue de levage), et l'on met l'ouvrage
     dans la file. Le joueur voit donc tout de suite où ça se passe. */
  function poserBatiment(type, vx, r, opts) {
    const E = S();
    if (!debloque(type)) return { ok: false, raison: 'Ce bâtiment n\'est pas encore au carnet.' };
    const cout = coutConstruction(type);
    if (!window.Etat.assez(cout)) return { ok: false, raison: 'Matériaux insuffisants.', manque: window.Etat.manque(cout) };
    if (!window.Village) return { ok: false, raison: 'Le village n\'est pas prêt.' };
    /* la parcelle est cherchée à l'emprise du bâtiment FINI : l'échafaudage
       garde exactement la place qu'il faudra. */
    const b = window.Village.poserChantier(type, vx, r, null,
                                           opts && opts.coul, opts && opts.niveau);
    if (!b) {
      /* Dire LAQUELLE des deux règles a refusé : la Pêcherie et le Port
         veulent la rive, et une place d'intérieur parfaitement vide les
         refuse quand même. */
      const rive = window.Village.bordEau && window.Village.bordEau(type);
      return { ok: false, raison: rive
        ? 'Ce bâtiment se pose au bord de l\'eau : il lui faut une parcelle qui touche la mer.'
        : 'Pas de parcelle libre à cet endroit.' };
    }
    window.Etat.depenser(cout);
    E.chantier.file.push({
      k: 'construire', type, bat: b.id, r: b.r, xr: b.xr, L: b.L || 0,
      coul: opts && opts.coul != null ? opts.coul : null,
      temps: window.BatUtil.tempsNiveau(type, 1), cout,
      nom: window.BAT[type].nom,
    });
    window.Etat.journal(window.BAT[type].nom + ' : chantier ouvert.', 'chantier');
    /* LA PREMIÈRE FOIS SEULEMENT, on met quelqu'un aux outils et on le
       dit. C'est la règle la plus importante du jeu — un chantier sans
       ouvrier n'avance pas — et elle s'apprend mieux en la voyant
       s'appliquer qu'en la lisant dans un panneau. */
    if (!E.vus.premierChantier) {
      E.vus.premierChantier = true;
      const libre = window.Etat.habitantsLibres()[0];
      if (libre && !E.chantier.ouvriers.length) {
        window.Etat.affecterChantier(libre.id);
        window.Etat.journal(libre.nom + ' se met au chantier. Tant qu\'il y reste, il ne produit rien ailleurs.', 'chantier');
      }
    }
    window.Etat.prevenir('chantier', null);
    return { ok: true, id: b.id };
  }

  function ameliorer(bid) {
    const E = S();
    const b = E.bat[bid];
    if (!b) return { ok: false, raison: 'Bâtiment inconnu.' };
    if (b.niv >= (window.BAT[b.type].nivMax || 10)) return { ok: false, raison: 'Niveau maximal atteint.' };
    if (E.chantier.file.some(j => j.bat === bid)) return { ok: false, raison: 'Déjà dans la file du chantier.' };
    const cout = window.BatUtil.coutNiveau(b.type, b.niv + 1);
    if (!window.Etat.assez(cout)) return { ok: false, raison: 'Matériaux insuffisants.', manque: window.Etat.manque(cout) };
    window.Etat.depenser(cout);
    E.chantier.file.push({
      k: 'ameliorer', bat: bid, type: b.type, niv: b.niv + 1, cout,
      temps: window.BatUtil.tempsNiveau(b.type, b.niv + 1),
      nom: window.BAT[b.type].nom + ' — niveau ' + (b.niv + 1),
    });
    window.Etat.prevenir('chantier', null);
    return { ok: true };
  }

  /* Bâtir une annexe. C'est un ouvrage comme un autre : il passe par
     la file du chantier, il coûte, il prend du temps. La différence est
     qu'à l'arrivée le bâtiment n'a pas grandi — il a changé de nature. */
  function raffiner(bid, rid) {
    const E = S();
    const b = E.bat[bid];
    if (!b) return { ok: false, raison: 'Bâtiment inconnu.' };
    if (!window.RaffUtil) return { ok: false, raison: 'Aucune annexe connue.' };
    const r = window.RaffUtil.trouver(b.type, rid);
    if (!r) return { ok: false, raison: 'Annexe inconnue ici.' };
    if (b.niv < (r.niv || 1)) return { ok:false, raison:'Niveau ' + r.niv + ' requis.' };
    if (b.raff && b.raff[rid]) return { ok: false, raison: 'Déjà bâtie.' };
    if (E.chantier.file.some(j => j.k === 'raffiner' && j.bat === bid && j.raff === rid))
      return { ok: false, raison: 'Déjà dans la file du chantier.' };
    const cout = window.RaffUtil.coutDe(b.type, rid, b.niv);
    if (!window.Etat.assez(cout)) return { ok: false, raison: 'Matériaux insuffisants.', manque: window.Etat.manque(cout) };
    window.Etat.depenser(cout);
    E.chantier.file.push({
      k: 'raffiner', bat: bid, type: b.type, raff: rid, cout,
      temps: window.RaffUtil.tempsDe(b.type, rid, b.niv),
      nom: window.BAT[b.type].nom + ' — ' + r.nom,
    });
    window.Etat.prevenir('chantier', null);
    return { ok: true };
  }

  function reparer(bid) {
    const E = S();
    const b = E.bat[bid];
    if (!b || b.endommage <= 0) return { ok: false, raison: 'Rien à réparer.' };
    if (E.chantier.file.some(j => j.bat === bid && j.k === 'reparer')) return { ok: false, raison: 'Déjà en file.' };
    const cout = {}; const base = window.BatUtil.coutNiveau(b.type, b.niv);
    for (const rr in base) cout[rr] = Math.max(1, Math.round(base[rr] * 0.3));
    if (!window.Etat.assez(cout)) return { ok: false, raison: 'Matériaux insuffisants.', manque: window.Etat.manque(cout) };
    window.Etat.depenser(cout);
    E.chantier.file.push({ k: 'reparer', bat: bid, type: b.type, cout,
      temps: Math.round(window.BatUtil.tempsNiveau(b.type, b.niv) * 0.35),
      nom: 'Réparer ' + window.BAT[b.type].nom });
    window.Etat.prevenir('chantier', null);
    return { ok: true };
  }

  function annulerOuvrage(i) {
    const E = S();
    const job = E.chantier.file[i];
    if (!job) return false;
    if (i === 0 && E.chantier.prog > 0) E.chantier.prog = 0;
    // on rend la matière : le chantier n'a rien consommé de définitif
    for (const rr in (job.cout || {})) window.Etat.gagner(rr, job.cout[rr]);
    if (job.k === 'construire' && window.Village) window.Village.retirer(job.bat);
    E.chantier.file.splice(i, 1);
    window.Etat.prevenir('chantier', null);
    return true;
  }
  function deplacerOuvrage(i, d) {
    const E = S();
    const j = i + d;
    if (i < 0 || j < 0 || i >= E.chantier.file.length || j >= E.chantier.file.length) return false;
    if (i === 0 || j === 0) E.chantier.prog = 0;   // changer de tête, c'est repartir de zéro
    const t = E.chantier.file[i];
    E.chantier.file[i] = E.chantier.file[j];
    E.chantier.file[j] = t;
    window.Etat.prevenir('chantier', null);
    return true;
  }

  /* ---------------- postes ---------------- */
  function definirRecette(bid, i, recId, n) {
    const b = S().bat[bid]; if (!b || !b.postes[i]) return false;
    if (recId && !window.REC[recId]) return false;
    if (recId && window.REC[recId].niv > b.niv) return false;
    const p = b.postes[i];
    p.rec = recId || null;
    p.reste = (n == null || n <= 0) ? null : n;
    p.prog = 0;
    p.bloque = false;
    window.Etat.prevenir('poste', { bat: bid, i });
    return true;
  }
  /* Mettre une tâche À LA SUITE plutôt qu'à la place. */
  function ajouterFile(bid, i, recId, n) {
    const b = S().bat[bid]; if (!b || !b.postes[i] || !window.REC[recId]) return false;
    if (window.REC[recId].niv > b.niv) return false;
    const p = b.postes[i];
    if (!p.file) p.file = [];
    if (!p.rec) return definirRecette(bid, i, recId, n);
    if (p.file.length >= 8) return false;
    p.file.push({ rec: recId, n: (n == null || n <= 0) ? null : n });
    window.Etat.prevenir('poste', { bat: bid, i });
    return true;
  }
  function retirerFile(bid, i, k) {
    const b = S().bat[bid]; if (!b || !b.postes[i]) return false;
    (b.postes[i].file || []).splice(k, 1);
    window.Etat.prevenir('poste', { bat: bid, i });
    return true;
  }
  function deplacerFile(bid, i, k, d) {
    const b = S().bat[bid]; if (!b || !b.postes[i]) return false;
    const f = b.postes[i].file || [];
    const j = k + d;
    if (k < 0 || j < 0 || k >= f.length || j >= f.length) return false;
    const t = f[k]; f[k] = f[j]; f[j] = t;
    window.Etat.prevenir('poste', { bat: bid, i });
    return true;
  }
  /* Combien de cycles la matière en réserve permet-elle ? Sert à proposer
     « faire tout ce qu'on peut » sans compter à la main. */
  function cyclesPossibles(recId) {
    const rec = window.REC[recId];
    if (!rec) return 0;
    let n = Infinity;
    for (const k in rec.in) n = Math.min(n, Math.floor(window.Etat.qte(k) / rec.in[k]));
    return n === Infinity ? 0 : Math.max(0, n);
  }
  /* Qui conviendrait le mieux à ce poste ? On classe les habitants libres
     par ce qu'ils rendraient RÉELLEMENT ici — talent, niveau, trait — et
     l'on renvoie la liste, pas seulement le meilleur : le joueur peut
     vouloir garder son Meneur pour ailleurs. */
  function candidatsPoste(bid, i) {
    const b = S().bat[bid];
    if (!b || !b.postes[i]) return [];
    const rec = b.postes[i].rec ? window.REC[b.postes[i].rec] : null;
    const l = window.Etat.habitantsLibres().slice();
    if (!rec) return l.map(h => ({ h, note: 1 }));
    return l.map(h => ({ h, note: facteurHabitant(h, rec) }))
            .sort((a, z) => z.note - a.note);
  }
  function assignerAuto(bid, i) {
    const c = candidatsPoste(bid, i);
    if (!c.length) return { ok: false, raison: 'Aucun habitant disponible.' };
    window.Etat.affecterPoste(c[0].h.id, bid, i);
    return { ok: true, hab: c[0].h };
  }
  function assigner(bid, i, habId) {
    if (!window.Etat.habitant(habId)) return { ok: false, raison: 'Habitant inconnu.' };
    window.Etat.affecterPoste(habId, bid, i);
    return { ok: true };
  }
  function outiller(bid, typeOutil, recId) {
    const b = S().bat[bid]; if (!b) return { ok: false };
    if (recId && !window.REC[recId]) return { ok:false, raison:'Activité inconnue.' };
    const q = window.OutilUtil && window.OutilUtil.de({ type:typeOutil, qualite:typeOutil });
    let ressource = typeOutil;
    /* Le fer ancien (`outil`) et le fer détaillé (`outilfer`) cohabitent :
       une sauvegarde ne perd donc jamais son stock historique. */
    if (q) {
      if (window.Etat.qte(q.res) > 0) ressource = q.res;
      else if (q.legacy && window.Etat.qte(q.legacy) > 0) ressource = q.legacy;
      else ressource = q.res;
    }
    const cout = {}; cout[ressource] = 1;
    if (!window.Etat.assez(cout)) return { ok: false, raison: 'Aucun outillage disponible.' };
    window.Etat.depenser(cout);
    const base = q ? q.cycles : (typeOutil === 'outilacier' ? 520 : 190);
    const outil = { type:ressource, qualite:q ? q.id : typeOutil,
      restant:Math.round(base * (1 + acquis().outilDuree)), maximum:Math.round(base * (1 + acquis().outilDuree)) };
    if (recId) {
      if (!b.outilsRecette) b.outilsRecette = {};
      b.outilsRecette[recId] = outil;
    } else b.outil = outil;
    window.Etat.prevenir('poste', { bat: bid });
    return { ok: true };
  }

  /* =================================================================
     ACHATS : améliorations d'atelier et recherches du bourg
     ================================================================= */
  function acheterAmelio(bid, amId) {
    const E = S();
    const b = E.bat[bid];
    const a = (window.AMELIO || []).find(x => x.id === amId);
    if (!b || !a) return { ok: false, raison: 'Amélioration inconnue.' };
    if (!b.am) b.am = {};
    const rang = b.am[amId] || 0;
    if (rang >= a.max) return { ok: false, raison: 'Dernier cran atteint.' };
    const cout = window.AmelioUtil.coutAmelio(b.type, amId, rang);
    if (!window.Etat.assez(cout)) return { ok: false, raison: 'Il manque de quoi payer.', manque: window.Etat.manque(cout) };
    window.Etat.depenser(cout);
    b.am[amId] = rang + 1;
    if (amId === 'etabli') window.Etat.majPostes(b);
    invaliderAcquis();
    window.Etat.journal(window.BAT[b.type].nom + ' : ' + a.nom + ' au cran ' + (rang + 1) + '.', 'bien');
    window.Etat.prevenir('amelio', { bat: bid, am: amId });
    return { ok: true };
  }

  function rechercheOuverte(id) {
    const n = (window.RECHERCHES || []).find(x => x.id === id);
    if (!n) return false;
    for (const r of n.req) if (!aRecherche(r)) return false;
    return true;
  }
  function acheterRecherche(id) {
    const E = S();
    const n = (window.RECHERCHES || []).find(x => x.id === id);
    if (!n) return { ok: false, raison: 'Recherche inconnue.' };
    if (aRecherche(id)) return { ok: false, raison: 'Déjà acquise.' };
    if (!rechercheOuverte(id)) return { ok: false, raison: 'Il faut d\'abord la recherche qui précède.' };
    if (!window.Etat.assez(n.cout)) return { ok: false, raison: 'Il manque de quoi payer.', manque: window.Etat.manque(n.cout) };
    window.Etat.depenser(n.cout);
    if (!E.recherches) E.recherches = {};
    E.recherches[id] = 1;
    invaliderAcquis();
    window.Etat.invaliderCap();
    /* certaines recherches ouvrent des postes : on remet tout le monde
       d'aplomb d'un coup. */
    for (const bid in E.bat) window.Etat.majPostes(E.bat[bid]);
    window.Etat.journal('Recherche acquise : ' + n.nom + '.', 'plan');
    window.Etat.prevenir('recherche', id);
    return { ok: true };
  }

  /* ---------------- la liste des barres, pour le dock ---------------- */
  function taches() {
    const E = S();
    const out = [];
    for (const bid in E.bat) {
      const b = E.bat[bid];
      for (let i = 0; i < b.postes.length; i++) {
        const p = b.postes[i];
        if (!p.hab || !p.rec) continue;
        const rec = window.REC[p.rec];
        const h = window.Etat.habitant(p.hab);
        const v = vitessePoste(b, rec, h);
        const sorties = Object.keys(rec.out);
        const resPrincipale = sorties[0] || null;
        const cyclesMin = 60 / (rec.duree / Math.max(0.001, v));
        let detail = '';
        if (p.bloque) {
          const m = window.Etat.manque(rec.in);
          detail = 'manque ' + m.map(z => (window.RES[z.id] ? window.RES[z.id].nom.toLowerCase() : z.id)).join(', ');
        } else {
          detail = sorties.length
            ? sorties.map(z => '+' + rec.out[z] + ' ' + window.RES[z].nom.toLowerCase()).join(', ')
            : (rec.recrue ? '+1 habitant' : rec.unite ? '+1 unité' : rec.menace ? 'menace en baisse' : '');
          detail += '  ·  ' + (Math.round(cyclesMin * 10) / 10).toString().replace('.', ',') + '/min';
          if (p.reste != null) detail += '  ·  ×' + p.reste;
          else if ((p.file || []).length) detail += '  ·  +' + p.file.length + ' en file';
        }
        out.push({
          k: 'poste', bat: bid, i, id: bid + ':' + i,
          nom: rec.nom, lieu: window.BAT[b.type].nom, type: b.type,
          hab: h ? h.nom : '—', detail,
          prog: p.bloque ? 0 : Math.min(1, p.prog / rec.duree),
          reste: p.bloque ? null : Math.max(0, (rec.duree - p.prog) / Math.max(0.001, v)),
          bloque: p.bloque, manque: p.bloque ? window.Etat.manque(rec.in) : null,
          res: resPrincipale,
          image: rec.image || null,
          unite: rec.uniteType || null,
          debit: resPrincipale && !p.bloque ? (rec.out[resPrincipale] || 0) * cyclesMin : 0,
          ico: window.METIERS[rec.metier].ico,
        });
      }
    }
    if (E.chantier.file.length) {
      const job = E.chantier.file[0];
      const v = vitesseChantier();
      out.unshift({
        k: 'chantier', id: 'chantier', nom: job.nom, lieu: 'Chantier',
        hab: E.chantier.ouvriers.length ? (E.chantier.ouvriers.length + ' ouvrier' + (E.chantier.ouvriers.length > 1 ? 's' : '')) : 'personne aux outils',
        detail: v > 0 ? 'cadence ×' + v.toFixed(2).replace('.', ',') : 'aucun ouvrier affecté',
        prog: Math.min(1, E.chantier.prog / job.temps),
        reste: v > 0 ? (job.temps - E.chantier.prog) / v : null,
        bloque: v <= 0, attente: E.chantier.file.length - 1,
        type: job.type || null,
        ico: window.METIERS.batisse.ico,
      });
    }
    if (E.armee && E.armee.forge) {
      const job = E.armee.forge;
      const objet = window.Armee && window.Armee.objetEquipement(job.type, job.slot, job.tier);
      out.unshift({
        k: 'forge', id: 'forge-equipement', nom: objet ? objet.name : 'Équipement', lieu: 'Forge', hab: '',
        detail: (job.slot === 'arme' ? 'arme' : 'armure') + ' · ' + job.type + ' · palier ' + job.tier,
        prog: Math.min(1, (job.prog || 0) / Math.max(1, job.duree)),
        reste: Math.max(0, job.duree - (job.prog || 0)), bloque: false,
        image: window.Armee ? window.Armee.imageEquipement(job.type, job.slot, job.tier) : null,
        ico: { f: job.slot === 'arme' ? 'epee' : 'plastron', c: ['#c9cdd2', '#8a8f96'] },
      });
    }
    if (E.aventure.encours) {
      out.unshift({ k: 'aventure', id: 'aventure', nom: 'Descente — étage ' + E.aventure.profondeur,
        lieu: 'Tour sombre', hab: E.armee.unites + ' en campagne',
        prog: E.aventure.encours.prog || 0, reste: null, bloque: false,
        ico: { f: 'ame', c: ['#8fd8e0', '#4a8f9c'] } });
    }
    if (E.expedition) {
      out.unshift({ k: 'expedition', id: 'expedition', nom: E.expedition.nom || 'Expédition',
        lieu: "Portail", hab: '', prog: E.expedition.prog || 0, reste: null, bloque: false,
        ico: { f: 'epee', c: ['#c9cdd2', '#8a8f96'] } });
    }
    return out;
  }

  window.Jeu = {
    tick, rattraper,
    debloque, majDecouvertes, catalogue, coutConstruction, faireApparaitre,
    poserBatiment, ameliorer, raffiner, reparer, annulerOuvrage, deplacerOuvrage,
    definirRecette, ajouterFile, retirerFile, deplacerFile, cyclesPossibles,
    assignerAuto, assigner, candidatsPoste, outiller,
    taches, vitessePoste, vitesseChantier, multGlobal, facteurHabitant, maitriseAtelier, outilActif, organisationScierie, besoinTotal,
    moralEffectif, defenseTotale, bonusNegoce, tauxMenace, declencherRaid,
    palierMenace, PALIERS_MENACE, sortiePossible, gainSortie, forceSortie,
    reservePortions, nbBatiments,
    acquis, invaliderAcquis, aRecherche, rechercheOuverte, amelioDe, postesEffectifs,
    acheterAmelio, acheterRecherche,
    PORTIONS, BESOIN_PAR_HABITANT,
  };

})();
