/* ============================================================
   LE BOURG — 3d/port3d.js
   LES NAVIRES, AMARRÉS ET APPAREILLANT.

   La flotte existait déjà, mais seulement en chiffres : une ligne dans
   une fenêtre disait « en mer, 96 s ». On ne voyait rien partir. Ce
   module donne un corps à ce que `js/port.js` compte — un bateau par
   navire, au bout du ponton du port, qui s'en va quand on l'envoie.

   QUATRE PIÈCES, comme dans habitants3d.js :

   1. LE QUAI. Le port est un modèle `bordEau` du document : il jette un
      ponton vers le large, et `Village.pontonDe()` en rend le bout et le
      cap. On ne devine donc aucune position — la scène le sait déjà. Pas
      de port bâti, pas de ponton, pas de module : on ne dessine rien.

   2. LE MODÈLE. Une coque en virures, un pont, une étrave qui se jette
      en avant, un tableau relevé, un château, un gouvernail, des mâts et
      des voiles. Que des boîtes, des aplats, des arêtes franches : la
      langue du village. La TAILLE suit le palier de cale — la barque de
      vingt places et la nef de mille ne sont pas le même bateau.

   3. LE TRAJET. `nav.etat` dit tout, et `1 - reste/total` dit où il en
      est. À quai il tangue ; en mer il s'éloigne, voile pleine, sillage
      derrière ; au mouillage il est devant une île lointaine, donc hors
      de vue — on ne dessine pas ce qui n'est pas là ; au retour il
      revient et évite pour venir à couple.

   4. LE GESTE. Rien de brusque : roulis lent, voile qui respire, moustache
      d'étrave qui grossit avec l'erre, traces d'écume qui s'élargissent
      et s'effacent derrière la poupe.

   BRANCHEMENT. `app.js` appelle déjà `window.Port3D.tick(dt)` dans
   l'abonné unique de `Village.surTick`. On ne s'abonne surtout PAS
   nous-mêmes : `surTick` n'accepte qu'un abonné et l'écrase, on ferait
   taire les habitants.

   -> window.Port3D
   ============================================================ */
"use strict";
(function () {

  const D = () => window.__VDOC;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------
     LES NOMBRES DE LA MISE EN SCÈNE

     LE PLAN D'EAU EST À ZÉRO. `geometrieEau` du document est une nappe
     plate posée à l'origine, la terre est à SOL = 0,06 et le tablier du
     ponton à 0,02. La ligne de flottaison d'un navire est donc l'origine
     de son modèle : la carène passe dessous, le pont dessus.

     LA DEMI-LARGEUR DU TABLIER (0,34) est le seul nombre qu'on emprunte
     à `ponton()` de village-doc.js — village3d.js en duplique déjà trois
     autres pour la même raison : le document ne les expose pas. S'il
     élargit son ponton, c'est ici qu'il faut le suivre.
     ------------------------------------------------------------------ */
  const MER        = 0;
  const QUAI_DEMI  = 0.34;     // demi-largeur du tablier du ponton
  const ECART_QUAI = 0.07;     // le pare-battage entre la coque et le bois

  /* LE DÉHALAGE. Les navires d'un même bord se rangent l'un derrière
     l'autre EN S'ÉCARTANT VERS LE LARGE : le troisième rang est donc
     droit devant le premier sur le chemin de la sortie, et à la même
     distance du quai à deux ou trois centimètres près. Celui qui
     appareille commence donc par se déhaler — il s'écarte du quai
     jusqu'à passer au large de tout ce qui est rangé devant lui — et ne
     prend de l'avant qu'ensuite. Sans cela la nef du premier rang
     traversait la barque du troisième, mâts et voiles compris, pendant
     une seconde et demie ; et autant au retour, qui refait le même
     chemin à l'envers.

     `DEHALE` est la part de course dépensée à s'écarter — elle est
     prise sur la sortie, qui en reste plus longue que le plus gros
     navire ; `MARGE_BORD` l'eau qu'on laisse entre deux coques qui se
     doublent. */
  const DEHALE     = 0.9;
  const MARGE_BORD = 0.10;

  /* LA SORTIE. Un navire ne traverse pas l'océan sous les yeux du
     joueur : il sort du champ. Le temps de cette sortie est un QUART de
     la traversée, plafonné : une traversée de cinq minutes ne doit pas
     donner un bateau qui rampe pendant une minute et quart.

     La course était de huit unités — à peine plus de deux fois la
     longueur d'une nef. Le navire s'évanouissait donc en pleine rade, et
     cela se lisait comme une panne d'affichage, pas comme un départ. On
     l'envoie maintenant deux fois plus loin, et on le fait PASSER SOUS
     L'HORIZON au lieu de l'éteindre : la coque s'enfonce d'abord, la
     mâture disparaît en dernier. C'est ainsi qu'un bateau s'en va — et
     cela évite de toucher aux matières, qui sont mises en cache et
     partagées avec la jetée. */
  const SORTIE     = 16.5;
  const VUE_PART   = 0.25;
  const VUE_MAX    = 26;
  const PLONGEE    = 0.30;     // part de la course où la coque passe sous l'eau
  const FOND       = 0.95;     // de combien on l'enfonce, en unités de monde

  /* LE MÔLE. Le document ne jette qu'un appontement court — celui de la
     pêcherie, quinze pas sur pilotis. Un PORT, lui, s'allonge : c'est sa
     seule façon de montrer qu'il grandit, et c'est ce qui rend lisible le
     nombre de navires qu'il peut tenir. On le bâtit donc ici, depuis le
     bout du tablier du document et vers le large, et on le rallonge à
     chaque niveau. La longueur est calculée pour que les postes
     d'amarrage tombent SUR le bois et non au-delà : un bateau amarré
     dans le vide se voit tout de suite.

     Six niveaux, six longueurs. Le premier môle tient une barque, le
     dernier une flotte de six. */
  const MOLE_BASE  = 2.2;
  const MOLE_PAS   = 1.45;
  const MOLE_QUAIS = [1, 2, 2, 3, 4, 6];   // navires tenus, par niveau de port



  /* Le sillage : des nappes d'écume semées derrière la poupe, qui
     s'élargissent en s'effaçant. Sept suffisent — au-delà on ne lit plus
     une traînée mais une flaque. */
  const TRACES     = 7;
  const TRACE_VIE  = 3.6;
  const TRACE_PAS  = 0.26;     // distance entre deux semis

  /* ------------------------------------------------------------------
     LES GABARITS, par palier de cale (window.IleUtil.CALES).
     Barque, chaloupe, cogue, caraque, galion, nef de haut bord. La
     progression est celle de la cale : on la lit à l'œil sans compter
     les places. Une cellule du village fait environ une unité et un
     étage 0,62 — la nef en fait donc plus de deux de long et de haut,
     et c'est voulu : c'est la fin de la partie.
     ------------------------------------------------------------------ */
  const GABARITS = [
    { L:0.82, W:0.29, creux:0.13, tirant:0.08, mat:0.52, voile:[0.34,0.30], mats:1, poupe:0.00, postes:4  },
    { L:1.02, W:0.35, creux:0.16, tirant:0.09, mat:0.66, voile:[0.44,0.40], mats:1, poupe:0.06, postes:6  },
    { L:1.26, W:0.42, creux:0.20, tirant:0.11, mat:0.84, voile:[0.56,0.52], mats:1, poupe:0.11, postes:8  },
    { L:1.56, W:0.50, creux:0.24, tirant:0.13, mat:1.02, voile:[0.68,0.62], mats:2, poupe:0.16, postes:10 },
    { L:1.90, W:0.60, creux:0.29, tirant:0.15, mat:1.22, voile:[0.82,0.74], mats:2, poupe:0.21, postes:12 },
    { L:2.30, W:0.70, creux:0.34, tirant:0.18, mat:1.46, voile:[0.98,0.88], mats:3, poupe:0.26, postes:14 },
  ];

  /* La mâture : pour chaque mât, sa place le long de la coque (en part de
     longueur, l'étrave vers +X) et son importance. Le grand mât porte la
     grand-voile ; les autres sont plus courts et moins toilés. */
  const MATURE = [
    [[ 0.06, 1.00]],
    [[ 0.22, 1.00], [-0.20, 0.64]],
    [[ 0.30, 0.70], [ 0.00, 1.00], [-0.28, 0.60]],
  ];

  /* Une couleur par navire, pour la flamme de tête de mât et la bande de
     coque : deux bateaux au même quai doivent se distinguer. */
  const PAVILLONS = ['#c33c33','#4d6fa3','#57a19c','#e8a03c','#9a5b8e','#7ba05b','#dd6f3f'];
  const ROBES = ['#e2a94e','#efe6d2','#8d8578','#c9a24a','#5f5a52','#b4763f','#7f6a52'];

  /* ---- l'état du module ---- */
  let groupe = null;                     // créé au premier navire, jamais avant
  const flotteurs = new Map();           // id de navire -> son bateau
  let horloge = 0;
  let quai = null, quaiT = 1e9;          // le ponton du port, relu de loin en loin
  let mole = null, moleNiv = -1;         // la jetée bâtie, et pour quel niveau

  /* ==================================================================
     LES COULEURS

     Le document sort en sRGB (`renderer.outputEncoding`) et fait passer
     toutes ses teintes par `convertSRGBToLinear`. Une couleur posée
     brute sortirait délavée à côté du bois du ponton : on emprunte la
     même conversion, et le bateau est du même bois que le quai.
     ================================================================== */
  const cacheCoul = new Map(), cacheMat = new Map();
  function lin(hex) {
    if (!cacheCoul.has(hex)) cacheCoul.set(hex, new THREE.Color(hex).convertSRGBToLinear());
    return cacheCoul.get(hex);
  }
  function mat(hex) {
    if (!cacheMat.has(hex))
      cacheMat.set(hex, new THREE.MeshLambertMaterial({ color: lin(hex) }));
    return cacheMat.get(hex);
  }
  /* L'écume est peinte, pas éclairée : c'est de la mousse vue de dessus,
     elle ne prend pas le soleil. Chaque navire a la sienne — l'opacité
     suit son erre. `renderOrder` la met APRÈS la nappe d'eau du document
     (2) et son ressac (3), sinon la mer translucide la recouvrirait. */
  function matEcume(op) {
    const m = new THREE.MeshBasicMaterial({
      color: lin('#f2f7f6'), transparent: true, opacity: op || 0,
      depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    return m;
  }

  const BOIS = '#7c5c3e', PLANCHE = '#a58963', SOMBRE = '#5d4835', PONT = '#9a8059';
  const TOILE = '#efe6d2', TOILE_ROULEE = '#e0d5b9';

  function hache(s) {
    let n = 0; s = String(s);
    for (let i = 0; i < s.length; i++) n = (Math.imul(n, 31) + s.charCodeAt(i)) | 0;
    return Math.abs(n);
  }
  /* L'ÉLAN DE LA SORTIE. Un navire qui largue ses amarres démarre
     doucement, puis fait sa route à vitesse tenue — il ne ralentit pas
     en arrivant à l'horizon. Une courbe en S le faisait, et cela se
     voyait : la voile retombait et le sillage mourait juste avant qu'il
     ne s'efface, comme s'il se garait au milieu de la rade.
     On accélère donc sur les quatre premiers dixièmes, puis on file
     droit. Les deux morceaux se raccordent en valeur ET en pente, et
     l'ensemble vaut bien 0 en 0 et 1 en 1. Rejouée à l'envers pour le
     retour, la même courbe donne exactement ce qu'il faut : plein
     erre en surgissant du large, et l'on se range en douceur. */
  const elan = u => {
    u = u < 0 ? 0 : (u > 1 ? 1 : u);
    return (u <= 0.4 ? u * u * 1.25 : u - 0.2) / 0.8;
  };

  /* ==================================================================
     1. LES GÉOMÉTRIES PARTAGÉES

     Un cube unité mis à l'échelle pour chaque pièce, une nappe plate
     pour l'écume : deux géométries pour toute la flotte. Seules les
     voiles ont la leur, parce qu'on les déforme.
     ================================================================== */
  let G = null;
  function geometries() {
    if (G) return G;
    const nappe = new THREE.PlaneGeometry(1, 1);
    nappe.rotateX(-Math.PI / 2);         // à plat sur l'eau, une fois pour toutes
    G = { cube: new THREE.BoxGeometry(1, 1, 1), nappe };
    return G;
  }
  function boite(w, h, d, hex) {
    const m = new THREE.Mesh(G.cube, mat(hex));
    m.scale.set(w, h, d);
    return m;
  }

  /* ==================================================================
     2. LE MODÈLE

     Repère local : l'étrave vers +X, le bâbord-tribord sur Z, la ligne
     de flottaison à y = 0. Le cap monde s'obtient par `rotation.y = -cap`
     — une rotation de a autour de Y envoie +X sur (cos a, 0, -sin a), et
     l'on veut (cos cap, 0, sin cap).
     ================================================================== */

  /* LA VOILE. Segmentée pour pouvoir se creuser, et DÉ-INDEXÉE parce que
     le village est rendu à facettes : `computeVertexNormals` sur une
     géométrie non indexée donne la normale de la face à ses trois
     sommets, donc des aplats francs — exactement ce que fait le document
     en montant ses murs. C'est aussi pour cela qu'on ne peut pas se
     contenter de `flatShading` : en r128, MeshLambertMaterial éclaire au
     sommet et ignore ce drapeau. */
  function creerVoile(w, h) {
    const plan = new THREE.PlaneGeometry(w, h, 6, 4);
    plan.translate(0, -h / 2, 0);        // pendue SOUS la vergue, non centrée
    plan.rotateY(Math.PI / 2);           // la largeur passe en travers du navire
    const geo = plan.toNonIndexed();
    plan.dispose();
    const p = geo.attributes.position.array;
    const n = p.length / 3;
    const base = Float32Array.from(p);
    const u = new Float32Array(n), v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      u[i] = base[3 * i + 2] / w + 0.5;  // 0 et 1 aux ralingues, 0,5 au milieu
      v[i] = -base[3 * i + 1] / h;       // 0 à la vergue, 1 à la bordure basse
    }
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: lin(TOILE), side: THREE.DoubleSide,
    }));
    m.userData = { base, u, v, ampleur: w * 0.30 };
    m.visible = false;
    return m;
  }

  /* Une silhouette d'unité : un corps, une tête, parfois une lance. Sa
     taille NE SUIT PAS celle du bateau — un chat mesure ce qu'il mesure,
     et c'est ce qui fait comprendre qu'une barque est petite. */
  function creerSilhouette(cle, avecLance) {
    const g = new THREE.Group();
    const robe = ROBES[hache(cle) % ROBES.length];
    const corps = boite(0.055, 0.115, 0.050, robe);
    corps.position.y = 0.075;
    g.add(corps);
    const tete = boite(0.058, 0.052, 0.052, robe);
    tete.position.y = 0.160;
    g.add(tete);
    if (avecLance) {
      const l = boite(0.016, 0.235, 0.016, SOMBRE);
      l.position.set(0.036, 0.125, 0);
      l.rotation.z = -0.14;
      g.add(l);
    }
    return g;
  }

  /* ------------------------------------------------------------------
     LE MÔLE

     Repère local identique à celui des navires : +X vers le large, la
     ligne de flottaison à y = 0. On le pose au bout du tablier du
     document et on l'oriente sur le cap du ponton, exactement comme un
     bateau — ainsi la jetée et la flotte ne peuvent pas diverger.
     ------------------------------------------------------------------ */
  function longueurMole(niv) {
    return MOLE_BASE + Math.max(0, (niv | 0) - 1) * MOLE_PAS;
  }
  function quaisDuNiveau(niv) {
    const k = Math.max(1, Math.min(MOLE_QUAIS.length, niv | 0));
    return MOLE_QUAIS[k - 1];
  }

  function creerMole(niv) {
    geometries();
    const Lm = longueurMole(niv);
    const g = new THREE.Group();
    g.userData.niv = niv;
    g.userData.L = Lm;
    const yd = 0.02;                       // le tablier affleure le document

    /* LE TABLIER, en lattes. On les pose une par une plutôt qu'en un
       seul pavé : le village entier est fait d'aplats à arêtes franches,
       et une planche unique de neuf unités se lirait comme un radeau. */
    const n = Math.max(6, Math.round(Lm / 0.17));
    for (let k = 0; k < n; k++) {
      const l0 = Lm * k / n, l1 = Lm * (k + 1) / n - 0.012;
      const lame = boite(l1 - l0, 0.035, QUAI_DEMI * 2,
                         (k % 3 === 0) ? '#9c8058' : PLANCHE);
      lame.position.set((l0 + l1) / 2, yd, 0);
      g.add(lame);
    }

    /* LES PILOTIS. Par paires, sous les deux rives du tablier, plantés
       jusque sous l'eau — c'est ce qui donne au môle son épaisseur vue
       de la berge. */
    for (let l = 0.32; l < Lm; l += 0.86) {
      for (const w of [-QUAI_DEMI, QUAI_DEMI]) {
        const pieu = boite(0.06, 0.72, 0.06, SOMBRE);
        pieu.position.set(l, yd - 0.36, w);
        g.add(pieu);
      }
    }

    /* LES BOLLARDS, un par poste et par bord : le joueur compte les
       bittes d'amarrage et sait combien de navires le port tiendra. */
    const quais = quaisDuNiveau(niv);
    for (let i = 0; i < quais; i++) {
      const l = Math.min(Lm - 0.22, 0.55 + Math.floor(i / 2) * 2.6 + 0.5);
      const w = (i % 2 ? 1 : -1) * (QUAI_DEMI - 0.05);
      const bitte = boite(0.075, 0.16, 0.075, '#6d5a44');
      bitte.position.set(l, yd + 0.08, w);
      g.add(bitte);
      const tete = boite(0.11, 0.035, 0.11, '#5d4835');
      tete.position.set(l, yd + 0.17, w);
      g.add(tete);
    }

    /* LA GRUE À CHÈVRE, au bout. Deux jambes, une flèche inclinée, un
       palan : c'est elle qui dit « port » et non « appontement ». */
    const pied = Lm - 0.42;
    for (const w of [-0.17, 0.17]) {
      const jambe = boite(0.055, 0.62, 0.055, BOIS);
      jambe.position.set(pied, yd + 0.31, w);
      jambe.rotation.z = w > 0 ? -0.10 : 0.10;
      g.add(jambe);
    }
    const fleche = boite(0.72, 0.05, 0.05, BOIS);
    fleche.position.set(pied + 0.22, yd + 0.68, 0);
    fleche.rotation.z = -0.42;
    g.add(fleche);
    const palan = boite(0.03, 0.26, 0.03, SOMBRE);
    palan.position.set(pied + 0.50, yd + 0.72, 0);
    g.add(palan);
    const crochet = boite(0.09, 0.09, 0.09, '#6d5a44');
    crochet.position.set(pied + 0.50, yd + 0.58, 0);
    g.add(crochet);

    /* Deux caisses et un tonneau : le quai sert à quelque chose. */
    const caisse = boite(0.17, 0.15, 0.15, '#8a6a4e');
    caisse.position.set(Lm * 0.36, yd + 0.09, -0.10);
    g.add(caisse);
    const tonneau = boite(0.14, 0.17, 0.14, '#7a6248');
    tonneau.position.set(Lm * 0.52, yd + 0.10, 0.12);
    g.add(tonneau);
    return g;
  }

  /* On ne rebâtit la jetée que si le port a CHANGÉ DE NIVEAU : c'est une
     géométrie fixe, elle n'a rien à faire dans la boucle d'images. */
  function assurerMole() {
    const b = window.Etat.batsDeType('port')[0];
    const niv = b ? (b.niv || 1) : 1;
    const g = poser();
    if (mole && moleNiv === niv) { placerMole(); return; }
    if (mole) { g.remove(mole); liberer(mole); }
    mole = creerMole(niv);
    moleNiv = niv;
    g.add(mole);
    placerMole();
  }
  function placerMole() {
    if (!mole || !quai) return;
    mole.position.set(quai.x, MER, quai.z);
    mole.rotation.y = -quai.cap;
  }

  function creerNavire(nav) {
    geometries();
    const k = Math.max(0, Math.min(GABARITS.length - 1, nav.palier | 0));
    const g = GABARITS[k];
    const pavillon = PAVILLONS[hache(nav.id) % PAVILLONS.length];

    const grp = new THREE.Group();
    /* LA COQUE TANGUE, L'ÉCUME NON. Une moustache d'étrave qui prendrait
       le roulis s'enfoncerait dans l'eau d'un bord et volerait de
       l'autre : elle vit dans son propre sous-groupe, toujours à plat. */
    const coque = new THREE.Group(); grp.add(coque);
    const ecume = new THREE.Group(); grp.add(ecume);

    /* --- la carène : trois virures qui s'élargissent en montant. Ce
       n'est pas un ventre rond, mais de loin ça se lit comme tel, et les
       arêtes restent franches. --- */
    const fond = boite(g.L * 0.84, g.tirant * 0.74, g.W * 0.52, SOMBRE);
    fond.position.set(-g.L * 0.02, -g.tirant * 0.64, 0);
    coque.add(fond);
    const ventre = boite(g.L * 0.94, g.tirant * 0.84, g.W * 0.82, BOIS);
    ventre.position.set(-g.L * 0.01, -g.tirant * 0.26, 0);
    coque.add(ventre);
    const borde = boite(g.L, g.creux, g.W, BOIS);
    borde.position.set(0, g.creux * 0.5 - 0.012, 0);
    coque.add(borde);

    /* la bande de coque, aux couleurs du navire */
    const bande = boite(g.L * 1.004, g.creux * 0.22, g.W * 1.006, pavillon);
    bande.position.set(0, g.creux * 0.74, 0);
    coque.add(bande);

    /* --- le pont et ses plats-bords --- */
    const pont = boite(g.L * 0.92, 0.026, g.W * 0.86, PONT);
    pont.position.set(0, g.creux - 0.012, 0);
    coque.add(pont);
    for (const s of [-1, 1]) {
      const l = boite(g.L * 0.99, 0.032, 0.040, SOMBRE);
      l.position.set(0, g.creux + 0.010, s * (g.W * 0.5 - 0.020));
      coque.add(l);
    }

    /* --- l'étrave se jette en avant, le tableau se relève : c'est ce
       couple-là qui fait qu'une boîte devient un bateau. --- */
    const etrave = boite(0.055, g.creux * 2.0, g.W * 0.34, SOMBRE);
    etrave.position.set(g.L * 0.50, g.creux * 0.66, 0);
    etrave.rotation.z = -0.42;
    coque.add(etrave);
    const tableau = boite(0.048, g.creux * 1.30, g.W * 0.80, SOMBRE);
    tableau.position.set(-g.L * 0.50, g.creux * 0.62, 0);
    tableau.rotation.z = 0.28;
    coque.add(tableau);

    /* --- le château arrière : il n'apparaît qu'à partir de la chaloupe,
       et c'est lui qui donne leur silhouette aux gros. --- */
    let pontArriere = g.creux;
    if (g.poupe > 0) {
      const chateau = boite(g.L * 0.22, g.poupe, g.W * 0.72, BOIS);
      chateau.position.set(-g.L * 0.33, g.creux + g.poupe * 0.5, 0);
      coque.add(chateau);
      const dunette = boite(g.L * 0.24, 0.022, g.W * 0.74, PONT);
      dunette.position.set(-g.L * 0.33, g.creux + g.poupe + 0.010, 0);
      coque.add(dunette);
      pontArriere = g.creux + g.poupe + 0.021;
    }

    /* --- le gouvernail, et la barre que le barreur tient --- */
    const safran = boite(0.030, (g.creux + g.tirant) * 1.15, g.W * 0.20, SOMBRE);
    safran.position.set(-(g.L * 0.50 + 0.030), g.creux * 0.26 - g.tirant * 0.40, 0);
    safran.rotation.z = 0.22;
    coque.add(safran);
    const barre = new THREE.Group();
    barre.position.set(-g.L * 0.46, pontArriere + 0.052, 0);
    const manche = boite(g.L * 0.17, 0.024, 0.024, PLANCHE);
    manche.position.x = g.L * 0.085;
    barre.add(manche);
    coque.add(barre);

    /* --- la mâture et la toile --- */
    const voiles = [];
    let grand = null;
    for (const [xr, part] of MATURE[Math.min(MATURE.length - 1, g.mats - 1)]) {
      const hm = g.mat * (0.70 + 0.30 * part);
      const x = g.L * xr;
      const m = boite(0.042, hm, 0.042, PLANCHE);
      m.position.set(x, g.creux + hm * 0.5, 0);
      coque.add(m);

      const vw = g.voile[0] * part, vh = g.voile[1] * part;
      const yv = g.creux + hm * 0.90;
      const vergue = boite(0.030, 0.030, vw * 1.12, SOMBRE);
      vergue.position.set(x, yv, 0);
      coque.add(vergue);

      const v = creerVoile(vw, vh);
      v.position.set(x, yv - 0.020, 0);
      coque.add(v);
      /* la toile serrée sur sa vergue : c'est elle qu'on voit à quai */
      const rouleau = boite(0.056, 0.056, vw, TOILE_ROULEE);
      rouleau.position.set(x, yv - 0.046, 0);
      coque.add(rouleau);

      voiles.push({ v, rouleau });
      if (!grand || part >= grand.part) grand = { x, haut: g.creux + hm, part };
    }

    /* --- la flamme de tête de mât. C'est le seul endroit où l'on dit le
       vent : elle file vers l'avant, comme la voile se creuse vers
       l'avant. Le navire porte toujours vent arrière — on ne modélise ni
       le près ni le louvoyage, ce serait un autre jeu. --- */
    const flamme = new THREE.Group();
    flamme.position.set(grand.x, grand.haut + 0.030, 0);
    const etoffe = boite(0.17, 0.028, 0.008, pavillon);
    etoffe.position.x = 0.085;
    flamme.add(etoffe);
    coque.add(flamme);

    /* --- l'équipage. Le barreur est toujours là : un bateau sans
       personne à la barre n'a l'air ni parti ni amarré, il a l'air
       abandonné. Les autres sont la cale, et n'apparaissent qu'à
       proportion de ce qu'elle porte. --- */
    const barreur = creerSilhouette(nav.id + ':barre', false);
    barreur.position.set(-g.L * 0.38, pontArriere, 0);
    coque.add(barreur);

    const bord = [];
    const rangs = Math.max(1, Math.ceil(g.postes / 2));
    for (let i = 0; i < g.postes; i++) {
      const s = creerSilhouette(nav.id + ':' + i, i % 3 !== 2);
      const r = Math.floor(i / 2);
      const t = rangs > 1 ? r / (rangs - 1) : 0.5;
      /* jamais sur l'axe : les mâts y sont. Un rang de chaque bord. */
      s.position.set(-g.L * 0.26 + t * g.L * 0.52, g.creux, (i % 2 ? 1 : -1) * g.W * 0.19);
      s.rotation.y = (hache(nav.id + i) % 100) / 100 * TAU;
      s.visible = false;
      coque.add(s);
      bord.push(s);
    }

    /* --- l'écume d'étrave : deux nappes en V, ouvertes vers l'arrière.
       Elles partagent une matière — leur opacité dit la vitesse. --- */
    const matM = matEcume(0);
    const moustaches = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(G.nappe, matM);
      w.scale.set(g.L * 0.60, 1, g.W * 0.26);
      w.position.set(g.L * 0.22, 0.013, s * g.W * 0.30);
      w.rotation.y = s * 0.55;
      w.renderOrder = 6;
      ecume.add(w);
      moustaches.push(w);
    }

    grp.userData = {
      g, coque, ecume, voiles, flamme, barre, barreur, bord,
      moustaches, matM, palier: k,
    };
    return grp;
  }

  /* Les matières et les deux géométries de base sont PARTAGÉES : on ne
     détruit que ce qui appartient en propre au navire — la toile de ses
     voiles, la matière de son écume, celles de ses traces. */
  function liberer(grp) {
    const d = grp.userData || {};
    for (const s of (d.voiles || [])) if (s.v.geometry) { s.v.geometry.dispose(); s.v.material.dispose(); }
    if (d.matM) d.matM.dispose();
  }
  function libererSillage(f) {
    for (const t of (f.traces || [])) {
      if (groupe) groupe.remove(t.mesh);
      t.mesh.material.dispose();
    }
    f.traces = null;
    f.xs = null;
  }

  /* ==================================================================
     3. LE QUAI

     `Village.pontons()` parcourt tout le bourg : c'est bon marché mais
     pas gratuit, et le ponton ne bouge que si l'on bâtit. On le relit
     donc quatre fois par seconde au plus.

     On ne retient QUE le ponton du port : la pêcherie en a un aussi, et
     l'on n'amarre pas une nef au bout d'un ponton de pêcheur. Un chantier
     de port se pose en bloc nu, sans part `ponton` — il n'en rend donc
     aucun, et la flotte reste invisible tant que le port n'est pas fini.
     ================================================================== */
  function relireQuai(dt) {
    quaiT += dt;
    if (quaiT < 0.75) return quai;
    quaiT = 0;
    quai = null;
    const V = window.Village;
    if (!V || !V.batiments || !V.pontonDe) return null;
    for (const b of V.batiments()) {
      if (b.type !== 'port' || b.pour) continue;
      const p = V.pontonDe(b.id);
      if (p) { quai = p; break; }
    }
    return quai;
  }

  /* LE PLAN D'AMARRAGE. Le premier navire se met à couple du bout du
     ponton, le deuxième de l'autre bord, et l'on continue en s'écartant
     vers le large.

     Il se décide pour la flotte ENTIÈRE, et non navire par navire : la
     place qu'il faut derrière un bateau dépend de la taille de SON
     VOISIN, pas de la sienne. En comptant chacun sur sa propre longueur,
     une barque rangée derrière une nef venait se loger dans son flanc.
     On tient donc, pour chaque bord, jusqu'où le quai est pris.

     Le premier de chaque bord est poussé juste assez pour que sa poupe
     déborde le tablier au lieu de s'encastrer dans la grève : un gros
     bateau dépasse le ponton, il ne rentre pas dedans. */
  function amarrer(flotte) {
    const pris = [null, null];               // jusqu'où le quai est occupé, par bord
    const ranges = [];
    let rang = 0;
    for (const nav of flotte) {
      const f = flotteurs.get(nav.id);
      if (!f || !f.objet) continue;
      const g = f.objet.userData.g;
      const b = rang % 2;                    // on alterne les bords
      const mini = Math.max(0.05, g.L * 0.5 - 0.55);
      const a = pris[b] == null ? mini : pris[b] + g.L * 0.5;
      pris[b] = a + g.L * 0.5 + 0.30;
      f.poste = { avance: a, lateral: (b ? 1 : -1) * (QUAI_DEMI + g.W * 0.5 + ECART_QUAI) };
      f.rang = rang++;
      ranges.push({ f, g, b });
    }

    /* LE COULOIR DE CHACUN, une fois la file connue. Ne gênent un navire
       que ceux qui sont rangés PLUS AU LARGE que lui sur son bord : ce
       sont les seuls qu'il doublera en sortant, et les seuls qu'il
       rencontrera en rentrant. On relève donc, en remontant la file,
       jusqu'où l'eau est prise en travers, et l'on se range au-delà —
       de sa propre demi-largeur, plus la marge. Le dernier de chaque
       bord n'a personne devant lui : il sort tout droit de son poste,
       et une flotte d'un ou deux navires ne bouge donc pas d'un pouce
       par rapport à avant.

       Ce sont les POSTES qu'on dégage. Deux navires qui appareillent en
       même temps du même bord restent à la charge du hasard : les
       écarter l'un de l'autre demanderait un couloir par rang, et le
       plus intérieur d'une flotte de six s'en irait alors de biais sur
       plus d'une cellule et demie avant de prendre sa route. */
    const dehors = [null, null];
    for (let k = ranges.length - 1; k >= 0; k--) {
      const { f, g, b } = ranges[k], p = f.poste;
      const dedans = Math.abs(p.lateral);
      p.couloir = dehors[b] == null ? p.lateral
        : (b ? 1 : -1) * Math.max(dedans, dehors[b] + g.W * 0.5 + MARGE_BORD);
      /* Qui sort tout droit ne se déhale pas : sans cela le navire seul
         d'un petit port restait sept secondes immobile à son poste
         avant de s'ébranler, pour un écart qu'il n'avait pas à faire. */
      p.dehale = Math.abs(p.couloir - p.lateral) > 1e-6 ? DEHALE : 0;
      dehors[b] = Math.max(dehors[b] == null ? 0 : dehors[b], dedans + g.W * 0.5);
    }
  }

  /* ==================================================================
     D'OÙ PART CETTE TRAVERSÉE ?

     `etat === 'mer'` ne dit pas d'où l'on appareille. `Port.continuer()`
     — le bouton « pousser plus loin » — remet un navire en mer ALORS
     QU'IL EST AU MOUILLAGE devant une île, à quinze lieues d'ici :
     `reste` repasse à `total`, la course retombe donc à zéro, et le
     navire se matérialisait le long du ponton pour rejouer tout un
     appareillage qui n'a jamais eu lieu. Le joueur voyait partir du
     bourg un bateau que la fenêtre du port annonçait entre deux îles.

     Seule la transition « à quai -> en mer » est un appareillage. On
     retient donc l'état précédent, que le module est le seul à
     connaître : la sauvegarde, elle, ne garde que l'état courant.

     AU PREMIER REGARD — module qui démarre, partie rechargée — il n'y a
     pas d'état précédent. On tranche alors sur la durée de la
     traversée : un appareillage se compte sur l'éloignement de l'île
     depuis le bourg, un passage d'île en île sur l'écart entre les deux
     (port.js). Les deux nombres coïncident dans quelques cas, et l'on
     rejouera alors un départ de trop juste après un rechargement — ce
     qui reste très au-dessous du départ fantôme à chaque « pousser plus
     loin ».
     ================================================================== */
  function partiDuBourg(nav) {
    const IU = window.IleUtil;
    const ile = IU && IU.parId ? IU.parId(nav.ile) : null;
    if (!ile) return false;
    return nav.total === IU.traversee(ile.lieues, nav.palier);
  }
  function suivreEtat(f, nav) {
    if (nav.etat !== 'mer') f.duPonton = false;
    else if (f.etatVu === 'quai') f.duPonton = true;
    else if (f.etatVu == null) f.duPonton = partiDuBourg(nav);
    else if (f.etatVu !== 'mer') f.duPonton = false;   // mouillage -> mer : on pousse plus loin
    f.etatVu = nav.etat;
  }

  /* OÙ EN EST LE NAVIRE, EN UNITÉS DE MONDE.
     `null` veut dire « hors de vue » : au mouillage, ou déjà trop loin.
     C'est cette valeur qui décide de tout le travail qui suit. */
  function courseDe(nav, f) {
    if (nav.etat === 'quai') return 0;
    if (nav.etat !== 'mer' && nav.etat !== 'retour') return null;
    const total = Math.max(1, nav.total || 1);
    const vue = Math.max(1, Math.min(total * VUE_PART, VUE_MAX));
    if (nav.etat === 'mer') {
      if (f && !f.duPonton) return null;    // il fait route d'île en île, loin d'ici
      const ecoule = total - Math.max(0, nav.reste);
      return ecoule >= vue ? null : SORTIE * elan(ecoule / vue);
    }
    return nav.reste >= vue ? null : SORTIE * elan(nav.reste / vue);
  }

  function capVers(a, b, k) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    return a + d * k;
  }

  /* ==================================================================
     4. LE MOUVEMENT ET LES GESTES
     ================================================================== */

  function situer(f, nav, d, dt) {
    const p = f.poste;
    const px = -quai.dz, pz = quai.dx;         // la perpendiculaire au ponton
    /* ON SE DÉHALE D'ABORD, ON PREND DE L'AVANT ENSUITE — voir le
       couloir, plus haut. Les premières unités de course ne servent
       qu'à s'écarter du quai ; l'avance ne commence qu'une fois le
       couloir gagné, et le navire est alors sûr de doubler au large de
       ses voisins. Le retour rejoue la même chose à l'envers : on
       descend le couloir, puis on se range à son poste. */
    const dh = p.dehale || 0;
    const s = dh > 0 ? Math.min(1, Math.max(0, d / dh)) : 1;
    const couloir = p.couloir == null ? p.lateral : p.couloir;
    const travers = p.lateral + (couloir - p.lateral) * s * s * (3 - 2 * s);
    const route = Math.max(0, d - dh);         // ce qui reste est de la route
    const le = p.avance + route;               // le long du ponton, puis au large
    const tx = quai.x + quai.dx * le + px * travers;
    const tz = quai.z + quai.dz * le + pz * travers;

    /* LE CAP. Amarré ou sortant, il regarde le large — c'est le cap du
       ponton. Rentrant, il vient face à la terre, PUIS il évite pour se
       ranger le long du quai : c'est cette abattée qui fait qu'un retour
       ne ressemble pas à une marche arrière. Elle se compte sur la ROUTE
       qui lui reste, pas sur la course : le déhalage n'est pas de la
       distance parcourue vers le quai. */
    let capCible = quai.cap;
    if (nav.etat === 'retour' && route > 1.1) capCible = quai.cap + Math.PI;

    if (f.neuf) {
      f.x = tx; f.z = tz; f.cap = capCible; f.neuf = false;
      f.xp = tx; f.zp = tz; f.vitesse = 0;
    } else {
      /* Le rattrapage hors-ligne déplace `reste` d'un bloc : sans ce
         garde-fou, le navire traverserait la rade en une image, avec un
         sillage de comète. Au-delà d'un saut manifeste, on le repose. */
      if (Math.hypot(tx - f.x, tz - f.z) > 2.5) { f.x = tx; f.z = tz; f.xp = tx; f.zp = tz; }
      else {
        const k = Math.min(1, dt * 3.2);
        f.x += (tx - f.x) * k; f.z += (tz - f.z) * k;
      }
      f.cap = capVers(f.cap, capCible, Math.min(1, dt * 1.4));
    }

    const v = Math.hypot(f.x - f.xp, f.z - f.zp) / Math.max(dt, 1e-4);
    f.vitesse += (v - f.vitesse) * Math.min(1, dt * 4);
    f.xp = f.x; f.zp = f.z;

    /* HULL DOWN. Sur la fin de la course, le navire s'enfonce sous la
       ligne d'horizon : c'est la disparition d'un bateau qui s'éloigne, et
       non un objet qu'on éteint. Le même calcul sert au retour, joué à
       l'envers puisque `d` y décroît — il émerge donc en approchant. */
    const part = Math.min(1, d / SORTIE);
    const sous = part <= 1 - PLONGEE ? 0
               : Math.pow((part - (1 - PLONGEE)) / PLONGEE, 1.7) * FOND;
    f.objet.position.set(f.x, MER - sous, f.z);
    f.objet.rotation.y = -f.cap;
  }

  function animer(f, nav, dt) {
    const d = f.objet.userData;
    const g = d.g;
    const t = horloge + f.phase;
    const enMer = nav.etat !== 'quai';
    /* L'ERRE, rapportée à l'allure de route — `SORTIE`, divisé par le
       temps de sortie, tombe entre 0,39 et 0,51 unité par seconde selon
       la longueur de la traversée. Prendre 0,45 pour référence fait donc
       qu'un navire qui fait sa route est bien à 1. C'est elle qui règle
       l'écume et la gîte : ce qui dépend du MOUVEMENT de la coque. */
    const erre = Math.min(1, f.vitesse / 0.45);

    /* --- LE TANGAGE. L'axe long du modèle est X : le roulis tourne
       autour de X, le tangage autour de Z. Lent, très lent : un bateau
       amarré respire, il ne danse pas. --- */
    const houle = 0.55 + erre * 0.55;
    d.coque.rotation.x = Math.sin(t * 0.62) * (0.032 + erre * 0.030) * houle;
    d.coque.rotation.z = Math.sin(t * 0.47 + 1.2) * (0.020 + erre * 0.026) * houle;
    d.coque.position.y = Math.sin(t * 0.78) * 0.012 + erre * g.tirant * 0.10;

    /* --- LA VOILE. Serrée à quai, elle se déploie en sortant : le
       joueur voit la toile tomber de la vergue au moment où le bateau
       s'écarte du bois, et c'est ce petit décalage qui rend le départ
       agréable. --- */
    const vise = enMer ? 1 : 0;
    f.deploi += (vise - f.deploi) * Math.min(1, dt * (vise ? 0.55 : 1.6));
    const ouverte = f.deploi > 0.03;
    for (const s of d.voiles) {
      s.rouleau.visible = f.deploi < 0.97;
      s.rouleau.scale.y = 0.056 * Math.max(0.12, 1 - f.deploi);
      s.v.visible = ouverte;
      if (!ouverte) continue;
      s.v.scale.y = f.deploi;
      /* LE CREUX SUIT LE VENT, PAS LA COQUE. Une toile établie reste
         pleine, que le bateau accélère ou non — l'accrocher à l'erre
         faisait respirer la voile au rythme du déplacement, ce qui
         donnait une toile molle au moment le plus visible du départ. */
      creuser(s.v, t, 0.74 + erre * 0.26);
    }

    /* la flamme file vers l'avant et bat : deux sinus décalés suffisent */
    d.flamme.rotation.y = Math.sin(t * 2.3) * (0.10 + erre * 0.22);
    d.flamme.rotation.z = -0.10 - erre * 0.18 + Math.sin(t * 1.7) * 0.07;

    /* le barreur corrige sa route, face à l'étrave ; à quai la barre dort */
    d.barre.rotation.y = enMer ? Math.sin(t * 0.9) * 0.30 : Math.sin(t * 0.25) * 0.05;
    d.barreur.rotation.y = Math.sin(t * 0.9) * 0.18;

    /* --- L'ÉQUIPAGE À BORD. On ne pose pas une silhouette par unité —
       une nef de mille en réclamerait mille. On lit le REMPLISSAGE de la
       cale et l'on garnit le pont d'autant : un bateau plein se voit
       plein, un bateau à moitié chargé se voit à moitié. --- */
    const pris = window.Port.placesPrises(nav.cargo || []);
    const n = pris <= 0 ? 0
      : Math.max(1, Math.min(d.bord.length,
          Math.round(d.bord.length * pris / Math.max(1, nav.places || 1))));
    if (n !== f.aBord) {
      for (let i = 0; i < d.bord.length; i++) d.bord[i].visible = i < n;
      f.aBord = n;
    }
    for (let i = 0; i < n; i++)
      d.bord[i].position.y = g.creux + Math.abs(Math.sin(t * 0.9 + i * 1.7)) * 0.008;

    /* --- LA MOUSTACHE D'ÉTRAVE. Elle ne vit que par la vitesse : à quai
       il n'y a rien à voir, et une écume permanente ferait croire que le
       bateau force sur ses amarres. --- */
    d.matM.opacity = erre * 0.42 * (0.82 + Math.sin(t * 3.1) * 0.18);
    const etale = 1 + erre * 0.55;
    for (const m of d.moustaches) m.scale.x = g.L * 0.60 * etale;
    d.ecume.visible = erre > 0.04;
  }

  /* LE CREUX DE LA VOILE. Le vent porte de l'arrière : la toile se creuse
     vers l'avant (+X). Nulle au guindant qu'on a envergué, maximale aux
     deux tiers de la chute, et jamais aux ralingues qui sont tenues. */
  function creuser(v, t, force) {
    const u = v.userData;
    const pos = v.geometry.attributes.position;
    const p = pos.array, b = u.base, n = p.length / 3;
    const A = u.ampleur * force;
    for (let i = 0; i < n; i++) {
      const c = Math.sin(Math.PI * u.u[i]) * Math.sin(Math.PI * u.v[i] * 0.78);
      p[3 * i] = b[3 * i] + A * c * (0.80 + 0.20 * Math.sin(t * 1.7 + u.v[i] * 3.1));
    }
    pos.needsUpdate = true;
    /* la géométrie est non indexée : chaque face reçoit sa propre
       normale, la toile reste à facettes comme le reste du village */
    v.geometry.computeVertexNormals();
  }

  /* ==================================================================
     5. LE SILLAGE

     Des nappes semées derrière la poupe, qui s'élargissent en pâlissant.
     Elles vivent dans le repère du MONDE, pas dans celui du bateau :
     une trace posée reste où elle a été posée, c'est tout le principe.
     Rien n'est alloué tant qu'un navire n'a pas bougé.
     ================================================================== */
  function assurerSillage(f) {
    if (f.traces) return f.traces;
    f.traces = [];
    for (let i = 0; i < TRACES; i++) {
      const m = new THREE.Mesh(G.nappe, matEcume(0));
      m.renderOrder = 5;
      m.visible = false;
      groupe.add(m);
      f.traces.push({ mesh: m, age: 1e9 });
    }
    f.suivante = 0;
    f.semis = 0;
    return f.traces;
  }

  function sillage(f, dt) {
    const bouge = f.vitesse > 0.06;
    if (!f.traces && !bouge) return;             // pas d'erre, pas de dépense
    const traces = assurerSillage(f);
    const g = f.objet.userData.g;

    if (bouge) {
      /* la première trace se sème tout de suite ; les suivantes tous les
         TRACE_PAS RÉELLEMENT parcourus, jamais au rythme de l'horloge —
         sinon la traînée se resserre dès que le navire ralentit */
      if (f.xs == null) { f.xs = f.x; f.zs = f.z; f.semis = TRACE_PAS; }
      else f.semis += Math.hypot(f.x - f.xs, f.z - f.zs);
      if (f.semis >= TRACE_PAS) {
        f.semis = 0;
        const t = traces[f.suivante];
        f.suivante = (f.suivante + 1) % TRACES;
        /* semée à la poupe, dans l'axe du navire */
        t.mesh.position.set(f.x - Math.cos(f.cap) * g.L * 0.5, 0.011,
                            f.z - Math.sin(f.cap) * g.L * 0.5);
        t.mesh.rotation.y = -f.cap;
        t.age = 0;
        t.force = Math.min(1, f.vitesse / 0.55);
      }
      f.xs = f.x; f.zs = f.z;
    } else { f.xs = null; }

    for (const t of traces) {
      if (t.age > TRACE_VIE) { if (t.mesh.visible) t.mesh.visible = false; continue; }
      t.age += dt;
      const a = t.age / TRACE_VIE;
      t.mesh.visible = true;
      t.mesh.material.opacity = (1 - a) * (1 - a) * 0.34 * (t.force || 1);
      t.mesh.scale.set(TRACE_PAS * 2.4, 1, g.W * (0.85 + a * 1.9));
    }
  }

  /* ==================================================================
     6. L'ORCHESTRE
     ================================================================== */

  function poser() {
    if (!groupe) {
      groupe = new THREE.Group();
      groupe.name = 'flotte';
      D().scene.add(groupe);
    }
    return groupe;
  }

  function accorder(flotte) {
    const g = poser();
    const vivants = new Set();
    for (const nav of flotte) {
      vivants.add(nav.id);
      let f = flotteurs.get(nav.id);
      if (!f) {
        f = { id: nav.id, x: 0, z: 0, xp: 0, zp: 0, xs: null, zs: null,
              cap: 0, vitesse: 0, deploi: 0, aBord: -1, neuf: true,
              phase: (hache(nav.id) % 1000) / 1000 * 40, traces: null, rang: 0,
              etatVu: null, duPonton: false };
        flotteurs.set(nav.id, f);
      }
      /* la cale s'agrandit : ce n'est plus le même bateau, on le rebâtit */
      const k = Math.max(0, Math.min(GABARITS.length - 1, nav.palier | 0));
      if (!f.objet || f.objet.userData.palier !== k) {
        if (f.objet) { g.remove(f.objet); liberer(f.objet); }
        f.objet = creerNavire(nav);
        f.aBord = -1; f.neuf = true;
        g.add(f.objet);
      }
    }
    for (const [id, f] of Array.from(flotteurs)) {
      if (vivants.has(id)) continue;
      if (f.objet) { g.remove(f.objet); liberer(f.objet); }
      libererSillage(f);
      flotteurs.delete(id);
    }
    /* les postes se répartissent une fois la flotte connue : voir amarrer() */
    amarrer(flotte);
  }

  /* Le battement. Il est appelé par l'abonné unique de `Village.surTick`,
     dans app.js — voir l'en-tête. */
  function tout(dt) {
    /* PREMIER GARDE-FOU : rien n'est chargé, ou le bourg n'a pas de port.
       On sort avant même d'avoir créé un groupe dans la scène. */
    if (!window.__VDOC || !window.Port || !window.Village || !window.Etat || !window.THREE) return;
    if (!window.Port.aLePort()) { if (groupe) groupe.visible = false; return; }

    /* DEUXIÈME : le port est peut-être encore en chantier — un bloc nu
       n'a pas de ponton, et sans ponton on ne sait pas où amarrer. */
    if (!relireQuai(dt)) { if (groupe) groupe.visible = false; return; }

    /* TROISIÈME : un port sans navire. Cela n'arrive qu'un instant, mais
       cela n'a pas à coûter une scène. */
    const flotte = window.Port.navires();
    if (!flotte || !flotte.length) { if (groupe) groupe.visible = false; return; }

    horloge += dt;
    accorder(flotte);
    /* LA JETÉE. Elle suit le niveau du port et non la flotte : on la
       vérifie une fois par image, mais on ne la rebâtit qu'au niveau
       suivant. */
    assurerMole();
    groupe.visible = true;

    for (const nav of flotte) {
      const f = flotteurs.get(nav.id);
      if (!f || !f.objet) continue;

      /* QUATRIÈME, et le plus payant : un navire au mouillage est devant
         une île à quinze lieues d'ici. Il n'est pas dans le décor, on ne
         le déplace pas, on ne creuse pas sa voile, on ne compte pas sa
         cale. On efface seulement le sillage qu'il a laissé en partant. */
      suivreEtat(f, nav);
      const d = courseDe(nav, f);
      if (d == null) {
        if (f.objet.visible) { f.objet.visible = false; f.neuf = true; f.vitesse = 0; }
        if (f.traces) { sillage(f, dt); if (f.traces.every(t => !t.mesh.visible)) libererSillage(f); }
        continue;
      }

      f.objet.visible = true;
      situer(f, nav, d, dt);
      animer(f, nav, dt);
      sillage(f, dt);
    }
  }

  window.Port3D = {
    tick: tout,
    /* le quai tel que le module le voit — utile pour vérifier d'où part
       un navire sans avoir à ouvrir la scène */
    quai() { return quai ? { x: quai.x, z: quai.z, cap: quai.cap, bat: quai.id } : null; },
    get compte() { return flotteurs.size; },
    /* la jetée telle qu'elle est bâtie : longueur et postes */
    mole() { return mole ? { niv: moleNiv, L: +mole.userData.L.toFixed(2),
                             quais: quaisDuNiveau(moleNiv) } : null; },
    etats() {
      const out = [];
      for (const [id, f] of flotteurs)
        out.push({ id, rang: f.rang, x: +f.x.toFixed(3), z: +f.z.toFixed(3),
                   cap: +f.cap.toFixed(3), vitesse: +f.vitesse.toFixed(3),
                   /* la hauteur de coque : nulle au quai, négative quand
                      le navire passe sous l'horizon */
                   y: f.objet ? +f.objet.position.y.toFixed(3) : 0,
                   deploi: +f.deploi.toFixed(2), aBord: f.aBord,
                   visible: !!(f.objet && f.objet.visible),
                   /* d'où part la traversée en cours, et où passe le
                      navire quand il double ses voisins */
                   duPonton: !!f.duPonton,
                   couloir: f.poste ? +f.poste.couloir.toFixed(3) : 0,
                   palier: f.objet ? f.objet.userData.palier : -1 });
      return out;
    },
  };

})();
