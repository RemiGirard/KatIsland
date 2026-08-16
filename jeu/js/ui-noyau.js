/* ============================================================
   LE BOURG — js/ui-noyau.js
   La quincaillerie de l'interface : fabrique d'éléments, formats,
   puces de ressource, barres, messages, et le GESTIONNAIRE DE
   FENÊTRES FLOTTANTES — le seul « menu » du jeu.

   Une fenêtre : un titre, des onglets, un corps qu'on redessine
   cinq fois par seconde tant qu'elle est ouverte. Elle se déplace à
   la souris, se souvient d'où on l'a mise, et se referme à Échap.
   -> window.UI
   ============================================================ */
"use strict";
(function () {

  /* ---------------- fabrique d'éléments ----------------
     Les gestionnaires ne sont PAS posés directement : on installe un
     répartiteur stable qui va chercher la fonction du moment dans
     `n.__ev`. La réconciliation peut alors greffer les gestionnaires
     frais sur un nœud conservé, sans jamais empiler d'écouteurs ni
     laisser une vieille fermeture agir sur un état périmé. */
  function brancher(n, type, fn) {
    if (!n.__ev) {
      n.__ev = {};
      n.__rep = {};
    }
    n.__ev[type] = fn;
    if (!n.__rep[type]) {
      n.__rep[type] = ev => { const h = n.__ev && n.__ev[type]; if (h) h.call(n, ev); };
      n.addEventListener(type, n.__rep[type]);
    }
  }
  function el(tag, attrs) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'style') n.setAttribute('style', attrs[k]);
      else if (k.slice(0, 2) === 'on') brancher(n, k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) { for (const x of c) if (x != null && x !== false) n.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); }
      else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  const vide = n => { while (n.firstChild) n.removeChild(n.firstChild); return n; };

  /* =================================================================
     RÉCONCILIATION — pourquoi tout clignotait

     L'interface se redessine cinq fois par seconde. Tant qu'on vidait
     le corps d'une fenêtre pour le rebâtir, chaque rafraîchissement
     DÉTRUISAIT le bouton sous le curseur : le survol retombait, la
     barre de chargement repartait de zéro, un menu déroulant ouvert se
     refermait. D'où le scintillement permanent.

     On fabrique donc l'affichage voulu dans un arbre détaché, puis on
     le FOND dans l'arbre en place : on ne touche qu'aux textes, aux
     attributs et aux nœuds qui ont réellement changé. Les nœuds
     survivent, et avec eux le survol, le focus, le défilement et les
     transitions CSS — qui se mettent enfin à glisser au lieu de sauter.
     ================================================================= */
  const CHAMPS = { INPUT: 1, SELECT: 1, TEXTAREA: 1 };

  function memeGenre(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType === 3) return true;
    if (a.nodeName !== b.nodeName) return false;
    const ca = a.getAttribute && a.getAttribute('data-cle');
    const cb = b.getAttribute && b.getAttribute('data-cle');
    if (ca != null || cb != null) return ca === cb;
    return true;
  }

  function morphe(vieux, neuf) {
    if (vieux.nodeType === 3) {
      if (vieux.nodeValue !== neuf.nodeValue) vieux.nodeValue = neuf.nodeValue;
      return;
    }
    if (vieux.nodeType !== 1) return;

    /* Le brouillon peut déclarer « celui-là n'a pas bougé » : on garde
       le nœud en place tel quel, sans même le parcourir. C'est ainsi
       qu'une liste de cinquante cartes ne coûte que les deux ou trois
       qui ont réellement changé. */
    if (neuf.hasAttribute('data-vif')) return;

    /* une icône ne se compare pas pixel par pixel : sa signature suffit.
       Une toile sans signature est un dessin vivant — on la laisse. */
    if (vieux.nodeName === 'IMG' || vieux.nodeName === 'CANVAS') {
      const sa = vieux.getAttribute('data-ico'), sb = neuf.getAttribute('data-ico');
      if (sa != null && sa !== sb) vieux.replaceWith(neuf);
      return;
    }

    const av = vieux.attributes;
    for (let i = av.length - 1; i >= 0; i--)
      if (!neuf.hasAttribute(av[i].name)) vieux.removeAttribute(av[i].name);
    const an = neuf.attributes;
    for (let i = 0; i < an.length; i++) {
      const nom = an[i].name, val = an[i].value;
      if (vieux.getAttribute(nom) !== val) vieux.setAttribute(nom, val);
    }

    /* les gestionnaires frais remplacent les anciens sans réabonnement */
    if (neuf.__ev) {
      if (!vieux.__ev) { vieux.__ev = {}; vieux.__rep = {}; }
      for (const t in neuf.__ev) brancher(vieux, t, neuf.__ev[t]);
      for (const t in vieux.__ev) if (!(t in neuf.__ev)) delete vieux.__ev[t];
    } else if (vieux.__ev) {
      for (const t in vieux.__ev) delete vieux.__ev[t];
    }

    /* enfants, dans l'ordre */
    let a = vieux.firstChild, b = neuf.firstChild;
    while (b) {
      const bs = b.nextSibling;
      if (!a) { vieux.appendChild(b); b = bs; continue; }
      if (memeGenre(a, b)) { const as = a.nextSibling; morphe(a, b); a = as; b = bs; }
      else { vieux.insertBefore(b, a); b = bs; }
    }
    while (a) { const as = a.nextSibling; vieux.removeChild(a); a = as; }

    /* un champ que le joueur est en train de remplir ne se réécrit pas
       sous ses doigts ; les autres suivent l'état du jeu. */
    if (CHAMPS[vieux.nodeName] && vieux !== document.activeElement) {
      if (vieux.type === 'checkbox' || vieux.type === 'radio') vieux.checked = neuf.checked;
      else if (vieux.value !== neuf.value) vieux.value = neuf.value;
    }
  }

  /* Rendre `fn` dans le conteneur `hote` sans le détruire. */
  function rendreDans(hote, fn) {
    const brouillon = hote.cloneNode(false);
    fn(brouillon);
    morphe(hote, brouillon);
    return hote;
  }

  /* ---------------- formats ---------------- */
  /* La notation suit le réglage du joueur : court, complet ou compact. */
  function fmt(n) {
    if (window.Reglages) return window.Reglages.formater(n);
    n = Math.floor(n || 0);
    return n < 1000 ? String(n) : (n / 1000).toFixed(1).replace('.', ',') + ' k';
  }
  function duree(s) {
    if (s == null || !isFinite(s)) return '—';
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + ' s';
    if (s < 3600) return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0');
    const h = Math.floor(s / 3600);
    if (h < 48) return h + ' h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    return Math.floor(h / 24) + ' j ' + (h % 24) + ' h';
  }
  function heure(f) {
    const t = (f % 1) * 24;
    return String(Math.floor(t)).padStart(2, '0') + ':' + String(Math.floor((t % 1) * 60)).padStart(2, '0');
  }

  /* ---------------- icônes ---------------- */
  function ico(spec, taille) {
    return window.Icones.image(spec, taille || 24);
  }
  function icoRes(id, taille) {
    const r = window.RES[id];
    return ico(r ? r.ico : { f: 'cube', c: ['#8a8272'] }, taille);
  }

  /* Une PUCE : icône + quantité + nom au survol. C'est l'unité de
     lecture de tout le jeu — coûts, gains, stocks, tables de butin. */
  function puce(id, n, opts) {
    opts = opts || {};
    const r = window.RES[id] || { nom: id, desc: '' };
    const cls = 'puce' + (opts.insuffisant ? ' insuffisant' : '') + (opts.gain ? ' gain' : '')
              + (opts.butin ? ' butin' : '') + (opts.mini ? ' mini' : '');
    const txt = opts.texte != null ? opts.texte : (n != null ? fmt(n) : '');
    const p = el('span', { class: cls, title: r.nom + (r.desc ? ' — ' + r.desc : '') },
      ico(r.ico || { f: 'cube', c: ['#8a8272'] }, 15),
      txt ? el('b', { text: txt }) : null);
    if (opts.avecNom) p.appendChild(el('span', { class: 'faible', text: ' ' + r.nom }));
    return p;
  }
  function listeRes(lot, opts) {
    opts = opts || {};
    const box = el('div', { class: 'liste-res' });
    let n = 0;
    for (const id in lot) {
      n++;
      box.appendChild(puce(id, lot[id], {
        insuffisant: opts.verifier && window.Etat.qte(id) < lot[id],
        gain: opts.gain,
      }));
    }
    if (!n) box.appendChild(el('span', { class: 'faible', text: opts.rien || '—' }));
    return box;
  }

  /* UNE BARRE PORTE SON PROPRE TEXTE. `gauche` et `droite` s'affichent
     dedans, en blanc ombré : on lit l'avancement et le reste sans avoir
     à chercher une légende ailleurs. Sans texte, la barre reste fine. */
  function barre(p, classe, gauche, droite) {
    const b = el('div', { class: 'barre' + (classe ? ' ' + classe : '') });
    const i = el('i');
    i.style.width = Math.max(0, Math.min(100, (p || 0) * 100)).toFixed(2) + '%';
    b.appendChild(i);
    if (gauche != null || droite != null) {
      b.appendChild(el('div', { class: 'dedans' },
        el('span', { class: 'g', text: gauche == null ? '' : String(gauche) }),
        el('span', { class: 'd', text: droite == null ? '' : String(droite) })));
    }
    return b;
  }
  /* Un intertitre de section : filet, libellé, filet. */
  function section(nom, droite) {
    return el('div', { class: 'section' },
      el('span', { text: nom }),
      el('div', { class: 'b' }),
      droite ? el('span', { text: droite }) : null);
  }
  /* Une grille de statistiques : intitulé petit, valeur grande. */
  function stats(paires) {
    const g = el('div', { class: 'stats' });
    for (const [k, v, cls] of paires)
      g.appendChild(el('div', {}, el('span', { class: 'k', text: k }),
        el('span', { class: 'v ' + (cls || ''), text: String(v) })));
    return g;
  }
  /* Une bascule oui / non. */
  function bascule(actif, surClic) {
    const b = el('div', { class: 'bascule' + (actif ? ' on' : ''), onclick: () => surClic(!actif) }, el('i'));
    return b;
  }
  /* Un interrupteur segmenté. */
  function segments(options, valeur, surChoix) {
    const s = el('div', { class: 'segments' });
    for (const o of options)
      s.appendChild(el('button', { class: o.v === valeur ? 'on' : '', text: o.n,
        title: o.t || '', onclick: () => surChoix(o.v) }));
    return s;
  }

  /* =================================================================
     MESSAGES VOLANTS
     ================================================================= */
  let boiteMsg = null;
  function dire(txt, genre, ms) {
    /* Le joueur décide du bruit : tout, l'essentiel, ou rien. */
    const mode = window.Reglages ? window.Reglages.lire('messages') : 'tous';
    if (mode === 'aucun') return;
    if (mode === 'importants' && genre !== 'alerte' && genre !== 'butin') return;
    if (!boiteMsg) boiteMsg = document.getElementById('messages');
    if (!boiteMsg) return;
    const m = el('div', { class: 'msg ' + (genre || ''), text: txt });
    boiteMsg.appendChild(m);
    setTimeout(() => { m.style.transition = 'opacity .3s'; m.style.opacity = '0';
      setTimeout(() => m.remove(), 320); }, ms || 2600);
    while (boiteMsg.children.length > 5) boiteMsg.firstChild.remove();
  }

  /* =================================================================
     FENÊTRES FLOTTANTES
     Une par « sujet » (un bâtiment, le chantier, les réserves…). En
     rouvrir une déjà ouverte la remet au premier plan au lieu d'en
     empiler une seconde.
     ================================================================= */
  const ouvertes = new Map();
  let zTop = 30;
  const positions = {};

  function ouvrir(cle, cfg) {
    if (ouvertes.has(cle)) { const f = ouvertes.get(cle); avant(f); if (cfg.onglet) f.choisir(cfg.onglet); f.rafraichir(); return f; }

    const corps = el('div', { class: 'fen-corps' });
    const barreOnglets = el('div', { class: 'fen-onglets' });
    const titre = el('h2', { text: cfg.titre || '' });
    const sous = el('div', { class: 'sous', text: cfg.sous || '' });
    const fermeBtn = el('button', { class: 'fen-x', title: 'Fermer (Échap)', text: '×' });
    const tete = el('div', { class: 'fen-tete' },
      el('div', { class: 'ti' }, titre, sous), fermeBtn);
    const fen = el('div', { class: 'fen' + (cfg.classe ? ' ' + cfg.classe : '') }, tete, barreOnglets, corps);

    const F = {
      cle, cfg, noeud: fen, corps,
      onglet: cfg.onglet || (cfg.onglets && cfg.onglets[0] && cfg.onglets[0].id),
      choisir(id) { F.onglet = id; F.rafraichir(); },
      rafraichir() {
        if (cfg.titreVif) titre.textContent = cfg.titreVif();
        if (cfg.sousVif) sous.textContent = cfg.sousVif();
        const ongl = typeof cfg.onglets === 'function' ? cfg.onglets() : (cfg.onglets || []);
        rendreDans(barreOnglets, b => {
          if (ongl.length > 1) for (const o of ongl)
            b.appendChild(el('button', {
              'data-cle': o.id, class: o.id === F.onglet ? 'on' : '', text: o.nom,
              onclick: () => F.choisir(o.id),
            }));
        });
        barreOnglets.style.display = ongl.length > 1 ? '' : 'none';
        const cour = ongl.find(o => o.id === F.onglet) || ongl[0];
        if (!cour) return;
        F.onglet = cour.id;
        /* Changer d'onglet, c'est changer de sujet : on repart du haut
           et l'on rebâtit franchement. Un simple rafraîchissement, lui,
           se fond dans ce qui est déjà à l'écran. */
        const neuf = corps.cloneNode(false);
        neuf.setAttribute('data-onglet', cour.id);
        try { cour.rendu(neuf, F); }
        catch (e) { console.error('fenêtre', cle, e); neuf.appendChild(el('div', { class: 'note mauvais', text: 'Erreur d\'affichage : ' + e.message })); }
        if (corps.getAttribute('data-onglet') !== cour.id) {
          vide(corps);
          corps.setAttribute('data-onglet', cour.id);
          while (neuf.firstChild) corps.appendChild(neuf.firstChild);
          corps.scrollTop = 0;
        } else morphe(corps, neuf);
      },
      fermer() {
        positions[cle] = { x: parseInt(fen.style.left, 10), y: parseInt(fen.style.top, 10) };
        fen.remove(); ouvertes.delete(cle);
        if (cfg.surFermeture) cfg.surFermeture();
      },
    };

    fermeBtn.addEventListener('click', F.fermer);
    fen.addEventListener('pointerdown', () => avant(F), true);

    document.getElementById('couche').appendChild(fen);
    ouvertes.set(cle, F);
    F.rafraichir();

    /* placement : à la position mémorisée, sinon près de l'ancre
       (le bâtiment cliqué), sinon au centre-droit de l'écran. */
    const w = fen.offsetWidth || 360, h = fen.offsetHeight || 300;
    let x, y;
    const mem = positions[cle];
    if (mem && mem.x != null) { x = mem.x; y = mem.y; }
    else if (cfg.ancre) {
      x = cfg.ancre.cx - w / 2;
      y = cfg.ancre.cy - h - 14;
      if (y < 44) y = Math.min(cfg.ancre.sol + 14, innerHeight - h - 12);
    } else { x = innerWidth - w - 40; y = 70; }
    x = Math.max(document.getElementById('dock').classList.contains('replie') ? 24 : 300, Math.min(x, innerWidth - w - 12));
    y = Math.max(42, Math.min(y, innerHeight - h - 12));
    fen.style.left = Math.round(x) + 'px';
    fen.style.top = Math.round(y) + 'px';
    avant(F);
    glisser(fen, tete, cle);
    return F;
  }

  function avant(F) {
    for (const [, o] of ouvertes) o.noeud.classList.remove('active');
    F.noeud.classList.add('active');
    F.noeud.style.zIndex = ++zTop;
  }
  function fermer(cle) { const f = ouvertes.get(cle); if (f) f.fermer(); }
  function estOuverte(cle) { return ouvertes.has(cle); }
  function fermerTout() { for (const [, f] of Array.from(ouvertes)) f.fermer(); }

  function glisser(fen, poignee, cle) {
    let dx = 0, dy = 0, actif = false;
    poignee.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.fen-x')) return;
      actif = true;
      dx = ev.clientX - fen.offsetLeft;
      dy = ev.clientY - fen.offsetTop;
      poignee.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    poignee.addEventListener('pointermove', ev => {
      if (!actif) return;
      const x = Math.max(4, Math.min(ev.clientX - dx, innerWidth - fen.offsetWidth - 4));
      const y = Math.max(36, Math.min(ev.clientY - dy, innerHeight - 40));
      fen.style.left = Math.round(x) + 'px';
      fen.style.top = Math.round(y) + 'px';
    });
    poignee.addEventListener('pointerup', () => {
      actif = false;
      positions[cle] = { x: fen.offsetLeft, y: fen.offsetTop };
    });
  }

  /* Rafraîchissement périodique : cinq fois par seconde suffit à voir
     bouger les barres, et laisse le canvas tranquille. */
  setInterval(() => { for (const [, f] of ouvertes) f.rafraichir(); }, 200);

  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (window.Village && window.Village.enConstruction()) { window.UI.quitterConstruction(); return; }
      const l = Array.from(ouvertes.values());
      if (l.length) l[l.length - 1].fermer();
    }
  });

  window.UI = {
    el, vide, fmt, duree, heure, ico, icoRes, puce, listeRes, barre, dire,
    section, stats, bascule, segments, morphe, rendreDans,
    ouvrir, fermer, fermerTout, estOuverte, avant,
    quitterConstruction() { },     // remplacé par ui-fenetres.js
  };

})();
