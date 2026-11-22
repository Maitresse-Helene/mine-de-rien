#!/usr/bin/env python3
"""Ajoute (ou remplace) une vidéo dans l'appli, comme un jeu de la liste.

    python3 outils/integrer_video.py <video.mp4> --titre "<titre>" --domaine <clé> --desc "<phrase du portail>" \
        [--slug <dossier>] [--apres <slug>] [--affiche <secondes>] [--texte "<phrase sous la vidéo>"]

La vidéo va dans jeux/<slug>/video.mp4, avec une image d'attente (affiche.jpg, tirée de la vidéo) et une page
jeux/<slug>/index.html (code de la classe, bouton « ← Tous les jeux », lecteur). La ligne de jeux.js porte
"video": true : pas de bons points, et le service worker ne garde pas la vidéo hors ligne (trop lourde, et Safari
ne lit pas une vidéo servie par le service worker). Une vidéo doit peser moins de 25 Mo (limite de Cloudflare Pages).
"""
import argparse
import datetime as dt
import html
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
LIMITE = 25 * 1024 * 1024

MODELE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>__TITRE__</title>
<!-- Vidéo de l'appli : page écrite par outils/integrer_video.py (ne pas modifier à la main). -->
<link rel="stylesheet" href="../../commun/polices/polices.css">
<link rel="stylesheet" href="../../commun/commun.css"><script src="../../commun/commun.js"></script>
<style>
  :root{--encre:#1a2358;--papier:#fbf5e6;--rose:#c2365e;--bleu:#2b45c8}
  html,body{margin:0;background:var(--papier);color:var(--encre)}
  body{font:17px/1.5 Lexend,system-ui,sans-serif;min-height:100vh}
  main{max-width:1100px;margin:0 auto;padding:18px 16px 40px}
  h1{font-family:'Playwrite FR Moderne',cursive;font-weight:400;font-size:clamp(1.5rem,4.5vw,2.4rem);line-height:1.5;
     margin:6px 0 14px;text-decoration:underline;text-decoration-color:#f5c518;text-decoration-thickness:6px;
     text-underline-offset:10px;text-decoration-skip-ink:none}
  .sous-titre{font-family:'Baloo 2',sans-serif;font-weight:800;color:var(--bleu);font-size:1.25rem;margin:0 0 14px}
  .ecran{background:#fff;border:3px solid var(--encre);border-radius:18px;padding:8px;box-shadow:0 5px 0 var(--encre)}
  video{display:block;width:100%;height:auto;border-radius:11px;background:var(--papier);aspect-ratio:16/9}
  .texte{margin:18px 2px 0;font-size:1.05rem}
  .hors-ligne{margin:12px 2px 0;font-size:.95rem;color:var(--rose)}
</style>
</head>
<body>
<nav id="allgames" aria-label="Retour à la page des jeux"><a href="../../index.html#__DOMAINE__"><span aria-hidden="true">←</span> Tous les jeux</a></nav>
<main>
  <h1>__TITRE_COURT__</h1>
  <p class="sous-titre">__SOUS_TITRE__</p>
  <div class="ecran">
    <video controls playsinline preload="metadata" poster="affiche.jpg">
      <source src="video.mp4" type="video/mp4">
      Ton navigateur ne sait pas lire cette vidéo.
    </video>
  </div>
  <p class="texte">__TEXTE__</p>
  <p class="hors-ligne" id="hors-ligne" hidden>Pas de connexion internet : la vidéo ne peut pas se lancer. Reviens quand l'appareil est connecté.</p>
</main>
<script>
  (function () {
    var v = document.querySelector('video'), msg = document.getElementById('hors-ligne');
    function verifier() { msg.hidden = navigator.onLine !== false; }
    window.addEventListener('online', verifier); window.addEventListener('offline', verifier); verifier();
    v.addEventListener('error', function () { msg.hidden = false; }, true);
  })();
</script>
</body>
</html>
"""


def slugifier(t):
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def lire_jeux():
    s = (RACINE / "jeux.js").read_text(encoding="utf8")
    m = re.search(r"window\.JEUX = \[\n(.*)\n\];", s, re.S)
    return s, m, [l.rstrip(",") for l in m.group(1).split("\n")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--titre", required=True)
    ap.add_argument("--domaine", required=True)
    ap.add_argument("--desc", required=True)
    ap.add_argument("--slug")
    ap.add_argument("--apres", help="slug du jeu après lequel placer la vidéo (sinon : en tête du domaine)")
    ap.add_argument("--affiche", type=float, default=3.0, help="instant (s) de l'image d'attente")
    ap.add_argument("--texte", default="")
    a = ap.parse_args()

    src = Path(a.video)
    if src.stat().st_size >= LIMITE:
        sys.exit(f"ERREUR : la vidéo pèse {src.stat().st_size / 1e6:.1f} Mo ; il faut moins de 25 Mo (la recompresser).")
    slug = a.slug or slugifier(a.titre)
    dossier = RACINE / "jeux" / slug
    dossier.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dossier / "video.mp4")
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(a.affiche), "-i", str(src), "-frames:v", "1",
                    "-vf", "scale=1280:-2", "-q:v", "4", str(dossier / "affiche.jpg")], check=True)

    # titre court (sans « Vidéo – ») et sous-titre (ce qui est entre parenthèses)
    court = re.sub(r"^Vid[ée]o\s*[–:-]\s*", "", a.titre)
    m = re.search(r"\s*\(([^)]*)\)\s*$", court)
    sous = m.group(1) if m else ""
    court = court[: m.start()] if m else court
    page = (MODELE.replace("__TITRE__", html.escape(a.titre)).replace("__TITRE_COURT__", html.escape(court))
            .replace("__SOUS_TITRE__", html.escape(sous[:1].upper() + sous[1:])).replace("__DOMAINE__", a.domaine)
            .replace("__TEXTE__", html.escape(a.texte)))
    (dossier / "index.html").write_text(page, encoding="utf8")

    s, m, lignes = lire_jeux()
    jeux = [json.loads(l) for l in lignes]
    ancien = next((j for j in jeux if j["slug"] == slug), None)
    entree = {"slug": slug, "domaine": a.domaine, "titre": a.titre, "desc": a.desc,
              "ajoute": ancien["ajoute"] if ancien else dt.datetime.now().strftime("%Y-%m-%dT%H:%M"), "video": True}
    if ancien:
        jeux[jeux.index(ancien)] = entree
    else:
        if a.apres:
            i = next(k for k, j in enumerate(jeux) if j["slug"] == a.apres) + 1
        else:
            i = next((k for k, j in enumerate(jeux) if j["domaine"] == a.domaine), len(jeux))
        jeux.insert(i, entree)
    corps = ",\n".join(json.dumps(j, ensure_ascii=False) for j in jeux)
    (RACINE / "jeux.js").write_text(s[: m.start(1)] + corps + s[m.end(1):], encoding="utf8")
    print(f"vidéo « {a.titre} » → jeux/{slug}/ ({src.stat().st_size / 1e6:.1f} Mo)")
    subprocess.run([sys.executable, str(RACINE / "outils" / "mettre_a_jour_sw.py")], check=True)


if __name__ == "__main__":
    main()
