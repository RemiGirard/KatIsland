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
    return { actif:true, facteur:boost * cad.vitesse * forme * regul, raison:'', equipe:eq };
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
    }
    return {ok:true,raison:''};
  }

  window.EcosystemesBatiments = { TYPES, CADENCES, gere, definition, personnel, confort,
    disponibilite, equipeHabitant, affecterEquipe, repartirEquipes, ajouterEquipe, retirerEquipe,
    tickHabitant, tick, modifierSorties, finirRecette, peutDemarrer,
    pollinisationCible, humiditeCible, nectarCible, soutienRepos, troupeauMax, reproducteurs };
})();
