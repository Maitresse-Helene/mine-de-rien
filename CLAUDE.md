# Mine de rien (des jeux bien taillés pour le CM1-CM2) : instructions pour Claude

Web app (PWA statique, sans serveur ni compilation) qui regroupe les jeux éducatifs d'une enseignante
de CM1-CM2. Les jeux sont créés avec Claude sous forme d'artefacts, puis intégrés ici.
L'enseignante ne code pas : réponds-lui en français simple, sans jargon.

## Structure

- `index.html` : le portail. Matières (`SUBJECTS`), domaines et univers peints (`DOMAINS`, `SCENES`), saisons.
- `jeux.js` : `window.JEUX`, une ligne JSON par jeu (`slug`, `domaine`, `titre`, `desc`, `ajoute`, `artefact`).
  L'ordre des lignes est l'ordre d'affichage dans chaque domaine.
- `jeux/<slug>/index.html` : un jeu = une page HTML autonome.
- `enseignante/<slug>/index.html` : les outils de l'enseignante (ex. vérifier une carte de bons points), liés depuis
  l'« Espace enseignante » du portail, hors liste des jeux. Protégés seulement par le code de la classe.
- `commun/commun.js` + `commun/commun.css` : la porte « Code de la classe », le laissez-passer
  portail → jeux, et le bouton « ← Tous les jeux ». Chaque page les charge (`../../commun/...` pour les jeux).
- `commun/polices/` : Baloo 2, Lexend, Playwrite FR Moderne en local (pas de Google Fonts).
- `commun/vendor/three.min.js` : three.js r128 (jeu des solides).
- `sw.js` : généré par `outils/mettre_a_jour_sw.py` (liste hors ligne + version). Ne pas l'éditer à la main.
- `outils/artefacts.json` : identifiant d'artefact claude.ai → slug (pour réécrire les liens entre jeux).

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
3. Teste : `python3 outils/tester.py` (Playwright + Chrome). Tout doit être « ok ».
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

Dépôt GitHub `Maitresse-Helene/mine-de-rien`, publié par Cloudflare Pages (projet `mine-de-rien`, branche `main`,
sans commande de construction, racine) : https://mine-de-rien.pages.dev. Après les tests, commit et push sur `main` :
le site se met à jour tout seul. Garde aussi à jour le dossier de l'enseignante sur son Mac (Documents/jeux web).
Cloudflare redirige « .../index.html » vers « .../ » : le service worker suit lui-même ces redirections pour les pages
(voir `outils/mettre_a_jour_sw.py`), et `outils/tester.py` sert l'appli de la même façon. (GitHub Pages a aussi été
activé sur le dépôt, mais ses publications restaient bloquées : compte trop récent.)

## Règles

- Rien d'externe : pas de CDN ni de Google Fonts. Ajoute toute nouvelle bibliothèque dans `commun/vendor/`
  et sa correspondance dans `BIBLIOTHEQUES` (`integrer_jeu.py`). Seule exception : le formulaire Google
  de fin de jeu (envoi du prénom et du score à l'enseignante), à remplacer avant toute vente.
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
