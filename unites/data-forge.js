/* ============================================================
   GRIFFES & PLUMES — data-forge.js (3/6)
   Les 10 lignes de forge (40 tiers chacune) : armes, lames, armures,
   boucliers, tir, bâtons, munitions, robes, gilets, cuirasses.
   ============================================================ */
"use strict";

  // ---------- LES 30 LANCES ----------
  // style: len, shaftC, shaftW, blade, bladeC1 (clair), bladeC2 (foncé),
  //        guard, gem, glow, wings, fx
  const W = (name, desc, style) => ({ name, desc, style });
  // Les deux premiers rangs appartiennent encore à l'apprentissage : le joueur
  // vient de poser la Forge et doit voir son premier ordre aboutir. Ensuite la
  // cadence s'étire franchement et rejoint la courbe idle historique au T6.
  // Une seule fonction garde les dix lignes d'équipement synchronisées.
  const FORGE_CRAFT_RAMP = [30, 60, 120, 240, 480, 900];
  const forgeCraftTime = i => i < FORGE_CRAFT_RAMP.length
    ? FORGE_CRAFT_RAMP[i]
    : Math.round(600 * Math.pow(1.185, i));
  GameData.WEAPONS = [
    W('Bâton pointu', 'Un bout de bois. Pointu. La technologie n’attend pas.',
      { len: 1.0, shaftC: '#8a6a42', shaftW: 1.8, blade: 'tri', bladeC1: '#f2f4f6', bladeC2: '#c9cdd2', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Cure-dent géant', 'Volé dans un restaurant à tapas. Étonnamment efficace.',
      { len: 1.05, shaftC: '#c8a86a', shaftW: 1.6, blade: 'tri', bladeC1: '#fdf4df', bladeC2: '#d8c49a', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Lance d’entraînement', 'Le bout en mousse a été retiré. Officiellement perdu.',
      { len: 1.05, shaftC: '#9a7648', shaftW: 2.0, blade: 'leaf', bladeC1: '#e8d8b8', bladeC2: '#b09468', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Lance de silex', 'Technologie de pointe (de l’âge de pierre).',
      { len: 1.05, shaftC: '#8a6a42', shaftW: 2.0, blade: 'barb', bladeC1: '#9aa0a6', bladeC2: '#6f757c', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Fourchette de cantine', 'Piquée à la cantine. Trois fois plus de pointes !',
      { len: 1.05, shaftC: '#a8a8ae', shaftW: 1.8, blade: 'trident', bladeC1: '#d8dde3', bladeC2: '#9aa2ab', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Lance de cuivre', 'Brille au soleil. Verdit sous la pluie. On l’aime quand même.',
      { len: 1.1, shaftC: '#7a5a38', shaftW: 2.0, blade: 'leaf', bladeC1: '#e0a468', bladeC2: '#8f5522', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Lance de fer', 'Du vrai métal sérieux pour des soldats sérieux.',
      { len: 1.1, shaftC: '#6a5a48', shaftW: 2.1, blade: 'tri', bladeC1: '#aab2bb', bladeC2: '#6d757e', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Épieu denté', 'Les dents, c’est pour faire peur. Ça marche.',
      { len: 1.1, shaftC: '#5c4a38', shaftW: 2.2, blade: 'barb', bladeC1: '#98a2ae', bladeC2: '#5c646e', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Lance d’acier poli', 'On peut se voir dedans. Certains soldats en abusent.',
      { len: 1.15, shaftC: '#5a4a3a', shaftW: 2.1, blade: 'leaf', bladeC1: '#dfe6ee', bladeC2: '#98a2ae', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Hallebarde du sergent', 'Lance ET hache. Le progrès, c’est merveilleux.',
      { len: 1.15, shaftC: '#4e4034', shaftW: 2.3, blade: 'halberd', bladeC1: '#ccd4dd', bladeC2: '#88929e', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Trident de gouttière', 'Repêché dans une gouttière. Sent un peu la mousse.',
      { len: 1.15, shaftC: '#4a5648', shaftW: 2.2, blade: 'trident', bladeC1: '#b8c8bc', bladeC2: '#6e8272', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    W('Lance d’argent', 'Élégante, précieuse, et terriblement pointue.',
      { len: 1.2, shaftC: '#7a8494', shaftW: 2.1, blade: 'leaf', bladeC1: '#eef4fb', bladeC2: '#aab6c6', guard: true, gem: null, glow: '#bcd6ff', wings: false, fx: 'none' }),
    W('Lance dorée', 'Tellement brillante que l’ennemi plisse les yeux.',
      { len: 1.2, shaftC: '#8a6a2e', shaftW: 2.2, blade: 'leaf', bladeC1: '#f6cf5d', bladeC2: '#c3922e', guard: true, gem: null, glow: '#ffe9a8', wings: false, fx: 'none' }),
    W('Piquet royal', 'Décoré d’un rubis. Probablement un vrai.',
      { len: 1.2, shaftC: '#6e3a3a', shaftW: 2.3, blade: 'tri', bladeC1: '#f6d76d', bladeC2: '#b8862e', guard: true, gem: '#d33a3a', glow: '#ffdf9a', wings: false, fx: 'none' }),
    W('Lance du duelliste', 'Fine, rapide, avec un petit air prétentieux.',
      { len: 1.3, shaftC: '#4a4a54', shaftW: 1.8, blade: 'tri', bladeC1: '#e8eef6', bladeC2: '#9aa6b4', guard: true, gem: '#3a86ff', glow: '#a8c8ff', wings: false, fx: 'none' }),
    W('Hallebarde ouvragée', 'Gravée de petites moustaches et de petites plumes.',
      { len: 1.25, shaftC: '#5e4222', shaftW: 2.4, blade: 'halberd', bladeC1: '#f2d98a', bladeC2: '#9a8248', guard: true, gem: '#7bd389', glow: '#ffe9a8', wings: false, fx: 'none' }),
    W('Lance du croisé', 'Bénie par le Grand Ronron (ou le Grand Cui-Cui).',
      { len: 1.25, shaftC: '#8a8276', shaftW: 2.3, blade: 'leaf', bladeC1: '#fffef8', bladeC2: '#cbb87e', guard: true, gem: '#f4c542', glow: '#fff2c8', wings: false, fx: 'none' }),
    W('Trident des tempêtes', 'Crépite doucement. Ne pas utiliser sous la douche.',
      { len: 1.3, shaftC: '#3a4a5e', shaftW: 2.3, blade: 'trident', bladeC1: '#7fd0ff', bladeC2: '#2f6fae', guard: true, gem: null, glow: '#9fdcff', wings: false, fx: 'spark' }),
    W('Lance de braise', 'Chauffe les pattes en hiver. Brûle tout le reste.',
      { len: 1.3, shaftC: '#4a2c1e', shaftW: 2.4, blade: 'leaf', bladeC1: '#ffb35c', bladeC2: '#d84a1e', guard: true, gem: null, glow: '#ff9a4d', wings: false, fx: 'flame' }),
    W('Lance de givre', 'Congèle les moustaches à dix pas.',
      { len: 1.3, shaftC: '#5a7a8e', shaftW: 2.3, blade: 'barb', bladeC1: '#e8f8ff', bladeC2: '#7ab8d8', guard: true, gem: null, glow: '#bfeaff', wings: false, fx: 'ice' }),
    W('Lance solaire', 'Contient un tout petit morceau de soleil. Chut.',
      { len: 1.35, shaftC: '#9a7a2e', shaftW: 2.4, blade: 'leaf', bladeC1: '#fff6d0', bladeC2: '#f0a828', guard: true, gem: '#ff8c28', glow: '#ffd76a', wings: false, fx: 'spark' }),
    W('Faux d’ombre', 'Découpe la lumière elle-même. Très dramatique.',
      { len: 1.35, shaftC: '#2e2440', shaftW: 2.4, blade: 'crescent', bladeC1: '#8a76b4', bladeC2: '#3e3258', guard: true, gem: '#b48cff', glow: '#8f6fff', wings: false, fx: 'none' }),
    W('Lance céleste', 'Des petites ailes. Elle vole presque toute seule.',
      { len: 1.35, shaftC: '#8ca8c4', shaftW: 2.3, blade: 'leaf', bladeC1: '#ffffff', bladeC2: '#9cc4e8', guard: true, gem: '#cfe8ff', glow: '#cfe8ff', wings: true, fx: 'none' }),
    W('Trident abyssal', 'Remonté des profondeurs de la gamelle d’eau.',
      { len: 1.35, shaftC: '#1e3a3e', shaftW: 2.5, blade: 'trident', bladeC1: '#4fe0c4', bladeC2: '#17706a', guard: true, gem: '#20e3b2', glow: '#3fe8c8', wings: false, fx: 'ice' }),
    W('Lance draconique', 'Forgée dans une haleine de dragon (haleine de thon ?).',
      { len: 1.4, shaftC: '#3a1e1e', shaftW: 2.6, blade: 'double', bladeC1: '#ff6a4a', bladeC2: '#7a1e12', guard: true, gem: '#ff4040', glow: '#ff6a4a', wings: false, fx: 'flame' }),
    W('Lance de météore', 'Encore tiède. Livrée directement par l’espace.',
      { len: 1.4, shaftC: '#4a3428', shaftW: 2.6, blade: 'star', bladeC1: '#ffc86a', bladeC2: '#b8501e', guard: true, gem: '#ffdf6a', glow: '#ffab4d', wings: false, fx: 'flame' }),
    W('Lance galactique', 'Contient une petite galaxie. Les ennemis sont hypnotisés.',
      { len: 1.4, shaftC: '#2a2444', shaftW: 2.5, blade: 'star', bladeC1: '#b48cff', bladeC2: '#4a3a8e', guard: true, gem: '#7fd0ff', glow: '#b48cff', wings: false, fx: 'stars' }),
    W('Lance arc-en-ciel', 'Toutes les couleurs. En même temps. Pourquoi choisir ?',
      { len: 1.4, shaftC: '#f8f4ec', shaftW: 2.4, blade: 'leaf', bladeC1: '#ffffff', bladeC2: '#c8c8d8', guard: true, gem: '#ff6ad5', glow: '#ffffff', wings: false, fx: 'rainbow' }),
    W('Lance de l’éclipse', 'Le jour et la nuit ont signé un armistice sur cette lame.',
      { len: 1.45, shaftC: '#1e1a28', shaftW: 2.6, blade: 'crescent', bladeC1: '#ffd700', bladeC2: '#2a2438', guard: true, gem: '#ffd700', glow: '#ffd700', wings: true, fx: 'stars' }),
    W('LA LANCE ULTIME', 'Il n’y a rien au-delà. Enfin, on croyait. On avait tort.',
      { len: 1.5, shaftC: '#f4e8c8', shaftW: 2.8, blade: 'star', bladeC1: '#fffdf0', bladeC2: '#f0c030', guard: true, gem: '#ff6ad5', glow: '#ffffff', wings: true, fx: 'rainbow' }),
    W('Lance du Vide', 'Elle n’existe qu’à moitié. L’autre moitié frappe quand même.',
      { len: 1.45, shaftC: '#141020', shaftW: 2.6, blade: 'crescent', bladeC1: '#6a5aa8', bladeC2: '#241c48', guard: true, gem: '#3a2a6e', glow: '#5a3aae', wings: false, fx: 'stars' }),
    W('Pique de la Banquise Éternelle', 'Sculptée dans un hiver qui a refusé de finir.',
      { len: 1.45, shaftC: '#3a5a72', shaftW: 2.5, blade: 'star', bladeC1: '#eafcff', bladeC2: '#5aa8d8', guard: true, gem: '#bfeaff', glow: '#dff6ff', wings: false, fx: 'ice' }),
    W('Lance du Magma Rancunier', 'Le volcan voulait la garder. Négociations brèves.',
      { len: 1.5, shaftC: '#2c1410', shaftW: 2.7, blade: 'double', bladeC1: '#ffb35c', bladeC2: '#8a1e0a', guard: true, gem: '#ff6a2a', glow: '#ff8a3a', wings: false, fx: 'flame' }),
    W('Aiguille du Temps', 'Pique le futur avant qu’il n’arrive. Très déloyal.',
      { len: 1.5, shaftC: '#6a6252', shaftW: 2.2, blade: 'tri', bladeC1: '#fdf6e0', bladeC2: '#b0a070', guard: true, gem: '#7fd0ff', glow: '#ffe9a8', wings: false, fx: 'spark' }),
    W('Trident du Kraken Dompté', 'Le kraken vit désormais dans la gamelle. Il est ravi.',
      { len: 1.5, shaftC: '#12303a', shaftW: 2.8, blade: 'trident', bladeC1: '#5af0d0', bladeC2: '#0e5a52', guard: true, gem: '#20e3b2', glow: '#4fe8c8', wings: false, fx: 'ice' }),
    W('Hallebarde des Cent Moustaches', 'Cent moustaches gravées. Cent dettes d’honneur.',
      { len: 1.5, shaftC: '#4a3218', shaftW: 2.8, blade: 'halberd', bladeC1: '#ffe9a0', bladeC2: '#a87e2e', guard: true, gem: '#e05252', glow: '#ffe9a8', wings: true, fx: 'spark' }),
    W('Faux du Crépuscule Administratif', 'Elle clôt les dossiers. Et les carrières.',
      { len: 1.55, shaftC: '#241c34', shaftW: 2.7, blade: 'crescent', bladeC1: '#c8a8ff', bladeC2: '#3a2a5e', guard: true, gem: '#ffd700', glow: '#8f6fff', wings: false, fx: 'stars' }),
    W('Lance du Noyau Stellaire', 'Cœur d’étoile. Manche en chêne. Contraste assumé.',
      { len: 1.55, shaftC: '#5a4020', shaftW: 2.8, blade: 'star', bladeC1: '#fff6c0', bladeC2: '#f08828', guard: true, gem: '#ffdf6a', glow: '#ffc85a', wings: true, fx: 'flame' }),
    W('Harpon des Dieux Distraits', 'Un dieu l’a posé là et l’a oublié. Tant pis pour lui.',
      { len: 1.55, shaftC: '#8a94a4', shaftW: 2.9, blade: 'double', bladeC1: '#f0f6ff', bladeC2: '#7a8aa0', guard: true, gem: '#9cf7ff', glow: '#cfe8ff', wings: true, fx: 'rainbow' }),
    W('L’AU-DELÀ DE LA LANCE', 'Il y avait quelque chose au-delà. C’est ça. Désolé.',
      { len: 1.6, shaftC: '#fff8e0', shaftW: 3.0, blade: 'star', bladeC1: '#ffffff', bladeC2: '#ffd700', guard: true, gem: '#ff6ad5', glow: '#ffffff', wings: true, fx: 'rainbow' }),
  ];
  // §D15-1 : les premiers rangs valident vite le geste, puis la Forge devient
  // une vraie boucle idle ; le levier ouvriers d'enclume sert dès le T1.
  // Coûts relevés : food 400, TOUTES les composantes grimpent en ×1.34 par tier.
  GameData.WEAPONS.forEach((w, i) => {
    w.tier = i;
    w.dmgMult = Math.pow(1.12, i);
    w.craftTime = forgeCraftTime(i);
    const c = { food: Math.round(400 * Math.pow(1.34, i)), mat1: Math.round(72 * Math.pow(1.34, i)) };
    if (i >= 8) c.mat2 = Math.round(32 * Math.pow(1.34, i - 8));
    if (i >= 12) c.mat3 = Math.round(24 * Math.pow(1.34, i - 12));
    if (i >= 18) c.medals = (i - 17) * 8;
    if (i >= 20) c.essence = Math.round(12 * Math.pow(1.34, i - 20));
    if (i >= 26) c.parts = Math.round(12 * Math.pow(1.34, i - 26));
    if (i >= 32) c.fabric = Math.round(12 * Math.pow(1.34, i - 32));
    w.cost = c;
  });

  // ---------- §D17-2 : LES 40 LAMES (catégorie 'garde' — lames une main) ----------
  // style calqué sur WEAPONS : len, gripC (poignée), gripW, blade 'knife'|'short'|
  //        'saber'|'wide'|'rapier'|'flamberge'|'crescent'|'double'|'star',
  //        bladeC1 (clair), bladeC2 (foncé), guard, gem, glow, wings, fx
  const B = (name, desc, style) => ({ name, desc, style });
  GameData.BLADES = [
    B('Couteau de cuisine réquisitionné', 'La cuisine proteste. Le front remercie.',
      { len: 0.8, gripC: '#8a6a42', gripW: 1.8, blade: 'knife', bladeC1: '#f2f4f6', bladeC2: '#c9cdd2', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Ouvre-boîte affûté', 'Ouvre les boîtes, les conserves et les hostilités.',
      { len: 0.85, gripC: '#c8a86a', gripW: 1.6, blade: 'knife', bladeC1: '#fdf4df', bladeC2: '#d8c49a', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Lame d’entraînement', 'Le bord émoussé s’est ré-affûté « tout seul ».',
      { len: 0.9, gripC: '#9a7648', gripW: 2.0, blade: 'short', bladeC1: '#e8d8b8', bladeC2: '#b09468', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Coutelas de silex', 'Tranchant de l’âge de pierre. Rancune du même âge.',
      { len: 0.9, gripC: '#8a6a42', gripW: 2.0, blade: 'wide', bladeC1: '#9aa0a6', bladeC2: '#6f757c', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Machette de jardinier', 'Taillait des haies. Taille désormais plus large.',
      { len: 0.95, gripC: '#5c4a38', gripW: 1.9, blade: 'wide', bladeC1: '#d8dde3', bladeC2: '#9aa2ab', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Lame de cuivre', 'Verdit sous la pluie, mord par tous les temps.',
      { len: 1.0, gripC: '#7a5a38', gripW: 2.0, blade: 'short', bladeC1: '#e0a468', bladeC2: '#8f5522', guard: false, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Épée courte de fer', 'Du vrai métal sérieux pour des duels sérieux.',
      { len: 1.0, gripC: '#6a5a48', gripW: 2.1, blade: 'short', bladeC1: '#aab2bb', bladeC2: '#6d757e', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Sabre denté', 'Les dents sont là pour négocier. Elles négocient bien.',
      { len: 1.05, gripC: '#5c4a38', gripW: 2.2, blade: 'saber', bladeC1: '#98a2ae', bladeC2: '#5c646e', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Lame d’acier poli', 'On s’y recoiffe entre deux parades.',
      { len: 1.05, gripC: '#5a4a3a', gripW: 2.1, blade: 'short', bladeC1: '#dfe6ee', bladeC2: '#98a2ae', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Épée du sergent', 'Livrée avec le ton qui va avec.',
      { len: 1.1, gripC: '#4e4034', gripW: 2.3, blade: 'wide', bladeC1: '#ccd4dd', bladeC2: '#88929e', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Rapière de gouttière', 'Fine, rouillée d’un côté, vexante des deux.',
      { len: 1.15, gripC: '#4a5648', gripW: 1.7, blade: 'rapier', bladeC1: '#b8c8bc', bladeC2: '#6e8272', guard: true, gem: null, glow: null, wings: false, fx: 'none' }),
    B('Lame d’argent', 'Élégante, précieuse, expéditive.',
      { len: 1.15, gripC: '#7a8494', gripW: 2.1, blade: 'short', bladeC1: '#eef4fb', bladeC2: '#aab6c6', guard: true, gem: null, glow: '#bcd6ff', wings: false, fx: 'none' }),
    B('Sabre doré', 'L’ennemi plisse les yeux. Erreur fatale.',
      { len: 1.2, gripC: '#8a6a2e', gripW: 2.2, blade: 'saber', bladeC1: '#f6cf5d', bladeC2: '#c3922e', guard: true, gem: null, glow: '#ffe9a8', wings: false, fx: 'none' }),
    B('Épée royale', 'Un rubis au pommeau. Probablement un vrai.',
      { len: 1.2, gripC: '#6e3a3a', gripW: 2.3, blade: 'wide', bladeC1: '#f6d76d', bladeC2: '#b8862e', guard: true, gem: '#d33a3a', glow: '#ffdf9a', wings: false, fx: 'none' }),
    B('Lame du duelliste', 'Rapide, précise, un rien prétentieuse.',
      { len: 1.25, gripC: '#4a4a54', gripW: 1.8, blade: 'rapier', bladeC1: '#e8eef6', bladeC2: '#9aa6b4', guard: true, gem: '#3a86ff', glow: '#a8c8ff', wings: false, fx: 'none' }),
    B('Flamberge ouvragée', 'Gravée de moustaches et de plumes. Œcuménique.',
      { len: 1.25, gripC: '#5e4222', gripW: 2.4, blade: 'flamberge', bladeC1: '#f2d98a', bladeC2: '#9a8248', guard: true, gem: '#7bd389', glow: '#ffe9a8', wings: false, fx: 'none' }),
    B('Épée du croisé', 'Bénie par le Grand Ronron ET le Grand Cui-Cui.',
      { len: 1.25, gripC: '#8a8276', gripW: 2.3, blade: 'wide', bladeC1: '#fffef8', bladeC2: '#cbb87e', guard: true, gem: '#f4c542', glow: '#fff2c8', wings: false, fx: 'none' }),
    B('Sabre des tempêtes', 'Crépite. Ne pas dégainer sous la douche.',
      { len: 1.3, gripC: '#3a4a5e', gripW: 2.3, blade: 'saber', bladeC1: '#7fd0ff', bladeC2: '#2f6fae', guard: true, gem: null, glow: '#9fdcff', wings: false, fx: 'spark' }),
    B('Lame de braise', 'Cautérise en tranchant. Service complet.',
      { len: 1.3, gripC: '#4a2c1e', gripW: 2.4, blade: 'wide', bladeC1: '#ffb35c', bladeC2: '#d84a1e', guard: true, gem: null, glow: '#ff9a4d', wings: false, fx: 'flame' }),
    B('Lame de givre', 'Les plaies attendront le dégel pour saigner.',
      { len: 1.3, gripC: '#5a7a8e', gripW: 2.3, blade: 'saber', bladeC1: '#e8f8ff', bladeC2: '#7ab8d8', guard: true, gem: null, glow: '#bfeaff', wings: false, fx: 'ice' }),
    B('Épée solaire', 'Un rayon de midi plié en deux. Chut.',
      { len: 1.35, gripC: '#9a7a2e', gripW: 2.4, blade: 'wide', bladeC1: '#fff6d0', bladeC2: '#f0a828', guard: true, gem: '#ff8c28', glow: '#ffd76a', wings: false, fx: 'spark' }),
    B('Croc d’ombre', 'Découpe la lumière elle-même. Très dramatique.',
      { len: 1.35, gripC: '#2e2440', gripW: 2.4, blade: 'crescent', bladeC1: '#8a76b4', bladeC2: '#3e3258', guard: true, gem: '#b48cff', glow: '#8f6fff', wings: false, fx: 'none' }),
    B('Lame céleste', 'Des petites ailes. Elle pare presque toute seule.',
      { len: 1.35, gripC: '#8ca8c4', gripW: 2.3, blade: 'short', bladeC1: '#ffffff', bladeC2: '#9cc4e8', guard: true, gem: '#cfe8ff', glow: '#cfe8ff', wings: true, fx: 'none' }),
    B('Sabre abyssal', 'Remonté de la fosse de la gamelle d’eau.',
      { len: 1.35, gripC: '#1e3a3e', gripW: 2.5, blade: 'saber', bladeC1: '#4fe0c4', bladeC2: '#17706a', guard: true, gem: '#20e3b2', glow: '#3fe8c8', wings: false, fx: 'ice' }),
    B('Lame draconique', 'Trempée dans une haleine de dragon. De thon ?',
      { len: 1.4, gripC: '#3a1e1e', gripW: 2.6, blade: 'double', bladeC1: '#ff6a4a', bladeC2: '#7a1e12', guard: true, gem: '#ff4040', glow: '#ff6a4a', wings: false, fx: 'flame' }),
    B('Épée de météore', 'Encore tiède. Livraison spatiale directe.',
      { len: 1.4, gripC: '#4a3428', gripW: 2.6, blade: 'star', bladeC1: '#ffc86a', bladeC2: '#b8501e', guard: true, gem: '#ffdf6a', glow: '#ffab4d', wings: false, fx: 'flame' }),
    B('Lame galactique', 'Une petite galaxie sur le fil. Hypnotique.',
      { len: 1.4, gripC: '#2a2444', gripW: 2.5, blade: 'star', bladeC1: '#b48cff', bladeC2: '#4a3a8e', guard: true, gem: '#7fd0ff', glow: '#b48cff', wings: false, fx: 'stars' }),
    B('Sabre arc-en-ciel', 'Toutes les couleurs de l’estocade. En même temps.',
      { len: 1.4, gripC: '#f8f4ec', gripW: 2.4, blade: 'saber', bladeC1: '#ffffff', bladeC2: '#c8c8d8', guard: true, gem: '#ff6ad5', glow: '#ffffff', wings: false, fx: 'rainbow' }),
    B('Lame de l’éclipse', 'Le jour et la nuit se partagent le tranchant.',
      { len: 1.45, gripC: '#1e1a28', gripW: 2.6, blade: 'crescent', bladeC1: '#ffd700', bladeC2: '#2a2438', guard: true, gem: '#ffd700', glow: '#ffd700', wings: true, fx: 'stars' }),
    B('LA LAME ULTIME', 'Rien au-delà. Enfin… on croyait. Encore.',
      { len: 1.5, gripC: '#f4e8c8', gripW: 2.8, blade: 'star', bladeC1: '#fffdf0', bladeC2: '#f0c030', guard: true, gem: '#ff6ad5', glow: '#ffffff', wings: true, fx: 'rainbow' }),
    B('Lame du Vide', 'La moitié existe. L’autre moitié tranche quand même.',
      { len: 1.45, gripC: '#141020', gripW: 2.6, blade: 'crescent', bladeC1: '#6a5aa8', bladeC2: '#241c48', guard: true, gem: '#3a2a6e', glow: '#5a3aae', wings: false, fx: 'stars' }),
    B('Sabre de la Banquise Éternelle', 'Un hiver affûté qui refuse de fondre.',
      { len: 1.45, gripC: '#3a5a72', gripW: 2.5, blade: 'saber', bladeC1: '#eafcff', bladeC2: '#5aa8d8', guard: true, gem: '#bfeaff', glow: '#dff6ff', wings: false, fx: 'ice' }),
    B('Lame du Magma Rancunier', 'Le volcan la réclame. Le fil dit non.',
      { len: 1.5, gripC: '#2c1410', gripW: 2.7, blade: 'double', bladeC1: '#ffb35c', bladeC2: '#8a1e0a', guard: true, gem: '#ff6a2a', glow: '#ff8a3a', wings: false, fx: 'flame' }),
    B('Rasoir du Temps', 'Coupe le futur en tranches fines. Déloyal.',
      { len: 1.5, gripC: '#6a6252', gripW: 2.2, blade: 'rapier', bladeC1: '#fdf6e0', bladeC2: '#b0a070', guard: true, gem: '#7fd0ff', glow: '#ffe9a8', wings: false, fx: 'spark' }),
    B('Croc du Kraken Dompté', 'Un bec de kraken remonté au moulinet. Il est ravi.',
      { len: 1.5, gripC: '#12303a', gripW: 2.8, blade: 'crescent', bladeC1: '#5af0d0', bladeC2: '#0e5a52', guard: true, gem: '#20e3b2', glow: '#4fe8c8', wings: false, fx: 'ice' }),
    B('Flamberge des Cent Moustaches', 'Cent moustaches gravées. Cent duels gagnés d’avance.',
      { len: 1.5, gripC: '#4a3218', gripW: 2.8, blade: 'flamberge', bladeC1: '#ffe9a0', bladeC2: '#a87e2e', guard: true, gem: '#e05252', glow: '#ffe9a8', wings: true, fx: 'spark' }),
    B('Coupe-papier du Crépuscule Administratif', 'Il clôt les dossiers. Et les débats.',
      { len: 1.55, gripC: '#241c34', gripW: 2.7, blade: 'rapier', bladeC1: '#c8a8ff', bladeC2: '#3a2a5e', guard: true, gem: '#ffd700', glow: '#8f6fff', wings: false, fx: 'stars' }),
    B('Lame du Noyau Stellaire', 'Un éclat d’étoile emmanché. Contraste assumé.',
      { len: 1.55, gripC: '#5a4020', gripW: 2.8, blade: 'star', bladeC1: '#fff6c0', bladeC2: '#f08828', guard: true, gem: '#ffdf6a', glow: '#ffc85a', wings: true, fx: 'flame' }),
    B('Sabre des Dieux Distraits', 'Un dieu l’a posé là. Tant pis pour lui.',
      { len: 1.55, gripC: '#8a94a4', gripW: 2.9, blade: 'double', bladeC1: '#f0f6ff', bladeC2: '#7a8aa0', guard: true, gem: '#9cf7ff', glow: '#cfe8ff', wings: true, fx: 'rainbow' }),
    B('L’AU-DELÀ DE LA LAME', 'Il y avait un tranchant au-delà. C’est celui-ci. Désolé.',
      { len: 1.6, gripC: '#fff8e0', gripW: 3.0, blade: 'star', bladeC1: '#ffffff', bladeC2: '#ffd700', guard: true, gem: '#ff6ad5', glow: '#ffffff', wings: true, fx: 'rainbow' }),
  ];
  // §D17-2 : formules coût/craftTime IDENTIQUES aux autres lignes d'armes (modèle WEAPONS)
  GameData.BLADES.forEach((w, i) => {
    w.tier = i;
    w.dmgMult = Math.pow(1.12, i);
    w.craftTime = forgeCraftTime(i);
    const c = { food: Math.round(400 * Math.pow(1.34, i)), mat1: Math.round(72 * Math.pow(1.34, i)) };
    if (i >= 8) c.mat2 = Math.round(32 * Math.pow(1.34, i - 8));
    if (i >= 12) c.mat3 = Math.round(24 * Math.pow(1.34, i - 12));
    if (i >= 18) c.medals = (i - 17) * 8;
    if (i >= 20) c.essence = Math.round(12 * Math.pow(1.34, i - 20));
    if (i >= 26) c.parts = Math.round(12 * Math.pow(1.34, i - 26));
    if (i >= 32) c.fabric = Math.round(12 * Math.pow(1.34, i - 32));
    w.cost = c;
  });

  // ---------- LES 40 ARMURES (§D16-3 : 40 rangs) ----------
  const A = (name, desc, capeC, metalC) => ({ name, desc, capeC, metalC });
  GameData.ARMORS = [
    A('Bandana du quartier', 'Ça ne protège rien, mais quel style.', '#d6708a', null),
    A('Gilet de laine', 'Tricoté avec amour. Gratte un peu.', '#7ecf9a', null),
    A('Cuir de canapé', 'Le canapé s’est sacrifié pour la cause.', '#b98a5a', null),
    A('Maille légère', 'Cliquette agréablement en marchant.', '#9fb2c8', '#aab8c8'),
    A('Plastron de fer', 'Lourd, solide, et légèrement rouillé.', '#8b98a8', '#98a4b2'),
    A('Armure d’argent', 'Les ennemis se voient dedans et prennent peur.', '#dfe8f2', '#c8d4e2'),
    A('Armure dorée', 'Bling bling ET pare-balles (pare-becs ?).', '#f4cf5d', '#e8c452'),
    A('Armure enchantée', 'Murmure des encouragements pendant la bataille.', '#8f6fff', '#a88cff'),
    A('Armure draconique', 'Écailles véritables. Le dragon était d’accord.', '#e05252', '#c84848'),
    A('Armure céleste', 'Tissée avec des nuages et de la détermination.', '#eaf6ff', '#d4e8fa'),
    A('Armure d’obsidienne', 'Taillée dans une nuit particulièrement solide.', '#2a2430', '#3e3648'),
    A('Cuirasse du Vide', 'Les coups ennemis arrivent en retard. Toujours.', '#1a1428', '#4a3a7e'),
    A('Armure solaire', 'Chauffe un peu. Aveugle beaucoup. Protège énormément.', '#ffd75a', '#f0a828'),
    A('Armure galactique', 'Contient trois constellations et un léger vertige.', '#2a2a54', '#7a6ad8'),
    A('L’ARMURE ABSOLUE', 'Le concept même de blessure dépose un préavis.', '#fdf8ea', '#ffd700'),
    // §D16-3 : tiers 15-39 — l'absolu a reçu du courrier. Il y avait une suite.
    A('Armure de la Banquise Éternelle', 'L’hiver a signé un bail à durée indéterminée.', '#dff6ff', '#5aa8d8'),
    A('Cuirasse du Magma Rancunier', 'Tiède au toucher. Furieuse à l’impact.', '#8a1e0a', '#ff8a3a'),
    A('Armure du Temps Emprunté', 'Les coups arrivent la semaine dernière. Classé sans suite.', '#b0a070', '#fdf6e0'),
    A('Cuirasse du Kraken Dompté', 'Huit bras pour parer. Aucun pour s’excuser.', '#0e5a52', '#4fe0c4'),
    A('Armure des Cent Batailles', 'Cent batailles, zéro bosse. Les batailles sont vexées.', '#a87e2e', '#ffe9a0'),
    A('Cuirasse de l’Éclipse', 'Mi-jour, mi-nuit, entièrement impénétrable.', '#1e1a28', '#ffd700'),
    A('Armure des Marées Célestes', 'Le ciel monte et descend dessus. Elle, jamais.', '#4a5468', '#cfe8ff'),
    A('Cuirasse du Noyau Stellaire', 'Un cœur d’étoile en guise de plastron. Peu discret.', '#6a5220', '#ffdf6a'),
    A('Armure de la Supernova Apprivoisée', 'Elle explose vers l’extérieur. Nuance capitale.', '#5a4020', '#f08828'),
    A('Cuirasse des Dieux Distraits', 'Forgée pour un dieu. Il a oublié de la sortir du four.', '#7a8aa0', '#f0f6ff'),
    A('Armure du Crépuscule Administratif', 'Chaque coup reçu est archivé, contesté, puis nié.', '#241c34', '#c8a8ff'),
    A('Cuirasse de l’Horizon Replié', 'Les attaques à distance deviennent des attaques d’ailleurs.', '#c8c8d8', '#ffffff'),
    A('Armure de l’Aube Conceptuelle', 'Elle se lève avant le danger. Toujours.', '#f0c030', '#fffdf0'),
    A('Cuirasse de la Réalité Négociable', 'Les dégâts sont renégociés à la baisse. Systématiquement.', '#4a3a8e', '#b48cff'),
    A('Armure du Silence Stratégique', 'Aucun cliquetis. Les embuscades l’adorent.', '#2e3648', '#8ca4c8'),
    A('Cuirasse des Constellations Dissoutes', 'Les étoiles fondues dedans brillent encore, par habitude.', '#1a1638', '#b48cff'),
    A('Armure du Zénith Boudeur', 'Le soleil au sommet refuse de redescendre. Il protège.', '#9a7a2e', '#fff6c0'),
    A('Cuirasse de l’Antimatière Polie', 'Ne pas toucher l’envers. Vraiment.', '#141020', '#9cf7ff'),
    A('Armure des Probabilités Favorables', 'Statistiquement intouchable. Les statistiques tiennent bon.', '#3a2a6e', '#7fd0ff'),
    A('Cuirasse de l’Éternité Provisoire', 'Garantie à vie. Plusieurs vies. On verra.', '#8a8276', '#fffef8'),
    A('Armure du Big Bang Domestiqué', 'Le début de l’univers, en tenue de parade.', '#2a2444', '#ffdf6a'),
    A('Cuirasse de l’Infini Raisonnable', 'Une protection sans fin, mais avec des horaires.', '#5a3aae', '#cfe8ff'),
    A('Armure du Concept d’Armure', 'L’idée pure de protection. Ça suffit largement.', '#fdf8ea', '#c8d4e2'),
    A('L’AVANT-DERNIÈRE ARMURE', 'Un titre honnête, pour une fois. Méfiance.', '#f4e8c8', '#f0c030'),
    A('L’AU-DELÀ DE L’ARMURE', 'Le concept de blessure a quitté la région.', '#fffdf0', '#ffd700'),
  ];
  GameData.ARMORS.forEach((a, i) => {
    a.tier = i;
    a.hpMult = Math.pow(1.13, i);
    a.craftTime = forgeCraftTime(i);
    // ÉQUILIBRAGE : les 4 premiers tiers d'armure en TIER 1 (la ligne est ouverte
    // dès la 1re unité de corps à corps — elle doit être forgeable dès le début).
    const c = { food: Math.round(560 * Math.pow(1.38, i)), mat1: Math.round(66 * Math.pow(1.36, i)) };
    if (i >= 8) c.mat2 = Math.round(48 * Math.pow(1.36, i - 8));
    if (i >= 12) c.mat3 = Math.round(32 * Math.pow(1.36, i - 12));
    if (i >= 7) c.medals = (i - 6) * 16;
    if (i >= 17) c.essence = Math.round(16 * Math.pow(1.3, i - 17));
    if (i >= 24) c.fabric = Math.round(16 * Math.pow(1.3, i - 24));
    a.cost = c;
  });

  // ---------- §D17-2 : LES 40 BOUCLIERS (catégorie 'garde' — protection portée) ----------
  // style: shape 'round'|'kite'|'tower', tint (fond), trim (bordure/umbo), emblem (motif)
  const SH = (name, desc, style) => ({ name, desc, style });
  GameData.SHIELDS = [
    SH('Couvercle de poubelle', 'Sent un peu. Protège beaucoup.', { shape: 'round', tint: '#8a8f98', trim: '#5c6068', emblem: 'none' }),
    SH('Planche à découper', 'Déjà couturée de cicatrices. Expérimentée, donc.', { shape: 'kite', tint: '#b98a5a', trim: '#8a5f34', emblem: 'none' }),
    SH('Bouclier d’entraînement', 'En mousse. La mousse a durci. Officiellement toute seule.', { shape: 'round', tint: '#9a7648', trim: '#6a4e2e', emblem: 'none' }),
    SH('Rondache de tonneau', 'Le fond du tonneau. Le vin est parti, le courage reste.', { shape: 'round', tint: '#8a6a42', trim: '#5c4a38', emblem: 'spiral' }),
    SH('Écu de charpentier', 'Trois planches, deux clous, une foi inébranlable.', { shape: 'kite', tint: '#7a5a38', trim: '#4e4034', emblem: 'stud' }),
    SH('Rondache de cuivre', 'Verdit sous la pluie. Sonne comme une cloche vexée.', { shape: 'round', tint: '#e0a468', trim: '#8f5522', emblem: 'stud' }),
    SH('Écu de fer', 'Du métal sérieux entre vous et le problème.', { shape: 'kite', tint: '#8b98a8', trim: '#5c646e', emblem: 'stud' }),
    SH('Targe cloutée', 'Les clous ne servent à rien. Ils découragent.', { shape: 'round', tint: '#6a4e36', trim: '#3e2c1a', emblem: 'stud' }),
    SH('Écu d’acier poli', 'L’ennemi se voit dedans, se trouve petit.', { shape: 'kite', tint: '#dfe6ee', trim: '#98a2ae', emblem: 'none' }),
    SH('Pavois du sergent', 'Assez grand pour deux. Le sergent ne partage pas.', { shape: 'tower', tint: '#5a5f68', trim: '#3d4148', emblem: 'stripe' }),
    SH('Targe de gouttière', 'Bosselée, moussue, indestructible. La gouttière forme bien.', { shape: 'round', tint: '#4a5648', trim: '#6e8272', emblem: 'wave' }),
    SH('Écu d’argent', 'Pare avec distinction. Renvoie les coups ET les compliments.', { shape: 'kite', tint: '#eef4fb', trim: '#aab6c6', emblem: 'moon' }),
    SH('Bouclier doré', 'Aveugle l’ennemi entre deux parades. Deux emplois, un salaire.', { shape: 'round', tint: '#f6cf5d', trim: '#c3922e', emblem: 'sun' }),
    SH('Pavois royal', 'Armorié d’un rubis. Le blason fait le reste.', { shape: 'tower', tint: '#6e3a3a', trim: '#f6d76d', emblem: 'crown' }),
    SH('Targe du duelliste', 'Petite, rapide, insupportable de précision.', { shape: 'round', tint: '#4a4a54', trim: '#e8eef6', emblem: 'gem' }),
    SH('Écu ouvragé', 'Gravé de moustaches et de plumes. La parade œcuménique.', { shape: 'kite', tint: '#f2d98a', trim: '#9a8248', emblem: 'eye' }),
    SH('Pavois du croisé', 'Béni des deux côtés. On n’est jamais trop prudent.', { shape: 'tower', tint: '#fffef8', trim: '#cbb87e', emblem: 'star' }),
    SH('Bouclier des tempêtes', 'Les coups tombent dessus comme la foudre : ailleurs.', { shape: 'round', tint: '#3a4a5e', trim: '#7fd0ff', emblem: 'bolt' }),
    SH('Écu de braise', 'Chauffe les mains. Refroidit les ardeurs.', { shape: 'kite', tint: '#8a2e1a', trim: '#ffb35c', emblem: 'flame' }),
    SH('Targe de givre', 'Les lames y collent. Les ennemis regrettent.', { shape: 'round', tint: '#5a7a8e', trim: '#e8f8ff', emblem: 'snow' }),
    SH('Bouclier solaire', 'Un midi d’été en bandoulière. Crème non fournie.', { shape: 'round', tint: '#fff6d0', trim: '#f0a828', emblem: 'sun' }),
    SH('Écu d’ombre', 'Les coups le cherchent encore.', { shape: 'kite', tint: '#2e2440', trim: '#8a76b4', emblem: 'moon' }),
    SH('Pavois céleste', 'Des petites ailes. Il se hisse tout seul.', { shape: 'tower', tint: '#eaf6ff', trim: '#8ca8c4', emblem: 'wing' }),
    SH('Rondache abyssale', 'Remontée des grands fonds de la gamelle. Étanche, donc.', { shape: 'round', tint: '#12303a', trim: '#4fe0c4', emblem: 'wave' }),
    SH('Écu draconique', 'Écailles véritables. Le dragon garde un droit de visite.', { shape: 'kite', tint: '#7a1e12', trim: '#ff6a4a', emblem: 'fang' }),
    SH('Bouclier de météore', 'Un cratère portatif. Il connaît le métier.', { shape: 'round', tint: '#4a3428', trim: '#ffc86a', emblem: 'star' }),
    SH('Pavois galactique', 'Trois constellations en façade. L’ennemi contemple, perd.', { shape: 'tower', tint: '#2a2444', trim: '#b48cff', emblem: 'star' }),
    SH('Écu arc-en-ciel', 'Toutes les parades. En même temps. Pourquoi choisir ?', { shape: 'kite', tint: '#f8f4ec', trim: '#ff6ad5', emblem: 'gem' }),
    SH('Bouclier de l’éclipse', 'Le jour pare, la nuit riposte. Roulement d’équipe.', { shape: 'round', tint: '#1e1a28', trim: '#ffd700', emblem: 'moon' }),
    SH('LE BOUCLIER ULTIME', 'Rien ne passe. Enfin… on croyait. Suite au prochain tier.', { shape: 'tower', tint: '#fdf8ea', trim: '#ffd700', emblem: 'crown' }),
    SH('Bouclier du Vide', 'Il n’existe qu’à moitié. Les coups ratent les deux moitiés.', { shape: 'round', tint: '#141020', trim: '#5a3aae', emblem: 'eye' }),
    SH('Pavois de la Banquise Éternelle', 'Un iceberg de poche. Les assauts font naufrage.', { shape: 'tower', tint: '#dff6ff', trim: '#5aa8d8', emblem: 'snow' }),
    SH('Écu du Magma Rancunier', 'Les lames fondent avant l’excuse.', { shape: 'kite', tint: '#8a1e0a', trim: '#ff8a3a', emblem: 'flame' }),
    SH('Bouclier du Temps Emprunté', 'Il pare les coups d’hier. Prévoyant.', { shape: 'round', tint: '#b0a070', trim: '#fdf6e0', emblem: 'hourglass' }),
    SH('Pavois du Kraken Dompté', 'Huit bras pour parer. Aucun pour rendre.', { shape: 'tower', tint: '#0e5a52', trim: '#4fe0c4', emblem: 'tentacle' }),
    SH('Écu des Cent Batailles', 'Cent batailles, zéro fissure. Les batailles boudent.', { shape: 'kite', tint: '#a87e2e', trim: '#ffe9a0', emblem: 'stud' }),
    SH('Bouclier du Crépuscule Administratif', 'Chaque coup reçu est déclaré irrecevable.', { shape: 'round', tint: '#241c34', trim: '#c8a8ff', emblem: 'scroll' }),
    SH('Pavois du Noyau Stellaire', 'Un cœur d’étoile en façade. Peu discret, très dissuasif.', { shape: 'tower', tint: '#6a5220', trim: '#ffdf6a', emblem: 'sun' }),
    SH('Écu des Dieux Distraits', 'Un dieu s’abritait derrière. Il a oublié pourquoi.', { shape: 'kite', tint: '#7a8aa0', trim: '#f0f6ff', emblem: 'eye' }),
    SH('L’AU-DELÀ DU BOUCLIER', 'Le concept d’impact a demandé sa mutation.', { shape: 'tower', tint: '#fffdf0', trim: '#ffd700', emblem: 'infinity' }),
  ];
  // §D17-2 : formules des lignes d'ARMURES (food 560×1.38^i, matériau ×1.36)
  GameData.SHIELDS.forEach((a, i) => {
    a.tier = i;
    a.hpMult = Math.pow(1.13, i);
    a.craftTime = forgeCraftTime(i);
    const c = { food: Math.round(560 * Math.pow(1.38, i)), mat1: Math.round(52 * Math.pow(1.36, i)) };
    if (i >= 8) c.mat2 = Math.round(28 * Math.pow(1.36, i - 8));
    if (i >= 8) c.medals = (i - 7) * 12;
    if (i >= 17) c.essence = Math.round(14 * Math.pow(1.3, i - 17));
    if (i >= 24) c.parts = Math.round(12 * Math.pow(1.3, i - 24));
    a.cost = c;
  });

  // ---------- LES 40 ARMES DE TIR (§14 : catégorie 'tir' — §D16-3 : 40 rangs) ----------
  // style: kind 'sling'|'bow'|'crossbow'|'launcher', size 0.8-1.5,
  //        armC (branches/arceau), gripC (poignée), stringC (corde/élastique),
  //        tipC (pointe/projectile), glow, fx
  const R = (name, desc, style) => ({ name, desc, style });
  GameData.RANGED = [
    R('Élastique de facteur', 'Trouvé par terre un mardi. Le facteur porte plainte.',
      { kind: 'sling', size: 0.8, armC: '#8a6a42', gripC: '#6a4e2e', stringC: '#d8c8a8', tipC: '#9aa0a6', glow: null, fx: 'none' }),
    R('Fronde de chaussette orpheline', 'Sa jumelle a disparu au lavage. Elle venge.',
      { kind: 'sling', size: 0.85, armC: '#9a7648', gripC: '#6a4e2e', stringC: '#e8d8b8', tipC: '#8f959c', glow: null, fx: 'none' }),
    R('Lance-noyaux de compétition', 'Homologué par la fédération des vergers.',
      { kind: 'sling', size: 0.9, armC: '#7a5a38', gripC: '#5a4226', stringC: '#c8b088', tipC: '#b05a3a', glow: null, fx: 'none' }),
    R('Arc de branche têtue', 'La branche refusait de plier. On a insisté.',
      { kind: 'bow', size: 0.9, armC: '#8a6a42', gripC: '#5c4a38', stringC: '#e8e0cc', tipC: '#c9cdd2', glow: null, fx: 'none' }),
    R('Arc d’écolier puni', 'Confisqué trois fois. Récupéré quatre.',
      { kind: 'bow', size: 0.95, armC: '#c8a86a', gripC: '#8a6a42', stringC: '#f0e8d0', tipC: '#d8dde3', glow: null, fx: 'none' }),
    R('Fronde à double élastique', 'Deux fois plus d’élastique, deux fois moins d’excuses.',
      { kind: 'sling', size: 1.0, armC: '#6a5a48', gripC: '#4e4034', stringC: '#d84a1e', tipC: '#6d757e', glow: null, fx: 'none' }),
    R('Arc de chasse convenable', 'Enfin du matériel de professionnel. Ça change tout.',
      { kind: 'bow', size: 1.0, armC: '#5c4a38', gripC: '#3e3226', stringC: '#e8e0cc', tipC: '#aab2bb', glow: null, fx: 'none' }),
    R('Arbalète de gouttière', 'Assemblée avec ce qui traînait dans la gouttière.',
      { kind: 'crossbow', size: 1.0, armC: '#4a5648', gripC: '#5c4a38', stringC: '#b8c8bc', tipC: '#98a2ae', glow: null, fx: 'none' }),
    R('Arc composite de contrebande', 'Ne demandez pas d’où viennent les pièces.',
      { kind: 'bow', size: 1.05, armC: '#4e4034', gripC: '#2e2620', stringC: '#c8b088', tipC: '#ccd4dd', glow: null, fx: 'none' }),
    R('Arbalète du braconnier repenti', 'Il s’est repenti. Il a gardé le matériel.',
      { kind: 'crossbow', size: 1.05, armC: '#5a4a3a', gripC: '#3e3226', stringC: '#d8c8a8', tipC: '#88929e', glow: null, fx: 'none' }),
    R('Arc d’argent siffleur', 'Chaque flèche siffle un petit air moqueur.',
      { kind: 'bow', size: 1.1, armC: '#aab6c6', gripC: '#7a8494', stringC: '#eef4fb', tipC: '#dfe6ee', glow: '#bcd6ff', fx: 'none' }),
    R('Arbalète à répétition (de rancunes)', 'Recharge aussi vite qu’elle garde rancune.',
      { kind: 'crossbow', size: 1.1, armC: '#4a4a54', gripC: '#2e2e38', stringC: '#9aa6b4', tipC: '#e8eef6', glow: null, fx: 'none' }),
    R('Arc doré du percepteur', 'Il ne rate jamais son dû. Jamais.',
      { kind: 'bow', size: 1.15, armC: '#c3922e', gripC: '#8a6a2e', stringC: '#fff2c8', tipC: '#f6cf5d', glow: '#ffe9a8', fx: 'none' }),
    R('Arbalète de siège portative', '« Portative » est un grand mot. « Efficace » aussi.',
      { kind: 'crossbow', size: 1.2, armC: '#5e4222', gripC: '#3e2c16', stringC: '#c8b088', tipC: '#f2d98a', glow: null, fx: 'none' }),
    R('Arc des tempêtes', 'Les flèches arrivent avant le tonnerre. Question de principe.',
      { kind: 'bow', size: 1.2, armC: '#3a4a5e', gripC: '#2a3648', stringC: '#7fd0ff', tipC: '#9fdcff', glow: '#9fdcff', fx: 'spark' }),
    R('Arbalète de braise', 'Chaque carreau part déjà en colère. Et en feu.',
      { kind: 'crossbow', size: 1.25, armC: '#4a2c1e', gripC: '#2c1810', stringC: '#ff9a4d', tipC: '#ffb35c', glow: '#ff9a4d', fx: 'flame' }),
    R('Arc de givre', 'La cible a tout le temps de regretter. Lentement.',
      { kind: 'bow', size: 1.25, armC: '#5a7a8e', gripC: '#3a5a72', stringC: '#e8f8ff', tipC: '#bfeaff', glow: '#bfeaff', fx: 'ice' }),
    R('Lance-comètes de poche', 'L’espace, en format voyage.',
      { kind: 'launcher', size: 1.3, armC: '#2a2444', gripC: '#1a1630', stringC: '#b48cff', tipC: '#7fd0ff', glow: '#b48cff', fx: 'stars' }),
    R('Arbalète solaire', 'Vise avec l’aplomb d’un midi d’été.',
      { kind: 'crossbow', size: 1.3, armC: '#9a7a2e', gripC: '#6a5220', stringC: '#fff6d0', tipC: '#f0a828', glow: '#ffd76a', fx: 'spark' }),
    R('Arc céleste', 'Les flèches ne retombent que par politesse.',
      { kind: 'bow', size: 1.35, armC: '#8ca8c4', gripC: '#5a7a9a', stringC: '#ffffff', tipC: '#cfe8ff', glow: '#cfe8ff', fx: 'none' }),
    R('Lance-météores draconique', 'Le dragon fournit les munitions. Contrat léonin.',
      { kind: 'launcher', size: 1.35, armC: '#3a1e1e', gripC: '#241010', stringC: '#ff6a4a', tipC: '#ffb35c', glow: '#ff6a4a', fx: 'flame' }),
    R('Arc galactique', 'Bande la Voie lactée. Elle se laisse faire.',
      { kind: 'bow', size: 1.4, armC: '#2a2454', gripC: '#1a1638', stringC: '#b48cff', tipC: '#7fd0ff', glow: '#b48cff', fx: 'stars' }),
    R('Lance-éclipses réglementaire', 'Tamponné par trois administrations célestes.',
      { kind: 'launcher', size: 1.45, armC: '#241c34', gripC: '#141020', stringC: '#ffd700', tipC: '#c8a8ff', glow: '#ffd700', fx: 'stars' }),
    R('Arc arc-en-ciel (oui, on sait)', 'Le service des noms a démissionné.',
      { kind: 'bow', size: 1.45, armC: '#f8f4ec', gripC: '#c8c8d8', stringC: '#ff6ad5', tipC: '#ffffff', glow: '#ffffff', fx: 'rainbow' }),
    R('L’ARC AU-DELÀ DE L’ARC', 'Il tire sur le concept même de distance. Et il touche.',
      { kind: 'launcher', size: 1.5, armC: '#fff8e0', gripC: '#f0c030', stringC: '#ff6ad5', tipC: '#ffffff', glow: '#ffffff', fx: 'rainbow' }),
    // §D16-3 : tiers 25-39 — au-delà de l'au-delà, on continue quand même.
    R('Arc du Vide Courtois', 'La flèche n’existe qu’à l’arrivée. Elle s’excuse presque.',
      { kind: 'bow', size: 1.5, armC: '#141020', gripC: '#241c48', stringC: '#6a5aa8', tipC: '#b48cff', glow: '#5a3aae', fx: 'stars' }),
    R('Arbalète de la Banquise Éternelle', 'Chaque carreau livre un hiver personnel. Sans préavis.',
      { kind: 'crossbow', size: 1.5, armC: '#3a5a72', gripC: '#243c50', stringC: '#eafcff', tipC: '#bfeaff', glow: '#dff6ff', fx: 'ice' }),
    R('Arc du Magma Rancunier', 'La corde fume. Le service après-vente aussi.',
      { kind: 'bow', size: 1.55, armC: '#2c1410', gripC: '#1a0c08', stringC: '#ff8a3a', tipC: '#ffb35c', glow: '#ff8a3a', fx: 'flame' }),
    R('Lance-harpons du Kraken Dompté', 'Le kraken recharge lui-même. Il adore son métier.',
      { kind: 'launcher', size: 1.55, armC: '#12303a', gripC: '#0a2028', stringC: '#5af0d0', tipC: '#4fe0c4', glow: '#4fe8c8', fx: 'ice' }),
    R('Arc du Temps Emprunté', 'La flèche touche avant le tir. Le règlement proteste.',
      { kind: 'bow', size: 1.55, armC: '#6a6252', gripC: '#4a4438', stringC: '#fdf6e0', tipC: '#7fd0ff', glow: '#ffe9a8', fx: 'spark' }),
    R('Arbalète des Cent Sommations', 'Elle ne fait qu’une sommation. La centième.',
      { kind: 'crossbow', size: 1.55, armC: '#4a3218', gripC: '#2e1e0e', stringC: '#ffe9a0', tipC: '#f6d76d', glow: '#ffe9a8', fx: 'spark' }),
    R('Arc des Marées Célestes', 'Il bande l’horizon entier. L’horizon se laisse faire, ému.',
      { kind: 'bow', size: 1.6, armC: '#4a5468', gripC: '#2e3648', stringC: '#eef4ff', tipC: '#cfe8ff', glow: '#cfe8ff', fx: 'stars' }),
    R('Lance-supernovas de poche', 'La poche est classée zone sinistrée.',
      { kind: 'launcher', size: 1.6, armC: '#5a4020', gripC: '#3a2812', stringC: '#fff6c0', tipC: '#f08828', glow: '#ffc85a', fx: 'flame' }),
    R('Arbalète du Crépuscule Administratif', 'Chaque carreau clôt un dossier. Définitivement.',
      { kind: 'crossbow', size: 1.6, armC: '#241c34', gripC: '#141020', stringC: '#c8a8ff', tipC: '#ffd700', glow: '#8f6fff', fx: 'stars' }),
    R('Arc du Noyau Stellaire', 'La corde est un filament d’étoile. Elle chante faux.',
      { kind: 'bow', size: 1.6, armC: '#9a7a2e', gripC: '#6a5220', stringC: '#fff6c0', tipC: '#ffdf6a', glow: '#ffc85a', fx: 'flame' }),
    R('Lance-constellations de siège', 'Il épingle des ourses entières au-dessus de la cible.',
      { kind: 'launcher', size: 1.65, armC: '#2a2454', gripC: '#1a1638', stringC: '#b48cff', tipC: '#7fd0ff', glow: '#b48cff', fx: 'stars' }),
    R('Arc des Dieux Distraits', 'Un dieu tirait avec. Il a perdu son tour. Tant pis pour lui.',
      { kind: 'bow', size: 1.65, armC: '#8a94a4', gripC: '#5a6474', stringC: '#f0f6ff', tipC: '#9cf7ff', glow: '#cfe8ff', fx: 'rainbow' }),
    R('Arbalète de l’Horizon Replié', 'La distance a signé sa reddition. Sans conditions.',
      { kind: 'crossbow', size: 1.65, armC: '#f8f4ec', gripC: '#c8c8d8', stringC: '#ff6ad5', tipC: '#ffffff', glow: '#ffffff', fx: 'rainbow' }),
    R('Arc de l’Aube Conceptuelle', 'Il tire des levers de soleil. En pleine nuit. Exprès.',
      { kind: 'bow', size: 1.7, armC: '#fff8e0', gripC: '#f0c030', stringC: '#ffd700', tipC: '#fffdf0', glow: '#ffe9a8', fx: 'stars' }),
    R('LA FLÈCHE QUI PRÉCÈDE L’ARC', 'Elle part d’abord. L’arc suit, pour la forme.',
      { kind: 'launcher', size: 1.7, armC: '#fffdf0', gripC: '#ffd700', stringC: '#ff6ad5', tipC: '#ffffff', glow: '#ffffff', fx: 'rainbow' }),
  ];
  GameData.RANGED.forEach((w, i) => {
    w.tier = i;
    w.dmgMult = Math.pow(1.12, i);
    w.craftTime = forgeCraftTime(i);
    const c = { food: Math.round(480 * Math.pow(1.34, i)), mat1: Math.round(80 * Math.pow(1.34, i)) };
    if (i >= 8) c.mat2 = Math.round(32 * Math.pow(1.34, i - 8));
    if (i >= 12) c.mat3 = Math.round(24 * Math.pow(1.34, i - 12));
    if (i >= 11) c.medals = (i - 10) * 8;
    if (i >= 17) c.essence = Math.round(12 * Math.pow(1.34, i - 17));
    if (i >= 24) c.parts = Math.round(12 * Math.pow(1.34, i - 24));
    if (i >= 28) c.fabric = Math.round(12 * Math.pow(1.34, i - 28));
    w.cost = c;
  });

  // ---------- LES 40 BÂTONS (§14 : catégorie 'magie' — §D16-3 : 40 rangs) ----------
  // style: kind 'wand'|'staff'|'scepter', size, shaftC, orbC1 (clair),
  //        orbC2 (foncé), glow, fx, crystals
  const S = (name, desc, style) => ({ name, desc, style });
  GameData.STAFFS = [
    S('Brindille suspecte', 'Elle fait des étincelles. Personne n’ose demander pourquoi.',
      { kind: 'wand', size: 0.8, shaftC: '#8a6a42', orbC1: '#e8f0c8', orbC2: '#a8b880', glow: null, fx: 'none', crystals: false }),
    S('Baguette de sourcier au chômage', 'Elle ne trouve plus d’eau. Elle trouve des ennemis.',
      { kind: 'wand', size: 0.85, shaftC: '#9a7648', orbC1: '#bfe0ff', orbC2: '#6a9ac8', glow: null, fx: 'none', crystals: false }),
    S('Cuillère en bois vaguement maudite', 'La soupe n’a plus jamais été la même.',
      { kind: 'wand', size: 0.9, shaftC: '#c8a86a', orbC1: '#f0d8a8', orbC2: '#a87e4a', glow: null, fx: 'none', crystals: false }),
    S('Baguette de chef d’orchestre viré', 'L’orchestre regrette. La baguette, non.',
      { kind: 'wand', size: 0.9, shaftC: '#3e3226', orbC1: '#f2f4f6', orbC2: '#9aa2ab', glow: null, fx: 'none', crystals: false }),
    S('Bâton de randonnée mystique', 'Il connaît des raccourcis interdits par la physique.',
      { kind: 'staff', size: 0.95, shaftC: '#7a5a38', orbC1: '#c8e8c0', orbC2: '#5a8a5a', glow: null, fx: 'none', crystals: false }),
    S('Bâton du berger d’étoiles', 'Les étoiles obéissent. Les moutons, jamais.',
      { kind: 'staff', size: 1.0, shaftC: '#5c4a38', orbC1: '#fff6d0', orbC2: '#c8a850', glow: null, fx: 'none', crystals: false }),
    S('Bâton d’apprenti (licencié)', 'L’apprenti a fait exploser la grange. Le bâton nie tout.',
      { kind: 'staff', size: 1.0, shaftC: '#6a5a48', orbC1: '#ffd8a8', orbC2: '#c86a3a', glow: null, fx: 'none', crystals: false }),
    S('Bâton d’améthyste boudeuse', 'Elle brille mieux quand on la complimente.',
      { kind: 'staff', size: 1.05, shaftC: '#4a3a5e', orbC1: '#c8a8ff', orbC2: '#7a5ab8', glow: null, fx: 'none', crystals: true }),
    S('Sceptre de la cour des miracles', 'Les miracles sont facturés en fin de mois.',
      { kind: 'scepter', size: 1.05, shaftC: '#6e3a3a', orbC1: '#f6d76d', orbC2: '#b8862e', glow: null, fx: 'none', crystals: false }),
    S('Bâton des marées de lait', 'Soulève l’océan de la gamelle. Deux fois par jour.',
      { kind: 'staff', size: 1.1, shaftC: '#8a8276', orbC1: '#fffef8', orbC2: '#cbd4dc', glow: null, fx: 'none', crystals: false }),
    S('Sceptre d’argent susurrant', 'Il murmure des sorts. Et des ragots.',
      { kind: 'scepter', size: 1.1, shaftC: '#7a8494', orbC1: '#eef4fb', orbC2: '#aab6c6', glow: '#bcd6ff', fx: 'none', crystals: false }),
    S('Bâton des tempêtes en bocal', 'Le bocal fuit. C’est le principe.',
      { kind: 'staff', size: 1.15, shaftC: '#3a4a5e', orbC1: '#7fd0ff', orbC2: '#2f6fae', glow: '#9fdcff', fx: 'spark', crystals: false }),
    S('Bâton de braise courtoise', 'Il brûle tout, mais il s’excuse d’abord.',
      { kind: 'staff', size: 1.2, shaftC: '#4a2c1e', orbC1: '#ffb35c', orbC2: '#d84a1e', glow: '#ff9a4d', fx: 'flame', crystals: false }),
    S('Bâton du givre rancunier', 'Il n’oublie rien. Surtout pas vos ennemis.',
      { kind: 'staff', size: 1.2, shaftC: '#5a7a8e', orbC1: '#e8f8ff', orbC2: '#7ab8d8', glow: '#bfeaff', fx: 'ice', crystals: false }),
    S('Sceptre doré du protocole', 'Chaque sort respecte l’étiquette. Puis frappe.',
      { kind: 'scepter', size: 1.25, shaftC: '#8a6a2e', orbC1: '#f6cf5d', orbC2: '#c3922e', glow: '#ffe9a8', fx: 'none', crystals: false }),
    S('Bâton de lune décrochée', 'Quelqu’un a promis la lune. Le bâton a livré.',
      { kind: 'staff', size: 1.25, shaftC: '#4a5468', orbC1: '#eef4ff', orbC2: '#8ca4c8', glow: '#cfe8ff', fx: 'stars', crystals: false }),
    S('Sceptre solaire', 'Un lever de soleil permanent. Insupportable et magnifique.',
      { kind: 'scepter', size: 1.3, shaftC: '#9a7a2e', orbC1: '#fff6d0', orbC2: '#f0a828', glow: '#ffd76a', fx: 'spark', crystals: false }),
    S('Bâton draconique', 'L’orbe est un œil de dragon. Il cligne, parfois.',
      { kind: 'staff', size: 1.3, shaftC: '#3a1e1e', orbC1: '#ff6a4a', orbC2: '#7a1e12', glow: '#ff6a4a', fx: 'flame', crystals: true }),
    S('Bâton du Vide poli', 'Le néant, mais avec de belles finitions.',
      { kind: 'staff', size: 1.35, shaftC: '#141020', orbC1: '#6a5aa8', orbC2: '#241c48', glow: '#5a3aae', fx: 'stars', crystals: false }),
    S('Sceptre céleste', 'Approuvé par les nuages les plus sérieux.',
      { kind: 'scepter', size: 1.35, shaftC: '#8ca8c4', orbC1: '#ffffff', orbC2: '#9cc4e8', glow: '#cfe8ff', fx: 'none', crystals: false }),
    S('Bâton de l’éclipse', 'Le jour et la nuit se le prêtent à l’amiable.',
      { kind: 'staff', size: 1.4, shaftC: '#1e1a28', orbC1: '#ffd700', orbC2: '#2a2438', glow: '#ffd700', fx: 'stars', crystals: true }),
    S('Sceptre galactique', 'Trois constellations à l’intérieur. Léger vertige inclus.',
      { kind: 'scepter', size: 1.4, shaftC: '#2a2444', orbC1: '#b48cff', orbC2: '#4a3a8e', glow: '#b48cff', fx: 'stars', crystals: true }),
    S('Bâton du Noyau Stellaire', 'Cœur d’étoile, manche en chêne. Contraste assumé.',
      { kind: 'staff', size: 1.45, shaftC: '#5a4020', orbC1: '#fff6c0', orbC2: '#f08828', glow: '#ffc85a', fx: 'flame', crystals: true }),
    S('Sceptre arc-en-ciel', 'Toutes les écoles de magie. En même temps. Pourquoi choisir ?',
      { kind: 'scepter', size: 1.45, shaftC: '#f8f4ec', orbC1: '#ffffff', orbC2: '#c8c8d8', glow: '#ffffff', fx: 'rainbow', crystals: true }),
    S('LE BÂTON ABSOLU', 'La magie a lu ses conditions d’utilisation. Elle a signé.',
      { kind: 'scepter', size: 1.5, shaftC: '#fff8e0', orbC1: '#fffdf0', orbC2: '#f0c030', glow: '#ffffff', fx: 'rainbow', crystals: true }),
    // §D16-3 : tiers 25-39 — l'absolu était une étape. La magie ajoute des avenants.
    S('Bâton de la Banquise Éternelle', 'L’orbe contient un hiver qui refuse de finir.',
      { kind: 'staff', size: 1.5, shaftC: '#3a5a72', orbC1: '#eafcff', orbC2: '#5aa8d8', glow: '#dff6ff', fx: 'ice', crystals: true }),
    S('Sceptre du Magma Rancunier', 'Le volcan appelle tous les soirs pour le récupérer. Non.',
      { kind: 'scepter', size: 1.5, shaftC: '#2c1410', orbC1: '#ffb35c', orbC2: '#8a1e0a', glow: '#ff8a3a', fx: 'flame', crystals: true }),
    S('Bâton du Temps Emprunté', 'Les sorts arrivent hier. Les intérêts, demain.',
      { kind: 'staff', size: 1.5, shaftC: '#6a6252', orbC1: '#fdf6e0', orbC2: '#b0a070', glow: '#ffe9a8', fx: 'spark', crystals: false }),
    S('Sceptre du Kraken Dompté', 'Huit tentacules, huit sorts. Comptabilité limpide.',
      { kind: 'scepter', size: 1.55, shaftC: '#12303a', orbC1: '#5af0d0', orbC2: '#0e5a52', glow: '#4fe8c8', fx: 'ice', crystals: true }),
    S('Bâton des Cent Sortilèges Impayés', 'La magie fait crédit. Elle n’oublie jamais.',
      { kind: 'staff', size: 1.55, shaftC: '#4a3218', orbC1: '#ffe9a0', orbC2: '#a87e2e', glow: '#ffe9a8', fx: 'spark', crystals: false }),
    S('Sceptre du Crépuscule Administratif', 'Il tamponne les sorts ennemis : « refusé ».',
      { kind: 'scepter', size: 1.55, shaftC: '#241c34', orbC1: '#c8a8ff', orbC2: '#3a2a5e', glow: '#8f6fff', fx: 'stars', crystals: true }),
    S('Bâton des Marées d’Étoiles', 'Il soulève la Voie lactée. Deux fois par nuit.',
      { kind: 'staff', size: 1.6, shaftC: '#4a5468', orbC1: '#eef4ff', orbC2: '#8ca4c8', glow: '#cfe8ff', fx: 'stars', crystals: false }),
    S('Sceptre de l’Éclipse Permanente', 'Le jour et la nuit ont fusionné. Personne n’a signé.',
      { kind: 'scepter', size: 1.6, shaftC: '#1e1a28', orbC1: '#ffd700', orbC2: '#2a2438', glow: '#ffd700', fx: 'stars', crystals: true }),
    S('Bâton de la Supernova Apprivoisée', 'Elle explose sur commande. Elle attend la commande.',
      { kind: 'staff', size: 1.6, shaftC: '#5a4020', orbC1: '#fff6c0', orbC2: '#f08828', glow: '#ffc85a', fx: 'flame', crystals: true }),
    S('Sceptre des Dieux Distraits', 'Un panthéon entier l’a égaré. Personne n’ose réclamer.',
      { kind: 'scepter', size: 1.65, shaftC: '#8a94a4', orbC1: '#f0f6ff', orbC2: '#7a8aa0', glow: '#cfe8ff', fx: 'rainbow', crystals: true }),
    S('Bâton de l’Horizon Replié', 'Il plie la distance en quatre. Et la range.',
      { kind: 'staff', size: 1.65, shaftC: '#f8f4ec', orbC1: '#ffffff', orbC2: '#c8c8d8', glow: '#ffffff', fx: 'rainbow', crystals: false }),
    S('Sceptre de l’Aube Conceptuelle', 'Il lève le jour sur les idées. Elles plissent les yeux.',
      { kind: 'scepter', size: 1.65, shaftC: '#fff8e0', orbC1: '#fffdf0', orbC2: '#ffd700', glow: '#ffe9a8', fx: 'stars', crystals: true }),
    S('Bâton de la Réalité Négociable', 'La physique a demandé une pause. Accordée.',
      { kind: 'staff', size: 1.7, shaftC: '#2a2454', orbC1: '#b48cff', orbC2: '#4a3a8e', glow: '#b48cff', fx: 'stars', crystals: true }),
    S('Sceptre de l’Infini Raisonnable', 'Un infini bien élevé. Il s’arrête quand on le lui demande.',
      { kind: 'scepter', size: 1.7, shaftC: '#141020', orbC1: '#9cf7ff', orbC2: '#3a2a6e', glow: '#5a3aae', fx: 'rainbow', crystals: true }),
    S('L’AU-DELÀ DU BÂTON', 'La magie croyait avoir tout signé. Avenant surprise.',
      { kind: 'scepter', size: 1.75, shaftC: '#fffdf0', orbC1: '#ffffff', orbC2: '#ffd700', glow: '#ffffff', fx: 'rainbow', crystals: true }),
  ];
  GameData.STAFFS.forEach((w, i) => {
    w.tier = i;
    w.dmgMult = Math.pow(1.12, i);
    w.craftTime = forgeCraftTime(i);
    // ÉQUILIBRAGE : bois honnête (tier 1) jusqu'au T7, puis mat2/mat3, le lait et
    // l'élixir au milieu de ligne, et les ressources d'industrie (T4) au T24+.
    const c = { food: Math.round(480 * Math.pow(1.34, i)), mat1: Math.round(58 * Math.pow(1.34, i)) };
    if (i >= 8) c.mat2 = Math.round(64 * Math.pow(1.34, i - 8));
    if (i >= 12) c.mat3 = Math.round(28 * Math.pow(1.34, i - 12));
    if (i >= 16) c.milk = Math.round(8 * Math.pow(1.34, i - 16));
    if (i >= 11) c.medals = (i - 10) * 8;
    if (i >= 18) c.essence = Math.round(12 * Math.pow(1.34, i - 18));
    if (i >= 20) c.elixir = Math.max(1, Math.round(Math.pow(1.34, i - 20))); // §10
    if (i >= 24) c.parts = Math.round(12 * Math.pow(1.34, i - 24));
    if (i >= 28) c.fabric = Math.round(12 * Math.pow(1.34, i - 28));
    w.cost = c;
  });

  // ---------- §9 : LES 40 PIÈCES D'ORDONNANCE (catégorie 'explosif' — §D16-3 : 40 rangs) ----------
  // style: kind 'mortar'|'bomb'|'launcher', size, bodyC, bandC, fuseC, glow, fx
  const O = (name, desc, style) => ({ name, desc, style });
  GameData.ORDNANCE = [
    O('Pétard mouillé', 'Il a séché au soleil. Enfin, presque. Reculez quand même.',
      { kind: 'bomb', size: 0.8, bodyC: '#8a6a42', bandC: '#6a4e2e', fuseC: '#d8c8a8', glow: null, fx: 'none' }),
    O('Boîte d’allumettes tactique', 'Volée à un fumeur repenti. Le repentir se propage.',
      { kind: 'bomb', size: 0.85, bodyC: '#b05a3a', bandC: '#7a3a22', fuseC: '#e8d8b8', glow: null, fx: 'none' }),
    O('Pétard du 14 juillet', 'Récupéré après la fête. La fête continue, en fait.',
      { kind: 'bomb', size: 0.9, bodyC: '#d25543', bandC: '#913129', fuseC: '#f0e8d0', glow: null, fx: 'none' }),
    O('Mortier de fortune', 'Un tuyau de gouttière et beaucoup d’optimisme.',
      { kind: 'mortar', size: 0.95, bodyC: '#6a5a48', bandC: '#4e4034', fuseC: '#c8b088', glow: null, fx: 'none' }),
    O('Lance-marrons', 'Les marrons sont fournis par un écureuil sous contrat.',
      { kind: 'launcher', size: 1.0, bodyC: '#7a5a38', bandC: '#5a4226', fuseC: '#d8c8a8', glow: null, fx: 'none' }),
    O('Bombarde de poche', '« De poche » selon le fabricant. La poche a cédé.',
      { kind: 'mortar', size: 1.0, bodyC: '#5c4a38', bandC: '#3e3226', fuseC: '#e8d8b8', glow: null, fx: 'none' }),
    O('Mortier réglementaire', 'Enfin homologué. Par nous-mêmes, mais homologué.',
      { kind: 'mortar', size: 1.05, bodyC: '#5a5f68', bandC: '#3d4148', fuseC: '#d8dde3', glow: null, fx: 'none' }),
    O('Pétardière double', 'Deux tubes. Deux fois moins de sommations.',
      { kind: 'launcher', size: 1.1, bodyC: '#4e4034', bandC: '#2e2620', fuseC: '#c8b088', glow: null, fx: 'none' }),
    O('Lance-bombes à ressort', 'Le ressort vient d’un canapé. Le canapé venge le velours.',
      { kind: 'launcher', size: 1.1, bodyC: '#4a5648', bandC: '#2e3a2c', fuseC: '#b8c8bc', glow: null, fx: 'none' }),
    O('Mortier de siège', 'Les murs le respectent. Brièvement.',
      { kind: 'mortar', size: 1.15, bodyC: '#3e3a36', bandC: '#26221e', fuseC: '#98a2ae', glow: null, fx: 'none' }),
    O('Obusier de gouttière', 'Assemblé de nuit. Testé de jour. Regretté à midi.',
      { kind: 'mortar', size: 1.15, bodyC: '#4a4a54', bandC: '#2e2e38', fuseC: '#9aa6b4', glow: null, fx: 'none' }),
    O('Bombarde d’argent', 'Élégante. Les explosions font moins de taches, paraît-il.',
      { kind: 'mortar', size: 1.2, bodyC: '#aab6c6', bandC: '#7a8494', fuseC: '#eef4fb', glow: '#bcd6ff', fx: 'none' }),
    O('Mortier doré', 'L’ennemi voit briller la fin. C’est déjà ça.',
      { kind: 'mortar', size: 1.2, bodyC: '#c3922e', bandC: '#8a6a2e', fuseC: '#fff2c8', glow: '#ffe9a8', fx: 'none' }),
    O('Lance-bombes à répétition', 'Il répète. L’ennemi finit par comprendre.',
      { kind: 'launcher', size: 1.25, bodyC: '#5e4222', bandC: '#3e2c16', fuseC: '#f2d98a', glow: null, fx: 'none' }),
    O('Mortier au salpêtre fin', 'Salpêtre tamisé à la main. L’artisanat, le vrai.',
      { kind: 'mortar', size: 1.25, bodyC: '#6a6252', bandC: '#4a4438', fuseC: '#fdf6e0', glow: '#ffe9a8', fx: 'spark' }),
    O('Bombarde incendiaire', 'Chaque obus part vexé et arrive furieux.',
      { kind: 'mortar', size: 1.3, bodyC: '#4a2c1e', bandC: '#2c1810', fuseC: '#ffb35c', glow: '#ff9a4d', fx: 'flame' }),
    O('Mortier de givre', 'L’explosion est froide. L’accueil aussi.',
      { kind: 'mortar', size: 1.3, bodyC: '#5a7a8e', bandC: '#3a5a72', fuseC: '#e8f8ff', glow: '#bfeaff', fx: 'ice' }),
    O('Lance-comètes de campagne', 'L’espace, livré à domicile. Sans sonnette.',
      { kind: 'launcher', size: 1.35, bodyC: '#2a2444', bandC: '#1a1630', fuseC: '#b48cff', glow: '#b48cff', fx: 'stars' }),
    O('Obusier solaire', 'Un midi d’été concentré dans un tube. Crème non fournie.',
      { kind: 'mortar', size: 1.35, bodyC: '#9a7a2e', bandC: '#6a5220', fuseC: '#fff6d0', glow: '#ffd76a', fx: 'spark' }),
    O('Bombarde draconique', 'Le dragon fournit la poudre. Il facture au souffle.',
      { kind: 'mortar', size: 1.4, bodyC: '#3a1e1e', bandC: '#241010', fuseC: '#ff6a4a', glow: '#ff6a4a', fx: 'flame' }),
    O('Mortier du Vide', 'Les obus n’existent qu’à l’arrivée. Très déstabilisant.',
      { kind: 'mortar', size: 1.4, bodyC: '#141020', bandC: '#241c48', fuseC: '#6a5aa8', glow: '#5a3aae', fx: 'stars' }),
    O('Lance-éclipses de siège', 'Éteint le soleil au-dessus de la cible. Par principe.',
      { kind: 'launcher', size: 1.45, bodyC: '#241c34', bandC: '#141020', fuseC: '#ffd700', glow: '#ffd700', fx: 'stars' }),
    O('Bombarde galactique', 'Trois constellations par obus. Gaspillage assumé.',
      { kind: 'mortar', size: 1.45, bodyC: '#2a2454', bandC: '#1a1638', fuseC: '#b48cff', glow: '#b48cff', fx: 'stars' }),
    O('Mortier arc-en-ciel', 'Toutes les couleurs de la déflagration. En même temps.',
      { kind: 'mortar', size: 1.5, bodyC: '#f8f4ec', bandC: '#c8c8d8', fuseC: '#ff6ad5', glow: '#ffffff', fx: 'rainbow' }),
    O('LE DERNIER ARGUMENT', 'Quand la diplomatie a tout donné, lui prend le relais.',
      { kind: 'launcher', size: 1.55, bodyC: '#fff8e0', bandC: '#f0c030', fuseC: '#ff6ad5', glow: '#ffffff', fx: 'rainbow' }),
    // §D16-3 : tiers 25-39 — « dernier » était une estimation optimiste.
    O('Bombarde de la Banquise Éternelle', 'Chaque obus livre un hiver complet. Sans préavis.',
      { kind: 'mortar', size: 1.55, bodyC: '#3a5a72', bandC: '#243c50', fuseC: '#eafcff', glow: '#dff6ff', fx: 'ice' }),
    O('Mortier du Magma Rancunier', 'Le volcan a porté plainte pour concurrence déloyale.',
      { kind: 'mortar', size: 1.55, bodyC: '#2c1410', bandC: '#1a0c08', fuseC: '#ffb35c', glow: '#ff8a3a', fx: 'flame' }),
    O('Bombe du Temps Emprunté', 'Elle explose hier. Les débris arrivent demain.',
      { kind: 'bomb', size: 1.55, bodyC: '#6a6252', bandC: '#4a4438', fuseC: '#fdf6e0', glow: '#ffe9a8', fx: 'spark' }),
    O('Lance-krakens de poche', 'Le kraken sort, dit bonjour, et tout s’écroule.',
      { kind: 'launcher', size: 1.6, bodyC: '#12303a', bandC: '#0a2028', fuseC: '#5af0d0', glow: '#4fe8c8', fx: 'ice' }),
    O('Mortier des Cent Détonations', 'Cent détonations par obus. Le décompte est public.',
      { kind: 'mortar', size: 1.6, bodyC: '#4a3218', bandC: '#2e1e0e', fuseC: '#ffe9a0', glow: '#ffe9a8', fx: 'spark' }),
    O('Obusier du Crépuscule Administratif', 'Il archive la cible. Dossier clos. Zone aussi.',
      { kind: 'mortar', size: 1.6, bodyC: '#241c34', bandC: '#141020', fuseC: '#c8a8ff', glow: '#8f6fff', fx: 'stars' }),
    O('Bombarde des Marées Célestes', 'Elle tire à marée haute. Le ciel monte, descend, cède.',
      { kind: 'mortar', size: 1.65, bodyC: '#4a5468', bandC: '#2e3648', fuseC: '#eef4ff', glow: '#cfe8ff', fx: 'stars' }),
    O('Bombe du Noyau Stellaire', 'Un cœur d’étoile avec une mèche. Quelqu’un a validé ça.',
      { kind: 'bomb', size: 1.65, bodyC: '#9a7a2e', bandC: '#6a5220', fuseC: '#fff6c0', glow: '#ffc85a', fx: 'flame' }),
    O('Lance-supernovas de campagne', 'La campagne a été reclassée en cratère.',
      { kind: 'launcher', size: 1.65, bodyC: '#5a4020', bandC: '#3a2812', fuseC: '#fff6c0', glow: '#ffc85a', fx: 'flame' }),
    O('Mortier de l’Éclipse Permanente', 'Il éteint le soleil. Durablement, cette fois.',
      { kind: 'mortar', size: 1.7, bodyC: '#1e1a28', bandC: '#2a2438', fuseC: '#ffd700', glow: '#ffd700', fx: 'stars' }),
    O('Bombarde des Constellations Dissoutes', 'Trois ourses et un chariot, dispersés au premier tir.',
      { kind: 'mortar', size: 1.7, bodyC: '#2a2454', bandC: '#1a1638', fuseC: '#b48cff', glow: '#b48cff', fx: 'stars' }),
    O('Bombe des Dieux Distraits', 'Un dieu l’a amorcée, puis a changé de sujet.',
      { kind: 'bomb', size: 1.7, bodyC: '#8a94a4', bandC: '#5a6474', fuseC: '#f0f6ff', glow: '#cfe8ff', fx: 'rainbow' }),
    O('Mortier de l’Horizon Replié', 'La portée n’a plus de sens. La cible non plus.',
      { kind: 'mortar', size: 1.75, bodyC: '#f8f4ec', bandC: '#c8c8d8', fuseC: '#ff6ad5', glow: '#ffffff', fx: 'rainbow' }),
    O('Lance-fins-du-monde d’exercice', 'Munitions d’exercice. Les fins du monde aussi. En théorie.',
      { kind: 'launcher', size: 1.75, bodyC: '#fff8e0', bandC: '#f0c030', fuseC: '#ffd700', glow: '#ffe9a8', fx: 'stars' }),
    O('L’ARGUMENT D’APRÈS', '« Dernier », disait-on. La diplomatie a ri jaune.',
      { kind: 'launcher', size: 1.8, bodyC: '#fffdf0', bandC: '#ffd700', fuseC: '#ff6ad5', glow: '#ffffff', fx: 'rainbow' }),
  ];
  GameData.ORDNANCE.forEach((w, i) => {
    w.tier = i;
    w.dmgMult = Math.pow(1.12, i);
    w.craftTime = forgeCraftTime(i);
    // ÉQUILIBRAGE : les pétards de départ restent des pétards — tier 1 jusqu'au
    // T7, mat3 ensuite, et les rouages (T4) seulement à partir du T16.
    const c = { food: Math.round(540 * Math.pow(1.34, i)), mat1: Math.round(50 * Math.pow(1.34, i)) };
    if (i >= 8) c.mat3 = Math.round(20 * Math.pow(1.34, i - 8));
    if (i >= 24) c.parts = Math.round(8 * Math.pow(1.34, i - 24));
    if (i >= 10) c.medals = (i - 9) * 8;
    if (i >= 14) c.salpetre = Math.max(1, Math.round(3 * Math.pow(1.34, i - 14))); // §10 : hauts tiers au salpêtre
    if (i >= 20) c.essence = Math.round(12 * Math.pow(1.34, i - 20));
    w.cost = c;
  });

  // ---------- §9 : ARMURES PAR CATÉGORIE — ROBES (magie), VESTS (tir), SUITS (explosif) ----------
  // 40 tiers chacune (§D16-3). Visuel léger (liseré/teinte/casque), style volontairement simple.
  const AR = (name, desc, style) => ({ name, desc, style });
  GameData.ROBES = [
    AR('Torchon noué', 'Un torchon avec des prétentions mystiques.', { tint: '#b8a888', trim: '#8a7a5a', hood: false }),
    AR('Robe de chambre', 'Confortable. La magie déteste être à l’étroit.', { tint: '#a87a98', trim: '#7a5470', hood: false }),
    AR('Toge d’étudiant recalé', 'Recalé en théorie. Redoutable en pratique.', { tint: '#7a8494', trim: '#4a5464', hood: false }),
    AR('Robe de lin runique', 'Les runes sont brodées à l’envers. Ça marche quand même.', { tint: '#c8b888', trim: '#98885a', hood: false }),
    AR('Robe brodée d’ex-voto', 'Chaque broderie est une promesse non tenue par un dieu.', { tint: '#8a6a9a', trim: '#5a3e6a', hood: true }),
    AR('Robe d’améthyste', 'La pierre boude, mais elle protège.', { tint: '#7652bc', trim: '#4a3080', hood: true }),
    AR('Robe des marées', 'Sent l’iode et la marée basse. Amortit tout.', { tint: '#4a7a8e', trim: '#2c5060', hood: true }),
    AR('Robe d’argent susurrée', 'Cousue en murmures. Lavage à sec uniquement.', { tint: '#c8d4e2', trim: '#8a9aae', hood: true }),
    AR('Robe dorée du protocole', 'Les sorts ennemis s’excusent avant de rebondir.', { tint: '#e8c452', trim: '#a8862e', hood: true }),
    AR('Robe des tempêtes', 'Doublure en cumulonimbus. Ne pas repasser.', { tint: '#3a4a5e', trim: '#7fd0ff', hood: true }),
    AR('Robe de braise', 'Tient chaud. Tient TRÈS chaud.', { tint: '#8a2e1a', trim: '#ffb35c', hood: true }),
    AR('Robe du Vide', 'Les coups passent à travers. Vous aussi, parfois.', { tint: '#1a1428', trim: '#5a3aae', hood: true }),
    AR('Robe céleste', 'Tissée par des nuages syndiqués. Finitions impeccables.', { tint: '#cfe8ff', trim: '#8ca8c4', hood: true }),
    AR('Robe galactique', 'Contient un ciel étoilé et un léger sentiment d’infini.', { tint: '#2a2454', trim: '#b48cff', hood: true }),
    AR('LA ROBE ABSOLUE', 'La magie ennemie prend rendez-vous. On ne rappelle jamais.', { tint: '#fdf8ea', trim: '#ffd700', hood: true }),
    // §D16-3 : tiers 15-39 — l'absolu était une collection de mi-saison.
    AR('Robe de la Banquise Éternelle', 'L’hiver l’a cousue lui-même. Il ne rend pas les aiguilles.', { tint: '#bfeaff', trim: '#3a5a72', hood: true }),
    AR('Toge du Magma Rancunier', 'Le tissu couve une éruption. La couture tient. Pour l’instant.', { tint: '#8a1e0a', trim: '#ff8a3a', hood: true }),
    AR('Robe du Temps Emprunté', 'Repassée demain, portée hier. Impeccable aujourd’hui.', { tint: '#b0a070', trim: '#fdf6e0', hood: true }),
    AR('Toge du Kraken Dompté', 'Huit manches. Toutes utiles, paraît-il.', { tint: '#0e5a52', trim: '#4fe0c4', hood: true }),
    AR('Robe des Cent Sortilèges', 'Chaque fil est un sort. Le tricot fut périlleux.', { tint: '#a87e2e', trim: '#ffe9a0', hood: true }),
    AR('Toge de l’Éclipse', 'Doublure jour, envers nuit. Réversible, évidemment.', { tint: '#1e1a28', trim: '#ffd700', hood: true }),
    AR('Robe des Marées d’Étoiles', 'La traîne monte et descend avec la Voie lactée.', { tint: '#4a5468', trim: '#cfe8ff', hood: true }),
    AR('Toge du Noyau Stellaire', 'Tissée à cœur d’étoile. Lavage fortement déconseillé.', { tint: '#6a5220', trim: '#ffdf6a', hood: true }),
    AR('Robe de la Supernova Apprivoisée', 'Elle scintille vers l’extérieur. Le porteur reste entier.', { tint: '#5a4020', trim: '#ffc85a', hood: true }),
    AR('Toge des Dieux Distraits', 'Oubliée sur un nuage. Récupérée sans remords.', { tint: '#7a8aa0', trim: '#f0f6ff', hood: true }),
    AR('Robe du Crépuscule Administratif', 'Les sorts ennemis remplissent un formulaire. Puis renoncent.', { tint: '#241c34', trim: '#c8a8ff', hood: true }),
    AR('Toge de l’Horizon Replié', 'L’ourlet touche les deux bouts du monde.', { tint: '#c8c8d8', trim: '#ffffff', hood: true }),
    AR('Robe de l’Aube Conceptuelle', 'Un lever de soleil portable. Aveuglant en réunion.', { tint: '#f0c030', trim: '#fffdf0', hood: true }),
    AR('Toge de la Réalité Négociable', 'Les lois de la magie ont accepté une clause de sortie.', { tint: '#4a3a8e', trim: '#b48cff', hood: true }),
    AR('Robe du Silence Feutré', 'Aucun froissement. Les malédictions ne la trouvent pas.', { tint: '#2e3648', trim: '#8ca4c8', hood: true }),
    AR('Toge des Constellations Dissoutes', 'Trois ourses fondues dans la doublure. Confort ursin.', { tint: '#1a1638', trim: '#b48cff', hood: true }),
    AR('Robe du Zénith Boudeur', 'Midi permanent sous la capuche. Ombre interdite.', { tint: '#9a7a2e', trim: '#fff6c0', hood: true }),
    AR('Toge de l’Antimatière Repassée', 'Pli impeccable. Ne pas retourner.', { tint: '#141020', trim: '#9cf7ff', hood: true }),
    AR('Robe des Probabilités Favorables', 'Les sorts ennemis ratent. Statistiquement. Toujours.', { tint: '#3a2a6e', trim: '#7fd0ff', hood: true }),
    AR('Toge de l’Éternité Provisoire', 'Infroissable jusqu’à nouvel ordre.', { tint: '#8a8276', trim: '#fffef8', hood: true }),
    AR('Robe du Big Bang Domestiqué', 'Le début de l’univers, version peignoir.', { tint: '#2a2444', trim: '#ffdf6a', hood: true }),
    AR('Toge de l’Infini Raisonnable', 'Une traîne sans fin, mais qui range sa chambre.', { tint: '#5a3aae', trim: '#cfe8ff', hood: true }),
    AR('Robe du Concept de Robe', 'L’idée pure du vêtement. Étonnamment couvrante.', { tint: '#fdf8ea', trim: '#c8d4e2', hood: true }),
    AR('L’AVANT-DERNIÈRE ROBE', 'Le titre dit vrai. C’est louche.', { tint: '#f4e8c8', trim: '#f0c030', hood: true }),
    AR('L’AU-DELÀ DE LA ROBE', 'La magie ennemie a rendu son tablier. Et sa baguette.', { tint: '#fffdf0', trim: '#ffd700', hood: true }),
  ];
  GameData.VESTS = [
    AR('Gilet de pêcheur', 'Plein de poches. Toutes vides. Question de style.', { tint: '#8a9a6a', trim: '#5a6a42', helm: false }),
    AR('Veste matelassée', 'Matelassée avec de vieilles chaussettes. Chut.', { tint: '#b98a5a', trim: '#8a5f34', helm: false }),
    AR('Gilet de cuir clouté', 'Les clous ne servent à rien. Ils intimident.', { tint: '#6a4e36', trim: '#3e2c1a', helm: false }),
    AR('Veste de braconnier', 'Doublure discrète, conscience aussi.', { tint: '#5a6a4a', trim: '#38442c', helm: false }),
    AR('Gilet renforcé', 'Renforcé avec quoi ? Ne posez pas la question.', { tint: '#7a8494', trim: '#4a5464', helm: true }),
    AR('Veste de chasse convenable', 'Enfin du matériel sérieux pour tireurs sérieux.', { tint: '#4e5e48', trim: '#2c3a28', helm: true }),
    AR('Gilet d’argent', 'Les flèches ennemies se voient dedans. Et hésitent.', { tint: '#c8d4e2', trim: '#8a9aae', helm: true }),
    AR('Veste dorée', 'Voyante ? Oui. Trouée ? Jamais.', { tint: '#e8c452', trim: '#a8862e', helm: true }),
    AR('Gilet des tempêtes', 'Chargé en statique. Les poignées de main sont mémorables.', { tint: '#3a4a5e', trim: '#7fd0ff', helm: true }),
    AR('Veste de givre', 'Les impacts gèlent sur place. Le tireur aussi, un peu.', { tint: '#5a7a8e', trim: '#bfeaff', helm: true }),
    AR('Gilet draconique', 'Écailles de dragon. Le dragon a signé une décharge.', { tint: '#8a2e1a', trim: '#ff6a4a', helm: true }),
    AR('Veste du Vide', 'Les projectiles arrivent hier. Vous étiez déjà parti.', { tint: '#1a1428', trim: '#5a3aae', helm: true }),
    AR('Gilet céleste', 'Cousu de plumes d’anges administratifs. Très réglementaire.', { tint: '#cfe8ff', trim: '#8ca8c4', helm: true }),
    AR('Veste galactique', 'Trois constellations et zéro point faible.', { tint: '#2a2454', trim: '#b48cff', helm: true }),
    AR('LE GILET ABSOLU', 'La balistique ennemie a déposé le bilan.', { tint: '#fdf8ea', trim: '#ffd700', helm: true }),
    // §D16-3 : tiers 15-39 — le bilan a été racheté. Les tirs reprennent. Nous aussi.
    AR('Gilet de la Banquise Éternelle', 'Les flèches gèlent en vol et s’excusent par écrit.', { tint: '#bfeaff', trim: '#3a5a72', helm: true }),
    AR('Veste du Magma Rancunier', 'Les projectiles fondent avant d’arriver. Le tailleur jubile.', { tint: '#8a1e0a', trim: '#ff8a3a', helm: true }),
    AR('Gilet du Temps Emprunté', 'L’impact a eu lieu mardi dernier. Personne n’a rien senti.', { tint: '#b0a070', trim: '#fdf6e0', helm: true }),
    AR('Veste du Kraken Dompté', 'Les tentacules attrapent les flèches au vol. Par jeu.', { tint: '#0e5a52', trim: '#4fe0c4', helm: true }),
    AR('Gilet des Cent Carreaux', 'Cent carreaux plantés dedans. Aucun n’a traversé. Trophées.', { tint: '#a87e2e', trim: '#ffe9a0', helm: true }),
    AR('Veste de l’Éclipse', 'Le tireur vise le jour. La veste est déjà la nuit.', { tint: '#1e1a28', trim: '#ffd700', helm: true }),
    AR('Gilet des Marées Célestes', 'Les salves suivent la marée. Elles se retirent, penaudes.', { tint: '#4a5468', trim: '#cfe8ff', helm: true }),
    AR('Veste du Noyau Stellaire', 'Doublure en cœur d’étoile. Ne pas repasser. Jamais.', { tint: '#6a5220', trim: '#ffdf6a', helm: true }),
    AR('Gilet de la Supernova Apprivoisée', 'Renvoie l’éclat de l’impact à l’expéditeur. Amplifié.', { tint: '#5a4020', trim: '#ffc85a', helm: true }),
    AR('Veste des Dieux Distraits', 'Taillée pour un dieu. Il flottait dedans, de toute façon.', { tint: '#7a8aa0', trim: '#f0f6ff', helm: true }),
    AR('Gilet du Crépuscule Administratif', 'Chaque impact est déclaré irrecevable. Formulaire fourni.', { tint: '#241c34', trim: '#c8a8ff', helm: true }),
    AR('Veste de l’Horizon Replié', 'Les tirs longue portée arrivent ailleurs. Loin. Tant mieux.', { tint: '#c8c8d8', trim: '#ffffff', helm: true }),
    AR('Gilet de l’Aube Conceptuelle', 'Les tireurs sont éblouis par une idée de soleil.', { tint: '#f0c030', trim: '#fffdf0', helm: true }),
    AR('Veste de la Réalité Négociable', 'La balistique a accepté un compromis défavorable.', { tint: '#4a3a8e', trim: '#b48cff', helm: true }),
    AR('Gilet du Silence Balistique', 'Les projectiles n’osent plus faire de bruit. Ni de dégâts.', { tint: '#2e3648', trim: '#8ca4c8', helm: true }),
    AR('Veste des Constellations Dissoutes', 'Un ciel entier fondu dans la trame. Pare tout, brille trop.', { tint: '#1a1638', trim: '#b48cff', helm: true }),
    AR('Gilet du Zénith Boudeur', 'Midi tape dessus en premier. Il fatigue avant.', { tint: '#9a7a2e', trim: '#fff6c0', helm: true }),
    AR('Veste de l’Antimatière Ajustée', 'Coupe cintrée. Ne pas serrer la main de l’envers.', { tint: '#141020', trim: '#9cf7ff', helm: true }),
    AR('Gilet des Probabilités Favorables', 'Chaque tir ennemi devient statistiquement regrettable.', { tint: '#3a2a6e', trim: '#7fd0ff', helm: true }),
    AR('Veste de l’Éternité Provisoire', 'Increvable jusqu’à nouvel ordre. L’ordre tarde.', { tint: '#8a8276', trim: '#fffef8', helm: true }),
    AR('Gilet du Big Bang Domestiqué', 'Le début de l’univers, en coupe droite.', { tint: '#2a2444', trim: '#ffdf6a', helm: true }),
    AR('Veste de l’Infini Raisonnable', 'Poches sans fond, mais rangées.', { tint: '#5a3aae', trim: '#cfe8ff', helm: true }),
    AR('Gilet du Concept de Gilet', 'L’idée pure du pare-flèches. Les flèches y croient.', { tint: '#fdf8ea', trim: '#c8d4e2', helm: true }),
    AR('L’AVANT-DERNIER GILET', 'Honnête sur l’étiquette. Inquiétant sur le principe.', { tint: '#f4e8c8', trim: '#f0c030', helm: true }),
    AR('L’AU-DELÀ DU GILET', 'La balistique ennemie s’est reconvertie dans la poterie.', { tint: '#fffdf0', trim: '#ffd700', helm: true }),
  ];
  GameData.SUITS = [
    AR('Tablier roussi', 'Il a déjà tout vu exploser. Il en redemande.', { tint: '#8a6a52', trim: '#5a4232', helm: false }),
    AR('Combinaison de chantier', 'Volée sur un chantier. Le chantier a explosé depuis.', { tint: '#c98a2e', trim: '#8a5e1e', helm: false }),
    AR('Tenue ignifugée (un peu)', '« Un peu », c’est le terme technique.', { tint: '#8a8276', trim: '#5a544a', helm: true }),
    AR('Combinaison matelassée', 'On rebondit sur les explosions. Littéralement.', { tint: '#7a6a5a', trim: '#4e4234', helm: true }),
    AR('Tenue de démineur amateur', 'Amateur, mais passionné. Surtout passionné.', { tint: '#5a6a4a', trim: '#38442c', helm: true }),
    AR('Combinaison blindée', 'Le blindage vient d’une vieille baignoire. Solide, la baignoire.', { tint: '#5a5f68', trim: '#3d4148', helm: true }),
    AR('Tenue d’argent', 'Reflète les explosions. Élégamment.', { tint: '#c8d4e2', trim: '#8a9aae', helm: true }),
    AR('Combinaison dorée', 'Boum ? Bling. Boum ? Bling. Un dialogue sain.', { tint: '#e8c452', trim: '#a8862e', helm: true }),
    AR('Tenue des tempêtes', 'L’orage intégré disperse les éclats. Et les collègues.', { tint: '#3a4a5e', trim: '#7fd0ff', helm: true }),
    AR('Combinaison de givre', 'Refroidit les explosions. Elles détestent ça.', { tint: '#5a7a8e', trim: '#bfeaff', helm: true }),
    AR('Tenue draconique', 'Le dragon dort dedans, parfois. Prévenir avant l’assaut.', { tint: '#8a2e1a', trim: '#ff6a4a', helm: true }),
    AR('Combinaison du Vide', 'L’explosion a lieu. Ailleurs. Pour quelqu’un d’autre.', { tint: '#1a1428', trim: '#5a3aae', helm: true }),
    AR('Tenue céleste', 'Les éclats remontent au ciel. Le ciel trie.', { tint: '#cfe8ff', trim: '#8ca8c4', helm: true }),
    AR('Combinaison galactique', 'Testée dans une supernova. Note : 5 étoiles.', { tint: '#2a2454', trim: '#b48cff', helm: true }),
    AR('LA COMBINAISON ABSOLUE', 'Le souffle demande pardon avant d’arriver.', { tint: '#fdf8ea', trim: '#ffd700', helm: true }),
    // §D16-3 : tiers 15-39 — les explosions ont fait appel. L'atelier a suivi.
    AR('Tenue de la Banquise Éternelle', 'Les explosions gèlent en pleine expansion. Sculptures gratuites.', { tint: '#bfeaff', trim: '#3a5a72', helm: true }),
    AR('Combinaison du Magma Rancunier', 'Elle a vu pire. Elle A ÉTÉ pire.', { tint: '#8a1e0a', trim: '#ff8a3a', helm: true }),
    AR('Tenue du Temps Emprunté', 'Le souffle arrive avant la bombe. La tenue attend les deux.', { tint: '#b0a070', trim: '#fdf6e0', helm: true }),
    AR('Combinaison du Kraken Dompté', 'Étanche aux explosions ET aux marées. Le kraken a insisté.', { tint: '#0e5a52', trim: '#4fe0c4', helm: true }),
    AR('Tenue des Cent Détonations', 'Cent détonations encaissées. La suivante est attendue de pied ferme.', { tint: '#a87e2e', trim: '#ffe9a0', helm: true }),
    AR('Combinaison de l’Éclipse', 'Le flash de l’explosion trouve porte close.', { tint: '#1e1a28', trim: '#ffd700', helm: true }),
    AR('Tenue des Marées Célestes', 'Les ondes de choc refluent poliment.', { tint: '#4a5468', trim: '#cfe8ff', helm: true }),
    AR('Combinaison du Noyau Stellaire', 'Testée au centre d’une étoile. L’étoile s’en remet.', { tint: '#6a5220', trim: '#ffdf6a', helm: true }),
    AR('Tenue de la Supernova Apprivoisée', 'La plus grosse explosion connue lui sert de doudoune.', { tint: '#5a4020', trim: '#ffc85a', helm: true }),
    AR('Combinaison des Dieux Distraits', 'Un dieu artificier l’a laissée au vestiaire. Définitivement.', { tint: '#7a8aa0', trim: '#f0f6ff', helm: true }),
    AR('Tenue du Crépuscule Administratif', 'Chaque explosion doit fournir trois justificatifs. Aucune n’y arrive.', { tint: '#241c34', trim: '#c8a8ff', helm: true }),
    AR('Combinaison de l’Horizon Replié', 'Le souffle part ailleurs. L’ailleurs proteste.', { tint: '#c8c8d8', trim: '#ffffff', helm: true }),
    AR('Tenue de l’Aube Conceptuelle', 'Chaque déflagration devient un simple lever de soleil.', { tint: '#f0c030', trim: '#fffdf0', helm: true }),
    AR('Combinaison de la Réalité Négociable', 'Le rayon de l’explosion est revu à la baisse. Contractuellement.', { tint: '#4a3a8e', trim: '#b48cff', helm: true }),
    AR('Tenue du Silence Assourdissant', 'Les explosions ont lieu. On ne les entend pas. Elles boudent.', { tint: '#2e3648', trim: '#8ca4c8', helm: true }),
    AR('Combinaison des Constellations Dissoutes', 'Un ciel fondu dans le blindage. Zéro point faible, trois ourses.', { tint: '#1a1638', trim: '#b48cff', helm: true }),
    AR('Tenue du Zénith Boudeur', 'Le soleil de midi absorbe le flash. Il connaît le métier.', { tint: '#9a7a2e', trim: '#fff6c0', helm: true }),
    AR('Combinaison de l’Antimatière Étanche', 'Étanche dans les deux sens. C’est le minimum.', { tint: '#141020', trim: '#9cf7ff', helm: true }),
    AR('Tenue des Probabilités Favorables', 'L’éclat qui devait toucher n’existe statistiquement pas.', { tint: '#3a2a6e', trim: '#7fd0ff', helm: true }),
    AR('Combinaison de l’Éternité Provisoire', 'Garantie contre la fin du monde. Voir conditions.', { tint: '#8a8276', trim: '#fffef8', helm: true }),
    AR('Tenue du Big Bang Domestiqué', 'La plus grande explosion de l’histoire lui obéit au doigt.', { tint: '#2a2444', trim: '#ffdf6a', helm: true }),
    AR('Combinaison de l’Infini Raisonnable', 'Un blindage sans limite, mais qui dit bonjour.', { tint: '#5a3aae', trim: '#cfe8ff', helm: true }),
    AR('Tenue du Concept de Tenue', 'L’idée pure de la protection anti-souffle. Le souffle abdique.', { tint: '#fdf8ea', trim: '#c8d4e2', helm: true }),
    AR('L’AVANT-DERNIÈRE COMBINAISON', 'L’étiquette est honnête. L’expérience dit : attendez la suite.', { tint: '#f4e8c8', trim: '#f0c030', helm: true }),
    AR('L’AU-DELÀ DE LA COMBINAISON', 'Le souffle demande pardon, un autographe, et s’en va.', { tint: '#fffdf0', trim: '#ffd700', helm: true }),
  ];
  GameData.ROBES.forEach((a, i) => {
    a.tier = i; a.hpMult = Math.pow(1.13, i); a.craftTime = forgeCraftTime(i);
    const c = { food: Math.round(560 * Math.pow(1.38, i)), mat1: Math.round(56 * Math.pow(1.36, i)) };
    if (i >= 8) c.mat2 = Math.round(40 * Math.pow(1.36, i - 8));
    if (i >= 17) c.essence = Math.round(10 * Math.pow(1.3, i - 17));
    if (i >= 8) c.medals = (i - 7) * 12;
    if (i >= 18) c.elixir = Math.max(1, Math.round(2 * Math.pow(1.25, i - 10))); // §10
    a.cost = c;
  });
  GameData.VESTS.forEach((a, i) => {
    a.tier = i; a.hpMult = Math.pow(1.13, i); a.craftTime = forgeCraftTime(i);
    const c = { food: Math.round(560 * Math.pow(1.38, i)), mat1: Math.round(60 * Math.pow(1.36, i)) };
    if (i >= 8) c.mat2 = Math.round(34 * Math.pow(1.36, i - 8));
    if (i >= 24) c.fabric = Math.round(10 * Math.pow(1.3, i - 24));
    if (i >= 8) c.medals = (i - 7) * 12;
    if (i >= 26) c.parts = Math.round(10 * Math.pow(1.3, i - 26));
    a.cost = c;
  });
  GameData.SUITS.forEach((a, i) => {
    a.tier = i; a.hpMult = Math.pow(1.13, i); a.craftTime = forgeCraftTime(i);
    const c = { food: Math.round(610 * Math.pow(1.38, i)), mat1: Math.round(62 * Math.pow(1.36, i)) };
    if (i >= 8) c.mat3 = Math.round(30 * Math.pow(1.36, i - 8));
    if (i >= 24) c.parts = Math.round(10 * Math.pow(1.3, i - 24));
    if (i >= 8) c.medals = (i - 7) * 12;
    if (i >= 10) c.salpetre = Math.max(1, Math.round(2 * Math.pow(1.25, i - 10))); // §10
    a.cost = c;
  });

  // ============================================================
  // PROGRESSION : ressources RAFFINÉES (Cuisine) sur les hauts tiers de forge.
  // Les paliers sont alignés sur la frise de déblocage des raffinages :
  //   T2 (palier 3, ~j5)   → tiers 12-27 des lignes
  //   T3 (palier 9, ~j30)  → tiers 28-35
  //   T4 (palier 16, ~j65) → tiers 36+
  // Sinks additionnels (les coûts de base restent) — calibrés en dizaines
  // d'unités, soit ~10-30 min de raffinage au jour de disponibilité.
  // ============================================================
  (function () {
    const LINES = [GameData.WEAPONS, GameData.BLADES, GameData.RANGED, GameData.STAFFS,
      GameData.ORDNANCE, GameData.ARMORS, GameData.SHIELDS, GameData.ROBES,
      GameData.VESTS, GameData.SUITS];
    for (const arr of LINES) {
      if (!arr) continue;
      for (const it of arr) {
        const i = it.tier;
        if (!it.cost || i == null) continue;
        if (i >= 12 && i < 28) {
          it.cost.mat1_t2 = Math.max(1, Math.round(10 * Math.pow(1.25, i - 12)));
          it.cost.mat3_t2 = Math.max(1, Math.round(6 * Math.pow(1.25, i - 12)));
        } else if (i >= 28 && i < 36) {
          it.cost.mat1_t3 = Math.max(1, Math.round(8 * Math.pow(1.25, i - 28)));
          it.cost.mat3_t3 = Math.max(1, Math.round(5 * Math.pow(1.25, i - 28)));
        } else if (i >= 36) {
          it.cost.mat1_t4 = Math.max(1, Math.round(6 * Math.pow(1.25, i - 36)));
          it.cost.mat3_t4 = Math.max(1, Math.round(4 * Math.pow(1.25, i - 36)));
        }
      }
    }
    // LE DUVET DES DERNIÈRES ARMURES — matériau 2 raffiné au tier 4.
    //
    // La Cuisine raffine HUIT bases sur trois tiers, mais la Forge n'achetait
    // que les raffinés du matériau 1 et du matériau 3 : le raffinage du
    // matériau 2 (plumes / poils) montait jusqu'au tier 4 sans qu'aucun
    // consommateur ne l'attende. Or c'est LA matière des armures — celle dont
    // les unités sont faites. Elle entre donc dans les cinq lignes d'armures,
    // et seulement là : une armure de fin de partie se rembourre, une lame non.
    // Le palier 36 est celui du raffinage T4 (déjà en place pour mat1/mat3) —
    // on n'avance sur la frise de déblocage d'aucun cran.
    const ARMURES = [GameData.ARMORS, GameData.SHIELDS, GameData.ROBES,
      GameData.VESTS, GameData.SUITS];
    for (const arr of ARMURES) {
      if (!arr) continue;
      for (const it of arr) {
        if (!it.cost || it.tier == null || it.tier < 36) continue;
        it.cost.mat2_t4 = Math.max(1, Math.round(3 * Math.pow(1.25, it.tier - 36)));
      }
    }
  })();



  // ============================================================
  // LA MINE — creuser, détecter, descendre
  //
  // La mine est une grille de BLOCS empilée par PROFONDEUR. Chaque niveau cache
  // des FILONS d'un des 8 minerais ; plus on descend, plus ils sont rares et
  // riches. On ne voit pas la roche : il faut des SONOMÈTRES pour deviner ce
  // qu'il y a autour de ce qu'on a déjà creusé. On choisit un filon, les mineurs
  // cassent les blocs un par un jusqu'à lui, puis l'extraient jusqu'à épuisement.
  // Descendre demande de l'ÉQUIPEMENT : casques, lampes, soutiens. Chaque pièce
  // s'améliore avec les ressources du jeu et ouvre un cran de profondeur.
  // ============================================================
  GameData.MINE = {
    // (VAGUE MINE) VINGT-ET-UNE COLONNES. À neuf, un niveau tenait deux filons
    // et le choix se résumait à « gauche ou droite ». Large, la galerie devient
    // une vraie carte : on choisit sa veine, on en garde en réserve, et
    // plusieurs mineurs travaillent le même étage sans se marcher dessus.
    cols: 21,           // largeur d'un niveau, en blocs
    maxDepth: 120,      // mètres (0 = juste sous le carreau)
    // PERCER PREND DU TEMPS : un bloc, c’est des minutes, pas des secondes.
    blockHp: d => Math.round(90 * Math.pow(1.18, Math.max(0, d))),
    // chaque bloc STÉRILE percé consomme des étais (la galerie doit tenir)
    etaiPerBlock: d => 1 + Math.floor(Math.max(0, d) / 3),
    veinChance: 0.22,   // part de blocs qui cachent un filon
    // UN FILON DURE 24 H et rend beaucoup : le stock est calibré pour s’épuiser
    // en une journée avec UN mineur ; en mettre plus le vide plus vite.
    veinHours: 24,
    veinStock: d => Math.round(2600 * Math.pow(1.28, Math.max(0, d))),
    // Ce qu’on peut trouver À CETTE PROFONDEUR, avec son poids de tirage. Un
    // minerai apparaît à sa profondeur, devient FRÉQUENT deux crans plus bas,
    // puis se raréfie quand le suivant prend le relais. On ne voit donc jamais
    // d’argent au premier mètre : la progression est dans la roche.
    mineralsAt: function (d) {
      return GameData.MINERALS.filter(m => m.depth <= d);
    },
    veinWeights: function (d) {
      const out = [];
      for (const m of GameData.MINERALS) {
        if (m.depth > d) continue;
        const age = d - m.depth;           // depuis combien de mètres il existe
        // monte vite (0→2 m), plafonne, puis s’efface au profit du suivant
        const w = age <= 2 ? 1 + age : Math.max(0.15, 3 * Math.pow(0.72, age - 2));
        out.push({ m, w });
      }
      return out;
    },
    // ---- L'ÉQUIPEMENT : quatre pièces, QUATRE effets DIFFÉRENTS ----
    // Chacune répond à une question distincte : jusqu'où, qu'y a-t-il, à quelle
    // vitesse on perce, à quelle vitesse on remonte. Aucune ne fait doublon.
    gear: {
      sonar: {
        id: 'sonar', icon: '', name: 'Sonomètres', max: 120, effect: 'profondeur',
        desc: 'Ils sondent la roche sous vos pieds. Un cran = un mètre de plus.',
        // JUSQU’OÙ : UN mètre par cran, 120 crans. C’est la longue échelle de la
        // Forge — on descend toute la partie, un mètre à la fois.
        depth: lvl => Math.max(1, lvl | 0),
        // et il faut une FORGE à la hauteur : un niveau de bâtiment tous les 14 crans
        forgeReq: lvl => 1 + Math.floor(Math.max(0, lvl) / 14),
        // (VAGUE MINE) DESCENDRE COÛTE BEAUCOUP PLUS CHER. Un étage large rend
        // plus de deux fois plus de filons qu'avant : si descendre restait bon
        // marché, on plongerait sans jamais exploiter ce qu'on a sous les pieds.
        // Le mètre devient donc l'achat lourd de la Mine — et rester à creuser
        // large, la façon normale de jouer.
        cost: lvl => {
          const c = { food: Math.round(2400 * Math.pow(1.33, lvl)), mat1: Math.round(120 * Math.pow(1.30, lvl)) };
          if (lvl >= 8) c.mat2 = Math.round(70 * Math.pow(1.27, lvl - 8));
          if (lvl >= 22) c.mat3 = Math.round(55 * Math.pow(1.25, lvl - 22));
          if (lvl >= 44) c.parts = Math.round(40 * Math.pow(1.23, lvl - 44));
          if (lvl >= 66) c.fabric = Math.round(32 * Math.pow(1.22, lvl - 66));
          return c;
        },
      },
      lampe: {
        id: 'lampe', icon: '', name: 'Lampes de front', max: 40, effect: 'repérage',
        desc: 'Elles éclairent la roche EN DESSOUS du fond de taille : on repère les filons AVANT d’y aller.',
        // QU’Y A-T-IL PLUS BAS : mètres visibles sous le plus profond bloc creusé.
        // Sur 120 mètres, voir loin devant reste utile jusqu’au dernier cran.
        range: lvl => Math.max(1, lvl | 0),
        cost: lvl => {
          const c = { food: Math.round(900 * Math.pow(1.28, lvl)), mat1: Math.round(40 * Math.pow(1.25, lvl)) };
          if (lvl >= 6) c.mat3 = Math.round(20 * Math.pow(1.22, lvl - 6));
          if (lvl >= 16) c.essence = Math.round(12 * Math.pow(1.2, lvl - 16));
          return c;
        },
      },
      casque: {
        id: 'casque', icon: '', name: 'Casques renforcés', max: 40, effect: 'percement',
        desc: 'Casqué, on tape plus fort et plus longtemps. Vitesse de percement des blocs.',
        // À QUELLE VITESSE ON PERCE : +25 % par niveau
        speed: lvl => 1 + 0.18 * Math.max(0, (lvl | 0) - 1),
        cost: lvl => {
          const c = { food: Math.round(950 * Math.pow(1.30, lvl)), mat1: Math.round(46 * Math.pow(1.26, lvl)) };
          if (lvl >= 6) c.mat2 = Math.round(22 * Math.pow(1.22, lvl - 6));
          if (lvl >= 18) c.parts = Math.round(12 * Math.pow(1.2, lvl - 18));
          return c;
        },
      },
      wagon: {
        id: 'wagon', icon: '', name: 'Wagonnets', max: 40, effect: 'extraction',
        desc: 'Des bennes plus grandes, des rails mieux posés : le filon rend plus vite.',
        // À QUELLE VITESSE ON REMONTE : +30 % d'extraction par niveau
        speed: lvl => 1 + 0.22 * Math.max(0, (lvl | 0) - 1),
        cost: lvl => {
          const c = { food: Math.round(1050 * Math.pow(1.30, lvl)), mat1: Math.round(54 * Math.pow(1.26, lvl)) };
          if (lvl >= 6) c.mat3 = Math.round(24 * Math.pow(1.22, lvl - 6));
          if (lvl >= 20) c.fabric = Math.round(10 * Math.pow(1.2, lvl - 20));
          return c;
        },
      },
    },
    gearOrder: ['sonar', 'lampe', 'casque', 'wagon'],
    // ---- LES ÉTAIS : toujours payés dans les DEUX PREMIÈRES ressources, et de
    // plus en plus cher. Bon marché au départ : on doit pouvoir commencer.
    etaiPack: 10,
    etaiCost: n => ({
      food: Math.round(260 * Math.pow(1.11, Math.max(0, n))),
      mat1: Math.round(14 * Math.pow(1.11, Math.max(0, n))),
    }),
    // ---- MINEURS ET FONDERIES : un de chaque au début, on en achète d’autres ----
    // Les MINEURS et les FONDERIES sont les jalons longs de la Forge : un au
    // départ, puis un cap d’ANCIENNETÉ de partie à franchir — deux semaines, un
    // mois, deux mois. Rien ne s’achète en avance, même les poches pleines.
    // (VAGUE MINEURS) L'ÉQUIPE NE S'ACHÈTE PAS, ELLE SE MÉRITE.
    //
    // Il y avait trois verrous pour un seul mineur : un coût qui triplait, un
    // niveau de mine exigé, et un jalon d'ancienneté de partie en jours. Trois
    // façons de dire non pour quelque chose que le bâtiment donnait déjà.
    // Reste la seule qui se comprenne : UN mineur au niveau 1, un de plus
    // régulièrement, SIX au niveau 30.
    maxDiggers: 6,
    diggersOfferts: function (lvl) {
      const abs = (GameData.BLD_ABS_MAX && GameData.BLD_ABS_MAX.mine) || 30;
      const max = GameData.MINE.maxDiggers;
      return Math.max(1, Math.min(max,
        1 + Math.floor((Math.max(1, lvl | 0) - 1) * (max - 1) / Math.max(1, abs - 1))));
    },
    // le NIVEAU de mine qui ouvre le mineur n° k (2..6) — pour l'annoncer
    // AVANT de l'avoir : « il vous manque un niveau », pas « c'est plein ».
    diggerAt: function (k) {
      const abs = (GameData.BLD_ABS_MAX && GameData.BLD_ABS_MAX.mine) || 30;
      const max = GameData.MINE.maxDiggers;
      if (k <= 1) return 1;
      if (k > max) return null;
      return 1 + Math.ceil((k - 1) * Math.max(1, abs - 1) / (max - 1));
    },
    // (VAGUE FONDERIE) LES CREUSETS VIENNENT DU NIVEAU DE LA FONDERIE.
    // Même règle que les mineurs : un au départ, un de plus à chaque palier,
    // QUATRE au niveau 30. Rien à acheter, rien à attendre en jours de partie.
    maxFoundries: 4,
    foundriesOffertes: function (lvl) {
      const abs = (GameData.BLD_ABS_MAX && GameData.BLD_ABS_MAX.fonderie) || 30;
      const max = GameData.MINE.maxFoundries;
      return Math.max(1, Math.min(max,
        1 + Math.floor((Math.max(1, lvl | 0) - 1) * (max - 1) / Math.max(1, abs - 1))));
    },
    // le niveau qui ouvre le creuset n° k — pour l'annoncer d'avance
    foundryAt: function (k) {
      const abs = (GameData.BLD_ABS_MAX && GameData.BLD_ABS_MAX.fonderie) || 30;
      const max = GameData.MINE.maxFoundries;
      if (k <= 1) return 1;
      if (k > max) return null;
      return 1 + Math.ceil((k - 1) * Math.max(1, abs - 1) / (max - 1));
    },
    // ---- LA FONDERIE : on coule le minerai choisi en lingots ----
    // `in` = ce qu'un cycle prend en plus du minerai ; `mineralIn` = unités de
    // minerai par coulée. Le nombre de lingots sortis = `yield` du minerai.
    // La coulée rend le lingot du minerai fondu ET celui du cran en dessous.
    foundry: { in: { food: 220 }, mineralIn: 8, time: 30 },
    // rendement d’une coulée : { lingot: quantité }
    pourYield: function (id) {
      const m = GameData.mineralOf(id);
      const out = {};
      out[m.ingot] = Math.max(1, Math.round(m.yield * 0.6));
      if (m.prev) out[GameData.mineralOf(m.prev).ingot] = Math.max(1, Math.round(m.yield * 0.5));
      return out;
    },
  };

  // ÉQUILIBRAGE : chaque tier de chaque ligne réclame des LINGOTS. Le tier 0 reste
  // gratuit en métal (on part d'un bout de bois), puis la demande grimpe doucement —
  // c'est le nouveau rythme de la Forge, et la raison d'être de la Mine.
  (function () {
    const LINES = [GameData.WEAPONS, GameData.BLADES, GameData.RANGED, GameData.STAFFS,
      GameData.ORDNANCE, GameData.ARMORS, GameData.SHIELDS, GameData.ROBES,
      GameData.VESTS, GameData.SUITS];
    for (const arr of LINES) {
      if (!arr) continue;
      for (const it of arr) {
        // ÉQUILIBRAGE : les TROIS PREMIERS tiers ne coûtent QUE des ressources
        // classiques. On démarre le jeu avec la seule enclume à comprendre ; la
        // Mine (et ses lingots) n’entre en scène qu’au tier 4.
        if (!it.cost || it.tier == null || it.tier < 4) continue;
        // le palier de lingot suit le tier : on ne forge pas une épée d’astral
        // avec du cuivre, et le cuivre suffit pour une lance de silex.
        const i = it.tier;
        const band = i <= 7 ? 0 : i <= 15 ? 1 : i <= 21 ? 2 : i <= 27 ? 3 : i <= 31 ? 4 : i <= 35 ? 5 : i <= 38 ? 6 : 7;
        it.cost[GameData.MINERALS[band].ingot] = Math.max(1, Math.round(2 * Math.pow(1.13, i - 4 - band * 4)));
      }
    }
  })();
