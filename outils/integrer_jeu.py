#!/usr/bin/env python3
"""Intègre un jeu (une page HTML autonome, par exemple un artefact Claude) dans l'appli.

Ce que fait le script :
  1. Prépare la page pour l'appli :
     - le code de la classe et le bouton « Tous les jeux » viennent de commun/ (un seul endroit à modifier) ;
     - les polices Google Fonts sont remplacées par les polices hébergées dans commun/polices/ ;
     - les bibliothèques connues (three.js) sont servies depuis commun/vendor/ ;
     - les liens claude.ai/artifact/... vers des jeux déjà intégrés deviennent des liens internes ;
     - « Tous les jeux » ramène au domaine du jeu dans le portail, dans la même fenêtre.
  2. Écrit la page dans jeux/<slug>/index.html.
  3. Ajoute (ou met à jour) la ligne du jeu dans jeux.js.
  4. Retient l'identifiant de l'artefact d'origine dans outils/artefacts.json.
  5. Met à jour la liste des fichiers hors ligne (sw.js).

Pour un outil de l'enseignante (pas un jeu : il n'apparaît pas dans la liste des jeux, mais dans
l'« Espace enseignante » du portail), ajoute --outil : la page va dans enseignante/<slug>/index.html.

Exemple :
  python3 outils/integrer_jeu.py jeu.html --domaine orthographe \\
      --desc "Écrire le son [s] avec s, ss, c, ç…, en plongée dans les fonds marins." \\
      --artefact https://claude.ai/artifact/AbCdEf123
"""
import argparse
import datetime as dt
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
JEUX_JS = RACINE / "jeux.js"
ARTEFACTS = RACINE / "outils" / "artefacts.json"
PORTAIL = RACINE / "index.html"

LIENS_COMMUNS = ('<link rel="stylesheet" href="../../commun/commun.css">'
                 '<script src="../../commun/commun.js"></script>')
LIENS_ENSEIGNANTE = ('<link rel="stylesheet" href="../../commun/enseignante.css">'
                     '<script src="../../commun/enseignante.js"></script>')
LIEN_POLICES = '<link rel="stylesheet" href="../../commun/polices/polices.css">'
POLICES_DISPONIBLES = {"Baloo 2", "Lexend", "Playwrite FR Moderne"}
BIBLIOTHEQUES = {
    r"https://cdnjs\.cloudflare\.com/ajax/libs/three\.js/r128/three(?:\.min)?\.js": "../../commun/vendor/three.min.js",
}
EXTERNES_AUTORISES = ("https://docs.google.com/forms/", "http://www.w3.org/")

ENTETE_JEUX_JS = """/* La liste des jeux de l'appli : une ligne par jeu, dans l'ordre d'affichage de chaque domaine.
   slug : le dossier du jeu dans jeux/ ; domaine : la clé du domaine dans index.html ;
   ajoute : la date d'ajout (le badge « Nouveau » s'affiche 14 jours) ;
   stockage, cle, sel, profilNeuf : les bons points du jeu (pour l'outil « Ajouter des bons points »).
   Ne pas modifier à la main : demander à Claude (outils/integrer_jeu.py). */
window.JEUX = [
"""


def slugifier(texte):
    t = unicodedata.normalize("NFD", texte)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t


def id_artefact(valeur):
    if not valeur:
        return None
    m = re.search(r"artifact/([A-Za-z0-9]+)", valeur)
    return m.group(1) if m else valeur.strip()


def lire_jeux():
    if not JEUX_JS.exists():
        return []
    s = JEUX_JS.read_text(encoding="utf8")
    debut = s.index("window.JEUX = [") + len("window.JEUX = ")
    fin = s.rindex("];") + 1
    return json.loads(s[debut:fin])


def ecrire_jeux(jeux):
    lignes = ",\n".join(json.dumps(j, ensure_ascii=False) for j in jeux)
    JEUX_JS.write_text(ENTETE_JEUX_JS + lignes + "\n];\n", encoding="utf8")


def lire_artefacts():
    return json.loads(ARTEFACTS.read_text(encoding="utf8")) if ARTEFACTS.exists() else {}


def domaines_du_portail():
    s = PORTAIL.read_text(encoding="utf8")
    m = re.search(r"const DOMAINS = \{(.*?)\n  \};", s, re.S)
    return set(re.findall(r"'([a-z0-9-]+)': \{ name:", m.group(1))) if m else set()


# ---------- Bons points : ce que l'outil « Ajouter des bons points » doit savoir de chaque jeu ----------
# stockage : la clé localStorage ; cle : la façon dont le prénom devient la clé du profil (std ou apos) ;
# sel : le « sel » du code de carte ; profilNeuf : le profil créé par le jeu pour un nouvel élève.
def corps_fonction(html, nom):
    m = re.search(r"function %s\(s\)\{([^\n]*)\}" % nom, html) or re.search(r"const %s = s => ([^\n;]*);" % nom, html)
    return m.group(1) if m else ""
def utilise_apos(html, nom, vus=None):
    vus = vus or set()
    if nom in vus: return False
    vus.add(nom)
    corps = corps_fonction(html, nom)
    if "’" in corps or "\\u2019" in corps: return True
    return any(utilise_apos(html, f, vus) for f in re.findall(r"\b(norm|key|bare)\(", corps) if f != nom)
def extraire_infos(html):
    infos = {}
    m = re.search(r"const STORE_KEY = '([^']+)'", html)
    if m: infos["stockage"] = m.group(1)
    m = re.search(r"function setName\([^)]*\)\s*\{(.*?)\n  \}", html, re.S)
    corps = m.group(1) if m else ""
    f = re.search(r"const (?:key|k) = (\w+)\(", corps)
    fn = f.group(1) if f else "norm"
    infos["cle"] = "apos" if utilise_apos(html, fn) else "std"
    m = re.search(r"function cardCode\(name, k\)\{\s*let h = fnv\(\w+\(name\) \+ '\|' \+ k \+ '\|([^']+)'\);", html)
    if m: infos["sel"] = m.group(1)
    m = re.search(r"store\.profiles\[(?:key|k)\] = (\{.*?\});", corps, re.S)
    if m:
        js = "const clean='__NOM__', S={parcours:'jaune'}, PARC0='jaune'; process.stdout.write(JSON.stringify(%s))" % m.group(1)
        try:
            r = subprocess.run(["node", "-e", js], capture_output=True, text=True, timeout=10)
            if r.returncode == 0: infos["profilNeuf"] = json.loads(r.stdout)
        except Exception: pass
    return infos


def preparer_page(html, domaine, artefacts, alertes):
    # langue de la page
    html = re.sub(r"<html(?![^>]*\blang=)", '<html lang="fr"', html, count=1)

    # code de la classe + bouton « Tous les jeux » : depuis commun/
    blocs = list(re.finditer(
        r'<(style|script) id="(cmg-style|cmg-script|cmg-pass|nav-style)"[^>]*>.*?</\1>\s*', html, re.S))
    if blocs:
        debut = blocs[0].start()
        for b in reversed(blocs):
            html = html[:b.start()] + html[b.end():]
        html = html[:debut] + LIENS_COMMUNS + "\n" + html[debut:]
    else:
        alertes.append("pas de code de la classe trouvé : ajouté juste après <body>")
        html = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + LIENS_COMMUNS, html, count=1)

    # polices Google Fonts -> polices locales
    familles = set()
    for m in re.finditer(r"fonts\.googleapis\.com/css2?\?([^\"')]+)", html):
        for f in re.findall(r"family=([^:&]+)", m.group(1)):
            familles.add(f.replace("+", " "))
    manquantes = familles - POLICES_DISPONIBLES
    if manquantes:
        alertes.append("polices non hébergées dans commun/polices : " + ", ".join(sorted(manquantes)))
    liens = list(re.finditer(
        r'<link[^>]+href="https://fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>\s*', html))
    if liens:
        debut = liens[0].start()
        for l in reversed(liens):
            html = html[:l.start()] + html[l.end():]
        html = html[:debut] + LIEN_POLICES + "\n" + html[debut:]
    if "fonts.googleapis.com" in html or "fonts.gstatic.com" in html:
        alertes.append("il reste une référence à Google Fonts (par exemple un @import) : à vérifier")

    # bibliothèques externes connues
    for motif, local in BIBLIOTHEQUES.items():
        html = re.sub(motif, local, html)

    # liens vers d'autres artefacts Claude
    def remplacer(m):
        ident = m.group(1)
        cible = artefacts.get(ident)
        if cible == "portail":
            return "../../index.html" + ("#" + domaine if domaine else "")
        if cible and cible.startswith("enseignante/"):
            return "../../" + cible + "/index.html"
        if cible:
            return "../" + cible + "/index.html"
        alertes.append("lien vers un artefact inconnu laissé tel quel : " + ident)
        return m.group(0)
    html = re.sub(r"https://claude\.ai/artifact/([A-Za-z0-9]+)(?:#[^\"'\s<]*)?", remplacer, html)

    # « Tous les jeux » dans la même fenêtre
    html = re.sub(r'(<nav id="allgames"[^>]*>\s*<a [^>]*?)\s+target="_blank"(\s+rel="noopener")?',
                  r"\1", html)

    # ressources externes restantes
    for m in re.finditer(r"(?:src|href)=\"(https?://[^\"]+)\"", html):
        if not m.group(1).startswith(EXTERNES_AUTORISES):
            alertes.append("ressource externe : " + m.group(1)[:90])
    return html


def integrer_outil(a, html, titre, slug):
    artefacts = lire_artefacts()
    ident = id_artefact(a.artefact)
    if ident:
        artefacts[ident] = "enseignante/" + slug
    alertes = []
    page = preparer_page(html, "", artefacts, alertes)
    if "commun/enseignante.js" not in page:
        page = page.replace(LIENS_COMMUNS, LIENS_COMMUNS + LIENS_ENSEIGNANTE, 1)
        if "commun/enseignante.js" not in page:
            alertes.append("porte « Code de la maîtresse » non ajoutée : à vérifier")
    dossier = RACINE / "enseignante" / slug
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "index.html").write_text(page, encoding="utf8")
    ARTEFACTS.write_text(json.dumps(artefacts, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    if not a.sans_sw:
        sys.path.insert(0, str(Path(__file__).parent))
        import mettre_a_jour_sw
        mettre_a_jour_sw.main()
    print(f"Outil de l'enseignante : {titre} -> enseignante/{slug}/")
    print("  Pense à relancer integrer_portail.py pour mettre le lien dans l'Espace enseignante.")
    for al in alertes:
        print("  ATTENTION :", al)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("fichier", help="la page HTML du jeu")
    p.add_argument("--domaine", help="clé du domaine (ex. calcul-mental, orthographe) ; obligatoire pour un jeu")
    p.add_argument("--desc", help="la phrase qui décrit le jeu dans le portail ; obligatoire pour un jeu")
    p.add_argument("--outil", action="store_true", help="outil de l'enseignante : enseignante/<slug>/, hors liste des jeux")
    p.add_argument("--titre", help="titre du jeu (par défaut : la balise <title> de la page)")
    p.add_argument("--slug", help="nom du dossier (par défaut : le titre sans accents)")
    p.add_argument("--ajoute", help="date d'ajout AAAA-MM-JJTHH:MM (par défaut : maintenant)")
    p.add_argument("--artefact", help="lien ou identifiant de l'artefact Claude d'origine")
    p.add_argument("--sans-sw", action="store_true", help="ne pas mettre à jour sw.js (lot de jeux)")
    a = p.parse_args()

    html = Path(a.fichier).read_text(encoding="utf8")
    titre = a.titre or re.search(r"<title>([^<]*)</title>", html).group(1).strip()
    slug = a.slug or slugifier(titre)
    if a.outil:
        return integrer_outil(a, html, titre, slug)
    if not a.domaine or not a.desc:
        sys.exit("Pour un jeu, --domaine et --desc sont obligatoires (ou --outil pour un outil de l'enseignante).")
    domaines = domaines_du_portail()
    if domaines and a.domaine not in domaines:
        sys.exit(f"Domaine inconnu : {a.domaine}. Domaines du portail : {', '.join(sorted(domaines))}")

    artefacts = lire_artefacts()
    ident = id_artefact(a.artefact)
    if ident:
        artefacts[ident] = slug

    alertes = []
    page = preparer_page(html, a.domaine, artefacts, alertes)
    dossier = RACINE / "jeux" / slug
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / "index.html").write_text(page, encoding="utf8")

    jeux = lire_jeux()
    ancien = next((j for j in jeux if j["slug"] == slug), None)
    ajoute = a.ajoute or (ancien["ajoute"] if ancien else dt.datetime.now().strftime("%Y-%m-%dT%H:%M"))
    entree = {"slug": slug, "domaine": a.domaine, "titre": titre, "desc": a.desc, "ajoute": ajoute}
    if ident:
        entree["artefact"] = ident
    infos = extraire_infos(html)
    entree.update(infos)
    manque = [c for c in ("stockage", "sel", "profilNeuf") if c not in infos]
    if manque:
        alertes.append("bons points non reconnus (" + ", ".join(manque) + ") : l'outil « Ajouter des bons points » "
                       "et la vérification des cartes risquent de ne pas connaître ce jeu")
    if ancien:
        jeux[jeux.index(ancien)] = entree
    else:
        jeux.append(entree)
    ecrire_jeux(jeux)
    ARTEFACTS.write_text(json.dumps(artefacts, ensure_ascii=False, indent=2) + "\n", encoding="utf8")

    if not a.sans_sw:
        sys.path.insert(0, str(Path(__file__).parent))
        import mettre_a_jour_sw
        mettre_a_jour_sw.main()

    print(("Mis à jour" if ancien else "Ajouté") + f" : {titre} -> jeux/{slug}/")
    for al in alertes:
        print("  ATTENTION :", al)


if __name__ == "__main__":
    main()
