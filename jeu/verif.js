/* ============================================================
   LE BOURG — jeu/verif.js
   AUDIT DE COHÉRENCE, à lancer hors du navigateur :
       node jeu/verif.js

   Une chaîne de production d'idle se casse toujours au même endroit :
   une ressource qu'aucune recette ne fabrique, un bâtiment dont le coût
   exige ce qu'il est le seul à produire, un déblocage qui attend une
   ressource inatteignable. Ce fichier cherche ces trois fautes-là, et
   simule l'ordre d'ouverture réel du carnet du maître d'œuvre.
   ============================================================ */
"use strict";
const fs = require('fs'), path = require('path'), vm = require('vm');

const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ['donnees/ressources.js', 'donnees/batiments.js', 'donnees/butins.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
}
const RES = ctx.window.RES, BAT = ctx.window.BAT, REC = ctx.window.REC;
const ORDRE = ctx.window.RES_ORDRE, UTIL = ctx.window.BatUtil;
const BUTINS = ctx.window.BUTINS || {}, PU = ctx.window.PerilUtil || {};

let fautes = 0, alertes = 0;
const err = m => { fautes++; console.log('  FAUTE   ' + m); };
const warn = m => { alertes++; console.log('  alerte  ' + m); };

console.log('\n=== 1. Ressources : qui les produit ? ===');
const produitePar = {};        // res -> [recettes]
const lootPar = {};
for (const id in REC) {
  const r = REC[id];
  for (const k in r.out) (produitePar[k] = produitePar[k] || []).push(id);
  for (const l of r.loot) (lootPar[l.res] = lootPar[l.res] || []).push(id);
}
/* les trouvailles de métier tombent sur TOUTES les recettes du métier :
   une ressource qui n'y figure que là est bel et bien obtenable. */
const trouvaillePar = {};
for (const m in BUTINS) for (const t of BUTINS[m]) (trouvaillePar[t.res] = trouvaillePar[t.res] || []).push(m);
/* et ce que rendent les gardiens de la tour */
const gardienPar = {};
for (const g of (PU.GARDIENS || [])) for (const k in g.butin) (gardienPar[k] = gardienPar[k] || []).push(g.nom);
const CONSOMMEES = new Set();
for (const id in REC) for (const k in REC[id].in) CONSOMMEES.add(k);
for (const bid in BAT) for (const k in (BAT[bid].cout || {})) CONSOMMEES.add(k);

const EXTERIEURES = new Set(['essence', 'gemme', 'ossuaire', 'obsidienne', 'relique',
  'oeilabyme', 'medaille', 'mithril', 'plan']);
for (const id of ORDRE) {
  const p = produitePar[id], l = lootPar[id];
  const t = trouvaillePar[id], g = gardienPar[id];
  const vient = p || l || t || g;
  if (!vient && !EXTERIEURES.has(id)) err('« ' + RES[id].nom + ' » (' + id + ') : personne ne la produit.');
  else if (!p && CONSOMMEES.has(id)) {
    const dou = t ? ('trouvaille de ' + t.join(', ')) : (g ? 'butin de gardien' : 'tables de butin');
    warn('« ' + RES[id].nom + ' » ne vient que du hasard (' + dou + ').');
  }
  if (!vient && !CONSOMMEES.has(id) && !EXTERIEURES.has(id)) warn('« ' + RES[id].nom + ' » ne sert à rien.');
}

console.log('\n=== 1 bis. Trouvailles et périls ===');
for (const m in BUTINS) {
  if (!ctx.window.METIERS[m]) err('table de butin : métier inconnu ' + m);
  for (const t of BUTINS[m]) {
    if (!RES[t.res]) err('trouvaille de ' + m + ' : ressource inconnue ' + t.res);
    if (!(t.p > 0 && t.p < 1)) err('trouvaille ' + t.res + ' (' + m + ') : probabilité hors bornes');
  }
}
for (const m in ctx.window.METIERS) if (!BUTINS[m]) warn('métier « ' + m + ' » sans table de trouvailles.');
for (const b of (ctx.window.PERILS || [])) {
  if (b.garde && !RES[b.garde]) err('péril ' + b.id + ' : garde inconnue ' + b.garde);
  if (b.garde && !produitePar[b.garde]) err('péril ' + b.id + ' : la garde ' + b.garde + ' ne se fabrique nulle part');
}
for (const g of (PU.GARDIENS || []))
  for (const k in g.butin) if (!RES[k]) err('gardien ' + g.nom + ' : butin inconnu ' + k);

console.log('\n=== 2. Recettes : entrées connues, sorties connues ===');
for (const id in REC) {
  const r = REC[id];
  if (!BAT[r.bat]) err('recette ' + id + ' : bâtiment inconnu ' + r.bat);
  else if ((BAT[r.bat].recettes || []).indexOf(id) < 0) err('recette ' + id + ' : non listée dans ' + r.bat);
  if (!r.metier || !ctx.window.METIERS[r.metier]) err('recette ' + id + ' : métier inconnu (' + r.metier + ')');
  if (!r.nom) err('recette ' + id + ' : sans nom');
  if (!r.desc) warn('recette ' + id + ' : sans description');
  for (const k in r.in) if (!RES[k]) err('recette ' + id + ' : entrée inconnue ' + k);
  for (const k in r.out) if (!RES[k]) err('recette ' + id + ' : sortie inconnue ' + k);
  for (const l of r.loot) if (!RES[l.res]) err('recette ' + id + ' : butin inconnu ' + l.res);
  if (r.niv > (BAT[r.bat] ? BAT[r.bat].nivMax : 10))
    err('recette ' + id + ' : niveau ' + r.niv + ' au-dessus du maximum du bâtiment');
}
for (const bid in BAT) {
  for (const rid of (BAT[bid].recettes || [])) if (!REC[rid]) err('bâtiment ' + bid + ' : recette absente ' + rid);
  for (const k in (BAT[bid].cout || {})) if (!RES[k]) err('bâtiment ' + bid + ' : coût en ressource inconnue ' + k);
  if (BAT[bid].deblocage === undefined) warn('bâtiment ' + bid + ' : aucun déblocage déclaré (invisible au carnet)');
  const nbPostes = Math.max.apply(null, BAT[bid].postes);
  if (nbPostes > 0 && !(BAT[bid].recettes || []).length) err('bâtiment ' + bid + ' : des postes, mais aucune tâche');
  if (nbPostes === 0 && (BAT[bid].recettes || []).length) err('bâtiment ' + bid + ' : des tâches, mais aucun poste');
}

console.log('\n=== 3. Progression : le bourg peut-il tout atteindre ? ===');
/* Simulation gloutonne : on part avec rien, et l'on ouvre tout ce qui
   devient accessible. Si la boucle se bloque avant la fin, c'est qu'une
   dépendance est circulaire. */
const bati = {};               // type -> niveau atteint
const dispo = new Set();       // ressources qu'on sait obtenir
let tour = 0, ouverts = [];
function deblocageOk(t) {
  const d = BAT[t].deblocage;
  if (d === undefined) return false;
  if (d === null) return true;
  if (d.bat) for (const b in d.bat) if ((bati[b] || 0) < d.bat[b]) return false;
  if (d.res) for (const r in d.res) if (!dispo.has(r)) return false;
  return true;
}
function coutOk(t, niv) {
  const c = UTIL.coutNiveau(t, niv);
  for (const k in c) if (!dispo.has(k)) return false;
  return true;
}
/* Ouvrir une recette, c'est rendre disponible ce qu'elle produit, ce
   qu'elle peut faire tomber, ET les trouvailles de son métier : une
   perle ne se fabrique pas, elle se pêche. */
function ouvrir(rid) {
  const r = REC[rid];
  for (const k in r.out) dispo.add(k);
  for (const l of r.loot) dispo.add(l.res);
  for (const t of (BUTINS[r.metier] || [])) dispo.add(t.res);
}
while (tour++ < 60) {
  let bouge = false;
  for (const t in BAT) {
    if (!deblocageOk(t)) continue;
    const niv = bati[t] || 0;
    if (niv === 0) {
      if (!coutOk(t, 1)) continue;
      bati[t] = 1; bouge = true; ouverts.push(t);
      for (const rid of UTIL.recettesDe(t, 1)) ouvrir(rid);
    } else if (niv < (BAT[t].nivMax || 10)) {
      /* on ne monte un niveau que s'il ouvre quelque chose de neuf */
      const avant = UTIL.recettesDe(t, niv).length;
      const apres = UTIL.recettesDe(t, niv + 1).length;
      if (apres > avant || (BAT[t].deblocage && true)) {
        if (!coutOk(t, niv + 1)) continue;
        bati[t] = niv + 1; bouge = true;
        for (const rid of UTIL.recettesDe(t, niv + 1)) ouvrir(rid);
      }
    }
  }
  if (!bouge) break;
}
const jamais = Object.keys(BAT).filter(t => !bati[t]);
if (jamais.length) err('bâtiments jamais atteignables : ' + jamais.join(', '));
else console.log('  tous les bâtiments sont atteignables (' + tour + ' passes)');

/* les gardiens de la tour rendent ce qu'aucun métier ne rend */
for (const g of (PU.GARDIENS || [])) for (const k in g.butin) dispo.add(k);
const resJamais = ORDRE.filter(id => !dispo.has(id) && !EXTERIEURES.has(id));
if (resJamais.length) err('ressources jamais obtenues : ' + resJamais.join(', '));
else console.log('  toutes les ressources du bourg sont obtenables');

console.log('\n=== 4. Ordre d\'ouverture ===');
console.log('  ' + ouverts.slice(0, 14).join(' → '));
console.log('  … puis ' + ouverts.slice(14).join(', '));

console.log('\n=== 5. Chiffres ===');
console.log('  ' + Object.keys(RES).length + ' ressources · ' + Object.keys(BAT).length +
            ' bâtiments · ' + Object.keys(REC).length + ' recettes');
const parCat = {};
for (const id in RES) parCat[RES[id].cat] = (parCat[RES[id].cat] || 0) + 1;
console.log('  par catégorie : ' + Object.keys(parCat).map(c => c + ' ' + parCat[c]).join(', '));

console.log('\n' + (fautes ? fautes + ' FAUTE(S)' : 'aucune faute') + ' · ' + alertes + ' alerte(s)\n');
process.exit(fautes ? 1 : 0);
