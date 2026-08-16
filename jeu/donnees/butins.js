/* ============================================================
   LE BOURG — donnees/butins.js
   CE QU'ON TROUVE SANS L'AVOIR CHERCHÉ, ET CE QUI ATTEND EN BAS.

   Trois tables, et une seule idée : le travail répétitif doit pouvoir
   SURPRENDRE. Un pêcheur qui relève sa nasse pour la six centième fois
   ramène une perle ; c'est ce qui fait qu'on regarde encore la barre.

   1. TROUVAILLES  — par métier. Elles s'ajoutent au butin propre à
      chaque recette, et leur chance dépend de la DURÉE du cycle : un
      ouvrage d'une minute cherche plus longtemps qu'un geste de six
      secondes. Aucune ne se produit à l'atelier : on ne peut que les
      trouver.
   2. PÉRILS       — les biomes de la tour, tous les vingt étages.
      Chacun tue autrement, et chacun se pare autrement.
   3. GARDIENS     — un par palier de dix étages. Une fois battu, on
      peut y retourner autant qu'on veut : c'est la seule source de
      cœurs de biome, et donc de tout l'équipement profond.
   -> window.BUTINS, window.PERILS, window.GARDIENS
   ============================================================ */
"use strict";
(function () {

  /* =================================================================
     1. LES TROUVAILLES DES MÉTIERS

     `p` est une probabilité POUR UNE MINUTE DE TRAVAIL. Le moteur la
     met à l'échelle de la durée du cycle : on ne gagne donc rien à
     hacher une tâche longue en tâches courtes, et le joueur peut lire
     un chiffre qui veut dire quelque chose.
     `rang` : rang de métier minimum. On ne trouve pas de perle le
     premier jour — il faut avoir usé quelques filets.
     ================================================================= */
  const T = (res, p, n, rang) => ({ res, p, n: n || [1, 1], rang: rang || 1 });

  const BUTINS = {
    peche: [
      T('ecaille', 0.070, [1, 2], 2),
      T('perle',   0.011, [1, 1], 5),
      T('ossuaire',0.020, [1, 1], 7),
      T('ecu',     0.090, [3, 14], 1),
    ],
    bois: [
      T('resine',  0.110, [1, 3], 1),
      T('champignon', 0.080, [1, 2], 1),
      T('ambre',   0.014, [1, 1], 6),
      T('herbe',   0.070, [1, 2], 1),
    ],
    champs: [
      T('racine',  0.100, [1, 2], 1),
      T('silex',   0.075, [1, 2], 2),
      T('argile',  0.060, [1, 3], 1),
      T('ambre',   0.009, [1, 1], 7),
    ],
    elevage: [
      T('plume',   0.085, [1, 2], 1),
      T('peau',    0.050, [1, 1], 3),
      T('racine',  0.040, [1, 1], 1),
      T('ossuaire',0.014, [1, 1], 6),
    ],
    mine: [
      T('silex',   0.120, [1, 3], 1),
      T('salpetre',0.055, [1, 2], 3),
      T('gemme',   0.007, [1, 1], 8),
      T('ossuaire',0.030, [1, 1], 5),
    ],
    feu: [
      T('cendre',  0.150, [1, 4], 1),
      T('salpetre',0.045, [1, 2], 4),
      T('charbon', 0.055, [1, 2], 2),
      T('obsidienne', 0.004, [1, 1], 10),
    ],
    forge: [
      T('limaille',0.130, [1, 3], 1),
      T('clou',    0.060, [1, 3], 2),
      T('silex',   0.040, [1, 1], 1),
      T('gemme',   0.005, [1, 1], 9),
    ],
    tissage: [
      T('fil',     0.080, [1, 2], 1),
      T('plume',   0.055, [1, 2], 2),
      T('ecaille', 0.020, [1, 1], 6),
    ],
    cuisine: [
      T('herbe',   0.090, [1, 2], 1),
      T('racine',  0.060, [1, 2], 1),
      T('miel',    0.030, [1, 1], 4),
      T('perle',   0.005, [1, 1], 8),
    ],
    savoir: [
      T('encre',   0.045, [1, 1], 2),
      T('racine',  0.060, [1, 2], 1),
      T('parchemin', 0.035, [1, 1], 3),
      T('essence', 0.006, [1, 1], 9),
    ],
    batisse: [
      T('pierre',  0.100, [1, 3], 1),
      T('silex',   0.070, [1, 2], 1),
      T('limaille',0.045, [1, 2], 3),
      T('ecu',     0.070, [4, 20], 1),
    ],
    guerre: [
      T('plume',   0.120, [1, 3], 1),
      T('limaille',0.060, [1, 2], 2),
      T('medaille',0.010, [1, 1], 7),
      T('ossuaire',0.035, [1, 1], 4),
    ],
  };

  /* Ce qu'un poste peut trouver, tel qu'on l'affiche dans sa fenêtre :
     la table du métier filtrée par le rang atteint, et la probabilité
     déjà mise à l'échelle du cycle. */
  function tableDe(metier, duree, mult) {
    const l = BUTINS[metier] || [];
    const rang = (window.Etat && window.Etat.rangMetier) ? window.Etat.rangMetier(metier) : 1;
    const k = Math.max(0.08, (duree || 10) / 60) * (mult == null ? 1 : mult);
    return l.filter(t => rang >= t.rang)
            .map(t => ({ res: t.res, n: t.n, p: Math.min(0.92, t.p * k) }));
  }

  /* =================================================================
     2. LES PÉRILS — les biomes de la tour

     Tous les VINGT étages, ce qui tue change de nature. Le décor, lui,
     tourne plus vite : on peut traverser trois paysages sans changer de
     danger, et c'est très bien — le joueur apprend à lire le PÉRIL et
     non le papier peint.

     Sans la garde qui convient, on descend quand même : simplement, on
     encaisse le double, on ramasse un tiers, et l'on risque d'y laisser
     quelqu'un. Ce n'est pas un mur, c'est une facture.
     ================================================================= */
  const PERILS = [
    { id:'neutre', nom:'Les Galeries', de:1, a:20, garde:null, col:'#8f8799',
      desc:"De la pierre, de l'eau qui suinte, et ce qui vit dedans. Rien qui demande une préparation.",
      peril:"Aucun. C'est le seul palier où l'on descend en chemise." },
    { id:'feu', nom:'Les Fournaises', de:21, a:40, garde:'gardefeu', col:'#e0784a',
      desc:"Le sol craque et respire. Par endroits il est rouge en dessous.",
      peril:"La chaleur ronge la compagnie à chaque étage, et fait fondre une part du butin." },
    { id:'venin', nom:'Les Fongères', de:41, a:60, garde:'gardevenin', col:'#8fc04a',
      desc:"Des chapeaux hauts comme des chênes, et des spores qui restent en suspens.",
      peril:"Les spores empoisonnent : les soins ne prennent plus, et les blessures traînent." },
    { id:'gel', nom:'Le Grand Froid', de:61, a:80, garde:'gardegel', col:'#9fd0e0',
      desc:"L'air brûle en entrant. Les torches donnent de la lumière et pas de chaleur.",
      peril:"Tout est plus lent : les gestes, les coups, la descente elle-même." },
    { id:'foudre', nom:'Les Orages Enfouis', de:81, a:100, garde:'gardefoudre', col:'#e6d06a',
      desc:"Il n'y a pas de ciel et pourtant le tonnerre roule dans les galeries.",
      peril:"Les décharges frappent au hasard, et le métal porté attire le trait." },
    { id:'ombre', nom:"L'Envers", de:101, a:120, garde:'gardeombre', col:'#a08fc0',
      desc:"Les lampes éclairent moins loin qu'elles ne devraient. Puis plus du tout.",
      peril:"Ce qu'on ne voit pas frappe en premier, et ce qui tombe ici ne remonte pas." },
  ];
  /* Au-delà du dernier palier, on recommence le cycle — mais l'abîme
     réclame TOUTES les gardes à la fois. */
  function perilDe(etage) {
    etage = Math.max(1, etage | 0);
    if (etage <= 120) return PERILS.find(p => etage >= p.de && etage <= p.a) || PERILS[0];
    const k = Math.floor((etage - 121) / 20) % 5;
    const base = PERILS[1 + k];
    return { id: 'abyme-' + base.id, nom: "L'Abîme — " + base.nom.toLowerCase(),
             de: 121, a: 9999, garde: base.garde, col: '#e0625c', abyme: true,
             desc: "Le même mal, mais il n'y a plus de fond sous vos pattes.",
             peril: base.peril + " Ici, tout compte double." };
  }
  function gardesRequises(etage) {
    const p = perilDe(etage);
    return p.garde ? [p.garde] : [];
  }

  /* =================================================================
     3. LES GARDIENS

     Un tous les dix étages. Le premier passage ouvre le palier ; ensuite
     on peut y retourner autant qu'on veut, et c'est là tout l'intérêt —
     un gardien battu devient une SOURCE, pas un souvenir.
     ================================================================= */
  const G = (etage, nom, desc, butin) => ({ etage, nom, desc, butin });
  const GARDIENS = [
    G(10,  'La Chose du Puits',      "Elle occupait déjà le fond quand on a creusé la margelle.",
      { essence:3, ossuaire:4, ecu:120 }),
    G(20,  'Le Ver de Fond',         "Il ne mord pas : il avale, puis se retire.",
      { essence:5, gemme:1, coeurbiome:1 }),
    G(30,  'La Braise Marcheuse',    "Une silhouette de cendre qui garde la forme d'un chat.",
      { coeurbiome:2, obsidienne:1, cendre:20 }),
    G(40,  'Le Soufflet',            "Une gueule dans la paroi. On l'entend respirer deux étages plus haut.",
      { coeurbiome:3, obsidienne:2, relique:1 }),
    G(50,  'La Mère des Spores',     "Elle ne bouge pas. Tout le reste bouge pour elle.",
      { coeurbiome:3, essence:12, racine:30 }),
    G(60,  'Le Chapeau Noir',        "Un champignon de trois mètres, et deux yeux dessous.",
      { coeurbiome:4, gemme:3, relique:1 }),
    G(70,  'Le Givre Assis',         "Il est là depuis si longtemps que la glace a pris sa forme.",
      { coeurbiome:4, gemme:4, plume:30 }),
    G(80,  'La Reine Blanche',       "Elle n'a pas d'armes. Elle n'en a jamais eu besoin.",
      { coeurbiome:5, obsidienne:4, relique:2 }),
    G(90,  'Le Bruit',               "On ne le voit pas venir : on l'entend arriver depuis trois étages.",
      { coeurbiome:5, ambre:20, gemme:5 }),
    G(100, 'Le Trait Debout',        "Une colonne de foudre qui a décidé de rester.",
      { coeurbiome:6, relique:2, obsidienne:5 }),
    G(110, "L'Absence",              "Il y a quelque chose dans la salle. C'est tout ce qu'on peut en dire.",
      { coeurbiome:7, oeilabyme:1, gemme:8 }),
    G(120, 'Celui qui Regarde',      "Il vous a vu descendre. Il vous voit encore.",
      { coeurbiome:8, oeilabyme:2, relique:4 }),
  ];
  function gardienDe(etage) { return GARDIENS.find(g => g.etage === (etage | 0)) || null; }
  /* Au-delà de la table, les gardiens continuent : même récompense que
     le dernier, augmentée du palier atteint. */
  function gardienPour(etage) {
    etage = etage | 0;
    if (etage % 10) return null;
    const g = gardienDe(etage);
    if (g) return g;
    const der = GARDIENS[GARDIENS.length - 1];
    const k = Math.floor((etage - der.etage) / 10);
    const butin = {};
    for (const id in der.butin) butin[id] = Math.round(der.butin[id] * (1 + k * 0.35));
    return { etage, nom: der.nom + ' — encore', desc: "On croyait en avoir fini.", butin, echo: true };
  }

  window.BUTINS = BUTINS;
  window.ButinUtil = { tableDe };
  window.PERILS = PERILS;
  window.PerilUtil = { perilDe, gardesRequises, GARDIENS, gardienDe, gardienPour };

})();
