/* ============================================================
   LE BOURG — js/vie-village.js
   Le village comme lieu habité : propreté, sécurité, loisirs et moral
   individuel. Les valeurs sont dérivées de ce qui existe à l'écran ;
   elles ne sont jamais des jauges décoratives sans cause.
   ============================================================ */
"use strict";
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const E = () => window.Etat.E;

  const PLAINTES = {
    faim: ["Mon estomac vient de déposer une réclamation.", "Le menu du jour ressemble beaucoup au menu d'hier : rien."],
    sale: ["La rue colle aux pattes. La rue nie tout.", "J'ai trouvé un balai. Il cherchait son employé."],
    peur: ["Quelqu'un a encore dit que la Nuée était ‘presque là’.", "Les remparts grincent plus fort que le garde."],
    ennui: ["J'ai compté les tuiles. Deux fois.", "Même la pelote refuse de sortir."],
    logement: ["Mon lit est occupé. Par son propriétaire, paraît-il.", "Nous sommes trois dans une chambre prévue pour deux chats et demi."],
    travail: ["Je produis, donc je suis fatigué.", "Mon outil connaît mieux mes pattes que moi."],
    bien: ["Aujourd'hui, le bourg ronronne juste.", "Rien ne brûle et la soupe est chaude : méfiance."],
  };

  function assurerHabitant(h) {
    if (!h.vie || typeof h.vie !== 'object') h.vie = {};
    const v = h.vie;
    if (typeof v.moral !== 'number') v.moral = 55;
    if (typeof v.cible !== 'number') v.cible = v.moral;
    if (!v.humeur) v.humeur = 'stable';
    if (!v.plainte) v.plainte = PLAINTES.bien[0];
    if (typeof v.revision !== 'number') v.revision = 0;
    /* La vigueur est une réserve individuelle, persistante et lisible.
       Elle ne remplace ni le moral ni les compétences : elle raconte si
       cet habitant peut encore donner son meilleur aujourd'hui. */
    if (typeof v.vigueur !== 'number') v.vigueur = 82;
    if (!v.pauses || typeof v.pauses !== 'object') v.pauses = {};
    return v;
  }

  const ROULEMENTS_SCIERIE = {
    souple:{ id:'souple', nom:'Équipe libre', niveau:3, equipes:[],
      desc:'Aucun horaire imposé. Les ouvriers volants prennent seulement leurs pauses automatiques.' },
    deux12:{ id:'deux12', nom:'Deux relèves de 12 h', niveau:3,
      equipes:[['Aube',6,12],['Veillée',18,12]],
      desc:'Deux équipes réelles couvrent la journée sans interruption.' },
    trois8:{ id:'trois8', nom:'Trois relèves de 8 h', niveau:5,
      equipes:[['Aube',6,8],['Jour',14,8],['Nuit',22,8]],
      desc:'Trois groupes courts : excellente récupération, mais davantage d’organisation.' },
    personnalise:{ id:'personnalise', nom:'Planning personnalisé', niveau:5, equipes:[],
      desc:'Les heures de début et la durée de chaque équipe sont réglées librement.' },
    croise:{ id:'croise', nom:'Relèves croisées de 10 h', niveau:6,
      equipes:[['Lisière',5,10],['Halle',13,10],['Roue',21,10]],
      desc:'Les équipes se chevauchent deux heures aux changements de charge.' },
    deux16:{ id:'deux16', nom:'Deux longues journées', niveau:7,
      equipes:[['Grand jour',5,16],['Grande nuit',17,16]],
      desc:'Une forte couverture avec beaucoup de chevauchement, difficile à soutenir sans confort.' },
  };
  const COULEURS_EQUIPES = ['#82a866','#d0a64f','#6f9db4','#b47a70'];
  const CADENCES_SCIERIE = {
    menagee:{ id:'menagee', nom:'Cadence ménagée', vitesse:0.84, fatigue:0.58, rythme:1.35,
      desc:'Moins de débit maintenant, davantage de vigueur et un rythme de lame très stable.' },
    normale:{ id:'normale', nom:'Cadence régulière', vitesse:1, fatigue:1, rythme:1,
      desc:'Le compromis de référence pour un atelier qui doit tourner longtemps.' },
    soutenue:{ id:'soutenue', nom:'Cadence soutenue', vitesse:1.23, fatigue:1.55, rythme:0.62,
      desc:'Un vrai surcroît de production, payé par des pauses plus fréquentes.' },
    forcage:{ id:'forcage', nom:'Forçage de la lame', vitesse:1.48, fatigue:2.35, rythme:-0.75,
      desc:'Un pic brutal. La vigueur et la synchronisation de l’atelier s’effondrent si on insiste.' },
  };

  function personnelScierie(b) {
    if (!b.personnelScierie || typeof b.personnelScierie !== 'object') b.personnelScierie = {};
    const p = b.personnelScierie;
    const anciens={h12:'deux12',h8:'trois8',h16:'deux16'};
    if(!p.roulement) p.roulement=anciens[p.horaire]||p.horaire||'souple';
    if(!ROULEMENTS_SCIERIE[p.roulement]) p.roulement='souple';
    if (!CADENCES_SCIERIE[p.cadence]) p.cadence = 'normale';
    if (typeof p.autoRepos !== 'boolean') p.autoRepos = true;
    if (typeof p.seuilRepos !== 'number') p.seuilRepos = 24;
    if (typeof p.seuilRetour !== 'number') p.seuilRetour = 68;
    if (!p.confort || typeof p.confort !== 'object') p.confort = {};
    if (!p.affectations || typeof p.affectations !== 'object') p.affectations = {};
    if (!Array.isArray(p.equipes)) p.equipes = [];
    if (!p.equipes.length && ROULEMENTS_SCIERIE[p.roulement].equipes.length) {
      p.equipes = construireEquipes(p.roulement);
      repartirEquipes(b);
    }
    return p;
  }
  function construireEquipes(mode) {
    const def=ROULEMENTS_SCIERIE[mode]||ROULEMENTS_SCIERIE.souple;
    return (def.equipes||[]).map((e,i)=>({id:'e'+(i+1),nom:e[0],debut:e[1],duree:e[2],couleur:COULEURS_EQUIPES[i]}));
  }
  function ouvriersScierie(b) {
    return (b.postes||[]).filter(p=>p.hab).map(p=>E().habitants.find(h=>h.id===p.hab)).filter(Boolean);
  }
  function repartirEquipes(b) {
    const p=personnelScierie(b), ouv=ouvriersScierie(b);
    p.affectations={};
    if(!p.equipes.length) return p;
    /* Serpentin plutôt qu'aléatoire : les meilleurs et les moins avancés
       se répartissent entre les équipes au lieu de former une super-équipe. */
    ouv.sort((a,z)=>(z.niv||1)-(a.niv||1));
    const ordre=p.equipes.concat(p.equipes.slice(1,-1).reverse());
    ouv.forEach((h,i)=>{p.affectations[h.id]=ordre[i%ordre.length].id;});
    return p;
  }
  function appliquerRoulement(b, mode, repartir) {
    const p=personnelScierie(b), def=ROULEMENTS_SCIERIE[mode];
    if(!def || b.niv < def.niveau) return false;
    p.roulement=mode; p.horaire=mode;
    if(mode === 'personnalise') {
      if(!p.equipes.length) p.equipes=construireEquipes('deux12');
    } else p.equipes=construireEquipes(mode);
    const valides=new Set(p.equipes.map(e=>e.id));
    for(const hid in p.affectations) if(!valides.has(p.affectations[hid])) delete p.affectations[hid];
    if(repartir) repartirEquipes(b);
    return true;
  }
  function equipeHabitant(h,b) {
    const p=personnelScierie(b), id=p.affectations[h.id];
    return p.equipes.find(e=>e.id===id)||null;
  }
  function affecterEquipe(b,hid,eid) {
    const p=personnelScierie(b);
    if(!eid){delete p.affectations[hid];return true;}
    if(!p.equipes.some(e=>e.id===eid))return false;
    p.affectations[hid]=eid;return true;
  }
  function confortScierie(b) {
    const p = personnelScierie(b), c = p.confort;
    const banc = c.banc || 0, cantine = c.cantine || 0, poele = c.poele || 0, vestiaire = c.vestiaire || 0;
    return {
      niveau:banc+cantine+poele+vestiaire,
      recuperation:1 + banc*0.12 + cantine*0.09 + poele*0.08,
      fatigue:Math.max(0.55, 1 - cantine*0.06 - poele*0.05 - vestiaire*0.05),
      moral:cantine*1.5 + poele*1.2 + vestiaire,
      rythme:banc*0.025 + vestiaire*0.025,
    };
  }
  function dansHoraire(h, b) {
    const eq=equipeHabitant(h,b);
    if(!eq) return true;                         // ouvrier volant
    const heure=(E().heure*24+24)%24;
    const x=(heure-eq.debut+24)%24;
    return x < eq.duree;
  }
  function disponibiliteTravail(h, b) {
    if (!h || !b) return { actif:true, facteur:1, raison:'' };
    if (b.type !== 'scierie') {
      if (window.EcosystemesBatiments && window.EcosystemesBatiments.gere(b))
        return window.EcosystemesBatiments.disponibilite(h,b);
      return { actif:true, facteur:1, raison:'' };
    }
    const vie=assurerHabitant(h), cfg=personnelScierie(b);
    if(!dansHoraire(h,b)) return { actif:false, facteur:0, raison:'hors relève' };
    if(cfg.autoRepos && vie.pauses[b.id]) return { actif:false, facteur:0, raison:'pause automatique' };
    const eq=equipeHabitant(h,b), cad=CADENCES_SCIERIE[cfg.cadence];
    const vigueur=clamp(vie.vigueur,0,100);
    const forme=vigueur>=82 ? 1.04 : (vigueur>=48 ? 0.92+vigueur*0.0015 : 0.54+vigueur*0.009);
    const rythme=0.96+clamp(b.rythmeScierie||0,0,100)*0.0016;
    /* Une heure planifiée représente une tranche plus concentrée que le
       travail souple. Ainsi 8 h ne divisent pas la production par trois. */
    const boost=eq?clamp(0.88/(eq.duree/24),0.9,2.45):1;
    return { actif:true, facteur:boost*cad.vitesse*forme*rythme, raison:'', equipe:eq };
  }

  function sommeEffet(cle) {
    let n = 0;
    for (const bid in E().bat) {
      const b = E().bat[bid], d = window.BAT[b.type];
      if (!d || !d.effet || !d.effet[cle]) continue;
      const postes = (b.postes || []).filter(p => p.hab).length;
      const actif = b.postes && b.postes.length ? Math.max(0.35, postes / b.postes.length) : 1;
      n += d.effet[cle] * (1 + 0.28 * Math.max(0, b.niv - 1)) * actif;
    }
    return n;
  }

  function etatVillage() {
    const e = E();
    if (!e.village || typeof e.village !== 'object') e.village = {};
    const v = e.village;
    for (const k of ['propreteBonus','securiteBonus','loisirBonus','entretienBonus'])
      if (typeof v[k] !== 'number') v[k] = 0;
    const pop = Math.max(1, e.habitants.length);
    const logements = Math.max(1, window.Etat.logementTotal());
    const occupation = pop / logements;
    const endommages = Object.values(e.bat).filter(b => b.endommage > 0).length;
    const vivres = ['poisson','pain','tourte','poissonfume','fromage'].reduce((n,id) => n + window.Etat.qte(id), 0);

    v.proprete = clamp(62 - Math.max(0, pop - 4) * 1.7 - endommages * 5
      + sommeEffet('proprete') + v.propreteBonus, 0, 100);
    v.securite = clamp(52 + sommeEffet('securite') + sommeEffet('defense') * 0.32
      + ((e.armee && e.armee.garnison) || 0) * 1.5 - (e.menace || 0) * 0.38
      - endommages * 4 + v.securiteBonus, 0, 100);
    v.loisir = clamp(38 + sommeEffet('loisir') + sommeEffet('moral') * 1.1
      - Math.max(0, pop - 8) * 0.8 + v.loisirBonus, 0, 100);
    v.logement = clamp(100 - Math.max(0, occupation - 0.70) * 135, 0, 100);
    v.repas = e.famine ? 3 : clamp(45 + (vivres / pop) * 4.5, 35, 100);
    v.entretien = clamp(72 - endommages * 18 + v.entretienBonus, 0, 100);
    v.harmonie = Math.round(v.proprete * 0.20 + v.securite * 0.25 + v.loisir * 0.18
      + v.logement * 0.16 + v.repas * 0.16 + v.entretien * 0.05);
    return v;
  }

  function humeurPour(n) {
    if (n >= 86) return 'rayonnant';
    if (n >= 70) return 'content';
    if (n >= 50) return 'stable';
    if (n >= 30) return 'morose';
    return 'à bout';
  }
  function clePlainte(v, h) {
    if (assurerHabitant(h).vigueur < 25) return 'travail';
    const valeurs = [
      ['faim', v.repas], ['sale', v.proprete], ['peur', v.securite],
      ['ennui', v.loisir], ['logement', v.logement],
    ].sort((a,b) => a[1] - b[1]);
    if (valeurs[0][1] < 52) return valeurs[0][0];
    if (h.aff && valeurs[0][1] < 70) return 'travail';
    return 'bien';
  }
  function choisirPhrase(h, cle) {
    const l = PLAINTES[cle] || PLAINTES.bien;
    let n = 0, s = String(h.id || '') + ':' + Math.floor(E().tJeu / 90);
    for (let i = 0; i < s.length; i++) n = (Math.imul(n, 33) + s.charCodeAt(i)) | 0;
    return l[Math.abs(n) % l.length];
  }

  function tick(dt) {
    const e = E(), ville = etatVillage();
    const village = e.village;
    /* Les actions municipales créent un répit, pas un bonus éternel. */
    const decay = Math.max(0, dt) * 0.018;
    for (const k of ['propreteBonus','securiteBonus','loisirBonus','entretienBonus'])
      village[k] = Math.max(0, (village[k] || 0) - decay);
    for (const h of e.habitants) {
      const vie = assurerHabitant(h);
      let batTravail=null, poste=null;
      if(h.aff && h.aff.k === 'poste'){
        batTravail=e.bat[h.aff.bat];
        poste=batTravail && batTravail.postes && batTravail.postes[h.aff.i];
      }
      if(batTravail && batTravail.type === 'scierie'){
        const cfg=personnelScierie(batTravail), cad=CADENCES_SCIERIE[cfg.cadence], conf=confortScierie(batTravail);
        if(cfg.autoRepos){
          if(vie.vigueur <= cfg.seuilRepos) vie.pauses[batTravail.id]=true;
          if(vie.vigueur >= cfg.seuilRetour) delete vie.pauses[batTravail.id];
        }
        const actif=dansHoraire(h,batTravail) && !vie.pauses[batTravail.id] && poste && !poste.bloque;
        if(actif) vie.vigueur=clamp(vie.vigueur-dt*0.062*cad.fatigue*conf.fatigue,0,100);
        else vie.vigueur=clamp(vie.vigueur+dt*0.22*conf.recuperation*(0.72+ville.loisir/180),0,100);
      }else if(batTravail && window.EcosystemesBatiments && window.EcosystemesBatiments.gere(batTravail)){
        window.EcosystemesBatiments.tickHabitant(h,batTravail,poste,dt,ville);
      }else if(batTravail && poste && !poste.bloque){
        /* Fondation pour le reste du village : l'usure existe déjà, mais
           le rythme de pauses implicite maintient un équilibre jusqu'à ce
           que chaque bâtiment reçoive sa propre gestion du personnel. */
        const cibleVigueur=clamp(58+ville.loisir*0.20,58,78);
        const pasV=1-Math.exp(-Math.max(0,dt)/620);
        vie.vigueur=clamp(vie.vigueur+(cibleVigueur-vie.vigueur)*pasV,0,100);
      }else vie.vigueur=clamp(vie.vigueur+dt*0.065*(0.72+ville.loisir/180),0,100);
      let cible = ville.harmonie + window.HAB.somme(h, 'moral') * 4;
      if (h.aff && h.aff.k === 'chantier') cible -= 5;
      if (h.aff && h.aff.k === 'poste') {
        const b = e.bat[h.aff.bat];
        if (b && b.endommage > 0) cible -= 9;
        if (b && b.postes[h.aff.i] && b.postes[h.aff.i].bloque) cible -= 4;
        if (b && b.type === 'scierie') {
          const cfg=personnelScierie(b), conf=confortScierie(b);
          cible += conf.moral;
          if(cfg.cadence === 'forcage') cible -= 8;
          else if(cfg.cadence === 'soutenue') cible -= 3;
        } else if (b && window.EcosystemesBatiments && window.EcosystemesBatiments.gere(b)) {
          const cfg=window.EcosystemesBatiments.personnel(b), conf=window.EcosystemesBatiments.confort(b);
          cible += conf.moral;
          if(cfg.cadence === 'forcage') cible -= 8;
          else if(cfg.cadence === 'soutenue') cible -= 3;
        }
      }
      if(vie.vigueur < 25) cible -= (25-vie.vigueur)*0.34;
      vie.cible = clamp(cible, 0, 100);
      const pas = 1 - Math.exp(-Math.max(0, dt) / 150);
      vie.moral = clamp(vie.moral + (vie.cible - vie.moral) * pas, 0, 100);
      vie.humeur = humeurPour(vie.moral);
      vie.revision -= dt;
      if (vie.revision <= 0) {
        const cle = clePlainte(ville, h);
        vie.plainte = choisirPhrase(h, cle);
        vie.revision = 65 + (Math.abs(String(h.id).length * 17) % 50);
      }
    }
    /* Le twist de la scierie : le rythme ne s'achète pas. Il se gagne en
       maintenant une équipe en forme à une cadence cohérente. Un forçage
       donne du débit tout de suite mais détruit ce capital lent. */
    for(const bid in e.bat){
      const b=e.bat[bid]; if(b.type !== 'scierie') continue;
      const ouv=(b.postes||[]).filter(p=>p.hab).map(p=>e.habitants.find(h=>h.id===p.hab)).filter(Boolean);
      const cfg=personnelScierie(b), cad=CADENCES_SCIERIE[cfg.cadence], conf=confortScierie(b);
      const moyenne=ouv.length?ouv.reduce((n,h)=>n+assurerHabitant(h).vigueur,0)/ouv.length:0;
      let cibleRythme=!ouv.length?0:clamp(24+(moyenne>=42&&moyenne<=88?56:18)+conf.rythme*100,0,100);
      if(cad.rythme<0) cibleRythme=Math.min(cibleRythme,18);
      else cibleRythme=clamp(cibleRythme*cad.rythme,0,100);
      const pasR=1-Math.exp(-Math.max(0,dt)/(cad.rythme<0?34:115));
      b.rythmeScierie=clamp((b.rythmeScierie||0)+(cibleRythme-(b.rythmeScierie||0))*pasR,0,100);
    }
    if (window.EcosystemesBatiments) window.EcosystemesBatiments.tick(dt);
    village.moralMoyen = moralGlobal();
  }

  function moralGlobal() {
    const l = E().habitants;
    if (!l.length) return 50;
    return Math.round(l.reduce((n,h) => n + assurerHabitant(h).moral, 0) / l.length);
  }

  function finirRecette(rec, h) {
    if (!rec) return;
    const v = etatVillage();
    if (rec.proprete) v.propreteBonus = clamp((v.propreteBonus || 0) + rec.proprete * 0.45, 0, 40);
    if (rec.securite) v.securiteBonus = clamp((v.securiteBonus || 0) + rec.securite * 0.45, 0, 30);
    if (rec.loisir) v.loisirBonus = clamp((v.loisirBonus || 0) + rec.loisir * 0.45, 0, 45);
    if (rec.entretien) v.entretienBonus = clamp((v.entretienBonus || 0) + rec.entretien * 0.45, 0, 35);
    if (h && (rec.proprete || rec.loisir || rec.securite)) {
      const vie = assurerHabitant(h);
      vie.moral = clamp(vie.moral + 0.6, 0, 100);
    }
  }

  function resume() {
    const v = etatVillage();
    return {
      proprete:Math.round(v.proprete), securite:Math.round(v.securite), loisir:Math.round(v.loisir),
      logement:Math.round(v.logement), repas:Math.round(v.repas), entretien:Math.round(v.entretien),
      harmonie:Math.round(v.harmonie), moral:moralGlobal(),
    };
  }

  window.VieVillage = { assurerHabitant, etatVillage, tick, moralGlobal, finirRecette, resume, humeurPour,
    personnelScierie, confortScierie, disponibiliteTravail, equipeHabitant,
    appliquerRoulement, repartirEquipes, affecterEquipe,
    ROULEMENTS_SCIERIE, CADENCES_SCIERIE };
})();
