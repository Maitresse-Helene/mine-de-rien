# Crayonnade

*Des jeux bien taillés pour le CM1-CM2* : la web app de la classe.

Ce dossier contient toute l'appli : le portail et les 38 jeux, prêts à être mis en ligne.

## L'essayer sur votre ordinateur

Double-cliquez sur **index.html** : l'appli s'ouvre dans votre navigateur (Chrome ou Safari).
Le code de la classe est le même qu'aujourd'hui. Une fois le code tapé sur le portail,
les jeux ne le redemandent pas, et « ← Tous les jeux » ramène au bon domaine.

L'installation sur tablette et le jeu sans connexion ne marchent qu'une fois l'appli en ligne
(pas en ouvrant le fichier depuis l'ordinateur).

## Ce qu'il y a dans le dossier

| Élément | Rôle |
|---|---|
| `index.html` | Le portail (accueil, matières, domaines, univers peints). |
| `jeux.js` | La liste des jeux : titre, phrase de présentation, domaine, date d'ajout. |
| `jeux/` | Un dossier par jeu. |
| `enseignante/` | Vos outils, ouverts depuis l'« Espace enseignante » du portail avec le code de la maîtresse : vérifier une carte de bons points, ajouter des bons points, créer un code APC valable une heure. |
| `commun/` | Ce qui sert à toutes les pages : le code de la classe, les polices, la bibliothèque 3D du jeu des solides. |
| `icones/`, `manifest.webmanifest` | L'icône et le nom de l'appli quand on l'installe sur une tablette. |
| `sw.js` | Garde l'appli sur la tablette pour jouer sans connexion. |
| `outils/` | Les outils de Claude pour ajouter un jeu et tout tester. |
| `CLAUDE.md` | Le mode d'emploi pour Claude. |

## Ajouter un jeu

Comme avant, il suffit de le demander à Claude, en donnant le lien du jeu (l'artefact).
Claude l'ajoute dans `jeux/`, met la liste à jour, vérifie que tout marche,
et la mise à jour arrive sur les tablettes à la connexion suivante.

## Ce qui a changé par rapport aux artefacts

- **Les jeux sont les mêmes**, au mot près. Seuls les liens ont été adaptés.
- **Tout est dans l'appli** : les polices ne viennent plus de Google, et rien n'est chargé depuis
  un autre site. L'appli marche donc aussi sans connexion.
- **Les jeux s'ouvrent dans la même fenêtre**, avec « ← Tous les jeux » pour revenir.
  C'est indispensable une fois l'appli installée sur une tablette.
- **Le code de la classe est à un seul endroit** (`commun/commun.js`) : le changer change toutes les pages.
- **Les bons points ne suivent pas** : ils sont gardés par le navigateur, site par site.
  Les élèves repartent de zéro dans l'appli, et gardent leurs bons points dans les anciens liens.

## L'appli en ligne

L'appli est en ligne à l'adresse **https://crayonnade.pages.dev** (hébergement gratuit Cloudflare Pages,
branché sur le dépôt GitHub `Maitresse-Helene/mine-de-rien`). À chaque ajout de jeu, Claude met à jour le dépôt,
et le site suit tout seul en moins d'une minute. L'ancienne adresse https://mine-de-rien.pages.dev renvoie toute seule
vers la nouvelle (les bons points enregistrés sur l'ancienne ne se voient pas sur la nouvelle).

Si vous changez le portail dans Claude (nom, mascotte, domaines…), demandez à Claude de le reporter dans l'appli.

## À régler avant de vendre l'appli

- **Le formulaire Google** : à la fin de chaque jeu, l'élève peut envoyer son prénom et son score
  à la maîtresse par un formulaire Google. C'est très bien pour la classe, mais pour une appli vendue
  à des familles ou à d'autres écoles, il faudra le remplacer : données d'enfants, RGPD.
- **Le code de la classe** n'est pas une vraie protection : pour un accès payant, il faudra de vrais comptes.
- **Le nom « Scrabble »** est une marque déposée : le domaine « Scrabble scolaire » devra changer de nom.

## Licences

Les polices (Baloo 2, Lexend, Playwrite FR Moderne) sont sous licence SIL Open Font License,
et la bibliothèque three.js sous licence MIT. Leurs textes sont dans `commun/polices/` et `commun/vendor/`.

## Les comptes des élèves

Chaque élève a un login inventé (pas son prénom) et un code secret de 4 chiffres : ses bons points le suivent sur tous
les appareils. Les élèves créent leur compte en ouvrant l'appli (avec le code de la classe). Dans l'Espace enseignante,
« Comptes des élèves » permet de voir les comptes et leurs bons points, d'en créer (par exemple pour les élèves de 6e
des devoirs faits, qui ne peuvent jouer que le jeudi de 16 h à 17 h), de donner un nouveau code à un élève qui l'a
oublié, d'ajouter des bons points ou de supprimer un compte. Pour vérifier une carte, tapez le login de l'élève.
