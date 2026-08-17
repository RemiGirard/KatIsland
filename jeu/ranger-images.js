/* ============================================================
   RANGER LES IMAGES.

   Le navigateur ne sait pas lister un dossier : il ne peut demander
   qu'une adresse précise. Tant que les fichiers s'appellent
   `birdscats_20725_flat_vector_portrait_of_an_anthropomorphic_bl_12f…`,
   aucun code ne peut les atteindre.

   On leur donne donc des noms que l'on peut CALCULER — et l'on écrit
   un manifeste pour ce qui reste variable (combien de portraits par
   métier, par sexe).

   Le script est SANS PERTE et REJOUABLE : il ne renomme que ce qui ne
   porte pas déjà le bon nom, et ne supprime rien.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const IMG = path.join(RACINE, 'img');
const EXT = /\.(png|webp|jpg|jpeg)$/i;
const seche = process.argv.includes('--essai');

let renommes = 0, deja = 0;
function bouger(de, vers) {
  if (de === vers) { deja++; return; }
  if (fs.existsSync(vers)) { console.log('  ! occupé, ignoré : ' + path.basename(vers)); return; }
  if (!seche) fs.renameSync(de, vers);
  renommes++;
}

/* ------------------------------------------------------------------
   1. LES DOSSIERS DE PORTRAITS PRENNENT LE NOM DE LEUR MÉTIER
   `bois-1` n'a plus de sens depuis que les variantes 2 et 3 sont
   parties, et `standar` est une faute de frappe qu'aucun code ne
   devinera.
   ------------------------------------------------------------------ */
const PORTRAIT = path.join(IMG, 'portrait');
for (const d of fs.readdirSync(PORTRAIT)) {
  const abs = path.join(PORTRAIT, d);
  if (!fs.statSync(abs).isDirectory()) continue;
  const propre = d === 'standar' ? 'standard' : d.replace(/-\d+$/, '');
  if (propre !== d) {
    const vers = path.join(PORTRAIT, propre);
    if (fs.existsSync(vers)) { console.log('  ! ' + propre + ' existe déjà, ' + d + ' laissé'); continue; }
    if (!seche) fs.renameSync(abs, vers);
    console.log('  dossier  ' + d + ' -> ' + propre);
  }
}

/* ------------------------------------------------------------------
   2. LES PORTRAITS : <metier>-<sexe>-NN.png
   ------------------------------------------------------------------ */
const manifeste = { res: {}, portrait: {}, bat: {}, metier: {}, unite: {}, gardien: {} };

for (const d of fs.readdirSync(PORTRAIT).sort()) {
  const abs = path.join(PORTRAIT, d);
  if (!fs.statSync(abs).isDirectory()) continue;
  manifeste.portrait[d] = { homme: 0, femme: 0, vrac: 0 };

  for (const sexe of ['homme', 'femme']) {
    const dir = path.join(abs, sexe);
    if (!fs.existsSync(dir)) continue;
    /* on trie par nom pour que l'ordre soit stable d'une exécution à
       l'autre : un portrait ne doit pas changer de numéro. */
    const f = fs.readdirSync(dir).filter(x => EXT.test(x)).sort();
    let n = 0;
    for (const nom of f) {
      n++;
      const cible = d + '-' + sexe + '-' + String(n).padStart(2, '0') + '.png';
      bouger(path.join(dir, nom), path.join(dir, cible));
    }
    manifeste.portrait[d][sexe] = n;
  }
  /* ce qui traîne encore à la racine : pas trié, on le compte à part */
  const vrac = fs.readdirSync(abs).filter(x => EXT.test(x)).sort();
  let n = 0;
  for (const nom of vrac) {
    n++;
    bouger(path.join(abs, nom), path.join(abs, d + '-vrac-' + String(n).padStart(2, '0') + '.png'));
  }
  manifeste.portrait[d].vrac = n;
}

/* ------------------------------------------------------------------
   3. LES RESSOURCES : <id>.png, et <id>-cerne.png pour la variante
   cernée. On garde les deux — c'est la SANS cerne qu'on affichera,
   mais l'autre peut servir sur fond sombre.
   ------------------------------------------------------------------ */
for (const fam of ['res', 'bat', 'metier', 'unite', 'gardien']) {
  const base = path.join(IMG, fam);
  if (!fs.existsSync(base)) continue;
  for (const d of fs.readdirSync(base).sort()) {
    const abs = path.join(base, d);
    if (!fs.statSync(abs).isDirectory()) continue;
    const f = fs.readdirSync(abs).filter(x => EXT.test(x));
    const cerne = f.filter(x => /_outline\.|--?cerne\./i.test(x)).sort();
    const nu = f.filter(x => !/_outline\.|--?cerne\./i.test(x)).sort();
    if (nu[0]) bouger(path.join(abs, nu[0]), path.join(abs, d + '.png'));
    if (cerne[0]) bouger(path.join(abs, cerne[0]), path.join(abs, d + '-cerne.png'));
    /* les variantes en trop gardent un numéro */
    nu.slice(1).forEach((x, i) => bouger(path.join(abs, x), path.join(abs, d + '-' + (i + 2) + '.png')));
    manifeste[fam][d] = { nu: nu.length, cerne: cerne.length };
  }
}

/* ------------------------------------------------------------------
   4. LE MANIFESTE
   ------------------------------------------------------------------ */
const sortie = {
  /* combien de portraits par dossier et par sexe : le jeu en tire un au
     hasard, mais il doit savoir dans quel intervalle tirer. */
  portrait: {},
  /* la liste de ce qui a vraiment une image : inutile de demander au
     navigateur un fichier qui n'existe pas, il crie dans la console. */
  res: [], bat: [], metier: [], unite: [], gardien: [],
};
for (const d in manifeste.portrait) {
  const m = manifeste.portrait[d];
  if (m.homme || m.femme || m.vrac) sortie.portrait[d] = m;
}
for (const fam of ['res', 'bat', 'metier', 'unite', 'gardien'])
  for (const d in manifeste[fam]) if (manifeste[fam][d].nu) sortie[fam].push(d);

if (!seche) {
  fs.writeFileSync(path.join(IMG, 'images.json'),
                   JSON.stringify(sortie, null, 1), 'utf8');
  /* La même chose en SCRIPT. `fetch` échoue quand la page est ouverte
     en file:// — un double-clic sur index.html — et il arrive de toute
     façon après le premier rendu, si bien qu'on affichait les icônes
     dessinées puis on ne les remplaçait jamais. Un <script> n'a ni
     l'un ni l'autre défaut. */
  fs.writeFileSync(path.join(IMG, 'images.js'),
    ['/* ENGENDRÉ par node jeu/ranger-images.js — ne pas modifier. */',
     'window.__IMAGES = ' + JSON.stringify(sortie) + ';',
     ''].join('\n'), 'utf8');
}

console.log('');
console.log(renommes + ' renommés · ' + deja + ' déjà en place');
console.log('portraits : ' + Object.keys(sortie.portrait).length + ' dossiers');
console.log('res ' + sortie.res.length + ' · bat ' + sortie.bat.length +
            ' · metier ' + sortie.metier.length);
