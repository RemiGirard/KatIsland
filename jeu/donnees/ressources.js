/* ============================================================
   LE BOURG — donnees/ressources.js
   Tout ce qui se stocke, se compte et se dépense.

   Une ressource porte : sa catégorie (qui décide de son entrepôt),
   son PALIER (qui décide de son rang dans la chaîne de raffinage), sa
   valeur marchande en écus, et son icône — un descripteur de forme lu
   par `Icones`, jamais une image.
   -> window.RES, window.RES_ORDRE, window.CAT_RES
   ============================================================ */
"use strict";
(function () {

  const R = {};
  const ORDRE = [];

  /* r(id, nom, cat, tier, valeur, forme, couleurs, description) */
  function r(id, nom, cat, tier, val, f, c, desc) {
    R[id] = { id, nom, cat, tier, val, ico: { f, c }, desc: desc || '' };
    ORDRE.push(id);
    return R[id];
  }

  /* ---------------------------------------------------------------
     LES CATÉGORIES. Elles ne sont pas décoratives : chaque catégorie a
     son propre plafond de stockage, relevé par un bâtiment différent.
     On ne range pas du minerai dans une grange.
     --------------------------------------------------------------- */
  const CAT = {
    vivres:    { id:'vivres',    nom:'Vivres',      ordre:1, batStock:'grange',
                 desc:"Ce qui se mange. Se garde à la grange, et se gâte si le bourg n'a plus de place." },
    matiere:   { id:'matiere',   nom:'Matières',    ordre:2, batStock:'entrepot',
                 desc:'Bois, pierre, terre — le brut qui sort du sol et de la forêt.' },
    mineral:   { id:'mineral',   nom:'Minéraux',    ordre:3, batStock:'entrepot',
                 desc:'Minerais et métaux. Lourds : ils encombrent vite.' },
    textile:   { id:'textile',   nom:'Textiles',    ordre:4, batStock:'entrepot',
                 desc:'De la toison au drap, en passant par le cuir.' },
    ouvrage:   { id:'ouvrage',   nom:'Ouvrages',    ordre:5, batStock:'entrepot',
                 desc:'Ce qui est fabriqué : outils, armes, harnois, objets.' },
    savoir:    { id:'savoir',    nom:'Savoirs',     ordre:6, batStock:'chateau',
                 desc:'Parchemins, grimoires, plans. Ne pèsent rien, valent cher.' },
    profond:   { id:'profond',   nom:'Profondeurs', ordre:7, batStock:'chateau',
                 desc:"Ce qu'on ne trouve NULLE PART dans le bourg : il faut descendre le chercher." },
    monnaie:   { id:'monnaie',   nom:'Trésor',      ordre:8, batStock:'chateau',
                 desc:'Écus, médailles — ce qui achète ce qui ne se fabrique pas.' },
    peuple:    { id:'peuple',    nom:'Le peuple',   ordre:9, batStock:'nurserie',
                 desc:"Ceux qui sont nés ici. Ils ne tiendront jamais un poste : la nurserie n'élève pas des ouvriers, elle élève une compagnie." },
  };

  /* =============================================================
     I. VIVRES
     ============================================================= */
  r('poisson',   'Poisson',            'vivres', 0, 2,  'poisson', ['#7f9fb2','#4f6a80'],
    "La première richesse du bourg : elle passe sous le quai et ne demande qu'un filet.");
  r('ble',       'Blé',                'vivres', 0, 3,  'epi',     ['#c9a94e','#8f7430'],
    'Il faut une terrasse plate, de la patience, et un chat qui ne dorme pas dans les sillons.');
  r('legume',    'Racines',            'vivres', 0, 3,  'tas',     ['#b4763f','#7d4c26'],
    'Navets, panais, carottes. Personne ne les aime, tout le monde en mange.');
  r('lait',      'Lait',               'vivres', 1, 5,  'pot',     ['#e8e4d6','#b8b2a0','#8d9199'],
    'Tiède, deux fois par jour. La moitié disparaît avant la laiterie ; nul ne sait comment.');
  r('miel',      'Miel',               'vivres', 1, 9,  'pot',     ['#d8a83a','#a07a1e','#c9a24a'],
    'Se paye en piqûres. Se vend en or.');
  r('champignon','Champignons',        'vivres', 1, 6,  'champignon', ['#a8563f','#e8dcc4'],
    'Cueillis en lisière. Trois sur quatre sont bons ; le quatrième fait de très beaux rêves.');
  r('farine',    'Farine',             'vivres', 1, 7,  'sac',     ['#e0d8c0','#b0a68c'],
    'La meule tourne, le grain devient poudre, et le meunier devient blanc.');
  r('viande',    'Viande',             'vivres', 1, 8,  'os',      ['#c07a6a','#8a4f42'],
    "Le troupeau y passe, mais l'hiver aussi.");
  r('pain',      'Pain',               'vivres', 2, 16, 'pain',    ['#c9954e','#8f6430'],
    "Le vrai carburant du bourg : un habitant qui a du pain travaille sans se plaindre.");
  r('fromage',   'Fromage',            'vivres', 2, 20, 'fromage', ['#e2cf7c','#b09a48'],
    'Affiné sur claie. Le bourg entier sait quand la cave est ouverte.');
  r('poissonfume','Poisson fumé',      'vivres', 2, 22, 'poisson', ['#b9926a','#7f6242'],
    'Se garde tout un hiver. C\'est ce qu\'on emporte en expédition.');
  r('tourte',    'Tourte',             'vivres', 3, 54, 'pain',    ['#d8a85c','#9a6f34'],
    'Pain, poisson, fromage : les trois d\'un coup. Un repas de fête, un rendement de fête.');

  /* =============================================================
     II. MATIÈRES
     ============================================================= */
  r('bois',      'Bois',               'matiere', 0, 2,  'buche',   ['#8a6a45','#5a412a'],
    'Abattu en lisière. Tout commence par lui : les autres métiers ne tiennent pas debout sans charpente.');
  r('pierre',    'Pierre',             'matiere', 0, 3,  'pierre',  ['#8a8272','#5f594c'],
    'Arrachée au contrefort à coups de coin. Lourde, lente, indispensable.');
  r('argile',    'Argile',             'matiere', 0, 3,  'tas',     ['#8f7150','#5f4a32'],
    'Terre grasse de la fosse. On la marche au pied avant de la cuire.');
  r('sable',     'Sable',              'matiere', 0, 3,  'tas',     ['#ddd2b8','#b0a68c'],
    'Tamisé au bord de la rivière. Sans lui, pas de verre.');
  r('eau',       'Eau',                'matiere', 0, 1,  'goutte',  ['#5f9ad0','#3a6ea8'],
    "Le puits en donne autant qu'on veut, à condition d'avoir quelqu'un pour tourner la manivelle.");
  r('herbe',     'Simples',            'matiere', 0, 5,  'feuille', ['#5d7247','#3f5a30'],
    'Plantes de remède, cueillies et séchées tête en bas.');
  r('planche',   'Planches',           'matiere', 1, 9,  'planche', ['#c8ab7c','#8f7448'],
    'La grume passée sous la scie à cadre. C\'est la matière de tous les ateliers.');
  r('pierretaille','Pierre de taille', 'matiere', 1, 12, 'cube',    ['#a8a294','#6f695c'],
    'Équarrie au ciseau. On ne bâtit un rempart avec rien d\'autre.');
  r('brique',    'Briques',            'matiere', 1, 10, 'brique',  ['#a8563f','#6f3626'],
    'Cuites au four à dôme. Elles montent vite et supportent le feu.');
  r('tuile',     'Tuiles',             'matiere', 1, 11, 'tuile',   ['#b8663f','#7d3f26'],
    'Rangées de chant sur les claies. Un toit sans elles est un toit provisoire.');
  r('charbonbois','Charbon de bois',   'matiere', 1, 12, 'charbon', ['#25252a','#4a4a52'],
    'Tiré de la meule après trois jours de veille. Brûle deux fois plus chaud que le bois.');
  r('poutre',    'Poutres',            'matiere', 2, 34, 'planche', ['#8a6a45','#4a3826'],
    'Assemblées à tenon. C\'est ce qui permet aux bâtiments de dépasser un étage.');
  r('verre',     'Verre',              'matiere', 2, 30, 'gobelet', ['#9fc4cc','#6f929c'],
    'Sable et cendre, portés au blanc. Le seul matériau froid du bourg.');
  r('corde',     'Cordage',            'matiere', 1, 8,  'corde',   ['#b09a6c','#8a7040'],
    'Fibre tordue à trois brins. Les treuils et les filets en dévorent.');
  r('cire',      'Cire',               'matiere', 1, 14, 'cire',    ['#e0c463','#b09040'],
    'Récoltée avec le miel. Chandelles, sceaux, et tablettes à écrire.');

  /* =============================================================
     III. MINÉRAUX
     ============================================================= */
  r('fer',       'Minerai de fer',     'mineral', 0, 5,  'pierre',  ['#8a7a6a','#5a4c40'],
    'La veine rousse du premier niveau. Le bourg tout entier en dépend.');
  r('charbon',   'Charbon de terre',   'mineral', 0, 6,  'charbon', ['#1e1e22','#43434a'],
    'Trouvé plus bas que le fer. Il fait la différence entre fondre et ne pas fondre.');
  r('cuivre',    'Minerai de cuivre',  'mineral', 0, 8,  'pierre',  ['#a86a3f','#6f4226'],
    'Vert-de-gris en surface, rouge à cœur.');
  r('etain',     "Minerai d'étain",    'mineral', 0, 10, 'pierre',  ['#9aa2ab','#6b737c'],
    'Rare, tendre, et sans lui le bronze n\'existe pas.');
  r('argentmin', "Minerai d'argent",   'mineral', 0, 18, 'pierre',  ['#b6bec6','#7d858d'],
    'Une veine claire dans la roche noire. On la suit en retenant son souffle.');
  r('ormin',     "Minerai d'or",       'mineral', 0, 34, 'pierre',  ['#c9a24a','#8a6a2a'],
    'Au fond du fond. Trois coups de pioche pour une pépite.');
  r('lingotfer', 'Lingot de fer',      'mineral', 1, 22, 'lingot',  ['#9aa0a6','#5f656c'],
    'Coulé en gueuse, refroidi lentement. La monnaie réelle des artisans.');
  r('lingotcuivre','Lingot de cuivre', 'mineral', 1, 30, 'lingot',  ['#c07a42','#7d4a24'],
    'Se travaille tiède. Chaudrons, cloches, ferrures fines.');
  r('bronze',    'Bronze',             'mineral', 2, 58, 'lingot',  ['#b08a44','#6f5424'],
    'Cuivre et étain. Le premier alliage du bourg, et le premier vrai tranchant.');
  r('acier',     'Acier',              'mineral', 2, 78, 'lingot',  ['#b8c0c8','#6f767e'],
    'Fer battu et rebattu au charbon de bois. Ce qui sépare une lame d\'un tisonnier.');
  r('lingotargent','Lingot d\'argent', 'mineral', 2, 96, 'lingot',  ['#d0d8e0','#8a939c'],
    "Pour l'orfèvre et pour ce qui ne supporte pas le fer.");
  r('lingotor',  "Lingot d'or",        'mineral', 3, 220,'lingot',  ['#e0bc58','#a07a1e'],
    'Trop tendre pour une arme, exactement ce qu\'il faut pour une couronne.');
  r('mithril',   'Mithril',            'mineral', 4, 900,'lingot',  ['#a8d8e0','#5f8f9c'],
    "Ne se trouve pas au bourg : il remonte des profondeurs, et l'on ne sait pas le fondre autrement.");

  /* =============================================================
     IV. TEXTILES
     ============================================================= */
  r('laine',     'Laine',              'textile', 0, 4,  'pelote',  ['#e2ddcc','#b0aa96'],
    'Tondue au printemps. Les moutons sont ravis, les chats aussi.');
  r('lin',       'Lin',                'textile', 0, 4,  'epi',     ['#c8c4a0','#8f8c68'],
    'Rouissé, teillé, peigné. Trois métiers pour un fil.');
  r('peau',      'Peaux',              'textile', 0, 6,  'peau',    ['#c2a274','#8a6a45'],
    'Brutes, encore vertes. Rien à en faire avant les cuves.');
  r('fil',       'Fil',                'textile', 1, 12, 'bobine',  ['#d8cdb4','#a89c80'],
    'Filé au rouet, enroulé, compté en écheveaux.');
  r('cuir',      'Cuir',               'textile', 1, 20, 'peau',    ['#8a5f38','#5a3d22'],
    'Tanné trois semaines dans le tan. Souple, solide, et qui sent fort.');
  r('drap',      'Drap',               'textile', 2, 42, 'rouleau', ['#7a6a8c','#4f4260'],
    'Tissé puis foulé au moulin. C\'est ce qui habille une compagnie entière.');
  r('toile',     'Toile',              'textile', 2, 28, 'rouleau', ['#ddd6c2','#a8a290'],
    'Écrue, serrée. Voiles, sacs, tentes, et les ailes du moulin.');

  /* =============================================================
     V. OUVRAGES
     ============================================================= */
  r('clou',      'Clouterie',          'ouvrage', 1, 10, 'lance',   ['#8d9199','#5a5e66'],
    'Clous, gonds, pentures. Invisible, et pourtant tout en dépend.');
  r('outil',     'Outillage',          'ouvrage', 2, 60, 'marteau', ['#8d9199','#5a5e66'],
    "Un ouvrier outillé travaille bien plus vite. Un outil s'use : il faudra en refaire.");
  r('outilacier','Outillage d\'acier', 'ouvrage', 3, 210,'marteau', ['#c2cad2','#6f767e'],
    'Trempé, affûté, emmanché de frêne. Deux fois la cadence, trois fois la durée.');
  r('arme',      'Armes',              'ouvrage', 3, 150,'epee',    ['#c9cdd2','#8a8f96'],
    "Lames, lances, frondes. Ce qui décide de la profondeur qu'on atteindra.");
  r('armure',    'Harnois',            'ouvrage', 3, 165,'plastron',['#9aa2ab','#6b737c'],
    'Cottes, plastrons, heaumes. Ce qui décide de la profondeur dont on reviendra.');
  r('bouclier',  'Écus',               'ouvrage', 3, 120,'bouclier',['#8a6a45','#c9a24a'],
    'Bois cintré, cuir bouilli, bordure de fer. Taillé pour des épaules étroites.');
  r('bijou',     'Joaillerie',         'ouvrage', 4, 480,'bague',   ['#d8b048','#8a6a2a','#4a6c8a'],
    'Sertie, gravée, numérotée. Se porte, se vend, et impressionne les émissaires.');
  r('poterie',   'Poterie',            'ouvrage', 1, 14, 'pot_terre',['#a8764a','#7a5232'],
    'Jarres, cruches, pots de conserve. Sans elle rien ne se garde.');
  r('fiole',     'Fioles',             'ouvrage', 2, 26, 'fiole',   ['#9fc4cc','#6f929c'],
    'Soufflées à la canne. Vides, elles ne valent rien ; pleines, elles sauvent des vies.');
  r('potion',    'Potions',            'ouvrage', 3, 90, 'fiole',   ['#c9739a','#8a3f60'],
    "Ce qu'on emporte dans la descente et qu'on regrette de n'avoir pas pris en double.");
  r('huile',     'Huile',              'ouvrage', 2, 24, 'goutte',  ['#c9a24a','#8a6a2a'],
    'Pour les lampes, les gonds, et les feux qu\'on ne veut pas voir s\'éteindre.');

  /* =============================================================
     VI. SAVOIRS
     ============================================================= */
  r('parchemin', 'Parchemin',          'savoir', 2, 40, 'parchemin',['#ddd2b4','#b4a888'],
    'Peau raclée, poncée, tendue. Le support de tout ce qui se transmet.');
  r('encre',     'Encre',              'savoir', 2, 30, 'pot',     ['#2a2438','#171320','#8a8272'],
    'Noir de fumée, gomme et fiel. Elle ne pardonne pas les repentirs.');
  r('sort',      'Grimoires',          'savoir', 4, 320,'grimoire',['#5a3f6e','#3a2a48','#c9a24a'],
    'Un sort copié est un sort qu\'on peut lancer. Le scriptorium en fabrique un à la fois.');
  r('plan',      'Plans',              'savoir', 3, 260,'carte',   ['#ddd2b4','#8a7a58'],
    "Le dessin d'un ouvrage qu'on ne savait pas faire. Se rapporte des profondeurs.");
  r('chant',     'Chants de guerre',   'savoir', 3, 180,'plume',   ['#e0dcd0','#a8a496'],
    'Écrits par le barde, appris par la troupe. Ils valent une armure de plus.');

  /* =============================================================
     V bis. CE QUE LES NOUVEAUX ATELIERS FONT POUSSER ET TIRENT
     ============================================================= */
  r('tournesol', 'Tournesols',         'vivres', 0, 4,  'fleur',   ['#f2c530','#b88a14'],
    "Hauts comme un chat debout, la tête qui suit le jour. On en tire de l'huile et une farine grasse.");
  r('fleur',     'Fleurs',             'matiere', 0, 5,  'fleur',   ['#c56d8f','#8a4a62'],
    "Un carré de couleurs qu'on ne mange pas. L'abeille y va, l'alchimiste aussi, et le bourg respire mieux.");
  r('paille',    'Paille',             'matiere', 0, 2,  'tas',     ['#d8bd6f','#a89044'],
    "Ce qui reste du blé quand on lui a pris son grain. Litière, chaume, torchis : rien ne se perd.");
  r('farineclaire','Farine de tournesol','vivres', 1, 8,  'sac',     ['#e8d8a0','#b8a468'],
    "Grasse et dorée, elle fait des tourtes qui tiennent au corps deux fois plus longtemps.");
  r('suif',      'Suif',               'matiere', 1, 12, 'pot',     ['#e8e2cc','#b0a888'],
    "La graisse fondue et clarifiée. Elle éclaire, elle graisse l'essieu, et elle sauve un cuir.");
  r('parfum',    'Parfum',             'ouvrage', 3, 190,'fiole',   ['#c56d8f','#7a3f58'],
    "Trois cents fleurs pour une fiole. Personne au bourg n'en met ; tout le monde en vend.");

  /* =============================================================
     V ter. LE VERGER
     La seule culture qui ne se sème pas : elle se plante, et l'on
     attend. C'est pourquoi le greffon vaut plus cher que le fruit — un
     fruit se mange une fois, un greffon donne pendant vingt ans.
     ============================================================= */
  r('fruit',     'Fruits',             'vivres', 0, 5,  'fruit',   ['#c4443a','#8a2a24'],
    "Pommes, prunes, coings selon la saison. Le seul vivre du bourg qu'on cueille sans rien tuer ni moudre.");
  r('greffon',   'Greffons',           'matiere', 1, 16, 'feuille', ['#6d8a4a','#425a2c'],
    "Une brindille de bon arbre liée sur un sauvageon. Trois ans d'avance sur celui qui sème un noyau.");
  r('confiture', 'Confiture',          'vivres', 2, 34, 'pot',     ['#c4443a','#7a2a30'],
    "Fruits et miel cuits jusqu'à ce que la cuillère tienne debout. Un été qu'on garde pour l'hiver.");
  r('cidre',     'Cidre',              'vivres', 2, 40, 'gobelet', ['#d8a03a','#9a6a1c'],
    "Pressé, laissé à ses bulles, tiré au tonneau. La taverne n'a jamais si bien porté son nom.");

  /* =============================================================
     V quater. LE PEUPLE
     La seule « ressource » qui a un nom et une mère. On ne la vend
     pas, on ne la troque pas : on la dépense au terrain
     d'entraînement, et elle ne revient pas toujours.
     ============================================================= */
  r('chaton',    'Chatons',            'peuple', 0, 0,  'oeuf',    ['#e8dcc4','#c4b696'],
    "Nés au bourg, élevés au lait et au poisson. Ils ne tiendront jamais un poste : ceux-là sont pour la compagnie.");

  /* =============================================================
     VI bis. LES TROUVAILLES
     Aucun métier ne les PRODUIT : on les trouve, au hasard des cycles,
     et le hasard penche selon qui tient le poste. Elles ne servent à
     rien d'autre qu'à préparer la descente — c'est justement ce qui
     rend la pêche du mardi utile à l'étage soixante.
     ============================================================= */
  r('perle',     'Perle',              'mineral', 2, 130,'gemme',   ['#e8e0e8','#a89ab0'],
    "Une sur mille huîtres, et il faut ouvrir les mille. Elle tient la lumière longtemps.");
  r('ecaille',   'Écaille',            'textile', 2, 75, 'peau',    ['#7fb0b8','#3f6a74'],
    "Large comme une patte, dure comme une tuile. On en coud des gardes qui ne brûlent pas.");
  r('ambre',     'Ambre',              'mineral', 2, 100,'gemme',   ['#d8a03a','#8f5f14'],
    "De la résine que le temps a faite pierre. Il y a parfois quelque chose dedans.");
  r('resine',    'Résine',             'matiere', 1, 20, 'pot',     ['#c98a34','#8a5a18'],
    "Poissée, odorante, increvable. Elle colle tout et brûle très bien.");
  r('silex',     'Silex',              'mineral', 1, 14, 'pierre',  ['#5a5a64','#2f2f38'],
    "Un éclat qui coupe encore mieux qu'une lame de fer, et se retaille sur un genou.");
  r('salpetre',  'Salpêtre',           'mineral', 2, 48, 'tas',     ['#ded8c8','#a89c84'],
    "La fleur blanche des caves humides. L'alchimiste la ramasse à la plume.");
  r('plume',     'Plume de Nuée',      'textile', 1, 26, 'plume',   ['#8a7fa8','#4a4260'],
    "Ramassée après un raid, ou tombée d'un vol trop bas. Légère et bizarrement chaude.");
  r('racine',    'Racine amère',       'matiere', 1, 18, 'tas',     ['#6a5a3a','#3d3220'],
    "Personne n'en fait de soupe. L'herboriste, lui, sait ce qu'elle vaut.");
  r('cendre',    'Cendre vive',        'matiere', 1, 10, 'tas',     ['#9a9490','#4a4642'],
    "Ce qui reste d'un feu bien mené. On en tire la lessive, le verre et pire.");
  r('limaille',  'Limaille',           'mineral', 2, 38, 'tas',     ['#8d9199','#4a4e56'],
    "Le fer que la lime a mangé. On la balaie, on la refond, on recommence.");

  /* =============================================================
     VI ter. LES GARDES DE PROFONDEUR
     Chaque biome de la tour tue d'une façon particulière, et chacune se
     pare d'une façon particulière. Ces gardes sont des CHARGES : elles
     s'usent étage après étage, et c'est le bourg qui les refait.
     ============================================================= */
  r('gardefeu',  'Garde de feu',       'ouvrage', 3, 220,'fiole',   ['#e0784a','#8a3418'],
    "Onguent d'écaille et de résine. Tant qu'il en reste, les Fournaises ne mordent pas.");
  r('gardevenin','Garde de venin',     'ouvrage', 3, 220,'fiole',   ['#8fc04a','#46701c'],
    "Décoction de racine amère. Amère à faire, amère à boire, et sans elle on ne passe pas.");
  r('gardegel',  'Garde de gel',       'ouvrage', 3, 240,'fiole',   ['#9fd0e0','#3f7d96'],
    "Plume de Nuée cousue double et huile chaude. Le Grand Froid ne pardonne rien d'autre.");
  r('gardefoudre','Garde de foudre',   'ouvrage', 4, 280,'fiole',   ['#e6d06a','#96762a'],
    "Fil de cuivre, ambre et terre battue. On la porte au poignet, pas au cou.");
  r('gardeombre','Garde d\'ombre',     'ouvrage', 4, 320,'fiole',   ['#a08fc0','#4a3a6a'],
    "Perle et cire brûlée. Elle ne fait pas de lumière : elle empêche l'ombre d'entrer.");

  /* =============================================================
     VII. PROFONDEURS — le butin exclusif de la descente
     ============================================================= */
  r('essence',   'Essence',            'profond', 2, 70, 'ame',     ['#8fd8e0','#4a8f9c'],
    "Ce qui reste d'un monstre quand on l'a bien battu. Aucun métier du bourg n'en produit.");
  r('gemme',     'Gemmes',             'profond', 3, 240,'gemme',   ['#4a6c8a','#26384a'],
    'Cristallisées dans le noir. L\'orfèvre les serre, l\'alchimiste les broie.');
  r('ossuaire',  'Reliquats',          'profond', 2, 55, 'crane',   ['#ddd6c2','#2a2620'],
    'Os, carapaces, dents. On en fait de la colle, des manches, et des choses moins avouables.');
  r('obsidienne','Obsidienne',         'profond', 3, 300,'cristal', ['#3a2f48','#1b1526'],
    'Verre de la terre profonde. Un tranchant qu\'aucune meule du bourg ne sait donner.');
  r('relique',   'Reliques',           'profond', 5, 1400,'couronne',['#d8b048','#8a6a2a'],
    "Portées par ce qui garde les étages profonds. Une par gardien, jamais deux.");
  r('coeurbiome','Cœur de biome',      'profond', 4, 620,'ame',     ['#e0a06a','#8a4a2a'],
    "Ce qui bat au fond d'un gardien. Chacun a le goût de son étage — braise, givre, venin.");
  r('oeilabyme', "Œil de l'abîme",     'profond', 5, 2600,'oeil',   ['#e0dcd0','#7f6fc0'],
    "On ne le trouve pas : c'est lui qui vous voit. Le dernier palier de la descente.");

  /* =============================================================
     VIII. TRÉSOR
     ============================================================= */
  r('ecu',       'Écus',               'monnaie', 0, 1,  'piece',   ['#d8b048','#8a6a2a'],
    'La monnaie du comté. Achète ce qui ne se fabrique pas, et paie ce qui ne se demande pas.');
  r('medaille',  'Médailles',          'monnaie', 3, 0,  'medaille',['#c9a24a','#8a6a2a'],
    "Frappées après chaque victoire d'expédition. Ne s'achètent pas : se gagnent.");

  /* ---------------------------------------------------------------
     Plafonds de base : le bourg sans entrepôt garde peu de choses.
     Les vivres tiennent mieux (on les mange), les minéraux mal (ils
     pèsent), les savoirs et le trésor n'ont pas de limite pratique.
     --------------------------------------------------------------- */
  const PLAFOND_BASE = { vivres: 120, matiere: 120, mineral: 80, textile: 80,
                         ouvrage: 40, savoir: 9999, profond: 9999, monnaie: 999999,
                         /* on ne peut pas entasser les chatons : sans nurserie,
                            aucune portée n'a d'endroit où grandir. */
                         peuple: 0 };

  window.RES = R;
  window.RES_ORDRE = ORDRE;
  window.CAT_RES = CAT;
  window.PLAFOND_BASE = PLAFOND_BASE;

})();
