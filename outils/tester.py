#!/usr/bin/env python3
"""Teste toute l'appli dans un navigateur sans interface (Playwright + Chrome/Chromium).

  python3 outils/tester.py

Le script travaille sur une copie de l'appli, où il ajoute un code de classe de test (TEST) :
l'appli elle-même n'est pas modifiée. Il vérifie le code de la classe, la navigation, chaque jeu
(chargement sans erreur, bouton « Tous les jeux », polices), l'absence de requêtes vers l'extérieur
et le mode hors ligne.
"""
import functools, http.server, json, os, re, shutil, socket, sys, tempfile, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

RACINE = Path(__file__).resolve().parent.parent
COPIE = Path(tempfile.mkdtemp(prefix="jeux-test-")) / "appli"
shutil.copytree(RACINE, COPIE, ignore=shutil.ignore_patterns(".git", "outils"))
# code de test : TEST (empreinte de "cm1cm2|TEST")
cjs = COPIE / "commun" / "commun.js"
cjs.write_text(cjs.read_text(encoding="utf8").replace(
    "window.CMG_CODES = [\n", 'window.CMG_CODES = [\n  { from: "2000-01-01", to: "9999-12-31", h: "25tsvmh4xsg" },\n', 1), encoding="utf8")
# code de la maîtresse de test : TEST-ENS (empreinte de "cm1cm2-ens|TESTENS")
ejs = COPIE / "commun" / "enseignante.js"
if ejs.exists():
    ejs.write_text(ejs.read_text(encoding="utf8").replace('window.ENS_CODES = [', 'window.ENS_CODES = ["1558pk3wljr", ', 1), encoding="utf8")
with socket.socket() as so:
    so.bind(("127.0.0.1", 0)); PORT = so.getsockname()[1]
class CommeCloudflare(http.server.SimpleHTTPRequestHandler):
    """Sert l'appli comme Cloudflare Pages : « .../index.html » est redirigé vers « .../ »."""
    def log_message(self, *a):
        pass

    def api_absente(self):
        """Pas de serveur des comptes ici : /api répond « hors service », l'appli marche sur l'appareil seulement
        (les comptes élèves sont testés à part, par outils/tester_comptes.py)."""
        corps = b'{"ok": false}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_POST(self):
        return self.api_absente() if self.path.startswith("/api/") else self.send_error(405)

    def do_PUT(self):
        return self.do_POST()

    def do_GET(self):
        chemin, _, requete = self.path.partition("?")
        if chemin.startswith("/api/"):
            return self.api_absente()
        if chemin.endswith("/index.html"):
            self.send_response(308)
            self.send_header("Location", chemin[:-len("index.html")] + ("?" + requete if requete else ""))
            self.end_headers()
            return
        return super().do_GET()
Handler = functools.partial(CommeCloudflare, directory=str(COPIE))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

BASE = f"http://localhost:{PORT}/"
CHROME = next((c for c in ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"] if os.path.exists(c)), None)
jeux = json.loads(re.search(r"window\.JEUX = (\[.*\]);", (COPIE / "jeux.js").read_text(encoding="utf8"), re.S).group(1))
problems = []

def ouvrir_ens(pg, code="test-ens"):
    """Tape le code de la maîtresse ; la porte vérifie d'abord auprès du serveur, puis se ferme (ou affiche une erreur)."""
    pg.fill("#ens-input", code); pg.click("#ens-gate button")
    try:
        pg.wait_for_function("() => !document.getElementById('ens-gate') || document.getElementById('ens-error').textContent.trim()", timeout=5000)
    except Exception:
        pass

def ok(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        problems.append(msg)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"]) if CHROME else p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 820, "height": 1180}, locale="fr-FR")
    external, failed, errors = [], [], []
    ctx.on("request", lambda r: external.append(r.url) if not r.url.startswith(("http://localhost", "data:", "blob:")) else None)
    ctx.on("requestfailed", lambda r: failed.append(r.url))
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(("portail", str(e))))

    print("1. Portail et code de la classe")
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    ok(page.locator("#cmg-gate").is_visible(), "la porte du code s'affiche")
    page.fill("#cmg-input", "ABCD")
    page.click("#cmg-gate button")
    ok(page.locator("#cmg-error").inner_text().strip() != "", "un mauvais code est refusé")
    page.fill("#cmg-input", "test")
    page.click("#cmg-gate button")
    ok(page.locator("#cmg-gate").count() == 0, "le bon code ouvre le portail")
    ok(page.locator(".subjects .card").count() == 2, "deux matières à l'accueil")
    txt = page.locator(".subjects").inner_text()
    print("    ", txt.replace("\n", " | "))
    
    print("2. Navigation Maths > Calcul mental > un jeu > retour")
    page.click('a.card[href="#maths"]')
    page.wait_for_selector('a.card[href="#calcul-mental"]')
    page.click('a.card[href="#calcul-mental"]')
    page.wait_for_selector("a.game")
    n = page.locator("a.game").count()
    ok(n == sum(1 for j in jeux if j["domaine"] == "calcul-mental"), f"{n} jeux en calcul mental")
    ok(page.locator("a.game[target]").count() == 0, "les jeux s'ouvrent dans la même fenêtre")
    with page.expect_navigation():
        page.locator("a.game").nth(2).click()
    ok("/jeux/" in page.url, "le jeu s'ouvre : " + page.url.replace(BASE, ""))
    page.wait_for_load_state("networkidle")
    ok(page.locator("#cmg-gate").count() == 0, "le jeu ne redemande pas le code")
    with page.expect_navigation():
        page.click("#allgames a")
    page.wait_for_selector("a.game")
    ok(page.url.endswith("#calcul-mental") and page.locator("a.game").count() == n, "« Tous les jeux » ramène au domaine")
    ok(len(ctx.pages) == 1, "pas de nouvel onglet")

    print("3. Liens internes en target=_blank : même fenêtre")
    page.evaluate("""() => { const a = document.createElement('a'); a.href = 'jeux/""" + jeux[0]["slug"] + """/index.html'; a.target = '_blank'; a.id = 'tlink'; a.textContent = 'x'; document.body.appendChild(a); }""")
    with page.expect_navigation():
        page.click("#tlink")
    ok("/jeux/" + jeux[0]["slug"] in page.url and len(ctx.pages) == 1, "lien interne ouvert dans la même fenêtre")

    print("4. Chaque jeu se charge sans erreur")
    for j in jeux:
        errs = []
        pg = ctx.new_page()
        pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
        pg.on("console", lambda m, errs=errs: errs.append("console: " + m.text) if m.type == "error" else None)
        pg.goto(BASE + "jeux/" + j["slug"] + "/index.html")
        pg.wait_for_load_state("networkidle")
        gate = pg.locator("#cmg-gate").count()
        back = pg.get_attribute("#allgames a", "href")
        fonts = pg.evaluate("() => document.fonts.check('800 20px \"Baloo 2\"') && document.fonts.check('400 16px Lexend')")
        title = pg.title()
        visible = pg.evaluate("() => document.body.innerText.trim().length")
        good = gate == 0 and back == "../../index.html#" + j["domaine"] and not errs and visible > 50 and title == j["titre"]
        ok(good, f"{j['slug']:<45} porte={gate} retour={back} polices={fonts} texte={visible} erreurs={errs[:2]}")
        pg.close()

    outils = sorted(d.name for d in (COPIE / "enseignante").glob("*") if (d / "index.html").exists()) if (COPIE / "enseignante").exists() else []
    if outils:
        print("4b. Outils de l'enseignante (code de la maîtresse)")
        page.goto(BASE + "index.html")
        ok(page.locator(".ens-outils a").count() == len(outils), f"{len(outils)} outil(s) dans l'Espace enseignante")
        for slug in outils:
            errs = []
            pg = ctx.new_page()
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            pg.on("console", lambda m, errs=errs: errs.append("console: " + m.text) if m.type == "error" else None)
            pg.goto(BASE + "enseignante/" + slug + "/index.html")
            pg.wait_for_load_state("networkidle")
            porte = pg.locator("#ens-gate").is_visible()
            ouvrir_ens(pg, "MAUVAIS-CODE")
            refus = pg.locator("#ens-gate").count() == 1 and pg.inner_text("#ens-error").strip() != ""
            pg.evaluate("document.getElementById('ens-error').textContent = ''")
            ouvrir_ens(pg)
            ouvert = pg.locator("#ens-gate").count() == 0 and pg.locator("#ens-lock").count() == 1
            back = pg.get_attribute("#allgames a", "href")
            ok(porte and refus and ouvert and back == "../../index.html" and not errs,
               f"{slug:<45} porte={porte} refus={refus} ouvert={ouvert} retour={back} erreurs={errs[:2]}")
            pg.close()

        if "ajouter-des-bons-points" in outils and "verifier-une-carte-de-bons-points" in outils:
            print("4c. Ajouter des bons points, puis vérifier les cartes")
            errs = []
            pg = ctx.new_page()
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            pg.goto(BASE + "enseignante/ajouter-des-bons-points/index.html")
            ouvrir_ens(pg)
            pg.fill("#nom", "Léa Test")
            essais = [j for j in jeux if j.get("sel")]
            choix = [essais[0]] + [j for j in essais if j.get("cle") == "apos"][:1]
            for j in choix:
                pg.fill("#aj-" + j["slug"], "12")
            pg.click("#enregistrer")
            bilan = pg.inner_text("#bilan")
            ok(f"{12 * len(choix)} bons points ajoutés" in bilan, "enregistrement : " + bilan)
            for j in choix:
                ligne = pg.locator(f'.jeu[data-slug="{j["slug"]}"]')
                code = re.search(r"n°1 \(code ([A-Z0-9]{4})\)", ligne.inner_text())
                ok(bool(code) and "12 bons points ici" in ligne.inner_text(), f"{j['slug']} : 12 bons points, carte n°1 " + (code.group(1) if code else "sans code"))
                if code:
                    pg.goto(BASE + "enseignante/verifier-une-carte-de-bons-points/index.html")
                    pg.fill("#tName", "Léa Test"); pg.fill("#tCard", "1"); pg.fill("#tCode", code.group(1))
                    pg.click("button[type=submit]"); pg.wait_for_timeout(300)
                    ok("Carte valide" in pg.inner_text("#result"), f"{j['slug']} : la vérification reconnaît le code {code.group(1)}")
                    pg.goto(BASE + "jeux/" + j["slug"] + "/index.html"); pg.wait_for_load_state("networkidle")
                    texte = pg.inner_text("body")
                    ok("NaN" not in texte and "undefined" not in texte, f"{j['slug']} : le jeu affiche les bons points sans erreur")
                    pg.goto(BASE + "enseignante/ajouter-des-bons-points/index.html")
                    pg.fill("#nom", "Léa Test")
            pg.click("[data-retirer]")
            ok("retiré" in pg.inner_text("#bilan"), "« Retirer mes ajouts » : " + pg.inner_text("#bilan"))
            pg.click("#ens-lock"); pg.wait_for_load_state("load")
            ok(pg.locator("#ens-gate").count() == 1, "« Verrouiller » referme l'espace")
            ok(not errs, "aucune erreur dans les outils " + str(errs[:2]))
            pg.close()

    if "code-apc" in outils:
        print("4e. Code APC d'une heure")
        pg = ctx.new_page()
        pg.goto(BASE + "enseignante/code-apc/index.html")
        ouvrir_ens(pg)
        code = pg.inner_text("#code").strip()
        ok(len(code) == 4 and "Valable jusqu" in pg.inner_text("#fin"), f"code APC affiché : {code}, " + pg.inner_text("#fin"))
        pg.close()
        c2 = browser.new_context()
        el = c2.new_page()
        el.clock.install()
        el.goto(BASE + "index.html")
        el.fill("#cmg-input", code); el.click("#cmg-gate button")
        ok(el.locator("#cmg-gate").count() == 0, "le code APC ouvre l'appli")
        el.goto(BASE + "jeux/" + jeux[0]["slug"] + "/index.html"); el.wait_for_load_state("load")
        ok(el.locator("#cmg-gate").count() == 0, "le code APC ouvre aussi les jeux")
        el.clock.fast_forward("55:00"); el.reload(); el.wait_for_load_state("load")
        ok(el.locator("#cmg-gate").count() == 0, "toujours valable 55 minutes plus tard")
        el.clock.fast_forward("16:00"); el.wait_for_timeout(1500); el.wait_for_load_state("load")
        ok(el.locator("#cmg-gate").count() == 1, "71 minutes plus tard, la page restée ouverte redemande le code")
        el.fill("#cmg-input", code); el.click("#cmg-gate button")
        ok(el.locator("#cmg-gate").count() == 1, "le code APC périmé est refusé")
        c2.close()

    print("4d. Chaque jeu accepte les bons points ajoutés par l'enseignante")
    import unicodedata
    def cle_profil(j, nom):
        if j.get("cle") == "apos":
            nom = nom.replace("’", "'").replace("`", "'")
        nom = "".join(c for c in unicodedata.normalize("NFD", nom) if not unicodedata.combining(c))
        return re.sub(r"\s+", " ", nom.lower()).strip()
    POINT = {"at": 1794400000000, "ms": 60000, "level": 0, "score": "reporté", "parcours": "jaune", "parc": "jaune", "enseignante": True}
    pbs = []
    for j in jeux:
        if not j.get("profilNeuf"):
            pbs.append(j["slug"] + " (profil inconnu)"); continue
        prof = json.loads(json.dumps(j["profilNeuf"]).replace("__NOM__", "Zoé Essai"))
        prof["points"] = [POINT] * 12
        k = cle_profil(j, "Zoé Essai")
        errs = []
        pg = ctx.new_page()
        pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
        pg.goto(BASE + "jeux/" + j["slug"] + "/index.html")
        avant = pg.evaluate("key => localStorage.getItem(key)", j["stockage"])
        pg.evaluate("([key, st]) => localStorage.setItem(key, JSON.stringify(st))", [j["stockage"], {"current": k, "profiles": {k: prof}}])
        pg.reload(); pg.wait_for_load_state("networkidle")
        texte = pg.inner_text("body")
        if errs or "NaN" in texte or "undefined" in texte:
            pbs.append(j["slug"] + " " + str(errs[:1]) + (" NaN" if "NaN" in texte else "") + (" undefined" if "undefined" in texte else ""))
        pg.evaluate("([key, v]) => v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v)", [j["stockage"], avant])
        pg.close()
    ok(not pbs, f"{len(jeux) - len(pbs)} / {len(jeux)} jeux affichent les bons points ajoutés" + ("" if not pbs else " ; problèmes : " + "; ".join(pbs[:5])))

    print("5. Ressources")
    ok(not external, "aucune requête vers l'extérieur" + ("" if not external else " : " + ", ".join(sorted(set(external))[:5])))
    ok(not failed, "aucune ressource manquante" + ("" if not failed else " : " + ", ".join(sorted(set(failed))[:5])))
    ok(not errors, "aucune erreur sur le portail " + str(errors[:2]))

    print("6. Hors ligne (service worker)")
    page.goto(BASE + "index.html")
    page.evaluate("() => navigator.serviceWorker.ready.then(() => true)")
    page.wait_for_timeout(1500)
    page.reload()
    ctrl = page.evaluate("() => !!navigator.serviceWorker.controller")
    ok(ctrl, "le service worker contrôle la page")
    cached = page.evaluate("() => caches.keys().then(k => Promise.all(k.map(n => caches.open(n).then(c => c.keys())))).then(a => a.flat().length)")
    ok(cached >= len(jeux) + 10, f"{cached} fichiers gardés sur l'appareil")
    ctx.set_offline(True)
    pg = ctx.new_page()
    pg.goto(BASE + "jeux/" + jeux[-1]["slug"] + "/index.html")
    ok(pg.title() == jeux[-1]["titre"], "un jeu jamais ouvert se charge hors ligne")
    pg.goto(BASE + "jeux/" + jeux[0]["slug"] + "/")
    ok(pg.title() == jeux[0]["titre"], "un jeu se charge hors ligne par son adresse courte")
    pg.goto(BASE + "index.html#francais")
    ok(pg.locator("a.card").count() >= 1, "le portail marche hors ligne")
    ctx.set_offline(False)
    browser.close()

srv.shutdown()
shutil.rmtree(COPIE.parent, ignore_errors=True)
print("\nRÉSULTAT :", "tout est bon" if not problems else f"{len(problems)} problème(s)")
sys.exit(1 if problems else 0)
