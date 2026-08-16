/* ============================================================
   LE BOURG — icones.js
   Toutes les icônes du jeu sont DESSINÉES, jamais chargées : ni image,
   ni police à symboles, ni emoji. Chaque ressource porte un descripteur
   { forme, c:[couleurs] } et cette bibliothèque sait peindre la forme.

   Le dessin se fait sur une grille logique de 16×16 puis se met à
   l'échelle : à 20 px comme à 64 px, la grille reste régulière et les
   bords restent nets (imageSmoothing coupé).
   -> window.Icones
   ============================================================ */
"use strict";
(function () {

  const cache = new Map();

  function h2r(h){h=h.replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function r2h(c){return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
  function mix(a,b,t){const A=h2r(a),B=h2r(b);return r2h([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]);}
  const cl = (c,t)=>mix(c,'#fff6e4',t);      // éclaircir
  const om = (c,t)=>mix(c,'#141018',t);      // assombrir

  /* Le pinceau : coordonnées en cases de la grille 16×16. */
  function pinceau(g, size){
    const u = size/16;
    const f = (x,y,w,h,col)=>{
      g.fillStyle=col;
      g.fillRect(Math.round(x*u),Math.round(y*u),
                 Math.max(1,Math.round(w*u)),Math.max(1,Math.round(h*u)));
    };
    f.disque=(cx,cy,r,col)=>{
      for(let j=-r;j<=r;j++){
        const d=Math.floor(Math.sqrt(Math.max(0,r*r+r*0.5-j*j)));
        if(d<=0&&Math.abs(j)>=r) continue;
        f(cx-d,cy+j,2*d+1,1,col);
      }
    };
    f.ligne=(x0,y0,x1,y1,col)=>{
      const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));
      for(let i=0;i<=n;i++) f(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),1,1,col);
    };
    return f;
  }

  /* ------------------------------------------------------------
     LES FORMES. Chacune reçoit le pinceau et la palette de la
     ressource ; c1 est la teinte dominante, c2 l'accent.
     ------------------------------------------------------------ */
  const F = {};

  F.poisson = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(4,7,7,4,a); p(5,6,5,1,cl(a,.2)); p(5,11,5,1,b);
    p(3,8,1,2,a); p(2,7,2,1,b); p(2,10,2,1,b);          // la queue
    p(11,8,2,2,cl(a,.14));
    p(10,7,1,1,'#20242c');                               // l'œil
    p(6,8,3,1,cl(a,.28)); p(7,9,2,1,b);
  };
  F.epi = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.25);
    p(7,3,2,10,om(a,.4));
    for(let k=0;k<5;k++){ const y=3+k*2;
      p(5,y,2,2,a); p(9,y,2,2,b); p(5,y,2,1,cl(a,.22)); }
    p(6,13,4,1,om(a,.5));
  };
  F.buche = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(2,5,12,6,a); p(2,5,12,1,cl(a,.18)); p(2,10,12,1,b);
    p.disque(12,8,3,cl(a,.3)); p.disque(12,8,2,a); p.disque(12,8,1,b);
    p(3,7,7,1,b); p(4,9,6,1,om(a,.16));
  };
  F.planche = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.28);
    for(let k=0;k<3;k++){ const y=4+k*3;
      p(2,y,12,2,k%2?a:cl(a,.10)); p(2,y,12,1,cl(a,.20)); p(2,y+1,12,1,b); }
    p(4,4,1,8,om(a,.2)); p(10,4,1,8,om(a,.14));
  };
  F.pierre = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(3,6,10,7,a); p(4,5,8,1,a); p(3,6,10,1,cl(a,.22));
    p(3,12,10,1,om(a,.28)); p(12,6,1,7,b);
    p(5,8,3,2,b); p(9,9,2,2,cl(a,.12));
  };
  F.lingot = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.32);
    p(3,7,10,4,a); p(4,6,8,1,cl(a,.30)); p(3,10,10,1,b);
    p(2,9,1,2,b); p(13,9,1,2,b);
    p(5,7,4,1,cl(a,.42)); p(9,9,3,1,b);
  };
  F.sac = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.28);
    p(4,6,8,7,a); p(4,6,8,1,cl(a,.16)); p(4,12,8,1,b);
    p(5,4,6,2,cl(a,.10)); p(6,3,4,1,b);
    p(5,5,6,1,b);                                        // la ligature
    p(6,8,2,2,cl(a,.24)); p(9,10,2,1,b);
  };
  F.pain = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(3,6,10,6,a); p(4,5,8,1,cl(a,.18)); p(3,11,10,1,b);
    p(2,7,1,4,b); p(13,7,1,4,b);
    for(let k=0;k<3;k++) p(5+k*2,6,1,3,om(a,.24));       // les grignes
    p(4,6,7,1,cl(a,.28));
  };
  F.fromage = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(3,7,10,5,a); p(3,6,7,1,cl(a,.2)); p(3,11,10,1,b);
    p.ligne(10,6,13,7,cl(a,.10));
    p(5,8,2,2,b); p(9,9,2,2,b); p(7,10,1,1,b);
  };
  F.pot = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3), l=c[2]||'#cdd6de';
    p(5,3,6,1,l); p(4,4,8,1,l);
    p(4,5,8,8,a); p(4,5,8,1,cl(a,.2)); p(4,12,8,1,b);
    p(3,7,1,4,b); p(12,7,1,4,b);
    p(6,8,3,3,cl(a,.16));
  };
  F.pelote = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.28);
    p.disque(8,8,5,a); p.disque(8,8,4,cl(a,.10));
    p.ligne(4,7,12,9,b); p.ligne(5,10,11,6,b); p.ligne(4,9,12,7,cl(a,.24));
    p(12,10,3,1,b); p(14,10,1,2,b);
  };
  F.bobine = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(4,3,8,2,'#8a6a45'); p(4,11,8,2,'#8a6a45');
    p(6,5,4,6,a); p(6,5,4,1,cl(a,.24)); p(6,10,4,1,b);
    for(let k=0;k<3;k++) p(6,6+k*2,4,1,b);
    p(4,3,8,1,'#a9855a'); p(4,12,8,1,'#5a412a');
  };
  F.rouleau = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.26);
    p(3,4,10,8,a); p(3,4,10,1,cl(a,.20)); p(3,11,10,1,b);
    p(2,4,1,8,b); p(13,4,1,8,b);
    p(5,6,6,1,b); p(5,8,5,1,b); p(5,10,6,1,b);
  };
  F.peau = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.28);
    p(5,3,6,2,a); p(4,5,8,5,a); p(5,10,6,2,a); p(6,12,4,1,b);
    p(3,6,1,3,a); p(12,6,1,3,a);
    p(5,3,6,1,cl(a,.22)); p(4,9,8,1,b);
    p(7,6,2,3,om(a,.16));
  };
  F.brique = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(2,5,12,3,a); p(2,5,12,1,cl(a,.16)); p(2,7,12,1,b);
    p(2,9,12,3,a); p(2,9,12,1,cl(a,.16)); p(2,11,12,1,b);
    p(7,5,1,3,b); p(4,9,1,3,b); p(11,9,1,3,b);
  };
  F.tuile = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    for(let k=0;k<3;k++){ const x=2+k*4;
      p(x,5,4,7,a); p(x,5,1,7,cl(a,.22)); p(x+3,5,1,7,b); p(x,11,4,1,b); }
    p(2,4,12,1,cl(a,.12));
  };
  F.fiole = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p(6,2,4,2,'#8a8272'); p(6,4,4,2,'#b6bec6');
    p(5,6,6,7,'#9fb2bd'); p(6,7,4,5,a); p(6,7,4,1,cl(a,.3));
    p(5,12,6,1,'#7d8790'); p(7,8,1,3,cl(a,.4));
  };
  F.cristal = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.34);
    p(7,2,2,3,cl(a,.4)); p(6,5,4,5,a); p(5,7,6,4,a);
    p(6,10,4,3,b); p(7,13,2,1,b);
    p(6,5,2,5,cl(a,.28)); p(9,7,1,4,b); p(7,3,1,2,'#ffffff');
  };
  F.gemme = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.34);
    p(5,5,6,2,cl(a,.28)); p(4,7,8,3,a); p(5,10,6,2,b); p(7,12,2,1,b);
    p(6,5,2,2,'#ffffff'); p(9,8,2,2,b);
  };
  F.piece = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p.disque(8,8,5,b); p.disque(8,8,4,a); p.disque(8,8,3,cl(a,.16));
    p(7,6,2,1,b); p(7,9,2,1,b); p(6,7,1,2,b); p(9,7,1,2,b);
    p(5,5,2,1,cl(a,.5));
  };
  F.cle = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.3);
    p.disque(5,6,3,a); p.disque(5,6,2,b); p.disque(5,6,1,a);
    p(7,7,6,2,a); p(7,7,6,1,cl(a,.24));
    p(11,9,1,2,a); p(9,9,1,2,a);
  };
  F.marteau = (p,c)=>{
    const a=c[0]||'#8d9199', b=c[1]||'#5a5e66', m='#8a6a45';
    p(4,3,8,4,a); p(4,3,8,1,cl(a,.3)); p(4,6,8,1,b);
    p(3,4,1,2,b); p(12,4,1,2,b);
    p(7,7,2,7,m); p(7,7,1,7,cl(m,.2)); p(7,13,2,1,om(m,.3));
  };
  F.hache = (p,c)=>{
    const a=c[0]||'#8d9199', m='#8a6a45';
    p(8,3,2,11,m); p(8,3,1,11,cl(m,.2));
    p(4,3,4,5,a); p(3,4,1,3,a); p(4,3,4,1,cl(a,.3)); p(4,7,4,1,om(a,.24));
    p(8,4,1,3,om(a,.3));
  };
  F.epee = (p,c)=>{
    const a=c[0]||'#c9cdd2', b=c[1]||'#8a8f96', m='#8a6a45';
    p(7,1,2,9,a); p(7,1,1,9,cl(a,.3)); p(8,2,1,8,b); p(7,0,2,1,cl(a,.5));
    p(5,10,6,1,'#c9a24a'); p(4,10,1,1,'#8a6a2a'); p(11,10,1,1,'#8a6a2a');
    p(7,11,2,3,m); p(6,14,4,1,'#c9a24a');
  };
  F.lance = (p,c)=>{
    const a=c[0]||'#c9cdd2', m='#8a6a45';
    p(7,4,2,10,m); p(7,4,1,10,cl(m,.2));
    p(7,0,2,4,a); p(6,2,1,2,a); p(9,2,1,2,a); p(7,0,1,4,cl(a,.3));
    p(6,4,4,1,'#c9a24a');
  };
  F.plastron = (p,c)=>{
    const a=c[0]||'#9aa2ab', b=c[1]||'#6b737c';
    p(4,3,8,2,a); p(3,5,10,6,a); p(4,11,8,2,b);
    p(3,5,10,1,cl(a,.26)); p(3,10,10,1,b);
    p(6,3,4,2,b); p(7,6,2,4,b); p(4,6,2,3,cl(a,.12));
  };
  F.bouclier = (p,c)=>{
    const a=c[0]||'#8a6a45', b=c[1]||'#c9a24a';
    p(3,3,10,6,a); p(4,9,8,2,a); p(6,11,4,2,a); p(7,13,2,1,a);
    p(3,3,10,1,cl(a,.26)); p(6,11,4,1,om(a,.2));
    p(7,5,2,5,b); p(5,6,6,2,b);
  };
  F.parchemin = (p,c)=>{
    const a=c[0]||'#ddd2b4', b=c[1]||'#b4a888';
    p(3,3,10,10,a); p(3,3,10,1,cl(a,.2)); p(3,12,10,1,b);
    p(2,3,1,10,b); p(13,3,1,10,b);
    p(5,5,6,1,'#5a4a38'); p(5,7,7,1,'#5a4a38'); p(5,9,5,1,'#5a4a38');
  };
  F.grimoire = (p,c)=>{
    const a=c[0]||'#5a3f6e', b=c[1]||'#3a2a48', o='#c9a24a';
    p(3,3,10,10,a); p(3,3,10,1,cl(a,.24)); p(3,12,10,1,b);
    p(3,3,2,10,b); p(12,3,1,10,b);
    p(7,6,2,4,o); p(6,7,4,2,o); p(11,4,1,8,'#ddd2b4');
  };
  F.plume = (p,c)=>{
    const a=c[0]||'#e0dcd0', b=c[1]||'#a8a496';
    p.ligne(4,13,11,3,b);
    for(let k=0;k<6;k++){ const x=5+k, y=12-k*1.6|0; p(x,y-2,2,3,a); p(x,y-2,1,3,cl(a,.2)); }
    p(3,13,2,1,'#3a3630');
  };
  F.feuille = (p,c)=>{
    const a=c[0]||'#5d7247', b=c[1]||'#3f5a30';
    p(7,10,1,4,'#4a3a26');
    p(5,4,6,6,a); p(6,3,4,1,a); p(4,6,1,3,a); p(11,6,1,3,a);
    p(5,4,6,1,cl(a,.2)); p(5,9,6,1,b);
    p.ligne(8,3,8,10,b);
  };
  F.champignon = (p,c)=>{
    const a=c[0]||'#a8563f', b=c[1]||'#e8dcc4';
    p(3,5,10,4,a); p(4,4,8,1,cl(a,.2)); p(3,8,10,1,om(a,.26));
    p(5,6,2,1,b); p(9,5,2,1,b);
    p(6,9,4,5,b); p(6,9,4,1,cl(b,.2)); p(6,13,4,1,om(b,.2));
  };
  F.oeuf = (p,c)=>{
    const a=c[0]||'#e8dcc4', b=c[1]||'#c4b696';
    for(let j=0;j<11;j++){
      const t=j/10, w=Math.round(3+5*Math.sin(Math.PI*(0.28+0.72*t)));
      p(8-Math.round(w/2),3+j,w,1, j<3?cl(a,.2):(j>8?b:a));
    }
  };
  /* LA PORTE DU BOURG : deux battants, une traverse, un anneau. On la
     dessine entrouverte — c'est une invitation, pas une clôture. */
  F.porte = (p,c)=>{
    const a=c[0]||'#8a6a44', b=c[1]||'#4a3524';
    p(3,2,10,12,b);                      // l'encadrement
    p(4,3,8,11,a);                       // le vantail
    p(4,3,8,1,cl(a,.26));                // le jour du haut
    p(7,3,1,11,om(a,.42));               // le joint des deux battants
    p(4,7,8,1,om(a,.28));                // la traverse
    p(4,10,8,1,om(a,.28));
    p(9,8,2,1,cl(a,.5)); p(10,8,1,2,cl(a,.5));   // l'anneau
    p(3,14,10,1,om(b,.4));               // le seuil
  };
  F.charbon = (p,c)=>{
    const a=c[0]||'#25252a', b=c[1]||'#4a4a52';
    p(3,7,5,4,a); p(4,6,3,1,b); p(3,10,5,1,'#111114');
    p(8,5,5,4,a); p(9,4,3,1,b); p(8,8,5,1,'#111114');
    p(7,10,5,3,a); p(8,9,3,1,b);
    p(4,7,1,1,'#6a6a74'); p(10,5,1,1,'#6a6a74');
  };
  F.tas = (p,c)=>{
    const a=c[0], b=c[1]||om(a,.24);
    for(let j=0;j<6;j++){ const w=3+j*2; p(8-Math.round(w/2),12-j,w,1, j>3?cl(a,.14):a); }
    p(4,12,9,1,b);
    p(6,9,1,1,cl(a,.3)); p(9,10,1,1,cl(a,.3));
  };
  F.gobelet = (p,c)=>{
    const a=c[0]||'#9fc4cc', b=c[1]||'#6f929c';
    for(let j=0;j<7;j++){ const w=8-j; p(8-Math.round(w/2),4+j,w,1, j===0?cl(a,.4):a); }
    p(7,11,2,2,b); p(5,13,6,1,b);
    p(6,5,1,4,cl(a,.5));
  };
  F.os = (p,c)=>{
    const a=c[0]||'#ddd6c2', b=c[1]||'#b0a68c';
    p(5,7,6,2,a); p(5,7,6,1,cl(a,.2));
    p.disque(4,7,2,a); p.disque(4,10,2,a); p.disque(12,6,2,a); p.disque(12,9,2,a);
    p(4,9,1,1,b); p(12,8,1,1,b);
  };
  F.ame = (p,c)=>{
    const a=c[0]||'#8fd8e0', b=c[1]||'#4a8f9c';
    p.disque(8,7,4,b); p.disque(8,7,3,a); p.disque(8,6,2,cl(a,.5));
    p(7,11,2,2,b); p(6,13,4,1,b);
    p(5,4,1,1,cl(a,.6)); p(11,5,1,1,cl(a,.6));
  };
  F.medaille = (p,c)=>{
    const a=c[0]||'#c9a24a', b=c[1]||'#8a6a2a';
    p(6,2,4,4,'#8c3b34'); p(6,2,4,1,'#b0554c');
    p.disque(8,10,4,b); p.disque(8,10,3,a); p.disque(8,10,2,cl(a,.2));
    p(7,9,2,1,b); p(7,11,2,1,b);
  };
  F.couronne = (p,c)=>{
    const a=c[0]||'#d8b048', b=c[1]||'#8a6a2a';
    p(3,9,10,4,a); p(3,12,10,1,b); p(3,9,10,1,cl(a,.26));
    p(3,4,2,5,a); p(7,3,2,6,a); p(11,4,2,5,a);
    p(3,4,2,1,cl(a,.4)); p(7,3,2,1,cl(a,.4)); p(11,4,2,1,cl(a,.4));
    p(5,10,1,1,'#b0555f'); p(10,10,1,1,'#4a6c8a'); p(7,10,2,1,'#4f8a63');
  };
  F.bague = (p,c)=>{
    const a=c[0]||'#d8b048', b=c[1]||'#8a6a2a', g=c[2]||'#4a6c8a';
    for(let k=0;k<12;k++){
      const an=k/12*6.283;
      p(8+Math.round(Math.cos(an)*4),9+Math.round(Math.sin(an)*4),1,1, k<6?a:b);
    }
    p(7,3,3,3,g); p(7,3,3,1,cl(g,.4)); p(6,4,1,1,a); p(10,4,1,1,a);
  };
  F.corde = (p,c)=>{
    const a=c[0]||'#b09a6c', b=c[1]||'#8a7040';
    for(let k=0;k<5;k++){ const y=3+k*2;
      p(3,y,10,1,a); p(3+((k%2)?2:0),y+1,10,1,b); }
    p(2,3,1,10,b); p(13,3,1,10,b);
  };
  F.cire = (p,c)=>{
    const a=c[0]||'#e0c463', b=c[1]||'#b09040';
    for(let r0=0;r0<3;r0++) for(let cc=0;cc<3;cc++){
      const x=3+cc*4-(r0%2?2:0), y=4+r0*3;
      if(x<1||x>12) continue;
      p(x,y,3,3,a); p(x,y,3,1,cl(a,.22)); p(x,y+2,3,1,b);
    }
  };
  F.filet = (p,c)=>{
    const a=c[0]||'#8a9a86', b=c[1]||'#6e7d6b';
    for(let j=3;j<13;j+=2) p(3,j,10,1,a);
    for(let i=3;i<13;i+=2) p(i,3,1,10,b);
    p(3,3,10,1,cl(a,.2));
  };
  F.enclume = (p,c)=>{
    const a=c[0]||'#4a4e56', b=c[1]||'#7a7e86';
    p(3,4,10,3,a); p(3,4,10,1,b); p(2,5,1,2,a); p(13,5,1,1,a);
    p(6,7,4,3,a); p(4,10,8,3,a); p(4,10,8,1,b); p(4,12,8,1,'#2a2e34');
  };
  F.roue = (p,c)=>{
    const a=c[0]||'#6d5236', b=c[1]||'#3a2c1e';
    for(let k=0;k<16;k++){
      const an=k/16*6.283;
      p(8+Math.round(Math.cos(an)*6),8+Math.round(Math.sin(an)*6),1,1,a);
      p(8+Math.round(Math.cos(an)*5),8+Math.round(Math.sin(an)*5),1,1,b);
    }
    for(let k=0;k<6;k++){ const an=k/6*6.283;
      p.ligne(8,8,8+Math.round(Math.cos(an)*5),8+Math.round(Math.sin(an)*5),a); }
    p.disque(8,8,2,b);
  };
  F.flamme = (p,c)=>{
    const a=c[0]||'#ff9a3a', b=c[1]||'#c2480e';
    p(7,3,2,3,'#ffe9a8'); p(6,5,4,4,a); p(5,8,6,4,b); p(6,12,4,1,om(b,.3));
    p(7,6,2,2,'#ffe9a8'); p(7,9,2,2,a);
  };
  F.goutte = (p,c)=>{
    const a=c[0]||'#5f9ad0', b=c[1]||'#3a6ea8';
    p(7,2,2,3,cl(a,.3));
    for(let j=0;j<8;j++){ const w=Math.round(2+j*0.9); p(8-Math.round(w/2),5+j,w,1, j>5?b:a); }
    p(6,9,1,2,cl(a,.4));
  };
  F.etoile = (p,c)=>{
    const a=c[0]||'#e8d6a8', b=c[1]||'#b09a60';
    p(7,2,2,12,a); p(2,7,12,2,a);
    p(5,5,2,2,a); p(9,5,2,2,a); p(5,9,2,2,a); p(9,9,2,2,a);
    p(7,2,1,12,cl(a,.3)); p(2,8,12,1,b);
  };
  F.crane = (p,c)=>{
    const a=c[0]||'#ddd6c2', b=c[1]||'#2a2620';
    p(4,3,8,7,a); p(4,3,8,1,cl(a,.2)); p(3,5,1,4,a); p(12,5,1,4,a);
    p(5,5,2,3,b); p(9,5,2,3,b); p(7,8,2,2,b);
    p(5,10,6,3,a); p(6,11,1,2,b); p(9,11,1,2,b); p(5,12,6,1,om(a,.24));
  };
  F.oeil = (p,c)=>{
    const a=c[0]||'#e0dcd0', b=c[1]||'#7f6fc0';
    p(3,6,10,4,a); p(4,5,8,1,a); p(4,10,8,1,a);
    p.disque(8,8,3,b); p.disque(8,8,2,om(b,.3)); p(7,6,1,1,'#ffffff');
    p(3,6,10,1,om(a,.3));
  };
  F.pot_terre = (p,c)=>{
    const a=c[0]||'#a8764a', b=c[1]||'#7a5232';
    p(4,4,8,1,b); p(3,5,10,1,a);
    for(let j=0;j<7;j++){ const w=Math.round(10-Math.abs(j-2)*0.8); p(8-Math.round(w/2),6+j,w,1, j>4?b:a); }
    p(5,6,3,4,cl(a,.14));
  };
  F.carte = (p,c)=>{
    const a=c[0]||'#ddd2b4', b=c[1]||'#8a7a58';
    p(2,3,12,10,a); p(2,3,12,1,cl(a,.2)); p(2,12,12,1,b);
    p(6,3,1,10,b); p(10,3,1,10,b);
    p.ligne(3,10,7,6,'#8c3b34'); p.ligne(7,6,12,8,'#8c3b34');
    p(11,7,2,2,'#8c3b34');
  };
  F.tonneau = (p,c)=>{
    const a=c[0]||'#8a6a45', b=c[1]||'#5a412a';
    for(let j=0;j<10;j++){
      const w=Math.round(8+2*Math.sin(Math.PI*j/9));
      p(8-Math.round(w/2),3+j,w,1, j<2?cl(a,.2):(j>7?b:a));
    }
    p(3,5,10,1,'#4a4238'); p(3,10,10,1,'#4a4238');
  };
  F.cube = (p,c)=>{                                   // forme générique de repli
    const a=c[0]||'#8a8272', b=c[1]||om(a,.3);
    p(4,5,8,7,a); p(4,5,8,1,cl(a,.24)); p(4,11,8,1,b); p(11,5,1,7,b);
    p(6,7,3,2,cl(a,.12));
  };

  /* ------------------------------------------------------------
     RENDU. On peint une fois par (forme, palette, taille) et l'on
     garde le canvas : une liste d'inventaire redessinée soixante
     fois par seconde ne doit rien recalculer.
     ------------------------------------------------------------ */
  function canvas(spec, size){
    size = size || 32;
    const forme = (spec && spec.f) || 'cube';
    const cols = (spec && spec.c) || ['#8a8272'];
    const key = forme + '|' + cols.join(',') + '|' + size;
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const p = pinceau(g, size);
    (F[forme] || F.cube)(p, cols);
    cache.set(key, cv);
    return cv;
  }

  /* Une balise <span> prête à poser dans le DOM. */
  function element(spec, size, classe){
    const el = document.createElement('span');
    el.className = 'ico' + (classe ? ' ' + classe : '');
    const cv = canvas(spec, size || 24);
    el.appendChild(cv.cloneNode(true));
    const g2 = el.firstChild.getContext('2d');
    g2.imageSmoothingEnabled = false;
    g2.drawImage(cv, 0, 0);
    return el;
  }

  function html(spec, size){
    return url(spec, size);
  }

  /* ------------------------------------------------------------
     SIGNATURE ET IMAGE. L'interface pose des centaines d'icônes par
     seconde ; fabriquer un canvas à chaque fois coûtait plus cher que
     tout le reste de l'affichage. On grave donc l'image UNE fois en
     data-url, et le DOM ne reçoit plus qu'une balise <img> — trois
     attributs, aucun pixel recalculé. La signature sert au surcroît
     à la réconciliation : deux icônes de même signature sont la même
     image, on garde le nœud déjà en place.
     ------------------------------------------------------------ */
  function signature(spec, size){
    return ((spec && spec.f) || 'cube') + '|' +
           ((spec && spec.c) || ['#8a8272']).join(',') + '|' + (size || 24);
  }
  const urls = new Map();
  function url(spec, size){
    const k = signature(spec, size);
    let u = urls.get(k);
    if (u == null) { u = canvas(spec, size || 24).toDataURL(); urls.set(k, u); }
    return u;
  }
  function image(spec, size, classe){
    size = size || 24;
    const n = document.createElement('img');
    n.className = 'ico' + (classe ? ' ' + classe : '');
    n.width = size; n.height = size;
    n.setAttribute('data-ico', signature(spec, size));
    n.src = url(spec, size);
    n.alt = '';
    return n;
  }

  window.Icones = { canvas, element, html, image, url, signature,
                    formes: F, mix, clair: cl, ombre: om };

})();
