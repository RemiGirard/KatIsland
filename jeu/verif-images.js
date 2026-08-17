/* ============================================================
   LE BOURG — jeu/verif-images.js
   CE QUI MANQUE, ET CE QUI TRAÎNE.

       node jeu/verif-images.js            tout
       node jeu/verif-images.js portrait   une catégorie
       node jeu/verif-images.js res        les ressources seules
       node jeu/verif-images.js --vides    seulement ce qui est vide

   Le classement des images est fait de DOSSIERS : un dossier par
   ressource, par bâtiment, par métier. On y jette les images sans les
   renommer — c'est le chemin qui dit ce qu'elles sont.

   L'audit ne lit donc plus un manifeste (il vieillissait à chaque
   ressource ajoutée, et personne ne s'en apercevait). Il lit LES
   DONNÉES DU JEU et compare : tout ce que le jeu connaît doit avoir son
   dossier, tout dossier doit correspondre à quelque chose.
   ============================================================ */
"use strict";
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.join(__dirname, '..');
const IMG = path.join(RACINE, 'img');

/* ---- on charge les données comme le navigateur le ferait ---- */
const ctx = { window: {}, console, document: undefined };
vm.createContext(ctx);
for (const f of ['donnees/ressources.js', 'donnees/batiments.js',
                 'donnees/habitants.js', 'donnees/butins.js']) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
    catch (e) { /* un fichier qui touche au DOM : on s'en passe */ }
  }
}
const RES = ctx.window.RES || {};
const BAT = ctx.window.BAT || {};
const MET = ctx.window.METIERS || {};

const arg = (process.argv[2] || '').toLowerCase();
const seulementVides = arg === '--vides';
const filtre = seulementVides ? '' : arg;

const EXT = /\.(png|webp|jpg|jpeg|svg)$/i;

/* combien d'images dans ce dossier. `plat` : la racine seulement, sans
   descendre — c'est ce qu'il faut pour compter la pile non triée d'un
   dossier de portraits sans recompter homme/ et femme/. */
function compter(rel, plat) {
  const abs = path.join(RACINE, rel);
  if (!fs.existsSync(abs)) return null;          // null = le dossier manque
  let n = 0;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!plat) n += (compter(rel + '/' + e.name) || 0); }
    else if (EXT.test(e.name)) n++;
  }
  return n;
}

/* ---- ce que le jeu attend ---- */
const groupes = [];
function groupe(cle, titre, base, cles, nomDe) {
  groupes.push({
    cle, titre,
    lignes: cles.map(k => ({ id: k, nom: nomDe(k), dossier: base + '/' + k })),
  });
}
groupe('res', 'Ressources', 'img/res', Object.keys(RES), k => RES[k].nom);
groupe('bat', 'Bâtiments', 'img/bat', Object.keys(BAT), k => BAT[k].nom);
groupe('metier', 'Métiers (icônes)', 'img/metier', Object.keys(MET), k => MET[k].nom);

/* Les portraits ont leur propre plan : un dossier par métier, et dans
   chacun un sous-dossier homme et un sous-dossier femme. Les noms de
   dossiers viennent du disque, parce que c'est vous qui les tenez. */
if (fs.existsSync(path.join(IMG, 'portrait'))) {
  const dd = fs.readdirSync(path.join(IMG, 'portrait'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name);
  const lignes = [];
  for (const d of dd) {
    /* la racine du dossier : les images déposées avant qu'on sépare les
       deux sexes. Elles servent toujours — elles ne sont juste pas
       encore rangées. */
    lignes.push({ id: d, nom: d + ' · non trié', dossier: 'img/portrait/' + d, plat: true });
    for (const g of ['homme', 'femme'])
      lignes.push({ id: d + '/' + g, nom: d + ' · ' + g, dossier: 'img/portrait/' + d + '/' + g });
  }
  groupes.push({ cle: 'portrait', titre: 'Portraits', lignes });
  /* un métier sans dossier de portraits, c'est un villageois sans visage */
  for (const k in MET)
    if (!dd.some(d => d.replace(/-\d+$/, '') === k))
      groupes[groupes.length - 1].lignes.push(
        { id: k, nom: MET[k].nom + ' — AUCUN DOSSIER', dossier: 'img/portrait/' + k });
}

/* les autres familles vivent uniquement sur le disque */
for (const fam of ['unite', 'gardien', 'peril', 'cat', 'cadre', 'ui']) {
  const abs = path.join(IMG, fam);
  if (!fs.existsSync(abs)) continue;
  const dd = fs.readdirSync(abs, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name);
  groupes.push({
    cle: fam, titre: fam[0].toUpperCase() + fam.slice(1),
    lignes: dd.map(d => ({ id: d, nom: d, dossier: 'img/' + fam + '/' + d })),
  });
}

/* ---- le rapport ---- */
const pad = (s, n) => String(s).padEnd(n);
console.log('\n=== Images du bourg ===' +
            (filtre ? '   (filtre : ' + filtre + ')' : '') +
            (seulementVides ? '   (les vides seulement)' : ''));
console.log('');

let totalAttendu = 0, totalFait = 0, totalImages = 0;
const absents = [], vides = [];

for (const g of groupes) {
  if (filtre && !g.cle.startsWith(filtre) && !g.titre.toLowerCase().startsWith(filtre)) continue;
  let fait = 0;
  for (const l of g.lignes) {
    const n = compter(l.dossier, l.plat);
    l.n = n;
    if (n === null) absents.push(l);
    else if (n === 0) vides.push(l);
    else { fait++; totalImages += n; }
  }
  totalAttendu += g.lignes.length;
  totalFait += fait;
  const part = g.lignes.length ? fait / g.lignes.length : 0;
  const barre = '█'.repeat(Math.round(part * 22)).padEnd(22, '·');
  console.log('  ' + pad(g.titre, 18) + barre + '  ' +
              pad(fait + ' / ' + g.lignes.length, 10) +
              String(Math.round(part * 100)).padStart(4) + ' %');
}

if (absents.length) {
  console.log('\n--- DOSSIERS ABSENTS (' + absents.length + ') ---');
  console.log('    le jeu connaît ces sujets, mais rien ne les attend sur le disque');
  for (const l of absents) console.log('  ' + pad(l.nom, 28) + l.dossier);
}

if (vides.length) {
  console.log('\n--- DOSSIERS VIDES (' + vides.length + ') ---');
  for (const l of vides) console.log('  ' + pad(l.nom, 28) + l.dossier);
}

/* un dossier que le jeu ne réclame pas : presque toujours un nom mal
   recopié, ou une ressource renommée depuis */
const orphelins = [];
for (const [fam, cles] of [['res', Object.keys(RES)], ['bat', Object.keys(BAT)],
                           ['metier', Object.keys(MET)]]) {
  const abs = path.join(IMG, fam);
  if (!fs.existsSync(abs)) continue;
  for (const e of fs.readdirSync(abs, { withFileTypes: true }))
    if (e.isDirectory() && !cles.includes(e.name)) orphelins.push('img/' + fam + '/' + e.name);
}
if (orphelins.length) {
  console.log('\n--- DOSSIERS ORPHELINS (' + orphelins.length + ') ---');
  console.log('    rien dans le jeu ne porte ce nom : faute de frappe, ou sujet disparu');
  for (const o of orphelins) console.log('  ' + o);
}

console.log('\n' + totalFait + ' / ' + totalAttendu + ' dossiers garnis · ' +
            totalImages + ' images sur le disque · ' +
            absents.length + ' absents · ' + vides.length + ' vides\n');
