#!/usr/bin/env python3
"""Reprend le portail (l'artefact « Mine de rien » sur Claude) et le prépare pour l'appli : index.html.

À lancer chaque fois que le portail a été modifié dans Claude (nom, mascotte, univers, domaines…).
Les jeux, eux, s'intègrent avec integrer_jeu.py : ce script signale ceux du portail qui manquent.

  python3 outils/integrer_portail.py portail.html

Ce que fait le script :
  - met le titre, l'icône, le manifeste et les réglages pour tablette dans <head> ;
  - le code de la classe vient de commun/ ; les polices de commun/polices/ ;
  - la liste des jeux vient de jeux.js (les jeux s'ouvrent dans la même fenêtre) ;
  - ajoute le mode d'emploi pour installer l'appli et le mode hors ligne ;
  - met à jour sw.js.
"""
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
NOM_COURT = "Mine de rien"
DESCRIPTION = "Mine de rien : des jeux bien taillés pour le CM1-CM2."

TETE = ('<meta name="description" content="{desc}"><meta name="theme-color" content="#2b45c8">'
        '<link rel="manifest" href="manifest.webmanifest">'
        '<link rel="icon" href="icones/icone.svg" type="image/svg+xml">'
        '<link rel="icon" href="icones/icone-192.png" sizes="192x192" type="image/png">'
        '<link rel="apple-touch-icon" href="icones/apple-touch-icon.png">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-title" content="{nom}"><meta name="apple-mobile-web-app-status-bar-style" content="default">')

LISTE_JEUX = """  /* ---------- Les jeux : la liste est dans jeux.js (un dossier par jeu dans jeux/) ---------- */
  const GAMES = (window.JEUX || []).map(j => ({ domain: j.domaine, title: j.titre, desc: j.desc, url: 'jeux/' + j.slug + '/index.html', added: j.ajoute }));
"""

INSTALLER = ("<p>Pour installer l'appli sur une tablette ou un téléphone : sur iPad ou iPhone, ouvrez cette page "
             "dans Safari, touchez le bouton Partager puis « Sur l'écran d'accueil ». Sur Android, ouvrez-la dans "
             "Chrome, puis menu ⋮ et « Installer l'application ». Une fois ouverte une première fois, l'appli marche "
             "aussi sans connexion.</p>")

SERVICE_WORKER = """<script>
/* L'appli reste sur l'appareil pour jouer hors ligne (seulement quand elle est en ligne, pas en fichier local). */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
</script>
"""


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    s = Path(sys.argv[1]).read_text(encoding="utf8")
    alertes = []

    def remplacer(ancien, nouveau, quoi, regex=False):
        nonlocal s
        n = len(re.findall(ancien, s)) if regex else s.count(ancien)
        if n != 1:
            alertes.append(f"{quoi} : trouvé {n} fois au lieu d'une, non modifié")
            return
        s = re.sub(ancien, lambda m: nouveau, s) if regex else s.replace(ancien, nouveau)

    # langue et <head>
    s = re.sub(r"<html(?![^>]*\blang=)", '<html lang="fr"', s, count=1)
    m = re.search(r"\s*<title>(.*?)</title>", s, re.S)
    titre = m.group(1).strip() if m else NOM_COURT
    if m:
        s = s[:m.start()] + s[m.end():]
    tete = f"<title>{titre}</title>" + TETE.format(desc=DESCRIPTION, nom=NOM_COURT)
    remplacer("</head><body>", tete + "</head><body>", "fin de <head>")

    # code de la classe : depuis commun/
    s = re.sub(r"<!-- Code de la classe[^>]*-->\n?",
               "<!-- Le code de la classe et le code commun à toutes les pages sont dans commun/ : "
               "ne pas modifier à la main, demander à Claude. -->\n", s, count=1)
    blocs = list(re.finditer(r'<(style|script) id="(cmg-style|cmg-script|cmg-pass)"[^>]*>.*?</\1>\s*', s, re.S))
    if len(blocs) != 3:
        alertes.append(f"code de la classe : {len(blocs)} blocs trouvés au lieu de 3")
    if blocs:
        debut = blocs[0].start()
        for b in reversed(blocs):
            s = s[:b.start()] + s[b.end():]
        s = s[:debut] + '<link rel="stylesheet" href="commun/commun.css"><script src="commun/commun.js"></script>\n' + s[debut:]

    # polices
    liens = list(re.finditer(r'<link[^>]+href="https://fonts\.(?:googleapis|gstatic)\.com[^"]*"[^>]*>\s*', s))
    if liens:
        debut = liens[0].start()
        for l in reversed(liens):
            s = s[:l.start()] + s[l.end():]
        s = s[:debut] + '<link rel="stylesheet" href="commun/polices/polices.css">\n' + s[debut:]

    # liste des jeux -> jeux.js ; jeux du portail absents de l'appli
    m = re.search(r"  /\* -+ Les jeux[^\n]*\*/\n  const GAMES = \[(.*?)\n  \];\n", s, re.S)
    if not m:
        sys.exit("Liste des jeux (const GAMES) introuvable dans le portail : rien n'a été écrit.")
    ids_portail = re.findall(r"claude\.ai/artifact/([A-Za-z0-9]+)", m.group(1))
    s = s[:m.start()] + LISTE_JEUX + s[m.end():]
    artefacts = json.loads((RACINE / "outils" / "artefacts.json").read_text(encoding="utf8"))
    manquants = [i for i in ids_portail if i not in artefacts]
    remplacer(""" target="_blank" rel="noopener" style=""", " style=", "ouverture des jeux dans la même fenêtre")

    # textes
    remplacer("Les jeux s'ouvrent dans un nouvel onglet. Ils ne te redemandent pas le code. ",
              "Pour revenir ici depuis un jeu, touche « ← Tous les jeux », en haut de l'écran. ", "texte du pied de page")
    m = re.search(r"(<p>Le code de la classe change tout seul[^<]*</p>)", s)
    if m:
        s = s[:m.end()] + "\n      " + INSTALLER + s[m.end():]
    else:
        alertes.append("espace enseignante : mode d'emploi pour installer l'appli non ajouté")

    # scripts : jeux.js avant le script principal, service worker à la fin
    i = s.rfind("<script>\n(() => {")
    if i < 0:
        sys.exit("Script principal du portail introuvable : rien n'a été écrit.")
    s = s[:i] + '<script src="jeux.js"></script>\n' + s[i:]
    remplacer("</body></html>", SERVICE_WORKER + "</body></html>", "fin de page")

    for reste in ("claude.ai/artifact", "fonts.googleapis.com", "cdnjs.cloudflare.com"):
        if reste in s:
            alertes.append(f"il reste une référence à {reste}")

    (RACINE / "index.html").write_text(s, encoding="utf8")
    sys.path.insert(0, str(Path(__file__).parent))
    import mettre_a_jour_sw
    mettre_a_jour_sw.main()
    print(f"Portail intégré : « {titre} »")
    if manquants:
        print(f"  À INTÉGRER : {len(manquants)} jeu(x) du portail absents de l'appli (integrer_jeu.py) :")
        for i in manquants:
            print("   - https://claude.ai/artifact/" + i)
    for a in alertes:
        print("  ATTENTION :", a)


if __name__ == "__main__":
    main()
