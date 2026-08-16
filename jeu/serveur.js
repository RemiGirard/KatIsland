/* Petit serveur statique de développement : aucun dépendance, aucun cache.
   node jeu/serveur.js  ->  http://localhost:8099 */
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const RACINE = path.resolve(__dirname, '..');
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.md':'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  /* POST /capture : la page envoie une image encodée en base64, on
     l'écrit sur le disque. Sert uniquement au développement — c'est le
     seul moyen de REGARDER le rendu quand on ne voit pas l'écran. */
  if (req.method === 'POST' && req.url.startsWith('/capture')) {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 40e6) req.destroy(); });
    req.on('end', () => {
      const nom = (url.parse(req.url, true).query.nom || 'capture').replace(/[^\w-]/g, '');
      const d = b.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(__dirname, nom + '.png'), Buffer.from(d, 'base64'));
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok ' + nom);
    });
    return;
  }
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(RACINE, p);
  if (!f.startsWith(RACINE)) { res.writeHead(403); return res.end('non'); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('404 ' + p); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(8099, () => console.log('Le Bourg : http://localhost:8099'));
