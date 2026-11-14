#!/usr/bin/env python3
"""Teste les comptes élèves avec un vrai serveur local (wrangler pages dev + base D1 locale, vide à chaque fois).

  python3 outils/tester_comptes.py [--wrangler CHEMIN]

Il faut wrangler (npm i wrangler) : par défaut ~/dev/node_modules/.bin/wrangler, ou `npx wrangler`.
Codes de test injectés dans la copie : classe « TEST », maîtresse « TEST-ENS » (puis « NOUVEAU123 »).
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

RACINE = Path(__file__).resolve().parent.parent
p = argparse.ArgumentParser()
p.add_argument("--wrangler", default=str(Path.home() / "dev/node_modules/.bin/wrangler"))
a = p.parse_args()
WRANGLER = [a.wrangler] if os.path.exists(a.wrangler) else ["npx", "wrangler"]

tmp = Path(tempfile.mkdtemp(prefix="comptes-"))
COPIE = tmp / "appli"
shutil.copytree(RACINE, COPIE, ignore=shutil.ignore_patterns(".git", "__pycache__", ".wrangler", "node_modules"))
cjs = COPIE / "commun" / "commun.js"
cjs.write_text(cjs.read_text(encoding="utf8").replace("window.CMG_CODES = [", 'window.CMG_CODES = [\n  { from: "2000-01-01", to: "9999-12-31", h: "25tsvmh4xsg" },', 1), encoding="utf8")
ejs = COPIE / "commun" / "enseignante.js"
ejs.write_text(ejs.read_text(encoding="utf8").replace("window.ENS_CODES = [", 'window.ENS_CODES = ["1558pk3wljr", ', 1), encoding="utf8")

with socket.socket() as so:
    so.bind(("127.0.0.1", 0)); PORT = so.getsockname()[1]
journal = open(tmp / "wrangler.log", "w")
serveur = subprocess.Popen(WRANGLER + ["pages", "dev", ".", "--d1", "DB=test-db", "--port", str(PORT), "--ip", "127.0.0.1",
                                       "--persist-to", str(tmp / "d1"), "--compatibility-date", "2026-11-01"],
                           cwd=COPIE, stdout=journal, stderr=subprocess.STDOUT)
BASE = f"http://127.0.0.1:{PORT}/"
for _ in range(90):
    try:
        if json.loads(urllib.request.urlopen(BASE + "api/etat", timeout=2).read()).get("ok"):
            break
    except Exception:
        time.sleep(1)
else:
    serveur.terminate(); sys.exit("Le serveur local ne démarre pas : voir " + str(tmp / "wrangler.log"))

problemes = []
def ok(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        problemes.append(msg)

jeux = json.loads(re.search(r"window\.JEUX = (\[.*\]);", (COPIE / "jeux.js").read_text(encoding="utf8"), re.S).group(1))
JEU = next(j for j in jeux if j["slug"] == "la-division")
STO = JEU["stockage"]

def appareil(browser):
    ctx = browser.new_context()
    pg = ctx.new_page()
    erreurs = []
    pg.on("pageerror", lambda e: erreurs.append(str(e)))
    return ctx, pg, erreurs

def attendre(pg, js, ms=6000):
    try:
        pg.wait_for_function(js, timeout=ms); return True
    except Exception:
        return False

def points_serveur(pg):
    return pg.evaluate("""async sto => { const s = JSON.parse(localStorage.getItem('crayonnade-session'));
        const r = await fetch('/api/moi', {headers: {Authorization: 'Bearer ' + s.jeton}}); const d = await r.json();
        return d.donnees && d.donnees[sto] ? d.donnees[sto].profil.points.length : 0; }""", STO)

def gagner_point(pg, n):
    """Fait comme le jeu : ajoute un bon point au profil courant et réécrit le stockage."""
    pg.evaluate("""([sto, n]) => { const st = JSON.parse(localStorage.getItem(sto)); const p = st.profiles[st.current];
        p.points.push({ at: Date.now() + n, ms: 30000, level: 1, score: 9, parcours: 'jaune', parc: 'jaune' });
        localStorage.setItem(sto, JSON.stringify(st)); }""", [STO, n])

with sync_playwright() as pw:
    chrome = next((c for c in ["/usr/bin/google-chrome", "/usr/bin/chromium"] if os.path.exists(c)), None)
    browser = pw.chromium.launch(executable_path=chrome) if chrome else pw.chromium.launch()

    print("1. Appareil 1 : code de la classe, puis « Qui joue ? » et création du compte")
    c1, a1, e1 = appareil(browser)
    a1.goto(BASE + "index.html")
    a1.fill("#cmg-input", "TEST"); a1.click("#cmg-gate button")
    ok(attendre(a1, "() => document.querySelector('#cmp-porte .cmp-titre') && /Qui joue/.test(document.querySelector('#cmp-porte .cmp-titre').textContent)"), "« Qui joue ? » s'affiche après le code de la classe")
    a1.click("#cmp-porte [data-action=creer]")
    a1.fill("#cmp-login", "Léa"); a1.fill("#cmp-code", "1234"); a1.fill("#cmp-code2", "1234"); a1.click("#cmp-porte button[type=submit]")
    ok("sans accent" in a1.inner_text("#cmp-porte .cmp-erreur"), "un login avec accent est refusé")
    a1.fill("#cmp-login", "Juju37"); a1.fill("#cmp-code2", "1235"); a1.click("#cmp-porte button[type=submit]")
    ok("pas pareils" in a1.inner_text("#cmp-porte .cmp-erreur"), "deux codes différents sont refusés")
    a1.fill("#cmp-code2", "1234"); a1.click("#cmp-porte button[type=submit]")
    ok(attendre(a1, "() => /prêt/.test((document.querySelector('#cmp-porte .cmp-titre') || {}).textContent || '')"), "compte créé : « Ton compte est prêt ! »")
    a1.click("#cmp-porte [data-ok]"); a1.wait_for_load_state("load")
    ok(attendre(a1, "() => /Juju37/.test((document.getElementById('cmp-joueur') || {}).textContent || '')"), "le badge du portail affiche Juju37")

    print("2. Appareil 1 : un jeu démarre sur le login, et ses bons points partent au serveur")
    a1.goto(BASE + "jeux/la-division/index.html"); a1.wait_for_load_state("networkidle")
    ok(a1.locator("#cmg-gate").count() == 0, "pas de porte du code de la classe")
    hello = a1.inner_text("#helloName") if a1.locator("#helloName").count() else ""
    ok(hello == "Juju37" and not a1.locator("#changeName").is_visible(), f"le jeu dit « Bonjour {hello} », sans « Ce n'est pas moi »")
    ok(a1.locator("#cmp-joueur").count() == 1, "le badge est dans la barre du jeu")
    ok(not a1.locator("#teacherLink").is_visible(), "le bouton « Espace enseignante » du jeu est caché pour un élève")
    note = a1.inner_text("body")
    ok("dans ton compte" in note and "sur cet appareil. Joue" not in note, "la phrase « gardés sur cet appareil » devient « gardés dans ton compte »")
    gagner_point(a1, 1); a1.wait_for_timeout(2500)
    ok(points_serveur(a1) == 1, "1 bon point gagné → 1 bon point en ligne")

    print("3. Appareil 2 : « J'ai un compte » dans la porte de la classe, et les bons points reviennent")
    c2, a2, e2 = appareil(browser)
    a2.goto(BASE + "index.html")
    a2.click("#cmg-gate .cmg-compte a")
    a2.fill("#cmp-login", "juju37"); a2.fill("#cmp-code", "9999"); a2.click("#cmp-porte button[type=submit]")
    ok(attendre(a2, "() => /incorrect/.test(document.querySelector('#cmp-porte .cmp-erreur').textContent)"), "mauvais code refusé")
    a2.fill("#cmp-code", "1234"); a2.click("#cmp-porte button[type=submit]"); a2.wait_for_load_state("load")
    ok(attendre(a2, "() => !document.getElementById('cmg-gate') && /Juju37/.test((document.getElementById('cmp-joueur') || {}).textContent || '')"), "connecté sans le code de la classe")
    a2.goto(BASE + "jeux/la-division/index.html"); a2.wait_for_load_state("networkidle"); a2.wait_for_timeout(1500)
    n2 = a2.evaluate("sto => (JSON.parse(localStorage.getItem(sto)).profiles.juju37 || {points: []}).points.length", STO)
    ok(n2 == 1 and a2.inner_text("#helloName") == "Juju37", f"le bon point de l'appareil 1 est là ({n2})")
    gagner_point(a2, 2); a2.wait_for_timeout(2500)
    a1.goto(BASE + "jeux/la-division/index.html"); a1.wait_for_load_state("networkidle"); a1.wait_for_timeout(2500)
    n1 = a1.evaluate("sto => JSON.parse(localStorage.getItem(sto)).profiles.juju37.points.length", STO)
    ok(n1 == 2 and points_serveur(a1) == 2, f"l'appareil 1 retrouve aussi le point de l'appareil 2 ({n1})")

    print("4. Hors ligne puis retour : rien ne se perd")
    c2.set_offline(True); gagner_point(a2, 3); a2.wait_for_timeout(2000); c2.set_offline(False)
    a2.goto(BASE + "index.html"); a2.wait_for_load_state("networkidle"); a2.wait_for_timeout(2500)
    ok(points_serveur(a2) == 3, "le point gagné hors ligne part au retour de la connexion")

    print("5. Changer de joueur")
    a1.goto(BASE + "index.html"); a1.wait_for_load_state("networkidle")
    a1.click("#cmp-joueur [data-changer]")
    ok(attendre(a1, "() => document.querySelector('#cmp-porte .cmp-joueur')"), "« Qui joue ? » propose le login retenu sur l'appareil")
    a1.click("#cmp-porte .cmp-joueur"); a1.fill("#cmp-code", "0000"); a1.click("#cmp-porte button[type=submit]")
    ok(attendre(a1, "() => /incorrect/.test(document.querySelector('#cmp-porte .cmp-erreur').textContent)"), "mauvais code refusé")
    a1.fill("#cmp-code", "1234"); a1.click("#cmp-porte button[type=submit]"); a1.wait_for_load_state("load")
    ok(attendre(a1, "() => /Juju37/.test((document.getElementById('cmp-joueur') || {}).textContent || '')"), "reconnecté avec seulement le code secret")

    print("6. Espace enseignante : premier code, liste, comptes, bons points")
    c3, m, e3 = appareil(browser)
    m.goto(BASE + "index.html"); m.fill("#cmg-input", "TEST"); m.click("#cmg-gate button")
    attendre(m, "() => document.getElementById('cmp-porte')"); m.click("#cmp-porte [data-action=sans]")
    m.goto(BASE + "enseignante/comptes-des-eleves/index.html")
    ok(m.locator("#cmg-gate").count() == 0, "pages de l'enseignante : pas de code de la classe")
    m.fill("#ens-login", "inconnue"); m.fill("#ens-input", "TEST-ENS"); m.click("#ens-gate button[type=submit]")
    ok(attendre(m, "() => /incorrect/.test(document.getElementById('ens-error').textContent)"), "identifiant inconnu refusé")
    m.fill("#ens-login", "Hélène"); m.fill("#ens-input", "TEST-ENS"); m.click("#ens-gate button[type=submit]")
    ok(attendre(m, "() => document.getElementById('ens-n1')"), "première connexion (Hélène + ancien code) : la porte demande le mot de passe")
    m.fill("#ens-n1", "nouveau123"); m.fill("#ens-n2", "NOUVEAU123"); m.click("#ens-gate button[type=submit]")
    ok(attendre(m, "() => !document.getElementById('ens-gate') && /Juju37/.test(document.getElementById('liste').textContent)"), "porte ouverte, la liste montre Juju37")
    ok("3 bons points" in m.inner_text("#liste"), "Juju37 : 3 bons points")
    maintenant = dt.datetime.now(ZoneInfo("Europe/Paris"))
    debut = (maintenant - dt.timedelta(minutes=5)).strftime("%H:%M"); fin = (maintenant + dt.timedelta(minutes=30)).strftime("%H:%M")
    if fin < debut:
        fin = "23:59"
    m.fill("#nvLogin", "Sixieme1"); m.fill("#nvCode", "4321"); m.check("#nvCreneau")
    m.select_option("#nvJour", str(maintenant.isoweekday())); m.fill("#nvDebut", debut); m.fill("#nvFin", fin)
    m.click("#formCreer button[type=submit]")
    ok(attendre(m, "() => /Sixieme1/.test(document.getElementById('liste').textContent)"), "compte créneau créé : " + m.inner_text("#msgCreer"))
    m.goto(BASE + "jeux/la-division/index.html"); m.wait_for_load_state("networkidle"); m.wait_for_timeout(1500)
    vus = m.evaluate("sto => Object.keys(JSON.parse(localStorage.getItem(sto) || '{\"profiles\":{}}').profiles)", STO)
    ok(m.locator("#teacherLink").is_visible() and "juju37" in vus, f"maîtresse dans un jeu : bouton visible, élèves reçus {vus}")
    m.goto(BASE + "jeux/je-me-teste/index.html"); m.wait_for_load_state("networkidle"); m.wait_for_timeout(1500)
    m.click("#teacherLink"); m.wait_for_timeout(300)
    ok("Les bilans des élèves" in m.inner_text("body"), "« Je me teste » : l'écran de la maîtresse montre « Les bilans des élèves »")
    m.goto(BASE + "enseignante/comptes-des-eleves/index.html")
    attendre(m, "() => /Juju37/.test(document.getElementById('liste').textContent)")
    m.locator('.compte[data-login="juju37"] [data-voir]').click()
    attendre(m, "() => !document.getElementById('vueCompte').hidden")
    m.fill("#aj-la-division", "12"); m.click("#enregistrer")
    ok(attendre(m, "() => /12 bons points ajoutés/.test(document.getElementById('msgCompte').textContent)"), "12 bons points ajoutés à Juju37")
    texte = m.inner_text('.jeu:has(#aj-la-division)')
    code = re.search(r"n°1 \(code ([A-Z0-9]{4})\)", texte)
    ok(bool(code) and "15 bons points" in texte, "15 bons points, carte n°1 " + (code.group(1) if code else "?"))
    if code:
        m.goto(BASE + "enseignante/verifier-une-carte-de-bons-points/index.html")
        m.fill("#tName", "Juju37"); m.fill("#tCard", "1"); m.fill("#tCode", code.group(1))
        m.click("button[type=submit]"); m.wait_for_timeout(300)
        ok("Carte valide" in m.inner_text("#result"), "la vérification de la carte marche avec le login")
    m.goto(BASE + "enseignante/comptes-des-eleves/index.html")
    attendre(m, "() => /Juju37/.test(document.getElementById('liste').textContent)")
    m.locator('.compte[data-login="juju37"] [data-voir]').click()
    attendre(m, "() => !document.getElementById('vueCompte').hidden")
    m.click('[data-retirer="la-division"]')
    ok(attendre(m, "() => /12 bons points retirés/.test(document.getElementById('msgCompte').textContent)"), "« Retirer mes ajouts » : 12 retirés")

    print("7. Élève de 6e : seulement pendant son créneau")
    c4, s6, e4 = appareil(browser)
    s6.goto(BASE + "index.html")
    s6.click("#cmg-gate .cmg-compte a")
    s6.fill("#cmp-login", "Sixieme1"); s6.fill("#cmp-code", "4321"); s6.click("#cmp-porte button[type=submit]"); s6.wait_for_load_state("load")
    ok(attendre(s6, "() => !document.getElementById('cmg-gate') && !document.getElementById('cmp-porte')"), "pendant le créneau : l'appli s'ouvre sans le code de la classe")
    m.goto(BASE + "enseignante/comptes-des-eleves/index.html")
    attendre(m, "() => /Sixieme1/.test(document.getElementById('liste').textContent)")
    m.locator('.compte[data-login="sixieme1"] [data-voir]').click()
    attendre(m, "() => !document.getElementById('vueCompte').hidden")
    m.select_option("#crJour", str(maintenant.isoweekday() % 7 + 1)); m.click("#crEnregistrer")
    attendre(m, "() => /Créneau enregistré/.test(document.getElementById('msgCompte').textContent)")
    s6.reload(); s6.wait_for_load_state("networkidle")
    ok(attendre(s6, "() => /marche seulement/.test((document.getElementById('cmp-porte') || {}).textContent || '')"), "hors créneau : « Ton compte marche seulement … »")
    s6.goto(BASE + "index.html"); s6.wait_for_load_state("networkidle")
    ok(attendre(s6, "() => /marche seulement/.test((document.getElementById('cmp-porte') || {}).textContent || '')"), "hors créneau, la porte reste fermée au rechargement")

    print("8. Nouveau code donné par la maîtresse : l'ancienne connexion s'arrête")
    m.goto(BASE + "enseignante/comptes-des-eleves/index.html")
    attendre(m, "() => /Juju37/.test(document.getElementById('liste').textContent)")
    m.once("dialog", lambda d: d.accept("5555"))
    m.locator('.compte[data-login="juju37"] [data-code]').click()
    ok(attendre(m, "() => /5555/.test(document.getElementById('msgListe').textContent)"), "nouveau code : " + m.inner_text("#msgListe"))
    a2.goto(BASE + "index.html"); a2.wait_for_load_state("networkidle"); a2.wait_for_timeout(1500)
    ok(attendre(a2, "() => /Qui joue/.test((document.getElementById('cmp-porte') || {}).textContent || '') || document.getElementById('cmg-gate')"), "l'appareil 2 doit se reconnecter")

    c6 = browser.new_context(); m3 = c6.new_page()
    m3.goto(BASE + "index.html"); m3.evaluate("() => { localStorage.setItem('cm1cm2-code-classe', 'TEST'); localStorage.setItem('crayonnade-sans-compte', '1'); }")
    m3.evaluate("() => localStorage.setItem('crayonnade-ens-injectes', JSON.stringify({'" + STO + "': ['juju37']}))")
    m3.evaluate("sto => localStorage.setItem(sto, JSON.stringify({current: 'juju37', profiles: {juju37: {name: 'Juju37', points: []}}}))", STO)
    m3.goto(BASE + "jeux/la-division/index.html"); m3.wait_for_load_state("networkidle")
    reste = m3.evaluate("sto => Object.keys(JSON.parse(localStorage.getItem(sto)).profiles)", STO)
    ok(reste == [] and not m3.locator("#teacherLink").is_visible(), f"sans la maîtresse, les élèves montrés sont retirés de l'appareil ({reste})")
    c6.close()

    print("9. Ancien code refusé, mot de passe accepté, « Rester connectée »")
    c5, m2, e5 = appareil(browser)
    m2.goto(BASE + "enseignante/index.html")
    m2.fill("#ens-login", "helene"); m2.fill("#ens-input", "TEST-ENS"); m2.click("#ens-gate button[type=submit]")
    ok(attendre(m2, "() => /incorrect/.test(document.getElementById('ens-error').textContent)"), "l'ancien code ne marche plus")
    m2.fill("#ens-input", "Nouveau123"); m2.check("#ens-rester"); m2.click("#ens-gate button[type=submit]")
    ok(attendre(m2, "() => !document.getElementById('ens-gate') && /Hélène/.test(document.getElementById('bonjour').textContent)"), "le mot de passe ouvre « Mon Espace enseignante » : " + m2.inner_text("#bonjour"))
    m4 = c5.new_page()
    m4.goto(BASE + "enseignante/comptes-des-eleves/index.html"); m4.wait_for_load_state("networkidle")
    ok(attendre(m4, "() => !document.getElementById('ens-gate') && /Juju37/.test(document.getElementById('liste').textContent)"), "rester connectée : un autre onglet s'ouvre sans rien retaper")
    m4.goto(BASE + "jeux/la-division/index.html"); m4.wait_for_load_state("networkidle"); m4.wait_for_timeout(1200)
    ok(m4.locator("#teacherLink").is_visible(), "rester connectée : le bouton des jeux est visible")
    m4.goto(BASE + "index.html"); m4.wait_for_load_state("networkidle"); m4.wait_for_timeout(1500)
    ok(m4.locator("#cmg-gate").count() == 0 and m4.locator("#cmp-porte").count() == 0 and m4.locator("#cmp-joueur .cmp-espace").count() == 1,
       "maîtresse connectée : le portail s'ouvre sans code de la classe ni « Qui joue ? », avec « ★ Mon Espace enseignante »")
    m4.goto(BASE + "enseignante/index.html"); m4.wait_for_load_state("networkidle")
    m4.fill("#mdp1", "autre-mdp-7"); m4.fill("#mdp2", "AUTREMDP7"); m4.click("#formMdp button")
    ok(attendre(m4, "() => /changé/.test(document.getElementById('msgMdp').textContent)"), "changer le mot de passe")
    ok(m4.locator("#ens-lock").count() == 0, "rester connectée : pas de bouton flottant « Se déconnecter »")
    ok(m4.evaluate("() => document.querySelector('link[rel=manifest]').getAttribute('href')") == "manifest.webmanifest", "« Mon Espace enseignante » a sa propre icône d'écran d'accueil")
    m4.click("#deconnecter"); m4.wait_for_load_state("load")
    ok(m4.locator("#ens-gate").count() == 1, "« Me déconnecter de cet appareil » referme")
    m4.fill("#ens-login", "helene"); m4.fill("#ens-input", "autremdp7"); m4.click("#ens-gate button[type=submit]")
    ok(attendre(m4, "() => !document.getElementById('ens-gate')"), "le nouveau mot de passe marche")

    toutes = [("appareil 1", e1), ("appareil 2", e2), ("enseignante", e3), ("6e", e4), ("enseignante 2", e5)]
    ok(not any(e for _, e in toutes), "aucune erreur JavaScript " + str([(n, e[:2]) for n, e in toutes if e]))
    browser.close()

serveur.terminate()
try:
    serveur.wait(10)
except Exception:
    serveur.kill()
shutil.rmtree(tmp, ignore_errors=True)
print("\nRÉSULTAT : " + ("tout est bon" if not problemes else f"{len(problemes)} problème(s)"))
sys.exit(1 if problemes else 0)
