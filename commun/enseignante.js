/* Crayonnade : la porte « Code de la maîtresse », chargée par les outils de l'enseignante (enseignante/…),
   après commun.js. Ne pas modifier à la main : demander à Claude.

   ENS_CODES : les empreintes du code de la maîtresse (jamais le code en clair).
   Le code n'est retenu que dans cet onglet (sessionStorage), et 20 minutes après la dernière action :
   la maîtresse peut donc s'en servir sur la tablette d'un élève sans que l'élève y ait accès ensuite.
   Le bouton « Verrouiller » referme l'espace tout de suite. */
window.ENS_CODES = ["1qpuhkkjl3o"];

(function () {
  var CLE = "cm1cm2-ens", DUREE = 20 * 60 * 1000;
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
    return !!(v && window.ENS_CODES.indexOf(v.h) >= 0 && Date.now() - v.t < DUREE);
  }
  function verrouiller() { ecrire(null); location.reload(); }

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
  porte.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var h = empreinte("cm1cm2-ens|" + normaliser(champ.value));
    if (window.ENS_CODES.indexOf(h) >= 0) {
      ecrire({ h: h, t: Date.now() });
      inertes(false);
      porte.remove();
      racine.style.overflow = debordement;
      surveiller();
      return;
    }
    champ.setAttribute("aria-invalid", "true");
    erreur.textContent = "Ce code ne marche pas. Vérifiez et réessayez.";
    champ.value = "";
    champ.focus();
  });
  if (!document.getElementById("cmg-gate")) { try { champ.focus({ preventScroll: true }); } catch (e) {} }
})();
