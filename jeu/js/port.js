/* ============================================================
   LE BOURG — js/port.js
   LA FLOTTE, ET LA GUERRE QUI PASSE PAR LA MER.

   Le bourg est sur une île : tout ce qui n'est pas lui est de l'autre
   côté de l'eau. On n'attaque donc plus « en sortant » — on AFFRÈTE.

   LE CYCLE, du point de vue du joueur :

     1. il choisit un navire à quai et une île ;
     2. il CHARGE la cale avec ce que la caserne a en magasin — et la
        cale est petite au début : vingt places obligent à choisir ;
     3. le navire appareille. Il est parti pour un temps qui dépend de
        la distance, et pendant ce temps il n'est plus disponible ;
     4. à l'arrivée, le port le signale. Le joueur lance la bataille
        QUAND IL VEUT : le navire attend au mouillage ;
     5. victoire — la Nuée retombe, la cale se remplit de butin, et le
        navire refait la traversée en sens inverse.

   C'EST LA SEULE FAÇON DE FAIRE BAISSER LA MENACE. Elle ne retombe
   plus toute seule, et la « sortie » d'autrefois n'existe plus : si
   l'on veut de l'air, on prend la mer.

   -> window.Port
   ============================================================ */
"use strict";
(function () {

  const E = () => window.Etat.E;

  /* ==================================================================
     L'ÉTAT
     ================================================================== */
  function assure() {
    const s = E();
    if (!s.port) {
      s.port = {
        navires: [],
        seq: 0,
        prises: [],          // îles déjà tenues
        expeditions: 0,
      };
    }
    /* Le PREMIER navire est offert avec le port : sans lui le bâtiment
       ne servirait à rien, et l'on ferait payer deux fois la même
       chose. Une barque de vingt places — assez pour aller voir, pas
       pour conquérir. */
    if (aLePort() && !s.port.navires.length) {
      s.port.navires.push(nouveauNavire(0));
      window.Etat.journal('Une barque est armée au port : vingt places de cale.', 'guerre');
    }
    return s.port;
  }

  function aLePort() { return window.Etat.aBatiment('port'); }

  function nouveauNavire(palier) {
    const s = E();
    const C = window.IleUtil.CALES[palier] || window.IleUtil.CALES[0];
    return {
      id: 'n' + (++s.port.seq),
      nom: C.nom,
      palier, places: C.places,
      etat: 'quai',          // quai | mer | mouillage | retour
      ile: null, reste: 0, total: 0,
      cargo: [],             // [{ type, n }]
      butin: null,
    };
  }

  /* ==================================================================
     LA FLOTTE
     ================================================================== */
  function navires() { return assure().navires; }
  function navire(id) { return navires().find(n => n.id === id) || null; }

  /* Combien de navires on a le droit d'armer : le port en autorise un
     de plus par palier de deux niveaux. Une flotte se mérite. */
  function quaisMax() {
    const b = window.Etat.batsDeType('port')[0];
    return b ? 1 + Math.floor((b.niv - 1) / 2) : 0;
  }

  function peutArmer() {
    const p = assure();
    if (!aLePort()) return { ok: false, pourquoi: 'Le bourg n\'a pas de port.' };
    if (p.navires.length >= quaisMax())
      return { ok: false, pourquoi: 'Tous les quais sont pris. Agrandissez le port.' };
    const cout = window.IleUtil.coutNavire(p.navires.length);
    if (!window.Etat.assez(cout))
      return { ok: false, pourquoi: 'Matériaux insuffisants.', cout, manque: window.Etat.manque(cout) };
    return { ok: true, cout };
  }
  function armerNavire() {
    const v = peutArmer();
    if (!v.ok) return v;
    window.Etat.depenser(v.cout);
    const n = nouveauNavire(0);
    assure().navires.push(n);
    window.Etat.journal('Un navire de plus est armé : ' + n.nom + '.', 'guerre');
    return { ok: true, navire: n };
  }

  function peutAgrandir(id) {
    const n = navire(id);
    if (!n) return { ok: false, pourquoi: 'Navire inconnu.' };
    if (n.etat !== 'quai') return { ok: false, pourquoi: 'Ce navire est en mer.' };
    const C = window.IleUtil.CALES;
    if (n.palier >= C.length - 1) return { ok: false, pourquoi: 'La cale est au maximum.' };
    const suiv = C[n.palier + 1];
    if (!window.Etat.assez(suiv.cout))
      return { ok: false, pourquoi: 'Matériaux insuffisants.', cout: suiv.cout,
               manque: window.Etat.manque(suiv.cout) };
    return { ok: true, cout: suiv.cout, vers: suiv };
  }
  function agrandir(id) {
    const v = peutAgrandir(id);
    if (!v.ok) return v;
    const n = navire(id);
    window.Etat.depenser(v.cout);
    n.palier++; n.places = v.vers.places; n.nom = v.vers.nom;
    window.Etat.journal(n.nom + ' : la cale passe à ' + n.places + ' places.', 'guerre');
    return { ok: true };
  }

  /* ==================================================================
     LE CHARGEMENT

     On embarque ce que la caserne a en magasin, dans la limite de la
     cale. Une unité prend une place — les grosses en prennent
     davantage, comme en bataille (`pop`).
     ================================================================== */
  function placesPrises(cargo) {
    const GD = window.GameData;
    return (cargo || []).reduce((s, x) => {
      const u = GD.UNIT_TYPES[x.type];
      return s + x.n * ((u && u.pop) || 1);
    }, 0);
  }

  /* Ce que le bourg a de ce type, MOINS ce qui est déjà embarqué —
     ailleurs comme ici. Sans cette soustraction, on chargerait trois
     fois la même compagnie sur trois navires. */
  function disponible(type, saufNavire) {
    const a = E().armee;
    const total = (a && a.types && a.types[type]) || 0;
    let pris = 0;
    for (const n of navires()) {
      if (saufNavire && n.id === saufNavire) continue;
      for (const c of n.cargo) if (c.type === type) pris += c.n;
    }
    return Math.max(0, total - pris);
  }
  /* Tous les types que le bourg possède, dans l'ordre du jeu. */
  function typesEmbarquables() {
    return window.Armee ? window.Armee.typesPossedes() : [];
  }

  function charger(id, type, n) {
    const nav = navire(id);
    if (!nav) return { ok: false, pourquoi: 'Navire inconnu.' };
    if (nav.etat !== 'quai') return { ok: false, pourquoi: 'Ce navire n\'est pas à quai.' };
    const GD = window.GameData;
    const u = GD.UNIT_TYPES[type];
    if (!u) return { ok: false, pourquoi: 'Type inconnu.' };
    const pop = u.pop || 1;
    const libre = nav.places - placesPrises(nav.cargo);
    const possible = Math.min(n, disponible(type, id), Math.floor(libre / pop));
    if (possible <= 0) return { ok: false, pourquoi: libre < pop ? 'La cale est pleine.' : 'Aucune unité de ce type disponible.' };
    const c = nav.cargo.find(x => x.type === type);
    if (c) c.n += possible; else nav.cargo.push({ type, n: possible });
    return { ok: true, embarque: possible };
  }
  function decharger(id, type, n) {
    const nav = navire(id);
    if (!nav || nav.etat !== 'quai') return { ok: false };
    const i = nav.cargo.findIndex(x => x.type === type);
    if (i < 0) return { ok: false };
    nav.cargo[i].n -= (n == null ? nav.cargo[i].n : n);
    if (nav.cargo[i].n <= 0) nav.cargo.splice(i, 1);
    return { ok: true };
  }
  function viderCale(id) {
    const nav = navire(id);
    if (nav && nav.etat === 'quai') nav.cargo = [];
  }

  /* ==================================================================
     APPAREILLER
     ================================================================== */
  function peutAppareiller(id, ileId) {
    const nav = navire(id);
    const ile = window.IleUtil.parId(ileId);
    if (!nav) return { ok: false, pourquoi: 'Navire inconnu.' };
    if (nav.etat !== 'quai') return { ok: false, pourquoi: 'Ce navire est déjà en mer.' };
    if (!ile) return { ok: false, pourquoi: 'Île inconnue.' };
    if (!nav.cargo.length) return { ok: false, pourquoi: 'La cale est vide : on n\'attaque pas à mains nues.' };
    if (!window.Etat.assez(ile.cout))
      return { ok: false, pourquoi: 'Ravitaillement insuffisant pour la traversée.',
               manque: window.Etat.manque(ile.cout) };
    return { ok: true, ile };
  }

  function appareiller(id, ileId) {
    const v = peutAppareiller(id, ileId);
    if (!v.ok) return v;
    const nav = navire(id), ile = v.ile;
    window.Etat.depenser(ile.cout);
    nav.etat = 'mer'; nav.ile = ile.id;
    nav.total = window.IleUtil.traversee(ile.lieues, nav.palier);
    nav.reste = nav.total;
    window.Etat.journal(nav.nom + ' appareille pour ' + ile.nom + ' — ' +
      ile.lieues + ' lieues.', 'guerre');
    window.Etat.prevenir('port', nav);
    return { ok: true };
  }

  /* ==================================================================
     LE TEMPS DE MER
     ================================================================== */
  function tick(dt) {
    if (!aLePort()) return;
    const p = assure();
    for (const n of p.navires) {
      if (n.etat !== 'mer' && n.etat !== 'retour') continue;
      n.reste -= dt;
      if (n.reste > 0) continue;
      n.reste = 0;
      if (n.etat === 'mer') {
        n.etat = 'mouillage';
        const ile = window.IleUtil.parId(n.ile);
        window.Etat.journal(n.nom + ' mouille devant ' + (ile ? ile.nom : '—') +
          '. La bataille attend votre ordre.', 'guerre');
        window.Etat.prevenir('port', n);
      } else {
        /* retour au bourg : on débarque le butin et les survivants */
        rentrer(n);
      }
    }
  }

  function rentrer(n) {
    n.etat = 'quai'; n.ile = null; n.reste = 0; n.total = 0;
    if (n.butin) {
      const recu = window.Etat.gagnerLot(n.butin);
      const l = Object.keys(recu).map(k => recu[k] + ' ' + window.RES[k].nom.toLowerCase());
      window.Etat.journal(n.nom + ' est à quai : ' + (l.length ? l.join(', ') : 'cale vide') + '.', 'butin');
      n.butin = null;
    }
    window.Etat.prevenir('port', n);
  }

  /* ==================================================================
     LA BATAILLE

     Le port ne se bat pas lui-même : il appelle le moteur d'expédition,
     qui est celui de l'ancien jeu. Il lui donne l'île, la cale, et
     recueille le résultat.
     ================================================================== */
  function peutCombattre(id) {
    const nav = navire(id);
    if (!nav) return { ok: false, pourquoi: 'Navire inconnu.' };
    if (nav.etat !== 'mouillage') return { ok: false, pourquoi: 'Le navire n\'est pas devant l\'île.' };
    if (E().expedition) return { ok: false, pourquoi: 'Une bataille est déjà en cours.' };
    return { ok: true, ile: window.IleUtil.parId(nav.ile) };
  }

  function combattre(id) {
    const v = peutCombattre(id);
    if (!v.ok) { if (window.UI) window.UI.dire(v.pourquoi, 'alerte'); return v; }
    const nav = navire(id);
    window.UIExpedition.lancerIle(v.ile, nav);
    return { ok: true };
  }

  /* Appelé par le module d'expédition quand la bataille se termine. */
  function resultat(navId, gagne, pertes) {
    const nav = navire(navId);
    if (!nav) return;
    const ile = window.IleUtil.parId(nav.ile);
    const s = E();

    /* les pertes se prennent dans la cale : ce qui est mort ne rentre pas */
    if (pertes && pertes > 0) {
      let reste = pertes;
      for (const c of nav.cargo.slice()) {
        const pris = Math.min(c.n, reste);
        c.n -= pris; reste -= pris;
        if (c.n <= 0) nav.cargo.splice(nav.cargo.indexOf(c), 1);
        if (reste <= 0) break;
      }
      if (window.Armee) window.Armee.pertes(null, pertes);
    }

    if (gagne && ile) {
      /* LA SEULE FAÇON DE FAIRE RETOMBER LA NUÉE. */
      const av = s.menace;
      s.menace = Math.max(0, s.menace - ile.menace);
      nav.butin = Object.assign({}, ile.butin);
      const p = assure();
      if (p.prises.indexOf(ile.id) < 0) p.prises.push(ile.id);
      p.expeditions++;
      window.Etat.journal('Victoire à ' + ile.nom + ' : la Nuée retombe de ' +
        Math.round(av - s.menace) + ' points.', 'guerre');
    } else if (ile) {
      s.menace = Math.min(100, s.menace + 4);
      window.Etat.journal('Échec devant ' + ile.nom + '. Le navire rentre allégé.', 'alerte');
    }

    /* on repart, quoi qu'il arrive : la mer ne garde pas les vaincus */
    nav.etat = 'retour';
    nav.total = window.IleUtil.traversee(ile ? ile.lieues : 4, nav.palier);
    nav.reste = nav.total;
    window.Etat.prevenir('port', nav);
  }

  /* ==================================================================
     LECTURE POUR L'INTERFACE
     ================================================================== */
  function etatNavire(n) {
    switch (n.etat) {
      case 'quai':      return { court: 'à quai', long: 'Prêt à charger' };
      case 'mer':       return { court: 'en mer', long: 'Traversée' };
      case 'mouillage': return { court: 'mouillé', long: 'Devant l\'île — la bataille attend' };
      case 'retour':    return { court: 'retour', long: 'Rentre au bourg' };
    }
    return { court: '?', long: '' };
  }
  function ileDe(n) { return n.ile ? window.IleUtil.parId(n.ile) : null; }
  function estPrise(id) { return assure().prises.indexOf(id) >= 0; }

  window.Port = {
    assure, aLePort, navires, navire, quaisMax,
    peutArmer, armerNavire, peutAgrandir, agrandir,
    placesPrises, disponible, typesEmbarquables, charger, decharger, viderCale,
    peutAppareiller, appareiller, peutCombattre, combattre, resultat,
    tick, etatNavire, ileDe, estPrise,
  };

})();
