# Balance of Power — Vue 3

Portage du jeu de Chris Crawford (édition 1990, source Pascal Macintosh) en Vite + Vue 3 + TypeScript + Pinia + Vitest.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests du moteur
npm run build    # version statique dans dist/
```

## Organisation

- `src/engine/` : le modèle, sans dépendance à Vue.
  - `core.ts` : état du monde, limites de politique, importance (GImpt), actualités.
  - `init.ts` : les 80 pays et la carte, extraits de `Init.p`.
  - `simulation.ts` : déroulé d'une année (insurrections, coups d'État, révolutions, finlandisation, IA de l'ordinateur et des pays mineurs).
  - `crisis.ts` : crises entre superpuissances et avec les pays mineurs.
  - `game.ts` : enchaînement des tours, politiques du joueur.
  - `news.ts` : textes français (actualités, conseillers).
- `src/stores/game.ts` : store Pinia (partie en cours, indice affiché, classes et couleurs de la carte, légende).
- `src/mapGrid.json` : la carte du jeu en pixels (grille 260 × 162 codée en RLE, un point d’ancrage par pays ; encarts agrandis pour l’Amérique centrale et le Levant).
- `data/mapGrid.atlas.json` : la grille d’origine de l’atlas (247 × 162), gardée pour référence. Ses deux encarts étaient coupés à la colonne 0 ; ils ont été retracés d’après les frontières Natural Earth et la grille élargie de 13 colonnes à gauche pour donner `src/mapGrid.json`. Elle n’est pas chargée par l’application.
- `tools/build-map.mjs` : refait `src/mapGrid.json` à partir de la grille de l’atlas (`npm run map`), ou vérifie qu’il est à jour (`npm run map:check`). Il télécharge une fois les frontières Natural Earth (world-atlas 2.0.2, 1:10m) dans `tools/.cache`.
- `src/components/` :
  - `WorldMap.vue` : carte en pixels sur canvas, étiquettes nom + valeur, zoom, déplacement, clic pour ouvrir un pays.
  - `MapLegend.vue` : légende en 5 paliers avec le nombre de pays par palier.
  - `RankStrip.vue` : bande de classement de tous les pays selon l'indice choisi.
  - `CountryPanel.vue`, `PolicyDialog.vue` : dossier d'un pays et choix des politiques.
  - `NewsPanel.vue` : actualités, avis des conseillers, contestation.
  - `CrisisDialog.vue`, `ScoreChart.vue`, `EndScreen.vue`, `NewGame.vue` : crise, prestige, fin et début de partie.
- `src/style.css` : thème (fond gris, accent orange, JetBrains Mono et IBM Plex Sans, cadres à coins).

## Design

Repris de l'atlas Balance of Power 2026 : carte en pixels, légende par paliers, bande de classement.
Le camp du joueur est en orange, la superpuissance adverse en noir (en mode deux joueurs, les États-Unis restent en orange).
Le dossier est une colonne fixe à droite de la carte. Sur un écran plus large qu'un téléphone, l'affiche tient exactement dans la hauteur de la fenêtre.
Le bouton « Journal » du dossier d'un pays ouvre son journal (Events › Newspaper de l'original) dans une fenêtre qu'on déplace par son bandeau : une une sur la situation intérieure, les actualités de l'année qui le concernent, un dernier écho sur le gouvernement. Les titres sont assemblés comme dans l'original, à partir de ses modèles adaptés en français (`src/engine/journal.ts`).
Les références de chaque pays (capitale, oppositions, dirigeant de chaque année de 1982 à 1992, un événement réel par année affiché en « Chronique ») sont dans `src/data/journal.json`, qui remplace la table de l'original et se modifie à la main.
Les cartes suivent les menus Countries et Relations de l'original : les sphères d'influence se lisent sur l'indice `DontMess` (celui que les crises utilisent) en quatre classes, la finlandisation vers chaque superpuissance, les pays en guerre (niveau 4) ; le groupe « Pays choisi » montre les relations du pays sélectionné avec tous les autres et, au niveau 4, ce qu'il accorde ou reçoit (aide militaire, armes, troupes) et avec qui il est en guerre.
Le bouton « Historique » ouvre l'historique du pays (Briefing › History) : neuf petits graphiques année par année (insurrection, popularité, finlandisation, armement, aide et déstabilisation, traités et pression, interventions, relations, pression militaire), montrés selon le niveau comme dans l'original, avec une vue en tableau. Chaque année jouée est enregistrée dans la partie (`World.history`).
Les « Données de fond » du sélecteur d'indice reprennent le Background de l'original : six grandeurs de l'économie du jeu (brutes, par habitant ou en % du PNB) et 23 statistiques réelles des années 1980 tirées de ses ressources (`src/engine/archives.ts`), réparties en quintiles ; la légende donne la valeur et le rang du pays sélectionné.
La partie en cours (y compris une crise ouverte) est enregistrée dans le `localStorage` du navigateur après chaque action, avec l'indice affiché et le pays sélectionné, et reprise à la visite suivante.

Les règles suivent le code Pascal (division entière tronquée, tables de conversion, seuils). Les textes sont réécrits en français.
Non repris : annulation du dernier tour (Undo Last Turn), protection anti-copie du manuel.
