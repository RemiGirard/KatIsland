/* ============================================================
   LE BOURG — donnees/equipement-evolutif.js
   Renforcement (1–20), trempe et identité visuelle des uniques.
   ============================================================ */
"use strict";
(function () {
  const GD = window.GameData;
  if (!GD) return;

  GD.ITEM_UPGRADE_MAX = 20;
  GD.TEMPER_AFFIXES = [
    {id:'venin', nom:'Croc venimeux', groupe:'offense', image:'img/objets/aventure/stats/res-poison.png',
      desc:'Les coups peuvent empoisonner la cible.', effet:{kind:'proc',proc:'poison',chance:.11,dps:.04,dur:4}},
    {id:'braise', nom:'Braise enchâssée', groupe:'offense', image:'img/objets/aventure/stats/res-fire.png',
      desc:'Les coups peuvent laisser une brûlure.', effet:{kind:'proc',proc:'burn',chance:.10,dps:.045,dur:3}},
    {id:'critique', nom:'Fil impitoyable', groupe:'offense', image:'img/objets/aventure/stats/rarity.png',
      desc:'Davantage de coups critiques.', effet:{kind:'proc',proc:'crit',chance:.075,mult:1.55}},
    {id:'execution', nom:'Marque du bourreau', groupe:'offense', image:'img/objets/aventure/stats/dmg.png',
      desc:'Frappe plus fort les cibles presque vaincues.', effet:{kind:'proc',proc:'execute',chance:1,threshold:.18,mult:1.38}},
    {id:'perforation', nom:'Pointe cherche-faille', groupe:'offense', image:'img/objets/aventure/stats/armor-pen.png',
      desc:'Certains coups ignorent une part de l’armure.', effet:{kind:'proc',proc:'penetrate',chance:.16,pct:.24}},
    {id:'sangsue', nom:'Sillon de sang', groupe:'offense', image:'img/objets/aventure/stats/lifesteal.png',
      desc:'Une fraction des dégâts rend des points de vie.', effet:{kind:'stat',stat:'lifesteal',add:.025}},
    {id:'vigueur', nom:'Nerf de colosse', groupe:'defense', image:'img/objets/aventure/stats/hp.png',
      desc:'Augmente directement les points de vie.', effet:{kind:'stat',stat:'hp',add:14}},
    {id:'carapace', nom:'Rivet de garde', groupe:'defense', image:'img/objets/aventure/stats/armor.png',
      desc:'Ajoute de l’armure.', effet:{kind:'stat',stat:'armor',add:4}},
    {id:'epines', nom:'Contre-griffe', groupe:'defense', image:'img/objets/aventure/stats/armor.png',
      desc:'Une partie des coups reçus repart chez l’assaillant.', effet:{kind:'proc',proc:'thorns',chance:.22,pct:.14}},
    {id:'esquive', nom:'Charnière féline', groupe:'mobilite', image:'img/objets/aventure/stats/mspd.png',
      desc:'Donne une chance d’esquiver entièrement un coup.', effet:{kind:'proc',proc:'dodge',chance:.055}},
    {id:'cadence', nom:'Ressort vif', groupe:'mobilite', image:'img/objets/aventure/stats/aspd.png',
      desc:'Augmente la vitesse d’attaque.', effet:{kind:'pct',stat:'aspd',pct:.07}},
    {id:'allonge', nom:'Œilleton de portée', groupe:'mobilite', image:'img/objets/aventure/stats/range.png',
      desc:'Augmente la portée des attaques.', effet:{kind:'stat',stat:'range',add:8}},
    {id:'chercheur', nom:'Encoche du chercheur', groupe:'fortune', image:'img/objets/aventure/stats/item-find.png',
      desc:'Augmente la chance de trouver une pièce.', effet:{kind:'meta',stat:'rare',pct:.035}},
    {id:'pilleur', nom:'Sceau du pilleur', groupe:'fortune', image:'img/objets/aventure/stats/loot.png',
      desc:'Augmente les ressources remontées.', effet:{kind:'meta',stat:'loot',pct:.055}},
    {id:'garde_feu', nom:'Cendre froide', groupe:'garde', image:'img/objets/aventure/stats/res-fire.png',
      desc:'Résistance au feu.', effet:{kind:'stat',stat:'resFire',add:.07}},
    {id:'garde_poison', nom:'Filtre de spores', groupe:'garde', image:'img/objets/aventure/stats/res-poison.png',
      desc:'Résistance au poison.', effet:{kind:'stat',stat:'resPoison',add:.07}},
  ];
  GD.temperById = id => GD.TEMPER_AFFIXES.find(x => x.id === id) || null;
  GD.temperEffect = function (trempe) {
    const d = GD.temperById(trempe && trempe.id), e = d && d.effet;
    if (!e) return null;
    const out = Object.assign({}, e), p = Math.max(1, (trempe.puissance | 0) || 1);
    /* Cinq rangs lisibles : la trempe progresse avec le renforcement de
       la pièce sans demander un second jet aléatoire. */
    const k = 1 + (p - 1) * .18;
    for (const cle of ['add','pct','chance','dps']) if (typeof out[cle] === 'number') out[cle] *= k;
    return out;
  };

  GD.itemUpgradeCost = function (item) {
    const n = Math.max(0, item && (item.amelioration | 0));
    if (n >= GD.ITEM_UPGRADE_MAX) return null;
    const t = Math.max(1, item.tier | 0), c = { ecu:Math.round((45 + n * n * 18) * (1 + t * .22)) };
    if (n < 4) c.limaille = 2 + n;
    else if (n < 8) { c.acier = 1 + Math.floor((n - 4) / 2); c.limaille = 4; }
    else if (n < 12) { c.gemme = 1 + Math.floor((n - 8) / 2); c.poussiere_trempe = 1; }
    else if (n < 16) { c.obsidienne = 1 + Math.floor((n - 12) / 2); c.eclatnuee = 1; }
    else if (n < 19) { c.coeurbiome = 1; c.sceauancien = 1 + Math.floor((n - 16) / 2); }
    else { c.relique = 1; c.oeilabyme = 1; c.sceauancien = 2; }
    return c;
  };
  GD.temperCost = function (item, slot) {
    const t = Math.max(1, item.tier | 0), n = Math.max(0, item.amelioration | 0);
    const c = { poussiere_trempe:1 + Math.floor(t / 5), limaille:2 + Math.floor(n / 4), ecu:120 + t * 45 + n * 25 };
    if (slot > 0) c.sceauancien = 1;
    return c;
  };
  GD.itemUpgradeMult = item => 1 + Math.max(0, Math.min(GD.ITEM_UPGRADE_MAX, item && (item.amelioration | 0))) * .0525;

  GD.uniqueById = id => (GD.UNIQUES || []).find(x => x.id === id) || null;
  /* Les noms d'image restent déterministes : une illustration peut être
     ajoutée par planche sans modifier à nouveau la logique. */
  for (const u of (GD.UNIQUES || [])) u.image = 'img/objets/aventure/uniques/' + u.id + '.png';

  GD.TRESORS_AVENTURE = [
    {id:'tresor-coffret-nuee', nom:'Coffret de la Nuée', tier:1, bonus:{loot:0.025}, desc:'Il bourdonne quand une cache se trouve derrière un mur.'},
    {id:'tresor-idole-neuf-vies', nom:'Idole des neuf vies', tier:1, bonus:{xp:0.025}, desc:'Elle a déjà été cassée huit fois. Cela rassure moyennement.'},
    {id:'tresor-couronne-fond', nom:'Couronne du Fond', tier:2, bonus:{rare:0.012}, desc:'Elle ne va à personne, ce qui ne l’empêche pas d’exiger un coussin.'},
    {id:'tresor-carte-effacee', nom:'Carte effacée', tier:2, bonus:{speed:0.03}, desc:'Les chemins disparaissent derrière le doigt, mais jamais devant.'},
    {id:'tresor-cle-abyme', nom:'Clé de l’Abîme', tier:3, bonus:{rare:0.018}, desc:'Elle ouvre quelque chose. Le problème consiste à trouver quoi.'},
    {id:'tresor-oeuf-cristal', nom:'Œuf de cristal', tier:3, bonus:{xp:0.04}, desc:'Il est tiède, lumineux et unanimement déclaré « pas inquiétant ».'},
    {id:'tresor-reliquaire', nom:'Reliquaire oublié', tier:4, bonus:{loot:0.04}, desc:'La serrure a disparu ; le contenu tient pourtant à rester discret.'},
    {id:'tresor-boussole-noire', nom:'Boussole noire', tier:4, bonus:{speed:0.05}, desc:'Son aiguille pointe toujours vers le bas. Dans la Tour, c’est utile.'},
    {id:'tresor-lanterne-ame', nom:'Lanterne d’âme', tier:5, bonus:{xp:0.055}, desc:'La petite lumière connaît le chemin et juge les détours.'},
    {id:'tresor-des-maudit', nom:'Dés maudits', tier:5, bonus:{rare:0.028,loot:0.025}, desc:'Ils font toujours douze. Même quand on n’en lance qu’un.'},
  ];
  for (const t of GD.TRESORS_AVENTURE) t.image = 'img/objets/aventure/uniques/' + t.id + '.png';
  GD.tresorById = id => GD.TRESORS_AVENTURE.find(x => x.id === id) || null;

  /* Les gardiens sont les sources garanties des matériaux impossibles à
     fabriquer. Les activités ordinaires en donnent parfois, les boss en
     donnent toujours : la progression n'est jamais entièrement soumise au dé. */
  for (const g of (window.GARDIENS || [])) {
    g.butin.poussiere_trempe = Math.max(g.butin.poussiere_trempe || 0, 1 + Math.floor(g.etage / 20));
    if (g.etage % 20 === 0) g.butin.sceauancien = Math.max(g.butin.sceauancien || 0, 1);
    if (g.etage >= 30 && g.etage <= 40) g.butin.braisevivante = 1;
    if (g.etage >= 50 && g.etage <= 60) g.butin.veninreine = 1;
    if (g.etage >= 70 && g.etage <= 80) g.butin.givreancien = 1;
    if (g.etage >= 90) g.butin.eclatnuee = 1 + Math.floor((g.etage - 80) / 30);
  }
})();
