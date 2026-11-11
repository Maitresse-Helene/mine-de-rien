/* Mine de rien : le service worker, qui garde l'appli sur l'appareil pour jouer hors ligne.
   Fichier généré par outils/mettre_a_jour_sw.py : ne pas modifier à la main. */
const VERSION = '2026-11-11-213650';
const CACHE = 'jeux-cm1cm2-' + VERSION;
const FICHIERS = [
  "./",
  "commun/commun.css",
  "commun/commun.js",
  "commun/polices/baloo-2-latin-600-normal.woff2",
  "commun/polices/baloo-2-latin-700-normal.woff2",
  "commun/polices/baloo-2-latin-800-normal.woff2",
  "commun/polices/baloo-2-latin-ext-600-normal.woff2",
  "commun/polices/baloo-2-latin-ext-700-normal.woff2",
  "commun/polices/baloo-2-latin-ext-800-normal.woff2",
  "commun/polices/lexend-latin-400-normal.woff2",
  "commun/polices/lexend-latin-500-normal.woff2",
  "commun/polices/lexend-latin-600-normal.woff2",
  "commun/polices/lexend-latin-ext-400-normal.woff2",
  "commun/polices/lexend-latin-ext-500-normal.woff2",
  "commun/polices/lexend-latin-ext-600-normal.woff2",
  "commun/polices/playwrite-fr-moderne-latin-400-normal.woff2",
  "commun/polices/polices.css",
  "commun/vendor/three.min.js",
  "icones/apple-touch-icon.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-masquable-512.png",
  "icones/icone.svg",
  "index.html",
  "jeux/additionner-deux-nombres/index.html",
  "jeux/estimer-un-resultat/index.html",
  "jeux/je-me-teste/index.html",
  "jeux/l-addition-et-la-soustraction-posees/index.html",
  "jeux/la-division/index.html",
  "jeux/la-multiplication-par-trois-chiffres/index.html",
  "jeux/la-multiplication-posee/index.html",
  "jeux/la-phrase-et-ses-constituants/index.html",
  "jeux/la-polysemie/index.html",
  "jeux/le-dictionnaire-l-ordre-alphabetique/index.html",
  "jeux/le-dictionnaire-lire-un-article/index.html",
  "jeux/le-nom-et-le-groupe-nominal/index.html",
  "jeux/le-perimetre/index.html",
  "jeux/le-present-des-trois-groupes/index.html",
  "jeux/le-son-e/index.html",
  "jeux/le-son-j/index.html",
  "jeux/le-sujet/index.html",
  "jeux/le-verbe/index.html",
  "jeux/les-cubes-les-paves-et-les-prismes-droits/index.html",
  "jeux/les-determinants/index.html",
  "jeux/les-doubles/index.html",
  "jeux/les-familles-de-mots/index.html",
  "jeux/les-fractions-decimales/index.html",
  "jeux/les-moities/index.html",
  "jeux/les-nombres-termines-par-8-ou-9/index.html",
  "jeux/les-parentheses/index.html",
  "jeux/les-prefixes/index.html",
  "jeux/les-probabilites/index.html",
  "jeux/les-problemes-a-etapes/index.html",
  "jeux/les-problemes-de-comparaison/index.html",
  "jeux/les-problemes-de-parties-tout/index.html",
  "jeux/les-problemes-de-proportionnalite/index.html",
  "jeux/les-tables-d-addition/index.html",
  "jeux/les-tables-de-multiplication/index.html",
  "jeux/multiplier-par-10-100-1000/index.html",
  "jeux/multiplier-par-4-par-8/index.html",
  "jeux/passer-la-centaine/index.html",
  "jeux/soustractions-de-tete/index.html",
  "jeux.js",
  "manifest.webmanifest"
];

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
  const frais = req.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
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
