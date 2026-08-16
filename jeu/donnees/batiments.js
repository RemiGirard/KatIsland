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
    recettes:['peche_filet','peche_nasse','peche_fond','peche_glace'],
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

  b('scierie', {
    nom:'Scierie', metier:'Bûcheron', cat:'recolte', rangees:[1,2],
    desc:"Un hangar ouvert, la scie à cadre battue par la roue, la grume sur son chariot. Tout le reste du bourg est bâti avec ce qui en sort.",
    cout:{poisson:25}, temps:40, postes:P(1,1,2,2,2,3,3,3,4,4),
    recettes:['coupe_bois','sciage','tresser_osier','poutres','ecorce'],
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

  b('champ', {
    nom:'Champ', metier:'Laboureur', cat:'recolte', rangees:[0,1],
    desc:"Une parcelle labourée en sillons, l'épouvantail de guingois, la borne au coin. Large et basse : elle mange une terrasse entière.",
    cout:{bois:20,poisson:20}, temps:50, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['semer_ble','racines','lin_champ','jachere'],
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
    desc:"Colombage, volets peints, chatière au bas de la porte. Chaque maison abrite trois habitants de plus — et le bourg n'a jamais assez de pattes.",
    cout:{bois:34}, temps:60, postes:P(0),
    logement:[3,4,5,6,7,8,9,10],
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
    out:{pierre:2}, loot:[{res:'fer',p:0.07,n:[1,1]},{res:'gemme',p:0.004,n:[1,1]}],
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
    recettes:['filon_fer','veine_charbon','filon_cuivre','filon_etain','filon_argent','filon_or','galerie_profonde'],
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

  b('charbonniere', {
    nom:'Charbonnière', metier:'Charbonnier', cat:'atelier', rangees:[0,1], nivMax:8,
    desc:"Une meule de bois couverte de mottes, l'évent qui fume sans flamme, et la hutte du charbonnier qui veille trois jours de suite.",
    cout:{bois:40,argile:15}, temps:70, postes:P(1,1,1,2,2,2,3,3),
    recettes:['cuire_charbon'],
  });
  x('cuire_charbon', { bat:'charbonniere', nom:'Cuire la meule', metier:'feu', duree:40,
    in:{bois:5}, out:{charbonbois:3}, loot:[{res:'cire',p:0.03,n:[1,1]}],
    desc:"Trois jours sans flamme visible. Le charbonnier ne dort que d'un œil." });

  b('fonderie', {
    nom:'Fonderie', metier:'Fondeur', cat:'atelier', rangees:[1,2],
    desc:"Le four à cuve ne s'éteint jamais tout à fait. On coule la nuit, quand l'œil lit mieux la couleur du métal.",
    cout:{brique:25,pierretaille:10,planche:15}, temps:200, postes:P(1,1,2,2,2,3,3,3,4,4),
    recettes:['couler_fer','couler_cuivre','couler_bronze','couler_acier','couler_argent','couler_or','fondre_mithril'],
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

  b('forge', {
    nom:'Forge', metier:'Forgeron', cat:'atelier', rangees:[1,2],
    desc:"Le marteau y bat du lever au couvre-feu. On y refait les outils que les autres métiers usent, et l'on y trempe les lames dont dépend la descente.",
    cout:{pierretaille:12,planche:12,lingotfer:2}, temps:180, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['clouterie','outil_fer','outil_acier','forger_arme','ferrures'],
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

  b('armurerie', {
    nom:'Armurerie', metier:'Armurier', cat:'atelier', rangees:[1,2],
    desc:"Cottes, écus et heaumes taillés pour des épaules étroites et des oreilles hautes. Le maître refuse toute commande qui gênerait la retombée sur les pattes.",
    cout:{pierretaille:10,lingotfer:6,planche:10}, temps:220, postes:P(1,1,1,2,2,2,3,3,3,3),
    recettes:['forger_armure','forger_ecu','maille_acier','ecailler_harnois'],
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
    recettes:['cuire_brique','cuire_tuile','poterie'],
  });
  x('cuire_brique', { bat:'tuilerie', nom:'Cuire les briques', metier:'feu', duree:24,
    in:{argile:3,bois:1}, out:{brique:2}, desc:"Elles montent vite et supportent le feu : c'est tout ce qu'on leur demande." });
  x('cuire_tuile', { bat:'tuilerie', nom:'Cuire les tuiles', metier:'feu', duree:28, niv:2,
    in:{argile:3,bois:1}, out:{tuile:2}, desc:"Moulées sur le genou, séchées de chant, cuites au rouge sombre." });
  x('poterie', { bat:'tuilerie', nom:'Tourner la poterie', metier:'feu', duree:36, niv:3,
    in:{argile:2,bois:1}, out:{poterie:1}, loot:[{res:'ecu',p:0.3,n:[3,9]}],
    desc:"Jarres et cruches. Sans elles, rien ne se garde et rien ne se transporte." });

  b('poterie', {
    nom:'Poterie', metier:'Potier', cat:'atelier', rangees:[1,2], nivMax:8,
    desc:"Le tour à bâton, les claies de séchage, et le four en ruche qui ronfle derrière. Tout le bourg mange un jour dans ce qui sort d'ici.",
    cout:{argile:18,bois:12}, temps:80, postes:P(1,1,2,2,2,3,3,3),
    recettes:['tourner_pot','fournee_gres','jarres_marchandes'],
  });
  x('tourner_pot', { bat:'poterie', nom:'Tourner au colombin', metier:'tissage', duree:20,
    in:{argile:2,eau:1}, out:{poterie:1},
    desc:"L'argile monte entre les pattes. Un geste ancien, et un pot qui tient l'eau." });
  x('fournee_gres', { bat:'poterie', nom:'Cuire une fournée de grès', metier:'feu', duree:70, niv:3,
    in:{argile:6,charbonbois:1}, out:{poterie:4}, loot:[{res:'ecu',p:0.25,n:[4,12]}],
    desc:"Le four en ruche monte au rouge sombre et rend quatre pièces d'un coup — quand rien n'éclate." });
  x('jarres_marchandes', { bat:'poterie', nom:'Monter des jarres', metier:'tissage', duree:120, niv:5,
    in:{poterie:2,huile:1}, out:{ecu:210}, loot:[{res:'plan',p:0.03,n:[1,1]}],
    desc:"Des jarres à huile hautes comme un chat debout. Les colporteurs les paient sans discuter." });

  b('verrerie', {
    nom:'Verrerie', metier:'Verrier', cat:'atelier', rangees:[1],
    desc:"Le four rond à trois ouvreaux d'un blanc aveuglant, le banc du souffleur, sa canne, et le tas de sable qui ne ressemble à rien.",
    cout:{brique:30,charbonbois:10,pierretaille:6}, temps:200, postes:P(1,1,1,2,2,2,3,3,3,3),
    recettes:['souffler_verre','souffler_fiole','vitrail'],
  });
  x('souffler_verre', { bat:'verrerie', nom:'Fondre le verre', metier:'feu', duree:34,
    in:{sable:4,charbonbois:1}, out:{verre:2}, desc:"Sable, cendre et chaleur. Rien d'autre, et pourtant presque personne ne sait le faire." });
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
    cout:{planche:25,pierre:20,toile:2}, temps:150, postes:P(1,1,1,2,2,2,2,3,3,3),
    recettes:['moudre_ble','moudre_gland'],
  });
  x('moudre_ble', { bat:'moulin', nom:'Moudre le blé', metier:'cuisine', duree:16,
    in:{ble:3}, out:{farine:2}, desc:"La meule tourne, le grain devient poudre, le meunier devient blanc." });
  x('moudre_gland', { bat:'moulin', nom:'Moudre les glands', metier:'cuisine', duree:20, niv:3,
    in:{bois:2,legume:2}, out:{farine:2}, desc:"La farine du pauvre. Amère, mais elle passe l'hiver." });

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
    cout:{brique:20,pierre:15,bois:20}, temps:110, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['cuire_pain','tourte_poisson','galette_miel'],
  });
  x('cuire_pain', { bat:'cuisine', nom:'Cuire le pain', metier:'cuisine', duree:22,
    in:{farine:2,eau:1}, out:{pain:3},
    desc:"Le vrai carburant du bourg : un habitant qui a du pain travaille sans se plaindre." });
  x('tourte_poisson', { bat:'cuisine', nom:'Faire une tourte', metier:'cuisine', duree:70, niv:4,
    in:{farine:3,poissonfume:2,fromage:1}, out:{tourte:2},
    desc:"Pain, poisson, fromage : les trois d'un coup. Un repas de fête et un rendement de fête." });
  x('galette_miel', { bat:'cuisine', nom:'Galettes au miel', metier:'cuisine', duree:40, niv:3,
    in:{farine:2,miel:1}, out:{pain:6}, loot:[{res:'ecu',p:0.5,n:[4,14]}],
    desc:"On en vend la moitié sur la place avant qu'elles aient refroidi." });

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
    recettes:['tondre','abattre_mouton','paitre'],
  });
  x('tondre', { bat:'bergerie', nom:'Tondre le troupeau', metier:'elevage', duree:24,
    in:{ble:1}, out:{laine:3}, desc:"Au printemps, puis chaque fois que la toison le permet." });
  x('paitre', { bat:'bergerie', nom:'Mener au pâturage', metier:'elevage', duree:36, niv:2,
    out:{laine:2}, loot:[{res:'herbe',p:0.3,n:[1,2]},{res:'champignon',p:0.12,n:[1,1]}],
    desc:"Sans grain, plus lent — mais gratuit, et le berger revient les poches pleines." });
  x('abattre_mouton', { bat:'bergerie', nom:'Abattre une bête', metier:'elevage', duree:50, niv:3,
    in:{ble:2}, out:{viande:3,peau:2}, desc:"On ne le fait pas de gaieté de cœur, mais il faut bien du cuir." });

  b('etable', {
    nom:'Étable', metier:'Vacher', cat:'elevage', rangees:[0,1,2],
    desc:"Lait, cuir et bonne chaleur l'hiver. Les vaches tolèrent les chats sur leur dos, à condition qu'ils ne griffent pas en rêvant.",
    cout:{bois:44,poisson:20}, temps:100, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['traire','fumier','abattre_vache'],
  });
  x('traire', { bat:'etable', nom:'Traire', metier:'elevage', duree:18,
    in:{ble:1}, out:{lait:3}, desc:"Deux fois par jour. La moitié disparaît avant la laiterie ; nul ne sait comment." });
  x('fumier', { bat:'etable', nom:'Sortir le fumier', metier:'elevage', duree:26, niv:2,
    out:{legume:4}, desc:"Ingrat, mais c'est lui qui fait les récoltes du champ." });
  x('abattre_vache', { bat:'etable', nom:'Abattre une bête', metier:'elevage', duree:80, niv:4,
    in:{ble:4}, out:{viande:6,peau:4}, desc:"Une seule bête nourrit le bourg une semaine et habille sa compagnie." });

  b('laiterie', {
    nom:'Laiterie', metier:'Laitier', cat:'atelier', rangees:[1,2], nivMax:8,
    desc:"Blanchie à la chaux, fenêtres grillagées pour tenir le frais, les barattes debout et les claies à fromages. Le chat n'est jamais loin.",
    cout:{planche:20,pierre:15,poterie:3}, temps:110, postes:P(1,1,2,2,2,3,3,3),
    recettes:['baratter','affiner'],
  });
  x('baratter', { bat:'laiterie', nom:'Baratter', metier:'elevage', duree:30,
    in:{lait:4}, out:{fromage:1}, loot:[{res:'lait',p:0.2,n:[1,1]}],
    desc:"Le pilon monte et descend jusqu'à ce que le beurre prenne." });
  x('affiner', { bat:'laiterie', nom:'Affiner en cave', metier:'elevage', duree:90, niv:4,
    in:{fromage:2,herbe:1}, out:{fromage:5}, loot:[{res:'ecu',p:0.4,n:[6,20]}],
    desc:"Trois mois sur planche, retourné tous les deux jours. Le bourg entier sait quand la cave s'ouvre." });

  b('rucher', {
    nom:'Rucher', metier:'Apiculteur', cat:'elevage', rangees:[0,1], nivMax:6,
    desc:"Cinq ruches de paille sur leur banc de pierre, la haie fleurie derrière, l'enfumoir pendu au piquet. Se paye en piqûres, se vend en or.",
    cout:{bois:20,toile:1}, temps:70, postes:P(1,1,1,2,2,2),
    recettes:['recolter_miel','fondre_cire'],
  });
  x('recolter_miel', { bat:'rucher', nom:'Lever les hausses', metier:'elevage', duree:44,
    out:{miel:2}, loot:[{res:'cire',p:0.5,n:[1,2]}], desc:"Enfumoir, voile, et beaucoup de calme." });
  x('fondre_cire', { bat:'rucher', nom:'Fondre la cire', metier:'feu', duree:34, niv:2,
    in:{cire:2,eau:1}, out:{cire:3,huile:1}, desc:"Chandelles, sceaux et tablettes à écrire." });

  b('filature', {
    nom:'Filature', metier:'Tisserand', cat:'atelier', rangees:[1,2],
    desc:"Le métier à tisser tient tout le rez : ensouple, lisses et peigne. Dehors, les écheveaux teints sèchent sur la perche — la seule couleur franche du bourg.",
    cout:{planche:22,pierre:12,bois:15}, temps:130, postes:P(1,1,2,2,2,3,3,3,3,4),
    recettes:['filer','tisser_toile','filer_corde','teindre'],
  });
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

  b('tannerie', {
    nom:'Tannerie', metier:'Tanneur', cat:'atelier', rangees:[2], nivMax:8,
    desc:"Les cuves sont le bâtiment : trois fosses maçonnées de tan brun, la perche du tanneur, les peaux tendues sur cadres comme des voiles. On la met sous le vent.",
    cout:{pierre:25,bois:20,eau:10}, temps:120, postes:P(1,1,2,2,2,3,3,3),
    recettes:['tanner','parcheminer'],
  });
  x('tanner', { bat:'tannerie', nom:'Tanner au tan', metier:'tissage', duree:46,
    in:{peau:2,herbe:1,eau:2}, out:{cuir:2}, desc:"Trois semaines dans le tan. Souple, solide, et qui sent fort." });
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
    recettes:['potion_soin','encre_noire','elixir','distiller_essence',
              'garde_feu','garde_venin','garde_gel','garde_foudre','garde_ombre',
              'ouvrir_coeur'],
  });
  x('potion_soin', { bat:'alchimie', nom:'Distiller un remède', metier:'savoir', duree:60,
    in:{herbe:3,fiole:1,eau:1}, out:{potion:1},
    desc:"Ce qu'on emporte dans la descente et qu'on regrette de n'avoir pas pris en double." });
  x('encre_noire', { bat:'alchimie', nom:"Broyer l'encre", metier:'savoir', duree:44, niv:2,
    in:{charbonbois:1,herbe:2,huile:1}, out:{encre:2},
    desc:"Noir de fumée, gomme et fiel. Elle ne pardonne pas les repentirs." });
  x('elixir', { bat:'alchimie', nom:'Composer un élixir', metier:'savoir', duree:150, niv:5,
    in:{potion:2,essence:2,gemme:1}, out:{potion:6},
    desc:"L'essence des profondeurs, fixée dans le verre. Six fioles d'un coup, et bien meilleures." });
  /* ---------------------------------------------------------------
     LES GARDES DE PROFONDEUR. Chacune consomme une TROUVAILLE qu'aucun
     métier ne produit : c'est ce qui relie le pêcheur du mardi à
     l'étage soixante. Une fiole donne plusieurs charges ; une charge
     tient un étage.
     --------------------------------------------------------------- */
  x('garde_feu', { bat:'alchimie', nom:'Onguent contre le feu', metier:'savoir', duree:90, niv:2,
    in:{ecaille:2,resine:3,huile:1}, out:{gardefeu:4},
    loot:[{res:'cendre',p:0.30,n:[1,3]}],
    desc:"Écaille pilée, résine chaude, huile de lin. Ça pue, ça tient, et sans ça les Fournaises mangent la compagnie." });
  x('garde_venin', { bat:'alchimie', nom:'Décoction contre le venin', metier:'savoir', duree:95, niv:3,
    in:{racine:4,herbe:4,fiole:1}, out:{gardevenin:4},
    loot:[{res:'herbe',p:0.25,n:[1,2]}],
    desc:"On fait bouillir la racine amère trois fois, en jetant l'eau deux fois. La troisième se boit." });
  x('garde_gel', { bat:'alchimie', nom:'Doublure contre le gel', metier:'tissage', duree:100, niv:4,
    in:{plume:5,drap:1,huile:1}, out:{gardegel:4},
    desc:"Plume de Nuée cousue entre deux draps. Le Grand Froid ne se combat pas : il se retarde." });
  x('garde_foudre', { bat:'alchimie', nom:'Bracelet contre la foudre', metier:'forge', duree:120, niv:5,
    in:{ambre:2,lingotcuivre:1,cuir:1}, out:{gardefoudre:4},
    loot:[{res:'limaille',p:0.30,n:[1,2]}],
    desc:"L'ambre prend la décharge, le cuivre l'emporte au sol. On le porte au poignet, jamais au cou." });
  x('garde_ombre', { bat:'alchimie', nom:"Chandelle contre l'ombre", metier:'savoir', duree:150, niv:6,
    in:{perle:1,cire:4,essence:1}, out:{gardeombre:4},
    desc:"Elle ne fait aucune lumière. Elle empêche seulement l'ombre d'entrer, ce qui est bien plus utile." });
  x('ouvrir_coeur', { bat:'alchimie', nom:'Ouvrir un cœur de biome', metier:'savoir', duree:180, niv:6,
    in:{coeurbiome:1,fiole:2}, out:{essence:14,gemme:2},
    loot:[{res:'obsidienne',p:0.22,n:[1,1]},{res:'relique',p:0.05,n:[1,1]}],
    desc:"Ce qui bat au fond d'un gardien ne bat plus quand on l'ouvre — mais tout en sort d'un coup." });

  x('distiller_essence', { bat:'alchimie', nom:"Raffiner l'essence", metier:'savoir', duree:200, niv:7,
    in:{essence:4,charbonbois:2,fiole:2}, out:{essence:9},
    desc:"On ne la crée pas — on la concentre. C'est ce qui rend la descente rentable." });

  b('scriptorium', {
    nom:'Scriptorium', metier:'Copiste', cat:'atelier', rangees:[0,1],
    desc:"Haut, étroit, tout en baies : on n'y fait rien d'autre que copier, et il faut du jour. Un grimoire à la fois, jamais deux.",
    cout:{pierretaille:16,parchemin:4,verre:4}, temps:260, postes:P(1,1,1,2,2,2,2,3,3,3),
    recettes:['copier_sort','tracer_plan','ecrire_chant'],
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

  b('orfevre', {
    nom:'Orfèvre', metier:'Orfèvre', cat:'atelier', rangees:[1,2], nivMax:8,
    desc:"Petit, riche, fermé : vitrine grillagée, balance de précision, four à coupelle et coffret ferré. Le seul bâtiment du bourg qui ait une serrure.",
    cout:{pierretaille:14,lingotargent:2,verre:4}, temps:280, postes:P(1,1,1,2,2,2,2,3),
    recettes:['monnayer','joaillerie','sertir'],
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
    recettes:['servir','vendre_surplus','recruter_bras'],
  });
  x('servir', { bat:'taverne', nom:'Tenir la salle', metier:'cuisine', duree:26,
    in:{pain:2,poisson:2}, out:{ecu:70}, desc:"On sert, on encaisse, on écoute. Les trois vont ensemble." });
  x('vendre_surplus', { bat:'taverne', nom:'Vendre au colporteur', metier:'cuisine', duree:40, niv:2,
    in:{poterie:1,drap:1}, out:{ecu:260}, loot:[{res:'plan',p:0.05,n:[1,1]}],
    desc:"Il passe une fois la semaine et repart avec tout ce qui traîne." });
  x('recruter_bras', { bat:'taverne', nom:'Payer une tournée', metier:'cuisine', duree:120, niv:4,
    in:{ecu:900,tourte:2}, out:{}, recrue:1,
    desc:"À la troisième chope, on trouve toujours quelqu'un pour s'installer au bourg. C'est plus rapide que la nurserie, et plus cher." });

  b('halle', {
    nom:'Halle', metier:'—', cat:'commerce', rangees:[1,2], nivMax:6,
    desc:"Charpente sur poteaux, étals dessous, et la mesure à grain scellée au pilier. Elle fait baisser le prix de tout ce que le bourg achète.",
    cout:{planche:30,pierre:14}, temps:140, postes:P(0),
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
    recettes:['elever_chaton','ecole'],
  });
  x('elever_chaton', { bat:'nurserie', nom:'Élever une portée', metier:'elevage', duree:240,
    in:{lait:8,poisson:10,laine:2}, out:{}, recrue:1,
    desc:"La seule manière durable d'avoir plus de pattes. Longue, coûteuse, et absolument indispensable." });
  x('ecole', { bat:'nurserie', nom:'Faire la classe', metier:'savoir', duree:150, niv:4,
    in:{parchemin:1,pain:4}, out:{}, xpBourg:60,
    desc:"On y apprend les métiers avant de les exercer : tout le bourg y gagne de l'expérience." });

  b('entrainement', {
    nom:"Terrain d'entraînement", metier:"Maître d'armes", cat:'guerre', rangees:[0,1],
    desc:"Sable damé, mannequins de paille, quintaine qui pivote quand on la frappe mal. C'est ici que se forment les unités qu'on emmène en expédition.",
    cout:{planche:20,pierre:10,arme:1}, temps:170, postes:P(1,1,1,2,2,2,2,3,3,3),
    recettes:['former_unite','exercer','forger_esprit'],
  });
  x('former_unite', { bat:'entrainement', nom:'Former une recrue', metier:'guerre', duree:120,
    in:{arme:1,pain:4}, out:{}, unite:1,
    desc:"Une recrue de plus pour la compagnie. Sans arme, pas de recrue — la forge commande l'armée." });
  x('exercer', { bat:'entrainement', nom:'Exercice au mannequin', metier:'guerre', duree:70, niv:2,
    in:{pain:2}, out:{}, xpArmee:40,
    desc:"Rien ne se produit, tout se gagne : l'expérience de la compagnie monte." });
  x('forger_esprit', { bat:'entrainement', nom:'Répéter les chants', metier:'guerre', duree:110, niv:5,
    in:{chant:1,tourte:1}, out:{}, xpArmee:150,
    desc:"On chante avant de partir. Ça ne sert à rien, sauf que ça sert énormément." });

  b('caserne', {
    nom:'Caserne', metier:"Sergent d'armes", cat:'guerre', rangees:[0,1],
    desc:"La garde du bourg y loge, vingt-quatre pattes prêtes à la ronde. Braséro allumé toute la nuit : moins pour se chauffer que parce qu'on y dort très bien.",
    cout:{pierretaille:14,planche:20,lingotfer:4}, temps:230, postes:P(0),
    effet:{armee:4,defense:8},
  });

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
    cout:{pierretaille:22,verre:4,cire:6}, temps:280, postes:P(1,1,1,1,2,2),
    effet:{moral:8,attrait:0.5},
    recettes:['office'],
  });
  x('office', { bat:'eglise', nom:"Dire l'office", metier:'savoir', duree:90,
    in:{cire:2}, out:{}, moral:14,
    desc:"Le bourg entier s'arrête un quart d'heure et repart de meilleure humeur. Mesurable, hélas." });

  b('chateau', {
    nom:'Donjon', metier:'—', cat:'vie', rangees:[0,1], nivMax:6,
    desc:"Le donjon du bourg, sa salle haute et son coffre. Il n'abrite personne d'utile — mais c'est lui qui garde les savoirs et le trésor.",
    cout:{pierretaille:60,poutre:4,lingotfer:10}, temps:600, postes:P(0),
    stock:{savoir:9999,profond:9999,monnaie:9999999},
    effet:{prestige:20,attrait:0.9},
  });

  b('arbrechat', {
    nom:'Arbre à chat', metier:'—', cat:'vie', rangees:[1,2], nivMax:5,
    desc:"Plateformes, passerelles, hamacs et un poteau à griffer haut de trois mètres. Rigoureusement inutile, et le bourg travaille mieux quand il y en a.",
    cout:{bois:25,corde:4,drap:1}, temps:70, postes:P(0),
    effet:{moral:6,attrait:0.2},
  });

  b('portail', {
    nom:"Portail d'expédition", metier:'—', cat:'porte', rangees:[0], nivMax:5,
    desc:"Trois pierres levées que le bourg n'a pas taillées, et entre elles un voile de lumière qui ne tient à rien. C'est par là que part la colonne — et par là que revient le territoire.",
    cout:{pierretaille:24,essence:6,gemme:1}, temps:400, postes:P(0),
    porte:'expedition',
  });

  b('descente', {
    nom:'Le Puits sans fond', metier:'—', cat:'porte', rangees:[0,1], nivMax:5,
    desc:"Une margelle cyclopéenne et un escalier qui plonge dans un noir que rien n'éclaire. On n'a jamais trouvé le fond ; on a seulement trouvé jusqu'où l'on pouvait descendre.",
    cout:{pierretaille:20,poutre:2,corde:8}, temps:350, postes:P(0),
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
    champ:         { bat:{scierie:1} },
    maison:        { bat:{scierie:1} },
    puits:         { bat:{champ:1} },
    grange:        { res:{ble:20} },
    carriere:      { bat:{scierie:2} },
    moulin:        { res:{ble:40} },
    cuisine:       { res:{farine:10} },
    bergerie:      { bat:{champ:1} },
    etable:        { bat:{bergerie:1} },
    entrepot:      { res:{planche:15} },
    tuilerie:      { res:{argile:20} },
    poterie:       { res:{argile:14} },
    mine:          { bat:{carriere:2} },
    charbonniere:  { bat:{scierie:3} },
    fonderie:      { res:{fer:15} },
    forge:         { res:{lingotfer:2} },
    fumoir:        { bat:{cuisine:1} },
    laiterie:      { res:{lait:15} },
    filature:      { res:{laine:12} },
    tannerie:      { res:{peau:6} },
    herboristerie: { bat:{champ:2} },
    nurserie:      { res:{lait:20} },
    moulinEau:     { bat:{moulin:2} },
    verrerie:      { bat:{tuilerie:3} },
    armurerie:     { bat:{forge:3} },
    alchimie:      { res:{fiole:3} },
    rucher:        { bat:{herboristerie:1} },
    taverne:       { res:{pain:20} },
    halle:         { bat:{taverne:2} },
    entrainement:  { res:{arme:1} },
    caserne:       { bat:{entrainement:2} },
    tour:          { bat:{carriere:3} },
    rempart:       { bat:{caserne:1} },
    scriptorium:   { res:{parchemin:3} },
    orfevre:       { res:{lingotargent:1} },
    eglise:        { bat:{tuilerie:2} },
    chateau:       { bat:{rempart:1} },
    arbrechat:     { bat:{maison:2} },
    /* LE PUITS ne se bâtit pas : il s'ouvre. Le bourg le découvre le
       jour où il sait forger de quoi descendre — et il apparaît alors
       tout seul dans le village. */
    descente:      { bat:{forge:1} },
    portail:       { bat:{entrainement:1} },
  };
  for (const id in DEBLOCAGE) if (BAT[id]) BAT[id].deblocage = DEBLOCAGE[id];

  /* Coût d'un niveau : la base au niveau 1, puis une progression franche.
     Le temps de chantier suit une courbe plus douce — c'est la MATIÈRE
     qui doit freiner, pas l'attente. */
  function coutNiveau(bid, niv) {
    const base = BAT[bid].cout || {};
    const k = Math.pow(1.85, Math.max(0, niv - 1));
    const out = {};
    for (const r in base) out[r] = Math.max(1, Math.round(base[r] * k));
    return out;
  }
  function tempsNiveau(bid, niv) {
    return Math.round((BAT[bid].temps || 30) * Math.pow(1.42, Math.max(0, niv - 1)));
  }
  function postesDe(bid, niv) {
    const p = BAT[bid].postes || [0];
    return p[Math.min(p.length - 1, Math.max(0, niv - 1))] || 0;
  }
  function logementDe(bid, niv) {
    const l = BAT[bid].logement; if (!l) return 0;
    return l[Math.min(l.length - 1, Math.max(0, niv - 1))] || 0;
  }
  function stockDe(bid, niv) {
    const s = BAT[bid].stock; if (!s) return null;
    const out = {}; for (const c in s) out[c] = Math.round(s[c] * (1 + 0.55 * (niv - 1)));
    return out;
  }
  function recettesDe(bid, niv) {
    return (BAT[bid].recettes || []).filter(rid => REC[rid] && REC[rid].niv <= niv);
  }

  window.BAT = BAT;
  window.REC = REC;
  window.BAT_ORDRE = ORDRE;
  window.METIERS = METIERS;
  window.BatUtil = { coutNiveau, tempsNiveau, postesDe, logementDe, stockDe, recettesDe };

})();
