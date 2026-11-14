/* Crayonnade : la partie « serveur » des comptes élèves (Cloudflare Pages Functions + base D1 liée sous le nom « DB »).
   Toutes les adresses /api/... passent ici. Ne pas modifier à la main : demander à Claude.

   Élèves : un login inventé (jamais le prénom) + un code secret de 4 chiffres. Les points de chaque jeu sont gardés
   ici, pour que l'élève les retrouve sur n'importe quel appareil. Le « name » des profils est toujours le login.
   Comptes « créneau » (élèves de 6e des devoirs faits) : ne marchent que pendant leur créneau (heure de Paris).
   Enseignante : son code n'est vérifié qu'ici (empreinte PBKDF2 dans la base, jamais dans le dépôt, qui est public).
   La toute première fois, l'ancien code de la maîtresse (empreintes ENS_CODES de commun/enseignante.js) permet
   de choisir le nouveau.

   La base se crée toute seule (tables ci-dessous) au premier appel. */

const MINUTE = 60000, HEURE = 60 * MINUTE;
const DUREE_ENS = 3 * HEURE;            // session enseignante
const DUREE_INIT = 15 * MINUTE;         // choix du nouveau code de la maîtresse
const MARGE_AVANT = 10, MARGE_APRES = 5; // minutes de tolérance autour d'un créneau

const TABLES = [
  `CREATE TABLE IF NOT EXISTS comptes (login TEXT PRIMARY KEY, affiche TEXT NOT NULL, sel TEXT NOT NULL,
     empreinte TEXT NOT NULL, creneau TEXT, cree INTEGER NOT NULL, vu INTEGER)`,
  `CREATE TABLE IF NOT EXISTS donnees (login TEXT NOT NULL, jeu TEXT NOT NULL, profil TEXT NOT NULL,
     maj INTEGER NOT NULL, PRIMARY KEY (login, jeu))`,
  `CREATE TABLE IF NOT EXISTS sessions (jeton TEXT PRIMARY KEY, login TEXT NOT NULL, cree INTEGER NOT NULL, fin INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS essais (cle TEXT PRIMARY KEY, n INTEGER NOT NULL, depuis INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS reglages (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)`
];
let basePrete = false;
async function preparer(db) {
  if (basePrete) return;
  await db.batch(TABLES.map(t => db.prepare(t)));
  basePrete = true;
}

/* ---------- Réponses ---------- */
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const erreur = (status, code, message, plus) => json(Object.assign({ erreur: code, message }, plus || {}), status);

/* ---------- Outils ---------- */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const octets = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
const hasard = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; };
const sha256 = async t => hex(await crypto.subtle.digest("SHA-256", enc.encode(t)));
async function pbkdf2(code, selHex, iterations) {
  const cle = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: octets(selHex), iterations }, cle, 256));
}
const nouveauJeton = () => btoa(String.fromCharCode(...hasard(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const normaliserCode = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function cyrb53(t) {
  let a = -559038744, b = 1103547984, i, c;
  for (i = 0; i < t.length; i++) { c = t.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ a >>> 16, 2246822507); a ^= Math.imul(b ^ b >>> 13, 3266489909);
  b = Math.imul(b ^ b >>> 16, 2246822507); b ^= Math.imul(a ^ a >>> 13, 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}

/* Login : lettres sans accent, chiffres, - et _ ; de 3 à 20 caractères, au moins une lettre. */
function lireLogin(brut) {
  const affiche = String(brut || "").trim();
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(affiche) || !/[A-Za-z]/.test(affiche)) return null;
  return { login: affiche.toLowerCase(), affiche };
}
const codeEleveValide = c => /^\d{4}$/.test(String(c || ""));

/* Heure de Paris */
const JOURS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
function paris(d = new Date()) {
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" })
    .formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return { date: `${p.year}-${p.month}-${p.day}`, jour: JOURS[p.weekday], minutes: (+p.hour % 24) * 60 + (+p.minute) };
}
const enMinutes = hm => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
function lireCreneau(c) {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "string") { try { c = JSON.parse(c); } catch (e) { return undefined; } }
  if (!c || !Array.isArray(c.jours)) return undefined;
  const jours = [...new Set(c.jours.map(Number))].filter(j => j >= 1 && j <= 7).sort();
  const d = enMinutes(c.debut), f = enMinutes(c.fin);
  if (!jours.length || !(d >= 0) || !(f > d) || f > 24 * 60) return undefined;
  return { jours, debut: c.debut.padStart(5, "0"), fin: c.fin.padStart(5, "0") };
}
function dansCreneau(c, maintenant = paris()) {
  if (!c) return true;
  return c.jours.includes(maintenant.jour) &&
    maintenant.minutes >= enMinutes(c.debut) - MARGE_AVANT && maintenant.minutes < enMinutes(c.fin) + MARGE_APRES;
}

/* Fusion de deux profils d'un jeu : les bons points des deux côtés sont gardés (un point présent des deux côtés
   ne compte qu'une fois ; des points identiques, comme ceux ajoutés par la maîtresse, gardent leur nombre),
   le reste vient de « prio » (le plus récent). */
function fusionPoints(a, b) {
  const nb = new Map(), tous = [];
  for (const p of a) { const k = JSON.stringify(p); nb.set(k, (nb.get(k) || 0) + 1); tous.push(p); }
  for (const p of b) { const k = JSON.stringify(p); if (nb.get(k) > 0) nb.set(k, nb.get(k) - 1); else tous.push(p); }
  return tous.sort((x, y) => ((x && +x.at) || 0) - ((y && +y.at) || 0));
}
function fusion(base, prio) {
  if (!base || typeof base !== "object") return prio;
  if (!prio || typeof prio !== "object") return base;
  const r = Object.assign({}, base, prio);
  r.points = fusionPoints(Array.isArray(base.points) ? base.points : [], Array.isArray(prio.points) ? prio.points : []);
  return r;
}
function profilValide(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  if (p.points !== undefined && (!Array.isArray(p.points) || p.points.length > 5000)) return false;
  return JSON.stringify(p).length <= 150000;
}
const jeuValide = j => /^[A-Za-z0-9_.-]{2,80}$/.test(String(j || ""));

/* Les codes de la classe et l'ancien code de la maîtresse viennent des fichiers de l'appli (une seule source). */
const memo = {};
async function fichier(env, request, chemin) {
  const m = memo[chemin];
  if (m && Date.now() - m.t < 5 * MINUTE) return m.texte;
  const rep = await env.ASSETS.fetch(new URL(chemin, request.url));
  const texte = rep.ok ? await rep.text() : "";
  memo[chemin] = { t: Date.now(), texte };
  return texte;
}
async function codeClasseValide(env, request, code) {
  const c = normaliserCode(code);
  if (!c) return false;
  const texte = await fichier(env, request, "/commun/commun.js");
  const bloc = (/window\.CMG_CODES\s*=\s*\[([\s\S]*?)\];/.exec(texte) || [])[1] || "";
  const h = cyrb53("cm1cm2|" + c), jour = paris().date;
  const re = /from:\s*"([\d-]+)",\s*to:\s*"([\d-]+)",\s*h:\s*"([a-z0-9]+)"/g;
  let m;
  while ((m = re.exec(bloc))) if (m[3] === h && jour >= m[1] && jour < m[2]) return true;
  return false;
}
async function ancienCodeMaitresse(env, request, code) {
  const texte = await fichier(env, request, "/commun/enseignante.js");
  const bloc = (/window\.ENS_CODES\s*=\s*\[([^\]]*)\]/.exec(texte) || [])[1] || "";
  const liste = (bloc.match(/"([a-z0-9]+)"/g) || []).map(x => x.slice(1, -1));
  return liste.includes(cyrb53("cm1cm2-ens|" + normaliserCode(code)));
}

/* Limite des essais : après « max » échecs, on attend « fenetre ». */
async function bloque(db, cle, max, fenetre) {
  const r = await db.prepare("SELECT n, depuis FROM essais WHERE cle = ?").bind(cle).first();
  return !!(r && Date.now() - r.depuis < fenetre && r.n >= max);
}
async function echec(db, cle, fenetre) {
  const t = Date.now();
  await db.prepare(`INSERT INTO essais (cle, n, depuis) VALUES (?1, 1, ?2) ON CONFLICT(cle) DO UPDATE SET
      n = CASE WHEN ?2 - essais.depuis > ?3 THEN 1 ELSE essais.n + 1 END,
      depuis = CASE WHEN ?2 - essais.depuis > ?3 THEN ?2 ELSE essais.depuis END`).bind(cle, t, fenetre).run();
}
const reussite = (db, cle) => db.prepare("DELETE FROM essais WHERE cle = ?").bind(cle).run();

/* Sessions : on ne garde en base que l'empreinte du jeton. */
async function ouvrirSession(db, login, duree) {
  const jeton = nouveauJeton(), t = Date.now();
  await db.prepare("INSERT INTO sessions (jeton, login, cree, fin) VALUES (?, ?, ?, ?)")
    .bind(await sha256(jeton), login, t, duree ? t + duree : 0).run();
  return jeton;
}
function jetonDe(request) {
  const a = request.headers.get("Authorization") || "";
  return a.startsWith("Bearer ") ? a.slice(7).trim() : "";
}
async function session(db, request, type) {
  const j = jetonDe(request);
  if (!j) return null;
  const r = await db.prepare("SELECT login, fin FROM sessions WHERE jeton = ?").bind(await sha256(j)).first();
  if (!r || (r.fin && r.fin < Date.now())) return null;
  if (type === "ens" ? r.login !== "#ens" : type === "init" ? r.login !== "#init" : r.login.startsWith("#")) return null;
  return r;
}
async function eleve(db, request) {
  const s = await session(db, request, "eleve");
  if (!s) return null;
  const c = await db.prepare("SELECT login, affiche, creneau, vu FROM comptes WHERE login = ?").bind(s.login).first();
  if (!c) return null;
  c.creneau = lireCreneau(c.creneau) || null;
  if (!c.vu || Date.now() - c.vu > HEURE)
    await db.prepare("UPDATE comptes SET vu = ? WHERE login = ?").bind(Date.now(), c.login).run();
  return c;
}
const infosCompte = c => ({ login: c.login, affiche: c.affiche, creneau: c.creneau || null });
const horsCreneau = c => erreur(403, "hors_creneau", "Ton compte ne marche que pendant ton créneau.", { creneau: c.creneau });

async function lireDonnees(db, login) {
  const r = await db.prepare("SELECT jeu, profil, maj FROM donnees WHERE login = ?").bind(login).all();
  const d = {};
  for (const x of r.results || []) { try { d[x.jeu] = { profil: JSON.parse(x.profil), maj: x.maj }; } catch (e) {} }
  return d;
}
async function ecrireJeu(db, compte, jeu, profil, remplacer) {
  const ancien = await db.prepare("SELECT profil FROM donnees WHERE login = ? AND jeu = ?").bind(compte.login, jeu).first();
  let base = null;
  if (ancien) { try { base = JSON.parse(ancien.profil); } catch (e) {} }
  const nouveau = remplacer ? Object.assign({}, profil) : fusion(base, profil);
  if (!Array.isArray(nouveau.points)) nouveau.points = [];
  nouveau.name = compte.affiche; // jamais de prénom côté serveur : le nom du profil est le login
  const maj = Date.now();
  await db.prepare(`INSERT INTO donnees (login, jeu, profil, maj) VALUES (?, ?, ?, ?)
      ON CONFLICT(login, jeu) DO UPDATE SET profil = excluded.profil, maj = excluded.maj`)
    .bind(compte.login, jeu, JSON.stringify(nouveau), maj).run();
  return { profil: nouveau, maj };
}
async function creerCompte(db, l, code, creneau) {
  const sel = hex(hasard(16));
  try {
    await db.prepare("INSERT INTO comptes (login, affiche, sel, empreinte, creneau, cree) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(l.login, l.affiche, sel, await sha256(sel + "|" + code), creneau ? JSON.stringify(creneau) : null, Date.now()).run();
    return true;
  } catch (e) {
    if (/UNIQUE|PRIMARY/i.test(String(e && e.message))) return false;
    throw e;
  }
}

/* ---------- Les adresses ---------- */
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const chemin = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const methode = request.method;
  if (chemin === "etat" && methode === "GET") return json({ ok: !!env.DB });
  if (!env.DB) return erreur(503, "indisponible", "Les comptes ne sont pas encore en service.");
  if (methode !== "GET") {
    const origine = request.headers.get("Origin");
    if (origine && origine !== url.origin) return erreur(403, "origine", "Requête refusée.");
    if (+(request.headers.get("Content-Length") || 0) > 300000) return erreur(413, "trop_gros", "Trop de données.");
  }
  const db = env.DB, ip = request.headers.get("CF-Connecting-IP") || "local";
  let corps = {};
  if (methode === "POST" || methode === "PUT") { try { corps = await request.json(); } catch (e) { corps = {}; } }
  if (!corps || typeof corps !== "object") corps = {};

  try {
    await preparer(db);

    /* ===== Élèves ===== */
    if (chemin === "connexion" && methode === "POST") {
      const l = lireLogin(corps.login);
      if (!l || !codeEleveValide(corps.code)) return erreur(400, "mauvais", "Login ou code incorrect.");
      const cleL = "co:" + l.login, cleIp = "coip:" + ip;
      if (await bloque(db, cleL, 5, 15 * MINUTE) || await bloque(db, cleIp, 30, HEURE))
        return erreur(429, "attente", "Trop d'essais. Attends un quart d'heure et réessaie.");
      const c = await db.prepare("SELECT * FROM comptes WHERE login = ?").bind(l.login).first();
      if (!c || await sha256(c.sel + "|" + corps.code) !== c.empreinte) {
        await echec(db, cleL, 15 * MINUTE); await echec(db, cleIp, HEURE);
        return erreur(401, "mauvais", "Login ou code incorrect.");
      }
      await reussite(db, cleL);
      c.creneau = lireCreneau(c.creneau) || null;
      if (!dansCreneau(c.creneau)) return horsCreneau(c);
      const jeton = await ouvrirSession(db, c.login, 0);
      await db.prepare("UPDATE comptes SET vu = ? WHERE login = ?").bind(Date.now(), c.login).run();
      return json({ jeton, compte: infosCompte(c) });
    }

    if (chemin === "compte" && methode === "POST") {
      const cleIp = "cr:" + ip;
      if (await bloque(db, cleIp, 20, HEURE)) return erreur(429, "attente", "Trop d'essais. Réessaie plus tard.");
      await echec(db, cleIp, HEURE); // chaque création compte, réussie ou non
      if (!await codeClasseValide(env, request, corps.classe))
        return erreur(403, "classe", "Le code de la classe n'est pas bon : demande-le à ta maîtresse.");
      const l = lireLogin(corps.login);
      if (!l) return erreur(400, "login", "Ton login doit avoir de 3 à 20 lettres (sans accent) ou chiffres, avec au moins une lettre.");
      if (!codeEleveValide(corps.code)) return erreur(400, "code", "Ton code secret doit avoir 4 chiffres.");
      if (!await creerCompte(db, l, corps.code, null)) return erreur(409, "pris", "Ce login est déjà pris : invente-en un autre.");
      const jeton = await ouvrirSession(db, l.login, 0);
      return json({ jeton, compte: { login: l.login, affiche: l.affiche, creneau: null } });
    }

    if (chemin === "deconnexion" && methode === "POST") {
      const j = jetonDe(request);
      if (j) await db.prepare("DELETE FROM sessions WHERE jeton = ? AND login NOT LIKE '#%'").bind(await sha256(j)).run();
      return json({ ok: true });
    }

    if (chemin === "moi" && methode === "GET") {
      const c = await eleve(db, request);
      if (!c) return erreur(401, "session", "Reconnecte-toi.");
      if (!dansCreneau(c.creneau)) return horsCreneau(c);
      return json({ compte: infosCompte(c), donnees: await lireDonnees(db, c.login) });
    }

    if (chemin === "jeu" && methode === "PUT") {
      const c = await eleve(db, request);
      if (!c) return erreur(401, "session", "Reconnecte-toi.");
      if (!dansCreneau(c.creneau)) return horsCreneau(c);
      if (!jeuValide(corps.jeu) || !profilValide(corps.profil)) return erreur(400, "donnees", "Données refusées.");
      const existe = await db.prepare("SELECT 1 FROM donnees WHERE login = ? AND jeu = ?").bind(c.login, corps.jeu).first();
      if (!existe) {
        const n = await db.prepare("SELECT COUNT(*) AS n FROM donnees WHERE login = ?").bind(c.login).first();
        if (n && n.n >= 150) return erreur(400, "donnees", "Trop de jeux pour ce compte.");
      }
      return json(await ecrireJeu(db, c, corps.jeu, corps.profil, false));
    }

    /* ===== Enseignante ===== */
    if (chemin === "ens/connexion" && methode === "POST") {
      const cleIp = "ens:" + ip;
      if (await bloque(db, cleIp, 8, 30 * MINUTE)) return erreur(429, "attente", "Trop d'essais. Attendez une demi-heure.");
      await db.prepare("DELETE FROM sessions WHERE fin > 0 AND fin < ?").bind(Date.now()).run();
      await db.prepare("DELETE FROM essais WHERE depuis < ?").bind(Date.now() - 24 * HEURE).run();
      const code = normaliserCode(corps.code);
      const r = await db.prepare("SELECT valeur FROM reglages WHERE cle = 'ens'").first();
      if (r) {
        const v = JSON.parse(r.valeur);
        if (code && await pbkdf2(code, v.sel, v.it) === v.h) {
          await reussite(db, cleIp);
          return json({ jeton: await ouvrirSession(db, "#ens", DUREE_ENS) });
        }
      } else if (code && await ancienCodeMaitresse(env, request, code)) {
        await reussite(db, cleIp);
        return json({ init: true, jeton: await ouvrirSession(db, "#init", DUREE_INIT) });
      }
      await echec(db, cleIp, 30 * MINUTE);
      return erreur(401, "mauvais", "Ce code ne marche pas.");
    }

    if ((chemin === "ens/init" || chemin === "ens/nouveau-code") && methode === "POST") {
      const s = await session(db, request, chemin === "ens/init" ? "init" : "ens");
      if (!s) return erreur(401, "session", "Session terminée : retapez le code.");
      if (chemin === "ens/init" && await db.prepare("SELECT 1 FROM reglages WHERE cle = 'ens'").first())
        return erreur(409, "deja", "Le code de la maîtresse a déjà été choisi.");
      const code = normaliserCode(corps.nouveau);
      if (code.length < 6) return erreur(400, "court", "Le code doit avoir au moins 6 lettres ou chiffres.");
      if (await ancienCodeMaitresse(env, request, code)) return erreur(400, "ancien", "Choisissez un code différent de l'ancien.");
      const sel = hex(hasard(16)), it = 20000;
      const valeur = JSON.stringify({ sel, it, h: await pbkdf2(code, sel, it) });
      await db.prepare("INSERT INTO reglages (cle, valeur) VALUES ('ens', ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur")
        .bind(valeur).run();
      await db.prepare("DELETE FROM sessions WHERE login IN ('#ens', '#init')").run();
      return json({ jeton: await ouvrirSession(db, "#ens", DUREE_ENS) });
    }

    if (chemin.startsWith("ens/")) {
      if (chemin === "ens/deconnexion" && methode === "POST") {
        const j = jetonDe(request);
        if (j) await db.prepare("DELETE FROM sessions WHERE jeton = ? AND login = '#ens'").bind(await sha256(j)).run();
        return json({ ok: true });
      }
      if (!await session(db, request, "ens")) return erreur(401, "session", "Session terminée : retapez le code de la maîtresse.");

      if (chemin === "ens/comptes" && methode === "GET") {
        const comptes = (await db.prepare("SELECT login, affiche, creneau, cree, vu FROM comptes").all()).results || [];
        const donnees = (await db.prepare("SELECT login, jeu, profil FROM donnees").all()).results || [];
        const parCompte = {};
        for (const d of donnees) {
          let p = null; try { p = JSON.parse(d.profil); } catch (e) {}
          const pts = p && Array.isArray(p.points) ? p.points : [];
          const s = parCompte[d.login] || (parCompte[d.login] = { points: 0, ajoutes: 0, jeux: {} });
          s.points += pts.length;
          s.ajoutes += pts.filter(x => x && x.enseignante).length;
          s.jeux[d.jeu] = pts.length;
        }
        return json({
          comptes: comptes.map(c => Object.assign({ login: c.login, affiche: c.affiche, creneau: lireCreneau(c.creneau) || null,
            cree: c.cree, vu: c.vu || null }, parCompte[c.login] || { points: 0, ajoutes: 0, jeux: {} }))
            .sort((a, b) => a.affiche.localeCompare(b.affiche, "fr", { sensitivity: "base" }))
        });
      }

      if (chemin === "ens/comptes" && methode === "POST") {
        const l = lireLogin(corps.login);
        if (!l) return erreur(400, "login", "Le login doit avoir de 3 à 20 lettres (sans accent) ou chiffres, avec au moins une lettre.");
        if (!codeEleveValide(corps.code)) return erreur(400, "code", "Le code secret doit avoir 4 chiffres.");
        const creneau = lireCreneau(corps.creneau);
        if (creneau === undefined) return erreur(400, "creneau", "Créneau incorrect.");
        if (!await creerCompte(db, l, corps.code, creneau)) return erreur(409, "pris", "Ce login existe déjà.");
        return json({ ok: true, login: l.login });
      }

      /* Tous les élèves pour un jeu : l'écran « Espace enseignante » du jeu les affiche (bilans, cartes). */
      if (chemin === "ens/eleves-du-jeu" && methode === "GET") {
        const jeu = url.searchParams.get("jeu");
        if (!jeuValide(jeu)) return erreur(400, "donnees", "Jeu inconnu.");
        const r = (await db.prepare(`SELECT d.login, c.affiche, d.profil FROM donnees d JOIN comptes c ON c.login = d.login
            WHERE d.jeu = ?`).bind(jeu).all()).results || [];
        const profils = {};
        for (const x of r) { try { profils[x.login] = { affiche: x.affiche, profil: JSON.parse(x.profil) }; } catch (e) {} }
        return json({ profils });
      }

      const l = lireLogin(corps.login || url.searchParams.get("login"));
      const c = l && await db.prepare("SELECT login, affiche, creneau, cree, vu FROM comptes WHERE login = ?").bind(l.login).first();
      if (!c) return erreur(404, "inconnu", "Compte introuvable.");
      c.creneau = lireCreneau(c.creneau) || null;

      if (chemin === "ens/compte" && methode === "GET")
        return json({ compte: Object.assign(infosCompte(c), { cree: c.cree, vu: c.vu || null }), donnees: await lireDonnees(db, c.login) });

      if (chemin === "ens/code" && methode === "POST") {
        if (!codeEleveValide(corps.code)) return erreur(400, "code", "Le code secret doit avoir 4 chiffres.");
        const sel = hex(hasard(16));
        await db.batch([
          db.prepare("UPDATE comptes SET sel = ?, empreinte = ? WHERE login = ?").bind(sel, await sha256(sel + "|" + corps.code), c.login),
          db.prepare("DELETE FROM sessions WHERE login = ?").bind(c.login),
          db.prepare("DELETE FROM essais WHERE cle = ?").bind("co:" + c.login)
        ]);
        return json({ ok: true });
      }

      if (chemin === "ens/creneau" && methode === "POST") {
        const creneau = lireCreneau(corps.creneau);
        if (creneau === undefined) return erreur(400, "creneau", "Créneau incorrect.");
        await db.prepare("UPDATE comptes SET creneau = ? WHERE login = ?").bind(creneau ? JSON.stringify(creneau) : null, c.login).run();
        return json({ ok: true });
      }

      if (chemin === "ens/supprimer" && methode === "POST") {
        await db.batch([
          db.prepare("DELETE FROM donnees WHERE login = ?").bind(c.login),
          db.prepare("DELETE FROM sessions WHERE login = ?").bind(c.login),
          db.prepare("DELETE FROM comptes WHERE login = ?").bind(c.login)
        ]);
        return json({ ok: true });
      }

      if (chemin === "ens/jeu" && methode === "PUT") {
        if (!jeuValide(corps.jeu) || !profilValide(corps.profil)) return erreur(400, "donnees", "Données refusées.");
        return json(await ecrireJeu(db, c, corps.jeu, corps.profil, !!corps.remplacer));
      }
    }

    return erreur(404, "adresse", "Adresse inconnue.");
  } catch (e) {
    console.error(e && e.stack || e);
    return erreur(500, "panne", "Petit souci du serveur : réessaie dans un moment.");
  }
}
