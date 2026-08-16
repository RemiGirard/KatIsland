/* ============================================================
   LE BOURG — jeu/dev-capture.js   (OUTIL DE DÉVELOPPEMENT)
   Il n'est PAS chargé par le jeu. On l'injecte à la main dans la
   console pour photographier un morceau d'interface : le DOM est
   sérialisé dans un SVG `foreignObject`, la feuille de style et la
   police y sont recopiées, puis l'image est envoyée au serveur.

   C'est le seul moyen de RELIRE une mise en page quand on ne voit pas
   l'écran — et relire une mise en page est la moitié du travail.
   ============================================================ */
(function () {
  "use strict";

  let cssCache = null, policeCache = null;

  async function css() {
    if (cssCache) return cssCache;
    let t = await (await fetch('/jeu/css/style.css')).text();
    // la police vit dans un fichier : on l'embarque en base64, sinon
    // l'image SVG la réclamerait au réseau et échouerait en silence.
    if (!policeCache) {
      try {
        const b = await (await fetch('/style/copie_alice_is_missing/www.aliceismissing.com/fonts/DIN-Condensed-Bold.ttf')).arrayBuffer();
        let bin = ''; const u = new Uint8Array(b);
        for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
        policeCache = 'data:font/ttf;base64,' + btoa(bin);
      } catch (e) { policeCache = ''; }
    }
    if (policeCache) t = t.replace(/url\('[^']*DIN-Condensed-Bold\.ttf'\)/, "url('" + policeCache + "')");
    cssCache = t;
    return t;
  }

  /* Recopie les canvas du sous-arbre en <img> : un canvas cloné est
     vide, et ce sont justement nos icônes. */
  function figerCanvas(source, clone) {
    const src = source.querySelectorAll('canvas');
    const dst = clone.querySelectorAll('canvas');
    for (let i = 0; i < src.length; i++) {
      const im = document.createElement('img');
      try { im.setAttribute('src', src[i].toDataURL()); } catch (e) { continue; }
      const st = getComputedStyle(src[i]);
      im.setAttribute('style', 'width:' + st.width + ';height:' + st.height + ';display:block;image-rendering:pixelated');
      if (dst[i] && dst[i].parentNode) dst[i].parentNode.replaceChild(im, dst[i]);
    }
  }

  async function capturer(selecteur, nom, opts) {
    opts = opts || {};
    const noeuds = typeof selecteur === 'string'
      ? Array.from(document.querySelectorAll(selecteur)) : [selecteur];
    if (!noeuds.length) return 'rien à capturer : ' + selecteur;

    const marge = opts.marge == null ? 18 : opts.marge;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const n of noeuds) {
      const r = n.getBoundingClientRect();
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    const W = Math.ceil(x1 - x0) + marge * 2, H = Math.ceil(y1 - y0) + marge * 2;
    const feuille = await css();

    let corps = '';
    for (const n of noeuds) {
      const r = n.getBoundingClientRect();
      const c = n.cloneNode(true);
      figerCanvas(n, c);
      c.style.position = 'absolute';
      c.style.left = Math.round(r.left - x0 + marge) + 'px';
      c.style.top = Math.round(r.top - y0 + marge) + 'px';
      c.style.width = Math.round(r.width) + 'px';
      c.style.margin = '0';
      c.style.transform = 'none';
      c.style.maxHeight = 'none';
      c.style.opacity = '1';
      corps += new XMLSerializer().serializeToString(c);
    }

    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
      '<foreignObject width="100%" height="100%">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:' + W + 'px;height:' + H + 'px">' +
      '<style>' + feuille.replace(/<\/style/g, '<\\/style') + '</style>' +
      corps + '</div></foreignObject></svg>';

    const img = new Image();
    const pret = new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('SVG illisible')); });
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await pret;

    const cv = document.createElement('canvas');
    const ech = opts.echelle || 2;
    cv.width = W * ech; cv.height = H * ech;
    const g = cv.getContext('2d');
    g.fillStyle = opts.fond || '#0b0910';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    const r = await fetch('/capture?nom=' + (nom || 'ui'), { method: 'POST', body: cv.toDataURL('image/png') });
    return (await r.text()) + ' (' + W + '×' + H + ')';
  }

  window.__capturerUI = capturer;
  return 'outil de capture prêt';
})();
