/* Crayonnade : la porte de l'Espace enseignante, chargée par les pages de l'enseignante (enseignante/…), après commun.js.
   Ne pas modifier à la main : demander à Claude.

   La maîtresse se connecte avec son identifiant et son mot de passe, vérifiés par le serveur (functions/api/), qui n'en
   garde que l'empreinte. La toute première fois, son ancien code de maîtresse lui fait choisir son mot de passe.
   - Sans « Rester connectée » : la connexion ne vaut que pour cet onglet, et 20 minutes après la dernière action (elle
     peut donc s'en servir sur l'appareil d'un élève sans que l'élève y ait accès ensuite).
   - Avec « Rester connectée sur cet appareil » (son appareil à elle) : 30 jours, sans rien retaper.
   « Verrouiller » / « Se déconnecter » referme tout de suite.
   ENS_CODES : empreintes de l'ancien code (jamais le code en clair). Elles servent à la première connexion et, sans
   serveur (pas de connexion, tests), à ouvrir les outils qui travaillent seulement sur l'appareil.
   window.ENS : appels au serveur avec la session enseignante (pages « Comptes des élèves », « Mon Espace enseignante »). */
window.ENS_CODES = ["1qpuhkkjl3o"];

(function () {
  var CLE = "cm1cm2-ens", JETON = "crayonnade-ens", NOM = "crayonnade-ens-nom", APPAREIL = "crayonnade-ens-appareil";
  var DUREE = 20 * 60 * 1000;
  function normaliser(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function empreinte(t) {
    var a = -559038744, b = 1103547984, i, c;
    for (i = 0; i < t.length; i++) { c = t.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
    a = Math.imul(a ^ a >>> 16, 2246822507); a ^= Math.imul(b ^ b >>> 13, 3266489909);
    b = Math.imul(b ^ b >>> 16, 2246822507); b ^= Math.imul(a ^ a >>> 13, 3266489909);
    return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
  }
  function sLire(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function sEcrire(k, v) { try { if (v === null || v === undefined) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function lire() { try { return JSON.parse(sLire(CLE) || "null"); } catch (e) { return null; } }
  function ecrire(v) { sEcrire(CLE, v ? JSON.stringify(v) : null); }
  function appareil() {
    try { var v = JSON.parse(localStorage.getItem(APPAREIL) || "null"); return v && v.jeton && v.fin > Date.now() ? v : null; } catch (e) { return null; }
  }
  function ouvert() {
    if (appareil()) return true;
    var v = lire();
    return !!(v && (v.h === "serveur" || window.ENS_CODES.indexOf(v.h) >= 0) && Date.now() - v.t < DUREE);
  }
  function jeton() { var a = appareil(); return a ? a.jeton : (sLire(JETON) || ""); }
  function affiche() { var a = appareil(); return a ? a.affiche : (sLire(NOM) || ""); }
  /* Après une connexion réussie au serveur */
  function garder(d, rester) {
    var nom = d.enseignante && d.enseignante.affiche || "";
    if (rester) {
      try { localStorage.setItem(APPAREIL, JSON.stringify({ jeton: d.jeton, affiche: nom, fin: Date.now() + (d.duree || 30 * 864e5) })); } catch (e) {}
    } else { sEcrire(JETON, d.jeton); sEcrire(NOM, nom); }
    ecrire({ h: "serveur", t: Date.now() });
  }
  function oublier() {
    try { localStorage.removeItem(APPAREIL); } catch (e) {}
    sEcrire(JETON, null); sEcrire(NOM, null); ecrire(null);
  }
  function api(methode, chemin, corps, j) {
    if (location.protocol === "file:") return Promise.reject(new Error("fichier"));
    var o = { method: methode, headers: {}, credentials: "same-origin", cache: "no-store" };
    if (corps !== undefined) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(corps); }
    if (j) o.headers.Authorization = "Bearer " + j;
    return fetch("/api/" + chemin, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { d = d && typeof d === "object" ? d : {}; d._statut = r.status; return d; });
    });
  }
  /* Réponse du serveur : { jeton } (ouvert), { init, jeton } (choisir le mot de passe),
     { horsService } (pas de serveur : on vérifie l'ancien code sur l'appareil), ou { message } (refusé). */
  function verifier(login, code, rester) {
    return api("POST", "ens/connexion", { login: login, code: code, rester: !!rester }).then(function (d) {
      if (d._statut === 200 && d.jeton) return d;
      if (d._statut === 401 || d._statut === 429 || d._statut === 400) return { message: d.message || "Identifiant ou mot de passe incorrect." };
      return { horsService: true };
    }, function () { return { horsService: true }; });
  }
  window.ENS = {
    jeton: jeton,
    affiche: affiche,
    verifier: verifier,
    garder: garder,
    oublier: oublier,
    resteConnectee: function () { return !!appareil(); },
    garderJeton: function (j) { if (j) { sEcrire(JETON, j); ecrire({ h: "serveur", t: Date.now() }); } else oublier(); },
    api: function (methode, chemin, corps) { return api(methode, chemin, corps, jeton()); },
    init: function (jetonInit, nouveau, rester) { return api("POST", "ens/init", { nouveau: nouveau, rester: !!rester }, jetonInit); },
    deconnecter: function () { verrouiller(); }
  };
  function verrouiller() {
    var j = jeton();
    if (j) api("POST", "ens/deconnexion", {}, j).catch(function () {});
    oublier();
    location.reload();
  }

  /* Une fois ouvert : on prolonge à chaque action, et (sauf « rester connectée ») on referme après 20 minutes sans rien faire. */
  function surveiller() {
    ["click", "keydown", "input"].forEach(function (ev) {
      document.addEventListener(ev, function () { var v = lire(); if (v) { v.t = Date.now(); ecrire(v); } }, true);
    });
    setInterval(function () { if (!ouvert()) verrouiller(); }, 30000);
    function bouton() {
      /* « Rester connectée » : pas de bouton flottant (on se déconnecterait sans le vouloir) ;
         « Me déconnecter de cet appareil » est en bas de « Mon Espace enseignante ». */
      if (appareil() || document.getElementById("ens-lock")) return;
      var b = document.createElement("button");
      b.id = "ens-lock"; b.type = "button";
      b.innerHTML = appareil() ? '<span aria-hidden="true">🔒</span> Se déconnecter' : '<span aria-hidden="true">🔒</span> Verrouiller';
      b.addEventListener("click", verrouiller);
      document.body.appendChild(b);
    }
    /* Sur un outil (enseignante/<outil>/), un lien pour revenir à « Mon Espace enseignante ». */
    function lienEspace() {
      var nav = document.getElementById("allgames");
      if (!nav || nav.querySelector(".ens-retour") || !/\/enseignante\/[^/]+\//.test(location.pathname)) return;
      var a = document.createElement("a");
      a.className = "ens-retour"; a.href = "../index.html"; a.textContent = "Mon Espace enseignante";
      a.style.marginLeft = "8px";
      nav.appendChild(a);
    }
    function pret() { bouton(); lienEspace(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pret); else pret();
  }

  if (ouvert()) { surveiller(); return; }

  var porte = document.createElement("div");
  porte.id = "ens-gate";
  porte.setAttribute("role", "dialog");
  porte.setAttribute("aria-modal", "true");
  porte.setAttribute("aria-labelledby", "ens-label");
  porte.innerHTML = '<div class="cmg-card"><p class="cmg-eyebrow">Espace enseignante</p>' +
    '<div class="cmg-head"><span class="cmg-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></span>' +
    '<label id="ens-label" for="ens-login">Connexion</label></div>' +
    '<p class="cmg-text">Cet espace est réservé à l\'enseignante.</p>' +
    '<form novalidate class="ens-form">' +
    '<input id="ens-login" name="login" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Identifiant" style="flex:1 1 100% !important;text-transform:none!important">' +
    '<input id="ens-input" name="code" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Mot de passe" style="flex:1 1 100% !important;text-transform:none!important">' +
    '<label class="ens-rester"><input type="checkbox" id="ens-rester" checked> Rester connectée sur cet appareil (seulement sur mon appareil à moi)</label>' +
    '<button type="submit">Entrer</button></form>' +
    '<p class="cmg-error" id="ens-error" role="alert"></p>' +
    '<p class="cmg-note"><a href="' + (/\/enseignante\/?(index\.html)?$/.test(location.pathname) ? "../index.html" : "../../index.html") + '" style="color:inherit">← Revenir aux jeux</a></p></div>';
  var racine = document.documentElement, debordement = racine.style.overflow;
  racine.style.overflow = "hidden";
  (document.body || racine).appendChild(porte);

  function inertes(oui) {
    var enfants = document.body ? document.body.children : [];
    for (var i = 0; i < enfants.length; i++) {
      var e = enfants[i];
      if (e === porte || e.id === "cmg-gate" || e.tagName === "SCRIPT" || e.tagName === "STYLE") continue;
      if (oui) e.setAttribute("inert", ""); else e.removeAttribute("inert");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { if (porte.isConnected) inertes(true); });
  else inertes(true);
  try {
    new MutationObserver(function () { if (porte.isConnected) inertes(true); })
      .observe(document.body || racine, { childList: true });
  } catch (e) {}

  var champLogin = porte.querySelector("#ens-login"), champ = porte.querySelector("#ens-input"),
    rester = porte.querySelector("#ens-rester"), erreur = porte.querySelector(".cmg-error");
  ["keydown", "keyup", "keypress"].forEach(function (ev) { porte.addEventListener(ev, function (e) { e.stopPropagation(); }); });
  [champLogin, champ].forEach(function (c) { c.addEventListener("input", function () { c.removeAttribute("aria-invalid"); erreur.textContent = ""; }); });
  function entrer(h) {
    if (h !== "serveur") ecrire({ h: h, t: Date.now() });
    inertes(false);
    porte.remove();
    racine.style.overflow = debordement;
    surveiller();
  }
  function refuser(texte) {
    champ.setAttribute("aria-invalid", "true");
    erreur.textContent = texte;
    champ.value = "";
    champ.focus();
  }
  /* Première fois : l'enseignante choisit son mot de passe. */
  function choisirMotDePasse(jetonInit, resterIci) {
    porte.querySelector(".cmg-card").innerHTML = '<p class="cmg-eyebrow">Espace enseignante</p>' +
      '<div class="cmg-head"><label id="ens-label" for="ens-n1">Votre mot de passe</label></div>' +
      '<p class="cmg-text">Première connexion : choisissez votre mot de passe, d\'au moins 6 lettres ou chiffres ' +
      '(les majuscules et les accents ne comptent pas), puis notez-le bien. Il remplace l\'ancien code de la maîtresse.</p>' +
      '<form novalidate><input id="ens-n1" type="password" autocomplete="new-password" placeholder="Mot de passe" style="flex:1 1 100% !important;text-transform:none!important">' +
      '<input id="ens-n2" type="password" autocomplete="new-password" placeholder="Encore une fois" style="flex:1 1 100% !important;text-transform:none!important"><button type="submit">Valider</button></form>' +
      '<p class="cmg-error" id="ens-error" role="alert"></p>';
    var f = porte.querySelector("form"), e1 = porte.querySelector("#ens-n1"), e2 = porte.querySelector("#ens-n2"), err = porte.querySelector(".cmg-error");
    try { e1.focus(); } catch (x) {}
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var a = normaliser(e1.value), b = normaliser(e2.value);
      if (a.length < 6) { err.textContent = "Au moins 6 lettres ou chiffres."; return; }
      if (a !== b) { err.textContent = "Les deux mots de passe ne sont pas pareils."; e2.value = ""; e2.focus(); return; }
      err.textContent = "";
      window.ENS.init(jetonInit, a, resterIci).then(function (d) {
        if (d._statut === 200 && d.jeton) { garder(d, resterIci); entrer("serveur"); return; }
        err.textContent = d.message || "Impossible d'enregistrer ce mot de passe. Réessayez.";
      }, function () { err.textContent = "Pas de connexion internet. Réessayez dans un moment."; });
    });
  }
  porte.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var login = champLogin.value.trim(), code = champ.value, resterIci = rester.checked;
    if (!normaliser(code)) { refuser("Tapez votre mot de passe."); return; }
    erreur.textContent = "";
    verifier(login, code, resterIci).then(function (r) {
      if (r.jeton && r.init) { choisirMotDePasse(r.jeton, resterIci); return; }
      if (r.jeton) { garder(r, resterIci); entrer("serveur"); return; }
      if (r.horsService) {
        /* Pas de serveur : seul l'ancien code ouvre les outils qui travaillent sur l'appareil. */
        var h = empreinte("cm1cm2-ens|" + normaliser(code));
        if (window.ENS_CODES.indexOf(h) >= 0) { entrer(h); return; }
        refuser("Pas de connexion au serveur, ou mot de passe incorrect.");
        return;
      }
      refuser(r.message || "Identifiant ou mot de passe incorrect.");
    });
  });
  if (!document.getElementById("cmg-gate")) { try { champLogin.focus({ preventScroll: true }); } catch (e) {} }
})();
