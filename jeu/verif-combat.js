/* Vérification autonome des données reprises de l'ancienne version. */
"use strict";
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const racine = path.resolve(__dirname, '..');
const monde = { console, Math, Date, JSON, setTimeout, clearTimeout };
monde.window = monde;
vm.createContext(monde);
function charge(p) {
  vm.runInContext(fs.readFileSync(path.join(racine, p), 'utf8'), monde, { filename:p });
}
function exige(ok, message) { if (!ok) throw new Error(message); }

charge('jeu/donnees/gd-core.js');
charge('unites/data-units.js');
charge('unites/data-forge.js');
charge('jeu/donnees/gd-talents-riches.js');
charge('aventure/data-general.js');
charge('jeu/donnees/gd-sorts-riches.js');

const GD = monde.GameData;
exige(GD.UNIT_ORDER.length >= 26, 'les unités de l’ancienne version ne sont pas toutes chargées');
exige(Object.keys(GD.UNIT_POWERS).length >= 20, 'les techniques d’unité manquent');
exige(GD.SPELLS.length >= 20, 'les anciens sorts ne sont pas tous chargés');
exige(Object.keys(GD.TALENT_TREES).length === 9, 'les neuf classes de talents sont attendues');
for (const cls in GD.TALENT_TREES) {
  exige(GD.TALENT_TREES[cls].branches.length === 5, cls + ' doit avoir cinq branches');
  exige(GD.talentSpecs(cls).length === 2, cls + ' doit avoir deux voies');
}

monde.Etat = { E:{ armee:{ unites:4, xp:0, palierArme:0, palierArmure:0, garnison:0 } } };
charge('jeu/js/armee.js');
exige(monde.Armee.nombreColonne() === 4, 'la migration du compteur vers les lanciers a perdu des unités');
monde.Armee.ajouter('fronde', 2);
exige(monde.Etat.E.armee.types.fronde === 2, 'la formation typée ne rejoint pas l’armée');
exige(monde.Armee.stats('fronde').power, 'une unité rang 3 doit recevoir sa première technique');
exige(monde.Armee.puissance() > 0, 'la puissance de colonne doit être calculable');

console.log('combat vérifié · ' + GD.UNIT_ORDER.length + ' unités · ' +
  Object.values(GD.UNIT_POWERS).reduce((n,l) => n + l.length, 0) + ' techniques · ' +
  GD.SPELLS.length + ' sorts · 9 arbres complets');
