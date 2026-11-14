/* Crayonnade (des jeux bien taillés pour le CM1-CM2) : code commun à toutes les pages (portail et jeux).
   Ne pas modifier à la main : demander à Claude.

   1. CMG_CODES : les codes de la classe, une ligne par période (empreintes, pas les codes en clair).
      Pour changer le code, il suffit de modifier cette liste : toutes les pages suivent.
   2. La porte « Code de la classe ».
   3. Le laissez-passer : le portail le transmet aux jeux pour qu'ils ne redemandent pas le code.
   4. Les liens vers les autres pages de l'appli s'ouvrent dans la même fenêtre
      (indispensable une fois l'appli installée sur une tablette).
   0. (ci-dessous) L'ancienne adresse renvoie vers la nouvelle.
   1c et 5. Les comptes élèves (login inventé + code secret) et la synchronisation des bons points. */

/* 0. Ancienne adresse mine-de-rien.pages.dev : on part sur https://crayonnade.pages.dev, même page.
      Pas hors ligne (la nouvelle adresse ne serait pas encore gardée sur l'appareil).
      Les adresses d'essai de Cloudflare (xxxx.mine-de-rien.pages.dev) ne sont pas renvoyées. */
(function () {
  if (location.hostname !== "mine-de-rien.pages.dev" || navigator.onLine === false) return;
  window.CMG_DEMENAGE = true;
  document.documentElement.style.visibility = "hidden";
  location.replace("https://crayonnade.pages.dev" + location.pathname + location.search + location.hash);
})();

window.CMG_CODES = [
  { from: "2026-09-01", to: "2027-01-11", h: "229sbxxdedt" },
  { from: "2026-12-18", to: "2027-03-15", h: "1gxznwzek4g" },
  { from: "2027-02-19", to: "2027-05-10", h: "2enfccympf6" },
  { from: "2027-04-16", to: "2027-09-15", h: "zq0dx8nf4q" },
  { from: "2000-01-01", to: "9999-12-31", h: "24i8vtc8obv" }
];

/* 1b. Les codes APC : valables une heure seulement, créés par la maîtresse dans l'Espace enseignante (outil « Code APC »).
   Un code par tranche de 10 minutes ; il reste valable 6 tranches de plus (entre 60 et 70 minutes après sa création).
   Changer « sel » rend tout de suite caducs tous les codes APC déjà donnés. */
window.CMG_APC = { sel: "kr3KCGlUTblz6IV1", tranche: 600000, duree: 6 };
window.CMG_APC_CODE = function (n) {
  var A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", t = "apc|" + window.CMG_APC.sel + "|" + n, h = 0x811c9dc5, i, c = "";
  for (i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  for (i = 0; i < 4; i++) { c += A[h % A.length]; h = Math.floor(h / A.length); }
  return c;
};
window.CMG_APC_OK = function (code) {
  var a = window.CMG_APC, k, n = Math.floor(Date.now() / a.tranche);
  code = String(code || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) return false;
  for (k = 0; k <= a.duree; k++) {
    if (window.CMG_APC_CODE(n - k) === code) {
      try { localStorage.setItem("cm1cm2-apc-fin", String((n - k + a.duree + 1) * a.tranche)); } catch (e) {}
      return true;
    }
  }
  return false;
};

/* 1c. Les comptes élèves, partie qui doit passer AVANT la porte et AVANT le jeu (voir aussi la section 5).
   Un élève connecté (login inventé + code secret de 4 chiffres) entre sans retaper le code de la classe.
   Compte « créneau » (élèves de 6e) : il n'ouvre l'appli que pendant son créneau (heure de Paris).
   Dans un jeu (window.CMG_JEU, écrit dans la page par integrer_jeu.py) : le profil du login est créé
   s'il manque et choisi, pour que le jeu démarre directement sur l'élève connecté. */
window.CMP = (function () {
  var C = { setItem: Storage.prototype.setItem };
  C.lire = function (k, defaut) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : defaut; } catch (e) { return defaut; }
  };
  C.ecrire = function (k, v) {
    try { if (v === null) localStorage.removeItem(k); else C.setItem.call(localStorage, k, JSON.stringify(v)); } catch (e) {}
  };
  C.store = function (cle) {
    try {
      var v = JSON.parse(localStorage.getItem(cle));
      if (v && typeof v === "object" && v.profiles && typeof v.profiles === "object") return v;
    } catch (e) {}
    return { current: null, profiles: {} };
  };
  C.paris = function () {
    var d = new Date(), p = {};
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return { jour: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday], minutes: (+p.hour % 24) * 60 + (+p.minute) };
    } catch (e) {
      return { jour: d.getDay() || 7, minutes: d.getHours() * 60 + d.getMinutes() };
    }
  };
  C.minutes = function (hm) { var m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  C.dansCreneau = function (c) {
    if (!c || !c.jours) return true;
    var t = C.paris();
    return c.jours.indexOf(t.jour) >= 0 && t.minutes >= C.minutes(c.debut) - 10 && t.minutes < C.minutes(c.fin);
  };
  C.profilNeuf = function (jeu, nom) {
    function remplir(x) {
      if (typeof x === "string") return x.replace("__NOM__", nom);
      if (Array.isArray(x)) return x.map(remplir);
      if (x && typeof x === "object") { var o = {}; for (var k in x) o[k] = remplir(x[k]); return o; }
      return x;
    }
    var p = jeu.profilNeuf ? remplir(jeu.profilNeuf) : { name: nom, points: [] };
    if (!Array.isArray(p.points)) p.points = [];
    return p;
  };

  C.session = C.lire("crayonnade-session", null);
  if (!(C.session && C.session.jeton && C.session.login)) C.session = null;
  if (C.session) {
    if (C.session.creneau && !C.dansCreneau(C.session.creneau)) window.CMG_HORS_CRENEAU = C.session.creneau;
    else window.CMG_ACCES_COMPTE = true;
  }
  var J = window.CMG_JEU;
  if (J && J.stockage && C.session && window.CMG_ACCES_COMPTE) {
    var st = C.store(J.stockage), k = C.session.login;
    if (!st.profiles[k]) st.profiles[k] = C.profilNeuf(J, C.session.affiche);
    st.current = k;
    try { C.setItem.call(localStorage, J.stockage, JSON.stringify(st)); } catch (e) {}
    document.documentElement.className += " cmp-connecte";
  }
  return C;
})();

/* 2. La porte « Code de la classe » (accepte aussi le code APC en cours). Pas de porte pour un élève connecté. */
!function(){if(window.CMG_ACCES_COMPTE||window.CMG_HORS_CRENEAU)return;var e=window.CMG_CODES,t="cm1cm2-code-classe";function r(e){return String(e||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"")}function o(t){var o=r(t);if(!o)return"bad";if(window.CMG_APC_OK&&window.CMG_APC_OK(o))return"ok";for(var a,n,i=function(e){for(var t,r=-559038744,o=1103547984,a=0;a<e.length;a++)t=e.charCodeAt(a),r=Math.imul(r^t,2654435761),o=Math.imul(o^t,1597334677);return r=Math.imul(r^r>>>16,2246822507),r^=Math.imul(o^o>>>13,3266489909),o=Math.imul(o^o>>>16,2246822507),(4294967296*(2097151&(o^=Math.imul(r^r>>>13,3266489909)))+(r>>>0)).toString(36)}("cm1cm2|"+o),c=(a=new Date,n=function(e){return(e<10?"0":"")+e},a.getFullYear()+"-"+n(a.getMonth()+1)+"-"+n(a.getDate())),l=!1,d=0;d<e.length;d++)if(e[d].h===i&&(l=!0,c>=e[d].from&&c<e[d].to))return"ok";return l?"old":"bad"}var a=function(){try{return window.localStorage.getItem(t)||""}catch(e){return""}}();if(!a||"ok"!==o(a)){var n=!!a,i=document.createElement("div");i.id="cmg-gate",i.setAttribute("role","dialog"),i.setAttribute("aria-modal","true"),i.setAttribute("aria-labelledby","cmg-label"),i.setAttribute("aria-describedby","cmg-text"),i.innerHTML='<div class="cmg-card"><p class="cmg-eyebrow">Crayonnade</p><div class="cmg-head"><span class="cmg-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></span><label id="cmg-label" for="cmg-input">Code de la classe</label></div><p class="cmg-text'+(n?" cmg-changed":"")+'" id="cmg-text">'+(n?"Le code a chang\xe9 ! Tape le nouveau code : il est dans ton cahier de liaison.":"Tape le code de la classe pour jouer. Il est dans ton cahier de liaison.")+'</p><form novalidate><input id="cmg-input" name="code" type="text" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="cmg-error"><button type="submit">Entrer</button></form><p class="cmg-error" id="cmg-error" role="alert"></p><p class="cmg-note">Ces jeux sont r\xe9serv\xe9s aux \xe9l\xe8ves de la classe. Merci de ne partager ni le lien ni le code.</p></div>';var c=document.documentElement,l=c.style.overflow;c.style.overflow="hidden",(document.body||c).appendChild(i);var d=i.querySelector("input"),u=i.querySelector(".cmg-error");["keydown","keyup","keypress"].forEach(function(e){i.addEventListener(e,function(e){e.stopPropagation()})}),d.addEventListener("input",function(){d.removeAttribute("aria-invalid"),u.textContent=""}),"loading"===document.readyState?document.addEventListener("DOMContentLoaded",function(){i.isConnected&&s(!0)}):s(!0),i.querySelector("form").addEventListener("submit",function(e){e.preventDefault();var a=o(d.value);if("ok"===a)return function(e){try{window.localStorage.setItem(t,e)}catch(e){}}(r(d.value)),s(!1),i.remove(),void(c.style.overflow=l);d.setAttribute("aria-invalid","true"),u.textContent="old"===a?"Ce code n'est plus valable. Demande le nouveau code.":"Ce code ne marche pas. V\xe9rifie et r\xe9essaie.",d.focus()});try{d.focus({preventScroll:!0})}catch(e){}}function s(e){for(var t=document.body?document.body.children:[],r=0;r<t.length;r++)t[r]!==i&&"SCRIPT"!==t[r].tagName&&"STYLE"!==t[r].tagName&&(e?t[r].setAttribute("inert",""):t[r].removeAttribute("inert"))}}();

/* 3a. Le laissez-passer, côté jeu */
!function(){var t=window.CMG_CODES.map(function(c){return[c.from,c.to,c.h]});function e(t){for(var e,n=-559038744,a=1103547984,o=0;o<t.length;o++)e=t.charCodeAt(o),n=Math.imul(n^e,2654435761),a=Math.imul(a^e,1597334677);return n=Math.imul(n^n>>>16,2246822507),n^=Math.imul(a^a>>>13,3266489909),a=Math.imul(a^a>>>16,2246822507),(4294967296*(2097151&(a^=Math.imul(n^n>>>13,3266489909)))+(n>>>0)).toString(36)}var n=location.hash||"",a=/(?:^#|&)cmg-([a-z0-9]+)/.exec(n),o=a?a[1]:"";if(a)try{var c=n.slice(1).split("&").filter(function(t){return 0!==t.indexOf("cmg-")}).join("&");history.replaceState(history.state,"",location.pathname+location.search+(c?"#"+c:""))}catch(t){}if(!o)try{o=sessionStorage.getItem("cm1cm2-pass")||""}catch(t){}if(o){for(var r,i,m=(r=new Date,i=function(t){return(t<10?"0":"")+t},r.getFullYear()+"-"+i(r.getMonth()+1)+"-"+i(r.getDate())),l=!1,u=0;u<t.length;u++)m>=t[u][0]&&m<t[u][1]&&e("pass|"+t[u][2]+"|"+m)===o&&(l=!0);if(l){try{sessionStorage.setItem("cm1cm2-pass",o)}catch(t){}s(),"loading"===document.readyState&&document.addEventListener("DOMContentLoaded",s)}}function s(){var t=document.getElementById("cmg-gate");t&&(t.remove(),document.documentElement.style.overflow="");for(var e=document.body?document.body.children:[],n=0;n<e.length;n++)e[n].removeAttribute("inert")}}();

/* 3b. Le laissez-passer, côté portail */
!function(){var t="";function e(t){return String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"")}function n(t){for(var e,n=-559038744,r=1103547984,a=0;a<t.length;a++)e=t.charCodeAt(a),n=Math.imul(n^e,2654435761),r=Math.imul(r^e,1597334677);return n=Math.imul(n^n>>>16,2246822507),n^=Math.imul(r^r>>>13,3266489909),r=Math.imul(r^r>>>16,2246822507),(4294967296*(2097151&(r^=Math.imul(n^n>>>13,3266489909)))+(n>>>0)).toString(36)}function r(){var r,a,o=function(){if(t)return t;try{return e(localStorage.getItem("cm1cm2-code-classe")||"")}catch(t){return""}}();return o?n("pass|"+n("cm1cm2|"+o)+"|"+(r=new Date,a=function(t){return(t<10?"0":"")+t},r.getFullYear()+"-"+a(r.getMonth()+1)+"-"+a(r.getDate()))):""}function a(t,e){var n=t.getAttribute("href")||"";!/^[a-z][a-z0-9+.-]*:/i.test(n)&&"#"!==n.charAt(0)&&t.setAttribute("href",n.split("#")[0]+"#cmg-"+e)}function o(){if(!document.getElementById("cmg-gate")){var t=r();if(t)for(var e=document.querySelectorAll("a.game"),n=0;n<e.length;n++)a(e[n],t)}}var c=document.getElementById("cmg-input");c&&c.form&&c.form.addEventListener("submit",function(){document.getElementById("cmg-gate")||(t=e(c.value),o())}),["pointerdown","touchstart","mousedown","focusin","keydown","click"].forEach(function(t){window.addEventListener(t,function(t){var e=t.target&&t.target.closest?t.target.closest("a.game"):null;if(e){var n=r();n&&a(e,n)}},!0)});try{new MutationObserver(o).observe(document.documentElement,{childList:!0,subtree:!0})}catch(t){}"loading"===document.readyState?document.addEventListener("DOMContentLoaded",o):o()}();

/* 3c. Fin d'un code APC : une heure après, la page se recharge et redemande le code, même restée ouverte. */
!function(){function v(){try{var f=+localStorage.getItem("cm1cm2-apc-fin")||0;if(f&&Date.now()>f){localStorage.removeItem("cm1cm2-apc-fin");location.reload()}}catch(e){}}setInterval(v,30000);document.addEventListener("visibilitychange",function(){if(!document.hidden)v()})}();

/* 4. Liens internes dans la même fenêtre */
!function(){document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest('a[target="_blank"]'):null;if(!a)return;var u;try{u=new URL(a.getAttribute("href")||"",location.href)}catch(x){return}if(u.protocol===location.protocol&&u.host===location.host){a.removeAttribute("target");a.removeAttribute("rel")}},!0)}();

/* 5. Les comptes élèves : « Qui joue ? », connexion, création de compte, « Changer de joueur »,
      et la synchronisation des bons points avec le serveur (adresses /api, voir functions/api/).
      Rien de tout cela sur les pages de l'Espace enseignante. Sans serveur (ouverture en fichier, tests,
      panne), l'appli marche comme avant : les bons points restent sur l'appareil. */
(function () {
  var C = window.CMP;
  if (!C || window.CMG_DEMENAGE) return;
  var ENS = /\/enseignante\//.test(location.pathname);
  var JEU = window.CMG_JEU && window.CMG_JEU.stockage ? window.CMG_JEU : null;
  var S = C.session, DEBUT = Date.now(), interaction = false, porte = null;
  var JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  ["pointerdown", "keydown"].forEach(function (ev) { window.addEventListener(ev, function () { interaction = true; }, true); });

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function heure(hm) { var p = String(hm || "").split(":"); return (+p[0]) + " h" + (p[1] && p[1] !== "00" ? " " + p[1] : ""); }
  function texteCreneau(c) {
    if (!c) return "";
    var j = c.jours.map(function (n) { return JOURS[n]; });
    return "le " + (j.length > 1 ? j.slice(0, -1).join(", ") + " et le " + j[j.length - 1] : j[0]) + " de " + heure(c.debut) + " à " + heure(c.fin);
  }
  function api(methode, chemin, corps, jeton, keepalive) {
    if (location.protocol === "file:") return Promise.reject(new Error("fichier"));
    var o = { method: methode, headers: {}, credentials: "same-origin", cache: "no-store" };
    if (corps !== undefined) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(corps); }
    if (jeton) o.headers.Authorization = "Bearer " + jeton;
    if (keepalive) o.keepalive = true;
    return fetch("/api/" + chemin, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { d = d && typeof d === "object" ? d : {}; d._statut = r.status; return d; });
    });
  }

  /* ---------- Les joueurs retenus sur cet appareil ---------- */
  function joueurs() { var l = C.lire("crayonnade-joueurs", []); return Array.isArray(l) ? l : []; }
  function retenir(compte) {
    var l = joueurs().filter(function (j) { return j.login !== compte.login; });
    l.unshift({ login: compte.login, affiche: compte.affiche });
    C.ecrire("crayonnade-joueurs", l.slice(0, 8));
  }
  function oublier(login) { C.ecrire("crayonnade-joueurs", joueurs().filter(function (j) { return j.login !== login; })); }
  function connecte(d) {
    C.ecrire("crayonnade-session", { jeton: d.jeton, login: d.compte.login, affiche: d.compte.affiche, creneau: d.compte.creneau || null });
    C.ecrire("crayonnade-sans-compte", null);
    retenir(d.compte);
  }
  function deconnecter() {
    if (S) api("POST", "deconnexion", {}, S.jeton, true).catch(function () {});
    C.ecrire("crayonnade-session", null);
    S = null;
  }

  /* ---------- La fenêtre des comptes ---------- */
  function inertes(oui) {
    var e = document.body ? document.body.children : [];
    for (var i = 0; i < e.length; i++) {
      if (e[i] === porte || e[i].id === "cmg-gate" || e[i].tagName === "SCRIPT" || e[i].tagName === "STYLE") continue;
      if (oui) e[i].setAttribute("inert", ""); else e[i].removeAttribute("inert");
    }
  }
  function ouvrir(html) {
    if (!porte) {
      porte = document.createElement("div");
      porte.id = "cmp-porte";
      porte.setAttribute("role", "dialog");
      porte.setAttribute("aria-modal", "true");
      porte.setAttribute("aria-labelledby", "cmp-titre");
      ["keydown", "keyup", "keypress"].forEach(function (ev) { porte.addEventListener(ev, function (e) { e.stopPropagation(); }); });
      document.documentElement.style.overflow = "hidden";
      (document.body || document.documentElement).appendChild(porte);
      inertes(true);
    }
    porte.innerHTML = '<div class="cmp-carte"><p class="cmp-sur">Crayonnade</p>' + html + "</div>";
    var f = porte.querySelector("input") || porte.querySelector("button");
    try { if (f) f.focus({ preventScroll: true }); } catch (e) {}
  }
  function fermer() {
    if (!porte) return;
    porte.remove(); porte = null;
    if (!document.getElementById("cmg-gate")) { inertes(false); document.documentElement.style.overflow = ""; }
  }
  function message(texte) { var m = porte && porte.querySelector(".cmp-erreur"); if (m) m.textContent = texte; }
  function occupe(oui) { if (porte) [].forEach.call(porte.querySelectorAll("button"), function (b) { b.disabled = oui; }); }
  function quand(selecteur, ev, f) { var el = porte && porte.querySelector(selecteur); if (el) el.addEventListener(ev, f); }
  function erreurReseau(d) {
    if (d && d.message) return d.message;
    return "Pas de connexion internet. Réessaie dans un moment, ou joue sans compte.";
  }
  var CHAMP_CODE = 'type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••"';
  var CHAMP_LOGIN = 'type="text" maxlength="20" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Par exemple : Juju37"';

  function ecranQui() {
    var l = joueurs(), h = '<h2 class="cmp-titre" id="cmp-titre">Qui joue ?</h2>';
    if (l.length) {
      h += '<p class="cmp-texte">Touche ton login :</p><div class="cmp-joueurs">' +
        l.map(function (j) { return '<button type="button" class="cmp-joueur" data-login="' + esc(j.login) + '">' + esc(j.affiche) + "</button>"; }).join("") + "</div>";
    } else {
      h += '<p class="cmp-texte">Avec ton compte, tu retrouves tes bons points sur tous les appareils : chez toi, chez papi et mamie…</p>';
    }
    h += '<div class="cmp-actions"><button type="button" class="cmp-btn" data-action="creer">Créer mon compte</button>' +
      '<button type="button" class="cmp-btn cmp-btn2" data-action="connexion">J\'ai déjà un compte</button></div>' +
      '<p class="cmp-note"><button type="button" class="cmp-lien" data-action="sans">Jouer sans compte</button> : tes bons points resteront seulement sur cet appareil.</p>';
    ouvrir(h);
    porte.addEventListener("click", function choix(e) {
      var b = e.target.closest && e.target.closest("button");
      if (!b || !porte || !porte.contains(b)) return;
      if (b.dataset.login) { porte.removeEventListener("click", choix); var j = joueurs().filter(function (x) { return x.login === b.dataset.login; })[0]; ecranCode(j); }
      else if (b.dataset.action === "creer") { porte.removeEventListener("click", choix); ecranCreer(); }
      else if (b.dataset.action === "connexion") { porte.removeEventListener("click", choix); ecranConnexion(""); }
      else if (b.dataset.action === "sans") { C.ecrire("crayonnade-sans-compte", 1); fermer(); afficherBadge(); }
    });
  }

  function seConnecter(login, code, retour) {
    occupe(true); message("");
    api("POST", "connexion", { login: login, code: code }).then(function (d) {
      occupe(false);
      if (d._statut === 200 && d.jeton) { connecte(d); location.reload(); return; }
      if (d.erreur === "hors_creneau") { message("Ton compte marche seulement " + texteCreneau(d.creneau) + "."); return; }
      if (d._statut === 404 || d._statut === 503 || !d.erreur) { message(erreurReseau()); return; }
      message(d.message || "Login ou code incorrect.");
      var c = porte && porte.querySelector("[name=code]"); if (c) { c.value = ""; c.focus(); }
    }).catch(function () { occupe(false); message(erreurReseau()); });
  }

  function ecranCode(j) {
    if (!j) { ecranQui(); return; }
    ouvrir('<h2 class="cmp-titre" id="cmp-titre">Bonjour ' + esc(j.affiche) + " !</h2>" +
      '<form class="cmp-form" novalidate><label class="cmp-label" for="cmp-code">Ton code secret</label>' +
      '<div class="cmp-ligne"><input id="cmp-code" name="code" ' + CHAMP_CODE + '><button type="submit" class="cmp-btn">Entrer</button></div></form>' +
      '<p class="cmp-erreur" role="alert"></p>' +
      '<p class="cmp-note"><button type="button" class="cmp-lien" data-retour>← Ce n\'est pas moi</button>' +
      ' · <button type="button" class="cmp-lien" data-oublier>Enlever ce login de cet appareil</button></p>');
    quand("form", "submit", function (e) { e.preventDefault(); seConnecter(j.login, porte.querySelector("[name=code]").value.trim()); });
    quand("[data-retour]", "click", ecranQui);
    quand("[data-oublier]", "click", function () { oublier(j.login); ecranQui(); });
  }

  function ecranConnexion(login, depuisPorteClasse) {
    ouvrir('<h2 class="cmp-titre" id="cmp-titre">J\'ai déjà un compte</h2>' +
      '<form class="cmp-form" novalidate>' +
      '<label class="cmp-label" for="cmp-login">Mon login</label><input id="cmp-login" name="login" ' + CHAMP_LOGIN + ' value="' + esc(login || "") + '">' +
      '<label class="cmp-label" for="cmp-code">Mon code secret</label>' +
      '<div class="cmp-ligne"><input id="cmp-code" name="code" ' + CHAMP_CODE + '><button type="submit" class="cmp-btn">Entrer</button></div></form>' +
      '<p class="cmp-erreur" role="alert"></p>' +
      '<p class="cmp-note"><button type="button" class="cmp-lien" data-retour>' + (depuisPorteClasse ? "← Code de la classe" : "← Retour") + "</button></p>");
    quand("form", "submit", function (e) {
      e.preventDefault();
      var l = porte.querySelector("[name=login]").value.trim(), c = porte.querySelector("[name=code]").value.trim();
      if (!l) { message("Tape ton login."); return; }
      if (!/^\d{4}$/.test(c)) { message("Ton code secret a 4 chiffres."); return; }
      seConnecter(l, c);
    });
    quand("[data-retour]", "click", function () { if (depuisPorteClasse) fermer(); else ecranQui(); });
  }

  function ecranCreer() {
    var classe = "";
    try { classe = localStorage.getItem("cm1cm2-code-classe") || ""; } catch (e) {}
    if (!classe) {
      ouvrir('<h2 class="cmp-titre" id="cmp-titre">Créer mon compte</h2><p class="cmp-texte">Pour créer ton compte, tape d\'abord le code de la classe (il est dans ton cahier de liaison).</p>' +
        '<p class="cmp-note"><button type="button" class="cmp-lien" data-retour>← Retour</button></p>');
      quand("[data-retour]", "click", ecranQui);
      return;
    }
    ouvrir('<h2 class="cmp-titre" id="cmp-titre">Créer mon compte</h2>' +
      '<form class="cmp-form" novalidate>' +
      '<label class="cmp-label" for="cmp-login">Invente ton login</label><input id="cmp-login" name="login" ' + CHAMP_LOGIN + ">" +
      '<p class="cmp-aide">Pas ton prénom ! Des lettres (sans accent) et des chiffres, par exemple Juju37 ou Gastronome58.</p>' +
      '<label class="cmp-label" for="cmp-code">Choisis ton code secret (4 chiffres)</label><input id="cmp-code" name="code" ' + CHAMP_CODE + ">" +
      '<label class="cmp-label" for="cmp-code2">Tape-le encore une fois</label><input id="cmp-code2" name="code2" ' + CHAMP_CODE + ">" +
      '<button type="submit" class="cmp-btn">Créer mon compte</button></form>' +
      '<p class="cmp-erreur" role="alert"></p>' +
      '<p class="cmp-note">Note ton login et ton code dans ton cahier de liaison : tu en auras besoin sur un autre appareil. ' +
      '<button type="button" class="cmp-lien" data-retour>← Retour</button></p>');
    quand("form", "submit", function (e) {
      e.preventDefault();
      var l = porte.querySelector("[name=login]").value.trim(), c = porte.querySelector("[name=code]").value.trim(),
        c2 = porte.querySelector("[name=code2]").value.trim();
      if (!/^[A-Za-z0-9_-]{3,20}$/.test(l) || !/[A-Za-z]/.test(l)) { message("Ton login : de 3 à 20 lettres (sans accent) ou chiffres, avec au moins une lettre."); return; }
      if (!/^\d{4}$/.test(c)) { message("Ton code secret doit avoir 4 chiffres."); return; }
      if (c !== c2) { message("Les deux codes ne sont pas pareils. Recommence."); porte.querySelector("[name=code2]").value = ""; return; }
      occupe(true); message("");
      api("POST", "compte", { classe: classe, login: l, code: c }).then(function (d) {
        occupe(false);
        if (d._statut === 200 && d.jeton) { connecte(d); ecranPret(d.compte, c); return; }
        if (d._statut === 404 || d._statut === 503 || !d.erreur) { message(erreurReseau()); return; }
        message(d.message || "Impossible de créer le compte.");
      }).catch(function () { occupe(false); message(erreurReseau()); });
    });
    quand("[data-retour]", "click", ecranQui);
  }

  function ecranPret(compte, code) {
    ouvrir('<h2 class="cmp-titre" id="cmp-titre">Ton compte est prêt !</h2>' +
      '<p class="cmp-texte">Ton login : <b class="cmp-gros">' + esc(compte.affiche) + '</b><br>Ton code secret : <b class="cmp-gros">' + esc(code) + "</b></p>" +
      '<p class="cmp-texte">Recopie-les dans ton cahier de liaison. Sur cet appareil, tu n\'auras plus rien à taper.</p>' +
      '<button type="button" class="cmp-btn" data-ok>C\'est parti !</button>');
    quand("[data-ok]", "click", function () { location.reload(); });
  }

  function ecranCreneau(c) {
    ouvrir('<h2 class="cmp-titre" id="cmp-titre">À bientôt !</h2>' +
      '<p class="cmp-texte">Ton compte <b>' + esc(S ? S.affiche : "") + "</b> marche seulement " + esc(texteCreneau(c)) + ".</p>" +
      '<p class="cmp-note"><button type="button" class="cmp-lien" data-changer>Changer de joueur</button></p>');
    quand("[data-changer]", "click", function () { deconnecter(); location.reload(); });
  }

  /* ---------- Le badge « Juju37 · Changer de joueur » ---------- */
  function afficherBadge() {
    if (ENS || !document.body) return;
    var ancien = document.getElementById("cmp-joueur");
    if (ancien) ancien.remove();
    var portail = !JEU && !!document.querySelector("#view, a.game, .subjects");
    if (!S && !(portail && C.lire("crayonnade-sans-compte", null))) return;
    var b = document.createElement("div");
    b.id = "cmp-joueur";
    b.innerHTML = S
      ? '<span class="cmp-qui"><span aria-hidden="true">👤</span> ' + esc(S.affiche) + '</span><button type="button" data-changer>Changer de joueur</button>'
      : '<button type="button" data-qui>Se connecter</button>';
    b.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("button");
      if (!t) return;
      if (t.hasAttribute("data-changer")) { deconnecter(); afficherBadge(); ecranQui(); }
      else { C.ecrire("crayonnade-sans-compte", null); ecranQui(); }
    });
    var nav = document.getElementById("allgames");
    if (nav) { b.className = "cmp-dans-nav"; nav.appendChild(b); }
    else { b.className = "cmp-flottant"; document.body.appendChild(b); }
  }

  /* ---------- Synchronisation des bons points ---------- */
  function fusion(base, prio) {
    if (!base || typeof base !== "object") return prio;
    if (!prio || typeof prio !== "object") return base;
    /* Mêmes règles que le serveur : les points des deux côtés, sans compter deux fois un même point. */
    var r = {}, k, nb = {}, pts = [];
    for (k in base) r[k] = base[k];
    for (k in prio) r[k] = prio[k];
    (Array.isArray(base.points) ? base.points : []).forEach(function (p) { var c = JSON.stringify(p); nb[c] = (nb[c] || 0) + 1; pts.push(p); });
    (Array.isArray(prio.points) ? prio.points : []).forEach(function (p) { var c = JSON.stringify(p); if (nb[c] > 0) nb[c]--; else pts.push(p); });
    pts.sort(function (a, b) { return ((a && +a.at) || 0) - ((b && +b.at) || 0); });
    r.points = pts;
    return r;
  }
  function photos() { var t = C.lire("crayonnade-sync", {}); return (t && t[S.login]) || {}; }
  function photographier(jeu, maj, profil) {
    var t = C.lire("crayonnade-sync", {});
    if (!t || typeof t !== "object") t = {};
    if (!t[S.login]) t[S.login] = {};
    t[S.login][jeu] = { maj: maj, json: JSON.stringify(profil) };
    C.ecrire("crayonnade-sync", t);
  }
  function profilLocal(jeu) { return C.store(jeu).profiles[S.login] || null; }
  function ecrireProfil(jeu, profil) {
    var st = C.store(jeu);
    st.profiles[S.login] = profil;
    st.current = S.login;
    try { C.setItem.call(localStorage, jeu, JSON.stringify(st)); } catch (e) {}
  }
  function sessionPerdue() { deconnecter(); location.reload(); }

  function pousser(jeu, keepalive) {
    if (!S) return;
    var p = profilLocal(jeu);
    if (!p) return;
    var js = JSON.stringify(p), photo = photos()[jeu];
    if (photo && photo.json === js) return;
    api("PUT", "jeu", { jeu: jeu, profil: p }, S.jeton, keepalive).then(function (d) {
      if (d._statut === 200 && d.profil) {
        var loc = profilLocal(jeu);
        if (loc && JSON.stringify(loc) === js && JSON.stringify(d.profil) !== js) ecrireProfil(jeu, d.profil);
        photographier(jeu, d.maj, d.profil);
      } else if (d._statut === 401) sessionPerdue();
      else if (d._statut === 403 && d.erreur === "hors_creneau") ecranCreneau(d.creneau || (S && S.creneau));
    }).catch(function () { /* hors ligne : ce sera envoyé la prochaine fois */ });
  }

  function tirer() {
    return api("GET", "moi", undefined, S.jeton).then(function (d) {
      if (d._statut === 401) { sessionPerdue(); return; }
      if (d._statut === 403 && d.erreur === "hors_creneau") { ecranCreneau(d.creneau || S.creneau); return; }
      if (d._statut !== 200 || !d.donnees) return;
      if (d.compte && (d.compte.affiche !== S.affiche || JSON.stringify(d.compte.creneau || null) !== JSON.stringify(S.creneau || null))) {
        S.affiche = d.compte.affiche; S.creneau = d.compte.creneau || null; C.ecrire("crayonnade-session", S);
      }
      var ph = photos(), aEnvoyer = [], jeuChange = false;
      Object.keys(d.donnees).forEach(function (jeu) {
        var r = d.donnees[jeu], st = C.store(jeu), loc = st.profiles[S.login], avant = loc ? JSON.stringify(loc) : null, neuf = loc;
        if (!loc) { neuf = r.profil; photographier(jeu, r.maj, r.profil); }
        else if (ph[jeu] && avant === ph[jeu].json) { if (r.maj > ph[jeu].maj) { neuf = r.profil; photographier(jeu, r.maj, r.profil); } }
        else { neuf = fusion(r.profil, loc); aEnvoyer.push(jeu); }
        if (JSON.stringify(neuf) !== avant || st.current !== S.login) {
          ecrireProfil(jeu, neuf);
          if (JEU && jeu === JEU.stockage && JSON.stringify(neuf) !== avant) jeuChange = true;
        }
      });
      /* Bons points gagnés ici et jamais envoyés (hors ligne, ou avant la connexion au serveur) */
      var connus = (window.JEUX || []).map(function (j) { return j.stockage; }).filter(Boolean);
      if (JEU) connus.push(JEU.stockage);
      connus.forEach(function (jeu) {
        if (d.donnees[jeu] || aEnvoyer.indexOf(jeu) >= 0) return;
        var p = profilLocal(jeu);
        if (p && Array.isArray(p.points) && p.points.length) aEnvoyer.push(jeu);
      });
      aEnvoyer.forEach(function (jeu) { pousser(jeu); });
      /* Le jeu ouvert vient de recevoir des bons points gagnés ailleurs : on le recharge une fois, s'il n'a pas commencé. */
      var marque = "crayonnade-recharge:" + location.pathname;
      if (jeuChange && !interaction && Date.now() - DEBUT < 8000) {
        var deja = false;
        try { deja = sessionStorage.getItem(marque) === "1"; sessionStorage.setItem(marque, "1"); } catch (e) {}
        if (!deja) location.reload();
      }
    }).catch(function () {});
  }

  /* Les bons points écrits par le jeu partent vers le serveur (1,5 s après la dernière écriture, ou en quittant la page). */
  if (S && window.CMG_ACCES_COMPTE && JEU) {
    var minuteur = null;
    var envoyer = function (vite) { if (minuteur) { clearTimeout(minuteur); minuteur = null; pousser(JEU.stockage, vite); } };
    Storage.prototype.setItem = function (k) {
      C.setItem.apply(this, arguments);
      if (this === window.localStorage && k === JEU.stockage && S) {
        if (minuteur) clearTimeout(minuteur);
        minuteur = setTimeout(function () { minuteur = null; pousser(JEU.stockage); }, 1500);
      }
    };
    window.addEventListener("pagehide", function () { envoyer(true); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) envoyer(true); });
  }

  /* ---------- Au chargement ---------- */
  function proposerComptes() {
    if (ENS || S || window.CMG_HORS_CRENEAU || C.lire("crayonnade-sans-compte", null) || navigator.onLine === false) return;
    api("GET", "etat").then(function (d) { if (d._statut === 200 && d.ok && !S && !document.getElementById("cmg-gate")) ecranQui(); }).catch(function () {});
  }
  function lienPorteClasse() {
    var g = document.getElementById("cmg-gate"), carte = g && g.querySelector(".cmg-card");
    if (!carte || carte.querySelector(".cmg-compte")) return;
    var p = document.createElement("p");
    p.className = "cmg-compte";
    p.innerHTML = '<a href="#" role="button">J\'ai un compte (login et code secret)</a>';
    var note = carte.querySelector(".cmg-note");
    carte.insertBefore(p, note || null);
    p.querySelector("a").addEventListener("click", function (e) { e.preventDefault(); ecranConnexion("", true); });
    /* Quand la porte s'ouvre avec le code de la classe : on propose les comptes. */
    var form = g.querySelector("form");
    if (form) form.addEventListener("submit", function () { setTimeout(function () { if (!document.getElementById("cmg-gate")) proposerComptes(); }, 0); });
  }
  function demarrer() {
    if (window.CMG_HORS_CRENEAU) { ecranCreneau(window.CMG_HORS_CRENEAU); return; }
    if (!ENS && document.getElementById("cmg-gate")) lienPorteClasse();
    afficherBadge();
    if (S && !ENS) {
      tirer();
      window.addEventListener("online", tirer);
      if (S.creneau) setInterval(function () { if (!C.dansCreneau(S.creneau)) location.reload(); }, 30000);
    } else proposerComptes();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();
})();
