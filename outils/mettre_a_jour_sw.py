#!/usr/bin/env python3
"""Réécrit sw.js : la liste des fichiers gardés pour jouer hors ligne, et un nouveau numéro de version.

À lancer après chaque changement dans l'appli (integrer_jeu.py le fait tout seul).
Le nouveau numéro de version oblige les tablettes à reprendre les fichiers à jour.
"""
import datetime as dt
import json
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
EXCLUS_DOSSIERS = {"outils", ".git", ".github", "node_modules"}
EXCLUS_FICHIERS = {"sw.js", "README.md", "CLAUDE.md", ".DS_Store", ".gitignore"}
EXCLUS_EXTENSIONS = {".md", ".txt", ".py"}

MODELE = """/* Mine de rien : le service worker, qui garde l'appli sur l'appareil pour jouer hors ligne.
   Fichier généré par outils/mettre_a_jour_sw.py : ne pas modifier à la main. */
const VERSION = '__VERSION__';
const CACHE = 'jeux-cm1cm2-' + VERSION;
const FICHIERS = __FICHIERS__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n.startsWith('jeux-cm1cm2-') && n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/* Pages et scripts : d'abord le réseau (pour avoir la dernière version), sinon la copie gardée.
   Polices, images, bibliothèques : d'abord la copie gardée. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const frais = req.mode === 'navigate' || /\\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (frais) {
    event.respondWith(
      fetch(req)
        .then(rep => { if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(req, copie)); } return rep; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
  } else {
    event.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
  }
});
"""


def main():
    fichiers = ["./"]
    for f in sorted(RACINE.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(RACINE)
        if rel.parts[0] in EXCLUS_DOSSIERS or f.name in EXCLUS_FICHIERS or f.suffix in EXCLUS_EXTENSIONS:
            continue
        if any(p.startswith(".") for p in rel.parts):
            continue
        fichiers.append(rel.as_posix())
    version = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    liste = "[\n  " + ",\n  ".join(json.dumps(x, ensure_ascii=False) for x in fichiers) + "\n]"
    (RACINE / "sw.js").write_text(MODELE.replace("__VERSION__", version).replace("__FICHIERS__", liste), encoding="utf8")
    print(f"sw.js : version {version}, {len(fichiers)} fichiers gardés hors ligne")


if __name__ == "__main__":
    main()
