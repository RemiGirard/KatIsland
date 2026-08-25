/* Noms projetés au-dessus des bâtiments : Alt, permanent ou masqué. */
"use strict";
(function () {
  const couche = document.createElement('div');
  couche.id = 'noms-batiments';
  document.body.appendChild(couche);
  const noeuds = new Map();
  let mode = 'alt', alt = false, dernier = 0;

  function visible() { return mode === 'toujours' || (mode === 'alt' && alt); }
  function texteDe(b) {
    const type = b.pour || b.type, d = window.BAT && window.BAT[type];
    return d ? d.nom : type;
  }
  function maj(t) {
    requestAnimationFrame(maj);
    if (t - dernier < 70) return;
    dernier = t;
    const oui = visible();
    couche.classList.toggle('visible', oui);
    if (!oui || !window.Village || !window.Village.batiments) return;
    const gardes = new Set();
    for (const b of window.Village.batiments()) {
      if (!b || b.pour) continue;
      const p = window.Village.ecran(b.id); if (!p) continue;
      gardes.add(b.id);
      let n = noeuds.get(b.id);
      if (!n) {
        n = document.createElement('div'); n.className = 'nom-batiment';
        couche.appendChild(n); noeuds.set(b.id,n);
      }
      const etat = window.Etat && window.Etat.E.bat[b.id];
      n.textContent = texteDe(b) + (etat && etat.niv > 1 ? '  ·  ' + etat.niv : '');
      n.classList.toggle('endommage',!!(etat && etat.endommage > 0));
      n.style.transform = 'translate(' + Math.round(p.cx) + 'px,' + Math.round(p.y - 12) + 'px) translate(-50%,-100%)';
    }
    for (const [id,n] of noeuds) if (!gardes.has(id)) { n.remove(); noeuds.delete(id); }
  }
  addEventListener('keydown',e => { if (e.key === 'Alt') { alt=true; couche.classList.toggle('visible',visible()); } });
  addEventListener('keyup',e => { if (e.key === 'Alt') { alt=false; couche.classList.toggle('visible',visible()); } });
  addEventListener('blur',() => { alt=false; couche.classList.toggle('visible',visible()); });
  window.NomsBatiments = { config:m => { mode=m || 'alt'; couche.classList.toggle('visible',visible()); }, get mode(){return mode;} };
  requestAnimationFrame(maj);
})();
