(function(){
"use strict";
let HOOK={}, NOM_BOURG='', RANG_COURANT='', POP_FORCEE=null, SEQ=0;
/* deux réglages d'affichage, pilotés depuis les préférences du joueur */
let MONTRER_GAINS=true, MONTRER_GESTES=true;
/* ==================================================================
   BOURG — cité médiévale vivante, pixel art procédural
   ------------------------------------------------------------------
   Architecture pensée pour tourner sur du matériel ancien :
   · Canvas 2D pur, aucune dépendance, aucun WebGL (pas de shaders à
     compiler, pas de repli logiciel catastrophique sur vieux GPU).
   · Résolution interne au plus près du pixel de l'écran (jusqu'à 2560x1440)
     puis agrandissement ENTIER par le compositeur -> la finesse suit la
     fenêtre, et le coût de remplissage reste borné quelle que soit l'écran.
   · CALQUES CUITS : un bâtiment terminé est composité une fois pour
     toutes dans le canvas de sa rangée. Le rendu d'une frame ne fait
     donc que ~8 drawImage plein écran + les parties réellement mobiles.
   · CALQUES DÉRIVÉS (liserés de lumière rasante, reflets de la rivière) :
     recalculés seulement quand leur source change ou que l'astre passe
     d'un bord à l'autre — deux fois par journée de jeu.
   · RELIEF PAR MASQUES : le volume des sprites n'est pas peint à la main
     mais obtenu en recomposant le sprite avec lui-même décalé (ombre
     portée interne, arêtes au soleil). Aucune lecture de pixels.
   · ATLAS D'HABITANTS : chaque villageois = 1 drawImage (pas 6 fillRect).
   · POOLS EN TYPED ARRAYS pour les particules -> zéro allocation, zéro GC.
   · FRAMES PRÉ-CUITES pour l'eau et les tournesols (animation = cycle
     d'images, pas de recalcul).
   · Qualité adaptative : mesure du temps de frame et dégradation douce.
   ------------------------------------------------------------------
   L'ancre de l'URL porte l'état : #g=graine&h=heure(0..1)&n=édifices.
   ================================================================== */

/* ==================================================================
   1. NOYAU : aléatoire, couleurs, primitives pixel
   ================================================================== */

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let rnd = mulberry32(1);
const R    = (a,b)=>a+rnd()*(b-a);
const RI   = (a,b)=>Math.floor(a+rnd()*(b-a+1));
const pick = a=>a[(rnd()*a.length)|0];
const chance = p=>rnd()<p;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp =(a,b,t)=>a+(b-a)*t;

function h2r(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function r2h(c){return '#'+c.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');}
function mix(a,b,t){const A=h2r(a),B=h2r(b);return r2h([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]);}
const ombre = (c,t)=>mix(c,'#101319',t);
const clair = (c,t)=>mix(c,'#fff4de',t);

/* -- primitives : tout est arrondi à l'entier, jamais d'antialiasing -- */
function fr(c,x,y,w,h,col){ if(w<=0||h<=0)return; c.fillStyle=col; c.fillRect(x|0,y|0,Math.round(w),Math.round(h)); }
function trait(c,x0,y0,x1,y1,col,th){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
  let err=dx+dy,n=0;th=th||1;
  for(;;){ fr(c,x0,y0,th,th,col); if((x0===x1&&y0===y1)||++n>1200)break;
    const e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;} }
}
function disque(c,cx,cy,r,col){
  for(let j=-r;j<=r;j++){
    const d=Math.floor(Math.sqrt(Math.max(0,r*r+r*0.6-j*j)));
    fr(c,cx-d,cy+j,2*d+1,1,col);
  }
}
function ellipse(c,cx,cy,rx,ry,col){
  for(let j=-ry;j<=ry;j++){
    const t=1-(j*j)/(ry*ry); if(t<=0)continue;
    const d=Math.round(rx*Math.sqrt(t));
    fr(c,cx-d,cy+j,2*d+1,1,col);
  }
}

/* -- fabrique de sprite hors écran + points d'ancrage animés -- */
/* Chaque sprite tire UNE couverture et s'y tient : deux versants d'une même
   maison ne peuvent pas être l'un en ardoise et l'autre en bardeau. */
let MATCOUR='tuile', MURCOUR='moellon';
/* ------------------------------------------------------------------
   PAREMENTS. Tous les murs du bourg étaient le même appareil de moellons
   au pas de trois, quelle que soit la fonction ou la richesse de l'édifice.
   Or on lit un mur avant tout à son APPAREIL :
     moellon   tout-venant hourdé, joints épais, assises irrégulières
     taille    pierre de taille, grands blocs réguliers, joints fins et creux
     crépi     enduit à la chaux, écaillé par plaques qui laissent voir la
               pierre — c'est le plus parlant : il donne l'âge du bâtiment
     briquete  hourdis de brique entre chaînes de pierre
   Chaque sprite tire son parement une fois et s'y tient, sinon un même
   édifice changerait de maçonnerie d'un pan à l'autre.
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   LES TROIS ÂGES D'UN ÉDIFICE.

   Un atelier de niveau 1 et un atelier de niveau 9 ne peuvent pas se
   ressembler : le joueur doit voir son bourg s'enrichir, pas seulement
   lire un chiffre. Plutôt que de redessiner quarante générateurs, on
   agit là où TOUT passe — la couverture et le parement. Le moteur sait
   déjà peindre le bardeau, la tuile, la lauze, le moellon, le crépi et
   la pierre de taille : il suffit de ne plus les tirer au hasard.

     0  RUSTIQUE  bardeau, planche et moellon hourdé — on a bâti avec
                  ce qu'on avait sous la patte.
     1  ÉTABLI    tuile cuite, hourdis de brique — le bourg a une
                  tuilerie et les moyens de s'en servir.
     2  MAÎTRE    lauze scellée, pierre de taille — cela tiendra deux
                  siècles, et cela se voit de l'autre rive.

   `parer()` ajoute ensuite ce qui ne se déduit pas d'un matériau :
   l'enseigne peinte, la lanterne, l'oriflamme et le faîtage doré.
   ------------------------------------------------------------------ */
let PAL_COUR=0;                       // palier de l'édifice en fabrication
const PALIER_NOMS=['rustique','établi','de maître'];
function palierDeNiveau(niv){ return (niv|0)>=8?2:((niv|0)>=4?1:0); }

function tirerParement(){
  const r=rnd();
  if(PAL_COUR>=2) return r<0.74?'taille':'briquete';
  if(PAL_COUR>=1) return r<0.42?'briquete':(r<0.72?'moellon':'taille');
  return r<0.52?'moellon':(r<0.88?'crepi':'briquete');
}
function tirerCouverture(){
  const r=rnd();
  if(PAL_COUR>=2) return r<0.66?'lauze':'tuile';
  if(PAL_COUR>=1) return r<0.70?'tuile':(r<0.88?'plate':'lauze');
  return r<0.56?'bardeau':(r<0.86?'plate':'tuile');
}
function sprite(w,h){
  MATCOUR=tirerCouverture();
  MURCOUR=tirerParement();
  const c=document.createElement('canvas');
  c.width=Math.max(1,w|0); c.height=Math.max(1,h|0);
  const x=c.getContext('2d');
  x.imageSmoothingEnabled=false;
  return {can:c,g:x,w:c.width,h:c.height,
    fenetres:[], lampes:[], drapeaux:[], fumees:[], linge:null, girouette:null,
    moulin:null, roue:null, brasier:null, chaudron:null, enseigne:null};
}
/* ------------------------------------------------------------------
   LA PARURE. Ce qu'un matériau ne dit pas : qu'on est fier de l'atelier.
   On la pose APRÈS le générateur, sur le sprite fini, en se servant des
   points d'accroche qu'il a laissés (faîte, porte, largeur).
   ------------------------------------------------------------------ */
function parer(sp,pal,type){
  if(!pal||!sp||!sp.g) return sp;
  const g=sp.g, w=sp.w, h=sp.h;
  const K=Math.max(1,Math.round(w/44));
  /* le faîte : la ligne du toit, repérée sur le sprite lui-même — c'est
     plus sûr que de la recalculer, chaque générateur ayant sa géométrie. */
  const faite=faiteDe(sp);

  /* --- palier 0 : on a bâti vite. La mousse s'installe, une planche a
         été reclouée de travers, le pied du mur boit l'eau. --- */
  if(pal===0){
    if(faite) for(let x=faite.x0;x<=faite.x1;x+=2){
      const y=faite.y[x-faite.x0];
      if(y<0||rnd()>0.30) continue;
      fr(g,x,y+1,1,1,'rgba(74,104,58,.42)');
      if(rnd()<0.4) fr(g,x+1,y+2,1,1,'rgba(62,88,48,.30)');
    }
    const socle=bordDuBas(sp);
    if(socle) for(let x=socle.x0;x<=socle.x1;x++){
      const y=socle.y[x-socle.x0];
      if(y<0||rnd()>0.5) continue;
      fr(g,x,y,1,1,'rgba(48,42,34,.30)');
    }
  }

  /* --- palier 1 : la lanterne et l'enseigne --- */
  if(pal>=1){
    const lx=Math.round(w*0.16), ly=Math.round(h*0.62);
    if(opaqueSous(sp,lx,ly)){
      fr(g,lx,ly-K*3,1,K*3,'#3b3f46');
      fr(g,lx-1,ly,3,Math.max(3,K*3),'#2b2f36');
      fr(g,lx,ly+1,1,Math.max(1,K*2),'#ffd88a');
      sp.lampes.push({x:lx,y:ly+1,c:'#ffcf7a',r:Math.max(9,K*10)});
    }
  }
  /* --- palier 2 : le soubassement de taille, l'oriflamme, le faîtage --- */
  if(pal>=2){
    /* LE SOUBASSEMENT. C'est le signe le plus lisible de tous : à partir
       d'ici, le bourg ne pose plus ses murs dans la terre — il les
       assied sur de la pierre appareillée. Trois assises suffisent à ce
       qu'on le voie de l'autre rive. */
    const socle=bordDuBas(sp);
    if(socle){
      const ep=Math.max(2,Math.round(h*0.055));
      const P=AMB.pierre||PAL.pierre;
      for(let x=socle.x0;x<=socle.x1;x++){
        const y=socle.y[x-socle.x0];
        if(y<0) continue;
        for(let k=0;k<ep;k++){
          const yy=y-k;
          if(yy<1) break;
          const bande=(k===ep-1);
          const joint=((x+((k*3)|0))%7===0);
          fr(g,x,yy,1,1, bande?clair(P[0],.20):(joint?ombre(P[2],.18):P[1]));
        }
        if(y-ep>=0) fr(g,x,y-ep,1,1,ombre(P[3],.12));
      }
    }
    if(faite){
      /* liseré de faîtage : deux pixels d'or sur toute la crête */
      for(let x=faite.x0;x<=faite.x1;x++){
        const y=faite.y[x-faite.x0];
        if(y<0) continue;
        fr(g,x,y,1,1,'#e6c069');
        if(x%3===0) fr(g,x,y-1,1,1,'#f4dfa4');
      }
      /* la hampe et l'oriflamme, au tiers du faîte */
      const hx=faite.x0+Math.round((faite.x1-faite.x0)*0.28);
      const hy=faite.y[hx-faite.x0];
      if(hy>=0&&hy>4){
        const ht=Math.max(6,K*7);
        fr(g,hx,hy-ht,1,ht,'#6b5a3c');
        const bl=AMB.blason||'#8c3b34';
        const lw=Math.max(4,K*5), lh=Math.max(3,K*4);
        fr(g,hx+1,hy-ht+1,lw,lh,bl);
        fr(g,hx+1,hy-ht+1,lw,1,clair(bl,.28));
        fr(g,hx+1,hy-ht+lh,lw,1,ombre(bl,.3));
        fr(g,hx+lw,hy-ht+2,1,Math.max(1,lh-2),ombre(bl,.45));
        sp.drapeaux.push({x:hx+1,y:hy-ht+1,w:lw,h:lh,col:bl});
      }
    }
  }
  return sp;
}
/* La crête du toit : pour chaque colonne, le premier pixel opaque. On
   ne garde que la portion haute — le reste, ce sont les murs. */
function faiteDe(sp){
  let im;
  try{ im=sp.g.getImageData(0,0,sp.w,sp.h); }catch(e){ return null; }
  const d=im.data, haut=new Int16Array(sp.w);
  let min=1e9;
  for(let x=0;x<sp.w;x++){
    haut[x]=-1;
    for(let y=0;y<sp.h;y++){
      if(d[(y*sp.w+x)*4+3]>140){ haut[x]=y; if(y<min) min=y; break; }
    }
  }
  if(min>=1e9) return null;
  const seuil=min+Math.max(2,Math.round(sp.h*0.10));
  let x0=-1,x1=-1;
  for(let x=0;x<sp.w;x++){ if(haut[x]>=0&&haut[x]<=seuil){ if(x0<0)x0=x; x1=x; } }
  if(x0<0||x1-x0<3) return null;
  const y=[]; for(let x=x0;x<=x1;x++) y.push(haut[x]<=seuil?haut[x]:-1);
  return {x0,x1,y};
}
/* Le pied du bâtiment : pour chaque colonne, le DERNIER pixel opaque. On
   ne garde que la portion basse — c'est là que s'assied le soubassement. */
function bordDuBas(sp){
  let im;
  try{ im=sp.g.getImageData(0,0,sp.w,sp.h); }catch(e){ return null; }
  const d=im.data, bas=new Int16Array(sp.w);
  let max=-1;
  for(let x=0;x<sp.w;x++){
    bas[x]=-1;
    for(let y=sp.h-1;y>=0;y--){
      if(d[(y*sp.w+x)*4+3]>150){ bas[x]=y; if(y>max) max=y; break; }
    }
  }
  if(max<0) return null;
  const seuil=max-Math.max(2,Math.round(sp.h*0.09));
  let x0=-1,x1=-1;
  for(let x=0;x<sp.w;x++){ if(bas[x]>=seuil){ if(x0<0)x0=x; x1=x; } }
  if(x0<0||x1-x0<3) return null;
  const y=[]; for(let x=x0;x<=x1;x++) y.push(bas[x]>=seuil?bas[x]:-1);
  return {x0,x1,y};
}
function opaqueSous(sp,x,y){
  if(x<1||x>=sp.w-1||y<1||y>=sp.h-1) return false;
  try{
    const d=sp.g.getImageData(x,y,1,3).data;
    return d[3]>140||d[7]>140||d[11]>140;
  }catch(e){ return false; }
}

/* -- deux canvas de brouillon réutilisés : les passes de relief travaillent
      par masques décalés, il ne faut surtout pas allouer à chaque sprite -- */
const _SCR=[null,null,null];
function scratch(i,w,h){
  let s=_SCR[i];
  if(!s){ const can=document.createElement('canvas');
    can.width=Math.max(8,w); can.height=Math.max(8,h);
    s=_SCR[i]={can,g:can.getContext('2d')};
  } else if(s.can.width<w || s.can.height<h){
    s.can.width=Math.max(w,s.can.width); s.can.height=Math.max(h,s.can.height);
  }
  s.g.imageSmoothingEnabled=false;
  s.g.globalCompositeOperation='source-over'; s.g.globalAlpha=1;
  s.g.clearRect(0,0,s.can.width,s.can.height);
  return s;
}

/* voile atmosphérique : plus la rangée est loin, plus elle se noie */
const VOILE=[0.29,0.16,0.055,0.0];
/* ------------------------------------------------------------------
   FINITION D'UN SPRITE — appelée en dernier par tous les générateurs.
   C'est ici que le volume apparaît : sans elle chaque édifice reste
   une mosaïque plate de textures. Trois passes, aucune lecture de
   pixels (donc aucun aller-retour GPU), tout en composition canvas :
     · ombre portée interne — le masque du sprite décalé en bas à droite
       assombrit ce qu'il recouvre : avant-toits, cheminées, encorbelle-
       ments projettent enfin une ombre sur ce qu'ils surplombent ;
     · lumière du ciel — les arêtes que la copie décalée vers le bas ne
       recouvre PAS sont les faces exposées : on les éclaircit ;
     · occlusion au sol — la base d'un volume ne reçoit rien.
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   GAUCHISSEMENT — le remède à la « droiture ».
   Tout ce qui était généré ici l'était à l'équerre : poteaux d'aplomb,
   faîtages au cordeau, alignements parfaits. Or une maison de six siècles
   n'a plus un angle droit : le pan de bois a vrillé, la panne faîtière a
   fléchi en son milieu, le mur gouttereau s'est dévers� vers la rue.
   On applique donc à CHAQUE sprite fini deux déformations séparables,
   avant les passes de relief pour que l'ombre suive la nouvelle forme :
     · fléchissement — chaque colonne descend selon une arche (le milieu
       s'affaisse, les rives restent posées au sol) ;
     · dévers — chaque ligne glisse selon une puissance de la hauteur : nul
       au pied, maximal au faîte. Le bâtiment penche sans décoller.
   Les ancres animées (fumées, lanternes, fenêtres, roues) subissent la
   même transformation, sinon la fumée sortirait à côté de la cheminée.
   ------------------------------------------------------------------ */
function gauchir(sp){
  const w=sp.w, h=sp.h;
  if(sp.droit || w<12 || h<16) return;
  const amp = sp.gauche!=null ? sp.gauche : 1;
  const lean = (rnd()*2-1)*Math.min(5.0, h*0.062) * amp;
  const sag  = rnd()*Math.min(2.6, w*0.045) * amp;
  const vr   = R(0.55,0.95);                       // où se creuse la flèche
  const DY = x=>Math.round(sag*Math.sin(Math.PI*Math.pow(clamp(x,0,w)/w,vr)));
  const DX = y=>Math.round(lean*Math.pow(1-clamp(y,0,h)/h,1.65));
  if(!lean && !sag) return;

  let s0=scratch(0,w,h); s0.g.drawImage(sp.can,0,0);
  sp.g.clearRect(0,0,w,h);
  for(let x=0;x<w;x++){ const d=DY(x); if(d||true) sp.g.drawImage(s0.can,x,0,1,h,x,d,1,h); }

  s0=scratch(0,w,h); s0.g.drawImage(sp.can,0,0);
  sp.g.clearRect(0,0,w,h);
  for(let y=0;y<h;y++){ const d=DX(y); sp.g.drawImage(s0.can,0,y,w,1,d,y,w,1); }

  const mv=o=>{
    if(!o) return;
    if(Array.isArray(o)){
      if(typeof o[0]==='number'&&typeof o[1]==='number'){ o[1]+=DY(o[0]); o[0]+=DX(o[1]); }
      else o.forEach(mv);
      return;
    }
    if(typeof o==='object'&&typeof o.x==='number'&&typeof o.y==='number'){ o.y+=DY(o.x); o.x+=DX(o.y); }
  };
  ['fenetres','lampes','drapeaux','fumees','linge'].forEach(k=>mv(sp[k]));
  ['moulin','roue','brasier','chaudron','enseigne','balancier','cloche','girouette'].forEach(k=>mv(sp[k]));
}

function brume(sp,row){
  const c=sp.g, w=sp.w, h=sp.h;
  if(w<3||h<3) return;
  gauchir(sp);

  // 1. ombre portée interne (soleil conventionnel en haut à gauche)
  const m=scratch(0,w,h);
  m.g.drawImage(sp.can,2,3);
  m.g.globalCompositeOperation='source-in';
  m.g.fillStyle='#0a1020'; m.g.fillRect(0,0,w,h);
  c.globalCompositeOperation='source-atop';
  c.globalAlpha=0.15; c.drawImage(m.can,0,0,w,h,0,0,w,h);

  // 2. lumière du ciel sur les arêtes hautes et le flanc gauche
  const t=scratch(1,w,h);
  t.g.drawImage(sp.can,0,0);
  t.g.globalCompositeOperation='destination-out';
  t.g.drawImage(sp.can,-1,2);
  t.g.globalCompositeOperation='source-in';
  t.g.fillStyle='#fff2d6'; t.g.fillRect(0,0,w,h);
  c.globalAlpha=0.26; c.drawImage(t.can,0,0,w,h,0,0,w,h);

  /* 2 bis. Contour sombre sur les arêtes basses et le flanc droit. C'est le
     détourage qui fait tenir une forme en pixel art : sans lui les toits
     se dissolvent dans le ciel et deux murs voisins n'ont plus de bord.
     Même astuce de masque, décalage inverse. */
  const u=scratch(1,w,h);
  u.g.drawImage(sp.can,0,0);
  u.g.globalCompositeOperation='destination-out';
  u.g.drawImage(sp.can,-1,-1);
  u.g.globalCompositeOperation='source-in';
  u.g.fillStyle='#0d1220'; u.g.fillRect(0,0,w,h);
  c.globalAlpha=0.24; c.drawImage(u.can,0,0,w,h,0,0,w,h);

  // 3. occlusion ambiante à la base
  const ao=Math.max(2,Math.min(9,Math.round(h*0.10)));
  for(let j=0;j<ao;j++){
    c.globalAlpha=0.19*(1-j/ao);
    c.fillStyle='#0b1018'; c.fillRect(0,h-1-j,w,1);
  }
  c.globalAlpha=1;

  // 4. voile atmosphérique de la rangée
  const a=VOILE[row]||0;
  if(a>0){ c.fillStyle='rgba(152,180,206,'+a+')'; c.fillRect(0,0,w,h); }
  c.globalCompositeOperation='source-over';
}

/* ==================================================================
   2. PALETTES
   ================================================================== */
const PAL = {
  ciel:['#2c5b9c','#3a6cad','#4a7fbb','#5d93c9','#77a8d4','#93bede','#b2d2e8','#d2e4ee','#e9edE4'],
  cielNuit:['#0b1024','#101733','#161f42','#1d2851','#243060','#2b3a6e','#33447c','#3e5090','#4a5ca0'],
  /* Montagnes. Une chaîne = quatre teintes seulement :
     [versant au soleil, versant à l'ombre, arête vive, creux].
     Le contraste entre les deux versants s'ouvre à mesure qu'on
     s'approche — c'est la perspective aérienne qui écrase les
     lointains, pas le dessin. */
  montA:['#c5d0e3','#b1bed7','#d9e1ef','#a2b1cd'],   // chaîne lointaine
  montB:['#a3b2ce','#8595b6','#c0cbe0','#7484a6'],   // chaîne médiane
  montC:['#7f93b7','#5e7197','#9aabc8','#4f6081'],   // avant-chaîne
  montD:['#5b6f95','#405278','#74879f','#334466'],   // contreforts
  neige:'#eef2fa', neigeO:'#c6d3e8', neigeB:'#ffffff',
  collines:['#5f7a5c','#4f6a4e','#405843'],
  herbe:[['#6f9053','#5e7e46','#4e6b3a'],
         ['#789959','#66884d','#557540'],
         ['#80a15f','#6e9052','#5c7c44'],
         ['#87a866','#759757','#638248']],
  terre:['#8b6f4a','#75593a','#5d4630','#443322'],
  eau:['#457697','#3a6383','#2f516d','#233d55'],
  /* pierre froide (châteaux, socles) */
  pierre:['#9aa2ad','#7e8691','#646b76','#474d57'],
  /* pierre chaude (murs de bourg) */
  pierreC:['#b6a992','#9a8d78','#7c7161','#5a5245'],
  bois:['#5c4128','#472f1d','#6d4e32','#31210f'],
  platre:['#e9dec4','#ded0af','#d6c7a8','#cbba97','#e4d9be','#d0c3a4','#e2d2b0','#c9b894'],
  volets:['#8a4c39','#4a5c46','#3f4d63','#6b4b57','#7d6a3c','#5e3f52'],
  brique:[['#96604a','#734437'],['#8a5744','#684030'],['#a06a4e','#7b4a38']],
  toits:{
    tuileR:['#c4633f','#a84f30','#8a3e26','#642a19'],
    tuileB:['#a86042','#8a4930','#6d3922','#4e2717'],
    ardoise:['#63718a','#4e5d74','#3d495c','#2c3442'],
    vert:['#617557','#4d6246','#3c4e38','#2c3b2a'],
    ocre:['#b57a41','#96612f','#774b22','#563518']
  },
  chaume:['#dcbc6d','#c4a254','#a68841','#7f662d','#5f4c21'],
  feuillage:[['#4f7a3e','#3f6633','#5f8f4b','#2f4f27'],
             ['#578344','#456d38','#68974f','#33562b'],
             ['#4a7040','#3a5c34','#5a8b4c','#2b4526'],
             ['#6b8a3c','#57742f','#7fa04b','#3f5722']],
  conifere:[['#2f5236','#26452c','#3b6242','#1c3323'],
            ['#33583a','#294b30','#417046','#1f3826'],
            ['#2b4a34','#223d2a','#376040','#182d1f']],
  automne:[['#c98a34','#a96f24','#e0a94a','#7d4f18'],
           ['#c2632f','#a04d22','#dd8a44','#77361a'],
           ['#b8983a','#96792a','#d6b74e','#6d5518']],
  ecorce:[['#503a26','#3d2b1b','#63492f'],
          ['#4a4038','#332c26','#5f5348'],
          ['#8a7a60','#5c4c38','#c2b49a']],
  tournesol:['#f2c530','#d9a91d','#b88a14','#4c3a12'],
  blason:['#8c3b34','#3f5c8c','#5d7a3a','#8a6a2a','#6b3a6b','#a8452f','#2f6b6b','#7a2f4a']
};
let AMB = {};                         // ambiance choisie par cité

/* ==================================================================
   3. TEXTURES : pierre, colombage, tuiles, chaume, bois
   ================================================================== */

/* Appareil de pierre irrégulier, avec chaînage d'angle. Les grosses pierres
   de taille aux arêtes ne sont pas un ornement : elles donnent au mur son
   épaisseur et arrêtent l'œil là où la façade s'arrête. */
/* ------------------------------------------------------------------
   MAÇONNERIE. Le mur était couvert d'un semis de petites pierres au pas de
   trois, tirées au sort une par une : à distance ce n'est pas de l'appareil,
   c'est du BRUIT. Or l'œil ne compte pas les pierres d'un mur, il en repère
   quelques-unes — les grosses, celles des angles, celles qui bordent une
   baie — et complète tout seul le reste.
   On inverse donc la méthode. Le fond n'est plus un damier mais un champ
   nuancé par un bruit basse fréquence : c'est du mortier, et il occupe la
   majorité de la surface. Par-dessus, on ne pose qu'un TIERS environ de
   pierres, mais GRANDES et échelonnées avec l'échelle du dessin, chacune
   avec son lit éclairé et son ombre en pied. Enfin on les concentre là où
   elles ont une raison d'être : chaînes d'angle, assise de soubassement,
   cordon d'arase. Résultat : moins de pixels, un mur plus lisible.
   ------------------------------------------------------------------ */
function mur(c,X,Y,Wd,Ht,p,pas,fin){
  fin=fin||MURCOUR;
  const K=Math.max(1,ECHM);
  const bh=Math.max(3,Math.round(3.4*K));            // hauteur d'assise
  const bw=Math.max(5,Math.round(7.5*K));            // longueur moyenne de pierre
  const q =Math.max(3,Math.round(4.5*K));            // largeur des chaînes d'angle

  /* --- fond de mortier, nuancé large --- */
  for(let j=0;j<Ht;j++){
    const t=j/Math.max(1,Ht-1);
    fr(c,X,Y+j,Wd,1, mix(clair(p[1],.07),ombre(p[1],.10),Math.pow(t,0.8)));
  }
  if(NTILE) for(let j=0;j<Ht;j+=2) for(let i=0;i<Wd;i+=2){
    const n=NT2((X+i)*0.55,(Y+j)*0.55);
    if(n<0.30) fr(c,X+i,Y+j,2,2,ombre(p[1],.10));
    else if(n>0.76) fr(c,X+i,Y+j,2,2,clair(p[1],.07));
  }

  /* --- les pierres qu'on montre : grandes, et un tiers seulement --- */
  const dedans=X+q, jusque=X+Wd-q;
  for(let j=0,r=0;j<Ht;j+=bh,r++){
    const hj=Math.min(bh,Ht-j)-1;
    if(hj<2) break;
    let x=dedans-((r%2)?Math.round(bw*0.45):0);
    while(x<jusque){
      const lw=Math.max(3,bw+RI(-Math.round(bw*0.28),Math.round(bw*0.28)));
      const x1=Math.max(dedans,x), x2=Math.min(jusque,x+lw);
      x+=lw+Math.max(1,Math.round(K));
      if(x2-x1<3) continue;
      if(!chance(.34)) continue;                     // l'immense majorité reste en fond
      const ton=rnd();
      const col= ton<0.34?p[0] : (ton<0.72?p[1] : p[2]);
      fr(c,x1,Y+j,x2-x1,hj,col);
      fr(c,x1,Y+j,x2-x1,1,clair(col,.16));           // lit éclairé
      fr(c,x1,Y+j+hj-1,x2-x1,1,ombre(col,.22));      // ombre en pied
      fr(c,x1,Y+j,1,hj,clair(col,.10));
      fr(c,x2-1,Y+j,1,hj,ombre(col,.16));
      if(chance(.22)) fr(c,x1+RI(1,Math.max(1,x2-x1-2)),Y+j+RI(1,Math.max(1,hj-2)),
                         RI(1,2),1,ombre(col,.26));  // épaufrure
    }
  }

  /* --- assises réglées : soubassement et cordon d'arase --- */
  if(Ht>=bh*3){
    const ys=Y+Ht-bh;
    for(let x=X;x<X+Wd;x+=bw+2){
      const lw=Math.min(bw+1,X+Wd-x);
      fr(c,x,ys,lw,bh-1,p[2]);
      fr(c,x,ys,lw,1,clair(p[0],.14));
      fr(c,x+lw-1,ys,1,bh-1,ombre(p[3],.20));
    }
    fr(c,X,ys-1,Wd,1,ombre(p[3],.24));
  }

  /* --- chaînes d'angle : c'est là que les grosses pierres ont un rôle --- */
  if(Wd>=q*3) for(let j=0,k=0;j<Ht;j+=bh*2,k++){
    const hq=Math.min(bh*2-1,Ht-j);
    if(hq<2) break;
    const w1=k%2?q:Math.max(2,q-Math.round(K*1.5));
    fr(c,X,Y+j,w1,hq,clair(p[0],.06));
    fr(c,X,Y+j,w1,1,clair(p[0],.22));
    fr(c,X,Y+j,1,hq,clair(p[0],.26));
    fr(c,X,Y+j+hq-1,w1,1,ombre(p[3],.22));
    fr(c,X+Wd-w1,Y+j,w1,hq,p[2]);
    fr(c,X+Wd-w1,Y+j,w1,1,clair(p[2],.14));
    fr(c,X+Wd-1,Y+j,1,hq,p[3]);
    fr(c,X+Wd-w1,Y+j+hq-1,w1,1,ombre(p[3],.24));
  }

  /* --- finition posée PAR-DESSUS l'appareil : c'est elle qu'on voit --- */
  if(Wd>=8&&Ht>=6){
    if(fin==='taille'){
      const gh=Math.max(4,Math.round(5.5*K)), gw=Math.max(7,Math.round(11*K));
      for(let j=0;j<Ht;j+=gh){
        const hj=Math.min(gh,Ht-j), dec=((j/gh)|0)%2?Math.round(gw/2):0;
        for(let i=-dec;i<Wd;i+=gw){
          const x0=Math.max(X,X+i), w2=Math.min(gw,Wd-Math.max(0,i));
          if(w2<3) continue;
          fr(c,x0,Y+j,w2,hj, chance(.5)?p[1]:mix(p[1],p[0],.32));
          fr(c,x0,Y+j,w2,1,clair(p[0],.15));             // lit supérieur
          fr(c,x0,Y+j+hj-1,w2,1,ombre(p[3],.14));        // joint creux
          fr(c,x0,Y+j,1,hj,mix(p[2],p[3],.35));          // joint vertical
          if(chance(.22)) fr(c,x0+RI(2,Math.max(2,w2-3)),Y+j+RI(1,Math.max(1,hj-2)),
                             RI(1,3),1,ombre(p[2],.16));
        }
      }
    } else if(fin==='crepi'){
      const enduit=pick(['#d8cdb4','#cfc3a6','#e0d6bd','#c6b99c','#d2c7ae']);
      const eo=ombre(enduit,.16), ec2=clair(enduit,.16);
      for(let j=0;j<Ht;j++){
        for(let i=0;i<Wd;i++){
          const bx=i/Wd, by=j/Ht;
          let usure = Math.pow(by,2.2)*0.55 + Math.pow(Math.abs(bx-0.5)*2,3.0)*0.35;
          if(NTILE) usure += (NT2(X+i,Y+j)-0.5)*0.85;
          if(usure>0.42) continue;
          let col=enduit;
          const n2=NTILE?NT2(X+i+53,Y+j+17):0.5;
          if(n2<0.30) col=eo; else if(n2>0.78) col=ec2;
          fr(c,X+i,Y+j,1,1,col);
        }
      }
      for(let k=0,n=Math.max(1,(Wd/12)|0);k<n;k++){
        const ex=X+RI(1,Wd-2), ey=Y+RI(2,Math.max(3,Ht-2));
        fr(c,ex,ey,1,1,ombre(enduit,.34)); fr(c,ex+1,ey+1,1,1,ombre(enduit,.34));
      }
      if(Ht>=12){
        fr(c,X,Y+Ht-Math.max(2,(Ht*0.14)|0),Wd,1,ombre(enduit,.28));
        fr(c,X,Y+Ht-Math.max(2,(Ht*0.14)|0)+1,Wd,1,'rgba(12,16,24,.18)');
      }
    } else if(fin==='briquete'){
      const br=pick(PAL.brique);
      const rh=Math.max(3,Math.round(3.2*K)), rw=Math.max(5,Math.round(7*K));
      for(let j=0;j<Ht;j+=rh){
        const dec=((j/rh)|0)%2?Math.round(rw/2):0;
        for(let i=q-dec;i<Wd-q;i+=rw){
          const x0=X+i, w2=Math.min(rw,Wd-q-i)-1;
          if(w2<2) continue;
          fr(c,x0,Y+j,w2,rh-1, chance(.5)?br[0]:mix(br[0],br[1],.45));
          fr(c,x0,Y+j,w2,1, clair(br[0],.12));
          fr(c,x0,Y+j+rh-2,w2,1, ombre(br[1],.18));
          if(chance(.14)) fr(c,x0+RI(1,Math.max(1,w2-1)),Y+j+1,1,1,ombre(br[1],.26));
        }
      }
    }
  }

  /* --- le mur vieillit : coulures, mousse, une fissure --- */
  if(Wd>=12&&Ht>=9){
    const moss=mix(p[2],'#4e6b3a',0.55);
    for(let k=0,kk=Math.max(1,(Wd/22)|0);k<kk;k++){
      const sx=X+RI(2,Wd-3), ln=RI(3,Math.max(4,(Ht*0.45)|0));
      for(let j=1;j<ln;j++) if(chance(.7)) fr(c,sx,Y+j,1,1,ombre(p[3],.14));
    }
    for(let i=1;i<Wd-1;i+=RI(3,9)) if(chance(.45)) fr(c,X+i,Y+Ht-RI(1,3),RI(1,2),1,moss);
    if(chance(.3)){
      let fx=X+RI(3,Wd-4), fy=Y+RI(2,Math.max(3,Ht-4));
      for(let j=0;j<RI(4,Math.max(5,(Ht*0.4)|0));j++){
        fr(c,fx,fy+j,1,1,ombre(p[3],.22));
        if(chance(.4)) fx+=RI(-1,1);
        if(fx<X+1||fx>X+Wd-2) break;
      }
    }
  }
  fr(c,X,Y,1,Ht,clair(p[0],.18)); fr(c,X+Wd-1,Y,1,Ht,p[3]);
  fr(c,X,Y,Wd,1,clair(p[0],.14));
  fr(c,X,Y+Ht-1,Wd,1,p[3]);
}
/* moellons grossiers pour les soubassements */
function socle(c,X,Y,Wd,Ht,p){
  const K=Math.max(1,ECHM);
  const bh=Math.max(3,Math.round(4*K)), bw=Math.max(5,Math.round(8*K));
  fr(c,X,Y,Wd,Ht,p[2]);
  for(let j=0;j<Ht;j+=bh){
    const hj=Math.min(bh,Ht-j)-1; if(hj<2) break;
    for(let i=((j/bh)|0)%2?Math.round(bw*0.4):0;i<Wd;i+=bw+2){
      const w=Math.min(bw+RI(-2,2),Wd-i); if(w<3)continue;
      if(!chance(.55)) continue;
      const col=chance(.45)?p[1]:p[3];
      fr(c,X+i,Y+j,w,hj,col);
      fr(c,X+i,Y+j,w,1,clair(col,.16));
      fr(c,X+i,Y+j+hj-1,w,1,ombre(col,.20));
    }
  }
  for(let i=0;i<Wd;i+=RI(2,5)) if(chance(.6)) fr(c,X+i,Y+Ht-RI(1,2),1,1,mix(p[2],'#4e6b3a',0.5));
  fr(c,X,Y,Wd,1,p[0]);
}

/* pans de bois — le motif signature de l'architecture médiévale */
function colombage(c,X,Y,Wd,Ht,platre,bois,style){
  fr(c,X,Y,Wd,Ht,platre);
  fr(c,X+Wd-2,Y,2,Ht,ombre(platre,.13));         // ombre à droite
  fr(c,X,Y,2,Ht,clair(platre,.10));
  const B=bois[1], B2=bois[0], BH=bois[2];
  fr(c,X,Y,Wd,2,B);  fr(c,X,Y+Ht-2,Wd,2,B);      // sablières haute et basse
  fr(c,X,Y+1,Wd,1,BH);
  fr(c,X,Y,2,Ht,B);  fr(c,X+Wd-2,Y,2,Ht,B);      // poteaux corniers
  fr(c,X+1,Y,1,Ht,BH);
  const n=Math.max(1,Math.round(Wd/9));
  const pas=(Wd-2)/n;
  for(let k=1;k<n;k++){                          // poteaux intermédiaires
    const x=Math.round(X+1+k*pas);
    fr(c,x,Y+2,2,Ht-4,B); fr(c,x,Y+2,1,Ht-4,BH);
  }
  for(let k=0;k<n;k++){                          // remplissage décoratif
    const x0=Math.round(X+2+k*pas), x1=Math.round(X+1+(k+1)*pas);
    const w=x1-x0, y0=Y+2, y1=Y+Ht-3;
    if(w<4)continue;
    /* les écharpes à un pixel crénelaient : chaque trait reçoit son double
       décalé d'un pixel — le bois prend deux pixels d'épaisseur et l'escalier
       disparaît, sans rien changer au dessin. */
    const T2=(a,b2,d,e)=>{ trait(c,a,b2,d,e,B2,1); trait(c,a,b2+1,d,e+1,ombre(B2,.22),1); };
    if(style==='croix'){
      T2(x0,y0,x1-1,y1); T2(x1-1,y0,x0,y1);
    } else if(style==='chevron'){
      const my=(y0+y1)>>1;
      T2(x0,my,x0+(w>>1),y0); T2(x0+(w>>1),y0,x1-1,my);
      T2(x0,y1,x0+(w>>1),my); T2(x0+(w>>1),my,x1-1,y1);
    } else if(style==='arc'){
      trait(c,x0,y0+((y1-y0)>>1),x0+(w>>1),y0,B2,1);
      trait(c,x0+(w>>1),y0,x1-1,y0+((y1-y0)>>1),B2,1);
      fr(c,x0+(w>>1),y0,1,y1-y0,B2);
    } else if(style==='losange'){
      const my=(y0+y1)>>1, mx=x0+(w>>1);
      T2(mx,y0,x1-1,my); T2(x1-1,my,mx,y1);
      T2(mx,y1,x0,my);   T2(x0,my,mx,y0);
    } else {                                      // 'droit' : simple traverse
      fr(c,x0,(y0+y1)>>1,w,1,B2);
    }
  }
}

/* Une rangée de tuiles. La lumière vient de la gauche : la moitié gauche
   du pan reçoit une teinte plus chaude, la droite reste dans l'ombre —
   sans ce dégradé le toit reste une nappe plate quel que soit le détail
   des écailles. */
/* ------------------------------------------------------------------
   MATIÈRES DE COUVERTURE. Toutes les toitures du bourg étaient faites de
   la même écaille au pas de quatre : d'où l'impression, malgré la variété
   des couleurs, d'un seul matériau repeint. On en distingue maintenant
   cinq, qui ne se distinguent pas par la teinte mais par la GÉOMÉTRIE de
   la pose — c'est elle que l'œil lit à distance :
     tuile      écaille arrondie, pas 4, recouvrement d'un tiers
     plate      petite tuile plate, pas 3, joints croisés serrés
     bardeau    bardeau de bois, pas 6, bord inférieur en biseau
     lauze      dalle de schiste, pas irrégulier de 5 à 9, arêtes vives
     chaume     traité à part, en paquets liés
   ------------------------------------------------------------------ */
/* ------------------------------------------------------------------
   COUVERTURES, même règle que la maçonnerie et les cheminées : chaque
   TUILE reçoit sa cuisson (le bruit décide), le joint entre deux tuiles
   n'apparaît que trois fois sur quatre, et le quinconce vient d'un
   décalage pseudo-aléatoire par rang — jamais d'une alternance stricte
   ligne paire / ligne impaire, qui fabriquait la grille. Une tuile sur
   quinze est un ÉVÉNEMENT : neuve et plus claire, brûlée, glissée d'un
   cran (on voit le lattis au-dessus d'elle), fendue, moussue, ou tout
   simplement absente pour le bardeau. C'est l'événement qui fait le toit.
   ------------------------------------------------------------------ */
function rangTuiles(c,x,y,w,t,ligne,mat){
  if(w<=0)return;
  const bruit=(a,b)=>NTILE?NT2(a*0.9+31.7,b*1.3):rnd();
  if(mat==='plate'){
    const dec=Math.round(bruit(ligne,7)*3);
    for(let i=-dec;i<w;){
      const tw=3+((bruit(x+i,ligne)>0.8)?1:0);
      const x1=Math.max(0,i), x2=Math.min(w,i+tw); i+=tw;
      if(x2<=x1) continue;
      const n=bruit(x+x1,ligne*3);
      let col = n<0.30?t[1] : (n>0.76?clair(t[0],.10):t[0]);
      const r=rnd();
      if(r<0.05) col=clair(t[0],.18);
      else if(r<0.08) col=ombre(t[1],.16);
      fr(c,x+x1,y,x2-x1,3,col);
      fr(c,x+x1,y,x2-x1,1,clair(col,.14));
      fr(c,x+x1,y+2,x2-x1,1,ombre(t[2],.10));
      if(chance(.75)) fr(c,x+x2-1,y,1,3,t[2]);
      if(chance(.05)) fr(c,x+RI(x1,Math.max(x1,x2-1)),y+2,1,1,'#5d7247');
    }
    return;
  }
  if(mat==='bardeau'){
    const bo=['#8a6a45','#6f5334','#a3835a','#4a3826'];
    const dec=Math.round(bruit(ligne,13)*6);
    for(let i=-dec;i<w;){
      const tw=5+Math.round(bruit(x+i,ligne+40)*3);
      const x1=Math.max(0,i), x2=Math.min(w,i+tw); i+=tw;
      if(x2<=x1) continue;
      if(rnd()<0.035){ fr(c,x+x1,y,x2-x1,3,'#241b12'); continue; }   // bardeau perdu : lattis
      const n=bruit(x+x1,ligne*2+9);
      const col = n<0.30?bo[1] : (n>0.74?bo[2]:bo[0]);
      fr(c,x+x1,y,x2-x1,3,col);
      fr(c,x+x1,y,x2-x1,1,clair(col,.14));
      fr(c,x+x1,y+2,x2-x1,1,ombre(col,.24));                          // biseau
      if(chance(.8)) fr(c,x+x2-1,y,1,3,bo[3]);
      if(chance(.20)) fr(c,x+RI(x1,Math.max(x1,x2-1)),y+1,1,RI(1,2),ombre(col,.30));
      if(chance(.06)) fr(c,x+RI(x1,Math.max(x1,x2-1)),y,RI(1,2),1,'#5d7247');
    }
    return;
  }
  if(mat==='lauze'){
    const la=['#8c9096','#767b82','#a2a7ad','#4e5359'];
    const dec=Math.round(bruit(ligne,23)*5);
    for(let i=-dec;i<w;){
      const tw=5+Math.round(bruit(x+i,ligne+80)*4);
      const x1=Math.max(0,i), x2=Math.min(w,i+tw); i+=tw;
      if(x2<=x1) continue;
      const n=bruit(x+x1,ligne*2+51);
      const col = n<0.28?la[1] : (n>0.72?la[2]:la[0]);
      fr(c,x+x1,y,x2-x1,3,col);
      fr(c,x+x1,y,x2-x1,1,clair(la[2],.12));
      fr(c,x+x1,y+2,x2-x1,1,la[3]);
      if(chance(.8)) fr(c,x+x2-1,y,1,3,la[3]);
      if(chance(.10)) fr(c,x+RI(x1,Math.max(x1,x2-1)),y+RI(0,2),RI(1,3),1,pick(['#5d7247','#6b7a4a','#7a8560']));
    }
    return;
  }
  // la tuile canal, écaille par défaut
  const dec=Math.round(bruit(ligne,3)*4);
  for(let i=-dec;i<w;){
    const tw=4+((bruit(x+i,ligne+17)>0.78)?1:0);
    const x1=Math.max(0,i), x2=Math.min(w,i+tw); i+=tw;
    if(x2<=x1) continue;
    const n=bruit(x+x1,ligne*3+5);
    let col = n<0.30?t[1] : (n>0.76?clair(t[0],.08):t[0]);
    const r=rnd();
    if(r<0.035) col=clair(t[0],.16);                       // tuile neuve
    else if(r<0.06) fr(c,x+x1,y-1,x2-x1,1,'#3a2c1e');      // glissée : lattis découvert
    fr(c,x+x1,y,x2-x1,3,col);
    fr(c,x+x1,y,x2-x1,1,clair(t[0],.18));
    fr(c,x+x1,y+2,x2-x1,1,ombre(t[2],.08));
    if(chance(.78)) fr(c,x+x2-1,y,1,2,t[2]);
    if(chance(.30)) fr(c,x+x1+1,y+1,1,1,clair(col,.14));
    if(chance(.05)) fr(c,x+RI(x1,Math.max(x1,x2-1)),y+1,1,1,'#5d7247');
    if(chance(.04)) fr(c,x+RI(x1,Math.max(x1,x2-1)),y,1,2,t[3]);
  }
}
/* joints d'emboîtement des faîtières : la crête aussi est faite de pièces */
function jointsCrete(c,x,y,w,col){
  for(let i=RI(2,4);i<w-1;i+=RI(3,5)) if(chance(.8)) fr(c,x+i,y,1,2,col);
}
/* toit à deux pans vu de face : triangle de tuiles */
/* ------------------------------------------------------------------
   PATINE DE COUVERTURE. Le fléchissement a réglé la ligne de faîte, mais
   les RIVES restaient tirées au cordeau et la surface uniforme. Or ce qui
   trahit une couverture ancienne, c'est le bord : tuiles ébréchées en
   quinconce, une ou deux qui ont glissé et pendent, un trou par où l'on
   voit le lattis, une plaque reposée avec des tuiles d'une autre cuisson,
   de la mousse dans les creux au nord et le long de l'égout. On travaille
   dans le brouillon transparent du fléchissement : on peut donc RETIRER
   de la matière, ce qui est la seule façon d'obtenir une silhouette
   réellement dentelée plutôt que soulignée.
   ------------------------------------------------------------------ */
function patineToit(c,Y,Ht,bord,t,mat,eave){
  const chaumeMode = mat==='chaume';
  const noir = chaumeMode?PAL.chaume[4]:t[3];
  const lattis = '#3a2c1e';
  const mousse = ['#5d7247','#4a6338','#6b8452'];

  /* 1. rives dentelées — on ronge, on ne souligne pas */
  const nib = chaumeMode?0.42:0.26;
  for(let j=1;j<Ht;j++){
    const [a,b]=bord(j); if(b-a<4) continue;
    if(chance(nib)) c.clearRect(a,Y+j,1,1);
    if(chance(nib)) c.clearRect(b-1,Y+j,1,1);
    if(chance(nib*0.45)) c.clearRect(a,Y+j,2,1);
    if(chance(0.10)) fr(c,a-1,Y+j,1,1,noir);      // tuile de rive qui déborde
    if(chance(0.10)) fr(c,b,Y+j,1,1,noir);
  }

  /* 2. égout irrégulier : quelques tuiles pendent, d'autres manquent */
  if(eave){
    const [a,b]=bord(Ht-1);
    for(let i=a-2;i<b+2;i++){
      if(chance(0.14)) fr(c,i,Y+Ht,1,RI(1,2),noir);
      else if(chance(0.07)) c.clearRect(i,Y+Ht-1,1,1);
    }
  }

  /* 3. un trou dans la couverture, et le lattis dessous */
  if(!chaumeMode && Ht>=12 && chance(.34)){
    const j=RI(3,Ht-5), [a,b]=bord(j);
    if(b-a>10){
      const hx=RI(a+3,b-6), hw=RI(2,4), hh=RI(2,3);
      fr(c,hx,Y+j,hw,hh,lattis);
      for(let k=0;k<hw;k+=2) fr(c,hx+k,Y+j,1,hh,'#241b12');
      fr(c,hx-1,Y+j-1,hw+2,1,noir);
    }
  }

  /* 4. plaque de réfection : tuiles d'une autre cuisson */
  if(!chaumeMode && Ht>=10 && chance(.42)){
    const t2=pick([PAL.toits.tuileR,PAL.toits.tuileB,PAL.toits.ocre,PAL.toits.ardoise]);
    const j0=RI(1,Math.max(2,Ht-6)), jn=RI(3,6);
    const [aa,bb]=bord(j0);
    const px2=RI(aa+1,Math.max(aa+2,bb-8)), pw=RI(5,10);
    for(let j=j0;j<Math.min(Ht-1,j0+jn);j++){
      const [a,b]=bord(j);
      const x1=Math.max(a,px2), x2=Math.min(b,px2+pw);
      if(x2<=x1) continue;
      fr(c,x1,Y+j,x2-x1,1,(j%3)===2?t2[2]:((j%6)===0?t2[0]:t2[1]));
      if(j===j0) fr(c,x1,Y+j,x2-x1,1,clair(t2[0],.14));
    }
  }

  /* 5. mousse : dans les creux, jamais en bandeau */
  for(let k=0,n=Math.max(2,Math.round(Ht*0.5));k<n;k++){
    const j=RI(Math.max(1,Ht-Math.round(Ht*0.55)),Ht-1), [a,b]=bord(j);
    if(b-a<5) continue;
    const mx=RI(a+1,b-2), col=pick(mousse);
    fr(c,mx,Y+j,RI(1,3),1,col);
    if(chance(.5)) fr(c,mx+RI(-1,1),Y+j+1,RI(1,2),1,ombre(col,.20));
  }
  /* 6. deux ou trois tuiles descellées qui accrochent la lumière */
  if(!chaumeMode) for(let k=0,n=RI(1,3);k<n;k++){
    const j=RI(1,Ht-2), [a,b]=bord(j);
    if(b-a<6) continue;
    const mx=RI(a+2,b-3);
    fr(c,mx,Y+j,2,1,clair(t[0],.26));
    fr(c,mx,Y+j+1,2,1,t[3]);
  }
}

/* Une charpente ancienne FLÉCHIT : la panne faîtière ploie en son milieu,
   les chevrons suivent, la ligne d'égout ondule. On dessine donc le pan sur
   un brouillon, puis on le repose colonne par colonne avec un creux central
   et un léger bruit. Sans cela, un toit reste une nappe tirée au cordeau —
   c'est le principal responsable de l'aspect « bâtiment de bureaux ». */
function flechir(c,X,Y,Wd,Ht,fn,amp){
  amp=amp==null?1:amp;
  const pad=8, w2=Wd+pad*2, h2=Ht+pad+2;
  if(w2<6||h2<6){ fn(c,X,Y); return; }
  const sp=scratch(2,w2,h2);
  fn(sp.g,pad,0);
  const sag=(R(0.8,1.5)+Ht*0.055)*amp, ph=R(0,6.28), tilt=(rnd()*2-1)*Math.min(1.6,Wd*0.012)*amp;
  for(let i=0;i<w2;i++){
    const u=i/w2;
    const d=Math.round(sag*Math.sin(Math.PI*Math.pow(u,R(0.8,1.2)))
                      +Math.sin(i*0.11+ph)*0.55 + tilt*(u-0.5)*2);
    c.drawImage(sp.can,i,0,1,h2,X-pad+i,Y+d,1,h2);
  }
}
function toitPignon(c,X,Y,Wd,Ht,t,mat){ mat=mat||MATCOUR; flechir(c,X,Y,Wd,Ht,(g2,x2,y2)=>_toitPignon(g2,x2,y2,Wd,Ht,t,mat),0.30); }
function _toitPignon(c,X,Y,Wd,Ht,t,mat){
  const chaumeMode = mat==='chaume';
  for(let j=0;j<Ht;j+=chaumeMode?2:3){
    const p0=(j+1)/Ht, p1=Math.min(1,(j+(chaumeMode?2:3))/Ht);
    const w0=Math.max(2,Math.round(Wd*p0)), w1=Math.max(2,Math.round(Wd*p1));
    const wj=Math.max(w0,w1);
    const x0=X+((Wd-wj)>>1);
    if(chaumeMode){
      const k=(j/2)|0;
      fr(c,x0,Y+j,wj,2, k%2?PAL.chaume[1]:PAL.chaume[0]);
      fr(c,x0,Y+j+1,wj,1,PAL.chaume[2]);
      for(let i=(k%3);i<wj;i+=3) if(chance(.5)) fr(c,x0+i,Y+j,1,2,PAL.chaume[3]);
      fr(c,x0,Y+j,1,2,PAL.chaume[3]); fr(c,x0+wj-1,Y+j,1,2,PAL.chaume[3]);
    } else {
      rangTuiles(c,x0,Y+j,wj,t,(j/3)|0,mat);
      fr(c,x0,Y+j,1,3,t[3]); fr(c,x0+wj-1,Y+j,1,3,t[3]);
    }
  }
  // avant-toit débordant, corbeaux, faîtière et épis
  const eave = chaumeMode?3:2;
  fr(c,X-eave,Y+Ht-3,Wd+eave*2,3, chaumeMode?PAL.chaume[3]:t[3]);
  fr(c,X-eave,Y+Ht-3,Wd+eave*2,1, chaumeMode?PAL.chaume[2]:clair(t[2],.14));
  fr(c,X-eave,Y+Ht,Wd+eave*2,1,'rgba(12,16,24,.34)');            // ombre de l'avant-toit
  for(let i=2;i<Wd;i+=Math.max(5,Wd>>2)) fr(c,X+i,Y+Ht,2,2,ombre(t[3],.15));
  // faîtière : une tuile ronde par-dessus l'arête, et un épi au sommet
  const fw=Math.max(4,Math.round(Wd*0.16));
  fr(c,X+((Wd-fw)>>1),Y,fw,2, chaumeMode?PAL.chaume[2]:clair(t[0],.22));
  fr(c,X+((Wd-fw)>>1),Y+2,fw,1, chaumeMode?PAL.chaume[3]:t[2]);
  if(!chaumeMode&&Wd>=16){ fr(c,X+(Wd>>1),Y-3,1,3,'#8d9199'); fr(c,X+(Wd>>1)-1,Y-4,3,1,'#c9a24a'); }
  patineToit(c,Y,Ht,j=>{ const wj=Math.max(2,Math.round(Wd*(j+1)/Ht)); const a=X+((Wd-wj)>>1); return [a,a+wj]; },
             t,mat,true);
}
/* toit long-pan (trapèze) */
function toitTrapeze(c,X,Y,Wd,Ht,t,mat){ mat=mat||MATCOUR; flechir(c,X,Y,Wd,Ht,(g2,x2,y2)=>_toitTrapeze(g2,x2,y2,Wd,Ht,t,mat)); }
function _toitTrapeze(c,X,Y,Wd,Ht,t,mat){
  const chaumeMode = mat==='chaume';
  for(let j=0;j<Ht;j+=chaumeMode?2:3){
    const ins=Math.round((Ht-1-j)*(Wd*0.26/Ht));
    const x0=X+ins, wj=Wd-2*ins;
    if(chaumeMode){
      const k=(j/2)|0;
      fr(c,x0,Y+j,wj,2, k%2?PAL.chaume[1]:PAL.chaume[0]);
      fr(c,x0,Y+j+1,wj,1,PAL.chaume[2]);
      for(let i=(k%3);i<wj;i+=3) if(chance(.45)) fr(c,x0+i,Y+j,1,2,PAL.chaume[3]);
    } else rangTuiles(c,x0,Y+j,wj,t,(j/3)|0,mat);
  }
  fr(c,X-2,Y+Ht-3,Wd+4,3, chaumeMode?PAL.chaume[3]:t[3]);
  fr(c,X-2,Y+Ht-3,Wd+4,1, chaumeMode?PAL.chaume[2]:clair(t[2],.14));
  fr(c,X-2,Y+Ht,Wd+4,1,'rgba(12,16,24,.34)');
  for(let i=3;i<Wd;i+=Math.max(6,Wd>>2)) fr(c,X+i,Y+Ht,2,2,ombre(t[3],.15));
  const insT=Math.round((Ht-1)*(Wd*0.26/Ht)), fwT=Wd-2*insT+2;
  fr(c,X+insT-1,Y,fwT,2, chaumeMode?PAL.chaume[2]:clair(t[0],.20));   // faîtière au droit du faîte
  fr(c,X+insT-1,Y+2,fwT,1, chaumeMode?PAL.chaume[3]:t[2]);
  jointsCrete(c,X+insT-1,Y,fwT, chaumeMode?PAL.chaume[4]:ombre(t[2],.14));
  patineToit(c,Y,Ht,j=>{ const ins=Math.round((Ht-1-j)*(Wd*0.26/Ht)); return [X+ins,X+Wd-ins]; },
             t,mat,true);
}
/* ------------------------------------------------------------------
   FORMES DE COUVERTURE. Le bourg ne connaissait que deux profils : le
   triangle du pignon sur rue et le trapèze de la croupe. Or c'est la
   SILHOUETTE qui identifie un toit de loin, bien avant sa matière. On en
   ajoute trois, choisies parce qu'elles se lisent en élévation frontale :
     demi-croupe  le pignon dont on a coupé la pointe par un petit pan —
                  le profil normand, reconnaissable à sa crête courte ;
     mansart      deux pentes, un brisis presque vertical et un terrasson
                  plat, séparés par la ligne de bris moulurée, avec ses
                  lucarnes ;
     pavillon     quatre pans convergeant en pointe, arêtiers marqués,
                  les deux joues latérales dans l'ombre.
   Toutes réutilisent la même machinerie : rangs de couverture, patine,
   fléchissement de la charpente.
   ------------------------------------------------------------------ */
function _rang(c,x0,y,wj,t,ligne,mat){
  if(mat==='chaume'){
    /* du chaume brin à brin : chaque colonne tire son ton, les brins sombres
       tombent où le hasard les met, et un lien de paille clair ceinture un
       rang sur deux — le peigné régulier disparaît. */
    const P=PAL.chaume;
    for(let i=0;i<wj;i++){
      const n=NTILE?NT2((x0+i)*0.9+7.3,ligne*1.3):rnd();
      fr(c,x0+i,y,1,2, n<0.28?P[1] : (n>0.74?P[2]:P[0]));
    }
    for(let i=RI(0,2);i<wj;i+=RI(2,4)) if(chance(.4)) fr(c,x0+i,y+RI(0,1),1,1,P[3]);
    if(ligne%2===0&&wj>6&&chance(.6))
      fr(c,x0+RI(1,Math.max(1,wj-5)),y+1,RI(3,5),1,clair(P[2],.16));
  } else rangTuiles(c,x0,y,wj,t,ligne,mat);
}
function _egout(c,X,Y,Wd,Ht,t,chaumeMode){
  fr(c,X-2,Y+Ht-3,Wd+4,3, chaumeMode?PAL.chaume[3]:t[3]);
  fr(c,X-2,Y+Ht-3,Wd+4,1, chaumeMode?PAL.chaume[2]:clair(t[2],.14));
  fr(c,X-2,Y+Ht,Wd+4,1,'rgba(12,16,24,.34)');
  for(let i=3;i<Wd;i+=Math.max(6,Wd>>2)) fr(c,X+i,Y+Ht,2,2,ombre(t[3],.15));
}

function toitDemiCroupe(c,X,Y,Wd,Ht,t,mat){ mat=mat||MATCOUR;
  flechir(c,X,Y,Wd,Ht,(g2,x2,y2)=>_toitDemiCroupe(g2,x2,y2,Wd,Ht,t,mat),0.45); }
function _toitDemiCroupe(c,X,Y,Wd,Ht,t,mat){
  const ch=mat==='chaume', pas=ch?2:3;
  const clip=Math.max(2,Math.round(Ht*0.30));
  const wc=Math.max(4,Math.round(Wd*0.36));
  const bord=j=>{
    const wj = j<clip ? wc : Math.round(wc+(Wd-wc)*((j-clip)/Math.max(1,Ht-1-clip)));
    const a=X+((Wd-wj)>>1); return [a,a+wj];
  };
  for(let j=0;j<Ht;j+=pas){ const [a,b]=bord(j); _rang(c,a,Y+j,b-a,t,(j/pas)|0,mat); }
  // le petit pan de croupe est plus sombre : il ne regarde pas le soleil
  for(let j=0;j<clip;j++){ const [a,b]=bord(j);
    fr(c,a,Y+j,b-a,1,'rgba(18,22,30,.22)'); }
  // arêtiers : deux lignes claires qui descendent de la crête aux angles
  trait(c,X+((Wd-wc)>>1),Y+clip,X+2,Y+Ht-3,clair(t[0],.24),1);
  trait(c,X+((Wd+wc)>>1),Y+clip,X+Wd-2,Y+Ht-3,clair(t[0],.24),1);
  _egout(c,X,Y,Wd,Ht,t,ch);
  fr(c,X+((Wd-wc)>>1)-1,Y,wc+2,2, ch?PAL.chaume[2]:clair(t[0],.22));   // crête courte
  fr(c,X+((Wd-wc)>>1)-1,Y+2,wc+2,1, ch?PAL.chaume[3]:t[2]);
  jointsCrete(c,X+((Wd-wc)>>1)-1,Y,wc+2, ch?PAL.chaume[4]:ombre(t[2],.14));
  patineToit(c,Y,Ht,bord,t,mat,true);
}

function toitMansart(c,X,Y,Wd,Ht,t,mat){ mat=mat||MATCOUR;
  flechir(c,X,Y,Wd,Ht,(g2,x2,y2)=>_toitMansart(g2,x2,y2,Wd,Ht,t,mat),0.55); }
function _toitMansart(c,X,Y,Wd,Ht,t,mat){
  const ch=mat==='chaume', pas=ch?2:3;
  const bris=Math.max(3,Math.round(Ht*0.44));            // hauteur du terrasson
  const wB=Math.round(Wd*0.86);                          // largeur à la ligne de bris
  const bord=j=>{
    let wj;
    if(j<bris) wj=Math.round(Wd*0.24+(wB-Wd*0.24)*(j/Math.max(1,bris)));   // terrasson : pente douce
    else       wj=Math.round(wB+(Wd-wB)*((j-bris)/Math.max(1,Ht-1-bris))); // brisis : presque vertical
    const a=X+((Wd-wj)>>1); return [a,a+wj];
  };
  for(let j=0;j<Ht;j+=pas){ const [a,b]=bord(j); _rang(c,a,Y+j,b-a,t,(j/pas)|0,mat); }
  // le brisis est plus sombre et plus mat que le terrasson : il est vertical
  for(let j=bris;j<Ht;j++){ const [a,b]=bord(j); fr(c,a,Y+j,b-a,1,'rgba(20,24,32,.16)'); }
  // ligne de bris : corniche moulurée, c'est la signature du profil
  { const [a,b]=bord(bris);
    fr(c,a-2,Y+bris-1,b-a+4,2,ombre(t[3],.20));
    fr(c,a-2,Y+bris-1,b-a+4,1,clair(t[0],.26));
    fr(c,a-1,Y+bris+1,b-a+2,1,'rgba(12,16,24,.34)'); }
  // lucarnes dans le brisis
  { const nl=Math.max(1,Math.round(Wd/26));
    for(let k=0;k<nl;k++){
      const lw=Math.max(5,Math.round(Wd*0.13)), lh=Math.max(5,Math.round((Ht-bris)*0.62));
      const lx=Math.round(X+Wd*((k+0.5)/nl))-(lw>>1), ly=Y+bris+2;
      fr(c,lx-1,ly-1,lw+2,lh+2,ombre(t[3],.30));
      fr(c,lx,ly,lw,lh,'#3e3f47');
      fr(c,lx,ly,lw,1,'#5c5e68');
      fr(c,lx+1,ly+1,Math.max(1,lw-2),Math.max(1,lh-2),'#8fb0c4');
      for(let i=1;i<lw-1;i+=2) fr(c,lx+i,ly+1,1,lh-2,'#4a5560');
      fr(c,lx-2,ly-2,lw+4,2,t[2]); fr(c,lx-2,ly-2,lw+4,1,clair(t[0],.18));
    } }
  _egout(c,X,Y,Wd,Ht,t,ch);
  { const [a,b]=bord(0);
    fr(c,a-1,Y,b-a+2,2, ch?PAL.chaume[2]:clair(t[0],.22));
    fr(c,a-1,Y+2,b-a+2,1, ch?PAL.chaume[3]:t[2]);
    jointsCrete(c,a-1,Y,b-a+2, ch?PAL.chaume[4]:ombre(t[2],.14)); }
  patineToit(c,Y,Ht,bord,t,mat,true);
}

function toitPavillon(c,X,Y,Wd,Ht,t,mat){ mat=mat||MATCOUR;
  flechir(c,X,Y,Wd,Ht,(g2,x2,y2)=>_toitPavillon(g2,x2,y2,Wd,Ht,t,mat),0.28); }
function _toitPavillon(c,X,Y,Wd,Ht,t,mat){
  const ch=mat==='chaume', pas=ch?2:3;
  const bord=j=>{ const wj=Math.max(2,Math.round(Wd*(j+1)/Ht)); const a=X+((Wd-wj)>>1); return [a,a+wj]; };
  for(let j=0;j<Ht;j+=pas){ const [a,b]=bord(j); _rang(c,a,Y+j,b-a,t,(j/pas)|0,mat); }
  // joues latérales dans l'ombre, séparées du pan principal par les arêtiers
  for(let j=0;j<Ht;j++){
    const [a,b]=bord(j), wj=b-a, m=Math.round(wj*0.22);
    if(m<1) continue;
    fr(c,a,Y+j,m,1,'rgba(18,22,30,.24)');
    fr(c,b-m,Y+j,m,1,'rgba(18,22,30,.30)');
    fr(c,a+m,Y+j,1,1,clair(t[0],.20));
    fr(c,b-m-1,Y+j,1,1,clair(t[0],.14));
  }
  _egout(c,X,Y,Wd,Ht,t,ch);
  fr(c,X+((Wd-3)>>1),Y-1,3,3, ch?PAL.chaume[2]:clair(t[0],.28));    // poinçon
  fr(c,X+((Wd-1)>>1),Y-4,1,4,'#8d9199');
  patineToit(c,Y,Ht,bord,t,mat,true);
}

/* Choix de silhouette. Les poids ne sont pas égaux : la croupe et le pignon
   restent majoritaires, sinon un bourg ne ressemble plus à rien. */
function toitVarie(c,X,Y,Wd,Ht,t,mat){
  const r=rnd();
  if(r<0.30)      toitTrapeze(c,X,Y,Wd,Ht,t,mat);
  else if(r<0.50) toitPignon(c,X,Y,Wd,Ht,t,mat);
  else if(r<0.68) toitDemiCroupe(c,X,Y,Wd,Ht,t,mat);
  else if(r<0.82) toitMansart(c,X,Y,Wd,Ht,t,mat);
  else if(r<0.92) toitPavillon(c,X,Y,Wd,Ht,t,mat);
  else            toitAsym(c,X,Y,Wd,Ht,t,mat,chance(.5)?1:-1);
}

/* ------------------------------------------------------------------
   FÛT CYLINDRIQUE. Une tour ronde dessinée comme un rectangle reste un
   rectangle : ce qui dit le cylindre, c'est que la lumière tourne — bord
   éclairé étroit, large plage de demi-teinte, ombre qui s'épaissit vers la
   droite — et que les ASSISES SE COURBENT, leurs joints s'incurvant vers le
   bas aux extrémités parce qu'on voit le dessous des lits. Le talus du pied
   et le bourrelet qui le couronne achèvent de poser le volume.
   ------------------------------------------------------------------ */
function futRond(c,cxs,bas,haut,larg,p,pas,talus){
  pas=pas||3;
  const demi=larg>>1;
  const lum=i=>{                                  // i : -1 (gauche) .. +1 (droite)
    if(i<-0.72) return clair(p[0],.22);
    if(i<-0.30) return p[0];
    if(i< 0.28) return p[1];
    if(i< 0.66) return p[2];
    return p[3];
  };
  for(let j=0;j<haut;j++){
    const y=bas-j;
    let w2=larg;
    if(talus&&j<talus){ w2=Math.round(larg+ (larg*0.22)*(1-j/talus)); }
    const d2=w2>>1;
    for(let i=-d2;i<=d2;i++){
      const u=i/Math.max(1,d2);
      let col=lum(u);
      // joints d'assise : ils plongent aux bords, c'est la courbure du lit
      const creux=Math.round(Math.pow(Math.abs(u),1.8)*pas*0.9);
      if(((j+creux)%pas)===0) col=ombre(col,.22);
      if(NTILE&&NT2(cxs+i+j,j*2)<0.20) col=ombre(col,.12);
      else if(NTILE&&NT2(cxs+i+j+37,j*2)>0.84) col=clair(col,.08);
      fr(c,cxs+i,y,1,1,col);
    }
    fr(c,cxs-d2,y,1,1,clair(p[0],.30));            // arête éclairée
    fr(c,cxs+d2,y,1,1,ombre(p[3],.22));
  }
  if(talus){                                       // bourrelet au sommet du talus
    const wt=larg+2;
    fr(c,cxs-(wt>>1),bas-talus,wt,2,p[0]);
    fr(c,cxs-(wt>>1),bas-talus,wt,1,clair(p[0],.28));
    fr(c,cxs-(wt>>1),bas-talus+2,wt,1,'rgba(12,16,24,.34)');
  }
}
/* Archère en croix pattée : la fente verticale pour l'arc, la traverse pour
   l'arbalète, les oillets ronds aux extrémités qui empêchent la pierre de
   s'éclater. L'ébrasement clair autour dit l'épaisseur du mur. */
function archere(c,x,y,h,p,croix){
  fr(c,x-2,y-2,5,h+4,p[0]);
  fr(c,x-1,y-1,3,h+2,p[2]);
  fr(c,x,y,1,h,'#15120e');
  fr(c,x-1,y-1,1,1,clair(p[0],.20));
  if(croix&&h>=6){ const my=y+Math.round(h*0.34);
    fr(c,x-1,my,3,1,'#15120e'); fr(c,x-2,my,1,1,p[3]); fr(c,x+2,my,1,1,p[3]); }
  fr(c,x,y-1,1,1,'#15120e'); fr(c,x,y+h,1,1,'#15120e');
}
/* Mâchicoulis : la galerie en surplomb portée par des corbeaux, avec ses
   trous de jet entre eux. C'est la pièce qui fait qu'on lit « fortifié ». */
function machicoulis(c,X,Y,Wd,p,pasCorb){
  pasCorb=Math.max(3,pasCorb||4);
  for(let i=0;i<Wd;i+=pasCorb){                    // corbeaux à ressauts
    fr(c,X+i,Y+2,Math.max(2,pasCorb-1),3,p[1]);
    fr(c,X+i,Y+2,Math.max(2,pasCorb-1),1,clair(p[0],.18));
    fr(c,X+i+1,Y+4,Math.max(1,pasCorb-2),2,p[2]);
  }
  fr(c,X-1,Y,Wd+2,3,p[1]);
  fr(c,X-1,Y,Wd+2,1,clair(p[0],.24));
  fr(c,X-1,Y+3,Wd+2,1,'rgba(12,16,24,.40)');
  for(let i=Math.round(pasCorb*0.5);i<Wd;i+=pasCorb) fr(c,X+i,Y+3,Math.max(1,pasCorb-3),2,'#15120e');
}
/* toit en poivrière (tours) */
function poivriere(c,cx,Y,demi,Ht,t){
  for(let j=0;j<Ht;j+=2){
    const wj=Math.max(1,Math.round(2*demi*(j+2)/Ht));
    const x0=cx-(wj>>1);
    fr(c,x0,Y+j,wj,2, ((j/2)|0)%2?t[1]:t[0]);
    fr(c,x0,Y+j+1,wj,1,t[2]);
    for(let i=((j/2)|0)%2?1:0;i<wj;i+=3) fr(c,x0+i,Y+j,1,1,t[2]);
    fr(c,x0,Y+j,1,2,t[3]); fr(c,x0+wj-1,Y+j,1,2,t[3]);
  }
  fr(c,cx-demi-1,Y+Ht-2,2*demi+2,2,t[3]);
  fr(c,cx-demi-1,Y+Ht-2,2*demi+2,1,t[2]);
}
function creneaux(c,X,Y,Wd,p){
  fr(c,X,Y+4,Wd,2,p[2]);
  for(let i=0;i<Wd;i+=4){ const w=Math.min(3,Wd-i); fr(c,X+i,Y,w,5,p[1]); fr(c,X+i,Y,1,5,p[0]); fr(c,X+i,Y,w,1,p[0]); }
  fr(c,X,Y+5,Wd,1,p[3]);
}
/* ------------------------------------------------------------------
   GRAMMAIRE DE MASSING — pour qu'aucun bâtiment ne soit un simple
   parallélépipède coiffé d'un triangle. Quatre volumes types :
   toit asymétrique (catslide), pignon à redents, tourelle ronde,
   appentis accolé. Chaque générateur en combine au moins un.
   ------------------------------------------------------------------ */
/* toit asymétrique : faîte décalé vers un bord, un pan long et doux,
   un pan court et raide — le profil des maisons qui ont grandi */
function toitAsym(c,X,Y,Wd,Ht,t,mat,side){
  const chaumeMode=mat==='chaume', st=chaumeMode?2:3;
  const rx=X+(side>0?Math.round(Wd*0.30):Math.round(Wd*0.70));
  for(let j=0;j<Ht;j+=st){
    const p=Math.min(1,(j+st)/Ht);
    const xl=Math.max(X,Math.round(rx-(rx-X)*p));
    const xr=Math.min(X+Wd,Math.round(rx+(X+Wd-rx)*p));
    if(chaumeMode){
      const k=(j/2)|0;
      fr(c,xl,Y+j,xr-xl,2,k%2?PAL.chaume[1]:PAL.chaume[0]);
      fr(c,xl,Y+j+1,xr-xl,1,PAL.chaume[2]);
      for(let i=(k%3);i<xr-xl;i+=3) if(chance(.5)) fr(c,xl+i,Y+j,1,2,PAL.chaume[3]);
    } else {
      rangTuiles(c,xl,Y+j,xr-xl,t,(j/3)|0);
      fr(c,xl,Y+j,1,3,t[3]); fr(c,xr-1,Y+j,1,3,t[3]);
    }
  }
  fr(c,X-2,Y+Ht-3,Wd+4,3,chaumeMode?PAL.chaume[3]:t[3]);
  fr(c,X-2,Y+Ht-3,Wd+4,1,chaumeMode?PAL.chaume[2]:clair(t[2],.14));
  fr(c,X-2,Y+Ht,Wd+4,1,'rgba(12,16,24,.34)');
  fr(c,rx-1,Y,3,2,chaumeMode?PAL.chaume[2]:clair(t[0],.22));   // faîtière au droit du faîte
}
/* pignon à redents : mur en degrés qui monte porter le toit, silhouette
   des rues marchandes ; degrés quantifiés, jamais d'escalier fin */
function pignonRedents(c,X,Y,Wd,Ht,p){
  const nb=Math.max(4,Math.round(Ht/3));
  const st=Math.max(2,Math.round(Ht/nb));
  for(let b=0;b<nb;b++){
    const bh2=Math.min(st,Ht-b*st); if(bh2<=0) break;
    const bw=Math.max(3,Math.round(Wd*(b+1)/nb));
    const bx=X+((Wd-bw)>>1), by=Y+b*st;
    fr(c,bx,by,bw,bh2,p[1]);
    fr(c,bx,by,bw,1,p[0]);
    fr(c,bx,by,1,bh2,p[0]); fr(c,bx+bw-1,by,1,bh2,p[3]);
  }
}
/* tourelle ronde : fût cylindrique appareillé coiffé en poivrière,
   percé d'une archère ; tourelle d'escalier ou échauguette d'encoignure.
   Renvoie la hauteur du cône pour poser girouette ou bannière. */
/* Tourelle d'escalier des maisons. C'était une bande grise au damier plat,
   coiffée d'un cône : une gouttière verticale, pas un ouvrage. On lui donne
   ce qui fait une tourelle : le VOLUME (futRond : la lumière tourne, les
   assises se courbent), les JOURS D'ESCALIER — trois fentes qui montent en
   hélice, décalées d'un tiers de tour, car on doit lire la vis derrière le
   mur —, la porte basse, le cordon sous la coiffe, et la poivrière débordante
   sur ses corbeaux avec l'épi de faîtage. */
function tourRon(c,x,bas,w,h,p,toit){
  futRond(c,x+(w>>1),bas,h,w-1,p,3,0);
  const dh=Math.max(6,Math.round(h*0.26));                     // porte basse
  for(let j=0;j<dh;j++){
    let wj=Math.max(2,Math.round(w*0.42)), r2=wj>>1;
    if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj-=2*d; }
    fr(c,x+((w-wj)>>1),bas-dh+j,wj,1,'#1d1a16');
  }
  fr(c,x+((w-Math.max(2,Math.round(w*0.42)))>>1)-1,bas-dh-1,Math.max(2,Math.round(w*0.42))+2,1,p[0]);
  for(let k=0;k<3;k++){                                        // les jours de la vis
    const fy2=bas-dh-3-Math.round((h-dh-8)*(k/2.4));
    const fx2=x+1+Math.round((w-3)*((k*0.37+0.18)%1));
    archere(c,fx2+1,fy2-Math.max(3,Math.round(h*0.09)),Math.max(3,Math.round(h*0.09)),p,false);
  }
  fr(c,x-1,bas-h,w+2,2,p[0]);                                  // cordon sous la coiffe
  fr(c,x-1,bas-h,w+2,1,clair(p[0],.24));
  for(let i=0;i<w+2;i+=2) fr(c,x-1+i,bas-h+2,1,2,p[1]);        // corbeaux
  const ch=Math.max(7,Math.round(w*1.05));
  poivriere(c,x+(w>>1),bas-h-ch,(w>>1)+2,ch,toit);
  fr(c,x+(w>>1),bas-h-ch-3,1,3,'#8d9199');                     // épi de faîtage
  fr(c,x+(w>>1)-1,bas-h-ch-3,3,1,'#c9a24a');
  return ch;
}
/* appentis : volume annexe accolé en contrebas, toit en pente simple qui
   s'appuie au mur maître (dir=1 : pente vers la droite). Renvoie la
   hauteur du rampant pour poser un chat ou une caisse. */
function appentis(c,x,bas,w,h,col,toit,dir){
  fr(c,x,bas-h,w,h,col);
  fr(c,x,bas-h,w,1,clair(col,.14));
  fr(c,x+(dir>0?w-1:0),bas-h,1,h,ombre(col,.28));
  for(let i=1;i<w;i+=3) fr(c,x+i,bas-h+2,1,Math.max(1,h-3),ombre(col,.14));
  const rh=Math.max(4,Math.round(w*0.55));
  for(let i=0;i<w;i++){
    const q=i/Math.max(1,w-1);
    const y=bas-h-rh+Math.round((dir>0?q:1-q)*(rh-1));
    fr(c,x+i,y,1,3,toit[1]);
    fr(c,x+i,y,1,1,toit[0]);
  }
  fr(c,x-(dir>0?1:0),bas-h-rh,1,rh+2,toit[3]);                // solin contre le mur maître
  fr(c,x-(dir>0?2:1),bas-h,w+3,1,'rgba(12,16,24,.30)');
  return rh;
}
/* Fenêtre à meneau : encadrement de pierre, croisillons, appui saillant,
   volets, jardinière — et, une fois sur six, un chat installé sur le
   rebord. C'est le détail qui fait la ville : on ne la lit plus comme un
   décor mais comme un endroit habité. */
function chatAuBalcon(c,x,y,pelage){
  const o=ombre(pelage,.30), l=clair(pelage,.26);
  fr(c,x,y-3,3,3,pelage);            // corps assis, vu de face
  fr(c,x,y-3,3,1,l);
  fr(c,x,y-5,3,2,pelage);            // tête
  fr(c,x,y-5,1,1,o); fr(c,x+2,y-5,1,1,o);   // oreilles
  fr(c,x,y-4,1,1,'#1b1f26'); fr(c,x+2,y-4,1,1,'#1b1f26');  // yeux
  fr(c,x+1,y-3,1,1,clair(pelage,.45));       // museau
  fr(c,x+3,y-2,1,2,o);                       // queue enroulée
  fr(c,x+3,y-1,1,1,pelage);
}
/* ------------------------------------------------------------------
   FENÊTRE À PETITS BOIS. C'était le pire défaut de la ville : à grande
   échelle une baie devenait un rectangle noir de 16x24 px, et une façade
   n'était plus qu'une grille de trous — l'immeuble de bureaux. Le verre
   médiéval n'est pas un trou : c'est un RÉSEAU DE PLOMB qui tient des
   carreaux losangés, chacun renvoyant le ciel sous un angle un peu
   différent. On peint donc le vitrage comme une matière (dégradé du ciel
   en haut, pièce sombre en bas), on pose le plomb en losanges, on croise
   un meneau et une traverse de pierre dès que la baie est grande, et on
   termine par l'appui saillant qui projette son ombre. La baie redevient
   un objet, la façade respire.
   ------------------------------------------------------------------ */
function fenetre(sp,c,x,y,w,h,bois,volet,opt){
  opt=opt||{};
  const arc = opt.arc!==undefined ? opt.arc : (h>=w*1.5 && chance(.40));
  const vitrail = !!opt.vitrail;

  fr(c,x-2,y-2,w+4,h+4,ombre(bois[1],.20));       // ébrasement dans l'épaisseur du mur
  const peint = opt.peint!==undefined ? opt.peint : chance(.25);
  const cad = peint ? mix(volet,'#e8e0cd',.25) : bois[1];   // encadrement peint
  fr(c,x-1,y-1,w+2,h+2,cad);                      // dormant
  fr(c,x-1,y-1,w+2,1,clair(cad,.18));
  fr(c,x-1,y-1,1,h+2,clair(cad,.12));
  fr(c,x+w,y-1,1,h+2,ombre(cad,.30));

  /* --- le verre --- */
  const froid = vitrail ? ['#5b3f6e','#3f2c52','#2a1d38']
                        : ['#9db9c9','#6d8b9e','#3c4f5e'];
  for(let j=0;j<h;j++){
    const t=j/Math.max(1,h-1);
    const col = t<0.42 ? mix(froid[0],froid[1],t/0.42)
                       : mix(froid[1],froid[2],(t-0.42)/0.58);
    fr(c,x,y,w,1,col); c.fillStyle=col; c.fillRect(x,y+j,w,1);
  }
  // le fond de pièce mange le bas de la baie : sans cela le verre flotte
  fr(c,x,y+h-Math.max(1,h>>2),w,Math.max(1,h>>2),ombre(froid[2],.45));

  /* --- réseau de plomb en losanges --- */
  const dl=clamp(Math.round(Math.min(w,h)*0.46),3,7);
  const pSombre='rgba(30,38,46,.50)', pClair='rgba(226,242,250,.30)';
  for(let k=-h;k<w+h;k+=dl){
    for(let j=0;j<h;j++){
      const a=k+j, b=k+(h-1-j);
      if(a>=0&&a<w) fr(c,x+a,y+j,1,1, j<h*0.45?pClair:pSombre);
      if(b>=0&&b<w) fr(c,x+b,y+j,1,1, pSombre);
    }
  }
  if(vitrail){                                    // éclats de couleur dans les losanges
    for(let k=0,n=Math.max(2,(w*h)/26|0);k<n;k++)
      fr(c,x+RI(0,w-1),y+RI(0,h-1),1,1,
         pick(['rgba(196,72,64,.5)','rgba(72,120,190,.5)','rgba(214,168,60,.5)','rgba(88,150,96,.5)']));
  }

  /* --- meneau et traverse de pierre pour les grandes baies --- */
  if(w>=9){ const mx=x+((w-2)>>1);
    fr(c,mx,y,2,h,bois[1]); fr(c,mx,y,1,h,clair(bois[2],.16)); }
  if(h>=11){ const my=y+Math.round(h*0.42);
    fr(c,x,my,w,2,bois[1]); fr(c,x,my,w,1,clair(bois[2],.16)); }

  /* --- cintre : on rogne les angles hauts dans la couleur du dormant --- */
  if(arc){
    const r=Math.min(w>>1,Math.max(2,Math.round(w*0.5)));
    for(let j=0;j<r;j++){
      const d=Math.round(r-Math.sqrt(Math.max(0,r*r-(r-j)*(r-j))));
      if(d<=0)continue;
      fr(c,x,y+j,d,1,bois[1]); fr(c,x+w-d,y+j,d,1,bois[1]);
      fr(c,x+d-1,y+j,1,1,clair(bois[2],.14));
    }
  }
  // éclat franc en haut à gauche : c'est lui qui dit « c'est du verre »
  fr(c,x+1,y+1,1,1,'rgba(255,255,255,.55)');
  if(w>=6&&h>=7){ fr(c,x+2,y+1,1,1,'rgba(255,255,255,.30)'); fr(c,x+1,y+2,1,1,'rgba(255,255,255,.30)'); }

  /* --- appui saillant et son ombre portée --- */
  fr(c,x-2,y+h,w+4,2,bois[3]);
  fr(c,x-2,y+h,w+4,1,clair(bois[2],.22));
  fr(c,x-2,y+h+2,w+4,1,'rgba(12,16,24,.34)');

  if(opt.volets){
    for(const s2 of [-1,1]){
      const vx=s2<0?x-4:x+w+2;
      fr(c,vx,y-1,2,h+2,volet);
      fr(c,vx,y-1,1,h+2,clair(volet,.26));
      fr(c,vx,y+(h>>1),2,1,ombre(volet,.36));
      fr(c,vx,y-1,2,1,clair(volet,.16));
      fr(c,vx,y+h,2,1,ombre(volet,.36));
      if(h>=6){ fr(c,vx,y+2,1,1,ombre(volet,.5)); fr(c,vx+1,y+3,1,1,ombre(volet,.5)); }
      fr(c,vx+(s2<0?2:-1),y+1,1,1,'#8d9199');       // gond
      fr(c,vx+(s2<0?2:-1),y+h-2,1,1,'#8d9199');
    }
  }
  if(opt.jardiniere && w>=3){
    fr(c,x-2,y+h+2,w+4,2,bois[2]); fr(c,x-2,y+h+2,w+4,1,clair(bois[0],.18));
    for(let i=0;i<w+2;i+=2) fr(c,x-1+i,y+h+1,1,1,pick(['#b8465a','#d0813a','#c9c04a','#9a5ea8']));
    fr(c,x-1,y+h+1,1,1,'#4e6b2c'); fr(c,x+w,y+h+1,1,1,'#4e6b2c');
  }
  if(w>=3&&h>=4&&chance(.17)) chatAuBalcon(c,x+((w-3)>>1),y+h,pick(TENUES).pelage);
  sp.fenetres.push({x,y,w,h,ph:rnd()*6.28,on:opt.on!==undefined?opt.on:chance(.78),vitrail:vitrail});
}

/* ------------------------------------------------------------------
   BARDAGE. Les planches faisaient deux à trois pixels au pas quasi fixe :
   à l'écran, un peigne. Une planche de bardage réelle est LARGE — on la
   dimensionne sur l'échelle du dessin —, chacune tire son ton au bruit
   (cœur, aubier, planche grise délavée), le joint n'apparaît que quatre
   fois sur cinq, et une planche sur douze est un événement : gauchie et
   décalée d'un pixel, fendue sur toute sa hauteur, ou remplacée par une
   neuve plus claire. Les nœuds tombent où le bois les a mis.
   ------------------------------------------------------------------ */
function bardage(c,X,Y,Wd,Ht,B){
  const K=Math.max(1,ECHM);
  let x=X;
  while(x<X+Wd){
    const pw=Math.min(X+Wd-x, Math.max(4,Math.round(4.5*K))+RI(-1,2));
    if(pw<2) break;
    const ton=rnd();
    let col = ton<0.16?'#a8845a' : (ton<0.30?'#5a4229' : (ton<0.40?'#8d857a':'#7d5f3c'));
    let dy=0;
    const r=rnd();
    if(r<0.05){ col=clair('#a8845a',.14); }                  // planche neuve
    else if(r<0.09){ dy=1; }                                 // planche gauchie
    fr(c,x,Y+dy,pw,Ht-dy,col);
    fr(c,x,Y+dy,pw,1,clair(col,.16));
    fr(c,x,Y+dy,1,Ht-dy,clair(col,.12));
    if(chance(.8)) fr(c,x+pw-1,Y,1,Ht,ombre(col,.30));       // joint, pas systématique
    if(r>=0.09&&r<0.13)                                      // fente
      for(let j=RI(1,3);j<Ht-1;j+=1) if(chance(.7)) fr(c,x+RI(1,pw-2),Y+j,1,1,ombre(col,.34));
    for(let k=0,n=chance(.5)?1:0;k<n;k++){                   // nœud
      const ny=Y+RI(Math.round(Ht*0.2),Math.max(2,Math.round(Ht*0.8)));
      fr(c,x+RI(1,Math.max(1,pw-2)),ny,2,2,'#4a3826');
      fr(c,x+RI(1,Math.max(1,pw-2)),ny,1,1,'#6b5134');
    }
    x+=pw;
  }
}

/* Porte cintrée : jambages, claveaux, planches clouées, heurtoir — et une
   chatière découpée dans le bas du vantail, comme il se doit. */
function porte(c,x,y,w,h,bois,arc){
  fr(c,x-2,y-(arc?3:1),w+4,h+(arc?3:1),ombre(bois[1],.22));   // ébrasement
  fr(c,x-1,y-(arc?2:0),w+2,h+(arc?2:0),bois[1]);
  if(arc){ for(let j=0;j<2;j++) fr(c,x-1+j+1,y-2+j,w-2*j,1,clair(bois[0],.12)); }
  fr(c,x,y,w,h,bois[2]);
  fr(c,x,y,1,h,clair(bois[2],.16));
  for(let i=1;i<w;i+=3) fr(c,x+i,y,1,h,bois[1]);
  for(let j=2;j<h;j+=Math.max(4,h>>1)) fr(c,x,y+j,w,1,bois[0]);   // pentures
  for(let i=1;i<w;i+=3){ fr(c,x+i,y+2,1,1,'#8d9199'); fr(c,x+i,y+h-3,1,1,'#8d9199'); }
  fr(c,x,y,w,1,clair(bois[0],.16));
  fr(c,x+w-2,y+((h)>>1),1,1,'#d0a851');            // heurtoir
  fr(c,x+w-2,y+((h)>>1)+1,1,1,'#8a6a2a');
  if(w>=6&&h>=8&&chance(.55)){                     // chatière dans le vantail
    const d=Math.max(3,Math.min(5,w-3)), cxp=x+((w-d)>>1);
    disque(c,cxp+(d>>1),y+h-(d>>1)-2,(d>>1)+1,bois[1]);
    disque(c,cxp+(d>>1),y+h-(d>>1)-2,d>>1,'#17110b');
    fr(c,cxp+(d>>1)-1,y+h-d-2,3,1,bois[0]);
  }
  fr(c,x,y+h-1,w,1,bois[3]);
}

/* ==================================================================
   4. GÉNÉRATEURS DE BÂTIMENTS — LE BOURG DES CHATS
   Chaque générateur renvoie un sprite + ses ancres animées.
   Facteur d'échelle par rangée : les édifices du fond sont plus petits.
   Tout ici est pensé à hauteur de chat : portes rondes, perchoirs,
   coussins, poissons pendus, griffoirs — la ville est habitée, pas
   seulement bâtie.
   ================================================================== */
/* La rangée avant écrasait celles du fond : à échelle 1,0 ses toits
   montaient jusqu'aux façades de la rangée 1, elle-même mordant la 0.
   On resserre la PYRAMIDE des tailles (0,58 / 0,72 / 0,88) et on remonte
   l'horizon d'un cran : chaque étage garde sa bande de ciel au-dessus des
   toits de devant, et les bâtiments du fond redeviennent lisibles. */
const ECH=[0.58,0.72,0.88];
let ECHM=1;                                   // échelle globale, suit la hauteur de scène
const sc  = (row,v)=>Math.max(2,Math.round(v*(ECH[row]||1)*ECHM));
const ech = row=>Math.max(.55,(ECH[row]||1)*ECHM);

/* ------------------------------------------------------------------
   LE BESTIAIRE ET LE MOBILIER FÉLINS — primitives partagées.
   Un chat tient en 5 à 8 pixels ; c'est leur nombre qui fait la ville.
   ------------------------------------------------------------------ */
const COUSSINS=['#b0555f','#4a6c8a','#7a5f9c','#c48a3a','#4f8a63','#a0496b'];
const PELAGES=['#d9954e','#9aa2ad','#e8e0cd','#4a4038','#c9a05c','#2e2a26','#b8b0a0','#8a6a4e'];

/* Chat assis vu de profil, queue enroulée devant — la pose du guetteur.
   `dir` vaut -1 (face à gauche) ou 1 (face à droite). */
/* ------------------------------------------------------------------
   LES CHATS POSÉS. Ils étaient six rectangles d'une seule teinte, ce qui
   passait à distance mais crevait les yeux au premier plan, d'autant qu'il
   y en a partout. On leur applique la même règle qu'aux villageois : la
   SILHOUETTE d'abord — oreilles détachées, queue qui sort franchement du
   corps —, puis un ÉCLAIREMENT en haut à gauche, puis une ROBE. Cinq robes
   suffisent à ce qu'on ne voie jamais deux fois le même chat : unie, tigrée,
   smoking (poitrail et pattes blancs), bicolore par plaques, et pointue
   (extrémités sombres). C'est la robe, pas la pose, qui fait la variété.
   ------------------------------------------------------------------ */
function robeChat(pelage){
  const r=rnd();
  if(r<0.30) return {t:'unie'};
  if(r<0.58) return {t:'tigre', raie:ombre(pelage,.34)};
  if(r<0.75) return {t:'smoking', blanc:'#eee7d6'};
  if(r<0.90) return {t:'plaques', autre: chance(.5)?'#eee7d6':ombre(pelage,.45)};
  return {t:'pointu', bout:ombre(pelage,.50)};
}
function chatAssis(c,x,y,pelage,dir,rb){
  dir=dir||1; rb=rb||robeChat(pelage);
  const o=ombre(pelage,.34), oo=ombre(pelage,.52), l=clair(pelage,.26), ll=clair(pelage,.44);
  const s2=dir>0?1:-1;
  const av=dir>0?x+3:x;                       // colonne avant (poitrail)
  const ar=dir>0?x:x+3;                       // colonne arrière (croupe)
  fr(c,x-1,y,6,1,'rgba(18,14,9,.24)');        // ombre au sol
  // corps assis : croupe basse et large, poitrail dressé
  fr(c,x,y-5,4,5,pelage);
  fr(c,ar,y-4,1,4,o);                          // arrière-train dans l'ombre
  fr(c,x,y-5,4,1,l);
  fr(c,av,y-6,1,2,pelage);                     // épaule
  if(rb.t==='smoking'){ fr(c,av,y-4,1,4,rb.blanc); fr(c,av-s2,y-1,1,1,rb.blanc); }
  if(rb.t==='plaques'){ fr(c,ar,y-5,2,2,rb.autre); fr(c,av,y-2,1,2,rb.autre); }
  if(rb.t==='tigre'){ fr(c,x+1,y-5,1,1,rb.raie); fr(c,x+2,y-3,1,1,rb.raie); fr(c,x+1,y-2,1,1,rb.raie); }
  // pattes avant, bien détachées
  fr(c,av,y-2,1,2,pelage); fr(c,av-s2,y-2,1,2,pelage);
  fr(c,av,y-1,1,1,ll); fr(c,av-s2,y-1,1,1,l);
  if(rb.t==='smoking'){ fr(c,av,y-1,1,1,rb.blanc); fr(c,av-s2,y-1,1,1,rb.blanc); }
  // tête : museau du côté du regard, oreilles nettement séparées
  const hx=dir>0?x+2:x;
  fr(c,hx,y-9,3,3,pelage);
  fr(c,hx,y-9,3,1,l);
  fr(c,hx+(dir>0?2:0),y-9,1,3,ll);
  fr(c,hx,y-10,1,1,pelage); fr(c,hx+2,y-10,1,1,pelage);          // oreilles
  fr(c,hx,y-10,1,1,o);      fr(c,hx+2,y-10,1,1,o);
  fr(c,hx+1,y-10,1,1,ombre(pelage,.60));                          // creux entre les oreilles
  if(rb.t==='pointu'){ fr(c,hx,y-10,1,2,rb.bout); fr(c,hx+2,y-10,1,2,rb.bout); }
  if(rb.t==='tigre'){ fr(c,hx+1,y-9,1,1,rb.raie); }
  const oe=chance(.35)?'#5fae62':'#0f1319';
  fr(c,hx+(dir>0?2:0),y-8,1,1,oe);                                // œil
  fr(c,hx+(dir>0?0:2),y-8,1,1,oe);
  fr(c,hx+(dir>0?2:0),y-7,1,1,clair(pelage,.55));                 // museau
  fr(c,hx+(dir>0?3:-1),y-7,1,1,'rgba(240,240,228,.40)');          // moustache
  // queue : elle sort du corps, descend et s'enroule vers l'avant
  const qx=dir>0?x-1:x+4;
  fr(c,qx,y-4,1,3,pelage);
  fr(c,qx,y-4,1,1,o);
  fr(c,qx+(dir>0?0:-1),y-1,2,1,pelage);
  fr(c,qx+(dir>0?1:0),y-1,1,1,l);
  if(rb.t==='pointu') fr(c,qx+(dir>0?0:-1),y-1,2,1,rb.bout);
  if(rb.t==='tigre'){ fr(c,qx,y-3,1,1,rb.raie); fr(c,qx,y-1,1,1,rb.raie); }
}
/* Chat en boule : un pain de fourrure. Ce qui le rend lisible, c'est le
   sillon sombre qui sépare la tête enfouie du dos, et la queue qui vient
   fermer la boule par-devant. */
function chatDormi(c,x,y,pelage,rb){
  rb=rb||robeChat(pelage);
  const o=ombre(pelage,.30), oo=ombre(pelage,.48), l=clair(pelage,.24);
  fr(c,x-1,y,8,1,'rgba(18,14,9,.22)');
  fr(c,x,y-3,6,3,pelage);
  fr(c,x+1,y-4,4,1,pelage);
  fr(c,x+1,y-4,3,1,l);                      // dos éclairé
  fr(c,x,y-1,1,1,o); fr(c,x+5,y-1,1,1,o);
  fr(c,x+1,y-5,1,1,pelage); fr(c,x+3,y-5,1,1,pelage);            // oreilles qui dépassent
  fr(c,x+1,y-5,1,1,o);      fr(c,x+3,y-5,1,1,o);
  fr(c,x+2,y-4,1,1,oo);                                          // sillon tête/dos
  fr(c,x+1,y-3,1,1,ombre(pelage,.38));                           // paupière close
  if(rb.t==='tigre'){ fr(c,x+2,y-3,1,1,rb.raie); fr(c,x+4,y-2,1,1,rb.raie); }
  if(rb.t==='plaques') fr(c,x+3,y-3,2,2,rb.autre);
  if(rb.t==='smoking') fr(c,x,y-2,1,2,rb.blanc);
  fr(c,x+4,y-2,2,1,o);                                           // queue repliée devant
  fr(c,x+5,y-2,1,1,rb.t==='pointu'?rb.bout:pelage);
}
/* Chat au rebord d'une fenêtre, vu de dos : sa silhouette la plus lisible.
   La queue qui pend et bat est le seul mouvement qu'on lit à cette taille. */
function chatAuBalcon(c,x,y,pelage,rb){
  rb=rb||robeChat(pelage);
  const o=ombre(pelage,.30), oo=ombre(pelage,.48), l=clair(pelage,.28);
  fr(c,x,y-4,3,4,pelage);
  fr(c,x,y-4,3,1,l);
  fr(c,x,y-4,1,4,o);
  fr(c,x,y-6,3,2,pelage);                                        // nuque
  fr(c,x,y-6,3,1,l);
  fr(c,x,y-7,1,1,pelage); fr(c,x+2,y-7,1,1,pelage);              // oreilles
  fr(c,x,y-7,1,1,o);      fr(c,x+2,y-7,1,1,o);
  fr(c,x+1,y-7,1,1,ombre(pelage,.55));
  if(rb.t==='pointu'){ fr(c,x,y-7,1,2,rb.bout); fr(c,x+2,y-7,1,2,rb.bout); }
  if(rb.t==='tigre'){ fr(c,x+1,y-6,1,1,rb.raie); fr(c,x+1,y-3,1,1,rb.raie); }
  if(rb.t==='plaques') fr(c,x+2,y-4,1,2,rb.autre);
  fr(c,x+3,y-3,1,3,o);                                           // queue qui pend
  fr(c,x+3,y,1,1,rb.t==='pointu'?rb.bout:pelage);
  fr(c,x+3,y-3,1,1,pelage);
}
/* ------------------------------------------------------------------
   ÉCUSSON. Une façade médiévale se lit d'abord à ses armes : l'écu dit
   qui habite, la charge dit le métier. C'est le détail qui transforme
   trente maisons interchangeables en trente adresses. L'écu est peint
   comme un vrai écu : champ, partition (parti, coupé, chevronné), charge
   au centre en métal (or ou argent), bordure et ombre portée sur le mur.
   ------------------------------------------------------------------ */
const CHARGES=['poisson','patte','souris','ble','marteau','fiole','cloche','cle','etoile','feuille'];
function charge(c,cx,cy,r,col,kind){
  const o=ombre(col,.35);
  switch(kind){
    case 'poisson':
      fr(c,cx-r,cy-1,2*r-1,3,col); fr(c,cx-r,cy,2*r-1,1,clair(col,.3));
      fr(c,cx+r-1,cy-2,2,5,col); fr(c,cx-r+1,cy-1,1,1,o); break;
    case 'patte':
      fr(c,cx-1,cy,3,2,col);
      fr(c,cx-2,cy-2,1,2,col); fr(c,cx,cy-3,1,2,col); fr(c,cx+2,cy-2,1,2,col); break;
    case 'souris':
      fr(c,cx-1,cy-1,3,3,col); fr(c,cx-2,cy-2,2,2,col);
      fr(c,cx+2,cy,r,1,col); fr(c,cx-1,cy-1,1,1,o); break;
    case 'ble':
      fr(c,cx,cy-r,1,2*r,col);
      for(let k=-r+1;k<r;k+=2){ fr(c,cx-1,cy+k,1,1,col); fr(c,cx+1,cy+k,1,1,col); } break;
    case 'marteau':
      fr(c,cx-r,cy-2,2*r,3,col); fr(c,cx-1,cy,2,r+1,ombre(col,.2)); break;
    case 'fiole':
      fr(c,cx-1,cy-r,2,2,col); fr(c,cx-2,cy-r+2,4,4,col); fr(c,cx-1,cy-r+3,1,1,clair(col,.4)); break;
    case 'cloche':
      fr(c,cx-2,cy-2,4,4,col); fr(c,cx-1,cy-3,2,1,col); fr(c,cx-3,cy+2,6,1,col); break;
    case 'cle':
      fr(c,cx-1,cy-2,2,2,col); fr(c,cx,cy,1,r+1,col); fr(c,cx+1,cy+r-1,2,1,col); break;
    case 'etoile':
      fr(c,cx,cy-r,1,2*r+1,col); fr(c,cx-r,cy,2*r+1,1,col);
      fr(c,cx-1,cy-1,3,3,col); break;
    default:
      fr(c,cx,cy-r,1,2*r,col); for(let k=0;k<r;k++){ fr(c,cx-k-1,cy-r+k+1,1,1,col); fr(c,cx+k+1,cy-r+k+1,1,1,col); }
  }
}
function ecusson(c,x,y,w,h,champ,kind,potence){
  const m=Math.min(w,h);
  if(m<7) return;
  /* Écus trop grands : ils écrasaient la façade au lieu de la ponctuer.
     On les ramène aux trois quarts, ce qui les met à l'échelle d'une baie. */
  w=Math.max(6,Math.round(w*0.76)); h=Math.max(8,Math.round(h*0.76));
  const champ2=pick(PAL.blason.filter(b=>b!==champ))||'#8a6a2a';
  const metal=chance(.55)?'#e0c463':'#dfe3ea';
  const part=pick(['plain','parti','coupe','chevron','plain']);
  if(potence){                                    // potence de fer forgé
    fr(c,x-3,y-4,w+6,1,'#3a3a3f');
    fr(c,x-3,y-4,1,4,'#3a3a3f');
    fr(c,x+((w-1)>>1),y-4,1,3,'#4a4a50');
  }
  fr(c,x+1,y+1,w,h,'rgba(10,14,20,.30)');         // ombre sur le mur
  for(let j=0;j<h;j++){
    const t=j/(h-1);
    const wj = t<0.60 ? w : Math.max(1,Math.round(w*(1-Math.pow((t-0.60)/0.40,1.5))));
    const x0=x+((w-wj)>>1);
    let col=champ;
    if(part==='parti')  col=null;
    if(part==='coupe')  col = t<0.5?champ:champ2;
    if(part==='chevron')col = (j> h*0.42 && Math.abs((x0+wj/2)-(x+w/2))<99) ? champ : champ;
    if(col) fr(c,x0,y+j,wj,1,col);
    else { fr(c,x0,y+j,wj>>1,1,champ); fr(c,x0+(wj>>1),y+j,wj-(wj>>1),1,champ2); }
    fr(c,x0,y+j,1,1,ombre(col||champ,.42));
    fr(c,x0+wj-1,y+j,1,1,ombre(col||champ2,.42));
  }
  if(part==='chevron'){                            // chevron brochant
    const cy=y+Math.round(h*0.52);
    for(let i=0;i<w;i++){
      const d=Math.abs(i-(w-1)/2);
      fr(c,x+i,cy-Math.round(d*0.7),1,2,champ2);
    }
  }
  fr(c,x,y,w,1,clair(champ,.28));
  charge(c,x+(w>>1),y+Math.round(h*0.44),Math.max(2,Math.round(m*0.26)),metal,kind);
  fr(c,x+1,y+1,1,1,'rgba(255,255,255,.35)');
}

/* ------------------------------------------------------------------
   APPAREIL DE FÛT. Toutes les cheminées du bourg — souches, grands fûts
   d'usine, hottes — étaient peintes en damier : une assise sur deux d'un
   autre ton, un joint vertical tous les cinq pixels, en quinconce strict.
   À cette taille l'œil ne lit pas des briques, il lit une GRILLE. On
   applique donc la règle des murs : un fond de brique nuancé par le bruit
   (deux cuissons mêlées), des joints d'assise DISCONTINUS — un lit de
   mortier se voit par tronçons, jamais d'un bord à l'autre —, et une
   poignée de briques marquées, une par assise environ, avec leur lit
   éclairé et leur ombre. L'œil reconstruit l'appareil ; on ne le lui
   impose plus. `largFn(j)` donne [x,largeur] de la ligne j (0 = bas) :
   la même fonction sert au fût droit, au fruit, au tronc de cône et au
   dôme.
   ------------------------------------------------------------------ */
function futBrique(c,yTop,hs,largFn,pal,pierre){
  const K=Math.max(1,ECHM);
  const bh=Math.max(3,Math.round((pierre?3.4:2.9)*K));     // hauteur d'assise
  const bw=Math.max(4,Math.round((pierre?6.5:5.0)*K));     // brique marquée
  for(let j=0;j<hs;j++){
    const [x0,w2]=largFn(j); if(w2<1) continue;
    const y=yTop+hs-1-j;
    let col=pal[pierre?1:0];
    if(NTILE){ const n=NT2((x0+j*3)*0.5,j*0.7);
      col = n<0.30 ? mix(pal[pierre?1:0],pal[pierre?3:1],.55)
          : (n>0.74 ? clair(pal[0],.07) : col); }
    fr(c,x0,y,w2,1,col);
    fr(c,x0,y,1,1,clair(pal[0],.18));
    fr(c,x0+w2-1,y,1,1,ombre(pal[pierre?3:1],.26));
  }
  for(let j=bh;j<hs;j+=bh){                                 // joints discontinus
    const [x0,w2]=largFn(j); if(w2<3) continue;
    const y=yTop+hs-1-j;
    for(let i=0;i<w2;){
      const seg=RI(2,Math.max(3,bw-1));
      if(chance(.55)) fr(c,x0+i,y,Math.min(seg,w2-i),1,ombre(pal[pierre?3:1],.22));
      i+=seg+RI(1,3);
    }
  }
  const nb=Math.max(2,Math.round(hs/bh*0.8));               // briques marquées
  for(let k=0;k<nb;k++){
    const j=RI(2,Math.max(3,hs-3));
    const [x0,w2]=largFn(j);
    if(w2<bw+2) continue;
    const bx=x0+RI(1,w2-bw-1), by=yTop+hs-1-j;
    const hb=Math.max(2,bh-1);
    const col=chance(.5)?clair(pal[0],.10):mix(pal[0],pal[pierre?3:1],.55);
    fr(c,bx,by-hb+1,bw,hb,col);
    fr(c,bx,by-hb+1,bw,1,clair(col,.16));
    fr(c,bx,by,bw,1,ombre(col,.20));
    fr(c,bx+bw-1,by-hb+1,1,hb,ombre(col,.18));
  }
}

/* ------------------------------------------------------------------
   SOUCHE DE CHEMINÉE. Le défaut le plus visible du bourg : la souche
   était un rectangle de brique POSÉ SUR le toit, sans rien qui explique
   comment l'un traverse l'autre. Une vraie souche se raccorde par trois
   choses, et il faut les trois :
     · le SOLIN — le tablier de plomb ou de mortier qui remonte contre la
       maçonnerie et vient mourir sous les tuiles, en biseau du côté amont ;
     · le RÉTRÉCISSEMENT à la sortie de toiture, l'épaulement qui marque le
       passage de la souche massive à la souche apparente ;
     · l'OMBRE PORTÉE sur le versant aval, qui seule donne l'épaisseur.
   On ajoute la suie autour de l'orifice, le mitron, et parfois un solin
   ébréché d'où sort une touffe d'herbe.
   ------------------------------------------------------------------ */
function souche(sp,c,cxs,toitY,toitH,hors,larg,briq,pente,type,fum){
  larg=Math.max(3,larg|0);
  const yEmerge = toitY+Math.round(toitH*clamp(pente,0.05,0.9));   // là où elle sort du versant
  const yTop = yEmerge-hors;
  const ancre = larg+2;                                            // partie noyée dans le toit
  const pierreux = type==='pierre';
  const P = pierreux ? AMB.pierre : null;

  // 1. l'embase, plus large, qui plonge sous la couverture
  for(let y=yEmerge+Math.round(hors*0.18);y>yEmerge-Math.round(hors*0.16);y--){
    const w2=ancre;
    fr(c,cxs-(w2>>1),y,w2, 1, pierreux?P[2]:briq[1]);
  }
  // 2. le solin : tablier en biseau amont, arase aval
  { const yb=yEmerge+Math.round(hors*0.16);
    const sol = pierreux?'#8d9199':'#7b7f86';
    for(let k=0;k<Math.max(2,Math.round(larg*0.55));k++){
      const w2=ancre+2+k;
      fr(c,cxs-(w2>>1),yb-k,w2,1, k===0?clair(sol,.20):sol);
    }
    fr(c,cxs-((ancre+2)>>1)-1,yb+1,ancre+4,1,'rgba(12,16,24,.42)');
    if(chance(.35)){                       // solin ébréché : une touffe s'y installe
      const gx=cxs+RI(-(ancre>>1),(ancre>>1));
      fr(c,gx,yb-1,1,2,'#5d7247'); fr(c,gx+1,yb-2,1,2,'#4a6338');
    } }
  // 3. l'ombre de la souche sur le versant aval
  { const yb=yEmerge+Math.round(hors*0.16);
    for(let k=1;k<=Math.max(2,Math.round(hors*0.30));k++)
      fr(c,cxs-(ancre>>1)+k,yb+k,ancre,1,'rgba(14,18,26,'+(0.26-k*0.02).toFixed(2)+')'); }

  // 4. le fût, avec son épaulement — l'appareil vient de futBrique
  const epaul=yEmerge-Math.round(hors*0.16);
  const hsF=epaul-yTop+1;
  futBrique(c,yTop,hsF,j=>{
    const t=(hsF-1-j)/Math.max(1,hsF-1);               // t : 0 en haut, 1 vers l'épaulement
    const w2 = t>0.88 ? Math.round(ancre-(ancre-larg)*((1-t)/0.12)) : larg;
    return [cxs-(w2>>1),w2];
  }, pierreux?P:briq, pierreux);
  // 5. corniche en encorbellement, mitron, suie
  fr(c,cxs-(larg>>1)-2,yTop-1,larg+4,2, pierreux?P[1]:briq[1]);
  fr(c,cxs-(larg>>1)-2,yTop-1,larg+4,1, clair(pierreux?P[0]:briq[0],.26));
  fr(c,cxs-(larg>>1)-1,yTop-3,larg+2,2, '#4a4a50');
  fr(c,cxs-(larg>>1)-1,yTop-3,larg+2,1, '#6f737c');
  for(let i=0;i<larg+2;i+=2) fr(c,cxs-(larg>>1)-1+i,yTop-3,1,2,'#35363c');
  for(let i=0;i<larg;i++) if(chance(.5)) fr(c,cxs-(larg>>1)+i,yTop,1,1,'rgba(26,22,20,.55)');
  if(fum!==false) sp.fumees.push({x:cxs,y:yTop-4,t:(fum===undefined?0:fum),d:0.9});
  return {x:cxs,y:yTop-4};
}

/* ------------------------------------------------------------------
   LIERRE. Rien ne « déminéralise » un mur comme une plante qui l'escalade :
   la ligne droite disparaît sous une frange irrégulière. On construit la
   masse de bas en haut avec une densité qui décroît, on tire deux ou trois
   sarments qui montent plus haut que le reste (c'est eux qui font vivant),
   et on éclaire au hasard une feuille sur cinq pour donner du grain.
   ------------------------------------------------------------------ */
function lierre(c,x0,ybas,w,h,cote){
  const v=pick([['#3f6b34','#2f5228','#57874a','#22401d'],
                ['#456b3a','#33512c','#5d8a50','#243f20'],
                ['#4a6b30','#385226','#63894a','#27401c']]);
  const ph=rnd()*6.28;
  for(let i=0;i<w;i++){
    const u=i/Math.max(1,w-1);
    const bord = cote<0 ? 1-u : u;                       // la masse est plus épaisse d'un côté
    let hh=h*(0.25+0.75*Math.pow(bord,0.75));
    hh*=0.72+0.28*Math.sin(i*0.35+ph);
    hh=Math.round(hh);
    for(let j=0;j<hh;j++){
      const t=j/Math.max(1,hh-1);
      if(rnd()<0.10+0.55*Math.pow(t,1.6)) continue;      // la frange haute s'effiloche
      const y=ybas-j;
      let col = rnd()<0.34 ? v[0] : (rnd()<0.5 ? v[1] : v[3]);
      if(rnd()<0.14) col=v[2];
      fr(c,x0+i,y,1,1,col);
    }
    if(hh>2&&chance(.18)) fr(c,x0+i,ybas-hh+1,1,1,v[2]);
  }
  for(let k=0,n=Math.max(2,Math.round(w/7));k<n;k++){    // sarments qui grimpent plus haut
    let sx=x0+RI(0,w-1), sy=ybas-Math.round(h*R(0.55,0.9));
    const nl=Math.round(h*R(0.18,0.42));
    for(let j=0;j<nl;j++){
      sx+=RI(-1,1); sy-=1;
      if(sx<x0||sx>=x0+w) break;
      fr(c,sx,sy,1,1,v[1]);
      if(chance(.45)) fr(c,sx+(chance(.5)?1:-1),sy,1,1,v[0]);
      if(chance(.20)) fr(c,sx,sy-1,1,1,v[2]);
    }
  }
}

/* GOUTTIÈRE. Un chéneau de bois sur ses crochets, une descente qui court le
   long du mur avec ses colliers, un dauphin de fonte au pied et la coulure
   verte qu'il laisse sur la pierre. Trois pixels de large, mais c'est ce
   genre d'objet qui dit qu'un bâtiment est entretenu. */
function gouttiere(c,x0,yEave,w,hMur,cote,b){
  const zinc=['#7e828a','#5f636b','#9aa0a8','#43464d'];
  fr(c,x0,yEave,w,2,zinc[1]);
  fr(c,x0,yEave,w,1,zinc[2]);
  fr(c,x0,yEave+2,w,1,zinc[3]);
  for(let i=2;i<w;i+=7){ fr(c,x0+i,yEave-1,1,4,zinc[3]); }        // crochets
  const dx=cote<0?x0+1:x0+w-2;
  fr(c,dx,yEave+2,2,hMur-2,zinc[1]);
  fr(c,dx,yEave+2,1,hMur-2,zinc[2]);
  for(let j=6;j<hMur-4;j+=9){ fr(c,dx-1,yEave+2+j,4,1,zinc[3]); } // colliers
  fr(c,dx-1,yEave+hMur-3,4,3,zinc[1]);                            // dauphin
  fr(c,dx-1,yEave+hMur-3,4,1,zinc[2]);
  for(let j=0;j<hMur-6;j++) if(chance(.30))                       // coulure
    fr(c,dx+(cote<0?2:-1),yEave+4+j,1,1,'rgba(90,120,70,.30)');
}

function chatiere(c,x,bas,d,b){                    // trou rond en bas de porte
  const r=Math.max(2,d>>1);
  disque(c,x,bas-r-1,r+1,b[1]);
  disque(c,x,bas-r-1,r,'#161009');
  fr(c,x-1,bas-r*2-1,3,1,b[2]);
  fr(c,x-r,bas-1,r*2+1,1,ombre(b[1],.3));
}
function perchoir(c,x,y,w,b,coussin){              // planche en console + coussin
  fr(c,x,y,w,1,b[2]); fr(c,x,y,w,1,clair(b[2],.22));
  fr(c,x,y+1,w,1,b[3]);
  fr(c,x+1,y+2,1,2,b[1]); fr(c,x+w-2,y+2,1,2,b[1]);
  if(coussin){
    fr(c,x+1,y-2,w-2,2,coussin);
    fr(c,x+1,y-2,w-2,1,clair(coussin,.22));
    fr(c,x+1,y-1,1,1,ombre(coussin,.3));
  }
}
/* GIROUETTE. Une girouette fixe est un contresens : c'est l'objet du village
   dont la fonction EST de bouger. On ne dessine donc dans le sprite que le
   mât et le croisillon des points cardinaux ; la flèche et son coq sont
   tracés à chaque image, orientés par un vent qui tourne lentement — deux
   sinusoïdes de périodes très différentes, pour qu'on ne devine pas le
   cycle. Vue de côté, la rotation s'écrase : l'aiguille raccourcit quand
   elle pointe vers nous, et c'est ce raccourcissement qui donne le volume. */
function girouette(sp,c,x,y,h,col){
  fr(c,x,y,1,h,'#4a4a50');
  fr(c,x,y,1,2,'#6a6e77');
  fr(c,x-1,y+h-2,3,1,'#4a4a50');
  sp.girouette={x:x,y:y-Math.max(2,Math.round(h*0.30)),r:Math.max(3,Math.round(h*0.62)),col:col||'#c9a24a'};
}
function girouettePoisson(c,x,y,h,col){            // poisson-girouette au faîtage
  fr(c,x,y,1,h,'#5c5f66');
  fr(c,x-2,y+2,5,1,'#4a4d54');
  const fy=y-1;
  fr(c,x+1,fy,4,3,col); fr(c,x+1,fy,4,1,clair(col,.3));
  fr(c,x+5,fy-1,2,5,col);                          // queue
  fr(c,x+2,fy+1,1,1,'#1c1f24');                    // œil
}
function oreillesToit(c,cx,y,e,col){               // deux oreilles au sommet du pignon
  for(const s of [-1,1]){
    const x=cx+s*e;
    for(let j=0;j<3;j++) fr(c,x-(s<0?j:0),y-3+j,j+1,1,col);
    fr(c,x,y-3,1,1,ombre(col,.35));
  }
}
function pelote(c,x,y,col){                        // pelote de laine oubliée
  disque(c,x,y,2,col);
  fr(c,x-1,y-1,3,1,clair(col,.25));
  fr(c,x+2,y+1,2,1,col);
  fr(c,x+4,y+2,1,1,col);                           // le fil qui traîne
}
function patteSurMur(c,x,y,col){                   // empreinte peinte
  fr(c,x,y+1,2,2,col);
  fr(c,x-1,y,1,1,col); fr(c,x+1,y-1,1,1,col); fr(c,x+3,y,1,1,col);
}
/* Poisson pendu à une potence : l'enseigne universelle du bourg. */
function poissonPendu(c,x,y,col){
  fr(c,x,y,1,2,'#5c5f66');                         // crochet
  fr(c,x,y+2,5,2,col); fr(c,x,y+2,5,1,clair(col,.28));
  fr(c,x+5,y+1,2,4,col);                           // queue
  fr(c,x+1,y+3,1,1,'#1c1f24');
  fr(c,x+2,y+4,2,1,ombre(col,.3));
}
/* Griffoir : poteau gainé de corde sur socle, l'objet le plus disputé du bourg. */
function griffoir(c,x,bas,h,b){
  const w=4;
  fr(c,x-1,bas-2,w+4,2,b[1]); fr(c,x-1,bas-2,w+4,1,clair(b[1],.2));
  fr(c,x,bas-h,w,h-2,'#b3a074');
  for(let j=0;j<h-2;j+=2) fr(c,x,bas-h+j,w,1,'#8f7d57');
  fr(c,x,bas-h,1,h-2,clair('#b3a074',.22));
  fr(c,x+w-1,bas-h,1,h-2,'#6f6040');
  fr(c,x+1,bas-h-2,w-1,2,b[1]);                    // pompon du sommet
  fr(c,x+2,bas-h+2,1,3,ombre('#b3a074',.4));       // marques de griffes
  fr(c,x+3,bas-h+4,1,3,ombre('#b3a074',.4));
}
/* Caisse de poissons du marché : deux harengs dépassent. */
function caissePoissons(c,x,y,w,b){
  fr(c,x,y,w,5,b[2]);
  fr(c,x,y,w,1,clair(b[2],.2)); fr(c,x,y+4,w,1,b[3]);
  fr(c,x+2,y,1,5,b[1]); fr(c,x+w-3,y,1,5,b[1]);
  fr(c,x+1,y-1,w-2,1,'#7d8790');                   // le tas
  for(let i=0;i<w-3;i+=3){ fr(c,x+1+i,y-1,3,1,i%2?'#8fa0ad':'#6f7d8a'); }
  fr(c,x+2,y-2,1,1,'#8fa0ad'); fr(c,x+w-3,y-2,1,1,'#8fa0ad');
}
/* Bidon de lait — le trésor du bourg, toujours sous surveillance. */
function bidonLait(c,x,bas){
  fr(c,x,bas-6,4,6,'#aeb6bd');
  fr(c,x,bas-6,1,6,'#d5dbe0'); fr(c,x+3,bas-6,1,6,'#7d8790');
  fr(c,x,bas-6,4,1,'#7d8790');
  fr(c,x+1,bas-8,2,2,'#aeb6bd'); fr(c,x+1,bas-8,2,1,'#d5dbe0');
  fr(c,x,bas-3,4,1,'#7d8790');
}
/* Lanterne de potence : fer forgé, vitre chaude. Pousse une lampe. */
function lanternePotence(sp,c,x,y,b){
  fr(c,x-4,y,5,1,b[3]); fr(c,x,y,1,2,b[3]);
  fr(c,x-1,y+2,3,1,'#3b3f46');
  fr(c,x-1,y+3,3,3,'#e8c76a'); fr(c,x-1,y+3,1,3,'#c9a24a'); fr(c,x+1,y+3,1,3,'#c9a24a');
  fr(c,x-1,y+6,3,1,'#3b3f46');
  sp.lampes.push({x:x,y:y+4,c:'#ffc86a',r:10});
}
/* Enseigne pendante à l'effigie d'un chat — se balance (ancre enseigne). */
/* L'enseigne était une plaque de couleur collée au mur. Une vraie enseigne
   pend AU BOUT d'une potence, à distance de la façade, et son panneau est
   chantourné : bord inférieur découpé en accolade, cadre de bois, ferrures
   d'accroche. C'est le vide entre le mur et le panneau qui fait l'objet. */
function enseigneChat(sp,c,x,y,w,h,b){
  w=Math.max(7,Math.round(w*0.82)); h=Math.max(6,Math.round(h*0.86));
  const fer='#3b3f46', ferc='#6a6e77';
  fr(c,x-3,y-2,1,4,fer);                                   // scellement au mur
  fr(c,x-3,y-2,w+5,1,fer);
  fr(c,x-3,y-1,w+5,1,ferc);
  for(let i=1;i<w+2;i+=3) fr(c,x-3+i,y,1,1,fer);           // volutes de la potence
  fr(c,x+((w-1)>>1),y,1,2,fer);
  const col=pick(PAL.blason), cad=b[1];
  for(let j=0;j<h;j++){
    const t=j/Math.max(1,h-1);
    const wj = t<0.72 ? w : Math.max(3,w-Math.round((w*0.34)*((t-0.72)/0.28)));
    const x0=x+((w-wj)>>1);
    fr(c,x0,y+2+j,wj,1, j===0?clair(col,.26):(j===h-1?ombre(col,.38):col));
    fr(c,x0,y+2+j,1,1,cad); fr(c,x0+wj-1,y+2+j,1,1,cad);
  }
  fr(c,x,y+2,w,1,cad);
  fr(c,x-1,y+2,w+2,1,'rgba(12,16,24,.30)');
  // tête de chat en réserve claire au centre du panneau
  const cx2=x+(w>>1), cy=y+2+Math.round(h*0.44);
  fr(c,cx2-1,cy-1,3,2,'#eee7d6');
  fr(c,cx2-2,cy-2,1,1,'#eee7d6'); fr(c,cx2+2,cy-2,1,1,'#eee7d6');
  fr(c,cx2-1,cy+1,3,1,'#eee7d6');
  fr(c,cx2-1,cy-1,1,1,'#141821'); fr(c,cx2+1,cy-1,1,1,'#141821');
  fr(c,cx2,cy,1,1,'#c08a8e');
  sp.enseigne={x:x+(w>>1),y:y+1,w,h};
}
/* Greffes félines systématiques : deux ou trois marques par façade. */
function chatteries(sp,c,x0,bas,w,haut,row){
  const b=AMB.bois, S=v=>Math.max(1,sc(row,v));
  /* le pied du mur : herbes, fleurs, pot, outil ou arme appuyés, tonneau —
     et parfois un auvent de toile rayée au-dessus du seuil */
  for(let i=RI(0,3);i<w;i+=RI(3,7)) if(chance(.6)){
    fr(c,x0+i,bas-RI(1,2),1,RI(1,2),pick(['#5d7c3a','#4e6b30','#6d8a46']));
    if(chance(.25)) fr(c,x0+i,bas-3,1,1,pick(['#c9788f','#e0b840','#e4dcc6','#b06fe0']));
  }
  if(chance(.35)){                                             // pot de fleurs
    const px2=x0+RI(2,Math.max(3,w-4));
    fr(c,px2,bas-2,3,2,'#a5502f'); fr(c,px2,bas-2,3,1,'#c46a41');
    fr(c,px2+1,bas-4,1,2,'#4e6b30');
    fr(c,px2,bas-5,1,1,pick(['#c9788f','#e0b840','#b06fe0']));
    fr(c,px2+2,bas-4,1,1,pick(['#c9788f','#e0b840']));
  }
  if(chance(.40)){                                             // outil ou arme au mur
    const ox=x0+(chance(.5)?RI(1,3):w-RI(2,4));
    if(chance(.5)){ trait(c,ox,bas-1,ox+2,bas-S(12),b[1],1);   // râteau/faux
      fr(c,ox+1,bas-S(13),Math.max(3,S(4)),1,'#8d9199'); }
    else { trait(c,ox,bas-1,ox+1,bas-S(10),'#6a6e77',1);       // épée au fourreau
      fr(c,ox,bas-S(11),3,1,'#8a6a2a'); fr(c,ox+1,bas-S(12),1,1,'#c9a24a'); }
  }
  if(chance(.30)){                                             // tonneau ou caisse
    const tx2=x0+(chance(.5)?-S(4):w+S(1));
    if(chance(.5)){ fr(c,tx2,bas-S(5),Math.max(4,S(5)),S(5),'#6a4c31');
      fr(c,tx2,bas-S(4),Math.max(4,S(5)),1,'#a8845a'); fr(c,tx2,bas-S(2),Math.max(4,S(5)),1,'#a8845a'); }
    else { fr(c,tx2,bas-S(4),Math.max(4,S(5)),S(4),'#8a6a45');
      fr(c,tx2,bas-S(4),Math.max(4,S(5)),1,'#a8845a');
      fr(c,tx2+1,bas-S(3),Math.max(2,S(3)),1,'#5a4128'); }
  }
  if(w>=S(22)&&chance(.28)){                                   // auvent de toile
    const aw=Math.max(8,Math.round(w*R(0.28,0.44)));
    const ax=x0+(chance(.5)?S(2):w-aw-S(2));
    const ay=bas-S(13), tc=pick(['#b8465a','#3f6b8c','#4f8a63','#c48a3a']);
    for(let j2=0;j2<S(4);j2++)
      for(let i2=0;i2<aw-j2;i2++)
        fr(c,ax+j2+i2,ay+j2,1,1, ((i2/3)|0)%2?tc:'#e4dcc6');
    for(let i2=0;i2<aw;i2+=3) fr(c,ax+S(4)-1+i2,ay+S(4),1,1,ombre(tc,.3));  // feston
    trait(c,ax+1,ay+S(4),ax+1,bas-S(6),b[1],1);
    trait(c,ax+aw-1,ay+1,ax+aw-1,bas-S(8),b[1],1);
  }
  /* Le lierre et le chéneau n'ont rien à voir avec les chats, mais cette
     fonction est le seul point de passage commun à tous les édifices : la
     brancher ici, c'est faire vivre les murs de tout le bourg d'un coup
     plutôt que d'aller les décorer un par un. */
  if(haut>=S(12)&&w>=S(14)&&chance(.40)){
    const cl=chance(.5)?-1:1, lw=Math.max(5,Math.round(w*R(0.20,0.44)));
    lierre(c, cl<0?x0-1:x0+w-lw+1, bas-1, lw, Math.round(haut*R(0.30,0.80)), cl);
  }
  if(haut>=S(16)&&w>=S(16)&&chance(.36))
    gouttiere(c,x0-1,bas-haut+1,w+2,haut-2,chance(.5)?-1:1,b);
  if(w>=S(16) && chance(.72)) chatiere(c,x0+(chance(.5)?S(5):w-S(5)),bas,Math.max(4,S(6)),b);
  if(w>=S(20) && chance(.55)){
    const pw=Math.max(6,S(10));
    const px=x0+RI(2,Math.max(3,w-pw-2));
    const py=bas-haut+RI(S(6),Math.max(S(7),haut-S(4)));
    perchoir(c,px,py,pw,b,chance(.7)?pick(COUSSINS):null);
    if(chance(.45)) chatDormi(c,px+((pw-6)>>1)+1,py-2,pick(PELAGES));
  }
  if(chance(.30)) patteSurMur(c,x0+RI(3,Math.max(4,w-5)),bas-RI(S(6),Math.max(S(7),haut-2)),
                              'rgba(60,44,30,.55)');
  if(chance(.30)) pelote(c,x0+RI(3,Math.max(4,w-4)),bas-2,pick(COUSSINS));
  if(haut>=S(20)&&w>=S(16)&&chance(.62)){          // armes de la maisonnée
    const ew=Math.max(6,S(7)), eh=Math.round(ew*1.30);
    const ex=x0+(chance(.5)?RI(2,Math.max(3,(w>>2))):w-ew-RI(2,Math.max(3,(w>>2))));
    ecusson(c,ex,bas-haut+RI(S(3),Math.max(S(4),S(9))),ew,eh,
            chance(.5)?AMB.blason:pick(PAL.blason),pick(CHARGES),chance(.5));
  }
  if(chance(.22)) bidonLait(c,x0+(chance(.5)?1:w-6),bas);
}

/* ---------- MAISON À COLOMBAGES ----------
   Cinq gabarits tirés au sort. Une seule silhouette répétée trente fois
   donne un lotissement ; ce sont les proportions — l'étroite qui monte à
   quatre niveaux, la large et trapue, la tourelle d'angle — qui font une
   rue médiévale. */
const GABARITS=[
  {p:.34,nom:'courante', w:[30,44], et:[2,3], fh:[12,15], sh:[9,13]},
  {p:.20,nom:'étroite',  w:[17,24], et:[3,4], fh:[11,14], sh:[8,11]},
  {p:.16,nom:'large',    w:[46,62], et:[1,2], fh:[13,17], sh:[10,14]},
  {p:.16,nom:'basse',    w:[26,38], et:[1,1], fh:[13,17], sh:[8,10]},
  {p:.14,nom:'tourelle', w:[32,46], et:[2,3], fh:[12,15], sh:[9,12], tour:true}
];
function tirerGabarit(row){
  if(row===0) return chance(.5)?GABARITS[3]:GABARITS[0];
  let r=rnd(), a=0;
  for(const G of GABARITS){ a+=G.p; if(r<=a) return G; }
  return GABARITS[0];
}
function genMaison(row){
  const G=tirerGabarit(row);
  const w   = sc(row,RI(G.w[0],G.w[1]));
  const et  = RI(G.et[0],G.et[1]);
  const fh  = sc(row,RI(G.fh[0],G.fh[1]));
  const sh  = sc(row,RI(G.sh[0],G.sh[1]));
  const enc = chance(.85)?sc(row,RI(3,4)):sc(row,1);
  const hautW = w+(et-1)*2*enc;
  const chaumeToit = chance(.34);
  const toitH = Math.max(9,Math.round(hautW*(chaumeToit?0.60:0.52)));
  const chem = sc(row,RI(6,11));
  const SW = hautW+sc(row,34), SH = sh+et*fh+toitH+chem+6;
  const sp=sprite(SW,SH), c=sp.g;
  const cx=SW>>1, bas=SH-1;
  const platre=pick(PAL.platre), bois=AMB.bois, volet=pick(PAL.volets);
  const toit=chaumeToit?PAL.toits.ocre:pick(AMB.toits);
  const style=pick(['croix','chevron','droit','arc','losange','croix']);

  // soubassement de pierre, porte cintrée à chatière, soupirail
  socle(c,cx-(w>>1)-1,bas-sh,w+2,sh,AMB.pierre);
  const dw=Math.max(5,sc(row,8)), dh=sh-1;
  const aGauche=chance(.5);
  const dx=aGauche?cx-(w>>1)+3:cx+(w>>1)-dw-3;
  porte(c,dx,bas-dh,dw,dh,bois,true);
  if(sh>=sc(row,10)) chatiere(c,dx+(dw>>1),bas,Math.max(4,sc(row,5)),bois);
  if(w>=sc(row,26)){
    const fw=Math.max(3,sc(row,6)), fhh=Math.max(4,sh-7);
    fenetre(sp,c,aGauche?cx+(w>>1)-fw-4:cx-(w>>1)+4, bas-sh+3, fw,fhh, bois,volet,{on:chance(.8)});
  }
  // étages à colombages, encorbellements, fenêtres à coussins
  for(let k=0;k<et;k++){
    const fw=w+k*2*enc, fx=cx-(fw>>1), fy=bas-sh-(k+1)*fh;
    colombage(c,fx,fy,fw,fh,platre,bois,style);
    if(k>0&&enc){
      for(let i=2;i<fw;i+=4){ fr(c,fx+i,fy+fh,2,2,bois[1]); fr(c,fx+i,fy+fh,1,2,bois[2]); }
      fr(c,fx,fy+fh,fw,1,bois[3]);
    }
    const nf=fw>=sc(row,36)?3:(fw>=sc(row,22)?2:1);
    const fw2=Math.max(3,sc(row,7)), fh2=Math.max(4,fh-Math.max(6,sc(row,4)));
    for(let n=0;n<nf;n++){
      const wx=Math.round(fx+ (fw-fw2)*(nf===1?0.5:(0.16+0.68*n/(nf-1))) );
      const balc = k===0 && nf>=2 && fh>=sc(row,10) && chance(.30);
      fenetre(sp,c,wx,fy+Math.max(3,sc(row,2)),fw2,fh2,bois,volet,
              {volets:!balc&&chance(.5),jardiniere:!balc&&chance(.35)});
      if(balc){                                    // balcon sur consoles
        const by2=fy+Math.max(3,sc(row,2))+fh2;
        fr(c,wx-2,by2+2,2,2,bois[1]); fr(c,wx+fw2,by2+2,2,2,bois[1]);
        fr(c,wx-3,by2,fw2+6,2,bois[0]);
        fr(c,wx-3,by2,fw2+6,1,clair(bois[2],.2));
        const gh2=Math.max(3,sc(row,4));
        fr(c,wx-3,by2-gh2,fw2+6,1,bois[1]);
        for(let g2=0;g2<fw2+6;g2+=2) fr(c,wx-3+g2,by2-gh2,1,gh2,bois[1]);
        if(chance(.6)){ fr(c,wx-2,by2-2,2,2,'#a5502f'); fr(c,wx-2,by2-3,1,1,'#c9788f'); }
        if(chance(.5)) chatAuBalcon(c,wx+(fw2>>1)-1,by2,pick(PELAGES));
      }
    }
  }
  // annexe en appentis accolée au pignon : boutique, bûcher, remise
  if(chance(.55)){
    const ad=aGauche?1:-1, aw=sc(row,RI(10,16)), ah=sc(row,RI(9,13));
    const axx=ad>0?cx+(w>>1)-1:cx-(w>>1)+1-aw;
    const rh=appentis(c,axx,bas,aw,ah,pick(PAL.platre),toit,ad);
    if(chance(.6)) fr(c,axx+Math.round(aw*0.3),bas-sc(row,7),Math.max(4,sc(row,6)),sc(row,7),bois[2]);
    if(chance(.5)) chatDormi(c,axx+RI(1,Math.max(2,aw-6)),bas-ah-rh,pick(PELAGES));
  }
  // échiffe : une tourelle d'encoignure en bois, perchée sur corbeaux
  if(G.tour && et>=2){
    const s2=chance(.5)?-1:1;
    const tw2=Math.max(8,sc(row,14)), tx2=cx+s2*Math.round(hautW*0.5)-(s2<0?0:tw2);
    const ty2=bas-sh-et*fh, th2=et*fh-sc(row,3);
    colombage(c,tx2,ty2,tw2,th2,platre,bois,'droit');
    for(let i=0;i<tw2;i+=3) fr(c,tx2+i,ty2+th2,2,3,bois[1]);
    fr(c,tx2,ty2+th2,tw2,1,bois[3]);
    const fw3=Math.max(2,sc(row,4));
    fenetre(sp,c,tx2+((tw2-fw3)>>1),ty2+sc(row,5),fw3,Math.max(4,sc(row,8)),bois,volet,{on:chance(.7)});
    poivriere(c,tx2+(tw2>>1),ty2-sc(row,11),(tw2>>1)+2,sc(row,11),toit);
    fr(c,tx2+(tw2>>1),ty2-sc(row,17),1,sc(row,6),'#8d9199');
  }
  // toiture pentue + lucarne à oreilles
  const toitY=bas-sh-et*fh-toitH, tw=hautW+sc(row,6), tx=cx-(tw>>1);
  const mat=chaumeToit?'chaume':'tuile', forme=RI(0,9);
  if(forme<3)      toitPignon(c,tx,toitY,tw,toitH,toit,mat);
  else if(forme<5) toitTrapeze(c,tx,toitY,tw,toitH,toit,mat);
  else if(forme<6) toitDemiCroupe(c,tx,toitY,tw,toitH,toit,mat);
  else if(forme<7) toitMansart(c,tx,toitY,tw,toitH,toit,mat);
  else if(forme<8) toitPavillon(c,tx,toitY,tw,toitH,toit,mat);
  else {                                                              // pignon à redents
    toitTrapeze(c,tx,toitY+Math.round(toitH*0.30),tw,Math.round(toitH*0.70),toit,mat);
    pignonRedents(c,cx-Math.round(tw*0.28),toitY,Math.round(tw*0.56),toitH+2,AMB.pierre);
  }
  // tourelle d'escalier ronde à l'encoignure, dessinée devant le toit
  if(chance(.34)&&et>=2){
    const s3=aGauche?1:-1, tw3=Math.max(6,sc(row,9));
    const tx3=s3>0?cx+(w>>1)-3:cx-(w>>1)+3-tw3;
    const th3=sh+et*fh-sc(row,2);
    const ch3=tourRon(c,tx3,bas,tw3,th3,AMB.pierre,toit);
    fr(c,tx3+(tw3>>1),bas-th3-ch3-3,1,3,'#8d9199');
  }
  if(tw>=sc(row,34)&&toitH>=15&&chance(.55)){
    const lx=cx-3+(chance(.5)?-1:1)*RI(2,6), ly=toitY+Math.round(toitH*0.42);
    fr(c,lx-2,ly,10,9,platre); fr(c,lx-2,ly,1,9,ombre(platre,.2)); fr(c,lx+7,ly,1,9,ombre(platre,.3));
    toitPignon(c,lx-4,ly-7,14,8,toit,chaumeToit?'chaume':'tuile');
    oreillesToit(c,lx+1,ly-5,3,toit[1]);                       // la lucarne a des oreilles
    fenetre(sp,c,lx+1,ly+2,4,5,bois,volet,{on:chance(.6)});
  }
  // souche : elle traverse le versant au lieu d'être posée dessus
  const briq=pick(PAL.brique);
  souche(sp,c,cx+(chance(.5)?-1:1)*RI(Math.round(hautW*0.10),Math.round(hautW*0.34)),
         toitY,toitH,chem,Math.max(3,sc(row,5)),briq,R(0.34,0.62),
         chance(.28)?'pierre':'brique',0);
  if(chance(.30)) souche(sp,c,cx+(chance(.5)?-1:1)*RI(Math.round(hautW*0.28),Math.round(hautW*0.44)),
         toitY,toitH,Math.round(chem*0.72),Math.max(3,sc(row,4)),briq,R(0.28,0.55),'brique',0);
  // auvent de boutique, poisson pendu, chat sur le faîtage
  if(w>=sc(row,28)&&chance(.4)){
    const ax=aGauche?cx-(w>>1)-1:cx+(w>>1)-sc(row,14)+1, aw=sc(row,14);
    for(let i=0;i<aw;i+=2) fr(c,ax+i,bas-sh+2,2,1, i%4?bois[1]:bois[2]);
    fr(c,ax,bas-sh+3,aw,1,toit[2]);
    fr(c,ax,bas-sh+4,aw,1,toit[3]);
    fr(c,ax+1,bas-sh+4,1,3,bois[1]); fr(c,ax+aw-2,bas-sh+4,1,3,bois[1]);
    poissonPendu(c,ax+(aw>>1)-2,bas-sh+5,'#8fa0ad');
  }
  // corde à linge tendue en façade : c'est le mouvement le plus ordinaire
  if(w>=sc(row,20)&&chance(.45)){
    sp.linge=[];
    const ly=bas-sh-et*fh+Math.max(3,sc(row,4));
    for(let k=0,n=RI(2,4);k<n;k++)
      sp.linge.push({x:cx-(w>>1)+sc(row,3)+k*Math.round((w-sc(row,8))/n), y:ly,
                     w:Math.max(3,sc(row,5)), h:Math.max(4,sc(row,7)),
                     col:pick(['#e4dcc6','#c9788f','#7fa8c9','#c9b45a','#8fb87f','#b7c4a8'])});
  }
  if(chance(.45)) oreillesToit(c,cx,toitY+2,Math.max(3,Math.round(hautW*0.20)),toit[1]);
  if(chance(.60)) girouette(sp,c,cx+RI(-3,3),toitY-sc(row,10),sc(row,10),'#c9a24a');
  else if(chance(.5)) girouettePoisson(c,cx+RI(-3,3),toitY-sc(row,8),sc(row,8),'#c9a24a');
  if(chance(.5)) chatDormi(c,cx+RI(-Math.round(hautW*0.22),Math.round(hautW*0.22)),toitY+2,pick(PELAGES));
  if(chance(.2)){
    const ex=cx-(w>>1)-5, ey=bas-sh-fh+2;
    enseigneChat(sp,c,ex,ey,9,7,bois);
  }
  chatteries(sp,c,cx-(w>>1),bas,w,sh+fh,row);
  brume(sp,row); return sp;
}

/* ---------- ARBRE À CHAT ----------
   L'habitation signature du bourg : un vrai chêne creusé en immeuble.
   Tronc écorcé, passerelles de corde, caissons perchés, plateformes à
   coussin — on n'entre pas par le sol, on grimpe. */
function genArbreChat(row){
  const trH=sc(row,RI(56,82));
  const fw=Math.max(8,sc(row,13));
  const SW=sc(row,60), SH=trH+sc(row,22);
  const sp=sprite(SW,SH), c=sp.g;
  const cx=SW>>1, bas=SH-1, b=AMB.bois;
  const ec=pick(PAL.ecorce);

  // racines étalées + butte herbeuse
  fr(c,cx-sc(row,14),bas-2,sc(row,28),2,'#5e7e46');
  fr(c,cx-sc(row,11),bas-3,sc(row,22),1,'#66884d');
  for(const s of [-1,1]) for(let i=0;i<sc(row,9);i++)
    fr(c,cx+s*(Math.round(fw*0.5)+i),bas-3+((i*0.6)|0),3,3,ec[0]);

  // tronc : écorce verticale, ombre à droite, trou de porte ronde au pied
  const tx=cx-(fw>>1);
  fr(c,tx,bas-trH,fw,trH,ec[0]);
  for(let j=0;j<trH;j+=2){
    const i=RI(1,fw-3);
    fr(c,tx+i,bas-trH+j,1,RI(2,4),chance(.6)?ec[1]:ec[2]);
  }
  fr(c,tx,bas-trH,1,trH,ec[2]); fr(c,tx+fw-1,bas-trH,1,trH,ec[1]);
  fr(c,tx+fw-2,bas-trH,1,trH,ombre(ec[1],.24));
  const hw=Math.max(5,sc(row,8));
  disque(c,cx,bas-Math.round(hw*0.75)-1,Math.round(hw*0.6)+1,ec[1]);
  disque(c,cx,bas-Math.round(hw*0.75)-1,Math.round(hw*0.6),'#17110b');
  fr(c,cx-1,bas-hw-3,3,1,ec[2]);
  sp.lampes.push({x:cx,y:bas-Math.round(hw*0.8),c:'#ffcf9a',r:sc(row,7)});

  /* ---- LE HOUPPIER. C'était trois disques plats posés en tas, troués au
     hasard : à côté des chênes de la forêt, qui sont bâtis par amas
     lenticulaires avec leur face éclairée et leur revers fermé d'un liseré
     sombre, la comparaison était cruelle. On reprend donc exactement la
     méthode de la forêt — charpentière d'abord, feuillage ensuite. ---- */
  const fg=pick(PAL.feuillage);
  const cy0=bas-trH-sc(row,2);
  const RC=Math.round(fw*2.05);                       // rayon de la couronne

  // 1. charpentières : le houppier doit être PORTÉ, on voit d'où il part
  const brs=[];
  for(let k=0,nb=RI(4,6);k<nb;k++){
    const a2=-2.62+(k/Math.max(1,nb-1))*2.10+R(-0.16,0.16);
    const l=RC*R(0.62,1.0);
    const ex=Math.round(cx+Math.cos(a2)*l), ey=Math.round(cy0+sc(row,4)+Math.sin(a2)*l*0.72);
    trait(c,cx+RI(-1,1),bas-trH+sc(row,3),ex,ey,ec[0],Math.max(2,sc(row,2)));
    trait(c,cx,bas-trH+sc(row,4),ex,ey+1,ec[1],1);
    brs.push([ex,ey]);
    if(chance(.6)){                                    // ramification secondaire
      const bx2=Math.round(cx+(ex-cx)*0.6), by2=Math.round((bas-trH)+(ey-(bas-trH))*0.6);
      const fx2=Math.round(bx2+Math.cos(a2+R(-0.7,0.7))*RC*0.42);
      const fy2=Math.round(by2+Math.sin(a2+R(-0.7,0.7))*RC*0.34);
      trait(c,bx2,by2,fx2,fy2,ec[1],1);
      brs.push([fx2,fy2]);
    }
  }
  // 2. masse sombre du revers, posée en premier : elle ferme le dessous
  for(const [bx2,by2] of brs)
    amasFeuilles(c,bx2,by2+Math.round(RC*0.10),
      Math.max(3,Math.round(RC*R(0.34,0.46))),
      Math.max(3,Math.round(RC*R(0.24,0.34))),
      [fg[3],fg[3],fg[1],fg[3]],0.12);
  // 3. amas éclairés, plus haut et décalés vers la lumière
  for(const [bx2,by2] of brs)
    amasFeuilles(c,bx2-Math.round(RC*0.08),by2-Math.round(RC*0.09),
      Math.max(3,Math.round(RC*R(0.30,0.42))),
      Math.max(3,Math.round(RC*R(0.22,0.31))),fg,0.09);
  // 4. calotte : deux amas au sommet, c'est elle qui prend le soleil
  for(let k=0;k<2;k++)
    amasFeuilles(c,cx+RI(-Math.round(RC*0.3),Math.round(RC*0.3)),
      cy0-Math.round(RC*R(0.30,0.46)),
      Math.max(3,Math.round(RC*R(0.30,0.44))),
      Math.max(3,Math.round(RC*R(0.20,0.28))),
      [fg[0],fg[0],clair(fg[2],.10),fg[1]],0.10);
  // 5. feuilles isolées sur la lisière : la silhouette ne doit pas être un contour
  for(let k=0,n=Math.round(RC*1.4);k<n;k++){
    const a=R(-3.2,0.35), rr=R(0.92,1.18);
    const px2=Math.round(cx+Math.cos(a)*RC*rr), py2=Math.round(cy0+Math.sin(a)*RC*0.80*rr);
    if(chance(.55)) fr(c,px2,py2,1,1, chance(.5)?fg[1]:fg[0]);
    if(chance(.22)) fr(c,px2+RI(-1,1),py2+RI(-1,1),1,1,fg[3]);
  }
  // 6. quelques trouées de ciel franches, à l'intérieur seulement
  c.save(); c.globalCompositeOperation='destination-out';
  for(let k=0,n=Math.round(RC*0.5);k<n;k++){
    const a=R(-3.0,0.2), rr=R(0.25,0.80);
    fr(c,Math.round(cx+Math.cos(a)*RC*rr),Math.round(cy0+Math.sin(a)*RC*0.78*rr),
       RI(1,2),1,'#000');
  }
  c.restore();
  // 7. lanternes suspendues dans les basses branches
  for(let k=0,n=RI(2,4);k<n;k++){
    const [bx2,by2]=brs[RI(0,brs.length-1)];
    const ly2=by2+Math.round(RC*R(0.16,0.34));
    trait(c,bx2,by2,bx2,ly2,'#3b3f46',1);
    fr(c,bx2-1,ly2,3,Math.max(3,sc(row,3)),'#e8c76a');
    fr(c,bx2-1,ly2,1,Math.max(3,sc(row,3)),'#c9a24a');
    fr(c,bx2-1,ly2+Math.max(3,sc(row,3)),3,1,'#3b3f46');
    sp.lampes.push({x:bx2,y:ly2+1,c:'#ffc86a',r:sc(row,9)});
  }
  // caissons perchés alternés, reliés par des ponts de corde
  const n=RI(3,4);
  let prevX=cx, prevY=bas;
  for(let k=0;k<n;k++){
    const t=(k+0.8)/(n+0.35);
    const s2=(k%2?1:-1)*(chance(.85)?1:-1);
    const cw=sc(row,RI(15,22)), ch=sc(row,RI(11,16));
    const bx=cx+s2*Math.round(sc(row,6)+cw*0.42)-(cw>>1);
    const by=bas-Math.round(trH*t);
    trait(c,cx,by+ch,bx+(s2>0?0:cw),by+Math.round(ch*0.55),b[1],2);   // console
    const platre=pick(PAL.platre);
    colombage(c,bx,by,cw,ch,platre,b,chance(.5)?'croix':'losange');
    const th2=Math.max(5,Math.round(cw*0.42));
    toitPignon(c,bx-2,by-th2,cw+4,th2,pick(AMB.toits),chance(.5)?'chaume':'tuile');
    if(chance(.6)) oreillesToit(c,bx+(cw>>1),by-th2+2,Math.max(3,cw>>2),pick(AMB.toits)[1]);
    // entrée ronde + fenêtre à coussin
    const exr=bx+(s2>0?sc(row,4):cw-sc(row,4)), r2=Math.max(2,sc(row,3));
    disque(c,exr,by+ch-r2-2,r2+1,b[1]); disque(c,exr,by+ch-r2-2,r2,'#1a130d');
    const wx=bx+(s2>0?cw-sc(row,9):sc(row,3));
    fenetre(sp,c,wx,by+3,Math.max(3,sc(row,5)),Math.max(3,ch-8),b,pick(PAL.volets),{on:chance(.8)});
    perchoir(c,bx+1,by+ch,cw-2,b,pick(COUSSINS));
    if(chance(.55)) chatDormi(c,bx+2+RI(0,Math.max(1,cw-9)),by+ch-2,pick(PELAGES));
    // pont de corde vers le caisson précédent
    if(k>0){
      const px2=bx+(s2>0?0:cw), py2=by+Math.round(ch*0.7);
      trait(c,px2,py2,prevX,prevY,b[2],2);
      const dx2=(prevX-px2), dy2=(prevY-py2), l=Math.max(1,Math.round(Math.hypot(dx2,dy2)));
      for(let i=3;i<l;i+=4)
        fr(c,Math.round(px2+dx2*i/l),Math.round(py2+dy2*i/l)-2,1,2,b[1]);
    }
    prevX=bx+(s2>0?0:cw); prevY=by+Math.round(ch*0.7);
  }
  // plateformes nues sur le tronc + pelotes + poissons séchés
  for(let k=0;k<3;k++){
    const py2=bas-Math.round(trH*R(0.14,0.90)), pw=sc(row,RI(9,14));
    perchoir(c,cx-(pw>>1),py2,pw,b,chance(.6)?pick(COUSSINS):null);
    if(chance(.5)) chatAssis(c,cx-(pw>>1)+1+RI(0,Math.max(1,pw-6)),py2-1,pick(PELAGES),chance(.5)?1:-1);
  }
  for(let i=0;i<2;i++) pelote(c,cx+RI(-sc(row,11),sc(row,11)),bas-2,pick(COUSSINS));
  poissonPendu(c,cx+(fw>>1)-1,bas-Math.round(trH*0.3),'#8fa0ad');
  brume(sp,row); return sp;
}

/* ---------- GRANGE ----------
   Le grenier du bourg : vaste nef de bois sous un chaume profond.
   Porte charretière à croix de Saint-André, fenil à poulie, et le chat
   du grenier qui dort sur la paille — son poste officiel. */
/* ---------- LA GRANGE ----------
   Reprise à zéro. Une grange, c'est un VOLUME et une porte : la plus
   grande porte du village, assez large pour un char de foin, et un
   comble qui déborde. On soigne donc trois choses — le bardage de
   planches verticales aux jeux irréguliers (une planche gauchie, une
   plus claire, un nœud), la porte charretière à deux vantaux avec sa
   ferrure en Z et son rail, et le foin : il sort de la lucarne, il
   dépasse du char, il traîne au sol. Le reste n'est que toit.
   ---------------------------------------------------------------- */
function genGrange(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(54), h=S(26), toitH=S(30);
  const SW=w+S(48), SH=h+toitH+S(8);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=(SW-w)>>1, cx=SW>>1;
  const p=AMB.pierre, bois=AMB.bois;
  const B=['#8a6a45','#6b5134','#a8845a','#4a3826'];
  const FOIN=['#d9bd6d','#c4a254','#a68841','#7f662d'];

  socle(c,x0-1,bas-S(5),w+2,S(5),p);
  /* --- bardage vertical, planches inégales --- */
  bardage(c,x0,bas-h,w,h,B);
  // lisses horizontales
  for(const f of [0.28,0.62]) {
    const y=bas-Math.round(h*f);
    fr(c,x0,y,w,Math.max(2,S(3)),B[1]); fr(c,x0,y,w,1,B[2]);
  }
  fr(c,x0-S(2),bas-h,w+S(4),Math.max(2,S(3)),B[0]);
  fr(c,x0-S(2),bas-h,w+S(4),1,B[2]);

  /* --- la porte charretière --- */
  const dw=Math.max(17,Math.round(w*0.42)), dx=cx-(dw>>1), dh=h-S(6);
  fr(c,dx-2,bas-dh-2,dw+4,dh+2,B[1]);
  const ouvert=chance(.55);
  if(ouvert){
    for(let j=0;j<dh;j++) fr(c,dx,bas-dh+j,dw,1, mix('#1a150f','#3e3427',Math.pow(j/Math.max(1,dh-1),0.6)));
    for(let k=0,n=RI(4,8);k<n;k++){                        // bottes empilées dans l'ombre
      const bx2=dx+RI(1,Math.max(2,dw-S(7))), by2=bas-RI(0,Math.round(dh*0.55));
      const bw2=Math.max(4,S(6)), bh2=Math.max(3,S(4));
      fr(c,bx2,by2-bh2,bw2,bh2,FOIN[2]);
      fr(c,bx2,by2-bh2,bw2,1,FOIN[1]);
      fr(c,bx2,by2-Math.round(bh2*0.5),bw2,1,FOIN[3]);
    }
    for(const s2 of [-1,1]){                               // vantaux repliés
      const vx=s2<0?dx-Math.max(4,S(6)):dx+dw;
      fr(c,vx,bas-dh-1,Math.max(4,S(6)),dh+1,'#7d5f3c');
      fr(c,vx,bas-dh-1,1,dh+1,'#a8845a');
      for(let j=S(3);j<dh;j+=S(7)) fr(c,vx,bas-dh-1+j,Math.max(4,S(6)),1,B[3]);
    }
  } else {
    for(let i=0;i<dw;i+=Math.max(2,S(3))) fr(c,dx+i,bas-dh,Math.max(2,S(3))-1,dh,(i/S(3))%2?'#7d5f3c':'#6b5134');
    for(const s2 of [0,1]){                                // ferrures en Z
      const a=dx+s2*(dw>>1), b2=a+(dw>>1);
      fr(c,a,bas-dh+S(3),(dw>>1),Math.max(2,S(2)),'#3d3f45');
      fr(c,a,bas-S(6),(dw>>1),Math.max(2,S(2)),'#3d3f45');
      trait(c,a+1,bas-S(6),b2-1,bas-dh+S(4),'#3d3f45',1);
      trait(c,a+2,bas-S(6),b2,bas-dh+S(4),'#2b2d33',1);
    }
    fr(c,dx+(dw>>1)-1,bas-Math.round(dh*0.5),3,Math.max(3,S(4)),'#5e626a');
  }
  fr(c,dx-S(3),bas-dh-Math.max(2,S(3)),dw+S(6),Math.max(2,S(3)),'#3d3f45');   // rail
  fr(c,dx-S(3),bas-dh-Math.max(2,S(3)),dw+S(6),1,'#6a6e77');

  /* --- toiture débordante et lucarne à foin --- */
  toitPignon(c,x0-S(9),bas-h-toitH,w+S(18),toitH,PAL.toits.ocre,'chaume');
  { const lw=Math.max(8,S(12)), ly=bas-h-Math.round(toitH*0.55);
    fr(c,cx-(lw>>1)-1,ly-1,lw+2,Math.max(7,S(11)),B[1]);
    fr(c,cx-(lw>>1),ly,lw,Math.max(6,S(10)),'#1d1710');
    for(let k=0,n=RI(6,11);k<n;k++){                      // le foin déborde
      const fx=cx-(lw>>1)+RI(-2,lw), fy=ly+Math.max(4,S(6))+RI(0,S(4));
      trait(c,fx,fy,fx+RI(-S(4),S(4)),fy+RI(S(2),S(6)),pick(FOIN),1);
    }
    fr(c,cx-S(5),ly-S(3),S(10),Math.max(2,S(3)),B[0]);    // potence
    fr(c,cx-S(5),ly-S(3),S(10),1,B[2]);
    sp.poulie={x:cx+S(3),y:ly-S(2),l:Math.round(h*0.6)}; }
  // girouette
  girouette(sp,c,cx+RI(-S(4),S(4)),bas-h-toitH-S(10),S(10),'#c9a24a');

  /* --- le char de foin et la fourche, dehors --- */
  { const cote3=chance(.5)?1:-1;
    const LC=S(15);
    const chx=cote3>0 ? x0+w+S(3) : x0-LC-S(4);
    if(chx>1&&chx+LC+S(2)<SW){
      fr(c,chx,bas-S(7),LC,Math.max(3,S(4)),B[0]);
      fr(c,chx,bas-S(7),LC,1,B[2]);
      disque(c,chx+S(3),bas-S(3),Math.max(3,S(4)),B[3]);
      disque(c,chx+S(3),bas-S(3),Math.max(1,S(2)),B[1]);
      disque(c,chx+LC-S(4),bas-S(3),Math.max(3,S(4)),B[3]);
      disque(c,chx+LC-S(4),bas-S(3),Math.max(1,S(2)),B[1]);
      for(let j=0;j<Math.max(5,S(8));j++){                 // le foin chargé, débordant
        const t=j/Math.max(1,S(8)-1);
        const wj=Math.round(LC*(1.10-0.35*t));
        fr(c,chx+((LC-wj)>>1),bas-S(7)-Math.max(5,S(8))+j,wj,1, j<2?FOIN[0]:((j%3)?FOIN[1]:FOIN[2]));
      }
      for(let k=0;k<S(7);k++){
        const fx=chx+RI(-2,LC), fy=bas-S(7)-Math.max(5,S(8))+RI(0,S(6));
        trait(c,fx,fy,fx+RI(-2,2),fy-RI(1,S(3)),FOIN[0],1);
      }
      trait(c,chx-S(3),bas-1,chx-S(4),bas-S(13),B[0],1);   // fourche plantée
      for(let i=-1;i<2;i++) fr(c,chx-S(4)+i*2,bas-S(16),1,Math.max(3,S(4)),'#8d9199');
      if(chance(.7)) chatDormi(c,chx+S(5),bas-S(7)-Math.max(5,S(8)),pick(PELAGES));
    } }
  for(let k=0;k<S(10);k++)                                 // foin épars au sol
    trait(c,x0+RI(-S(4),w+S(4)),bas-RI(0,2),x0+RI(-S(4),w+S(4)),bas-RI(0,2),pick(FOIN),1);
  chatteries(sp,c,x0,bas,w,h,row);
  brume(sp,row); return sp;
}
/* ---------- HALLE ----------
   Le marché couvert : une nef de charpente ouverte sur la rue, posée sur
   des piliers de pierre. Sous le toit, les étals — et l'étal à poissons,
   qui est la véritable institution du bourg. */
/* ---------- LA HALLE ----------
   Reprise à zéro. Une halle n'est pas un bâtiment mais un TOIT : quatre
   rangs de piliers, une charpente énorme, et rien d'autre — c'est le vide
   dessous qui fait le marché. Tout l'effort porte donc sur ce qu'on voit
   AU TRAVERS : les étals à banne rayée alignés en enfilade, les cageots
   de poisson et de légumes, la balance à fléau pendue à une ferme, les
   tonneaux, et l'ombre profonde du fond qui donne la profondeur.
   ---------------------------------------------------------------- */
function genHalle(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(64), h=S(22), toitH=S(19);
  const SW=w+S(16), SH=h+toitH+S(8);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=(SW-w)>>1, cx=SW>>1;
  const p=AMB.pierre, bois=AMB.bois;
  const B=['#8a6a45','#6b5134','#a8845a','#4a3826'];
  const toit=chance(.5)?'chaume':null, tuile=pick(AMB.toits);
  const rayures=['#b8465a','#3f6b8c','#4f8a63','#c48a3a','#6b4b8c'];

  // dalle et ombre profonde du fond
  for(let j=0;j<h;j++)
    fr(c,x0,bas-h+j,w,1, mix('#1d1913','#4a4034',Math.pow(j/Math.max(1,h-1),0.55)));
  for(let i=0;i<w;i+=S(6)) fr(c,x0+i,bas-S(4),S(6)-1,S(4), chance(.5)?'#5a5044':'#4a4136');
  fr(c,x0-S(3),bas-S(4),w+S(6),1,p[2]);

  /* --- étals en enfilade, sous leur banne rayée --- */
  const nE=Math.max(3,Math.round(w/S(17)));
  for(let k=0;k<nE;k++){
    const ew=Math.round((w-S(6))/nE)-S(2);
    const ex=x0+S(3)+k*Math.round((w-S(6))/nE);
    const ey=bas-S(6);
    // tréteaux + plateau
    fr(c,ex,ey-Math.max(2,S(3)),ew,Math.max(2,S(3)),B[0]);
    fr(c,ex,ey-Math.max(2,S(3)),ew,1,B[2]);
    fr(c,ex+1,ey,Math.max(2,S(2)),S(6),B[1]); fr(c,ex+ew-S(3),ey,Math.max(2,S(2)),S(6),B[1]);
    // marchandise
    for(let i=1;i<ew-2;i+=Math.max(3,S(4))){
      const t=rnd();
      if(t<0.4){ ellipse(c,ex+i+1,ey-Math.max(3,S(4)),Math.max(2,S(2)),Math.max(1,S(2)),pick(['#c4633f','#7d9b45','#b09a3a','#8c4f6b']));
      } else if(t<0.7){ fr(c,ex+i,ey-Math.max(4,S(6)),Math.max(3,S(5)),Math.max(2,S(3)),'#8a9aa8');   // poissons
                        fr(c,ex+i,ey-Math.max(4,S(6)),Math.max(3,S(5)),1,'#b3c0cb');
                        fr(c,ex+i+Math.max(3,S(5)),ey-Math.max(4,S(6))+1,1,1,'#8a9aa8');
      } else { fr(c,ex+i,ey-Math.max(4,S(6)),Math.max(3,S(4)),Math.max(3,S(4)),'#b39a63'); }
    }
    // banne rayée
    const bc=rayures[k%rayures.length], bh2=Math.max(3,S(5));
    for(let i=0;i<ew+S(4);i++)
      fr(c,ex-S(2)+i,bas-h+S(6)+Math.round(Math.sin(i*0.5)*0.6),1,bh2, ((i/Math.max(2,S(3)))|0)%2?bc:'#e4dcc6');
    fr(c,ex-S(2),bas-h+S(6)+bh2,ew+S(4),1,ombre(bc,.4));
    fr(c,ex-S(2),bas-h+S(6)-1,ew+S(4),1,B[1]);
    if(chance(.55)) chatAssis(c,ex+RI(2,Math.max(3,ew-6)),ey-Math.max(2,S(3)),pick(PELAGES),chance(.5)?1:-1);
  }
  // tonneaux et cageots au fond
  for(let k=0,n=RI(2,5);k<n;k++){
    const tx=x0+RI(S(3),Math.max(S(4),w-S(9)));
    fr(c,tx,bas-S(9),Math.max(4,S(6)),Math.max(4,S(6)),'#6a4c31');
    fr(c,tx,bas-S(8),Math.max(4,S(6)),1,'#a8845a');
    fr(c,tx,bas-S(6),Math.max(4,S(6)),1,'#a8845a');
  }

  /* --- piliers de pierre et charpente --- */
  const nP=Math.max(4,Math.round(w/S(16)));
  for(let k=0;k<=nP;k++){
    const px2=Math.round(x0+k*(w/nP))-S(2);
    const pw=Math.max(4,S(6));
    mur(c,px2,bas-h,pw,h-S(2),p);
    fr(c,px2-1,bas-h,pw+2,Math.max(2,S(3)),p[0]);          // chapiteau
    fr(c,px2-1,bas-h,pw+2,1,clair(p[0],.24));
    fr(c,px2-1,bas-S(3),pw+2,Math.max(2,S(3)),p[2]);       // base
    // poteau de bois sur le pilier + aisseliers
    fr(c,px2+1,bas-h-S(5),Math.max(2,S(3)),S(5),B[0]);
    fr(c,px2+1,bas-h-S(5),1,S(5),B[2]);
    if(k>0){ trait(c,px2+1,bas-h-S(2),px2-S(6),bas-h-S(5),B[1],1); }
    if(k<nP){ trait(c,px2+S(3),bas-h-S(2),px2+S(9),bas-h-S(5),B[1],1); }
  }
  fr(c,x0-S(4),bas-h-S(6),w+S(8),Math.max(3,S(4)),B[0]);   // sablière maîtresse
  fr(c,x0-S(4),bas-h-S(6),w+S(8),1,B[2]);
  fr(c,x0-S(4),bas-h-S(6)+Math.max(3,S(4))-1,w+S(8),1,B[3]);
  // balance à fléau pendue
  { const bx2=cx+RI(-S(12),S(12));
    trait(c,bx2,bas-h-S(6),bx2,bas-h-S(1),'#3d3f45',1);
    fr(c,bx2-Math.max(3,S(5)),bas-h-S(1),Math.max(7,S(10)),1,'#5e626a');
    for(const s2 of [-1,1]){
      const px3=bx2+s2*Math.max(3,S(5));
      trait(c,px3,bas-h-S(1),px3,bas-h+S(2),'#5e626a',1);
      ellipse(c,px3,bas-h+S(3),Math.max(2,S(3)),Math.max(1,S(2)),'#8d9199');
    } }
  if(toit==='chaume') toitTrapeze(c,x0-S(8),bas-h-S(6)-toitH,w+S(16),toitH,PAL.toits.ocre,'chaume');
  else                toitTrapeze(c,x0-S(8),bas-h-S(6)-toitH,w+S(16),toitH,tuile);
  lanternePotence(sp,c,x0+S(3),bas-h-S(8),bois);
  lanternePotence(sp,c,x0+w-S(3),bas-h-S(8),bois);
  brume(sp,row); return sp;
}
/* ---------- FORGE ----------
   L'antre du maréchal : pierre noircie, arcade ouverte sur le foyer,
   enclume et hotte. On y ferre les mules — et on y fabrique les colliers
   à grelot, la spécialité locale. */
/* ---------- LA FORGE ----------
   Reprise à zéro. Une forge de village n'a pas de façade : elle est
   OUVERTE sur la rue, parce qu'il faut évacuer la chaleur et parce que
   le client regarde travailler. Tout le dessin consiste donc à montrer un
   INTÉRIEUR : mur du fond en moellons noircis, râtelier d'outils accroché,
   foyer sous sa hotte de pierre avec le soufflet et son levier, bac à
   tremper qui fume, enclume sur son billot au premier plan, bois fendu et
   fers en tas. La charpente reste apparente au-dessus du linteau, et le
   toit d'ardoise vient poser une ombre franche sur toute la scène.
   ---------------------------------------------------------------- */
function genForge(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(52), hh=S(26), gab=S(11), toitH=S(20), chemH=S(16);
  const SW=w+S(28), SH=hh+gab+toitH+chemH+S(6);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const p=AMB.pierre, bois=AMB.bois, briq=pick(PAL.brique);
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const FER='#3d3f45', FERC='#6a6e77';
  const toit=PAL.toits.ardoise;
  const cote=chance(.5)?1:-1;                       // foyer à droite (1) ou à gauche

  /* --- 1. le fond : mur de moellons noirci par le feu --- */
  const oy=bas-hh+S(3);                             // niveau du sol de l'atelier
  mur(c,x0,bas-hh,w,hh,p);
  fr(c,x0,bas-hh,w,hh,'rgba(24,18,14,.30)');        // suie générale
  // jambages de pierre : ce qui reste plein de la façade
  const jam=Math.max(4,S(7));
  mur(c,x0,bas-hh,jam,hh,p); mur(c,x0+w-jam,bas-hh,jam,hh,p);

  /* --- 2. la baie ouverte : on plonge dans l'atelier --- */
  const bw=w-2*jam, bx=x0+jam, bh=hh-S(5);
  for(let j=0;j<bh;j++){
    const t=j/Math.max(1,bh-1);
    fr(c,bx,bas-bh+j,bw,1, mix('#241d16','#4e4132',Math.pow(t,0.65)));
  }
  fr(c,bx,bas-bh,bw,Math.max(2,S(3)),'#15110c');    // le haut reste dans le noir
  // sol de l'atelier
  for(let i=0;i<bw;i+=S(5)) fr(c,bx+i,bas-S(4),S(5)-1,S(4), chance(.5)?'#4a4034':'#3c3329');

  /* --- 3. le foyer sous sa hotte, le soufflet --- */
  const fW=Math.max(11,S(16));
  const fx=cote>0 ? bx+bw-fW-S(2) : bx+S(2);
  { // hotte : tronc de pyramide de pierre qui monte vers la cheminée
    const hHt=Math.max(7,S(11));
    for(let j=0;j<hHt;j++){
      const t=j/hHt;
      const wj=Math.round(fW*(1-0.45*t)), xj=fx+Math.round((fW-wj)*(cote>0?1:0));
      fr(c,xj,bas-bh+S(2)+j,wj,1, (j%3)===2?p[3]:p[2]);
      fr(c,xj,bas-bh+S(2)+j,1,1,p[1]);
    }
    fr(c,fx-1,bas-bh+S(2),fW+2,Math.max(2,S(3)),p[1]);
    fr(c,fx-1,bas-bh+S(2),fW+2,1,clair(p[0],.18));
  }
  { // l'âtre : plateforme de brique, charbon ardent, fers dans le feu
    const ah=Math.max(6,S(9)), ay=bas-S(4)-ah;
    futBrique(c,ay,ah,()=>[fx,fW],briq,false);
    const gw=Math.max(6,fW-S(4)), gx=fx+((fW-gw)>>1), gh=Math.max(4,S(7));
    for(let j=0;j<gh;j++){
      const t=j/Math.max(1,gh-1);
      fr(c,gx,ay-gh+j+2,gw,1, mix('#6b2408', t>0.35?'#ffb040':'#c2480e',Math.pow(t,1.1)));
    }
    for(let i=0;i<gw;i++) if(chance(.5))
      fr(c,gx+i,ay+1-RI(0,2),1,1,pick(['#ffe6a8','#ffb04a','#ff6a1a']));
    for(let k=0;k<RI(1,3);k++){                     // barres de fer chauffant
      const rx=gx+RI(0,Math.max(1,gw-4));
      fr(c,rx,ay-1,Math.max(3,S(5)),1,'#ff8a2a'); fr(c,rx+Math.max(3,S(5)),ay-1,S(5),1,FER);
    }
    sp.brasier={x:gx+(gw>>1),y:ay-1,r:S(13),c:'#ff8a2a'};
    sp.lampes.push({x:gx+(gw>>1),y:ay-1,c:'#ff7a2a',r:S(18)});
    // soufflet et son levier, contre le mur
    const sx=cote>0 ? fx+fW+1 : fx-Math.max(5,S(8))-1;
    if(sx>bx&&sx<bx+bw-3){
      const sw2=Math.max(5,S(8)), shh=Math.max(4,S(6));
      for(let j=0;j<shh;j++){
        const t=Math.abs(j/(shh-1)-0.5)*2;
        const wj=Math.round(sw2*(1-0.35*t));
        fr(c,sx+((sw2-wj)>>1),ay-shh+j,wj,1, j<2?'#8a6a45':'#5c4128');
      }
      fr(c,sx,ay-shh-1,sw2,1,'#3a2a1b');
      trait(c,sx+(cote>0?sw2:0),ay-shh-1,sx+(cote>0?sw2+S(5):-S(5)),ay-shh-S(5),B[0],1);
      fr(c,sx+(cote>0?sw2-1:0),ay-Math.round(shh*0.5),Math.max(2,S(4)),1,FER);
    }
  }

  /* --- 4. le mur du fond équipé : râtelier, bac à tremper, bois --- */
  { const rx=cote>0 ? bx+S(3) : bx+bw-S(14);
    fr(c,rx,bas-bh+S(6),Math.max(8,S(12)),Math.max(2,S(3)),B[1]);
    fr(c,rx,bas-bh+S(6),Math.max(8,S(12)),1,B[2]);
    for(let i=1;i<S(12);i+=Math.max(2,S(3))){       // marteaux, tenailles, tranches
      const l=RI(S(4),S(9));
      fr(c,rx+i,bas-bh+S(6)+S(3),1,l,B[1]);
      if(chance(.5)){ fr(c,rx+i-1,bas-bh+S(6)+S(3)+l,3,Math.max(2,S(3)),FER);
                      fr(c,rx+i-1,bas-bh+S(6)+S(3)+l,3,1,FERC); }
      else { fr(c,rx+i-1,bas-bh+S(6)+S(3)+l-1,1,Math.max(2,S(3)),FER);
             fr(c,rx+i+1,bas-bh+S(6)+S(3)+l-1,1,Math.max(2,S(3)),FER); }
    } }
  { const qx=cote>0 ? bx+S(4) : bx+bw-S(12);        // bac à tremper, il fume
    const qw=Math.max(6,S(9)), qh=Math.max(5,S(7));
    fr(c,qx,bas-S(3)-qh,qw,qh,'#5c4128');
    fr(c,qx,bas-S(3)-qh,qw,1,'#8a6a45');
    fr(c,qx,bas-S(3)-qh+2,qw,1,FER); fr(c,qx,bas-S(4),qw,1,FER);
    fr(c,qx+1,bas-S(3)-qh+1,qw-2,1,'#3f5a63');
    sp.fumees.push({x:qx+(qw>>1),y:bas-S(4)-qh,t:3,d:0.5}); }
  { const lx=cote>0 ? bx+bw-S(9) : bx+S(3);         // bois fendu empilé
    for(let k=0,n=RI(4,7);k<n;k++){
      const lxx=lx+RI(0,S(6)), lyy=bas-S(4)-RI(0,S(5));
      disque(c,lxx,lyy,Math.max(1,S(2)),'#7d5a37');
      disque(c,lxx,lyy,Math.max(1,S(2)-1),'#a9855a');
      fr(c,lxx-1,lyy-1,1,1,'#5a412a');
    } }

  /* --- 5. l'enclume au premier plan, sur son billot --- */
  { const ax=cx+(cote>0?-1:1)*Math.round(bw*0.18), ah2=Math.max(4,S(6));
    fr(c,ax-Math.max(3,S(5)),bas-ah2,Math.max(6,S(9)),ah2,'#6d5236');   // billot
    fr(c,ax-Math.max(3,S(5)),bas-ah2,Math.max(6,S(9)),1,'#8f6f4a');
    for(let i=0;i<S(9);i+=2) fr(c,ax-S(5)+i,bas-ah2+1,1,ah2-1,'#5a4229');
    const ew=Math.max(8,S(12));
    fr(c,ax-(ew>>1),bas-ah2-Math.max(3,S(4)),ew,Math.max(3,S(4)),FER);  // table
    fr(c,ax-(ew>>1),bas-ah2-Math.max(3,S(4)),ew,1,FERC);
    fr(c,ax-(ew>>1)+S(2),bas-ah2-Math.max(5,S(7)),Math.max(4,S(6)),Math.max(2,S(3)),FER);
    fr(c,ax+(ew>>1)-1,bas-ah2-Math.max(4,S(5)),Math.max(2,S(4)),Math.max(2,S(3)),FER); // corne
    fr(c,ax-(ew>>1)+S(2),bas-ah2-Math.max(5,S(7)),Math.max(4,S(6)),1,FERC);
    if(chance(.7)){ fr(c,ax-1,bas-ah2-Math.max(6,S(8)),Math.max(4,S(6)),1,'#ff9a2a'); } }

  /* --- 6. linteau, pan de bois du pignon, couverture --- */
  fr(c,x0-S(2),bas-hh-Math.max(3,S(4)),w+S(4),Math.max(3,S(4)),B[0]);
  fr(c,x0-S(2),bas-hh-Math.max(3,S(4)),w+S(4),1,B[2]);
  fr(c,x0-S(2),bas-hh-1,w+S(4),1,B[3]);
  for(let i=S(4);i<w;i+=S(9)) fr(c,x0+i,bas-hh-Math.max(5,S(7)),Math.max(2,S(3)),Math.max(3,S(4)),B[1]);
  colombage(c,x0-S(2),bas-hh-Math.max(3,S(4))-gab,w+S(4),gab,pick(['#c9bda0','#bfae90']),bois,'croix');
  toitPignon(c,x0-S(6),bas-hh-Math.max(3,S(4))-gab-toitH,w+S(12),toitH,toit);

  /* --- 7. la cheminée, au droit du foyer --- */
  { const cw2=Math.max(6,S(9));
    const cxx=fx+((fW-cw2)>>1);
    const cTop=bas-hh-Math.max(3,S(4))-gab-toitH+Math.round(toitH*0.25)-chemH;
    const cBot=bas-hh-Math.max(3,S(4))-gab-Math.round(toitH*0.1);
    futBrique(c,cTop,cBot-cTop,()=>[cxx,cw2],p,true);
    fr(c,cxx-2,cTop,cw2+4,Math.max(2,S(3)),p[1]);
    fr(c,cxx-2,cTop,cw2+4,1,clair(p[0],.22));
    sp.fumees.push({x:cxx+(cw2>>1),y:cTop-1,t:1,d:1.7});
    sp.fumees.push({x:cxx+(cw2>>1)-1,y:cTop-1,t:13,d:1.0}); }

  /* --- 8. enseigne au fer à cheval, lanterne, chat --- */
  { const ew=Math.max(9,S(12)), eh=Math.max(6,S(8));
    const ex=cote>0 ? x0-S(2) : x0+w-ew+S(2);
    fr(c,ex-1,bas-hh+S(4),ew+2,1,B[3]);
    fr(c,ex+(ew>>1),bas-hh+S(4),1,Math.max(2,S(3)),B[3]);
    fr(c,ex,bas-hh+S(7),ew,eh,'#2f2a26');
    fr(c,ex,bas-hh+S(7),ew,1,'#4a423a');
    { const gx2=ex+(ew>>1), gy2=bas-hh+S(7)+Math.round(eh*0.55), rq=Math.max(2,Math.round(eh*0.30));
      for(let a=0;a<10;a++){ const an=Math.PI+a/9*Math.PI;      // fer à cheval
        fr(c,gx2+Math.round(Math.cos(an)*rq),gy2+Math.round(Math.sin(an)*rq),1,1,'#c9c3b4'); }
      fr(c,gx2-rq,gy2,1,2,'#c9c3b4'); fr(c,gx2+rq,gy2,1,2,'#c9c3b4'); }
    sp.enseigne={x:ex+(ew>>1),y:bas-hh+S(8),w:ew,h:eh}; }
  lanternePotence(sp,c,cote>0?x0+w-S(3):x0+S(3),bas-hh+S(3),bois);
  if(chance(.75)) chatDormi(c,cote>0?bx+S(6):bx+bw-S(10),bas-S(4),pick(PELAGES));
  chatteries(sp,c,x0,bas,w,hh,row);
  brume(sp,row); return sp;
}
/* ---------- MOULIN À VENT ----------
   La tour du meunier : fût tronconique de pierre, galerie de bois,
   calotte de bardeaux et quatre ailes toilières. Le chat du meunier dort
   sur les sacs, au chaud dans la farine. */
/* ---------- LE MOULIN À VENT ----------
   Repris à zéro. Le fût tronconique était juste, mais tout ce qui fait un
   moulin manquait : la CALOTTE doit être orientable — donc coiffer le fût
   sans y adhérer, sur son chemin de roulement, avec la QUEUE qui descend
   jusqu'au sol et le treuil qui permet de la tourner face au vent. Il faut
   aussi la galerie qui ceinture le fût à mi-hauteur pour atteindre les
   ailes, l'échelle qui y mène, la porte charretière au pied pour les sacs,
   et l'arbre moteur qui sort de la calotte : c'est lui qui porte les ailes,
   et son inclinaison dit dans quel sens tourne la machine.
   ---------------------------------------------------------------- */
function genMoulin(row){
  const S=v=>Math.max(1,sc(row,v));
  const bw=S(28), bh=S(56), capH=S(16);
  const SW=bw+S(40), SH=bh+capH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const cx=SW>>1, bas=SH-1;
  const p=AMB.pierre, bois=AMB.bois;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const lg=x=>Math.max(S(12),Math.round(bw*(1-0.30*x)));   // x : 0 en bas, 1 en haut

  // tertre : un moulin est toujours perché, pour prendre le vent
  for(let i=-S(14);i<bw+S(14);i++){
    const t=Math.abs(i-bw/2)/(bw/2+S(14));
    const hh=Math.round(S(5)*(1-t*t));
    if(hh>0) for(let j=0;j<hh;j++)
      fr(c,cx-(bw>>1)+i,bas-j,1,1, j>hh-2?'#6d8b4a':(j%2?'#5d7a3f':'#537035'));
  }
  const sol=bas-S(3);

  /* --- le fût, appareillé, avec ses ouvertures superposées --- */
  for(let j=0;j<bh;j++){
    const t=j/bh, wj=lg(t), x0=cx-(wj>>1), y=sol-j;
    fr(c,x0,y,wj,1, (j%3)===2?p[3]:p[1]);
    if(j%3===0) for(let i=((j/3)|0)%2?2:0;i<wj;i+=5) fr(c,x0+i,y,1,1,p[3]);
    fr(c,x0,y,1,1,clair(p[0],.22));
    fr(c,x0+wj-1,y,1,1,ombre(p[3],.30));
    if(NTILE){ const n=NT2(x0+j,j*2); if(n<0.22) fr(c,x0+RI(1,Math.max(2,wj-2)),y,1,1,ombre(p[2],.18)); }
  }
  socle(c,cx-(lg(0)>>1)-1,sol-S(4),lg(0)+2,S(4),p);
  // porte charretière au pied
  { const dw=Math.max(7,S(10));
    porte(c,cx-(dw>>1),sol-S(15),dw,S(15),B,true);
    fr(c,cx-(dw>>1)-2,sol-S(16),dw+4,S(2),p[0]);
    fr(c,cx-(dw>>1)-2,sol-S(16),dw+4,1,clair(p[0],.24)); }
  // lucarnes superposées, décalées : elles éclairent chaque plancher
  for(let k=0;k<3;k++){
    const t=0.30+k*0.20, y=sol-Math.round(bh*t);
    const dec=(k%2?1:-1)*Math.round(bw*0.16);
    fenetre(sp,c,cx+dec-S(3),y,Math.max(3,S(5)),Math.max(4,S(6)),bois,pick(PAL.volets),
            {arc:true,on:chance(.6)});
  }

  /* --- la galerie qui ceinture le fût, et son échelle --- */
  const gy=sol-Math.round(bh*0.44);
  { const gw=lg(0.44)+S(8);
    for(let i=0;i<gw;i+=Math.max(3,S(4))){                   // corbeaux
      fr(c,cx-(gw>>1)+i,gy+1,Math.max(2,S(2)),Math.max(3,S(4)),B[1]);
      fr(c,cx-(gw>>1)+i,gy+1,1,Math.max(3,S(4)),B[2]);
    }
    fr(c,cx-(gw>>1),gy-1,gw,Math.max(3,S(3)),B[0]);          // plancher
    fr(c,cx-(gw>>1),gy-1,gw,1,B[2]);
    fr(c,cx-(gw>>1),gy+Math.max(2,S(3))-1,gw,1,B[3]);
    const gh=Math.max(5,S(7));                                // garde-corps
    fr(c,cx-(gw>>1),gy-1-gh,gw,Math.max(2,S(2)),B[1]);
    fr(c,cx-(gw>>1),gy-1-gh,gw,1,B[2]);
    for(let i=0;i<gw;i+=Math.max(3,S(3))) fr(c,cx-(gw>>1)+i,gy-1-gh,1,gh,B[1]);
    // sacs entreposés sur la galerie
    for(let k=0,n=RI(1,3);k<n;k++){
      const sx=cx-(gw>>1)+RI(S(3),Math.max(S(4),gw-S(6))), sw2=Math.max(3,S(4)), sh2=Math.round(sw2*1.2);
      for(let j=0;j<sh2;j++){
        const t2=j/Math.max(1,sh2-1);
        const wj=Math.max(2,Math.round(sw2*(0.55+0.45*Math.sin(Math.PI*Math.min(1,t2*1.15)))));
        fr(c,sx+((sw2-wj)>>1),gy-1-j,wj,1, t2<0.35?'#a89b7c':'#cbbfa0');
      }
    }
    // échelle depuis le tertre
    const lx=cx+(lg(0)>>1)+S(2);
    trait(c,lx,sol,lx-S(2),gy,B[0],1);
    trait(c,lx+S(3),sol,lx+S(1),gy,B[0],1);
    for(let j=0;j<S(11);j++){
      const t2=j/S(11), yy=Math.round(sol-t2*(sol-gy));
      fr(c,Math.round(lx-t2*S(2)),yy,Math.max(3,S(4)),1,B[1]);
    } }

  /* --- LA CALOTTE ORIENTABLE, sa queue et son treuil --- */
  const cy=sol-bh;
  const cw=lg(1)+S(4);
  fr(c,cx-(cw>>1),cy-1,cw,Math.max(2,S(3)),p[0]);            // chemin de roulement
  fr(c,cx-(cw>>1),cy-1,cw,1,clair(p[0],.26));
  fr(c,cx-(cw>>1),cy+Math.max(2,S(3))-1,cw,1,'rgba(12,16,24,.34)');
  { const toit=chance(.5)?'bardeau':MATCOUR;                  // toiture de la calotte
    const cH=capH;
    for(let j=0;j<cH;j++){
      const t=j/Math.max(1,cH-1);
      const wj=Math.max(3,Math.round(cw*(0.20+0.80*Math.pow(t,0.62))));
      const x0=cx-(wj>>1), y=cy-cH+j;
      _rang(c,x0,y,wj,pick([PAL.toits.ardoise,PAL.toits.vert,PAL.toits.tuileB]),(j/3)|0,toit);
    }
    fr(c,cx-(cw>>1)-1,cy-1,cw+2,Math.max(2,S(2)),B[0]);
    fr(c,cx-(cw>>1)-1,cy-1,cw+2,1,B[2]); }
  // queue d'orientation : elle descend jusqu'au sol, avec sa roue de treuil
  { const sQ=chance(.5)?1:-1;
    const qx0=cx+sQ*Math.round(cw*0.30), qy0=cy-Math.round(capH*0.30);
    const qx1=cx+sQ*Math.round(bw*0.92), qy1=sol-S(3);
    trait(c,qx0,qy0,qx1,qy1,B[0],Math.max(1,S(2)));
    trait(c,qx0+sQ,qy0+1,qx1+sQ,qy1,B[1],1);
    trait(c,cx+sQ*Math.round(cw*0.12),cy-Math.round(capH*0.10),
            Math.round((qx0+qx1)/2),Math.round((qy0+qy1)/2),B[1],1);   // écharpe
    const rw=Math.max(3,S(5));                                          // roue de treuil
    disque(c,qx1,qy1-rw,rw,B[1]);
    disque(c,qx1,qy1-rw,Math.max(1,rw-1),B[0]);
    for(let a=0;a<6;a++){ const an=a/6*6.28;
      trait(c,qx1,qy1-rw,qx1+Math.cos(an)*rw,qy1-rw+Math.sin(an)*rw,B[3],1); }
    fr(c,qx1-1,qy1-1,3,2,B[3]);
    for(let k=0;k<4;k++)                                                // pieux d'amarrage
      fr(c,cx+sQ*Math.round(bw*(0.55+k*0.18)),sol-S(4),Math.max(2,S(2)),S(4),B[1]); }
  // arbre moteur incliné qui sort de la calotte : il porte les ailes
  const ax=cx-Math.round(cw*0.18), ay=cy-Math.round(capH*0.55);
  { fr(c,ax-S(4),ay-1,S(6),Math.max(3,S(4)),B[1]);
    fr(c,ax-S(4),ay-1,S(6),1,B[2]);
    disque(c,ax-S(3),ay+1,Math.max(2,S(3)),'#3d3f45');
    disque(c,ax-S(3),ay+1,Math.max(1,S(2)),'#6a6e77'); }
  sp.moulin={x:ax-S(3),y:ay+1,r:Math.round(bw*1.10),n:4,v:R(.45,.75)*(chance(.5)?1:-1)};
  sp.fumees.push({x:cx,y:cy-capH-2,t:0,d:0.25});

  // meules, charrette et sacs au pied
  { const mx=cx-Math.round(bw*0.78), rm=Math.max(3,S(6));
    if(mx>rm){
      fr(c,mx-rm,sol-1,2*rm,2,'rgba(10,14,20,.30)');
      disque(c,mx,sol-rm,rm,p[2]); disque(c,mx,sol-rm,Math.max(2,rm-1),p[1]);
      disque(c,mx,sol-rm,Math.max(1,Math.round(rm*0.28)),p[3]);
      for(let a=0;a<8;a++){ const an=a/8*6.28+0.3;
        trait(c,mx+Math.cos(an)*rm*0.42,sol-rm+Math.sin(an)*rm*0.42,
                mx+Math.cos(an)*rm*0.80,sol-rm+Math.sin(an)*rm*0.80,ombre(p[2],.18),1); } } }
  if(chance(.8)) chatAssis(c,cx+RI(-Math.round(bw*0.4),Math.round(bw*0.4)),sol,pick(PELAGES),chance(.5)?1:-1);
  lanternePotence(sp,c,cx+(lg(0)>>1)-S(2),sol-S(19),bois);
  brume(sp,row); return sp;
}
/* ---------- MOULIN À EAU ----------
   Il enjambe la berge : pilotis dans le courant, roue à aubes coupée par
   la nappe d'eau, coursier de bois. On y pêche par la trappe du plancher —
   avantage décisif quand le meunier est un chat. */
/* ---------- LE MOULIN À EAU ----------
   Repris à zéro. Un moulin à eau ne se résume pas à une roue collée sur
   une maison : c'est un OUVRAGE HYDRAULIQUE dont le bâtiment n'est que
   l'abri. On dessine donc d'abord la machine — le mur de soutènement, la
   voûte du canal de fuite, les deux piles qui portent l'axe, le coursier
   de bois qui amène l'eau par le haut, la vanne et sa crémaillère — puis
   on pose le logis dessus. La roue est en dessus (l'eau tombe sur le
   sommet), c'est ce qui justifie le coursier perché et la lame d'eau qui
   se détache dans le vide : sans elle la roue tournerait sans raison. */
function genMoulinEau(){
  const row=3, S=v=>Math.max(1,sc(row,v));
  const w=S(52), sh=S(15), fh=S(19), toitH=S(23);
  const rr=S(21);
  const cote=chance(.5)?1:-1;                       // roue à droite (1) ou à gauche
  const quai=S(13);
  const SW=w+rr*2+S(30), SH=quai+sh+fh+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1;
  const bois=AMB.bois, p=AMB.pierre, platre=pick(PAL.platre);
  const toit=chance(.55)?'chaume':null;
  const tuile=pick(AMB.toits);
  const x0=Math.round(SW/2-cote*(rr*0.9)-w/2);
  const cx=x0+(w>>1);

  /* --- 1. le mur de soutènement et la voûte du canal de fuite --- */
  socle(c,0,bas-quai,SW,quai,p);
  {
    const aw=Math.max(11,S(17)), ax=x0+Math.round(w*0.5)-(aw>>1);
    const ah=Math.round(quai*0.72);
    for(let j=0;j<ah;j++){                          // intrados
      let wj=aw, xj=ax; const r2=aw>>1;
      if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj=aw-2*d; xj=ax+d; }
      fr(c,xj,bas-ah+j,wj,1, j<r2?'#1e2a31':mix('#1e2a31','#2f4a58',(j-r2)/Math.max(1,ah-r2)));
    }
    for(let j=0;j<(aw>>1);j++){                     // claveaux
      const r2=aw>>1, d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j))));
      if(d>0){ fr(c,ax-1,bas-ah+j,d+1,1,p[0]); fr(c,ax+aw-d-1,bas-ah+j,d+1,1,p[0]);
               fr(c,ax-1,bas-ah+j,1,1,p[3]); }
    }
    for(let i=0;i<aw;i+=2) if(chance(.6)) fr(c,ax+i,bas-2,2,2,'#3c6b83');   // eau qui sort
    for(let i=0;i<SW;i+=RI(3,8)) if(chance(.5))                             // mousse au ras de l'eau
      fr(c,i,bas-RI(1,3),RI(2,4),1,mix(p[2],'#4e6b3a',.6));
  }

  /* --- 2. le logis : pierre au rez, pan de bois à l'étage, chaume --- */
  mur(c,x0,bas-quai-sh,w,sh,p);
  colombage(c,x0-S(2),bas-quai-sh-fh,w+S(4),fh,platre,bois,'croix');
  if(toit==='chaume') toitPignon(c,x0-S(5),bas-quai-sh-fh-toitH,w+S(10),toitH,PAL.toits.ocre,'chaume');
  else                toitPignon(c,x0-S(5),bas-quai-sh-fh-toitH,w+S(10),toitH,tuile);
  // porte du moulin, côté opposé à la roue
  { const dw=Math.max(6,S(9)), dx=cote>0?x0+S(4):x0+w-dw-S(4);
    porte(c,dx,bas-quai-sh+S(3),dw,sh-S(3),bois,true);
    chatiere(c,dx+(dw>>1),bas-quai,Math.max(4,S(6)),bois);
    lanternePotence(sp,c,dx+(cote>0?dw+S(4):-S(4)),bas-quai-sh+S(1),bois); }
  // fenêtres de l'étage
  for(let k=0;k<2;k++)
    fenetre(sp,c,x0+S(5)+k*Math.round((w-S(14))),bas-quai-sh-fh+S(5),
            Math.max(4,S(7)),Math.max(5,S(9)),bois,pick(PAL.volets),{volets:true,jardiniere:chance(.5)});
  // lucarne de chargement sous le pignon, avec sa poulie et son sac
  { const lw=Math.max(6,S(9)), ly=bas-quai-sh-fh-Math.round(toitH*0.62);
    fr(c,cx-(lw>>1)-1,ly-1,lw+2,Math.round(toitH*0.34)+2,bois[1]);
    fr(c,cx-(lw>>1),ly,lw,Math.round(toitH*0.34),'#1d1710');
    fr(c,cx-(lw>>1),ly,lw,1,'#120e08');
    for(const s3 of [-1,1]){                            // vantaux rabattus
      const vx2=s3<0?cx-(lw>>1)-2:cx+(lw>>1);
      fr(c,vx2,ly-1,2,Math.round(toitH*0.34)+1,bois[2]);
      fr(c,vx2,ly-1,1,Math.round(toitH*0.34)+1,clair(bois[2],.22));
      fr(c,vx2,ly+Math.round(toitH*0.17),2,1,bois[1]);
    }
    fr(c,cx-S(5),ly-S(3),S(10),S(2),bois[2]);                    // potence
    fr(c,cx-S(5),ly-S(3),S(10),1,clair(bois[2],.2));
    sp.poulie={x:cx+S(3),y:ly-S(2),l:Math.round((sh+fh)*0.55)}; }

  /* --- 3. LA MACHINE : piles, axe, coursier, vanne --- */
  const wx=cote>0 ? x0+w+Math.round(rr*0.86) : x0-Math.round(rr*0.86);
  const wy=bas-quai+Math.round(rr*0.30);
  // deux piles de pierre encadrant la roue
  /* plus de portique de pierre : la roue respire, seul reste le palier de
     l'axe scellé au mur et une chandelle de bois discrète côté rivière */
  { const px2=wx-cote*(rr+S(2));
    if(px2>1&&px2<SW-2){ fr(c,px2,wy,Math.max(2,S(2)),bas-2-wy,'#5a4128');
      fr(c,px2,wy,1,bas-2-wy,'#7d5f3c'); } }
  fr(c,wx-2,wy-2,5,5,'#3a3a40'); fr(c,wx-1,wy-1,3,3,'#5c5f66');  // palier de l'axe
  // coursier : caisson de bois en pente qui amène l'eau au sommet de la roue
  const lipx = wx - cote*Math.round(rr*0.34);
  const lipy = wy - rr - S(4);
  { const dep = cote>0 ? x0+w-S(2) : x0+S(2);
    const n=Math.abs(lipx-dep);
    for(let i=0;i<=n;i++){
      const t=i/Math.max(1,n);
      const xx=Math.round(dep+(lipx-dep)*t);
      const yy=Math.round((bas-quai-sh+S(2))+((lipy-S(1))-(bas-quai-sh+S(2)))*t);
      fr(c,xx,yy,1,S(5),bois[2]);
      fr(c,xx,yy,1,1,clair(bois[2],.22));
      fr(c,xx,yy+S(2),1,1,'#3c6b83');                            // l'eau dans le coursier
      fr(c,xx,yy+S(5)-1,1,1,bois[3]);
      if(i%Math.max(3,S(5))===0) fr(c,xx,yy+S(5),1,S(4),bois[1]); // chandelles de support
    }
    // vanne et sa crémaillère au départ du coursier
    fr(c,dep-1,bas-quai-sh-S(2),3,S(8),bois[1]);
    fr(c,dep-2,bas-quai-sh-S(4),5,2,'#4e5259');
    for(let j=0;j<S(6);j+=2) fr(c,dep+(cote>0?2:-2),bas-quai-sh-S(2)+j,1,1,'#6d7178'); }
  sp.roue={x:wx,y:wy,r:rr,v:R(.55,.85)*cote,n:RI(10,14),
           chute:{x:lipx,y:lipy+S(4)}};

  /* --- 4. la vie autour : sacs, meule, barque, chat pêcheur --- */
  { const sx=cote>0?x0+S(3):x0+w-S(14);
    for(let k=0,n=RI(2,4);k<n;k++){
      const bx2=sx+RI(-S(3),S(9)), by2=bas-quai-RI(0,S(1)), sw2=Math.max(3,Math.round(S(6)*0.62));
      const sh2=Math.round(sw2*1.25);
      for(let j=0;j<sh2;j++){                         // sac bombé, col froncé
        const t=j/Math.max(1,sh2-1);
        const wj=Math.max(2,Math.round(sw2*(0.55+0.45*Math.sin(Math.PI*Math.min(1,t*1.15)))));
        fr(c,bx2+((sw2-wj)>>1),by2-sh2+j,wj,1, t<0.35?'#d9cfae':(t>0.8?'#a89b7c':'#cbbfa0'));
      }
      fr(c,bx2+(sw2>>1)-1,by2-sh2,2,1,'#8f8264');
    } }
  { const rm=Math.max(3,S(6));                        // meule appuyée au mur, posée au sol
    const mxx=cote>0?x0+w+rm:x0-rm, myy=bas-quai-rm+1;
    fr(c,mxx-rm,myy+rm-1,2*rm,2,'rgba(10,14,20,.35)');
    disque(c,mxx,myy,rm,p[2]); disque(c,mxx,myy,Math.max(2,rm-1),p[1]);
    disque(c,mxx,myy,Math.max(1,Math.round(rm*0.28)),p[3]);
    for(let a=0;a<8;a++){ const an=a/8*6.28+0.3;      // rayons de taille de la meule
      trait(c,mxx+Math.cos(an)*rm*0.42,myy+Math.sin(an)*rm*0.42,
              mxx+Math.cos(an)*rm*0.80,myy+Math.sin(an)*rm*0.80,ombre(p[2],.18),1); }
    fr(c,mxx-1,myy-1,3,3,p[3]); fr(c,mxx,myy,1,1,'#1d1a16'); }
  if(chance(.7)) chatAssis(c,cote>0?x0+S(6):x0+w-S(8),bas-quai-1,pick(PELAGES),cote>0?-1:1);
  if(chance(.5)) caissePoissons(c,x0+Math.round(w*0.5)-S(4),bas-quai-S(5),Math.max(6,S(9)),bois);
  /* --- compléments : le moulin doit dire l'EAU autant que la meule --- */
  // écume permanente au pied de la roue, et mousse sur tout ce que l'eau mouille
  { const fx=wx-Math.round(rr*0.7), fw2=Math.round(rr*1.4);
    for(let k=0,n=Math.round(fw2*0.7);k<n;k++){
      const ex=fx+RI(0,fw2), ey=bas-RI(0,S(4));
      fr(c,ex,ey,RI(1,3),1, chance(.5)?'rgba(226,240,246,.55)':'rgba(180,206,220,.42)');
    }
    for(let i=0;i<SW;i+=RI(2,5)) if(chance(.5))
      fr(c,i,bas-quai+RI(-1,2),RI(2,5),1, chance(.5)?mix(p[2],'#4e6b3a',.62):mix(p[2],'#3d5a30',.45));
    for(let k=0;k<S(9);k++){                              // traînées vertes sous la ligne d'eau
      const gx2=RI(0,SW-2);
      for(let j=0;j<RI(2,S(4));j++) if(chance(.7))
        fr(c,gx2,bas-RI(1,S(5)),1,1,'rgba(70,110,60,.30)');
    } }
  // barque amarrée au quai, du côté opposé à la roue
  if(false){ const bx2=cote>0 ? x0-S(16) : x0+w+S(4);
    if(bx2>1&&bx2+S(15)<SW){
      const by2=bas-S(2);
      fr(c,bx2+1,by2-S(3),S(13),Math.max(2,S(3)),'#6a4c31');
      fr(c,bx2,by2-S(2),S(15),Math.max(2,S(2)),'#5a4128');
      fr(c,bx2+1,by2-S(3),S(13),1,'#8a6a45');
      fr(c,bx2,by2,S(15),1,'rgba(16,40,56,.45)');
      for(let i=S(3);i<S(13);i+=S(4)) fr(c,bx2+i,by2-S(3),Math.max(2,S(3)),1,'#4a3826');
      fr(c,bx2+S(10),by2-S(9),1,S(7),'#8a6a45');           // aviron dressé
      fr(c,bx2+S(9),by2-S(11),Math.max(2,S(3)),Math.max(2,S(3)),'#6a4c31');
      fr(c,bx2+S(2),by2-S(5),Math.max(3,S(4)),Math.max(2,S(3)),'#cbbfa0');  // sac dedans
      trait(c,bx2+S(14),by2-S(3),bx2+S(16),by2-S(6),'#9a9074',1);           // amarre
    } }
  // linge du meunier, tendu entre le logis et la pile
  { sp.linge=[];
    const ly=bas-quai-sh-S(2);
    for(let k=0,n=RI(2,4);k<n;k++)
      sp.linge.push({x:x0+S(4)+k*Math.round((w-S(8))/n), y:ly,
                     w:Math.max(3,S(5)), h:Math.max(4,S(7)),
                     col:pick(['#e4dcc6','#c9b45a','#7fa8c9','#b7c4a8'])});
  }
  chatteries(sp,c,x0,bas-quai,w,sh+fh,row);
  sp.fumees.push({x:cx+S(6),y:bas-quai-sh-fh-toitH+S(2),t:0,d:0.6});
  brume(sp,row); return sp;
}
/* ---------- FONDERIE ----------
   Plus lourde que la forge : une industrie. Halle de brique, four à cuve,
   poche de coulée, tas de scories — et des moules à grelots, car ici
   tout finit en collier. */
/* ---------- LA FONDERIE ----------
   Reprise à zéro. L'ancienne version était une halle de brique percée de
   trous : rien ne disait la fonte. Une fonderie se lit à TROIS choses, et
   dans cet ordre : la masse de la cheminée, qui traverse le bâtiment de
   part en part au lieu de le coiffer ; la gueule du four, arc de briques
   au ras du sol d'où sort la seule vraie lumière chaude du village ; et
   l'attirail qui l'entoure — enclume sur son billot, râtelier d'outils,
   tas de charbon, bois de chauffe, potence de levage. Le corps du
   bâtiment n'est plus qu'un support : deux ailes dissymétriques, l'une
   basse à pignon sur rue, l'autre haute à long pan, pour que la cheminée
   ait une raison d'être là où elle est. */
function genFonderie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(70), sh=S(21), fhD=S(16), fhG=S(11);
  /* la cheminée montait si haut qu'elle traversait la rangée du dessus ;
     on la ramène sous la ligne des façades voisines */
  const toitG=S(15), toitD=S(19), chemH=S(20);
  const chemW=S(15);
  const SW=w+S(40), SH=sh+fhD+toitD+chemH+S(8);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const briq=pick(PAL.brique), bois=AMB.bois, p=AMB.pierre;
  const toit=chance(.6)?PAL.toits.ardoise:PAL.toits.vert;
  const platre=pick(['#c9bda0','#bfae90','#d3c5a6']);
  const wG=Math.round(w*0.31), wD=w-wG-chemW;
  const xG=x0, xC=x0+wG, xD=xC+chemW;

  /* --- aile droite : haute, long pan, atelier à l'étage --- */
  mur(c,xD,bas-sh,wD,sh,p);
  colombage(c,xD,bas-sh-fhD,wD,fhD,platre,bois,'croix');
  toitVarie(c,xD-S(3),bas-sh-fhD-toitD,wD+S(6),toitD,toit);
  for(let k=0,n=Math.max(1,Math.round(wD/S(16)));k<n;k++)
    fenetre(sp,c,xD+S(4)+k*Math.round((wD-S(8))/n), bas-sh-fhD+S(4),
            Math.max(4,S(7)),Math.max(5,fhD-S(8)),bois,pick(PAL.volets),
            {volets:chance(.4),on:chance(.7)});
  // grande baie d'atelier au rez : on voit rougeoyer l'intérieur
  {
    const bw=Math.max(9,Math.round(wD*0.52)), bx=xD+Math.round((wD-bw)/2), bh=sh-S(7);
    fr(c,bx-2,bas-bh-3,bw+4,bh+3,p[3]);
    for(let j=0;j<bh;j++){
      const t=j/(bh-1);
      fr(c,bx,bas-bh+j,bw,1, mix('#2e1a10', t>0.55?'#e0661c':'#7a3010', Math.pow(t,1.3)));
    }
    for(let i=1;i<bw;i+=3) fr(c,bx+i,bas-bh,1,bh,bois[1]);   // barreaudage
    fr(c,bx-2,bas-bh-3,bw+4,2,bois[1]); fr(c,bx-2,bas-bh-3,bw+4,1,clair(bois[2],.2));
    sp.lampes.push({x:bx+(bw>>1),y:bas-Math.round(bh*0.4),c:'#ff9a4a',r:S(12)});
  }

  /* --- aile gauche : basse, pignon sur rue --- */
  mur(c,xG,bas-sh,wG,sh,p);
  colombage(c,xG,bas-sh-fhG,wG,fhG,platre,bois,'chevron');
  toitPignon(c,xG-S(3),bas-sh-fhG-toitG,wG+S(6),toitG,toit);
  {
    const dw=Math.max(6,S(10));
    porte(c,xG+Math.round((wG-dw)/2),bas-sh+S(4),dw,sh-S(4),bois,true);
    if(sh>=S(14)) chatiere(c,xG+(wG>>1),bas,Math.max(4,S(6)),bois);
    enseigneChat(sp,c,xG+Math.round(wG*0.5)-S(5),bas-sh-S(3),Math.max(8,S(11)),Math.max(5,S(7)),bois);
  }

  /* --- LA CHEMINÉE : socle de pierre, fût de brique fuselé, corbeaux --- */
  const chBas=bas, chTop=bas-sh-fhD-toitD-chemH;
  const hCh=chBas-chTop;
  const largeur=j=>{ const t=1-j/hCh; return Math.max(S(7),Math.round(chemW*(1-0.34*t))); };
  futBrique(c,chTop,hCh,j=>{
    const wj=largeur(j+1);                       // j : 0 en bas, le fruit vient d'ici
    return [xC+((chemW-wj)>>1),wj];
  },briq,false);
  // socle de pierre appareillé sur le premier tiers
  { const hsoc=Math.round(hCh*0.30), wj=largeur(hsoc);
    mur(c,xC+((chemW-wj)>>1)-1,chBas-hsoc,wj+2,hsoc,p,3);
    fr(c,xC+((chemW-wj)>>1)-2,chBas-hsoc,wj+4,2,p[0]); }
  // corbeaux à mi-hauteur + couronnement
  { const yb=chTop+Math.round(hCh*0.30), wj=largeur(hCh-Math.round(hCh*0.30));
    fr(c,xC+((chemW-wj)>>1)-2,yb,wj+4,2,briq[1]);
    fr(c,xC+((chemW-wj)>>1)-2,yb,wj+4,1,clair(briq[0],.24)); }
  { const wt=largeur(0);
    const xt=xC+((chemW-wt)>>1);
    fr(c,xt-3,chTop-S(3),wt+6,S(3),p[1]);
    fr(c,xt-3,chTop-S(3),wt+6,1,clair(p[0],.24));
    fr(c,xt-1,chTop-S(6),wt+2,S(3),'#4a4a50');            // mitre de fonte
    for(let i=0;i<wt+2;i+=3) fr(c,xt-1+i,chTop-S(6),1,S(3),'#33333a');
    sp.fumees.push({x:xt+(wt>>1),y:chTop-S(7),t:1,d:2.4});
    sp.fumees.push({x:xt+(wt>>1)-1,y:chTop-S(7),t:14,d:1.2});
    sp.fumees.push({x:xt+(wt>>1)+1,y:chTop-S(7),t:13,d:0.8});
  }

  /* --- LA GUEULE DU FOUR --- */
  const ow=Math.max(9,S(13)), oh=Math.max(8,S(13));
  const ox=xC+((chemW-ow)>>1);
  { const ew=ow+6, ex2=ox-3, eh2=oh+S(5);                 // encadrement, nuancé
    futBrique(c,bas-eh2+1,eh2,()=>[ex2,ew],briq,false);
    fr(c,ex2,bas-eh2+1,ew,1,clair(briq[0],.24));
    fr(c,ex2,bas-eh2+1,1,eh2,clair(briq[0],.18)); fr(c,ex2+ew-1,bas-eh2+1,1,eh2,ombre(briq[1],.30)); }
  for(let j=0;j<oh;j++){                                   // intérieur incandescent
    const t=j/(oh-1);
    let wj=ow, xj=ox;
    const r=Math.round(ow*0.5);
    if(j<r){ const d=r-Math.round(Math.sqrt(Math.max(0,r*r-(r-j)*(r-j)))); wj=ow-2*d; xj=ox+d; }
    fr(c,xj,bas-oh+j,wj,1, mix('#1d0d06', t>0.55?'#ff8a2a':'#7a2c0c', Math.pow(t,1.6)));
  }
  for(let j=0;j<Math.round(ow*0.5);j++){                   // claveaux de l'arc
    const r=Math.round(ow*0.5);
    const d=r-Math.round(Math.sqrt(Math.max(0,r*r-(r-j)*(r-j))));
    if(d>0){ fr(c,ox-1,bas-oh+j,d+1,1,briq[1]); fr(c,ox+ow-d-1,bas-oh+j,d+1,1,briq[1]); }
  }
  for(let i=0;i<ow;i++) if(chance(.55))                    // lit de braises
    fr(c,ox+i,bas-RI(2,Math.max(3,S(4))),1,1,pick(['#ffe0a0','#ffb04a','#ff6a1a']));
  sp.brasier={x:ox+(ow>>1),y:bas-Math.round(oh*0.45),r:S(15),c:'#ff8a2a'};
  sp.lampes.push({x:ox+(ow>>1),y:bas-Math.round(oh*0.4),c:'#ff7a2a',r:S(20)});

  /* --- L'ATTIRAIL, devant, au sol --- */
  // enclume sur billot
  { const ax=xD+Math.round(wD*0.62), aw=Math.max(7,S(11));
    fr(c,ax,bas-S(5),Math.max(5,S(7)),S(5),'#6d5236');            // billot
    fr(c,ax,bas-S(5),Math.max(5,S(7)),1,'#856848');
    fr(c,ax-1,bas-S(8),aw,S(3),'#4e5259');                        // table
    fr(c,ax-1,bas-S(8),aw,1,'#7d838c');
    fr(c,ax+2,bas-S(10),Math.max(3,S(4)),S(2),'#4e5259');         // corne
    fr(c,ax+aw-3,bas-S(9),2,1,'#5c6169');
    if(chance(.5)) fr(c,ax+aw,bas-S(9),1,S(4),'#5c4128'); }
  // râtelier d'outils contre l'aile gauche
  { const rx=xG-S(6), ry=bas-sh+S(3);
    if(rx>2){
      fr(c,rx,ry,S(6),1,bois[1]); fr(c,rx,ry,S(6),1,clair(bois[2],.2));
      for(let i=1;i<S(6);i+=3){
        const l=RI(S(4),S(8));
        fr(c,rx+i,ry+1,1,l,'#3f3f45');
        fr(c,rx+i-1,ry+l,3,2, chance(.5)?'#4e5259':'#6d5236');
      }
    } }
  // bois fendu et charbon
  { const bx2=xD+wD-S(4), by2=bas;
    for(let k=0;k<RI(4,7);k++){
      const bxx=bx2+RI(0,S(9)), byy=by2-RI(0,S(5));
      disque(c,bxx,byy-1,Math.max(1,S(2)),'#8a6a45');
      disque(c,bxx,byy-1,Math.max(1,S(2)-1),'#b39566');
      fr(c,bxx-1,byy-2,1,1,'#6d5236');
    }
    const kx=xG-S(4);
    if(kx>3) for(let k=0;k<S(9);k++)
      fr(c,kx+RI(-S(4),S(4)),bas-RI(0,S(4)),RI(1,2),RI(1,2),chance(.5)?'#25262b':'#3a3b42'); }
  // potence de levage à droite
  { const px2=xD+wD+S(5);
    if(px2<SW-4){
      const ph2=sh+fhD;
      fr(c,px2,bas-ph2,S(3),ph2,bois[2]); fr(c,px2,bas-ph2,1,ph2,clair(bois[2],.18));
      fr(c,px2-S(9),bas-ph2,S(11),S(3),bois[2]);
      trait(c,px2,bas-ph2+S(6),px2-S(7),bas-ph2+S(3),bois[1],1);
      sp.poulie={x:px2-S(8),y:bas-ph2+S(4),l:Math.round(ph2*0.55)};
    } }
  lanternePotence(sp,c,xC-S(2),bas-sh-S(6),bois);
  chatteries(sp,c,x0,bas,w,sh+fhD,row);
  if(chance(.8)) chatDormi(c,ox+ow+S(3),bas,pick(PELAGES));   // le chat dort près du four
  brume(sp,row); return sp;
}
/* ---------- MINE ----------
   La galerie s'enfonce sous le contrefort. Portail de bois étayé,
   chevalement à molette, wagonnets de minerai. Au fond du noir, deux yeux
   qui brillent : le chat de la mine n'a jamais eu besoin de lampe. */
/* ---------- LE PUITS DE MINE ----------
   Repris à zéro. Un carreau de mine ne se dessine pas comme un bâtiment
   mais comme une MACHINE À DESCENDRE : le chevalement est un assemblage
   de bois équarris, jambes en A contreventées par des croix de Saint-André,
   chaque assemblage cerclé de moises de fer boulonnées — c'est ce ferrement
   répété qui donne l'échelle et le caractère. Au sommet la molette, en bas
   le treuil et son volant, entre les deux la corde et la benne, seule pièce
   mobile. Le sol autour raconte le reste : margelle de rondins, échelle qui
   plonge dans le noir, terril, pic et pelle plantés.
   ---------------------------------------------------------------- */
function genMine(row){
  const S=v=>Math.max(1,sc(row,v));
  const hw=S(21), tw=S(7), ht=S(46);
  const SW=hw*2+S(26), SH=ht+S(16);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];      // bois équarri, chêne clair
  const FER='#3d3f45', FERC='#5e626a';
  const top=bas-ht;

  // terril, à l'écart
  { const tx=cx+(chance(.5)?-1:1)*S(19), tw2=S(11), th2=S(7);
    for(let j=0;j<th2;j++){                                   // terril en cône, tramé
      const wj=Math.round(tw2*2*(j+1)/th2);
      fr(c,tx-(wj>>1),bas-th2+j,wj,1, j<2?'#6b5540':'#4a3a2c');
      for(let i=0;i<wj;i+=2) if(chance(.4))
        fr(c,tx-(wj>>1)+i,bas-th2+j,1,1,pick(['#5c4936','#3a2d22','#7a634a']));
    }
    fr(c,tx-tw2,bas-1,tw2*2,1,'#2e241b'); }

  /* --- margelle du puits : rondins en couronne, échelle qui plonge --- */
  const pw=S(15);
  ellipse(c,cx,bas-S(3),pw>>1,Math.max(2,S(3)),'#100c08');
  for(let a=0;a<14;a++){
    const an=a/14*6.28, ex=cx+Math.cos(an)*(pw>>1), ey=bas-S(3)+Math.sin(an)*S(3);
    fr(c,Math.round(ex)-1,Math.round(ey)-1,3,3,B[0]);
    fr(c,Math.round(ex)-1,Math.round(ey)-1,3,1,B[2]);
  }
  ellipse(c,cx,bas-S(3),Math.max(2,(pw>>1)-2),Math.max(1,S(2)),'#0a0806');
  for(let j=0;j<S(4);j++){                                   // échelle dans le noir
    fr(c,cx-2,bas-S(4)+j,1,1,B[1]); fr(c,cx+2,bas-S(4)+j,1,1,B[1]);
    if(j%2===0) fr(c,cx-2,bas-S(4)+j,5,1,B[1]);
  }

  /* --- les deux jambes du chevalement, avec leurs moises --- */
  const jambe=(sgn)=>{
    for(let j=0;j<ht;j++){
      const t=j/ht;                                          // 0 au sol
      const x=Math.round(cx+sgn*(hw-(hw-tw)*t));
      const ep=Math.max(2,Math.round(S(4)*(1-0.25*t)));
      fr(c,x-(sgn>0?ep-1:0),top+ht-j-1,ep,1, (j%7===0)?B[3]:B[0]);
      fr(c,x-(sgn>0?ep-1:0),top+ht-j-1,1,1, sgn<0?B[2]:B[1]);
    }
  };
  jambe(-1); jambe(1);
  const xAt=(sgn,y)=>{ const t=(bas-y)/ht; return Math.round(cx+sgn*(hw-(hw-tw)*clamp(t,0,1))); };

  // entretoises + croix de Saint-André entre chaque niveau
  const niv=[0,0.26,0.52,0.78,1].map(f=>Math.round(bas-ht*f));
  for(let k=0;k<niv.length;k++){
    const y=niv[k], a=xAt(-1,y), b=xAt(1,y);
    fr(c,a,y-1,b-a,Math.max(2,S(3)),B[0]);
    fr(c,a,y-1,b-a,1,B[2]);
    fr(c,a,y-1+Math.max(2,S(3))-1,b-a,1,B[3]);
    for(const xx of [a,b-Math.max(2,S(4))]){                 // moises de fer boulonnées
      fr(c,xx-1,y-2,Math.max(3,S(5)),Math.max(3,S(5)),FER);
      fr(c,xx-1,y-2,Math.max(3,S(5)),1,FERC);
      fr(c,xx,y,1,1,FERC); fr(c,xx+Math.max(1,S(3))-1,y,1,1,FERC);
    }
    if(k<niv.length-1){
      const y2=niv[k+1], a2=xAt(-1,y2), b2=xAt(1,y2);
      trait(c,a+2,y,b2-2,y2,B[1],1); trait(c,b-2,y,a2+2,y2,B[1],1);
      trait(c,a+3,y,b2-1,y2,B[3],1); trait(c,b-3,y,a2+1,y2,B[3],1);
    }
  }

  /* --- la molette au sommet --- */
  const my=top+S(5), rm=Math.max(3,S(5));
  fr(c,cx-Math.max(3,S(5)),my-rm-S(2),Math.max(6,S(10)),Math.max(2,S(3)),B[0]);   // chapeau
  disque(c,cx,my,rm,FERC); disque(c,cx,my,Math.max(2,rm-1),FER);
  disque(c,cx,my,Math.max(1,rm-2),'#2b2d33');                 // gorge de la molette
  for(let a=0;a<6;a++){ const an=a/6*6.28+0.4;
    trait(c,cx+Math.cos(an)*(rm-2),my+Math.sin(an)*(rm-2),cx,my,FERC,1); }
  fr(c,cx-1,my-1,3,3,FERC); fr(c,cx,my,1,1,'#22242a');
  for(const s3 of [-1,1]) fr(c,cx+s3*(rm+1),my-Math.max(2,S(3)),2,Math.max(4,S(6)),FER);   // chaises
  sp.poulie={x:cx,y:my+rm-1,l:Math.round(ht*0.72)};

  /* --- le treuil : tambour et volant, au pied --- */
  { const wx=cx-hw-S(4), wy=bas-S(9);
    if(wx>S(3)){
      for(const px2 of [wx-S(4),wx+S(4)]) fr(c,px2,wy,Math.max(2,S(3)),S(9),B[1]);
      fr(c,wx-S(4),wy,S(9),Math.max(3,S(5)),B[0]);          // tambour
      for(let i=0;i<S(9);i+=2) fr(c,wx-S(4)+i,wy,1,Math.max(3,S(5)),B[3]);
      fr(c,wx-S(4),wy,S(9),1,B[2]);
      const rv=Math.max(3,S(6));                             // volant à manivelle
      disque(c,wx-S(6),wy+S(2),rv,FER); disque(c,wx-S(6),wy+S(2),Math.max(1,rv-2),'#2b2d33');
      for(let a=0;a<5;a++){ const an=a/5*6.28;
        trait(c,wx-S(6),wy+S(2),wx-S(6)+Math.cos(an)*rv,wy+S(2)+Math.sin(an)*rv,FERC,1); }
      fr(c,wx-S(6)-rv-1,wy+S(2),2,Math.max(3,S(4)),B[0]);
    } }

  /* --- outillage planté, brouette, lanterne --- */
  { const ox=cx+hw+S(2);
    if(ox<SW-S(6)){
      trait(c,ox,bas-1,ox+S(2),bas-S(11),B[2],1);            // pic planté
      trait(c,ox+1,bas-1,ox+S(3),bas-S(11),B[0],1);
      for(let i=0;i<S(7);i++){                                 // fer du pic, recourbé
        const yy=bas-S(12)-Math.round(Math.sin(i/S(7)*1.2)*S(2));
        fr(c,ox+S(2)-Math.round(S(3))+i,yy,1,2,i<S(3)?FERC:FER);
      }
      trait(c,ox+S(6),bas-1,ox+S(6),bas-S(9),B[0],1);         // pelle appuyée
      fr(c,ox+S(5),bas-S(12),Math.max(3,S(4)),Math.max(3,S(4)),FERC);
      fr(c,ox+S(5),bas-S(12),Math.max(3,S(4)),1,'#8d9199');
    } }
  { const bx2=cx-hw-S(2);
    if(bx2>S(6)){
      fr(c,bx2-S(5),bas-S(5),S(9),Math.max(3,S(4)),B[0]);    // brouette
      fr(c,bx2-S(5),bas-S(5),S(9),1,B[2]);
      disque(c,bx2-S(3),bas-S(2),Math.max(2,S(3)),B[3]);
      fr(c,bx2+S(4),bas-S(6),Math.max(2,S(4)),1,B[1]);
      for(let k=0;k<S(5);k++) fr(c,bx2-S(4)+RI(0,S(7)),bas-S(6)-RI(0,S(1)),RI(1,2),1,'#4a3a2c');
    } }
  lanternePotence(sp,c,cx+hw-S(1),bas-S(20),B);
  if(chance(.7)) chatAssis(c,cx+(chance(.5)?-hw-S(6):hw+S(4)),bas-1,pick(PELAGES),chance(.5)?1:-1);
  sp.droit=1;                       // une charpente métallique ne gauchit pas comme un mur
  brume(sp,row); return sp;
}
/* ---------- ARMURERIE ----------
   Cottes, écus et heaumes taillés pour des épaules étroites et des
   oreilles hautes. Devanture de bois sombre, panoplies pendues, et le
   griffoir d'essayage — pour vérifier la prise des gantelets. */
/* ---------- L'ARMURERIE ----------
   Reprise à zéro. Ce qui distingue l'armurier du forgeron, ce n'est pas
   le feu — c'est la MONSTRE : la façade sert de présentoir. On dessine
   donc un rez ouvert en arcade sous un auvent de bois, avec le râtelier
   d'épées bien alignées, les boucliers accrochés en bandeau au-dessus du
   linteau, un harnois complet sur son mannequin qui monte la garde à
   l'entrée, et l'établi où l'on rive les rivets. L'étage, lui, est fermé
   et barreaudé : c'est là qu'on serre la marchandise la nuit.
   ---------------------------------------------------------------- */
function genArmurerie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(46), sh=S(23), fh=S(15), toitH=S(17);
  const SW=w+S(26), SH=sh+fh+toitH+S(6);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const p=AMB.pierre, bois=AMB.bois;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const FER='#5e626a', FERC='#8d9199', FERS='#3a3c42';
  const toit=pick(AMB.toits);

  socle(c,x0-1,bas-S(4),w+2,S(4),p);
  mur(c,x0,bas-sh,w,sh,p);

  /* --- arcade de montre : trois arcs sur piliers --- */
  const nA=3, jam=Math.max(3,S(5));
  const aw=Math.round((w-jam*(nA+1))/nA), ah=sh-S(7);
  const arcs=[];
  for(let k=0;k<nA;k++){
    const ax=x0+jam+k*(aw+jam);
    arcs.push([ax,aw]);
    for(let j=0;j<ah;j++){
      let wj=aw, xj=ax; const r2=aw>>1;
      if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj=aw-2*d; xj=ax+d; }
      const t=j/Math.max(1,ah-1);
      fr(c,xj,bas-ah+j,wj,1, mix('#231d17','#463b2e',Math.pow(t,0.6)));
      if(j<r2){ fr(c,xj-1,bas-ah+j,1,1,p[0]); fr(c,xj+wj,bas-ah+j,1,1,p[0]); }
    }
    fr(c,ax-1,bas-S(4),aw+2,S(4),p[2]);                 // seuil
  }

  /* --- râtelier d'épées dans l'arc central, établi dans un autre --- */
  { const [ax,awd]=arcs[1];
    fr(c,ax+1,bas-Math.round(ah*0.72),awd-2,Math.max(2,S(3)),B[1]);
    fr(c,ax+1,bas-Math.round(ah*0.72),awd-2,1,B[2]);
    for(let i=2;i<awd-2;i+=Math.max(3,S(4))){
      const l=RI(Math.round(ah*0.30),Math.round(ah*0.52));
      fr(c,ax+i,bas-Math.round(ah*0.72)+S(2),1,l,FER);       // lame
      fr(c,ax+i,bas-Math.round(ah*0.72)+S(2),1,Math.round(l*0.5),FERC);
      fr(c,ax+i-1,bas-Math.round(ah*0.72)+S(2)+l,3,1,'#8a6a2a');  // garde
      fr(c,ax+i,bas-Math.round(ah*0.72)+S(2)+l+1,1,Math.max(2,S(3)),B[1]);
    } }
  { const [ax,awd]=arcs[0];
    fr(c,ax+1,bas-S(10),awd-2,Math.max(3,S(4)),B[0]);          // établi
    fr(c,ax+1,bas-S(10),awd-2,1,B[2]);
    fr(c,ax+2,bas-S(10)-Math.max(2,S(3)),Math.max(3,S(5)),Math.max(2,S(3)),FER);  // plastron en cours
    fr(c,ax+2,bas-S(10)-Math.max(2,S(3)),Math.max(3,S(5)),1,FERC);
    for(let i=0;i<awd-4;i+=3) if(chance(.5)) fr(c,ax+2+i,bas-S(11),1,1,FERC);     // rivets
    fr(c,ax+awd-Math.max(3,S(5)),bas-S(6),Math.max(2,S(3)),Math.max(4,S(6)),'#5c4128'); }
  { const [ax,awd]=arcs[2];                                     // cottes de mailles pendues
    for(let k=0;k<2;k++){
      const mx=ax+S(2)+k*Math.max(4,S(7)), mh=Math.round(ah*0.5);
      fr(c,mx,bas-ah+S(3),Math.max(3,S(5)),mh,FERS);
      for(let j=0;j<mh;j+=2) for(let i=0;i<S(5);i+=2)
        fr(c,mx+i+((j/2)|0)%2,bas-ah+S(3)+j,1,1,FER);
      fr(c,mx,bas-ah+S(3),Math.max(3,S(5)),1,FERC);
    } }

  /* --- étage fermé et barreaudé --- */
  colombage(c,x0-S(1),bas-sh-fh,w+S(2),fh,pick(['#c9bda0','#bfae90']),bois,'croix');
  for(let k=0;k<3;k++){
    const fw2=Math.max(4,S(7)), fx2=Math.round(x0+S(4)+k*((w-S(10))/2))-(fw2>>1);
    fenetre(sp,c,fx2,bas-sh-fh+S(4),fw2,Math.max(5,fh-S(8)),bois,pick(PAL.volets),{on:chance(.5)});
    for(let i=0;i<fw2;i+=Math.max(2,S(3))) fr(c,fx2+i,bas-sh-fh+S(4),1,Math.max(5,fh-S(8)),FERS);
  }
  toitVarie(c,x0-S(4),bas-sh-fh-toitH,w+S(8),toitH,toit);

  /* --- linteau, auvent, bandeau de boucliers --- */
  const ly=bas-sh+S(2);
  fr(c,x0-S(2),ly-Math.max(3,S(4)),w+S(4),Math.max(3,S(4)),B[0]);
  fr(c,x0-S(2),ly-Math.max(3,S(4)),w+S(4),1,B[2]);
  fr(c,x0-S(2),ly-1,w+S(4),1,B[3]);
  { const av=Math.max(3,S(5));                                  // auvent en appentis
    for(let j=0;j<av;j++)
      fr(c,x0-S(4)+j,ly-Math.max(3,S(4))-av+j,w+S(8)-2*j,1, j===0?clair(toit[0],.18):(j%2?toit[1]:toit[2]));
    fr(c,x0-S(4),ly-Math.max(3,S(4))-1,w+S(8),1,toit[3]);
    for(let i=S(3);i<w;i+=S(11)){                               // liens de l'auvent
      trait(c,x0+i,ly-Math.max(3,S(4)),x0+i-S(4),ly-Math.max(3,S(4))-av+1,B[1],1); } }
  { const n=Math.max(3,Math.round(w/S(11)));                    // boucliers accrochés
    for(let k=0;k<n;k++){
      const bx2=Math.round(x0+S(3)+k*((w-S(6))/Math.max(1,n-1)))-S(3);
      const bw2=Math.max(6,S(9)), bh2=Math.round(bw2*1.2);
      const champ=pick(PAL.blason);
      for(let j=0;j<bh2;j++){
        const t=j/(bh2-1);
        const wj = t<0.58 ? bw2 : Math.max(1,Math.round(bw2*(1-Math.pow((t-0.58)/0.42,1.5))));
        fr(c,bx2+((bw2-wj)>>1),ly-Math.max(3,S(4))-bh2+j+1,wj,1, t<0.5?champ:ombre(champ,.14));
        fr(c,bx2+((bw2-wj)>>1),ly-Math.max(3,S(4))-bh2+j+1,1,1,ombre(champ,.4));
      }
      fr(c,bx2,ly-Math.max(3,S(4))-bh2+1,bw2,1,clair(champ,.28));
      charge(c,bx2+(bw2>>1),ly-Math.max(3,S(4))-bh2+Math.round(bh2*0.42),
             Math.max(2,Math.round(bw2*0.24)),chance(.5)?'#e0c463':'#dfe3ea',pick(CHARGES));
    } }

  /* --- le harnois de garde, devant --- */
  { const mx=cote(x0,w,S);
    const mh=Math.max(12,S(18));
    fr(c,mx-1,bas-Math.max(2,S(3)),Math.max(4,S(6)),Math.max(2,S(3)),'#5c4128');    // socle
    fr(c,mx,bas-mh,Math.max(3,S(5)),Math.round(mh*0.42),FER);                       // plastron
    fr(c,mx,bas-mh,Math.max(3,S(5)),1,FERC);
    fr(c,mx,bas-mh+Math.round(mh*0.42),Math.max(3,S(5)),Math.round(mh*0.22),FERS);  // tassettes
    fr(c,mx-1,bas-mh-Math.max(3,S(4)),Math.max(5,S(7)),Math.max(3,S(4)),FER);       // heaume
    fr(c,mx-1,bas-mh-Math.max(3,S(4)),Math.max(5,S(7)),1,FERC);
    fr(c,mx,bas-mh-Math.max(2,S(2)),Math.max(3,S(5)),1,'#15110c');                  // vue
    fr(c,mx+Math.max(1,S(2)),bas-mh-Math.max(5,S(7)),1,Math.max(3,S(4)),pick(PAL.blason)); // plumail
    trait(c,mx-S(2),bas-1,mx-S(2),bas-mh-S(2),B[0],1);                              // lance
    fr(c,mx-S(2)-1,bas-mh-S(5),3,Math.max(3,S(5)),FERC);
    for(let j=0;j<Math.round(mh*0.30);j++)                                          // jambières
      fr(c,mx+((j&1)?0:Math.max(2,S(3))),bas-mh+Math.round(mh*0.64)+j,Math.max(2,S(2)),1,FERS); }
  lanternePotence(sp,c,x0+w-S(2),bas-sh+S(4),bois);
  chatteries(sp,c,x0,bas,w,sh+fh,row);
  brume(sp,row); return sp;
}
function cote(x0,w,S){ return x0+(chance(.5)? -S(7) : w+S(3)); }
/* ---------- CHÂTEAU ----------
   La résidence du châtelain — un grand chat gris qui ne sort qu'à la
   nuit tombée. Courtine crénelée, deux tours coiffées en poivrière,
   portail à herses, bannières à la patte. */
/* ---------- LE CHÂTEAU ----------
   Repris à zéro. C'est la pièce maîtresse : il doit se lire comme un
   SYSTÈME, pas comme un décor. On l'organise donc en profondeur, du fond
   vers l'avant, parce que c'est ainsi qu'une forteresse se construit et se
   regarde. Au fond le DONJON, plus haut que tout, avec ses contreforts
   d'angle, ses fenêtres géminées de l'étage noble et son couronnement à
   mâchicoulis. Au milieu la CHAPELLE dont on n'aperçoit que l'abside et le
   clocheton, et les combles des logis. Devant, l'ENCEINTE : courtine à
   talus fruité, tours rondes d'angle de hauteurs inégales — jamais
   symétriques, une forteresse pousse par campagnes —, et au centre le
   CHÂTELET d'entrée à deux tours, herse, mâchicoulis, pont-levis relevé
   contre l'arc. Le tout campé sur son éperon rocheux, avec le fossé.
   ---------------------------------------------------------------- */
function genChateau(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(104), h=S(34), talus=S(9);
  const donH=S(58), donW=S(34);
  const SW=w+S(20), SH=h+donH+S(26);
  const sp=sprite(SW,SH), c=sp.g;
  const cx=SW>>1, bas=SH-1, p=AMB.pierre, bois=AMB.bois;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const toit=chance(.5)?PAL.toits.ardoise:pick(AMB.toits);
  const x0=cx-(w>>1), sol=bas-S(4);
  const yh=sol-h;

  /* --- l'éperon rocheux --- */
  for(let i=-S(10);i<w+S(10);i++){
    const t=Math.abs(i-w/2)/(w/2+S(10));
    const hh=Math.round(S(7)*(1-t*t*t));
    for(let j=0;j<hh;j++){
      const x=x0+i, y=bas-j;
      let col=(j>hh-2)?'#6d8b4a':(j%3?p[2]:p[3]);
      if(NTILE&&NT2(x*1.3,y*1.3)<0.26) col=ombre(col,.16);
      fr(c,x,y,1,1,col);
    }
  }
  for(let k=0,n=S(12);k<n;k++)
    fr(c,x0+RI(-S(8),w+S(8)),bas-RI(0,S(5)),RI(2,S(6)),RI(1,3),chance(.5)?p[2]:p[3]);

  /* --- LE DONJON, au fond et plus haut que tout --- */
  const dx=cx+(chance(.5)?-1:1)*Math.round(w*0.20)-(donW>>1);
  const dTop=sol-h-donH;
  { mur(c,dx,dTop,donW,h+donH-S(6),p,4,'taille');
    for(const s2 of [0,1]){                          // contreforts d'angle
      const bx2=s2?dx+donW-S(6):dx;
      for(let j=0;j<h+donH-S(6);j++){
        const t=j/(h+donH-S(6));
        const wj=Math.max(3,Math.round(S(7)*(0.60+0.40*t)));
        const y=sol-S(6)-j;
        fr(c,s2?bx2+S(6)-wj:bx2,y,wj,1,(j%4)===3?p[3]:p[1]);
        fr(c,s2?bx2+S(6)-1:bx2,y,1,1,s2?ombre(p[3],.22):clair(p[0],.24));
      }
    }
    // fenêtres géminées de l'étage noble
    for(let e=0;e<2;e++){
      const wy=dTop+S(12)+e*S(18);
      for(let m=0;m<2;m++){
        const wx=dx+S(9)+m*S(12);
        fr(c,wx-2,wy-2,Math.max(5,S(7)),Math.max(11,S(15)),p[0]);
        fenetre(sp,c,wx,wy,Math.max(3,S(4)),Math.max(8,S(11)),bois,'#4a5c46',
                {arc:true,vitrail:chance(.4),on:chance(.6)});
      }
      fr(c,dx+S(9)+Math.round(S(12)*0.5),wy-2,1,Math.max(11,S(15)),p[1]);
    }
    for(let e=0;e<2;e++) for(let m=0;m<3;m++)         // archères des étages bas
      archere(c,dx+S(7)+m*Math.round((donW-S(14))/2),sol-S(14)-e*S(13),Math.max(6,S(8)),p,true);
    machicoulis(c,dx-S(3),dTop-S(2),donW+S(6),p,Math.max(3,S(5)));
    const pw=donW+S(6), ph2=Math.max(6,S(9));
    for(let i=0;i<pw-2;i+=Math.max(7,S(11))){
      const mw=Math.max(5,S(7));
      fr(c,dx-S(3)+i,dTop-S(2)-ph2,mw,ph2,p[1]);
      fr(c,dx-S(3)+i,dTop-S(2)-ph2,mw,1,clair(p[0],.26));
      fr(c,dx-S(3)+i,dTop-S(2)-ph2,1,ph2,clair(p[0],.16));
      fr(c,dx-S(3)+i+mw-1,dTop-S(2)-ph2,1,ph2,ombre(p[3],.26));
      fr(c,dx-S(3)+i+((mw-1)>>1),dTop-S(2)-ph2+2,1,Math.max(2,ph2-5),'#15120e');
    }
    // échauguettes d'angle en encorbellement
    for(const s2 of [0,1]){
      const ex=s2?dx+donW-S(4):dx+S(1);
      for(let i=0;i<S(8);i+=2) fr(c,ex-S(2)+i,dTop+S(2),Math.max(2,S(2)),Math.max(2,S(3)),p[1]);
      futRond(c,ex,dTop+S(1),Math.max(8,S(12)),Math.max(6,S(9)),p,3,0);
      poivriere(c,ex,dTop+S(1)-Math.max(8,S(12))-Math.max(6,S(9)),Math.max(4,S(6)),Math.max(6,S(9)),toit);
    }
    fr(c,dx+(donW>>1),dTop-S(2)-ph2-S(11),1,S(11),B[3]);
    sp.drapeaux.push({x:dx+(donW>>1)+1,y:dTop-S(2)-ph2-S(11),
                      w:Math.max(8,S(13)),h:Math.max(5,S(8)),col:AMB.blason}); }

  /* --- CHAPELLE et combles des logis, entre donjon et courtine --- */
  { const lx=cx-(chance(.5)?-1:1)*Math.round(w*0.22)-S(14);
    const ly=yh-S(20);
    mur(c,lx,ly,S(28),S(20),p,3,'moellon');
    toitTrapeze(c,lx-S(3),ly-S(13),S(34),S(13),toit);
    for(let k=0;k<2;k++)
      fenetre(sp,c,lx+S(6)+k*S(12),ly+S(5),Math.max(3,S(5)),Math.max(6,S(9)),bois,'#4a5c46',
              {arc:true,vitrail:true,on:true});
    // abside en cul-de-four et clocheton d'ardoise
    const ax2=lx+S(28);
    futRond(c,ax2,yh,S(22),Math.max(8,S(13)),p,3,0);
    poivriere(c,ax2,yh-S(22)-Math.max(6,S(10)),Math.max(5,S(7)),Math.max(6,S(10)),toit);
    fr(c,ax2,yh-S(22)-Math.max(6,S(10))-S(6),1,S(6),'#c9a24a');
    fr(c,ax2-S(2),yh-S(22)-Math.max(6,S(10))-S(4),Math.max(3,S(5)),1,'#c9a24a'); }

  /* --- L'ENCEINTE --- */
  for(let j=0;j<h;j++){
    const y=sol-j, dw=j<talus?Math.round(S(5)*(1-j/talus)):0;
    fr(c,x0-dw,y,w+2*dw,1,p[1]);
  }
  mur(c,x0,yh,w,h-talus,p,4,'taille');
  for(let j=0;j<talus;j++){
    const y=sol-j, dw=Math.round(S(5)*(1-j/talus));
    fr(c,x0-dw,y,w+2*dw,1,(j%3)===2?p[3]:p[2]);
    if(j%3===0) for(let i=0;i<w+2*dw;i+=5) fr(c,x0-dw+i,y,1,1,p[3]);
  }
  fr(c,x0-S(6),sol-talus,w+S(12),Math.max(2,S(3)),p[0]);
  fr(c,x0-S(6),sol-talus,w+S(12),1,clair(p[0],.28));
  for(let k=0,n=Math.max(4,Math.round(w/S(15)));k<n;k++)
    archere(c,Math.round(x0+(k+0.5)*(w/n)),yh+S(8),Math.max(6,S(9)),p,chance(.6));
  // parapet de courtine
  { const pw=w+S(4), px2=x0-S(2), ph2=Math.max(5,S(8));
    machicoulis(c,px2,yh-1,pw,p,Math.max(3,S(5)));
    for(let i=0;i<pw-2;i+=Math.max(7,S(11))){
      const mw=Math.max(5,S(7));
      fr(c,px2+i,yh-1-ph2,mw,ph2,p[1]);
      fr(c,px2+i,yh-1-ph2,mw,1,clair(p[0],.26));
      fr(c,px2+i,yh-1-ph2,1,ph2,clair(p[0],.16));
      fr(c,px2+i+mw-1,yh-1-ph2,1,ph2,ombre(p[3],.26));
      fr(c,px2+i+((mw-1)>>1),yh-1-ph2+2,1,Math.max(2,ph2-5),'#15120e');
    } }

  /* --- LE CHÂTELET D'ENTRÉE --- */
  const gw=Math.max(15,S(21)), gx=cx-(gw>>1);
  { const gh=Math.max(16,S(23));
    for(let j=0;j<gh;j++){
      const r2=Math.round(gw*0.56);
      let wj=gw, xj=gx;
      if(j<r2){ const q=1-(r2-j)/r2;
        const d=Math.round((gw*0.5)*(1-Math.sqrt(Math.max(0,1-Math.pow(1-q,1.7)))));
        wj=gw-2*d; xj=gx+d; }
      fr(c,xj,sol-gh+j,wj,1,mix('#15120e','#2e2820',Math.pow(j/gh,0.7)));
    }
    for(let j=0;j<Math.round(gw*0.56);j++){
      const r2=Math.round(gw*0.56), q=1-(r2-j)/r2;
      const d=Math.round((gw*0.5)*(1-Math.sqrt(Math.max(0,1-Math.pow(1-q,1.7)))));
      if(d>0){ fr(c,gx-1,sol-gh+j,d+1,1,(j%2)?p[1]:p[2]); fr(c,gx+gw-d-1,sol-gh+j,d+1,1,(j%2)?p[1]:p[2]); }
    }
    { const hy=sol-gh+Math.round(gh*0.36), hh=Math.round(gh*0.30);   // herse
      for(let i=1;i<gw;i+=Math.max(2,S(3))) fr(c,gx+i,hy,1,hh,'#5e626a');
      for(let j=0;j<hh;j+=Math.max(3,S(4))) fr(c,gx+1,hy+j,gw-2,1,'#5e626a');
      for(let i=1;i<gw;i+=Math.max(2,S(3))) fr(c,gx+i,hy+hh,1,Math.max(2,S(3)),'#8d9199'); }
    machicoulis(c,gx-S(4),sol-gh-S(8),gw+S(8),p,Math.max(3,S(4)));
    // pont-levis RELEVÉ, plaqué contre l'arc, ses chaînes tendues
    { const bw=gw-S(2), bx2=gx+S(1), bh2=Math.round(gh*0.82);
      fr(c,bx2,sol-bh2,bw,bh2,B[1]);
      for(let i=0;i<bw;i+=Math.max(3,S(4))) fr(c,bx2+i,sol-bh2,Math.max(2,S(3)),bh2,B[0]);
      fr(c,bx2,sol-bh2,bw,Math.max(2,S(2)),'#3d3f45');
      fr(c,bx2,sol-Math.round(bh2*0.5),bw,Math.max(2,S(2)),'#3d3f45');
      for(const s2 of [-1,1]){
        const fx=cx+s2*Math.round(gw*0.40);
        trait(c,fx,sol-gh-S(6),cx+s2*Math.round(bw*0.42),sol-bh2,'#4a4a50',1);
        fr(c,fx-1,sol-gh-S(6),3,Math.max(5,S(8)),ombre(p[3],.34));
        fr(c,fx,sol-gh-S(6),1,Math.max(5,S(8)),'#15120e');
      } }
    ecusson(c,cx-Math.max(4,S(6)),sol-gh-S(19),Math.max(9,S(12)),Math.max(11,S(15)),
            AMB.blason,pick(CHARGES),false); }

  /* --- LES TOURS : d'angle et de flanquement, hauteurs inégales --- */
  const tours=[
    {x:x0+S(3),        wd:Math.max(13,S(20)), ht:h+S(20), coif:chance(.6)},
    {x:x0+w-S(3),      wd:Math.max(13,S(20)), ht:h+S(12), coif:chance(.6)},
    {x:cx-Math.round(gw*0.80), wd:Math.max(12,S(17)), ht:h+S(16), coif:chance(.7)},
    {x:cx+Math.round(gw*0.80), wd:Math.max(12,S(17)), ht:h+S(16), coif:chance(.7)}
  ];
  for(const T of tours){
    futRond(c,T.x,sol,T.ht,T.wd,p,3,talus);
    for(let e=0;e<3;e++) archere(c,T.x,sol-talus-S(9)-e*S(11),Math.max(5,S(8)),p,chance(.6));
    machicoulis(c,T.x-(T.wd>>1)-2,sol-T.ht,T.wd+4,p,Math.max(3,S(4)));
    const pw=T.wd+4, ph2=Math.max(5,S(8));
    for(let i=0;i<pw-2;i+=Math.max(6,S(9))){
      const mw=Math.max(4,S(6));
      fr(c,T.x-(pw>>1)+i,sol-T.ht-ph2,mw,ph2,p[1]);
      fr(c,T.x-(pw>>1)+i,sol-T.ht-ph2,mw,1,clair(p[0],.26));
      fr(c,T.x-(pw>>1)+i+mw-1,sol-T.ht-ph2,1,ph2,ombre(p[3],.24));
    }
    if(T.coif){
      poivriere(c,T.x,sol-T.ht-ph2-Math.max(9,S(15)),Math.round(T.wd*0.56),Math.max(9,S(15)),toit);
      fr(c,T.x,sol-T.ht-ph2-Math.max(9,S(15))-S(8),1,S(8),B[3]);
      sp.drapeaux.push({x:T.x+1,y:sol-T.ht-ph2-Math.max(9,S(15))-S(8),
                        w:Math.max(6,S(9)),h:Math.max(4,S(6)),col:AMB.blason});
    } else {
      sp.brasier={x:T.x,y:sol-T.ht-S(2),r:S(14),c:'#ff9a3a'};
      sp.lampes.push({x:T.x,y:sol-T.ht-S(2),c:'#ff8a2a',r:S(18)});
      sp.fumees.push({x:T.x,y:sol-T.ht-S(4),t:1,d:0.8});
    }
  }
  // lierre au pied de la courtine, corbeaux sur les créneaux
  for(let k=0;k<RI(1,3);k++){
    const cl=chance(.5)?-1:1, lw=Math.max(6,Math.round(w*R(0.08,0.18)));
    lierre(c, x0+RI(0,Math.max(1,w-lw)), sol-1, lw, Math.round(h*R(0.30,0.75)), cl);
  }
  for(let k=0,n=RI(2,4);k<n;k++){
    const rx=x0+RI(2,w-3), ry=yh-Math.max(5,S(8))-1;
    fr(c,rx,ry-3,2,3,'#1e2028'); fr(c,rx,ry-4,2,2,'#1e2028');
    fr(c,rx+2,ry-2,1,2,'#1e2028');
  }
  brume(sp,row); return sp;
}
/* ---------- ÉGLISE ----------
   La chapelle du bourg, sous le vocable de Sainte-Gamberge. Nef de
   pierre, clocher en flèche, vitraux chauds — et le poisson d'or qui
   tient lieu de croix, car ici l'on vénère autrement. */
/* ---------- L'ÉGLISE ----------
   Reprise à zéro. C'est le seul édifice que l'on voit de partout : il doit
   se lire à sa SILHOUETTE avant tout détail — clocher, flèche, croix. Mais
   une église ne se résume pas à une tour collée sur une grange. Ce qui la
   fait, c'est l'ARTICULATION : contreforts qui rythment la nef et reçoivent
   la poussée des voûtes, bas-côté plus bas que le vaisseau central, portail
   en gradins de voussures, rose au-dessus, corniche à modillons, et le
   clocher qui monte par ÉTAGES décroissants — mur plein, puis baie
   géminée, puis abat-son, puis flèche. Chaque étage marqué d'un bandeau.
   ---------------------------------------------------------------- */
function genEglise(row){
  const S=v=>Math.max(1,sc(row,v));
  const nw=S(50), nh=S(23), bcH=S(14);          // nef, bas-côté
  const tw2=S(17), th=S(46), fl=S(24);          // clocher, flèche
  const SW=nw+tw2+S(12), SH=th+fl+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, p=AMB.pierre, bois=AMB.bois;
  const toit=chance(.55)?PAL.toits.ardoise:pick(AMB.toits);
  const gauche=chance(.5);                       // clocher à gauche ou à droite
  /* Le clocher doit être ADOSSÉ à la nef, pas planté à côté : on cale les
     deux volumes l'un contre l'autre avec deux pixels de recouvrement. */
  const nx=gauche?S(3)+tw2-S(2):S(6);
  const tx=gauche?S(3):nx+nw-S(2);
  const cxN=nx+(nw>>1);

  /* --- LA NEF : vaisseau central, bas-côté, contreforts --- */
  const nyC=bas-nh;
  mur(c,nx,nyC,nw,nh,p,3);
  // bas-côté : un appentis plus bas, côté opposé au clocher
  const bcX=gauche?nx+nw-S(1):nx-S(11);
  { const bw=S(12);
    mur(c,gauche?nx+nw:nx-bw,bas-bcH,bw,bcH,p,3);
    const ax=gauche?nx+nw:nx-bw;
    for(let j=0;j<S(6);j++)                        // toit en appentis
      fr(c,gauche?ax-1+j:ax-1,bas-bcH-S(6)+j,bw+2-j,1, j%3===2?toit[2]:(j%6===0?toit[0]:toit[1]));
    fr(c,ax-1,bas-bcH-1,bw+2,2,p[0]);
    for(let k=0;k<2;k++){                          // baies basses du bas-côté
      fenetre(sp,c,ax+S(3)+k*S(6),bas-bcH+S(4),Math.max(3,S(4)),Math.max(5,S(7)),
              bois,'#4a5c46',{arc:true,vitrail:true,on:true});
    } }
  // contreforts : ils rythment la nef, c'est eux qui font l'échelle
  const nc=Math.max(3,Math.round(nw/S(13)));
  for(let k=0;k<=nc;k++){
    const cx2=Math.round(nx+k*(nw/nc))-S(2);
    for(let j=0;j<nh;j++){
      const t=j/nh, wj=Math.max(2,Math.round(S(5)*(0.62+0.38*t)));
      fr(c,cx2,bas-j-1,wj,1,(j%3)===2?p[3]:p[1]);
      fr(c,cx2,bas-j-1,1,1,clair(p[0],.20));
      fr(c,cx2+wj-1,bas-j-1,1,1,ombre(p[3],.24));
    }
    fr(c,cx2-1,nyC-S(2),S(6),S(3),p[0]);          // larmier de couronnement
    fr(c,cx2-1,nyC-S(2),S(6),1,clair(p[0],.26));
  }
  // hautes baies du vaisseau, entre les contreforts
  for(let k=0;k<nc;k++){
    const wx=Math.round(nx+(k+0.5)*(nw/nc))-S(3);
    fenetre(sp,c,wx,nyC+S(5),Math.max(4,S(6)),Math.max(7,nh-S(11)),
            bois,'#4a5c46',{arc:true,vitrail:true,on:true});
  }
  // corniche à modillons puis toiture de la nef
  fr(c,nx-S(2),nyC-S(3),nw+S(4),S(3),p[1]);
  fr(c,nx-S(2),nyC-S(3),nw+S(4),1,clair(p[0],.24));
  for(let i=0;i<nw+S(4);i+=Math.max(3,S(4))) fr(c,nx-S(2)+i,nyC-1,2,1,p[3]);
  toitTrapeze(c,nx-S(4),nyC-S(3)-S(18),nw+S(8),S(18),toit);

  /* --- LE PORTAIL : voussures en gradins, tympan, rose au-dessus --- */
  { const pw=Math.max(11,S(15)), px2=cxN-(pw>>1), phh=nh-S(7);
    for(let g2=0;g2<3;g2++){                       // trois rouleaux de voussure
      const ew=pw+S(2)*(3-g2), ex=cxN-(ew>>1);
      const eh=phh+S(1)*(3-g2);
      for(let j=0;j<Math.round(ew*0.5);j++){
        const r2=Math.round(ew*0.5);
        const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j))));
        if(d>0){ fr(c,ex,bas-eh+j,d+1,1,g2%2?p[1]:p[2]); fr(c,ex+ew-d-1,bas-eh+j,d+1,1,g2%2?p[1]:p[2]); }
      }
      fr(c,ex,bas-eh+Math.round(ew*0.5),1,eh-Math.round(ew*0.5),g2%2?p[1]:p[2]);
      fr(c,ex+ew-1,bas-eh+Math.round(ew*0.5),1,eh-Math.round(ew*0.5),g2%2?p[1]:p[2]);
    }
    // tympan sombre, puis les deux vantaux
    for(let j=0;j<phh;j++){
      let wj=pw, xj=px2; const r2=pw>>1;
      if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj=pw-2*d; xj=px2+d; }
      fr(c,xj,bas-phh+j,wj,1, j<r2?'#3a3228':'#241d16');
    }
    for(let i=1;i<pw;i+=Math.max(2,S(3))) fr(c,px2+i,bas-phh+(pw>>1),1,phh-(pw>>1),bois[1]);
    fr(c,cxN,bas-phh+(pw>>1),1,phh-(pw>>1),bois[0]);   // trumeau
    fr(c,cxN-S(2),bas-Math.round(phh*0.5),2,2,'#8d9199');
    fr(c,cxN+S(1),bas-Math.round(phh*0.5),2,2,'#8d9199');
    for(let k=0;k<3;k++) fr(c,px2-S(1),bas-k*1-1,pw+S(2),1,p[2]);   // emmarchement
    // rose
    const ry=nyC+S(5), rr=Math.max(4,S(7));
    disque(c,cxN,ry,rr+1,p[1]);
    disque(c,cxN,ry,rr,'#2a2434');
    for(let a=0;a<8;a++){ const an=a/8*6.28;
      trait(c,cxN,ry,cxN+Math.cos(an)*rr,ry+Math.sin(an)*rr,p[2],1); }
    disque(c,cxN,ry,Math.max(1,Math.round(rr*0.32)),'#6b4a7a');
    for(let a=0;a<8;a++){ const an=a/8*6.28+0.39;
      fr(c,cxN+Math.round(Math.cos(an)*rr*0.66),ry+Math.round(Math.sin(an)*rr*0.66),1,1,
         pick(['#a8455a','#4478b4','#c9a24a','#4f8a5f'])); }
    sp.fenetres.push({x:cxN-rr+1,y:ry-rr+1,w:2*rr-1,h:2*rr-1,ph:rnd()*6.28,on:true,vitrail:true});
  }

  /* --- LE CLOCHER : quatre étages décroissants, chacun sous son bandeau --- */
  const ty=bas-th;
  mur(c,tx,ty,tw2,th,p,3);
  for(const s2 of [0,1]){                          // chaînes d'angle
    for(let j=0;j<th;j+=4){
      const w2=(j/4|0)%2?S(4):S(3);
      fr(c,s2?tx+tw2-w2:tx,ty+j,w2,4,(j%8)?p[0]:p[1]);
      fr(c,s2?tx+tw2-w2:tx,ty+j,w2,1,clair(p[0],.16));
    } }
  const et=[0.0,0.34,0.60,0.82];
  for(let k=1;k<et.length;k++){                    // bandeaux moulurés
    const by=ty+Math.round(th*et[k]);
    fr(c,tx-S(1),by,tw2+S(2),S(2),p[1]);
    fr(c,tx-S(1),by,tw2+S(2),1,clair(p[0],.24));
    fr(c,tx-S(1),by+S(2),tw2+S(2),1,'rgba(12,16,24,.30)');
  }
  // étage du beffroi : baie géminée sous arc de décharge
  { const by=ty+Math.round(th*0.36), bh2=Math.round(th*0.20);
    const gw=Math.round(tw2*0.62), gx=tx+((tw2-gw)>>1);
    fr(c,gx-1,by,gw+2,bh2+2,p[3]);
    for(let m=0;m<2;m++){
      const ow=Math.max(3,Math.round((gw-3)/2)), ox=gx+1+m*(ow+1);
      for(let j=0;j<bh2;j++){
        let wj=ow, xj=ox; const r2=ow>>1;
        if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj=ow-2*d; xj=ox+d; }
        fr(c,xj,by+1+j,wj,1,'#181410');
      }
      sp.fenetres.push({x:ox,y:by+1,w:ow,h:bh2,ph:rnd()*6.28,on:chance(.5)});
    }
    fr(c,gx+((gw-1)>>1),by+1,1,bh2,p[1]);          // colonnette centrale
    fr(c,gx+((gw-1)>>1)-1,by+1,3,1,p[0]);
    // la cloche, visible dans l'ouverture
    const cb=gx+Math.round(gw*0.28), cy2=by+Math.round(bh2*0.42);
    fr(c,cb-1,cy2,4,Math.max(3,S(4)),'#8a6a2a');
    fr(c,cb-1,cy2,4,1,'#c9a24a');
    fr(c,cb-2,cy2+Math.max(3,S(4)),6,1,'#8a6a2a');
    fr(c,cb,cy2-1,1,1,'#6a5220');
    sp.cloche={x:cb+1,y:cy2};
  }
  // étage des abat-son : lames obliques
  { const by=ty+Math.round(th*0.62), bh2=Math.round(th*0.16);
    const gw=Math.round(tw2*0.52), gx=tx+((tw2-gw)>>1);
    fr(c,gx-1,by+S(2),gw+2,bh2,p[3]);
    fr(c,gx,by+S(2)+1,gw,bh2-2,'#1c1811');
    for(let j=1;j<bh2-2;j+=2){
      fr(c,gx,by+S(2)+j,gw,1,bois[2]);
      fr(c,gx,by+S(2)+j,gw,1,clair(bois[2],.14));
      fr(c,gx,by+S(2)+j+1,gw,1,ombre(bois[1],.30));
    } }
  // horloge sur une face
  if(chance(.55)){
    const hy=ty+Math.round(th*0.12), rr=Math.max(3,S(5));
    disque(c,tx+(tw2>>1),hy+rr,rr+1,p[1]);
    disque(c,tx+(tw2>>1),hy+rr,rr,'#e4dcc6');
    for(let a=0;a<12;a++){ const an=a/12*6.28;
      fr(c,tx+(tw2>>1)+Math.round(Math.cos(an)*(rr-1)),hy+rr+Math.round(Math.sin(an)*(rr-1)),1,1,'#5a4a2e'); }
    trait(c,tx+(tw2>>1),hy+rr,tx+(tw2>>1)+Math.round(rr*0.5),hy+rr-Math.round(rr*0.4),'#2e2418',1);
    trait(c,tx+(tw2>>1),hy+rr,tx+(tw2>>1),hy+rr-Math.round(rr*0.75),'#2e2418',1);
    sp.lampes.push({x:tx+(tw2>>1),y:hy+rr,c:'#ffeec0',r:S(9)});
  }

  /* --- COURONNEMENT : galerie, gâbles, flèche, croix --- */
  fr(c,tx-S(3),ty-S(3),tw2+S(6),S(3),p[1]);
  fr(c,tx-S(3),ty-S(3),tw2+S(6),1,clair(p[0],.26));
  for(let i=0;i<tw2+S(6);i+=Math.max(3,S(4))) fr(c,tx-S(3)+i,ty-1,2,1,p[3]);
  { const gy=ty-S(3)-S(5);                          // galerie ajourée
    fr(c,tx-S(2),gy,tw2+S(4),S(5),p[2]);
    for(let i=1;i<tw2+S(4);i+=Math.max(3,S(3))) fr(c,tx-S(2)+i,gy+1,1,S(4),p[0]);
    fr(c,tx-S(2),gy,tw2+S(4),1,clair(p[0],.22));
    for(const s2 of [0,1]){                         // pinacles d'angle
      const px3=s2?tx+tw2+S(1):tx-S(3);
      fr(c,px3,gy-S(5),S(3),S(6),p[1]);
      poivriere(c,px3+1,gy-S(9),S(2),S(4),toit);
    } }
  const fy=ty-S(3)-S(5)-fl;
  poivriere(c,tx+(tw2>>1),fy,Math.round(tw2*0.46),fl,toit);
  // lucarnes de la flèche
  for(const s2 of [-1,1]){
    const lx=tx+(tw2>>1)+s2*Math.round(tw2*0.22);
    fr(c,lx-1,fy+Math.round(fl*0.62),3,Math.max(3,S(4)),ombre(toit[2],.20));
    fr(c,lx,fy+Math.round(fl*0.62)+1,1,Math.max(2,S(3)),'#181410');
  }
  { const cx3=tx+(tw2>>1);                          // croix et coq
    fr(c,cx3,fy-S(9),1,S(8),'#c9a24a');
    fr(c,cx3-S(2),fy-S(7),S(5),1,'#c9a24a');
    fr(c,cx3-1,fy-S(9),1,1,'#e0be6a');
    girouette(sp,c,cx3,fy-S(18),S(9),'#c9a24a'); }

  lanternePotence(sp,c,nx+S(3),nyC+S(4),bois);
  if(chance(.7)) chatAssis(c,nx+RI(S(6),Math.max(S(7),nw-S(6))),bas-1,pick(PELAGES),chance(.5)?1:-1);
  chatteries(sp,c,nx,bas,nw,nh,row);
  brume(sp,row); return sp;
}
/* ---------- TOUR DE GUET ----------
   Le poste haut de la garde. Guetteur à moustaches, cornes à feu,
   et un coussin officiel au sommet — la ronde est longue. */
/* ---------- LA TOUR ----------
   Reprise à zéro. Une tour n'est pas un mur vertical coiffé d'un chapeau :
   c'est un CYLINDRE, et tout le dessin doit le dire — lumière qui tourne,
   assises dont les joints plongent aux bords, talus au pied couronné de son
   bourrelet. Le reste est militaire et se lit de loin : archères en croix
   pattée décalées d'un étage à l'autre, bretèche en encorbellement au-dessus
   de la porte, mâchicoulis sur corbeaux, parapet crénelé dont les merlons
   sont eux-mêmes percés. La porte est haute, au premier étage, atteinte par
   un escalier de bois qu'on peut abattre : c'est ça, une tour de guet.
   ---------------------------------------------------------------- */
function genTour(row){
  const S=v=>Math.max(1,sc(row,v));
  const larg=S(26), haut=S(62), talus=S(12);
  const toitH=S(20);
  const SW=larg+S(34), SH=haut+toitH+S(16);
  const sp=sprite(SW,SH), c=sp.g;
  const cx=SW>>1, bas=SH-1, p=AMB.pierre, bois=AMB.bois;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const toit=chance(.5)?PAL.toits.ardoise:pick(AMB.toits);
  const coiffe=chance(.62);                          // poivrière, sinon terrasse crénelée

  // motte de terre et affleurement rocheux
  for(let i=-S(16);i<larg+S(16);i++){
    const t=Math.abs(i-larg/2)/(larg/2+S(16));
    const hh=Math.round(S(5)*(1-t*t));
    for(let j=0;j<hh;j++)
      fr(c,cx-(larg>>1)+i,bas-j,1,1, j>hh-2?'#6d8b4a':(j%2?'#5d7a3f':'#537035'));
  }
  const sol=bas-S(3);
  for(let k=0,n=S(7);k<n;k++){
    const rx=cx+RI(-Math.round(larg*0.9),Math.round(larg*0.9));
    fr(c,rx,sol-RI(0,S(3)),RI(2,S(5)),RI(1,3),chance(.5)?p[2]:p[3]);
  }

  /* --- le fût --- */
  futRond(c,cx,sol,haut,larg,p,3,talus);

  /* --- porte haute et son escalier de bois abattable --- */
  const py=sol-talus-S(6);
  { const dw=Math.max(7,S(10)), dh=Math.max(10,S(15));
    fr(c,cx-(dw>>1)-2,py-dh-2,dw+4,dh+2,p[0]);
    for(let j=0;j<dh;j++){
      let wj=dw, xj=cx-(dw>>1); const r2=dw>>1;
      if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj=dw-2*d; xj=cx-(dw>>1)+d; }
      fr(c,xj,py-dh+j,wj,1,'#1d1710');
    }
    for(let i=1;i<dw;i+=Math.max(2,S(3))) fr(c,cx-(dw>>1)+i,py-dh+(dw>>1),1,dh-(dw>>1),B[1]);
    fr(c,cx-(dw>>1),py-dh+(dw>>1),dw,Math.max(1,S(2)),B[0]);
    fr(c,cx+(dw>>1)-2,py-Math.round(dh*0.5),2,2,'#8d9199');
    // escalier de bois adossé, sur chandelles
    const sQ=chance(.5)?1:-1;
    const ex0=cx+sQ*((larg>>1)+S(2));
    for(let k=0;k<S(9);k++){
      const t=k/S(9);
      const xx=Math.round(ex0+sQ*t*S(13)), yy=Math.round(py-t*(py-sol));
      fr(c,xx-Math.max(2,S(3)),yy,Math.max(4,S(6)),Math.max(1,S(2)),B[0]);
      fr(c,xx-Math.max(2,S(3)),yy,Math.max(4,S(6)),1,B[2]);
      if(k%3===0) fr(c,xx,yy+S(2),Math.max(2,S(2)),sol-yy-S(2),B[1]);
    }
    trait(c,ex0,py-S(4),ex0+sQ*S(13),sol-S(6),B[1],1);   // main courante
    lanternePotence(sp,c,cx+(dw>>1)+S(2),py-dh+S(2),bois); }

  /* --- archères : trois registres décalés, en croix pattée --- */
  for(let e=0;e<3;e++){
    const ay=sol-talus-S(16)-e*Math.round((haut-talus-S(22))/3);
    const n=e%2?2:3;
    for(let k=0;k<n;k++){
      const ax=cx+Math.round((k-(n-1)/2)*larg*0.30);
      const ah=Math.max(6,S(9));
      archere(c,ax,ay-ah,ah,p,chance(.7));
      sp.fenetres.push({x:ax,y:ay-ah,w:1,h:ah,ph:rnd()*6.28,on:chance(.45)});
    }
  }
  /* --- bretèche en encorbellement au-dessus de la porte --- */
  { const bw=Math.max(8,S(12)), bh=Math.max(7,S(10));
    const by=py-Math.max(10,S(15))-S(4);
    for(let i=0;i<bw;i+=Math.max(2,S(3))){
      fr(c,cx-(bw>>1)+i,by+bh,Math.max(2,S(2)),Math.max(2,S(3)),p[1]);
      fr(c,cx-(bw>>1)+i,by+bh,1,Math.max(2,S(3)),clair(p[0],.18));
    }
    mur(c,cx-(bw>>1),by,bw,bh,p,3,'taille');
    fr(c,cx-(bw>>1)-1,by-1,bw+2,2,p[0]);
    fr(c,cx-(bw>>1)-1,by-1,bw+2,1,clair(p[0],.26));
    fr(c,cx-1,by+bh,2,Math.max(2,S(3)),'#15120e');      // trou de jet
    archere(c,cx,by+2,Math.max(4,S(5)),p,false);
    poivriere(c,cx,by-Math.max(4,S(6)),(bw>>1)+1,Math.max(4,S(6)),toit); }

  /* --- couronnement : mâchicoulis, parapet, poivrière ou terrasse --- */
  const cy=sol-haut;
  const cw=larg+S(6);
  machicoulis(c,cx-(cw>>1),cy,cw,p,Math.max(3,S(4)));
  { const pw=cw, ph2=Math.max(5,S(7));
    for(let i=0;i<pw-2;i+=Math.max(6,S(9))){
      const mw=Math.max(4,S(6));
      fr(c,cx-(pw>>1)+i,cy-ph2,mw,ph2,p[1]);
      fr(c,cx-(pw>>1)+i,cy-ph2,mw,1,clair(p[0],.26));
      fr(c,cx-(pw>>1)+i,cy-ph2,1,ph2,clair(p[0],.16));
      fr(c,cx-(pw>>1)+i+mw-1,cy-ph2,1,ph2,ombre(p[3],.24));
      if(mw>=4&&ph2>=6) fr(c,cx-(pw>>1)+i+((mw-1)>>1),cy-ph2+2,1,Math.max(2,ph2-4),'#15120e');
    }
    fr(c,cx-(pw>>1),cy-1,pw,2,p[2]); }
  if(coiffe){
    poivriere(c,cx,cy-Math.max(6,S(9))-toitH,Math.round(larg*0.52),toitH,toit);
    for(const s2 of [-1,1]){                             // lucarnes de la poivrière
      const lx=cx+s2*Math.round(larg*0.20);
      fr(c,lx-1,cy-Math.max(6,S(9))-Math.round(toitH*0.42),3,Math.max(3,S(4)),ombre(toit[2],.22));
      fr(c,lx,cy-Math.max(6,S(9))-Math.round(toitH*0.42)+1,1,Math.max(2,S(3)),'#181410');
    }
    fr(c,cx,cy-Math.max(6,S(9))-toitH-S(9),1,S(9),B[3]);
    sp.drapeaux.push({x:cx+1,y:cy-Math.max(6,S(9))-toitH-S(9),
                      w:Math.max(6,S(10)),h:Math.max(4,S(7)),col:AMB.blason});
  } else {
    // terrasse : brasier de guet et son fagot
    fr(c,cx-Math.max(3,S(4)),cy-Math.max(6,S(9))-S(4),Math.max(7,S(8)),Math.max(3,S(4)),'#3d3f45');
    for(let i=0;i<S(8);i+=2) fr(c,cx-Math.max(3,S(4))+i,cy-Math.max(6,S(9))-S(4),1,Math.max(3,S(4)),'#2b2d33');
    sp.brasier={x:cx,y:cy-Math.max(6,S(9))-S(5),r:S(16),c:'#ff9a3a'};
    sp.lampes.push({x:cx,y:cy-Math.max(6,S(9))-S(5),c:'#ff8a2a',r:S(22)});
    sp.fumees.push({x:cx,y:cy-Math.max(6,S(9))-S(7),t:1,d:1.1});
    fr(c,cx+S(5),cy-Math.max(6,S(9))-S(9),1,S(9),B[3]);
    sp.drapeaux.push({x:cx+S(6),y:cy-Math.max(6,S(9))-S(9),
                      w:Math.max(6,S(9)),h:Math.max(4,S(6)),col:AMB.blason});
  }
  // lierre au pied, nids dans les corbeaux
  { const cl=chance(.5)?-1:1, lw=Math.max(5,Math.round(larg*0.5));
    lierre(c, cl<0?cx-(larg>>1)-1:cx+(larg>>1)-lw+1, sol-1, lw, Math.round(haut*R(0.30,0.62)), cl); }
  for(let k=0,n=RI(1,3);k<n;k++){
    const nx2=cx+RI(-(cw>>1),(cw>>1)-2);
    fr(c,nx2,cy+3,Math.max(2,S(3)),2,'#6b5540');
    fr(c,nx2,cy+3,Math.max(2,S(3)),1,'#8a7050');
  }
  brume(sp,row); return sp;
}
/* ---------- REMPART ----------
   La muraille du bourg : courtine crénelée, archères, torches. Sur les
   créneaux, la relève est féline — c'est elle qui a réclamé le poste. */
/* ---------- LA COURTINE ----------
   Reprise à zéro, et dédoublée. Une enceinte ne se résume pas à un mur
   crénelé : elle alterne des PANS et des OUVRAGES. On tire donc deux
   variantes. Le pan courant montre le talus fruité, le cordon larmier qui
   rejette l'eau, les archères logées dans des niches à banquette, le
   chemin de ronde qu'on devine entre les merlons, une poterne basse et un
   tronçon de HOURD — cette galerie de bois qu'on montait sur les corbeaux
   en temps de siège, et qui est le détail qui date le mieux une enceinte.
   La variante fortifiée est la porte : deux demi-tours flanquantes, l'arc
   brisé, les rainures de herse, les mâchicoulis au-dessus du passage, les
   deux fentes des flèches du pont-levis et le tablier abaissé sur le fossé.
   ---------------------------------------------------------------- */
function genRempart(row){
  const S=v=>Math.max(1,sc(row,v));
  const estPorte=chance(.34);   // une enceinte alterne pans et ouvrages
  const w=estPorte?S(66):S(64), h=S(30), talus=S(8);
  const SW=w+S(16), SH=h+S(26);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const p=AMB.pierre, bois=AMB.bois;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const sol=bas-S(2);
  const yh=sol-h;
  let tours=null;

  // fossé et berge devant
  for(let i=0;i<SW;i++) fr(c,i,sol,1,SH-sol,i%3?'#5d7a3f':'#537035');
  fr(c,0,sol,SW,1,'#6d8b4a');

  /* --- le mur : talus fruité puis parement droit --- */
  for(let j=0;j<h;j++){
    const y=sol-j;
    let dw=0;
    if(j<talus) dw=Math.round(S(4)*(1-j/talus));
    fr(c,x0-dw,y,w+2*dw,1,p[1]);
  }
  mur(c,x0,yh,w,h-talus,p,4,'taille');
  for(let j=0;j<talus;j++){                        // le talus reste en moellon brut
    const y=sol-j, dw=Math.round(S(4)*(1-j/talus));
    fr(c,x0-dw,y,w+2*dw,1,(j%3)===2?p[3]:p[2]);
    if(j%3===0) for(let i=0;i<w+2*dw;i+=5) fr(c,x0-dw+i,y,1,1,p[3]);
    fr(c,x0-dw,y,1,1,clair(p[0],.20)); fr(c,x0+w+dw-1,y,1,1,ombre(p[3],.24));
  }
  // cordon larmier au sommet du talus
  fr(c,x0-S(5),sol-talus,w+S(10),Math.max(2,S(3)),p[0]);
  fr(c,x0-S(5),sol-talus,w+S(10),1,clair(p[0],.28));
  fr(c,x0-S(5),sol-talus+Math.max(2,S(3)),w+S(10),1,'rgba(12,16,24,.36)');

  if(!estPorte){
    /* --- PAN COURANT --- */
    // niches d'archère à banquette
    for(let k=0,n=Math.max(3,Math.round(w/S(15)));k<n;k++){
      const ax=Math.round(x0+(k+0.5)*(w/n));
      const nh=Math.max(10,S(15)), ny=yh+S(6);
      for(let j=0;j<nh;j++){
        let wj=Math.max(5,S(7)), xj=ax-(wj>>1); const r2=wj>>1;
        if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj-=2*d; xj+=d; }
        fr(c,xj,ny+j,wj,1,ombre(p[2],.22));
      }
      archere(c,ax,ny+Math.round(nh*0.30),Math.max(6,S(9)),p,chance(.6));
      sp.fenetres.push({x:ax,y:ny+Math.round(nh*0.30),w:1,h:Math.max(6,S(9)),ph:rnd()*6.28,on:chance(.35)});
    }
    // poterne basse, bouchée d'une porte ferrée
    { const dw=Math.max(6,S(9)), dx=x0+Math.round(w*(chance(.5)?0.18:0.78))-(dw>>1);
      const dh=Math.max(9,S(13));
      fr(c,dx-2,sol-dh-2,dw+4,dh+2,p[0]);
      porte(c,dx,sol-dh,dw,dh,B,true);
      fr(c,dx-1,sol-dh-1,dw+2,1,p[3]); }
    // tronçon de hourd sur ses corbeaux
    if(chance(.55)){
      const hw=Math.round(w*0.42), hx=x0+Math.round(w*(chance(.5)?0.06:0.52));
      const hy=yh-S(9);
      for(let i=0;i<hw;i+=Math.max(3,S(5))){
        fr(c,hx+i,yh-S(2),Math.max(2,S(3)),Math.max(3,S(4)),B[1]);
        fr(c,hx+i,yh-S(2),1,Math.max(3,S(4)),B[2]);
      }
      fr(c,hx-1,hy+S(7),hw+2,Math.max(2,S(3)),B[0]);
      fr(c,hx-1,hy+S(7),hw+2,1,B[2]);
      for(let i=0;i<hw;i+=Math.max(2,S(3))) fr(c,hx+i,hy,1,S(7),B[1]);
      fr(c,hx-1,hy,hw+2,Math.max(2,S(2)),B[0]);
      for(let j=0;j<Math.max(3,S(5));j++)
        _rang(c,hx-S(2)+j,hy-Math.max(3,S(5))+j,hw+S(4)-2*j,PAL.toits.ocre,(j/3)|0,'bardeau');
      for(let i=Math.max(2,S(3));i<hw;i+=Math.max(5,S(7))) fr(c,hx+i,hy+S(7)+Math.max(2,S(3)),1,Math.max(2,S(3)),'#15120e');
    }
  } else {
    /* --- LA PORTE FORTIFIÉE --- */
    const gw=Math.max(15,S(22)), gx=cx-(gw>>1);
    // passage en arc brisé
    const gh=Math.max(16,S(24));
    fr(c,gx-3,sol-gh-3,gw+6,gh+3,p[0]);
    for(let j=0;j<gh;j++){
      const t=j/Math.max(1,gh-1);
      let wj=gw, xj=gx;
      const r2=Math.round(gw*0.58);
      if(j<r2){                                    // arc brisé : deux arcs de cercle
        const q=1-(r2-j)/r2;
        const d=Math.round((gw*0.5)*(1-Math.sqrt(Math.max(0,1-Math.pow(1-q,1.7)))));
        wj=gw-2*d; xj=gx+d;
      }
      fr(c,xj,sol-gh+j,wj,1, mix('#15120e','#2e2820',Math.pow(t,0.7)));
    }
    for(let j=0;j<Math.round(gw*0.58);j++){        // claveaux
      const r2=Math.round(gw*0.58), q=1-(r2-j)/r2;
      const d=Math.round((gw*0.5)*(1-Math.sqrt(Math.max(0,1-Math.pow(1-q,1.7)))));
      if(d>0){ fr(c,gx-1,sol-gh+j,d+1,1,(j%2)?p[1]:p[2]); fr(c,gx+gw-d-1,sol-gh+j,d+1,1,(j%2)?p[1]:p[2]);
               fr(c,gx-1,sol-gh+j,1,1,p[3]); }
    }
    // rainures de herse et herse à demi descendue
    for(const s2 of [0,1]){
      const rx=s2?gx+gw-2:gx;
      fr(c,rx,sol-gh+Math.round(gw*0.5),2,gh-Math.round(gw*0.5),ombre(p[3],.30));
    }
    { const hy=sol-gh+Math.round(gh*0.30), hh=Math.round(gh*0.34);
      for(let i=1;i<gw;i+=Math.max(2,S(3))) fr(c,gx+i,hy,1,hh,'#5e626a');
      for(let j=0;j<hh;j+=Math.max(3,S(4))) fr(c,gx+1,hy+j,gw-2,1,'#5e626a');
      for(let i=1;i<gw;i+=Math.max(2,S(3))) fr(c,gx+i,hy+hh,1,Math.max(2,S(3)),'#8d9199'); }
    // mâchicoulis au-dessus du passage + assommoir
    machicoulis(c,gx-S(3),sol-gh-S(7),gw+S(6),p,Math.max(3,S(4)));
    // fentes des flèches du pont-levis
    for(const s2 of [-1,1]){
      const fx=cx+s2*Math.round(gw*0.34);
      fr(c,fx-1,sol-gh-S(6),3,Math.max(6,S(9)),ombre(p[3],.34));
      fr(c,fx,sol-gh-S(6),1,Math.max(6,S(9)),'#15120e');
      trait(c,fx,sol-gh-S(6),cx+s2*Math.round(gw*0.46),sol-S(2),'#4a4a50',1);   // chaîne
    }
    // tablier du pont abaissé sur le fossé
    { const bw=Math.round(gw*0.9), bx2=cx-(bw>>1);
      fr(c,bx2,sol,bw,Math.max(2,S(3)),B[0]);
      fr(c,bx2,sol,bw,1,B[2]);
      for(let i=0;i<bw;i+=Math.max(3,S(4))) fr(c,bx2+i,sol,1,Math.max(2,S(3)),B[3]);
      fr(c,bx2,sol+Math.max(2,S(3)),bw,1,'rgba(12,16,24,.32)'); }
    // deux demi-tours flanquantes — dessinées à la toute fin, sinon le
    // parapet de la courtine leur passe par-dessus et l'ouvrage disparaît
    tours=()=>{ for(const s2 of [-1,1]){
      const tx=cx+s2*Math.round(gw*0.78);
      const tw2=Math.max(13,S(21)), th2=h+S(17);
      futRond(c,tx,sol,th2,tw2,p,3,talus);
      for(let e=0;e<2;e++) archere(c,tx,sol-talus-S(10)-e*S(11),Math.max(6,S(8)),p,true);
      machicoulis(c,tx-(tw2>>1)-2,sol-th2,tw2+4,p,Math.max(3,S(4)));
      const pw=tw2+4, ph2=Math.max(6,S(8));
      for(let i=0;i<pw-2;i+=Math.max(6,S(9))){
        const mw=Math.max(4,S(6));
        fr(c,tx-(pw>>1)+i,sol-th2-ph2,mw,ph2,p[1]);
        fr(c,tx-(pw>>1)+i,sol-th2-ph2,mw,1,clair(p[0],.26));
      }
      fr(c,tx,sol-th2-ph2-S(8),1,S(8),B[3]);
      sp.drapeaux.push({x:tx+1,y:sol-th2-ph2-S(8),w:Math.max(6,S(9)),h:Math.max(4,S(6)),col:AMB.blason});
      poivriere(c,tx,sol-th2-ph2-S(3),Math.round(tw2*0.56),Math.max(7,S(11)),
                chance(.5)?PAL.toits.ardoise:pick(AMB.toits));
    } };
    // écu aux armes de la cité, au-dessus de l'arc
    ecusson(c,cx-Math.max(4,S(5)),sol-gh-S(16),Math.max(8,S(10)),Math.max(10,S(13)),
            AMB.blason,pick(CHARGES),false);
  }

  /* --- parapet crénelé, chemin de ronde deviné entre les merlons --- */
  { const pw=w+S(4), px2=x0-S(2), ph2=Math.max(7,S(10));
    machicoulis(c,px2,yh-1,pw,p,Math.max(3,S(5)));
    const pasM=Math.max(7,S(11)), mw0=Math.max(5,S(7));
    for(let i=0;i<pw-2;i+=pasM){
      const mw=mw0;
      fr(c,px2+i,yh-1-ph2,mw,ph2,p[1]);
      fr(c,px2+i,yh-1-ph2,mw,1,clair(p[0],.26));
      fr(c,px2+i,yh-1-ph2,1,ph2,clair(p[0],.16));
      fr(c,px2+i+mw-1,yh-1-ph2,1,ph2,ombre(p[3],.26));
      if(ph2>=7) fr(c,px2+i+((mw-1)>>1),yh-1-ph2+2,1,Math.max(2,ph2-5),'#15120e');
    }
    // ce qu'on aperçoit derrière les merlons : lances, casques, une bannière
    for(let i=mw0+((pasM-mw0)>>1);i<pw;i+=pasM*2){
      if(!chance(.45)) continue;
      fr(c,px2+i,yh-1-ph2+2,1,Math.max(4,S(6)),'#6a6e77');
      fr(c,px2+i-1,yh-1-ph2+1,3,1,'#8d9199');
    } }
  if(tours) tours();
  if(chance(.6)){ const cl=chance(.5)?-1:1, lw=Math.max(6,Math.round(w*R(0.16,0.34)));
    lierre(c, cl<0?x0:x0+w-lw, sol-1, lw, Math.round(h*R(0.35,0.80)), cl); }
  brume(sp,row); return sp;
}
/* ---------- CASERNE ----------
   La garde du bourg : vingt-quatre pattes prêtes à la ronde. Bannière à
   la patte, râtelier d'armes, braséro devant la porte — moins pour se
   chauffer que parce qu'on y dort très bien. */
/* ---------- LA CASERNE ----------
   Reprise à zéro. Une caserne n'est ni une maison ni un château : c'est
   un CORPS DE GARDE. Trois signes suffisent et il faut les trois — la
   masse trapue de pierre percée d'archères plutôt que de fenêtres ; la
   galerie de bois en surplomb d'où l'on surveille la rue, avec ses
   boucliers pendus au garde-corps et son factionnaire ; et la cour
   d'exercice devant, râtelier de lances, cible de paille, bannière au
   mât. Le toit est bas et couvert d'ardoise : rien qui puisse brûler.
   ---------------------------------------------------------------- */
function genCaserne(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(56), sh=S(26), fh=S(14), toitH=S(15);
  const SW=w+S(30), SH=sh+fh+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const p=AMB.pierre, bois=AMB.bois;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const toit=PAL.toits.ardoise;

  socle(c,x0-S(2),bas-S(5),w+S(4),S(5),p);
  mur(c,x0,bas-sh,w,sh,p);
  // chaînage renforcé : deux contreforts talutés
  for(const s2 of [0,1]){
    const bx2=s2?x0+w-S(6):x0;
    for(let j=0;j<sh;j++){
      const t=j/sh, wj=Math.max(2,Math.round(S(6)*(0.55+0.45*t)));
      fr(c,s2?bx2+S(6)-wj:bx2,bas-j-1,wj,1, (j%3)===2?p[3]:p[1]);
      fr(c,s2?bx2+S(6)-1:bx2,bas-j-1,1,1, s2?p[3]:clair(p[0],.2));
    }
  }
  // porte cloutée sous arc, entre deux torchères
  { const dw=Math.max(8,S(12)), dx=cx-(dw>>1), dh=sh-S(9);
    fr(c,dx-2,bas-dh-3,dw+4,dh+3,p[3]);
    porte(c,dx,bas-dh,dw,dh,B,true);
    for(const s2 of [-1,1]){
      const tx=cx+s2*Math.round(dw*0.85);
      fr(c,tx,bas-dh-S(2),Math.max(2,S(3)),Math.max(4,S(6)),'#3d3f45');
      fr(c,tx-1,bas-dh-S(5),Math.max(4,S(5)),Math.max(2,S(3)),'#2b2d33');
      sp.lampes.push({x:tx+1,y:bas-dh-S(4),c:'#ffb45a',r:S(11)});
      sp.flamme={x:tx,y:bas-dh-S(5)};
    } }
  // archères : deux registres, jamais de fenêtre
  for(let e=0;e<2;e++){
    const ay=bas-sh+S(5)+e*Math.round((sh-S(12))*0.55);
    for(let k=0;k<5;k++){
      const ax=Math.round(x0+S(6)+k*((w-S(12))/4));
      if(Math.abs(ax-cx)<S(9)&&e===1) continue;
      fr(c,ax-2,ay-1,5,Math.max(7,S(10)),p[3]);
      fr(c,ax-1,ay,3,Math.max(6,S(9)),p[2]);
      fr(c,ax,ay+1,1,Math.max(4,S(7)),'#15120e');
      fr(c,ax-1,ay+Math.max(2,S(3)),3,1,'#15120e');
      sp.fenetres.push({x:ax,y:ay+1,w:1,h:Math.max(4,S(7)),ph:rnd()*6.28,on:chance(.6)});
    }
  }

  // étage sous galerie : pan de bois sombre — posé AVANT, la galerie le surplombe
  colombage(c,x0-S(4),bas-sh-fh,w+S(8),fh,pick(['#b7a483','#a89578']),bois,'chevron');
  toitVarie(c,x0-S(7),bas-sh-fh-toitH,w+S(14),toitH,toit);

  /* --- la galerie de bois en surplomb --- */
  const gy=bas-sh;
  for(let i=0;i<w;i+=Math.max(3,S(5))){                          // corbeaux
    fr(c,x0+i,gy-Math.max(2,S(3)),Math.max(2,S(3)),Math.max(3,S(4)),B[1]);
    fr(c,x0+i,gy-Math.max(2,S(3)),1,Math.max(3,S(4)),B[2]);
  }
  fr(c,x0-S(4),gy-Math.max(4,S(6)),w+S(8),Math.max(3,S(4)),B[0]);   // plancher
  fr(c,x0-S(4),gy-Math.max(4,S(6)),w+S(8),1,B[2]);
  fr(c,x0-S(4),gy-Math.max(4,S(6))+Math.max(3,S(4))-1,w+S(8),1,B[3]);
  { const gh=Math.max(6,S(9)), gt=gy-Math.max(4,S(6))-gh;           // garde-corps
    fr(c,x0-S(4),gt,w+S(8),Math.max(2,S(3)),B[1]);
    fr(c,x0-S(4),gt,w+S(8),1,B[2]);
    for(let i=0;i<w+S(8);i+=Math.max(3,S(4))) fr(c,x0-S(4)+i,gt,1,gh,B[1]);
    // boucliers pendus au garde-corps
    const n=Math.max(3,Math.round(w/S(13)));
    for(let k=0;k<n;k++){
      const bx2=Math.round(x0+S(2)+k*((w-S(4))/Math.max(1,n-1)))-S(4);
      const bw2=Math.max(6,S(9)), bh2=Math.round(bw2*1.15);
      const champ=(k%2)?AMB.blason:pick(PAL.blason);
      for(let j=0;j<bh2;j++){
        const t=j/(bh2-1);
        const wj = t<0.58 ? bw2 : Math.max(1,Math.round(bw2*(1-Math.pow((t-0.58)/0.42,1.5))));
        fr(c,bx2+((bw2-wj)>>1),gt+S(1)+j,wj,1, t<0.5?champ:ombre(champ,.14));
      }
      fr(c,bx2,gt+S(1),bw2,1,clair(champ,.28));
      charge(c,bx2+(bw2>>1),gt+S(1)+Math.round(bh2*0.44),Math.max(2,Math.round(bw2*0.22)),'#dfe3ea',
             pick(['patte','etoile','cle','marteau']));
    }
    // le factionnaire, adossé
    if(chance(.85)) chatAssis(c,x0+Math.round(w*R(0.2,0.8)),gt-1,pick(PELAGES),chance(.5)?1:-1);
  }
  // bannière au faîte
  { const mx=cx+RI(-S(6),S(6)), mh=Math.max(8,S(12));
    fr(c,mx,bas-sh-fh-toitH-mh,1,mh,B[3]);
    sp.drapeaux.push({x:mx+1,y:bas-sh-fh-toitH-mh,w:Math.max(6,S(9)),h:Math.max(4,S(6)),col:AMB.blason}); }

  /* --- la cour d'exercice --- */
  { const rx=x0-S(9);
    if(rx>S(2)){                                                  // râtelier de lances
      fr(c,rx,bas-S(9),Math.max(6,S(9)),Math.max(2,S(3)),B[1]);
      fr(c,rx,bas-S(9),Math.max(6,S(9)),1,B[2]);
      for(let i=0;i<S(9);i+=Math.max(2,S(3))){
        trait(c,rx+i,bas-1,rx+i+RI(-1,1),bas-S(9)-RI(S(6),S(12)),B[0],1);
        fr(c,rx+i-1,bas-S(9)-S(13),3,Math.max(3,S(4)),'#8d9199');
      } } }
  { const tx=x0+w+S(5);
    if(tx<SW-S(6)){                                               // cible de paille
      const rt=Math.max(4,S(7));
      fr(c,tx,bas-S(3),Math.max(2,S(3)),S(3),B[1]);
      for(let k=rt;k>0;k--)
        disque(c,tx+1,bas-S(3)-rt,k, (k%2)?'#c4a254':'#a68841');
      disque(c,tx+1,bas-S(3)-rt,Math.max(1,Math.round(rt*0.28)),'#8c3b34');
      for(let k=0;k<RI(1,3);k++)                                   // flèches plantées
        fr(c,tx+1+RI(-rt+1,rt-1),bas-S(3)-rt+RI(-rt+1,rt-1),Math.max(3,S(4)),1,'#5c4128'); } }
  /* --- le feu de camp de la garde : cercle de pierres, bûches en étoile,
     braises, et la flamme animée du brasier — c'est lui qui tient la cour
     éveillée la nuit --- */
  { /* devant la façade, décalé de la porte : c'est la cour de veille */
    const fx=x0+Math.round(w*(chance(.5)?R(0.10,0.24):R(0.72,0.88)));
    if(fx>S(3)&&fx+S(11)<SW){
      const fy=bas-1, rc2=Math.max(4,S(6));
      fr(c,fx-rc2,fy,2*rc2+1,1,'rgba(18,14,9,.30)');
      for(let a=0;a<10;a++){ const an=a/10*6.28;
        fr(c,fx+Math.round(Math.cos(an)*rc2),fy-1+Math.round(Math.sin(an)*rc2*0.42),
           Math.max(1,S(2)),Math.max(1,S(2)),(a%2)?p[2]:p[3]); }
      for(const an of [0.3,1.5,2.6]){                       // bûches en étoile
        trait(c,fx-Math.round(Math.cos(an)*rc2*0.8),fy-1-Math.round(Math.sin(an)*rc2*0.3),
                fx+Math.round(Math.cos(an)*rc2*0.8),fy-1+Math.round(Math.sin(an)*rc2*0.3),'#5a412a',1);
        trait(c,fx-Math.round(Math.cos(an)*rc2*0.8),fy-2-Math.round(Math.sin(an)*rc2*0.3),
                fx+Math.round(Math.cos(an)*rc2*0.8),fy-2+Math.round(Math.sin(an)*rc2*0.3),'#7d5a37',1);
      }
      for(let k=0;k<rc2;k++) if(chance(.6))                 // braises
        fr(c,fx+RI(-Math.round(rc2*0.5),Math.round(rc2*0.5)),fy-2,1,1,
           pick(['#ffe0a0','#ffb04a','#ff6a1a']));
      fr(c,fx-1,fy-4,3,2,'#ff8a2a'); fr(c,fx,fy-5,1,1,'#ffc35a');
      fr(c,fx,fy-4,1,1,'#ffe0a0');
      sp.brasier={x:fx,y:fy-3,r:S(14),c:'#ff9a3a'};
      sp.lampes.push({x:fx,y:fy-3,c:'#ff8a2a',r:S(18)});
      sp.fumees.push({x:fx,y:fy-5,t:0,d:0.8});
      // un garde assis à la veillée, une bûche en réserve
      if(chance(.8)) chatAssis(c,fx+(chance(.5)?-rc2-S(3):rc2+S(2)),fy,pick(PELAGES),chance(.5)?1:-1);
      fr(c,fx+rc2+S(2),fy-2,Math.max(4,S(6)),2,'#6b5134');
    } }
  chatteries(sp,c,x0,bas,w,sh,row);
  brume(sp,row); return sp;
}
/* ---------- FOUR BANAL ----------
   Le four du bourg : une gueule de pierre qui rayonne, des pains qui
   dorent, et une file de chats qui attendent leur part — la redevance
   se paie en miettes. */
/* ---------- LE FOUR BANAL ----------
   Repris à zéro. Ce n'était qu'un bloc de pierre percé d'un trou rouge. Le
   four banal est pourtant l'édifice le plus SOCIAL du bourg : on y cuit à
   tour de rôle, on y attend, on s'y chauffe l'hiver. Il se dessine donc en
   trois plans. Au fond la MASSE : la voûte du four, calotte de brique
   épaulée de pierre, dont on ne voit que la bouche en anse de panier et la
   hotte qui aspire la fumée. Devant, l'AIRE de travail sous son auvent
   charpenté sur poteaux — c'est le vide couvert qui fait le lieu. Au sol
   l'OUTILLAGE qui prouve l'usage : pelle à enfourner au long manche, râble,
   pétrin, planches de pains en attente, fagots de bourrée, banc.
   ---------------------------------------------------------------- */
function genCuisine(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(48), h=S(26), hotH=S(20), auvH=S(9);
  const SW=w+S(34), SH=h+hotH+auvH+S(8);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const p=AMB.pierre, briq=pick(PAL.brique), bois=AMB.bois;
  const B=['#8a6a45','#6b5134','#a8845a','#4a3826'];
  const toit=pick(AMB.toits);

  // aire pavée, creusée d'ornières devant la bouche
  for(let i=-S(8);i<w+S(8);i+=S(4))
    for(let j=0;j<S(3);j+=2)
      fr(c,x0+i+(((j/2)|0)%2?1:0),bas-S(2)+j,S(4)-1,2, chance(.5)?p[1]:p[2]);
  fr(c,x0-S(8),bas-S(3),w+S(16),1,p[3]);
  for(let k=0;k<S(9);k++) fr(c,cx+RI(-S(9),S(9)),bas-RI(0,S(2)),RI(1,3),1,'#4a4036');

  /* --- LA MASSE : socle de pierre, calotte de brique, hotte --- */
  socle(c,x0-S(2),bas-S(6),w+S(4),S(6),p);
  mur(c,x0,bas-h,w,h,p,4,'moellon');
  // la calotte : demi-dôme de brique qui déborde le socle
  { const dw=Math.round(w*0.72), dx=cx-(dw>>1), dh=Math.round(h*0.52);
    futBrique(c,bas-h+Math.round(h*0.10),dh,j=>{
      const t=(dh-1-j)/Math.max(1,dh-1);           // j : 0 en bas de la calotte
      const wj=Math.round(dw*Math.sqrt(Math.max(0.02,1-Math.pow(1-t,2))));
      return [cx-(wj>>1),wj];
    },briq,false);
    fr(c,dx-S(2),bas-h+Math.round(h*0.10)-1,dw+S(4),2,p[0]);      // cerclage de pierre
    fr(c,dx-S(2),bas-h+Math.round(h*0.10)-1,dw+S(4),1,clair(p[0],.24)); }
  // hotte tronconique + conduit
  { const hw0=Math.round(w*0.52), hw1=Math.max(S(7),Math.round(w*0.20));
    const hy=bas-h;
    futBrique(c,hy-hotH+1,hotH,j=>{
      const t=j/Math.max(1,hotH-1);
      const wj=Math.round(hw0+(hw1-hw0)*Math.pow(t,0.62));
      return [cx-(wj>>1),wj];
    },p,true);
    fr(c,cx-(hw1>>1)-2,hy-hotH,hw1+4,S(3),p[1]);
    fr(c,cx-(hw1>>1)-2,hy-hotH,hw1+4,1,clair(p[0],.26));
    fr(c,cx-(hw1>>1)-1,hy-hotH-S(3),hw1+2,S(3),'#4a4a50');
    for(let i=0;i<hw1+2;i+=2) fr(c,cx-(hw1>>1)-1+i,hy-hotH-S(3),1,S(3),'#33343a');
    for(let i=0;i<hw1;i++) if(chance(.6)) fr(c,cx-(hw1>>1)+i,hy-hotH+1,1,1,'rgba(24,20,18,.55)');
    sp.fumees.push({x:cx,y:hy-hotH-S(4),t:0,d:1.5});
    sp.fumees.push({x:cx-1,y:hy-hotH-S(4),t:1,d:0.5}); }

  /* --- LA BOUCHE : anse de panier, sole de pierre, braises --- */
  const gw=Math.max(13,S(19)), gx=cx-(gw>>1), gh=Math.max(9,S(13));
  { futBrique(c,bas-S(4)-gh-S(4),gh+S(4),()=>[gx-S(3),gw+S(6)],briq,false);   // ébrasement
    for(let j=0;j<gh;j++){
      let wj=gw, xj=gx;
      const r2=Math.round(gw*0.42);
      if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj=gw-2*d; xj=gx+d; }
      const t=j/Math.max(1,gh-1);
      fr(c,xj,bas-S(4)-gh+j,wj,1, mix('#1d0f07', t>0.55?'#ff9a2a':'#7a2c0c',Math.pow(t,1.5)));
    }
    for(let j=0;j<Math.round(gw*0.42);j++){                       // claveaux de l'anse
      const r2=Math.round(gw*0.42);
      const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j))));
      if(d>0){ fr(c,gx-1,bas-S(4)-gh+j,d+1,1,p[1]); fr(c,gx+gw-d-1,bas-S(4)-gh+j,d+1,1,p[1]);
               fr(c,gx-1,bas-S(4)-gh+j,1,1,p[3]); }
    }
    for(let i=0;i<gw;i++) if(chance(.55))                          // braises sur la sole
      fr(c,gx+i,bas-S(4)-RI(1,S(3)),1,1,pick(['#ffe0a0','#ffb04a','#ff6a1a']));
    fr(c,gx-S(2),bas-S(4),gw+S(4),Math.max(2,S(3)),p[0]);          // sole débordante
    fr(c,gx-S(2),bas-S(4),gw+S(4),1,clair(p[0],.24));
    // les pains en cuisson, silhouettés sur la braise
    for(let k=0,n=RI(2,4);k<n;k++){
      const px2=gx+S(3)+k*Math.round((gw-S(6))/n);
      ellipse(c,px2,bas-S(5),Math.max(2,S(3)),Math.max(1,S(2)),'#3a1e0c');
      fr(c,px2-1,bas-S(6),2,1,'#5a3212');
    }
    sp.brasier={x:cx,y:bas-S(4)-Math.round(gh*0.35),r:S(17),c:'#ff8a2a'};
    sp.lampes.push({x:cx,y:bas-S(4)-Math.round(gh*0.35),c:'#ff7a2a',r:S(24)}); }

  /* --- L'AUVENT : c'est le vide couvert qui fait le lieu --- */
  { const aw=w+S(20), ax=cx-(aw>>1), ay=bas-h-S(2);
    for(const s2 of [-1,1]){                                       // poteaux sur dés de pierre
      const px2=cx+s2*Math.round(aw*0.44);
      fr(c,px2-1,ay+S(2),Math.max(3,S(4)),bas-S(3)-(ay+S(2)),B[0]);
      fr(c,px2-1,ay+S(2),1,bas-S(3)-(ay+S(2)),B[2]);
      fr(c,px2-2,bas-S(5),Math.max(5,S(6)),S(3),p[1]);
      fr(c,px2-2,bas-S(5),Math.max(5,S(6)),1,clair(p[0],.22));
      trait(c,px2+(s2<0?2:0),ay+S(6),px2+s2*-S(6),ay+S(2),B[1],1); // aisselier
    }
    fr(c,ax,ay,aw,Math.max(3,S(4)),B[0]);                          // sablière
    fr(c,ax,ay,aw,1,B[2]);
    fr(c,ax,ay+Math.max(3,S(4))-1,aw,1,B[3]);
    for(let j=0;j<auvH;j++)                                        // couverture en appentis
      _rang(c,ax-S(2)+Math.round(j*0.4),ay-auvH+j,aw+S(4)-Math.round(j*0.8),toit,(j/3)|0,MATCOUR);
    fr(c,ax-S(2),ay-1,aw+S(4),2,toit[3]);
    fr(c,ax-S(2),ay+1,aw+S(4),1,'rgba(12,16,24,.34)');
    // linge et bottes d'herbes suspendus à la sablière : c'est ça, la vie
    sp.linge=[];
    for(let k=0,n=RI(2,4);k<n;k++){
      const lx=ax+S(4)+RI(0,Math.max(1,aw-S(10)));
      sp.linge.push({x:lx,y:ay+Math.max(3,S(4)),w:Math.max(3,S(5)),h:Math.max(4,S(6)),
                     col:pick(['#c9788f','#7fa8c9','#c9b45a','#8fb87f','#e4dcc6'])});
    } }

  /* --- L'OUTILLAGE --- */
  { const px2=x0-S(7);                                             // pelle à enfourner
    if(px2>S(2)){
      trait(c,px2,bas-1,px2+S(4),bas-h-S(4),B[0],1);
      trait(c,px2+1,bas-1,px2+S(5),bas-h-S(4),B[1],1);
      fr(c,px2+S(3),bas-h-S(8),Math.max(4,S(6)),Math.max(3,S(5)),B[2]);
      fr(c,px2+S(3),bas-h-S(8),Math.max(4,S(6)),1,clair(B[2],.2));
      trait(c,px2+S(6),bas-1,px2+S(8),bas-h-S(2),B[1],1);          // râble
      fr(c,px2+S(7),bas-h-S(4),Math.max(3,S(5)),2,'#4e5259');
    } }
  { const tx2=x0+w+S(3);                                           // pétrin + planches de pains
    if(tx2+S(12)<SW){
      fr(c,tx2,bas-S(9),S(12),Math.max(4,S(6)),B[0]);
      fr(c,tx2,bas-S(9),S(12),1,B[2]);
      for(let i=1;i<S(12);i+=Math.max(2,S(3))) fr(c,tx2+i,bas-S(3),1,S(3),B[1]);
      fr(c,tx2+1,bas-S(10),S(10),1,'#cbbfa0');
      for(let k=0;k<3;k++){                                        // pâtons à lever
        ellipse(c,tx2+S(2)+k*S(4),bas-S(11),Math.max(2,S(3)),Math.max(1,S(2)),'#e0d3ac');
        fr(c,tx2+S(2)+k*S(4)-1,bas-S(12),2,1,'#f0e6c8');
      }
      // planche de pains cuits, elle fume encore
      fr(c,tx2-S(2),bas-S(16),S(14),Math.max(2,S(3)),B[1]);
      for(let k=0;k<4;k++){
        const bx2=tx2-S(1)+k*S(4);
        ellipse(c,bx2,bas-S(17),Math.max(2,S(3)),Math.max(1,S(2)),'#a5712f');
        ellipse(c,bx2,bas-S(18),Math.max(1,S(2)),1,'#c4903f');
        if(k===1) sp.fumees.push({x:bx2,y:bas-S(19),t:3,d:0.35});
      }
    } }
  { for(let k=0,n=RI(3,6);k<n;k++){                                // fagots de bourrée
      const fx=x0-S(4)+RI(0,S(8)), fy=bas-S(4)-k*S(3);
      if(fx<S(2)) continue;
      fr(c,fx,fy,Math.max(5,S(8)),Math.max(2,S(3)),'#8a6a45');
      for(let i=0;i<S(8);i+=2) fr(c,fx+i,fy,1,Math.max(2,S(3)),chance(.5)?'#6b5134':'#a8845a');
      fr(c,fx+Math.round(S(8)*0.4),fy,1,Math.max(2,S(3)),'#4a3826');
    } }
  { const bx2=cx+RI(-S(10),S(10));                                 // banc d'attente
    fr(c,bx2-S(6),bas-S(6),S(12),Math.max(2,S(3)),B[0]);
    fr(c,bx2-S(6),bas-S(6),S(12),1,B[2]);
    fr(c,bx2-S(5),bas-S(4),Math.max(2,S(2)),S(4),B[1]);
    fr(c,bx2+S(4),bas-S(4),Math.max(2,S(2)),S(4),B[1]); }
  // cloche du fournier : elle appelle à la fournée
  { const cx2=x0-S(3), cy2=bas-h-S(6);
    if(cx2>S(2)){
      fr(c,cx2,cy2,Math.max(2,S(2)),S(10),B[1]);
      fr(c,cx2-S(3),cy2,Math.max(5,S(7)),Math.max(2,S(2)),B[0]);
      fr(c,cx2-S(2),cy2+S(2),Math.max(3,S(4)),Math.max(3,S(5)),'#8a6a2a');
      fr(c,cx2-S(2),cy2+S(2),Math.max(3,S(4)),1,'#c9a24a');
      fr(c,cx2-S(3),cy2+S(2)+Math.max(3,S(5)),Math.max(5,S(6)),1,'#8a6a2a');
      sp.cloche={x:cx2-1,y:cy2+S(4)};
    } }
  if(chance(.85)) chatDormi(c,cx+RI(-S(12),S(12)),bas-S(3),pick(PELAGES));
  if(chance(.6))  chatAssis(c,x0+w+S(2),bas-S(3),pick(PELAGES),-1);
  chatteries(sp,c,x0,bas,w,h,row);
  brume(sp,row); return sp;
}
/* ---------- LABORATOIRE D'ALCHIMIE ----------
   La tour qui penche, les bocaux qui fument, les vapeurs vertes. On y
   cherche l'or ; on y soigne surtout les boules de poils. Le chat du
   laboratoire est noir, comme il se doit. */
/* ---------- L'ATELIER D'ALCHIMIE ----------
   Repris à zéro d'après deux partis : la maison-cheminée (le fût de brique
   plaqué en pignon, contre lequel s'adosse le fourneau) et la boutique
   (vitrine basse où l'on voit l'étagère de fioles, l'alambic de cuivre et
   le chaudron). L'identité tient à la VITRINE — on lit l'intérieur — et
   aux TROIS ÉVENTS du toit qui crachent chacun une fumée d'une couleur
   différente, magenta, verte et bleue, avec des étincelles. C'est le seul
   bâtiment du bourg dont l'animation est visible de loin. */
function genAlchimie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(40), sh=S(19), fh=S(16), toitH=S(24);
  const chemW=S(11), chemH=S(19);
  const SW=w+chemW+S(30), SH=sh+fh+toitH+chemH+S(6);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1;
  const briq=pick(PAL.brique), bois=AMB.bois, p=AMB.pierre;
  const platre=pick(['#d8c9a8','#cdbb98','#c4b28e']);
  const tuile=pick([PAL.toits.tuileR,PAL.toits.tuileB,PAL.toits.ardoise]);
  const cote=chance(.5)?1:-1;                       // cheminée à gauche ou à droite
  const x0=Math.round(SW/2-cote*(chemW*0.55)-w/2), cx=x0+(w>>1);
  const chx=cote>0 ? x0-chemW+S(1) : x0+w-S(1);

  /* --- corps : pierre au rez, pan de bois sombre à l'étage --- */
  mur(c,x0,bas-sh,w,sh,p);
  colombage(c,x0-S(2),bas-sh-fh,w+S(4),fh,platre,bois,'losange');
  toitPignon(c,x0-S(5),bas-sh-fh-toitH,w+S(10),toitH,tuile);

  /* --- LA VITRINE : on voit l'officine --- */
  const vw=Math.max(13,Math.round(w*0.60)), vh=sh-S(6);
  const vx=x0+Math.round((w-vw)*(cote>0?0.62:0.38)), vy=bas-vh-S(2);
  fr(c,vx-2,vy-2,vw+4,vh+4,bois[1]);
  fr(c,vx-2,vy-2,vw+4,1,clair(bois[2],.2));
  fr(c,vx,vy,vw,vh,'#241d2c');                                   // fond d'officine
  // étagères et fioles
  const nEt=Math.max(2,Math.round(vh/S(6)));
  for(let e=0;e<nEt;e++){
    const ey=vy+S(2)+Math.round(e*(vh-S(3))/nEt);
    fr(c,vx+1,ey+S(4),vw-2,1,bois[2]);
    fr(c,vx+1,ey+S(4)+1,vw-2,1,ombre(bois[1],.3));
    for(let i=2;i<vw-2;i+=3){
      if(!chance(.82)) continue;
      const col=pick(['#e0559a','#5fd8a0','#5aa8e0','#e0b840','#b06fe0','#e07a40']);
      const hh=RI(2,Math.max(3,S(4)));
      fr(c,vx+i,ey+S(4)-hh,2,hh,col);
      fr(c,vx+i,ey+S(4)-hh,1,hh,clair(col,.35));
      fr(c,vx+i,ey+S(4)-hh-1,2,1,'#cfd6dd');                     // bouchon
    }
  }
  // alambic de cuivre
  { const ax=vx+vw-S(9), ay=vy+vh-S(3);
    if(ax>vx+2){
      const rq=Math.max(2,Math.round(S(4)*0.55));
      disque(c,ax,ay-rq-1,rq,'#8a5628');
      disque(c,ax,ay-rq-1,Math.max(1,rq-1),'#c78a45');
      fr(c,ax-1,ay-rq-2,2,1,'#e0aa62');
      fr(c,ax-1,ay-rq*2-1,2,rq,'#a86a34');
      trait(c,ax+1,ay-rq*2-1,ax+rq+2,ay-rq,'#c78a45',1);
      fr(c,ax+rq+1,ay-rq+1,1,rq,'#8a5628');
      fr(c,ax-2,ay-1,5,2,'#6d451f'); } }
  // chaudron : c'est lui qui fume
  { const kx=vx+S(4), ky=vy+vh-S(2);
    disque(c,kx,ky-S(2),Math.max(2,S(4)),'#3a3a40');
    disque(c,kx,ky-S(2),Math.max(1,S(3)),'#2b2b30');
    fr(c,kx-S(4),ky-S(4),S(8),1,'#4e5259');
    fr(c,kx-S(3),ky-S(4)+1,S(6),1,'#5fe8b2');
    for(let i=0;i<S(5);i++) fr(c,kx-S(2)+i,ky+1,1,1,chance(.5)?'#ff9a3a':'#e05a20');  // braises
    sp.chaudron={x:kx,y:ky-S(5),w:Math.max(5,S(7))};
    sp.lampes.push({x:kx,y:ky-S(4),c:'#5fe8b2',r:S(9)}); }
  // verre : voile bleuté + petits bois par-dessus l'intérieur
  for(let j=0;j<vh;j++){
    c.globalAlpha=0.16+0.16*(1-j/vh);
    fr(c,vx,vy+j,vw,1,'#bcd8e8');
  }
  c.globalAlpha=1;
  for(let i=Math.max(3,S(5));i<vw;i+=Math.max(3,S(5))) fr(c,vx+i,vy,1,vh,bois[1]);
  fr(c,vx,vy+Math.round(vh*0.45),vw,1,bois[1]);
  fr(c,vx+1,vy+1,1,1,'rgba(255,255,255,.5)');
  fr(c,vx-2,vy+vh,vw+4,2,bois[3]);                               // appui
  fr(c,vx-2,vy+vh,vw+4,1,clair(bois[2],.22));

  /* --- porte, enseigne à cornue, herbes suspendues --- */
  { const dw=Math.max(5,S(8));
    const dx=cote>0 ? x0+S(3) : x0+w-dw-S(3);
    porte(c,dx,bas-sh+S(5),dw,sh-S(5),bois,true);
    chatiere(c,dx+(dw>>1),bas,Math.max(4,S(6)),bois);
    lanternePotence(sp,c,dx+(cote>0?dw+S(3):-S(3)),bas-sh+S(2),bois);
    // enseigne pendante : cornue d'alchimiste sur champ sombre
    const ew=Math.max(8,S(10)), eh=Math.max(6,S(7));
    const ex=cote>0 ? x0-S(3) : x0+w-ew+S(3);
    fr(c,ex-1,bas-sh-S(3),ew+2,1,bois[3]);
    fr(c,ex+(ew>>1),bas-sh-S(3),1,S(3),bois[3]);
    fr(c,ex,bas-sh,ew,eh,'#2e2a3f');
    fr(c,ex,bas-sh,ew,1,'#4a4460'); fr(c,ex,bas-sh+eh-1,ew,1,'#1c1a28');
    { const gx=ex+(ew>>1)-1, gy=bas-sh+Math.round(eh*0.62), rq=Math.max(2,Math.round(eh*0.22));
      disque(c,gx,gy,rq,'#c9a24a');                       // panse de la cornue
      disque(c,gx,gy,Math.max(1,rq-1),'#e0be6a');
      fr(c,gx-1,gy-rq-Math.max(1,rq),2,Math.max(1,rq),'#c9a24a');   // col
      trait(c,gx+1,gy-rq-Math.max(1,rq),gx+rq+2,gy-1,'#c9a24a',1);  // bec recourbé
      fr(c,gx-rq,gy+rq,2*rq+1,1,'#8a6a2a'); }
    sp.enseigne={x:ex+(ew>>1),y:bas-sh+1,w:ew,h:eh}; }
  // bottes d'herbes séchées sous l'avant-toit
  for(let k=0,n=RI(2,4);k<n;k++){
    const hx=x0+S(3)+RI(0,Math.max(1,w-S(8))), hy=bas-sh-fh+S(1);
    fr(c,hx,hy,1,S(2),bois[1]);
    for(let i=0;i<3;i++) fr(c,hx-1+i,hy+S(2),1,RI(S(2),S(5)),pick(['#7a8a4a','#6d7a3c','#8a7a3a']));
  }
  // fenêtre de l'étage + fenêtre de comble
  fenetre(sp,c,x0+Math.round(w*0.5)-S(4),bas-sh-fh+S(5),Math.max(4,S(8)),Math.max(5,S(9)),
          bois,pick(PAL.volets),{volets:true,vitrail:chance(.5),on:true});
  fenetre(sp,c,cx-S(3),bas-sh-fh-Math.round(toitH*0.55),Math.max(3,S(5)),Math.max(4,S(6)),
          bois,pick(PAL.volets),{on:chance(.9)});

  /* --- LA CHEMINÉE ADOSSÉE --- */
  { const hCh=sh+fh+Math.round(toitH*0.7)+chemH;
    const top=bas-hCh;
    futBrique(c,top,hCh,j=>{
      const t=1-j/hCh;
      const wj=Math.max(S(6),Math.round(chemW*(1-0.24*t)));
      return [cote>0 ? chx+(chemW-wj) : chx, wj];  // fruit côté extérieur seulement
    },briq,false);
    fr(c,chx-2,top,chemW+4,S(3),p[1]);
    fr(c,chx-2,top,chemW+4,1,clair(p[0],.24));
    sp.fumees.push({x:chx+(chemW>>1),y:top-1,t:0,d:1.4});
    // fourneau ouvert au pied de la cheminée
    const fw2=Math.max(5,S(7)), fx2=chx+((chemW-fw2)>>1);
    fr(c,fx2-2,bas-S(10),fw2+4,S(10),briq[1]);
    fr(c,fx2-2,bas-S(10),fw2+4,1,clair(briq[0],.22));
    const fhh=S(7), r3=fw2>>1;
    for(let j=0;j<fhh;j++){
      const t=j/Math.max(1,fhh-1);
      let wj=fw2, xj=fx2;
      if(j<r3){ const d=r3-Math.round(Math.sqrt(Math.max(0,r3*r3-(r3-j)*(r3-j)))); wj=fw2-2*d; xj=fx2+d; }
      fr(c,xj,bas-fhh+j,wj,1,mix('#241008', t>0.5?'#ff8a2a':'#7a2c0c',Math.pow(t,1.5)));
    }
    sp.brasier={x:fx2+(fw2>>1),y:bas-S(4),r:S(10),c:'#ff8a2a'};
    // fagots
    for(let k=0;k<RI(2,4);k++)
      fr(c,chx+(cote>0?-S(5):chemW+S(1)),bas-S(2)-k*2,S(5),2,k%2?'#7a5c38':'#8f6d44'); }

  /* ---------------------------------------------------------------
     LES TROIS ÉVENTS. Ils étaient posés SUR la couverture, sans rien qui
     explique comment ils la traversent — le même défaut que les grandes
     souches avant qu'on leur donne un solin. On les fait donc passer par
     la primitive `souche` : embase noyée sous les tuiles, tablier de plomb
     en biseau amont, épaulement, ombre portée sur le versant aval. Ils sont
     alignés sur la MÊME pente, à des hauteurs décroissantes vers les rives
     comme le veut la pente du toit, et non plus dispersés au hasard.
     Chacun tire une fumée d'une couleur — magenta, verte, bleue — et l'on
     ajoute un quatrième conduit, un simple tuyau de cuivre coudé au ras du
     versant, d'où s'échappe la vapeur blanche du bain-marie.
     --------------------------------------------------------------- */
  { const ty=bas-sh-fh-toitH;
    const cols=[10,11,12];
    /* Les deux évents extérieurs sortaient DANS LE VIDE : sur un toit à
       pignon, la largeur du versant à une hauteur donnée vaut la largeur
       totale multipliée par la fraction de hauteur. À trente pour cent de
       hauteur, le toit ne fait plus que trente pour cent de large — un
       conduit posé à trente pour cent de la largeur, lui, était déjà hors
       tuile. On calcule donc la pente d'émergence À PARTIR de l'écart au
       faîte, au lieu de la fixer : plus la souche s'écarte, plus elle sort
       bas. C'est d'ailleurs ce que fait une vraie toiture. */
    const tw2=w+S(10);                             // largeur réelle du versant
    const ecarts=[-0.24,0.0,0.24].map(f=>Math.round(f*w));
    for(let k=0;k<3;k++){
      const ex=cx+ecarts[k];
      const pente=Math.min(0.80, 2*Math.abs(ecarts[k])/tw2 + 0.14);
      const orif=souche(sp,c,ex,ty,toitH,Math.max(5,S(8)),Math.max(4,S(5)),
                        briq,pente,'brique',cols[k]);
      // mitron ajouré : c'est par là que sort la couleur
      fr(c,orif.x-Math.max(2,S(3)),orif.y+2,Math.max(5,S(6)),1,'#6f737c');
      for(let i=0;i<Math.max(5,S(6));i+=2) fr(c,orif.x-Math.max(2,S(3))+i,orif.y+1,1,2,'#35363c');
      // la fumée teinte le mitron avant de s'élever
      const teinte=['#e88ad6','#96ec7e','#86c6ec'][k];
      sp.lampes.push({x:orif.x,y:orif.y+2,c:teinte,r:S(10)});
      for(let i=0;i<3;i++) if(chance(.6))
        fr(c,orif.x+RI(-1,1),orif.y+RI(1,3),1,1,'rgba(255,255,255,.30)');
    }
    // le serpentin de cuivre du bain-marie, couché sur le versant
    { const sx=cx-Math.round(w*0.30), sy=ty+Math.round(toitH*0.76);
      fr(c,sx,sy,Math.max(6,S(9)),2,'#a86a34');
      fr(c,sx,sy,Math.max(6,S(9)),1,'#d19352');
      fr(c,sx+Math.max(6,S(9))-2,sy-Math.max(3,S(5)),2,Math.max(3,S(5)),'#a86a34');
      fr(c,sx+Math.max(6,S(9))-2,sy-Math.max(3,S(5)),1,Math.max(3,S(5)),'#d19352');
      fr(c,sx+Math.max(6,S(9))-3,sy-Math.max(4,S(6)),4,1,'#8a5628');
      sp.fumees.push({x:sx+Math.max(6,S(9))-1,y:sy-Math.max(5,S(7)),t:3,d:0.7}); }
  }

  /* --- l'astronome du toit : lucarne d'observation et son télescope --- */
  { const ty=bas-sh-fh-toitH;
    const lw=Math.max(7,S(10)), lx=cx+Math.round(w*0.15)-(lw>>1);
    const ly=ty+Math.round(toitH*0.66);   // bas de pente : elle passe sous les évents
    fr(c,lx-2,ly,lw+4,Math.max(6,S(9)),platre);
    fr(c,lx-2,ly,1,Math.max(6,S(9)),ombre(platre,.22));
    fr(c,lx+lw+1,ly,1,Math.max(6,S(9)),ombre(platre,.30));
    toitPignon(c,lx-4,ly-Math.max(4,S(6)),lw+8,Math.max(4,S(6)),tuile);
    fr(c,lx,ly+2,lw,Math.max(3,S(5)),'#241d2c');
    for(let i=1;i<lw;i+=Math.max(2,S(3))) fr(c,lx+i,ly+2,1,Math.max(3,S(5)),bois[1]);
    fr(c,lx,ly+2,lw,1,'#15110c');
    // lunette pointée vers le ciel, sur son trépied
    const tx2=lx+lw+S(2), tyy=ly+Math.max(3,S(5));
    trait(c,tx2,tyy,tx2+Math.max(5,S(7)),tyy-Math.max(5,S(8)),'#6a6e77',1);
    trait(c,tx2+1,tyy,tx2+Math.max(5,S(7))+1,tyy-Math.max(5,S(8)),'#3d3f45',1);
    fr(c,tx2+Math.max(5,S(7)),tyy-Math.max(6,S(9)),Math.max(2,S(3)),Math.max(2,S(3)),'#c78a45');
    fr(c,tx2-1,tyy,Math.max(3,S(4)),1,'#3d3f45');
    fr(c,tx2,tyy,1,Math.max(2,S(3)),'#3d3f45'); }

  /* --- ce qui traîne dehors : caisses de fioles, mortier, corbeau --- */
  { const dx2=cote>0 ? x0+w+S(2) : x0-S(11);
    if(dx2>1&&dx2+S(10)<SW){
      fr(c,dx2,bas-S(7),S(9),Math.max(4,S(6)),'#6a4c31');          // caisse
      fr(c,dx2,bas-S(7),S(9),1,'#8a6a45');
      for(let i=1;i<S(9);i+=3) fr(c,dx2+i,bas-S(7),1,Math.max(4,S(6)),'#5a4128');
      for(let k=0;k<3;k++){                                        // fioles qui dépassent
        const fx=dx2+S(1)+k*S(3), col=pick(['#e0559a','#5fd8a0','#5aa8e0','#e0b840']);
        fr(c,fx,bas-S(10),2,Math.max(2,S(3)),col);
        fr(c,fx,bas-S(10),1,Math.max(2,S(3)),clair(col,.35));
        fr(c,fx,bas-S(11),2,1,'#cfd6dd');
      }
      // mortier et pilon posés dessus
      fr(c,dx2+S(6),bas-S(10),Math.max(3,S(4)),Math.max(2,S(3)),'#8d9199');
      fr(c,dx2+S(6),bas-S(10),Math.max(3,S(4)),1,'#b3b8c0');
      fr(c,dx2+S(7),bas-S(12),1,Math.max(2,S(3)),'#6a6e77');
    } }
  // le corbeau familier, perché sur l'enseigne ou le faîte
  { const rx=cx+RI(-Math.round(w*0.3),Math.round(w*0.3));
    const ry=bas-sh-fh-toitH+2;
    fr(c,rx,ry-3,2,3,'#1e2028'); fr(c,rx,ry-4,2,2,'#1e2028');
    fr(c,rx+(chance(.5)?2:-1),ry-4,1,1,'#c9a24a');                 // bec
    fr(c,rx,ry-4,1,1,'#31343e');
    fr(c,rx+2,ry-2,1,2,'#1e2028');
    fr(c,rx,ry,2,1,'rgba(14,18,26,.35)'); }

  chatteries(sp,c,x0,bas,w,sh+fh,row);
  brume(sp,row); return sp;
}
/* ---------- NURSERIE ----------
   Le cœur tendre du bourg : coussins, paniers, linge minuscule sur la
   corde, et la tour à plateformes où les chatons apprennent à retomber
   d'où ils sont tombés. */
/* ---------- LA NURSERIE ----------
   Reprise à zéro. Le seul bâtiment du bourg qui doive paraître DOUX. On
   inverse donc tous les réflexes du reste : pas de pierre au rez mais un
   soubassement bas et clair, pas de baie barreaudée mais une grande
   ouverture à volets rabattus d'où débordent les paniers, un toit très
   descendant qui couve la maison, et surtout le préau extérieur — enclos
   de piquets, arbre à chats, corde à linge de langes minuscules, berceau
   suspendu qui se balance. Rien de vertical ni d'aigu.
   ---------------------------------------------------------------- */
function genNurserie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(44), sh=S(19), fh=S(14), toitH=S(20);
  const SW=w+S(52), SH=sh+fh+toitH+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const bois=AMB.bois, p=AMB.pierre;
  const B=['#8a6a45','#6b5134','#a8845a','#4a3826'];
  const platre=pick(['#efe3c6','#e9dec4','#f2e8d0']);
  const toit=chance(.6)?'chaume':null, tuile=pick([PAL.toits.tuileR,PAL.toits.ocre]);
  const gai=['#c9788f','#7fa8c9','#c9b45a','#8fb87f','#b48fc9'];

  socle(c,x0-1,bas-S(4),w+2,S(4),p);
  /* Le pan de bois faisait remise ; la nurserie mérite un enduit TENDRE :
     crépi pastel, soubassement, et une frise de pattes peinte à hauteur de
     chaton — c'est elle qui dit la fonction du lieu. */
  { const past=pick(['#e8d5c4','#dcd0e4','#d4e0cc','#e6d8c0','#e0ccd2']);
    const OLD=MURCOUR; MURCOUR='crepi';
    fr(c,x0,bas-sh,w,sh,past); fr(c,x0-S(3),bas-sh-fh,w+S(6),fh,past);
    for(const [X2,Y2,W2,H2] of [[x0,bas-sh,w,sh],[x0-S(3),bas-sh-fh,w+S(6),fh]]){
      if(NTILE) for(let j=0;j<H2;j+=2) for(let i2=0;i2<W2;i2+=2){
        const nn=NT2((X2+i2)*0.6,(Y2+j)*0.6);
        if(nn<0.28) fr(c,X2+i2,Y2+j,2,2,ombre(past,.08));
        else if(nn>0.78) fr(c,X2+i2,Y2+j,2,2,clair(past,.07));
      }
      fr(c,X2,Y2,W2,1,clair(past,.14)); fr(c,X2,Y2+H2-1,W2,1,ombre(past,.16));
      fr(c,X2,Y2,1,H2,clair(past,.10)); fr(c,X2+W2-1,Y2,1,H2,ombre(past,.18));
    }
    MURCOUR=OLD;
    const enc=pick(['#b8788f','#7f8fc9','#8faf7f']);          // la frise de pattes
    const fy2=bas-S(6);
    for(let i2=S(3);i2<w-S(3);i2+=Math.max(5,S(7))){
      fr(c,x0+i2,fy2,2,2,enc); fr(c,x0+i2,fy2-1,1,1,enc);
      fr(c,x0+i2+2,fy2-1,1,1,enc); fr(c,x0+i2-1,fy2-1,1,1,enc);
    } }
  for(let i=2;i<w+S(6);i+=S(4)){ fr(c,x0-S(3)+i,bas-sh,2,2,B[1]); fr(c,x0-S(3)+i,bas-sh,1,2,B[2]); }
  if(toit==='chaume') toitPignon(c,x0-S(9),bas-sh-fh-toitH,w+S(18),toitH,PAL.toits.ocre,'chaume');
  else                toitPignon(c,x0-S(9),bas-sh-fh-toitH,w+S(18),toitH,tuile);

  /* --- la grande ouverture aux paniers --- */
  const ow=Math.max(15,Math.round(w*0.56)), ox=cx-(ow>>1), oh=sh-S(8);
  fr(c,ox-2,bas-oh-S(4),ow+4,oh+S(4),B[1]);
  fr(c,ox,bas-oh-S(2),ow,oh+S(2),'#2e2418');
  for(let j=0;j<oh;j++) fr(c,ox,bas-oh+j,ow,1, mix('#2e2418','#5a4a34',j/Math.max(1,oh-1)));
  // paniers d'osier alignés, chatons dedans
  for(let k=0,n=Math.max(2,Math.round(ow/S(9)));k<n;k++){
    const bw2=Math.max(6,S(9)), bx2=ox+S(2)+k*Math.round((ow-S(4))/n);
    const bh2=Math.max(4,S(6));
    for(let j=0;j<bh2;j++){
      const t=j/Math.max(1,bh2-1), wj=Math.round(bw2*(0.78+0.22*t));
      fr(c,bx2+((bw2-wj)>>1),bas-S(2)-bh2+j,wj,1, (j%2)?'#b39a63':'#c9b078');
    }
    fr(c,bx2-1,bas-S(2)-bh2,bw2+2,1,'#d9c48c');
    const pel=pick(PELAGES);
    fr(c,bx2+S(2),bas-S(2)-bh2-Math.max(2,S(3)),Math.max(3,S(4)),Math.max(2,S(3)),pel);
    fr(c,bx2+S(2),bas-S(2)-bh2-Math.max(2,S(3)),Math.max(3,S(4)),1,clair(pel,.3));
    fr(c,bx2+S(2)+1,bas-S(2)-bh2-Math.max(1,S(2)),1,1,'#15110c');
    fr(c,bx2+S(2)+Math.max(2,S(3)),bas-S(2)-bh2-Math.max(1,S(2)),1,1,'#15110c');
  }
  // volets rabattus, peints
  for(const s2 of [-1,1]){
    const vx=s2<0?ox-Math.max(3,S(5))-1:ox+ow+1, vc=pick(gai);
    fr(c,vx,bas-oh-S(3),Math.max(3,S(5)),oh+S(3),vc);
    fr(c,vx,bas-oh-S(3),1,oh+S(3),clair(vc,.28));
    fr(c,vx,bas-oh+Math.round(oh*0.5),Math.max(3,S(5)),1,ombre(vc,.34));
    fr(c,vx+1,bas-oh-S(1),1,1,ombre(vc,.5)); fr(c,vx+2,bas-oh,1,1,ombre(vc,.5));
  }
  fr(c,ox-3,bas-oh-S(4),ow+6,Math.max(2,S(3)),B[0]);              // auvent de l'ouverture
  fr(c,ox-3,bas-oh-S(4),ow+6,1,B[2]);
  for(let i=0;i<ow+6;i+=Math.max(3,S(4)))                          // guirlande
    fr(c,ox-3+i,bas-oh-S(4)+Math.max(2,S(3)),2,2,pick(gai));

  /* (les œils-de-bœuf sont peints en dernier, voir plus bas) */
  /* --- le préau : enclos, arbre à chats, linge, berceau --- */
  const cote2=chance(.5)?1:-1;
  const LP=S(17);
  const px0=cote2>0 ? x0+w+S(2) : x0-LP-S(2);
  if(px0>1&&px0+LP<SW-1){
    for(let i=0;i<LP;i+=Math.max(3,S(4))){                      // piquets
      fr(c,px0+i,bas-S(7),Math.max(2,S(2)),S(7),B[1]);
      fr(c,px0+i,bas-S(7),1,S(7),B[2]);
    }
    fr(c,px0,bas-S(6),LP,Math.max(1,S(2)),B[0]);
    fr(c,px0,bas-S(3),LP,Math.max(1,S(2)),B[0]);
    // arbre à chats : poteau gainé, deux plateformes, un chaton perché
    const ax=px0+Math.round(LP*0.5), ah=Math.max(9,S(14));
    fr(c,ax-1,bas-ah,Math.max(2,S(3)),ah,'#b3a074');
    for(let j=0;j<ah;j+=2) fr(c,ax-1,bas-ah+j,Math.max(2,S(3)),1,'#9c8a60');
    for(const [dy,dx] of [[ah-S(3),-S(4)],[ah,S(3)]]){
      fr(c,ax+dx,bas-dy,Math.max(4,S(6)),Math.max(2,S(3)),B[0]);
      fr(c,ax+dx,bas-dy,Math.max(4,S(6)),1,B[2]);
    }
    if(chance(.85)) chatAssis(c,ax+S(3),bas-ah,pick(PELAGES),1);
    // corde à linge de langes
    const ly2=bas-S(13);
    trait(c,px0,ly2,px0+LP,ly2-S(2),'#cfc7b2',1);
    for(let k=0,n=RI(3,5);k<n;k++){
      const lx=px0+S(2)+RI(0,Math.max(1,LP-S(5))), lc=pick(gai);
      fr(c,lx,ly2-Math.round((lx-px0)/LP*S(2)),Math.max(3,S(4)),Math.max(3,S(5)),lc);
      fr(c,lx,ly2-Math.round((lx-px0)/LP*S(2)),Math.max(3,S(4)),1,clair(lc,.3));
    }
    // bidons de lait et gamelles
    bidonLait(c,px0+S(1),bas);
    for(let k=0;k<RI(1,3);k++){
      const gx2=px0+Math.round(LP*0.7)+RI(0,S(3));
      ellipse(c,gx2,bas-2,Math.max(2,S(3)),Math.max(1,S(2)),'#8d9199');
      fr(c,gx2-1,bas-3,3,1,'#e8e2d0');
    }
  }
  // berceau suspendu sous l'avant-toit
  { const bx2=cote2>0 ? x0+S(3) : x0+w-S(9);
    const by2=bas-sh-fh+S(2);
    trait(c,bx2+S(2),by2,bx2+S(2),by2+S(5),'#cfc7b2',1);
    const cw2=Math.max(6,S(9));
    for(let j=0;j<Math.max(4,S(5));j++){
      const t=j/Math.max(1,S(5)-1), wj=Math.round(cw2*(1-0.30*t));
      fr(c,bx2+((cw2-wj)>>1),by2+S(5)+j,wj,1,(j%2)?'#b39a63':'#c9b078');
    }
    fr(c,bx2,by2+S(5),cw2,1,'#d9c48c'); }
  lanternePotence(sp,c,cote2>0?x0+w-S(2):x0+S(2),bas-sh-S(2),bois);
  sp.fumees.push({x:cx+RI(-S(8),S(8)),y:bas-sh-fh-toitH+S(2),t:0,d:0.7});
  chatteries(sp,c,x0,bas,w,sh+fh,row);
  /* peints en dernier : aucun panier, corde ou volet ne peut plus se
     glisser DERRIÈRE le verre des chambrées */
  /* --- fenêtres rondes à l'étage, une par chambrée --- */
  for(let k=0;k<3;k++){
    /* trois œils-de-bœuf CENTRÉS dans le pan : la troisième mordait le bord
       du mur et son cadre se tronquait ; et le chat de dos posé dessous se
       lisait comme un pilier derrière la vitre — il déménage au préau. */
    const rr=Math.max(3,S(5));
    const rx=clamp(Math.round(x0+w*(0.20+0.30*k)), x0+rr+2, x0+w-rr-3);
    const ry=bas-sh-fh+Math.round(fh*0.45);
    disque(c,rx,ry,rr+2,ombre(bois[1],.22));                    // ombre d'ébrasement
    disque(c,rx,ry,rr+1,bois[1]);
    fr(c,rx-rr,ry-rr,rr,1,clair(bois[2],.22));                  // le cadre prend le jour
    disque(c,rx,ry,rr,'#6d8b9e');
    disque(c,rx,ry,Math.max(1,rr-1),'#3c4f5e');
    fr(c,rx-rr+2,ry,2*rr-3,1,bois[1]); fr(c,rx,ry-rr+2,1,2*rr-3,bois[1]);
    fr(c,rx-Math.max(1,rr>>1),ry-Math.max(1,rr>>1),1,1,'rgba(255,255,255,.55)');
    sp.fenetres.push({x:rx-rr+1,y:ry-rr+1,w:2*rr-1,h:2*rr-1,ph:rnd()*6.28,on:chance(.9)});
  }
  brume(sp,row); return sp;
}
/* ---------- ENTREPÔT ----------
   Le grenier de la commune : sacs, caisses, tonneaux montés à la poulie
   par la lucarne du pignon. Trois chats dont c'est l'unique charge y
   dorment sur les ballots. */
/* ---------- L'ENTREPÔT À GRAINS ----------
   Repris à zéro. Un grenier n'est pas une maison de plus : c'est une
   machine à hisser et à garder au sec. Tout son dessin en découle — la
   poutre de levage qui sort du pignon avec sa poulie et son sac en
   suspens, les trappes de chargement superposées sur toute la hauteur
   plutôt que des fenêtres, l'ossature de bois laissée nue (pas de plâtre :
   le grain veut de l'air), le porche charretier voûté d'où l'on aperçoit
   les sacs empilés, et le sol pavé qu'on balaie. La couverture est de
   chaume, la plus légère pour une charpente qui porte déjà des tonnes.
   ---------------------------------------------------------------- */
function genEntrepot(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(50), sh=S(20), fh=S(18), toitH=S(26);
  const SW=w+S(30), SH=sh+fh+toitH+S(8);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const bois=AMB.bois, p=AMB.pierre;
  const B=['#8a6a45','#6b5134','#a8845a','#4a3826'];          // chêne clair

  // apron pavé
  for(let i=-S(6);i<w+S(6);i+=S(4)){
    for(let j=0;j<S(3);j+=2)
      fr(c,x0+i+((j/2)|0)%2?1:0,bas-S(2)+j,S(4)-1,2, chance(.5)?p[1]:p[2]);
  }
  fr(c,x0-S(6),bas-S(3),w+S(12),1,p[3]);

  /* --- ossature nue : sablières, poteaux, décharges --- */
  const pan=(X,Y,Wd,Ht,nb)=>{
    fr(c,X,Y,Wd,Ht,'#3f3225');                                // fond d'ombre : c'est ajouré
    for(let i=0;i<Wd;i+=3) fr(c,X+i,Y,1,Ht,'#4a3a29');
    fr(c,X,Y,Wd,Math.max(2,S(3)),B[1]); fr(c,X,Y,Wd,1,B[2]);
    fr(c,X,Y+Ht-Math.max(2,S(3)),Wd,Math.max(2,S(3)),B[1]);
    fr(c,X,Y+Ht-1,Wd,1,B[3]);
    const pas=(Wd-2)/Math.max(1,nb);
    for(let k=0;k<=nb;k++){
      const x=Math.round(X+k*pas);
      fr(c,x,Y,Math.max(2,S(3)),Ht,B[0]);
      fr(c,x,Y,1,Ht,B[2]); fr(c,x+Math.max(2,S(3))-1,Y,1,Ht,B[3]);
    }
    for(let k=0;k<nb;k++){                                     // décharges en tête
      const a=Math.round(X+k*pas)+S(2), b=Math.round(X+(k+1)*pas);
      trait(c,a,Y+Math.max(3,S(5)),a+Math.max(3,S(5)),Y+Math.max(2,S(3)),B[1],1);
      trait(c,b,Y+Math.max(3,S(5)),b-Math.max(3,S(5)),Y+Math.max(2,S(3)),B[1],1);
    }
  };
  // rez : socle de pierre puis ossature
  socle(c,x0-1,bas-S(6),w+2,S(6),p);
  pan(x0,bas-sh,w,sh-S(5),3);
  pan(x0-S(2),bas-sh-fh,w+S(4),fh,4);                          // étage en encorbellement
  for(let i=2;i<w+S(4);i+=S(4)){ fr(c,x0-S(2)+i,bas-sh,2,2,B[1]); fr(c,x0-S(2)+i,bas-sh,1,2,B[2]); }
  toitPignon(c,x0-S(7),bas-sh-fh-toitH,w+S(14),toitH,PAL.toits.ocre,'chaume');

  /* --- porche charretier : arc de bois, sacs empilés dans l'ombre --- */
  const gw=Math.max(13,Math.round(w*0.44)), gx=cx-(gw>>1), gh=sh-S(6);
  fr(c,gx-2,bas-gh-2,gw+4,gh+2,B[1]);
  for(let j=0;j<gh;j++){
    let wj=gw, xj=gx; const r2=gw>>1;
    if(j<r2){ const d=r2-Math.round(Math.sqrt(Math.max(0,r2*r2-(r2-j)*(r2-j)))); wj=gw-2*d; xj=gx+d; }
    fr(c,xj,bas-gh+j,wj,1,'#1a140d');
    if(j<r2){ fr(c,xj-1,bas-gh+j,1,1,B[0]); fr(c,xj+wj,bas-gh+j,1,1,B[0]); }
  }
  // sacs empilés visibles dans le noir du porche
  for(let k=0,n=RI(5,9);k<n;k++){
    const sw2=Math.max(3,S(5)), sh2=Math.round(sw2*1.2);
    const sx=gx+RI(2,Math.max(3,gw-sw2-2)), sy=bas-RI(0,Math.max(1,Math.round(gh*0.55)));
    for(let j=0;j<sh2;j++){
      const t=j/Math.max(1,sh2-1);
      const wj=Math.max(2,Math.round(sw2*(0.55+0.45*Math.sin(Math.PI*Math.min(1,t*1.15)))));
      fr(c,sx+((sw2-wj)>>1),sy-sh2+j,wj,1, t<0.35?'#a08d68':(t>0.8?'#6b5c40':'#8a7856'));
    }
  }
  // vantaux ouverts de part et d'autre
  for(const s3 of [-1,1]){
    const vx=s3<0?gx-Math.max(3,S(5)):gx+gw;
    fr(c,vx,bas-gh-1,Math.max(3,S(5)),gh+1,B[0]);
    fr(c,vx,bas-gh-1,1,gh+1,B[2]);
    for(let j=S(3);j<gh;j+=S(6)) fr(c,vx,bas-gh-1+j,Math.max(3,S(5)),1,B[3]);
  }

  /* --- LA POUTRE DE LEVAGE, sa poulie et son sac --- */
  const py=bas-sh-fh-Math.round(toitH*0.52);
  { const bl=S(12);
    fr(c,cx-Math.max(2,S(3)),py,bl,Math.max(3,S(4)),B[0]);     // poutre saillante
    fr(c,cx-Math.max(2,S(3)),py,bl,1,B[2]);
    fr(c,cx-Math.max(2,S(3)),py+Math.max(3,S(4))-1,bl,1,B[3]);
    trait(c,cx-S(2),py+S(4),cx-S(2),py+S(9),B[1],1);           // lien à la charpente
    const hx=cx+bl-Math.max(4,S(6)), rp=Math.max(2,S(3));      // poulie
    disque(c,hx,py+Math.max(4,S(6)),rp,'#3d3f45');
    disque(c,hx,py+Math.max(4,S(6)),Math.max(1,rp-1),'#5e626a');
    fr(c,hx-1,py+Math.max(3,S(4)),3,Math.max(2,S(3)),'#3d3f45');
    sp.poulie={x:hx,y:py+Math.max(5,S(7)),l:Math.round((sh+fh)*0.62)};
    // trappe de comble derrière la poutre
    const tw2=Math.max(6,S(9));
    fr(c,cx-(tw2>>1)-1,py-S(2),tw2+2,Math.max(6,S(9)),B[1]);
    fr(c,cx-(tw2>>1),py-S(1),tw2,Math.max(5,S(8)),'#17110b'); }

  /* --- trappes de chargement superposées, volets ouverts --- */
  for(let e=0;e<2;e++){
    const ey=e===0?bas-sh-fh+S(4):bas-sh+S(3);
    const n=e===0?3:2;
    for(let k=0;k<n;k++){
      const tw2=Math.max(5,S(8)), th2=Math.max(6,S(9));
      const tx=Math.round(x0+S(4)+k*((w-S(10))/Math.max(1,n-1)))-(tw2>>1);
      if(Math.abs(tx-cx)<gw*0.5 && e===1) continue;
      fr(c,tx-1,ey-1,tw2+2,th2+2,B[1]);
      fr(c,tx,ey,tw2,th2,'#1d1710');
      fr(c,tx,ey,tw2,1,'#120e08');
      const vx=chance(.5)?tx-Math.max(2,S(3)):tx+tw2;          // un vantail rabattu
      fr(c,vx,ey-1,Math.max(2,S(3)),th2+2,B[0]);
      fr(c,vx,ey-1,1,th2+2,B[2]);
      fr(c,vx,ey+(th2>>1),Math.max(2,S(3)),1,B[3]);
      if(chance(.4)) chatAuBalcon(c,tx+((tw2-3)>>1),ey+th2,pick(PELAGES));
    }
  }

  /* --- enseigne, tonneaux, charrette, chat --- */
  { const ew=Math.max(11,S(16)), eh=Math.max(5,S(7));
    const ex=cx-(ew>>1);
    fr(c,ex-1,bas-sh-S(1),ew+2,1,B[3]);
    fr(c,ex,bas-sh,ew,eh,'#5a4128');
    fr(c,ex,bas-sh,ew,1,'#7a5c38'); fr(c,ex,bas-sh+eh-1,ew,1,'#3a2a1b');
    charge(c,ex+(ew>>1),bas-sh+Math.round(eh*0.5),Math.max(2,Math.round(eh*0.30)),'#e0c463','ble');
    sp.enseigne={x:ex+(ew>>1),y:bas-sh+1,w:ew,h:eh}; }
  { const bx2=x0+w+S(2);
    if(bx2<SW-S(6)) for(let k=0;k<RI(1,3);k++){
      const by2=bas-k*S(5);
      fr(c,bx2,by2-S(5),Math.max(4,S(6)),S(5),'#6a4c31');
      fr(c,bx2,by2-S(4),Math.max(4,S(6)),1,'#a8845a');
      fr(c,bx2,by2-S(2),Math.max(4,S(6)),1,'#a8845a');
    } }
  { const cxx=x0-S(9);
    if(cxx>S(3)){
      fr(c,cxx,bas-S(6),S(10),Math.max(3,S(4)),B[0]);
      fr(c,cxx,bas-S(6),S(10),1,B[2]);
      disque(c,cxx+S(2),bas-S(2),Math.max(2,S(3)),B[3]);
      disque(c,cxx+S(7),bas-S(2),Math.max(2,S(3)),B[3]);
      fr(c,cxx+S(10),bas-S(8),Math.max(2,S(4)),1,B[1]);
      for(let k=0;k<S(4);k++) fr(c,cxx+RI(1,S(8)),bas-S(7)-RI(0,S(1)),RI(2,3),2,'#a08d68'); } }
  lanternePotence(sp,c,x0+S(4),bas-sh-S(3),bois);
  /* --- la cour : un entrepôt se juge à ce qui attend dehors --- */
  { const dx2=chance(.5)?x0-S(14):x0+w+S(2);
    if(dx2>1&&dx2+S(13)<SW){
      for(let k=0;k<2;k++){                                  // tonneaux gerbés
        fr(c,dx2+k*S(6),bas-S(6),Math.max(4,S(5)),S(6),'#6a4c31');
        fr(c,dx2+k*S(6),bas-S(5),Math.max(4,S(5)),1,'#a8845a');
        fr(c,dx2+k*S(6),bas-S(2),Math.max(4,S(5)),1,'#a8845a'); }
      fr(c,dx2+S(3),bas-S(11),Math.max(4,S(5)),S(5),'#6a4c31');   // le troisième dessus
      fr(c,dx2+S(3),bas-S(10),Math.max(4,S(5)),1,'#a8845a');
      // pile de sacs sanglée
      for(let j=0;j<3;j++){ const sw2=S(7)-j;
        fr(c,dx2+S(9)-((sw2- S(5))>>1),bas-S(3)*(j+1),sw2,S(3),'#b6a98c');
        fr(c,dx2+S(9),bas-S(3)*(j+1),1,S(3),'#8a7f68'); }
      fr(c,dx2+S(8),bas-S(9),S(3),S(9),'#8a6a2a');            // la sangle
    } }
  { const bx2=x0+Math.round(w*0.72);                          // balance romaine à la porte
    fr(c,bx2,bas-sh+S(2),1,S(6),'#3d3f45');
    fr(c,bx2-S(3),bas-sh+S(2),S(7),1,'#6a6e77');
    fr(c,bx2-S(3),bas-sh+S(3),1,S(2),'#8d9199');
    fr(c,bx2+S(3),bas-sh+S(3),2,2,'#c9a24a'); }
  if(chance(.8)) chatDormi(c,gx+RI(2,Math.max(3,gw-8)),bas,pick(PELAGES));
  chatteries(sp,c,x0,bas,w,sh+fh,row);
  brume(sp,row); return sp;
}
/* ---------- CHANTIER ----------
   Ce sera une maison ; pour l'instant c'est le meilleur terrain de jeu
   du bourg. Charpente nue, échafaudage, roue de levage — et une pelote
   que personne ne revendique. */
/* ---------- LE CHANTIER ----------
   Repris à zéro. Un chantier ne se lit pas à ce qu'il a, mais à ce qui lui
   MANQUE : le pignon monté jusqu'à mi-hauteur et laissé cru, la charpente
   nue dont les chevrons ne portent encore de tuiles que sur un versant et
   sur une partie de l'autre, le mur qui s'arrête en escalier avec ses
   pierres d'attente. Autour, l'outillage qui prouve que ça travaille :
   échafaudage de perches ligaturées à la corde, treuil, auge à mortier,
   tas de moellons calibrés, palette de tuiles, échelle, brouette.
   ---------------------------------------------------------------- */
function genChantier(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(44), h=S(24), toitH=S(22);
  const SW=w+S(30), SH=h+toitH+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=SW>>1, x0=cx-(w>>1);
  const p=AMB.pierre, bois=AMB.bois;
  const B=['#8a6a45','#6b5134','#a8845a','#4a3826'];
  const toit=pick(AMB.toits);

  // sol remué, gravats
  for(let i=-S(8);i<w+S(8);i+=2) if(chance(.5))
    fr(c,x0+i,bas-RI(0,2),RI(1,3),1,pick(['#8a7a5e','#6b5c44','#a3937a']));

  /* --- mur monté à mi-hauteur, arasé en escalier --- */
  const arase=x=>{ const t=(x-x0)/w; return Math.round(h*(0.52+0.34*Math.sin(t*3.1+0.8))); };
  for(let x=0;x<w;x++){
    const hh=Math.max(S(4),arase(x0+x)-((x%S(7))<S(3)?S(3):0));
    fr(c,x0+x,bas-hh,1,hh,p[1]);
  }
  mur(c,x0,bas-S(10),w,S(10),p);
  for(let x=0;x<w;x++){                                    // arête d'arase + pierres d'attente
    const hh=Math.max(S(4),arase(x0+x)-((x%S(7))<S(3)?S(3):0));
    fr(c,x0+x,bas-hh,1,2,clair(p[0],.18));
    if(chance(.10)) fr(c,x0+x,bas-hh-RI(2,4),RI(2,4),RI(2,3),p[2]);
  }
  { const dw=Math.max(7,S(10)), dx=cx-(dw>>1);              // baie de porte encore vide
    fr(c,dx-2,bas-S(14),dw+4,S(14),p[3]);
    fr(c,dx,bas-S(12),dw,S(12),'#241d16');
    fr(c,dx-2,bas-S(14),dw+4,Math.max(2,S(3)),B[0]);        // linteau de bois posé
    fr(c,dx-2,bas-S(14),dw+4,1,B[2]); }

  /* --- charpente nue, à demi couverte --- */
  const fy=bas-h;
  const fermes=Math.max(3,Math.round(w/S(13)));
  fr(c,x0-S(3),fy-1,w+S(6),Math.max(2,S(3)),B[0]);          // sablière
  fr(c,x0-S(3),fy-1,w+S(6),1,B[2]);
  fr(c,cx-1,fy-toitH,Math.max(2,S(3)),toitH,B[1]);          // poinçon
  fr(c,x0-S(4),fy-toitH,w+S(8),Math.max(2,S(3)),B[0]);      // panne faîtière
  fr(c,x0-S(4),fy-toitH,w+S(8),1,B[2]);
  for(let k=0;k<=fermes;k++){                               // chevrons des deux versants
    const t=k/fermes;
    const xx=Math.round(x0-S(3)+t*(w+S(6)));
    trait(c,xx,fy,cx,fy-toitH+S(2),B[1],1);
    trait(c,xx,fy+1,cx,fy-toitH+S(3),B[3],1);
  }
  for(let k=1;k<3;k++){                                     // pannes intermédiaires
    const yy=fy-Math.round(toitH*k/3);
    const dxw=Math.round((w+S(6))*(1-k/3)*0.5);
    fr(c,cx-dxw,yy,2*dxw,Math.max(1,S(2)),B[1]);
  }
  { // tuiles posées : tout le versant gauche, une amorce à droite
    const nv=Math.round(toitH/3);
    for(let j=0;j<nv;j++){
      const y=fy-toitH+j*3;
      const dxw=Math.round((w+S(6))*0.5*(j*3)/toitH);
      fr(c,cx-dxw,y,dxw,3,(j%3)===2?toit[2]:((j%6)===0?toit[0]:toit[1]));
      for(let i=(j%2)*2;i<dxw;i+=4) fr(c,cx-dxw+i,y,1,2,toit[3]);
      const rn=Math.round(dxw*R(0.15,0.45));
      if(j<nv*0.55){
        fr(c,cx,y,rn,3,(j%3)===2?toit[2]:((j%6)===0?toit[0]:toit[1]));
        for(let i=(j%2)*2;i<rn;i+=4) fr(c,cx+i,y,1,2,toit[3]);
      }
    }
    fr(c,cx-1,fy-toitH,Math.max(3,S(4)),Math.max(2,S(3)),clair(toit[0],.2)); }

  /* --- échafaudage de perches ligaturées --- */
  const ecx=chance(.5)?x0-S(6):x0+w+S(2);
  { const eh=h+Math.round(toitH*0.55), ew=Math.max(6,S(9));
    for(const dx of [0,ew]){
      fr(c,ecx+dx,bas-eh,Math.max(2,S(2)),eh,B[0]);
      fr(c,ecx+dx,bas-eh,1,eh,B[2]);
    }
    for(let k=1;k<=3;k++){
      const yy=bas-Math.round(eh*k/3.4);
      fr(c,ecx-S(2),yy,ew+S(5),Math.max(2,S(2)),B[1]);      // plateaux
      fr(c,ecx-S(2),yy,ew+S(5),1,B[2]);
      for(const dx of [0,ew]) fr(c,ecx+dx-1,yy-1,Math.max(3,S(3)),Math.max(3,S(3)),'#b3a074');  // ligatures
      trait(c,ecx,yy,ecx+ew,yy-Math.round(eh/3.4),B[3],1);  // écharpe
    }
    // échelle appuyée
    const lx=ecx+(ecx<x0?ew+S(2):-S(6));
    trait(c,lx,bas-1,lx+S(3),bas-eh+S(3),B[0],1);
    trait(c,lx+S(3),bas-1,lx+S(6),bas-eh+S(3),B[0],1);
    for(let j=0;j<S(9);j++){
      const t=j/S(9), yy=Math.round(bas-1-t*(eh-S(4)));
      fr(c,Math.round(lx+t*S(3)),yy,Math.max(3,S(4)),1,B[1]);
    }
    sp.poulie={x:ecx+(ew>>1),y:bas-eh-S(2),l:Math.round(eh*0.7)};
    fr(c,ecx-S(2),bas-eh-S(4),ew+S(5),Math.max(2,S(3)),B[0]);   // chèvre au sommet
    fr(c,ecx+(ew>>1)-1,bas-eh-S(3),3,Math.max(3,S(4)),'#3d3f45'); }

  /* --- auge à mortier, moellons calibrés, palette de tuiles --- */
  { const ax=(ecx<x0)?x0+w+S(2):x0-S(13);
    if(ax>1&&ax+S(11)<SW){
      fr(c,ax,bas-S(6),S(11),Math.max(3,S(5)),B[1]);
      fr(c,ax,bas-S(6),S(11),1,B[2]);
      fr(c,ax+1,bas-S(6)+1,S(11)-2,Math.max(2,S(3)),'#b9b3a4');
      trait(c,ax+S(8),bas-S(6),ax+S(11),bas-S(14),B[0],1);
      fr(c,ax+S(10),bas-S(16),Math.max(3,S(4)),Math.max(2,S(3)),'#8d9199');
      for(let k=0;k<RI(4,7);k++)                                   // moellons calibrés
        fr(c,ax-S(6)+RI(0,S(5)),bas-RI(1,S(5)),Math.max(2,S(3)),Math.max(2,S(2)),chance(.5)?p[1]:p[2]);
      for(let k=0;k<RI(3,6);k++)                                   // pile de tuiles
        fr(c,ax+S(2)+RI(0,S(4)),bas-S(1)-k*2,Math.max(4,S(6)),2,(k%2)?toit[1]:toit[2]);
    } }
  { const bx2=cx+RI(-S(10),S(10));                                 // brouette de gravats
    fr(c,bx2-S(4),bas-S(5),S(8),Math.max(3,S(4)),B[0]);
    fr(c,bx2-S(4),bas-S(5),S(8),1,B[2]);
    disque(c,bx2-S(2),bas-S(2),Math.max(2,S(3)),B[3]);
    fr(c,bx2+S(4),bas-S(6),Math.max(2,S(4)),1,B[1]);
    for(let k=0;k<S(4);k++) fr(c,bx2-S(3)+RI(0,S(6)),bas-S(6),RI(1,2),1,'#8a7a5e'); }
  /* --- le chevalet de sciage : le tronc à demi débité, la grande scie
     plantée dans le trait, la sciure au sol — c'est le bruit du chantier --- */
  { const sx2=chance(.5)?x0-S(15):x0+w+S(3);
    if(sx2>1&&sx2+S(14)<SW){
      for(const dd of [0,S(9)]){                              // deux tréteaux
        fr(c,sx2+dd,bas-S(6),Math.max(2,S(2)),S(6),'#5a412a');
        trait(c,sx2+dd,bas-S(6),sx2+dd-S(2),bas-1,'#5a412a',1);
        trait(c,sx2+dd,bas-S(6),sx2+dd+S(3),bas-1,'#5a412a',1); }
      fr(c,sx2-S(2),bas-S(8),S(14),Math.max(2,S(3)),'#8a6a45');   // le tronc
      fr(c,sx2-S(2),bas-S(8),S(14),1,'#a8845a');
      fr(c,sx2+S(5),bas-S(8),1,Math.max(2,S(3)),'#3a2a1b');        // le trait de scie
      fr(c,sx2+S(4),bas-S(14),Math.max(2,S(2)),S(7),'#8d9199');    // la lame plantée
      fr(c,sx2+S(3),bas-S(15),Math.max(4,S(5)),Math.max(1,S(2)),'#6b5134'); // la poignée
      for(let k=0;k<S(8);k++) fr(c,sx2+RI(0,S(11)),bas-RI(1,2),1,1,'#d8c48a'); // sciure
    } }
  if(chance(.8)) chatAssis(c,cx+RI(-S(12),S(12)),bas-Math.max(S(4),arase(cx)-S(3)),pick(PELAGES),chance(.5)?1:-1);
  sp.droit=1;                       // un mur en cours de montage est d'aplomb : c'est le temps qui le tord
  brume(sp,row); return sp;
}
/* ---------- TERRAIN D'ENTRAÎNEMENT ----------
   Sable damé, mannequins de paille, quintaine qui pivote quand on la
   frappe mal. Le griffoir du coin est officiellement destiné à
   l'échauffement des griffes. */
/* ---------- LE TERRAIN D'ENTRAÎNEMENT ----------
   Repris à zéro. Une lice ne se dessine pas comme un bâtiment mais comme un
   ATELIER À CIEL OUVERT : ce sont les agrès qui font le lieu, et chacun doit
   être reconnaissable à sa fonction. La QUINTAINE, poteau tournant portant
   d'un côté l'écu à frapper et de l'autre le sac de sable qui vient vous
   cueillir dans le dos — c'est la seule pièce mobile, et elle se balance.
   Le PEL, billot planté, entaillé de mille coups d'épée. Les BUTTES de tir,
   ballots de paille et cible peinte, hérissées de flèches et de traits
   fichés partout autour. Le RÂTELIER d'armes de bois. Le mannequin de
   bottes. Autour, la palissade de perches, les bancs, le seau d'eau.
   ---------------------------------------------------------------- */
function genEntrainement(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(64), h=S(15);
  const SW=w+S(24), SH=h+S(40);
  const sp=sprite(SW,SH), c=sp.g;
  const cx=SW>>1, bas=SH-1, x0=cx-(w>>1);
  const bois=AMB.bois, p=AMB.pierre;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  const FER='#5e626a', FERC='#8d9199';

  /* --- la lice : sable damé, bordé de madriers, creusé d'ornières --- */
  fr(c,x0,bas-h,w,h,'#c9b894');
  for(let j=0;j<h;j++){
    const t=j/h;
    fr(c,x0,bas-h+j,w,1, mix('#d6c6a2','#a89272',Math.pow(t,0.6)));
  }
  for(let k=0,n=Math.round(w*0.9);k<n;k++){
    const sx=x0+RI(0,w-1), sy=bas-RI(1,h-1);
    fr(c,sx,sy,RI(1,3),1, chance(.5)?'#b9a582':'#dcd0af');
  }
  for(let k=0;k<S(7);k++){                              // ornières et traces de pas
    const ox=x0+RI(S(4),w-S(4));
    for(let i=0;i<RI(S(4),S(10));i++) fr(c,ox+i,bas-RI(1,S(4)),1,1,'#9c8968');
  }
  for(let i=0;i<w;i++){                                   // la lice s'efface dans l'herbe
    const t=Math.min(i,w-1-i)/Math.max(1,S(9));
    if(t<1) for(let j=0;j<h;j++) if(rnd()>t*0.85) fr(c,x0+i,bas-h+j,1,1,'#6d8b4a');
  }
  fr(c,x0-S(2),bas-h,w+S(4),Math.max(2,S(3)),B[1]);      // madrier de bordure
  fr(c,x0-S(2),bas-h,w+S(4),1,B[2]);
  fr(c,x0-S(2),bas-1,w+S(4),1,B[3]);
  for(let i=0;i<w;i+=Math.max(6,S(10))) fr(c,x0+i,bas-h-S(2),Math.max(2,S(3)),Math.max(3,S(4)),B[0]);

  /* --- la palissade ferme le fond de la lice : posée AVANT les agrès,
     sinon elle leur passe devant et on ne voit plus rien --- */
  for(let i=0;i<w+S(6);i+=Math.max(4,S(6))){
    const px3=x0-S(3)+i, py2=bas-h-S(2);
    fr(c,px3,py2-S(7),Math.max(2,S(2)),S(7),B[1]);
    fr(c,px3,py2-S(7),1,S(7),B[2]);
  }
  fr(c,x0-S(3),bas-h-S(7),w+S(6),Math.max(1,S(2)),B[0]);
  fr(c,x0-S(3),bas-h-S(4),w+S(6),Math.max(1,S(2)),B[0]);
  /* --- LA QUINTAINE --- */
  const qx=x0+Math.round(w*0.30);
  { const qh=Math.max(22,S(34));
    fr(c,qx-1,bas-h-qh,Math.max(3,S(4)),qh+S(3),B[0]);   // poteau
    fr(c,qx-1,bas-h-qh,1,qh+S(3),B[2]);
    fr(c,qx-1,bas-h-qh+Math.round(qh*0.5),Math.max(3,S(4)),1,B[3]);
    fr(c,qx-S(3),bas-h-1,Math.max(7,S(9)),Math.max(2,S(3)),p[2]);   // dé de pierre
    // le tourillon et le bras
    const by=bas-h-qh+S(4);
    fr(c,qx-2,by-2,Math.max(5,S(6)),Math.max(4,S(5)),FER);
    fr(c,qx-2,by-2,Math.max(5,S(6)),1,FERC);
    const bl=Math.max(9,S(14));
    fr(c,qx-bl,by,bl,Math.max(2,S(3)),B[0]);
    fr(c,qx+2,by,bl,Math.max(2,S(3)),B[0]);
    fr(c,qx-bl,by,2*bl+2,1,B[2]);
    // l'écu à frapper, côté gauche
    { const ew=Math.max(7,S(10)), eh=Math.round(ew*1.2);
      const ex=qx-bl, ey=by+Math.max(2,S(3));
      const champ=pick(PAL.blason);
      for(let j=0;j<eh;j++){
        const t=j/(eh-1);
        const wj = t<0.58 ? ew : Math.max(1,Math.round(ew*(1-Math.pow((t-0.58)/0.42,1.5))));
        fr(c,ex+((ew-wj)>>1),ey+j,wj,1, t<0.5?champ:ombre(champ,.14));
      }
      fr(c,ex,ey,ew,1,clair(champ,.28));
      charge(c,ex+(ew>>1),ey+Math.round(eh*0.44),Math.max(2,Math.round(ew*0.22)),'#dfe3ea',pick(CHARGES));
      for(let k=0,n=RI(2,5);k<n;k++)                     // impacts de lance
        fr(c,ex+RI(1,ew-2),ey+RI(1,eh-3),RI(1,2),1,ombre(champ,.45)); }
    // le sac de sable, côté droit : il se balance
    sp.balancier={x:qx+bl,y:by+Math.max(2,S(3)),l:Math.max(6,S(9)),w:Math.max(4,S(6)),
                  h:Math.max(6,S(9)),col:'#b3a074'}; }

  /* --- LE PEL, billot entaillé --- */
  { const px2=x0+Math.round(w*0.56), ph2=Math.max(14,S(21));
    for(let j=0;j<ph2;j++){
      const y=bas-h-j, wj=Math.max(3,S(5));
      fr(c,px2-(wj>>1),y,wj,1,(j%3)?'#8a6a45':'#7d5f3c');
      fr(c,px2-(wj>>1),y,1,1,'#a8845a');
      fr(c,px2+(wj>>1)-1,y,1,1,'#5a4128');
    }
    for(let k=0,n=RI(6,12);k<n;k++){                     // entailles
      const ky=bas-h-RI(2,ph2-2), s2=chance(.5)?1:-1;
      fr(c,px2+s2*RI(0,2),ky,RI(1,2),1,'#4a3826');
      if(chance(.4)) fr(c,px2+s2*RI(0,2),ky+1,1,1,'#3a2a1b');
    }
    fr(c,px2-S(3),bas-h-1,Math.max(6,S(8)),Math.max(2,S(3)),p[2]);
    fr(c,px2-1,bas-h-ph2-2,Math.max(3,S(4)),2,B[3]);     // tête cerclée de fer
    fr(c,px2-1,bas-h-ph2-2,Math.max(3,S(4)),1,FERC); }

  /* --- LES BUTTES DE TIR --- */
  { const tx=x0+Math.round(w*0.84);
    const rt=Math.max(4,S(7));
    for(const s2 of [0,1]){                              // deux tréteaux
      const bx2=tx-S(6)+s2*S(12);
      fr(c,bx2,bas-h-S(9),Math.max(2,S(3)),S(9),B[1]);
      trait(c,bx2,bas-h-S(9),bx2+(s2?-S(4):S(4)),bas-h,B[1],1);
    }
    // ballot de paille et cible peinte
    for(let j=0;j<rt*2;j++){
      const t=j/(rt*2-1);
      const wj=Math.round(rt*2*Math.sqrt(Math.max(0.02,1-Math.pow(2*t-1,2))));
      fr(c,tx-(wj>>1),bas-h-S(9)-rt*2+j+1,wj,1, (j%3)?'#c4a254':'#a68841');
    }
    for(let k=rt;k>0;k--)
      disque(c,tx,bas-h-S(9)-rt,k,(k%2)?'#ddd0a6':'#9a4a40');
    disque(c,tx,bas-h-S(9)-rt,Math.max(1,Math.round(rt*0.24)),'#3f5c6b');
    for(let k=0,n=RI(3,7);k<n;k++){                      // flèches fichées
      const a=R(0,6.28), rq=R(0,rt*0.9);
      const ax2=tx+Math.round(Math.cos(a)*rq), ay2=bas-h-S(9)-rt+Math.round(Math.sin(a)*rq);
      fr(c,ax2,ay2,Math.max(3,S(5)),1,'#6b5540');
      fr(c,ax2+Math.max(3,S(5)),ay2-1,2,3,'#e4dcc6');
    }
    for(let k=0,n=RI(2,5);k<n;k++)                       // traits perdus au sol
      fr(c,tx+RI(-S(8),S(8)),bas-RI(1,S(4)),Math.max(3,S(4)),1,'#6b5540'); }

  /* --- râtelier d'armes de bois et mannequin de bottes --- */
  { const rx=x0+Math.round(w*0.08);
    fr(c,rx,bas-h-S(11),Math.max(8,S(12)),Math.max(2,S(3)),B[1]);
    fr(c,rx,bas-h-S(11),Math.max(8,S(12)),1,B[2]);
    fr(c,rx,bas-h-S(11),Math.max(2,S(2)),S(11),B[0]);
    fr(c,rx+Math.max(6,S(10)),bas-h-S(11),Math.max(2,S(2)),S(11),B[0]);
    for(let i=2;i<S(12);i+=Math.max(2,S(3))){
      const l=RI(S(5),S(10));
      fr(c,rx+i,bas-h-S(11)+S(3),1,l,'#8a6a45');
      if(chance(.4)) fr(c,rx+i-1,bas-h-S(11)+S(3),3,1,'#5a4128');   // garde d'épée de bois
      else fr(c,rx+i-1,bas-h-S(11)+S(3)+l,3,Math.max(2,S(2)),'#6b5540'); } }
  { const mx=x0+Math.round(w*0.44), mh=Math.max(12,S(18));
    fr(c,mx-1,bas-h-mh,Math.max(2,S(3)),mh,B[1]);
    fr(c,mx-Math.max(4,S(6)),bas-h-mh+S(5),Math.max(9,S(12)),Math.max(2,S(3)),B[0]);
    fr(c,mx-Math.max(2,S(3)),bas-h-mh+S(2),Math.max(5,S(7)),Math.max(6,S(9)),FER);
    fr(c,mx-Math.max(2,S(3)),bas-h-mh+S(2),Math.max(5,S(7)),1,FERC);
    fr(c,mx-Math.max(2,S(3)),bas-h-mh-Math.max(2,S(3)),Math.max(5,S(7)),Math.max(3,S(4)),FER);
    fr(c,mx-Math.max(2,S(3)),bas-h-mh-1,Math.max(5,S(7)),1,'#15120e');
    for(let k=0,n=RI(2,5);k<n;k++)                       // bosses de coups
      fr(c,mx+RI(-2,2),bas-h-mh+S(3)+RI(0,S(5)),1,1,ombre(FER,.30));
    fr(c,mx-Math.max(5,S(7)),bas-h-mh+S(6),Math.max(3,S(4)),Math.max(4,S(6)),pick(PAL.blason)); }

  /* --- bancs, seau --- */
  { const bx2=x0+Math.round(w*0.68);
    fr(c,bx2-S(5),bas-S(6),S(11),Math.max(2,S(3)),B[0]);
    fr(c,bx2-S(5),bas-S(6),S(11),1,B[2]);
    fr(c,bx2-S(4),bas-S(4),Math.max(2,S(2)),S(4),B[1]);
    fr(c,bx2+S(3),bas-S(4),Math.max(2,S(2)),S(4),B[1]);
    fr(c,bx2+S(7),bas-S(5),Math.max(4,S(5)),Math.max(4,S(5)),'#6a4c31');   // seau
    fr(c,bx2+S(7),bas-S(5),Math.max(4,S(5)),1,'#3f5c6b');
    fr(c,bx2+S(7),bas-S(6),Math.max(4,S(5)),1,FERC); }
  sp.linge=[];
  for(let k=0;k<2;k++){
    const mx2=x0+(k?w-S(3):S(3));
    fr(c,mx2,bas-h-S(24),1,S(24),B[3]);
    sp.drapeaux.push({x:mx2+1,y:bas-h-S(24),w:Math.max(6,S(10)),h:Math.max(4,S(7)),
                      col:k?AMB.blason:pick(PAL.blason)});
  }
  if(chance(.8)) chatAssis(c,x0+RI(S(6),w-S(6)),bas-S(2),pick(PELAGES),chance(.5)?1:-1);
  if(chance(.6)) chatDormi(c,x0+RI(S(6),w-S(6)),bas-S(2),pick(PELAGES));
  brume(sp,row); return sp;
}
/* ---------- PUITS ---------- */
function genPuits(row){
  const s=ech(row);
  const W2=Math.round(22*s), H2=Math.round(26*s);
  const sp=sprite(W2,H2), c=sp.g, cx=W2>>1, bas=H2-1;
  const p=AMB.pierre, b=AMB.bois;
  socle(c,cx-Math.round(7*s),bas-Math.round(9*s),Math.round(14*s),Math.round(9*s),p);
  fr(c,cx-Math.round(8*s),bas-Math.round(10*s),Math.round(16*s),2,p[0]);
  fr(c,cx-Math.round(5*s),bas-Math.round(8*s),Math.round(10*s),3,'#1b2a33');
  fr(c,cx-Math.round(7*s),bas-Math.round(22*s),2,Math.round(13*s),b[1]);
  fr(c,cx+Math.round(5*s),bas-Math.round(22*s),2,Math.round(13*s),b[1]);
  toitPignon(c,cx-Math.round(10*s),bas-Math.round(28*s),Math.round(20*s),Math.round(8*s),PAL.toits.ocre,'chaume');
  fr(c,cx-Math.round(7*s),bas-Math.round(20*s),Math.round(14*s),2,b[2]);
  fr(c,cx-1,bas-Math.round(19*s),2,Math.round(6*s),'#3a2c1e');
  fr(c,cx-2,bas-Math.round(13*s),4,Math.round(4*s),b[2]);
  brume(sp,row); return sp;
}

/* ---------- PETITS OBJETS ---------- */
function genObjet(type,row){
  const s=ech(row), b=AMB.bois;
  const S=v=>Math.max(1,Math.round(v*s));
  if(type==='charrette'){
    const sp=sprite(S(26),S(18)),c=sp.g,bas=sp.h-1;
    fr(c,S(2),bas-S(9),S(20),S(5),b[2]); fr(c,S(2),bas-S(9),S(20),1,clair(b[2],.2));
    for(let i=0;i<S(20);i+=S(4)) fr(c,S(2)+i,bas-S(9),1,S(5),b[1]);
    disque(c,S(6),bas-S(3),S(4),'#3a2c1e'); disque(c,S(6),bas-S(3),S(2),b[2]);
    disque(c,S(18),bas-S(3),S(4),'#3a2c1e'); disque(c,S(18),bas-S(3),S(2),b[2]);
    fr(c,S(21),bas-S(13),S(4),S(5),'#6d7a4a'); fr(c,S(6),bas-S(13),S(9),S(4),'#8a7440');
    brume(sp,row);return sp;
  }
  if(type==='foin'){
    const sp=sprite(S(24),S(18)),c=sp.g,bas=sp.h-1;
    for(let j=0;j<S(16);j++){const wj=Math.round(S(24)*(j+3)/S(19));fr(c,(sp.w-wj)>>1,bas-j,wj,1,j%3?PAL.chaume[1]:PAL.chaume[0]);}
    for(let i=0;i<sp.w;i+=3) if(chance(.4)) fr(c,i,bas-RI(2,S(12)),1,2,PAL.chaume[3]);
    fr(c,(sp.w>>1)-1,bas-S(17),3,3,PAL.chaume[2]);
    brume(sp,row);return sp;
  }
  if(type==='etal'){
    const sp=sprite(S(24),S(20)),c=sp.g,bas=sp.h-1;
    fr(c,S(2),bas-S(9),S(20),2,b[1]);
    fr(c,S(3),bas-S(8),1,S(8),b[1]); fr(c,S(20),bas-S(8),1,S(8),b[1]);
    for(let i=0;i<S(20);i+=S(3)) fr(c,S(2)+i,bas-S(15),S(2),S(6), (i/S(3))%2?'#d8d2c0':pick(PAL.blason));
    fr(c,S(2),bas-S(16),S(20),1,b[0]);
    for(let i=0;i<S(16);i+=S(4)) fr(c,S(4)+i,bas-S(11),S(3),2,pick(['#c46b3a','#7d9b45','#b0503c','#d8b73c']));
    brume(sp,row);return sp;
  }
  if(type==='tonneaux'){
    const sp=sprite(S(20),S(14)),c=sp.g,bas=sp.h-1;
    for(const[ox,oy,w2,h2] of [[0,0,S(8),S(11)],[S(9),S(2),S(7),S(9)],[S(3),-S(9),S(7),S(8)]]){
      if(oy<-S(2)&&chance(.5))continue;
      const y=bas-h2-oy;
      fr(c,ox,y,w2,h2,'#6a4c31'); fr(c,ox,y,1,h2,'#7d5b3a'); fr(c,ox+w2-1,y,1,h2,'#4c351f');
      fr(c,ox,y+1,w2,1,'#8a6a44'); fr(c,ox,y+h2-2,w2,1,'#8a6a44');
      fr(c,ox,y,w2,1,'#8f6d47');
    }
    brume(sp,row);return sp;
  }
  if(type==='barriere'){
    const sp=sprite(S(26),S(12)),c=sp.g,bas=sp.h-1;
    fr(c,0,bas-S(7),S(26),2,b[2]); fr(c,0,bas-S(4),S(26),2,b[2]);
    for(let i=1;i<S(26);i+=S(8)) { fr(c,i,bas-S(10),2,S(10),b[1]); fr(c,i,bas-S(10),1,S(10),b[0]); }
    brume(sp,row);return sp;
  }
  if(type==='torche'){
    /* La torche de rue : c'est elle qui éclaire la ville la nuit. Poteau
       équarri bagué de fer, panier à barreaux où l'on voit la braise, et
       une flamme visible MÊME DE JOUR — sans elle, l'objet n'est qu'un
       piquet. La lampe porte loin : c'est l'éclairage public du bourg. */
    const sp=sprite(9,S(26)),c=sp.g,bas=sp.h-1;
    const hp=S(21);
    fr(c,3,bas-hp,3,hp,b[1]);
    fr(c,3,bas-hp,1,hp,b[2]);
    fr(c,5,bas-hp,1,hp,b[0]);
    fr(c,2,bas-1,5,1,'rgba(18,14,9,.35)');
    for(const dy of [Math.round(hp*0.30),Math.round(hp*0.72)]){       // bagues de fer
      fr(c,2,bas-hp+dy,5,1,'#3d3f45');
      fr(c,2,bas-hp+dy-1,1,1,'#6a6e77');
    }
    // panier : anneaux haut et bas, trois barreaux, braise dedans
    const py=bas-hp-S(5);
    fr(c,1,py+S(4),7,1,'#3d3f45');
    fr(c,2,py,5,1,'#3d3f45');
    fr(c,1,py,1,1,'#6a6e77'); fr(c,7,py+S(4),1,1,'#2b2d33');
    for(const dx of [1,4,7]) fr(c,dx,py,1,S(5),'#3d3f45');
    fr(c,2,py+1,5,S(3),'#7a2c0c');
    for(let i=0;i<5;i++) if(chance(.7)) fr(c,2+i,py+1+RI(0,S(2)),1,1,pick(['#ffe0a0','#ffb04a','#ff6a1a']));
    // flamme de jour + langue jaune
    fr(c,3,py-2,3,2,'#ff8a2a'); fr(c,4,py-3,1,2,'#ffc35a'); fr(c,4,py-2,1,1,'#ffe8b0');
    sp.lampes.push({x:4,y:py-1,c:'#ffb347',r:S(15)});
    sp.flamme={x:3,y:py-3};
    return sp;
  }
  if(type==='sechoir'){                      // séchoir à poissons / filets
    const sp=sprite(S(28),S(20)),c=sp.g,bas=sp.h-1;
    fr(c,S(2),bas-S(16),2,S(16),b[1]); fr(c,S(23),bas-S(16),2,S(16),b[1]);
    fr(c,S(2),bas-S(16),S(23),2,b[2]);
    for(let i=S(4);i<S(23);i+=S(4)){
      fr(c,i,bas-S(14),1,S(6),'#8fa0a8');
      fr(c,i-1,bas-S(9),3,2,'#a8b6bd');
    }
    brume(sp,row);return sp;
  }
  if(type==='caisses'){
    const sp=sprite(S(20),S(16)),c=sp.g,bas=sp.h-1;
    for(const[ox,oy,w2] of [[0,0,S(9)],[S(10),0,S(8)],[S(3),S(9),S(8)]]){
      const h2=w2, y=bas-h2-oy;
      fr(c,ox,y,w2,h2,'#7a5c38'); fr(c,ox,y,w2,1,'#95724a'); fr(c,ox,y,1,h2,'#8a6a44');
      fr(c,ox,y+(h2>>1),w2,1,'#5d4529'); fr(c,ox+w2-1,y,1,h2,'#5d4529');
    }
    brume(sp,row);return sp;
  }
  if(type==='statue'){
    /* LE CHAT DE PIERRE — un seul par bourg, sur la place.
       Ce qui fait lire un chat assis, c'est la SILHOUETTE en poire : des
       hanches larges au sol, un poitrail qui se resserre en montant, une
       tête posée en surplomb et des oreilles franchement détachées. La
       queue vient se ranger devant les pattes et ferme la base. */
    const SW=S(24), SH=S(50);
    const sp=sprite(SW,SH), c=sp.g, bas=SH-1, cx=SW>>1;
    const p=['#b3ac9c','#968f80','#7a7367','#5a544a'];
    const soc=S(10);
    // socle : dé mouluré, une assise plus large que la statue
    socle(c,cx-S(9),bas-soc,S(18),soc,AMB.pierre);
    fr(c,cx-S(10),bas-soc-2,S(20),3,p[1]); fr(c,cx-S(10),bas-soc-2,S(20),1,clair(p[0],.22));
    fr(c,cx-S(8),bas-soc-4,S(16),2,p[1]);  fr(c,cx-S(8),bas-soc-4,S(16),1,clair(p[0],.14));
    fr(c,cx-S(9),bas-1,S(18),1,p[3]);
    const py=bas-soc-4;                                  // sommet du socle
    // corps assis : profil en poire, tracé colonne par colonne
    const bh=S(21), hanche=S(11), epaule=S(6);
    for(let j=0;j<bh;j++){
      const t=j/bh;                                      // 0 = épaules, 1 = hanches
      const wj=Math.round(epaule+(hanche-epaule)*Math.pow(t,1.7));
      const x0=cx-wj;
      fr(c,x0,py-bh+j,wj*2+1,1,p[1]);
      fr(c,x0,py-bh+j,Math.max(1,wj),1,p[0]);            // flanc au soleil
      fr(c,cx+wj-1,py-bh+j,2,1,p[2]);                    // flanc à l'ombre
      if(j===bh-1) fr(c,x0,py-bh+j,wj*2+1,1,p[2]);
    }
    // pattes avant : deux fûts courts posés devant les hanches
    for(const s of [-1,1]){
      const fx=cx+s*S(5)-(s<0?S(3):0);
      fr(c,fx,py-S(6),S(3),S(6),p[1]);
      fr(c,fx,py-S(6),1,S(6),p[0]);
      fr(c,fx,py-1,S(3),1,p[3]);
      fr(c,fx-1,py-S(6),S(5),1,p[0]);                    // saillie des orteils
    }
    // queue ramenée devant les pattes, en arc
    for(let i=0;i<S(13);i++){
      const t=i/S(13);
      const qx=cx-S(9)+Math.round(t*S(13));
      const qy=py-1-Math.round(Math.sin(t*3.14)*S(3));
      fr(c,qx,qy,1,2,p[2]); fr(c,qx,qy,1,1,p[1]);
    }
    // tête : légèrement plus étroite que les épaules, museau saillant
    const th=S(8), tw=S(9), ty=py-bh-th+1;
    fr(c,cx-(tw>>1),ty,tw,th,p[1]);
    fr(c,cx-(tw>>1),ty,tw,1,p[0]);
    fr(c,cx-(tw>>1),ty,Math.max(1,tw>>1),th,p[0]);
    fr(c,cx+(tw>>1)-1,ty,1,th,p[2]);
    fr(c,cx-(tw>>1),ty+th-1,tw,1,p[2]);
    // oreilles : triangles francs, taillés au-dessus de la tête
    const oh=S(5);
    for(const s of [-1,1]){
      const ox=s<0?cx-(tw>>1):cx+(tw>>1);
      for(let j=0;j<oh;j++){
        const wj=Math.max(1,Math.round(S(4)*(j+1)/oh));
        fr(c,s<0?ox:ox-wj+1,ty-oh+j,wj,1, s<0?p[0]:p[1]);
      }
      fr(c,s<0?ox:ox,ty-oh,1,1,p[2]);
    }
    // yeux creusés, museau, gravure des moustaches
    fr(c,cx-(tw>>1)+1,ty+S(3),2,1,p[3]); fr(c,cx+(tw>>1)-3,ty+S(3),2,1,p[3]);
    fr(c,cx-1,ty+S(5),3,2,p[0]); fr(c,cx,ty+S(5),1,1,p[2]);
    fr(c,cx-(tw>>1)-1,ty+S(5),1,1,p[2]); fr(c,cx+(tw>>1),ty+S(5),1,1,p[2]);
    // patine : mousse au pied, pierre lessivée au sommet
    for(let k=0;k<S(9);k++) fr(c,cx+RI(-S(9),S(9)),py-RI(0,S(6)),1,1,chance(.5)?'#5f7a44':'#4c6638');
    for(let k=0;k<S(4);k++) fr(c,cx+RI(-S(4),S(4)),ty-oh+RI(0,S(3)),1,1,clair(p[0],.20));
    fr(c,cx-S(10),bas,S(20),1,'rgba(14,18,10,.30)');
    brume(sp,row);return sp;
  }
  /* rucher */
  const sp=sprite(S(16),S(16)),c=sp.g,bas=sp.h-1;
  for(let j=0;j<S(12);j++){ const wj=Math.round(S(14)*(1-j/S(20)));
    fr(c,(sp.w-wj)>>1,bas-j,wj,1,j%3?PAL.chaume[1]:PAL.chaume[0]); }
  fr(c,(sp.w>>1)-1,bas-S(3),3,2,'#3a2c1e');
  brume(sp,row);return sp;
}

/* ==================================================================
   5. VÉGÉTATION
   ================================================================== */
/* ---------- ARBRES : plusieurs essences, toutes à l'échelle de leur rangée
   Un arbre ne doit jamais dépasser ~1,3 fois la hauteur d'une maison de la
   même rangée : c'est ce rapport qui fait tenir la perspective. ---------- */
const ESSENCES=['sapin','sapin','pin','chene','chene','peuplier','bouleau'];

/* Une masse de feuillage, éclairée en haut à gauche. Quatre tons suffisent
   à la faire tourner, à condition de fermer le bas-droit par un liseré
   sombre et de poser quelques éclats francs sur la calotte : sans eux la
   houppe reste une tache verte, avec eux elle prend du grain. */
function amasFeuilles(c,cx,cy,rx,ry,v,trou){
  for(let j=-ry;j<=ry;j++){
    const q=1-(j*j)/(ry*ry); if(q<=0)continue;
    const d=Math.round(rx*Math.sqrt(q));
    for(let i=-d;i<=d;i++){
      if(rnd()<(trou||0.08))continue;
      const t=(i*0.40+j*1.10)/(ry*1.3);
      let col = t<-0.58?v[2]:(t<-0.08?v[0]:(t<0.48?v[1]:v[3]));
      if(rnd()<0.07) col = t<0?v[2]:v[3];                 // grain
      c.fillStyle=col; c.fillRect(cx+i,cy+j,1,1);
    }
    if(j>0){ c.fillStyle=v[3]; c.fillRect(cx+Math.round(rx*Math.sqrt(q)),cy+j,1,1); }
  }
  for(let k=0,n=Math.max(2,rx>>1);k<n;k++){                // éclats sur la calotte
    const a=R(-2.45,-0.75), rr=R(0.40,0.88);
    const px2=Math.round(cx+Math.cos(a)*rx*rr), py2=Math.round(cy+Math.sin(a)*ry*rr);
    c.fillStyle=clair(v[2],.20); c.fillRect(px2,py2,1,1);
    if(chance(.45)) c.fillRect(px2+1,py2,1,1);
  }
}
function tronc(c,x,y,w,h,e,pente){
  pente=pente||0;
  for(let j=0;j<h;j++){
    const dx=Math.round(pente*(j/h));
    const wj=Math.max(1,Math.round(w*(1-0.35*(1-j/h))));
    fr(c,x-(wj>>1)+dx,y-h+j,wj,1,e[0]);
    fr(c,x-(wj>>1)+dx,y-h+j,Math.max(1,wj>>1),1,e[1]);
    if(wj>2&&chance(.35)) fr(c,x+(wj>>1)-1+dx,y-h+j,1,1,e[2]);
  }
  fr(c,x-w,y-2,w*2+1,2,e[1]);                       // empattement
}

function genArbre(row,essence,boost){
  const s=ech(row)*(boost||1);
  const t=essence||pick(ESSENCES);
  const feuilles = chance(.13)?pick(PAL.automne):pick(PAL.feuillage);
  const S=v=>Math.max(1,Math.round(v*s));

  /* ---------- SAPIN ----------
     L'ancien empilait des triangles indépendants : on lisait une pile de
     chapeaux, pas un arbre. Un sapin se dessine en JUPES qui se recouvrent
     — chacune s'évase vers le bas, retombe en pointes, et projette une
     ombre sur la jupe du dessous. C'est ce recouvrement, plus l'ombre
     entre deux étages, qui donne la profondeur du feuillage. */
  if(t==='sapin'){
    const h=S(RI(36,56)), w=S(RI(17,25));
    const sp=sprite(w+6,h+2), c=sp.g, cx=(w+6)>>1;
    const v=pick(PAL.conifere);                    // [moyen, sombre, clair, très sombre]
    const trh=Math.max(3,Math.round(h*0.11));
    fr(c,cx-1,h-trh,3,trh+1,'#4a3728');
    fr(c,cx-1,h-trh,1,trh+1,'#5f4a34'); fr(c,cx+1,h-trh,1,trh+1,'#31251a');
    const hf=h-trh;                                // hauteur de feuillage
    const et=clamp(Math.round(hf/Math.max(4,S(6))),5,15);
    let pew=0, peb=0;
    for(let e=0;e<et;e++){
      const t2=(e+1)/et;                           // 0 = cime, 1 = base
      const eb=Math.round(hf*t2)+1;                // bas de la jupe
      const ew=Math.max(1,Math.round((w*0.5)*Math.pow(t2,0.78)));
      const eh=Math.max(3,Math.round(hf/et*1.75)); // les jupes se recouvrent
      for(let j=0;j<eh;j++){
        const q=(j+1)/eh;
        const wj=Math.max(1,Math.round(ew*Math.pow(q,0.5)));
        const y=eb-eh+j; if(y<0) continue;
        fr(c,cx-wj,y,wj*2+1,1, q<0.34?v[2]:v[0]);          // moitié éclairée
        fr(c,cx+1,y,wj,1, q<0.34?v[0]:v[1]);               // moitié à l'ombre
        if(q>0.92) fr(c,cx-wj,y,wj*2+1,1,v[1]);
      }
      // pointes retombantes : c'est la DENTELURE qui doit marquer l'étage
      for(let i=-ew;i<=ew;i++){
        const m=(i+e*2+ew)%3;
        if(m===0) fr(c,cx+i,eb,1,RI(1,2),v[1]);
        else if(m===1) fr(c,cx+i,eb,1,1,v[3]);
      }
      /* Ombre de l'étage précédent, tracée APRÈS la jupe courante — sinon
         elle est recouverte et les étages fondent en un cône lisse. Elle est
         en CROISSANT, creusée au milieu et nulle aux pointes : une bande
         droite transformait le sapin en pièce montée. */
      if(e>0) for(let i=-pew;i<=pew;i++){
        const q=1-Math.abs(i)/(pew+1);
        fr(c,cx+i,peb+1,1,Math.max(1,Math.round(q*2.2)),ombre(v[1],.24));
      }
      pew=ew; peb=eb;
      // trouées de ciel dans le feuillage : sans elles la masse reste opaque
      if(e>1) for(let k=0,nk=RI(0,2);k<nk;k++)
        c.clearRect(cx+RI(-ew,ew),eb-RI(1,Math.max(2,eh-2)),1,RI(1,2));
    }
    // flèche terminale
    fr(c,cx,0,1,Math.max(2,Math.round(hf*0.06)),v[2]);
    brume(sp,row); return sp;
  }

  if(t==='pin'){                       // fût nu, couronne étalée au sommet
    const h=S(RI(40,58)), w=S(RI(20,30));
    const sp=sprite(w,h), c=sp.g, cx=w>>1;
    const v=pick(PAL.conifere);
    const trh=Math.round(h*0.62);
    tronc(c,cx,h,Math.max(2,S(3)),trh,PAL.ecorce[0],S(RI(-3,3)));
    for(let b=0;b<3;b++){
      const by=h-trh-Math.round((h-trh)*R(0.05,0.55));
      const bx=cx+(chance(.5)?-1:1)*Math.round(w*R(0.12,0.34));
      trait(c,cx,h-trh+Math.round((h-trh)*0.3),bx,by,PAL.ecorce[0][1],2);
      amasFeuilles(c,bx,by,Math.max(2,Math.round(w*R(0.18,0.30))),
                        Math.max(2,Math.round(h*R(0.05,0.10))),v,0.12);
    }
    amasFeuilles(c,cx,Math.round(h*0.16),Math.max(3,Math.round(w*0.42)),
                      Math.max(2,Math.round(h*0.11)),v,0.10);
    brume(sp,row); return sp;
  }

  if(t==='peuplier'){                  // colonne étroite et haute, d'un seul tenant
    const h=S(RI(44,64)), w=S(RI(13,19));
    const sp=sprite(w,h), c=sp.g, cx=w>>1;
    tronc(c,cx,h,Math.max(2,S(3)),Math.round(h*0.92),PAL.ecorce[0],0);
    const n=RI(8,12);
    for(let k=0;k<n;k++){
      const p=k/(n-1);
      // le fuseau : large au milieu, effilé aux deux bouts. On décale chaque
      // touffe et on l'ajoure franchement, sinon la colonne devient une dalle
      const larg=0.62-0.34*Math.pow(Math.abs(p-0.42)*2,1.4);
      amasFeuilles(c,cx+RI(-2,2),Math.round(h*0.06+p*h*0.76),
        Math.max(2,Math.round(w*larg*R(0.72,1.05))),
        Math.max(3,Math.round(h*R(0.08,0.13))),feuilles,0.20);
    }
    for(let k=0;k<n;k++){                       // encoches dans la silhouette
      const p=rnd(), y=Math.round(h*0.06+p*h*0.74);
      const s2=chance(.5)?-1:1;
      const d=Math.round(w*(0.30-0.16*Math.abs(p-0.42)*2));
      c.clearRect(cx+s2*d,y,Math.max(1,RI(1,3)),RI(2,5));
    }
    brume(sp,row); return sp;
  }

  if(t==='bouleau'){                   // tronc clair, houppier léger
    const h=S(RI(34,48)), w=S(RI(20,30));
    const sp=sprite(w,h), c=sp.g, cx=w>>1;
    const trh=Math.round(h*0.55), pente=S(RI(-2,2));
    tronc(c,cx,h,Math.max(2,S(3)),trh,PAL.ecorce[2],pente);
    for(let k=0;k<5;k++) fr(c,cx-1+RI(-1,1),h-trh+RI(2,trh-2),RI(1,3),1,'#3a2f22');
    for(let b=0;b<4;b++){
      const bx=cx+pente+(chance(.5)?-1:1)*Math.round(w*R(0.10,0.32));
      const by=Math.round(h*R(0.12,0.42));
      trait(c,cx+pente,h-trh+2,bx,by,PAL.ecorce[2][1],1);
      amasFeuilles(c,bx,by,Math.max(2,Math.round(w*R(0.20,0.32))),
                        Math.max(2,Math.round(h*R(0.09,0.15))),feuilles,0.24);
    }
    brume(sp,row); return sp;
  }

  /* chêne : houppier large et dense, le feuillu de référence */
  const h=S(RI(30,44)), w=S(RI(28,42));
  const sp=sprite(w,h), c=sp.g, cx=w>>1;
  const trh=Math.round(h*0.36);
  tronc(c,cx,h,Math.max(3,S(4)),trh,PAL.ecorce[0],0);
  trait(c,cx,h-trh+2,cx-Math.round(w*0.20),h-trh-Math.round(h*0.10),PAL.ecorce[0][0],2);
  trait(c,cx,h-trh+4,cx+Math.round(w*0.20),h-trh-Math.round(h*0.08),PAL.ecorce[0][0],2);
  const amas=RI(4,6);
  for(let k=0;k<amas;k++){
    const a=(k/amas)*6.28+rnd()*0.6;
    const ax=cx+Math.round(Math.cos(a)*w*0.24);
    const ay=h-trh-Math.round(h*0.28)+Math.round(Math.sin(a)*h*0.14);
    amasFeuilles(c,ax,ay,Math.max(2,Math.round(w*R(0.20,0.30))),
                      Math.max(2,Math.round(h*R(0.16,0.24))),feuilles,0.07);
  }
  brume(sp,row); return sp;
}
function genBuisson(row){
  const s=ech(row);
  const w=Math.round(RI(14,24)*s), h=Math.round(RI(9,15)*s);
  const sp=sprite(w,h),c=sp.g;
  const v=pick(PAL.feuillage);
  for(let k=0;k<3;k++){
    const rr=Math.round(h*R(.5,.85)), ax=Math.round(w*(0.22+0.28*k)), ay=h-rr+RI(0,2);
    for(let j=-rr;j<=rr;j++){const d=Math.floor(Math.sqrt(Math.max(0,rr*rr-j*j)));
      for(let i=-d;i<=d;i++){ if(rnd()<.1)continue; fr(c,ax+i,ay+j,1,1, j<0?v[2]:(chance(.25)?v[3]:v[0])); }}
  }
  if(chance(.4)) for(let k=0;k<4;k++) fr(c,RI(1,w-2),RI(1,h-2),1,1,pick(['#c85a6a','#d8b73c','#e0e0d0']));
  brume(sp,row); return sp;
}
function genRocher(row){
  const s=ech(row);
  const w=Math.round(RI(12,26)*s), h=Math.round(RI(7,14)*s);
  const sp=sprite(w,h),c=sp.g,p=AMB.pierre;
  for(let j=0;j<h;j++){
    const t=j/h, wj=Math.max(2,Math.round(w*(0.35+0.65*t)));
    fr(c,(w-wj)>>1,h-1-j,wj,1, t>0.75?p[0]:(t>0.3?p[1]:p[2]));
  }
  for(let k=0;k<4;k++) fr(c,RI(1,w-3),RI(1,h-2),RI(1,3),1,p[3]);
  fr(c,0,h-2,w,2,p[3]);
  brume(sp,row); return sp;
}

/* ---------- CHAMP DE TOURNESOLS : 6 frames pré-cuites ---------- */
function genTournesols(row,largeur){
  const s=ech(row);
  const hMax=Math.round(26*s), W2=largeur, H2=hMax+4;
  const NF=6, frames=[];
  const plantes=[];
  const rangs=row===2?3:2;
  for(let r=0;r<rangs;r++){
    const pas=Math.round(R(7,10)*s);
    for(let x=RI(2,pas);x<W2-2;x+=pas){
      plantes.push({x:x+RI(-1,1), y:H2-1-r*Math.round(4*s), h:Math.round(R(.72,1)*hMax*(0.8+0.2*r/rangs)),
                    ph:rnd()*6.28, r});
    }
  }
  plantes.sort((a,b)=>a.y-b.y);
  const T=PAL.tournesol;
  for(let f=0;f<NF;f++){
    const sp=sprite(W2,H2), c=sp.g;
    const u=(f/NF)*6.28;
    for(const p of plantes){
      /* Le tournesol était une tige d'un pixel surmontée d'un disque. Une
         plante, c'est d'abord un PORT : la tige s'épaissit vers le bas, elle
         ploie sous le poids du capitule et le capitule PENCHE — un tournesol
         mûr regarde le sol. Les feuilles sont de grandes palmes cordées,
         nervurées, portées en alternance ; les boutons non ouverts font la
         différence entre un champ et une rangée de pastilles. */
      const bend=Math.sin(u+p.ph)*(1.6*s);
      const tx=p.x+bend;
      const ep=Math.max(1,Math.round(1.6*s));
      for(let j=0;j<p.h;j++){
        const k=j/p.h;
        const wj=Math.max(1,Math.round(ep*(1-0.45*k)));
        const xx=Math.round(p.x+bend*k*k);
        fr(c,xx,p.y-j,wj,1, k>0.55?'#4a7430':'#5d8d3a');
        if(wj>1) fr(c,xx,p.y-j,1,1,'#6e9f46');
        if(j%Math.max(2,Math.round(3*s))===0) fr(c,xx,p.y-j,1,1,'#3f6627');
      }
      // palmes alternées, nervurées
      const nf2=Math.max(2,Math.round(3*(0.7+0.3*s)));
      for(let k2=0;k2<nf2;k2++){
        const t2=0.22+0.52*(k2/Math.max(1,nf2-1));
        const ly=p.y-Math.round(p.h*t2);
        const lx=Math.round(p.x+bend*t2*t2);
        const cote2=(k2%2)?1:-1;
        const lw=Math.max(2,Math.round(R(3.2,4.6)*s)), lh=Math.max(2,Math.round(R(2.0,3.0)*s));
        const vert=k2%2?'#4a7430':'#3f6627';
        for(let j=0;j<lh;j++){
          const q=1-Math.abs(j-(lh-1)/2)/((lh-1)/2+0.001);
          const d=Math.max(1,Math.round(lw*Math.pow(q,0.6)));
          fr(c,cote2>0?lx+1:lx-d,ly+j-((lh-1)>>1),d,1, j===0?'#6e9f46':vert);
        }
        fr(c,cote2>0?lx+1:lx-lw,ly,lw,1,'#5d8d3a');            // nervure
        fr(c,lx,ly,1,1,'#6e9f46');
      }
      // capitule : il penche, donc on voit la face et un peu du revers
      const hx=Math.round(tx+bend*0.35), hy=p.y-p.h;
      const rr=Math.max(2,Math.round(3.4*s));
      const inc=Math.max(1,Math.round(rr*0.35));               // inclinaison
      fr(c,hx-1,hy+rr-1,2,inc+1,'#4a7430');                    // col recourbé
      /* Le capitule n'est pas un disque jaune à cœur brun : c'est un CŒUR
         brun large, entouré d'une couronne de ligules SÉPARÉES. Tant que le
         jaune remplissait tout le rond, la fleur restait une pastille. On
         peint donc d'abord les pétales un par un, avec leur intervalle, puis
         le cœur par-dessus — il occupe plus de la moitié du rayon. */
      /* À six pixels de rayon, des ligules séparées ne donnent pas une fleur
         mais un oursin : les intervalles l'emportent sur les pétales. On
         garde donc une couronne PLEINE — c'est ce que l'œil lit comme du
         jaune de tournesol — et on la fait vibrer par le bord : dentelure
         d'une ligule sur deux, ombre portée du cœur, moitié basse assombrie.
         La séparation des pétales revient par la lumière, pas par le vide. */
      const rc=Math.max(1,Math.round(rr*0.44));
      disque(c,hx,hy+inc,rr,T[1]);
      disque(c,hx,hy+inc,rr-1,T[0]);
      const nlig=Math.max(7,Math.round(rr*1.9));
      for(let a=0;a<nlig;a++){
        const ang=a/nlig*6.28+0.19;
        const ca=Math.cos(ang), sa=Math.sin(ang)*0.92;
        const lg=rr+((a%2)?1:0);
        fr(c,hx+Math.round(ca*lg),hy+inc+Math.round(sa*lg),1,1, sa<-0.15?clair(T[0],.24):T[0]);
        // creux entre deux ligules : un pixel plus sombre suffit à les compter
        const ang2=(a+0.5)/nlig*6.28+0.19;
        fr(c,hx+Math.round(Math.cos(ang2)*(rr-1)),hy+inc+Math.round(Math.sin(ang2)*0.92*(rr-1)),1,1,T[2]);
      }
      for(let j=1;j<=rr;j++){                                  // moitié basse dans l'ombre
        const q=1-(j*j)/(rr*rr); if(q<=0) continue;
        const d=Math.round(rr*Math.sqrt(q));
        fr(c,hx-d,hy+inc+j,2*d+1,1,'rgba(90,60,10,0.14)');
      }
      fr(c,hx-rr+1,hy+inc-rr+1,Math.max(1,rr-1),1,clair(T[0],.26));
      // cœur : akènes en spirale de Fibonacci, arête haute éclairée
      disque(c,hx,hy+inc,rc,T[3]);
      disque(c,hx,hy+inc,Math.max(1,rc-1),mix(T[3],'#6b5220',.40));
      const na=Math.max(5,rc*rc*2);
      for(let a=0;a<na;a++){
        const ang=a*2.39996, rq=(rc-0.4)*Math.sqrt(a/na);
        fr(c,hx+Math.round(Math.cos(ang)*rq),hy+inc+Math.round(Math.sin(ang)*rq),1,1,
           (a%3)?mix(T[3],'#2f240b',.42):mix(T[3],'#9a7c34',.55));
      }
      fr(c,hx-rc+1,hy+inc-rc,Math.max(1,rc),1,mix(T[3],'#b08c40',.55));
      for(let a=0;a<Math.max(4,rc*3);a++){ const an=a/Math.max(4,rc*3)*6.28;
        fr(c,hx+Math.round(Math.cos(an)*(rc+1)),hy+inc+Math.round(Math.sin(an)*(rc+1)),1,1,'rgba(70,45,8,.30)'); }
      fr(c,hx-1,hy+inc+rc-1,2,1,mix(T[3],'#241b06',.5));
      // bouton non ouvert sur une pousse latérale : c'est lui qui fait champ
      if(p.h>10*s && ((p.x+p.r)&3)===0){
        const bx2=Math.round(p.x+bend*0.6)+(((p.x)&1)?3:-3);
        const by2=p.y-Math.round(p.h*0.78);
        trait(c,Math.round(p.x+bend*0.5),p.y-Math.round(p.h*0.62),bx2,by2,'#4a7430',1);
        disque(c,bx2,by2,Math.max(1,Math.round(rr*0.45)),'#4e7a30');
        fr(c,bx2-1,by2-1,1,1,'#6e9f46');
        if(chance(.5)) fr(c,bx2,by2-Math.max(1,Math.round(rr*0.45)),1,1,T[1]);
      }
    }
    brume(sp,row);
    frames.push(sp.can);
  }
  return {frames, w:W2, h:H2};
}

/* ==================================================================
   6. FORÊT (droite) et CHAMP DE BATAILLE (gauche)
   ================================================================== */
/* ==================================================================
   6bis. FORÊT (droite) et CHAMP DE BATAILLE (gauche)
   Tous deux sont peuplés d'éléments posés SUR LES RANGÉES du village :
   ils héritent donc automatiquement de l'échelle, du voile atmosphérique
   et de l'ordre de profondeur. C'est la seule façon d'avoir une vraie
   perspective — un calque séparé ne peut pas en avoir.
   ================================================================== */
function genererForet(){
  const [fx0,fx1]=ZONE.foret;
  const larg=Math.max(24,fx1-fx0);
  for(let r=0;r<NR;r++){
    // deux passes décalées d'un demi-pas : les couronnes se recouvrent et
    // forment une masse, au lieu d'une haie d'arbres bien alignés
    const pas=Math.max(5,Math.round(sc(r,11)));
    if(r===NR-1) continue;                 // rien sur la berge
    for(let passe=0;passe<2;passe++){
      for(let x=fx0-Math.round(larg*0.12)+passe*(pas>>1); x<W+pas; x+=pas){
        const t=(x-fx0)/larg;
        const p=(t<0?Math.max(0,0.26*(1+t)):0.50+0.50*Math.min(1,t))*(passe?0.55:1);
        if(rnd()>p) continue;
        const px=Math.round(x+R(-pas*0.35,pas*0.35));
        if(px<2||px>W+8) continue;
        const essence = rnd()<0.50?'sapin':pick(['pin','chene','peuplier','bouleau','chene']);
        const sp=genArbre(r,essence,R(1.10,1.50));
        decors.push({sp,x:px-(sp.w>>1),y:solY(r,px)+1+RI(-2,3),r,ne:-99,cuit:false});
      }
    }
  }
  // rideau de bord d'écran : quelques arbres proches qui ferment le cadre
  for(let r=1;r<NR-1;r++){
    for(let k=0;k<2;k++){
      const px=W-RI(2,Math.round(larg*0.34));
      // des conifères pour fermer le cadre : un feuillu de cette taille
      // devient une masse informe
      const sp=genArbre(r,rnd()<0.7?'sapin':'pin',R(1.25,1.5));
      decors.push({sp,x:px-(sp.w>>1),y:solY(r,Math.min(px,W-1))+1+RI(0,3),r,ne:-99,cuit:false});
    }
  }
  // sous-bois : la berge en est exclue, elle appartient au quai
  for(let r=2;r<NR-1;r++){
    for(let k=0;k<Math.round(larg/16)+2;k++){
      const px=Math.round(R(fx0-larg*0.15,W-2));
      const sp=chance(.75)?genBuisson(r):genRocher(r);
      decors.push({sp,x:px-(sp.w>>1),y:solY(r,px)+1,r,ne:-99,cuit:false});
    }
  }
  // bosquets isolés côté village, pour que la lisière ne soit pas un mur net
  for(let k=0;k<RI(2,4);k++){
    const r=RI(0,2);
    const px=Math.round(R(ZONE.ville[0]+W*0.05,fx0));
    const sp=genArbre(r,pick(['chene','bouleau','peuplier']),R(0.85,1.05));
    const x0=px-(sp.w>>1);
    if(libre(r,x0,x0+sp.w)) decors.push({sp,x:x0,y:solY(r,px)+1,r,ne:-99,cuit:false});
  }
}

/* --- pièces du champ de bataille : peu nombreuses, plantées au sol --- */
function genBanniere(row){
  const s=ech(row), S=v=>Math.max(1,Math.round(v*s));
  const hh=S(RI(24,38));
  const sp=sprite(S(18),hh+S(5)), c=sp.g, bas=sp.h-1, x=S(3);
  fr(c,x-4,bas-2,11,3,PAL.terre[2]); fr(c,x-4,bas-2,11,1,PAL.terre[1]);
  fr(c,x,bas-hh,2,hh,'#4a3728'); fr(c,x,bas-hh,1,hh,'#63492f');
  fr(c,x-1,bas-hh-4,4,5,'#9aa2ad'); fr(c,x,bas-hh-4,1,5,'#c3c9d0');
  sp.drapeaux.push({x:x+2,y:bas-hh+S(3),w:S(12),h:S(9),col:pick(PAL.blason)});
  brume(sp,row); return sp;
}
function genArmes(row){
  const s=ech(row), S=v=>Math.max(1,Math.round(v*s));
  const n=RI(2,3);
  const sp=sprite(S(9)*n+S(6),S(30)), c=sp.g, bas=sp.h-1;
  for(let k=0;k<n;k++){
    const x=S(5)+k*S(9), q=rnd();
    fr(c,x-3,bas-1,8,2,PAL.terre[2]);
    if(q<0.38){                                   // épée plantée
      const hh=S(RI(12,19));
      fr(c,x,bas-hh,1,hh,'#b8bec7'); fr(c,x+1,bas-hh,1,hh,'#7d848d');
      fr(c,x-2,bas-hh,6,1,'#5c4128');
      fr(c,x,bas-hh-3,2,3,'#4a3728'); fr(c,x,bas-hh-4,2,1,'#8a6a44');
    } else if(q<0.74){                            // lance ou hallebarde
      const hh=S(RI(18,28)), p=RI(-2,2);
      trait(c,x,bas,x+p,bas-hh,'#4a3728',1);
      fr(c,x+p-1,bas-hh-4,3,5,'#9aa2ad'); fr(c,x+p,bas-hh-4,1,5,'#c3c9d0');
    } else {                                      // bouclier posé de champ
      const rr=Math.max(2,S(RI(3,5))), col=pick(PAL.blason);
      ellipse(c,x,bas-rr,rr,rr+1,col);
      ellipse(c,x,bas-rr-1,Math.max(1,rr-2),Math.max(1,rr-2),clair(col,.28));
      fr(c,x-rr,bas-1,rr*2+1,1,ombre(col,.42));
    }
  }
  brume(sp,row); return sp;
}
function genFeuSol(row){
  const s=ech(row), S=v=>Math.max(1,Math.round(v*s));
  const sp=sprite(S(20),S(15)), c=sp.g, bas=sp.h-1, cx=sp.w>>1;
  ellipse(c,cx,bas-1,S(8),Math.max(2,S(3)),'#2b2118');
  ellipse(c,cx,bas-2,S(5),Math.max(1,S(2)),'#1a140e');
  for(let i=0;i<4;i++) trait(c,cx-S(5)+i*2,bas-1,cx+S(4)-i*2,bas-S(5),'#3a2c1e',1);
  sp.brasier={x:cx,y:bas-S(5),r:S(13),c:'#ff8a2a'};
  sp.fumees.push({x:cx,y:bas-S(7),t:0,d:0.9});
  return sp;
}
function genererBataille(){
  const [bx0,bx1]=ZONE.bat;
  const larg=Math.max(24,bx1-bx0);
  for(let r=0;r<NR-1;r++){
    const n=RI(2,3);                       // quelques pièces par étage, pas plus
    for(let k=0;k<n;k++){
      const px=Math.round(R(bx0+2,bx1+larg*0.12));
      const q=rnd();
      const sp = q<0.36?genBanniere(r) : (q<0.74?genArmes(r):genFeuSol(r));
      decors.push({sp,x:px-(sp.w>>1),y:solY(r,px)+1,r,ne:-99,cuit:false});
    }
  }
  // un arbre mort ou deux, rien de plus
  for(let k=0;k<2;k++){
    const r=RI(0,2), px=Math.round(R(bx0,bx1));
    const s=ech(r), h=Math.round(RI(22,34)*s);
    const sp=sprite(Math.round(20*s),h), c=sp.g, cx=sp.w>>1;
    tronc(c,cx,h,Math.max(2,Math.round(3*s)),h-2,PAL.ecorce[1],Math.round(RI(-2,2)*s));
    for(let b=0;b<4;b++) trait(c,cx,h-Math.round(h*R(0.4,0.85)),
      cx+(chance(.5)?-1:1)*Math.round(sp.w*R(0.18,0.45)),
      h-Math.round(h*R(0.55,0.95)),'#33291d',1);
    brume(sp,r);
    decors.push({sp,x:px-(sp.w>>1),y:solY(r,px)+1,r,ne:-99,cuit:false});
  }
}

/* ==================================================================
   7. ATLAS D'HABITANTS
   Un seul canvas contient toutes les silhouettes : 1 drawImage par
   villageois au lieu de 6 fillRect. Variantes de taille (rangée),
   de tenue, d'animation et de sens de marche.
   ================================================================== */
/* Les habitants sont des chats humanoïdes. Chaque tenue fixe non seulement
   deux couleurs mais une SILHOUETTE (chaperon, chapeau de paille, cape,
   panier, bâton) : c'est la silhouette qui distingue deux passants à
   douze pixels de haut, jamais la nuance du tissu.
   coiffe 0 rien · 1 chaperon · 2 chapeau de paille · 3 béguin · 4 cape à capuche
   porte  0 rien · 1 panier · 2 bâton · 3 ballot sur l'épaule · 4 cruche */
const TENUES=[
  {robe:'#8c3b34',pelage:'#d9954e',raie:'#a8672c',coiffe:0,porte:1},  // roux tigré
  {robe:'#3f5c6b',pelage:'#9aa2ad',raie:'#77808c',coiffe:1,porte:0},  // gris chaperon
  {robe:'#5d5030',pelage:'#e8e0cd',raie:'#c9bfa6',coiffe:2,porte:3},  // crème, paille
  {robe:'#6b4b57',pelage:'#4a4038',raie:'#332c26',coiffe:0,porte:2},  // brun sombre
  {robe:'#4a5c46',pelage:'#c9a05c',raie:'#9c7539',coiffe:3,porte:4},  // fauve béguin
  {robe:'#7d6a3c',pelage:'#7d8790',raie:'#5e666e',coiffe:0,porte:0},
  {robe:'#6a4c31',pelage:'#2e2a26',raie:'#1e1b18',coiffe:4,porte:2},  // noir encapé
  {robe:'#405878',pelage:'#d9954e',raie:'#a8672c',coiffe:0,porte:3},
  {robe:'#7a4433',pelage:'#e8e0cd',raie:'#bfae94',coiffe:1,porte:1},
  {robe:'#4d5a4a',pelage:'#b98a52',raie:'#8c6234',coiffe:2,porte:0},
  {robe:'#8a6a2a',pelage:'#9aa2ad',raie:'#6f7883',coiffe:0,porte:4},
  {robe:'#5a4266',pelage:'#4a4038',raie:'#2f2924',coiffe:3,porte:0}
];
const NF_MARCHE=4;
let atlas=null, atlasInfo=null;

function construireAtlas(){
  // 4 tailles (une par rangée) x 12 tenues x 4 poses x 2 sens
  const k=clamp(ECHM*0.92,0.85,2.6);      // débridé : la haute résolution
                                          // mérite des habitants détaillés
  const tailles=[{w:5,h:9},{w:5,h:11},{w:6,h:14},{w:6,h:15}]
    .map(t=>({w:Math.max(4,Math.round(t.w*k)),h:Math.max(7,Math.round(t.h*k))}));
  const maxW=tailles[3].w, maxH=tailles[3].h;
  const cellW=maxW+11, cellH=maxH+9;
  const cols=NF_MARCHE*2, rows=tailles.length*TENUES.length;
  const can=document.createElement('canvas');
  can.width=cellW*cols; can.height=cellH*rows;
  const c=can.getContext('2d'); c.imageSmoothingEnabled=false;
  for(let ti=0;ti<tailles.length;ti++){
    const T=tailles[ti], voile=VOILE[ti];
    for(let vi=0;vi<TENUES.length;vi++){
      const t=TENUES[vi];
      const v=col=>voile>0?mix(col,'#96b2cc',voile):col;
      const P={robe:v(t.robe),pelage:v(t.pelage),raie:v(t.raie),coiffe:t.coiffe,porte:t.porte,voile,
               rb:robeChat(v(t.pelage))};   // la robe féline, tirée une fois par tenue
      for(let f=0;f<NF_MARCHE;f++) for(let d=0;d<2;d++){
        const ox=(f*2+d)*cellW, oy=(ti*TENUES.length+vi)*cellH;
        dessinerVillageois(c,ox+((cellW-T.w)>>1),oy+cellH-T.h-1,T.w,T.h,P,f,d);
      }
    }
  }
  atlas=can;
  atlasInfo={cellW,cellH,tailles};
}

/* ------------------------------------------------------------------
   UN HABITANT
   À 8-15 px, tout se joue sur trois lectures : la SILHOUETTE (oreilles
   pointues bien détachées, queue qui sort du corps), le CONTRASTE tête
   claire / vêtement sombre, et le MOUVEMENT (jambes en ciseaux, bras
   opposé, balancement de la queue, tassement du corps au passage).
   Le reste — museau, truffe, rayures tabby, ceinture, bottes — n'est
   lisible qu'au premier plan, mais c'est lui qui empêche la foule de
   ressembler à une rangée de pions.
   ------------------------------------------------------------------ */
function dessinerVillageois(c,x,y,w,h,P,f,dir){
  const s=dir?1:-1;                              // +1 : regarde vers la droite
  const bob=[0,1,0,1][f];                        // tassement au passage
  const jaA=[0,1,0,-1][f], jaB=[0,-1,0,1][f];    // jambes en ciseaux
  const brA=[0,-1,0,1][f];
  const qu =[0,-1,0,1][f];                       // balancement de la queue
  const cw=Math.max(3,w-1);
  /* Le rapport tête/corps est le seul réglage qui compte : à 0,33 on
     obtient une peluche à grosse tête, à 0,22 un bâton. 0,27 tient les
     deux bouts — la tête reste assez large pour porter museau et oreilles,
     le buste garde de quoi montrer une ceinture et un pli d'étoffe. */
  const th=clamp(Math.round(h*0.245),3,8);       // tête resserrée
  const tw=clamp(th,3,cw+1);
  const oh=h>=15?3:(h>=11?2:1);                  // oreilles qui comptent
  const jamH=clamp(Math.round(h*0.16),1,3);
  const pieds=y+h-1;
  const hx=x+((cw-tw)>>1)+(h>=11?s:0);
  const hy=y+oh+bob;
  const corpsY=hy+th;
  const tor=pieds-jamH;                          // bas du vêtement
  const R1=P.robe, RO=ombre(R1,.34), RC=clair(R1,.18);
  const F1=P.pelage, FO=ombre(F1,.24), FC=clair(F1,.30), VE=clair(F1,.48);
  const cuir=mix(R1,'#2a1c12',.62);
  const px=(X,Y,W2,H2,col)=>{ c.fillStyle=col; c.fillRect(X,Y,W2,H2); };

  px(x,y+h,w,1,'rgba(18,14,9,.26)');                       // ombre au sol
  px(x+1,y+h,w-2,1,'rgba(18,14,9,.18)');

  // --- queue : deux segments en S, la pointe s'écarte et porte la robe ---
  const qx=dir?x-1:x+cw;
  const ql=Math.max(3,Math.round(h*0.30));
  px(qx,tor-1,1,2,FO);                                          // naissance
  px(qx-s,tor-2+qu,1,ql,F1);                                    // premier segment
  px(qx-2*s,tor-2+qu-Math.max(1,(ql>>1)),1,Math.max(2,(ql>>1)+1),F1);  // second, écarté
  px(qx-2*s,tor-3+qu-Math.max(1,(ql>>1)),1,1,FC);               // pointe éclairée
  if(P.rb.t==='pointu') px(qx-2*s,tor-2+qu-Math.max(1,(ql>>1)),1,2,P.rb.bout);
  if(P.rb.t==='tigre'){ px(qx-s,tor-1+qu+Math.round(ql*0.4),1,1,P.rb.raie);
                        px(qx-2*s,tor-2+qu-1,1,1,P.rb.raie); }

  // --- cape derrière le corps ---
  if(P.coiffe===4){
    px(x-(dir?0:1),corpsY-1,cw+1,tor-corpsY+2,ombre(R1,.18));
    px(x-(dir?0:1),corpsY-1,cw+1,1,RO);
  }

  // --- jambe arrière ---
  px(x+(dir?1:cw-2),pieds-jamH-Math.max(0,jaB),1,jamH+Math.max(0,jaB),RO);
  px(x+(dir?1:cw-2),pieds-1,1,1,'#241c14');

  // --- corps / vêtement ---
  px(x,corpsY,cw,tor-corpsY+1,R1);
  px(x+(dir?cw-1:0),corpsY,1,tor-corpsY+1,RC);                  // flanc éclairé
  px(x+(dir?0:cw-1),corpsY,1,tor-corpsY+1,RO);
  px(x,tor,cw,1,RO);
  if(P.rb.t==='smoking') px(x+(dir?cw-2:1),corpsY,2,1,P.rb.blanc);   // poitrail
  if(h>=10){
    px(x,corpsY+Math.round((tor-corpsY)*0.52),cw,1,cuir);       // ceinture
    px(x+(dir?cw-2:1),corpsY+Math.round((tor-corpsY)*0.52),1,1,'#c9a24a');
    px(x,corpsY,cw,1,clair(R1,.10));                            // encolure
  }
  if(h>=12) px(x+(dir?1:cw-2),tor-2,1,2,ombre(R1,.16));          // pli du vêtement

  // --- jambe avant + botte ---
  px(x+(dir?cw-2:1),pieds-jamH-Math.max(0,jaA),1,jamH+Math.max(0,jaA),ombre(R1,.20));
  px(x+(dir?cw-2:1),pieds-1-Math.max(0,jaA),Math.min(2,w-1),1,'#2e2318');

  // --- bras avant ---
  const ax2=dir?x+cw:x-1;
  px(ax2,corpsY+1+Math.max(0,brA),1,Math.max(2,Math.round(h*0.24)),ombre(R1,.10));
  if(h>=11) px(ax2,corpsY+1+Math.max(0,brA)+Math.max(1,Math.round(h*0.22)),1,1,F1);  // patte

  // --- tête ---
  px(hx,hy,tw,th,F1);
  px(hx,hy,tw,1,FC);
  px(hx+(dir?0:tw-1),hy,1,th,FO);
  px(hx,hy+th-1,tw,1,FO);
  /* la robe féline se lit sur la tête, seule fourrure visible avec la
     queue : rayures du tabby, masque du pointu, bavette du smoking */
  if(P.rb.t==='tigre'&&tw>=4){ px(hx+1,hy+1,1,1,P.rb.raie); px(hx+tw-2,hy+2,1,1,P.rb.raie); }
  else if(P.rb.t==='pointu'){ px(hx+(dir?tw-1:0),hy+th-2,1,2,P.rb.bout); }
  // oreilles : nettement détachées, pointe sombre, intérieur clair
  px(hx,hy-oh,1,oh,F1); px(hx+tw-1,hy-oh,1,oh,F1);
  px(hx,hy-oh,1,1,FO);  px(hx+tw-1,hy-oh,1,1,FO);
  if(tw>=5){ px(hx+1,hy-1,1,1,F1); px(hx+tw-2,hy-1,1,1,F1); }  // base élargie
  if(P.rb.t==='pointu'){ px(hx,hy-oh,1,oh,P.rb.bout); px(hx+tw-1,hy-oh,1,oh,P.rb.bout); }
  if(oh===2){ px(hx,hy-1,1,1,mix(F1,'#e0a0a8',.45)); px(hx+tw-1,hy-1,1,1,mix(F1,'#e0a0a8',.45)); }
  // museau du côté du regard, truffe, yeux — jamais toute la face en clair,
  // sinon la tête devient un carré blanc
  const mx=hx+(dir?tw-1:0);
  px(mx,hy+th-1,1,1,VE);
  if(tw>=5) px(mx-(dir?1:-1),hy+th-1,1,1,mix(VE,F1,.45));
  px(mx,hy+th-2,1,1,'#c08a8e');
  const oeil=(P.rb.t==='tigre'||P.rb.t==='pointu')?'#4f8a52':'#1b1f26';
  /* sur une tête de quatre pixels, deux yeux se touchent : le cyclope.
     En dessous de cinq de large, un seul œil — côté regard — suffit. */
  const oh2=(h>=13&&tw>=5)?2:1;
  px(hx+(dir?tw-2:1),hy+1,1,oh2,oeil);
  if(tw>=5) px(hx+(dir?1:tw-2),hy+1,1,oh2,oeil);
  if(h>=14){                                                    // moustaches
    px(hx+(dir?tw:-1),hy+th-1,1,1,'rgba(244,244,232,.42)');
    px(hx+(dir?tw:-1),hy+th-3,1,1,'rgba(244,244,232,.24)');
  }

  // --- plus aucune coiffe : rien ne doit couvrir les oreilles ---

  // --- ce qu'il porte ---
  if(P.porte===1&&h>=10){                                       // panier
    const bxp=dir?x+cw+1:x-3;
    px(bxp,tor-3,3,3,'#a8823f'); px(bxp,tor-3,3,1,'#c49a52');
    px(bxp+1,tor-3,1,3,'#8a6832'); px(bxp,tor-4,3,1,'#6f5426');
  } else if(P.porte===2){                                       // bâton
    px(dir?x+cw+1:x-2,corpsY-2,1,h-(corpsY-y)+2,'#6b5236');
    px(dir?x+cw+1:x-2,corpsY-2,1,1,'#8a6c48');
  } else if(P.porte===3&&h>=10){                                // ballot sur l'épaule
    px(dir?x-2:x+cw,corpsY,3,3,'#b6a98c');
    px(dir?x-2:x+cw,corpsY,3,1,'#cfc2a4');
    px(dir?x-1:x+cw+1,corpsY-1,1,1,'#8a7f68');
  } else if(P.porte===4&&h>=11){                                // cruche
    const jx=dir?x+cw+1:x-3;
    px(jx,tor-3,2,3,'#9a6a4a'); px(jx,tor-4,2,1,'#7d5238'); px(jx,tor-3,1,3,'#b07f5c');
  }
}

/* ==================================================================
   8. MONDE : dimensions, terrain, zones
   ================================================================== */
const cv=document.getElementById('village-canvas');
const g=cv.getContext('2d',{alpha:false});
g.imageSmoothingEnabled=false;

let W=640,H=300,ECHELLE=3;
let HOR=120, RIVER=266;
let PONT=[0,0];                               // emprise du pont : on la laisse dégagée
const NR=4;                                   // rangées
let SOL=[];                                   // Int16Array par rangée
let ESC=[0,0,0];                              // x des trois escaliers de terrasse
let ZONE={bat:[0,0],ville:[0,0],foret:[0,0]};

let fondCan=null, cielCan=null, couches=[], quaiCan=null;
/* Deux calques dérivés, reconstruits seulement quand leur source change :
   · bordCan — le liseré de silhouette tourné vers le soleil, qui s'allume
     à l'aube et au couchant. Obtenu en soustrayant le calque de lui-même
     décalé d'un pixel : il ne reste que l'arête.
   · refletCan — tout ce qui borde l'eau, retourné et bleui, que la boucle
     redessine en tranches ondulantes par-dessus la nappe. */
let bordCan=[], bordSens=1, bordCol='', bordSale=true;
let refletCan=null, refletSale=true;

/* 20 images à 14 i/s : en dessous, l'œil voit les vaguelettes SAUTER d'un
   pas à l'autre au lieu de glisser — c'était le « ramage » de l'eau. Le
   surcoût est en mémoire (20 bandes de W x hauteur d'eau), pas en calcul :
   une frame reste un seul drawImage. */
let eauFrames=[], NEAU=34;
/* Cadences. La rivière tournait à 14 images/s sur un cycle de 20 poses,
   soit une vaguelette et demie par seconde : un torrent, pas un fleuve.
   Les roseaux, eux, passaient 8 poses en moins d'une seconde. On ralentit
   les deux sans toucher au nombre de poses : la glisse reste la même, seul
   le débit change. */
/* Ralentir en gardant huit poses faisait « ramer » la nappe : à quatre pas
   par seconde, l'œil compte les images. La vitesse d'une animation cyclique
   est le rapport POSES / CADENCE — on augmente donc les deux ensemble. La
   rivière garde son cycle de trois secondes mais le parcourt en trente-quatre
   pas au lieu de vingt, à douze images par seconde : même lenteur, glisse
   continue. Les roseaux passent de huit poses à seize. */
const EAU_IPS=12, ROS_IPS=8, NROS=16;

function majBords(sens,col){
  for(let r=0;r<NR;r++){
    const b=bordCan[r].getContext('2d');
    b.imageSmoothingEnabled=false;
    b.globalCompositeOperation='source-over'; b.globalAlpha=1;
    b.clearRect(0,0,W,H);
    b.drawImage(couches[r],0,0);
    b.globalCompositeOperation='destination-out';
    b.drawImage(couches[r],-sens,1);      // on retire tout sauf l'arête tournée vers l'astre
    b.globalCompositeOperation='source-in';
    b.fillStyle=col; b.fillRect(0,0,W,H);
    b.globalCompositeOperation='source-over';
  }
  bordSens=sens; bordCol=col; bordSale=false;
}
/* La nappe ne fait qu'une fraction de la hauteur d'un édifice : un miroir
   à l'échelle 1 n'y montrerait que les fondations. On prend donc une bande
   source 2,4 fois plus haute et on l'écrase verticalement — c'est le
   compromis classique du pixel art, la silhouette reste lisible. */
function majReflet(){
  const hh=H-RIVER, src=Math.min(RIVER,Math.round(hh*2.4));
  const rc=refletCan.getContext('2d');
  rc.imageSmoothingEnabled=false;
  rc.setTransform(1,0,0,1,0,0);
  rc.globalCompositeOperation='source-over'; rc.globalAlpha=1;
  rc.clearRect(0,0,W,hh);
  rc.setTransform(1,0,0,-hh/src,0,0);
  for(const s of [couches[0],couches[1],couches[2],quaiCan,couches[3]])
    rc.drawImage(s,0,RIVER-src,W,src,0,-src,W,src);
  rc.setTransform(1,0,0,1,0,0);
  rc.globalCompositeOperation='source-atop';
  rc.fillStyle='rgba(34,78,112,.46)'; rc.fillRect(0,0,W,hh);
  rc.globalCompositeOperation='source-over';
  refletSale=false;
}

function calculerTaille(){
  const vw=Math.max(320,window.innerWidth), vh=Math.max(240,window.innerHeight);
  /* On cherche l'échelle ENTIÈRE la plus grande dont la résolution interne
     reste raisonnable. La grille de pixels est alors parfaite et la fenêtre
     est remplie, à moins de `s` pixels près (invisibles sur fond sombre).
     On dérive W et H de la fenêtre, jamais l'inverse : pas de débordement. */
  /* GRAIN. À l'échelle 1 sur un écran large, un pixel d'art valait un pixel
     d'écran : le grain disparaissait et le dessin cessait de se lire comme
     du pixel art. À l'échelle 2, la scène tombait sous 800 de large et les
     bâtiments perdaient leurs détails. On vise donc une largeur interne
     d'environ 1120 et on arrondit l'échelle au DEMI : sur un écran à deux
     pixels physiques par pixel CSS — le cas courant — une échelle de 1,5
     donne exactement trois sous-pixels par pixel d'art, donc une grille
     parfaitement régulière. */
  /* VERSION FINE. La cible passe de 1120 à 1560 pixels internes : à taille
     d'écran égale, chaque édifice reçoit un peu plus du double de pixels —
     tout le procédural suit, puisque chaque cote passe par sc()/ech(). Les
     détails à un pixel (joints, moustaches, braises) deviennent, eux,
     réellement FINS : c'est là que se gagne le grain. Le plafond monte à
     1920x1080 pour les grands écrans ; le garde-fou de qualité existant
     continue d'alléger le rendu si la machine ne suit pas. */
  const CIBLE=1560;
  let s=Math.max(1, Math.round((vw/CIBLE)*2)/2);
  let w=Math.floor(vw/s), h=Math.floor(vh/s);
  while((w>1920||h>1080) && s<12){ s+=0.5; w=Math.floor(vw/s); h=Math.floor(vh/s); }
  while(w<520 && h<430 && s>1){ s-=0.5; w=Math.floor(vw/s); h=Math.floor(vh/s); }
  ECHELLE=s; W=w; H=h;
  NEAU = W>1500?24:34;                     // grande nappe : un peu moins de poses, même glisse
  /* Les édifices suivent la scène — mais sur ses DEUX dimensions. Ne suivre
     que la hauteur donnait, sur une fenêtre étroite et haute, un château de
     122 px dans une zone constructible de 303 px : plus rien ne tenait. */
  ECHM=clamp(Math.min(H/340,W/480),0.78,4.2);
  cv.width=W; cv.height=H;
  cv.style.width=(W*s)+'px'; cv.style.height=(H*s)+'px';
  g.imageSmoothingEnabled=false;
  // repères verticaux
  HOR   = Math.round(H*0.365);
  SOL   = [];
  const baseY=[0.465,0.600,0.740,0.856].map(f=>Math.round(H*f));
  RIVER = Math.round(H*0.866);
  for(let r=0;r<NR;r++){
    const a=new Int16Array(W);
    for(let x=0;x<W;x++) a[x]=baseY[r]+Math.round(Math.sin(x*0.011+r*2.1)*(r<2?2:1.4));
    SOL.push(a);
  }
  // zones latérales
  const wb=Math.round(W*R(0.095,0.125)), wf=Math.round(W*R(0.14,0.175));
  ZONE.bat  =[0,wb];
  ZONE.foret=[W-wf,W];
  ZONE.ville=[wb-Math.round(W*0.02), W-wf+Math.round(W*0.02)];
}
const solY=(r,x)=>SOL[r][clamp(x|0,0,W-1)];

function crete(){
  const a=[R(0,99),R(0,99),R(0,99)], f=[R(.005,.011),R(.017,.033),R(.045,.08)];
  return x=>(Math.sin(x*f[0]+a[0])+Math.sin(x*f[1]+a[1])*.42+Math.sin(x*f[2]+a[2])*.17)/1.59;
}

/* Petit arbre de colline (5-14 px). À cette taille un tronc dessiné mange
   l'arbre : on n'en garde qu'un ou deux pixels. Le reste se joue sur la
   silhouette — pointue pour un conifère, bombée et irrégulière pour un
   feuillu — et sur trois tons seulement, du côté éclairé vers l'ombre. */
function petitArbre(c,x,y,h,cols,conifere){
  if(conifere){
    const w=Math.max(2,Math.round(h*0.52));
    fr(c,x,y-1,1,2,cols[3]);
    for(let j=0;j<h;j++){
      const t=j/h;
      let wj=Math.max(1,Math.round(w*(0.12+0.98*t)));
      if(j>1&&rnd()<0.30) wj=Math.max(1,wj-1);         // silhouette ébréchée
      const x0=x-(wj>>1);
      fr(c,x0,y-h+j,wj,1, (j%3===2)?cols[3]:cols[1]);
      fr(c,x0,y-h+j,Math.max(1,wj>>1),1, t<0.45?cols[2]:cols[0]);
    }
    fr(c,x,y-h,1,1,cols[2]);
  } else {
    const w=Math.max(3,Math.round(h*0.85)), hc=Math.max(2,Math.round(h*0.72));
    fr(c,x,y-Math.max(1,h-hc),1,Math.max(1,h-hc)+1,cols[3]);   // tronc réduit à un trait
    for(let j=0;j<hc;j++){
      const q=1-Math.pow((j-hc*0.45)/(hc*0.62),2);
      if(q<=0) continue;
      let wj=Math.max(1,Math.round(w*0.5*Math.sqrt(q)));
      if(rnd()<0.28) wj=Math.max(1,wj-1);
      fr(c,x-wj,y-h+j,wj*2+1,1,cols[1]);
      fr(c,x-wj,y-h+j,Math.max(1,wj),1, j<hc*0.42?cols[2]:cols[0]);
      if(rnd()<0.30) fr(c,x+RI(-wj,wj),y-h+j,1,1,cols[3]);
    }
    fr(c,x-1,y-h+1,2,1,cols[2]);
  }
}

/* --- tramage ordonné 4x4 : un dégradé de ciel pixel art se fabrique en
       alternant DEUX teintes selon une matrice, jamais en interpolant --- */
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function degradeCiel(c,pal,haut){
  // on double la rampe : deux teintes voisines proches -> le tramage se
  // devine au lieu de grésiller
  const fine=[];
  for(let i=0;i<pal.length-1;i++){ fine.push(pal[i]); fine.push(mix(pal[i],pal[i+1],0.5)); }
  fine.push(pal[pal.length-1]);
  const cols=fine.map(h2r), n=cols.length;
  const img=c.createImageData(W,haut), d=img.data;
  for(let y=0;y<haut;y++){
    const p=Math.pow(clamp(y/(haut-1),0,1),0.80)*(n-1);
    const i=Math.min(n-2,p|0), f=p-i;
    const A=cols[i], B=cols[i+1];
    for(let x=0;x<W;x++){
      const C = f>((BAYER[((y&3)<<2)|(x&3)]+0.5)/16) ? B : A;
      const o=((y*W)+x)<<2;
      d[o]=C[0]; d[o+1]=C[1]; d[o+2]=C[2]; d[o+3]=255;
    }
  }
  c.putImageData(img,0,0);
}

/* ------------------------------------------------------------------
   MASSIFS — crête ridged-fBm + lumière de pente.
   Une chaîne de montagnes n'est pas une rangée de cônes : c'est une
   LIGNE DE CRÊTE continue. L'altitude est un bruit fractal « ridged »
   (1-|2n-1|) limité à DEUX octaves lentes : quelques grandes cimes
   simples et lisibles, jamais de dentelle. Le volume vient de la PENTE,
   jamais d'un trait : la dérivée de la crête donne un coefficient de
   lumière par colonne, tramé sur une rampe de cinq paliers entre l'ombre
   et le soleil. L'œil lit le relief, il n'existe aucune arête dessinée.
   Le détail est un piège : plus la chaîne est loin, moins on mouchète et
   plus on noie dans le haze.
   ------------------------------------------------------------------ */
/* Tuile de bruit lisse 128x128, calculée une fois par cité. Elle remplace
   partout les trames ordonnées à gros grain, qui produisaient sur les
   versants un damier régulier parfaitement visible : une matière minérale
   ne se tramé pas en quinconce, elle se marbre. */
let NTILE=null;
function noiseTile(){
  const S=128, lat=16, a=new Float32Array(S*S), L=new Float32Array((lat+1)*(lat+1));
  for(let i=0;i<L.length;i++) L[i]=rnd();
  for(let j=0;j<=lat;j++) L[j*(lat+1)+lat]=L[j*(lat+1)];
  for(let i=0;i<=lat;i++) L[lat*(lat+1)+i]=L[i];
  const at=(i,j)=>L[j*(lat+1)+i];
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const fx=x/S*lat, fy=y/S*lat;
    const i=fx|0, j=fy|0, u=fx-i, v=fy-j;
    const su=u*u*(3-2*u), sv=v*v*(3-2*v);
    a[y*S+x]=(at(i,j)*(1-su)+at(i+1,j)*su)*(1-sv)+(at(i,j+1)*(1-su)+at(i+1,j+1)*su)*sv;
  }
  return a;
}
const NT=(x,y)=>NTILE[(((y|0)&127)<<7)|((x|0)&127)];
const NT2=(x,y)=>NT(x,y)*0.62+NT(x*3+41,y*3+17)*0.38;

let SKY=null;                                   // ligne de crête la plus haute, par colonne
let brumesMonts=[];                             // nappes de brume dérivant sur les chaînes
function vhash(i,sd){ const t=Math.sin(i*127.1+sd*311.7)*43758.5453; return t-Math.floor(t); }
function vnoise(x,sd){ const i=Math.floor(x), f=x-i, u=f*f*(3-2*f);
  return vhash(i,sd)+(vhash(i+1,sd)-vhash(i,sd))*u; }
function massif(c,o){
  const T=o.t, bas=o.bas, ns=(o.neige!=null)?o.neige:-1e9, det=o.det||0;
  const sd=R(1,97), ph=R(0,6.28), amp=R(o.h[0],o.h[1]);
  const F=[R(.0022,.0034),R(.0060,.0085)], WT=[1,.16];
  const alt=new Int16Array(W);
  for(let x=0;x<W;x++){
    let s=0,w=0;
    for(let k=0;k<2;k++){                                  // deux octaves très lentes :
      const n=1-Math.abs(2*vnoise(x*F[k]+sd*7.3+k*13.7, sd+k*17)-1);
      s+=WT[k]*Math.pow(n,1.25); w+=WT[k];                 // cimes rares, profils doux
    }
    const env=0.50+0.50*vnoise(x*0.0022+sd*3.1, sd+99);    // groupe les massifs
    alt[x]=Math.round(o.y-amp*(s/w)*env);
  }
  for(let p=0;p<4;p++)                                     // lisse l'arête : silhouette simple
    for(let x=1;x<W-1;x++) alt[x]=(alt[x-1]+2*alt[x]+alt[x+1])>>2;
  for(let x=0;x<W;x++) if(SKY&&alt[x]<SKY[x]) SKY[x]=alt[x];
  /* ---- ombrage de pente, cuit pixel par pixel : rampe de cinq paliers
     tramée en ordonné, mouchetage de rocher, neige qui suit la même
     lumière, scintillement épars. Aucune ligne tracée. ---- */
  let yTop=bas; for(let x=0;x<W;x++) if(alt[x]<yTop) yTop=alt[x];
  const hgtM=bas-yTop;
  if(hgtM>2){
    const sc0=scratch(0,W,hgtM), g0=sc0.g;
    const img=g0.createImageData(W,hgtM), d=img.data;
    const CRE=h2r(T[2]), CREX=h2r(T[3]);
    const rampS=[T[1],mix(T[1],T[0],.35),mix(T[1],T[0],.65),mix(T[0],T[2],.30),T[0]].map(h2r);
    const rampN=[PAL.neigeO,mix(PAL.neigeO,PAL.neige,.5),PAL.neige,
                 mix(PAL.neige,PAL.neigeB,.6),PAL.neigeB].map(h2r);
    const dk=a=>a.map((v,i)=>Math.round(v+(CREX[i]-v)*0.35));
    const ltc=a=>a.map((v,i)=>Math.round(v+(CRE[i]-v)*0.40));
    const rampSd=rampS.map(dk), rampSl=rampS.map(ltc);
    const mot=det?0.26:0.12, gain=det?0.85:0.55;
    const sn=new Int16Array(W), lvl=new Float32Array(W);
    if(ns>-1e8) for(let x=0;x<W;x++)
      sn[x]=Math.round(ns+Math.sin(x*0.11+ph)*2+(vnoise(x*0.25,sd+5)-0.5)*5);
    for(let x=0;x<W;x++){
      const dd=alt[Math.min(W-1,x+3)]-alt[Math.max(0,x-3)];
      lvl[x]=clamp(2-dd*gain,0,3.999);                    // 0 = ombre … 4 = soleil
    }
    for(let x=0;x<W;x++)                                    // dérive lente : les paliers
      lvl[x]=clamp(lvl[x]+(vnoise(x*0.012,sd+77)-0.5)*0.9,0,3.999); // serpentent, jamais damier
    for(let x=0;x<W;x++){
      const y0=alt[x]; if(y0>=bas) continue;
      const L=lvl[x], i0=L|0, fL=L-i0;
      const crest=y0<=alt[Math.max(0,x-1)]&&y0<=alt[Math.min(W-1,x+1)];
      const snowLine=sn[x], hasSnow=snowLine>y0+1;
      for(let y=y0;y<bas;y++){
        const yr=y-yTop, bi4=((y&3)<<2)|(x&3);
        const seuil=(BAYER[bi4]/16)*0.55+NT(x+y*2,y)*0.45;
        const i1=fL>seuil?i0+1:i0;
        const bm=NT2(x*0.75+y*0.35, y*0.85-x*0.15);   // marbrure de roche, jamais de trame
        let C;
        if(hasSnow && y<snowLine-2+(BAYER[bi4]>>2)){
          C=rampN[i1];
          if(bm<mot) C=rampN[Math.max(0,i1-1)];
          else if(i1>=3&&((x*31+y*17+((x>>4)*53))&255)===0) C=rampN[4];  // scintillement
        } else {
          C=rampS[i1];
          if(bm<mot) C=rampSd[i1];
          else if(bm>1-mot*0.5) C=rampSl[i1];
        }
        if(y===y0) C = i1>=2?CRE:CREX;
        else if(crest&&y===y0+1&&i1>=2) C=CRE;             // lèvre de crête, côté soleil
        const oo=(yr*W+x)<<2;
        d[oo]=C[0]; d[oo+1]=C[1]; d[oo+2]=C[2]; d[oo+3]=255;
      }
    }
    g0.putImageData(img,0,0);
    c.drawImage(sc0.can,0,0,W,hgtM,0,yTop,W,hgtM);
  }
  // ---- coulées de neige dans les couloirs, par-dessus le manteau cuit ----
  if(ns>-1e8) for(let x=0;x<W;x++){
    const y=alt[x]; if(y>=bas||y>=ns) continue;
    const lit=lvl[x]>=2;
    let prof=Math.round((ns-y)*0.72+Math.sin(x*0.13+ph)*2.0+Math.sin(x*0.33)*1.2);
    prof=clamp(prof,0,Math.round((bas-y)*0.7));
    if(prof<2) continue;
    if(Math.sin(x*0.19+ph*2)>0.62) fr(c,x,y+prof,1,RI(2,6), lit?PAL.neige:PAL.neigeO);
  }
  /* ---- perspective aérienne : la brume monte du pied vers la crête ---- */
  const hzH=Math.max(8,Math.round((o.h[1])*0.85)), NB=8;
  c.fillStyle=o.hz||'#a8c2d8';
  for(let k=0;k<NB;k++){
    const y0=bas-Math.round(hzH*(NB-k)/NB), y1=bas-Math.round(hzH*(NB-k-1)/NB);
    c.globalAlpha=(o.hzA||0.5)*Math.pow((k+1)/NB,1.5);
    for(let x=0;x<W;x++){ const a=Math.max(alt[x],y0); if(a<y1) c.fillRect(x,a,1,y1-a); }
  }
  if(o.hzU>0){
    c.globalAlpha=o.hzU;
    for(let x=0;x<W;x++){ const a=alt[x]; if(a<bas) c.fillRect(x,a,1,bas-a); }
  }
  c.globalAlpha=1;
  return alt;
}

/* ------------------------------------------------------------------
   LISIÈRE : une forêt vue de loin n'est pas une file d'arbres, c'est une
   MASSE dont seule la ligne de cime se lit. On empile donc des bosses
   pour fabriquer cette ligne, on remplit dessous, et on ne pose des
   silhouettes individuelles que sur le bord supérieur.
   ------------------------------------------------------------------ */
function lisiere(c,x0,x1,yFn,cols,hMax,dens){
  const n=x1-x0; if(n<3) return;
  const cime=new Int16Array(n);
  for(let k=0,nk=Math.max(2,Math.round(n*dens));k<nk;k++){
    const cx=RI(0,n-1), rx=RI(3,10), hh=RI(Math.round(hMax*0.40),hMax);
    for(let i=-rx;i<=rx;i++){
      const j=cx+i; if(j<0||j>=n) continue;
      const v=Math.round(hh*Math.pow(1-Math.abs(i)/(rx+1),0.65));
      if(v>cime[j]) cime[j]=v;
    }
  }
  for(let i=0;i<n;i++){
    const h=cime[i]; if(h<2) continue;
    const x=x0+i, base=yFn(x)+2, top=base-h;
    fr(c,x,top,1,base-top,cols[1]);
    fr(c,x,top,1,Math.max(1,Math.round(h*0.38)),cols[0]);
    fr(c,x,top,1,1,cols[2]);
    if(rnd()<0.22) fr(c,x,top+RI(1,Math.max(2,h-1)),1,RI(1,2),cols[3]);
    if(rnd()<0.10) fr(c,x,top+RI(1,Math.max(2,h>>1)),1,1,clair(cols[2],.14));
  }
  // quelques cimes pointues qui percent la ligne : c'est ce qui dit « sapins »
  for(let k=0,nk=Math.max(1,Math.round(n*dens*0.30));k<nk;k++){
    const i=RI(1,n-2), x=x0+i;
    if(cime[i]<3) continue;
    const base=yFn(x)+2-cime[i]+2, hh=RI(2,5);
    for(let j=0;j<hh;j++){
      const wj=(j<hh-1)?1:3;
      fr(c,x-(wj>>1),base-hh+j,wj,1, j<2?cols[2]:cols[0]);
    }
  }
}

  /* ---- nappe de brume dérivante : un flocon horizontal tramé sur tous
     ses bords, cuit une fois ; la boucle ne fait que le translater au pied
     des chaînes — c'est la seule profondeur du décor qui bouge. ---- */
function cuireBrumeMont(){
  const w=Math.round(W*R(0.30,0.55)), h=RI(7,13);
  const sp=sprite(w,h), c=sp.g;
  c.fillStyle='#e2ebf4';
  for(let x=0;x<w;x++){
    const t=Math.sin(Math.PI*x/w);
    const hh=Math.max(2,Math.round(h*(0.4+0.6*t)));
    for(let j=0;j<hh;j++){
      const a=t*(1-j/hh)*0.9;
      if(BAYER[((j&3)<<2)|(x&3)]/16<a) c.fillRect(x,h-hh+j,1,1);
    }
  }
  return sp.can;
}

/* Le fond se peint sur DEUX calques : le ciel seul, puis la terre (dont
   tout ce qui est au-dessus des crêtes reste transparent). La boucle peut
   alors glisser le soleil, la lune et les étoiles ENTRE les deux — les
   astres se couchent derrière les montagnes au lieu de leur passer dessus. */
function genererCielCan(){
  const sp=sprite(W,HOR+18), c=sp.g;
  degradeCiel(c,PAL.ciel,HOR+18);
  for(let k=0;k<RI(7,12);k++){                       // cirrus effilés
    const y=RI(Math.round(H*0.02),Math.round(HOR*0.62));
    const x0=RI(-40,W-20), lw=RI(Math.round(W*0.05),Math.round(W*0.22));
    const pale=mix(PAL.ciel[clamp((y/HOR*9)|0,0,8)],'#ffffff',R(0.22,0.44));
    for(let i=0;i<lw;i++){
      const t=i/lw, ep=Math.sin(t*Math.PI)*(0.5+0.5*Math.sin(i*0.11+k*2.7));
      if(rnd()>0.16+0.62*ep) continue;
      fr(c,x0+i,y+Math.round(Math.sin(i*0.05+k)*1.8),1,1,pale);
    }
  }
  for(let j=0;j<Math.round(H*0.12);j++){             // voile chaud au ras de l'horizon
    c.globalAlpha=0.34*Math.pow(j/(H*0.12),2.0);
    fr(c,0,HOR-Math.round(H*0.12)+j,W,1,'#f2e8d4');
  }
  c.globalAlpha=1;
  return sp.can;
}

function genererFond(){
  NTILE=noiseTile();
  const sp=sprite(W,H); const c=sp.g;
  fr(c,0,HOR+4,W,H-HOR-4,PAL.collines[2]);

  /* ---- trois chaînes, de la plus lointaine à la plus proche.
     Plus c'est loin, moins on dessine et plus on noie : le lointain se
     rend par la brume, jamais par le détail. ---- */
  SKY=new Int16Array(W).fill(H);
  massif(c,{y:HOR+Math.round(H*0.018), h:[H*0.110,H*0.180], p:[0.55,0.95], n:3, det:0,
            bas:HOR+Math.round(H*0.040), t:['#c3d0e3','#b3c2da','#d6e0ee','#a6b6d1'],
            neige:HOR-Math.round(H*0.230), hz:'#dde7f1', hzA:0.70, hzU:0.26});
  massif(c,{y:HOR+Math.round(H*0.030), h:[H*0.100,H*0.165], p:[0.44,0.80], n:4, det:0,
            bas:HOR+Math.round(H*0.048), t:PAL.montA, neige:HOR-Math.round(H*0.185),
            hz:'#cfdeeb', hzA:0.50, hzU:0.12});
  massif(c,{y:HOR+Math.round(H*0.052), h:[H*0.095,H*0.158], p:[0.50,0.92], n:5, det:1,
            bas:HOR+Math.round(H*0.072), t:PAL.montB, neige:HOR-Math.round(H*0.108),
            hz:'#bcd0e2', hzA:0.36, hzU:0.05});
  massif(c,{y:HOR+Math.round(H*0.076), h:[H*0.070,H*0.126], p:[0.40,0.76], n:5, det:1,
            bas:HOR+Math.round(H*0.096), t:PAL.montC, hz:'#a8bfd2', hzA:0.24, hzU:0.0});
  const altC=massif(c,{y:HOR+Math.round(H*0.100), h:[H*0.042,H*0.082], p:[0.26,0.50], n:5, det:0,
            bas:HOR+Math.round(H*0.120), t:PAL.montD, hz:'#9db4c8', hzA:0.16, hzU:0});
  // sapinières accrochées aux contreforts : une masse, pas des triangles
  {
    const vL=[mix('#3f6a48','#a4bcd0',.52),mix('#2e5038','#a4bcd0',.52),
              mix('#548459','#a4bcd0',.52),mix('#23402c','#a4bcd0',.52)];
    lisiere(c,0,W,x=>altC[clamp(x,0,W-1)]+Math.round(H*0.020),vL,Math.max(5,Math.round(H*0.030)),0.10);
  }
  // ---- brumes de pied de chaîne, trois nappes à des profondeurs diverses ----
  brumesMonts=[];
  for(let k=0;k<3;k++){
    const can=cuireBrumeMont();
    brumesMonts.push({can, x:R(-W*0.2,W), y:HOR+Math.round(H*R(0.030,0.105)),
                      v:R(1.2,3.6)*(chance(.5)?1:-1)});
  }

  /* ---- COLLINES : trois plans de terroir.
     L'ancienne version peignait deux silhouettes vertes remplies à plat :
     des bosses de gazon, sans relief ni usage du sol. Ici le volume vient
     de la PENTE (dérivée de la ligne de crête -> palier de lumière), et
     l'identité vient du PARCELLAIRE : bandes de culture séparées par des
     haies vives, qui épousent la courbure du coteau. C'est le damier des
     champs qui dit « campagne habitée », pas les arbres. ---- */
  const altH=[];
  {
    const brumeC=(t,a)=>mix(t,'#a9c2d6',a);
    const defs=[
      {f:crete(), dy:0.086, amp:0.060, haze:0.46, prof:11, cult:0.52,
       sol:['#7d9a63','#688552','#546e43','#3f5734']},
      {f:crete(), dy:0.048, amp:0.038, haze:0.27, prof:8,  cult:0.44,
       sol:['#7ea165','#6a8b52','#557440','#405c31']},
      {f:crete(), dy:0.017, amp:0.021, haze:0.11, prof:6,  cult:0.30,
       sol:['#82a765','#6d9052','#587840','#435f31']}
    ];
    const TEINTES=['#b9a066','#a48b4c','#8a8752','#76905a','#98784c'];
    for(const P of defs){
      const RA=P.sol.map(t=>brumeC(t,P.haze)).reverse();   // 0 = ombre, 3 = plein soleil
      const alt=new Int16Array(W);
      for(let x=0;x<W;x++)
        alt[x]=Math.round(SOL[0][x]-Math.round(H*P.dy)-P.f(x)*Math.round(H*P.amp));
      for(let k=0;k<2;k++) for(let x=1;x<W-1;x++) alt[x]=(alt[x-1]+2*alt[x]+alt[x+1])>>2;
      altH.push(alt);

      /* parcellaire : suite de bandes de largeur variable ; 0 = pâture,
         sinon indice de teinte cultivée. Les bornes portent une haie. */
      const parc=new Uint8Array(W), haie=new Uint8Array(W);
      for(let x=0;x<W;){
        const l=RI(Math.round(W*0.018),Math.round(W*0.075));
        const t=chance(P.cult)?RI(1,TEINTES.length):0;
        for(let i=0;i<l&&x<W;i++,x++) parc[x]=t;
        if(x<W) haie[x]=1;
      }

      for(let x=0;x<W;x++){
        const y=alt[x], bas=SOL[0][x]+P.prof;
        if(y>=bas) continue;
        const pente=(alt[Math.min(W-1,x+4)]-alt[Math.max(0,x-4)])/8;
        let lv=clamp(2.1-pente*2.9,0,3.99);
        lv=clamp(lv+(NT(x*0.7,x*0.3)-0.5)*0.8,0,3.99);
        const i0=lv|0, fL=lv-i0;
        const cu=parc[x]?TEINTES[parc[x]-1]:null;
        const ht=bas-y;
        for(let yy=y;yy<bas;yy++){
          const bi=BAYER[((yy&3)<<2)|(x&3)]/16;
          const i1=Math.min(3,fL>(bi*0.5+NT(x,yy)*0.5)?i0+1:i0);
          let col=RA[i1];
          if(cu){
            const prof=(yy-y)/ht;
            col=mix(col,brumeC(cu,P.haze),0.44-0.18*prof);
            if(((yy-y)+((x*0.35)|0))%4===0) col=ombre(col,.13);   // sillons
          }
          if(NT2(x*1.4,yy*1.4)<0.16) col=ombre(col,.10);
          else if(NT2(x*1.4+60,yy*1.4)>0.86) col=clair(col,.08);
          fr(c,x,yy,1,1,col);
        }
        // crête éclairée / rebord à l'ombre
        fr(c,x,y,1,1, pente>0.18?ombre(RA[3],.24):clair(RA[3],.07));
        if(haie[x]||haie[Math.max(0,x-1)]){                       // haie vive sur la borne
          const hh=Math.min(ht,Math.max(2,Math.round(H*0.008)));
          for(let yy=y;yy<y+hh;yy++)
            fr(c,x,yy,1,1, NT(x*2,yy*2)>0.45?brumeC('#3f5f33',P.haze):brumeC('#33502b',P.haze));
        }
        if(rnd()<.05) fr(c,x,y+RI(2,Math.max(3,ht-2)),1,RI(1,2),brumeC('#4a6a3c',P.haze));
      }
      // quelques bosquets ponctuels le long des haies
      for(let k=0,n=Math.round(W*0.02);k<n;k++){
        const x=RI(3,W-4);
        if(!haie[x]&&!haie[Math.max(0,x-2)]) continue;
        petitArbre(c,x,alt[x]+RI(2,Math.max(3,Math.round(H*0.02))),RI(4,9),
          [brumeC('#4a7a52',P.haze),brumeC('#3a6142',P.haze),
           brumeC('#5d9163',P.haze),brumeC('#2b4a34',P.haze)],chance(.5));
      }
    }
  }
  const colH =x=>altH[0][clamp(x|0,0,W-1)];
  const colH2=x=>altH[1][clamp(x|0,0,W-1)];
  const brumeH=t=>mix(t,'#9ab6cc',0.42);
  /* ---- bosquets sur les collines : petits, mais dessinés — c'est la
     première échelle où l'œil cherche des arbres reconnaissables ---- */
  {
    const vA=[brumeH('#4a7a52'),brumeH('#3a6142'),brumeH('#5d9163'),brumeH('#2b4a34')];
    const vB=[brumeH('#6b8f45'),brumeH('#557335'),brumeH('#82a955'),brumeH('#3f5726')];
    for(let k=0,n=Math.round(W*0.055);k<n;k++){
      const x=RI(4,W-5), y=colH(x)+RI(1,Math.round(H*0.045));
      petitArbre(c,x,y,RI(5,11),chance(.55)?vA:vB,chance(.45));
    }
    for(let k=0,n=Math.round(W*0.030);k<n;k++){        // second plan, plus grands
      const x=RI(4,W-5), y=colH2(x)+RI(1,Math.round(H*0.020));
      petitArbre(c,x,y,RI(7,14),chance(.5)?vA:vB,chance(.45));
    }
    // la forêt de droite monte sur la colline en une masse continue
    const a=Math.max(0,ZONE.foret[0]-Math.round(W*0.08));
    lisiere(c,a,W,x=>colH(x)+Math.round(H*0.012),vA,Math.max(6,Math.round(H*0.042)),0.13);
  }
  // ---- hameaux lointains sur les collines : remplit la bande verte du haut ----
  {
    for(let k=0;k<RI(14,24);k++){
      const x=RI(6,W-10);
      const yh=colH(x)+RI(3,Math.max(4,Math.round(H*0.045)));
      const bw2=RI(4,9), bh2=RI(3,6), th2=RI(3,6);
      const murC=brumeH(chance(.5)?'#cbbca0':'#b3a48b');
      const toitC=brumeH(pick(['#a84f30','#8a4930','#4e5d74','#96612f']));
      fr(c,x,yh-bh2,bw2,bh2,murC);
      fr(c,x,yh-bh2,1,bh2,brumeH('#8f8270'));
      for(let j=0;j<th2;j++){
        const wj=Math.max(2,Math.round((bw2+2)*(j+1)/th2));
        fr(c,x+((bw2-wj)>>1),yh-bh2-th2+j,wj,1,j===0?brumeH('#c47a55'):toitC);
      }
      if(chance(.3)) fr(c,x+bw2-2,yh-bh2-th2-RI(2,4),1,RI(2,4),brumeH('#6b5c44'));
      if(chance(.25)) fr(c,x+1,yh-1,1,1,brumeH('#3f4a35'));
      // haies et arbustes autour
      for(let i=0;i<RI(1,4);i++)
        fr(c,x+RI(-8,bw2+8),yh-RI(1,3),RI(1,3),RI(2,4),brumeH('#4c6a45'));
    }
    // clocher isolé au loin
    {
      const x=RI(Math.round(W*0.2),Math.round(W*0.8));
      const yh=colH(x)+RI(2,6);
      fr(c,x,yh-14,4,14,brumeH('#c2b399'));
      for(let j=0;j<7;j++){const wj=Math.max(1,Math.round(6*(j+1)/7));
        fr(c,x+2-(wj>>1),yh-14-7+j,wj,1,brumeH('#4e5d74'));}
      fr(c,x+2,yh-24,1,3,brumeH('#d0a851'));
      fr(c,x-7,yh-7,7,7,brumeH('#c2b399'));
      for(let j=0;j<4;j++){const wj=Math.max(2,Math.round(9*(j+1)/4));
        fr(c,x-3-(wj>>1),yh-11+j,wj,1,brumeH('#8a4930'));}
    }
  }
  /* ---- terrasses herbeuses ----------------------------------------
     Une terrasse peinte d'une seule couleur est une bande morte. On la
     construit donc en 16 nuances (lumière au sommet du bombement, ombre
     au pied), on fait ONDULER l'index de nuance avec deux sinusoïdes
     décalées — c'est ce qui donne le relief des prés — puis on sème
     touffes, fleurs, cailloux et plaques de terre par-dessus.        */
  const NN=16, rampe=[];
  for(let r=0;r<NR;r++){
    const hb=PAL.herbe[r]; rampe[r]=[];
    for(let i=0;i<NN;i++){
      const t=i/(NN-1);
      rampe[r][i]= t<0.18 ? mix(hb[0],hb[1],t/0.18) : mix(hb[1],hb[2],(t-0.18)/0.82*0.72);
    }
  }
  const FLEURS=['#e8e2cc','#f0d24a','#d8607a','#b98ad4','#e88a3c','#e6ecf0'];
  for(let x=0;x<W;x++){
    const ond=Math.sin(x*0.0185)*1.9+Math.sin(x*0.052+1.7)*1.1+Math.sin(x*0.121+3.1)*0.55;
    for(let r=0;r<NR;r++){
      const a=SOL[r][x], b=(r<NR-1)?SOL[r+1][x]:RIVER;
      const hb=PAL.herbe[r], ht=Math.max(1,b-a);
      const dec=Math.round(ond*(r<2?1:0.6));
      for(let i=0;i<NN;i++){
        const y0=a+Math.round(ht*i/NN), y1=a+Math.round(ht*(i+1)/NN);
        if(y1>y0) fr(c,x,y0,1,y1-y0,rampe[r][clamp(i+dec,0,NN-1)]);
      }
      // lèvre de la terrasse : 2 px de lumière, puis l'ombre portée du replat
      fr(c,x,a,1,2,clair(hb[0],.10));
      fr(c,x,a+2,1,3,ombre(hb[2],.30));
      fr(c,x,a+5,1,2,ombre(hb[2],.14));
      // contact avec la terrasse suivante : occlusion
      fr(c,x,b-3,1,3,ombre(hb[2],.24));
      const sem=r<2?1:0.6;
      // brins : deux tirages par colonne, c'est la densité qui fait le pré
      for(let k=0;k<2;k++){
        if(rnd()>0.34*sem) continue;
        const y=a+RI(4,Math.max(5,ht-2)), lh=RI(1,3);
        fr(c,x,y-lh,1,lh, rnd()<0.5?clair(hb[0],.07):ombre(hb[2],.14));
      }
      if(rnd()<.15*sem){                                   // touffe d'herbe en éventail
        const y=a+RI(6,Math.max(7,ht-3)), hh=RI(2,4);
        fr(c,x,y-hh,1,hh,hb[0]); fr(c,x-1,y-hh+1,1,hh-1,hb[1]); fr(c,x+1,y-hh+1,1,hh-1,hb[2]);
        fr(c,x,y,3,1,ombre(hb[2],.18));
      }
      if(rnd()<.06){                                       // trèfle / plaque plus claire
        const y=a+RI(5,Math.max(6,ht-3)), lw=RI(2,5);
        fr(c,x,y,lw,1,clair(hb[0],.12));
        if(chance(.5)) fr(c,x+1,y-1,Math.max(1,lw-2),1,clair(hb[0],.06));
      }
      if(rnd()<.055*sem){                                  // fleur isolée
        const y=a+RI(7,Math.max(8,ht-3)), f=pick(FLEURS);
        fr(c,x,y,1,2,ombre(hb[2],.15)); fr(c,x,y-1,1,1,f);
        if(chance(.45)){ fr(c,x-1,y-1,1,1,ombre(f,.22)); fr(c,x+1,y-1,1,1,ombre(f,.22)); }
        if(chance(.25)) fr(c,x,y-2,1,1,clair(f,.25));
      }
      if(rnd()<.007){                                      // caillou posé
        const y=a+RI(8,Math.max(9,ht-4));
        fr(c,x,y,3,2,'#8a8375'); fr(c,x,y,3,1,'#a49c8c'); fr(c,x,y+2,4,1,'rgba(14,18,10,.28)');
      }
      if(rnd()<.006){                                      // plaque de terre nue
        const w2=RI(3,8), y=a+RI(8,Math.max(9,ht-4));
        fr(c,x,y,w2,RI(2,3),PAL.terre[1]); fr(c,x,y,w2,1,PAL.terre[0]);
      }
    }
  }
  /* ---- LA PRAIRIE. Les massifs elliptiques faisaient des ZONES : des
     pastilles de fleurs posées sur un aplat. Une prairie n'a pas de bords —
     elle a des DENSITÉS. On sème donc colonne par colonne, partout, et
     c'est un bruit très large qui module combien de brins et de fleurs
     tombent là : des nappes fleuries qui s'évanouissent dans l'herbe rase,
     sans jamais un contour. Les espèces se mélangent : un second bruit,
     plus serré, choisit l'espèce dominante du coin, et une fleur sur
     quatre l'ignore — c'est la mauvaise graine qui fait le naturel. ---- */
  for(let r=0;r<NR-1;r++){
    const hb=PAL.herbe[r];
    const sem=r<2?1:0.62;
    for(let x=2;x<W-2;x+=1){
      const a=SOL[r][x], b=SOL[r+1][x];
      if(b-a<12) continue;
      const dens=Math.pow(Math.max(0,NT2(x*0.045+r*37,r*11)),1.6);   // la nappe
      // brins supplémentaires là où c'est dru
      if(rnd()<dens*0.9*sem){
        const y=a+RI(5,Math.max(6,(b-a)-4)), lh=RI(2,4);
        fr(c,x,y-lh,1,lh, rnd()<0.5?hb[0]:ombre(hb[2],.12));
        if(lh>2&&chance(.5)) fr(c,x+(chance(.5)?1:-1),y-lh+1,1,1,clair(hb[0],.14));
      }
      // fleurs : densité en nappe, espèce en taches floues, 1/4 de dissidentes
      if(rnd()<dens*0.30*sem){
        const y=a+RI(6,Math.max(7,(b-a)-4));
        let esp=Math.floor(NT2(x*0.11+91,r*7)*4)%4;
        if(rnd()<0.25) esp=RI(0,3);
        const f=FLEURS[(esp*2+((x/37)|0))%FLEURS.length], f2=clair(f,.30), f3=ombre(f,.24);
        const th2=RI(2,4);
        fr(c,x,y-th2,1,th2,ombre(hb[2],.26));
        if(chance(.6)) fr(c,x+(chance(.5)?1:-1),y-RI(1,th2),1,1,hb[2]);
        if(esp===0){ fr(c,x,y-th2-1,1,1,f); if(chance(.4)) fr(c,x,y-th2-2,1,1,f2); }
        else if(esp===1){ fr(c,x,y-th2-1,1,1,'#e8d44a');
          fr(c,x-1,y-th2-1,1,1,f); fr(c,x+1,y-th2-1,1,1,f);
          fr(c,x,y-th2-2,1,1,f2); fr(c,x,y-th2,1,1,f3); }
        else if(esp===2){ fr(c,x,y-th2-2,1,2,f); fr(c,x,y-th2-3,1,1,f2);
          fr(c,x+(chance(.5)?1:-1),y-th2-1,1,1,f3); }
        else { fr(c,x+1,y-th2,1,1,f3); fr(c,x+1,y-th2+1,1,1,f);
          fr(c,x+2,y-th2+1,1,1,f2); }
      }
    }
  }
  /* ---- plaques d'herbe : de larges taches un ton au-dessus ou en dessous.
     C'est ce qui casse l'aplat à grande échelle, là où les brins ne jouent
     qu'à l'échelle du pixel. ---- */
  for(let r=0;r<NR;r++){
    const hb=PAL.herbe[r];
    for(let k=0,n=Math.round(W*(r<2?0.20:0.11));k<n;k++){
      const x=RI(2,W-3), a=SOL[r][x], b=(r<NR-1)?SOL[r+1][x]:RIVER;
      if(b-a<12) continue;
      const y=RI(a+5,b-5), rx=RI(4,14), ry=RI(1,4);
      const col=chance(.5)?clair(hb[0],.09):ombre(hb[2],.11);
      for(let j=-ry;j<=ry;j++){
        const q=1-(j*j)/((ry+0.6)*(ry+0.6)); if(q<=0)continue;
        const d=Math.round(rx*Math.sqrt(q));
        for(let i=-d;i<=d;i++) if(rnd()<0.66) fr(c,x+i,y+j,1,1,col);
      }
    }
  }
  /* ---- ruptures de terrasse : murets de pierre sèche, haies, palissades.
     Sans elles les rangées ne se lisent pas comme des niveaux mais comme
     des rayures. ---- */
  for(let r=0;r<NR-1;r++){
    let x=ZONE.bat[1]+RI(0,30);
    while(x<W-6){
      const l=RI(Math.round(W*0.06),Math.round(W*0.22));
      const k=rnd();
      if(k<0.40){                                          // muret de pierre sèche
        for(let i=0;i<l&&x+i<W;i++){
          const y=SOL[r+1][x+i], hh=4+((Math.sin((x+i)*0.3)*1.2)|0);
          fr(c,x+i,y-hh,1,hh,'#9a9284'); fr(c,x+i,y-hh,1,1,'#bab2a1');
          if((x+i)%3===0) fr(c,x+i,y-hh+RI(1,Math.max(2,hh-1)),1,1,'#736c60');
          fr(c,x+i,y,1,1,'rgba(12,16,10,.30)');
        }
      } else if(k<0.66){                                   // haie vive
        for(let i=0;i<l&&x+i<W;i++){
          const y=SOL[r+1][x+i], hh=RI(4,7);
          fr(c,x+i,y-hh,1,hh,chance(.5)?'#3f5c37':'#4c6c40');
          fr(c,x+i,y-hh,1,2,'#5b7f4a');
          fr(c,x+i,y,1,1,'rgba(12,16,10,.32)');
        }
      } else if(k<0.80){                                   // palissade de perches
        for(let i=0;i<l&&x+i<W;i+=1){
          const y=SOL[r+1][x+i];
          if(i%5===0) fr(c,x+i,y-7,1,7,'#6a5236');
          fr(c,x+i,y-5,1,1,'#7d6444'); fr(c,x+i,y-3,1,1,'#5c472e');
        }
      }
      x+=l+RI(Math.round(W*0.04),Math.round(W*0.16));
    }
  }
  // ---- sol piétiné du champ de bataille : discret, juste de quoi lire la zone ----
  {
    const b=ZONE.bat[1]+Math.round(W*0.04);
    for(let x=0;x<Math.min(W,b);x++){
      const t=clamp(1-x/Math.max(1,b),0,1);
      for(let r=0;r<NR;r++){
        const y0=SOL[r][x], y1=(r<NR-1)?SOL[r+1][x]:RIVER;
        for(let y=y0+1;y<y1;y++) if(rnd()<0.03+0.20*t)
          fr(c,x,y,1,RI(1,2), rnd()<.5?PAL.terre[0]:(chance(.5)?PAL.terre[1]:PAL.terre[2]));
      }
    }
    for(let k=0;k<6;k++){                       // fondrières piétinées
      const r=RI(0,NR-1), cx2=RI(4,Math.max(5,b-2));
      const cy=SOL[r][clamp(cx2,0,W-1)]+RI(6,16), rr=RI(6,14);
      for(let j=-(rr>>1);j<=(rr>>1);j++){
        const d=Math.floor(Math.sqrt(Math.max(0,rr*rr-4*j*j)))-RI(0,2);
        if(d<1) continue;
        for(let i=-d;i<=d;i++){
          if(rnd()<0.14) continue;              // bord rongé, jamais un ovale net
          fr(c,cx2+i,cy+j,1,1, j<-(rr>>3)?PAL.terre[2]:(rnd()<.3?PAL.terre[3]:PAL.terre[1]));
        }
        fr(c,cx2-d,cy+j,1,1,ombre(PAL.terre[2],.25));
      }
      fr(c,cx2-rr+2,cy-(rr>>1),2*rr-4,1,clair(PAL.terre[0],.22));   // lèvre séchée
      for(let i=0;i<RI(3,7);i++)                                     // mottes rejetées
        fr(c,cx2+RI(-rr-2,rr+2),cy+RI(-(rr>>1)-2,(rr>>1)+2),RI(1,2),1,PAL.terre[0]);
      fr(c,cx2-2,cy+(rr>>2),4,1,'#4d5a3a');                          // flaque
    }
  }
  /* ---- potagers et carrés de culture ----------------------------------
     Les anciens champs étaient de larges aplats bruns : dans une vallée
     verte ils lisaient comme des taches de boue. On les remplace par des
     planches de légumes — sillons VERTS de teintes voisines, séparés par
     d'étroites raies de terre, avec quelques fruits colorés. La terre ne
     sert plus que de liseré. */
  for(let k=0;k<RI(6,10);k++){
    const r=RI(0,2);
    const a=SOL[r][0], b=(r<NR-1)?SOL[r+1][0]:RIVER;
    const lw=RI(Math.round(W*0.05),Math.round(W*0.13));
    const x0=RI(ZONE.ville[0],Math.max(ZONE.ville[0]+1,ZONE.ville[1]-lw));
    const y0=RI(9,Math.max(10,(b-a)-16)), y1=Math.min((b-a)-4,y0+RI(6,13));
    const V=pick([['#5e8043','#4c6b36','#74994f'],['#6b8a3f','#587532','#83a54e'],
                  ['#4f7a4a','#3f643b','#659159'],['#7a8f46','#66783a','#93a85a']]);
    const fruit=pick(['#c0483a','#d8973a','#b8544f','#d0c04a','#8e5fa8']);
    for(let x=x0;x<Math.min(W,x0+lw);x++){
      const base=SOL[r][x];
      /* un potager se lit à ses CULTURES, pas à ses raies : chaque sillon
         porte des plants INDIVIDUELS au pas régulier — choux ronds, fanes
         plumeuses ou rangs feuillus — sur la terre brune visible entre eux. */
      const cult=((x0*7+k)%3);
      for(let y=y0;y<y1;y++){
        const sillon=(y-y0)%4;
        fr(c,x,base+y,1,1, sillon===3?'#6b5c42':(sillon===0?'#7a6a4e':'#847258'));
        if(sillon===1){
          const ph2=((x-x0)+((y-y0)/4|0)*2)%4;
          if(cult===0&&ph2===0){ fr(c,x,base+y,2,2,V[1]); fr(c,x,base+y,1,1,V[2]);   // chou
            if(rnd()<0.10) fr(c,x,base+y,1,1,fruit); }
          else if(cult===1&&ph2===0){ fr(c,x,base+y-1,1,2,V[0]);                       // fane
            fr(c,x-1,base+y-1,1,1,V[2]); fr(c,x+1,base+y-1,1,1,V[1]); }
          else if(cult===2){ fr(c,x,base+y,1,1,(ph2%2)?V[0]:V[1]);                     // rang feuillu
            if(ph2===0&&rnd()<0.3) fr(c,x,base+y-1,1,1,V[2]); }
        }
      }
      fr(c,x,base+y0-1,1,1,ombre(V[1],.28));
      if(rnd()<0.10) fr(c,x,base+y0-2,1,2,V[2]);        // frondaison qui déborde
    }
    // piquets et ficelle au bout de la planche
    for(const px2 of [x0,Math.min(W-1,x0+lw-1)]){
      const base=SOL[r][px2];
      fr(c,px2,base+y0-4,1,4,'#7d6444');
      fr(c,px2,base+y0-4,1,1,'#9a8158');
    }
    if(chance(.5)) for(let x=x0;x<Math.min(W,x0+lw);x+=2) fr(c,x,SOL[r][x]+y0-4,1,1,'rgba(210,200,170,.5)');
  }
  /* ---- sentes ------------------------------------------------------
     Le chemin de terre qui remontait tout l'écran de bas en haut coupait
     la vallée en deux et ramenait une grande coulée brune. Les habitants
     circulent en fait le long des terrasses : on trace donc des SENTES
     horizontales, faites d'herbe usée — pas de terre nue — juste sous la
     ligne où marchent les villageois, avec quelques dalles par endroits. */
  for(let r=0;r<NR;r++){
    const hb=PAL.herbe[r];
    const usee=mix(hb[1],'#b9b492',0.42), usee2=mix(hb[2],'#a49d80',0.34);
    let x=0;
    while(x<W){
      const l=RI(Math.round(W*0.10),Math.round(W*0.42));
      const dy=RI(3,7);
      for(let i=0;i<l&&x+i<W;i++){
        const xx=x+i, y=SOL[r][xx]+dy+Math.round(Math.sin(xx*0.04+r)*1.4);
        fr(c,xx,y,1,2,usee);
        fr(c,xx,y+2,1,1,usee2);
        if(rnd()<0.16) fr(c,xx,y+RI(0,2),1,1,mix(usee,'#8a7f60',.5));
        if(rnd()<0.05) fr(c,xx,y-1,1,1,hb[0]);
        if(rnd()<0.02){ fr(c,xx,y,2,2,'#948d78'); fr(c,xx,y,2,1,'#aaa48c'); }  // dalle
      }
      x+=l+RI(Math.round(W*0.05),Math.round(W*0.20));
    }
  }
  // petite place pavée devant le pont
  const px0=RI(ZONE.ville[0]+20,ZONE.ville[1]-20);
  {
    const pw2=Math.round(W*0.055);
    for(let i=-pw2;i<=pw2;i++){
      const xx=clamp(px0+i,0,W-1);
      const prof=Math.round((1-Math.abs(i)/pw2)*Math.round(H*0.022));
      for(let j=0;j<prof;j++){
        const y=RIVER-6-j;
        fr(c,xx,y,1,1, ((xx>>1)+(j>>1))%2?'#8e8779':'#7f7869');
        if(rnd()<0.10) fr(c,xx,y,1,1,'#a49c8c');
      }
      if(prof>0) fr(c,xx,RIVER-6-prof,1,1,ombre('#6b6456',.2));
    }
  }
  /* ---- berge : quais de pierre, talus de terre, grèves de galets, en
     segments alternés — une bande unie ne tient pas la lecture ---- */
  {
    let x=0;
    while(x<W){
      const l=RI(Math.round(W*0.05),Math.round(W*0.19)), k=rnd();
      const fin=Math.min(W,x+l);
      for(let i=x;i<fin;i++){
        const ep=RI(3,5);
        if(k<0.40){                                   // quai de pierre appareillée
          fr(c,i,RIVER-ep,1,ep,(i>>2)%2?'#8e8779':'#7d7568');
          fr(c,i,RIVER-ep,1,1,'#a8a091');
          if(i%4===0) fr(c,i,RIVER-ep,1,ep,'#615b50');
          fr(c,i,RIVER-1,1,1,'#4a4236');
        } else if(k<0.72){                            // talus de terre + racines
          fr(c,i,RIVER-ep,1,ep,PAL.terre[1]);
          fr(c,i,RIVER-ep,1,1,PAL.terre[0]);
          if(rnd()<.30) fr(c,i,RIVER-ep+RI(0,ep-1),1,1,PAL.terre[2]);
          if(rnd()<.18) fr(c,i,RIVER-ep-1,1,2,'#4e6b2c');
        } else {                                      // grève de galets
          fr(c,i,RIVER-ep,1,ep,'#8b8272');
          if(rnd()<.45){ const y=RIVER-RI(1,ep); fr(c,i,y,2,1,'#a49a87'); fr(c,i,y+1,2,1,'#6b6355'); }
        }
        fr(c,i,RIVER-1,1,1,'rgba(24,40,52,.35)');     // frange mouillée
      }
      x=fin;
    }
  }
  // lit de rivière (recouvert par les frames d'eau, sert de fond aux reflets)
  for(let y=RIVER;y<H;y++) fr(c,0,y,W,1,mix(PAL.eau[0],PAL.eau[3],(y-RIVER)/(H-RIVER)));

  /* ---- pont de pierre : arche en plein cintre, tympan appareillé,
     parapet à chaperon et avant-bec ---- */
  const bw=Math.max(20,Math.round(W*0.068));
  const bx=Math.round(px0-bw/2);
  const arcW=Math.round(bw*0.44), arcX=bx+((bw-arcW)>>1);
  const arcH=Math.max(7,Math.round(arcW*0.78));
  const pied=RIVER+4;                       // naissance de l'arche, sous l'eau
  const tab=pied-arcH-4;                    // tablier : l'arche doit émerger
  fr(c,bx,tab,bw,pied-tab+2,AMB.pierre[2]);                   // tympan appareillé
  for(let j=0;j<pied-tab;j+=2) for(let i=((j>>1)%2?0:2);i<bw;i+=5)
    if(chance(.55)) fr(c,bx+i,tab+j,4,1,chance(.5)?AMB.pierre[1]:AMB.pierre[3]);
  fr(c,bx,tab,1,pied-tab,AMB.pierre[0]); fr(c,bx+bw-1,tab,1,pied-tab,AMB.pierre[3]);
  for(let j=0;j<arcH;j++){                                    // percement de l'arche
    const t=j/arcH, wj=Math.round(arcW*Math.sqrt(Math.max(0,1-t*t)));
    fr(c,arcX+((arcW-wj)>>1),pied-j,wj,1,'#182634');
    fr(c,arcX+((arcW-wj)>>1),pied-j,1,1,AMB.pierre[3]);
    fr(c,arcX+((arcW-wj)>>1)+wj-1,pied-j,1,1,AMB.pierre[3]);
  }
  for(let j=0;j<3;j++){                                       // claveaux
    const wj=arcW+4-j*2, yy=pied-arcH-1+j;
    fr(c,arcX-2+j,yy,wj,1,j?AMB.pierre[1]:clair(AMB.pierre[0],.12));
  }
  // sous l'arche : intrados éclairé par le reflet de l'eau
  for(let j=1;j<arcH-2;j++){
    const t=j/arcH, wj=Math.round(arcW*Math.sqrt(Math.max(0,1-t*t)));
    const x0=arcX+((arcW-wj)>>1);
    if(j<arcH-6) fr(c,x0+1,pied-j,1,1,'#22323f');
    if(j<arcH-6) fr(c,x0+wj-2,pied-j,1,1,'#22323f');
  }
  fr(c,arcX+2,RIVER-1,arcW-4,1,mix('#182634','#7fb0cc',.45));        // ligne d'eau
  fr(c,arcX+3,RIVER,arcW-6,1,mix('#182634','#4d7f9c',.35));
  fr(c,arcX+(arcW>>1)-1,pied-arcH-2,3,3,clair(AMB.pierre[0],.20));   // clé de voûte
  fr(c,bx-3,tab-2,bw+6,3,AMB.pierre[1]);                      // tablier
  fr(c,bx-3,tab-2,bw+6,1,clair(AMB.pierre[0],.20));
  for(let i=0;i<bw+6;i+=3) fr(c,bx-3+i,tab-7,2,5,AMB.pierre[2]);     // balustres
  fr(c,bx-3,tab-8,bw+6,2,AMB.pierre[1]);                      // chaperon
  fr(c,bx-3,tab-8,bw+6,1,clair(AMB.pierre[0],.24));
  fr(c,bx-3,pied-1,bw+6,1,'rgba(16,30,42,.45)');
  // culées : le tablier doit rejoindre la berge, sinon le pont flotte
  for(let j=0;j<RIVER-tab+2;j++){
    const l=2+((j*0.9)|0);
    fr(c,bx-3-l,tab-2+j,l+1,1,j%3===2?AMB.pierre[3]:AMB.pierre[2]);
    fr(c,bx+bw+2,tab-2+j,l+1,1,j%3===2?AMB.pierre[3]:AMB.pierre[2]);
  }
  sp.pont=bx; sp.pontW=bw;
  PONT=[bx-4,bx+bw+4];

  /* ---- LES ESCALIERS DE TERRASSE. Chaque étage a le sien : une vieille
     volée de pierre et de terre, encastrée dans le rebord du talus, que
     l'herbe a presque reprise — trois pierres franches, deux marches de
     terre battue, un coin cassé. Discrets, mais toujours au même endroit :
     ce sont eux que les habitants emprunteront. ---- */
  ESC=[];
  for(let r=0;r<3;r++){
    let bx2;
    do{ bx2=RI(Math.round(W*0.14),Math.round(W*0.86)); }
    while(bx2>PONT[0]-14&&bx2<PONT[1]+14);
    ESC.push(bx2);
    /* ---------------------------------------------------------------
       UN VRAI OUVRAGE, pas trois cailloux. Les habitants passent leur
       journée à monter et descendre par là : l'escalier doit se voir de
       l'autre bout du bourg. On lui donne donc ce qui fait un escalier —
       la VOLÉE (marches à nez saillant, alternance pierre / terre
       battue), les LIMONS de pierre qui la bordent, une RAMPE de bois
       sur ses poteaux, un PALIER en haut, et le SENTIER usé qui y mène
       sur les deux terrasses. C'est le sentier qui raconte l'usage.
       --------------------------------------------------------------- */
    const yb=SOL[r+1][bx2], hb=PAL.herbe[r];
    const K=ech(r);
    const ml=Math.max(18,Math.round(26*K));              // largeur au pied de la volée
    const nM=8;                                          // nombre de marches
    const hm=Math.max(2,Math.round(2.6*K));              // hauteur d'une marche
    const pi=['#9a9284','#7a7466','#b0a89a','#5f594c'];
    const largeurA=k2=>Math.max(6,Math.round(ml*(1-0.42*(k2/(nM-1)))));  // la volée FUIT vers le fond

    // le sentier usé, sur la terrasse basse puis sur la haute
    for(let s2=0;s2<2;s2++){
      const ys=s2?SOL[r][bx2]:yb;
      const lw=Math.round(ml*0.62);
      for(let j=0;j<Math.round(6*K);j++){
        const w2=lw-Math.round(j*0.6);
        if(w2<3) break;
        fr(c,bx2-(w2>>1),ys+(s2?-j-hm*nM:j),w2,1, j%2?mix(hb[1],'#8a744e',.55):mix(hb[1],'#a08a5c',.42));
      }
    }

    /* LES LIMONS, deux joues de pierre qui CONVERGENT en montant : c'est
       leur fuite qui donne la profondeur. Sans elles, une volée vue de
       face n'est qu'une échelle posée à plat. */
    const lj=Math.max(2,Math.round(2.4*K));
    for(let k2=0;k2<nM;k2++){
      const my=yb-1-k2*hm;
      const w2=largeurA(k2);
      fr(c,bx2-(w2>>1)-lj,my-hm,lj,hm+1,pi[1]);
      fr(c,bx2-(w2>>1)-lj,my-hm,lj,1,pi[2]);
      fr(c,bx2+(w2>>1),my-hm,lj,hm+1,pi[3]);
      fr(c,bx2+(w2>>1),my-hm,lj,1,pi[1]);
    }

    // la volée : chaque marche plus étroite que la précédente
    for(let k2=0;k2<nM;k2++){
      const my=yb-1-k2*hm;
      const mw=largeurA(k2);
      const mx2=bx2-(mw>>1);
      const terre=(k2%3)===1;                            // une marche sur trois est en terre battue
      const cGiron=terre?'#8a744e':pi[1];
      fr(c,mx2,my-hm+1,mw,hm,cGiron);                    // la contremarche, dans l'ombre
      fr(c,mx2,my-hm+1,mw,1, terre?'#a08a5c':pi[0]);     // le giron, qui prend le jour
      fr(c,mx2-1,my-hm+1,mw+2,1, terre?'#b09a6c':pi[2]); // le NEZ saillant : c'est lui qui dit « marche »
      fr(c,mx2,my,mw,1, ombre(cGiron,.36));
      if(!terre&&chance(.5)) fr(c,mx2+RI(1,Math.max(1,mw-2)),my-hm+2,RI(1,3),1,ombre(pi[1],.28));
      if(chance(.5)) fr(c,mx2+(chance(.5)?-1:mw),my-hm+1,1,1,hb[2]);   // l'herbe mord les bords
      if(k2===Math.round(nM*0.6)&&chance(.5)) fr(c,mx2,my-hm+1,Math.max(2,Math.round(3*K)),1,ombre(pi[1],.48));
    }

    // le palier du haut, un peu plus large que la dernière marche
    { const py=yb-1-(nM-1)*hm-hm, w2=largeurA(nM-1);
      fr(c,bx2-(w2>>1)-lj,py-Math.max(2,Math.round(2*K)),w2+lj*2,Math.max(2,Math.round(2*K)),pi[1]);
      fr(c,bx2-(w2>>1)-lj,py-Math.max(2,Math.round(2*K)),w2+lj*2,1,pi[2]); }

    /* deux BORNES au pied de la volée : basses, trapues, l'une ébréchée.
       Elles marquent l'entrée sans faire écran, là où une rampe de bois
       ressemblait à une barrière posée en travers du pré. */
    for(const s2 of [-1,1]){
      const bxx=bx2+s2*((ml>>1)+lj), bh2=Math.max(4,Math.round(6*K)), bw2=Math.max(2,Math.round(3*K));
      fr(c,bxx-(bw2>>1),yb-bh2,bw2,bh2,pi[1]);
      fr(c,bxx-(bw2>>1),yb-bh2,bw2,1,pi[2]);
      fr(c,bxx+(bw2>>1)-1,yb-bh2,1,bh2,pi[3]);
      if(s2>0&&chance(.6)) fr(c,bxx-(bw2>>1),yb-bh2,Math.max(1,bw2-1),1,ombre(pi[1],.4));
    }

    fr(c,bx2-(ml>>1)-lj-1,yb,ml+lj*2+2,1,ombre(hb[2],.30));         // pied fondu au sol
  }
  return sp;
}

/* ==================================================================
   8 bis. LA RIVIÈRE
   Une nappe de tirets réguliers ne coule pas : elle grésille. Trois
   principes ici —
     · PERSPECTIVE : le pas des vaguelettes s'élargit vers le bas de
       l'écran (= vers l'observateur), et chaque ligne dérive d'exactement
       SON pas sur le cycle : la boucle reste invisible mais les lignes
       proches défilent plus vite que les lointaines. C'est la parallaxe
       qui donne le sens du courant.
     · DEUX TRAMES superposées de pas différents : leur battement casse
       la grille, sans jamais rompre la périodicité.
     · SCINTILLEMENT : les éclats de soleil pulsent en fonction de la
       frame (donc en boucle parfaite) au lieu d'être retirés au hasard.
   ================================================================== */
function genererEau(){
  eauFrames=[];
  const hh=H-RIVER;
  // éclats de soleil : positions tirées UNE fois, brillance fonction de la frame
  const eclats=[];
  for(let k=0,n=Math.round(W*hh/1500);k<n;k++)
    eclats.push({x:RI(0,W-1),y:RI(1,hh-1),ph:rnd()*6.28,l:RI(1,4)});
  // veines de courant : bandes claires/sombres qui structurent la nappe
  const veines=[];
  for(let k=0;k<7;k++) veines.push({y:R(0,hh),ep:R(hh*0.06,hh*0.22),a:R(-1,1)});

  for(let f=0;f<NEAU;f++){
    const sp=sprite(W,hh), c=sp.g;
    const u=f/NEAU;
    for(let y=0;y<hh;y++){
      const t=y/hh;
      let base=mix(PAL.eau[0],PAL.eau[3],Math.pow(t,0.82));
      for(const v of veines){
        const d=Math.abs(y-v.y)/v.ep;
        if(d<1) base=mix(base, v.a>0?'#79aecb':'#1b3145', (1-d)*Math.abs(v.a)*0.20);
      }
      fr(c,0,y,W,1,base);
    }
    /* Deux trames de rides LONGUES et espacées. Des tirets courts et serrés
       donnaient une neige de télévision : sur l'eau, c'est la longueur du
       reflet, pas sa fréquence, qui dit la surface. */
    for(const [mult,ep,teinte,inten] of [[1.00,4,'#b8dff1',0.40],[1.63,7,'#8ec2dd',0.24]]){
      for(let y=2;y<hh;y+=ep){
        const t=y/hh;
        const pas=Math.max(16,Math.round((W/15)*(0.45+1.7*t)*mult));
        const decal=u*pas + (Math.sin(y*1.7+mult*3)*0.5+0.5)*pas;
        const lw=Math.max(3,Math.round(pas*(0.26+0.20*Math.sin(y*0.5+mult*2))));
        c.fillStyle=mix(PAL.eau[0],teinte,inten*(1-t*0.45));
        for(let x=-pas;x<W+pas;x+=pas){
          const X=Math.round(x+decal);
          c.fillRect(X,y,lw,1);
          c.fillRect(X+Math.round(lw*0.25),y+1,Math.round(lw*0.5),1);   // épaisseur au creux
        }
      }
    }
    // creux d'ondes : quelques contre-lignes sombres, très espacées
    for(let y=5;y<hh;y+=9){
      const t=y/hh;
      const pas=Math.max(22,Math.round((W/11)*(0.5+1.5*t)));
      const decal=u*pas+pas*0.5+(Math.sin(y*2.3)*0.5+0.5)*pas;
      c.fillStyle=mix(PAL.eau[2],'#0f2233',0.22);
      for(let x=-pas;x<W+pas;x+=pas) c.fillRect(Math.round(x+decal),y,Math.round(pas*0.35),1);
    }
    // éclats de soleil, en boucle sur le cycle
    for(const e of eclats){
      const b=0.5+0.5*Math.sin(u*6.283+e.ph);
      if(b<0.55) continue;
      const t=e.y/hh;
      c.fillStyle=mix('#cfeaf7','#ffffff',(b-0.55)/0.45);
      c.globalAlpha=(b-0.55)/0.45*(0.85-t*0.35);
      c.fillRect(e.x,e.y,e.l,1);
      if(b>0.9) c.fillRect(e.x,e.y-1,1,1);
    }
    c.globalAlpha=1;
    // frange d'écume à la berge : elle clapote au lieu d'être une ligne
    const pasE=Math.max(6,Math.round(W/70));
    for(let x=0;x<W;x++){
      const o=Math.sin(x*0.21+u*6.283)+Math.sin(x*0.53+u*3.1)*0.5;
      fr(c,x,0,1,1,mix(PAL.eau[0],'#c8e6f4',0.30+0.30*(o*0.5+0.5)));
      if(o>0.75) fr(c,x,1,1,1,mix(PAL.eau[0],'#e2f2fa',.55));
      else if(o<-0.9) fr(c,x,1,1,1,mix(PAL.eau[0],'#7fb2cf',.30));
    }
    fr(c,0,2,W,1,mix(PAL.eau[0],'#6a9cb8',.22));
    eauFrames.push(sp.can);
  }
}

/* ---- roseaux, nénuphars et bois flotté : bande d'avant-plan pré-cuite
   en 4 poses de balancement, posée PAR-DESSUS l'eau ---- */
let roseauxFrames=[], ROSY=0, ROSH=0;
function genererRoseaux(){
  roseauxFrames=[];
  ROSY=RIVER-Math.round(H*0.050); ROSH=H-ROSY;
  const bas=RIVER-ROSY;
  const touffes=[], nenuphars=[], bois=[];
  for(let x=0;x<W;x++){
    if(x>PONT[0]-3&&x<PONT[1]+3) continue;
    if(QUAI&&x>QUAI.x-2&&x<QUAI.x+QUAI.w+2) continue;   // le quai a pris la berge
    if(rnd()<0.075){
      /* Les brins étaient retirés au sort À CHAQUE POSE : leur écart au
         centre de la touffe, leur hauteur et leurs feuilles changeaient d'une
         image à l'autre, d'où ce grouillement dans tous les sens. On les fige
         ici, une fois pour toutes ; seule la flexion varie ensuite.
         La phase suit la position : le vent est une ONDE qui court le long
         de la berge, il ne souffle pas au hasard touffe par touffe. */
      const n=RI(2,5), h=RI(5,Math.round(H*0.028)+7);
      const brins=[];
      for(let k=0;k<n;k++){
        const bh=Math.max(4,h+RI(-3,3)), feuilles=[];
        for(let j=3;j<bh;j++) if(j%5===0&&chance(.5)) feuilles.push([j,chance(.5)?1:-1]);
        brins.push({dx:RI(-3,3), bh, feuilles, dephas:k*0.55});
      }
      touffes.push({x, y:bas+RI(-2,4), brins,
                    ph:x*0.019+rnd()*0.9, sombre:chance(.4), massette:chance(.30)});
    }
  }
  for(let k=0,n=Math.round(W/38);k<n;k++)
    nenuphars.push({x:RI(4,W-8),y:bas+RI(4,Math.max(5,ROSH-bas-4)),r:RI(2,4),fleur:chance(.30),ph:rnd()*6.28});
  for(let k=0,n=Math.round(W/220)+1;k<n;k++)
    bois.push({x:RI(10,W-30),y:bas+RI(1,6),l:RI(10,26)});

  for(let f=0;f<NROS;f++){
    const sp=sprite(W,ROSH), c=sp.g;
    const u=f/NROS*6.283;
    // troncs échoués, à demi immergés
    for(const b of bois){
      fr(c,b.x,b.y,b.l,3,'#4a3a2a'); fr(c,b.x,b.y,b.l,1,'#6b5540');
      fr(c,b.x,b.y+3,b.l,1,'rgba(16,34,48,.45)');
      for(let i=2;i<b.l;i+=RI(4,8)) fr(c,b.x+i,b.y-1,1,1,'#5c8a45');
      fr(c,b.x-2,b.y+1,3,2,'#3c2f22');
    }
    // nénuphars
    for(const n of nenuphars){
      const dy=Math.round(Math.sin(u+n.ph)*0.7);
      ellipse(c,n.x,n.y+dy,n.r+1,Math.max(1,n.r-1),'#3f6b3a');
      ellipse(c,n.x,n.y+dy-1,n.r,Math.max(1,n.r-1),'#54874a');
      fr(c,n.x-1,n.y+dy-1,2,1,'#6da05c');
      fr(c,n.x+n.r-1,n.y+dy,2,1,'#2e5230');
      if(n.fleur){ fr(c,n.x-1,n.y+dy-3,3,2,'#f0e8f2'); fr(c,n.x,n.y+dy-4,1,1,'#f6d8e6'); fr(c,n.x,n.y+dy-3,1,1,'#e8c04a'); }
      fr(c,n.x-n.r,n.y+dy+2,n.r*2+1,1,'rgba(14,32,46,.30)');
    }
    // roseaux : chaque brin plie d'autant plus qu'il est haut
    for(const t of touffes){
      const V=t.sombre?['#3f5c28','#516f31','#2c421c']:['#5f7a34','#74913f','#435a24'];
      for(let k=0;k<t.brins.length;k++){
        const br=t.brins[k];
        const bx=t.x+br.dx, bh=br.bh;
        // amplitude réduite d'un tiers : un roseau ondule, il ne fouette pas
        const pli=Math.sin(u+t.ph+br.dephas)*1.05+(k%2?0.25:-0.25);
        let px=bx;
        for(let j=0;j<bh;j++){
          const q=j/bh;
          px=bx+pli*q*q*2.2;
          fr(c,Math.round(px),t.y-j,1,1, j<2?V[2]:(k%2?V[0]:V[1]));
        }
        for(const [j,se] of br.feuilles){                   // feuilles retombantes, figées
          const q=j/bh, fx=bx+pli*q*q*2.2;
          fr(c,Math.round(fx)+se,t.y-j+1,1,1,V[1]);
          fr(c,Math.round(fx)+2*se,t.y-j+2,1,1,V[2]);
        }
        if(t.massette&&k===0){                              // massette brune
          fr(c,Math.round(px),t.y-bh-3,1,4,'#8a6234');
          fr(c,Math.round(px)-1,t.y-bh-3,1,3,'#6f4d27');
        }
        fr(c,bx-1,t.y+1,3,1,'rgba(14,32,46,.35)');
      }
    }
    roseauxFrames.push(sp.can);
  }
}

/* ---- objets à la dérive : feuilles, écume, pétales ---- */
let flotants=[];
function genererFlotants(){
  flotants=[];
  const n=Math.round(W/26)+8;
  for(let i=0;i<n;i++){
    const y=RIVER+2+rnd()*(H-RIVER-3);
    flotants.push({x:R(0,W), y, ph:rnd()*6.28,
      v:(0.35+0.9*((y-RIVER)/(H-RIVER)))*R(2.6,4.8),
      t:RI(0,3), c:pick(['#7f9c4a','#a8843c','#c46b3a','#5f7a34','#d8c9a8']), s:RI(1,2)});
  }
}
function majFlotants(dt){
  for(const o of flotants){
    o.x+=o.v*dt;
    if(o.x>W+6){ o.x=-6; o.y=RIVER+2+rnd()*(H-RIVER-3); o.v=(0.35+0.9*((o.y-RIVER)/(H-RIVER)))*R(2.6,4.8); }
  }
}
function dessinerFlotants(){
  for(const o of flotants){
    const x=o.x|0, y=(o.y+Math.sin(tps*1.1+o.ph)*0.9)|0;
    if(o.t===3){                                   // touffe d'écume
      g.globalAlpha=.42; fr(g,x,y,o.s+2,1,'#dceef7'); fr(g,x+1,y-1,1,1,'#f0f8fc'); g.globalAlpha=1;
    } else if(o.t===2){                            // brindille
      fr(g,x,y,3,1,'#6b5540'); fr(g,x+3,y-1,2,1,'#5c4835');
    } else {                                       // feuille
      fr(g,x,y,o.s+1,o.s,o.c);
      fr(g,x,y,1,1,clair(o.c,.28));
      g.globalAlpha=.30; fr(g,x,y+o.s,o.s+2,1,'#14293a'); g.globalAlpha=1;
    }
  }
}

/* ==================================================================
   9. PLACEMENT DES ÉDIFICES
   ================================================================== */
let emplacements=[], batiments=[], decors=[], anims=[], lumieres=[];
let nbBatis=0, complet=false, tournesolChamps=[];

function genererEmplacements(){
  emplacements=[];
  const [a,b]=ZONE.ville;
  const conf=[[0,Math.round((b-a)/26)+6],[1,Math.round((b-a)/32)+5],[2,Math.round((b-a)/40)+4]];
  for(const [r,n] of conf){
    const marge=8+r*6;
    const pas=(b-a-2*marge)/Math.max(1,n-1);
    for(let i=0;i<n;i++) emplacements.push({x:Math.round(a+marge+i*pas+R(-5,5)),r,pris:false});
  }
  // quelques emplacements avancés vers la forêt et le champ de bataille
  for(let i=0;i<3;i++){
    emplacements.push({x:Math.round(R(ZONE.foret[0]-Math.round(W*0.05),ZONE.foret[0]+Math.round(W*0.03))),r:RI(0,1),pris:false});
    emplacements.push({x:Math.round(R(ZONE.bat[1]-Math.round(W*0.03),ZONE.bat[1]+Math.round(W*0.05))),r:RI(0,1),pris:false});
  }
}

const GEN={maison:genMaison,arbrechat:genArbreChat,forge:genForge,moulin:genMoulin,
           alchimie:genAlchimie,cuisine:genCuisine,chateau:genChateau,eglise:genEglise,
           halle:genHalle,grange:genGrange,tour:genTour,rempart:genRempart,
           fonderie:genFonderie,mine:genMine,armurerie:genArmurerie,nurserie:genNurserie,
           entrepot:genEntrepot,caserne:genCaserne,chantier:genChantier,
           entrainement:genEntrainement,moulinEau:genMoulinEau,
           bergerie:genBergerie,etable:genEtable};
const RANGEES={maison:[0,1,2],arbrechat:[1,2],forge:[1,2],moulin:[0,1],alchimie:[1,2],
               cuisine:[1,2],chateau:[0,1],eglise:[0,1],halle:[1,2],grange:[0,1],
               tour:[0,1],rempart:[0,1],fonderie:[1,2],mine:[0],armurerie:[1,2],
               nurserie:[1,2],entrepot:[1,2],caserne:[0,1],chantier:[1,2],
               entrainement:[0,1],bergerie:[0,1,2],etable:[0,1,2]};
/* --- LES MÉTIERS AJOUTÉS. Même table, écrite à part pour qu'on voie d'un
   coup d'œil ce que la version « jeu » apporte au bourg d'origine. Les
   rangées ne sont pas décoratives : une pêcherie ne s'installe qu'au bord
   de l'eau, une carrière et une mine mordent le contrefort du fond. --- */
Object.assign(GEN,{
  pecherie:genPecherie, scierie:genScierie, carriere:genCarriere,
  tuilerie:genTuilerie, laiterie:genLaiterie, filature:genFilature,
  tannerie:genTannerie, fumoir:genFumoir, charbonniere:genCharbonniere,
  verrerie:genVerrerie, herboristerie:genHerboristerie, scriptorium:genScriptorium,
  taverne:genTaverne, champ:genChamp, rucher:genRucher, orfevre:genOrfevre,
  portail:genPortail, descente:genDescente, puits:genPuits
});
Object.assign(RANGEES,{
  pecherie:[2], scierie:[1,2], carriere:[0], tuilerie:[0,1],
  laiterie:[1,2], filature:[1,2], tannerie:[2], fumoir:[1,2],
  charbonniere:[0,1], verrerie:[1], herboristerie:[1,2], scriptorium:[0,1],
  taverne:[1,2], champ:[0,1], rucher:[0,1], orfevre:[1,2],
  portail:[0], descente:[0,1], puits:[1,2]
});
/* ordre d'apparition : les édifices remarquables arrivent tôt, pour que la
   cité soit reconnaissable avant d'être dense */
/* Ordre d'apparition. Il ne suit pas l'importance mais l'ENCOMBREMENT :
   fonderie, caserne et entrepôt mesurent près de cent pixels de large et
   ne trouvaient plus de trouée si on les gardait pour la fin. Les gros
   passent donc devant, les maisons comblent ensuite. */
const ORDRE=['moulin','bergerie','forge','etable','fonderie','caserne','nurserie','entrepot','armurerie','cuisine',
             'chantier','mine','eglise','alchimie','entrainement','chateau','maison','halle',
             'maison','arbrechat','tour','maison','grange','maison','arbrechat','rempart',
             'maison','maison','maison','maison'];

function typeSuivant(i){
  if(i<ORDRE.length) return ORDRE[i];
  { let nb2=0,ne2=0;                       // filet : aucune cité ne reste sans fermes
    for(const b of batiments){ if(b.type==='bergerie')nb2++; else if(b.type==='etable')ne2++; }
    if(!nb2) return 'bergerie';
    if(!ne2) return 'etable'; }
  const r=rnd();
  if(r<0.40) return 'maison';
  if(r<0.48) return 'arbrechat';
  if(r<0.52) return 'grange';
  if(r<0.58) return chance(.5)?'bergerie':'etable';   // les fermes restent au tirage,
                                                      // sinon une ville mûre n'en bâtit plus jamais
  if(r<0.61) return 'halle';
  if(r<0.67) return 'tour';
  if(r<0.72) return 'rempart';
  if(r<0.77) return 'entrepot';
  if(r<0.82) return 'chantier';
  if(r<0.86) return 'forge';
  if(r<0.90) return 'cuisine';
  if(r<0.94) return 'armurerie';
  if(r<0.97) return 'nurserie';
  return 'maison';
}

/* ==================================================================
   9 bis. CE QUE CHAQUE ÉDIFICE RACONTE
   Les types listés ici deviennent survolables et cliquables ; les autres
   (maisons, arbres à chat, remparts…) restent du décor habité.
   ================================================================== */
const FICHES={
  forge:        {nom:'Forge',                  metier:'Maréchal-ferrant',
    txt:"Le marteau y bat du lever au couvre-feu. On y referre les mules, on y redresse les socs, et l'on y répare — contre une écuelle de lait — les gonds que les chats ont descellés en sautant dessus."},
  fonderie:     {nom:'Fonderie',               metier:'Fondeur',
    txt:"Le four à cuve ne s'éteint jamais tout à fait. On y coule le bronze des cloches et des chaudrons ; la coulée se fait de nuit, quand les yeux voient mieux la couleur du métal."},
  mine:         {nom:'Mine',                   metier:'Mineur',
    txt:"La galerie s'enfonce sous le contrefort. On en tire du fer, un peu de cuivre, et de temps à autre une veine de pierre à feu. Les chats y voient sans lampe, ce qui économise l'huile."},
  armurerie:    {nom:'Armurerie',              metier:'Armurier',
    txt:"Cottes, écus et heaumes, taillés pour des épaules étroites et des oreilles hautes. Le maître refuse toute commande dont il juge qu'elle gênerait la retombée sur les pattes."},
  cuisine:      {nom:'Four banal',             metier:'Fournier',
    txt:"Le four du bourg, où chacun vient cuire sa pâte contre une redevance. La broche tourne pour qui apporte sa viande, et l'odeur suffit à remplir la place à midi."},
  alchimie:     {nom:"Laboratoire d'alchimie", metier:'Alchimiste',
    txt:"Bocaux, vapeurs vertes et une tour qui penche un peu plus chaque année. On y cherche l'or ; on y trouve surtout des remèdes contre les boules de poils, ce qui se vend mieux."},
  nurserie:     {nom:'Nurserie',               metier:'Nourrice',
    txt:"Le cœur tendre du bourg. Coussins, paniers, linge minuscule sur la corde, et la grande tour à plateformes où les chatons apprennent à retomber d'où ils sont tombés."},
  moulin:       {nom:'Moulin à vent',          metier:'Meunier',
    txt:"Perché au vent, il moud le blé des collines. Le meunier dort dans la calotte tournante ; il dit que le grincement des ailes l'endort mieux qu'une berceuse."},
  bergerie:     {nom:'Bergerie',               metier:'Berger',
    txt:"Les moutons du bourg, gras comme des nuages posés. Le berger compte son troupeau chaque soir ; les chats comptent avec lui, et trouvent toujours un mouton de plus."},
  etable:       {nom:'Étable',                 metier:'Vacher',
    txt:"Lait, cuir et bonne chaleur l'hiver. Les vaches tolèrent les chats sur leur dos, à condition qu'ils ne griffent pas en rêvant."},
  moulinEau:    {nom:'Moulin à eau',           metier:'Meunier',
    txt:"Bâti sur pilotis, la roue à aubes prise dans le courant. Il moud plus régulièrement que son cousin des hauteurs, et l'on y pêche par la trappe du plancher les soirs de paresse."},
  entrepot:     {nom:'Entrepôt',               metier:'Facteur de commerce',
    txt:"Sacs, caisses et tonneaux montés à la poulie par la lucarne du pignon. On y garde le grain de la commune, sous la surveillance de trois chats dont c'est l'unique charge."},
  caserne:      {nom:'Caserne',                metier:"Sergent d'armes",
    txt:"La garde du bourg y loge, vingt-quatre pattes prêtes à la ronde. Braséro allumé toute la nuit devant la porte : moins pour se chauffer que parce qu'on y dort très bien."},
  chantier:     {nom:'Chantier de construction',metier:'Maître d\'œuvre',
    txt:"Charpente nue, échafaudages et roue de levage. Ce sera une maison ; pour l'instant c'est le meilleur terrain de jeu du bourg, ce que le maître d'œuvre déplore chaque matin."},
  entrainement: {nom:"Terrain d'entraînement", metier:"Maître d'armes",
    txt:"Sable damé, mannequins de paille et quintaine qui pivote quand on la frappe mal. Le griffoir du coin est officiellement destiné à l'échauffement des griffes."}
};
const CLIQUABLE=new Set(Object.keys(FICHES));
function candidats(type,vx){
  let cand=emplacements.filter(s=>!s.pris && RANGEES[type].includes(s.r));
  if(!cand.length) return cand;
  const centre=(ZONE.ville[0]+ZONE.ville[1])/2;
  if(type==='chateau'||type==='tour'){
    const haut=cand.filter(s=>s.r===0); if(haut.length)cand=haut;
  }
  if(type==='moulin'){
    const bord=cand.filter(s=>Math.abs(s.x-centre)>W*0.22); if(bord.length)cand=bord;
  }
  const cx=(vx==null)?centre+R(-W*0.28,W*0.28):vx;
  cand.sort((a,b)=>(Math.abs(a.x-cx)+rnd()*18)-(Math.abs(b.x-cx)+rnd()*18));
  return cand;
}
/* Essaie de poser un édifice de ce type. On teste plusieurs emplacements sans
   jamais les « consommer » : un château qui ne tient pas ici laissera très
   bien la place à une maison plus tard. */
function placer(type,vx){
  const cand=candidats(type,vx);
  if(!cand.length) return null;
  // un seul gabarit par rangée, réutilisé : on peut alors tester TOUS les
  // emplacements sans payer une génération de sprite à chaque essai
  const gabarit={};
  const essai=(sp,r,bx)=>(bx>=1 && bx+sp.w<=W-1 && libre(r,bx,bx+sp.w));
  for(const s of cand){
    if(!gabarit[s.r]){ try{ gabarit[s.r]=GEN[type](s.r); }
      catch(err){ console.warn('générateur en panne:',type,err); gabarit[s.r]=genMaison(s.r); } }
    const sp=gabarit[s.r], x0=Math.round(s.x-sp.w/2);
    // on ne se contente pas du centre exact de l'emplacement : on laisse
    // l'édifice glisser dans la trouée la plus proche
    for(let d=0;d<=Math.round(sp.w*0.9);d+=4){
      if(essai(sp,s.r,x0-d)) return {s,sp,bx:x0-d};
      if(d && essai(sp,s.r,x0+d)) return {s,sp,bx:x0+d};
    }
  }
  // dernier recours : n'importe quelle trouée d'une rangée autorisée.
  // C'est ce qui garantit qu'un monument finit toujours par sortir de terre.
  for(const r of RANGEES[type]){
    if(!gabarit[r]){ try{ gabarit[r]=GEN[type](r); }
      catch(err){ console.warn('générateur en panne:',type,err); gabarit[r]=genMaison(r); } }
    const sp=gabarit[r];
    const x=trouverTrou(r,sp.w+2,vx);
    if(x!=null && x+sp.w<=W-1) return {s:{x:x+(sp.w>>1),r,pris:false},sp,bx:x};
  }
  return null;
}

function batir(vx){
  if(complet) return false;
  let type=typeSuivant(nbBatis);
  let r=placer(type,vx);
  if(!r && type!=='maison'){ type='maison'; r=placer(type,vx); }
  if(!r){
    // plus d'emplacement viable : on comble les trouées avant de renoncer
    if(densifier(vx)){ majHud(); return true; }
    if(!ajouterDecor(vx)){ complet=true; majHud(); return false; }
    majHud(); return true;
  }
  const {s,sp,bx}=r;
  // léger décalage vertical : sans lui les rangées forment des bandes trop régulières
  const by=solY(s.r,s.x)+1+RI(-1,3);
  for(const e of emplacements)
    if(e.r===s.r && !e.pris && e.x>bx+MARGE(sp) && e.x<bx+sp.w-MARGE(sp)) e.pris=true;
  s.pris=true;
  batiments.push({sp,x:bx,y:by,r:s.r,type,ne:tps,cuit:false});
  poussiere(s.x,by,sp.w);
  nbBatis++;
  if(chance(.5)) ajouterDecor(s.x+(chance(.5)?-1:1)*RI(Math.round(sp.w*0.6),Math.round(sp.w*1.1)),s.r);
  if((type==='maison'||type==='cuisine') && chance(.45)) ajouterTournesols(s.r);
  majPopulation(); majHud();
  return true;
}

/* Les sprites portent une marge transparente de chaque côté (elle sert aux
   auvents, aux tonneaux, aux enseignes qui débordent). La compter comme
   pleine espaçait les édifices comme des pavillons ; on autorise donc les
   emprises à se chevaucher d'un dixième — les corps de bâtiment, eux, ne
   se touchent toujours pas, et la rue se resserre comme dans un vrai bourg. */
const MARGE=sp=>Math.round(sp.w*0.175);
/* L'EMPRISE d'un édifice n'est pas toujours la largeur de son sprite :
   un chantier porte l'emprise du bâtiment qu'il deviendra, sinon un
   voisin s'installerait dans la place qu'il faut garder. */
const EMPRISE=b=>(b.emprise||b.sp.w);
function libre(r,x0,x1){
  for(const b of batiments){ const wB=EMPRISE(b), m=Math.round(wB*0.175);
    if(b.r===r && x1>b.x+m && x0<b.x+wB-m) return false; }
  for(const o of decors){ const m=Math.round(o.sp.w*0.14);
    if(o.r===r && x1>o.x+m && x0<o.x+o.sp.w-m) return false; }
  return true;
}
/* Cherche une trouée d'au moins `largeur` pixels sur une rangée.
   Bien plus fiable qu'un tirage aléatoire quand la cité se densifie :
   c'est ce qui permet de continuer à remplir la fenêtre jusqu'au bout. */
function trouverTrou(r,largeur,proche){
  const a=Math.max(2,ZONE.ville[0]-Math.round(W*0.06));
  const b=Math.min(W-3,ZONE.ville[1]+Math.round(W*0.06));
  const trous=[];
  for(let x=a;x<b-largeur;x+=2) if(libre(r,x,x+largeur)) trous.push(x);
  if(!trous.length) return null;
  if(proche!=null) trous.sort((p,q)=>(Math.abs(p-proche)+rnd()*10)-(Math.abs(q-proche)+rnd()*10));
  else return trous[(rnd()*trous.length)|0];
  return trous[0];
}
function ajouterDecor(vx,forceR){
  if(decors.length>240) return false;
  /* Plafond de décor DANS la ville : sans lui chaque échec de construction
     ajoute un arbre, qui bloque à son tour la construction suivante — la
     cité s'étouffe elle-même à une dizaine d'édifices. */
  const [va,vb]=ZONE.ville;
  let nVille=0;
  for(const d of decors){ const m=d.x+d.sp.w/2; if(m>=va&&m<=vb) nVille++; }
  /* Un arbre mange autant de façade qu'une maison. Avec un plafond trop
     haut, la cité se retrouvait pleine à dix-huit édifices et la moitié
     des métiers ne sortait jamais de terre. */
  if(nVille>=Math.round((vb-va)/46)) return false;
  /* plus de torche plantée : la lumière nocturne appartient aux porteurs */
  const types=['arbre','arbre','arbre','buisson','buisson','rocher','puits','charrette',
               'foin','etal','tonneaux','barriere','caisses','rucher','sechoir'];
  for(let essai=0;essai<4;essai++){
    const t=pick(types);
    // la berge se garnit elle aussi au fil de la croissance de la cité
    // la berge n'accueille plus rien : elle est réservée au quai
    const r=(forceR!=null&&essai<2)?Math.min(2,forceR):RI(0,2);
    const sp = t==='arbre'?genArbre(r): t==='buisson'?genBuisson(r):
               t==='rocher'?genRocher(r): t==='puits'?genPuits(r): genObjet(t,r);
    const x=trouverTrou(r,sp.w+1,vx);
    if(x==null) continue;
    decors.push({sp,x,y:solY(r,x+(sp.w>>1))+1,r,ne:tps,cuit:false,type:t});
    return true;
  }
  return false;
}
function ajouterTournesols(r,force){
  if(tournesolChamps.length>=3) return false;
  const lw=RI(Math.round(W*0.04),Math.round(W*0.085));
  const x=trouverTrou(r,lw+2,null);
  if(x==null) return force?ajouterTournesols((r+1)%3,false):false;
  const champ=genTournesols(r,lw);
  tournesolChamps.push({...champ,x,y:solY(r,x+(lw>>1))+2,r,ph:rnd()*6.28});
  // on réserve la parcelle pour qu'aucun bâtiment ne s'y installe
  decors.push({sp:{w:lw,h:1,can:null,fenetres:[],lampes:[],drapeaux:[],fumees:[]},
               x,y:solY(r,x)+1,r,ne:-99,cuit:true,vide:true});
  return true;
}
/* ---------- LES ÉLEVAGES ----------
   Deux fermes : la bergerie et l'étable. Même grammaire pour les deux —
   un corps bas au toit profond, un ENCLOS de lisses attenant, l'abreuvoir
   creusé, le râtelier à foin, et les bêtes dans le parc, chacune avec sa
   robe. C'est l'enclos qui fait la ferme : sans lui ce n'est qu'une
   remise. */
function mouton(c,x,y2,S){
  const q=Math.max(1,Math.round(S(2)*0.7));                  // facteur d'échelle
  if(q>1){ return moutonQ(c,x,y2,q); }
  const lain='#e8e2d2', lo=ombre(lain,.16), tete=chance(.25)?'#e0d8c4':'#3a3230';
  fr(c,x-1,y2,7,1,'rgba(18,14,9,.22)');
  fr(c,x,y2-4,6,4,lain);
  fr(c,x,y2-4,6,1,clair(lain,.12));
  fr(c,x,y2-1,1,1,lo); fr(c,x+5,y2-1,1,1,lo);
  fr(c,x+1,y2-5,2,1,lain); fr(c,x+4,y2-5,1,1,lo);           // dos bosselé
  fr(c,x+5,y2-5,2,2,tete);                                   // tête
  fr(c,x+6,y2-6,1,1,tete);
  fr(c,x+1,y2,1,1,'#5a4a3a'); fr(c,x+4,y2,1,1,'#5a4a3a');    // pattes
}
function vache(c,x,y2,S){
  const q=Math.max(1,Math.round(S(2)*0.7));
  if(q>1){ return vacheQ(c,x,y2,q); }
  const robe=chance(.5)?'#e4dcc6':'#a8764a', tach=chance(.5)?'#3a2f26':'#6b4a2c';
  fr(c,x-1,y2,10,1,'rgba(18,14,9,.22)');
  fr(c,x,y2-5,9,5,robe);
  fr(c,x,y2-5,9,1,clair(robe,.10));
  fr(c,x+RI(1,3),y2-4,RI(2,3),RI(2,3),tach);                 // taches
  fr(c,x+RI(5,6),y2-3,2,2,tach);
  fr(c,x+8,y2-6,3,3,robe);                                   // tête
  fr(c,x+8,y2-7,1,1,'#d8cfc0'); fr(c,x+10,y2-7,1,1,'#d8cfc0'); // cornes
  fr(c,x+10,y2-4,1,1,'#8a7a6a');                              // mufle
  fr(c,x+1,y2,1,1,'#4a3a2c'); fr(c,x+7,y2,1,1,'#4a3a2c');
  fr(c,x-1,y2-4,1,3,robe); fr(c,x-1,y2-1,1,1,tach);           // queue
}
/* versions au double : les bêtes suivent l'échelle de leur rangée, sinon
   elles disparaissent au premier plan */
function moutonQ(c,x,y2,q){
  const lain='#e8e2d2', lo=ombre(lain,.18), tete=chance(.25)?'#e0d8c4':'#3a3230';
  fr(c,x-1,y2,12,1,'rgba(18,14,9,.22)');
  fr(c,x,y2-7,10,7,lain);
  fr(c,x,y2-7,10,1,clair(lain,.14));
  fr(c,x+1,y2-8,3,1,lain); fr(c,x+6,y2-8,3,1,lain);          // dos bosselé
  fr(c,x,y2-2,1,2,lo); fr(c,x+9,y2-2,1,2,lo);
  fr(c,x+9,y2-8,3,4,tete); fr(c,x+11,y2-9,1,1,tete);
  fr(c,x+10,y2-7,1,1,'#141821');                              // œil
  fr(c,x+2,y2,1,2,'#5a4a3a'); fr(c,x+7,y2,1,2,'#5a4a3a');
  for(let k=0;k<6;k++) fr(c,x+RI(1,8),y2-RI(3,7),1,1,clair(lain,.20)); // bouclettes
}
function vacheQ(c,x,y2,q){
  const robe=chance(.5)?'#e4dcc6':'#a8764a', tach=chance(.5)?'#3a2f26':'#6b4a2c';
  fr(c,x-1,y2,16,1,'rgba(18,14,9,.22)');
  fr(c,x,y2-8,14,8,robe);
  fr(c,x,y2-8,14,1,clair(robe,.10));
  fr(c,x+2,y2-7,4,4,tach); fr(c,x+8,y2-4,3,3,tach); fr(c,x+11,y2-8,2,2,tach);
  fr(c,x+13,y2-10,4,5,robe);                                  // tête
  fr(c,x+13,y2-11,1,2,'#d8cfc0'); fr(c,x+16,y2-11,1,2,'#d8cfc0');
  fr(c,x+14,y2-8,1,1,'#141821');
  fr(c,x+15,y2-6,2,1,'#8a7a6a');
  fr(c,x+2,y2,1,2,'#4a3a2c'); fr(c,x+11,y2,1,2,'#4a3a2c');
  fr(c,x-1,y2-7,1,5,robe); fr(c,x-1,y2-2,1,2,tach);
  fr(c,x+6,y2-1,2,2,'#d8a8b0');                               // pis
}
function genFerme(row,vaches){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(28), h=S(16), toitH=S(14), parc=S(24);
  const SW=w+parc+S(12), SH=h+toitH+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(4), p=AMB.pierre, bois=AMB.bois;
  const B=['#7d5a37','#5a412a','#a17a4e','#3a2a1b'];
  socle(c,x0-1,bas-S(4),w+2,S(4),p);
  if(chance(.5)) mur(c,x0,bas-h,w,h,p,3);
  else bardage(c,x0,bas-h,w,h,B);
  if(vaches) toitVarie(c,x0-S(3),bas-h-toitH,w+S(6),toitH,pick(AMB.toits));
  else { MATCOUR='chaume'; toitPignon(c,x0-S(3),bas-h-toitH,w+S(6),toitH,PAL.toits.ocre,'chaume'); }
  // grande porte de l'étable et lucarne à foin
  { const dw=Math.max(8,S(12));
    porte(c,x0+S(3),bas-Math.max(9,S(12)),dw,Math.max(9,S(12)),B,true);
    fenetre(sp,c,x0+w-S(9),bas-h+S(3),Math.max(3,S(5)),Math.max(4,S(6)),bois,pick(PAL.volets),{on:chance(.5)});
    chatiere(c,x0+w-S(4),bas,Math.max(4,S(5)),B); }
  /* --- l'enclos : poteaux et deux lisses, ouvert sur la porte --- */
  const ex=x0+w, ey=bas;
  for(let i=0;i<=parc;i+=Math.max(5,S(7))){
    fr(c,ex+i,ey-S(7),Math.max(2,S(2)),S(7),B[1]);
    fr(c,ex+i,ey-S(7),1,S(7),B[2]);
  }
  for(const f of [0.35,0.75]){
    fr(c,ex,ey-Math.round(S(7)*f)-2,parc+Math.max(2,S(2)),Math.max(1,S(2)),B[0]);
    fr(c,ex,ey-Math.round(S(7)*f)-2,parc,1,B[2]);
  }
  // sol du parc : terre battue, paille
  for(let k=0,n=parc;k<n;k+=2) if(chance(.5))
    fr(c,ex+RI(0,parc),ey-RI(0,1),RI(1,2),1, chance(.5)?'#8a744e':'#a89058');
  // abreuvoir et râtelier
  fr(c,ex+S(3),ey-S(4),S(9),S(3),'#6a4c31');
  fr(c,ex+S(4),ey-S(4),S(7),1,'#3f6b8c');
  fr(c,ex+parc-S(10),ey-S(9),S(8),S(2),B[1]);
  for(let i=0;i<S(8);i+=2) fr(c,ex+parc-S(10)+i,ey-S(9),1,S(5),B[1]);
  fr(c,ex+parc-S(9),ey-S(7),S(6),S(3),'#c4a254');
  /* --- les bêtes --- */
  /* le parc n'est jamais vide, mais les bêtes ne s'empilent plus : on
     compte la place que prend un corps et on répartit là-dessus */
  const corps=(S(2)>1)?(vaches?19:14):(vaches?12:9);
  const n=clamp(Math.floor((parc-S(4))/corps),2,5);
  for(let k=0;k<n;k++){
    const ax=ex+S(3)+k*corps+RI(0,2);
    if(vaches) vache(c,ax,ey-RI(0,2),S); else mouton(c,ax,ey-RI(0,2),S);
  }
  if(!vaches&&chance(.6)) mouton(c,x0+RI(S(4),w-S(8)),bas-h-S(2),S);   // l'échappé sur le toit ? non : devant
  if(chance(.7)) chatAssis(c,ex+parc-S(4),ey-1,pick(PELAGES),-1);
  sp.fumees.push({x:x0+S(6),y:bas-h-toitH-S(2),t:0,d:0.4});
  chatteries(sp,c,x0,bas,w,h,row);
  brume(sp,row); return sp;
}
function genBergerie(row){ return genFerme(row,false); }
function genEtable(row){ return genFerme(row,true); }

/* Petite chaumière : sert à combler les dernières trouées de la cité. */
function genCabane(row){
  const w=sc(row,RI(20,30)), h=sc(row,RI(11,16)), toitH=sc(row,RI(12,18));
  const SW=w+sc(row,12), SH=h+toitH+sc(row,9);
  const sp=sprite(SW,SH), c=sp.g;
  const cx=SW>>1, bas=SH-1, x0=cx-(w>>1), bois=AMB.bois;
  socle(c,x0-1,bas-sc(row,5),w+2,sc(row,5),AMB.pierre);
  const platre=pick(PAL.platre);
  colombage(c,x0,bas-sc(row,5)-h,w,h,platre,bois,chance(.5)?'croix':'droit');
  const dw=Math.max(3,sc(row,6));
  porte(c,x0+sc(row,3),bas-sc(row,10),dw,sc(row,10),bois,false);
  if(w>=sc(row,20)) fenetre(sp,c,x0+w-sc(row,9),bas-sc(row,5)-h+3,Math.max(3,sc(row,5)),Math.max(3,h-6),bois,pick(PAL.volets),{volets:chance(.4)});
  const chaumeToit=chance(.6);
  toitPignon(c,x0-sc(row,4),bas-sc(row,5)-h-toitH,w+sc(row,8),toitH,
             chaumeToit?PAL.toits.ocre:pick(AMB.toits),chaumeToit?'chaume':'tuile');
  const chx=cx+(chance(.5)?-1:1)*sc(row,6), cw=Math.max(2,sc(row,4));
  const chBas=bas-sc(row,5)-h-Math.round(toitH*0.45);
  fr(c,chx,chBas-sc(row,7),cw,sc(row,7),PAL.brique[0][0]);
  fr(c,chx-1,chBas-sc(row,7),cw+2,2,PAL.brique[0][1]);
  sp.fumees.push({x:chx+(cw>>1),y:chBas-sc(row,7)-1,t:0,d:0.7});
  brume(sp,row); return sp;
}
/* Dernier recours quand tous les emplacements officiels sont pris. */
function densifier(vx){
  for(let essai=0;essai<5;essai++){
    const r=RI(0,2);
    const sp=genCabane(r);
    const x=trouverTrou(r,sp.w+2,vx);
    if(x==null) continue;
    const y=solY(r,x+(sp.w>>1))+1;
    batiments.push({sp,x,y,r,type:'cabane',ne:tps,cuit:false});
    poussiere(x+(sp.w>>1),y,sp.w);
    nbBatis++; majPopulation();
    return true;
  }
  return false;
}

/* ---- cuisson d'un élément dans le calque de sa rangée ---- */
function cuire(e){
  const c=couches[e.r].getContext('2d');
  c.imageSmoothingEnabled=false;
  // contact au sol : un liseré serré, l'ombre longue est dynamique (elle suit le soleil)
  c.globalAlpha=0.30; c.fillStyle='#101a10';
  c.fillRect(e.x,e.y-1,e.sp.w,2);
  c.globalAlpha=0.16;
  c.fillRect(e.x-2,e.y-1,e.sp.w+4,3); c.globalAlpha=1;
  if(e.sp.can) c.drawImage(e.sp.can,e.x,e.y-e.sp.h);
  e.cuit=true; bordSale=true; refletSale=true;
  /* Souffle de chantier : l'édifice vient de se poser. Réservé aux
     bâtiments — un arbre qui « atterrit » dans un nuage de poussière
     trahirait la mécanique de pose. */
  if(e.type && e.sp.h>10 && pN<PMAX-160){
    const cxb=e.x+e.sp.w/2;
    for(let i=0;i<18;i++) emettre(cxb+R(-e.sp.w*0.55,e.sp.w*0.55),e.y-R(0,3),R(-26,26),R(-16,-3),R(.5,1.3),5,1);
    for(let i=0;i<6;i++)  emettre(cxb+R(-e.sp.w*0.4,e.sp.w*0.4),e.y-R(2,10),R(-9,9),R(-22,-9),R(.7,1.5),3,0.8);
    // et la volée d'oiseaux dérangée par le chantier
    if(chance(.5)&&oiseaux.length<28){
      const d=chance(.5)?1:-1;
      for(let i=0,n=RI(2,4);i<n;i++)
        oiseaux.push({x:cxb+R(-8,8),y:e.y-e.sp.h-R(0,6),v:d*R(18,30),ph:rnd()*6.28});
    }
  }
  const bx=e.x, by=e.y-e.sp.h;
  for(const f of e.sp.fenetres) lumieres.push({x:bx+f.x,y:by+f.y,w:f.w,h:f.h,ph:f.ph,on:f.on,vitrail:f.vitrail,r:e.r});
  for(const l of e.sp.lampes)   lumieres.push({lampe:true,pt:l.pt,x:bx+l.x,y:by+l.y,c:l.c,rad:l.r,ph:rnd()*6.28,r:e.r});
  if(e.sp.roue)    anims.push({t:'roue',x:bx+e.sp.roue.x,y:by+e.sp.roue.y,d:e.sp.roue,r:e.r});
  if(e.sp.poulie)  anims.push({t:'poulie',x:bx+e.sp.poulie.x,y:by+e.sp.poulie.y,d:e.sp.poulie,r:e.r,ph:rnd()*6.28});
  if(e.sp.mannequin)anims.push({t:'mannequin',x:bx+e.sp.mannequin.x,y:by+e.sp.mannequin.y,d:e.sp.mannequin,r:e.r,ph:rnd()*6.28});
  if(e.sp.moulin)  anims.push({t:'moulin',x:bx+e.sp.moulin.x,y:by+e.sp.moulin.y,d:e.sp.moulin,r:e.r});
  if(e.sp.brasier) anims.push({t:'brasier',x:bx+e.sp.brasier.x,y:by+e.sp.brasier.y,d:e.sp.brasier,r:e.r});
  if(e.sp.chaudron)anims.push({t:'chaudron',x:bx+e.sp.chaudron.x,y:by+e.sp.chaudron.y,d:e.sp.chaudron,r:e.r});
  if(e.sp.enseigne)anims.push({t:'enseigne',x:bx+e.sp.enseigne.x,y:by+e.sp.enseigne.y,d:e.sp.enseigne,r:e.r});
  if(e.sp.linge) for(const l of e.sp.linge) anims.push({t:'linge',x:bx+l.x,y:by+l.y,d:l,r:e.r});
  if(e.sp.balancier)anims.push({t:'balancier',x:bx+e.sp.balancier.x,y:by+e.sp.balancier.y,d:e.sp.balancier,r:e.r});
  if(e.sp.girouette)anims.push({t:'girouette',x:bx+e.sp.girouette.x,y:by+e.sp.girouette.y,d:e.sp.girouette,r:e.r});
  if(e.sp.flamme)  anims.push({t:'flamme',x:bx+e.sp.flamme.x,y:by+e.sp.flamme.y,r:e.r});
  for(const d of e.sp.drapeaux) anims.push({t:'drapeau',x:bx+d.x,y:by+d.y,d,r:e.r});
  for(const f of e.sp.fumees)   anims.push({t:'cheminee',x:bx+f.x,y:by+f.y,d:f,r:e.r});
}

/* ==================================================================
   10. HABITANTS — Structure of Arrays, zéro allocation par frame
   ================================================================== */
const VMAX=1200;
const vX=new Float32Array(VMAX), vV=new Float32Array(VMAX), vPh=new Float32Array(VMAX),
      vPause=new Float32Array(VMAX), vR=new Uint8Array(VMAX), vT=new Uint8Array(VMAX),
      vTor=new Uint8Array(VMAX),          // 1 = porte une torche à la nuit tombée
      vCX=new Float32Array(VMAX),         // abscisse du POSTE de travail
      vCR=new Int8Array(VMAX),            // rangée du poste ; -1 = habitant libre
      vAct=new Uint8Array(VMAX),          // 1 = arrivé au poste, il travaille
      vJob=new Uint8Array(VMAX);          // métier exercé AU POSTE (0 = aucun)
let vN=0;
/* Les gestes de métier. Un habitant ne pêche pas « en général » : il pêche
   parce qu'on l'a mis à la pêcherie. L'index est stocké dans vJob et ne
   vaut jamais rien tant que l'habitant n'est pas arrivé à son poste. */
const JOBS={peche:1,bois:2,champs:3,elevage:4,mine:5,feu:6,forge:7,tissage:8,
            cuisine:9,savoir:10,batisse:11,guerre:12};
const DENSITES=[
  {nom:'clairsemée',k:3,max:180},
  {nom:'dense',k:8,max:520},
  {nom:'foule',k:16,max:1000}
];
let densite=1;
let NUIT=0;                     // facteur de nuit, exposé au rendu des villageois
let torchesMob=[];              // flammes des porteurs, re-remplies à chaque image

function majPopulation(){
  const D=DENSITES[densite];
  const cible=(POP_FORCEE!=null)?Math.min(VMAX,Math.max(0,POP_FORCEE)):Math.min(D.max,VMAX,Math.round(nbBatis*D.k)+14);
  while(vN<cible){
    const i=vN++;
    /* Les habitants ne descendent plus sur la berge : elle formait une
       file continue de silhouettes qui brouillait tout le premier plan.
       Seul le quai en reçoit quelques-uns, tirés plus bas. */
    vR[i]=(rnd()<0.10)?3:RI(0,2);
    vX[i]=R(4,W-6);
    vV[i]=R(5,14)*(chance(.5)?1:-1);
    vPh[i]=rnd()*6.28;
    vPause[i]=R(0,3);
    vT[i]=RI(0,TENUES.length-1);
    vTor[i]=rnd()<0.20?1:0;                   // un sur cinq sort sa torche le soir
    vCR[i]=-1; vCX[i]=-1; vAct[i]=0;
  }
  if(vN>cible) vN=cible;
}
/* ------------------------------------------------------------------
   AFFECTATION. Le jeu donne un poste à un habitant : une abscisse et un
   étage. L'habitant cesse alors de flâner — il gagne l'escalier qui mène
   à son étage, longe la terrasse jusqu'à son chantier, et s'y tient. On
   lit ainsi la production DANS le village, sans aucun indicateur. */
function affecter(i,r,x,metier){
  if(i<0||i>=VMAX) return;
  if(r==null||r<0){ vCR[i]=-1; vCX[i]=-1; vAct[i]=0; vJob[i]=0; return; }
  vCR[i]=Math.max(0,Math.min(3,r|0)); vCX[i]=x; vPause[i]=0;
  vJob[i]=JOBS[metier]||0;
}

/* ------------------------------------------------------------------
   LE GESTE DU MÉTIER.
   Deux poses par seconde, tirées du temps global : la canne se lève, la
   hache retombe, le marteau bat. C'est ce qui distingue un habitant qui
   TRAVAILLE d'un habitant qui passe — et c'est la seule chose qui dise,
   sans texte, que la pêcherie tourne.
   ------------------------------------------------------------------ */
function dessinerGeste(x,solPix,haut,dir,job,ph){
  const s=dir?1:-1;                       // 1 = tourné vers la droite
  const cy=solPix-Math.round(haut*0.55);  // la main, à mi-buste
  const mx=x+s*Math.max(2,Math.round(haut*0.22));
  const c=(tps*2.6+ph);
  const bat=Math.sin(c);                  // -1 .. 1, le cycle du geste
  const B='#4a3421', B2='#8a6a45', FER='#9aa0a6', FERC='#e2e8ee', NOIR='#1a1510';
  /* Le manche est tracé DEUX FOIS : une ombre décalée d'un pixel, puis le
     bois. Sans ce liséré, l'outil disparaît dans l'herbe dès qu'on
     s'éloigne — et un geste qu'on ne voit pas ne sert à rien. */
  const manche=(x0,y0,x1,y1,col)=>{ trait(g,x0+1,y0+1,x1+1,y1+1,NOIR,1); trait(g,x0,y0,x1,y1,col||B,2); };
  /* Une tête d'outil : l'aplat, son ombre d'un pixel en bas, et le seul
     liséré clair qui la détache — pas un cadre noir, qui ferait tache. */
  const tete=(x0,y0,w,h,col,clairCol)=>{
    fr(g,x0+1,y0+1,w,h,NOIR); fr(g,x0,y0,w,h,col);
    fr(g,x0,y0,w,1,clairCol||FERC); fr(g,x0,y0,1,h,clairCol||FERC);
  };
  switch(job){
    case JOBS.peche: {                    // la canne et sa ligne
      const L=Math.max(8,Math.round(haut*0.85));
      const tx=x+s*L, ty=cy-Math.round(L*0.6)+(bat>0.6?-2:0);
      manche(mx,cy,tx,ty);
      trait(g,tx,ty,tx+s*2,ty+Math.round(L*0.8),'rgba(232,240,246,.7)',1);
      if(bat>0.8) tete(tx+s*2-1,ty+Math.round(L*0.8),3,2,'#9fb6bd','#d3e2e8');
      break; }
    case JOBS.bois: {                     // la hache, levée puis abattue
      const up=bat>0;
      const hx=mx+s*3, hy=cy-(up?Math.round(haut*0.55):-1);
      manche(mx,cy,hx,hy);
      tete(hx+(s>0?0:-3),hy-2,3,4,FER,FERC);
      if(!up&&rnd()<0.4) fr(g,hx+s*3+RI(-1,1),solPix-RI(0,2),1,1,'#d8bf90');
      break; }
    case JOBS.mine: {                     // le pic, même cycle, plus bas
      const up=bat>0;
      const hx=mx+s*4, hy=cy-(up?Math.round(haut*0.58):-2);
      manche(mx,cy,hx,hy);
      trait(g,hx-s*3,hy,hx+s*3,hy+2,NOIR,2);
      trait(g,hx-s*3,hy-1,hx+s*3,hy+1,FER,2);
      fr(g,hx+s*3,hy+1,2,1,FERC);
      if(!up&&rnd()<0.4) fr(g,hx+s*3,hy+RI(1,3),1,1,'#c9c3b4');
      break; }
    case JOBS.forge: {                    // le marteau sur l'enclume
      const up=bat>0;
      const hx=mx+s*3, hy=cy-(up?Math.round(haut*0.5):-2);
      manche(mx,cy,hx,hy);
      tete(hx-2,hy-3,4,3,FER,FERC);
      if(!up) for(let k=0,n=RI(2,4);k<n;k++)
        fr(g,hx+RI(-2,2),hy+RI(1,3),1,1,pick(['#ffe6a8','#ffd07a','#ff9a3a']));
      break; }
    case JOBS.feu: {                       // le ringard et la braise
      const L=Math.max(6,Math.round(haut*0.6));
      manche(mx,cy,mx+s*L,cy+2+(bat>0?1:0),'#6a6e77');
      if(rnd()<0.5) fr(g,mx+s*L,cy+RI(0,3),1,1,pick(['#ff9a3a','#ffd07a']));
      break; }
    case JOBS.champs: {                    // la faux, qui balaie
      const a=bat*0.8;
      const L=Math.max(7,Math.round(haut*0.62));
      const tx=x+s*Math.round(L*Math.cos(a*0.6)), ty=cy+Math.round(L*0.42*Math.sin(a));
      manche(mx,cy,tx,ty);
      trait(g,tx+1,ty+1,tx+s*4+1,ty-2,NOIR,2);
      trait(g,tx,ty,tx+s*4,ty-3,FER,2);
      break; }
    case JOBS.elevage: {                   // le seau, qui se balance
      const by=cy+3+(bat>0?1:0);
      manche(mx,cy,mx+s*3,by-1);
      tete(mx+s*3-2,by,4,4,B2,'#c0996a');
      fr(g,mx+s*3-1,by+1,2,1,'#e8e4d6');
      break; }
    case JOBS.tissage: {                   // la navette, qui va et vient
      const dx2=Math.round(bat*3);
      tete(mx+s*2+dx2-2,cy,4,2,'#d8cdb4','#f0e8d4');
      trait(g,mx,cy+1,mx+s*2+dx2-2,cy+1,'rgba(216,205,180,.5)',1);
      break; }
    case JOBS.cuisine: {                   // la pelle à four
      const L=Math.max(5,Math.round(haut*0.52));
      manche(mx,cy,mx+s*L,cy-3);
      tete(mx+s*L+(s>0?0:-3),cy-5,3,4,B2,'#c0996a');
      break; }
    case JOBS.savoir: {                    // la plume, qui gratte
      const dy=bat>0?0:1;
      trait(g,mx+1,cy+1,mx+s*2+1,cy-4+dy,NOIR,2);
      trait(g,mx,cy,mx+s*2,cy-5+dy,'#e8e4d8',2);
      fr(g,mx+s*2,cy-6+dy,2,2,'#b0a898');
      break; }
    case JOBS.batisse: {                   // le maillet et la cheville
      const up=bat>0;
      const hx=mx+s*3, hy=cy-(up?Math.round(haut*0.45):-2);
      manche(mx,cy,hx,hy);
      tete(hx-2,hy-3,4,3,B2,'#c0996a');
      if(!up&&rnd()<0.35) fr(g,hx+RI(-2,2),hy+RI(2,4),1,1,'#d8c8a0');
      break; }
    case JOBS.guerre: {                    // la lance, au repos puis pointée
      const L=Math.max(9,Math.round(haut*1.1));
      manche(mx,cy+3,mx+s*Math.round(L*0.22),cy-L+3);
      tete(mx+s*Math.round(L*0.22)-1,cy-L,2,4,'#c9cdd2','#ffffff');
      break; }
  }
}
function majVillageois(dt){
  for(let i=0;i<vN;i++){
    if(vPause[i]>0){ vPause[i]-=dt; continue; }
    if(vCR[i]>=0){
      const cr=vCR[i];
      if(vR[i]!==cr){
        /* l'escalier qui relie l'étage courant au suivant dans la bonne
           direction — ESC[k] joint la rangée k et la rangée k+1 */
        vAct[i]=0;
        const k=Math.max(0,Math.min(2, vR[i]<cr ? vR[i] : cr));
        const ex=ESC[k], d=ex-vX[i];
        vV[i]=Math.abs(vV[i])*(d<0?-1:1);
        vX[i]+=vV[i]*dt*1.9;
        if(Math.abs(d)<2.6){ vR[i]=(vR[i]<cr)?vR[i]+1:vR[i]-1; vPause[i]=R(0.2,0.45); }
        continue;
      }
      const d=vCX[i]-vX[i];
      if(Math.abs(d)>2.5){
        vAct[i]=0;
        vV[i]=Math.abs(vV[i])*(d<0?-1:1);
        vX[i]+=vV[i]*dt*1.7;
      } else {
        vAct[i]=1;                                  // le geste du métier, sur place
        vX[i]+=Math.sin(tps*2.3+vPh[i])*dt*4;
        if(rnd()<dt*0.3) vV[i]=-vV[i];
      }
      continue;
    }
    vAct[i]=0;
    vX[i]+=vV[i]*dt;
    /* devant un escalier, une chance sur deux de le prendre : l'unité
       change d'étage sur place — c'est la volée qui explique le saut */
    for(let e2=0;e2<3;e2++){
      if(Math.abs(vX[i]-ESC[e2])<2.2&&rnd()<dt*2.2){
        if(vR[i]===e2+1){ vR[i]=e2;   vPause[i]=R(0.3,0.8); }
        else if(vR[i]===e2){ vR[i]=e2+1; vPause[i]=R(0.3,0.8); }
        break;
      }
    }
    if(vX[i]<3){vX[i]=3;vV[i]=Math.abs(vV[i]);}
    else if(vX[i]>W-6){vX[i]=W-6;vV[i]=-Math.abs(vV[i]);}
    if(rnd()<dt*0.05) vPause[i]=R(.6,3.4);
  }
}
function dessinerVillageoisRangee(r){
  if(!atlas)return;
  const {cellW,cellH}=atlasInfo;
  for(let i=0;i<vN;i++){
    if(vR[i]!==r) continue;
    const x=vX[i]|0;
    const marche=vPause[i]<=0;
    const f=marche?(((tps*7+vPh[i])|0)%NF_MARCHE):0;
    const d=vV[i]>0?1:0;
    const sx=(f*2+d)*cellW, sy=(r*TENUES.length+vT[i])*cellH;
    const hy=solY(r,x)+1-cellH+1;
    g.drawImage(atlas,sx,sy,cellW,cellH,x-(cellW>>1),hy,cellW,cellH);
    /* LE GESTE DU MÉTIER, seulement pour qui est arrivé à son poste. Un
       habitant sans affectation ne pêche pas, ne coupe pas de bois et ne
       bat pas le fer : il marche. */
    if(MONTRER_GESTES&&vAct[i]&&vJob[i]){
      const T3=atlasInfo.tailles[r];
      dessinerGeste(x,solY(r,x)+1,T3.h,vV[i]>=0?1:0,vJob[i],vPh[i]);
    }
    /* La nuit venue, un villageois sur cinq SORT SA TORCHE : le bâton est
       dessiné ici (il subit la teinte, comme le porteur), la flamme et son
       halo sont notés pour la passe additive — une flamme teintée ne
       brûlerait pas. La montée se fait au crépuscule : les torches
       s'allument l'une après l'autre, pas toutes au même instant. */
    if(vTor[i]&&NUIT>0.10){
      const allum=clamp((NUIT-0.10)/0.14,0,1);
      if(allum>((i*0.6180339)%1)*0.9){
        /* Le repère utile n'est pas la cellule d'atlas mais le CORPS qui vit
           dedans : centré en largeur, calé au bas de la cellule. On en déduit
           la main (mi-hauteur du buste) et on tient le manche OBLIQUE devant
           le porteur, la flamme dépassant la tête d'un rien — c'est le geste
           de qui s'éclaire en marchant. Le tout suit le tassement du pas. */
        const T2=atlasInfo.tailles[r];
        const bobF=marche?[0,1,0,1][f]:0;
        const haut=hy+cellH-T2.h-1+bobF;              // sommet réel de la tête
        const dir=vV[i]>=0?1:-1;
        const mx=x+dir*Math.max(1,Math.round(T2.w*0.34));
        const my=haut+Math.round(T2.h*0.52);          // la main, mi-buste
        const fx=x+dir*(Math.round(T2.w*0.5)+2);      // la flamme, devant et haut
        const fy=haut-2;
        trait(g,mx,my,fx,fy+3,'#4a3826',1);           // le manche, incliné
        fr(g,fx,fy+2,1,2,'#6b5134');                  // sa tête, sous la flamme
        fr(g,mx,my,1,1,'#2e2115');                    // la prise de la patte
        torchesMob.push({x:fx,y:fy,ph:i*1.7,gy:solY(r,x)+1});
      }
    }
  }
}

/* ------------------------------------------------------------------
   LE QUAI. Le premier plan était encombré : chaque pêcheur portait son
   ponton, le décor s'y invitait, les habitants y formaient une file. On
   fait le vide et on ne garde qu'un OUVRAGE, mais un vrai — un quai de
   bois continu sur pilotis, avec son platelage à joints décalés, sa
   longrine de rive, ses bittes d'amarrage, une échelle qui descend à
   l'eau, deux ou trois barques amarrées. Un seul objet lisible vaut mieux
   que trente petits, et il donne à la rivière une berge construite.
   ------------------------------------------------------------------ */
let QUAI=null;
function genererQuai(){
  const a=Math.round(W*R(0.06,0.16)), b=Math.round(W*R(0.84,0.95));
  const y=RIVER-Math.max(2,Math.round(H*0.012));
  const ep=Math.max(2,Math.round(H*0.007));
  const B=AMB.bois;
  const sp=sprite(b-a, (H-y));
  const c=sp.g, wq=b-a, hq=H-y;
  // pilotis : ils plongent dans l'eau, inclinés vers l'amont
  const pasP=Math.max(8,Math.round(W*0.035));
  for(let i=Math.round(pasP*0.5);i<wq;i+=pasP){
    const pen=(i%(pasP*2)===Math.round(pasP*0.5)%(pasP*2))?1:-1;
    const ph2=Math.max(4,Math.round(H*0.030));
    for(let j=0;j<ph2;j++){
      const xx=i+Math.round(pen*j*0.16);
      fr(c,xx,ep+j,Math.max(2,Math.round(H*0.005)),1, j>ph2*0.72?'#3f3427':'#5a4128');
      fr(c,xx,ep+j,1,1,'#7d5f3c');
    }
    // moise transversale
    fr(c,i-Math.max(2,Math.round(H*0.006)),ep+Math.round(H*0.012),
       Math.max(5,Math.round(H*0.016)),Math.max(1,Math.round(H*0.004)),'#4a3826');
  }
  // longrine de rive puis platelage
  fr(c,0,ep,wq,Math.max(1,Math.round(H*0.005)),'#4a3826');
  const lame=Math.max(4,Math.round(W*0.012));
  for(let i=0,k=0;i<wq;i+=lame,k++){
    const lw=Math.min(lame,wq-i)-1;
    if(lw<2) continue;
    const ton=rnd();
    const col= ton<0.30?'#8a6a45' : (ton<0.68?'#7d5f3c':'#6b5134');
    fr(c,i,0,lw,ep,col);
    fr(c,i,0,lw,1,clair(col,.18));
    fr(c,i+lw,0,1,ep,'#4a3826');
    if(chance(.30)) fr(c,i+RI(0,Math.max(0,lw-1)),RI(0,ep-1),1,1,ombre(col,.28));
    if(chance(.14)) fr(c,i+RI(0,Math.max(0,lw-1)),0,1,1,'#4e6b3a');     // mousse
  }
  fr(c,0,ep-1,wq,1,'rgba(12,16,24,.34)');
  // bittes d'amarrage et anneaux
  for(let i=Math.round(pasP*1.5);i<wq-pasP;i+=pasP*2){
    const bh=Math.max(3,Math.round(H*0.014));
    fr(c,i,-bh,Math.max(2,Math.round(H*0.006)),bh,'#6b5134');
    fr(c,i,-bh,Math.max(2,Math.round(H*0.006)),1,'#a8845a');
    fr(c,i-1,-bh+1,Math.max(4,Math.round(H*0.009)),1,'#4a3826');
    if(chance(.6)){                                        // cordage lové
      fr(c,i-2,-1,Math.max(4,Math.round(H*0.010)),1,'#9a9074');
      fr(c,i-1,-2,Math.max(3,Math.round(H*0.008)),1,'#b3a98c');
    }
  }
  // échelle qui descend à l'eau
  { const lx=Math.round(wq*R(0.25,0.75));
    const lh=Math.max(5,Math.round(H*0.028));
    fr(c,lx,ep,1,lh,'#6b5134'); fr(c,lx+Math.max(3,Math.round(H*0.008)),ep,1,lh,'#6b5134');
    for(let j=1;j<lh;j+=Math.max(2,Math.round(H*0.006)))
      fr(c,lx,ep+j,Math.max(4,Math.round(H*0.009)),1,'#8a6a45'); }
  QUAI={sp,x:a,y,w:wq,h:hq,barques:[]};
  // barques amarrées le long
  for(let k=0,n=0;k<n;k++)
    QUAI.barques.push({x:a+Math.round(R(wq*0.08,wq*0.92)), ph:rnd()*6.28,
                       l:Math.max(9,Math.round(W*0.022)), sens:chance(.5)?1:-1});
}
function dessinerQuai(){
  if(!QUAI) return;
  for(const b of QUAI.barques){                            // elles tanguent doucement
    const by=RIVER+Math.max(2,Math.round(H*0.012))+Math.round(Math.sin(tps*0.9+b.ph)*0.8);
    const l=b.l, x=b.x;
    fr(g,x,by+2,l,1,'rgba(16,40,56,.40)');
    fr(g,x+1,by-2,l-2,2,'#6a4c31');
    fr(g,x,by,l,2,'#5a4128');
    fr(g,x+1,by-2,l-2,1,'#8a6a45');
    for(let i=2;i<l-2;i+=Math.max(3,Math.round(l*0.28))) fr(g,x+i,by-2,Math.max(2,Math.round(l*0.14)),1,'#4a3826');
    if(b.sens>0){ fr(g,x+l-3,by-4,1,3,'#8a6a45'); fr(g,x+l-4,by-5,3,1,'#6a4c31'); }
    else        { fr(g,x+2,by-4,1,3,'#8a6a45'); fr(g,x+1,by-5,3,1,'#6a4c31'); }
    trait(g,x+(b.sens>0?l-1:0),by-1,x+(b.sens>0?l+3:-3),QUAI.y+2,'#9a9074',1);
  }
  g.drawImage(QUAI.sp.can,0,0,QUAI.w,QUAI.h,QUAI.x,QUAI.y,QUAI.w,QUAI.h);
}

/* ---------- PÊCHEURS ---------- */
let pecheurs=[], sauts=[];
/* Combien de pêcheurs tiennent le quai : c'est le JEU qui le dit, pas le
   décor. Sans poste de pêche tenu, la rivière est vide. */
let PECHEURS_ACTIFS=0;
function genererPecheurs(){
  pecheurs=[];
  const n=6;                             // un vivier de places : le jeu en allume autant qu'il a de pêcheurs
  for(let k=0;k<n;k++){
    const x=QUAI?Math.round(R(QUAI.x+QUAI.w*0.10,QUAI.x+QUAI.w*0.90))
                 :Math.round(R(W*0.06,W*0.94));
    pecheurs.push({
      x, tenue:RI(0,TENUES.length-1),
      dir:x<W/2?1:0,
      len:RI(Math.round(W*0.035),Math.round(W*0.07)),
      ph:rnd()*6.28,
      etat:0, timer:R(2,9), prise:0, ponton:false
    });
  }
}
function majPecheurs(dt){
  for(let i=0;i<Math.min(PECHEURS_ACTIFS,pecheurs.length);i++){
    const p=pecheurs[i];
    p.timer-=dt;
    if(p.timer<=0){
      if(p.etat===0){ p.etat=1; p.timer=R(.5,1.1); }        // ça mord
      else if(p.etat===1){ p.etat=2; p.timer=R(1.0,1.8); p.prise=1; }
      else { p.etat=0; p.prise=0; p.timer=R(4,12); }
    }
  }
}
function dessinerPecheurs(){
  if(PECHEURS_ACTIFS<=0) return;
  const {cellW,cellH}=atlasInfo;
  for(let i=0;i<Math.min(PECHEURS_ACTIFS,pecheurs.length);i++){
    const p=pecheurs[i];
    const bx=p.x, by=solY(3,p.x)+1;
    // ponton de bois
    if(p.ponton){
      const pw=Math.round(W*0.022);
      fr(g,bx-(pw>>1),RIVER-1,pw,3,AMB.bois[2]);
      fr(g,bx-(pw>>1),RIVER-1,pw,1,clair(AMB.bois[2],.2));
      fr(g,bx-(pw>>1)+1,RIVER+2,2,5,AMB.bois[1]);
      fr(g,bx+(pw>>1)-3,RIVER+2,2,5,AMB.bois[1]);
    }
    // corps (atlas, rangée 3, frame immobile)
    const sy=(3*TENUES.length+p.tenue)*cellH;
    g.drawImage(atlas,(0*2+p.dir)*cellW,sy,cellW,cellH,bx-(cellW>>1),by-cellH+1,cellW,cellH);
    // canne
    const hx=bx+(p.dir?3:-3), hy=by-9;
    const leve=p.etat===2?-6:0;
    const tipx=hx+(p.dir?p.len:-p.len), tipy=hy-Math.round(p.len*0.42)+leve;
    trait(g,hx,hy,tipx,tipy,'#5c4128',1);
    // ligne + flotteur
    const fx=tipx, fy=RIVER+3+Math.round(Math.sin(tps*2.2+p.ph)*1.2)+(p.etat===1?2:0);
    trait(g,tipx,tipy,fx,fy,'rgba(230,235,240,.55)',1);
    if(p.etat!==2){
      fr(g,fx-1,fy,2,2,'#c94a3c'); fr(g,fx-1,fy,2,1,'#e8e2d4');
      // ondes
      if(p.etat===1){ fr(g,fx-3,fy+2,7,1,mix(PAL.eau[0],'#cfe8f4',.5)); }
    } else {
      // poisson qui frétille au bout de la ligne
      const px2=fx, py2=fy-Math.round(10+Math.sin(tps*9)*2);
      fr(g,px2-2,py2,5,2,'#9fb6bd'); fr(g,px2+3,py2-1,2,4,'#8aa2a9');
      fr(g,px2-2,py2,3,1,'#c3d3d8');
    }
  }
}

/* ==================================================================
   11. PARTICULES — pool en typed arrays
   ================================================================== */
const PMAX=2200;
const pX=new Float32Array(PMAX),pY=new Float32Array(PMAX),
      pVX=new Float32Array(PMAX),pVY=new Float32Array(PMAX),
      pA=new Float32Array(PMAX),pL=new Float32Array(PMAX),
      pT=new Uint8Array(PMAX),pS=new Float32Array(PMAX);
let pN=0;
/* 0 fumée grise · 1 fumée noire · 2 fumée verte · 3 vapeur · 4 étincelle
   5 poussière · 6 feuille · 7 pollen · 8 luciole · 9 éclaboussure */
const PCOL=[['#cfcabe','#a9a79f'],['#4a4a4d','#2e2e30'],['#7fe0ac','#3f9c6e'],
            ['#f0efe8','#cdd4d6'],['#ffd27a','#ff8a2a'],['#cbbfa6','#a89b82'],['#7fa04b','#5f7a34'],
            ['#fff2c8','#e6d79c'],['#d8ff9e','#8fe05a'],['#e2f2fa','#a8cde0'],
            /* 10-12 : les trois cheminées de l'alchimiste */
            ['#e88ad6','#a8459a'],['#96ec7e','#4f9c46'],['#86c6ec','#3f6f9c'],
            /* 13 : fumée de forge, chargée de suie et encore tiède d'escarbilles */
            ['#c9895a','#5a4034'],
            /* 14 : vapeur de fonderie, soufrée */
            ['#d8cf9a','#7d7550']];
function emettre(x,y,vx,vy,vie,type,taille){
  if(pN>=PMAX) return;
  const i=pN++;
  pX[i]=x;pY[i]=y;pVX[i]=vx;pVY[i]=vy;pA[i]=0;pL[i]=vie;pT[i]=type;pS[i]=taille||1;
}
function poussiere(x,y,w){
  for(let i=0;i<16;i++) emettre(x+R(-w/2,w/2),y-R(0,4),R(-18,18),R(-30,-8),R(.4,1.0),5,1);
}
function majParticules(dt){
  for(let i=pN-1;i>=0;i--){
    pA[i]+=dt;
    if(pA[i]>=pL[i]){ pN--; if(i!==pN){ pX[i]=pX[pN];pY[i]=pY[pN];pVX[i]=pVX[pN];pVY[i]=pVY[pN];
      pA[i]=pA[pN];pL[i]=pL[pN];pT[i]=pT[pN];pS[i]=pS[pN]; } continue; }
    const t=pT[i];
    pX[i]+=pVX[i]*dt; pY[i]+=pVY[i]*dt;
    if(t<=3||t>=10){ pX[i]+=Math.sin(tps*1.4+pY[i]*0.17)*dt*10; pVY[i]*=0.975; }
    else if(t===4){ pVY[i]+=90*dt; pVX[i]*=0.97; }
    else if(t===5){ pVY[i]+=45*dt; }
    else if(t===6){ pX[i]+=Math.sin(tps*2+pY[i]*0.3)*dt*14; pVY[i]=Math.min(14,pVY[i]+8*dt); }
    else if(t===7){ pX[i]+=Math.sin(tps*0.6+pY[i]*0.09)*dt*11; pVY[i]=Math.sin(tps*0.44+pX[i]*0.04)*4; }
    else if(t===8){ pX[i]+=Math.sin(tps*1.5+pY[i]*0.21)*dt*17; pVY[i]=Math.sin(tps*0.9+pX[i]*0.08)*8; }
    else { pVY[i]+=150*dt; pVX[i]*=0.985; }        // gouttes d'eau
  }
}
/* Deux passes : la matière (fumées, poussières, feuilles) en fondu normal,
   puis ce qui ÉMET de la lumière (étincelles, pollen au soleil, lucioles)
   en composition additive — sinon les lucioles ressemblent à des grains
   de riz posés sur la nuit. */
function dessinerParticules(){
  for(let i=0;i<pN;i++){
    const t=pT[i]; if(t===4||t===7||t===8) continue;
    const k=pA[i]/pL[i];
    let s=pS[i];
    if(t<=3||t>=10) s=Math.max(1,Math.round(1+k*3.1*pS[i]));
    // opacité relevée : au-dessus d'un ciel clair, une fumée à moitié
    // transparente disparaît purement et simplement
    g.globalAlpha = (t<=3||t>=10) ? (1-k*0.82)*(t===1?0.78:0.70) : (1-k)*0.85;
    g.fillStyle=PCOL[t][k<0.45?0:1];
    g.fillRect(pX[i]|0,pY[i]|0,s,s);
  }
  g.globalCompositeOperation='lighter';
  for(let i=0;i<pN;i++){
    const t=pT[i]; if(t!==4&&t!==7&&t!==8) continue;
    const k=pA[i]/pL[i];
    const pul = t===8 ? (0.30+0.70*Math.abs(Math.sin(tps*2.4+pX[i]*0.27))) :
                t===7 ? (0.55+0.45*Math.sin(tps*1.7+pY[i]*0.4)) : 1;
    const a=clamp((1-k)*(t===4?0.95:0.62)*pul,0,1);
    g.globalAlpha=a;
    g.fillStyle=PCOL[t][k<0.45?0:1];
    g.fillRect(pX[i]|0,pY[i]|0,pS[i],pS[i]);
    if(t===8&&pul>0.72){ g.globalAlpha=a*0.30; g.fillRect((pX[i]|0)-1,(pY[i]|0)-1,3,3); }
  }
  g.globalCompositeOperation='source-over';
  g.globalAlpha=1;
}
/* pollen le jour, feuilles emportées, lucioles la nuit */
function ambiance(dt,nuit){
  if(pN>PMAX-150) return;
  if(nuit<0.42){
    if(rnd()<dt*20){
      const x=R(ZONE.ville[0],ZONE.ville[1]), r=RI(1,2);
      emettre(x,solY(r,x)-R(4,28),R(-5,5),0,R(4,9),7,1);
    }
    if(rnd()<dt*6){
      const x=R(ZONE.foret[0]-W*0.06,W-2);
      emettre(x,solY(RI(0,2),x)-R(12,42),R(-18,-5),R(2,8),R(3.5,6.5),6,1);
    }
  } else if(rnd()<dt*15){
    const bord=chance(.5);
    const x=bord?R(4,W-4):R(ZONE.foret[0]-W*0.08,W-2);
    const y=bord?RIVER-R(2,18):solY(RI(1,2),x)-R(4,24);
    emettre(x,y,R(-4,4),0,R(4,9),8,1);
  }
}

/* ==================================================================
   12. CIEL : nuages, oiseaux, astres, cycle jour/nuit
   ================================================================== */
let nuages=[], oiseaux=[], barques=[], etoiles=[];
let lucioles=[], filante=null;
/* La nuit était opaque : un multiply à #28325c mange les trois quarts de la
   lumière, et tout ce que le bourg raconte disparaissait entre minuit et
   l'aube. Une nuit de PIXEL ART est une convention : bleue, lisible, avec
   des lumières chaudes qui portent. On remonte donc la teinte de minuit
   d'un bon tiers et on plafonne le facteur de nuit à 0,93 — il reste assez
   d'obscurité pour que les fenêtres flambent, plus assez pour aveugler. */
const CLES=[
  {t:0.00,c:'#3d4a7e',n:0.93},{t:0.17,c:'#475488',n:0.86},
  {t:0.24,c:'#ff9a72',n:0.42},{t:0.32,c:'#ffe4c8',n:0.09},
  {t:0.50,c:'#ffffff',n:0.00},{t:0.68,c:'#ffe0ad',n:0.05},
  {t:0.77,c:'#ff8248',n:0.40},{t:0.85,c:'#75689e',n:0.76},
  {t:1.00,c:'#3d4a7e',n:0.93}
];
function teinte(t){
  for(let i=0;i<CLES.length-1;i++){
    const a=CLES[i],b=CLES[i+1];
    if(t>=a.t&&t<=b.t){const k=(t-a.t)/(b.t-a.t);return{c:mix(a.c,b.c,k),n:a.n+(b.n-a.n)*k};}
  }
  return {c:'#ffffff',n:0};
}
/* ------------------------------------------------------------------
   NUAGES
   Empiler des rectangles donnait des briques. Un cumulus se dessine en
   fait comme un TERRAIN : on additionne des bosses circulaires pour
   obtenir un profil de cime, puis on remplit chaque colonne de cette
   cime jusqu'à une base presque plate. Trois tons — crête au soleil,
   corps, ventre gris — et une frange tramée en dessous, parce que la
   base d'un cumulus s'effiloche au lieu de se couper net.
   Le nuage est cuit UNE fois dans son propre petit canvas : la boucle
   n'en fait qu'un drawImage.
   ------------------------------------------------------------------ */
function cuireNuage(s){
  const bosses=[], n=RI(3,6);
  let x=0, pic=RI(0,Math.max(0,n-2)), hmax=0;
  for(let i=0;i<n;i++){
    const d=1-Math.abs(i-pic)/(n+1);
    const rx=Math.round((RI(4,7)+d*7)*s), ry=Math.round((RI(3,5)+d*8)*s);
    bosses.push({x:x+rx,ry,rx});
    hmax=Math.max(hmax,ry);
    x+=Math.round(rx*R(0.70,1.15));            // bourgeons resserrés : un cumulus, pas un banc de brume
  }
  const w=x+Math.round(12*s), h=hmax+Math.round(9*s);
  const sp=sprite(w,h), c=sp.g;
  const base=h-Math.round(3*s);
  const cime=new Int16Array(w).fill(base);
  for(const b of bosses){
    for(let i=-b.rx;i<=b.rx;i++){
      const j=b.x+i; if(j<0||j>=w) continue;
      const q=1-(i*i)/(b.rx*b.rx); if(q<=0) continue;
      const y=base-Math.round(b.ry*Math.sqrt(q));
      if(y<cime[j]) cime[j]=y;
    }
  }
  /* Base LÉGÈREMENT ondulée, jamais rectiligne — mais surtout jamais
     détachée : la frange tramée flottait deux pixels sous le nuage et
     donnait cette rangée de pointillés suspendus. Elle fait maintenant
     partie du corps, sur la dernière rangée pleine. */
  const fond=new Int16Array(w);
  for(let i=0;i<w;i++) fond[i]=base+Math.round(Math.sin(i*0.11)*1.4+Math.sin(i*0.31+1.7)*0.9);
  for(let i=0;i<w;i++){
    const top=cime[i]; if(top>=base) continue;
    const bo=fond[i], ep=bo-top;
    fr(c,i,top,1,ep,'#c8d6e4');                                 // ventre
    fr(c,i,top,1,Math.max(1,Math.round(ep*0.70)),'#e6edf4');    // corps
    fr(c,i,top,1,Math.max(1,Math.round(ep*0.26)),'#f8fbfd');    // crête
    fr(c,i,top,1,1,'#ffffff');
    // creux entre deux bourgeons : une ombre courte les sépare
    if(i>0&&cime[i-1]<top-1) fr(c,i,top,1,Math.max(1,Math.round(ep*0.34)),'#d2dde9');
    // dernier pixel du ventre, tramé une colonne sur deux : le bord s'effiloche
    if((i+((bo)|0))%2) fr(c,i,bo-1,1,1,'#bccbdb');
  }
  return sp.can;
}
function genererCiel(){
  nuages=[];
  const ech2=clamp(W/700,0.7,1.7);
  for(let i=0;i<9;i++){
    const s=R(.55,1.25)*ech2;
    nuages.push({x:R(-80,W),y:R(6,Math.max(10,HOR-Math.round(H*0.14))),v:R(1.2,4.0),s,can:cuireNuage(s)});
  }
  oiseaux=[];
  /* Les étoiles ne sont plus peintes avec le fond mais en additif APRÈS la
     teinte horaire — multipliées par un ciel de nuit elles s'éteignaient.
     Il faut donc les garder au-dessus de la ligne de crête, sinon elles
     scintilleraient à travers la montagne. */
  etoiles=[];
  for(let i=0;i<260;i++){
    const x=RI(0,W-1), y=RI(1,HOR-6);
    if(SKY && y>SKY[x]-2) continue;
    etoiles.push({x,y,i:R(.25,1),ph:rnd()*6.28,g:chance(.10)});
  }
  barques=[];
  for(let i=0;i<3;i++) barques.push({x:R(0,W),y:RIVER+Math.round((H-RIVER)*R(.25,.75)),
    v:R(4,8)*(chance(.5)?1:-1),ph:rnd()*6.28,L:RI(14,20)});
}

/* ==================================================================
   13. NOM ET RANG
   ================================================================== */
function nomBourg(){
  const a=['Castel','Mont','Ville','Roche','Beau','Fort','Bois','Val','Pierre','Chât','Haute','Clair','Vieux','Aigue','Puy','Sault','Grand','Neuf'];
  const b=['mont','fort','ville','court','val','lieu','roche','bourg','chastel','vigne','fontaine','pré','combe','sac','ac','anges','loup','fer'];
  const suff=['','','',' -le-Vieux',' -sur-Aube',' -en-Brenne',' -la-Tour',' -le-Comte',' -sur-Ource',' -le-Haut',' -aux-Forges'];
  const saints=['Saint-Alban','Saint-Loup','Saint-Méen','Sainte-Foy','Saint-Ours','Saint-Grat','Sainte-Enimie'];
  const n = chance(.18) ? pick(saints) : pick(a)+pick(b);
  return (n+pick(suff)).replace(' -','-');
}
const RANGS=[[0,'terre vierge'],[1,'hameau'],[5,'village'],[11,'bourg'],[19,'petite cité'],
             [28,'cité fortifiée'],[38,'capitale du comté'],[50,'cité franche']];
function majHud(){
  let r=RANGS[0][1];
  for(const[n,t]of RANGS) if(nbBatis>=n) r=t;
  RANG_COURANT = r;
  if(HOOK.hud) HOOK.hud({rang:r, batiments:nbBatis, habitants:vN});
}

/* ==================================================================
   14. GÉNÉRATION D'UNE CITÉ
   ================================================================== */
let graine=1, tps=0, jour=0.34, vitesseJour=1/130, tempsFige=false;
let auto=true, dernierAuto=0;


function nouvelleCite(seed){
  graine = seed||((Math.random()*1e9)|0);
  rnd=mulberry32(graine);
  calculerTaille();
  AMB={
    bois:pick([['#5c4128','#472f1d','#6d4e32','#31210f'],
               ['#54392a','#3f2820','#664833','#2b1a12'],
               ['#4e4033','#3a3026','#63523f','#282019']]),
    pierre:chance(.5)?PAL.pierreC:PAL.pierre,
    toits:(function(){const k=Object.keys(PAL.toits);const base=PAL.toits[pick(k)];
      return [base,base,PAL.toits[pick(k)],base,PAL.toits[pick(k)]];})(),
    blason:pick(PAL.blason)
  };
  batiments=[];decors=[];anims=[];lumieres=[];tournesolChamps=[];
  pN=0; vN=0; nbBatis=0; complet=false;
  vise=null; fermerFiche(); elSurvol.classList.remove('vu');

  cielCan=genererCielCan();
  fondCan=genererFond();
  genererEau();
  genererQuai();
  genererRoseaux();
  genererFlotants();
  genererEmplacements();
  genererCiel();
  genererRais();
  construireAtlas();
  genererPecheurs();

  // calques par rangée + calques dérivés (liserés, reflets)
  couches=[]; bordCan=[];
  for(let r=0;r<NR;r++){
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    c.getContext('2d').imageSmoothingEnabled=false;
    couches.push(c);
    const b=document.createElement('canvas'); b.width=W; b.height=H;
    b.getContext('2d').imageSmoothingEnabled=false;
    bordCan.push(b);
  }
  bordSale=true; refletSale=true;
  quaiCan=document.createElement('canvas'); quaiCan.width=W; quaiCan.height=H;
  quaiCan.getContext('2d').imageSmoothingEnabled=false;
  refletCan=document.createElement('canvas'); refletCan.width=W; refletCan.height=Math.max(1,H-RIVER);
  refletCan.getContext('2d').imageSmoothingEnabled=false;

  // forêt à droite et champ de bataille à gauche, posés sur les étages
  genererForet();
  genererBataille();

  /* moulin à eau : il enjambe la berge, on le pose AVANT le mobilier de
     quai pour qu'il choisisse librement son emplacement */
  const meSp=genMoulinEau();
  let meX=0;
  for(let essai=0;essai<24;essai++){
    meX=clamp(Math.round(R(ZONE.ville[0]+W*0.04,ZONE.ville[1]-W*0.04)-meSp.w/2),2,W-meSp.w-2);
    if(meX+meSp.w<PONT[0]-4||meX>PONT[1]+4) break;   // ne pas masquer le pont
  }
  batiments.push({sp:meSp,x:meX,y:solY(3,meX+(meSp.w>>1))+1,r:3,type:'moulinEau',ne:tps,cuit:false});

  // quai : pontons, tonneaux, filets
  /* La berge reste NUE : plus de tonneaux, caisses, séchoirs, meules de
     foin ni buissons semés en travers du premier plan. Ce calque ne sert
     plus qu'à deux choses, posées près du quai pour qu'il ait une raison
     d'exister : une pile de caisses à l'aplomb d'une bitte, et les anneaux
     de mousse au ras de l'eau. Tout le reste appartient au quai lui-même. */
  const qc=quaiCan.getContext('2d');
  if(QUAI){
    for(let k=0;k<2;k++){
      const x=clamp(Math.round(QUAI.x+QUAI.w*(k?0.86:0.12)+R(-6,6)),4,W-14);
      if(x>meX-8&&x<meX+meSp.w+8) continue;
      const sp=genObjet(chance(.6)?'caisses':'tonneaux',3);
      qc.globalAlpha=.2;qc.fillStyle='#181209';qc.fillRect(x-1,solY(3,x)-1,sp.w+2,2);qc.globalAlpha=1;
      qc.drawImage(sp.can,x-(sp.w>>1),solY(3,x)+1-sp.h);
    }
  }

  /* Le chat de pierre : un seul par bourg, planté sur la rangée du bas près
     du pont. Tiré au sort il ne sortait presque jamais ; c'est un repère,
     il se pose donc explicitement. */
  {
    const st=genObjet('statue',2);
    const sx=clamp(Math.round(PONT[1]+W*R(0.02,0.08)),2,W-st.w-2);
    decors.push({sp:st,x:sx,y:solY(2,sx+(st.w>>1))+1,r:2,ne:tps,cuit:false,type:'statue'});
  }
  // les escaliers réservent leur parcelle sur la rangée d'arrivée
  for(let r=0;r<3;r++){
    const lw=Math.max(10,Math.round(12*ech(r)));
    decors.push({sp:{w:lw,h:1,can:null,fenetres:[],lampes:[],drapeaux:[],fumees:[]},
                 x:ESC[r]-(lw>>1),y:solY(r+1,ESC[r])+1,r:r+1,ne:-99,cuit:true,vide:true});
    decors.push({sp:{w:lw,h:1,can:null,fenetres:[],lampes:[],drapeaux:[],fumees:[]},
                 x:ESC[r]-(lw>>1),y:solY(r,ESC[r])+1,r:r,ne:-99,cuit:true,vide:true});
  }
  // champs de tournesols posés avant les édifices : ils réservent leur parcelle
  for(let k=0;k<RI(2,3);k++) ajouterTournesols(RI(1,2),true);

  NOM_BOURG = NOM_BOURG || nomBourg();
  dernierAuto=tps;
  majPopulation(); majHud();
}

/* ==================================================================
   15. BOUCLE DE RENDU
   ================================================================== */
let fpsAcc=0, fpsN=0, fps=60, qualite=1;   // qualite 1 = pleine, 0 = allégée
const btnPerf={textContent:''};

function boucle(ts){
  requestAnimationFrame(boucle);
  const dt=Math.min(.05,((ts-(boucle.p||ts))||16)/1000); boucle.p=ts;
  tps+=dt;
  if(!tempsFige) jour=(jour+dt*vitesseJour)%1;

  // --- mesure et qualité adaptative ---
  fpsAcc+=dt; fpsN++;
  if(fpsAcc>0.75){
    fps=fpsN/fpsAcc; fpsAcc=0; fpsN=0;
    if(fps<34 && qualite===1) qualite=0;
    else if(fps>52 && qualite===0) qualite=1;
    btnPerf.textContent=Math.round(fps)+' i/s'+(qualite?'':' · éco');
  }

  if(HOOK.tick) HOOK.tick(dt, tps);

  const T=teinte(jour), nuit=T.n; NUIT=nuit; torchesMob.length=0;

  /* --- position du soleil : elle pilote la longueur et le sens des ombres,
         et le côté sur lequel s'allume le liseré de lumière rasante --- */
  const solJ=(jour>=0.24&&jour<=0.78);
  const uS=solJ?(jour-0.24)/0.54:0.5;
  const hauteurSol=solJ?Math.sin(Math.PI*uS):0;              // 0 rasant, 1 zénith
  const sensOmbre=solJ?(uS<0.5?1:-1):1;                      // le matin, l'ombre tombe à droite
  const lonOmbre=solJ?clamp(1.15-hauteurSol,0.12,1):0.55;
  const opOmbre =solJ?clamp(0.34*hauteurSol+0.10,0,0.42):0.10;

  /* ---------- 1. ciel ---------- */
  g.drawImage(cielCan,0,0);

  /* ---------- 2. astres : peints ENTRE le ciel et la terre. C'est ce
     sandwich qui leur fait passer derrière les crêtes au lever et au
     coucher, au lieu de flotter par-dessus la montagne. ---------- */
  const astreJour=(jour>=0.24&&jour<=0.78);
  const u=astreJour?(jour-0.24)/0.54:((jour>0.78?jour-0.78:jour+0.22)/0.46);
  const ax=Math.round(W*0.06+u*W*0.88);
  /* La course descend nettement plus bas que l'horizon graphique : l'astre
     doit AVOIR de la montagne à traverser avant de disparaître. */
  const ay=Math.round(HOR+Math.round(H*0.075)-Math.sin(Math.PI*u)*H*0.34);
  if(astreJour){
    g.globalAlpha=.10; disque(g,ax,ay,Math.round(H*0.055),'#ffe9a8');
    g.globalAlpha=.16; disque(g,ax,ay,Math.round(H*0.035),'#ffedb8'); g.globalAlpha=1;
    disque(g,ax,ay,Math.round(H*0.022),'#ffe9a8'); disque(g,ax,ay,Math.round(H*0.013),'#fffbe6');
  } else {
    g.globalAlpha=.09; disque(g,ax,ay,Math.round(H*0.042),'#dbe6ff');
    g.globalAlpha=.14; disque(g,ax,ay,Math.round(H*0.026),'#e4ecfb'); g.globalAlpha=1;
    const rr=Math.round(H*0.017);
    disque(g,ax,ay,rr,'#dfe7f5');
    fr(g,ax-2,ay-1,2,2,'#c3cede'); fr(g,ax+1,ay+1,2,2,'#c3cede'); fr(g,ax,ay-rr+1,1,1,'#c3cede');
  }

  /* ---------- 3. la terre par-dessus les astres ---------- */
  g.drawImage(fondCan.can,0,0);

  /* ---------- 3b. brume qui dérive au pied des chaînes ---------- */
  if(qualite){
    const aB=clamp(0.55*(1-nuit*0.6),0,0.55);
    if(aB>0.02){
      g.globalAlpha=aB;
      for(const b of brumesMonts){
        b.x+=b.v*dt;
        const bw=b.can.width;
        if(b.v>0&&b.x>W+4) b.x=-bw-4;
        if(b.v<0&&b.x<-bw-4) b.x=W+4;
        g.drawImage(b.can,Math.round(b.x),b.y);
      }
      g.globalAlpha=1;
    }
  }

  /* ---------- 4. nuages et oiseaux ---------- */
  for(const n of nuages){
    n.x+=n.v*dt*4.5;
    if(n.x>W+n.can.width+10){
      n.x=-n.can.width-R(20,140); n.y=R(6,Math.max(10,HOR-Math.round(H*0.14)));
      n.s=R(.55,1.25)*clamp(W/700,0.7,1.7); n.can=cuireNuage(n.s);
    }
    g.drawImage(n.can,Math.round(n.x),Math.round(n.y));
  }
  if(rnd()<dt*0.30 && oiseaux.length<32){
    const y=R(H*0.08,HOR-H*0.10), d=chance(.5)?1:-1, n=RI(3,7);
    for(let i=0;i<n;i++) oiseaux.push({x:(d>0?-10:W+10)-d*i*R(6,14),y:y+R(-8,8),v:d*R(16,28),ph:rnd()*6.28});
  }
  for(let i=oiseaux.length-1;i>=0;i--){
    const o=oiseaux[i]; o.x+=o.v*dt; o.y+=Math.sin(tps*1.3+o.ph)*dt*3;
    if(o.x<-24||o.x>W+24){oiseaux.splice(i,1);continue;}
    const f=Math.sin(tps*9+o.ph)>0?1:0;
    const x=Math.round(o.x),y=Math.round(o.y);
    fr(g,x,y,1,1,'#2e3540'); fr(g,x-1,y-f,1,1,'#2e3540'); fr(g,x+1,y-f,1,1,'#2e3540');
  }
  corbeaux();

  /* ---------- 4. cuisson des nouveaux édifices ---------- */
  for(const e of batiments){ if(!e.cuit && tps-e.ne>0.62){
    /* on note l'index avant cuisson pour ÉTIQUETER les animations et les
       lumières que l'édifice vient de déclarer : le jeu peut alors couper
       la fumée d'une forge éteinte ou allumer celle d'un four qui tourne. */
    const i0=anims.length, l0=lumieres.length;
    cuire(e);
    for(let i=i0;i<anims.length;i++) anims[i].bid=e.id;
    for(let i=l0;i<lumieres.length;i++) lumieres[i].bid=e.id;
  } }
  for(const e of decors){    if(!e.cuit && tps-e.ne>0.34) cuire(e); }

  /* ---------- 5. ombres des nuages qui balaient les prés ---------- */
  if(qualite && nuit<0.72){
    g.globalCompositeOperation='multiply';
    for(const n of nuages){
      const ox=Math.round(n.x*1.9-W*0.30), lw=Math.round(n.can.width*0.85);
      if(ox>W||ox+lw<0) continue;
      g.globalAlpha=clamp(0.13*(1-nuit)*n.s,0,0.16);
      g.fillStyle='#8fa0b8';
      const y0=SOL[0][clamp(ox,0,W-1)]-Math.round(H*0.02);
      g.fillRect(ox,y0,lw,RIVER-y0);
      g.globalAlpha=clamp(0.07*(1-nuit)*n.s,0,0.10);
      g.fillRect(ox-Math.round(lw*0.25),y0,Math.round(lw*1.5),RIVER-y0);
    }
    g.globalAlpha=1; g.globalCompositeOperation='source-over';
  }

  /* ---------- 6. rangées : ombres portées + calque cuit + chantier + foule ---------- */
  majVillageois(dt);
  for(let r=0;r<3;r++){
    ombresRangee(r,sensOmbre,lonOmbre,opOmbre);
    g.drawImage(couches[r],0,0);
    // champs de tournesols de cette rangée (cycle de frames pré-cuites)
    for(const t of tournesolChamps){
      if(t.r!==r)continue;
      const f=((tps*3.5+t.ph*2)|0)%t.frames.length;
      g.drawImage(t.frames[f],t.x,t.y-t.h);
    }
    // éléments encore en construction (montée depuis le sol)
    for(const e of batiments){
      if(e.r!==r||e.cuit)continue;
      const p=clamp((tps-e.ne)/0.62,0,1), ep=1-Math.pow(1-p,3);
      const vis=Math.max(1,Math.round(e.sp.h*ep));
      g.globalAlpha=.2;g.fillStyle='#181209';g.fillRect(e.x-1,e.y-2,e.sp.w+2,2);g.globalAlpha=1;
      g.drawImage(e.sp.can,0,e.sp.h-vis,e.sp.w,vis,e.x,e.y-vis,e.sp.w,vis);
    }
    for(const e of decors){
      if(e.r!==r||e.cuit||e.vide)continue;
      const p=clamp((tps-e.ne)/0.34,0,1), ep=1-Math.pow(1-p,3);
      const vis=Math.max(1,Math.round(e.sp.h*ep));
      g.drawImage(e.sp.can,0,e.sp.h-vis,e.sp.w,vis,e.x,e.y-vis,e.sp.w,vis);
    }
    dessinerAnims(r,dt);
    dessinerVillageoisRangee(r);
  }

  /* ---------- 7. quai, eau, reflets, barques, pêcheurs ---------- */
  ombresRangee(3,sensOmbre,lonOmbre,opOmbre*0.8);
  g.drawImage(quaiCan,0,0);
  g.drawImage(couches[3],0,0);
  for(const e of decors){
    if(e.r!==3||e.cuit||e.vide)continue;
    const p=clamp((tps-e.ne)/0.34,0,1), ep=1-Math.pow(1-p,3);
    const vis=Math.max(1,Math.round(e.sp.h*ep));
    g.drawImage(e.sp.can,0,e.sp.h-vis,e.sp.w,vis,e.x,e.y-vis,e.sp.w,vis);
  }
  dessinerAnims(3,dt);
  dessinerVillageoisRangee(3);
  const ef=((tps*EAU_IPS)|0)%NEAU;
  g.drawImage(eauFrames[ef],0,RIVER);

  /* reflets : le calque miroir est redessiné en tranches horizontales
     décalées par une sinusoïde — c'est le décalage progressif, pas le
     flou, qui donne l'impression d'une surface qui bouge */
  if(qualite){
    if(refletSale) majReflet();
    const hh=H-RIVER, pas=3;
    for(let k=0;k<hh;k+=pas){
      const t=k/hh;
      const off=Math.round(Math.sin(tps*1.15+k*0.42)*(1.0+t*3.2));
      g.globalAlpha=clamp(0.46*(1-t*0.80),0,1);
      g.drawImage(refletCan,0,k,W,pas,off,RIVER+k,W,pas);
    }
    g.globalAlpha=1;
  }
  // roseaux, nénuphars et bois flotté : bande d'avant-plan
  g.drawImage(roseauxFrames[((tps*ROS_IPS)|0)%NROS],0,ROSY);
  majFlotants(dt); dessinerFlotants();

  barques.length=0;
  for(const b of barques){
    b.x+=b.v*dt; if(b.x>W+24)b.x=-24; if(b.x<-24)b.x=W+24;
    const by=Math.round(b.y+Math.sin(tps*1.6+b.ph)*0.9), bx=Math.round(b.x);
    const av=b.v>0?1:0, L=b.L;
    // sillage : deux moustaches d'écume derrière l'étrave
    g.globalAlpha=.30;
    for(let k=1;k<=4;k++) fr(g,bx+(av?-k*3:L+k*3-2),by+4+((k*0.6)|0),3,1,'#cfe8f4');
    g.globalAlpha=1;
    fr(g,bx,by+6,L,1,'rgba(16,36,54,.42)');                 // ombre portée dans l'eau
    // coque : bordé, plat-bord clair, étrave relevée
    fr(g,bx,by+2,L,3,'#5a4128');
    fr(g,bx+1,by+1,L-2,1,'#7a5a3a');
    fr(g,bx,by+4,L,1,'#33261a');
    fr(g,bx+(av?L-2:0),by-1,2,5,'#6d4f33');                 // étrave
    fr(g,bx+(av?0:L-2),by,2,4,'#4a3521');                   // tableau arrière
    for(let i=2;i<L-2;i+=3) fr(g,bx+i,by+2,1,2,'#4a3521');  // membrures
    // mât, vergue et voile bombée
    const mx=bx+Math.round(L*0.42);
    fr(g,mx,by-11,1,12,'#3a2a1b');
    fr(g,mx-3,by-11,7,1,'#4a3521');
    const gonfle=Math.round(Math.sin(tps*1.1+b.ph)*1)+2;
    for(let j=0;j<7;j++){
      const wj=Math.max(2,Math.round(6*(0.5+0.5*Math.sin(j/6*3.14))))+gonfle;
      fr(g,av?mx+1:mx-wj,by-10+j,wj,1, j<2?'#efe7d2':(j<5?'#ded3ba':'#c2b79c'));
    }
    fr(g,av?mx+1:mx-2,by-10,1,7,'#f4eddc');
    // rameur + rame qui plonge
    const rx2=bx+Math.round(L*(av?0.22:0.72));
    fr(g,rx2,by-4,2,4,'#6b4b57'); fr(g,rx2,by-6,2,2,'#c9a882');
    fr(g,rx2,by-7,1,1,'#c9a882'); fr(g,rx2+1,by-7,1,1,'#c9a882');   // oreilles
    const rame=Math.round(Math.sin(tps*2.6+b.ph)*2);
    trait(g,rx2+(av?-1:2),by-3,rx2+(av?-5:6),by+3+rame,'#6b5236',1);
  }
  /* le saut du poisson : de loin en loin, un dos argenté crève la surface,
     décrit son arc et replonge dans deux gerbes. */
  if(rnd()<dt*0.30&&sauts.length<2)
    sauts.push({x:R(W*0.08,W*0.92),y:RIVER+R(4,Math.max(6,(H-RIVER)*0.5)),t:0,d:chance(.5)?1:-1});
  for(let i=sauts.length-1;i>=0;i--){
    const f2=sauts[i]; f2.t+=dt*1.1;
    if(f2.t>=1){ for(let k2=0;k2<5;k2++) emettre(f2.x+f2.d*16+R(-2,2),f2.y,R(-9,9),R(-18,-3),R(.35,.7),9,1);
                 fr(g,(f2.x+f2.d*16-2)|0,f2.y|0,5,1,'#e8f4fa');
                 sauts.splice(i,1); continue; }
    const u=f2.t, px2=f2.x+f2.d*u*16, py2=f2.y-Math.sin(u*Math.PI)*14;
    const pen=Math.cos(u*Math.PI)*f2.d;                         // il monte puis pique
    fr(g,px2|0,f2.y|0,4,1,'rgba(10,20,30,.30)');               // son ombre sur l'eau
    fr(g,px2|0,py2|0,4,2,'#9fb4c4');
    fr(g,px2|0,(py2+1)|0,4,1,'#7d95a8');                        // le ventre
    fr(g,(px2-f2.d*2)|0,(py2-pen*2)|0,2,2,'#7d95a8');           // la queue suit l'arc
    fr(g,(px2+f2.d*3)|0,py2|0,1,1,'#dce8f0');                   // le museau
    fr(g,(px2+f2.d)|0,(py2-1)|0,2,1,'#e8f2f8');                 // l'éclat du dos
    if(u<0.12) emettre(f2.x,f2.y,R(-4,4),R(-8,-2),R(.25,.4),9,1);
  }
  dessinerQuai();
  dessinerPecheurs();
  majPecheurs(dt);

  /* ---------- 10. particules ---------- */
  majParticules(dt);
  dessinerParticules();

  /* ---------- 11. teinte horaire ---------- */
  if(T.c!=='#ffffff'){
    g.globalCompositeOperation='multiply';
    g.fillStyle=T.c; g.fillRect(0,0,W,H);
    g.globalCompositeOperation='source-over';
  }
  const cr=Math.max(0,1-Math.abs(jour-0.25)/0.09), co=Math.max(0,1-Math.abs(jour-0.755)/0.10);
  const chaud=Math.max(cr,co);
  if(chaud>0){
    for(let i=0;i<10;i++){
      const y=HOR-i*Math.round(H*0.026);
      g.fillStyle='rgba(255,'+(120+i*7)+',70,'+(chaud*0.12*(1-i/10)).toFixed(3)+')';
      g.fillRect(0,y-Math.round(H*0.026),W,Math.round(H*0.026)+1);
    }
    g.globalCompositeOperation='lighter';
    sentierAstre(ax,cr>co?'#ff9f5a':'#ff8a48',chaud*0.34);
    if(qualite) raisSoleil(ax,ay,chaud,cr>co?'#ffd9a8':'#ffc48a');
    g.globalAlpha=1; g.globalCompositeOperation='source-over';
  }
  /* Lumière rasante sur les silhouettes : braise orange à l'aube et au
     couchant, bleu de lune au cœur de la nuit. Le calque d'arêtes n'est
     recuit que quand l'astre change de bord ou de couleur — deux fois
     par journée de jeu, autant dire jamais. */
  {
    const sens=(jour<0.5)?-1:1;
    let col=null, inten=0;
    if(chaud>0.05){ col='#ff9a4a'; inten=chaud*0.44; }
    else if(nuit>0.55){ col='#5a80c4'; inten=(nuit-0.55)/0.45*0.30; }
    if(col && qualite){
      if(bordSale||bordSens!==sens||bordCol!==col) majBords(sens,col);
      g.globalCompositeOperation='lighter';
      g.globalAlpha=clamp(inten,0,1);
      for(let r=0;r<NR;r++) g.drawImage(bordCan[r],0,0);
      g.globalAlpha=1; g.globalCompositeOperation='source-over';
    }
  }

  /* ---------- 11b. scintillement des vitres au soleil ----------
     Au plein du jour, une vitre prend le soleil et le renvoie : un pixel
     blanc, rare et bref — c'est lui qui fait le verre. */
  if(qualite && solJ && hauteurSol>0.25){
    g.globalCompositeOperation='lighter';
    g.fillStyle='#fff6da';
    for(let i=0;i<lumieres.length;i+=2){
      const l=lumieres[i];
      if(l.lampe||l.w<3) continue;
      const s=Math.sin(tps*0.9+l.ph*9.1);
      if(s<0.992) continue;
      g.globalAlpha=clamp((s-0.992)/0.008,0,1)*0.75*(1-nuit);
      g.fillRect(l.x+1,l.y+1,1,1);
      g.fillRect(l.x+l.w-2,l.y+1,1,1);
    }
    g.globalAlpha=1; g.globalCompositeOperation='source-over';
  }

  /* ---------- 12. lumières additives ---------- */
  if(nuit>0.04){
    /* De la vie derrière les vitres : une ombre chinoise traverse de temps
       à autre une fenêtre allumée. Elle est SOMBRE, donc peinte en fondu
       normal avant de passer en additif — c'est ce qui la fait lire comme
       quelqu'un devant la lampe, et non comme une tache de plus. */
    if(nuit>0.32){
      g.fillStyle='#2a1a10';
      for(let i=0;i<lumieres.length;i++){
        const l=lumieres[i];
        if(l.lampe||!l.on||l.w<3||l.h<4) continue;
        const cyc=(tps*0.42+l.ph*2.7)%11;
        if(cyc>1.9) continue;
        const p=cyc/1.9;
        const sx=Math.round(l.x-1+p*(l.w+2));
        if(sx<l.x||sx>=l.x+l.w) continue;
        const hh=Math.max(2,Math.round(l.h*0.62));
        const bob=(p*7|0)%2;
        g.globalAlpha=clamp(nuit*0.80,0,1);
        g.fillRect(sx,l.y+l.h-hh+bob,Math.min(2,l.w),hh-bob);
        g.fillRect(sx,l.y+l.h-hh-1+bob,1,1);                 // oreille
        if(l.w>=4) g.fillRect(sx+1,l.y+l.h-hh-1+bob,1,1);
      }
      g.globalAlpha=1;
    }
    g.globalCompositeOperation='lighter';
    // étoiles et halo de lune : additifs, donc insensibles à la teinte
    if(nuit>0.10){
      for(let i=0;i<etoiles.length;i++){
        const s=etoiles[i];
        const a=nuit*s.i*(0.45+0.55*Math.sin(tps*1.7+s.ph));
        if(a<0.05)continue;
        g.globalAlpha=clamp(a,0,1);
        g.fillStyle='#dfeaff'; g.fillRect(s.x,s.y,1,1);
        if(s.g&&a>0.55){                       // les plus vives ont une croisée
          g.globalAlpha=clamp(a*0.34,0,1);
          g.fillRect(s.x-1,s.y,1,1); g.fillRect(s.x+1,s.y,1,1);
          g.fillRect(s.x,s.y-1,1,1); g.fillRect(s.x,s.y+1,1,1);
        }
      }
      /* Halo de lune. Il est additif, donc peint APRÈS la terre : il faut
         l'éteindre à mesure que la lune s'enfonce derrière la crête, sinon
         elle brillerait au travers de la montagne. */
      if(!astreJour){
        const vis=clamp((SKY[clamp(ax,0,W-1)]-ay)/(H*0.06),0,1);
        if(vis>0.02){
          g.globalAlpha=clamp(nuit*0.10*vis,0,1);
          disque(g,ax,ay,Math.round(H*0.042),'#c9d8f4');
          g.globalAlpha=clamp(nuit*0.55*vis,0,1);
          disque(g,ax,ay,Math.round(H*0.017),'#e8eefb');
        }
        sentierAstre(ax,'#b7cdf0',nuit*0.30*clamp(vis+0.25,0,1));
      }
    }
    for(let i=0;i<lumieres.length;i++){
      const l=lumieres[i];
      if(l.lampe){
        const sc2=l.pt?(0.55+0.30*Math.sin(tps*8.5+l.ph)+0.15*Math.sin(tps*23+l.ph*7))
                      :(0.72+0.28*Math.sin(tps*6.5+l.ph));
        g.globalAlpha=clamp(nuit*sc2*0.85,0,1);
        g.fillStyle=l.c;
        if(l.pt){ g.fillRect(l.x,l.y,1,1);
                  g.globalAlpha=clamp(nuit*sc2*0.5,0,1);
                  g.fillRect(l.x,l.y-1,1,1); }
        else g.fillRect(l.x-1,l.y-1,3,3);
        if(qualite){
          const rad=Math.max(l.pt?4:5,l.rad*1.5);
          g.globalAlpha=clamp(nuit*sc2*(l.pt?0.40:0.50),0,1);
          g.drawImage(halo(l.c),l.x-rad,l.y-rad,rad*2,rad*2);
          /* et sa flaque, si la source est proche du sol : une lanterne de
             porche éclaire le seuil, un brasier de sommet de tour n'éclaire
             pas le pied de la tour. */
          const gy=solY(l.r,l.x)+1, dy=gy-l.y;
          if(dy>0&&dy<Math.round(H*0.07)){
            const rw=Math.max(9,l.rad+2);
            g.globalAlpha=clamp(nuit*sc2*0.38,0,1);
            g.drawImage(halo(l.c),l.x-rw,gy-Math.round(rw*0.42)-1,rw*2,Math.round(rw*0.84));
          }
        }
      } else {
        if(!l.on)continue;
        /* Une vitre allumée n'est pas un aplat : la lampe est DANS la pièce,
           posée bas — le bas de la baie est donc plus chaud et plus vif, le
           haut plus sourd, et le point le plus brillant est un cœur d'un ou
           deux pixels au tiers inférieur. Trois passes : voile, cœur bas,
           point de la flamme ; et le halo se cale sur le bas de la baie, pas
           sur son centre. Le scintillement est double : une respiration
           lente et un tremblement bref, comme une flamme réelle. */
        const sc2=0.78+0.16*Math.sin(tps*1.7+l.ph)+0.06*Math.sin(tps*9.3+l.ph*3.1);
        const col=l.vitrail?'#ffb060':'#ffc772';
        const colBas=l.vitrail?'#ffcf8e':'#ffe2a4';
        g.fillStyle=col;
        g.globalAlpha=clamp(nuit*sc2*0.80,0,1);
        g.fillRect(l.x,l.y,l.w,l.h);
        const hb=Math.max(1,Math.round(l.h*0.45));
        g.fillStyle=colBas;
        g.globalAlpha=clamp(nuit*sc2*0.72,0,1);
        g.fillRect(l.x,l.y+l.h-hb,l.w,hb);
        if(l.w>=3&&l.h>=4){
          g.fillStyle='#fff2cc';
          g.globalAlpha=clamp(nuit*sc2*0.85,0,1);
          g.fillRect(l.x+(l.w>>1)-1+((Math.sin(tps*7.1+l.ph*5)>0.6)?1:0),
                     l.y+l.h-Math.max(2,Math.round(l.h*0.34)),2,2);
        }
        if(qualite){
          const rad=Math.max(6,Math.round((l.w+l.h)*1.05));
          g.globalAlpha=clamp(nuit*sc2*0.46,0,1);
          g.drawImage(halo(col),l.x+(l.w>>1)-rad,l.y+l.h-Math.round(rad*1.15),rad*2,rad*2);
          /* la baie du rez projette sa clarté sur le pavé : flaque douce,
             un peu plus large que la fenêtre, jamais pour les étages. */
          const gy=solY(l.r,l.x+(l.w>>1))+1, dy=gy-(l.y+l.h);
          if(dy>=0&&dy<Math.round(H*0.045)){
            const rw=Math.max(8,Math.round((l.w+l.h)*0.85));
            g.globalAlpha=clamp(nuit*sc2*0.26,0,1);
            g.drawImage(halo(col),l.x+(l.w>>1)-rw,gy-Math.round(rw*0.42)-1,rw*2,Math.round(rw*0.84));
          }
        }
      }
    }
    /* les torches portées : cœur vif, langue jaune, halo qui suit le pas.
       Le vacillement est plus nerveux que celui des lanternes — une flamme
       à l'air libre, secouée par la marche. */
    for(const t of torchesMob){
      const sc2=0.55+0.30*Math.sin(tps*10+t.ph)+0.15*Math.sin(tps*27+t.ph*3);
      const fy=t.y;
      g.globalAlpha=clamp(nuit*sc2*0.95,0,1);
      g.fillStyle='#ff9a3a'; g.fillRect(t.x-1,fy-1,3,3);
      g.fillStyle='#ffd88a'; g.fillRect(t.x,fy-1,1,2);
      g.globalAlpha=clamp(nuit*sc2*0.7,0,1);
      g.fillStyle='#fff2cc'; g.fillRect(t.x,fy-2,1,1);
      if(qualite){
        g.globalAlpha=clamp(nuit*sc2*0.45,0,1);
        g.drawImage(halo('#ffb347'),t.x-11,fy-11,22,22);
        /* la lumière PROJETÉE : une flaque chaude écrasée au sol, sous la
           flamme donc un pas devant le porteur — elle marche avec lui et
           vacille au même rythme. C'est elle qui « pose » la torche. */
        const rw=14;
        g.globalAlpha=clamp(nuit*sc2*0.50,0,1);
        g.drawImage(halo('#ffb347'),t.x-rw,t.gy-Math.round(rw*0.42)-1,rw*2,Math.round(rw*0.84));
      }
    }
    /* cônes de lumière : ce qui sort d'une fenêtre doit se poser quelque
       part. Un trapèze qui s'évase vers le bas suffit à donner l'épaisseur
       de l'air — sans lui, les fenêtres allumées flottent. */
    if(qualite && nuit>0.30){
      for(let i=0;i<lumieres.length;i+=2){
        const l=lumieres[i];
        if(!(l.on||l.lampe))continue;
        const bw=l.lampe?3:l.w, bh=l.lampe?2:l.h;
        g.fillStyle=l.lampe?l.c:(l.vitrail?'#ffa858':'#ffc06a');
        for(let j=1;j<=5;j++){
          g.globalAlpha=clamp(nuit*0.042*(1-j/6.5),0,1);
          g.fillRect(l.x-j-1,l.y+bh+(j-1)*2,bw+2*j+2,2);
        }
      }
    }
    // reflets sur la rivière
    if(qualite){
      g.fillStyle='#ffb861';
      for(let i=0;i<lumieres.length;i+=3){
        const l=lumieres[i];
        if(l.r<2||!(l.on||l.lampe))continue;
        for(let y=RIVER+2;y<H;y+=3){
          g.globalAlpha=clamp(nuit*0.07*(1-(y-RIVER)/(H-RIVER)),0,1);
          g.fillRect(l.x-2+Math.round(Math.sin(tps*1.2+y*0.6)*1.8),y,4,1);
        }
      }
    }
    g.globalAlpha=1;
    g.globalCompositeOperation='source-over';
  }

  /* ---------- 12b. lucioles et étoiles filantes ----------
     La nuit d'été : des lucioles clignotent en lisière et sur le quai, et
     parfois une étoile file au-dessus des crêtes. */
  if(nuit>0.5){
    if(lucioles.length<24 && rnd()<dt*8){
      const foret=chance(.6);
      const x=foret?R(ZONE.foret[0]-W*0.05,W-2):R(4,W-4);
      const y=foret?solY(RI(1,2),x)-R(2,20):RIVER-R(2,14);
      lucioles.push({x,y,ph:rnd()*6.28});
    }
    g.globalCompositeOperation='lighter';
    g.fillStyle='#d9f09a';
    for(const f of lucioles){
      f.x+=Math.sin(tps*0.7+f.ph)*dt*6;
      f.y+=Math.cos(tps*0.9+f.ph*1.3)*dt*4;
      const bl=Math.max(0,Math.sin(tps*2.4+f.ph*5));
      const a=nuit*bl*bl*bl;
      if(a<0.04) continue;
      const fx=Math.round(f.x), fy=Math.round(f.y);
      g.globalAlpha=a; g.fillRect(fx,fy,1,1);
      if(a>0.5){ g.globalAlpha=a*0.35;
        g.fillRect(fx-1,fy,3,1); g.fillRect(fx,fy-1,1,3); }
    }
    g.globalAlpha=1; g.globalCompositeOperation='source-over';
  } else if(lucioles.length) lucioles.length=0;
  if(nuit>0.6){
    if(!filante && rnd()<dt*0.06)
      filante={x:R(W*0.15,W*0.85),y:R(H*0.04,H*0.22),
               vx:(chance(.5)?1:-1)*R(140,220),vy:R(26,60),t:0};
    if(filante){
      filante.t+=dt; filante.x+=filante.vx*dt; filante.y+=filante.vy*dt;
      const fade=Math.sin(Math.PI*clamp(filante.t/0.9,0,1));
      g.globalCompositeOperation='lighter';
      for(let k=0;k<7;k++){
        const tx=Math.round(filante.x-filante.vx*0.016*k);
        const ty=Math.round(filante.y-filante.vy*0.016*k);
        g.globalAlpha=fade*(1-k/7)*0.8;
        g.fillStyle=k<2?'#ffffff':'#cfdcf6';
        g.fillRect(tx,ty,1,1);
      }
      g.globalAlpha=1; g.globalCompositeOperation='source-over';
      if(filante.t>0.9) filante=null;
    }
  }
  /* ---------- 13. édifice survolé ---------- */
  dessinerSurvol();
  if(HOOK.rendu) HOOK.rendu(g,dt,tps);

  ambiance(dt,nuit);
}

/* ------------------------------------------------------------------
   OMBRES PORTÉES AU SOL
   Cuites dans le calque, elles seraient figées : c'est justement leur
   rotation au fil des heures qui fait vivre la lumière. On les redessine
   donc chaque frame, juste avant le calque de la rangée — quelques barres
   qui glissent dans le sens opposé au soleil et s'effacent en s'éloignant.
   ------------------------------------------------------------------ */
function ombresRangee(r,sens,lon,op){
  if(op<=0.012) return;
  g.fillStyle='#101c10';
  const trace=(x,y,w,h)=>{
    const L=Math.round(Math.min(h*0.40, 4+lon*h*0.34));
    const ep=Math.max(2,Math.min(9,Math.round(3+h*0.05)));
    for(let j=0;j<ep;j++){
      const t=(j+1)/ep;
      g.globalAlpha=op*(1-t*t);
      const off=Math.round(sens*L*t);
      const shr=Math.round(w*0.07*t);
      g.fillRect(x+shr+off,y+j-1,Math.max(1,w-2*shr),1);
    }
  };
  for(let i=0;i<batiments.length;i++){ const b=batiments[i];
    if(b.r===r&&b.cuit) trace(b.x,b.y,b.sp.w,b.sp.h); }
  for(let i=0;i<decors.length;i++){ const d=decors[i];
    if(d.r===r&&d.cuit&&!d.vide&&d.sp.h>7) trace(d.x,d.y,d.sp.w,d.sp.h); }
  g.globalAlpha=1;
}

/* ------------------------------------------------------------------
   HALOS
   Un carré translucide autour d'une fenêtre ne fait pas une lueur : il
   fait un carré. On cuit donc un vrai halo radial — une fois par teinte,
   dans un petit canvas de 32 px — dont l'opacité est QUANTIFIÉE en dix
   paliers. À l'agrandissement au plus proche voisin, ces paliers donnent
   des anneaux francs, c'est-à-dire une lueur qui reste en pixel art au
   lieu de baver. Une lumière = un drawImage.
   ------------------------------------------------------------------ */
const HALOS=new Map();
function halo(col){
  let h=HALOS.get(col);
  if(h) return h;
  const RR=16, sp=sprite(RR*2,RR*2), c=sp.g, rgb=h2r(col);
  for(let j=-RR;j<RR;j++) for(let i=-RR;i<RR;i++){
    const d=Math.sqrt(i*i+j*j)/RR;
    if(d>=1) continue;
    const a=Math.round(Math.pow(1-d,2.4)*10)/10;
    if(a<0.09) continue;
    c.fillStyle='rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+a+')';
    c.fillRect(RR+i,RR+j,1,1);
  }
  h=sp.can; HALOS.set(col,h); return h;
}

/* Rayons crépusculaires. Tracés en tranches horizontales empilées plutôt
   qu'en polygones tournés : une rotation de contexte réintroduirait
   l'antialiasing, et un seul bord flou suffit à trahir toute la grille.
   À appeler en composition additive. */
let RAIS=[];
function genererRais(){
  RAIS=[];
  for(let k=0;k<7;k++) RAIS.push({a:R(0.16,0.84)*Math.PI,o:R(0.10,0.30),l:R(0.55,1.15),v:R(-.02,.02)});
}
function raisSoleil(ax,ay,inten,col){
  if(inten<=0.02) return;
  g.fillStyle=col;
  const pas=Math.max(3,Math.round(H/48));
  for(let k=0;k<RAIS.length;k++){
    const r=RAIS[k], a0=r.a+Math.sin(tps*0.13+k)*0.035+r.v*tps*0.4, L=r.l*H;
    const ca=Math.cos(a0), sa=Math.sin(a0);
    for(let d=pas*2;d<L;d+=pas){
      const cy2=ay+sa*d; if(cy2>H) break;
      if(cy2<0) continue;
      const t=d/L, w2=Math.max(1,Math.round(d*r.o));
      const a=inten*0.05*(1-t)*(1-t);
      if(a<0.004) continue;
      g.globalAlpha=clamp(a,0,1);
      g.fillRect(Math.round(ax+ca*d-w2/2),Math.round(cy2),w2,pas);
    }
  }
  g.globalAlpha=1;
}

/* Sentier de lune (ou de soleil) sur l'eau. Une simple barre par ligne
   donne une échelle de perroquet : il faut la briser en deux ou trois
   éclats de largeurs inégales qui pulsent chacun de leur côté. À
   appeler en composition additive. */
function sentierAstre(cx,col,inten){
  if(inten<=0.01) return;
  g.fillStyle=col;
  for(let y=RIVER+1;y<H;y+=2){
    const t=(y-RIVER)/(H-RIVER);
    const lw=W*0.014+t*W*0.075;
    const n=1+((y*7)%3);
    for(let k=0;k<n;k++){
      const o=Math.sin(tps*1.15+y*0.83+k*2.1)*lw*0.42;
      const w2=Math.max(2,Math.round(lw*(0.14+0.22*(((y*13+k*29)%7)/7))));
      const a=inten*(1-t*0.70)*(0.35+0.65*Math.abs(Math.sin(tps*1.9+y*0.5+k*1.3)));
      if(a<0.02) continue;
      g.globalAlpha=clamp(a,0,1);
      g.fillRect(Math.round(cx-lw*0.5+o+k*lw*0.34),y,w2,1);
    }
  }
  g.globalAlpha=1;
}

/* ---------- animations liées aux édifices ---------- */
function dessinerAnims(r,dt){
  for(let i=0;i<anims.length;i++){
    const a=anims[i];
    if(a.r!==r)continue;
    /* UNE ROUE QUI TOURNE VEUT DIRE QUELQUE CHOSE. Les animations de
       travail — meule, roue, brasier, chaudron, poulie, quintaine, fumée —
       ne jouent que si l'édifice a bel et bien un ouvrier au poste. Un
       bourg à l'arrêt se voit à ses cheminées froides. */
    if(a.bid && TRAVAIL_ANIM[a.t] && !ACTIFS.has(a.bid)) continue;
    if(a.t==='moulin'){
      const m=a.d, hx=a.x, hy=a.y, a0=tps*m.v;
      /* L'aile nue n'était qu'un peigne de lattes : un moulin qui travaille
         porte sa TOILE, tendue sur le côté conduit de la verne. On la peint
         en pinceaux serrés perpendiculaires au bras, du quart à la pointe,
         éclairée quand l'aile monte face au jour, ombrée quand elle plonge —
         et l'on garde deux lattes visibles au bord de fuite, qui disent la
         structure sous l'étoffe. */
      for(let k=0;k<m.n;k++){
        const ang=a0+k*Math.PI*2/m.n;
        const ca=Math.cos(ang),sa=Math.sin(ang);
        trait(g,hx,hy,hx+ca*m.r,hy+sa*m.r,'#3d2c1e',2);
        {   // toutes les ailes sont gréées : la verticale disparaissait
          const tcol = sa<-0.25 ? '#f0e8d4' : (sa>0.45 ? '#c9bfa6' : '#e0d7bf');
          for(let s2=Math.round(m.r*0.24);s2<m.r-1;s2+=2){
            const qx=hx+ca*s2, qy=hy+sa*s2;
            trait(g,qx,qy,qx-sa*m.r*0.15,qy+ca*m.r*0.15,tcol,2);
          }
          trait(g,hx+ca*m.r*0.24-sa*m.r*0.16,hy+sa*m.r*0.24+ca*m.r*0.16,
                  hx+ca*m.r*0.98-sa*m.r*0.16,hy+sa*m.r*0.98+ca*m.r*0.16,ombre('#c9bfa6',.22),1);
        }
        for(let s2=Math.round(m.r*0.25);s2<m.r;s2+=4){           // lattes du bord de fuite
          const qx=hx+ca*s2, qy=hy+sa*s2;
          trait(g,qx,qy,qx+sa*m.r*0.05,qy-ca*m.r*0.05,'#4a3728',1);
        }
        trait(g,hx+ca*m.r*0.25,hy+sa*m.r*0.25,hx+ca*m.r,hy+sa*m.r,'#4a3728',1);
      }
      fr(g,hx-2,hy-2,4,4,'#20222a'); fr(g,hx-1,hy-1,2,2,'#4a4f57');
    }
    else if(a.t==='roue'){
      const d=a.d, hx=a.x, hy=a.y, rr=d.r, a0=tps*d.v;
      /* Lame d'eau qui quitte le coursier et tombe sur la roue. Elle
         n'existe QUE pour une roue hydraulique : la roue d'une scierie
         est mue par une courroie et n'a pas de `chute`. Sans ce test, le
         premier atelier à moteur sec faisait tomber tout le rendu. */
      const ch=d.chute;
      if(ch){
        const chx=a.x+(ch.x-d.x), chy=a.y+(ch.y-d.y);
        const chute=Math.max(3,(hy-rr)-chy+3);
        for(let j=0;j<chute;j++){
          const xx=Math.round(chx+(hx-chx)*(j/chute)*0.5);
          const k=(j+((tps*30)|0))%5;
          if(k<4) fr(g,xx,chy+j,2,1,k?'#8fc4da':'#d4ecf7');
        }
        if(rnd()<dt*8&&pN<PMAX-30) emettre(chx+R(-1,1),chy+chute,R(-8,8),R(-14,-2),R(.3,.6),9,1);
      }
      // jantes
      const NS=Math.max(14,Math.round(rr*1.5));
      for(const [rad,col] of [[rr,'#5c4128'],[rr*0.70,'#4a3423']]){
        let px=hx+Math.cos(a0)*rad, py=hy+Math.sin(a0)*rad;
        for(let k=1;k<=NS;k++){
          const ang=a0+k*6.283/NS;
          const qx=hx+Math.cos(ang)*rad, qy=hy+Math.sin(ang)*rad;
          if(py<RIVER+2||qy<RIVER+2) trait(g,px,py,qx,qy,col,1);
          px=qx; py=qy;
        }
      }
      // rayons et aubes
      for(let k=0;k<d.n;k++){
        const ang=a0+k*6.283/d.n, ca=Math.cos(ang), sa=Math.sin(ang);
        if(hy+sa*rr*0.5>RIVER+3) continue;
        trait(g,hx+ca*rr*0.16,hy+sa*rr*0.16,hx+ca*rr*0.98,hy+sa*rr*0.98,'#4a3728',1);
        const px=hx+ca*rr*0.86, py=hy+sa*rr*0.86;
        const ec=(sa>0.2)?'#6f8fa0':'#7d6244';           // les aubes qui remontent sont mouillées
        /* l'aube devient un AUGET : la planche porteuse, et sa joue en
           équerre qui retient l'eau — c'est elle qui justifie la chute */
        trait(g,px-sa*rr*0.24,py+ca*rr*0.24,px+sa*rr*0.24,py-ca*rr*0.24,ec,2);
        trait(g,px+sa*rr*0.22,py-ca*rr*0.22,px+sa*rr*0.22+ca*rr*0.10,py-ca*rr*0.22+sa*rr*0.10,ombre(ec,.25),2);
        trait(g,px-sa*rr*0.24,py+ca*rr*0.24,px+sa*rr*0.24,py-ca*rr*0.24,clair(ec,.18),1);
        // gouttes qui s'égouttent des aubes sortant de l'eau
        if(ch&&sa>0.25&&sa<0.85&&ca*d.v<0&&rnd()<dt*3&&pN<PMAX-30)
          emettre(px,Math.min(py,RIVER-1),R(-4,4),R(4,16),R(.35,.7),9,1);
      }
      fr(g,hx-3,hy-1,7,3,'#241c12'); fr(g,hx-1,hy-3,3,7,'#241c12');   // croix du moyeu
      fr(g,hx-2,hy-2,5,5,'#241c12'); fr(g,hx-1,hy-1,3,3,'#6b5236');
      fr(g,hx,hy,1,1,'#8d9199');                                       // frette de fer
      // remous au point d'entrée dans l'eau — hydraulique seulement
      if(ch){
        const sx=hx+Math.round(rr*0.55)*(d.v>0?1:-1);
        g.globalAlpha=0.30+0.18*Math.sin(tps*7);
        fr(g,sx-4,RIVER+1,10,1,'#cfe8f4'); fr(g,sx-2,RIVER+2,6,1,'#a8cde0');
        g.globalAlpha=1;
        if(rnd()<dt*10&&pN<PMAX-30) emettre(sx+R(-3,3),RIVER,R(-10,10),R(-26,-10),R(.3,.6),9,1);
      }
    }
    else if(a.t==='poulie'){
      // charge qui monte, marque un temps, puis redescend
      const cyc=(tps*0.28+a.ph)%1;
      const m=cyc<0.42?(cyc/0.42):(cyc<0.58?1:1-(cyc-0.58)/0.42);
      const l=Math.round(a.d.l*(1-0.82*m));
      trait(g,a.x,a.y,a.x,a.y+l,'#cfc7b2',1);
      fr(g,a.x-1,a.y+l,3,2,'#5c4128');
      const cw=Math.max(4,Math.round(a.d.l*0.42));
      fr(g,a.x-(cw>>1),a.y+l+2,cw,Math.max(3,cw-2),'#7a5c38');
      fr(g,a.x-(cw>>1),a.y+l+2,cw,1,'#95724a');
      fr(g,a.x-(cw>>1),a.y+l+2+((cw-2)>>1),cw,1,'#5d4529');
    }
    else if(a.t==='mannequin'){
      // quintaine : elle tourne par à-coups, comme frappée
      const k=(tps*0.5+a.ph)%1;
      const ang=k<0.12?(k/0.12)*2.6:(2.6+(k-0.12)*0.5);
      const ca=Math.cos(ang), sa=Math.sin(ang)*0.34;            // écrasé : vu de face
      const r2=a.d.r;
      trait(g,a.x-ca*r2,a.y-sa*r2,a.x+ca*r2,a.y+sa*r2,'#5c4128',2);
      const ex=a.x+ca*r2, ey=a.y+sa*r2;
      fr(g,Math.round(ex)-2,Math.round(ey)-2,5,5,'#7d8790');    // écu
      fr(g,Math.round(ex)-2,Math.round(ey)-2,5,1,'#a8b0ba');
      const sx2=a.x-ca*r2, sy2=a.y-sa*r2;
      fr(g,Math.round(sx2)-1,Math.round(sy2)-3,2,7,'#8a6a3c');  // sac de sable
      fr(g,Math.round(sx2)-1,Math.round(sy2)-3,2,1,'#a8834c');
    }
    else if(a.t==='drapeau'){
      /* La houle était trop creuse : un pas de phase de 0,75 rad par colonne
         faisait tenir plus d'une période entière sur neuf pixels, et une
         amplitude fixe de deux pixels sur un lé de six creusait des dents de
         scie. On cale désormais UNE SEULE onde longue sur la largeur du lé,
         d'amplitude proportionnelle à sa hauteur donc discrète, et on rend le
         relief par l'OMBRE plutôt que par le déplacement : la face qui tourne
         au vent s'éclaire, celle qui s'en détourne s'assombrit. C'est ainsi
         qu'on lit une étoffe, pas à son zigzag. */
      const d=a.d;
      const amp=Math.max(0.55,d.h*0.15);
      const k0=6.28*0.72/Math.max(2,d.w);
      fr(g,a.x-1,a.y-1,1,d.h+8,'#2b2015');
      fr(g,a.x-1,a.y-1,1,2,'#6a6e77');
      for(let k=0;k<d.w;k++){
        const raid=Math.min(1,k/Math.max(1,d.w*0.42));   // la hampe retient le guindant
        const ph=tps*2.5-k*k0;
        const o=Math.round(Math.sin(ph)*amp*raid);
        const pente=Math.cos(ph)*raid;
        const hh=d.h-(k>d.w-3?1:0);
        let col=d.col;
        if(pente>0.42) col=clair(d.col,.16);
        else if(pente<-0.42) col=ombre(d.col,.18);
        if(k<2) col=clair(col,.08);
        if(k>d.w-3) col=ombre(col,.22);
        fr(g,a.x+k,a.y+o,1,hh,col);
        fr(g,a.x+k,a.y+o,1,1,clair(col,.14));
        fr(g,a.x+k,a.y+o+hh-1,1,1,ombre(col,.32));
      }
    }
    else if(a.t==='cheminee'){
      /* La fumée existait mais ne se voyait pas : trois bouffées par seconde,
         qui montaient lentement et s'effaçaient à moitié transparentes. Un
         panache, c'est d'abord une QUANTITÉ — on double le débit —, puis une
         COURSE : on sort vite du conduit et on ralentit en montant, ce qui
         donne la colonne serrée au départ et le nuage étalé en haut. */
      const d=a.d;
      if(rnd()<dt*17*d.d && pN<PMAX-40){
        emettre(a.x+R(-1.5,1.5),a.y+R(-1,1),R(-4,10),R(-19,-11),R(2.8,4.8),d.t,d.d*1.35);
      }
    }
    else if(a.t==='brasier'){
      const f=Math.sin(tps*13+a.x)*0.5+0.5;
      g.globalAlpha=0.5+0.3*f;
      fr(g,a.x-2,a.y-1,5,4,a.d.c);
      g.globalAlpha=0.25+0.2*f;
      fr(g,a.x-4,a.y-3,9,8,a.d.c);
      g.globalAlpha=1;
      if(rnd()<dt*7 && pN<PMAX-40) emettre(a.x+R(-2,2),a.y-2,R(-14,14),R(-34,-14),R(.35,.8),4,1);
    }
    else if(a.t==='chaudron'){
      const f=Math.sin(tps*4+a.x)*0.5+0.5;
      g.globalAlpha=0.45+0.3*f;
      fr(g,a.x-(a.d.w>>1),a.y,a.d.w,2,'#5fe8b2');
      g.globalAlpha=1;
      if(rnd()<dt*3.5 && pN<PMAX-40) emettre(a.x+R(-3,3),a.y-1,R(-4,4),R(-13,-7),R(1.2,2.4),2,0.7);
    }
    else if(a.t==='flamme'){
      const f=Math.round(Math.sin(tps*11+a.x)*1);
      fr(g,a.x,a.y-1+f,2,3,'#ffb347'); fr(g,a.x,a.y-2+f,2,1,'#ffe08a');
    }
    else if(a.t==='girouette'){
      const d=a.d, r=d.r;
      const ang=Math.sin(tps*0.33+a.x*0.11)*0.9 + Math.sin(tps*0.097+a.y*0.07)*0.55;
      const ca=Math.cos(ang), sa=Math.sin(ang)*0.30;      // vue de côté : la rotation s'écrase
      fr(g,a.x-Math.max(2,r-1),a.y+2,2*Math.max(2,r-1)+1,1,'#5c5f66');   // croisillon
      fr(g,a.x,a.y,1,5,'#5c5f66');
      const ax2=a.x+Math.round(ca*r), ay2=a.y+Math.round(sa*r);
      const bx2=a.x-Math.round(ca*r*0.72), by2=a.y-Math.round(sa*r*0.72);
      trait(g,bx2,by2,ax2,ay2,d.col,1);
      // empennage à la queue, coq à la pointe
      fr(g,bx2,by2-2,1,5,ombre(d.col,.22));
      fr(g,bx2+(ca>0?1:-1),by2-1,1,3,d.col);
      fr(g,ax2,ay2-3,1,3,d.col);
      fr(g,ax2+(ca>0?-1:1),ay2-3,1,1,d.col);
      fr(g,ax2+(ca>0?1:-1),ay2-4,1,1,clair(d.col,.30));
      fr(g,ax2,ay2-4,1,1,clair(d.col,.30));
    }
    else if(a.t==='balancier'){
      /* Le sac de la quintaine ne tourne pas : il PEND au bout de sa corde et
         oscille, l'angle décroissant lentement comme une balançoire qu'on
         aurait poussée. On calcule l'angle, on en déduit la position du sac,
         et on trace la corde jusqu'à lui. */
      const d=a.d;
      const ang=Math.sin(tps*1.35)*0.42*(0.72+0.28*Math.sin(tps*0.31));
      const sx=a.x+Math.round(Math.sin(ang)*d.l), sy=a.y+Math.round(Math.cos(ang)*d.l);
      trait(g,a.x,a.y,sx,sy,'#8a7a5c',1);
      fr(g,a.x-1,a.y-1,3,2,'#4a4a50');
      for(let j=0;j<d.h;j++){
        const t=j/Math.max(1,d.h-1);
        const wj=Math.max(2,Math.round(d.w*(0.62+0.38*Math.sin(Math.PI*Math.min(1,t*1.15)))));
        fr(g,sx+((d.w-wj)>>1)-((d.w)>>1),sy+j,wj,1, t<0.30?clair(d.col,.20):(t>0.78?ombre(d.col,.26):d.col));
      }
      fr(g,sx-1,sy,2,1,ombre(d.col,.34));
    }
    else if(a.t==='linge'){
      /* Un lé de tissu pendu ne bat pas d'un bloc : il ondule depuis son
         point d'attache, l'amplitude croît vers le bas, et c'est l'ombre du
         pli qui donne l'étoffe. Même principe que les étendards, tourné de
         quatre-vingt-dix degrés. */
      const d=a.d;
      fr(g,a.x-1,a.y-1,d.w+2,1,'#8a7a5c');
      for(let j=0;j<d.h;j++){
        const t=j/Math.max(1,d.h-1);
        const ph=tps*2.2-j*0.55;
        const o=Math.round(Math.sin(ph)*Math.max(0.6,d.w*0.16)*t);
        const pente=Math.cos(ph)*t;
        let col=d.col;
        if(pente>0.42) col=clair(d.col,.16); else if(pente<-0.42) col=ombre(d.col,.18);
        fr(g,a.x+o,a.y+j,d.w,1,col);
        fr(g,a.x+o,a.y+j,1,1,ombre(col,.22));
        fr(g,a.x+o+d.w-1,a.y+j,1,1,ombre(col,.28));
      }
      fr(g,a.x,a.y-1,1,2,'#5c5240'); fr(g,a.x+d.w-1,a.y-1,1,2,'#5c5240');
    }
    else if(a.t==='enseigne'){
      const o=Math.round(Math.sin(tps*1.7+a.x)*1);
      if(o!==0) fr(g,a.x-1,a.y+o,2,1,'#2b2015');
    }
  }
}
/* corbeaux qui tournoient au-dessus du champ de bataille */
function corbeaux(){
  const cxb=(ZONE.bat[0]+ZONE.bat[1])*0.5, rx=(ZONE.bat[1]-ZONE.bat[0])*0.42;
  for(let k=0;k<5;k++){
    const a=tps*0.42+k*1.36;
    const x=(cxb+Math.cos(a)*rx)|0;
    const y=(SOL[0][clamp(x,0,W-1)]-Math.round(H*0.09)+Math.sin(a*1.4)*H*0.035)|0;
    const f=Math.sin(tps*10+k)>0?1:0;
    fr(g,x,y,1,1,'#1c1f24'); fr(g,x-1,y-f,1,1,'#1c1f24'); fr(g,x+1,y-f,1,1,'#1c1f24');
  }
}

/* ==================================================================
   16. INTERACTION
   ================================================================== */
function posCanvas(ev){
  const r=cv.getBoundingClientRect();
  const p=ev.touches?ev.touches[0]:ev;
  return {x:(p.clientX-r.left)*(W/r.width), y:(p.clientY-r.top)*(H/r.height)};
}

/* ------------------------------------------------------------------
   DÉSIGNATION D'UN ÉDIFICE
   Le test se fait de l'avant vers l'arrière (rangée 3 d'abord) : c'est
   l'ordre inverse du dessin, donc celui que voit l'œil. Le rectangle du
   sprite servirait de cible grossière — on affine avec le masque alpha
   réel, sinon on « attrape » un moulin par le ciel qui entoure sa roue.
   ------------------------------------------------------------------ */
let vise=null, fichePour=null;
const elFiche={classList:{add(){},remove(){}},style:{},offsetWidth:0,offsetHeight:0};
 const elSurvol={classList:{add(){},remove(){}},style:{},textContent:''};

function masqueTouche(e,px,py){
  const sx=Math.round(px-e.x), sy=Math.round(py-(e.y-e.sp.h));
  if(sx<0||sy<0||sx>=e.sp.w||sy>=e.sp.h) return false;
  if(!e.sp.masque){
    try{
      const d=e.sp.g.getImageData(0,0,e.sp.w,e.sp.h).data;
      const m=new Uint8Array(e.sp.w*e.sp.h);
      for(let i=0;i<m.length;i++) m[i]=d[(i<<2)+3]>90?1:0;
      e.sp.masque=m;
    }catch(err){ return true; }
  }
  return e.sp.masque[sy*e.sp.w+sx]===1;
}
function edificeSous(px,py){
  for(let r=3;r>=0;r--){
    for(let i=batiments.length-1;i>=0;i--){
      const e=batiments[i];
      if(e.r!==r||!e.cuit||!CLIQUABLE.has(e.type)) continue;
      if(px<e.x-1||px>e.x+e.sp.w+1) continue;
      if(py>e.y+1||py<e.y-e.sp.h-1) continue;
      if(masqueTouche(e,px,py)) return e;
    }
  }
  return null;
}
/* Contour lumineux mis en cache : on dilate la silhouette et on en retire
   la silhouette elle-même. Une seule fois par édifice. */
function contour(e){
  if(e.sp.contour) return e.sp.contour;
  const w=e.sp.w+4, h=e.sp.h+4;
  const t=document.createElement('canvas'); t.width=w; t.height=h;
  const b=t.getContext('2d'); b.imageSmoothingEnabled=false;
  for(const [dx,dy] of [[0,2],[4,2],[2,0],[2,4],[1,1],[3,1],[1,3],[3,3]])
    b.drawImage(e.sp.can,dx,dy);
  b.globalCompositeOperation='destination-out';
  b.drawImage(e.sp.can,2,2);
  b.globalCompositeOperation='source-in';
  b.fillStyle='#ffe6a8'; b.fillRect(0,0,w,h);
  e.sp.contour=t; return t;
}
function dessinerSurvol(){
  if(!vise||!vise.cuit) return;
  const puls=0.55+0.45*Math.sin(tps*4.2);
  g.globalCompositeOperation='lighter';
  g.globalAlpha=clamp(0.30+0.34*puls,0,1);
  g.drawImage(contour(vise),vise.x-2,vise.y-vise.sp.h-2);
  g.globalAlpha=clamp(0.10+0.06*puls,0,1);
  g.drawImage(vise.sp.can,vise.x,vise.y-vise.sp.h);
  g.globalAlpha=1; g.globalCompositeOperation='source-over';
}
function majSurvol(ev){
  const p=posCanvas(ev);
  const e=edificeSous(p.x,p.y);
  if(e!==vise){
    vise=e;
    cv.style.cursor=e?'pointer':'crosshair';
    if(e){
      elSurvol.textContent=(FICHES[e.type]||{}).nom||'';
      elSurvol.classList.add('vu');
    } else elSurvol.classList.remove('vu');
  }
  if(e){
    const r=cv.getBoundingClientRect(), k=r.width/W;
    elSurvol.style.left=(r.left+(e.x+e.sp.w/2)*k)+'px';
    elSurvol.style.top =(r.top +(e.y-e.sp.h)*k-6)+'px';
  }
}

/* ==================================================================
   9 ter. LES MÉTIERS QUI MANQUAIENT
   ------------------------------------------------------------------
   Le bourg d'origine savait bâtir des maisons, une forge, un moulin et
   quelques monuments. Une économie complète réclame les ATELIERS qui
   font la chaîne : on pêche, on scie, on tanne, on file, on fume, on
   cuit, on coule, on souffle le verre. Chacun de ces édifices est écrit
   avec la même grammaire que les autres — socle, appareil, couverture,
   puis le MOBILIER DE MÉTIER, qui est ce qui les rend reconnaissables.
   Un bâtiment de métier doit se lire à ce qu'il y a DEVANT lui.
   ================================================================== */

/* ---------- LA PÊCHERIE ----------
   Une cabane basse au ras de l'eau, mais surtout ce qui l'entoure :
   les SÉCHOIRS À FILETS — de grands cadres de bois où la maille est
   tendue —, les nasses d'osier empilées, la table à vider et sa caisse
   de glace, les poissons enfilés sous l'auvent. */
function genPecherie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(30), h=S(15), toitH=S(13);
  const SW=w+S(46), SH=h+toitH+S(14);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(16);
  const B=AMB.bois, p=AMB.pierre;
  const BOIS=['#7f6242','#5c452d','#9d7a52','#3b2c1c'];
  const cote=chance(.5)?1:-1;

  // pilotis : la cabane a les pieds dans la vase
  for(let k=0;k<4;k++){
    const px=x0+S(3)+Math.round(k*(w-S(6))/3);
    fr(c,px,bas-S(4),Math.max(2,S(3)),S(5),BOIS[3]);
    fr(c,px,bas-S(4),1,S(5),BOIS[1]);
  }
  fr(c,x0-S(2),bas-S(5),w+S(4),Math.max(2,S(3)),BOIS[0]);      // platelage
  for(let i=0;i<w+S(4);i+=S(4)) fr(c,x0-S(2)+i,bas-S(5),1,S(3),BOIS[3]);

  bardage(c,x0,bas-S(5)-h,w,h,BOIS);
  toitPignon(c,x0-S(5),bas-S(5)-h-toitH,w+S(10),toitH,PAL.toits.ocre,'chaume');

  // la porte et sa chatière, la fenêtre à volet unique
  porte(c,x0+S(4),bas-S(5)-S(11),Math.max(6,S(9)),Math.max(9,S(11)),BOIS,false);
  chatiere(c,x0+S(6),bas-S(5),Math.max(3,S(4)),BOIS);
  fenetre(sp,c,x0+w-S(11),bas-S(5)-h+S(3),Math.max(4,S(6)),Math.max(5,S(7)),B,pick(PAL.volets),{on:chance(.4)});

  /* --- LES SÉCHOIRS À FILETS. Deux cadres inclinés, la maille rendue
     par un quadrillage à un pixel — c'est la trame, pas la corde, qui
     donne le filet. Les lests d'argile pendent en bas. --- */
  for(let k=0;k<2;k++){
    const fw=Math.max(10,S(15)), fh=Math.max(10,S(16));
    const fx=cote>0 ? x0+w+S(4)+k*(fw+S(3)) : x0-S(6)-fw-k*(fw+S(3));
    if(fx<1||fx+fw>SW-1) continue;
    const fy=bas-S(2)-fh;
    fr(c,fx,fy,1,fh+S(2),BOIS[1]); fr(c,fx+fw-1,fy,1,fh+S(2),BOIS[1]);
    fr(c,fx,fy,fw,1,BOIS[2]);
    const maille=['#8a9a86','#6e7d6b','#9dae98'];
    for(let j=2;j<fh;j+=2) fr(c,fx+1,fy+j,fw-2,1,pick(maille));
    for(let i=2;i<fw-1;i+=2) for(let j=2;j<fh;j++) if((i+j)%4===0) fr(c,fx+i,fy+j,1,1,maille[1]);
    for(let i=3;i<fw-2;i+=Math.max(3,S(4))){                       // lests
      fr(c,fx+i,fy+fh-1,1,Math.max(2,S(3)),'#8d7f6c');
      fr(c,fx+i,fy+fh+Math.max(1,S(2)),1,1,'#6a5f50');
    }
  }

  /* --- nasses d'osier, table à vider, caisses --- */
  { const nx=cote>0 ? x0-S(12) : x0+w+S(4);
    for(let k=0,n=RI(2,4);k<n;k++){
      const nw=Math.max(5,S(8)), nh=Math.max(4,S(6));
      const bx2=nx+RI(0,S(5)), by2=bas-S(2)-k*(nh-1);
      for(let j=0;j<nh;j++){
        const t=Math.abs(j/(nh-1)-0.5)*2;
        const wj=Math.max(3,Math.round(nw*(1-0.32*t)));
        fr(c,bx2+((nw-wj)>>1),by2-nh+j,wj,1, (j%2)?'#b09a6c':'#94804f');
      }
      fr(c,bx2+1,by2-nh,nw-2,1,'#6f5c38');
    } }
  caissePoissons(c,cote>0?x0+w+S(2):x0-S(10),bas-S(5),Math.max(7,S(10)),BOIS);

  // les prises du jour pendues sous l'auvent
  for(let k=0,n=RI(3,6);k<n;k++)
    poissonPendu(c,x0+S(4)+k*Math.max(4,S(5)),bas-S(5)-h-S(1),pick(['#9fb6c2','#b8c4c0','#8ea8b4','#c2b294']));
  sp.enseigne={x:x0+(w>>1),y:bas-S(5)-h-S(4),w:Math.max(6,S(9)),h:Math.max(5,S(7))};
  girouettePoisson(c,x0+(w>>1),bas-S(5)-h-toitH-S(2),Math.max(4,S(6)),'#7d8790');
  if(chance(.8)) chatAssis(c,cote>0?x0-S(7):x0+w+S(3),bas-S(2),pick(PELAGES),cote>0?1:-1,robeChat(PELAGES[0]));
  brume(sp,row); return sp;
}

/* ---------- LA SCIERIE ----------
   Un hangar ouvert dont toute la raison d'être est la SCIE À CADRE : un
   châssis vertical qui monte et descend, entraîné par la roue à aubes.
   Autour, la grume sur son chariot, les planches empilées à claire-voie
   pour sécher, et la sciure jusqu'aux chevilles. */
function genScierie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(38), h=S(20), toitH=S(12);
  const SW=w+S(34), SH=h+toitH+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(14);
  const B=['#7f6242','#5c452d','#9d7a52','#3b2c1c'];
  const FER='#3f434a', FERC='#71767f';
  const cote=chance(.5)?1:-1;

  // dalle et poteaux : la halle est ouverte sur trois côtés
  socle(c,x0-S(2),bas-S(4),w+S(4),S(4),AMB.pierre);
  for(let k=0;k<4;k++){
    const px=x0+Math.round(k*(w-S(4))/3);
    fr(c,px,bas-S(4)-h,Math.max(2,S(4)),h,B[1]);
    fr(c,px,bas-S(4)-h,1,h,B[2]);
    fr(c,px,bas-S(4)-h,Math.max(2,S(4)),1,B[0]);
  }
  // le mur du fond, en planches debout
  bardage(c,x0+S(2),bas-S(4)-h,w-S(4),h,B);
  fr(c,x0+S(2),bas-S(4)-h,w-S(4),h,'rgba(30,22,12,.22)');
  // entrait et contrefiches : la charpente se voit
  fr(c,x0-S(2),bas-S(4)-h,w+S(4),Math.max(2,S(3)),B[0]);
  for(let k=0;k<3;k++){
    const px=x0+S(2)+Math.round(k*(w-S(8))/2);
    trait(c,px,bas-S(4)-h+S(3),px+S(6),bas-S(4)-h+S(8),B[1],1);
  }
  toitAsym(c,x0-S(6),bas-S(4)-h-toitH,w+S(12),toitH,pick(AMB.toits),'bardeau',cote);

  /* --- LA SCIE À CADRE, au centre : deux montants, le châssis, la lame
     dentée, la bielle qui descend vers l'arbre. --- */
  const sx=x0+Math.round(w*0.44), sh2=Math.max(11,S(16));
  fr(c,sx-S(6),bas-S(4)-sh2,Math.max(2,S(3)),sh2,B[3]);
  fr(c,sx+S(6),bas-S(4)-sh2,Math.max(2,S(3)),sh2,B[3]);
  { const cy=bas-S(4)-Math.round(sh2*0.55);
    fr(c,sx-S(6),cy,S(14),Math.max(2,S(3)),FER);
    fr(c,sx-S(6),cy,S(14),1,FERC);
    fr(c,sx-S(6),cy+Math.max(6,S(9)),S(14),Math.max(2,S(3)),FER);
    for(let i=0;i<S(14);i+=2) fr(c,sx-S(6)+i,cy+Math.max(6,S(9))+S(3),1,1,FERC);  // les dents
    trait(c,sx-S(6),cy,sx-S(6),cy+Math.max(6,S(9)),FER,1);
    trait(c,sx+S(6)+1,cy,sx+S(6)+1,cy+Math.max(6,S(9)),FER,1); }
  // la grume sur son chariot, engagée sous la lame
  { const gx=sx-S(16), gw=Math.max(14,S(22)), gr=Math.max(3,S(5));
    fr(c,gx,bas-S(6)-gr,gw,gr*2,'#8a6a45');
    fr(c,gx,bas-S(6)-gr,gw,1,'#a9855a');
    fr(c,gx,bas-S(6)+gr-1,gw,1,'#5a412a');
    disque(c,gx+gw,bas-S(6),gr,'#c2a67c'); disque(c,gx+gw,bas-S(6),Math.max(1,gr-2),'#8a6a45');
    for(let k=0;k<2;k++){ const rx=gx+S(3)+k*(gw-S(7));
      disque(c,rx,bas-S(3),Math.max(2,S(3)),FER); } }

  // la roue motrice, en bout : c'est elle qui fait vivre l'atelier
  { const rx=cote>0 ? x0+w+S(5) : x0-S(5);
    const rr=Math.max(7,S(11));
    disque(c,rx,bas-S(4)-rr,rr,'#4b3a26');
    disque(c,rx,bas-S(4)-rr,Math.max(2,rr-2),'#2c2318');
    sp.roue={x:rx,y:bas-S(4)-rr,r:rr,n:8,v:cote>0?1.1:-1.1}; }

  // planches empilées à claire-voie, et la sciure
  { const px=cote>0 ? x0-S(12) : x0+w+S(3);
    for(let k=0,n=RI(5,8);k<n;k++){
      const pw=Math.max(9,S(14)), ph2=Math.max(1,S(2));
      const dec=RI(-1,1), py2=bas-S(2)-k*(ph2+1);
      fr(c,px+dec,py2-ph2,pw,ph2,k%2?'#c8ab7c':'#b89b6c');
      fr(c,px+dec,py2-ph2,pw,1,'#d8c39a');
      fr(c,px+dec,py2-1,pw,1,'#9a8058');
    } }
  for(let k=0;k<S(30);k++){
    const dx2=x0+RI(-S(6),w+S(6));
    fr(c,dx2,bas-S(3)-RI(0,S(2)),1,1,chance(.5)?'#d8c8a0':'#c0ae86');
  }
  if(chance(.7)) chatDormi(c,x0+RI(S(4),w-S(10)),bas-S(4),pick(PELAGES));
  chatteries(sp,c,x0,bas,w,h,row);
  brume(sp,row); return sp;
}

/* ---------- LA CARRIÈRE ----------
   Ce n'est pas un bâtiment mais une ENTAILLE : un front de taille en
   gradins, le treuil à chèvre qui remonte les blocs, les coins de fer
   plantés dans la ligne de fracture, et l'atelier de taille à l'abri
   d'un simple appentis. */
function genCarriere(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(44), h=S(26);
  const SW=w+S(20), SH=h+S(16);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(10);
  const p=AMB.pierre, B=AMB.bois;
  const cote=chance(.5)?1:-1;

  /* le front de taille : quatre gradins reculant vers le haut, chacun
     bien franc — c'est l'escalier de la roche qui dit la carrière */
  const grad=4;
  for(let k=0;k<grad;k++){
    const gy=bas-S(3)-Math.round((k+1)*h/grad);
    const gw=Math.round(w*(1-k*0.16));
    const gx=x0+(cote>0?0:w-gw);
    const hh=Math.round(h/grad)+S(2);
    mur(c,gx,gy,gw,hh,p,3,'taille');
    fr(c,gx,gy,gw,1,clair(p[0],.24));
    fr(c,gx,gy+hh-1,gw,1,ombre(p[3],.30));
    // éboulis au pied de chaque gradin
    for(let i=0;i<gw;i+=Math.max(2,S(3))) if(chance(.45))
      fr(c,gx+i,gy+hh-1,RI(1,Math.max(1,S(3))),1,pick([p[1],p[2],p[3]]));
  }
  // blocs équarris au sol, prêts à charrier
  for(let k=0,n=RI(3,5);k<n;k++){
    const bw2=Math.max(5,S(8)), bh2=Math.max(4,S(6));
    const bx2=x0+RI(0,Math.max(1,w-bw2)), by2=bas-S(3)-RI(0,S(3));
    fr(c,bx2,by2-bh2,bw2,bh2,p[1]);
    fr(c,bx2,by2-bh2,bw2,1,clair(p[0],.20));
    fr(c,bx2,by2-1,bw2,1,ombre(p[3],.24));
    fr(c,bx2+bw2-1,by2-bh2,1,bh2,ombre(p[3],.18));
  }
  /* LA CHÈVRE : trois perches en trépied, la poulie au sommet, l'élingue
     et son bloc qui pend. Sans elle une carrière n'est qu'un talus. */
  { const cx2=x0+Math.round(w*(cote>0?0.72:0.28));
    const ch=Math.max(14,S(22));
    trait(c,cx2,bas-S(3),cx2-S(7),bas-S(3)-ch,B[1],1);
    trait(c,cx2,bas-S(3),cx2+S(7),bas-S(3)-ch,B[1],1);
    trait(c,cx2-S(2),bas-S(3),cx2,bas-S(3)-ch,B[3],1);
    fr(c,cx2-1,bas-S(3)-ch-1,3,2,'#3f434a');
    disque(c,cx2,bas-S(3)-ch,Math.max(2,S(3)),'#6a5136');
    disque(c,cx2,bas-S(3)-ch,Math.max(1,S(2)-1),'#3f434a');
    sp.poulie={x:cx2,y:bas-S(3)-ch+1,l:Math.round(ch*0.62)};
    // le treuil au pied
    fr(c,cx2+S(6),bas-S(3)-S(5),Math.max(5,S(8)),Math.max(3,S(5)),'#6a5136');
    fr(c,cx2+S(6),bas-S(3)-S(5),Math.max(5,S(8)),1,'#8f6f4a');
    for(let a=0;a<6;a++) fr(c,cx2+S(6)+S(4)+Math.round(Math.cos(a)*S(3)),
                            bas-S(3)-S(3)+Math.round(Math.sin(a)*S(3)),1,1,'#3f434a'); }

  // les coins de fer, plantés en ligne dans la roche
  { const ly=bas-S(3)-Math.round(h*0.30);
    for(let i=0;i<Math.round(w*0.4);i+=Math.max(3,S(5)))
      { fr(c,x0+S(4)+i,ly,1,Math.max(2,S(3)),'#8d9199'); fr(c,x0+S(4)+i,ly-1,1,1,'#c6cbd2'); } }

  // l'appentis du tailleur, avec son banc et sa poussière blanche
  { const ax=cote>0 ? x0-S(6) : x0+w-S(10);
    appentis(c,ax,bas-S(3),Math.max(10,S(15)),Math.max(7,S(10)),B[1],pick(AMB.toits),cote>0?-1:1);
    fr(c,ax+S(2),bas-S(6),Math.max(7,S(10)),Math.max(2,S(3)),'#8a7f6c');
    fr(c,ax+S(2),bas-S(6),Math.max(7,S(10)),1,'#a9a08c');
    for(let k=0;k<S(14);k++) fr(c,ax+RI(0,S(14)),bas-S(3)-RI(0,S(2)),1,1,'#d9d4c4'); }
  if(chance(.6)) chatAssis(c,x0+RI(S(4),w-S(8)),bas-S(3),pick(PELAGES),chance(.5)?1:-1,null);
  brume(sp,row); return sp;
}

/* ---------- LA TUILERIE ----------
   La fosse d'argile et son four : un dôme de brique trapu percé de deux
   alandiers, les claies de séchage où les tuiles attendent en épi, et
   le tas de terre grasse qu'on marche au pied. */
function genTuilerie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(26), h=S(20);
  const SW=w+S(40), SH=h+S(20);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(18);
  const briq=pick(PAL.brique), B=AMB.bois;
  const cote=chance(.5)?1:-1;

  // le four : fût de brique puis dôme
  const fh=Math.round(h*0.62);
  futBrique(c,bas-S(2)-h,h-fh,()=>[x0,w],briq,false);
  futBrique(c,bas-S(2)-fh,fh,()=>[x0,w],briq,false);
  for(let j=0;j<Math.round(h*0.42);j++){
    const t=j/Math.round(h*0.42);
    const wj=Math.max(3,Math.round(w*Math.sqrt(Math.max(0,1-t*t))));
    fr(c,x0+((w-wj)>>1),bas-S(2)-h-j,wj,1, j<2?clair(briq[0],.12):(j%3===2?briq[1]:briq[0]));
    fr(c,x0+((w-wj)>>1),bas-S(2)-h-j,1,1,clair(briq[0],.16));
    fr(c,x0+((w-wj)>>1)+wj-1,bas-S(2)-h-j,1,1,ombre(briq[1],.22));
  }
  // cerclages de fer : ce qui empêche le four d'éclater
  for(let k=1;k<=3;k++){
    const cy=bas-S(2)-Math.round(h*k/4);
    fr(c,x0-1,cy,w+2,Math.max(1,S(2)),'#4a4238');
    fr(c,x0-1,cy,w+2,1,'#6e6558');
  }
  // les deux alandiers, gueules ardentes
  for(let k=0;k<2;k++){
    const ax=x0+S(4)+k*(w-S(12));
    const aw=Math.max(5,S(8)), ah=Math.max(5,S(8));
    for(let j=0;j<ah;j++){
      const t=j/(ah-1);
      const wj=(t<0.45)?Math.round(aw*(0.5+t)):aw;
      fr(c,ax+((aw-wj)>>1),bas-S(2)-ah+j,wj,1, mix('#1a0f08','#ff9a30',Math.pow(t,1.4)));
    }
    fr(c,ax-1,bas-S(2)-ah-1,aw+2,Math.max(1,S(2)),briq[1]);
    if(k===0){ sp.brasier={x:ax+(aw>>1),y:bas-S(3),r:S(10),c:'#ff8a2a'};
               sp.lampes.push({x:ax+(aw>>1),y:bas-S(3),c:'#ff7a2a',r:S(14)}); }
  }
  sp.fumees.push({x:x0+(w>>1),y:bas-S(2)-h-Math.round(h*0.4),t:1,d:1.5});
  sp.fumees.push({x:x0+(w>>1)+2,y:bas-S(2)-h-Math.round(h*0.4),t:13,d:0.9});

  /* --- LES CLAIES DE SÉCHAGE. Trois lits sur tréteaux, les tuiles
     rangées de chant : c'est ce détail qui nomme le bâtiment. --- */
  { const dx2=cote>0 ? x0+w+S(4) : x0-S(26);
    for(let k=0;k<3;k++){
      const dy=bas-S(3)-k*Math.max(5,S(7));
      const dw=Math.max(16,S(24));
      fr(c,dx2,dy,dw,Math.max(1,S(2)),B[1]);
      fr(c,dx2,dy,dw,1,B[2]);
      fr(c,dx2+1,dy+S(2),1,Math.max(3,S(4)),B[3]);
      fr(c,dx2+dw-2,dy+S(2),1,Math.max(3,S(4)),B[3]);
      for(let i=1;i<dw-1;i+=Math.max(2,S(3))){
        const th2=Math.max(3,S(4));
        fr(c,dx2+i,dy-th2,Math.max(1,S(2)),th2, chance(.5)?'#b8663f':'#a2573a');
        fr(c,dx2+i,dy-th2,Math.max(1,S(2)),1,'#d0805a');
      }
    } }
  // la fosse d'argile, grasse et luisante
  { const gx=cote>0 ? x0-S(16) : x0+w+S(4);
    ellipse(c,gx+S(7),bas-S(2),Math.max(6,S(9)),Math.max(2,S(4)),'#7a5f42');
    ellipse(c,gx+S(7),bas-S(3),Math.max(5,S(7)),Math.max(2,S(3)),'#8f7150');
    for(let k=0;k<S(8);k++) fr(c,gx+RI(1,S(13)),bas-S(4)-RI(0,S(2)),1,1,'#a08461');
    fr(c,gx+S(2),bas-S(8),1,Math.max(4,S(6)),B[1]);                 // la pelle plantée
    fr(c,gx+S(1),bas-S(9),Math.max(2,S(3)),Math.max(2,S(3)),'#8d9199'); }
  brume(sp,row); return sp;
}

/* ---------- LA LAITERIE ----------
   Blanchie à la chaux jusqu'au linteau, fenêtres basses grillagées de
   bois pour tenir le frais, l'auvent aux bidons, les barattes debout et
   les claies à fromages. Le chat n'est jamais loin. */
function genLaiterie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(26), h=S(17), toitH=S(13);
  const SW=w+S(30), SH=h+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(14);
  const B=AMB.bois, p=AMB.pierre;
  const cote=chance(.5)?1:-1;

  socle(c,x0-1,bas-S(4),w+2,S(4),p);
  mur(c,x0,bas-h,w,h,p,3,'crepi');
  fr(c,x0,bas-h,w,h,'rgba(244,240,228,.34)');                 // le lait de chaux
  fr(c,x0,bas-h,w,1,'rgba(255,252,242,.5)');
  toitDemiCroupe(c,x0-S(4),bas-h-toitH,w+S(8),toitH,pick(AMB.toits));

  porte(c,x0+S(3),bas-Math.max(9,S(12)),Math.max(6,S(9)),Math.max(9,S(12)),B,true);
  // fenêtre grillagée : des barreaux de bois, pas de vitre — il faut l'air
  { const fw=Math.max(6,S(9)), fh=Math.max(5,S(7));
    const fx=x0+w-fw-S(4), fy=bas-h+S(4);
    fr(c,fx-1,fy-1,fw+2,fh+2,B[1]);
    fr(c,fx,fy,fw,fh,'#2b3038');
    for(let i=1;i<fw;i+=Math.max(2,S(3))) fr(c,fx+i,fy,1,fh,B[0]);
    fr(c,fx,fy+Math.round(fh/2),fw,1,B[0]);
    sp.fenetres.push({x:fx,y:fy,w:fw,h:fh,ph:rnd()*6.28,on:false,vitrail:false}); }

  /* --- l'auvent aux bidons : ce que l'on voit d'abord --- */
  { const ax=cote>0 ? x0+w : x0-Math.max(10,S(15));
    const aw=Math.max(10,S(15));
    appentis(c,ax,bas,aw,Math.max(7,S(10)),B[1],PAL.toits.ocre,cote>0?1:-1);
    for(let k=0,n=RI(3,5);k<n;k++) bidonLait(c,ax+S(2)+k*Math.max(3,S(4)),bas); }
  // les barattes, hautes et cerclées
  { const bx2=cote>0 ? x0-S(12) : x0+w+S(3);
    for(let k=0,n=RI(2,3);k<n;k++){
      const bw2=Math.max(4,S(6)), bh2=Math.max(8,S(12));
      const bxx=bx2+k*(bw2+S(2));
      for(let j=0;j<bh2;j++){
        const t=j/(bh2-1);
        const wj=Math.max(3,Math.round(bw2*(1-0.18*Math.abs(t-0.5)*2)));
        fr(c,bxx+((bw2-wj)>>1),bas-S(1)-bh2+j,wj,1, (j<2)?'#a98c62':(j%4===3?'#6b5436':'#8a6f48'));
      }
      fr(c,bxx-1,bas-S(1)-bh2+2,bw2+2,1,'#4a4238');
      fr(c,bxx-1,bas-S(1)-Math.round(bh2*0.4),bw2+2,1,'#4a4238');
      fr(c,bxx+(bw2>>1),bas-S(1)-bh2-Math.max(3,S(5)),1,Math.max(3,S(5)),'#6b5436');   // le pilon
      fr(c,bxx+(bw2>>1)-1,bas-S(1)-bh2-Math.max(4,S(6)),3,1,'#8a6f48');
    } }
  // claie à fromages sous la fenêtre
  { const cx2=x0+S(5);
    fr(c,cx2,bas-S(7),Math.max(9,S(13)),Math.max(1,S(2)),B[1]);
    for(let k=0,n=RI(2,4);k<n;k++){
      const fx2=cx2+S(1)+k*Math.max(3,S(5));
      disque(c,fx2+S(1),bas-S(8),Math.max(1,S(2)),'#e6d9a8');
      fr(c,fx2,bas-S(8),Math.max(3,S(4)),1,'#f2e8c0');
    } }
  if(chance(.85)) chatAssis(c,cote>0?x0-S(6):x0+w+S(2),bas,pick(PELAGES),cote>0?1:-1,null);
  souche(sp,c,x0+Math.round(w*0.3),bas-h-toitH,toitH,Math.max(5,S(8)),Math.max(4,S(6)),pick(PAL.brique),0.5,'brique',0.5);
  chatteries(sp,c,x0,bas,w,h,row);
  brume(sp,row); return sp;
}

/* ---------- LA FILATURE ----------
   Maison à pan de bois dont le rez est une grande baie d'atelier : le
   MÉTIER À TISSER y tient toute la place, ensouple, lisses et peigne.
   Dehors, les écheveaux teints sèchent sur une perche, en couleurs. */
function genFilature(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(28), h=S(15), gab=S(11), toitH=S(14);
  const SW=w+S(30), SH=h+gab+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(14);
  const B=AMB.bois, p=AMB.pierre;
  const cote=chance(.5)?1:-1;
  const TEINTES=['#b0555f','#4a6c8a','#7a5f9c','#c48a3a','#4f8a63','#a0496b','#d8c34a'];

  socle(c,x0-1,bas-S(3),w+2,S(3),p);
  mur(c,x0,bas-h,w,h,p,3);
  colombage(c,x0-S(2),bas-h-gab,w+S(4),gab,pick(PAL.platre),B,'losange');
  toitVarie(c,x0-S(5),bas-h-gab-toitH,w+S(10),toitH,pick(AMB.toits));

  /* la baie d'atelier : on voit dedans */
  const bw=Math.round(w*0.62), bx=x0+((w-bw)>>1), bh=h-S(4);
  for(let j=0;j<bh;j++){
    const t=j/Math.max(1,bh-1);
    fr(c,bx,bas-bh+j,bw,1,mix('#2a231a','#5c4f3c',Math.pow(t,0.7)));
  }
  fr(c,bx-1,bas-bh-1,bw+2,Math.max(2,S(3)),B[0]);
  fr(c,bx-1,bas-bh-1,bw+2,1,B[2]);

  /* --- LE MÉTIER À TISSER. Deux montants, l'ensouple en haut, la nappe
     de chaîne qui descend en biais, le peigne, et l'étoffe déjà tissée
     enroulée en bas. La chaîne est rendue par des traits d'un pixel : à
     cette échelle c'est ce qui se lit comme du fil tendu. --- */
  { const mx=bx+S(2), mw=bw-S(4), mh=bh-S(2);
    fr(c,mx,bas-mh,Math.max(1,S(2)),mh,'#6b5436');
    fr(c,mx+mw-1,bas-mh,Math.max(1,S(2)),mh,'#6b5436');
    fr(c,mx,bas-mh,mw,Math.max(1,S(2)),'#8a6f48');
    const teint=pick(TEINTES);
    for(let i=1;i<mw-1;i+=2){
      const y1=bas-mh+S(2), y2=bas-Math.round(mh*0.30);
      trait(c,mx+i,y1,mx+i-Math.round(S(3)*(i/mw)),y2,clair(teint,.24),1);
    }
    fr(c,mx+1,bas-Math.round(mh*0.34),mw-2,Math.max(1,S(2)),'#4a3a26');       // le peigne
    for(let i=1;i<mw-1;i+=2) fr(c,mx+i,bas-Math.round(mh*0.34)-1,1,1,'#8d9199');
    fr(c,mx+1,bas-Math.round(mh*0.20),mw-2,Math.max(3,S(4)),ombre(teint,.10));  // l'étoffe
    fr(c,mx+1,bas-Math.round(mh*0.20),mw-2,1,clair(teint,.18));
    disque(c,mx+1,bas-S(3),Math.max(2,S(3)),'#6b5436');
    disque(c,mx+mw-2,bas-S(3),Math.max(2,S(3)),'#6b5436'); }

  // la perche aux écheveaux : le signal de couleur du bâtiment
  { const px2=cote>0 ? x0+w+S(2) : x0-Math.max(12,S(18));
    const pw=Math.max(12,S(18));
    fr(c,px2,bas-Math.max(11,S(16)),1,Math.max(11,S(16)),B[1]);
    fr(c,px2+pw,bas-Math.max(11,S(16)),1,Math.max(11,S(16)),B[1]);
    fr(c,px2,bas-Math.max(11,S(16)),pw+1,1,B[0]);
    for(let k=0,n=RI(3,6);k<n;k++){
      const ex=px2+S(2)+k*Math.max(3,S(4));
      const col=pick(TEINTES), el=RI(S(4),S(9));
      if(ex>px2+pw-2) break;
      fr(c,ex,bas-Math.max(11,S(16))+1,Math.max(2,S(3)),el,col);
      fr(c,ex,bas-Math.max(11,S(16))+1,1,el,clair(col,.20));
      fr(c,ex,bas-Math.max(11,S(16))+1+el,Math.max(2,S(3)),1,ombre(col,.28));
    } }
  // pelotes oubliées au pied du mur
  for(let k=0,n=RI(1,3);k<n;k++) pelote(c,x0+RI(2,w-4),bas-RI(1,S(3)),pick(TEINTES));
  if(chance(.7)) chatAuBalcon(c,x0+RI(S(3),w-S(8)),bas-h-gab+S(3),pick(PELAGES),null);
  souche(sp,c,x0+Math.round(w*0.72),bas-h-gab-toitH,toitH,Math.max(5,S(8)),Math.max(4,S(6)),pick(PAL.brique),0.45,'brique',0.7);
  chatteries(sp,c,x0,bas,w,h+gab,row);
  brume(sp,row); return sp;
}

/* ---------- LA TANNERIE ----------
   Les CUVES sont le bâtiment. Une rangée de fosses maçonnées pleines de
   tan brun, la perche du tanneur, et les peaux tendues sur leurs cadres
   comme des voiles. On la met toujours au bout du bourg, sous le vent. */
function genTannerie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(20), h=S(14), toitH=S(11);
  const SW=w+S(44), SH=h+toitH+S(16);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(6);
  const B=AMB.bois, p=AMB.pierre;
  const BOIS=['#7f6242','#5c452d','#9d7a52','#3b2c1c'];

  // la remise, petite : ici l'essentiel est dehors
  socle(c,x0-1,bas-S(3),w+2,S(3),p);
  bardage(c,x0,bas-h,w,h,BOIS);
  toitPignon(c,x0-S(3),bas-h-toitH,w+S(6),toitH,PAL.toits.ocre,'chaume');
  porte(c,x0+S(3),bas-Math.max(8,S(10)),Math.max(5,S(8)),Math.max(8,S(10)),BOIS,false);

  /* --- LES CUVES. Trois fosses en enfilade, margelle de pierre, bain de
     tan opaque avec un reflet d'un seul pixel : c'est ce reflet qui dit
     le liquide. --- */
  for(let k=0;k<3;k++){
    const cw=Math.max(9,S(13)), chh=Math.max(4,S(6));
    const cx2=x0+w+S(4)+k*(cw+S(2));
    if(cx2+cw>SW-2) break;
    fr(c,cx2-1,bas-S(2)-chh-1,cw+2,chh+2,p[2]);
    fr(c,cx2-1,bas-S(2)-chh-1,cw+2,1,clair(p[0],.18));
    const bain=[['#5a3a1e','#6d4826'],['#3f2c18','#523a20'],['#6b5028','#7d5f32']][k%3];
    fr(c,cx2,bas-S(2)-chh,cw,chh,bain[0]);
    fr(c,cx2,bas-S(2)-chh,cw,1,bain[1]);
    fr(c,cx2+2,bas-S(2)-chh+1,Math.max(2,cw-6),1,clair(bain[1],.16));
    if(k===1){ // la peau qui trempe, à demi immergée
      fr(c,cx2+S(2),bas-S(2)-chh+1,Math.max(4,S(6)),Math.max(2,S(3)),'#b09a72');
      fr(c,cx2+S(2),bas-S(2)-chh+1,Math.max(4,S(6)),1,'#c9b48a'); }
  }
  // la perche du tanneur, plantée en travers
  { const px2=x0+w+S(6);
    trait(c,px2,bas-S(3),px2+S(14),bas-S(14),BOIS[1],1);
    fr(c,px2+S(14),bas-S(15),Math.max(2,S(3)),Math.max(2,S(3)),'#8d9199'); }

  /* --- LES PEAUX SUR CADRES. Un cadre de perches liées, la peau tendue
     par des cordelettes rayonnantes : la silhouette irrégulière est ce
     qui la distingue d'un filet. --- */
  for(let k=0;k<2;k++){
    const pw=Math.max(11,S(16)), ph2=Math.max(12,S(17));
    const px2=x0-S(2)-k*(pw+S(3));
    if(px2<1) break;
    const py2=bas-S(2)-ph2;
    fr(c,px2,py2,1,ph2+S(2),BOIS[1]); fr(c,px2+pw-1,py2,1,ph2+S(2),BOIS[1]);
    fr(c,px2,py2,pw,1,BOIS[2]); fr(c,px2,py2+ph2,pw,1,BOIS[3]);
    const cuir=pick([['#c2a274','#a5865a'],['#b09070','#94745a'],['#cbb089','#a89066']]);
    for(let j=2;j<ph2-1;j++){
      const t=j/(ph2-1);
      const wj=Math.max(3,Math.round((pw-4)*(0.72+0.28*Math.sin(Math.PI*t))));
      const xx=px2+((pw-wj)>>1)+RI(-1,1);
      fr(c,xx,py2+j,wj,1, (j%5===0)?cuir[1]:cuir[0]);
      fr(c,xx,py2+j,1,1,clair(cuir[0],.14));
      fr(c,xx+wj-1,py2+j,1,1,ombre(cuir[1],.18));
      if(j%4===1){ fr(c,px2+1,py2+j,Math.max(1,xx-px2-1),1,'#8f8570');    // cordelettes
                   fr(c,xx+wj,py2+j,Math.max(1,px2+pw-1-xx-wj),1,'#8f8570'); }
    }
  }
  // le tas d'écorce à tan et le broyeur
  { const tx=x0+S(2);
    for(let k=0;k<S(12);k++) fr(c,tx+RI(0,S(9)),bas-S(2)-RI(0,S(4)),RI(1,2),1,pick(['#6b4f2e','#8a6a40','#54401f'])); }
  if(chance(.5)) chatAssis(c,x0+w+S(2),bas-S(2),pick(PELAGES),1,null);
  brume(sp,row); return sp;
}

/* ---------- LE FUMOIR ----------
   Une tourelle trapue, aveugle, à la porte de fer, coiffée d'un chapeau
   de bardeaux d'où la fumée sort en permanence — froide, épaisse, elle
   traîne au sol. Sous l'auvent, les enfilades de poissons. */
function genFumoir(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(16), h=S(24), toitH=S(9);
  const SW=w+S(28), SH=h+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(14);
  const p=AMB.pierre, B=AMB.bois;
  const cote=chance(.5)?1:-1;

  socle(c,x0-S(2),bas-S(4),w+S(4),S(4),p);
  mur(c,x0,bas-h,w,h,p,3);
  fr(c,x0,bas-h,w,h,'rgba(26,20,14,.26)');                   // culottée par la fumée
  // le chapeau : une petite pyramide de bardeaux, la fumée sort par les côtés
  for(let j=0;j<toitH;j++){
    const t=(j+1)/toitH;
    const wj=Math.max(3,Math.round((w+S(6))*t));
    const xj=x0-S(3)+(((w+S(6))-wj)>>1);
    fr(c,xj,bas-h-toitH+j,wj,1, (j%3===2)?'#4a3a28':'#5f4a33');
    fr(c,xj,bas-h-toitH+j,1,1,'#7a6144');
  }
  fr(c,x0-S(4),bas-h-1,w+S(8),Math.max(2,S(3)),'#3a2c1e');
  // la porte de fer, à ferrures
  { const dw=Math.max(6,S(9)), dh=Math.max(9,S(13));
    const dx2=x0+((w-dw)>>1);
    fr(c,dx2,bas-S(4)-dh,dw,dh,'#3d3f45');
    fr(c,dx2,bas-S(4)-dh,dw,1,'#63676f');
    fr(c,dx2,bas-S(4)-Math.round(dh*0.72),dw,Math.max(1,S(2)),'#5a5e66');
    fr(c,dx2,bas-S(4)-Math.round(dh*0.28),dw,Math.max(1,S(2)),'#5a5e66');
    fr(c,dx2+dw-Math.max(2,S(3)),bas-S(4)-Math.round(dh*0.5),Math.max(1,S(2)),Math.max(1,S(2)),'#8d9199');
    for(let i=1;i<dw;i+=Math.max(2,S(3))) fr(c,dx2+i,bas-S(4)-dh+1,1,1,'#7a7e86'); }
  // la bouche d'alimentation, en bas, rougeoyante
  { const ow=Math.max(4,S(6));
    fr(c,x0+S(2),bas-S(4),ow,Math.max(3,S(4)),'#1a120a');
    fr(c,x0+S(2),bas-S(3),ow,Math.max(1,S(2)),'#b8531c');
    fr(c,x0+S(3),bas-S(3),Math.max(2,S(3)),1,'#ff9a3a');
    sp.lampes.push({x:x0+S(2)+(ow>>1),y:bas-S(3),c:'#ff8a3a',r:S(9)}); }
  // la fumée : basse et grasse, deux sources
  sp.fumees.push({x:x0+S(2),y:bas-h-toitH+S(2),t:13,d:1.9});
  sp.fumees.push({x:x0+w-S(2),y:bas-h-toitH+S(2),t:13,d:1.5});
  sp.fumees.push({x:x0+(w>>1),y:bas-h-toitH,t:3,d:0.8});

  /* --- l'auvent aux enfilades : trois perches, les prises alignées --- */
  { const ax=cote>0 ? x0+w : x0-Math.max(12,S(17));
    const aw=Math.max(12,S(17)), ah=Math.max(9,S(13));
    appentis(c,ax,bas-S(1),aw,ah,B[1],'#6d5236',cote>0?1:-1);
    for(let k=0;k<2;k++){
      const py2=bas-S(1)-ah+S(3)+k*Math.max(4,S(6));
      fr(c,ax+1,py2,aw-2,1,B[3]);
      for(let i=2;i<aw-2;i+=Math.max(3,S(4)))
        poissonPendu(c,ax+i,py2,pick(['#b9926a','#a8845c','#c9a878','#8f7350']));
    } }
  if(chance(.6)) chatAssis(c,cote>0?x0-S(6):x0+w+S(2),bas-S(4),pick(PELAGES),cote>0?1:-1,null);
  brume(sp,row); return sp;
}

/* ---------- LA CHARBONNIÈRE ----------
   Pas de bâti : une MEULE. Le bois dressé en dôme, recouvert de mottes
   et de terre, l'évent au sommet qui fume sans flamme, la hutte conique
   du charbonnier qui veille jour et nuit, et le charbon déjà tiré. */
function genCharbonniere(row){
  const S=v=>Math.max(1,sc(row,v));
  const rM=S(16);
  const SW=rM*2+S(36), SH=rM+S(22);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, cx=rM+S(8);
  const B=AMB.bois;
  const cote=chance(.5)?1:-1;

  // le dôme de terre : trois tons, le sommet éclairé
  for(let j=0;j<rM;j++){
    const t=j/rM;
    const wj=Math.round(rM*2*Math.sqrt(Math.max(0,1-t*t)));
    const y=bas-S(2)-j;
    fr(c,cx-(wj>>1),y,wj,1, t>0.72?'#6b5a44':(t>0.35?'#5b4c39':'#4a3d2d'));
    fr(c,cx-(wj>>1),y,Math.max(1,wj>>2),1, t>0.5?'#7d6b52':'#63533e');
    if(chance(.4)) fr(c,cx-(wj>>1)+RI(0,Math.max(1,wj-1)),y,1,1,'#3a3025');
  }
  // les bûches qui pointent au bas de la meule : on voit ce qu'il y a dessous
  for(let i=-rM;i<rM;i+=Math.max(2,S(3))){
    if(Math.abs(i)>rM-2) continue;
    fr(c,cx+i,bas-S(2)-RI(0,S(2)),Math.max(1,S(2)),Math.max(2,S(3)),'#6d5236');
    fr(c,cx+i,bas-S(2),1,1,'#8f6f4a');
  }
  // l'évent : un anneau de pierres, et la fumée qui monte droit
  { const ew=Math.max(4,S(6));
    for(let a=0;a<8;a++)
      fr(c,cx-(ew>>1)+Math.round(Math.cos(a/8*6.283)*ew*0.6),
           bas-S(2)-rM+Math.round(Math.sin(a/8*6.283)*ew*0.3),1,1,'#8a8272');
    fr(c,cx-1,bas-S(3)-rM,3,2,'#231c14');
    sp.fumees.push({x:cx,y:bas-S(4)-rM,t:13,d:2.2});
    sp.fumees.push({x:cx+1,y:bas-S(4)-rM,t:3,d:1.1}); }

  // la hutte du charbonnier : cône de perches et de branchages
  { const hx=cote>0 ? cx+rM+S(8) : cx-rM-S(8);
    const hh=Math.max(10,S(14)), hw=Math.max(9,S(13));
    for(let j=0;j<hh;j++){
      const t=(j+1)/hh;
      const wj=Math.max(2,Math.round(hw*t));
      fr(c,hx-(wj>>1),bas-S(1)-hh+j,wj,1, (j%3===2)?'#3f3223':'#4e402e');
      if(chance(.5)) fr(c,hx-(wj>>1)+RI(0,Math.max(1,wj-1)),bas-S(1)-hh+j,1,1,'#5f5039');
    }
    for(let k=-1;k<=1;k+=2) trait(c,hx,bas-S(1)-hh,hx+k*Math.round(hw*0.5),bas-S(1),'#2f2619',1);
    fr(c,hx-Math.max(1,S(2)),bas-S(1)-Math.max(4,S(6)),Math.max(3,S(4)),Math.max(4,S(6)),'#1c150e');
    // le râteau appuyé
    trait(c,hx+Math.round(hw*0.5),bas-S(1),hx+Math.round(hw*0.5)+S(3),bas-S(10),B[1],1);
    fr(c,hx+Math.round(hw*0.5)+S(2),bas-S(11),Math.max(4,S(5)),1,B[3]); }

  // le charbon tiré, en tas noir luisant
  { const tx=cote>0 ? cx-rM-S(10) : cx+rM+S(4);
    for(let k=0,n=RI(10,18);k<n;k++){
      const dx2=tx+RI(0,S(12)), dy=bas-S(1)-RI(0,S(5));
      fr(c,dx2,dy,RI(1,2),RI(1,2),chance(.25)?'#33302c':'#141310');
      if(chance(.2)) fr(c,dx2,dy,1,1,'#4d4a44');
    }
    fr(c,tx-1,bas-S(1),S(14),1,'#0d0c0a'); }
  brume(sp,row); return sp;
}

/* ---------- LA VERRERIE ----------
   Le four rond à trois ouvreaux, la cheminée courte et large, le banc du
   souffleur avec sa canne, le tas de sable blanc et les pièces refroidies
   sur leur claie — c'est la seule couleur froide du bourg. */
function genVerrerie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(24), h=S(22), toitH=S(10);
  const SW=w+S(38), SH=h+toitH+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(16);
  const briq=pick(PAL.brique), B=AMB.bois, p=AMB.pierre;
  const cote=chance(.5)?1:-1;

  // le four : fût de brique cerclé, épaulement, cheminée trapue
  futBrique(c,bas-S(2)-h,h,()=>[x0,w],briq,false);
  for(let k=1;k<=2;k++){
    const cy=bas-S(2)-Math.round(h*k/3);
    fr(c,x0-1,cy,w+2,Math.max(1,S(2)),'#4a4238'); fr(c,x0-1,cy,w+2,1,'#6e6558');
  }
  for(let j=0;j<toitH;j++){
    const t=j/toitH;
    const wj=Math.max(4,Math.round(w*(1-0.42*t)));
    fr(c,x0+((w-wj)>>1),bas-S(2)-h-j,wj,1, (j%3===2)?briq[1]:briq[0]);
    fr(c,x0+((w-wj)>>1),bas-S(2)-h-j,1,1,clair(briq[0],.14));
  }
  fr(c,x0+S(4),bas-S(2)-h-toitH-Math.max(2,S(3)),w-S(8),Math.max(2,S(3)),p[1]);
  sp.fumees.push({x:x0+(w>>1),y:bas-S(2)-h-toitH-S(3),t:1,d:1.2});

  /* --- LES OUVREAUX. Trois bouches d'un blanc-jaune presque aveuglant :
     le verre en fusion ne rougeoie pas, il ÉBLOUIT. --- */
  for(let k=0;k<3;k++){
    const ow=Math.max(4,S(6)), oh=Math.max(4,S(6));
    const ox=x0+S(2)+k*Math.round((w-S(4)-ow)/2);
    const oy=bas-S(2)-Math.round(h*0.32)-oh;
    for(let j=0;j<oh;j++){
      const t=j/Math.max(1,oh-1);
      fr(c,ox,oy+j,ow,1, mix('#ffd88a','#fff8e0',1-Math.abs(t-0.4)*1.4));
    }
    fr(c,ox-1,oy-1,ow+2,1,briq[1]);
    fr(c,ox-1,oy+oh,ow+2,1,ombre(briq[1],.30));
    if(k===1){ sp.brasier={x:ox+(ow>>1),y:oy+(oh>>1),r:S(12),c:'#ffe0a0'};
               sp.lampes.push({x:ox+(ow>>1),y:oy+(oh>>1),c:'#ffe4b0',r:S(16)}); }
  }
  // le banc du souffleur et sa canne, à côté
  { const bx2=cote>0 ? x0+w+S(3) : x0-Math.max(12,S(17));
    const bw2=Math.max(12,S(17));
    fr(c,bx2,bas-S(6),bw2,Math.max(2,S(3)),'#6d5236');
    fr(c,bx2,bas-S(6),bw2,1,'#8f6f4a');
    fr(c,bx2+1,bas-S(4),Math.max(1,S(2)),S(4),'#4a3826');
    fr(c,bx2+bw2-2,bas-S(4),Math.max(1,S(2)),S(4),'#4a3826');
    const dir=cote>0?-1:1;
    trait(c,bx2+(bw2>>1),bas-S(7),bx2+(bw2>>1)+dir*S(11),bas-S(11),'#5a5e66',1);
    disque(c,bx2+(bw2>>1)+dir*S(12),bas-S(11),Math.max(2,S(3)),'#ffd07a');
    disque(c,bx2+(bw2>>1)+dir*S(12),bas-S(11),Math.max(1,S(2)-1),'#fff2c8'); }
  // le tas de sable, blanc, et les pièces sur claie
  { const sx=cote>0 ? x0-S(14) : x0+w+S(4);
    for(let j=0;j<S(6);j++){
      const wj=Math.round(S(14)*(1-j/S(6)));
      fr(c,sx+((S(14)-wj)>>1),bas-S(1)-j,wj,1, j>S(4)?'#efe6cf':'#ddd2b8');
    }
    fr(c,sx,bas-S(9),S(14),Math.max(1,S(2)),B[1]);
    for(let k=0,n=RI(2,4);k<n;k++){
      const vx2=sx+S(2)+k*Math.max(3,S(4));
      const vc=pick(['#8fc0c8','#a8cdd2','#7fb0bc','#c0d8d4']);
      fr(c,vx2,bas-S(9)-Math.max(3,S(4)),Math.max(2,S(3)),Math.max(3,S(4)),vc);
      fr(c,vx2,bas-S(9)-Math.max(3,S(4)),1,Math.max(3,S(4)),clair(vc,.28));
      fr(c,vx2,bas-S(9)-Math.max(4,S(5)),Math.max(2,S(3)),1,ombre(vc,.20));
    } }
  brume(sp,row); return sp;
}

/* ---------- L'HERBORISTERIE ----------
   Une cabane à claire-voie sous un séchoir ouvert : ce sont les BOTTES
   suspendues, tête en bas, qui font l'atelier. Devant, le jardin de
   simples en planches étroites, et le mortier sur son billot. */
function genHerboristerie(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(22), h=S(14), toitH=S(11);
  const SW=w+S(38), SH=h+toitH+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(16);
  const B=AMB.bois;
  const BOIS=['#7f6242','#5c452d','#9d7a52','#3b2c1c'];
  const cote=chance(.5)?1:-1;
  const VERTS=['#5d7247','#4a6338','#6b8452','#7f9a5c','#3f5a30'];

  bardage(c,x0,bas-S(2)-h,w,h,BOIS);
  toitPignon(c,x0-S(4),bas-S(2)-h-toitH,w+S(8),toitH,PAL.toits.ocre,'chaume');
  porte(c,x0+S(3),bas-S(2)-Math.max(8,S(11)),Math.max(5,S(8)),Math.max(8,S(11)),BOIS,true);
  fenetre(sp,c,x0+w-S(9),bas-S(2)-h+S(3),Math.max(4,S(5)),Math.max(4,S(6)),B,pick(PAL.volets),{on:chance(.5)});

  /* --- LE SÉCHOIR : un auvent large, deux perches, les bottes la tête
     en bas. Chaque botte est un petit triangle inversé + sa ligature. --- */
  { const ax=cote>0 ? x0+w : x0-Math.max(16,S(23));
    const aw=Math.max(16,S(23)), ah=Math.max(11,S(15));
    appentis(c,ax,bas-S(2),aw,ah,BOIS[1],PAL.toits.ocre,cote>0?1:-1);
    for(let k=0;k<2;k++){
      const py2=bas-S(2)-ah+S(4)+k*Math.max(5,S(7));
      fr(c,ax+1,py2,aw-2,1,BOIS[3]);
      for(let i=2;i<aw-3;i+=Math.max(3,S(5))){
        const col=pick(VERTS), bh2=Math.max(4,S(6)), bw2=Math.max(3,S(4));
        fr(c,ax+i,py2+1,bw2,1,'#a89a72');                        // la ligature
        for(let j=1;j<bh2;j++){
          const t=j/bh2, wj=Math.max(1,Math.round(bw2*(1-t*0.7)));
          fr(c,ax+i+((bw2-wj)>>1),py2+1+j,wj,1, (j%2)?col:ombre(col,.16));
        }
      }
    } }
  // le jardin de simples : planches étroites, rangs serrés, deux floraisons
  { const jx=cote>0 ? x0-S(16) : x0+w+S(4);
    const jw=Math.max(14,S(18));
    fr(c,jx,bas-S(2),jw,Math.max(2,S(3)),'#6b5a42');
    for(let k=0;k<3;k++){
      const ry=bas-S(3)-k*Math.max(2,S(3));
      for(let i=0;i<jw;i+=2){
        const col=pick(VERTS);
        fr(c,jx+i,ry-Math.max(1,S(2)),1,Math.max(1,S(2)),col);
        if(chance(.18)) fr(c,jx+i,ry-Math.max(2,S(3)),1,1,pick(['#d8c34a','#c9739a','#e0dcc0']));
      }
    } }
  // le mortier sur son billot
  { const mx=x0+w+(cote>0?S(2):-S(8));
    fr(c,mx-S(2),bas-S(5),Math.max(5,S(7)),S(4),'#6d5236');
    fr(c,mx-S(2),bas-S(5),Math.max(5,S(7)),1,'#8f6f4a');
    fr(c,mx-1,bas-S(8),Math.max(4,S(5)),Math.max(3,S(4)),'#9aa0a6');
    fr(c,mx-1,bas-S(8),Math.max(4,S(5)),1,'#c2c8ce');
    trait(c,mx+1,bas-S(9),mx+2,bas-S(12),'#8a6a45',1); }
  if(chance(.7)) chatDormi(c,x0+RI(S(3),w-S(9)),bas-S(2),pick(PELAGES));
  brume(sp,row); return sp;
}

/* ---------- LE SCRIPTORIUM ----------
   Haut, étroit, tout en fenêtres : on n'y fait rien d'autre que copier,
   et il faut du jour. Baies géminées à vitrail froid, contrefort, le
   pupitre visible au rez et la lanterne qui brûle toute la nuit. */
function genScriptorium(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(22), h=S(30), toitH=S(15);
  const SW=w+S(26), SH=h+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(12);
  const p=AMB.pierre, B=AMB.bois;
  const cote=chance(.5)?1:-1;

  socle(c,x0-S(2),bas-S(5),w+S(4),S(5),p);
  mur(c,x0,bas-h,w,h,p,3,'taille');
  // contrefort d'angle, qui donne l'échelle
  { const cw=Math.max(4,S(6));
    const cxx=cote>0?x0-cw+1:x0+w-1;
    for(let j=0;j<Math.round(h*0.78);j++){
      const wj=Math.max(2,Math.round(cw*(1-0.35*j/(h*0.78))));
      fr(c,cote>0?cxx+cw-wj:cxx,bas-j,wj,1, (j%5===4)?p[2]:p[1]);
      fr(c,cote>0?cxx+cw-wj:cxx,bas-j,1,1,clair(p[0],.14));
    }
    fr(c,cxx-1,bas-Math.round(h*0.78),cw+2,Math.max(2,S(3)),p[2]);
    fr(c,cxx-1,bas-Math.round(h*0.78),cw+2,1,clair(p[0],.20)); }

  // deux étages de baies géminées
  for(let et=0;et<2;et++){
    const fy=bas-h+S(5)+et*Math.round(h*0.40);
    for(let k=0;k<2;k++){
      const fw=Math.max(4,S(6)), fh=Math.max(8,S(12));
      const fx=x0+S(4)+k*(w-S(8)-fw);
      fenetre(sp,c,fx,fy,fw,fh,B,pick(PAL.volets),{arc:true,vitrail:true,on:et===0?true:chance(.6),volets:false});
    }
    // colonnette entre les deux baies
    fr(c,x0+(w>>1),fy+1,Math.max(1,S(2)),Math.max(6,S(10)),clair(p[0],.10));
  }
  porte(c,x0+((w-Math.max(6,S(9)))>>1),bas-S(5)-Math.max(9,S(13)),Math.max(6,S(9)),Math.max(9,S(13)),B,true);
  toitPignon(c,x0-S(4),bas-h-toitH,w+S(8),toitH,PAL.toits.ardoise);
  // épi de faîtage : une plume de fer
  { const cx2=x0+(w>>1);
    fr(c,cx2,bas-h-toitH-Math.max(4,S(6)),1,Math.max(4,S(6)),'#5a5e66');
    for(let j=0;j<Math.max(3,S(4));j++)
      fr(c,cx2-1,bas-h-toitH-Math.max(4,S(6))+j,3,1, j===0?'#8d9199':'#6a6e77'); }

  // le pupitre, entrevu par la porte entrouverte
  { const px2=x0+((w-Math.max(6,S(9)))>>1)+S(2);
    fr(c,px2,bas-S(5)-Math.max(9,S(13))+S(3),Math.max(4,S(5)),Math.max(6,S(9)),'#1b1712');
    trait(c,px2,bas-S(5)-S(3),px2+Math.max(3,S(4)),bas-S(5)-Math.max(6,S(8)),'#6d5236',1);
    fr(c,px2+1,bas-S(5)-Math.max(7,S(9)),Math.max(3,S(4)),Math.max(1,S(2)),'#e6dcc0');
    sp.lampes.push({x:px2+S(2),y:bas-S(5)-Math.max(7,S(9)),c:'#ffd88a',r:S(10)}); }
  lanternePotence(sp,c,cote>0?x0+w+S(1):x0-S(3),bas-h+S(8),B);
  if(chance(.6)) chatAuBalcon(c,x0+RI(S(3),w-S(8)),bas-h+S(3),pick(PELAGES),null);
  brume(sp,row); return sp;
}

/* ---------- LA TAVERNE ----------
   L'édifice le plus éclairé du bourg. Colombage large, enseigne à
   potence, tonneaux en pile, bancs et table dehors, et de la lumière à
   toutes les fenêtres — c'est là que les écus changent de patte. */
function genTaverne(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(32), h=S(15), gab=S(12), toitH=S(15);
  const SW=w+S(32), SH=h+gab+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(14);
  const B=AMB.bois, p=AMB.pierre;
  const cote=chance(.5)?1:-1;

  socle(c,x0-1,bas-S(4),w+2,S(4),p);
  mur(c,x0,bas-h,w,h,p,3);
  // l'étage déborde sur ses corbeaux : c'est ce qui fait l'auberge
  const enc=Math.max(2,S(4));
  for(let i=S(3);i<w;i+=Math.max(5,S(8))){
    fr(c,x0+i,bas-h-1,Math.max(2,S(3)),Math.max(2,S(3)),B[1]);
    fr(c,x0+i,bas-h-1,Math.max(2,S(3)),1,B[2]);
  }
  colombage(c,x0-enc,bas-h-gab,w+enc*2,gab,pick(PAL.platre),B,'croix');
  toitVarie(c,x0-enc-S(4),bas-h-gab-toitH,w+enc*2+S(8),toitH,pick(AMB.toits));

  // grande porte à deux vantaux et fenêtres allumées
  porte(c,x0+Math.round(w*0.40),bas-Math.max(10,S(14)),Math.max(8,S(12)),Math.max(10,S(14)),B,true);
  for(let k=0;k<2;k++)
    fenetre(sp,c,x0+S(3)+k*(w-S(9)),bas-h+S(4),Math.max(5,S(7)),Math.max(5,S(8)),B,pick(PAL.volets),{on:true});
  for(let k=0;k<3;k++)
    fenetre(sp,c,x0-enc+S(3)+k*Math.round((w+enc*2-S(9))/3),bas-h-gab+S(3),Math.max(4,S(6)),Math.max(5,S(7)),B,pick(PAL.volets),{on:chance(.8)});

  // l'enseigne à potence, avec sa chope
  { const ew=Math.max(10,S(14)), eh=Math.max(7,S(10));
    const ex=cote>0 ? x0+w+S(2) : x0-ew-S(2);
    const ey=bas-h-S(2);
    fr(c,cote>0?x0+w-1:x0,ey-S(3),1,Math.max(4,S(6)),'#3b3f46');
    trait(c,cote>0?x0+w:x0,ey-S(3),ex+(cote>0?0:ew),ey-S(3),'#3b3f46',1);
    fr(c,ex+(ew>>1),ey-S(3),1,Math.max(2,S(3)),'#3b3f46');
    fr(c,ex,ey,ew,eh,'#3a2c1e');
    fr(c,ex,ey,ew,1,'#5c4630');
    { const gx2=ex+(ew>>1)-Math.max(2,S(3)), gy2=ey+Math.max(2,S(3));
      const cw2=Math.max(4,S(6)), ch2=Math.max(4,S(6));
      fr(c,gx2,gy2,cw2,ch2,'#c9a24a');
      fr(c,gx2,gy2,cw2,1,'#e8d9a0');
      fr(c,gx2+cw2,gy2+1,Math.max(1,S(2)),Math.max(2,S(3)),'#c9a24a');
      fr(c,gx2,gy2-1,cw2,1,'#f2ecd8'); }
    sp.enseigne={x:ex+(ew>>1),y:ey+1,w:ew,h:eh};
    sp.lampes.push({x:ex+(ew>>1),y:ey-1,c:'#ffbe63',r:S(14)}); }

  // tonneaux, table et bancs
  { const tx=cote>0 ? x0-S(14) : x0+w+S(3);
    for(let k=0,n=RI(3,5);k<n;k++){
      const bw2=Math.max(5,S(7)), bh2=Math.max(6,S(9));
      const bxx=tx+(k%3)*(bw2+1), byy=bas-Math.floor(k/3)*(bh2-1);
      for(let j=0;j<bh2;j++){
        const t=Math.abs(j/(bh2-1)-0.5)*2;
        const wj=Math.max(3,Math.round(bw2*(1-0.16*t)));
        fr(c,bxx+((bw2-wj)>>1),byy-bh2+j,wj,1, (j<2)?'#a9855a':(j%4===3?'#5a412a':'#7d5a37'));
      }
      fr(c,bxx-1,byy-bh2+2,bw2+2,1,'#4a4238');
      fr(c,bxx-1,byy-Math.round(bh2*0.35),bw2+2,1,'#4a4238');
    } }
  { const mx=cote>0 ? x0+w+S(3) : x0-S(16);
    fr(c,mx,bas-S(6),Math.max(11,S(15)),Math.max(2,S(3)),'#7d5a37');
    fr(c,mx,bas-S(6),Math.max(11,S(15)),1,'#a9855a');
    fr(c,mx+1,bas-S(4),Math.max(1,S(2)),S(4),'#4a3826');
    fr(c,mx+Math.max(9,S(13)),bas-S(4),Math.max(1,S(2)),S(4),'#4a3826');
    for(let k=0;k<2;k++)
      fr(c,mx+S(2)+k*Math.max(6,S(9)),bas-S(3),Math.max(5,S(7)),Math.max(1,S(2)),'#6d5236'); }
  if(chance(.9)) chatAssis(c,cote>0?x0+w+S(6):x0-S(9),bas,pick(PELAGES),cote>0?-1:1,robeChat(PELAGES[0]));
  souche(sp,c,x0+Math.round(w*0.24),bas-h-gab-toitH,toitH,Math.max(6,S(9)),Math.max(5,S(7)),pick(PAL.brique),0.45,'brique',1.4);
  chatteries(sp,c,x0,bas,w,h+gab,row);
  brume(sp,row); return sp;
}

/* ---------- LE CHAMP ----------
   Une parcelle labourée, ses sillons en perspective écrasée, les rangs
   de blé en trois hauteurs, l'épouvantail de guingois et la borne de
   pierre au coin. C'est large et bas : ça remplit une terrasse. */
function genChamp(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(58), h=S(14);
  const SW=w+S(8), SH=h+S(8);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(4);
  const B=AMB.bois;
  const TERRE=['#6b5a42','#7d6b4e','#5a4b36','#8a7659'];
  const BLE=['#c9a94e','#d8bd66','#b0913c','#e0cf86'];

  // la terre : sillons obliques, plus serrés vers le fond
  for(let j=0;j<h;j++){
    const t=j/h;
    fr(c,x0,bas-h+j,w,1, t<0.35?TERRE[2]:TERRE[0]);
    const pas=Math.max(2,Math.round(S(4)*(0.5+t)));
    for(let i=Math.round(j*0.6)%pas;i<w;i+=pas)
      fr(c,x0+i,bas-h+j,1,1, chance(.5)?TERRE[1]:TERRE[3]);
  }
  fr(c,x0,bas-h,w,1,ombre(TERRE[2],.22));
  // les rangs de blé, du fond vers l'avant : trois hauteurs
  for(let k=0;k<4;k++){
    const ry=bas-h+S(2)+Math.round(k*(h-S(3))/4);
    const eh=Math.max(3,Math.round(S(4)+k*S(1.2)));
    for(let i=RI(0,2);i<w;i+=Math.max(1,S(2))){
      const col=pick(BLE);
      fr(c,x0+i,ry-eh,1,eh,col);
      fr(c,x0+i,ry-eh,1,Math.max(1,Math.round(eh*0.35)),clair(col,.16));   // l'épi
      if(chance(.14)) fr(c,x0+i,ry-eh-1,1,1,BLE[3]);
    }
    fr(c,x0,ry,w,1,ombre(TERRE[0],.18));
  }
  // l'épouvantail : croix de perches, tunique, tête de toile, chapeau
  { const ex=x0+Math.round(w*R(0.25,0.75)), ey=bas-h+S(3);
    const eh=Math.max(10,S(15));
    fr(c,ex,ey-eh,Math.max(1,S(2)),eh,'#5c452d');
    fr(c,ex-Math.max(4,S(6)),ey-eh+Math.max(3,S(5)),Math.max(9,S(13)),1,'#5c452d');
    const tun=pick(['#8a6a4e','#6b7a8a','#8a5a5a','#6f7a5a']);
    fr(c,ex-Math.max(2,S(3)),ey-eh+Math.max(3,S(5)),Math.max(5,S(7)),Math.max(5,S(8)),tun);
    fr(c,ex-Math.max(2,S(3)),ey-eh+Math.max(3,S(5)),Math.max(5,S(7)),1,clair(tun,.18));
    disque(c,ex,ey-eh+Math.max(1,S(2)),Math.max(2,S(3)),'#d8cbaa');
    fr(c,ex-Math.max(3,S(4)),ey-eh,Math.max(7,S(9)),1,'#a89060');
    fr(c,ex-Math.max(2,S(3)),ey-eh-Math.max(1,S(2)),Math.max(5,S(7)),Math.max(1,S(2)),'#a89060');
    fr(c,ex-1,ey-eh+Math.max(1,S(2)),1,1,'#2a231a'); fr(c,ex+1,ey-eh+Math.max(1,S(2)),1,1,'#2a231a'); }
  // la borne et la faux appuyée
  { const bx2=chance(.5)?x0+S(2):x0+w-S(6);
    fr(c,bx2,bas-S(6),Math.max(3,S(4)),Math.max(5,S(7)),'#8a8272');
    fr(c,bx2,bas-S(6),Math.max(3,S(4)),1,'#a8a294');
    trait(c,bx2+S(3),bas-S(1),bx2+S(5),bas-S(12),B[1],1);
    trait(c,bx2+S(5),bas-S(12),bx2+S(11),bas-S(10),'#9aa0a6',1); }
  brume(sp,row); return sp;
}

/* ---------- LE RUCHER ----------
   Cinq ruches de paille sur leur banc de pierre, la haie fleurie
   derrière, l'enfumoir qui pend au piquet, et le nuage d'abeilles rendu
   par quelques pixels ambrés — il ne faut pas plus. */
function genRucher(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(34), h=S(16);
  const SW=w+S(12), SH=h+S(12);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(6);
  const B=AMB.bois, p=AMB.pierre;

  // la haie du fond, fleurie
  for(let i=0;i<w+S(6);i++){
    const hh=Math.round(S(9)+Math.sin(i*0.32)*S(2));
    for(let j=0;j<hh;j++){
      const col=(rnd()<0.30)?'#3f5a30':((rnd()<0.5)?'#4a6338':'#5d7247');
      fr(c,x0-S(3)+i,bas-S(4)-j,1,1,col);
    }
    if(chance(.09)) fr(c,x0-S(3)+i,bas-S(4)-RI(2,S(8)),1,1,pick(['#e6dcc0','#d8c34a','#c9739a']));
  }
  // le banc de pierre
  socle(c,x0-S(2),bas-S(4),w+S(4),S(4),p);
  fr(c,x0-S(2),bas-S(4),w+S(4),1,clair(p[0],.18));
  // les ruches : cloches de paille tressée
  for(let k=0;k<5;k++){
    const rw=Math.max(6,S(8)), rh=Math.max(7,S(10));
    const rx=x0+S(1)+k*Math.round((w-S(2)-rw)/4);
    for(let j=0;j<rh;j++){
      const t=j/(rh-1);
      const wj=Math.max(2,Math.round(rw*Math.sin(Math.PI*0.5*(0.25+0.75*t))));
      const col=(j%2)?'#c9a860':'#b09048';
      fr(c,rx+((rw-wj)>>1),bas-S(4)-rh+j,wj,1,col);
      fr(c,rx+((rw-wj)>>1),bas-S(4)-rh+j,1,1,'#d8bd7c');
      fr(c,rx+((rw-wj)>>1)+wj-1,bas-S(4)-rh+j,1,1,'#8a7038');
    }
    fr(c,rx+(rw>>1)-1,bas-S(5),Math.max(2,S(3)),Math.max(1,S(2)),'#3a2f1c');   // le trou de vol
    fr(c,rx+(rw>>1)-1,bas-S(4)-rh-1,Math.max(2,S(3)),1,'#8a7038');
    // les abeilles
    for(let a=0,n=RI(2,5);a<n;a++)
      fr(c,rx+RI(-S(3),rw+S(3)),bas-S(6)-RI(0,S(7)),1,1,chance(.5)?'#e0b03a':'#8a6a20');
  }
  // le piquet, l'enfumoir et le voile
  { const px2=x0+w+S(2);
    fr(c,px2,bas-S(14),Math.max(1,S(2)),S(14),B[1]);
    fr(c,px2-S(2),bas-S(12),Math.max(4,S(5)),Math.max(4,S(6)),'#7a7e86');
    fr(c,px2-S(2),bas-S(12),Math.max(4,S(5)),1,'#a2a8b0');
    fr(c,px2-S(1),bas-S(13),Math.max(2,S(3)),1,'#5a5e66');
    sp.fumees.push({x:px2,y:bas-S(13),t:13,d:0.35}); }
  brume(sp,row); return sp;
}

/* ---------- L'ORFÈVRE ----------
   Petit, riche, fermé : vitrine grillagée de fer, volet à barreaux,
   balance de précision sur son socle, four à coupelle et coffret ferré.
   Le seul bâtiment du bourg qui ait une serrure. */
function genOrfevre(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(20), h=S(18), toitH=S(12);
  const SW=w+S(24), SH=h+toitH+S(10);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(12);
  const p=AMB.pierre, B=AMB.bois;
  const OR='#d8b048', ORC='#f2dc9a';
  const cote=chance(.5)?1:-1;

  socle(c,x0-1,bas-S(4),w+2,S(4),p);
  mur(c,x0,bas-h,w,h,p,3,'taille');
  toitMansart(c,x0-S(4),bas-h-toitH,w+S(8),toitH,PAL.toits.ardoise);

  // la vitrine : baie basse, grille de fer, quelques pièces qui brillent
  { const vw=Math.max(9,S(13)), vh=Math.max(6,S(9));
    const vx2=x0+((w-vw)>>1), vy=bas-S(4)-vh-S(2);
    fr(c,vx2-1,vy-1,vw+2,vh+2,'#3b3f46');
    for(let j=0;j<vh;j++) fr(c,vx2,vy+j,vw,1, mix('#141a20','#2c3742',j/vh));
    for(let i=1;i<vw;i+=Math.max(2,S(3))) fr(c,vx2+i,vy,1,vh,'#5a5e66');
    fr(c,vx2,vy+Math.round(vh*0.5),vw,1,'#5a5e66');
    for(let k=0,n=RI(2,4);k<n;k++){
      const gx2=vx2+RI(1,Math.max(1,vw-3)), gy2=vy+RI(1,Math.max(1,vh-2));
      fr(c,gx2,gy2,Math.max(1,S(2)),1,chance(.5)?OR:'#cdd6de');
      fr(c,gx2,gy2,1,1,ORC);
    }
    sp.fenetres.push({x:vx2,y:vy,w:vw,h:vh,ph:rnd()*6.28,on:true,vitrail:false}); }
  porte(c,cote>0?x0+S(2):x0+w-S(9),bas-S(4)-Math.max(8,S(11)),Math.max(5,S(7)),Math.max(8,S(11)),B,true);
  // l'écusson à la balance
  ecusson(c,cote>0?x0+w-S(8):x0+S(3),bas-h+S(3),Math.max(6,S(8)),Math.max(7,S(10)),AMB.blason,'etoile',true);
  // le four à coupelle, dehors sous un demi-toit
  { const fx=cote>0 ? x0+w+S(2) : x0-Math.max(9,S(12));
    const fw=Math.max(9,S(12)), fh=Math.max(7,S(10));
    futBrique(c,bas-S(2)-fh,fh,()=>[fx,fw],pick(PAL.brique),false);
    fr(c,fx+S(2),bas-S(4),Math.max(4,S(5)),Math.max(2,S(3)),'#1a120a');
    fr(c,fx+S(2),bas-S(4)+1,Math.max(4,S(5)),1,'#ff9a3a');
    sp.lampes.push({x:fx+S(4),y:bas-S(4),c:'#ffb25a',r:S(10)});
    sp.fumees.push({x:fx+(fw>>1),y:bas-S(2)-fh-1,t:3,d:0.55});
    // la balance sur son socle
    const bx2=fx+((fw-Math.max(6,S(8)))>>1);
    fr(c,bx2+S(3),bas-S(2)-fh-Math.max(5,S(7)),1,Math.max(5,S(7)),'#8d9199');
    fr(c,bx2,bas-S(2)-fh-Math.max(5,S(7)),Math.max(7,S(9)),1,'#c2c8ce');
    fr(c,bx2,bas-S(2)-fh-Math.max(4,S(6))+1,Math.max(2,S(3)),1,'#8d9199');
    fr(c,bx2+Math.max(5,S(7)),bas-S(2)-fh-Math.max(4,S(6))+1,Math.max(2,S(3)),1,'#8d9199'); }
  lanternePotence(sp,c,cote>0?x0-S(2):x0+w+S(1),bas-h+S(6),B);
  brume(sp,row); return sp;
}

/* ---------- LE PORTAIL D'EXPÉDITION ----------
   Trois pierres levées qui n'ont jamais été taillées par le bourg :
   deux montants gravés et un linteau, et entre eux un voile de lumière
   qui ne tient à rien. Le brasero au pied, la bannière, les offrandes.
   C'est par là que part l'armée. */
function genPortail(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(34), h=S(34);
  const SW=w+S(22), SH=h+S(14);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(11);
  const p=AMB.pierre, B=AMB.bois;
  const acc=pick(['#5f9ad0','#7f6fc0','#4fa88f']);

  // tertre de terre battue
  for(let j=0;j<S(4);j++){
    const wj=Math.round((w+S(16))*(1-j/S(5)));
    fr(c,x0-S(8)+(((w+S(16))-wj)>>1),bas-j,wj,1, j<2?'#6b5a42':'#5a4b36');
  }
  // les deux montants : mégalithes irréguliers, gravés de spirales
  const mw=Math.max(7,S(10));
  for(let k=0;k<2;k++){
    const mx=x0+k*(w-mw);
    for(let j=0;j<h;j++){
      const t=j/h;
      const wj=Math.max(4,Math.round(mw*(0.86+0.14*Math.sin(j*0.4+k*2))));
      const xx=mx+((mw-wj)>>1);
      const col= t>0.7?p[1] : (t>0.3?p[2]:p[3]);
      fr(c,xx,bas-S(3)-j,wj,1,col);
      fr(c,xx,bas-S(3)-j,1,1,clair(p[0],.16));
      fr(c,xx+wj-1,bas-S(3)-j,1,1,ombre(p[3],.22));
      if(chance(.12)) fr(c,xx+RI(1,Math.max(1,wj-2)),bas-S(3)-j,1,1,ombre(p[3],.30));
    }
    // les gravures : trois spirales lumineuses
    for(let s2=0;s2<3;s2++){
      const gy=bas-S(6)-Math.round(h*(0.25+s2*0.22));
      const gr=Math.max(2,S(3));
      for(let a=0;a<10;a++){
        const an=a/10*6.283*1.4, rr2=gr*(0.25+a/12);
        fr(c,mx+(mw>>1)+Math.round(Math.cos(an)*rr2),gy+Math.round(Math.sin(an)*rr2),1,1,acc);
      }
    }
  }
  // le linteau
  { const ly=bas-S(3)-h;
    fr(c,x0-S(3),ly-Math.max(5,S(7)),w+S(6),Math.max(5,S(7)),p[2]);
    fr(c,x0-S(3),ly-Math.max(5,S(7)),w+S(6),1,clair(p[0],.22));
    fr(c,x0-S(3),ly-1,w+S(6),1,ombre(p[3],.28));
    for(let i=0;i<w+S(6);i+=Math.max(3,S(5))) if(chance(.4))
      fr(c,x0-S(3)+i,ly-Math.max(3,S(4)),Math.max(1,S(2)),1,acc); }

  /* --- LE VOILE. Entre les montants, une nappe verticale de lumière
     froide : des colonnes d'alpha décroissant, plus dense au centre. */
  { const vx2=x0+mw, vw=w-mw*2;
    for(let i=0;i<vw;i++){
      const t=1-Math.abs(i/(vw-1)-0.5)*2;
      for(let j=0;j<h;j++){
        const u=1-j/h;
        if(rnd()<0.30*t*(0.35+u*0.65))
          fr(c,vx2+i,bas-S(3)-j,1,1, mix(acc,'#eaf4ff',rnd()*0.7));
      }
    }
    fr(c,vx2,bas-S(3)-h,vw,1,'#eaf4ff');
    sp.lampes.push({x:vx2+(vw>>1),y:bas-S(3)-Math.round(h*0.5),c:acc,r:S(26)}); }

  // brasero, bannière et offrandes
  { const bx2=x0-S(7);
    fr(c,bx2,bas-S(6),Math.max(5,S(7)),Math.max(4,S(5)),'#3d3f45');
    fr(c,bx2,bas-S(6),Math.max(5,S(7)),1,'#6a6e77');
    fr(c,bx2+S(1),bas-S(3),1,S(3),'#3d3f45'); fr(c,bx2+S(4),bas-S(3),1,S(3),'#3d3f45');
    fr(c,bx2+1,bas-S(7),Math.max(3,S(5)),Math.max(1,S(2)),'#ff8a2a');
    sp.brasier={x:bx2+S(3),y:bas-S(7),r:S(12),c:'#ff8a2a'};
    sp.lampes.push({x:bx2+S(3),y:bas-S(7),c:'#ff9a3a',r:S(14)}); }
  { const hx=x0+w+S(4);
    fr(c,hx,bas-S(3)-Math.round(h*0.9),1,Math.round(h*0.9),'#3a2c1e');
    sp.drapeaux.push({x:hx+1,y:bas-S(3)-Math.round(h*0.9)+S(2),w:Math.max(6,S(9)),h:Math.max(8,S(12)),col:AMB.blason}); }
  brume(sp,row); return sp;
}

/* ---------- LA DESCENTE ----------
   Le puits sans fond. Une margelle cyclopéenne, la cage d'escalier qui
   plonge dans un noir que rien n'éclaire, le treuil et sa chaîne, les
   lanternes accrochées par ceux qui descendent, et la brume froide qui
   sort du trou. C'est l'entrée de l'Aventure. */
function genDescente(row){
  const S=v=>Math.max(1,sc(row,v));
  const w=S(34), h=S(12);
  const SW=w+S(28), SH=h+S(34);
  const sp=sprite(SW,SH), c=sp.g;
  const bas=SH-1, x0=S(14);
  const p=AMB.pierre, B=AMB.bois;

  // la margelle : gros blocs, l'un descellé
  mur(c,x0,bas-h,w,h,p,3,'taille');
  fr(c,x0-S(2),bas-h-Math.max(2,S(3)),w+S(4),Math.max(2,S(3)),p[2]);
  fr(c,x0-S(2),bas-h-Math.max(2,S(3)),w+S(4),1,clair(p[0],.22));
  fr(c,x0+Math.round(w*0.7),bas-h-Math.max(4,S(6)),Math.max(5,S(7)),Math.max(3,S(4)),p[1]);
  fr(c,x0+Math.round(w*0.7),bas-h-Math.max(4,S(6)),Math.max(5,S(7)),1,clair(p[0],.14));

  /* --- LE TROU. Une ouverture ovale d'un noir plein, avec quelques
     marches qui s'y enfoncent en spirale et disparaissent au troisième
     tour : c'est ce qui donne la profondeur. --- */
  { const ow=Math.round(w*0.62), oh=Math.max(6,S(9));
    const ox=x0+((w-ow)>>1), oy=bas-h-Math.max(2,S(3))-oh+S(2);
    ellipse(c,ox+(ow>>1),oy+(oh>>1),ow>>1,oh>>1,'#07090c');
    ellipse(c,ox+(ow>>1),oy+(oh>>1)-1,(ow>>1)-1,Math.max(1,(oh>>1)-1),'#0b0e13');
    for(let k=0;k<7;k++){
      const t=k/7, an=t*4.2;
      const mx=ox+(ow>>1)+Math.round(Math.cos(an)*(ow*0.36)*(1-t*0.7));
      const my=oy+(oh>>1)+Math.round(Math.sin(an)*(oh*0.34)*(1-t*0.7))+Math.round(t*S(3));
      const col=mix('#5a5346','#0a0c10',t);
      fr(c,mx-Math.max(1,S(2)),my,Math.max(3,S(4)),1,col);
    }
    sp.fumees.push({x:ox+(ow>>1),y:oy+2,t:13,d:0.85}); }

  /* --- LE CHEVALEMENT : deux jambes en A, la traverse, la poulie, la
     chaîne et son crochet. --- */
  { const cx2=x0+(w>>1), ch=Math.max(20,S(28));
    trait(c,cx2-Math.round(w*0.34),bas-h-Math.max(2,S(3)),cx2-S(3),bas-h-ch,B[1],Math.max(1,S(2)));
    trait(c,cx2+Math.round(w*0.34),bas-h-Math.max(2,S(3)),cx2+S(3),bas-h-ch,B[1],Math.max(1,S(2)));
    trait(c,cx2-Math.round(w*0.22),bas-h-Math.round(ch*0.42),cx2+Math.round(w*0.22),bas-h-Math.round(ch*0.42),B[1],1);
    trait(c,cx2-Math.round(w*0.26),bas-h-Math.round(ch*0.22),cx2+Math.round(w*0.18),bas-h-Math.round(ch*0.62),B[3],1);
    fr(c,cx2-S(4),bas-h-ch-Math.max(2,S(3)),S(8),Math.max(2,S(3)),B[0]);
    fr(c,cx2-S(4),bas-h-ch-Math.max(2,S(3)),S(8),1,B[2]);
    disque(c,cx2,bas-h-ch,Math.max(2,S(4)),'#4a4238');
    disque(c,cx2,bas-h-ch,Math.max(1,S(2)),'#7a7e86');
    sp.poulie={x:cx2,y:bas-h-ch+1,l:Math.round(ch*0.7)};
    // le treuil et son volant, à droite du puits
    const tx=x0+w+S(2);
    fr(c,tx,bas-S(8),Math.max(6,S(9)),Math.max(4,S(6)),'#6a5136');
    fr(c,tx,bas-S(8),Math.max(6,S(9)),1,'#8f6f4a');
    for(let a=0;a<10;a++)
      fr(c,tx+S(4)+Math.round(Math.cos(a/10*6.283)*S(4)),bas-S(6)+Math.round(Math.sin(a/10*6.283)*S(4)),1,1,'#3f434a'); }

  // les lanternes des descendants, pendues au portique
  for(let k=0;k<2;k++){
    const lx=x0+Math.round(w*(0.26+k*0.48));
    fr(c,lx,bas-h-Math.max(6,S(9)),1,Math.max(3,S(4)),'#3b3f46');
    fr(c,lx-1,bas-h-Math.max(3,S(5)),3,Math.max(3,S(4)),'#2f3339');
    fr(c,lx,bas-h-Math.max(3,S(5))+1,1,Math.max(1,S(2)),'#ffd88a');
    sp.lampes.push({x:lx,y:bas-h-Math.max(3,S(5))+1,c:'#ffcf7a',r:S(11)});
  }
  // la stèle des profondeurs, gravée d'encoches
  { const sx=x0-S(8);
    fr(c,sx,bas-Math.max(9,S(13)),Math.max(4,S(5)),Math.max(9,S(13)),p[2]);
    fr(c,sx,bas-Math.max(9,S(13)),Math.max(4,S(5)),1,clair(p[0],.20));
    for(let k=0;k<5;k++) fr(c,sx+1,bas-Math.max(8,S(12))+k*Math.max(2,S(2)),Math.max(2,S(3)),1,ombre(p[3],.34)); }
  brume(sp,row); return sp;
}

/* ==================================================================
   17. INTERFACE DE JEU — window.Village
   ------------------------------------------------------------------
   Le moteur ci-dessus sait dessiner un bourg ; il ne sait rien d'une
   économie. Cette dernière section lui donne des OREILLES : le jeu pose
   les édifices un par un, affecte les habitants, allume ou éteint les
   ateliers, et lit en retour la position à l'écran de chaque bâtiment
   pour y accrocher ses fenêtres flottantes.
   ================================================================== */

function fermerFiche(){ fichePour=null; }

/* animations qui ne jouent QUE si l'atelier tourne */
const TRAVAIL_ANIM={moulin:1,roue:1,brasier:1,chaudron:1,poulie:1,mannequin:1,cheminee:1,flamme:1};
const ACTIFS=new Set();          // ids des bâtiments en production
const MODELES={};                // gabarits d'aperçu, un par type et par rangée
let PLAN=[];                     // le plan du bourg : [{id,type,r,xr}]
let modeCons=null;               // type d'édifice en cours de pose
let apercu=null;                 // résultat de la recherche de pose
let selId=null;                  // édifice sélectionné par le jeu
let pings=[];                    // petites auréoles de production terminée
let listeners={};

function modeleDe(type,r,pal){
  pal=pal|0;
  const k=type+'#'+r+'#'+pal;
  if(!MODELES[k]){
    const garde=PAL_COUR;
    PAL_COUR=pal;
    try{ MODELES[k]=parer(GEN[type](r),pal,type); }
    catch(err){ console.warn('générateur en panne :',type,err); MODELES[k]=genMaison(r); }
    PAL_COUR=garde;
  }
  return MODELES[k];
}
function oublierModele(type,r,pal){ delete MODELES[type+'#'+r+'#'+(pal|0)]; }

/* ------------------------------------------------------------------
   LA RECHERCHE DE PARCELLE, en deux passes.

   1. On cherche une VRAIE trouée : rien du tout à cet endroit.
   2. Si la terrasse est pleine de buissons, de rochers et d'arbres, on
      DÉFRICHE. C'est ce que fait un vrai bourg : on n'abandonne pas un
      moulin parce qu'il y a des ronces. Ce qui ne cède JAMAIS la place,
      ce sont les autres édifices et les parcelles réservées (volées
      d'escalier, champs) — celles-là portent `vide`.
   ------------------------------------------------------------------ */
function libreHorsDecor(r,x0,x1){
  for(const b of batiments){ const wB=EMPRISE(b), m=Math.round(wB*0.175);
    if(b.r===r && x1>b.x+m && x0<b.x+wB-m) return false; }
  for(const o of decors){
    if(!o.vide) continue;                       // seules les réserves comptent
    if(o.r===r && x1>o.x && x0<o.x+o.sp.w) return false; }
  return true;
}
function decorsSous(r,x0,x1){
  const out=[];
  for(let i=0;i<decors.length;i++){
    const o=decors[i];
    if(o.vide||o.r!==r) continue;
    const m=Math.round(o.sp.w*0.14);
    if(x1>o.x+m && x0<o.x+o.sp.w-m) out.push(o);
  }
  return out;
}
function chercherPose(type,vx,rVoulue,pal){
  const permis=RANGEES[type]||[0,1,2];
  const rows=(rVoulue!=null)?[rVoulue]:permis;
  let best=null;
  const passe=(test,defricher)=>{
    for(const r of rows){
      if(!permis.includes(r)) continue;
      const sp=modeleDe(type,r,pal);
      const x0=Math.round(vx-sp.w/2);
      const pasMax=Math.round(W*0.55);
      for(let d=0;d<=pasMax;d+=3){
        const essais=d? [x0-d,x0+d] : [x0];
        let trouve=null;
        for(const bx of essais){
          if(bx>=1 && bx+sp.w<=W-1 && test(r,bx,bx+sp.w)){ trouve=bx; break; }
        }
        if(trouve!=null){
          if(!best||d<best.d) best={r,sp,bx:trouve,d,defricher};
          break;
        }
      }
    }
  };
  passe(libre,false);
  if(best) return best;
  passe(libreHorsDecor,true);
  return best;
}

/* La rangée que DÉSIGNE le curseur : celle dont le sol est le plus proche
   du point cliqué, parmi celles où le type a le droit de s'installer. */
function rangeeSous(type,px,py){
  const rows=RANGEES[type]||[0,1,2];
  let best=rows[0], bd=1e9;
  for(const r of rows){
    const d=Math.abs(solY(r,clamp(px|0,0,W-1))-py);
    if(d<bd){ bd=d; best=r; }
  }
  return best;
}

/* `pour` : on cherche la parcelle avec l'emprise de CE type-là, mais on
   pose le sprite de `type`. C'est ainsi qu'un échafaudage réserve
   exactement la place du moulin qu'il deviendra. */
function poserBatiment(type,vx,rVoulue,id,pour,pal){
  if(!GEN[type]) return null;
  pal=pal|0;
  /* l'emprise se cherche AU PALIER FINAL : un atelier qui s'enrichit ne
     doit pas déborder sur son voisin le jour où il change de toiture. */
  const t=chercherPose(pour||type,vx,rVoulue,pour?0:pal);
  if(!t) return null;
  const r=t.r, bx=t.bx;
  const emprise=t.sp.w;
  const sp=pour?modeleDe(type,r,0):t.sp;
  const by=solY(r,bx+(emprise>>1))+1;
  /* défrichage : les buissons, rochers et arbres qui occupaient la
     parcelle disparaissent. Comme la cuisson est destructive, il faut
     refaire le calque de la rangée — c'est rare, on peut se le payer. */
  if(t.defricher){
    const gene=decorsSous(r,bx,bx+emprise);
    if(gene.length){
      for(const o of gene){ const i=decors.indexOf(o); if(i>=0) decors.splice(i,1); }
      redessinerCouches();
    }
  }
  const b={sp:sp,x:bx,y:by,r:r,type:type,ne:tps,cuit:false,
           emprise:emprise, pour:pour||null, pal:pal,
           id:id||('e'+(++SEQ)),xr:(bx+emprise/2)/W};
  batiments.push(b);
  poussiere(bx+emprise/2,by,emprise);
  nbBatis++;
  if(!pour) oublierModele(type,r,pal); // le prochain de ce type sera un autre exemplaire
  CLIQUABLE.add(type);
  majHud();
  return b;
}

/* Vider les édifices POSÉS PAR LE JEU sans toucher au décor bâti par la
   génération du bourg — le moulin à eau sur ses pilotis n'appartient
   pas au joueur, il fait partie du paysage. Il porte donc pas d'`id`,
   et c'est à cela qu'on le reconnaît. */
function viderEdificesDuJeu(){
  for(let i=batiments.length-1;i>=0;i--) if(batiments[i].id) batiments.splice(i,1);
  nbBatis=batiments.length;
}

/* Rebâtir intégralement les calques de rangée : nécessaire dès qu'on
   RETIRE quelque chose, puisque la cuisson est destructive. */
function redessinerCouches(){
  for(let r=0;r<NR;r++){
    const c=couches[r].getContext('2d');
    c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,W,H);
  }
  anims.length=0; lumieres.length=0;
  for(const d of decors){ d.cuit=false; d.ne=-99; }
  for(const b of batiments){ b.cuit=false; b.ne=-99; }
  bordSale=true; refletSale=true;
}

/* ------------------------------------------------------------------
   REHAUSSER. Le bâtiment passe un palier : on lui refabrique un sprite,
   on garde son coin bas-gauche, et l'on recuit la rangée. Le bourg
   change de visage sous les yeux du joueur, sans se déplacer d'un pixel.
   ------------------------------------------------------------------ */
function rehausserBatiment(id,niv){
  const b=batiments.find(function(x){return x.id===id;});
  if(!b||b.pour) return false;
  const pal=palierDeNiveau(niv);
  if((b.pal|0)===pal) return false;
  const sp=modeleDe(b.type,b.r,pal);
  oublierModele(b.type,b.r,pal);      // le suivant sera un autre exemplaire
  b.sp=sp; b.pal=pal; b.emprise=Math.max(b.emprise,sp.w);
  b.cuit=false; b.ne=tps;
  redessinerCouches();
  pings.push({x:b.x+b.sp.w/2,y:b.y-b.sp.h*0.55,t:0,col:'#e6c069'});
  return true;
}

function retirerBatiment(id){
  const i=batiments.findIndex(function(b){return b.id===id;});
  if(i<0) return false;
  batiments.splice(i,1);
  nbBatis=Math.max(0,nbBatis-1);
  redessinerCouches();
  return true;
}

/* ------------------------------------------------------------------
   REJOUER LE PLAN. Au chargement d'une partie — et à chaque
   redimensionnement de la fenêtre, qui refabrique tout le terrain — on
   repose les édifices dans l'ordre, chacun à sa position RELATIVE.
   ------------------------------------------------------------------ */
function rejouerPlan(){
  const copie=PLAN.slice();
  for(const p of copie){
    const b=poserBatiment(p.type,Math.round(p.xr*W),p.r,p.id,p.pour||null,p.pal|0);
    if(b){ b.cuit=false; b.ne=-99; p.xr=b.xr; p.r=b.r; }
  }
}

/* ------------------------------------------------------------------
   PROJECTION. Du pixel d'art vers le pixel de page : c'est ce qui
   permet d'accrocher une fenêtre flottante au-dessus d'un toit.
   ------------------------------------------------------------------ */
function ecranDe(b){
  if(!b) return null;
  const rect=cv.getBoundingClientRect(), k=rect.width/W;
  return { x:rect.left+b.x*k, y:rect.top+(b.y-b.sp.h)*k,
           w:b.sp.w*k, h:b.sp.h*k,
           cx:rect.left+(b.x+b.sp.w/2)*k, cy:rect.top+(b.y-b.sp.h)*k,
           sol:rect.top+b.y*k, k:k };
}
function versVillage(ev){
  const r=cv.getBoundingClientRect();
  const p=ev.touches?ev.touches[0]:ev;
  return {x:(p.clientX-r.left)*(W/r.width), y:(p.clientY-r.top)*(H/r.height)};
}

/* ------------------------------------------------------------------
   L'APERÇU DE CONSTRUCTION. Un fantôme de l'édifice, posé au sol, plus
   la trame de la parcelle pour qu'on voie l'emprise réelle.
   ------------------------------------------------------------------ */
function dessinerApercu(){
  if(!modeCons||!apercu) return;
  const sp=apercu.sp, bx=apercu.bx, r=apercu.r;
  const by=solY(r,bx+(sp.w>>1))+1;
  const puls=0.62+0.38*Math.sin(tps*4);
  g.globalAlpha=0.28+0.16*puls;
  if(sp.can) g.drawImage(sp.can,bx,by-sp.h);
  g.globalAlpha=1;
  /* vert : la parcelle est nue. ambre : il faudra défricher. rouge :
     rien à faire ici, l'édifice ne tient pas. */
  const col=apercu.ok?(apercu.defricher?'#c9a24a':'#93c48a'):'#c8695f';
  g.fillStyle=col;
  for(let x=bx;x<bx+sp.w;x+=2) g.fillRect(x,by,1,1);
  g.fillRect(bx,by-4,1,5); g.fillRect(bx+sp.w-1,by-4,1,5);
  g.globalAlpha=0.45;
  for(let y=by-sp.h;y<by;y+=4){ g.fillRect(bx,y,1,2); g.fillRect(bx+sp.w-1,y,1,2); }
  g.globalAlpha=1;
}

/* Surlignage de l'édifice ouvert : un contour franc — il dit
   « c'est de celui-ci que parle la fenêtre ». */
function dessinerSelection(){
  if(!selId) return;
  const b=batiments.find(function(x){return x.id===selId;});
  if(!b||!b.cuit||!b.sp.can) return;
  g.globalCompositeOperation='lighter';
  g.globalAlpha=0.40;
  g.drawImage(contour(b),b.x-2,b.y-b.sp.h-2);
  g.globalAlpha=1; g.globalCompositeOperation='source-over';
}

/* ------------------------------------------------------------------
   LES GAINS QUI MONTENT.
   Une ressource produite doit se voir DANS le village, pas seulement
   dans un tableau. À chaque cycle terminé, la chose fabriquée s'élève
   au-dessus de l'atelier avec sa quantité, puis s'efface. C'est ce qui
   relie l'économie au décor : on voit le poisson sortir de la pêcherie.
   ------------------------------------------------------------------ */
const gains=[];
/* Petite fonte de chiffres 3×5, dessinée au pixel : aucune police du
   système ne s'accorderait avec le reste de la scène. */
const CHIFFRES={
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'], '3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'], '7':['111','001','010','010','010'],
  '8':['111','101','111','101','111'], '9':['111','101','111','001','111'],
  '+':['000','010','111','010','000'], 'k':['101','110','110','101','101'],
};
function dessinerTexte(x,y,txt,col,ombreCol){
  let cx2=x;
  for(const ch of String(txt)){
    const gl=CHIFFRES[ch];
    if(!gl){ cx2+=2; continue; }
    for(let j=0;j<5;j++) for(let i=0;i<3;i++) if(gl[j][i]==='1'){
      if(ombreCol) fr(g,cx2+i+1,y+j+1,1,1,ombreCol);
      fr(g,cx2+i,y+j,1,1,col);
    }
    cx2+=4;
  }
  return cx2-x;
}
function dessinerGains(dt){
  for(let i=gains.length-1;i>=0;i--){
    const q=gains[i];
    q.t+=dt;
    if(q.t>1.7){ gains.splice(i,1); continue; }
    const u=q.t/1.7;
    const y=Math.round(q.y-u*18);
    g.globalAlpha=u<0.72?1:Math.max(0,1-(u-0.72)/0.28);
    if(q.cv) g.drawImage(q.cv,Math.round(q.x)-6,y-6,12,12);
    dessinerTexte(Math.round(q.x)+7,y-2,'+'+q.n,'#f4ead0','rgba(8,10,13,.6)');
    g.globalAlpha=1;
  }
}

function dessinerPings(dt){
  for(let i=pings.length-1;i>=0;i--){
    const p=pings[i];
    p.t+=dt;
    if(p.t>0.9){ pings.splice(i,1); continue; }
    const u=p.t/0.9, rad=Math.round(4+u*16);
    g.globalAlpha=(1-u)*0.7;
    g.strokeStyle=p.col; g.lineWidth=1;
    g.beginPath(); g.arc(p.x+0.5,p.y+0.5,rad,0,6.283); g.stroke();
    g.globalAlpha=1;
  }
}

HOOK.rendu=function(gg,dt,t){
  dessinerSelection();
  dessinerApercu();
  dessinerPings(dt);
  dessinerGains(dt);
};

/* ------------------------------------------------------------------
   ÉVÉNEMENTS DE POINTAGE
   ------------------------------------------------------------------ */
function brancherPointeur(){
  cv.addEventListener('pointermove',function(ev){
    const p=versVillage(ev);
    if(modeCons){
      const r=rangeeSous(modeCons,p.x,p.y);
      const t=chercherPose(modeCons,p.x,r);
      if(t){ apercu={sp:t.sp,bx:t.bx,r:t.r,ok:true,defricher:t.defricher}; }
      else { const sp=modeleDe(modeCons,r);
             apercu={sp:sp,bx:clamp(Math.round(p.x-sp.w/2),1,Math.max(1,W-sp.w-1)),r:r,ok:false}; }
      cv.style.cursor='copy';
      return;
    }
    majSurvol(ev);
    if(listeners.survol) listeners.survol(vise,ev);
  });
  cv.addEventListener('pointerleave',function(){
    vise=null; apercu=null; cv.style.cursor='default';
    if(listeners.survol) listeners.survol(null,null);
  });
  cv.addEventListener('pointerdown',function(ev){
    ev.preventDefault();
    const p=versVillage(ev);
    if(modeCons){
      const r=rangeeSous(modeCons,p.x,p.y);
      const t=chercherPose(modeCons,p.x,r);
      if(t&&listeners.pose) listeners.pose(modeCons,{x:p.x,r:t.r,bx:t.bx});
      else if(listeners.poseRefus) listeners.poseRefus(modeCons);
      return;
    }
    const e=edificeSous(p.x,p.y);
    if(e){ if(listeners.selection) listeners.selection(e,ev); return; }
    if(listeners.sol) listeners.sol(p,ev);
  });
  cv.addEventListener('contextmenu',function(e){e.preventDefault();});
}

/* ------------------------------------------------------------------
   REDIMENSIONNEMENT. Le terrain est refabriqué à la même graine, puis
   le plan est rejoué : la cité reste la même, elle change de format.
   ------------------------------------------------------------------ */
let tRedim=0, pretDemarre=false;
addEventListener('resize',function(){
  if(!pretDemarre) return;
  clearTimeout(tRedim);
  tRedim=setTimeout(function(){
    for(const k in MODELES) delete MODELES[k];
    const nomGarde=NOM_BOURG;
    nouvelleCite(graine);
    NOM_BOURG=nomGarde;
    viderEdificesDuJeu();
    rejouerPlan();
    if(listeners.redim) listeners.redim();
  },240);
});

window.Village = {
  /* ---- cycle de vie ---- */
  init:function(opts){
    opts=opts||{};
    if(opts.generateurs) for(const k in opts.generateurs) GEN[k]=opts.generateurs[k];
    if(opts.rangees) for(const k in opts.rangees) RANGEES[k]=opts.rangees[k];
    if(opts.fiches) for(const k in opts.fiches) FICHES[k]=opts.fiches[k];
    CLIQUABLE.clear();
    nouvelleCite(opts.graine||1);
    if(opts.nom) NOM_BOURG=opts.nom;
    if(opts.jour!=null) jour=clamp(opts.jour,0,0.999);
    brancherPointeur();
    return this;
  },
  demarrer:function(){ if(pretDemarre) return this; pretDemarre=true; requestAnimationFrame(boucle); return this; },
  /* Peindre UNE image à la demande, hors boucle. Sert au diagnostic et
     aux environnements où `requestAnimationFrame` ne se déclenche pas
     (onglet masqué, capture hors écran). */
  uneImage:function(ts){ boucle(ts==null?performance.now():ts); return this; },
  hooks:function(h){ for(const k in (h||{})) listeners[k]=h[k]; return this; },
  surTick:function(fn){ HOOK.tick=fn; return this; },
  surHud:function(fn){ HOOK.hud=fn; return this; },

  /* ---- édifices ---- */
  declarer:function(type,gen,rangees,fiche){
    GEN[type]=gen; RANGEES[type]=rangees||[1,2];
    if(fiche) FICHES[type]=fiche;
    return this;
  },
  poser:function(type,vx,r,id,niv){
    const pal=palierDeNiveau(niv==null?1:niv);
    const b=poserBatiment(type,vx==null?(ZONE.ville[0]+ZONE.ville[1])/2:vx,r,id,null,pal);
    if(b) PLAN.push({id:b.id,type:b.type,r:b.r,xr:b.xr,pal:pal});
    return b;
  },
  /* L'ÉDIFICE CHANGE D'ÂGE. Rustique jusqu'au niveau 3, établi jusqu'au
     7, de maître au-delà : la couverture, le parement, l'enseigne et
     l'oriflamme suivent — et le joueur voit son bourg s'enrichir. */
  rehausser:function(id,niv){
    const ok=rehausserBatiment(id,niv);
    if(ok){ const p=PLAN.find(function(q){return q.id===id;});
            if(p) p.pal=palierDeNiveau(niv); }
    return ok;
  },
  palier:function(niv){ return palierDeNiveau(niv); },
  nomPalier:function(niv){ return PALIER_NOMS[palierDeNiveau(niv)]; },
  /* L'ÉCHAFAUDAGE. On réserve la parcelle du bâtiment À VENIR — sa
     largeur, sa rangée — et l'on y pose la charpente nue du chantier.
     Le jour où l'ouvrage s'achève, l'un remplace l'autre au pixel près. */
  poserChantier:function(typeCible,vx,r,id){
    const cx0=(ZONE.ville[0]+ZONE.ville[1])/2;
    const b=poserBatiment('chantier',vx==null?cx0:vx,r,id,typeCible);
    if(b) PLAN.push({id:b.id,type:'chantier',pour:typeCible,r:b.r,xr:b.xr});
    return b;
  },
  retirer:function(id){
    const i=PLAN.findIndex(function(p){return p.id===id;});
    if(i>=0) PLAN.splice(i,1);
    return retirerBatiment(id);
  },
  batiments:function(){ return batiments.filter(function(b){return !!b.id;}); },
  batiment:function(id){ return batiments.find(function(b){return b.id===id;})||null; },
  plan:function(){ return PLAN.map(function(p){return {id:p.id,type:p.type,pour:p.pour||null,r:p.r,xr:p.xr,pal:p.pal|0};}); },
  chargerPlan:function(p){
    PLAN=(p||[]).map(function(x){return {id:x.id,type:x.type,pour:x.pour||null,r:x.r,xr:x.xr,pal:x.pal|0};});
    let m=0; for(const q of PLAN){ const n=parseInt(String(q.id).slice(1),10); if(n>m)m=n; }
    SEQ=Math.max(SEQ,m);
    viderEdificesDuJeu();
    redessinerCouches();
    rejouerPlan();
    return this;
  },
  possible:function(type,vx,py){
    const cx0=(ZONE.ville[0]+ZONE.ville[1])/2;
    const r=(py==null)?null:rangeeSous(type,vx==null?cx0:vx,py);
    return !!chercherPose(type,vx==null?cx0:vx,r);
  },
  modeConstruction:function(type){
    modeCons=type||null; apercu=null;
    cv.style.cursor=type?'copy':'default';
    return this;
  },
  enConstruction:function(){ return modeCons; },

  /* ---- vie du bourg ---- */
  population:function(n){ POP_FORCEE=(n==null)?null:n; majPopulation(); return this; },
  nbHabitants:function(){ return vN; },
  affecter:function(i,r,x,metier){ affecter(i,r,x,metier); return this; },
  affecterA:function(i,id,metier){
    const b=batiments.find(function(x){return x.id===id;});
    if(!b){ affecter(i,-1,0); return this; }
    affecter(i,b.r,b.x+b.sp.w*(0.22+0.56*((i*0.6180339)%1)),metier);
    return this;
  },
  libererTous:function(){ for(let i=0;i<VMAX;i++){ vCR[i]=-1; vCX[i]=-1; vAct[i]=0; vJob[i]=0; } return this; },
  /* Combien de lignes sont réellement à l'eau sur le quai. */
  pecheurs:function(n){ PECHEURS_ACTIFS=Math.max(0,n|0); return this; },
  /* Ce que le joueur veut voir ou non dans la scène. */
  reglages:function(o){
    if(!o) return {gains:MONTRER_GAINS,gestes:MONTRER_GESTES};
    if(o.gains!=null) MONTRER_GAINS=!!o.gains;
    if(o.gestes!=null) MONTRER_GESTES=!!o.gestes;
    return this;
  },
  /* Qui travaille, et où : sert au diagnostic et aux repères d'écran. */
  auTravail:function(){
    const out=[];
    for(let i=0;i<vN;i++) if(vAct[i]&&vJob[i])
      out.push({i:i,x:Math.round(vX[i]),r:vR[i],y:solY(vR[i],vX[i]|0),job:vJob[i]});
    return out;
  },
  actif:function(id,on){ if(on) ACTIFS.add(id); else ACTIFS.delete(id); return this; },
  actifs:function(ids){ ACTIFS.clear(); for(const id of (ids||[])) ACTIFS.add(id); return this; },
  ping:function(id,col){
    const b=batiments.find(function(x){return x.id===id;}); if(!b) return this;
    pings.push({x:b.x+b.sp.w/2,y:b.y-b.sp.h*0.55,t:0,col:col||'#e8d6a8'});
    return this;
  },
  /* Une chose vient d'être produite ici : elle monte et s'efface. */
  gain:function(id,canvasIcone,n){
    if(!MONTRER_GAINS||gains.length>26) return this;
    const b=batiments.find(function(x){return x.id===id;}); if(!b) return this;
    gains.push({x:b.x+b.sp.w*(0.35+0.3*rnd()),y:b.y-b.sp.h*0.9,t:0,cv:canvasIcone,n:n});
    return this;
  },
  souffle:function(id){
    const b=batiments.find(function(x){return x.id===id;}); if(!b) return this;
    poussiere(b.x+b.sp.w/2,b.y,b.sp.w); return this;
  },
  selection:function(id){ selId=id||null; return this; },

  /* ---- décor et ambiance ---- */
  ajouterDecor:function(vx,r){ return ajouterDecor(vx,r); },
  heure:function(v){ if(v!=null) jour=clamp(v,0,0.999); return jour; },
  vitesseJour:function(v){ if(v!=null) vitesseJour=v; return vitesseJour; },
  figerTemps:function(v){ tempsFige=!!v; return this; },
  densite:function(i){ densite=clamp(i|0,0,DENSITES.length-1); majPopulation(); return this; },

  /* ---- lecture ---- */
  ecran:function(b){ return ecranDe(typeof b==='string'?batiments.find(function(x){return x.id===b;}):b); },
  dimensions:function(){ return {W:W,H:H,echelle:ECHELLE,rangees:NR}; },
  zones:function(){ return {ville:ZONE.ville.slice(),foret:ZONE.foret.slice(),bataille:ZONE.bat.slice(),escaliers:ESC.slice()}; },
  sol:function(r,x){ return solY(r,x); },
  nom:function(){ return NOM_BOURG; },
  renommer:function(n){ NOM_BOURG=n; return this; },
  rang:function(){ return RANG_COURANT; },
  graine:function(){ return graine; },
  canvas:function(){ return cv; },
  fps:function(){ return fps; },
  /* Diagnostic : ce qui occupe réellement une terrasse. Sert à comprendre
     pourquoi une parcelle est refusée — sans lui, on cherche à l'aveugle. */
  occupation:function(r){
    const out={batiments:[],decors:[],libre:[]};
    for(const b of batiments) if(b.r===r) out.batiments.push({t:b.type,x:b.x,w:b.sp.w});
    for(const o of decors) if(o.r===r) out.decors.push({t:o.type||(o.vide?'reserve':'decor'),x:o.x,w:o.sp.w});
    let debut=null;
    for(let x=1;x<W;x+=2){
      const ok=libre(r,x,x+2);
      if(ok&&debut==null) debut=x;
      if(!ok&&debut!=null){ if(x-debut>10) out.libre.push([debut,x]); debut=null; }
    }
    if(debut!=null&&W-debut>10) out.libre.push([debut,W]);
    return out;
  }
};
})();
