/* ============================================================
   GRIFFES & PLUMES — data-units.js (2/6)
   Unités : ordre, catégories, stats de base, évolutions, pouvoirs.
   Suite de data-core.js (même GameData, portée partagée entre scripts).
   ============================================================ */
"use strict";

  // ---------- types d'unités ----------
  // §D17-2 : targier (T2) près des corps à corps de base, rempart (T4) près des spécialistes
  GameData.UNIT_ORDER = ['eclaireur', 'lancier', 'targier', 'costaud', 'fronde', 'traqueur', 'mage', 'sapeur', 'essaim', 'rempart', 'aura', 'assassin', 'barde', 'artilleur', 'heros',
    'soigneur', 'entraveur', 'invocateur', 'porteur', 'ingenieur', 'espion', 'chronarque',
    'jeune_force', 'jeune_agile', 'jeune_magie', 'jeune_poudre',
    ];  // (l'unité « worker » a été RETIRÉE — refonte P4 : l'affectation est un % de l'armée)
  // catégories d'unités
  GameData.CATS_META = {
    melee:    { name: 'Corps à corps', icon: '' },
    tir:      { name: 'Tir',           icon: '' },
    magie:    { name: 'Magie',         icon: '' },
    explosif: { name: 'Explosif',      icon: '' },
    garde:    { name: 'Garde',         icon: '' }, // §D17-2 : corps à corps défensif
  };
  GameData.UNIT_TYPES = {
    lancier: {
      id: 'lancier',
      name: { cats: 'Chat Lancier', birds: 'Moineau Piquier' },
      desc: {
        cats: 'Le soldat de base. Fiable, moustachu, toujours partant.',
        birds: 'Petit mais teigneux. Pique d’abord, discute ensuite.',
      },
      cat: 'melee', pop: 1, pts: 1,
      base: { hp: 40, dmg: 3.6, aspd: 0.7, mspd: 42, range: 0 },
      cost: { food: 30 }, prodTime: 11, scale: 0.55,
      look: {
        cats:  { fur: '#e2a94e', furHi: '#f4cf8a', stripe: '#a06a24', shade: '#7a4e18', eye: '#3fbf5a' },
        birds: { fur: '#a9825a', furHi: '#e8d5b5', stripe: '#7c5a38', shade: '#5a3f24', eye: '#2f2a26' },
      },
    },
    eclaireur: {
      id: 'eclaireur',
      name: { cats: 'Chaton Express', birds: 'Colibri Turbo' },
      desc: {
        cats: 'Court partout, très vite, souvent dans le bon sens.',
        birds: 'Bat des ailes 80 fois par seconde, et des records.',
      },
      cat: 'melee', pop: 1, pts: 1,
      base: { hp: 20, dmg: 1.8, aspd: 1.1, mspd: 78, range: 0 },
      cost: { food: 18 }, prodTime: 6.5, scale: 0.46,
      look: {
        cats:  { fur: '#efe6d2', furHi: '#fffaf0', stripe: null, shade: '#a8987c', eye: '#4aa8c9' },
        birds: { fur: '#3fb8a0', furHi: '#8fe6d4', stripe: '#2a8a76', shade: '#1e6456', eye: '#26221e' },
      },
    },
    costaud: {
      id: 'costaud',
      name: { cats: 'Gros Matou', birds: 'Pigeon Dodu' },
      desc: {
        cats: 'A mangé toutes les croquettes. Regrette rien.',
        birds: 'A mangé toutes les miettes de la place. Fier de lui.',
      },
      cat: 'melee', pop: 2, pts: 2,
      base: { hp: 155, dmg: 6.5, aspd: 0.55, mspd: 26, range: 0 },
      cost: { food: 110, mat1: 6 }, prodTime: 28, scale: 0.72, // PROGRESS j2-7 : ~2 min de mat1
      look: {
        cats:  { fur: '#5a5f68', furHi: '#8a8f98', stripe: '#3d4148', shade: '#2c2f36', eye: '#f0c040' },
        birds: { fur: '#8d97a8', furHi: '#c5cdd9', stripe: '#6b7484', shade: '#4a5160', eye: '#e0562e' },
      },
    },
    // ---------- §D17-2 : catégorie 'garde' — corps à corps défensif à bouclier ----------
    targier: {
      id: 'targier',
      name: { cats: 'Chat Targier', birds: 'Moineau Pavois' },
      desc: {
        cats: 'Écuyer au bouclier. Encaisse pour deux, râle pour dix.',
        birds: 'Vole bas, pare haut. Son couvercle a un avis sur tout.',
      },
      cat: 'garde', pop: 1, pts: 1,
      base: { hp: 135, dmg: 5.2, aspd: 0.65, mspd: 38, range: 0 },
      cost: null, prodTime: null, scale: 0.58,
      look: {
        cats:  { fur: '#8f9aa8', furHi: '#c6ced9', stripe: '#5f6a78', shade: '#434c58', eye: '#f0c040' },
        birds: { fur: '#7a8a9a', furHi: '#c0ccd8', stripe: '#54626f', shade: '#3a4550', eye: '#e0562e' },
      },
    },
    rempart: {
      id: 'rempart',
      name: { cats: 'Chat Rempart', birds: 'Héron Bastion' },
      desc: {
        cats: 'Un mur avec des moustaches. Le mur tape aussi, par principe.',
        birds: 'Il ne recule jamais. Son échine a signé un bail longue durée.',
      },
      cat: 'garde', pop: 2, pts: 3,
      base: { hp: 340, dmg: 11.5, aspd: 0.6, mspd: 34, range: 0 },
      cost: null, prodTime: null, scale: 0.74,
      look: {
        cats:  { fur: '#4e5661', furHi: '#8b95a2', stripe: '#333a44', shade: '#242a32', eye: '#ffd24a' },
        birds: { fur: '#5c6472', furHi: '#a8b2c0', stripe: '#3d4450', shade: '#2a3038', eye: '#f5e042' },
      },
    },
    artilleur: {
      id: 'artilleur',
      name: { cats: 'Chat Artilleur', birds: 'Merle Bombardier' },
      desc: {
        cats: 'Lance des pelotes explosives avec une précision féline.',
        birds: 'Largue des glands durcis. Vise très bien. Trop bien.',
      },
      cat: 'explosif', pop: 2, pts: 3,
      base: { hp: 18, dmg: 6.5, aspd: 0.4, mspd: 17, range: 150 },
      cost: { food: 5e5, mat3: 3e5 }, prodTime: 21, scale: 0.55, // PROGRESS j10 : premier sink à mat3 (~2-3 min)
      ability: 'artillery',
      look: {
        cats:  { fur: '#d97d48', furHi: '#f2b98c', stripe: '#a04e1e', shade: '#6b3512', eye: '#7ac95a' },
        birds: { fur: '#3a3632', furHi: '#6a625a', stripe: null, shade: '#1e1b18', eye: '#f2c230' },
      },
    },
    heros: {
      id: 'heros',
      name: { cats: 'Chevalier Griffe', birds: 'Aigle Majesté' },
      desc: {
        cats: 'La légende raconte qu’il a vaincu un aspirateur.',
        birds: 'Son cri fait tomber les croquettes des arbres.',
      },
      cat: 'melee', pop: 4, pts: 4,
      base: { hp: 470, dmg: 17, aspd: 0.75, mspd: 33, range: 0 },
      cost: { food: 2e9, mat2: 8e7, essence: 3e6, essence_t2: 25, mat2_t3: 15, medals: 5 }, prodTime: 77, scale: 0.82, // PROGRESS T5 j30+ : essence raffinée T2 + mat2 T3
      look: {
        cats:  { fur: '#38322e', furHi: '#5c534d', stripe: null, shade: '#1c1815', eye: '#e8d44a' },
        birds: { fur: '#b8894a', furHi: '#eec87e', stripe: '#8a6230', shade: '#5e421e', eye: '#f5e042' },
      },
    },
    fronde: {
      id: 'fronde', name: { cats: 'Chat Frondeur', birds: 'Pie Fusilière' },
      desc: { cats: 'Fait tournoyer sa fronde en visant très fort. Touche souvent la bonne cible.', birds: 'Crache des graines à vitesse réglementaire. La réglementation est floue.' },
      cat: 'tir', pop: 1, pts: 1,
      base: { hp: 16, dmg: 3.2, aspd: 0.6, mspd: 36, range: 110 }, cost: { food: 60, mat1: 4 }, prodTime: 14, scale: 0.5, // PROGRESS j1-3 : T2 spammable
      look: { cats: { fur: '#b98a5a', furHi: '#e8c89a', stripe: '#8a5f34', shade: '#5e3f20', eye: '#58c8f0' }, birds: { fur: '#3a3f4a', furHi: '#c8d2de', stripe: '#20242c', shade: '#14171d', eye: '#f0c040' } },
    },
    traqueur: {
      id: 'traqueur', name: { cats: 'Chat Patineur', birds: 'Hirondelle Comète' },
      desc: { cats: 'Dépose une traînée de laine brûlante : ne marchez pas dedans.', birds: 'Son sillage de plasma picore les pattes ennemies.' },
      cat: 'tir', pop: 1, pts: 1,
      base: { hp: 34, dmg: 2.4, aspd: 0.75, mspd: 58, range: 70 }, cost: { food: 130, mat1: 12 }, prodTime: 25, scale: 0.58, ability: 'trail', // PROGRESS j2-5
      look: { cats: { fur: '#7652bc', furHi: '#d8c4ff', stripe: '#3e2675', shade: '#261849', eye: '#78efff' }, birds: { fur: '#5878d9', furHi: '#b8dcff', stripe: '#30469c', shade: '#1d2c68', eye: '#fff0a0' } },
    },
    mage: {
      id: 'mage', name: { cats: 'Chat Sorcier', birds: 'Chouette Arcanique' },
      desc: { cats: 'Lance des boules d’énergie : petite zone, gros spectacle.', birds: 'Ses runes font pouf autour de la cible.' },
      cat: 'magie', pop: 2, pts: 3,
      base: { hp: 45, dmg: 4.4, aspd: 0.55, mspd: 31, range: 95 }, cost: { food: 2e6, mat3: 8e5, mat2: 3e6 }, prodTime: 35, scale: 0.62, ability: 'magic', // PROGRESS T3 j10-18 : mat3 (plus d'essence)
      look: { cats: { fur: '#49325e', furHi: '#b798e2', stripe: '#2c1a3f', shade: '#20132e', eye: '#f17dff' }, birds: { fur: '#56406e', furHi: '#d8b8f5', stripe: '#302342', shade: '#21162f', eye: '#6ff5ff' } },
    },
    sapeur: {
      id: 'sapeur', name: { cats: 'Chat Bélière', birds: 'Goéland Pétard' },
      desc: { cats: 'Explose sur les bâtiments. Aucun tact, une efficacité rare.', birds: 'Pique le toit, fait BOUM, repart en débris.' },
      cat: 'explosif', pop: 2, pts: 2,
      base: { hp: 75, dmg: 3.2, aspd: 0.6, mspd: 47, range: 0 }, cost: { food: 1.5e6, mat3: 6e5, mat2: 2.5e6 }, prodTime: 34, scale: 0.65, ability: 'siegeBomber', // PROGRESS T3 j10-18 : mat3 (plus de parts)
      look: { cats: { fur: '#d25543', furHi: '#ffc58a', stripe: '#913129', shade: '#5b211d', eye: '#fff15a' }, birds: { fur: '#f07147', furHi: '#ffd1a3', stripe: '#a63b2c', shade: '#68231f', eye: '#fff15a' } },
    },
    essaim: {
      id: 'essaim', name: { cats: 'Chat Gélatineux', birds: 'Moineau Nuage' },
      desc: { cats: 'À sa mort, il se sépare en deux chatons très déterminés.', birds: 'Se fend en deux petits piafs à moitié aussi dangereux.' },
      cat: 'melee', pop: 1, pts: 1,
      base: { hp: 60, dmg: 3.2, aspd: 0.75, mspd: 42, range: 0 }, cost: { food: 1e6, mat2: 2e6 }, prodTime: 31, scale: 0.62, ability: 'split', // PROGRESS T3 j5+ : mat2 (plus de tissu)
      look: { cats: { fur: '#55bda8', furHi: '#b9fff0', stripe: '#2d897b', shade: '#1c5e55', eye: '#ffea6d' }, birds: { fur: '#4fbdbd', furHi: '#bffff5', stripe: '#258789', shade: '#18595d', eye: '#fff07a' } },
    },
    aura: {
      id: 'aura', name: { cats: 'Chat Ronronneur', birds: 'Corbeau Hexagonal' },
      desc: { cats: 'Diffuse un ronron corrosif autour de lui.', birds: 'Une aura de mauvais présage à éviter poliment.' },
      cat: 'magie', pop: 1, pts: 1,
      base: { hp: 160, dmg: 1.6, aspd: 0.55, mspd: 28, range: 0 }, cost: { food: 5e6, milk: 1.5e5, mat3: 3e6, milk_t2: 20 }, prodTime: 45, scale: 0.76, ability: 'damageAura', // PROGRESS T4 j18+ : lait raffiné T2
      look: { cats: { fur: '#913f98', furHi: '#f0a8f4', stripe: '#5b2265', shade: '#36143e', eye: '#b8ff70' }, birds: { fur: '#553768', furHi: '#c9a8e7', stripe: '#321e43', shade: '#20142d', eye: '#f1ff71' } },
    },
    assassin: {
      id: 'assassin', name: { cats: 'Chat Ninja', birds: 'Faucon Rasoir' },
      desc: { cats: 'Fond sur sa proie d’un dash discourtois et la découpe dans la foulée.', birds: 'Déteste les soldats. Son dash arrive avant les présentations.' },
      cat: 'melee', pop: 2, pts: 2,
      base: { hp: 45, dmg: 14, aspd: 0.8, mspd: 66, range: 0 }, cost: { food: 6e6, milk: 2e5, mat3: 4e6, milk_t2: 30, medals: 2 }, prodTime: 50, scale: 0.55, ability: 'duelist', // PROGRESS T4 j18+ : lait raffiné T2
      look: { cats: { fur: '#26313d', furHi: '#6e8aa1', stripe: null, shade: '#121921', eye: '#ff4d6d' }, birds: { fur: '#263949', furHi: '#7bb5c8', stripe: null, shade: '#13212b', eye: '#ff566f' } },
    },
    barde: {
      id: 'barde', name: { cats: 'Chat Chef d’Orchestre', birds: 'Perroquet Tambour' },
      desc: { cats: 'Ne blesse personne, mais motive tout le monde à +30%.', birds: 'Ses cris sont stratégiquement très encourageants.' },
      cat: 'magie', pop: 1, pts: 1,
      base: { hp: 30, dmg: 0, aspd: 0.45, mspd: 30, range: 0 }, cost: { food: 4e6, mat2: 8e6, milk: 2.5e5, milk_t2: 15 }, prodTime: 42, scale: 0.66, ability: 'support', // PROGRESS T4 j18+ : lait raffiné T2
      look: { cats: { fur: '#e3a94e', furHi: '#fff0a6', stripe: '#b06d24', shade: '#714319', eye: '#72dbff' }, birds: { fur: '#e1a840', furHi: '#fff09d', stripe: '#b16b20', shade: '#704017', eye: '#72dfff' } },
    },
    // ---------- §5 : supports (fragiles, chers en pop, indispensables) ----------
    soigneur: {
      id: 'soigneur', name: { cats: 'Chat Infirmier', birds: 'Colombe Guérisseuse' },
      desc: { cats: 'Recolle les blessés à coups de langue râpeuse. Ça pique, ça soigne.', birds: 'Roucoule des premiers secours. Étonnamment efficace, vaguement condescendant.' },
      cat: 'magie', pop: 2, pts: 2,
      base: { hp: 35, dmg: 0, aspd: 0.5, mspd: 32, range: 0 }, cost: null, prodTime: null, scale: 0.6, ability: 'heal',
      look: { cats: { fur: '#f2f0ea', furHi: '#ffffff', stripe: '#d05a5a', shade: '#a8a294', eye: '#5ac878' }, birds: { fur: '#f4f2ee', furHi: '#ffffff', stripe: '#d8b8b8', shade: '#b0aca0', eye: '#5ac878' } },
    },
    entraveur: {
      id: 'entraveur', name: { cats: 'Chat Gluant', birds: 'Geai Glueur' },
      desc: { cats: 'Crache des boules de bave collante. Personne ne lui serre la patte.', birds: 'Ses projectiles collent aux pattes. Et à la dignité.' },
      cat: 'tir', pop: 2, pts: 2,
      base: { hp: 30, dmg: 1.5, aspd: 0.6, mspd: 34, range: 100 }, cost: null, prodTime: null, scale: 0.56, ability: 'slow',
      look: { cats: { fur: '#7aa85a', furHi: '#c8e8a0', stripe: '#527a38', shade: '#365224', eye: '#e8f060' }, birds: { fur: '#58a0b8', furHi: '#b0e0ee', stripe: '#38708a', shade: '#244a5c', eye: '#e8f060' } },
    },
    invocateur: {
      id: 'invocateur', name: { cats: 'Chat Nécromiaou', birds: 'Corbeau Sorcier' },
      desc: { cats: 'Invoque des chatons temporaires. Les chatons n’ont pas signé pour ça.', birds: 'Tire des oisillons du néant. Le néant réclame un loyer.' },
      cat: 'magie', pop: 2, pts: 3,
      base: { hp: 40, dmg: 1, aspd: 0.4, mspd: 28, range: 90 }, cost: null, prodTime: null, scale: 0.64, ability: 'summon',
      look: { cats: { fur: '#3a3448', furHi: '#7a6e98', stripe: '#241f30', shade: '#181420', eye: '#9cf7ff' }, birds: { fur: '#2c2c34', furHi: '#5c5c6c', stripe: '#1a1a20', shade: '#101014', eye: '#9cf7ff' } },
    },
    // ---------- §7 (D5) : 4 unités à mécanique inédite ----------
    porteur: {
      id: 'porteur', name: { cats: 'Chat Porteur', birds: 'Pélican Cargo' },
      desc: { cats: 'Trimballe la moitié du chantier sur son dos. Ne se plaint jamais. Presque jamais.', birds: 'Son bec-soute avale une palette entière. La logistique a des ailes.' },
      cat: 'melee', pop: 2, pts: 2, ability: 'logistic', workWeight: 2,
      base: { hp: 180, dmg: 5, aspd: 0.5, mspd: 30, range: 0 }, cost: null, prodTime: null, scale: 0.72,
      look: { cats: { fur: '#b6844e', furHi: '#e6c48a', stripe: '#7c5528', shade: '#523714', eye: '#4aa8c9' }, birds: { fur: '#e8e2d4', furHi: '#ffffff', stripe: '#c8a86a', shade: '#a89878', eye: '#e0562e' } },
    },
    ingenieur: {
      id: 'ingenieur', name: { cats: 'Chat Bricoleur', birds: 'Pic Mécano' },
      desc: { cats: 'Répare les alliés à coups de tournevis et de jurons. Ça tient.', birds: 'Tape trois fois, ça remarche. Personne ne sait pourquoi. Lui non plus.' },
      cat: 'tir', pop: 2, pts: 3, ability: 'repair',
      base: { hp: 50, dmg: 3, aspd: 0.6, mspd: 34, range: 120 }, cost: null, prodTime: null, scale: 0.6,
      look: { cats: { fur: '#c8923e', furHi: '#f0c878', stripe: '#8a5e20', shade: '#5e3e14', eye: '#7ac95a' }, birds: { fur: '#3a4652', furHi: '#8aa0b0', stripe: '#e05252', shade: '#20282e', eye: '#f0c040' } },
    },
    espion: {
      id: 'espion', name: { cats: 'Chat Cambrioleur', birds: 'Coucou Imposteur' },
      desc: { cats: 'Invisible jusqu’à la première griffade. Repart avec vos poissons.', birds: 'Se fait passer pour un allié, puis pour un problème.' },
      cat: 'melee', pop: 2, pts: 3, ability: 'stealth',
      base: { hp: 55, dmg: 16, aspd: 0.85, mspd: 64, range: 0 }, cost: null, prodTime: null, scale: 0.56,
      look: { cats: { fur: '#2a2e36', furHi: '#5c6470', stripe: null, shade: '#14171d', eye: '#ffd24a' }, birds: { fur: '#4a4640', furHi: '#8a8478', stripe: '#2a2824', shade: '#1a1814', eye: '#ff566f' } },
    },
    chronarque: {
      id: 'chronarque', name: { cats: 'Chat Horloger', birds: 'Ibis du Temps' },
      desc: { cats: 'Remonte le temps des alliés d’une pichenette. Facture à part.', birds: 'Bat des ailes en avance sur l’horloge. Le tic-tac le suit.' },
      cat: 'magie', pop: 4, pts: 4, ability: 'haste',
      base: { hp: 90, dmg: 3, aspd: 0.5, mspd: 30, range: 90 }, cost: null, prodTime: null, scale: 0.72,
      look: { cats: { fur: '#4a3e5e', furHi: '#b0a0d0', stripe: '#2c2440', shade: '#1c1630', eye: '#7fd0ff' }, birds: { fur: '#c8a0b8', furHi: '#f0d8e4', stripe: '#8a6078', shade: '#5c3e4e', eye: '#6ff5ff' } },
    },
    // ---------- §4 : juvéniles (chair à canon attendrissante, sans arme) ----------
    jeune_force: {
      id: 'jeune_force', name: { cats: 'Chaton Griffu', birds: 'Oisillon Piaffeur' },
      desc: { cats: 'Il mord des chevilles. C’est déjà un plan de carrière.', birds: 'Il piaffe. Fort. C’est sa seule compétence, et il y croit.' },
      cat: 'melee', pop: 1, pts: 1, juvenile: true,
      base: { hp: 14, dmg: 1.2, aspd: 0.8, mspd: 40, range: 0 }, cost: null, prodTime: null, scale: 0.38,
      look: { cats: { fur: '#e8b45e', furHi: '#f8dda0', stripe: '#b07a30', shade: '#7e5620', eye: '#3fbf5a' }, birds: { fur: '#c09868', furHi: '#ecd8b0', stripe: '#8a6a42', shade: '#60482c', eye: '#2f2a26' } },
    },
    jeune_agile: {
      id: 'jeune_agile', name: { cats: 'Chaton Fripon', birds: 'Oisillon Virevoltant' },
      desc: { cats: 'Vole des lacets et lance des cailloux. Un prodige, selon sa mère.', birds: 'Vole dans tous les sens, parfois le bon.' },
      cat: 'tir', pop: 1, pts: 1, juvenile: true,
      base: { hp: 8, dmg: 0.9, aspd: 0.9, mspd: 52, range: 65 }, cost: null, prodTime: null, scale: 0.38,
      look: { cats: { fur: '#d8d2c2', furHi: '#f8f4e8', stripe: '#a89878', shade: '#787058', eye: '#4aa8c9' }, birds: { fur: '#58b8a8', furHi: '#a8e8dc', stripe: '#388878', shade: '#245c50', eye: '#26221e' } },
    },
    jeune_magie: {
      id: 'jeune_magie', name: { cats: 'Chaton Luisant', birds: 'Oisillon Scintillant' },
      desc: { cats: 'Il brille dans le noir. Personne ne sait pourquoi. Lui non plus.', birds: 'Fait des étincelles quand il éternue. Souvent.' },
      cat: 'magie', pop: 1, pts: 1, juvenile: true,
      base: { hp: 7, dmg: 0.8, aspd: 0.7, mspd: 36, range: 70 }, cost: null, prodTime: null, scale: 0.38,
      look: { cats: { fur: '#8a70b8', furHi: '#d8c4f8', stripe: '#5c4488', shade: '#3c2c5c', eye: '#f17dff' }, birds: { fur: '#7868a8', furHi: '#ccc0ec', stripe: '#4c4078', shade: '#302850', eye: '#6ff5ff' } },
    },
    jeune_poudre: {
      id: 'jeune_poudre', name: { cats: 'Chaton Pétard', birds: 'Oisillon Grenaille' },
      desc: { cats: 'Sent la poudre et l’insolence. Interdit de cuisine.', birds: 'Transporte des graines explosives. Sans autorisation. Sans regret.' },
      cat: 'explosif', pop: 1, pts: 1, juvenile: true,
      base: { hp: 10, dmg: 1.5, aspd: 0.6, mspd: 38, range: 55 }, cost: null, prodTime: null, scale: 0.38,
      look: { cats: { fur: '#d87050', furHi: '#f8b890', stripe: '#a04830', shade: '#6c3020', eye: '#fff15a' }, birds: { fur: '#c85a40', furHi: '#f0a888', stripe: '#903c2a', shade: '#5c261a', eye: '#fff15a' } },
    },
    // (RETIRÉ — refonte village central, P4) L'unité « worker » n'existe
    // plus : on n'élève plus une caste de travailleurs, on affecte un
    // POURCENTAGE de l'armée entière aux postes (state-core, setWorkPct).
    // Les workers des vieilles sauvegardes redeviennent l'unité de base
    // (migration dans state-core). `isWorker`/`combatTypes` restent : plus
    // rien ne porte le drapeau, ils disent simplement « tout le monde se
    // bat » — et un futur type non combattant les retrouverait prêts.
  };


  // ---------- le drapeau OUVRIER, lu partout où il faut exclure ----------
  // Une seule source de vérité : est ouvrier ce que UNIT_TYPES marque `worker`.
  // Les énumérations de combat (composition, garnison, dojo) s'appuient dessus
  // pour ne jamais proposer un travailleur.
  GameData.isWorker = function (type) {
    const u = GameData.UNIT_TYPES[type];
    return !!(u && u.worker);
  };
  // les types d'unités qui vont au combat (exclut les ouvriers).
  GameData.combatTypes = function () {
    return (GameData.UNIT_ORDER || []).filter(t => !GameData.isWorker(t));
  };

  // ---------- §5 : couleur des projectiles selon le rang visuel ----------
  // blanc → bleu → rouge → doré → prismatique
  GameData.projPalette = function (evo) {
    const r = GameData.visualRank ? GameData.visualRank(evo) : 0;
    const P = [
      { c1: '#ffffff', c2: '#d8dde3', glow: null, prismatic: false },
      { c1: '#7fd0ff', c2: '#3a86ff', glow: '#9fdcff', prismatic: false },
      { c1: '#ff8a6a', c2: '#e05252', glow: '#ff6a4a', prismatic: false },
      { c1: '#ffe9a0', c2: '#ffd700', glow: '#ffd76a', prismatic: false },
      { c1: '#ff6ad5', c2: '#7fd0ff', glow: '#ffffff', prismatic: true },
      { c1: '#ff6ad5', c2: '#9cf7ff', glow: '#ffffff', prismatic: true },
    ];
    return P[Math.max(0, Math.min(5, r))];
  };

  // ---------- rangs d’unité : 30, avec 5 apparences (tous les 6 rangs) ----------
  GameData.EVOS = [
    { suffix: '',            accent: null,      furTint: null,        t: 0 },
    { suffix: 'Vétéran',     accent: '#e05252', furTint: '#c96a35', t: 0.14 },
    { suffix: 'd’Élite', accent: '#b9c6d2', furTint: '#cfd6de', t: 0.22 },
    { suffix: 'Royal',       accent: '#f4c542', furTint: '#a8542f', t: 0.26 },
    { suffix: 'Légendaire',  accent: '#ffd700', furTint: '#f7d774', t: 0.34 },
    { suffix: 'Cosmique',    accent: '#9cf7ff', furTint: '#c8fbff', t: 0.45 },
  ];
  // palette dérivée pour une évolution donnée
  GameData.visualRank = rank => Math.min(5, Math.floor(Math.max(0, rank || 0) / 6));
  GameData.evoPalette = function (faction, type, evo) {
    evo = GameData.visualRank(evo);
    const base = GameData.UNIT_TYPES[type].look[faction];
    const E = GameData.EVOS[evo] || GameData.EVOS[0];
    if (!E.furTint) return Object.assign({}, base);
    const p = {};
    for (const k of ['fur', 'furHi', 'stripe', 'shade']) {
      p[k] = base[k] ? mix(base[k], E.furTint, E.t) : null;
    }
    p.eye = base.eye;
    if (evo >= 3) p.shade = shade(p.shade, -0.15);
    return p;
  };
  GameData.evoName = function (faction, type, evo) {
    const n = GameData.UNIT_TYPES[type].name[faction];
    const s = GameData.EVOS[GameData.visualRank(evo)].suffix;
    return s ? n + ' ' + s : n;
  };
  // coût de rang : chaque palier de 6 rangs débloque une silhouette plus épique
  GameData.evoCost = function (type, evo) {
    // §D13-E : le tarif suit le TIER de l'unité (2×tier−1), plus l'ordre arbitraire
    // de UNIT_ORDER — fini les juvéniles hors de prix parce que déclarés en dernier.
    const ti = 2 * GameData.unitTier(type) - 1;
    const m = Math.pow(1.26, evo) * ti;
    // §7 : coûts d'évolution ×3 — le prestige se paie, comme tout le reste
    const c = { food: Math.round(720 * m), mat2: Math.round(12 * m) };
    if (evo >= 5) c.mat3 = Math.round(6 * m);
    if (evo >= 11) c.essence = Math.max(1, Math.round(m / 3));
    if (evo >= 14) c.milk = Math.max(1, Math.round(m / 5)); // §1 (D4) : le lait irrigue enfin la fin de partie
    if (evo >= 17) c.fabric = Math.max(1, Math.round(m / 4));
    if (evo >= 20) c.elixir = Math.max(1, Math.round(m / 25)); // §10 : l'élixir irrigue les hauts rangs
    if (evo >= 23) c.medals = Math.max(1, Math.round(m / 6));
    // PROGRESSION : ressources raffinées (Cuisine) aux hauts rangs d'évolution —
    // T2 (rang 14+), T3 (rang 20+), T4 (rang 26+), aligné sur la frise de déblocage.
    if (evo >= 14) c.food_t2 = Math.max(1, Math.round(m / 8));
    if (evo >= 20) c.food_t3 = Math.max(1, Math.round(m / 12));
    if (evo >= 26) c.food_t4 = Math.max(1, Math.round(m / 20));
    // §D13-E : le barème 'units' est mort (aucun consommateur ne le lisait) — enterré.
    return c;
  };
  GameData.evoStatMult = evo => Math.pow(1.055, Math.min(30, evo || 0)); // hp & dégâts

  // ---------- §6 (D5) : TIERS de puissance (1..6) ----------
  // T1 juvéniles ; T2 troupe de base ; T3 costauds/soutiens ; T4 spécialistes ;
  // T5 élite ; T6 légendes. Conditionne le déblocage des stations d'évolution (nursery ≥ tier).
  GameData.UNIT_TIER = {
    jeune_force: 1, jeune_agile: 1, jeune_magie: 1, jeune_poudre: 1,
    lancier: 2, eclaireur: 2, fronde: 2, targier: 2,
    costaud: 3, traqueur: 3, barde: 3, porteur: 3, essaim: 3,
    mage: 4, sapeur: 4, aura: 4, entraveur: 4, ingenieur: 4, rempart: 4,
    artilleur: 5, assassin: 5, soigneur: 5, invocateur: 5, espion: 5,
    heros: 6, chronarque: 6,
  };
  GameData.unitTier = type => GameData.UNIT_TIER[type] || 1;

  // ---------- §D17-3 : SALLE DES TECHNIQUES — pouvoirs d'unités au choix ----------
  // 19 kinds implémentés par battle.js : tourbillon (pulse AoE autour de soi),
  // charge (bonus au 1er coup après approche > dist px), antimagie (immunité aux
  // dégâts des unités magie), rebond (projectiles qui rebondissent), zone (splash),
  // siege (× dégâts aux garnisons/bâtiments), regen (régén hors combat), vampirisme
  // (lifesteal), epines (renvoi de dégâts cac), cri (slow périodique autour), pavois
  // (bouclier absorbant périodique), focus (+dégâts si non harcelé), et §D18 :
  // soin (soin ciblé de l'allié le plus blessé), volee (prochaine attaque en éventail),
  // percant (projectiles qui traversent en ligne), pluiefleches (pluie de flèches sur
  // un groupe), gel (touches qui ralentissent), trainee (traînée au sol des tirs),
  // familier (chance d'invoquer un chaton/oisillon temporaire à l'impact).
  // UN SEUL pouvoir actif par type : s.unitPowers = { type: powerId|null }.
  // unlockEvo : les 2 premiers dès le rang 3, le 3e au rang 10, le 4e au rang 18 ;
  // les nouveaux §D18 s'étagent à 8/14/20 selon la puissance.
  // Application côté JOUEUR uniquement (getUnitStats/cfg transmettent, battle applique).
  const PW = (type, kind, name, icon, desc, unlockEvo, params) =>
    ({ id: type + '_' + kind, kind, name, icon, desc, unlockEvo, params });
  GameData.UNIT_POWERS = {
    // ----- T2 : troupe de base (2-3 pouvoirs) -----
    lancier: [
      PW('lancier', 'charge', 'Charge du piquier', '', 'Bond fulgurant toutes les 30 s : le premier coup frappe ×4. La politesse attendra.', 3, { dist: 150, pct: 3.0, cd: 30 }),
      PW('lancier', 'tourbillon', 'Moulinet moustachu', '', 'Toutes les 15 s, la lance balaie tout ce qui respire autour. Les voisins sont prévenus.', 3, { cd: 15, pct: 1.2, radius: 40 }),
      PW('lancier', 'antimagie', 'Hampe bénie', '', 'Les sorts ennemis glissent dessus comme l’eau sur un canard. Aura bleue de rigueur.', 10, {}),
    ],
    eclaireur: [
      PW('eclaireur', 'charge', 'Sprint fulgurant', '', 'Bondit plus vite que la nouvelle de son arrivée : premier coup ×4,3, toutes les 30 s.', 3, { dist: 150, pct: 3.3, cd: 30 }),
      PW('eclaireur', 'focus', 'Œil du messager', '', '+25 % de dégâts tant que personne ne le harcèle. Personne ne l’attrape, donc.', 3, { pct: 0.25 }),
      PW('eclaireur', 'regen', 'Second souffle', '', 'Récupère 2 %/s hors combat. Courir, souffler, recommencer.', 10, { pctPerSec: 0.02 }),
    ],
    fronde: [
      PW('fronde', 'focus', 'Visée réglementaire', '', '+25 % de dégâts si on le laisse viser tranquille. Le règlement est formel.', 3, { pct: 0.25 }),
      PW('fronde', 'zone', 'Gravier à mitraille', '', 'Les projectiles éclatent en gerbe de 26 px. Le gravier ne choisit pas ses victimes.', 3, { radius: 26, pct: 0.6 }),
      PW('fronde', 'volee', 'Salve du lance-pierre', '', 'Toutes les 12 s, la prochaine attaque crache 5 projectiles en éventail à 60 % des dégâts. Économe en tout, sauf en gravier.', 8, { cd: 12, count: 5, pct: 0.6 }),
      PW('fronde', 'rebond', 'Ricochet champion', '', 'Chaque tir rebondit sur une cible voisine. Record du lac : quatre canards.', 10, { bounces: 2, pct: 0.7 }),
      PW('fronde', 'percant', 'Caillou transperçant', '', 'Ses tirs traversent jusqu’à 3 ennemis en ligne (×0,75 par cible). Faire la queue devient un sport à risque.', 14, { count: 3, decay: 0.75 }),
      PW('fronde', 'pluiefleches', 'Averse de gravillons', '', 'Toutes les 18 s, arrose un groupe ennemi de 6 salves tombées du ciel. La météo est formelle : ça pique.', 20, { cd: 18, radius: 55, pct: 1.2 }),
    ],
    targier: [
      PW('targier', 'pavois', 'Petit pavois', '', 'Lève un bouclier absorbant périodique. Petit, mais de très mauvaise volonté.', 3, { cd: 14, pct: 0.3 }),
      PW('targier', 'epines', 'Bord denté', '', 'Renvoie 18 % des dégâts cac. Frapper le couvercle a un prix.', 3, { pct: 0.18 }),
      PW('targier', 'cri', 'Sommation du guet', '', 'Un cri périodique ralentit 35 % des assaillants autour. Halte-là, et que ça traîne.', 10, { cd: 10, radius: 60, slowPct: 0.35, dur: 3 }),
    ],
    // ----- T3 : costauds & soutiens (3 pouvoirs) -----
    costaud: [
      PW('costaud', 'epines', 'Cuir vexatoire', '', 'Renvoie 18 % des dégâts cac. Le taper, c’est se taper.', 3, { pct: 0.18 }),
      PW('costaud', 'regen', 'Sieste tactique', '', 'Récupère 2 %/s hors combat. Le front attendra la fin du ronron.', 3, { pctPerSec: 0.02 }),
      PW('costaud', 'tourbillon', 'Roulade sismique', '', 'Pulse périodiquement tout son poids autour de lui. Le sol s’en souvient.', 10, { cd: 17, pct: 1.3, radius: 44 }),
    ],
    traqueur: [
      PW('traqueur', 'focus', 'Traque froide', '', '+25 % de dégâts tant qu’on ne le dérange pas. On le dérange rarement deux fois.', 3, { pct: 0.25 }),
      PW('traqueur', 'charge', 'Fondu au sprint', '', 'Toutes les 30 s, une glissade fulgurante : premier coup ×4. Et frigorifique.', 3, { dist: 150, pct: 3.0, cd: 30 }),
      PW('traqueur', 'gel', 'Patin givrant', '', 'Chaque tir ralentit la cible de 40 % pendant 2 s. Le plasma, version congélateur.', 8, { slowPct: 0.4, dur: 2 }),
      PW('traqueur', 'zone', 'Sillage éclatant', '', 'Ses tirs éclaboussent 26 px de plasma. Marcher à côté compte comme marcher dedans.', 10, { radius: 26, pct: 0.6 }),
    ],
    barde: [
      PW('barde', 'cri', 'Fausse note stratégique', '', 'Un couac périodique ralentit 35 % de l’auditoire ennemi. L’art est un champ de bataille.', 3, { cd: 10, radius: 65, slowPct: 0.35, dur: 3 }),
      PW('barde', 'regen', 'Berceuse de campagne', '', 'Se rejoue 2 %/s hors combat. L’entracte soigne tout.', 3, { pctPerSec: 0.02 }),
      PW('barde', 'soin', 'Refrain réparateur', '', 'Toutes les 45 s, recolle l’allié le plus blessé de 30 % de ses PV max. Le public en redemande.', 8, { cd: 45, pct: 0.3, radius: 110 }),
      PW('barde', 'antimagie', 'Contre-chant', '', 'Les sorts ennemis se prennent un couplet d’immunité. La critique est immunisée.', 10, {}),
    ],
    porteur: [
      PW('porteur', 'regen', 'Pause casse-croûte', '', 'Récupère 2 %/s hors combat. La logistique commence par soi-même.', 3, { pctPerSec: 0.02 }),
      PW('porteur', 'epines', 'Chargement anguleux', '', 'Renvoie 18 % des dégâts cac : les coins de caisses dépassent exprès.', 3, { pct: 0.18 }),
      PW('porteur', 'pavois', 'Palette levée', '', 'Brandit périodiquement sa cargaison en bouclier absorbant. Le fret encaisse.', 10, { cd: 14, pct: 0.3 }),
    ],
    essaim: [
      PW('essaim', 'vampirisme', 'Gélatine gourmande', '', 'Récupère 15 % des dégâts infligés. La gelée se ressoude en mangeant.', 3, { pct: 0.15 }),
      PW('essaim', 'tourbillon', 'Remous collectif', '', 'Pulse périodiquement une vague gluante autour de lui. Ça colle, ça pique.', 3, { cd: 15, pct: 1.0, radius: 38 }),
      PW('essaim', 'regen', 'Reprise en masse', '', 'Se regonfle de 2 %/s hors combat. La gelée ne connaît pas la défaite, juste la pause.', 10, { pctPerSec: 0.02 }),
    ],
    // ----- T4 : spécialistes (3-4 pouvoirs) -----
    mage: [
      PW('mage', 'rebond', 'Orbe capricieuse', '', 'Ses boules d’énergie rebondissent jusqu’à deux fois. Elles choisissent mal, mais souvent.', 3, { bounces: 2, pct: 0.7 }),
      PW('mage', 'zone', 'Grand pouf', '', 'Le pouf s’élargit à 26 px. Petit mot, grande zone.', 3, { radius: 26, pct: 0.65 }),
      PW('mage', 'trainee', 'Sillage de braises', '', 'Ses orbes sèment des braises arcanes au sol pendant 2,5 s. Le chemin le plus court est aussi le plus chaud.', 8, { pct: 0.25, dur: 2.5, width: 14 }),
      PW('mage', 'siege', 'Rune de démolition', '', '×2,2 dégâts aux garnisons et bâtiments. Le permis de démolir est un parchemin.', 10, { mult: 2.2 }),
      PW('mage', 'familier', 'Chaton de service', '', '30 % de chance à l’impact d’invoquer un chaton temporaire (12 s, 3 max). Le contrat est vague, le chaton aussi.', 14, { chance: 0.3, max: 3, hp: 18, dmg: 1.5, dur: 12 }),
      PW('mage', 'focus', 'Incantation plein régime', '', '+25 % de dégâts si personne ne l’interrompt. Ne l’interrompez pas.', 18, { pct: 0.25 }),
    ],
    sapeur: [
      PW('sapeur', 'siege', 'Dossier explosif', '', '×2,2 dégâts aux bâtiments. Sa spécialité devient une vocation.', 3, { mult: 2.2 }),
      PW('sapeur', 'zone', 'Déflagration élargie', '', 'Son adieu souffle 26 px de plus. Les débris voyagent loin.', 3, { radius: 26, pct: 0.7 }),
      PW('sapeur', 'charge', 'Course à la mèche', '', 'Toutes les 30 s, arrive lancé : premier impact ×4. La mèche n’attend personne.', 10, { dist: 150, pct: 3.0, cd: 30 }),
    ],
    aura: [
      PW('aura', 'epines', 'Ronron barbelé', '', 'Renvoie 18 % des dégâts cac. Le câlin est contractuellement piégé.', 3, { pct: 0.18 }),
      PW('aura', 'cri', 'Basse fréquence', '', 'Une pulsation périodique ralentit 35 % des ennemis autour. Le malaise est un outil.', 3, { cd: 10, radius: 62, slowPct: 0.35, dur: 3 }),
      PW('aura', 'trainee', 'Ronron incandescent', '', 'Sème des braises de mauvais présage sur son passage (2,5 s au sol). Marcher derrière lui est déconseillé par lui-même.', 8, { pct: 0.6, dur: 2.5, width: 14 }),
      PW('aura', 'regen', 'Auto-ronronthérapie', '', 'Se soigne de 2 %/s hors combat. Il s’écoute beaucoup, et ça marche.', 10, { pctPerSec: 0.02 }),
      PW('aura', 'vampirisme', 'Aura à péage', '', 'Récupère 12 % des dégâts que son aura inflige. Le mauvais présage se rémunère.', 18, { pct: 0.12 }),
    ],
    entraveur: [
      PW('entraveur', 'cri', 'Glaviot sonore', '', 'Un cri gluant périodique ralentit 35 % de l’entourage. Doublé de bave, évidemment.', 3, { cd: 10, radius: 60, slowPct: 0.35, dur: 3 }),
      PW('entraveur', 'zone', 'Flaque généreuse', '', 'Ses boules collantes éclaboussent 26 px. Tout le monde repart avec un souvenir.', 3, { radius: 26, pct: 0.6 }),
      PW('entraveur', 'rebond', 'Bave à ressort', '', 'Ses projectiles rebondissent sur une victime voisine. La dignité non plus n’y échappe pas.', 10, { bounces: 1, pct: 0.75 }),
    ],
    ingenieur: [
      PW('ingenieur', 'focus', 'Plan bien lu', '', '+25 % de dégâts tant qu’on le laisse travailler. Les plans détestent les visites.', 3, { pct: 0.25 }),
      PW('ingenieur', 'regen', 'Auto-maintenance', '', 'Se répare de 2 %/s hors combat. Trois tapes, ça remarche. Sur lui aussi.', 3, { pctPerSec: 0.02 }),
      PW('ingenieur', 'pavois', 'Plaque de chantier', '', 'Déploie périodiquement un blindage absorbant. Norme CE, colère non incluse.', 10, { cd: 14, pct: 0.3 }),
    ],
    rempart: [
      PW('rempart', 'pavois', 'Grand pavois', '', 'Lève périodiquement un bouclier absorbant taille porte de grange. On ne passe pas.', 3, { cd: 9, pct: 0.35 }),
      PW('rempart', 'epines', 'Muraille à échardes', '', 'Renvoie 18 % des dégâts cac. Le mur rend la monnaie, majorée.', 3, { pct: 0.18 }),
      PW('rempart', 'cri', 'Halte réglementaire', '', 'Un cri périodique ralentit 35 % des assaillants. Le guichet est fermé.', 10, { cd: 10, radius: 64, slowPct: 0.35, dur: 3 }),
      PW('rempart', 'antimagie', 'Blindage runique', '', 'Immunisé aux dégâts des unités magie. Les sorts prennent un ticket et repartent.', 18, {}),
    ],
    // ----- T5 : élite (3-4 pouvoirs) -----
    artilleur: [
      PW('artilleur', 'zone', 'Pelote à fragmentation', '', 'Ses obus arrosent 26 px de plus. La précision, c’est aussi une question de volume.', 3, { radius: 26, pct: 0.7 }),
      PW('artilleur', 'siege', 'Tir de démolition', '', '×2,2 dégâts aux bâtiments. Les murs le respectent. Brièvement.', 3, { mult: 2.2 }),
      PW('artilleur', 'pluiefleches', 'Barrage plongeant', '', 'Toutes les 16 s, un rideau de 6 salves s’abat sur un groupe ennemi. Livraison par les airs, pourboire refusé.', 8, { cd: 16, radius: 60, pct: 1.3 }),
      PW('artilleur', 'rebond', 'Obus farceur', '', 'Le projectile rebondit vers une seconde adresse. Livraison groupée.', 10, { bounces: 1, pct: 0.7 }),
      PW('artilleur', 'percant', 'Obus perforant', '', 'Ses obus traversent jusqu’à 2 cibles en ligne (×0,7 par cible). Le mur d’en face compte comme volontaire.', 14, { count: 2, decay: 0.7 }),
      PW('artilleur', 'focus', 'Calibrage parfait', '', '+25 % de dégâts tant qu’on ne bouscule pas sa table de tir.', 18, { pct: 0.25 }),
    ],
    assassin: [
      PW('assassin', 'charge', 'Bond de l’ombre', '', 'Toutes les 22 s, surgit de l’ombre d’un bond : le premier coup frappe ×2,2. Le second n’est jamais loin.', 3, { dist: 90, pct: 1.2, cd: 22 }),
      PW('assassin', 'vampirisme', 'Lame assoiffée', '', 'Récupère 18 % des dégâts infligés. La lame boit la première.', 3, { pct: 0.18 }),
      PW('assassin', 'focus', 'Contrat prioritaire', '', '+25 % de dégâts si personne ne le harcèle. Personne n’ose, en général.', 10, { pct: 0.25 }),
    ],
    soigneur: [
      PW('soigneur', 'regen', 'Léchouille intensive', '', 'Se soigne lui-même de 3,5 %/s hors combat. Cordonnier bien chaussé, enfin.', 3, { pctPerSec: 0.035 }),
      PW('soigneur', 'cri', 'Diagnostic assourdissant', '', 'Un roucoulement clinique ralentit 35 % des ennemis autour. Condescendant ET efficace.', 3, { cd: 10, radius: 60, slowPct: 0.35, dur: 3 }),
      PW('soigneur', 'soin', 'Grande léchouille', '', 'Toutes les 40 s, soigne l’allié le plus amoché de 35 % de ses PV max. Ça pique, ça râpe, ça repart.', 8, { cd: 40, pct: 0.35, radius: 110 }),
      PW('soigneur', 'pavois', 'Pansement préventif', '', 'S’enveloppe périodiquement d’un bandage absorbant. La prévention, c’est la moitié du métier.', 10, { cd: 14, pct: 0.3 }),
      PW('soigneur', 'antimagie', 'Asepsie arcanique', '', 'Immunisé aux dégâts magiques. Les sorts sont priés de se désinfecter avant d’entrer.', 18, {}),
    ],
    invocateur: [
      PW('invocateur', 'zone', 'Néant éclaboussant', '', 'Ses traits du néant éclaboussent 26 px. Le loyer du néant augmente encore.', 3, { radius: 26, pct: 0.6 }),
      PW('invocateur', 'rebond', 'Écho spectral', '', 'Ses projectiles rebondissent une fois. L’au-delà fait du porte-à-porte.', 3, { bounces: 1, pct: 0.75 }),
      PW('invocateur', 'familier', 'Portée surprise', '', '45 % de chance à l’impact d’invoquer un chaton supplémentaire (12 s, 3 max). Le néant fait des promotions.', 8, { chance: 0.45, max: 3, hp: 18, dmg: 1.5, dur: 12 }),
      PW('invocateur', 'vampirisme', 'Dîme des invoqués', '', 'Récupère 15 % des dégâts infligés. Les chatons temporaires cotisent.', 10, { pct: 0.15 }),
    ],
    espion: [
      PW('espion', 'charge', 'Entrée par effraction', '', 'Toutes les 30 s, entre d’un bond par effraction : le premier coup frappe ×2,2. Il avait la clé, en plus.', 3, { dist: 90, pct: 1.2, cd: 30 }),
      PW('espion', 'focus', 'Sang-froid professionnel', '', '+25 % de dégâts tant que personne ne le soupçonne. Personne ne le soupçonne.', 3, { pct: 0.25 }),
      PW('espion', 'vampirisme', 'Butin vital', '', 'Récupère 16 % des dégâts infligés. Il repart toujours avec quelque chose.', 10, { pct: 0.16 }),
    ],
    // ----- T6 : légendes (4 pouvoirs) -----
    heros: [
      PW('heros', 'tourbillon', 'Ouragan de griffes', '', 'Toutes les 15 s, une tornade héroïque balaie tout autour de lui. L’aspirateur, lui, avait abandonné.', 3, { cd: 15, pct: 1.4, radius: 46 }),
      PW('heros', 'charge', 'Assaut légendaire', '', 'Toutes les 30 s, bondit au cœur de la mêlée : le premier coup frappe ×2,2 et écrit la légende. En majuscules.', 3, { dist: 90, pct: 1.2, cd: 30 }),
      PW('heros', 'vampirisme', 'Gloire nourricière', '', 'Récupère 15 % des dégâts infligés. La légende se nourrit d’elle-même.', 10, { pct: 0.15 }),
      PW('heros', 'soin', 'Accolade légendaire', '', 'Toutes les 45 s, rend 35 % de ses PV max à l’allié le plus mal en point. La légende recoud aussi.', 14, { cd: 45, pct: 0.35, radius: 110 }),
      PW('heros', 'cri', 'Cri de bannière', '', 'Un rugissement périodique ralentit 35 % des ennemis. Les croquettes tombent des arbres.', 18, { cd: 8, radius: 70, slowPct: 0.35, dur: 3 }),
    ],
    chronarque: [
      PW('chronarque', 'focus', 'Minutage parfait', '', '+25 % de dégâts tant que son agenda est respecté. Il l’est toujours.', 3, { pct: 0.25 }),
      PW('chronarque', 'cri', 'Tic-tac oppressant', '', 'Une sonnerie périodique ralentit 35 % des ennemis. L’heure, c’est l’heure. La leur est passée.', 3, { cd: 10, radius: 62, slowPct: 0.35, dur: 3 }),
      PW('chronarque', 'antimagie', 'Sablier scellé', '', 'Immunisé aux dégâts magiques. Les sorts arrivent toujours hors délai.', 10, {}),
      PW('chronarque', 'regen', 'Retour en arrière', '', 'Rembobine ses blessures de 2,5 %/s hors combat. Facture antidatée.', 18, { pctPerSec: 0.025 }),
    ],
    // ----- T1 : juvéniles (1 pouvoir simple chacun) -----
    jeune_force: [
      PW('jeune_force', 'charge', 'Ruée de chevilles', '', 'Toutes les 30 s, fonce d’un bond et mord ×1,8 au premier contact. Le plan de carrière avance.', 3, { dist: 90, pct: 0.8, cd: 30 }),
    ],
    jeune_agile: [
      PW('jeune_agile', 'focus', 'Caillou appliqué', '', '+20 % de dégâts si on le laisse viser. Sa mère avait raison.', 3, { pct: 0.2 }),
    ],
    jeune_magie: [
      PW('jeune_magie', 'rebond', 'Étincelle baladeuse', '', 'Son éternuement rebondit sur un second ennemi. À ses souhaits.', 3, { bounces: 1, pct: 0.7 }),
    ],
    jeune_poudre: [
      PW('jeune_poudre', 'zone', 'Graine pétaradante', '', 'Ses graines éclatent sur 26 px. Toujours sans autorisation.', 3, { radius: 26, pct: 0.5 }),
    ],
  };
  // pouvoirs d'un type (tableau, éventuellement vide)
  GameData.unitPowers = type => GameData.UNIT_POWERS[type] || [];
  // un pouvoir est-il débloqué au rang d'évolution donné ?
  GameData.powerUnlocked = function (type, powerId, evo) {
    const p = (GameData.UNIT_POWERS[type] || []).find(x => x.id === powerId);
    return !!p && (evo | 0) >= p.unlockEvo;
  };

  // ---------- §4 (D5) : MANNEQUINS — le rang se gagne à l'entraînement continu ----------
  // Durée d'un rang : 20 min × 3^evo × (1 + (tier-1)/4). Le drain/s est evoCost étalé
  // sur cette durée : entraîner un rang coûte EXACTEMENT son evoCost, mais en temps réel.
  // (VAGUE RANGS) LE RANG SE GAGNE EN EXPÉDITION. La campagne paie
  // l'expérience à son dénouement, avec une prime en cas de victoire : c'est
  // en se battant qu'on monte, plus en tournant autour d'un mannequin.
  // `parDeploi` : ce qu'une unité envoyée rapporte à son type. `victoire` :
  // le multiplicateur appliqué à TOUT le renfort quand l'expédition est
  // gagnée — se battre forme, gagner forme mieux.
  GameData.UNIT_RANK_XP = { base: 6, mult: 1.55, parDeploi: 1, victoire: 2.5 };
  GameData.unitRankSeuil = function (evo) {
    const c = GameData.UNIT_RANK_XP;
    return Math.ceil(c.base * Math.pow(c.mult, Math.max(0, evo | 0)));
  };
  // ce qu'un déploiement rapporte : une unité envoyée = un point, les gros
  // tiers pesant plus lourd (ils sont plus rares).
  GameData.unitRankGain = function (type, n) {
    const tier = GameData.unitTier ? GameData.unitTier(type) : 1;
    return Math.max(1, Math.round((n | 0) * GameData.UNIT_RANK_XP.parDeploi * (1 + (tier - 1) * 0.35)));
  };

  // Durée d'un rang au mannequin. Calibrée pour 30 rangs : de ~3 min au rang 0
  // jusqu'à ~5 h au rang 29 (croissance douce 1.17^evo). Un type poussé au rang max
  // = plusieurs dizaines d'heures d'entraînement — c'est l'horizon long du jeu.
  GameData.evoDuration = function (type, evo) {
    const tierIdx = (GameData.unitTier(type) - 1); // 0..5
    return 180 * Math.pow(1.17, Math.max(0, evo || 0)) * (1 + tierIdx / 4);
  };
  // drain PAR SECONDE (ressources uniquement ; les 'units' d'evoCost ne s'appliquent pas
  // aux mannequins — le rang se gagne au temps et à la ressource, pas à la chair).
  GameData.evoDrain = function (type, evo) {
    const dur = GameData.evoDuration(type, evo);
    const cost = GameData.evoCost(type, evo);
    const d = {};
    for (const k in cost) { if (k === 'units') continue; d[k] = cost[k] / dur; }
    return d;
  };
  GameData.MANNEQUINS = {
    max: 5,
    maxEvo: 30, // les mannequins mènent un type jusqu'au rang 30 (apparence qui change tous les 6 rangs)
    // ÉQUILIBRAGE (échelle des tiers) : le 1er mannequin s'achète au Dojo 2 —
    // tout début de partie — et réclamait des `parts` (TIER 4, des semaines plus
    // tard). Un mannequin = un cran de tier, comme le reste du jeu :
    //   n°1 tier 1 (nourriture + matériau 1) … n°5 tier 4 (pièces).
    buyCost: i => {
      i = Math.max(0, Math.min(4, i | 0));
      const c = { food: Math.round(4000 * Math.pow(3.2, i)), mat1: Math.round(60 * Math.pow(2.6, i)) };
      if (i >= 1) c.mat2 = Math.round(40 * Math.pow(2.4, i - 1));
      if (i >= 2) c.mat3 = Math.round(30 * Math.pow(2.4, i - 2));
      if (i >= 3) c.essence = Math.round(25 * Math.pow(2.4, i - 3));
      if (i >= 4) c.parts = 40;
      return c;
    },
    // §5 : le mannequin i exige le bâtiment Dojo au niveau ≥ i+2
    dojoReq: i => i + 2,
    names: { cats: 'Épouvantail à plumes', birds: 'Pelote d’entraînement griffée' },
  };
