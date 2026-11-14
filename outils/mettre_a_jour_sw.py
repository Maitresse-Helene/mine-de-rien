#!/usr/bin/env python3
"""Réécrit sw.js : la liste des fichiers gardés pour jouer hors ligne, et un nouveau numéro de version.

À lancer après chaque changement dans l'appli (integrer_jeu.py le fait tout seul).
Le nouveau numéro de version oblige les tablettes à reprendre les fichiers à jour.
"""
import datetime as dt
import json
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
EXCLUS_DOSSIERS = {"outils", ".git", ".github", "node_modules", "functions"}
EXCLUS_FICHIERS = {"sw.js", "README.md", "CLAUDE.md", ".DS_Store", ".gitignore"}
EXCLUS_EXTENSIONS = {".md", ".txt", ".py"}

MODELE = """/* Crayonnade : le service worker, qui garde l'appli sur l'appareil pour jouer hors ligne.
   Fichier généré par outils/mettre_a_jour_sw.py : ne pas modifier à la main. */
const VERSION = '__VERSION__';
const CACHE = 'jeux-cm1cm2-' + VERSION;
const FICHIERS = __FICHIERS__;

/* L'hébergeur (Cloudflare Pages) redirige « .../index.html » vers « .../ ». Une page servie hors ligne
   ne doit pas être une réponse redirigée : on garde donc une copie « propre », sous les deux adresses. */
const propre = async rep => rep.redirected
  ? new Response(await rep.blob(), { status: rep.status, statusText: rep.statusText, headers: rep.headers })
  : rep;
const autreForme = url => {
  const u = new URL(url);
  if (u.pathname.endsWith('/')) u.pathname += 'index.html';
  else if (u.pathname.endsWith('/index.html')) u.pathname = u.pathname.slice(0, -'index.html'.length);
  else return null;
  return u.href;
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FICHIERS.map(async f => {
      const rep = await fetch(f, { cache: 'reload' });
      if (!rep.ok) throw new Error('Fichier introuvable : ' + f);
      const finale = rep.url;
      const copie = await propre(rep);
      await cache.put(f, copie.clone());
      if (finale && finale !== new URL(f, self.location).href) await cache.put(finale, copie.clone());
    }));
    await self.skipWaiting();
  })());
});

const depuisLeCache = async req => {
  const r = await caches.match(req, { ignoreSearch: true });
  if (r) return r;
  const autre = autreForme(req.url);
  return (autre && await caches.match(autre, { ignoreSearch: true })) || caches.match('index.html');
};

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
  if (url.pathname.startsWith('/api/')) return; /* comptes élèves : toujours le serveur, jamais de copie */
  if (req.mode === 'navigate') {
    /* Pages : on suit nous-mêmes la redirection de l'hébergeur et on renvoie une réponse propre,
       toujours fraîche quand le réseau répond, sinon la copie gardée. */
    event.respondWith(
      fetch(req.url, { credentials: 'same-origin', cache: 'no-cache' })
        .then(propre)
        .then(rep => { if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(req.url, copie)); } return rep; })
        .catch(() => depuisLeCache(req))
    );
    return;
  }
  const frais = /\\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (frais) {
    event.respondWith(
      fetch(req)
        .then(rep => { if (rep.ok && !rep.redirected) { const copie = rep.clone(); caches.open(CACHE).then(c => c.put(req, copie)); } return rep; })
        .catch(() => depuisLeCache(req))
    );
  } else {
    event.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).catch(() => depuisLeCache(req))));
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
