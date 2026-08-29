/* ============================================================
   LE BOURG — js/ecosystemes-batiments.js
   Socle partagé des ateliers vivants, bâti à partir de la scierie.

   Chaque bâtiment est migré séparément : il n'entre dans TYPES qu'après
   son audit. Cela évite de changer silencieusement tout le village avec
   un multiplicateur générique sans intérêt.
   ============================================================ */
"use strict";
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const E = () => window.Etat.E;
  const COULEURS = ['#82a866','#d0a64f','#6f9db4','#b47a70'];

  const CADENCES = {
    menagee:{ id:'menagee', nom:'Cadence ménagée', vitesse:0.84, fatigue:0.58,
      desc:'Moins de débit, mais des équipes qui tiennent longtemps.' },
    normale:{ id:'normale', nom:'Cadence régulière', vitesse:1, fatigue:1,
      desc:'Le rythme de référence pour une journée stable.' },
    soutenue:{ id:'soutenue', nom:'Cadence soutenue', vitesse:1.22, fatigue:1.55,
      desc:'Un gain immédiat payé par des pauses plus fréquentes.' },
    forcage:{ id:'forcage', nom:'Coup de collier', vitesse:1.46, fatigue:2.3,
      desc:'Un pic brutal que le confort seul ne peut pas soutenir.' },
  };

  /* Un bâtiment n'est ajouté ici qu'une fois son audit terminé. */
  const TYPES = {
    pecherie:{
      nom:'Pêcherie', rythme:'Régularité de l’équipage', unite:'banc',
      confort:[
        {id:'banc', nom:'Banc du ponton', desc:'Un endroit sec où reprendre son souffle.', base:{planche:8,corde:2}},
        {id:'soupe', nom:'Soupe de quart', desc:'Un repas chaud protège la vigueur des longues marées.', base:{poisson:12,pain:5}},
        {id:'abri', nom:'Abri de toile', desc:'Le vent et les embruns fatiguent moins les équipages.', base:{planche:12,toile:4}},
        {id:'casier', nom:'Casiers personnels', desc:'Le matériel reste prêt et les relèves perdent moins de temps.', base:{planche:14,corde:5,huile:2}},
      ],
    },
    champ:{
      nom:'Champ', rythme:'Régularité des travaux', unite:'sol',
      confort:[
        {id:'abri', nom:'Abri des champs', desc:'Les ouvriers récupèrent à l’ombre entre deux rangs.', base:{bois:10,paille:6}},
        {id:'eau', nom:'Réserve d’eau', desc:'Boire et se laver évite que chaque journée use l’équipe.', base:{planche:8,eau:14}},
        {id:'repas', nom:'Panier du midi', desc:'Un vrai repas protège la vigueur pendant les moissons.', base:{pain:7,legume:8}},
        {id:'vestiaire', nom:'Vestiaire à bottes', desc:'Du sec, du propre et des outils rangés entre les relèves.', base:{planche:12,toile:4}},
      ],
    },
    tournesol:{
      nom:'Champ de tournesols', rythme:'Régularité des floraisons', unite:'pollinisation',
      confort:[
        {id:'abri', nom:'Abri des faucheurs', desc:'Une ombre bienvenue au milieu des grandes têtes jaunes.', base:{bois:9,paille:6}},
        {id:'eau', nom:'Tonneau frais', desc:'La réserve suit les équipes jusqu’au bout des rangs.', base:{planche:8,eau:12}},
        {id:'voile', nom:'Voiles d’ombrage', desc:'Les pauses restent efficaces même au plein soleil.', base:{toile:5,corde:4}},
        {id:'banc', nom:'Banc des butineuses', desc:'Un coin calme pour les chats, des fleurs intactes pour les abeilles.', base:{planche:12,fleur:8}},
      ],
    },
    pepiniere:{
      nom:'Pépinière', rythme:'Régularité des soins', unite:'lignée',
      confort:[
        {id:'abri',nom:'Abri de greffe',desc:'Les gestes précis se font au sec et sans vent.',base:{planche:10,paille:5}},
        {id:'eau',nom:'Table d’arrosage',desc:'Les jeunes plants restent à portée sans porter chaque seau.',base:{planche:9,eau:16}},
        {id:'brise',nom:'Claies brise-vent',desc:'Les greffes fraîches prennent sans être secouées.',base:{bois:12,corde:4}},
        {id:'banc',nom:'Banc de tri',desc:'Les plants sont inspectés assis plutôt qu’entre deux corvées.',base:{planche:14,toile:3}},
      ],
    },
    potager:{
      nom:'Potager', rythme:'Régularité des soins', unite:'planches',
      confort:[
        {id:'abri',nom:'Abri du maraîcher',desc:'Les pauses se prennent à l’ombre, près des cultures.',base:{bois:8,paille:5}},
        {id:'eau',nom:'Point d’eau',desc:'Les arrosoirs restent pleins sans épuiser les équipes.',base:{planche:8,eau:12}},
        {id:'panier',nom:'Paniers de récolte',desc:'Moins d’allers-retours et moins de légumes écrasés.',base:{planche:7,corde:3}},
        {id:'gants',nom:'Gants de jardin',desc:'Les longues journées de binage usent moins les pattes.',base:{toile:4,cuir:3}},
      ],
    },
    fleurs:{
      nom:'Champ de fleurs', rythme:'Régularité des floraisons', unite:'floraison',
      confort:[
        {id:'abri',nom:'Abri des bouquets',desc:'Les fleurs sont triées à l’ombre et les équipes soufflent au sec.',base:{bois:8,paille:5}},
        {id:'eau',nom:'Rigole fleurie',desc:'L’arrosage suit les bandes sans porter chaque seau.',base:{planche:7,eau:12}},
        {id:'sechoir',nom:'Claies de séchage',desc:'Le tri devient un travail calme plutôt qu’une course contre le soleil.',base:{planche:9,toile:3}},
        {id:'infusion',nom:'Infusion du jardin',desc:'Les fleurs abîmées deviennent une pause qui restaure vraiment.',base:{fleur:10,miel:3}},
      ],
    },
    puits:{
      nom:'Puits', rythme:'Régularité des porteurs', unite:'nappe',
      confort:[
        {id:'abri',nom:'Auvent de margelle',desc:'Le treuil se manœuvre à l’abri du soleil et de la pluie.',base:{bois:8,paille:4}},
        {id:'banc',nom:'Banc des porteurs',desc:'Les relèves récupèrent sans repartir jusqu’au bourg.',base:{planche:8,pierre:3}},
        {id:'poulie',nom:'Poulie équilibrée',desc:'Le seau remonte droit et ménage les épaules.',base:{planche:5,corde:4,outil:1}},
        {id:'cruches',nom:'Cruches de relève',desc:'Une part de l’eau tirée reste fraîche pour l’équipe.',base:{poterie:5,eau:10}},
      ],
    },
    bergerie:{
      nom:'Bergerie', rythme:'Régularité des soins', unite:'troupeau',
      confort:[
        {id:'abri',nom:'Abri des bergers',desc:'Les longues veilles se font au sec, près du troupeau.',base:{bois:9,paille:6}},
        {id:'banc',nom:'Banc de tonte',desc:'La tonte fatigue moins quand tout reste à bonne hauteur.',base:{planche:9,corde:3}},
        {id:'eau',nom:'Abreuvoir propre',desc:'Bêtes et bergers évitent les allers-retours au puits.',base:{planche:8,eau:14}},
        {id:'manteau',nom:'Manteaux de berger',desc:'La laine revient à ceux qui gardent le troupeau dehors.',base:{laine:8,fil:3}},
      ],
    },
    etable:{
      nom:'Étable', rythme:'Régularité des soins', unite:'santé',
      confort:[
        {id:'abri',nom:'Coin des vachers',desc:'Une table sèche, assez proche pour surveiller les bêtes.',base:{bois:9,paille:5}},
        {id:'eau',nom:'Abreuvoir à niveau',desc:'L’eau propre réduit les corvées et calme le troupeau.',base:{planche:9,eau:16}},
        {id:'tabouret',nom:'Tabourets de traite',desc:'La traite répétée use moins les épaules et le dos.',base:{planche:7,corde:2}},
        {id:'lanterne',nom:'Lanterne d’étable',desc:'Les soins de nuit deviennent plus sûrs et moins stressants.',base:{cire:5,outil:1}},
      ],
    },
    rucher:{
      nom:'Rucher', rythme:'Calme des visites', unite:'colonie',
      confort:[
        {id:'abri',nom:'Abri de l’apiculteur',desc:'Les cadres sont inspectés au sec et loin du passage.',base:{bois:8,paille:5}},
        {id:'voile',nom:'Voiles de rechange',desc:'Une protection propre rend les visites plus calmes.',base:{toile:4,corde:2}},
        {id:'enfumoir',nom:'Enfumoir doux',desc:'Une fumée régulière apaise sans affoler la colonie.',base:{outil:1,bois:7,herbe:4}},
        {id:'eau',nom:'Abreuvoir à abeilles',desc:'Quelques pierres dans une eau peu profonde évitent les noyades.',base:{poterie:3,eau:10}},
      ],
    },
    moulin:{
      nom:'Moulin à vent', rythme:'Régularité des meules', unite:'vent',
      confort:[
        {id:'abri',nom:'Repos du meunier',desc:'Une banquette loin de la poussière et du grondement des meules.',base:{planche:9,toile:3}},
        {id:'masque',nom:'Masques à farine',desc:'La poussière n’entre plus dans chaque respiration.',base:{toile:5,corde:2}},
        {id:'graisse',nom:'Graissage des rouages',desc:'Moins de bruit, moins d’effort et moins de secousses.',base:{huile:5,outil:1}},
        {id:'lanterne',nom:'Lanterne de calotte',desc:'Les changements de sacs restent sûrs pendant les longues rafales nocturnes.',base:{cire:5,verre:2}},
      ],
    },
    moulinEau:{
      nom:'Moulin à eau', rythme:'Régularité de la roue', unite:'débit',
      confort:[
        {id:'abri',nom:'Repos du bief',desc:'Une banquette sèche à l’écart des embruns et des maillets.',base:{planche:10,toile:3}},
        {id:'passerelle',nom:'Passerelle antidérapante',desc:'Les réglages de vanne ne se terminent plus les pattes dans l’eau.',base:{planche:12,corde:3}},
        {id:'graisse',nom:'Graissage de l’arbre',desc:'La roue transmet sa force sans secouer tout le bâtiment.',base:{huile:6,outil:1}},
        {id:'manteau',nom:'Manteaux huilés',desc:'Les longues relèves restent supportables près de la roue.',base:{toile:5,huile:3}},
      ],
    },
    cuisine:{
      nom:'Four banal', rythme:'Régularité des fournées', unite:'foyer',
      confort:[
        {id:'repas',nom:'Table du personnel',desc:'Les fourniers goûtent assis, plutôt que debout entre deux plaques.',base:{planche:10,pain:8}},
        {id:'hotte',nom:'Hotte de tirage',desc:'La fumée quitte le four avant de fatiguer les yeux et les poumons.',base:{brique:10,tuile:5}},
        {id:'table',nom:'Table de préparation',desc:'Chaque ingrédient reste à portée et les longues recettes usent moins les équipes.',base:{planche:14,poterie:4}},
        {id:'reserve',nom:'Réserve de petit bois',desc:'Le foyer reste stable sans courir chercher une bûche au milieu du service.',base:{bois:18,corde:3}},
      ],
    },
    fumoir:{
      nom:'Fumoir', rythme:'Régularité du tirage', unite:'fumée',
      confort:[
        {id:'abri',nom:'Auvent du saleur',desc:'Les préparations se font au sec, loin du conduit brûlant.',base:{planche:9,tuile:4}},
        {id:'gants',nom:'Gants épais',desc:'Crochets, grilles et portes chaudes fatiguent moins les équipes.',base:{cuir:4,toile:3}},
        {id:'table',nom:'Table de salaison',desc:'Les lots sont suspendus sans porter chaque pièce à bout de bras.',base:{planche:12,poterie:3}},
        {id:'masque',nom:'Masques à fumée',desc:'La fumée aromatise les vivres plutôt que les poumons du personnel.',base:{toile:5,herbe:4}},
      ],
    },
    laiterie:{
      nom:'Laiterie', rythme:'Régularité des soins', unite:'ferments',
      confort:[
        {id:'banc',nom:'Banc de baratte',desc:'Les longues séries se font à bonne hauteur et ménagent les épaules.',base:{planche:9,toile:2}},
        {id:'etamine',nom:'Étamine propre',desc:'Égoutter devient plus rapide et les lots ratés plus rares.',base:{toile:5,eau:5}},
        {id:'saumure',nom:'Bac de saumure',desc:'Les croûtes sont lavées sans porter chaque meule au puits.',base:{poterie:4,eau:12}},
        {id:'claies',nom:'Claies à hauteur',desc:'Retourner les meules fatigue moins les équipes de cave.',base:{planche:15,corde:3}},
      ],
    },
    carriere:{
      nom:'Carrière', rythme:'Régularité du front', unite:'stabilité',
      confort:[
        {id:'abri',nom:'Abri des carriers',desc:'Les pauses se prennent hors de la poussière et des chutes de pierre.',base:{bois:10,toile:3}},
        {id:'casque',nom:'Casques renforcés',desc:'Les éclats et les petits éboulis coûtent moins de vigueur.',base:{cuir:4,fer:2}},
        {id:'treuil',nom:'Treuil équilibré',desc:'Les blocs quittent le front sans épuiser toute une relève.',base:{poutre:1,corde:5,outil:1}},
        {id:'drain',nom:'Rigole de drainage',desc:'Le front reste praticable et les équipes gardent les pattes sèches.',base:{pierre:12,planche:8}},
      ],
    },
    mine:{
      nom:'Mine', rythme:'Régularité des galeries', unite:'sécurité',
      confort:[
        {id:'repos',nom:'Salle de pause sèche',desc:'Une galerie latérale éclairée où les équipes récupèrent hors du bruit.',base:{planche:10,toile:3}},
        {id:'lampes',nom:'Lampes de sécurité',desc:'Une flamme protégée révèle l’air mauvais avant les premiers vertiges.',base:{fer:3,verre:2,huile:4}},
        {id:'casiers',nom:'Casiers de relève',desc:'Casques, cordes et outils restent prêts près du chevalement.',base:{planche:12,cuir:3}},
        {id:'monte',nom:'Benne à personnel',desc:'La relève descend sans dépenser sa vigueur dans les échelles.',base:{poutre:2,corde:6,outil:2}},
      ],
    },
    charbonniere:{
      nom:'Charbonnière', rythme:'Régularité de la meule', unite:'carbonisation',
      confort:[
        {id:'hutte',nom:'Hutte de veille',desc:'Le charbonnier peut se reposer sans perdre la fumée de vue.',base:{bois:10,paille:6}},
        {id:'masque',nom:'Masque à fumée',desc:'Les longues veilles usent moins les équipes.',base:{toile:4,herbe:3}},
        {id:'eau',nom:'Tonne de sécurité',desc:'Une reprise de flamme se traite avant de dévorer la meule.',base:{planche:8,eau:14}},
        {id:'auvent',nom:'Auvent à outils',desc:'Pelles et argile restent prêtes pour corriger les évents.',base:{planche:12,tuile:4}},
      ],
    },
    tuilerie:{
      nom:'Tuilerie', rythme:'Régularité des fournées', unite:'cuisson',
      confort:[
        {id:'auvent',nom:'Auvent de séchage',desc:'Les pièces crues sèchent sans reprendre chaque averse.',base:{planche:10,tuile:5}},
        {id:'masques',nom:'Masques de four',desc:'Cendre et poussière d’argile fatiguent moins les équipes.',base:{toile:4,herbe:3}},
        {id:'table',nom:'Table de moulage',desc:'Les moules restent à hauteur et les fournées prennent forme plus vite.',base:{planche:12,outil:1}},
        {id:'securite',nom:'Réserve d’extinction',desc:'Une tonne d’eau et du sable gardent les surchauffes sous contrôle.',base:{poterie:4,eau:14,sable:6}},
      ],
    },
    poterie:{
      nom:'Poterie', rythme:'Régularité du tour', unite:'pièces',
      confort:[
        {id:'siege',nom:'Siège de tour réglable',desc:'Le dos reste droit pendant les longues séries.',base:{planche:9,toile:3}},
        {id:'lavage',nom:'Bac de lavage',desc:'Les mains et les outils restent propres entre deux argiles.',base:{poterie:3,eau:12}},
        {id:'claies',nom:'Claies rembourrées',desc:'Les pièces crues ne s’entrechoquent plus pendant les relèves.',base:{planche:12,paille:5}},
        {id:'lumiere',nom:'Lumière de décor',desc:'Les motifs fins se peignent sans finir avec un œil de travers.',base:{verre:2,cire:5}},
      ],
    },
    verrerie:{
      nom:'Verrerie', rythme:'Régularité du four', unite:'bain',
      confort:[
        {id:'ecran',nom:'Écrans de chaleur',desc:'Le banc du souffleur reste supportable près du four blanc.',base:{brique:8,fer:2}},
        {id:'eau',nom:'Bac de refroidissement',desc:'Canne et pinces refroidissent sans traverser tout l’atelier.',base:{poterie:4,eau:14}},
        {id:'lunettes',nom:'Lunettes fumées',desc:'Le personnel lit le verre sans fixer la lumière aveuglante.',base:{verre:3,cuir:2}},
        {id:'banc',nom:'Banc rembourré',desc:'Souffler assis ménage les épaules pendant les longues commandes.',base:{planche:10,toile:4}},
      ],
    },
    fonderie:{
      nom:'Fonderie', rythme:'Régularité des coulées', unite:'bain',
      confort:[
        {id:'ecran',nom:'Paravent réfractaire',desc:'La coulée chauffe le moule plutôt que tout le personnel.',base:{brique:10,fer:2}},
        {id:'masques',nom:'Masques de fondeur',desc:'Fumées et étincelles coûtent moins de vigueur.',base:{cuir:4,toile:3}},
        {id:'palan',nom:'Palan de coulée',desc:'Le creuset se déplace sans vider les bras des fondeurs.',base:{poutre:1,corde:5,outil:1}},
        {id:'douche',nom:'Douche de sécurité',desc:'Une éclaboussure se traite avant de devenir une catastrophe.',base:{poterie:4,eau:16}},
      ],
    },
    forge:{
      nom:'Forge', rythme:'Régularité du marteau', unite:'foyer',
      confort:[
        {id:'tabouret',nom:'Tabouret d’enclume',desc:'Les finitions longues se font sans plier le dos.',base:{planche:9,cuir:2}},
        {id:'eau',nom:'Bac de trempe tempéré',desc:'La vapeur reste au bac et la température se contrôle mieux.',base:{poterie:4,eau:14}},
        {id:'rangement',nom:'Râtelier de marteaux',desc:'Chaque masse revient à sa place entre deux commandes.',base:{planche:12,clou:5}},
        {id:'hotte',nom:'Hotte de forge',desc:'La fumée sort du bâtiment avant les forgerons.',base:{brique:9,tuile:5}},
      ],
    },
    armurerie:{
      nom:'Armurerie', rythme:'Régularité des assemblages', unite:'ajustement',
      confort:[
        {id:'siege',nom:'Siège de rivetage',desc:'Les milliers d’anneaux se ferment à bonne hauteur.',base:{planche:9,cuir:2}},
        {id:'lumiere',nom:'Lampes d’établi',desc:'Un rivet mal fermé se voit avant le départ.',base:{cire:5,verre:2}},
        {id:'mannequin',nom:'Mannequins réglables',desc:'Les tailles se contrôlent sans convoquer chaque soldat.',base:{planche:12,toile:3}},
        {id:'rangement',nom:'Casiers de patrons',desc:'Mesures et gabarits ne se perdent plus entre les commandes.',base:{planche:10,parchemin:2}},
      ],
    },
    orfevre:{
      nom:'Orfèvre', rythme:'Régularité des gestes fins', unite:'précision',
      confort:[
        {id:'siege',nom:'Siège de joaillier',desc:'Le travail de loupe ne casse plus le dos.',base:{planche:8,cuir:2}},
        {id:'lumiere',nom:'Lampe à réflecteur',desc:'Chaque griffe du sertissage reste visible.',base:{lingotcuivre:1,verre:2,cire:4}},
        {id:'coffre',nom:'Coffre à casiers',desc:'Perles et gemmes attendent séparées et sous clé.',base:{planche:10,fer:2}},
        {id:'aspiration',nom:'Plateau récupérateur',desc:'La poussière d’or ne disparaît plus entre les lames du plancher.',base:{toile:4,planche:8}},
      ],
    },
  };

  function gere(b) { return !!(b && TYPES[b.type]); }
  function definition(b) { return b && TYPES[b.type]; }
  function personnel(b) {
    if (!b.ecosysteme || typeof b.ecosysteme !== 'object') b.ecosysteme = {};
    const p = b.ecosysteme;
    if (!CADENCES[p.cadence]) p.cadence = 'normale';
    if (typeof p.autoRepos !== 'boolean') p.autoRepos = true;
    if (typeof p.seuilRepos !== 'number') p.seuilRepos = 24;
    if (typeof p.seuilRetour !== 'number') p.seuilRetour = 68;
    if (!Array.isArray(p.equipes)) p.equipes = [];
    if (!p.affectations || typeof p.affectations !== 'object') p.affectations = {};
    if (!p.confort || typeof p.confort !== 'object') p.confort = {};
    if (!p.signature || typeof p.signature !== 'object') p.signature = {};
    if (b.type === 'pecherie') {
      if (typeof p.signature.banc !== 'number') p.signature.banc = 82;
      if (typeof p.signature.maximum !== 'number') p.signature.maximum = 100;
      if (typeof p.signature.repeuplement !== 'number') p.signature.repeuplement = 0;
      if (!p.signature.politique) p.signature.politique = 'equilibre';
    } else if (b.type === 'champ') {
      if (typeof p.signature.fertilite !== 'number') p.signature.fertilite = 78;
      if (typeof p.signature.maximum !== 'number') p.signature.maximum = 100;
      if (typeof p.signature.semences !== 'number') p.signature.semences = 12;
      if (typeof p.signature.semencesMax !== 'number') p.signature.semencesMax = 30;
      if (!p.signature.politique) p.signature.politique = 'rotation';
    } else if (b.type === 'tournesol') {
      if (typeof p.signature.pollinisation !== 'number') p.signature.pollinisation = 48;
      if (typeof p.signature.maximum !== 'number') p.signature.maximum = 100;
      if (typeof p.signature.nectar !== 'number') p.signature.nectar = 35;
      if (!p.signature.politique) p.signature.politique = 'equilibre';
    } else if(b.type==='pepiniere'){
      if(typeof p.signature.reprise!=='number')p.signature.reprise=62;
      if(typeof p.signature.maximum!=='number')p.signature.maximum=100;
      if(typeof p.signature.plants!=='number')p.signature.plants=12;
      if(typeof p.signature.plantsMax!=='number')p.signature.plantsMax=30;
      if(typeof p.signature.lignee!=='number')p.signature.lignee=0;
      if(!p.signature.politique)p.signature.politique='diversite';
    } else if(b.type==='potager'){
      if(typeof p.signature.humidite!=='number')p.signature.humidite=68;
      if(typeof p.signature.maximum!=='number')p.signature.maximum=100;
      if(typeof p.signature.association!=='number')p.signature.association=58;
      if(!p.signature.politique)p.signature.politique='melange';
    } else if(b.type==='fleurs'){
      if(typeof p.signature.floraison!=='number')p.signature.floraison=74;
      if(typeof p.signature.maximum!=='number')p.signature.maximum=100;
      if(typeof p.signature.nectar!=='number')p.signature.nectar=42;
      if(!p.signature.politique)p.signature.politique='bouquets';
    } else if(b.type==='puits'){
      if(typeof p.signature.nappe!=='number')p.signature.nappe=86;
      if(typeof p.signature.maximum!=='number')p.signature.maximum=100;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='bergerie'){
      if(typeof p.signature.troupeau!=='number')p.signature.troupeau=8;
      if(typeof p.signature.maximum!=='number')p.signature.maximum=troupeauMax(b);
      if(typeof p.signature.paturage!=='number')p.signature.paturage=72;
      if(!p.signature.politique)p.signature.politique='laine';
    } else if(b.type==='etable'){
      if(typeof p.signature.troupeau!=='number')p.signature.troupeau=5;
      if(typeof p.signature.maximum!=='number')p.signature.maximum=etableMax(b);
      if(typeof p.signature.sante!=='number')p.signature.sante=76;
      if(typeof p.signature.litiere!=='number')p.signature.litiere=72;
      if(!p.signature.politique)p.signature.politique='lait';
    } else if(b.type==='rucher'){
      if(typeof p.signature.colonie!=='number')p.signature.colonie=68;
      if(typeof p.signature.humeur!=='number')p.signature.humeur=70;
      if(typeof p.signature.reserve!=='number')p.signature.reserve=36;
      if(typeof p.signature.maximum!=='number')p.signature.maximum=100;
      if(typeof p.signature.reine!=='number')p.signature.reine=1;
      if(typeof p.signature.selection!=='number')p.signature.selection=0;
      if(!p.signature.politique)p.signature.politique='douce';
    } else if(b.type==='moulin'){
      if(typeof p.signature.vent!=='number')p.signature.vent=46;
      if(typeof p.signature.cible!=='number')p.signature.cible=62;
      if(typeof p.signature.changement!=='number')p.signature.changement=55;
      if(typeof p.signature.inertie!=='number')p.signature.inertie=28;
      if(!p.signature.politique)p.signature.politique='regulier';
    } else if(b.type==='moulinEau'){
      if(typeof p.signature.debit!=='number')p.signature.debit=64;
      if(typeof p.signature.cible!=='number')p.signature.cible=72;
      if(typeof p.signature.changement!=='number')p.signature.changement=95;
      if(typeof p.signature.bassin!=='number')p.signature.bassin=68;
      if(typeof p.signature.ouverture!=='number')p.signature.ouverture=62;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='cuisine'){
      if(typeof p.signature.chaleur!=='number')p.signature.chaleur=64;
      if(!p.signature.politique)p.signature.politique='equilibre';
      if(!Array.isArray(p.signature.marmite))p.signature.marmite=[];
      if(!p.signature.connues||typeof p.signature.connues!=='object')p.signature.connues={};
      if(typeof p.signature.decouvertes!=='number')p.signature.decouvertes=Object.keys(p.signature.connues).length;
    } else if(b.type==='fumoir'){
      if(typeof p.signature.tirage!=='number')p.signature.tirage=48;
      if(typeof p.signature.fumee!=='number')p.signature.fumee=52;
      if(typeof p.signature.creosote!=='number')p.signature.creosote=8;
      if(!['aulne','fruitier','resineux','charbon'].includes(p.signature.essence))p.signature.essence='aulne';
    } else if(b.type==='laiterie'){
      if(typeof p.signature.ferments!=='number')p.signature.ferments=58;
      if(typeof p.signature.humidite!=='number')p.signature.humidite=56;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='carriere'){
      if(typeof p.signature.stabilite!=='number')p.signature.stabilite=86;
      if(!p.signature.couches||typeof p.signature.couches!=='object')p.signature.couches={pierre:62,sable:48,argile:44};
      if(!['pierre','sable','argile'].includes(p.signature.cible))p.signature.cible='pierre';
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='mine'){
      if(typeof p.signature.ventilation!=='number')p.signature.ventilation=78;
      if(typeof p.signature.soutenement!=='number')p.signature.soutenement=84;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='charbonniere'){
      if(typeof p.signature.temperature!=='number')p.signature.temperature=58;
      if(typeof p.signature.ouverture!=='number')p.signature.ouverture=44;
      if(typeof p.signature.maturation!=='number')p.signature.maturation=28;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='tuilerie'){
      if(typeof p.signature.temperature!=='number')p.signature.temperature=48;
      if(typeof p.signature.sechage!=='number')p.signature.sechage=32;
      if(typeof p.signature.charge!=='number')p.signature.charge=60;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='poterie'){
      if(typeof p.signature.formes!=='number')p.signature.formes=18;
      if(typeof p.signature.centrage!=='number')p.signature.centrage=64;
      if(typeof p.signature.charge!=='number')p.signature.charge=58;
      if(typeof p.signature.casse!=='number')p.signature.casse=4;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='verrerie'){
      if(typeof p.signature.temperature!=='number')p.signature.temperature=68;
      if(typeof p.signature.bain!=='number')p.signature.bain=34;
      if(typeof p.signature.tirage!=='number')p.signature.tirage=62;
      if(typeof p.signature.defauts!=='number')p.signature.defauts=6;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='fonderie'){
      if(typeof p.signature.temperature!=='number')p.signature.temperature=72;
      if(typeof p.signature.scories!=='number')p.signature.scories=8;
      if(typeof p.signature.contamination!=='number')p.signature.contamination=4;
      if(typeof p.signature.tirage!=='number')p.signature.tirage=62;
      if(typeof p.signature.dernierMetal!=='string')p.signature.dernierMetal='ferreux';
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='forge'){
      if(typeof p.signature.chaleur!=='number')p.signature.chaleur=66;
      if(typeof p.signature.rythme!=='number')p.signature.rythme=58;
      if(typeof p.signature.precision!=='number')p.signature.precision=54;
      if(typeof p.signature.tirage!=='number')p.signature.tirage=62;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='armurerie'){
      if(typeof p.signature.ajustement!=='number')p.signature.ajustement=58;
      if(typeof p.signature.chutes!=='number')p.signature.chutes=9;
      if(typeof p.signature.standard!=='number')p.signature.standard=52;
      if(!p.signature.politique)p.signature.politique='equilibre';
    } else if(b.type==='orfevre'){
      if(typeof p.signature.precision!=='number')p.signature.precision=62;
      if(typeof p.signature.eclats!=='number')p.signature.eclats=5;
      if(typeof p.signature.tension!=='number')p.signature.tension=48;
      if(!p.signature.politique)p.signature.politique='equilibre';
    }
    return p;
  }
  function ouvriers(b) {
    return (b.postes || []).filter(p => p.hab)
      .map(p => E().habitants.find(h => h.id === p.hab)).filter(Boolean);
  }
  function equipeHabitant(h, b) {
    const p = personnel(b), id = p.affectations[h.id];
    return p.equipes.find(e => e.id === id) || null;
  }
  function dansHoraire(h, b) {
    const eq = equipeHabitant(h, b);
    if (!eq) return true;
    const heure = (E().heure * 24 + 24) % 24;
    return ((heure - eq.debut + 24) % 24) < eq.duree;
  }
  function affecterEquipe(b, hid, eid) {
    const p = personnel(b);
    if (!eid) { delete p.affectations[hid]; return true; }
    if (!p.equipes.some(e => e.id === eid)) return false;
    p.affectations[hid] = eid; return true;
  }
  function repartirEquipes(b) {
    const p = personnel(b), liste = ouvriers(b).sort((a,z) => (z.niv || 1) - (a.niv || 1));
    p.affectations = {};
    if (!p.equipes.length) return p;
    const ordre = p.equipes.concat(p.equipes.slice(1,-1).reverse());
    liste.forEach((h,i) => { p.affectations[h.id] = ordre[i % ordre.length].id; });
    return p;
  }
  function ajouterEquipe(b) {
    const p = personnel(b), max = b.niv >= 7 ? 4 : (b.niv >= 5 ? 3 : 2);
    if (p.equipes.length >= max) return false;
    const i = p.equipes.length;
    p.equipes.push({ id:'e' + (Date.now() % 100000) + i, nom:'Équipe ' + (i + 1),
      debut:(6 + i * 8) % 24, duree:8, couleur:COULEURS[i] });
    return true;
  }
  function retirerEquipe(b) {
    const p = personnel(b), retiree = p.equipes.pop();
    if (!retiree) return false;
    for (const hid in p.affectations) if (p.affectations[hid] === retiree.id) delete p.affectations[hid];
    return true;
  }
  function confort(b) {
    const p = personnel(b), def = definition(b), c = p.confort;
    let niveau = 0, recuperation = 1, fatigue = 1, moral = 0, regularite = 0;
    for (const a of def.confort || []) {
      const n = c[a.id] || 0; niveau += n;
      recuperation += n * 0.10; fatigue -= n * 0.045; moral += n * 1.1; regularite += n * 0.02;
    }
    return { niveau, recuperation, fatigue:Math.max(0.55, fatigue), moral, regularite };
  }
  function disponibilite(h, b) {
    if (!h || !gere(b)) return { actif:true, facteur:1, raison:'' };
    const vie = window.VieVillage.assurerHabitant(h), p = personnel(b);
    if (!dansHoraire(h,b)) return { actif:false, facteur:0, raison:'hors relève' };
    if (p.autoRepos && vie.pauses[b.id]) return { actif:false, facteur:0, raison:'pause automatique' };
    const eq = equipeHabitant(h,b), cad = CADENCES[p.cadence], vigueur = clamp(vie.vigueur,0,100);
    const forme = vigueur >= 82 ? 1.04 : (vigueur >= 48 ? 0.92 + vigueur * 0.0015 : 0.54 + vigueur * 0.009);
    const boost = eq ? clamp(0.88 / (eq.duree / 24), 0.9, 2.45) : 1;
    const regul = 0.96 + clamp(b.rythmeAtelier || 0, 0, 100) * 0.0016;
    return { actif:true, facteur:boost * cad.vitesse * forme * regul * facteurSignature(b), raison:'', equipe:eq };
  }
  function tickHabitant(h, b, poste, dt, ville) {
    const vie = window.VieVillage.assurerHabitant(h), p = personnel(b), cad = CADENCES[p.cadence], conf = confort(b);
    if (p.autoRepos) {
      if (vie.vigueur <= p.seuilRepos) vie.pauses[b.id] = true;
      if (vie.vigueur >= p.seuilRetour) delete vie.pauses[b.id];
    }
    const actif = dansHoraire(h,b) && !vie.pauses[b.id] && poste && !poste.bloque;
    if (actif) vie.vigueur = clamp(vie.vigueur - dt * 0.062 * cad.fatigue * conf.fatigue, 0, 100);
    else vie.vigueur = clamp(vie.vigueur + dt * 0.22 * conf.recuperation * (0.72 + ville.loisir / 180) * (1+soutienRepos()), 0, 100);
  }
  function tick(dt) {
    for (const bid in E().bat) {
      const b = E().bat[bid]; if (!gere(b)) continue;
      const p = personnel(b), liste = ouvriers(b), cad = CADENCES[p.cadence], conf = confort(b);
      const moyenne = liste.length ? liste.reduce((n,h) => n + window.VieVillage.assurerHabitant(h).vigueur,0) / liste.length : 0;
      let cible = !liste.length ? 0 : clamp(24 + (moyenne >= 42 && moyenne <= 88 ? 56 : 18) + conf.regularite * 100, 0, 100);
      if (cad.id === 'forcage') cible = Math.min(cible,18);
      const pas = 1 - Math.exp(-Math.max(0,dt) / (cad.id === 'forcage' ? 34 : 115));
      b.rythmeAtelier = clamp((b.rythmeAtelier || 0) + (cible - (b.rythmeAtelier || 0)) * pas, 0, 100);

      if (b.type === 'pecherie') {
        const s = p.signature, manque = 1 - s.banc / s.maximum;
        const viviers = b.raff && b.raff.vivier ? 1.25 : 1;
        s.banc = clamp(s.banc + dt * (0.018 + manque * 0.042) * viviers, 0, s.maximum);
      } else if (b.type === 'champ') {
        const s=p.signature, travaille=(b.postes||[]).some(x=>x.hab&&x.rec&&x.rec!=='jachere'&&!x.bloque);
        if(!travaille){
          const bonus=s.politique==='rotation'?1.35:1;
          s.fertilite=clamp(s.fertilite+dt*(0.008+(1-s.fertilite/s.maximum)*0.018)*bonus,0,s.maximum);
        }
      } else if (b.type === 'tournesol') {
        const s=p.signature,cible=pollinisationCible(b),bonus=s.politique==='floraison'?1.28:1;
        const pasP=1-Math.exp(-Math.max(0,dt)/(150/bonus));
        s.pollinisation=clamp(s.pollinisation+(cible-s.pollinisation)*pasP,0,s.maximum);
        s.nectar=clamp(s.nectar+dt*(s.politique==='floraison'?.026:.012),0,100);
      } else if(b.type==='pepiniere'){
        const s=p.signature,bonus=s.politique==='robuste'?1.3:1;
        s.plants=clamp(s.plants+dt*.009*bonus,0,s.plantsMax);
        const cible=clamp(58+Math.sqrt(s.lignee)*2.2+(s.politique==='robuste'?12:0),0,96);
        const pas=1-Math.exp(-Math.max(0,dt)/220);s.reprise=clamp(s.reprise+(cible-s.reprise)*pas,0,s.maximum);
      } else if(b.type==='potager'){
        const s=p.signature,cible=humiditeCible();
        const pasH=1-Math.exp(-Math.max(0,dt)/190);
        s.humidite=clamp(s.humidite+(cible-s.humidite)*pasH,0,s.maximum);
        if(s.politique==='melange')s.association=clamp(s.association+dt*.008,0,s.maximum);
      } else if(b.type==='fleurs'){
        const s=p.signature,regen=s.politique==='grainier'?.014:(s.politique==='bouquets'?.007:.010);
        s.floraison=clamp(s.floraison+dt*regen,0,s.maximum);
        const cible=nectarCible(),pasN=1-Math.exp(-Math.max(0,dt)/175);
        s.nectar=clamp(s.nectar+(cible-s.nectar)*pasN,0,s.maximum);
      } else if(b.type==='puits'){
        const s=p.signature,manque=1-s.nappe/s.maximum;
        s.nappe=clamp(s.nappe+dt*(.010+manque*.030),0,s.maximum);
      } else if(b.type==='bergerie'){
        const s=p.signature;s.maximum=troupeauMax(b);
        const pousse=s.politique==='renouvellement'?1.25:1;
        s.paturage=clamp(s.paturage+dt*.010*pousse,0,100);
        if(s.paturage>18&&s.troupeau<s.maximum){
          const naissance=(s.politique==='renouvellement'?1.7:(s.politique==='viande'?.72:1))*clamp(s.paturage/65,.35,1.25);
          s.troupeau=clamp(s.troupeau+dt*.0022*naissance,0,s.maximum);
          s.paturage=clamp(s.paturage-dt*.0008*s.troupeau,0,100);
        }
      } else if(b.type==='etable'){
        const s=p.signature;s.maximum=etableMax(b);
        s.litiere=clamp(s.litiere-dt*.0013*s.troupeau,0,100);
        const cible=clamp(34+s.litiere*.58+(s.politique==='renouvellement'?6:0),0,96),pasS=1-Math.exp(-Math.max(0,dt)/180);
        s.sante=clamp(s.sante+(cible-s.sante)*pasS,0,100);
        if(s.sante>52&&s.troupeau<s.maximum){
          const naissance=(s.politique==='renouvellement'?1.7:1)*clamp(s.sante/75,.45,1.2);
          s.troupeau=clamp(s.troupeau+dt*.0017*naissance,0,s.maximum);
        }
      } else if(b.type==='rucher'){
        const s=p.signature,nectar=nectarVillage(),cad=CADENCES[p.cadence];
        const cibleC=clamp(38+nectar*.45+s.reine*3+(s.politique==='essaimage'?10:0),0,98),pasC=1-Math.exp(-Math.max(0,dt)/210);
        s.colonie=clamp(s.colonie+(cibleC-s.colonie)*pasC,0,100);
        const cibleH=clamp(58+(s.politique==='douce'?20:0)-(cad.id==='forcage'?24:cad.id==='soutenue'?8:0),15,96),pasH=1-Math.exp(-Math.max(0,dt)/130);
        s.humeur=clamp(s.humeur+(cibleH-s.humeur)*pasH,0,100);
        const remplissage=.006*(.35+nectar/100)*(s.colonie/100)*(s.politique==='miel'?1.28:(s.politique==='douce'?.88:1));
        s.reserve=clamp(s.reserve+dt*remplissage,0,100);
        if(s.colonie>70&&s.humeur>64&&s.reine<5){s.selection+=dt*.003*(s.politique==='essaimage'?2:1);if(s.selection>=100){s.selection-=100;s.reine++;}}
      } else if(b.type==='moulin'){
        const s=p.signature;s.changement-=dt;
        if(s.changement<=0){s.cible=12+Math.random()*86;s.changement=38+Math.random()*74;}
        const pasV=1-Math.exp(-Math.max(0,dt)/18);s.vent=clamp(s.vent+(s.cible-s.vent)*pasV,0,100);
        if(s.vent>52)s.inertie=clamp(s.inertie+dt*.018*(s.vent/100)*(s.politique==='inertie'?1.55:1),0,100);
        else s.inertie=clamp(s.inertie-dt*.012*(s.politique==='inertie'?.55:1),0,100);
      } else if(b.type==='moulinEau'){
        const s=p.signature;s.changement-=dt;
        if(s.changement<=0){s.cible=24+Math.random()*72;s.changement=85+Math.random()*105;}
        const pasD=1-Math.exp(-Math.max(0,dt)/44);s.debit=clamp(s.debit+(s.cible-s.debit)*pasD,0,100);
        const ouv=ouvertureMoulinEau(b)/100,d=s.debit/100;
        let entree=d*(1-ouv)*.018,sortie=ouv*Math.max(0,.58-d)*.030;
        if(s.politique==='retenue')entree*=1.45;
        if(s.politique==='puissance')sortie*=1.35;
        s.bassin=clamp(s.bassin+dt*(entree-sortie),0,100);
      } else if(b.type==='cuisine'){
        const s=p.signature,actif=(b.postes||[]).some(x=>x.hab&&x.rec&&!x.bloque);
        const cible=s.politique==='mijoter'?48:(s.politique==='banquet'?88:68);
        const temps=actif?38:95,pasC=1-Math.exp(-Math.max(0,dt)/temps);
        s.chaleur=clamp(s.chaleur+(cible-s.chaleur)*pasC-(actif&&s.politique==='banquet'?dt*.002:0),0,100);
      } else if(b.type==='fumoir'){
        const s=p.signature,actif=(b.postes||[]).some(x=>x.hab&&x.rec&&x.rec!=='nettoyer_fumoir'&&!x.bloque);
        const cible=clamp(s.tirage+(s.essence==='charbon'?9:(s.essence==='resineux'?4:0)),18,96),pasF=1-Math.exp(-Math.max(0,dt)/26);
        s.fumee=clamp(s.fumee+(cible-s.fumee)*pasF,0,100);
        if(actif)s.creosote=clamp(s.creosote+dt*.0018*(.55+s.fumee/70)*(s.essence==='resineux'?1.45:(s.essence==='charbon'?.72:1)),0,100);
      } else if(b.type==='laiterie'){
        const s=p.signature,cible=s.politique==='frais'?38:(s.politique==='cave'?72:56),pasH=1-Math.exp(-Math.max(0,dt)/135);
        s.humidite=clamp(s.humidite+(cible-s.humidite)*pasH,0,100);
        s.ferments=clamp(s.ferments+dt*.004*(s.politique==='frais'?1.25:1),0,100);
      } else if(b.type==='carriere'){
        const s=p.signature,actif=(b.postes||[]).some(x=>x.hab&&x.rec&&x.rec!=='soutenir_front'&&!x.bloque);
        if(!actif)s.stabilite=clamp(s.stabilite+dt*.0025*(s.politique==='prudente'?1.4:1),0,100);
      } else if(b.type==='mine'){
        const s=p.signature,actifs=(b.postes||[]).filter(x=>x.hab&&x.rec&&!['ventiler_mine','etayer_mine'].includes(x.rec)&&!x.bloque).length,profondeur=profondeurMine(b);
        const cible=clamp(92-profondeur*.42-actifs*6+(s.politique==='surface'?12:(s.politique==='profonde'?-12:0)),8,92),pasV=1-Math.exp(-Math.max(0,dt)/95);
        s.ventilation=clamp(s.ventilation+(cible-s.ventilation)*pasV,0,100);
      } else if(b.type==='charbonniere'){
        const s=p.signature,veille=(b.postes||[]).some(x=>x.hab&&x.rec==='cuire_charbon'),cible=clamp(22+s.ouverture*.86,18,100),pasT=1-Math.exp(-Math.max(0,dt)/32);
        s.temperature=clamp(s.temperature+(cible-s.temperature)*pasT,0,100);
        if(veille){const zone=s.temperature>=42&&s.temperature<=79?1:(s.temperature<42?.35:Math.max(0,.8-(s.temperature-79)*.055));s.maturation=clamp(s.maturation+dt*.020*zone,0,100);}
      } else if(b.type==='tuilerie'){
        const s=p.signature,actif=(b.postes||[]).some(x=>x.hab&&x.rec&&recetteFourTuilerie(x.rec)&&!x.bloque);
        const cible=actif?(s.politique==='rapide'?91:(s.politique==='dense'?84:78)):28,pasT=1-Math.exp(-Math.max(0,dt)/(actif?30:115));
        s.temperature=clamp(s.temperature+(cible-s.temperature)*pasT,0,100);
        s.sechage=clamp(s.sechage+dt*.0015*(s.politique==='rapide'?.78:(s.politique==='dense'?1.16:1)),0,sechageMaxTuilerie(b));
      } else if(b.type==='poterie'){
        const s=p.signature,auTour=(b.postes||[]).filter(x=>x.hab&&['tourner_pot','grand_vaisselier'].includes(x.rec)&&!x.bloque).length;
        if(auTour)s.centrage=clamp(s.centrage+dt*.0012*auTour*(s.politique==='prestige'?1.35:1),0,100);
        s.casse=clamp(s.casse-dt*.0018,0,100);
      } else if(b.type==='verrerie'){
        const s=p.signature,actif=(b.postes||[]).some(x=>x.hab&&x.rec&&!x.bloque),cible=actif?clamp(35+s.tirage*.72+(s.politique==='artistique'?5:(s.politique==='continu'?-5:0)),42,98):34,pas=1-Math.exp(-Math.max(0,dt)/(actif?42:150));
        s.temperature=clamp(s.temperature+(cible-s.temperature)*pas,0,100);
        s.bain=clamp(s.bain-dt*(actif?.0008:.0022),0,bainMaxVerrerie(b));
        s.defauts=clamp(s.defauts-dt*.0014,0,100);
      } else if(b.type==='fonderie'){
        const s=p.signature,actif=(b.postes||[]).some(x=>x.hab&&x.rec&&x.rec!=='purger_four'&&!x.bloque),cible=actif?clamp(38+s.tirage*.68+(s.politique==='alliage'?6:(s.politique==='recuperation'?-6:0)),45,98):36,pas=1-Math.exp(-Math.max(0,dt)/(actif?48:160));
        s.temperature=clamp(s.temperature+(cible-s.temperature)*pas,0,100);
        s.contamination=clamp(s.contamination-dt*.0007,0,100);
      } else if(b.type==='forge'){
        const s=p.signature,externe=!!(E().armee&&E().armee.forge),actifs=(b.postes||[]).filter(x=>x.hab&&x.rec&&!x.bloque).length+(externe?1:0),cible=actifs?clamp(36+s.tirage*.70+(s.politique==='arsenal'?5:(s.politique==='entretien'?-5:0)),45,98):32,pas=1-Math.exp(-Math.max(0,dt)/(actifs?34:125));
        s.chaleur=clamp(s.chaleur+(cible-s.chaleur)*pas,0,100);
        if(!actifs)s.rythme=clamp(s.rythme-dt*.0012,0,100);
      } else if(b.type==='armurerie'){
        const s=p.signature,actifs=(b.postes||[]).filter(x=>x.hab&&x.rec&&x.rec!=='recycler_chutes_armure'&&!x.bloque).length;
        if(actifs)s.ajustement=clamp(s.ajustement+dt*.0009*actifs*(s.politique==='mobilite'?1.25:1),0,100);
      } else if(b.type==='orfevre'){
        const s=p.signature,actifs=(b.postes||[]).filter(x=>x.hab&&x.rec&&x.rec!=='polir_outils_orfevre'&&!x.bloque).length;
        if(!actifs)s.eclats=clamp(s.eclats-dt*.0008,0,100);
      }
    }
  }
  function arrondiVivant(x) {
    const bas = Math.floor(x); return bas + (Math.random() < x - bas ? 1 : 0);
  }
  function modifierSorties(b, rec, sorties) {
    const copie = Object.assign({}, sorties);
    if (!gere(b) || !rec) return copie;
    if (b.type === 'pecherie' && rec.id.startsWith('peche_')) {
      const s = personnel(b).signature, pct = s.banc / Math.max(1,s.maximum);
      const politique = s.politique === 'durable' ? .88 : (s.politique === 'intensive' ? 1.18 : 1);
      const facteur = (pct >= .75 ? 1.18 : (pct >= .45 ? 1 : (pct >= .20 ? .72 : .42))) * politique;
      if (copie.poisson) copie.poisson = Math.max(1, arrondiVivant(copie.poisson * facteur));
    } else if (b.type === 'champ' && ['semer_ble','racines','lin_champ'].includes(rec.id)) {
      const s=personnel(b).signature,pct=s.fertilite/Math.max(1,s.maximum), graines=s.semences/Math.max(1,s.semencesMax);
      let facteur=pct>=.75?1.12:(pct>=.4?1:(pct>=.15?.72:.42));
      if(graines<.18)facteur*=.65;
      if(s.politique==='cereales'&&rec.id==='semer_ble')facteur*=1.16;
      if(s.politique==='semences')facteur*=.9;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if (b.type === 'tournesol') {
      const s=personnel(b).signature,pct=s.pollinisation/Math.max(1,s.maximum);
      let facteur=.70+pct*.55;
      if(s.politique==='graines')facteur*=1.15;
      else if(s.politique==='floraison')facteur*=.88;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='pepiniere'){
      const s=personnel(b).signature;let facteur=.72+(s.reprise/100)*.48+Math.min(.22,Math.sqrt(s.lignee)*.012);
      if(s.politique==='productive'&&(rec.id==='cueillir'||rec.id==='verger_greffe'))facteur*=1.16;
      if(s.politique==='robuste'&&rec.id==='greffer')facteur*=1.10;
      if(s.plants<2&&rec.id==='greffer')facteur*=.55;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='potager'){
      const s=personnel(b).signature,h=s.humidite/100,a=s.association/100;
      let facteur=.62+h*.34+a*.24;
      if(s.politique==='primeurs')facteur*=copie.legume?1.15:.9;
      else if(s.politique==='simples')facteur*=copie.herbe||copie.racine?1.18:.92;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='fleurs'){
      const s=personnel(b).signature,f=s.floraison/100,n=s.nectar/100;
      let facteur=.62+f*.42+n*.14;
      if(s.politique==='bouquets'&&rec.id==='couper_fleurs')facteur*=1.15;
      else if(s.politique==='butinage')facteur*=.90;
      else if(s.politique==='grainier'&&rec.id==='graines_fleurs')facteur*=1.18;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='puits'&&rec.id==='tirer_eau'){
      const s=personnel(b).signature,p=s.nappe/100;
      let facteur=p>=.7?1.15:(p>=.35?1:(p>=.15?.72:.45));
      if(s.politique==='ateliers')facteur*=1.20;
      else if(s.politique==='bourg')facteur*=.92;
      else if(s.politique==='cultures')facteur*=.90;
      if(copie.eau)copie.eau=Math.max(1,arrondiVivant(copie.eau*facteur));
    } else if(b.type==='bergerie'){
      const s=personnel(b).signature,ratio=s.troupeau/Math.max(1,s.maximum),p=s.paturage/100;
      let facteur=.62+ratio*.43+p*.18;
      if((rec.id==='tondre'||rec.id==='paitre')&&s.politique==='laine')facteur*=1.15;
      if((rec.id==='abattre_mouton'||rec.id==='abattre_complet')&&s.politique==='viande')facteur*=1.18;
      if(s.politique==='renouvellement')facteur*=.90;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='etable'){
      const s=personnel(b).signature,ratio=s.troupeau/Math.max(1,s.maximum),v=s.sante/100;
      let facteur=.58+ratio*.38+v*.28;
      if(rec.id==='traire'&&s.politique==='lait')facteur*=1.16;
      if(rec.id==='fumier'&&s.politique==='fumure')facteur*=1.22;
      if((rec.id==='abattre_vache'||rec.id==='abattre_boeuf')&&s.politique==='renouvellement')facteur*=.88;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='rucher'){
      const s=personnel(b).signature;
      if(copie.miel){let facteur=.55+(s.colonie/100)*.35+(s.humeur/100)*.18;if(rec.id==='miel_de_fleurs')facteur*=.65+nectarVillage()/100*.65;if(s.politique==='miel')facteur*=1.18;copie.miel=Math.max(1,arrondiVivant(copie.miel*facteur));}
    } else if(b.type==='cuisine'){
      const s=personnel(b).signature,stabilite=1-Math.min(1,Math.abs(s.chaleur-(s.politique==='mijoter'?48:(s.politique==='banquet'?88:68)))/55);
      let facteur=.88+stabilite*.20;
      if(s.politique==='mijoter'&&(rec.duree||0)>=55)facteur*=1.14;
      else if(s.politique==='banquet')facteur*=1.17;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='fumoir'){
      const s=personnel(b).signature;
      if(rec.id!=='nettoyer_fumoir'){
        const qualite=clamp(1.20-Math.abs(s.fumee-46)/145,.72,1.20);
        let essence=s.essence==='fruitier'?1.10:(s.essence==='resineux'?1.13:(s.essence==='charbon'?.94:1));
        if(rec.id==='fumer_poisson'&&s.essence==='fruitier')essence*=1.04;
        if(rec.id==='fumer_viande'&&s.essence==='resineux')essence*=1.05;
        for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*qualite*essence));
      }
    } else if(b.type==='laiterie'){
      const s=personnel(b).signature,stable=1-Math.min(1,Math.abs(s.humidite-(s.politique==='frais'?38:(s.politique==='cave'?72:56)))/55);
      let facteur=.86+stable*.22;
      if(s.politique==='frais'&&(rec.id==='baratter'||rec.id==='cultiver_ferments'))facteur*=1.18;
      if(s.politique==='cave'&&(rec.id==='fromage_frais'||rec.id==='affiner_cave'))facteur*=1.26;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='carriere'){
      const s=personnel(b).signature,sortie={extraire_pierre:'pierre',tamiser_sable:'sable',extraire_argile:'argile'}[rec.id];
      let facteur=.82+s.stabilite/100*.26;
      if(sortie===s.cible)facteur*=1.18;
      if(s.politique==='prudente')facteur*=.90;else if(s.politique==='profonde')facteur*=1.23;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='mine'){
      const s=personnel(b).signature;if(!['ventiler_mine','etayer_mine'].includes(rec.id)){
        let facteur=.68+s.ventilation/100*.24+s.soutenement/100*.20;
        if(s.politique==='surface')facteur*=rec.niv>=6?.72:1.08;else if(s.politique==='profonde')facteur*=rec.niv>=4?1.24:.88;
        for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
      }
    } else if(b.type==='charbonniere'&&rec.id==='cuire_charbon'){
      const s=personnel(b).signature;let facteur=.62+s.maturation/100*.74;
      if(s.politique==='precoce')facteur*=.86;else if(s.politique==='complete')facteur*=1.18;
      if(copie.charbonbois)copie.charbonbois=Math.max(1,arrondiVivant(copie.charbonbois*facteur));
      if(copie.cendre)copie.cendre=Math.max(1,arrondiVivant(copie.cendre*(s.temperature>82?1.45:.85)));
    } else if(b.type==='tuilerie'&&recetteFourTuilerie(rec.id)){
      const s=personnel(b).signature,ideal=s.politique==='rapide'?88:(s.politique==='dense'?82:76),stable=1-Math.min(1,Math.abs(s.temperature-ideal)/54);
      let facteur=(.70+s.charge/100*.42)*(.86+stable*.22);
      if(s.politique==='rapide')facteur*=.91;else if(s.politique==='dense')facteur*=1.18;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='poterie'){
      const s=personnel(b).signature,qualite=.72+s.centrage/100*.34-s.casse/100*.28;
      let facteur=qualite;
      if(s.politique==='serie')facteur*=rec.id==='tourner_pot'||rec.id==='cuire_pots'?1.16:.90;
      else if(s.politique==='prestige')facteur*=rec.id==='jarres_marchandes'||rec.id==='email_cuivre'||rec.id==='etamer'?1.24:.86;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='verrerie'){
      const s=personnel(b).signature,ideal=s.politique==='continu'?75:(s.politique==='artistique'?91:84),stable=1-Math.min(1,Math.abs(s.temperature-ideal)/48),reserve=.78+Math.min(1,s.bain/48)*.22;
      let facteur=(.76+stable*.30)*reserve*(1-Math.min(.32,s.defauts/180));
      if(s.politique==='continu'&&rec.id==='souffler_verre')facteur*=1.18;
      else if(s.politique==='artistique'&&['vitrail','verre_argent'].includes(rec.id))facteur*=1.25;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='fonderie'&&rec.id!=='purger_four'){
      const s=personnel(b).signature,propre=1-Math.min(.42,(s.scories+s.contamination)/210),ideal=rec.id==='fondre_mithril'?96:(['couler_acier','couler_bronze'].includes(rec.id)?88:78),stable=1-Math.min(1,Math.abs(s.temperature-ideal)/55);
      let facteur=propre*(.78+stable*.28);
      if(s.politique==='alliage'&&['couler_bronze','couler_acier','fondre_mithril'].includes(rec.id))facteur*=1.22;
      else if(s.politique==='recuperation'&&rec.id==='refondre_limaille')facteur*=1.30;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='forge'){
      const s=personnel(b).signature,ideal=s.politique==='entretien'?72:(s.politique==='arsenal'?90:82),stable=1-Math.min(1,Math.abs(s.chaleur-ideal)/52),geste=.78+s.precision/100*.22;
      let facteur=(.78+stable*.25)*geste;
      if(s.politique==='entretien'&&['clouterie','outil_fer','outil_acier','ferrures'].includes(rec.id))facteur*=1.20;
      else if(s.politique==='arsenal'&&rec.id==='forger_arme')facteur*=1.24;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='armurerie'){
      const s=personnel(b).signature,propre=1-Math.min(.35,s.chutes/190),geste=.78+s.ajustement/100*.24;let facteur=propre*geste;
      if(s.politique==='serie'&&['forger_armure','forger_ecu','harnois_bronze'].includes(rec.id))facteur*=1.22;
      else if(s.politique==='protection'&&['ecailler_harnois','maille_acier'].includes(rec.id))facteur*=1.26;
      else if(s.politique==='mobilite'&&['forger_ecu','maille_acier'].includes(rec.id))facteur*=1.16;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    } else if(b.type==='orfevre'&&rec.id!=='polir_outils_orfevre'){
      const s=personnel(b).signature,risque=risqueOrfevre(b,rec),geste=.74+s.precision/100*.32,propre=1-Math.min(.30,s.eclats/190);let facteur=geste*propre*(1-risque*.28);
      if(s.politique==='monnaie'&&rec.id==='monnayer')facteur*=1.20;
      else if(s.politique==='audacieux'&&['joaillerie','sertir','collier_perles'].includes(rec.id))facteur*=1.26;
      for(const k in copie)copie[k]=Math.max(1,arrondiVivant(copie[k]*facteur));
    }
    return copie;
  }
  function finirRecette(b, rec) {
    if (!gere(b) || !rec) return;
    const s = personnel(b).signature;
    if(b.type==='pecherie'){
      let pression = { peche_filet:.35, peche_nasse:.85, peche_fond:1.25, peche_glace:2 }[rec.id] || 0;
      pression *= s.politique === 'durable' ? .55 : (s.politique === 'intensive' ? 1.5 : 1);
      if (rec.id === 'vivier_garder') { s.banc = clamp(s.banc + 4.5, 0, s.maximum); s.repeuplement += 1; }
      else if (pression) s.banc = clamp(s.banc - pression, 0, s.maximum);
    }else if(b.type==='champ'){
      const pression={semer_ble:1.15,racines:.25,lin_champ:1.8}[rec.id]||0;
      const mult=s.politique==='cereales'?1.2:(s.politique==='rotation'?.82:1);
      if(rec.id==='jachere'){
        s.fertilite=clamp(s.fertilite+18,0,s.maximum);s.semences=clamp(s.semences+4,0,s.semencesMax);
      }else if(pression){
        s.fertilite=clamp(s.fertilite-pression*mult,0,s.maximum);
        s.semences=clamp(s.semences-1+(s.politique==='semences'?1.7:.45),0,s.semencesMax);
      }
    }else if(b.type==='tournesol'){
      let pression=rec.id==='recolter_graines'?1.15:(rec.id==='semer_tournesol'?.55:0);
      pression*=s.politique==='floraison'?.45:(s.politique==='graines'?1.3:1);
      s.pollinisation=clamp(s.pollinisation-pression,0,s.maximum);
      s.nectar=clamp(s.nectar+(s.politique==='floraison'?2:.4),0,100);
    }else if(b.type==='pepiniere'){
      if(rec.id==='greffer'){
        s.plants=clamp(s.plants-1,0,s.plantsMax);s.lignee+=1;s.reprise=clamp(s.reprise+.35,0,s.maximum);
      }else if(rec.id==='cueillir')s.plants=clamp(s.plants+.35,0,s.plantsMax);
      else if(rec.id==='verger_greffe')s.lignee+=.45;
    }else if(b.type==='potager'){
      const effets={biner:[-.7,1.2],simples_potager:[-.5,.7],potager_greffe:[-1.4,-.9],forcer:[-2.2,-1.5]},e=effets[rec.id];
      if(e){
        const pression=s.politique==='primeurs'?1.25:(s.politique==='melange'?.82:1);
        s.humidite=clamp(s.humidite+e[0]*pression,0,s.maximum);
        s.association=clamp(s.association+e[1]*(s.politique==='melange'?1.25:1),0,s.maximum);
      }
    }else if(b.type==='fleurs'){
      let pression=rec.id==='couper_fleurs'?1.35:(rec.id==='graines_fleurs'?.65:0);
      pression*=s.politique==='bouquets'?1.2:(s.politique==='grainier'?.55:1);
      s.floraison=clamp(s.floraison-pression,0,s.maximum);
      if(rec.id==='graines_fleurs')s.nectar=clamp(s.nectar+1.2,0,s.maximum);
    }else if(b.type==='puits'&&rec.id==='tirer_eau'){
      const pression=s.politique==='ateliers'?1.25:(s.politique==='bourg'?.60:(s.politique==='cultures'?.72:.82));
      s.nappe=clamp(s.nappe-pression,0,s.maximum);
    }else if(b.type==='bergerie'){
      if(rec.id==='tondre')s.paturage=clamp(s.paturage-.25,0,100);
      else if(rec.id==='paitre')s.paturage=clamp(s.paturage-.8,0,100);
      else if(rec.id==='abattre_mouton')s.troupeau=clamp(s.troupeau-1,0,s.maximum);
      else if(rec.id==='abattre_complet')s.troupeau=clamp(s.troupeau-1.5,0,s.maximum);
    }else if(b.type==='etable'){
      if(rec.id==='traire'){s.litiere=clamp(s.litiere-.55,0,100);s.sante=clamp(s.sante-.12,0,100);}
      else if(rec.id==='fumier'){s.litiere=clamp(s.litiere+7,0,100);s.sante=clamp(s.sante+1.5,0,100);}
      else if(rec.id==='litiere'){s.litiere=clamp(s.litiere+20,0,100);s.sante=clamp(s.sante+5,0,100);}
      else if(rec.id==='abattre_vache')s.troupeau=clamp(s.troupeau-1,0,s.maximum);
      else if(rec.id==='abattre_boeuf')s.troupeau=clamp(s.troupeau-1.5,0,s.maximum);
    }else if(b.type==='rucher'){
      if(rec.id==='recolter_miel'){s.reserve=clamp(s.reserve-2.4*(s.politique==='miel'?1.25:1),0,100);s.humeur=clamp(s.humeur-.7,0,100);}
      else if(rec.id==='miel_de_fleurs'){s.reserve=clamp(s.reserve-4.2*(s.politique==='miel'?1.25:1),0,100);s.humeur=clamp(s.humeur-1.1,0,100);}
      else if(rec.id==='fondre_rayons')s.humeur=clamp(s.humeur-.4,0,100);
    }else if(b.type==='cuisine'){
      s.chaleur=clamp(s.chaleur+(s.politique==='banquet'?2.2:(s.politique==='mijoter'?.35:1)),0,100);
    }else if(b.type==='fumoir'){
      if(rec.id==='nettoyer_fumoir')s.creosote=clamp(s.creosote-48,0,100);
      else s.creosote=clamp(s.creosote+.7+s.fumee*.018,0,100);
    }else if(b.type==='laiterie'){
      if(rec.id==='cultiver_ferments')s.ferments=clamp(s.ferments+30,0,100);
      else s.ferments=clamp(s.ferments-({baratter:2,fromage_frais:6,affiner_cave:11}[rec.id]||0),0,100);
    }else if(b.type==='carriere'){
      if(rec.id==='soutenir_front'){
        s.stabilite=clamp(s.stabilite+52,0,100);
        s.couches={pierre:48+Math.random()*38,sable:34+Math.random()*42,argile:34+Math.random()*42};
      }else{
        const mat={extraire_pierre:'pierre',tamiser_sable:'sable',extraire_argile:'argile'}[rec.id];
        if(mat)s.couches[mat]=clamp(s.couches[mat]-(s.politique==='profonde'?2.1:(s.politique==='prudente'?.75:1.2)),0,100);
        if(mat||rec.id==='tailler_pierre')s.stabilite=clamp(s.stabilite-(s.politique==='profonde'?2.2:(s.politique==='prudente'?.7:1.25)),0,100);
      }
    }else if(b.type==='mine'){
      if(rec.id==='ventiler_mine')s.ventilation=clamp(s.ventilation+38,0,100);
      else if(rec.id==='etayer_mine')s.soutenement=clamp(s.soutenement+44,0,100);
      else{
        const profond=(rec.niv||1)>=6||rec.id==='galerie_profonde';
        s.ventilation=clamp(s.ventilation-(profond?2.4:1.1)*(s.politique==='profonde'?1.3:1),0,100);
        s.soutenement=clamp(s.soutenement-(profond?2.1:.8)*(s.politique==='surface'?.72:(s.politique==='profonde'?1.35:1)),0,100);
      }
    }else if(b.type==='charbonniere'&&rec.id==='cuire_charbon'){
      s.maturation=s.politique==='precoce'?12:4;
      s.temperature=clamp(s.temperature-(s.politique==='complete'?18:10),0,100);
    }else if(b.type==='tuilerie'){
      if(rec.id==='preparer_fournee')s.sechage=clamp(s.sechage+30+s.charge*.10,0,sechageMaxTuilerie(b));
      else if(recetteFourTuilerie(rec.id)){
        s.sechage=clamp(s.sechage-besoinSechageTuilerie(b,rec),0,sechageMaxTuilerie(b));
        s.temperature=clamp(s.temperature+(s.politique==='rapide'?4.5:(s.politique==='dense'?2.2:3)),0,100);
      }
    }else if(b.type==='poterie'){
      if(rec.id==='tourner_pot'){s.formes=clamp(s.formes+3,0,formesMaxPoterie(b));s.centrage=clamp(s.centrage+.8,0,100);}
      else if(rec.id==='grand_vaisselier'){s.formes=clamp(s.formes+8,0,formesMaxPoterie(b));s.centrage=clamp(s.centrage+1.8,0,100);}
      else if(recetteFourPoterie(rec.id)){
        s.formes=clamp(s.formes-besoinFormesPoterie(b,rec),0,formesMaxPoterie(b));
        const risque=Math.max(0,s.charge-58)*.025+Math.max(0,62-s.centrage)*.018+(s.politique==='serie'?.6:(s.politique==='prestige'?-.3:0));
        s.casse=clamp(s.casse+Math.max(.15,risque),0,100);
        s.centrage=clamp(s.centrage-(s.charge>78?.7:.18),0,100);
      }
    }else if(b.type==='verrerie'){
      if(rec.id==='souffler_verre')s.bain=clamp(s.bain+24,0,bainMaxVerrerie(b));
      else s.bain=clamp(s.bain-({souffler_fiole:5,verre_argent:9,vitrail:14}[rec.id]||2),0,bainMaxVerrerie(b));
      const ecart=Math.abs(s.temperature-(s.politique==='continu'?75:(s.politique==='artistique'?91:84))),risque=Math.max(0,ecart-9)*.025+Math.max(0,s.tirage-82)*.018;
      s.defauts=clamp(s.defauts+.18+risque,0,100);
    }else if(b.type==='fonderie'){
      if(rec.id==='purger_four'){
        s.scories=clamp(s.scories-58,0,100);s.contamination=clamp(s.contamination-64,0,100);s.dernierMetal='propre';
      }else{
        const famille=familleFonderie(rec.id);if(s.dernierMetal!=='propre'&&famille!==s.dernierMetal)s.contamination=clamp(s.contamination+11,0,100);
        s.dernierMetal=famille;s.scories=clamp(s.scories+(rec.id==='refondre_limaille'?5:(rec.id==='fondre_mithril'?8:2.4)),0,100);
        s.temperature=clamp(s.temperature+(rec.id==='fondre_mithril'?5:1.5),0,100);
      }
    }else if(b.type==='forge'){
      finirCommandeForge(b,rec.id==='forger_arme');
    }else if(b.type==='armurerie'){
      if(rec.id==='recycler_chutes_armure')s.chutes=clamp(s.chutes-42,0,100);
      else{s.chutes=clamp(s.chutes+({maille_acier:5,ecailler_harnois:4}[rec.id]||2.2),0,100);s.ajustement=clamp(s.ajustement+(s.politique==='mobilite'?.9:.45),0,100);}
    }else if(b.type==='orfevre'){
      if(rec.id==='polir_outils_orfevre'){s.eclats=clamp(s.eclats-50,0,100);s.precision=clamp(s.precision+4,0,100);}
      else{const risque=risqueOrfevre(b,rec);s.eclats=clamp(s.eclats+1.2+risque*5,0,100);s.precision=clamp(s.precision+(1-risque)*.8-risque*.45,0,100);}
    }
  }

  function pollinisationCible() {
    let ruchers=0,fleurs=0;
    for(const bid in E().bat){const t=E().bat[bid].type;if(t==='rucher')ruchers++;else if(t==='fleurs')fleurs++;}
    return clamp(32+ruchers*18+fleurs*10,0,100);
  }

  function humiditeCible() {
    let soutien=0;
    for(const bid in E().bat){const b=E().bat[bid];if(b.type==='puits')soutien+=personnel(b).signature.politique==='cultures'?24:14;}
    return clamp(38+soutien,0,92);
  }

  function nectarCible() {
    let ruchers=0,tournesols=0;
    for(const bid in E().bat){const t=E().bat[bid].type;if(t==='rucher')ruchers++;else if(t==='tournesol')tournesols++;}
    return clamp(28+ruchers*16+tournesols*5,0,96);
  }

  function nectarVillage(){
    let total=12;
    for(const bid in E().bat){const b=E().bat[bid];if(b.type==='fleurs')total+=personnel(b).signature.nectar*.35;else if(b.type==='tournesol')total+=personnel(b).signature.nectar*.12;}
    return clamp(total,0,100);
  }

  function facteurSignature(b){
    if(!b)return 1;
    if(b.type==='cuisine'){
      const s=personnel(b).signature,cible=s.politique==='mijoter'?48:(s.politique==='banquet'?88:68),stable=1-Math.min(1,Math.abs(s.chaleur-cible)/60);
      return clamp((s.politique==='mijoter'?.82:(s.politique==='banquet'?1.16:1))*(.82+stable*.25),.64,1.34);
    }
    if(b.type==='fumoir'){
      const s=personnel(b).signature,encrasse=1-clamp(s.creosote/125,0,.62);
      return clamp((.62+s.fumee/100*.78)*(s.essence==='charbon'?1.10:1)*encrasse,.48,1.42);
    }
    if(b.type==='laiterie'){
      const s=personnel(b).signature,cible=s.politique==='frais'?38:(s.politique==='cave'?72:56),stable=1-Math.min(1,Math.abs(s.humidite-cible)/60);
      return clamp((s.politique==='frais'?1.12:(s.politique==='cave'?.82:1))*(.84+stable*.22),.68,1.24);
    }
    if(b.type==='carriere'){
      const s=personnel(b).signature;return clamp((.78+s.stabilite/100*.34)*(s.politique==='prudente'?.88:(s.politique==='profonde'?1.16:1)),.55,1.32);
    }
    if(b.type==='mine'){
      const s=personnel(b).signature;return clamp((.62+s.ventilation/100*.28+s.soutenement/100*.22)*(s.politique==='surface'?.96:(s.politique==='profonde'?1.10:1)),.48,1.28);
    }
    if(b.type==='charbonniere'){
      const s=personnel(b).signature;return clamp(.68+s.ouverture/100*.58,.62,1.28);
    }
    if(b.type==='tuilerie'){
      const s=personnel(b).signature,ideal=s.politique==='rapide'?88:(s.politique==='dense'?82:76),stable=1-Math.min(1,Math.abs(s.temperature-ideal)/58);
      return clamp((s.politique==='rapide'?1.20:(s.politique==='dense'?.86:1))*(.75+stable*.31),.58,1.30);
    }
    if(b.type==='poterie'){
      const s=personnel(b).signature;return clamp((.82+s.centrage/100*.24-s.casse/100*.16)*(s.politique==='serie'?1.18:(s.politique==='prestige'?.82:1)),.58,1.28);
    }
    if(b.type==='verrerie'){
      const s=personnel(b).signature,chaud=.62+s.temperature/100*.46;return clamp(chaud*(s.politique==='continu'?1.12:(s.politique==='artistique'?.84:1))*(1-Math.min(.25,s.defauts/220)),.52,1.38);
    }
    if(b.type==='fonderie'){
      const s=personnel(b).signature;return clamp((.63+s.temperature/100*.48)*(1-Math.min(.28,s.scories/240))*(s.politique==='recuperation'?.90:(s.politique==='alliage'?.94:1)),.50,1.36);
    }
    if(b.type==='forge'){
      const s=personnel(b).signature,ideal=s.politique==='entretien'?72:(s.politique==='arsenal'?90:82),stable=1-Math.min(1,Math.abs(s.chaleur-ideal)/60);return clamp((.70+stable*.25+s.rythme/100*.18)*(s.politique==='arsenal'?.91:(s.politique==='entretien'?1.05:1)),.55,1.35);
    }
    if(b.type==='armurerie'){
      const s=personnel(b).signature;return clamp((.76+s.ajustement/100*.28)*(1-Math.min(.25,s.chutes/220))*(s.politique==='serie'?1.12:(s.politique==='protection'?.86:1)),.56,1.30);
    }
    if(b.type==='orfevre'){
      const s=personnel(b).signature;return clamp((.72+s.precision/100*.32)*(1-Math.min(.24,s.eclats/220))*(s.politique==='monnaie'?1.10:(s.politique==='audacieux'?.88:1)),.54,1.26);
    }
    if(b.type==='moulinEau'){
      const s=personnel(b).signature,ouv=ouvertureMoulinEau(b)/100,force=(s.debit*.62+s.bassin*.38)/100;
      return clamp(.48+force*(.48+ouv*.62),.42,1.56);
    }
    if(b.type!=='moulin')return 1;
    const s=personnel(b).signature;
    if(s.politique==='chasseur')return s.vent<35?.48:clamp(.58+s.vent/62,.65,1.72);
    if(s.politique==='inertie')return .66+(s.vent*.52+s.inertie*.48)/100*.70;
    return .76+(s.vent*.72+s.inertie*.28)/100*.58;
  }
  function ouvertureMoulinEau(b){const s=personnel(b).signature;return clamp(s.ouverture+(s.politique==='puissance'?16:(s.politique==='retenue'?-16:0)),15,100);}

  function soutienRepos() {
    let n=0;
    for(const bid in E().bat){const b=E().bat[bid];if(b.type==='puits'&&personnel(b).signature.politique==='bourg')n++;}
    return clamp(n*.04,0,.16);
  }

  function troupeauMax(b) { return 8+Math.max(1,b.niv||1)*2; }
  function reproducteurs(b) {
    const s=personnel(b).signature;
    return s.politique==='renouvellement'?6:(s.politique==='viande'?3:4);
  }
  function peutDemarrer(b,rec) {
    if(!gere(b)||!rec)return {ok:true,raison:''};
    if(b.type==='bergerie'){
      const cout=rec.id==='abattre_complet'?1.5:(rec.id==='abattre_mouton'?1:0),s=personnel(b).signature;
      if(cout&&s.troupeau-cout<reproducteurs(b))return {ok:false,raison:'reproducteurs protégés'};
      if((rec.id==='tondre'||rec.id==='paitre')&&s.troupeau<2)return {ok:false,raison:'troupeau trop petit'};
    }else if(b.type==='etable'){
      const cout=rec.id==='abattre_boeuf'?1.5:(rec.id==='abattre_vache'?1:0),s=personnel(b).signature;
      if(cout&&s.troupeau-cout<etableReserve(b))return {ok:false,raison:'reproductrices protégées'};
      if(rec.id==='traire'&&s.troupeau<2)return {ok:false,raison:'troupeau trop petit'};
    }else if(b.type==='rucher'){
      const s=personnel(b).signature,besoin=rec.id==='miel_de_fleurs'?4.2:(rec.id==='recolter_miel'?2.4:0);
      if(besoin&&s.reserve<besoin)return {ok:false,raison:'hausses en remplissage'};
      if(rec.id==='miel_de_fleurs'&&nectarVillage()<18)return {ok:false,raison:'réseau floral insuffisant'};
    }else if(b.type==='fumoir'){
      const s=personnel(b).signature;
      if(rec.id!=='nettoyer_fumoir'&&s.creosote>=88)return {ok:false,raison:'conduit à ramoner'};
    }else if(b.type==='laiterie'){
      const besoin={baratter:2,fromage_frais:6,affiner_cave:11}[rec.id]||0,s=personnel(b).signature;
      if(besoin&&s.ferments<besoin)return {ok:false,raison:'ferments à renouveler'};
    }else if(b.type==='carriere'){
      const s=personnel(b).signature,mat={extraire_pierre:'pierre',tamiser_sable:'sable',extraire_argile:'argile'}[rec.id];
      if(rec.id!=='soutenir_front'&&s.stabilite<16)return {ok:false,raison:'front à soutenir'};
      if(mat&&s.couches[mat]<4)return {ok:false,raison:'couche à renouveler'};
    }else if(b.type==='mine'){
      const s=personnel(b).signature;
      if(!['ventiler_mine','etayer_mine'].includes(rec.id)&&s.ventilation<12)return {ok:false,raison:'air irrespirable'};
      if(!['ventiler_mine','etayer_mine'].includes(rec.id)&&s.soutenement<12)return {ok:false,raison:'galerie à étayer'};
    }else if(b.type==='charbonniere'&&rec.id==='cuire_charbon'){
      const s=personnel(b).signature,seuil=s.politique==='precoce'?35:(s.politique==='complete'?90:64);
      if(s.temperature>94)return {ok:false,raison:'meule en surchauffe'};
      if(s.maturation<seuil)return {ok:false,raison:'carbonisation '+Math.floor(s.maturation)+' / '+seuil};
    }else if(b.type==='tuilerie'&&recetteFourTuilerie(rec.id)){
      const s=personnel(b).signature,besoin=besoinSechageTuilerie(b,rec);
      if(s.temperature>96)return {ok:false,raison:'four en surchauffe'};
      if(s.sechage<besoin)return {ok:false,raison:'pièces sèches '+Math.floor(s.sechage)+' / '+besoin};
    }else if(b.type==='poterie'&&recetteFourPoterie(rec.id)){
      const s=personnel(b).signature,besoin=besoinFormesPoterie(b,rec);
      if(s.formes<besoin)return {ok:false,raison:'formes sèches '+Math.floor(s.formes)+' / '+besoin};
    }else if(b.type==='verrerie'){
      const s=personnel(b).signature;
      if(s.temperature>98)return {ok:false,raison:'four en surchauffe'};
    }else if(b.type==='fonderie'){
      const s=personnel(b).signature;
      if(rec.id!=='purger_four'&&s.scories>=90)return {ok:false,raison:'creuset à purger'};
      if(rec.id!=='purger_four'&&s.temperature>98)return {ok:false,raison:'four en surchauffe'};
    }else if(b.type==='forge'){
      const s=personnel(b).signature;if(s.chaleur>98)return {ok:false,raison:'foyer en surchauffe'};
    }else if(b.type==='armurerie'){
      const s=personnel(b).signature;
      if(rec.id==='recycler_chutes_armure'&&s.chutes<9)return {ok:false,raison:'pas assez de chutes'};
      if(rec.id!=='recycler_chutes_armure'&&s.chutes>=92)return {ok:false,raison:'atelier à débarrasser'};
    }else if(b.type==='orfevre'){
      const s=personnel(b).signature;
      if(rec.id==='polir_outils_orfevre'&&s.eclats<8)return {ok:false,raison:'outils déjà propres'};
      if(rec.id!=='polir_outils_orfevre'&&s.eclats>=90)return {ok:false,raison:'établi à nettoyer'};
    }
    return {ok:true,raison:''};
  }
  function etableMax(b){return 5+Math.max(1,b.niv||1)*1.5;}
  function etableReserve(b){return personnel(b).signature.politique==='renouvellement'?4:2;}
  function profondeurMine(b){const s=personnel(b).signature,base=Math.max(1,b.niv||1)*9;return clamp(base+(s.politique==='surface'?-14:(s.politique==='profonde'?18:0)),4,100);}
  function sechageMaxTuilerie(b){return 90+Math.max(1,b.niv||1)*15;}
  function recetteFourTuilerie(id){return ['cuire_brique','cuire_tuile','poterie'].includes(id);}
  function besoinSechageTuilerie(b,rec){
    if(!recetteFourTuilerie(rec&&rec.id))return 0;
    const s=personnel(b).signature,base=rec.id==='cuire_tuile'?12:(rec.id==='poterie'?10:9);
    return Math.round(base*(.60+s.charge/100*.70));
  }
  function formesMaxPoterie(b){return 42+Math.max(1,b.niv||1)*10;}
  function recetteFourPoterie(id){return ['cuire_pots','fournee_gres'].includes(id);}
  function besoinFormesPoterie(b,rec){
    if(!recetteFourPoterie(rec&&rec.id))return 0;
    const s=personnel(b).signature,base=rec.id==='fournee_gres'?13:7;
    return Math.round(base*(.62+s.charge/100*.68));
  }
  function bainMaxVerrerie(b){return 70+Math.max(1,b.niv||1)*12;}
  function familleFonderie(id){
    if(['couler_cuivre','couler_bronze'].includes(id))return 'cuivreux';
    if(['couler_argent','couler_or'].includes(id))return 'precieux';
    if(id==='fondre_mithril')return 'mystique';
    return 'ferreux';
  }
  function finirCommandeForge(b,arsenal){
    if(!b||b.type!=='forge')return;
    const s=personnel(b).signature,ideal=s.politique==='entretien'?72:(s.politique==='arsenal'?90:82),ecart=Math.abs(s.chaleur-ideal);
    s.rythme=clamp(s.rythme+Math.max(.15,1.15-ecart*.018),0,100);
    s.precision=clamp(s.precision+(arsenal?1.15:.35)-Math.max(0,ecart-18)*.012,0,100);
    s.chaleur=clamp(s.chaleur+1.6,0,100);
  }
  function risqueOrfevre(b,rec){
    const s=personnel(b).signature,base={monnayer:.04,collier_perles:.10,joaillerie:.24,couler_cloche:.08,sertir:.38}[rec&&rec.id]||.06;
    const tension=(s.tension-50)/100,politique=s.politique==='prudent'?-.10:(s.politique==='audacieux'?.14:0);
    return clamp(base+tension*.22+politique-s.precision/500+s.eclats/420,.01,.72);
  }

  const RECETTES_MARMITE={
    'fromage+herbe+miel':'fromage_herbes_secret',
    'fromage+huile+legume':'gratin_racines_secret',
    'champignon+herbe+viande':'ragout_bois_secret',
    'fromage+legume+poisson':'soupe_aventurier_secret',
    'farine+fruit+miel':'brioche_verger_secret',
    'miel+poisson+viande':'banquet_village_secret',
  };
  function ajouterIngredientCuisine(b,id){
    if(!b||b.type!=='cuisine')return false;
    const s=personnel(b).signature,i=s.marmite.indexOf(id);
    if(i>=0){s.marmite.splice(i,1);return true;}
    if(s.marmite.length>=3)s.marmite.shift();
    s.marmite.push(id);return true;
  }
  function viderMarmiteCuisine(b){if(!b||b.type!=='cuisine')return false;personnel(b).signature.marmite=[];return true;}
  function testerMarmiteCuisine(b){
    if(!b||b.type!=='cuisine')return {ok:false,raison:'Ce bâtiment ne possède pas de marmite.'};
    const s=personnel(b).signature;
    if(s.marmite.length!==3)return {ok:false,raison:'Choisissez trois ingrédients.'};
    const cout={};for(const id of s.marmite)cout[id]=(cout[id]||0)+1;
    if(!window.Etat.assez(cout))return {ok:false,raison:'Ingrédients insuffisants.',cout};
    window.Etat.depenser(cout);
    const rid=RECETTES_MARMITE[s.marmite.slice().sort().join('+')],deja=!!(rid&&s.connues[rid]);
    s.marmite=[];s.chaleur=clamp(s.chaleur+3,0,100);
    if(!rid)return {ok:true,nouveau:false,raison:'Le mélange nourrit le personnel, mais ne révèle aucune recette.'};
    if(!deja){s.connues[rid]=true;s.decouvertes=Object.keys(s.connues).length;}
    return {ok:true,nouveau:!deja,rec:window.REC&&window.REC[rid],raison:deja?'Cette recette figure déjà dans le carnet.':'Nouvelle recette découverte !'};
  }
  function modifierEntrees(b,rec,entrees){
    const copie=Object.assign({},entrees||{});if(!b||!rec||b.type!=='fumoir'||rec.id==='nettoyer_fumoir')return copie;
    const essence=personnel(b).signature.essence;
    if(essence==='fruitier')copie.greffon=(copie.greffon||0)+1;
    else if(essence==='resineux')copie.resine=(copie.resine||0)+1;
    else if(essence==='charbon'){
      const bois=copie.bois||1;delete copie.bois;copie.charbonbois=(copie.charbonbois||0)+Math.max(1,Math.ceil(bois*.65));
    }
    return copie;
  }

  window.EcosystemesBatiments = { TYPES, CADENCES, gere, definition, personnel, confort,
    disponibilite, equipeHabitant, affecterEquipe, repartirEquipes, ajouterEquipe, retirerEquipe,
    tickHabitant, tick, modifierEntrees, modifierSorties, finirRecette, peutDemarrer,
    pollinisationCible, humiditeCible, nectarCible, nectarVillage, facteurSignature, ouvertureMoulinEau, soutienRepos, troupeauMax, reproducteurs,
    etableMax, etableReserve, profondeurMine, sechageMaxTuilerie, recetteFourTuilerie, besoinSechageTuilerie,
    formesMaxPoterie, recetteFourPoterie, besoinFormesPoterie,
    bainMaxVerrerie,
    familleFonderie,
    finirCommandeForge,
    risqueOrfevre,
    RECETTES_MARMITE, ajouterIngredientCuisine, viderMarmiteCuisine, testerMarmiteCuisine };
})();
