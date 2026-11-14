# Crayonnade (des jeux bien taillés pour le CM1-CM2) : instructions pour Claude

Web app (PWA statique, sans serveur ni compilation) qui regroupe les jeux éducatifs d'une enseignante
de CM1-CM2. Les jeux sont créés avec Claude sous forme d'artefacts, puis intégrés ici.
L'enseignante ne code pas : réponds-lui en français simple, sans jargon.

## Structure

- `index.html` : le portail. Matières (`SUBJECTS`), domaines et univers peints (`DOMAINS`, `SCENES`), saisons.
- `jeux.js` : `window.JEUX`, une ligne JSON par jeu (`slug`, `domaine`, `titre`, `desc`, `ajoute`, `artefact`,
  et pour les bons points : `stockage`, `cle`, `sel`, `profilNeuf`, extraits du jeu par `integrer_jeu.py`).
  L'ordre des lignes est l'ordre d'affichage dans chaque domaine.
- `jeux/<slug>/index.html` : un jeu = une page HTML autonome.
- `enseignante/<slug>/index.html` : les outils de l'enseignante, liés depuis l'« Espace enseignante » du portail, hors
  liste des jeux, protégés par le code de la maîtresse (`commun/enseignante.js` + `.css`) en plus du code de la classe :
  « Vérifier une carte de bons points » (artefact intégré), « Ajouter des bons points » et « Code APC d'une heure »
  (pages écrites ici, pas d'artefact).
- `commun/domaines.js` : noms des domaines, généré par `integrer_portail.py` pour les outils.
- `commun/commun.js` + `commun/commun.css` : la porte « Code de la classe », le laissez-passer
  portail → jeux, et le bouton « ← Tous les jeux ». Chaque page les charge (`../../commun/...` pour les jeux).
- `commun/polices/` : Baloo 2, Lexend, Playwrite FR Moderne en local (pas de Google Fonts).
- `commun/vendor/three.min.js` : three.js r128 (jeu des solides).
- `sw.js` : généré par `outils/mettre_a_jour_sw.py` (liste hors ligne + version). Ne pas l'éditer à la main.
- `outils/artefacts.json` : identifiant d'artefact claude.ai → slug (pour réécrire les liens entre jeux).
- `functions/api/[[chemin]].js` : le serveur des comptes élèves (Cloudflare Pages Functions + base D1 liée sous le
  nom `DB`). Voir « Les comptes élèves » plus bas. `enseignante/comptes-des-eleves/` : la page de la maîtresse.

## Ajouter ou mettre à jour un jeu

1. Récupère le HTML de l'artefact **sans le faire passer dans ta conversation** : outil `read_file`
   du serveur claude-artifacts avec `slug` = le lien et `paths: ["index.html"]`. Le fichier est enregistré
   sur le disque ; copie-le dans un dossier de travail.
2. Intègre-le :
   ```
   python3 outils/integrer_jeu.py <fichier.html> --domaine <clé> --desc "<phrase du portail>" --artefact <lien>
   ```
   Le titre vient de `<title>`, le slug du titre sans accents. Pour une nouvelle version d'un jeu déjà là,
   la même commande remplace la page et garde la date d'ajout. Lis les lignes `ATTENTION` :
   police non hébergée, ressource externe, lien vers un artefact inconnu.
   L'enseignante modifie souvent plusieurs jeux à la fois dans Claude : à chaque passage, liste ses artefacts
   (`list_artifacts`) et réintègre tous les jeux, le portail et l'outil de vérification modifiés depuis le dernier
   commit de leur page (`updated_at` ou le début du numéro de version = date en secondes). Un artefact peut n'être
   qu'un fragment sans `<head>` : `integrer_jeu.py` ajoute alors l'en-tête (encodage utf-8).
3. Teste : `python3 outils/tester.py` (Playwright + Chrome). Tout doit être « ok ». Après un changement des comptes
   (commun.js sections 1c/5, functions/, enseignante.js, page des comptes) : aussi `python3 outils/tester_comptes.py`
   (vrai serveur local : `npm i wrangler` dans ~/dev).
4. Nouveau domaine : ajoute-le dans `SUBJECTS[...].domains` et `DOMAINS` de `index.html`
   (avec un univers dans `SCENES`), avant d'intégrer le jeu.

## Ajouter ou mettre à jour un outil de l'enseignante

Même chose qu'un jeu, avec `--outil` (ni `--domaine` ni `--desc`) :
```
python3 outils/integrer_jeu.py <fichier.html> --outil --artefact <lien>
```
puis relance `integrer_portail.py` (avec le HTML du portail) pour que le lien apparaisse dans l'Espace enseignante,
et teste. Outil actuel : « Vérifier une carte de bons points » (https://claude.ai/artifact/4BB6KY5aFoYuA8X29MVsF2).
Il contient le « sel » de chaque jeu (liste `GAMES`) : quand un jeu qui donne des cartes est ajouté, il faut aussi
mettre à jour cet outil dans Claude, puis le réintégrer ici.

## « Ajouter des bons points »

`enseignante/ajouter-des-bons-points/index.html` : sur l'appareil d'un élève, la maîtresse reporte les bons points gagnés
ailleurs (les anciens liens Claude). Il lit `jeux.js` (`stockage`, `cle`, `sel`, `profilNeuf`) et ajoute dans
`localStorage[stockage].profiles[clé du prénom].points` des bons points `{ at: hier, ms, level: 0, score: 'reporté',
parcours, parc, enseignante: true }`. Le niveau 0 n'existe dans aucun jeu : il ne compte donc pour aucun niveau, et
« Retirer mes ajouts » n'efface que les points `enseignante: true`. `tester.py` (étape 4d) vérifie que chaque jeu affiche
ces points sans erreur : si un nouveau jeu échoue, adapte l'outil plutôt que le jeu.

## Les comptes élèves

Depuis le 14/11/2026, chaque élève a un compte : un login inventé (jamais son prénom, pour le RGPD) et un code secret
de 4 chiffres. Ses bons points sont gardés en ligne et le suivent sur tous les appareils.
- Serveur : `functions/api/[[chemin]].js` (adresses `/api/...`), base D1 « crayonnade » (juridiction UE) liée au
  projet Pages `crayonnade` sous le nom `DB`. Les tables se créent seules. Sans base (`DB` absente) ou sans serveur
  (tests, fichier local), l'appli marche comme avant : tout reste sur l'appareil.
- Élèves (`commun.js`, sections 1c et 5) : après le code de la classe, « Qui joue ? » (créer mon compte, j'ai déjà un
  compte, jouer sans compte). Un élève connecté entre sans le code de la classe ; dans un jeu, son profil (clé = login
  en minuscules, `name` = login) est créé et choisi avant le jeu grâce à `window.CMG_JEU`, que `integrer_jeu.py` écrit
  dans chaque page (`--reconfigurer` pour réécrire tous les jeux d'après `jeux.js`). Les écritures du jeu dans son
  stockage partent au serveur (1,5 s après, ou en quittant la page) ; au chargement, la page reprend les données du
  serveur. Fusion : les `points` des deux côtés sont gardés (sans compter deux fois un même point, en gardant le nombre
  de points identiques), le reste du profil vient du plus récent. Badge « Changer de joueur » dans la barre des jeux.
- Comptes « créneau » (élèves de 6e des devoirs faits, jeudi 16 h – 17 h) : créés par la maîtresse, ils n'ouvrent
  l'appli que pendant le créneau (heure de Paris, 10 min de marge avant), sans code de la classe.
- Les cartes de bons points d'un élève connecté se vérifient avec son login à la place du prénom.
- Le formulaire « Envoyer mon score » et « Ce n'est pas moi » (élève connecté) sont masqués par `commun.css`. Pour un
  élève connecté, les phrases « gardés sur cet appareil » des jeux deviennent « gardés dans ton compte » (commun.js).
- Le bouton « Espace enseignante » en bas des jeux (`#teacherLink`) n'apparaît que pour la maîtresse : porte de
  l'Espace enseignante ouverte dans l'onglet depuis moins de 20 minutes (classe `cmp-maitresse`, section 6). Le jeu
  reçoit alors du serveur les profils de tous les élèves (`/api/ens/eleves-du-jeu`), que son propre écran enseignant
  affiche (bilans de « Je me teste », cartes) ; ils sont retirés de l'appareil ensuite (`crayonnade-ens-injectes`).
  Plus tard (vente) : un compte par enseignant(e) et par classe, à construire.

## Mettre à jour le portail

Le portail existe aussi en artefact (https://claude.ai/artifact/YYHnbnw3vLakiZD2wGVPvF) : l'enseignante le fait
évoluer dans Claude (nom, mascotte, domaines, univers). Pour reporter ses changements, récupère son HTML
comme un jeu (étape 1 ci-dessus), puis :
```
python3 outils/integrer_portail.py <portail.html>
```
Le script réécrit `index.html` (ne le modifie donc pas à la main) et liste les jeux du portail absents de
l'appli (`À INTÉGRER`) : intègre-les ensuite avec `integrer_jeu.py`, puis teste.

## Publier

Dépôt GitHub `Maitresse-Helene/mine-de-rien`, publié par Cloudflare Pages (branche `main`, sans commande de
construction, racine) dans deux projets : `crayonnade` → **https://crayonnade.pages.dev** (l'adresse de l'appli depuis
le 14/11/2026, celle du QR code) et `mine-de-rien` → https://mine-de-rien.pages.dev (l'ancienne, gardée en route : la section 0 de `commun.js`
renvoie ses pages vers la même page de crayonnade.pages.dev, sauf hors ligne et sauf les adresses d'essai
`xxxx.mine-de-rien.pages.dev`). Le stockage (bons points) est propre à chaque adresse ; seule `crayonnade` a la base des comptes. Après les tests, commit et push sur `main` : les deux sites se
mettent à jour tout seuls (deux vérifications « Cloudflare Pages » sur le commit dans GitHub). Garde aussi à jour le dossier de l'enseignante sur son Mac (Documents/jeux web).
Cloudflare redirige « .../index.html » vers « .../ » : le service worker suit lui-même ces redirections pour les pages
(voir `outils/mettre_a_jour_sw.py`), et `outils/tester.py` sert l'appli de la même façon. (GitHub Pages a aussi été
activé sur le dépôt, mais ses publications restaient bloquées : compte trop récent.)

## Règles

- Rien d'externe : pas de CDN ni de Google Fonts. Ajoute toute nouvelle bibliothèque dans `commun/vendor/`
  et sa correspondance dans `BIBLIOTHEQUES` (`integrer_jeu.py`). Le formulaire Google de fin de jeu (« Envoyer mon
  score à la maîtresse », bloc `.send-box` des jeux) est masqué dans l'appli par `commun.css` : l'enseignante n'en veut
  plus. Si un nouveau jeu l'affiche autrement, masque-le aussi.
- Les clés `localStorage` d'un jeu doivent être propres à ce jeu (`<nom-du-jeu>-bons-points`…) : toutes les
  pages partagent le même stockage. Clés partagées voulues : `cm1cm2-code-classe`, `jeu-son`, `ski-son`.
- Liens internes : chemins relatifs vers `index.html` (pas de dossier nu, pour que l'ouverture en fichier local
  marche). Les liens internes en `target="_blank"` sont ouverts dans la même fenêtre par `commun.js`.
- Après toute modification hors `integrer_jeu.py`, lance `python3 outils/mettre_a_jour_sw.py`, sinon
  les tablettes garderont l'ancienne version.

## Le code de la classe

`window.CMG_CODES` dans `commun/commun.js` : une ligne par période `{ from, to, h }`, où `h` est l'empreinte
du code (jamais le code en clair). Le code est normalisé : sans accents, en majuscules, lettres et chiffres
seulement. Empreinte d'un code :
```
node -e 'const c=process.argv[1].normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");const h=t=>{let n=-559038744,a=1103547984;for(let o=0;o<t.length;o++){const e=t.charCodeAt(o);n=Math.imul(n^e,2654435761);a=Math.imul(a^e,1597334677)}n=Math.imul(n^n>>>16,2246822507);n^=Math.imul(a^a>>>13,3266489909);a=Math.imul(a^a>>>16,2246822507);a^=Math.imul(n^n>>>13,3266489909);return(4294967296*(2097151&a)+(n>>>0)).toString(36)};console.log(h("cm1cm2|"+c))' MONCODE
```
La dernière ligne (2000-01-01 → 9999-12-31) est un code permanent : ne la supprime pas sans l'accord de l'enseignante.

## Les codes APC (une heure)

`window.CMG_APC` dans `commun/commun.js` : un code de 4 caractères par tranche de 10 minutes (`CMG_APC_CODE(n)`, à partir
du `sel`), accepté par la porte de la classe pendant 6 tranches de plus (60 à 70 minutes). La maîtresse l'affiche avec
l'outil `enseignante/code-apc/`. À l'expiration, `cm1cm2-apc-fin` fait recharger la page, qui redemande le code.
Pour annuler tous les codes APC déjà donnés : changer le `sel`.

## Le code de la maîtresse

Il est vérifié par le serveur (`/api/ens/connexion`), qui n'en garde que l'empreinte PBKDF2 (table `reglages`). La
toute première fois, l'ancien code (empreintes `window.ENS_CODES` de `commun/enseignante.js`, préfixe `cm1cm2-ens|`)
fait choisir à la maîtresse un nouveau code d'au moins 6 caractères, introuvable à partir du dépôt public. Sans serveur
(pas de connexion, tests), la porte vérifie `ENS_CODES` sur l'appareil : seuls les outils locaux s'ouvrent alors.
Jamais de code en clair dans le dépôt. La porte n'est retenue que dans l'onglet (sessionStorage, avec le jeton du
serveur, 3 h au plus côté serveur), 20 minutes après la dernière action, et « Verrouiller » referme.
