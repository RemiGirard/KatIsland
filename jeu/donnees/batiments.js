/* ============================================================
   LE BOURG — donnees/batiments.js
   Les édifices, leurs postes de travail, et les RECETTES qu'on y lance.

   Trois idées gouvernent toute cette table :

   1. UN POSTE = UNE BARRE. Un bâtiment n'agit pas tout seul : il offre
      des postes, et un poste ne tourne que si un habitant s'y tient.
      Le nombre d'habitants est donc le vrai plafond du jeu.
   2. LE CHANTIER EST UNIQUE. Construire et améliorer passe par une file
      d'attente commune à tout le bourg, qui n'avance QUE si un habitant
      y est affecté. Bâtir, c'est renoncer à produire.
   3. RIEN N'EST GRATUIT EN PLACE. Chaque édifice occupe une parcelle sur
      une terrasse ; les terrasses sont finies.
   -> window.BAT, window.REC, window.METIERS, window.BAT_ORDRE
   ============================================================ */
"use strict";
(function () {

  const BAT = {}, REC = {}, ORDRE = [];

  /* ---------------- les métiers ----------------
     Chaque recette appartient à un métier. L'habitant qui la répète y
     gagne de l'expérience, et son gain de rang profite à TOUS les postes
     du même métier : on ne spécialise pas un chat, on spécialise le bourg. */
  const METIERS = {
    peche:    { id:'peche',    nom:'Pêche',        ico:{f:'poisson',c:['#7f9fb2','#4f6a80']} },
    bois:     { id:'bois',     nom:'Bûcheronnage', ico:{f:'hache',  c:['#8d9199','#5a5e66']} },
    champs:   { id:'champs',   nom:'Culture',      ico:{f:'epi',    c:['#c9a94e','#8f7430']} },
    elevage:  { id:'elevage',  nom:'Élevage',      ico:{f:'pot',    c:['#e8e4d6','#b8b2a0','#8d9199']} },
    mine:     { id:'mine',     nom:'Mine',         ico:{f:'pierre', c:['#8a7a6a','#5a4c40']} },
    feu:      { id:'feu',      nom:'Feu',          ico:{f:'flamme', c:['#ff9a3a','#c2480e']} },
    forge:    { id:'forge',    nom:'Forge',        ico:{f:'enclume',c:['#4a4e56','#7a7e86']} },
    tissage:  { id:'tissage',  nom:'Tissage',      ico:{f:'bobine', c:['#d8cdb4','#a89c80']} },
    cuisine:  { id:'cuisine',  nom:'Cuisine',      ico:{f:'pain',   c:['#c9954e','#8f6430']} },
    savoir:   { id:'savoir',   nom:'Savoir',       ico:{f:'plume',  c:['#e0dcd0','#a8a496']} },
    batisse:  { id:'batisse',  nom:'Bâtisse',      ico:{f:'marteau',c:['#8d9199','#5a5e66']} },
    guerre:   { id:'guerre',   nom:'Guerre',       ico:{f:'epee',   c:['#c9cdd2','#8a8f96']} },
    /* Deux métiers manquaient à l'appel. Le POTIER : la terre cuite
       n'est ni de la maçonnerie ni du feu de forge, c'est un tour et
       une main. Le NÉGOCIANT : jusqu'ici l'aubergiste et l'orfèvre
       vendaient sous l'étiquette « cuisine » et « forge », ce qui ne
       voulait rien dire — vendre est un métier. */
    poterie:  { id:'poterie',  nom:'Poterie',      ico:{f:'pot_terre',c:['#c47a4a','#8a4a2a']} },
    negoce:   { id:'negoce',   nom:'Négoce',       ico:{f:'piece',  c:['#d8b048','#8a6a2a']} },
  };

  /* ---------------------------------------------------------------
     Fabriques. `b()` déclare un édifice, `x()` une recette.
     --------------------------------------------------------------- */
  function b(id, o) {
    o.id = id;
    o.nivMax = o.nivMax || 10;
    o.postes = o.postes || [0];
    o.recettes = o.recettes || [];
    o.cout = o.cout || {};
    o.temps = o.temps || 30;
    o.rangees = o.rangees || [1, 2];
    o.gen = o.gen || id;
    BAT[id] = o; ORDRE.push(id);
    return o;
  }
  function x(id, o) { o.id = id; o.duree = o.duree || 10; o.in = o.in || {}; o.out = o.out || {};
    o.loot = o.loot || []; o.niv = o.niv || 1; o.xp = o.xp || Math.round(o.duree * 1.4);
    REC[id] = o; return o; }

  /* Un poste par niveau : la courbe est volontairement plate au début —
     un deuxième pêcheur se mérite. */
  const P = (...v) => v;

  /* =================================================================
     A. LE COMMENCEMENT — ce qu'on peut bâtir avec rien
     ================================================================= */

  b('pecherie', {
    nom:'Pêcherie', metier:'Pêcheur', cat:'recolte', rangees:[2],
    desc:"Un ponton, des séchoirs à filets, des nasses. C'est par là que le bourg commence : la rivière donne sans qu'on lui ait rien mis.",
    cout:{}, temps:20, postes:P(1,1,2,2,3,3,3,4,4,4),
    recettes:['peche_filet','peche_nasse','peche_fond','peche_glace','vivier_garder'],
  });
  x('peche_filet', { bat:'pecherie', nom:'Pêche au filet', metier:'peche', duree:6,
    out:{poisson:1}, loot:[{res:'herbe',p:0.06,n:[1,1]}],
    desc:"Le geste de base. On jette, on attend, on remonte." });
  x('peche_nasse', { bat:'pecherie', nom:'Relever les nasses', metier:'peche', duree:14, niv:2,
    out:{poisson:3}, loot:[{res:'ossuaire',p:0.04,n:[1,1]},{res:'ecu',p:0.10,n:[1,3]}],
    desc:"Plus lent, mais la nasse travaille pendant qu'on regarde ailleurs." });
  x('peche_fond', { bat:'pecherie', nom:'Pêche au fond', metier:'peche', duree:34, niv:4,
    out:{poisson:8}, loot:[{res:'peau',p:0.14,n:[1,2]},{res:'gemme',p:0.008,n:[1,1]}],
    desc:"On descend la ligne jusqu'aux trous noirs de la rivière. Il en remonte de drôles de choses." });
  x('peche_glace', { bat:'pecherie', nom:'Pêche au harpon', metier:'peche', duree:60, niv:7,
    out:{poisson:20}, loot:[{res:'essence',p:0.05,n:[1,1]},{res:'gemme',p:0.02,n:[1,1]}],
    desc:"Debout sur le ponton, immobile, une patte en l'air. Le rendement d'une matinée entière." });

  x('vivier_garder', { bat:'pecherie', nom:'Garder au vivier', metier:'peche', duree:44,
    raff:'vivier', in:{poisson:6}, out:{poisson:11},
    loot:[{res:'perle',p:0.03,n:[1,1]},{res:'ecaille',p:0.25,n:[1,2]}],
    desc:"Ce qu'on ne mange pas le jour même grossit au lieu de pourrir. La pêche cesse d'être une loterie." });

  b('scierie', {
    nom:'Scierie', metier:'Bûcheron', cat:'recolte', rangees:[1,2],
    desc:"Un hangar ouvert, la scie à cadre battue par la roue, la grume sur son chariot. Tout le reste du bourg est bâti avec ce qui en sort.",
    cout:{poisson:15}, temps:40, postes:P(1,1,2,2,2,3,3,3,4,4),
    recettes:['coupe_bois','sciage','tresser_osier','poutres','ecorce','secher_bois'],
  });
  x('coupe_bois', { bat:'scierie', nom:'Abattre en lisière', metier:'bois', duree:8,
    out:{bois:2}, loot:[{res:'champignon',p:0.08,n:[1,1]},{res:'herbe',p:0.05,n:[1,1]}],
    desc:"La forêt est à deux pas, et elle repousse." });
  x('sciage', { bat:'scierie', nom:'Débiter en planches', metier:'bois', duree:16, niv:2,
    in:{bois:3}, out:{planche:2},
    desc:"La grume passe sous la lame. Rien de plus utile, rien de plus bruyant." });
  x('poutres', { bat:'scierie', nom:'Équarrir des poutres', metier:'bois', duree:44, niv:5,
    in:{planche:4,clou:1}, out:{poutre:1},
    desc:"Assemblage à tenon et cheville. C'est ce qui permet de bâtir haut." });
  x('tresser_osier', { bat:'scierie', nom: "Tresser l'osier", metier:'bois', duree:26, niv:3,
    in:{bois:3}, out:{corde:2},
    desc:"Trois brins tordus en sens contraire. Les treuils, les filets et les échafaudages en dévorent." });
  x('ecorce', { bat:'scierie', nom:"Lever l'écorce à tan", metier:'bois', duree:20, niv:3,
    in:{bois:2}, out:{herbe:1}, loot:[{res:'bois',p:0.5,n:[1,1]}],
    desc:"L'écorce part à la tannerie, le bois reste au bourg." });

  x('secher_bois', { bat:'scierie', nom:'Sécher sur tasseaux', metier:'bois', duree:56,
    raff:'sechoir', in:{planche:4}, out:{planche:7}, loot:[{res:'resine',p:0.3,n:[1,2]}],
    desc:"Le bois vert travaille et fend ; le bois sec tient. Sept planches sèches valent mieux que dix vertes." });

  b('champ', {
    nom:'Champ', metier:'Laboureur', cat:'recolte', rangees:[0,1],
    desc:"Une parcelle labourée en sillons, l'épouvantail de guingois, la borne au coin. Large et basse : elle mange une terrasse entière.",
    cout:{bois:20,poisson:20}, temps:50, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['semer_ble','racines','lin_champ','jachere','battre_ble'],
  });
  x('semer_ble', { bat:'champ', nom:'Semer et moissonner', metier:'champs', duree:20,
    out:{ble:4}, loot:[{res:'legume',p:0.12,n:[1,2]}],
    desc:"Un cycle complet, compressé comme il se doit dans un bourg qui ne dort jamais." });
  x('racines', { bat:'champ', nom:'Arracher les racines', metier:'champs', duree:12,
    out:{legume:3}, loot:[{res:'argile',p:0.10,n:[1,2]}],
    desc:"Navets et panais. Ça ne fait rêver personne et ça nourrit tout le monde." });
  x('lin_champ', { bat:'champ', nom:'Rouir le lin', metier:'champs', duree:30, niv:3,
    in:{eau:2}, out:{lin:3},
    desc:"On noie les tiges, on attend qu'elles pourrissent juste ce qu'il faut." });
  x('jachere', { bat:'champ', nom:'Fumer la jachère', metier:'champs', duree:70, niv:6,
    in:{legume:4}, out:{ble:24}, loot:[{res:'herbe',p:0.4,n:[1,3]}],
    desc:"Une saison de perdue, trois de gagnées. Le meilleur rendement du bourg au blé." });

  /* Le document du bourg distingue quatre cultures ; le jeu n'en avait
     qu'une. Chacune a désormais sa parcelle, son rythme et son usage —
     et les trois nouvelles sont larges et basses comme le champ. */
  x('battre_ble', { bat:'champ', nom:'Battre au fléau', metier:'champs', duree:34,
    raff:'aire', in:{ble:4}, out:{ble:7,paille:4},
    desc:"Le grain saute, la paille reste. On croyait la perdre : elle fait la litière, le chaume et le torchis." });

  b('tournesol', {
    nom:'Champ de tournesols', metier:'Laboureur', cat:'recolte', rangees:[0,1], nivMax:8,
    desc:"Des têtes hautes comme un chat debout, toutes tournées du même côté. Le meunier les attend : elles donnent une farine grasse et une huile qui ne fige pas.",
    cout:{bois:16,ble:20}, temps:60, postes:P(1,1,2,2,2,3,3,3),
    recettes:['semer_tournesol','recolter_graines'],
  });
  x('semer_tournesol', { bat:'tournesol', nom:'Semer et couper', metier:'champs', duree:24,
    out:{tournesol:4}, loot:[{res:'fleur',p:0.12,n:[1,2]}],
    desc:"On coupe la tête, on laisse la tige : elle nourrira la terre l'an prochain." });
  x('recolter_graines', { bat:'tournesol', nom:'Égrener les têtes', metier:'champs', duree:40, niv:3,
    in:{tournesol:4}, out:{tournesol:9}, loot:[{res:'racine',p:0.15,n:[1,2]}],
    desc:"Frottées à la main sur une claie. Long, mais le rendement triple." });

  b('pepiniere', {
    nom:'Pépinière', metier:'Pépiniériste', cat:'recolte', rangees:[0,1,2], nivMax:8,
    desc:"Des rangs d'arbres bas, taillés en gobelet, et sous l'appentis les sauvageons en pot qui attendent leur greffe. C'est le seul carré du bourg où l'on récolte ce qu'un autre a planté.",
    cout:{bois:14,planche:8,eau:20}, temps:60, postes:P(1,1,2,2,2,3,3,3),
    recettes:['cueillir','greffer','verger_greffe','presser_cidre'],
  });
  x('cueillir', { bat:'pepiniere', nom:'Cueillir au verger', metier:'champs', duree:20,
    in:{eau:2}, out:{fruit:5}, loot:[{res:'greffon',p:0.10,n:[1,1]},{res:'herbe',p:0.12,n:[1,1]}],
    desc:"Pommes, prunes, coings selon la saison. On monte à l'échelle, on remplit le panier, on redescend." });
  x('greffer', { bat:'pepiniere', nom:'Greffer les sauvageons', metier:'champs', duree:70, niv:2,
    in:{fruit:4,corde:1}, out:{greffon:3},
    desc:"On fend le porte-greffe, on glisse la brindille, on ligature. Sur dix, huit prennent — et celles-là valent un verger." });
  x('verger_greffe', { bat:'pepiniere', nom:'Verger greffé', metier:'champs', duree:44, niv:4,
    in:{greffon:2,eau:3}, out:{fruit:14}, loot:[{res:'miel',p:0.15,n:[1,2]}],
    desc:"Un arbre greffé donne trois fois ce que donne un sauvageon, et il donne tous les ans. C'est là que le verger cesse d'être un jardin." });
  x('presser_cidre', { bat:'pepiniere', nom:'Presser le cidre', metier:'cuisine', duree:66,
    raff:'pressoir', in:{fruit:8,eau:2}, out:{cidre:3}, loot:[{res:'ecu',p:0.3,n:[10,30]}],
    desc:"On broie, on entoile, on serre la vis. Ce qui coule est trouble ; ce qu'on tire trois semaines plus tard ne l'est plus." });

  b('potager', {
    nom:'Potager', metier:'Maraîcher', cat:'recolte', rangees:[0,1,2], nivMax:8,
    desc:"Des planches étroites, des rangs serrés, des cloches de verre au printemps. Ce n'est pas grand : c'est ce qui nourrit le bourg entre deux moissons.",
    cout:{bois:12,planche:6}, temps:45, postes:P(1,1,2,2,2,3,3,3),
    recettes:['biner','simples_potager','forcer','potager_greffe'],
  });
  x('biner', { bat:'potager', nom:'Biner les planches', metier:'champs', duree:14,
    out:{legume:4}, loot:[{res:'herbe',p:0.14,n:[1,1]}],
    desc:"Navets, panais, choux. Trois rangs binés valent un champ labouré." });
  x('simples_potager', { bat:'potager', nom:'Cueillir les simples', metier:'champs', duree:22, niv:2,
    out:{herbe:3,racine:1}, loot:[{res:'racine',p:0.18,n:[1,2]}],
    desc:"Le carré du fond, celui qu'on ne mange pas : thym, sauge, absinthe." });
  x('potager_greffe', { bat:'potager', nom:'Planches greffées', metier:'champs', duree:40, niv:4,
    in:{greffon:2,eau:2}, out:{legume:12}, loot:[{res:'herbe',p:0.2,n:[1,2]}],
    desc:"Les greffons ne servent pas qu'aux arbres : sur tomate et sur cucurbitacée, le pied tient et la planche double." });
  x('forcer', { bat:'potager', nom:'Forcer sous cloche', metier:'champs', duree:55, niv:5,
    in:{verre:1,eau:2}, out:{legume:14}, loot:[{res:'fleur',p:0.3,n:[1,2]}],
    desc:"Sous la cloche il fait juin toute l'année. Le verre coûte cher, les primeurs aussi." });

  b('fleurs', {
    nom:'Champ de fleurs', metier:'Laboureur', cat:'recolte', rangees:[0,1,2], nivMax:6,
    desc:"Un carré qu'on ne mange pas, et c'est bien pour cela qu'on y tient. Les abeilles y vont, l'alchimiste aussi, et le bourg respire mieux.",
    cout:{bois:10,legume:15}, temps:40, postes:P(1,1,2,2,2,3),
    effet:{moral:4},
    recettes:['couper_fleurs','graines_fleurs'],
  });
  x('couper_fleurs', { bat:'fleurs', nom:'Couper au petit matin', metier:'champs', duree:16,
    out:{fleur:3}, loot:[{res:'herbe',p:0.16,n:[1,2]}],
    desc:"Avant que le soleil ne les ouvre : c'est là qu'elles gardent leur odeur." });
  x('graines_fleurs', { bat:'fleurs', nom:'Récolter la graine', metier:'champs', duree:44, niv:3,
    in:{fleur:3}, out:{fleur:8}, loot:[{res:'racine',p:0.2,n:[1,1]}],
    desc:"On sacrifie une récolte pour en avoir trois. Le calcul de tous les jardiniers." });

  b('puits', {
    nom:'Puits', metier:'Porteur d\'eau', cat:'recolte', rangees:[1,2], nivMax:5,
    desc:"Margelle, treuil, seau ferré. On ne s'en aperçoit qu'une fois qu'on en manque : four, cuves et alambic en boivent des tonneaux.",
    cout:{bois:22,pierre:6}, temps:35, postes:P(1,1,2,2,2),
    recettes:['tirer_eau'],
  });
  x('tirer_eau', { bat:'puits', nom:"Tirer l'eau", metier:'batisse', duree:5,
    out:{eau:4}, desc:"Manivelle, corde, seau. Le poste le plus ingrat et le plus demandé." });

  b('maison', {
    nom:'Maison', metier:'—', cat:'vie', rangees:[0,1,2], nivMax:8,
    desc:"Colombage, volets peints, chatière au bas de la porte. Une maison neuve n'abrite qu'un habitant de plus ; il faut bâtir un vrai quartier pour faire grandir le bourg.",
    cout:{bois:34}, temps:60, postes:P(0),
    logement:[1,1,2,2,3,3,4,4],
  });

  b('grange', {
    nom:'Grange', metier:'—', cat:'stock', rangees:[0,1],
    desc:"Charpente nue, foin jusqu'au faîtage, poulie à la lucarne. Elle décide de la quantité de vivres que le bourg peut garder sans les perdre.",
    cout:{bois:48}, temps:70, postes:P(0),
    stock:{vivres:220},
  });

  b('entrepot', {
    nom:'Entrepôt', metier:'Facteur', cat:'stock', rangees:[1,2],
    desc:"Sacs, caisses et tonneaux montés par la lucarne du pignon. Sans lui, tout ce qui dépasse le plafond se perd — et l'on ne s'en aperçoit qu'après.",
    cout:{planche:20,pierre:25}, temps:120, postes:P(0),
    stock:{matiere:260,mineral:180,textile:180,ouvrage:90},
  });

  /* =================================================================
     B. LA PIERRE, LE FEU, LE MÉTAL
     ================================================================= */

  b('carriere', {
    nom:'Carrière', metier:'Carrier', cat:'recolte', rangees:[0],
    desc:"Un front de taille en gradins mordu dans le contrefort, la chèvre et son treuil, les coins de fer plantés dans la ligne de fracture.",
    cout:{bois:35,poisson:30}, temps:90, postes:P(1,1,2,2,2,3,3,3,4,4),
    recettes:['extraire_pierre','tamiser_sable','tailler_pierre','extraire_argile'],
  });
  x('extraire_pierre', { bat:'carriere', nom:'Abattre au coin', metier:'mine', duree:14,
    out:{pierre:2,silex:1}, loot:[{res:'fer',p:0.07,n:[1,1]},{res:'gemme',p:0.004,n:[1,1]}],
    outil:'pioche', desc:"On plante, on mouille, on attend que le bois gonfle et que la roche cède." });
  x('tamiser_sable', { bat:'carriere', nom:'Tamiser le sable', metier:'mine', duree:9,
    out:{sable:3}, desc:"Au bord de la rivière, à la pelle et au crible." });
  x('extraire_argile', { bat:'carriere', nom:"Fouiller l'argile", metier:'mine', duree:11,
    out:{argile:3}, loot:[{res:'ossuaire',p:0.05,n:[1,1]}],
    desc:"La fosse grasse, en contrebas. On la marche au pied avant de la porter." });
  x('tailler_pierre', { bat:'carriere', nom:'Équarrir au ciseau', metier:'mine', duree:34, niv:3,
    in:{pierre:3}, out:{pierretaille:1}, outil:'pioche',
    desc:"Le bloc devient parpaing. C'est long, et il n'y a pas d'autre manière." });

  b('mine', {
    nom:'Mine', metier:'Mineur', cat:'recolte', rangees:[0],
    desc:"Le chevalement, la molette, la benne. Chaque niveau de la mine descend d'un cran : plus bas on va, plus les veines sont riches et plus la remontée est longue.",
    cout:{planche:26,pierretaille:10,bois:40}, temps:220, postes:P(1,1,2,2,3,3,3,4,4,5),
    recettes:['filon_fer','veine_charbon','filon_cuivre','filon_etain','filon_argent','filon_or','galerie_profonde','laver_minerai'],
  });
  x('filon_fer', { bat:'mine', nom:'Suivre le filon de fer', metier:'mine', duree:18,
    out:{fer:2}, loot:[{res:'pierre',p:0.35,n:[1,2]},{res:'charbon',p:0.08,n:[1,1]}],
    outil:'pioche', desc:"La veine rousse du premier niveau. Elle ne s'épuise jamais tout à fait." });
  x('veine_charbon', { bat:'mine', nom:'Piquer le charbon', metier:'mine', duree:22, niv:2,
    out:{charbon:2}, loot:[{res:'pierre',p:0.25,n:[1,2]}],
    outil:'pioche', desc:"Un cran plus bas que le fer, et deux fois plus salissant." });
  x('filon_cuivre', { bat:'mine', nom:'Suivre le cuivre', metier:'mine', duree:30, niv:3,
    out:{cuivre:2}, loot:[{res:'fer',p:0.20,n:[1,2]},{res:'gemme',p:0.012,n:[1,1]}],
    outil:'pioche', desc:"Vert en surface, rouge à cœur. On la reconnaît à l'odeur." });
  x('filon_etain', { bat:'mine', nom:"Chercher l'étain", metier:'mine', duree:38, niv:4,
    out:{etain:2}, loot:[{res:'cuivre',p:0.16,n:[1,1]}],
    outil:'pioche', desc:"Rare. On en trouve une poche par galerie, et jamais deux au même endroit." });
  x('filon_argent', { bat:'mine', nom:"Ouvrir la veine d'argent", metier:'mine', duree:60, niv:6,
    out:{argentmin:2}, loot:[{res:'gemme',p:0.05,n:[1,1]},{res:'ossuaire',p:0.10,n:[1,2]}],
    outil:'pioche', desc:"Une ligne claire dans la roche noire. On la suit en retenant son souffle." });
  x('filon_or', { bat:'mine', nom:"Descendre à l'or", metier:'mine', duree:105, niv:8,
    out:{ormin:2}, loot:[{res:'gemme',p:0.12,n:[1,2]},{res:'essence',p:0.04,n:[1,1]}],
    outil:'pioche', desc:"Au fond du fond. Trois coups de pioche pour une pépite, et l'air y est mauvais." });
  x('galerie_profonde', { bat:'mine', nom:'Percer une galerie', metier:'mine', duree:200, niv:9,
    in:{poutre:1,huile:2}, out:{pierre:30}, loot:[{res:'gemme',p:0.35,n:[1,3]},{res:'obsidienne',p:0.10,n:[1,1]},{res:'essence',p:0.2,n:[1,2]}],
    outil:'pioche', desc:"On ne cherche plus rien de précis : on ouvre, et l'on regarde ce qui tombe." });

  x('laver_minerai', { bat:'mine', nom:'Laver au chenal', metier:'mine', duree:38,
    raff:'laverie', in:{eau:3,fer:2}, out:{fer:5},
    loot:[{res:'silex',p:0.35,n:[1,3]},{res:'ormin',p:0.03,n:[1,1]},{res:'gemme',p:0.01,n:[1,1]}],
    desc:"La roche concassée passe au tamis sous le courant. Ce qui reste au fond est trois fois plus riche — et parfois brille." });

  b('charbonniere', {
    nom:'Charbonnière', metier:'Charbonnier', cat:'atelier', rangees:[0,1], nivMax:8,
    desc:"Une meule de bois couverte de mottes, l'évent qui fume sans flamme, et la hutte du charbonnier qui veille trois jours de suite.",
    cout:{bois:40,argile:15}, temps:70, postes:P(1,1,1,2,2,2,3,3),
    recettes:['cuire_charbon'],
  });
  x('cuire_charbon', { bat:'charbonniere', nom:'Cuire la meule', metier:'feu', duree:40,
    in:{bois:5,silex:1}, out:{charbonbois:3,cendre:2}, loot:[{res:'cire',p:0.03,n:[1,1]}],
    desc:"Trois jours sans flamme visible. Le charbonnier ne dort que d'un œil." });

  b('fonderie', {
    nom:'Fonderie', metier:'Fondeur', cat:'atelier', rangees:[1,2],
    desc:"Le four à cuve ne s'éteint jamais tout à fait. On coule la nuit, quand l'œil lit mieux la couleur du métal.",
    cout:{brique:25,pierretaille:10,planche:15}, temps:200, postes:P(1,1,2,2,2,3,3,3,4,4),
    recettes:['couler_fer','couler_cuivre','couler_bronze','couler_acier','couler_argent','couler_or','fondre_mithril','refondre_limaille'],
  });
  x('couler_fer', { bat:'fonderie', nom:'Couler le fer', metier:'feu', duree:26,
    in:{fer:3,charbon:1}, out:{lingotfer:1}, desc:"En gueuse, puis refroidissement lent. Toute la suite en dépend." });
  x('couler_cuivre', { bat:'fonderie', nom:'Couler le cuivre', metier:'feu', duree:32, niv:2,
    in:{cuivre:3,charbon:1}, out:{lingotcuivre:1}, desc:"Se travaille tiède, et pardonne les erreurs." });
  x('couler_bronze', { bat:'fonderie', nom:'Allier le bronze', metier:'feu', duree:52, niv:4,
    in:{lingotcuivre:2,etain:1,charbonbois:1}, out:{bronze:1},
    desc:"Neuf de cuivre pour un d'étain. Le premier vrai tranchant du bourg." });
  x('couler_acier', { bat:'fonderie', nom:"Cémenter l'acier", metier:'feu', duree:80, niv:5,
    in:{lingotfer:2,charbonbois:2}, out:{acier:1},
    desc:"Fer et charbon de bois, scellés ensemble, chauffés au blanc pendant des heures." });
  x('couler_argent', { bat:'fonderie', nom:"Affiner l'argent", metier:'feu', duree:95, niv:6,
    in:{argentmin:3,charbonbois:1}, out:{lingotargent:1}, desc:"Coupellation à l'os. Le plomb part, l'argent reste." });
  x('couler_or', { bat:'fonderie', nom:"Affiner l'or", metier:'feu', duree:140, niv:8,
    in:{ormin:3,charbonbois:2}, out:{lingotor:1}, desc:"Rien ne l'attaque, rien ne le ternit. Il suffit de savoir attendre." });
  x('fondre_mithril', { bat:'fonderie', nom:'Réduire le mithril', metier:'feu', duree:320, niv:10,
    in:{obsidienne:2,essence:8,charbonbois:6}, out:{mithril:1},
    desc:"Le métal des profondeurs ne fond pas : il consent. Il y faut de l'essence et beaucoup d'insistance." });

  x('refondre_limaille', { bat:'fonderie', nom:'Refondre la limaille', metier:'feu', duree:34, niv:2,
    in:{limaille:6,charbonbois:1}, out:{lingotfer:2},
    desc:"Ce que la lime a mangé n'est pas perdu : balayé, tamisé, refondu. Le forgeron récupère un lingot sur dix qu'il a usés." });

  b('forge', {
    nom:'Forge', metier:'Forgeron', cat:'atelier', rangees:[1,2],
    desc:"Le marteau y bat du lever au couvre-feu. On y refait les outils que les autres métiers usent, et l'on y trempe les lames dont dépend la descente.",
    cout:{pierretaille:12,planche:12,lingotfer:2}, temps:180, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['clouterie','outil_fer','outil_acier','forger_arme','ferrures','martinet_barres'],
  });
  x('clouterie', { bat:'forge', nom:'Battre la clouterie', metier:'forge', duree:22,
    in:{lingotfer:1}, out:{clou:4}, desc:"Clous, gonds, pentures. Le pain quotidien de la forge." });
  x('outil_fer', { bat:'forge', nom:"Forger l'outillage", metier:'forge', duree:70, niv:2,
    in:{lingotfer:2,planche:2}, out:{outil:1},
    desc:"Pioche, hache, faux, marteau. Un atelier outillé va bien plus vite — et l'outil finit par casser." });
  x('outil_acier', { bat:'forge', nom:"Forger l'outillage d'acier", metier:'forge', duree:160, niv:6,
    in:{acier:2,poutre:1,cuir:1}, out:{outilacier:1},
    desc:"Trempé, revenu, emmanché de frêne. Deux fois la cadence, trois fois la durée." });
  x('ferrures', { bat:'forge', nom:'Ferrer et cercler', metier:'forge', duree:44, niv:3,
    in:{lingotfer:1,clou:2}, out:{clou:6}, loot:[{res:'ecu',p:0.5,n:[2,8]}],
    desc:"On referre les mules du bourg contre une écuelle de lait et quelques écus." });
  x('forger_arme', { bat:'forge', nom:'Forger une arme', metier:'forge', duree:120, niv:4,
    in:{lingotfer:3,planche:2,cuir:1}, out:{arme:1},
    desc:"Une lame par ordre. C'est ce qui monte le PALIER D'ARMEMENT de la compagnie." });

  x('martinet_barres', { bat:'forge', nom:'Étirer sous le martinet', metier:'forge', duree:52,
    raff:'martinet', in:{lingotfer:3}, out:{lingotfer:5}, loot:[{res:'limaille',p:0.5,n:[2,5]}],
    desc:"Cent livres qui retombent toutes les deux secondes. Le forgeron ne fait plus que tenir la pièce." });

  b('armurerie', {
    nom:'Armurerie', metier:'Armurier', cat:'atelier', rangees:[1,2],
    desc:"Cottes, écus et heaumes taillés pour des épaules étroites et des oreilles hautes. Le maître refuse toute commande qui gênerait la retombée sur les pattes.",
    cout:{pierretaille:10,lingotfer:6,planche:10}, temps:220, postes:P(1,1,1,2,2,2,3,3,3,3),
    recettes:['forger_armure','forger_ecu','maille_acier','ecailler_harnois','harnois_bronze'],
  });
  x('forger_armure', { bat:'armurerie', nom:'Battre un harnois', metier:'forge', duree:140,
    in:{lingotfer:4,cuir:2,drap:1}, out:{armure:1},
    desc:"Plastron, spallières, tassettes. Ce qui décide de la profondeur dont on revient." });
  x('ecailler_harnois', { bat:'armurerie', nom:'Écailler un harnois', metier:'forge', duree:190, niv:4,
    in:{armure:1,ecaille:6,silex:3}, out:{armure:2},
    loot:[{res:'limaille',p:0.35,n:[1,3]}],
    desc:"On double le plastron d'écailles cousues à recouvrement. Deux harnois pour un, et qui tiennent le feu." });
  x('forger_ecu', { bat:'armurerie', nom:'Monter un écu', metier:'forge', duree:80, niv:2,
    in:{planche:4,cuir:2,lingotfer:1}, out:{bouclier:1},
    desc:"Bois cintré, cuir bouilli, bordure de fer et blason peint." });
  x('maille_acier', { bat:'armurerie', nom:"Tresser la maille d'acier", metier:'forge', duree:260, niv:6,
    in:{acier:3,cuir:2,fil:4}, out:{armure:3},
    desc:"Vingt mille anneaux rivés un par un. On y perd la vue et l'on y gagne la vie." });

  b('tuilerie', {
    nom:'Tuilerie', metier:'Tuilier', cat:'atelier', rangees:[0,1], nivMax:8,
    desc:"La fosse d'argile et son four à dôme, les claies où les tuiles attendent en épi. Un bourg qui n'a pas de tuilerie a des toits provisoires.",
    cout:{argile:25,bois:25}, temps:80, postes:P(1,1,2,2,2,3,3,3),
    recettes:['cuire_brique','cuire_tuile','poterie','torchis','cuire_chaux'],
  });
  x('cuire_brique', { bat:'tuilerie', nom:'Cuire les briques', metier:'feu', duree:24,
    in:{argile:3,bois:1}, out:{brique:2}, desc:"Elles montent vite et supportent le feu : c'est tout ce qu'on leur demande." });
  x('torchis', { bat:'tuilerie', nom:'Gâcher le torchis', metier:'feu', duree:26, niv:2,
    in:{argile:3,paille:3}, out:{brique:4},
    desc:"Terre, paille et eau, foulées au pied. Ça ne vaut pas la brique cuite, mais ça monte trois fois plus vite." });
  x('cuire_tuile', { bat:'tuilerie', nom:'Cuire les tuiles', metier:'feu', duree:28, niv:2,
    in:{argile:3,bois:1}, out:{tuile:2}, desc:"Moulées sur le genou, séchées de chant, cuites au rouge sombre." });
  x('poterie', { bat:'tuilerie', nom:'Tourner la poterie', metier:'feu', duree:36, niv:3,
    in:{argile:2,bois:1}, out:{poterie:1}, loot:[{res:'ecu',p:0.3,n:[3,9]}],
    desc:"Jarres et cruches. Sans elles, rien ne se garde et rien ne se transporte." });

  x('cuire_chaux', { bat:'tuilerie', nom:'Cuire la chaux', metier:'feu', duree:64,
    raff:'chaufour', in:{pierre:5,charbonbois:2}, out:{brique:6,pierretaille:2},
    loot:[{res:'cendre',p:0.6,n:[2,5]}],
    desc:"Trois jours de feu pour que la pierre devienne poudre. C'est elle qui fait le mortier — et sans mortier, rien ne tient." });

  b('poterie', {
    nom:'Poterie', metier:'Potier', cat:'atelier', rangees:[1,2], nivMax:8,
    desc:"Le tour à bâton, les claies de séchage, et le four en ruche qui ronfle derrière. Tout le bourg mange un jour dans ce qui sort d'ici.",
    cout:{argile:18,bois:12}, temps:80, postes:P(1,1,2,2,2,3,3,3),
    recettes:['tourner_pot','fournee_gres','jarres_marchandes','grand_vaisselier','email_cuivre','etamer'],
  });
  x('tourner_pot', { bat:'poterie', nom:'Tourner au colombin', metier:'poterie', duree:20,
    in:{argile:2,eau:1,paille:1}, out:{poterie:1},
    desc:"L'argile monte entre les pattes. Un geste ancien, et un pot qui tient l'eau." });
  x('fournee_gres', { bat:'poterie', nom:'Cuire une fournée de grès', metier:'feu', duree:70, niv:3,
    in:{argile:6,charbonbois:1}, out:{poterie:4}, loot:[{res:'ecu',p:0.25,n:[4,12]}],
    desc:"Le four en ruche monte au rouge sombre et rend quatre pièces d'un coup — quand rien n'éclate." });
  x('jarres_marchandes', { bat:'poterie', nom:'Monter des jarres', metier:'poterie', duree:120, niv:5,
    in:{poterie:2,huile:1}, out:{ecu:210}, loot:[{res:'plan',p:0.03,n:[1,1]}],
    desc:"Des jarres à huile hautes comme un chat debout. Les colporteurs les paient sans discuter." });

  x('grand_vaisselier', { bat:'poterie', nom:'Monter au tour à pied', metier:'poterie', duree:44,
    raff:'tour_pied', in:{argile:5,eau:2}, out:{poterie:5},
    loot:[{res:'ecu',p:0.3,n:[6,18]}],
    desc:"Les deux pattes libres, le plateau qui ne ralentit plus : cinq pièces là où l'on en montait deux." });

  x('email_cuivre', { bat:'poterie', nom:'Émailler au cuivre', metier:'poterie', duree:64, niv:3,
    in:{poterie:3,cuivre:1,cendre:2}, out:{poterie:6}, loot:[{res:'ecu',p:0.35,n:[20,70]}],
    desc:"Une pincée de minerai vert dans la glaçure, et la jarre sort du four bleue. On la paie trois fois le prix." });
  x('etamer', { bat:'poterie', nom:'Étamer la vaisselle', metier:'poterie', duree:58, niv:4,
    in:{poterie:4,etain:1}, out:{poterie:8},
    desc:"Une pellicule d'étain au fond du plat, et l'acide du vin ne mord plus la terre." });
  x('verre_argent', { bat:'verrerie', nom:'Miroir au tain', metier:'feu', duree:88, niv:4,
    in:{verre:3,argentmin:1}, out:{verre:5}, loot:[{res:'ecu',p:0.4,n:[80,260]}],
    desc:"Le tain d'argent au dos d'une plaque bien plane. Le bourg n'avait jamais vu son propre visage." });
  x('dorure', { bat:'scriptorium', nom:"Enluminer à l'or", metier:'savoir', duree:120, niv:5,
    in:{parchemin:2,ormin:1,encre:1}, out:{sort:1},
    desc:"L'or n'est pas là pour briller : une lettre dorée se retrouve dans un volume de six cents pages." });

  b('verrerie', {
    nom:'Verrerie', metier:'Verrier', cat:'atelier', rangees:[1],
    desc:"Le four rond à trois ouvreaux d'un blanc aveuglant, le banc du souffleur, sa canne, et le tas de sable qui ne ressemble à rien.",
    cout:{brique:30,charbonbois:10,pierretaille:6}, temps:200, postes:P(1,1,1,2,2,2,3,3,3,3),
    recettes:['souffler_verre','souffler_fiole','vitrail','verre_argent'],
  });
  x('souffler_verre', { bat:'verrerie', nom:'Fondre le verre', metier:'feu', duree:34,
    in:{sable:4,charbonbois:1,cendre:2}, out:{verre:2}, desc:"Sable, cendre et chaleur. Rien d'autre, et pourtant presque personne ne sait le faire — la cendre est le fondant, sans elle le sable ne coule pas." });
  x('souffler_fiole', { bat:'verrerie', nom:'Souffler des fioles', metier:'feu', duree:40, niv:2,
    in:{verre:2}, out:{fiole:3}, desc:"Une bulle, un col, un fond. L'alchimiste en réclame sans cesse." });
  x('vitrail', { bat:'verrerie', nom:'Monter un vitrail', metier:'feu', duree:150, niv:5,
    in:{verre:6,lingotfer:1,gemme:1}, out:{ecu:180}, loot:[{res:'chant',p:0.2,n:[1,1]}],
    desc:"Vendu à la chapelle, ou à une abbaye voisine. C'est la commande la mieux payée du bourg." });

  /* =================================================================
     C. LA TABLE, LE TROUPEAU, L'ÉTOFFE
     ================================================================= */

  b('moulin', {
    nom:'Moulin à vent', metier:'Meunier', cat:'atelier', rangees:[0,1],
    desc:"Perché au vent, calotte orientable et queue jusqu'au sol. Le meunier dort dans la calotte ; il dit que le grincement l'endort mieux qu'une berceuse.",
    cout:{planche:25,pierre:20,corde:6}, temps:150, postes:P(1,1,1,2,2,2,2,3,3,3),
    recettes:['moudre_ble','moudre_gland','moudre_tournesol','bluter'],
  });
  x('moudre_ble', { bat:'moulin', nom:'Moudre le blé', metier:'cuisine', duree:16,
    in:{ble:3}, out:{farine:2}, desc:"La meule tourne, le grain devient poudre, le meunier devient blanc." });
  x('moudre_gland', { bat:'moulin', nom:'Moudre les glands', metier:'cuisine', duree:20, niv:3,
    in:{bois:2,legume:2}, out:{farine:2}, desc:"La farine du pauvre. Amère, mais elle passe l'hiver." });
  x('moudre_tournesol', { bat:'moulin', nom:'Écraser les tournesols', metier:'cuisine', duree:28, niv:2,
    in:{tournesol:4}, out:{farineclaire:2,huile:1},
    desc:"La graine rend deux choses d'un coup : une farine grasse, et l'huile qui suinte de la meule." });
  /* La BLUTERIE n'existe qu'une fois le raffinage posé : c'est une
     recette qui dort dans la table jusque-là. */
  x('bluter', { bat:'moulin', nom:'Bluter au tamis de soie', metier:'cuisine', duree:22, raff:'bluterie',
    in:{farine:3}, out:{farine:5}, loot:[{res:'paille',p:0.4,n:[1,3]}],
    desc:"On repasse la mouture au tamis fin : le son part, la farine double. Sans la bluterie, impossible." });

  b('moulinEau', {
    nom:'Moulin à eau', metier:'Meunier', cat:'atelier', rangees:[2], gen:'moulinEau',
    desc:"Bâti sur pilotis, la roue à aubes prise dans le courant. Il moud plus régulièrement que son cousin des hauteurs, et l'on y foule le drap.",
    cout:{poutre:2,planche:30,pierretaille:6}, temps:240, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['moudre_eau','fouler_drap','battre_huile'],
  });
  x('moudre_eau', { bat:'moulinEau', nom:'Moudre à la roue', metier:'cuisine', duree:12,
    in:{ble:3}, out:{farine:3}, desc:"Le courant ne se fatigue pas. Meilleur rendement, à condition d'avoir la rivière." });
  x('fouler_drap', { bat:'moulinEau', nom:'Fouler le drap', metier:'tissage', duree:60, niv:3,
    in:{toile:2,eau:3}, out:{drap:1}, desc:"Les maillets battent l'étoffe des heures durant : elle se serre et devient un vrai drap." });
  x('battre_huile', { bat:'moulinEau', nom:"Battre l'huile", metier:'cuisine', duree:44, niv:4,
    in:{legume:4,eau:2}, out:{huile:2}, desc:"Pour les lampes, les gonds et les feux qu'on veut voir durer." });

  b('cuisine', {
    nom:'Four banal', metier:'Fournier', cat:'atelier', rangees:[1,2],
    desc:"Le four du bourg, où chacun vient cuire sa pâte contre une redevance. L'odeur suffit à remplir la place à midi.",
    cout:{brique:20,pierre:15,bois:20,tuile:8}, temps:110, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['cuire_pain','marmite_pecheur','brochette_poisson','soupe_legumes',
              'confire','pain_fromage','chausson_champignons','galette_miel',
              'ration_marche','bouillie_miel','tarte_verger','racines_roties',
              'tourte_poisson','tourte_riche','chaudree_marin','planche_fumee',
              'roti_miel','champignons_farcis','cidre_epice','galette_tournesol'],
  });
  x('cuire_pain', { bat:'cuisine', nom:'Cuire le pain', metier:'cuisine', duree:22,
    image:'img/objets/cuisine/pain-rustique.png', in:{farine:2,eau:1}, out:{pain:3},
    desc:"Le vrai carburant du bourg : un habitant qui a du pain travaille sans se plaindre." });
  x('confire', { bat:'cuisine', nom:'Confire les fruits', metier:'cuisine', duree:58, niv:2,
    image:'img/objets/cuisine/confiture-baies.png', in:{fruit:5,miel:2}, out:{confiture:3}, loot:[{res:'poterie',p:0.15,n:[1,1]}],
    desc:"On cuit jusqu'à ce que la cuillère tienne debout, on coule en pot, on ferme au parchemin. Un été qu'on garde pour l'hiver." });
  x('tourte_riche', { bat:'cuisine', nom:'Tourte à la farine claire', metier:'cuisine', duree:80, niv:4,
    image:'img/objets/cuisine/tourte-farine-claire.png', in:{farineclaire:3,fromage:1,viande:2}, out:{tourte:3},
    desc:"La farine de tournesol donne une pâte grasse qui ne sèche pas. Trois tourtes d'un coup, et meilleures." });
  x('tourte_poisson', { bat:'cuisine', nom:'Faire une tourte', metier:'cuisine', duree:70, niv:4,
    image:'img/objets/cuisine/tourte-poisson.png', in:{farine:3,poissonfume:2,fromage:1}, out:{tourte:2},
    desc:"Pain, poisson, fromage : les trois d'un coup. Un repas de fête et un rendement de fête." });
  x('galette_miel', { bat:'cuisine', nom:'Galettes au miel', metier:'cuisine', duree:40, niv:3,
    image:'img/objets/cuisine/galettes-miel.png', in:{farine:2,miel:1}, out:{pain:6}, loot:[{res:'ecu',p:0.5,n:[4,14]}],
    desc:"On en vend la moitié sur la place avant qu'elles aient refroidi." });
  x('marmite_pecheur', { bat:'cuisine', nom:'Marmite du pêcheur', metier:'cuisine', duree:34,
    image:'img/objets/cuisine/marmite-pecheur.png', in:{poisson:3,legume:2,eau:2}, out:{tourte:1},
    desc:"Le premier vrai repas chaud : poisson, racines et une marmite qui ne quitte jamais le feu." });
  x('brochette_poisson', { bat:'cuisine', nom:'Griller les brochettes', metier:'cuisine', duree:30, niv:2,
    image:'img/objets/cuisine/brochette-poisson.png', in:{poisson:4,herbe:1,bois:1}, out:{poissonfume:3},
    desc:"Le feu saisit la peau, les simples font oublier que c'est encore du poisson." });
  x('soupe_legumes', { bat:'cuisine', nom:'Soupe de racines', metier:'cuisine', duree:32, niv:2,
    image:'img/objets/cuisine/soupe-legumes.png', in:{legume:5,eau:3,herbe:1}, out:{pain:4},
    desc:"Une soupe épaisse qui nourrit autant qu'un pain et coûte ce que le jardin donne." });
  x('pain_fromage', { bat:'cuisine', nom:'Pain au fromage', metier:'cuisine', duree:46, niv:3,
    image:'img/objets/cuisine/pain-fromage.png', in:{farine:3,fromage:1,eau:1}, out:{pain:7},
    desc:"La croûte garde le fromage chaud ; les fournées disparaissent avant de refroidir." });
  x('chausson_champignons', { bat:'cuisine', nom:'Chaussons aux champignons', metier:'cuisine', duree:52, niv:3,
    image:'img/objets/cuisine/chausson-champignons.png', in:{farine:3,champignon:3,huile:1}, out:{tourte:2},
    desc:"On replie la pâte sur la forêt. Le quatrième champignon reste au laboratoire." });
  x('ration_marche', { bat:'cuisine', nom:'Ration de marche', metier:'cuisine', duree:56, niv:4,
    image:'img/objets/cuisine/ration-marche.png', in:{poissonfume:2,pain:2,fromage:1}, out:{poissonfume:5},
    desc:"Compacte, sèche et solide : la ration qu'on ouvre quand la tour ne montre plus le ciel." });
  x('bouillie_miel', { bat:'cuisine', nom:'Bouillie au lait et au miel', metier:'cuisine', duree:38, niv:4,
    image:'img/objets/cuisine/bouillie-lait-miel.png', in:{farine:2,lait:2,miel:1}, out:{pain:7},
    desc:"Douce, chaude, et assez épaisse pour tenir une cuillère droite." });
  x('tarte_verger', { bat:'cuisine', nom:'Tarte du verger', metier:'cuisine', duree:62, niv:5,
    image:'img/objets/cuisine/tarte-verger.png', in:{fruit:5,farine:3,miel:1}, out:{tourte:3},
    desc:"Les meilleurs fruits sur une pâte fine ; les moins beaux finissent en cidre." });
  x('racines_roties', { bat:'cuisine', nom:'Rôtir les racines', metier:'cuisine', duree:40, niv:5,
    image:'img/objets/cuisine/racines-roties.png', in:{legume:7,huile:1,herbe:2}, out:{pain:8},
    desc:"Le four transforme les navets en quelque chose que même les enfants réclament." });
  x('chaudree_marin', { bat:'cuisine', nom:'Chaudrée du marin', metier:'cuisine', duree:76, niv:6,
    image:'img/objets/cuisine/chaudree-marin.png', in:{poisson:5,lait:2,legume:2,pain:1}, out:{tourte:4},
    desc:"Servie dans une miche évidée : rien à laver, rien à perdre." });
  x('planche_fumee', { bat:'cuisine', nom:'Planche du fumoir', metier:'cuisine', duree:64, niv:6,
    image:'img/objets/cuisine/planche-fumee.png', in:{viande:3,poissonfume:2,fromage:2}, out:{poissonfume:7},
    desc:"Une réserve dense pour les longues traversées et les étages sans cuisine." });
  x('roti_miel', { bat:'cuisine', nom:'Rôti laqué au miel', metier:'cuisine', duree:92, niv:7,
    image:'img/objets/cuisine/roti-miel.png', in:{viande:5,miel:3,huile:1}, out:{tourte:5},
    desc:"La fête commence quand le miel caramélise et que tout le bourg suit l'odeur." });
  x('champignons_farcis', { bat:'cuisine', nom:'Champignons farcis', metier:'cuisine', duree:72, niv:7,
    image:'img/objets/cuisine/champignons-farcis.png', in:{champignon:7,fromage:2,herbe:2}, out:{tourte:4},
    desc:"Petits, riches, et bien plus sérieux que leur taille ne le laisse croire." });
  x('cidre_epice', { bat:'cuisine', nom:'Cidre aux épices', metier:'cuisine', duree:86, niv:8,
    image:'img/objets/cuisine/cidre-epice.png', in:{cidre:3,miel:1,herbe:2}, out:{cidre:6},
    desc:"Réchauffé doucement, jamais bouilli : le moral monte avant même la première tasse." });
  x('galette_tournesol', { bat:'cuisine', nom:'Galette de tournesol', metier:'cuisine', duree:54, niv:8,
    image:'img/objets/cuisine/galette-tournesol.png', in:{farineclaire:4,huile:1,miel:1}, out:{pain:10},
    desc:"Une galette dorée, grasse et durable, taillée pour les réserves d'expédition." });

  b('fumoir', {
    nom:'Fumoir', metier:'Saleur', cat:'atelier', rangees:[1,2], nivMax:8,
    desc:"Une tourelle aveugle à la porte de fer, la fumée froide qui traîne au sol, les enfilades sous l'auvent. Ce qui en sort passe l'hiver.",
    cout:{pierre:20,bois:20,argile:10}, temps:90, postes:P(1,1,1,2,2,2,3,3),
    recettes:['fumer_poisson','fumer_viande'],
  });
  x('fumer_poisson', { bat:'fumoir', nom:'Fumer le poisson', metier:'cuisine', duree:30,
    in:{poisson:4,bois:1}, out:{poissonfume:2},
    desc:"Fumée froide, deux jours. C'est ce qu'on emporte dans la descente." });
  x('fumer_viande', { bat:'fumoir', nom:'Fumer la viande', metier:'cuisine', duree:44, niv:3,
    in:{viande:3,bois:2}, out:{poissonfume:3}, desc:"Le lard du bourg. On l'appelle encore poisson fumé par habitude." });

  b('bergerie', {
    nom:'Bergerie', metier:'Berger', cat:'elevage', rangees:[0,1,2],
    desc:"Les moutons du bourg, gras comme des nuages posés. Le berger compte son troupeau chaque soir ; les chats comptent avec lui, et trouvent toujours un mouton de plus.",
    cout:{bois:36}, temps:80, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['tondre','abattre_mouton','paitre','abattre_complet','fondre_suif','chandelles'],
  });
  x('tondre', { bat:'bergerie', nom:'Tondre le troupeau', metier:'elevage', duree:24,
    in:{ble:1}, out:{laine:3}, desc:"Au printemps, puis chaque fois que la toison le permet." });
  x('paitre', { bat:'bergerie', nom:'Mener au pâturage', metier:'elevage', duree:36, niv:2,
    out:{laine:2}, loot:[{res:'herbe',p:0.3,n:[1,2]},{res:'champignon',p:0.12,n:[1,1]}],
    desc:"Sans grain, plus lent — mais gratuit, et le berger revient les poches pleines." });
  x('abattre_mouton', { bat:'bergerie', nom:'Abattre une bête', metier:'elevage', duree:50, niv:3,
    in:{ble:2}, out:{viande:3,peau:2}, desc:"On ne le fait pas de gaieté de cœur, mais il faut bien du cuir." });

  x('abattre_complet', { bat:'bergerie', nom:'Abattre et parer', metier:'elevage', duree:80,
    raff:'abattoir', in:{}, out:{viande:6,peau:3,suif:2},
    desc:"Rien ne part : la viande au fumoir, la peau au tanneur, la graisse au chaudron. C'est l'abattoir qui rend ce dernier tiers." });
  x('fondre_suif', { bat:'bergerie', nom:'Fondre le suif', metier:'cuisine', duree:46,
    raff:'abattoir', in:{suif:2,eau:2}, out:{cire:2}, loot:[{res:'huile',p:0.3,n:[1,1]}],
    desc:"Clarifié deux fois au chaudron. La chandelle de suif fume plus que celle de cire, et coûte dix fois moins." });

  b('etable', {
    nom:'Étable', metier:'Vacher', cat:'elevage', rangees:[0,1,2],
    desc:"Lait, cuir et bonne chaleur l'hiver. Les vaches tolèrent les chats sur leur dos, à condition qu'ils ne griffent pas en rêvant.",
    cout:{bois:44,poisson:20}, temps:100, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['traire','fumier','abattre_vache','abattre_boeuf','litiere'],
  });
  x('traire', { bat:'etable', nom:'Traire', metier:'elevage', duree:18,
    in:{ble:1}, out:{lait:3}, desc:"Deux fois par jour. La moitié disparaît avant la laiterie ; nul ne sait comment." });
  x('fumier', { bat:'etable', nom:'Sortir le fumier', metier:'elevage', duree:26, niv:2,
    out:{legume:4}, desc:"Ingrat, mais c'est lui qui fait les récoltes du champ." });
  x('abattre_vache', { bat:'etable', nom:'Abattre une bête', metier:'elevage', duree:80, niv:4,
    in:{ble:4}, out:{viande:6,peau:4}, desc:"Une seule bête nourrit le bourg une semaine et habille sa compagnie." });

  x('abattre_boeuf', { bat:'etable', nom:'Abattre au treuil', metier:'elevage', duree:120,
    raff:'abattoir', out:{viande:16,peau:6,suif:5},
    desc:"Une bête donne de quoi tenir un mois. Le treuil n'est pas un luxe : c'est la seule façon de la lever." });

  b('laiterie', {
    nom:'Laiterie', metier:'Laitier', cat:'atelier', rangees:[1,2], nivMax:8,
    desc:"Blanchie à la chaux, fenêtres grillagées pour tenir le frais, les barattes debout et les claies à fromages. Le chat n'est jamais loin.",
    cout:{planche:20,pierre:15,poterie:3,tuile:6}, temps:110, postes:P(1,1,2,2,2,3,3,3),
    recettes:['baratter','affiner'],
  });
  x('baratter', { bat:'laiterie', nom:'Baratter', metier:'elevage', duree:30,
    in:{lait:4}, out:{fromage:1}, loot:[{res:'lait',p:0.2,n:[1,1]}],
    desc:"Le pilon monte et descend jusqu'à ce que le beurre prenne." });
  x('affiner', { bat:'laiterie', nom:'Affiner en cave', metier:'elevage', duree:90, niv:4,
    in:{fromage:2,herbe:1}, out:{fromage:5}, loot:[{res:'ecu',p:0.4,n:[6,20]}],
    desc:"Trois mois sur planche, retourné tous les deux jours. Le bourg entier sait quand la cave s'ouvre." });

  x('affiner', { bat:'laiterie', nom:'Affiner six mois', metier:'elevage', duree:150,
    raff:'cave', in:{fromage:2,eau:2}, out:{fromage:5}, loot:[{res:'ecu',p:0.4,n:[15,45]}],
    desc:"Retourné, brossé, frotté chaque semaine. Une meule affinée vaut quatre meules fraîches." });

  b('rucher', {
    nom:'Rucher', metier:'Apiculteur', cat:'elevage', rangees:[0,1], nivMax:6,
    desc:"Cinq ruches de paille sur leur banc de pierre, la haie fleurie derrière, l'enfumoir pendu au piquet. Se paye en piqûres, se vend en or.",
    cout:{bois:20,corde:2}, temps:70, postes:P(1,1,1,2,2,2),
    recettes:['recolter_miel','fondre_cire','fondre_rayons','miel_de_fleurs'],
  });
  x('recolter_miel', { bat:'rucher', nom:'Lever les hausses', metier:'elevage', duree:44,
    out:{miel:2}, loot:[{res:'cire',p:0.5,n:[1,2]}], desc:"Enfumoir, voile, et beaucoup de calme." });
  x('fondre_cire', { bat:'rucher', nom:'Fondre la cire', metier:'feu', duree:34, niv:2,
    in:{cire:2,eau:1}, out:{cire:3,huile:1}, desc:"Chandelles, sceaux et tablettes à écrire." });

  x('fondre_rayons', { bat:'rucher', nom:'Fondre les vieux rayons', metier:'elevage', duree:50,
    raff:'cirerie', in:{miel:2,eau:2}, out:{cire:5}, loot:[{res:'miel',p:0.35,n:[1,2]}],
    desc:"Au bain-marie, filtré à la toile, coulé en pains. Le miel n'était que la moitié de ce que donne une ruche." });
  x('miel_de_fleurs', { bat:'rucher', nom:'Butiner le carré de fleurs', metier:'elevage', duree:36,
    in:{fleur:3}, out:{miel:4}, loot:[{res:'cire',p:0.3,n:[1,2]}],
    desc:"Une ruche à côté d'un champ de fleurs rend le double. Les abeilles ne vont pas chercher loin ce qu'elles ont sous l'aile." });

  b('filature', {
    nom:'Filature', metier:'Tisserand', cat:'atelier', rangees:[1,2],
    desc:"Le métier à tisser tient tout le rez : ensouple, lisses et peigne. Dehors, les écheveaux teints sèchent sur la perche — la seule couleur franche du bourg.",
    cout:{planche:22,pierre:12,bois:15}, temps:130, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['filer','filer_corde','carder'],
  });
  x('carder', { bat:'filature', nom:'Carder la toison', metier:'tissage', duree:12,
    in:{laine:2}, out:{laine:3}, loot:[{res:'fil',p:0.2,n:[1,1]}],
    desc:"On démêle avant de filer. Trois passes aux cardes, et la laine rend un tiers de plus." });
  x('filer_corde', { bat:'filature', nom:'Commettre le cordage', metier:'tissage', duree:34, niv:2,
    in:{lin:3,fil:1}, out:{corde:4},
    desc:"Un cordage de lin vaut trois cordages d'osier — et le treuil de la mine le sait." });
  x('filer', { bat:'filature', nom:'Filer au rouet', metier:'tissage', duree:20,
    in:{laine:3}, out:{fil:2}, desc:"Filé, enroulé, compté en écheveaux." });
  x('tisser_toile', { bat:'filature', nom:'Tisser la toile', metier:'tissage', duree:50, niv:2,
    in:{fil:3,lin:2}, out:{toile:2}, desc:"Voiles, sacs, tentes — et les ailes du moulin." });
  x('teindre', { bat:'filature', nom:'Teindre en cuve', metier:'tissage', duree:70, niv:5,
    in:{drap:1,herbe:3,eau:2}, out:{drap:2}, loot:[{res:'ecu',p:0.5,n:[10,30]}],
    desc:"Garance, guède, gaude. Un drap teint vaut trois draps écrus." });

  /* Filer et tisser sont deux métiers, deux gestes, deux ateliers. La
     filature sort du fil ; c'est ici qu'il devient étoffe. */
  b('tisserand', {
    nom:'Atelier de tissage', metier:'Tisserand', cat:'atelier', rangees:[1,2],
    desc:"Le grand métier à tisser tient tout le rez : ensouple, lisses, peigne, et le battant qui claque toute la journée. Dehors, les draps teints sèchent sur la longue perche — la seule couleur franche du bourg.",
    cout:{planche:26,poutre:1,fil:10}, temps:150, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['tisser_toile','tisser_drap','teindre'],
  });
  x('tisser_toile', { bat:'tisserand', nom:'Tisser la toile', metier:'tissage', duree:50, niv:1,
    in:{fil:3,lin:2}, out:{toile:2}, desc:"Voiles, sacs, tentes — et les ailes du moulin." });
  x('tisser_drap', { bat:'tisserand', nom:'Tisser le drap', metier:'tissage', duree:66, niv:2,
    in:{fil:4,laine:2}, out:{drap:2}, loot:[{res:'fil',p:0.2,n:[1,1]}],
    desc:"Armure croisée, serrée au peigne. C'est ce qui tient chaud quand la Nuée souffle." });
  x('teindre', { bat:'tisserand', nom:'Teindre en cuve', metier:'tissage', duree:70, niv:4,
    in:{drap:1,herbe:3,eau:2}, out:{drap:2}, loot:[{res:'ecu',p:0.5,n:[10,30]}],
    desc:"Garance, guède, gaude. Un drap teint vaut trois draps écrus." });

  x('chandelles', { bat:'bergerie', nom:'Couler des chandelles', metier:'cuisine', duree:42, niv:3,
    in:{suif:3,corde:1}, out:{cire:3}, moral:3,
    desc:"Une mèche de chanvre, trois trempes dans le suif fondu. On veille plus tard, et l'on travaille mieux le lendemain." });
  x('litiere', { bat:'etable', nom:'Refaire la litière', metier:'elevage', duree:30, niv:2,
    in:{paille:4}, out:{lait:6}, loot:[{res:'legume',p:0.3,n:[1,3]}],
    desc:"Une bête au sec donne un tiers de plus. Ce n'est pas de la tendresse, c'est du rendement." });

  b('tannerie', {
    nom:'Tannerie', metier:'Tanneur', cat:'atelier', rangees:[2], nivMax:8,
    desc:"Les cuves sont le bâtiment : trois fosses maçonnées de tan brun, la perche du tanneur, les peaux tendues sur cadres comme des voiles. On la met sous le vent.",
    cout:{pierre:25,bois:20,eau:10}, temps:120, postes:P(1,1,2,2,2,3,3,3),
    recettes:['tanner','parcheminer'],
  });
  x('tanner', { bat:'tannerie', nom:'Tanner au tan', metier:'tissage', duree:46,
    in:{peau:2,herbe:1,eau:2,cendre:2}, out:{cuir:2}, desc:"Trois semaines dans le tan. Souple, solide, et qui sent fort." });
  x('parcheminer', { bat:'tannerie', nom:'Racler le parchemin', metier:'savoir', duree:64, niv:4,
    in:{peau:2,eau:2}, out:{parchemin:2}, desc:"Peau raclée, poncée, tendue au cadre. Le support de tout ce qui se transmet." });

  /* =================================================================
     D. LE SAVOIR, LE TRÉSOR, LE COMMERCE
     ================================================================= */

  b('herboristerie', {
    nom:'Herboristerie', metier:'Herboriste', cat:'recolte', rangees:[1,2], nivMax:8,
    desc:"Une cabane sous un séchoir ouvert : ce sont les bottes suspendues tête en bas qui font l'atelier. Devant, le jardin de simples en rangs serrés.",
    cout:{bois:18,planche:6}, temps:60, postes:P(1,1,2,2,2,3,3,3),
    recettes:['cueillir','secher_simples','chercher_champignons'],
  });
  x('cueillir', { bat:'herboristerie', nom:'Cueillir en lisière', metier:'champs', duree:11,
    out:{herbe:2}, loot:[{res:'champignon',p:0.14,n:[1,1]}], desc:"On connaît chaque talus, et chaque talus a sa saison." });
  x('chercher_champignons', { bat:'herboristerie', nom:'Chercher les champignons', metier:'champs', duree:26, niv:2,
    out:{champignon:3}, loot:[{res:'herbe',p:0.3,n:[1,2]},{res:'essence',p:0.01,n:[1,1]}],
    desc:"Trois sur quatre sont bons. Le quatrième fait de très beaux rêves." });
  x('secher_simples', { bat:'herboristerie', nom:'Sécher les simples', metier:'savoir', duree:30, niv:3,
    in:{herbe:4}, out:{herbe:6}, desc:"Tête en bas, à l'ombre, trois semaines. Ce qui sèche bien vaut le double." });

  b('alchimie', {
    nom:"Laboratoire d'alchimie", metier:'Alchimiste', cat:'atelier', rangees:[1,2],
    desc:"Bocaux, vapeurs vertes, et une tour qui penche un peu plus chaque année. On y cherche l'or ; on y trouve surtout des remèdes, ce qui se vend mieux.",
    cout:{pierretaille:10,fiole:6,planche:14}, temps:190, postes:P(1,1,1,2,2,2,3,3,3,3),
    recettes:['potion_soin','potion_antidote','amertume','potion_givre','potion_celerite',
              'potion_rage','potion_precision','elixir','potion_bouclier','potion_confusion',
              'potion_phoenix','encre_noire','distiller_essence',
              'garde_feu','garde_venin','garde_gel','garde_foudre','garde_ombre',
              'ouvrir_coeur','distiller_parfum'],
  });
  x('potion_soin', { bat:'alchimie', nom:'Distiller un remède', metier:'savoir', duree:60,
    image:'img/objets/alchimie/soin.png', in:{herbe:3,fiole:1,eau:1,champignon:1}, out:{potion:1},
    desc:"Ce qu'on emporte dans la descente et qu'on regrette de n'avoir pas pris en double." });
  x('encre_noire', { bat:'alchimie', nom:"Broyer l'encre", metier:'savoir', duree:44, niv:2,
    in:{charbonbois:1,herbe:2,huile:1}, out:{encre:2},
    desc:"Noir de fumée, gomme et fiel. Elle ne pardonne pas les repentirs." });
  x('elixir', { bat:'alchimie', nom:'Composer un élixir', metier:'savoir', duree:150, niv:5,
    image:'img/objets/alchimie/regeneration.png', in:{potion:2,essence:2,gemme:1}, out:{potion:6},
    desc:"L'essence des profondeurs, fixée dans le verre. Six fioles d'un coup, et bien meilleures." });
  x('potion_antidote', { bat:'alchimie', nom:'Brasser un antidote', metier:'savoir', duree:64, niv:2,
    image:'img/objets/alchimie/antidote.png', in:{herbe:3,racine:2,fiole:1,eau:2}, out:{potion:2},
    desc:"Vert, amer, efficace contre tout ce qui mord, pique ou pousse dans les marais." });
  x('potion_givre', { bat:'alchimie', nom:'Fixer le givre', metier:'savoir', duree:78, niv:3,
    image:'img/objets/alchimie/givre.png', in:{eau:4,essence:1,fiole:1}, out:{potion:2},
    desc:"La fiole reste froide même près du four. Sur le terrain, elle arrête une charge." });
  x('potion_celerite', { bat:'alchimie', nom:'Élixir de célérité', metier:'savoir', duree:88, niv:4,
    image:'img/objets/alchimie/celerite.png', in:{fleur:5,miel:2,fiole:1}, out:{potion:2},
    desc:"Les jambes partent avant que la tête ait fini de décider où aller." });
  x('potion_rage', { bat:'alchimie', nom:'Tonique de rage', metier:'savoir', duree:96, niv:4,
    image:'img/objets/alchimie/rage.png', in:{viande:2,racine:3,potion:1}, out:{potion:3},
    desc:"On ne recommande ni le goût, ni la conversation qui suit." });
  x('potion_precision', { bat:'alchimie', nom:'Élixir de l'œil clair', metier:'savoir', duree:112, niv:5,
    image:'img/objets/alchimie/precision.png', in:{ambre:1,herbe:4,fiole:1}, out:{potion:2},
    desc:"Le monde ralentit juste assez pour que la flèche trouve sa place." });
  x('potion_bouclier', { bat:'alchimie', nom:'Bouclier en fiole', metier:'savoir', duree:138, niv:6,
    image:'img/objets/alchimie/bouclier-arcane.png', in:{gemme:1,essence:2,potion:1}, out:{potion:3},
    desc:"Une peau bleue de lumière qui encaisse le premier mauvais choix." });
  x('potion_confusion', { bat:'alchimie', nom:'Distillat de confusion', metier:'savoir', duree:148, niv:7,
    image:'img/objets/alchimie/confusion.png', in:{champignon:6,essence:2,fiole:2}, out:{potion:3},
    desc:"Les ennemis oublient brièvement qui ils poursuivaient. Parfois eux-mêmes." });
  x('potion_phoenix', { bat:'alchimie', nom:'Élixir du phénix', metier:'savoir', duree:260, niv:9,
    image:'img/objets/alchimie/phoenix.png', in:{coeurbiome:1,gardefeu:2,essence:5,fiole:2}, out:{potion:8},
    desc:"Une chaleur impossible enfermée dans du verre. À réserver aux descentes dont on ne devrait pas revenir." });
  /* ---------------------------------------------------------------
     LES GARDES DE PROFONDEUR. Chacune consomme une TROUVAILLE qu'aucun
     métier ne produit : c'est ce qui relie le pêcheur du mardi à
     l'étage soixante. Une fiole donne plusieurs charges ; une charge
     tient un étage.
     --------------------------------------------------------------- */
  x('garde_feu', { bat:'alchimie', nom:'Onguent contre le feu', metier:'savoir', duree:90, niv:2,
    image:'img/objets/alchimie/garde-feu.png', in:{ecaille:2,resine:3,huile:1}, out:{gardefeu:4},
    loot:[{res:'cendre',p:0.30,n:[1,3]}],
    desc:"Écaille pilée, résine chaude, huile de lin. Ça pue, ça tient, et sans ça les Fournaises mangent la compagnie." });
  x('garde_venin', { bat:'alchimie', nom:'Décoction contre le venin', metier:'savoir', duree:95, niv:3,
    image:'img/objets/alchimie/antidote.png', in:{racine:4,herbe:4,fiole:1}, out:{gardevenin:4},
    loot:[{res:'herbe',p:0.25,n:[1,2]}],
    desc:"On fait bouillir la racine amère trois fois, en jetant l'eau deux fois. La troisième se boit." });
  x('garde_gel', { bat:'alchimie', nom:'Doublure contre le gel', metier:'tissage', duree:100, niv:4,
    image:'img/objets/alchimie/givre.png', in:{plume:5,drap:1,huile:1}, out:{gardegel:4},
    desc:"Plume de Nuée cousue entre deux draps. Le Grand Froid ne se combat pas : il se retarde." });
  x('garde_foudre', { bat:'alchimie', nom:'Bracelet contre la foudre', metier:'forge', duree:120, niv:5,
    image:'img/objets/alchimie/garde-foudre.png', in:{ambre:2,lingotcuivre:1,cuir:1}, out:{gardefoudre:4},
    loot:[{res:'limaille',p:0.30,n:[1,2]}],
    desc:"L'ambre prend la décharge, le cuivre l'emporte au sol. On le porte au poignet, jamais au cou." });
  x('garde_ombre', { bat:'alchimie', nom:"Chandelle contre l'ombre", metier:'savoir', duree:150, niv:6,
    image:'img/objets/alchimie/garde-ombre.png', in:{perle:1,cire:4,essence:1}, out:{gardeombre:4},
    desc:"Elle ne fait aucune lumière. Elle empêche seulement l'ombre d'entrer, ce qui est bien plus utile." });
  x('ouvrir_coeur', { bat:'alchimie', nom:'Ouvrir un cœur de biome', metier:'savoir', duree:180, niv:6,
    in:{coeurbiome:1,fiole:2}, out:{essence:14,gemme:2},
    loot:[{res:'obsidienne',p:0.22,n:[1,1]},{res:'relique',p:0.05,n:[1,1]}],
    desc:"Ce qui bat au fond d'un gardien ne bat plus quand on l'ouvre — mais tout en sort d'un coup." });

  x('distiller_essence', { bat:'alchimie', nom:"Raffiner l'essence", metier:'savoir', duree:200, niv:7,
    in:{essence:4,charbonbois:2,fiole:2}, out:{essence:9},
    desc:"On ne la crée pas — on la concentre. C'est ce qui rend la descente rentable." });

  x('distiller_parfum', { bat:'alchimie', nom:'Distiller les fleurs', metier:'savoir', duree:130,
    raff:'alambic', in:{fleur:12,eau:4,fiole:1}, out:{parfum:1},
    loot:[{res:'huile',p:0.3,n:[1,1]}],
    desc:"Trois cents fleurs pour une fiole. Personne au bourg n'en met ; tout le monde en vend." });

  x('collier_perles', { bat:'orfevre', nom:'Enfiler les perles', metier:'poterie', duree:80, niv:2,
    in:{perle:2,fil:2}, out:{bijou:2}, loot:[{res:'ecu',p:0.4,n:[60,200]}],
    desc:"Percées à l'archet, enfilées sur un fil de soie. C'est ce que le colporteur emporte en premier." });
  x('amertume', { bat:'alchimie', nom:'Décoction amère', metier:'savoir', duree:56, niv:2,
    image:'img/objets/alchimie/purification.png', in:{racine:2,eau:2,fiole:1}, out:{potion:2},
    desc:"Imbuvable, souveraine. On la garde pour les jours où quelqu'un revient de la tour mal en point." });

  b('scriptorium', {
    nom:'Scriptorium', metier:'Copiste', cat:'atelier', rangees:[0,1],
    desc:"Haut, étroit, tout en baies : on n'y fait rien d'autre que copier, et il faut du jour. Un grimoire à la fois, jamais deux.",
    cout:{pierretaille:16,parchemin:4,verre:4,tuile:10}, temps:260, postes:P(1,1,1,2,2,2,2,3,3,3),
    recettes:['copier_sort','tracer_plan','ecrire_chant','essaimer_savoir','dorure'],
  });
  x('copier_sort', { bat:'scriptorium', nom:'Copier un sort', metier:'savoir', duree:180,
    in:{parchemin:2,encre:2,essence:1}, out:{sort:1},
    desc:"Un sort copié est un sort qu'on peut lancer. La compagnie n'en emporte qu'un jeu à la fois." });
  x('tracer_plan', { bat:'scriptorium', nom:'Mettre un plan au net', metier:'savoir', duree:220, niv:4,
    in:{parchemin:3,encre:1,gemme:1}, out:{plan:1},
    desc:"Le dessin d'un ouvrage qu'on ne savait pas faire. C'est ainsi qu'on apprend des profondeurs." });
  x('ecrire_chant', { bat:'scriptorium', nom:'Écrire un chant de guerre', metier:'savoir', duree:140, niv:3,
    in:{parchemin:1,encre:1}, out:{chant:1},
    desc:"Appris par la troupe avant de partir. Il vaut une armure de plus." });

  x('harnois_bronze', { bat:'armurerie', nom:'Battre un harnois de bronze', metier:'forge', duree:96, niv:2,
    in:{bronze:2,cuir:2}, out:{armure:2}, loot:[{res:'limaille',p:0.4,n:[2,5]}],
    desc:"Plus tendre que l'acier, mais il ne rouille pas et se rebat à froid. L'armure des premières colonnes, celle qu'on répare au campement." });
  x('couler_cloche', { bat:'orfevre', nom:'Couler une cloche', metier:'forge', duree:150, niv:3,
    in:{bronze:4,charbonbois:2}, out:{}, moral:9, xpBourg:40,
    loot:[{res:'ecu',p:0.5,n:[80,240]}],
    desc:"Une seule coulée, et l'on ne la refait pas. Le bourg entier l'entend, et le bourg entier se tient mieux." });

  x('essaimer_savoir', { bat:'scriptorium', nom:'Essaimer un grimoire', metier:'savoir', duree:170, niv:4,
    in:{sort:1,parchemin:3,encre:2}, out:{plan:2}, xpBourg:90,
    desc:"Un grimoire lu par un seul ne vaut rien. Recopié en trois cahiers, il devient trois ateliers qui savent." });

  b('orfevre', {
    nom:'Orfèvre', metier:'Orfèvre', cat:'atelier', rangees:[1,2], nivMax:8,
    desc:"Petit, riche, fermé : vitrine grillagée, balance de précision, four à coupelle et coffret ferré. Le seul bâtiment du bourg qui ait une serrure.",
    cout:{pierretaille:14,lingotargent:2,verre:4}, temps:280, postes:P(1,1,1,2,2,2,2,3),
    recettes:['monnayer','joaillerie','sertir','couler_cloche','collier_perles'],
  });
  x('monnayer', { bat:'orfevre', nom:'Frapper monnaie', metier:'forge', duree:60,
    in:{lingotargent:1}, out:{ecu:340}, desc:"Le coin, le flan, le marteau. Le comté ferme les yeux tant que le titre est bon." });
  x('joaillerie', { bat:'orfevre', nom:'Monter un bijou', metier:'forge', duree:170, niv:3,
    in:{lingotor:1,gemme:2}, out:{bijou:1},
    desc:"Se porte, se vend, et impressionne les émissaires du comté." });
  x('sertir', { bat:'orfevre', nom:'Sertir une relique', metier:'forge', duree:400, niv:6,
    in:{relique:1,lingotor:2,gemme:3}, out:{bijou:6}, loot:[{res:'chant',p:0.5,n:[1,2]}],
    desc:"On ne sait pas ce que c'était. On sait ce que ça vaut une fois monté." });

  b('taverne', {
    nom:'Taverne', metier:'Aubergiste', cat:'commerce', rangees:[1,2],
    desc:"L'édifice le plus éclairé du bourg. C'est là que les écus changent de patte, et là qu'on apprend ce qui se passe deux vallées plus loin.",
    cout:{planche:24,pierre:16,tuile:10}, temps:150, postes:P(1,1,2,2,2,3,3,3,3,4),
    /* On y parle du bourg à ceux qui passent : les voyageurs qui se
       présentent aux portes sont d'une autre trempe. */
    effet:{attrait:0.75},
    recettes:['servir','vendre_surplus','recruter_bras','vendre_parfum','servir_cidre'],
  });
  x('servir', { bat:'taverne', nom:'Tenir la salle', metier:'cuisine', duree:26,
    in:{pain:2,poisson:2}, out:{ecu:70}, desc:"On sert, on encaisse, on écoute. Les trois vont ensemble." });
  x('vendre_surplus', { bat:'taverne', nom:'Vendre au colporteur', metier:'negoce', duree:40, niv:2,
    in:{poterie:1,drap:1}, out:{ecu:260}, loot:[{res:'plan',p:0.05,n:[1,1]}],
    desc:"Il passe une fois la semaine et repart avec tout ce qui traîne." });
  x('servir_cidre', { bat:'taverne', nom:'Tirer le cidre au tonneau', metier:'negoce', duree:34, niv:2,
    in:{cidre:2}, out:{ecu:260}, loot:[{res:'plan',p:0.04,n:[1,1]}],
    desc:"Le seul commerce du bourg où le client revient le lendemain se plaindre, puis en reprend." });
  x('vendre_parfum', { bat:'taverne', nom:'Vendre le parfum au colporteur', metier:'negoce', duree:60, niv:3,
    in:{parfum:1}, out:{ecu:900}, loot:[{res:'plan',p:0.06,n:[1,1]}],
    desc:"Il ne demande jamais ce qu'il y a dedans. Il demande combien il y en a." });
  x('recruter_bras', { bat:'taverne', nom:'Payer une tournée', metier:'cuisine', duree:120, niv:4,
    in:{ecu:900,tourte:2}, out:{}, recrue:1,
    desc:"À la troisième chope, on trouve toujours quelqu'un pour s'installer au bourg. La nurserie n'élève que des soldats : un ouvrier, il faut aller le chercher dehors — aux portes, ou ici, au prix fort." });

  /* LE PORT. Il ne produit presque rien : il ARME. Toute la guerre
     passe par lui — on y affrète les navires, on les charge, on les
     envoie, et c'est là qu'on lance la bataille quand ils touchent
     terre. C'est aussi la seule façon de faire retomber la Nuée. */
  b('port', {
    nom:'Le Port', metier:'Capitaine', cat:'porte', rangees:[0,1], nivMax:6,
    desc:"Un môle de pierre, deux ducs-d'Albe et une grue à chèvre. Tant que le bourg n'a pas de port, la Nuée choisit seule le moment de venir.",
    cout:{bois:34,poisson:26}, temps:150, postes:P(1,1,1,2,2,2),
    recettes:['carener','cordages'],
  });
  x('carener', { bat:'port', nom:'Caréner la coque', metier:'bois', duree:70,
    in:{planche:4,resine:1}, out:{}, xpBourg:20,
    desc:"On échoue le navire à marée basse, on gratte, on brûle, on repasse au suif. Une coque propre gagne un nœud." });
  x('cordages', { bat:'port', nom:'Commettre du cordage', metier:'tissage', duree:52,
    in:{fil:4}, out:{corde:5}, loot:[{res:'toile',p:0.2,n:[1,1]}],
    desc:"Trois torons commis à l'envers l'un de l'autre. Sans cordage, un navire n'est qu'une caisse qui flotte." });

  b('halle', {
    nom:'Halle', metier:'—', cat:'commerce', rangees:[1,2], nivMax:6,
    desc:"Charpente sur poteaux, étals dessous, et la mesure à grain scellée au pilier. Elle fait baisser le prix de tout ce que le bourg achète.",
    cout:{planche:30,pierre:14,tuile:12}, temps:140, postes:P(0),
    effet:{negoce:0.06,attrait:0.15},
  });

  /* =================================================================
     E. LA VIE, LA GUERRE, LES PORTES
     ================================================================= */

  b('nurserie', {
    nom:'Nurserie', metier:'Nourrice', cat:'vie', rangees:[1,2],
    desc:"Le cœur tendre du bourg. Coussins, paniers, linge minuscule sur la corde, et la grande tour à plateformes où les chatons apprennent à retomber d'où ils sont tombés.",
    cout:{planche:16,laine:6,lait:20}, temps:160, postes:P(1,1,1,2,2,2,2,2,3,3),
    logement:[2,2,3,3,4,4,5,5,6,6],
    /* le seul toit sous lequel une portée peut grandir : sans nurserie,
       le plafond du peuple est à zéro et rien ne s'élève. */
    stock:{peuple:4},
    recettes:['elever_chaton','ecole'],
  });
  x('elever_chaton', { bat:'nurserie', nom:'Élever une portée', metier:'elevage', duree:240,
    in:{lait:8,poisson:10,laine:2}, out:{chaton:1},
    desc:"Quatre minutes de lait, de poisson et de laine pour une portée. Ceux-là ne travailleront pas : ils sont la matière dont on fait les compagnies." });
  x('ecole', { bat:'nurserie', nom:'Faire la classe', metier:'savoir', duree:150, niv:4,
    in:{parchemin:1,pain:4}, out:{}, xpBourg:60,
    desc:"On y apprend les métiers avant de les exercer : tout le bourg y gagne de l'expérience." });

  b('entrainement', {
    nom:"Terrain d'entraînement", metier:"Maître d'armes", cat:'guerre', rangees:[0,1],
    desc:"Sable damé, mannequins de paille, quintaine qui pivote quand on la frappe mal. La caserne forme les recrues ; ici, une compagnie déjà levée apprend à survivre plus bas.",
    cout:{planche:20,pierre:10,corde:4}, temps:210, postes:P(1,1,1,2,2,2,2,3,3,3),
    recettes:['incorporer_chatons','exercer','forger_esprit'],
  });
  x('incorporer_chatons', { bat:'entrainement', nom:'Incorporer une portée', metier:'guerre', duree:150,
    in:{chaton:1,arme:1,pain:4}, out:{}, unite:3, xpArmee:35,
    desc:"La filière avancée transforme une portée équipée en trois soldats aguerris. La caserne reste suffisante pour les premières recrues." });
  x('exercer', { bat:'entrainement', nom:'Exercice au mannequin', metier:'guerre', duree:70, niv:2,
    in:{pain:2}, out:{}, xpArmee:40,
    desc:"Rien ne se produit, tout se gagne : l'expérience de la compagnie monte." });
  x('forger_esprit', { bat:'entrainement', nom:'Répéter les chants', metier:'guerre', duree:110, niv:5,
    in:{chant:1,tourte:1}, out:{}, xpArmee:150,
    desc:"On chante avant de partir. Ça ne sert à rien, sauf que ça sert énormément." });

  b('caserne', {
    nom:'Caserne', metier:"Sergent d'armes", cat:'guerre', rangees:[0,1],
    desc:"Le premier vrai objectif du bourg. Avec du bois, du poisson et un peu de temps, le sergent lève les recrues qui descendront dans la Tour et repousseront la Nuée.",
    cout:{bois:18,poisson:12}, temps:55, postes:P(1,1,1,2,2,2,3,3,3,4),
    recettes:[],
    effet:{armee:4,defense:8},
  });
  /* La vieille version contenait vingt-deux corps de troupe jouables mais
     le bourg les avait aplatis en un unique compteur. Ils reviennent par
     paliers : les quatre premières formations ne réclament QUE du poisson
     et du bois ; chaque niveau de caserne ouvre ensuite une vraie option. */
  const FORMATIONS = [
    ['lancier',    1, 48,  {bois:3,poisson:5}],
    ['eclaireur',  1, 42,  {bois:4,poisson:4}],
    ['fronde',     1, 52,  {bois:6,poisson:4}],
    ['targier',    2, 70,  {bois:9,poisson:7}],
    ['costaud',    3, 105, {planche:4,pain:3}],
    ['traqueur',   3, 115, {planche:5,poissonfume:3}],
    ['barde',      3, 125, {planche:4,pain:5}],
    ['porteur',    3, 130, {planche:7,pain:4}],
    ['essaim',     3, 135, {poissonfume:5,pierre:6}],
    ['mage',       4, 185, {planche:8,essence:3}],
    ['sapeur',     4, 190, {acier:2,planche:9}],
    ['aura',       4, 210, {essence:5,pain:8}],
    ['entraveur',  4, 205, {cuir:4,poissonfume:8}],
    ['ingenieur',  4, 220, {acier:3,planche:12}],
    ['rempart',    5, 280, {acier:5,cuir:6}],
    ['artilleur',  6, 360, {arme:2,acier:8}],
    ['assassin',   6, 340, {arme:2,cuir:10}],
    ['soigneur',   6, 330, {essence:8,tourte:3}],
    ['invocateur', 7, 430, {essence:14,tourte:5}],
    ['espion',     7, 410, {arme:3,cuir:14}],
    ['heros',      9, 720, {arme:8,acier:20,essence:18}],
    ['chronarque',10, 900, {arme:10,acier:28,essence:30}],
  ];
  for (const f of FORMATIONS) {
    const type = f[0], def = window.GameData && window.GameData.UNIT_TYPES[type];
    const nom = def && def.name ? (def.name.cats || def.name) : type;
    const id = 'former_' + type;
    BAT.caserne.recettes.push(id);
    x(id, { bat:'caserne', nom:'Former · ' + nom, metier:'guerre', niv:f[1], duree:f[2],
      in:f[3], out:{}, unite:1, uniteType:type,
      desc:def ? def.desc.cats : 'Former une nouvelle unité.' });
  }

  b('rempart', {
    nom:'Rempart', metier:'—', cat:'guerre', rangees:[0,1],
    desc:"Courtine, chemin de ronde, machicoulis. Ce qui décide de ce que coûte un raid : rien du tout, ou trois bâtiments incendiés.",
    cout:{pierretaille:30,poutre:2}, temps:300, postes:P(0),
    effet:{defense:22},
  });

  b('tour', {
    nom:'Tour de guet', metier:'Guetteur', cat:'guerre', rangees:[0,1], nivMax:8,
    desc:"On y voit venir. Le guetteur annonce les colonnes deux jours à l'avance : la Menace monte moins vite quand quelqu'un la regarde.",
    cout:{pierretaille:18,planche:8}, temps:200, postes:P(1,1,1,1,2,2,2,2),
    effet:{defense:10},
    recettes:['veiller'],
  });
  x('veiller', { bat:'tour', nom:'Tenir le guet', metier:'guerre', duree:50,
    out:{}, menace:-4, loot:[{res:'ecu',p:0.2,n:[5,20]}],
    desc:"Rien ne se produit et pourtant c'est capital : chaque tour de garde fait redescendre la Menace." });

  b('eglise', {
    nom:'Chapelle', metier:'Chapelain', cat:'vie', rangees:[0,1], nivMax:6,
    desc:"Nef basse, clocher-mur, vitrail au levant. On n'y produit rien : on y gagne le calme, et le calme fait travailler plus vite.",
    cout:{pierretaille:22,verre:4,cire:6,tuile:14}, temps:280, postes:P(1,1,1,1,2,2),
    effet:{moral:8,attrait:0.5},
    recettes:['office'],
  });
  x('office', { bat:'eglise', nom:"Dire l'office", metier:'savoir', duree:90,
    in:{cire:2}, out:{}, moral:14,
    desc:"Le bourg entier s'arrête un quart d'heure et repart de meilleure humeur. Mesurable, hélas." });

  b('chateau', {
    nom:'Donjon', metier:'—', cat:'vie', rangees:[0,1], nivMax:6,
    desc:"Le donjon du bourg, sa salle haute et son coffre. Il n'abrite personne d'utile — mais c'est lui qui garde les savoirs et le trésor.",
    cout:{pierretaille:60,poutre:4,lingotfer:10,tuile:20}, temps:600, postes:P(0),
    stock:{savoir:9999,profond:9999,monnaie:9999999},
    effet:{prestige:20,attrait:0.9},
  });

  b('arbrechat', {
    nom:'Arbre à chat', metier:'—', cat:'vie', rangees:[1,2], nivMax:5,
    desc:"Plateformes, passerelles, hamacs et un poteau à griffer haut de trois mètres. Rigoureusement inutile, et le bourg travaille mieux quand il y en a.",
    cout:{bois:25,corde:4,drap:1}, temps:70, postes:P(0),
    effet:{moral:6,attrait:0.2},
  });

  b('descente', {
    nom:'Tour sombre', metier:'—', cat:'porte', rangees:[0,1], nivMax:5,
    desc:"Une tour cyclopéenne et un escalier qui plonge dans un noir que rien n'éclaire. On n'a jamais trouvé le fond ; on a seulement trouvé jusqu'où l'on pouvait descendre.",
    cout:{pierre:24,planche:14,corde:8}, temps:350, postes:P(0),
    porte:'aventure', apparait:true,
  });

  /* ---------------------------------------------------------------
     Ordre d'apparition dans le carnet du maître d'œuvre, et
     conditions de déblocage. On ne montre pas au joueur trente
     bâtiments le premier jour : il en découvre au fil de la chaîne.
     --------------------------------------------------------------- */
  const DEBLOCAGE = {
    pecherie:      null,
    scierie:       { res:{poisson:15} },
    maison:        { bat:{scierie:1} },
    /* PREMIÈRE BOUCLE : poisson -> bois -> caserne -> Tour / expédition.
       Elle tient en quelques minutes et ne demande aucune transformation. */
    caserne:       { bat:{scierie:1} },
    /* LE PORT s'ouvre TÔT — dès qu'on sait pêcher et scier. C'est par
       lui que passe toute la guerre, et rien ne fait retomber la Nuée
       tant qu'il n'est pas debout : le retarder, c'est condamner le
       joueur à subir la jauge pendant tout le début de partie. */
    port:          { bat:{scierie:1} },
    champ:         { bat:{caserne:1} },
    grange:        { bat:{champ:1} },

    /* DEUXIÈME BOUCLE : le village s'étend et les transformations
       apparaissent une famille à la fois, portées par les niveaux. */
    carriere:      { bat:{scierie:2,caserne:1} },
    potager:       { bat:{champ:2} },
    puits:         { bat:{champ:2,carriere:1} },
    entrepot:      { bat:{scierie:2,carriere:1} },
    entrainement:  { bat:{caserne:2,carriere:1} },
    bergerie:      { bat:{champ:2} },
    tournesol:     { bat:{champ:3} },
    moulin:        { bat:{champ:3} },
    cuisine:       { bat:{moulin:1} },
    fumoir:        { bat:{cuisine:2} },
    fleurs:        { bat:{potager:2} },
    pepiniere:     { bat:{potager:3} },
    herboristerie: { bat:{potager:3} },
    etable:        { bat:{bergerie:2} },
    filature:      { bat:{bergerie:2} },
    laiterie:      { bat:{etable:2} },
    nurserie:      { bat:{laiterie:1,filature:1} },

    /* TROISIÈME BOUCLE : pierre, feu et métal. Ces ateliers sont longs
       et chacun ouvre réellement le suivant. */
    poterie:       { bat:{carriere:2} },
    tuilerie:      { bat:{poterie:2} },
    mine:          { bat:{carriere:3} },
    charbonniere:  { bat:{scierie:3,carriere:1} },
    fonderie:      { bat:{mine:2,charbonniere:1} },
    forge:         { bat:{fonderie:2} },
    tannerie:      { bat:{bergerie:3} },
    tisserand:     { bat:{filature:2} },
    moulinEau:     { bat:{moulin:3} },
    verrerie:      { bat:{tuilerie:3} },
    armurerie:     { bat:{forge:3} },
    alchimie:      { bat:{verrerie:2,herboristerie:2} },
    rucher:        { bat:{fleurs:2} },
    taverne:       { bat:{cuisine:3} },
    halle:         { bat:{taverne:2} },
    tour:          { bat:{carriere:3} },
    rempart:       { bat:{caserne:3,carriere:3} },
    scriptorium:   { bat:{tuilerie:3} },
    orfevre:       { bat:{forge:4} },
    eglise:        { bat:{tuilerie:2} },
    chateau:       { bat:{rempart:1} },
    arbrechat:     { bat:{maison:3,tisserand:1} },
    /* La Tour sombre est déjà sur l'île ; l'assemblage la pose au départ. */
    descente:      null,
  };
  for (const id in DEBLOCAGE) if (BAT[id]) BAT[id].deblocage = DEBLOCAGE[id];

  /* Le départ doit répondre vite ; ensuite le bourg devient un vrai jeu
     idle. Les ateliers mûrs prennent plus longtemps à sortir de terre et
     chaque niveau creuse nettement l'écart. */
  function coutNiveau(bid, niv) {
    if (!BAT[bid]) return {};
    const base = BAT[bid].cout || {};
    const k = Math.pow(1.85, Math.max(0, niv - 1));
    const out = {};
    for (const r in base) out[r] = Math.max(1, Math.round(base[r] * k));
    return out;
  }
  function tempsNiveau(bid, niv) {
    const rapides = ['pecherie','scierie','maison','caserne','port'];
    const transition = ['champ','grange'];
    const intermediaires = ['carriere','potager','puits','entrepot','bergerie',
      'tournesol','moulin','entrainement','tour'];
    const phase = rapides.indexOf(bid) >= 0 ? 1
      : (transition.indexOf(bid) >= 0 ? 1.25
        : (intermediaires.indexOf(bid) >= 0 ? 1.6 : 2));
    return Math.round((BAT[bid].temps || 30) * phase * Math.pow(1.55, Math.max(0, niv - 1)));
  }
  /* Un type inconnu — une sauvegarde qui cite un bâtiment retiré depuis —
     ne doit JAMAIS jeter : ces fonctions sont appelées des dizaines de
     fois par seconde et une exception ici fige le jeu au chargement. */
  function postesDe(bid, niv) {
    if (!BAT[bid]) return 0;
    const p = BAT[bid].postes || [0];
    return p[Math.min(p.length - 1, Math.max(0, niv - 1))] || 0;
  }
  function logementDe(bid, niv) {
    if (!BAT[bid]) return 0;
    const l = BAT[bid].logement; if (!l) return 0;
    return l[Math.min(l.length - 1, Math.max(0, niv - 1))] || 0;
  }
  function stockDe(bid, niv) {
    if (!BAT[bid]) return null;
    const s = BAT[bid].stock; if (!s) return null;
    const out = {}; for (const c in s) out[c] = Math.round(s[c] * (1 + 0.55 * (niv - 1)));
    return out;
  }
  /* `raff` : la recette dort tant que l'annexe n'est pas bâtie. On
     passe le bâtiment INSTANCIÉ en troisième argument quand on l'a —
     sans lui, on ne montre que ce qui ne demande aucune annexe. */
  function recettesDe(bid, niv, b) {
    if (!BAT[bid]) return [];
    return (BAT[bid].recettes || []).filter(rid => {
      const r = REC[rid];
      if (!r || r.niv > niv) return false;
      if (!r.raff) return true;
      return !!(b && b.raff && b.raff[r.raff]);
    });
  }

  window.BAT = BAT;
  window.REC = REC;
  window.BAT_ORDRE = ORDRE;
  window.METIERS = METIERS;
  window.BatUtil = { coutNiveau, tempsNiveau, postesDe, logementDe, stockDe, recettesDe };

})();
