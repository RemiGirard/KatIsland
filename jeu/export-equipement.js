/* Exporte les sprites canvas historiques en planches PNG 4 x 4.
   Usage : node jeu/export-equipement.js */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const RACINE = path.resolve(__dirname, '..');
const SORTIE = path.join(RACINE, 'img', 'planches', 'equipement');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };

function serveur() {
  return http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const cible = path.resolve(RACINE, rel);
    if (cible !== RACINE && !cible.startsWith(RACINE + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(cible, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(cible).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

(async function () {
  fs.mkdirSync(SORTIE, { recursive: true });
  const srv = serveur();
  await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve));
  const port = srv.address().port;
  const chromeLocal = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const navigateur = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromeLocal) ? chromeLocal : undefined,
  });
  const page = await navigateur.newPage();
  await page.exposeFunction('enregistrerPlanche', (nom, dataUrl) => {
    const data = Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(SORTIE, nom), data);
  });
  await page.goto('http://127.0.0.1:' + port + '/jeu/export-equipement.html');
  await page.waitForFunction(() => window.__EXPORT_EQUIPEMENT_PRET === true);
  const resultat = await page.evaluate(async () => {
    const lignes = [
      { id:'melee-armes', getter:'getWeaponCanvas' },
      { id:'distance-armes', getter:'getRangedCanvas' },
      { id:'magie-armes', getter:'getStaffCanvas' },
      { id:'melee-armures', getter:'getArmorIcon' },
      { id:'distance-armures', getter:'getVestIcon' },
      { id:'magie-armures', getter:'getRobeIcon' },
    ];
    const tailles = [];
    for (const ligne of lignes) {
      for (let planche = 0; planche < 3; planche++) {
        const cv = document.createElement('canvas');
        cv.width = 1280; cv.height = 1280;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = true;
        for (let caseId = 0; caseId < 16; caseId++) {
          const tier = planche * 16 + caseId;
          if (tier >= 40) continue;
          const fn = window[ligne.getter];
          const sprite = ligne.id.endsWith('armures')
            ? fn(tier, 'cats', 220)
            : fn(tier, 250, tier * 0.17);
          const col = caseId % 4, row = Math.floor(caseId / 4), cell = 320;
          const max = 272;
          const echelle = Math.min(max / sprite.width, max / sprite.height, 1.45);
          const w = sprite.width * echelle, h = sprite.height * echelle;
          const x = col * cell + (cell - w) / 2, y = row * cell + (cell - h) / 2;
          g.drawImage(sprite, x, y, w, h);
        }
        const nom = ligne.id + '-' + String(planche + 1).padStart(2, '0') + '.png';
        await window.enregistrerPlanche(nom, cv.toDataURL('image/png'));
        tailles.push(nom);
      }
    }
    return tailles;
  });
  await navigateur.close();
  await new Promise(resolve => srv.close(resolve));
  console.log(resultat.length + ' planches exportées dans ' + SORTIE);
})().catch(err => { console.error(err); process.exitCode = 1; });
