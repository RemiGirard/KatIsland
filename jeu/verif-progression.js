/* ============================================================
   LE BOURG — jeu/verif-progression.js
   L'INSTRUMENT DE MESURE DE L'ÉQUILIBRE.

       node jeu/verif-progression.js            le rapport complet
       node jeu/verif-progression.js res        les ressources seules
       node jeu/verif-progression.js ordre      l'ordre d'ouverture seul

   `verif.js` répond à « est-ce cohérent ? ». Celui-ci répond à
   « est-ce BIEN RÉGLÉ ? » — ce qui n'est pas la même question, et ne
   se voit pas en lisant les tables.

   Il simule une partie par VAGUES. À chaque vague, le bourg bâtit tout
   ce qu'il peut et ouvre toutes les recettes accessibles ; la vague
   suivante repart de là. Le numéro de vague est donc une mesure de
   PROFONDEUR : combien de paliers le joueur doit franchir avant
   d'atteindre telle chose.

   Ce qu'il cherche :
     · un bâtiment qui arrive trop tard pour ce qu'il apporte ;
     · une ressource qui ne sert qu'à une seule chose — un cul-de-sac ;
     · une ressource produite bien après le premier ouvrage qui la
       réclame — le joueur voit la recette et ne peut rien en faire ;
     · un palier annoncé qui ne correspond pas à la profondeur réelle.
   ============================================================ */
"use strict";
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['donnees/ressources.js', 'donnees/batiments.js',
                 'donnees/butins.js', 'donnees/raffinages.js',
                 'donnees/ameliorations.js', 'donnees/objectifs.js']) {
  const q = path.join(__dirname, f);
  if (!fs.existsSync(q)) continue;
  try { vm.runInContext(fs.readFileSync(q, 'utf8'), ctx, { filename: f }); }
  catch (e) { console.log('  (' + f + ' non chargé : ' + e.message + ')'); }
}
const RES = ctx.window.RES, BAT = ctx.window.BAT, REC = ctx.window.REC;
const CAT = ctx.window.CAT_RES, RAFF = ctx.window.RAFFINAGES || [];
const filtre = (process.argv[2] || '').toLowerCase();

const pad = (s, n) => String(s).padEnd(n);
const padg = (s, n) => String(s).padStart(n);

/* =================================================================
   1. LA SIMULATION PAR VAGUES
   ================================================================= */
const batVague = {};        // bâtiment -> vague où il devient bâtissable
const resVague = {};        // ressource -> vague où elle devient obtenable
const recVague = {};        // recette   -> vague où elle devient exécutable
const resSure = {};         // ressource -> vague où on peut la PRODUIRE (hors trouvaille)

const bats = new Set();
const ress = new Set();

/* Une recette tourne si toutes ses entrées sont là. Une annexe est
   réputée bâtie dès que son bâtiment l'est : rien n'empêche le joueur
   de la payer, c'est une question de temps, pas de déblocage. */
function recetteOuvrable(rid) {
  const r = REC[rid];
  if (!r || !bats.has(r.bat)) return false;
  for (const k in (r.in || {})) if (!ress.has(k)) return false;
  return true;
}
function batOuvrable(bid) {
  const d = BAT[bid].deblocage;
  if (d === null || d === undefined) return true;
  for (const k in (d.bat || {})) if (!bats.has(k)) return false;
  for (const k in (d.res || {})) if (!ress.has(k)) return false;
  for (const k in (BAT[bid].cout || {})) if (!ress.has(k)) return false;
  return true;
}

let vague = 0;
for (let garde = 0; garde < 60; garde++) {
  vague++;
  let bouge = false;
  for (const bid in BAT) {
    if (bats.has(bid) || !batOuvrable(bid)) continue;
    bats.add(bid); batVague[bid] = vague; bouge = true;
  }
  for (const rid in REC) {
    if (recVague[rid] != null || !recetteOuvrable(rid)) continue;
    recVague[rid] = vague; bouge = true;
    /* `resSure` se note SANS le garde-fou de `ress` : sinon une
       trouvaille arrivée à la même vague prend la place, la branche
       `out` est sautée, et l'argile passe pour un coup de chance alors
       que la carrière en tire à la pelle. */
    for (const k in (REC[rid].out || {})) {
      if (resSure[k] == null) resSure[k] = vague;
      if (!ress.has(k)) { ress.add(k); resVague[k] = vague; }
    }
    /* UNE TROUVAILLE N'EST PAS UNE PRODUCTION. Une gemme qui tombe une
       fois sur cent vingt coups de filet ne rend pas la gemme
       « disponible » : elle la rend possible. On la compte pour
       l'atteignabilité, mais on retient à part la vague où le bourg
       peut vraiment en FAIRE. */
    for (const l of (REC[rid].loot || []))
      if (!ress.has(l.res)) { ress.add(l.res); resVague[l.res] = vague; }
  }
  if (!bouge) break;
}
const VAGUE_MAX = vague;

/* =================================================================
   2. L'UTILITÉ D'UNE RESSOURCE
   Combien de choses la réclament : recettes, coûts de bâtiment,
   coûts d'annexe. Une ressource utile à un seul endroit est un
   cul-de-sac — on la produit et on ne sait qu'en faire, ou bien
   elle bloque une chaîne unique.
   ================================================================= */
const emplois = {};        // ressource -> [ce qui la consomme]
const manquentAuRepas = [];
function noter(res, quoi) { (emplois[res] = emplois[res] || []).push(quoi); }
for (const rid in REC)
  for (const k in (REC[rid].in || {})) noter(k, 'recette ' + rid);
for (const bid in BAT)
  for (const k in (BAT[bid].cout || {})) noter(k, 'bâtir ' + bid);
for (const r of RAFF)
  for (const k in r.cout) noter(k, 'annexe ' + r.bat + '/' + r.id);

/* LES AUTRES BOUCHES. Une ressource ne sert pas qu'aux recettes : les
   établis d'atelier, les recherches du bourg, les contremaîtres et les
   objectifs en dévorent — et c'est justement là que finissent les
   matières tardives, celles qu'aucune recette ne reprend. Les compter
   change tout le diagnostic. */
function moissonner(source, etiquette) {
  if (!source) return;
  const liste = Array.isArray(source) ? source : Object.values(source);
  for (const x of liste) {
    if (!x) continue;
    for (const champ of ['cout', 'prix', 'recompense']) {
      const c = x[champ];
      if (c && typeof c === 'object')
        for (const k in c) if (RES[k]) noter(k, etiquette + ' ' + (x.id || x.nom || '?'));
    }
    /* les améliorations d'atelier ont un coût qui dépend du rang */
    if (typeof x.cout === 'function') {
      try { const c = x.cout(1); for (const k in c) if (RES[k]) noter(k, etiquette + ' ' + x.id); }
      catch (e) { }
    }
  }
}
moissonner(ctx.window.AMELIO, 'établi');
moissonner(ctx.window.RECHERCHES, 'recherche');
moissonner(ctx.window.OBJECTIFS, 'objectif');
/* les contremaîtres vivent dans auto.js, hors données : on les inscrit
   à la main plutôt que d'exécuter un module qui touche au DOM */
for (const [k, q] of [['ecu', 'contremaître'], ['plan', 'contremaître']]) noter(k, q);

/* L'ÉQUIPEMENT DE LA COMPAGNIE. Armes, harnois, écus et gardes ne
   passent par aucune recette : ils s'usent en expédition et dans la
   descente. C'est leur emploi, et le plus important de tous. */
for (const k of ['arme', 'armure', 'bouclier', 'gardefeu', 'gardevenin',
                 'gardegel', 'gardefoudre', 'gardeombre', 'potion', 'outilacier', 'outil'])
  if (RES[k]) noter(k, 'équipement / usure');
/* LES VIVRES SE MANGENT : c'est un emploi, et il ne figure dans aucune
   recette. On LIT la vraie table de `moteur.js` plutôt que d'en tenir
   une copie ici — une liste recopiée se démode au premier vivre ajouté,
   et l'instrument se met alors à mentir sans qu'on le sache. */
{
  const src = fs.readFileSync(path.join(__dirname, 'js', 'moteur.js'), 'utf8');
  const m = src.match(/const PORTIONS = \{([\s\S]*?)\}/);
  const mangeables = m ? (m[1].match(/(\w+)\s*:/g) || []).map(x => x.replace(/\s*:$/, '')) : [];
  for (const k of mangeables) if (RES[k]) noter(k, 'nourrir le bourg');
  /* et l'inverse : un vivre absent de la table ne se mange PAS. */
  for (const k in RES)
    if (RES[k].cat === 'vivres' && mangeables.indexOf(k) < 0)
      manquentAuRepas.push(RES[k].nom);
}

const producteurs = {};
for (const rid in REC) {
  for (const k in (REC[rid].out || {})) (producteurs[k] = producteurs[k] || []).push(rid);
  for (const l of (REC[rid].loot || [])) (producteurs[l.res] = producteurs[l.res] || []).push(rid + '*');
}

/* =================================================================
   3. LE RAPPORT
   ================================================================= */
let fautes = 0, alertes = 0;
const err = m => { fautes++; console.log('  FAUTE   ' + m); };
const warn = m => { alertes++; console.log('  alerte  ' + m); };

if (!filtre || filtre === 'ordre') {
  console.log('\n=== A. PROFONDEUR D\'OUVERTURE ===');
  console.log('    (vague = combien de paliers avant d\'y accéder)\n');
  const parVague = {};
  for (const b in batVague) (parVague[batVague[b]] = parVague[batVague[b]] || []).push(b);
  for (let v = 1; v <= VAGUE_MAX; v++) {
    if (!parVague[v]) continue;
    console.log('  vague ' + padg(v, 2) + ' │ ' + parVague[v].map(b => BAT[b].nom).join(', '));
  }
  const jamais = Object.keys(BAT).filter(b => batVague[b] == null);
  if (jamais.length) err('bâtiments inatteignables : ' + jamais.join(', '));

  /* LES DEUX PORTES DE L'AVENTURE. Elles doivent s'ouvrir tôt : c'est
     par elles qu'arrive tout ce que le village ne produit pas. */
  console.log('\n  --- les portes ---');
  for (const p of ['descente', 'portail', 'entrainement', 'caserne']) {
    const v = batVague[p];
    console.log('  ' + pad(BAT[p].nom, 24) + 'vague ' + padg(v == null ? '—' : v, 2) +
                '   ' + (v == null ? '' : '(' + Math.round(v / VAGUE_MAX * 100) + ' % de la profondeur)'));
    if (v != null && v > Math.ceil(VAGUE_MAX * 0.45))
      warn(BAT[p].nom + ' n\'ouvre qu\'à la vague ' + v + ' / ' + VAGUE_MAX +
           ' : trop tard pour une porte d\'aventure.');
  }
}

if (!filtre || filtre === 'res') {
  console.log('\n=== B. UTILITÉ DES RESSOURCES ===');
  console.log('    emplois = recettes + coûts de bâtiment + coûts d\'annexe\n');
  const lignes = Object.keys(RES).map(id => ({
    id, nom: RES[id].nom, tier: RES[id].tier,
    v: resVague[id], n: (emplois[id] || []).length,
    p: (producteurs[id] || []).length,
  }));

  if (manquentAuRepas.length) {
    console.log('  --- vivres qui ne se mangent pas (' + manquentAuRepas.length + ') ---');
    for (const n of manquentAuRepas)
      err(n + " est un vivre absent de la table des portions : il s'entasse sans nourrir.");
  }

  /* LES CULS-DE-SAC : produites, et réclamées nulle part ou presque. */
  const morts = lignes.filter(l => l.n === 0 && l.p > 0);
  const maigres = lignes.filter(l => l.n === 1 && l.p > 0);
  if (morts.length) {
    console.log('  --- AUCUN EMPLOI (' + morts.length + ') ---');
    for (const l of morts) err(l.nom + ' se produit et ne sert à RIEN.');
  }
  if (maigres.length) {
    console.log('  --- un seul emploi (' + maigres.length + ') ---');
    for (const l of maigres)
      warn(pad(l.nom, 22) + '→ ' + emplois[l.id][0]);
  }

  /* LE DÉCALAGE : un ouvrage réclame une matière qui n'arrivera que
     bien plus tard. Le joueur lit la recette et ne peut rien en faire. */
  console.log('\n  --- matière en retard sur ce qui la réclame ---');
  let retards = 0;
  for (const rid in REC) {
    const vr = recVague[rid];
    if (vr == null) continue;
    for (const k in (REC[rid].in || {})) {
      const vk = resVague[k];
      if (vk != null && vk > vr) {
        retards++;
        err('recette ' + rid + ' (vague ' + vr + ') réclame ' + RES[k].nom +
            ' qui n\'arrive qu\'à la vague ' + vk);
      }
    }
  }
  if (!retards) console.log('  aucun : tout ce qu\'une recette réclame existe déjà quand elle s\'ouvre.');

  /* LE PALIER ANNONCÉ contre la PROFONDEUR RÉELLE. Le palier sert au
     classement dans l'inventaire et au prix : s'il ment, le joueur
     range mal sa tête. */
  console.log('\n  --- palier annoncé / profondeur réelle ---');
  const echelle = {};
  for (const l of lignes) if (l.v != null) (echelle[l.tier] = echelle[l.tier] || []).push(l.v);
  for (const t of Object.keys(echelle).sort()) {
    const a = echelle[t];
    const moy = a.reduce((s, x) => s + x, 0) / a.length;
    console.log('  palier ' + t + ' │ ' + padg(a.length, 3) + ' ressources │ ' +
                'vague ' + padg(Math.min(...a), 2) + '–' + padg(Math.max(...a), 2) +
                ' │ moyenne ' + moy.toFixed(1));
  }
  const desordre = lignes.filter(l => resSure[l.id] != null)
    .filter(l => {
      const t = l.tier, v = resSure[l.id];
      /* un palier 0 qui n'arrive qu'après la moitié du jeu, ou un
         palier 3 qu'on produit d'entrée : l'étiquette ment. On juge sur
         la production SÛRE — une trouvaille rare ne compte pas. */
      return (t === 0 && v > VAGUE_MAX * 0.5) || (t >= 3 && v < VAGUE_MAX * 0.3);
    });
  for (const l of desordre)
    warn(pad(l.nom, 22) + 'palier ' + l.tier + ' mais produit dès la vague ' +
         resSure[l.id] + ' / ' + VAGUE_MAX);

  /* CE QUI NE S'OBTIENT QUE PAR HASARD. Ce n'est pas une faute — c'est
     même le sel des trouvailles — mais il faut le savoir : ces
     matières ne se planifient pas, elles s'attendent. */
  const hasard = lignes.filter(l => l.v != null && resSure[l.id] == null);
  if (hasard.length) {
    console.log('\n  --- obtenues UNIQUEMENT au hasard (' + hasard.length + ') ---');
    console.log('  ' + hasard.map(l => l.nom).join(', '));
  }

  console.log('\n  --- les dix plus employées ---');
  for (const l of lignes.slice().sort((a, b) => b.n - a.n).slice(0, 10))
    console.log('  ' + pad(l.nom, 22) + padg(l.n, 3) + ' emplois │ vague ' + padg(l.v == null ? '—' : l.v, 2));
}

console.log('\n' + (fautes ? fautes + ' FAUTE(S)' : 'aucune faute') +
            ' · ' + alertes + ' alerte(s)   [profondeur totale : ' + VAGUE_MAX + ' vagues]\n');
