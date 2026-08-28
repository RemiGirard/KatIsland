# Plan de refonte des bâtiments

## Périmètre et règle de travail

- La **scierie** reste le bâtiment de référence : son fonctionnement actuel ne doit pas régresser.
- Le **port** et la **Tour sombre** restent hors de cette refonte.
- La **tour de guet** est bien incluse : elle appartient au système défensif du village.
- Chaque bâtiment reçoit le socle commun de la scierie uniquement lorsqu'il a réellement des ouvriers : affectation individuelle, équipes libres, horaires, fatigue, repos, cadence, confort et automatisation lisible.
- Chaque bâtiment ne reçoit qu'une mécanique signature principale. Elle doit créer un choix intéressant sans exiger des manipulations répétitives.
- Les bâtiments sans ouvriers (maisons, stocks et certaines infrastructures) ont une gestion passive adaptée au lieu de faux postes de travail.
- Aucun visuel n'est généré avant l'inventaire des illustrations existantes. Toute nouvelle planche contient exactement 16 éléments isolés dans une grille 4 × 4, avec de larges marges et un fond réellement transparent, puis elle est découpée proprement.

## Audit obligatoire avant chaque bâtiment

1. Relever ses recettes, ses niveaux, ses coûts, ses postes, ses annexes et ses déblocages actuels.
2. Vérifier ce que le joueur décide réellement et ce qui n'est qu'un multiplicateur abstrait.
3. Comparer son ergonomie à celle de la scierie : chaîne visible, affectation, outils, progression, personnel, confort et automatisation.
4. Identifier un seul manque ou conflit économique majeur.
5. Définir la mécanique signature, ses jauges et ses conséquences dans les autres bâtiments.
6. Définir les paliers de niveau : chaque palier doit ouvrir une recette, un onglet, un espace, une règle ou une automatisation.
7. Prévoir le comportement hors ligne et les garde-fous contre la microgestion.
8. Auditer les illustrations et ne générer que ce qui manque.
9. Prévoir la migration des sauvegardes anciennes et des valeurs par défaut sûres.
10. Faire les vérifications statiques de syntaxe et noter le bâtiment comme traité.

## Ordre de passage, bâtiment par bâtiment

### Fondation alimentaire et agricole

- [x] **Pêcherie** — banc de poissons renouvelable, pression de pêche et choix filet/nasse/vivier ; une pêche trop agressive rapporte vite puis raréfie temporairement le poisson.
- [x] **Champ** — fertilité, semences, rotation et jachère ; les cultures nourrissent ou épuisent différemment le sol.
- [x] **Champ de tournesols** — ensoleillement et pollinisation ; synergie directe avec les ruchers voisins.
- [x] **Pépinière** — plateaux de jeunes plants, greffes et sélection d'une lignée productive ou résistante.
- [x] **Potager** — associations de cultures et arrosage ; petites récoltes régulières plutôt qu'une grosse moisson.
- [x] **Champ de fleurs** — floraison par couleurs et réserve de nectar ; alimente moral, rucher et alchimie.
- [x] **Puits** — niveau de nappe, débit et répartition de l'eau ; priorité automatique entre habitants et ateliers.

### Animaux et transformation alimentaire

- [ ] **Bergerie** — taille du troupeau, pâturage, mise bas et qualité de laine ; préserver des reproducteurs ralentit la production immédiate mais développe le cheptel.
- [ ] **Étable** — alimentation, santé et cycle lait/reproduction ; ration riche contre autonomie du troupeau.
- [ ] **Rucher** — reine, humeur des ruches, réserve de miel et réseau de pollinisation des parcelles.
- [ ] **Moulin à vent** — fenêtres de vent et files de mouture ; stockage automatique des commandes pour profiter des rafales.
- [ ] **Moulin à eau** — débit de roue et vannes ; arbitrage entre eau disponible et cadence stable.
- [ ] **Four banal / cuisine** — marmite visuelle : déposer quelques ingrédients, régler la chaleur, découvrir puis mémoriser les recettes.
- [ ] **Fumoir** — essence de bois, intensité et durée de fumage ; rendement, conservation et qualité sont en tension.
- [ ] **Laiterie** — ferments et cave d'affinage ; produits rapides ou lots longs plus rentables.

### Pierre, terre et feu

- [ ] **Carrière** — fronts de taille, stabilité et choix d'extraction pierre/sable/argile.
- [ ] **Mine** — profondeur, soutènement et ventilation ; les filons riches demandent davantage de sécurité.
- [ ] **Charbonnière** — meule, température et arrivée d'air ; récupérer tôt ou attendre une cuisson complète.
- [ ] **Tuilerie** — mélange argile/eau puis fournées ; charger le four pour optimiser combustible ou vitesse.
- [ ] **Poterie** — forme, glaçure et cuisson ; séries fiables ou pièces à plus forte valeur.
- [ ] **Verrerie** — chaleur du four et additifs ; verre commun en continu ou lots spéciaux.

### Métal et équipement

- [ ] **Fonderie** — composition des alliages et température ; réutiliser les chutes crée une boucle avec forge et armurerie.
- [ ] **Forge** — foyer et commandes ; conserver les onglets d'équipement, amélioration et trempe tout en intégrant personnel/fatigue.
- [ ] **Armurerie** — standards d'assemblage et commandes d'escouade ; privilégier quantité, protection ou mobilité.
- [ ] **Orfèvre** — alliage, sertissage et patience ; commandes précises avec risque maîtrisable de perte de gemme.

### Textile, nature et savoir

- [ ] **Filature** — mélange de fibres et tension du fil ; vitesse contre qualité.
- [ ] **Tisserand** — motifs de métier et commandes ; les patrons mémorisés automatisent les étoffes complexes.
- [ ] **Tannerie** — bains successifs et durée ; odeurs et rejets influencent le moral si le confort est négligé.
- [ ] **Herboristerie** — claies de séchage, saison et classification ; prépare des ingrédients stables pour cuisine et alchimie.
- [ ] **Alchimie** — placer les ingrédients dans plusieurs alambics, observer leurs propriétés, découvrir et consigner les formules ; l'automatisation ne vient qu'après la découverte.
- [ ] **Scriptorium** — écoles de manuscrits, copie, correction et enluminure ; vitesse contre erreurs et prestige.

### Habitat, réserves et vie du bourg

- [ ] **Maison** — foyer individuel, entretien et confort ; agrandir un vrai quartier plutôt qu'acheter un bonus abstrait.
- [ ] **Grange** — silos, ventilation et rotation des vivres ; limiter les pertes et réserver des semences.
- [ ] **Entrepôt** — zones de stockage et priorités ; visualiser les flux bloqués entre ateliers.
- [ ] **Halle** — étals et priorités de marché ; écouler les surplus sans vider une ressource stratégique.
- [ ] **Taverne** — carte du jour, chambres et petits événements ; nourrit loisirs, rumeurs et recrutement.
- [ ] **Nurserie** — rythme de garde, repas et jeux ; soutient les familles sans affectations répétitives.
- [ ] **Maison des balais** — tournées de nettoyage et secteurs ; la saleté visible pèse sur santé et moral.
- [ ] **Bains du bourg** — créneaux, eau et chauffe ; récupération de fatigue à l'échelle du village.
- [ ] **Maison des jeux** — programmation des loisirs et capacité ; variété contre coût d'entretien.
- [ ] **Chapelle** — offices, aide et recueillement ; amortit les chutes de moral sans les annuler.
- [ ] **Donjon** — administration, sécurité et politiques du bourg ; bonus accompagnés de contreparties visibles.
- [ ] **Arbre à chat** — loisir simple à forte fréquentation ; congestion amusante et récupération courte.

### Défense et formation

- [ ] **Terrain d'entraînement** — programmes par caractéristique, groupes et intensité ; la fatigue gagnée est le coût réel de l'entraînement.
- [ ] **Caserne** — escouades, disponibilité et doctrine ; relie habitants équipés, expéditions et défense locale.
- [ ] **Rempart** — état des sections, entretien et réparations planifiées ; infrastructure passive sans faux ouvrier permanent.
- [ ] **Tour de guet** — secteurs et relèves de sentinelles ; couverture horaire, portée et détection précoce.

## Socle technique commun à construire

- Une définition déclarative par bâtiment : onglets, paliers, mécanique signature, confort et automatismes.
- Un état sauvegardé par exemplaire de bâtiment, initialisé sans casser les anciennes parties.
- Un moteur commun pour disponibilité, fatigue, horaires et récupération ; la scierie reste compatible.
- Des composants d'interface communs : chaîne, jauge de maîtrise, cartes de production, planification des équipes, confort, feuille de route et panneau de mécanique signature.
- Des adaptateurs spécialisés uniquement pour les interactions réellement différentes (champ, animaux, marmite, alambics, mine, défense).

## Définition de “terminé” pour un bâtiment

Un bâtiment est terminé lorsqu'il possède une boucle compréhensible en quelques secondes, au moins un choix économique réel, une progression de niveau lisible, une gestion du personnel adaptée, des automatismes qui retirent la microgestion, des illustrations cohérentes, une sauvegarde rétrocompatible et aucune erreur de syntaxe statique.

## Journal des audits réalisés

### Pêcherie

- **Avant** : cinq recettes utiles, mais une production illimitée sans état local ; le vivier n'était qu'une conversion rentable.
- **Écart avec la scierie** : pas de vue en chaîne, pas d'affectation visuelle, pas d'équipes, pas de fatigue ni de confort propre.
- **Décision** : banc sauvage local de 0 à 100, renouvellement naturel, pression différente selon la technique, vivier qui repeuple réellement et trois politiques de prélèvement.
- **Anti-microgestion** : le banc se renouvelle hors ligne, les pauses sont automatiques et les équipes restent facultatives grâce aux ouvriers volants.
- **Visuels** : une planche transparente de 16 éléments, 16 découpes contrôlées et activées dans l'interface.

### Champ

- **Avant** : la jachère consommait des légumes pour produire directement 24 blés ; elle contredisait son propre rôle et dominait la boucle.
- **Écart avec la scierie** : aucun état de parcelle, aucune raison d'alterner les recettes, aucune réserve locale ni gestion du personnel.
- **Décision** : fertilité et semences propres à chaque champ ; blé, racines et lin ont des pressions différentes ; la jachère restaure au lieu de devenir la meilleure récolte.
- **Anti-microgestion** : récupération lente à l'arrêt, stratégie persistante et réserve locale plutôt qu'une nouvelle ressource dans le stock général.
- **Visuels** : la première génération avec faux damier a été rejetée ; la seconde planche possède un véritable alpha, 16 cases valides et 16 découpes activées.

### Champ de tournesols

- **Avant** : deux conversions de tournesol sans lien avec les abeilles, les fleurs ou l’état de la parcelle.
- **Écart avec la scierie** : aucune boucle locale ni synergie avec un autre bâtiment.
- **Décision** : pollinisation locale attirée vers une cible calculée à partir des ruchers et champs de fleurs réellement construits ; floraison longue, cycle naturel ou récolte de graines intensive.
- **Anti-microgestion** : la jauge rejoint naturellement sa cible et la conduite choisie persiste.
- **Visuels** : la première génération au faux damier a été rejetée ; la seconde planche transparente fournit 16 découpes actives.

### Pépinière

- **Avant** : chaîne fruit, greffon, verger et cidre cohérente, mais aucune progression durable de la sélection végétale.
- **Écart avec la scierie** : pas de plateaux locaux, de taux de reprise ou d’identité entre plusieurs pépinières.
- **Décision** : réserve de jeunes plants, taux de reprise et lignée locale progressant avec les greffes ; orientations diversifiée, robuste ou productive.
- **Anti-microgestion** : les jeunes plants repoussent seuls, tandis que la pratique améliore graduellement la reprise.
- **Visuels** : planche transparente de 16 éléments ; la découpe automatique ayant signalé une proximité, la version finale utilise volontairement la grille stricte 4 × 4.

### Potager

- **Avant** : quatre recettes complémentaires, mais aucune raison de les alterner ni aucune identité de petite récolte régulière.
- **Écart avec la scierie** : pas d’état local, de lecture immédiate du terrain, d’équipes ou de choix durable entre légumes et simples.
- **Décision** : humidité et associations de cultures propres à chaque potager ; les puits construits augmentent naturellement la cible d’humidité, tandis que les conduites compagnes, primeurs et simples spécialisent les sorties.
- **Anti-microgestion** : aucune eau n’est prélevée en secret ; l’humidité rejoint seule sa cible et la conduite choisie reste active jusqu’au prochain choix du joueur.
- **Visuels** : planche 4 × 4 à véritable transparence, découpée volontairement sur la grille stricte en 16 illustrations activées.

### Champ de fleurs

- **Avant** : deux récoltes et un bonus moral passif, malgré une description qui promettait des liens avec les abeilles et l’alchimie.
- **Écart avec la scierie** : aucune lecture de floraison, aucun réseau agricole visible et aucun arbitrage entre couper ou laisser butiner.
- **Décision** : floraison locale renouvelable et réserve de nectar attirée par les ruchers et tournesols construits ; orientations bouquets, butinage ou carré grainier.
- **Anti-microgestion** : floraison et nectar se reconstituent seuls ; le choix de conduite persiste et les futures ruches pourront lire la réserve déjà exposée par le moteur.
- **Visuels** : 16 illustrations en grille stricte, transparentes, découpées et utilisées pour les recettes, le réseau et les conduites.

### Puits

- **Avant** : une unique recette de cinq secondes produisait de l’eau sans limite, sans état local ni conséquence pour le village.
- **Écart avec la scierie** : aucune progression lisible, aucun arbitrage, aucune équipe ou organisation malgré un travail très répétitif.
- **Décision** : nappe phréatique locale qui se vide et se recharge ; distribution équilibrée, habitants d’abord, irrigation prioritaire ou grand débit. Les choix modifient réellement récupération, humidité des potagers ou rendement d’eau.
- **Anti-microgestion** : la nappe se recharge seule et la distribution choisie reste automatique ; ralentir, relever les équipes ou construire un autre puits devient une décision structurelle.
- **Visuels** : planche transparente de 16 icônes, découpée sur grille stricte et activée dans les jauges, recettes, priorités et onglets.
