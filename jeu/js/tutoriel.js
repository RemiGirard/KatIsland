/* ============================================================
   LE BOURG — js/tutoriel.js
   Biscotte, conseiller du nouveau bourg.

   Deux fils restent volontairement séparés :
   · le parcours principal conduit aux premières sorties en moins de 20 min ;
   · les conseils contextuels présentent un bâtiment ou un nouvel onglet,
     puis rendent la parole à l'objectif principal.
   ============================================================ */
"use strict";
(function () {

  const E = () => window.Etat.E;
  const CHAT = 'chat/';
  let racine, portrait, bulle, surtitre, titre, texte, objectif, progression;
  let boutonAction, boutonSuite, boutonReplier, minuterieSprite = 0, animationCourante = '';
  let contexte = null, fileContextes = [], remarque = null, minuterieRemarque = 0;
  let derniereRemarqueReelle = 0;
  let initialise = false, etapeAffichee = null;

  const aBat = type => window.Etat.aBatiment(type);
  const bat = type => Object.values(E().bat).find(b => b.type === type && !b.chantier);
  const vu = res => !!E().vus['res:' + res] || window.Etat.qte(res) > 0;
  const naviresPartis = () => E().port && E().port.navires &&
    E().port.navires.some(n => n.etat !== 'quai');
  const descenteLancee = () => {
    try {
      const g = window.GameState && window.GameState.gen && window.GameState.gen();
      return !!(g && (g.descent || (g.tally && g.tally.descents > 0)));
    } catch (e) { return false; }
  };

  /* La colonne « minute » documente le rythme visé. Elle ne chronomètre pas
     le joueur : elle garantit que les prérequis ne forment jamais un mur. */
  const ETAPES = [
    {
      id:'bienvenue', minute:0, sprite:['neutre','parle'],
      surtitre:'BIENVENUE AU BOURG', titre:'Moi, c’est Biscotte.',
      texte:"Je vais rester près de toi. On va nourrir le bourg, lui donner un toit, former une première compagnie, puis ouvrir la Tour et la mer.",
      objectif:"Notre première expédition et notre première descente sont à portée de patte.",
      fini:() => !!T().introValidee, suite:"C’est parti",
    },
    {
      id:'pecherie', minute:1, sprite:['construire','neutre'],
      surtitre:'ÉTAPE 1 · SE NOURRIR', titre:'Construis la Pêcherie',
      texte:"Ouvre « Construire » dans le volet de droite, choisis Récolte puis pose la Pêcherie. Elle ne coûte rien et le maître d’œuvre lance automatiquement le chantier.",
      objectif:'Pêcherie construite', fini:() => aBat('pecherie'), action:'construction', actionTexte:'Ouvrir Construire',
    },
    {
      id:'poisson', minute:3, sprite:['parle','attend'],
      surtitre:'ÉTAPE 2 · PRODUIRE', titre:'Ramène 15 poissons',
      texte:"Clique la Pêcherie, affecte un habitant au poste et choisis « Pêche au filet ». Une barre dans le menu de gauche montre chaque travail en cours.",
      objectif:'15 poissons débloquent la Scierie', fini:() => aBat('scierie') || window.Etat.qte('poisson') >= 15,
      progres:() => [window.Etat.qte('poisson'),15,'poissons'], action:'pecherie', actionTexte:'Voir la Pêcherie',
    },
    {
      id:'habitant', minute:4, sprite:['parle','surpris'],
      surtitre:'ÉTAPE 3 · ACCUEILLIR', titre:'Ouvre déjà les portes du bourg',
      texte:"Tu as deux couchages dès le départ, donc une place est déjà libre. Ouvre Habitants puis Portes, rassemble 18 portions de vivres et compare les trois voyageurs avant d’en accueillir un.",
      objectif:'Accueillir un deuxième habitant', fini:() => E().habitants.length >= 2,
      progres:() => [E().habitants.length,2,'habitants'], action:'portes', actionTexte:'Voir les Portes',
    },
    {
      id:'scierie', minute:5, sprite:['construire','parle'],
      surtitre:'ÉTAPE 4 · LE BOIS', titre:'Construis la Scierie',
      texte:"Le plan vient d’apparaître dans Récolte. Pose la Scierie : le chantier avance seul pendant que ton habitant continue de produire.",
      objectif:'Scierie construite', fini:() => aBat('scierie'), action:'construction', actionTexte:'Ouvrir Construire',
    },
    {
      id:'bois', minute:7, sprite:['parle','lire'],
      surtitre:'ÉTAPE 5 · PRÉPARER LE BOURG', titre:'Commence la coupe du bois',
      texte:"Dans la Scierie, l’onglet Chaîne contient « Abattre en lisière ». Affecte un habitant et lance cette tâche en boucle.",
      objectif:'Produire les premières bûches', fini:() => vu('bois'), action:'scierie', actionTexte:'Voir la Scierie',
    },
    {
      id:'maison', minute:10, sprite:['construire','neutre'],
      surtitre:'ÉTAPE 6 · UN TOIT', titre:'Construis une Maison',
      texte:"Tes deux paillasses de départ sont occupées. Une Maison ajoute une vraie place au bourg : réunis 34 bois puis pose-la depuis la catégorie Vie.",
      objectif:'Maison construite', fini:() => aBat('maison'), progres:() => [window.Etat.qte('bois'),34,'bois'],
      action:'construction', actionTexte:'Ouvrir Construire',
    },
    {
      id:'caserne', minute:14, sprite:['construire','parle'],
      surtitre:'ÉTAPE 7 · SE PRÉPARER', titre:'Construis la Caserne',
      texte:"La Caserne ne demande que du bois et du poisson. Pose-la sans interrompre les ateliers : le maître d’œuvre s’occupe du chantier.",
      objectif:'Caserne construite', fini:() => aBat('caserne'), action:'construction', actionTexte:'Ouvrir Construire',
    },
    {
      id:'unite', minute:16, sprite:['parle','attend'],
      surtitre:'ÉTAPE 8 · PREMIÈRE RECRUE', titre:'Forme une unité',
      texte:"Dans la Caserne, affecte un habitant puis choisis une formation simple. Les lanciers et éclaireurs ne demandent encore que du bois et du poisson.",
      objectif:'Une unité prête', fini:() => E().armee.unites >= 1,
      progres:() => [E().armee.unites,1,'unité'], action:'caserne', actionTexte:'Voir la Caserne',
    },
    {
      id:'tour', minute:18, sprite:['peur','parle'],
      surtitre:'PREMIÈRE AVENTURE', titre:'Prépare une descente dans la Tour',
      texte:"La Tour sombre était déjà sur l’île. Clique-la, crée une équipe avec tes habitants, vérifie le ravitaillement puis confirme la descente. Les habitants ne quittent leur poste qu’au départ.",
      objectif:'Lancer la première descente', fini:descenteLancee, action:'descente', actionTexte:'Ouvrir la Tour',
    },
    {
      id:'port', minute:18, sprite:['construire','parle'],
      surtitre:'PRENDRE LA MER', titre:'Construis le Port',
      texte:"La Maison et la Caserne ont révélé le Port. Réunis bois et poisson : la première barque est offerte avec le bâtiment.",
      objectif:'Port construit', fini:() => aBat('port'), action:'construction', actionTexte:'Ouvrir Construire',
    },
    {
      id:'expedition', minute:20, sprite:['lire','parle'],
      surtitre:'PREMIÈRE EXPÉDITION', titre:'Fais appareiller la barque',
      texte:"Au Port : ouvre Flotte, charge des unités dans la Cale, choisis une île à portée sur la carte, puis Appareiller. Le bateau avancera réellement sur sa route.",
      objectif:'Une barque en mer', fini:() => naviresPartis() || !!(E().port && E().port.expeditions),
      action:'port', actionTexte:'Ouvrir le Port',
    },
    {
      id:'libre', minute:20, sprite:['valide','rigole'],
      surtitre:'LE BOURG EST LANCÉ', titre:'À toi de choisir la suite',
      texte:"Tu sais produire, bâtir, accueillir, descendre dans la Tour et prendre la mer. Je resterai ici pour présenter les nouveaux bâtiments et les onglets qui se débloquent.",
      objectif:'Parcours d’accueil terminé', fini:() => false, final:true,
    },
  ];

  /* Des apartés très courts, liés à un geste réel. Les événements fréquents
     (poste, cycle) passent en plus par un tirage : Biscotte a une personnalité,
     pas une notification vocale pour chaque poisson. */
  const REPLIQUES = {
    construit: [
      { texte:"Ça tient debout ! Je n’en doutais presque pas.", sprite:['applaudit','valide'] },
      { texte:"Un toit de plus et déjà trois fois plus de choses à ranger.", sprite:['applaudit','neutre'] },
      { texte:"Joli chantier. Les murs sont droits… de suffisamment loin.", sprite:['rigole','applaudit'] },
      { texte:"J’ai supervisé depuis une caisse. C’était extrêmement technique.", sprite:['ecrire','valide'] },
      { texte:"Bâtiment terminé ! Ne lèche pas les murs, la chaux est encore fraîche.", sprite:['surpris','rigole'] },
      { texte:"Une inauguration sans ruban ? Très bien, je mâcherai la ficelle.", sprite:['doute','applaudit'] },
    ],
    ameliore: [
      { texte:"Plus grand, plus efficace… toujours pas de coussin pour le conseiller.", sprite:['applaudit','doute'] },
      { texte:"Ce bâtiment prend de l’allure. Et de la place.", sprite:['valide','applaudit'] },
      { texte:"Nouveau niveau, nouvelles languettes à renifler.", sprite:['lire','reflechit'] },
      { texte:"Ils ont ajouté un étage. Mes petits escaliers sont toujours en attente.", sprite:['doute','parle'] },
      { texte:"Plus solide, plus joli, et officiellement approuvé par une patte humide.", sprite:['valide','rigole'] },
    ],
    affectation: [
      { texte:"Bonne patte, bon poste. Enfin, normalement.", sprite:['reflechit','neutre'] },
      { texte:"Un habitant occupé, c’est une barre qui avance.", sprite:['ecrire','valide'] },
      { texte:"Je note l’affectation. Avec une écriture parfaitement officielle.", sprite:['ecrire','parle'] },
      { texte:"Le poste est pourvu. Moi, je reste conseiller : c’est un poste assis.", sprite:['dors','rigole'] },
      { texte:"Une patte sur l’outil, l’autre déjà tournée vers la pause.", sprite:['attend','neutre'] },
    ],
    poste: [
      { texte:"Une nouvelle tâche ? Mes moustaches approuvent ce planning.", sprite:['ecrire','valide'] },
      { texte:"Ça va travailler. Je me place à une distance très prudente.", sprite:['courir','neutre'] },
      { texte:"Bon choix. Si ça casse, je dirai que je n’étais pas là.", sprite:['doute','rigole'] },
      { texte:"La boucle est lancée. Si quelqu’un demande, tout était prévu.", sprite:['valide','doute'] },
      { texte:"Excellent. Je surveille le travail depuis ce rayon de soleil.", sprite:['dors','neutre'] },
    ],
    poisson: [
      { texte:"Ça sent la marée jusque dans mes moustaches.", sprite:['mange','neutre'] },
      { texte:"Encore un poisson et j’exige une part de conseiller.", sprite:['mange','parle'] },
      { texte:"La rivière travaille gratuitement. J’aime beaucoup son contrat.", sprite:['rigole','neutre'] },
      { texte:"Celui-là me regardait. Je l’ai vaincu administrativement.", sprite:['doute','valide'] },
      { texte:"Une réserve de poisson est une réserve de moral. Surtout le mien.", sprite:['mange','rigole'] },
    ],
    bois: [
      { texte:"Belle pile de bois. Pas le moment d’y faire mes griffes.", sprite:['doute','neutre'] },
      { texte:"Chaque bûche ressemble déjà un peu à une maison.", sprite:['reflechit','valide'] },
      { texte:"La scierie ronronne presque aussi fort que moi.", sprite:['dors','rigole'] },
      { texte:"Bois sec, plan droit, conseiller pas dessous : parfait.", sprite:['valide','surpris'] },
      { texte:"Je comptais les bûches, puis l’une d’elles a bougé. J’ai recommencé.", sprite:['doute','ecrire'] },
    ],
    production: [
      { texte:"Ce petit bruit-là, c’est le son d’un poste qui tourne bien.", sprite:['attend','valide'] },
      { texte:"Les réserves montent. Doucement, mais avec beaucoup de sérieux.", sprite:['ecrire','neutre'] },
      { texte:"Un cycle terminé. Personne n’a perdu de moustache : excellent bilan.", sprite:['valide','rigole'] },
      { texte:"Les chiffres montent. Je prétends que c’est grâce à mon tableau.", sprite:['ecrire','rigole'] },
      { texte:"Le bourg produit, moi je contrôle la qualité des siestes.", sprite:['dors','valide'] },
    ],
    portes: [
      { texte:"Trois candidats, une place. Aucun stress. Enfin… presque.", sprite:['surpris','reflechit'] },
      { texte:"Regarde les traits avant la jolie frimousse. Oui, je sais, c’est difficile.", sprite:['reflechit','parle'] },
      { texte:"Choisis avec le cœur. Puis vérifie quand même le talent.", sprite:['reflechit','valide'] },
      { texte:"Trois voyageurs ! Cache les coussins, ça donne l’air prospère.", sprite:['surpris','rigole'] },
    ],
    habitant: [
      { texte:"Bienvenue au bourg ! J’ai caché les formulaires sous le paillasson.", sprite:['applaudit','rigole'] },
      { texte:"Une bouche de plus, deux pattes de plus et beaucoup plus d’avis.", sprite:['surpris','parle'] },
      { texte:"Le bourg grandit. Mon autorité aussi, théoriquement.", sprite:['valide','doute'] },
      { texte:"Un nouveau voisin ! Je vais lui expliquer qui possède ce coussin.", sprite:['mange','rigole'] },
    ],
    recherche: [
      { texte:"Une nouvelle idée ! Je savais que fixer ce parchemin finirait par marcher.", sprite:['reflechit','valide'] },
      { texte:"Le savoir ne prend pas de place dans l’entrepôt. Très pratique.", sprite:['lire','rigole'] },
      { texte:"Recherche terminée. J’avais la même idée hier, mais sans les détails.", sprite:['ecrire','doute'] },
      { texte:"La science avance. Moi aussi, mais seulement jusqu’au prochain coussin.", sprite:['lire','dors'] },
    ],
  };

  function T() {
    if (!E().tutoriel) E().tutoriel = { version:1, actif:true, replie:false,
      introValidee:false, terminees:{}, contextesVus:{}, ongletsVus:{} };
    return E().tutoriel;
  }

  function element(tag, classe, contenu) {
    const n = document.createElement(tag);
    if (classe) n.className = classe;
    if (contenu != null) n.textContent = contenu;
    return n;
  }

  function construireInterface() {
    if (racine) return;
    racine = element('aside', 'conseiller');
    racine.id = 'conseiller';
    racine.setAttribute('aria-live', 'polite');
    racine.setAttribute('aria-label', 'Biscotte, conseiller du bourg');

    portrait = element('button', 'conseiller-portrait');
    portrait.type = 'button'; portrait.title = 'Écouter Biscotte';
    portrait.addEventListener('click', () => {
      T().replie = false; rendre(); sauver();
    });
    portrait.appendChild(element('img'));
    portrait.appendChild(element('span', 'conseiller-signal', '!'));

    bulle = element('section', 'conseiller-bulle');
    const tete = element('div', 'conseiller-tete');
    const identite = element('div');
    identite.appendChild(element('b', '', 'Biscotte'));
    identite.appendChild(element('span', '', 'Conseiller du bourg'));
    boutonReplier = element('button', 'conseiller-replier', '−');
    boutonReplier.type = 'button'; boutonReplier.title = 'Réduire le conseil';
    boutonReplier.addEventListener('click', () => {
      T().replie = true; rendre(); sauver();
    });
    tete.append(identite, boutonReplier);
    surtitre = element('div', 'conseiller-surtitre');
    titre = element('h2');
    texte = element('p', 'conseiller-texte');
    objectif = element('div', 'conseiller-objectif');
    progression = element('div', 'conseiller-progression');
    const actions = element('div', 'conseiller-actions');
    boutonAction = element('button', 'conseiller-action'); boutonAction.type = 'button';
    boutonAction.addEventListener('click', agir);
    boutonSuite = element('button', 'conseiller-suite'); boutonSuite.type = 'button';
    boutonSuite.addEventListener('click', avancer);
    actions.append(boutonAction, boutonSuite);
    bulle.append(tete, surtitre, titre, texte, objectif, progression, actions);
    racine.append(bulle, portrait);
    document.body.appendChild(racine);
  }

  function etapeCourante() {
    const t = T();
    for (const e of ETAPES) {
      if (e.final) return e;
      if (t.terminees[e.id]) continue;
      let fini = false;
      try { fini = e.fini(); } catch (er) { fini = false; }
      if (fini) { t.terminees[e.id] = true; continue; }
      return e;
    }
    return ETAPES[ETAPES.length - 1];
  }

  function animer(sprites) {
    const liste = (sprites && sprites.length ? sprites : ['neutre']);
    const signature = liste.join('|');
    if (signature === animationCourante) return;
    animationCourante = signature;
    clearInterval(minuterieSprite);
    let i = 0;
    const changer = () => {
      if (!portrait) return;
      portrait.querySelector('img').src = CHAT + liste[i++ % liste.length] + '.png';
    };
    changer();
    if (liste.length > 1) minuterieSprite = setInterval(changer, 680);
  }

  function rendreProgression(e) {
    progression.replaceChildren();
    if (!e || !e.progres) { progression.hidden = true; return; }
    let p;
    try { p = e.progres(); } catch (er) { p = null; }
    if (!p) { progression.hidden = true; return; }
    progression.hidden = false;
    const valeur = Math.max(0, Number(p[0]) || 0), cible = Math.max(1, Number(p[1]) || 1);
    const ligne = element('div');
    ligne.append(element('span', '', p[2] || ''), element('b', '', Math.min(valeur,cible) + ' / ' + cible));
    const barre = element('i'); barre.appendChild(element('span'));
    barre.firstChild.style.width = Math.min(100, valeur / cible * 100) + '%';
    progression.append(ligne, barre);
  }

  function rendre() {
    if (!racine) return;
    const t = T(), e = etapeCourante();
    const affiche = contexte || remarque || e;
    etapeAffichee = e;
    racine.classList.toggle('replie', !!t.replie);
    racine.classList.toggle('contexte', !!contexte);
    racine.classList.toggle('remarque', !!remarque && !contexte);
    racine.hidden = !t.actif;
    portrait.querySelector('.conseiller-signal').textContent = contexte ? '!' : (remarque ? '…' : (e.final ? '✓' : '•'));
    surtitre.textContent = affiche.surtitre || (contexte ? 'BON À SAVOIR' : (remarque ? 'BISCOTTE MARMONNE…' : 'PROCHAINE ÉTAPE'));
    titre.textContent = affiche.titre || '';
    titre.hidden = !affiche.titre;
    texte.textContent = affiche.texte || '';
    objectif.textContent = affiche.objectif || '';
    objectif.hidden = !affiche.objectif;
    rendreProgression((contexte || remarque) ? null : e);
    boutonAction.hidden = !!contexte || !!remarque || !e.action;
    boutonAction.textContent = e.actionTexte || 'Voir';
    boutonSuite.hidden = !!remarque || (!contexte && !e.suite && !e.final);
    boutonSuite.textContent = contexte ? 'Compris' : (e.suite || (e.final ? 'Réduire' : 'Continuer'));
    animer(affiche.sprite || e.sprite);
  }

  function avancer() {
    if (contexte) {
      if (contexte.id) T().contextesVus[contexte.id] = true;
      contexte = fileContextes.shift() || null;
      rendre(); sauver(); return;
    }
    const e = etapeAffichee || etapeCourante();
    if (e.id === 'bienvenue') T().introValidee = true;
    else if (e.final) T().replie = true;
    rendre(); sauver();
  }

  function ouvrirType(type) {
    const b = bat(type);
    if (b && window.UIFen) window.UIFen.ouvrirBatiment(b.id);
  }

  function agir() {
    const e = etapeAffichee || etapeCourante();
    if (!e.action) return;
    if (e.action === 'construction') {
      const bouton = document.querySelector('.pilotage-construction');
      if (bouton) bouton.click();
    } else if (e.action === 'portes') {
      if (window.UIFen) window.UIFen.ouvrirHabitants('portes');
    } else ouvrirType(e.action);
  }

  function sauver() { if (window.Etat && window.Etat.sauver) window.Etat.sauver(true); }

  function ajouterContexte(c) {
    if (!c || !c.id || T().contextesVus[c.id]) return;
    if ((contexte && contexte.id === c.id) || fileContextes.some(x => x.id === c.id)) return;
    if (remarque) {
      clearTimeout(minuterieRemarque); remarque = null;
    }
    if (contexte) fileContextes.push(c); else contexte = c;
    /* Un nouveau conseil allume le badge, sans annuler le choix du joueur
       s'il a volontairement réduit Biscotte. */
    rendre();
  }

  function petiteRemarque(groupe, chance) {
    const choix = REPLIQUES[groupe];
    if (!choix || !choix.length || contexte || fileContextes.length || remarque) return;
    const maintenant = Date.now();
    /* Une minute réelle minimum entre deux apartés. Les événements rares
       passent toujours ce filtre ; les événements fréquents ont aussi un dé. */
    if (maintenant - derniereRemarqueReelle < 65000) return;
    if (chance != null && Math.random() > chance) return;
    const t = T();
    if (!t.remarquesRecentes) t.remarquesRecentes = [];
    let candidats = choix.filter(x => !t.remarquesRecentes.includes(x.texte));
    if (!candidats.length) candidats = choix.slice();
    const r = candidats[(Math.random() * candidats.length) | 0];
    t.remarquesRecentes.push(r.texte);
    if (t.remarquesRecentes.length > 7) t.remarquesRecentes.shift();
    derniereRemarqueReelle = maintenant;
    remarque = r;
    rendre();
    clearTimeout(minuterieRemarque);
    minuterieRemarque = setTimeout(() => {
      remarque = null;
      rendre(); sauver();
    }, 5600);
  }

  function nomsOnglets(bid) {
    if (!window.UIFen || !window.UIFen.ongletsBatiment) return [];
    const b = E().bat[bid]; if (!b) return [];
    return window.UIFen.ongletsBatiment(bid)
      .filter(o => (o.niveau || 1) <= b.niv).map(o => o.nom);
  }

  function batimentOuvert(bid) {
    if (!initialise || !T().actif) return;
    const b = E().bat[bid]; if (!b) return;
    const type = b.type, nom = (window.BAT[type] || {}).nom || type;
    if (type === 'port') {
      ajouterContexte({ id:'batiment:port', sprite:['lire','parle'], surtitre:'LE PORT',
        titre:'Une carte, deux commandes',
        texte:"Flotte prépare les navires et ouvre leur Cale. Chantier améliore portée et vitesse. Sur la carte, choisis ensuite une île : la fiche de droite donnera l’ordre d’appareiller." });
      return;
    }
    if (type === 'descente') {
      ajouterContexte({ id:'batiment:descente', sprite:['peur','parle'], surtitre:'LA TOUR SOMBRE',
        titre:'Les équipes de la Tour',
        texte:"Crée ici des groupes de quatre habitants maximum. Les enregistrer ne coupe pas leur travail au bourg : ils quittent leur poste seulement quand tu confirmes une descente." });
      return;
    }
    const noms = nomsOnglets(bid);
    const deja = T().ongletsVus[type] || [];
    const nouveaux = noms.filter(n => !deja.includes(n));
    T().ongletsVus[type] = Array.from(new Set(deja.concat(noms)));
    if (!T().contextesVus['batiment:' + type]) {
      ajouterContexte({ id:'batiment:' + type, sprite:['lire','parle'],
        surtitre:'PREMIÈRE VISITE · ' + nom.toUpperCase(), titre:'Voici ses onglets',
        texte:(noms.length ? noms.join(' · ') + '. ' : '') +
          "Les languettes illustrées à gauche du volet séparent les fonctions. Les prochaines apparaîtront automatiquement avec les niveaux du bâtiment." });
    } else if (nouveaux.length) expliquerNouveauxOnglets(type, nom, nouveaux);
    sauver();
  }

  function expliquerNouveauxOnglets(type, nom, noms) {
    const cle = 'onglets:' + type + ':' + noms.join('|');
    ajouterContexte({ id:cle, sprite:['valide','parle'], surtitre:'NOUVELLE FONCTION · ' + nom.toUpperCase(),
      titre:noms.length > 1 ? 'De nouveaux onglets !' : 'Un nouvel onglet !',
      texte:noms.join(' · ') + (noms.length > 1 ? ' sont maintenant disponibles.' : ' est maintenant disponible.') +
        " Ouvre le bâtiment : sa nouvelle languette est déjà visible." });
  }

  function reagir(quoi, data) {
    if (!initialise || !T().actif) return;
    if (quoi === 'deblocage' && window.BAT[data]) {
      ajouterContexte({ id:'deblocage:' + data, sprite:['valide','construire'], surtitre:'NOUVEAU PLAN',
        titre:window.BAT[data].nom + ' débloqué',
        texte:"Le plan vient d’apparaître dans Construire. Tu le trouveras dans sa catégorie, dans le volet de droite." });
    } else if (quoi === 'ameliore' && data) {
      const noms = nomsOnglets(data.id), vus = T().ongletsVus[data.type] || [];
      const nouveaux = noms.filter(n => !vus.includes(n));
      T().ongletsVus[data.type] = Array.from(new Set(vus.concat(noms)));
      if (nouveaux.length) expliquerNouveauxOnglets(data.type, window.BAT[data.type].nom, nouveaux);
    } else if (quoi === 'habitant' && E().habitants.length > 1) {
      ajouterContexte({ id:'mecanique:habitants', sprite:['valide','parle'], surtitre:'NOUVEL HABITANT',
        titre:'Une paire de pattes en plus',
        texte:"Chaque habitant ne peut tenir qu’un poste à la fois. Son talent, son niveau et ses traits changent son rendement : garde les bons profils pour les tâches importantes." });
    } else if (quoi === 'debordement' && data) {
      ajouterContexte({ id:'mecanique:debordement', sprite:['doute','parle'], surtitre:'RÉSERVES PLEINES',
        titre:'Ce qui déborde est perdu',
        texte:"Chaque famille de ressources possède une limite. Une Grange garde davantage de vivres ; les entrepôts protégeront ensuite les matières et les ouvrages." });
    } else if (quoi === 'raid') {
      ajouterContexte({ id:'mecanique:raid', sprite:['peur','parle'], surtitre:'LA NUÉE ATTAQUE',
        titre:'Surveille la Menace',
        texte:"La jauge monte avec le bourg. Caserne, garnison et défenses encaissent les raids ; les victoires maritimes font réellement retomber la Menace." });
    } else if (quoi === 'port' && data && data.etat === 'mer') {
      ajouterContexte({ id:'mecanique:navire-mer', sprite:['valide','parle'], surtitre:'CAP AU LARGE',
        titre:'Le bateau est bien parti',
        texte:"Sa silhouette avance maintenant sur la route dessinée. Tu peux fermer la carte : le voyage continue, et Biscotte te préviendra au mouillage." });
    } else if (quoi === 'port' && data && data.etat === 'mouillage') {
      ajouterContexte({ id:'mecanique:mouillage', sprite:['lire','parle'], surtitre:'TERRE EN VUE',
        titre:'La bataille attend ton ordre',
        texte:"Le navire ne combat jamais tout seul. Rouvre la carte, sélectionne l’île atteinte puis lance l’expédition quand ta colonne est prête." });
    }
    /* Les remarques viennent APRÈS les explications : si un événement a
       ouvert un vrai conseil, petiteRemarque se retire immédiatement. */
    if (quoi === 'construit' && data && data.type !== 'descente') petiteRemarque('construit', 1);
    else if (quoi === 'ameliore') petiteRemarque('ameliore', 1);
    else if (quoi === 'affectation') petiteRemarque('affectation', .38);
    else if (quoi === 'poste') petiteRemarque('poste', .24);
    else if (quoi === 'portes' && data) petiteRemarque('portes', .65);
    else if (quoi === 'habitant' && E().habitants.length > 1) petiteRemarque('habitant', .8);
    else if (quoi === 'recherche') petiteRemarque('recherche', .8);
    else if (quoi === 'cycle' && data) {
      const recu = data.recu || {};
      petiteRemarque(recu.poisson ? 'poisson' : (recu.bois ? 'bois' : 'production'), .055);
    }
    rendre();
  }

  function init() {
    if (initialise) return;
    initialise = true;
    T(); construireInterface(); rendre();
    window.Etat.abonner(reagir);
    /* Les ressources et files évoluent en continu, sans toujours publier un
       événement de panneau. Une vérification légère garde l'objectif exact. */
    setInterval(() => { if (initialise && T().actif) rendre(); }, 900);
  }

  window.Tutoriel = { init, batimentOuvert, rafraichir:rendre };
})();
