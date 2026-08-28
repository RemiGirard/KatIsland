/* ============================================================
   LE BOURG — vue-plan.js
   LE RELEVÉ D'ARCHITECTE

   Ce n'est pas une illustration du village vu d'en haut : c'est un PLAN.
   Le vocabulaire est celui de la planche à dessin, et rien d'autre :

     · on ne dessine que des EMPRISES RÉELLES. Un bâtiment est le contour
       exact des parcelles qu'il occupe — jamais une vignette posée dessus ;
     · les murs sont POCHÉS : un liseré plein en bordure de l'emprise, et
       l'intérieur laissé au papier ;
     · chaque famille a sa HACHURE (45°, croisée, pointillée, semis…) —
       c'est elle qui donne la lecture d'ensemble, pas la couleur ;
     · les toitures sont indiquées à la manière d'un plan de toiture :
       faîtage en tiret-point, arêtiers filant vers les angles ;
     · les ouvrages qui n'ont pas de murs (champs, eau, bois, remparts)
       reçoivent un SYMBOLE NORMALISÉ, dessiné à même l'emprise ;
     · tout est à l'encre. La couleur ne sert qu'à indexer : un mince
       liseré de famille, et le repère numéroté qui renvoie à la légende.

   La planche est aussi un outil de gestion : chaque emprise porte son
   numéro de repère, son niveau, l'occupation de ses postes, et le volet
   latéral en donne la nomenclature cherchable.
   ============================================================ */
"use strict";
(function(){
  const canvas=document.getElementById('plan-village');
  const bouton=document.getElementById('bouton-plan-village');
  const hud=document.getElementById('plan-hud');
  if(!canvas||!bouton) return;

  const ctx=canvas.getContext('2d');
  let ouvert=false, derniereSignature='', zones=[], survole=null, survoleCell=null, dernierPlan=null;
  let vue={base:1,echelle:1,ox:0,oy:0,cxm:0,czm:0,vcx:0,vcy:0};

  /* Cadrage. */
  let zoom=1, panX=0, panY=0, focus=null, recadrer=true;
  const ZOOM_MIN=.55, ZOOM_MAX=5;

  /* Volet. */
  let recherche='', catsMasquees=new Set(), vise=null, tiroir=false;
  let reperes=new Map();   // id de bâtiment -> numéro de repère de la planche

  /* ------------------------------------------------------------------
     L'ENCRE ET LE PAPIER — toute la planche tient dans ces valeurs.
     ------------------------------------------------------------------ */
  const ENCRE   ='#3a3021';                 // le trait
  const ENCRE_F ='rgba(58,48,33,.42)';      // le trait fin, secondaire
  const ENCRE_T ='rgba(58,48,33,.22)';      // le trait ténu, hachures
  const PAPIER  ='#e4d7b2';                 // le fond des parcelles
  const BATI    ='#f3ead2';                 // l'intérieur d'un bâti

  const estMaison=t=>t==='maison';
  const defDe=t=>(window.BAT&&window.BAT[t])||null;
  const nomDe=t=>{const d=defDe(t);return d?d.nom:t;};
  const catDe=t=>{const d=defDe(t);return (d&&d.cat)||'autre';};

  /* Les familles. `h` décrit la hachure de la famille : c'est la vraie clé
     de lecture de la planche, la couleur n'étant qu'un repère d'index. */
  const CATS={
    recolte :{nom:'Récolte',  c:'#7d9b46', h:{t:'tiret', a:0,      p:6}},
    elevage :{nom:'Élevage',  c:'#b57d40', h:{t:'semis',          p:7}},
    atelier :{nom:'Atelier',  c:'#c0663c', h:{t:'trait', a:-.785, p:5}},
    stock   :{nom:'Réserves', c:'#a08050', h:{t:'trait', a:.785,  p:7}},
    commerce:{nom:'Commerce', c:'#a072a6', h:{t:'croise',a:.785,  p:9}},
    vie     :{nom:'Vie',      c:'#d4796a', h:{t:'aucune'}},
    guerre  :{nom:'Défense',  c:'#78909b', h:{t:'croise',a:0,     p:7}},
    porte   :{nom:'Passages', c:'#5f95a0', h:{t:'trait', a:0,     p:6}},
    autre   :{nom:'Divers',   c:'#9d8a6f', h:{t:'trait', a:-.785, p:8}}
  };
  const catInfo=t=>CATS[catDe(t)]||CATS.autre;
  function teinte(hex,a){
    const n=parseInt(hex.slice(1),16);
    return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';
  }

  /* Les ouvrages qui se dessinent par SYMBOLE et non par bâti. */
  const SYM={
    champ:'culture',tournesol:'culture',potager:'culture',fleurs:'culture',pepiniere:'culture',
    port:'eau',pecherie:'eau',
    arbrechat:'bois',
    rempart:'enceinte',descente:'passage',
    mine:'roche',carriere:'roche',charbonniere:'roche',
    puits:'puits',
    moulin:'moulin',moulinEau:'moulin',
    eglise:'culte',
    tour:'tour',chateau:'tour',caserne:'tour',entrainement:'tour',
    bergerie:'enclos',etable:'enclos',nurserie:'enclos'
  };

  /* ------------------------------------------------------------------
     L'ÉTAT ÉCONOMIQUE — la planche lit le jeu, elle n'y touche jamais.
     ------------------------------------------------------------------ */
  function etatDe(id,type){
    const E=window.Etat&&window.Etat.E, b=E&&E.bat&&E.bat[id];
    const out={niv:0,postes:0,tenus:0,bloque:false,avarie:false,recette:null,
               alerte:false,maison:estMaison(type)};
    if(!b) return out;
    out.niv=b.niv||1;
    out.avarie=!!b.endommage;
    const postes=b.postes||[];
    out.postes=postes.length;
    for(const p of postes){
      if(p.hab) out.tenus++;
      if(p.bloque) out.bloque=true;
      if(!out.recette&&p.rec&&window.REC&&window.REC[p.rec]) out.recette=window.REC[p.rec].nom;
    }
    out.alerte=out.avarie||out.bloque||(!out.maison&&out.postes>0&&out.tenus<out.postes);
    return out;
  }

  /* ==================================================================
     GÉOMÉTRIE — projection, contours, chaînage des arêtes de bordure
     ================================================================== */
  /* Les marges de cadrage réservent la place des PANNEAUX DE JEU : le dock
     de gauche et les productions de droite ont la priorité absolue, la
     planche se cadre dans ce qui reste. On lit leur état replié pour
     récupérer la bande dès qu'elle se libère. */
  const replieQ=id=>{const e=document.getElementById(id);return !e||e.classList.contains('replie');};
  function insets(w){
    const etroit=w<=900;
    const dockOff=replieQ('dock'), prodOff=replieQ('productions');
    document.body.classList.toggle('dock-replie',dockOff);
    document.body.classList.toggle('prod-replie',prodOff);
    const lire=n=>parseInt(getComputedStyle(document.documentElement).getPropertyValue(n))||0;
    const g=etroit?24:(dockOff?24:lire('--dock')+30);
    const d=etroit?24:(prodOff?24:lire('--prod')+34);
    const tete=lire('--bandeau')+(tiroir?0:0)+64;
    return {g,d,h:tete,b:64};
  }
  function mesurer(plan,w,h){
    const pts=[];
    for(const c of plan.cellules) for(const p of c.q) pts.push(p);
    let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x));
    let minZ=Math.min(...pts.map(p=>p.z)),maxZ=Math.max(...pts.map(p=>p.z));
    if(!Number.isFinite(minX)){minX=minZ=-1;maxX=maxZ=1;}
    const I=insets(w);
    const dispoW=Math.max(80,w-I.g-I.d),dispoH=Math.max(80,h-I.h-I.b);
    const ew=Math.max(.1,maxX-minX),eh=Math.max(.1,maxZ-minZ);
    const base=Math.min(dispoW/ew,dispoH/eh);
    const cxm=(minX+maxX)/2,czm=(minZ+maxZ)/2;
    const vcx=I.g+dispoW/2,vcy=I.h+dispoH/2;
    if(recadrer){zoom=1;panX=panY=0;recadrer=false;}
    const echelle=base*zoom;
    if(focus){panX=-(focus.x-cxm)*echelle;panY=-(focus.z-czm)*echelle;focus=null;}
    const limX=Math.max(60,ew*echelle*.75+dispoW*.25),limY=Math.max(60,eh*echelle*.75+dispoH*.25);
    panX=Math.max(-limX,Math.min(limX,panX));panY=Math.max(-limY,Math.min(limY,panY));
    vue={base,echelle,cxm,czm,vcx,vcy,ox:vcx-cxm*echelle+panX,oy:vcy-czm*echelle+panY};
  }
  const proj=p=>({x:vue.ox+p.x*vue.echelle,y:vue.oy+p.z*vue.echelle});

  /* Le contour d'un bâtiment est fait des arêtes que ses parcelles ne
     partagent pas entre elles. Deux parcelles accolées ne montrent donc
     aucun trait à leur jonction : on relève l'emprise, pas le carrelage. */
  const cleP=p=>p.x.toFixed(4)+','+p.z.toFixed(4);
  function aretesDeBord(slots){
    const m=new Map();
    for(const s of slots) for(let i=0;i<s.q.length;i++){
      const a=s.q[i],b=s.q[(i+1)%s.q.length];
      const ka=cleP(a),kb=cleP(b),k=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(m.has(k)) m.get(k).n++; else m.set(k,{a,b,n:1});
    }
    return [...m.values()].filter(e=>e.n===1);
  }
  /* Chaînage en un anneau ordonné, pour pouvoir remplir et détourer. */
  function anneau(aretes){
    if(!aretes.length) return [];
    const voisins=new Map();
    const pousser=(k,p)=>{if(!voisins.has(k))voisins.set(k,[]);voisins.get(k).push(p);};
    for(const e of aretes){pousser(cleP(e.a),e.b);pousser(cleP(e.b),e.a);}
    const depart=aretes[0].a,kd=cleP(depart);
    const ring=[depart];let prev=kd,cur=aretes[0].b,garde=0;
    while(cleP(cur)!==kd&&garde++<2000){
      ring.push(cur);
      const opts=voisins.get(cleP(cur))||[];
      const suiv=opts.find(p=>cleP(p)!==prev)||opts[0];
      prev=cleP(cur);
      if(!suiv) break;
      cur=suiv;
    }
    return ring;
  }
  /* Trace un anneau, éventuellement rentré de `retrait` pixels vers son
     centre : c'est l'offset qui donne l'épaisseur de mur du poché. */
  function tracer(ring,retrait=0){
    const ps=ring.map(proj);
    const cx=ps.reduce((s,p)=>s+p.x,0)/ps.length,cy=ps.reduce((s,p)=>s+p.y,0)/ps.length;
    ctx.beginPath();
    ps.forEach((p,i)=>{
      const dx=p.x-cx,dy=p.y-cy,l=Math.hypot(dx,dy)||1;
      const q={x:p.x-dx/l*retrait,y:p.y-dy/l*retrait};
      i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);
    });
    ctx.closePath();
  }
  function boite(ring){
    const ps=ring.map(proj);
    return {x0:Math.min(...ps.map(p=>p.x)),x1:Math.max(...ps.map(p=>p.x)),
            y0:Math.min(...ps.map(p=>p.y)),y1:Math.max(...ps.map(p=>p.y)),
            cx:ps.reduce((s,p)=>s+p.x,0)/ps.length,cy:ps.reduce((s,p)=>s+p.y,0)/ps.length};
  }

  /* ==================================================================
     LES OUTILS DE LA PLANCHE — hachures, poché, tiret-point
     ================================================================== */
  function hachurer(ring,style,bb,alpha){
    if(!style||style.t==='aucune') return;
    ctx.save();tracer(ring,1.5);ctx.clip();
    const d=Math.hypot(bb.x1-bb.x0,bb.y1-bb.y0)+8;
    const pas=Math.max(3.5,style.p*Math.min(1.6,Math.max(.7,vue.echelle/46)));
    ctx.globalAlpha=alpha;
    if(style.t==='semis'){
      /* Un semis de points : la prairie, l'enclos, la terre remuée. */
      ctx.fillStyle=ENCRE_F;
      for(let y=bb.y0;y<bb.y1;y+=pas){
        const dec=((y/pas)|0)%2?pas/2:0;
        for(let x=bb.x0+dec;x<bb.x1;x+=pas) ctx.fillRect(x,y,1.1,1.1);
      }
    }else{
      ctx.strokeStyle=ENCRE_T;ctx.lineWidth=.9;
      if(style.t==='tiret') ctx.setLineDash([5,4]);
      const passes=style.t==='croise'?[style.a,style.a+Math.PI/2]:[style.a];
      for(const a of passes){
        ctx.save();ctx.translate(bb.cx,bb.cy);ctx.rotate(a);
        ctx.beginPath();
        for(let t=-d;t<=d;t+=pas){ctx.moveTo(-d,t);ctx.lineTo(d,t);}
        ctx.stroke();ctx.restore();
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  /* Le POCHÉ : la couronne entre le nu extérieur et le nu intérieur du
     mur, remplie à l'encre. C'est la convention qui fait le plan. */
  function pocher(ring,ep,couleur){
    ctx.save();
    ctx.beginPath();
    tracer(ring,0);          // nu extérieur
    tracer(ring,ep);         // nu intérieur, en sens inverse par l'offset
    ctx.fillStyle=couleur;ctx.fill('evenodd');
    ctx.restore();
  }
  /* Le plan de toiture : faîtage en tiret-point sur le grand axe, et les
     arêtiers qui rejoignent les angles. */
  function toiture(bb,alpha){
    const w=bb.x1-bb.x0,h=bb.y1-bb.y0;
    if(Math.min(w,h)<15) return;
    const m=Math.min(w,h)*.30;
    ctx.save();ctx.globalAlpha=alpha;
    ctx.strokeStyle=ENCRE_F;ctx.lineWidth=.9;ctx.setLineDash([7,3,1.5,3]);
    ctx.beginPath();
    let a,b;
    if(w>=h){a={x:bb.x0+m,y:bb.cy};b={x:bb.x1-m,y:bb.cy};}
    else{a={x:bb.cx,y:bb.y0+m};b={x:bb.cx,y:bb.y1-m};}
    ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.setLineDash([]);ctx.lineWidth=.7;ctx.strokeStyle=ENCRE_T;
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);ctx.lineTo(bb.x0+2,bb.y0+2);
    ctx.moveTo(a.x,a.y);ctx.lineTo(bb.x0+2,bb.y1-2);
    ctx.moveTo(b.x,b.y);ctx.lineTo(bb.x1-2,bb.y0+2);
    ctx.moveTo(b.x,b.y);ctx.lineTo(bb.x1-2,bb.y1-2);
    ctx.stroke();ctx.restore();
  }

  /* ==================================================================
     LES SYMBOLES NORMALISÉS — un ouvrage sans murs se note, il ne se
     dessine pas. Tous prennent l'emprise et son cadre, et travaillent
     au trait fin, à l'échelle courante.
     ================================================================== */
  function symbole(nom,ring,bb,type){
    const w=bb.x1-bb.x0,h=bb.y1-bb.y0,r=Math.max(6,Math.min(w,h)*.30);
    ctx.save();ctx.strokeStyle=ENCRE;ctx.fillStyle=ENCRE;
    ctx.lineWidth=Math.max(.8,Math.min(1.6,vue.echelle/34));
    ctx.lineCap='round';ctx.lineJoin='round';

    if(nom==='culture'){
      /* Sillons : des rangs parallèles serrés, coupés d'une allée. */
      ctx.save();tracer(ring,2.5);ctx.clip();
      ctx.strokeStyle=ENCRE_F;ctx.lineWidth=1;
      const pas=Math.max(4,Math.min(9,vue.echelle/6));
      ctx.beginPath();
      for(let y=bb.y0+pas/2;y<bb.y1;y+=pas){ctx.moveTo(bb.x0,y);ctx.lineTo(bb.x1,y);}
      ctx.stroke();
      if(type==='tournesol'||type==='fleurs'){
        ctx.fillStyle=ENCRE_F;
        for(let y=bb.y0+pas/2;y<bb.y1;y+=pas)
          for(let x=bb.x0+3;x<bb.x1;x+=pas*1.4) ctx.fillRect(x,y-1,1.6,1.6);
      }
      ctx.restore();
      cartouchePetit(bb,type==='pepiniere'?'PÉP.':(type==='potager'?'POT.':''),0);

    }else if(nom==='eau'){
      /* Le plan d'eau se note par des lignes d'onde, le quai par un
         redan hachuré ; le tout reste au trait. */
      ctx.save();tracer(ring,2.5);ctx.clip();
      ctx.strokeStyle='rgba(52,86,96,.55)';ctx.lineWidth=1;
      const pas=Math.max(5,Math.min(10,vue.echelle/6));
      for(let y=bb.y0+pas;y<bb.y1;y+=pas){
        ctx.beginPath();ctx.moveTo(bb.x0,y);
        for(let x=bb.x0;x<bb.x1;x+=12) ctx.quadraticCurveTo(x+3,y-2.6,x+6,y);
        ctx.stroke();
      }
      ctx.restore();
      /* Le quai : une bande pleine le long du bord haut de l'emprise. */
      const q=Math.max(5,Math.min(12,h*.26));
      ctx.save();tracer(ring,2.5);ctx.clip();
      ctx.fillStyle='rgba(58,48,33,.16)';ctx.fillRect(bb.x0,bb.y0,w,q);
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(bb.x0,bb.y0+q);ctx.lineTo(bb.x1,bb.y0+q);ctx.stroke();
      /* Les bollards d'amarrage. */
      ctx.fillStyle=ENCRE;
      for(let x=bb.x0+q;x<bb.x1-2;x+=q*1.5) ctx.fillRect(x-1,bb.y0+q-2.5,2,5);
      ctx.restore();
      if(type==='port'&&Math.min(w,h)>30){
        /* Le gabarit d'un navire à quai, en pointillé : ce qui accoste
           n'est pas bâti, on le note comme une emprise projetée. */
        ctx.save();ctx.setLineDash([4,3]);ctx.strokeStyle=ENCRE_F;ctx.lineWidth=1.1;
        const L=Math.min(w*.62,44),l=L*.30,cy=bb.cy+h*.14;
        ctx.beginPath();
        ctx.moveTo(bb.cx-L/2,cy);
        ctx.quadraticCurveTo(bb.cx-L*.3,cy-l/2,bb.cx+L*.30,cy-l*.44);
        ctx.quadraticCurveTo(bb.cx+L/2,cy-l*.16,bb.cx+L/2,cy);
        ctx.quadraticCurveTo(bb.cx+L/2,cy+l*.16,bb.cx+L*.30,cy+l*.44);
        ctx.quadraticCurveTo(bb.cx-L*.3,cy+l/2,bb.cx-L/2,cy);
        ctx.closePath();ctx.stroke();
        ctx.beginPath();ctx.moveTo(bb.cx,cy-l*.42);ctx.lineTo(bb.cx,cy+l*.42);ctx.stroke();
        ctx.restore();
      }else if(Math.min(w,h)>26){
        /* Les séchoirs à filets de la pêcherie : deux montants, une lisse. */
        ctx.strokeStyle=ENCRE_F;ctx.lineWidth=1.1;
        const y=bb.cy+h*.18,e=Math.min(w*.3,18);
        ctx.beginPath();
        ctx.moveTo(bb.cx-e,y+5);ctx.lineTo(bb.cx-e,y-6);
        ctx.moveTo(bb.cx+e,y+5);ctx.lineTo(bb.cx+e,y-6);
        ctx.moveTo(bb.cx-e-3,y-6);ctx.lineTo(bb.cx+e+3,y-6);
        ctx.stroke();
        ctx.lineWidth=.7;ctx.beginPath();
        for(let x=bb.cx-e+3;x<bb.cx+e;x+=4){ctx.moveTo(x,y-5);ctx.lineTo(x-2,y+4);}
        ctx.stroke();
      }

    }else if(nom==='bois'){
      /* L'arbre en plan : un cercle et ses rayons, la convention la plus
         ancienne du dessin de site. */
      ctx.save();tracer(ring,2.5);ctx.clip();
      const R=Math.max(5,Math.min(w,h)*.20);
      const pos=[[0,0],[-.52,-.34],[.5,-.3],[-.42,.42],[.46,.4]];
      for(const q of pos){
        const x=bb.cx+q[0]*w*.5,y=bb.cy+q[1]*h*.5,rr=R*(1-Math.abs(q[0])*.22);
        ctx.strokeStyle=ENCRE_F;ctx.lineWidth=1.1;
        ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.stroke();
        ctx.lineWidth=.8;ctx.beginPath();
        for(let i=0;i<10;i++){const a=i*Math.PI/5;
          ctx.moveTo(x+Math.cos(a)*rr*.35,y+Math.sin(a)*rr*.35);
          ctx.lineTo(x+Math.cos(a)*rr*.95,y+Math.sin(a)*rr*.95);}
        ctx.stroke();
      }
      ctx.restore();

    }else if(nom==='enceinte'){
      /* Le rempart : deux nus parallèles, poché plein, merlons en peigne. */
      pocher(ring,Math.max(3,Math.min(9,vue.echelle*.14)),'rgba(58,48,33,.82)');
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.3;tracer(ring,0);ctx.stroke();

    }else if(nom==='passage'){
      /* Un passage : la volée de marches, notée par ses contremarches et
         la flèche de sens de descente. */
      ctx.save();tracer(ring,2.5);ctx.clip();
      ctx.strokeStyle=ENCRE_F;ctx.lineWidth=1.1;
      const pas=Math.max(4,Math.min(9,h/6));
      ctx.beginPath();
      for(let y=bb.y0+pas;y<bb.y1;y+=pas){ctx.moveTo(bb.x0+2,y);ctx.lineTo(bb.x1-2,y);}
      ctx.stroke();
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.3;
      ctx.beginPath();ctx.moveTo(bb.cx,bb.y0+3);ctx.lineTo(bb.cx,bb.y1-3);
      ctx.moveTo(bb.cx-3.5,bb.y1-8);ctx.lineTo(bb.cx,bb.y1-3);ctx.lineTo(bb.cx+3.5,bb.y1-8);
      ctx.stroke();ctx.restore();

    }else if(nom==='roche'){
      /* Le front de taille : éclats anguleux et talus en griffes. */
      ctx.save();tracer(ring,2.5);ctx.clip();
      ctx.strokeStyle=ENCRE_F;ctx.lineWidth=1;
      let s=hash(type)||7;const rnd=()=>((s=Math.imul(s,1664525)+1013904223|0)>>>0)/4294967296;
      for(let i=0;i<7;i++){
        const x=bb.x0+rnd()*w,y=bb.y0+rnd()*h,rr=r*(.35+rnd()*.5);
        ctx.beginPath();
        for(let k=0;k<5;k++){const a=k*Math.PI*2/5+rnd()*.4,q=rr*(.65+rnd()*.5);
          const px=x+Math.cos(a)*q,py=y+Math.sin(a)*q*.8;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}
        ctx.closePath();ctx.stroke();
      }
      /* La griffe de talus le long du bord bas : convention de terrassement. */
      ctx.lineWidth=.9;ctx.beginPath();
      for(let x=bb.x0+3;x<bb.x1;x+=5){ctx.moveTo(x,bb.y1-2);ctx.lineTo(x,bb.y1-2-((x/5|0)%2?7:3.5));}
      ctx.stroke();ctx.restore();
      if(type==='mine'&&Math.min(w,h)>24){
        /* L'entrée de galerie : un demi-cercle plein contre le front. */
        ctx.fillStyle=ENCRE;ctx.beginPath();
        ctx.arc(bb.cx,bb.cy+h*.10,r*.55,Math.PI,0);ctx.closePath();ctx.fill();
      }

    }else if(nom==='puits'){
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(bb.cx,bb.cy,r,0,Math.PI*2);ctx.stroke();
      ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(bb.cx,bb.cy,r*.56,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(bb.cx-r,bb.cy);ctx.lineTo(bb.cx+r,bb.cy);
      ctx.moveTo(bb.cx,bb.cy-r);ctx.lineTo(bb.cx,bb.cy+r);ctx.stroke();

    }else if(nom==='moulin'){
      /* Tour ronde pochée, et le cercle de rotation des ailes en tireté :
         un plan note l'encombrement des parties mobiles. */
      ctx.fillStyle='rgba(58,48,33,.8)';
      ctx.beginPath();ctx.arc(bb.cx,bb.cy,r*.62,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.4;ctx.stroke();
      ctx.save();ctx.setLineDash([4,3]);ctx.strokeStyle=ENCRE_F;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(bb.cx,bb.cy,r*1.25,0,Math.PI*2);ctx.stroke();ctx.restore();
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.2;ctx.beginPath();
      const dep=type==='moulinEau'?Math.PI/4:0;
      for(let i=0;i<4;i++){const a=dep+i*Math.PI/2;
        ctx.moveTo(bb.cx+Math.cos(a)*r*.62,bb.cy+Math.sin(a)*r*.62);
        ctx.lineTo(bb.cx+Math.cos(a)*r*1.25,bb.cy+Math.sin(a)*r*1.25);}
      ctx.stroke();

    }else if(nom==='culte'){
      /* Une nef : mur poché, croisée marquée, chevet arrondi. */
      pocher(ring,Math.max(2.5,Math.min(7,vue.echelle*.10)),'rgba(58,48,33,.78)');
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.moveTo(bb.cx,bb.y0+5);ctx.lineTo(bb.cx,bb.y1-5);
      ctx.moveTo(bb.x0+5,bb.cy);ctx.lineTo(bb.x1-5,bb.cy);
      ctx.stroke();
      ctx.lineWidth=1;ctx.beginPath();
      ctx.arc(bb.cx,bb.cy,Math.min(w,h)*.16,0,Math.PI*2);ctx.stroke();

    }else if(nom==='tour'){
      /* Ouvrage défensif : mur épais poché, et les créneaux en dents. */
      const ep=Math.max(3,Math.min(10,vue.echelle*.15));
      pocher(ring,ep,'rgba(58,48,33,.85)');
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.4;tracer(ring,0);ctx.stroke();
      ctx.strokeStyle='rgba(243,234,210,.9)';ctx.lineWidth=1.6;
      ctx.save();tracer(ring,0);ctx.clip();
      ctx.beginPath();
      for(let x=bb.x0;x<bb.x1;x+=8){
        ctx.moveTo(x,bb.y0);ctx.lineTo(x,bb.y0+ep);
        ctx.moveTo(x,bb.y1);ctx.lineTo(x,bb.y1-ep);
      }
      for(let y=bb.y0;y<bb.y1;y+=8){
        ctx.moveTo(bb.x0,y);ctx.lineTo(bb.x0+ep,y);
        ctx.moveTo(bb.x1,y);ctx.lineTo(bb.x1-ep,y);
      }
      ctx.stroke();ctx.restore();

    }else if(nom==='enclos'){
      /* Un enclos : clôture en tireté serré, abri poché dans un angle. */
      ctx.save();ctx.setLineDash([3,3]);ctx.strokeStyle=ENCRE;ctx.lineWidth=1.3;
      tracer(ring,3);ctx.stroke();ctx.restore();
      const aw=Math.min(w,h)*.42;
      ctx.fillStyle='rgba(58,48,33,.8)';
      ctx.fillRect(bb.x0+4,bb.y0+4,aw,aw*.62);
      ctx.strokeStyle=ENCRE;ctx.lineWidth=1.2;
      ctx.strokeRect(bb.x0+4,bb.y0+4,aw,aw*.62);
    }
    ctx.restore();
  }
  function cartouchePetit(){}   /* réservé : les libellés passent par les étiquettes */

  function hash(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

  /* Le glyphe de métier, au trait, posé au centre d'un bâti assez grand.
     Il reste minuscule : sur une planche, un symbole ne crie pas. */
  function glypheMetier(type,cx,cy,r){
    ctx.save();ctx.translate(cx,cy);ctx.scale(r/9,r/9);
    ctx.strokeStyle=ENCRE;ctx.fillStyle=ENCRE;ctx.lineWidth=1.6;
    ctx.lineCap='round';ctx.lineJoin='round';
    const P=pts=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();};
    if(/forge|fonderie|armurerie/.test(type)){            // l'enclume
      P([[-7,1],[7,1],[5,4],[-5,4]]);ctx.fill();
      P([[-8,-4],[8,-4],[5,-1],[-4,-1]]);ctx.fill();
    }else if(/orfevre|taverne|halle/.test(type)){         // la balance / l'enseigne
      ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,6);ctx.moveTo(-7,-4);ctx.lineTo(7,-4);ctx.stroke();
      ctx.beginPath();ctx.arc(-7,-1,3,0,Math.PI);ctx.arc(7,-1,3,0,Math.PI);ctx.stroke();
    }else if(/tisserand|filature|tannerie/.test(type)){   // la navette
      ctx.beginPath();ctx.ellipse(0,0,8,3.6,0,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.stroke();
    }else if(/herboristerie|alchimie|rucher/.test(type)){ // l'alambic / la ruche
      ctx.beginPath();ctx.moveTo(-6,6);ctx.lineTo(-3,-3);ctx.lineTo(3,-3);ctx.lineTo(6,6);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(-3,-3);ctx.lineTo(-3,-7);ctx.lineTo(3,-7);ctx.lineTo(3,-3);ctx.stroke();
    }else if(/cuisine|fumoir|laiterie/.test(type)){       // le chaudron
      ctx.beginPath();ctx.arc(0,1,6,0,Math.PI);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-7,1);ctx.lineTo(7,1);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-4,-6);ctx.lineTo(-4,-2);ctx.moveTo(4,-6);ctx.lineTo(4,-2);ctx.stroke();
    }else if(/scriptorium/.test(type)){                   // le codex ouvert
      ctx.beginPath();ctx.moveTo(-8,-5);ctx.lineTo(-8,5);ctx.lineTo(0,3);ctx.lineTo(8,5);ctx.lineTo(8,-5);ctx.lineTo(0,-3);ctx.closePath();ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-3);ctx.lineTo(0,3);ctx.stroke();
    }else if(/scierie/.test(type)){                       // la lame
      ctx.beginPath();ctx.moveTo(-8,3);ctx.lineTo(8,-3);ctx.stroke();
      ctx.lineWidth=1.1;ctx.beginPath();
      for(let i=-7;i<8;i+=3){ctx.moveTo(i,3-(i+8)*.38);ctx.lineTo(i+1.4,6-(i+8)*.38);}ctx.stroke();
    }else if(/tuilerie|poterie|verrerie/.test(type)){     // le vase au tour
      ctx.beginPath();ctx.moveTo(-5,7);ctx.lineTo(-4,-2);ctx.quadraticCurveTo(0,-8,4,-2);ctx.lineTo(5,7);ctx.closePath();ctx.stroke();
    }else if(/grange|entrepot/.test(type)){               // les tonneaux
      ctx.beginPath();ctx.ellipse(-4,0,3.4,6,0,0,Math.PI*2);ctx.ellipse(4,0,3.4,6,0,0,Math.PI*2);ctx.stroke();
    }else if(/maison|nurserie/.test(type)){               // l'âtre
      ctx.beginPath();ctx.moveTo(-6,6);ctx.lineTo(-6,-4);ctx.lineTo(6,-4);ctx.lineTo(6,6);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-3,6);ctx.lineTo(-3,0);ctx.lineTo(3,0);ctx.lineTo(3,6);ctx.stroke();
    }else{                                                // le poinçon générique
      ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(6,0);ctx.lineTo(0,7);ctx.lineTo(-6,0);ctx.closePath();ctx.stroke();
    }
    ctx.restore();
  }

  /* ==================================================================
     LE FOND DE PLAN — papier, eau, trait de côte, cartouche
     ================================================================== */
  function fond(plan,w,h){
    /* La mer : un aplat sourd, quadrillé au tire-ligne. Elle ne brille
       pas — c'est le papier qui doit tenir le regard. */
    ctx.fillStyle='#2f4750';ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalAlpha=.10;ctx.strokeStyle='#cfe0e2';ctx.lineWidth=.6;
    ctx.beginPath();
    for(let k=-h;k<w+h;k+=26){ctx.moveTo(k,0);ctx.lineTo(k-h,h);}
    for(let k=0;k<w+h;k+=26){ctx.moveTo(k-h,0);ctx.lineTo(k,h);}
    ctx.stroke();ctx.restore();

    /* Le terrain : un seul aplat de papier, sans quadrillage de parcelles
       apparent — le carrelage du moteur n'est pas une information de plan. */
    ctx.save();ctx.shadowColor='rgba(6,18,22,.5)';ctx.shadowBlur=14;ctx.shadowOffsetY=4;
    for(const c of plan.cellules){tracer(c.q);ctx.fillStyle=PAPIER;ctx.fill();}
    ctx.restore();
    for(const c of plan.cellules){tracer(c.q);ctx.fillStyle=PAPIER;ctx.fill();}

    /* Les limites de parcelles, en trait d'axe très pâle : l'architecte
       garde sa trame, mais elle ne doit jamais concurrencer le bâti. */
    ctx.save();ctx.strokeStyle='rgba(96,80,55,.13)';ctx.lineWidth=.6;
    for(const c of plan.cellules){tracer(c.q);ctx.stroke();}
    ctx.restore();

    /* Le trait de côte : arêtes n'appartenant qu'à une cellule. Doublé
       d'un trait de rive plus léger, comme sur une minute de géomètre. */
    const bord=aretesDeBord(plan.cellules.map(c=>({q:c.q})));
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();
    for(const e of bord){const a=proj(e.a),b=proj(e.b);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
    ctx.strokeStyle='rgba(20,38,44,.45)';ctx.lineWidth=6;ctx.stroke();
    ctx.strokeStyle=ENCRE;ctx.lineWidth=1.8;ctx.stroke();
    ctx.restore();

    /* Grain du papier : déterministe, donc parfaitement immobile. */
    let g=1937;const rnd=()=>((g=Math.imul(g,1664525)+1013904223|0)>>>0)/4294967296;
    ctx.save();ctx.fillStyle='rgba(82,64,42,.07)';
    for(let k=0;k<Math.min(1600,Math.floor(w*h/800));k++)
      ctx.fillRect(rnd()*w,rnd()*h,rnd()*1.4+.25,rnd()*1.4+.25);
    ctx.restore();

    /* Le filet de la planche. */
    ctx.strokeStyle='rgba(228,215,178,.38)';ctx.lineWidth=1;ctx.strokeRect(9.5,9.5,w-19,h-19);
    ctx.strokeStyle='rgba(24,40,46,.7)';ctx.strokeRect(13.5,13.5,w-27,h-27);

    /* Le nord, tracé au compas, et l'échelle graphique. */
    const nx=w-36,ny=86;ctx.save();ctx.translate(nx,ny);
    ctx.strokeStyle='rgba(228,215,178,.75)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(0,17);ctx.moveTo(-17,0);ctx.lineTo(17,0);
    ctx.globalAlpha=.5;ctx.stroke();ctx.globalAlpha=1;
    ctx.fillStyle='rgba(232,220,186,.95)';
    ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(4.5,3);ctx.lineTo(0,0);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(-4.5,3);ctx.lineTo(0,0);ctx.closePath();
    ctx.globalAlpha=.45;ctx.fill();ctx.globalAlpha=1;
    ctx.font="700 9px 'Condense',sans-serif";ctx.textAlign='center';
    ctx.fillText('N',0,-21);ctx.restore();

    const L=Math.max(36,Math.min(130,vue.echelle*4));
    ctx.save();ctx.translate(w-32-L,h-34);
    ctx.strokeStyle='rgba(232,220,186,.78)';ctx.fillStyle='rgba(232,220,186,.78)';
    ctx.lineWidth=1.2;ctx.lineCap='butt';
    ctx.strokeRect(0,-4,L,4.5);ctx.fillRect(0,-4,L/4,4.5);ctx.fillRect(L/2,-4,L/4,4.5);
    ctx.font="700 9px 'Condense',sans-serif";ctx.textAlign='center';ctx.letterSpacing='1px';
    ctx.fillText('4 PARCELLES',L/2,-9);ctx.letterSpacing='0px';ctx.textAlign='left';ctx.restore();
  }

  /* ==================================================================
     LA PLANCHE
     ================================================================== */
  function retenu(type){
    if(catsMasquees.has(catDe(type))) return false;
    if(recherche&&!nomDe(type).toLowerCase().includes(recherche)) return false;
    return true;
  }
  const filtreActif=()=>!!recherche||catsMasquees.size>0;

  /* Le repère : le petit numéro cerclé qui relie la planche à sa
     nomenclature. C'est lui qui rend un bourg dense navigable. */
  function repere(x,y,n,accent,actif){
    const r=actif?9:8;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=actif?'#3a3021':BATI;ctx.fill();
    ctx.strokeStyle=actif?'#3a3021':accent;ctx.lineWidth=1.4;ctx.stroke();
    ctx.fillStyle=actif?'#f3ead2':ENCRE;
    ctx.font="700 "+(r+2)+"px 'Condense',sans-serif";
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(n),x,y+.5);
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }
  /* L'annotation d'exploitation : niveau et postes tenus, en petites
     capitales, comme une cote portée à côté de l'ouvrage. */
  function cote(x,y,st,alerte){
    const parts=[];
    if(st.niv) parts.push('N'+st.niv);
    if(!st.maison&&st.postes) parts.push(st.tenus+'/'+st.postes);
    if(!parts.length) return;
    const txt=parts.join(' · ');
    ctx.font="700 10px 'Condense',sans-serif";ctx.letterSpacing='.6px';
    const tw=ctx.measureText(txt).width;
    ctx.fillStyle='rgba(243,234,210,.88)';ctx.fillRect(x-tw/2-3,y,tw+6,12);
    ctx.strokeStyle=ENCRE_F;ctx.lineWidth=.8;ctx.strokeRect(x-tw/2-3+.5,y+.5,tw+6-1,11);
    ctx.fillStyle=ENCRE;ctx.textAlign='center';ctx.fillText(txt,x,y+9);
    ctx.textAlign='left';ctx.letterSpacing='0px';
    if(alerte){ctx.fillStyle='#b03a30';ctx.beginPath();ctx.arc(x+tw/2+7,y+6,2.6,0,Math.PI*2);ctx.fill();}
  }
  /* Les étiquettes se posent SUR l'ouvrage et ne se recouvrent jamais.
     On sépare la RÉSERVATION du tracé : il faut savoir qui reçoit une
     étiquette avant de décider qui a encore besoin de son repère seul. */
  function poseurEtiquettes(){
    const pris=[];
    function mesure(num,txt){
      ctx.font="700 11px 'Condense',sans-serif";ctx.letterSpacing='.7px';
      const plein=num+'  '+txt,w=ctx.measureText(plein).width+12;
      ctx.letterSpacing='0px';
      return {plein,w,h:15};
    }
    return {
      reserver(x,y,num,txt,force){
        const m=mesure(num,txt);
        const r={x:x-m.w/2,y:y-m.h/2,w:m.w,h:m.h,plein:m.plein};
        if(!force) for(const q of pris)
          if(r.x<q.x+q.w&&r.x+r.w>q.x&&r.y<q.y+q.h&&r.y+r.h>q.y) return null;
        pris.push(r);return r;
      },
      tracer(r,accent){
        ctx.font="700 11px 'Condense',sans-serif";ctx.letterSpacing='.7px';
        ctx.fillStyle='rgba(243,234,210,.92)';ctx.fillRect(r.x,r.y,r.w,r.h);
        ctx.fillStyle=accent;ctx.fillRect(r.x,r.y,2.5,r.h);
        ctx.strokeStyle=ENCRE_F;ctx.lineWidth=.8;ctx.strokeRect(r.x+.5,r.y+.5,r.w-1,r.h-1);
        ctx.fillStyle=ENCRE;ctx.textAlign='center';
        ctx.fillText(r.plein,r.x+r.w/2,r.y+r.h-4);
        ctx.textAlign='left';ctx.letterSpacing='0px';
      }
    };
  }

  function dessiner(){
    if(!ouvert||!window.Village||!window.Village.planArchitecture) return;
    const dpr=Math.min(window.devicePixelRatio||1,2),rc=canvas.getBoundingClientRect();
    const W=Math.max(1,Math.round(rc.width*dpr)),H=Math.max(1,Math.round(rc.height*dpr));
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;derniereSignature='';}
    const plan=window.Village.planArchitecture();dernierPlan=plan;
    const construire=!!(window.Village.enConstruction&&window.Village.enConstruction());

    const etats=new Map();
    for(const b of plan.batiments) etats.set(b.id,etatDe(b.id,b.type));
    const sigEtat=plan.batiments.map(b=>{const s=etats.get(b.id);return s.niv+','+s.tenus+'/'+s.postes+(s.alerte?'!':'');}).join(';');
    const signature=W+'x'+H+'|'+plan.batiments.map(b=>b.id+':'+b.type+':'+b.slots.map(s=>s.cell+'@'+s.L).join('.')).join('|')
      +'|'+survole+'|'+survoleCell+'|'+construire+'|'+zoom.toFixed(3)+'|'+Math.round(panX)+'|'+Math.round(panY)
      +'|'+recherche+'|'+[...catsMasquees].sort().join(',')+'|'+vise+'|'+tiroir+'|'+sigEtat;
    if(signature===derniereSignature) return;
    derniereSignature=signature;

    ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=W/dpr,h=H/dpr;
    mesurer(plan,w,h);fond(plan,w,h);zones=[];

    /* Quelle parcelle porte quel ouvrage : le dernier posé prime. */
    const parCell=new Map();
    for(const b of plan.batiments) for(const s of b.slots){
      if(!parCell.has(s.cell)) parCell.set(s.cell,[]);
      parCell.get(s.cell).push({b,s});
    }
    for(const lot of parCell.values()) lot.sort((a,b)=>a.s.L-b.s.L);

    /* La nomenclature fixe les numéros de repère (nord vers sud). */
    const ouvrages=[];
    for(const b of plan.batiments){
      const visibles=b.slots.filter(s=>{
        const lot=parCell.get(s.cell);return lot&&lot[lot.length-1].b.id===b.id;
      });
      if(!visibles.length) continue;
      const ring=anneau(aretesDeBord(visibles));
      if(ring.length<3) continue;
      ouvrages.push({b,type:b.pour||b.type,visibles,ring});
    }
    /* Le point d'ancrage des annotations : la moyenne des CENTRES DE
       PARCELLE, jamais le coin d'une boîte englobante. Sur une emprise
       en L ou en biais, le coin tombe hors de l'ouvrage — pas le
       barycentre des parcelles, qui est toujours sur le bâti. */
    for(const o of ouvrages){
      let sx=0,sy=0;
      for(const s of o.visibles){const p=proj({x:s.cx,z:s.cz});sx+=p.x;sy+=p.y;}
      o.ax=sx/o.visibles.length;o.ay=sy/o.visibles.length;
    }
    ouvrages.sort((a,b)=>{
      const A=a.visibles[0],B=b.visibles[0];
      return (A.cz-B.cz)||(A.cx-B.cx);
    });
    reperes=new Map();ouvrages.forEach((o,i)=>reperes.set(o.b.id,i+1));

    /* --- Le tracé, ouvrage par ouvrage --- */
    for(const o of ouvrages){
      const {type,ring}=o, info=catInfo(type), bb=boite(ring);
      const actif=survole===o.b.id||vise===o.b.id, vu=retenu(type);
      o.bb=bb;
      ctx.save();
      ctx.globalAlpha=vu?1:.22;

      const sym=SYM[type];
      if(sym){
        /* Ouvrage sans murs : liseré de famille très léger, puis symbole. */
        tracer(ring,1.5);ctx.fillStyle=teinte(info.c,.09);ctx.fill();
        symbole(sym,ring,bb,type);
        ctx.save();ctx.setLineDash([6,4]);ctx.strokeStyle=teinte(info.c,.55);
        ctx.lineWidth=1.1;tracer(ring,1.5);ctx.stroke();ctx.restore();
      }else{
        /* Bâti : lavis de famille, hachure, poché des murs, plan de toiture. */
        tracer(ring,1.5);ctx.fillStyle=BATI;ctx.fill();
        tracer(ring,1.5);ctx.fillStyle=teinte(info.c,.13);ctx.fill();
        hachurer(ring,info.h,bb,vu?1:.5);
        const ep=Math.max(2,Math.min(7,vue.echelle*.085));
        pocher(ring,ep,'rgba(58,48,33,.86)');
        toiture(bb,.75);
        ctx.strokeStyle=ENCRE;ctx.lineWidth=1.4;tracer(ring,1.5);ctx.stroke();
        const r=Math.min(bb.x1-bb.x0,bb.y1-bb.y0);
        if(r>34&&vue.echelle>22) glypheMetier(type,bb.cx,bb.cy,Math.min(11,r*.20));
      }

      /* Le rehaut du survol : un cerne, jamais un aplat — on ne cache pas
         le dessin sous une surbrillance. */
      if(actif){
        ctx.globalAlpha=1;
        ctx.strokeStyle='#b1502f';ctx.lineWidth=2.6;tracer(ring,1.5);ctx.stroke();
        ctx.strokeStyle='rgba(177,80,47,.28)';ctx.lineWidth=7;ctx.stroke();
      }
      ctx.restore();

      /* L'infobulle s'accroche elle aussi au barycentre des parcelles. */
      zones.push({id:o.b.id,type,x:o.ax,y:bb.y0,poly:o.visibles.map(s=>s.q),vu});
    }

    /* Le mode construction garde sa lecture de chantier. */
    if(construire&&survoleCell!=null){
      const c=plan.cellules.find(q=>q.i===survoleCell),occupe=parCell.has(survoleCell);
      if(c){
        tracer(c.q,1.5);
        ctx.fillStyle=occupe?'rgba(160,60,52,.22)':'rgba(80,124,70,.24)';ctx.fill();
        ctx.strokeStyle=occupe?'#9a3f39':'#4d7343';ctx.lineWidth=2.2;
        ctx.setLineDash([7,4]);ctx.stroke();ctx.setLineDash([]);
      }
    }

    /* La couche d'annotation passe après tout le trait. On réserve
       d'abord les étiquettes : celles qui tiennent portent déjà leur
       numéro, l'ouvrage n'a donc plus besoin de son repère isolé. */
    const poser=poseurEtiquettes();
    const seuil=vue.echelle>=34||filtreActif();
    const etiquettes=new Map();
    for(const o of ouvrages){
      if(!retenu(o.type)) continue;
      const actif=survole===o.b.id||vise===o.b.id;
      if(!seuil&&!actif) continue;
      if(estMaison(o.b.type)&&!actif&&!recherche) continue;
      const r=poser.reserver(o.ax,o.ay,reperes.get(o.b.id),nomDe(o.type).toUpperCase(),actif);
      if(r) etiquettes.set(o.b.id,r);
    }
    for(const o of ouvrages){
      if(!retenu(o.type)) continue;
      const st=etats.get(o.b.id),bb=o.bb,actif=survole===o.b.id||vise===o.b.id;
      if(!etiquettes.has(o.b.id)&&(vue.echelle>=18||actif||filtreActif()))
        repere(o.ax,o.ay,reperes.get(o.b.id),catInfo(o.type).c,actif);
      if(st&&(vue.echelle>=30||actif||(st.alerte&&vue.echelle>=20))&&(bb.y1-bb.y0)>16)
        cote(o.ax,bb.y1+3,st,st.alerte);
    }
    for(const o of ouvrages){
      const r=etiquettes.get(o.b.id);
      if(r) poser.tracer(r,catInfo(o.type).c);
    }

    if(survole){
      const z=zones.find(q=>q.id===survole),st=etats.get(survole);
      if(z&&st) infobulle(z,st,w,h);
    }
  }

  function infobulle(z,st,w,h){
    const type=z.type,info=catInfo(type),num=reperes.get(z.id)||'';
    const lignes=[];
    lignes.push({t:info.nom.toUpperCase()+(st.niv?'  ·  NIVEAU '+st.niv:''),p:true});
    if(!st.maison&&st.postes) lignes.push({t:'Postes tenus : '+st.tenus+' / '+st.postes});
    if(st.recette) lignes.push({t:'À l’ouvrage : '+st.recette});
    if(st.avarie) lignes.push({t:'⚠ Ouvrage endommagé',al:true});
    else if(st.bloque) lignes.push({t:'⚠ Production bloquée',al:true});
    else if(!st.maison&&st.postes&&st.tenus<st.postes)
      lignes.push({t:'⚠ '+(st.postes-st.tenus)+' poste(s) sans chat',al:true});

    const titre=num+'  '+nomDe(type).toUpperCase();
    ctx.font="700 13px 'Condense',sans-serif";
    let tw=ctx.measureText(titre).width;
    ctx.font="11px system-ui,sans-serif";
    for(const l of lignes) tw=Math.max(tw,ctx.measureText(l.t).width);
    const pad=9,ww=tw+pad*2,hh=22+lignes.length*14+pad;
    let x=z.x-ww/2,y=z.y-hh-18;
    x=Math.max(12,Math.min(w-ww-12,x));if(y<12)y=z.y+24;
    ctx.fillStyle='rgba(243,234,210,.96)';ctx.fillRect(x,y,ww,hh);
    ctx.strokeStyle=ENCRE;ctx.lineWidth=1.2;ctx.strokeRect(x+.5,y+.5,ww-1,hh-1);
    ctx.fillStyle=info.c;ctx.fillRect(x,y,3,hh);
    ctx.fillStyle=ENCRE;ctx.font="700 13px 'Condense',sans-serif";ctx.letterSpacing='.7px';
    ctx.fillText(titre,x+pad,y+18);ctx.letterSpacing='0px';
    ctx.font="11px system-ui,sans-serif";
    lignes.forEach((l,i)=>{
      ctx.fillStyle=l.al?'#a8342b':(l.p?'rgba(58,48,33,.6)':'rgba(58,48,33,.9)');
      ctx.fillText(l.t,x+pad,y+34+i*14);
    });
  }

  /* ==================================================================
     LE VOLET — nomenclature cherchable et légende des hachures
     ================================================================== */
  const elIndex=document.getElementById('plan-index');
  const elLegende=document.getElementById('plan-legende');
  const elRecherche=document.getElementById('plan-recherche');
  const elVolet=document.getElementById('plan-volet');
  const elReplier=document.getElementById('plan-replier');

  function inventaire(){
    if(!dernierPlan) return [];
    const out=[];
    for(const b of dernierPlan.batiments){
      if(!b.slots.length) continue;
      const type=b.pour||b.type,s=b.slots[0];
      out.push({id:b.id,type,nom:nomDe(type),cat:catDe(type),x:s.cx,z:s.cz,
                num:reperes.get(b.id)||0,st:etatDe(b.id,b.type)});
    }
    out.sort((a,b)=>(a.num||1e9)-(b.num||1e9));
    return out;
  }

  let signatureVolet='';
  function majVolet(force){
    if(!elIndex||!elLegende) return;
    const liste=inventaire();
    const sig=recherche+'|'+[...catsMasquees].sort().join(',')+'|'+vise+'|'
      +liste.map(e=>e.num+e.id+e.type+e.st.niv+e.st.tenus+'/'+e.st.postes+(e.st.alerte?'!':'')).join(',');
    if(!force&&sig===signatureVolet) return;
    signatureVolet=sig;

    const compte=new Map();
    for(const e of liste) compte.set(e.cat,(compte.get(e.cat)||0)+1);
    elLegende.textContent='';
    for(const cle of Object.keys(CATS)){
      const n=compte.get(cle);if(!n) continue;
      const info=CATS[cle],off=catsMasquees.has(cle);
      const b=document.createElement('button');
      b.type='button';b.className='plan-cat'+(off?' off':'');b.dataset.cat=cle;
      b.setAttribute('aria-pressed',off?'false':'true');
      b.title=(off?'Afficher':'Masquer')+' « '+info.nom+' »';
      const p=document.createElement('span');p.className='pastille';
      p.style.background=info.c;p.appendChild(vignetteHachure(info));
      const t=document.createElement('span');t.textContent=info.nom;
      const c=document.createElement('span');c.className='n';c.textContent=n;
      b.append(p,t,c);elLegende.appendChild(b);
    }

    const vus=liste.filter(e=>!catsMasquees.has(e.cat)&&(!recherche||e.nom.toLowerCase().includes(recherche)));
    elIndex.textContent='';
    if(!vus.length){
      const v=document.createElement('div');v.className='plan-vide';
      v.textContent=liste.length?'Aucun ouvrage ne correspond.':'Le bourg est encore vierge.';
      elIndex.appendChild(v);return;
    }
    for(const e of vus){
      const b=document.createElement('button');
      b.type='button';b.className='plan-item'+(vise===e.id?' vise':'');
      b.dataset.id=e.id;b.setAttribute('role','option');
      b.setAttribute('aria-selected',vise===e.id?'true':'false');
      const r=document.createElement('span');r.className='rep';r.textContent=e.num||'—';
      r.style.borderColor=CATS[e.cat].c;
      const n=document.createElement('span');n.className='nom';n.textContent=e.nom;
      const v=document.createElement('span');v.className='niv';
      v.textContent=(e.st.niv?'N'+e.st.niv:'')+(!e.st.maison&&e.st.postes?'  '+e.st.tenus+'/'+e.st.postes:'');
      b.append(r,n,v);
      if(e.st.alerte){
        const a=document.createElement('span');a.className='alerte';a.textContent='⚠';
        a.title=e.st.avarie?'Ouvrage endommagé':(e.st.bloque?'Production bloquée':'Poste sans chat');
        b.appendChild(a);
      }
      b.title='Repère '+e.num+' — '+e.nom+(e.st.niv?', niveau '+e.st.niv:'');
      elIndex.appendChild(b);
    }
  }
  /* La pastille de légende montre la HACHURE, pas seulement la couleur :
     c'est bien elle que le lecteur doit reconnaître sur la planche. */
  function vignetteHachure(info){
    const cv=document.createElement('canvas');cv.width=cv.height=18;
    const g=cv.getContext('2d');
    g.fillStyle='#f3ead2';g.fillRect(0,0,18,18);
    const st=info.h;
    if(st.t==='semis'){
      g.fillStyle='rgba(58,48,33,.55)';
      for(let y=3;y<18;y+=5) for(let x=(((y/5)|0)%2?5:2);x<18;x+=5) g.fillRect(x,y,1.4,1.4);
    }else if(st.t!=='aucune'){
      g.strokeStyle='rgba(58,48,33,.5)';g.lineWidth=1;
      if(st.t==='tiret') g.setLineDash([3,2]);
      for(const a of (st.t==='croise'?[st.a,st.a+Math.PI/2]:[st.a])){
        g.save();g.translate(9,9);g.rotate(a);g.beginPath();
        for(let t=-14;t<=14;t+=4){g.moveTo(-14,t);g.lineTo(14,t);}
        g.stroke();g.restore();
      }
    }
    g.strokeStyle='rgba(58,48,33,.75)';g.lineWidth=1.4;g.strokeRect(.7,.7,16.6,16.6);
    cv.style.width=cv.style.height='100%';cv.style.display='block';
    return cv;
  }

  if(elLegende) elLegende.addEventListener('click',e=>{
    const b=e.target.closest('.plan-cat');if(!b)return;
    const c=b.dataset.cat;
    if(catsMasquees.has(c)) catsMasquees.delete(c); else catsMasquees.add(c);
    derniereSignature='';dessiner();majVolet(true);
  });
  if(elIndex){
    elIndex.addEventListener('click',e=>{
      const b=e.target.closest('.plan-item');if(!b)return;
      vise=+b.dataset.id;centrerSur(vise);
      derniereSignature='';dessiner();majVolet(true);
    });
    elIndex.addEventListener('dblclick',e=>{
      const b=e.target.closest('.plan-item');if(!b)return;
      if(window.Village&&window.Village.selectionnerPlan) window.Village.selectionnerPlan(+b.dataset.id);
    });
    elIndex.addEventListener('pointerover',e=>{
      const b=e.target.closest('.plan-item');if(!b)return;
      const id=+b.dataset.id;if(survole===id)return;
      survole=id;derniereSignature='';dessiner();
    });
    elIndex.addEventListener('pointerleave',()=>{
      if(survole===null)return;survole=null;derniereSignature='';dessiner();
    });
  }
  if(elRecherche) elRecherche.addEventListener('input',()=>{
    recherche=elRecherche.value.trim().toLowerCase();
    if(recherche&&!tiroir) basculerTiroir(true);
    derniereSignature='';dessiner();majVolet(true);
    const vus=inventaire().filter(e=>!catsMasquees.has(e.cat)&&(!recherche||e.nom.toLowerCase().includes(recherche)));
    if(recherche&&vus.length===1){vise=vus[0].id;centrerSur(vus[0].id);derniereSignature='';dessiner();majVolet(true);}
  });

  /* Le tiroir de nomenclature : fermé par défaut, il ne mange aucune
     place. Une recherche l'ouvre d'elle-même. */
  function basculerTiroir(v){
    tiroir=(v===undefined)?!tiroir:v;
    if(elVolet) elVolet.classList.toggle('ouvert',tiroir);
    if(elReplier){
      elReplier.setAttribute('aria-expanded',tiroir?'true':'false');
      elReplier.title=tiroir?'Fermer la nomenclature':'Ouvrir la nomenclature';
      elReplier.setAttribute('aria-label',elReplier.title);
    }
    derniereSignature='';dessiner();if(tiroir)majVolet(true);
  }
  if(elReplier) elReplier.addEventListener('click',()=>basculerTiroir());

  document.querySelectorAll('[data-plan-zoom]').forEach(b=>{
    b.addEventListener('click',()=>{
      const q=b.dataset.planZoom;
      if(q==='0'){zoom=1;panX=panY=0;vise=null;}
      else zoom=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoom*(q==='+'?1.3:1/1.3)));
      derniereSignature='';dessiner();
    });
  });

  function centrerSur(id){
    if(!dernierPlan)return;
    const b=dernierPlan.batiments.find(q=>q.id===id);
    if(!b||!b.slots.length)return;
    const cx=b.slots.reduce((s,q)=>s+q.cx,0)/b.slots.length;
    const cz=b.slots.reduce((s,q)=>s+q.cz,0)/b.slots.length;
    zoom=Math.max(zoom,1.8);focus={x:cx,z:cz};
  }

  /* ==================================================================
     POINTAGE — survol, sélection, glisser, molette
     ================================================================== */
  function pointDansPoly(poly,x,y){
    const p=poly.map(proj);let dedans=false;
    for(let i=0,j=p.length-1;i<p.length;j=i++){
      if(((p[i].y>y)!==(p[j].y>y))&&(x<(p[j].x-p[i].x)*(y-p[i].y)/(p[j].y-p[i].y)+p[i].x)) dedans=!dedans;
    }
    return dedans;
  }
  const local=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  function cible(e){
    const {x,y}=local(e);
    for(let i=zones.length-1;i>=0;i--){
      const z=zones[i];if(!z.vu)continue;
      for(const poly of z.poly) if(pointDansPoly(poly,x,y)) return z;
    }
    return null;
  }
  function cibleCellule(e){
    if(!dernierPlan)return null;
    const {x,y}=local(e);
    for(let i=dernierPlan.cellules.length-1;i>=0;i--)
      if(pointDansPoly(dernierPlan.cellules[i].q,x,y)) return dernierPlan.cellules[i];
    return null;
  }

  let glisse=null;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    glisse={x:e.clientX,y:e.clientY,px:panX,py:panY,bouge:false};
    if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(glisse){
      const dx=e.clientX-glisse.x,dy=e.clientY-glisse.y;
      if(!glisse.bouge&&Math.hypot(dx,dy)>4) glisse.bouge=true;
      if(glisse.bouge){panX=glisse.px+dx;panY=glisse.py+dy;derniereSignature='';dessiner();return;}
    }
    const z=cible(e),id=z?z.id:null;
    const c=window.Village&&window.Village.enConstruction&&window.Village.enConstruction()?cibleCellule(e):null;
    const ci=c?c.i:null;
    if(id===survole&&ci===survoleCell)return;
    survole=id;survoleCell=ci;derniereSignature='';dessiner();
  });
  function finGlisse(e){
    if(!glisse)return false;
    const bouge=glisse.bouge;glisse=null;
    if(canvas.hasPointerCapture&&canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    return bouge;
  }
  canvas.addEventListener('pointerup',e=>{
    if(finGlisse(e)) return;
    if(window.Village&&window.Village.enConstruction&&window.Village.enConstruction()){
      const c=cibleCellule(e);if(c&&window.Village.poserSurPlan)window.Village.poserSurPlan(c.i);return;
    }
    const z=cible(e);if(!z)return;
    vise=z.id;derniereSignature='';majVolet(true);
    if(window.Village&&window.Village.selectionnerPlan) window.Village.selectionnerPlan(z.id);
  });
  canvas.addEventListener('pointercancel',finGlisse);
  canvas.addEventListener('pointerleave',e=>{
    finGlisse(e);survole=null;survoleCell=null;derniereSignature='';dessiner();
  });
  canvas.addEventListener('wheel',e=>{
    if(!ouvert)return;
    e.preventDefault();
    const {x,y}=local(e);
    const wx=(x-vue.ox)/vue.echelle, wz=(y-vue.oy)/vue.echelle;
    const nz=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoom*(e.deltaY<0?1.16:1/1.16)));
    if(nz===zoom)return;
    zoom=nz;
    const ech=vue.base*zoom;
    panX=x-wx*ech-vue.vcx+vue.cxm*ech;
    panY=y-wz*ech-vue.vcy+vue.czm*ech;
    derniereSignature='';dessiner();
  },{passive:false});

  /* ==================================================================
     OUVERTURE / FERMETURE
     ================================================================== */
  function ouvrir(){
    if(ouvert)return;
    ouvert=true;survole=null;survoleCell=null;derniereSignature='';
    recherche='';vise=null;recadrer=true;signatureVolet='';basculerTiroir(false);
    if(elRecherche) elRecherche.value='';
    document.body.classList.add('vue-plan-active');
    bouton.setAttribute('aria-pressed','true');
    bouton.setAttribute('aria-label','Revenir au village en trois dimensions');
    bouton.textContent='3D';
    if(hud){hud.hidden=false;hud.setAttribute('aria-hidden','false');}
    dessiner();majVolet(true);
  }
  function fermer(){
    if(!ouvert)return;
    ouvert=false;survole=null;survoleCell=null;
    document.body.classList.remove('vue-plan-active');
    bouton.setAttribute('aria-pressed','false');
    bouton.setAttribute('aria-label','Afficher le plan du village');
    bouton.textContent='▦';
    if(hud){hud.hidden=true;hud.setAttribute('aria-hidden','true');}
  }
  bouton.addEventListener('click',()=>ouvert?fermer():ouvrir());
  addEventListener('keydown',e=>{
    if(!ouvert)return;
    if(e.key==='Escape'){
      if(recherche){recherche='';if(elRecherche)elRecherche.value='';vise=null;
        derniereSignature='';dessiner();majVolet(true);return;}
      fermer();return;
    }
    if(e.target&&/^(INPUT|TEXTAREA)$/.test(e.target.tagName))return;
    if(e.key==='f'||e.key==='F'){if(elRecherche){e.preventDefault();elRecherche.focus();elRecherche.select();}}
    else if(e.key==='+'||e.key==='='){zoom=Math.min(ZOOM_MAX,zoom*1.25);derniereSignature='';dessiner();}
    else if(e.key==='-'){zoom=Math.max(ZOOM_MIN,zoom/1.25);derniereSignature='';dessiner();}
    else if(e.key==='0'){zoom=1;panX=panY=0;derniereSignature='';dessiner();}
  });
  addEventListener('resize',()=>{derniereSignature='';dessiner();});

  let tic=0;
  (function boucle(){
    if(ouvert){dessiner();if(++tic%20===0)majVolet(false);}
    requestAnimationFrame(boucle);
  })();

  window.VuePlanVillage={
    ouvrir,fermer,active:()=>ouvert,
    actualiser:()=>{derniereSignature='';dessiner();majVolet(true);},
    montrer:id=>{if(!ouvert)ouvrir();vise=id;centrerSur(id);derniereSignature='';dessiner();majVolet(true);}
  };
})();
