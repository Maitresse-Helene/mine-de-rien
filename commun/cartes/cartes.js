/* Les cartes « Le savais-tu ? » dans Crayonnade.
   Chaque jeu a sa carte (commun/cartes/jeux-cartes.js) ; le contenu des cartes est dans commun/cartes/donnees.js.
   Le niveau d'une carte se lit dans les bons points que le jeu garde déjà (rien à changer dans les jeux) :
   - type « niveaux » : bronze dès qu'un niveau est réussi, puis un cran par niveau réussi (argent, or, platine, diamant),
     mythique quand les 5 niveaux ont été réussis sans faute (score « 10/10 », « 8/8 »…) ;
   - type « records » (calcul mental) : un cran par bon point (chaque nouveau record), diamant au 5e, mythique au 10e.
   Les bons points ajoutés par la maîtresse (« Ajouter des bons points », niveau 0) ne comptent pas.
   Dans un jeu, quand une écriture du jeu fait monter la carte du joueur, la fenêtre « Nouvelle carte ! » s'ouvre.
   Chargé par commun.js (section 9) dans les jeux et sur le portail, et par la page « Mes cartes » (cartes/index.html). */
(function () {
  "use strict";
  if (window.CARTES) return;
  var BASE = (function () {
    var s = document.currentScript;
    if (s && s.src) return s.src.replace(/[^\/]*$/, "");
    var l = document.querySelectorAll('script[src*="cartes/cartes.js"]');
    return l.length ? l[l.length - 1].src.replace(/[^\/]*$/, "") : "commun/cartes/";
  })();
  var RACINE = new URL("../../", BASE).href;
  var RARETES = [null, "bronze", "argent", "or", "platine", "diamant", "mythique"];
  var NOMS = { bronze: "Bronze", argent: "Argent", or: "Or", platine: "Platine", diamant: "Diamant", mythique: "Mythique" };
  var ECAILLES = [0, 1, 2, 3, 4, 5, 7];
  var DRAGONS = ["vert", "bleu", "rouge", "doré", "violet", "arc-en-ciel"];
  var TITRES = ["Apprenti", "Chevalier", "Maître", "Grand maître"];
  var ROND = "M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15Z";
  var STRIES = "repeating-linear-gradient(45deg, rgba(255,255,255,.22) 0 1px, rgba(255,255,255,0) 1px 4px), ";
  var OR = "linear-gradient(135deg, #8a6212 0%, #e6c35c 18%, #fff1b8 32%, #c9971f 48%, #f7de8a 64%, #a8781a 82%, #e9c766 100%)";
  var CRISTAL = "conic-gradient(from 10deg at 50% 50%, #ffffff 0 8%, #c8ecff 8% 17%, #eef8ff 17% 25%, #a9d8ff 25% 33%, #ffffff 33% 42%, #d8ccff 42% 50%, #f0f8ff 50% 58%, #b6e6ff 58% 67%, #ffffff 67% 75%, #cfe0ff 75% 83%, #ffe3f4 83% 92%, #bfe9ff 92% 100%)";
  var IRIS = "linear-gradient(120deg, rgba(255,79,163,.22), rgba(255,184,0,.22), rgba(56,217,122,.22), rgba(47,180,255,.22), rgba(157,107,255,.22), rgba(255,79,163,.22)), ";
  var PLATINE = "repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 1px, rgba(255,255,255,0) 1px 3px), repeating-linear-gradient(-45deg, rgba(255,255,255,.35) 0 1px, rgba(255,255,255,0) 1px 3px), linear-gradient(135deg, #7d8ea6 0%, #dfe7f2 18%, #ffffff 32%, #b7c4d6 48%, #f4f8fc 64%, #8fa0b8 82%, #e3eaf3 100%)";
  function coin(n) { return BASE + "img/coin-" + n + ".svg"; }
  /* Les six niveaux, comme dans le canevas */
  var T = {
    bronze: { cadre: STRIES + "linear-gradient(135deg, #6b3a1c 0%, #c07a45 18%, #f2c29a 32%, #a5612f 48%, #e3a878 64%, #7a4321 82%, #d08f5c 100%)", cls: "", coin: coin("bronze"), filet: "rgba(107,58,28,.55)", badge: "linear-gradient(135deg, #c07a45, #f2c29a 45%, #a5612f)", icone: ROND, fill: "#c07a45", son: "retourne", etincelles: false },
    argent: { cadre: "repeating-linear-gradient(45deg, rgba(255,255,255,.3) 0 1px, rgba(255,255,255,0) 1px 4px), linear-gradient(135deg, #6f7787 0%, #c9ced8 18%, #ffffff 32%, #9aa2b1 48%, #eef0f4 64%, #7c8494 82%, #d5d9e1 100%)", cls: "", coin: coin("argent"), filet: "rgba(95,103,120,.55)", badge: "linear-gradient(135deg, #c9ced8, #ffffff 45%, #9aa2b1)", icone: ROND, fill: "#c9ced8", son: "retourne", etincelles: false },
    or: { cadre: STRIES + OR, cls: "", coin: coin("or"), filet: "rgba(138,98,18,.6)", badge: "linear-gradient(135deg, #e6c35c, #fff1b8 45%, #c9971f)", icone: ROND, fill: "#e6c35c", son: "retourne", etincelles: false },
    platine: { cadre: PLATINE, cls: "", coin: coin("platine"), filet: "rgba(91,107,132,.55)", badge: "linear-gradient(135deg, #dfe7f2, #ffffff 45%, #b7c4d6)", icone: ROND, fill: "#eef3f9", son: "retourne", etincelles: false },
    diamant: { cadre: IRIS + CRISTAL, mini: CRISTAL, cls: "cr-prisme", coin: coin("diamant"), filet: "rgba(63,106,166,.5)", badge: IRIS + "linear-gradient(135deg, #e8f7ff, #ffffff 45%, #b6e6ff)", icone: "M7.5 4h9l4.5 5.5L12 21 3 9.5Z", fill: "#bfe9ff", son: "brille", etincelles: true, sf: "#ffffff", ss: "#5fb7ff" },
    mythique: { cadre: STRIES + "linear-gradient(120deg, #ff4fa3, #ffb800, #38d97a, #2fb4ff, #9d6bff, #ff4fa3, #ffb800), " + OR, mini: STRIES + OR, cls: "cr-holo3", coin: coin("or"), filet: "rgba(138,98,18,.6)", badge: "linear-gradient(120deg, rgba(255,79,163,.35), rgba(255,184,0,.35), rgba(56,217,122,.35), rgba(47,180,255,.35), rgba(157,107,255,.35)), linear-gradient(135deg, #e6c35c, #fff1b8 45%, #c9971f)", icone: "M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z", fill: "#ffd95a", son: "brille", etincelles: true, sf: "#fff6cf", ss: "#c9971f" }
  };
  var ETINCELLE = "M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z";
  var ET_RECTO = [[20, "top:-8px;left:40px", "-0.0s"], [16, "top:30px;right:-9px", "-0.6s"], [18, "top:150px;left:-9px", "-1.2s"], [14, "top:64px;right:26px", "-1.8s"], [12, "top:196px;left:30px", "-0.9s"], [20, "bottom:120px;right:-8px", "-1.5s"], [18, "bottom:-8px;left:150px", "-0.3s"], [14, "bottom:40px;left:-8px", "-2.0s"]];
  var ET_VERSO = [[18, "top:-8px;right:50px", "-0.2s"], [16, "top:200px;left:-9px", "-1.1s"], [18, "bottom:-8px;right:90px", "-1.7s"], [14, "top:90px;right:-9px", "-0.8s"]];
  var FLECHES = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a2358" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"></path><path d="M3 21v-5h5"></path></svg>';

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norme(s) { return String(s || "").replace(/[’`]/g, "'").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function lireJSON(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function ecrireBrut(k, v) {
    var f = (window.CMP && window.CMP.setItem) || Storage.prototype.setItem;
    try { f.call(localStorage, k, v); } catch (e) {}
  }

  /* ---------- Le niveau d'une carte (0 = pas encore gagnée, 1 = bronze … 5 = diamant, 6 = mythique) ---------- */
  function niveauCarte(type, profil) {
    var pts = profil && Array.isArray(profil.points) ? profil.points.filter(function (p) { return p && typeof p === "object" && !p.enseignante; }) : [];
    if (type === "records") return pts.length >= 10 ? 6 : Math.min(5, pts.length);
    var reussis = {}, parfaits = {}, n = 0, sf = 0, k;
    pts.forEach(function (p) {
      var lv = parseInt(String(p.level == null ? "" : p.level).replace(/\D/g, ""), 10);
      if (!(lv >= 1 && lv <= 5)) return;
      reussis[lv] = true;
      var m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(p.score || ""));
      if (m && +m[2] > 0 && +m[1] >= +m[2]) parfaits[lv] = true;
    });
    for (k in reussis) n++;
    for (k in parfaits) sf++;
    if (!n) return 0;
    return sf >= 5 ? 6 : Math.min(5, n);
  }

  /* ---------- Les écailles et le dragon ---------- */
  function dragon(e) {
    /* Paliers fixes : Apprenti (dès la première carte), Chevalier 20, Maître 50, Grand maître 100 ;
       puis un nouveau dragon (bleu, rouge, doré…) avec les mêmes paliers sur les 100 écailles suivantes. */
    e = Math.max(0, e | 0);
    var d = Math.floor(e / 100), r = e - d * 100, rang, prochain, titreProchain;
    if (d >= DRAGONS.length) d = DRAGONS.length - 1, r = Math.min(99, e - d * 100);
    if (r < 20) rang = 0; else if (r < 50) rang = 1; else rang = 2;
    if (d > 0 && r < 20) {
      /* Juste après un Grand maître : on garde ce titre en tête, le nouvel œuf vient avec */
      return { ecailles: e, titre: "Grand maître du dragon " + DRAGONS[d - 1], couleur: DRAGONS[d - 1], rang: 3, oeuf: DRAGONS[d],
        prochain: d * 100 + 20, titreProchain: "Chevalier du dragon " + DRAGONS[d] };
    }
    prochain = d * 100 + [20, 50, 100][rang];
    titreProchain = rang < 2 ? TITRES[rang + 1] + " du dragon " + DRAGONS[d] : "Grand maître du dragon " + DRAGONS[d];
    return { ecailles: e, titre: e > 0 ? TITRES[rang] + " du dragon " + DRAGONS[d] : "", couleur: DRAGONS[d], rang: rang, prochain: prochain, titreProchain: titreProchain };
  }

  /* ---------- Les données ---------- */
  var attente = [];
  function chargerDonnees(cb) {
    if (window.CARTES_DONNEES) { cb(window.CARTES_DONNEES); return; }
    attente.push(cb);
    if (attente.length > 1) return;
    var s = document.createElement("script");
    s.src = BASE + "donnees.js";
    s.onload = function () { var l = attente; attente = []; if (window.CARTES_DONNEES) l.forEach(function (f) { f(window.CARTES_DONNEES); }); };
    s.onerror = function () { attente = []; };
    document.head.appendChild(s);
  }
  function index(D) {
    if (D._idx) return D._idx;
    var I = { cartes: {}, series: {} };
    D.series.forEach(function (s) { I.series[s.cle] = s; });
    D.cartes.forEach(function (c) { I.cartes[c.id] = c; });
    Object.defineProperty(D, "_idx", { value: I });
    return I;
  }

  /* ---------- Une carte en HTML ---------- */
  function etincelles(t, liste) {
    if (!t.etincelles) return "";
    return liste.map(function (x) {
      return '<svg class="cr-etincelle" width="' + x[0] + '" height="' + x[0] + '" viewBox="0 0 24 24" aria-hidden="true" style="' + x[1] + ";animation-delay:" + x[2] + '"><path d="' + ETINCELLE + '" fill="' + t.sf + '" stroke="' + t.ss + '" stroke-width=".8"></path></svg>';
    }).join("");
  }
  function coins(t) {
    return [1, 2, 3, 4].map(function (i) { return '<img class="cc-coin cc-c' + i + '" src="' + t.coin + '" alt="">'; }).join("");
  }
  function htmlCarte(c, s, niveau, o) {
    o = o || {};
    var r = RARETES[Math.max(1, Math.min(6, niveau || 1))], t = T[r];
    var sombre = s.txt !== "#ffffff";
    var vars = "--k:" + (o.k || 1) + ";--g:" + s.g + ";--txt:" + s.txt + ";--light:" + s.light + ";--accent:" + s.accent + ";--num:" + s.num +
      ";--filet:" + t.filet + ";--lblsh:" + (sombre ? "0 1px 0 rgba(255,255,255,.45)" : "0 1px 0 rgba(0,0,0,.25)") +
      ";--numsh:" + (sombre ? "0 1px 0 rgba(255,255,255,.5)" : "0 1px 0 rgba(0,0,0,.3), 0 -1px 0 rgba(255,255,255,.15)");
    var ta = c.tailles || {};
    var bande = '<div class="cc-bande"><span class="cc-serie">' + esc(s.label) + '</span><span class="cc-num">n° ' + c.n + "</span></div>";
    var face = function (cote) { return '<div class="cc-face cc-' + cote + (t.cls ? " " + t.cls : "") + '" style="background-image:' + t.cadre + '"' + (cote === "verso" ? ' aria-hidden="true"' : "") + ">"; };
    var recto = face("recto") + '<div class="cc-papier">' + bande +
      '<div class="cc-image"><div class="cc-mini" style="background-image:' + (t.mini || t.cadre) + '"><div class="cc-fond">' + c.svg + "</div></div></div>" +
      '<div class="cc-id"><h3 class="cc-nom" style="font-size:' + (ta.nom || "28px") + '">' + esc(c.nom) + '</h3><p class="cc-dates" style="font-size:' + (ta.dates || "18px") + '">' + esc(c.dates) + '</p><p class="cc-role">' + esc(c.role) + "</p></div>" +
      '<div class="cc-pied"><span class="cc-badge" style="background-image:' + t.badge + '"><svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="' + t.icone + '" fill="' + t.fill + '" stroke="#1a2358" stroke-width="1.4" stroke-linejoin="round"></path></svg>' + NOMS[r] + "</span>" +
      '<span class="cc-retourne">Retourne-moi<span class="cc-rond">' + FLECHES + "</span></span></div>" +
      '<div class="cc-filet"></div>' + coins(t) + '</div><div class="cr-reflet"></div>' + etincelles(t, ET_RECTO) + "</div>";
    var verso = face("verso") + '<div class="cc-papier">' + bande +
      '<div class="cc-bulle"><img src="' + BASE + 'img/mascotte.svg" alt=""><p>Le savais-tu ?</p></div>' +
      '<p class="cc-anec" style="font-size:' + (ta.anec || "13px") + '">' + esc(c.anec) + "</p>" +
      '<div class="cc-encadre"><div><p class="cc-lbl">Célèbre pour</p><p class="cc-txt" style="font-size:' + (ta.encadre || "12.5px") + '">' + esc(c.celebre) + "</p></div>" +
      '<div><p class="cc-lbl">' + esc(c.xl) + '</p><p class="cc-txt" style="font-size:' + (ta.encadre || "12.5px") + '">' + esc(c.x) + "</p></div></div>" +
      '<div class="cc-pied"><span class="cc-signe"><img src="' + BASE + 'img/sceau.svg" alt=""><span>Crayonnade</span></span><span class="cc-rond">' + FLECHES + "</span></div>" +
      '<div class="cc-filet"></div>' + coins(t) + '</div><div class="cr-reflet"></div>' + etincelles(t, ET_VERSO) + "</div>";
    return '<div class="cc-carte' + (s.label.length > 19 ? " cc-long" : "") + (o.fixe ? " cc-fixe" : "") + (o.classe ? " " + o.classe : "") + '" data-carte="' + esc(c.id) + '" data-rarete="' + r + '" style="' + vars + '">' +
      '<button type="button" class="cc-btn" aria-label="' + esc(o.label || (c.nom + ", carte " + NOMS[r] + ". Touche pour la retourner.")) + '"' + (o.inerte ? ' tabindex="-1"' : "") + '><div class="cc-tour">' + recto + verso + "</div></button></div>";
  }

  /* ---------- Les sons (coupés si le son des jeux est coupé) ---------- */
  var sons = {};
  function son(nom) {
    try {
      if (localStorage.getItem("jeu-son") === "0") return;
      var a = sons[nom];
      if (!a) { a = new Audio(BASE + "img/" + nom + ".m4a"); a.preload = "auto"; sons[nom] = a; }
      a.currentTime = 0; a.volume = 0.7;
      var p = a.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  /* Une carte qui se retourne quand on la touche */
  function retournable(el) {
    var b = el && el.querySelector(".cc-btn");
    if (!b || b._cc) return;
    b._cc = true;
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var dos = el.classList.toggle("cc-dos");
      el.querySelector(".cc-recto").setAttribute("aria-hidden", dos ? "true" : "false");
      el.querySelector(".cc-verso").setAttribute("aria-hidden", dos ? "false" : "true");
      if (dos) son((T[el.getAttribute("data-rarete")] || T.bronze).son);
    });
  }

  /* ---------- Toutes les cartes d'un joueur (pour les écailles et l'album) ---------- */
  function niveauxDuJoueur(cle) {
    /* renvoie { slug: niveau } pour tous les jeux qui ont une carte */
    var r = {}, J = window.CARTES_JEUX || {}, nc = norme(cle);
    for (var slug in J) {
      var st = J[slug].stockage ? lireJSON(J[slug].stockage) : null, p = null;
      if (st && st.profiles && typeof st.profiles === "object") {
        if (st.profiles[cle]) p = st.profiles[cle];
        else for (var k in st.profiles) if (norme(k) === nc) { p = st.profiles[k]; break; }
      }
      r[slug] = p ? niveauCarte(J[slug].type, p) : 0;
    }
    return r;
  }
  function totalEcailles(niveaux) { var e = 0; for (var s in niveaux) e += ECAILLES[niveaux[s]] || 0; return e; }

  /* ---------- La fenêtre « Nouvelle carte ! » (dans un jeu) ---------- */
  var ouverte = null;
  function lienAlbum(carteId) { return RACINE + "cartes/index.html" + (carteId ? "?carte=" + encodeURIComponent(carteId) : ""); }
  function afficherGain(info) {
    chargerDonnees(function (D) {
      var I = index(D), c = I.cartes[info.carte], s = c && I.series[c.serie];
      if (!c || !s) return;
      if (ouverte) ouverte.remove();
      var r = RARETES[info.apres], gain = ECAILLES[info.apres] - ECAILLES[info.avant];
      var titre = info.avant === 0 ? "Nouvelle carte !" : info.apres === 6 ? "Ta carte devient mythique !" : "Ta carte passe en " + NOMS[r].toLowerCase() + " !";
      var sous = info.avant === 0
        ? "Tu as gagné la carte <b>" + esc(c.nom) + "</b>, en bronze."
        : "<b>" + esc(c.nom) + "</b> : " + NOMS[RARETES[info.avant]].toLowerCase() + " → <b>" + NOMS[r].toLowerCase() + "</b>.";
      var ec = "";
      if (info.ecailles != null) {
        var avant = dragon(info.ecailles - gain), apres = dragon(info.ecailles);
        ec = "+" + gain + " écaille" + (gain > 1 ? "s" : "") + " de dragon : tu en as <b>" + info.ecailles + "</b>.";
        if (apres.titre && apres.titre !== avant.titre) ec += "<br>Tu deviens <b>" + esc(apres.titre) + "</b> !";
      }
      var k = Math.max(0.55, Math.min(1, (window.innerWidth - 24) / 320, (window.innerHeight - 250) / 448));
      var f = document.createElement("div");
      f.id = "cc-gagne";
      f.setAttribute("role", "dialog");
      f.setAttribute("aria-modal", "true");
      f.setAttribute("aria-labelledby", "cc-gagne-titre");
      f.innerHTML = '<div class="cc-boite"><h2 id="cc-gagne-titre">' + titre + '</h2><p class="cc-sous">' + sous + (ec ? "<br>" + ec : "") + "</p>" +
        '<div class="cc-arrivee">' + htmlCarte(c, s, info.apres, { k: k }) + "</div>" +
        '<p class="cc-aide">Touche la carte pour la retourner.</p>' +
        '<div class="cc-boutons"><a class="cc-bouton cc-vide" href="' + lienAlbum(c.id) + '">Voir toutes mes cartes</a><button type="button" class="cc-bouton cc-plein" data-continuer>Continuer</button></div></div>';
      ["keydown", "keyup", "keypress"].forEach(function (ev) { f.addEventListener(ev, function (e) { e.stopPropagation(); if (ev === "keydown" && e.key === "Escape") fermer(); }); });
      var precedent = document.activeElement;
      function fermer() { f.remove(); ouverte = null; try { if (precedent && precedent.focus) precedent.focus({ preventScroll: true }); } catch (e) {} }
      f.querySelector("[data-continuer]").addEventListener("click", fermer);
      f.querySelector("a").addEventListener("click", function () { if (info.joueur) ecrireBrut("crayonnade-cartes-joueur", JSON.stringify({ cle: info.joueur, nom: info.nom || "" })); });
      f.addEventListener("click", function (e) { if (e.target === f) fermer(); });
      document.body.appendChild(f);
      ouverte = f;
      retournable(f.querySelector(".cc-carte"));
      son("brille");
      try { f.querySelector("[data-continuer]").focus({ preventScroll: true }); } catch (e) {}
    });
  }

  /* ---------- Dans un jeu : suivre les écritures du jeu dans son stockage ---------- */
  function suivreJeu() {
    var J = window.CMG_JEU, CJ = window.CARTES_JEUX || {};
    if (!J || !J.stockage || !J.slug || !CJ[J.slug]) return;
    var regle = CJ[J.slug], cleSt = J.stockage;
    /* Le niveau de la carte pour le profil « cle » (ou le joueur choisi dans le jeu) dans un état du stockage */
    function lireNiveau(txt, cle) {
      try {
        var st = JSON.parse(txt), k = cle || (st && st.current), p = k && st.profiles && st.profiles[k];
        return { cle: k || "", nom: (p && p.name) || k || "", niveau: p ? niveauCarte(regle.type, p) : 0 };
      } catch (e) { return { cle: cle || "", nom: "", niveau: 0 }; }
    }
    var avantSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      var suivi = this === window.localStorage && k === cleSt, avant = null;
      if (suivi) { try { avant = localStorage.getItem(k); } catch (e) {} }
      avantSetItem.apply(this, arguments);
      if (!suivi) return;
      var b = lireNiveau(String(v)), a = lireNiveau(avant, b.cle);
      if (!b.cle || b.niveau <= a.niveau) return;
      var info = { carte: regle.carte, avant: a.niveau, apres: b.niveau, joueur: b.cle, nom: b.nom };
      try { info.ecailles = totalEcailles(niveauxDuJoueur(b.cle)); } catch (e) {}
      setTimeout(function () { afficherGain(info); }, 900);
    };
  }

  window.CARTES = {
    BASE: BASE, RACINE: RACINE, RARETES: RARETES, NOMS: NOMS, ECAILLES: ECAILLES, DRAGONS: DRAGONS,
    norme: norme, niveauCarte: niveauCarte, dragon: dragon, chargerDonnees: chargerDonnees, index: index,
    htmlCarte: htmlCarte, retournable: retournable, son: son, niveauxDuJoueur: niveauxDuJoueur, totalEcailles: totalEcailles,
    afficherGain: afficherGain, lienAlbum: lienAlbum
  };
  suivreJeu();
})();
