/* ============================================================
   LE BOURG - 3d/village-doc.js
   LE VILLAGE DU JOUEUR, IMPORTE TEL QUEL depuis « village 3D.html ».

   Le corps de ce fichier est le script d'origine, au caractere pres :
   meme grille, meme cote, meme terrain, memes essences d'arbres, memes
   TYPES et leurs parts, memes toits, memes interieurs, meme cycle du
   jour. On n'y a rien redessine.

   Ce qui l'entoure, en revanche, a ete retire ou neutralise, parce que
   le jeu s'en charge : la barre d'outils du bac a sable, la palette,
   l'enregistrement dans l'URL, et le peuplement aleatoire au demarrage
   - l'ile du jeu commence VIDE, le joueur la batit.

   Les entrailles sont exposees en fin de fichier (window.__VDOC) ;
   village3d.js s'en sert pour brancher l'economie du bourg dessus.
   ============================================================ */
"use strict";
(function(){

/* --- les elements que le document attend. Le canevas est celui du jeu ;
       le reste devient des souches muettes hors de l'ecran. --- */
(function souches(){
  var veut = ['types','palette','toast','btnVider','btnIle','btnVille',
              'btnLien','btnCiel','btnAnnuler','btnRetablir'];
  var bac = document.createElement('div');
  bac.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden';
  for(var k=0;k<veut.length;k++){
    var id = veut[k];
    if(document.getElementById(id)) continue;
    var e = document.createElement(id.indexOf('btn')===0 ? 'button' : 'div');
    e.id = id;
    bac.appendChild(e);
  }
  document.body.appendChild(bac);
})();

"use strict";

/* ============================================================
   1. Constantes
   ============================================================ */
const RAYON_HEX = 5;      // rayon de la grille triangulaire de départ
const H         = 0.62;   // hauteur d'un bloc
const H_TOIT    = 0.42;   // hauteur de faîtage
const D_TOIT    = 0.30;   // retrait du faîtage (crée l'arête)
const H_MAX     = 14;     // hauteur max d'une colonne
const K_TAILLE  = 0.75;   // force d'égalisation de la taille des cellules
const R_ROND    = 0.28;   // rayon d'arrondi des angles des tours isolées
const BISEAU    = 0.10;   // hauteur du congé entre partie ronde et partie carrée
/* Avancée de l'égout. Mesurée : à 0,07 le débord ouvrait des fentes sur les
   silhouettes de toit — 24 sur 50 vues contre 11 sans débord. À 0,025 il donne
   l'épaisseur recherchée sans en créer : 7 fentes, moins que sans lui. */
/* Débord de pan : abandonné. L'égout devait se poser sur le prolongement du
   plan de toiture — mais un angle arrondi est un cône, pas un plan : une seule
   pente ne convient pas à tous ses points, et le raccord s'ouvrait. Le volume
   vient d'une corniche, bandeau fermé posé sous l'égout, indépendant de la
   géométrie du toit et donc incapable de la percer. */
/* Réhausse d'égout. Le toit prenait naissance au ras du haut de mur : il
   s'écrasait sur la façade, sans respiration entre le linteau des baies et
   l'avant-toit. Une frise verticale de huit centimètres, dans la couleur du
   mur, sépare désormais les deux — c'est elle qui porte la corniche. */
const REHAUSSE  = 0.085;
const CORNICHE  = 0.050;  // saillie du bandeau d'égout
const H_CORN    = 0.048;  // sa hauteur
const N_ARC     = 4;      // segments par angle arrondi
const N_ARCHE   = 8;      // segments par arche de renfort
const Y_QUILLE  = -1.15;  // profondeur du socle de pierre

const PAL = [
  '#f4ead4','#f6cd72','#e8a03c','#dd6f3f','#c33c33','#e58f9b',
  '#9a5b8e','#4d6fa3','#57a19c','#7ba05b','#f2f1e9','#93918a','#5d4a3c'
];
const TOITS  = [
  '#bf4230','#d0603a','#8f5748','#6b7a82','#a4402d',
  '#765047','#526573','#8b6b45','#736f5d','#9a5a3d'
];
const PIERRE = '#b6a996';
const VITRE  = '#26394a';
/* Menuiseries. Le blanc crème donnait des fenêtres de maison de bord de mer,
   pas de bourg médiéval : les châssis y sont en bois, l'encadrement en pierre.
   Trois partis tirés par bâtiment — chêne sombre, chêne clair, pierre. */
const CADRES = ['#6b563f', '#8a7355', '#9d9384'];
const CADRE  = '#7d6a52';
const BOIS   = '#4a3a30';
const EAU    = '#4f8c96';

/* Bâtiments à particularités. Chacun est fait de `parts`, posées d'un seul
   tenant : `dl` décale d'un niveau, `df` désigne la face locale à franchir
   pour atteindre une cellule voisine. `faces` est lu dans le repère local, la
   rotation le fait tourner sur la grille. Une face 'mur' est raccordable ;
   'ouvert' et 'deco' sont personnalisées, donc protégées. `sommet` interdit en
   plus de bâtir au-dessus, `cour` rend la part en terrasse basse. */
const TYPES = [
  { nom:'Forge', mur:'#8d8378', toit:'#4b4a52', parts:[
      { faces:['ouvert','mur','deco','mur'], pignon:true, pente:1.55 },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { dl:1, sommet:true, pignon:true, pente:1.55, mur:'#77716d', toit:'#3f4148',
        faces:['mur','mur','mur','mur'] },
      { df:1, sommet:true, pignon:true, pente:0.82, appentis:3,
        mur:'#786b5d', toit:'#55535a', faces:['mur','mur','mur','mur'] } ] },

  { nom:'Boulangerie', mur:'#e0c48f', toit:'#b6503a', parts:[
      { faces:['ouvert','mur','deco','mur'], pignon:true, pente:1.20, appentis:3 },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { dl:1, sommet:true, pignon:true, pente:1.28,
        faces:['mur','mur','mur','mur'] },
      { df:1, sommet:true, pignon:true, pente:0.92, chaume:true,
        mur:'#c7aa76', toit:'#b8945c', faces:['mur','mur','mur','mur'] } ] },

  { nom:'Moulin', mur:'#ece5d4', toit:'#6b7a82', parts:[
      { faces:['deco','mur','deco','mur'], rond:true },
      { dl:1, ailes:true, rond:true, cone:true, haut:0.58,
        faces:['deco','mur','deco','mur'] },
      { dl:2, sommet:true, rond:true, cone:true, haut:0.68,
        faces:['mur','mur','mur','mur'] },
      { df:2, sommet:true, pignon:true, pente:0.98,
        mur:'#c9bda3', toit:'#596a70', faces:['ouvert','mur','mur','mur'] } ] },

  { nom:'Bergerie', mur:'#cbb89a', toit:'#c4a86a', parts:[
      { faces:['ouvert','mur','deco','mur'], pignon:true, pente:1.05, chaume:true, appentis:3 },
      { df:0, cour:true, cloture:true, sommet:true,
        faces:['deco','deco','mur','deco'] },
      { dl:1, sommet:true, pignon:true, pente:1.08, chaume:true,
        faces:['mur','mur','mur','mur'] },
      { df:1, sommet:true, pignon:true, pente:0.80, chaume:true,
        mur:'#b8a482', toit:'#b99a5e', faces:['mur','mur','mur','mur'] } ] },

  // ne se pose qu'en bordure : sa face ouverte doit donner sur l'eau
  { nom:'Pêcherie', mur:'#93aab2', toit:'#5b6f78', bordEau:true, parts:[
      { faces:['ouvert','mur','deco','mur'], ponton:true, pignon:true, pente:1.30 },
      { df:2, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { dl:1, sommet:true, pignon:true, pente:1.34,
        mur:'#829ba5', faces:['mur','mur','mur','mur'] },
      { df:1, sommet:true, pignon:true, pente:0.86,
        mur:'#789198', toit:'#4d626b', faces:['mur','mur','mur','mur'] } ] },

  { nom:'Mine', mur:'#8b8378', toit:'#4f4a45', parts:[
      { faces:['ouvert','mur','deco','mur'], pignon:true, pente:0.72, appentis:1 },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { df:1, faces:['ouvert','mur','mur','mur'], mur:'#776f66' },
      { df:1, dl:1, sommet:true, pignon:true, pente:1.12,
        mur:'#706a64', toit:'#474442', faces:['mur','mur','mur','mur'] } ] },

  { nom:'Scierie', mur:'#b08a5e', toit:'#7a5a3f', parts:[
      { faces:['ouvert','mur','deco','mur'], roue:true, pignon:true, pente:0.85, appentis:1 },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { df:1, faces:['ouvert','mur','mur','mur'], mur:'#96724f' },
      { df:1, dl:1, sommet:true, pignon:true, pente:1.02,
        mur:'#8d6949', toit:'#65472f', faces:['mur','mur','mur','mur'] } ] },

  { nom:'Laiterie', mur:'#e8e0d0', toit:'#c4a86a', parts:[
      { faces:['ouvert','mur','deco','mur'], pignon:true, pente:1.10, chaume:true, appentis:1 },
      { df:0, cour:true, sommet:true, pergola:true,
        faces:['deco','deco','mur','deco'] },
      { dl:1, sommet:true, pignon:true, pente:1.12, chaume:true,
        faces:['mur','mur','mur','mur'] },
      { df:1, sommet:true, pignon:true, pente:0.84, chaume:true,
        mur:'#d3c8b5', toit:'#b79a61', faces:['mur','mur','mur','mur'] } ] },

  // cultures : une seule part au sol, raccordable de tous côtés
  { nom:'Blé',        auSol:true, mur:'#d8bd6f', toit:'#d8bd6f', parts:[
      { cour:true, champ:0, sommet:true, faces:['mur','mur','mur','mur'] } ] },
  { nom:'Tournesols', auSol:true, mur:'#e8c34a', toit:'#e8c34a', parts:[
      { cour:true, champ:1, sommet:true, faces:['mur','mur','mur','mur'] } ] },
  { nom:'Légumes',    auSol:true, mur:'#6f8f4a', toit:'#6f8f4a', parts:[
      { cour:true, champ:2, sommet:true, faces:['mur','mur','mur','mur'] } ] },
  { nom:'Fleurs',     auSol:true, mur:'#c56d8f', toit:'#c56d8f', parts:[
      { cour:true, champ:3, sommet:true, faces:['mur','mur','mur','mur'] } ] },

  // trois corps : boutique, tourelle ronde à l'étage, cour aux cristaux
  { nom:'Alchimie', mur:'#6a6390', toit:'#3f3b5c', parts:[
      { faces:['ouvert','mur','deco','mur'] },
      { dl:1, rond:true, tourelle:true, sommet:true, cone:true, haut:0.70,
        faces:['deco','mur','deco','mur'] },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { df:1, sommet:true, pignon:true, pente:1.18,
        mur:'#536f73', toit:'#354f58', faces:['ouvert','mur','deco','mur'] } ] },

  // salle basse, galerie de bois à l'étage, terrasse devant
  { nom:'Auberge', mur:'#d9a961', toit:'#8f4a35', parts:[
      { faces:['ouvert','mur','deco','mur'] },
      { dl:1, galerie:true, sommet:true, pignon:true, pente:1.35,
        faces:['deco','mur','deco','mur'] },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { df:1, faces:['ouvert','mur','mur','mur'], mur:'#c69055' },
      { df:1, dl:1, galerie:true, sommet:true, pignon:true, pente:1.08,
        mur:'#bd824d', toit:'#773d30', faces:['deco','mur','mur','mur'] } ] },

  { nom:'Pépinière', mur:'#cfd8c2', toit:'#c4a86a', parts:[
      { faces:['ouvert','mur','deco','mur'], pignon:true, pente:0.95, chaume:true },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { dl:1, sommet:true, pignon:true, pente:0.98, chaume:true,
        faces:['mur','mur','mur','mur'] },
      { df:1, sommet:true, pignon:true, pente:0.62,
        mur:'#adc8bd', toit:'#78958d', faces:['deco','mur','mur','mur'] },
      { df:2, cour:true, cloture:true, sommet:true,
        faces:['deco','deco','mur','deco'] } ] },

  /* La Tour sombre. Elle ne se pose pas comme les autres : au lieu d'atteindre
     ses voisines par des décalages de face — qui ne savent aller qu'à une case
     —, elle occupe les QUATRE cellules réunies autour d'un sommet et monte de
     six niveaux. Ses parts sont donc engendrées : quatre colonnes de six. */
  { nom:'Tour sombre', auSol:true, mur:'#5f5a58', toit:'#3d3a38', bloc4:true, niveaux:6,
    parts:(()=>{
      const P2 = [];
      for(let k=0;k<4;k++) for(let L=0;L<6;L++){
        P2.push({ colonne:k, meurtriere:true, sommet:L===5, plateforme:L===5,
                  faces:['mur','mur','mur','mur'] });
      }
      return P2;
    })() },

  // petit fort : donjon sur deux niveaux, basse-cour, tourelle d'angle
  { nom:'Caserne', mur:'#9a968c', toit:'#5f5b55', parts:[
      { faces:['ouvert','mur','deco','mur'] },
      { dl:1, hourd:true, fortifie:true, sommet:true,
        faces:['deco','mur','deco','mur'] },
      { df:0, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      { df:1, tourGuet:true, fortifie:true, sommet:true,
        faces:['deco','deco','mur','deco'] },
      { df:2, fortifie:true, faces:['ouvert','mur','mur','mur'], mur:'#85827b' },
      { df:2, dl:1, fortifie:true, sommet:true, pignon:true, pente:0.96,
        mur:'#7b7973', toit:'#504d49', faces:['mur','mur','mur','mur'] } ] },

  /* LE PORT. Toujours en dernier : les sauvegardes stockent l'INDICE du type,
     une insertion plus haut décalerait tout le bourg déjà bâti.
     Il partage avec la pêcherie le `bordEau` et le ponton — c'est le même
     rivage —, mais il s'ÉTALE au lieu de monter : aucune part n'a de `dl`,
     tout tient au sol sur quatre cellules. Un magasin de quai au pignon
     tourné vers le large, une halle en retour, le quai dallé où l'on charge,
     et la vigie du capitaine. Les toits sont volontairement plats de pente
     (0,58 et 0,66, contre 1,30 à la pêcherie) : ce sont des hangars, pas des
     maisons. */
  { nom:'Port', mur:'#a29b8c', toit:'#4f5a5e', bordEau:true, parts:[
      /* Le magasin. Sa face 0 est celle que `bordEau` force à donner sur le
         large : elle porte le ponton, et au-dessus une galerie de bois d'où
         l'on descend les charges. Mur plein côté mer, la grande porte est de
         flanc, sur le quai. */
      { faces:['deco','ouvert','mur','mur'], ponton:true, galerie:true,
        sommet:true, pignon:true, pente:0.58 },
      // le quai dallé, au flanc du magasin : c'est là que les habitants chargent
      { df:1, cour:true, sommet:true, faces:['deco','deco','mur','deco'] },
      // la halle en retour, son appentis à marchandises ouvert côté terre
      { df:2, sommet:true, pignon:true, pente:0.66, appentis:0,
        mur:'#968f7e', toit:'#475256', faces:['mur','mur','mur','mur'] },
      // la vigie du capitaine : tour basse coiffée d'un cône, en bout de môle
      { df:3, sommet:true, rond:true, cone:true, haut:0.52,
        mur:'#9c9689', toit:'#455054', faces:['mur','mur','mur','mur'] } ] }
];

const TYPE_CASERNE = TYPES.findIndex(t => t.nom === 'Caserne');

/* ============================================================
   2. Utilitaires
   ============================================================ */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash3(a,b,c){
  let x = (a*374761393 + b*668265263 + c*1274126177) | 0;
  x = Math.imul(x ^ x >>> 13, 1274126177);
  return ((x ^ x >>> 16) >>> 0) / 4294967296;
}
function melanger(arr, rnd){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rnd()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
}
const cacheCouleur = new Map();
function lin(hex){
  if(!cacheCouleur.has(hex)){
    cacheCouleur.set(hex, new THREE.Color(hex).convertSRGBToLinear());
  }
  return cacheCouleur.get(hex);
}

/* ============================================================
   3. Génération de la grille : hex -> triangles -> quads -> relaxation
   ============================================================ */
let P = [];       // sommets [x, z]
let cellules = [];// {q:[4 idx], cx, cz, nb:[4], h, cols:[]}
let buckets = new Map();
let parSommet = new Map();

function genererGrille(seed){
  const rnd = mulberry32(seed);
  const R = RAYON_HEX;
  const cle = (q,r) => q + ',' + r;
  const idx = new Map();
  let pts = [];

  for(let q=-R;q<=R;q++) for(let r=-R;r<=R;r++){
    if(Math.abs(q+r) > R) continue;
    idx.set(cle(q,r), pts.length);
    pts.push([q + r*0.5, r*Math.sqrt(3)/2]);
  }
  const a = (q,r) => idx.has(cle(q,r));
  const g = (q,r) => idx.get(cle(q,r));

  // triangles orientés CCW, étiquetés « pointe en haut » / « pointe en bas »
  const tris = [], sens = [];
  for(let q=-R;q<=R;q++) for(let r=-R;r<=R;r++){
    if(a(q,r) && a(q+1,r) && a(q,r+1)){
      tris.push([g(q,r), g(q+1,r), g(q,r+1)]); sens.push(0);
    }
    if(a(q+1,r) && a(q+1,r+1) && a(q,r+1)){
      tris.push([g(q+1,r), g(q+1,r+1), g(q,r+1)]); sens.push(1);
    }
  }

  /* Appariement de triangles voisins en quads.
     Le graphe d'adjacence des triangles est BIPARTI (un triangle pointe en haut
     ne touche que des triangles pointe en bas), donc on peut calculer un
     couplage MAXIMUM par chemins augmentants (Kuhn) au lieu d'un glouton.
     Un couplage glouton laisse beaucoup de triangles orphelins, et chaque
     orphelin se subdivise en 3 quads à 120° : c'est là que naissent les
     cellules difformes. On en garde volontairement une petite proportion. */
  const arcs = new Map();
  tris.forEach((t,ti)=>{
    for(let i=0;i<3;i++){
      const u=t[i], v=t[(i+1)%3];
      const k = Math.min(u,v)+'_'+Math.max(u,v);
      if(!arcs.has(k)) arcs.set(k,[]);
      arcs.get(k).push(ti);
    }
  });
  const adj = tris.map(()=>[]);
  arcs.forEach(l=>{
    if(l.length !== 2) return;
    const [x,y] = l;
    if(sens[x] === sens[y]) return;
    adj[x].push(y); adj[y].push(x);
  });
  adj.forEach(l => melanger(l, rnd));

  const conj = new Array(tris.length).fill(-1);
  const essayer = (u, vus) => {
    for(const v of adj[u]){
      if(vus[v]) continue;
      vus[v] = 1;
      if(conj[v] === -1 || essayer(conj[v], vus)){
        conj[v] = u; conj[u] = v;
        return true;
      }
    }
    return false;
  };
  const gauche = [];
  tris.forEach((t,ti)=>{ if(sens[ti] === 0) gauche.push(ti); });
  melanger(gauche, rnd);
  for(const u of gauche){
    if(conj[u] === -1) essayer(u, new Uint8Array(tris.length));
  }

  // on rouvre quelques paires pour conserver un peu d'irrégularité
  for(let i=0;i<tris.length;i++){
    if(conj[i] > i && rnd() < 0.05){ conj[conj[i]] = -1; conj[i] = -1; }
  }

  const faces = [], vu = new Array(tris.length).fill(false);
  for(let t1i=0; t1i<tris.length; t1i++){
    const t2i = conj[t1i];
    if(t2i < 0 || vu[t1i]) continue;
    vu[t1i] = vu[t2i] = true;
    const t1 = tris[t1i], t2 = tris[t2i];
    let pos = -1;
    for(let x=0;x<3;x++){
      if(t2.includes(t1[x]) && t2.includes(t1[(x+1)%3])){ pos = x; break; }
    }
    if(pos < 0){ vu[t1i] = vu[t2i] = false; continue; }
    const u = t1[pos], v = t1[(pos+1)%3], tiers = t1[(pos+2)%3];
    const w = t2.find(x => x !== u && x !== v);
    faces.push([tiers, u, w, v]);
  }
  tris.forEach((t,ti)=>{ if(!vu[ti]) faces.push(t.slice()); });

  // subdivision : tout devient quad
  const np = pts.map(p => [p[0], p[1]]);
  const milieux = new Map();
  const mid = (u,v) => {
    const k = Math.min(u,v)+'_'+Math.max(u,v);
    if(milieux.has(k)) return milieux.get(k);
    const i = np.length;
    np.push([(np[u][0]+np[v][0])/2, (np[u][1]+np[v][1])/2]);
    milieux.set(k,i);
    return i;
  };
  const quads = [];
  for(const f of faces){
    const n = f.length;
    let cx=0, cy=0;
    for(const v of f){ cx += np[v][0]; cy += np[v][1]; }
    const fi = np.length;
    np.push([cx/n, cy/n]);
    for(let i=0;i<n;i++){
      quads.push([ f[i], mid(f[i], f[(i+1)%n]), fi, mid(f[(i+n-1)%n], f[i]) ]);
    }
  }

  /* Relaxation. Deux forces :
     - chaque quad tire ses sommets vers son carré idéal (moyenne des sommets
       tournés de -i*90°, puis retournés) ;
     - le rayon visé de ce carré est ramené vers le rayon moyen de toute la
       grille (K_TAILLE), ce qui égalise la taille des cellules. Sans ce second
       terme le rapport d'aire entre grandes et petites cellules atteint 2,7 :
       c'est ce qui produisait des toits aux proportions bizarres. */
  /* Deux phases. La première égalise fortement les tailles ; la seconde
     relâche cette contrainte pour laisser les quads se redresser. Mesuré sur
     six graines : l'écart moyen des angles à 90° tombe de 10,3° à 8,5°, au prix
     d'un rapport d'aire qui passe de 1,86 à 2,04. Pousser plus loin la
     régularité angulaire fait exploser l'inégalité des tailles — la topologie
     issue de l'appariement impose des sommets de valence 3 ou 5, qu'aucune
     relaxation ne peut redresser. */
  const COS = [1,0,-1,0], SIN = [0,1,0,-1];
  const PHASES = [[80, 0.75, 0.35], [220, 0.55, 0.55]];
  for(const [NIT, KT, PAS] of PHASES)
  for(let it=0; it<NIT; it++){
    const acc = np.map(()=>[0,0,0]);
    let rMoy = 0;
    for(const q of quads){
      let cx=0, cy=0;
      for(const v of q){ cx += np[v][0]; cy += np[v][1]; }
      cx/=4; cy/=4;
      let d=0;
      for(const v of q) d += Math.hypot(np[v][0]-cx, np[v][1]-cy);
      rMoy += d/4;
    }
    rMoy /= quads.length;
    for(const q of quads){
      let cx=0, cy=0;
      for(const v of q){ cx += np[v][0]; cy += np[v][1]; }
      cx/=4; cy/=4;
      let ux=0, uy=0;
      for(let i=0;i<4;i++){
        const dx = np[q[i]][0]-cx, dy = np[q[i]][1]-cy;
        ux += dx*COS[i] + dy*SIN[i];   // rotation de -i*90°
        uy += -dx*SIN[i] + dy*COS[i];
      }
      ux/=4; uy/=4;
      const m = Math.hypot(ux,uy);
      if(m > 1e-6){
        const k = (m*(1-KT) + rMoy*KT) / m;
        ux *= k; uy *= k;
      }
      for(let i=0;i<4;i++){
        const tx = cx + ux*COS[i] - uy*SIN[i];
        const ty = cy + ux*SIN[i] + uy*COS[i];
        acc[q[i]][0]+=tx; acc[q[i]][1]+=ty; acc[q[i]][2]++;
      }
    }
    for(let i=0;i<np.length;i++){
      if(!acc[i][2]) continue;
      np[i][0] += (acc[i][0]/acc[i][2] - np[i][0])*PAS;
      np[i][1] += (acc[i][1]/acc[i][2] - np[i][1])*PAS;
    }
  }
  for(const p of np){ p[0]*=2; p[1]*=2; }

  // orientation cohérente (aire signée positive)
  for(const q of quads){
    let s = 0;
    for(let i=0;i<4;i++){
      const A = np[q[i]], B = np[q[(i+1)%4]];
      s += A[0]*B[1] - B[0]*A[1];
    }
    if(s < 0) q.reverse();
  }

  P = np;
  cellules = quads.map((q,i)=>{
    let cx=0, cz=0;
    for(const v of q){ cx += np[v][0]; cz += np[v][1]; }
    return { i, q, cx:cx/4, cz:cz/4, nb:[null,null,null,null], b:[], sp:[] };
  });

  // voisinage par arête
  const parArete = new Map();
  cellules.forEach(c=>{
    for(let i=0;i<4;i++){
      const u=c.q[i], v=c.q[(i+1)%4];
      const k = Math.min(u,v)+'_'+Math.max(u,v);
      if(!parArete.has(k)) parArete.set(k,[]);
      parArete.get(k).push([c,i]);
    }
  });
  parArete.forEach(l=>{
    if(l.length===2){
      l[0][0].nb[l[0][1]] = l[1][0];
      l[1][0].nb[l[1][1]] = l[0][0];
    }
  });

  // quelles cellules touchent chaque sommet (pour refermer les angles de toit)
  parSommet = new Map();
  cellules.forEach(c=>{
    for(const v of c.q){
      if(!parSommet.has(v)) parSommet.set(v, []);
      parSommet.get(v).push(c);
    }
  });

  // index spatial pour le picking
  anneauCote = null;
  foretFoyers = null;
  cacheSol = new Map();
  cacheForet = new Map();
  buckets = new Map();
  cellules.forEach(c=>{
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for(const v of c.q){
      x0=Math.min(x0,P[v][0]); x1=Math.max(x1,P[v][0]);
      z0=Math.min(z0,P[v][1]); z1=Math.max(z1,P[v][1]);
    }
    for(let gx=Math.floor(x0);gx<=Math.floor(x1);gx++)
      for(let gz=Math.floor(z0);gz<=Math.floor(z1);gz++){
        const k = gx+','+gz;
        if(!buckets.has(k)) buckets.set(k,[]);
        buckets.get(k).push(c);
      }
  });
}

function celluleEn(x,z){
  const l = buckets.get(Math.floor(x)+','+Math.floor(z));
  if(!l) return null;
  for(const c of l){
    let dedans = true;
    for(let i=0;i<4;i++){
      const A = P[c.q[i]], B = P[c.q[(i+1)%4]];
      if((B[0]-A[0])*(z-A[1]) - (B[1]-A[1])*(x-A[0]) < 0){ dedans = false; break; }
    }
    if(dedans) return c;
  }
  return null;
}

/* ============================================================
   4. Scène
   ============================================================ */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
/* Ombres nettes plutôt que douces. Le filtrage doux étalait les petits objets
   — garde-corps, potences — en taches floues qui frémissaient dès que le
   soleil bougeait. Un filtrage simple sur une carte plus fine et une emprise
   resserrée sur l'île donne un contour franc. */
renderer.shadowMap.type = THREE.PCFShadowMap;
/* La carte d'ombre n'est PAS refaite à chaque image. Redessiner cinquante-cinq
   mille triangles dans une carte de profondeur soixante fois par seconde coûte
   plus cher que toute la scène visible. Elle n'est recalculée que lorsque la
   géométrie change ou que le soleil franchit un cran — soit quelques dizaines
   de fois par cycle complet au lieu de dix mille. */
renderer.shadowMap.autoUpdate = false;
let ombreARefaire = true;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(lin(EAU), 16, 52);

/* Ciel. Un dégradé en CSS derrière un canevas transparent laisse forcément une
   couture : la ligne d'horizon se déplace avec la caméra, alors que le dégradé,
   lui, est fixé à l'écran. Le ciel est donc un dôme dans la scène, dont la
   couleur au niveau de l'horizon est exactement celle du brouillard. L'eau
   lointaine se fond dans ce même brouillard, donc les deux se rejoignent sur la
   même valeur quelle que soit l'inclinaison de la caméra : plus de ligne. */
const geoCiel = new THREE.SphereGeometry(160, 32, 20);
{
  const p = geoCiel.attributes.position;
  const c = new Float32Array(p.count*3), u = new Float32Array(p.count);
  const doux = (v) => { v = Math.max(0, Math.min(1, v)); return v*v*(3-2*v); };
  for(let i=0;i<p.count;i++){
    const t = Math.max(0, p.getY(i)/160);
    // un seul paramètre de 0 (horizon) à 1 (zénith), recoloré à chaque image
    u[i] = t < 0.30 ? doux(t/0.30)*0.55 : 0.55 + doux((t-0.30)/0.70)*0.45;
  }
  geoCiel.setAttribute('color', new THREE.BufferAttribute(c,3));
  geoCiel.userData.u = u;
}
const ciel = new THREE.Mesh(geoCiel, new THREE.MeshBasicMaterial({
  vertexColors:true, side:THREE.BackSide, depthWrite:false, fog:false
}));
ciel.renderOrder = -100;
scene.add(ciel);

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 420);
const cible = new THREE.Vector3(0, 1.4, 0);
let orbite = { theta: 0.7, phi: 1.02, rayon: 24 };

const soleil = new THREE.DirectionalLight(0xfff3e0, 1.35);
soleil.position.set(9, 15, 7);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
const sc = soleil.shadow.camera;
sc.left=-13.5; sc.right=13.5; sc.top=13.5; sc.bottom=-13.5; sc.near=3; sc.far=48;
soleil.shadow.bias = -0.00015;
soleil.shadow.normalBias = 0.035;
scene.add(soleil, soleil.target);
const ambiance = new THREE.HemisphereLight(0xbfe6ea, 0x2b5a63, 0.85);
scene.add(ambiance);

// La géométrie est non indexée et chaque triangle reçoit directement sa
// normale de face pendant sa création : rendu à facettes sans seconde passe.
/* La ville est rendue en DOUBLE FACE. La géométrie est un assemblage de
   surfaces simples — murs, pans, bandeaux — et non un solide fermé : partout
   où deux volumes se rencontrent sous un angle inattendu, une facette se
   retrouve vue de dos et disparaît, laissant croire à un trou alors que la
   matière est là. Mesuré avec un détecteur qui compare un rendu avec et sans
   élimination des faces arrière : environ trois mille pixels concernés sur
   quarante vues. En double face le phénomène disparaît par construction, sans
   un triangle de plus. */
const matVille = new THREE.MeshLambertMaterial({
  vertexColors:true, side:THREE.DoubleSide
});
const meshVille = new THREE.Mesh(new THREE.BufferGeometry(), matVille);
const meshDetails = new THREE.Mesh(new THREE.BufferGeometry(), matVille);
/* Le terrain vit dans son propre maillage. Sa géométrie ne dépend que de
   l'empreinte des bâtiments au sol, pas de leur hauteur : empiler, recolorer
   ou modifier un étage ne doit donc plus reconstruire les pavés, la côte et
   les places. Ce maillage conserve ses propres métadonnées de pointage. */
const meshTerrain = new THREE.Mesh(new THREE.BufferGeometry(), matVille);
meshTerrain.castShadow = false;
meshTerrain.receiveShadow = true;
meshDetails.castShadow = false;      // c'est tout l'intérêt de les séparer
meshDetails.receiveShadow = true;
scene.add(meshDetails);
meshVille.castShadow = meshVille.receiveShadow = true;
scene.add(meshTerrain, meshVille);

/* Le reflet a été retiré : depuis que l'île couvre toute la grille, la ville
   est entièrement au-dessus de la terre ferme et son image miroir tombait sous
   le sol, invisible. Elle coûtait la moitié d'un tampon de géométrie. */

/* Trois calques de lueurs, un par famille de sources : elles ne vacillent pas
   au même rythme, sinon toute la ville clignote d'un bloc. */
const NB_LUEURS = 6;
const matLampes = [], meshLampes = [];
for(let g=0; g<NB_LUEURS; g++){
  const m = new THREE.MeshBasicMaterial({
    vertexColors:true, transparent:true, opacity:0,
    blending:THREE.AdditiveBlending, depthWrite:false, fog:false
  });
  const o = new THREE.Mesh(new THREE.BufferGeometry(), m);
  o.renderOrder = 4;
  o.visible = false;
  scene.add(o);
  matLampes.push(m); meshLampes.push(o);
}

/* Surface de l'eau. Le dégradé de profondeur est peint dans les sommets, en
   anneaux concentriques, et non obtenu par le brouillard : au large, la couleur
   vaut EXACTEMENT celle de l'horizon du dôme, et les deux surfaces empruntent
   le même chemin de rendu — mêmes valeurs, même matériau, mêmes couleurs par
   sommet. La jonction ne peut donc plus dépendre d'un réglage de brouillard. */
function geometrieEau(){
  const seg = 72, nr = 26, R = [];
  for(let i=0;i<=nr;i++) R.push(0.4*Math.pow(1.32, i));
  const doux = (v)=>{ v=Math.max(0,Math.min(1,v)); return v*v*(3-2*v); };
  const p = [], u = [];
  for(let i=0;i<nr;i++){
    const r0=R[i], r1=R[i+1], u0=doux((r0-5)/58), u1=doux((r1-5)/58);
    for(let k=0;k<seg;k++){
      const a0=k/seg*Math.PI*2, a1=(k+1)/seg*Math.PI*2;
      const A=[Math.cos(a0)*r0,0,Math.sin(a0)*r0], B=[Math.cos(a1)*r0,0,Math.sin(a1)*r0];
      const C=[Math.cos(a1)*r1,0,Math.sin(a1)*r1], D=[Math.cos(a0)*r1,0,Math.sin(a0)*r1];
      p.push(...A,...D,...C, ...A,...C,...B);
      u.push(u0,u1,u1, u0,u1,u0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(u.length*3),3));
  g.userData.u = Float32Array.from(u);
  return g;
}
const eau = new THREE.Mesh(geometrieEau(), new THREE.MeshBasicMaterial({
  vertexColors:true, transparent:true, opacity:0.82,
  depthWrite:false, fog:false, side:THREE.DoubleSide
}));
eau.renderOrder = 2;
scene.add(eau);

/* Feuillage : le balancement est appliqué dans le nuanceur de sommets, sinon
   il faudrait un objet par arbre. */
const tempsArbres = { value: 0 };
const matArbres = new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide, dithering:true});
matArbres.onBeforeCompile = (sh)=>{
  sh.uniforms.uTemps = tempsArbres;
  sh.vertexShader =
    'attribute float aSouple;\nattribute float aPhase;\nuniform float uTemps;\n' +
    sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n' +
      'transformed.x += sin(uTemps*1.15 + aPhase) * aSouple * 0.075;\n' +
      'transformed.z += sin(uTemps*0.83 + aPhase*1.7) * aSouple * 0.055;\n' +
      'transformed.y += sin(uTemps*1.54 + aPhase*1.31) * aSouple * 0.010;');
};
const meshArbres = new THREE.Mesh(new THREE.BufferGeometry(), matArbres);
meshArbres.castShadow = true;
scene.add(meshArbres);

const grpPoissons = new THREE.Group();
scene.add(grpPoissons);

const grpAiles = new THREE.Group();
scene.add(grpAiles);

// Ressac : bandes translucides qui glissent le long du profil de plage.
const matVague = new THREE.MeshBasicMaterial({
  vertexColors:true, transparent:true, opacity:0.62,
  depthWrite:false, fog:false, side:THREE.DoubleSide
});
const meshVague = new THREE.Mesh(new THREE.BufferGeometry(), matVague);
meshVague.renderOrder = 3;
meshVague.visible = false;
meshVague.frustumCulled = false;       // géométrie animée dans une emprise fixe
scene.add(meshVague);

const matGrille = new THREE.LineBasicMaterial({
  color:lin('#a9dde0'), transparent:true, opacity:0.16, depthWrite:false
});
const grille = new THREE.LineSegments(new THREE.BufferGeometry(), matGrille);
grille.renderOrder = 3;
scene.add(grille);

const matSurvol = new THREE.MeshBasicMaterial({
  color:lin('#ffffff'), transparent:true, opacity:0.3,
  depthWrite:false, side:THREE.DoubleSide
});
const survol = new THREE.Mesh(new THREE.BufferGeometry(), matSurvol);
survol.visible = false;
survol.renderOrder = 4;
scene.add(survol);

/* ============================================================
   5. Construction de la géométrie
   ============================================================ */
/* Les tampons de géométrie sont des Float32Array à curseur, pas des tableaux
   JS. Deux gains : l'écriture par index évite des centaines de milliers
   d'appels à push, et l'attribut final se construit par recopie mémoire au
   lieu d'une conversion élément par élément. */
function tampon(n){ return { a:new Float32Array(n||4096), n:0 }; }
function place(t, k){
  if(t.n + k <= t.a.length) return;
  const b = new Float32Array(Math.max(t.a.length*2, t.n+k));
  b.set(t.a.subarray(0, t.n));
  t.a = b;
}
/* Vue sur le tampon plutôt que copie. `slice` allouait et recopiait quatre
   mégaoctets à chaque reconstruction, uniquement pour donner sa taille exacte
   à l'attribut : c'était vingt millisecondes de pure recopie et la pression
   sur le ramasse-miettes qui va avec. `subarray` ne fait qu'une vue. Sûr ici
   parce que la géométrie est téléversée dans la foulée, au même tour de
   boucle, et que faire grandir un tampon alloue un nouveau tableau sans
   toucher à l'ancien. */
const fige = (t) => t.a.subarray(0, t.n);
const vide = (t) => { t.n = 0; return t; };

let pos = tampon(), col = tampon(), nor = tampon();
let meta = [], lam = tampon(), ctx = null;
/* Les faces lumineuses sont dupliquées dans un calque additif, décalé de cinq
   millimètres le long de leur normale. Ce calque est invisible le jour et son
   opacité suit la nuit. C'est plus robuste qu'une injection dans le nuanceur :
   aucune dépendance au nom des morceaux de shader de la bibliothèque. */
/* Second tampon : les menus détails — menuiseries, colombages, lierre,
   ferronneries, guirlandes, encombrements d'atelier. Ils partent dans un
   maillage qui ne projette PAS d'ombre. Leurs silhouettes font un ou deux
   texels dans la carte de profondeur : elles ne produisaient qu'un grésillement
   de petites taches. Ils reçoivent l'ombre, eux, comme le reste. */
let detail = false;
let posD = tampon(), colD = tampon(), norD = tampon();
/* Les bâtiments reçoivent leurs normales directement pendant l'émission des
   triangles. Le terrain et la forêt, dont des fragments sont recopiés depuis
   des caches, utilisent une passe finale complète : plus lente uniquement
   quand l'empreinte au sol change, mais impossible à désynchroniser. */
let normalesDirectes = true;

let lpos = [], lcol = [];
for(let g=0; g<6; g++){ lpos.push(tampon(512)); lcol.push(tampon(512)); }
let lampeGroupe = 0;             // 0 fenêtres, 1 lanternes et âtres, 2 guirlandes
const LUEUR_CHAUDE = { r:1.0, g:0.58, b:0.22 };
/* Marqueur de source lumineuse porté par les sommets : 0 rien, 1 fenêtre ou
   lanterne (lueur chaude fixe), 2 ampoule colorée (reprend sa propre teinte).
   Il ne sert que la nuit, où le nuanceur l'ajoute par-dessus l'éclairage. */
let lampeCourante = 0;

const occ    = (c,L) => !!c && L >= 0 && c.b[L] !== undefined && c.b[L] >= 0;
const tailler = (c) => { while(c.b.length && !occ(c, c.b.length-1)){ c.b.pop(); c.sp.pop(); } };

function pousserTri(A,B,C, c, reflet){
  const ux=B[0]-A[0], uy=B[1]-A[1], uz=B[2]-A[2];
  const vx=C[0]-A[0], vy=C[1]-A[1], vz=C[2]-A[2];
  const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
  const n2 = nx*nx+ny*ny+nz*nz;
  if(n2 < 1e-13) return;                         // triangle dégénéré
  let nnx=0, nny=0, nnz=0;
  if(normalesDirectes){
    const ni = 1/Math.sqrt(n2);
    nnx=nx*ni; nny=ny*ni; nnz=nz*ni;
  }
  if(detail){
    place(posD, 9); let d = posD.a, j2 = posD.n;
    d[j2]=A[0]; d[j2+1]=A[1]; d[j2+2]=A[2];
    d[j2+3]=B[0]; d[j2+4]=B[1]; d[j2+5]=B[2];
    d[j2+6]=C[0]; d[j2+7]=C[1]; d[j2+8]=C[2];
    posD.n = j2+9;
    place(colD, 9); d = colD.a; j2 = colD.n;
    for(let k=0;k<3;k++){ d[j2+k*3]=c.r; d[j2+k*3+1]=c.g; d[j2+k*3+2]=c.b; }
    colD.n = j2+9;
    if(normalesDirectes){
      place(norD, 9); d = norD.a; j2 = norD.n;
      for(let k=0;k<3;k++){ d[j2+k*3]=nnx; d[j2+k*3+1]=nny; d[j2+k*3+2]=nnz; }
      norD.n = j2+9;
    }
    if(lampeCourante > 0) lueur(A, B, C, c, nx, ny, nz, n2);
    return;
  }
  place(pos, 9); let q = pos.a, i = pos.n;
  q[i]=A[0]; q[i+1]=A[1]; q[i+2]=A[2];
  q[i+3]=B[0]; q[i+4]=B[1]; q[i+5]=B[2];
  q[i+6]=C[0]; q[i+7]=C[1]; q[i+8]=C[2];
  pos.n = i+9;
  place(col, 9); q = col.a; i = col.n;
  q[i]=c.r; q[i+1]=c.g; q[i+2]=c.b;
  q[i+3]=c.r; q[i+4]=c.g; q[i+5]=c.b;
  q[i+6]=c.r; q[i+7]=c.g; q[i+8]=c.b;
  col.n = i+9;
  if(normalesDirectes){
    place(nor, 9); q = nor.a; i = nor.n;
    q[i]=nnx; q[i+1]=nny; q[i+2]=nnz;
    q[i+3]=nnx; q[i+4]=nny; q[i+5]=nnz;
    q[i+6]=nnx; q[i+7]=nny; q[i+8]=nnz;
    nor.n = i+9;
  }
  meta.push(ctx);
  if(lampeCourante > 0) lueur(A, B, C, c, nx, ny, nz, n2);
}

function lueur(A, B, C, c, nx, ny, nz, n2){
  {
    const d = 0.005/Math.sqrt(n2), ex=nx*d, ey=ny*d, ez=nz*d;
    const G = lampeGroupe, tp = lpos[G], tc = lcol[G];
    place(tp, 9); let u = tp.a, j = tp.n;
    u[j]=A[0]+ex; u[j+1]=A[1]+ey; u[j+2]=A[2]+ez;
    u[j+3]=B[0]+ex; u[j+4]=B[1]+ey; u[j+5]=B[2]+ez;
    u[j+6]=C[0]+ex; u[j+7]=C[1]+ey; u[j+8]=C[2]+ez;
    tp.n = j+9;
    const g = lampeCourante > 1.5
      ? { r:Math.min(1, c.r*2.8), g:Math.min(1, c.g*2.8), b:Math.min(1, c.b*2.8) }
      : LUEUR_CHAUDE;
    place(tc, 9); u = tc.a; j = tc.n;
    for(let k=0;k<3;k++){ u[j+k*3]=g.r; u[j+k*3+1]=g.g; u[j+k*3+2]=g.b; }
    tc.n = j+9;
  }
  // le reflet est un miroir par rapport à y=0 : une face déjà immergée
  // remonterait au-dessus de l'eau. Le socle de pierre est dans ce cas.
}
function pousserQuad(A,B,C,D, c, dehors, reflet){
  let ux=B[0]-A[0], uy=B[1]-A[1], uz=B[2]-A[2];
  let vx=C[0]-A[0], vy=C[1]-A[1], vz=C[2]-A[2];
  let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
  if(nx*nx+ny*ny+nz*nz < 1e-13){                    // premier coin plat
    ux=vx; uy=vy; uz=vz;
    vx=D[0]-A[0]; vy=D[1]-A[1]; vz=D[2]-A[2];
    nx=uy*vz-uz*vy; ny=uz*vx-ux*vz; nz=ux*vy-uy*vx;
    if(nx*nx+ny*ny+nz*nz < 1e-13) return;
  }
  if(nx*dehors[0] + ny*dehors[1] + nz*dehors[2] < 0){
    pousserTri(A,D,C,c,reflet); pousserTri(A,C,B,c,reflet);
  }else{
    pousserTri(A,B,C,c,reflet); pousserTri(A,C,D,c,reflet);
  }
}
function teinte(hex, f){
  const b = lin(hex);
  return {r:b.r*f, g:b.g*f, b:b.b*f};
}
/* Variation d'une couleur de base : `f` joue sur la clarté, `m` fait glisser
   la teinte vers le chaud ou le froid. Une variation purement lumineuse donne
   un damier gris ; c'est le décalage de teinte qui fait la pierre. */
const CHAUD = '#caa063', FROID = '#6f8bab';
function grain(hex, f, m){
  const b = lin(hex), o = lin(m > 0 ? CHAUD : FROID);
  const t = Math.min(0.26, Math.abs(m));
  return {r:(b.r*(1-t)+o.r*t)*f,
          g:(b.g*(1-t)+o.g*t)*f,
          b:(b.b*(1-t)+o.b*t)*f};
}
/* Patine groupée des couvertures. Le même hasard est partagé par plusieurs
   tuiles voisines : mousse et réparations forment des plaques, pas un bruit de
   télévision. Cette variation ne crée aucun triangle supplémentaire. */
function grainToit(hex, f, m, usure){
  const c = grain(hex, f, m);
  if(usure < 0.84) return c;
  const o = lin(usure > 0.965 ? '#a17454' : '#66704d');
  const t = Math.min(0.38, (usure-0.84)*2.7);
  return {r:c.r+(o.r-c.r)*t, g:c.g+(o.g-c.g)*t, b:c.b+(o.b-c.b)*t};
}
const dist2d = (a,b) => Math.hypot(b[0]-a[0], b[1]-a[1]);

/* ---------- Placage : appareil de briques et tuiles ------------------------
   Aucune texture d'image : les murs et les pans de toit sont découpés en
   petits quads dont la couleur varie légèrement. Les rangs de briques ont des
   largeurs irrégulières et des joints décalés, ce qui suffit à casser
   l'uniformité des grandes faces. */

function pave(A, B, yb, yt, dehors, base, cle, hMax){
  const len = dist2d(A,B);
  if(len < 1e-4 || yt - yb < 1e-4) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const nl = Math.max(1, Math.round((yt-yb)/(hMax || 0.145)));
  const nc = Math.max(1, Math.round(len/0.22));
  for(let r=0;r<nl;r++){
    const v0 = yb + (yt-yb)*r/nl, v1 = yb + (yt-yb)*(r+1)/nl;
    const assise = 0.975 + hash3(cle, r, 3)*0.05;   // l'assise entière varie un peu
    let t0 = 0;
    for(let k=1;k<=nc;k++){
      const t1 = k === nc ? 1 : k/nc + (hash3(cle, r*37+k, 5)-0.5)*0.6/nc;
      const a=[A[0]+ux*len*t0, A[1]+uz*len*t0], b=[A[0]+ux*len*t1, A[1]+uz*len*t1];
      pousserQuad([a[0],v0,a[1]], [b[0],v0,b[1]], [b[0],v1,b[1]], [a[0],v1,a[1]],
                  grain(base, assise*(0.90 + hash3(cle, r*53+k, 11)*0.22),
                        (hash3(cle, r*59+k, 13)-0.5)*0.26), dehors, true);
      t0 = t1;
    }
  }
}

/* Tuiles : rangs décalés d'un demi-carreau, carreaux nettement plus petits que
   les moellons des murs, et chaque rang légèrement plus sombre à son pied pour
   suggérer le recouvrement. C'est ce qui distingue une couverture d'un mur. */
function paveToit(A, B, C, D, base, cle, dehors){
  const mel = (p,q,s) => [p[0]+(q[0]-p[0])*s, p[1]+(q[1]-p[1])*s, p[2]+(q[2]-p[2])*s];
  const pt = (s,t) => mel(mel(A,B,s), mel(D,C,s), t);
  const larg = (Math.hypot(B[0]-A[0], B[1]-A[1], B[2]-A[2]) +
                Math.hypot(C[0]-D[0], C[1]-D[1], C[2]-D[2]))/2;
  const pente = (Math.hypot(D[0]-A[0], D[1]-A[1], D[2]-A[2]) +
                 Math.hypot(C[0]-B[0], C[1]-B[1], C[2]-B[2]))/2;
  const nu = Math.max(2, Math.round(larg/0.115));
  const nv = Math.max(2, Math.round(pente/0.105));

  /* Normale du pan : elle sert à décoller très légèrement les bandes d'ombre.
     Prise sur le quadrilatère entier, elle reste fiable même là où un carreau
     dégénère en écharde près de l'arêtier. */
  const u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]], w=[D[0]-A[0],D[1]-A[1],D[2]-A[2]];
  let nR=[u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
  const lR=Math.hypot(nR[0],nR[1],nR[2])||1;
  nR=[nR[0]/lR, nR[1]/lR, nR[2]/lR];
  if(nR[0]*dehors[0]+nR[1]*dehors[1]+nR[2]*dehors[2] < 0) nR=[-nR[0],-nR[1],-nR[2]];
  const E = 0.003;
  const dec3 = (p) => [p[0]+nR[0]*E, p[1]+nR[1]*E, p[2]+nR[2]*E];

  for(let j=0;j<nv;j++){
    const t0=j/nv, t1=(j+1)/nv;
    const dec = (j%2) * 0.5/nu;
    for(let k=-1;k<=nu;k++){
      const s0 = Math.max(0, k/nu + dec), s1 = Math.min(1, (k+1)/nu + dec);
      if(s1 - s0 < 1e-4) continue;
      const f = 0.90 + hash3(cle, j*71+k+2, 17)*0.16;
      const plaque = hash3(cle, Math.floor(j/2)*31 + Math.floor((k+2)/3), 1627);
      pousserQuad(pt(s0,t0), pt(s1,t0), pt(s1,t1), pt(s0,t1),
                  grainToit(base, f, (hash3(cle, j*79+k+2, 19)-0.5)*0.20, plaque),
                  dehors, false);
    }
    /* Ombre du recouvrement : chaque rang de tuiles passe sous celui du dessus,
       qui lui porte une ombre étroite. Une seule bande par rang, sur toute la
       largeur du pan — pas une par carreau. On obtient des assises horizontales
       lisibles, sans le quadrillage de joints qui transformait le toit en
       carrelage : il n'y a aucun trait vertical. */
    const ho = 0.15 * (t1-t0);
    pousserQuad(dec3(pt(0, t1-ho)), dec3(pt(1, t1-ho)),
                dec3(pt(1, t1)),    dec3(pt(0, t1)),
                grain(base, 0.79 + hash3(cle, j, 23)*0.05, -0.05), nR, false);
  }
}

/* Quadrillage régulier sur un quadrilatère gauche (pans de toit). */
function paveQuad(A, B, C, D, base, cle, nu, nv, dehors){
  const mel = (p,q,s) => [p[0]+(q[0]-p[0])*s, p[1]+(q[1]-p[1])*s, p[2]+(q[2]-p[2])*s];
  const pt = (s,t) => mel(mel(A,B,s), mel(D,C,s), t);
  for(let j=0;j<nv;j++){
    for(let k=0;k<nu;k++){
      const s0=k/nu, s1=(k+1)/nu, t0=j/nv, t1=(j+1)/nv;
      pousserQuad(pt(s0,t0), pt(s1,t0), pt(s1,t1), pt(s0,t1),
                  grain(base, 0.92 + hash3(cle, j*61+k, 17)*0.19,
                        (hash3(cle, j*67+k, 19)-0.5)*0.22), dehors, true);
    }
  }
}

/* ---------- Baies : embrasure, croisillons, appui, balcon ------------------ */

/* Choix des ouvertures d'un mur, en coordonnées locales (u depuis A, hauteur
   relative à y0). Renvoyé plutôt que dessiné : le placage doit contourner les
   trous avant que la menuiserie ne soit posée dedans. */
function baies(cle, len, L, plein, etage){
  if(plein || len < 0.30) return [];
  const rl = hash3(cle, L, 100);
  /* Porte haute. Certaines maisons n'ouvrent qu'au premier : le rez-de-chaussée
     sert de cellier, on y accède par un escalier extérieur. C'est courant dans
     les bourgs de montagne et ça casse l'alignement des portes au sol. */
  if(etage && L === 1 && rl > 0.42){
    const w = Math.min(0.30, len*0.48);
    return [{u0:(len-w)/2, u1:(len+w)/2, b:0.06, h:0.42, porte:true, haute:true}];
  }
  if(L === 0 && !etage && rl > 0.78){
    const w = Math.min(0.32, len*0.52);
    return [{u0:(len-w)/2, u1:(len+w)/2, b:0.03, h:0.44, porte:true}];
  }
  if(rl < 0.30) return [];
  const n = rl > 0.74 && len > 0.86 ? 2 : 1;
  const w = Math.min(0.28, len*(n === 2 ? 0.34 : 0.50));
  const out = [];
  for(let k=0;k<n;k++){
    const f = n === 1 ? 0.5 : (k === 0 ? 0.31 : 0.69);
    out.push({u0:len*f - w/2, u1:len*f + w/2, b:0.21, h:0.30,
              balcon: L >= 1 && n === 1 && len > 0.72 && hash3(cle, L, 200+k) > 0.74});
  }
  return out;
}

/* Profil visible d'une baie : demi-largeur utile à chaque hauteur.
   0 droite, 1 plein cintre, 2 ogive, 3 oculus. Les écoinçons sont bouchés au
   nu du mur, ce qui laisse la trame de moellons courir autour de la baie. */
function demiBaie(forme, W, yb, yt, y){
  const R = W/2;
  if(forme === 3){
    const rc = Math.min(W, yt-yb)/2, yc = (yb+yt)/2;
    const d = Math.abs(y-yc);
    return d >= rc ? 0 : Math.sqrt(rc*rc - d*d);
  }
  const leve = forme === 1 ? Math.min(R, (yt-yb)*0.55)
             : forme === 2 ? Math.min(W*0.85, (yt-yb)*0.66) : 0;
  if(leve <= 0 || y <= yt-leve) return R;
  const t = (y-(yt-leve))/leve;
  return forme === 1 ? R*Math.sqrt(Math.max(0, 1-t*t))
                     : R*Math.sqrt(Math.max(0, 1-Math.pow(t, 1.7)));
}

/* Menuiserie. La baie n'est plus un rectangle recouvert d'un cache : le profil
   pilote l'ébrasement, le fond, les vitrages ET les écoinçons. L'ébrasement
   suit donc la courbe en profondeur, ce qui se voit de biais — c'est ce qui
   manquait, le masque plat trahissait le rectangle derrière. */
function menuiserie(A, B, y0, o, dehors, cle, forme, base, CADRE){
  if(CADRE === undefined) CADRE = '#7d6a52';
  const len = dist2d(A,B);
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl, oz = dehors[2]/dl;
  const PR = 0.075;
  const yb = y0 + o.b, yt = y0 + o.b + o.h;
  const W = o.u1 - o.u0, uc = (o.u0 + o.u1)/2;
  const p = (u, prof, y) => [A[0]+ux*u - ox*prof, y, A[1]+uz*u - oz*prof];
  const dedans = [-dehors[0], 0, -dehors[2]];

  if(o.porte){
    const P0=p(o.u0,0,0), P1=p(o.u1,0,0), Q0=p(o.u0,PR,0), Q1=p(o.u1,PR,0);
    const embr = teinte('#8a6a4e', 0.62);
    pousserQuad([P0[0],yb,P0[2]], [Q0[0],yb,Q0[2]], [Q0[0],yt,Q0[2]], [P0[0],yt,P0[2]],
                embr, [ux,0,uz], false);
    pousserQuad([P1[0],yb,P1[2]], [Q1[0],yb,Q1[2]], [Q1[0],yt,Q1[2]], [P1[0],yt,P1[2]],
                embr, [-ux,0,-uz], false);
    pousserQuad([P0[0],yt,P0[2]], [P1[0],yt,P1[2]], [Q1[0],yt,Q1[2]], [Q0[0],yt,Q0[2]],
                teinte(CADRE, 0.5), [0,-1,0], false);
    pousserQuad([Q0[0],yb,Q0[2]], [Q1[0],yb,Q1[2]], [Q1[0],yt,Q1[2]], [Q0[0],yt,Q0[2]],
                teinte(CADRE, 1), dehors, false);
    const R0=p(o.u0+0.028, PR-0.018, 0), R1=p(o.u1-0.028, PR-0.018, 0);
    pousserQuad([R0[0],yb+0.025,R0[2]], [R1[0],yb+0.025,R1[2]],
                [R1[0],yt-0.028,R1[2]], [R0[0],yt-0.028,R0[2]],
                teinte(BOIS, 1.25), dehors, false);
    appui(A, B, o, yb, ux, uz, ox, oz, dehors);
    return;
  }

  // profil de la baie, échantillonné
  const K = forme ? 10 : 4;
  const H2 = [], D = [];
  for(let k=0;k<=K;k++){
    const y = yb + (yt-yb)*k/K;
    H2.push(y); D.push(demiBaie(forme, W, yb, yt, y));
  }
  const trav = Math.floor(K*0.45);            // traverse

  /* Allège et linteau : les faces horizontales de l'ébrasement. Sans elles,
     une baie rectangulaire laisse voir l'intérieur du mur en haut et en bas —
     une fente fine mais bien réelle. Sur un plein cintre ou un oculus le
     profil se referme tout seul, la largeur y est nulle et le quad dégénéré
     est ignoré. */
  for(const [y, h, sens] of [[yb, D[0], -1], [yt, D[K], 1]]){
    if(h < 1e-4) continue;
    pousserQuad(p(uc-h,0,y), p(uc+h,0,y), p(uc+h,PR,y), p(uc-h,PR,y),
                grain(base, sens > 0 ? 0.52 : 0.78, 0), [0, -sens, 0], false);
  }

  for(let k=0;k<K;k++){
    const y0k=H2[k], y1k=H2[k+1], h0=D[k], h1=D[k+1];
    if(h0 < 1e-4 && h1 < 1e-4) continue;
    for(const sg of [-1, 1]){
      const a0 = uc + sg*h0, a1 = uc + sg*h1;
      /* Tableau de la baie : c'est de la maçonnerie, pas de la menuiserie —
         même appareil que le mur, simplement à l'ombre. Sa normale regarde
         VERS l'ouverture ; à l'envers, les deux tableaux étaient éliminés au
         dos et la fenêtre semblait n'être qu'un trou avec un vitrage au fond. */
      pousserQuad(p(a0,0,y0k), p(a0,PR,y0k), p(a1,PR,y1k), p(a1,0,y1k),
                  grain(base, 0.60 + hash3(cle, k*5+(sg>0?1:0), 733)*0.16,
                        (hash3(cle, k, 739)-0.5)*0.18),
                  [-sg*ux, 0, -sg*uz], false);
      // écoinçon au nu du mur
      const bd = uc + sg*W/2;
      if(Math.abs(bd-a0) > 1e-3 || Math.abs(bd-a1) > 1e-3){
        pousserQuad(p(a0,-0.004,y0k), p(bd,-0.004,y0k), p(bd,-0.004,y1k), p(a1,-0.004,y1k),
                    grain(base, 0.94 + hash3(cle, k*3+(sg>0?1:0), 619)*0.14,
                          (hash3(cle, k, 631)-0.5)*0.2), dehors, false);
      }
    }
    // fond de baie
    pousserQuad(p(uc-h0,PR,y0k), p(uc+h0,PR,y0k), p(uc+h1,PR,y1k), p(uc-h1,PR,y1k),
                teinte(CADRE, 1), dehors, false);
    // vitrage, en retrait du fond, coupé par une traverse et un meneau
    if(k === trav) continue;
    const g = 0.024, hm = Math.min(h0, h1) - g;
    if(hm < 0.012) continue;
    const va = y0k + (k===0 || D[k-1] < 1e-4 ? g : 0.004);
    const vb = y1k - (k===K-1 || D[k+2] === undefined || D[k+1] < 1e-4 ? g : 0.004);
    if(vb <= va) continue;
    /* Trois compartiments dès que la baie est large : des carreaux plus petits
       et deux meneaux, ce qui rapproche du vitrage à plombs. */
    const parts = hm > 0.105 ? [[-hm,-hm/3-0.008],[-hm/3+0.008,hm/3-0.008],[hm/3+0.008,hm]]
                : hm > 0.075 ? [[-hm,-0.011],[0.011,hm]] : [[-hm,hm]];
    for(const [a,b] of parts){
      lampeCourante = 1; lampeGroupe = hash3(cle, 0, 719) > 0.5 ? 1 : 0;
      pousserQuad(p(uc+a,PR-0.016,va), p(uc+b,PR-0.016,va),
                  p(uc+b,PR-0.016,vb), p(uc+a,PR-0.016,vb),
                  teinte(VITRE, 0.9 + hash3(cle, k*7, 23)*0.35), dehors, false);
      lampeCourante = 0;
    }
  }
  /* Volets. C'est ce qui manquait le plus au caractère : une fenêtre médiévale
     se ferme par deux battants de planches cloutés sur leurs barres, pas par un
     châssis nu. Ils sont posés au nu du mur, entrouverts, et n'apparaissent que
     sur les baies droites ou cintrées — un oculus n'en a pas. */
  if(!o.porte && forme < 3 && hash3(cle, 15, 1451) > 0.55){
    const ang = 0.55 + hash3(cle, 16, 1453)*0.55;
    for(const sg of [-1, 1]){
      const uc2 = uc + sg*W/2, la = W/2 - 0.006;
      const co = Math.cos(ang), si = Math.sin(ang);
      const q = (t, dy) => p(uc2 + sg*la*co*t, -0.012 - la*si*t, yb + (yt-yb)*dy);
      for(let k=0;k<2;k++){
        const t0=k/2, t1=(k+1)/2;
        pousserQuad(q(t0,0.02), q(t1,0.02), q(t1,0.98), q(t0,0.98),
                    grain('#6b5236', 0.88 + hash3(cle, k*3+(sg>0?1:0), 1459)*0.24,
                          (hash3(cle,k,1471)-0.5)*0.16), dehors, false);
      }
      for(const dy of [0.18, 0.80]){
        pousserQuad(q(0,dy-0.045), q(1,dy-0.045), q(1,dy+0.045), q(0,dy+0.045),
                    grain('#4f3d28', 0.94, 0), dehors, false);
      }
    }
  }
  appui(A, B, o, yb, ux, uz, ox, oz, dehors);
  if(o.balcon) balcon(A, B, o, yb, ux, uz, ox, oz, dehors);
}

function appui(A, B, o, yb, ux, uz, ox, oz, dehors, CADRE){
  if(CADRE === undefined) CADRE = '#9d9384';   // l'appui est toujours de pierre
  const p = (u, d, y) => [A[0]+ux*u - ox*d, y, A[1]+uz*u - oz*d];
  /* L'appui débordait de 3,5 cm de part et d'autre de la baie sans se soucier
     de la longueur du mur. Sur un pan court — ce qui arrive quand deux
     bâtiments se rencontrent sous un angle aigu — il ressortait de l'autre
     côté de la façade voisine, en coin blanc. Il est borné au mur. */
  /* L'appui déborde latéralement ET vers l'extérieur. Près d'un angle vif —
     deux bâtiments qui se rencontrent sous 55° — cette saillie traverse le mur
     du voisin et ressort de l'autre côté en coin blanc. On la fait donc mourir
     dans l'angle : la saillie décroît avec la marge disponible. */
  const len = dist2d(A,B);
  const marge = Math.min(o.u0, len - o.u1);
  const lat = Math.min(0.035, Math.max(0, marge - 0.02));
  const sail = 0.028 * Math.min(1, Math.max(0.25, marge/0.12));
  const u0 = o.u0 - lat, u1 = o.u1 + lat;
  if(u1 <= u0) return;
  const M0=p(u0,-sail,0), M1=p(u1,-sail,0);
  const N0=p(u0,0,0), N1=p(u1,0,0);
  const ap = teinte(CADRE, 0.86);
  pousserQuad([N0[0],yb-0.045,N0[2]], [N1[0],yb-0.045,N1[2]],
              [M1[0],yb-0.045,M1[2]], [M0[0],yb-0.045,M0[2]], ap, [0,-1,0], false);
  pousserQuad([M0[0],yb-0.045,M0[2]], [M1[0],yb-0.045,M1[2]],
              [M1[0],yb,M1[2]], [M0[0],yb,M0[2]], ap, dehors, false);
  pousserQuad([M0[0],yb,M0[2]], [M1[0],yb,M1[2]],
              [N1[0],yb,N1[2]], [N0[0],yb,N0[2]], teinte(CADRE, 1), [0,1,0], false);
}

/* Balcon. La dalle de pierre de treize centimètres avec ses barreaux de fer
   faisait balcon d'immeuble. Celui-ci est en bois, porté par trois corbeaux,
   avec un plancher de lames minces et un garde-corps à balustres fuselés — les
   sections tombent à un centimètre, contre presque deux avant. */
function balcon(A, B, o, yb, ux, uz, ox, oz, dehors){
  const p = (u, d, y) => [A[0]+ux*u - ox*d, y, A[1]+uz*u - oz*d];
  const len = dist2d(A,B);
  const u0 = Math.max(0.02, o.u0-0.055), u1 = Math.min(len-0.02, o.u1+0.055);
  if(u1 - u0 < 0.10) return;
  const S = 0.155, yP = yb - 0.045;
  const bois = teinte('#7a5c3f', 1), clair = teinte('#96754f', 1);
  for(const u of [u0+0.02, (u0+u1)/2, u1-0.02]){
    const a=p(u,0.01,0), b=p(u,S-0.02,0);
    poutre([a[0], yP-0.10, a[2]], [b[0], yP-0.012, b[2]], 0.017, bois);
    poutre([a[0], yP-0.012, a[2]], [b[0], yP-0.012, b[2]], 0.013, bois);
  }
  const n = 5;
  for(let k=0;k<n;k++){
    const ua = u0 + (u1-u0)*k/n, ub = u0 + (u1-u0)*(k+1)/n - 0.004;
    const q0=p(ua,0.01,0), q1=p(ub,0.01,0), q2=p(ub,S,0), q3=p(ua,S,0);
    pousserQuad([q0[0],yP,q0[2]], [q1[0],yP,q1[2]], [q2[0],yP,q2[2]], [q3[0],yP,q3[2]],
                grain('#8a6a4e', 0.90 + hash3(Math.round(ua*997), k, 1447)*0.20, 0),
                [0,1,0], false);
  }
  const c0=p(u0,S,0), c1=p(u1,S,0);
  pousserQuad([c0[0],yP-0.022,c0[2]], [c1[0],yP-0.022,c1[2]],
              [c1[0],yP,c1[2]], [c0[0],yP,c0[2]], teinte('#6b5744',1), dehors, false);
  const hG = 0.235;
  for(const u of [u0+0.015, u1-0.015]){
    const q=p(u,S-0.022,0), r=p(u,0.02,0);
    poutre([q[0],yP,q[2]], [q[0],yP+hG,q[2]], 0.014, bois);
    poutre([r[0],yP,r[2]], [r[0],yP+hG,r[2]], 0.012, bois);
    poutre([q[0],yP+hG,q[2]], [r[0],yP+hG,r[2]], 0.012, bois);
  }
  const nb = Math.max(3, Math.round((u1-u0)/0.048));
  for(let k=1;k<nb;k++){
    const u = u0 + (u1-u0)*k/nb, q=p(u,S-0.022,0);
    poutre([q[0],yP,q[2]],           [q[0],yP+0.045,q[2]],    0.0115, clair);
    poutre([q[0],yP+0.045,q[2]],     [q[0],yP+hG-0.045,q[2]], 0.0075, clair);
    poutre([q[0],yP+hG-0.045,q[2]],  [q[0],yP+hG,q[2]],       0.0115, clair);
  }
  const m0=p(u0,S-0.022,0), m1=p(u1,S-0.022,0);
  poutre([m0[0],yP+hG,m0[2]], [m1[0],yP+hG,m1[2]], 0.015, bois);
  poutre([m0[0],yP+0.045,m0[2]], [m1[0],yP+0.045,m1[2]], 0.009, bois);
}

/* Sablière en encorbellement. Elle ne déplace pas la cellule logique : une
   dalle courte, un bandeau et des corbeaux suffisent à donner aux étages la
   silhouette élargie des maisons médiévales, sans ouvrir de fentes entre deux
   cellules voisines. */
function encorbellementFacade(A, B, y0, dehors, cle){
  const len = dist2d(A,B);
  if(len < 0.44) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl=Math.hypot(dehors[0],dehors[2])||1;
  const ox=dehors[0]/dl, oz=dehors[2]/dl;
  const dep = 0.075 + hash3(cle, 1, 1657)*0.055;
  const p=(u,d,y)=>[A[0]+ux*u+ox*d, y, A[1]+uz*u+oz*d];
  const bois = grain('#604832', 0.88 + hash3(cle,2,1663)*0.22, 0);
  const clair = grain('#806043', 0.94 + hash3(cle,3,1667)*0.18, 0);
  const m=0.035;
  // sous-face et bandeau frontal
  pousserQuad(p(m,0,y0+0.022), p(len-m,0,y0+0.022),
              p(len-m,dep,y0+0.022), p(m,dep,y0+0.022),
              grain('#6b5239',0.72,0), [0,-1,0], false);
  pousserQuad(p(m,dep,y0+0.018), p(len-m,dep,y0+0.018),
              p(len-m,dep,y0+0.105), p(m,dep,y0+0.105),
              clair, dehors, false);
  poutre(p(m,dep,y0+0.10), p(len-m,dep,y0+0.10), 0.020, bois);
  // corbeaux : trois à cinq suivant la largeur
  const n=Math.max(3,Math.round(len/0.23));
  for(let k=0;k<n;k++){
    const u=m+(len-2*m)*(k+0.5)/n;
    poutre(p(u,0.010,y0-0.19), p(u,dep-0.010,y0+0.025), 0.017, bois);
    poutre(p(u,0.006,y0+0.012), p(u,dep,y0+0.012), 0.013, clair);
  }
}

/* Oriel de bois : un petit volume vitré suspendu à la façade, inspiré des
   maisons hautes et irrégulières. Il remplace les baies ordinaires de la face
   qui le porte afin d'éviter les superpositions. */
function orielFacade(A, B, y0, y1, dehors, cle, base){
  const len=dist2d(A,B);
  if(len < 0.58) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl=Math.hypot(dehors[0],dehors[2])||1;
  const ox=dehors[0]/dl, oz=dehors[2]/dl;
  const w=Math.min(0.19,len*0.24), dep=0.13;
  const uc=len*(0.42+hash3(cle,1,1753)*0.16);
  const yb=y0+0.13, yt=Math.min(y1-0.07,yb+0.34);
  const p=(u,d,y)=>[A[0]+ux*u+ox*d,y,A[1]+uz*u+oz*d];
  const L0=p(uc-w,0,yb), R0=p(uc+w,0,yb),
        LF=p(uc-w,dep,yb), RF=p(uc+w,dep,yb),
        LT=p(uc-w,dep,yt), RT=p(uc+w,dep,yt);
  const mur=grain(melangeHex(base,'#dbcdb4',0.70),0.95,0);
  const bois=grain('#5a422f',0.92,0);
  pousserQuad(LF,RF,RT,LT,mur,dehors,false);
  pousserQuad(L0,LF,LT,p(uc-w,0,yt),grain(base,0.72,0),[-ux,0,-uz],false);
  pousserQuad(RF,R0,p(uc+w,0,yt),RT,grain(base,0.76,0),[ux,0,uz],false);
  pousserQuad(L0,R0,RF,LF,grain('#6b5037',0.72,0),[0,-1,0],false);

  // bande vitrée frontale en trois lancettes
  const marge=0.025, pas=(2*w-2*marge)/3;
  for(let k=0;k<3;k++){
    const ua=uc-w+marge+k*pas+0.008, ub=uc-w+marge+(k+1)*pas-0.008;
    lampeCourante=1; lampeGroupe=k%2;
    pousserQuad(p(ua,dep+0.006,yb+0.075),p(ub,dep+0.006,yb+0.075),
                p(ub,dep+0.006,yt-0.055),p(ua,dep+0.006,yt-0.055),
                teinte(VITRE,0.92+hash3(cle,k,1759)*0.20),dehors,false);
    lampeCourante=0;
  }
  for(const u of [uc-w+marge,uc-w+marge+pas,uc-w+marge+2*pas,uc+w-marge])
    poutre(p(u,dep+0.010,yb+0.055),p(u,dep+0.010,yt-0.035),0.010,bois);
  poutre(p(uc-w+marge,dep+0.010,yb+0.060),p(uc+w-marge,dep+0.010,yb+0.060),0.011,bois);
  poutre(p(uc-w+marge,dep+0.010,yt-0.040),p(uc+w-marge,dep+0.010,yt-0.040),0.011,bois);

  // petit toit en appentis et deux consoles
  pousserQuad(p(uc-w-0.035,0.005,yt+0.035),p(uc+w+0.035,0.005,yt+0.035),
              p(uc+w+0.045,dep+0.055,yt+0.105),p(uc-w-0.045,dep+0.055,yt+0.105),
              grainToit('#765047',0.94,0,hash3(cle,7,1777)),[0,1,0],false);
  for(const u of [uc-w*0.68,uc+w*0.68])
    poutre(p(u,0.01,yb-0.15),p(u,dep-0.01,yb+0.015),0.017,bois);
}

function murTexture(A, B, y0, y1, dehors, base, cle, ouvs, cleBat){
  const cadre = cleBat === undefined ? CADRE
              : CADRES[Math.floor(hash3(cleBat, 14, 1039)*CADRES.length)];
  const len = dist2d(A,B);
  if(len < 1e-4) return;
  /* Profil de façade partagé par tout le bâtiment : pierre, colombage simple,
     colombage dense, enduit ou mélange. Les choix de matière et de charpente
     restent ainsi corrélés d'un étage et d'une face à l'autre. */
  const styleBat = cleBat === undefined ? -1
    : Math.floor(hash3(cleBat, 21, 1609)*5);
  const pdb = cleBat !== undefined && y0 > H*0.5 &&
    (styleBat === 1 || styleBat === 2 || (styleBat === 4 && y0 >= H*1.5));
  const enduit = cleBat !== undefined && !pdb &&
    (styleBat === 3 || (styleBat === 4 && y0 > H*0.5));
  if(pdb) base = melangeHex(base, '#e7dfc9', styleBat === 2 ? 0.88 : 0.78);
  else if(enduit) base = melangeHex(base, '#ddd3bd', 0.68);
  // soubassement maçonné au rez-de-chaussée, avec son larmier
  /* Soubassement. Il était trop discret : dix-sept centimètres d'un gris à
     peine distinct, coiffé d'une baguette. Le pied d'une maison de pierre est
     un ouvrage à part — assise plus haute, appareil plus gros, pierre nettement
     plus froide que le corps, et un larmier chanfreiné qui le couronne. */
  const hSocle = (cleBat !== undefined && y0 < H*0.5 &&
                  hash3(cleBat, 11, 617) > 0.42) ? 0.165 : 0;
  /* 16,5 cm : c'est la hauteur maximale pour que le larmier, qui déborde de
     3,5 cm vers le haut, passe SOUS l'appui des fenêtres, posé à 21 cm. À 19
     il les frôlait toutes et se retrouvait interrompu cent fois pour rien.
     Seules les portes, dont le seuil est à 6 cm, le coupent maintenant. */
  const PIERRE_SOCLE = ['#8a8880','#94918a','#807e77','#8f8c83'];
  const us = [0, len], vs = [y0, y1];
  if(hSocle) vs.push(y0 + hSocle);
  for(const o of ouvs){
    us.push(Math.max(0, o.u0), Math.min(len, o.u1));
    vs.push(y0+o.b, Math.min(y1, y0+o.b+o.h));
  }
  const uniq = (l) => [...new Set(l.map(x=>Math.round(x*1e4)/1e4))].sort((a,b)=>a-b);
  const U = uniq(us), V = uniq(vs);
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  for(let a=0;a<U.length-1;a++){
    for(let b=0;b<V.length-1;b++){
      const um=(U[a]+U[a+1])/2, vm=(V[b]+V[b+1])/2;
      if(ouvs.some(o => um > o.u0 && um < o.u1 && vm > y0+o.b && vm < y0+o.b+o.h)) continue;
      const socle = hSocle && V[b+1] <= y0 + hSocle + 1e-4;
      pave([A[0]+ux*U[a], A[1]+uz*U[a]], [A[0]+ux*U[a+1], A[1]+uz*U[a+1]],
           V[b], V[b+1], dehors,
           socle ? PIERRE_SOCLE[Math.floor(hash3(cle, a*5+b, 1229)*PIERRE_SOCLE.length)]
                 : base,
           cle + a*3 + b*17, socle ? 0.17 : ((pdb || enduit) ? 0.30 : 0.145));
    }
  }
  const forme = cleBat === undefined ? 0
    : (()=>{ const h = hash3(cleBat, 9, 601);
             return h > 0.90 ? 3 : h > 0.74 ? 2 : h > 0.46 ? 1 : 0; })();
  for(const o of ouvs) if(o.haute) escalierExterieur(A, B, y0, o, dehors, cle);
  detail = true;
  for(const o of ouvs) menuiserie(A, B, y0, o, dehors, cle, forme, base, cadre);
  if(hSocle){
    /* Larmier chanfreiné — saillie, chanfrein, retour au nu. Il est INTERROMPU
       par les baies : une moulure qui traverse une porte à vingt centimètres du
       sol n'existe nulle part, et c'était le défaut le plus voyant du
       soubassement. Chaque tronçon s'arrête à trois centimètres de l'ouverture,
       comme un vrai larmier s'arrête sur le piédroit. */
    const dl2 = Math.hypot(dehors[0], dehors[2]) || 1;
    const ox = dehors[0]/dl2, oz = dehors[2]/dl2;
    const ux2=(B[0]-A[0])/len, uz2=(B[1]-A[1])/len;
    const S1 = 0.032, yA = y0+hSocle-0.045, yB = y0+hSocle, yC = y0+hSocle+0.035;
    const p = (u, d) => [A[0]+ux2*u+ox*d, A[1]+uz2*u+oz*d];
    // découpe du mur en tronçons libres de toute ouverture basse
    const coupes = [0];
    for(const o of ouvs){
      if(y0 + o.b > yC) continue;               // baie entièrement au-dessus
      coupes.push(Math.max(0, o.u0-0.03), Math.min(len, o.u1+0.03));
    }
    coupes.push(len);
    coupes.sort((x,y2)=>x-y2);
    for(let k=0;k+1<coupes.length;k+=2){
      const u0 = coupes[k], u1 = coupes[k+1];
      if(u1 - u0 < 0.02) continue;
      const a1=p(u0,S1), b1=p(u1,S1), a0=p(u0,0), b0=p(u1,0);
      pousserQuad([a1[0],yA,a1[1]], [b1[0],yA,b1[1]], [b1[0],yB,b1[1]], [a1[0],yB,a1[1]],
                  teinte('#9d9a92', 1.0), dehors, false);
      pousserQuad([a0[0],yA-0.02,a0[1]], [b0[0],yA-0.02,b0[1]],
                  [b1[0],yA,b1[1]], [a1[0],yA,a1[1]],
                  teinte('#7f7d76', 0.86), [0,-1,0], false);
      pousserQuad([a1[0],yB,a1[1]], [b1[0],yB,b1[1]],
                  [b0[0],yC,b0[1]], [a0[0],yC,a0[1]],
                  teinte('#b0ada4', 1.08), [ox*0.5,1,oz*0.5], false);
      // joue de retour, pour que le tronçon se termine franchement
      for(const [u, sg] of [[u0,-1],[u1,1]]){
        const q0=p(u,0), q1=p(u,S1);
        pousserQuad([q0[0],yA-0.02,q0[1]], [q1[0],yA,q1[1]],
                    [q1[0],yB,q1[1]], [q0[0],yC,q0[1]],
                    teinte('#8f8c85', 0.92), [sg*ux2, 0, sg*uz2], false);
      }
    }
  }
  if(pdb) colombage(A, B, y0, y1, dehors, cle, ouvs, styleBat);
  if(hash3(cle, 8, 487) > 0.90) blason(A, B, y0, dehors, cle, ouvs);
  if(y0 < H*0.5 && hash3(cle, 7, 499) > 0.52) pieDeMur(A, B, y0, dehors, cle, ouvs);
  if(hash3(cle, 3, 239) > 0.84) lierre(A, B, y0, y1, dehors, cle, ouvs);
  if(hash3(cle, 4, 233) > 0.88) lanterneMurale(A, B, y0, dehors, cle, ouvs);
  detail = false;
}

/* ---------- L'île -----------------------------------------------------------
   Toute la grille est terre ferme. Le sol est herbeux par défaut ; là où l'on
   bâtit, il devient pavé. La frontière entre les deux n'est pas la limite des
   cellules mais une isoligne d'un champ scalaire : chaque cellule bâtie émet
   une bosse en 1/d², les bosses voisines fusionnent, et le contour obtenu est
   naturellement arrondi. La côte, elle, longe le bord de la grille avec une
   marge, puis est lissée pour donner une plage douce. */

const SOL   = 0.06;
const PAVES = ['#bcb3a2','#c6b5a6','#a9a89c','#c2b0a6','#adaa9d','#c0b39d','#b3ada6','#b8a99b'];
const HERBE = ['#7f9455','#839859','#7b9151'];
/* Pierres de rive. Nettement plus claires que le pavé courant : un liseré de
   même valeur que son champ ne se voit pas, quelle que soit sa largeur. */
const BORDURE = ['#c3bba8','#cbc3b1','#bab2a0','#d0c8b6'];
const SABLE = ['#e0d2ae','#e8dcbb','#d6c8a2'];

const melxz = (a,b,s) => [a[0]+(b[0]-a[0])*s, a[1]+(b[1]-a[1])*s];

/* Cache par cellule. Le sol d'une cellule ne dépend que de la liste des
   cellules bâties proches — leurs positions, pas leurs hauteurs. Poser un bloc
   ne change donc réellement le sol que dans un rayon de trois unités ; partout
   ailleurs on recopie la géométrie déjà calculée. */
/* Signature du voisinage : une somme de hachages plutôt qu'une chaîne. Bâtir
   « 12,47,88 » pour trois cents cellules à chaque reconstruction allouait
   autant de chaînes qu'il y a de cellules, pour les comparer aussitôt. La
   somme est indépendante de l'ordre et tient dans un entier. */
const signatureVoisins = (proches) => {
  let h = 0;
  for(const b of proches) h = (h + Math.imul(b.i + 1, 2654435761)) >>> 0;
  return h;
};

let cacheSol = new Map();
function solCellule(c, proches){
  const sig = signatureVoisins(proches);
  const vieux = cacheSol.get(c.i);
  if(vieux && vieux.sig === sig){
    place(pos, vieux.p.length); pos.a.set(vieux.p, pos.n); pos.n += vieux.p.length;
    place(col, vieux.c.length); col.a.set(vieux.c, col.n); col.n += vieux.c.length;
    for(let k=0;k<vieux.t;k++) meta.push(ctx);
    return;
  }
  const p0 = pos.n, c0 = col.n, m0 = meta.length;
  solCelluleBrut(c, proches);
  cacheSol.set(c.i, { sig, t: meta.length - m0,
    p: pos.a.slice(p0, pos.n), c: col.a.slice(c0, col.n) });
}

function solCelluleBrut(c, proches){
  const S = c.q.map(v => P[v]);
  /* Loin de toute construction il n'y a que de l'herbe : deux subdivisions
     suffisent. Près des bâtiments, le pavage a besoin d'une trame fine, à la
     fois pour le grain des pierres et pour que sa limite arrondie soit nette.
     Les points de bord restent régulièrement répartis sur les arêtes, donc
     deux cellules de finesses différentes se raccordent sans fente. */
  const ville = proches.length > 0;
  /* Finesse du dallage. À sept subdivisions les dalles faisaient treize
     centimètres de côté ; à dix elles en font neuf, ce qui rapproche l'échelle
     du pavé de celle des moellons des murs. L'herbe garde deux subdivisions :
     inutile de la découper, elle n'a pas de motif. */
  const N = ville ? 10 : 2;
  /* Plus de gigue sur les sommets. Elle donnait son irrégularité au pavage,
     mais elle interdit de fusionner des cases : une dalle qui enjambe deux
     cases saute le sommet du milieu, or celui-ci est déplacé, si bien que la
     rangée voisine ne suit plus le même bord — et le sol s'ouvre. Sans gigue
     les points d'une rangée sont exactement alignés, la dalle longue passe
     par eux, et l'irrégularité vient désormais de la longueur des dalles. */
  const gigue = 0;
  const grille = [];
  for(let i=0;i<=N;i++){
    const a = melxz(S[0], S[1], i/N), b = melxz(S[3], S[2], i/N);
    const col = [];
    for(let j=0;j<=N;j++){
      const p = melxz(a, b, j/N);
      if(gigue && i>0 && i<N && j>0 && j<N){
        p[0] += (hash3(c.i, i*11+j, 61)-0.5)*gigue;
        p[1] += (hash3(c.i, i*11+j, 67)-0.5)*gigue;
      }
      col.push(p);
    }
    grille.push(col);
  }
  /* Le sol n'est pas découpé en carrés d'une seule taille : chaque rangée est
     parcourue en dalles de une à trois cases de long, tirées au sort. Deux
     bénéfices d'un même geste — l'appareil cesse d'être une grille régulière,
     et le nombre de quadrilatères tombe de moitié puisqu'une dalle longue en
     remplace deux ou trois. On garde donc la finesse du motif sans en payer le
     prix. Une dalle ne s'étend que si toutes ses cases sont du même matériau,
     sinon la frontière herbe/pavé serait franchie. */
  let pave = 0;
  const dur = [];
  for(let i=0;i<N;i++){
    dur.push([]);
    for(let j=0;j<N;j++){
      const A=grille[i][j], B=grille[i+1][j], C=grille[i+1][j+1], D=grille[i][j+1];
      const mx=(A[0]+B[0]+C[0]+D[0])/4, mz=(A[1]+B[1]+C[1]+D[1])/4;
      let champ = 0;
      for(const b of proches){
        const dx=b.cx-mx, dz=b.cz-mz;
        champ += 0.72/(dx*dx + dz*dz + 0.03);
      }
      /* Fondu au bord de l'île. Le pavage s'arrêtait net sur le polygone de la
         grille : une ligne droite au ras de la plage, alors que partout
         ailleurs sa limite est irrégulière. On relève ici le seuil à mesure
         qu'on approche d'un côté sans voisin — au carré, pour que la
         transition se fasse par dalles éparses puis plus rien, plutôt que par
         un dégradé mou. */
      let pen = 0;
      if(!c.nb[0]) pen = Math.max(pen, 1 - j/(N-1));
      if(!c.nb[2]) pen = Math.max(pen, 1 - (N-1-j)/(N-1));
      if(!c.nb[3]) pen = Math.max(pen, 1 - i/(N-1));
      if(!c.nb[1]) pen = Math.max(pen, 1 - (N-1-i)/(N-1));
      const d = champ > 1 + (hash3(c.i, i*23+j, 101)-0.5)*0.45 + 2.4*pen*pen;
      dur[i].push(d);
      if(d) pave++;
    }
  }
  for(let i=0;i<N;i++){
    for(let j=0;j<N;){
      const d = dur[i][j];
      /* Bordure de rue. Une case pavée qui touche l'herbe reçoit une pierre
         plus sombre et ne se fond dans aucune dalle longue : le pavage se
         termine sur un cours de bordure au lieu de s'arrêter net. C'est ce
         liseré qui donne au sol son contour. */
      /* Bordure. Elle suit la limite du pavage — côté herbe — MAIS aussi le
         pied des bâtiments : une case au bord de la cellule dont la voisine
         est bâtie longe une façade, et c'est là que le contour se voit le
         plus. Sans ce second test la bordure n'apparaissait qu'en lisière de
         l'îlot, donc quasiment jamais. */
      const bord = d && (
        (i>0   && !dur[i-1][j]) || (i<N-1 && !dur[i+1][j]) ||
        (j>0   && !dur[i][j-1]) || (j<N-1 && !dur[i][j+1]) ||
        false);   // le pourtour des bâtiments est traité à part, par trottoir()
      let n = bord ? 1 : 1 + Math.floor(hash3(c.i, i*31+j, 89)*2.6);   // 1, 2 ou 3
      while(n > 1 && (j+n > N || dur[i][j+n-1] !== d || 
            (j+n-1<N-1 && !dur[i][j+n] ) || (i>0 && !dur[i-1][j+n-1]) ||
            (i<N-1 && !dur[i+1][j+n-1]))) n--;
      const A=grille[i][j], B=grille[i+1][j];
      const C=grille[i+1][j+n], D=grille[i][j+n];
      const pal = d ? (bord ? BORDURE : PAVES) : HERBE;
      const base = pal[Math.floor(hash3(c.i, i*17+j, 73)*pal.length)];
      const f = d ? (bord ? 0.94 + hash3(c.i, i*13+j, 71)*0.14
                          : 0.80 + hash3(c.i, i*13+j, 71)*0.42)
                  : 0.975 + hash3(c.i, i*13+j, 71)*0.055;
      const m = (hash3(c.i, i*19+j, 79)-0.5)*(d ? (bord ? 0.16 : 0.62) : 0.05);
      pousserQuad([A[0],SOL,A[1]], [B[0],SOL,B[1]], [C[0],SOL,C[1]], [D[0],SOL,D[1]],
                  grain(base, f, m), [0,1,0], false);
      j += n;
    }
  }
  if(pave === N*N && hash3(c.i, 0, 41) > 0.86) rosace(c);
}

/* Rosace : quelques places reçoivent un motif rayonnant. */
function rosace(c){
  const y = SOL + 0.006;
  const cx = c.cx, cz = c.cz;
  const ton = ['#a8988c','#b5a091','#9d8d83','#b09c8e'];
  const anneaux = [0, 0.09, 0.18, 0.26];
  for(let a=0;a<anneaux.length-1;a++){
    const n = 8 + a*6, r0 = anneaux[a], r1 = anneaux[a+1];
    for(let k=0;k<n;k++){
      const t0 = k/n*Math.PI*2, t1 = (k+1)/n*Math.PI*2;
      const P0=[cx+Math.cos(t0)*r0, cz+Math.sin(t0)*r0];
      const P1=[cx+Math.cos(t1)*r0, cz+Math.sin(t1)*r0];
      const P2=[cx+Math.cos(t1)*r1, cz+Math.sin(t1)*r1];
      const P3=[cx+Math.cos(t0)*r1, cz+Math.sin(t0)*r1];
      const base = ton[Math.floor(hash3(c.i, a*23+k, 83)*ton.length)];
      pousserQuad([P0[0],y,P0[1]], [P1[0],y,P1[1]], [P2[0],y,P2[1]], [P3[0],y,P3[1]],
                  grain(base, 0.88 + hash3(c.i, a*29+k, 89)*0.26,
                        (hash3(c.i, a*31+k, 97)-0.5)*0.30), [0,1,0], false);
    }
  }
}

/* Contour de l'île. Plutôt qu'un anneau intérieur anguleux et un anneau
   extérieur lisse reliés par interpolation — ce qui laisse les lignes
   intermédiaires presque aussi anguleuses que le bord de grille — on construit
   une famille d'anneaux de plus en plus lissés ET de plus en plus écartés.
   Chaque limite visible (herbe/sable, sable/eau) tombe donc sur une courbe
   déjà douce. Seul l'anneau 0 reste exactement sur les arêtes de la grille,
   pour que le raccord avec les cellules soit sans fente. */
let anneauCote = null;
function chaineBord(){
  if(anneauCote) return anneauCote;
  const suiv = new Map();
  for(const c of cellules) for(let i=0;i<4;i++){
    if(c.nb[i]) continue;
    suiv.set(c.q[i], c.q[(i+1)%4]);
  }
  const dep = suiv.keys().next().value;
  const ch = [];
  let s = dep;
  for(let k=0; k<suiv.size+2; k++){
    ch.push(s);
    s = suiv.get(s);
    if(s === undefined || s === dep) break;
  }
  const base = [];
  for(let k=0;k<ch.length;k++){
    const A=P[ch[k]], B=P[ch[(k+1)%ch.length]];
    base.push([A[0],A[1]], [(A[0]+B[0])/2, (A[1]+B[1])/2]);
  }
  const n = base.length;

  const lisser = (src, it) => {
    const p = src.map(q=>[q[0],q[1]]);
    for(let e=0;e<it;e++){
      const cp = p.map(q=>[q[0],q[1]]);
      for(let k=0;k<n;k++){
        const a=cp[(k-1+n)%n], b=cp[(k+1)%n];
        p[k][0] = cp[k][0]*0.4 + (a[0]+b[0])*0.3;
        p[k][1] = cp[k][1]*0.4 + (a[1]+b[1])*0.3;
      }
    }
    return p;
  };
  const ecarter = (p, m) => {
    let ec = 0;
    for(let k=0;k<n;k++) ec = Math.max(ec, Math.hypot(p[k][0]-base[k][0], p[k][1]-base[k][1]));
    const d = m + ec;
    return p.map((q,k)=>{
      const a=p[(k-1+n)%n], b=p[(k+1)%n];
      const dx=b[0]-a[0], dz=b[1]-a[1], l=Math.hypot(dx,dz)||1;
      return [q[0] + dz/l*d, q[1] - dx/l*d];
    });
  };

  const reglages = [
    {it:0,  m:0,    y:SOL,    t:0.00},
    {it:5,  m:0.30, y:0.048,  t:0.25},
    {it:9,  m:0.62, y:0.012,  t:0.50},
    {it:13, m:0.92, y:-0.012, t:0.75},
    {it:17, m:1.22, y:-0.075, t:1.00}
  ];
  const anneaux = reglages.map((r,i)=>({
    pts: i === 0 ? base : ecarter(lisser(base, r.it), r.m),
    y: r.y, t: r.t
  }));
  anneauCote = {anneaux, n};
  return anneauCote;
}

/* Point de la plage à l'abscisse t (0 = bord de grille, 1 = fond de l'eau). */
function pointPlage(anneaux, k, t){
  let i = 0;
  while(i < anneaux.length-2 && t > anneaux[i+1].t) i++;
  const a = anneaux[i], b = anneaux[i+1];
  const s = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  return [a.pts[k][0] + (b.pts[k][0]-a.pts[k][0])*s,
          a.y + (b.y-a.y)*s,
          a.pts[k][1] + (b.pts[k][1]-a.pts[k][1])*s];
}

function cote(){
  const {anneaux, n} = chaineBord();
  const ECUME = ['#dfe4d4','#d8dfd2','#dbe2d6'];
  const MOUILLE = ['#a9c6bf','#9fbfba','#b0cbc3'];
  const pals = [HERBE, SABLE, ECUME, MOUILLE];
  for(let k=0;k<n;k++){
    const k2=(k+1)%n;
    for(let e=0;e<anneaux.length-1;e++){
      const a=anneaux[e], b=anneaux[e+1], pal=pals[e];
      const base = pal[Math.floor(hash3(k, e, 107)*pal.length)];
      pousserQuad([a.pts[k][0], a.y, a.pts[k][1]], [a.pts[k2][0], a.y, a.pts[k2][1]],
                  [b.pts[k2][0], b.y, b.pts[k2][1]], [b.pts[k][0], b.y, b.pts[k][1]],
                  grain(base, 0.93 + hash3(k, e, 109)*0.14,
                        (hash3(k, e, 113)-0.5)*0.18), [0,1,0], false);
    }
    const f = anneaux[anneaux.length-1];
    const a=f.pts[k], b=f.pts[k2];
    pousserQuad([a[0],f.y,a[1]], [b[0],f.y,b[1]],
                [b[0],Y_QUILLE,b[1]], [a[0],Y_QUILLE,a[1]],
                teinte('#6f6a5e', 0.8),
                [(a[0]+b[0])/2, 0, (a[1]+b[1])/2], false);
  }
}

/* Statue de place : socle mouluré, personnage schématique drapé. */
function statue(c){
  const y = SOL, cx = c.cx, cz = c.cz;
  ctx = {c, L:0, k:'terre', e:-1};
  const p = '#a49a8a', b = '#8f8879';
  const a = hash3(c.i, 3, 673)*Math.PI*2, dx = Math.cos(a), dz = Math.sin(a);
  boiteOr(cx, cz, dx, dz, 0.20, 0.20, y, y+0.09, grain(p, 0.94, 0));
  boiteOr(cx, cz, dx, dz, 0.16, 0.16, y+0.09, y+0.33, grain(p, 1.0, 0));
  boiteOr(cx, cz, dx, dz, 0.19, 0.19, y+0.33, y+0.39, grain(p, 1.06, 0));
  const bronze = '#6f7a5e';
  // jambes, drapé, buste, tête, bras levé
  boiteOr(cx, cz, dx, dz, 0.055, 0.075, y+0.39, y+0.62, grain(bronze, 0.9, 0.1));
  boiteOr(cx - dx*0.02, cz - dz*0.02, dx, dz, 0.075, 0.095, y+0.60, y+0.86,
          grain(bronze, 1.0, 0.1));
  boiteOr(cx - dx*0.03, cz - dz*0.03, dx, dz, 0.085, 0.11, y+0.56, y+0.78,
          grain(bronze, 0.82, -0.1));
  boiteOr(cx + dx*0.01, cz + dz*0.01, dx, dz, 0.045, 0.045, y+0.86, y+0.96,
          grain(bronze, 1.08, 0.12));
  poutre([cx - dz*0.09, y+0.82, cz + dx*0.09],
         [cx - dz*0.17, y+1.06, cz + dx*0.17], 0.024, grain(bronze, 0.96, 0.1));
  poutre([cx + dz*0.09, y+0.82, cz - dx*0.09],
         [cx + dz*0.12, y+0.60, cz - dx*0.12], 0.024, grain(bronze, 0.88, 0.05));
  boiteOr(cx, cz, dx, dz, 0.21, 0.21, y-0.005, y+0.015, grain(b, 0.9, 0));
}

function terrain(){
  const batis = cellules.filter(c => c.b.length);
  const dansPave = new Map();
  for(const c of cellules){
    const proches = batis.filter(b =>
      (b.cx-c.cx)*(b.cx-c.cx) + (b.cz-c.cz)*(b.cz-c.cz) < 9);
    dansPave.set(c.i, proches.length > 0 && champVille(c.cx, c.cz, proches) > 1);
    ctx = {c, L:0, k:'terre', e:-1};
    if(occ(c,0)){
      /* Sol sous un bâtiment. J'ai essayé de le supprimer : il n'est visible
         qu'aux angles arrondis, où le mur est en retrait du bord de cellule.
         Mesuré, la suppression ouvre 79 fentes sur cinquante vues — cours
         d'atelier en retrait, arcades, loggias, autant de cas où le bâti ne
         couvre pas toute la cellule. Pour quatre triangles par bâtiment, soit
         deux cents sur quarante-huit mille, ça n'en vaut pas le risque. */
      const S = c.q.map(v => P[v]);
      for(let i=0;i<4;i++){
        const A=S[i], B=S[(i+1)%4];
        pousserQuad([A[0],SOL,A[1]], [B[0],SOL,B[1]], [c.cx,SOL,c.cz], [c.cx,SOL,c.cz],
                    grain('#b1a898', 0.88 + hash3(c.i,i,571)*0.2, 0), [0,1,0], false);
      }
      continue;
    }
    solCellule(c, proches);
  }

  /* Une fontaine demande une vraie place : la cellule et ses quatre voisines
     doivent être libres de bâti et prises dans le pavage. Sur un simple carré
     pavé au pied d'un mur, elle se retrouvait collée à la façade. */
  const places = cellules.filter(c =>
    !c.b.length && dansPave.get(c.i) &&
    c.nb.every(nb => nb && !nb.b.length && dansPave.get(nb.i)));
  places.sort((a,b) => hash3(a.i,0,577) - hash3(b.i,0,577));
  const prises = [];
  for(const c of places){
    if(prises.length >= 2) break;
    if(hash3(c.i, 1, 587) > 0.62) continue;
    if(prises.some(q => Math.hypot(q.cx-c.cx, q.cz-c.cz) < 2.2)) continue;
    prises.push(c);
    if(hash3(c.i, 2, 593) > 0.5) fontaine(c); else statue(c);
  }

  ctx = {c:cellules[0], L:0, k:'cote', e:-1};
  cote();
}

/* Empreinte compacte des cellules qui influencent le sol et la végétation.
   Les hauteurs et les couleurs n'y figurent volontairement pas. */
function empreinteSol(){
  let h = (graine ^ 0x9e3779b9) >>> 0, n = 0;
  for(const c of cellules){
    if(!c.b.length) continue;
    h = Math.imul(h ^ (c.i + 1), 16777619) >>> 0;
    n++;
  }
  return graine + ':' + n + ':' + h;
}

let empreinteTerrain = '';
function construireTerrain(){
  const sp=pos, sc=col, sn=nor, sm=meta, sl=lam, sx=ctx,
        spd=posD, scd=colD, snd=norD, sd=detail,
        sp2=lpos, sc2=lcol, sdir=normalesDirectes;
  pos=tampon(65536); col=tampon(65536); nor=tampon(65536);
  meta=[]; lam=tampon(); ctx=null;
  posD=tampon(); colD=tampon(); norD=tampon(); detail=false;
  normalesDirectes=false;
  lpos=[]; lcol=[];
  for(let g=0; g<NB_LUEURS; g++){ lpos.push(tampon(64)); lcol.push(tampon(64)); }

  terrain();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(fige(pos),3));
  g.setAttribute('color',    new THREE.BufferAttribute(fige(col),3));
  g.computeVertexNormals();
  meshTerrain.geometry.dispose();
  meshTerrain.geometry = g;
  meshTerrain.userData.meta = meta;

  pos=sp; col=sc; nor=sn; meta=sm; lam=sl; ctx=sx;
  posD=spd; colD=scd; norD=snd; detail=sd;
  lpos=sp2; lcol=sc2; normalesDirectes=sdir;
}

/* ---------- La forêt --------------------------------------------------------
   Sept essences, réparties par un champ scalaire tiré de la graine
   de l'île : quelques foyers, une densité qui décroît en 1/d², donc un massif
   aux contours doux plutôt qu'une zone découpée. Les arbres s'écartent du
   pavage — c'est le même champ que celui de la ville, lu en négatif — et
   n'occupent pas la couronne extérieure de cellules, pour laisser la plage
   dégagée.

   Le feuillage bouge. Comme tous les arbres tiennent dans une seule géométrie,
   le balancement ne peut pas être un déplacement d'objet : il est fait dans le
   nuanceur de sommets, à partir de deux attributs, la souplesse du sommet
   (nulle au pied, maximale à la cime) et une phase propre à chaque arbre. */

const ESSENCES = [
  // chêne : houppier large, une masse centrale aplatie et des masses basses
  { tronc:'#6f5741', h:0.30, rt:0.055, n:3, rx:0.25, ry:0.20, etal:0.16, port:'large',
    feuille:['#4e7a3c','#59874a','#436c35','#628f4e'], souple:0.75 },
  // bouleau : tronc clair et élancé, deux masses décalées
  { tronc:'#cfcabb', h:0.48, rt:0.032, n:2, rx:0.17, ry:0.22, etal:0.08, port:'decale',
    feuille:['#7ba24d','#89ae5a','#6d9443','#95b866'], souple:1.15 },
  // hêtre : une seule masse ovoïde haute
  { tronc:'#7d6c57', h:0.36, rt:0.050, n:1, rx:0.24, ry:0.33, etal:0, port:'unique',
    feuille:['#4f7f45','#5d8b50','#457437','#6a985a'], souple:0.8 },
  // érable : couronne étalée et basse, tons dorés
  { tronc:'#735b45', h:0.26, rt:0.048, n:3, rx:0.20, ry:0.15, etal:0.19, port:'large',
    feuille:['#7d7b3a','#8d8544','#6e7233','#98914e'], souple:0.9 },
  // peuplier : masses empilées qui se resserrent
  { tronc:'#8d7f66', h:0.42, rt:0.034, n:3, rx:0.14, ry:0.19, etal:0.03, port:'empile',
    feuille:['#5e8a46','#6b9651','#54803c','#78a25c'], souple:1.35 },
  // sapin : étages sombres et silhouette pointue, utile pour casser la canopée ronde
  { tronc:'#5d4937', h:0.50, rt:0.040, n:4, rx:0.21, ry:0.14, etal:0, port:'conique',
    feuille:['#315943','#39634a','#294d3a','#456d51'], souple:0.72 },
  // saule : tronc bas, couronne claire et masses retombantes
  { tronc:'#76644a', h:0.25, rt:0.052, n:4, rx:0.20, ry:0.18, etal:0.17, port:'retombant',
    feuille:['#6f9650','#7da35a','#638b47','#8aad66'], souple:1.45 }
];

/* Tronc : prisme à six pans, évasé au pied et légèrement penché, en deux
   tronçons. Le rayon décroît en puissance 0,65 pour donner l'empattement des
   racines sans géométrie supplémentaire. Chaque pan reçoit sa propre valeur,
   ce qui suffit à faire lire l'écorce. */
function troncArbre(x, z, y0, y1, r0, r1, base, g){
  const N = 6, M = 2;
  const px = (hash3(g,0,79)-0.5)*0.055, pz = (hash3(g,0,83)-0.5)*0.055;
  const anneau = (t)=>{
    const y = y0 + (y1-y0)*t;
    const r = r0 + (r1-r0)*Math.pow(t, 0.65);
    const cx = x + px*t*t, cz = z + pz*t*t;
    const pts = [];
    for(let k=0;k<N;k++){
      const a = k/N*Math.PI*2;
      const rr = r*(0.86 + hash3(g,k,89)*0.30);
      pts.push([cx + Math.cos(a)*rr, y, cz + Math.sin(a)*rr]);
    }
    return pts;
  };
  const anneaux = [];
  for(let m=0;m<=M;m++) anneaux.push(anneau(m/M));
  for(let m=0;m<M;m++) for(let k=0;k<N;k++){
    const A=anneaux[m][k], B=anneaux[m][(k+1)%N];
    const C=anneaux[m+1][(k+1)%N], D=anneaux[m+1][k];
    const f = 0.78 + hash3(g, m*7+k, 97)*0.38;
    pousserQuad(A, B, C, D,
                grain(base, f, (hash3(g, m*11+k, 101)-0.5)*0.24),
                [(A[0]+B[0])/2 - x, 0, (A[2]+B[2])/2 - z], false);
  }
}

/* Masse de feuillage : ellipsoïde à sept méridiens et trois parallèles, dont
   chaque méridien a son propre rayon. Le résultat reste rond — plus de pointe
   au sommet — et se découpe en une quarantaine de facettes dont la valeur
   varie, plus sombre en dessous, plus claire au sommet. */
/* Saisons. La version précédente ajoutait des arbres « en fleurs » sur une
   palette de roses et de lilas très clairs : à la taille où on les voit, ça ne
   se lisait pas comme une floraison mais comme des taches blanches au milieu
   de la forêt. Les fleurs sont supprimées. Restent des feuillages, avec pour
   l'automne une palette propre — ambre, cuivre, pourpre — plutôt qu'un vert
   qu'on essaierait de réchauffer, ce qui ne donnait que de l'olive. Le facteur
   de clarté est borné : aucune facette ne peut virer au blanc. */
const FORET   = { m:-0.08, f:0.90 };                       // forêt profonde
const FRANC   = { m: 0.00, f:1.00 };                       // vert franc
const PRINTPS = { m: 0.06, f:1.06 };                       // vert tendre
const BLEUTE  = { m:-0.20, f:0.92 };
const DORE    = { m: 0.04, f:0.98, pal:['#c8952f','#d4a63c','#b8842a','#dcb44f'] };
const CUIVRE  = { m: 0.02, f:0.96, pal:['#b5622c','#c47338','#a35526','#cf8646'] };
const POURPRE = { m: 0.00, f:0.94, pal:['#9a4a52','#a85b62','#8a3f47','#b06a70'] };
/* Tirage pondéré par répétition. Une liste uniforme des sept ambiances donnait
   plus de quarante pour cent de feuillage roux : un bois en plein automne, pas
   une forêt. Deux arbres sur trois sont verts. */
const SAISONS = [FORET, FORET, FRANC, FRANC, FRANC, FRANC, PRINTPS, PRINTPS,
                 PRINTPS, FORET, FRANC, PRINTPS, BLEUTE, BLEUTE,
                 DORE, DORE, CUIVRE, POURPRE];

function masseFeuillage(cx, cy, cz, rx, ry, pal, g, saison){
  const N = 7, PHI = [0.78, 1.5708, 2.36];
  const ech = [];
  for(let k=0;k<N;k++) ech.push(0.80 + hash3(g,k,3)*0.36);
  const anneaux = PHI.map((phi, j)=>{
    const y = cy - ry*Math.cos(phi), r = rx*Math.sin(phi);
    const pts = [];
    for(let k=0;k<N;k++){
      const a = k/N*Math.PI*2 + (hash3(g,k,5)-0.5)*0.22;
      const rr = r*ech[k];
      pts.push([cx + Math.cos(a)*rr,
                y + (hash3(g,k*3+j,7)-0.5)*ry*0.14,
                cz + Math.sin(a)*rr]);
    }
    return pts;
  });
  const bas  = [cx + (hash3(g,0,11)-0.5)*rx*0.2, cy - ry, cz + (hash3(g,0,13)-0.5)*rx*0.2];
  const haut = [cx + (hash3(g,0,17)-0.5)*rx*0.2, cy + ry, cz + (hash3(g,0,19)-0.5)*rx*0.2];

  const S = saison || { m:0, f:1 };
  const P2 = S.pal || pal;
  const couleur = (k, j, y)=>{
    const base = P2[Math.floor(hash3(g, k*5+j, 23)*P2.length)];
    const v = (y - (cy-ry)) / (2*ry);           // ombre propre du volume
    const f = Math.min(1.12, (0.70 + v*0.44) * (0.92 + hash3(g, k*7+j, 29)*0.18) * S.f);
    return grain(base, f, (hash3(g, k*9+j, 31)-0.5)*0.20 + S.m);
  };
  for(let k=0;k<N;k++){
    const k2 = (k+1)%N;
    // calotte inférieure
    let A = anneaux[0][k], B = anneaux[0][k2];
    pousserQuad(B, A, bas, bas, couleur(k, 0, bas[1]),
                [(A[0]+B[0])/2-cx, -0.7, (A[2]+B[2])/2-cz], false);
    // bandes
    for(let j=0;j<PHI.length-1;j++){
      const P0=anneaux[j][k], P1=anneaux[j][k2];
      const P2=anneaux[j+1][k2], P3=anneaux[j+1][k];
      pousserQuad(P0, P1, P2, P3, couleur(k, j+1, (P0[1]+P2[1])/2),
                  [(P0[0]+P2[0])/2-cx, 0.15, (P0[2]+P2[2])/2-cz], false);
    }
    // calotte supérieure
    A = anneaux[PHI.length-1][k]; B = anneaux[PHI.length-1][k2];
    pousserQuad(A, B, haut, haut, couleur(k, 4, haut[1]),
                [(A[0]+B[0])/2-cx, 0.7, (A[2]+B[2])/2-cz], false);
  }
}

let foretFoyers = null;
function foyersForet(){
  if(foretFoyers) return foretFoyers;
  const rnd = mulberry32((graine ^ 0x5f3a1) >>> 0);
  const cand = cellules.filter(c => {
    const d = Math.hypot(c.cx, c.cz);
    return d > 2.8 && d < 8.6 && c.nb.every(Boolean);
  });
  foretFoyers = [];
  if(!cand.length) return foretFoyers;
  const n = 2 + Math.floor(rnd()*3);
  for(let k=0;k<n;k++) foretFoyers.push(cand[Math.floor(rnd()*cand.length)]);
  return foretFoyers;
}

const champVille = (x, z, batis) => {
  let s = 0;
  for(const b of batis){
    const dx=b.cx-x, dz=b.cz-z;
    s += 0.72/(dx*dx + dz*dz + 0.03);
  }
  return s;
};
const champForet = (x, z, foyers) => {
  let s = 0;
  for(const f of foyers){
    const dx=f.cx-x, dz=f.cz-z;
    s += 7.8/(dx*dx + dz*dz + 0.2);
  }
  return s;
};

/* Sous-bois. Ces formes sont volontairement très peu découpées : à distance,
   leur silhouette et leurs valeurs comptent davantage qu'une multitude de
   petites feuilles. Elles partagent le maillage des arbres et son mouvement,
   donc aucun objet ni appel de rendu supplémentaire. */
const SOUS_BOIS = ['#355f39','#416d40','#4d7745','#587e49'];
const FOUGERES   = ['#41653a','#4d7040','#597b45','#365b35'];
const FLEURS_BOIS = ['#d9bd63','#d8838b','#baa0cf','#e2ded0','#8fb4cf'];

/* Buisson facetté à douze triangles. La couronne n'est pas une sphère : son
   anneau irrégulier et sa cime décentrée donnent une forme naturelle, lisible
   même lorsqu'elle ne mesure que quelques pixels. */
function buissonForet(x, z, g, taille){
  const y=SOL+0.004, N=6, r=0.105*taille, h=0.19*taille;
  const anneau=[];
  for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2 + (hash3(g,k,1301)-0.5)*0.28;
    const rr=r*(0.76+hash3(g,k,1303)*0.42);
    anneau.push([x+Math.cos(a)*rr, y+h*(0.34+hash3(g,k,1307)*0.16), z+Math.sin(a)*rr]);
  }
  const bas=[x,y,z], haut=[x+(hash3(g,0,1319)-0.5)*r*0.45,y+h,z+(hash3(g,1,1321)-0.5)*r*0.45];
  for(let k=0;k<N;k++){
    const k2=(k+1)%N;
    const base=SOUS_BOIS[Math.floor(hash3(g,k,1327)*SOUS_BOIS.length)];
    pousserTri(bas, anneau[k2], anneau[k], grain(base,0.68+hash3(g,k,1329)*0.20,-0.08), false);
    pousserTri(haut, anneau[k], anneau[k2], grain(base,0.88+hash3(g,k,1331)*0.26,0.03), false);
  }
  return h;
}

/* Touffe d'herbe haute : sept lames triangulaires tournées dans toutes les
   directions. Le léger décentrage des pointes évite l'effet d'étoile. */
function touffeForet(x, z, g, taille){
  const y=SOL+0.007, n=7, h=0.16*taille;
  for(let k=0;k<n;k++){
    const a=k/n*Math.PI*2 + hash3(g,k,1361)*0.55;
    const w=(0.014+hash3(g,k,1367)*0.012)*taille;
    const rr=(hash3(g,k,1373)-0.5)*0.055*taille;
    const px=x+Math.cos(a)*rr, pz=z+Math.sin(a)*rr;
    const sx=-Math.sin(a)*w, sz=Math.cos(a)*w;
    const hh=h*(0.58+hash3(g,k,1381)*0.48);
    const tip=[px+Math.cos(a)*w*(hash3(g,k,1387)-0.5)*2, y+hh, pz+Math.sin(a)*w*(hash3(g,k,1399)-0.5)*2];
    const base=SOUS_BOIS[Math.floor(hash3(g,k,1409)*SOUS_BOIS.length)];
    pousserTri([px+sx,y,pz+sz], [px-sx,y,pz-sz], tip,
               grain(base,0.82+hash3(g,k,1423)*0.25,0.04), false);
  }
  return h;
}

/* Fougère en rosette. Chaque fronde est un losange incliné : six quads
   suffisent pour évoquer une plante plus large et plus sombre que l'herbe. */
function fougereForet(x, z, g, taille){
  const y=SOL+0.008, n=6, h=0.115*taille, r=0.135*taille;
  for(let k=0;k<n;k++){
    const a=k/n*Math.PI*2 + hash3(g,0,1433)*Math.PI;
    const ca=Math.cos(a), sa=Math.sin(a), px=-sa, pz=ca;
    const rr=r*(0.72+hash3(g,k,1439)*0.34), w=rr*0.18;
    const A=[x,y+h*0.12,z], B=[x+ca*rr*0.52+px*w,y+h*0.76,z+sa*rr*0.52+pz*w];
    const C=[x+ca*rr,y+h*(0.42+hash3(g,k,1447)*0.28),z+sa*rr];
    const D=[x+ca*rr*0.52-px*w,y+h*0.76,z+sa*rr*0.52-pz*w];
    const base=FOUGERES[Math.floor(hash3(g,k,1451)*FOUGERES.length)];
    pousserQuad(A,B,C,D,grain(base,0.78+hash3(g,k,1453)*0.26,-0.04),[0,1,0],false);
  }
  return h;
}

/* Quelques points colorés uniquement en lisière. Deux petits plans croisés
   restent lisibles sans devenir les grosses taches claires que produisaient
   autrefois les floraisons posées dans les couronnes. */
function fleurForet(x, z, g, taille){
  const y=SOL+0.009, h=0.12*taille, w=0.025*taille;
  const vert=grain('#4b7040',0.88,0), fleur=teinte(FLEURS_BOIS[Math.floor(hash3(g,0,1459)*FLEURS_BOIS.length)],0.92);
  pousserTri([x-w*0.28,y,z],[x+w*0.28,y,z],[x,y+h,z],vert,false);
  pousserQuad([x-w,y+h-w,z],[x+w,y+h-w,z],[x+w,y+h+w,z],[x-w,y+h+w,z],fleur,[0,0,1],false);
  pousserQuad([x,y+h-w,z-w],[x,y+h-w,z+w],[x,y+h+w,z+w],[x,y+h+w,z-w],fleur,[1,0,0],false);
  return h+w;
}

/* Bois mort rare, partiellement enfoncé dans l'herbe. Il reste rigide dans le
   vent et apporte une ligne horizontale au milieu des silhouettes verticales. */
function boisMortForet(x, z, g, taille){
  const a=hash3(g,0,1481)*Math.PI, ca=Math.cos(a), sa=Math.sin(a);
  const l=(0.24+hash3(g,1,1483)*0.18)*taille, y=SOL+0.025;
  poutre([x-ca*l,y,z-sa*l],[x+ca*l,y+0.025*taille,z+sa*l],0.025*taille,
         grain('#6c5841',0.72+hash3(g,2,1487)*0.20,-0.06));
  for(const s of [-1,1]){
    const px=x+ca*l*s, pz=z+sa*l*s;
    pousserQuad([px-sa*0.028,y-0.018,pz+ca*0.028],[px+sa*0.028,y-0.018,pz-ca*0.028],
                [px+sa*0.028,y+0.045,pz-ca*0.028],[px-sa*0.028,y+0.045,pz+ca*0.028],
                grain('#9a7650',0.72,0),[ca*s,0,sa*s],false);
  }
}

const ECH_ARBRE = 1.4;             // échelle d'ensemble des arbres

function dessinerArbre(x, z, e, g){
  const y = SOL, E = ECH_ARBRE;
  const T = 0.80 + hash3(g, 7, 709)*0.52;      // gabarit propre à l'arbre
  const hh = e.h*E*T * (0.84 + hash3(g,0,31)*0.38);
  const RX = e.rx*E*T, RY = e.ry*E*T;
  troncArbre(x, z, y-0.04, y + hh*1.02, e.rt*E*T*1.75, e.rt*E*T*0.72, e.tronc, g);

  const masses = [];
  if(e.port === 'unique'){
    masses.push([0, hh + RY*0.72, 0, 1, 1]);
  }else if(e.port === 'empile'){
    for(let i=0;i<e.n;i++){
      masses.push([(hash3(g,i,37)-0.5)*RX*0.3, hh + RY*(0.4 + i*0.82),
                   (hash3(g,i,41)-0.5)*RX*0.3, 1 - i*0.18, 1 - i*0.10]);
    }
  }else if(e.port === 'decale'){
    for(let i=0;i<e.n;i++){
      const a = hash3(g,i,43)*Math.PI*2;
      masses.push([Math.cos(a)*e.etal*E*i, hh + RY*(0.55 + i*0.62),
                   Math.sin(a)*e.etal*E*i, 1 - i*0.14, 1 - i*0.08]);
    }
  }else if(e.port === 'conique'){
    for(let i=0;i<e.n;i++){
      const t=i/(e.n-1), a=hash3(g,i,1493)*Math.PI*2;
      masses.push([Math.cos(a)*RX*0.08*(1-t), hh + RY*(0.20+i*0.82),
                   Math.sin(a)*RX*0.08*(1-t), 1.30-i*0.21, 0.58+i*0.02]);
    }
  }else if(e.port === 'retombant'){
    masses.push([0,hh+RY*0.88,0,1.0,1.0]);
    for(let i=1;i<e.n;i++){
      const a=(i-1)/(e.n-1)*Math.PI*2+hash3(g,0,1499)*Math.PI*2;
      masses.push([Math.cos(a)*e.etal*E,hh+RY*(0.25+hash3(g,i,1511)*0.24),
                   Math.sin(a)*e.etal*E,0.78+hash3(g,i,1523)*0.16,1.16]);
    }
  }else{                                       // couronne large
    masses.push([0, hh + RY*0.92, 0, 1.05, 1.05]);
    for(let i=1;i<e.n;i++){
      const a = (i-1)/(e.n-1)*Math.PI*2 + hash3(g,0,47)*2;
      masses.push([Math.cos(a)*e.etal*E, hh + RY*(0.46 + hash3(g,i,53)*0.3),
                   Math.sin(a)*e.etal*E, 0.80 + hash3(g,i,59)*0.22,
                   0.74 + hash3(g,i,61)*0.24]);
    }
  }

  /* Racines apparentes et deux charpentières au maximum. Elles sont peu
     coûteuses mais changent fortement la lecture sous la couronne, notamment
     avec une caméra basse. */
  const racines=e.port==='conique' ? 3 : 2;
  for(let i=0;i<racines;i++){
    const a=hash3(g,i,1531)*Math.PI*2, l=(0.09+hash3(g,i,1543)*0.09)*E*T;
    poutre([x,y+0.018,z],[x+Math.cos(a)*l,y-0.012,z+Math.sin(a)*l],
           e.rt*E*T*(0.30+hash3(g,i,1549)*0.12),grain(e.tronc,0.66+hash3(g,i,1553)*0.18,-0.04));
  }
  const nbBranches=e.port==='conique' ? 0 : Math.min(2,masses.length-1);
  for(let i=0;i<nbBranches;i++){
    const m=masses[i+1], yb=y+hh*(0.54+i*0.14);
    poutre([x,yb,z],[x+m[0]*0.72,y+m[1]-RY*m[4]*0.42,z+m[2]*0.72],
           e.rt*E*T*(0.34-i*0.06),grain(e.tronc,0.76+hash3(g,i,1559)*0.20,0));
  }

  /* Les teintes saisonnières sont groupées par cellule : une petite zone
     cuivrée paraît naturelle, alors qu'un arbre roux isolé dans chaque case
     produisait un semis de couleurs sans cohérence. Les conifères restent
     verts toute l'année. */
  const bosquet=Math.floor(g/61);
  const saison = e.port==='conique'
    ? (hash3(bosquet,5,1567)>0.72 ? BLEUTE : FORET)
    : SAISONS[Math.floor(hash3(bosquet,5,691)*SAISONS.length)];
  masses.forEach(([dx,dy,dz,sx,sy], i)=>
    masseFeuillage(x+dx, y+dy, z+dz, RX*sx, RY*sy, e.feuille, g*7 + i, saison));

  return y + hh*0.4;                 // hauteur à partir de laquelle ça remue
}

let cacheForet = new Map();
function construireForet(){
  const foyers = foyersForet();
  const batis = cellules.filter(c => c.b.length);
  const sp=pos, sc=col, sn=nor, sm=meta, sl=lam, sp2=lpos, sc2=lcol,
        sd=detail, sdir=normalesDirectes;
  detail = false;
  normalesDirectes = false;
  pos=tampon(); col=tampon(); nor=tampon(); meta=[]; lam=tampon();
  lpos=[]; lcol=[]; for(let g=0; g<NB_LUEURS; g++){ lpos.push(tampon(64)); lcol.push(tampon(64)); }
  const souple = tampon(4096), phase = tampon(4096);
  let k = 0;

  /* Ajoute les deux attributs de vent pour toute géométrie émise depuis i0.
     Une seule réservation par plante remplace les anciennes réservations
     sommet par sommet. */
  const animerPlante = (i0, y0, hauteur, force, ph) => {
    const i1=pos.n/3, n=i1-i0;
    place(souple,n); place(phase,n);
    for(let v=i0;v<i1;v++){
      const t=Math.max(0,Math.min(1,(pos.a[v*3+1]-y0)/(hauteur||1)));
      souple.a[souple.n++]=t*t*force;
      phase.a[phase.n++]=ph;
    }
  };

  for(const c of cellules){
    if(occ(c,0) || !c.nb.every(Boolean)) continue;
    const champ = champForet(c.cx, c.cz, foyers);
    /* La canopée commence à 0,82 comme auparavant, mais le sous-bois descend
       jusqu'à 0,56 : la lisière devient progressive au lieu de s'arrêter sur
       la dernière rangée d'arbres. */
    if(champ < 0.56) continue;
    const dens = champ - 0.82;
    const couvert = Math.max(0,Math.min(1,(champ-0.56)/1.18));
    let sigF = 0;
    for(const b of batis){
      const dx=b.cx-c.cx, dz=b.cz-c.cz;
      if(dx*dx + dz*dz < 9) sigF = (sigF + Math.imul(b.i + 1, 2654435761)) >>> 0;
    }
    const vieux = cacheForet.get(c.i);
    if(vieux && vieux.sig === sigF){
      place(pos, vieux.p.length); pos.a.set(vieux.p, pos.n); pos.n += vieux.p.length;
      place(col, vieux.c.length); col.a.set(vieux.c, col.n); col.n += vieux.c.length;
      place(souple, vieux.s.length); souple.a.set(vieux.s, souple.n); souple.n += vieux.s.length;
      place(phase,  vieux.f.length); phase.a.set(vieux.f,  phase.n);  phase.n  += vieux.f.length;
      k += vieux.k;
      continue;
    }
    const pA = pos.n, cA = col.n, sA = souple.n, kA = k;
    /* Le champ de la ville se lit sur le voisinage proche, comme pour le
       pavage : sommé sur toute l'île, il déborderait très loin et interdirait
       la forêt partout. */
    const proches = batis.filter(b =>
      (b.cx-c.cx)*(b.cx-c.cx) + (b.cz-c.cz)*(b.cz-c.cz) < 9);
    const nb = Math.max(0,Math.min(3, Math.round(Math.min(1.25, dens)*3.0)));
    for(let i=0;i<nb;i++){
      const g = c.i*61 + i;
      const a = hash3(g,1,59)*Math.PI*2, r = 0.40*Math.sqrt(hash3(g,2,61));
      const x = c.cx + Math.cos(a)*r, z = c.cz + Math.sin(a)*r;
      if(champVille(x, z, proches) > 0.72) continue;
      const e = ESSENCES[Math.floor(hash3(g,3,67)*ESSENCES.length)];
      const i0 = pos.n/3;
      const yPied = dessinerArbre(x, z, e, g);
      const ph = hash3(g,4,71)*Math.PI*2;
      animerPlante(i0,yPied,0.55*ECH_ARBRE,e.souple,ph);
      k++;
    }

    /* Sous-bois déterministe. Les cellules du cœur reçoivent trois à cinq
       touffes ; la lisière une ou deux. Les plantes reculent plus tôt que les
       arbres devant le pavage, ce qui ménage une transition propre autour des
       constructions. */
    const nbSous=1+Math.floor(couvert*3.2+hash3(c.i,0,1571)*1.7);
    for(let i=0;i<nbSous;i++){
      const vg=c.i*97+200+i, a=hash3(vg,1,1579)*Math.PI*2;
      const r=0.10+0.42*Math.sqrt(hash3(vg,2,1583));
      const x=c.cx+Math.cos(a)*r, z=c.cz+Math.sin(a)*r;
      if(champVille(x,z,proches)>0.48) continue;
      const i0=pos.n/3, q=hash3(vg,3,1597), taille=0.72+hash3(vg,4,1601)*0.58;
      let h, force;
      if(q<0.24+couvert*0.12){ h=buissonForet(x,z,vg,taille); force=0.48; }
      else if(q<0.62){ h=fougereForet(x,z,vg,taille); force=0.92; }
      else{ h=touffeForet(x,z,vg,taille); force=1.15; }
      animerPlante(i0,SOL,h,force,hash3(vg,5,1607)*Math.PI*2);
    }

    /* Fleurs discrètes aux endroits les plus ouverts. */
    if(couvert<0.58 && hash3(c.i,6,1609)>0.52){
      const vg=c.i*101+700, a=hash3(vg,1,1613)*Math.PI*2, r=0.16+hash3(vg,2,1619)*0.30;
      const x=c.cx+Math.cos(a)*r,z=c.cz+Math.sin(a)*r;
      if(champVille(x,z,proches)<0.42){
        const i0=pos.n/3,h=fleurForet(x,z,vg,0.82+hash3(vg,3,1621)*0.35);
        animerPlante(i0,SOL,h,1.18,hash3(vg,4,1627)*Math.PI*2);
      }
    }

    /* Une souche couchée occasionnelle dans les zones denses. */
    if(couvert>0.68 && hash3(c.i,7,1637)>0.965){
      const vg=c.i*103+900, i0=pos.n/3;
      boisMortForet(c.cx+(hash3(vg,1,1657)-0.5)*0.42,
                    c.cz+(hash3(vg,2,1663)-0.5)*0.42,vg,0.85+hash3(vg,3,1667)*0.35);
      animerPlante(i0,SOL,1,0,0);
    }
    cacheForet.set(c.i, { sig: sigF, k: k - kA,
      p: pos.a.slice(pA, pos.n), c: col.a.slice(cA, col.n),
      s: souple.a.slice(sA, souple.n), f: phase.a.slice(sA, phase.n) });
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(fige(pos),3));
  g.setAttribute('color',    new THREE.BufferAttribute(fige(col),3));
  g.computeVertexNormals();
  g.setAttribute('aSouple',  new THREE.BufferAttribute(fige(souple),1));
  g.setAttribute('aPhase',   new THREE.BufferAttribute(fige(phase),1));
  pos=sp; col=sc; nor=sn; meta=sm; lam=sl; lpos=sp2; lcol=sc2;
  detail=sd; normalesDirectes=sdir;
  meshArbres.geometry.dispose();
  meshArbres.geometry = g;
  return k;
}


/* ---------- Pêcherie, cultures, pergola, détails urbains ------------------ */

/* Ponton sur pilotis, jeté depuis la face ouverte de la pêcherie vers le large. */
function ponton(c, A, B, dir, y0){
  const mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2;
  const px=-dir[1], pz=dir[0];
  const L = 1.55, W = 0.34;
  const planche = teinte('#a58963', 1), sombre = teinte('#6b5744', 1);
  const yd = y0 + 0.02;
  const P = (l, w) => [mx + dir[0]*l + px*w, mz + dir[1]*l + pz*w];
  // tablier en lattes
  const n = 9;
  for(let k=0;k<n;k++){
    const l0 = 0.05 + L*k/n, l1 = 0.05 + L*(k+1)/n - 0.012;
    const a=P(l0,-W), b=P(l1,-W), d=P(l1,W), e=P(l0,W);
    pousserQuad([a[0],yd,a[1]], [b[0],yd,b[1]], [d[0],yd,d[1]], [e[0],yd,e[1]],
                grain('#a58963', 0.88 + hash3(c.i,k,131)*0.26,
                      (hash3(c.i,k,137)-0.5)*0.2), [0,1,0], false);
  }
  // pilotis et garde-corps
  for(const l of [0.35, 1.0, 1.5]){
    for(const w of [-W, W]){
      const q = P(l, w);
      poutre([q[0], yd, q[1]], [q[0], -0.55, q[1]], 0.032, sombre);
    }
  }
  for(const w of [-W, W]){
    const a=P(0.35,w), b=P(1.5,w);
    poutre([a[0], yd+0.30, a[1]], [b[0], yd+0.30, b[1]], 0.016, sombre);
    for(const l of [0.35, 0.92, 1.5]){
      const q=P(l,w);
      poutre([q[0], yd, q[1]], [q[0], yd+0.31, q[1]], 0.018, sombre);
    }
  }
  // casiers et filet au bout
  boiteOr(...P(1.2,-0.14), dir[0], dir[1], 0.09, 0.09, yd, yd+0.15, teinte('#8a6a4e',1));
  boiteOr(...P(1.32,0.13), dir[0], dir[1], 0.08, 0.08, yd, yd+0.12, teinte('#7a6248',1));
  boiteOr(...P(0.62,0.18), dir[0], dir[1], 0.10, 0.07, yd, yd+0.09, teinte('#6f8f7a',1));
}

/* Cultures : sol labouré puis rangs de plants, orientés par la cellule. */
function champCulture(c, L, sorte){
  const S = c.q.map(v => P[v]);
  const y = SOL + 0.015;
  ctx = {c, L, k:'terre', e:-1};
  const terre = ['#6b563f','#75604a','#63503b'];
  // sillons : bandes alternées suivant l'axe de la cellule
  const N = 8;
  for(let i=0;i<N;i++){
    const a0 = melxz(S[0], S[3], i/N), b0 = melxz(S[1], S[2], i/N);
    const a1 = melxz(S[0], S[3], (i+1)/N), b1 = melxz(S[1], S[2], (i+1)/N);
    const base = terre[i % terre.length];
    pousserQuad([a0[0],y,a0[1]], [b0[0],y,b0[1]], [b1[0],y,b1[1]], [a1[0],y,a1[1]],
                grain(base, 0.88 + hash3(c.i,i,139)*0.22,
                      (hash3(c.i,i,149)-0.5)*0.24), [0,1,0], false);
  }
  const u = [S[1][0]-S[0][0], S[1][1]-S[0][1]];
  const lu = Math.hypot(u[0],u[1])||1; u[0]/=lu; u[1]/=lu;
  for(let i=0;i<N;i++){
    const t = (i+0.5)/N;
    const a = melxz(S[0], S[3], t), b = melxz(S[1], S[2], t);
    const nb = 5;
    for(let k=0;k<nb;k++){
      const s = (k+0.5)/nb + (hash3(c.i, i*13+k, 151)-0.5)*0.10;
      const x = a[0] + (b[0]-a[0])*s, z = a[1] + (b[1]-a[1])*s;
      plante(x, z, y, sorte, c.i*97 + i*11 + k);
    }
  }
}

/* Cultures. Les plants étaient des boîtes empilées ; ils ont maintenant une
   silhouette propre à leur espèce — l'épi qui penche, la tête de tournesol
   inclinée vers le ciel avec ses pétales rayonnants, le chou en couches, la
   touffe de fleurs. Chaque pied est incliné et tourné différemment : un champ
   parfaitement aligné ne ressemble à rien. */
function plante(x, z, y, sorte, g){
  const pencher = (h) => {
    const a = hash3(g,0,1301)*Math.PI*2, p = 0.10 + hash3(g,1,1303)*0.14;
    return [Math.cos(a)*p*h, Math.sin(a)*p*h];
  };

  if(sorte === 0){                                   /* blé. Quatre tiges au lieu
       de cinq et deux grains au lieu de trois : à cette échelle la différence
       ne se voit pas, et le champ de blé était de loin le plus lourd de tous
       les ateliers — près de douze mille triangles, trois fois une maison. */
    const n = 4;
    for(let k=0;k<n;k++){
      const h = 0.22 + hash3(g,k,157)*0.10;
      const a = k/n*Math.PI*2 + hash3(g,k,163)*1.4;
      const r = 0.016 + hash3(g,k,167)*0.012;
      const bx = x + Math.cos(a)*r, bz = z + Math.sin(a)*r;
      const [dx,dz] = pencher(h);
      const tx = bx + Math.cos(a)*0.030 + dx, tz = bz + Math.sin(a)*0.030 + dz;
      const tige = grain('#b9a05a', 0.88 + hash3(g,k,173)*0.24, 0.06);
      poutre([bx, y, bz], [tx, y+h*0.72, tz], 0.008, tige);
      // épi : trois grains étagés qui s'affinent
      for(let e=0;e<2;e++){
        const t0 = 0.72 + e*0.125, t1 = 0.72 + (e+1)*0.125;
        const p0 = [bx+(tx-bx)*t0/0.72*0.72, y+h*t0, bz+(tz-bz)*t0/0.72*0.72];
        const p1 = [bx+(tx-bx)*t1/0.72*0.72, y+h*t1, bz+(tz-bz)*t1/0.72*0.72];
        const rr = 0.026 - e*0.006;
        boiteOr((p0[0]+p1[0])/2, (p0[2]+p1[2])/2, Math.cos(a), Math.sin(a),
                rr, rr*0.7, p0[1], p1[1],
                grain('#e0c469', 0.90 + hash3(g,k*3+e,179)*0.22, 0.10));
      }
    }

  }else if(sorte === 1){                             // tournesol
    const h = 0.32 + hash3(g,0,157)*0.12;
    const [dx,dz] = pencher(h);
    const tete = [x+dx, y+h, z+dz];
    poutre([x, y, z], tete, 0.015, grain('#5b7a3a', 0.92+hash3(g,0,191)*0.16, 0));
    // deux feuilles opposées, inclinées
    for(const sg of [-1, 1]){
      const a = hash3(g,1,193)*Math.PI*2 + (sg>0?0:Math.PI);
      const b1 = [x+dx*0.45, y+h*0.45, z+dz*0.45];
      pousserQuad(b1, [b1[0]+Math.cos(a)*0.05, b1[1]+0.02, b1[2]+Math.sin(a)*0.05],
                  [b1[0]+Math.cos(a)*0.10, b1[1]+0.005, b1[2]+Math.sin(a)*0.10],
                  [b1[0]+Math.cos(a)*0.05, b1[1]-0.025, b1[2]+Math.sin(a)*0.05],
                  grain('#4e6d32', 0.94, 0), [0,1,0], false);
    }
    // corolle : douze pétales rayonnants sur un disque légèrement bombé
    const N = 12, R = 0.085, r0 = 0.032;
    const inc = 0.30;                        // la tête regarde un peu de côté
    const ax = Math.cos(hash3(g,2,197)*6.28), az = Math.sin(hash3(g,2,197)*6.28);
    const pp = (ang, rad, dy) => [tete[0] + Math.cos(ang)*rad + ax*dy*inc,
                                  tete[1] + dy,
                                  tete[2] + Math.sin(ang)*rad + az*dy*inc];
    for(let k=0;k<N;k++){
      const a0 = k/N*Math.PI*2, a1 = (k+0.5)/N*Math.PI*2, a2 = (k+1)/N*Math.PI*2;
      pousserQuad(pp(a0,r0,0), pp(a2,r0,0), pp(a1,R,0.014), pp(a1,R,0.014),
                  grain('#f0c33c', 0.88 + hash3(g,k,181)*0.26, 0.10), [0,1,0], false);
    }
    for(let k=0;k<N;k++){
      const a0 = k/N*Math.PI*2, a2 = (k+1)/N*Math.PI*2;
      pousserQuad(pp(a0,r0,0.006), pp(a2,r0,0.006), pp(0,0,0.020), pp(0,0,0.020),
                  grain('#5a4029', 0.92 + hash3(g,k,199)*0.2, 0), [0,1,0], false);
    }

  }else if(sorte === 2){                             // légumes : choux et fanes
    const type = hash3(g,3,211) > 0.45;
    if(type){                                        // chou pommé, en couches
      const R = 0.055 + hash3(g,0,157)*0.02;
      for(let e=0;e<3;e++){
        const r = R*(1 - e*0.22), yy = y + 0.015 + e*0.032;
        const N = 6;
        for(let k=0;k<N;k++){
          const a0=k/N*Math.PI*2, a1=(k+1)/N*Math.PI*2;
          const A=[x+Math.cos(a0)*r, z+Math.sin(a0)*r];
          const B=[x+Math.cos(a1)*r, z+Math.sin(a1)*r];
          pousserQuad([A[0],yy,A[1]], [B[0],yy,B[1]],
                      [x, yy+0.030, z], [x, yy+0.030, z],
                      grain(e===2 ? '#7fa85c' : '#4f7a3a',
                            0.86+hash3(g,e*7+k,191)*0.28, (hash3(g,k,193)-0.5)*0.2),
                      [Math.cos(a0), 0.5, Math.sin(a0)], false);
        }
      }
    }else{                                           // fanes de carotte
      for(let k=0;k<6;k++){
        const a = k/6*Math.PI*2 + hash3(g,k,163);
        const h = 0.09 + hash3(g,k,167)*0.06;
        poutre([x, y, z], [x+Math.cos(a)*0.045, y+h, z+Math.sin(a)*0.045], 0.007,
               grain('#5c8a4e', 0.9+hash3(g,k,191)*0.24, 0));
        boiteOr(x+Math.cos(a)*0.055, z+Math.sin(a)*0.055, Math.cos(a), Math.sin(a),
                0.022, 0.014, y+h*0.8, y+h+0.02,
                grain('#4f7a3a', 0.88+hash3(g,k,197)*0.3, 0));
      }
    }

  }else{                                             /* fleurs. Elles étaient
       toutes bâties sur le même patron : quatre tiges, cinq pétales, un cœur
       doré. Un massif entier de clones. Chaque pied tire maintenant sa FORME —
       marguerite, clochette ou ombelle —, son nombre de tiges, sa taille et sa
       teinte dominante, avec seulement une ou deux touches d'une autre couleur. */
    const pal = ['#d4506a','#e8a33d','#c56d8f','#7a6fc0','#e8dc6a','#e2e2e2',
                 '#e06f9a','#9fc45a','#dc5f4a'];
    const forme = Math.floor(hash3(g, 7, 1511)*3);
    const dom = pal[Math.floor(hash3(g, 8, 1523)*pal.length)];
    const nT = 3 + Math.floor(hash3(g, 9, 1531)*3);
    const ech = 0.78 + hash3(g, 10, 1543)*0.55;
    for(let k=0;k<nT;k++){
      const a = hash3(g,k,163)*Math.PI*2, r = 0.038*hash3(g,k,197);
      const bx = x+Math.cos(a)*r, bz = z+Math.sin(a)*r;
      const h = (0.09 + hash3(g,k,157)*0.11) * ech;
      const [dx,dz] = pencher(h);
      const tete = [bx+dx*0.7, y+h, bz+dz*0.7];
      poutre([bx, y, bz], tete, 0.007, grain('#557a3c', 0.9+hash3(g,k,1549)*0.2, 0));
      // une tige sur trois s'écarte de la teinte dominante
      const coul = hash3(g, k, 1553) > 0.66
        ? pal[Math.floor(hash3(g, k, 1559)*pal.length)] : dom;
      const q = (ang, rad, dy) => [tete[0]+Math.cos(ang)*rad, tete[1]+dy,
                                   tete[2]+Math.sin(ang)*rad];
      if(forme === 0){                               // marguerite
        const N = 5 + Math.floor(hash3(g,k,1567)*3), R = (0.022+hash3(g,k,1571)*0.012)*ech;
        for(let m=0;m<N;m++){
          const a0=m/N*Math.PI*2, a1=(m+0.5)/N*Math.PI*2, a2=(m+1)/N*Math.PI*2;
          pousserQuad(q(a0,0.008,0), q(a2,0.008,0), q(a1,R,0.008), q(a1,R,0.008),
                      grain(coul, 0.92+hash3(g,k*5+m,211)*0.2, 0), [0,1,0], false);
        }
        boiteOr(tete[0], tete[2], 1, 0, 0.010, 0.010, tete[1], tete[1]+0.014,
                grain('#e0c469', 1.0, 0.1));
      }else if(forme === 1){                         // clochette pendante
        const R = (0.019+hash3(g,k,1579)*0.008)*ech;
        for(let m=0;m<5;m++){
          const a0=m/5*Math.PI*2, a1=(m+1)/5*Math.PI*2;
          pousserQuad(q(a0,R,-0.008), q(a1,R,-0.008),
                      q(a1,R*0.5,-0.040), q(a0,R*0.5,-0.040),
                      grain(coul, 0.90+hash3(g,k*3+m,1583)*0.22, 0),
                      [Math.cos(a0),0,Math.sin(a0)], false);
          pousserQuad(q(a0,R,-0.008), q(a1,R,-0.008), tete, tete,
                      grain(coul, 1.04, 0), [0,1,0], false);
        }
      }else{                                         // ombelle
        const R = (0.026+hash3(g,k,1597)*0.012)*ech, NF = 6;
        for(let m=0;m<NF;m++){
          const a0=m/NF*Math.PI*2;
          const px2=tete[0]+Math.cos(a0)*R, pz2=tete[2]+Math.sin(a0)*R;
          poutre([tete[0], tete[1]-0.012, tete[2]], [px2, tete[1]+0.004, pz2],
                 0.004, teinte('#557a3c',1));
          boiteOr(px2, pz2, 1, 0, 0.010, 0.010, tete[1]+0.004, tete[1]+0.018,
                  grain(coul, 0.94+hash3(g,k*7+m,1601)*0.18, 0));
        }
      }
    }
  }
}

/* Pergola : quatre poteaux, une charpente, une vigne dessus. */
function pergola(c, dRet, y){
  const px = -dRet[1], pz = dRet[0];
  const X = (a,b) => c.cx + dRet[0]*a + px*b;
  const Z = (a,b) => c.cz + dRet[1]*a + pz*b;
  const bois = teinte('#8a6a4e', 1), h = 0.46;
  const coins = [[-0.22,-0.22],[-0.22,0.22],[0.20,0.22],[0.20,-0.22]];
  for(const [a,b] of coins){
    poutre([X(a,b), y, Z(a,b)], [X(a,b), y+h, Z(a,b)], 0.022, bois);
  }
  for(let i=0;i<4;i++){
    const [a,b]=coins[i], [d,e]=coins[(i+1)%4];
    poutre([X(a,b), y+h, Z(a,b)], [X(d,e), y+h, Z(d,e)], 0.020, bois);
  }
  for(let k=1;k<5;k++){
    const t = k/5;
    poutre([X(-0.22 + 0.42*t, -0.24), y+h+0.02, Z(-0.22 + 0.42*t, -0.24)],
           [X(-0.22 + 0.42*t, 0.24),  y+h+0.02, Z(-0.22 + 0.42*t, 0.24)], 0.014, bois);
    boiteOr(X(-0.22 + 0.42*t, (hash3(c.i,k,223)-0.5)*0.3), Z(-0.22 + 0.42*t, (hash3(c.i,k,223)-0.5)*0.3),
            1, 0, 0.07, 0.05, y+h+0.03, y+h+0.09,
            grain('#4f7f45', 0.86 + hash3(c.i,k,227)*0.28, (hash3(c.i,k,229)-0.5)*0.2));
  }
}

/* Lanterne de façade : potence en fer forgé — bras coudé, tirant oblique,
   anneau — et lanterne à quatre pans coiffée d'une pyramide. */
function lanterneMurale(A, B, y0, dehors, cle, ouvs){
  const len = dist2d(A,B);
  if(len < 0.5) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl, oz = dehors[2]/dl;
  let u = -1, meilleur = 0;
  for(const t of [0.14, 0.28, 0.72, 0.86]){
    const uu = len*t;
    let d = 9;
    for(const o of ouvs) d = Math.min(d, Math.abs(uu - (o.u0+o.u1)/2) - (o.u1-o.u0)/2);
    if(d > meilleur){ meilleur = d; u = uu; }
  }
  if(u < 0 || meilleur < 0.10) return;

  const fer = teinte('#2f2e35', 1);
  const px = A[0]+ux*u, pz = A[1]+uz*u;
  const y = y0 + 0.52;
  const P = (d, h) => [px + ox*d, y + h, pz + oz*d];
  // platine, bras coudé, tirant
  boiteOr(px + ox*0.012, pz + oz*0.012, ox, oz, 0.012, 0.035, y-0.045, y+0.045, fer);
  poutre(P(0.02, 0), P(0.10, 0.03), 0.009, fer);
  poutre(P(0.10, 0.03), P(0.155, 0.005), 0.009, fer);
  poutre(P(0.03, -0.10), P(0.115, 0.02), 0.006, fer);
  poutre(P(0.155, 0.005), P(0.155, -0.035), 0.006, fer);
  // lanterne : quatre montants, vitrage, toiture pyramidale
  const R = 0.036, hb = -0.155, ht = -0.038;
  const coin = (k)=>{
    const a = Math.PI/4 + k*Math.PI/2;
    return [px + ox*0.155 + Math.cos(a)*R*(ox? 1:1)*0 + (ux*Math.cos(a) + ox*Math.sin(a))*R,
            0,
            pz + oz*0.155 + (uz*Math.cos(a) + oz*Math.sin(a))*R];
  };
  const cs = [0,1,2,3].map(coin);
  lampeCourante = 1; lampeGroupe = hash3(cle, 1, 727) > 0.5 ? 3 : 2;
  for(let k=0;k<4;k++){
    const a=cs[k], b=cs[(k+1)%4];
    pousserQuad([a[0],y+hb,a[2]], [b[0],y+hb,b[2]], [b[0],y+ht,b[2]], [a[0],y+ht,a[2]],
                teinte('#ffd9a0', 1.15),
                [(a[0]+b[0])/2 - (px+ox*0.155), 0, (a[2]+b[2])/2 - (pz+oz*0.155)], false);
  }
  lampeCourante = 0; lampeGroupe = 0;
  for(let k=0;k<4;k++){
    const a=cs[k];
    poutre([a[0],y+hb-0.012,a[2]], [a[0],y+ht+0.008,a[2]], 0.006, fer);
  }
  const faite = [px + ox*0.155, y+ht+0.075, pz + oz*0.155];
  for(let k=0;k<4;k++){
    const a=cs[k], b=cs[(k+1)%4];
    const A2=[a[0], y+ht+0.008, a[2]], B2=[b[0], y+ht+0.008, b[2]];
    pousserQuad(A2, B2, faite, faite, fer,
                [(a[0]+b[0])/2 - faite[0], 0.5, (a[2]+b[2])/2 - faite[2]], false);
  }
  boiteOr(px + ox*0.155, pz + oz*0.155, ox, oz, 0.048, 0.048, y+hb-0.018, y+hb-0.006, fer);
}

/* Lierre : traînées de petites feuilles plaquées sur un mur. Les baies sont
   contournées feuille par feuille — le lierre passe à côté des fenêtres au lieu
   de les recouvrir. */
function lierre(A, B, y0, y1, dehors, cle, ouvs){
  const len = dist2d(A,B);
  if(len < 0.35) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl*0.018, oz = dehors[2]/dl*0.018;
  const libre = (u, w, ya, yb)=>{
    for(const o of ouvs){
      if(u+w > o.u0-0.035 && u-w < o.u1+0.035 &&
         yb > y0+o.b-0.04 && ya < y0+o.b+o.h+0.05) return false;
    }
    return true;
  };
  const nb = 1 + Math.floor(hash3(cle, 0, 239)*2);
  for(let m=0;m<nb;m++){
    let u = (0.16 + hash3(cle, m, 241)*0.68)*len;
    const haut = (y1-y0)*(0.42 + hash3(cle, m, 251)*0.5);
    const pas = 0.042, n = Math.max(3, Math.round(haut/pas));
    for(let k=0;k<n;k++){
      const t = k/n;
      u += (hash3(cle, m*19+k, 263)-0.5)*0.055;          // la tige serpente
      const yy = y0 + 0.01 + haut*t;
      // trois à quatre feuilles autour de la tige
      const nf = 3 + (hash3(cle, m*7+k, 281) > 0.6 ? 1 : 0);
      for(let f=0;f<nf;f++){
        const w = 0.020 + hash3(cle, m*23+k*5+f, 257)*0.024;
        const du = (hash3(cle, m*29+k*7+f, 269)-0.5)*0.085*(1 - t*0.4);
        const dy = (hash3(cle, m*31+k*11+f, 271)-0.5)*0.035;
        const uu = u + du, yb2 = yy + dy;
        if(uu-w < 0.01 || uu+w > len-0.01) continue;
        if(!libre(uu, w, yb2, yb2+w*1.5)) continue;
        const cx = A[0]+ux*uu+ox, cz = A[1]+uz*uu+oz;
        pousserQuad([cx-ux*w, yb2, cz-uz*w], [cx+ux*w, yb2, cz+uz*w],
                    [cx+ux*w*0.7, yb2+w*1.5, cz+uz*w*0.7],
                    [cx-ux*w*0.7, yb2+w*1.5, cz-uz*w*0.7],
                    grain('#3f6b34', 0.70 + hash3(cle, m*37+k*13+f, 277)*0.50,
                          (hash3(cle, m*41+k*17+f, 283)-0.5)*0.30), dehors, false);
      }
    }
  }
}

/* Guirlandes tendues d'un toit à l'autre au-dessus des ruelles. Elles ne
   s'accrochent qu'à des bâtiments d'au moins deux niveaux, de hauteurs
   voisines, juste sous l'égout du toit ; le segment ne doit traverser aucun
   bâti, et chaque maison n'en porte pas plus de deux. */
function guirlandes(){
  const bat = cellules.filter(c => c.b.length >= 2 && !c.sp[c.b.length-1]);
  const AMPOULES = ['#ffd66e','#ff9d6e','#9ed7ff','#ffe9b0','#c7ff9e'];
  const degre = new Map();
  const paires = [];
  for(let i=0;i<bat.length;i++) for(let j=i+1;j<bat.length;j++){
    const a=bat[i], b=bat[j];
    if(Math.abs(a.b.length - b.b.length) > 1) continue;
    const dx=b.cx-a.cx, dz=b.cz-a.cz, d=Math.hypot(dx,dz);
    if(d < 1.2 || d > 2.15) continue;
    if(a.nb.includes(b)) continue;
    const mi = celluleEn((a.cx+b.cx)/2, (a.cz+b.cz)/2);
    if(mi && occ(mi, 0)) continue;                 // la ruelle doit être libre
    paires.push({a, b, d, cle:a.i*1000 + b.i});
  }
  paires.sort((p,q)=> hash3(p.cle,0,281) - hash3(q.cle,0,281));
  let posees = 0;
  for(const {a, b, cle} of paires){
    if(posees >= 7) break;
    if((degre.get(a.i)||0) >= 2 || (degre.get(b.i)||0) >= 2) continue;
    if(hash3(cle, 1, 293) > 0.55) continue;
    degre.set(a.i, (degre.get(a.i)||0)+1);
    degre.set(b.i, (degre.get(b.i)||0)+1);
    posees++;
    const dx=b.cx-a.cx, dz=b.cz-a.cz, d=Math.hypot(dx,dz);
    const ux=dx/d, uz=dz/d, marge = 0.30;
    const ax = a.cx + ux*marge, az = a.cz + uz*marge;
    const bx = b.cx - ux*marge, bz = b.cz - uz*marge;
    const ya = a.b.length*H - 0.10, yb = b.b.length*H - 0.10;
    const creux = 0.10 + d*0.11;
    ctx = {c:a, L:a.b.length-1, k:'toit', e:-1};
    const N = 9;
    let prec = null;
    for(let s2=0;s2<=N;s2++){
      const t = s2/N;
      const x = ax + (bx-ax)*t, z = az + (bz-az)*t;
      const y = ya + (yb-ya)*t - Math.sin(Math.PI*t)*creux;
      const pt = [x, y, z];
      if(prec) poutre(prec, pt, 0.008, teinte('#2f2c2a', 1));
      if(s2 > 0 && s2 < N){
        const coul = AMPOULES[Math.floor(hash3(cle, s2, 283)*AMPOULES.length)];
        lampeCourante = 2; lampeGroupe = 4 + (s2 % 2);
        boiteOr(x, z, 1, 0, 0.024, 0.024, y-0.055, y-0.012, teinte(coul, 1.5));
        lampeCourante = 0; lampeGroupe = 0;
      }
      prec = pt;
    }
  }
}

/* ---------- Fumées et toiles tendues -------------------------------------- */

let cheminees = [];

/* Fumée : quelques bouffées par cheminée, montant en boucle. La géométrie est
   bâtie une fois avec des décalages unitaires ; à chaque image on ne recalcule
   que la position et la taille de chaque bouffée. */
const BOUFFEES = 5;
const matFumee = new THREE.MeshBasicMaterial({
  vertexColors:true, transparent:true, opacity:0.30,
  depthWrite:false, fog:true
});
const meshFumee = new THREE.Mesh(new THREE.BufferGeometry(), matFumee);
meshFumee.renderOrder = 5;
meshFumee.frustumCulled = false;
scene.add(meshFumee);

let gabaritBouffee = null;       // décalages unitaires d'une bouffée
function gabarit(){
  if(gabaritBouffee) return gabaritBouffee;
  const N = 6, s = [];
  const anneau = [];
  for(let k=0;k<N;k++){
    const a = k/N*Math.PI*2;
    anneau.push([Math.cos(a)*0.9, 0, Math.sin(a)*0.9]);
  }
  const haut = [0, 1, 0], bas = [0, -0.85, 0];
  for(let k=0;k<N;k++){
    const A=anneau[k], B=anneau[(k+1)%N];
    s.push(A, B, haut, B, A, bas);
  }
  gabaritBouffee = s;
  return s;
}

function construireFumee(){
  const g = gabarit(), nv = g.length;
  const n = cheminees.length * BOUFFEES * nv;
  const p = new Float32Array(n*3), c = new Float32Array(n*3);
  let i = 0;
  for(let ch=0; ch<cheminees.length; ch++){
    for(let b=0;b<BOUFFEES;b++){
      const ton = 0.72 + hash3(ch, b, 449)*0.24;
      for(let v=0; v<nv; v++){
        c[i*3] = ton; c[i*3+1] = ton*0.98; c[i*3+2] = ton*0.95;
        i++;
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p,3));
  geo.setAttribute('color',    new THREE.BufferAttribute(c,3));
  meshFumee.geometry.dispose();
  meshFumee.geometry = geo;
  meshFumee.visible = cheminees.length > 0;
}

function animerFumee(temps){
  if(!cheminees.length) return;
  const g = gabarit(), nv = g.length;
  const p = meshFumee.geometry.attributes.position.array;
  let i = 0;
  for(let ch=0; ch<cheminees.length; ch++){
    const src = cheminees[ch];
    const F = src.force || 1;
    for(let b=0;b<BOUFFEES;b++){
      const u = ((temps*0.30*F + b/BOUFFEES + hash3(ch,b,457)) % 1);
      const taille = (0.035 + 0.20*u) * Math.min(1, u*6) * (1 - u*u) * F;
      const cx = src.x + Math.sin(temps*0.5 + ch + u*3.1)*0.16*u;
      const cy = src.y + 0.05 + u*1.25*F;
      const cz = src.z + Math.cos(temps*0.37 + ch*1.7 + u*2.6)*0.16*u;
      for(let v=0; v<nv; v++){
        const o = g[v];
        p[i*3]   = cx + o[0]*taille;
        p[i*3+1] = cy + o[1]*taille;
        p[i*3+2] = cz + o[2]*taille;
        i++;
      }
    }
  }
  meshFumee.geometry.attributes.position.needsUpdate = true;
}

/* Toiles tendues au-dessus des ruelles, à la manière d'un souk. Même
   recherche de paires que les guirlandes, mais plus bas et en bandes larges. */
function toiles(){
  const bat = cellules.filter(c => c.b.length >= 2 && !c.sp[c.b.length-1]);
  const RAYURES = ['#d9694f','#e8dcc0','#c9a24a','#e8dcc0','#7a9c8f','#e8dcc0'];
  const degre = new Map();
  const paires = [];
  for(let i=0;i<bat.length;i++) for(let j=i+1;j<bat.length;j++){
    const a=bat[i], b=bat[j];
    const dx=b.cx-a.cx, dz=b.cz-a.cz, d=Math.hypot(dx,dz);
    if(d < 1.15 || d > 2.1) continue;
    if(a.nb.includes(b)) continue;
    const mi = celluleEn((a.cx+b.cx)/2, (a.cz+b.cz)/2);
    if(mi && occ(mi, 0)) continue;
    paires.push({a, b, cle:a.i*1000 + b.i + 7});
  }
  paires.sort((p,q)=> hash3(p.cle,0,461) - hash3(q.cle,0,461));
  let posees = 0;
  for(const {a, b, cle} of paires){
    if(posees >= 4) break;
    if((degre.get(a.i)||0) >= 1 || (degre.get(b.i)||0) >= 1) continue;
    if(hash3(cle, 1, 463) > 0.45) continue;
    degre.set(a.i, 1); degre.set(b.i, 1);
    posees++;
    const dx=b.cx-a.cx, dz=b.cz-a.cz, d=Math.hypot(dx,dz);
    const ux=dx/d, uz=dz/d, px=-uz, pz=ux;
    const marge = 0.28, W = 0.30;
    const ax=a.cx+ux*marge, az=a.cz+uz*marge;
    const bx=b.cx-ux*marge, bz=b.cz-uz*marge;
    const y = Math.max(0.85, Math.min(a.b.length, b.b.length)*H - 0.55);
    const creux = 0.09 + d*0.06;
    ctx = {c:a, L:0, k:'toit', e:-1};
    const N = 8;
    const pt = (t, w) => {
      const x = ax + (bx-ax)*t + px*w, z = az + (bz-az)*t + pz*w;
      return [x, y - Math.sin(Math.PI*t)*creux - Math.abs(w)*0.10, z];
    };
    for(let k=0;k<N;k++){
      const t0=k/N, t1=(k+1)/N;
      const coul = RAYURES[k % RAYURES.length];
      pousserQuad(pt(t0,-W), pt(t1,-W), pt(t1,W), pt(t0,W),
                  grain(coul, 0.90 + hash3(cle,k,467)*0.18, 0), [0,1,0], false);
    }
    for(const w of [-W, W]){
      poutre(pt(0,w), [a.cx+ux*0.06, y+0.10, a.cz+uz*0.06], 0.008, teinte('#4a3a30',1));
      poutre(pt(1,w), [b.cx-ux*0.06, y+0.10, b.cz-uz*0.06], 0.008, teinte('#4a3a30',1));
    }
  }
}

/* ---------- Mobilier de rue et détails de façade -------------------------- */

/* Tourelle d'angle engagée dans une façade — le parti des châteaux bretons :
   un fût rond de pierre qui monte de terre, dépasse l'égout, et se termine soit
   par un chemin de ronde crénelé sur corbeaux, soit par une flèche d'ardoise.
   Elle est émise une fois pour tout le bâtiment, depuis son niveau haut, et
   descend jusqu'au sol : une tourelle qui commencerait à mi-hauteur ne tiendrait
   pas debout. */
function tourelle(c, L, i, A, B, base, cle){
  const len = dist2d(A,B);
  if(len < 0.50) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  let ox = (A[0]+B[0])/2 - c.cx, oz = (A[1]+B[1])/2 - c.cz;
  const dl = Math.hypot(ox,oz) || 1; ox/=dl; oz/=dl;
  const R = 0.155 + hash3(cle,0,929)*0.035, S = 0.10;
  const cx = (A[0]+B[0])/2 + ox*S, cz = (A[1]+B[1])/2 + oz*S;
  const N = 9;
  const pts = [];
  for(let k=0;k<N;k++){
    const a = k/N*Math.PI*2;
    pts.push([cx + (ux*Math.cos(a) + ox*Math.sin(a))*R,
              cz + (uz*Math.cos(a) + oz*Math.sin(a))*R]);
  }
  const yBas = SOL - 0.03;
  const yHaut = (L+1)*H + REHAUSSE + 0.22 + hash3(cle,1,937)*0.55;
  const pierre = melangeHex(base, '#9d9384', 0.62);
  ctx = {c, L, k:'mur', e:i};
  for(let k=0;k<N;k++){
    const a=pts[k], b=pts[(k+1)%N];
    const deh=[(a[0]+b[0])/2-cx, 0, (a[1]+b[1])/2-cz];
    if(deh[0]*ox + deh[2]*oz < -0.55) continue;      // face engagée dans le mur
    pave(a, b, yBas, yHaut, deh, pierre, cle*17+k, 0.115);
  }
  // meurtrières étagées
  for(let e2=0; e2<3; e2++){
    const y = 0.30 + e2*0.52;
    if(y > yHaut - 0.32) break;
    const k = (2 + e2*3) % N;
    const a=pts[k], b=pts[(k+1)%N];
    const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2;
    const d=[mx-cx, mz-cz], l=Math.hypot(d[0],d[1])||1;
    if((d[0]*ox + d[1]*oz)/l < 0.1) continue;
    boiteOr(mx+d[0]/l*0.012, mz+d[1]/l*0.012, d[0]/l, d[1]/l,
            0.012, 0.024, y, y+0.20, teinte('#2b2724',1));
  }
  ctx = {c, L, k:'toit', e:-1};
  if(hash3(cle, 2, 941) > 0.45){
    // chemin de ronde : corbeaux, parapet, merlons alternés
    for(let k=0;k<N;k++){
      const a=pts[k], d=[a[0]-cx, a[1]-cz], l=Math.hypot(d[0],d[1])||1;
      boiteOr(a[0]+d[0]/l*0.020, a[1]+d[1]/l*0.020, d[0]/l, d[1]/l, 0.032, 0.030,
              yHaut-0.115, yHaut-0.005, grain(pierre, 0.76, 0));
    }
    const EP=0.09, DEB=0.045, HB=0.13, HM=0.27;
    const ext = pts.map(a=>{ const d=[a[0]-cx,a[1]-cz], l=Math.hypot(d[0],d[1])||1;
      return [a[0]+d[0]/l*DEB, a[1]+d[1]/l*DEB]; });
    const int = pts.map(a=>{ const d=[a[0]-cx,a[1]-cz], l=Math.hypot(d[0],d[1])||1;
      return [a[0]-d[0]/l*(EP-DEB), a[1]-d[1]/l*(EP-DEB)]; });
    for(let k=0;k<N;k++){
      const k2=(k+1)%N, h = k%2 ? HM : HB;
      const a=ext[k], b=ext[k2], p=int[k], q=int[k2];
      const deh=[(a[0]+b[0])/2-cx, 0, (a[1]+b[1])/2-cz];
      pousserQuad([int[k][0],yHaut,int[k][1]], [int[k2][0],yHaut,int[k2][1]],
                  [cx,yHaut,cz], [cx,yHaut,cz], grain('#8d8474', 0.9, 0), [0,1,0], false);
      pousserQuad([a[0],yHaut-0.005,a[1]], [b[0],yHaut-0.005,b[1]],
                  [b[0],yHaut+h,b[1]], [a[0],yHaut+h,a[1]],
                  grain(pierre, 0.92, 0), deh, false);
      pousserQuad([p[0],yHaut,p[1]], [q[0],yHaut,q[1]],
                  [q[0],yHaut+h,q[1]], [p[0],yHaut+h,p[1]],
                  grain(pierre, 0.70, 0), [-deh[0],0,-deh[2]], false);
      pousserQuad([a[0],yHaut+h,a[1]], [b[0],yHaut+h,b[1]],
                  [q[0],yHaut+h,q[1]], [p[0],yHaut+h,p[1]],
                  grain(pierre, 1.06, 0), [0,1,0], false);
      const hs = (k2%2) ? HM : HB;
      if(hs !== h){
        const bas=Math.min(h,hs), ht=Math.max(h,hs);
        pousserQuad([b[0],yHaut+bas,b[1]], [q[0],yHaut+bas,q[1]],
                    [q[0],yHaut+ht,q[1]], [b[0],yHaut+ht,b[1]],
                    grain(pierre, 0.80, 0), [b[0]-q[0],0,b[1]-q[1]], false);
      }
    }
  }else{
    // flèche d'ardoise à fort dévers, larmier et épi
    const H2 = 0.42 + hash3(cle,3,947)*0.34, som=[cx, yHaut+H2, cz];
    const ext = pts.map(a=>{ const d=[a[0]-cx,a[1]-cz], l=Math.hypot(d[0],d[1])||1;
      return [a[0]+d[0]/l*0.045, a[1]+d[1]/l*0.045]; });
    coneTuile(cx, cz, pts, yHaut, som, '#6b7a82', cle*11, 0.045);
    for(let k=0;k<N;k++){
      const k2=(k+1)%N, a=ext[k], b=ext[k2];
      pousserQuad([pts[k][0],yHaut-0.04,pts[k][1]], [pts[k2][0],yHaut-0.04,pts[k2][1]],
                  [b[0],yHaut,b[1]], [a[0],yHaut,a[1]],
                  teinte('#5a666d', 0.9), [0,-1,0], false);
    }
    poutre([cx, yHaut+H2-0.02, cz], [cx, yHaut+H2+0.14, cz], 0.012, teinte('#3b3a3f',1));
    boiteOr(cx, cz, 1, 0, 0.026, 0.026, yHaut+H2+0.09, yHaut+H2+0.15, teinte('#c9a227',1));
  }
}

/* Escalier extérieur desservant une porte du premier. Volée droite le long du
   mur, palier devant la porte, garde-corps. Elle s'arrête si le mur est trop
   court pour la porter. */
function escalierExterieur(A, B, y0, o, dehors, cle){
  const len = dist2d(A,B);
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl, oz = dehors[2]/dl;
  const uc = (o.u0+o.u1)/2, sens = hash3(cle, 0, 823) > 0.5 ? 1 : -1;
  const yh = y0 + o.b;                      // seuil
  const course = 0.62;
  const dep = uc + sens*0.16;
  if(dep + sens*course < 0.02 || dep + sens*course > len-0.02) return;
  const P2 = (u, d, y) => [A[0]+ux*u + ox*d, y, A[1]+uz*u + oz*d];
  const N = 7, prof = 0.28, W = (o.u1-o.u0)/2 + 0.06;
  const pierre = '#9d9384';
  for(let k=0;k<N;k++){
    const t0 = k/N, t1 = (k+1)/N;
    const u0 = dep + sens*course*(1-t1), u1 = dep + sens*course*(1-t0);
    const ya = SOL + (yh-SOL)*t1;
    const a=P2(Math.min(u0,u1),0.02,0), b=P2(Math.max(u0,u1),0.02,0);
    const c2=P2(Math.max(u0,u1),prof,0), d2=P2(Math.min(u0,u1),prof,0);
    pousserQuad([a[0],ya,a[2]], [b[0],ya,b[2]], [c2[0],ya,c2[2]], [d2[0],ya,d2[2]],
                grain(pierre, 0.92+hash3(cle,k,827)*0.2, 0), [0,1,0], false);
    const yb2 = SOL + (yh-SOL)*t0;
    pousserQuad([a[0],yb2,a[2]], [b[0],yb2,b[2]], [b[0],ya,b[2]], [a[0],ya,a[2]],
                grain(pierre, 0.74+hash3(cle,k,829)*0.16, 0),
                [sens*ux, 0, sens*uz], false);
    pousserQuad([d2[0],yb2,d2[2]], [c2[0],yb2,c2[2]], [c2[0],ya,c2[2]], [d2[0],ya,d2[2]],
                grain(pierre, 0.80, 0), dehors, false);
  }
  // palier devant la porte
  const pa=P2(uc-W,0.02,0), pb=P2(uc+W,0.02,0), pc=P2(uc+W,prof,0), pd=P2(uc-W,prof,0);
  pousserQuad([pa[0],yh,pa[2]], [pb[0],yh,pb[2]], [pc[0],yh,pc[2]], [pd[0],yh,pd[2]],
              grain(pierre, 1.02, 0), [0,1,0], false);
  pousserQuad([pd[0],yh-0.055,pd[2]], [pc[0],yh-0.055,pc[2]],
              [pc[0],yh,pc[2]], [pd[0],yh,pd[2]], teinte(pierre,0.78), dehors, false);
  // garde-corps de bois le long de la volée
  const fer = teinte('#5a4632',1);
  for(let k=0;k<=4;k++){
    const t = k/4;
    const u = dep + sens*course*(1-t);
    const q = P2(u, prof-0.02, 0);
    poutre([q[0], SOL+(yh-SOL)*t, q[2]], [q[0], SOL+(yh-SOL)*t+0.32, q[2]], 0.016, fer);
  }
  const q0=P2(dep, prof-0.02, 0), q1=P2(uc+W*0.9, prof-0.02, 0);
  poutre([q0[0], SOL+0.32, q0[2]], [q1[0], yh+0.32, q1[2]], 0.018, fer);
}

/* Blason accroché en façade : écu à deux émaux, potence de fer. */
function blason(A, B, y0, dehors, cle, ouvs){
  const len = dist2d(A,B);
  if(len < 0.45) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl, oz = dehors[2]/dl;
  let u = -1, mieux = 0;
  for(const t of [0.2, 0.35, 0.65, 0.8]){
    const uu = len*t;
    let d = 9;
    for(const o of ouvs) d = Math.min(d, Math.abs(uu-(o.u0+o.u1)/2) - (o.u1-o.u0)/2);
    if(d > mieux){ mieux = d; u = uu; }
  }
  if(u < 0 || mieux < 0.09) return;
  const EMAUX = ['#a83a34','#2f5a9c','#c9a227','#3f7a4a','#5a3a7a','#e8e2d4'];
  const c1 = EMAUX[Math.floor(hash3(cle,1,487)*EMAUX.length)];
  const c2 = EMAUX[Math.floor(hash3(cle,2,491)*EMAUX.length)];
  const y = y0 + 0.44, W = 0.055, Ht = 0.075;
  const p = (du, dy, d) => [A[0]+ux*(u+du)+ox*d, y+dy, A[1]+uz*(u+du)+oz*d];
  poutre(p(0,0.10,0.01), p(0,0.10,0.05), 0.007, teinte('#33323a',1));
  poutre(p(0,0.10,0.045), p(0,0.008,0.045), 0.006, teinte('#33323a',1));
  // écu : deux moitiés verticales, pointe en bas
  for(const [dua, dub, coul] of [[-W,0,c1],[0,W,c2]]){
    pousserQuad(p(dua,0,0.052), p(dub,0,0.052), p(dub,-Ht,0.052), p(dua,-Ht,0.052),
                grain(coul, 1.02, 0), dehors, false);
    pousserQuad(p(dua,-Ht,0.052), p(dub,-Ht,0.052), p(0,-Ht-0.055,0.052), p(0,-Ht-0.055,0.052),
                grain(coul, 0.92, 0), dehors, false);
  }
  boiteOr(A[0]+ux*u+ox*0.046, A[1]+uz*u+oz*0.046, ox, oz, 0.006, W+0.008,
          y-Ht-0.058, y+0.004, teinte('#4a4038',1));
}

/* Petits encombrements au pied des murs : tonneaux, caisses, paniers, bûches,
   banc, palissade ou perron. Le point d'appui est choisi à l'écart des baies. */
function pieDeMur(A, B, y0, dehors, cle, ouvs){
  const len = dist2d(A,B);
  if(len < 0.45) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl, oz = dehors[2]/dl;
  const porte = ouvs.find(o => o.porte);
  const sorte = Math.floor(hash3(cle, 1, 499)*13);
  const y = SOL;

  // perron devant une porte, sinon un encombrement à l'écart des baies
  if(porte && sorte === 6){
    const uc = (porte.u0 + porte.u1)/2, w = (porte.u1-porte.u0)/2 + 0.05;
    for(let k=0;k<3;k++){
      const d = 0.05 + k*0.075, h = 0.075 - k*0.025;
      const P = (du, dd) => [A[0]+ux*(uc+du)+ox*dd, 0, A[1]+uz*(uc+du)+oz*dd];
      const a=P(-w,d), b=P(w,d), c2=P(w,d+0.075), d2=P(-w,d+0.075);
      pousserQuad([a[0],y,a[2]], [b[0],y,b[2]], [b[0],y+h,b[2]], [a[0],y+h,a[2]],
                  grain('#9d9384', 0.86+hash3(cle,k,503)*0.22, 0), dehors, false);
      pousserQuad([a[0],y+h,a[2]], [b[0],y+h,b[2]], [c2[0],y+h,c2[2]], [d2[0],y+h,d2[2]],
                  grain('#a9a094', 0.9, 0), [0,1,0], false);
    }
    return;
  }

  let u = -1, mieux = 0;
  for(const t of [0.13, 0.27, 0.73, 0.87]){
    const uu = len*t;
    let d = 9;
    for(const o of ouvs) d = Math.min(d, Math.abs(uu-(o.u0+o.u1)/2) - (o.u1-o.u0)/2);
    if(d > mieux){ mieux = d; u = uu; }
  }
  if(u < 0 || mieux < 0.11) return;
  const X = (du, dd) => A[0]+ux*(u+du)+ox*(0.10+dd);
  const Z = (du, dd) => A[1]+uz*(u+du)+oz*(0.10+dd);

  if(sorte === 0){                                  // tonneaux
    for(let k=0;k<2;k++){
      const du = -0.055 + k*0.11, h = 0.16 + hash3(cle,k,509)*0.05;
      boiteOr(X(du,0), Z(du,0), ox, oz, 0.052, 0.052, y, y+h, teinte('#7a5a3a',1));
      boiteOr(X(du,0), Z(du,0), ox, oz, 0.056, 0.056, y+h*0.32, y+h*0.42,
              teinte('#4a4038',1));
      boiteOr(X(du,0), Z(du,0), ox, oz, 0.044, 0.044, y+h, y+h+0.012,
              teinte('#8a6a4e',1));
    }
  }else if(sorte === 1){                            // caisses empilées
    boiteOr(X(-0.03,0), Z(-0.03,0), ox, oz, 0.065, 0.065, y, y+0.13, teinte('#a8845c',1));
    boiteOr(X(0.075,0.01), Z(0.075,0.01), ox, oz, 0.05, 0.05, y, y+0.10, teinte('#96764f',1));
    boiteOr(X(-0.02,0.005), Z(-0.02,0.005), ox, oz, 0.05, 0.05, y+0.13, y+0.22,
            teinte('#b08d64',1));
  }else if(sorte === 2){                            // paniers et sac
    for(let k=0;k<2;k++){
      const du=-0.05+k*0.10;
      boiteOr(X(du,0), Z(du,0), ox, oz, 0.042, 0.042, y, y+0.09, teinte('#b09054',1));
      boiteOr(X(du,0), Z(du,0), ox, oz, 0.048, 0.048, y+0.09, y+0.105,
              teinte('#9a7c46',1));
    }
    boiteOr(X(0.10,0.02), Z(0.10,0.02), ox, oz, 0.05, 0.045, y, y+0.13,
            teinte('#d8cbaa',1));
  }else if(sorte === 3){                            // bûches empilées
    for(let r=0;r<3;r++) for(let k=0;k<3;k++){
      const du = -0.07 + k*0.07;
      poutre([X(du,0.005), y+0.03+r*0.055, Z(du,0.005)],
             [X(du,0.115), y+0.03+r*0.055, Z(du,0.115)], 0.026,
             grain('#8a6a4e', 0.82+hash3(cle,r*5+k,521)*0.32, 0));
    }
  }else if(sorte === 4){                            // banc et pot
    boiteOr(X(0,0), Z(0,0), ox, oz, 0.045, 0.14, y+0.10, y+0.125, teinte('#8a6a4e',1));
    for(const e of [-0.105, 0.105])
      poutre([X(e,0), y, Z(e,0)], [X(e,0), y+0.10, Z(e,0)], 0.016, teinte('#6b5744',1));
    boiteOr(X(0.20,0.01), Z(0.20,0.01), ox, oz, 0.045, 0.045, y, y+0.08,
            teinte('#a86f4e',1));
    boiteOr(X(0.20,0.01), Z(0.20,0.01), ox, oz, 0.038, 0.038, y+0.08, y+0.14,
            grain('#4f7f45', 0.9, 0));
  }else if(sorte === 7){                            // buisson taillé
    for(let k=0;k<3;k++){
      const du = -0.08 + k*0.08, r = 0.055 + hash3(cle,k,1237)*0.025;
      const h = 0.10 + hash3(cle,k,1249)*0.09;
      boiteOr(X(du,0), Z(du,0), ox, oz, r*0.55, r*0.55, y, y+0.03,
              teinte('#6b563f',1));
      boiteOr(X(du,0), Z(du,0), ox, oz, r, r, y+0.03, y+0.03+h,
              grain('#4f7f45', 0.84+hash3(cle,k,1259)*0.32, (hash3(cle,k,1277)-0.5)*0.2));
      boiteOr(X(du,0), Z(du,0), ox, oz, r*0.72, r*0.72, y+0.03+h, y+0.06+h,
              grain('#5c8a4e', 0.94, 0.06));
    }
  }else if(sorte === 8){                            // jardinière fleurie
    boiteOr(X(0,0), Z(0,0), ox, oz, 0.05, 0.155, y, y+0.085, teinte('#8a6a4e',1));
    boiteOr(X(0,0), Z(0,0), ox, oz, 0.055, 0.16, y+0.085, y+0.10, teinte('#7a5c42',1));
    const FLEURS = ['#d4506a','#e8a33d','#c56d8f','#e8dc6a','#e2e2e2'];
    for(let k=0;k<5;k++){
      const du = -0.115 + k*0.058;
      boiteOr(X(du,0), Z(du,0), ox, oz, 0.026, 0.026, y+0.10, y+0.155,
              grain('#4f7f45', 0.9+hash3(cle,k,1283)*0.2, 0));
      boiteOr(X(du,0), Z(du,0), ox, oz, 0.020, 0.020, y+0.155, y+0.185,
              grain(FLEURS[Math.floor(hash3(cle,k,1289)*FLEURS.length)], 1.0, 0));
    }
  }else if(sorte === 9){                            // banc à planches
    const bois = teinte('#8a6a4e',1), fer = teinte('#4a4038',1);
    for(const e of [-0.13, 0.13]){
      poutre([X(e,0.02), y, Z(e,0.02)], [X(e,0.02), y+0.11, Z(e,0.02)], 0.016, fer);
      poutre([X(e,0.14), y, Z(e,0.14)], [X(e,0.14), y+0.11, Z(e,0.14)], 0.016, fer);
      poutre([X(e,0.02), y+0.11, Z(e,0.02)], [X(e,0.14), y+0.11, Z(e,0.14)], 0.014, fer);
      poutre([X(e,0.02), y+0.11, Z(e,0.02)], [X(e,0.02), y+0.30, Z(e,0.02)], 0.014, fer);
    }
    for(let k=0;k<3;k++){        // assise : trois planches
      const d = 0.035 + k*0.042;
      poutre([X(-0.155,d), y+0.115, Z(-0.155,d)], [X(0.155,d), y+0.115, Z(0.155,d)],
             0.019, grain('#8a6a4e', 0.9+hash3(cle,k,1291)*0.2, 0));
    }
    for(let k=0;k<2;k++){        // dossier : deux lattes
      const h = 0.20 + k*0.075;
      poutre([X(-0.155,0.025), y+h, Z(-0.155,0.025)], [X(0.155,0.025), y+h, Z(0.155,0.025)],
             0.017, grain('#8a6a4e', 0.88+hash3(cle,k,1297)*0.2, 0));
    }
  }else if(sorte === 10){                           // échelle appuyée
    const bois = teinte('#9a7a55',1);
    const hE = 0.62;
    for(const e of [-0.055, 0.055]){
      poutre([X(e,0.20), y, Z(e,0.20)], [X(e,0.02), y+hE, Z(e,0.02)], 0.012, bois);
    }
    for(let k=0;k<6;k++){
      const t = 0.08 + k*0.16;
      poutre([X(-0.055,0.20-0.18*t), y+hE*t, Z(-0.055,0.20-0.18*t)],
             [X(0.055,0.20-0.18*t), y+hE*t, Z(0.055,0.20-0.18*t)], 0.008, bois);
    }
  }else if(sorte === 11){                           // abreuvoir de pierre
    boiteOr(X(0,0.03), Z(0,0.03), ox, oz, 0.055, 0.14, y, y+0.115,
            grain('#9d9384', 0.94, 0));
    boiteOr(X(0,0.03), Z(0,0.03), ox, oz, 0.040, 0.125, y+0.09, y+0.105,
            teinte('#5f8f95', 1.1));
    boiteOr(X(0.17,0.03), Z(0.17,0.03), ox, oz, 0.030, 0.030, y, y+0.20,
            teinte('#8f8c83',1));
  }else{                                            // palissade
    const n = 5;
    for(let k=0;k<n;k++){
      const du = -0.16 + k*0.08;
      const h = 0.24 + hash3(cle,k,523)*0.06;
      poutre([X(du,0.02), y, Z(du,0.02)], [X(du,0.02), y+h, Z(du,0.02)], 0.019,
             grain('#7a6248', 0.84+hash3(cle,k,541)*0.3, 0));
    }
    poutre([X(-0.17,0.04), y+0.15, Z(-0.17,0.04)], [X(0.17,0.04), y+0.15, Z(0.17,0.04)],
           0.013, teinte('#6b5744',1));
  }
}

/* Fontaine : vasque octogonale, colonne et vasque haute. */
function fontaine(c){
  const y = SOL, cx = c.cx, cz = c.cz;
  ctx = {c, L:0, k:'terre', e:-1};
  const N = 8, R = 0.30, EP = 0.05;
  const pierre = '#a49a8a';
  for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2, b=(k+1)/N*Math.PI*2;
    const A=[cx+Math.cos(a)*R, cz+Math.sin(a)*R], B=[cx+Math.cos(b)*R, cz+Math.sin(b)*R];
    const A2=[cx+Math.cos(a)*(R-EP), cz+Math.sin(a)*(R-EP)];
    const B2=[cx+Math.cos(b)*(R-EP), cz+Math.sin(b)*(R-EP)];
    const coul = grain(pierre, 0.86+hash3(c.i,k,547)*0.24, (hash3(c.i,k,557)-0.5)*0.18);
    pousserQuad([A[0],y,A[1]], [B[0],y,B[1]], [B[0],y+0.19,B[1]], [A[0],y+0.19,A[1]],
                coul, [Math.cos(a),0,Math.sin(a)], false);
    pousserQuad([A2[0],y+0.06,A2[1]], [B2[0],y+0.06,B2[1]],
                [B2[0],y+0.19,B2[1]], [A2[0],y+0.19,A2[1]],
                teinte(pierre,0.66), [-Math.cos(a),0,-Math.sin(a)], false);
    pousserQuad([A[0],y+0.19,A[1]], [B[0],y+0.19,B[1]],
                [B2[0],y+0.19,B2[1]], [A2[0],y+0.19,A2[1]],
                teinte(pierre,1.06), [0,1,0], false);
    pousserQuad([A2[0],y+0.145,A2[1]], [B2[0],y+0.145,B2[1]],
                [cx,y+0.145,cz], [cx,y+0.145,cz],
                teinte('#5f8f95', 1.1), [0,1,0], false);
  }
  boiteOr(cx, cz, 1, 0, 0.055, 0.055, y+0.14, y+0.48, teinte(pierre,0.94));
  for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2, b=(k+1)/N*Math.PI*2, r=0.14;
    const A=[cx+Math.cos(a)*r, cz+Math.sin(a)*r], B=[cx+Math.cos(b)*r, cz+Math.sin(b)*r];
    pousserQuad([A[0],y+0.44,A[1]], [B[0],y+0.44,B[1]],
                [B[0],y+0.53,B[1]], [A[0],y+0.53,A[1]],
                teinte(pierre,1.0), [Math.cos(a),0,Math.sin(a)], false);
    pousserQuad([A[0],y+0.52,A[1]], [B[0],y+0.52,B[1]], [cx,y+0.52,cz], [cx,y+0.52,cz],
                teinte('#5f8f95', 1.15), [0,1,0], false);
  }
}

/* ---------- Cheminées ------------------------------------------------------
   Quatre partis différents, tirés par empreinte : brique à corniche encorbelée,
   souche de pierre à larmier, conduit coiffé d'une mitre sur poteaux, et souche
   large à deux pots. Le fût est appareillé comme les murs, avec un fruit léger,
   et chaque type reçoit sa corniche — c'est ce ressaut qui fait qu'une souche
   se lit comme une souche et non comme une boîte posée sur le toit. */

function futChem(cx, cz, dx, dz, lx, lz, y0, y1, base, cle){
  const px=-dz, pz=dx;
  const s = [[cx+dx*lx+px*lz, cz+dz*lx+pz*lz], [cx+dx*lx-px*lz, cz+dz*lx-pz*lz],
             [cx-dx*lx-px*lz, cz-dz*lx-pz*lz], [cx-dx*lx+px*lz, cz-dz*lx+pz*lz]];
  for(let i=0;i<4;i++){
    const A=s[i], B=s[(i+1)%4];
    pave(A, B, y0, y1, [(A[0]+B[0])/2-cx, 0, (A[1]+B[1])/2-cz], base, cle+i*17, 0.10);
  }
  pousserQuad([s[0][0],y1,s[0][1]], [s[1][0],y1,s[1][1]],
              [s[2][0],y1,s[2][1]], [s[3][0],y1,s[3][1]],
              teinte('#241f1c', 1), [0,1,0], false);
  return s;
}

/* Pot de terre cuite : prisme à huit pans, légèrement conique. */
function potChem(cx, cz, r0, r1, y0, y1, base, cle){
  const N = 8;
  for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2, b=(k+1)/N*Math.PI*2;
    const A=[cx+Math.cos(a)*r0, cz+Math.sin(a)*r0], B=[cx+Math.cos(b)*r0, cz+Math.sin(b)*r0];
    const C=[cx+Math.cos(b)*r1, cz+Math.sin(b)*r1], D=[cx+Math.cos(a)*r1, cz+Math.sin(a)*r1];
    pousserQuad([A[0],y0,A[1]], [B[0],y0,B[1]], [C[0],y1,C[1]], [D[0],y1,D[1]],
                grain(base, 0.86 + hash3(cle,k,743)*0.28, (hash3(cle,k,751)-0.5)*0.22),
                [Math.cos(a),0,Math.sin(a)], false);
  }
  // gorge du conduit, puis fond noir : sans lui on voyait à travers la souche
  for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2, b=(k+1)/N*Math.PI*2, r=r1*0.62;
    const A=[cx+Math.cos(a)*r1, cz+Math.sin(a)*r1], B=[cx+Math.cos(b)*r1, cz+Math.sin(b)*r1];
    const C=[cx+Math.cos(b)*r, cz+Math.sin(b)*r], D=[cx+Math.cos(a)*r, cz+Math.sin(a)*r];
    pousserQuad([A[0],y1,A[1]], [B[0],y1,B[1]], [C[0],y1-0.012,C[1]], [D[0],y1-0.012,D[1]],
                teinte('#2b2724', 1), [0,1,0], false);
    pousserQuad([C[0],y1-0.012,C[1]], [D[0],y1-0.012,D[1]],
                [cx,y1-0.055,cz], [cx,y1-0.055,cz],
                teinte('#161311', 1), [0,1,0], false);
  }
}

const MUR_CHEM = ['#a94a38','#b25a44','#8f5548','#9a6b52'];
const PIERRE_CHEM = ['#a9a094','#b3aa9d','#9c948a'];

function cheminee(cx, cz, dx, dz, yBas, cle){
  const style = Math.floor(hash3(cle, 0, 757)*4);
  const h = 0.30 + hash3(cle, 1, 761)*0.34;
  const dl = Math.hypot(dx,dz) || 1;
  dx/=dl; dz/=dl;
  let sommet;

  if(style === 0){                      // brique, corniche à deux ressauts
    const base = MUR_CHEM[Math.floor(hash3(cle,2,769)*MUR_CHEM.length)];
    const l = 0.095 + hash3(cle,3,773)*0.03;
    futChem(cx, cz, dx, dz, l, l, yBas, yBas+h, base, cle);
    boiteOr(cx, cz, dx, dz, l*1.20, l*1.20, yBas+h, yBas+h+0.035, teinte(base, 0.82));
    boiteOr(cx, cz, dx, dz, l*1.34, l*1.34, yBas+h+0.035, yBas+h+0.065, teinte(base, 1.06));
    potChem(cx, cz, l*0.78, l*0.66, yBas+h+0.065, yBas+h+0.20, '#8f4a30', cle);
    sommet = yBas+h+0.20;

  }else if(style === 1){                // souche de pierre, larmier et dalle
    const base = PIERRE_CHEM[Math.floor(hash3(cle,2,769)*PIERRE_CHEM.length)];
    const l = 0.11 + hash3(cle,3,773)*0.035;
    futChem(cx, cz, dx, dz, l, l, yBas, yBas+h, base, cle);
    boiteOr(cx, cz, dx, dz, l*1.26, l*1.26, yBas+h, yBas+h+0.028, teinte(base, 0.80));
    boiteOr(cx, cz, dx, dz, l*1.40, l*1.40, yBas+h+0.028, yBas+h+0.050, teinte(base, 1.08));
    boiteOr(cx, cz, dx, dz, l*0.72, l*0.72, yBas+h+0.050, yBas+h+0.075, teinte('#2b2724',1));
    sommet = yBas+h+0.075;

  }else if(style === 2){                // conduit coiffé d'une mitre
    const base = MUR_CHEM[Math.floor(hash3(cle,2,769)*MUR_CHEM.length)];
    const l = 0.085 + hash3(cle,3,773)*0.02;
    futChem(cx, cz, dx, dz, l, l, yBas, yBas+h, base, cle);
    boiteOr(cx, cz, dx, dz, l*1.28, l*1.28, yBas+h, yBas+h+0.035, teinte(base, 0.86));
    const px=-dz, pz=dx, hp = yBas+h+0.035;
    for(const [a,b] of [[1,1],[1,-1],[-1,-1],[-1,1]]){
      const x=cx+dx*l*a+px*l*b, z=cz+dz*l*a+pz*l*b;
      poutre([x,hp,z], [x,hp+0.085,z], 0.014, teinte('#3b3a3f',1));
    }
    boiteOr(cx, cz, dx, dz, l*1.42, l*1.42, hp+0.085, hp+0.11, teinte('#5b5f66',1));
    boiteOr(cx, cz, dx, dz, l*0.95, l*0.95, hp+0.11, hp+0.145, teinte('#4a4e55',1));
    sommet = hp+0.145;

  }else{                                // souche large, deux pots
    const base = MUR_CHEM[Math.floor(hash3(cle,2,769)*MUR_CHEM.length)];
    const lx = 0.075, lz = 0.155 + hash3(cle,3,773)*0.04;
    futChem(cx, cz, dx, dz, lx, lz, yBas, yBas+h, base, cle);
    boiteOr(cx, cz, dx, dz, lx*1.30, lz*1.14, yBas+h, yBas+h+0.032, teinte(base, 0.82));
    boiteOr(cx, cz, dx, dz, lx*1.46, lz*1.22, yBas+h+0.032, yBas+h+0.060, teinte(base, 1.06));
    const px=-dz, pz=dx;
    for(const e of [-1, 1]){
      potChem(cx + px*lz*0.52*e, cz + pz*lz*0.52*e, 0.048, 0.040,
              yBas+h+0.060, yBas+h+0.185, '#8f4a30', cle+e*7);
    }
    sommet = yBas+h+0.185;
  }
  return sommet;
}

/* ---------- Mouettes -------------------------------------------------------
   Elles tournent au-dessus du bourg, descendent se poser sur un faîtage, y
   restent un moment, puis repartent. Comme pour la fumée, la géométrie est
   bâtie une fois en repère local et seules les positions sont recalculées par
   image : cela permet de battre des ailes sans multiplier les objets. */
const NB_MOUETTES = 4;   // quatre suffisent : au-delà, le ciel s'agite trop
let perchoirs = [];
const matMouettes = new THREE.MeshLambertMaterial({
  vertexColors:true, side:THREE.DoubleSide
});
const meshMouettes = new THREE.Mesh(new THREE.BufferGeometry(), matMouettes);
meshMouettes.castShadow = false;
meshMouettes.frustumCulled = false;
scene.add(meshMouettes);

/* Gabarit : sommets en repère local (x vers l'avant, y vers le haut, z vers
   la droite), accompagnés de leur envergure signée — c'est elle qui pilote le
   battement, nulle au corps, maximale au bout de l'aile. */
let gabaritMouette = null;
function construireMouette(){
  if(gabaritMouette) return gabaritMouette;
  const V = [], C = [], E = [];
  const BLANC = lin('#f4f3ee'), GRIS = lin('#9fadb6'),
        NOIR = lin('#3a3f45'), BEC = lin('#e8a53a');
  const tri = (a,b,c,col,env)=>{ V.push(a,b,c); C.push(col,col,col); E.push(...env); };
  const quad = (a,b,c,d,col,env)=>{ tri(a,b,c,col,[env[0],env[1],env[2]]);
                                    tri(a,c,d,col,[env[0],env[2],env[3]]); };

  /* Corps d'un seul tenant. La version précédente posait une tête sphérique
     sur un fuselage : les deux volumes ne se rejoignaient pas et l'oiseau
     paraissait décapité de trois quarts. C'est maintenant un tube lissé — une
     suite d'anneaux dont le rayon et la hauteur d'axe varient — qui enchaîne
     tête, cou, poitrine et croupion sans rupture. */
  const N = 5;
  const stations = [                       // x, rayon, hauteur de l'axe
    [-0.052, 0.005, 0.022], [-0.046, 0.013, 0.023], [-0.036, 0.015, 0.020],
    [-0.026, 0.011, 0.013], [-0.010, 0.017, 0.005], [ 0.010, 0.018, 0.000],
    [ 0.034, 0.013, 0.002], [ 0.052, 0.006, 0.005]
  ];
  const anneau = ([x, r, y]) => {
    const p = [];
    for(let k=0;k<N;k++){
      const a = k/N*Math.PI*2 + Math.PI/2;
      p.push([x, y + Math.sin(a)*r*0.88, Math.cos(a)*r]);
    }
    return p;
  };
  const AN = stations.map(anneau);
  for(let s2=0; s2<AN.length-1; s2++){
    const col = s2 >= 4 && s2 <= 5 ? GRIS : BLANC;   // manteau gris sur le dos
    for(let k=0;k<N;k++){
      const k2=(k+1)%N;
      quad(AN[s2][k], AN[s2][k2], AN[s2+1][k2], AN[s2+1][k], col, [0,0,0,0]);
    }
  }
  const nez = [-0.058, 0.022, 0], queue = [0.062, 0.006, 0];
  for(let k=0;k<N;k++){
    const k2=(k+1)%N;
    tri(AN[0][k2], AN[0][k], nez, BLANC, [0,0,0]);
    tri(AN[AN.length-1][k], AN[AN.length-1][k2], queue, GRIS, [0,0,0]);
  }
  // bec, dans le prolongement du nez
  quad([-0.056, 0.024, 0.005], [-0.086, 0.018, 0.002],
       [-0.086, 0.012, -0.002], [-0.056, 0.017, -0.005], BEC, [0,0,0,0]);
  // queue en éventail
  quad([0.048, 0.006, 0.008], [0.086, 0.010, 0.034],
       [0.090, 0.010, 0], [0.086, 0.010, -0.034], GRIS, [0,0,0,0]);
  // ailes : trois panneaux, bout noir
  for(const sg of [-1, 1]){
    const bord  = [[0.006, 0.018], [-0.006, 0.070], [-0.024, 0.126], [-0.042, 0.162]];
    const fuite = [[0.048, 0.018], [0.042, 0.070], [0.026, 0.126], [0.002, 0.162]];
    for(let k=0;k<3;k++){
      quad([bord[k][0], 0, sg*bord[k][1]], [bord[k+1][0], 0, sg*bord[k+1][1]],
           [fuite[k+1][0], 0, sg*fuite[k+1][1]], [fuite[k][0], 0, sg*fuite[k][1]],
           k === 2 ? GRIS : BLANC,
           [sg*bord[k][1], sg*bord[k+1][1], sg*fuite[k+1][1], sg*fuite[k][1]]);
    }
    quad([bord[3][0], 0, sg*bord[3][1]], [-0.050, 0, sg*0.188],
         [-0.022, 0, sg*0.192], [fuite[3][0], 0, sg*fuite[3][1]],
         NOIR, [sg*bord[3][1], sg*0.188, sg*0.192, sg*fuite[3][1]]);
  }
  gabaritMouette = {V, C, E};
  return gabaritMouette;
}

function majMouettes(){
  const G = construireMouette();
  const n = NB_MOUETTES * G.V.length;
  const p = new Float32Array(n*3), c = new Float32Array(n*3);
  let i = 0;
  for(let m=0;m<NB_MOUETTES;m++)
    for(const col of G.C){ c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; i++; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p,3));
  geo.setAttribute('color',    new THREE.BufferAttribute(c,3));
  meshMouettes.geometry.dispose();
  meshMouettes.geometry = geo;
  meshMouettes.visible = true;
}

function animerMouettes(temps){
  const G = construireMouette();
  const p = meshMouettes.geometry.attributes.position.array;
  const nv = G.V.length;
  let i = 0;
  for(let m=0;m<NB_MOUETTES;m++){
    const T = 26 + hash3(m, 1, 863)*22;
    const u = ((temps + hash3(m, 2, 877)*T) % T) / T;
    const perche = perchoirs.length
      ? perchoirs[Math.floor(hash3(m, 3, 881)*perchoirs.length)] : null;

    // trajectoire circulaire au-dessus du bourg
    const R = 4.2 + hash3(m, 4, 883)*3.4;
    const alt = 2.6 + hash3(m, 5, 887)*1.6;
    const sens = hash3(m, 6, 907) > 0.5 ? 1 : -1;
    const vol = (t)=>{
      const a = sens*(t*Math.PI*2*1.6 + hash3(m,7,911)*6.28);
      return [Math.cos(a)*R, alt + Math.sin(a*2)*0.28, Math.sin(a)*R];
    };
    let pos3, cap, bat;
    if(!perche || u < 0.52){                       // en vol
      const q = vol(u), q2 = vol(u + 0.004);
      pos3 = q; cap = Math.atan2(q2[2]-q[2], q2[0]-q[0]);
      bat = Math.sin(temps*7.5 + m)*0.55;
    }else if(u < 0.62){                            // descente
      const t = (u-0.52)/0.10, e = t*t*(3-2*t);
      const q = vol(0.52);
      pos3 = [q[0]+(perche[0]-q[0])*e, q[1]+(perche[1]+0.045-q[1])*e,
              q[2]+(perche[2]-q[2])*e];
      cap = Math.atan2(perche[2]-q[2], perche[0]-q[0]);
      bat = Math.sin(temps*5.5 + m)*0.85;
    }else if(u < 0.90){                            // posée
      pos3 = [perche[0], perche[1]+0.045, perche[2]];
      cap = hash3(m, 8, 919)*Math.PI*2;
      bat = -0.95 + Math.sin(temps*1.4 + m)*0.05;  // ailes repliées
    }else{                                         // envol
      const t = (u-0.90)/0.10, e = t*t*(3-2*t);
      const q = vol(0);
      pos3 = [perche[0]+(q[0]-perche[0])*e, perche[1]+0.045+(q[1]-perche[1]-0.045)*e,
              perche[2]+(q[2]-perche[2])*e];
      cap = Math.atan2(q[2]-perche[2], q[0]-perche[0]);
      bat = Math.sin(temps*9 + m)*0.7;
    }
    const co = Math.cos(-cap), si = Math.sin(-cap);
    for(let v=0; v<nv; v++){
      const s = G.V[v], e = G.E[v];
      const dy = Math.sin(bat)*Math.abs(e)*0.9;    // battement : l'aile monte
      const dz = (Math.cos(bat)-1)*e*0.35;         // et se replie
      const x = s[0], y = s[1] + dy, z = s[2] + dz;
      p[i*3]   = pos3[0] + x*co + z*si;
      p[i*3+1] = pos3[1] + y;
      p[i*3+2] = pos3[2] - x*si + z*co;
      i++;
    }
  }
  meshMouettes.geometry.attributes.position.needsUpdate = true;
}

/* ---------- Caractère médiéval ------------------------------------------- */

/* Mélange de deux couleurs dans l'espace linéaire, rendu en hexadécimal pour
   pouvoir repasser par le cache de teintes. */
function melangeHex(h1, h2, t){
  const a = lin(h1), b = lin(h2);
  const s = (v)=>{
    const u = v<=0.0031308 ? v*12.92 : 1.055*Math.pow(v,1/2.4)-0.055;
    return Math.max(0, Math.min(255, Math.round(u*255)));
  };
  const m = (x,y)=> s(x+(y-x)*t);
  return '#' + [m(a.r,b.r), m(a.g,b.g), m(a.b,b.b)]
    .map(v=>v.toString(16).padStart(2,'0')).join('');
}

/* Pan de bois. Les bois ont une vraie épaisseur — face avant plus quatre
   chants — sinon ils se lisent comme des traits peints et non comme une
   charpente. L'aspect tient surtout au contraste : hourdis clair, bois sombre
   en relief. Réservé aux étages, le rez-de-chaussée restant maçonné. */
function colombage(A, B, y0, y1, dehors, cle, ouvs, styleBat){
  const len = dist2d(A,B);
  if(len < 0.32) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl, oz = dehors[2]/dl;
  const H1 = y1 - y0;
  const p3 = (u, v, d) => [A[0]+ux*u+ox*d, y0+v, A[1]+uz*u+oz*d];

  const madrier = (u0,v0,u1,v1, hw, cle2)=>{
    const dx=u1-u0, dy=v1-v0, l=Math.hypot(dx,dy)||1;
    const nx=-dy/l*hw, ny=dx/l*hw;
    const ex=dx/l*hw*0.55, ey=dy/l*hw*0.55;      // les assemblages se recouvrent
    const c4=[[u0-ex+nx, v0-ey+ny],[u1+ex+nx, v1+ey+ny],
              [u1+ex-nx, v1+ey-ny],[u0-ex-nx, v0-ey-ny]];
    const EP = 0.034;
    const F = c4.map(q=>p3(q[0], q[1], EP));
    const R = c4.map(q=>p3(q[0], q[1], 0.004));
    const clair = grain('#5f4a34', 0.86 + hash3(cle, cle2, 307)*0.34,
                        (hash3(cle, cle2, 311)-0.5)*0.20);
    const sombre = grain('#4a3928', 0.80 + hash3(cle, cle2, 313)*0.24, 0);
    pousserQuad(F[0],F[1],F[2],F[3], clair, dehors, false);
    const cx=(F[0][0]+F[2][0])/2, cy=(F[0][1]+F[2][1])/2, cz=(F[0][2]+F[2][2])/2;
    for(let k=0;k<4;k++){
      const a=(k+1)%4;
      const mx=(F[k][0]+F[a][0])/2-cx, my=(F[k][1]+F[a][1])/2-cy, mz=(F[k][2]+F[a][2])/2-cz;
      pousserQuad(R[k], R[a], F[a], F[k], sombre, [mx,my,mz], false);
    }
  };

  const libre = (u)=>{
    for(const o of ouvs) if(u > o.u0-0.05 && u < o.u1+0.05) return false;
    return true;
  };
  madrier(0, 0.035, len, 0.035, 0.032, 1);              // sablière basse
  madrier(0, H1-0.055, len, H1-0.055, 0.036, 2);        // sablière haute
  const n = Math.max(1, Math.round(len/0.28));
  const poteaux = [];
  for(let k=0;k<=n;k++){
    const u = Math.min(len-0.03, Math.max(0.03, len*k/n));
    if(!libre(u)) continue;
    madrier(u, 0.02, u, H1-0.03, 0.030, 10+k);
    poteaux.push(u);
  }
  for(let k=0;k+1<poteaux.length;k++){
    const a=poteaux[k], b=poteaux[k+1];
    if(b-a < 0.26) continue;
    let net = true;
    for(const o of ouvs) if(o.u1 > a-0.02 && o.u0 < b+0.02) net = false;
    if(!net) continue;
    const sens = hash3(cle, k, 317) > 0.5;
    madrier(sens?a+0.03:b-0.03, 0.06, sens?b-0.03:a+0.03,
            H1-0.09, styleBat === 2 ? 0.030 : 0.026, 30+k);
    /* Le profil dense reçoit une croix de Saint-André complète ; le profil
       mixte alterne croix et chevrons. */
    if(styleBat === 2 || (styleBat === 4 && k%2 === 0)){
      madrier(sens?b-0.03:a+0.03, 0.06, sens?a+0.03:b-0.03,
              H1-0.09, 0.024, 60+k);
    }
  }
}

/* Créneaux : une tour isolée assez haute porte une plate-forme crénelée au
   lieu d'un toit. */
/* Une tour isolée assez haute reçoit soit des créneaux, soit une flèche,
   soit une croupe ordinaire. */
function sommetTour(c, L){
  if(occ(c, L+1)) return '';
  const sp = c.sp[L];
  if(sp) return PT(sp).fortifie ? 'creneaux' : '';
  if(c.b.length < 3) return '';
  for(let i=0;i<4;i++) if(estToit(c.nb[i], L)) return '';
  const h = hash3(c.i, 0, 401);
  return h > 0.58 ? 'creneaux' : h > 0.30 ? 'fleche' : '';
}
const aCreneaux = (c,L) => sommetTour(c,L) === 'creneaux';

/* Flèche : cône à seize pans depuis le contour, épi et boule au sommet. */
function fleche(c, L, rs, base, cT){
  const y1 = (L+1)*H;
  const bord = [];
  for(let i=0;i<4;i++){
    const e = rs.get(c.q[i]);
    if(e && e.r > 1e-4) for(const p of arcSommet(e, e.r)) bord.push(p);
    else bord.push(P[c.q[i]]);
  }
  const n = bord.length;
  const H2 = 0.85 + hash3(c.i, 1, 641)*0.75;
  const sommet = [c.cx, y1 + H2, c.cz];
  const debord = 0.055;
  ctx = {c, L, k:'toit', e:-1};
  const ext = bord.map(p=>{
    const dx=p[0]-c.cx, dz=p[1]-c.cz, l=Math.hypot(dx,dz)||1;
    return [p[0]+dx/l*debord, p[1]+dz/l*debord];
  });
  coneTuile(c.cx, c.cz, bord, y1, sommet, cT, c.i*47+L, debord);
  // égout légèrement débordant
  for(let k=0;k<n;k++){
    const k2=(k+1)%n;
    pousserQuad([bord[k][0],y1-0.05,bord[k][1]], [bord[k2][0],y1-0.05,bord[k2][1]],
                [ext[k2][0],y1,ext[k2][1]], [ext[k][0],y1,ext[k][1]],
                teinte(cT, 0.72), [0,-1,0], false);
  }
  poutre([c.cx, y1+H2-0.02, c.cz], [c.cx, y1+H2+0.16, c.cz], 0.014, teinte('#3b3a3f',1));
  boiteOr(c.cx, c.cz, 1, 0, 0.035, 0.035, y1+H2+0.10, y1+H2+0.16, teinte('#c9a227',1));
}

function creneaux(c, L, rs, base){
  const y1 = (L+1)*H;
  const bord = [];
  for(let i=0;i<4;i++){
    const e = rs.get(c.q[i]);
    if(e && e.r > 1e-4) for(const p of arcSommet(e, e.r)) bord.push(p);
    else bord.push(P[c.q[i]]);
  }
  const n = bord.length;
  const norm = bord.map(p=>{
    const dx=p[0]-c.cx, dz=p[1]-c.cz, l=Math.hypot(dx,dz)||1;
    return [dx/l, dz/l];
  });
  const DEB = 0.05, EP = 0.105, HB = 0.14, HM = 0.29;
  const ext = bord.map((p,k)=>[p[0]+norm[k][0]*DEB, p[1]+norm[k][1]*DEB]);
  const int = bord.map((p,k)=>[p[0]-norm[k][0]*(EP-DEB), p[1]-norm[k][1]*(EP-DEB)]);
  const pierre = teinte(base, 0.88), fonce = teinte(base, 0.68);
  ctx = {c, L, k:'toit', e:-1};

  // corbeaux : le parapet est en encorbellement, posé sur des consoles
  let s = 0;
  for(let k=0;k<n;k++){
    const k2=(k+1)%n;
    const seg = dist2d(bord[k], bord[k2]);
    if(Math.floor(s/0.17) !== Math.floor((s+seg)/0.17)){
      const p = bord[k], d = norm[k];
      boiteOr(p[0]+d[0]*0.018, p[1]+d[1]*0.018, d[0], d[1], 0.038, 0.032,
              y1-0.115, y1-0.005, grain(base, 0.74, 0));
    }
    s += seg;
  }

  // plate-forme
  for(let k=0;k<n;k++){
    const k2=(k+1)%n;
    pousserQuad([int[k][0],y1,int[k][1]], [int[k2][0],y1,int[k2][1]],
                [c.cx,y1,c.cz], [c.cx,y1,c.cz],
                grain('#8d8474', 0.86 + hash3(c.i,k,409)*0.22, 0), [0,1,0], true);
  }

  // parapet, merlons alternés le long du périmètre développé
  s = 0;
  const haut = [];
  for(let k=0;k<n;k++){
    const k2=(k+1)%n;
    haut.push(Math.floor(s/0.19) % 2 ? HM : HB);
    s += dist2d(bord[k], bord[k2]);
  }
  for(let k=0;k<n;k++){
    const k2=(k+1)%n, h = haut[k];
    const a=ext[k], b=ext[k2], p=int[k], q=int[k2];
    const deh = [(a[0]+b[0])/2-c.cx, 0, (a[1]+b[1])/2-c.cz];
    pousserQuad([a[0],y1-0.005,a[1]], [b[0],y1-0.005,b[1]],
                [b[0],y1+h,b[1]], [a[0],y1+h,a[1]], pierre, deh, true);
    pousserQuad([p[0],y1,p[1]], [q[0],y1,q[1]],
                [q[0],y1+h,q[1]], [p[0],y1+h,p[1]], fonce,
                [-deh[0],0,-deh[2]], true);
    pousserQuad([a[0],y1+h,a[1]], [b[0],y1+h,b[1]],
                [q[0],y1+h,q[1]], [p[0],y1+h,p[1]], teinte(base, 1.05), [0,1,0], true);
    const hs = haut[k2];
    if(hs !== h){
      const bas = Math.min(h,hs), ht = Math.max(h,hs);
      pousserQuad([b[0],y1+bas,b[1]], [q[0],y1+bas,q[1]],
                  [q[0],y1+ht,q[1]], [b[0],y1+ht,b[1]],
                  teinte(base, 0.78), [b[0]-q[0], 0, b[1]-q[1]], true);
    }
  }
}

/* ---------- Arrondis du contour -------------------------------------------
   Le contour d'un niveau est le bord de la réunion des cellules occupées. On
   collecte ses arêtes exposées, orientées dans le sens trigonométrique, et on
   les chaîne : chaque sommet du contour a une arête entrante et une sortante.
   Un virage à gauche est un angle saillant, donc arrondi. Comme le calcul est
   global et non plus par cellule, deux bâtiments qui se touchent partagent le
   même congé : leurs murs se raccordent et l'angle extérieur s'arrondit. */

function contourNiveau(L){
  const sortant = new Map(), entrant = new Map();
  for(const c of cellules){
    if(!occ(c,L)) continue;
    for(let i=0;i<4;i++){
      if(occ(c.nb[i], L)) continue;
      const u=c.q[i], v=c.q[(i+1)%4];
      if(!sortant.has(u)) sortant.set(u, {c, i, b:v});
      if(!entrant.has(v)) entrant.set(v, {c, i, a:u});
    }
  }
  const RS = new Map();
  sortant.forEach((eo, s)=>{
    const ei = entrant.get(s);
    if(!ei) return;
    const V=P[s], Aa=P[ei.a], Bb=P[eo.b];
    const d1=[V[0]-Aa[0], V[1]-Aa[1]], l1=Math.hypot(d1[0],d1[1])||1;
    const d2=[Bb[0]-V[0], Bb[1]-V[1]], l2=Math.hypot(d2[0],d2[1])||1;
    const cr=(d1[0]*d2[1]-d1[1]*d2[0])/(l1*l2);
    const dp=(d1[0]*d2[0]+d1[1]*d2[1])/(l1*l2);
    const vir=Math.atan2(cr, dp);
    if(vir <= 0.20) return;                       // contour droit ou rentrant
    const sp1=ei.c.sp[L], sp2=eo.c.sp[L];
    if((sp1 && !PT(sp1).rond) || (sp2 && !PT(sp2).rond)) return;  // atelier : angles francs
    let force = Math.min(1, vir/(Math.PI/2));
    if((sp1 && PT(sp1).rond) || (sp2 && PT(sp2).rond)) force = 1;
    RS.set(s, {V, d1:[d1[0]/l1, d1[1]/l1], d2:[d2[0]/l2, d2[1]/l2],
               lim:0.42*Math.min(l1,l2), force, cIn:ei.c, iIn:ei.i, r:0,
               pIn:V, pOut:V});
  });
  return RS;
}

/* Le rayon dépend aussi de la hauteur : un angle saillant sur plusieurs
   niveaux d'affilée est plus arrondi qu'un bloc isolé d'un seul étage, et le
   facteur est constant sur toute la série pour que le mur reste vertical. */
function tousContours(){
  let maxL = 0;
  for(const c of cellules) maxL = Math.max(maxL, c.b.length);
  const arr = [];
  for(let L=0; L<maxL; L++) arr.push(contourNiveau(L));
  for(let L=0; L<maxL; L++){
    arr[L].forEach((e, s)=>{
      let n = 1;
      for(let k=L-1; k>=0 && arr[k].has(s); k--) n++;
      for(let k=L+1; k<maxL && arr[k].has(s); k++) n++;
      e.r = Math.min(R_ROND * Math.min(1, 0.45 + (n-1)*0.35) * e.force, e.lim);
      e.pIn  = [e.V[0]-e.d1[0]*e.r, e.V[1]-e.d1[1]*e.r];
      e.pOut = [e.V[0]+e.d2[0]*e.r, e.V[1]+e.d2[1]*e.r];
    });
  }
  return arr;
}

function arcSommet(e, r){
  const A=[e.V[0]-e.d1[0]*r, e.V[1]-e.d1[1]*r];
  const B=[e.V[0]+e.d2[0]*r, e.V[1]+e.d2[1]*r];
  const pts=[];
  for(let k=0;k<=N_ARC;k++){
    const t=k/N_ARC, m=1-t;
    pts.push([m*m*A[0] + 2*m*t*e.V[0] + t*t*B[0],
              m*m*A[1] + 2*m*t*e.V[1] + t*t*B[1]]);
  }
  return pts;
}

/* Extrémités du mur droit d'une arête, une fois les congés retranchés. */
function bornes(rs, c, i){
  const u=c.q[i], v=c.q[(i+1)%4];
  const eu=rs.get(u), ev=rs.get(v);
  return [ eu ? eu.pOut : P[u], ev ? ev.pIn : P[v] ];
}

function bandeauSommet(e, rBas, rHaut, y, dy, coul){
  const a=arcSommet(e, rBas), b=arcSommet(e, rHaut);
  const sens = rHaut > rBas ? 1 : -1;
  for(let k=0;k<N_ARC;k++){
    pousserQuad([a[k][0],y,a[k][1]], [a[k+1][0],y,a[k+1][1]],
                [b[k+1][0],y+dy,b[k+1][1]], [b[k][0],y+dy,b[k][1]],
                coul, [0,sens,0], true);
  }
}

/* ---------- Renforts -------------------------------------------------------
   Deux situations distinctes, comme dans Townscaper :

   - Le bloc flottant a au moins deux appuis latéraux (des colonnes pleines
     juste en dessous, de part et d'autre) : c'est une travée entre deux tours.
     Le bâtiment descend lui-même jusqu'au sol, dans sa propre couleur, et
     l'ouverture est une arche percée dans son mur. Aucune structure ajoutée.

   - Sinon c'est un encorbellement : un mât métallique fin, une poutre de rive
     sous les arêtes libres et quatre contrefiches. Discret, et clairement
     d'une autre matière que le bâti.

   Dans les deux cas la condition d'émission est « rien en dessous », donc
   poser un bloc sous le vide fait disparaître le renfort. */

const METAL = '#3b3a3f';

/* Coins reculés vers l'intérieur, le long des deux arêtes incidentes. */
function coinsRentres(S, d){
  const u = [], In = [];
  for(let i=0;i<4;i++){
    const A=S[i], B=S[(i+1)%4];
    const l = dist2d(A,B) || 1;
    u.push([(B[0]-A[0])/l, (B[1]-A[1])/l]);
  }
  for(let i=0;i<4;i++){
    const p=u[i], q=u[(i+3)%4];
    In.push([S[i][0] + d*p[0] - d*q[0], S[i][1] + d*p[1] - d*q[1]]);
  }
  return {u, In};
}

/* Poutre de section carrée entre deux points. */
function poutre(A, B, r, coul){
  const d = [B[0]-A[0], B[1]-A[1], B[2]-A[2]];
  const l = Math.hypot(d[0],d[1],d[2]);
  if(l < 1e-4) return;
  d[0]/=l; d[1]/=l; d[2]/=l;
  const ref = Math.abs(d[1]) > 0.9 ? [1,0,0] : [0,1,0];
  const cr = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  let e1 = cr(d, ref);
  const l1 = Math.hypot(e1[0],e1[1],e1[2]) || 1;
  e1 = [e1[0]/l1, e1[1]/l1, e1[2]/l1];
  const e2 = cr(d, e1);
  const sec = [[1,1],[-1,1],[-1,-1],[1,-1]];
  const coupe = (p) => sec.map(s => [
    p[0] + (e1[0]*s[0] + e2[0]*s[1])*r,
    p[1] + (e1[1]*s[0] + e2[1]*s[1])*r,
    p[2] + (e1[2]*s[0] + e2[2]*s[1])*r
  ]);
  const a = coupe(A), b = coupe(B);
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    const n = [ (e1[0]*(sec[i][0]+sec[j][0]) + e2[0]*(sec[i][1]+sec[j][1])),
                (e1[1]*(sec[i][0]+sec[j][0]) + e2[1]*(sec[i][1]+sec[j][1])),
                (e1[2]*(sec[i][0]+sec[j][0]) + e2[2]*(sec[i][1]+sec[j][1])) ];
    pousserQuad(a[i], a[j], b[j], b[i], coul, n, true);
  }
  pousserQuad(a[0],a[1],a[2],a[3], coul, [-d[0],-d[1],-d[2]], true);
  pousserQuad(b[0],b[1],b[2],b[3], coul, d, true);
}

/* La cellule descend-elle jusqu'à l'eau ? (détermine la présence d'un socle) */
function poseAuSol(c){
  if(occ(c,0)) return true;
  let Lmin = -1;
  for(let k=0;k<c.b.length;k++) if(occ(c,k)){ Lmin = k; break; }
  if(Lmin <= 0) return false;
  let n = 0;
  for(let i=0;i<4;i++) if(occ(c.nb[i], Lmin-1)) n++;
  return n >= 2;
}

/* Panneau de mur percé d'une baie en plein cintre.
   o0/o1 : extrémités du parement extérieur ; q0/q1 : celles du parement
   intérieur. Le profil du bord bas est échantillonné en (abscisse, hauteur) ;
   les deux échantillons dupliqués aux naissances produisent, sans cas
   particulier, les joues verticales des piédroits. */
function panneauPerce(o0, o1, q0, q1, yb, yt, jwF, cOut, cIn, cVo, dehors, base, cle){
  const len = dist2d(o0,o1);
  if(len < 1e-4) return;
  const ux=(o1[0]-o0[0])/len, uz=(o1[1]-o0[1])/len;
  const jw = Math.min(0.20, len*jwF);
  const W  = len - 2*jw;
  const ech = [];
  if(W < 0.12){
    ech.push([0,yb],[len,yb]);
  }else{
    const couronne = Math.max(0.24, (yt-yb) - 0.14);
    let ra = W*0.5, hs = couronne - ra;
    if(hs < 0.03){ hs = 0.03; ra = Math.max(0.08, couronne - hs); }
    ech.push([0,yb],[jw,yb],[jw,yb+hs]);
    for(let k=1;k<N_ARCHE;k++){
      const t=k/N_ARCHE;
      ech.push([jw + W*t, yb + hs + ra*Math.sqrt(Math.max(0, 1-(2*t-1)*(2*t-1)))]);
    }
    ech.push([len-jw, yb+hs], [len-jw, yb], [len, yb]);
  }
  const ext = (t)=>[o0[0]+ux*t, o0[1]+uz*t];
  const int = (t)=>[q0[0]+(q1[0]-q0[0])*(t/len), q0[1]+(q1[1]-q0[1])*(t/len)];
  const dedans = [-dehors[0], 0, -dehors[2]];
  for(let k=0;k<ech.length-1;k++){
    const [t0,h0]=ech[k], [t1,h1]=ech[k+1];
    const a=ext(t0), b=ext(t1), p=int(t0), q=int(t1);
    if(base !== undefined) pave(a, b, Math.max(h0,h1), yt, dehors, base, cle + k*13);
    else pousserQuad([a[0],h0,a[1]], [b[0],h1,b[1]], [b[0],yt,b[1]], [a[0],yt,a[1]], cOut, dehors, false);
    if(base !== undefined && Math.abs(h1-h0) > 1e-4)
      pousserQuad([a[0],h0,a[1]], [b[0],h1,b[1]],
                  [b[0],Math.max(h0,h1),b[1]], [a[0],Math.max(h0,h1),a[1]],
                  cOut, dehors, false);
    pousserQuad([p[0],h0,p[1]], [q[0],h1,q[1]], [q[0],yt,q[1]], [p[0],yt,p[1]], cIn, dedans, true);
    pousserQuad([a[0],h0,a[1]], [p[0],h0,p[1]], [q[0],h1,q[1]], [b[0],h1,b[1]], cVo, [0,-1,0], true);
  }
  for(const [t,sg] of [[0,-1],[len,1]]){
    const a=ext(t), p=int(t);
    pousserQuad([a[0],yb,a[1]], [p[0],yb,p[1]], [p[0],yt,p[1]], [a[0],yt,a[1]],
                cIn, [ux*sg, 0, uz*sg], true);
  }
}

/* Travée entre deux tours : ce n'est pas une pièce ajoutée sous la maison,
   c'est la maison elle-même qui descend et se perce. Le panneau part donc des
   MÊMES extrémités que les murs du niveau au-dessus, congés compris, et les
   angles arrondis se prolongent vers le bas. */
function arche(c, L, yb, y0, rs){
  const S = c.q.map(v => P[v]);
  const {In} = coinsRentres(S, 0.15);
  const spe = c.sp[L];
  const base = spe ? (PT(spe).mur || TYPES[spe.t].mur) : PAL[c.b[L]];
  const cOut = teinte(base, 0.95), cIn = teinte(base, 0.76), cVo = teinte(base, 0.86);
  for(let i=0;i<4;i++){
    if(occ(c.nb[i], L-1)) continue;
    const [A, B] = rs ? bornes(rs, c, i) : [S[i], S[(i+1)%4]];
    const dehors = [(A[0]+B[0])/2-c.cx, 0, (A[1]+B[1])/2-c.cz];
    panneauPerce(A, B, In[i], In[(i+1)%4], yb, y0, 0.19, cOut, cIn, cVo, dehors, base, c.i*331+i);
  }
  if(rs) for(let i=0;i<4;i++){
    const e = rs.get(c.q[i]);
    if(!e || e.r <= 1e-4) continue;
    const pts = arcSommet(e, e.r);
    for(let k=0;k<pts.length-1;k++){
      const a=pts[k], b=pts[k+1];
      const deh=[(a[0]+b[0])/2-c.cx, 0, (a[1]+b[1])/2-c.cz];
      pave(a, b, yb, y0, deh, base, c.i*337 + i*7 + k);
    }
  }
  pousserQuad([In[0][0],y0,In[0][1]], [In[1][0],y0,In[1][1]],
              [In[2][0],y0,In[2][1]], [In[3][0],y0,In[3][1]],
              teinte(base, 0.68), [0,-1,0], false);
}

/* ---------- Bâtiments à particularités ------------------------------------ */

const PT = (sp) => TYPES[sp.t].parts[sp.p];
const celluleDe = (c, r, part) => part.df === undefined ? c : c.nb[(part.df + r) % 4];
const niveauDe  = (L, part)    => L + (part.dl || 0);

/* Boîte orientée : (dx,dz) est la direction « avant », lx la demi-longueur
   suivant cet axe, lz la demi-largeur latérale. */
function boiteOr(cx, cz, dx, dz, lx, lz, y0, y1, coul){
  const px=-dz, pz=dx;
  const s=[[cx+dx*lx+px*lz, cz+dz*lx+pz*lz],
           [cx+dx*lx-px*lz, cz+dz*lx-pz*lz],
           [cx-dx*lx-px*lz, cz-dz*lx-pz*lz],
           [cx-dx*lx+px*lz, cz-dz*lx+pz*lz]];
  for(let i=0;i<4;i++){
    const A=s[i], B=s[(i+1)%4];
    pousserQuad([A[0],y0,A[1]], [B[0],y0,B[1]], [B[0],y1,B[1]], [A[0],y1,A[1]],
                coul, [(A[0]+B[0])/2-cx, 0, (A[1]+B[1])/2-cz], true);
  }
  pousserQuad([s[0][0],y1,s[0][1]], [s[1][0],y1,s[1][1]],
              [s[2][0],y1,s[2][1]], [s[3][0],y1,s[3][1]], coul, [0,1,0], true);
  return s;
}

/* Tas conique : socle carré, sommet ponctuel. */
function tas(cx, cz, r, y0, h, coul){
  const s=[[cx-r,cz-r],[cx+r,cz-r],[cx+r,cz+r],[cx-r,cz+r]];
  const ap=[cx, y0+h, cz];
  for(let i=0;i<4;i++){
    const A=s[i], B=s[(i+1)%4];
    const A3=[A[0],y0,A[1]], B3=[B[0],y0,B[1]];
    const n=[(A[0]+B[0])/2-cx, 0.4, (A[1]+B[1])/2-cz];
    const ux=B3[0]-A3[0], uy=B3[1]-A3[1], uz=B3[2]-A3[2];
    const vx=ap[0]-A3[0], vy=ap[1]-A3[1], vz=ap[2]-A3[2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
    if(nx*n[0]+ny*n[1]+nz*n[2] < 0) pousserTri(A3, ap, B3, coul, true);
    else                            pousserTri(A3, B3, ap, coul, true);
  }
}

let rotatifs = [];

/* ---- corps plein --------------------------------------------------------- */
/* La Tour sombre. Elle occupe quatre cellules, mais elle ne les REMPLIT pas :
   dessinée case par case, elle formait un bloc massif de la taille de quatre
   maisons. Elle est maintenant tracée d'un seul tenant, centrée sur le sommet
   commun aux quatre cellules — un fût à douze pans qui part d'une base large en
   talus et s'affine par ressauts jusqu'à ne plus faire qu'un tiers de son
   empreinte au sol. Les quatre cases restent réservées : c'est son emprise, pas
   son volume. */
function tourSombre(cx, cz, yBas, haut){
  const N = 12;
  const PIERRE = ['#4f4b49','#57534f','#494543','#5c5754'];
  const anneau = (r) => {
    const p = [];
    for(let k=0;k<N;k++){
      const a = k/N*Math.PI*2 + Math.PI/N;
      p.push([cx + Math.cos(a)*r, cz + Math.sin(a)*r]);
    }
    return p;
  };
  /* Étages : rayon bas, rayon haut, part de la hauteur. Le talus du pied est
     plus incliné que le reste, c'est lui qui donne l'assise. */
  const ET = [[0.78, 0.62, 0.13], [0.60, 0.52, 0.26], [0.49, 0.40, 0.26],
              [0.37, 0.30, 0.23], [0.28, 0.245, 0.12]];
  let y = yBas - 0.04, e = 0;
  const paliers = [];
  for(const [r0, r1, part] of ET){
    const y2 = y + haut*part;
    const A0 = anneau(r0), A1 = anneau(r1);
    for(let k=0;k<N;k++){
      const k2=(k+1)%N;
      const a=A0[k], b=A0[k2], c2=A1[k2], d=A1[k];
      const deh=[(a[0]+b[0])/2-cx, 0, (a[1]+b[1])/2-cz];
      // fruit du mur : le pave suit le fuseau en quatre bandes
      const M = Math.max(2, Math.round((y2-y)/0.22));
      for(let m=0;m<M;m++){
        const t0=m/M, t1=(m+1)/M;
        const q=(t,i2)=>[A0[i2][0]+(A1[i2][0]-A0[i2][0])*t,
                         A0[i2][1]+(A1[i2][1]-A0[i2][1])*t];
        const p0=q(t0,k), p1=q(t0,k2), p2=q(t1,k2), p3=q(t1,k);
        pousserQuad([p0[0], y+(y2-y)*t0, p0[1]], [p1[0], y+(y2-y)*t0, p1[1]],
                    [p2[0], y+(y2-y)*t1, p2[1]], [p3[0], y+(y2-y)*t1, p3[1]],
                    grain(PIERRE[(e*3+k+m) % PIERRE.length],
                          0.88 + hash3(Math.round(cx*997), e*17+k*3+m, 1493)*0.24,
                          (hash3(Math.round(cz*991), k+m, 1499)-0.5)*0.12),
                    deh, false);
      }
    }
    // bandeau de ressaut entre deux étages
    if(e < ET.length-1){
      const B0 = anneau(ET[e][1] + 0.035), B1 = anneau(ET[e+1][0]);
      for(let k=0;k<N;k++){
        const k2=(k+1)%N;
        const deh=[(B0[k][0]+B0[k2][0])/2-cx, 0, (B0[k][1]+B0[k2][1])/2-cz];
        pousserQuad([B0[k][0], y2-0.055, B0[k][1]], [B0[k2][0], y2-0.055, B0[k2][1]],
                    [B0[k2][0], y2, B0[k2][1]], [B0[k][0], y2, B0[k][1]],
                    grain('#635e5b', 1.02, 0), deh, false);
        pousserQuad([B0[k][0], y2, B0[k][1]], [B0[k2][0], y2, B0[k2][1]],
                    [B1[k2][0], y2, B1[k2][1]], [B1[k][0], y2, B1[k][1]],
                    grain('#6d6864', 1.10, 0), [0,1,0], false);
      }
    }
    paliers.push([y, y2, ET[e][1]]);
    y = y2; e++;
  }

  /* Meurtrières en spirale : une par palier, décalée d'un pan à chaque fois.
     C'est ce décalage qui suggère l'escalier tournant à l'intérieur. */
  for(let k=0;k<7;k++){
    const t = 0.16 + k*0.115;
    const yy = yBas + haut*t;
    let r = 0.5;
    for(const [ya, yb, rh] of paliers) if(yy >= ya && yy <= yb) r = rh + 0.02;
    const a = (k*2.4);
    const dx=Math.cos(a), dz=Math.sin(a);
    boiteOr(cx+dx*r, cz+dz*r, dx, dz, 0.016, 0.030, yy, yy+0.26,
            teinte('#141212',1));
    boiteOr(cx+dx*(r+0.012), cz+dz*(r+0.012), dx, dz, 0.038, 0.012, yy-0.03, yy+0.29,
            grain('#6b6663', 0.96, 0));
    lampeCourante = 1; lampeGroupe = 4;
    boiteOr(cx+dx*(r-0.01), cz+dz*(r-0.01), dx, dz, 0.010, 0.020, yy+0.05, yy+0.19,
            teinte('#c98a3a', 1.1));
    lampeCourante = 0; lampeGroupe = 0;
  }

  /* Couronnement : mâchicoulis sur corbeaux, parapet crénelé, et au centre un
     feu qui brûle — c'est lui qui la rend habitée plutôt que morte. */
  const rT = 0.245, rC = rT + 0.075;
  const AC = anneau(rC), AT = anneau(rT);
  for(let k=0;k<N;k++){
    const k2=(k+1)%N;
    const deh=[(AT[k][0]+AT[k2][0])/2-cx, 0, (AT[k][1]+AT[k2][1])/2-cz];
    // corbeau
    poutre([AT[k][0], y-0.13, AT[k][1]], [AC[k][0], y+0.01, AC[k][1]], 0.030,
           grain('#5c5754', 0.94, 0));
    pousserQuad([AC[k][0], y, AC[k][1]], [AC[k2][0], y, AC[k2][1]],
                [AC[k2][0], y+0.055, AC[k2][1]], [AC[k][0], y+0.055, AC[k][1]],
                grain('#635e5b', 1.04, 0), deh, false);
    // merlons alternés
    const h = k%2 ? 0.10 : 0.26;
    pousserQuad([AC[k][0], y+0.055, AC[k][1]], [AC[k2][0], y+0.055, AC[k2][1]],
                [AC[k2][0], y+0.055+h, AC[k2][1]], [AC[k][0], y+0.055+h, AC[k][1]],
                grain('#57534f', 0.96, 0), deh, false);
    pousserQuad([AT[k][0], y+0.055, AT[k][1]], [AT[k2][0], y+0.055, AT[k2][1]],
                [AT[k2][0], y+0.055+h, AT[k2][1]], [AT[k][0], y+0.055+h, AT[k][1]],
                grain('#464341', 0.86, 0), [-deh[0],0,-deh[2]], false);
    pousserQuad([AC[k][0], y+0.055+h, AC[k][1]], [AC[k2][0], y+0.055+h, AC[k2][1]],
                [AT[k2][0], y+0.055+h, AT[k2][1]], [AT[k][0], y+0.055+h, AT[k][1]],
                grain('#6d6864', 1.08, 0), [0,1,0], false);
    if(k%2 === 0){
      pousserQuad([AC[k2][0], y+0.155, AC[k2][1]], [AT[k2][0], y+0.155, AT[k2][1]],
                  [AT[k2][0], y+0.315, AT[k2][1]], [AC[k2][0], y+0.315, AC[k2][1]],
                  grain('#514d4a', 0.9, 0),
                  [AC[k2][0]-AC[k][0], 0, AC[k2][1]-AC[k][1]], false);
    }
    pousserQuad([AT[k][0], y+0.055, AT[k][1]], [AT[k2][0], y+0.055, AT[k2][1]],
                [cx, y+0.055, cz], [cx, y+0.055, cz],
                grain('#5f5b58', 1.0, 0), [0,1,0], false);
  }
  for(let k=0;k<3;k++){
    const a2=k/3*Math.PI*2;
    poutre([cx+Math.cos(a2)*0.05, y+0.06, cz+Math.sin(a2)*0.05],
           [cx, y+0.24, cz], 0.014, teinte('#33312f',1));
  }
  boiteOr(cx, cz, 1, 0, 0.070, 0.070, y+0.20, y+0.28, teinte('#3d3a38',1));
  lampeCourante = 2; lampeGroupe = 5;
  boiteOr(cx, cz, 1, 0, 0.056, 0.056, y+0.28, y+0.315, teinte('#ff8a3a',1));
  lampeCourante = 0; lampeGroupe = 0;
  cheminees.push({x:cx, y:y+0.34, z:cz, force:0.75});
}

/* Porche. L'arche était un MUR PERCÉ : de la maçonnerie restait de part et
   d'autre du trou et descendait jusqu'en bas, ce qui donnait deux pieds
   isolés plantés dans le vide, sans rien pour les porter. Ici il n'y a pas de
   mur : seulement l'arc lui-même et son tympan. L'intrados est une demi-ellipse
   qui va d'un coin de la cellule à l'autre, et sous cette courbe il n'y a
   RIEN — les naissances tombent exactement sur les deux piles voisines, si bien
   que le porche se soude à elles au lieu de se poser devant. */
function porche(c, L, A, B, dehors, base, cle){
  const len = dist2d(A,B);
  if(len < 0.20) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const dl = Math.hypot(dehors[0], dehors[2]) || 1;
  const ox = dehors[0]/dl, oz = dehors[2]/dl;
  const y1 = (L+1)*H;
  const EP = 0.17;                              // épaisseur du mur
  const yC = y1 - 0.13;                         // clé de voûte
  const mont = Math.min(len*0.62, yC - 0.10);   // flèche de l'arc
  const yS = yC - mont;                         // naissance
  const N = 14;
  const p = (u, d, y) => [A[0]+ux*u - ox*d, y, A[1]+uz*u - oz*d];
  const intra = (t) => yS + mont*Math.sqrt(Math.max(0, 1 - (2*t-1)*(2*t-1)));

  for(let k=0;k<N;k++){
    const t0=k/N, t1=(k+1)/N;
    const u0=len*t0, u1=len*t1, h0=intra(t0), h1=intra(t1);
    const cle2 = cle*7 + k;
    // tympan extérieur et intérieur : la maçonnerie ne commence qu'au-dessus
    // de la courbe, il n'y a donc rien sous l'arc
    for(const [d, f, nrm] of [[0, 0.97, dehors],
                              [EP, 0.74, [-dehors[0],0,-dehors[2]]]]){
      pousserQuad(p(u0,d,h0), p(u1,d,h1), p(u1,d,y1), p(u0,d,y1),
                  grain(base, f * (0.94 + hash3(cle2, k, 1607)*0.16), 0), nrm, false);
    }
    // intrados : la bande courbe qui passe sous l'arc, appareillée en claveaux
    pousserQuad(p(u0,0,h0), p(u1,0,h1), p(u1,EP,h1), p(u0,EP,h0),
                grain(base, 0.80 + (k%2)*0.10, 0), [0,-1,0], false);
    // bandeau saillant qui souligne l'arc, comme une archivolte
    const e2 = 0.030;
    pousserQuad(p(u0,-e2,h0-0.045), p(u1,-e2,h1-0.045),
                p(u1,-e2,h0 > h1 ? h0 : h1), p(u0,-e2,h0),
                grain(base, 1.06, 0), dehors, false);
  }
  // sommier : une assise plus claire à la naissance, de chaque côté
  for(const u of [0.0, len]){
    const q0=p(u===0 ? 0 : len-0.10, -0.012, 0), q1=p(u===0 ? 0.10 : len, -0.012, 0);
    pousserQuad([q0[0],yS-0.05,q0[2]], [q1[0],yS-0.05,q1[2]],
                [q1[0],yS+0.02,q1[2]], [q0[0],yS+0.02,q0[2]],
                grain('#9d9384', 1.04, 0), dehors, false);
  }
}

/* Appentis latéral. C'est le premier volume qui SORT de la cellule : il se
   greffe sur un flanc de l'atelier et avance de trente-cinq centimètres sur la
   case voisine. Il ne se dessine que si cette case est libre à ce niveau — un
   appentis qui rentrerait dans la maison d'à côté n'aurait aucun sens. Charpente
   apparente, couverture en appentis à une seule pente, fond fermé de planches
   et flancs ouverts : c'est un abri, pas une pièce. */
function appentisLateral(c, L, A, B, dir, y0, y1, cM, cT, chaume, cle){
  const len = dist2d(A,B);
  if(len < 0.45) return;
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const S = 0.35, yH = y1 - 0.10, yB = y0 + 0.44;
  const p = (u, d, y) => [A[0]+ux*u + dir[0]*d, y, A[1]+uz*u + dir[1]*d];
  const bois = teinte('#6b5744', 1), sombre = teinte('#5a4632', 1);

  // deux poteaux d'about, contreventés vers le mur
  for(const u of [0.10*len, 0.90*len]){
    poutre(p(u, S, 0), p(u, S, yB), 0.030, bois);
    poutre(p(u, S, yB-0.14), p(u, 0.06, yH-0.04), 0.020, sombre);
  }
  // sablière basse et pannes
  poutre(p(0.06*len, S, yB), p(0.94*len, S, yB), 0.026, bois);
  const n = Math.max(2, Math.round(len/0.26));
  for(let k=0;k<=n;k++){
    const u = 0.06*len + (0.88*len)*k/n;
    poutre(p(u, 0.02, yH), p(u, S+0.05, yB-0.03), 0.016, sombre);
  }
  // couverture à une pente, débordante
  for(let k=0;k<n;k++){
    const u0 = 0.02*len + (0.96*len)*k/n, u1 = 0.02*len + (0.96*len)*(k+1)/n;
    if(chaume){
      for(let e=0;e<2;e++){
        const t0=e/2, t1=(e+1)/2;
        const q=(u,t)=>p(u, 0.02 + (S+0.08-0.02)*t, yH + (yB-0.03-yH)*t);
        pousserQuad(q(u0,t0), q(u1,t0), q(u1,t1), q(u0,t1),
                    grain('#c4a86a', 0.86+hash3(cle,k*3+e,1409)*0.24, 0), [0,1,0], false);
      }
    }else{
      pousserQuad(p(u0,0.02,yH), p(u1,0.02,yH), p(u1,S+0.08,yB-0.03), p(u0,S+0.08,yB-0.03),
                  grain(cT, 0.88+hash3(cle,k,1409)*0.22, (hash3(cle,k,1423)-0.5)*0.18),
                  [0,1,0], false);
    }
  }
  // fond de planches sous la couverture, du côté du mur
  for(let k=0;k<3;k++){
    const yy = yB + (yH-yB)*k/3, yz = yB + (yH-yB)*(k+1)/3;
    pousserQuad(p(0.10*len, S-0.02, yy), p(0.90*len, S-0.02, yy),
                p(0.90*len, S-0.02, yz), p(0.10*len, S-0.02, yz),
                grain('#9a7a55', 0.84+hash3(cle,k,1427)*0.26, 0),
                [dir[0],0,dir[1]], false);
  }
}

function corpsSpecial(c, L, sp, part, rs){
  const T = TYPES[sp.t];
  const mur = part.mur || T.mur, toit = part.toit || T.toit;
  const S = c.q.map(v => P[v]);
  const y0 = L*H, y1 = (L+1)*H;
  const {In} = coinsRentres(S, 0.14);
  const cMur = teinte(mur, 1), cInt = teinte(mur, 0.62);
  let creuse = false, dOuv = null;

  for(let f=0; f<4; f++){
    const i = (f + sp.r) % 4;
    const [A, B] = bornes(rs, c, i);
    const Ar = S[i], Br = S[(i+1)%4];
    const dehors = [(Ar[0]+Br[0])/2-c.cx, 0, (Ar[1]+Br[1])/2-c.cz];
    const dl = Math.hypot(dehors[0], dehors[2]) || 1;
    const dir = [dehors[0]/dl, dehors[2]/dl];
    ctx = {c, L, k:'mur', e:i};

    if(part.faces[f] === 'ouvert'){
      creuse = true; dOuv = dir;
      panneauPerce(Ar, Br, In[i], In[(i+1)%4], y0, y1, 0.17,
                   teinte(mur, 0.95), cInt, teinte(mur, 0.8), dehors);
    }else{
      const cle = c.i*211 + L*29 + i;
      murTexture(A, B, y0, y1, dehors, mur, cle,
                 baies(cle, dist2d(A,B), L,
                       part.meurtriere || part.faces[f] !== 'mur'));
      /* Meurtrière : une fente haute et étroite, à ébrasement intérieur, et
         seulement sur les faces qui donnent sur le vide. */
      if(part.meurtriere && !occ(c.nb[i], L) && hash3(cle, 21, 1483) > 0.35){
        const len2 = dist2d(A,B);
        const u = len2*(0.34 + hash3(cle,22,1487)*0.32);
        const px2 = (B[0]-A[0])/len2, pz2 = (B[1]-A[1])/len2;
        const mx2 = A[0]+px2*u, mz2 = A[1]+pz2*u;
        const yb2 = y0 + 0.20 + hash3(cle,23,1489)*0.12;
        boiteOr(mx2 + dir[0]*0.012, mz2 + dir[1]*0.012, dir[0], dir[1],
                0.014, 0.026, yb2, yb2 + 0.24, teinte('#1c1917',1));
        boiteOr(mx2 + dir[0]*0.026, mz2 + dir[1]*0.026, dir[0], dir[1],
                0.032, 0.010, yb2 - 0.02, yb2 + 0.26, grain('#7d7973', 0.94, 0));
      }
    }
    if(part.faces[f] === 'deco'){ detail = true; decorFace(c, L, sp, part, f, Ar, Br, dir, y0, y1); detail = false; }
    if(part.appentis === f && !occ(c.nb[i], L)){
      appentisLateral(c, L, Ar, Br, dir, y0, y1, mur, toit,
                      !!part.chaume, c.i*97 + L*13 + f);
    }
    if(part.ponton && f === 0) ponton(c, Ar, Br, dir, y0);
  }

  if(creuse){
    for(let f=0; f<4; f++){
      if(part.faces[f] === 'ouvert') continue;
      const i = (f + sp.r) % 4;
      const A = In[i], B = In[(i+1)%4];
      pousserQuad([A[0],y0,A[1]], [B[0],y0,B[1]], [B[0],y1,B[1]], [A[0],y1,A[1]],
                  cInt, [c.cx-(A[0]+B[0])/2, 0, c.cz-(A[1]+B[1])/2], true);
    }
    pousserQuad([In[0][0],y0+0.02,In[0][1]], [In[1][0],y0+0.02,In[1][1]],
                [In[2][0],y0+0.02,In[2][1]], [In[3][0],y0+0.02,In[3][1]],
                teinte('#4a4038',1), [0,1,0], true);
    pousserQuad([In[0][0],y1,In[0][1]], [In[1][0],y1,In[1][1]],
                [In[2][0],y1,In[2][1]], [In[3][0],y1,In[3][1]],
                teinte('#3a332d',1), [0,-1,0], true);
    interieur(c, L, sp.t, dOuv, y0, y1);
  }
}

/* ---- terrasse ------------------------------------------------------------ */
function courSpeciale(c, L, sp, part){
  if(part.champ !== undefined){ champCulture(c, L, part.champ); return; }
  const T = TYPES[sp.t];
  const S = c.q.map(v => P[v]);
  const y0 = L*H, yd = y0 + 0.13;
  ctx = {c, L, k:'toit', e:-1};
  const dalle = teinte('#9d9384', 1);

  for(let i=0;i<4;i++){
    if(occ(c.nb[i], L)) continue;
    const A=S[i], B=S[(i+1)%4];
    pousserQuad([A[0],y0,A[1]], [B[0],y0,B[1]], [B[0],yd,B[1]], [A[0],yd,A[1]],
                teinte('#8d8474',1), [(A[0]+B[0])/2-c.cx, 0, (A[1]+B[1])/2-c.cz], true);
  }
  pousserQuad([S[0][0],yd,S[0][1]], [S[1][0],yd,S[1][1]],
              [S[2][0],yd,S[2][1]], [S[3][0],yd,S[3][1]], dalle, [0,1,0], true);

  // orientation : dos tourné vers le corps du bâtiment
  const a = ancre(c, L, sp);
  let dRet = [0,1];
  if(a){
    const dx=a[0].cx-c.cx, dz=a[0].cz-c.cz, l=Math.hypot(dx,dz)||1;
    dRet=[dx/l, dz/l];
  }
  const {In} = coinsRentres(S, 0.10);
  const bois = teinte('#7a6248',1);

  if(part.cloture){
    for(let i=0;i<4;i++){
      if(occ(c.nb[i], L)) continue;
      const A=In[i], B=In[(i+1)%4];
      const n=3;
      for(let k=0;k<=n;k++){
        const x=A[0]+(B[0]-A[0])*k/n, z=A[1]+(B[1]-A[1])*k/n;
        poutre([x,yd,z],[x,yd+0.24,z], 0.022, bois);
      }
      for(const h of [0.10, 0.20]){
        poutre([A[0],yd+h,A[1]], [B[0],yd+h,B[1]], 0.018, bois);
      }
    }
  }else{
    for(let i=0;i<4;i++){
      if(occ(c.nb[i], L)) continue;
      const A=In[i], B=In[(i+1)%4];
      pousserQuad([A[0],yd,A[1]], [B[0],yd,B[1]], [B[0],yd+0.16,B[1]], [A[0],yd+0.16,A[1]],
                  teinte(T.mur, 0.72), [(A[0]+B[0])/2-c.cx, 0.2, (A[1]+B[1])/2-c.cz], true);
    }
  }
  detail = true;
  amenagement(c, sp.t, dRet, yd);
  detail = false;
  if(part.pergola) pergola(c, dRet, yd);
}

/* ---- décors extérieurs --------------------------------------------------- */
const dehorsN = (dir) => [dir[0], 0, dir[1]];

/* Galerie de bois en encorbellement, à l'étage d'une auberge. */
function galerieBois(c, A, B, dir, y0, y1){
  const len = dist2d(A,B);
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const bois = teinte('#7a5a3a',1), sombre = teinte('#5a4632',1);
  const S = 0.20;
  const P = (t, d, y) => [A[0]+ux*len*t+dir[0]*d, y, A[1]+uz*len*t+dir[1]*d];
  // plancher et consoles
  for(let k=0;k<5;k++){
    const t = 0.10 + k*0.20;
    poutre(P(t,0.02,y0+0.02), P(t,S,y0+0.12), 0.018, sombre);
  }
  pousserQuad(P(0.05,0.02,y0+0.12), P(0.95,0.02,y0+0.12),
              P(0.95,S,y0+0.12), P(0.05,S,y0+0.12), bois, [0,1,0], true);
  pousserQuad(P(0.05,S,y0+0.09), P(0.95,S,y0+0.09),
              P(0.95,S,y0+0.13), P(0.05,S,y0+0.13), sombre, dehorsN(dir), true);
  // garde-corps à balustres
  for(let k=0;k<=8;k++){
    const t = 0.06 + k*0.11;
    poutre(P(t,S-0.02,y0+0.12), P(t,S-0.02,y0+0.34), 0.012, bois);
  }
  poutre(P(0.05,S-0.02,y0+0.34), P(0.95,S-0.02,y0+0.34), 0.017, sombre);
}

/* Oculus et fioles sur la tourelle de l'alchimiste. */
function oculus(c, A, B, dir, y0, y1, f){
  const mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2;
  const y = y0 + (y1-y0)*0.52;
  const N = 8, R = 0.075;
  const cadre = teinte('#3f3b5c',1);
  for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2, b=(k+1)/N*Math.PI*2;
    const p=(ang,r,d)=>[mx+dir[0]*d + (-dir[1])*Math.cos(ang)*r, y+Math.sin(ang)*r,
                        mz+dir[1]*d + dir[0]*Math.cos(ang)*r];
    pousserQuad(p(a,R,0.02), p(b,R,0.02), p(b,R*0.72,0.02), p(a,R*0.72,0.02),
                cadre, dehorsN(dir), true);
    lampeCourante = 1; lampeGroupe = 0;
    pousserQuad(p(a,R*0.72,0.028), p(b,R*0.72,0.028), [mx+dir[0]*0.028, y, mz+dir[1]*0.028],
                [mx+dir[0]*0.028, y, mz+dir[1]*0.028],
                teinte('#8fd8c0', 1.1), dehorsN(dir), true);
    lampeCourante = 0;
  }
  if(f === 2){
    const px=-dir[1], pz=dir[0];
    for(let k=0;k<3;k++){
      boiteOr(mx+px*(-0.14+k*0.14)+dir[0]*0.05, mz+pz*(-0.14+k*0.14)+dir[1]*0.05,
              dir[0], dir[1], 0.022, 0.022, y0+0.08, y0+0.20,
              teinte(['#c8a0d8','#8fd0c0','#d8c08f'][k],1));
    }
  }
}

/* Hourd : galerie de bois en surplomb sur le donjon. */
function hourd(c, A, B, dir, y0, y1){
  const len = dist2d(A,B);
  const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
  const bois = teinte('#6b5744',1), sombre = teinte('#4a3928',1);
  const S = 0.17;
  const P = (t, d, y) => [A[0]+ux*len*t+dir[0]*d, y, A[1]+uz*len*t+dir[1]*d];
  for(let k=0;k<4;k++){
    const t = 0.14 + k*0.24;
    poutre(P(t,0.02,y0+0.10), P(t,S,y0+0.26), 0.020, sombre);
  }
  pousserQuad(P(0.06,0.02,y0+0.26), P(0.94,0.02,y0+0.26),
              P(0.94,S,y0+0.26), P(0.06,S,y0+0.26), bois, [0,1,0], true);
  pousserQuad(P(0.06,S,y0+0.26), P(0.94,S,y0+0.26),
              P(0.94,S,y0+0.52), P(0.06,S,y0+0.52), bois, dehorsN(dir), true);
  for(let k=0;k<3;k++){
    const t = 0.22 + k*0.28;
    pousserQuad(P(t,S+0.004,y0+0.34), P(t+0.10,S+0.004,y0+0.34),
                P(t+0.10,S+0.004,y0+0.48), P(t,S+0.004,y0+0.48),
                teinte('#2b2724',1), dehorsN(dir), true);
  }
  pousserQuad(P(0.06,S,y0+0.52), P(0.94,S,y0+0.52),
              P(0.94,0.02,y0+0.60), P(0.06,0.02,y0+0.60), sombre, [0,1,0], true);
}

/* Tour de guet : archères et bannière. */
function guet(c, A, B, dir, y0, y1, f){
  const mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2, px=-dir[1], pz=dir[0];
  boiteOr(mx+dir[0]*0.015, mz+dir[1]*0.015, dir[0], dir[1], 0.012, 0.022,
          y0+0.22, y0+0.46, teinte('#2b2724',1));
  if(f === 0){
    poutre([mx+px*0.20+dir[0]*0.02, y0+0.30, mz+pz*0.20+dir[1]*0.02],
           [mx+px*0.20+dir[0]*0.02, y0+0.72, mz+pz*0.20+dir[1]*0.02], 0.012,
           teinte('#3b3a3f',1));
    pousserQuad([mx+px*0.21+dir[0]*0.02, y0+0.70, mz+pz*0.21+dir[1]*0.02],
                [mx+px*0.36+dir[0]*0.02, y0+0.66, mz+pz*0.36+dir[1]*0.02],
                [mx+px*0.36+dir[0]*0.02, y0+0.50, mz+pz*0.36+dir[1]*0.02],
                [mx+px*0.21+dir[0]*0.02, y0+0.48, mz+pz*0.21+dir[1]*0.02],
                teinte('#8f3a3a',1), dehorsN(dir), true);
  }
}

function auventLaiterie(mx, mz, dir, px, pz, y0){
  const av = teinte('#b8492f',1);
  for(let k=0;k<5;k++){
    const w = -0.24 + k*0.12;
    pousserQuad([mx+px*w, y0+0.52, mz+pz*w],
                [mx+px*(w+0.12), y0+0.52, mz+pz*(w+0.12)],
                [mx+px*(w+0.12)+dir[0]*0.22, y0+0.40, mz+pz*(w+0.12)+dir[1]*0.22],
                [mx+px*w+dir[0]*0.22, y0+0.40, mz+pz*w+dir[1]*0.22],
                k%2 ? av : teinte('#f0ece0',1), [0,1,0], false);
  }
}

function banniereCaserne(c, mx, mz, dir, px, pz, y0){
  for(let k=0;k<2;k++){
    const w = -0.16 + k*0.32;
    poutre([mx+px*w+dir[0]*0.02, y0+0.52, mz+pz*w+dir[1]*0.02],
           [mx+px*w+dir[0]*0.16, y0+0.55, mz+pz*w+dir[1]*0.16], 0.010,
           teinte('#3b3a3f',1));
    const coul = k ? '#8f3a3a' : '#3a5a8f';
    pousserQuad([mx+px*(w-0.05)+dir[0]*0.15, y0+0.54, mz+pz*(w-0.05)+dir[1]*0.15],
                [mx+px*(w+0.05)+dir[0]*0.15, y0+0.54, mz+pz*(w+0.05)+dir[1]*0.15],
                [mx+px*(w+0.05)+dir[0]*0.15, y0+0.14, mz+pz*(w+0.05)+dir[1]*0.15],
                [mx+px*(w-0.05)+dir[0]*0.15, y0+0.14, mz+pz*(w-0.05)+dir[1]*0.15],
                teinte(coul, 1), dehorsN(dir), false);
  }
}

function decorFace(c, L, sp, part, f, A, B, dir, y0, y1){
  // certaines parts ont leur propre décor, quel que soit le métier
  if(part.galerie){ galerieBois(c, A, B, dir, y0, y1); return; }
  if(part.tourelle){ oculus(c, A, B, dir, y0, y1, f); return; }
  if(part.hourd){ hourd(c, A, B, dir, y0, y1); return; }
  if(part.tourGuet){ guet(c, A, B, dir, y0, y1, f); return; }
  const t = sp.t;
  const mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2;
  const px=-dir[1], pz=dir[0];

  if(t === 0){                                   /* forge. Le parti vient des
       maisons de forgeron : une souche de pierre massive ENGAGÉE dans le
       pignon, qui prend le mur sur toute sa largeur au lieu de deux tuyaux
       posés sur le toit. Elle s'affine par ressauts en montant, et sa base
       s'évase en contrefort. C'est elle qui donne au bâtiment sa silhouette. */
    const PIERRE = '#8a8078';
    const larg = 0.30, sx = mx - dir[0]*0.04, sz = mz - dir[1]*0.04;
    // contrefort : trois assises qui se rétrécissent
    const assises = [[0.34, 0.20, y0-0.02, y0+0.30], [0.30, 0.17, y0+0.30, y0+0.58],
                     [0.26, 0.15, y0+0.58, y1+0.10], [0.20, 0.13, y1+0.10, y1+0.62],
                     [0.16, 0.11, y1+0.62, y1+0.98]];
    for(let k=0;k<assises.length;k++){
      const [lx, lz, ya, yb] = assises[k];
      const px2=-dir[1], pz2=dir[0];
      const q = [[sx+dir[0]*lz+px2*lx, sz+dir[1]*lz+pz2*lx],
                 [sx+dir[0]*lz-px2*lx, sz+dir[1]*lz-pz2*lx],
                 [sx-dir[0]*lz-px2*lx, sz-dir[1]*lz-pz2*lx],
                 [sx-dir[0]*lz+px2*lx, sz-dir[1]*lz+pz2*lx]];
      for(let i=0;i<4;i++){
        const a=q[i], b=q[(i+1)%4];
        const deh=[(a[0]+b[0])/2-sx, 0, (a[1]+b[1])/2-sz];
        if(deh[0]*dir[0] + deh[2]*dir[1] < -0.6) continue;   // face dans le mur
        pave(a, b, ya, yb, deh, PIERRE, c.i*53 + k*11 + i, 0.13);
      }
      // larmier entre deux assises
      if(k < assises.length-1){
        const [lx2, lz2] = assises[k+1];
        for(let i=0;i<4;i++){
          const a=q[i], b=q[(i+1)%4];
          const a2=[sx+(a[0]-sx)*lx2/lx, sz+(a[1]-sz)*lz2/lz];
          const b2=[sx+(b[0]-sx)*lx2/lx, sz+(b[1]-sz)*lz2/lz];
          pousserQuad([a[0],yb,a[1]], [b[0],yb,b[1]], [b2[0],yb,b2[1]], [a2[0],yb,a2[1]],
                      grain(PIERRE, 1.08, 0), [0,1,0], false);
        }
      }
    }
    // couronnement : deux ressauts et un mitron de brique
    boiteOr(sx, sz, dir[0], dir[1], 0.13, 0.185, y1+0.98, y1+1.03, teinte(PIERRE, 0.86));
    boiteOr(sx, sz, dir[0], dir[1], 0.145, 0.205, y1+1.03, y1+1.08, teinte(PIERRE, 1.08));
    potChem(sx, sz, 0.085, 0.070, y1+1.08, y1+1.24, '#8f4a30', c.i*59);
    cheminees.push({x:sx, y:y1+1.26, z:sz, force:1.35});

    /* Appentis à charbon contre la souche, sur deux poteaux contreventés. */
    const px3=-dir[1], pz3=dir[0];
    const ox3 = mx + dir[0]*0.26, oz3 = mz + dir[1]*0.26;
    for(const e of [-0.26, 0.26]){
      poutre([ox3+px3*e, y0, oz3+pz3*e], [ox3+px3*e, y0+0.42, oz3+pz3*e], 0.026,
             teinte('#6b5744',1));
      poutre([ox3+px3*e, y0+0.34, oz3+pz3*e],
             [mx+px3*e*0.8, y0+0.50, mz+pz3*e*0.8], 0.018, teinte('#5f4a34',1));
    }
    for(let k=0;k<4;k++){
      const w = -0.26 + k*0.13;
      pousserQuad([mx+px3*w, y0+0.56, mz+pz3*w],
                  [mx+px3*(w+0.13), y0+0.56, mz+pz3*(w+0.13)],
                  [ox3+px3*(w+0.13), y0+0.44, oz3+pz3*(w+0.13)],
                  [ox3+px3*w, y0+0.44, oz3+pz3*w],
                  grain('#6f6a5e', 0.88+hash3(c.i,k,1307)*0.22, 0), [0,1,0], false);
    }
    tas(ox3 - dir[0]*0.10, oz3 - dir[1]*0.10, 0.13, y0, 0.16, teinte('#2c2a2b',1));
  }else if(t === 1){                             // boulangerie : four en saillie
    boiteOr(mx + dir[0]*0.10, mz + dir[1]*0.10, dir[0], dir[1],
            0.16, 0.20, y0, y0+0.34, teinte('#a8785a',1));
    boiteOr(mx + dir[0]*0.08, mz + dir[1]*0.08, dir[0], dir[1],
            0.12, 0.15, y0+0.34, y0+0.46, teinte('#a8785a',1));
    const somB = cheminee(mx - dir[0]*0.02, mz - dir[1]*0.02, dir[0], dir[1],
                          y0+0.46, c.i*31+7);
    cheminees.push({x:mx - dir[0]*0.02, y:somB + 0.02, z:mz - dir[1]*0.02, force:0.9});
  }else if(t === 2){                             // moulin
    if(part.ailes && f === 0){
      rotatifs.push({sorte:'ailes', x:mx + dir[0]*0.12, y:y0 + (y1-y0)*0.55,
                     z:mz + dir[1]*0.12, dx:dir[0], dz:dir[1], vit:0.55});
    }else if(f === 2 && !part.dl){               // porte au pied
      boiteOr(mx + dir[0]*0.02, mz + dir[1]*0.02, dir[0], dir[1],
              0.03, 0.11, y0+0.03, y0+0.40, teinte(BOIS,1.15));
      boiteOr(mx + dir[0]*0.12, mz + dir[1]*0.12, dir[0], dir[1],
              0.09, 0.13, y0, y0+0.07, teinte('#9a9184',1));
    }else if(f === 2){                           // lucarne à l'étage
      boiteOr(mx + dir[0]*0.02, mz + dir[1]*0.02, dir[0], dir[1],
              0.03, 0.09, y0+0.18, y0+0.36, teinte(CADRE,1));
      boiteOr(mx + dir[0]*0.035, mz + dir[1]*0.035, dir[0], dir[1],
              0.03, 0.06, y0+0.21, y0+0.33, teinte(VITRE,1));
    }
  }else if(t === 3){                             // bergerie : abreuvoir
    boiteOr(mx + dir[0]*0.16, mz + dir[1]*0.16, dir[0], dir[1],
            0.07, 0.15, y0, y0+0.10, teinte('#7a6248',1));
  }else if(t === 4){                             // pêcherie : séchoir à filets
    for(const w of [-0.20, 0.20]){
      const x=mx+px*w, z=mz+pz*w;
      poutre([x, y0, z], [x, y0+0.42, z], 0.022, teinte('#6b5744',1));
    }
    poutre([mx+px*-0.20, y0+0.40, mz+pz*-0.20], [mx+px*0.20, y0+0.40, mz+pz*0.20],
           0.018, teinte('#6b5744',1));
    boiteOr(mx + dir[0]*0.03, mz + dir[1]*0.03, dir[0], dir[1],
            0.02, 0.19, y0+0.14, y0+0.39, teinte('#8fa07a',1));
  }else if(t === 5){                             // mine : chevalement
    for(const w of [-0.17, 0.17]) for(const l of [-0.05, 0.16]){
      const x=mx+px*w+dir[0]*l, z=mz+pz*w+dir[1]*l;
      poutre([x, y0, z], [mx+px*w*0.35+dir[0]*0.05, y0+0.86, mz+pz*w*0.35+dir[1]*0.05],
             0.024, teinte('#5f4c3b',1));
    }
    boiteOr(mx+dir[0]*0.05, mz+dir[1]*0.05, dir[0], dir[1], 0.09, 0.10,
            y0+0.86, y0+0.96, teinte('#4a4038',1));
    boiteOr(mx+dir[0]*0.05, mz+dir[1]*0.05, dir[0], dir[1], 0.03, 0.13,
            y0+0.96, y0+1.02, teinte('#6f6a5e',1));
  }else if(t === 6){                             // scierie : roue à aubes
    cheminees.push({x:mx - dir[0]*0.18, y:y0+0.30, z:mz - dir[1]*0.18, force:0.35});
    rotatifs.push({sorte:'roue', x:mx + dir[0]*0.16, y:y0 + 0.30,
                   z:mz + dir[1]*0.16, dx:dir[0], dz:dir[1], vit:0.32});
    boiteOr(mx + dir[0]*0.16, mz + dir[1]*0.16, dir[0], dir[1],
            0.30, 0.03, y0-0.10, y0+0.02, teinte('#5f6f6a',1));
  }else if(t === 12){                            // alchimie : cheminée tordue, herbes
    let x=mx-dir[0]*0.04, z=mz-dir[1]*0.04, yb=y0+0.20;
    for(let k=0;k<3;k++){
      const dx=(hash3(c.i,k,419)-0.5)*0.13, dz=(hash3(c.i,k,421)-0.5)*0.13;
      boiteOr(x+dx*0.5, z+dz*0.5, dir[0], dir[1], 0.075-k*0.012, 0.08-k*0.012,
              yb, yb+0.30, teinte('#4e4a6b',1));
      x+=dx; z+=dz; yb+=0.30;
    }
    cheminees.push({x, y:yb+0.02, z, force:0.75});
    for(let k=0;k<3;k++){
      const w=-0.16+k*0.16;
      poutre([mx+px*w, y0+0.46, mz+pz*w], [mx+px*w, y0+0.30, mz+pz*w], 0.012,
             teinte('#6f7a4a',1));
      boiteOr(mx+px*w, mz+pz*w, dir[0], dir[1], 0.03, 0.04, y0+0.24, y0+0.32,
              teinte('#5f7a3c',1));
    }
  }else if(t === 13){                            // auberge : enseigne suspendue
    const fer = teinte('#3b3a3f',1);
    poutre([mx+dir[0]*0.02, y0+0.50, mz+dir[1]*0.02],
           [mx+dir[0]*0.26, y0+0.50, mz+dir[1]*0.26], 0.012, fer);
    poutre([mx+dir[0]*0.03, y0+0.30, mz+dir[1]*0.03],
           [mx+dir[0]*0.22, y0+0.49, mz+dir[1]*0.22], 0.008, fer);
    poutre([mx+dir[0]*0.24, y0+0.49, mz+dir[1]*0.24],
           [mx+dir[0]*0.24, y0+0.42, mz+dir[1]*0.24], 0.007, fer);
    boiteOr(mx+dir[0]*0.24, mz+dir[1]*0.24, dir[0], dir[1], 0.012, 0.085,
            y0+0.22, y0+0.42, teinte('#7a5a3a',1));
    boiteOr(mx+dir[0]*0.245, mz+dir[1]*0.245, dir[0], dir[1], 0.006, 0.06,
            y0+0.26, y0+0.38, teinte('#d9b45f',1));
  }else if(t === 14){                            // pépinière : serre appuyée
    for(let k=0;k<4;k++){
      const w=-0.21+k*0.14;
      poutre([mx+px*w, y0, mz+pz*w], [mx+px*w+dir[0]*0.26, y0+0.02, mz+pz*w+dir[1]*0.26],
             0.010, teinte('#6b5744',1));
      poutre([mx+px*w, y0+0.34, mz+pz*w], [mx+px*w+dir[0]*0.26, y0+0.06, mz+pz*w+dir[1]*0.26],
             0.010, teinte('#6b5744',1));
    }
    for(let k=0;k<3;k++){
      const w=-0.21+k*0.14;
      pousserQuad([mx+px*w, y0+0.34, mz+pz*w],
                  [mx+px*(w+0.14), y0+0.34, mz+pz*(w+0.14)],
                  [mx+px*(w+0.14)+dir[0]*0.26, y0+0.06, mz+pz*(w+0.14)+dir[1]*0.26],
                  [mx+px*w+dir[0]*0.26, y0+0.06, mz+pz*w+dir[1]*0.26],
                  teinte('#cfe0d8', 1.05), [0,1,0], true);
    }
  }else if(t === TYPE_CASERNE && f === 0){       // caserne : brasero de garde
    const bx = mx + dir[0]*0.30 + px*0.26, bz = mz + dir[1]*0.30 + pz*0.26;
    for(let k=0;k<3;k++){
      const a=k/3*Math.PI*2;
      poutre([bx+Math.cos(a)*0.05, y0, bz+Math.sin(a)*0.05],
             [bx, y0+0.26, bz], 0.014, teinte('#3b3a3f',1));
    }
    boiteOr(bx, bz, 1, 0, 0.075, 0.075, y0+0.22, y0+0.30, teinte('#4a4850',1));
    lampeCourante = 2; lampeGroupe = 3;
    boiteOr(bx, bz, 1, 0, 0.06, 0.06, y0+0.30, y0+0.335, teinte('#ff7a2b',1));
    lampeCourante = 0; lampeGroupe = 0;
    cheminees.push({x:bx, y:y0+0.35, z:bz, force:0.55});
    banniereCaserne(c, mx, mz, dir, px, pz, y0);
  }else if(t === TYPE_CASERNE){                  // caserne : bannières
    for(let k=0;k<2;k++){
      const w = -0.16 + k*0.32;
      poutre([mx+px*w+dir[0]*0.02, y0+0.52, mz+pz*w+dir[1]*0.02],
             [mx+px*w+dir[0]*0.16, y0+0.55, mz+pz*w+dir[1]*0.16], 0.010,
             teinte('#3b3a3f',1));
      const coul = k ? '#8f3a3a' : '#3a5a8f';
      pousserQuad([mx+px*(w-0.05)+dir[0]*0.15, y0+0.54, mz+pz*(w-0.05)+dir[1]*0.15],
                  [mx+px*(w+0.05)+dir[0]*0.15, y0+0.54, mz+pz*(w+0.05)+dir[1]*0.15],
                  [mx+px*(w+0.05)+dir[0]*0.15, y0+0.14, mz+pz*(w+0.05)+dir[1]*0.15],
                  [mx+px*(w-0.05)+dir[0]*0.15, y0+0.14, mz+pz*(w-0.05)+dir[1]*0.15],
                  teinte(coul, 1), dehorsN(dir), true);
    }
  }else if(t === 7 && f === 2){                  // laiterie : souche de la chaudière
    const som = cheminee(mx - dir[0]*0.10 + px*0.22, mz - dir[1]*0.10 + pz*0.22,
                         dir[0], dir[1], y0+0.30, c.i*71+3);
    cheminees.push({x:mx - dir[0]*0.10 + px*0.22, y:som + 0.02,
                    z:mz - dir[1]*0.10 + pz*0.22, force:0.55});
    auventLaiterie(mx, mz, dir, px, pz, y0);
  }else if(t === 7){                             // laiterie : auvent et bidons
    const av = teinte('#b8492f',1);
    for(let k=0;k<5;k++){
      const w = -0.24 + k*0.12;
      pousserQuad([mx+px*w, y0+0.52, mz+pz*w],
                  [mx+px*(w+0.12), y0+0.52, mz+pz*(w+0.12)],
                  [mx+px*(w+0.12)+dir[0]*0.22, y0+0.40, mz+pz*(w+0.12)+dir[1]*0.22],
                  [mx+px*w+dir[0]*0.22, y0+0.40, mz+pz*w+dir[1]*0.22],
                  k%2 ? av : teinte('#f0ece0',1), [0,1,0], true);
    }
  }
}

/* ---- aménagement intérieur, orienté par la face ouverte ------------------- */
function interieur(c, L, t, d, y0, y1){
  const fond = [-d[0], -d[1]], px = -d[1], pz = d[0];
  const X = (a,b) => c.cx + fond[0]*a + px*b;
  const Z = (a,b) => c.cz + fond[1]*a + pz*b;

  if(t === 0){                                   /* forge. L'âtre n'est plus une
       caisse posée : c'est une gueule voûtée creusée dans le manteau de pierre,
       avec ses piédroits, son arc à claveaux et ses braises au fond. */
    const PIERRE = '#8a8078';
    const cx0 = X(0.24,-0.10), cz0 = Z(0.24,-0.10);
    // piédroits
    for(const e of [-0.135, 0.135]){
      boiteOr(X(0.24,-0.10+e), Z(0.24,-0.10+e), d[0], d[1], 0.09, 0.035,
              y0+0.02, y0+0.24, grain(PIERRE, 0.96, 0));
    }
    // arc à claveaux
    const N = 7, R = 0.135;
    for(let k=0;k<N;k++){
      const a0 = Math.PI*(k/N), a1 = Math.PI*((k+1)/N);
      const p = (a, r) => [X(0.24, -0.10 - Math.cos(a)*r), y0+0.24 + Math.sin(a)*r,
                           Z(0.24, -0.10 - Math.cos(a)*r)];
      const A0=p(a0,R), A1=p(a1,R), B0=p(a0,R+0.055), B1=p(a1,R+0.055);
      pousserQuad([A0[0],A0[1],A0[2]], [A1[0],A1[1],A1[2]],
                  [B1[0],B1[1],B1[2]], [B0[0],B0[1],B0[2]],
                  grain(PIERRE, 0.90 + hash3(c.i,k,1319)*0.20, 0), dehorsN(d), false);
    }
    // fond noir et braises
    boiteOr(cx0, cz0, d[0], d[1], 0.055, 0.135, y0+0.02, y0+0.34,
            teinte('#1c1917',1));
    lampeCourante = 2; lampeGroupe = 3;
    boiteOr(cx0, cz0, d[0], d[1], 0.045, 0.115, y0+0.03, y0+0.11,
            teinte('#ff8a2b',1));
    boiteOr(cx0, cz0, d[0], d[1], 0.030, 0.075, y0+0.11, y0+0.16,
            teinte('#ffce6a',1));
    lampeCourante = 0; lampeGroupe = 0;
    // manteau et hotte tronconique au-dessus
    boiteOr(X(0.24,-0.10), Z(0.24,-0.10), d[0], d[1], 0.10, 0.19, y0+0.42, y0+0.50,
            grain(PIERRE, 1.06, 0));
    for(let k=0;k<4;k++){
      const t0=k/4, t1=(k+1)/4;
      const l0=0.19*(1-t0*0.55), l1=0.19*(1-t1*0.55);
      const e0=0.10*(1-t0*0.45), e1=0.10*(1-t1*0.45);
      const px2=-d[1], pz2=d[0];
      const q=(l,e2)=>[[X(0.24,-0.10)+d[0]*e2+px2*l, Z(0.24,-0.10)+d[1]*e2+pz2*l],
                       [X(0.24,-0.10)+d[0]*e2-px2*l, Z(0.24,-0.10)+d[1]*e2-pz2*l],
                       [X(0.24,-0.10)-d[0]*e2-px2*l, Z(0.24,-0.10)-d[1]*e2-pz2*l],
                       [X(0.24,-0.10)-d[0]*e2+px2*l, Z(0.24,-0.10)-d[1]*e2+pz2*l]];
      const Q0=q(l0,e0), Q1=q(l1,e1);
      const ya=y0+0.50+(y1-y0-0.52)*t0, yb=y0+0.50+(y1-y0-0.52)*t1;
      for(let i=0;i<4;i++){
        const a=Q0[i], b=Q0[(i+1)%4], c2=Q1[(i+1)%4], e3=Q1[i];
        pousserQuad([a[0],ya,a[1]], [b[0],ya,b[1]], [c2[0],yb,c2[1]], [e3[0],yb,e3[1]],
                    grain('#4a423c', 0.90 + hash3(c.i,k*5+i,1321)*0.18, 0),
                    [(a[0]+b[0])/2 - X(0.24,-0.10), 0.3, (a[1]+b[1])/2 - Z(0.24,-0.10)],
                    false);
      }
    }
    // soufflet à deux caissons, sa buse et sa bringuebale
    boiteOr(X(0.20,0.20), Z(0.20,0.20), d[0], d[1], 0.10, 0.075, y0+0.14, y0+0.26,
            teinte('#6b4f3a',1));
    boiteOr(X(0.20,0.20), Z(0.20,0.20), d[0], d[1], 0.072, 0.052, y0+0.26, y0+0.34,
            teinte('#8a6a4e',1));
    boiteOr(X(0.20,0.20), Z(0.20,0.20), d[0], d[1], 0.078, 0.058, y0+0.24, y0+0.27,
            teinte('#3d3b40',1));
    poutre([X(0.14,0.14), y0+0.20, Z(0.14,0.14)],
           [X(0.20,0.02), y0+0.14, Z(0.20,0.02)], 0.016, teinte('#3d3b40',1));
    poutre([X(0.30,0.20), y0+0.34, Z(0.30,0.20)],
           [X(0.30,0.04), y0+0.50, Z(0.30,0.04)], 0.020, teinte('#6b5744',1));
  }else if(t === 1){                             // boulangerie : four et miches
    boiteOr(X(0.24,0), Z(0.24,0), d[0], d[1], 0.12, 0.20, y0+0.02, y0+0.26,
            teinte('#b98a63',1));
    boiteOr(X(0.24,0), Z(0.24,0), d[0], d[1], 0.09, 0.15, y0+0.26, y0+0.38,
            teinte('#b98a63',1));
    boiteOr(X(0.10,0), Z(0.10,0), d[0], d[1], 0.02, 0.09, y0+0.05, y0+0.19,
            teinte('#2b241f',1));
    boiteOr(X(-0.18,0), Z(-0.18,0), d[0], d[1], 0.08, 0.22, y0+0.02, y0+0.22,
            teinte('#8a6a4e',1));
    for(let k=-1;k<=1;k++){
      boiteOr(X(-0.18,k*0.12), Z(-0.18,k*0.12), d[0], d[1], 0.05, 0.04,
              y0+0.22, y0+0.28, teinte('#d9a55f',1));
    }
  }else if(t === 3){                             // bergerie : paille et râtelier
    tas(X(0.22,0.12), Z(0.22,0.12), 0.13, y0+0.02, 0.24, teinte('#d8bd6f',1));
    boiteOr(X(0.06,-0.20), Z(0.06,-0.20), d[0], d[1], 0.14, 0.05, y0+0.02, y0+0.24,
            teinte('#7a6248',1));
  }else if(t === 4){                             // pêcherie : cuves et poissons
    for(let k=0;k<3;k++){
      const b = -0.18 + k*0.18;
      boiteOr(X(0.22,b), Z(0.22,b), d[0], d[1], 0.08, 0.075, y0+0.02, y0+0.19,
              teinte('#7c6a52',1));
      boiteOr(X(0.22,b), Z(0.22,b), d[0], d[1], 0.06, 0.055, y0+0.19, y0+0.215,
              teinte('#93b6b3',1));
    }
    boiteOr(X(0.02,0.20), Z(0.02,0.20), d[0], d[1], 0.11, 0.06, y0+0.02, y0+0.10,
            teinte('#6f8f7a',1));
    poutre([X(0.34,-0.24), y1-0.05, Z(0.34,-0.24)], [X(-0.10,-0.24), y1-0.05, Z(-0.10,-0.24)],
           0.014, teinte('#4a3a30',1));
    for(let k=0;k<3;k++){
      boiteOr(X(0.24-k*0.14,-0.24), Z(0.24-k*0.14,-0.24), d[0], d[1], 0.055, 0.018,
              y1-0.20, y1-0.06, teinte('#9fb6bb',1));
    }
  }else if(t === 5){                             // mine : galerie et wagonnet
    boiteOr(X(0.26,0), Z(0.26,0), d[0], d[1], 0.12, 0.26, y0+0.02, y1-0.02,
            teinte('#2b2724',1));
    for(const b of [-0.14, 0.14]){
      poutre([X(0.14,b), y0+0.02, Z(0.14,b)], [X(0.14,b), y0+0.38, Z(0.14,b)],
             0.026, teinte('#5f4c3b',1));
    }
    poutre([X(0.14,-0.15), y0+0.38, Z(0.14,-0.15)], [X(0.14,0.15), y0+0.38, Z(0.14,0.15)],
           0.026, teinte('#5f4c3b',1));
    boiteOr(X(-0.06,0.06), Z(-0.06,0.06), d[0], d[1], 0.10, 0.08, y0+0.05, y0+0.18,
            teinte('#4a4850',1));
    tas(X(-0.06,0.06), Z(-0.06,0.06), 0.07, y0+0.18, 0.07, teinte('#2c2a2b',1));
    boiteOr(X(-0.18,-0.16), Z(-0.18,-0.16), d[0], d[1], 0.06, 0.06, y0+0.02, y0+0.09,
            teinte('#3b3a3f',1));
    lampeCourante = 2; lampeGroupe = 2;
    boiteOr(X(-0.18,-0.16), Z(-0.18,-0.16), d[0], d[1], 0.05, 0.05, y0+0.09, y0+0.12,
            teinte('#ff8a3a',1));
    lampeCourante = 0; lampeGroupe = 0;
  }else if(t === 6){                             // scierie : lame et grumes
    boiteOr(X(0.20,-0.02), Z(0.20,-0.02), d[0], d[1], 0.16, 0.05, y0+0.02, y0+0.16,
            teinte('#8a6a4e',1));
    boiteOr(X(0.20,-0.02), Z(0.20,-0.02), d[0], d[1], 0.02, 0.14, y0+0.16, y0+0.40,
            teinte('#b9c0c4',1));
    for(let k=0;k<2;k++){
      boiteOr(X(-0.14,-0.14+k*0.26), Z(-0.14,-0.14+k*0.26), d[0], d[1], 0.17, 0.055,
              y0+0.02, y0+0.13, teinte('#8f6f4d',1));
    }
    boiteOr(X(-0.02,0.20), Z(-0.02,0.20), d[0], d[1], 0.12, 0.06, y0+0.02, y0+0.08,
            teinte('#c9a97a',1));
  }else if(t === 12){                            // alchimie : chaudron, alambics
    boiteOr(X(0.24,0.14), Z(0.24,0.14), d[0], d[1], 0.09, 0.09, y0+0.02, y0+0.16,
            teinte('#3d3b40',1));
    lampeCourante = 2; lampeGroupe = 2;
    boiteOr(X(0.24,0.14), Z(0.24,0.14), d[0], d[1], 0.075, 0.075, y0+0.16, y0+0.195,
            teinte('#6fe08a',1));
    lampeCourante = 0; lampeGroupe = 0;
    boiteOr(X(0.22,-0.16), Z(0.22,-0.16), d[0], d[1], 0.10, 0.06, y0+0.02, y0+0.20,
            teinte('#7a6248',1));
    for(let k=0;k<3;k++){
      const b=-0.22+k*0.06;
      boiteOr(X(0.22,b), Z(0.22,b), d[0], d[1], 0.022, 0.022, y0+0.20, y0+0.32,
              teinte(k===1?'#8fd0c0':'#c8a0d8',1));
    }
    boiteOr(X(-0.10,-0.18), Z(-0.10,-0.18), d[0], d[1], 0.03, 0.14, y0+0.24, y0+0.27,
            teinte('#6b5744',1));
    for(let k=0;k<4;k++){
      boiteOr(X(-0.10,-0.24+k*0.10), Z(-0.10,-0.24+k*0.10), d[0], d[1], 0.02, 0.02,
              y0+0.27, y0+0.34, teinte(['#c46a6a','#6a9ac4','#9ac46a','#c4a86a'][k],1));
    }
  }else if(t === 13){                            // auberge : tables, tonneaux, âtre
    for(let k=0;k<2;k++){
      const b = -0.16 + k*0.30;
      boiteOr(X(0.06,b), Z(0.06,b), d[0], d[1], 0.15, 0.055, y0+0.14, y0+0.17,
              teinte('#8a6a4e',1));
      for(const e of [-0.12, 0.12])
        poutre([X(0.06+e,b), y0+0.02, Z(0.06+e,b)], [X(0.06+e,b), y0+0.14, Z(0.06+e,b)],
               0.014, teinte('#6b5744',1));
    }
    boiteOr(X(0.28,0.18), Z(0.28,0.18), d[0], d[1], 0.07, 0.07, y0+0.02, y0+0.22,
            teinte('#7a5a3a',1));
    boiteOr(X(0.28,-0.14), Z(0.28,-0.14), d[0], d[1], 0.06, 0.06, y0+0.02, y0+0.19,
            teinte('#7a5a3a',1));
    boiteOr(X(0.30,0.02), Z(0.30,0.02), d[0], d[1], 0.06, 0.13, y0+0.02, y0+0.16,
            teinte('#4a4038',1));
    lampeCourante = 2; lampeGroupe = 3;
    boiteOr(X(0.30,0.02), Z(0.30,0.02), d[0], d[1], 0.045, 0.10, y0+0.16, y0+0.185,
            teinte('#ff8a3a',1));
    lampeCourante = 0; lampeGroupe = 0;
  }else if(t === 14){                            // pépinière : étagères et pots
    for(let k=0;k<2;k++){
      const h = y0 + 0.12 + k*0.16;
      boiteOr(X(0.26,0), Z(0.26,0), d[0], d[1], 0.05, 0.24, h, h+0.025,
              teinte('#8a6a4e',1));
      for(let m=0;m<4;m++){
        const b=-0.18+m*0.12;
        boiteOr(X(0.26,b), Z(0.26,b), d[0], d[1], 0.035, 0.035, h+0.025, h+0.065,
                teinte('#a86f4e',1));
        boiteOr(X(0.26,b), Z(0.26,b), d[0], d[1], 0.03, 0.03, h+0.065, h+0.105,
                grain('#4f7f45', 0.86+hash3(c.i,m*3+k,431)*0.3, 0));
      }
    }
    boiteOr(X(-0.10,0.18), Z(-0.10,0.18), d[0], d[1], 0.07, 0.07, y0+0.02, y0+0.10,
            teinte('#6b563f',1));
  }else if(t === TYPE_CASERNE){                  // caserne : râteliers d'armes
    boiteOr(X(0.28,0), Z(0.28,0), d[0], d[1], 0.04, 0.26, y0+0.30, y0+0.335,
            teinte('#6b5744',1));
    for(let k=0;k<6;k++){
      const b=-0.22+k*0.09;
      poutre([X(0.28,b), y0+0.02, Z(0.28,b)], [X(0.26,b), y0+0.44, Z(0.26,b)],
             0.011, teinte(k%2?'#8a8a92':'#6b5744',1));
    }
    for(let k=0;k<2;k++){
      const b=-0.16+k*0.32;
      boiteOr(X(-0.06,b), Z(-0.06,b), d[0], d[1], 0.055, 0.075, y0+0.02, y0+0.18,
              teinte('#7a6248',1));
      boiteOr(X(-0.06,b), Z(-0.06,b), d[0], d[1], 0.045, 0.062, y0+0.18, y0+0.24,
              teinte('#8a8a92',1));
    }
  }else if(t === 7){                             // laiterie : barattes et meules
    for(let k=0;k<3;k++){
      const b = -0.17 + k*0.17;
      boiteOr(X(0.24,b), Z(0.24,b), d[0], d[1], 0.055, 0.055, y0+0.02, y0+0.22,
              teinte('#9aa7ab',1));
      boiteOr(X(0.24,b), Z(0.24,b), d[0], d[1], 0.035, 0.035, y0+0.22, y0+0.27,
              teinte('#6f7c80',1));
    }
    boiteOr(X(-0.10,0), Z(-0.10,0), d[0], d[1], 0.09, 0.20, y0+0.02, y0+0.20,
            teinte('#8a6a4e',1));
    for(let k=0;k<2;k++){
      boiteOr(X(-0.10,-0.09+k*0.18), Z(-0.10,-0.09+k*0.18), d[0], d[1], 0.06, 0.06,
              y0+0.20, y0+0.27, teinte('#e8d9a8',1));
    }
  }
}

/* ---- aménagement de la terrasse ------------------------------------------ */
function amenagement(c, t, dRet, y){
  const px = -dRet[1], pz = dRet[0];
  const X = (a,b) => c.cx + dRet[0]*a + px*b;
  const Z = (a,b) => c.cz + dRet[1]*a + pz*b;
  const av = [-dRet[0], -dRet[1]];

  if(t === 0){                                   /* forge. La cour prend un
       auvent charpenté sur deux poteaux contreventés, comme l'avant-toit des
       maisons de forgeron : c'est dessous qu'on bat le fer. */
    const bois = teinte('#6b5744',1), fer = teinte('#3d3b40',1);
    const px2=-av[1], pz2=av[0];
    for(const e of [-0.24, 0.24]){
      poutre([X(-0.26,e), y, Z(-0.26,e)], [X(-0.26,e), y+0.46, Z(-0.26,e)], 0.028, bois);
      poutre([X(-0.26,e), y+0.34, Z(-0.26,e)], [X(-0.10,e), y+0.50, Z(-0.10,e)],
             0.018, teinte('#5f4a34',1));
    }
    poutre([X(-0.26,-0.26), y+0.47, Z(-0.26,-0.26)], [X(-0.26,0.26), y+0.47, Z(-0.26,0.26)],
           0.024, bois);
    for(let k=0;k<5;k++){
      const w = -0.26 + k*0.104;
      pousserQuad([X(0.06,w), y+0.60, Z(0.06,w)], [X(0.06,w+0.104), y+0.60, Z(0.06,w+0.104)],
                  [X(-0.30,w+0.104), y+0.47, Z(-0.30,w+0.104)],
                  [X(-0.30,w), y+0.47, Z(-0.30,w)],
                  grain('#6f6a5e', 0.88 + hash3(c.i,k,1327)*0.22, 0), [0,1,0], false);
    }
    // enclume sur son billot, à l'abri
    boiteOr(X(-0.14,-0.02), Z(-0.14,-0.02), av[0], av[1], 0.075, 0.075, y, y+0.11, bois);
    boiteOr(X(-0.14,-0.02), Z(-0.14,-0.02), av[0], av[1], 0.085, 0.048, y+0.11, y+0.155,
            fer);
    boiteOr(X(-0.14,-0.02), Z(-0.14,-0.02), av[0], av[1], 0.045, 0.032, y+0.155, y+0.185,
            teinte('#4a4850',1));
    boiteOr(X(-0.05,-0.02), Z(-0.05,-0.02), av[0], av[1], 0.045, 0.022, y+0.135, y+0.165,
            fer);                                    // bigorne
    // marteau et tenailles posés dessus
    poutre([X(-0.16,-0.10), y+0.19, Z(-0.16,-0.10)],
           [X(-0.09,-0.06), y+0.19, Z(-0.09,-0.06)], 0.010, teinte('#8a6a4e',1));
    boiteOr(X(-0.08,-0.055), Z(-0.08,-0.055), av[0], av[1], 0.022, 0.014,
            y+0.185, y+0.205, fer);
    // baquet de trempe, cerclé
    boiteOr(X(-0.20,0.24), Z(-0.20,0.24), av[0], av[1], 0.072, 0.072, y, y+0.17, bois);
    boiteOr(X(-0.20,0.24), Z(-0.20,0.24), av[0], av[1], 0.076, 0.076, y+0.05, y+0.075,
            teinte('#4a4038',1));
    boiteOr(X(-0.20,0.24), Z(-0.20,0.24), av[0], av[1], 0.060, 0.060, y+0.17, y+0.185,
            teinte('#3f5c63',1));
    // meule à aiguiser sur son bâti
    rotatifs.push({sorte:'meule', x:X(0.16,-0.28), y:y+0.17, z:Z(0.16,-0.28),
                   dx:av[0], dz:av[1], vit:0.9});
    boiteOr(X(0.16,-0.28), Z(0.16,-0.28), av[0], av[1], 0.085, 0.048, y, y+0.11, bois);
    // barres de fer en faisceau contre le poteau
    for(let k=0;k<4;k++){
      const b = -0.30 + k*0.026;
      poutre([X(-0.24,b), y, Z(-0.24,b)], [X(-0.30,b), y+0.44, Z(-0.30,b)], 0.011,
             grain('#5a5f66', 0.9+hash3(c.i,k,1331)*0.2, 0));
    }
    // roue de charrette appuyée
    const rx = X(0.22,0.26), rz = Z(0.22,0.26), RR = 0.13;
    for(let k=0;k<10;k++){
      const a0=k/10*Math.PI*2, a1=(k+1)/10*Math.PI*2;
      const p=(a2)=>[rx + px2*Math.cos(a2)*RR + av[0]*0.02*Math.sin(a2),
                     y + 0.02 + RR + Math.sin(a2)*RR,
                     rz + pz2*Math.cos(a2)*RR + av[1]*0.02*Math.sin(a2)];
      const A2=p(a0), B2=p(a1);
      poutre(A2, B2, 0.012, teinte('#7a6248',1));
      if(k%2===0) poutre([rx, y+0.02+RR, rz], A2, 0.009, teinte('#8a6a4e',1));
    }
    tas(X(0.24,0.02), Z(0.24,0.02), 0.10, y, 0.14, teinte('#2c2a2b',1));   // charbon
  }else if(t === 1){                             // boulangerie : farine et étal
    for(let k=0;k<3;k++){
      const a=0.16-k*0.02, b=-0.20+k*0.13, h=0.17-k*0.01;
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.075, 0.065, y, y+h, teinte('#efe4cd',1));
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.045, 0.040, y+h, y+h+0.03,
              teinte('#dcd0b6',1));
    }
    boiteOr(X(-0.14,0.02), Z(-0.14,0.02), av[0], av[1], 0.09, 0.20, y+0.14, y+0.18,
            teinte('#8a6a4e',1));                                     // étal
    for(let k=0;k<4;k++){
      const b=-0.15+k*0.10;
      boiteOr(X(-0.14,b), Z(-0.14,b), av[0], av[1], 0.055, 0.035, y+0.18, y+0.24,
              teinte('#d9a55f',1));
    }
    for(const [a,b] of [[-0.20,-0.19],[-0.20,0.19],[-0.08,-0.19],[-0.08,0.19]]){
      poutre([X(a,b), y, Z(a,b)], [X(a,b), y+0.14, Z(a,b)], 0.018, teinte('#6b5744',1));
    }
    boiteOr(X(0.02,0.22), Z(0.02,0.22), av[0], av[1], 0.08, 0.08, y, y+0.13,
            teinte('#a8785a',1));                                     // cageot
  }else if(t === 5){                             // mine : rails, wagonnets, terril
    const rail = teinte('#5a5754',1);
    for(const b of [-0.07, 0.07]){
      poutre([X(0.34,b), y+0.012, Z(0.34,b)], [X(-0.34,b), y+0.012, Z(-0.34,b)], 0.014, rail);
    }
    for(let k=0;k<5;k++){
      const a = 0.30 - k*0.15;
      boiteOr(X(a,0), Z(a,0), av[0], av[1], 0.018, 0.11, y, y+0.02, teinte('#6b5744',1));
    }
    boiteOr(X(-0.06,0), Z(-0.06,0), av[0], av[1], 0.11, 0.085, y+0.03, y+0.17,
            teinte('#4a4850',1));
    tas(X(-0.06,0), Z(-0.06,0), 0.075, y+0.17, 0.06, teinte('#2c2a2b',1));
    tas(X(0.16,0.26), Z(0.16,0.26), 0.15, y, 0.20, teinte('#3a3634',1));
  }else if(t === 6){                             // scierie : grumes et planches
    for(let k=0;k<3;k++){
      const b = -0.20 + k*0.14;
      poutre([X(0.30,b), y+0.055, Z(0.30,b)], [X(-0.22,b), y+0.055, Z(-0.22,b)],
             0.055, grain('#9a7a55', 0.88 + hash3(c.i,k,307)*0.24, 0.1));
    }
    for(let k=0;k<4;k++){
      boiteOr(X(-0.02,0.24), Z(-0.02,0.24), av[0], av[1], 0.19, 0.075,
              y+0.02+k*0.035, y+0.05+k*0.035, teinte('#c9a97a', 0.9+k*0.05));
    }
    tas(X(0.26,-0.26), Z(0.26,-0.26), 0.11, y, 0.13, teinte('#c9b48a',1));
  }else if(t === 7){                             // laiterie : bidons et bancs
    for(let k=0;k<4;k++){
      const a = 0.22 - k*0.12, b = (hash3(c.i,k,311)-0.5)*0.32;
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.05, 0.05, y, y+0.17, teinte('#9aa7ab',1));
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.03, 0.03, y+0.17, y+0.21, teinte('#6f7c80',1));
    }
    boiteOr(X(-0.20,-0.16), Z(-0.20,-0.16), av[0], av[1], 0.06, 0.16, y+0.10, y+0.14,
            teinte('#8a6a4e',1));
  }else if(t === 12){                            // alchimie : jarres et cristaux
    for(let k=0;k<4;k++){
      const a=0.24-k*0.13, b=(hash3(c.i,k,433)-0.5)*0.34;
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.05, 0.05, y, y+0.13,
              teinte(['#5f6f8f','#6f5f8f','#4f6f7f','#7f5f6f'][k],1));
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.03, 0.03, y+0.13, y+0.16,
              teinte('#3d3b40',1));
    }
    lampeCourante = 2; lampeGroupe = 5;
    for(let k=0;k<3;k++){
      const a=-0.18, b=-0.14+k*0.14;
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.025, 0.025, y, y+0.10+k*0.03,
              teinte('#8fd8f0',1));
    }
    lampeCourante = 0; lampeGroupe = 0;
  }else if(t === 13){                            // auberge : terrasse et tonneaux
    for(let k=0;k<2;k++){
      const a=0.14-k*0.28, b=(hash3(c.i,k,439)-0.5)*0.26;
      boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.13, 0.13, y+0.14, y+0.17,
              teinte('#8a6a4e',1));
      poutre([X(a,b), y, Z(a,b)], [X(a,b), y+0.14, Z(a,b)], 0.022, teinte('#6b5744',1));
      for(const e of [-1,1]){
        boiteOr(X(a+0.19*e,b), Z(a+0.19*e,b), av[0], av[1], 0.05, 0.09, y+0.09, y+0.11,
                teinte('#7a6248',1));
        poutre([X(a+0.19*e,b), y, Z(a+0.19*e,b)], [X(a+0.19*e,b), y+0.09, Z(a+0.19*e,b)],
               0.016, teinte('#6b5744',1));
      }
    }
    boiteOr(X(0.30,0.26), Z(0.30,0.26), av[0], av[1], 0.07, 0.07, y, y+0.19,
            teinte('#7a5a3a',1));
  }else if(t === 14){                            // pépinière : couches et jeunes arbres
    for(let k=0;k<3;k++){
      const a=0.22-k*0.20;
      boiteOr(X(a,0), Z(a,0), av[0], av[1], 0.07, 0.26, y, y+0.06, teinte('#6b563f',1));
      for(let m=0;m<4;m++){
        const b=-0.19+m*0.13;
        boiteOr(X(a,b), Z(a,b), av[0], av[1], 0.035, 0.035, y+0.06, y+0.13,
                grain('#4f7f45', 0.84+hash3(c.i,k*7+m,443)*0.34, 0));
      }
    }
    for(let k=0;k<2;k++){
      const b=-0.22+k*0.44;
      poutre([X(-0.22,b), y, Z(-0.22,b)], [X(-0.22,b), y+0.22, Z(-0.22,b)], 0.016,
             teinte('#6b5744',1));
      boiteOr(X(-0.22,b), Z(-0.22,b), av[0], av[1], 0.07, 0.07, y+0.20, y+0.30,
              grain('#568449', 0.9, 0));
    }
  }else if(t === TYPE_CASERNE){                  // caserne : pieu d'entraînement
    poutre([X(0.10,0), y, Z(0.10,0)], [X(0.10,0), y+0.42, Z(0.10,0)], 0.038,
           teinte('#6b5744',1));
    poutre([X(0.10,-0.14), y+0.32, Z(0.10,-0.14)], [X(0.10,0.14), y+0.32, Z(0.10,0.14)],
           0.026, teinte('#6b5744',1));
    boiteOr(X(0.10,0), Z(0.10,0), av[0], av[1], 0.05, 0.05, y+0.42, y+0.50,
            teinte('#8a8a92',1));
    for(let k=0;k<3;k++){
      const b=-0.20+k*0.20;
      boiteOr(X(-0.22,b), Z(-0.22,b), av[0], av[1], 0.02, 0.075, y, y+0.20,
              teinte(['#8f3a3a','#e8e0d0','#3a5a8f'][k],1));
    }
    boiteOr(X(-0.05,0.26), Z(-0.05,0.26), av[0], av[1], 0.10, 0.06, y, y+0.14,
            teinte('#7a6248',1));
  }else if(t === 3){                             // bergerie : paille et brebis
    tas(X(0.20,-0.18), Z(0.20,-0.18), 0.12, y, 0.20, teinte('#d8bd6f',1));
    for(const [a,b,s] of [[-0.10,0.10,1],[0.02,-0.06,-1]]){
      boiteOr(X(a,b), Z(a,b), av[0]*s, av[1]*s, 0.11, 0.07, y+0.05, y+0.17,
              teinte('#efeae0',1));
      boiteOr(X(a-0.12*s,b), Z(a-0.12*s,b), av[0]*s, av[1]*s, 0.04, 0.045,
              y+0.09, y+0.17, teinte('#4a4038',1));
    }
  }
}

function pilotis(c, L, yb, y0){
  const S = c.q.map(v => P[v]);
  const {In} = coinsRentres(S, 0.13);
  const acier = teinte(METAL, 1);

  // sous-face du bloc porté
  pousserQuad([In[0][0],y0,In[0][1]], [In[1][0],y0,In[1][1]],
              [In[2][0],y0,In[2][1]], [In[3][0],y0,In[3][1]],
              teinte(BOIS, 1.1), [0,-1,0], true);

  // poutre de rive sous les arêtes libres
  const yR = y0 - 0.085;
  for(let i=0;i<4;i++){
    if(occ(c.nb[i], L-1)) continue;
    const A=S[i], B=S[(i+1)%4];
    poutre([A[0],yR,A[1]], [B[0],yR,B[1]], 0.05, acier);
  }

  // mât + contrefiches
  poutre([c.cx, yb, c.cz], [c.cx, y0-0.05, c.cz], 0.048, acier);
  const hb = Math.max(yb + 0.06, y0 - 0.46);
  for(let i=0;i<4;i++){
    poutre([c.cx, hb, c.cz], [In[i][0], y0-0.07, In[i][1]], 0.028, acier);
  }
}

/* Quand le vide est un trou DANS une colonne — du bâti au-dessus, du bâti en
   dessous — un mât central n'a aucun sens : il se planterait au milieu du toit
   inférieur. On ouvre un niveau à claire-voie, avec des poteaux d'angle posés
   sur la ligne des façades, des sablières entre eux et des aisseliers. */
function loggia(c, L, yb, y0){
  const S = c.q.map(v => P[v]);
  const {In} = coinsRentres(S, 0.12);
  const bois = teinte('#6b5744', 1), sombre = teinte('#54432f', 1);
  ctx = {c, L, k:'sol', e:-1};

  const pot = S.map(p => [p[0]*0.90 + c.cx*0.10, p[1]*0.90 + c.cz*0.10]);
  for(let i=0;i<4;i++){
    poutre([pot[i][0], yb, pot[i][1]], [pot[i][0], y0, pot[i][1]], 0.048, bois);
  }
  for(let i=0;i<4;i++){
    const nb = c.nb[i];
    const a = pot[i], b = pot[(i+1)%4];
    // sablière haute sur chaque côté ouvert
    if(!occ(nb, L-1)){
      poutre([a[0], y0-0.07, a[1]], [b[0], y0-0.07, b[1]], 0.038, sombre);
      // aisseliers : le report de charge revient sur les poteaux, donc sur la façade
      const m1 = [a[0]+(b[0]-a[0])*0.22, a[1]+(b[1]-a[1])*0.22];
      const m2 = [a[0]+(b[0]-a[0])*0.78, a[1]+(b[1]-a[1])*0.78];
      poutre([a[0], y0-0.30, a[1]], [m1[0], y0-0.075, m1[1]], 0.026, sombre);
      poutre([b[0], y0-0.30, b[1]], [m2[0], y0-0.075, m2[1]], 0.026, sombre);
    }
  }
  // sous-face du bloc porté
  pousserQuad([In[0][0],y0,In[0][1]], [In[1][0],y0,In[1][1]],
              [In[2][0],y0,In[2][1]], [In[3][0],y0,In[3][1]],
              teinte(BOIS, 1.1), [0,-1,0], true);
}

function renfort(c, L, rs){
  let Lb = -1;
  for(let k=L-1; k>=0; k--) if(occ(c,k)){ Lb = k; break; }
  const yb = (Lb+1)*H, y0 = L*H;
  if(y0 - yb < 0.05) return;
  let appuis = 0;
  for(let i=0;i<4;i++) if(occ(c.nb[i], L-1)) appuis++;
  ctx = {c, L, k:'sol', e:-1};
  if(Lb >= 0){
    loggia(c, L, yb, y0);                       // trou dans la colonne
  }else if(appuis >= 2){
    /* Passerelle entre deux piles. L'arche descendait jusqu'au sol, si bien
       qu'une maison posée pour relier deux tours faisait pousser un mur percé
       sur toute leur hauteur. Elle est maintenant limitée à une hauteur d'étage
       sous le plancher : un simple bloc arqué, qui prend appui sur ses deux
       voisines et laisse le vide dessous. C'est ce que la construction dit —
       on relie deux piles, on ne bâtit pas un viaduc. */
    arche(c, L, Math.max(yb, y0 - H*0.92), y0, rs);
  }else{
    pilotis(c, L, yb, y0);                      // pile isolée : on descend
  }
}

/* ---------- Toits ---------------------------------------------------------- */
/* Un niveau surmonté d'un vide puis de bâti ne porte pas un toit mais le
   plancher du niveau ouvert : pas de croupe, et il ne se fond pas dans les
   toits voisins. */
function aTerrasse(c, L){
  for(let k=L+2; k<c.b.length; k++) if(occ(c,k)) return true;
  return false;
}
/* Un atelier à pignons ne fusionne pas avec les toits voisins : sa couverture
   est une forme close, avec sa ligne de faîte et ses deux murs pignons. Le
   sortir du système de groupes est ce qui permet enfin aux bâtiments spéciaux
   d'avoir une silhouette propre au lieu d'être une maison ordinaire percée
   d'une façade ouverte. */
const estToit = (c,L) => occ(c,L) && !occ(c,L+1) &&
  !(c.sp[L] && PT(c.sp[L]).cour) &&
  !(c.sp[L] && (PT(c.sp[L]).pignon || PT(c.sp[L]).cone ||
                PT(c.sp[L]).plateforme)) &&
  !aTerrasse(c,L);

/* Couverture conique, pour les volumes ronds — moulin, tour. Elle prend le
   contour arrondi du niveau plutôt que le carré de la cellule, ce qui est tout
   l'intérêt : un moulin doit se lire comme un cylindre coiffé, pas comme une
   boîte. */
function toitCone(c, L, rs, cT, haut){
  const y1 = (L+1)*H;
  const bord = [];
  for(let i=0;i<4;i++){
    const e = rs.get(c.q[i]);
    if(e && e.r > 1e-4) for(const p of arcSommet(e, e.r)) bord.push(p);
    else bord.push(P[c.q[i]]);
  }
  const H2 = haut || 0.62;
  const som = [c.cx, y1 + REHAUSSE + H2, c.cz];
  ctx = {c, L, k:'toit', e:-1};
  const D = 0.075;
  const ext = bord.map(p=>{
    const dx=p[0]-c.cx, dz=p[1]-c.cz, l=Math.hypot(dx,dz)||1;
    return [p[0]+dx/l*D, p[1]+dz/l*D];
  });
  coneTuile(c.cx, c.cz, bord, y1 + REHAUSSE, som, cT, c.i*83+L, D);
  for(let k=0;k<bord.length;k++){
    const k2=(k+1)%bord.length;
    pousserQuad([bord[k][0],y1,bord[k][1]], [bord[k2][0],y1,bord[k2][1]],
                [ext[k2][0],y1+REHAUSSE,ext[k2][1]], [ext[k][0],y1+REHAUSSE,ext[k][1]],
                teinte(cT, 0.70), [0,-1,0], false);
  }
  poutre([c.cx, som[1]-0.03, c.cz], [c.cx, som[1]+0.16, c.cz], 0.014,
         teinte('#3b3a3f',1));
  boiteOr(c.cx, c.cz, 1, 0, 0.030, 0.030, som[1]+0.10, som[1]+0.17,
          teinte('#c9a227',1));
}

/* Lucarne à petit pignon, posée sur un quadrilatère de toiture sans le percer.
   Son volume masque naturellement les tuiles sous-jacentes. Les murs restent
   verticaux tandis que le dos remonte avec la pente : elle demeure lisible sur
   les toits irréguliers issus de la grille. */
function lucarneToit(A, B, C, D, dehors, cle, base, cT){
  const larg=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);
  const pente=(Math.hypot(D[0]-A[0],D[1]-A[1],D[2]-A[2])+
               Math.hypot(C[0]-B[0],C[1]-B[1],C[2]-B[2]))/2;
  if(larg < 0.52 || pente < 0.30) return;
  const ux=(B[0]-A[0])/larg, uz=(B[2]-A[2])/larg;
  const dl=Math.hypot(dehors[0],dehors[2])||1;
  const ox=dehors[0]/dl, oz=dehors[2]/dl;
  const mel=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t];
  const pt=(s,t)=>mel(mel(A,B,s),mel(D,C,s),t);
  const f0=pt(0.5,0.31), b0=pt(0.5,0.58);
  const w=Math.min(0.145,larg*0.18), sail=0.060;
  const f=(du,y,d=sail)=>[f0[0]+ux*du+ox*d,y,f0[2]+uz*du+oz*d];
  const b=(du,y,d=0.018)=>[b0[0]+ux*du+ox*d,y,b0[2]+uz*du+oz*d];
  const yb=f0[1]-0.008, ye=yb+0.205, ya=yb+0.315;
  const ybb=b0[1]-0.006, ybe=ybb+0.115, yba=ybb+0.205;
  const FL=f(-w,yb), FR=f(w,yb), FLE=f(-w,ye), FRE=f(w,ye), FA=f(0,ya);
  const BL=b(-w,ybb), BR=b(w,ybb), BLE=b(-w,ybe), BRE=b(w,ybe), BA=b(0,yba);
  const mur=grain(melangeHex(base,'#e5dcc7',0.58),0.96,0);
  const bois=grain('#5d4632',0.96,0);
  // façade, joues et deux petits pans
  pousserQuad(FL,FR,FRE,FLE,mur,dehors,false);
  pousserTri(FLE,FRE,FA,mur,false);
  pousserQuad(FL,FLE,BLE,BL,grain(base,0.78,0),[-ux,0,-uz],false);
  pousserQuad(FR,BR,BRE,FRE,grain(base,0.82,0),[ux,0,uz],false);
  pousserQuad(FLE,FA,BA,BLE,grainToit(cT,0.98,0,hash3(cle,1,1693)),[0,1,0],false);
  pousserQuad(FRE,BRE,BA,FA,grainToit(cT,0.88,0,hash3(cle,2,1697)),[0,1,0],false);
  poutre(FA,BA,0.014,grain('#4a392c',0.88,0));

  // fenêtre sombre, appui et croisillons sur le front
  const wf=w*0.48, wy0=yb+0.052, wy1=yb+0.166, d2=sail+0.008;
  const q=(du,y)=>f(du,y,d2);
  lampeCourante=1; lampeGroupe=hash3(cle,3,1709)>0.5?1:0;
  pousserQuad(q(-wf,wy0),q(wf,wy0),q(wf,wy1),q(-wf,wy1),
              teinte(VITRE,0.94),dehors,false);
  lampeCourante=0;
  for(const [a,b2] of [[q(-wf,wy0),q(-wf,wy1)],[q(wf,wy0),q(wf,wy1)],
                       [q(-wf,wy0),q(wf,wy0)],[q(-wf,wy1),q(wf,wy1)],
                       [q(0,wy0),q(0,wy1)]]) poutre(a,b2,0.009,bois);
  const ap0=f(-wf-0.025,wy0-0.025,d2+0.018), ap1=f(wf+0.025,wy0-0.025,d2+0.018);
  poutre(ap0,ap1,0.014,grain('#978d7e',1.0,0));
}

/* Toiture à deux pans. Le faîte court parallèlement à la face avant de
   l'atelier ; les deux longs pans débordent largement, les deux pignons sont
   des murs triangulaires coiffés d'un rampant. */
function toitPignon(c, L, r, cT, base, pente, chaume, lucarnes){
  const S = c.q.map(v => P[v]);
  const y1 = (L+1)*H;
  const yF = y1 + REHAUSSE + H_TOIT*(pente || 1.35);
  const i0 = r % 4, i1 = (r+1)%4, i2 = (r+2)%4, i3 = (r+3)%4;
  const mil = (a,b) => [(a[0]+b[0])/2, (a[1]+b[1])/2];
  const M1 = mil(S[i1], S[i2]), M3 = mil(S[i3], S[i0]);
  // débord : le faîte dépasse les pignons, les égouts dépassent les murs
  const ax = M1[0]-M3[0], az = M1[1]-M3[1], al = Math.hypot(ax,az)||1;
  const DF = 0.10, DE = 0.085;
  const F1 = [M1[0]+ax/al*DF, yF, M1[1]+az/al*DF];
  const F3 = [M3[0]-ax/al*DF, yF, M3[1]-az/al*DF];
  const dep = (a, i) => {
    const b = S[(i+1)%4];
    let nx = (a[0]+b[0])/2 - c.cx, nz = (a[1]+b[1])/2 - c.cz;
    const l = Math.hypot(nx,nz)||1;
    return [nx/l*DE, nz/l*DE];
  };
  ctx = {c, L, k:'toit', e:-1};
  for(const [ia, ib] of [[i0, i1], [i2, i3]]){
    const [ex, ez] = dep(S[ia], ia);
    const A=[S[ia][0]+ex, y1-0.03, S[ia][1]+ez], B=[S[ib][0]+ex, y1-0.03, S[ib][1]+ez];
    const deh=[(A[0]+B[0])/2-c.cx, 0.7, (A[2]+B[2])/2-c.cz];
    const dl=Math.hypot(deh[0],deh[2])||1;
    // sens du faîte : F1 du côté de S[ib] pour le premier pan
    const H1 = (ia===i0) ? F1 : F3, H3 = (ia===i0) ? F3 : F1;
    if(chaume){
      // chaume : deux cours épais, arrondis à l'égout
      for(let k=0;k<3;k++){
        const t0=k/3, t1=(k+1)/3;
        const p=(t,P0,P1)=>[P0[0]+(P1[0]-P0[0])*t, P0[1]+(P1[1]-P0[1])*t,
                            P0[2]+(P1[2]-P0[2])*t];
        pousserQuad(p(t0,A,H3), p(t0,B,H1), p(t1,B,H1), p(t1,A,H3),
                    grain('#c4a86a', 0.86 + hash3(c.i, k*7+ia, 1361)*0.24,
                          (hash3(c.i,k,1367)-0.5)*0.18), deh, false);
      }
    }else{
      paveToit(A, B, H1, H3, cT, c.i*97+L*11+ia, deh);
    }
    if(lucarnes && !chaume &&
       ia === (hash3(c.i,L,1717) > 0.5 ? i0 : i2) &&
       hash3(c.i,L,1721) > 0.28){
      lucarneToit(A, B, H1, H3, deh, c.i*193+L*17+ia, base, cT);
    }
    bandeauEgout([A[0],A[2]], [B[0],B[2]], [deh[0]/dl, deh[2]/dl],
                 [deh[0]/dl, deh[2]/dl], y1, cT);
  }
  // murs pignons, en maçonnerie, plus leur rampant
  for(const [ia, ib, F] of [[i1, i2, F1], [i3, i0, F3]]){
    const A=[S[ia][0], y1, S[ia][1]], B=[S[ib][0], y1, S[ib][1]];
    const deh=[(A[0]+B[0])/2-c.cx, 0, (A[2]+B[2])/2-c.cz];
    const som=[ (F[0]*0 + (A[0]+B[0])/2*0 + F[0])*0.5 + (A[0]+B[0])/4,
                F[1], (F[2])*0.5 + (A[2]+B[2])/4 ];
    const sommet=[(A[0]+B[0])/2 + (F[0]-(A[0]+B[0])/2)*0.0, F[1], (A[2]+B[2])/2];
    // triangle du pignon, appareillé
    const nb2 = 5;
    for(let k=0;k<nb2;k++){
      const t0=k/nb2, t1=(k+1)/nb2;
      const p=(t)=>[A[0]+(B[0]-A[0])*t, A[2]+(B[2]-A[2])*t];
      const h=(t)=>y1 + (F[1]-y1)*(1 - Math.abs(t*2-1));
      const P0=p(t0), P1=p(t1);
      pousserQuad([P0[0],y1,P0[1]], [P1[0],y1,P1[1]],
                  [P1[0],h(t1),P1[1]], [P0[0],h(t0),P0[1]],
                  grain(base, 0.88 + hash3(c.i, k*11+ia, 1373)*0.24,
                        (hash3(c.i,k,1381)-0.5)*0.2), deh, false);
    }
    // rampant : une baguette de pierre le long des deux versants du pignon
    const mid=[(A[0]+B[0])/2, (A[2]+B[2])/2];
    for(const P0 of [[A[0],A[2]], [B[0],B[2]]]){
      poutre([P0[0], y1-0.02, P0[1]], [mid[0], F[1]+0.015, mid[1]], 0.030,
             grain('#9d9384', 1.0, 0));
    }
  }
}

function terrasse(c, L, rs){
  const y1 = (L+1)*H;
  const bord = [];
  for(let i=0;i<4;i++){
    const e = rs.get(c.q[i]);
    if(e && e.r > 1e-4) for(const p of arcSommet(e, e.r)) bord.push(p);
    else bord.push(P[c.q[i]]);
  }
  ctx = {c, L, k:'toit', e:-1};
  for(let k=0;k<bord.length;k++){
    const k2=(k+1)%bord.length;
    pousserQuad([bord[k][0],y1,bord[k][1]], [bord[k2][0],y1,bord[k2][1]],
                [c.cx,y1,c.cz], [c.cx,y1,c.cz],
                grain('#9d9384', 0.86 + hash3(c.i,k,563)*0.24,
                      (hash3(c.i,k,569)-0.5)*0.18), [0,1,0], true);
  }
}

function groupesDeToits(){
  const app = new Map(), gr = [];
  for(const c0 of cellules){
    for(let L=0; L<c0.b.length; L++){
      if(!estToit(c0,L)) continue;
      const k = L+':'+c0.i;
      if(app.has(k)) continue;
      const id = gr.length, lot = [], pile = [c0];
      app.set(k, id);
      while(pile.length){
        const c = pile.pop();
        lot.push(c);
        for(let i=0;i<4;i++){
          const nb = c.nb[i];
          if(!nb || !estToit(nb,L)) continue;
          const kk = L+':'+nb.i;
          if(app.has(kk)) continue;
          app.set(kk, id);
          pile.push(nb);
        }
      }
      gr.push({L, cells:lot, decal:null,
               pente: 0.72 + hash3(lot[0].i, 3, 613)*0.95});
    }
  }
  /* Toits plats. Quatre maisons de même hauteur qui se rejoignent autour d'un
     sommet forment une seule plate-forme — c'est la règle de Townscaper, et
     elle se lit directement sur la grille : un sommet où quatre cellules de
     toit se rencontrent au même niveau. Toutes les quatre passent au plat, et
     deux plates-formes voisines se fondent sans mur entre elles. */
  const plats = new Set();
  parSommet.forEach((lot, sv)=>{
    if(lot.length !== 4) return;
    let hMax2 = 0;
    for(const q of lot) hMax2 = Math.max(hMax2, q.b.length);
    for(let L=0; L<hMax2; L++){
      if(lot.every(q => estToit(q, L))) lot.forEach(q => plats.add(L+':'+q.i));
    }
  });

  for(const g of gr){
    const acc = new Map();
    for(const c of g.cells){
      for(let i=0;i<4;i++){
        const nb = c.nb[i];
        if(nb && estToit(nb, g.L)) continue;
        if(occ(nb, g.L+1)) continue;
        const u = c.q[i], v = c.q[(i+1)%4];
        const mx = (P[u][0]+P[v][0])/2, mz = (P[u][1]+P[v][1])/2;
        let dx = c.cx-mx, dz = c.cz-mz;
        const l = Math.hypot(dx,dz) || 1;
        dx/=l; dz/=l;
        for(const s of [u,v]){
          if(!acc.has(s)) acc.set(s,[0,0,Infinity]);
          const a = acc.get(s);
          a[0]+=dx; a[1]+=dz;
          a[2] = Math.min(a[2], Math.hypot(c.cx-P[s][0], c.cz-P[s][1]));
        }
      }
    }
    const m = new Map();
    acc.forEach((a,s)=>{
      const l = Math.hypot(a[0],a[1]);
      if(l < 1e-3){ m.set(s,[0,0]); return; }
      const d = Math.min(D_TOIT, a[2]*0.72);
      m.set(s, [a[0]/l*d, a[1]/l*d]);
    });
    /* Sur une plate-forme le faîtage ne se décale pas : la couverture part du
       coin brut, sinon le bord du plat ne rejoindrait pas celui du voisin.
       Et le groupe entier passe à faible pente : le plat se situe à la hauteur
       du faîtage, or avec une pente ordinaire celui-ci culmine à près de
       soixante centimètres au-dessus des murs — la terrasse se retrouvait
       perchée sur un tambour vertical d'un demi-étage, et le parapet semblait
       flotter. À 0,30 elle n'est plus qu'à treize centimètres. */
    let aPlat = false;
    for(const c of g.cells){
      if(!plats.has(g.L+':'+c.i)) continue;
      aPlat = true;
      for(const v of c.q) m.set(v, [0,0]);
    }
    if(aPlat) g.pente = 0.30;
    g.decal = m;
  }
  return {app, gr, plats};
}

/* Couverture conique : mêmes assises que les pans droits. Un cône dessiné
   d'un seul tenant n'a ni rang ni tuile ; on le découpe en quatre cours, avec
   la variation de teinte par pan et la bande d'ombre du recouvrement au haut
   de chaque cours. */
function coneTuile(cx, cz, pts, yBas, som, base, cle, debord){
  const N = pts.length, NV = 4;
  const ext = pts.map(p=>{
    const dx=p[0]-cx, dz=p[1]-cz, l=Math.hypot(dx,dz)||1;
    return [p[0]+dx/l*(debord||0), p[1]+dz/l*(debord||0)];
  });
  const H2 = som[1] - yBas;
  const bague = (t) => ext.map(p=>[cx+(p[0]-cx)*(1-t), yBas + H2*Math.pow(t, 0.88),
                                   cz+(p[1]-cz)*(1-t)]);
  const BG = [];
  for(let v=0; v<=NV; v++) BG.push(bague(v/NV));
  for(let v=0; v<NV; v++){
    for(let k=0;k<N;k++){
      const k2=(k+1)%N;
      const a=BG[v][k], b=BG[v][k2], c2=BG[v+1][k2], d=BG[v+1][k];
      const deh=[(a[0]+b[0])/2-cx, 0.5, (a[2]+b[2])/2-cz];
      pousserQuad(a, b, c2, d,
                  grain(base, 0.88 + hash3(cle, v*13+k, 17)*0.20,
                        (hash3(cle, v*17+k, 19)-0.5)*0.18), deh, false);
      // bande d'ombre au haut du cours
      const f = 0.82;
      const a2=[a[0]+(d[0]-a[0])*f, a[1]+(d[1]-a[1])*f, a[2]+(d[2]-a[2])*f];
      const b2=[b[0]+(c2[0]-b[0])*f, b[1]+(c2[1]-b[1])*f, b[2]+(c2[2]-b[2])*f];
      const e=0.004, n=[deh[0], 0.5, deh[2]], nl=Math.hypot(n[0],n[1],n[2])||1;
      const dd=(p)=>[p[0]+n[0]/nl*e, p[1]+n[1]/nl*e, p[2]+n[2]/nl*e];
      pousserQuad(dd(a2), dd(b2), dd(c2), dd(d),
                  grain(base, 0.79 + hash3(cle, v, 23)*0.05, -0.05), deh, false);
    }
  }
}

/* Trottoir. Un liseré posé à même le sol suivait la grille du pavage, donc des
   carrés — alors que le mur, lui, tourne aux angles. Cette bande-ci suit le
   contour RÉEL du bâtiment, congés compris, et se relève de six millimètres :
   la petite marche évite qu'elle se dispute le plan du pavage, et elle se lit
   comme une bordure de rue plutôt que comme une teinte différente. */
function trottoir(c, rs, base){
  const y = SOL + 0.006, LARG = 0.115;
  const seg = (A, B, cle) => {
    const len = dist2d(A,B);
    if(len < 1e-4) return;
    const ux=(B[0]-A[0])/len, uz=(B[1]-A[1])/len;
    let ox = (A[0]+B[0])/2 - c.cx, oz = (A[1]+B[1])/2 - c.cz;
    const l = Math.hypot(ox,oz) || 1; ox/=l; oz/=l;
    const n = Math.max(1, Math.round(len/0.20));
    for(let k=0;k<n;k++){
      const u0 = len*k/n, u1 = len*(k+1)/n;
      const P0=[A[0]+ux*u0, A[1]+uz*u0], P1=[A[0]+ux*u1, A[1]+uz*u1];
      const Q0=[P0[0]+ox*LARG, P0[1]+oz*LARG], Q1=[P1[0]+ox*LARG, P1[1]+oz*LARG];
      const coul = grain(BORDURE[Math.floor(hash3(cle,k,1193)*BORDURE.length)],
                         0.94 + hash3(cle,k,1201)*0.14, (hash3(cle,k,1213)-0.5)*0.12);
      pousserQuad([P0[0],y,P0[1]], [P1[0],y,P1[1]], [Q1[0],y,Q1[1]], [Q0[0],y,Q0[1]],
                  coul, [0,1,0], false);
      pousserQuad([Q0[0],SOL,Q0[1]], [Q1[0],SOL,Q1[1]], [Q1[0],y,Q1[1]], [Q0[0],y,Q0[1]],
                  teinte('#a9a094', 0.82), [ox,0,oz], false);
    }
  };
  ctx = {c, L:0, k:'terre', e:-1};
  for(let i=0;i<4;i++){
    if(occ(c.nb[i], 0)) continue;
    const [A,B] = bornes(rs, c, i);
    seg(A, B, c.i*61 + i);
  }
  // les congés d'angle : le trottoir tourne avec le mur
  for(let j=0;j<4;j++){
    const e = rs.get(c.q[j]);
    if(!e || e.r <= 1e-4) continue;
    const pts = arcSommet(e, e.r);
    for(let k=0;k<pts.length-1;k++) seg(pts[k], pts[k+1], c.i*67 + j*5 + k);
  }
}

/* Sol de terrasse : un plancher, pas un dallage. Le pavé appartient à la rue ;
   sur un toit on marche sur des lames de bois posées en travers, ce qui donne
   au passage une direction au sol et distingue la plate-forme du sol du bourg. */
function plancherTerrasse(S, y, cle){
  const pt = (u, v) => {
    const a = [S[0][0]+(S[1][0]-S[0][0])*u, S[0][2]+(S[1][2]-S[0][2])*u];
    const b = [S[3][0]+(S[2][0]-S[3][0])*u, S[3][2]+(S[2][2]-S[3][2])*u];
    return [a[0]+(b[0]-a[0])*v, a[1]+(b[1]-a[1])*v];
  };
  const LAMES = ['#9a7a55','#8e7150','#a6845c','#93764f'];
  const N = 9;
  for(let i=0;i<N;i++){
    const t0=i/N, t1=(i+1)/N;
    // les lames sont coupées en deux ou trois longueurs, joints décalés
    let j = 0;
    while(j < 3){
      const n = (hash3(cle, i*7+j, 1163) > 0.55 && j < 2) ? 2 : 1;
      const v0 = j/3, v1 = Math.min(1, (j+n)/3);
      const p0=pt(t0,v0), p1=pt(t1,v0), p2=pt(t1,v1), p3=pt(t0,v1);
      pousserQuad([p0[0],y,p0[1]], [p1[0],y,p1[1]], [p2[0],y,p2[1]], [p3[0],y,p3[1]],
                  grain(LAMES[Math.floor(hash3(cle, i*11+j, 1171)*LAMES.length)],
                        0.90 + hash3(cle, i*13+j, 1181)*0.20,
                        (hash3(cle, i*17+j, 1187)-0.5)*0.16), [0,1,0], false);
      j += n;
    }
  }
}

/* Ce qu'on trouve sur une terrasse. Un menu d'aménagements, dont trois sont
   tirés par plate-forme : chacune est donc différente, sans être encombrée.
   Tout part dans le tampon des détails — pas d'ombre portée. */
function mobilierTerrasse(c, y, cle){
  const S = c.q.map(v => P[v]);
  const pt = (u, v) => {
    const a = [S[0][0]+(S[1][0]-S[0][0])*u, S[0][1]+(S[1][1]-S[0][1])*u];
    const b = [S[3][0]+(S[2][0]-S[3][0])*u, S[3][1]+(S[2][1]-S[3][1])*u];
    return [a[0]+(b[0]-a[0])*v, a[1]+(b[1]-a[1])*v];
  };

  /* Tenture. Grande, et souple : le bord haut pend en chaînette entre ses deux
     points d'accroche, chaque lé se décale un peu du précédent et le bord bas
     ondule. Une simple bande rectangulaire faisait pancarte. */
  const tenture = (u0, v0, u1, v1, hMax, coul, g)=>{
    const a = pt(u0, v0), b = pt(u1, v1);
    const N = 7;
    poutre([a[0], y+0.34, a[1]], [b[0], y+0.34, b[1]], 0.007, teinte('#5a4632',1));
    for(let k=0;k<N;k++){
      const t0=k/N, t1=(k+1)/N;
      const P0=[a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0];
      const P1=[a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1];
      // ventre de la corde, puis gonflement du tissu
      const sag = (t)=> 0.34 - Math.sin(Math.PI*t)*0.035;
      const gon = (t)=> (hash3(g, Math.round(t*100), 1093)-0.5)*0.022;
      const h0 = hMax*(0.80 + 0.20*Math.sin(t0*7.3 + g));
      const h1 = hMax*(0.80 + 0.20*Math.sin(t1*7.3 + g));
      const d0 = gon(t0), d1 = gon(t1);
      const nx = -(b[1]-a[1]), nz = (b[0]-a[0]);
      const l = Math.hypot(nx,nz)||1;
      const o0=[P0[0]+nx/l*d0, P0[1]+nz/l*d0], o1=[P1[0]+nx/l*d1, P1[1]+nz/l*d1];
      pousserQuad([o0[0], y+sag(t0), o0[1]], [o1[0], y+sag(t1), o1[1]],
                  [o1[0], y+sag(t1)-h1, o1[1]], [o0[0], y+sag(t0)-h0, o0[1]],
                  grain(coul, 0.94 + hash3(g,k,1097)*0.14, 0), [nx/l,0,nz/l], false);
    }
  };

  const LINGE = ['#e8e2d4','#d9a3a8','#a8c0d9','#e0cf9a','#c6d9a8','#d4c2e0'];
  const POTS  = ['#a86f4e','#96634a','#b07a58'];

  const AMENAGEMENTS = [
    // grande tenture en travers
    ()=>{ tenture(0.10, 0.24, 0.90, 0.34, 0.26,
                  LINGE[Math.floor(hash3(cle,1,1103)*LINGE.length)], cle); },
    // deux tentures parallèles, plus courtes
    ()=>{ tenture(0.14, 0.62, 0.86, 0.70, 0.20,
                  LINGE[Math.floor(hash3(cle,2,1109)*LINGE.length)], cle+5);
          tenture(0.18, 0.30, 0.62, 0.24, 0.16,
                  LINGE[Math.floor(hash3(cle,3,1117)*LINGE.length)], cle+9); },
    // table et bancs
    ()=>{ const q = pt(0.42, 0.46);
          boiteOr(q[0], q[1], 1, 0, 0.075, 0.135, y+0.155, y+0.175, teinte('#8a6a4e',1));
          for(const e of [-0.055, 0.055])
            for(const f of [-0.10, 0.10])
              poutre([q[0]+e, y, q[1]+f], [q[0]+e, y+0.155, q[1]+f], 0.013,
                     teinte('#6b5744',1));
          for(const e of [-0.115, 0.115]){
            boiteOr(q[0]+e, q[1], 1, 0, 0.032, 0.115, y+0.085, y+0.100,
                    teinte('#7a6248',1));
            for(const f of [-0.08, 0.08])
              poutre([q[0]+e, y, q[1]+f], [q[0]+e, y+0.085, q[1]+f], 0.010,
                     teinte('#6b5744',1));
          } },
    // lanterne sur son mât
    ()=>{ const q = pt(0.72, 0.28), fer = teinte('#33323a',1);
          poutre([q[0], y, q[1]], [q[0], y+0.40, q[1]], 0.014, fer);
          poutre([q[0], y+0.40, q[1]], [q[0]+0.07, y+0.40, q[1]], 0.010, fer);
          boiteOr(q[0]+0.07, q[1], 1, 0, 0.034, 0.034, y+0.30, y+0.38, fer);
          lampeCourante = 1; lampeGroupe = 2;
          boiteOr(q[0]+0.07, q[1], 1, 0, 0.026, 0.026, y+0.31, y+0.37,
                  teinte('#ffd08a', 1.2));
          lampeCourante = 0; lampeGroupe = 0;
          boiteOr(q[0]+0.07, q[1], 1, 0, 0.040, 0.040, y+0.38, y+0.415, fer); },
    // brasero
    ()=>{ const q = pt(0.30, 0.70);
          for(let k=0;k<3;k++){
            const a2=k/3*Math.PI*2;
            poutre([q[0]+Math.cos(a2)*0.045, y, q[1]+Math.sin(a2)*0.045],
                   [q[0], y+0.20, q[1]], 0.012, teinte('#3b3a3f',1));
          }
          boiteOr(q[0], q[1], 1, 0, 0.062, 0.062, y+0.17, y+0.24, teinte('#4a4850',1));
          lampeCourante = 2; lampeGroupe = 3;
          boiteOr(q[0], q[1], 1, 0, 0.050, 0.050, y+0.24, y+0.265, teinte('#ff7a2b',1));
          lampeCourante = 0; lampeGroupe = 0; },
    // potées alignées le long d'un bord
    ()=>{ for(let k=0;k<4;k++){
            const q = pt(0.16 + k*0.22, 0.84);
            const r = 0.034 + hash3(cle,k,1123)*0.014;
            boiteOr(q[0], q[1], 1, 0, r, r, y, y+r*1.9,
                    grain(POTS[k%POTS.length], 0.9+hash3(cle,k,1129)*0.2, 0));
            boiteOr(q[0], q[1], 1, 0, r*0.88, r*0.88, y+r*1.9, y+r*3.4,
                    grain('#4f7f45', 0.86+hash3(cle,k,1151)*0.3, 0));
          } },
    // tonneaux et caisses
    ()=>{ const q = pt(0.78, 0.76);
          boiteOr(q[0], q[1], 1, 0, 0.048, 0.048, y, y+0.155, teinte('#7a5a3a',1));
          boiteOr(q[0], q[1], 1, 0, 0.052, 0.052, y+0.05, y+0.075, teinte('#4a4038',1));
          const b = pt(0.62, 0.86);
          boiteOr(b[0], b[1], 1, 0, 0.052, 0.052, y, y+0.095, teinte('#a8845c',1));
          boiteOr(b[0], b[1], 1, 0, 0.040, 0.040, y+0.095, y+0.165, teinte('#96764f',1)); },
    // tendelet rayé sur quatre montants
    ()=>{ const o = pt(0.74, 0.30), RAY = ['#c9503f','#f0e6d2'];
          for(let k=0;k<5;k++){
            const w = -0.125 + k*0.05;
            pousserQuad([o[0]+w, y+0.34, o[1]-0.125], [o[0]+w+0.05, y+0.34, o[1]-0.125],
                        [o[0]+w+0.05, y+0.27, o[1]+0.125], [o[0]+w, y+0.27, o[1]+0.125],
                        grain(RAY[k%2], 1.0, 0), [0,1,0], false);
          }
          for(const e of [[-0.125,-0.125],[0.125,-0.125],[-0.125,0.125],[0.125,0.125]])
            poutre([o[0]+e[0], y, o[1]+e[1]], [o[0]+e[0], y+0.32, o[1]+e[1]], 0.011,
                   teinte('#6b5744',1)); }
  ];

  // trois aménagements distincts par plate-forme
  const pris = new Set();
  for(let k=0; k<3; k++){
    let i = Math.floor(hash3(cle, k, 1153)*AMENAGEMENTS.length);
    let garde = 0;
    while(pris.has(i) && garde++ < AMENAGEMENTS.length) i = (i+1) % AMENAGEMENTS.length;
    pris.add(i);
    AMENAGEMENTS[i]();
  }
}

/* Corniche d'égout : bandeau saillant sous le bas du toit. Chaque extrémité
   porte sa propre normale, ce qui permet de suivre les congés d'angle sans
   décrochement. Fermé dessus, dessous et devant. */
function bandeauEgout(a, b, na, nb, y1, coul){
  const yh = y1 - 0.030, yb2 = yh - H_CORN;
  const A2 = [a[0]+na[0]*CORNICHE, a[1]+na[1]*CORNICHE];
  const B2 = [b[0]+nb[0]*CORNICHE, b[1]+nb[1]*CORNICHE];
  const deh = [(na[0]+nb[0])/2, 0, (na[1]+nb[1])/2];
  pousserQuad([a[0],yh,a[1]], [b[0],yh,b[1]], [B2[0],yh,B2[1]], [A2[0],yh,A2[1]],
              teinte(coul, 1.06), [0,1,0], false);
  pousserQuad([A2[0],yb2,A2[1]], [B2[0],yb2,B2[1]], [B2[0],yh,B2[1]], [A2[0],yh,A2[1]],
              teinte(coul, 0.88), deh, false);
  pousserQuad([a[0],yb2,a[1]], [b[0],yb2,b[1]], [B2[0],yb2,B2[1]], [A2[0],yb2,A2[1]],
              teinte(coul, 0.58), [0,-1,0], false);
}

/* ---------- Assemblage ----------------------------------------------------- */
let grToits = null, appToits = null;
let empreinteForet = '', graineVague = null, grainePoissons = null;
let mouettesPretes = false;
const statsPerf = { reconstructionMs:0, trianglesVille:0, trianglesDetails:0,
                    trianglesTerrain:0, trianglesForet:0 };
window.bourgStats = statsPerf;

function construire(){
  const debutConstruction = performance.now();
  vide(pos); vide(col); vide(nor); vide(lam);
  vide(posD); vide(colD); vide(norD); detail = false;
  for(let g=0;g<NB_LUEURS;g++){ vide(lpos[g]); vide(lcol[g]); }
  meta = []; rotatifs = []; cheminees = []; perchoirs = [];
  const sigSol = empreinteSol();
  if(sigSol !== empreinteTerrain){
    construireTerrain();
    empreinteTerrain = sigSol;
  }
  const {app, gr, plats} = groupesDeToits();
  appToits = app; grToits = gr;
  const RS = tousContours();

  const couleurToit = (c,L) => {
    const sp = c.sp[L];
    if(sp) return PT(sp).toit || TYPES[sp.t].toit;
    const groupe = gr[app.get(L+':'+c.i)];
    const cleToit = groupe && groupe.cells.length ? groupe.cells[0].i : c.i;
    return TOITS[Math.floor(hash3(cleToit, 77, 3)*TOITS.length)];
  };
  const faitage = (c,L) => {
    const g = gr[app.get(L+':'+c.i)];
    const m = g ? g.decal : new Map();
    const yF = (L+1)*H + REHAUSSE + H_TOIT*(g ? g.pente : 1);
    return c.q.map(v => {
      const d = m.get(v) || [0,0];
      return [P[v][0]+d[0], yF, P[v][1]+d[1]];
    });
  };

  /* Arête portant une tourelle. Elle est décidée une fois pour le bâtiment, à
     son niveau haut, mais il faut la connaître à TOUS les niveaux : un mur
     masqué par une tourelle ne doit pas percer de fenêtres, sinon on ouvre des
     baies sur de la maçonnerie. */
  const areteTourelle = (c) => {
    const L = c.b.length-1;
    if(L < 1 || c.sp[L] || hash3(c.i, 13, 857) <= 0.90) return -1;
    const rs = RS[L] || new Map();
    let best=-1, bl=0;
    for(let i=0;i<4;i++){
      if(occ(c.nb[i], L)) continue;
      const [A2,B2] = bornes(rs, c, i);
      const l2 = dist2d(A2,B2);
      if(l2 > bl){ bl = l2; best = i; }
    }
    return best;
  };

  for(const c of cellules){
    if(!c.b.length) continue;
    const S = c.q.map(v => P[v]);
    const iTour = areteTourelle(c);

    if(occ(c, 0) && !(c.sp[0] && PT(c.sp[0]).cour)) trottoir(c, RS[0] || new Map(), null);

    for(let L=0; L<c.b.length; L++){
      if(!occ(c,L)) continue;
      const y0 = L*H, y1 = (L+1)*H;
      let arcadeFaite = false;
      const rs   = RS[L] || new Map();
      const spe  = c.sp[L];
      const part = spe ? PT(spe) : null;

      if(TYPES[spe ? spe.t : 0] && spe && TYPES[spe.t].bloc4){
        // une seule fois, depuis la part d'ancrage
        if(spe.p === 0){
          // sommet commun aux quatre cellules de la tour
          let sv = -1;
          for(const v of c.q){
            const lot = parSommet.get(v);
            if(lot && lot.length === 4 &&
               lot.every(q => q.sp[L] && q.sp[L].t === spe.t)){ sv = v; break; }
          }
          if(sv >= 0){
            ctx = {c, L, k:'mur', e:-1};
            tourSombre(P[sv][0], P[sv][1], L*H,
                       TYPES[spe.t].niveaux * H);
          }
        }
        continue;
      }
      if(part && part.cour){
        courSpeciale(c, L, spe, part);
        if(L > 0 && !occ(c,L-1)) renfort(c, L, rs);
        continue;
      }

      if(spe){
        corpsSpecial(c, L, spe, part, rs);
      }else{
        const base = PAL[c.b[L]];
        // une tour fortifiée reste maçonnée : pas de pan de bois dessus
        const cleBat = aCreneaux(c, c.b.length-1) ? undefined : c.i;
        /* Escalier extérieur : dès DEUX niveaux. Le rez-de-chaussée sert de
           cellier, on entre au premier par une volée qui descend à la rue. */
        const porteHaute = c.b.length >= 2 && hash3(c.i, 12, 811) > 0.72;
        const faceOriel = Math.floor(hash3(c.i,25,1749)*4);
        const orielActif = L >= 1 && L === c.b.length-1 &&
                           hash3(c.i,26,1751) > 0.80;
        /* Maison-arche. Quand une cellule relie deux piles au-dessus du vide,
           il ne faut pas lui bâtir des murs pleins puis glisser une arche en
           dessous — c'était bien le défaut : une maison, et une arche. La
           cellule DEVIENT l'arche. Sur les faces qui donnent sur le vide, on ne
           dessine aucun mur ordinaire : le panneau percé traverse toute la
           hauteur du niveau, de la naissance au sol jusqu'à la sablière, et la
           maison se lit comme un porche habité. */
        const arcade = L > 0 && !occ(c, L-1) && !spe &&
          [0,1,2,3].reduce((a,i)=> a + (occ(c.nb[i], L-1) ? 1 : 0), 0) >= 2;
        for(let i=0;i<4;i++){
          if(occ(c.nb[i], L)) continue;
          if(arcade && !occ(c.nb[i], L-1)) continue;   // c'est l'arche qui tient ce mur
          const [A,B] = bornes(rs, c, i);
          const dehors = [(A[0]+B[0])/2-c.cx, 0, (A[1]+B[1])/2-c.cz];
          const cle = c.i*211 + L*29 + i;
          ctx = {c, L, k:'mur', e:i};
          const porteOriel = orielActif && i === faceOriel && i !== iTour;
          const ouvertures = porteOriel ? []
            : baies(cle, dist2d(A,B), L, i === iTour, porteHaute);
          murTexture(A, B, y0, y1, dehors, base, cle, ouvertures, cleBat);
          if(porteOriel){
            detail = true;
            orielFacade(A, B, y0, y1, dehors, cle, base);
            detail = false;
          }
          /* Un profil marchand sur quatre porte son premier étage sur
             corbeaux. La décision appartient au bâtiment, donc toutes ses
             façades exposées emploient le même langage. */
          if(L === 1 && hash3(c.i, 24, 1651) > 0.74){
            detail = true;
            encorbellementFacade(A, B, y0, dehors, cle);
            detail = false;
          }
        }
        if(arcade){
          arcadeFaite = true;
          for(let i=0;i<4;i++){
            if(occ(c.nb[i], L) || occ(c.nb[i], L-1)) continue;
            /* La travée prend les coins BRUTS de la cellule, et déborde encore
               de quatre centimètres à chaque bout. Prise sur le contour arrondi
               des murs, elle s'arrêtait en retrait des angles : il restait un
               jour entre la naissance de l'arc et la maison voisine. En
               l'élargissant, l'arc mord sur les deux piles et se fond dedans. */
            const A0 = S[i], B0 = S[(i+1)%4];
            const lg = dist2d(A0,B0) || 1;
            const ex = (B0[0]-A0[0])/lg*0.04, ez = (B0[1]-A0[1])/lg*0.04;
            const A = [A0[0]-ex, A0[1]-ez], B = [B0[0]+ex, B0[1]+ez];
            const dehors = [(A[0]+B[0])/2-c.cx, 0, (A[1]+B[1])/2-c.cz];
            ctx = {c, L, k:'mur', e:i};
            porche(c, L, A, B, dehors, base, c.i*211 + L*29 + i);
          }
        }
      }

      // dessous d'un bloc en encorbellement
      if(L > 0 && !occ(c, L-1) && !arcadeFaite) renfort(c, L, rs);

      // toit, terrasse sous claire-voie, ou plate-forme crénelée
      if(!occ(c, L+1) && spe && PT(spe).plateforme){
        /* Couronnement de la Tour sombre : dalle de pierre et parapet crénelé,
           mais uniquement sur les arêtes qui donnent à l'extérieur. Entre deux
           cellules de la même tour il ne doit rien y avoir — c'est une seule
           plate-forme, pas quatre. */
        const yT2 = y1 + REHAUSSE;
        const Sq = c.q.map(v => P[v]);
        ctx = {c, L, k:'toit', e:-1};
        pousserQuad([Sq[0][0],yT2,Sq[0][1]], [Sq[1][0],yT2,Sq[1][1]],
                    [Sq[2][0],yT2,Sq[2][1]], [Sq[3][0],yT2,Sq[3][1]],
                    grain('#6f6a66', 1.0, 0), [0,1,0], false);
        const meme = (nb) => nb && nb.sp[L] && nb.sp[L].t === spe.t;
        for(let i=0;i<4;i++){
          if(meme(c.nb[i])) continue;
          const a=Sq[i], b=Sq[(i+1)%4];
          const deh=[(a[0]+b[0])/2-c.cx, 0, (a[1]+b[1])/2-c.cz];
          const dl3=Math.hypot(deh[0],deh[2])||1;
          const ox3=deh[0]/dl3*0.055, oz3=deh[2]/dl3*0.055;
          const M2 = 6;
          for(let k=0;k<M2;k++){
            const t0=k/M2, t1=(k+1)/M2, h = k%2 ? 0.12 : 0.30;
            const p0=[a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0];
            const p1=[a[0]+(b[0]-a[0])*t1, a[1]+(b[1]-a[1])*t1];
            const r0=[p0[0]+ox3, p0[1]+oz3], r1=[p1[0]+ox3, p1[1]+oz3];
            const q0=[p0[0]-ox3*0.6, p0[1]-oz3*0.6], q1=[p1[0]-ox3*0.6, p1[1]-oz3*0.6];
            pousserQuad([r0[0],yT2-0.10,r0[1]], [r1[0],yT2-0.10,r1[1]],
                        [r1[0],yT2+h,r1[1]], [r0[0],yT2+h,r0[1]],
                        grain('#6f6a66', 0.94, 0), deh, false);
            pousserQuad([q0[0],yT2,q0[1]], [q1[0],yT2,q1[1]],
                        [q1[0],yT2+h,q1[1]], [q0[0],yT2+h,q0[1]],
                        grain('#5a5652', 0.84, 0), [-deh[0],0,-deh[2]], false);
            pousserQuad([r0[0],yT2+h,r0[1]], [r1[0],yT2+h,r1[1]],
                        [q1[0],yT2+h,q1[1]], [q0[0],yT2+h,q0[1]],
                        grain('#7d7973', 1.06, 0), [0,1,0], false);
            if(k < M2-1){
              const hs = (k+1)%2 ? 0.12 : 0.30;
              const bas=Math.min(h,hs), ht=Math.max(h,hs);
              pousserQuad([r1[0],yT2+bas,r1[1]], [q1[0],yT2+bas,q1[1]],
                          [q1[0],yT2+ht,q1[1]], [r1[0],yT2+ht,r1[1]],
                          grain('#666260', 0.9, 0), [r1[0]-q1[0],0,r1[1]-q1[1]], false);
            }
          }
        }
        continue;
      }
      if(!occ(c, L+1) && spe && PT(spe).cone){
        toitCone(c, L, rs, PT(spe).toit || TYPES[spe.t].toit, PT(spe).haut);
        continue;
      }
      if(!occ(c, L+1) && spe && PT(spe).pignon){
        toitPignon(c, L, spe.r, PT(spe).toit || TYPES[spe.t].toit,
                   PT(spe).mur || TYPES[spe.t].mur, PT(spe).pente, PT(spe).chaume);
        continue;
      }
      const sommet = occ(c, L+1) ? '' : (aTerrasse(c, L) ? 'terrasse' : sommetTour(c, L));
      if(sommet === 'terrasse'){
        terrasse(c, L, rs);
      }else if(sommet === 'creneaux'){
        creneaux(c, L, rs, spe ? (PT(spe).mur || TYPES[spe.t].mur) : PAL[c.b[L]]);
      }else if(sommet === 'fleche'){
        fleche(c, L, rs, spe ? (PT(spe).mur || TYPES[spe.t].mur) : PAL[c.b[L]], couleurToit(c, L));
      }else if(!occ(c, L+1) && !spe &&
               c.nb.every(nb => !estToit(nb, L)) &&
               hash3(c.i, L, 1723) > 0.52){
        /* Les volumes isolés peuvent recevoir une vraie toiture à deux pans.
           Les masses mitoyennes conservent le toit fusionné, qui est l'une des
           signatures du système de construction. */
        const cT = couleurToit(c, L);
        const rP = Math.floor(hash3(c.i,L,1727)*4);
        const penteP = 0.92 + hash3(c.i,L,1733)*0.72;
        const chaumeP = hash3(c.i,L,1739) > 0.88;
        toitPignon(c, L, rP, cT, PAL[c.b[L]], penteP, chaumeP, true);
      }else if(!occ(c, L+1)){
        const inter = faitage(c, L);
        const cT = couleurToit(c, L);
        /* La hauteur de faîtage se lit sur `inter`, pas sur une formule locale.
           `faitage` applique la pente du GROUPE — et un groupe qui porte une
           plate-forme est passé en pente douce. La constante qui traînait ici
           gardait la pente moyenne : le plancher de terrasse et son parapet se
           dessinaient trente centimètres au-dessus de la couverture, d'où ces
           dalles grises suspendues en l'air. */
        const yF = inter[0][1];
        ctx = {c, L, k:'toit', e:-1};
        /* Le faîtage déborde de trois pour cent sur les pans. Les deux
           surfaces se rejoignent sur une arête commune, mais chacune la
           découpe en un nombre de tuiles différent : les sommets de la plus
           fine tombent au milieu des arêtes de l'autre, et la rastérisation
           laisse passer une fente d'un pixel le long de l'arêtier. Un léger
           recouvrement la referme sans être visible. */
        const capot = inter.map((p, j)=>{
          const b = P[c.q[j]];
          return [p[0] + (b[0]-p[0])*0.03, p[1] + (y1-p[1])*0.03, p[2] + (b[1]-p[2])*0.03];
        });
        /* Toit plat quand ça fusionne. Une cellule dont les quatre voisines
           portent aussi un toit n'a plus aucune arête exposée : son faîtage
           couvre déjà toute la cellule. Plutôt qu'un plat de tuiles, on y pose
           le dallage du bourg et un parapet crénelé le long des arêtes qui
           donnent sur une pente. C'est la terrasse de toit. */
        /* Terrasse : QUATRE voisines couvertes. J'avais essayé trois — le
           résultat était un enclos crénelé planté au milieu d'une pente, sans
           rapport avec le volume. Avec quatre, la cellule n'a aucune arête
           exposée, son plat couvre tout le carré, et le parapet en fait le
           tour complet : c'est une vraie plate-forme au sommet d'une masse de
           toits, et deux terrasses voisines se rejoignent sans mur entre
           elles. */
        const plat = plats.has(L+':'+c.i);
        if(plat){
          plancherTerrasse(capot, yF, c.i*23+L);
          detail = true; mobilierTerrasse(c, yF, c.i*37+L); detail = false;
          ctx = {c, L, k:'toit', e:-1};
          for(let i=0;i<4;i++){
            const nb2 = c.nb[i];
            if(nb2 && plats.has(L+':'+nb2.i)) continue;
            const a=inter[i], b=inter[(i+1)%4];
            const deh=[(a[0]+b[0])/2-c.cx, 0, (a[2]+b[2])/2-c.cz];
            const dl2=Math.hypot(deh[0],deh[2])||1;
            const ox2=deh[0]/dl2*0.045, oz2=deh[2]/dl2*0.045;
            const M = 5;
            for(let k=0;k<M;k++){
              // merlon aux deux bouts : les angles se rejoignent en plein
              const t0=k/M, t1=(k+1)/M, h = k%2 ? 0.095 : 0.20;
              const p0=[a[0]+(b[0]-a[0])*t0, a[2]+(b[2]-a[2])*t0];
              const p1=[a[0]+(b[0]-a[0])*t1, a[2]+(b[2]-a[2])*t1];
              const q0=[p0[0]-ox2, p0[1]-oz2], q1=[p1[0]-ox2, p1[1]-oz2];
              /* La face extérieure du parapet est poussée de huit millimètres
                 hors du nu. Sans ce décalage elle tombait exactement dans le
                 plan du pan vertical qui monte jusqu'à la plate-forme, et les
                 deux surfaces se disputaient le tampon de profondeur — d'où
                 les créneaux qui clignotaient à travers les tuiles. */
              const r0=[p0[0]+ox2*0.18, p0[1]+oz2*0.18];
              const r1=[p1[0]+ox2*0.18, p1[1]+oz2*0.18];
              pousserQuad([r0[0],yF-0.012,r0[1]], [r1[0],yF-0.012,r1[1]],
                          [r1[0],yF+h,r1[1]], [r0[0],yF+h,r0[1]],
                          grain('#a9a094', 0.94, 0), deh, false);
              pousserQuad([q0[0],yF,q0[1]], [q1[0],yF,q1[1]],
                          [q1[0],yF+h,q1[1]], [q0[0],yF+h,q0[1]],
                          grain('#8d8474', 0.82, 0), [-deh[0],0,-deh[2]], false);
              pousserQuad([r0[0],yF+h,r0[1]], [r1[0],yF+h,r1[1]],
                          [q1[0],yF+h,q1[1]], [q0[0],yF+h,q0[1]],
                          grain('#b3aa9d', 1.04, 0), [0,1,0], false);
              if(k < M-1){
                const hs = (k+1)%2 ? 0.095 : 0.20;
                const bas=Math.min(h,hs), ht=Math.max(h,hs);
                pousserQuad([r1[0],yF+bas,r1[1]], [q1[0],yF+bas,q1[1]],
                            [q1[0],yF+ht,q1[1]], [r1[0],yF+ht,r1[1]],
                            grain('#9d9384', 0.88, 0),
                            [r1[0]-q1[0],0,r1[1]-q1[1]], false);
              }
            }
          }
        }else
        paveToit(capot[0], capot[1], capot[2], capot[3], cT, c.i*17+L, [0,1,0]);
        if(hash3(c.i, 95, 0) > 0.45){
          const fx=(capot[0][0]+capot[2][0])/2, fz=(capot[0][2]+capot[2][2])/2;
          perchoirs.push([fx, capot[0][1], fz]);
        }
        const faceLucarne = Math.floor(hash3(c.i,L,1741)*4);
        for(let i=0;i<4;i++){
          const nb = c.nb[i];
          if(nb && estToit(nb, L)) continue;
          /* Sur une arête intérieure — le voisin est occupé à ce niveau, mais
             plus haut, donc il n'a pas de toit ici — il n'y a aucun congé :
             le pan doit partir du coin brut. En prenant le contour arrondi, le
             toit se décollait du mur voisin et laissait une encoche en biseau
             par laquelle on voyait le décor. */
          const mitoyen = occ(nb, L);
          /* Le toit, sa frise et sa corniche partent tous du quadrilatère BRUT
             de la cellule, jamais du contour arrondi des murs. Le pan devient
             une simple tente posée sur un carré : deux arêtes se rencontrent
             au coin brut, exactement, sans arc à raccorder. C'est ce raccord
             d'arc qui a produit l'essentiel des trous et des pointes des
             derniers jours. L'arrondi reste ce qu'il doit être : une affaire
             de maçonnerie, pas de charpente. */
          const [A,B] = [S[i], S[(i+1)%4]];
          const dehors = [(A[0]+B[0])/2-c.cx, 0.8, (A[1]+B[1])/2-c.cz];
          const yT = y1 + REHAUSSE;
          if(!mitoyen){
            /* La frise est dessinée dans la teinte du TOIT, pas dans celle du
               mur. En couleur de mur, elle se lisait comme une façade qui
               dépasse au-dessus de la couverture — et aux angles, où elle est
               émise par la cellule qui porte le toit et non par celle qui
               porte l'arête, deux teintes de mur différentes se rencontraient
               en coin clair. Rattachée au toit, l'entablement se lit comme un
               entablement et les deux sources concordent. */
            pave(A, B, y1, yT, [dehors[0],0,dehors[2]],
                 melangeHex(cT, '#3a2b25', 0.30), c.i*211+L*29+i+7, 0.09);
          }
          paveToit([A[0],yT,A[1]], [B[0],yT,B[1]], inter[(i+1)%4], inter[i],
                   cT, c.i*97+L*11+i, dehors);
          if(!mitoyen && i === faceLucarne && hash3(c.i,L,1747) > 0.46){
            lucarneToit([A[0],yT,A[1]], [B[0],yT,B[1]],
                        inter[(i+1)%4], inter[i], dehors,
                        c.i*197+L*19+i, PAL[c.b[L]], cT);
          }
          if(!mitoyen){
            const dl = Math.hypot(dehors[0], dehors[2]) || 1;
            bandeauEgout(A, B, [dehors[0]/dl, dehors[2]/dl],
                         [dehors[0]/dl, dehors[2]/dl], yT, cT);
          }
        }
        /* Tourelle d'angle, décidée une fois pour le bâtiment et posée sur
           l'arête dégagée la plus longue. */
        if(iTour >= 0){
          const [A2,B2] = bornes(rs, c, iTour);
          tourelle(c, L, iTour, A2, B2, PAL[c.b[L]], c.i*29+7);
        }

        if(!spe && L >= 2 && hash3(c.i, 94, 0) > 0.80){
          rotatifs.push({sorte:'girouette', x:c.cx, y:yF + 0.02, z:c.cz,
                         dx:0, dz:0, haut:true, vit:0.14});
        }
        if(!spe && L >= 1 && hash3(c.i, 91, 0) > 0.68){
          ctx = {c, L, k:'toit', e:-1};
          let chx, chz, yPied;
          if(plat){
            /* Sur une plate-forme, une souche plantée au milieu du dallage n'a
               aucun sens : elle se pose sur le parapet, au milieu d'une arête
               qui en porte un, et son pied s'y encastre. */
            let e2 = -1;
            for(let d=0; d<4; d++){
              const i2 = (Math.floor(hash3(c.i, 92, 0)*4) + d) % 4;
              const nb2 = c.nb[i2];
              if(nb2 && plats.has(L+':'+nb2.i)) continue;
              e2 = i2; break;
            }
            if(e2 < 0) e2 = Math.floor(hash3(c.i, 92, 0)*4);
            const a = inter[e2], b = inter[(e2+1)%4];
            const mx=(a[0]+b[0])/2, mz=(a[2]+b[2])/2;
            const dx=mx-c.cx, dz=mz-c.cz, l=Math.hypot(dx,dz)||1;
            chx = mx - dx/l*0.02; chz = mz - dz/l*0.02;
            yPied = yF - 0.02;
          }else{
            const k = Math.floor(hash3(c.i, 92, 0)*4);
            chx = S[k][0]*0.62 + c.cx*0.38; chz = S[k][1]*0.62 + c.cz*0.38;
            yPied = y1 + REHAUSSE - 0.06;
          }
          const som = cheminee(chx, chz, chx-c.cx, chz-c.cz, yPied, c.i*97+L);
          if(hash3(c.i, 93, 0) > 0.35) cheminees.push({x:chx, y:som + 0.02, z:chz, force:0.85});
        }
      }
    }
  }

  detail = true;
  guirlandes();
  toiles();
  detail = false;

  /* Congé qui disparaît d'un niveau à l'autre. Un sommet peut être un angle
     saillant au niveau du dessous et ne plus l'être au-dessus : le mur du haut
     repart alors du coin brut alors que celui du bas s'arrêtait en retrait, et
     l'anneau entre les deux n'était fermé par personne. */
  for(let L=1; L<RS.length; L++){
    RS[L-1].forEach((e, s)=>{
      if(e.r <= 1e-4 || RS[L].has(s)) return;
      const c = e.cIn;
      if(!occ(c, L)) return;
      const spe = c.sp[L];
      const base = spe ? (PT(spe).mur || TYPES[spe.t].mur) : PAL[c.b[L]];
      ctx = {c, L, k:'sol', e:-1};
      bandeauSommet(e, e.r, 0, L*H, BISEAU, teinte(base, 0.9));
    });
  }

  // congés d'angle : une passe par sommet de contour, hors des cellules
  for(let L=0; L<RS.length; L++){
    RS[L].forEach((e, s)=>{
      if(e.r <= 1e-4) return;
      const c = e.cIn, y0 = L*H, y1 = (L+1)*H;
      const spe = c.sp[L];
      const base = spe ? (PT(spe).mur || TYPES[spe.t].mur) : PAL[c.b[L]];
      const pts = arcSommet(e, e.r);
      ctx = {c, L, k:'mur', e:e.iIn};
      for(let k=0;k<N_ARC;k++){
        const a=pts[k], b=pts[k+1];
        const dehors=[(a[0]+b[0])/2-c.cx, 0, (a[1]+b[1])/2-c.cz];
        pave(a, b, y0, y1, dehors, base, c.i*307 + L*23 + s*5 + k);
      }
      // raccord avec le niveau inférieur
      /* Congé de transition entre deux niveaux. Il ne se justifie que si le
         sommet est un angle saillant EN DESSOUS aussi, avec un rayon différent.
         Quand il n'y figure pas — parce que l'étage inférieur est plus large et
         que ce coin y est intérieur — l'ancien code prenait un rayon nul, donc
         le coin brut, et évasait le bandeau jusqu'à lui : d'où les pointes qui
         sortaient dans le vide au pied des tours. Il n'y a rien à raccorder
         dans ce cas, le mur du dessous s'arrête ailleurs. */
      const eBas = (L > 0 && RS[L-1]) ? RS[L-1].get(s) : null;
      if(eBas && Math.abs(eBas.r - e.r) > 1e-3){
        ctx = {c, L, k:'sol', e:-1};
        bandeauSommet(e, eBas.r, e.r, y0, BISEAU, teinte(base, 0.9));
      }
      /* Raccord d'angle entre la maçonnerie et la charpente. Le mur s'arrête
         sur son congé, la frise repart du coin brut : il faut fermer l'anneau
         entre les deux, à hauteur d'égout. Une couronne horizontale suffit —
         plus d'éventail de toit à orienter, plus de corniche à faire tourner
         dans l'arc. */
      let ct = null;
      for(const q of (parSommet.get(s) || [])){
        if(!occ(q, L) || occ(q, L+1)) continue;
        const sq = q.sp[L];
        if(sq && PT(sq).cour) continue;
        if(sommetTour(q, L) || aTerrasse(q, L)) continue;
        ct = q; break;
      }
      if(ct){
        const brut = [P[s][0], y1, P[s][1]];   // P[] est en 2D : il faut lui donner sa hauteur
        ctx = {c:ct, L, k:'toit', e:-1};
        const cM = ct.sp[L] ? TYPES[ct.sp[L].t].mur : PAL[ct.b[L]];
        for(let k=0;k<N_ARC;k++){
          const a=pts[k], b=pts[k+1];
          pousserQuad([a[0],y1,a[1]], [b[0],y1,b[1]], brut, brut,
                      grain(cM, 0.96 + hash3(ct.i, s*13+k, 29)*0.12, 0),
                      [0,1,0], false);
        }
      }
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(fige(pos),3));
  geo.setAttribute('color',    new THREE.BufferAttribute(fige(col),3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(fige(nor),3));
  meshVille.geometry.dispose();
  meshVille.geometry = geo;
  meshVille.userData.meta = meta;

  const gd = new THREE.BufferGeometry();
  gd.setAttribute('position', new THREE.BufferAttribute(fige(posD),3));
  gd.setAttribute('color',    new THREE.BufferAttribute(fige(colD),3));
  gd.setAttribute('normal',   new THREE.BufferAttribute(fige(norD),3));
  meshDetails.geometry.dispose();
  meshDetails.geometry = gd;

  for(let g=0; g<NB_LUEURS; g++){
    const gl2 = new THREE.BufferGeometry();
    gl2.setAttribute('position', new THREE.BufferAttribute(fige(lpos[g]),3));
    gl2.setAttribute('color',    new THREE.BufferAttribute(fige(lcol[g]),3));
    meshLampes[g].geometry.dispose();
    meshLampes[g].geometry = gl2;
  }


  ombreARefaire = true;
  majAiles();
  if(!mouettesPretes){ majMouettes(); mouettesPretes = true; }
  construireFumee();
  if(graineVague !== graine){ construireVague(); graineVague = graine; }
  if(sigSol !== empreinteForet){ construireForet(); empreinteForet = sigSol; }
  if(grainePoissons !== graine){ majPoissons(); grainePoissons = graine; }

  statsPerf.reconstructionMs = performance.now() - debutConstruction;
  statsPerf.trianglesVille = pos.n/9;
  statsPerf.trianglesDetails = posD.n/9;
  statsPerf.trianglesTerrain = meshTerrain.geometry.attributes.position
    ? meshTerrain.geometry.attributes.position.count/3 : 0;
  statsPerf.trianglesForet = meshArbres.geometry.attributes.position
    ? meshArbres.geometry.attributes.position.count/3 : 0;
}

/* Ressac. La géométrie est bâtie une fois par île : quatre rangées de points
   suivant le contour, trois bandes entre elles. À chaque image on ne recalcule
   que les positions, en faisant glisser le front de vague le long du profil de
   plage — l'abscisse t, pas une translation, sinon la vague ne suivrait pas la
   pente là où la côte tourne. */
const OFFSETS_VAGUE = [-0.13, -0.04, 0.05, 0.16];
let geoVague = null;

function construireVague(){
  const {anneaux, n} = chaineBord();
  const NB = OFFSETS_VAGUE.length;
  const p = new Float32Array(n*NB*3);
  const c = new Float32Array(n*NB*3);
  const idx = [];
  const tons = ['#cdbb99', '#f4f8f4', '#e6f0ee', '#93b8b8'];
  for(let k=0;k<n;k++){
    for(let r=0;r<NB;r++){
      const t = lin(tons[r]), i=(k*NB+r)*3;
      c[i]=t.r; c[i+1]=t.g; c[i+2]=t.b;
    }
    const k2=(k+1)%n;
    for(let r=0;r<NB-1;r++){
      const a=k*NB+r, b=k*NB+r+1, d=k2*NB+r+1, e=k2*NB+r;
      idx.push(a,b,d, a,d,e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p,3));
  g.setAttribute('color',    new THREE.BufferAttribute(c,3));
  g.setIndex(idx);
  if(geoVague) geoVague.dispose();
  geoVague = g;
  meshVague.geometry = g;
  meshVague.visible = true;
}

function animerVague(temps){
  if(!geoVague) return;
  const {anneaux, n} = chaineBord();
  const NB = OFFSETS_VAGUE.length;
  const p = geoVague.attributes.position.array;
  for(let k=0;k<n;k++){
    const front = 0.60 + 0.115*Math.sin(temps*0.62 + (k/n)*Math.PI*2*3);
    for(let r=0;r<NB;r++){
      const t = Math.max(0.03, Math.min(0.99, front + OFFSETS_VAGUE[r]));
      const q = pointPlage(anneaux, k, t);
      const i = (k*NB+r)*3;
      p[i] = q[0]; p[i+1] = q[1] + 0.009; p[i+2] = q[2];
    }
  }
  geoVague.attributes.position.needsUpdate = true;
}

/* Poissons. Chacun suit une parabole au-dessus de l'eau pendant une fraction
   de son cycle et reste invisible le reste du temps. Position et orientation
   sont posées par image sur une poignée d'objets, ce qui coûte moins qu'un
   maillage recalculé. */
const NB_POISSONS = 7;
let geoPoisson = null;
function construirePoisson(){
  const sp=pos, sc=col, sn=nor, sm=meta, sl=lam, sp2=lpos, sc2=lcol, sd=detail;
  detail = false;
  pos=tampon(); col=tampon(); nor=tampon(); meta=[]; lam=tampon();
  lpos=[]; lcol=[]; for(let g=0; g<NB_LUEURS; g++){ lpos.push(tampon(64)); lcol.push(tampon(64)); }
  const dos = teinte('#5b7f8c', 1), ventre = teinte('#cfd8d2', 1);
  const N = 6, L = 0.13, R = 0.045;
  const anneau = (x, r)=>{
    const p=[];
    for(let k=0;k<N;k++){
      const a=k/N*Math.PI*2;
      p.push([x, Math.cos(a)*r*1.25, Math.sin(a)*r*0.75]);
    }
    return p;
  };
  const A = anneau(-L*0.15, R), B = anneau(L*0.35, R*0.72);
  const nez = [-L, 0, 0], base = [L*0.72, 0, 0];
  for(let k=0;k<N;k++){
    const k2=(k+1)%N;
    const c = A[k][1] > 0 ? dos : ventre;
    pousserQuad(A[k2], A[k], nez, nez, c, [A[k][0]-nez[0], A[k][1], A[k][2]], false);
    pousserQuad(A[k], A[k2], B[k2], B[k], c, [0, A[k][1], A[k][2]], false);
    pousserQuad(B[k], B[k2], base, base, c, [1, B[k][1], B[k][2]], false);
  }
  // caudale
  pousserQuad([L*0.68,0,0], [L*1.12, 0.075, 0.02], [L*1.16, -0.005, 0], [L*1.12, -0.075, -0.02],
              dos, [0,0,1], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(fige(pos),3));
  g.setAttribute('color',    new THREE.BufferAttribute(fige(col),3));
  g.setAttribute('normal',   new THREE.BufferAttribute(fige(nor),3));
  pos=sp; col=sc; nor=sn; meta=sm; lam=sl; lpos=sp2; lcol=sc2; detail=sd;
  return g;
}

function majPoissons(){
  if(!geoPoisson) geoPoisson = construirePoisson();
  while(grpPoissons.children.length) grpPoissons.remove(grpPoissons.children[0]);
  const {anneaux, n} = chaineBord();
  for(let i=0;i<NB_POISSONS;i++){
    const o = new THREE.Mesh(geoPoisson, matVille);
    const k = Math.floor(hash3(i, 1, 313)*n);
    const q = pointPlage(anneaux, k, 1);
    const dep = 0.5 + hash3(i, 2, 317)*1.5;
    const l = Math.hypot(q[0], q[2]) || 1;
    o.userData = {
      x:q[0] + q[0]/l*dep, z:q[2] + q[2]/l*dep,
      phase: hash3(i, 3, 331)*20, duree: 5 + hash3(i, 4, 337)*7,
      cap: hash3(i, 5, 347)*Math.PI*2, haut: 0.30 + hash3(i, 6, 349)*0.28
    };
    o.visible = false;
    grpPoissons.add(o);
  }
}

function animerPoissons(temps){
  for(const o of grpPoissons.children){
    const d = o.userData;
    const u = ((temps + d.phase) % d.duree) / d.duree;
    if(u > 0.16){ o.visible = false; continue; }
    const t = u/0.16;                                  // 0 -> 1 sur le saut
    const y = -0.05 + Math.sin(Math.PI*t)*d.haut;
    const av = (t-0.5)*0.55;
    o.visible = true;
    o.position.set(d.x + Math.cos(d.cap)*av, y, d.z + Math.sin(d.cap)*av);
    o.rotation.set(0, -d.cap, Math.atan2(Math.cos(Math.PI*t)*d.haut*Math.PI, 0.55)*-1);
  }
}

/* Pièces tournantes — ailes de moulin, roue de scierie. Elles ne peuvent pas
   vivre dans la géométrie fusionnée de la ville : chacune est un objet à part,
   orienté par lookAt et tourné autour de son axe local Z à chaque image. */
let geoRotatif = {};
function majAiles(){
  while(grpAiles.children.length){
    grpAiles.remove(grpAiles.children[grpAiles.children.length-1]);
  }
  for(const m of rotatifs){
    if(!geoRotatif[m.sorte]) geoRotatif[m.sorte] = construireRotatif(m.sorte);
    const o = new THREE.Mesh(geoRotatif[m.sorte], matVille);
    o.castShadow = false;   // sinon leur ombre resterait figée entre deux mises à jour
    o.position.set(m.x, m.y, m.z);
    if(m.haut) o.lookAt(m.x, m.y + 1, m.z);
    else o.lookAt(m.x + m.dx, m.y, m.z + m.dz);
    o.rotateZ(Math.random()*Math.PI);
    o.userData.vit = m.vit;
    grpAiles.add(o);
  }
}

/* Géométries locales : bras dans le plan XY, rotation autour de Z. */
function construireRotatif(sorte){
  const sp=pos, sc=col, sn=nor, sm=meta, sl=lam, sp2=lpos, sc2=lcol, sd=detail;
  detail = false;
  pos=tampon(); col=tampon(); nor=tampon(); meta=[]; lam=tampon();
  lpos=[]; lcol=[]; for(let g=0; g<NB_LUEURS; g++){ lpos.push(tampon(64)); lcol.push(tampon(64)); }
  const bois = teinte('#6b5744',1);
  if(sorte === 'ailes'){
    const toile = teinte('#efe8d6',1);
    poutre([0,0,-0.07],[0,0,0.07], 0.055, teinte('#4a3a30',1));
    for(let k=0;k<4;k++){
      const a=k*Math.PI/2, cx=Math.cos(a), cy=Math.sin(a);
      const px=-cy, py=cx;
      poutre([cx*0.06, cy*0.06, 0], [cx*0.62, cy*0.62, 0], 0.024, bois);
      for(const z of [0.028, -0.028]){
        const A=[cx*0.20, cy*0.20, z], B=[cx*0.60, cy*0.60, z];
        const C=[B[0]+px*0.13, B[1]+py*0.13, z], D=[A[0]+px*0.13, A[1]+py*0.13, z];
        pousserQuad(A,B,C,D, toile, [0,0,Math.sign(z)], false);
      }
    }
  }else if(sorte === 'meule'){             // meule à aiguiser
    const p = teinte('#8d8474',1), fer = teinte('#3b3a3f',1);
    const N = 12, R = 0.10;
    for(let k=0;k<N;k++){
      const a=k/N*Math.PI*2, b=(k+1)/N*Math.PI*2;
      for(const z of [-0.022, 0.022]){
        pousserQuad([Math.cos(a)*R, Math.sin(a)*R, z], [Math.cos(b)*R, Math.sin(b)*R, z],
                    [0,0,z], [0,0,z], p, [0,0,Math.sign(z)], false);
      }
      pousserQuad([Math.cos(a)*R, Math.sin(a)*R, -0.022], [Math.cos(b)*R, Math.sin(b)*R, -0.022],
                  [Math.cos(b)*R, Math.sin(b)*R, 0.022], [Math.cos(a)*R, Math.sin(a)*R, 0.022],
                  teinte('#7c7364',1), [Math.cos(a), Math.sin(a), 0], false);
    }
    poutre([0,0,-0.05],[0,0,0.05], 0.014, fer);
  }else if(sorte === 'girouette'){         // coq et rose des vents, axe vertical
    const fer = teinte('#3b3a3f', 1), or = teinte('#c9a227', 1);
    poutre([0,0,-0.02],[0,0,0.30], 0.012, fer);
    for(const a of [0, Math.PI/2, Math.PI, -Math.PI/2]){
      poutre([Math.cos(a)*0.02, Math.sin(a)*0.02, 0.10],
             [Math.cos(a)*0.11, Math.sin(a)*0.11, 0.10], 0.008, fer);
    }
    // flèche : hampe, empennage, pointe
    poutre([-0.16,0,0.26], [0.17,0,0.26], 0.010, fer);
    pousserQuad([-0.16,0,0.26], [-0.07,0,0.26], [-0.07,0.075,0.26], [-0.16,0.055,0.26],
                fer, [0,0,1], false);
    pousserQuad([-0.16,0,0.26], [-0.07,0,0.26], [-0.07,-0.075,0.26], [-0.16,-0.055,0.26],
                fer, [0,0,1], false);
    pousserQuad([0.17,0,0.26], [0.09,0.055,0.26], [0.09,-0.055,0.26], [0.09,-0.055,0.26],
                or, [0,0,1], false);
    boiteOr(0, 0, 1, 0, 0.022, 0.022, 0.30, 0.345, or);
  }else{                                   // roue à aubes
    const R = 0.34, N = 10, e = 0.085;
    const sombre = teinte('#5a4736',1), aube = teinte('#7d6448',1);
    poutre([0,0,-e*1.4],[0,0,e*1.4], 0.045, teinte('#4a3a30',1));
    for(let k=0;k<N;k++){
      const a=k/N*Math.PI*2, a2=(k+1)/N*Math.PI*2;
      const cx=Math.cos(a), cy=Math.sin(a), dx=Math.cos(a2), dy=Math.sin(a2);
      for(const z of [-e, e]){
        poutre([cx*0.05, cy*0.05, z], [cx*R, cy*R, z], 0.020, bois);
        poutre([cx*R, cy*R, z], [dx*R, dy*R, z], 0.018, sombre);
      }
      // aube : plaque entre les deux jantes
      const A=[cx*R*0.62, cy*R*0.62, -e], B=[cx*R, cy*R, -e];
      const C=[cx*R, cy*R, e], D=[cx*R*0.62, cy*R*0.62, e];
      pousserQuad(A,B,C,D, aube, [cx, cy, 0], false);
      pousserQuad(D,C,B,A, sombre, [-cx, -cy, 0], false);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(fige(pos),3));
  g.setAttribute('color',    new THREE.BufferAttribute(fige(col),3));
  g.setAttribute('normal',   new THREE.BufferAttribute(fige(nor),3));
  pos=sp; col=sc; nor=sn; meta=sm; lam=sl; lpos=sp2; lcol=sc2; detail=sd;
  return g;
}

function boite(x,z,r,y0,y1,c){
  const s = [[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];
  for(let i=0;i<4;i++){
    const A=s[i], B=s[(i+1)%4];
    const dehors=[(A[0]+B[0])/2-x, 0, (A[1]+B[1])/2-z];
    pousserQuad([A[0],y0,A[1]],[B[0],y0,B[1]],[B[0],y1,B[1]],[A[0],y1,A[1]], c, dehors, true);
  }
  pousserQuad([s[0][0],y1,s[0][1]],[s[1][0],y1,s[1][1]],
              [s[2][0],y1,s[2][1]],[s[3][0],y1,s[3][1]], c, [0,1,0], true);
}

function construireGrille(){
  const seg = [], vus = new Set();
  for(const c of cellules){
    for(let i=0;i<4;i++){
      const u=c.q[i], v=c.q[(i+1)%4];
      const k = Math.min(u,v)+'_'+Math.max(u,v);
      if(vus.has(k)) continue;
      vus.add(k);
      seg.push(P[u][0], SOL+0.004, P[u][1], P[v][0], SOL+0.004, P[v][1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(seg,3));
  grille.geometry.dispose();
  grille.geometry = g;
}

/* ============================================================
   6. Visée : lecture directe de la face touchée
   ============================================================ */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/* Renvoie { pose, sup } : où poser un bloc, quel bloc retirer.
   Toit  -> on empile au-dessus.  Mur -> on pose dans la cellule voisine, au MÊME niveau.
   Dessous -> on pose en dessous. Rien -> on pose au niveau de l'eau. */
function viser(px, py){
  const r = canvas.getBoundingClientRect();
  ndc.x = ((px - r.left) / r.width) * 2 - 1;
  ndc.y = -((py - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);

  {
    /* Le pointage ne vise que les masses et le terrain. Les détails, dans leur
       maillage à part, laissent passer le rayon : cliquer un volet ou une
       lanterne désigne le mur qui est derrière. */
    const t = raycaster.intersectObjects([meshVille, meshTerrain], false);
    if(t.length){
      const table = t[0].object.userData.meta || [];
      const m = table[t[0].faceIndex];
      if(m){
        if(m.k === 'terre') return {pose:{c:m.c, L:0}, sup:null};
        if(m.k === 'cote')  return null;
        if(m.k === 'toit') return {pose:{c:m.c, L:m.L+1}, sup:{c:m.c, L:m.L}};
        if(m.k === 'sol')  return {pose:m.L>0 ? {c:m.c, L:m.L-1} : null, sup:{c:m.c, L:m.L}};
        const nb = m.c.nb[m.e];
        const niv = m.k === 'socle' ? 0 : m.L;
        return {pose: nb ? {c:nb, L:niv} : null, sup:{c:m.c, L:m.L}};
      }
    }
  }
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if(Math.abs(d.y) < 1e-6) return null;
  const k = (0 - o.y) / d.y;
  if(k <= 0) return null;
  const c = celluleEn(o.x + d.x*k, o.z + d.z*k);
  return c ? {pose:{c, L:0}, sup:null} : null;
}


/* ============================================================
   7. Édition
   ============================================================ */
let couleur = 3;
let typeCourant = -1;          // -1 = maison ordinaire

/* Une face personnalisée d'un bâtiment spécial interdit tout contact.
   `sommet` interdit en plus de bâtir juste au-dessus. */
function protege(c, L){
  for(let j=0;j<4;j++){
    const nb = c.nb[j];
    if(!nb) continue;
    const sp = nb.sp[L];
    if(!sp) continue;
    const k = nb.nb.indexOf(c);
    if(k < 0) continue;
    if(PT(sp).faces[(k - sp.r + 4) % 4] !== 'mur') return true;
  }
  const dessous = L > 0 ? c.sp[L-1] : null;
  return !!(dessous && PT(dessous).sommet);
}

/* Vérifie qu'un bâtiment entier tient à cet endroit dans cette orientation.
   Attention : la numérotation des arêtes n'est pas symétrique d'une cellule à
   l'autre — si A.nb[i] vaut B, rien ne garantit que B.nb[(i+2)%4] vaille A.
   Chaque part a donc sa propre rotation, calculée pour que sa face locale 2
   regarde bien vers la part d'ancrage.
   Renvoie la liste [cellule, niveau, rotation] des parts, ou null. */
function placementOk(c, L, t, r){
  const T = TYPES[t], cases = [];
  /* Certaines choses ne se posent qu'à même le sol : une tour a des fondations,
     un champ a besoin de terre. Sans cette règle, poser un champ de fleurs sur
     un toit écrasait la maison en dessous — le bâtiment disparaissait et la
     culture retombait au niveau du sol. */
  if(T.auSol && L !== 0) return null;
  if(T.bloc4){
    /* Les quatre cellules réunies autour du sommet désigné par la rotation. Le
       recours à `parSommet` évite d'avoir à composer deux sauts de voisinage —
       ce que le système de parts, qui ne connaît qu'un décalage de face, ne
       sait pas exprimer. */
    const lot = parSommet.get(c.q[r % 4]);
    if(!lot || lot.length !== 4) return null;
    for(let k=0;k<4;k++) for(let l=0;l<T.niveaux;l++){
      const cc = lot[k], LL = L + l;
      if(LL >= H_MAX || occ(cc, LL) || protege(cc, LL)) return null;
      cases.push([cc, LL, r, k*T.niveaux + l]);
    }
    return cases;
  }
  // la pêcherie exige que sa face avant donne sur le large
  if(T.bordEau && c.nb[r % 4]) return null;
  for(const part of T.parts){
    const cc = celluleDe(c, r, part);
    if(!cc) return null;
    let rk = r;
    if(part.df !== undefined){
      const j = cc.nb.indexOf(c);
      if(j < 0) return null;
      rk = (j + 2) % 4;
    }
    const LL = niveauDe(L, part);
    if(LL < 0 || LL >= H_MAX) return null;
    if(occ(cc, LL) || protege(cc, LL)) return null;
    /* Une cour, une terrasse ou un champ doit reposer sur quelque chose. Sans
       cette règle, cliquer sur un mur en hauteur posait la part au sol de la
       cellule voisine, en l'air : on obtenait des potagers suspendus sur
       poteaux. Les corps de bâtiment, eux, gardent le droit de surplomber. */
    if(part.cour && LL > 0 && !occ(cc, LL-1)) return null;
    if(cases.some(([c2,L2]) => c2 === cc && L2 === LL)) return null;
    cases.push([cc, LL, rk]);
  }
  for(let k=0;k<T.parts.length;k++){
    const part = T.parts[k], [cc, LL, rk] = cases[k];
    for(let f=0;f<4;f++){
      if(part.faces[f] === 'mur') continue;
      const nb = cc.nb[(f + rk) % 4];
      if(!occ(nb, LL)) continue;
      if(cases.some(([c2,L2]) => c2 === nb && L2 === LL)) continue;
      return null;                    // face personnalisée contre du bâti
    }
    if(part.sommet && occ(cc, LL+1)) return null;
  }
  return cases;
}

/* Oriente les faces personnalisées vers le large. */
function meilleureRotation(c, L, t){
  let best = -1, score = -Infinity;
  const l = Math.hypot(c.cx, c.cz) || 1;
  // la touche R fait tourner le bâtiment : on part de l'orientation demandée
  for(let d=0;d<4;d++){
    const r = (d + rotManuelle) % 4;
    const cases = placementOk(c, L, t, r);
    if(!cases) continue;
    let s = 0;
    cases.forEach(([cc, LL, rk, pk], k)=>{
      const part = TYPES[t].parts[pk === undefined ? k : pk];
      for(let f=0;f<4;f++){
        if(part.faces[f] === 'mur') continue;
        const i = (f + rk) % 4, nb = cc.nb[i];
        const mx = (P[cc.q[i]][0]+P[cc.q[(i+1)%4]][0])/2 - cc.cx;
        const mz = (P[cc.q[i]][1]+P[cc.q[(i+1)%4]][1])/2 - cc.cz;
        s += (mx*cc.cx + mz*cc.cz)/l + (nb ? 0 : 0.35);
      }
    });
    if(s + (d === 0 ? 1.5 : 0) > score){ score = s + (d === 0 ? 1.5 : 0); best = r; }
  }
  return best;
}

/* Retrouve la part d'ancrage d'un bâtiment à partir de n'importe laquelle. */
function retrouverBloc4(c, L, sp){
  const T=TYPES[sp.t], L0=L-(sp.p%T.niveaux);
  for(const v of c.q){
    const lot=parSommet.get(v);
    if(!lot || lot.length!==4) continue;
    let bon=true;
    for(let k=0;k<4;k++){
      const s0=lot[k].sp[L0];
      if(!s0 || s0.t!==sp.t || s0.p!==k*T.niveaux){ bon=false; break; }
    }
    if(bon) return {lot,L0};
  }
  return null;
}

function ancre(c, L, sp){
  if(TYPES[sp.t].bloc4){
    const b=retrouverBloc4(c,L,sp);
    return b ? [b.lot[0],b.L0] : null;
  }
  if(sp.p === 0) return [c, L];
  const part = PT(sp), L0 = L - (part.dl || 0);
  if(part.df === undefined){
    const s0 = c.sp[L0];
    return (s0 && s0.p === 0 && s0.t === sp.t) ? [c, L0] : null;
  }
  for(const nb of c.nb){
    if(!nb) continue;
    const s0 = nb.sp[L0];
    if(s0 && s0.p === 0 && s0.t === sp.t &&
       nb.nb[(part.df + s0.r) % 4] === c) return [nb, L0];
  }
  return null;
}

function posable(p){
  if(!p || p.L < 0 || p.L >= H_MAX || occ(p.c, p.L)) return false;
  if(protege(p.c, p.L)) return false;
  if(typeCourant >= 0 && meilleureRotation(p.c, p.L, typeCourant) < 0) return false;
  return true;
}

function poser(p){
  if(!posable(p)) return false;
  const c = p.c;
  if(typeCourant < 0){
    for(let L=c.b.length; L<p.L; L++) c.b[L] = -1;
    c.b[p.L] = couleur;
    c.sp[p.L] = undefined;
    return true;
  }
  const r = meilleureRotation(c, p.L, typeCourant);
  const cases = placementOk(c, p.L, typeCourant, r);
  if(!cases) return false;
  cases.forEach(([cc, LL, rk, pk], k)=>{
    for(let L=cc.b.length; L<LL; L++) cc.b[L] = -1;
    cc.b[LL] = 0;
    cc.sp[LL] = {t:typeCourant, r:rk, p: pk === undefined ? k : pk};
  });
  return true;
}

/* Retirer une part quelconque retire le bâtiment entier. */
function retirer(p){
  if(!p || !occ(p.c, p.L)) return false;
  const sp = p.c.sp[p.L];
  if(sp && TYPES[sp.t].bloc4){
    const b=retrouverBloc4(p.c,p.L,sp);
    if(!b) return false;
    const T=TYPES[sp.t];
    for(let k=0;k<4;k++) for(let l=0;l<T.niveaux;l++){
      const cc=b.lot[k], LL=b.L0+l, s2=cc.sp[LL];
      if(s2 && s2.t===sp.t){ cc.b[LL]=-1; cc.sp[LL]=undefined; }
    }
    b.lot.forEach(tailler);
    return true;
  }
  const a  = sp ? ancre(p.c, p.L, sp) : null;
  if(a){
    const rA = a[0].sp[a[1]].r;
    TYPES[sp.t].parts.forEach((part, k)=>{
      const cc = celluleDe(a[0], rA, part), LL = niveauDe(a[1], part);
      if(!cc) return;
      const s2 = cc.sp[LL];
      if(occ(cc,LL) && s2 && s2.t === sp.t && s2.p === k){
        cc.b[LL] = -1; cc.sp[LL] = undefined; tailler(cc);
      }
    });
    return true;
  }
  p.c.b[p.L] = -1; p.c.sp[p.L] = undefined; tailler(p.c);
  return true;
}
function vider(){ cellules.forEach(c => { c.b = []; c.sp = []; }); }

function recentrer(){
  let x=0, z=0, n=0, hMax=0;
  for(const c of cellules){
    if(!c.b.length) continue;
    x += c.cx; z += c.cz; n++;
    hMax = Math.max(hMax, c.b.length);
  }
  cible.set(n ? x/n : 0, n ? Math.min(3, hMax*H*0.45) : 1.2, n ? z/n : 0);
  majCamera();
}

function villeAleatoire(seed){
  vider();
  const rnd = mulberry32(seed);
  const centre = cellules.filter(c => Math.hypot(c.cx, c.cz) < 4.5);
  if(!centre.length) return;
  const nAmas = 5 + Math.floor(rnd()*4);

  for(let k=0;k<nAmas;k++){
    const depart = centre[Math.floor(rnd()*centre.length)];
    const teinteAmas = Math.floor(rnd()*PAL.length);
    const hBase = 1 + Math.floor(rnd()*3);
    const taille = 5 + Math.floor(rnd()*9);
    const file = [depart], vus = new Set([depart.i]);
    let n = 0;
    while(file.length && n < taille){
      const c = file.shift();
      n++;
      if(!c.b.length){
        c.sp = [];
        const hh = Math.min(H_MAX, Math.max(1, hBase + Math.floor(rnd()*3) - 1));
        c.b = [];
        for(let L=0; L<hh; L++){
          c.b[L] = rnd() < 0.12 ? Math.floor(rnd()*PAL.length) : teinteAmas;
        }
      }
      const voisins = c.nb.filter(Boolean);
      melanger(voisins, rnd);
      for(const v of voisins){
        if(!vus.has(v.i) && Math.hypot(v.cx, v.cz) < 7.5 && rnd() < 0.72){
          vus.add(v.i); file.push(v);
        }
      }
    }
  }
}

/* ============================================================
   8. État / URL
   ============================================================ */
let graine = Math.floor(Math.random()*1e9);

function encoder(){
  let s = '';
  for(const c of cellules){
    const T = Math.min(c.b.length, H_MAX);
    s += String.fromCharCode(48 + T);
    for(let L=0; L<T; L++){
      const sp = c.sp[L];
      if(occ(c,L) && sp) s += String.fromCharCode(62, 48+sp.t, 48+sp.r, 48+sp.p);
      else               s += String.fromCharCode(48 + (occ(c,L) ? c.b[L] : -1));
    }
  }
  return graine.toString(36) + '.' + btoa(s).replace(/=+$/,'');
}
function decoder(txt){
  try{
    const [g, b] = txt.split('.');
    const s = Number.parseInt(g, 36);
    if(!Number.isFinite(s)) return false;
    graine = s;
    genererGrille(graine);
    construireGrille();
    if(!b) return true;
    const d = atob(b);
    let p = 0;
    for(const c of cellules){
      if(p >= d.length) break;
      const T = Math.max(0, Math.min(H_MAX, d.charCodeAt(p++) - 48));
      c.b = []; c.sp = [];
      for(let L=0; L<T; L++){
        const code = d.charCodeAt(p++);
        if(code === 62){
          const t = Math.max(0, Math.min(TYPES.length-1, (d.charCodeAt(p++)||48) - 48));
          const r = Math.max(0, Math.min(3, (d.charCodeAt(p++)||48) - 48));
          const q = Math.max(0, Math.min(TYPES[t].parts.length-1, (d.charCodeAt(p++)||48) - 48));
          c.b[L] = 0; c.sp[L] = {t, r, p:q};
        }else{
          const v = (code || 47) - 48;
          c.b[L] = v < 0 ? -1 : Math.min(v, PAL.length-1);
        }
      }
      tailler(c);
    }
    return true;
  }catch(e){ return false; }
}
const horsLigne = location.protocol === 'file:';   // pas de replaceState sur file://
let tMaj = 0;
function majURL(){
  if(true) return;            // le jeu enregistre lui-meme
  if(horsLigne) return;
  clearTimeout(tMaj);
  tMaj = setTimeout(()=>{
    try{ history.replaceState(null, '', '#' + encoder()); }catch(e){}
  }, 400);
}
async function copier(txt){
  try{
    if(navigator.clipboard && isSecureContext){
      await navigator.clipboard.writeText(txt);
      return true;
    }
  }catch(e){}
  try{
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }catch(e){ return false; }
}

/* ============================================================
   9. Interface
   ============================================================ */
const elTypes = document.getElementById('types');
function majTypes(){
  [...elTypes.children].forEach((e,j)=>
    e.setAttribute('aria-pressed', (j-1) === typeCourant ? 'true' : 'false'));
  elPalette.style.opacity = typeCourant < 0 ? 1 : 0.4;
}
[].forEach((nom, j)=>{
  const b = document.createElement('button');
  b.textContent = nom;
  b.onclick = ()=>{ typeCourant = j-1; majTypes(); };
  elTypes.appendChild(b);
});

const elPalette = document.getElementById('palette');
[].forEach((hex, i)=>{
  const b = document.createElement('button');
  b.className = 'swatch';
  b.style.background = hex;
  b.setAttribute('aria-label', 'Couleur ' + (i+1));
  b.setAttribute('aria-pressed', i === couleur ? 'true' : 'false');
  b.onclick = ()=>{
    couleur = i;
    typeCourant = -1;
    majTypes();
    [...elPalette.children].forEach((e,j)=>
      e.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
  };
  elPalette.appendChild(b);
});
majTypes();

const elToast = document.getElementById('toast');
let tToast = 0;
function toast(msg){
  elToast.textContent = msg;
  elToast.style.opacity = 1;
  clearTimeout(tToast);
  tToast = setTimeout(()=>{ elToast.style.opacity = 0; }, 1600);
}

document.getElementById('btnVider').onclick = ()=>{
  vider(); demanderRebati(); marquerHistoire(); majURL(); toast('Île vidée');
};
document.getElementById('btnIle').onclick = ()=>{
  graine = Math.floor(Math.random()*1e9);
  genererGrille(graine); construireGrille();
  villeAleatoire(graine); demanderRebati(); recentrer();
  hist = []; iHist = -1; marquerHistoire(); majURL();
  toast('Nouvelle île');
};
document.getElementById('btnVille').onclick = ()=>{
  villeAleatoire(Math.floor(Math.random()*1e9));
  demanderRebati(); recentrer(); marquerHistoire(); majURL();
};
const NOMS_CIEL = ['Jour','Nuit','Cycle'];
document.getElementById('btnAnnuler').onclick = annuler;
document.getElementById('btnRetablir').onclick = retablir;

document.getElementById('btnCiel').onclick = (e)=>{
  modeJour = (modeJour + 1) % 3;
  e.target.textContent = NOMS_CIEL[modeJour];
};

document.getElementById('btnLien').onclick = async ()=>{
  const hash = '#' + encoder();
  const url = location.href.split('#')[0] + hash;
  if(await copier(url)){ toast('Lien copié'); return; }
  try{ location.hash = hash; toast('Lien dans la barre d’adresse'); }
  catch(e){ toast('Copie impossible'); }
};

/* ============================================================
   10. Caméra & entrées
   ============================================================ */
let enCours = null;              // {x, y, bouton, bouge, peint}
const SEUIL = 5;

/* Reconstruction différée : les événements marquent la scène à refaire, et la
   boucle de rendu la refait au plus une fois par image. Sans ça, peindre en
   glissant déclenchait une reconstruction par déplacement de souris. */
let aRefaire = false;
function demanderRebati(){ aRefaire = true; }

/* Caméra amortie : on vise une orbite, la caméra s'en approche à chaque image.
   Le zoom se fait vers le point survolé plutôt que vers le centre. */
const orbiteCible = { theta:orbite.theta, phi:orbite.phi, rayon:orbite.rayon };
const cibleVoulue = cible.clone();
function majCamera(){
  const {theta, phi, rayon} = orbite;
  camera.position.set(
    cible.x + rayon*Math.sin(phi)*Math.sin(theta),
    cible.y + rayon*Math.cos(phi),
    cible.z + rayon*Math.sin(phi)*Math.cos(theta)
  );
  camera.lookAt(cible);
}
function amortirCamera(dt){
  const k = Math.min(1, dt*11);
  orbite.theta += (orbiteCible.theta - orbite.theta)*k;
  orbite.phi   += (orbiteCible.phi   - orbite.phi)*k;
  orbite.rayon += (orbiteCible.rayon - orbite.rayon)*k;
  cible.x += (cibleVoulue.x - cible.x)*k;
  cible.y += (cibleVoulue.y - cible.y)*k;
  cible.z += (cibleVoulue.z - cible.z)*k;
  majCamera();
}

/* ---------- historique ---------------------------------------------------- */
const MAX_HIST = 80;
let hist = [], iHist = -1;
function etatCompact(){
  let s = '';
  for(const c of cellules){
    const T = Math.min(c.b.length, H_MAX);
    s += String.fromCharCode(48 + T);
    for(let L=0; L<T; L++){
      const sp = c.sp[L];
      if(occ(c,L) && sp) s += String.fromCharCode(62, 48+sp.t, 48+sp.r, 48+sp.p);
      else               s += String.fromCharCode(48 + (occ(c,L) ? c.b[L] : -1));
    }
  }
  return s;
}
function appliquerCompact(d){
  let p = 0;
  for(const c of cellules){
    if(p >= d.length) break;
    const T = Math.max(0, Math.min(H_MAX, d.charCodeAt(p++) - 48));
    c.b = []; c.sp = [];
    for(let L=0; L<T; L++){
      const code = d.charCodeAt(p++);
      if(code === 62){
        const t = Math.max(0, Math.min(TYPES.length-1, (d.charCodeAt(p++)||48) - 48));
        const r = Math.max(0, Math.min(3, (d.charCodeAt(p++)||48) - 48));
        const q = Math.max(0, Math.min(TYPES[t].parts.length-1, (d.charCodeAt(p++)||48) - 48));
        c.b[L] = 0; c.sp[L] = {t, r, p:q};
      }else{
        const v = (code || 47) - 48;
        c.b[L] = v < 0 ? -1 : Math.min(v, PAL.length-1);
      }
    }
    tailler(c);
  }
}
function marquerHistoire(){
  const e = etatCompact();
  if(iHist >= 0 && hist[iHist] === e) return;
  hist = hist.slice(0, iHist+1);
  hist.push(e);
  if(hist.length > MAX_HIST) hist.shift();
  iHist = hist.length - 1;
  majBoutonsHist();
}
function annuler(){
  if(iHist <= 0) return;
  iHist--;
  appliquerCompact(hist[iHist]);
  demanderRebati(); majURL(); majBoutonsHist();
}
function retablir(){
  if(iHist >= hist.length-1) return;
  iHist++;
  appliquerCompact(hist[iHist]);
  demanderRebati(); majURL(); majBoutonsHist();
}
function majBoutonsHist(){
  document.getElementById('btnAnnuler').disabled = iHist <= 0;
  document.getElementById('btnRetablir').disabled = iHist >= hist.length-1;
}

/* ---------- fantôme de pose ---------------------------------------------- */
/* Le curseur montre l'empreinte réelle de ce qui sera posé — toutes les parts
   d'un atelier, à la rotation retenue — en vert si c'est possible, en rouge
   sinon. L'ancien carré blanc disparaissait quand la pose était refusée, ce
   qui n'expliquait rien. */
let rotManuelle = 0;
let cleFantome = '';
function majSurvol(t){
  const p = t && t.pose;
  if(!p){ survol.visible = false; cleFantome = ''; return; }
  const ok = posable(p);
  const fa = t.face;
  let cases;
  if(ok && typeCourant >= 0){
    const r = meilleureRotation(p.c, p.L, typeCourant);
    cases = placementOk(p.c, p.L, typeCourant, r) || [[p.c, p.L]];
  }else{
    cases = [[p.c, p.L]];
  }
  const cle = (ok?'v':'r') + cases.map(([c,L]) => c.i+':'+L).join(',')
            + (fa ? '|'+fa.c.i+':'+fa.L+':'+fa.e : '');
  if(cle === cleFantome){ survol.visible = true; return; }
  cleFantome = cle;

  const a = [];
  for(const [c, L] of cases){
    /* Le fantôme est rétréci vers le centre de la cellule. Sans ce retrait il
       tombe exactement dans le plan du mur voisin quand on vise une façade, et
       les deux surfaces se disputent le tampon de profondeur — d'où le moiré
       en diagonale sur la maison d'à côté. */
    const S = c.q.map(v => {
      const p = P[v];
      const dx = c.cx - p[0], dz = c.cz - p[1], l = Math.hypot(dx,dz) || 1;
      return [p[0] + dx/l*0.045, p[1] + dz/l*0.045];
    });
    const y0 = Math.max(L*H, L === 0 ? SOL : 0) + 0.03;
    const y1 = y0 + (L === 0 ? 0.09 : H*0.86);
    const q = (A,B,C,D)=>{ a.push(...A,...B,...C, ...A,...C,...D); };
    q([S[0][0],y1,S[0][1]], [S[1][0],y1,S[1][1]],
      [S[2][0],y1,S[2][1]], [S[3][0],y1,S[3][1]]);
    for(let i=0;i<4;i++){
      const A=S[i], B=S[(i+1)%4];
      q([A[0],y0,A[1]], [B[0],y0,B[1]], [B[0],y1,B[1]], [A[0],y1,A[1]]);
      q([A[0],y1,A[1]], [B[0],y1,B[1]], [B[0],y0,B[1]], [A[0],y0,A[1]]);
    }
  }
  if(fa){                       // plaque sur la face verticale visée
    const S = fa.c.q.map(v => P[v]);
    const A = S[fa.e], B = S[(fa.e+1)%4];
    const mx=(A[0]+B[0])/2 - fa.c.cx, mz=(A[1]+B[1])/2 - fa.c.cz;
    const l = Math.hypot(mx,mz) || 1;
    const ox = mx/l*0.040, oz = mz/l*0.040;
    const y0 = fa.L*H + 0.025, y1 = (fa.L+1)*H - 0.025;
    const Q1=[A[0]+ox, y0, A[1]+oz], Q2=[B[0]+ox, y0, B[1]+oz];
    const Q3=[B[0]+ox, y1, B[1]+oz], Q4=[A[0]+ox, y1, A[1]+oz];
    a.push(...Q1,...Q2,...Q3, ...Q1,...Q3,...Q4);
    a.push(...Q1,...Q3,...Q2, ...Q1,...Q4,...Q3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a,3));
  survol.geometry.dispose();
  survol.geometry = g;
  survol.material.color.setRGB(ok ? 0.30 : 0.55, ok ? 0.62 : 0.10, ok ? 0.28 : 0.10);
  survol.material.opacity = ok ? 0.32 : 0.40;
  survol.visible = true;
}

/* ---------- pointeur ------------------------------------------------------ */
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* LE CLIC APPARTIENT AU JEU. Le bac a sable posait et retirait
   directement ; ici l'on transmet la visee, et c'est l'economie du
   bourg qui decide (chantier a ouvrir, fenetre a montrer, refus). */
let __surClic = null, __surSurvol = null;
function agir(e, bouton){
  const t = viser(e.clientX, e.clientY);
  if(__surClic) return __surClic(t, bouton) === true;
  return false;
}

canvas.addEventListener('pointerdown', e=>{
  /* la capture echoue sur un pointeur synthetique ou un peripherique
     recalcitrant : sans ce garde, le clic n'etait jamais enregistre */
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  enCours = {x:e.clientX, y:e.clientY, bouton:e.button, bouge:false,
             peint:e.shiftKey};
  if(enCours.peint) agir(e, e.button);
});

canvas.addEventListener('pointermove', e=>{
  if(enCours){
    const dx = e.clientX - enCours.x, dy = e.clientY - enCours.y;
    if(enCours.peint){                      // maj enfoncée : on peint en glissant
      enCours.x = e.clientX; enCours.y = e.clientY;
      agir(e, enCours.bouton);
      return;
    }
    if(!enCours.bouge && Math.hypot(dx,dy) > SEUIL) enCours.bouge = true;
    if(enCours.bouge){
      orbiteCible.theta -= dx*0.006;
      orbiteCible.phi = Math.max(0.18, Math.min(1.45, orbiteCible.phi - dy*0.005));
      enCours.x = e.clientX; enCours.y = e.clientY;
      survol.visible = false; cleFantome = '';
    }
    return;
  }
  const _t = viser(e.clientX, e.clientY);
  majSurvol(_t);
  if(__surSurvol) __surSurvol(_t);
});

canvas.addEventListener('pointerup', e=>{
  if(!enCours) return;
  const c = enCours; enCours = null;
  if(c.peint){ marquerHistoire(); majSurvol(viser(e.clientX, e.clientY)); return; }
  if(c.bouge) return;
  if(agir(e, c.bouton)) marquerHistoire();
  majSurvol(viser(e.clientX, e.clientY));
});

canvas.addEventListener('pointercancel', ()=>{ enCours = null; });
canvas.addEventListener('pointerleave', ()=>{ survol.visible = false; cleFantome=''; });

canvas.addEventListener('wheel', e=>{
  e.preventDefault();
  const av = orbiteCible.rayon;
  orbiteCible.rayon = Math.max(6, Math.min(60,
    orbiteCible.rayon * (1 + Math.sign(e.deltaY)*0.10)));
  // zoom vers le point survolé : on décale la cible d'une fraction de l'écart
  const t = viser(e.clientX, e.clientY);
  if(t && t.pose && orbiteCible.rayon < av){
    const c = t.pose.c, f = 0.18;
    cibleVoulue.x += (c.cx - cibleVoulue.x)*f;
    cibleVoulue.z += (c.cz - cibleVoulue.z)*f;
  }
}, {passive:false});

addEventListener('keydown', e=>{
  const n = Number(e.key);
  if(n >= 1 && n <= 9 && n <= PAL.length){ elPalette.children[n-1].click(); return; }
  const k = e.key.toLowerCase();
  if((e.ctrlKey || e.metaKey) && k === 'z'){ e.preventDefault(); e.shiftKey ? retablir() : annuler(); return; }
  if((e.ctrlKey || e.metaKey) && k === 'y'){ e.preventDefault(); retablir(); return; }
  if(k === 'r'){ rotManuelle = (rotManuelle+1)%4; cleFantome=''; toast('Orientation ' + (rotManuelle+1) + '/4'); return; }
  const pas = 0.7;
  if(k === 'arrowleft'  || k === 'q'){ cibleVoulue.x -= Math.cos(orbite.theta)*pas; cibleVoulue.z += Math.sin(orbite.theta)*pas; }
  if(k === 'arrowright' || k === 'd'){ cibleVoulue.x += Math.cos(orbite.theta)*pas; cibleVoulue.z -= Math.sin(orbite.theta)*pas; }
  if(k === 'arrowup'    || k === 'z'){ cibleVoulue.x -= Math.sin(orbite.theta)*pas; cibleVoulue.z -= Math.cos(orbite.theta)*pas; }
  if(k === 'arrowdown'  || k === 's'){ cibleVoulue.x += Math.sin(orbite.theta)*pas; cibleVoulue.z += Math.cos(orbite.theta)*pas; }
  if(k === 'home'){ recentrer(); }
});

function redimensionner(){
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);

/* ============================================================
   11. Démarrage
   ============================================================ */
/* DEMARRAGE - l'ile est engendree et VIDE. Le jeu pose les batiments.
   (l'original tirait ici une ville au hasard et relisait l'URL) */
genererGrille(graine);
construireGrille();
vider();
construire();
redimensionner();
recentrer();

/* Cycle jour/nuit. Le ciel et l'eau sont teintés par le MÊME facteur, donc la
   jonction à l'horizon reste invariante ; le brouillard suit la même teinte
   pour que les lointains s'y fondent encore. */
/* Cycle jour / nuit. Trois ambiances — plein jour, crépuscule, nuit — pondérées
   par la hauteur du soleil. Le ciel et l'eau ne sont plus teintés par un simple
   facteur : leurs couleurs par sommet sont recalculées à chaque image entre une
   couleur d'horizon et une couleur de zénith. C'est le seul moyen d'avoir un
   couchant orangé en bas et un bleu profond au-dessus — et la jonction reste
   exacte, puisque l'eau au large et le ciel à l'horizon partagent la même
   valeur par construction. */
const AMBIANCES = {
  jour:  { hor:'#4f8c96', zen:'#b0d0d1', eau:'#3d7480',
           sol:[1.00,0.95,0.88], iSol:1.35, amb:[0.75,0.90,0.92], iAmb:0.85 },
  crep:  { hor:'#e08a5a', zen:'#5d6a9e', eau:'#6b5a6a',
           sol:[1.00,0.56,0.28], iSol:0.80, amb:[0.74,0.56,0.52], iAmb:0.50 },
  nuit:  { hor:'#18243c', zen:'#070c1c', eau:'#0d1626',
           sol:[0.42,0.56,1.00], iSol:0.07, amb:[0.10,0.15,0.36], iAmb:0.18 }
};
for(const a of Object.values(AMBIANCES)){
  a.lHor = lin(a.hor); a.lZen = lin(a.zen); a.lEau = lin(a.eau);
}
const doux01 = (a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };

let modeJour = 2;                 // 0 jour, 1 nuit, 2 cycle
let nuit = 0, hSoleil = 0.8;
const melC = (a,b,c,w) => ({
  r: a.r*w[0] + b.r*w[1] + c.r*w[2],
  g: a.g*w[0] + b.g*w[1] + c.g*w[2],
  b: a.b*w[0] + b.b*w[1] + c.b*w[2]
});
function recolorer(geo, cHor, cAutre){
  const u = geo.userData.u, c = geo.attributes.color.array;
  for(let i=0;i<u.length;i++){
    const t = u[i];
    c[i*3]   = cHor.r + (cAutre.r-cHor.r)*t;
    c[i*3+1] = cHor.g + (cAutre.g-cHor.g)*t;
    c[i*3+2] = cHor.b + (cAutre.b-cHor.b)*t;
  }
  geo.attributes.color.needsUpdate = true;
}

function majJourNuit(dt){
  const cible = modeJour === 0 ? 0.85 : modeJour === 1 ? -0.75
              : Math.sin(temps*Math.PI*2/180);
  hSoleil += (cible - hSoleil) * Math.min(1, dt*1.4);
  const h = hSoleil;
  const wJ = doux01(0.05, 0.42, h);
  const wN = doux01(-0.02, -0.30, h);
  const wC = Math.max(0, 1 - wJ - wN);
  const w = [wJ, wC, wN];
  const J = AMBIANCES.jour, C = AMBIANCES.crep, N = AMBIANCES.nuit;

  const cHor = melC(J.lHor, C.lHor, N.lHor, w);
  const cZen = melC(J.lZen, C.lZen, N.lZen, w);
  const cEau = melC(J.lEau, C.lEau, N.lEau, w);
  recolorer(ciel.geometry, cHor, cZen);
  recolorer(eau.geometry,  cEau, cHor);      // proche -> horizon
  scene.fog.color.setRGB(cHor.r, cHor.g, cHor.b);

  soleil.intensity = J.iSol*wJ + C.iSol*wC + N.iSol*wN;
  soleil.color.setRGB(J.sol[0]*wJ + C.sol[0]*wC + N.sol[0]*wN,
                      J.sol[1]*wJ + C.sol[1]*wC + N.sol[1]*wN,
                      J.sol[2]*wJ + C.sol[2]*wC + N.sol[2]*wN);
  ambiance.intensity = J.iAmb*wJ + C.iAmb*wC + N.iAmb*wN;
  ambiance.color.setRGB(J.amb[0]*wJ + C.amb[0]*wC + N.amb[0]*wN,
                        J.amb[1]*wJ + C.amb[1]*wC + N.amb[1]*wN,
                        J.amb[2]*wJ + C.amb[2]*wC + N.amb[2]*wN);
  // le soleil descend vers l'horizon, les ombres s'allongent
  /* Course du soleil : SUPPRIMÉE. Même quantifiée finement, une direction qui
     évolue oblige à refaire la carte d'ombre, et chaque rafraîchissement fait
     frissonner tous les petits contours. La lumière change de couleur et
     d'intensité au fil du cycle, mais elle vient toujours du même point : la
     carte d'ombre n'est plus recalculée qu'au changement de géométrie. */
  /* Course du soleil. Elle était ample — plus d'un radian d'élévation — et
     quantifiée par crans de 0,04 pour éviter le scintillement de la carte
     d'ombre : chaque cran déplaçait l'ombre d'une trentaine de texels d'un
     coup, toutes les trois secondes. On voyait l'à-coup.
     La course est maintenant réduite à trois dixièmes de radian, et le cran
     descend à 0,002 : mesuré, chaque saut déplace une ombre longue de deux
     texels environ, trois fois et demie par seconde. Le soleil tourne toujours,
     mais l'ombre ne sursaute plus — et trois passes d'ombre par seconde ne
     coûtent rien face à soixante. */
  if(soleil.userData.el === undefined){
    soleil.userData.el = 0.86;
    soleil.position.set(Math.cos(0.70)*Math.cos(0.86)*20, Math.sin(0.86)*20 + 2,
                        Math.sin(0.70)*Math.cos(0.86)*20);
    ombreARefaire = true;
  }

  nuit = Math.min(1, wN + wC*0.62);
  const lum = { r: 1 - nuit*0.82, g: 1 - nuit*0.80, b: 1 - nuit*0.62 };
  matVague.color.setRGB(lum.r, lum.g, lum.b);
  matFumee.color.setRGB(lum.r, lum.g, lum.b);

  /* Vacillement : chaque famille de lueurs a ses propres périodes, et les
     lanternes reçoivent en plus un crachotement bref qui casse la régularité. */
  const cra = (t, p) => {
    const b = Math.sin(t*17.0 + p) * Math.sin(t*6.1 + p*2.3);
    return b > 0.72 ? -0.30*(b-0.72)/0.28 : 0;
  };
  const vac = [
    0.95 + 0.05*Math.sin(temps*1.7 + 1.3),
    0.93 + 0.07*Math.sin(temps*2.3 + 4.1),
    0.88 + 0.12*Math.sin(temps*5.1) + cra(temps, 0.0),
    0.86 + 0.14*Math.sin(temps*6.7 + 2.1) + cra(temps, 2.4),
    0.82 + 0.18*(0.5*Math.sin(temps*3.3 + 0.7) + 0.5*Math.sin(temps*7.9 + 2.9)),
    0.80 + 0.20*(0.5*Math.sin(temps*4.1 + 2.2) + 0.5*Math.sin(temps*6.3 + 5.1))
  ];
  for(let g=0; g<NB_LUEURS; g++){
    matLampes[g].opacity = Math.max(0, nuit * vac[g]);
    meshLampes[g].visible = nuit > 0.02;
  }
}

let tPrec = performance.now(), temps = 0;
let __surTick = null, __manuel = false;
function boucle(){
  if(!__manuel) requestAnimationFrame(boucle);
  const t = performance.now();
  const dt = Math.min(0.05, (t - tPrec)/1000);
  tPrec = t;
  temps += dt;
  if(__surTick) __surTick(dt);
  majJourNuit(dt);
  amortirCamera(dt);
  if(aRefaire){ aRefaire = false; construire(); }
  /* À grande distance les menuiseries et la fumée occupent moins d'un pixel.
     Les masquer évite leur surdessin sans modifier la silhouette du bourg. */
  const detailsProches = orbite.rayon < 43;
  meshDetails.visible = detailsProches;
  meshFumee.visible = detailsProches && cheminees.length > 0;
  meshMouettes.visible = orbite.rayon < 52;
  for(const o of grpAiles.children) o.rotateZ(dt*(o.userData.vit || 0.55));
  animerVague(temps);
  animerPoissons(temps);
  animerFumee(temps);
  animerMouettes(temps);
  if(ombreARefaire){ renderer.shadowMap.needsUpdate = true; ombreARefaire = false; }
  tempsArbres.value = temps;
  renderer.render(scene, camera);
}
function __uneImage(){ __manuel = true; boucle(); }


/* ============================================================
   CE QUE LE JEU PEUT ATTEINDRE
   ============================================================ */
window.__VDOC = {
  get P(){ return P; },
  get cellules(){ return cellules; },
  celluleEn: celluleEn, TYPES: TYPES, PAL: PAL, H: H, H_MAX: H_MAX,
  poser: poser, retirer: retirer, vider: vider, posable: posable,
  placementOk: placementOk, meilleureRotation: meilleureRotation, protege: protege,
  set typeCourant(v){ typeCourant = v; },
  get typeCourant(){ return typeCourant; },
  set couleur(v){ couleur = v; },
  get couleur(){ return couleur; },
  set rotManuelle(v){ rotManuelle = v; },
  demanderRebati: demanderRebati, construire: construire,
  recentrer: recentrer, viser: viser, majSurvol: majSurvol,
  get scene(){ return scene; },
  get camera(){ return camera; },
  get renderer(){ return renderer; },
  get canvas(){ return canvas; },
  get survol(){ return survol; },
  get orbite(){ return orbite; },
  get orbiteCible(){ return orbiteCible; },
  get cibleVoulue(){ return cibleVoulue; },
  get grille(){ return grille; },
  get temps(){ return temps; },
  set modeJour(v){ modeJour = v; },
  get modeJour(){ return modeJour; },
  get hSoleil(){ return hSoleil; },
  get nuit(){ return nuit; },
  set surTick(f){ __surTick = f; },
  set surClic(f){ __surClic = f; },
  set surSurvol(f){ __surSurvol = f; },
  uneImage: __uneImage,
  demarrer: function(){ __manuel = false; boucle(); },
  set graine(v){ graine = v; },
  get graine(){ return graine; },
  regenererIle: function(g){
    graine = g;
    genererGrille(graine);
    construireGrille();
    vider();
    construire();
    recentrer();
  }
};

})();
