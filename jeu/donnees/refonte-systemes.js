/* ============================================================
   LE BOURG — donnees/refonte-systemes.js
   Passe d'enrichissement transversale.

   Ce fichier complète les tables historiques sans les dupliquer :
   trouvailles rares, chaîne d'outillage, recettes avancées et bâtiments
   qui rendent le village vivant. Il est chargé AVANT l'état afin que les
   nouvelles ressources existent aussi dans les nouvelles sauvegardes.
   ============================================================ */
"use strict";
(function () {
  const R = window.RES, REC = window.REC, BAT = window.BAT;
  if (!R || !REC || !BAT) return;

  function res(id, nom, cat, tier, val, forme, couleurs, desc, image) {
    if (R[id]) return R[id];
    R[id] = { id, nom, cat, tier, val, ico:{ f:forme, c:couleurs }, desc:desc || '' };
    if (image) R[id].image = image;
    window.RES_ORDRE.push(id);
    return R[id];
  }
  function recette(id, o) {
    o.id = id; o.duree = o.duree || 10; o.in = o.in || {}; o.out = o.out || {};
    o.loot = o.loot || []; o.niv = o.niv || 1; o.xp = o.xp || Math.round(o.duree * 1.4);
    REC[id] = o;
    const b = BAT[o.bat];
    if (b && b.recettes.indexOf(id) < 0) b.recettes.push(id);
    return o;
  }
  function batiment(id, o, apres) {
    if (BAT[id]) return BAT[id];
    o.id = id; o.nivMax = o.nivMax || 8; o.postes = o.postes || [0];
    o.recettes = o.recettes || []; o.cout = o.cout || {}; o.temps = o.temps || 30;
    o.rangees = o.rangees || [1,2]; o.gen = o.gen || id;
    BAT[id] = o;
    const ordre = window.BAT_ORDRE;
    const k = apres ? ordre.indexOf(apres) : -1;
    if (k >= 0) ordre.splice(k + 1, 0, id); else ordre.push(id);
    return o;
  }

  /* ------------------------------------------------------------
     TROUVAILLES : cinq champignons au total. Le premier reste commun ;
     les quatre suivants ne sont jamais produits par un bâtiment.
     ------------------------------------------------------------ */
  res('champignon_lune', 'Chanterelle lunaire', 'vivres', 2, 32, 'champignon',
      ['#85b7d8','#dcebf2'], "Elle ne pousse qu'à l'ombre des vieux troncs et luit juste assez pour attirer les curieux.",
      'img/res/champignon_lune/champignon_lune.png');
  res('champignon_azur', 'Morille d’azur', 'vivres', 3, 95, 'champignon',
      ['#566fbd','#b5c8ff'], "Rare, froide au toucher et excellente tant que personne ne demande pourquoi.",
      'img/res/champignon_azur/champignon_azur.png');
  res('champignon_reine', 'Amanite royale', 'profond', 4, 360, 'champignon',
      ['#9d55b8','#e5c4ef'], "Une couronne violette sur un pied d'ivoire. L'alchimiste exige deux témoins avant d'ouvrir le panier.",
      'img/res/champignon_reine/champignon_reine.png');
  res('champignon_astre', 'Truffe des astres', 'profond', 5, 1450, 'champignon',
      ['#edc55e','#584b86'], "On la trouve là où la Nuée a dormi. Une seule parfume une marmite et trois rues.",
      'img/res/champignon_astre/champignon_astre.png');

  /* Ressources de transformation que le village ne sait pas fabriquer. */
  res('poussiere_trempe', 'Poussière de trempe', 'profond', 2, 90, 'tas',
      ['#7396aa','#d0e5ec'], "Poudre métallique rapportée d'expédition. Elle révèle les propriétés cachées d'une pièce d'équipement.",
      'img/res/poussiere_trempe/poussiere_trempe.png');
  res('sceauancien', 'Sceau ancien', 'profond', 4, 560, 'medaille',
      ['#bc8a45','#efe0ae'], "Un cachet pris sur un gardien. La forge s'en sert pour fixer une seconde trempe.",
      'img/res/sceauancien/sceauancien.png');
  res('eclatnuee', 'Éclat de Nuée', 'profond', 3, 240, 'cristal',
      ['#755e9d','#d8cdf2'], "Un fragment chaud tombé après une victoire navale. Il n'existe aucun filon de cette matière.",
      'img/res/eclatnuee/eclatnuee.png');
  res('braisevivante', 'Braise vivante', 'profond', 4, 620, 'flamme',
      ['#ef7137','#ffd46d'], "Elle continue de battre sous la cendre. Les gardiens des Fournaises en laissent parfois une.",
      'img/res/braisevivante/braisevivante.png');
  res('veninreine', 'Venin de reine', 'profond', 4, 680, 'goutte',
      ['#78ad45','#d9ef79'], "Une goutte suffit. C'est également la quantité recommandée.",
      'img/res/veninreine/veninreine.png');
  res('givreancien', 'Givre ancien', 'profond', 4, 680, 'cristal',
      ['#89cce8','#e7fbff'], "Une glace qui refuse de fondre, même dans la poche du forgeron.",
      'img/res/givreancien/givreancien.png');

  /* ------------------------------------------------------------
     OUTILS : même échelle pour tous les métiers. L'illustration décrit
     le métier, la bordure décrit la qualité — on ne fabrique donc pas
     quatre-vingt-dix-huit variantes artificielles.
     ------------------------------------------------------------ */
  res('outilbois', 'Outillage en bois', 'ouvrage', 1, 18, 'marteau', ['#b58a54','#6f4b29'],
      "Simple, réparable sur un genou, meilleur que les griffes.");
  res('outilcuivre', 'Outillage en cuivre', 'ouvrage', 2, 55, 'marteau', ['#c77c4b','#744129'],
      "Le fil se tord, la lame s'affûte et le métier commence à gagner du temps.");
  res('outilbronze', 'Outillage en bronze', 'ouvrage', 2, 90, 'marteau', ['#c49a4e','#71552a'],
      "Plus lourd, plus fiable, et suffisamment beau pour être emprunté sans prévenir.");
  res('outilfer', 'Outillage en fer', 'ouvrage', 3, 145, 'marteau', ['#9da4a9','#535a60'],
      "La qualité de référence des ateliers sérieux.");
  res('outilor', 'Outillage doré', 'ouvrage', 4, 480, 'marteau', ['#e2bd54','#8d671d'],
      "L'or est tendre ; l'alliage, lui, ne l'est pas. Le prestige fait le reste.");
  res('outilmithril', 'Outillage en mithril', 'ouvrage', 5, 1800, 'marteau', ['#a7e0e8','#4b8296'],
      "Léger comme une promesse et, exceptionnellement, plus solide.");

  window.OUTILS_QUALITES = [
    { id:'bois',    res:'outilbois',    nom:'Bois',    mult:1.18, cycles:100,  niv:1, col:'#9b7145' },
    { id:'cuivre',  res:'outilcuivre',  nom:'Cuivre',  mult:1.32, cycles:170,  niv:2, col:'#bc7547' },
    { id:'bronze',  res:'outilbronze',  nom:'Bronze',  mult:1.48, cycles:260,  niv:3, col:'#b38c42' },
    { id:'fer',     res:'outilfer',     nom:'Fer',     mult:1.65, cycles:390,  niv:4, col:'#899299', legacy:'outil' },
    { id:'acier',   res:'outilacier',   nom:'Acier',   mult:1.90, cycles:560,  niv:6, col:'#bdc8d1' },
    { id:'or',      res:'outilor',      nom:'Or',      mult:2.12, cycles:760,  niv:8, col:'#dfb83f' },
    { id:'mithril', res:'outilmithril', nom:'Mithril', mult:2.42, cycles:1050, niv:10,col:'#8ed3e5' },
  ];
  window.OutilUtil = {
    qualites: window.OUTILS_QUALITES,
    de: function (outil) {
      if (!outil) return null;
      let id = outil.qualite || outil.type;
      if (id === 'outil') id = 'fer';
      if (id === 'outilacier') id = 'acier';
      return window.OUTILS_QUALITES.find(q => q.id === id || q.res === id) || window.OUTILS_QUALITES[0];
    },
    imageMetier: function (metier) { return 'img/outils/' + (metier || 'batisse') + '.png'; },
    imageQualite: function (metier, qualite) {
      /* La scierie possède sept silhouettes réellement différentes ;
         les autres métiers gardent leur nécessaire dédié en attendant
         leur propre passe illustrée. */
      if (metier === 'bois' && qualite)
        return 'img/outils/scierie/' + qualite + '.png';
      return this.imageMetier(metier);
    },
  };

  recette('outil_bois', { bat:'scierie', nom:'Assembler des outils en bois', metier:'bois', duree:34, niv:2,
    image:'img/outils/bois.png', in:{bois:5,corde:1}, out:{outilbois:1},
    desc:"Hachette, râteau, navette ou maillet : le manche change, l'économie commence." });
  recette('outil_cuivre', { bat:'forge', nom:'Forger des outils de cuivre', metier:'forge', duree:58, niv:2,
    in:{lingotcuivre:2,planche:1}, out:{outilcuivre:1}, desc:"Un premier fil métallique et moins de temps perdu à réparer les manches." });
  recette('outil_bronze', { bat:'forge', nom:'Forger des outils de bronze', metier:'forge', duree:82, niv:3,
    in:{bronze:2,cuir:1}, out:{outilbronze:1}, desc:"Le bronze tient le choc et apprend au forgeron la régularité." });
  recette('outil_fer_fin', { bat:'forge', nom:'Forger des outils de fer', metier:'forge', duree:104, niv:4,
    in:{lingotfer:3,planche:1,cuir:1}, out:{outilfer:1}, desc:"Le jeu complet du professionnel : solide, lourd et toujours ailleurs quand on le cherche." });
  recette('outil_or', { bat:'forge', nom:'Forger des outils dorés', metier:'forge', duree:220, niv:8,
    in:{lingotor:2,acier:2,cuir:1}, out:{outilor:1}, desc:"Une âme d'acier sous un alliage doré. Le maire appelle cela un investissement." });
  recette('outil_mithril', { bat:'forge', nom:'Forger des outils de mithril', metier:'forge', duree:420, niv:10,
    in:{mithril:2,obsidienne:1,cuir:2}, out:{outilmithril:1}, desc:"Ils ne pèsent presque rien. Leur facture, en revanche, pèse beaucoup." });

  /* ------------------------------------------------------------
     CUISINE ET ALCHIMIE : les trouvailles deviennent des décisions.
     Chaque nouvelle recette réutilise une branche déjà apprise.
     ------------------------------------------------------------ */
  const plats = [
    ['ragout_sous_bois','Ragoût des sous-bois',3,62,'ragout-sous-bois',{champignon:4,legume:3,herbe:1},{tourte:3}],
    ['veloute_lunaire','Velouté lunaire',5,88,'veloute-lunaire',{champignon_lune:2,lait:2,eau:2},{tourte:5}],
    ['tourte_morille','Tourte à la morille d’azur',6,112,'tourte-morille-azur',{champignon_azur:1,farineclaire:3,fromage:2},{tourte:7}],
    ['brochette_reine','Brochette de l’Amanite reine',7,148,'brochette-amanite-reine',{champignon_reine:1,viande:4,miel:2},{tourte:11}],
    ['consomme_astres','Consommé des astres',9,230,'consomme-astres',{champignon_astre:1,eau:6,herbe:6},{tourte:18}],
    ['brioche_verger','Brioche du verger',5,78,'brioche-verger',{fruit:4,farine:3,miel:2},{pain:9}],
    ['cassolette_port','Cassolette du port',6,96,'cassolette-port',{poissonfume:3,fromage:2,legume:3},{tourte:7}],
    ['festin_garnison','Festin de garnison',8,180,'festin-garnison',{viande:5,pain:5,fromage:3,cidre:2},{tourte:14}],
    ['pain_graines_miel','Pain aux graines et au miel',3,68,'pain-noix-miel',{farine:4,graine:3,miel:1},{pain:8}],
    ['gratin_racines','Gratin de racines',4,82,'gratin-racines',{racine:4,fromage:2,lait:2},{tourte:5}],
    ['terrine_fumoir','Terrine du fumoir',5,104,'terrine-fumoir',{viande:4,poissonfume:2,herbe:2},{tourte:7}],
    ['tarte_lune','Tarte aux champignons de lune',6,126,'tarte-champignons-lune',{champignon_lune:2,farineclaire:3,miel:1},{tourte:8}],
    ['soupe_cendre','Soupe des cendres',6,132,'soupe-cendre',{legume:4,cendre:1,herbe:3,eau:4},{tourte:8}],
    ['fromage_herbes','Fromage aux herbes',5,98,'fromage-herbes',{lait:5,herbe:3,sel:1},{fromage:5}],
    ['ration_capitaine','Ration du capitaine',7,156,'ration-capitaine',{poissonfume:4,pain:3,cidre:1},{tourte:10}],
    ['banquet_neuf_vies','Banquet des neuf vies',10,320,'banquet-neuf-vies',{champignon_astre:1,viande:7,poissonfume:6,fromage:5,miel:3},{tourte:25}],
  ];
  for (const p of plats) recette(p[0], { bat:'cuisine', nom:p[1], metier:'cuisine', niv:p[2], duree:p[3],
    image:'img/objets/cuisine/' + p[4] + '.png', in:p[5], out:p[6], moral:p[0] === 'festin_garnison' ? 18 : 0,
    desc:"Une recette tardive qui transforme une trouvaille en réserve réellement utile." });

  const potions = [
    ['potion_spores','Voile de spores',3,80,'voile-spores',{champignon:3,herbe:3,fiole:1},{potion:2}],
    ['potion_lune','Sérum lunaire',4,100,'serum-lunaire',{champignon_lune:1,miel:2,fiole:1},{potion:3}],
    ['potion_azur','Essence d’azur',5,124,'essence-azur',{champignon_azur:1,essence:1,fiole:1},{potion:4}],
    ['potion_reine','Venin couronné',7,172,'venin-couronne',{champignon_reine:1,veninreine:1,fiole:2},{potion:7}],
    ['potion_astres','Élixir des astres',9,280,'elixir-astres',{champignon_astre:1,coeurbiome:1,fiole:2},{potion:12}],
    ['potion_braise','Huile de braise',6,142,'huile-braise',{braisevivante:1,huile:3,fiole:1},{gardefeu:8}],
    ['potion_givreancien','Prisme de givre',7,158,'prisme-givre',{givreancien:1,gemme:1,fiole:1},{gardegel:8}],
    ['potion_nuee','Distillat de Nuée',8,210,'distillat-nuee',{eclatnuee:2,essence:3,fiole:2},{potion:9}],
    ['potion_epines','Tonique d’épines',4,92,'tonique-epines',{resine:2,racine:3,fiole:1},{gardevenin:4}],
    ['potion_foudre','Fiole de foudre',6,138,'fiole-foudre',{eclatnuee:1,gemme:1,fiole:1},{potion:6}],
    ['baume_geant','Baume du géant',5,116,'baume-geant',{huile:2,viande:2,herbe:4},{potion:5}],
    ['potion_miroir','Potion miroir',7,166,'potion-miroir',{verre:2,essence:3,fiole:1},{potion:7}],
    ['essence_chance','Essence de chance',8,204,'essence-chance',{ambre:2,miel:3,essence:2,fiole:1},{potion:9}],
    ['brouillard_sommeil','Brouillard de sommeil',5,122,'brouillard-sommeil',{champignon:5,herbe:3,fiole:2},{potion:5}],
    ['coeur_liquide','Cœur liquide',9,260,'coeur-liquide',{braisevivante:1,coeurbiome:1,essence:4,fiole:2},{potion:12}],
    ['elixir_neuf_vies','Élixir des neuf vies',10,420,'elixir-neuf-vies',{champignon_astre:1,sceauancien:1,eclatnuee:2,fiole:3},{potion:20}],
  ];
  for (const p of potions) recette(p[0], { bat:'alchimie', nom:p[1], metier:'savoir', niv:p[2], duree:p[3],
    image:'img/objets/alchimie/' + p[4] + '.png', in:p[5], out:p[6],
    desc:"Une préparation spécialisée : précieuse en combat, impossible sans ce que le monde extérieur abandonne." });

  /* ------------------------------------------------------------
     VILLAGE VIVANT : trois services, trois problèmes lisibles.
     Leur production ne crée pas une monnaie abstraite ; elle entretient
     directement propreté, sécurité, loisir et moral individuels.
     ------------------------------------------------------------ */
  window.METIERS.entretien = { id:'entretien', nom:'Entretien', ico:{f:'balai',c:['#8bb7a4','#486e60']} };
  window.METIERS.loisirs = { id:'loisirs', nom:'Loisirs', ico:{f:'note',c:['#d4a65b','#824f57']} };

  batiment('conciergerie', {
    nom:'Maison des balais', metier:'Nettoyeur public', cat:'vie', gen:'maison', rangees:[1,2],
    desc:"Dépôt de seaux, balais et panneaux « sol mouillé ». Le bourg découvre qu'une rue ne se nettoie pas par patriotisme.",
    cout:{planche:14,pierre:8,poterie:3}, temps:145, postes:[1,1,1,2,2,2,3,3],
    recettes:['balayer_rues','curer_caniveaux','chasser_poussiere'], effet:{proprete:12,securite:2},
    deblocage:{bat:{maison:2,puits:1}},
  }, 'puits');
  recette('balayer_rues', { bat:'conciergerie', nom:'Balayer les rues', metier:'entretien', duree:46,
    in:{}, out:{}, proprete:9, desc:"On ramasse surtout des arêtes, deux boutons et une dignité froissée." });
  recette('curer_caniveaux', { bat:'conciergerie', nom:'Curer les caniveaux', metier:'entretien', duree:82, niv:3,
    in:{eau:2,cendre:1}, out:{}, proprete:18, securite:3, desc:"Ce qui sort du caniveau explique pourquoi il fallait le curer." });
  recette('chasser_poussiere', { bat:'conciergerie', nom:'Inspection des ateliers', metier:'entretien', duree:120, niv:5,
    in:{huile:1,toile:1}, out:{}, proprete:26, entretien:12, desc:"Un chiffon, une burette et la phrase : « Ça aurait pu casser. »" });

  batiment('bains', {
    nom:'Bains du bourg', metier:'Baigneur', cat:'vie', gen:'poterie', rangees:[1,2],
    desc:"Deux bassins, un poêle et beaucoup de poils dans les bondes. La propreté gagne ; la plomberie hésite.",
    cout:{pierretaille:18,brique:22,tuile:10,cuivre:6}, temps:260, postes:[1,1,1,2,2,2,3,3],
    recettes:['chauffer_bains','lessive_collective'], effet:{proprete:18,moral:5},
    deblocage:{bat:{conciergerie:1,poterie:2}},
  }, 'conciergerie');
  recette('chauffer_bains', { bat:'bains', nom:'Chauffer les bains', metier:'entretien', duree:74,
    in:{eau:8,charbonbois:1}, out:{}, proprete:16, moral:8, desc:"Le premier bain est trop chaud, le dernier est politique." });
  recette('lessive_collective', { bat:'bains', nom:'Grande lessive', metier:'entretien', duree:108, niv:3,
    in:{eau:10,cendre:3,huile:1}, out:{}, proprete:24, moral:5, desc:"Le linge claque au vent et le bourg redevient présentable de loin." });

  batiment('maisonjeux', {
    nom:'Maison des jeux', metier:'Maître de jeux', cat:'vie', gen:'taverne', rangees:[1,2],
    desc:"Quilles, cartes, scène minuscule et règlement immense. On y perd des écus et rarement son après-midi.",
    cout:{planche:26,drap:3,poterie:5,ecu:120}, temps:230, postes:[1,1,1,2,2,2,3,3],
    recettes:['ouvrir_quilles','monter_spectacle','festival_pelote'], effet:{loisir:16,moral:7,attrait:0.25},
    deblocage:{bat:{cuisine:2,halle:1}},
  }, 'halle');
  recette('ouvrir_quilles', { bat:'maisonjeux', nom:'Ouvrir les quilles', metier:'loisirs', duree:48,
    in:{bois:1}, out:{ecu:2}, loisir:10, moral:5, desc:"La neuvième quille est réservée aux disputes sur les règles." });
  recette('monter_spectacle', { bat:'maisonjeux', nom:'Monter un spectacle', metier:'loisirs', duree:105, niv:3,
    in:{pain:3,cidre:1}, out:{ecu:12}, loisir:22, moral:12, desc:"Trois actes, deux entractes et un dragon joué par le concierge." });
  recette('festival_pelote', { bat:'maisonjeux', nom:'Festival de la pelote', metier:'loisirs', duree:180, niv:6,
    in:{laine:5,tourte:2,chant:1}, out:{ecu:35}, loisir:36, moral:22,
    desc:"Le règlement interdit de garder la pelote. Personne ne respecte le règlement." });

  /* ------------------------------------------------------------
     ENTRAÎNEMENT INDIVIDUEL. Les coûts sont modestes au premier niveau,
     puis changent de matière : le camp reste utile pendant toute la partie.
     ------------------------------------------------------------ */
  const ATTR = {
    force:{ nom:'Force', image:'img/objets/aventure/stats/dmg.png', debut:{poisson:4,bois:3}, milieu:'lingotfer', fin:'obsidienne' },
    dexterite:{ nom:'Dextérité', image:'img/objets/aventure/stats/aspd.png', debut:{poisson:4,bois:2}, milieu:'cuir', fin:'ambre' },
    endurance:{ nom:'Endurance', image:'img/objets/aventure/stats/hp.png', debut:{poisson:6,eau:2}, milieu:'pain', fin:'coeurbiome' },
    intelligence:{ nom:'Intelligence', image:'img/objets/aventure/stats/esh.png', debut:{poisson:4,herbe:2}, milieu:'parchemin', fin:'essence' },
  };
  function coutEntrainement(h, id) {
    const d = ATTR[id]; if (!d || !window.Etat) return {};
    const p = window.Etat.progresAttributHabitant(h, id), n = p.niveau;
    const c = {};
    for (const r in d.debut) c[r] = Math.ceil(d.debut[r] * (1 + Math.min(5, n - 1) * 0.22));
    if (n >= 6) c[d.milieu] = 1 + Math.floor((n - 6) / 4);
    if (n >= 13) c[d.fin] = 1 + Math.floor((n - 13) / 5);
    return c;
  }
  window.Entrainement = {
    ATTR,
    cout:coutEntrainement,
    pratiquer:function (hid, id) {
      const h = window.Etat && window.Etat.habitant(hid), d = ATTR[id];
      if (!h || !d) return {ok:false,raison:'Habitant ou exercice inconnu.'};
      const cout = coutEntrainement(h, id);
      if (!window.Etat.assez(cout)) return {ok:false,raison:'Ressources insuffisantes pour cette séance.'};
      window.Etat.depenser(cout);
      const p = window.Etat.progresAttributHabitant(h, id);
      const gain = Math.max(3, Math.round(p.pour * (0.16 + Math.min(0.09, p.niveau * 0.003))));
      window.Etat.gagnerAttribut(h, id, gain);
      h.vie = h.vie || {};
      h.vie.moral = Math.min(100, (h.vie.moral == null ? 55 : h.vie.moral) + 1.5);
      window.Etat.journal(h.nom + ' travaille sa ' + d.nom.toLowerCase() + ' au terrain d’entraînement.', 'rang');
      window.Etat.sauver(true);
      return {ok:true,gain};
    },
  };

  /* Les cinq raretés de champignons dans la table de bûcheronnage.
     Probabilités PAR MINUTE : présentes, mais jamais garanties. */
  const bois = window.BUTINS && window.BUTINS.bois;
  if (bois) {
    const ajouter = (resId, p, rang) => { if (!bois.some(x => x.res === resId)) bois.push({res:resId,p,n:[1,1],rang}); };
    ajouter('champignon_lune', 0.035, 2);
    ajouter('champignon_azur', 0.012, 4);
    ajouter('champignon_reine',0.0035,7);
    ajouter('champignon_astre',0.0009,10);
  }

  /* Les expéditions fournissent la matière de trempe ordinaire ; les
     couronnes profondes et les forces 10 garantissent les sceaux. */
  for (const ile of (window.ILES || [])) {
    ile.butin.poussiere_trempe = Math.max(1, Math.floor((ile.tier + ile.force) / 5));
    if (ile.force >= 7) ile.butin.eclatnuee = Math.max(1, Math.floor(ile.tier / 2));
    if (ile.force === 10 || (ile.tier >= 5 && ile.force >= 8)) ile.butin.sceauancien = 1;
    if (ile.biome === 'volcanique' && ile.force >= 6) ile.butin.braisevivante = 1;
    if (ile.biome === 'marecageuse' && ile.force >= 6) ile.butin.veninreine = 1;
  }

  window.REFONTE_SYSTEMES = { version:1, attributs:ATTR };
})();
