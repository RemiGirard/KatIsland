/* ============================================================
   LE BOURG — js/expedition.js
   L'EXPÉDITION. Le portail ne sert pas à « faire des batailles » : il
   sert à trois choses très concrètes, et c'est ce qui lui donne sa
   place dans une partie d'idle.

   1. LE TERRITOIRE. Chaque zone prise donne au bourg un avantage
      PERMANENT sur un métier — c'est la seule façon de faire monter
      certaines cadences au-delà de ce que les niveaux permettent.
   2. LA MENACE. Aller au-devant de la colonne fait retomber la jauge
      d'un coup ; l'ignorer, c'est laisser venir le raid.
   3. LES MÉDAILLES, qu'aucun métier ne fabrique et qui paient les
      choses que le bourg ne sait pas faire.

   Le moteur de bataille (`battle-core.js`) est conservé tel quel.
   ============================================================ */
"use strict";
(function () {

  const U = () => window.UI, el = () => window.UI.el;
  const E = () => window.Etat.E;

  /* =================================================================
     LES ZONES. Difficulté croissante, et surtout : chacune répond à un
     goulot d'étranglement précis de l'économie. On ne prend pas une
     zone « parce qu'elle est là » — on la prend parce que la scierie
     n'arrive plus à suivre.
     ================================================================= */
  const ZONES = [
    { id: 'berges',   nom: 'Les Basses Berges', diff: 1, noeuds: 5,
      desc: "Une langue de gravier que la Nuée utilise pour remonter la rivière sans être vue.",
      cout: { unites: 3, poissonfume: 4 }, bonus: { metier: 'peche', pct: 0.14 },
      butin: { medaille: 1, essence: 2 } },
    { id: 'taillis',  nom: 'Le Taillis Brûlé', diff: 2, noeuds: 6,
      desc: "Ils y mettent le feu chaque printemps pour dégager leur vue. On peut leur retirer l'habitude.",
      cout: { unites: 4, poissonfume: 6 }, bonus: { metier: 'bois', pct: 0.14 },
      butin: { medaille: 1, bois: 40 } },
    { id: 'carriere', nom: 'La Carrière Haute', diff: 3, noeuds: 7,
      desc: "Un front de taille abandonné, tenu par une garnison qui n'en tire rien.",
      cout: { unites: 6, pain: 8 }, bonus: { metier: 'mine', pct: 0.14 },
      butin: { medaille: 2, pierre: 60 } },
    { id: 'paturage', nom: 'Les Grands Pâturages', diff: 4, noeuds: 7,
      desc: "De l'herbe à perte de vue et personne pour y mener un troupeau. Une aberration.",
      cout: { unites: 8, pain: 10 }, bonus: { metier: 'elevage', pct: 0.16 },
      butin: { medaille: 2, laine: 30, peau: 12 } },
    { id: 'plateau',  nom: 'Le Plateau du Vent', diff: 5, noeuds: 8,
      desc: "Le vent y est régulier toute l'année. Le meunier en rêve depuis qu'il a des dents.",
      cout: { unites: 10, tourte: 3 }, bonus: { metier: 'cuisine', pct: 0.18 },
      butin: { medaille: 3, ble: 90 } },
    { id: 'saline',   nom: 'La Saline', diff: 6, noeuds: 8,
      desc: "Des tables d'évaporation en escalier. Qui tient le sel tient l'hiver.",
      cout: { unites: 12, tourte: 4 }, bonus: { global: 0.05 },
      butin: { medaille: 3, poissonfume: 20 } },
    { id: 'boisancien', nom: 'Le Bois Ancien', diff: 7, noeuds: 9,
      desc: "Des fûts de six mètres de tour. Une seule de ces poutres porterait un rempart.",
      cout: { unites: 14, tourte: 5 }, bonus: { metier: 'bois', pct: 0.20 },
      butin: { medaille: 4, poutre: 6, planche: 40 } },
    { id: 'veine',    nom: 'La Veine Rouge', diff: 8, noeuds: 9,
      desc: "Un affleurement de fer si pur qu'on le prend d'abord pour de la brique.",
      cout: { unites: 16, potion: 2 }, bonus: { metier: 'feu', pct: 0.20 },
      butin: { medaille: 4, lingotfer: 20 } },
    { id: 'falaise',  nom: 'La Falaise aux Nids', diff: 10, noeuds: 10,
      desc: "C'est de là qu'elles partent. Y monter, c'est couper la Menace à la racine.",
      cout: { unites: 20, potion: 3 }, bonus: { menaceTaux: -0.30 },
      butin: { medaille: 6, essence: 12 } },
    { id: 'gouffre',  nom: 'Le Gouffre Sonnant', diff: 12, noeuds: 11,
      desc: "Une autre entrée du Puits, prise depuis toujours. La compagnie y descendrait moins loin, mais plus riche.",
      cout: { unites: 24, potion: 4 }, bonus: { butin: 0.15 },
      butin: { medaille: 8, gemme: 3, essence: 20 } },
    { id: 'minesnoires', nom: 'Les Mines Noires', diff: 15, noeuds: 12,
      desc: "On y taille une pierre qui ne réfléchit rien. La fonderie saura quoi en faire.",
      cout: { unites: 30, potion: 6 }, bonus: { metier: 'forge', pct: 0.22 },
      butin: { medaille: 10, obsidienne: 4 } },
    { id: 'aire',     nom: "L'Aire du Grand Bec", diff: 20, noeuds: 14,
      desc: "Le nid du chef. Personne n'y est allé deux fois — et le premier n'en est pas revenu.",
      cout: { unites: 40, potion: 10, chant: 2 }, bonus: { global: 0.12 },
      butin: { medaille: 20, relique: 1, obsidienne: 8 } },
  ];

  let bataille = null, zoneEnCours = null, ouvert = false, tB = 0;
  let plateau, scene, cvB, titre, sous, boutons, pied;

  function refs() {
    plateau = document.getElementById('plateau');
    scene = document.getElementById('plateau-scene');
    cvB = document.getElementById('plateau-canvas');
    titre = document.getElementById('plateau-titre');
    sous = document.getElementById('plateau-sous');
    boutons = document.getElementById('plateau-boutons');
    pied = document.getElementById('plateau-pied');
  }

  function zoneById(id) { return ZONES.find(z => z.id === id) || null; }
  function prises() { return E().territoires || []; }
  function estPrise(id) { return prises().indexOf(id) >= 0; }
  function prochaine() { return ZONES.find(z => !estPrise(z.id)) || null; }

  /* Les bonus permanents, lus par le moteur de production. */
  function bonusMetier(metier) {
    let m = 1;
    for (const id of prises()) {
      const z = zoneById(id); if (!z) continue;
      if (z.bonus.metier === metier) m *= 1 + z.bonus.pct;
      if (z.bonus.global) m *= 1 + z.bonus.global;
    }
    return m;
  }
  function bonusButin() {
    let b = 0;
    for (const id of prises()) { const z = zoneById(id); if (z && z.bonus.butin) b += z.bonus.butin; }
    return b;
  }
  function facteurMenace() {
    let f = 1;
    for (const id of prises()) { const z = zoneById(id); if (z && z.bonus.menaceTaux) f *= 1 + z.bonus.menaceTaux; }
    return f;
  }

  /* =================================================================
     LANCEMENT D'UNE BATAILLE
     ================================================================= */
  /* =================================================================
     LA SORTIE

     Ce n'est pas une conquête : c'est la colonne du bourg qui va
     au-devant de celle qui approche. Il n'y a pas de territoire à
     gagner — seulement la jauge de Menace à faire retomber, et les
     armes ramassées sur le terrain.

     La zone n'existe pas dans la table : on la FABRIQUE à la mesure de
     la menace du moment. À vingt-cinq c'est une escarmouche, à
     quatre-vingt-quinze c'est le raid qu'on prend de vitesse.
     ================================================================= */
  function zoneSortie() {
    const E2 = E();
    const m = E2.menace;
    const diff = Math.max(1, Math.round(m / 7));
    const gain = window.Jeu.gainSortie();
    return {
      id: '__sortie', sortie: true, nom: 'Sortie du bourg', diff,
      noeuds: Math.max(4, Math.min(9, 4 + Math.floor(m / 18))),
      desc: "La colonne de la Nuée approche. On ne l'attend pas : on va la trouver.",
      cout: { unites: Math.max(1, Math.ceil(1 + m / 22)) },
      bonus: {},
      gainMenace: gain,
      butin: butinSortie(m),
    };
  }
  /* Ce qu'on ramasse : des médailles, et ce que la Nuée transportait. */
  function butinSortie(m) {
    const b = { medaille: Math.max(1, Math.round(m / 26)) };
    if (m >= 35) b.essence = Math.round(1 + m / 30);
    if (m >= 55) b.plume = Math.round(2 + m / 20);
    if (m >= 75) b.gemme = 1;
    return b;
  }
  function lancerSortie() {
    const v = window.Jeu.sortiePossible();
    if (!v.ok) { U().dire(v.pourquoi, 'alerte'); return; }
    lancer(zoneSortie());
  }

  function lancer(zid) {
    const z = (zid && typeof zid === 'object') ? zid : zoneById(zid);
    if (!z) return;
    if (!z.sortie && estPrise(z.id)) { U().dire('Cette zone est déjà tenue.', 'alerte'); return; }
    const E2 = E();
    if (E2.armee.unites < z.cout.unites) {
      U().dire('Il faut ' + z.cout.unites + ' unités formées au terrain d\'entraînement.', 'alerte'); return;
    }
    const cout = {};
    for (const k in z.cout) if (k !== 'unites') cout[k] = z.cout[k];
    if (!window.Etat.assez(cout)) { U().dire('Ravitaillement insuffisant.', 'alerte'); return; }
    window.Etat.depenser(cout);

    refs();
    ouvert = true; zoneEnCours = z; tB = 0;
    plateau.classList.add('vu');
    dimensionner();

    const seed = ((Date.now() / 1000) | 0) ^ (z.diff * 2654435761);
    const map = window.Battle.generateMap({
      seed, mode: 'personal', playerFaction: 'cats',
      nodeCount: z.noeuds, stage: z.diff,
      w: cvB.width, h: cvB.height,
    });
    const compo = equilibrer(map, z);
    bataille = window.Battle.create({
      canvas: cvB, map, mode: 'personal', playerFaction: 'cats',
      difficulty: 1 + z.diff * 0.06,
      composition: compo,
      enemyLook: { weapon: Math.min(30, z.diff * 2), armor: Math.min(30, z.diff * 2), evo: Math.min(3, (z.diff / 6) | 0) },
      onEvent: evenement,
    });
    /* La compagnie n'est pas là pour être micro-gérée : par défaut l'IA
       du bourg tient la barre, et le joueur reprend la main s'il veut. */
    bataille.setAutoPilot(true);
    E2.expedition = { zone: z.id, prog: 0, sortie: !!z.sortie,
                      nom: (z.sortie ? 'Sortie — ' : 'Expédition — ') + z.nom };
    window.Etat.journal(z.sortie
      ? 'La colonne sort à la rencontre de la Nuée.'
      : 'La colonne part pour ' + z.nom + '.', 'guerre');
    majTete();
  }

  /* ------------------------------------------------------------------
     L'ÉQUILIBRAGE. La carte générée ignore tout du bourg : elle donne au
     joueur une garnison forfaitaire. Or ce qui doit décider d'une
     bataille, c'est LE TRAVAIL DU BOURG — le nombre d'unités formées au
     terrain d'entraînement et le palier d'armement de la forge. On
     réécrit donc la garnison de départ, et l'on cale la garnison adverse
     sur la difficulté de la zone.
     ------------------------------------------------------------------ */
  /* Ce que chaque camp alignera. On l'affiche AVANT le départ : une
     colonne qu'on envoie à l'aveugle est une colonne qu'on regrette. */
  function forces(z) {
    const E2 = E();
    const u = Math.max(1, E2.armee.unites);
    const arme = E2.armee.palierArme || 0;
    const armure = E2.armee.palierArmure || 0;
    const xp = 1 + Math.min(0.8, (E2.armee.xp || 0) / 4000);
    const bourg = Math.round(u * (1 + 0.10 * arme + 0.06 * armure) * xp);
    return { bourg, nuee: Math.round(bourg * (0.50 + 0.075 * z.diff)) };
  }

  function equilibrer(map, z) {
    const E2 = E();
    const u = Math.max(1, E2.armee.unites);
    const arme = E2.armee.palierArme || 0;
    const armure = E2.armee.palierArmure || 0;
    const xp = 1 + Math.min(0.8, (E2.armee.xp || 0) / 4000);

    /* la composition suit l'armement : à mains nues on n'aligne que des
       lanciers ; bien équipé, le bourg sort ses éclaireurs et ses costauds. */
    const compo = ['lancier'];
    if (arme >= 2) compo.push('eclaireur');
    if (arme >= 4) compo.push('costaud');
    if (arme >= 6) compo.push('fronde');
    if (arme >= 9) compo.push('traqueur');

    const total = Math.round(u * (1 + 0.10 * arme + 0.06 * armure) * xp);
    const g = {};
    for (let i = 0; i < compo.length; i++) {
      const part = i === 0 ? 0.55 : (0.45 / (compo.length - 1));
      g[compo[i]] = Math.max(1, Math.round(total * part));
    }
    /* LA DIFFICULTÉ EST UN RAPPORT, pas un coefficient absolu. On mesure
       ce que le bourg aligne, on décide ce que doit aligner la Nuée —
       une fraction aux Basses Berges, le double et plus à l'Aire — et
       l'on renormalise TOUTES les garnisons adverses sur ce total. Le
       joueur sait alors ce qu'il lui manque : des unités, ou une forge. */
    const cible = total * (0.50 + 0.075 * z.diff);
    let somme = 0;
    const adverses = [];
    for (const n of map.nodes) {
      if (n.owner === 'cats' && n.kind === 'hq') { n.garrison = g; n.g = g; continue; }
      const gg = n.garrison || n.g || {};
      let s = 0; for (const k in gg) s += gg[k];
      if (s > 0) { adverses.push({ n, gg, s, hq: n.owner === 'birds' }); somme += s; }
    }
    if (somme > 0) {
      const k = cible / somme;
      for (const a of adverses) {
        /* les positions neutres cèdent plus vite que le quartier général :
           il faut que la carte s'ouvre, sinon la bataille est un mur. */
        const kk = a.hq ? k * 1.15 : k * 0.85;
        for (const t in a.gg) a.gg[t] = Math.max(1, Math.round(a.gg[t] * kk));
      }
    }
    return compo;
  }

  function dimensionner() {
    const r = scene.getBoundingClientRect();
    cvB.width = Math.max(640, Math.min(1440, Math.round(r.width)));
    cvB.height = Math.max(420, Math.min(900, Math.round(r.height)));
    cvB.style.width = ''; cvB.style.height = '';
    if (bataille) bataille.resize();
  }

  function evenement(ev) {
    if (!ev) return;
    if (ev.type === 'victory') terminer(true);
    else if (ev.type === 'defeat') terminer(false);
    else if (ev.type === 'capture') U().dire('Position prise.', 'bien', 1400);
  }

  function terminer(gagne) {
    const z = zoneEnCours;
    const E2 = E();
    E2.expedition = null;
    if (!z) { fermer(); return; }
    if (gagne && z.sortie) {
      /* Une sortie ne rapporte pas de terre : elle rachète du temps. */
      const av = E2.menace;
      E2.menace = Math.max(0, E2.menace - z.gainMenace);
      E2.armee.unites = Math.max(0, E2.armee.unites - Math.ceil(z.cout.unites * 0.30));
      E2.sorties = (E2.sorties || 0) + 1;
      const recu = window.Etat.gagnerLot(z.butin);
      window.Etat.journal('Sortie victorieuse : la Menace retombe de ' +
        Math.round(av - E2.menace) + ' points.', 'guerre');
      U().dire('La Nuée reflue. Menace ' + Math.round(av) + ' → ' + Math.round(E2.menace) + '.', 'bien', 5000);
      montrerBilan(true, z, recu);
    } else if (gagne) {
      if (!estPrise(z.id)) E2.territoires.push(z.id);
      E2.menace = Math.max(0, E2.menace - 45);
      E2.armee.unites = Math.max(0, E2.armee.unites - Math.ceil(z.cout.unites * 0.35));
      E2.armee.garnison += 1;
      const recu = window.Etat.gagnerLot(z.butin);
      window.Etat.journal('Victoire à ' + z.nom + '. Le territoire est au bourg.', 'guerre');
      U().dire('Victoire — ' + z.nom + ' est prise.', 'bien', 5000);
      montrerBilan(true, z, recu);
    } else {
      E2.menace = Math.min(100, E2.menace + (z.sortie ? 4 : 8));
      /* Une défaite coûte des bras, pas la partie : on doit pouvoir
         reformer une colonne et revenir, mieux armé. */
      E2.armee.unites = Math.max(0, E2.armee.unites - Math.ceil(z.cout.unites * 0.45));
      window.Etat.journal('Défaite à ' + z.nom + '. La colonne rentre décimée.', 'alerte');
      U().dire('Défaite. La colonne rentre décimée.', 'alerte', 5000);
      montrerBilan(false, z, null);
    }
    zoneEnCours = null;
    if (bataille) { bataille.destroy(); bataille = null; }
    setTimeout(fermer, 200);
  }

  function montrerBilan(gagne, z, recu) {
    U().ouvrir('bilan-exp', {
      titre: gagne ? 'Territoire pris' : 'La colonne rentre',
      sous: z.nom,
      onglets: [{ id: 'b', nom: 'Bilan', rendu: c => {
        const A = el();
        c.appendChild(A('div', { class: 'note', text: gagne ? z.desc : 'La position tient toujours. Il faudra revenir en nombre.' }));
        if (gagne && z.sortie) {
          c.appendChild(A('div', { class: 'eti-or', text: 'la jauge retombe' }));
          c.appendChild(A('div', { class: 'note',
            text: 'La Menace a perdu ' + z.gainMenace + ' points. Le bourg reprend sa cadence : ' +
                  window.Jeu.palierMenace().nom.toLowerCase() + '.' }));
          c.appendChild(A('div', { class: 'eti-or', text: 'ramassé sur le terrain' }));
          c.appendChild(U().listeRes(recu || {}, { gain: true }));
          c.appendChild(A('div', { class: 'note',
            text: 'Aucun territoire : une sortie ne prend rien, elle rachète du temps.' }));
        } else if (gagne) {
          c.appendChild(A('div', { class: 'eti-or', text: 'avantage permanent' }));
          c.appendChild(A('div', { class: 'note', text: libelleBonus(z) }));
          c.appendChild(A('div', { class: 'eti-or', text: 'butin' }));
          c.appendChild(U().listeRes(recu || {}, { gain: true }));
          c.appendChild(A('div', { class: 'note', text: 'La menace retombe de 45 points, et un détachement reste en garnison.' }));
        } else {
          c.appendChild(A('div', { class: 'note mauvais', text: 'Unités perdues, menace en hausse. Formez du monde au terrain d\'entraînement avant de repartir.' }));
        }
      } }],
    });
  }

  function libelleBonus(z) {
    const b = z.bonus;
    if (b.metier) return 'Toutes les tâches de ' + window.METIERS[b.metier].nom.toLowerCase() +
      ' gagnent ' + Math.round(b.pct * 100) + ' % de cadence.';
    if (b.global) return 'Toutes les cadences du bourg gagnent ' + Math.round(b.global * 100) + ' %.';
    if (b.butin) return 'Le butin de la descente augmente de ' + Math.round(b.butin * 100) + ' %.';
    if (b.menaceTaux) return 'La menace monte ' + Math.round(-b.menaceTaux * 100) + ' % moins vite.';
    return '';
  }

  function fermer() {
    ouvert = false;
    if (plateau) plateau.classList.remove('vu');
    if (bataille) { bataille.destroy(); bataille = null; }
    zoneEnCours = null;
    E().expedition = null;
  }

  function tick(dt) {
    if (!ouvert || !bataille) return;
    tB += dt;
    /* La bataille peut se TERMINER pendant son propre `update` — l'issue
       arrive par événement et détruit l'instance. On garde donc la
       référence et l'on vérifie qu'elle vaut encore quelque chose avant
       de dessiner, sinon on peint dans le vide. */
    const b = bataille;
    try {
      b.update(dt);
      if (bataille === b) b.render();          // toujours vivante : on peint
    } catch (e) { console.warn('bataille :', e.message); }
    if (!bataille) return;
    if (E().expedition) {
      const c = bataille.getControl ? bataille.getControl() : null;
      if (c) E().expedition.prog = Math.min(1, (c.cats || 0) / Math.max(1, (c.cats || 0) + (c.birds || 0)));
    }
    majPied();
  }

  function majTete() {
    const A = el();
    titre.textContent = zoneEnCours ? zoneEnCours.nom : 'Expédition';
    sous.textContent = zoneEnCours ? 'difficulté ' + zoneEnCours.diff + ' · ' + zoneEnCours.noeuds + ' positions' : '';
    U().vide(boutons);
    let auto = true;
    boutons.appendChild(A('button', { class: 'b primaire', text: 'IA aux commandes',
      onclick: function () {
        auto = !auto;
        if (bataille) bataille.setAutoPilot(auto);
        this.textContent = auto ? 'IA aux commandes' : 'Commandes manuelles';
        this.className = 'b' + (auto ? ' primaire' : '');
      } }));
    for (const r of [0.25, 0.5, 1]) {
      boutons.appendChild(A('button', { class: 'b mini', text: Math.round(r * 100) + ' %',
        title: 'Proportion de garnison envoyée à chaque ordre',
        onclick: () => { if (bataille) bataille.setSendRatio(r); } }));
    }
    boutons.appendChild(A('button', { class: 'b danger', text: 'Battre en retraite',
      onclick: () => { if (confirm('Abandonner la bataille ?')) terminer(false); } }));
  }

  function majPied() {
    if (!pied || !bataille) return;
    const c = bataille.getControl ? bataille.getControl() : null;
    U().vide(pied);
    if (c) {
      pied.appendChild(el()('span', { class: 'eti', text: 'contrôle' }));
      pied.appendChild(el()('span', { class: 'puce gain', text: 'Bourg ' + (c.cats || 0) }));
      pied.appendChild(el()('span', { class: 'puce', text: 'Nuée ' + (c.birds || 0) }));
    }
    pied.appendChild(el()('span', { class: 'eti', style: 'margin-left:auto',
      text: 'clic sur une position, puis sur la cible' }));
  }

  function brancherPointeur() {
    if (!cvB || cvB.__brancheB) return;
    cvB.__brancheB = true;
    const pos = ev => {
      const r = cvB.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (cvB.width / r.width),
               y: (ev.clientY - r.top) * (cvB.height / r.height) };
    };
    cvB.addEventListener('pointerdown', ev => { if (!bataille) return; const p = pos(ev); bataille.pointerDown(p.x, p.y); });
    cvB.addEventListener('pointermove', ev => { if (!bataille) return; const p = pos(ev); bataille.pointerMove(p.x, p.y); });
    cvB.addEventListener('pointerup', ev => { if (!bataille) return; const p = pos(ev); bataille.pointerUp(p.x, p.y); });
  }

  /* =================================================================
     LE PANNEAU DU PORTAIL
     ================================================================= */
  function rendre(c) {
    const A = el();
    const E2 = E();
    c.appendChild(A('div', { class: 'cadre' },
      A('div', { class: 'rangee entre' },
        A('span', { class: 'tt', text: E2.armee.unites + ' unités formées' }),
        A('span', { class: 'eti-or', text: prises().length + ' / ' + ZONES.length + ' territoires' })),
      A('div', { class: 'note', style: 'margin-top:6px',
        text: "Les unités se forment au terrain d'entraînement, et il faut une arme par recrue. Une victoire coûte du monde : la compagnie ne rentre jamais entière." })));

    if (E2.expedition) {
      c.appendChild(A('div', { class: 'cadre actif' },
        A('div', { class: 'tt', text: 'Bataille en cours' }),
        A('div', { style: 'margin-top:7px' },
          A('button', { class: 'b primaire', text: 'Rejoindre la bataille', onclick: () => {
            refs(); ouvert = true; plateau.classList.add('vu'); majTete(); brancherPointeur();
          } }))));
    }

    for (const z of ZONES) {
      const pris = estPrise(z.id);
      const dispo = !pris && ZONES.filter(y => !estPrise(y.id)).indexOf(z) === 0;
      const assezU = E2.armee.unites >= z.cout.unites;
      const cout = {}; for (const k in z.cout) if (k !== 'unites') cout[k] = z.cout[k];
      c.appendChild(A('div', { class: 'cadre' + (pris ? ' actif' : (dispo ? '' : ' mort')) },
        A('div', { class: 'rangee entre' },
          A('span', { class: 'tt', text: z.nom }),
          A('span', { class: 'eti', text: pris ? 'tenue' : 'difficulté ' + z.diff })),
        A('div', { class: 'note', style: 'margin-top:4px', text: z.desc }),
        A('div', { class: 'note', style: 'margin-top:4px' },
          A('em', { text: libelleBonus(z) })),
        pris ? null : (function () {
          const f = forces(z);
          const ecart = f.bourg / Math.max(1, f.nuee);
          const mot = ecart > 1.5 ? 'nette supériorité' : ecart > 1.1 ? 'avantage au bourg'
                    : ecart > 0.85 ? 'combat serré' : ecart > 0.6 ? 'désavantage' : 'suicidaire';
          const bloc = A('div', { style: 'margin-top:8px' });
          bloc.appendChild(U().barre(Math.min(1, ecart / 2), 'grande ' + (ecart > 1.1 ? 'vert' : (ecart > 0.85 ? '' : 'rouge')),
            'la colonne ≈ ' + f.bourg, 'la Nuée ≈ ' + f.nuee));
          bloc.appendChild(A('div', { class: 'rangee entre', style: 'margin-top:5px' },
            A('span', { class: 'eti', text: 'ce que le bourg alignera' }),
            A('span', { class: ecart > 1.1 ? 'eti-or' : 'eti mauvais', text: mot })));
          /* la COMPOSITION dépend du palier d'armement : on la montre, sinon
             le joueur ne sait pas ce que la forge lui a réellement apporté. */
          const arme = E().armee.palierArme || 0;
          const compo = ['lancier'];
          if (arme >= 2) compo.push('eclaireur');
          if (arme >= 4) compo.push('costaud');
          if (arme >= 6) compo.push('fronde');
          if (arme >= 9) compo.push('traqueur');
          const noms = { lancier: 'lanciers', eclaireur: 'éclaireurs', costaud: 'costauds',
                         fronde: 'frondeurs', traqueur: 'traqueurs' };
          bloc.appendChild(A('div', { class: 'rangee enroule', style: 'margin-top:6px' },
            A('span', { class: 'eti', text: 'composition' }),
            compo.map(t => A('span', { class: 'puce mini gain', text: noms[t] || t })),
            arme < 9 ? A('span', { class: 'note faible',
              text: 'palier ' + (arme + 1) + ' d\'armement : un type de plus' }) : null));
          return bloc;
        })(),
        pris ? null : A('div', { class: 'rangee entre', style: 'margin-top:8px;flex-wrap:wrap' },
          A('div', { class: 'rangee', style: 'flex-wrap:wrap' },
            A('span', { class: 'puce' + (assezU ? '' : ' insuffisant'), text: z.cout.unites + ' unités' }),
            U().listeRes(cout, { verifier: true, rien: '' })),
          A('button', { class: 'b primaire', text: 'Lancer la colonne',
            disabled: !dispo || !assezU || !window.Etat.assez(cout) || !!E2.expedition,
            onclick: () => lancer(z.id) }))));
    }
  }

  addEventListener('resize', () => { if (ouvert && bataille) dimensionner(); });

  window.UIExpedition = { rendre, ouvrir: () => { refs(); if (E().expedition) { ouvert = true; plateau.classList.add('vu'); majTete(); brancherPointeur(); } },
    fermer, tick, ZONES, bonusMetier, bonusButin, facteurMenace, estPrise, prises,
    lancerSortie, zoneSortie, forces };
  window.Expedition = { tick, bonusMetier, bonusButin, facteurMenace, lancerSortie, zoneSortie, forces };

})();
