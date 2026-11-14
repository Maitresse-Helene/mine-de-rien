/* Crayonnade : le service worker, qui garde l'appli sur l'appareil pour jouer hors ligne.
   Fichier généré par outils/mettre_a_jour_sw.py : ne pas modifier à la main. */
const VERSION = '2026-11-14-130135';
const CACHE = 'jeux-cm1cm2-' + VERSION;
const FICHIERS = [
  "./",
  "commun/commun.css",
  "commun/commun.js",
  "commun/domaines.js",
  "commun/enseignante.css",
  "commun/enseignante.js",
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
  "enseignante/ajouter-des-bons-points/index.html",
  "enseignante/code-apc/index.html",
  "enseignante/comptes-des-eleves/index.html",
  "enseignante/index.html",
  "enseignante/verifier-une-carte-de-bons-points/index.html",
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
  "jeux/les-complements-a-100/index.html",
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
  "jeux/les-problemes-de-logique/index.html",
  "jeux/les-problemes-de-parties-tout/index.html",
  "jeux/les-problemes-de-proportionnalite/index.html",
  "jeux/les-tables-d-addition/index.html",
  "jeux/les-tables-de-multiplication/index.html",
  "jeux/mon-resultat-est-il-possible/index.html",
  "jeux/multiplier-par-10-100-1000/index.html",
  "jeux/multiplier-par-4-par-8/index.html",
  "jeux/passer-la-centaine/index.html",
  "jeux/soustractions-de-tete/index.html",
  "jeux.js",
  "manifest.webmanifest"
];

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
  const frais = /\.(html|js|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
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
