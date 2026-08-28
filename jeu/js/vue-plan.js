/* ============================================================
   LE BOURG — vue-plan.js

   Une projection topographique du plan réel : aucune perspective. Les
   emprises reçoivent des silhouettes cartographiques dessinées à l'encre,
   dans le même langage visuel que la carte navale. Une pile de maisons
   partage une unique silhouette afin de conserver un plan lisible.
   ============================================================ */
"use strict";
(function(){
  const canvas=document.getElementById('plan-village');
  const bouton=document.getElementById('bouton-plan-village');
  if(!canvas||!bouton) return;

  const ctx=canvas.getContext('2d');
  const sprites=new Map();
  let ouvert=false, derniereSignature='', zones=[], survole=null,survoleCell=null,dernierPlan=null;
  let vue={minX:-1,maxX:1,minZ:-1,maxZ:1,echelle:1,ox:0,oy:0};

  const estMaison=t=>t==='maison';
  const nomDe=t=>window.BAT&&window.BAT[t]?window.BAT[t].nom:t;

  const TYPES={
    cultures:new Set(['champ','tournesol','potager','fleurs','pepiniere']),
    eau:new Set(['port','pecherie']),
    moulins:new Set(['moulin','moulinEau']),
    forteresses:new Set(['tour','chateau','caserne','entrainement','descente']),
    roches:new Set(['mine','carriere','charbonniere']),
    arbres:new Set(['arbrechat']),
    religieux:new Set(['eglise']),
    enceintes:new Set(['rempart'])
  };

  function hashTexte(texte){
    let h=2166136261;
    for(let i=0;i<texte.length;i++){h^=texte.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }
  function palette(type){
    const cat=window.BAT&&window.BAT[type]&&window.BAT[type].cat;
    return {
      recolte:['#9a874d','#c7ad63'],elevage:['#a7754f','#d0a36a'],
      atelier:['#925443','#c47759'],stockage:['#795844','#ad7b54'],
      commerce:['#705b68','#9b7881'],vie:['#9a6559','#ca8b75'],
      guerre:['#53636a','#7e8b8d'],porte:['#455f66','#71888a']
    }[cat]||['#76604f','#a98262'];
  }
  function polygone(g,points){
    g.beginPath();points.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();
  }
  function toit(g,x,y,w,h,couleur,angle=0){
    g.save();g.translate(x,y);g.rotate(angle);
    const b=Math.min(8,w*.16,h*.22);
    polygone(g,[[-w/2+b,-h/2], [w/2-b,-h/2], [w/2,h/2-b], [w/2-b,h/2], [-w/2+b,h/2], [-w/2,h/2-b], [-w/2,-h/2+b]]);
    g.fillStyle=couleur;g.fill();g.strokeStyle='#543e2b';g.lineWidth=2.2;g.stroke();
    g.beginPath();g.moveTo(-w/2+b,-h/2);g.lineTo(0,0);g.lineTo(w/2-b,-h/2);
    g.moveTo(-w/2+b,h/2);g.lineTo(0,0);g.lineTo(w/2-b,h/2);g.strokeStyle='rgba(78,55,37,.62)';g.lineWidth=1;g.stroke();
    g.beginPath();g.moveTo(0,-h/2+1);g.lineTo(0,h/2-1);g.strokeStyle='#f0d7a2';g.lineWidth=1.35;g.stroke();
    g.save();polygone(g,[[-w/2+b,-h/2], [w/2-b,-h/2], [w/2,h/2-b], [w/2-b,h/2], [-w/2+b,h/2], [-w/2,h/2-b], [-w/2,-h/2+b]]);g.clip();
    g.strokeStyle='rgba(71,48,31,.25)';g.lineWidth=.8;
    for(let yy=-h/2+5;yy<h/2;yy+=6){g.beginPath();g.moveTo(-w/2,yy);g.lineTo(w/2,yy+2);g.stroke();}
    g.restore();g.restore();
  }
  function roue(g,x,y,r){
    g.save();g.translate(x,y);g.strokeStyle='#55402e';g.lineWidth=2.1;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();
    g.lineWidth=1.2;for(let i=0;i<8;i++){const a=i*Math.PI/4;g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);g.stroke();}
    g.fillStyle='#735338';g.beginPath();g.arc(0,0,2.4,0,Math.PI*2);g.fill();g.restore();
  }
  function crenele(g,x,y,r,couleur){
    g.save();g.translate(x,y);g.fillStyle=couleur;g.strokeStyle='#4d3c2d';g.lineWidth=2.2;
    g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.stroke();
    for(let i=0;i<8;i++){const a=i*Math.PI/4,xx=Math.cos(a)*(r-1),yy=Math.sin(a)*(r-1);g.save();g.translate(xx,yy);g.rotate(a);g.fillRect(-3,-3,6,6);g.strokeRect(-3,-3,6,6);g.restore();}
    g.beginPath();g.arc(0,0,r*.42,0,Math.PI*2);g.strokeStyle='rgba(57,47,39,.55)';g.lineWidth=1.2;g.stroke();g.restore();
  }
  function glypheMetier(g,type,x,y){
    g.save();g.translate(x,y);g.strokeStyle='#4d3928';g.fillStyle='#4d3928';g.lineCap='round';g.lineJoin='round';g.lineWidth=2;
    if(/forge|fonderie|armurerie|orfevre/.test(type)){
      polygone(g,[[-8,-2],[5,-2],[9,-6],[10,-2],[5,2],[2,7],[-5,7],[-3,2],[-8,1]]);g.fill();
    }else if(/tisserand|filature|tannerie/.test(type)){
      g.beginPath();g.arc(0,0,7,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(-5,-5);g.lineTo(5,5);g.moveTo(5,-5);g.lineTo(-5,5);g.stroke();
    }else if(/herboristerie|alchimie|rucher/.test(type)){
      g.beginPath();g.moveTo(0,8);g.quadraticCurveTo(-11,-1,-3,-8);g.quadraticCurveTo(3,-4,0,8);g.quadraticCurveTo(11,-1,3,-8);g.quadraticCurveTo(-3,-4,0,8);g.stroke();
    }else if(/taverne|cuisine|fumoir|laiterie/.test(type)){
      g.beginPath();g.arc(0,1,7,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(-6,-5);g.lineTo(6,7);g.moveTo(6,-5);g.lineTo(-6,7);g.stroke();
    }else if(type==='puits'){
      g.beginPath();g.arc(0,1,7,0,Math.PI*2);g.stroke();
    }else{
      const h=hashTexte(type),n=3+h%4;g.beginPath();
      for(let i=0;i<n*2;i++){const a=-Math.PI/2+i*Math.PI/n,r=i%2?3.5:8;const xx=Math.cos(a)*r,yy=Math.sin(a)*r;i?g.lineTo(xx,yy):g.moveTo(xx,yy);}g.closePath();g.stroke();
    }
    g.restore();
  }

  /* Chaque sprite est généré une seule fois sur un petit canevas transparent.
     Il reste donc parfaitement stable, même pendant les déplacements de caméra. */
  function spriteCarte(type,maison=false,pile=false,forme='normal'){
    const cle=[type,maison?'m':'b',pile?'p':'s',forme].join('|');
    if(sprites.has(cle)) return sprites.get(cle);
    const cv=document.createElement('canvas');cv.width=180;cv.height=150;
    const g=cv.getContext('2d');g.lineCap='round';g.lineJoin='round';
    const graine=hashTexte(cle),p=palette(type),large=forme==='large',etroit=forme==='etroit';
    g.save();g.translate(90,76);
    /* Socle irrégulier d'herbe et ombre d'encre, comme les îles navales. */
    g.fillStyle='rgba(99,111,67,.25)';polygone(g,[[-67,-31],[-43,-47],[2,-44],[52,-36],[69,-7],[58,31],[17,44],[-35,39],[-66,17]]);g.fill();
    g.fillStyle='rgba(65,44,30,.18)';g.beginPath();g.ellipse(2,24,57,21,0,0,Math.PI*2);g.fill();

    if(TYPES.cultures.has(type)){
      g.save();g.rotate(-.08);g.fillStyle='#a88b55';g.strokeStyle='#57442f';g.lineWidth=2;
      const ww=large?118:104,hh=etroit?48:70;polygone(g,[[-ww/2+8,-hh/2], [ww/2,-hh/2+5], [ww/2-7,hh/2], [-ww/2,hh/2-6]]);g.fill();g.stroke();
      for(let y=-hh/2+10;y<hh/2;y+=11){g.beginPath();g.moveTo(-ww/2+7,y);g.lineTo(ww/2-7,y+4);g.strokeStyle=type==='fleurs'?'#9c695f':'#69734a';g.lineWidth=3;g.stroke();}
      if(type==='tournesol'||type==='fleurs')for(let i=0;i<14;i++){const x=-45+(i*29%91),y=-25+(i*17%52);g.fillStyle=i%3?'#d2ad58':'#a86666';g.beginPath();g.arc(x,y,2.2,0,Math.PI*2);g.fill();}
      g.restore();
    }else if(type==='puits'){
      g.fillStyle='#a89778';g.strokeStyle='#513e2e';g.lineWidth=3;g.beginPath();g.arc(0,3,25,0,Math.PI*2);g.fill();g.stroke();
      g.fillStyle='#395b61';g.beginPath();g.arc(0,3,14,0,Math.PI*2);g.fill();g.stroke();
      g.beginPath();g.moveTo(-25,-2);g.lineTo(-25,-31);g.moveTo(25,-2);g.lineTo(25,-31);g.moveTo(-31,-31);g.lineTo(31,-31);g.stroke();
      toit(g,0,-32,70,17,p[1],0);
    }else if(TYPES.eau.has(type)){
      g.strokeStyle='#496a70';g.lineWidth=2;for(let y=24;y<47;y+=7){g.beginPath();g.moveTo(-65,y);g.quadraticCurveTo(-30,y-5,0,y);g.quadraticCurveTo(30,y+5,65,y);g.stroke();}
      g.fillStyle='#806044';g.strokeStyle='#4f3b2b';g.lineWidth=2;
      for(const x of[-40,0,40]){g.fillRect(x-5,-3,10,50);g.strokeRect(x-5,-3,10,50);}
      toit(g,-10,-18,92,52,p[1],-.03);
      if(type==='port'){g.fillStyle='#8e6748';g.beginPath();g.moveTo(26,35);g.quadraticCurveTo(45,45,61,34);g.lineTo(55,46);g.quadraticCurveTo(39,56,23,42);g.closePath();g.fill();g.stroke();}
    }else if(TYPES.moulins.has(type)){
      toit(g,0,9,65,64,p[1],.02);
      if(type==='moulin'){
        g.strokeStyle='#513d2d';g.lineWidth=3;g.beginPath();g.arc(0,-9,5,0,Math.PI*2);g.stroke();
        for(let i=0;i<4;i++){g.save();g.rotate(i*Math.PI/2+.25);polygone(g,[[2,-7],[10,-48],[-2,-54],[-5,-9]]);g.fillStyle='#d8c59b';g.fill();g.stroke();g.restore();}
      }else roue(g,38,14,23);
    }else if(TYPES.enceintes.has(type)){
      g.strokeStyle='#4f4337';g.fillStyle='#8e8a78';g.lineWidth=3;g.beginPath();g.moveTo(-67,0);g.lineTo(67,0);g.stroke();
      for(let x=-62;x<=62;x+=18){g.fillRect(x-6,-10,12,20);g.strokeRect(x-6,-10,12,20);}
    }else if(TYPES.forteresses.has(type)){
      if(type==='chateau'){crenele(g,-30,5,22,p[1]);crenele(g,30,5,22,p[1]);toit(g,0,2,70,55,p[0]);}
      else{crenele(g,0,1,type==='tour'?31:27,p[1]);if(type!=='tour')toit(g,-30,19,50,35,p[0],-.04);}
    }else if(TYPES.religieux.has(type)){
      toit(g,0,5,58,91,p[1],0);toit(g,0,-9,96,35,p[0],0);
      g.strokeStyle='#523d2c';g.lineWidth=3;g.beginPath();g.moveTo(0,-31);g.lineTo(0,-48);g.moveTo(-8,-40);g.lineTo(8,-40);g.stroke();
    }else if(TYPES.roches.has(type)){
      g.fillStyle='#807667';g.strokeStyle='#4e4032';g.lineWidth=2.2;
      for(let i=0;i<9;i++){const a=i*.93+(graine%13)*.04,r=9+(i%3)*15,x=Math.cos(a)*r,y=Math.sin(a)*r*.65;polygone(g,[[x-10,y+6],[x-6,y-7],[x+4,y-11],[x+11,y+4],[x+2,y+10]]);g.fill();g.stroke();}
      if(type==='mine'){g.fillStyle='#2f3332';g.beginPath();g.arc(0,8,19,Math.PI,0);g.lineTo(19,19);g.lineTo(-19,19);g.closePath();g.fill();g.stroke();}
    }else if(TYPES.arbres.has(type)){
      g.strokeStyle='#4f4a31';g.lineWidth=2.2;
      for(const a of[-1.7,-.8,.1,1.1,2.1]){const r=24+(Math.abs(a)*7),x=Math.cos(a)*r*.7,y=Math.sin(a)*r*.45;g.fillStyle=(a<0?'#788552':'#6a7849');g.beginPath();g.arc(x,y,24,0,Math.PI*2);g.fill();g.stroke();}
      g.fillStyle='#7a573c';g.fillRect(-5,13,10,30);g.strokeRect(-5,13,10,30);
    }else{
      const w=large?116:(etroit?65:94),h=etroit?78:57,ang=((graine%9)-4)*.008;
      if(pile)toit(g,-11,-15,w*.82,h*.75,p[0],ang-.025);
      toit(g,0,2,w,h,p[1],ang);
      if(!maison){
        if(/forge|fonderie|fumoir|charbonniere|verrerie|tuilerie|poterie/.test(type)){
          g.fillStyle='#8a654a';g.strokeStyle='#4e3929';g.lineWidth=2;g.fillRect(w*.22,-h*.45,11,24);g.strokeRect(w*.22,-h*.45,11,24);
        }
        glypheMetier(g,type,0,4);
      }else{
        g.fillStyle='#d2bd8e';g.strokeStyle='#573f2c';g.lineWidth=1.5;g.fillRect(-7,-8,14,16);g.strokeRect(-7,-8,14,16);
      }
    }
    /* Petits traits d'encre irréguliers mais entièrement déterministes. */
    let etat=graine||1;const rnd=()=>((etat=Math.imul(etat,1664525)+1013904223|0)>>>0)/4294967296;
    g.fillStyle='rgba(72,52,35,.22)';for(let i=0;i<23;i++)g.fillRect(-65+rnd()*130,-40+rnd()*83,.6+rnd()*1.3,.5+rnd());
    g.restore();sprites.set(cle,cv);return cv;
  }

  function mesurer(plan,w,h){
    const pts=[];
    for(const c of plan.cellules) for(const p of c.q) pts.push(p);
    let minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x));
    let minZ=Math.min(...pts.map(p=>p.z)),maxZ=Math.max(...pts.map(p=>p.z));
    if(!Number.isFinite(minX)){minX=minZ=-1;maxX=maxZ=1;}
    const marge=44, ew=Math.max(.1,maxX-minX),eh=Math.max(.1,maxZ-minZ);
    const echelle=Math.min((w-marge*2)/ew,(h-marge*2)/eh);
    const largeur=ew*echelle,hauteur=eh*echelle;
    vue={minX,maxX,minZ,maxZ,echelle,ox:(w-largeur)/2-minX*echelle,
         oy:(h-hauteur)/2-minZ*echelle};
  }
  const proj=p=>({x:vue.ox+p.x*vue.echelle,y:vue.oy+p.z*vue.echelle});

  function chemin(poly,retrait=0){
    const ps=poly.map(proj),cx=ps.reduce((s,p)=>s+p.x,0)/ps.length,
          cy=ps.reduce((s,p)=>s+p.y,0)/ps.length;
    ctx.beginPath();
    ps.forEach((p,i)=>{
      const dx=p.x-cx,dy=p.y-cy,l=Math.hypot(dx,dy)||1;
      const q={x:p.x-dx/l*retrait,y:p.y-dy/l*retrait};
      if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);
    });
    ctx.closePath();
  }

  function fond(plan,w,h){
    /* Mer d'encre, papier jauni et grain léger : la géométrie ne bouge pas,
       seul son langage visuel passe du relevé technique à la carte. */
    const mer=ctx.createRadialGradient(w*.50,h*.46,30,w*.50,h*.46,Math.max(w,h)*.72);
    mer.addColorStop(0,'#496771');mer.addColorStop(1,'#253e49');
    ctx.fillStyle=mer;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalAlpha=.13;ctx.strokeStyle='#d5e0d8';ctx.lineWidth=.7;
    for(let k=-h;k<w+h;k+=23){ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(k-h,h);ctx.stroke();}
    ctx.restore();

    /* Ombre littorale puis cellules de papier. */
    ctx.save();ctx.shadowColor='rgba(8,22,27,.55)';ctx.shadowBlur=15;ctx.shadowOffsetY=5;
    for(const c of plan.cellules){chemin(c.q);ctx.fillStyle='#d8c99f';ctx.fill();}
    ctx.restore();
    ctx.save();ctx.translate(.5,.5);
    for(const c of plan.cellules){
      chemin(c.q);
      ctx.fillStyle='#d8c99f';ctx.fill();
      ctx.strokeStyle='rgba(91,77,55,.15)';ctx.lineWidth=.75;ctx.stroke();
    }
    ctx.restore();

    /* La côte est extraite des arêtes qui n'appartiennent qu'à une cellule. */
    const aretes=new Map(),cleP=p=>p.x.toFixed(4)+','+p.z.toFixed(4);
    for(const c of plan.cellules) for(let i=0;i<c.q.length;i++){
      const a=c.q[i],b=c.q[(i+1)%c.q.length],ka=cleP(a),kb=cleP(b),k=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(aretes.has(k)) aretes.get(k).n++; else aretes.set(k,{a,b,n:1});
    }
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for(const ep of[5,1.7]){
      ctx.beginPath();
      for(const e of aretes.values()) if(e.n===1){const a=proj(e.a),b=proj(e.b);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
      ctx.strokeStyle=ep>2?'rgba(35,57,61,.48)':'#66563e';ctx.lineWidth=ep;ctx.stroke();
    }
    ctx.restore();

    /* Grain déterministe du papier, discret et immobile. */
    let graine=1937;const rnd=()=>((graine=Math.imul(graine,1664525)+1013904223|0)>>>0)/4294967296;
    ctx.save();ctx.fillStyle='rgba(82,64,42,.085)';
    for(let k=0;k<Math.min(1900,Math.floor(w*h/650));k++){const x=rnd()*w,y=rnd()*h;ctx.fillRect(x,y,rnd()*1.5+.25,rnd()*1.5+.25);}
    ctx.restore();

    /* Filet de carte et cartouche, sous le bandeau de jeu. */
    ctx.strokeStyle='rgba(232,218,178,.42)';ctx.lineWidth=1;ctx.strokeRect(9.5,9.5,w-19,h-19);
    ctx.strokeStyle='rgba(39,60,66,.72)';ctx.strokeRect(13.5,13.5,w-27,h-27);
    ctx.fillStyle='rgba(238,224,188,.88)';ctx.fillRect(21,67,133,27);
    ctx.strokeStyle='rgba(83,66,44,.55)';ctx.strokeRect(21.5,67.5,133,27);
    ctx.fillStyle='rgba(48,46,41,.76)';
    ctx.font="700 12px 'Condense',sans-serif";ctx.letterSpacing='2px';
    ctx.fillText('CARTE DU BOURG',31,85);

    /* Rose des vents. */
    const nx=w-34,ny=83;ctx.save();ctx.translate(nx,ny);
    ctx.fillStyle='rgba(238,224,188,.86)';ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(68,61,48,.62)';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='#584c3a';ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(4,3);ctx.lineTo(0,0);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(0,16);ctx.lineTo(3,-2);ctx.lineTo(0,0);ctx.lineTo(-3,-2);ctx.closePath();ctx.fill();
    ctx.font="700 9px 'Condense',sans-serif";ctx.textAlign='center';ctx.fillText('N',0,-23);ctx.restore();
  }

  function donneesVisibles(plan){
    const parCell=new Map();
    for(const b of plan.batiments) for(const s of b.slots){
      if(!parCell.has(s.cell)) parCell.set(s.cell,[]);
      parCell.get(s.cell).push({b,s});
    }
    for(const lot of parCell.values()) lot.sort((a,b)=>a.s.L-b.s.L);
    return {parCell};
  }

  function dessiner(){
    if(!ouvert||!window.Village||!window.Village.planArchitecture) return;
    const dpr=Math.min(window.devicePixelRatio||1,2),r=canvas.getBoundingClientRect();
    const W=Math.max(1,Math.round(r.width*dpr)),H=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;derniereSignature='';}
    const plan=window.Village.planArchitecture();dernierPlan=plan;
    const construire=!!(window.Village.enConstruction&&window.Village.enConstruction());
    const signature=W+'x'+H+'|'+plan.batiments.map(b=>b.id+':'+b.type+':'+b.L+':'+b.slots.map(s=>s.cell+'@'+s.L).join('.')).join('|')+'|'+survole+'|'+survoleCell+'|'+construire;
    if(signature===derniereSignature) return;
    derniereSignature=signature;ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=W/dpr,h=H/dpr;mesurer(plan,w,h);fond(plan,w,h);zones=[];
    const {parCell}=donneesVisibles(plan);

    /* Emprises interactives : elles restent très discrètes, car les sprites
       portent maintenant l'essentiel de l'information visuelle. */
    for(const [cell,lot] of parCell){
      const haut=lot[lot.length-1],actif=survole===haut.b.id;
      const p=proj({x:haut.s.cx,z:haut.s.cz});
      chemin(haut.s.q,2.3);
      ctx.fillStyle=actif?'rgba(194,115,68,.22)':'rgba(238,222,181,.11)';ctx.fill();
      ctx.strokeStyle=actif?'#a35337':'rgba(96,75,49,.22)';ctx.lineWidth=actif?2.4:1;ctx.stroke();
      zones.push({id:haut.b.id,type:haut.b.type,x:p.x,y:p.y,poly:haut.s.q,cell});
    }

    if(construire&&survoleCell!=null){
      const c=plan.cellules.find(q=>q.i===survoleCell),occupe=parCell.has(survoleCell);
      if(c){chemin(c.q,1.5);ctx.fillStyle=occupe?'rgba(165,65,58,.28)':'rgba(87,137,75,.30)';ctx.fill();
        ctx.strokeStyle=occupe?'#a54640':'#547f49';ctx.lineWidth=2.4;ctx.setLineDash([7,3]);ctx.stroke();ctx.setLineDash([]);}
    }

    /* Une illustration par bâtiment, triée du nord au sud. Cela donne une
       lecture de vraie carte sans multiplier les symboles sur chaque case. */
    const aDessiner=[];
    for(const b of plan.batiments){
      if(!b.slots.length) continue;
      const visibles=b.slots.filter(s=>{
        const lot=parCell.get(s.cell);return lot&&lot[lot.length-1].b.id===b.id;
      });
      if(!visibles.length) continue;
      const points=visibles.flatMap(s=>s.q.map(proj));
      const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
      const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
      const x=(minX+maxX)/2,y=(minY+maxY)/2,w=maxX-minX,h=maxY-minY;
      const pile=visibles.some(s=>{const lot=parCell.get(s.cell);return lot&&lot.length>1&&lot.every(q=>estMaison(q.b.type));});
      const forme=w>h*1.45?'large':h>w*1.45?'etroit':'normal';
      aDessiner.push({b,visibles,x,y,w,h,pile,forme});
    }
    aDessiner.sort((a,b)=>a.y-b.y||a.x-b.x);
    for(const item of aDessiner){
      const {b,x,y,w,h,pile,forme}=item,type=b.pour||b.type,maison=estMaison(b.type),actif=survole===b.id;
      const im=spriteCarte(type,maison,pile,forme);
      const dw=Math.max(38,w+Math.min(22,vue.echelle*.2));
      const dh=Math.max(34,h+Math.min(18,vue.echelle*.17));
      const ratio=im.width/im.height;let rw=dw,rh=dh;
      if(rw/rh>ratio*1.35)rh=rw/ratio;else if(rw/rh<ratio*.72)rw=rh*ratio;
      rw=Math.min(rw,Math.max(44,w*1.32));rh=Math.min(rh,Math.max(40,h*1.38));
      ctx.save();
      if(actif){ctx.shadowColor='rgba(255,219,145,.9)';ctx.shadowBlur=13;ctx.globalAlpha=1;}
      else{ctx.shadowColor='rgba(43,31,23,.22)';ctx.shadowBlur=3;ctx.shadowOffsetY=2;ctx.globalAlpha=.97;}
      ctx.drawImage(im,x-rw/2,y-rh/2,rw,rh);ctx.restore();
    }

    if(survole){
      const z=zones.find(q=>q.id===survole);
      if(z){
        const nom=nomDe(z.type),pad=7;ctx.font="700 11px 'Condense',sans-serif";
        const tw=ctx.measureText(nom.toUpperCase()).width;
        ctx.fillStyle='rgba(29,23,40,.91)';ctx.fillRect(z.x-tw/2-pad,z.y-34,tw+pad*2,22);
        ctx.fillStyle='#f1e7cf';ctx.textAlign='center';ctx.fillText(nom.toUpperCase(),z.x,z.y-19);ctx.textAlign='left';
      }
    }
  }

  function pointDans(poly,x,y){
    const p=poly.map(proj);let dedans=false;
    for(let i=0,j=p.length-1;i<p.length;j=i++){
      if(((p[i].y>y)!==(p[j].y>y))&&(x<(p[j].x-p[i].x)*(y-p[i].y)/(p[j].y-p[i].y)+p[i].x)) dedans=!dedans;
    }
    return dedans;
  }
  function cible(e){
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    for(let i=zones.length-1;i>=0;i--) if(pointDans(zones[i].poly,x,y)) return zones[i];
    return null;
  }
  function cibleCellule(e){
    if(!dernierPlan)return null;
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    for(let i=dernierPlan.cellules.length-1;i>=0;i--) if(pointDans(dernierPlan.cellules[i].q,x,y)) return dernierPlan.cellules[i];
    return null;
  }
  canvas.addEventListener('pointermove',e=>{
    const z=cible(e),id=z?z.id:null,c=window.Village&&window.Village.enConstruction&&window.Village.enConstruction()?cibleCellule(e):null;
    const ci=c?c.i:null;if(id===survole&&ci===survoleCell)return;survole=id;survoleCell=ci;derniereSignature='';dessiner();
  });
  canvas.addEventListener('pointerleave',()=>{survole=null;survoleCell=null;derniereSignature='';dessiner();});
  canvas.addEventListener('click',e=>{
    if(window.Village&&window.Village.enConstruction&&window.Village.enConstruction()){
      const c=cibleCellule(e);if(c&&window.Village.poserSurPlan)window.Village.poserSurPlan(c.i);return;
    }
    const z=cible(e);if(!z)return;
    if(window.Village&&window.Village.selectionnerPlan) window.Village.selectionnerPlan(z.id);
  });

  function ouvrir(){
    if(ouvert)return;ouvert=true;survole=null;survoleCell=null;derniereSignature='';
    document.body.classList.add('vue-plan-active');bouton.setAttribute('aria-pressed','true');
    bouton.setAttribute('aria-label','Revenir au village en trois dimensions');bouton.textContent='3D';
    dessiner();
  }
  function fermer(){
    if(!ouvert)return;ouvert=false;survole=null;survoleCell=null;
    document.body.classList.remove('vue-plan-active');bouton.setAttribute('aria-pressed','false');
    bouton.setAttribute('aria-label','Afficher le plan du village');bouton.textContent='▦';
  }
  bouton.addEventListener('click',()=>ouvert?fermer():ouvrir());
  addEventListener('keydown',e=>{if(e.key==='Escape'&&ouvert)fermer();});
  addEventListener('resize',()=>{derniereSignature='';dessiner();});

  /* Une reconstruction économique peut changer une parcelle pendant que le
     plan est ouvert. Cette boucle ne redessine que si sa signature a changé. */
  (function boucle(){if(ouvert)dessiner();requestAnimationFrame(boucle);})();
  window.VuePlanVillage={ouvrir,fermer,active:()=>ouvert,actualiser:()=>{derniereSignature='';dessiner();}};
})();
