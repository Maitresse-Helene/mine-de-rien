/* Crayonnade : la porte « Code de la maîtresse », chargée par les outils de l'enseignante (enseignante/…),
   après commun.js. Ne pas modifier à la main : demander à Claude.

   ENS_CODES : les empreintes du code de la maîtresse (jamais le code en clair).
   Le code n'est retenu que dans cet onglet (sessionStorage), et 20 minutes après la dernière action :
   la maîtresse peut donc s'en servir sur la tablette d'un élève sans que l'élève y ait accès ensuite.
   Le bouton « Verrouiller » referme l'espace tout de suite.

   Avec les comptes élèves, le code de la maîtresse est vérifié par le serveur (functions/api/), qui garde
   seulement son empreinte. La toute première fois, l'ancien code (ENS_CODES ci-dessous) permet d'en choisir un
   nouveau, plus long, que le dépôt public ne permet pas de retrouver. Sans serveur (pas de connexion, tests),
   la porte se contente de ENS_CODES ; seuls les outils qui travaillent sur l'appareil marchent alors.
   window.ENS.api(...) : appel au serveur avec la session enseignante (page « Comptes des élèves »). */
window.ENS_CODES = ["1qpuhkkjl3o"];

(function () {
  var CLE = "cm1cm2-ens", JETON = "crayonnade-ens", DUREE = 20 * 60 * 1000;
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
  function lire() { try { return JSON.parse(sessionStorage.getItem(CLE) || "null"); } catch (e) { return null; } }
  function ecrire(v) { try { if (v) sessionStorage.setItem(CLE, JSON.stringify(v)); else sessionStorage.removeItem(CLE); } catch (e) {} }
  function ouvert() {
    var v = lire();
    return !!(v && (v.h === "serveur" || window.ENS_CODES.indexOf(v.h) >= 0) && Date.now() - v.t < DUREE);
  }
  function jeton() { try { return sessionStorage.getItem(JETON) || ""; } catch (e) { return ""; } }
  function garderJeton(j) { try { if (j) sessionStorage.setItem(JETON, j); else sessionStorage.removeItem(JETON); } catch (e) {} }
  function api(methode, chemin, corps, j) {
    if (location.protocol === "file:") return Promise.reject(new Error("fichier"));
    var o = { method: methode, headers: {}, credentials: "same-origin", cache: "no-store" };
    if (corps !== undefined) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(corps); }
    if (j) o.headers.Authorization = "Bearer " + j;
    return fetch("/api/" + chemin, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { d = d && typeof d === "object" ? d : {}; d._statut = r.status; return d; });
    });
  }
  /* Réponse du serveur à un code : { jeton } (ouvert), { init, jeton } (choisir le nouveau code),
     { horsService } (pas de serveur : on vérifie sur l'appareil), ou { message } (refusé). */
  function verifier(code) {
    return api("POST", "ens/connexion", { code: code }).then(function (d) {
      if (d._statut === 200 && d.jeton) return d;
      if (d._statut === 401 || d._statut === 429 || d._statut === 400) return { message: d.message || "Ce code ne marche pas." };
      return { horsService: true };
    }, function () { return { horsService: true }; });
  }
  window.ENS = {
    jeton: jeton,
    verifier: verifier,
    garderJeton: garderJeton,
    api: function (methode, chemin, corps) { return api(methode, chemin, corps, jeton()); },
    init: function (jetonInit, nouveau) { return api("POST", "ens/init", { nouveau: nouveau }, jetonInit); }
  };
  function verrouiller() {
    var j = jeton();
    if (j) api("POST", "ens/deconnexion", {}, j).catch(function () {});
    garderJeton(null);
    ecrire(null);
    location.reload();
  }

  /* Une fois ouvert : on prolonge à chaque action, et on referme après 20 minutes sans rien faire. */
  function surveiller() {
    ["click", "keydown", "input"].forEach(function (ev) {
      document.addEventListener(ev, function () { var v = lire(); if (v) { v.t = Date.now(); ecrire(v); } }, true);
    });
    setInterval(function () { if (!ouvert()) verrouiller(); }, 30000);
    function bouton() {
      if (document.getElementById("ens-lock")) return;
      var b = document.createElement("button");
      b.id = "ens-lock"; b.type = "button";
      b.innerHTML = '<span aria-hidden="true">🔒</span> Verrouiller';
      b.addEventListener("click", verrouiller);
      document.body.appendChild(b);
    }
    if (document.body) bouton(); else document.addEventListener("DOMContentLoaded", bouton);
  }

  if (ouvert()) { surveiller(); return; }

  var porte = document.createElement("div");
  porte.id = "ens-gate";
  porte.setAttribute("role", "dialog");
  porte.setAttribute("aria-modal", "true");
  porte.setAttribute("aria-labelledby", "ens-label");
  porte.innerHTML = '<div class="cmg-card"><p class="cmg-eyebrow">Espace enseignante</p>' +
    '<div class="cmg-head"><span class="cmg-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></span>' +
    '<label id="ens-label" for="ens-input">Code de la maîtresse</label></div>' +
    '<p class="cmg-text">Cet espace est réservé à la maîtresse.</p>' +
    '<form novalidate><input id="ens-input" name="code" type="password" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go"><button type="submit">Entrer</button></form>' +
    '<p class="cmg-error" id="ens-error" role="alert"></p>' +
    '<p class="cmg-note"><a href="../../index.html" style="color:inherit">← Revenir aux jeux</a></p></div>';
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
  /* La porte de la classe, en s'ouvrant, réactive toute la page : on remet la page en sommeil derrière notre porte. */
  try {
    new MutationObserver(function () { if (porte.isConnected) inertes(true); })
      .observe(document.body || racine, { childList: true });
  } catch (e) {}

  var champ = porte.querySelector("input"), erreur = porte.querySelector(".cmg-error");
  ["keydown", "keyup", "keypress"].forEach(function (ev) { porte.addEventListener(ev, function (e) { e.stopPropagation(); }); });
  champ.addEventListener("input", function () { champ.removeAttribute("aria-invalid"); erreur.textContent = ""; });
  function entrer(h) {
    ecrire({ h: h, t: Date.now() });
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
  /* Première fois avec le serveur : la maîtresse choisit son nouveau code. */
  function choisirNouveauCode(jetonInit) {
    porte.querySelector(".cmg-card").innerHTML = '<p class="cmg-eyebrow">Espace enseignante</p>' +
      '<div class="cmg-head"><label id="ens-label" for="ens-n1">Votre nouveau code</label></div>' +
      '<p class="cmg-text">Avec les comptes des élèves, le code de la maîtresse change une fois pour toutes. ' +
      'Choisissez un nouveau code d\'au moins 6 lettres ou chiffres (les majuscules et les accents ne comptent pas), puis notez-le bien.</p>' +
      '<form novalidate><input id="ens-n1" type="password" autocomplete="new-password" placeholder="Nouveau code" style="flex:1 1 100% !important">' +
      '<input id="ens-n2" type="password" autocomplete="new-password" placeholder="Encore une fois" style="flex:1 1 100% !important"><button type="submit">Valider</button></form>' +
      '<p class="cmg-error" id="ens-error" role="alert"></p>';
    var f = porte.querySelector("form"), e1 = porte.querySelector("#ens-n1"), e2 = porte.querySelector("#ens-n2"), err = porte.querySelector(".cmg-error");
    try { e1.focus(); } catch (x) {}
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var a = normaliser(e1.value), b = normaliser(e2.value);
      if (a.length < 6) { err.textContent = "Au moins 6 lettres ou chiffres."; return; }
      if (a !== b) { err.textContent = "Les deux codes ne sont pas pareils."; e2.value = ""; e2.focus(); return; }
      err.textContent = "";
      window.ENS.init(jetonInit, a).then(function (d) {
        if (d._statut === 200 && d.jeton) { garderJeton(d.jeton); entrer("serveur"); return; }
        err.textContent = d.message || "Impossible d'enregistrer ce code. Réessayez.";
      }, function () { err.textContent = "Pas de connexion internet. Réessayez dans un moment."; });
    });
  }
  porte.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var code = champ.value;
    if (!normaliser(code)) { refuser("Tapez le code."); return; }
    erreur.textContent = "";
    verifier(code).then(function (r) {
      if (r.jeton && r.init) { choisirNouveauCode(r.jeton); return; }
      if (r.jeton) { garderJeton(r.jeton); entrer("serveur"); return; }
      if (r.horsService) {
        var h = empreinte("cm1cm2-ens|" + normaliser(code));
        if (window.ENS_CODES.indexOf(h) >= 0) { entrer(h); return; }
        refuser("Ce code ne marche pas. Vérifiez et réessayez.");
        return;
      }
      refuser(r.message || "Ce code ne marche pas. Vérifiez et réessayez.");
    });
  });
  if (!document.getElementById("cmg-gate")) { try { champ.focus({ preventScroll: true }); } catch (e) {} }
})();
