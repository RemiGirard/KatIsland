/* ============================================================
   LE BOURG — js/app.js
   L'assemblage. Il n'y a qu'UNE boucle : celle du rendu du village.
   Elle tire le moteur de jeu à chaque image, et l'interface se
   rafraîchit à cadence réduite — l'œil n'a pas besoin de soixante
   mises à jour de texte par seconde, le canvas si.
   ============================================================ */
"use strict";
(function () {

  const U = () => window.UI;
  const E = () => window.Etat.E;

  let tUI = 0, tSync = 0;

  function demarrer() {
    /* ---- 1. l'état ---- */
    const reprise = window.Etat.charger();
    if (!reprise) window.Etat.recommencer();

    /* ---- 2. le village ---- */
    window.Village.init({ graine: E().graine, jour: E().heure, nom: E().nomBourg });
    if (!E().nomBourg) E().nomBourg = window.Village.nom();
    else window.Village.renommer(E().nomBourg);

    window.UIDock.construire();
    if (window.Tutoriel) window.Tutoriel.init();
    /* les préférences s'appliquent avant le premier rendu : le joueur ne
       doit jamais voir un écran qui n'est pas le sien. */
    if (window.Reglages) window.Reglages.appliquer();

    /* ---- 3. le plan du bourg ---- */
    if (reprise && E().plan && E().plan.length) window.Village.chargerPlan(E().plan);
    /* Un échafaudage sans ouvrage en file est un fantôme : il occupe une
       parcelle que rien ne viendra jamais réclamer. On fait le ménage au
       chargement plutôt que de laisser le bourg se boucher tout seul. */
    for (const b of window.Village.batiments().slice()) {
      if (E().bat[b.id]) continue;
      if (E().chantier.file.some(j => j.bat === b.id)) continue;
      window.Village.retirer(b.id);
    }

    /* La Tour sombre est un morceau de l'île. Elle existe sur une partie
       neuve comme sur une ancienne sauvegarde : cliquer sa silhouette
       suffit pour préparer l'équipée et lancer le mode aventure. */
    E().vus['carnet:descente'] = true;
    window.Jeu.faireApparaitre('descente');

    /* ---- 4. les branchements ---- */
    /* ---- l'horloge murale ----
       La boucle de rendu s'arrête dès que l'onglet passe en arrière-plan :
       le navigateur suspend `requestAnimationFrame`. Sans ce garde-fou, un
       joueur qui change d'onglet dix minutes retrouve son bourg figé. On
       compare donc l'heure réelle à chaque image, et l'on rattrape le
       retard exactement comme au chargement. */
    let horloge = Date.now();
    window.Village.surTick(function (dt) {
      /* LES HABITANTS DANS LE VILLAGE. Ils vivent sur la même horloge
         que la scène : une image, un pas. Le module se débrouille seul
         si le joueur les a coupés dans les réglages. */
      if (window.Habitants3D) { try { window.Habitants3D.tick(dt); } catch (e) { } }
      /* LES NAVIRES AU PONTON. Même horloge, même principe. Le branchement
         se fait ici et nulle part ailleurs : `Village.surTick` n'accepte
         qu'un seul abonné et l'écrase à chaque appel, donc un module qui
         s'abonnerait de son côté ferait taire les habitants. */
      if (window.Port3D) { try { window.Port3D.tick(dt); } catch (e) { } }
      const now = Date.now();
      const ecart = (now - horloge) / 1000;
      horloge = now;
      if (ecart > 4) {
        const r = window.Jeu.rattraper(ecart);
        if (r && r.duree > 120) {
          window.Etat.journal('Le bourg a travaillé ' + U().duree(r.duree) + ' pendant que l\'écran dormait.', 'info');
          U().dire('Retour : ' + U().duree(r.duree) + ' de travail rattrapés.', 'butin', 4000);
        }
        synchroniserVillage();
      }
      window.Jeu.tick(dt);
      if (window.Aventure) window.Aventure.tick(dt);
      if (window.Expedition) window.Expedition.tick(dt);
      E().heure = window.Village.heure();
      tUI += dt; tSync += dt;
      if (tUI > 0.2) { tUI = 0; rafraichirUI(); }
      if (tSync > 1.0) { tSync = 0; synchroniserVillage(); }
    });

    window.Village.hooks({
      selection: batimentClique,
      survol: b => window.UIDock.montrerSurvol(b),
      /* Le sol rend le village à l'image : il referme la commande du
         bâtiment et retrouve naturellement le menu latéral. Le chantier
         reste accessible par son onglet marteau. */
      sol: () => { if (!window.Village.enConstruction()) window.UIDock.fermerBatiment(); },
      pose: (type, pos) => window.UIFen.poserIci(pos),
      poseRefus: type => U().dire(
        type && window.Village.bordEau(type)
          ? 'Le quai doit toucher l’eau. Désignez la bande quadrillée de la rive.'
          : 'Pas de place ici : essayez une autre terrasse.', 'alerte'),
      redim: () => { synchroniserVillage(); },
    });

    window.Etat.abonner(function (quoi, data) {
      if (quoi === 'construit' || quoi === 'ameliore' || quoi === 'raffine') {
        window.Jeu.majDecouvertes(); synchroniserVillage();
      }
      /* Le bâtiment vient de monter d'un niveau : si c'est un changement
         d'ÂGE, le village le rebâtit sur place — chaume en tuile, tuile
         en lauze, et l'oriflamme au faîte. */
      if (quoi === 'ameliore' && data && data.id) {
        const change = data.type === 'scierie' && window.Village.configurerScierie
          ? window.Village.configurerScierie(data.id, data.niv, data.raff)
          : window.Village.rehausser(data.id, data.niv);
        if (change) {
          E().plan = window.Village.plan();
          U().dire(window.BAT[data.type].nom + ' est désormais ' +
                   window.Village.nomPalier(data.niv) + '.', 'butin', 4200);
        }
      }
      if (quoi === 'habitant') { synchroniserVillage(); U().dire(data.nom + ' s\'installe au bourg.', 'bien'); }
      if (quoi === 'deblocage') U().dire('Nouveau plan : ' + window.BAT[data].nom, 'butin');
      if (quoi === 'raid') {
        if (data.repousse) U().dire('Raid repoussé aux remparts.', 'bien', 4200);
        else U().dire('RAID — ' + (data.touches || []).join(', ') + ' endommagé, grange pillée.', 'alerte', 5200);
      }
      if (quoi === 'chantier') { window.Jeu.majDecouvertes(); }
    });

    /* ---- 5. rattrapage hors-ligne ---- */
    if (reprise) {
      const ecoule = (Date.now() - (E().t || Date.now())) / 1000;
      const r = window.Jeu.rattraper(ecoule);
      if (r && r.duree > 60) {
        window.Etat.journal('Absence de ' + U().duree(r.duree) + ' : le bourg a continué de travailler.', 'info');
        rapportAbsence(r);
      }
    } else {
      premiersPas();
    }

    /* Ouvert par double-clic sur le fichier, le navigateur refuse souvent
       le stockage local : le bourg tournerait sans jamais s'enregistrer.
       Mieux vaut le dire tout de suite que le découvrir demain. */
    try { localStorage.setItem('bourg.test', '1'); localStorage.removeItem('bourg.test'); }
    catch (e) {
      U().dire('Le navigateur refuse d\'enregistrer : lancez « node jeu/serveur.js ».', 'alerte', 9000);
    }

    window.Jeu.majDecouvertes();
    synchroniserVillage();
    rafraichirUI();
    window.Village.demarrer();
    brancherClavier();
    const enregistrer = () => { E().plan = window.Village.plan(); window.Etat.sauver(true); };
    addEventListener('beforeunload', enregistrer);
    addEventListener('visibilitychange', () => { if (document.hidden) enregistrer(); });
  }

  function chargerPartieAvancee() {
    const BACKUP = 'bourg.sauvegarde.avant-partie-avancee';
    try {
      E().plan = window.Village.plan();
      window.Etat.sauver(true);
      const brut = localStorage.getItem('bourg.sauvegarde.v1');
      if (brut) localStorage.setItem(BACKUP, brut);
    } catch (err) { /* le jeu saura signaler lui-même un stockage interdit */ }

    /* Une partie avancée est un état propre et reproductible, pas une couche
       ajoutée par-dessus la progression courante. La graine fixe garantit que
       le port dispose toujours de la même côte testée. */
    const options = Object.assign({}, E().options || {});
    if(window.Village)window.Village.chargerPlan([]);
    window.Etat.recommencer(280826);
    const e = E();Object.assign(e.options,options);
    window.Village.init({graine:e.graine,nom:'Valgriffe'});
    window.Village.renommer('Valgriffe');e.nomBourg='Valgriffe';

    /* Aucun chantier ni amélioration en attente : le laboratoire commence
       dans un état stable. Les habitants qui y travaillaient redeviennent
       disponibles, les postes de production déjà choisis restent en place. */
    for (const h of (e.habitants || []))
      if (h.aff && h.aff.k === 'chantier') h.aff = null;
    for (const job of ((e.chantier && e.chantier.file) || []))
      if (job && job.k === 'construire' && job.bat) window.Village.retirer(job.bat);
    e.chantier = { file: [], prog: 0, ouvriers: [] };

    /* On ramène tout l'existant au niveau de base et l'on retire annexes,
       outils et améliorations. Ce sont bien les bâtiments, pas leurs
       évolutions, que cette sauvegarde doit permettre d'essayer. */
    for (const id in e.bat) {
      const b = e.bat[id];
      b.niv = 1; b.xp = 0; b.outil = null; b.outilsRecette = {}; b.am = {}; b.raff = {};
      window.Etat.majPostes(b);
      window.Village.rehausser(id, 1);
    }

    /* Les lieux exigeants passent d'abord : quais et parcelles agricoles
       prennent le sol dont ils ont besoin. Les ateliers urbains peuvent
       ensuite monter sur plusieurs terrasses si l'île est déjà dense. */
    const types = window.BAT_ORDRE.slice().sort((a, b) => {
      const da = window.BAT[a], db = window.BAT[b];
      /* Le port réserve le meilleur front de mer avant la pêcherie et le
         moulin à eau. C'est précisément la construction que cette sauvegarde
         avancée doit permettre d'essayer immédiatement. */
      const pa = a==='port' ? 0 : (window.Village.bordEau(a) ? 1 : ((da.cat === 'recolte' || da.cat === 'elevage' || a === 'descente') ? 2 : 3));
      const pb = b==='port' ? 0 : (window.Village.bordEau(b) ? 1 : ((db.cat === 'recolte' || db.cat === 'elevage' || b === 'descente') ? 2 : 3));
      return pa - pb;
    });
    const manquants = [];
    for (const type of types) {
      e.vus['carnet:' + type] = true;
      e.vus['bat:' + type] = true;
      if (window.Etat.aBatiment(type)) continue;
      const d = window.BAT[type];
      const empilable = !window.Village.bordEau(type) && d.cat !== 'recolte' && d.cat !== 'elevage' && type !== 'descente';
      let pose = window.Village.poser(type, null, null, null, 1, null, 0);
      if (!pose && empilable)
        for (let niveau = 1; niveau <= 12 && !pose; niveau++)
          pose = window.Village.poser(type, null, null, null, 1, null, niveau);
      if (!pose) { manquants.push(type); continue; }
      const construit=window.Etat.creerBatiment(type, pose.id);
      construit.niv=3;window.Etat.majPostes(construit);window.Village.rehausser(pose.id,3);
    }

    /* Quelques logements supplémentaires et une population suffisante pour
       essayer immédiatement les chaînes, l'expédition et le port. */
    for(let i=0;i<8;i++){
      const pose=window.Village.poser('maison',null,null,null,1,(i%12)+1,0);
      if(pose){const maison=window.Etat.creerBatiment('maison',pose.id);maison.niv=3;window.Etat.majPostes(maison);}
    }
    while(e.habitants.length<14)window.Etat.ajouterHabitant(1.5);
    for(let i=0;i<e.habitants.length;i++){
      const h=e.habitants[i];h.niv=6+(i%5);h.xp=0;
      window.Etat.assurerProgression(h);
    }
    for(const r of (window.RECHERCHES||[]))e.recherches[r.id]=true;
    e.jours=45;e.tJeu=45*260;e.moral=82;e.menace=18;
    e.aventure.record=12;e.aventure.profondeur=12;
    e.armee.unites=24;e.armee.xp=480;e.armee.palierArme=3;e.armee.palierArmure=3;
    if(e.tutoriel){e.tutoriel.actif=false;e.tutoriel.replie=true;e.tutoriel.introValidee=true;}

    /* Le stock de test ignore volontairement les plafonds : il doit servir à
       éprouver toutes les recettes, même avant la construction d'entrepôts. */
    for (const id in window.RES) {
      e.res[id] = id==='ecu' ? 250000 : 25000;
      e.vus['res:' + id] = true;
    }
    window.Etat.invaliderCap();
    e.plan = window.Village.plan();
    window.Etat.journal('Partie avancée chargée : bourg complet, recherches et réserves prêtes.', 'butin');
    if (manquants.length)
      window.Etat.journal('Parcelles introuvables pour : ' + manquants.map(id => window.BAT[id].nom).join(', ') + '.', 'alerte');

    window.Etat.sauver(true);
    return {ok:true,manquants};
  }

  /* =================================================================
     PREMIERS PAS — on n'explique rien par un tutoriel : on ouvre la
     bonne fenêtre au bon moment, et le journal raconte.
     ================================================================= */
  function premiersPas() {
    window.Etat.journal('Un chat, une rivière, et rien d\'autre. Le bourg commence ici.', 'info');
    setTimeout(() => {
      U().dire('Commencez par la pêcherie : ouvrez le marteau « Construire » à droite. Elle ne coûte rien.', 'butin', 7000);
    }, 900);
  }

  /* ------------------------------------------------------------------
     LE RAPPORT D'ABSENCE. Ce n'est pas une récompense, c'est un COMPTE
     RENDU : ce qui est entré, ce qui a débordé faute de place, ce qui
     s'est bloqué faute de matière, ce qui s'est achevé. Le joueur doit
     savoir quoi corriger avant de repartir.
     ------------------------------------------------------------------ */
  function rapportAbsence(r) {
    const el = U().el;
    const ids = Object.keys(r.gains).filter(id => r.gains[id] >= 1);
    U().ouvrir('absence', {
      titre: 'Pendant votre absence', sous: U().duree(r.duree) + ' de travail',
      onglets: [{ id: 'a', nom: 'Rapport', rendu: c => {
        c.appendChild(U().stats([
          ['durée', U().duree(r.duree)],
          ['ressources', ids.length, ids.length ? 'bon' : 'faible'],
          ['habitants', r.habitants > 0 ? '+' + r.habitants : '—', r.habitants > 0 ? 'bon' : ''],
          ['raids', r.raids || '—', r.raids ? 'mauvais' : ''],
        ]));
        if (ids.length) {
          c.appendChild(U().section('Entré en réserve'));
          const lot = {}; for (const id of ids) lot[id] = Math.floor(r.gains[id]);
          c.appendChild(U().listeRes(lot, { gain: true }));
        } else {
          c.appendChild(el('div', { class: 'note faible',
            text: 'Rien n\'est entré : aucun poste n\'était tenu. Affectez vos habitants avant de partir.' }));
        }
        if (r.acheves && r.acheves.length) {
          c.appendChild(U().section('Achevé au chantier'));
          c.appendChild(el('div', { class: 'note', text: r.acheves.join('  ·  ') }));
        }
        const perdus = Object.keys(r.perdu || {}).filter(id => r.perdu[id] >= 1);
        if (perdus.length) {
          c.appendChild(U().section('Perdu faute de place'));
          const lot = {}; for (const id of perdus) lot[id] = Math.floor(r.perdu[id]);
          c.appendChild(U().listeRes(lot));
          c.appendChild(el('div', { class: 'note mauvais',
            text: 'Ces quantités ont débordé du plafond de stockage. Un entrepôt ou une grange de plus les garderait.' }));
        }
        if (r.bloques && r.bloques.length) {
          c.appendChild(U().section('Postes à l\'arrêt'));
          for (const b of r.bloques.slice(0, 8))
            c.appendChild(el('div', { class: 'cadre alerte' },
              el('div', { class: 'rangee entre' },
                el('span', { class: 'tt', style: 'font-size:13px', text: b.bat }),
                el('span', { class: 'eti', text: b.rec })),
              el('div', { class: 'note mauvais', style: 'margin-top:4px',
                text: 'manque : ' + b.manque.map(x => (window.RES[x.id] ? window.RES[x.id].nom.toLowerCase() : x.id)).join(', ') })));
        }
        if (r.resteFile) c.appendChild(el('div', { class: 'note',
          text: r.resteFile + ' ouvrage(s) attendent encore au chantier.' }));
        if (r.famine) c.appendChild(el('div', { class: 'note mauvais',
          text: 'La grange s\'est vidée : le bourg travaille à moitié cadence.' }));
        if (r.menace > 70) c.appendChild(el('div', { class: 'note mauvais',
          text: 'La menace est à ' + Math.floor(r.menace) + '. Une colonne ne va pas tarder.' }));
      } }],
    });
  }

  /* =================================================================
     CLIC SUR UN ÉDIFICE
     ================================================================= */
  function batimentClique(bat) {
    if (!bat) { window.UIDock.fermerBatiment(); return; }
    if (E().bat[bat.id]) { window.UIFen.ouvrirBatiment(bat.id); return; }
    const job = E().chantier.file.find(j => j.bat === bat.id);
    if (job) { window.UIFen.ouvrirChantier('file'); return; }
    window.UIFen.ouvrirChantier('batir');
  }

  /* =================================================================
     SYNCHRONISATION VILLAGE ← ÉTAT
     Le moteur de rendu ne connaît pas l'économie : c'est ici qu'on lui
     dit combien d'habitants marchent, qui travaille où, et quels
     ateliers doivent fumer.
     ================================================================= */
  function synchroniserVillage() {
    if (!window.Village) return;
    const E2 = E();
    /* Le niveau et les annexes de la scierie pilotent désormais sa vraie
       silhouette. L'appel ne fait rien tant que la signature n'a pas
       changé, il est donc sûr dans cette synchronisation périodique. */
    if (window.Village.configurerScierie) for (const bid in E2.bat) {
      const b = E2.bat[bid];
      if (b.type === 'scierie' && !b.chantier)
        window.Village.configurerScierie(bid, b.niv, b.raff || {});
    }
    E2.plan = window.Village.plan();

    /* population : les habitants du jeu, plus un fond de silhouettes qui
       ne travaillent pas — un bourg de trente maisons ne peut pas avoir
       l'air désert parce que six chats seulement ont un emploi. */
    const badauds = Math.min(40, Math.round(Object.keys(E2.bat).length * 1.6));
    window.Village.population(E2.habitants.length + badauds);

    /* Chaque habitant affecté part avec SON MÉTIER : c'est lui qui décide
       du geste qu'on le verra faire. Personne ne pêche sans être à la
       pêcherie, personne ne coupe de bois sans être à la scierie. */
    let lignesALEau = 0;
    for (let i = 0; i < E2.habitants.length; i++) {
      const h = E2.habitants[i];
      if (h.aff && h.aff.k === 'poste') {
        const b = E2.bat[h.aff.bat];
        const p = b && b.postes[h.aff.i];
        if (b && p && p.rec) {
          const rec = window.REC[p.rec];
          window.Village.affecterA(i, b.id, rec ? rec.metier : null);
          if (rec && rec.metier === 'peche' && !p.bloque) lignesALEau++;
          continue;
        }
      }
      if (h.aff && h.aff.k === 'chantier') {
        const job = E2.chantier.file[0];
        if (job && job.bat) { window.Village.affecterA(i, job.bat, 'batisse'); continue; }
      }
      window.Village.affecter(i, -1, 0);
    }
    window.Village.pecheurs(lignesALEau);
    for (let i = E2.habitants.length; i < E2.habitants.length + badauds; i++) window.Village.affecter(i, -1, 0);

    /* les ateliers qui tournent : la fumée, la roue et le brasier ne
       jouent que pour eux. Un bourg à l'arrêt se voit. */
    const actifs = [];
    for (const bid in E2.bat) {
      const b = E2.bat[bid];
      if (b.postes.some(p => p.hab && p.rec && !p.bloque)) actifs.push(bid);
    }
    const job = E2.chantier.file[0];
    if (job && job.bat && E2.chantier.ouvriers.length) actifs.push(job.bat);
    window.Village.actifs(actifs);
  }

  /* =================================================================
     RAFRAÎCHISSEMENT DE L'INTERFACE
     ================================================================= */
  function rafraichirUI() {
    window.UIDock.majDock();
    window.UIDock.majBandeau();
    window.UIDock.majProductions();
  }

  /* =================================================================
     CLAVIER
     ================================================================= */
  function brancherClavier() {
    addEventListener('keydown', e => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'o') window.UIDock.basculer();
      else if (k === 'c') window.UIFen.ouvrirChantier();
      else if (k === 'r') window.UIFen.ouvrirReserves();
      else if (k === 'h') window.UIFen.ouvrirHabitants('roles');
      else if (k === 'b') window.UIFen.ouvrirBourg();
      else if (k === 'g') window.UIFen.ouvrirReglages();
      else if (k === 'w') window.UI.fermerTout();
    });
  }

  window.App = { demarrer, synchroniserVillage, majAffectations: synchroniserVillage, rafraichirUI, chargerPartieAvancee };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', demarrer);
  else demarrer();

})();
